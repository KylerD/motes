import type {LightState} from './index';

export const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
export const TAU=Math.PI*2,mix=(a:number,b:number,t:number)=>a+(b-a)*t;
type Timing=readonly [start:number,duration:number];
export interface Arc {timing:readonly [sky:Timing,distance:Timing,foreground:Timing,water:Timing];lamps:Timing;captions:readonly string[];subtitles:readonly string[]}

/** A written lighting arc, held at its final state after an hour. */
export function arc(a:Arc):(t:number)=>LightState {
  return t=>{
    const [sky,distance,foreground,water]=a.timing.map(([start,duration])=>smooth((t-start)/duration));
    return {sky,distance,foreground,water,lamps:smooth((t-a.lamps[0])/a.lamps[1]),
      caption:a.captions[Math.min(3,Math.floor(t/900))],subtitle:a.subtitles[Math.min(2,Math.floor(t/1200))]};
  };
}
