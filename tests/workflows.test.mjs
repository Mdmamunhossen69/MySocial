// Guards the CI workflows: a secret-using workflow must never be reachable from pull requests, and secrets are never printed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../.github/workflows/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.yml'));
const text = (f) => readFileSync(new URL(f, dir), 'utf8');

test('no workflow uses pull_request_target', () => {
  for (const f of files) assert.ok(!/pull_request_target/.test(text(f)), f);
});

test('only the test workflow runs on pull requests, and it uses no secrets', () => {
  for (const f of files) {
    const t = text(f);
    const onPr = /^\s{2}pull_request:|^on:\s*\[?.*pull_request/m.test(t);
    if (f === 'tests.yml') { assert.ok(onPr); assert.ok(!/secrets\./.test(t), 'tests.yml must not use secrets'); }
    else assert.ok(!onPr, `${f} must not run for pull requests`);
  }
});

test('deploy-rules: main/manual only, protected environment, gated by tests, secret never echoed', () => {
  const t = text('deploy-rules.yml');
  assert.match(t, /branches: \[main\]/);
  assert.match(t, /environment: production/);
  assert.match(t, /node tests\/emulator\/run\.mjs/, 'real emulator must pass before deploying');
  assert.match(t, /dry_run[\s\S]*default: true/, 'manual runs default to dry run');
  assert.match(t, /--only firestore:rules/, 'only rules are deployed, never data');
  const deployCmds = t.split('\n').filter((l) => /firebase deploy/.test(l));
  assert.equal(deployCmds.length, 1);
  assert.ok(/--only firestore:rules /.test(deployCmds[0]) && !/indexes|functions|hosting|storage|database/.test(deployCmds[0]), 'nothing besides rules');
  assert.ok(!/echo[^\n]*\$\{?SA\b/.test(t) && !/cat[^\n]*sa\.json/.test(t), 'secret is never printed');
  assert.match(t, /rm -f "\$KEY"/, 'key file is removed');
  const uses = [...t.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]);
  assert.ok(uses.length > 0 && uses.every((s) => s === 'FIREBASE_RULES_SA'), 'only the dedicated limited secret');
});

test('every workflow that uses a secret passes it via env, not inline in the command line', () => {
  for (const f of files) {
    for (const line of text(f).split('\n')) {
      if (/\$\{\{\s*secrets\./.test(line)) assert.match(line, /^\s+[A-Z_]+:\s*\$\{\{/, `${f}: secret must be assigned to an env var -> ${line.trim()}`);
    }
  }
});
