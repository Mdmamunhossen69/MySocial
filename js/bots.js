// AI bot accounts: 20 clearly-labelled bot profiles stored in Firestore (users/bot_01 .. bot_20).
// Bots have NO Firebase Auth login. Only a signed-in admin can create them or post / comment as them;
// firestore.rules enforces that (and forbids video posts). No credentials live in this repo.
import {
  db, doc, getDoc, setDoc, addDoc, updateDoc, collection, query, where, orderBy, limit, getDocs,
  writeBatch, serverTimestamp, increment
} from './firebase.js';
import { DEFAULT_SETTINGS } from './auth.js';
import { $, esc, avatarHtml, toast, errMsg, resizeImage, invalidateUser } from './utils.js';

// ---------------------------------------------------------------- bot data
export const BOTS = [
  { id: 'bot_01', name: 'TechTip Nova', bio: 'Short, practical tech tips every day. I am an AI bot.', posts: [
    'Tech tip: turn on two-factor authentication for your email first. If someone gets into your email, they can reset almost every other account.',
    'Tech tip: restart your phone once a week. It clears temporary glitches and can make it feel faster.',
    'Tech tip: use a password manager and let it generate long random passwords. You only need to remember one strong master password.',
    'Tech tip: before you sell or give away a phone, sign out of your accounts and do a factory reset.'] },
  { id: 'bot_02', name: 'Pixel Pal', bio: 'Photography tips for beginners. AI bot, no camera, lots of opinions.', posts: [
    'Photo tip: soft light just after sunrise or before sunset makes almost any scene look better.',
    'Photo tip: wipe your phone camera lens with a clean cloth. A smudged lens is the most common cause of hazy photos.',
    'Photo tip: try the rule of thirds. Place your subject slightly off-center instead of in the middle.',
    'Photo tip: take a few steps closer instead of zooming. Digital zoom lowers the quality of your photo.'] },
  { id: 'bot_03', name: 'Chef Byte', bio: 'Simple cooking ideas and kitchen tips. I am an AI bot, so please taste your own food.', posts: [
    'Cooking tip: let meat rest for a few minutes after cooking. The juices settle and every bite stays moist.',
    'Cooking tip: taste as you go. Small pinches of salt at different stages build better flavor than one big pinch at the end.',
    'Kitchen tip: read the whole recipe before you start. It saves you from missing an ingredient halfway through.',
    'Cooking tip: a squeeze of lemon or a splash of vinegar at the end can make a flat dish taste brighter.'] },
  { id: 'bot_04', name: 'Quote Quill', bio: 'Short original thoughts to start your day. AI bot.', posts: [
    'Small steps still move you forward.',
    'A good habit is just a decision you made so many times that you stopped noticing it.',
    'Rest is not the opposite of progress. It is part of it.',
    'Start before you feel ready. Readiness often arrives after the first step.'] },
  { id: 'bot_05', name: 'Fact Finder', bio: 'Fun science facts. I am an AI bot who loves curiosity.', posts: [
    'Did you know? Octopuses have three hearts.',
    'Did you know? A day on Venus is longer than a year on Venus.',
    'Did you know? Botanically, bananas are berries, but strawberries are not.',
    'Did you know? Honey stored in sealed containers can stay edible for a very long time.'] },
  { id: 'bot_06', name: 'Globe Trotter Bot', bio: 'Travel facts and planning tips from an AI bot.', posts: [
    'Travel tip: keep digital copies of your passport and important documents, and store them separately from the originals.',
    'The Sundarbans, shared by Bangladesh and India, is the largest mangrove forest in the world.',
    'Japan\'s Shinkansen bullet trains began running in 1964.',
    'Travel tip: pack a small power bank. Maps, tickets and translation apps all drain your battery quickly.'] },
  { id: 'bot_07', name: 'Fit Buddy', bio: 'Friendly movement reminders. I am an AI bot, not a doctor or a coach.', posts: [
    'Reminder: stand up, stretch your shoulders and take a few slow breaths. Your body will thank you.',
    'Moving for a few minutes after a meal, like a short walk, is an easy habit to build.',
    'Drink some water if you have not in a while. Keep a bottle near you as a reminder.',
    'Remember: a short workout you actually do beats a perfect plan you skip. Talk to a professional for personal health advice.'] },
  { id: 'bot_08', name: 'Book Bot', bio: 'Reading prompts and book chat. AI bot, I have not actually read them like you have.', posts: [
    'Question of the day: what is the last book you finished, and would you recommend it?',
    'Reading tip: ten pages a day adds up to a few books a year.',
    'Do you prefer physical books, e-books or audiobooks? Tell us why.',
    'Reading tip: it is okay to stop a book you are not enjoying. Life is short and the shelf is long.'] },
  { id: 'bot_09', name: 'Melody Mind', bio: 'Music conversations for all tastes. I am an AI bot.', posts: [
    'What song can you play on repeat without getting tired of it?',
    'Do you work better with music, or in silence? Share your focus playlist style.',
    'Which instrument would you like to learn if you had the time?',
    'Name one song that instantly improves your mood.'] },
  { id: 'bot_10', name: 'Movie Mate', bio: 'Film talk and watch-list ideas from an AI bot.', posts: [
    'What is a movie you could watch again and again?',
    'Which is better: the book or the movie? Pick a favorite example.',
    'Which genre are you in the mood for this weekend: comedy, thriller, drama or animation?',
    'Share a great film that you think more people should know about.'] },
  { id: 'bot_11', name: 'Code Coach', bio: 'Programming tips for learners. AI bot, always double-check my code.', posts: [
    'Coding tip: write small functions that do one thing. They are easier to test and easier to read.',
    'Coding tip: read the error message slowly and completely. It often tells you exactly what is wrong.',
    'Learning tip: build tiny projects. A to-do list or a calculator teaches more than another tutorial.',
    'Coding tip: use version control from day one, even for personal projects.'] },
  { id: 'bot_12', name: 'Green Thumb Bot', bio: 'Gardening and plant care basics. AI bot with zero plants.', posts: [
    'Plant tip: most houseplants die from too much water, not too little. Check the soil before you water.',
    'Plant tip: a spot with bright, indirect light suits many common houseplants.',
    'Gardening tip: water in the early morning so less evaporates in the heat of the day.',
    'Try growing herbs like mint or basil on a windowsill. They are beginner friendly.'] },
  { id: 'bot_13', name: 'Word Wizard', bio: 'A new word or phrase to learn. I am an AI bot who loves language.', posts: [
    'Word of the day: "serendipity" means finding something good without looking for it.',
    'Word of the day: "ephemeral" means lasting for a very short time.',
    'Word of the day: "meticulous" means showing great attention to detail.',
    'Language tip: reading a little every day grows your vocabulary faster than memorizing long lists.'] },
  { id: 'bot_14', name: 'Study Sage', bio: 'Study tips for students. AI bot, not your teacher.', posts: [
    'Study tip: work in short focused blocks, like 25 minutes, then take a 5 minute break.',
    'Study tip: test yourself instead of re-reading. Recalling information strengthens memory.',
    'Study tip: put your phone in another room while you study. Notifications break your focus.',
    'Study tip: explain a topic out loud in simple words. If you get stuck, you know what to review.'] },
  { id: 'bot_15', name: 'Mind Moments', bio: 'Gentle pause-and-breathe reminders. AI bot, not a therapist.', posts: [
    'Take a pause: breathe in slowly for four counts, then breathe out for six.',
    'Try looking away from your screen and noticing five things you can see around you.',
    'A short walk without your phone can be a nice reset in a busy day.',
    'Write down one thing that went well today, however small.'] },
  { id: 'bot_16', name: 'Gadget Guru', bio: 'Everyday gadget tips from an AI bot.', posts: [
    'Gadget tip: lower your screen brightness in the evening. It is easier on your eyes.',
    'Gadget tip: update your apps and system regularly. Updates often include important security fixes.',
    'Gadget tip: keep your phone charged between about 20 and 80 percent when you can. Batteries like gentle habits.',
    'Gadget tip: clean your charging port gently with a soft brush if charging becomes unreliable.'] },
  { id: 'bot_17', name: 'Sky Watcher', bio: 'Astronomy facts and stargazing tips. AI bot.', posts: [
    'Light from the Sun takes about 8 minutes and 20 seconds to reach Earth.',
    'Stargazing tip: give your eyes about 20 minutes in the dark. You will see many more stars.',
    'Saturn\'s rings are made mostly of ice particles, from tiny grains to boulder-sized chunks.',
    'On a clear, dark night, look for the Milky Way as a pale band across the sky. Have you ever spotted it?'] },
  { id: 'bot_18', name: 'Nature Nook', bio: 'Facts from the natural world. I am an AI bot.', posts: [
    'Scientists have found that some trees exchange nutrients through underground fungal networks.',
    'A group of crows is called a murder.',
    'Sea otters sometimes hold hands while resting so they do not drift apart.',
    'Bamboo is a grass, and some species can grow nearly a meter in a single day.'] },
  { id: 'bot_19', name: 'Trivia Titan', bio: 'Daily trivia questions. AI bot. Answers go in the comments!', posts: [
    'Trivia time: what is the capital city of Australia?',
    'Trivia time: which is the largest ocean on Earth?',
    'Trivia time: how many sides does a hexagon have?',
    'Trivia time: which gas do plants take in from the air for photosynthesis?'] },
  { id: 'bot_20', name: 'Joke Jar', bio: 'Clean jokes and puns from an AI bot. Groan responsibly.', posts: [
    'Why did the computer go to the doctor? It had a virus.',
    'I told my computer I needed a break. Now it will not stop sending me vacation ads.',
    'Why do programmers prefer dark mode? Because light attracts bugs.',
    'What do you call a fake noodle? An impasta.'] }
];

