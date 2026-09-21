import {SCENES} from './edition';

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};

/** Light leaves the clearing before the blue hour reaches the water. */
export function meadowLightAt(seconds:number) {
  const t=Math.max(0,Number.isFinite(seconds)?seconds:0);
  return {
    sky:smooth(t/3000),distance:smooth((t-180)/2820),
    clearing:smooth((t-60)/2460),water:smooth((t-240)/2700),
    lamps:smooth((t-1500)/1380),fireflies:smooth((t-1700)/1100),
    caption:t<900?'Sun through the branches':t<1800?'The sunlight slips away':t<2700?'Blue hour by the water':'Lantern light and fireflies',
    subtitle:t<1200?'A little longer in the afternoon.':t<2400?'Stay while the light changes.':'A little light, just for you.',
  };
}

type Painting=HTMLImageElement|HTMLCanvasElement;
const MASK_WIDTH=256,MASK_HEIGHT=144;

/** One cached composite, a small alpha field and two matched paintings.
 * Soft spatial regions give the clearing, mountains, sky and reflections their
 * own pace. The water animator samples this same composite, never the old sun.
 * Rebuild at most once every two scene-seconds, not on every animation frame. */
export class MeadowLight {
  private painting=document.createElement('canvas');
  private mask=document.createElement('canvas');
  private zones:Float32Array;
  private pixels:ImageData;
  private lastStep=-1;

  constructor(private day:HTMLImageElement,private dusk:HTMLImageElement) {
    this.painting.width=day.naturalWidth;this.painting.height=day.naturalHeight;
    this.mask.width=MASK_WIDTH;this.mask.height=MASK_HEIGHT;
    this.pixels=new ImageData(MASK_WIDTH,MASK_HEIGHT);
    this.zones=new Float32Array(MASK_WIDTH*MASK_HEIGHT*4);
    const water=SCENES.meadow.water;
    for(let y=0;y<MASK_HEIGHT;y++)for(let x=0;x<MASK_WIDTH;x++) {
      const u=(x+.5)/MASK_WIDTH,v=(y+.5)/MASK_HEIGHT,index=(y*MASK_WIDTH+x)*4;
      let pond=false;
      for(let i=0,j=water.length-1;i<water.length;j=i++) {
        const [xi,yi]=water[i],[xj,yj]=water[j];
        if((yi>v)!==(yj>v)&&u<(xj-xi)*(v-yi)/(yj-yi)+xi)pond=!pond;
      }
      // The nearby arch and tree frame the distant sky; transitions stay soft.
      const frame=Math.max(1-smooth((u-.24)/.15),smooth((u-.83)/.14));
      const near=Math.max(frame,smooth((v-.46)/.22));
      const sky=(1-smooth((v-.19)/.18))*(1-near);
      this.zones[index]=pond?0:sky;
      this.zones[index+1]=pond?0:1-near-sky;
      this.zones[index+2]=pond?0:near;
      this.zones[index+3]=pond?1:0;
    }
  }

  frame(seconds:number):Painting {
    if(seconds<=0)return this.day;
    const step=Math.floor(Math.min(3600,seconds)/2);
    if(step===this.lastStep)return this.painting;
    this.lastStep=step;
    const light=meadowLightAt(step*2),levels=[light.sky,light.distance,light.clearing,light.water];
    for(let i=0;i<this.pixels.data.length;i+=4) {
      this.pixels.data[i]=this.pixels.data[i+1]=this.pixels.data[i+2]=255;
      this.pixels.data[i+3]=Math.round(255*levels.reduce((sum,value,j)=>sum+value*this.zones[i+j],0));
    }
    const mask=this.mask.getContext('2d')!,ctx=this.painting.getContext('2d')!;
    mask.putImageData(this.pixels,0,0);
    ctx.clearRect(0,0,this.painting.width,this.painting.height);
    ctx.globalCompositeOperation='source-over';
    ctx.drawImage(this.dusk,0,0,this.painting.width,this.painting.height);
    ctx.globalCompositeOperation='destination-in';
    ctx.drawImage(this.mask,0,0,this.painting.width,this.painting.height);
    ctx.globalCompositeOperation='destination-over';ctx.drawImage(this.day,0,0);
    ctx.globalCompositeOperation='source-over';
    return this.painting;
  }

  dispose():void {this.painting.width=this.painting.height=this.mask.width=this.mask.height=1;}
}
