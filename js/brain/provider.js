// AI provider abstraction for the pilot bots.
//
// A provider is { name, model, costPerCall, generate(input) -> Promise<{ text, ...meta }> }.
// The ONLY provider shipped is "local-rules": our own engine in this folder. It needs no network, no account, no API
// key and costs nothing. A hosted LLM is NOT shipped on purpose: it needs a secret key and a server, and GitHub Pages +
// the Firebase Spark plan offer no free, safe place to keep one. The abstraction exists so a provider can be added
// later WITHOUT touching the bots, but only after the owner approves cost and key handling. guarded() refuses any
// provider whose cost is not a valid number >= 0, and any provider that costs money unless explicitly allowed AND a
// spending limit exists.
//
// guarded() adds: size limits (characters stand in for tokens), a timeout (cooperative via AbortSignal, plus a
// measured check), bounded retries with exponential backoff, an output filter (no markup, no secrets), usage
// tracking that can be saved and restored (see exportUsage/restoreUsage), a daily call/spend limit and an emergency
// shutdown. If anything fails, the local engine answers; if even that fails, a fixed safe sentence is returned, so
// guarded() never throws.
//
// LIMITATION (JavaScript): a provider that BLOCKS the thread in a synchronous loop cannot be interrupted. Its answer
// is discarded and counted as a timeout once it returns, but the wait itself cannot be shortened.
import { reply } from './engine.js';

export class ProviderError extends Error { constructor(code, message) { super(message || code); this.code = code; } }

export const LOCAL = {
  name: 'local-rules', model: 'mysocial-rules-1', costPerCall: 0,
  async generate({ bot, brain, uid, text, history, now, rand }) { return reply({ bot, brain, uid, text, history, now, rand }); }
};

export const validCost = (c) => typeof c === 'number' && Number.isFinite(c) && c >= 0;

const registry = new Map([[LOCAL.name, LOCAL]]);
export const registerProvider = (p) => {
  if (!p || typeof p.name !== 'string' || !p.name || typeof p.generate !== 'function' || !validCost(p.costPerCall)) throw new ProviderError('bad-provider');
  if (p.name === LOCAL.name) throw new ProviderError('bad-provider', 'the local provider cannot be replaced');
  registry.set(p.name, p);
};
export const getProvider = (name) => registry.get(name) || null;
export const resetProviders = () => { registry.clear(); registry.set(LOCAL.name, LOCAL); };

export const DEFAULTS = { timeoutMs: 3000, totalMs: 8000, retries: 2, backoffMs: 250, maxBackoffMs: 2000, maxInputChars: 500, maxOutputChars: 600, dailyCalls: 400, dailySpend: 0 };
const STATIC = {
  en: 'Sorry, I cannot answer right now. Please try again a little later.',
  bn: 'দুঃখিত, এখন উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করুন।'
};

// ---- usage: plain numbers only, so it can be stored and restored for the same (Dhaka) day
const NUM_KEYS = ['calls', 'ok', 'failures', 'retries', 'timeouts', 'fallbacks', 'outChars', 'spend'];
export const newUsage = (day = '') => ({ day, calls: 0, ok: 0, failures: 0, retries: 0, timeouts: 0, fallbacks: 0, outChars: 0, spend: 0, shutdown: '' });
export function exportUsage(u) { const o = { day: String(u.day || ''), shutdown: String(u.shutdown || '').slice(0, 60) }; for (const k of NUM_KEYS) o[k] = Number.isFinite(u[k]) && u[k] >= 0 ? u[k] : 0; return o; }
// a stored counter of an earlier day is dropped (daily limits start fresh), but a shutdown stays until someone clears it
export function restoreUsage(raw, day) {
  const u = newUsage(day);
  if (!raw || typeof raw !== 'object') return u;
  if (typeof raw.shutdown === 'string') u.shutdown = raw.shutdown.slice(0, 60);
  if (raw.day === day) for (const k of NUM_KEYS) if (Number.isFinite(raw[k]) && raw[k] >= 0) u[k] = raw[k];
  return u;
}
export function shutdown(usage, reason) { usage.shutdown = String(reason || 'emergency').slice(0, 60); }

