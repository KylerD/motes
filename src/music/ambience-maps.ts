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

/** Places without a map yet keep their synthesised bed. */
export const SOUND_MAPS:Partial<Record<Mood,SoundMap>>={rain};
