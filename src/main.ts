import './style.css';
import { DEFAULT_MIX, RadioAudio } from './music/audio';
import type {MusicStyle} from './music/composer';
import { edition,dayLabel,localDay,validDay,isScene,placePath,sceneFromPath,SCENES,SCENE_IDS,type SceneId } from './scenes/edition';
import { SceneRenderer } from './scenes/renderer';
import {createSession,sessionAt} from './session/session';
import {sceneLightAt} from './scenes/scene-light';
import {frameDelay} from './scenes/frame-budget';
import {shareLink,shareMessage} from './share/link';

const $ = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const text = (id:string,value:string) => {const element=$(id);if(element.textContent!==value)element.textContent=value;};
const attribute = (id:string,name:string,value:string) => {const element=$(id);if(element.getAttribute(name)!==value)element.setAttribute(name,value);};
const params = new URLSearchParams(location.search), reduced = matchMedia('(prefers-reduced-motion: reduce)');
// A place page (/places/<slug>/) pins its place; ?scene= links from before place pages still work.
const queryDay = params.get('day'), queryScene = params.get('scene'), chosenScene = sceneFromPath(location.pathname)??(isScene(queryScene)?queryScene:undefined);
let today = localDay(), current = edition(validDay(queryDay)?queryDay:today,chosenScene);
let scenePinned = chosenScene!==undefined;
const audio = new RadioAudio(current.seed,current.scene);
const canvas=$<HTMLCanvasElement>('scene');
let renderer:SceneRenderer;
try { renderer=new SceneRenderer(canvas,current); }
catch(error) { $('failure').hidden=false;$('failure').textContent=error instanceof Error?error.message:'The scene could not start. Try reloading.';throw error; }

interface Preferences { volume:number; ambience:number; mode:'beats'|'ambient'; style:MusicStyle }
let preferences:Preferences={volume:DEFAULT_MIX.music,ambience:DEFAULT_MIX.ambience,mode:'beats',style:'lofi'};
try {
  const saved=JSON.parse(localStorage.getItem('motes-listening')||'null');
  if(saved && typeof saved==='object') {
    for(const key of ['volume','ambience'] as const)if(typeof saved[key]==='number'&&Number.isFinite(saved[key]))preferences[key]=Math.max(0,Math.min(1,saved[key]));
    if(saved.mode==='beats'||saved.mode==='ambient')preferences.mode=saved.mode;
    if(saved.style==='lofi'||saved.style==='synthwave')preferences.style=saved.style;
  }
} catch { /* Listening still works when browser storage is unavailable. */ }
const savePreferences=()=>{try{localStorage.setItem('motes-listening',JSON.stringify(preferences));}catch{/* Private browsing may disable persistence. */}};
audio.setVolume(preferences.volume);audio.setAmbience(preferences.ambience);audio.setMode(preferences.mode);
void audio.setStyle(preferences.style);
for(const [id,value] of [['music-volume',preferences.volume],['ambience-volume',preferences.ambience]] as const) {
  $<HTMLInputElement>(id).value=String(Math.round(value*100));
  $(id).style.setProperty('--level',`${Math.round(value*100)}%`);
}
$('music-level').textContent=`${Math.round(preferences.volume*100)}%`;$('ambience-level').textContent=`${Math.round(preferences.ambience*100)}%`;
$<HTMLSelectElement>('music-mode').value=preferences.mode;
$<HTMLSelectElement>('music-style').value=preferences.style;

