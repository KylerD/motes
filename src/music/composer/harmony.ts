import type { Chord, Mode, Quality, Role } from './types';

export type Step = [degree: number, quality: Quality];
/** A four-bar loop in semitones above the song's tonic; a bar may hold two chords (beats 0 and 2). */
export interface Loop { id: string; mode: Mode; bars: Step[][]; turn: boolean; nocturne: boolean }

/** Rootless shells above the root: the bass owns the root, the piano keeps a warm middle register.
 *  Plain min7 (iii, minor v) takes the 11th and plain dom7 (secondary dominants) its root, never a non-diatonic ninth. */
export const SHELLS: Record<Quality, [number[], number[]]> = {
  maj7: [[4, 7, 11, 14], [11, 14, 16, 19]], maj9: [[4, 7, 11, 14], [11, 14, 16, 19]],
  six9: [[4, 9, 14, 19], [9, 14, 16, 19]], 'maj9#11': [[4, 11, 14, 18], [11, 14, 18, 19]],
  min7: [[3, 7, 10, 17], [10, 15, 17, 19]], min9: [[3, 7, 10, 14], [10, 14, 15, 19]],
  min11: [[3, 10, 14, 17], [10, 14, 15, 17]], min6: [[3, 7, 9, 14], [9, 14, 15, 19]],
  dom7: [[4, 7, 10, 12], [10, 12, 16, 19]], dom9: [[4, 10, 14, 19], [10, 14, 16, 19]],
  dom13: [[4, 10, 14, 21], [10, 16, 21, 26]], dom7sus: [[5, 10, 14, 19], [10, 14, 17, 19]],
  dom7b9: [[4, 10, 13, 19], [10, 13, 16, 19]], halfdim: [[3, 6, 10, 17], [6, 10, 15, 17]],
};

/** Chord tones a melody may land on; never the root, which sounds like a nursery tune on strong beats. */
export const MELODY_TONES: Record<Quality, number[]> = {
  maj7: [4, 7, 11, 14], maj9: [4, 7, 11, 14], six9: [4, 7, 9, 14], 'maj9#11': [4, 7, 11, 14, 18],
  min7: [3, 7, 10, 17], min9: [3, 7, 10, 14], min11: [3, 7, 10, 14, 17], min6: [3, 7, 9, 14],
  dom7: [4, 7, 10], dom9: [4, 7, 10, 14], dom13: [4, 10, 14, 21], dom7sus: [5, 7, 10, 14],
  dom7b9: [4, 7, 10, 13], halfdim: [3, 6, 10, 17],
};

/** Phrase endings rest on the third, ninth or fifth: whichever of those the chord owns.
 *  Plain sevenths (iii, v, secondary dominants) carry no ninth, which would leave the key. */
export const CADENCE_TONES = (quality: Quality) =>
  [3, 4, 14, 7, 6].filter(n => MELODY_TONES[quality].includes(n));

const IONIAN = [0, 2, 4, 5, 7, 9, 11], DORIAN = [0, 2, 3, 5, 7, 9, 10], MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
export const CHORD_SCALES: Record<Quality, number[]> = {
  maj7: IONIAN, maj9: IONIAN, six9: IONIAN, 'maj9#11': [0, 2, 4, 6, 7, 9, 11],
  min7: DORIAN, min9: DORIAN, min11: DORIAN, min6: DORIAN,
  dom7: MIXOLYDIAN, dom9: MIXOLYDIAN, dom13: MIXOLYDIAN, dom7sus: MIXOLYDIAN,
  dom7b9: [0, 1, 4, 5, 7, 8, 10], halfdim: [0, 1, 3, 5, 6, 8, 10],
};
export const KEY_SCALES: Record<Mode, number[]> = { major: IONIAN, minor: [0, 2, 3, 5, 7, 8, 10] };

