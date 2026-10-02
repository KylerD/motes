import {describe,expect,it} from 'vitest';
import {existsSync} from 'node:fs';
import {SCENES,SCENE_IDS} from '../src/scenes/edition';
import {createPaintingLoader,PAINTING_FORMATS} from '../src/scenes/painting-source';

class FakeImage {
  onload:(()=>void)|null=null;onerror:(()=>void)|null=null;requested:string[]=[];
  set src(value:string){this.requested.push(value);}
  get src(){return this.requested.at(-1)??'';}
}
const fail=(image:FakeImage)=>image.onerror?.();
const succeed=(image:FakeImage)=>image.onload?.();

describe('painting sources',()=>{
  it('asks for the lightest format first, beside the original PNG master',()=>{
    const loader=createPaintingLoader(),image=new FakeImage();
    loader.load(image as unknown as HTMLImageElement,'/scenes/neon-rain.png',()=>{});
    expect(image.requested).toEqual(['/scenes/neon-rain.avif']);
  });
  it('falls back through WebP to the PNG master before reporting a failure',()=>{
    const loader=createPaintingLoader(),image=new FakeImage();let failures=0;
    loader.load(image as unknown as HTMLImageElement,'/scenes/neon-rain.png',()=>failures++);
    fail(image);fail(image);expect(failures).toBe(0);
    expect(image.requested).toEqual(['/scenes/neon-rain.avif','/scenes/neon-rain.webp','/scenes/neon-rain.png']);
    fail(image);expect(failures).toBe(1);
  });
  it('keeps the page’s own load handler for the image that finally arrives',()=>{
    const loader=createPaintingLoader(),image=new FakeImage();let loaded=0;
    image.onload=()=>loaded++;
    loader.load(image as unknown as HTMLImageElement,'/scenes/golden-hour.png',()=>{});
    fail(image);succeed(image);expect(loaded).toBe(1);
  });
  it('skips a format this browser could not decode once a later one works',()=>{
    const loader=createPaintingLoader(),first=new FakeImage(),second=new FakeImage();
    loader.load(first as unknown as HTMLImageElement,'/scenes/neon-rain.png',()=>{});fail(first);succeed(first);
    loader.load(second as unknown as HTMLImageElement,'/scenes/golden-hour.png',()=>{});
    expect(second.requested).toEqual(['/scenes/golden-hour.webp']);
  });
  it('does not give up on a format when every source failed, so a retry can use it',()=>{
    const loader=createPaintingLoader(),first=new FakeImage(),retry=new FakeImage();
    loader.load(first as unknown as HTMLImageElement,'/scenes/neon-rain.png',()=>{});fail(first);fail(first);fail(first);
    loader.load(retry as unknown as HTMLImageElement,'/scenes/neon-rain.png',()=>{});
    expect(retry.requested).toEqual(['/scenes/neon-rain.avif']);
  });
  it.each(SCENE_IDS)('%s ships every format for both paintings',scene=>{
    for(const master of [SCENES[scene].image,SCENES[scene].eveningImage])
      for(const format of PAINTING_FORMATS)expect(existsSync(`public${master.replace(/\.png$/,`.${format}`)}`)).toBe(true);
  });
});
