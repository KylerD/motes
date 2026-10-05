import { randomSource } from '../composer/random';

function room(context: BaseAudioContext, seed: number, seconds: number, gated = false): AudioBuffer {
  const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const random = randomSource(seed);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel); let smooth = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / context.sampleRate;
      smooth = smooth * .55 + (random() * 2 - 1) * .45;
      const envelope = gated ? Math.min(1, (seconds - t) / .035) * Math.exp(-t * 3) : Math.exp(-t * 1.3);
      data[i] = smooth * envelope * Math.min(1, t / .012);
    }
  }
  return buffer;
}

/** The first `seconds` of an impulse, faded out over its last quarter-second. */
function head(context: BaseAudioContext, buffer: AudioBuffer, seconds: number): AudioBuffer {
  const part = context.createBuffer(buffer.numberOfChannels, Math.round(seconds * buffer.sampleRate), buffer.sampleRate);
  const fade = Math.round(.25 * buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = part.getChannelData(channel);
    data.set(buffer.getChannelData(channel).subarray(0, part.length));
    for (let i = 0; i < fade; i++) data[part.length - 1 - i] *= i / fade;
  }
  return part;
}

/** RMS over all channels: a normalising convolver divides its output by this. */
function power(buffer: AudioBuffer): number {
  let sum = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) for (const value of buffer.getChannelData(channel)) sum += value * value;
  return Math.sqrt(sum / (buffer.numberOfChannels * buffer.length));
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
  // Live, the browser convolves in short blocks, so a long impulse is the costliest part of synthwave.
  // The hall keeps the first two seconds of its 5.2-second decay: the rest is 0.55% of its energy, 22 dB
  // down and under the next notes. Its level is compensated for the shorter impulse's normalisation.
  const full = room(context, seed ^ 0x68416c6c, 5.2), impulse = head(context, full, 2);
  const hall = context.createConvolver(); hall.buffer = impulse;
  const hallLevel = gain(.68 * power(impulse) / power(full));
  input.connect(predelay); predelay.connect(highpass); highpass.connect(hall); hall.connect(lowpass); lowpass.connect(hallLevel); hallLevel.connect(music);
  const plate = context.createConvolver(); plate.buffer = room(context, seed ^ 0x67617465, .28, true);
  const plateLevel = gain(.36); snare.connect(plate); plate.connect(plateLevel); plateLevel.connect(drums);
  nodes.push(predelay, highpass, lowpass, hall, plate);
  lfo.start();
  return { input, snare, nodes, sources };
}

export interface SynthEcho {
  secondsPerBeat: number; input: GainNode; output: GainNode; nodes: AudioNode[];
  /** Closed echoes are fading after a stop and take no new notes. */
  open: boolean;
  /** Audio time after which the last repeat has left its nodes. */
  until: number;
}

/** Four decaying dotted-eighth repeats; no feedback loop or shared tempo automation. */
function createSynthEcho(context: BaseAudioContext, destination: AudioNode, secondsPerBeat: number): SynthEcho {
  const spacing = .75 * secondsPerBeat, input = context.createGain(), output = context.createGain();
  const nodes: AudioNode[] = [input, output];
  let previous: AudioNode = input;
  for (let tap = 1; tap <= 4; tap++) {
    // Short mono stages bound delay storage.
    const delay = context.createDelay(spacing + .01), level = context.createGain(), filter = context.createBiquadFilter(), pan = context.createStereoPanner();
    delay.delayTime.value = spacing; delay.channelCount = 1; delay.channelCountMode = 'explicit';
    level.gain.value = .52 * .6 ** (tap - 1);
    filter.type = 'lowpass'; filter.frequency.value = 4200 * .8 ** (tap - 1); filter.Q.value = .4;
    pan.pan.value = tap % 2 ? -.65 : .65;
    previous.connect(delay); delay.connect(filter); filter.connect(level); level.connect(pan); pan.connect(output);
    previous = delay;
    nodes.push(delay, filter, level, pan);
  }
  output.connect(destination);
  return { secondsPerBeat, input, output, nodes, open: true, until: 0 };
}

/** Plucks at one tempo share one echo, which sums exactly as a chain per note would without
 *  keeping every note's voice alive through its repeats. Echoes whose repeats have finished are released. */
export function synthEcho(context: BaseAudioContext, echoes: SynthEcho[], destination: AudioNode, secondsPerBeat: number, dryEnd: number): GainNode {
  for (const echo of echoes.filter(echo => echo.until < context.currentTime)) {
    for (const node of echo.nodes) node.disconnect();
    echoes.splice(echoes.indexOf(echo), 1);
  }
  let echo = echoes.find(echo => echo.open && echo.secondsPerBeat === secondsPerBeat);
  if (!echo) { echo = createSynthEcho(context, destination, secondsPerBeat); echoes.push(echo); }
  echo.until = Math.max(echo.until, dryEnd + 3 * secondsPerBeat + .1);
  return echo.input;
}
