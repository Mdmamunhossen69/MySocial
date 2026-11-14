// The chat engine of the pilot bots: understand -> decide -> compose, with memory.
// Pure and synchronous: it receives ONE bot's brain object and returns a reply; it keeps no module-level state,
// so one bot can never see another bot's memory (each call only gets its own brain).
import { understand } from './understanding.js';
import { VOICES, BASE, phrases } from './personalities.js';
import { buildIndex, search, CONFIDENT, NEAR } from './retrieval.js';
import { simhash, nearDuplicate, pick } from './util.js';
import { touchPerson, forgetPerson, personOf, remember, rollDay, assertOwner, LIMITS } from './memory.js';
import { TOPIC_LABEL, PILOT_BOT_IDS } from './vocab.js';
import { TECH } from './knowledge/tech.js';
import { SKY, moonSentence } from './knowledge/sky.js';
import { TRIVIA, TRIVIA_BY_ID, checkAnswer } from './knowledge/trivia.js';

const MAX_REPLY = 600;           // characters: the "token limit" of a reply
const QUIZ_TTL = 24 * 3600 * 1000;

// trivia facts exposed as searchable entries ("capital of Australia?" -> "Canberra")
const TRIVIA_FACTS = TRIVIA.map((q) => ({ id: q.id, topic: 'quiz', title: q.q, keys: [], tip: true,
  en: `${q.a.en}.${q.fun ? ` ${q.fun.en}` : ''}`, bn: `${q.a.bn}।${q.fun ? ` ${q.fun.bn}` : ''}` }));

export const BRAINS = {
  bot_01: { voice: VOICES.bot_01, kb: TECH, index: buildIndex(TECH), confident: CONFIDENT, minHits: 1 },
  bot_17: { voice: VOICES.bot_17, kb: SKY, index: buildIndex(SKY), confident: CONFIDENT, minHits: 1, moon: true },
  bot_19: { voice: VOICES.bot_19, kb: TRIVIA_FACTS, index: buildIndex(TRIVIA_FACTS), confident: 4.5, minHits: 2, quiz: true }
};
export const isPilot = (botId) => PILOT_BOT_IDS.includes(botId) && Boolean(BRAINS[botId]);

export const label = (topic, lang) => (TOPIC_LABEL[topic] || TOPIC_LABEL.general)[lang];