// ---- output filter: a provider's text is untrusted too
const UNSAFE = /<\s*\/?\s*(script|img|iframe|svg|object|embed|link|style|form|input)\b|javascript:|\bon[a-z]+\s*=|AIza[0-9A-Za-z_-]{20,}|\bsk-[A-Za-z0-9_-]{20,}|\bghp_[A-Za-z0-9]{20,}|\bAKIA[0-9A-Z]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/i;
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g;
export function cleanOutput(text, max) {
  if (typeof text !== 'string') throw new ProviderError('empty', 'provider returned no text');
  const t = text.replace(CTRL, '').replace(/[ \t]+/g, ' ').trim();
  if (!t) throw new ProviderError('empty', 'provider returned no text');
  if (UNSAFE.test(t)) throw new ProviderError('unsafe-output', 'provider output rejected by the filter');
  return t.slice(0, max);
}

const withTimeout = (run, ms) => {
  const ac = new AbortController(); let timer;
  const p = new Promise((resolve, reject) => {
    timer = setTimeout(() => { ac.abort(); reject(new ProviderError('timeout', `provider timed out after ${ms} ms`)); }, ms);
    Promise.resolve().then(() => run(ac.signal)).then(resolve, reject);
  });
  return p.finally(() => clearTimeout(timer));
};

export async function guarded(provider, input, { usage = newUsage(), opts = {}, fallback = LOCAL, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), allowPaid = false } = {}) {
  const o = { ...DEFAULTS, ...opts };
  const input2 = { ...input, text: String(input.text ?? '').slice(0, o.maxInputChars) };
  const lang = /[ঀ-৿]/.test(input2.text) ? 'bn' : 'en';
  // the last line of defence: never throws, never calls anything that can fail
  const safe = (why) => ({ text: STATIC[lang], intent: 'error', lang, provider: 'static', fellBackBecause: why });
  const fb = async (why) => {
    if (isFallback) return safe(why);   // the fallback itself failed: do not call it twice
    usage.fallbacks++;
    try { const r = await fallback.generate(input2); return { ...r, provider: fallback.name, fellBackBecause: why }; }
    catch { usage.failures++; return safe(`${why}+fallback-failed`); }
  };
  const isFallback = provider === fallback;
  const cost = provider && provider.costPerCall;

  if (!provider || typeof provider.generate !== 'function') return fb('bad-provider');
  if (!validCost(cost)) return fb('invalid-cost');                        // NaN, negative, string, missing: refused
  if (cost > 0 && (!allowPaid || !(o.dailySpend > 0))) return fb('paid-provider-not-allowed');
  if (!isFallback) {
    if (usage.shutdown) return fb(`shutdown:${usage.shutdown}`);
    if (usage.calls >= o.dailyCalls) return fb('daily-call-limit');
    if (cost > 0 && usage.spend + cost > o.dailySpend) return fb('daily-spend-limit');
  }

  const retries = isFallback ? 0 : Math.max(0, o.retries);                // retrying our own deterministic engine is pointless
  const started = Date.now(); let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const wait = Math.min(o.maxBackoffMs, o.backoffMs * 2 ** (attempt - 1));
      if (Date.now() - started + wait >= o.totalMs) break;               // the total time for one message is bounded
      usage.retries++; await sleep(wait);
    }
    usage.calls++; usage.spend += cost;
    const t0 = Date.now();
    try {
      const out = await withTimeout((signal) => provider.generate({ ...input2, signal }), o.timeoutMs);
      if (Date.now() - t0 > o.timeoutMs) throw new ProviderError('timeout', 'provider answered after the timeout');   // a blocking provider
      if (!out || typeof out !== 'object') throw new ProviderError('empty', 'provider returned nothing');
      const text = cleanOutput(out.text, o.maxOutputChars);
      usage.ok++; usage.outChars += text.length;
      return { ...out, text, provider: provider.name };
    } catch (e) {
      lastErr = e; usage.failures++;
      const code = e instanceof ProviderError ? e.code : 'error';
      if (code === 'timeout') usage.timeouts++;
      if (code === 'fatal' || code === 'unsafe-output') break;           // retrying cannot help
    }
  }
  return fb(`failed:${lastErr instanceof ProviderError ? lastErr.code : 'error'}`);
}
