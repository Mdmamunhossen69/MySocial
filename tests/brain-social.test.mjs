// Autonomous social behaviour of the pilot bots: scheduling, daily limits, cooldowns, duplicates, relevance, consent-safe decisions.
// Pure unit tests of js/brain/social.js. (Not an emulator test, not a live test.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldPostNow, composePost, recordPost, decideEngagement, recordEngagement, recordFailure, postId, SOCIAL } from '../js/brain/social.js';
import { emptyBrain } from '../js/brain/memory.js';
import { PILOT_BOT_IDS } from '../js/brain/vocab.js';
import { seeded, dhaka } from '../js/brain/util.js';

const at = (iso) => Date.parse(iso);                       // helper
const NOON = at('2026-11-13T06:00:00Z');                    // 12:00 Asia/Dhaka
const bot = (id) => ({ id, name: id });
const post = (over = {}) => ({ id: 'p1', uid: 'authorAAAA01', text: 'My phone battery drains so fast, any tips for my android phone?', createdAt: NOON - 60000, ...over });

test('Asia/Dhaka calendar: the day and hour follow Dhaka, not UTC', () => {
  assert.deepEqual(dhaka(new Date('2026-11-12T18:30:00Z')), { day: '2026-11-13', hour: 0 });
  assert.deepEqual(dhaka(new Date('2026-11-13T17:59:00Z')), { day: '2026-11-13', hour: 23 });
});

test('posting is allowed only in the active Dhaka hours, within the daily limit and after the cooldown', () => {
  const b = emptyBrain('bot_01');
  assert.equal(shouldPostNow({ botId: 'bot_01', brain: b, now: at('2026-11-12T20:00:00Z') }).why, 'outside-active-hours'); // 02:00 Dhaka
  assert.equal(shouldPostNow({ botId: 'bot_01', brain: b, now: at('2026-11-13T17:00:00Z') }).why, 'outside-active-hours'); // 23:00 Dhaka
  b.counters.posts = 2; b.counters.day = dhaka(new Date(NOON)).day;
  assert.equal(shouldPostNow({ botId: 'bot_01', brain: b, now: NOON }).why, 'daily-limit');
  const c = emptyBrain('bot_01'); c.counters.day = dhaka(new Date(NOON)).day; c.counters.posts = 1; c.counters.lastPostAt = NOON - 3600000;
  assert.equal(shouldPostNow({ botId: 'bot_01', brain: c, now: NOON }).why, 'cooldown');
  const d = emptyBrain('bot_01'); assert.equal(shouldPostNow({ botId: 'bot_01', brain: d, now: NOON, limit: 0 }).why, 'daily-limit', 'the admin dailyLimit of the bot also applies');
});

test('scheduling is deterministic inside an hour and spreads posts over the day', () => {
  const b = emptyBrain('bot_17');
  const a1 = shouldPostNow({ botId: 'bot_17', brain: b, now: NOON }), a2 = shouldPostNow({ botId: 'bot_17', brain: b, now: NOON + 20 * 60000 });
  assert.deepEqual(a1, a2, 'a second run in the same hour decides the same way');
  let hours = 0; for (let h = 8; h < 22; h++) { const x = emptyBrain('bot_17'); if (shouldPostNow({ botId: 'bot_17', brain: x, now: at('2026-11-13T00:00:00Z') + (h - 6) * 3600000 }).ok) hours++; }
  assert.ok(hours >= 1 && hours <= 8, `a bot should not post in every active hour (got ${hours})`);
  const late = emptyBrain('bot_17'); late.counters.day = dhaka(new Date(at('2026-11-13T15:00:00Z'))).day;
  assert.equal(shouldPostNow({ botId: 'bot_17', brain: late, now: at('2026-11-13T15:00:00Z') }).ok, true, 'at the last active hour a bot with unused slots posts');
});

test('post ids are deterministic per bot and slot (a re-run cannot create a second post for the same slot)', () => {
  const b = emptyBrain('bot_01');
  assert.equal(postId('bot_01', NOON, b), 'bp_bot_01_20261113_1');
  recordPost(b, { text: 'x', entry: 't-2fa' }, NOON); assert.equal(postId('bot_01', NOON, b), 'bp_bot_01_20261113_2');
});

test('each bot posts in its own style, bilingual, short, labelled with a real entry, never a near-copy', () => {
  for (const id of PILOT_BOT_IDS) {
    const b = emptyBrain(id); const seen = new Set(); const fps = [];
    for (let i = 0; i < 12; i++) {
      const p = composePost({ bot: bot(id), brain: b, now: NOON + i * 86400000, rand: seeded(`${id}${i}`) });
      assert.ok(p, `${id} #${i}`); assert.ok(p.text.length <= SOCIAL.maxPostChars);
      assert.match(p.text, /[ঀ-৿]/, 'has a Bengali part'); assert.match(p.text, /[A-Za-z]/, 'has an English part');
      assert.equal(seen.has(p.entry), false, `${id}: entry ${p.entry} repeated too early`); seen.add(p.entry);
      recordPost(b, p, NOON + i * 86400000);
    }
  }
  const t = composePost({ bot: bot('bot_19'), brain: emptyBrain('bot_19'), now: NOON, rand: seeded('q') });
  assert.match(t.text, /quiz|কুইজ/i); assert.doesNotMatch(t.text, /Think you know it|No peeking|Answer in the comments/);
  assert.equal(composePost({ bot: bot('bot_02'), brain: emptyBrain('bot_02'), now: NOON }), null, 'a non-pilot bot gets no smart post');
});

