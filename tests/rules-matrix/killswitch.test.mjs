// Kill switch + runner-identity tests for firestore.rules, run by our rules interpreter.
// The main matrix always runs with settings/global.botsEnabled = true. These tests re-run the SAME capabilities
// against other states of the switch, and check that the bot-runner account cannot write unless bots are explicitly ON.
//
//   ON          settings/global = { botsEnabled: true }                 runner writes allowed (as in the matrix)
//   OFF         { botsEnabled: false }                                   runner writes denied
//   FIELD GONE  { maintenance: false } (no botsEnabled)                  fail-closed: denied
//   NO DOC      settings/global missing                                  fail-closed: denied
//   WRONG TYPE  { botsEnabled: 'true' } / 1 / null                        fail-closed: denied
//   RUNNER=STAFF a runner uid that also has an /admins document          runner powers are gone, it is only an admin
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTORS, CAPS, SEED } from './scenarios.mjs';
import { buildDb, runCase, loadAst, RULES_TEXT } from './engine.mjs';

const WRITES = new Set(['create', 'update', 'delete']);
const variant = (over) => { const seed = { ...SEED }; for (const [k, v] of Object.entries(over)) { if (v === undefined) delete seed[k]; else seed[k] = v; } return buildDb(seed); };
const runner = ACTORS.runner;
const runnerWrites = CAPS.filter((c) => WRITES.has(c.op) && c.allow.includes('runner'));
const runnerReads = CAPS.filter((c) => c.op === 'get' && c.allow.includes('runner'));
const verdicts = (db, caps, ast) => caps.map((c) => [c, runCase(c, 'runner', runner, db, ast).allowed]);

test('there are runner write capabilities to test (sanity)', () => {
  assert.ok(runnerWrites.length >= 15, `only ${runnerWrites.length}`);
  assert.ok(runnerReads.length >= 5, `only ${runnerReads.length}`);
});

test('ON: every runner write of the matrix is allowed', () => {
  for (const [c, allowed] of verdicts(variant({}), runnerWrites)) assert.equal(allowed, true, c.name);
});

const OFF_STATES = {
  'botsEnabled = false': { 'settings/global': { botsEnabled: false } },
  'botsEnabled field missing': { 'settings/global': { maintenance: false } },
  'settings/global document missing': { 'settings/global': undefined },
  'botsEnabled = "true" (a string)': { 'settings/global': { botsEnabled: 'true' } },
  'botsEnabled = 1': { 'settings/global': { botsEnabled: 1 } },
  'botsEnabled = null': { 'settings/global': { botsEnabled: null } }
};
for (const [label, over] of Object.entries(OFF_STATES)) {
  test(`OFF (${label}): the runner cannot write anything`, () => {
    const bad = verdicts(variant(over), runnerWrites).filter(([, allowed]) => allowed).map(([c]) => `${c.name} (${c.op} ${c.path})`);
    assert.deepEqual(bad, [], `still allowed while bots are not explicitly ON:\n${bad.join('\n')}`);
  });
  test(`OFF (${label}): the runner can still READ (it needs to read the switch itself) and users are unaffected`, () => {
    for (const [c, allowed] of verdicts(variant(over), runnerReads)) assert.equal(allowed, true, c.name);
    // the settings document stays public
    const readSettings = CAPS.find((c) => c.name.startsWith('Read global settings'));
    if (over['settings/global']) assert.equal(runCase(readSettings, 'anon', ACTORS.anon, variant(over)).allowed, true);
  });
  test(`OFF (${label}): nobody can create a new inbox row, and normal user content still works`, () => {
    const db = variant(over);
    const ask = CAPS.find((c) => c.name.startsWith('Ask a bot something'));
    assert.equal(runCase(ask, 'user', ACTORS.user, db).allowed, false, 'inbox row while bots are off');
    const legacy = CAPS.find((c) => c.name.startsWith('LEGACY'));
    assert.equal(runCase(legacy, 'user', ACTORS.user, db).allowed, false, 'legacy inbox row while bots are off');
    const chat = CAPS.find((c) => c.name === 'Write a message in a chat between two people');
    assert.equal(runCase(chat, 'user', ACTORS.user, db).allowed, true, 'a normal chat message must keep working');
  });
}

test('RUNNER=STAFF: a runner uid that is also in /admins behaves exactly like that admin, never like a runner', () => {
  const asAdmin = variant({ 'admins/run': { role: 'admin' } });
  const GROUPS = new Set(['AI bots', 'Posts', 'Chats', 'Notifications']);
  const checked = [];
  for (const c of CAPS.filter((x) => GROUPS.has(x.group) && WRITES.has(x.op))) {
    checked.push([c, runCase(c, 'runner', runner, asAdmin).allowed]);
  }
  // runner-only paths (reactions, chat replies, notifications, state, inbox progress, comment counters) must be closed
  const runnerOnly = checked.filter(([c]) => c.allow.includes('runner') && !c.allow.includes('admin'));
  assert.ok(runnerOnly.length >= 8, `${runnerOnly.length}`);
  for (const [c, got] of runnerOnly) assert.equal(got, false, `runner+admin must not use the runner path: ${c.name}`);
});

test('RUNNER=STAFF: a super admin cannot turn the runner account into staff', () => {
  const c = CAPS.find((x) => x.name === 'Make the bot-runner account staff');
  assert.equal(runCase(c, 'super', ACTORS.super, buildDb(SEED)).allowed, false);
});

// ---------------------------------------------------------------- mutations: these bugs must be noticed here
const MUTATIONS = [
  ['kill switch ignored', "return isBotRunner() && botsOn() && !isStaffUid(request.auth.uid);", "return isBotRunner() && !isStaffUid(request.auth.uid);"],
  ['missing botsEnabled counts as ON', ".data.get('botsEnabled', false) == true;", ".data.get('botsEnabled', true) == true;"],
  ['any truthy botsEnabled counts as ON', ".data.get('botsEnabled', false) == true;", ".data.get('botsEnabled', false) != false;"],
  ['a runner that is also staff keeps runner power', "return isBotRunner() && botsOn() && !isStaffUid(request.auth.uid);", "return isBotRunner() && botsOn();"]
];
const failuresOf = (text) => {
  const ast = loadAst(text);
  let n = 0;
  for (const over of [{}, ...Object.values(OFF_STATES)]) for (const [, allowed] of verdicts(variant(over), runnerWrites, ast)) if (allowed !== (over === undefined || Object.keys(over).length === 0)) n++;
  for (const [c] of verdicts(variant({ 'admins/run': { role: 'admin' } }), runnerWrites.filter((x) => !x.allow.includes('admin')), ast).filter(([, a]) => a)) { void c; n++; }
  return n;
};
test('control: the unmodified rules produce no failures in the mutation harness', () => assert.equal(failuresOf(RULES_TEXT), 0));
for (const [name, from, to] of MUTATIONS) {
  test(`mutation is caught: ${name}`, () => {
    assert.equal(RULES_TEXT.split(from).length - 1, 1, `pattern must occur once: ${from}`);
    assert.ok(failuresOf(RULES_TEXT.replace(from, to)) > 0, 'the kill-switch tests did not notice this bug');
  });
}
