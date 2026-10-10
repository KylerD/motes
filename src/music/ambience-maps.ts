import type {Mood} from './composer';
import type {EventKind} from '../session/session';

/** Where a sound is, heard from where the painting's viewer stands: degrees right of straight ahead,
 * degrees above the ear, and metres away. Positions follow the painting. */
export interface Position {azimuth:number;elevation:number;distance:number}
/** The listening-time light arcs in src/scenes/scene-light.ts; a sound follows the part of the picture it belongs to. */
export type Arc='sky'|'distance'|'foreground'|'water'|'lamps';
/** Levels at arrival and at the settled evening, mixed by the arc. A low-pass in hertz can follow the same arc. */
interface Shape {name:string;file:string;arrival:number;evening:number;arc:Arc;lowpass?:readonly [arrival:number,evening:number]}
/** A continuous texture of `seconds` that loops seamlessly. Enveloping beds are stereo files played as they are; placed beds are mono, with a direction. */
export interface Bed extends Shape {position?:Position;seconds:number}
/** Short sounds that recur. The file holds `variants` equal slots of `slot` seconds. Every `period` seconds
 * a spot plays with this `chance`, `spread` degrees either side of its position, or of one of `elsewhere`. */
export interface Spots extends Shape {variants:number;slot:number;period:number;chance:number;spread:number;position:Position;elsewhere?:readonly Position[]}
/** Where an event's sound is as the event progresses (0–1), following the path the picture draws, and how loud
 * it is there. Positions between keys are interpolated. */
export type PathKey=readonly [progress:number,azimuth:number,elevation:number,distance:number,level:number];
/** A planned event that moves (the train, the boat): one looping recording travelling along its path. */
export interface Mover {kind:EventKind;name:string;file:string;seconds:number;level:number;lowpass?:number;path:readonly PathKey[]}
/** A planned event that calls (birds): spots that play only while it runs, scattered along its path. */
export interface Calls {kind:EventKind;name:string;file:string;variants:number;slot:number;period:number;chance:number;spread:number;level:number;lowpass?:number;path:readonly PathKey[]}
export interface SoundMap {beds:readonly Bed[];spots:readonly Spots[];movers?:readonly Mover[];calls?:readonly Calls[];trim:number}

/** The painting spans about sixty degrees: a point across its width (0–1) is this many degrees right of ahead. */
export const across=(u:number)=>(u-.5)*60;
/** Interpolate a path at an event's progress. */
export function pathAt(path:readonly PathKey[],progress:number):{position:Position;level:number} {
  const p=Math.max(0,Math.min(1,progress));
  let i=0;while(i<path.length-2&&path[i+1][0]<=p)i++;
  const a=path[i],b=path[Math.min(i+1,path.length-1)],t=b[0]>a[0]?Math.max(0,Math.min(1,(p-a[0])/(b[0]-a[0]))):0;
  const mix=(k:1|2|3|4)=>a[k]+(b[k]-a[k])*t;
  return {position:{azimuth:mix(1),elevation:mix(2),distance:mix(3)},level:mix(4)};
}

/** Neon rain: standing on the stones by the pond, the tea house to the left, the city off to the right. */
const rain:SoundMap={
  // Calibrated by scripts/verify-mix.mjs: at least 18 dB under the music in every measured window.
  trim:.1,
  beds:[
    {name:'garden',file:'garden',seconds:30,arrival:1,evening:.85,arc:'foreground'},
    {name:'roof',file:'roof',seconds:26,arrival:.72,evening:.62,arc:'foreground',position:{azimuth:-38,elevation:28,distance:5}},
    {name:'pond',file:'pond',seconds:23.2,arrival:.55,evening:.5,arc:'water',position:{azimuth:8,elevation:-22,distance:4}},
  ],
  spots:[
    {name:'drips',file:'drips',variants:8,slot:.6,period:3.4,chance:.7,spread:9,arrival:.9,evening:1.15,arc:'foreground',position:{azimuth:-30,elevation:4,distance:4}},
    {name:'gutter',file:'gutter',variants:3,slot:4,period:26,chance:.65,spread:6,arrival:.8,evening:.6,arc:'foreground',position:{azimuth:-62,elevation:-6,distance:3}},
    // The city warms and quietens as its windows light.
    {name:'city',file:'city',variants:3,slot:4,period:15,chance:.6,spread:12,arrival:.9,evening:.62,arc:'distance',lowpass:[1400,800],position:{azimuth:58,elevation:3,distance:60}},
  ],
};

