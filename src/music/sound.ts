import { randomSource, type Mood, type MusicMode, type ScoreEvent } from './composer';

const sampleNotes = [47,51,54,57,60,63,66,69,72,75,78,81];
export const DEFAULT_MIX = { music:0.65, ambience:0.38 } as const;
// Match continuous textures as a quiet bed beneath the sparse piano opening.
// The user slider scales this calibrated level, including previously saved settings.
const ambienceTrim:Record<Mood,number> = {rain:0.14,meadow:0.24,snow:0.45,coast:0.14};
export type PianoBank = Map<number, AudioBuffer>;
/** Firefox has no cancelAndHoldAtTime. Capture the current value before cancelling its automation. */
export function holdParameter(parameter:AudioParam,time:number):void {
  if(typeof parameter.cancelAndHoldAtTime==='function')parameter.cancelAndHoldAtTime(time);
  else {const value=parameter.value;parameter.cancelScheduledValues(time);parameter.setValueAtTime(value,time);}
}
export interface Voice { start: number; end: number; gain: GainNode; source: AudioScheduledSourceNode; nodes: AudioNode[] }
export interface SoundGraph {
  context: BaseAudioContext; output: GainNode; music: GainNode; ambience: GainNode;
  piano: BiquadFilterNode; melody: BiquadFilterNode; bass: GainNode; drums: GainNode;
  echoDelay: DelayNode; echoBeat: number;
  ambienceSources: {source:AudioBufferSourceNode;gain:GainNode}[]; voices: Set<Voice>; bank: PianoBank;
  drumBuffers: Map<string,AudioBuffer>; nodes: AudioNode[]; seed: number;
}

export async function loadPiano(context: BaseAudioContext, signal?: AbortSignal): Promise<PianoBank> {
  const base = (import.meta as ImportMeta & {env:{BASE_URL:string}}).env.BASE_URL + 'audio/piano/';
  const entries = await Promise.all(sampleNotes.map(async note => {
    const response = await fetch(`${base}${note}.mp3`, {signal});
    if (!response.ok) throw new Error(`The piano could not load (${response.status}). Please try again.`);
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    if (buffer.duration < 0.1) throw new Error('A piano sample is incomplete. Please try again.');
    return [note,buffer] as const;
  }));
  return new Map(entries);
}

function noiseBuffer(context: BaseAudioContext, seconds:number, seed:number, envelope:(t:number,noise:number)=>number): AudioBuffer {
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*seconds),context.sampleRate);
  const data=buffer.getChannelData(0), random=randomSource(seed);
  for(let i=0;i<data.length;i++)data[i]=envelope(i/context.sampleRate,random()*2-1);
  return buffer;
}

function impulse(context: BaseAudioContext, seed:number): AudioBuffer {
  const seconds=1.8, buffer=context.createBuffer(2,Math.ceil(context.sampleRate*seconds),context.sampleRate);
  const random=randomSource(seed);
  for(let channel=0;channel<2;channel++) {
    const data=buffer.getChannelData(channel); let smooth=0;
    for(let i=0;i<data.length;i++) {
      smooth=0.55*smooth+0.45*(random()*2-1);
      data[i]=smooth*Math.pow(1-i/data.length,3.4)*(i<500?i/500:1);
    }
  }
  return buffer;
}

export function createGraph(context: BaseAudioContext, bank:PianoBank, seed:number): SoundGraph {
  const nodes:AudioNode[]=[];
  const gain=(v:number) => {const g=context.createGain();g.gain.value=v;nodes.push(g);return g;};
  const output=gain(0), music=gain(DEFAULT_MIX.music), ambience=gain(DEFAULT_MIX.ambience);
  const compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-12;compressor.knee.value=16;compressor.ratio.value=3;compressor.attack.value=0.008;compressor.release.value=0.22;
  const ceiling=gain(0.78);
  music.connect(compressor);ambience.connect(compressor);compressor.connect(ceiling);ceiling.connect(output);output.connect(context.destination);
  const piano=context.createBiquadFilter();piano.type='lowpass';piano.frequency.value=2800;piano.Q.value=0.35;
  const melody=context.createBiquadFilter();melody.type='lowpass';melody.frequency.value=3300;melody.Q.value=0.35;
  const pianoHP=context.createBiquadFilter();pianoHP.type='highpass';pianoHP.frequency.value=170;pianoHP.Q.value=0.5;
  piano.connect(pianoHP);melody.connect(pianoHP);pianoHP.connect(music);
  const reverb=context.createConvolver();reverb.buffer=impulse(context,seed);
  const wet=gain(0.20);pianoHP.connect(reverb);reverb.connect(wet);wet.connect(music);
  const bass=gain(1),drums=gain(1);bass.connect(music);drums.connect(music);
  // Shared delay adds depth to the upper piano without accumulating unbounded feedback.
  const delay=context.createDelay(1);delay.delayTime.value=0.8;
  const echo=gain(0.065);melody.connect(delay);delay.connect(echo);echo.connect(pianoHP);
  nodes.push(compressor,piano,melody,pianoHP,reverb,delay);
  const drumBuffers=new Map<string,AudioBuffer>();
  drumBuffers.set('snare',noiseBuffer(context,0.20,seed^34,(t,n)=>(n*0.72+Math.sin(2*Math.PI*185*t)*0.28)*Math.exp(-t*30)*(1-Math.exp(-t*1400))));
  drumBuffers.set('hat',noiseBuffer(context,0.12,seed^76,(t,n)=>n*Math.exp(-t*70)*(1-Math.exp(-t*1800))));
  drumBuffers.set('rim',noiseBuffer(context,0.075,seed^99,(t,n)=>(n*0.4+Math.sin(2*Math.PI*1700*t)*0.6)*Math.exp(-t*110)));
  return {context,output,music,ambience,piano,melody,bass,drums,echoDelay:delay,echoBeat:0,bank,drumBuffers,nodes,seed,voices:new Set(),ambienceSources:[]};
}

