// AI provider abstraction: timeout, retry/backoff, failure fallback, usage, limits, emergency shutdown, paid-provider refusal.
// Pure unit tests with fake providers. (Not an emulator test, not a live test, no real AI service is called.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guarded, LOCAL, ProviderError, newUsage, shutdown, registerProvider, getProvider, resetProviders, DEFAULTS, validCost, cleanOutput, exportUsage, restoreUsage } from '../js/brain/provider.js';
import { emptyBrain } from '../js/brain/memory.js';

const input = () => ({ bot: { id: 'bot_01', name: 'TechTip Nova' }, brain: emptyBrain('bot_01'), uid: 'userAAAAAA01', text: 'how do I make a strong password?', history: [], now: Date.parse('2026-11-13T05:00:00Z'), rand: () => 0.4 });
const noSleep = { sleep: async () => {} };

test('default provider is the local rule engine: free, no network, no key', async () => {
  assert.equal(LOCAL.costPerCall, 0); assert.equal(getProvider('local-rules'), LOCAL); assert.equal(getProvider('some-llm'), null);
  const usage = newUsage(); const r = await guarded(LOCAL, input(), { usage });
  assert.equal(r.provider, 'local-rules'); assert.ok(r.text.length > 0); assert.equal(usage.ok, 1); assert.equal(usage.spend, 0);
});

test('a failing provider is retried with growing backoff, then the local engine still answers', async () => {
  const sleeps = []; let n = 0;
  const bad = { name: 'flaky', costPerCall: 0, generate: async () => { n++; throw new Error('boom'); } };
  const usage = newUsage();
  const r = await guarded(bad, input(), { usage, sleep: async (ms) => sleeps.push(ms), opts: { retries: 2, backoffMs: 100 } });
  assert.equal(n, 3, '1 try + 2 retries'); assert.deepEqual(sleeps, [100, 200], 'exponential backoff');
  assert.equal(r.provider, 'local-rules'); assert.match(r.fellBackBecause, /^failed/); assert.ok(r.text);
  assert.equal(usage.failures, 3); assert.equal(usage.retries, 2); assert.equal(usage.fallbacks, 1);
});

test('a provider that recovers on a retry is used (no fallback)', async () => {
  let n = 0; const p = { name: 'slowstart', costPerCall: 0, generate: async () => { if (++n < 2) throw new Error('x'); return { text: 'hello from provider' }; } };
  const usage = newUsage(); const r = await guarded(p, input(), { usage, ...noSleep });
  assert.equal(r.provider, 'slowstart'); assert.equal(r.text, 'hello from provider'); assert.equal(usage.retries, 1); assert.equal(usage.fallbacks, 0);
});

test('timeout: a provider that hangs is cut off and counted', async () => {
  const hang = { name: 'hang', costPerCall: 0, generate: () => new Promise(() => {}) };
  const usage = newUsage(); const t0 = Date.now();
  const r = await guarded(hang, input(), { usage, ...noSleep, opts: { timeoutMs: 40, retries: 1 } });
  assert.ok(Date.now() - t0 < 2000); assert.equal(usage.timeouts, 2); assert.equal(r.provider, 'local-rules'); assert.equal(r.fellBackBecause, 'failed:timeout');
});

test('a fatal error is not retried; an empty answer counts as a failure', async () => {
  let n = 0; const fatal = { name: 'fatal', costPerCall: 0, generate: async () => { n++; throw new ProviderError('fatal'); } };
  await guarded(fatal, input(), { ...noSleep }); assert.equal(n, 1);
  const empty = { name: 'empty', costPerCall: 0, generate: async () => ({ text: '   ' }) };
  const r = await guarded(empty, input(), { ...noSleep, opts: { retries: 0 } }); assert.equal(r.provider, 'local-rules');
});

test('size limits: long input is cut before the provider sees it, long output is cut before it is returned', async () => {
  let seen = ''; const p = { name: 'big', costPerCall: 0, generate: async (i) => { seen = i.text; return { text: 'x'.repeat(5000) }; } };
  const r = await guarded(p, { ...input(), text: 'a'.repeat(5000) }, { ...noSleep });
  assert.equal(seen.length, DEFAULTS.maxInputChars); assert.equal(r.text.length, DEFAULTS.maxOutputChars);
});

