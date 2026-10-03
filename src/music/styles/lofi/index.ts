import {LOOPS,MELODY_CELLS,composeTrack,formBars,makeTheme,type Arrangement,type CompCell,type FormName,type GrooveCell,type KeyVoice,type Mode,type Mood,type Theme} from '../../composer';
import {pick,pickFewest,randomSource} from '../../composer/random';
import type {MusicStyle} from '../index';
import {lofiBank} from './sound';

export const CHAPTERS=['Arriving','Settling in','The long way home','Room to breathe','Lamplight','Stay a little longer'];
const voices:KeyVoice[]=['upright','felt','upright','electric','upright','electric','vibes','upright','felt','felt','vibes','felt','electric','upright','vibes','upright','felt','upright'];
const tempos=[74,74,76,76,78,80,80,78,76,74,72,72,74,76,78,80,78,74];
const energy=[.68,.7,.78,.85,.88,.94,.88,.8,.7,.55,.5,.58,.7,.8,.78,.8,.66,.5];
const keySteps=[0,0,0,5,5,0,0,7,7,0,0,5,5,0,0,7,0,0];

const forms:Record<string,FormName>={B:'beat-tape',H:'hook',L:'long',N:'nocturne'};
/** Authored song shapes for the hour: 1128 bars each, no neighbours alike, nocturnes at 10 and 16, never on the train's track. */
export const FORM_SEQUENCES:FormName[][]=['BLHLBLHBLHNLBHLBNH','HLBHLBLHBLNBLHBLNH','BHLBLHLBLHNLHBLHNB'].map(s=>[...s].map(c=>forms[c]));
const compsFor:Record<FormName,CompCell[]>={'beat-tape':['roll','stab','charleston','push'],hook:['push','stab','roll','halves'],long:['charleston','halves','stab','roll'],nocturne:['halves']};
const grooves:GrooveCell[]=['home','skip','late','lean'];

/** Warm jazzy lofi: a written hour of piano songs whose shapes, loops, grooves and themes make a sequence. */
export default {
  id:'lofi',lookahead:6,
  limits:{bpm:[68,88],grid:2,perBar:34,meanPerBar:19,perTrack:2600},
  planHour(random) {
    const tonic=[0,2,3,5,7,8,10][Math.floor(random()*7)];
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
      loops.push(i===17?loops[0]:pickFewest(random,loops,candidates,loops[i-1]));
      const nextIsNocturne=sequence[i+1]==='nocturne';
      // Charleston songs spend half their phrases in halves, so the two never sit side by side.
      const previous=comps[i-1],cousin:CompCell|undefined=previous==='charleston'?'halves':previous==='halves'?'charleston':undefined;
      comps.push(pick(random,compsFor[form].filter(c=>mode==='major'||c!=='stab'),[previous,cousin,nextIsNocturne?'halves':undefined,nextIsNocturne?'charleston':undefined]));
      grooveCells.push(pick(random,grooves,[grooveCells[i-1]]));
    });
    let start=0;
    return raw.map((bpm,index)=>{
      const form=sequence[index],tempo=bpm*scale,duration=formBars(form)*4*60/tempo;
      const arrangement:Arrangement={bpm:tempo,tonic:(tonic+keySteps[index])%12,voice:voices[index],energy:energy[index],swing,
        form,mode:minor.has(index)?'minor':'major',loop:loops[index],comp:comps[index],groove:grooveCells[index],theme:themes[index],stretch:stretch.has(index)};
      const slot={index,start,duration,chapter:CHAPTERS[Math.floor(index/3)],arrangement};start+=duration;return slot;
    });
  },
  /** After the hour, the same shapes continue quietly with fresh themes, so nothing replays. */
  compose(seed,place,slot,index) {
    const written=slot.arrangement as Arrangement;
    const arrangement=index>=18?{...written,energy:Math.min(.66,written.energy),stretch:false,theme:makeTheme(randomSource(seed^Math.imul(index+1,0x2545f491)))}:written;
    return {...composeTrack(seed,place.id as Mood,index,arrangement),style:'lofi'};
  },
  labels:{preparing:'Preparing the piano…',voice:t=>({upright:'Upright piano',felt:'Felt piano',electric:'Electric keys',vibes:'Soft mallets'} as Record<string,string>)[t.voice]??'Upright piano'},
  bank:lofiBank,
} satisfies MusicStyle;
