import { composeTrack, type Mood, type MusicMode, type MusicStyle, type ScoreEvent, type Track } from './composer';
import {createSession,composeSessionTrack,sessionAt,type SessionPlan,type MusicSessionPlan} from '../session/session';
import {EnvironmentClock} from '../session/environment';
import type {Season} from '../scenes/edition';
import { DEFAULT_MIX, createGraph, disposeGraph, holdParameter, loadPiano, scheduleNote, setSoundMode, startAmbience, stopVoices, type SoundGraph, type PianoBank } from './sound';
import {SceneSounds,type ListeningSpace,type SceneSoundState} from './ambience';
export { composeTrack } from './composer';
export { DEFAULT_MIX } from './sound';
export type { Mood, MusicMode, Track } from './composer';
export type {ListeningSpace,SceneSoundState} from './ambience';

// Plan identity distinguishes visits to the same deterministic edition without retaining a history.
interface PlaybackTrack extends Track {sessionPlan:MusicSessionPlan}
interface Segment {track:PlaybackTrack;start:number;cursor:number}
const clamp=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
const hidden=()=>typeof document!=='undefined'&&document.hidden;

/** One look-ahead clock for music. It deliberately has no connection to the animation clock. */
export class RadioAudio {
  private context?:AudioContext;
  private graph?:SoundGraph;
  private sounds?:SceneSounds;
  private space:ListeningSpace='speakers';
  private pending?:Promise<void>;
  private abort?:AbortController;
  private timer?:ReturnType<typeof setInterval>;
  private suspendTimer?:ReturnType<typeof setTimeout>;
  private disposed=false;
  /** Hiding a tab extends the look-ahead at once, before its timer can be throttled. */
  private readonly onVisibility=()=>this.tick();
  private wanted=false;
  private running=false;
  private volume:number=DEFAULT_MIX.music;
  private ambienceVolume:number=DEFAULT_MIX.ambience;
  private mode:MusicMode='beats';
  private style:MusicStyle='lofi';
  private styleRevision=0;
  private pianoPending?:Promise<PianoBank>;
  private index=0;
  private track:PlaybackTrack;
  private plan:MusicSessionPlan;
  private environmentPlan:SessionPlan;
  private weatherLevel=1;
  private beat=0;
  private segments:Segment[]=[];
  private ticks=0;
  private compositions=0;
  private environmentClock=new EnvironmentClock();
  /** Every second of playback on this page, never reset by visiting another place. */
  private listeningClock=new EnvironmentClock();

  constructor(private seed:number,private mood:Mood,private season?:Season) {this.environmentPlan=createSession(seed,mood,'lofi',season);this.plan=this.environmentPlan;this.track=this.makeTrack();}

  get playing() {return this.running;}
  get listenedSeconds() {return this.listeningClock.seconds(this.context?.currentTime??0);}
  get environment() {return sessionAt(this.environmentPlan,this.environmentClock.seconds(this.context?.currentTime??0));}
  get session() {
    const {track,beat}=this.position();
    return sessionAt(this.plan,track.sessionPlan===this.plan&&track.session?track.session.offset+beat*60/track.bpm:0);
  }
  get current() {
    const {track,beat}=this.position();
    return {title:track.title,bpm:Math.round(track.bpm),voice:track.voice,style:this.style,family:track.family,progress:Math.min(1,beat/(track.bars*4)),section:track.sections.find(s=>beat/4>=s.startBar&&beat/4<s.endBar)?.name??'Opening'};
  }
  get diagnostics() {
    const currentTime=this.context?.currentTime??0,starts=[...this.graph?.voices??[]].map(voice=>voice.start);
    return {playing:this.running,contextState:this.context?.state??'uninitialized',voices:this.graph?.voices.size??0,scheduledSegments:this.segments.length,ticks:this.ticks,compositions:this.compositions,scheduledThrough:this.segments[this.segments.length-1]?.start??0,scheduledAhead:Math.max(0,...starts)-currentTime,currentTime,
      sceneSounds:this.sounds?.diagnostics??{state:'synthesised' as SceneSoundState,places:0,sources:0,panners:0,started:{segments:0,spots:0},decodedBytes:0,decoded:[] as string[]},synthesisedBeds:this.graph?.ambienceSources.length??0};
  }
  /** Whether this place's recorded scene sounds are playing, still loading, or failed (its synthesised bed plays meanwhile). */
  get sceneSounds():SceneSoundState {return this.sounds?.state??'synthesised';}
  /** Retry recordings that failed; a paused radio loads them without starting sound. */
  retrySceneSounds():Promise<void> {return this.sounds?.retry()??Promise.resolve();}
  setSpace(space:ListeningSpace):void {this.space=space;this.sounds?.setSpace(space);}

