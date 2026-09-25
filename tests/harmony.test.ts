import { describe, expect, it } from 'vitest';
import { B_LOOPS, LOOPS, SHELLS, TURNAROUNDS, allowedPitchClasses, voice, type Step } from '../src/music/composer/harmony';
import type { Quality } from '../src/music/composer/types';

const isTritoneSub = (step: Step, next: Step | undefined) => !!next && step[1].startsWith('dom') && ((step[0] - next[0]) % 12 + 12) % 12 === 1;

describe('harmony vocabulary', () => {
  it('writes four-bar loops with at most two chords, only in the last bar', () => {
    for (const loop of [...LOOPS, ...B_LOOPS]) {
      expect(loop.bars, loop.id).toHaveLength(4);
      loop.bars.forEach((bar, i) => expect(bar.length, loop.id).toBeLessThanOrEqual(i === 3 ? 2 : 1));
    }
    for (const turn of [...TURNAROUNDS.major, ...TURNAROUNDS.minor]) expect(turn.length).toBeLessThanOrEqual(2);
  });

  it('keeps altered and tritone dominants to one per loop pass, including turnarounds', () => {
    for (const loop of [...LOOPS, ...B_LOOPS]) {
      const endings = loop.turn ? [loop.bars[3], ...TURNAROUNDS[loop.mode]] : [loop.bars[3]];
      for (const ending of endings) {
        const pass = [...loop.bars.slice(0, 3).flat(), ...ending];
        const spicy = pass.filter((s, i) => s[1] === 'dom7b9' || isTritoneSub(s, pass[i + 1] ?? loop.bars[0][0]));
        expect(spicy.length, loop.id).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps nocturne loops minor, slow and unaltered', () => {
    const nocturnes = LOOPS.filter(l => l.nocturne);
    expect(nocturnes.length).toBeGreaterThanOrEqual(3);
    for (const loop of nocturnes) {
      expect(loop.mode).toBe('minor');
      expect(loop.bars.every(bar => bar.length === 1 && bar[0][1] !== 'dom7b9')).toBe(true);
    }
  });

  it('has enough loops in each mode for adjacency rules', () => {
    expect(LOOPS.filter(l => l.mode === 'major').length).toBeGreaterThanOrEqual(8);
    expect(LOOPS.filter(l => l.mode === 'minor').length).toBeGreaterThanOrEqual(5);
    expect(new Set(LOOPS.map(l => l.id)).size).toBe(LOOPS.length);
  });

  it('voices every quality as a rootless four-note shell in a warm register', () => {
    for (const quality of Object.keys(SHELLS) as Quality[]) {
      for (let root = 48; root < 60; root++) for (const top of [72, 74]) {
        const notes = voice(root, quality, [57, 60, 64, 67], top);
        expect(notes, `${quality} on ${root}`).toHaveLength(4);
        expect(new Set(notes.map(n => n % 12)).size).toBe(4);
        expect(Math.min(...notes)).toBeGreaterThanOrEqual(55);
        expect(Math.max(...notes)).toBeLessThanOrEqual(top);
      }
    }
  });

  it('keeps weak-beat melody notes inside both the key and the chord', () => {
    // iii (E min7) in C major: no F (the avoid note) and no F♯ (a ninth outside the key).
    const allowed = allowedPitchClasses({ root: 52, quality: 'min7', notes: [], beat: 0 }, 0, 'major');
    expect(allowed.has(5)).toBe(false);
    expect(allowed.has(6)).toBe(false);
    expect(allowed.has(7)).toBe(true);
    // Borrowed iv (F min6) in C major keeps its own ♭3 (A♭) as a chord tone.
    expect(allowedPitchClasses({ root: 53, quality: 'min6', notes: [], beat: 0 }, 0, 'major').has(8)).toBe(true);
  });
});