test('paid providers are refused unless explicitly allowed AND a spending limit exists (no paid service without the owner)', async () => {
  let called = 0; const paid = { name: 'paid-llm', costPerCall: 0.002, generate: async () => { called++; return { text: 'ok' }; } };
  const r1 = await guarded(paid, input(), { ...noSleep }); assert.equal(called, 0); assert.equal(r1.fellBackBecause, 'paid-provider-not-allowed');
  const r2 = await guarded(paid, input(), { ...noSleep, allowPaid: true }); assert.equal(called, 0, 'allowed but no spending limit set');
  const usage = newUsage();
  for (let i = 0; i < 5; i++) await guarded(paid, input(), { ...noSleep, usage, allowPaid: true, opts: { dailySpend: 0.005 } });
  assert.equal(called, 2, 'stops once the daily spending limit would be exceeded'); assert.ok(usage.spend <= 0.005 + 1e-9);
});

test('daily call limit and emergency shutdown send everything to the local engine', async () => {
  let called = 0; const p = { name: 'ext', costPerCall: 0, generate: async () => { called++; return { text: 'ext answer' }; } };
  const usage = newUsage();
  await guarded(p, input(), { usage, ...noSleep, opts: { dailyCalls: 2 } }); await guarded(p, input(), { usage, ...noSleep, opts: { dailyCalls: 2 } });
  const r = await guarded(p, input(), { usage, ...noSleep, opts: { dailyCalls: 2 } });
  assert.equal(called, 2); assert.equal(r.fellBackBecause, 'daily-call-limit');
  const u2 = newUsage(); shutdown(u2, 'owner pressed stop');
  const r2 = await guarded(p, input(), { usage: u2, ...noSleep }); assert.equal(called, 2); assert.match(r2.fellBackBecause, /^shutdown/);
  assert.ok(r2.text, 'the user still gets an answer');
});

test('registry: bad providers are rejected, no external provider is shipped', () => {
  assert.throws(() => registerProvider({ name: 'x' }), /bad-provider/);
  assert.throws(() => registerProvider({ name: 'nocost', generate: async () => ({ text: 'a' }) }), /bad-provider/, 'a missing cost is refused');
  assert.throws(() => registerProvider({ name: 'local-rules', costPerCall: 0, generate: async () => ({ text: 'a' }) }), /cannot be replaced/);
  registerProvider({ name: 'test-only', costPerCall: 0, generate: async () => ({ text: 'a' }) }); assert.ok(getProvider('test-only'));
  assert.equal(getProvider('local-rules'), LOCAL, 'the local provider is untouched');
  resetProviders(); assert.equal(getProvider('test-only'), null);
});

// ---------- B1.1 item 4: one test per fix ----------
test('4a cost validation: NaN, negative, string, undefined, Infinity are all refused and the provider is never called', async () => {
  for (const bad of [NaN, -1, -0.0001, '0', '0.5', undefined, null, Infinity, {}, []]) {
    let called = 0; const p = { name: 'badcost', costPerCall: bad, generate: async () => { called++; return { text: 'x' }; } };
    const r = await guarded(p, input(), { ...noSleep, allowPaid: true, opts: { dailySpend: 10 } });
    assert.equal(called, 0, `cost ${String(bad)} must not reach the provider`); assert.equal(r.fellBackBecause, 'invalid-cost'); assert.equal(r.provider, 'local-rules'); assert.ok(r.text);
  }
  assert.equal(validCost(0), true); assert.equal(validCost(0.01), true); assert.equal(validCost(NaN), false); assert.equal(validCost(-1), false); assert.equal(validCost('1'), false);
});

test('4a-2 a NaN cost cannot slip past the daily spend limit (the old "NaN > limit" is false trap)', async () => {
  let called = 0; const p = { name: 'nan', costPerCall: NaN, generate: async () => { called++; return { text: 'x' }; } };
  const usage = newUsage();
  for (let i = 0; i < 20; i++) await guarded(p, input(), { ...noSleep, usage, allowPaid: true, opts: { dailySpend: 0.01 } });
  assert.equal(called, 0); assert.equal(usage.spend, 0, 'spend never becomes NaN'); assert.ok(Number.isFinite(usage.spend));
});

