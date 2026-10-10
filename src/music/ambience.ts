import type {Mood} from './composer';
import {SOUND_MAPS,type Arc,type Bed,type Position,type SoundMap,type Spots} from './ambience-maps';
import {fadeSynthesisedBed,holdParameter,startAmbience,type SoundGraph} from './sound';
import {BED_SWAP,bedSegment,bedSegmentAt,spotsBetween,type BedSegment,type PlannedSpot} from '../session/session';
import {sceneLightAt} from '../scenes/scene-light';

export type ListeningSpace='speakers'|'headphones';
export type SceneSoundState='synthesised'|'loading'|'recorded'|'failed';
/** Decoded scene sounds may hold at most this for the active place (plus the outgoing one during a handover). */
export const DECODED_CAP=32*1024*1024;
/** Placed beds take one panner each; spots share a pool of four; a moving event takes one. */
export const PANNER_BUDGET=8,SPOT_PANNERS=4;
/** Beds crossfade over CROSSFADE seconds; recordings arrive over ARRIVE; a place left behind fades over LEAVE. */
const CROSSFADE=4,ARRIVE=2,RESUME=.6,LEAVE=.6;
const base=()=>(import.meta as ImportMeta&{env:{BASE_URL:string}}).env.BASE_URL+'audio/ambience/';
const curve=(shape:(t:number)=>number,level:number)=>Float32Array.from({length:64},(_,i)=>shape(i/63)*level);
const rise=(t:number)=>Math.sin(t*Math.PI/2),fall=(t:number)=>Math.cos(t*Math.PI/2);

/** Web Audio's frame: the listener at the origin facing −z, +x to the right, +y up. Speakers pull sounds a third of the way in. */
export function placeAt(position:Position,space:ListeningSpace) {
  const azimuth=position.azimuth*(space==='speakers'?2/3:1)*Math.PI/180,elevation=position.elevation*Math.PI/180,r=position.distance;
  return {x:r*Math.cos(elevation)*Math.sin(azimuth),y:r*Math.sin(elevation),z:-r*Math.cos(elevation)*Math.cos(azimuth)};
}
/** The arc value a sound follows; after the hour every arc holds its evening. */
export function arcAt(mood:Mood,arc:Arc,seconds:number):number {
  const value=(sceneLightAt(mood,seconds) as unknown as Record<string,unknown>)[arc];
  return typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
}
const mixAt=(shape:{arrival:number;evening:number},value:number)=>shape.arrival+(shape.evening-shape.arrival)*value;
const filesOf=(map:SoundMap)=>[...map.beds,...map.spots].map(sound=>sound.file);

interface BedVoice {bed:Bed;buffer:AudioBuffer;loop:[start:number,end:number];level:GainNode;filter?:BiquadFilterNode;panner?:PannerNode;next:number;value:number}
interface Panner {node:PannerNode;until:number}
interface Place {
  mood:Mood;seed:number;map:SoundMap;buffers:Map<string,AudioBuffer>;output:GainNode;beds:BedVoice[];pool:Panner[];
  /** Audio time at which this place's listening began: audio time = origin + listening seconds. */
  origin:number;spotsThrough:number;spots:boolean;sources:Set<AudioScheduledSourceNode>;nodes:AudioNode[];
  /** When the place is freed once released; a pause during a handover brings it forward. */
  freeAt?:number;timer?:ReturnType<typeof setTimeout>;
}

/** Each place's recorded sound map: beds and spots placed around the listener, following the evening.
 * It owns its sources and panners the way the composer owns voices, so pause, handover and place change free them. */
export class SceneSounds {
  private place?:Place;
  private leaving=new Set<Place>();
  /** Compressed recordings stay in memory (about a megabyte a place), so returning never downloads again. */
  private encoded=new Map<Mood,ArrayBuffer[]>();
  private loading?:{mood:Mood;promise:Promise<void>;abort:AbortController};
  private failed=new Set<Mood>();
  private current?:{mood:Mood;seed:number;spots:boolean;beds:boolean};
  private running=false;
  private disposed=false;
  /** Bed readings and spots started so far, for verification. */
  private started={segments:0,spots:0};

  /** `listening` maps audio time to the place's listening seconds (the environment clock). */
  constructor(private graph:SoundGraph,private space:ListeningSpace='speakers',private listening:(at:number)=>number=at=>at) {}

  get state():SceneSoundState {
    const mood=this.current?.mood;
    if(!mood||!SOUND_MAPS[mood])return 'synthesised';
    if(this.failed.has(mood))return 'failed';
    return this.graph.scenes.has(mood)?'recorded':'loading';
  }
  get diagnostics() {
    const places=[...(this.place?[this.place]:[]),...this.leaving];
    return {state:this.state,places:places.length,sources:places.reduce((sum,place)=>sum+place.sources.size,0),
      panners:places.reduce((sum,place)=>sum+place.pool.length+place.beds.filter(bed=>bed.panner).length,0),
      started:{...this.started},decodedBytes:[...this.graph.scenes.values()].reduce((sum,buffers)=>sum+[...buffers.values()].reduce((s,b)=>s+b.length*b.numberOfChannels*4,0),0)};
  }

