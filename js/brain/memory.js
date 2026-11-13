// Independent memory of ONE bot (document botBrains/{botId}).
//
// PRIVACY BY CONSTRUCTION: memory holds only numbers, flags and ids from controlled lists (topic ids, knowledge ids,
// quiz ids, document ids). sanitizeBrain() drops everything else, so free text (such as a user's private words)
// cannot be written even by a bug. Every save goes through sanitizeBrain().
import { ALLOWED_TOPICS, ID_RE, DOC_ID_RE, UID_RE } from './vocab.js';
import { dhaka, clamp } from './util.js';

export const LIMITS = { people: 60, recentFp: 40, commented: 150, used: 40, seen: 12, topics: 5, ttlDays: 90, maxBytes: 40000 };
export const INTENT_CODES = ['greeting', 'how', 'thanks', 'bye', 'help', 'sad', 'quiz', 'skip', 'moon', 'more', 'why', 'tip', 'laugh', 'knowledge', 'smalltalk', 'whoami', 'forget', 'injection', 'crisis', 'empty', 'unknown', 'quiz-answer'];
const DAY = 86400000;

export const emptyBrain = (botId, now = Date.now()) => ({
  v: 1, botId,
  own: { recentFp: [], commented: [], used: [], trivia: null },
  people: {},
  counters: { day: '', posts: 0, comments: 0, reactions: 0, chats: 0, lastPostAt: 0, lastCommentAt: 0, failures: 0 },
  updatedAt: now
});

const num = (v, lo, hi, d = 0) => (Number.isFinite(Number(v)) ? clamp(Math.round(Number(v)), lo, hi) : d);
const strList = (v, re, max) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && re.test(x)).slice(-max) : []);

function cleanPerson(p, now) {
  if (!p || typeof p !== 'object') return null;
  const quiz = p.quiz && typeof p.quiz === 'object' ? p.quiz : {};
  return {
    n: num(p.n, 0, 100000), last: num(p.last, 0, now + DAY), lang: p.lang === 'bn' ? 'bn' : 'en',
    topics: strList(p.topics, /^[a-z]+$/, 20).filter((t) => ALLOWED_TOPICS.includes(t)).slice(-LIMITS.topics),
    seen: strList(p.seen, ID_RE, LIMITS.seen),
    lastEntry: typeof p.lastEntry === 'string' && ID_RE.test(p.lastEntry) ? p.lastEntry : '',
    lastIntent: INTENT_CODES.includes(p.lastIntent) ? p.lastIntent : '',
    quiz: { asked: num(quiz.asked, 0, 100000), right: num(quiz.right, 0, 100000), pending: typeof quiz.pending === 'string' && ID_RE.test(quiz.pending) ? quiz.pending : '', pAt: num(quiz.pAt, 0, now + DAY), seen: strList(quiz.seen, ID_RE, LIMITS.seen * 4) }
  };
}

export const brainBytes = (b) => JSON.stringify(b).length;

// Rebuilds a brain from whatever was stored: wrong types are repaired, unknown keys and any non-controlled values dropped.
export function sanitizeBrain(raw, botId, now = Date.now()) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const b = emptyBrain(botId, now);
  const own = r.own && typeof r.own === 'object' ? r.own : {};
  b.own.recentFp = strList(own.recentFp, /^[0-9a-f]{16}$/, LIMITS.recentFp);
  b.own.commented = strList(own.commented, DOC_ID_RE, LIMITS.commented);
  b.own.used = strList(own.used, ID_RE, LIMITS.used);
  if (own.trivia && typeof own.trivia === 'object' && typeof own.trivia.id === 'string' && ID_RE.test(own.trivia.id)) b.own.trivia = { id: own.trivia.id, at: num(own.trivia.at, 0, now + DAY), revealed: own.trivia.revealed === true };
  const c = r.counters && typeof r.counters === 'object' ? r.counters : {};
  b.counters = { day: typeof c.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.day) ? c.day : '', posts: num(c.posts, 0, 1000), comments: num(c.comments, 0, 1000), reactions: num(c.reactions, 0, 1000), chats: num(c.chats, 0, 100000), lastPostAt: num(c.lastPostAt, 0, now + DAY), lastCommentAt: num(c.lastCommentAt, 0, now + DAY), failures: num(c.failures, 0, 100000) };
  const people = r.people && typeof r.people === 'object' ? r.people : {};
  for (const [uid, p] of Object.entries(people)) {
    if (!UID_RE.test(uid) || uid.startsWith('bot_')) continue;   // bots never keep (or share) memory about other bots
    const cp = cleanPerson(p, now); if (cp) b.people[uid] = cp;
  }
  prune(b, now);
  b.updatedAt = now;
  return b;
}

// retention + size limits: forget people not seen for ttlDays, keep the newest `people`, stay under maxBytes
export function prune(b, now = Date.now()) {
  for (const [uid, p] of Object.entries(b.people)) if (!p.last || now - p.last > LIMITS.ttlDays * DAY) delete b.people[uid];
  const byAge = () => Object.entries(b.people).sort((x, y) => x[1].last - y[1].last);
  while (Object.keys(b.people).length > LIMITS.people) delete b.people[byAge()[0][0]];
  while (brainBytes(b) > LIMITS.maxBytes && Object.keys(b.people).length) delete b.people[byAge()[0][0]];
  return b;
}

export function rollDay(b, now = Date.now()) {
  const day = dhaka(new Date(now)).day;
  if (b.counters.day !== day) b.counters = { ...b.counters, day, posts: 0, comments: 0, reactions: 0, chats: 0, failures: 0 };
  return b;
}

export const personOf = (b, uid) => b.people[uid] || null;
export function touchPerson(b, uid, { lang, topics = [], intent = '', entry = '', now = Date.now() } = {}) {
  if (!UID_RE.test(String(uid)) || String(uid).startsWith('bot_')) return null;
  const p = b.people[uid] || cleanPerson({}, now);
  p.n += 1; p.last = now; p.lang = lang === 'bn' ? 'bn' : 'en';
  for (const t of topics) if (ALLOWED_TOPICS.includes(t)) { p.topics = p.topics.filter((x) => x !== t); p.topics.push(t); }
  p.topics = p.topics.slice(-LIMITS.topics);
  if (INTENT_CODES.includes(intent)) p.lastIntent = intent;
  if (entry && ID_RE.test(entry)) { p.lastEntry = entry; p.seen = [...p.seen.filter((x) => x !== entry), entry].slice(-LIMITS.seen); }
  b.people[uid] = p;
  return p;
}
// the user asked to be forgotten: remove everything about them from THIS bot's memory
export function forgetPerson(b, uid) { const had = Boolean(b.people[uid]); delete b.people[uid]; return had; }

export function remember(list, value, max) { const i = list.indexOf(value); if (i >= 0) list.splice(i, 1); list.push(value); while (list.length > max) list.shift(); return list; }