test('4b failure handling: if the fallback engine ALSO throws, a fixed safe sentence is returned and guarded() never throws', async () => {
  const bad = { name: 'bad', costPerCall: 0, generate: async () => { throw new Error('a'); } };
  const brokenFallback = { name: 'broken-local', costPerCall: 0, generate: async () => { throw new Error('b'); } };
  const usage = newUsage();
  const en = await guarded(bad, input(), { ...noSleep, usage, fallback: brokenFallback, opts: { retries: 0 } });
  assert.equal(en.provider, 'static'); assert.match(en.fellBackBecause, /fallback-failed/); assert.match(en.text, /cannot answer right now/);
  const bn = await guarded(bad, { ...input(), text: 'পাসওয়ার্ড কীভাবে বানাবো?' }, { ...noSleep, fallback: brokenFallback, opts: { retries: 0 } });
  assert.match(bn.text, /দুঃখিত/);
  assert.ok(usage.failures >= 2);
});

test('4b-2 malformed provider objects and malformed results never throw', async () => {
  for (const p of [null, undefined, {}, { name: 'x' }, { name: 'x', costPerCall: 0, generate: 'no' }]) {
    const r = await guarded(p, input(), { ...noSleep }); assert.ok(r.text); assert.equal(r.provider, 'local-rules');
  }
  for (const out of [null, undefined, 'a string', 42, { text: null }, { text: {} }, {}]) {
    const p = { name: 'weird', costPerCall: 0, generate: async () => out };
    const r = await guarded(p, input(), { ...noSleep, opts: { retries: 0 } }); assert.notEqual(r.provider, 'weird', `result ${JSON.stringify(out)} is not accepted`); assert.ok(r.text);
  }
});

test('4b-3 a provider that throws SYNCHRONOUSLY (not a rejected promise) is also handled', async () => {
  const p = { name: 'sync', costPerCall: 0, generate: () => { throw new Error('sync boom'); } };
  const r = await guarded(p, input(), { ...noSleep, opts: { retries: 0 } }); assert.equal(r.provider, 'local-rules'); assert.equal(r.fellBackBecause, 'failed:error');
});

test('4c timeout: the provider is told to abort (AbortSignal) and a late answer is NOT used', async () => {
  let aborted = false; let late;
  const p = { name: 'late', costPerCall: 0, generate: ({ signal }) => new Promise((res) => { signal.addEventListener('abort', () => { aborted = true; }); late = () => res({ text: 'too late' }); setTimeout(() => late(), 120); }) };
  const usage = newUsage();
  const r = await guarded(p, input(), { ...noSleep, usage, opts: { timeoutMs: 30, retries: 0 } });
  assert.equal(aborted, true, 'the abort signal fired'); assert.equal(r.provider, 'local-rules'); assert.equal(usage.timeouts, 1);
  await new Promise((res) => setTimeout(res, 150)); assert.equal(usage.ok, 0, 'the late answer never became a success');
});

test('4c-2 a provider that BLOCKS (ignores the signal) but answers after the limit is still counted as a timeout', async () => {
  const p = { name: 'blocker', costPerCall: 0, generate: async () => { const end = Date.now() + 60; while (Date.now() < end) { /* busy */ } return { text: 'slow answer' }; } };
  const usage = newUsage();
  const r = await guarded(p, input(), { ...noSleep, usage, opts: { timeoutMs: 20, retries: 0 } });
  assert.equal(r.provider, 'local-rules', 'the slow answer is discarded'); assert.equal(usage.timeouts, 1);
});

test('4d retry: a fatal error and an unsafe output stop retrying at once; ordinary errors retry only up to the limit', async () => {
  let n = 0; await guarded({ name: 'f', costPerCall: 0, generate: async () => { n++; throw new ProviderError('fatal'); } }, input(), { ...noSleep, opts: { retries: 5 } }); assert.equal(n, 1);
  n = 0; await guarded({ name: 'u', costPerCall: 0, generate: async () => { n++; return { text: '<script>alert(1)</script>' }; } }, input(), { ...noSleep, opts: { retries: 5 } }); assert.equal(n, 1, 'unsafe output is not retried');
  n = 0; await guarded({ name: 'e', costPerCall: 0, generate: async () => { n++; throw new Error('x'); } }, input(), { ...noSleep, opts: { retries: 3, backoffMs: 1 } }); assert.equal(n, 4);
});

