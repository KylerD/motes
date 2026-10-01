import type {ActiveEvent} from '../session/session';
import type {LayerInput,Place} from './index';
import {TAU,clamp,smooth} from './light';
import {birds,during,glow} from '../scenes/session-effects';
import {meadowLightAt} from '../scenes/meadow-light';

function butterflies(ctx:CanvasRenderingContext2D,event:ActiveEvent,{time,space}:LayerInput):void {
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

function fireflies(ctx:CanvasRenderingContext2D,{state,time,space}:LayerInput):void {
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

function lantern(ctx:CanvasRenderingContext2D,{time,space,light}:LayerInput):void {
  const amount=light.lamps;
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

export default {
  id:'meadow',name:'Golden hour',title:'Nowhere else to be.',weather:'A breeze through the meadow',
  lights:['Sun through the branches','A slow golden afternoon','Warm light, wandering clouds'],
  image:'/scenes/golden-hour.png',eveningImage:'/scenes/golden-hour-dusk.png',anchor:.60,color:'#173d3d',
  water:{outline:[[.29,.81],[.40,.74],[.48,.71],[.51,.67],[.61,.65],[.77,.71],[.88,.73],[.84,.87],[.70,1],[.48,.98],[.39,.94]]},
  lamps:[],birds:'#34515a',
  effect:'pollen',
  light:t=>{const l=meadowLightAt(t);return {...l,foreground:l.clearing};},
  regions:(u,v)=>{
    const frame=Math.max(1-smooth((u-.24)/.15),smooth((u-.83)/.14));
    const near=Math.max(frame,smooth((v-.46)/.22));
    const sky=(1-smooth((v-.19)/.18))*(1-near);
    return [sky,Math.max(0,1-near-sky),near];
  },
  environment:{
    events:[{kind:'butterflies',slot:1,duration:65},{kind:'butterflies',slot:4,duration:65},{kind:'birds',slot:6,duration:38}],
    weather:({progress,dusk})=>.82+.16*Math.sin(Math.PI*progress)-.15*dusk,
  },
  draw:[lantern,fireflies,during('butterflies',butterflies),during('birds',birds('#435146'))],
  ambience:{trim:0.24,texture:(_white,brown,_soft,phase)=>brown*(0.22+0.06*Math.sin(phase*2))},
  music:{style:'lofi',salt:2,titles:['Honey Light','Dandelion Days','Cloud Watching','Sunday Pages','Golden Hour','Slow Morning'],tempo:76},
} as const satisfies Place;
