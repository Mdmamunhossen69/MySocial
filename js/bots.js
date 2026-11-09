// AI bot accounts: 20 clearly-labelled bot profiles stored in Firestore (users/bot_01 .. bot_20).
// Bots have NO Firebase Auth login. Only a signed-in admin can create them or post / comment as them;
// firestore.rules enforces that (and forbids video posts). No credentials live in this repo.
import {
  db, doc, getDoc, setDoc, addDoc, updateDoc, collection, query, where, orderBy, limit, getDocs,
  writeBatch, serverTimestamp, increment
} from './firebase.js';
import { DEFAULT_SETTINGS } from './auth.js';
import { $, esc, avatarHtml, toast, errMsg, resizeImage, invalidateUser } from './utils.js';
import { BOTS, BOT_COMMENTS, isBotId, botAvatar } from './bots-data.js';

// ---------------------------------------------------------------- firestore actions (admin only; rules enforce it)
export async function seedBots() {
  const snaps = await Promise.all(BOTS.map((b) => getDoc(doc(db, 'users', b.id))));
  const batch = writeBatch(db);
  let created = 0;
  BOTS.forEach((b, i) => {
    const data = {
      name: b.name,
      nameLower: b.name.toLowerCase(),
      bio: b.bio,
      photo: botAvatar(i),
      cover: '',
      banned: false,
      isBot: true,
      settings: { ...DEFAULT_SETTINGS }
    };
    if (!snaps[i].exists()) { data.createdAt = serverTimestamp(); created++; }
    batch.set(doc(db, 'users', b.id), data, { merge: true });
    invalidateUser(b.id);
  });
  await batch.commit();
  return { created, updated: BOTS.length - created };
}

export async function listBots() {
  const snap = await getDocs(query(collection(db, 'users'), where('isBot', '==', true), limit(50)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id));
}

export async function postAsBot(botId, text, image = '') {
  const bot = BOTS.find((b) => b.id === botId);
  if (!bot) throw new Error('Unknown bot.');
  const clean = String(text || '').trim();
  if (!clean && !image) throw new Error('Write something or add a photo.');
  return addDoc(collection(db, 'posts'), {
    uid: bot.id,
    authorName: bot.name,
    text: clean.slice(0, 5000),
    image: image || '',
    videoUrl: '', // bots never post videos (rules also enforce this)
    visibility: 'public',
    audience: [],
    groupId: null,
    sharedFrom: null,
    reactions: {},
    commentCount: 0,
    shareCount: 0,
    createdAt: serverTimestamp()
  });
}

export async function commentAsBot(botId, postId, text) {
  const bot = BOTS.find((b) => b.id === botId);
  if (!bot) throw new Error('Unknown bot.');
  const clean = String(text || '').trim();
  if (!clean) throw new Error('Write a comment first.');
  await addDoc(collection(db, 'posts', postId, 'comments'), {
    uid: bot.id, authorName: bot.name, text: clean.slice(0, 2000), createdAt: serverTimestamp()
  });
  await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });
}

// ---------------------------------------------------------------- activity round
const USED_KEY = 'mysocial-bot-used';
function loadUsed() { try { return JSON.parse(localStorage.getItem(USED_KEY) || '{}'); } catch { return {}; } }
function saveUsed(u) { try { localStorage.setItem(USED_KEY, JSON.stringify(u)); } catch { /* storage blocked */ } }
const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Each bot cycles through its own post ideas before repeating any.
function nextText(bot, used) {
  let seen = used[bot.id] || [];
  let free = bot.posts.map((_, i) => i).filter((i) => !seen.includes(i));
  if (!free.length) { seen = []; free = bot.posts.map((_, i) => i); }
  const i = pick(free);
  used[bot.id] = [...seen, i];
  return bot.posts[i];
}

export async function runRound({ posts = 5, comments = 8, commentOn = 'bots', onProgress = () => {} } = {}) {
  const used = loadUsed();
  const result = { posts: 0, comments: 0 };
  const authors = shuffle(BOTS).slice(0, Math.min(posts, BOTS.length));
  for (const bot of authors) {
    await postAsBot(bot.id, nextText(bot, used));
    result.posts++;
    onProgress(`Posted ${result.posts} of ${authors.length}…`);
  }
  saveUsed(used);

  if (comments > 0) {
    const snap = await getDocs(query(collection(db, 'posts'), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), limit(30)));
    let targets = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => !p.groupId && !p.sharedFrom);
    if (commentOn === 'bots') targets = targets.filter((p) => isBotId(p.uid));
    targets = shuffle(targets);
    const done = new Set();
    for (let n = 0; n < comments && targets.length; n++) {
      let placed = false;
      for (const post of targets) {
        const bot = shuffle(BOTS).find((b) => b.id !== post.uid && !done.has(`${post.id}:${b.id}`));
        if (!bot) continue;
        done.add(`${post.id}:${bot.id}`);
        await commentAsBot(bot.id, post.id, pick(BOT_COMMENTS));
        result.comments++;
        placed = true;
        onProgress(`Commented ${result.comments} of ${comments}…`);
        break;
      }
      if (!placed) break;
    }
  }
  return result;
}

