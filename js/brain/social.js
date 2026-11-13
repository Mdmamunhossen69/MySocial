// Autonomous social behaviour of the pilot bots: WHEN to post, WHAT to post, and whether to comment or react.
// Pure functions: they receive ONE bot's own brain and return a decision; the runner performs it and records it.
// Rules built in (see tests/brain-social.test.mjs):
//  * daily limits and cooldowns per bot, Asia/Dhaka days, an active-hours window
//  * a comment is written only when the bot has something TRUE and relevant to add (a confident knowledge match);
//    otherwise at most a reaction, and only on posts that match the bot's interests
//  * never twice on the same post, never on sensitive posts, never on posts older than 48 h, never on bots' own posts
//  * posts are never a near-copy of the bot's recent posts (simhash), and tips are not repeated until the list is used up
import { VOICES } from './personalities.js';
import { BRAINS } from './engine.js';
import { search, CONFIDENT } from './retrieval.js';
import { detectLang, detectTopics, isSensitive, hasCrisis } from '../bots-brain.js';
import { understand } from './understanding.js';
import { simhash, nearDuplicate, pick, seeded, dhaka, sanitize } from './util.js';
import { remember, rollDay, LIMITS as MEM } from './memory.js';
import { moonSentence } from './knowledge/sky.js';
import { TRIVIA } from './knowledge/trivia.js';

const HOUR = 3600000;
export const SOCIAL = {
  postsPerDay: 2, postCooldownMs: 5 * HOUR, activeHours: [8, 22],        // Asia/Dhaka, inclusive start, exclusive end
  commentsPerDay: 6, commentCooldownMs: 15 * 60000, reactionsPerDay: 10,
  postMaxAgeMs: 48 * HOUR, maxFailuresPerDay: 5, maxPostChars: 700, maxCommentChars: 420
};
const cfg = (o = {}) => ({ ...SOCIAL, ...o });
const sentence = (e, lang) => e[lang] || e.en;

export function paused(brain, c = SOCIAL) { return brain.counters.failures >= c.maxFailuresPerDay; }

// Decide whether this hourly run should create a post. Deterministic per bot + Dhaka day + hour, so re-running the
// job inside the same hour gives the same answer (and the post id is also deterministic, see postId()).
export function shouldPostNow({ botId, brain, now = Date.now(), limit, opts }) {
  const c = cfg(opts); rollDay(brain, now);
  const { day, hour } = dhaka(new Date(now));
  const cap = Math.min(c.postsPerDay, Number.isFinite(limit) ? limit : c.postsPerDay);
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

// What to post. Returns { text, entry, kind } or null when nothing fresh is left. Bilingual (English + Bengali) so the
// post is useful to both audiences; the text is written by us, never copied from a user.
export function composePost({ bot, brain, now = Date.now(), rand = Math.random, opts }) {
  const c = cfg(opts); const kb = BRAINS[bot.id]; const voice = VOICES[bot.id];
  if (!kb || !voice) return null;
  const used = new Set(brain.own.used);
  const fresh = (e) => !used.has(e.id);
  const day = dhaka(new Date(now)).day.replace(/-/g, '');
  const mk = (en, bn, extra) => {
    if (extra.kind === 'quiz') return { text: BOTH(en, bn).slice(0, c.maxPostChars), ...extra };   // the answer is in the post, so no "guess first" hook
    const hook = rand() < 0.5 ? pick(voice.bank.postHook.en, rand) : '';
    const hookBn = hook ? pick(voice.bank.postHook.bn, rand) : '';
    return { text: BOTH(`${en}${hook ? ` ${hook}` : ''}`, `${bn}${hookBn ? ` ${hookBn}` : ''}`).slice(0, c.maxPostChars), ...extra };
  };
  const tryCandidates = (cands) => {
    for (const x of cands) { if (!nearDuplicate(simhash(x.text), brain.own.recentFp)) return x; }
    return null;
  };
  let cands = [];
  if (bot.id === 'bot_19') {
    const pool = TRIVIA.filter(fresh).sort(() => rand() - 0.5);
    cands = pool.slice(0, 6).map((q) => mk(`Quick quiz: ${q.q.en} Answer: ${q.a.en}.${q.fun ? ` ${q.fun.en}` : ''}`, `ছোট্ট কুইজ: ${q.q.bn} উত্তর: ${q.a.bn}।${q.fun ? ` ${q.fun.bn}` : ''}`, { entry: q.id, kind: 'quiz' }));
  } else {
    if (bot.id === 'bot_17' && !used.has(`moon-${day}`)) {
      const d = new Date(now);
      const m = mk(moonSentence(d, 'en'), moonSentence(d, 'bn'), { entry: `moon-${day}`, kind: 'moon' });
      if (rand() < 0.35) cands.push(m);
    }
    const tips = kb.kb.filter((e) => e.tip && fresh(e)).sort(() => rand() - 0.5);
    cands.push(...tips.slice(0, 6).map((e) => mk(`${pick(voice.bank.open.en, rand)} ${sentence(e, 'en')}`, `${pick(voice.bank.open.bn, rand)} ${sentence(e, 'bn')}`, { entry: e.id, kind: 'tip' })));
  }
  if (!cands.length) { brain.own.used = []; return null; }        // everything was used: the cycle restarts next time
  return tryCandidates(cands);
}

export function recordPost(brain, post, now = Date.now()) {
  rollDay(brain, now);
  brain.counters.posts += 1; brain.counters.lastPostAt = now;
  remember(brain.own.recentFp, simhash(post.text), MEM.recentFp);
  if (post.entry) remember(brain.own.used, post.entry, MEM.used);
}

// Comment / reaction on someone else's post. `post` = { id, text, createdAt(ms), uid }. The caller has ALREADY checked
// consent (the author allowed bot engagement), that the post is public and not in a group, and that the author is not a bot.
export function decideEngagement({ bot, brain, post, now = Date.now(), rand = Math.random, opts }) {
  const c = cfg(opts); const kb = BRAINS[bot.id]; const voice = VOICES[bot.id];
  const none = (why) => ({ comment: null, reaction: null, why });
  if (!kb || !voice) return none('not-a-pilot');
  rollDay(brain, now);
  if (paused(brain, c)) return none('paused-after-failures');
  const text = sanitize(post.text, 1000);
  if (!text) return none('no-text');
  if (/^bot_/.test(String(post.uid))) return none('bot-to-bot-off');
  if (now - Number(post.createdAt || 0) > c.postMaxAgeMs) return none('too-old');
  if (isSensitive(text) || hasCrisis(text) || ['sad', 'crisis'].includes(understand(text).intent)) return none('sensitive');
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

export function recordEngagement(brain, postId, { comment, reaction }, now = Date.now()) {
  rollDay(brain, now);
  remember(brain.own.commented, postId, MEM.commented);
  if (comment) { brain.counters.comments += 1; brain.counters.lastCommentAt = now; remember(brain.own.recentFp, simhash(comment.text), MEM.recentFp); if (comment.entry) remember(brain.own.used, comment.entry, MEM.used); }
  if (reaction) brain.counters.reactions += 1;
}
export function recordFailure(brain, now = Date.now()) { rollDay(brain, now); brain.counters.failures += 1; }
