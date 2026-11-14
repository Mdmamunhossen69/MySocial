// Autonomous social behaviour of the pilot bots: scheduling, daily limits, cooldowns, duplicates, relevance, consent-safe decisions.
// Pure unit tests of js/brain/social.js. (Not an emulator test, not a live test.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldPostNow, composePost, recordPost, decideEngagement, recordEngagement, recordFailure, postId, SOCIAL, HARD_MAX_POSTS_PER_DAY } from '../js/brain/social.js';
import { BRAINS } from '../js/brain/engine.js';
import { TRIVIA } from '../js/brain/knowledge/trivia.js';
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
  b.counters.posts = 1; b.counters.day = dhaka(new Date(NOON)).day;
  assert.equal(shouldPostNow({ botId: 'bot_01', brain: b, now: NOON }).why, 'daily-limit');
  const c = emptyBrain('bot_01'); c.counters.day = dhaka(new Date(NOON)).day; c.counters.posts = 0; c.counters.lastPostAt = NOON - 3600000;
  assert.equal(shouldPostNow({ botId: 'bot_01', brain: c, now: NOON }).why, 'cooldown', 'a second safety net behind the daily limit');
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

test('a post is rejected when it is a near-duplicate of a recent one (fingerprints alone, entry history cleared)', () => {
  const b = emptyBrain('bot_01'); const p = composePost({ bot: bot('bot_01'), brain: b, now: NOON, rand: seeded('a') });
  recordPost(b, p, NOON); b.own.posted = []; b.own.used = [];           // every entry is "fresh" again, only the fingerprint memory remains
  const fp = b.own.recentFp.slice();
  // the same random choices would produce the very same text: the fingerprint guard must refuse it
  for (let k = 0; k < 5; k++) { const again = composePost({ bot: bot('bot_01'), brain: b, now: NOON, rand: seeded('a') }); assert.ok(!again || again.text !== p.text, 'an identical text is never posted again'); }
  assert.deepEqual(b.own.recentFp, fp, 'composePost does not change the brain');
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


// ===================================================== B1.1 item 6: pilot posting limits (one fix = its own tests)
const dayAt = (n) => NOON + n * 86400000;
const mustBePure = (brain, f) => { const before = JSON.stringify(brain); const r = f(); assert.equal(JSON.stringify(brain), before, 'the brain was changed by a read-only function'); return r; };

test('6a the daily post limit is exactly 1 and no option, config or admin limit can raise it', () => {
  assert.equal(SOCIAL.postsPerDay, 1); assert.equal(HARD_MAX_POSTS_PER_DAY, 1);
  for (const id of PILOT_BOT_IDS) for (const opts of [undefined, { postsPerDay: 2 }, { postsPerDay: 99 }, { postsPerDay: Infinity }, { postsPerDay: NaN }]) for (const limit of [undefined, 5, 99, Infinity]) {
    const b = emptyBrain(id); b.counters.day = dhaka(new Date(NOON)).day; b.counters.posts = 1;
    assert.equal(shouldPostNow({ botId: id, brain: b, now: NOON, limit, opts }).why, 'daily-limit', `${id} ${JSON.stringify(opts)} limit=${limit}`);
  }
  const z = emptyBrain('bot_01'); assert.equal(shouldPostNow({ botId: 'bot_01', brain: z, now: NOON, limit: -3 }).why, 'daily-limit', 'a negative admin limit means no posts');
});

test('6b simulation: over 40 days with an hourly runner, each pilot bot posts at most once per Dhaka day and every post is a new entry', () => {
  for (const id of PILOT_BOT_IDS) {
    const b = emptyBrain(id); const perDay = new Map(); const entries = [];
    for (let d = 0; d < 40; d++) for (let h = 0; h < 24; h++) {
      const now = at('2026-11-13T00:00:00Z') + d * 86400000 + h * 3600000; const day = dhaka(new Date(now)).day;
      if (!shouldPostNow({ botId: id, brain: b, now }).ok) continue;
      const p = composePost({ bot: bot(id), brain: b, now, rand: seeded(`${id}${d}${h}`) });
      if (!p) continue;
      recordPost(b, p, now); perDay.set(day, (perDay.get(day) || 0) + 1); entries.push(p.entry);
    }
    assert.ok(Math.max(...perDay.values()) <= 1, `${id}: more than one post in a day`);
    assert.equal(new Set(entries).size, entries.length, `${id}: an entry was posted twice`);
    assert.ok(entries.length >= 10, `${id}: expected the bot to keep posting while fresh content exists (got ${entries.length})`);
  }
});

test('6c the runner re-running inside the same hour or day cannot create a second post (same id, daily limit)', () => {
  const b = emptyBrain('bot_17'); const id1 = postId('bot_17', NOON, b);
  recordPost(b, { text: 'x', entry: 's-moonfacts' }, NOON);
  assert.equal(shouldPostNow({ botId: 'bot_17', brain: b, now: NOON + 60000 }).why, 'daily-limit');
  assert.equal(shouldPostNow({ botId: 'bot_17', brain: b, now: NOON + 8 * 3600000 }).why, 'daily-limit', 'later the same day: still no');
  assert.equal(id1, 'bp_bot_17_20261113_1'); assert.equal(postId('bot_17', NOON, emptyBrain('bot_17')), id1, 'a lost brain gives the same id again: the runner\'s create() returns 409 instead of a duplicate');
});

test('6d strict no-repeat: an entry that was ever posted is never offered again, even after 200 posts of history', () => {
  for (const id of PILOT_BOT_IDS) {
    const pool = id === 'bot_19' ? TRIVIA.map((q) => q.id) : BRAINS[id].kb.filter((e) => e.tip).map((e) => e.id);
    const b = emptyBrain(id); const got = [];
    for (let i = 0; i < pool.length + 5; i++) {
      const p = composePost({ bot: bot(id), brain: b, now: dayAt(i), rand: seeded(`r${id}${i}`) });
      if (!p) break; assert.equal(got.includes(p.entry), false, `${id}: ${p.entry} repeated`); got.push(p.entry); recordPost(b, p, dayAt(i));
    }
    assert.ok(got.length >= pool.length - 1, `${id}: should be able to use (almost) the whole pool before stopping (${got.length}/${pool.length})`);
    assert.equal(composePost({ bot: bot(id), brain: b, now: dayAt(500), rand: seeded('end') }), null, `${id}: with nothing fresh left the bot posts NOTHING instead of repeating`);
    assert.equal(b.own.used.length > 0, true, 'the old "used" list is not wiped (the previous reset-and-repeat behaviour is gone)');
  }
});

test('6e the same text is not posted twice (exact and near-duplicate), across the whole simulated run', () => {
  const b = emptyBrain('bot_01'); const texts = [];
  for (let i = 0; i < 25; i++) { const p = composePost({ bot: bot('bot_01'), brain: b, now: dayAt(i), rand: seeded(`t${i}`) }); if (!p) break; texts.push(p.text); recordPost(b, p, dayAt(i)); }
  assert.equal(new Set(texts).size, texts.length);
  const bodies = texts.map((t) => t.split('\n\n')[0].toLowerCase().replace(/[^a-z ]/g, '').slice(0, 60)); assert.equal(new Set(bodies).size, bodies.length, 'no two posts start with the same sentence');
});

test('6f topic variety: the topic changes from one post to the next while another fresh topic exists', () => {
  // bot_17 has 19 astronomy tips but only 1 photo tip, so a topic change is not always possible there (reported as a content gap)
  for (const id of ['bot_01', 'bot_19']) {
    const b = emptyBrain(id); const topics = [];
    for (let i = 0; i < 12; i++) { const p = composePost({ bot: bot(id), brain: b, now: dayAt(i), rand: seeded(`v${id}${i}`) }); assert.ok(p.topic, 'a post carries its topic'); topics.push(p.topic); recordPost(b, p, dayAt(i)); }
    let same = 0; for (let i = 1; i < topics.length; i++) if (topics[i] === topics[i - 1]) same++;
    assert.equal(same, 0, `${id}: the same topic twice in a row: ${topics.join(',')}`);
  }
});

test('6g the moon post (Sky Watcher) is made at most once per 7 days', () => {
  const b = emptyBrain('bot_17'); const moonDays = [];
  for (let i = 0; i < 60; i++) {
    const now = dayAt(i); const p = composePost({ bot: bot('bot_17'), brain: b, now, rand: () => 0.0001 });   // 0.0001 < 0.35: the moon is always "wanted"
    if (!p) continue; if (p.kind === 'moon') moonDays.push(i); recordPost(b, p, now);
  }
  assert.ok(moonDays.length >= 2, 'the moon post does happen');
  for (let i = 1; i < moonDays.length; i++) assert.ok(moonDays[i] - moonDays[i - 1] >= 7, `moon posts ${moonDays[i - 1]} and ${moonDays[i]} are closer than 7 days`);
});

test('6h composePost and shouldPostNow are pure: they never modify the brain (the old "reset used list" side effect is gone)', () => {
  const b = emptyBrain('bot_01'); b.own.used = ['t-2fa']; b.own.posted = BRAINS.bot_01.kb.filter((e) => e.tip).map((e) => e.id);   // nothing fresh left
  assert.equal(mustBePure(b, () => composePost({ bot: bot('bot_01'), brain: b, now: NOON, rand: seeded('p') })), null);
  mustBePure(b, () => shouldPostNow({ botId: 'bot_01', brain: emptyBrain('bot_01'), now: NOON })); // fresh brain gets its day rolled; checked below
  const c = emptyBrain('bot_17'); mustBePure(c, () => composePost({ bot: bot('bot_17'), brain: c, now: NOON, rand: seeded('p2') }));
});

test('6i posted history is persisted: it survives sanitizeBrain and is bounded; only controlled ids are kept', async () => {
  const { sanitizeBrain, LIMITS } = await import('../js/brain/memory.js');
  const b = emptyBrain('bot_01'); for (let i = 0; i < 260; i++) b.own.posted.push(`e-${i}`);
  b.own.posted.push('free text with spaces', 'x'.repeat(40));
  const clean = sanitizeBrain(b, 'bot_01'); assert.equal(clean.own.posted.length, LIMITS.posted); assert.equal(clean.own.posted.includes('free text with spaces'), false); assert.equal(clean.own.posted.at(-1), 'e-259');
  const p = composePost({ bot: bot('bot_01'), brain: emptyBrain('bot_01'), now: NOON, rand: seeded('z') }); const c = emptyBrain('bot_01'); recordPost(c, p, NOON);
  assert.deepEqual(sanitizeBrain(JSON.parse(JSON.stringify(c)), 'bot_01').own.posted, [p.entry]);
});

test('6j comments do not break the post rules: commenting uses entries but never marks them as "posted", and a post is not blocked by a comment', () => {
  const b = emptyBrain('bot_01'); const d = decideEngagement({ bot: bot('bot_01'), brain: b, post: post(), now: NOON, rand: seeded('x') }); recordEngagement(b, 'p1', d, NOON);
  assert.equal(b.own.posted.length, 0); assert.ok(b.own.used.includes('t-battery'));
});