test('a post is rejected when it is a near-duplicate of a recent one', () => {
  const b = emptyBrain('bot_01'); const p = composePost({ bot: bot('bot_01'), brain: b, now: NOON, rand: seeded('a') });
  recordPost(b, p, NOON); b.own.used = [];                // the entry list is "fresh" again, only the fingerprint memory remains
  const again = composePost({ bot: bot('bot_01'), brain: b, now: NOON, rand: () => 0.0001 });
  assert.ok(!again || again.text !== p.text, 'the same text is not posted twice in a row');
});

test('comments: only with something relevant and true to add; reactions only on relevant posts', () => {
  const b = emptyBrain('bot_01');
  const d = decideEngagement({ bot: bot('bot_01'), brain: b, post: post(), now: NOON, rand: seeded('x') });
  assert.ok(d.comment && d.comment.entry === 't-battery'); assert.equal(d.reaction, 'like'); assert.ok(d.comment.text.length <= SOCIAL.maxCommentChars);
  assert.equal(decideEngagement({ bot: bot('bot_01'), brain: b, post: post({ text: 'Had biryani for lunch today' }), now: NOON }).why, 'not-relevant');
  assert.equal(decideEngagement({ bot: bot('bot_17'), brain: emptyBrain('bot_17'), post: post(), now: NOON }).comment, null, 'the sky bot has nothing to add about phone batteries');
  // Bengali post -> Bengali comment
  const bn = decideEngagement({ bot: bot('bot_01'), brain: emptyBrain('bot_01'), post: post({ text: 'পাসওয়ার্ড কিভাবে নিরাপদ রাখব?' }), now: NOON, rand: seeded('y') });
  assert.equal(bn.comment.lang, 'bn'); assert.match(bn.comment.text, /[ঀ-৿]/);
});

test('no spam: once per post, daily limit, cooldown, age, bots, sensitive posts, failures', () => {
  const b = emptyBrain('bot_01'); const base = { bot: bot('bot_01'), now: NOON, rand: seeded('z') };
  const first = decideEngagement({ ...base, brain: b, post: post() }); recordEngagement(b, 'p1', first, NOON);
  assert.equal(decideEngagement({ ...base, brain: b, post: post() }).why, 'already-engaged');
  const second = decideEngagement({ ...base, brain: b, post: post({ id: 'p2', text: 'Is two-factor authentication worth it for my accounts?' }) });
  assert.ok(!second.comment, 'cooldown between two comments'); assert.equal(second.reaction, 'like');
  const later = decideEngagement({ ...base, now: NOON + 20 * 60000, brain: b, post: post({ id: 'p3', createdAt: NOON + 19 * 60000, text: 'Is two-factor authentication worth it for my accounts?' }) });
  assert.ok(later.comment, 'after the cooldown a comment is allowed again');
  const lim = emptyBrain('bot_01'); lim.counters.day = dhaka(new Date(NOON)).day; lim.counters.comments = SOCIAL.commentsPerDay;
  assert.equal(decideEngagement({ ...base, brain: lim, post: post({ id: 'p9' }) }).comment, null, 'daily comment limit');
  assert.equal(decideEngagement({ ...base, brain: emptyBrain('bot_01'), post: post({ id: 'p8', createdAt: NOON - 49 * 3600000 }) }).why, 'too-old');
  assert.equal(decideEngagement({ ...base, brain: emptyBrain('bot_01'), post: post({ id: 'p7', uid: 'bot_05' }) }).why, 'bot-to-bot-off');
  assert.equal(decideEngagement({ ...base, brain: emptyBrain('bot_01'), post: post({ id: 'p6', text: 'my phone battery is dying and I feel hopeless and want to give up' }) }).why, 'sensitive');
  const f = emptyBrain('bot_01'); for (let i = 0; i < SOCIAL.maxFailuresPerDay; i++) recordFailure(f, NOON);
  assert.equal(decideEngagement({ ...base, brain: f, post: post({ id: 'p5' }) }).why, 'paused-after-failures');
  assert.equal(shouldPostNow({ botId: 'bot_01', brain: f, now: NOON }).why, 'paused-after-failures');
});

test('a new Dhaka day resets the daily counters (and the failure pause)', () => {
  const f = emptyBrain('bot_01'); for (let i = 0; i < 6; i++) recordFailure(f, NOON);
  const next = decideEngagement({ bot: bot('bot_01'), brain: f, post: post({ createdAt: NOON + 86400000 - 1000 }), now: NOON + 86400000, rand: seeded('n') });
  assert.notEqual(next.why, 'paused-after-failures'); assert.equal(f.counters.failures, 0);
});
