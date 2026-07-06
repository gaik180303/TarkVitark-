import mongoose from 'mongoose';
import Message from '../models/message.model.js';
import { DebateRoom } from '../models/debateRoom.model.js';
import { generateJSON } from './llm.service.js';

const FACT_SYSTEM = `You are a neutral fact-checker for a live debate. Given one chat message,
decide if it makes a checkable factual claim. Respond ONLY as JSON:
{"containsFactualClaim": boolean, "verdict": "accurate"|"inaccurate"|"misleading"|"unverifiable",
"explanation": string (max 240 chars), "confidence": number 0-1}. If there is no factual claim,
set containsFactualClaim false and omit the rest.`;

// Fire-and-forget: fact-check a single message, persist, and broadcast the badge.
// Never throws into the caller — the chat must not depend on the AI.
export function scheduleFactCheck(io, message) {
  const run = async () => {
    const hasEvidence = !!message.evidenceUrl;
    const user = hasEvidence
      ? `Claim: "${message.content}"\nCited source: ${message.evidenceUrl}`
      : `Claim: "${message.content}"`;

    const result = await generateJSON({ system: FACT_SYSTEM, user, kind: 'factcheck', meta: { hasEvidence } });
    if (!result?.containsFactualClaim) return;

    const factCheck = {
      verdict: ['accurate', 'inaccurate', 'misleading', 'unverifiable'].includes(result.verdict)
        ? result.verdict
        : 'unverifiable',
      explanation: String(result.explanation || '').slice(0, 240),
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
      checkedAt: new Date(),
    };

    await Message.findByIdAndUpdate(message._id, { factCheck });
    io?.to(String(message.debateId)).emit('factCheckResult', {
      messageId: String(message._id),
      factCheck,
    });
  };
  run().catch(() => {});
}

const SUMMARY_SYSTEM = `You are an impartial debate judge. Given a transcript labeled by side,
produce ONLY JSON:
{"summary": string (2-3 sentences), "keyPointsFor": string[], "keyPointsAgainst": string[],
"bestArgumentFor": string|null, "bestArgumentAgainst": string|null, "tone": string,
"judge": {"scoreFor": number 0-10, "scoreAgainst": number 0-10,
"winner": "in_favor"|"against"|"tie", "reasoning": string}}.
Judge on logic, evidence and rhetoric — not volume.`;

// Compute talk-share/fact-check stats straight from the messages.
async function computeStats(debateId) {
  const rows = await Message.aggregate([
    { $match: { debateId: new mongoose.Types.ObjectId(debateId) } },
    {
      $group: {
        _id: '$stance',
        count: { $sum: 1 },
        flagged: { $sum: { $cond: [{ $eq: ['$factCheck.verdict', 'inaccurate'] }, 1, 0] } },
      },
    },
  ]);
  let forCount = 0;
  let againstCount = 0;
  let flaggedCount = 0;
  for (const r of rows) {
    if (r._id === 'in_favor') forCount = r.count;
    else if (r._id === 'against') againstCount = r.count;
    flaggedCount += r.flagged;
  }
  const total = forCount + againstCount;
  return {
    total,
    forCount,
    againstCount,
    forSharePct: total ? Math.round((forCount / total) * 100) : 0,
    flaggedCount,
  };
}

// Build the transcript, run the AI recap + judge, persist and broadcast the match report.
export function scheduleDebateSummary(io, debateId) {
  const run = async () => {
    const messages = await Message.find({ debateId })
      .populate('sender', 'username')
      .sort({ createdAt: 1 })
      .lean();

    const stats = await computeStats(debateId);

    const transcript = messages
      .slice(0, 200)
      .map((m) => {
        const side = m.stance === 'in_favor' ? 'FOR' : m.stance === 'against' ? 'AGAINST' : 'HOST';
        return `[${side}] ${m.sender?.username || 'user'}: ${m.content}`;
      })
      .join('\n');

    const ai = await generateJSON({
      system: SUMMARY_SYSTEM,
      user: transcript || 'No arguments were exchanged.',
      kind: 'summary',
      meta: { forCount: stats.forCount, againstCount: stats.againstCount },
    });

    const result = {
      summary: ai?.summary || 'No summary available.',
      keyPointsFor: Array.isArray(ai?.keyPointsFor) ? ai.keyPointsFor.slice(0, 5) : [],
      keyPointsAgainst: Array.isArray(ai?.keyPointsAgainst) ? ai.keyPointsAgainst.slice(0, 5) : [],
      bestArgumentFor: ai?.bestArgumentFor || null,
      bestArgumentAgainst: ai?.bestArgumentAgainst || null,
      tone: ai?.tone || 'unknown',
      judge: ai?.judge || null,
      stats,
      generatedAt: new Date(),
    };

    await DebateRoom.findByIdAndUpdate(debateId, { result });
    io?.to(String(debateId)).emit('debateResult', result);
    return result;
  };
  return run().catch(() => null);
}

export { computeStats };
