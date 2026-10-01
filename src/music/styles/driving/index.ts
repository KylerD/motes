import {chooser,pick,randomSource} from '../../composer/random';
import type {MusicStyle,Slot} from '../index';
import {SYNTH_FORMS,SYNTH_LOOPS,type ArpCell,type BassPattern,type SynthForm,type SynthPatch} from './library';
import {composeSynthSong,makeHook,type SynthArrangement} from './song';
import {synthBank} from './sound';

const CHAPTERS=['Sunset','The drive','Night falls','Neon','The storm','Midnight'];
const F:Record<string,SynthForm>={C:'cruise',D:'drive',E:'descent',S:'slowburn'};
/** Authored song shapes for the hour: 1880 bars each, slow burners at 7 and 13, cruising at both ends. */
export const SEQUENCES:SynthForm[][]=['CDCDCDESEDECESDEDC','CDCDEDCSEDEDCSEDEC','CDCDCDESDECEDSEDEC'].map(s=>[...s].map(c=>F[c]));
export const NOMINAL=[108,111,113,121,124,126,126,92,128,129,131,132,134,93,137,139,141,138];
export const DARKNESS=[0,.08,.16,.24,.3,.36,.44,.5,.56,.62,.68,.72,.78,.84,.88,.92,.96,1];
const ENERGY=[.7,.75,.8,.85,.9,.95,.9,.6,.9,.9,.92,.95,.95,.65,.97,1,1,.95];
const KEY_STEPS=[0,0,0,5,5,0,0,7,7,0,0,5,5,0,0,7,0,0],TONICS=[9,1,3,11,5,4,10,2,0];
/** One patch per song, rotated like the lofi pianos: no neighbours alike, glass bells at sunset, darksynth into the storm,
 *  and the return (17) never on the opening's patch, so the hour after it never opens on the same sound. */
export const VOICES:SynthPatch[]=['glass','pulse','glass','analog','glass','pulse','analog','glass','pulse','analog','dark','pulse','dark','analog','dark','pulse','dark','analog'];
/** Which part carries the choruses. The opening and its return sing the hour's hook. */
export const FOCUS:('lead'|'arp')[]=['lead','arp','lead','arp','lead','arp','lead','arp','lead','arp','lead','arp','lead','lead','arp','lead','arp','lead'];
const LABELS:Record<SynthPatch,string>={analog:'Analog synths',pulse:'Soft pulse',glass:'Glass bells',dark:'Darksynth'};
const SUBTITLES=['top floor','engine off','the long way round','low beams','after the rain','one more lap'];
const barsOf=(form:SynthForm)=>SYNTH_FORMS[form].reduce((sum,[,bars])=>sum+bars,0);

/** After hours: at least as dark as the storm, a little quieter and a fresh hook each song. Where the hour turns over,
 *  a loop drawn from the dark range, so song 18 never replays song 17's sunset loop. */
function afterHours(a:SynthArrangement,slot:number,random:()=>number):SynthArrangement {
  const darkness=Math.max(.8,a.darkness),hook=makeHook(random);
  const loop=slot===0?pick(random,SYNTH_LOOPS.filter(l=>darkness>=l.darkness[0]&&darkness<=l.darkness[1]).map(l=>l.id),[]):a.loop;
  return {...a,darkness,energy:a.energy*.85,lift:false,hook,loop};
}

function planHour(random:()=>number):Slot[] {
  const tonic=TONICS[Math.floor(random()*TONICS.length)],sequence=SEQUENCES[Math.floor(random()*SEQUENCES.length)];
  // One common tempo scale lands the hour on exactly 3,600 s.
  const scale=sequence.reduce((sum,form,i)=>sum+barsOf(form)*240/NOMINAL[i],0)/3600;
  const hour=makeHook(random),loops:string[]=[],arps:ArpCell[]=[],grooves:BassPattern[]=[];
  sequence.forEach((form,i)=>{
    // Loops open by darkness; the opening starts on its tonic, and the least-heard loops come first.
    const open=SYNTH_LOOPS.filter(l=>DARKNESS[i]>=l.darkness[0]&&DARKNESS[i]<=l.darkness[1]&&(i!==0||l.bars[0].degree===0)).map(l=>l.id);
    const uses=(id:string)=>loops.filter(x=>x===id).length,fewest=Math.min(...open.filter(id=>id!==loops[i-1]).map(uses));
    loops.push(i===17?loops[0]:pick(random,open.filter(id=>uses(id)===fewest),[loops[i-1]]));
    // The last song also avoids the first's arpeggio and groove, which the hour after it opens with.
    arps.push(pick(random,form==='slowburn'?['eighth','up16']:['eighth','up16','updown16','octave16','broken16'],[arps[i-1],i===17?arps[0]:undefined]));
    grooves.push(form==='slowburn'?'pulse':pick(random,['sixteenths','octaves','gallop'],[grooves[i-1],i===17?grooves[0]:undefined]));
  });
  let start=0;
  return sequence.map((form,index)=>{
    const bpm=NOMINAL[index]*scale,duration=barsOf(form)*240/bpm;
    const arrangement:SynthArrangement={bpm,tonic:(tonic+KEY_STEPS[index])%12,darkness:DARKNESS[index],energy:ENERGY[index],form,voice:VOICES[index],focus:FOCUS[index],
      loop:loops[index],arp:arps[index],groove:grooves[index],hook:index===0||index===17?hour:makeHook(random),lift:index===17};
    const slot={index,start,duration,chapter:CHAPTERS[Math.floor(index/3)],arrangement};start+=duration;return slot;
  });
}

/** A night drive from sunset to the storm: darkness rises through the hour and never returns to sunset after it. */
export default {
  // Its pad-only intros sit nearer a lofi place's louder atmosphere, so away from Top deck the atmosphere drops 3.1 dB (verify-mix).
  id:'driving',lookahead:3,away:.7,
  limits:{bpm:[88,150],grid:4,perBar:64,meanPerBar:44,perTrack:6000},
  planHour,
  compose(seed,place,slot,index) {
    const songSeed=(seed^Math.imul(index+1,0x9e3779b1)^Math.imul(place.music.salt,0x45d9f3b))>>>0,choose=chooser(randomSource(songSeed));
    const title=`${choose(place.music.titles)} · ${choose(SUBTITLES)}`,written=slot.arrangement as SynthArrangement;
    const arrangement=index>=18?afterHours(written,slot.index,randomSource(seed^Math.imul(index+1,0x2545f491))):written;
    return {...composeSynthSong(arrangement,songSeed,title),index};
  },
  labels:{preparing:'Warming up the synths…',voice:t=>LABELS[t.voice as SynthPatch]??LABELS.analog},
  bank:synthBank,
} satisfies MusicStyle;
