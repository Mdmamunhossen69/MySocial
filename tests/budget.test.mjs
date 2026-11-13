// Daily read budget of the bot runner. Units + the real runner against the in-memory Firestore imitation.
// NOT an emulator or live-Firebase test. The budget only counts reads made BY THE RUNNER (see scripts/lib/budget.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { startMock } from './mock-firestore.mjs';
import { Budget, BudgetStop, DEFAULTS, meter, pacificDay, isQuotaError } from '../scripts/lib/budget.mjs';
import { BOTS } from '../js/bots-data.js';

test('pacificDay follows Pacific midnight, with winter and summer time', () => {
  assert.equal(pacificDay(new Date('2026-11-12T07:59:00Z')), '2026-11-11'); // 23:59 PST
  assert.equal(pacificDay(new Date('2026-11-12T08:00:00Z')), '2026-11-12'); // 00:00 PST
  assert.equal(pacificDay(new Date('2026-07-01T06:59:00Z')), '2026-06-30'); // 23:59 PDT
  assert.equal(pacificDay(new Date('2026-07-01T07:00:00Z')), '2026-07-01'); // 00:00 PDT
});

test('limits: default 6000 (temporary), soft 70%, per-run cap, never above the free quota', () => {
  assert.equal(DEFAULTS.daily, 6000);
  const b = new Budget({}); b.load(null);
  assert.equal(b.daily, 6000); assert.equal(b.soft, 4200); assert.equal(b.perRun, 500);
  assert.equal(new Budget({ daily: 999999 }).daily, 45000, 'clamped below the 50,000 free quota');
  assert.equal(new Budget({ daily: 'abc' }).daily, 6000); assert.equal(new Budget({ daily: -5 }).daily, 6000);
  const c = new Budget({ daily: 100, perRun: 10 }); c.load(null);
  c.beforeRead(10); c.addRead(10);
  assert.throws(() => c.beforeRead(1), BudgetStop, 'per-run cap');
  const d = new Budget({ daily: 100 }); d.load({ day: pacificDay(), reads: 95 });
  assert.equal(d.softReached, true); assert.throws(() => d.beforeRead(6), BudgetStop, 'daily cap'); d.beforeRead(5);
});

test('a stored counter from an earlier day is ignored; the same day continues', () => {
  const b = new Budget({ daily: 100 }); b.load({ day: '2001-01-01', reads: 99 });
  assert.equal(b.usedToday, 0); assert.equal(b.fresh, true);
  const c = new Budget({ daily: 100 }); c.load({ day: pacificDay(), reads: 40 });
  assert.equal(c.usedToday, 40); assert.equal(c.fresh, false);
  const e = new Budget({ daily: 100 }); e.load({ day: pacificDay(), reads: 'junk' }); assert.equal(e.usedToday, 0, 'a corrupt counter counts as 0 but never crashes');
});

test('save: fresh day sets, same day increments atomically; only numbers and the day are stored', async () => {
  const calls = [];
  const fs = { set: async (p, d) => calls.push(['set', p, d]), increment: async (p, f, n) => calls.push(['inc', p, f, n]), patch: async (p, d) => calls.push(['patch', p, d]) };
  const a = new Budget({}); a.load(null); a.addRead(7); a.addWrite(2); await a.save(fs, { maintenanceDone: true });
  assert.equal(calls[0][0], 'set'); assert.deepEqual(Object.keys(calls[0][2]).sort(), ['day', 'maintDay', 'reads', 'updatedAt', 'writes']);
  calls.length = 0;
  const b = new Budget({}); b.load({ day: pacificDay(), reads: 10, writes: 1 }); b.addRead(5); await b.save(fs);
  assert.deepEqual(calls, [['inc', 'botState/budget', 'reads', 5]]);
  calls.length = 0; await b.save(fs); assert.deepEqual(calls, [], 'nothing to save = no write');
});

test('meter counts reads (an empty query still costs 1), blocks over-budget reads, forbids listAll', async () => {
  const fs = { get: async () => ({}), query: async (q) => (q.empty ? [] : [{}, {}, {}]), listAll: async () => [], create: async () => ({}) };
  const b = new Budget({ daily: 10, perRun: 10 }); b.load(null);
  const m = meter(fs, b);
  await m.get('a'); await m.query({ empty: true, limit: 5 }); await m.query({ limit: 5 });
  assert.equal(b.runReads, 1 + 1 + 3);
  await assert.rejects(m.query({ limit: 25 }), BudgetStop, 'a query that could exceed the budget is not even sent');
  await assert.rejects(m.listAll(), /not allowed/);
  await m.create('x', {}); assert.equal(b.runWrites, 1);
});

test('quota errors are recognised', () => {
  assert.equal(isQuotaError(new Error('POST http://x -> 429 {"error"}')), true);
  assert.equal(isQuotaError(new Error('RESOURCE_EXHAUSTED')), true);
  assert.equal(isQuotaError(new Error('POST x -> 500 boom')), false);
});

