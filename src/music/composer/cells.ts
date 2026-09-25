import type { CompCell, GrooveCell } from './types';

/** [beat within two bars, duration in beats] on the eighth grid. Hand-written: rhythm is where taste lives. */
export type Cell = [at: number, duration: number][];

/** Two-bar melodic rhythms. Each leaves air, ends on a held note, and never overlaps itself. */
export const MELODY_CELLS: Cell[] = [
  [[0.5, 0.5], [1, 0.5], [1.5, 2], [5, 0.5], [5.5, 0.5], [6, 1.5]],
  [[0, 1], [1, 0.5], [1.5, 1.5], [4.5, 0.5], [5, 2.5]],
  [[1.5, 0.5], [2, 0.5], [2.5, 1], [3.5, 1], [5, 2]],
  [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 2], [6, 1.5]],
  [[2, 0.5], [2.5, 0.5], [3, 1], [4, 0.5], [4.5, 2]],
  [[0.5, 1], [1.5, 1], [2.5, 1.5], [5.5, 0.5], [6, 1.5]],
  [[3, 0.5], [3.5, 0.5], [4, 1], [5, 0.5], [5.5, 2]],
  [[0, 1.5], [1.5, 0.5], [2, 1.5]],
  [[0.5, 0.5], [1, 3], [4.5, 0.5], [5, 0.5], [5.5, 0.5], [6, 1.5]],
  [[0, 0.5], [0.5, 0.5], [1, 0.5], [2, 1], [3, 0.5], [3.5, 1.5], [6, 1.5]],
  [[1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 1.5], [4.5, 0.5], [5, 0.5], [5.5, 1.5]],
  [[0.5, 0.5], [1, 1], [4.5, 0.5], [5, 1.5]],
];

/** A comp hit over two bars. `upper` drops the lowest voice; `tie` plays the next bar's chord early and replaces its downbeat. */
export interface CompHit { at: number; duration: number; velocity: number; upper?: boolean; roll?: boolean; tie?: boolean }

export const COMP_CELLS: Record<CompCell, CompHit[]> = {
  roll: [{ at: 0, duration: 2, velocity: 0.3, roll: true }, { at: 2.5, duration: 1, velocity: 0.18, upper: true },
    { at: 4, duration: 2, velocity: 0.3, roll: true }, { at: 6.5, duration: 1, velocity: 0.18, upper: true }],
  stab: [{ at: 0, duration: 1.4, velocity: 0.27, roll: true }, { at: 1.5, duration: 0.9, velocity: 0.24, upper: true },
    { at: 3.5, duration: 0.45, velocity: 0.2, upper: true }, { at: 5.5, duration: 1.8, velocity: 0.26 }],
  push: [{ at: 0, duration: 3.4, velocity: 0.3, roll: true }, { at: 4, duration: 3.4, velocity: 0.28, roll: true },
    { at: 7.5, duration: 4.4, velocity: 0.29, roll: true, tie: true }],
  halves: [{ at: 0, duration: 1.9, velocity: 0.28, roll: true }, { at: 2, duration: 1.9, velocity: 0.22, upper: true },
    { at: 4, duration: 3.8, velocity: 0.28, roll: true }],
  charleston: [{ at: 0, duration: 1.4, velocity: 0.3, roll: true }, { at: 1.5, duration: 2.4, velocity: 0.22, upper: true },
    { at: 4, duration: 3.8, velocity: 0.29, roll: true }],
  pad: [{ at: 0, duration: 3.8, velocity: 0.3, roll: true }, { at: 4, duration: 3.8, velocity: 0.28, roll: true }],
};

/** Kick and bass move together: every onset is a bass note, and a kick when drums play. */
export const GROOVE_CELLS: Record<GrooveCell, number[]> = {
  home: [0, 2.5],
  skip: [0, 1.5, 2.5],
  late: [0, 3.5],
  lean: [0, 1.5],
};

export type PhraseEnd = 'none' | 'hat-drop' | 'pickup' | 'dropout';
