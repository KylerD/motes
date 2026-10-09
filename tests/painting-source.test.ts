import {describe,expect,it} from 'vitest';
import {existsSync,readdirSync} from 'node:fs';
import {SCENES,SCENE_IDS} from '../src/scenes/edition';
import {createPaintingLoader,paintingUrl,PAINTING_FORMATS,wantsFullTier} from '../src/scenes/painting-source';

class FakeImage {
  onload:(()=>void)|null=null;onerror:(()=>void)|null=null;requested:string[]=[];
  set src(value:string){this.requested.push(value);}
  get src(){return this.requested.at(-1)??'';}
}
const fail=(image:FakeImage)=>image.onerror?.();
const succeed=(image:FakeImage)=>image.onload?.();

describe('painting sources',()=>{
  it('asks for the lightest format first',()=>{
    const loader=createPaintingLoader(),image=new FakeImage();
    loader.load(image as unknown as HTMLImageElement,'/scenes/neon-rain',()=>{});
    expect(image.requested).toEqual(['/scenes/neon-rain.avif']);
  });
  it('falls back to WebP before reporting a failure, and never to an unfinished master',()=>{
    const loader=createPaintingLoader(),image=new FakeImage();let failures=0;
    loader.load(image as unknown as HTMLImageElement,'/scenes/neon-rain',()=>failures++);
    fail(image);expect(failures).toBe(0);
    expect(image.requested).toEqual(['/scenes/neon-rain.avif','/scenes/neon-rain.webp']);
    fail(image);expect(failures).toBe(1);
  });
  it('asks for the full tier by its width',()=>{
    const loader=createPaintingLoader(),image=new FakeImage();
    loader.load(image as unknown as HTMLImageElement,'/scenes/neon-rain-night',()=>{},'full');
    fail(image);
    expect(image.requested).toEqual(['/scenes/neon-rain-night@3840.avif','/scenes/neon-rain-night@3840.webp']);
  });
  it('keeps the page’s own load handler for the image that finally arrives',()=>{
    const loader=createPaintingLoader(),image=new FakeImage();let loaded=0;
    image.onload=()=>loaded++;
    loader.load(image as unknown as HTMLImageElement,'/scenes/golden-hour',()=>{});
    fail(image);succeed(image);expect(loaded).toBe(1);
  });
  it('skips a format this browser could not decode once a later one works',()=>{
    const loader=createPaintingLoader(),first=new FakeImage(),second=new FakeImage();
    loader.load(first as unknown as HTMLImageElement,'/scenes/neon-rain',()=>{});fail(first);succeed(first);
    loader.load(second as unknown as HTMLImageElement,'/scenes/golden-hour',()=>{});
    expect(second.requested).toEqual(['/scenes/golden-hour.webp']);
  });
  it('does not give up on a format when every source failed, so a retry can use it',()=>{
    const loader=createPaintingLoader(),first=new FakeImage(),retry=new FakeImage();
    loader.load(first as unknown as HTMLImageElement,'/scenes/neon-rain',()=>{});fail(first);fail(first);
    loader.load(retry as unknown as HTMLImageElement,'/scenes/neon-rain',()=>{});
    expect(retry.requested).toEqual(['/scenes/neon-rain.avif']);
  });
  it.each(SCENE_IDS)('%s ships every painting finished, in both tiers and both formats',scene=>{
    const place=SCENES[scene];
    for(const name of [place.image,place.eveningImage,place.halloween!.image,place.halloween!.eveningImage])
      for(const tier of ['base','full'] as const)for(const format of PAINTING_FORMATS)
        expect(existsSync(`public${paintingUrl(name,format,tier)}`)).toBe(true);
  });
  it('serves no master: they live in art/scenes',()=>{
    expect(readdirSync('public/scenes').filter(file=>/\.(png|json)$/.test(file))).toEqual([]);
    for(const scene of SCENE_IDS)expect(existsSync(`art${SCENES[scene].image}.png`)).toBe(true);
  });
});

describe('choosing a tier',()=>{
  const desktop={finePointer:true};
  it('upgrades when the painting covers more device pixels than base has',()=>{
    expect(wantsFullTier(2560,desktop)).toBe(true);           // 2560×1440 at 1×
    expect(wantsFullTier(1599*1.78,desktop)).toBe(true);      // a 1440×900 laptop at 2×, under the 2560 bitmap cap
    expect(wantsFullTier(1920,desktop)).toBe(false);          // 1080p: within 15% of base
  });
  it('never upgrades a phone or tablet, data saving or a slow connection',()=>{
    expect(wantsFullTier(2560,{finePointer:false})).toBe(false);
    expect(wantsFullTier(2560,{...desktop,saveData:true})).toBe(false);
    for(const effectiveType of ['slow-2g','2g','3g'])expect(wantsFullTier(2560,{...desktop,effectiveType})).toBe(false);
    expect(wantsFullTier(2560,{...desktop,effectiveType:'4g'})).toBe(true);
  });
});