  async enable():Promise<void> {
    if(this.disposed)throw new Error('This radio has been closed.');
    this.wanted=true;
    if(this.suspendTimer!==undefined){clearTimeout(this.suspendTimer);this.suspendTimer=undefined;}
    if(this.running)return;
    // iOS treats Web Audio as ambient by default, which Silent Mode can mute.
    // Claim music playback within the Listen gesture, before creating/resuming audio.
    try {
      const session=(navigator as Navigator & {audioSession?:{type:string}}).audioSession;
      if(session&&session.type!=='playback')session.type='playback';
    }catch{/* Browsers without a usable Audio Session API keep their normal route. */}
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
        if(this.disposed||this.context!==context)return;
        if(!this.graph) {
          this.graph=createGraph(context,new Map(),this.seed);
          this.sounds=new SceneSounds(this.graph,this.space,at=>this.environmentClock.seconds(at));
        }
        if(this.style==='lofi')try{await this.ensurePiano();}catch(error){if(this.style==='lofi')throw error;}
        if(!this.wanted||this.disposed){if(context.state!=='closed')await context.suspend();return;}
        if(context.state!=='running')await context.resume();
        if(context.state!=='running')throw new Error('Playback is blocked by the browser. Press play to try again.');
        const graph=this.graph;
        graph.music.gain.cancelScheduledValues(context.currentTime);
        graph.music.gain.setValueAtTime(this.volume,context.currentTime);
        graph.ambience.gain.value=this.ambienceVolume*this.weatherLevel;
        setSoundMode(graph,this.mode);
        const now=context.currentTime;
        stopVoices(graph,now,0.025);
        this.segments=[this.segment(this.track,now+0.09-this.beat*60/this.track.bpm,this.beat)];
        this.running=true;this.environmentClock.start(now);this.listeningClock.start(now);
        this.sounds!.start(this.mood,this.seed,now+0.02,this.environmentClock.seconds(now+0.02),{season:this.season});
        holdParameter(graph.output.gain,now);graph.output.gain.linearRampToValueAtTime(1,now+0.35);
        this.tick();
        this.timer=setInterval(()=>this.tick(),250);
        globalThis.document?.addEventListener('visibilitychange',this.onVisibility);
      }catch(error){
        this.environmentClock.pause(context.currentTime);this.listeningClock.pause(context.currentTime);
        this.running=false;this.wanted=false;this.abort?.abort();
        this.sounds?.dispose();this.sounds=undefined;
        if(this.graph){disposeGraph(this.graph);this.graph=undefined;}
        if(context.state!=='closed')await context.close().catch(()=>undefined);
        if(this.context===context)this.context=undefined;
        throw error;
      }finally{this.pending=undefined;}
    })();
    return this.pending;
  }

  pause():void {
    this.wanted=false;
    if(!this.running)return;
    const position=this.position();this.track=position.track;this.beat=position.beat;
    this.environmentClock.pause(this.context?.currentTime??0);this.listeningClock.pause(this.context?.currentTime??0);
    // Pausing discards look-ahead segments; recreate the immediate successor on resume.
    this.index=this.track.sessionPlan===this.plan?this.track.index+1:0;
    this.running=false;
    if(this.timer!==undefined){clearInterval(this.timer);this.timer=undefined;}
    globalThis.document?.removeEventListener('visibilitychange',this.onVisibility);
    const context=this.context,graph=this.graph;
    if(!context||!graph)return;
    holdParameter(graph.output.gain,context.currentTime);
    graph.output.gain.linearRampToValueAtTime(0,context.currentTime+0.13);
    stopVoices(graph,context.currentTime,0.13);
    this.sounds?.pause(context.currentTime);
    this.suspendTimer=setTimeout(()=>{
      this.suspendTimer=undefined;
      if(!this.wanted&&!this.disposed&&context.state!=='closed')void context.suspend();
    },160);
  }

  setVolume(value:number):void {this.volume=clamp(value);if(this.graph){holdParameter(this.graph.music.gain,this.graph.context.currentTime);this.graph.music.gain.setTargetAtTime(this.volume,this.graph.context.currentTime,0.07);}}
  setAmbience(value:number):void {this.ambienceVolume=clamp(value);if(this.graph)this.graph.ambience.gain.setTargetAtTime(this.ambienceVolume*this.weatherLevel,this.graph.context.currentTime,0.1);}
  setMode(mode:MusicMode):void {this.mode=mode;if(this.graph)setSoundMode(this.graph,mode);}

  private ensurePiano():Promise<PianoBank> {
    if(!this.context||!this.graph)return Promise.reject(new Error('The audio device is not ready.'));
    if(this.graph.bank.size)return Promise.resolve(this.graph.bank);
    if(this.pianoPending)return this.pianoPending;
    const graph=this.graph;
    this.abort=new AbortController();
    const pending=loadPiano(this.context,this.abort.signal).then(bank=>{if(!this.disposed&&this.graph===graph)graph.bank=bank;return bank;});
    this.pianoPending=pending;
    void pending.finally(()=>{if(this.pianoPending===pending){this.pianoPending=undefined;this.abort=undefined;}}).catch(()=>undefined);
    return pending;
  }

  /** Switch music without resetting the scenery or implicitly starting playback. */
  async setStyle(style:MusicStyle):Promise<void> {
    if(this.disposed)return;
    const revision=++this.styleRevision;
    if(style===this.style)return;
    if(style==='lofi'&&this.graph) {
      try{await this.ensurePiano();}catch(error){if(revision===this.styleRevision&&!this.disposed)throw error;return;}
      if(revision!==this.styleRevision||this.disposed)return;
    }
    this.style=style;this.index=0;this.plan=createSession(this.seed,this.mood,style,this.season);this.track=this.makeTrack();this.beat=0;
    // Synthwave has no sample dependency. Wake activation instead of awaiting an obsolete fetch.
    if(style==='synthwave'&&this.pending&&this.pianoPending) {
      const obsolete=this.abort;this.pianoPending=undefined;this.abort=undefined;obsolete?.abort();
    }
    if(this.running&&this.context&&this.graph) {
      const now=this.context.currentTime,graph=this.graph;
      stopVoices(graph,now,.6);
      holdParameter(graph.music.gain,now);graph.music.gain.linearRampToValueAtTime(0,now+.6);graph.music.gain.linearRampToValueAtTime(this.volume,now+1.2);
      this.segments=[this.segment(this.track,now+.62,0)];this.tick();
    }
  }

  /** Visiting a place changes its atmosphere now; a new edition joins after the current song. */
  setEdition(seed:number,mood:Mood,season?:Season):void {
    if(seed===this.seed&&mood===this.mood&&season===this.season)return;
    this.seed=seed;this.mood=mood;this.season=season;this.index=0;this.plan=createSession(seed,mood,this.style,season);this.environmentPlan=createSession(seed,mood,'lofi',season);
    this.environmentClock.reset(this.context?.currentTime??0);
    if(this.running&&this.context&&this.graph) {
      const active=this.activeSegment();
      if(active){
        const ending=active.start+active.track.bars*4*60/active.track.bpm;
        stopVoices(this.graph,this.context.currentTime,0.1,ending);
        this.segments=[active];
      }
      this.sounds?.change(mood,seed,this.context.currentTime,season);
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
    const graph=this.graph,context=this.context,sounds=this.sounds;
    this.graph=undefined;this.context=undefined;this.sounds=undefined;this.segments=[];
    // Let the short exit ramp finish before releasing the audio device.
    if(context)setTimeout(()=>{sounds?.dispose();if(graph)disposeGraph(graph);if(context.state!=='closed')void context.close();},160);
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
    // Audio remains scheduled through normal background timer throttling: a hidden tab keeps six seconds
    // ahead. A visible tab's timer is reliable and each scheduled voice costs CPU until it ends, so it keeps
    // two and a half. There is exactly one timer.
    const horizon=now+(hidden()?6:2.5);
    this.sounds?.schedule(now,horizon);
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

/** The events a song plays when it starts at beat `from`. Humanisation can perform a downbeat up to a few thousandths
 *  of a beat early, so a start partway in keeps events within 0.05 beats before it (far short of any written pickup). */
export const eventsFrom=(events:readonly ScoreEvent[],from:number)=>{const early=from>0?.05:0;return events.filter(event=>event.beat>=from-early);};

/** Render a song offline with its place's scene sounds. Clips keep to the beds, through speakers; listening previews
 * can add the spots and choose headphones. `music: false` renders the scene sounds alone. */
export async function renderPreview(options:{seed?:number;mood?:Mood;index?:number;seconds?:number;mode?:MusicMode;style?:MusicStyle;season?:Season;ambience?:number;sampleRate?:number;standalone?:boolean;fromBeat?:number;fadeIn?:number;fadeOut?:number;spots?:boolean;space?:ListeningSpace;music?:boolean}={}) {
  const seconds=Math.max(1,Math.min(300,options.seconds??90)),sampleRate=options.sampleRate??44100;
  const plan=createSession(options.seed??20260917,options.mood??'rain',options.style??'lofi',options.season);
  const score=(index:number)=>options.standalone&&plan.style==='lofi'?composeTrack(plan.seed,plan.mood,index):composeSessionTrack(plan,index);
  const track=score(options.index??0);
  const context=new OfflineAudioContext(2,Math.ceil(seconds*sampleRate),sampleRate);
  const graph=createGraph(context,plan.style==='lofi'?await loadPiano(context):new Map(),plan.seed);
  const fadeIn=Math.max(.05,options.fadeIn??.3),fadeOut=Math.max(.05,options.fadeOut??.3);
  graph.output.gain.setValueAtTime(0,0);graph.output.gain.linearRampToValueAtTime(1,fadeIn);
  graph.output.gain.setValueAtTime(1,seconds-fadeOut);graph.output.gain.linearRampToValueAtTime(0,seconds);
  graph.ambience.gain.value=options.ambience??DEFAULT_MIX.ambience;setSoundMode(graph,options.mode??'beats');
  if(track.session)for(let time=0;time<seconds;time+=.25){
    const weather=Math.max(.75,Math.min(1.12,sessionAt(plan,track.session.offset+time).weather));
    graph.ambience.gain.setTargetAtTime((options.ambience??DEFAULT_MIX.ambience)*weather,time,3);
  }
  const mood=options.mood??'rain',sounds=new SceneSounds(graph,options.space??'speakers');
  const recorded=await sounds.prepare(mood,plan.seed).catch(()=>false);
  // A recording that can't load leaves the synthesised bed, as it does live.
  if(recorded){sounds.start(mood,plan.seed,0,0,{spots:options.spots??false,season:options.season});sounds.schedule(0,seconds);}
  else startAmbience(graph,mood,0);
  if(options.music===false)graph.music.gain.value=0;
  // `fromBeat` starts the first song partway in, as a clip starts at its theme.
  let song=track,start=0.05,index=options.index??0,from=Math.max(0,options.fromBeat??0);
  while(start<seconds) {
    for(const event of eventsFrom(song.events,from)) {
      const at=Math.max(0,start+(event.beat-from)*60/song.bpm);if(at>=seconds)break;
      scheduleNote(graph,event,at,60/song.bpm);
    }
    start+=(song.bars*4-from)*60/song.bpm;from=0;
    song=score(++index);
  }
  const buffer=await context.startRendering();sounds.dispose();disposeGraph(graph);
  return {buffer,track,recorded};
}
