import type {Mood} from './composer';
import {SOUND_MAPS,pathAt,type Arc,type Bed,type Mover,type Position,type SoundMap} from './ambience-maps';
import {fadeSynthesisedBed,holdParameter,startAmbience,type SoundGraph} from './sound';
import {BED_SWAP,bedSegment,bedSegmentAt,createSession,eventSpotsBetween,eventStrength,spotsBetween,type BedSegment,type SessionEvent} from '../session/session';
import {sceneLightAt} from '../scenes/scene-light';
import type {Season} from '../scenes/edition';

export type ListeningSpace='speakers'|'headphones';
export type SceneSoundState='synthesised'|'loading'|'recorded'|'failed';
/** Decoded scene sounds may hold at most this for the active place (plus the outgoing one during a handover),
 * counted at 48 kHz: a device running faster holds proportionally more of the same sounds. */
export const DECODED_CAP=32*1024*1024;
export const decodedSize=(buffers:Iterable<AudioBuffer>)=>[...buffers].reduce((sum,b)=>sum+Math.round(b.duration*48000)*b.numberOfChannels*4,0);
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
/** Each recording once, though several families may play it (the coast's gulls call alone and with the birds). */
const filesOf=(map:SoundMap)=>[...new Set([...map.beds,...map.spots,...map.movers??[],...map.calls??[]].map(sound=>sound.file))];
/** One short sound to play: from slot `offset` of `file`, at a level and place worked out from the plan. */
interface Shot {time:number;file:string;offset:number;slot:number;detune:number;level:number;lowpass?:number;position:Position}

