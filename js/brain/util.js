// Small pure helpers for the smart-bot brain. No imports from the network, no state kept between calls.
// Lower-case words; keeps combining marks (\p{M}) because Bengali vowel signs are marks, not letters.
export const norm = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

// User text is UNTRUSTED input. It is cleaned and capped before anything looks at it, and it is never executed,
// interpolated into a template or echoed back (replies are built only from our own phrase banks and knowledge).
export const sanitize = (s, max = 500) => String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

const STOP_EN = new Set('a an the is are was were be been am i you he she it we they me my your our their this that these those of to in on at for with and or but if so do does did can could will would should what which who whom whose when where why how about tell please give any some more not no yes there here from by as'.split(' '));
const STOP_BN = new Set('এই সেই একটা একটি কি কী কে কেন কীভাবে কিভাবে কোন কোনো আমি আমার তুমি তোমার আপনি আপনার সে তার আমরা তারা করে করা হয় হয়ে হবে আছে আছেন নাকি এবং আর ও বা কিন্তু যে যা তো না হ্যাঁ জন্য থেকে সাথে সঙ্গে বলো বলুন দাও দিন একটু আরও'.split(' '));

const BN_SUFFIX = ['গুলোর', 'গুলো', 'গুলি', 'দের', 'েরা', 'ের', 'কে', 'রা', 'টা', 'টি', 'তে', 'ায়', 'য়', 'ে', 'র'];
function stemBn(w) {
  for (const s of BN_SUFFIX) if (w.length > s.length + 2 && w.endsWith(s)) return w.slice(0, -s.length);
  return w;
}
function stemEn(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  return w;
}
// content words of a text (stop words dropped, light stemming for English and Bengali)
export function tokens(text) {
  return norm(text).split(' ').filter(Boolean).map((w) => (/[ঀ-৿]/.test(w) ? (STOP_BN.has(w) ? '' : stemBn(w)) : (STOP_EN.has(w) ? '' : stemEn(w)))).filter((w) => w.length > 1 || /\d/.test(w));
}

// ---- 32-bit FNV-1a and a 64-bit simhash (hex string) for near-duplicate detection without storing any text
export function fnv(str, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
export function simhash(text) {
  const words = norm(text).split(' ').filter(Boolean);
  const grams = words.length > 1 ? words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`) : words;
  const v = new Array(64).fill(0);
  for (const g of grams) {
    const hi = fnv(g), lo = fnv(g, 0x9747b28c);
    for (let b = 0; b < 32; b++) { v[b] += (hi >>> b) & 1 ? 1 : -1; v[32 + b] += (lo >>> b) & 1 ? 1 : -1; }
  }
  let hi = 0, lo = 0;
  for (let b = 0; b < 32; b++) { if (v[b] > 0) hi |= 1 << b; if (v[32 + b] > 0) lo |= 1 << b; }
  return (hi >>> 0).toString(16).padStart(8, '0') + (lo >>> 0).toString(16).padStart(8, '0');
}
export function hamming(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== 16 || b.length !== 16) return 64;
  let d = 0;
  for (const [x, y] of [[a.slice(0, 8), b.slice(0, 8)], [a.slice(8), b.slice(8)]]) {
    let n = (parseInt(x, 16) ^ parseInt(y, 16)) >>> 0;
    while (n) { d += n & 1; n >>>= 1; }
  }
  return d;
}
// "near duplicate" = 64-bit simhash within 6 bits of a known one
export const nearDuplicate = (fp, list) => (list || []).some((x) => hamming(fp, x) <= 6);

// ---- deterministic random numbers (so a scheduled decision does not flip when the job is re-run in the same hour)
export function seeded(seedText) {
  let a = fnv(String(seedText));
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = (arr, rand = Math.random) => arr[Math.floor(rand() * arr.length)];

// Asia/Dhaka calendar day and hour (the platform's timezone)
export function dhaka(date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const g = (t) => p.find((x) => x.type === t).value;
  return { day: `${g('year')}-${g('month')}-${g('day')}`, hour: Number(g('hour')) };
}
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
