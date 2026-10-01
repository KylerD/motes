import type { ActiveEvent, SessionState } from '../session/session';
import type { Layer, LayerInput, LightState, Place, Point, Position, Space } from '../places';

const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const smooth=(value:number)=>{const t=clamp(value);return t*t*(3-2*t);};

export function polygon(ctx:CanvasRenderingContext2D,points:Position[],color:string):void {
  ctx.fillStyle=color;ctx.beginPath();
  points.forEach((p,i)=>{if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});
  ctx.closePath();ctx.fill();
}

export function glow(ctx:CanvasRenderingContext2D,p:Position,radius:number,alpha:number):void {
  const gradient=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
  gradient.addColorStop(0,'rgba(255,216,153,.55)');
  gradient.addColorStop(.23,'rgba(255,186,115,.18)');
  gradient.addColorStop(1,'rgba(255,174,110,0)');
  ctx.globalAlpha=alpha;ctx.fillStyle=gradient;
  ctx.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);
}

function evening(ctx:CanvasRenderingContext2D,fallback:NonNullable<Place['fallback']>,state:SessionState,space:Space):void {
  // A transparent colour wash preserves the painted sunset and readable snow.
  ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=clamp(state.warmth)*.065;
  ctx.fillStyle=fallback.tint;ctx.fillRect(0,0,space.width,space.height);
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=clamp(state.dusk);
  const shade=ctx.createLinearGradient(0,0,0,space.height);
  const depth=fallback.depth;
  shade.addColorStop(0,`rgba(15,25,56,${depth})`);
  shade.addColorStop(.58,`rgba(20,27,48,${depth*.55})`);
  shade.addColorStop(1,`rgba(12,24,41,${depth*.8})`);
  ctx.fillStyle=shade;ctx.fillRect(0,0,space.width,space.height);ctx.globalAlpha=1;
}

export function windows(spots:readonly Point[],fixtures:readonly Point[]):Layer {
  return Object.assign((ctx:CanvasRenderingContext2D,{state,space,light}:LayerInput)=>{
    let event=0;
    for(let i=0;i<Math.min(6,state.events.length);i++)if(state.events[i].kind==='windows')event=Math.max(event,state.events[i].strength);
    const amount=light.lamps*.32+clamp(event)*.22;
    if(amount<=0)return;
    ctx.save();ctx.globalCompositeOperation='screen';
    spots.forEach(([u,v],i)=>{
      const level=amount*smooth((light.lamps+event*.4-i*.024)/.35),p=space.point(u,v);
      glow(ctx,p,space.iw*.004,level);
      ctx.globalAlpha=level*.31;ctx.fillStyle='#ffda9b';
      ctx.fillRect(p.x-space.iw*.0007,p.y-space.iw*.0012,space.iw*.0014,space.iw*.0024);
    });
    for(const [u,v] of fixtures)glow(ctx,space.point(u,v),space.iw*.016,amount*.45);
    ctx.restore();
  },{kind:'windows'});
}

export const birds=(colour:string)=>(ctx:CanvasRenderingContext2D,event:ActiveEvent,{time,space}:LayerInput)=>{
  ctx.save();ctx.strokeStyle=colour;ctx.lineWidth=Math.max(.45,space.iw*.0005);ctx.lineCap='round';
  ctx.globalAlpha=clamp(event.strength)*.55;
  for(let i=0;i<4;i++) {
    const p=space.point(.37+event.progress*.43-i*.012,.24-Math.sin(event.progress*Math.PI)*.037+i*.009);
    const size=space.iw*(.00145+i%2*.0003),wing=Math.sin(time*2.6-i*.7)*size*.55;
    ctx.beginPath();ctx.moveTo(p.x-size,p.y-wing);
    ctx.quadraticCurveTo(p.x-size*.4,p.y-size*.2,p.x,p.y);
    ctx.quadraticCurveTo(p.x+size*.4,p.y-size*.2,p.x+size,p.y-wing);ctx.stroke();
  }
  ctx.restore();
};

/** Draws one event kind; keeps today's bound of six simultaneous events. */
export function during(kind:string,draw:(ctx:CanvasRenderingContext2D,event:ActiveEvent,input:LayerInput)=>void):Layer {
  return Object.assign((ctx:CanvasRenderingContext2D,input:LayerInput)=>{
    for(let i=0;i<Math.min(6,input.state.events.length);i++)if(input.state.events[i].kind===kind)draw(ctx,input.state.events[i],input);
  },{kind});
}

/** A deterministic layer over the painting; the caller owns its clock and Still state. */
export function drawSessionEffects(ctx:CanvasRenderingContext2D,place:Place,state:SessionState,time:number,space:Space,authoredLight:boolean,light:LightState,motion:boolean,seed:number):void {
  ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  if(!authoredLight&&place.fallback)evening(ctx,place.fallback,state,space);
  for(const layer of place.draw)layer(ctx,{state,time,space,light,motion,seed});
  ctx.restore();
}