  /** Start listening to a place at audio time `at`, `seconds` into its listening time. Recordings load the first
   * time a place is played; until they arrive (or if they fail) its synthesised bed plays. */
  start(mood:Mood,seed:number,at:number,seconds:number,options:{spots?:boolean;beds?:boolean}={}):void {
    if(this.disposed)return;
    this.current={mood,seed,spots:options.spots??true,beds:options.beds??true};this.running=true;
    if(this.graph.scenes.has(mood)){fadeSynthesisedBed(this.graph,at,RESUME);this.arrive(at,seconds,RESUME);return;}
    startAmbience(this.graph,mood,at);
    if(SOUND_MAPS[mood]&&!this.failed.has(mood))void this.load(mood);
  }

  /** Move to another place now: the old one fades out while its song finishes, the new one starts at once. */
  change(mood:Mood,seed:number,at:number):void {
    if(this.place){this.leave(this.place,at);this.place=undefined;}
    this.start(mood,seed,at,0,{spots:this.current?.spots,beds:this.current?.beds});
  }

  /** Pause: stop every source after the radio's own fade. Decoded sounds for the current place are kept for resume. */
  pause(at:number):void {
    this.running=false;
    fadeSynthesisedBed(this.graph,at,.13);
    if(this.place){this.leaving.add(this.place);this.release(this.place,at+.14);this.place=undefined;}
    for(const place of this.leaving)this.release(place,at+.14);
  }

  /** Plan beds and spots up to `horizon` seconds of audio time, and follow the evening's arc. */
  schedule(now:number,horizon:number):void {
    const place=this.place;
    if(!place||!this.running)return;
    const seconds=Math.max(0,now-place.origin),through=horizon-place.origin;
    for(const voice of place.beds) {
      const value=arcAt(place.mood,voice.bed.arc,seconds),level=mixAt(voice.bed,value);
      if(Math.abs(level-voice.value)>.004) {
        voice.value=level;voice.level.gain.setTargetAtTime(level,now,2);
        if(voice.filter&&voice.bed.lowpass)voice.filter.frequency.setTargetAtTime(mixAt({arrival:voice.bed.lowpass[0],evening:voice.bed.lowpass[1]},value),now,2);
      }
      for(let segment=bedSegment(place.seed,voice.bed.name,voice.next);place.origin+segment.start-CROSSFADE/2<=horizon;segment=bedSegment(place.seed,voice.bed.name,++voice.next))
        this.segment(place,voice,segment,place.origin+segment.start-CROSSFADE/2,CROSSFADE,0);
    }
    if(!place.spots||through<=place.spotsThrough)return;
    const planned=place.map.spots.flatMap(family=>spotsBetween(place.seed,family,place.spotsThrough,through).map(spot=>({family,spot})));
    place.spotsThrough=through;
    for(const {family,spot} of planned.sort((a,b)=>a.spot.time-b.spot.time))this.spot(place,family,spot,now);
  }

  setSpace(space:ListeningSpace):void {
    this.space=space;
    const now=this.graph.context.currentTime;
    for(const place of [...(this.place?[this.place]:[]),...this.leaving]) {
      for(const voice of place.beds)if(voice.panner&&voice.bed.position){voice.panner.panningModel=this.model;this.position(voice.panner,voice.bed.position,now);}
      for(const panner of place.pool)panner.node.panningModel=this.model;
    }
  }

  /** Try the recordings again after a failure. A paused radio loads but stays silent. */
  retry():Promise<void> {
    const mood=this.current?.mood;
    if(!mood||!this.failed.has(mood))return Promise.resolve();
    this.failed.delete(mood);
    return this.load(mood);
  }

  /** Recordings for offline renders and clips: fetched (or reused) and decoded before anything plays. */
  async prepare(mood:Mood,seed:number):Promise<boolean> {
    this.current={mood,seed,spots:this.current?.spots??true,beds:this.current?.beds??true};
    if(!SOUND_MAPS[mood])return false;
    await this.load(mood);
    return this.graph.scenes.has(mood);
  }

  dispose():void {
    if(this.disposed)return;
    this.disposed=true;this.loading?.abort.abort();this.pause(this.graph.context.currentTime);
    this.graph.scenes.clear();
  }

  private get model():PanningModelType {return this.space==='headphones'?'HRTF':'equalpower';}

