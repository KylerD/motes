import {LOOPS,MELODY_CELLS,composeTrack,formBars,makeTheme,randomSource,type Arrangement,type CompCell,type FormName,type GrooveCell,type KeyVoice,type Mode,type Mood,type Theme,type Track} from '../music/composer';

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

const forms:Record<string,FormName>={B:'beat-tape',H:'hook',L:'long',N:'nocturne'};
/** Authored song shapes for the hour: 1128 bars each, no neighbours alike, nocturnes at 10 and 16, never on the train's track. */
export const FORM_SEQUENCES:FormName[][]=['BLHLBLHBLHNLBHLBNH','HLBHLBLHBLNBLHBLNH','BHLBLHLBLHNLHBLHNB'].map(s=>[...s].map(c=>forms[c]));
const compsFor:Record<FormName,CompCell[]>={'beat-tape':['roll','stab','charleston','push'],hook:['push','stab','roll','halves'],long:['charleston','halves','stab','roll'],nocturne:['halves']};
const grooves:GrooveCell[]=['home','skip','late','lean'];

/** Pick from options not used by the neighbours; the fallback order keeps assignment total. */
function pick<T>(random:()=>number,options:readonly T[],avoid:(T|undefined)[]):T {
  const open=options.filter(o=>!avoid.includes(o));
  return (open.length?open:options)[Math.floor(random()*(open.length||options.length))];
}

/** A written hour: song shapes, loops, grooves and themes make a sequence, not eighteen shuffled songs. */
export function createSession(seed:number,mood:Mood):SessionPlan {
  const random=randomSource(seed^0x527a91),tonic=[0,2,3,5,7,8,10][Math.floor(random()*7)];
  const swing=.082+random()*.02,sequence=FORM_SEQUENCES[Math.floor(random()*FORM_SEQUENCES.length)];
  const raw=tempos.map(bpm=>bpm+(random()-.5)*1.2);
  const scale=raw.reduce((sum,bpm,i)=>sum+formBars(sequence[i])*4*60/bpm,0)/3600;
  // Minor on both nocturnes and on one track in each of chapters 2, 3 and 5 where a neighbour isn't already minor (never the opening or the final return).
  const minor=new Set(sequence.flatMap((f,i)=>f==='nocturne'?[i]:[]));
  for(const chapter of [1,2,4,5]){const choices=[0,1,2].map(k=>chapter*3+k).filter(i=>i!==17&&!minor.has(i)&&!minor.has(i-1)&&!minor.has(i+1));if(choices.length)minor.add(choices[Math.floor(random()*choices.length)]);}
  const hour=makeTheme(random);
  const otherCell=()=>{let cell=hour.cell;while(cell===hour.cell)cell=Math.floor(random()*MELODY_CELLS.length);return cell;};
  // The hour's rhythm belongs to the opening, its approach (15, 16) and its return (17); other songs borrow its contour or go their own way.
  const themes:Theme[]=sequence.map((_,i)=>i===0||i===17?hour:i===15||i===16?makeTheme(random,hour.cell):i%3===1?makeTheme(random,otherCell(),hour.contour):makeTheme(random,otherCell()));
  const stretch=new Set(sequence.flatMap((f,i)=>f==='long'&&energy[i]>=.8?[i]:[]).slice(0,2));
  const loops:string[]=[],comps:CompCell[]=[],grooveCells:GrooveCell[]=[];
  sequence.forEach((form,i)=>{
    const mode:Mode=minor.has(i)?'minor':'major';
    // The opening (and so the final return) starts on its tonic, so the hour's first bar says where home is.
    const candidates=LOOPS.filter(l=>l.mode===mode&&(form!=='nocturne'||l.nocturne)&&(i!==0||l.bars[0][0][0]===0)).map(l=>l.id);
    // Spread the loop library across the hour: the least-heard loops come first.
    const uses=(id:string)=>loops.filter(l=>l===id).length,fewest=Math.min(...candidates.filter(id=>id!==loops[i-1]).map(uses));
    loops.push(i===17?loops[0]:pick(random,candidates.filter(id=>uses(id)===fewest),[loops[i-1]]));
    const nextIsNocturne=sequence[i+1]==='nocturne';
    // Charleston songs spend half their phrases in halves, so the two never sit side by side.
    const previous=comps[i-1],cousin:CompCell|undefined=previous==='charleston'?'halves':previous==='halves'?'charleston':undefined;
    comps.push(pick(random,compsFor[form].filter(c=>mode==='major'||c!=='stab'),[previous,cousin,nextIsNocturne?'halves':undefined,nextIsNocturne?'charleston':undefined]));
    grooveCells.push(pick(random,grooves,[grooveCells[i-1]]));
  });
  let start=0;
  const slots=raw.map((bpm,index)=>{
    const form=sequence[index],tempo=bpm*scale,duration=formBars(form)*4*60/tempo;
    const arrangement:Arrangement={bpm:tempo,tonic:(tonic+keySteps[index])%12,voice:voices[index],energy:energy[index],swing,
      form,mode:minor.has(index)?'minor':'major',loop:loops[index],comp:comps[index],groove:grooveCells[index],theme:themes[index],stretch:stretch.has(index)};
    const slot={index,start,duration,chapter:chapters[Math.floor(index/3)],arrangement};start+=duration;return slot;
  });
  const event=(kind:EventKind,index:number,duration:number):SessionEvent=>({kind,start:slots[index].start+(kind==='train'?96*60/slots[index].arrangement.bpm:35)+random()*(kind==='train'?5:25),duration});
  const events:SessionEvent[]=mood==='snow'?[event('train',8,110),event('windows',13,100)]
    :mood==='coast'?[event('birds',2,38),event('boat',7,150),event('birds',14,35)]
    :mood==='meadow'?[event('butterflies',1,65),event('butterflies',4,65),event('birds',6,38)]
    :[event('shower',5,280),event('windows',12,120)];
  return {seed,mood,duration:3600,slots,events};
}

/** After the hour, the same shapes continue quietly with fresh themes, so nothing replays. */
export function composeSessionTrack(plan:SessionPlan,index:number):Track {
  const safeIndex=Math.max(0,Math.floor(index)),cycle=Math.floor(safeIndex/plan.slots.length),slot=plan.slots[safeIndex%plan.slots.length];
  const arrangement=cycle?{...slot.arrangement,energy:Math.min(.66,slot.arrangement.energy),stretch:false,theme:makeTheme(randomSource(plan.seed^Math.imul(safeIndex+1,0x2545f491)))}:slot.arrangement;
  const track=composeTrack(plan.seed,plan.mood,safeIndex,arrangement);
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
