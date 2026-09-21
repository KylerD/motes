import type { ActiveEvent, SessionState } from '../session/session';
import type { SceneId } from './edition';
import {meadowLightAt} from './meadow-light';

interface Position { x:number; y:number }
interface SceneSpace { width:number; height:number; iw:number; point:(u:number,v:number)=>Position }
const TAU=Math.PI*2;
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const smooth=(value:number)=>{const t=clamp(value);return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;

function polygon(ctx:CanvasRenderingContext2D,points:Position[],color:string):void {
  ctx.fillStyle=color;ctx.beginPath();
  points.forEach((p,i)=>{if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});
  ctx.closePath();ctx.fill();
}

function glow(ctx:CanvasRenderingContext2D,p:Position,radius:number,alpha:number):void {
  const gradient=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
  gradient.addColorStop(0,'rgba(255,216,153,.55)');
  gradient.addColorStop(.23,'rgba(255,186,115,.18)');
  gradient.addColorStop(1,'rgba(255,174,110,0)');
  ctx.globalAlpha=alpha;ctx.fillStyle=gradient;
  ctx.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);
}

function evening(ctx:CanvasRenderingContext2D,scene:SceneId,state:SessionState,space:SceneSpace):void {
  // A transparent colour wash preserves the painted sunset and readable snow.
  ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=clamp(state.warmth)*.065;
  ctx.fillStyle=scene==='rain'?'#e7a1bf':'#ffbe76';ctx.fillRect(0,0,space.width,space.height);
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=clamp(state.dusk);
  const shade=ctx.createLinearGradient(0,0,0,space.height);
  const depth=scene==='rain'?.085:scene==='meadow'?.15:.13;
  shade.addColorStop(0,`rgba(15,25,56,${depth})`);
  shade.addColorStop(.58,`rgba(20,27,48,${depth*.55})`);
  shade.addColorStop(1,`rgba(12,24,41,${depth*.8})`);
  ctx.fillStyle=shade;ctx.fillRect(0,0,space.width,space.height);ctx.globalAlpha=1;
}

// Centre of the far rail: around the bend, then along the platform. Heights and
// carriage widths use image units, so a cover crop cannot move them off the rail.
function rail(t:number,space:SceneSpace):Position {
  const a=1-t;
  return space.point(
    a*a*a*.444+3*a*a*t*.392+3*a*t*t*.402+t*t*t*.505,
    a*a*a*.552+3*a*a*t*.56+3*a*t*t*.604+t*t*t*.68,
  );
}

function carriage(ctx:CanvasRenderingContext2D,space:SceneSpace,back:number,front:number,engine:boolean):void {
  const a=rail(back,space),b=rail(front,space);
  const aw=space.iw*(.0012+.0043*back),bw=space.iw*(.0012+.0043*front);
  const ah=space.iw*(.003+.0065*back),bh=space.iw*(.003+.0065*front);
  const groundA=[{x:a.x-aw,y:a.y},{x:a.x+aw,y:a.y}];
  const groundB=[{x:b.x-bw,y:b.y},{x:b.x+bw,y:b.y}];
  const roofA=groundA.map(p=>({x:p.x,y:p.y-ah}));
  const roofB=groundB.map(p=>({x:p.x,y:p.y-bh}));

  // Two shaded sides, a narrow snow-dusted roof and a cab give a small train a
  // silhouette without a large, flat rectangle over the illustration.
  polygon(ctx,[groundA[0],groundB[0],roofB[0],roofA[0]],'#293341');
  polygon(ctx,[groundA[1],groundB[1],roofB[1],roofA[1]],'#453b38');
  for(const side of [0,1]) {
    const windows=engine?2:3;
    for(let i=0;i<windows;i++) {
      const begin=.15+i*.72/windows,end=begin+.44/windows;
      const corner=(t:number,height:number)=>({
        x:mix(groundA[side].x,groundB[side].x,t),
        y:mix(a.y,b.y,t)-mix(ah,bh,t)*height,
      });
      polygon(ctx,[corner(begin,.72),corner(end,.72),corner(end,.38),corner(begin,.38)],i%2?'#d3a766':'#e3b875');
    }
  }
  polygon(ctx,[roofA[0],roofA[1],roofB[1],roofB[0]],'#637084');
  polygon(ctx,[groundB[0],groundB[1],roofB[1],roofB[0]],engine?'#263142':'#303844');
  ctx.strokeStyle='#a1adbb';ctx.lineWidth=space.iw*.00055;
  ctx.beginPath();ctx.moveTo(roofA[0].x,roofA[0].y);ctx.lineTo(roofB[0].x,roofB[0].y);ctx.stroke();
  if(engine) {
    polygon(ctx,[{x:b.x-bw*.57,y:b.y-bh*.76},{x:b.x+bw*.57,y:b.y-bh*.76},
      {x:b.x+bw*.49,y:b.y-bh*.48},{x:b.x-bw*.49,y:b.y-bh*.48}],'#d5ac73');
    ctx.fillStyle='#f9dfb0';ctx.beginPath();ctx.ellipse(b.x,b.y-bh*.24,space.iw*.00075,space.iw*.00062,0,0,TAU);ctx.fill();
  }
}

