import {describe,expect,it} from 'vitest';
import {createSession,composeSessionTrack} from '../src/session/session';
import type {Mood,Track} from '../src/music/composer';
import {harmonyGrams,jaccard,median,melodyGrams,rhythmGrams,weightedJaccard} from './similarity';

// Session plans depend on the seed alone, so every fixture uses its own seed.
const hours=(['rain','meadow','snow','coast'] as Mood[]).flatMap((mood,m)=>[20260917+m,4242+m*7].map(seed=>{
  const plan=createSession(seed,mood);return plan.slots.map((_,i)=>composeSessionTrack(plan,i));
}));

function melodyGramList(track:Track):string[] {
  const notes=track.events.filter(e=>e.instrument==='melody');
  const steps=notes.slice(1).map((e,i)=>`${e.note-notes[i].note}:${Math.round((e.beat-notes[i].beat)*2)}`);
  return steps.slice(3).map((_,i)=>steps.slice(i,i+4).join('|'));
}

describe('an hour of different songs',()=>{
  it('keeps neighbouring songs apart in comping, bass, melody and harmony',()=>{
    for(const hour of hours){
      const comp=hour.map(t=>rhythmGrams(t,['piano'])),bass=hour.map(t=>rhythmGrams(t,['bass'])),
        melody=hour.map(t=>melodyGrams(t)),harmony=hour.map(t=>harmonyGrams(t));
      for(let i=1;i<hour.length;i++){
        const where=`${hour[i].title} after ${hour[i-1].title}`;
        expect(weightedJaccard(comp[i-1],comp[i]),`comp: ${where}`).toBeLessThanOrEqual(.5);
        expect(weightedJaccard(bass[i-1],bass[i]),`bass: ${where}`).toBeLessThanOrEqual(.5);
        expect(jaccard(melody[i-1],melody[i]),`melody: ${where}`).toBeLessThanOrEqual(.3);
        expect(jaccard(harmony[i-1],harmony[i]),`harmony: ${where}`).toBeLessThanOrEqual(.5);
      }
      const pairs=(grams:Map<string,number>[])=>grams.flatMap((a,i)=>grams.slice(i+1).map(b=>weightedJaccard(a,b)));
      expect(median(pairs(comp))).toBeLessThanOrEqual(.5);
      expect(median(pairs(bass))).toBeLessThanOrEqual(.5);
    }
  });

  it('gives every song a hook that repeats and room between phrases',()=>{
    for(const track of hours.flat()){
      const grams=melodyGramList(track),counts=new Map<string,number>();
      for(const g of grams)counts.set(g,(counts.get(g)??0)+1);
      // Share of the melody's four-interval figures that are heard again: the hook.
      const repeated=grams.filter(g=>counts.get(g)!>=2).length/grams.length;
      expect(repeated,`${track.title} (${track.form})`).toBeGreaterThanOrEqual(.4);
      const from=track.sections.find(s=>s.role==='head')!.startBar;
      let silent=0;
      for(let bar=from;bar<track.bars;bar++)if(!track.events.some(e=>e.instrument==='melody'&&Math.round(e.beat*2)>=bar*8&&Math.round(e.beat*2)<bar*8+8))silent++;
      expect(silent/(track.bars-from),`${track.title} (${track.form})`).toBeGreaterThanOrEqual(.25);
    }
  });

  it('returns to the opening theme at the end of the hour without repeating whole songs',()=>{
    for(const hour of hours){
      // The theme is stated in the head; the rest of each song (form, middle, turnaround) may differ.
      const head=(t:Track)=>{const h=t.sections.find(s=>s.role==='head')!;return {...t,events:t.events.filter(e=>e.beat>=h.startBar*4-.05&&e.beat<h.endBar*4-.05)};};
      expect(jaccard(melodyGrams(head(hour[0])),melodyGrams(head(hour[17])))).toBeGreaterThanOrEqual(.6);
      for(const [a,b] of [[15,16],[15,17],[16,17],[0,17]])expect(hour[a].events).not.toEqual(hour[b].events);
    }
  });

  it('stays no busier than before',()=>{
    let total=0,bars=0;
    for(const track of hours.flat()){
      const perBar=new Array(track.bars).fill(0);
      for(const e of track.events)perBar[Math.min(track.bars-1,Math.floor(e.beat/4))]++;
      expect(Math.max(...perBar),`${track.title} (${track.form})`).toBeLessThanOrEqual(34);
      total+=track.events.length;bars+=track.bars;
    }
    expect(total/bars).toBeLessThanOrEqual(19);
  });

  it('states a theme as a tune, not a drone',()=>{
    let narrow=0,long=0;
    for(const track of hours.flat()){
      const head=track.sections.find(s=>s.role==='head')!;
      const statement=track.events.filter(e=>e.instrument==='melody'&&e.beat>=head.startBar*4-.05&&e.beat<head.startBar*4+8-.05);
      const distinct=new Set(statement.map(e=>e.note)).size;
      expect(distinct,`${track.title}: ${statement.map(e=>e.note)}`).toBeGreaterThanOrEqual(2);
      // A two-note figure is occasionally a real motif; it must not become the norm.
      if(statement.length>=4){long++;if(distinct<3)narrow++;}
      expect(statement.filter(e=>e.note>=80).length,`${track.title} crowds the ceiling`).toBeLessThanOrEqual(2);
    }
    expect(narrow/long,'share of two-pitch theme statements').toBeLessThan(.1);
    const melody=hours.flat().flatMap(t=>t.events.filter(e=>e.instrument==='melody'));
    expect(melody.filter(e=>e.note>=80).length/melody.length,'share of melody notes at the ceiling').toBeLessThan(.05);
  });

  it('sounds both chords of a two-chord bar, in bass and piano, without smearing them together',()=>{
    for(const track of hours.flat())track.harmony.forEach((chords,bar)=>{
      if(chords.length<2||bar===track.bars-1)return;
      const second=chords[1],from=bar*4+2-.05,to=bar*4+4-.05,where=`${track.title} bar ${bar}`;
      expect(track.events.some(e=>e.instrument==='piano'&&e.beat>=from&&e.beat<to&&second.notes.includes(e.note)),`piano: ${where}`).toBe(true);
      expect(track.events.some(e=>e.instrument==='bass'&&e.beat>=from&&e.beat<bar*4+3.5-.05&&e.note%12===second.root%12),`bass: ${where}`).toBe(true);
      const ringing=track.events.filter(e=>e.instrument==='piano'&&e.beat>=bar*4-.05&&e.beat<from&&e.beat+e.duration>bar*4+2+.15);
      expect(ringing.map(e=>e.note),`ringing: ${where}`).toEqual([]);
    });
  });

  it('voices every chord as a sorted shell in the warm register',()=>{
    for(const track of hours.flat())for(const chord of track.harmony.flat()){
      expect([...chord.notes].sort((a,b)=>a-b)).toEqual(chord.notes);
      expect(chord.notes[0]).toBeGreaterThanOrEqual(55);
      expect(chord.notes.at(-1)).toBeLessThanOrEqual(74);
    }
  });

  it('lets the bass state the loop from the first bar',()=>{
    for(const track of hours.flat())for(let bar=0;bar<4;bar++)
      expect(track.events.some(e=>e.instrument==='bass'&&Math.round(e.beat*2)===bar*8&&e.note%12===track.harmony[bar][0].root%12),`${track.title} bar ${bar}`).toBe(true);
  });

  it('never leaves a bar without a chord sounding',()=>{
    for(const track of hours.flat()){
      const piano=track.events.filter(e=>e.instrument==='piano');
      for(let bar=0;bar<track.bars;bar++){
        const covered=piano.some(e=>(e.beat>=bar*4-.05&&e.beat<bar*4+4)||(e.beat<bar*4&&e.beat+e.duration>bar*4+.5));
        expect(covered,`${track.title} (${track.form}) bar ${bar}`).toBe(true);
      }
    }
  });
});
