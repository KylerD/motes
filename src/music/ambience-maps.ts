import type {Mood} from './composer';

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
 * a spot plays with this `chance`, `spread` degrees either side of its position. */
export interface Spots extends Shape {variants:number;slot:number;period:number;chance:number;spread:number;position:Position}
export interface SoundMap {beds:readonly Bed[];spots:readonly Spots[];trim:number}

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
