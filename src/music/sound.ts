import { randomSource, type MusicMode, type ScoreEvent, type Track } from './composer';
import type { Place } from '../places';
import type { MusicStyle, SoundBank } from './styles';

export const DEFAULT_MIX = { music:0.65, ambience:0.38 } as const;
/** Firefox has no cancelAndHoldAtTime. Capture the current value before cancelling its automation. */
export function holdParameter(parameter:AudioParam,time:number):void {
  if(typeof parameter.cancelAndHoldAtTime==='function')parameter.cancelAndHoldAtTime(time);
  else {const value=parameter.value;parameter.cancelScheduledValues(time);parameter.setValueAtTime(value,time);}
}
export interface Voice { start: number; end: number; gain: GainNode; source: AudioScheduledSourceNode; auxiliary: AudioScheduledSourceNode[]; nodes: AudioNode[] }
export interface SoundGraph {
  context: BaseAudioContext; output: GainNode; music: GainNode; ambience: GainNode; reverb: ConvolverNode;
  ambienceSources: {source:AudioBufferSourceNode;gain:GainNode;start:number}[]; voices: Set<Voice>;
  nodes: AudioNode[]; seed: number; banks: Map<string,SoundBank>;
  /** Long-lived effect oscillators, stopped on disposal; and banks still being built. */
  sources: AudioScheduledSourceNode[]; loading: Map<string,Promise<SoundBank>>;
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

export function createGraph(context: BaseAudioContext, seed:number): SoundGraph {
  const nodes:AudioNode[]=[];
  const gain=(v:number) => {const g=context.createGain();g.gain.value=v;nodes.push(g);return g;};
  const output=gain(0), music=gain(DEFAULT_MIX.music), ambience=gain(DEFAULT_MIX.ambience);
  const compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-12;compressor.knee.value=16;compressor.ratio.value=3;compressor.attack.value=0.008;compressor.release.value=0.22;
  const ceiling=gain(0.78);
  music.connect(compressor);ambience.connect(compressor);compressor.connect(ceiling);ceiling.connect(output);output.connect(context.destination);
  const reverb=context.createConvolver();reverb.buffer=impulse(context,seed);
  const wet=gain(0.20);reverb.connect(wet);wet.connect(music);
  nodes.push(compressor,reverb);
  return {context,output,music,ambience,reverb,nodes,seed,voices:new Set(),ambienceSources:[],banks:new Map(),sources:[],loading:new Map()};
}

/** One style's bank, built once per graph. A failed build is forgotten, so a later request can retry it. */
export function prepareBank(graph:SoundGraph,style:MusicStyle,signal?:AbortSignal):Promise<SoundBank> {
  const ready=graph.banks.get(style.id);if(ready)return Promise.resolve(ready);
  const known=graph.loading.get(style.id);if(known)return known;
  const loading=style.bank(graph,signal).then(bank=>{graph.banks.set(style.id,bank);return bank;}).finally(()=>graph.loading.delete(style.id));
  graph.loading.set(style.id,loading);return loading;
}
export function schedule(graph:SoundGraph,event:ScoreEvent,time:number,secondsPerBeat:number,track:Track):void {
  graph.banks.get(track.style??'lofi')?.schedule(event,time,secondsPerBeat,track);
}
export function setSoundMode(graph:SoundGraph,mode:MusicMode) {for(const bank of graph.banks.values())bank.setMode(mode);}

/** A seeded mono noise hit with its envelope baked in, built once per bank. */
export function noiseBuffer(context: BaseAudioContext, seconds:number, seed:number, envelope:(t:number,noise:number)=>number): AudioBuffer {
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*seconds),context.sampleRate);
  const data=buffer.getChannelData(0), random=randomSource(seed);
  for(let i=0;i<data.length;i++)data[i]=envelope(i/context.sampleRate,random()*2-1);
  return buffer;
}