export function setSoundMode(graph:SoundGraph,mode:MusicMode) {
  const t=graph.context.currentTime;
  graph.drums.gain.setTargetAtTime(mode==='ambient'?0:1,t,0.12);
  graph.bass.gain.setTargetAtTime(mode==='ambient'?0.55:1,t,0.15);
  graph.piano.frequency.setTargetAtTime(mode==='ambient'?2300:2800,t,0.2);
}

function trackVoice(graph:SoundGraph, source:AudioScheduledSourceNode, gain:GainNode, nodes:AudioNode[], start:number,end:number,auxiliary:AudioScheduledSourceNode[]=[] ) {
  const voice={source,gain,nodes,start,end};graph.voices.add(voice);
  source.onended=()=>{for(const extra of auxiliary){try{extra.stop();}catch{/* Already ended. */}}for(const node of nodes)node.disconnect();graph.voices.delete(voice);};
  source.start(start);source.stop(end);
}

export function scheduleNote(graph:SoundGraph,event:ScoreEvent,time:number,secondsPerBeat:number) {
  const {context}=graph;
  const gain=context.createGain(),pan=context.createStereoPanner();pan.pan.value=event.pan;
  gain.connect(pan);
  const duration=event.duration*secondsPerBeat;
  const nodes:AudioNode[]=[gain,pan];
  if(event.instrument==='piano'||event.instrument==='melody') {
    if(event.instrument==='melody'&&graph.echoBeat!==secondsPerBeat){
      // A quarter-note repeat preserves the source note's swing phase at every tempo.
      graph.echoDelay.delayTime.setValueAtTime(secondsPerBeat,time);graph.echoBeat=secondsPerBeat;
    }
    if(event.voice==='electric'||event.voice==='vibes') {
      const carrier=context.createOscillator(),tine=context.createOscillator(),modulation=context.createGain();
      const frequency=440*Math.pow(2,(event.note-69)/12),vibes=event.voice==='vibes';
      carrier.type=tine.type='sine';carrier.frequency.value=frequency;tine.frequency.value=frequency*(vibes?4:1);
      modulation.gain.setValueAtTime(frequency*(vibes?.22:.65),time);
      modulation.gain.exponentialRampToValueAtTime(frequency*.015,time+Math.max(.12,duration*.65));
      tine.connect(modulation);modulation.connect(carrier.frequency);carrier.connect(gain);
      pan.connect(event.instrument==='melody'?graph.melody:graph.piano);nodes.push(carrier,tine,modulation);
      // Match the electric tine's decaying body to the recorded piano, including sparse openings.
      const amplitude=event.velocity*(event.instrument==='melody'?.15:.13)*(vibes?1:2.25),end=time+duration+(vibes?.9:.65);
      gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(amplitude,time+.008);
      gain.gain.exponentialRampToValueAtTime(amplitude*.32,time+Math.max(.04,duration*.65));
      gain.gain.exponentialRampToValueAtTime(.0001,end);
      tine.start(time);tine.stop(end+.01);trackVoice(graph,carrier,gain,nodes,time,end+.02,[tine]);return;
    }
    const sample=sampleNotes.reduce((best,n)=>Math.abs(n-event.note)<Math.abs(best-event.note)?n:best,sampleNotes[0]);
    const source=context.createBufferSource();source.buffer=graph.bank.get(sample)!;
    source.playbackRate.value=Math.pow(2,(event.note-sample)/12);
    // Slow, tiny detuning across the performance gives the piano a tape-like softness.
    source.detune.value=Math.sin(event.beat*0.19+graph.seed)*2.3;
    const felt=event.voice==='felt';
    if(felt){const softness=context.createBiquadFilter();softness.type='lowpass';softness.frequency.value=1700;softness.Q.value=.35;source.connect(softness);softness.connect(gain);nodes.push(softness);}else source.connect(gain);
    pan.connect(event.instrument==='melody'?graph.melody:graph.piano);nodes.push(source);
    const amplitude=event.velocity*(event.instrument==='melody'?0.86:0.63)*(felt?.94:1);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(amplitude,time+(felt?.022:.008));
    gain.gain.setValueAtTime(amplitude,time+Math.max(0.02,duration));
    gain.gain.exponentialRampToValueAtTime(0.0001,time+duration+0.4);
    trackVoice(graph,source,gain,nodes,time,time+duration+0.45);
  } else if(event.instrument==='bass') {
    const oscillator=context.createOscillator();oscillator.type='triangle';
    oscillator.frequency.value=440*Math.pow(2,(event.note-69)/12);
    const lowpass=context.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=350;lowpass.Q.value=0.4;
    oscillator.connect(lowpass);lowpass.connect(gain);pan.connect(graph.bass);nodes.push(oscillator,lowpass);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(event.velocity*0.37,time+0.018);
    gain.gain.exponentialRampToValueAtTime(event.velocity*0.20,time+Math.max(0.05,duration*0.6));
    gain.gain.exponentialRampToValueAtTime(0.0001,time+duration+0.1);
    trackVoice(graph,oscillator,gain,nodes,time,time+duration+0.15);
  } else if(event.instrument==='kick') {
    const oscillator=context.createOscillator();oscillator.type='sine';
    oscillator.frequency.setValueAtTime(78,time);oscillator.frequency.exponentialRampToValueAtTime(52,time+0.045);
    oscillator.connect(gain);pan.connect(graph.drums);nodes.push(oscillator);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(event.velocity*0.36,time+0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001,time+0.18);
    trackVoice(graph,oscillator,gain,nodes,time,time+0.22);
  } else {
    const source=context.createBufferSource();source.buffer=graph.drumBuffers.get(event.instrument)!;
    const filter=context.createBiquadFilter();filter.type='bandpass';
    filter.frequency.value=event.instrument==='hat'?4300:event.instrument==='rim'?1700:1150;
    filter.Q.value=event.instrument==='rim'?1.1:0.65;
    source.connect(filter);filter.connect(gain);pan.connect(graph.drums);nodes.push(source,filter);
    gain.gain.value=event.velocity*(event.instrument==='hat'?0.30:event.instrument==='rim'?0.45:0.68);
    trackVoice(graph,source,gain,nodes,time,time+0.30);
  }
}

