/** Paintings ship as AVIF and WebP beside their original PNG masters. Each browser
 * receives the lightest format it can decode; the master remains the last resort.
 * Encoded copies are made by scripts/encode-scenes.mjs. */
export const PAINTING_FORMATS=['avif','webp','png'] as const;

export function createPaintingLoader() {
  // Formats before this index failed while a later one decoded, so they are skipped.
  let first=0;
  return {
    load(image:HTMLImageElement,master:string,failed:()=>void):void {
      const formats=PAINTING_FORMATS.slice(first),loaded=image.onload;let index=0;
      image.onload=function(this:GlobalEventHandlers,event:Event) {
        const format=PAINTING_FORMATS.indexOf(formats[index]);
        if(format>first)first=format;
        loaded?.call(this,event);
      };
      image.onerror=()=>{if(++index<formats.length)image.src=master.replace(/\.png$/,`.${formats[index]}`);else failed();};
      image.src=master.replace(/\.png$/,`.${formats[0]}`);
    },
  };
}

const shared=createPaintingLoader();
export const loadPainting=(image:HTMLImageElement,master:string,failed:()=>void)=>shared.load(image,master,failed);
