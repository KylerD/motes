import type { Mood } from '../../composer';
import { randomSource } from '../../composer/random';
import type { MusicStyle } from '../index';
import { CHAPTERS } from '../lofi';
import { planSynthwave, synthTheme, type SynthArrangement } from './catalog';
import { composeSynthwave } from './composer';
import { dreamyBank } from './bank';

const FAMILIES:Record<string,string>={arpeggio:'Arpeggios & warm pads',pulse:'Pulsing bass',drift:'Drifting pads',lead:'Night-drive melodies'};

/** Dreamy night-drive synthwave: warm pads, rolling bass and echoing hooks, with its own seeded hour in every place. */
export default {
  id:'dreamy',lookahead:6,
  limits:{bpm:[84,112],grid:4,perBar:48,meanPerBar:32,perTrack:4200},
  planHour(_random,_place,seed) {
    let start=0;
    return planSynthwave(seed).map((arrangement,index)=>{
      const duration=arrangement.bars*240/arrangement.bpm;
      const slot={index,start,duration,chapter:CHAPTERS[Math.floor(index/3)],arrangement};start+=duration;return slot;
    });
  },
  compose(seed,place,slot,index) {
    const written=slot.arrangement as SynthArrangement;
    const arrangement=index>=18?{...written,energy:Math.min(.56,written.energy),theme:synthTheme(randomSource(seed^Math.imul(index+1,0x2545f491)))}:written;
    return composeSynthwave(seed,place.id as Mood,index,arrangement);
  },
  labels:{name:'Dreamy',preparing:'Warming up the synths…',voice:t=>FAMILIES[t.family??'arpeggio']??FAMILIES.arpeggio},
  bank:dreamyBank,
} satisfies MusicStyle;
