import type {Track} from '../music/composer';
import {sessionAt,type MusicSessionPlan,type SessionState} from '../session/session';

/** Everything that defines a Motes clip (docs/superpowers/specs/2026-10-03-clip-export-design.md). */
export const CLIP={
  seconds:15,fps:30,width:1080,height:1920,
  /** The scene lays out as a phone viewport, so rain and lamps keep their phone proportions. */
  viewport:{width:405,height:720},
  /** Painted light settles at 3,000 s and the dusk grade at 95% of the hour. */
  evening:3420,settleBy:13,
  pan:[.15,.85],
  titleFrom:12,titleFade:.8,
  fadeIn:.3,fadeOut:1.5,
  videoBitrate:4e6,audioBitrate:160e3,sampleRate:48000,
} as const;
export const FRAMES=CLIP.seconds*CLIP.fps;

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};

export interface ClipFrame {time:number;listening:number;pan:number;title:number}

/** What frame `index` shows: picture time, listening time, horizontal crop position and title opacity. */
export function clipFrame(index:number):ClipFrame {
  const time=index/CLIP.fps,[from,to]=CLIP.pan;
  return {time,listening:CLIP.evening*smooth(time/CLIP.settleBy),pan:from+(to-from)*smooth(time/CLIP.seconds),
    title:smooth((time-CLIP.titleFrom)/CLIP.titleFade)};
}

/** The scenery's session at a frame's listening time. Session events would flicker past at 200×, so the clip samples
 *  a plan without them: emptying `events` afterwards would still leave the rain's shower surging through `weather`. */
export const clipSession=(plan:MusicSessionPlan,listening:number):SessionState=>sessionAt({...plan,events:[]},listening);

/** The clip's music starts where the song first states its theme, not in the sparse intro. */
export function musicStartBeat(track:Pick<Track,'sections'>):number {
  return (track.sections.find(section=>section.role==='head')?.startBar??0)*4;
}

export const clipName=(slug:string,day:string)=>`motes-${slug}-${day}.mp4`;

/** Gain towards −18 dBFS RMS, limited so peaks stay at or below −1.5 dBFS for AAC's true-peak overshoot. */
export function loudnessGain(rms:number,peak:number):number {
  if(!(rms>0)||!(peak>0))return 1;
  return Math.min(10**(-18/20)/rms,10**(-1.5/20)/peak);
}
