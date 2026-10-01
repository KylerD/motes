import type { ScoreEvent } from '../../composer';
import { addSynthEcho } from './effects';

/** The nodes a dreamy voice routes into; the bank owns them. */
export interface DreamyRoutes {
  context: BaseAudioContext; synth: GainNode; synthSnare: GainNode; bass: GainNode; drums: GainNode;
  drumBuffers: Map<string, AudioBuffer>;
}

export interface SynthVoice {
  source: AudioScheduledSourceNode; auxiliary: AudioScheduledSourceNode[];
  gain: GainNode; nodes: AudioNode[]; end: number;
}

/** Every source is returned to the shared lifecycle owner, including detuned partners. */
export function synthVoice(graph: DreamyRoutes, event: ScoreEvent, time: number, secondsPerBeat: number): SynthVoice | undefined {
  const kind = event.instrument;
  if (!['pad', 'arp', 'lead', 'synth-chord', 'synth-bass', 'synth-kick', 'synth-snare', 'synth-hat'].includes(kind)) return;
  const { context } = graph, gain = context.createGain(), pan = context.createStereoPanner();
  const nodes: AudioNode[] = [gain, pan], auxiliary: AudioScheduledSourceNode[] = [];
  const duration = event.duration * secondsPerBeat;
  // Match the lofi listening level and retain the 18 dB ambience margin in quiet after-hours openings.
  const velocity = event.velocity * 1.45;
  pan.pan.value = event.pan; gain.connect(pan);
  const frequency = 440 * 2 ** ((event.note - 69) / 12);
  let source: AudioScheduledSourceNode, end: number;
  let voiceGain = gain;
  if (kind === 'synth-snare' || kind === 'synth-hat') {
    const noise = context.createBufferSource(), filter = context.createBiquadFilter();
    noise.buffer = graph.drumBuffers.get(kind)!;
    filter.type = kind === 'synth-hat' ? 'highpass' : 'bandpass';
    filter.frequency.value = kind === 'synth-hat' ? 6200 : 1900; filter.Q.value = .65;
    noise.connect(filter); filter.connect(gain); pan.connect(kind === 'synth-snare' ? graph.synthSnare : graph.drums); nodes.push(noise, filter);
    gain.gain.value = velocity * (kind === 'synth-hat' ? .2 : .65);
    source = noise; end = time + .32;
  } else {
    const oscillator = context.createOscillator(); source = oscillator; nodes.push(oscillator);
    if (kind === 'synth-kick') {
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(130, time);
      oscillator.frequency.exponentialRampToValueAtTime(49, time + .075);
      oscillator.connect(gain); pan.connect(graph.drums);
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(velocity * .48, time + .004);
      gain.gain.exponentialRampToValueAtTime(.0001, time + .27); end = time + .3;
    } else {
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; nodes.push(filter);
      const pad = kind === 'pad', bass = kind === 'synth-bass', arp = kind === 'arp', chord = kind === 'synth-chord';
      const brightness = Math.max(0, Math.min(1, event.brightness ?? .65));
      oscillator.type = arp ? 'square' : 'sawtooth'; oscillator.frequency.value = frequency;
      oscillator.detune.value = pad ? -8 : bass || arp ? 0 : -7;
      const weight = context.createGain(); weight.gain.value = pad ? .6 : chord || kind === 'lead' ? .7 : 1;
      oscillator.connect(weight); weight.connect(filter); nodes.push(weight); filter.connect(gain);
      let echoTail = 0;
      if (arp || chord || kind === 'lead') {
        // Cancellation fades the direct note and its queued echoes together.
        voiceGain = context.createGain(); nodes.push(voiceGain);
        pan.connect(voiceGain); voiceGain.connect(graph.synth);
        echoTail = addSynthEcho(context, gain, voiceGain, secondsPerBeat, nodes);
      } else pan.connect(bass ? graph.bass : graph.synth);
      const partner = (type: OscillatorType, detune: number, level: number, pitch = frequency, destination: AudioNode = filter) => {
        const oscillator = context.createOscillator(), mix = context.createGain();
        oscillator.type = type; oscillator.frequency.value = pitch; oscillator.detune.value = detune; mix.gain.value = level;
        oscillator.connect(mix); mix.connect(destination); nodes.push(oscillator, mix); auxiliary.push(oscillator);
      };
      if (pad) {
        partner('sawtooth', 8, .6); partner('triangle', -3, .25); partner('triangle', 3, .25);
      } else if (kind === 'lead' || chord) {
        partner('sawtooth', 7, .7); partner('triangle', 0, .3);
      } else if (bass) {
        partner('sine', 0, .32, event.note >= 40 ? frequency / 2 : frequency, gain);
      }
      const amplitude = velocity * (pad ? .11 : bass ? .28 : arp ? .12 : chord ? .1 : .14);
      const attack = pad ? .65 : bass ? .004 : arp ? .005 : chord ? .012 : .03;
      const release = pad ? 2.4 : bass ? .035 : arp ? .2 : chord ? .24 : .48;
      const dryEnd = time + duration + release + .02;
      end = dryEnd + echoTail;
      filter.Q.value = bass ? 1.1 : arp ? .85 : .5;
      const high = pad ? 1000 + brightness * 1900 : bass ? 650 + brightness * 1500 : arp ? 1600 + brightness * 3400 : 1500 + brightness * 2400;
      filter.frequency.setValueAtTime(pad ? high * .6 : high, time);
      filter.frequency.exponentialRampToValueAtTime(pad ? high : bass ? 200 + brightness * 160 : arp ? 700 : high * .65, time + Math.max(attack, duration * .65));
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(amplitude, time + Math.min(attack, duration * .4));
      gain.gain.exponentialRampToValueAtTime(Math.max(.0002, amplitude * (pad ? .85 : bass ? .65 : arp ? .25 : .78)), time + duration);
      gain.gain.exponentialRampToValueAtTime(.0001, dryEnd - .01);
      // Keep the voice owner alive until the last delayed sample has left its nodes.
      gain.gain.setValueAtTime(0, dryEnd);
    }
  }
  return { source, auxiliary, gain: voiceGain, nodes, end };
}