function train(ctx:CanvasRenderingContext2D,event:ActiveEvent,space:SceneSpace):void {
  const p=clamp(event.progress),arrive=35/110,leave=65/110;
  const front=p<arrive?mix(.21,.66,smooth(p/arrive))
    :p<leave?.66:mix(.66,1.05,Math.pow((p-leave)/(1-leave),1.7));
  ctx.save();ctx.globalAlpha=clamp(event.strength)*.94;
  // Farther cars are painted first; the cab remains only a few image pixels tall.
  for(let car=2;car>=0;car--) {
    const head=front-car*.105,tail=Math.max(.015,head-.097);
    if(head>tail)carriage(ctx,space,tail,head,car===0);
  }
  ctx.restore();
}

function boat(ctx:CanvasRenderingContext2D,event:ActiveEvent,time:number,space:SceneSpace):void {
  const p=space.point(mix(.52,.68,event.progress),.405+Math.sin(event.progress*Math.PI)*.006);
  const unit=space.iw*.001,alpha=clamp(event.strength);
  p.y+=Math.sin(time*.67)*unit*.18;
  ctx.save();ctx.lineCap='round';ctx.lineWidth=unit*.42;
  ctx.globalAlpha=alpha*.24;ctx.strokeStyle='#edc3aa';
  for(let i=0;i<2;i++) {
    ctx.beginPath();ctx.moveTo(p.x-unit*4,p.y+unit*(1+i*.6));
    ctx.quadraticCurveTo(p.x-unit*9,p.y+unit*(1.5+i),p.x-unit*(16+i*3),p.y+unit*(1.7+i*1.6));ctx.stroke();
  }
  ctx.globalAlpha=alpha*.83;
  polygon(ctx,[{x:p.x-unit*5,y:p.y},{x:p.x+unit*5,y:p.y-unit*.5},
    {x:p.x+unit*3,y:p.y+unit*1.6},{x:p.x-unit*3,y:p.y+unit*1.3}],'#303b48');
  polygon(ctx,[{x:p.x-unit*1.8,y:p.y},{x:p.x-unit*1.6,y:p.y-unit*1.9},
    {x:p.x+unit*1.5,y:p.y-unit*1.9},{x:p.x+unit*2,y:p.y}],'#c0a991');
  ctx.strokeStyle='#535368';ctx.beginPath();ctx.moveTo(p.x-unit,p.y-unit*1.9);ctx.lineTo(p.x-unit,p.y-unit*5);ctx.stroke();
  ctx.globalAlpha=alpha*.18;ctx.strokeStyle='#eac299';
  for(let i=0;i<3;i++) {
    const y=p.y+unit*(3+i*1.5),x=p.x+Math.sin(time*.5+i)*unit;
    ctx.beginPath();ctx.moveTo(x-unit*(3-i*.5),y);ctx.lineTo(x+unit*(2.5-i*.5),y);ctx.stroke();
  }
  ctx.restore();
}

function birds(ctx:CanvasRenderingContext2D,event:ActiveEvent,time:number,scene:SceneId,space:SceneSpace):void {
  ctx.save();ctx.strokeStyle=scene==='coast'?'#343348':'#435146';ctx.lineWidth=Math.max(.45,space.iw*.0005);ctx.lineCap='round';
  ctx.globalAlpha=clamp(event.strength)*.55;
  for(let i=0;i<4;i++) {
    const p=space.point(.37+event.progress*.43-i*.012,.24-Math.sin(event.progress*Math.PI)*.037+i*.009);
    const size=space.iw*(.00145+i%2*.0003),wing=Math.sin(time*2.6-i*.7)*size*.55;
    ctx.beginPath();ctx.moveTo(p.x-size,p.y-wing);
    ctx.quadraticCurveTo(p.x-size*.4,p.y-size*.2,p.x,p.y);
    ctx.quadraticCurveTo(p.x+size*.4,p.y-size*.2,p.x+size,p.y-wing);ctx.stroke();
  }
  ctx.restore();
}

function butterflies(ctx:CanvasRenderingContext2D,event:ActiveEvent,time:number,space:SceneSpace):void {
  const places=[[.40,.565],[.47,.60],[.66,.565],[.75,.64]];
  ctx.save();ctx.globalAlpha=clamp(event.strength)*.68;
  places.forEach(([u,v],i)=>{
    const p=space.point(u+Math.sin(time*.17+i*2)*.013,v+Math.cos(time*.23+i)*.008);
    const size=space.iw*.00145,wing=.25+Math.abs(Math.sin(time*3.8+i))*.75;
    ctx.fillStyle=i%2?'#f4deb1':'#e8bc72';
    for(const side of [-1,1]) {
      ctx.beginPath();ctx.ellipse(p.x+side*size*.68*wing,p.y,size*.87*wing,size*.7,side*.45,0,TAU);ctx.fill();
    }
  });
  ctx.restore();
}

