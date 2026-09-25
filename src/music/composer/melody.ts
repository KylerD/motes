import { MELODY_CELLS, type Cell } from './cells';
import { CADENCE_TONES, KEY_SCALES, MELODY_TONES, allowedPitchClasses, chordAt } from './harmony';
import { PHRASE_CONTOUR, roleDynamics } from './form';
import type { Chord, Mode, Section, Theme } from './types';

export interface Note { beat: number; note: number; duration: number; velocity: number; instrument: 'melody' | 'piano' }
export interface MelodyContext { harmony: Chord[][]; sections: Section[]; tonic: number; mode: Mode; theme: Theme; anchor: number }

const LOW = 64, HIGH = 81;
/** Beats 1 and 3 of a bar, and anything held for a beat, carry the harmony: chord tones only. */
export const isStrong = (beat: number, duration: number) => { const within = beat % 4; return within === 0 || within === 2 || duration >= 1; };
export const chordTones = (chord: Chord) => new Set([chord.root % 12, ...MELODY_TONES[chord.quality].map(n => (chord.root + n) % 12)]);
export const registerFloor = (chord: Chord) => Math.max(LOW, Math.max(...chord.notes) - 2);

/** Nearest permitted pitch; a note a semitone (or minor ninth) above a sounding piano note is avoided when possible. */
function nearest(target: number, pcs: Iterable<number>, lo: number, voicing: number[]): number {
  const allowed = new Set(pcs);
  const cost = (p: number) => Math.abs(p - target) + (voicing.some(v => p > v && (p - v) % 12 === 1) ? 3 : 0);
  let best = -1;
  for (let p = lo; p <= HIGH; p++) if (allowed.has(p % 12) && (best < 0 || cost(p) < cost(best))) best = p;
  return best;
}

/** Scale-step contour to pitch, around the theme's anchor degree. */
function scalePitch(tonic: number, mode: Mode, index: number): number {
  const scale = KEY_SCALES[mode], octave = Math.floor(index / 7), degree = ((index % 7) + 7) % 7;
  return 60 + tonic + octave * 12 + scale[degree];
}
const stepPitch = (context: MelodyContext, step: number) => scalePitch(context.tonic, context.mode, context.anchor + step);

/** Place the anchor (third or fifth of the key) in the octave where the whole contour, sequenced up to two steps, sings
 *  inside the register instead of piling onto its ceiling. */
export function anchorFor(tonic: number, mode: Mode, degree: 2 | 4, contour: number[]): number {
  const steps = [0, 1, 2].flatMap(shift => contour.map(c => c + shift));
  const cost = (anchor: number) => {
    const pitches = steps.map(s => scalePitch(tonic, mode, anchor + s));
    // The comp's top voice (≤ 72 in heads) sets the floor, so the contour lives between 68 and 80.
    const outside = pitches.filter(p => p < 68 || p > 80).length;
    return outside * 10 + Math.abs(pitches.reduce((a, b) => a + b, 0) / pitches.length - 74);
  };
  return [degree - 7, degree, degree + 7].reduce((best, anchor) => cost(anchor) < cost(best) ? anchor : best);
}

interface Placement { bar: number; notes: Cell; contour: number[]; shift?: number; velocity: number; instrument?: 'melody' | 'piano' }

/** Realise one placement of the theme: strong notes on chord tones, weak notes on scale tones that resolve by step. */
function place(context: MelodyContext, placement: Placement, dynamics: (bar: number) => number): Note[] {
  const { harmony } = context, last = placement.notes.length - 1;
  const notes = placement.notes.map(([at, duration], i) => {
    const beat = placement.bar * 4 + at, chord = chordAt(harmony, beat);
    const step = placement.contour[i % placement.contour.length] + (placement.shift ?? 0), target = stepPitch(context, step);
    const lo = registerFloor(chord);
    const pcs = new Set(i === last ? CADENCE_TONES(chord.quality).map(n => (chord.root + n) % 12)
      : isStrong(beat, duration) ? MELODY_TONES[chord.quality].map(n => (chord.root + n) % 12)
      : allowedPitchClasses(chord, context.tonic, context.mode));
    const bar = Math.floor(beat / 4);
    return { beat, duration, chord, lo, step, target, pcs, note: nearest(target, pcs, lo, chord.notes), velocity: (isStrong(beat, duration) ? 0.43 : 0.38) * placement.velocity * dynamics(bar) };
  });
  // Follow the contour: where it moves but snapping left the pitch still or sent it the other way,
  // take the next permitted pitch in the contour's direction from the previous note.
  for (let i = 1; i <= last; i++) {
    const direction = Math.sign(notes[i].step - notes[i - 1].step), current = notes[i], from = notes[i - 1].note;
    if (!direction || Math.sign(current.note - from) === direction) continue;
    for (let p = from + direction; p >= current.lo && p <= HIGH && Math.abs(p - from) <= 7; p += direction)
      if (current.pcs.has(p % 12)) { current.note = p; break; }
  }
  // A passing or neighbour tone must step to a chord tone; otherwise it becomes one, preferring a pitch its neighbours don't hold.
  // Walk backwards so each check sees its successor's final pitch.
  for (let i = last - 1; i >= 0; i--) {
    const current = notes[i], next = notes[i + 1], previous = notes[i - 1];
    const isChordTone = (p: number) => chordTones(current.chord).has(p % 12);
    const resolves = (p: number) => chordTones(next.chord).has(next.note % 12) && Math.abs(next.note - p) <= 2;
    if (isChordTone(current.note) || resolves(current.note)) continue;
    let best = current.note, bestCost = Infinity;
    for (let p = current.lo; p <= HIGH; p++) {
      if (!current.pcs.has(p % 12) || !(isChordTone(p) || resolves(p))) continue;
      const cost = Math.abs(p - current.target) + (p === next.note ? 4 : 0) + (previous && p === previous.note ? 4 : 0);
      if (cost < bestCost) { best = p; bestCost = cost; }
    }
    current.note = best;
  }
  return notes.map(({ beat, duration, note, velocity }) => ({ beat, duration, note, velocity, instrument: placement.instrument ?? 'melody' }));
}