const L = (id: string, mode: Mode, turn: boolean, nocturne: boolean, ...bars: Step[][]): Loop => ({ id, mode, bars, turn, nocturne });
/** Curated A loops. Fewer, better chords, repeated: the loop is the song's identity. */
export const LOOPS: Loop[] = [
  L('home', 'major', true, false, [[0, 'maj9']], [[9, 'min9']], [[2, 'min9']], [[7, 'dom13']]),
  L('lantern', 'major', true, false, [[0, 'maj9']], [[4, 'dom7']], [[9, 'min9']], [[2, 'min9'], [7, 'dom13']]),
  L('lydian', 'major', false, false, [[5, 'maj9#11']], [[4, 'min7']], [[2, 'min9']], [[0, 'six9']]),
  L('two-five', 'major', false, false, [[2, 'min9']], [[7, 'dom13']], [[0, 'maj9']], [[0, 'six9']]),
  L('borrowed', 'major', false, false, [[5, 'maj9']], [[5, 'min6']], [[4, 'min7']], [[9, 'min9']]),
  L('porch', 'major', true, false, [[0, 'maj9']], [[5, 'maj9#11']], [[0, 'maj9']], [[5, 'maj9#11']]),
  L('drift', 'major', false, false, [[9, 'min9']], [[2, 'min11']], [[7, 'dom7sus']], [[0, 'maj9']]),
  L('backdoor', 'major', false, false, [[0, 'maj9']], [[5, 'maj9']], [[5, 'min6']], [[10, 'dom9']]),
  L('royal-road', 'major', false, false, [[5, 'maj9']], [[7, 'dom7sus']], [[4, 'min7']], [[9, 'min9']]),
  L('sixth', 'major', true, false, [[0, 'maj9']], [[9, 'dom7']], [[2, 'min9']], [[7, 'dom13']]),
  L('ember', 'minor', false, true, [[0, 'min9']], [[5, 'min9']], [[10, 'dom13']], [[3, 'maj9']]),
  L('ferry', 'minor', false, false, [[0, 'min11']], [[8, 'maj9']], [[2, 'halfdim']], [[7, 'dom7b9']]),
  L('hush', 'minor', false, true, [[0, 'min9']], [[0, 'min9']], [[5, 'min11']], [[10, 'dom9']]),
  L('rise', 'minor', true, false, [[8, 'maj7']], [[10, 'dom13']], [[0, 'min9']], [[0, 'min9']]),
  L('dorian', 'minor', true, true, [[0, 'min9']], [[5, 'dom9']], [[0, 'min9']], [[5, 'dom9']]),
  L('tide', 'minor', false, true, [[0, 'min9']], [[8, 'maj9']], [[5, 'min9']], [[7, 'min7']]),
];
/** Contrast loops lean toward IV or vi (major), iv or ♭VI (minor), and hand back to the A loop. */
export const B_LOOPS: Loop[] = [
  L('b-four', 'major', false, false, [[5, 'maj9']], [[4, 'min7']], [[2, 'min9']], [[7, 'dom13']]),
  L('b-six', 'major', false, false, [[9, 'min9']], [[5, 'maj9']], [[9, 'min9']], [[2, 'min9'], [7, 'dom9']]),
  L('b-plagal', 'major', false, false, [[5, 'maj9#11']], [[5, 'min6']], [[0, 'maj9']], [[7, 'dom7sus']]),
  L('b-three', 'major', false, false, [[4, 'min7']], [[9, 'dom7']], [[2, 'min9']], [[7, 'dom13']]),
  L('b-four-minor', 'minor', false, false, [[5, 'min9']], [[10, 'dom13']], [[3, 'maj9']], [[2, 'halfdim'], [7, 'dom7b9']]),
  L('b-flat-six', 'minor', false, false, [[8, 'maj9']], [[3, 'maj9']], [[8, 'maj9']], [[10, 'dom9']]),
  L('b-relative', 'minor', false, false, [[3, 'maj9']], [[8, 'maj7']], [[5, 'min9']], [[7, 'dom7sus']]),
];
/** Second-ending substitutions for the last bar of a loop that starts on the tonic. */
export const TURNAROUNDS: Record<Mode, Step[][]> = {
  major: [[[2, 'min9'], [7, 'dom13']], [[2, 'min9'], [1, 'dom9']], [[10, 'dom9']]],
  minor: [[[2, 'halfdim'], [7, 'dom7b9']], [[10, 'dom13']]],
};

export const loopById = (id: string) => LOOPS.find(l => l.id === id) ?? LOOPS[0];

