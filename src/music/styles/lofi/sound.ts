import { noiseBuffer, trackVoice, type SoundGraph } from '../../sound';
import type { SoundBank } from '../index';

const sampleNotes = [47,51,54,57,60,63,66,69,72,75,78,81];
type PianoBank = Map<number, AudioBuffer>;

async function loadPiano(context: BaseAudioContext, signal?: AbortSignal): Promise<PianoBank> {
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
// Decoded once per sample rate; a failed load is forgotten so Listen can retry it.
const pianos=new Map<number,Promise<PianoBank>>();
const samples=(context:BaseAudioContext,signal?:AbortSignal)=>{
  const rate=context.sampleRate,known=pianos.get(rate);if(known)return known;
  const loading=loadPiano(context,signal).catch(error=>{pianos.delete(rate);throw error;});
  pianos.set(rate,loading);return loading;
};

export async function lofiBank(graph:SoundGraph,signal?:AbortSignal):Promise<SoundBank> {
  const bank=await samples(graph.context,signal),{context,music,seed}=graph;
  const gain=(v:number) => {const g=context.createGain();g.gain.value=v;graph.nodes.push(g);return g;};
  const piano=context.createBiquadFilter();piano.type='lowpass';piano.frequency.value=2800;piano.Q.value=0.35;
  const melody=context.createBiquadFilter();melody.type='lowpass';melody.frequency.value=3300;melody.Q.value=0.35;
  const pianoHP=context.createBiquadFilter();pianoHP.type='highpass';pianoHP.frequency.value=170;pianoHP.Q.value=0.5;
  piano.connect(pianoHP);melody.connect(pianoHP);pianoHP.connect(music);pianoHP.connect(graph.reverb);
  const bass=gain(1),drums=gain(1);bass.connect(music);drums.connect(music);
  // Shared delay adds depth to the upper piano without accumulating unbounded feedback.
  const delay=context.createDelay(1);delay.delayTime.value=0.8;
  const echo=gain(0.065);melody.connect(delay);delay.connect(echo);echo.connect(pianoHP);
  graph.nodes.push(piano,melody,pianoHP,delay);
  const drumBuffers=new Map<string,AudioBuffer>();
  drumBuffers.set('snare',noiseBuffer(context,0.20,seed^34,(t,n)=>(n*0.72+Math.sin(2*Math.PI*185*t)*0.28)*Math.exp(-t*30)*(1-Math.exp(-t*1400))));
  drumBuffers.set('hat',noiseBuffer(context,0.12,seed^76,(t,n)=>n*Math.exp(-t*70)*(1-Math.exp(-t*1800))));
  drumBuffers.set('rim',noiseBuffer(context,0.075,seed^99,(t,n)=>(n*0.4+Math.sin(2*Math.PI*1700*t)*0.6)*Math.exp(-t*110)));
  let echoBeat=0;
  return {
    schedule(event,time,secondsPerBeat) {
      const gain=context.createGain(),pan=context.createStereoPanner();pan.pan.value=event.pan;
      gain.connect(pan);
      const duration=event.duration*secondsPerBeat;
      const nodes:AudioNode[]=[gain,pan];
      if(event.instrument==='piano'||event.instrument==='melody') {
        if(event.instrument==='melody'&&echoBeat!==secondsPerBeat){
          // A quarter-note repeat preserves the source note's swing phase at every tempo.
          delay.delayTime.setValueAtTime(secondsPerBeat,time);echoBeat=secondsPerBeat;
        }
        if(event.voice==='electric'||event.voice==='vibes') {
          const carrier=context.createOscillator(),tine=context.createOscillator(),modulation=context.createGain();
          const frequency=440*Math.pow(2,(event.note-69)/12),vibes=event.voice==='vibes';
          carrier.type=tine.type='sine';carrier.frequency.value=frequency;tine.frequency.value=frequency*(vibes?4:1);
          modulation.gain.setValueAtTime(frequency*(vibes?.22:.65),time);
          modulation.gain.exponentialRampToValueAtTime(frequency*.015,time+Math.max(.12,duration*.65));
          tine.connect(modulation);modulation.connect(carrier.frequency);carrier.connect(gain);
          pan.connect(event.instrument==='melody'?melody:piano);nodes.push(carrier,tine,modulation);
          // Match the electric tine's decaying body to the recorded piano, including sparse openings.
          const amplitude=event.velocity*(event.instrument==='melody'?.15:.13)*(vibes?1:2.25),end=time+duration+(vibes?.9:.65);
          gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(amplitude,time+.008);
          gain.gain.exponentialRampToValueAtTime(amplitude*.32,time+Math.max(.04,duration*.65));
          gain.gain.exponentialRampToValueAtTime(.0001,end);
          tine.start(time);tine.stop(end+.01);trackVoice(graph,carrier,gain,nodes,time,end+.02,[tine]);return;
        }
        const sample=sampleNotes.reduce((best,n)=>Math.abs(n-event.note)<Math.abs(best-event.note)?n:best,sampleNotes[0]);
        const source=context.createBufferSource();source.buffer=bank.get(sample)!;
        source.playbackRate.value=Math.pow(2,(event.note-sample)/12);
        // Slow, tiny detuning across the performance gives the piano a tape-like softness.
        source.detune.value=Math.sin(event.beat*0.19+seed)*2.3;
        const felt=event.voice==='felt';
        if(felt){const softness=context.createBiquadFilter();softness.type='lowpass';softness.frequency.value=1700;softness.Q.value=.35;source.connect(softness);softness.connect(gain);nodes.push(softness);}else source.connect(gain);
        pan.connect(event.instrument==='melody'?melody:piano);nodes.push(source);
        const amplitude=event.velocity*(event.instrument==='melody'?0.86:0.63)*(felt?.94:1);
        gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(amplitude,time+(felt?.022:.008));
        gain.gain.setValueAtTime(amplitude,time+Math.max(0.02,duration));
        gain.gain.exponentialRampToValueAtTime(0.0001,time+duration+0.4);
        trackVoice(graph,source,gain,nodes,time,time+duration+0.45);
      } else if(event.instrument==='bass') {
        const oscillator=context.createOscillator();oscillator.type='triangle';
        oscillator.frequency.value=440*Math.pow(2,(event.note-69)/12);
        const lowpass=context.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=350;lowpass.Q.value=0.4;
        oscillator.connect(lowpass);lowpass.connect(gain);pan.connect(bass);nodes.push(oscillator,lowpass);
        gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(event.velocity*0.37,time+0.018);
        gain.gain.exponentialRampToValueAtTime(event.velocity*0.20,time+Math.max(0.05,duration*0.6));
        gain.gain.exponentialRampToValueAtTime(0.0001,time+duration+0.1);
        trackVoice(graph,oscillator,gain,nodes,time,time+duration+0.15);
      } else if(event.instrument==='kick') {
        const oscillator=context.createOscillator();oscillator.type='sine';
        oscillator.frequency.setValueAtTime(78,time);oscillator.frequency.exponentialRampToValueAtTime(52,time+0.045);
        oscillator.connect(gain);pan.connect(drums);nodes.push(oscillator);
        gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(event.velocity*0.36,time+0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001,time+0.18);
        trackVoice(graph,oscillator,gain,nodes,time,time+0.22);
      } else {
        const source=context.createBufferSource();source.buffer=drumBuffers.get(event.instrument)!;
        const filter=context.createBiquadFilter();filter.type='bandpass';
        filter.frequency.value=event.instrument==='hat'?4300:event.instrument==='rim'?1700:1150;
        filter.Q.value=event.instrument==='rim'?1.1:0.65;
        source.connect(filter);filter.connect(gain);pan.connect(drums);nodes.push(source,filter);
        gain.gain.value=event.velocity*(event.instrument==='hat'?0.30:event.instrument==='rim'?0.45:0.68);
        trackVoice(graph,source,gain,nodes,time,time+0.30);
      }
    },
    setMode(mode) {
      const t=context.currentTime;
      drums.gain.setTargetAtTime(mode==='ambient'?0:1,t,0.12);
      bass.gain.setTargetAtTime(mode==='ambient'?0.55:1,t,0.15);
      piano.frequency.setTargetAtTime(mode==='ambient'?2300:2800,t,0.2);
    },
    // Skipping/pausing must also discard tempo changes queued for abandoned notes.
    stop(at,from){delay.delayTime.cancelScheduledValues(Math.max(at,from));echoBeat=0;},
  };
}
