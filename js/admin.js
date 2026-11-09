// Admin dashboard. Access is decided by Firestore rules (/admins/{uid}); this UI only hides itself.
import {
  db, collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit, getCountFromServer, serverTimestamp
} from './firebase.js';
import { state } from './state.js';
import { drawBots } from './bots.js';
import {
  $, $$, esc, avatarHtml, getUser, timeAgo, toast, errMsg, emptyState, errorBox, confirmBox, debounce, linkify
} from './utils.js';

async function count(q) {
  try { return (await getCountFromServer(q)).data().count; } catch { return '—'; }
}

export async function render(view) {
  if (!state.isAdmin) {
    view.innerHTML = emptyState('Admins only', 'Your account is not listed in the admins collection.');
    return;
  }
  view.innerHTML = `<h2 class="page-title">Admin dashboard</h2>
    <div class="tabs"><button class="tab active" data-tab="overview">Overview</button><button class="tab" data-tab="reports">Reports</button><button class="tab" data-tab="users">Users</button><button class="tab" data-tab="bots">AI Bots</button></div>
    <div data-pane></div>`;
  const pane = $('[data-pane]', view);
  let tab = 'overview';
  $$('.tab', view).forEach((t) => t.addEventListener('click', () => {
    tab = t.dataset.tab;
    $$('.tab', view).forEach((x) => x.classList.toggle('active', x === t));
    draw();
  }));

  async function draw() {
    const mine = tab;
    pane.innerHTML = '<div class="loading">Loading…</div>';
    try {
      if (mine === 'overview') await drawOverview();
      else if (mine === 'reports') await drawReports();
      else if (mine === 'users') await drawUsers();
      else await drawBots(pane);
    } catch (e) { if (tab === mine) pane.innerHTML = errorBox(e); }
  }

  async function drawOverview() {
    const [users, posts, reels, groups, open] = await Promise.all([
      count(collection(db, 'users')), count(collection(db, 'posts')), count(collection(db, 'reels')),
      count(collection(db, 'groups')), count(query(collection(db, 'reports'), where('status', '==', 'open')))
    ]);
    const stat = (label, n) => `<div class="card stat"><div class="stat-n">${n}</div><div class="muted">${label}</div></div>`;
    pane.innerHTML = `<div class="stats">${stat('Users', users)}${stat('Posts', posts)}${stat('Reels', reels)}${stat('Groups', groups)}${stat('Open reports', open)}</div>
      <p class="muted small">Counts use Firestore aggregation queries (1 read per 1,000 documents counted).</p>`;
  }

  async function drawReports() {
    const snap = await getDocs(query(collection(db, 'reports'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(30)));
    const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!reports.length) { pane.innerHTML = emptyState('No open reports 🎉'); return; }
    const rows = await Promise.all(reports.map(async (r) => {
      const col = r.kind === 'reel' ? 'reels' : 'posts';
      const target = await getDoc(doc(db, col, r.targetId)).catch(() => null);
      const t = target && target.exists() ? target.data() : null;
      const reporter = await getUser(r.reporterUid);
      const author = r.targetUid ? await getUser(r.targetUid) : null;
      return `<div class="card pad report" data-id="${esc(r.id)}" data-kind="${esc(r.kind)}" data-target="${esc(r.targetId)}" data-author="${esc(r.targetUid || '')}">
        <div class="row between wrap"><b>${esc(r.reason)}</b><span class="muted small">${timeAgo(r.createdAt)} · ${esc(r.kind)} reported by ${esc(reporter.name)}</span></div>
        ${r.details ? `<p>${esc(r.details)}</p>` : ''}
        <div class="reported">${t ? `<div class="muted small">By ${esc(author?.name || '')}</div>
          ${t.text || t.caption ? `<div>${linkify(t.text || t.caption)}</div>` : ''}${t.image ? `<img class="thumb" src="${esc(t.image)}" alt="">` : ''}${t.videoUrl ? `<div class="muted small">Video: ${esc(t.videoUrl)}</div>` : ''}`
          : '<div class="muted">Content no longer exists.</div>'}</div>
        <div class="row gap wrap">
          ${t ? `<button class="btn btn-danger" data-act="delete">Delete content</button>` : ''}
          ${author ? `<button class="btn" data-act="ban">Suspend author</button>` : ''}
          <button class="btn" data-act="dismiss">Dismiss report</button>
        </div></div>`;
    }));
    pane.innerHTML = rows.join('');
  }

  async function drawUsers() {
    pane.innerHTML = `<div class="field"><input type="search" id="ad-q" placeholder="Search users by name" aria-label="Search users"></div><div data-results></div>`;
    const input = $('#ad-q', pane);
    const results = $('[data-results]', pane);
    async function run() {
      const q = input.value.trim().toLowerCase();
      results.innerHTML = '<div class="loading">Loading…</div>';
      try {
        const base = collection(db, 'users');
        const snap = q.length >= 2
          ? await getDocs(query(base, where('nameLower', '>=', q), where('nameLower', '<=', q + ''), limit(25)))
          : await getDocs(query(base, orderBy('nameLower'), limit(25)));
        results.innerHTML = snap.docs.length ? snap.docs.map((d) => {
          const u = d.data();
          return `<div class="person" data-uid="${esc(d.id)}">${avatarHtml(u.name, u.photo, 44)}
            <div class="grow"><a class="author" href="#/profile/${esc(d.id)}">${esc(u.name)}</a>${u.banned ? ' <span class="tag danger">Suspended</span>' : ''}<div class="muted small">${esc(d.id)}</div></div>
            ${d.id === state.user.uid ? '' : `<button class="btn ${u.banned ? '' : 'btn-danger'}" data-act="${u.banned ? 'unban' : 'ban'}">${u.banned ? 'Restore' : 'Suspend'}</button>`}</div>`;
        }).join('') : emptyState('No users found');
      } catch (e) { results.innerHTML = errorBox(e); }
    }
    input.addEventListener('input', debounce(run, 350));
    run();
  }

  pane.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const report = b.closest('.report');
    const person = b.closest('.person');
    b.disabled = true;
    try {
      switch (b.dataset.act) {
        case 'delete':
          if (!(await confirmBox('Delete the reported content?', 'Delete'))) { b.disabled = false; return; }
          await deleteDoc(doc(db, report.dataset.kind === 'reel' ? 'reels' : 'posts', report.dataset.target));
          await resolve(report, 'deleted'); break;
        case 'dismiss': await resolve(report, 'dismissed'); break;
        case 'ban':
        case 'unban': {
          const uid = report ? report.dataset.author : person.dataset.uid;
          const ban = b.dataset.act === 'ban';
          if (ban && !(await confirmBox('Suspend this user? They are signed out and cannot post.', 'Suspend'))) { b.disabled = false; return; }
          await updateDoc(doc(db, 'users', uid), { banned: ban });
          toast(ban ? 'User suspended' : 'User restored', 'success');
          if (person) { draw(); }
          else b.remove();
          break;
        }
        default: break;
      }
    } catch (err) { toast(errMsg(err), 'error'); b.disabled = false; }
  });

  async function resolve(card, action) {
    await updateDoc(doc(db, 'reports', card.dataset.id), {
      status: 'resolved', action, resolvedBy: state.user.uid, resolvedAt: serverTimestamp()
    });
    card.remove();
    toast('Report resolved', 'success');
  }

  await draw();
}