/** Last light station: under the platform's eave, the clock and a lantern above to the left, the tracks running
 * away to the right past the village and its viaduct. */
const snow:SoundMap={
  // Calibrated by scripts/verify-mix.mjs: at least 18 dB under the music in every measured window, a little quieter than rain.
  trim:.125,
  beds:[
    // Wind in the snowy trees all round, easing as the evening settles.
    {name:'wind',file:'wind',seconds:32,arrival:1,evening:.8,arc:'distance'},
    // The lantern on its post hisses a little brighter as the lamps come up.
    {name:'lantern',file:'lantern',seconds:12,arrival:.12,evening:.28,arc:'lamps',position:{azimuth:across(.2),elevation:12,distance:2.5}},
  ],
  spots:[
    // The station clock, heard whenever the wind drops.
    {name:'clock',file:'clock',variants:3,slot:3,period:11,chance:.55,spread:2,arrival:.55,evening:.7,arc:'foreground',position:{azimuth:across(.24),elevation:25,distance:3}},
    // Now and then the wind carries a peal or a dog up from the village.
    {name:'peal',file:'peal',variants:3,slot:6,period:150,chance:.4,spread:6,arrival:.9,evening:.7,arc:'distance',lowpass:[2400,1600],position:{azimuth:across(.53),elevation:-4,distance:800}},
    {name:'dog',file:'dog',variants:4,slot:2.5,period:170,chance:.3,spread:10,arrival:.8,evening:.6,arc:'distance',lowpass:[2000,1500],position:{azimuth:across(.66),elevation:-5,distance:500}},
  ],
  // The evening train: it runs in from the left, waits at the village (quieter, idling), then pulls away to the right,
  // swelling just over the wind as it passes.
  movers:[{kind:'train',name:'train',file:'train',seconds:12,level:1.6,lowpass:1200,path:[
    [0,across(.21),-3,320,.3],[.16,across(.435),-3,300,.8],[.318,across(.66),-3,290,.7],[.36,across(.66),-3,290,.35],
    [.59,across(.66),-3,290,.35],[.62,across(.66),-3,290,.7],[.75,across(.738),-3,300,.9],[.9,across(.9),-3,310,.8],[1,across(1.05),-3,330,.4],
  ]}],
};

