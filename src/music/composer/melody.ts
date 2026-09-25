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

function nearest(target: number, pcs: Iterable<number>, lo: number): number {
  const allowed = new Set(pcs);
  let best = -1;
  for (let p = lo; p <= HIGH; p++) if (allowed.has(p % 12) && (best < 0 || Math.abs(p - target) < Math.abs(best - target))) best = p;
  return best;
}

/** Scale-step contour to pitch, around an anchor chosen near the top of the comp. */
function stepPitch(context: MelodyContext, step: number): number {
  const scale = KEY_SCALES[context.mode], index = context.anchor + step;
  const octave = Math.floor(index / 7), degree = ((index % 7) + 7) % 7;
  return 60 + context.tonic + octave * 12 + scale[degree];
}

/** The anchor degree (third or fifth of the key) in the octave that sits nearest the melody's home register. */
export function anchorFor(tonic: number, mode: Mode, degree: 2 | 4): number {
  const pitch = 60 + tonic + KEY_SCALES[mode][degree];
  return degree + (pitch < 70 ? 7 : 0);
}

interface Placement { bar: number; notes: Cell; contour: number[]; shift?: number; velocity: number; instrument?: 'melody' | 'piano' }

/** Realise one placement of the theme: strong notes on chord tones, weak notes on scale tones that resolve by step. */
function place(context: MelodyContext, placement: Placement, dynamics: (bar: number) => number): Note[] {
  const { harmony } = context, last = placement.notes.length - 1;
  const notes = placement.notes.map(([at, duration], i) => {
    const beat = placement.bar * 4 + at, chord = chordAt(harmony, beat);
    const target = stepPitch(context, placement.contour[i % placement.contour.length] + (placement.shift ?? 0));
    const lo = registerFloor(chord);
    const pcs = i === last ? CADENCE_TONES(chord.quality).map(n => (chord.root + n) % 12)
      : isStrong(beat, duration) ? MELODY_TONES[chord.quality].map(n => (chord.root + n) % 12)
      : allowedPitchClasses(chord, context.tonic, context.mode);
    const bar = Math.floor(beat / 4);
    return { beat, duration, chord, lo, note: nearest(target, pcs, lo), velocity: (isStrong(beat, duration) ? 0.43 : 0.38) * placement.velocity * dynamics(bar) };
  });
  // A passing or neighbour tone must step to a chord tone; otherwise it becomes one.
  // Walk backwards so each check sees its successor's final pitch.
  for (let i = last - 1; i >= 0; i--) {
    const current = notes[i], next = notes[i + 1];
    if (chordTones(current.chord).has(current.note % 12)) continue;
    const resolves = chordTones(next.chord).has(next.note % 12) && Math.abs(next.note - current.note) <= 2;
    if (!resolves) current.note = nearest(current.note, MELODY_TONES[current.chord.quality].map(n => (current.chord.root + n) % 12), current.lo);
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

/** A contour of scale positions: mostly steps, one small leap at most, settling near where it began. */
export function makeContour(random: () => number): number[] {
  const out = [0];
  let leapt = false;
  for (let i = 1; i < 8; i++) {
    let step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(random() * 7)];
    if (!leapt && random() < 0.15) { step = random() < 0.5 ? 3 : -3; leapt = true; }
    out.push(Math.max(-3, Math.min(5, out[i - 1] + step)));
  }
  out[7] = Math.max(-1, Math.min(2, out[7]));
  return out;
}