  private load(mood:Mood):Promise<void> {
    if(this.loading?.mood===mood)return this.loading.promise;
    this.loading?.abort.abort();
    const map=SOUND_MAPS[mood]!,abort=new AbortController(),context=this.graph.context,files=filesOf(map);
    let promise:Promise<void>|undefined=undefined;
    promise=(async()=>{
      try {
        let encoded=this.encoded.get(mood);
        if(!encoded) {
          encoded=await Promise.all(files.map(async file=>{
            const response=await fetch(`${base()}${mood}/${file}.mp3`,{signal:abort.signal});
            if(!response.ok)throw new Error(`The scene sounds could not load (${response.status}).`);
            return response.arrayBuffer();
          }));
          this.encoded.set(mood,encoded);
        }
        // decodeAudioData detaches its input, so the kept bytes are copied for each decode.
        const decoded=await Promise.all(encoded.map(bytes=>context.decodeAudioData(bytes.slice(0))));
        if(decoded.reduce((sum,b)=>sum+b.length*b.numberOfChannels*4,0)>DECODED_CAP)throw new Error('The scene sounds are larger than their memory budget.');
        // A late load prepares only the place being listened to, and never starts sound after a pause.
        if(abort.signal.aborted||this.disposed||this.current?.mood!==mood)return;
        this.graph.scenes.set(mood,new Map(files.map((file,i)=>[file,decoded[i]])));
        if(this.running&&!this.place){
          const now=context.currentTime;
          fadeSynthesisedBed(this.graph,now,ARRIVE);this.arrive(now,this.listening(now),ARRIVE);
        }
      }catch(error){
        if(abort.signal.aborted||this.disposed)return;
        this.failed.add(mood);
        throw error;
      }finally{if(this.loading?.promise===promise)this.loading=undefined;}
    })();
    this.loading={mood,promise,abort};
    // Failure is reported through `state`; callers that await see it too.
    promise.catch(()=>undefined);
    return promise;
  }

  /** Build the place's graph and begin its beds and spots from the plan at listening time `seconds`. */
  private arrive(at:number,seconds:number,fade:number) {
    const current=this.current!,map=SOUND_MAPS[current.mood]!,buffers=this.graph.scenes.get(current.mood)!,context=this.graph.context;
    const nodes:AudioNode[]=[],output=context.createGain();nodes.push(output);
    output.gain.setValueAtTime(0,at);output.gain.linearRampToValueAtTime(map.trim,at+fade);output.connect(this.graph.ambience);
    const panner=()=>{
      const node=context.createPanner();
      node.panningModel=this.model;node.distanceModel='inverse';node.refDistance=1;node.maxDistance=10000;node.rolloffFactor=0;
      node.connect(output);nodes.push(node);return node;
    };
    const place:Place={mood:current.mood,seed:current.seed,map,buffers,output,beds:[],pool:[],origin:at-seconds,spotsThrough:seconds,
      spots:current.spots,sources:new Set(),nodes};
    // Verification can render the spots alone.
    for(const bed of current.beds?map.beds:[]) {
      const buffer=buffers.get(bed.file)!,level=context.createGain(),value=mixAt(bed,arcAt(place.mood,bed.arc,seconds));
      level.gain.value=value;nodes.push(level);
      let tail:AudioNode=level,filter:BiquadFilterNode|undefined,node:PannerNode|undefined;
      if(bed.lowpass){filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=mixAt({arrival:bed.lowpass[0],evening:bed.lowpass[1]},arcAt(place.mood,bed.arc,seconds));tail.connect(filter);tail=filter;nodes.push(filter);}
      if(bed.position){node=panner();this.position(node,bed.position,at);tail.connect(node);}else tail.connect(output);
      const voice:BedVoice={bed,buffer,loop:loopOf(buffer,bed),level,filter,panner:node,next:0,value};
      place.beds.push(voice);
      // Join the plan where it is: the segment playing now, unless its swap is about to begin.
      let segment=bedSegmentAt(place.seed,bed.name,seconds);
      const swap=bedSegment(place.seed,bed.name,segment.index+1).start-CROSSFADE/2;
      if(swap-seconds<fade+.1)segment=bedSegment(place.seed,bed.name,segment.index+1);
      this.segment(place,voice,segment,at,fade,seconds-(segment.start-CROSSFADE/2));
      voice.next=segment.index+1;
    }
    for(let i=0;i<SPOT_PANNERS;i++)place.pool.push({node:panner(),until:0});
    this.place=place;
    this.schedule(at,at+.05);
  }

