import {randomSource,type Mood,type Track} from '../music/composer';
import {isStyleId,styleOf,type Slot,type StyleId} from '../music/styles';
import {placeById} from '../places';
import {clamp,smooth} from '../places/light';

export interface SessionEvent {kind:string;start:number;duration:number}
export interface ActiveEvent {kind:string;progress:number;strength:number}
export interface SessionPlan {seed:number;mood:Mood;style:StyleId;duration:number;slots:Slot[];events:SessionEvent[]}
export interface SessionState {elapsed:number;progress:number;chapter:string;dusk:number;warmth:number;weather:number;lamps:number;events:ActiveEvent[]}

/** A written hour. The place's own style times the scenery; the selected style, which may differ, writes the music. */
export function createSession(seed:number,mood:Mood,style?:string):SessionPlan {
  const place=placeById(mood),own:StyleId=isStyleId(place.music.style)?place.music.style:'lofi',random=randomSource(seed^0x527a91);
  const home=styleOf(own).planHour(random,place,seed);
  const events:SessionEvent[]=place.environment.events.map(({kind,slot,duration,beats})=>({kind,start:home[slot].start+(beats!==undefined?beats*60/home[slot].arrangement.bpm:35)+random()*(beats!==undefined?5:25),duration}));
  const chosen=isStyleId(style)?style:own;
  // Another style plans from a fresh stream, so the scenery never depends on the music.
  const slots=chosen===own?home:styleOf(chosen).planHour(randomSource(seed^0x527a91),place,seed);
  return {seed,mood,style:chosen,duration:3600,slots,events};
}

/** After the hour, the style continues each slot's shape with fresh material, so nothing replays. */
export function composeSessionTrack(plan:SessionPlan,index:number):Track {
  const safeIndex=Math.max(0,Math.floor(index)),cycle=Math.floor(safeIndex/plan.slots.length),slot=plan.slots[safeIndex%plan.slots.length];
  const place=placeById(plan.mood),track=styleOf(plan.style).compose(plan.seed,place,slot,safeIndex);
  track.session={seed:plan.seed,offset:cycle*plan.duration+slot.start};
  return track;
}

/** Stateless sampling makes hidden-tab recovery and seeking skip old events instead of replaying them. */
export function sessionAt(plan:SessionPlan,seconds:number):SessionState {
  const elapsed=Math.max(0,Number.isFinite(seconds)?seconds:0),progress=clamp(elapsed/plan.duration);
  const slot=[...plan.slots].reverse().find(s=>s.start<=elapsed)??plan.slots[0];
  const dusk=smooth((progress-.10)/.85);
  const events=plan.events.flatMap(event=>{
    const p=(elapsed-event.start)/event.duration;
    return p>=0&&p<1?[{kind:event.kind,progress:p,strength:smooth(p/.12)*smooth((1-p)/.12)}]:[];
  });
  const weather=placeById(plan.mood).environment.weather({progress,dusk,events});
  return {elapsed,progress,chapter:elapsed>=plan.duration?'After hours':slot.chapter,
    dusk,warmth:Math.sin(Math.PI*progress)*.7,weather,lamps:smooth((progress-.25)/.55),events};
}
