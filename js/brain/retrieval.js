// Knowledge retrieval: a small TF-IDF style matcher over a bot's own knowledge base (English + Bengali).
// It only returns entries that really match. Below the confidence line the bot says it does not know.
import { tokens } from './util.js';

export const CONFIDENT = 6;   // a title/keyword hit or a phrase match
export const NEAR = 3.5;      // something related, good enough to offer as "did you mean"

export function buildIndex(entries) {
  const docs = entries.map((e) => {
    const single = new Set(); const multi = [];
    for (const k of [...(e.keys || []), e.title.en, e.title.bn]) {
      const t = [...new Set(tokens(k))];
      if (t.length === 1) single.add(t[0]);   // a one-word key is specific enough on its own
      else if (t.length >= 2) multi.push(t);                                              // a phrase counts only when ALL its words are present
    }
    return { e, single, multi, body: new Set(tokens(`${e.title.en} ${e.title.bn} ${e.en} ${e.bn}`)) };
  });
  const df = new Map();
  docs.forEach((d) => new Set([...d.single, ...d.body]).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const idf = (t) => Math.log(1 + docs.length / (1 + (df.get(t) || 0)));
  return { docs, idf };
}

export function search(index, text, limit = 3) {
  const q = new Set(tokens(text));
  const out = [];
  for (const d of index.docs) {
    let s = 0; let hits = 0;
    for (const t of q) {
      if (d.single.has(t)) { s += 3 * index.idf(t); hits++; }
      else if (d.body.has(t)) { s += index.idf(t); hits++; }
    }
    let best = 0;
    for (const ph of d.multi) if (ph.every((t) => q.has(t))) best = Math.max(best, 6 + ph.length * 0.5);
    // the whole question is just one of this entry's keywords ("tell me about the Moon"): a direct hit
    if (q.size && q.size <= 2 && [...q].every((t) => d.single.has(t))) best = Math.max(best, 6.5);
    s += best;
    if (s > 0) out.push({ entry: d.e, score: Math.round(s * 100) / 100, hits });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
