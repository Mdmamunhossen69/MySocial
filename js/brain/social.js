// Autonomous social behaviour of the pilot bots: WHEN to post, WHAT to post, and whether to comment or react.
// Pure functions: they receive ONE bot's own brain and return a decision; the runner performs it and records it.
// Rules built in (see tests/brain-social.test.mjs):
//  * daily limits and cooldowns per bot, Asia/Dhaka days, an active-hours window
//  * a comment is written only when the bot has something TRUE and relevant to add (a confident knowledge match);
//    otherwise at most a reaction, and only on posts that match the bot's interests
//  * never twice on the same post, never on sensitive posts, never on posts older than 48 h, never on bots' own posts
//  * PILOT RULE: at most ONE post per bot per Dhaka day (a hard cap, config cannot raise it); an entry is NEVER posted twice
//    (own.posted keeps the ids), a post is never a near-copy of a recent one (simhash), the moon post at most once per 7 days,
//    and the topic changes from one post to the next when another fresh topic exists. When nothing fresh is left the bot stops
//    posting (composePost returns null) instead of repeating itself.
//  * composePost/shouldPostNow are PURE: they never change the brain. Only recordPost/recordEngagement/recordFailure do.
//  * every function refuses a brain that belongs to another bot (BrainOwnerError)
import { VOICES } from './personalities.js';
import { BRAINS } from './engine.js';
import { search, CONFIDENT } from './retrieval.js';
import { detectLang, detectTopics, isSensitive, hasCrisis } from '../bots-brain.js';
import { isCrisis } from './safety.js';
import { understand } from './understanding.js';
import { simhash, nearDuplicate, pick, seeded, dhaka, sanitize } from './util.js';
import { remember, rollDay, assertOwner, LIMITS as MEM } from './memory.js';
import { moonSentence } from './knowledge/sky.js';
import { TRIVIA, TRIVIA_BY_ID } from './knowledge/trivia.js';

const HOUR = 3600000;
export const SOCIAL = {
  postsPerDay: 1, postCooldownMs: 5 * HOUR, activeHours: [8, 22],        // Asia/Dhaka, inclusive start, exclusive end
  commentsPerDay: 6, commentCooldownMs: 15 * 60000, reactionsPerDay: 10,
  postMaxAgeMs: 48 * HOUR, maxFailuresPerDay: 5, maxPostChars: 700, maxCommentChars: 420
};
export const HARD_MAX_POSTS_PER_DAY = 1;           // pilot: no setting, option or admin limit can raise this
const cfg = (o = {}) => { const c = { ...SOCIAL, ...o }; c.postsPerDay = Math.min(HARD_MAX_POSTS_PER_DAY, Number.isFinite(c.postsPerDay) ? c.postsPerDay : HARD_MAX_POSTS_PER_DAY); return c; };
const sentence = (e, lang) => e[lang] || e.en;

export function paused(brain, c = SOCIAL) { return brain.counters.failures >= c.maxFailuresPerDay; }

// Decide whether this hourly run should create a post. Deterministic per bot + Dhaka day + hour, so re-running the
// job inside the same hour gives the same answer (and the post id is also deterministic, see postId()).
export function shouldPostNow({ botId, brain, now = Date.now(), limit, opts }) {
  assertOwner(brain, botId);
  const c = cfg(opts); rollDay(brain, now);
  const { day, hour } = dhaka(new Date(now));
  const cap = Math.min(c.postsPerDay, Number.isFinite(limit) ? Math.max(0, limit) : c.postsPerDay);
  if (paused(brain, c)) return { ok: false, why: 'paused-after-failures' };
  if (hour < c.activeHours[0] || hour >= c.activeHours[1]) return { ok: false, why: 'outside-active-hours' };
  if (brain.counters.posts >= cap) return { ok: false, why: 'daily-limit' };
  if (now - brain.counters.lastPostAt < c.postCooldownMs) return { ok: false, why: 'cooldown' };
  // spread the remaining slots over the remaining active hours instead of posting at the first opportunity
  const hoursLeft = Math.max(1, c.activeHours[1] - hour);
  const slotsLeft = cap - brain.counters.posts;
  const p = Math.min(1, slotsLeft / hoursLeft + (hoursLeft <= slotsLeft ? 1 : 0));
  const rand = seeded(`${botId}|${day}|${hour}|${brain.counters.posts}`);
  return rand() < p ? { ok: true, why: 'scheduled' } : { ok: false, why: 'not-this-hour' };
}
export const postId = (botId, now, brain) => `bp_${botId}_${dhaka(new Date(now)).day.replace(/-/g, '')}_${brain.counters.posts + 1}`;