export function trackVoice(graph:SoundGraph, source:AudioScheduledSourceNode, gain:GainNode, nodes:AudioNode[], start:number,end:number,auxiliary:AudioScheduledSourceNode[]=[] ) {
  const voice={source,gain,nodes,start,end,auxiliary};graph.voices.add(voice);
  source.onended=()=>{for(const extra of auxiliary){try{extra.stop();}catch{/* Already ended. */}}for(const node of nodes)node.disconnect();graph.voices.delete(voice);};
  source.start(start);source.stop(end);
}

/** Seamless 24s field texture: deterministic filtered noise, never new oscillators per frame. */
export function startAmbience(graph:SoundGraph,place:Place,at=graph.context.currentTime) {
  const {context}=graph, length=Math.floor(context.sampleRate*24);
  const buffer=context.createBuffer(2,length,context.sampleRate),random=randomSource(graph.seed^place.id.charCodeAt(0)),{trim,texture}=place.ambience;
  for(let channel=0;channel<2;channel++) {
    const data=buffer.getChannelData(channel);let brown=0,soft=0;
    for(let i=0;i<length;i++) {
      const white=random()*2-1;brown=(brown+white*0.035)/1.035;soft=soft*0.95+white*0.05;
      data[i]=texture(white,brown,soft,i/length*Math.PI*2,channel);
    }
    // A short wrap crossfade prevents a click at the loop boundary.
    const fade=Math.floor(context.sampleRate*0.04);
    for(let i=0;i<fade;i++){const blend=i/fade;data[length-fade+i]=data[length-fade+i]*(1-blend)+data[i]*blend;}
  }
  const source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.loopStart=0.04;source.loopEnd=24;
  // The place's trim sets a quiet bed beneath the sparse opening; the user slider scales it.
  const gain=context.createGain();gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(trim,at+0.6);
  source.connect(gain);gain.connect(graph.ambience);
  for(const old of graph.ambienceSources) {
    // An ambience still to start would hold its gain node's default of 1, not its fade-in. Judge by now rather than `at`,
    // since the fallback hold reads the value now.
    if(old.start>=context.currentTime){old.gain.gain.cancelScheduledValues(at);old.gain.gain.setValueAtTime(0,at);}
    else{holdParameter(old.gain.gain,at);old.gain.gain.linearRampToValueAtTime(0,at+0.6);}
    try{old.source.stop(at+0.65);}catch{/* Already ended. */}
  }
  graph.ambienceSources=[{source,gain,start:at}];
  source.onended=()=>{source.disconnect();gain.disconnect();};source.start(at);
  // Retain this pair only until it ends; the graph owns the current source.
  return {source,gain};
}

export function stopVoices(graph:SoundGraph,at:number,fade=0.12,from=-Infinity) {
  for(const voice of graph.voices) {
    if(voice.start<from)continue;
    // `at` is the current time, so a note starting at or after it has not sounded yet. Its hold would capture the gain
    // node's default of 1, not its envelope, and it would play at full level within the fade.
    if(voice.start>=at){voice.gain.gain.cancelScheduledValues(at);voice.gain.gain.setValueAtTime(0,at);}
    else{holdParameter(voice.gain.gain,at);voice.gain.gain.linearRampToValueAtTime(0,at+fade);}
    try{voice.source.stop(at+fade+0.01);}catch{/* A completed source needs no further stop. */}
    for(const extra of voice.auxiliary){try{extra.stop(at+fade+.01);}catch{/* Already stopped. */}}
  }
  for(const bank of graph.banks.values())bank.stop(at,from);
}

export function disposeGraph(graph:SoundGraph) {
  for(const source of graph.sources){try{source.stop();}catch{/* Already stopped. */}}
  for(const voice of graph.voices) {for(const source of [voice.source,...voice.auxiliary]){try{source.stop();}catch{/* Already stopped. */}}for(const node of voice.nodes)node.disconnect();}
  graph.voices.clear();
  for(const {source,gain} of graph.ambienceSources){try{source.stop();}catch{/* Already stopped. */}source.disconnect();gain.disconnect();}
  graph.ambienceSources=[];
  for(const node of graph.nodes)node.disconnect();
}