let visualTime=0,last=performance.now(),frame=0,starting=false,listened=false,quiet=false,disposed=false;
let frameTimer:ReturnType<typeof setTimeout>|undefined;
let previewSeconds:number|undefined;
let statusTimer:ReturnType<typeof setTimeout>|undefined;
let styleRequest=0,switchingStyle=false;
const panelIds=['mix','scenes','edition'] as const;
type PanelId=typeof panelIds[number];
let openPanel:PanelId|null=null;
function say(message:string,persistent=false) {
  if(statusTimer)clearTimeout(statusTimer);
  $('status').textContent=message;$('status').hidden=false;
  if(!persistent)statusTimer=setTimeout(()=>{$('status').hidden=true;},5500);
}
function closePanels(focus=true) {
  const previous=openPanel;
  for(const id of panelIds){$(`${id}-panel`).hidden=true;$(`${id}-toggle`).setAttribute('aria-expanded','false');}
  openPanel=null;if(focus&&previous)$(`${previous}-toggle`).focus();
}
function togglePanel(id:PanelId) {
  const shouldOpen=openPanel!==id;closePanels(false);
  if(shouldOpen){openPanel=id;$(`${id}-panel`).hidden=false;$(`${id}-toggle`).setAttribute('aria-expanded','true');$(`${id}-panel`).querySelector<HTMLElement>('input,button,select')?.focus();}
}
for(const id of panelIds)$(`${id}-toggle`).addEventListener('click',()=>togglePanel(id));
document.querySelectorAll('.close-panel').forEach(el=>el.addEventListener('click',()=>closePanels()));
document.addEventListener('pointerdown',e=>{const el=e.target as Element;if(openPanel&&!el.closest('.panel')&&!el.closest('[aria-controls]'))closePanels(false);});
function setQuiet(value:boolean) {
  quiet=value;closePanels(false);$('experience').classList.toggle('quiet',value);$('return-controls').hidden=!value;
  if(value)$('return-controls').focus();else $('quiet').focus();
}
$('quiet').addEventListener('click',()=>setQuiet(true));$('return-controls').addEventListener('click',()=>setQuiet(false));

