import { VERSION, MAX_CELLS, clamp } from './model';
import type { Pool, Command } from './model';
import { clonePool, applyCommand, normalizeCommand } from './world';
import { stepPool } from './dynamics';

interface Action { step: number; command: Command }
interface Timeline { snapshots: Pool[]; actions: Action[]; end: number }
const WINDOW = 3600;

function restore(timeline: Timeline, target: number): Pool {
  let snapshot = timeline.snapshots[0];
  for (const candidate of timeline.snapshots) { if (candidate.step > target) break; snapshot = candidate; }
  const state = clonePool(snapshot);
  for (; state.step < target;) {
    for (const action of timeline.actions) if (action.step === state.step + 1) applyCommand(state, action.command);
    stepPool(state);
  }
  return state;
}

export class History {
  pool: Pool;
  reference: Pool | null = null;
  private timeline: Timeline;
  private original: Timeline | null = null;
  constructor(initial: Pool) {
    this.pool = clonePool(initial);
    this.timeline = { snapshots: [clonePool(initial)], actions: [], end: initial.step };
  }
  get start(): number { return this.timeline.snapshots[0].step; }
  get end(): number { return this.timeline.end; }
  get branched(): boolean { return this.original !== null; }
  advance(): void {
    const next = this.pool.step + 1;
    for (const action of this.timeline.actions) if (action.step === next) applyCommand(this.pool, action.command);
    stepPool(this.pool);
    if (this.pool.step > this.timeline.end) {
      this.timeline.end = this.pool.step;
      if (this.pool.step % 30 === 0) {
        this.timeline.snapshots.push(clonePool(this.pool));
        while (this.timeline.snapshots.length > 1 && this.pool.step - this.timeline.snapshots[1].step > WINDOW) this.timeline.snapshots.shift();
        this.timeline.actions = this.timeline.actions.filter(a => a.step > this.start);
      }
    }
    if (this.reference && this.original) {
      for (const a of this.original.actions) if (a.step === next) applyCommand(this.reference, a.command);
      stepPool(this.reference);
      if (this.reference.step % 30 === 0 && this.reference.step > this.original.end) {
        this.original.snapshots.push(clonePool(this.reference));
        while (this.original.snapshots.length > 1 && this.pool.step - this.original.snapshots[1].step > WINDOW) this.original.snapshots.shift();
        this.original.actions = this.original.actions.filter(a => a.step > this.original!.snapshots[0].step);
      }
      this.original.end = Math.max(this.original.end, this.reference.step);
    }
  }
  seek(step: number): void {
    const target = Math.round(clamp(step, this.start, this.end));
    this.pool = restore(this.timeline, target);
    if (this.original) this.reference = restore(this.original, target);
  }
  fork(): void {
    // The comparison always refers to the most recent fork, with its complete old future.
    this.original = { snapshots: this.timeline.snapshots.slice(), actions: this.timeline.actions.slice(), end: this.timeline.end };
    this.reference = clonePool(this.pool);
    this.timeline = {
      snapshots: this.timeline.snapshots.filter(s => s.step < this.pool.step).concat([clonePool(this.pool)]),
      actions: this.timeline.actions.filter(a => a.step <= this.pool.step), end: this.pool.step,
    };
  }
  command(command: Command): void {
    const normalized = normalizeCommand(command);
    if (this.pool.step < this.end) this.fork();
    this.timeline.actions.push({ step: this.pool.step + 1, command: normalized });
    this.advance();
  }
  export(): string {
    return JSON.stringify({ version: VERSION, initial: this.timeline.snapshots[0],
      actions: this.timeline.actions.filter(a => a.step <= this.pool.step), step: this.pool.step });
  }
  static import(initial: Pool, actions: Action[], step: number): History {
    const h = new History(initial); h.timeline.actions = actions;
    while (h.pool.step < step) h.advance();
    return h;
  }
}

function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function number(v: unknown, lo = -1e8, hi = 1e8): v is number { return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi; }
function integer(v: unknown, lo = 0, hi = 1e8): v is number { return number(v, lo, hi) && Number.isInteger(v); }
function list(value: unknown, max: number): value is Record<string, unknown>[] { return Array.isArray(value) && value.length <= max && value.every(object); }
function requireValid(valid: boolean): asserts valid { if (!valid) throw new Error('This is not a valid Motes experiment for this version.'); }

