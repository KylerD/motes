export const WIDTH = 1600;
export const HEIGHT = 960;
export const DT = 1 / 30;
export const VERSION = 'motes-tidepool-1';
export const MAX_CELLS = 340;
export type Preset = 'reef' | 'channel' | 'spores';
export type Lens = 'life' | 'energy' | 'bonds';
export type Tool = 'observe' | 'feed' | 'current' | 'cut';
export interface Cell {
  id: number; lineage: number; parent: number | null;
  x: number; y: number; vx: number; vy: number;
  energy: number; phase: number; frequency: number; angle: number;
  role: number; age: number; radius: number; generation: number;
  cooldown: number; activity: number;
}
export interface Bond { a: number; b: number; rest: number; strain: number; flow: number; age: number }
export interface Nutrient { id: number; x: number; y: number; radius: number; amount: number; supply: number }
export interface Obstacle { x: number; y: number; rx: number; ry: number; seed: number }
export interface Disturbance { x: number; y: number; strength: number; born: number }
export interface PoolEvent { step: number; text: string; x: number; y: number; type: 'birth' | 'split' | 'death' | 'input' }
export interface Pool {
  version: string; seed: number; rng: number; step: number; preset: Preset;
  nextId: number; cells: Cell[]; bonds: Bond[]; nutrients: Nutrient[];
  obstacles: Obstacle[]; disturbances: Disturbance[]; events: PoolEvent[];
  births: number; deaths: number; divisions: number;
}
export interface Colony { id: number; lineage: number; cells: Cell[]; x: number; y: number; energy: number; coherence: number; radius: number }
export type Command = { type: 'feed' | 'current' | 'cut'; x: number; y: number; radius?: number; strength?: number };
export interface View { x: number; y: number; zoom: number; selected: number | null; lens: Lens; tool: Tool; pointer: { x: number; y: number } | null; reduced: boolean }
export const LINEAGES = [
  { name: 'Mallow', kind: 'Ribbon wanderer', color: '#ffdc9d', rgb: '255,220,157', note: 146.83 },
  { name: 'Clover', kind: 'Little lantern', color: '#b7e7b1', rgb: '183,231,177', note: 174.61 },
  { name: 'Ember', kind: 'Gentle drifter', color: '#f4b3ba', rgb: '244,179,186', note: 220 },
  { name: 'Pip', kind: 'Ribbon wanderer', color: '#c3c6ef', rgb: '195,198,239', note: 196 },
] as const;
export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** Stateful PRNG kept in checkpoints; rendering must never consume it. */
export function random(pool: Pool): number {
  let t = pool.rng = (pool.rng + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