function fireflies(ctx:CanvasRenderingContext2D,state:SessionState,time:number,space:SceneSpace):void {
  const dusk=meadowLightAt(state.elapsed).fireflies;
  if(dusk<=0)return;
  const places=[[.39,.60],[.43,.58],[.57,.59],[.62,.60],[.71,.64],[.78,.60],[.75,.70],[.35,.75],[.48,.66],[.73,.83],[.82,.74],[.28,.66],[.57,.82]];
  ctx.save();ctx.globalCompositeOperation='screen';
  places.forEach(([u,v],i)=>{
    const p=space.point(u+Math.sin(time*.12+i*2)*.007,v+Math.cos(time*.15+i)*.005);
    const pulse=.35+.65*Math.pow(Math.sin(time*.29+i*1.7),2);
    glow(ctx,p,space.iw*.0035,dusk*pulse*.7);
    ctx.globalAlpha=dusk*pulse*.62;ctx.fillStyle='#ffe1a0';
    ctx.beginPath();ctx.arc(p.x,p.y,space.iw*.00055,0,TAU);ctx.fill();
  });
  ctx.restore();
}

function meadowLantern(ctx:CanvasRenderingContext2D,state:SessionState,time:number,space:SceneSpace):void {
  const amount=meadowLightAt(state.elapsed).lamps;
  if(!amount)return;
  ctx.save();ctx.globalCompositeOperation='screen';
  const breathe=.94+Math.sin(time*.7)*.035+Math.sin(time*1.13)*.025;
  glow(ctx,space.point(.817,.587),space.iw*.029,amount*breathe*.3);
  // A broken reflection remains below the painted lantern, never over the bank.
  ctx.strokeStyle='#edbd76';ctx.lineWidth=space.iw*.00065;
  for(let i=0;i<8;i++) {
    const p=space.point(.808+Math.sin(time*.43+i)*.0014,.739+i*.0043);
    const half=space.iw*(.0007+i*.00019);
    ctx.globalAlpha=amount*(.15-i*.013)*( .7+Math.sin(time*.45+i)*.2);
    ctx.beginPath();ctx.moveTo(p.x-half,p.y);ctx.lineTo(p.x+half,p.y);ctx.stroke();
  }
  ctx.restore();
}

function windows(ctx:CanvasRenderingContext2D,scene:SceneId,state:SessionState,space:SceneSpace):void {
  if(scene!=='rain'&&scene!=='snow')return;
  let event=0;
  for(let i=0;i<Math.min(6,state.events.length);i++)if(state.events[i].kind==='windows')event=Math.max(event,state.events[i].strength);
  const amount=clamp(state.lamps)*.32+clamp(event)*.22;
  if(amount<=0)return;
  // These centres are painted windows, not random points over roofs or trees.
  const spots=scene==='rain'
    ?[[.440,.434],[.450,.434],[.505,.477],[.521,.518],[.594,.47],[.613,.47],[.770,.56],[.778,.562],[.896,.411],[.904,.412]]
    :[[.440,.474],[.447,.474],[.516,.492],[.528,.491],[.646,.650],[.654,.65],[.687,.665],[.694,.665]];
  ctx.save();ctx.globalCompositeOperation='screen';
  spots.forEach(([u,v],i)=>{
    const level=amount*smooth((state.lamps+event*.4-i*.024)/.35),p=space.point(u,v);
    glow(ctx,p,space.iw*.004,level);
    ctx.globalAlpha=level*.31;ctx.fillStyle='#ffda9b';
    ctx.fillRect(p.x-space.iw*.0007,p.y-space.iw*.0012,space.iw*.0014,space.iw*.0024);
  });
  const lamps=scene==='rain'?[[.312,.321]]:[[.208,.326],[.341,.384],[.285,.448]];
  for(const [u,v] of lamps)glow(ctx,space.point(u,v),space.iw*.016,amount*.45);
  ctx.restore();
}

/** A deterministic layer over the painting; the caller owns its clock and Still state. */
export function drawSessionEffects(
  ctx:CanvasRenderingContext2D,scene:SceneId,state:SessionState,time:number,space:SceneSpace,
):void {
  ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  if(scene!=='meadow')evening(ctx,scene,state,space);
  windows(ctx,scene,state,space);
  if(scene==='meadow'){meadowLantern(ctx,state,time,space);fireflies(ctx,state,time,space);}
  // The written hour uses at most two simultaneous events. Keep the upper bound
  // explicit so drawing work remains bounded even for an externally supplied state.
  for(let i=0;i<Math.min(6,state.events.length);i++) {
    const event=state.events[i];
    if(event.kind==='train'&&scene==='snow')train(ctx,event,space);
    else if(event.kind==='boat'&&scene==='coast')boat(ctx,event,time,space);
    else if(event.kind==='birds'&&(scene==='coast'||scene==='meadow'))birds(ctx,event,time,scene,space);
    else if(event.kind==='butterflies'&&scene==='meadow')butterflies(ctx,event,time,space);
  }
  ctx.restore();
}
