import type { MusicMode, ScoreEvent, Track } from '../composer';
import type { Place } from '../../places';
import type { SoundGraph } from '../sound';
import lofi from './lofi';
import dreamy from './dreamy';
import synthwave from './synthwave';

export interface Slot {index:number;start:number;duration:number;chapter:string;arrangement:{bpm:number}}
/** `pump`, `echo` and `synth`, where a bank has them, are its sidechain gain, echo return and effects input, read by checks. */
export interface SoundBank {schedule(event:ScoreEvent,time:number,secondsPerBeat:number,track:Track):void;setMode(mode:MusicMode):void;stop(at:number,from:number):void;readonly pump?:GainNode;readonly echo?:GainNode;readonly synth?:GainNode}
/** One kind of music: how it plans an hour, writes songs, names its instruments and voices them in its own bank. */
export interface MusicStyle {
  id:string;lookahead:number;
  limits:{bpm:readonly [number,number];grid:2|4;perBar:number;meanPerBar:number;perTrack:number};
  planHour(random:()=>number,place:Place,seed:number):Slot[];
  compose(seed:number,place:Place,slot:Slot,index:number):Track;
  labels:{preparing:string;voice(track:Pick<Track,'voice'|'darkness'|'family'>):string};
  bank(graph:SoundGraph,signal?:AbortSignal):Promise<SoundBank>;
}
export const STYLES={lofi,dreamy,synthwave} satisfies Record<string,MusicStyle>;
export type StyleId=keyof typeof STYLES;
// Not `in` (which accepts inherited keys) or Object.hasOwn (ES2022; this project targets ES2020).
export const isStyleId=(value:unknown):value is StyleId=>typeof value==='string'&&Object.keys(STYLES).includes(value);
export const styleOf=(style:string|undefined):MusicStyle=>isStyleId(style)?STYLES[style]:STYLES.lofi;
