import type {MusicMode,MusicStyle} from '../music/composer';
import {SCENES,type Edition} from '../scenes/edition';
import {SceneRenderer} from '../scenes/renderer';
import {createSession,sessionAt} from '../session/session';
import {encodeClip} from './encode';
import {renderClipMusic} from './music';
import {drawOverlay} from './overlay';
import {CLIP,clipFrame,clipName} from './plan';

export type ClipStage='painting'|'music'|'frames';
export class ClipPaintingError extends Error {name='ClipPaintingError';}

/** Resolves once both paintings are ready to composite; rejects if either fails or the clip is cancelled. */
function paintingsReady(renderer:SceneRenderer,signal?:AbortSignal):Promise<void> {
  return new Promise((resolve,reject)=>{
    const check=()=>{
      if(signal?.aborted)reject(signal.reason);
      else if(renderer.failed)reject(new ClipPaintingError('The painting could not load for the clip.'));
      else if(renderer.ready&&renderer.diagnostics.lightingReady)resolve();
    };
    renderer.onChange=check;signal?.addEventListener('abort',check,{once:true});check();
  });
}

async function loadLogo():Promise<HTMLImageElement|undefined> {
  const image=new Image();image.src='/brand/motes-logo.svg';
  // A missing wordmark shouldn't cost someone their clip.
  try{await image.decode();return image;}catch{return undefined;}
}

/** Renders a place's arrival-to-evening clip with its music. Nothing on the live page changes. */
export async function makeClip(edition:Edition,style:MusicStyle,mode:MusicMode,
  {signal,onProgress}:{signal?:AbortSignal;onProgress?:(stage:ClipStage,fraction:number)=>void}={}):Promise<File> {
  const canvas=document.createElement('canvas');canvas.width=CLIP.width;canvas.height=CLIP.height;
  const renderer=new SceneRenderer(canvas,edition,{size:{...CLIP.viewport,ratio:CLIP.width/CLIP.viewport.width}});
  try {
    onProgress?.('painting',0);
    const [logo]=await Promise.all([loadLogo(),paintingsReady(renderer,signal),
      document.fonts.load('500 72px "EB Garamond"'),document.fonts.load('600 34px "Nunito Sans"')]);
    signal?.throwIfAborted();
    onProgress?.('music',0);
    const music=await renderClipMusic(edition,style,mode);
    signal?.throwIfAborted();
    const plan=createSession(edition.seed,edition.scene),ctx=canvas.getContext('2d',{alpha:false})!,title=SCENES[edition.scene].title;
    const blob=await encodeClip(canvas,music,index=>{
      const frame=clipFrame(index);
      renderer.setPan(frame.pan);
      // Session events would flicker past at 200×, so the clip leaves them out.
      renderer.draw(frame.time,performance.now(),{...sessionAt(plan,frame.listening),events:[]});
      drawOverlay(ctx,frame,{logo,title});
    },{signal,onProgress:fraction=>onProgress?.('frames',fraction)});
    return new File([blob],clipName(SCENES[edition.scene].slug,edition.day),{type:'video/mp4'});
  } finally {renderer.dispose();canvas.width=canvas.height=1;}
}
