import type {ActiveEvent} from '../session/session';
import type {Layer,LayerInput,Place,Point} from './index';
import {arc,clamp,smooth} from './light';
import {during,windows} from '../scenes/session-effects';
import {randomSource} from '../music/composer/random';

// Traced from top-deck.png. These centres are painted tower windows; the fixtures are the two sodium lamp heads.
const deckSpots:readonly Point[]=[[.502,.426],[.800,.203],[.850,.290],[.946,.217],[.797,.239],[.457,.345],[.876,.333],[.522,.448],[.965,.294],[.800,.294]];
const deckFixtures:readonly Point[]=[[.339,.167],[.940,.068]];
const storm=(progress:number)=>smooth((progress-.66)/.18);

/** At most one flash (a double flicker) per 20 s window, a pure function of the seed and environment time. */
export function lightningAt(seed:number,elapsed:number,strength:number,motion:boolean):number {
  if(!motion||elapsed>=3600||strength<=0)return 0;
  const window=Math.floor(elapsed/20),r=randomSource((seed^Math.imul(window+1,0x9e3779b1))>>>0);
  if(r()>strength*.8)return 0;
  const t=elapsed-window*20-(2+r()*14);
  return t>=0&&t<.08?.12*strength:t>=.22&&t<.3?.08*strength:0;
}

/** A car arriving: two soft headlight glows sweep right to left across the wet deck. */
function headlights(ctx:CanvasRenderingContext2D,event:ActiveEvent,{space}:LayerInput):void {
  const p=space.point(.95-.4*event.progress,.78),length=space.iw*.12,reach=length*.55;
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.35*clamp(event.strength);
  for(const offset of [-1,1]){
    // A radial gradient stretched along the beam and focused at the lamp: brightest there, fading ahead and to either side with no edge.
    ctx.save();ctx.translate(p.x-.8*reach,p.y+offset*space.iw*.005);ctx.scale(reach,length*.1);
    const beam=ctx.createRadialGradient(.8,0,0,0,0,1);
    for(const [stop,alpha] of [[0,1],[.3,.85],[.6,.4],[1,0]])beam.addColorStop(stop,`rgba(255,241,214,${alpha})`);
    ctx.fillStyle=beam;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  ctx.restore();
}

/** Storm light in the painting's sky band only (right of the stairwell, above v .33), off with Still and reduced motion. */
const lightning:Layer=(ctx,{state,space,motion,seed})=>{
  const a=lightningAt(seed,state.elapsed,clamp(state.weather/1.1),motion);
  if(a<=0)return;
  const top=space.point(.22,0),bottom=space.point(0,.33).y;
  const sky=ctx.createLinearGradient(0,top.y,0,bottom);
  sky.addColorStop(0,`rgba(214,200,255,${a})`);sky.addColorStop(1,'rgba(214,200,255,0)');
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=1;ctx.fillStyle=sky;ctx.fillRect(top.x,top.y,space.width-top.x,bottom-top.y);ctx.restore();
};

export default {
  id:'deck',name:'Top deck',title:'Park up. Stay a while.',weather:'Neon and a gathering storm',
  lights:['Sunset over the towers','Heat on the concrete','A storm on the horizon'],
  image:'/scenes/top-deck.png',eveningImage:'/scenes/top-deck-night.png',anchor:.43,color:'#1c1433',
  water:{outline:[[.43,.685],[.46,.668],[.55,.662],[.63,.648],[.72,.652],[.80,.668],[.86,.69],[.99,.72],[.99,.87],[.92,.90],[.83,.93],[.70,.90],[.55,.86],[.47,.835],[.39,.82],[.37,.79],[.40,.745]]},
  // The sodium lamps and the coupe's lit cabin.
  lamps:[...deckFixtures,[.227,.475]],effect:'rain',fallback:{tint:'#e79ab8',depth:.1},
  light:arc({timing:[[0,2400],[150,2550],[300,2700],[0,2400]],lamps:[600,1800],
    captions:['Sunset on the top deck','The towers light up','Neon on wet concrete','Storm light over the city'],
    subtitles:['Nowhere to be until morning.','Stay while the city lights up.','The engine can wait.']}),
  // Foreground is the stairwell, the coupe, then the parapet and deck. The sky band holds the sun.
  regions:(u,v)=>{
    const near=Math.max((1-smooth((u-.195)/.025))*smooth((v-.045-.42*u)/.04),(1-smooth((u-.43)/.05))*smooth((v-.42)/.04),smooth((v-.46)/.04));
    const sky=(1-smooth((v-.27)/.08))*(1-near);
    return [sky,Math.max(0,1-near-sky),near];
  },
  // Dry until the storm chapter, rising through it and holding after hours.
  environment:{events:[{kind:'headlights',slot:4,duration:24},{kind:'headlights',slot:10,duration:24},{kind:'windows',slot:13,duration:100}],weather:({progress})=>1.1*storm(progress)},
  draw:[windows(deckSpots,deckFixtures),during('headlights',headlights),lightning],
  // Trim .1 keeps the city hum at least 19 dB under the quietest intro, the slow burner's (verify-mix).
  ambience:{trim:.1,texture:(_white,brown,soft,phase,channel)=>brown*.3+soft*.08*(.6+.4*Math.sin(phase*5+channel*.2))},
  // `tempo` only feeds the lofi standalone arrangement; synthwave songs take theirs from the planned hour.
  music:{style:'synthwave',salt:5,titles:['Sodium Glow','Level Nine','Glass Towers','Ramp Down','Heat Haze','Violet Hour','Concrete Sunset','Low Fuel','Cabin Light','Rooftop Signal'],tempo:120},
} as const satisfies Place;
