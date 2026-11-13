// Daily read budget for the bot runner (script-level safety brake, NOT a billing control).
//
// Why: the Firebase free (Spark) plan allows 50,000 document reads per day for the WHOLE project, shared with every
// visitor of the site. The runner counts the reads it causes itself and stops before it can eat that quota.
//
// How it works
//  * A "day" is the Pacific-time calendar day, because Firestore's daily quota resets at midnight Pacific.
//  * The counter lives in one small document, botState/budget: { day, reads, writes, maintDay, updatedAt }.
//  * Every get / query / list goes through meter(): reads are counted (an empty query counts as 1, as Firestore bills).
//  * SOFT limit (default 70% of the daily budget): optional work (new posts, engagement) stops, chat replies go on.
//  * HARD limit (100%): the runner stops completely and exits 0 (a stopped run is a normal outcome, not a failure).
//  * PER-RUN cap (default 500 reads): one run can never spend more than this, whatever the daily budget is.
//  * A 429 / RESOURCE_EXHAUSTED answer from Firestore = the free quota itself is used up: stop cleanly, never retry.
//
// Honest limits (also in the README): the counter only knows reads made BY THE RUNNER. Reads by people using the site,
// by the weekly backup and by the deletion job are not in it, so the budget must be chosen from the real numbers in
// Firebase console -> Usage. The default below is a TEMPORARY safety cap, not a value proven safe.
//
// No private message text is ever stored here: only numbers and the day.
export const DEFAULTS = { daily: 6000, softRatio: 0.7, perRun: 500 };

export class BudgetStop extends Error {
  constructor(reason) { super(`Read budget: ${reason}`); this.name = 'BudgetStop'; this.reason = reason; }
}

// Pacific calendar day as YYYY-MM-DD (handles daylight saving time through the time-zone database)
export function pacificDay(date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

const posInt = (v, d, max) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : d; };

// "A 429 or RESOURCE_EXHAUSTED answer" as thrown by scripts/lib/firestore-rest.mjs: "GET <url> -> 429 {...}"
export const isQuotaError = (e) => /->\s*429\b|RESOURCE_EXHAUSTED|quota/i.test(String((e && e.message) || e));

export class Budget {
  constructor({ daily, softRatio, perRun, now = () => new Date() } = {}) {
    this.daily = posInt(daily, DEFAULTS.daily, 45000); // never above what the free quota could ever allow
    this.soft = Math.floor(this.daily * (softRatio ?? DEFAULTS.softRatio));
    this.perRun = posInt(perRun, DEFAULTS.perRun, this.daily);
    this.now = now;
    this.day = pacificDay(now());
    this.startReads = 0; this.startWrites = 0; this.maintDay = '';
    this.runReads = 0; this.runWrites = 0;
  }
  static fromEnv(env = process.env) {
    return new Budget({ daily: env.BOT_DAILY_READS, perRun: env.BOT_RUN_READS });
  }
  // Called once with the stored document (or null on the first run of the project, or an unreadable doc)
  load(doc) {
    this.day = pacificDay(this.now());
    const same = doc && doc.day === this.day;
    this.startReads = same && Number.isFinite(doc.reads) ? Math.max(0, doc.reads) : 0;
    this.startWrites = same && Number.isFinite(doc.writes) ? Math.max(0, doc.writes) : 0;
    this.maintDay = doc && typeof doc.maintDay === 'string' ? doc.maintDay : '';
    this.fresh = !same; // the stored document belongs to an earlier day (or does not exist)
  }
  get usedToday() { return this.startReads + this.runReads; }
  get remaining() { return Math.max(0, this.daily - this.usedToday); }
  get softReached() { return this.usedToday >= this.soft; }
  get hardReached() { return this.usedToday >= this.daily || this.runReads >= this.perRun; }
  // before a read of `n` documents: throws when it would break the daily budget or the per-run cap
  beforeRead(n = 1) {
    if (this.usedToday + n > this.daily) throw new BudgetStop(`daily budget of ${this.daily} reads reached (${this.usedToday} used)`);
    if (this.runReads + n > this.perRun) throw new BudgetStop(`per-run cap of ${this.perRun} reads reached`);
  }
  addRead(n = 1) { this.runReads += n; }
  addWrite(n = 1) { this.runWrites += n; }
  maintenanceDue() { return this.maintDay !== this.day; }
  summary() { return `reads this run ${this.runReads}, today ${this.usedToday}/${this.daily} (soft ${this.soft}, per-run cap ${this.perRun}), writes this run ${this.runWrites}`; }
  // numbers to store: a plain set (fresh day) or an atomic increment (same day, so overlapping runs add up)
  async save(fs, { maintenanceDone = false } = {}) {
    if (this.runReads === 0 && this.runWrites === 0 && !maintenanceDone) return;
    const maintDay = maintenanceDone ? this.day : this.maintDay;
    if (this.fresh) {
      await fs.set('botState/budget', { day: this.day, reads: this.runReads, writes: this.runWrites, maintDay, updatedAt: this.now() });
    } else {
      if (this.runReads) await fs.increment('botState/budget', 'reads', this.runReads);
      if (this.runWrites) await fs.increment('botState/budget', 'writes', this.runWrites);
      if (maintenanceDone) await fs.patch('botState/budget', { maintDay, updatedAt: this.now() });
    }
    this.startReads += this.runReads; this.startWrites += this.runWrites; this.runReads = 0; this.runWrites = 0;
    if (maintenanceDone) this.maintDay = maintDay;
    this.fresh = false;
  }
}

// Wraps a Firestore client so every read is checked against and counted in the budget.
// create/patch/set/increment/deleteMany are only counted (Firestore's write quota is far from the read quota here).
export function meter(fs, budget) {
  return {
    ...fs,
    async get(path) { budget.beforeRead(1); const d = await fs.get(path); budget.addRead(1); return d; },
    async query(q, parent) {
      budget.beforeRead(Math.max(1, Number(q && q.limit) || 1)); // worst case: the query returns `limit` documents
      const rows = await fs.query(q, parent);
      budget.addRead(Math.max(1, rows.length));
      return rows;
    },
    async listAll() { throw new Error('listAll is not allowed in the bot runner (it would read a whole collection)'); },
    async create(...a) { const r = await fs.create(...a); budget.addWrite(); return r; },
    async patch(...a) { const r = await fs.patch(...a); budget.addWrite(); return r; },
    async set(...a) { const r = await fs.set(...a); budget.addWrite(); return r; },
    async increment(...a) { const r = await fs.increment(...a); budget.addWrite(); return r; },
    async deleteMany(names) { const r = await fs.deleteMany(names); budget.addWrite(names.length); return r; }
  };
}
