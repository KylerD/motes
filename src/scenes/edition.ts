import {DAILY_PLACES,PLACES,placeById,type Place,type PlaceId} from '../places';

export const SCENE_IDS = PLACES.map(p => p.id);
export type SceneId = PlaceId;
export const SCENES = Object.fromEntries<Place>(PLACES.map(p => [p.id,p])) as Record<SceneId, Place>;
export function hash(value: string): number {
  let n = 2166136261;
  for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619);
  return n >>> 0;
}
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let n = state; n = Math.imul(n ^ n >>> 15,n | 1); n ^= n + Math.imul(n ^ n >>> 7,n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDay(day: string | null): day is string {
  if (!day || !/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === day;
}
export function isScene(value: string | null): value is SceneId { return SCENE_IDS.some(id => id === value); }
export interface Edition { day: string; scene: SceneId; seed: number; intensity: number; wind: number; warmth: number; light: string; }
export function edition(day = localDay(), scene?: SceneId): Edition {
  const safeDay = validDay(day) ? day : localDay();
  const ordinal = Math.floor(Date.parse(`${safeDay}T12:00:00Z`)/86400000);
  const place = scene ?? DAILY_PLACES[((ordinal % DAILY_PLACES.length)+DAILY_PLACES.length)%DAILY_PLACES.length];
  const seed = hash(`motes-radio-1:${safeDay}:${place}`), rng = random(seed);
  const intensity = .45 + rng() * .65, wind = (rng()-.5)*.8, warmth = rng();
  return { day: safeDay, scene: place, seed, intensity, wind, warmth, light: placeById(place).lights[Math.floor(rng()*3)] };
}
export function dayLabel(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  return date.toLocaleDateString('en-GB',{day:'numeric',month:'long'});
}
