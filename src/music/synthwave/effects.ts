import { randomSource } from '../composer/random';

function room(context: BaseAudioContext, seed: number, seconds: number, gated = false): AudioBuffer {
  const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const random = randomSource(seed);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel); let smooth = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / context.sampleRate;
      smooth = smooth * .55 + (random() * 2 - 1) * .45;
      const envelope = gated ? Math.min(1, (seconds - t) / .035) * Math.exp(-t * 3) : Math.exp(-t * 2.25);
      data[i] = smooth * envelope * Math.min(1, t / .012);
    }
  }
  return buffer;
}

/** A separate stereo chorus/hall and short gated snare room keep the lofi mix untouched. */
export function createSynthEffects(context: BaseAudioContext, music: GainNode, drums: GainNode, seed: number) {
  const nodes: AudioNode[] = [], sources: AudioScheduledSourceNode[] = [];
  const gain = (value: number) => { const node = context.createGain(); node.gain.value = value; nodes.push(node); return node; };
  const input = gain(.9), snare = gain(1);
  input.connect(music); snare.connect(drums);

  const lfo = context.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = .28; sources.push(lfo); nodes.push(lfo);
  for (const side of [-1, 1]) {
    const delay = context.createDelay(.1), modulation = gain(side * .0025), wet = gain(.26), pan = context.createStereoPanner();
    delay.delayTime.value = side < 0 ? .017 : .025; pan.pan.value = side * .85;
    lfo.connect(modulation); modulation.connect(delay.delayTime);
    input.connect(delay); delay.connect(wet); wet.connect(pan); pan.connect(music);
    nodes.push(delay, pan);
  }
  const predelay = context.createDelay(.1), highpass = context.createBiquadFilter(), lowpass = context.createBiquadFilter();
  predelay.delayTime.value = .035; highpass.type = 'highpass'; highpass.frequency.value = 230;
  lowpass.type = 'lowpass'; lowpass.frequency.value = 5300;
  const hall = context.createConvolver(); hall.buffer = room(context, seed ^ 0x68416c6c, 3.4);
  const hallLevel = gain(.48);
  input.connect(predelay); predelay.connect(highpass); highpass.connect(hall); hall.connect(lowpass); lowpass.connect(hallLevel); hallLevel.connect(music);
  const plate = context.createConvolver(); plate.buffer = room(context, seed ^ 0x67617465, .28, true);
  const plateLevel = gain(.36); snare.connect(plate); plate.connect(plateLevel); plateLevel.connect(drums);
  nodes.push(predelay, highpass, lowpass, hall, plate);
  lfo.start();
  return { input, snare, nodes, sources };
}
