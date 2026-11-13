// Understanding of ONE user message: language, intent, topics. Rule based (English + Bengali), no network, no LLM.
// The message is untrusted: it is only ever CLASSIFIED here, never executed or copied into a reply.
import { detectLang, detectTopics, isSensitive, hasCrisis, isQuestion } from '../bots-brain.js';
import { norm, sanitize } from './util.js';

const has = (low, re) => re.test(low);
const RE = {
  injection: /ignore (all |any |the )?(previous|above|prior|earlier) (instructions|rules|prompts?)|forget (all |your )?(instructions|rules)|system prompt|developer mode|jailbreak|\bdan mode\b|you are now|from now on you|pretend (to be|you are|you're)|act as (a |an )?(human|person|real)|reveal (your |the )?(prompt|instructions|rules|key|keys|secret|secrets|password|token)|(api|secret|private) key|admin password|আগের নির্দেশ|পূর্বের নির্দেশ|নির্দেশ(গুলো)? (ভুলে|বাতিল)|সিস্টেম প্রম্পট|মানুষ সেজে|মানুষ হয়ে|পাসওয়ার্ড বল|সিক্রেট কী|এপিআই কী/i,
  forget: /\b(forget|delete|erase|remove|clear) (me|my (data|memory|info|information|history|chat))|\bforget (everything|what i said)|(আমাকে|আমার (তথ্য|ডেটা|কথা)).{0,12}(ভুলে যাও|মুছে (ফেল|দাও))|ভুলে যাও|মেমরি মুছ/i,
  whoami: /(are you|r u|you are).{0,12}(bot|robot|ai|human|real|person)|who are you|your name|what are you|তুমি কি|আপনি কি|তুমি কে|আপনি কে|তোমার নাম|আপনার নাম|নাম (কি|কী)|রোবট|বট কি/i,
  greeting: /^(hi|hii+|hello|hey|hola|salam|assalamu|good (morning|evening|afternoon))\b|^(হ্যালো|হাই|সালাম|আসসালামু|নমস্কার|শুভ সকাল|শুভ সন্ধ্যা)/i,
  how: /how are you|how r u|how do you do|how is it going|কেমন আছ|কি খবর|কী খবর/i,
  thanks: /\b(thanks|thank you|thx|ty|appreciate)\b|ধন্যবাদ|থ্যাংকস|শুকরিয়া/i,
  bye: /\b(bye|goodbye|see you|good night|gn)\b|বিদায়|টাটা|আল্লাহ হাফেজ|শুভ রাত্রি|পরে কথা/i,
  help: /\b(help|what can you do|what do you know|menu|commands?)\b|সাহায্য|কী করতে পার|কি করতে পার|কী জান|কি জান/i,
  sad: /\b(sad|upset|crying|stressed|hopeless|depressed|lonely|anxious)\b|মন খারাপ|কাঁদছি|হতাশ|একা লাগ|দুশ্চিন্তা/i,
  more: /^(more|another( one)?|again|next|one more|what else|go on|continue|tell me more)\b|^(আরও|আরেকটা|আরেকটি|আবার|পরের|আর কী|আর কি|চালিয়ে যাও|আরো)/i,
  why: /^(why|how come|really|are you sure|explain)\b|^(কেন|কীভাবে|কিভাবে|সত্যি|ব্যাখ্যা)/i,
  quiz: /\b(quiz|trivia|question me|test me|ask me a question|play a game)\b|কুইজ|ট্রিভিয়া|প্রশ্ন দাও|প্রশ্ন কর|পরীক্ষা নাও|খেলি/i,
  skip: /^(skip|pass|i (do not|don't) know|idk|no idea|give up|answer|show answer|reveal)\b|^(জানি না|বলতে পারছি না|উত্তর (বল|দাও)|পারছি না|হাল ছেড়ে)/i,
  moon: /\b(moon|lunar|full moon|new moon|moon phase|crescent)\b|চাঁদ|চন্দ্র|পূর্ণিমা|অমাবস্যা|চাঁদের কলা/i,
  tip: /\b(tip|tips|advice|suggest(ion)?|trick|hack)\b|টিপস|পরামর্শ|ট্রিক/i,
  laugh: /\b(lol|haha+|hehe+)\b|😂|🤣|হাহা/i
};
const PHASE = /phase|tonight|today|now|full moon|new moon|crescent|gibbous|কলা|আজ|এখন|আজকের|পূর্ণিমা|অমাবস্যা|কত তারিখ/i;
// the order matters: safety first, then identity, then everything else
const ORDER = ['injection', 'forget', 'whoami', 'greeting', 'how', 'thanks', 'bye', 'help', 'sad', 'quiz', 'skip', 'moon', 'more', 'why', 'tip', 'laugh'];

export function understand(rawText) {
  const text = sanitize(rawText, 500);
  const low = text.toLowerCase();
  const lang = detectLang(text);
  const out = { text, lang, intent: 'smalltalk', topics: detectTopics(text), question: isQuestion(text), words: norm(text).split(' ').filter(Boolean).length };
  if (!text) { out.intent = 'empty'; return out; }
  if (hasCrisis(text)) { out.intent = 'crisis'; return out; }
  for (const k of ORDER) {
    if (has(low, RE[k])) {
      // a greeting that carries a real question ("hi, how do I ...?") is answered as the question
      if (k === 'greeting' && out.words > 5 && out.question) continue;
      // "why does the Moon look big?" is a knowledge question; only phase/date questions get the computed Moon phase
      if (k === 'moon' && !PHASE.test(low)) continue;
      out.intent = k;
      return out;
    }
  }
  if (isSensitive(text)) { out.intent = 'sad'; return out; }
  if (out.question || out.topics.length || out.words >= 3) out.intent = 'knowledge';
  return out;
}
