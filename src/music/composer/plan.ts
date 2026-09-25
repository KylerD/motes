import type { PhraseEnd } from './cells';
import { MELODY_CELLS } from './cells';
import { formBars, sectionsFor } from './form';
import { B_LOOPS, LOOPS, TURNAROUNDS, buildHarmony, loopById } from './harmony';
import { anchorFor, makeContour } from './melody';
import { chooser, partSeed, randomSource } from './random';
import type { Arrangement, Chord, CompCell, FormName, GrooveCell, KeyVoice, Mode, Mood, Section, Theme } from './types';

/** Everything a song is, before a single note is written. */
export interface SongPlan {
  seed: number; bars: number; form: FormName; mode: Mode; tonic: number; sections: Section[]; harmony: Chord[][];
  theme: Theme; anchor: number; comp: CompCell; groove: GrooveCell; energy: number; swing: number; voice: KeyVoice;
  drumVariant: number; ghost: boolean; phraseEnds: PhraseEnd[]; loop: string;
}

export function makeTheme(random: () => number, cell?: number, contour?: number[]): Theme {
  return { cell: cell ?? Math.floor(random() * MELODY_CELLS.length), contour: contour ?? makeContour(random), degree: random() < 0.5 ? 2 : 4 };
}

/** A complete arrangement for a song heard outside a session (standalone previews and groove fixtures). */
export function standaloneArrangement(random: () => number, mood: Mood): Arrangement {
  const choose = chooser(random);
  const form = choose<FormName>(['beat-tape', 'hook', 'long', 'nocturne']);
  const mode: Mode = form === 'nocturne' || random() < 0.3 ? 'minor' : 'major';
  const loops = LOOPS.filter(l => l.mode === mode && (form !== 'nocturne' || l.nocturne));
  return {
    bpm: (mood === 'snow' ? 69 : mood === 'meadow' ? 76 : 72) + Math.floor(random() * 10),
    tonic: choose([0, 2, 3, 5, 7, 8, 10]), voice: 'upright', energy: 1, swing: 0.075 + random() * 0.045,
    form, mode, loop: choose(loops).id,
    comp: form === 'nocturne' ? 'halves' : choose<CompCell>(mode === 'major' ? ['roll', 'stab', 'push', 'halves', 'charleston'] : ['roll', 'push', 'halves', 'charleston']),
    groove: choose<GrooveCell>(['home', 'skip', 'late', 'lean']), theme: makeTheme(random), stretch: form === 'long' && random() < 0.3,
  };
}

/** Plan a song from its arrangement. Choices left to chance come from the song's own seed. */
export function planSong(arrangement: Arrangement, songSeed: number): SongPlan {
  const random = randomSource(songSeed ^ 0x2c1b3c6d), choose = chooser(random);
  const { form, mode, energy } = arrangement;
  const loop = loopById(arrangement.loop);
  const tonic = mode === 'minor' ? (arrangement.tonic + 9) % 12 : arrangement.tonic;
  const sections = sectionsFor(form, arrangement.stretch);
  const bLoop = choose(B_LOOPS.filter(l => l.mode === mode));
  // The turnaround belongs to the song's identity (loop, key, theme), so a returning theme returns whole.
  const identity = randomSource(partSeed(arrangement.theme.cell * 12 + arrangement.tonic, loop.id));
  const harmony = buildHarmony(sections, {
    loop, bLoop, turnaround: chooser(identity)(TURNAROUNDS[mode]), mode, tonic,
    nocturne: form === 'nocturne', hookEnding: form === 'hook' && random() < 0.5,
  });
  const bars = formBars(form), phraseEnds: PhraseEnd[] = [];
  for (let phrase = 0; phrase < bars / 8; phrase++) {
    const nextRole = sections.find(s => s.startBar === (phrase + 1) * 8)?.role;
    const previous = phraseEnds[phrase - 1];
    let end: PhraseEnd = nextRole === 'return' && random() < 0.5 ? 'dropout' : choose<PhraseEnd>(['none', 'none', 'none', 'hat-drop', 'pickup']);
    if (end !== 'none' && end === previous) end = 'none';
    phraseEnds.push(end);
  }
  return {
    seed: songSeed, bars, form, mode, tonic, sections, harmony, loop: loop.id,
    theme: arrangement.theme, anchor: anchorFor(tonic, mode, arrangement.theme.degree, arrangement.theme.contour),
    comp: arrangement.comp, groove: arrangement.groove, energy, swing: arrangement.swing, voice: arrangement.voice,
    drumVariant: Math.floor(random() * 3), ghost: energy >= 0.7 && random() < 0.4, phraseEnds,
  };
}
