import type {SessionState} from '../session/session';
import type {SceneId} from './edition';
import {sceneLightAt} from './scene-light';

interface Position { x:number; y:number }
interface SceneSpace { width:number; height:number; iw:number; point:(u:number,v:number)=>Position }
type Carving='face'|'moon'|'holes';
/** Image coordinates; `size` is the pumpkin's width as a fraction of the painting's width. */
interface Pumpkin { u:number; v:number; size:number; carving:Carving }

const TAU=Math.PI*2;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};

/** Pumpkins stand on painted surfaces, mostly above where a phone's caption sits (v .66–.77); `daylight` is how much
 *  arrival light falls on them. The moon (its settled centre) sits in clear sky inside a tall phone's crop, below the
 *  phone header and the clip's wordmark (v .115–.151). A `horizon` outlines the sky it may show in, so it can rise
 *  from behind a painted ridge. */
export const HALLOWEEN_PLACES:Record<SceneId,{pumpkins:readonly Pumpkin[];moon:readonly [number,number];daylight:number;
  radius?:number;horizon?:readonly (readonly [number,number])[];veiled?:boolean}>={
  // Rain arrives at blue hour and veils its moon behind thin cloud.
  rain:{moon:[.52,.20],daylight:.3,veiled:true,pumpkins:[
    {u:.335,v:.600,size:.024,carving:'face'},{u:.365,v:.607,size:.016,carving:'holes'},
    {u:.470,v:.624,size:.015,carving:'moon'},{u:.565,v:.618,size:.017,carving:'face'}]},
  // A harvest moon rising over the ridge in the sunset gap, left of the oak's leaves.
  meadow:{moon:[.55,.178],radius:.021,daylight:1,
    horizon:[[.50,0],[.66,0],[.66,.205],[.62,.222],[.60,.222],[.58,.206],[.57,.2],[.56,.194],[.55,.187],[.54,.18],[.53,.174],[.52,.168],[.50,.155]],pumpkins:[
    {u:.455,v:.655,size:.026,carving:'face'},{u:.487,v:.662,size:.018,carving:'moon'},
    {u:.605,v:.628,size:.019,carving:'holes'},{u:.775,v:.622,size:.021,carving:'face'}]},
  snow:{moon:[.55,.20],daylight:.45,pumpkins:[
    {u:.368,v:.655,size:.024,carving:'face'},{u:.393,v:.661,size:.016,carving:'holes'},
    {u:.386,v:.606,size:.011,carving:'moon'},{u:.175,v:.556,size:.022,carving:'face'}]},
  coast:{moon:[.605,.19],daylight:.8,pumpkins:[
    {u:.497,v:.770,size:.030,carving:'face'},{u:.567,v:.657,size:.022,carving:'moon'},
    {u:.400,v:.745,size:.018,carving:'holes'}]},
};

const canvas=(width:number,height:number)=>{const c=document.createElement('canvas');c.width=Math.max(1,width);c.height=Math.max(1,height);return c;};
/** A slight softening so a sprite sits in the painting instead of on it (ignored where canvas filters are unsupported). */
function soften(source:HTMLCanvasElement,radius:number):HTMLCanvasElement {
  const c=canvas(source.width,source.height),ctx=c.getContext('2d')!;
  ctx.filter=`blur(${radius}px)`;ctx.drawImage(source,0,0);return c;
}

/** Three overlapping lobes with radial shading, a stem and a soft contact shadow, drawn once per size and light. */
function body(width:number,dusk:boolean):HTMLCanvasElement {
  const height=Math.round(width*.8),c=canvas(width,height+Math.ceil(width*.12)),ctx=c.getContext('2d')!;
  const cx=width/2,cy=height*.56,[light,mid,edge]=dusk?['#8c4b28','#5f301b','#2d170e']:['#d98d4c','#ae632e','#683419'];
  // A contact shadow: a circle's gradient squashed flat onto the surface.
  ctx.save();ctx.scale(1,.25);
  const ground=height*.97/.25,shadow=ctx.createRadialGradient(cx,ground,0,cx,ground,width*.55);
  shadow.addColorStop(0,'rgba(18,10,6,.5)');shadow.addColorStop(1,'rgba(18,10,6,0)');
  ctx.fillStyle=shadow;ctx.fillRect(0,ground-width*.55,width,width*1.1);ctx.restore();
  const lobe=(x:number,rx:number,ry:number)=>{
    const g=ctx.createRadialGradient(x-rx*.35,cy-ry*.4,rx*.1,x,cy,Math.max(rx,ry)*1.05);
    g.addColorStop(0,light);g.addColorStop(.55,mid);g.addColorStop(1,edge);
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,cy,rx,ry,0,0,TAU);ctx.fill();
  };
  lobe(cx-width*.22,width*.26,height*.38);lobe(cx+width*.22,width*.26,height*.38);lobe(cx,width*.29,height*.42);
  // Faint ribs where the lobes meet, and a warm rim along the top.
  ctx.strokeStyle=dusk?'rgba(20,8,4,.35)':'rgba(90,38,12,.35)';ctx.lineWidth=Math.max(.6,width*.018);
  for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(cx+side*width*.1,cy,width*.15,height*.38,0,side<0?Math.PI*.6:-Math.PI*.4,side<0?Math.PI*1.4:Math.PI*.4);ctx.stroke();}
  ctx.strokeStyle=dusk?'rgba(255,170,110,.12)':'rgba(255,214,150,.35)';ctx.lineWidth=Math.max(.6,width*.02);
  ctx.beginPath();ctx.ellipse(cx,cy,width*.4,height*.4,0,Math.PI*1.12,Math.PI*1.62);ctx.stroke();
  ctx.fillStyle=dusk?'#2f2a17':'#556032';
  ctx.beginPath();ctx.moveTo(cx-width*.035,cy-height*.36);ctx.lineTo(cx-width*.02,cy-height*.52);ctx.lineTo(cx+width*.06,cy-height*.55);ctx.lineTo(cx+width*.035,cy-height*.34);ctx.closePath();ctx.fill();
  return soften(c,Math.max(.35,width*.012));
}