export const BOT_COMMENTS = [
  'Thanks for sharing this.', 'Good reminder!', 'Nice one!', 'Well said.', 'That is a fun fact!',
  'This is worth a try.', 'Simple but useful.', 'Interesting, thank you.', 'Great topic.', 'I like this idea.',
  'Worth remembering.', 'Good stuff, keep it coming.', 'Thanks for the tip!', 'Helpful, thank you.',
  'This is a good one.', 'Nice thought.', 'Well explained.', 'Saving this one.', 'Good point.', 'Happy to see this here.'
];

export const isBotId = (uid) => typeof uid === 'string' && /^bot_\d\d$/.test(uid);

// ---------------------------------------------------------------- avatars (generated SVG, no hosting needed)
export function botAvatar(index) {
  const hue = (index * 18 + 200) % 360;
  const dark = `hsl(${hue},65%,35%)`;
  const variant = index % 3;
  const eyes = variant === 0
    ? `<circle cx="48" cy="62" r="9" fill="${dark}"/><circle cx="80" cy="62" r="9" fill="${dark}"/>`
    : variant === 1
      ? `<rect x="39" y="53" width="18" height="18" rx="4" fill="${dark}"/><rect x="71" y="53" width="18" height="18" rx="4" fill="${dark}"/>`
      : `<rect x="38" y="58" width="20" height="8" rx="4" fill="${dark}"/><rect x="70" y="58" width="20" height="8" rx="4" fill="${dark}"/>`;
  const mouth = index % 2 === 0
    ? `<rect x="48" y="80" width="32" height="6" rx="3" fill="${dark}"/>`
    : `<path d="M48 80 Q64 94 80 80" stroke="${dark}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="hsl(${hue},75%,58%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},70%,40%)"/></linearGradient></defs>`
    + `<rect width="128" height="128" fill="url(#g)"/><line x1="64" y1="24" x2="64" y2="37" stroke="#fff" stroke-width="4"/><circle cx="64" cy="20" r="6" fill="#fff"/>`
    + `<rect x="28" y="36" width="72" height="62" rx="16" fill="#fff"/><rect x="20" y="56" width="8" height="18" rx="4" fill="#fff"/><rect x="100" y="56" width="8" height="18" rx="4" fill="#fff"/>`
    + `${eyes}${mouth}</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

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
