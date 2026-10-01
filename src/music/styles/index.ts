import type { MusicMode, ScoreEvent, Track } from '../composer';
import type { Place } from '../../places';
import type { SoundGraph } from '../sound';
import lofi from './lofi';
import dreamy from './dreamy';
import driving from './driving';

export interface Slot {index:number;start:number;duration:number;chapter:string;arrangement:{bpm:number}}
/** `pump`, `echo` and `synth`, where a bank has them, are its sidechain gain, echo return and effects input, read by checks. */
export interface SoundBank {schedule(event:ScoreEvent,time:number,secondsPerBeat:number,track:Track):void;setMode(mode:MusicMode):void;stop(at:number,from:number):void;readonly pump?:GainNode;readonly echo?:GainNode;readonly synth?:GainNode}
/** One kind of music: how it plans an hour, writes songs, names its instruments and voices them in its own bank. */
export interface MusicStyle {
  id:string;lookahead:number;
  /** The atmosphere level under this style in a place whose own music differs (1 when unset). */
  away?:number;
  limits:{bpm:readonly [number,number];grid:2|4;perBar:number;meanPerBar:number;perTrack:number};
  planHour(random:()=>number,place:Place,seed:number):Slot[];
  compose(seed:number,place:Place,slot:Slot,index:number):Track;
  labels:{preparing:string;voice(track:Pick<Track,'voice'|'darkness'|'family'>):string};
  bank(graph:SoundGraph,signal?:AbortSignal):Promise<SoundBank>;
}
export const STYLES={lofi,dreamy,driving} satisfies Record<string,MusicStyle>;
export type StyleId=keyof typeof STYLES;
// Not `in` (which accepts inherited keys) or Object.hasOwn (ES2022; this project targets ES2020).
export const isStyleId=(value:unknown):value is StyleId=>typeof value==='string'&&Object.keys(STYLES).includes(value);
export const styleOf=(style:string|undefined):MusicStyle=>isStyleId(style)?STYLES[style]:STYLES.lofi;
/** What plays here: the listener's pick if they made one, otherwise the place's own music. */
export const playingStyle=(place:Place,chosen?:StyleId):StyleId=>chosen??(isStyleId(place.music.style)?place.music.style:'lofi');
/** The atmosphere gain under a style here: its `away` level, except in its home place. */
export const atmosphereLevel=(place:Place,style:StyleId):number=>style===playingStyle(place)?1:styleOf(style).away??1;