/** The carving's openings in the pumpkin's own box, lit (warm, bright centre) or dark. */
function carving(width:number,kind:Carving,lit:boolean):HTMLCanvasElement {
  const height=Math.round(width*.8),c=canvas(width,height+Math.ceil(width*.12)),ctx=c.getContext('2d')!;
  const cx=width/2,cy=height*.56;
  ctx.fillStyle=lit?'#ffcf73':'#4a2410';
  ctx.beginPath();
  if(kind==='face') {
    for(const side of [-1,1]){ctx.moveTo(cx+side*width*.13+width*.055,cy-height*.08);ctx.arc(cx+side*width*.13,cy-height*.08,width*.055,0,TAU);}
    ctx.moveTo(cx-width*.17,cy+height*.06);
    ctx.quadraticCurveTo(cx,cy+height*.34,cx+width*.17,cy+height*.06);
    ctx.quadraticCurveTo(cx,cy+height*.2,cx-width*.17,cy+height*.06);
  } else if(kind==='moon') {
    ctx.arc(cx,cy,width*.15,0,TAU);
  } else {
    for(const [x,y,r] of [[-.12,-.12,.04],[.1,-.14,.035],[0,-.02,.045],[-.16,.1,.035],[.14,.08,.04],[.02,.17,.035],[-.04,.3,.025]] as const) {
      ctx.moveTo(cx+x*width+r*width,cy+y*height);ctx.arc(cx+x*width,cy+y*height,r*width,0,TAU);
    }
  }
  ctx.fill();
  if(kind==='moon'){ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(cx+width*.08,cy-height*.06,width*.13,0,TAU);ctx.fill();ctx.globalCompositeOperation='source-over';}
  if(lit) {
    ctx.globalCompositeOperation='source-atop';
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,width*.3);
    g.addColorStop(0,'#fff4c8');g.addColorStop(1,'#ff9a3c');
    ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);
  }
  return soften(c,Math.max(.3,width*.008));
}