// ---- the real runner
const exec = (args, env) => new Promise((resolve) => {
  const c = spawn('node', args, { env: { ...process.env, ...env } });
  let stdout = '', stderr = '';
  c.stdout.on('data', (d) => { stdout += d; }); c.stderr.on('data', (d) => { stderr += d; });
  c.on('close', (status) => resolve({ status, stdout, stderr }));
});
const now = new Date();
const seed = (extra = {}) => {
  const s = {};
  BOTS.forEach((b) => { s[`users/${b.id}`] = { name: b.name, isBot: true, banned: false }; });
  return { ...s, 'botRunners/runner1': { enabled: true }, 'users/runner1': { name: 'R', banned: false }, 'settings/global': { botsEnabled: true },
    'users/u2': { name: 'Sam', banned: false }, 'chats/bot_06_u2': { type: 'private', members: ['bot_06', 'u2'] },
    'chats/bot_06_u2/messages/m1': { uid: 'u2', text: 'hello', createdAt: now },
    'botInbox/i1': { botId: 'bot_06', fromUid: 'u2', chatId: 'bot_06_u2', messageId: 'm1', handled: false, createdAt: now }, ...extra };
};
const run = (m, more = {}) => exec(['scripts/bot-runner.mjs'], { BOT_RUNNER_EMAIL: 'r@x.com', BOT_RUNNER_PASSWORD: 'secret', AUTH_URL: m.url, FS_URL: m.url, BOT_POSTS: '2', BOT_COMMENTS: '3', ...more });
const newPosts = (m) => m.ids('posts').length;

test('runner: below the soft limit posts happen; at the soft limit only chat replies go on', async () => {
  const m = await startMock({ seed: seed({ 'botState/budget': { day: pacificDay(), reads: 290, writes: 0, maintDay: pacificDay() } }), rules: true });
  try {
    const r = await run(m, { BOT_DAILY_READS: '400' });
    assert.equal(r.status, 0, r.stderr + r.stdout); assert.match(r.stdout, /Soft read limit reached/);
    assert.equal(newPosts(m), 0, 'no new posts'); assert.deepEqual(m.ids('chats/bot_06_u2/messages').filter((x) => x !== 'm1'), ['r_i1'], 'the chat reply still went out');
    assert.ok(m.get('botState/budget').reads > 290, 'the counter grew');
    assert.ok(Object.keys(m.get('botState/budget')).every((k) => ['day', 'maintDay', 'reads', 'updatedAt', 'writes'].includes(k)), 'only numbers and the day are stored');
    assert.deepEqual(m.denied, []);
  } finally { await m.close(); }
  const m2 = await startMock({ seed: seed(), rules: true });
  try { const r = await run(m2, { BOT_DAILY_READS: '6000' }); assert.equal(r.status, 0, r.stderr + r.stdout); assert.ok(newPosts(m2) > 0, 'under the limit the normal work happens'); } finally { await m2.close(); }
});

test('runner: at the hard limit it stops completely, exits 0 and leaves messages pending', async () => {
  const m = await startMock({ seed: seed({ 'botState/budget': { day: pacificDay(), reads: 100, writes: 0, maintDay: '' } }), rules: true });
  try {
    const r = await run(m, { BOT_DAILY_READS: '100' });
    assert.equal(r.status, 0, r.stderr + r.stdout); assert.match(r.stdout, /Daily read budget reached/);
    assert.equal(newPosts(m), 0); assert.equal(m.ids('chats/bot_06_u2/messages').length, 1); assert.equal(m.get('botInbox/i1').handled, false);
  } finally { await m.close(); }
});

test('runner: a new Pacific day resets the counter', async () => {
  const m = await startMock({ seed: seed({ 'botState/budget': { day: '2001-01-01', reads: 100000, writes: 0, maintDay: '' } }), rules: true });
  try {
    const r = await run(m, { BOT_DAILY_READS: '6000' });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const b = m.get('botState/budget'); assert.equal(b.day, pacificDay()); assert.ok(b.reads > 0 && b.reads < 500);
  } finally { await m.close(); }
});

test('runner: the per-run cap stops one run early; the message stays pending', async () => {
  const m = await startMock({ seed: seed(), rules: true });
  try {
    const r = await run(m, { BOT_RUN_READS: '3' });
    assert.equal(r.status, 0, r.stderr + r.stdout); assert.match(r.stdout, /per-run cap/);
    assert.equal(m.get('botInbox/i1').handled, false);
  } finally { await m.close(); }
});

test('runner: a 429 from Firestore stops cleanly and is not retried', async () => {
  const m = await startMock({ seed: seed(), rules: true, faults: { quota: true } });
  try {
    const r = await run(m);
    assert.equal(r.status, 0, r.stderr + r.stdout); assert.match(r.stdout, /429|quota/i);
    assert.equal(m.calls.filter((c) => c.endsWith(':runQuery')).length, 1, 'exactly one query attempt, no retry loop');
    assert.equal(newPosts(m), 0);
  } finally { await m.close(); }
});