function validatePool(value: unknown): asserts value is Pool {
  requireValid(object(value));
  requireValid(value.version === VERSION && ['reef', 'channel', 'spores'].includes(String(value.preset)));
  for (const k of ['seed', 'rng']) requireValid(integer(value[k], 0, 0xffffffff));
  for (const k of ['step', 'nextId', 'births', 'deaths', 'divisions']) requireValid(integer(value[k]));
  requireValid(list(value.cells, MAX_CELLS) && list(value.bonds, 3000) && list(value.nutrients, 40) && list(value.obstacles, 12) && list(value.disturbances, 12) && list(value.events, 80));
  const ids = new Set<number>();
  for (const c of value.cells) {
    requireValid(integer(c.id, 1) && !ids.has(c.id) && integer(c.lineage, 0, 3) && integer(c.role, 0, 2)); ids.add(c.id);
    requireValid(c.parent === null || integer(c.parent, 1));
    requireValid(number(c.x, 0, 1600) && number(c.y, 0, 960) && number(c.energy, 0, 1) && number(c.radius, 1, 20));
    requireValid(number(c.vx, -1000, 1000) && number(c.vy, -1000, 1000) && number(c.phase) && number(c.angle));
    requireValid(number(c.frequency, 0.1, 10) && number(c.age, 0) && number(c.activity, 0, 1));
    requireValid(integer(c.generation) && integer(c.cooldown));
  }
  const bonds = new Set<string>();
  for (const b of value.bonds) {
    requireValid(integer(b.a) && integer(b.b) && b.a !== b.b && ids.has(b.a) && ids.has(b.b));
    const key = `${Math.min(b.a, b.b)}:${Math.max(b.a, b.b)}`;
    requireValid(!bonds.has(key)); bonds.add(key);
    requireValid(number(b.rest, 0.1, 500) && number(b.strain, 0, 10) && number(b.flow, -1, 1) && number(b.age, 0));
  }
  for (const r of value.nutrients) {
    requireValid(integer(r.id, 1) && number(r.x, 0, 1600) && number(r.y, 0, 960) && number(r.radius, 1, 500) && number(r.amount, 0, 1) && number(r.supply, 0, 1));
  }
  requireValid((value.nextId as number) > Math.max(0, ...ids, ...value.nutrients.map(r => r.id as number)));
  for (const r of value.obstacles) requireValid(number(r.x, -1600, 3200) && number(r.y, -960, 1920) && number(r.rx, 1, 600) && number(r.ry, 1, 600) && integer(r.seed));
  for (const d of value.disturbances) requireValid(number(d.x, 0, 1600) && number(d.y, 0, 960) && number(d.strength, -5, 5) && integer(d.born, 0, value.step as number));
  for (const e of value.events) requireValid(integer(e.step, 0, value.step as number) && number(e.x) && number(e.y) && typeof e.text === 'string' && e.text.length < 200 && ['birth', 'split', 'death', 'input'].includes(String(e.type)));
}

export function readExperiment(text: string): History {
  if (text.length > 2_000_000) throw new Error('This experiment is too large. Choose a Motes export under 2 MB.');
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('This file could not be read. Choose a Motes experiment (.json).'); }
  requireValid(object(data) && data.version === VERSION);
  validatePool(data.initial);
  requireValid(integer(data.step, data.initial.step, data.initial.step + WINDOW + 60) && list(data.actions, WINDOW + 60));
  let prior = data.initial.step;
  for (const action of data.actions) {
    requireValid(integer(action.step, prior, data.step) && action.step > data.initial.step && object(action.command));
    const c = action.command;
    requireValid(['feed', 'current', 'cut'].includes(String(c.type)) && number(c.x, 0, 1600) && number(c.y, 0, 960));
    requireValid(c.radius === undefined || number(c.radius, 1, 200));
    requireValid(c.strength === undefined || number(c.strength, -5, 5));
    prior = action.step;
  }
  return History.import(data.initial, data.actions as unknown as Action[], data.step);
}
