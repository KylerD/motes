/** Paintings are served finished, in two tiers: base (the masters' 1672 width) for first paint
 * everywhere, and full (3840) for screens whose painting covers more device pixels than base has.
 * Each browser receives the lightest format it can decode. A painting is named without an
 * extension (`/scenes/neon-rain`); scripts/finish.py and scripts/encode-scenes.mjs make the files. */
export const PAINTING_FORMATS=['avif','webp'] as const;
export type Tier='base'|'full';
export const TIER_WIDTH:Record<Tier,number>={base:1672,full:3840};

export const paintingUrl=(name:string,format:typeof PAINTING_FORMATS[number],tier:Tier='base')=>
  `${name}${tier==='full'?`@${TIER_WIDTH.full}`:''}.${format}`;

export function createPaintingLoader() {
  // Formats before this index failed while a later one decoded, so they are skipped.
  let first=0;
  return {
    load(image:HTMLImageElement,name:string,failed:()=>void,tier:Tier='base'):void {
      const formats=PAINTING_FORMATS.slice(first),loaded=image.onload;let index=0;
      image.onload=function(this:GlobalEventHandlers,event:Event) {
        const format=PAINTING_FORMATS.indexOf(formats[index]);
        if(format>first)first=format;
        loaded?.call(this,event);
      };
      image.onerror=()=>{if(++index<formats.length)image.src=paintingUrl(name,formats[index],tier);else failed();};
      image.src=paintingUrl(name,formats[0],tier);
    },
  };
}

const shared=createPaintingLoader();
export const loadPainting=(image:HTMLImageElement,name:string,failed:()=>void,tier:Tier='base')=>shared.load(image,name,failed,tier);

export interface TierDevice { finePointer:boolean; saveData?:boolean; effectiveType?:string }

/** The upgrade rule: a desktop pointer, a painting that covers more device pixels than base has
 * (with 15% grace, since a slight stretch reads fine), and no data saving or connection slower than 4G. */
export function wantsFullTier(covered:number,device:TierDevice):boolean {
  return device.finePointer&&covered>1.15*TIER_WIDTH.base&&!device.saveData&&(device.effectiveType??'4g')==='4g';
}

export function tierDevice():TierDevice {
  const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection;
  return {finePointer:matchMedia('(pointer: fine)').matches,saveData:connection?.saveData,effectiveType:connection?.effectiveType};
}
