// Provider-swappable LLM access with graceful degradation.
//
// Set LLM_PROVIDER=groq (or gemini) plus the matching API key to use a real model.
// With no key, everything falls back to a deterministic "mock" provider so the whole
// AI pipeline still runs and is demoable/testable — features show a "demo mode" note
// instead of erroring, and nothing ever blocks the chat.

const PROVIDER = (process.env.LLM_PROVIDER || 'mock').toLowerCase();
const GROQ_KEY = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const TIMEOUT_MS = 20000;

// True only when a real provider is configured with a key.
export const llmAvailable = () =>
  (PROVIDER === 'groq' && !!GROQ_KEY) || (PROVIDER === 'gemini' && !!GEMINI_KEY);

// ---- tiny dependency-free concurrency limiter (respects free-tier rate limits) ----
class Limiter {
  constructor(max) {
    this.max = max;
    this.active = 0;
    this.queue = [];
  }
  run(fn) {
    return new Promise((resolve, reject) => {
      const task = () => {
        this.active += 1;
        Promise.resolve()
          .then(fn)
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            const next = this.queue.shift();
            if (next) next();
          });
      };
      if (this.active < this.max) task();
      else this.queue.push(task);
    });
  }
}
const limiter = new Limiter(2);

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), ms)),
  ]);

const extractJSON = (text) => {
  if (!text) return null;
  // Models sometimes wrap JSON in ```json fences or prose — grab the first {...} block.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
};

// ---- real providers (fetch-based; no SDK dependency) ----
async function callGroq(system, user) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return extractJSON(data.choices?.[0]?.message?.content);
}

async function callGemini(system, user) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return extractJSON(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

// ---- deterministic mock (demo mode) ----
const NOTE = 'Demo mode — add an LLM key (GROQ_API_KEY) to enable real AI.';

function mockResult(kind, user, meta = {}) {
  if (kind === 'factcheck') {
    const hasClaim = /\d|%|percent|study|studies|research|proven|always|never|\bmost\b|\bevery\b/i.test(user);
    if (!hasClaim && !meta.hasEvidence) return { containsFactualClaim: false };
    return {
      containsFactualClaim: true,
      verdict: meta.hasEvidence ? 'accurate' : 'unverifiable',
      explanation: meta.hasEvidence
        ? `A source was cited; verify it supports the claim. ${NOTE}`
        : `This looks like a factual claim but couldn't be verified automatically. ${NOTE}`,
      confidence: 0.4,
    };
  }
  if (kind === 'summary') {
    const { forCount = 0, againstCount = 0 } = meta;
    return {
      summary: `The room exchanged ${forCount + againstCount} arguments on the motion. ${NOTE}`,
      keyPointsFor: forCount ? ['The For side made its case for the motion.'] : [],
      keyPointsAgainst: againstCount ? ['The Against side pushed back on the motion.'] : [],
      bestArgumentFor: forCount ? 'The strongest supporting point raised.' : null,
      bestArgumentAgainst: againstCount ? 'The strongest opposing point raised.' : null,
      tone: 'civil',
      judge: {
        scoreFor: forCount >= againstCount ? 6 : 5,
        scoreAgainst: againstCount > forCount ? 6 : 5,
        winner: forCount === againstCount ? 'tie' : forCount > againstCount ? 'in_favor' : 'against',
        reasoning: `Scored on volume of argument in demo mode. ${NOTE}`,
      },
    };
  }
  return null;
}

/**
 * Generate a structured (JSON) response.
 * @param {{system:string, user:string, kind:'factcheck'|'summary', meta?:object}} opts
 * @returns {Promise<object|null>} parsed object, or null if unavailable/failed
 */
export async function generateJSON({ system, user, kind, meta = {} }) {
  if (!llmAvailable()) return mockResult(kind, user, meta);

  const call = PROVIDER === 'gemini' ? callGemini : callGroq;
  return limiter.run(async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await withTimeout(call(system, user), TIMEOUT_MS);
        if (result) return result;
      } catch {
        // retry once, then give up gracefully
      }
    }
    return mockResult(kind, user, meta); // degrade rather than fail the feature
  });
}