test('4d-2 retry: the total time for one message is bounded (backoff cannot run past totalMs)', async () => {
  const sleeps = []; let n = 0;
  const p = { name: 'e', costPerCall: 0, generate: async () => { n++; throw new Error('x'); } };
  await guarded(p, input(), { sleep: async (ms) => sleeps.push(ms), opts: { retries: 10, backoffMs: 5000, maxBackoffMs: 5000, totalMs: 1000 } });
  assert.equal(n, 1, 'the first wait (5000 ms) would already exceed totalMs=1000, so no retry'); assert.deepEqual(sleeps, []);
});

test('4d-3 retry: backoff is capped by maxBackoffMs', async () => {
  const sleeps = []; const p = { name: 'e', costPerCall: 0, generate: async () => { throw new Error('x'); } };
  await guarded(p, input(), { sleep: async (ms) => sleeps.push(ms), opts: { retries: 4, backoffMs: 100, maxBackoffMs: 250, totalMs: 100000 } });
  assert.deepEqual(sleeps, [100, 200, 250, 250]);
});

test('4d-4 the local fallback engine itself is not retried (deterministic, retrying is pointless)', async () => {
  let n = 0; const flaky = { name: 'local-like', costPerCall: 0, generate: async () => { n++; throw new Error('x'); } };
  const r = await guarded(flaky, input(), { ...noSleep, fallback: flaky, opts: { retries: 5 } });
  assert.equal(n, 1); assert.equal(r.provider, 'static');
});

test('4e output filter: markup, javascript: URLs, handlers and secret-looking strings from a provider are rejected', async () => {
  for (const t of ['<img src=x onerror=alert(1)>', 'click javascript:alert(1)', 'a <iframe src=x></iframe>', 'key ' + 'AIza' + 'SyA1234567890abcdefghijklmnopqrstu', 'token ' + 'ghp' + '_abcdefghijklmnopqrstuvwxyz0123', '-----BEGIN ' + 'PRIVATE KEY-----\nabc', 'my ' + 'sk' + '-abcdefghijklmnopqrstuvwxyz1234']) {
    assert.throws(() => cleanOutput(t, 600), ProviderError, t);
    const p = { name: 'leaky', costPerCall: 0, generate: async () => ({ text: t }) };
    const r = await guarded(p, input(), { ...noSleep, opts: { retries: 0 } }); assert.equal(r.provider, 'local-rules', t); assert.ok(!/<|javascript:|AIza|ghp_|sk-/.test(r.text));
  }
});

test('4e-2 output filter does NOT reject ordinary text, including a harmless "<3" or math, and strips control characters', () => {
  assert.equal(cleanOutput('I <3 stars, and 2 < 3 is true.', 600), 'I <3 stars, and 2 < 3 is true.');
  assert.equal(cleanOutput('hello\u0000 wor\u200bld', 600), 'hello world');
  assert.throws(() => cleanOutput('   ', 600), /no text/);
});

test('4f usage persistence: usage is exported as plain numbers and restored only for the SAME day; shutdown survives a new day', () => {
  const u = newUsage('2026-11-13'); u.calls = 7; u.ok = 5; u.spend = 0.01; u.timeouts = 2; shutdown(u, 'owner stop');
  const saved = JSON.parse(JSON.stringify(exportUsage(u)));
  const same = restoreUsage(saved, '2026-11-13'); assert.equal(same.calls, 7); assert.equal(same.timeouts, 2); assert.equal(same.shutdown, 'owner stop');
  const next = restoreUsage(saved, '2026-11-14'); assert.equal(next.calls, 0, 'a new day starts with fresh counters'); assert.equal(next.spend, 0); assert.equal(next.shutdown, 'owner stop', 'but an emergency stop stays until cleared');
  const hostile = restoreUsage({ day: '2026-11-13', calls: -5, spend: 'x', ok: NaN, shutdown: 42 }, '2026-11-13');
  assert.equal(hostile.calls, 0); assert.equal(hostile.spend, 0); assert.equal(hostile.ok, 0); assert.equal(hostile.shutdown, '');
  assert.deepEqual(restoreUsage(null, 'd'), newUsage('d'));
});

test('4f-2 a restored daily call counter really blocks the provider after a restart (limit survives the process)', async () => {
  let called = 0; const p = { name: 'ext', costPerCall: 0, generate: async () => { called++; return { text: 'ok' }; } };
  const usage = restoreUsage({ day: '2026-11-13', calls: 400 }, '2026-11-13');
  const r = await guarded(p, input(), { usage, ...noSleep }); assert.equal(called, 0); assert.equal(r.fellBackBecause, 'daily-call-limit');
});
