import type {Place,Point} from './index';
import {arc,smooth} from './light';
import {windows} from '../scenes/session-effects';

// These centres are painted windows, not random points over roofs or trees.
const rainSpots:readonly Point[]=[[.440,.434],[.450,.434],[.505,.477],[.521,.518],[.594,.47],[.613,.47],[.770,.56],[.778,.562],[.896,.411],[.904,.412]];
const rainFixtures:readonly Point[]=[[.312,.321]];

export default {
  id:'rain',name:'Neon rain',title:'Rain, above the city.',weather:'Rain on the rooftops',
  lights:['Blue hour, soft rain','A passing shower','City lights, late evening'],
  image:'/scenes/neon-rain.png',eveningImage:'/scenes/neon-rain-night.png',anchor:.43,color:'#071b38',
  water:{outline:[[.16,.82],[.23,.745],[.41,.657],[.52,.625],[.66,.667],[.774,.706],[.717,.813],[.651,.944],[.45,.98],[.253,.915]],tint:'#bcecff'},
  lamps:rainFixtures,
  effect:'rain',
  fallback:{tint:'#e7a1bf',depth:.085},
  light:arc({
    timing:[[0,2400],[150,2550],[300,2700],[240,2700]],lamps:[600,1800],
    captions:['Rain on the rooftops','Blue fades from the clouds','Neon in the water','A quieter kind of night'],
    subtitles:['The rest of the world can wait.','Stay until the shower passes.','A warm window above the city.'],
  }),
  regions:(u,v)=>{
    const near=Math.max(1-smooth((u-.28)/.19),smooth((v-.59)/.18));
    const sky=(1-smooth((v-.20)/.15))*(1-near);
    return [sky,Math.max(0,1-near-sky),near];
  },
  environment:{
    events:[{kind:'shower',slot:5,duration:280},{kind:'windows',slot:12,duration:120}],
    weather:({progress,dusk,events})=>.88+.38*Math.sin(Math.PI*progress)-.28*dusk+.36*(events.find(e=>e.kind==='shower')?.strength??0),
  },
  draw:[windows(rainSpots,rainFixtures)],
  ambience:{trim:0.14,texture:(white,_brown,soft)=>white*0.025+soft*0.27},
  music:{style:'lofi',salt:1,titles:['Window Seat','After the Rain','Blue Hour','Last Train','Umbrella Waltz','Warm Windows'],tempo:72},
} as const satisfies Place;
