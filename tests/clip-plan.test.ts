import {describe,expect,it} from 'vitest';
import {CLIP,FRAMES,clipFrame,clipName,clipSession,loudnessGain,musicStartBeat} from '../src/clip/plan';
import {eventsFrom} from '../src/music/audio';
import {SCENE_IDS,edition} from '../src/scenes/edition';
import {createSession,composeSessionTrack} from '../src/session/session';

describe('the clip timeline',()=>{
  it('is 450 frames at 30 fps, ending just before 15 s',()=>{
    expect(FRAMES).toBe(450);
    expect(clipFrame(0).time).toBe(0);
    expect(clipFrame(FRAMES-1).time).toBeCloseTo(14.967,3);
  });
  it('eases from arrival to the settled evening by 13 s, then holds',()=>{
    expect(CLIP.evening).toBe(3420);
    expect(clipFrame(0).listening).toBe(0);
    expect(clipFrame(13*30).listening).toBe(CLIP.evening);
    expect(clipFrame(FRAMES-1).listening).toBe(CLIP.evening);
    for(let i=1;i<FRAMES;i++)expect(clipFrame(i).listening).toBeGreaterThanOrEqual(clipFrame(i-1).listening);
  });
  it('drifts left to right across the middle 70% of the painting',()=>{
    expect(clipFrame(0).pan).toBeCloseTo(.15,6);
    expect(clipFrame(FRAMES-1).pan).toBeCloseTo(.85,3);
    for(let i=1;i<FRAMES;i++)expect(clipFrame(i).pan).toBeGreaterThan(clipFrame(i-1).pan);
  });
  it('fades the title in from 12 s over 0.8 s',()=>{
    expect(clipFrame(12*30-1).title).toBe(0);
    expect(clipFrame(12*30).title).toBe(0);
    expect(clipFrame(12*30+12).title).toBeGreaterThan(0);
    expect(clipFrame(12*30+12).title).toBeLessThan(1);
    expect(clipFrame(13*30).title).toBe(1);
  });
});

describe('the clip scenery',()=>{
  // 2026-09-17 and 2026-10-03 put the rain's shower inside the clip's 200× evening, where it would surge for half a second.
  it.each(['2026-09-17','2026-10-03','2026-10-04','2026-12-24'])('changes its weather smoothly from frame to frame on %s, with no session events',day=>{
    for(const scene of SCENE_IDS) {
      const plan=createSession(edition(day,scene).seed,scene);
      let previous=clipSession(plan,clipFrame(0).listening).weather,jump=0;
      for(let i=1;i<FRAMES;i++) {
        const state=clipSession(plan,clipFrame(i).listening);
        expect(state.events).toEqual([]);
        jump=Math.max(jump,Math.abs(state.weather-previous));previous=state.weather;
      }
      expect(jump,`${scene}'s largest weather step between frames`).toBeLessThan(.02);
    }
  });
});

describe('clip music and files',()=>{
  it.each(['lofi','synthwave'] as const)('starts %s at the opening song\'s first theme section',style=>{
    const track=composeSessionTrack(createSession(20261003,'rain',style),0);
    const head=track.sections.find(section=>section.role==='head')!;
    expect(musicStartBeat(track)).toBe(head.startBar*4);
    expect(musicStartBeat(track)).toBeGreaterThan(0);
  });
  it('keeps the first downbeat of the theme when humanisation sets it a hair early',()=>{
    const track=composeSessionTrack(createSession(edition('2026-09-17','snow').seed,'snow'),0),from=musicStartBeat(track);
    // This opening's head downbeat really is performed early, so a plain cut at the head would drop it.
    expect(track.events.some(event=>event.beat<from&&event.beat>from-.01)).toBe(true);
    const kept=eventsFrom(track.events,from),downbeat=(instrument:string)=>kept.some(event=>event.instrument===instrument&&Math.abs(event.beat-from)<.01);
    for(const instrument of ['bass','kick'])expect(downbeat(instrument),`${instrument} on the head downbeat`).toBe(true);
    // The intro, and anything else clearly before the head, still stays out.
    expect(track.sections.find(section=>section.role==='intro')?.endBar).toBe(from/4);
    expect(track.events.some(event=>event.beat<from-.05)).toBe(true);
    expect(kept.filter(event=>event.beat<from-.05)).toEqual([]);
  });
  it.each(['lofi','synthwave'] as const)('plays a %s song from the top exactly as before',style=>{
    const track=composeSessionTrack(createSession(20260917,'rain',style),0);
    expect(eventsFrom(track.events,0)).toEqual(track.events.filter(event=>!(event.beat<0)));
  });
  it('starts at the top when a song has no theme section',()=>{
    expect(musicStartBeat({sections:[{name:'Tag',role:'tag',startBar:0,endBar:8}]})).toBe(0);
  });
  it('names a clip after its place and day',()=>{
    expect(clipName('neon-rain','2026-10-03')).toBe('motes-neon-rain-2026-10-03.mp4');
  });
  it('lifts quiet music towards −18 dBFS without letting peaks pass −1.5 dBFS',()=>{
    expect(loudnessGain(.02,.1)).toBeCloseTo(10**(-18/20)/.02,6);
    expect(loudnessGain(.02,.3)).toBeCloseTo(10**(-1.5/20)/.3,6);
    expect(loudnessGain(.2,.9)).toBeLessThan(1);
    expect(loudnessGain(0,0)).toBe(1);
  });
});
