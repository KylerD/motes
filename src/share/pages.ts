import {SCENES,placePath,type SceneId} from '../scenes/edition';

/** Link previews are read by crawlers that never run the page, so every place is
 * built as its own static page carrying its own title, description and card. */
export const SITE='https://motes.sh';

export interface PageMeta { title:string; description:string; path:string; image:string; imageAlt:string; painting?:string }

const descriptions:Record<SceneId,string>={
  rain:'A rooftop tea shelter above a rainy neon city. Stay an hour and it turns to evening, with warm lofi composed live in your browser.',
  meadow:'A stone sanctuary in a golden meadow. Stay an hour and the sun gives way to lanterns and fireflies, with warm lofi composed live in your browser.',
  snow:'A snowy mountain station with a warm café window. Stay an hour and the last light leaves the peaks, with warm lofi composed live in your browser.',
  coast:'A reading nook above the bay at sunset. Stay an hour and the harbour turns silver-blue, with warm lofi composed live in your browser.',
};

export function pageMeta(scene?:SceneId):PageMeta {
  if(!scene)return {
    title:'Motes — somewhere to slow down',
    description:'Beautiful living scenes, warm jazzy beats and a new atmosphere every day. A place to leave the world on quiet.',
    path:'/',image:'/scenes/og/neon-rain.jpg',imageAlt:'A rainy neon rooftop shelter turning from blue hour to evening.',
  };
  const place=SCENES[scene];
  return {
    title:`${place.name} · Motes`,description:descriptions[scene],path:placePath(scene),
    image:`/scenes/og/${place.slug}.jpg`,imageAlt:`${place.name}, from arrival to evening.`,
    painting:place.image.replace(/\.png$/,'.avif'),
  };
}

const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const setMeta=(html:string,attribute:'name'|'property',key:string,value:string)=>
  html.replace(new RegExp(`(<meta ${attribute}="${key}" content=")[^"]*(")`),`$1${escape(value)}$2`);

/** Rewrites index.html's preview tags for one page. */
export function withMeta(html:string,meta:PageMeta):string {
  let out=html.replace(/<title>[^<]*<\/title>/,`<title>${escape(meta.title)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/,`$1${SITE}${meta.path}$2`);
  for(const [attribute,key,value] of [
    ['name','description',meta.description],['property','og:title',meta.title],['property','og:description',meta.description],
    ['property','og:url',`${SITE}${meta.path}`],['property','og:image',`${SITE}${meta.image}`],['property','og:image:alt',meta.imageAlt],
    ['name','twitter:title',meta.title],['name','twitter:description',meta.description],['name','twitter:image',`${SITE}${meta.image}`],
  ] as const)out=setMeta(out,attribute,key,value);
  // A place page knows its painting before any script runs.
  if(meta.painting)out=out.replace('</head>',`  <link rel="preload" as="image" href="${meta.painting}" type="image/avif" fetchpriority="high" />\n</head>`);
  return out;
}
