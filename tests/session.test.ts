import {describe,it,expect} from 'vitest';
import {createSession,sessionAt,composeSessionTrack,FORM_SEQUENCES} from '../src/session/session';
import {LOOPS,formBars} from '../src/music/composer';
import type {Mood} from '../src/music/composer';

describe('an hour in a scene',()=>{
  it('reproduces eighteen contiguous arrangements spanning exactly one hour',()=>{
    const plan=createSession(42,'snow');
    expect(createSession(42,'snow')).toEqual(plan);
    expect(plan.slots).toHaveLength(18);
    let end=0;
    for(const slot of plan.slots){
      expect(slot.start).toBeCloseTo(end,8);
      expect(slot.duration).toBeCloseTo(formBars(slot.arrangement.form)*4*60/slot.arrangement.bpm,8);
      end+=slot.duration;
    }
    expect(end).toBeCloseTo(3600,8);
    expect(new Set(plan.slots.map(s=>s.arrangement.voice)).size).toBe(4);
    expect(new Set(plan.slots.map(s=>s.chapter)).size).toBe(6);
  });
  it('writes related, varied scores while returning to the opening theme',()=>{
    const plan=createSession(42,'coast');
    const scores=plan.slots.map((_,i)=>composeSessionTrack(plan,i));
    expect(scores[0].key).toBe(scores[17].key);
    expect(new Set(scores.map(s=>s.key)).size).toBeGreaterThan(1);
    expect(new Set(scores.map(s=>s.voice)).size).toBe(4);
    expect(scores.every(s=>s.session?.seed===42)).toBe(true);
    expect(scores[17].session!.offset+scores[17].bars*4*60/scores[17].bpm).toBeCloseTo(3600,7);
    expect(composeSessionTrack(createSession(43,'coast'),0).events).not.toEqual(scores[0].events);
  });
  it('keeps the scene continuous across chapter edges and quiet between events',()=>{
    const plan=createSession(7,'snow');
    for(const slot of plan.slots.slice(1)){
      const before=sessionAt(plan,slot.start-.01),after=sessionAt(plan,slot.start+.01);
      expect(Math.abs(after.dusk-before.dusk)).toBeLessThan(.001);
      expect(Math.abs(after.weather-before.weather)).toBeLessThan(.001);
    }
    const train=plan.events.find(e=>e.kind==='train')!;
    expect(train.duration).toBeGreaterThan(60);
    expect(sessionAt(plan,train.start+train.duration/2).events.some(e=>e.kind==='train')).toBe(true);
    expect(sessionAt(plan,train.start-1).events.some(e=>e.kind==='train')).toBe(false);
    expect(plan.events.reduce((sum,e)=>sum+e.duration,0)).toBeLessThan(720);
  });
  it('preserves the shared groove and playable scores through every instrumental change',()=>{
    for(const mood of ['rain','meadow','snow','coast'] as Mood[]){
      const plan=createSession(913,mood);
      // After hours shares the grid: check a few songs past the first hour too.
      for(const index of [...plan.slots.map(s=>s.index),18,19,27,35]){
        const track=composeSessionTrack(plan,index),bass=track.events.filter(e=>e.instrument==='bass');
        expect(track.bpm).toBeGreaterThan(68);expect(track.bpm).toBeLessThan(88);
        expect(track.events.length).toBeLessThan(2600);
        for(const event of track.events){
          expect(Number.isFinite(event.beat+event.duration+event.velocity+event.note)).toBe(true);
          expect(event.beat).toBeGreaterThanOrEqual(0);expect(event.beat).toBeLessThan(track.bars*4);
          if(event.instrument==='piano')continue;
          const eighth=Math.round(event.beat*2),grid=eighth/2+(eighth%2?track.swing:0);
          expect(Math.abs(event.beat-grid)).toBeLessThanOrEqual(.025);
          if(event.instrument==='kick')expect(bass.some(note=>Math.abs(note.beat-event.beat)<.015)).toBe(true);
        }
      }
    }
  });
  it('continues after the hour without rewinding the evening or replaying events',()=>{
    const plan=createSession(12,'meadow');
    expect(sessionAt(plan,3600).dusk).toBe(sessionAt(plan,7200).dusk);
    expect(sessionAt(plan,7200).events).toEqual([]);
    expect(sessionAt(plan,7200).chapter).toBe('After hours');
    expect(composeSessionTrack(plan,18).session!.offset).toBeCloseTo(3600);
    expect(composeSessionTrack(plan,18).events).not.toEqual(composeSessionTrack(plan,0).events);
  });
  it('plans song shapes, loops and grooves so neighbours never match',()=>{
    for(const sequence of FORM_SEQUENCES){
      expect(sequence).toHaveLength(18);
      expect(sequence.reduce((sum,f)=>sum+formBars(f),0)).toBe(1128);
      sequence.slice(1).forEach((f,i)=>expect(f).not.toBe(sequence[i]));
      expect(sequence[10]).toBe('nocturne');expect(sequence[16]).toBe('nocturne');expect(sequence[8]).not.toBe('nocturne');
      expect(['beat-tape','hook']).toContain(sequence[0]);expect(['beat-tape','hook']).toContain(sequence[17]);
    }
    for(const mood of ['rain','meadow','snow','coast'] as Mood[])for(let seed=0;seed<200;seed++){
      const plan=createSession(seed,mood),a=plan.slots.map(s=>s.arrangement);
      a.slice(1).forEach((x,i)=>{
        expect(x.loop).not.toBe(a[i].loop);expect(x.comp).not.toBe(a[i].comp);expect(x.groove).not.toBe(a[i].groove);
      });
      expect(a.filter(x=>x.stretch).length).toBeLessThanOrEqual(2);
      const counts=new Map<string,number>();for(const x of a.slice(0,17))counts.set(x.loop,(counts.get(x.loop)??0)+1);
      expect(Math.max(...counts.values()),'no loop dominates the hour').toBeLessThanOrEqual(2);
      expect(a[10].mode).toBe('minor');expect(a[16].mode).toBe('minor');expect(a[0].mode).toBe('major');
      expect(a[17].loop).toBe(a[0].loop);expect(a[17].theme).toEqual(a[0].theme);
      expect(LOOPS.find(l=>l.id===a[0].loop)!.bars[0][0][0],'the hour opens on its tonic').toBe(0);
      expect(a[15].theme.cell).toBe(a[0].theme.cell);expect(a[16].theme.cell).toBe(a[0].theme.cell);
      for(const x of a){expect(x.bpm).toBeGreaterThan(68);expect(x.bpm).toBeLessThan(88);}
      expect(plan.slots.reduce((sum,s)=>sum+s.duration,0)).toBeCloseTo(3600,6);
    }
  });
});
