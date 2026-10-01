import { describe, expect, it } from 'vitest';
import { composeTrack, type Mood } from '../src/music/composer';
import {createSession,composeSessionTrack,sessionAt} from '../src/session/session';

const fnv=(text:string)=>{let h=0x811c9dc5;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),0x01000193)>>>0;return h.toString(16);};
/** A fixed projection of every lofi hour: scores, sampled environment (without the unused caption), slots and events. */
const lofiFingerprint=()=>Object.fromEntries((['rain','meadow','snow','coast'] as Mood[]).flatMap(mood=>[1,4242,20260917].map(seed=>{
  const plan=createSession(seed,mood);
  const scores=[0,9,17,18].map(i=>{const t=composeSessionTrack(plan,i);return [t.title,t.bpm,t.bars,t.key,...t.events.map(e=>[e.beat,e.duration,e.note,e.velocity,e.pan,e.instrument,e.voice??''].join(','))].join(';');});
  const states=[0,600,1800,3300,5000].map(s=>{const {elapsed,progress,chapter,dusk,warmth,weather,lamps,events}=sessionAt(plan,s);return JSON.stringify({elapsed,progress,chapter,dusk,warmth,weather,lamps,events});});
  const slots=plan.slots.map(s=>[s.start,s.duration,s.chapter].join(',')),events=plan.events.map(e=>[e.kind,e.start,e.duration].join(','));
  return [`${mood}/${seed}`,fnv([...scores,...states,...slots,...events].join('|'))];
})));
const LOFI_FINGERPRINT:Record<string,string>={"rain/1":"520d576c","rain/4242":"a00ceb1e","rain/20260917":"c3cc988f","meadow/1":"c823b936","meadow/4242":"f3240531","meadow/20260917":"c1271de3","snow/1":"2dc761","snow/4242":"e3a0a7e4","snow/20260917":"48dc65ed","coast/1":"c263fb30","coast/4242":"e65cdd17","coast/20260917":"4df9990b"};
/** Every event field too: dreamy must match main, and Top deck's driving hour the reviewed branch. */
const styleFingerprint=(style:string|undefined,moods:readonly Mood[])=>Object.fromEntries(moods.flatMap(mood=>[1,4242,20260917].map(seed=>{
  const plan=createSession(seed,mood,style);
  const scores=[0,9,17,18].map(i=>{const t=composeSessionTrack(plan,i);return JSON.stringify([t.title,t.bpm,t.bars,t.key,t.events,t.harmony,t.sections]);});
  const states=[0,600,1800,3300,5000].map(s=>{const {elapsed,progress,chapter,dusk,warmth,weather,lamps,events}=sessionAt(plan,s);return JSON.stringify({elapsed,progress,chapter,dusk,warmth,weather,lamps,events});});
  const slots=plan.slots.map(s=>[s.start,s.duration,s.chapter].join(',')),events=plan.events.map(e=>[e.kind,e.start,e.duration].join(','));
  return [`${mood}/${seed}`,fnv([...scores,...states,...slots,...events].join('|'))];
})));
const DREAMY_FINGERPRINT:Record<string,string>={"rain/1":"43682df3","rain/4242":"d771d1c4","rain/20260917":"84853415","meadow/1":"94df011d","meadow/4242":"925a4b91","meadow/20260917":"c2336924","snow/1":"79c061bb","snow/4242":"893d2d63","snow/20260917":"6bbc9773","coast/1":"93110d8c","coast/4242":"48751816","coast/20260917":"6fbc5b05"};
const DRIVING_FINGERPRINT:Record<string,string>={"deck/1":"86f825d0","deck/4242":"dd3c30fa","deck/20260917":"b040d1ac"};

