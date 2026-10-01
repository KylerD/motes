import type { MusicMode, ScoreEvent, Track } from '../../composer/types';
import { holdParameter, noiseBuffer, trackVoice, type SoundGraph } from '../../sound';
import type { SoundBank } from '../index';
import type { SynthPatch } from './library';

/** A tanh transfer normalised to ±1: quiet signals gain drive/tanh(drive), loud ones flatten towards a square. */
const curve=(drive:number)=>Float32Array.from({length:1024},(_,i)=>{const x=i/511.5-1;return Math.tanh(x*drive)/Math.tanh(drive);});
/** Noise hits as filter type, frequency, Q and level; each envelope is baked into its buffer. The other voices' snares carry
 *  no more 250 ms energy than analog's, so a short hit reads as level without a louder transient. Their peaks sit within
 *  1.5 dB of analog's at the calibration edition and move a little with each day's noise. */
const HITS:Partial<Record<string,[BiquadFilterType,number,number,number]>>={snare:['bandpass',1800,.7,.55],tight:['bandpass',2600,.9,.85],glass:['bandpass',1500,.8,.64],heavy:['bandpass',1300,.6,.45],clap:['bandpass',1200,1,.45],hat:['highpass',7000,1,.22],open:['highpass',6500,1,.2],crash:['highpass',5000,1,.18]};

type Wave=OscillatorType|'pulse';
/** An oscillator as waveform, frequency ratio, detune in cents, level and, where set, its own faster decay in seconds. */
type Tone=readonly [wave:Wave,ratio:number,detune:number,level:number,decay?:number];
/** Each voice's pad, arpeggio, lead and stab: oscillators, filters (a pad's base plus its brightness before dark; an arp's
 *  sweep from, to, over and Q; a lead's cutoff below and above C5), envelopes and gain trims. Trims hold each part within
 *  about 2 dB of analog's; the pulse pad sits a little thinner and darksynth's stabs 3 dB forward. */
interface Patch {
  pad:{tones:readonly Tone[];filter:readonly [base:number,bright:number];attack:number;chorus:number;gain:number};
  arp:{tones:readonly Tone[];filter:readonly [from:number,to:number,over:number,Q:number];release:readonly [least:number,times:number];gain:number};
  lead:{tones:readonly Tone[];filter:readonly [low:number,high:number];attack:number;release:number;gain:number};
  stab:number;
}
/** Each voice's snare: analog's gated one, a tight dry one, a clap-led one and a heavier gate. */
const SNARES:Record<SynthPatch,string>={analog:'snare',pulse:'tight',glass:'glass',dark:'heavy'};
const PATCHES:Record<SynthPatch,Patch>={
  // Detuned saws: the deck's first sound.
  analog:{pad:{tones:[['sawtooth',1,-9,1],['sawtooth',1,9,1]],filter:[1200,2400],attack:.35,chorus:1,gain:.05},
    arp:{tones:[['sawtooth',1,0,1]],filter:[3200,900,.18,4],release:[.12,1.6],gain:.12},
    lead:{tones:[['sawtooth',1,0,1],['square',1,5,.6]],filter:[1400,2600],attack:.02,release:.25,gain:.1},stab:.08},
  // Hollow: one 25% pulse for the pad with less chorus, square plucks and a square lead.
  pulse:{pad:{tones:[['pulse',1,0,1]],filter:[900,1800],attack:.25,chorus:.4,gain:.105},
    arp:{tones:[['square',1,0,1]],filter:[2400,700,.12,2],release:[.1,1.2],gain:.07},
    lead:{tones:[['square',1,0,1]],filter:[1600,2800],attack:.015,release:.2,gain:.07},stab:.08},
  // Sunset: triangle bells with a quick inharmonic shimmer, a soft triangle lead and a slow, closed pad.
  glass:{pad:{tones:[['triangle',1,-6,1],['triangle',1,6,1]],filter:[900,1600],attack:.7,chorus:1,gain:.05},
    arp:{tones:[['triangle',1,0,1],['sine',2.76,0,.3,.12]],filter:[6000,0,0,.7],release:[.35,2],gain:.09},
    lead:{tones:[['triangle',1,0,1]],filter:[2400,3600],attack:.03,release:.35,gain:.12},stab:.08},
  // Late: wide, dark saw stacks with a sub under the lead, and louder organ stabs.
  dark:{pad:{tones:[['sawtooth',1,-15,1],['sawtooth',1,0,.6],['sawtooth',1,15,1]],filter:[600,1400],attack:.4,chorus:1,gain:.045},
    arp:{tones:[['sawtooth',1,0,1],['sawtooth',1,8,.6]],filter:[1800,450,.2,5],release:[.12,1.6],gain:.075},
    lead:{tones:[['sawtooth',1,-10,1],['sawtooth',1,10,1],['sawtooth',.5,0,.4]],filter:[900,1600],attack:.02,release:.3,gain:.09},stab:.12},
};

