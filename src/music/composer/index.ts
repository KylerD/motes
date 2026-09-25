import { realiseBass } from './bass';
import { realiseComp } from './comp';
import { realiseDrums } from './drums';
import { realiseMelody } from './melody';
import { performer } from './perform';
import { planSong, standaloneArrangement } from './plan';
import { chooser, partSeed, randomSource } from './random';
import type { Arrangement, Mood, Track } from './types';

export type * from './types';
export { randomSource } from './random';
export { makeTheme } from './plan';
export { formBars } from './form';

const keyNames = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const words: Record<Mood, string[]> = {
  rain: ['Window Seat', 'After the Rain', 'Blue Hour', 'Last Train', 'Umbrella Waltz', 'Warm Windows'],
  meadow: ['Honey Light', 'Dandelion Days', 'Cloud Watching', 'Sunday Pages', 'Golden Hour', 'Slow Morning'],
  snow: ['Paper Lantern', 'Snow on the Sill', 'The Quiet Car', 'Wool & Ink', 'A Small Fire', 'Northern Postcard'],
  coast: ['Saltwater Pages', 'Low Tide Letters', 'Sea Glass', 'Harbour Lights', 'Driftwood Notes', 'The Reading Room'],
};
const subtitles = ['a little later', 'side streets', 'soft focus', 'the long way home', 'in the margins', 'second cup'];

/** A song is planned (form, loops, theme, groove), then each part is realised on one shared swung grid. */
export function composeTrack(seed: number, mood: Mood, index = 0, arrangement?: Arrangement): Track {
  const songSeed = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(['rain', 'meadow', 'snow', 'coast'].indexOf(mood) + 1, 0x45d9f3b)) >>> 0;
  const random = randomSource(songSeed), choose = chooser(random);
  const title = `${choose(words[mood])} · ${choose(subtitles)}`;
  const chosen = arrangement ?? standaloneArrangement(random, mood);
  const plan = planSong(chosen, songSeed);
  const part = (tag: string) => performer({ swing: plan.swing, songSeed, random: randomSource(partSeed(songSeed, tag)), bars: plan.bars, voice: plan.voice });

  const comp = part('comp'), bass = part('bass'), drums = part('drums'), melody = part('melody');
  realiseComp(plan, comp.add);
  const onsets = realiseBass(plan, bass.add);
  realiseDrums(plan, drums.add, onsets);
  for (const note of realiseMelody({ harmony: plan.harmony, sections: plan.sections, tonic: plan.tonic, mode: plan.mode, theme: plan.theme, anchor: plan.anchor })) {
    melody.add(note.instrument, note.beat, note.note, note.duration, note.velocity, note.instrument === 'melody' ? 0.14 : 0.1);
  }
  const events = [...comp.events, ...bass.events, ...drums.events, ...melody.events].sort((a, b) => a.beat - b.beat);
  return {
    seed: songSeed, index, title, bpm: chosen.bpm, key: keyNames[plan.tonic] + (plan.mode === 'minor' ? 'm' : ''), bars: plan.bars,
    swing: plan.swing, events, harmony: plan.harmony, sections: plan.sections, voice: plan.voice,
    form: plan.form, mode: plan.mode, theme: plan.theme, loop: plan.loop,
  };
}
