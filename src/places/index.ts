import type {ActiveEvent,SessionState} from '../session/session';
import rain from './rain';
import meadow from './meadow';
import snow from './snow';
import coast from './coast';
import deck from './deck';

export type Point=readonly [number,number];
export interface Position {x:number;y:number}
export interface LightState {sky:number;distance:number;foreground:number;water:number;lamps:number;caption:string;subtitle:string}
export interface Space {width:number;height:number;iw:number;point:(u:number,v:number)=>Position}
export interface LayerInput {state:SessionState;time:number;space:Space;light:LightState;motion:boolean;seed:number}
export type Layer=((ctx:CanvasRenderingContext2D,input:LayerInput)=>void)&{kind?:string};
export interface EventPlan {kind:string;slot:number;duration:number;beats?:number}
export interface WeatherInput {progress:number;dusk:number;events:readonly ActiveEvent[]}
export type AmbienceTexture=(white:number,brown:number,soft:number,phase:number,channel:number)=>number;
export interface Place {
  id:string;name:string;title:string;weather:string;lights:readonly [string,string,string];
  image:string;eveningImage:string;anchor:number;color:string;
  water?:{outline:readonly Point[];from?:number;shimmer?:number;tint?:string};
  lamps:readonly Point[];steam?:Point;birds?:string;
  effect?:'rain'|'snow'|'pollen';
  fallback?:{tint:string;depth:number};
  light(seconds:number):LightState;
  regions(u:number,v:number):readonly [sky:number,distance:number,foreground:number];
  environment:{events:readonly EventPlan[];weather(input:WeatherInput):number};
  draw:readonly Layer[];
  ambience:{trim:number;texture:AmbienceTexture};
  music:{style:string;salt:number;titles:readonly string[];tempo:number};
}

/** Shown in Find a place, in this order. */
export const PLACES=[rain,meadow,snow,coast,deck] as const;
/** Reachable by id for music work and tests before their paintings exist; never shown. */
export const DRAFTS:readonly Place[]=[];
export type PlaceId=typeof PLACES[number]['id'];
/** Frozen: adding a place here would reshuffle every existing daily link. */
export const DAILY_PLACES=['rain','meadow','snow','coast'] as const;
export const placeById=(id:string):Place=>PLACES.find(p=>p.id===id)??DRAFTS.find(p=>p.id===id)??PLACES[0];