/** Analog-style synths and a drum machine, all synthesised: nothing to download, and no node runs before the first note. */
export async function synthBank(graph:SoundGraph):Promise<SoundBank> {
  const {context,seed}=graph;
  const noise=(seconds:number,n:number,envelope:(t:number,noise:number)=>number)=>noiseBuffer(context,seconds,n,envelope);
  const buffers:Record<string,AudioBuffer>={
    click:noise(.005,seed^17,(t,n)=>n*Math.exp(-t*400)),
    snare:noise(.32,seed^41,(t,n)=>{
      const body=(n*.7+Math.sin(2*Math.PI*190*t)*.3)*Math.exp(-t*38);
      const tail=t<.2?n*.28*(1-Math.exp(-t*400)):0; // Dense reverb held flat, then cut: the gate.
      return body+tail;
    }),
    tight:noise(.12,seed^44,(t,n)=>(n*.75+Math.sin(2*Math.PI*230*t)*.25)*Math.exp(-t*60)),
    // Claps first, a soft snare body under them.
    glass:noise(.2,seed^47,(t,n)=>n*(t<.05?(t%.02<.01?Math.exp(-(t%.02)*150):0):.8*Math.exp(-(t-.05)*55))+.35*(n*.6+Math.sin(2*Math.PI*200*t)*.4)*Math.exp(-t*45)),
    heavy:noise(.45,seed^49,(t,n)=>(n*.7+Math.sin(2*Math.PI*170*t)*.3)*Math.exp(-t*30)+(t<.3?n*.34*(1-Math.exp(-t*400)):0)),
    // Three claps, each 10 ms with 10 ms between, then the room.
    clap:noise(.11,seed^29,(t,n)=>n*(t<.05?(t%.02<.01?Math.exp(-(t%.02)*150):0):.8*Math.exp(-(t-.05)*55))),
    hat:noise(.05,seed^52,(t,n)=>n*Math.exp(-t*80)),
    open:noise(.35,seed^63,(t,n)=>n*Math.exp(-t*12)),
    crash:noise(1.6,seed^85,(t,n)=>n*Math.exp(-t*2.8)),
  };
  let shared:ReturnType<typeof build>|undefined,mode:MusicMode='beats',echoBeat=0,lastLead=0;
  // The last kick's dip, and when the pump was last reset to 1: dips after a reset have been cancelled.
  let dip:{time:number;depth:number;tau:number}|undefined,settled=0;
  const reset=(t:number)=>{settled=t;if(dip&&dip.time>=t)dip=undefined;};

  function build() {
    const add=<T extends AudioNode>(node:T,...to:AudioNode[])=>{for(const next of to)node.connect(next);graph.nodes.push(node);return node;};
    const gain=(value:number,...to:AudioNode[])=>{const g=add(context.createGain(),...to);g.gain.value=value;return g;};
    const lfo=(rate:number,depth:number)=>{const o=context.createOscillator(),g=gain(depth);o.frequency.value=rate;add(o,g).start();graph.sources.push(o);return g;};
    // Calibrated in verify-mix: bus .715 puts the sunset song (0) at -1.36 dB and the loudest dark one (16) at +1.33 dB from the lofi median.
    const bus=gain(.715,graph.music),pump=gain(1,bus),drums=gain(mode==='ambient'?0:1,bus),reverbSend=gain(.5,graph.reverb);
    // Clean, soft and heavy clipping, chosen per note by darkness. Make-up gains (.48, .16) sit about 1 and 3 dB under
    // the clean path's loudness, so a dark song's drive never outweighs the brighter hour; the bass level after them
    // eases back for Without drums without changing the drive.
    const bassLevel=gain(mode==='ambient'?.7:1,pump);
    const shaper=(drive:number,oversample:OverSampleType,makeup:number)=>{const w=add(context.createWaveShaper(),gain(makeup,bassLevel));w.curve=curve(drive);w.oversample=oversample;return w;};
    const bass=[bassLevel,shaper(1.8,'none',.48),shaper(5,'2x',.16)];
    const chorus=gain(1);
    for(const [delayTime,rate,side] of [[.012,.31,-.6],[.017,.37,.6]]){
      const delay=add(context.createDelay()),pan=add(context.createStereoPanner(),pump);
      delay.delayTime.value=delayTime;pan.pan.value=side;lfo(rate,.002).connect(delay.delayTime);chorus.connect(delay);delay.connect(pan);
    }
    // Tempo-synced echo: every repeat passes the lowpass on its way back round.
    const echo=add(context.createDelay(1)),tone=add(context.createBiquadFilter()),echoReturn=gain(1,bus);
    const feedback=gain(.28,echo);tone.type='lowpass';tone.frequency.value=2400;echo.connect(tone);tone.connect(echoReturn);echoReturn.connect(feedback);
    const organ=context.createPeriodicWave(new Float32Array(9),Float32Array.from([0,1,.6,.45,.35,0,.2,0,.15]));
    // A 25% pulse: cosine terms 2/(nπ)·sin(nπ/4).
    const pulse=context.createPeriodicWave(Float32Array.from({length:32},(_,n)=>n?2/(n*Math.PI)*Math.sin(n*Math.PI/4):0),new Float32Array(32));
    return {bus,pump,drums,bass,bassLevel,chorus,echo,echoReturn,feedback,reverbSend,organ,pulse,vibrato:lfo(5.2,6)};
  }
  const ensureNodes=()=>shared??=build();

  function voice(event:ScoreEvent,time:number,secondsPerBeat:number,track:Track) {
    const voiced=track.voice as SynthPatch,patch=PATCHES[voiced]??PATCHES.analog;
    const name=event.instrument==='snare'?SNARES[voiced]??'snare':event.instrument;
    const s=ensureNodes(),v=event.velocity,f=440*2**((event.note-69)/12),d=event.duration*secondsPerBeat,k=track.darkness??0,hit=HITS[name];
    const nodes:AudioNode[]=[],sources:AudioScheduledSourceNode[]=[];
    const add=<T extends AudioNode>(node:T,...to:AudioNode[])=>{for(const next of to)node.connect(next);nodes.push(node);return node;};
    const pan=add(context.createStereoPanner()),out=add(context.createGain(),pan),g=out.gain;pan.pan.value=event.pan;
    const level=(value:number,to:AudioNode)=>{const stage=add(context.createGain(),to);stage.gain.value=value;return stage;};
    const send=(to:AudioNode,value:number)=>pan.connect(level(value,to));
    const filter=(type:BiquadFilterType,from:number,Q=1,to=0,over=0)=>{
      const b=add(context.createBiquadFilter(),out);b.type=type;b.Q.value=Q;b.frequency.setValueAtTime(from,time);
      if(to)b.frequency.exponentialRampToValueAtTime(to,time+over);
      return b;
    };
    const osc=(type:Wave,frequency:number,to:AudioNode,detune=0)=>{
      const o=add(context.createOscillator(),to);if(type==='pulse')o.setPeriodicWave(s.pulse);else o.type=type;
      o.frequency.setValueAtTime(frequency,time);o.detune.value=detune;sources.push(o);return o;
    };
    // A patch's oscillators into one filter; a tone with its own decay fades inside the note's envelope. Unity tones
    // connect straight through, so the analog patch builds exactly the graph the deck first shipped with.
    const tones=(list:readonly Tone[],to:AudioNode,frequency=f)=>list.map(([type,ratio,detune,value,decay])=>{
      if(value===1&&!decay)return {o:osc(type,frequency*ratio,to,detune),ratio};
      const stage=level(value,to);if(decay){stage.gain.setValueAtTime(value,time);stage.gain.exponentialRampToValueAtTime(.0001,time+decay);}
      return {o:osc(type,frequency*ratio,stage,detune),ratio};
    });
    const buffer=(name:string,to:AudioNode)=>{const b=add(context.createBufferSource(),to);b.buffer=buffers[name];sources.push(b);};
    // Attack to the peak, hold for the note, then an exponential release that ends above zero.
    const envelope=(peak:number,attack:number,release:number,hold=0)=>{
      const at=time+Math.max(attack,hold);
      g.setValueAtTime(0,time);g.linearRampToValueAtTime(peak,time+attack);g.setValueAtTime(peak,at);g.exponentialRampToValueAtTime(.0001,at+release);
      return at+release;
    };
    let end=time;
    switch(event.instrument) {
      case 'pad':{
        const p=patch.pad;tones(p.tones,filter('lowpass',p.filter[0]+p.filter[1]*(1-k),.5));
        if(p.chorus<1){send(s.chorus,p.chorus);send(s.pump,1-p.chorus);}else pan.connect(s.chorus);send(s.reverbSend,.35);end=envelope(p.gain*v,p.attack,.9,d);break;
      }
      case 'bass':{const lp=filter('lowpass',220+1600*v,1,180,.25);osc('sawtooth',f,lp);osc('sawtooth',2*f,level(.5,lp));pan.connect(s.bass[k<.35?0:k<.7?1:2]);end=envelope(.32*v,.005,.06,d);break;}
      case 'arp':{
        const p=patch.arp,[from,to,over,Q]=p.filter;tones(p.tones,filter('lowpass',from,Q,to,over));
        pan.connect(s.pump);send(s.echo,.28);end=envelope(p.gain*v,.003,Math.max(p.release[0],d*p.release[1]));break;
      }
      case 'lead':{
        // A legato note glides in from the previous lead note.
        const p=patch.lead,from=event.legato&&lastLead?lastLead:f;
        const pair=tones(p.tones,filter('lowpass',p.filter[event.note<72?0:1]),from);lastLead=f;
        for(const {o,ratio} of pair){if(from!==f)o.frequency.exponentialRampToValueAtTime(f*ratio,time+.06);s.vibrato.connect(o.detune);}
        // The shared vibrato feeds this note, so its links go when the note ends.
        pair[0].o.addEventListener('ended',()=>{for(const {o} of pair)try{s.vibrato.disconnect(o.detune);}catch{/* Already disposed. */}});
        pan.connect(s.bus);send(s.echo,.3);send(s.reverbSend,.25);end=envelope(p.gain*v,p.attack,p.release,d);break;
      }
      case 'stab':{osc('sine',f,out).setPeriodicWave(s.organ);pan.connect(s.bus);send(s.reverbSend,.4);end=envelope(patch.stab*v,.004,.6);break;}
      case 'kick':{osc('sine',150,out).frequency.exponentialRampToValueAtTime(45,time+.08*(1+k));buffer('click',filter('highpass',2000));pan.connect(s.drums);end=envelope(.9*v,.003,.35);break;}
      case 'tom':{osc('sine',f,out).frequency.exponentialRampToValueAtTime(.6*f,time+.25);pan.connect(s.drums);end=envelope(.5*v,.003,.35);break;}
      default:{
        if(!hit)return;
        const [type,frequency,Q,gain]=hit;buffer(name,filter(type,frequency,Q));g.value=gain*v;pan.connect(s.drums);end=time+buffers[name].duration;
      }
    }
    const [source,...rest]=sources;
    for(const extra of rest){extra.start(time);extra.stop(end+.02);}
    trackVoice(graph,source,out,nodes,time,end+.02,rest);
  }

  return {
    get pump(){return shared?.pump;},
    get echo(){return shared?.echoReturn;},
    schedule(event,time,secondsPerBeat,track) {
      const {pump,echo}=ensureNodes();
      if(event.instrument==='kick'&&mode==='beats'){
        // Sidechain: each kick ducks the pad, bass and arpeggio, deeper after dark, and they swell back within the beat.
        // A 3 ms ramp down starts from where the last swell has reached (1 after a reset), so no dip steps.
        const depth=.15+.45*(track.darkness??0),tau=secondsPerBeat*.18;
        const start=dip&&!(dip.time<settled&&time>=settled)?1-dip.depth*Math.exp(-Math.max(0,time-dip.time-.01)/dip.tau):1;
        pump.gain.setValueAtTime(start,time);pump.gain.linearRampToValueAtTime(1-depth,time+.003);pump.gain.setTargetAtTime(1,time+.01,tau);
        dip={time,depth,tau};
      }
      // A dotted-eighth repeat at every tempo.
      if(echoBeat!==secondsPerBeat){echo.delayTime.setValueAtTime(secondsPerBeat*.75,time);echoBeat=secondsPerBeat;}
      voice(event,time,secondsPerBeat,track);
    },
    setMode(next) {
      mode=next;if(!shared)return;
      const t=context.currentTime,{drums,bassLevel,pump}=shared;
      drums.gain.setTargetAtTime(next==='ambient'?0:1,t,.12);
      bassLevel.gain.setTargetAtTime(next==='ambient'?.7:1,t,.15);
      holdParameter(pump.gain,t);pump.gain.linearRampToValueAtTime(1,t+.02);reset(t);
    },
    // Pumping stops where the cut voices begin, so a song left to finish keeps its own. Pause and skips (from<=at) also
    // close the echo's return and feedback for longer than the longest echo, so the line drains and no tail resumes.
    stop(at,from) {
      if(!shared)return;
      const {pump,echo,echoReturn,feedback}=shared,t=Math.max(at,from);
      // A future hold would stamp the call-time value at `t` where cancelAndHoldAtTime is missing, so set 1 exactly there.
      if(from>at){pump.gain.cancelScheduledValues(t);pump.gain.setValueAtTime(1,t);}
      else{holdParameter(pump.gain,t);pump.gain.linearRampToValueAtTime(1,t+.02);}
      reset(t);
      echo.delayTime.cancelScheduledValues(t);echoBeat=0;
      if(from>at)return;
      lastLead=0;
      // A target curve starts from the value held at `at`; a linear ramp would start from the last reopening instead.
      for(const [param,open] of [[echoReturn.gain,1],[feedback.gain,.28]] as const){
        holdParameter(param,at);param.setTargetAtTime(0,at,.01);param.setValueAtTime(0,at+.05);param.setValueAtTime(0,at+.6);param.linearRampToValueAtTime(open,at+.7);
      }
    },
  };
}