const firstBar = (cell: Cell) => cell.filter(([at]) => at < 4);

/** Each role treats the song's theme differently; the return repeats the head note for note. */
export function realiseMelody(context: MelodyContext): Note[] {
  const cell = MELODY_CELLS[context.theme.cell], contour = context.theme.contour, out: Note[] = [];
  const sectionOf = (bar: number) => context.sections.find(s => bar >= s.startBar && bar < s.endBar)!;
  const dynamics = (bar: number) => { const s = sectionOf(bar); return roleDynamics(s.role, bar - s.startBar) * PHRASE_CONTOUR[(bar - s.startBar) % 8]; };
  const put = (p: Placement) => out.push(...place(context, p, dynamics));
  const opening = firstBar(cell);
  let head: { start: number; notes: Note[] } | undefined;
  for (const section of context.sections) {
    const s = section.startBar, length = section.endBar - s;
    switch (section.role) {
      case 'intro':
        for (const bar of [s + 2, s + 6]) put({ bar, notes: opening, contour, velocity: 0.65 });
        break;
      case 'head': {
        const before = out.length;
        for (let phrase = s; phrase < section.endBar; phrase += 8) {
          put({ bar: phrase, notes: cell, contour, velocity: 1 });
          put({ bar: phrase + 2, notes: cell, contour, shift: 1, velocity: 0.96 });
          put({ bar: phrase + 4, notes: cell, contour, velocity: 1 });
          // Cadence: the opening bar with its tail bent, the last note held across a silent bar.
          const tail = opening.map(([at, d], i): [number, number] => i === opening.length - 1 ? [at, Math.max(d, 5.5 - at)] : [at, d]);
          const bent = contour.map((c, i) => i >= opening.length - 2 ? c - 1 : c);
          put({ bar: phrase + 6, notes: tail, contour: bent, velocity: 0.95 });
        }
        head ??= { start: s, notes: out.slice(before) };
        break;
      }
      case 'return':
        if (head) for (const n of head.notes) if (n.beat < (head.start + length) * 4) out.push({ ...n, beat: n.beat + (s - head.start) * 4 });
        break;
      case 'contrast':
        put({ bar: s, notes: opening, contour, velocity: 0.9 });
        put({ bar: s + 4, notes: opening, contour, shift: 2, velocity: 0.9 });
        break;
      case 'breath':
        put({ bar: s + 2, notes: opening.map(([at, d]) => [at * 2, d * 2]), contour, velocity: 0.65 });
        break;
      case 'stretch':
        for (const bar of [s + 1, s + 5]) put({ bar, notes: opening, contour, velocity: 0.7, instrument: 'piano' });
        break;
      case 'tag': {
        const three = cell.slice(0, 3).map(([at, d], i): [number, number] => i === 2 ? [at, Math.max(d, 3)] : [at, d]);
        put({ bar: s, notes: three, contour, velocity: 0.85 });
        break;
      }
    }
  }
  return out;
}

/** A contour of scale positions: mostly steps, one small leap at most, settling near where it began.
 *  Its opening five notes always cover at least three pitches, so a theme is a tune rather than a drone. */
export function makeContour(random: () => number): number[] {
  const draw = () => {
    const out = [0];
    let leapt = false;
    for (let i = 1; i < 8; i++) {
      let step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(random() * 7)];
      if (!leapt && random() < 0.15) { step = random() < 0.5 ? 3 : -3; leapt = true; }
      out.push(Math.max(-3, Math.min(4, out[i - 1] + step)));
    }
    out[7] = Math.max(-1, Math.min(2, out[7]));
    return out;
  };
  let contour = draw();
  for (let tries = 0; tries < 8 && new Set(contour.slice(0, 5)).size < 3; tries++) contour = draw();
  if (new Set(contour.slice(0, 5)).size < 3) contour.splice(0, 5, 0, 1, 2, 1, 0);
  return contour;
}
