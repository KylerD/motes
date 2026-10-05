import type { ScoreEvent } from '../composer';
import type { SoundGraph } from '../sound';
import { synthEcho } from './effects';

export interface SynthVoice {
  source: AudioScheduledSourceNode; auxiliary: AudioScheduledSourceNode[];
  gain: GainNode; nodes: AudioNode[]; end: number;
}

/** Every source is returned to the shared lifecycle owner, including detuned partners. */
export function synthVoice(graph: SoundGraph, event: ScoreEvent, time: number, secondsPerBeat: number): SynthVoice | undefined {
  const kind = event.instrument;
  if (!['pad', 'arp', 'lead', 'synth-chord', 'synth-bass', 'synth-kick', 'synth-snare', 'synth-hat'].includes(kind)) return;
  const { context } = graph, gain = context.createGain();
  const nodes: AudioNode[] = [gain], auxiliary: AudioScheduledSourceNode[] = [];
  const duration = event.duration * secondsPerBeat;
  // Match the lofi listening level and retain the 18 dB ambience margin in quiet after-hours openings.
  const velocity = event.velocity * 1.45;
  const pluck = kind === 'arp' || kind === 'synth-chord' || kind === 'lead';
  // Every node of a scheduled voice costs CPU from scheduling until it ends. A centred voice
  // without an echo send skips its panner: the bus up-mixes the mono voice, so its envelope
  // carries the panner's equal-power level instead.
  const centred = event.pan === 0 && !pluck, level = centred ? Math.SQRT1_2 : 1;
  const route = (destination: AudioNode) => {
    if (centred) { gain.connect(destination); return; }
    const pan = context.createStereoPanner(); pan.pan.value = event.pan;
    gain.connect(pan); pan.connect(destination); nodes.push(pan);
  };
  const frequency = 440 * 2 ** ((event.note - 69) / 12);
  let source: AudioScheduledSourceNode, end: number;
  if (kind === 'synth-snare' || kind === 'synth-hat') {
    const noise = context.createBufferSource(), filter = context.createBiquadFilter();
    noise.buffer = graph.drumBuffers.get(kind)!;
    filter.type = kind === 'synth-hat' ? 'highpass' : 'bandpass';
    filter.frequency.value = kind === 'synth-hat' ? 6200 : 1900; filter.Q.value = .65;
    noise.connect(filter); filter.connect(gain); route(kind === 'synth-snare' ? graph.synthSnare : graph.drums); nodes.push(noise, filter);
    gain.gain.value = level * velocity * (kind === 'synth-hat' ? .2 : .65);
    source = noise; end = time + .32;
  } else {
    const oscillator = context.createOscillator(); source = oscillator; nodes.push(oscillator);
    if (kind === 'synth-kick') {
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(130, time);
      oscillator.frequency.exponentialRampToValueAtTime(49, time + .075);
      oscillator.connect(gain); route(graph.drums);
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(level * velocity * .48, time + .004);
      gain.gain.exponentialRampToValueAtTime(level * .0001, time + .27); end = time + .3;
    } else {
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; nodes.push(filter);
      const pad = kind === 'pad', bass = kind === 'synth-bass', arp = kind === 'arp', chord = kind === 'synth-chord';
      const brightness = Math.max(0, Math.min(1, event.brightness ?? .65));
      oscillator.type = arp ? 'square' : 'sawtooth'; oscillator.frequency.value = frequency;
      oscillator.detune.value = pad ? -8 : bass || arp ? 0 : -7;
      // Oscillators at the same level share one mix.
      const mix = (amount: number, destination: AudioNode = filter): AudioNode => {
        if (amount === 1) return destination;
        const node = context.createGain(); node.gain.value = amount; node.connect(destination); nodes.push(node);
        return node;
      };
      const body = mix(pad ? .6 : chord || kind === 'lead' ? .7 : 1);
      oscillator.connect(body); filter.connect(gain);
      route(bass ? graph.bass : graph.synth);
      const partner = (type: OscillatorType, detune: number, destination: AudioNode, pitch = frequency) => {
        const oscillator = context.createOscillator();
        oscillator.type = type; oscillator.frequency.value = pitch; oscillator.detune.value = detune;
        oscillator.connect(destination); nodes.push(oscillator); auxiliary.push(oscillator);
      };
      if (pad) {
        const soft = mix(.25);
        partner('sawtooth', 8, body); partner('triangle', -3, soft); partner('triangle', 3, soft);
      } else if (kind === 'lead' || chord) {
        partner('sawtooth', 7, body); partner('triangle', 0, mix(.3));
      } else if (bass) {
        partner('sine', 0, mix(.32, gain), event.note >= 40 ? frequency / 2 : frequency);
      }
      const amplitude = velocity * (pad ? .11 : bass ? .28 : arp ? .12 : chord ? .1 : .14);
      const attack = pad ? .65 : bass ? .004 : arp ? .005 : chord ? .012 : .03;
      const release = pad ? 2.4 : bass ? .035 : arp ? .2 : chord ? .24 : .48;
      const dryEnd = time + duration + release + .02;
      end = dryEnd;
      // Plucks repeat through their tempo's shared echo; a stop fades the echo with the notes.
      if (pluck) gain.connect(synthEcho(context, graph.synthEchoes, graph.synth, secondsPerBeat, dryEnd));
      filter.Q.value = bass ? 1.1 : arp ? .85 : .5;
      const high = pad ? 1000 + brightness * 1900 : bass ? 650 + brightness * 1500 : arp ? 1600 + brightness * 3400 : 1500 + brightness * 2400;
      filter.frequency.setValueAtTime(pad ? high * .6 : high, time);
      filter.frequency.exponentialRampToValueAtTime(pad ? high : bass ? 200 + brightness * 160 : arp ? 700 : high * .65, time + Math.max(attack, duration * .65));
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(level * amplitude, time + Math.min(attack, duration * .4));
      gain.gain.exponentialRampToValueAtTime(level * Math.max(.0002, amplitude * (pad ? .85 : bass ? .65 : arp ? .25 : .78)), time + duration);
      gain.gain.exponentialRampToValueAtTime(level * .0001, dryEnd - .01);
      // Arrive at true silence as the voice ends.
      gain.gain.setValueAtTime(0, dryEnd);
    }
  }
  return { source, auxiliary, gain, nodes, end };
}
