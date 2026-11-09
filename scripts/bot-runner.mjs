// Scheduled job (GitHub Actions): makes the AI bots post and comment on their own.
//
// Security model
//  * No Admin SDK / service-account key. The job signs in as a normal Firebase Auth user (the
//    "bot runner") with email + password taken from GitHub Secrets, then talks to Firestore's REST API.
//  * Firestore rules decide what that user may do: only write posts/comments AS an AI bot
//    (public, never a video) and bump commentCount. It cannot touch real users' data.
//  * The password is never in the repository. The Firebase web API key is public by design.
//
// Env: BOT_RUNNER_EMAIL, BOT_RUNNER_PASSWORD (secrets), BOT_POSTS, BOT_COMMENTS (optional numbers),
//      DRY_RUN=1 (print what would happen), AUTH_URL / FS_URL (override endpoints, used for tests).
import { BOTS, BOT_COMMENTS, isBotId } from '../js/bots-data.js';
import { firebaseConfig } from '../js/firebase-config.js';

const EMAIL = process.env.BOT_RUNNER_EMAIL;
const PASSWORD = process.env.BOT_RUNNER_PASSWORD;
const AUTH_URL = process.env.AUTH_URL || 'https://identitytoolkit.googleapis.com';
const FS_URL = process.env.FS_URL || 'https://firestore.googleapis.com';
const DRY = process.env.DRY_RUN === '1';

if (!EMAIL || !PASSWORD) {
  console.log('Bot runner is not configured (BOT_RUNNER_EMAIL / BOT_RUNNER_PASSWORD secrets are missing). Nothing to do.');
  process.exit(0);
}
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('js/firebase-config.js is missing apiKey or projectId.');
  process.exit(1);
}

const PID = firebaseConfig.projectId;
const DOCS = `projects/${PID}/databases/(default)/documents`;
const BASE = `${FS_URL}/v1/${DOCS}`;

const rand = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rand(a.length)];
const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = rand(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? Math.min(n, 10) : d; };

// ------------------------------------------------------------ REST helpers
let token = '';

async function api(url, { method = 'GET', body, allow404 = false } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (allow404 && res.status === 404) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.replace(/\?key=.*/, '')} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

async function signIn() {
  const r = await api(`${AUTH_URL}/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
    method: 'POST', body: { email: EMAIL, password: PASSWORD, returnSecureToken: true }
  });
  token = r.idToken;
  console.log('Signed in as the bot runner.');
}

const S = (v) => ({ stringValue: String(v) });
const T = (d = new Date()) => ({ timestampValue: d.toISOString() });
const docId = (name) => name.split('/').pop();
const str = (f) => (f && f.stringValue) || '';

// ------------------------------------------------------------ state (which ideas / posts were used)
async function loadState() {
  const d = await api(`${BASE}/botState/runner`, { allow404: true });
  const fields = (d && d.fields) || {};
  const parse = (k, fb) => { try { return JSON.parse(str(fields[k]) || ''); } catch { return fb; } };
  return { used: parse('used', {}), commented: parse('commented', []) };
}

async function saveState(st) {
  const qs = ['used', 'commented', 'updatedAt'].map((f) => `updateMask.fieldPaths=${f}`).join('&');
  await api(`${BASE}/botState/runner?${qs}`, {
    method: 'PATCH',
    body: { fields: { used: S(JSON.stringify(st.used)), commented: S(JSON.stringify(st.commented.slice(-400))), updatedAt: T() } }
  });
}

// each bot walks through all of its post ideas before any is repeated
function nextText(bot, st) {
  let seen = st.used[bot.id] || [];
  let free = bot.posts.map((_, i) => i).filter((i) => !seen.includes(i));
  if (!free.length) { seen = []; free = bot.posts.map((_, i) => i); }
  const i = pick(free);
  st.used[bot.id] = [...seen, i];
  return bot.posts[i];
}

// ------------------------------------------------------------ actions
async function createPost(bot, text) {
  const body = {
    fields: {
      uid: S(bot.id), authorName: S(bot.name), text: S(text), image: S(''),
      videoUrl: S(''), // bots never post video (rules enforce this too)
      visibility: S('public'),
      audience: { arrayValue: {} },
      groupId: { nullValue: null }, sharedFrom: { nullValue: null },
      reactions: { mapValue: {} },
      commentCount: { integerValue: '0' }, shareCount: { integerValue: '0' },
      createdAt: T()
    }
  };
  if (DRY) { console.log(`[dry] post as ${bot.name}: ${text}`); return 'dry'; }
  const r = await api(`${BASE}/posts`, { method: 'POST', body });
  return docId(r.name);
}

async function createComment(bot, postId, text) {
  const body = { fields: { uid: S(bot.id), authorName: S(bot.name), text: S(text), createdAt: T() } };
  if (DRY) { console.log(`[dry] comment as ${bot.name} on ${postId}: ${text}`); return; }
  await api(`${BASE}/posts/${postId}/comments`, { method: 'POST', body });
  await api(`${FS_URL}/v1/${DOCS}:commit`, {
    method: 'POST',
    body: {
      writes: [{
        update: { name: `${DOCS}/posts/${postId}` },
        updateMask: { fieldPaths: [] },
        updateTransforms: [{ fieldPath: 'commentCount', increment: { integerValue: '1' } }],
        currentDocument: { exists: true }
      }]
    }
  });
}

async function recentPublicPosts() {
  const rows = await api(`${FS_URL}/v1/${DOCS}:runQuery`, {
    method: 'POST',
    body: {
      structuredQuery: {
        from: [{ collectionId: 'posts' }],
        where: { fieldFilter: { field: { fieldPath: 'visibility' }, op: 'EQUAL', value: S('public') } },
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: 30
      }
    }
  });
  return (Array.isArray(rows) ? rows : []).filter((r) => r.document).map((r) => ({
    id: docId(r.document.name),
    uid: str(r.document.fields.uid),
    comments: Number((r.document.fields.commentCount || {}).integerValue || 0),
    isGroup: !!(r.document.fields.groupId && r.document.fields.groupId.stringValue)
  }));
}

// ------------------------------------------------------------ main
async function main() {
  const nPosts = num(process.env.BOT_POSTS, 1 + rand(2));      // default: 1-2 posts per run
  const nComments = num(process.env.BOT_COMMENTS, 1 + rand(3)); // default: 1-3 comments per run
  console.log(`Plan: ${nPosts} post(s), ${nComments} comment(s)${DRY ? ' (dry run)' : ''}`);

  await signIn();
  const st = await loadState();

  let posted = 0;
  for (const bot of shuffle(BOTS).slice(0, nPosts)) {
    const text = nextText(bot, st);
    const id = await createPost(bot, text);
    console.log(`Posted as ${bot.name} (${id}): ${text.slice(0, 70)}`);
    posted++;
  }

  // Bots only comment on other bots' posts, never on real people's posts (that would be spam).
  let commented = 0;
  if (nComments > 0) {
    const targets = shuffle((await recentPublicPosts()).filter((p) => isBotId(p.uid) && !p.isGroup && p.comments < 6));
    for (const post of targets) {
      if (commented >= nComments) break;
      const bot = shuffle(BOTS).find((b) => b.id !== post.uid && !st.commented.includes(`${post.id}:${b.id}`));
      if (!bot) continue;
      await createComment(bot, post.id, pick(BOT_COMMENTS));
      st.commented.push(`${post.id}:${bot.id}`);
      console.log(`Commented as ${bot.name} on post ${post.id}`);
      commented++;
    }
  }

  if (!DRY) await saveState(st);
  console.log(`Done: ${posted} post(s), ${commented} comment(s).`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
