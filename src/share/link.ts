import {SCENES,placePath,type SceneId} from '../scenes/edition';

/** A link to this place, marked so arrivals from shares can be counted. Today's
 * edition is the plain place page; a revisited day keeps its date. */
export function shareLink(origin:string,scene:SceneId,day:string,today:string):string {
  const url=new URL(placePath(scene),origin);
  if(day!==today)url.searchParams.set('day',day);
  url.searchParams.set('ref','share');
  return url.href;
}

export function shareMessage(scene:SceneId):{title:string;text:string} {
  const place=SCENES[scene];
  return {title:`${place.name} · Motes`,text:`${place.title} ${place.subtitle}`};
}
