import { composeTrack, type Mood, type MusicMode, type Track } from './composer';
import {createSession,composeSessionTrack,sessionAt,type SessionPlan} from '../session/session';
import {EnvironmentClock} from '../session/environment';
import { DEFAULT_MIX, createGraph, disposeGraph, holdParameter, loadPiano, scheduleNote, setSoundMode, startAmbience, stopVoices, type SoundGraph } from './sound';
export { composeTrack } from './composer';
export { DEFAULT_MIX } from './sound';
export type { Mood, MusicMode, Track } from './composer';

// Plan identity distinguishes visits to the same deterministic edition without retaining a history.
interface PlaybackTrack extends Track {sessionPlan:SessionPlan}
interface Segment {track:PlaybackTrack;start:number;cursor:number}
const clamp=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;

/** One look-ahead clock for music. It deliberately has no connection to the animation clock. */
export class RadioAudio {
  private context?:AudioContext;
  private graph?:SoundGraph;
  private pending?:Promise<void>;
  private abort?:AbortController;
  private timer?:ReturnType<typeof setInterval>;
  private suspendTimer?:ReturnType<typeof setTimeout>;
  private disposed=false;
  private wanted=false;
  private running=false;
  private volume:number=DEFAULT_MIX.music;
  private ambienceVolume:number=DEFAULT_MIX.ambience;
  private mode:MusicMode='beats';
  private index=0;
  private track:PlaybackTrack;
  private plan:SessionPlan;
  private weatherLevel=1;
  private beat=0;
  private segments:Segment[]=[];
  private ticks=0;
  private compositions=0;
  private environmentClock=new EnvironmentClock();

  constructor(private seed:number,private mood:Mood) {this.plan=createSession(seed,mood);this.track=this.makeTrack();}

  get playing() {return this.running;}
  get environment() {return sessionAt(this.plan,this.environmentClock.seconds(this.context?.currentTime??0));}
  get session() {
    const {track,beat}=this.position();
    return sessionAt(this.plan,track.sessionPlan===this.plan&&track.session?track.session.offset+beat*60/track.bpm:0);
  }
  get current() {
    const {track,beat}=this.position();
    return {title:track.title,bpm:Math.round(track.bpm),voice:track.voice,progress:Math.min(1,beat/(track.bars*4)),section:track.sections.find(s=>beat/4>=s.startBar&&beat/4<s.endBar)?.name??'Opening'};
  }
  get diagnostics() {
    return {playing:this.running,contextState:this.context?.state??'uninitialized',voices:this.graph?.voices.size??0,scheduledSegments:this.segments.length,ticks:this.ticks,compositions:this.compositions,scheduledThrough:this.segments[this.segments.length-1]?.start??0,currentTime:this.context?.currentTime??0};
  }