describe('daily radio composition', () => {
  it('reproduces the same score without sharing mutable state', () => {
    const first = composeTrack(20260917, 'rain', 0);
    expect(composeTrack(20260917, 'rain', 0)).toEqual(first);
    first.events.splice(0);
    expect(composeTrack(20260917, 'rain', 0).events.length).toBeGreaterThan(600);
  });
  it('changes harmony, tempo, and motifs across the daily radio sequence', () => {
    const tracks = Array.from({length: 12}, (_, i) => composeTrack(12345, 'meadow', i));
    expect(new Set(tracks.map(t => t.title)).size).toBeGreaterThan(8);
    expect(new Set(tracks.map(t => t.bpm)).size).toBeGreaterThan(4);
    expect(new Set(tracks.map(t => t.key)).size).toBeGreaterThan(3);
    expect(composeTrack(12346, 'meadow', 0).events).not.toEqual(tracks[0].events);
  });
  it('has an introduction, recurring themes, a quieter break, and a resolved ending in every form', () => {
    const forms = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const track = composeTrack(seed, 'coast', 0);
      forms.add(track.form);
      expect([48, 56, 64, 72]).toContain(track.bars);
      expect(track.harmony).toHaveLength(track.bars);
      expect(track.sections[0].startBar).toBe(0);
      expect(track.sections[0].role).toBe('intro');
      expect(track.sections.at(-1)!.role).toBe('tag');
      expect(track.sections.at(-1)!.endBar).toBe(track.bars);
      track.sections.slice(1).forEach((s, i) => expect(s.startBar).toBe(track.sections[i].endBar));
      // Performance drift may pull a downbeat a hair early; it still belongs to its bar.
      const between = (from:number, to:number, instrument:string) => track.events.filter(e => e.beat >= from*4 - 0.05 && e.beat < to*4 - 0.05 && e.instrument === instrument);
      for (const s of track.sections.filter(s => s.role === 'breath')) expect(between(s.startBar, s.endBar, 'kick')).toHaveLength(0);
      const head = track.sections.find(s => s.role === 'head')!, back = track.sections.find(s => s.role === 'return')!;
      const length = back.endBar - back.startBar;
      expect(between(back.startBar, back.endBar, 'melody').map(e => e.note)).toEqual(between(head.startBar, head.startBar + length, 'melody').map(e => e.note));
      expect(between(track.bars - 4, track.bars, 'melody').length).toBeLessThan(between(head.startBar, head.startBar + 4, 'melody').length);
      const final = track.harmony.at(-1)![0];
      expect(final.root % 12 === ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'].indexOf(track.key.replace('m','')) || final.quality === 'min6').toBe(true);
    }
    expect(forms.size).toBe(4);
  });
  it.each(['rain','meadow','snow','coast'] as Mood[])('keeps the %s rhythm section and melody in one swung pocket', (mood) => {
    for(let seed=0;seed<8;seed++) {
      const track=composeTrack(seed,mood);
      const offGrid=track.events.filter(event=>event.instrument!=='piano').filter(event=>{
        const eighth=Math.round(event.beat*2);
        const grid=eighth/2+(eighth%2?track.swing:0);
        return Math.abs(event.beat-grid)>0.025;
      });
      expect(offGrid.slice(0,3),'Melody and percussion should share the same eighth-note swing, with at most a small performance offset.').toEqual([]);
      const bass=track.events.filter(event=>event.instrument==='bass');
      const looseKicks=track.events.filter(event=>event.instrument==='kick'&&!bass.some(note=>Math.abs(note.beat-event.beat)<0.015));
      expect(looseKicks.slice(0,3),'Kick accents should land with the bass, not create a competing pulse.').toEqual([]);
    }
  });
  it.each(['rain','meadow','snow','coast'] as Mood[])('keeps %s editions playable and finite, with extended voiced chords', (mood) => {
    for (let seed = 0; seed < 20; seed++) {
      const t = composeTrack(seed, mood, seed % 5);
      expect(t.bpm).toBeGreaterThanOrEqual(68);
      expect(t.bpm).toBeLessThanOrEqual(88);
      expect(t.events.length).toBeLessThan(2600);
      expect(t.harmony).toHaveLength(t.bars);
      for (const chord of t.harmony.flat()) {
        expect(chord.notes.length).toBeGreaterThanOrEqual(4);
        expect(new Set(chord.notes.map(n => n % 12)).size).toBe(chord.notes.length);
      }
      for (const e of t.events) {
        expect(Number.isFinite(e.beat + e.duration + e.velocity + e.note)).toBe(true);
        expect(e.beat).toBeGreaterThanOrEqual(0);
        expect(e.beat).toBeLessThan(t.bars * 4);
        expect(e.duration).toBeGreaterThan(0);
        expect(e.velocity).toBeGreaterThan(0);
        expect(e.velocity).toBeLessThanOrEqual(1);
        expect(e.note).toBeGreaterThanOrEqual(24);
        expect(e.note).toBeLessThanOrEqual(88);
      }
    }
  });
  it('keeps every lofi hour identical through the places and styles refactor',()=>{
    expect(lofiFingerprint()).toEqual(LOFI_FINGERPRINT);
  });
  it('keeps dreamy synthwave identical to main and Top deck identical to the reviewed branch',()=>{
    expect(styleFingerprint('dreamy',['rain','meadow','snow','coast'])).toEqual(DREAMY_FINGERPRINT);
    expect(styleFingerprint(undefined,['deck'])).toEqual(DRIVING_FINGERPRINT);
  });
});