/** A warm cream harvest moon with soft maria and a halo; the canvas is three radii wide around the disc. */
function moon(radius:number):HTMLCanvasElement {
  const size=Math.ceil(radius*6),c=canvas(size,size),ctx=c.getContext('2d')!,m=size/2;
  const halo=ctx.createRadialGradient(m,m,radius*.9,m,m,radius*3);
  halo.addColorStop(0,'rgba(255,214,160,.32)');halo.addColorStop(1,'rgba(255,200,140,0)');
  ctx.fillStyle=halo;ctx.fillRect(0,0,size,size);
  const disc=ctx.createRadialGradient(m-radius*.25,m-radius*.25,radius*.1,m,m,radius);
  disc.addColorStop(0,'#fff6dc');disc.addColorStop(.75,'#f8dfa6');disc.addColorStop(1,'#e9c180');
  ctx.fillStyle=disc;ctx.beginPath();ctx.arc(m,m,radius,0,TAU);ctx.fill();
  ctx.globalCompositeOperation='source-atop';
  // Faint, uneven maria: never two even spots that read as eyes.
  for(const [x,y,r] of [[-.38,.05,.5],[.12,.32,.34],[.34,-.36,.16],[-.1,-.2,.14]] as const) {
    const g=ctx.createRadialGradient(m+x*radius,m+y*radius,0,m+x*radius,m+y*radius,r*radius);
    g.addColorStop(0,'rgba(200,158,108,.16)');g.addColorStop(1,'rgba(200,158,108,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,size,size);
  }
  return c;
}

function warmth():HTMLCanvasElement {
  const c=canvas(64,64),ctx=c.getContext('2d')!,g=ctx.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,190,100,.75)');g.addColorStop(.35,'rgba(255,150,70,.25)');g.addColorStop(1,'rgba(255,140,60,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return c;
}

/** Jack-o'-lanterns, a harvest moon and bats over a Halloween edition. Owned by one renderer, so its sprites go with it;
 *  they are drawn once per device-pixel size and the cache is bounded. */
export class HalloweenLayer {
  private sprites=new Map<string,HTMLCanvasElement>();
  private glow=warmth();

  private sprite(key:string,make:()=>HTMLCanvasElement):HTMLCanvasElement {
    let sprite=this.sprites.get(key);
    if(!sprite){if(this.sprites.size>=48)this.sprites.clear();sprite=make();this.sprites.set(key,sprite);}
    return sprite;
  }

  draw(ctx:CanvasRenderingContext2D,scene:SceneId,state:SessionState,time:number,space:SceneSpace,ratio:number):void {
    const light=sceneLightAt(scene,state.elapsed),place=HALLOWEEN_PLACES[scene];
    ctx.save();
    // The moon rises 3% of the painting's height over the hour, appearing as the sky turns.
    const shown=smooth((light.sky-.35)/.55);
    const centre=space.point(place.moon[0],place.moon[1]+.03*(1-clamp(state.elapsed/3600)));
    if(shown>0) {
      const radius=space.iw*(place.radius??.019),pixels=Math.max(4,Math.round(radius*ratio)),image=this.sprite(`moon:${pixels}`,()=>moon(pixels));
      ctx.save();
      if(place.horizon) {
        ctx.beginPath();
        place.horizon.forEach(([u,v],i)=>{const p=space.point(u,v);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});
        ctx.closePath();ctx.clip();
      }
      ctx.globalAlpha=shown*(place.veiled?.7:.95);ctx.drawImage(image,centre.x-radius*3,centre.y-radius*3,radius*6,radius*6);
      ctx.restore();
      this.bats(ctx,centre,smooth((shown-.6)/.3),time,space);
    }
    const lit=light.lamps,day=1-light.foreground;
    place.pumpkins.forEach((pumpkin,i)=>{
      const width=space.iw*pumpkin.size,height=width*.8,box=Math.round(width*ratio),p=space.point(pumpkin.u,pumpkin.v);
      const x=p.x-width/2,y=p.y-height,w=width,h=width*.92;
      const flicker=.82+.1*Math.sin(time*7.3+i*1.7)+.08*Math.sin(time*12.9+i);
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=1;ctx.drawImage(this.sprite(`dusk:${box}`,()=>body(box,true)),x,y,w,h);
      if(day>0){ctx.globalAlpha=day*place.daylight;ctx.drawImage(this.sprite(`day:${box}`,()=>body(box,false)),x,y,w,h);}
      if(lit<1){ctx.globalAlpha=(1-lit)*.7;ctx.drawImage(this.sprite(`cut:${pumpkin.carving}:${box}`,()=>carving(box,pumpkin.carving,false)),x,y,w,h);}
      if(lit>0) {
        ctx.globalAlpha=lit*flicker;ctx.drawImage(this.sprite(`lit:${pumpkin.carving}:${box}`,()=>carving(box,pumpkin.carving,true)),x,y,w,h);
        // A warm halo, and a pool of light flattened onto the surface it stands on.
        ctx.globalCompositeOperation='screen';ctx.globalAlpha=lit*flicker*.55;
        ctx.drawImage(this.glow,p.x-width*1.3,y+height*.55-width*1.3,width*2.6,width*2.6);
        ctx.globalAlpha=lit*flicker*.4;ctx.drawImage(this.glow,p.x-width*1.6,p.y-width*.35,width*3.2,width*.7);
      }
    });
    ctx.restore();
  }

  /** Four bats flitting in loose, uneven loops near the moon; wings beat with picture time, so Still holds them. */
  private bats(ctx:CanvasRenderingContext2D,moon:Position,amount:number,time:number,space:SceneSpace):void {
    if(amount<=0)return;
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=amount*.85;ctx.fillStyle='#1c1726';
    for(let k=0;k<4;k++) {
      const x=moon.x+space.iw*(.045*Math.sin(time*.31+k*1.9)+.02*Math.sin(time*.83+k));
      const y=moon.y+space.iw*(.016*Math.sin(time*.47+k*2.3)+.007*Math.sin(time*1.3+k*.7)-.008);
      const span=space.iw*.0085*(1+(k%2)*.25),beat=Math.sin(time*9+k*1.3),lift=beat*span*.45;
      ctx.beginPath();
      // Each wing runs out along its leading edge and back along a scalloped trailing edge.
      for(const side of [-1,1]) {
        ctx.moveTo(x,y-span*.1);
        ctx.lineTo(x+side*span*.38,y-span*.12-lift*.5);
        ctx.lineTo(x+side*span,y-lift);
        ctx.lineTo(x+side*span*.74,y+span*.04-lift*.6);
        ctx.lineTo(x+side*span*.52,y+span*.1-lift*.32);
        ctx.lineTo(x+side*span*.28,y+span*.08-lift*.1);
        ctx.lineTo(x,y+span*.14);
        ctx.closePath();
      }
      ctx.moveTo(x+span*.09,y);ctx.ellipse(x,y,span*.09,span*.16,0,0,TAU);
      ctx.fill();
    }
  }
}
