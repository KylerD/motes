import {composeTrack,randomSource,type Arrangement,type KeyVoice,type Mood,type Track} from '../music/composer';

export interface SessionSlot {index:number;start:number;duration:number;chapter:string;arrangement:Arrangement}
export type EventKind='train'|'boat'|'birds'|'butterflies'|'shower'|'windows';
export interface SessionEvent {kind:EventKind;start:number;duration:number}
export interface ActiveEvent {kind:EventKind;progress:number;strength:number}
export interface SessionPlan {seed:number;mood:Mood;duration:number;slots:SessionSlot[];events:SessionEvent[]}
export interface SessionState {elapsed:number;progress:number;chapter:string;caption:string;dusk:number;warmth:number;weather:number;lamps:number;events:ActiveEvent[]}

const chapters=['Arriving','Settling in','The long way home','Room to breathe','Lamplight','Stay a little longer'];
const voices:KeyVoice[]=['upright','felt','upright','electric','upright','electric','vibes','upright','felt','felt','vibes','felt','electric','upright','vibes','upright','felt','upright'];
const tempos=[74,74,76,76,78,80,80,78,76,74,72,72,74,76,78,80,78,74];
const energy=[.68,.7,.78,.85,.88,.94,.88,.8,.7,.55,.5,.58,.7,.8,.78,.8,.66,.5];
const keySteps=[0,0,0,5,5,0,0,7,7,0,0,5,5,0,0,7,0,0];
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};

/** A written hour: tempo, colour and related keys make a sequence, not eighteen shuffled songs. */
export function createSession(seed:number,mood:Mood):SessionPlan {
  const random=randomSource(seed^0x527a91),tonic=[0,2,3,5,7,8,10][Math.floor(random()*7)];
  const theme=Math.floor(random()*4),swing=.082+random()*.02;
  const raw=tempos.map(bpm=>bpm+(random()-.5)*1.2);
  const scale=raw.reduce((sum,bpm)=>sum+256*60/bpm,0)/3600;
  let start=0;
  const slots=raw.map((bpm,index)=>{
    const duration=256*60/(bpm*scale);
    const arrangement:Arrangement={bpm:bpm*scale,tonic:(tonic+keySteps[index])%12,voice:voices[index],energy:energy[index],swing,
      motif:index>=15?theme:(theme+Math.floor(index/3))%4,progression:(theme+Math.floor(index/2))%4};
    const slot={index,start,duration,chapter:chapters[Math.floor(index/3)],arrangement};start+=duration;return slot;
  });
  const event=(kind:EventKind,index:number,duration:number):SessionEvent=>({kind,start:slots[index].start+(kind==='train'?96*60/slots[index].arrangement.bpm:35)+random()*(kind==='train'?5:25),duration});
  const events:SessionEvent[]=mood==='snow'?[event('train',8,110),event('windows',13,100)]
    :mood==='coast'?[event('birds',2,38),event('boat',7,150),event('birds',14,35)]
    :mood==='meadow'?[event('butterflies',1,65),event('butterflies',4,65),event('birds',6,38)]
    :[event('shower',5,280),event('windows',12,120)];
  return {seed,mood,duration:3600,slots,events};
}

export function composeSessionTrack(plan:SessionPlan,index:number):Track {
  const safeIndex=Math.max(0,Math.floor(index)),cycle=Math.floor(safeIndex/plan.slots.length),slot=plan.slots[safeIndex%plan.slots.length];
  const track=composeTrack(plan.seed,plan.mood,safeIndex,cycle?{...slot.arrangement,energy:Math.min(.66,slot.arrangement.energy)}:slot.arrangement);
  track.session={seed:plan.seed,offset:cycle*plan.duration+slot.start};
  return track;
}

const captions:Record<Mood,string[]>={
  rain:['Rain on the rooftops','A city settling down','A passing shower','The rain begins to ease','Warm windows, blue streets','A quieter kind of night'],
  meadow:['A slow golden afternoon','A breeze through the flowers','Clouds wandering home','The light turns to honey','Fireflies in the long grass','The last warmth of the day'],
  snow:['Snowfall at the station','Warmth behind the windows','The evening train','The quiet after a goodbye','Lamps along the platform','Snow, and nowhere to hurry'],
  coast:['A sea breeze at sunset','Pages turning slowly','A boat crossing the bay','The harbour grows quiet','Lamplight over the water','One more chapter, then another'],
};

/** Stateless sampling makes hidden-tab recovery and seeking skip old events instead of replaying them. */
export function sessionAt(plan:SessionPlan,seconds:number):SessionState {
  const elapsed=Math.max(0,Number.isFinite(seconds)?seconds:0),progress=clamp(elapsed/plan.duration);
  const slot=[...plan.slots].reverse().find(s=>s.start<=elapsed)??plan.slots[0];
  const chapterIndex=Math.floor(slot.index/3),dusk=smooth((progress-.10)/.85);
  const events=plan.events.flatMap(event=>{
    const p=(elapsed-event.start)/event.duration;
    return p>=0&&p<1?[{kind:event.kind,progress:p,strength:smooth(p/.12)*smooth((1-p)/.12)}]:[];
  });
  const shower=events.find(e=>e.kind==='shower')?.strength??0;
  const weather=plan.mood==='rain'?.88+.38*Math.sin(Math.PI*progress)-.28*dusk+.36*shower
    :plan.mood==='snow'?.7+.62*smooth(progress/.7):.82+.16*Math.sin(Math.PI*progress)-.15*dusk;
  return {elapsed,progress,chapter:elapsed>=plan.duration?'After hours':slot.chapter,caption:captions[plan.mood][chapterIndex],
    dusk,warmth:Math.sin(Math.PI*progress)*.7,weather,lamps:smooth((progress-.25)/.55),events};
}
