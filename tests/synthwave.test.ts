import { describe, expect, it } from 'vitest';
import { composeSessionTrack, createSession, sessionAt } from '../src/session/session';

describe('dreamy synthwave sessions', () => {
  it('plans a deterministic hour at synthwave tempos without changing lofi defaults', () => {
    for (const seed of [0, 1, 42, 20260928]) {
      const plan = createSession(seed, 'rain', 'synthwave');
      expect(plan.style).toBe('synthwave');
      expect(plan).toEqual(createSession(seed, 'rain', 'synthwave'));
      expect(plan.slots).toHaveLength(18);
      expect(plan.slots.reduce((sum, s) => sum + s.duration, 0)).toBeCloseTo(3600, 8);
      for (const slot of plan.slots) {
        const track = composeSessionTrack(plan, slot.index);
        expect(track.bpm).toBeGreaterThanOrEqual(84);
        expect(track.bpm).toBeLessThanOrEqual(112);
        expect(slot.duration).toBeCloseTo(track.bars * 240 / track.bpm, 8);
      }
      expect(createSession(seed, 'rain')).toEqual(createSession(seed, 'rain', 'lofi'));
      expect(plan.events).toEqual(createSession(seed, 'rain').events);
      expect(sessionAt(plan, 1800).dusk).toEqual(sessionAt(createSession(seed, 'rain'), 1800).dusk);
    }
  });

  it('writes four distinct families with different rhythm and instrumentation', () => {
    const plan = createSession(20260928, 'rain', 'synthwave');
    const tracks = plan.slots.map(s => composeSessionTrack(plan, s.index));
    expect(new Set(tracks.map(t => t.family)).size).toBe(4);
    const signatures = tracks.slice(0, 4).map(t => t.events.filter(e => e.instrument === 'synth-bass').map(e => e.beat).join(','));
    expect(new Set(signatures).size).toBe(4);
    for (let i = 1; i < 18; i++) {
      expect(tracks[i].family).not.toBe(tracks[i - 1].family);
      expect(tracks[i].loop).not.toBe(tracks[i - 1].loop);
    }
    for (const track of tracks) {
      expect(track.events.some(e => e.instrument === 'pad')).toBe(true);
      expect(track.events.some(e => e.instrument === 'synth-bass')).toBe(true);
      expect(track.events.some(e => e.instrument === 'piano')).toBe(false);
    }
  });

  it('prepares the final reprise without repeating the preceding loop', () => {
    for (let seed = 0; seed < 100; seed++) {
      const plan = createSession(seed, 'rain', 'synthwave');
      expect(plan.slots[16].arrangement.loop, `seed ${seed}`).not.toBe(plan.slots[17].arrangement.loop);
    }
  });

  it('rolls the bass in long-short-short sixteenths and builds layers into the hook', () => {
    const track = composeSessionTrack(createSession(20260928, 'rain', 'synthwave'), 0);
    const head = track.sections.find(s => s.role === 'head')!;
    const bass = track.events.filter(e => e.instrument === 'synth-bass' && e.beat >= head.startBar * 4 && e.beat < (head.startBar + 1) * 4);
    expect(bass.map(e => e.beat - head.startBar * 4)).toEqual([0, .5, .75, 1, 1.5, 1.75, 2, 2.5, 2.75, 3, 3.5, 3.75]);
    expect(bass[1].duration).toBeLessThan(bass[0].duration);
    const early = track.events.filter(e => e.beat < 8);
    const full = track.events.filter(e => e.beat >= (head.startBar + 12) * 4 && e.beat < (head.startBar + 14) * 4);
    expect(full.some(e => e.instrument === 'synth-chord')).toBe(true);
    expect(early.some(e => e.instrument === 'synth-chord')).toBe(false);
    expect(full.length).toBeGreaterThan(early.length * 2);
    const brightness = (events: typeof early) => Math.max(...events.filter(e => e.instrument === 'pad').map(e => e.brightness ?? 0));
    expect(brightness(full)).toBeGreaterThan(brightness(early) + .25);
  });

  it('keeps notes bounded, hook returns identical and after hours fresh', () => {
    for (const mood of ['rain', 'meadow', 'snow', 'coast'] as const) {
      const plan = createSession(34, mood, 'synthwave');
      for (const index of [0, 1, 2, 3, 10, 16, 17, 18, 35]) {
        const track = composeSessionTrack(plan, index);
        expect(track).toEqual(composeSessionTrack(plan, index));
        expect(track.events.length).toBeGreaterThan(100);
        expect(track.events.length).toBeLessThan(4200);
        expect(track.sections[0].startBar).toBe(0);
        expect(track.sections.at(-1)?.endBar).toBe(track.bars);
        for (const event of track.events) {
          expect(event.beat).toBeGreaterThanOrEqual(0);
          expect(event.beat + event.duration).toBeLessThanOrEqual(track.bars * 4 + .001);
          expect(event.note).toBeGreaterThanOrEqual(24);
          expect(event.note).toBeLessThanOrEqual(88);
          expect(event.velocity).toBeGreaterThan(0);
          expect(event.velocity).toBeLessThanOrEqual(1);
        }
        const line = (role: string) => {
          const section = track.sections.find(s => s.role === role)!;
          return track.events.filter(e => e.instrument === 'lead' && e.beat >= section.startBar * 4 && e.beat < (section.startBar + 8) * 4)
            .map(e => [e.beat - section.startBar * 4, e.note, e.duration]);
        };
        expect(line('head').length).toBeGreaterThan(0);
        expect(line('return')).toEqual(line('head'));
      }
      const opening = composeSessionTrack(plan, 0), closing = composeSessionTrack(plan, 17);
      expect(closing.theme).toEqual(opening.theme);
      expect(closing.loop).toBe(opening.loop);
      expect(composeSessionTrack(plan, 18).events).not.toEqual(opening.events);
    }
  });
});
