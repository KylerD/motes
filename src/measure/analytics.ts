/** Milestone events to PostHog's capture API in cookieless mode: PostHog derives a
 * daily, salted visitor hash on its servers and nothing identifying is stored or sent.
 * Inert unless both build variables are set, or when the browser asks not to be tracked. */
const env=(import.meta as ImportMeta & {env:Record<string,string|undefined>}).env;
const key=env.VITE_POSTHOG_KEY,host=env.VITE_POSTHOG_HOST?.replace(/\/$/,'');
const declined=(navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl===true||navigator.doNotTrack==='1';

export const measuring=!!key&&!!host&&!declined;

export function track(event:string,properties:Record<string,string|number|boolean|undefined>={}):void {
  if(!measuring)return;
  const body=JSON.stringify({api_key:key,event,distinct_id:'$posthog_cookieless',timestamp:new Date().toISOString(),properties:{
    $process_person_profile:false,$lib:'motes',$raw_user_agent:navigator.userAgent,$host:location.host,
    $pathname:location.pathname,$current_url:location.origin+location.pathname,...properties,
  }});
  // keepalive lets the last milestone leave with a closing tab.
  void fetch(`${host}/i/v0/e/`,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>undefined);
}
