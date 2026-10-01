import { randomSource } from '../composer/random';
import type { SynthFamily, Theme } from '../composer/types';

export interface SynthArrangement {
  family: SynthFamily; bars: number; bpm: number; tonic: number; energy: number;
  loop: number; contrast: number; theme: Theme; arp: number;
}

// Root movement and chord colour are curated together. Each chord lasts two bars.
export const LOOPS = [
  [[0, 'minor'], [8, 'major'], [3, 'major'], [10, 'major']],
  [[0, 'minor'], [5, 'minor'], [8, 'major'], [10, 'sus']],
  [[8, 'major'], [10, 'major'], [0, 'minor'], [3, 'major']],
  [[0, 'minor'], [3, 'major'], [10, 'sus'], [5, 'minor']],
  [[0, 'minor'], [10, 'major'], [8, 'major'], [5, 'minor']],
  [[3, 'major'], [10, 'major'], [0, 'minor'], [8, 'major']],
  [[5, 'minor'], [8, 'major'], [0, 'minor'], [10, 'sus']],
  [[0, 'minor'], [8, 'major'], [5, 'minor'], [10, 'major']],
] as const;
export const INTERVALS = { minor: [0, 3, 7, 14], major: [0, 4, 7, 11], sus: [0, 5, 7, 14] } as const;
export const FORMS: Record<SynthFamily, number[]> = {
  arpeggio: [8, 24, 16, 8, 16, 8], pulse: [8, 16, 24, 8, 16, 8],
  drift: [8, 16, 8, 8, 16, 8], lead: [8, 24, 24, 8, 24, 8],
};
export const HOOKS = [
  [[0, 1.5], [2, .5], [3, 1], [4.5, 1], [6, 1.5]],
  [[.5, 1], [2, 1.5], [4, 2], [6.5, 1]],
  [[0, 2.5], [3, .5], [4, 1.5], [6, 1.5]],
  [[0, .75], [1.5, .75], [3, 1], [4.5, 2.5]],
  [[1, 1.5], [3, .5], [4, 1], [5.5, 2]],
  [[0, 3], [4, 1.5], [6, 1.5]],
] as const;
export const ARPS = [[0, 2, 1, 3, 2, 1, 3, 2], [0, 1, 2, 3, 2, 1, 2, 1], [3, 2, 1, 0, 1, 2, 1, 2], [0, 2, 3, 2, 1, 2, 3, 1]];

export function synthTheme(random: () => number): Theme {
  const contours = [[0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [1, 2, 1, 0, 1], [0, 2, 1, 2, 0]];
  return { cell: Math.floor(random() * HOOKS.length), contour: contours[Math.floor(random() * contours.length)], degree: 2 };
}

export function planSynthwave(seed: number): SynthArrangement[] {
  const random = randomSource(seed ^ 0x73796e74);
  const tonic = [0, 2, 5, 7, 9][Math.floor(random() * 5)];
  const sequence: SynthFamily[] = ['arpeggio', 'pulse', 'drift', 'lead', 'arpeggio', 'drift', 'pulse', 'lead', 'drift', 'arpeggio', 'lead', 'pulse', 'arpeggio', 'drift', 'lead', 'pulse', 'drift', 'arpeggio'];
  const energy = [.65, .72, .58, .76, .8, .6, .82, .78, .56, .68, .73, .7, .75, .52, .69, .6, .48, .62];
  const tempos = { arpeggio: 98, pulse: 104, drift: 90, lead: 100 };
  const arrangements: SynthArrangement[] = [];
  sequence.forEach((family, i) => {
    const candidates = LOOPS.map((_, n) => n).filter(n => n !== arrangements[i - 1]?.loop && (i !== 16 || n !== arrangements[0].loop));
    const counts = (n: number) => arrangements.filter(a => a.loop === n).length;
    const fewest = Math.min(...candidates.map(counts));
    const available = candidates.filter(n => counts(n) === fewest);
    const loop = available[Math.floor(random() * available.length)];
    arrangements.push({ family, bars: FORMS[family].reduce((a, b) => a + b, 0), bpm: tempos[family] + (random() - .5) * 3,
      tonic: (tonic + (i > 4 && i < 10 ? 5 : i > 11 && i < 16 ? 7 : 0)) % 12,
      energy: energy[i], loop, contrast: (loop + 3) % LOOPS.length, theme: synthTheme(random), arp: Math.floor(random() * ARPS.length) });
  });
  Object.assign(arrangements[17], { tonic: arrangements[0].tonic, loop: arrangements[0].loop, contrast: arrangements[0].contrast, theme: arrangements[0].theme, arp: arrangements[0].arp });
  const scale = arrangements.reduce((sum, a) => sum + a.bars * 240 / a.bpm, 0) / 3600;
  return arrangements.map(a => ({ ...a, bpm: a.bpm * scale }));
}
