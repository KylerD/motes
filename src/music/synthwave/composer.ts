import { randomSource } from '../composer/random';
import type { Chord, Instrument, Mood, Role, ScoreEvent, Section, Track } from '../composer/types';
import { ARPS, FORMS, HOOKS, INTERVALS, LOOPS, type SynthArrangement } from './catalog';

const names: Record<Mood, string[]> = {
  rain: ['Midnight Overpass', 'Neon Letters', 'Glass Horizons', 'Tail Lights'],
  meadow: ['Pastel Skies', 'Satellite Summer', 'Velvet Horizon', 'Daydream Signal'],
  snow: ['Northern Signals', 'Blue Satellite', 'Polar Lights', 'Night Express'],
  coast: ['Ocean Drive', 'Silver Coastline', 'Afterglow FM', 'Beyond the Harbour'],
};
const keys = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const roles: Role[] = ['intro', 'head', 'contrast', 'breath', 'return', 'tag'];
const sectionNames = ['Distant lights', 'Night drive', 'Another horizon', 'Coasting', 'Homeward', 'Afterglow'];

export function composeSynthwave(seed: number, mood: Mood, index: number, a: SynthArrangement): Track {
  const songSeed = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ mood.charCodeAt(0)) >>> 0;
  const random = randomSource(songSeed), events: ScoreEvent[] = [], harmony: Chord[][] = [];
  let startBar = 0;
  const sections: Section[] = FORMS[a.family].map((length, i) => {
    const section = { name: sectionNames[i], role: roles[i], startBar, endBar: startBar + length };
    startBar += length; return section;
  });
  let brightness = .3;
  const add = (instrument: Instrument, beat: number, note: number, duration: number, velocity: number, pan = 0) => {
    const length = Math.min(duration, a.bars * 4 - beat);
    if (length > 0) events.push({ instrument, beat, note, duration: length, velocity: Math.min(.9, velocity * (.97 + random() * .06)), pan, brightness });
  };

  for (const section of sections) {
    const quiet = section.role === 'breath' || section.role === 'tag';
    const opening = section.role === 'intro';
    const loop = LOOPS[section.role === 'contrast' ? a.contrast : a.loop];
    for (let bar = section.startBar; bar < section.endBar; bar++) {
      const local = bar - section.startBar, beat = bar * 4;
      const progress = local / Math.max(1, section.endBar - section.startBar - 1);
      brightness = quiet ? .3 : opening ? .22 + progress * .4 : section.role === 'return' ? .84 + progress * .12 : .56 + progress * .4;
      const level = a.energy * (quiet ? .76 : opening ? .86 + .14 * progress : .9 + .14 * progress);
      const [degree, colour] = loop[Math.floor(local / 2) % 4];
      const root = (a.tonic + degree) % 12;
      const intervals = INTERVALS[colour];
      const notes = intervals.map(n => { let midi = 48 + root + n; while (midi < 52) midi += 12; while (midi > 74) midi -= 12; return midi; }).sort((x, y) => x - y);
      harmony.push([{ root, quality: colour === 'minor' ? 'min9' : colour === 'sus' ? 'dom7sus' : 'maj7', notes, beat: 0 }]);

      if (local % 2 === 0) for (let n = 0; n < notes.length; n++) add('pad', beat, notes[n], 7.8, level * (a.family === 'drift' ? .58 : .48), (n - 1.5) * .16);
      // Long-short-short sixteenths give the bass its rolling, galloping motion.
      const bassSteps = a.family === 'arpeggio' ? [0, .5, .75, 1, 1.5, 1.75, 2, 2.5, 2.75, 3, 3.5, 3.75]
        : a.family === 'pulse' ? [0, .25, .5, 1, 1.25, 1.5, 2, 2.25, 2.5, 3, 3.25, 3.5]
        : a.family === 'drift' ? [0, 2.5] : [0, .75, 1.5, 2, 2.75, 3.5];
      const sustained = quiet || opening && local < 2;
      for (const at of sustained ? [0] : bassSteps) {
        const fraction = at % 1, octave = fraction === .75 || a.family === 'pulse' && fraction === .5 ? 12 : 0;
        const duration = sustained ? 3.8 : a.family === 'drift' ? 1.25 : a.family === 'arpeggio' ? (fraction === 0 ? .4 : .17) : a.family === 'pulse' ? (fraction === .5 ? .4 : .17) : .4;
        add('synth-bass', beat + at, 36 + root + octave, duration, level * (fraction === 0 ? .74 : .56));
      }
      const playArp = !quiet && (!opening || local >= 2) && (a.family === 'arpeggio' || a.family === 'pulse' && local % 4 >= 2 || a.family === 'lead' && local % 4 >= 2 || a.family === 'drift' && local % 8 === 6);
      if (playArp) {
        const pattern = ARPS[a.arp], step = opening && local < 6 || a.family === 'drift' ? 1 : .5;
        for (let at = 0; at < 4; at += step) {
          const tone = intervals[pattern[(local * 8 + Math.round(at / step)) % pattern.length]];
          let midi = 60 + root + tone; while (midi > 84) midi -= 12;
          add('arp', beat + at, midi, .3, level * (at % 2 === 0 ? .43 : .3), Math.sin(at * 2) * .3);
        }
      }
      // The middle-register chord layer arrives after the groove is established; the return opens with it.
      const full = !opening && !quiet && (local >= 8 || section.role === 'return');
      if (full && (a.family !== 'drift' || local % 4 === 2)) {
        for (const at of a.family === 'drift' ? [1.5] : [1.5, 3.5])
          for (let n = 1; n < notes.length; n++) add('synth-chord', beat + at, notes[n], .42, level * .36, (n - 2) * .2);
      }
      // A two-bar hook, stated and answered, with the final two bars of each phrase left open.
      const hookBar = local % 8;
      const leadHere = !quiet && !opening && local % 2 === 0 && hookBar < (a.family === 'lead' ? 6 : a.family === 'drift' ? 2 : 4);
      if (leadHere || opening && local === 4 || section.role === 'tag' && local === 0) {
        const cell = HOOKS[a.theme.cell];
        cell.forEach(([at, duration], n) => {
          const tone = intervals[(a.theme.contour[n % a.theme.contour.length] + (hookBar === 2 ? 1 : 0)) % 4];
          let midi = 60 + root + tone; while (midi < 67) midi += 12; while (midi > 83) midi -= 12;
          add('lead', beat + at, midi, Math.min(duration, 7.8 - at), level * (opening ? .4 : .64), .06);
        });
      }
      if (!quiet && (!opening || local >= 4)) {
        const kicks = a.family === 'pulse' || a.family === 'arpeggio' && full ? [0, 1, 2, 3] : a.family === 'arpeggio' ? [0, 2] : a.family === 'drift' ? [0] : [0, 2, ...(local % 4 === 3 ? [3.5] : [])];
        for (const at of kicks) add('synth-kick', beat + at, 36, .2, level * .64);
        for (const at of a.family === 'drift' ? [2] : [1, 3]) add('synth-snare', beat + at, 38, .3, level * .44, -.06);
        const hatStep = a.family === 'drift' ? 2 : .5;
        for (let at = .5; at < 4; at += hatStep) if (!(local % 8 === 7 && at > 2)) add('synth-hat', beat + at, 42, .1, level * (at % 1 === .5 ? .22 : .14), .2);
      }
    }
  }
  events.sort((x, y) => x.beat - y.beat);
  return { seed: songSeed, index, title: `${names[mood][index % 4]} · ${['after dark', 'soft signal', 'the way home'][Math.floor(random() * 3)]}`,
    bpm: a.bpm, key: keys[a.tonic] + 'm', bars: a.bars, swing: 0, events, harmony, sections,
    voice: 'electric', form: a.family, mode: 'minor', theme: a.theme, loop: `synth-${a.loop}`, style: 'synthwave', family: a.family };
}
