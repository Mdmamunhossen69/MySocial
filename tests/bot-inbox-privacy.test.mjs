// Bot chat inbox: privacy, failure handling, duplicates, retention and the kill switch.
// WHAT THIS IS: the real scripts/bot-runner.mjs run against an in-memory Firestore imitation that judges every
// request with the real firestore.rules text through OUR rules interpreter (tests/mock-rules.mjs).
// WHAT THIS IS NOT: a Firestore Emulator test or a live-Firebase test. The emulator runs the rules matrix in CI
// (tests/emulator/run.mjs); nothing here touches a real Firebase project.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { startMock } from './mock-firestore.mjs';
import { BOTS } from '../js/bots-data.js';

const exec = (args, env) => new Promise((resolve) => {
  const c = spawn('node', args, { env: { ...process.env, ...env } });
  let stdout = '', stderr = '';
  c.stdout.on('data', (d) => { stdout += d; }); c.stderr.on('data', (d) => { stderr += d; });
  c.on('close', (status) => resolve({ status, stdout, stderr }));
});
const CANARY = 'CANARY-PRIVATE-7731-zebra';
const now = new Date();
const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000);

const seed = (extra = {}) => {
  const s = {};
  BOTS.forEach((b) => { s[`users/${b.id}`] = { name: b.name, isBot: true, banned: false }; });
  return {
    ...s,
    'botRunners/runner1': { enabled: true },
    'users/runner1': { name: 'Runner account', banned: false },
    'settings/global': { botsEnabled: true, botToBotComments: false },
    'users/u2': { name: 'Sam', banned: false },
    'users/u3': { name: 'Tina', banned: false },
    'chats/bot_06_u2': { type: 'private', members: ['bot_06', 'u2'] },
    'chats/bot_06_u3': { type: 'private', members: ['bot_06', 'u3'] },
    'chats/bot_06_u2/messages/m1': { uid: 'u2', text: `hello ${CANARY}`, createdAt: now },
    'botInbox/i1': { botId: 'bot_06', fromUid: 'u2', chatId: 'bot_06_u2', messageId: 'm1', handled: false, createdAt: now },
    ...extra
  };
};
const env = (m, more = {}) => ({ BOT_RUNNER_EMAIL: 'r@x.com', BOT_RUNNER_PASSWORD: 'secret', AUTH_URL: m.url, FS_URL: m.url, BOT_POSTS: '0', BOT_COMMENTS: '0', ...more });
const runner = (m, more) => exec(['scripts/bot-runner.mjs'], env(m, more));
const replies = (m, chat = 'bot_06_u2') => m.ids(`chats/${chat}/messages`).filter((id) => id !== 'm1');
// every stored document except the chat messages themselves (a chat is allowed to hold its own messages)
const leaks = (m) => [...m.docs.entries()].filter(([p, d]) => !/\/messages\//.test(p) && JSON.stringify(d.fields).includes(CANARY)).map(([p]) => p);

test('pointer row: the bot answers, the row is deleted, and the private text is nowhere else', async () => {
  const m = await startMock({ seed: seed(), rules: true });
  try {
    const r = await runner(m);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.deepEqual(replies(m), ['r_i1'], 'exactly one reply, with the deterministic id');
    const rep = m.get('chats/bot_06_u2/messages/r_i1');
    assert.equal(rep.uid, 'bot_06'); assert.equal(rep.ai, true);
    assert.equal(m.get('botInbox/i1'), null, 'the answered row is deleted');
    assert.deepEqual(leaks(m), [], 'the private text is in no log, state, inbox or memory document');
    assert.equal(r.stdout.includes(CANARY) || r.stderr.includes(CANARY), false, 'nor in the job output');
    for (const id of m.ids('botLogs')) assert.match(m.get(`botLogs/${id}`).text, /^chat:[a-z-]+$/, 'logs hold an intent code only');
    assert.deepEqual(m.denied, [], 'the rules never denied the runner');
  } finally { await m.close(); }
});

test('old row that still carries the text: answered, text blanked, row deleted, no leak', async () => {
  const m = await startMock({ seed: seed({ 'botInbox/i1': { botId: 'bot_06', fromUid: 'u2', chatId: 'bot_06_u2', text: `old ${CANARY}`, handled: false, createdAt: now } }), rules: true });
  try {
    const r = await runner(m);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(replies(m).length, 1);
    assert.equal(m.get('botInbox/i1'), null);
    assert.deepEqual(leaks(m), []);
    assert.deepEqual(m.denied, []);
  } finally { await m.close(); }
});

test('a failed reply deletes nothing: the row stays pending, the next run answers once', async () => {
  const m = await startMock({ seed: seed(), rules: true, faults: { createFail: 1 } });
  try {
    const r1 = await runner(m);
    assert.equal(r1.status, 0, r1.stderr + r1.stdout);
    const row = m.get('botInbox/i1');
    assert.ok(row, 'the row is kept'); assert.equal(row.handled, false); assert.equal(row.attempts, 1); assert.equal(row.lastError, 'http-500');
    assert.equal(replies(m).length, 0); assert.ok(m.get('chats/bot_06_u2/messages/m1'), 'the user message is untouched');
    assert.deepEqual(leaks(m), [], 'a failure record holds a code, not text');
    const r2 = await runner(m);
    assert.equal(r2.status, 0, r2.stderr + r2.stdout);
    assert.deepEqual(replies(m), ['r_i1']); assert.equal(m.get('botInbox/i1'), null);
    assert.deepEqual(m.denied, []);
  } finally { await m.close(); }
});

test('after 5 failed attempts the row is closed as gave-up (kept, not deleted)', async () => {
  const m = await startMock({ seed: seed(), rules: true, faults: { createFail: 99 } });
  try {
    for (let i = 0; i < 5; i++) assert.equal((await runner(m)).status, 0);
    const row = m.get('botInbox/i1');
    assert.ok(row); assert.equal(row.handled, true); assert.equal(row.skipped, 'gave-up'); assert.equal(row.attempts, 5);
    assert.equal(replies(m).length, 0);
    const before = m.ids('chats/bot_06_u2/messages').length;
    await runner(m); assert.equal(m.ids('chats/bot_06_u2/messages').length, before, 'no sixth attempt');
  } finally { await m.close(); }
});

test('a row that was already answered (overlapping runs) is closed without a second reply', async () => {
  const m = await startMock({ seed: seed({ 'chats/bot_06_u2/messages/r_i1': { uid: 'bot_06', text: 'already', ai: true, createdAt: now } }), rules: true });
  try {
    const r = await runner(m);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.deepEqual(replies(m), ['r_i1']); assert.equal(m.get('chats/bot_06_u2/messages/r_i1').text, 'already', 'the first reply is not overwritten');
    assert.equal(m.get('botInbox/i1'), null);
  } finally { await m.close(); }
});

test('wrong or hostile rows touch nothing: bad chat, foreign pointer, vanished message, not a bot', async () => {
  const unrelated = {
    'users/u2': { name: 'Sam', banned: false }, 'users/u3': { name: 'Tina', banned: false },
    'chats/bot_06_u3/messages/m9': { uid: 'u3', text: 'tina private', createdAt: now }
  };
  const m = await startMock({ seed: seed({
    ...unrelated,
    'botInbox/i1': { botId: 'bot_06', fromUid: 'u2', chatId: 'bot_06_u3', messageId: 'm9', handled: false, createdAt: now },   // u2's row aimed at Tina's chat
    'botInbox/i2': { botId: 'bot_06', fromUid: 'u2', chatId: 'bot_06_u2', messageId: 'm_tina', handled: false, createdAt: now }, // points at a message that is not u2's
    'chats/bot_06_u2/messages/m_tina': { uid: 'u3', text: 'not yours', createdAt: now },
    'botInbox/i3': { botId: 'bot_06', fromUid: 'u2', chatId: 'bot_06_u2', messageId: 'gone', handled: false, createdAt: now },   // message deleted
    'botInbox/i4': { botId: 'u3', fromUid: 'u2', chatId: 'u2_u3', messageId: 'm1', handled: false, createdAt: now },             // botId is a person
    'botInbox/i5': { botId: 'bot_06', fromUid: 'u3', chatId: 'bot_06_u3', messageId: 'm9', handled: false, createdAt: now }       // a valid row of another user
  }), rules: true });
  try {
    const r = await runner(m);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const skipped = (id) => m.get(`botInbox/${id}`);
    assert.equal(skipped('i1').skipped, 'bad-row'); assert.equal(skipped('i2').skipped, 'bad-pointer'); assert.equal(skipped('i3').skipped, 'message-gone');
    assert.ok(skipped('i4') && skipped('i4').handled === true, 'a row naming a person as the bot is closed, not answered');
    for (const id of ['i1', 'i2', 'i3', 'i4']) assert.ok(skipped(id), `row ${id} is kept (never deleted by a skip)`);
    assert.equal(replies(m, 'bot_06_u2').filter((x) => x !== 'm_tina').length, 0, 'nothing was sent into the chat of the hostile rows');
    assert.deepEqual(replies(m, 'bot_06_u3').filter((x) => x !== 'm9'), ['r_i5'], 'the valid row of the other user was still answered once');
    assert.equal(skipped('i5'), null);
    assert.deepEqual(m.ids('chats/u2_u3/messages'), []);
    assert.deepEqual(m.denied, []);
  } finally { await m.close(); }
});

test('retention: rows older than 7 days are removed once a day, after safety checks', async () => {
  const m = await startMock({ seed: seed({
    'botInbox/i1': { botId: 'bot_06', fromUid: 'u2', chatId: 'no_such_chat', messageId: 'x', handled: false, createdAt: now },   // young: kept
    'botInbox/old1': { botId: 'bot_06', fromUid: 'u2', chatId: 'bot_06_u2', text: `ancient ${CANARY}`, handled: false, createdAt: daysAgo(8) },
    'botInbox/odd': { botId: 'not_a_bot', fromUid: 'u2', chatId: 'x', handled: false, createdAt: daysAgo(9) },                      // old but fails the safety check
    'botInbox/left': { botId: 'bot_06', fromUid: 'u2', chatId: 'bot_06_u2', messageId: 'm1', handled: true, answered: true, createdAt: now } // answered leftover
  }), rules: true });
  try {
    const r = await runner(m);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(m.get('botInbox/old1'), null, 'old row removed'); assert.equal(m.get('botInbox/left'), null, 'answered leftover removed');
    assert.ok(m.get('botInbox/i1'), 'a young row is kept'); assert.ok(m.get('botInbox/odd'), 'a row that fails the safety check is not deleted');
    assert.deepEqual(leaks(m), []);
    assert.match(r.stdout, /Inbox clean-up: 2 row\(s\) removed/);
    // same Pacific day: no second clean-up
    m.put('botInbox/old2', { botId: 'bot_06', fromUid: 'u2', chatId: 'no_such_chat', messageId: 'x', handled: false, createdAt: daysAgo(10) });
    const r2 = await runner(m);
    assert.equal(r2.status, 0, r2.stderr + r2.stdout);
    assert.ok(m.get('botInbox/old2'), 'maintenance runs once per day');
    assert.deepEqual(m.denied, []);
  } finally { await m.close(); }
});

test('kill switch is enforced by the RULES: no settings doc / false / not-true / runner that is also staff = no writes', async () => {
  const DOCS = '/v1/projects/test-proj/databases/(default)/documents';
  const probe = async (m) => {
    const si = await (await fetch(`${m.url}/v1/accounts:signInWithPassword`, { method: 'POST', body: JSON.stringify({ password: 'secret' }), headers: { 'Content-Type': 'application/json' } })).json();
    const call = async (method, path, body) => (await fetch(`${m.url}${DOCS}/${path}${method === 'PATCH' ? '?updateMask.fieldPaths=handled' : ''}`, { method, headers: { Authorization: `Bearer ${si.idToken}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).status;
    return {
      mark: () => call('PATCH', 'botInbox/i1', { fields: { handled: { booleanValue: true } } }),
      state: () => call('PATCH', 'botState/runner', { fields: { daily: { stringValue: '{}' } } }),
      read: () => call('GET', 'botInbox/i1')
    };
  };
  const cases = [
    ['no settings document', (s) => { delete s['settings/global']; return s; }, true],
    ['botsEnabled false', (s) => { s['settings/global'] = { botsEnabled: false }; return s; }, true],
    ['botsEnabled missing', (s) => { s['settings/global'] = { maintenance: false }; return s; }, true],
    ['botsEnabled is the string "true"', (s) => { s['settings/global'] = { botsEnabled: 'true' }; return s; }, true],
    ['bots on but the runner uid is also an admin', (s) => { s['admins/runner1'] = { role: 'admin' }; return s; }, true],
    ['bots on, runner is only a runner (control)', (s) => s, false]
  ];
  for (const [name, mod, denied] of cases) {
    const m = await startMock({ seed: mod(seed()), rules: true });
    try {
      const p = await probe(m);
      assert.equal(await p.mark() === 403, denied, `${name}: marking an inbox row`);
      assert.equal(await p.state() === 403, denied, `${name}: writing runner state`);
      assert.equal(await p.read(), 200, `${name}: the runner may still READ its inbox (reads are not the kill switch)`);
    } finally { await m.close(); }
  }
});

test('script exits at once and writes nothing while bots are OFF by default (no settings doc)', async () => {
  const s = seed(); delete s['settings/global'];
  const m = await startMock({ seed: s, rules: true });
  try {
    const before = JSON.stringify([...m.docs.entries()]);
    const r = await runner(m, { BOT_POSTS: '3', BOT_COMMENTS: '3' });
    assert.equal(r.status, 0, r.stderr + r.stdout); assert.match(r.stdout, /settings\/global does not exist/);
    assert.equal(JSON.stringify([...m.docs.entries()]), before, 'not one document changed');
    assert.equal(m.ids('botInbox').length, 1);
  } finally { await m.close(); }
});
