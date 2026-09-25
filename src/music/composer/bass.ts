import { GROOVE_CELLS } from './cells';
import { PHRASE_CONTOUR, roleDynamics } from './form';
import { chordAt } from './harmony';
import type { Add } from './perform';
import type { SongPlan } from './plan';

/** Bass onsets (beats in the song) that a kick may double; kicks only ever land on these. */
export type BassOnsets = Set<number>;

const low = (root: number) => root - 12;

/** Round bass owning every root: the groove cell's rhythm, fifths on the way, a chromatic step into each new loop. */
export function realiseBass(plan: SongPlan, add: Add): BassOnsets {
  const onsets: BassOnsets = new Set(), cell = GROOVE_CELLS[plan.groove];
  for (const section of plan.sections) {
    for (let bar = section.startBar; bar < section.endBar; bar++) {
      const inSection = bar - section.startBar, at = bar * 4;
      const level = roleDynamics(section.role, inSection) * PHRASE_CONTOUR[inSection % 8];
      // Before the groove starts, a soft root on each downbeat lets the loop be heard as written.
      if (section.role === 'intro' && inSection < 4) { for (const chord of plan.harmony[bar]) add('bass', at + chord.beat, low(chord.root), chord.beat ? 1.9 : 3.5 - (plan.harmony[bar].length - 1) * 1.6, 0.4 * level); continue; }
      if (bar === plan.bars - 1) { add('bass', at, low(plan.harmony[bar][0].root), 3, 0.5 * level); continue; }
      if (bar === plan.bars - 2) { add('bass', at, low(plan.harmony[bar][0].root), 3.5, 0.5 * level); continue; }
      if (section.role === 'breath') {
        for (const chord of plan.harmony[bar]) add('bass', at + chord.beat, low(chord.root), 1.45, 0.63 * level);
        continue;
      }
      const loopEnd = inSection % 4 === 3 && bar + 1 < plan.bars;
      const next = loopEnd ? low(plan.harmony[bar + 1][0].root) : 0;
      const beats = [...cell];
      // A two-chord bar always states its second root, even when the groove has no onset there.
      if (plan.harmony[bar].length > 1 && !beats.some(t => t >= 2 && t < 3.5)) beats.push(2);
      if (loopEnd && !beats.includes(3.5)) beats.push(3.5);
      beats.sort((a, b) => a - b);
      beats.forEach((t, i) => {
        const chord = chordAt(plan.harmony, at + t, false), downbeatChord = plan.harmony[bar][0];
        const root = low(chord.root);
        let note = root, velocity = i === 0 ? 0.63 : 0.46;
        if (loopEnd && t === 3.5) { note = next > root ? next - 1 : next + 1; velocity = 0.34; }
        else if (i > 0 && chord === downbeatChord && t >= 2) note = bar % 2 === 0 ? (root + 7 <= 50 ? root + 7 : root - 5) : root;
        const gap = (beats[i + 1] ?? 4) - t;
        add('bass', at + t, note, Math.min(i === 0 ? 1.45 : 0.8, gap - 0.05), velocity * level);
        onsets.add(at + t);
      });
    }
  }
  return onsets;
}