// ---------------------------------------------------------------- admin UI
export async function drawBots(pane) {
  pane.innerHTML = '<div class="loading">Loading…</div>';
  let existing = [];
  try { existing = await listBots(); } catch (e) { pane.innerHTML = `<div class="notice notice-error">${esc(errMsg(e))}</div>`; return; }
  const have = new Set(existing.map((b) => b.id));
  const botOptions = BOTS.map((b) => `<option value="${b.id}" ${have.has(b.id) ? '' : 'disabled'}>${esc(b.name)}${have.has(b.id) ? '' : ' (not created yet)'}</option>`).join('');

  pane.innerHTML = `
  <section class="card pad">
    <h3>AI bot accounts</h3>
    <p class="muted">${existing.length} of ${BOTS.length} bots exist. Bots are labelled "AI Bot" everywhere, cannot log in, cannot post videos, and only an admin can make them post or comment.</p>
    <button class="btn btn-primary" data-bot-act="seed">${existing.length ? 'Update the 20 bots' : 'Create the 20 bots'}</button>
    <div class="bot-grid">${existing.map((b) => `<a class="bot-chip" href="#/profile/${esc(b.id)}">${avatarHtml(b.name, b.photo, 36)}<span>${esc(b.name)}</span></a>`).join('')}</div>
  </section>

  <section class="card pad">
    <h3>Run an activity round</h3>
    <p class="muted small">Random bots publish their next post idea, then leave short comments. Free-tier tip: keep rounds small and do not run them too often.</p>
    <div class="row gap wrap">
      <label class="small">Posts <input type="number" id="rd-posts" min="0" max="20" value="5" style="width:80px"></label>
      <label class="small">Comments <input type="number" id="rd-comments" min="0" max="20" value="8" style="width:80px"></label>
      <label class="small">Comment on
        <select id="rd-on" style="width:auto"><option value="bots">Bot posts only</option><option value="all">All recent public posts</option></select></label>
    </div>
    <p><button class="btn btn-primary" data-bot-act="round" ${existing.length ? '' : 'disabled'}>Run round</button> <span class="muted small" id="rd-status"></span></p>
  </section>

  <section class="card pad">
    <h3>Post as a bot</h3>
    <div class="field"><label for="bp-bot">Bot</label><select id="bp-bot">${botOptions}</select></div>
    <div class="field"><label for="bp-text">Text</label><textarea id="bp-text" rows="3" maxlength="1000"></textarea></div>
    <div class="row gap wrap"><label class="btn">Add photo<input type="file" id="bp-photo" accept="image/*" hidden></label>
      <span class="muted small" id="bp-photo-name">No video: bots can only post text and photos.</span></div>
    <p><button class="btn btn-primary" data-bot-act="post" ${existing.length ? '' : 'disabled'}>Publish</button></p>
  </section>

  <section class="card pad">
    <h3>Comment as a bot</h3>
    <div class="field"><label for="bc-bot">Bot</label><select id="bc-bot">${botOptions}</select></div>
    <div class="field"><label for="bc-post">Post link or ID</label><input id="bc-post" placeholder="https://…/#/post/POST_ID"></div>
    <div class="field"><label for="bc-text">Comment</label><input id="bc-text" maxlength="300"></div>
    <button class="btn btn-primary" data-bot-act="comment" ${existing.length ? '' : 'disabled'}>Send comment</button>
  </section>`;

  let photo = '';
  $('#bp-photo', pane).addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { photo = await resizeImage(f, 900, 0.72); $('#bp-photo-name', pane).textContent = 'Photo added.'; } catch (err) { toast(err.message, 'error'); }
  });

  // Listen on a fresh wrapper so redrawing the tab never stacks duplicate handlers on `pane`.
  const root = document.createElement('div');
  root.append(...pane.childNodes);
  pane.append(root);
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-bot-act]');
    if (!b) return;
    b.disabled = true;
    try {
      switch (b.dataset.botAct) {
        case 'seed': {
          const r = await seedBots();
          toast(`Bots ready: ${r.created} created, ${r.updated} updated.`, 'success');
          await drawBots(pane);
          return;
        }
        case 'round': {
          const status = $('#rd-status', pane);
          const r = await runRound({
            posts: Math.max(0, Math.min(20, Number($('#rd-posts', pane).value) || 0)),
            comments: Math.max(0, Math.min(20, Number($('#rd-comments', pane).value) || 0)),
            commentOn: $('#rd-on', pane).value,
            onProgress: (t) => { status.textContent = t; }
          });
          status.textContent = `Done: ${r.posts} posts, ${r.comments} comments.`;
          toast(status.textContent, 'success');
          break;
        }
        case 'post':
          await postAsBot($('#bp-bot', pane).value, $('#bp-text', pane).value, photo);
          $('#bp-text', pane).value = ''; photo = ''; $('#bp-photo-name', pane).textContent = 'Posted. No video: bots can only post text and photos.';
          toast('Posted as bot', 'success');
          break;
        case 'comment': {
          const raw = $('#bc-post', pane).value.trim();
          const id = (raw.match(/#\/post\/([\w-]+)/) || [])[1] || (/^[\w-]{10,}$/.test(raw) ? raw : '');
          if (!id) throw new Error('Paste a post link (…#/post/ID) or the post ID.');
          const p = await getDoc(doc(db, 'posts', id));
          if (!p.exists()) throw new Error('That post does not exist.');
          await commentAsBot($('#bc-bot', pane).value, id, $('#bc-text', pane).value);
          $('#bc-text', pane).value = '';
          toast('Comment added', 'success');
          break;
        }
        default: break;
      }
    } catch (err) { toast(errMsg(err), 'error', 7000); }
    b.disabled = false;
  });
}
