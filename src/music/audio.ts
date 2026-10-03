import { composeTrack, type Mood, type MusicMode, type Track } from './composer';
import {createSession,composeSessionTrack,sessionAt,type SessionPlan} from '../session/session';
import {EnvironmentClock} from '../session/environment';
import { DEFAULT_MIX, createGraph, disposeGraph, holdParameter, prepareBank, schedule, setSoundMode, startAmbience, stopVoices, type SoundGraph } from './sound';
import { STYLES, playingStyle, styleOf, type SoundBank, type StyleId } from './styles';
import { placeById } from '../places';
export { composeTrack } from './composer';
export { DEFAULT_MIX } from './sound';
export type { Mood, MusicMode, Track } from './composer';

// Plan identity distinguishes visits to the same deterministic edition without retaining a history.
interface PlaybackTrack extends Track {sessionPlan:SessionPlan}
interface Segment {track:PlaybackTrack;start:number;cursor:number}
const clamp=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
const lookahead=(track:PlaybackTrack)=>styleOf(track.style).lookahead;

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
  private chosen?:StyleId;
  /** The style to fall back to: the last planned style whose bank was ready, or the opening style before any has loaded; fallBack only uses it once its bank exists. */
  private ready:StyleId;
  private styleRevision=0;
  private index=0;
  private track:PlaybackTrack;
  private plan:SessionPlan;
  private weatherLevel=1;
  private beat=0;
  private segments:Segment[]=[];
  private ticks=0;
  private compositions=0;
  private lastNote=0;
  private environmentClock=new EnvironmentClock();

  constructor(private seed:number,private mood:Mood) {this.plan=createSession(seed,mood,this.styleFor(mood));this.ready=this.plan.style;this.track=this.makeTrack();}

  private get style():StyleId {return this.plan.style;}

  get playing() {return this.running;}
  get environment() {return sessionAt(this.plan,this.environmentClock.seconds(this.context?.currentTime??0));}
  get session() {
    const {track,beat}=this.position(),elapsed=track.session?track.session.offset+beat*60/track.bpm:0;
    if(track.sessionPlan===this.plan)return sessionAt(this.plan,elapsed);
    // A song finishing after a visit keeps its own chapter; the new hour waits at its start.
    return {...sessionAt(this.plan,0),chapter:sessionAt(track.sessionPlan,elapsed).chapter};
  }
  get current() {
    const {track,beat}=this.position();
    return {title:track.title,bpm:Math.round(track.bpm),voice:track.voice,style:this.style,family:track.family,label:styleOf(track.style).labels.voice(track),progress:Math.min(1,beat/(track.bars*4)),section:track.sections.find(s=>beat/4>=s.startBar&&beat/4<s.endBar)?.name??'Opening'};
  }
  get labels() {return styleOf(this.style).labels;}
  get diagnostics() {
    const now=this.context?.currentTime??0,synth=this.graph?.banks.get('driving');
    return {playing:this.running,contextState:this.context?.state??'uninitialized',voices:this.graph?.voices.size??0,scheduledSegments:this.segments.length,ticks:this.ticks,compositions:this.compositions,scheduledThrough:this.segments[this.segments.length-1]?.start??0,
      scheduledAhead:this.running?Math.max(0,this.lastNote-now):0,currentTime:now,pump:synth?.pump?.gain.value??1,echo:synth?.echo?.gain.value??1};
  }

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
        this.graph??=createGraph(context,this.seed);
        // Listen needs only the playing style's bank; a newer pick made while it loads wins.
        for(;;){const style=this.style;try{await this.ensureBank(style);break;}catch(error){if(style===this.style||this.disposed)throw error;}}
        if(!this.wanted||this.disposed){if(context.state!=='closed')await context.suspend();return;}
        if(context.state!=='running')await context.resume();
        if(context.state!=='running')throw new Error('Playback is blocked by the browser. Press play to try again.');
        const graph=this.graph;
        graph.music.gain.cancelScheduledValues(context.currentTime);
        graph.music.gain.setValueAtTime(this.volume,context.currentTime);
        graph.ambience.gain.value=this.atmosphere;
        setSoundMode(graph,this.mode);
        const now=context.currentTime;
        stopVoices(graph,now,0.025);
        this.segments=[this.segment(this.track,now+0.09-this.beat*60/this.track.bpm,this.beat)];
        this.running=true;this.environmentClock.start(now);
        startAmbience(graph,placeById(this.mood),now+0.02);
        holdParameter(graph.output.gain,now);graph.output.gain.linearRampToValueAtTime(1,now+0.35);
        this.tick();
        this.timer=setInterval(()=>this.tick(),250);
      }catch(error){
        this.environmentClock.pause(context.currentTime);
        this.running=false;this.wanted=false;this.abort?.abort();this.abort=undefined;
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

  setVolume(value:number):void {this.volume=clamp(value);if(this.graph){holdParameter(this.graph.music.gain,this.graph.context.currentTime);this.graph.music.gain.setTargetAtTime(this.volume,this.graph.context.currentTime,0.07);}}
  setAmbience(value:number):void {this.ambienceVolume=clamp(value);this.retrim();}
  setMode(mode:MusicMode):void {this.mode=mode;if(this.graph)setSoundMode(this.graph,mode);}

  private styleFor(mood:Mood):StyleId {return playingStyle(placeById(mood),this.chosen);}
  private get atmosphere() {return this.ambienceVolume*this.weatherLevel*this.plan.atmosphere;}
  /** The atmosphere follows the slider, the weather, the place and the planned style. */
  private retrim(lag=.1):void {if(this.graph)this.graph.ambience.gain.setTargetAtTime(this.atmosphere,this.graph.context.currentTime,lag);}

  /** One style's bank, prepared on demand: synths need no download, and only Warm lofi waits for the piano. */
  private ensureBank(style:StyleId):Promise<SoundBank> {
    const graph=this.graph;if(!graph)return Promise.reject(new Error('The audio device is not ready.'));
    const ready=graph.banks.get(style);if(ready)return Promise.resolve(ready);
    this.abort??=new AbortController();
    // A bank built mid-session starts in the listener's drum setting.
    return prepareBank(graph,STYLES[style],this.abort.signal).then(bank=>{bank.setMode(this.mode);if(style===this.style)this.ready=style;return bank;});
  }

  /** A listener's pick, or none for each place's own: switch music without resetting the scenery or starting playback. The latest pick wins. */
  async setStyle(style?:StyleId):Promise<void> {
    if(this.disposed)return;
    const revision=++this.styleRevision,previous=this.chosen;
    this.chosen=style;
    const next=this.styleFor(this.mood);
    if(next===this.style)return;
    if(this.graph){
      // A visit while the bank loads has already planned its place for this choice.
      const moved=()=>revision!==this.styleRevision||this.disposed||this.styleFor(this.mood)!==next;
      try{await this.ensureBank(next);}
      catch(error){
        if(moved())return;
        this.chosen=previous;this.fallBack();throw error;
      }
      if(moved())return;
    }
    this.switchTo(next);
  }

  /** The one plan change. The atmosphere follows the plan, and a player not mid-song waits at its first track. */
  private replan(style:StyleId,restart=!this.running):void {
    this.index=0;this.plan=createSession(this.seed,this.mood,style);this.retrim();if(this.graph?.banks.has(style))this.ready=style;
    if(restart){this.track=this.makeTrack();this.beat=0;}
  }

  /** A failed bank settles the music on a ready style: this place's own if it has loaded, else the last style that was ready. */
  private fallBack():void {const own=this.styleFor(this.mood),to=this.graph?.banks.has(own)?own:this.ready;if(to!==this.style&&this.graph?.banks.has(to))this.replan(to);}

  private switchTo(style:StyleId):void {
    // A committed switch abandons any bank still loading: a waiting Listen wakes rather than finish an obsolete download.
    if(this.graph?.loading.size){this.abort?.abort();this.abort=undefined;}
    this.replan(style,true);
    if(this.running&&this.context&&this.graph) {
      const now=this.context.currentTime,graph=this.graph;
      stopVoices(graph,now,.6);
      holdParameter(graph.music.gain,now);graph.music.gain.linearRampToValueAtTime(0,now+.6);graph.music.gain.linearRampToValueAtTime(this.volume,now+1.2);
      this.segments=[this.segment(this.track,now+.62,0)];this.tick();
    }
  }

  /** Visiting a place changes its atmosphere now; a new edition joins after the current song. */
  setEdition(seed:number,mood:Mood):Promise<void> {
    if(seed===this.seed&&mood===this.mood)return Promise.resolve();
    this.seed=seed;this.mood=mood;this.environmentClock.reset(this.context?.currentTime??0);this.replan(this.styleFor(mood));
    if(this.running&&this.context&&this.graph) {
      const active=this.activeSegment();
      if(active){
        const ending=active.start+active.track.bars*4*60/active.track.bpm;
        stopVoices(this.graph,this.context.currentTime,0.1,ending);
        this.segments=[active];this.lastNote=Math.min(this.lastNote,ending);
      }
      startAmbience(this.graph,placeById(mood));
    }
    if(!this.graph)return Promise.resolve();
    const plan=this.plan;
    return this.ensureBank(this.style).then(()=>undefined,error=>{
      if(this.plan!==plan||this.disposed)return;
      this.fallBack();throw error;
    });
  }

  next():void {
    if(this.disposed)return;
    // A place whose bank is still loading keeps its current song; Next would only schedule silence.
    if(this.graph&&!this.graph.banks.has(this.plan.style))return;
    const active=this.position().track;
    // Look-ahead may already have prepared a successor; skip exactly one audible song.
    this.index=active.sessionPlan===this.plan?active.index+1:0;
    this.track=this.makeTrack();this.beat=0;
    if(this.running&&this.context&&this.graph) {
      const now=this.context.currentTime;
      stopVoices(this.graph,now,0.18);
      this.segments=[this.segment(this.track,now+0.2,0)];this.lastNote=0;
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
    if(Math.abs(weatherLevel-this.weatherLevel)>.005){this.weatherLevel=weatherLevel;this.retrim(3);}
    // Audio remains scheduled through normal background timer throttling. There is exactly one timer; each segment looks ahead by its own style's horizon.
    while(this.segments.length>1&&this.segments[1].start<=now)this.segments.shift();
    let segment=this.segments[this.segments.length-1];
    if(!segment)return;
    const end=segment.start+segment.track.bars*4*60/segment.track.bpm;
    if(end<now+lookahead(segment.track)&&graph.banks.has(this.plan.style)) {
      const next=this.makeTrack();
      segment=this.segment(next,Math.max(end,now+0.05),0);this.segments.push(segment);
    }
    for(const part of this.segments) {
      const secondsPerBeat=60/part.track.bpm,horizon=now+lookahead(part.track);
      while(part.cursor<part.track.events.length) {
        const event=part.track.events[part.cursor],at=part.start+event.beat*secondsPerBeat;
        if(at>horizon)break;
        part.cursor++;
        // Recover from a browser/OS interruption without dumping missed notes into one instant.
        if(at<now-0.03)continue;
        this.lastNote=Math.max(now+0.005,at);schedule(graph,event,this.lastNote,secondsPerBeat,part.track);
      }
    }
  }
}

export async function renderPreview(options:{seed?:number;mood?:Mood;index?:number;seconds?:number;mode?:MusicMode;style?:StyleId;ambience?:number;sampleRate?:number;standalone?:boolean}={}) {
  const seconds=Math.max(1,Math.min(300,options.seconds??90)),sampleRate=options.sampleRate??44100;
  const plan=createSession(options.seed??20260917,options.mood??'rain',options.style);
  const score=(index:number)=>options.standalone&&plan.style==='lofi'?composeTrack(plan.seed,plan.mood,index):composeSessionTrack(plan,index);
  const track=score(options.index??0);
  const context=new OfflineAudioContext(2,Math.ceil(seconds*sampleRate),sampleRate);
  const graph=createGraph(context,plan.seed);await prepareBank(graph,STYLES[plan.style]);
  graph.output.gain.setValueAtTime(0,0);graph.output.gain.linearRampToValueAtTime(1,0.3);
  graph.output.gain.setValueAtTime(1,seconds-0.3);graph.output.gain.linearRampToValueAtTime(0,seconds);
  // The player's level for this style here, so a style away from home previews as it plays.
  const ambience=(options.ambience??DEFAULT_MIX.ambience)*plan.atmosphere;
  graph.ambience.gain.value=ambience;setSoundMode(graph,options.mode??'beats');
  if(track.session)for(let time=0;time<seconds;time+=.25){
    const weather=Math.max(.75,Math.min(1.12,sessionAt(plan,track.session.offset+time).weather));
    graph.ambience.gain.setTargetAtTime(ambience*weather,time,3);
  }
  startAmbience(graph,placeById(plan.mood),0);
  let song=track,start=0.05,index=options.index??0;
  while(start<seconds) {
    for(const event of song.events) {
      const at=start+event.beat*60/song.bpm;if(at>=seconds)break;
      schedule(graph,event,at,60/song.bpm,song);
    }
    start+=song.bars*4*60/song.bpm;
    song=score(++index);
  }
  const buffer=await context.startRendering();disposeGraph(graph);
  return {buffer,track};
}