const BOTH = (en, bn) => (en && bn ? `${en}\n\n${bn}` : en || bn);

const MOON_GAP_DAYS = 7;
const dayNum = (yyyymmdd) => Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8)) / 86400000;
const topicOfEntry = (botId, id) => {
  if (/^moon-/.test(id)) return 'astronomy';
  const q = TRIVIA_BY_ID.get(id); if (q) return q.cat;             // quiz entries: the question's category, not the generic 'quiz'
  const kb = BRAINS[botId]; const e = kb && kb.kb.find((x) => x.id === id);
  return e ? e.topic : '';
};
// Was the moon post made within the last MOON_GAP_DAYS days (by the entry ids this bot has posted)?
const moonRecently = (posted, today) => posted.some((id) => /^moon-\d{8}$/.test(id) && Math.abs(dayNum(today) - dayNum(id.slice(5))) < MOON_GAP_DAYS);

// What to post. Returns { text, entry, kind, topic } or null when nothing fresh is left (the bot then simply does not post:
// it never repeats an old entry). PURE: the brain is not changed here. Bilingual (English + Bengali); the text is written
// by us, never copied from a user.
export function composePost({ bot, brain, now = Date.now(), rand = Math.random, opts }) {
  assertOwner(brain, bot.id);
  const c = cfg(opts); const kb = BRAINS[bot.id]; const voice = VOICES[bot.id];
  if (!kb || !voice) return null;
  const posted = new Set(brain.own.posted);
  const fresh = (e) => !posted.has(e.id);                            // never an entry that was posted before
  const day = dhaka(new Date(now)).day.replace(/-/g, '');
  const lastTopic = brain.own.posted.length ? topicOfEntry(bot.id, brain.own.posted[brain.own.posted.length - 1]) : '';
  const mk = (en, bn, extra) => {
    const topic = extra.topic;
    if (extra.kind === 'quiz') return { text: BOTH(en, bn).slice(0, c.maxPostChars), ...extra, topic };   // the answer is in the post, so no "guess first" hook
    const hook = rand() < 0.5 ? pick(voice.bank.postHook.en, rand) : '';
    const hookBn = hook ? pick(voice.bank.postHook.bn, rand) : '';
    return { text: BOTH(`${en}${hook ? ` ${hook}` : ''}`, `${bn}${hookBn ? ` ${hookBn}` : ''}`).slice(0, c.maxPostChars), ...extra, topic };
  };
  let cands = [];
  if (bot.id === 'bot_19') {
    const pool = TRIVIA.filter(fresh).sort(() => rand() - 0.5);
    cands = pool.map((q) => mk(`Quick quiz: ${q.q.en} Answer: ${q.a.en}.${q.fun ? ` ${q.fun.en}` : ''}`, `ছোট্ট কুইজ: ${q.q.bn} উত্তর: ${q.a.bn}।${q.fun ? ` ${q.fun.bn}` : ''}`, { entry: q.id, kind: 'quiz', topic: q.cat }));
  } else {
    const tips = kb.kb.filter((e) => e.tip && fresh(e)).sort(() => rand() - 0.5);
    cands = tips.map((e) => mk(`${pick(voice.bank.open.en, rand)} ${sentence(e, 'en')}`, `${pick(voice.bank.open.bn, rand)} ${sentence(e, 'bn')}`, { entry: e.id, kind: 'tip', topic: e.topic }));
    if (bot.id === 'bot_17' && !posted.has(`moon-${day}`) && !moonRecently(brain.own.posted, day) && rand() < 0.35) {
      const d = new Date(now);
      cands.unshift(mk(moonSentence(d, 'en'), moonSentence(d, 'bn'), { entry: `moon-${day}`, kind: 'moon', topic: 'astronomy' }));
    }
  }
  if (!cands.length) return null;                                    // everything was posted: stop, do not repeat
  // another topic than the last post first; the same topic only when no other fresh topic is left
  cands = [...cands.filter((x) => x.topic !== lastTopic), ...cands.filter((x) => x.topic === lastTopic)];
  for (const x of cands) if (!nearDuplicate(simhash(x.text), brain.own.recentFp)) return x;
  return null;
}