function updateUrl() {
  const url=new URL(location.href);for(const key of ['seed','habitat','view','scene'])url.searchParams.delete(key);
  url.pathname=scenePinned?placePath(current.scene):'/';
  if(current.day===localDay())url.searchParams.delete('day');else url.searchParams.set('day',current.day);
  history.replaceState(null,'',url);
}
function updateEdition() {
  const place=SCENES[current.scene];
  $('experience').dataset.scene=current.scene;$('scene-title').textContent=place.title;$('scene-subtitle').textContent=place.subtitle;
  $('atmosphere-description').textContent=current.light;
  $('edition-label').textContent=`${current.day===localDay()?'Today · ':''}${dayLabel(current.day)}`;
  $('edition-short-label').textContent=new Date(`${current.day}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  $('edition-toggle').title=`Revisit a day · ${dayLabel(current.day)}`;
  $<HTMLInputElement>('edition-date').value=current.day;
  canvas.setAttribute('aria-label',`${place.name}. ${current.light}. Use Scene motion in Sound & motion to pause animation.`);
  document.querySelectorAll<HTMLElement>('[data-place]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.place===current.scene)));
  updateUrl();updatePlayer();
}
function visit(day:string,scene?:SceneId) {
  scenePinned=scene!==undefined;current=edition(day,scene);renderer.setEdition(current);audio.setEdition(current.seed,current.scene);visualTime=0;previewSeconds=undefined;
  $('new-day').hidden=true;closePanels();updateEdition();repaint();
}
for(const id of SCENE_IDS) {
  const place=SCENES[id],button=document.createElement('button');button.className='scene-choice';button.dataset.place=id;
  button.setAttribute('aria-pressed',String(current.scene===id));
  const image=document.createElement('img');image.src=`/scenes/thumbs/${place.slug}.webp`;image.alt='';image.loading='lazy';image.decoding='async';
  const copy=document.createElement('span'),title=document.createElement('strong'),description=document.createElement('small');
  title.textContent=place.name;description.textContent=place.weather;copy.append(title,description);button.append(image,copy);
  button.insertAdjacentHTML('beforeend','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>');
  button.addEventListener('click',()=>visit(current.day,id));$('scene-list').append(button);
}
$<HTMLInputElement>('edition-date').addEventListener('change',e=>{
  const date=(e.currentTarget as HTMLInputElement).value;
  if(validDay(date))visit(date);else say('Choose a valid date between 2000 and 2100.');
});
for(const id of ['today','daily-place','new-day'])$(id).addEventListener('click',()=>visit(localDay()));
function checkDay() {
  const now=localDay();
  if(now!==today) { today=now;$('new-day').hidden=current.day===now;updateEdition(); }
}

async function toggleListening() {
  if(starting)return;
  if(audio.playing){audio.pause();updatePlayer();return;}
  starting=true;$('status').hidden=true;updatePlayer();
  try { await audio.enable();listened=true; }
  catch { say('The music couldn’t start. Check your connection, then press Listen to try again.',true); }
  finally { starting=false;updatePlayer(); }
}
function updatePlayer() {
  const playing=audio.playing,track=audio.current,session=audio.session;
  const voice=track.style==='synthwave'?{arpeggio:'Arpeggios & warm pads',pulse:'Pulsing bass',drift:'Drifting pads',lead:'Night-drive melodies'}[track.family??'arpeggio']:{upright:'Upright piano',felt:'Felt piano',electric:'Electric keys',vibes:'Soft mallets'}[track.voice];
  attribute('experience','data-playing',String(playing));
  $<HTMLButtonElement>('listen').disabled=starting;
  attribute('listen','aria-pressed',String(playing));attribute('listen','aria-label',playing?'Pause music':'Listen to music');
  attribute('listen-path','d',playing?'M8 5v14M16 5v14':'m9 5 11 7-11 7Z');
  text('listen-label',starting?'Tuning in…':playing?'Pause':listened?'Resume':'Listen');
  text('track-title',track.title);
  text('track-detail',switchingStyle?'Tuning into your music…':starting?(track.style==='synthwave'?'Warming up the synths…':'Preparing the piano…'):!listened?'An hour, unfolding here':`${voice} · ${session.chapter}`);
  attribute('track-detail','title',`${voice} · ${session.chapter}${preferences.mode==='ambient'?' · Without drums':''}`);
  const environment=previewSeconds===undefined?audio.environment:sessionAt(createSession(current.seed,current.scene),previewSeconds);
  const shownEnvironment=renderer.motion?environment:renderer.diagnostics.session??environment;
  const light=sceneLightAt(current.scene,shownEnvironment.elapsed);
  text('atmosphere-description',light.caption);
  text('scene-subtitle',light.subtitle);
  $('track-progress').style.transform=`scaleX(${session.progress})`;
  $<HTMLButtonElement>('next-track').disabled=!listened||starting;
  if('mediaSession' in navigator) {
    navigator.mediaSession.playbackState=playing?'playing':'paused';
    if(navigator.mediaSession.metadata?.title!==track.title)navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:'Motes',album:`${SCENES[current.scene].name} · ${dayLabel(current.day)}`});
  }
}
$('listen').addEventListener('click',()=>void toggleListening());
async function share() {
  const url=shareLink(location.origin,current.scene,current.day,localDay());
  if(navigator.share) {
    try{await navigator.share({...shareMessage(current.scene),url});return;}
    catch(error){if(error instanceof DOMException&&error.name==='AbortError')return;}
  }
  try{await navigator.clipboard.writeText(url);say('Link copied. Pass this place on to someone who needs a quiet hour.');}
  catch{say(`Copy this link to share the place: ${url}`,true);}
}
$('share').addEventListener('click',()=>void share());
$('next-track').addEventListener('click',()=>{audio.next();updatePlayer();});
$<HTMLInputElement>('music-volume').addEventListener('input',e=>{const value=Number((e.target as HTMLInputElement).value);preferences.volume=value/100;audio.setVolume(preferences.volume);$('music-level').textContent=`${value}%`;$('music-volume').style.setProperty('--level',`${value}%`);savePreferences();});
$<HTMLInputElement>('ambience-volume').addEventListener('input',e=>{const value=Number((e.target as HTMLInputElement).value);preferences.ambience=value/100;audio.setAmbience(preferences.ambience);$('ambience-level').textContent=`${value}%`;$('ambience-volume').style.setProperty('--level',`${value}%`);savePreferences();});
$<HTMLSelectElement>('music-mode').addEventListener('change',e=>{preferences.mode=(e.target as HTMLSelectElement).value==='ambient'?'ambient':'beats';audio.setMode(preferences.mode);savePreferences();updatePlayer();});
$<HTMLSelectElement>('music-style').addEventListener('change',async e=>{
  const select=e.target as HTMLSelectElement,style:MusicStyle=select.value==='synthwave'?'synthwave':'lofi';
  const request=++styleRequest;switchingStyle=true;updatePlayer();
  try {
    await audio.setStyle(style);
    if(request!==styleRequest)return;
    preferences.style=style;savePreferences();
  } catch {
    if(request!==styleRequest)return;
    select.value=audio.current.style;
    say('That music couldn’t load. Your current style is still here. Choose the style again to retry.',true);
  } finally {if(request===styleRequest){switchingStyle=false;updatePlayer();}}
});
function setMotion(on:boolean){renderer.motion=on;$('motion').setAttribute('aria-pressed',String(on));$('motion-label').textContent=on?'On':'Still';last=performance.now();repaint();}
setMotion(!reduced.matches);$('motion').addEventListener('click',()=>setMotion(!renderer.motion));reduced.addEventListener('change',()=>setMotion(!reduced.matches));
canvas.addEventListener('pointerup',e=>{const box=canvas.getBoundingClientRect();renderer.ripple(e.clientX-box.left,e.clientY-box.top,visualTime);});
$('retry-art').addEventListener('click',()=>{renderer.retry();repaint();});
canvas.addEventListener('contextlost',e=>{e.preventDefault();say('The picture is taking a moment. Your music will keep playing.',true);});
canvas.addEventListener('contextrestored',()=>{renderer.resize();$('status').hidden=true;repaint();});
$('fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('experience').requestFullscreen();}
  catch{say('Fullscreen isn’t available here. Hide controls for an uninterrupted view.');}
});
document.addEventListener('fullscreenchange',()=>{const label=document.fullscreenElement?'Exit fullscreen':'Enter fullscreen';$('fullscreen').setAttribute('aria-label',label);$('fullscreen').title=label;renderer.resize();repaint();});
document.addEventListener('keydown',e=>{
  const target=e.target as HTMLElement;
  if(e.key==='Escape'){if(openPanel)closePanels();else if(quiet)setQuiet(false);return;}
  if(target.closest('input,select,button')||target.isContentEditable)return;
  if(e.code==='Space'){e.preventDefault();void toggleListening();}
});
if('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play',()=>{if(!audio.playing)void toggleListening();});
  navigator.mediaSession.setActionHandler('pause',()=>{audio.pause();updatePlayer();});
  navigator.mediaSession.setActionHandler('nexttrack',()=>{audio.next();updatePlayer();});
}
function stopPainting() {cancelAnimationFrame(frame);if(frameTimer)clearTimeout(frameTimer);frameTimer=undefined;}
/** Paint again after the frame budget allows; animation frames still align drawing with the display. */
function schedulePaint(delay:number) {
  stopPainting();if(disposed||document.hidden)return;
  if(delay<=1)frame=requestAnimationFrame(paint);
  else frameTimer=setTimeout(()=>{frameTimer=undefined;frame=requestAnimationFrame(paint);},delay);
}
function repaint() {schedulePaint(0);}
function paint(now:number) {
  if(disposed)return;
  if(renderer.motion)visualTime+=Math.min(.07,Math.max(0,(now-last)/1000));last=now;
  renderer.draw(visualTime,now,previewSeconds===undefined?audio.environment:sessionAt(createSession(current.seed,current.scene),previewSeconds));
  $('art-status').hidden=renderer.ready&&!renderer.failed;$('retry-art').hidden=!renderer.failed;
  $('art-message').textContent=renderer.ready&&renderer.lightingFailed?'The evening light couldn’t load. You can still stay here.':renderer.failed?'The painting couldn’t load. The music is still here.':'Finding a quiet place…';
  schedulePaint(frameDelay({motion:renderer.motion,smooth:renderer.smooth,spent:performance.now()-now}));
}
renderer.onChange=repaint;
const uiTimer=setInterval(()=>{updatePlayer();checkDay();},700);
window.addEventListener('resize',()=>{renderer.resize();repaint();});
document.addEventListener('visibilitychange',()=>{
  stopPainting();last=performance.now();checkDay();
  if(!document.hidden)repaint();
  // The radio owns its own audio clock. A hidden tab must never stop the music.
});
let cachedPlayback=false;
window.addEventListener('pagehide',e=>{
  stopPainting();
  if(e.persisted){cachedPlayback=audio.playing;audio.pause();}
  else{disposed=true;clearInterval(uiTimer);if(statusTimer)clearTimeout(statusTimer);audio.dispose();renderer.dispose();}
});
window.addEventListener('pageshow',e=>{
  if(e.persisted){last=performance.now();repaint();if(cachedPlayback)void toggleListening();}
});
if(params.has('debug'))Object.assign(window,{__motes:{get edition(){return current;},get time(){return visualTime;},get ready(){return renderer.ready;},get failed(){return renderer.failed;},get motion(){return renderer.motion;},get rendering(){return renderer.diagnostics;},get radio(){return audio.diagnostics;},get track(){return audio.current;},get session(){return audio.session;},get environment(){return audio.environment;},get sessionPlan(){return createSession(current.seed,current.scene);},visit,
  previewSession:(seconds:number,preserveMotion=false)=>{previewSeconds=Math.max(0,seconds);if(!preserveMotion)visualTime=seconds;renderer.draw(visualTime,performance.now(),sessionAt(createSession(current.seed,current.scene),previewSeconds));updatePlayer();},
  advance:(seconds:number)=>{visualTime+=seconds;renderer.draw(visualTime);},point:(u:number,v:number)=>renderer.point(u,v)}});
updateEdition();repaint();
