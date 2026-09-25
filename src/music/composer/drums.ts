import { GROOVE_CELLS, type PhraseEnd } from './cells';
import { PHRASE_CONTOUR, roleDynamics } from './form';
import type { BassOnsets } from './bass';
import type { Add } from './perform';
import type { SongPlan } from './plan';

const HATS = [[0, 1, 1.5, 2, 2.5, 3], [0, 0.5, 1, 2, 2.5, 3, 3.5], [0, 1, 1.5, 2, 3, 3.5]];

/** Soft swung kit. Kicks double the bass, snares sit behind the beat, phrase ends breathe differently each time. */
export function realiseDrums(plan: SongPlan, add: Add, bass: BassOnsets) {
  const cell = GROOVE_CELLS[plan.groove];
  for (const section of plan.sections) {
    for (let bar = section.startBar; bar < section.endBar; bar++) {
      const inSection = bar - section.startBar, at = bar * 4;
      const intro = section.role === 'intro';
      if (section.role === 'breath') continue;
      if (intro && inSection < (plan.energy < 0.65 ? 8 : 4)) continue;
      if (section.role === 'tag' && inSection >= 4) continue;
      const dv = (intro ? 0.65 : 1) * roleDynamics(section.role, inSection) * PHRASE_CONTOUR[inSection % 8] * plan.energy;
      const quarters = intro || plan.energy < 0.65;
      if (plan.form === 'nocturne') {
        if (plan.energy < 0.55) continue;
        for (const beat of [0, 1, 2, 3]) add('hat', at + beat, 42, 0.055, 0.17 * dv, 0.12);
        add('rim', at + 2, 40, 0.06, 0.12 * dv, 0.08);
        continue;
      }
      const end: PhraseEnd = inSection % 8 === 7 && !intro ? plan.phraseEnds[Math.floor(bar / 8)] ?? 'none' : 'none';
      if (end !== 'dropout') {
        cell.forEach((t, i) => add('kick', at + t, 36, 0.2, (i === 0 ? 0.62 : t === 1.5 ? 0.36 : 0.43) * dv));
        if (plan.drumVariant === 2 && inSection % 8 === 7 && !intro && !cell.includes(3.5) && bass.has(at + 3.5)) add('kick', at + 3.5, 36, 0.15, 0.24 * dv);
        const halftime = section.role === 'return' && plan.energy < 0.6;
        if (halftime) add('snare', at + 2, 38, 0.16, 0.45 * dv, -0.04);
        else { add('snare', at + 1, 38, 0.16, 0.40 * dv, -0.04); add('snare', at + 3, 38, 0.16, 0.43 * dv, -0.04); }
        if (plan.ghost && !intro && end !== 'pickup' && bar % 2 === 1) for (const beat of [1.5, 3.5]) add('snare', at + beat, 38, 0.1, 0.09 * Math.min(1, dv), -0.04);
        if (end === 'pickup') { add('snare', at + 2.5, 38, 0.1, 0.12 * dv, -0.04); add('snare', at + 3.5, 38, 0.1, 0.16 * dv, -0.04); }
        if (plan.drumVariant === 1 && end === 'none' && inSection % 8 === 7 && !intro) add('rim', at + 3.5, 40, 0.06, 0.14 * dv, 0.08);
      }
      const hats = quarters ? [0, 1, 2, 3] : HATS[plan.drumVariant];
      for (const beat of hats) {
        if (inSection % 4 === 3 && beat === 3.5) continue;
        if (end === 'hat-drop' && beat >= 3) continue;
        add('hat', at + beat, 42, 0.055, (beat % 1 ? 0.12 : 0.19) * dv, 0.12);
      }
    }
  }
}