interface BedVoice {bed:Bed;buffer:AudioBuffer;loop:[start:number,end:number];level:GainNode;filter?:BiquadFilterNode;panner?:PannerNode;next:number;value:number}
interface Panner {node:PannerNode;until:number}
interface MoverVoice {mover:Mover;event:SessionEvent;start:number;gain:GainNode;panner:PannerNode}
interface Place {
  mood:Mood;seed:number;map:SoundMap;buffers:Map<string,AudioBuffer>;output:GainNode;beds:BedVoice[];pool:Panner[];
  /** Audio time at which this place's listening began: audio time = origin + listening seconds. */
  origin:number;spotsThrough:number;spots:boolean;sources:Set<AudioScheduledSourceNode>;nodes:AudioNode[];
  /** The edition's planned events, those moving now, and those already begun (an event never starts twice). */
  events:readonly SessionEvent[];movers:Map<number,MoverVoice>;moved:Set<number>;
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
  private current?:{mood:Mood;seed:number;season?:Season;spots:boolean;beds:boolean};
  private running=false;
  private disposed=false;
  /** Bed readings and spots started so far, for verification. */
  private started={segments:0,spots:0,movers:0};

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
      panners:this.panners(),movers:places.reduce((sum,place)=>sum+place.movers.size,0),
      started:{...this.started},decodedBytes:[...this.graph.scenes.values()].reduce((sum,buffers)=>sum+decodedSize(buffers.values()),0),decoded:[...this.graph.scenes.keys()]};
  }

  /** Start listening to a place at audio time `at`, `seconds` into its listening time. Recordings load the first
   * time a place is played; until they arrive (or if they fail) its synthesised bed plays. */
  start(mood:Mood,seed:number,at:number,seconds:number,options:{spots?:boolean;beds?:boolean;season?:Season}={}):void {
    if(this.disposed)return;
    this.current={mood,seed,season:options.season,spots:options.spots??true,beds:options.beds??true};this.running=true;
    // Decoded sounds belong to this place and one still fading out; a place left while paused gives them back here.
    for(const other of [...this.graph.scenes.keys()])if(other!==mood&&![...this.leaving].some(place=>place.mood===other))this.graph.scenes.delete(other);
    if(this.graph.scenes.has(mood)){fadeSynthesisedBed(this.graph,at,RESUME);this.arrive(at,seconds,RESUME);return;}
    startAmbience(this.graph,mood,at);
    if(SOUND_MAPS[mood]&&!this.failed.has(mood))void this.load(mood);
  }

  /** Move to another place now: the old one fades out while its song finishes, the new one starts at once. */
  change(mood:Mood,seed:number,at:number,season?:Season):void {
    if(this.place){this.leave(this.place,at);this.place=undefined;}
    this.start(mood,seed,at,0,{spots:this.current?.spots,beds:this.current?.beds,season});
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
    // Spots and events stay out of clips.
    if(!place.spots)return;
    for(const mover of place.map.movers??[])place.events.forEach((event,index)=>{
      if(event.kind!==mover.kind||place.moved.has(index))return;
      const start=place.origin+event.start,end=start+event.duration;
      if(end>now+.5&&start<=horizon)this.mover(place,mover,event,index,Math.max(start,now+.02));
    });
    if(through<=place.spotsThrough)return;
    const shots:Shot[]=place.map.spots.flatMap(family=>spotsBetween(place.seed,{...family,places:1+(family.elsewhere?.length??0)},place.spotsThrough,through).map(spot=>{
      const value=arcAt(place.mood,family.arc,spot.time),at=[family.position,...family.elsewhere??[]][spot.place];
      return {time:spot.time,file:family.file,offset:spot.variant*family.slot,slot:family.slot,detune:spot.detune,level:mixAt(family,value)*spot.gain,
        lowpass:family.lowpass&&mixAt({arrival:family.lowpass[0],evening:family.lowpass[1]},value),
        position:{azimuth:at.azimuth+spot.azimuth,elevation:at.elevation+spot.elevation,distance:at.distance}};
    }));
    // Calls belong to their event: they sound along its path, as strongly as it shows.
    for(const family of place.map.calls??[])place.events.forEach((event,index)=>{
      if(event.kind!==family.kind)return;
      for(const spot of eventSpotsBetween(place.seed,family,event,index,place.spotsThrough,through)) {
        const {position,level}=pathAt(family.path,spot.progress);
        shots.push({time:spot.time,file:family.file,offset:spot.variant*family.slot,slot:family.slot,detune:spot.detune,lowpass:family.lowpass,
          level:family.level*level*eventStrength(spot.progress)*spot.gain,
          position:{azimuth:position.azimuth+spot.azimuth,elevation:position.elevation+spot.elevation,distance:position.distance}});
      }
    });
    place.spotsThrough=through;
    for(const shot of shots.sort((a,b)=>a.time-b.time))this.spot(place,shot,now);
  }

  /** A panner clicks if its model changes under a sound, so the place is built again in the new space, at the same
   * moment of the same plan, and crossfaded in over RESUME as the old one fades. A place already leaving keeps its space. */
  setSpace(space:ListeningSpace):void {
    if(space===this.space)return;
    this.space=space;
    const place=this.place;
    if(!place||!this.running)return;
    const now=this.graph.context.currentTime;
    this.leave(place,now);this.place=undefined;
    this.arrive(now,now-place.origin,RESUME);
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
    this.current={mood,seed,season:this.current?.season,spots:this.current?.spots??true,beds:this.current?.beds??true};
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
        if(decodedSize(decoded)>DECODED_CAP)throw new Error('The scene sounds are larger than their memory budget.');
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
    // Events come from the same plan the picture draws, Halloween's included.
    const events=map.movers?.length||map.calls?.length?createSession(current.seed,current.mood,'lofi',current.season).events:[];
    const place:Place={mood:current.mood,seed:current.seed,map,buffers,output,beds:[],pool:[],origin:at-seconds,spotsThrough:seconds,
      spots:current.spots,sources:new Set(),nodes,events,movers:new Map(),moved:new Set()};
    // Verification can render the spots alone.
    for(const bed of current.beds?map.beds:[]) {
      const buffer=buffers.get(bed.file)!,level=context.createGain(),value=mixAt(bed,arcAt(place.mood,bed.arc,seconds));
      level.gain.value=value;nodes.push(level);
      let tail:AudioNode=level,filter:BiquadFilterNode|undefined,node:PannerNode|undefined;
      if(bed.lowpass){filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=mixAt({arrival:bed.lowpass[0],evening:bed.lowpass[1]},arcAt(place.mood,bed.arc,seconds));tail.connect(filter);tail=filter;nodes.push(filter);}
      if(bed.position){node=this.panner(place);this.position(node,bed.position,at);tail.connect(node);}else tail.connect(output);
      const voice:BedVoice={bed,buffer,loop:loopOf(buffer,bed),level,filter,panner:node,next:0,value};
      place.beds.push(voice);
      // Join the plan where it is: the segment playing now, unless its swap is about to begin.
      let segment=bedSegmentAt(place.seed,bed.name,seconds);
      const swap=bedSegment(place.seed,bed.name,segment.index+1).start-CROSSFADE/2;
      if(swap-seconds<fade+.1)segment=bedSegment(place.seed,bed.name,segment.index+1);
      this.segment(place,voice,segment,at,fade,seconds-(segment.start-CROSSFADE/2));
      voice.next=segment.index+1;
    }
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

  private spot(place:Place,shot:Shot,now:number) {
    const at=place.origin+shot.time;
    // A spot in the past, or one too quiet to hear (bees after dark), is skipped.
    if(at<now+.01||shot.level<.005)return;
    const rate=2**(shot.detune/1200),duration=shot.slot/rate;
    // Spots share a pool of panners, made as they are first needed and within the budget a fading place still holds.
    let panner=place.pool.find(entry=>entry.until<=at);
    if(!panner&&place.pool.length<SPOT_PANNERS&&this.panners()<PANNER_BUDGET)place.pool.push(panner={node:this.panner(place),until:0});
    // A spot that finds every panner busy is skipped.
    if(!panner)return;
    panner.until=at+duration+.02;
    const context=this.graph.context,buffer=place.buffers.get(shot.file)!;
    const source=context.createBufferSource(),gain=context.createGain(),nodes:AudioNode[]=[gain];
    source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=shot.level;
    source.connect(gain);let tail:AudioNode=gain;
    if(shot.lowpass){const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=shot.lowpass;tail.connect(filter);tail=filter;nodes.push(filter);}
    tail.connect(panner.node);
    this.position(panner.node,shot.position,at);
    this.own(place,source,nodes);this.started.spots++;
    source.start(at,shot.offset,shot.slot);source.stop(at+duration+.01);
  }

  /** A moving event: its recording loops while the event runs, its own panner travelling the picture's path. */
  private mover(place:Place,mover:Mover,event:SessionEvent,index:number,at:number) {
    const context=this.graph.context,buffer=place.buffers.get(mover.file)!,start=place.origin+event.start,end=start+event.duration;
    const source=context.createBufferSource(),gain=context.createGain(),panner=context.createPanner(),nodes:AudioNode[]=[gain,panner];
    const [loopStart,loopEnd]=loopOf(buffer,{seconds:mover.seconds});
    source.buffer=buffer;source.loop=true;source.loopStart=loopStart;source.loopEnd=loopEnd;
    panner.panningModel=this.model;panner.distanceModel='inverse';panner.refDistance=1;panner.maxDistance=10000;panner.rolloffFactor=0;
    source.connect(gain);let tail:AudioNode=gain;
    if(mover.lowpass){const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=mover.lowpass;tail.connect(filter);tail=filter;nodes.push(filter);}
    tail.connect(panner);panner.connect(place.output);
    const voice:MoverVoice={mover,event,start,gain,panner};
    place.movers.set(index,voice);place.moved.add(index);
    this.travel(voice,at,true);
    this.own(place,source,nodes,()=>place.movers.delete(index));this.started.movers++;
    source.start(at,loopStart+((at-start)%(loopEnd-loopStart)));source.stop(end+.05);
  }

  /** Plot a mover's level and position from `from` to the end of its event, half a second at a time. */
  private travel(voice:MoverVoice,from:number,level:boolean) {
    const {mover,event,start,gain,panner}=voice,end=start+event.duration,params=panner.positionX?[panner.positionX,panner.positionY,panner.positionZ]:undefined;
    if(params)for(const param of params){param.cancelScheduledValues(from);}
    const at=(time:number)=>{const progress=(time-start)/event.duration,{position,level:key}=pathAt(mover.path,progress);return {xyz:placeAt(position,this.space),level:mover.level*key*eventStrength(progress)};};
    const first=at(from);
    if(params)params.forEach((param,i)=>param.setValueAtTime(Object.values(first.xyz)[i],from));else panner.setPosition(first.xyz.x,first.xyz.y,first.xyz.z);
    // Joining partway (after a pause) rises from silence rather than starting with a step.
    if(level){gain.gain.value=0;gain.gain.setValueAtTime(0,from);}
    for(let time=from+(level?.4:.5);time<end+.25;time+=.5) {
      const t=Math.min(time,end),point=at(t);
      if(params)params.forEach((param,i)=>param.linearRampToValueAtTime(Object.values(point.xyz)[i],t));
      if(level)gain.gain.linearRampToValueAtTime(point.level,t);
    }
  }

  private position(node:PannerNode,position:Position,at:number) {
    const {x,y,z}=placeAt(position,this.space);
    if(node.positionX){node.positionX.setValueAtTime(x,at);node.positionY.setValueAtTime(y,at);node.positionZ.setValueAtTime(z,at);}
    else node.setPosition(x,y,z);
  }

  private own(place:Place,source:AudioBufferSourceNode,nodes:AudioNode[],ended?:()=>void) {
    place.sources.add(source);
    source.onended=()=>{source.disconnect();for(const node of nodes)node.disconnect();place.sources.delete(source);ended?.();};
  }

  private panner(place:Place):PannerNode {
    const node=this.graph.context.createPanner();
    node.panningModel=this.model;node.distanceModel='inverse';node.refDistance=1;node.maxDistance=10000;node.rolloffFactor=0;
    node.connect(place.output);place.nodes.push(node);return node;
  }

  /** Panners held by the place playing and any still fading out. */
  private panners():number {
    return [...(this.place?[this.place]:[]),...this.leaving].reduce((sum,place)=>sum+place.pool.length+place.beds.filter(bed=>bed.panner).length+place.movers.size,0);
  }

  private leave(place:Place,at:number) {
    // Idle spot panners go at once, so the place arriving has room for its own.
    place.pool=place.pool.filter(entry=>{if(entry.until>at)return true;entry.node.disconnect();return false;});
    holdParameter(place.output.gain,at);place.output.gain.linearRampToValueAtTime(0,at+LEAVE);
    this.leaving.add(place);this.release(place,at+LEAVE+.02);
  }

  /** Stop every source at `at` and disconnect the place once they have ended. A place left behind gives back its decoded sounds. */
  private release(place:Place,at:number) {
    if(place.freeAt!==undefined&&place.freeAt<=at)return;
    place.freeAt=at;
    for(const source of place.sources){try{source.stop(at);}catch{/* Already ended. */}}
    const context=this.graph.context,delay=Math.max(0,at-context.currentTime)*1000+80;
    const free=(disconnect:boolean)=>{
      if(place.timer!==undefined)clearTimeout(place.timer);
      if(disconnect)for(const node of place.nodes)node.disconnect();
      place.pool.length=0;place.movers.clear();for(const voice of place.beds)voice.panner=undefined;
      this.leaving.delete(place);
      if(this.current?.mood!==place.mood)this.graph.scenes.delete(place.mood);
    };
    if(place.timer!==undefined)clearTimeout(place.timer);
    // Offline renders have no timers that follow their clock: the place's sources stop on schedule, its fade plays out,
    // and its graph is released with the render.
    if(context instanceof AudioContext)place.timer=setTimeout(()=>free(true),delay);else free(false);
  }
}

/** Seamless loops: the encoder folds each bed's tail into its head. Browsers that keep an MP3's encoder delay
 * decode a little longer than the file's written length; the loop then skips that silent lead-in. */
function loopOf(buffer:AudioBuffer,bed:{seconds:number}):[number,number] {
  const extra=buffer.duration-bed.seconds;
  if(extra<.002)return [0,Math.min(buffer.duration,bed.seconds)];
  const data=buffer.getChannelData(0),limit=Math.min(data.length,Math.round(buffer.sampleRate*.08));
  let lead=0;while(lead<limit&&Math.abs(data[lead])<1e-4)lead++;
  const start=Math.min(extra,lead/buffer.sampleRate);
  return [start,start+bed.seconds];
}

export {BED_SWAP};
