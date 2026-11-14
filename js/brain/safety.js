// Safety classifiers for the pilot bots: crisis messages, prompt-injection attempts, "forget me" requests.
// Rule based (English, Bengali, romanised Bengali) and deliberately CONSERVATIVE in two different ways:
//  * crisis: when in doubt, treat the message as a crisis (a gentle, safe answer costs little)
//  * injection / forget: when in doubt, do NOT act (a legitimate technical question must never be refused, and a
//    person's memory must never be deleted by an ordinary sentence)
// The v1 bots keep their own (smaller) lists in js/bots-brain.js, which this file does not touch.
import { sanitize } from './util.js';

const prep = (t) => sanitize(t, 500).toLowerCase().replace(/[‘’]/g, "'");
const SENT = '[^.?!\\n]';                                   // stay inside one sentence

// ------------------------------------------------------------------ crisis
const CRISIS = [
  /\b(suicide|suicidal|kill(ing)? myself|end(ing)? my (own )?life|take my own life|self[- ]?harm\w*|(hurt|harm|injure|cutting) myself)\b/,
  /\bend it all\b/,
  /\b(want|wanna|going|plan|planning|ready|need|wish) to (die|be dead|disappear forever)\b/,
  /\b(don'?t|dont|do not|no longer|not) (want|wanna|wish) to (live|be alive|exist)\b/,
  /\bbetter off dead\b|\bnothing to live for\b|\bnot worth living\b|\bno (reason|point) (to|in) (live|living|go(ing)? on)\b/,
  /\b(can'?t|cannot|can not) (go on|take (it|this)|do this) (anymore|any more|like this)\b/,
  // Banglish
  /\b(morte chai|more jete (chai|ichche|icche)|morte ichhe|ar bachte chai na|bachte ichhe kore na|suicide korbo|atmohotta|nijeke shesh)\b/,
  // Bengali
  /আত্মহত্যা|আত্মহনন/,
  /(মরে যেতে|মরতে)\s*(চাই|ইচ্ছে|ইচ্ছা|মন চায়|চাইছি)/,
  /(বাঁচতে|বেঁচে থাকতে|বাচতে)\s*(চাই না|চাইনা|ইচ্ছে করে না|ইচ্ছা করে না|ইচ্ছে করছে না|ইচ্ছা করছে না)/,
  /(আর|আমি আর)\s*(বাঁচব না|বাঁচবো না|বাঁচতে পারব না|বাঁচতে পারছি না)|বাঁচার ইচ্ছা নেই|বেঁচে থেকে (আর )?লাভ নেই/,
  /(নিজেকে|জীবন)\s*(শেষ|খতম)\s*(করে|করব|করবো|করতে)/,
  /নিজের ক্ষতি (করতে|করব|করবো)|নিজেকে (কষ্ট|আঘাত) দিতে/
];
const NOT_CRISIS = /\b(die|dying|dead)\s+(laughing|of (laughter|embarrassment|boredom|shame|cringe)|from (laughter|embarrassment))\b/;
export function isCrisis(text) {
  const low = prep(text);
  if (!low) return false;
  const rest = low.replace(NOT_CRISIS, ' ');
  return CRISIS.some((re) => re.test(rest));
}

// ------------------------------------------------------------------ prompt injection
// Only messages that try to steer, unlock or interrogate THE BOT are caught. A question about security, keys,
// passwords, Developer Mode on a phone or jailbreaking a phone is a normal tech question and passes.
const INJECTION = [
  // "ignore all previous instructions", "forget your rules" ...
  new RegExp(`\\b(ignore|disregard|forget|override|bypass|overrule)\\b${SENT}{0,25}\\b(previous|prior|above|earlier|preceding|all|any|your|these|those)\\b${SENT}{0,20}\\b(instructions?|rules?|prompts?|directions?|guidelines?|programming|constraints?|restrictions?|guardrails?)\\b`),
  // "reveal your system prompt", "what is your api key"
  new RegExp(`\\b(reveal|show|print|repeat|display|output|leak|expose|dump|read out|tell me|give me|what is|what's|what are|share)\\b${SENT}{0,20}\\byour\\b${SENT}{0,12}\\b(system|initial|hidden|secret|original|internal|developer|first)\\s+(prompt|message|instructions?|rules|configuration|config)\\b`),
  new RegExp(`\\b(reveal|show|print|repeat|display|output|leak|expose|dump|read out|tell me|give me|what is|what's|share)\\b${SENT}{0,20}\\byour\\b${SENT}{0,10}\\b(api[- ]?keys?|access tokens?|secret keys?|private keys?|passwords?|credentials|secrets|source code|prompt|training data)\\b`),
  /\brepeat (the )?(words|text|everything|all) (above|before)\b|\bstarting with ["']?you are\b/,
  /\b(enter|switch to|go into|you are (now )?in|activate your|enable your|turn on your) (developer|dev|god|sudo|dan|admin|root) mode\b|\bdan mode\b|\bdo anything now\b|\bjailbreak (yourself|your|you)\b|\byou are jailbroken\b/,
  // making the bot claim to be a person or to have no rules
  new RegExp(`\\b(you are|you're|you will be|act as|pretend (to be|you are|you're)|roleplay as|behave as|from now on you are)\\b${SENT}{0,15}\\b(dan|an? human|human being|a real person|real human|jailbroken|unrestricted|unfiltered|evil|without (any )?(rules|restrictions|filters)|no (rules|restrictions|filters))\\b`),
  // Bengali
  new RegExp(`(আগের|পূর্বের|সব|তোমার|আপনার)\\s*(নির্দেশ|নিয়ম|প্রম্পট|নির্দেশনা)\\S*${SENT}{0,12}(ভুলে যাও|ভুলে যান|বাতিল|উপেক্ষা|অগ্রাহ্য|মানবে না|মানো না)`),
  new RegExp(`(ভুলে যাও|ভুলে যান|উপেক্ষা কর|বাতিল কর)${SENT}{0,12}(আগের|সব|তোমার|আপনার)\\s*(নির্দেশ|নিয়ম)`),
  new RegExp(`(তোমার|আপনার)\\s*(সিস্টেম\\s*প্রম্পট|প্রম্পট|নির্দেশ\\S*|গোপন\\S*|পাসওয়ার্ড|এপিআই\\s*কী|এপিআই|টোকেন)${SENT}{0,10}(বল|দেখাও|জানাও|প্রকাশ|দাও|দেখান|বলুন)`),
  new RegExp(`সিস্টেম\\s*প্রম্পট${SENT}{0,10}(বল|দেখাও|দেখান|বলো|বলুন)`),
  /(আসল|বাস্তব)?\s*মানুষ\s*(সেজে|হয়ে|সাজ|ভান কর)|মানুষ হিসেবে (পরিচয়|অভিনয়)/
];
export function isInjection(text) {
  const low = prep(text);
  return !!low && INJECTION.some((re) => re.test(low));
}

// ------------------------------------------------------------------ forget me
// Memory is deleted ONLY for an explicit request that is about the person's data with the bot. "forget it",
// "ভুলে যাও ওটা", "don't forget me", or "how do I delete my history in Chrome?" must not delete anything.
const FORGET_STRONG = [
  /\b(forget|erase|delete|remove|wipe|clear)\b[^.?!\n]{0,25}\b(from|in) your (memory|database|records|storage)\b/,
  /\b(forget|erase|delete|remove|wipe|clear)\b[^.?!\n]{0,12}\b(everything|all|anything)\b[^.?!\n]{0,12}\byou (know|remember|stored?|have|keep)\b[^.?!\n]{0,12}\b(about|on) me\b/,
  /\bforget (all )?(that )?you (know|remember) about me\b/,
  /আমাকে ভুলে (যাও|যান)|আমার সম্পর্কে (যা|সব)[^।?!\n]{0,15}ভুলে (যাও|যান)|আমার (সব )?(তথ্য|ডেটা|ডাটা|কথা|মেমরি|হিস্ট্রি|ইতিহাস)[^।?!\n]{0,15}(ভুলে (যাও|যান)|মুছে (ফেল|দাও|দিন))/
];
// short forms must END right after the target (optionally "from you / from here / please / now"): "remove me from the
// group", "delete me from facebook" and "clear my history on chrome" name another place and are NOT requests to this bot
const TAIL = String.raw`( (and|&) (delete|erase|forget|remove|wipe|clear) (me|my (data|memory|memories|info|information|details|history|chats?|profile)|everything))?( (from|in|with) (you|your (memory|records|database|storage)|here|this (chat|bot)|this conversation))?( (please|pls|now|thanks|thank you))?[.!?]*$`;
const FORGET_SHORT = [
  new RegExp(String.raw`^((please|pls|can you|could you|would you|kindly) )*(forget|erase|delete|remove|wipe|clear) (me|about me)` + TAIL),
  new RegExp(String.raw`^((please|pls|can you|could you|would you|kindly) )*(forget|erase|delete|remove|wipe|clear) (all )?(of )?my (data|memory|memories|info|information|details|history|chat|chats|conversations?|profile)` + TAIL),
  new RegExp(String.raw`^((please|pls) )*(don'?t|do not|stop) (remember(ing)?|keep(ing)?|stor(e|ing)) (me|my (data|info|details|history))` + TAIL),
  /^(প্লিজ |দয়া করে )?(আমার |তোমার |আপনার )?(সব )?(মেমরি|তথ্য|ডেটা) মুছে (ফেল|দাও|দিন)[ ।!]*$/
];
// "don't forget me", "never delete my data", "please don't forget everything you know about me": the opposite of a request
const NEGATED = /\b(don'?t|do not|never|not|won'?t|shouldn'?t|mustn'?t)\b[^.?!\n]{0,12}\b(forget|delete|erase|remove|wipe|clear)\b|\bforget me not\b|ভুলে যেও না|ভুলে যাবেন না|ভুলে যাবে না|মুছো না|মুছবে না|মুছবেন না|মুছে ফেলো না/;
export function isForget(text) {
  const low = prep(text);
  if (!low || NEGATED.test(low)) return false;
  if (FORGET_STRONG.some((re) => re.test(low))) return true;
  return FORGET_SHORT.some((re) => re.test(low));
}
