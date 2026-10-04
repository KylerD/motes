import {CLIP,type ClipFrame} from './plan';

const LOGO_WIDTH=300,LOGO_HEIGHT=LOGO_WIDTH*114/486,LOGO_TOP=220,TITLE_Y=Math.round(CLIP.height*.36);

/** The wordmark throughout and the place's title at the end, clear of the apps' own controls. */
export function drawOverlay(ctx:CanvasRenderingContext2D,frame:ClipFrame,art:{logo?:HTMLImageElement;title:string}):void {
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.shadowColor='#110e0b99';ctx.shadowBlur=24;ctx.shadowOffsetY=3;
  if(art.logo){ctx.globalAlpha=.85;ctx.drawImage(art.logo,(CLIP.width-LOGO_WIDTH)/2,LOGO_TOP,LOGO_WIDTH,LOGO_HEIGHT);}
  if(frame.title>0) {
    ctx.fillStyle='#fff1da';ctx.textAlign='center';ctx.textBaseline='alphabetic';
    ctx.globalAlpha=frame.title;ctx.font='500 72px "EB Garamond", Georgia, serif';
    // The width limit keeps the title out of the right-hand 12%, where the apps draw their buttons.
    ctx.fillText(art.title,CLIP.width/2,TITLE_Y,CLIP.width*.76);
    ctx.globalAlpha=frame.title*.9;ctx.font='600 34px "Nunito Sans", Arial, sans-serif';
    ctx.fillText('motes.sh',CLIP.width/2,TITLE_Y+70);
  }
  ctx.restore();
}
