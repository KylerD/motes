import type { Instrument, KeyVoice, ScoreEvent } from './types';

export type Add = (instrument: Instrument, beat: number, note: number, duration: number, velocity: number, pan?: number, roll?: number) => void;

/** One performed grid for the whole band: swing once, then shared microtiming.
 *  Chord rolls happen after the common attack; backbeats sit only slightly behind it. */
export function performer(options: { swing: number; songSeed: number; random: () => number; bars: number; voice?: KeyVoice; tight?: boolean }) {
  const { swing, songSeed, random, bars, voice = 'upright' } = options;
  const events: ScoreEvent[] = [];
  const keyVoice = (instrument: Instrument) => voice === 'vibes' && instrument === 'piano' ? 'felt' : voice;
  const add: Add = (instrument, beat, note, duration, velocity, pan = 0, roll = 0) => {
    const eighth = Math.round(beat * 2);
    const pocket = [0, 0.004, 0.006, 0.004, 0, 0.004, 0.008, 0.004][eighth % 8];
    const phraseDrift = Math.sin(Math.floor(beat / 4) % 8 * 0.85 + songSeed) * 0.003;
    const backbeat = instrument === 'snare' || instrument === 'rim' ? 0.008 : 0;
    // Tight hats vary by ±0.004 beats but never cross back over a bar line, so a section starts where it is written.
    const performed = options.tight
      ? Math.max(Math.floor(beat / 4) * 4, beat + (instrument === 'hat' || instrument === 'open' ? (random() - .5) * .008 : 0)) + roll
      : beat + (eighth % 2 ? swing : 0) + pocket + phraseDrift + backbeat + roll;
    events.push({
      instrument, beat: Math.max(0, Math.min(bars * 4 - 0.01, performed)), note, duration,
      velocity: Math.min(1, velocity * (0.94 + random() * 0.12)), pan,
      ...(instrument === 'piano' || instrument === 'melody' ? { voice: keyVoice(instrument) } : {}),
    });
  };
  return { events, add };
}