function fill(str, vars, voice, rand) {
  const emoji = rand() < voice.emojiRate ? pick(voice.emoji, rand) : '';
  return str.replace(/\{(bot|topic|emoji|suggest|a)\}/g, (_, k) => (k === 'emoji' ? emoji : vars[k] ?? '')).replace(/\s+([.,!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

// Chooses a phrase that is not a near-copy of something this bot said recently (own memory + the visible chat).
function say(ctx, role, vars = {}) {
  const list = phrases(ctx.voice, role)[ctx.lang];
  const order = [...list].sort(() => ctx.rand() - 0.5);
  let fallback = null;
  for (const raw of order) {
    const text = fill(raw, { bot: ctx.bot.name, topic: label(ctx.voice.mainTopic, ctx.lang), ...vars }, ctx.voice, ctx.rand);
    fallback ||= text;
    if (!nearDuplicate(simhash(text), ctx.recent)) return text;
  }
  return fallback;
}
const entryText = (e, lang) => e[lang] || e.en;
const join = (...parts) => parts.filter(Boolean).join(' ').slice(0, MAX_REPLY);

function knowledgeReply(ctx, hit) {
  const e = hit.entry;
  const open = ctx.rand() < 0.5 ? say(ctx, 'open') : '';
  const close = ctx.rand() < 0.4 ? say(ctx, 'close') : '';
  return { text: join(open, entryText(e, ctx.lang), close), entry: e.id, topic: e.topic };
}

function unseenTip(ctx, person) {
  const seen = new Set([...(person?.seen || []), ...ctx.brain.own.used.slice(-5)]);
  const pool = ctx.kb.kb.filter((e) => e.tip && !seen.has(e.id));
  return pool.length ? pick(pool, ctx.rand) : null;
}

function startQuiz(ctx, person) {
  const q = person.quiz;
  let pool = TRIVIA.filter((t) => !q.seen.includes(t.id));
  if (!pool.length) { q.seen = []; q.pending = ''; return { text: say(ctx, 'quizNoMore'), intent: 'quiz' }; }
  const t = pick(pool, ctx.rand);
  q.pending = t.id; q.pAt = ctx.now; q.asked += 1; remember(q.seen, t.id, LIMITS.seen * 4);
  const skipHint = ctx.lang === 'bn' ? '(উত্তর দেখতে "জানি না" লিখুন)' : '(say "skip" to see the answer)';
  return { text: join(say(ctx, 'quizIntro'), t.q[ctx.lang], skipHint), intent: 'quiz', quiz: t.id };
}
function scoreLine(ctx, q) { return ctx.lang === 'bn' ? `স্কোর: ${q.right}/${q.asked}।` : `Score: ${q.right}/${q.asked}.`; }
function finishQuiz(ctx, person, how, userText) {
  const q = person.quiz; const t = TRIVIA_BY_ID.get(q.pending); q.pending = '';
  if (!t) return { text: say(ctx, 'quizNoMore'), intent: 'quiz' };
  const ans = `${t.a[ctx.lang]}.${t.fun ? ` ${t.fun[ctx.lang]}` : ''}`;
  if (how === 'skip') return { text: join(say(ctx, 'quizSkip'), ans, scoreLine(ctx, q), say(ctx, 'close')), intent: 'skip', quiz: t.id };
  if (checkAnswer(t, userText)) { q.right += 1; return { text: join(say(ctx, 'quizRight'), t.fun ? t.fun[ctx.lang] : '', scoreLine(ctx, q), say(ctx, 'close')), intent: 'quiz-answer', quiz: t.id, correct: true }; }
  return { text: join(say(ctx, 'quizWrong'), (ctx.lang === 'bn' ? 'উত্তর: ' : 'The answer: ') + ans, scoreLine(ctx, q), say(ctx, 'close')), intent: 'quiz-answer', quiz: t.id, correct: false };
}

// What may be written to a LOG about a reply: fixed codes only, never any text. A crisis / injection / forget message
// (and our answer to it) is therefore never logged; the runner must log safeLog(result), not the result itself.
export function safeLog(res, botId) {
  const r = res && typeof res === 'object' ? res : {};
  const code = (v) => (typeof v === 'string' && /^[a-z0-9-]{1,24}$/.test(v) ? v : '');
  const quiet = ['crisis', 'injection', 'forget'].includes(r.intent);
  return { bot: code(botId), intent: code(r.intent), lang: r.lang === 'bn' ? 'bn' : 'en', len: typeof r.text === 'string' ? r.text.length : 0, ...(quiet ? {} : { entry: code(r.entry) }) };
}

// history: [{ uid, text }] oldest first (the visible chat). Returns { text, intent, lang, entry?, topic? }.
// The brain is changed in place; the caller saves it (through sanitizeBrain) after a successful reply.
export function reply({ bot, brain, uid, text, history = [], now = Date.now(), rand = Math.random }) {
  const kb = BRAINS[bot.id];
  if (!kb) throw new Error(`no smart brain for ${bot.id}`);
  assertOwner(brain, bot.id);
  rollDay(brain, now);
  const u = understand(text);
  const recent = [...brain.own.recentFp, ...history.filter((m) => m.uid === bot.id).slice(-6).map((m) => simhash(String(m.text || '')))];
  const ctx = { bot, brain, kb, voice: kb.voice, lang: u.lang, rand, now, recent };
  const person = personOf(brain, uid);
  const finish = (res, { touch = true } = {}) => {
    res.text = res.text.slice(0, MAX_REPLY); res.lang = ctx.lang; res.intent ||= u.intent;
    if (touch) touchPerson(brain, uid, { lang: ctx.lang, topics: res.topic ? [res.topic] : u.topics.filter((t) => kb.voice.interests.includes(t)), intent: res.intent, entry: res.entry, now });
    brain.own.recentFp = remember(brain.own.recentFp, simhash(res.text), LIMITS.recentFp);
    brain.counters.chats += 1;
    return res;
  };
  const simple = (role, vars) => finish({ text: say(ctx, role, vars), intent: u.intent });

  // safety first: nothing is remembered for these
  if (u.intent === 'crisis') return finish({ text: BASE.crisis[ctx.lang][0], intent: 'crisis' }, { touch: false });
  if (u.intent === 'injection') return finish({ text: say(ctx, 'injection', { topic: label(kb.voice.mainTopic, ctx.lang) }), intent: 'injection' }, { touch: false });
  if (u.intent === 'forget') { const had = forgetPerson(brain, uid); return finish({ text: say(ctx, had ? 'forgot' : 'forgotNone'), intent: 'forget' }, { touch: false }); }
  if (u.intent === 'empty') return finish({ text: say(ctx, 'empty') }, { touch: false });
  if (u.intent === 'whoami') return simple('whoami');

  // an open quiz question waits for an answer (bot_19)
  // the quiz bot needs a record to hold the open question; creating it does not count as a conversation turn
  const p = person || (kb.quiz ? touchPerson(brain, uid, { lang: ctx.lang, now, count: false }) : null);
  if (kb.quiz && p) {
    if (p.quiz.pending && now - p.quiz.pAt > QUIZ_TTL) p.quiz.pending = '';
    const meta = ['greeting', 'how', 'thanks', 'bye', 'help', 'sad', 'laugh'];
    if (p.quiz.pending && !meta.includes(u.intent)) {
      if (u.intent === 'quiz') { const r = finishQuiz(ctx, p, 'skip', ''); const next = startQuiz(ctx, p); return finish({ text: join(r.text, next.text), intent: 'quiz', quiz: next.quiz }); }
      return finish(finishQuiz(ctx, p, u.intent === 'skip' ? 'skip' : 'answer', u.text));
    }
    if (u.intent === 'quiz') return finish(startQuiz(ctx, p));
  }

  switch (u.intent) {
    case 'greeting': {
      const t = person?.topics.at(-1);
      return finish({ text: person && person.n > 1 && t ? say(ctx, 'greetBack', { topic: label(t, ctx.lang) }) : say(ctx, 'greet'), intent: 'greeting' });
    }
    case 'how': case 'thanks': case 'bye': case 'help': case 'sad': case 'laugh': return simple(u.intent);
    case 'moon':
      if (kb.moon) return finish({ text: join(moonSentence(new Date(now), ctx.lang), say(ctx, 'close')), intent: 'moon', topic: 'astronomy' });
      break;
    case 'tip': case 'more': case 'why': {
      const e = unseenTip(ctx, person);
      if (!e) return finish({ text: say(ctx, 'moreNone'), intent: u.intent });
      remember(brain.own.used, e.id, LIMITS.used);
      if (kb.quiz) return finish({ text: join(say(ctx, 'open'), `${e.title[ctx.lang]}`, entryText(e, ctx.lang)), intent: u.intent, entry: e.id, topic: 'quiz' });
      return finish({ text: join(say(ctx, 'open'), entryText(e, ctx.lang)), intent: u.intent, entry: e.id, topic: e.topic });
    }
    default: break;
  }

  // knowledge: answer only when the match is real; otherwise say so honestly
  const hits = search(kb.index, u.text, 3).filter((h) => h.hits >= kb.minHits);
  const top = hits[0];
  if (top && top.score >= kb.confident) return finish({ ...knowledgeReply(ctx, top), intent: 'knowledge' });
  if (u.intent === 'smalltalk' && !u.question) return simple('smalltalk');
  const near = top && top.score >= NEAR ? top.entry.title[ctx.lang] : '';
  const suggest = near ? say(ctx, 'suggestNear', { a: near }) : say(ctx, 'suggestTopics', { topic: label(kb.voice.mainTopic, ctx.lang) });
  return finish({ text: say(ctx, 'unknown', { suggest }), intent: 'unknown' });
}
