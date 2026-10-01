import type {ActiveEvent} from '../session/session';
import type {LayerInput,Place} from './index';
import {arc,clamp,mix,smooth} from './light';
import {birds,during,polygon} from '../scenes/session-effects';

function boat(ctx:CanvasRenderingContext2D,event:ActiveEvent,{time,space}:LayerInput):void {
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

export default {
  id:'coast',name:'The last chapter',title:'One more chapter.',weather:'Waves below the window',
  lights:['A sea breeze at sunset','The tide coming in','Last light over the bay'],
  image:'/scenes/the-last-chapter.png',eveningImage:'/scenes/the-last-chapter-night.png',anchor:.56,color:'#152d40',
  water:{outline:[[.39,.353],[.728,.343],[.683,.428],[.749,.454],[.772,.49],[.884,.544],[.87,.725],[.758,.83],[.73,.763],[.683,.71],[.625,.687],[.59,.636],[.541,.612],[.495,.566],[.469,.498],[.44,.44]],from:.38,shimmer:1.5},
  lamps:[[.061,.452],[.451,.72]],steam:[.084,.587],birds:'#223148',
  fallback:{tint:'#ffbe76',depth:.13},
  light:arc({
    // The sun and its reflection leave together; the sheltered room follows later.
    timing:[[0,2460],[120,2760],[300,2700],[0,2460]],lamps:[900,1800],
    captions:['A sea breeze at sunset','The last light on the bay','The harbour turns blue','Lamplight and a silver sea'],
    subtitles:['An evening with nowhere to go.','Stay while the bay grows quiet.','Enough light for another chapter.'],
  }),
  regions:(u,v)=>{
    const frame=Math.max(1-smooth((u-.30)/.12),smooth((u-.87)/.09));
    const near=Math.max(frame,smooth((v-.65)/.20));
    const sky=(1-smooth((v-.24)/.11))*(1-near);
    return [sky,Math.max(0,1-near-sky),near];
  },
  environment:{
    events:[{kind:'birds',slot:2,duration:38},{kind:'boat',slot:7,duration:150},{kind:'birds',slot:14,duration:35}],
    weather:({progress,dusk})=>.82+.16*Math.sin(Math.PI*progress)-.15*dusk,
  },
  draw:[during('boat',boat),during('birds',birds('#343348'))],
  ambience:{trim:0.14,texture:(_white,brown,soft,phase,channel)=>(brown*0.42+soft*0.26)*(0.45+0.30*Math.sin(phase*3+channel*0.15)+0.12*Math.sin(phase*7))},
  music:{style:'lofi',salt:4,titles:['Saltwater Pages','Low Tide Letters','Sea Glass','Harbour Lights','Driftwood Notes','The Reading Room'],tempo:72},
} as const satisfies Place;
