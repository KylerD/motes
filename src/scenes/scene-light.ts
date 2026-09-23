import {SCENES,type SceneId} from './edition';
import {meadowLightAt} from './meadow-light';

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
type Regions=readonly [sky:number,distance:number,foreground:number,water:number];
type Timing=readonly [start:number,duration:number];

const evenings:Record<Exclude<SceneId,'meadow'>,{
  timing:readonly [Timing,Timing,Timing,Timing];lamps:Timing;
  captions:readonly string[];subtitles:readonly string[];
}>={
  rain:{
    timing:[[0,2400],[150,2550],[300,2700],[240,2700]],lamps:[600,1800],
    captions:['Rain on the rooftops','Blue fades from the clouds','Neon in the water','A quieter kind of night'],
    subtitles:['The rest of the world can wait.','Stay until the shower passes.','A warm window above the city.'],
  },
  snow:{
    timing:[[0,2640],[180,2760],[480,2520],[300,2700]],lamps:[600,1800],
    captions:['Snowfall at the station','Last pink on the mountains','Blue snow, amber windows','Lamplight along the platform'],
    subtitles:['Somewhere warm, along the way.','The valley settles into blue.','There is still a light on.'],
  },
  coast:{
    // The sun and its reflection leave together; the sheltered room follows later.
    timing:[[0,2460],[120,2760],[300,2700],[0,2460]],lamps:[900,1800],
    captions:['A sea breeze at sunset','The last light on the bay','The harbour turns blue','Lamplight and a silver sea'],
    subtitles:['An evening with nowhere to go.','Stay while the bay grows quiet.','Enough light for another chapter.'],
  },
};

/** Each place has a written lighting arc, held at its final state after an hour. */
export function sceneLightAt(scene:SceneId,seconds:number) {
  const t=Math.max(0,Number.isFinite(seconds)?seconds:0);
  if(scene==='meadow') {
    const light=meadowLightAt(t);
    return {...light,foreground:light.clearing};
  }
  const arc=evenings[scene];
  const [sky,distance,foreground,water]=arc.timing.map(([start,duration])=>smooth((t-start)/duration));
  return {sky,distance,foreground,water,lamps:smooth((t-arc.lamps[0])/arc.lamps[1]),
    caption:arc.captions[Math.min(3,Math.floor(t/900))],
    subtitle:arc.subtitles[Math.min(2,Math.floor(t/1200))]};
}

/** Soft regions in original painting coordinates, independent of viewport crops. */
export function sceneLightWeights(scene:SceneId,u:number,v:number):Regions {
  const water=SCENES[scene].water;
  let wet=false;
  for(let i=0,j=water.length-1;i<water.length;j=i++) {
    const [xi,yi]=water[i],[xj,yj]=water[j];
    if((yi>v)!==(yj>v)&&u<(xj-xi)*(v-yi)/(yj-yi)+xi)wet=!wet;
  }
  if(wet)return [0,0,0,1];
  let near:number,sky:number;
  if(scene==='meadow') {
    const frame=Math.max(1-smooth((u-.24)/.15),smooth((u-.83)/.14));
    near=Math.max(frame,smooth((v-.46)/.22));
    sky=(1-smooth((v-.19)/.18))*(1-near);
  } else if(scene==='rain') {
    near=Math.max(1-smooth((u-.28)/.19),smooth((v-.59)/.18));
    sky=(1-smooth((v-.20)/.15))*(1-near);
  } else if(scene==='snow') {
    near=Math.max(1-smooth((u-.30)/.15),smooth((v-.58)/.22));
    sky=(1-smooth((v-.20)/.16))*(1-near);
  } else {
    const frame=Math.max(1-smooth((u-.30)/.12),smooth((u-.87)/.09));
    near=Math.max(frame,smooth((v-.65)/.20));
    sky=(1-smooth((v-.24)/.11))*(1-near);
  }
  return [sky,Math.max(0,1-near-sky),near,0];
}

type Painting=HTMLImageElement|HTMLCanvasElement;
const MASK_WIDTH=256,MASK_HEIGHT=144;

/** One full-size composite for the active place, rebuilt at most every two
 * scene-seconds. Water displacement reads this same changing painting. */
export class SceneLight {
  private painting=document.createElement('canvas');
  private mask=document.createElement('canvas');
  private zones=new Float32Array(MASK_WIDTH*MASK_HEIGHT*4);
  private pixels=new ImageData(MASK_WIDTH,MASK_HEIGHT);
  private lastStep=-1;

  constructor(private scene:SceneId,private arrival:HTMLImageElement,private evening:HTMLImageElement) {
    this.painting.width=arrival.naturalWidth;this.painting.height=arrival.naturalHeight;
    this.mask.width=MASK_WIDTH;this.mask.height=MASK_HEIGHT;
    for(let y=0;y<MASK_HEIGHT;y++)for(let x=0;x<MASK_WIDTH;x++) {
      this.zones.set(sceneLightWeights(scene,(x+.5)/MASK_WIDTH,(y+.5)/MASK_HEIGHT),(y*MASK_WIDTH+x)*4);
    }
  }

  frame(seconds:number):Painting {
    if(!Number.isFinite(seconds)||seconds<=0)return this.arrival;
    const step=Math.floor(Math.min(3600,seconds)/2);
    if(step===this.lastStep)return this.painting;
    this.lastStep=step;
    const light=sceneLightAt(this.scene,step*2),levels=[light.sky,light.distance,light.foreground,light.water];
    for(let i=0;i<this.pixels.data.length;i+=4) {
      this.pixels.data[i]=this.pixels.data[i+1]=this.pixels.data[i+2]=255;
      this.pixels.data[i+3]=Math.round(255*levels.reduce((sum,value,j)=>sum+value*this.zones[i+j],0));
    }
    const mask=this.mask.getContext('2d')!,ctx=this.painting.getContext('2d')!;
    mask.putImageData(this.pixels,0,0);
    ctx.clearRect(0,0,this.painting.width,this.painting.height);
    ctx.globalCompositeOperation='source-over';
    ctx.drawImage(this.evening,0,0,this.painting.width,this.painting.height);
    ctx.globalCompositeOperation='destination-in';
    ctx.drawImage(this.mask,0,0,this.painting.width,this.painting.height);
    ctx.globalCompositeOperation='destination-over';ctx.drawImage(this.arrival,0,0);
    ctx.globalCompositeOperation='source-over';
    return this.painting;
  }

  dispose():void {this.painting.width=this.painting.height=this.mask.width=this.mask.height=1;}
}
