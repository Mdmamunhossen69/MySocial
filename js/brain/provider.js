// AI provider abstraction for the pilot bots.
//
// A provider is { name, model, costPerCall, generate(input) -> Promise<{ text, ...meta }> }.
// The ONLY provider shipped is "local-rules": our own engine in this folder. It needs no network, no account, no API
// key and costs nothing. Another provider (a hosted LLM) is NOT shipped on purpose: it would need a secret key and a
// server, and GitHub Pages + the Firebase Spark plan offer no free, safe place to keep one. The abstraction is here so
// that a provider can be added later WITHOUT changing the bots, but only after the owner approves the cost and the key
// handling. Until then guarded() refuses any provider that costs money.
//
// guarded() wraps a provider call with: input/output size limits (the "token limit", counted in characters), a timeout,
// retries with exponential backoff, error handling, usage tracking, a daily call limit and spending limit, and an
// emergency shutdown. On any failure it falls back to the local provider, so a chat message is still answered.
import { reply } from './engine.js';

export class ProviderError extends Error { constructor(code, message) { super(message || code); this.code = code; } }

export const LOCAL = {
  name: 'local-rules', model: 'mysocial-rules-1', costPerCall: 0,
  async generate({ bot, brain, uid, text, history, now, rand }) { return reply({ bot, brain, uid, text, history, now, rand }); }
};

const registry = new Map([[LOCAL.name, LOCAL]]);
export const registerProvider = (p) => { if (!p || typeof p.name !== 'string' || typeof p.generate !== 'function') throw new ProviderError('bad-provider'); registry.set(p.name, p); };
export const getProvider = (name) => registry.get(name) || null;
export const resetProviders = () => { registry.clear(); registry.set(LOCAL.name, LOCAL); };

export const DEFAULTS = { timeoutMs: 3000, retries: 2, backoffMs: 250, maxInputChars: 500, maxOutputChars: 600, dailyCalls: 400, dailySpend: 0 };

export const newUsage = () => ({ calls: 0, ok: 0, failures: 0, retries: 0, timeouts: 0, fallbacks: 0, outChars: 0, spend: 0, shutdown: '' });

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new ProviderError('timeout', `provider timed out after ${ms} ms`)), ms);
  promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

// Emergency shutdown: after this no provider other than the local one is called until the process ends.
export function shutdown(usage, reason) { usage.shutdown = String(reason || 'emergency'); }

export async function guarded(provider, input, { usage = newUsage(), opts = {}, fallback = LOCAL, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), allowPaid = false } = {}) {
  const o = { ...DEFAULTS, ...opts };
  const input2 = { ...input, text: String(input.text ?? '').slice(0, o.maxInputChars) };
  const fb = async (why) => { usage.fallbacks++; const r = await fallback.generate(input2); return { ...r, provider: fallback.name, fellBackBecause: why }; };
  const cost = Number(provider.costPerCall) || 0;

  // a provider that costs money is refused unless the owner explicitly allowed it AND a spending limit exists
  if (cost > 0 && (!allowPaid || !(o.dailySpend > 0))) return fb('paid-provider-not-allowed');
  if (usage.shutdown && provider !== fallback) return fb(`shutdown:${usage.shutdown}`);
  if (usage.calls >= o.dailyCalls && provider !== fallback) return fb('daily-call-limit');
  if (usage.spend + cost > o.dailySpend && cost > 0) return fb('daily-spend-limit');

  let lastErr = null;
  for (let attempt = 0; attempt <= o.retries; attempt++) {
    if (attempt > 0) { usage.retries++; await sleep(o.backoffMs * 2 ** (attempt - 1)); }
    usage.calls++; usage.spend += cost;
    try {
      const out = await withTimeout(Promise.resolve(provider.generate(input2)), o.timeoutMs);
      if (!out || typeof out.text !== 'string' || !out.text.trim()) throw new ProviderError('empty', 'provider returned no text');
      const text = out.text.slice(0, o.maxOutputChars);
      usage.ok++; usage.outChars += text.length;
      return { ...out, text, provider: provider.name };
    } catch (e) {
      lastErr = e; usage.failures++;
      if (e instanceof ProviderError && e.code === 'timeout') usage.timeouts++;
      if (e instanceof ProviderError && e.code === 'fatal') break;   // no point retrying
    }
  }
  return fb(`failed:${lastErr && lastErr.code ? lastErr.code : 'error'}`);
}
