export const SCENE_IDS = ['rain', 'meadow', 'snow', 'coast'] as const;
export type SceneId = typeof SCENE_IDS[number];
export type Point = readonly [number, number];
export interface Scene {
  name: string; title: string; subtitle: string; image: string; eveningImage: string; anchor: number;
  color: string; water: readonly Point[]; weather: string;
}
export const SCENES: Record<SceneId, Scene> = {
  rain: { name: 'Neon rain', title: 'Rain, above the city.', subtitle: 'The rest of the world can wait.', image: '/scenes/neon-rain.png', eveningImage: '/scenes/neon-rain-night.png', anchor: .43, color: '#071b38', weather: 'Rain on the rooftops',
    water: [[.16,.82],[.23,.745],[.41,.657],[.52,.625],[.66,.667],[.774,.706],[.717,.813],[.651,.944],[.45,.98],[.253,.915]] },
  meadow: { name: 'Golden hour', title: 'Nowhere else to be.', subtitle: 'A little longer in the afternoon.', image: '/scenes/golden-hour.png', eveningImage: '/scenes/golden-hour-dusk.png', anchor: .60, color: '#173d3d', weather: 'A breeze through the meadow',
    water: [[.29,.81],[.40,.74],[.48,.71],[.51,.67],[.61,.65],[.77,.71],[.88,.73],[.84,.87],[.70,1],[.48,.98],[.39,.94]] },
  snow: { name: 'Last light station', title: 'Let the snow fall.', subtitle: 'Somewhere warm, along the way.', image: '/scenes/last-light-station.png', eveningImage: '/scenes/last-light-station-night.png', anchor: .43, color: '#151c37', weather: 'Snow in the mountains', water: [] },
  coast: { name: 'The last chapter', title: 'One more chapter.', subtitle: 'An evening with nowhere to go.', image: '/scenes/the-last-chapter.png', eveningImage: '/scenes/the-last-chapter-night.png', anchor: .56, color: '#152d40', weather: 'Waves below the window',
    water: [[.39,.353],[.728,.343],[.683,.428],[.749,.454],[.772,.49],[.884,.544],[.87,.725],[.758,.83],[.73,.763],[.683,.71],[.625,.687],[.59,.636],[.541,.612],[.495,.566],[.469,.498],[.44,.44]] },
};
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
  const place = scene ?? SCENE_IDS[((ordinal % 4)+4)%4];
  const seed = hash(`motes-radio-1:${safeDay}:${place}`), rng = random(seed);
  const intensity = .45 + rng() * .65, wind = (rng()-.5)*.8, warmth = rng();
  const lights: Record<SceneId,string[]> = {
    rain: ['Blue hour, soft rain', 'A passing shower', 'City lights, late evening'],
    meadow: ['Sun through the branches', 'A slow golden afternoon', 'Warm light, wandering clouds'],
    snow: ['The quiet between trains', 'Snowfall at dusk', 'Warm windows, winter sky'],
    coast: ['A sea breeze at sunset', 'The tide coming in', 'Last light over the bay'],
  };
  return { day: safeDay, scene: place, seed, intensity, wind, warmth, light: lights[place][Math.floor(rng()*3)] };
}
export function dayLabel(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  return date.toLocaleDateString('en-GB',{day:'numeric',month:'long'});
}