  /** One reading of a bed: fades in over `fade` from `at`, then crossfades into the next segment at its swap. */
  private segment(place:Place,voice:BedVoice,segment:BedSegment,at:number,fade:number,into:number) {
    const context=this.graph.context,[loopStart,loopEnd]=voice.loop,length=loopEnd-loopStart;
    const source=context.createBufferSource(),gain=context.createGain(),level=10**(segment.drift/20);
    source.buffer=voice.buffer;source.loop=true;source.loopStart=loopStart;source.loopEnd=loopEnd;
    const offset=loopStart+(((segment.offset*length+Math.max(0,into))%length)+length)%length;
    const next=bedSegment(place.seed,voice.bed.name,segment.index+1),out=place.origin+next.start-CROSSFADE/2;
    // The curves are the gain's only automation, so no event shares their start (Firefox refuses one that does).
    gain.gain.value=0;gain.gain.setValueCurveAtTime(curve(rise,level),at,fade);
    gain.gain.setValueCurveAtTime(curve(fall,level),Math.max(out,at+fade+.01),CROSSFADE);
    source.connect(gain);gain.connect(voice.level);
    this.own(place,source,[gain]);this.started.segments++;
    source.start(at,offset);source.stop(Math.max(out,at+fade+.01)+CROSSFADE+.05);
  }

  private spot(place:Place,family:Spots,spot:PlannedSpot,now:number) {
    const at=place.origin+spot.time;
    if(at<now+.01)return;
    const rate=2**(spot.detune/1200),duration=family.slot/rate;
    const panner=place.pool.find(entry=>entry.until<=at);
    // A spot that finds every panner busy is skipped.
    if(!panner)return;
    panner.until=at+duration+.02;
    const context=this.graph.context,buffer=place.buffers.get(family.file)!;
    const source=context.createBufferSource(),gain=context.createGain(),nodes:AudioNode[]=[gain];
    source.buffer=buffer;source.playbackRate.value=rate;
    const value=arcAt(place.mood,family.arc,Math.max(0,spot.time));
    gain.gain.value=mixAt(family,value)*spot.gain;
    source.connect(gain);let tail:AudioNode=gain;
    if(family.lowpass){const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=mixAt({arrival:family.lowpass[0],evening:family.lowpass[1]},value);tail.connect(filter);tail=filter;nodes.push(filter);}
    tail.connect(panner.node);
    this.position(panner.node,{azimuth:family.position.azimuth+spot.azimuth,elevation:family.position.elevation+spot.elevation,distance:family.position.distance},at);
    this.own(place,source,nodes);this.started.spots++;
    source.start(at,spot.variant*family.slot,family.slot);source.stop(at+duration+.01);
  }

  private position(node:PannerNode,position:Position,at:number) {
    const {x,y,z}=placeAt(position,this.space);
    if(node.positionX){node.positionX.setValueAtTime(x,at);node.positionY.setValueAtTime(y,at);node.positionZ.setValueAtTime(z,at);}
    else node.setPosition(x,y,z);
  }

  private own(place:Place,source:AudioBufferSourceNode,nodes:AudioNode[]) {
    place.sources.add(source);
    source.onended=()=>{source.disconnect();for(const node of nodes)node.disconnect();place.sources.delete(source);};
  }

  private leave(place:Place,at:number) {
    holdParameter(place.output.gain,at);place.output.gain.linearRampToValueAtTime(0,at+LEAVE);
    this.leaving.add(place);this.release(place,at+LEAVE+.02);
  }

  /** Stop every source at `at` and disconnect the place once they have ended. A place left behind gives back its decoded sounds. */
  private release(place:Place,at:number) {
    if(place.freeAt!==undefined&&place.freeAt<=at)return;
    place.freeAt=at;
    for(const source of place.sources){try{source.stop(at);}catch{/* Already ended. */}}
    const context=this.graph.context,delay=Math.max(0,at-context.currentTime)*1000+80;
    const free=()=>{
      if(place.timer!==undefined)clearTimeout(place.timer);
      for(const node of place.nodes)node.disconnect();
      place.pool.length=0;for(const voice of place.beds)voice.panner=undefined;
      this.leaving.delete(place);
      if(this.current?.mood!==place.mood)this.graph.scenes.delete(place.mood);
    };
    if(place.timer!==undefined)clearTimeout(place.timer);
    // Offline renders have no timers that follow their clock; their graphs are released with them.
    if(context instanceof AudioContext)place.timer=setTimeout(free,delay);else free();
  }
}

/** Seamless loops: the encoder folds each bed's tail into its head. Browsers that keep an MP3's encoder delay
 * decode a little longer than the file's written length; the loop then skips that silent lead-in. */
function loopOf(buffer:AudioBuffer,bed:Bed):[number,number] {
  const extra=buffer.duration-bed.seconds;
  if(extra<.002)return [0,Math.min(buffer.duration,bed.seconds)];
  const data=buffer.getChannelData(0),limit=Math.min(data.length,Math.round(buffer.sampleRate*.08));
  let lead=0;while(lead<limit&&Math.abs(data[lead])<1e-4)lead++;
  const start=Math.min(extra,lead/buffer.sampleRate);
  return [start,start+bed.seconds];
}

export {BED_SWAP};