export function recordPost(brain, post, now = Date.now(), botId) {
  assertOwner(brain, botId === undefined && brain ? brain.botId : botId);   // pass botId so a wrong brain is refused
  rollDay(brain, now);
  brain.counters.posts += 1; brain.counters.lastPostAt = now;
  remember(brain.own.recentFp, simhash(post.text), MEM.recentFp);
  if (post.entry) { remember(brain.own.used, post.entry, MEM.used); remember(brain.own.posted, post.entry, MEM.posted); }
}

// Comment / reaction on someone else's post. `post` = { id, text, createdAt(ms), uid }. The caller has ALREADY checked
// consent (the author allowed bot engagement), that the post is public and not in a group, and that the author is not a bot.
export function decideEngagement({ bot, brain, post, now = Date.now(), rand = Math.random, opts }) {
  const c = cfg(opts); const kb = BRAINS[bot.id]; const voice = VOICES[bot.id];
  const none = (why) => ({ comment: null, reaction: null, why });
  assertOwner(brain, bot.id);
  if (!kb || !voice) return none('not-a-pilot');
  rollDay(brain, now);
  if (paused(brain, c)) return none('paused-after-failures');
  const text = sanitize(post.text, 1000);
  if (!text) return none('no-text');
  if (/^bot_/.test(String(post.uid))) return none('bot-to-bot-off');
  if (now - Number(post.createdAt || 0) > c.postMaxAgeMs) return none('too-old');
  if (isSensitive(text) || hasCrisis(text) || isCrisis(text) || ['sad', 'crisis'].includes(understand(text).intent)) return none('sensitive');
  if (brain.own.commented.includes(post.id)) return none('already-engaged');
  const topics = detectTopics(text).filter((t) => voice.interests.includes(t));
  const hit = search(kb.index, text, 1).filter((h) => h.hits >= kb.minHits)[0];
  const lang = detectLang(text);
  const knows = hit && hit.score >= CONFIDENT;
  if (!topics.length && !knows) return none('not-relevant');
  const out = { comment: null, reaction: null, why: '', topic: topics[0] || (hit && hit.entry.topic) || voice.mainTopic };
  if (knows && brain.counters.comments < c.commentsPerDay && now - brain.counters.lastCommentAt >= c.commentCooldownMs) {
    const body = `${pick(voice.bank.commentOpen[lang], rand)} ${sentence(hit.entry, lang)}`.slice(0, c.maxCommentChars);
    if (!nearDuplicate(simhash(body), brain.own.recentFp)) out.comment = { text: body, entry: hit.entry.id, lang };
  }
  if ((topics.length || knows) && brain.counters.reactions < c.reactionsPerDay) out.reaction = 'like';
  if (!out.comment && !out.reaction) return none('limits');
  out.why = out.comment ? 'comment' : 'reaction';
  return out;
}

export function recordEngagement(brain, postId, { comment, reaction }, now = Date.now(), botId) {
  assertOwner(brain, botId === undefined && brain ? brain.botId : botId);
  rollDay(brain, now);
  remember(brain.own.commented, postId, MEM.commented);
  if (comment) { brain.counters.comments += 1; brain.counters.lastCommentAt = now; remember(brain.own.recentFp, simhash(comment.text), MEM.recentFp); if (comment.entry) remember(brain.own.used, comment.entry, MEM.used); }
  if (reaction) brain.counters.reactions += 1;
}
export function recordFailure(brain, now = Date.now(), botId) { assertOwner(brain, botId === undefined && brain ? brain.botId : botId); rollDay(brain, now); brain.counters.failures += 1; }
