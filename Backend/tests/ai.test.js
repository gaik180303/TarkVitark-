import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import Message from '../src/models/message.model.js';
import { DebateRoom } from '../src/models/debateRoom.model.js';
import { User } from '../src/models/user.model.js';
import { scheduleFactCheck, scheduleDebateSummary } from '../src/services/debateAnalysis.service.js';
import { generateJSON, llmAvailable } from '../src/services/llm.service.js';

// A fake io that records what would be broadcast to a room.
const fakeIo = () => {
  const emitted = [];
  return {
    emitted,
    to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }),
  };
};

const waitFor = async (predicate, ms = 3000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
};

const makeDebateWithMessages = async () => {
  const host = await User.create({
    fullName: 'Host', username: `h${Date.now()}`, email: `h${Date.now()}@t.com`, password: 'password123',
  });
  const debate = await DebateRoom.create({
    title: 'AI', description: 'd', host: host._id, participants: [host._id],
    status: 'ongoing', scheduledAt: new Date(),
  });
  await Message.create({ debateId: debate._id, sender: host._id, content: '90% of teens use social media daily.', stance: 'in_favor' });
  await Message.create({ debateId: debate._id, sender: host._id, content: 'That figure is misleading.', stance: 'against' });
  return debate;
};

describe('AI layer (mock provider by default)', () => {
  it('runs in demo mode without a key', () => {
    expect(llmAvailable()).toBe(false);
  });

  it('flags a factual claim and broadcasts the badge', async () => {
    const debate = await makeDebateWithMessages();
    const msg = await Message.findOne({ debateId: debate._id, content: /90%/ });
    const io = fakeIo();

    scheduleFactCheck(io, msg);

    const gotBadge = await waitFor(() => io.emitted.some((e) => e.event === 'factCheckResult'));
    expect(gotBadge).toBe(true);

    const updated = await Message.findById(msg._id);
    expect(updated.factCheck?.verdict).toBeTruthy();
  });

  it('does not fact-check a non-claim', async () => {
    const debate = await makeDebateWithMessages();
    const host = await User.findOne();
    const chit = await Message.create({ debateId: debate._id, sender: host._id, content: 'Hello everyone', stance: 'in_favor' });
    const io = fakeIo();

    scheduleFactCheck(io, chit);
    await new Promise((r) => setTimeout(r, 200));

    expect(io.emitted.some((e) => e.event === 'factCheckResult')).toBe(false);
    const updated = await Message.findById(chit._id);
    expect(updated.factCheck?.verdict).toBeUndefined();
  });

  it('generates a match report (summary + judge + stats) on debate end', async () => {
    const debate = await makeDebateWithMessages();
    const io = fakeIo();

    const result = await scheduleDebateSummary(io, debate._id);

    expect(result).toBeTruthy();
    expect(result.summary).toBeTruthy();
    expect(result.stats.total).toBe(2);
    expect(result.stats.forCount).toBe(1);
    expect(result.stats.againstCount).toBe(1);
    expect(result.judge).toBeTruthy();

    // Persisted on the debate and broadcast
    const saved = await DebateRoom.findById(debate._id);
    expect(saved.result.summary).toBe(result.summary);
    expect(io.emitted.some((e) => e.event === 'debateResult')).toBe(true);
  });

  it('generateJSON returns structured factcheck output', async () => {
    const res = await generateJSON({
      system: 'x', user: 'Studies show 50% improvement.', kind: 'factcheck', meta: {},
    });
    expect(res.containsFactualClaim).toBe(true);
    expect(['accurate', 'inaccurate', 'misleading', 'unverifiable']).toContain(res.verdict);
  });
});