  async enable():Promise<void> {
    if(this.disposed)throw new Error('This radio has been closed.');
    this.wanted=true;
    if(this.suspendTimer!==undefined){clearTimeout(this.suspendTimer);this.suspendTimer=undefined;}
    if(this.running)return;
    if(!this.context) {
      const Audio=globalThis.AudioContext ?? (globalThis as typeof globalThis & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
      if(!Audio)throw new Error('Your browser does not support audio playback.');
      this.context=new Audio({latencyHint:'playback'});
    }
    // Resume is invoked within the click handler, before fetching any samples.
    const context=this.context;
    const resume=context.resume();
    if(this.pending){await resume;return this.pending;}
    this.pending=(async()=>{
      try {
        await resume;
        if(!this.graph) {
          this.abort=new AbortController();
          const bank=await loadPiano(context,this.abort.signal);
          if(this.disposed)return;
          this.graph=createGraph(context,bank,this.seed);
        }
        if(!this.wanted||this.disposed){if(context.state!=='closed')await context.suspend();return;}
        if(context.state!=='running')await context.resume();
        if(context.state!=='running')throw new Error('Playback is blocked by the browser. Press play to try again.');
        const graph=this.graph;
        graph.music.gain.value=this.volume;graph.ambience.gain.value=this.ambienceVolume*this.weatherLevel;
        setSoundMode(graph,this.mode);
        const now=context.currentTime;
        stopVoices(graph,now,0.025);
        this.segments=[this.segment(this.track,now+0.09-this.beat*60/this.track.bpm,this.beat)];
        this.running=true;this.environmentClock.start(now);
        startAmbience(graph,this.mood,now+0.02);
        holdParameter(graph.output.gain,now);graph.output.gain.linearRampToValueAtTime(1,now+0.35);
        this.tick();
        this.timer=setInterval(()=>this.tick(),250);
      }catch(error){
        this.environmentClock.pause(context.currentTime);
        this.running=false;this.wanted=false;this.abort?.abort();
        if(this.graph){disposeGraph(this.graph);this.graph=undefined;}
        if(context.state!=='closed')await context.close().catch(()=>undefined);
        if(this.context===context)this.context=undefined;
        throw error;
      }finally{this.pending=undefined;this.abort=undefined;}
    })();
    return this.pending;
  }

  pause():void {
    this.wanted=false;
    if(!this.running)return;
    const position=this.position();this.track=position.track;this.beat=position.beat;
    this.environmentClock.pause(this.context?.currentTime??0);
    // Pausing discards look-ahead segments; recreate the immediate successor on resume.
    this.index=this.track.sessionPlan===this.plan?this.track.index+1:0;
    this.running=false;
    if(this.timer!==undefined){clearInterval(this.timer);this.timer=undefined;}
    const context=this.context,graph=this.graph;
    if(!context||!graph)return;
    holdParameter(graph.output.gain,context.currentTime);
    graph.output.gain.linearRampToValueAtTime(0,context.currentTime+0.13);
    stopVoices(graph,context.currentTime,0.13);
    this.suspendTimer=setTimeout(()=>{
      this.suspendTimer=undefined;
      if(!this.wanted&&!this.disposed&&context.state!=='closed')void context.suspend();
    },160);
  }

  setVolume(value:number):void {this.volume=clamp(value);if(this.graph)this.graph.music.gain.setTargetAtTime(this.volume,this.graph.context.currentTime,0.07);}
  setAmbience(value:number):void {this.ambienceVolume=clamp(value);if(this.graph)this.graph.ambience.gain.setTargetAtTime(this.ambienceVolume*this.weatherLevel,this.graph.context.currentTime,0.1);}
  setMode(mode:MusicMode):void {this.mode=mode;if(this.graph)setSoundMode(this.graph,mode);}

  /** Visiting a place changes its atmosphere now; a new edition joins after the current song. */
  setEdition(seed:number,mood:Mood):void {
    if(seed===this.seed&&mood===this.mood)return;
    this.seed=seed;this.mood=mood;this.index=0;this.plan=createSession(seed,mood);
    this.environmentClock.reset(this.context?.currentTime??0);
    if(this.running&&this.context&&this.graph) {
      const active=this.activeSegment();
      if(active){
        const ending=active.start+active.track.bars*4*60/active.track.bpm;
        stopVoices(this.graph,this.context.currentTime,0.1,ending);
        this.segments=[active];
      }
      startAmbience(this.graph,mood);
    }else{this.track=this.makeTrack();this.beat=0;}
  }

  next():void {
    if(this.disposed)return;
    const active=this.position().track;
    // Look-ahead may already have prepared a successor; skip exactly one audible song.
    this.index=active.sessionPlan===this.plan?active.index+1:0;
    this.track=this.makeTrack();this.beat=0;
    if(this.running&&this.context&&this.graph) {
      const now=this.context.currentTime;
      stopVoices(this.graph,now,0.18);
      this.segments=[this.segment(this.track,now+0.2,0)];
      this.tick();
    }
  }

  dispose():void {
    if(this.disposed)return;
    this.pause();this.disposed=true;this.abort?.abort();
    if(this.suspendTimer!==undefined)clearTimeout(this.suspendTimer);
    const graph=this.graph,context=this.context;
    this.graph=undefined;this.context=undefined;this.segments=[];
    // Let the short exit ramp finish before releasing the audio device.
    if(context)setTimeout(()=>{if(graph)disposeGraph(graph);if(context.state!=='closed')void context.close();},160);
  }

  private makeTrack():PlaybackTrack {this.compositions++;return {...composeSessionTrack(this.plan,this.index++),sessionPlan:this.plan};}
  private segment(track:PlaybackTrack,start:number,beat:number):Segment {
    const first=track.events.findIndex(event=>event.beat>=beat-0.001);
    return {track,start,cursor:first<0?track.events.length:first};
  }
  private activeSegment():Segment|undefined {
    const now=this.context?.currentTime??0;
    return [...this.segments].reverse().find(segment=>segment.start<=now)??this.segments[0];
  }
  private position():{track:PlaybackTrack;beat:number} {
    const segment=this.running?this.activeSegment():undefined;
    return segment&&this.context?{track:segment.track,beat:Math.max(0,Math.min(segment.track.bars*4,(this.context.currentTime-segment.start)*segment.track.bpm/60))}:{track:this.track,beat:this.beat};
  }
  private tick():void {
    const context=this.context,graph=this.graph;
    if(!this.running||!context||!graph)return;
    this.ticks++;
    const now=context.currentTime;
    const weatherLevel=Math.max(.75,Math.min(1.12,this.environment.weather));
    if(Math.abs(weatherLevel-this.weatherLevel)>.005){this.weatherLevel=weatherLevel;graph.ambience.gain.setTargetAtTime(this.ambienceVolume*weatherLevel,now,3);}
    // Audio remains scheduled through normal background timer throttling. There is exactly one timer.
    const horizon=now+6;
    while(this.segments.length>1&&this.segments[1].start<=now)this.segments.shift();
    let segment=this.segments[this.segments.length-1];
    if(!segment)return;
    const end=segment.start+segment.track.bars*4*60/segment.track.bpm;
    if(end<horizon) {
      const next=this.makeTrack();
      segment=this.segment(next,Math.max(end,now+0.05),0);this.segments.push(segment);
    }
    for(const part of this.segments) {
      const secondsPerBeat=60/part.track.bpm;
      while(part.cursor<part.track.events.length) {
        const event=part.track.events[part.cursor],at=part.start+event.beat*secondsPerBeat;
        if(at>horizon)break;
        part.cursor++;
        // Recover from a browser/OS interruption without dumping missed notes into one instant.
        if(at<now-0.03)continue;
        scheduleNote(graph,event,Math.max(now+0.005,at),secondsPerBeat);
      }
    }
  }
}

export async function renderPreview(options:{seed?:number;mood?:Mood;index?:number;seconds?:number;mode?:MusicMode;ambience?:number;sampleRate?:number;standalone?:boolean}={}) {
  const seconds=Math.max(1,Math.min(300,options.seconds??90)),sampleRate=options.sampleRate??44100;
  const plan=createSession(options.seed??20260917,options.mood??'rain');
  const score=(index:number)=>options.standalone?composeTrack(plan.seed,plan.mood,index):composeSessionTrack(plan,index);
  const track=score(options.index??0);
  const context=new OfflineAudioContext(2,Math.ceil(seconds*sampleRate),sampleRate);
  const graph=createGraph(context,await loadPiano(context),plan.seed);
  graph.output.gain.setValueAtTime(0,0);graph.output.gain.linearRampToValueAtTime(1,0.3);
  graph.output.gain.setValueAtTime(1,seconds-0.3);graph.output.gain.linearRampToValueAtTime(0,seconds);
  graph.ambience.gain.value=options.ambience??DEFAULT_MIX.ambience;setSoundMode(graph,options.mode??'beats');
  if(track.session)for(let time=0;time<seconds;time+=.25){
    const weather=Math.max(.75,Math.min(1.12,sessionAt(plan,track.session.offset+time).weather));
    graph.ambience.gain.setTargetAtTime((options.ambience??DEFAULT_MIX.ambience)*weather,time,3);
  }
  startAmbience(graph,options.mood??'rain',0);
  let song=track,start=0.05,index=options.index??0;
  while(start<seconds) {
    for(const event of song.events) {
      const at=start+event.beat*60/song.bpm;if(at>=seconds)break;
      scheduleNote(graph,event,at,60/song.bpm);
    }
    start+=song.bars*4*60/song.bpm;
    song=score(++index);
  }
  const buffer=await context.startRendering();disposeGraph(graph);
  return {buffer,track};
}