/** Golden hour: by the pond in the clearing, the arch and the bench to the left, the big tree to the right, the valley ahead. */
const meadow:SoundMap={
  // Calibrated by scripts/verify-mix.mjs: at least 18 dB under the music in every measured window.
  trim:.1,
  beds:[
    // The meadow all round (grass, insects and far birds), quietening as the light leaves the clearing.
    {name:'grass',file:'grass',seconds:26,arrival:1,evening:.6,arc:'foreground'},
    // The big tree's leaves above to the right; the breeze drops in the evening.
    {name:'tree',file:'tree',seconds:24,arrival:.8,evening:.5,arc:'sky',position:{azimuth:across(.85),elevation:28,distance:8}},
    {name:'pond',file:'pond',seconds:20,arrival:.45,evening:.45,arc:'water',position:{azimuth:across(.55),elevation:-22,distance:4}},
  ],
  spots:[
    // A blackbird in the tree, by the arch and far down the valley; it sings on into the dusk.
    {name:'birds',file:'birds',variants:5,slot:3.5,period:9,chance:.55,spread:6,arrival:.9,evening:.55,arc:'sky',position:{azimuth:across(.85),elevation:22,distance:12},
      elsewhere:[{azimuth:across(.2),elevation:12,distance:15},{azimuth:across(.55),elevation:4,distance:60}]},
    // Bees in the flowers either side by day; none once the light has gone.
    {name:'bees',file:'bees',variants:4,slot:4,period:14,chance:.5,spread:5,arrival:.8,evening:0,arc:'foreground',position:{azimuth:across(.08),elevation:-15,distance:2},
      elsewhere:[{azimuth:across(.92),elevation:-15,distance:2}]},
    // Crickets in the grass as the light goes.
    {name:'crickets',file:'crickets',variants:4,slot:3,period:7,chance:.6,spread:6,arrival:0,evening:.7,arc:'foreground',position:{azimuth:-30,elevation:-10,distance:5},
      elsewhere:[{azimuth:28,elevation:-8,distance:6},{azimuth:5,elevation:-6,distance:10}]},
  ],
  // House martins call as the flock crosses the sky.
  calls:[{kind:'birds',name:'martins',file:'martins',variants:6,slot:2,period:1.4,chance:.7,spread:5,level:.8,path:[[0,across(.37),18,30,.8],[.5,across(.585),20,28,1],[1,across(.8),18,30,.8]]}],
};

/** The last chapter: at the reading room's open door, the curtain to the left, the bay below, the moored boat and
 * the harbour town to the right. */
const coast:SoundMap={
  // Calibrated by scripts/verify-mix.mjs: at least 18 dB under the music in every measured window.
  trim:.11,
  beds:[
    // The bay washing on the rocks below, wide across the view.
    {name:'sea',file:'sea',seconds:21,arrival:1,evening:.85,arc:'water'},
    // The harbour town's evening far off to the right, quieter and warmer as its windows light.
    {name:'town',file:'town',seconds:24,arrival:.5,evening:.35,arc:'distance',lowpass:[1100,700],position:{azimuth:across(.9),elevation:-2,distance:150}},
  ],
  spots:[
    {name:'curtain',file:'curtain',variants:4,slot:3,period:16,chance:.45,spread:4,arrival:.7,evening:.5,arc:'foreground',position:{azimuth:across(.3),elevation:8,distance:2}},
    // The moored boat's chains, and a bell buoy far out on the bay.
    {name:'chains',file:'chains',variants:3,slot:2.2,period:20,chance:.5,spread:4,arrival:.6,evening:.6,arc:'water',lowpass:[5000,4000],position:{azimuth:across(.74),elevation:-6,distance:60}},
    {name:'buoy',file:'buoy',variants:4,slot:2.6,period:40,chance:.4,spread:5,arrival:.6,evening:.7,arc:'water',lowpass:[3000,2400],position:{azimuth:across(.56),elevation:-3,distance:400}},
    // Gulls overhead and over the town, settling as the evening comes.
    {name:'gulls',file:'gulls',variants:6,slot:2.2,period:28,chance:.45,spread:12,arrival:.8,evening:.25,arc:'sky',position:{azimuth:-5,elevation:35,distance:40},
      elsewhere:[{azimuth:across(.95),elevation:20,distance:90}]},
  ],
  // A boat's engine along the horizon: a low thrum, about as loud as the sea below it.
  movers:[{kind:'boat',name:'engine',file:'engine',seconds:10,level:1.2,lowpass:500,path:[[0,across(.52),-3,300,.8],[.5,across(.6),-3,280,1],[1,across(.68),-3,300,.8]]}],
  // When birds cross the sky here, they are gulls.
  calls:[{kind:'birds',name:'gull-calls',file:'gulls',variants:6,slot:2.2,period:3,chance:.55,spread:8,level:.8,path:[[0,across(.37),20,50,.8],[.5,across(.585),22,45,1],[1,across(.8),20,50,.8]]}],
};

export const SOUND_MAPS:Partial<Record<Mood,SoundMap>>={rain,snow,meadow,coast};
