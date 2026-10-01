import type {SceneId} from './edition';
import {placeById,type LightState} from '../places';

type Regions=readonly [sky:number,distance:number,foreground:number,water:number];

/** Each place has a written lighting arc, held at its final state after an hour. */
export function sceneLightAt(scene:SceneId,seconds:number):LightState {
  const t=Math.max(0,Number.isFinite(seconds)?seconds:0);
  return placeById(scene).light(t);
}

/** Soft regions in original painting coordinates, independent of viewport crops. */
export function sceneLightWeights(scene:SceneId,u:number,v:number):Regions {
  const place=placeById(scene),water=place.water?.outline??[];
  let wet=false;
  for(let i=0,j=water.length-1;i<water.length;j=i++) {
    const [xi,yi]=water[i],[xj,yj]=water[j];
    if((yi>v)!==(yj>v)&&u<(xj-xi)*(v-yi)/(yj-yi)+xi)wet=!wet;
  }
  if(wet)return [0,0,0,1];
  const [sky,distance,near]=place.regions(u,v);return [sky,distance,near,0];
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
