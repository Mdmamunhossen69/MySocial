// Runs the permission matrix (tests/rules-matrix/scenarios.mjs) against the REAL Firebase Firestore Emulator.
// It also proves that firestore.rules COMPILES: the emulator refuses to load rules with syntax errors.
// Only talks to the local emulator (demo-* project id), never to a real Firebase project.
//
//   cd tests/emulator && npm install && cd ../..
//   ./tests/emulator/node_modules/.bin/firebase emulators:exec --only firestore --project demo-mysocial "node tests/emulator/run.mjs"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, increment, deleteField, Timestamp } from 'firebase/firestore';
import { ACTORS, CAPS, SEED } from '../rules-matrix/scenarios.mjs';

const PROJECT = 'demo-mysocial';
if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error('Run this through `firebase emulators:exec` so FIRESTORE_EMULATOR_HOST is set.'); process.exit(2); }

const conv = (v) => {
  if (Array.isArray(v)) return v.map(conv);
  if (v && typeof v === 'object') {
    if ('$srv' in v) return serverTimestamp();
    if ('$rel' in v) return Timestamp.fromMillis(Date.now() + v.$rel);
    if ('$inc' in v) return increment(v.$inc);
    if ('$del' in v) return deleteField();
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, conv(x)]));
  }
  return v;
};

let env;
try {
  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
} catch (e) { console.error('FIRESTORE RULES DID NOT COMPILE OR LOAD:\n', e.message || e); process.exit(1); }
console.log('firestore.rules compiled and loaded into the emulator.');

async function seed(data = SEED) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const entries = Object.entries(data);
    for (let i = 0; i < entries.length; i += 400) {
      const b = writeBatch(db);
      entries.slice(i, i + 400).forEach(([p, d]) => b.set(doc(db, p), conv(d)));
      await b.commit();
    }
  });
}

const attempt = async (db, cap, actorName, actor) => {
  const ref = doc(db, cap.path);
  const data = typeof cap.data === 'function' ? cap.data({ ...actor, name: actorName }) : cap.data;
  try {
    if (cap.op === 'get') await getDoc(ref);
    else if (cap.op === 'create') await setDoc(ref, conv(data));
    else if (cap.op === 'update') await updateDoc(ref, conv(data));
    else if (cap.op === 'delete') await deleteDoc(ref);
    return { ok: true };
  } catch (e) {
    return { ok: false, permission: /permission|insufficient/i.test(String(e.code || e.message)), error: String(e.message || e) };
  }
};

await seed();
let total = 0; const wrong = [];
for (const cap of CAPS) {
  for (const [name, actor] of Object.entries(ACTORS)) {
    const ctx = actor.uid ? env.authenticatedContext(actor.uid) : env.unauthenticatedContext();
    const r = await attempt(ctx.firestore(), cap, name, actor);
    total++;
    const want = cap.allow.includes(name);
    if (r.ok !== want || (!r.ok && !r.permission)) wrong.push(`[${cap.group}] ${cap.name} as ${name}: expected ${want ? 'ALLOW' : 'DENY'}, got ${r.ok ? 'ALLOW' : 'DENY'}${r.ok || r.permission ? '' : ` (NOT a permission error: ${r.error.slice(0, 160)})`}`);
    if (r.ok && cap.op !== 'get') await seed(); // a write succeeded: restore the seed so cases stay independent
  }
}
// ---- kill switch: the SAME runner write capabilities must be denied unless settings/global.botsEnabled is explicitly true
// (tests/rules-matrix/killswitch.test.mjs runs the same states through our interpreter)
const WRITES = new Set(['create', 'update', 'delete']);
const runnerWrites = CAPS.filter((c) => WRITES.has(c.op) && c.allow.includes('runner'));
const withSettings = (value) => { const d = { ...SEED }; if (value === undefined) delete d['settings/global']; else d['settings/global'] = value; return d; };
const STATES = {
  'botsEnabled=false': withSettings({ botsEnabled: false }),
  'botsEnabled field missing': withSettings({ maintenance: false }),
  'settings/global missing': withSettings(undefined),
  'botsEnabled="true" (string)': withSettings({ botsEnabled: 'true' }),
  'botsEnabled=null': withSettings({ botsEnabled: null })
};
let switchCases = 0;
for (const [label, data] of Object.entries(STATES)) {
  await seed(data);
  const runnerDb = env.authenticatedContext(ACTORS.runner.uid).firestore();
  for (const cap of runnerWrites) {
    const r = await attempt(runnerDb, cap, 'runner', ACTORS.runner);
    switchCases++; total++;
    if (r.ok || !r.permission) wrong.push(`[kill switch: ${label}] ${cap.name}: runner expected DENY (permission), got ${r.ok ? 'ALLOW' : `NOT a permission error: ${r.error.slice(0, 160)}`}`);
    if (r.ok) await seed(data);
  }
  // normal users are unaffected, and cannot queue a bot message while bots are off
  const userDb = env.authenticatedContext(ACTORS.user.uid).firestore();
  const ask = CAPS.find((c) => c.name.startsWith('Ask a bot something'));
  const r1 = await attempt(userDb, ask, 'user', ACTORS.user); total++; switchCases++;
  if (r1.ok) wrong.push(`[kill switch: ${label}] a user could queue an inbox row while bots are off`);
  const chatCap = CAPS.find((c) => c.name === 'Write a message in a chat between two people');
  const r2 = await attempt(userDb, chatCap, 'user', ACTORS.user); total++; switchCases++;
  if (!r2.ok) wrong.push(`[kill switch: ${label}] normal chat message was refused: ${r2.error.slice(0, 120)}`);
}
// a runner uid that is ALSO an admin must lose its runner-only powers
{
  const d = { ...SEED, 'admins/run': { role: 'admin' } };
  await seed(d);
  const runnerDb = env.authenticatedContext(ACTORS.runner.uid).firestore();
  for (const cap of runnerWrites.filter((c) => !c.allow.includes('admin') && ['AI bots', 'Posts', 'Chats', 'Notifications'].includes(c.group))) {
    const r = await attempt(runnerDb, cap, 'runner+admin', ACTORS.runner);
    switchCases++; total++;
    if (r.ok || !r.permission) wrong.push(`[runner is also staff] ${cap.name}: expected DENY, got ${r.ok ? 'ALLOW' : 'a non-permission error'}`);
    if (r.ok) await seed(d);
  }
}
await env.cleanup();
console.log(`(${switchCases} kill-switch cases included)`);
console.log(`${total} cases run against the real emulator, ${wrong.length} mismatches.`);
if (wrong.length) { console.error(wrong.join('\n')); process.exit(1); }
