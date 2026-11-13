// AI provider abstraction: timeout, retry/backoff, failure fallback, usage, limits, emergency shutdown, paid-provider refusal.
// Pure unit tests with fake providers. (Not an emulator test, not a live test, no real AI service is called.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guarded, LOCAL, ProviderError, newUsage, shutdown, registerProvider, getProvider, resetProviders, DEFAULTS } from '../js/brain/provider.js';
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
  registerProvider({ name: 'test-only', generate: async () => ({ text: 'a' }) }); assert.ok(getProvider('test-only'));
  resetProviders(); assert.equal(getProvider('test-only'), null); assert.deepEqual([...['local-rules']].filter((n) => getProvider(n)), ['local-rules']);
});
