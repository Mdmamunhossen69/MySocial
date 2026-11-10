// Scheduled job (GitHub Actions): permanently deletes accounts that a SUPER ADMIN queued in
// /deletionRequests/{uid} (status "pending"). Runs with a Google service account (secret
// FIREBASE_SERVICE_ACCOUNT), which is why it can delete Firebase Auth users and bypass rules.
// The key lives only in GitHub Secrets: never in the website or the repository.
//
// Deleted: Auth user, users/{uid} (+saved), their posts (+comments), reels, stories, friend requests,
// friendships, follows, notifications (to/from), private chats (+messages), groups they alone belong to.
// Kept on purpose: comments they wrote on OTHER people's posts (finding them needs a collection-group
// index; they show "Deleted user"), reports, and staff audit logs.
// This app stores no files in Cloud Storage (images are inside Firestore docs), so nothing to delete there.
//
// Safety: refuses staff accounts and AI bots. Env: FIREBASE_SERVICE_ACCOUNT, DRY_RUN=1, FS_URL, IDT_URL, TOKEN_URL (tests).
import { createClient, eq, arrayContains } from './lib/firestore-rest.mjs';
import { parseServiceAccount, makeTokenGetter } from './lib/google-auth.mjs';

const RAW = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!RAW) { console.log('FIREBASE_SERVICE_ACCOUNT secret is not set. Nothing to do.'); process.exit(0); }
const DRY = process.env.DRY_RUN === '1';
const sa = parseServiceAccount(RAW);
const getToken = makeTokenGetter(sa);
const FS_URL = process.env.FS_URL || 'https://firestore.googleapis.com';
const IDT_URL = process.env.IDT_URL || 'https://identitytoolkit.googleapis.com';
const fs = createClient({ projectId: sa.project_id, fsUrl: FS_URL, getToken });
const q = (collectionId, where) => fs.query({ from: [{ collectionId }], where, limit: 500 });

async function deleteAuthUser(uid) {
  const res = await fetch(`${IDT_URL}/v1/projects/${sa.project_id}/accounts:delete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
    body: JSON.stringify({ localId: uid })
  });
  if (res.ok) return 'deleted';
  const t = await res.text();
  if (/USER_NOT_FOUND/.test(t)) return 'already gone';
  throw new Error(`Auth delete failed (${res.status}): ${t.slice(0, 200)}`);
}

async function purge(uid) {
  const names = [];
  const add = (docs) => docs.forEach((d) => names.push(d.path));
  const counts = {};
  const tally = (k, docs) => { counts[k] = (counts[k] || 0) + docs.length; add(docs); };

  const posts = await q('posts', eq('uid', uid));
  for (const p of posts) tally('comments', await fs.listAll(`posts/${p.id}/comments`));
  tally('posts', posts);
  tally('reels', await q('reels', eq('uid', uid)));
  tally('stories', await q('stories', eq('uid', uid)));
  tally('friendRequests', [...await q('friendRequests', eq('from', uid)), ...await q('friendRequests', eq('to', uid))]);
  tally('friendships', await q('friendships', arrayContains('members', uid)));
  tally('follows', [...await q('follows', eq('follower', uid)), ...await q('follows', eq('followed', uid))]);
  tally('notifications', [...await q('notifications', eq('to', uid)), ...await q('notifications', eq('from', uid))]);
  tally('saved', await fs.listAll(`users/${uid}/saved`));
  tally('botInbox', await q('botInbox', eq('fromUid', uid)));

  for (const c of await q('chats', arrayContains('members', uid))) {
    if (c.type === 'private') { tally('messages', await fs.listAll(`chats/${c.id}/messages`)); tally('chats', [c]); }
    else await fs.patch(`chats/${c.id}`, { members: (c.members || []).filter((m) => m !== uid) }, ['members']);
  }
  for (const g of await q('groups', arrayContains('members', uid))) {
    const rest = (g.members || []).filter((m) => m !== uid);
    if (!rest.length) { tally('groupRequests', await fs.listAll(`groups/${g.id}/requests`)); tally('groups', [g]); }
    else await fs.patch(`groups/${g.id}`, { members: rest }, ['members']);
  }
  const user = await fs.get(`users/${uid}`);
  if (user) tally('users', [user]);

  const unique = [...new Set(names)];
  if (!DRY) await fs.deleteMany(unique);
  return { counts, total: unique.length };
}

async function main() {
  const pending = await q('deletionRequests', eq('status', 'pending'));
  console.log(`${pending.length} pending deletion request(s)${DRY ? ' (dry run)' : ''}`);
  for (const r of pending) {
    const uid = r.id;
    const finish = async (status, note, extra = {}) => {
      if (DRY) { console.log(`[dry] ${uid}: ${status} ${note}`); return; }
      await fs.patch(`deletionRequests/${uid}`, { status, note, finishedAt: new Date(), ...extra }, ['status', 'note', 'finishedAt', ...Object.keys(extra)]);
      await fs.create('adminLogs', { actorUid: 'system', actorName: 'Deletion job', action: `account deletion ${status}`, target: uid, details: note, createdAt: new Date() });
    };
    try {
      if (/^bot_\d\d$/.test(uid)) { await finish('refused', 'AI bots are removed from Admin -> AI Bots, not here.'); continue; }
      if (await fs.get(`admins/${uid}`)) { await finish('refused', 'Staff accounts must be removed from Staff first.'); continue; }
      const out = await purge(uid);
      const auth = DRY ? 'skipped (dry run)' : await deleteAuthUser(uid);
      await finish('done', `Auth: ${auth}. Firestore documents removed: ${out.total}.`, { counts: out.counts });
      console.log(`Deleted ${uid}: auth ${auth}, ${out.total} docs`);
    } catch (e) {
      console.error(`Failed for ${uid}: ${e.message}`);
      if (!DRY) await fs.patch(`deletionRequests/${uid}`, { note: `Failed: ${e.message.slice(0, 300)}`, lastTriedAt: new Date() }, ['note', 'lastTriedAt']).catch(() => {});
      process.exitCode = 1;
    }
  }
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
