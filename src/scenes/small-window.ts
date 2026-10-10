/** A small always-on-top window for the scene (Document Picture-in-Picture: Chrome and Edge
 * on desktop). The page's own canvas moves into it and back, so the picture keeps one
 * renderer, one lighting composite and one set of paintings. TypeScript's DOM library leaves
 * out Chromium-only APIs, so the part used here is declared. */
interface DocumentPictureInPicture { requestWindow(options:{width:number;height:number}):Promise<Window> }
const picture=()=>(window as Window&{documentPictureInPicture?:DocumentPictureInPicture}).documentPictureInPicture;

export const canOpenSmallWindow=():boolean=>!!picture()&&window.top===window;

export interface SmallWindow { readonly window:Window; readonly listen:HTMLButtonElement; close():void }

/** Opens the window (it needs the click that asked for it) and moves the canvas in. Closing the
 * window by any means, the browser's own buttons included, puts the canvas back where it was. */
export async function openSmallWindow(canvas:HTMLCanvasElement,{title,onListen,onClose}:{title:string;onListen:()=>void;onClose:()=>void}):Promise<SmallWindow> {
  const api=picture();
  if(!api)throw new DOMException('A small window is not available here.','NotSupportedError');
  // 16:9, the paintings' shape. The browser remembers any size and place the listener gives it.
  const small=await api.requestWindow({width:512,height:288}),doc=small.document;
  doc.documentElement.lang='en';doc.title=title;
  // The page's own rules, tokens and fonts; paths in them resolve against the page, not about:blank.
  const base=doc.createElement('base');base.href=location.href;doc.head.append(base);
  for(const sheet of Array.from(document.styleSheets)) {
    try{const style=doc.createElement('style');style.textContent=Array.from(sheet.cssRules,rule=>rule.cssText).join('\n');doc.head.append(style);}
    catch{/* Only the page's own same-origin sheets are read. */}
  }
  doc.body.className='small-window';
  const listen=doc.createElement('button');listen.className='small-window-listen';
  listen.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z"/></svg>';
  listen.addEventListener('click',onListen);
  // Space toggles the music here as it does on the page; a focused button handles its own.
  doc.addEventListener('keydown',event=>{if(event.code==='Space'&&!(event.target as Element).closest?.('button')){event.preventDefault();onListen();}});
  const home=canvas.parentNode!,next=canvas.nextSibling;
  small.addEventListener('pagehide',()=>{home.insertBefore(canvas,next?.parentNode===home?next:null);onClose();},{once:true});
  doc.body.append(canvas,listen);
  return {window:small,listen,close:()=>small.close()};
}
