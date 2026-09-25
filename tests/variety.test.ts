import {describe,expect,it} from 'vitest';
import {createSession,composeSessionTrack} from '../src/session/session';
import type {Mood,Track} from '../src/music/composer';
import {harmonyGrams,jaccard,median,melodyGrams,rhythmGrams,weightedJaccard} from './similarity';

const hours=(['rain','meadow','snow','coast'] as Mood[]).flatMap(mood=>[20260917,4242].map(seed=>{
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
      expect(jaccard(melodyGrams(hour[0]),melodyGrams(hour[17]))).toBeGreaterThanOrEqual(.6);
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
