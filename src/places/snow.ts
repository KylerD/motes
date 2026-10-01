import type {ActiveEvent} from '../session/session';
import type {LayerInput,Place,Point,Position,Space} from './index';
import {TAU,arc,clamp,mix,smooth} from './light';
import {during,polygon,windows} from '../scenes/session-effects';

// These centres are painted windows, not random points over roofs or trees.
const snowSpots:readonly Point[]=[[.440,.474],[.447,.474],[.516,.492],[.528,.491],[.646,.650],[.654,.65],[.687,.665],[.694,.665]];
const snowFixtures:readonly Point[]=[[.208,.326],[.341,.384],[.285,.448]];

// Centre of the far rail: around the bend, then along the platform. Heights and
// carriage widths use image units, so a cover crop cannot move them off the rail.
function rail(t:number,space:Space):Position {
  const a=1-t;
  return space.point(
    a*a*a*.444+3*a*a*t*.392+3*a*t*t*.402+t*t*t*.505,
    a*a*a*.552+3*a*a*t*.56+3*a*t*t*.604+t*t*t*.68,
  );
}

function carriage(ctx:CanvasRenderingContext2D,space:Space,back:number,front:number,engine:boolean):void {
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

function train(ctx:CanvasRenderingContext2D,event:ActiveEvent,{space}:LayerInput):void {
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

export default {
  id:'snow',name:'Last light station',title:'Let the snow fall.',weather:'Snow in the mountains',
  lights:['The quiet between trains','Snowfall at dusk','Warm windows, winter sky'],
  image:'/scenes/last-light-station.png',eveningImage:'/scenes/last-light-station-night.png',anchor:.43,color:'#151c37',
  lamps:[[.208,.326],[.341,.375]],steam:[.13,.525],
  effect:'snow',
  fallback:{tint:'#ffbe76',depth:.13},
  light:arc({
    timing:[[0,2640],[180,2760],[480,2520],[300,2700]],lamps:[600,1800],
    captions:['Snowfall at the station','Last pink on the mountains','Blue snow, amber windows','Lamplight along the platform'],
    subtitles:['Somewhere warm, along the way.','The valley settles into blue.','There is still a light on.'],
  }),
  regions:(u,v)=>{
    const near=Math.max(1-smooth((u-.30)/.15),smooth((v-.58)/.22));
    const sky=(1-smooth((v-.20)/.16))*(1-near);
    return [sky,Math.max(0,1-near-sky),near];
  },
  environment:{
    events:[{kind:'train',slot:8,duration:110,beats:96},{kind:'windows',slot:13,duration:100}],
    weather:({progress})=>.7+.62*smooth(progress/.7),
  },
  draw:[windows(snowSpots,snowFixtures),during('train',train)],
  ambience:{trim:0.45,texture:(_white,brown)=>brown*0.12},
  music:{style:'lofi',salt:3,titles:['Paper Lantern','Snow on the Sill','The Quiet Car','Wool & Ink','A Small Fire','Northern Postcard'],tempo:69},
} as const satisfies Place;