/** Voice-lead a rootless shell: rotations and octaves inside 55..top, minimal motion, centred near E4. */
export function voice(root: number, quality: Quality, previous: number[], top: number): number[] {
  let best: number[] = [], bestCost = Infinity;
  SHELLS[quality].forEach((shell, shellIndex) => {
    for (let r = 0; r < shell.length; r++) {
      const rotated = shell.slice(r).concat(shell.slice(0, r).map(n => n + 12)).sort((a, b) => a - b);
      for (let octave = -2; octave <= 2; octave++) {
        const notes = rotated.map(n => root + n + octave * 12);
        if (notes[0] < 55 || notes[notes.length - 1] > top) continue;
        const centre = notes.reduce((a, b) => a + b, 0) / notes.length;
        const motion = notes.reduce((sum, n, i) => sum + Math.abs(n - (previous[i] ?? 64)), 0);
        const cost = motion + Math.abs(centre - 64) * 0.9 + r * 1.5 + shellIndex * 0.5;
        if (cost < bestCost) { best = notes; bestCost = cost; }
      }
    }
  });
  return best;
}

/** Weak-beat melody notes may use the key's notes that also suit the chord, plus the chord's own tones. */
export function allowedPitchClasses(chord: Chord, keyTonic: number, mode: Mode): Set<number> {
  const key = new Set(KEY_SCALES[mode].map(n => (keyTonic + n) % 12));
  const out = new Set(MELODY_TONES[chord.quality].map(n => (chord.root + n) % 12));
  out.add(chord.root % 12);
  for (const n of CHORD_SCALES[chord.quality]) { const pc = (chord.root + n) % 12; if (key.has(pc)) out.add(pc); }
  return out;
}

export interface HarmonyOptions { loop: Loop; bLoop: Loop; turnaround: Step[]; mode: Mode; tonic: number; nocturne: boolean; hookEnding: boolean }

const soften = (step: Step): Step => step[1] === 'dom7b9' ? [step[0], 'dom7sus'] : step;

/** Lay loops over the form: two passes per 8-bar phrase, the second with a turnaround where the role allows. */
export function buildHarmony(sections: { role: Role; startBar: number; endBar: number }[], options: HarmonyOptions): Chord[][] {
  const { loop, bLoop, turnaround, mode, tonic, nocturne, hookEnding } = options;
  const steps: { bar: Step[]; role: Role }[] = [];
  for (const section of sections) {
    const source = section.role === 'contrast' ? bLoop : loop;
    const turns = !nocturne && loop.turn && ['head', 'return', 'stretch'].includes(section.role);
    const gentle = nocturne || section.role === 'intro' || section.role === 'breath';
    for (let bar = section.startBar; bar < section.endBar; bar++) {
      const inLoop = (bar - section.startBar) % 4, secondPass = (bar - section.startBar) % 8 >= 4;
      let chords = turns && secondPass && inLoop === 3 && source === loop ? turnaround : source.bars[inLoop];
      if (gentle) chords = chords.map(soften);
      steps.push({ bar: chords, role: section.role });
    }
  }
  steps[steps.length - 1].bar = [hookEnding && mode === 'major' ? [5, 'min6'] : [0, mode === 'major' ? 'maj9' : 'min9']];
  let previous = [57, 60, 64, 67];
  const harmony = steps.map(({ bar, role }) => bar.map(([degree, quality], i): Chord => {
    const root = 48 + (tonic + degree) % 12;
    const notes = voice(root, quality, previous, role === 'head' || role === 'return' ? 72 : 74);
    previous = notes;
    return { root, quality, notes, beat: bar.length === 2 ? i * 2 : 0 };
  }));
  // A return is the head again: same chords, same voicings, so the melody sits exactly as it did.
  const head = sections.find(s => s.role === 'head');
  if (head) for (const section of sections.filter(s => s.role === 'return'))
    for (let bar = section.startBar; bar < section.endBar; bar++) harmony[bar] = harmony[head.startBar + bar - section.startBar].map(c => ({ ...c }));
  return harmony;
}

/** The chord sounding at a beat; a note in the last half-beat of a bar anticipates the next bar's chord. */
export function chordAt(harmony: Chord[][], beat: number, anticipate = true): Chord {
  let bar = Math.floor(beat / 4 + 1e-6), within = beat - bar * 4;
  if (anticipate && within >= 3.5 - 1e-6 && bar + 1 < harmony.length) { bar++; within = 0; }
  const chords = harmony[Math.min(harmony.length - 1, Math.max(0, bar))];
  return [...chords].reverse().find(c => c.beat <= within + 1e-6) ?? chords[0];
}