/** Seamless 24s field texture: deterministic filtered noise, never new oscillators per frame. */
export function startAmbience(graph:SoundGraph,mood:Mood,at=graph.context.currentTime) {
  const {context}=graph, length=Math.floor(context.sampleRate*24);
  const buffer=context.createBuffer(2,length,context.sampleRate),random=randomSource(graph.seed^mood.charCodeAt(0));
  for(let channel=0;channel<2;channel++) {
    const data=buffer.getChannelData(channel);let brown=0,soft=0;
    for(let i=0;i<length;i++) {
      const white=random()*2-1;brown=(brown+white*0.035)/1.035;soft=soft*0.95+white*0.05;
      const phase=i/length*Math.PI*2;
      const swell=0.45+0.30*Math.sin(phase*3+channel*0.15)+0.12*Math.sin(phase*7);
      data[i]=mood==='rain' ? (white*0.025+soft*0.27) : mood==='coast' ? (brown*0.42+soft*0.26)*swell : mood==='meadow' ? brown*(0.22+0.06*Math.sin(phase*2)) : brown*0.12;
    }
    // A short wrap crossfade prevents a click at the loop boundary.
    const fade=Math.floor(context.sampleRate*0.04);
    for(let i=0;i<fade;i++){const blend=i/fade;data[length-fade+i]=data[length-fade+i]*(1-blend)+data[i]*blend;}
  }
  const source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.loopStart=0.04;source.loopEnd=24;
  const gain=context.createGain();gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(ambienceTrim[mood],at+0.6);
  source.connect(gain);gain.connect(graph.ambience);
  for(const old of graph.ambienceSources) {
    holdParameter(old.gain.gain,at);old.gain.gain.linearRampToValueAtTime(0,at+0.6);
    try{old.source.stop(at+0.65);}catch{/* Already ended. */}
  }
  graph.ambienceSources=[{source,gain}];
  source.onended=()=>{source.disconnect();gain.disconnect();};source.start(at);
  // Retain this pair only until it ends; the graph owns the current source.
  return {source,gain};
}

export function stopVoices(graph:SoundGraph,at:number,fade=0.12,from=-Infinity) {
  // Skipping/pausing must also discard tempo changes queued for abandoned notes.
  graph.echoDelay.delayTime.cancelScheduledValues(Math.max(at,from));graph.echoBeat=0;
  for(const voice of graph.voices) {
    if(voice.start<from)continue;
    holdParameter(voice.gain.gain,at);
    voice.gain.gain.linearRampToValueAtTime(0,at+fade);
    try{voice.source.stop(at+fade+0.01);}catch{/* A completed source needs no further stop. */}
  }
}

export function disposeGraph(graph:SoundGraph) {
  for(const voice of graph.voices) {try{voice.source.stop();}catch{/* Already stopped. */}for(const node of voice.nodes)node.disconnect();}
  graph.voices.clear();
  for(const {source,gain} of graph.ambienceSources){try{source.stop();}catch{/* Already stopped. */}source.disconnect();gain.disconnect();}
  graph.ambienceSources=[];
  for(const node of graph.nodes)node.disconnect();
}
