// "Does the matrix have teeth?" Each mutation re-introduces one security bug into a copy of firestore.rules.
// The matrix MUST then fail. If a mutation survives, the matrix is missing a case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTORS, CAPS, SEED } from './scenarios.mjs';
import { buildDb, runCase, loadAst, RULES_TEXT } from './engine.mjs';

const db = buildDb(SEED);
const failures = (text) => {
  const ast = loadAst(text); let n = 0;
  for (const cap of CAPS) for (const [name, actor] of Object.entries(ACTORS)) if (runCase(cap, name, actor, db, ast).allowed !== cap.allow.includes(name)) n++;
  return n;
};

const MUTATIONS = [
  ['role-less admin doc becomes super admin again', ".get('role', 'none')", ".get('role', 'super_admin')"],
  ['unknown role counts as staff', "signedIn() && roleOf() in ['super_admin', 'admin', 'moderator']", "signedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid))"],
  ['bot comments may skip the AI flag', "            && request.resource.data.get('ai', false) == true // bot content must always be flagged as AI\n            && textOk(request.resource.data.text, 2000)", "            && textOk(request.resource.data.text, 2000)"],
  ['bot chat messages may skip the AI flag', "            && request.resource.data.get('ai', false) == true // bot content must always be flagged as AI\n            && textOk(request.resource.data.text, 4000)", "            && textOk(request.resource.data.text, 4000)"],
  ['bot consent not checked for comments', "&& engagementOk(p.uid);", ";"],
  ['bot consent not checked for runner reactions', "|| (runnerOn()\n          && engagementOk(resource.data.uid)\n", "|| (runnerOn()\n"],
  ['admin may block other staff', "&& (isSuper() || !isStaffUid(uid))", ""],
  ['moderator may suspend staff', "isMod()\n          && !isStaffUid(uid)", "isMod()"],
  ['an admin may queue permanent deletions', "allow create: if isSuper()\n        && uid != request.auth.uid\n        && !uid.matches('bot_.*')\n        && !isStaffUid(uid)", "allow create: if isAdmin()\n        && uid != request.auth.uid\n        && !uid.matches('bot_.*')\n        && !isStaffUid(uid)"],
  ['deletion of staff may be queued', "        && !isStaffUid(uid)\n        && request.resource.data.keys().hasOnly(['status', 'requestedBy', 'name', 'createdAt'])", "        && request.resource.data.keys().hasOnly(['status', 'requestedBy', 'name', 'createdAt'])"],
  ['super admin may edit their own staff doc', "      allow create, update: if isSuper()\n        && uid != request.auth.uid", "      allow create, update: if isSuper()"],
  ['staff docs may contain any field', "        && request.resource.data.keys().hasOnly(['role', 'addedBy', 'addedAt'])\n", ""],
  ['staff may be made out of a bot or missing user', "        && !uid.matches('bot_.*')\n        && !exists(/databases/$(database)/documents/botRunners/$(uid))\n        && exists(/databases/$(database)/documents/users/$(uid))\n", ""],
  ['the bot-runner account may be made staff', "        && !exists(/databases/$(database)/documents/botRunners/$(uid))\n", ""],
  ['inbox pointer may point at somebody else\'s message', " && get(/databases/$(database)/documents/chats/$(request.resource.data.chatId)/messages/$(request.resource.data.messageId)).data.uid == request.auth.uid", ""],
  ['moderators and admins may read private-message pointers', "allow read: if isBotRunner() || isSuper();\n      // the runner can only record progress", "allow read: if isBotRunner() || isStaff();\n      // the runner can only record progress"],
  ['the runner may put text back into an inbox row', "        && (request.resource.data.get('text', '') == resource.data.get('text', '') || request.resource.data.get('text', '') == '')\n", ""],
  ['the runner may delete pending inbox rows at once', "(resource.data.handled == true || request.time > resource.data.createdAt + duration.value(7, 'd'))", "true"],
  ['inbox rows may carry free text in lastError', "        && request.resource.data.get('lastError', '').size() <= 60\n", ""],
  ['a runner may redirect an inbox row', "affectedKeys().hasOnly(['handled', 'handledAt', 'answered', 'skipped', 'attempts', 'lastError', 'text'])", "affectedKeys().hasAny(['handled', 'handledAt', 'answered', 'skipped', 'attempts', 'lastError', 'text', 'botId', 'messageId', 'chatId'])"],
  ['moderator can forge the role in a log', "        && request.resource.data.role == roleOf()\n", ""],
  ['logs can be back-dated', "        && request.resource.data.createdAt == request.time\n", ""],
  ['logs can be edited', "allow update, delete: if false;\n    }\n\n    // ---------- site settings", "allow update, delete: if isStaff();\n    }\n\n    // ---------- site settings"],
  ['a moderator can change global settings', "allow write: if isAdmin() && id == 'global'", "allow write: if isStaff() && id == 'global'"],
  ['settings accept any field', "request.resource.data.keys().hasOnly(['maintenance', 'maintenanceMessage', 'registrationOpen', 'botsEnabled', 'botToBotComments', 'updatedBy', 'updatedAt'])", "true"],
  ['users can verify or block themselves', "!request.resource.data.diff(resource.data).affectedKeys().hasAny(['banned', 'isBot', 'verified', 'suspendedUntil'])", "true"],
  ['a user may become a bot on creation', "&& request.resource.data.get('isBot', false) == false\n          && request.resource.data.get('verified', false) == false", "&& request.resource.data.get('verified', false) == false"],
  ['suspension is ignored', "(u.get('suspendedUntil', null) == null || u.get('suspendedUntil', null) < request.time)", "true"],
  ['blocked users can write', "u.banned != true", "true"],
  ['bot posts may contain video', "&& request.resource.data.videoUrl == ''", ""],
  ['bot-runner may read every chat', "|| (isBotRunner() && resource != null && resource.data.type == 'private' && resource.data.members.hasAny(botIds()));", "|| isBotRunner();"],
  ['comments stay possible when switched off', "return p.get('commentsDisabled', false) == false && canSeePost(p);", "return canSeePost(p);"],
  ['any reaction value is accepted', "|| request.resource.data.reactions[request.auth.uid] in ['like', 'love', 'haha', 'wow', 'sad', 'angry']", "|| true"],
  ['a report can be edited freely by staff', "hasOnly(['status', 'action', 'resolvedBy', 'resolvedAt'])\n        && request.resource.data.status in ['open', 'resolved']", "hasOnly(['status', 'action', 'resolvedBy', 'resolvedAt', 'targetUid'])\n        && request.resource.data.status in ['open', 'resolved']"],
  ['moderators can delete reports', "allow delete: if isAdmin();\n    }\n\n    // ---------- friends", "allow delete: if isStaff();\n    }\n\n    // ---------- friends"],
  ['anyone can read the activity log', "allow read: if isAdmin();\n      allow update, delete: if false;", "allow read: if signedIn();\n      allow update, delete: if false;"],
  ['inbox accepts messages to non-bots', "&& isBotUser(request.resource.data.botId)\n", ""],
  ['normal users can hide posts', "affectedKeys().hasOnly(['hidden', 'commentsDisabled']))", "affectedKeys().hasOnly(['hidden', 'commentsDisabled', 'text']))"]
];

for (const [name, from, to] of MUTATIONS) {
  test(`mutation is caught: ${name}`, () => {
    assert.equal(RULES_TEXT.split(from).length - 1, 1, `mutation pattern must occur exactly once in firestore.rules: ${from.slice(0, 60)}`);
    assert.ok(failures(RULES_TEXT.replace(from, to)) > 0, 'the matrix did not notice this security bug');
  });
}
