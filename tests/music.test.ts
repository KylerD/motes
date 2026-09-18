import { describe, expect, it } from 'vitest';
import { composeTrack, type Mood } from '../src/music/composer';

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
  it('has an introduction, recurring themes, a quieter break, and a resolved ending', () => {
    const track = composeTrack(71, 'coast', 0);
    expect(track.bars).toBe(64);
    expect(track.sections.map(s => s.name)).toEqual(['Opening', 'First light', 'Wandering', 'Room to breathe', 'Home again', 'Last page']);
    expect(track.sections[0].startBar).toBe(0);
    expect(track.sections.at(-1)!.endBar).toBe(64);
    const between = (from:number, to:number, instrument:string) => track.events.filter(e => e.beat >= from*4 && e.beat < to*4 && e.instrument === instrument);
    expect(between(32,40,'kick').length).toBe(0);
    expect(between(8,16,'kick').length).toBeGreaterThan(12);
    expect(between(8,16,'melody').map(e => e.note)).toEqual(between(40,48,'melody').map(e => e.note));
    expect(between(60,64,'melody').length).toBeLessThan(between(8,12,'melody').length);
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
      expect(t.harmony).toHaveLength(64);
      for (const chord of t.harmony) {
        expect(chord.notes.length).toBeGreaterThanOrEqual(4);
        expect(new Set(chord.notes.map(n => n % 12)).size).toBe(chord.notes.length);
      }
      for (const e of t.events) {
        expect(Number.isFinite(e.beat + e.duration + e.velocity + e.note)).toBe(true);
        expect(e.beat).toBeGreaterThanOrEqual(0);
        expect(e.beat).toBeLessThan(256);
        expect(e.duration).toBeGreaterThan(0);
        expect(e.velocity).toBeGreaterThan(0);
        expect(e.velocity).toBeLessThanOrEqual(1);
        expect(e.note).toBeGreaterThanOrEqual(24);
        expect(e.note).toBeLessThanOrEqual(88);
      }
    }
  });
});
