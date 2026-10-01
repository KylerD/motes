import type { MusicMode } from '../../composer';
import { noiseBuffer, trackVoice, type SoundGraph } from '../../sound';
import type { SoundBank } from '../index';
import { createSynthEffects } from './effects';
import { synthVoice, type DreamyRoutes } from './sound';

/** Dreamy synthwave's own chorus, hall, gated snare room, drums and bass; nothing here touches the lofi path. */
export async function dreamyBank(graph:SoundGraph):Promise<SoundBank> {
  const {context,music,seed}=graph;
  const gain=(value:number)=>{const g=context.createGain();g.gain.value=value;g.connect(music);graph.nodes.push(g);return g;};
  const bass=gain(1),drums=gain(1),effects=createSynthEffects(context,music,drums,seed);
  graph.nodes.push(...effects.nodes);graph.sources.push(...effects.sources);
  const drumBuffers=new Map([
    ['synth-snare',noiseBuffer(context,.32,seed^0x813,(t,n)=>(n*.75+Math.sin(2*Math.PI*180*t)*.25)*Math.exp(-t*17)*(1-Math.exp(-t*1800)))],
    ['synth-hat',noiseBuffer(context,.1,seed^0x808,(t,n)=>n*Math.exp(-t*55)*(1-Math.exp(-t*2000)))],
  ]);
  const routes:DreamyRoutes={context,synth:effects.input,synthSnare:effects.snare,bass,drums,drumBuffers};
  return {
    synth:effects.input,
    schedule(event,time,secondsPerBeat) {
      const voice=synthVoice(routes,event,time,secondsPerBeat);if(!voice)return;
      // Partners start with their note, so any later stop is legal; the voice owner stops them with it.
      for(const extra of voice.auxiliary){extra.start(time);extra.stop(voice.end);}
      trackVoice(graph,voice.source,voice.gain,voice.nodes,time,voice.end,voice.auxiliary);
    },
    setMode(mode:MusicMode) {
      const t=context.currentTime;
      drums.gain.setTargetAtTime(mode==='ambient'?0:1,t,.12);
      bass.gain.setTargetAtTime(mode==='ambient'?.55:1,t,.15);
    },
    stop() {},
  };
}
