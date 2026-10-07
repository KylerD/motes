/** Milestone events to PostHog's capture API in cookieless mode: PostHog derives a
 * daily, salted visitor hash on its servers and nothing identifying is stored or sent.
 * Inert unless both build variables are set and the page is served over HTTPS, so local
 * dev servers and score runs send nothing; silent when the browser or listener declines. */
const env=(import.meta as ImportMeta & {env:Record<string,string|undefined>}).env;
const key=env.VITE_POSTHOG_KEY,host=env.VITE_POSTHOG_HOST?.replace(/\/$/,'');
const configured=!!key&&!!host&&location.protocol==='https:';
const browserDeclines=(navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl===true||navigator.doNotTrack==='1';

/** This week's listening record (see listening.ts), kept only while counting is on. */
export const WEEK_KEY='motes-week';
/** The listener's "stop counting" choice from How Motes is made. Remembering it is all it stores. */
const OPT_OUT_KEY='motes-counting';
const readOptOut=()=>{try{return localStorage.getItem(OPT_OUT_KEY)==='off';}catch{return false;}};
let optedOut=readOptOut();
// A choice made in another tab applies here at once, so an open radio stops counting too.
addEventListener('storage',event=>{if(event.key===OPT_OUT_KEY||event.key===null)optedOut=readOptOut();});

export const measuring=():boolean=>configured&&!browserDeclines&&!optedOut;
export const counting=():'on'|'off'|'declined'=>browserDeclines?'declined':optedOut?'off':'on';

/** Turning counting off forgets the week record; turning it on starts as a new browser. */
export function setCounting(on:boolean):void {
  optedOut=!on;
  try {
    if(on)localStorage.removeItem(OPT_OUT_KEY);
    else{localStorage.setItem(OPT_OUT_KEY,'off');localStorage.removeItem(WEEK_KEY);}
  } catch { /* Without storage the choice holds for this page only. */ }
}

export function track(event:string,properties:Record<string,string|number|boolean|undefined>={}):void {
  if(!measuring())return;
  const body=JSON.stringify({api_key:key,event,distinct_id:'$posthog_cookieless',timestamp:new Date().toISOString(),properties:{
    $process_person_profile:false,$lib:'motes',$raw_user_agent:navigator.userAgent,$host:location.host,
    $pathname:location.pathname,$current_url:location.origin+location.pathname,...properties,
  }});
  // keepalive lets the last milestone leave with a closing tab.
  void fetch(`${host}/i/v0/e/`,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>undefined);
}

/** The `ref` an arriving link carried, when it looks like one of ours rather than arbitrary text. */
export const refOf=(params:URLSearchParams):string|undefined=>/^[\w-]{1,32}$/.test(params.get('ref')??'')?params.get('ref')!:undefined;
