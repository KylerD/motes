import { COMP_CELLS, type CompHit } from './cells';
import { PHRASE_CONTOUR, roleDynamics } from './form';
import { chordAt } from './harmony';
import type { Add } from './perform';
import type { SongPlan } from './plan';
import type { CompCell, Section } from './types';

/** Which comp cell a section uses. Charleston never runs longer than a phrase: it alternates with halves. */
function cellFor(plan: SongPlan, section: Section, bar: number): { cell: CompCell; upper: boolean } {
  const upper = plan.energy >= 0.5;
  if (plan.form === 'nocturne') return section.role === 'head' || section.role === 'return' ? { cell: 'halves', upper } : section.role === 'intro' ? { cell: 'roll', upper } : { cell: 'pad', upper: false };
  switch (section.role) {
    case 'intro': return { cell: 'roll', upper };
    case 'tag': return { cell: 'roll', upper: false };
    case 'breath': return { cell: 'pad', upper: false };
    case 'stretch': return { cell: 'halves', upper };
    case 'contrast': return { cell: plan.comp === 'halves' ? 'roll' : 'halves', upper };
    default: {
      const oddPhrase = Math.floor((bar - section.startBar) / 8) % 2 === 1;
      return { cell: plan.comp === 'charleston' && oddPhrase ? 'halves' : plan.comp, upper };
    }
  }
}

/** Piano comping from two-bar cells over rootless voicings. A tied push replaces the next downbeat. */
export function realiseComp(plan: SongPlan, add: Add) {
  const tied = new Set<number>();
  for (const section of plan.sections) {
    for (let pair = section.startBar; pair < section.endBar; pair += 2) {
      const { cell, upper } = cellFor(plan, section, pair);
      const hits: CompHit[] = COMP_CELLS[cell].filter(hit => upper || !hit.upper);
      for (let bar = pair; bar < pair + 2; bar++) {
        const within = hits.filter(h => Math.floor(h.at / 4) === bar - pair).map(h => ({ ...h, at: h.at % 4 }));
        // A two-chord bar always sounds its second chord.
        if (plan.harmony[bar].length > 1 && !within.some(h => h.at >= 2)) within.push({ at: 2, duration: 1.9, velocity: 0.24, roll: true });
        const level = roleDynamics(section.role, bar - section.startBar) * PHRASE_CONTOUR[(bar - section.startBar) % 8];
        for (const hit of within) {
          if (hit.at === 0 && tied.has(bar)) continue;
          if (hit.tie && bar + 1 >= plan.bars) continue;
          const beat = bar * 4 + hit.at;
          const chord = chordAt(plan.harmony, beat, !!hit.tie);
          if (hit.tie) tied.add(bar + 1);
          const notes = hit.upper ? chord.notes.slice(1) : chord.notes;
          notes.forEach((note, i) => add('piano', beat, note, hit.duration, hit.velocity * level,
            hit.upper ? i * 0.08 - 0.12 : i * 0.09 - 0.18, hit.roll ? i * 0.009 : 0));
        }
      }
    }
  }
}
