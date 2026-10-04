import {describe,expect,it} from 'vitest';
import {CLIP,FRAMES,clipFrame,clipName,loudnessGain,musicStartBeat} from '../src/clip/plan';
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

describe('clip music and files',()=>{
  it.each(['lofi','synthwave'] as const)('starts %s at the opening song\'s first theme section',style=>{
    const track=composeSessionTrack(createSession(20261003,'rain',style),0);
    const head=track.sections.find(section=>section.role==='head')!;
    expect(musicStartBeat(track)).toBe(head.startBar*4);
    expect(musicStartBeat(track)).toBeGreaterThan(0);
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
