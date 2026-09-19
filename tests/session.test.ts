import {describe,it,expect} from 'vitest';
import {createSession,sessionAt,composeSessionTrack} from '../src/session/session';
import type {Mood} from '../src/music/composer';

describe('an hour in a scene',()=>{
  it('reproduces eighteen contiguous arrangements spanning exactly one hour',()=>{
    const plan=createSession(42,'snow');
    expect(createSession(42,'snow')).toEqual(plan);
    expect(plan.slots).toHaveLength(18);
    let end=0;
    for(const slot of plan.slots){
      expect(slot.start).toBeCloseTo(end,8);
      expect(slot.duration).toBeCloseTo(256*60/slot.arrangement.bpm,8);
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
    expect(scores[17].session!.offset+256*60/scores[17].bpm).toBeCloseTo(3600,7);
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
      for(const slot of plan.slots){
        const track=composeSessionTrack(plan,slot.index),bass=track.events.filter(e=>e.instrument==='bass');
        expect(track.bpm).toBeGreaterThan(68);expect(track.bpm).toBeLessThan(88);
        expect(track.events.length).toBeLessThan(2600);
        for(const event of track.events){
          expect(Number.isFinite(event.beat+event.duration+event.velocity+event.note)).toBe(true);
          expect(event.beat).toBeGreaterThanOrEqual(0);expect(event.beat).toBeLessThan(256);
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
});
