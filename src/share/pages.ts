import {SCENES,SCENE_IDS,placePath,type SceneId} from '../scenes/edition';
import {paintingUrl} from '../scenes/painting-source';

/** Link previews are read by crawlers that never run the page, so every place is
 * built as its own static page carrying its own title, description, card and caption. */
export const SITE='https://motes.sh';

export interface PageMeta { title:string; description:string; path:string; image:string; imageAlt:string; painting?:string; caption?:{title:string;subtitle:string} }

const descriptions:Record<SceneId,string>={
  rain:'A rooftop tea shelter above a rainy neon city. Stay an hour and it turns to evening, with warm lofi composed live in your browser.',
  meadow:'A stone sanctuary in a golden meadow. Stay an hour and the sun gives way to lanterns and fireflies, with warm lofi composed live in your browser.',
  snow:'A snowy mountain station with a warm café window. Stay an hour and the last light leaves the peaks, with warm lofi composed live in your browser.',
  coast:'A reading nook above the bay at sunset. Stay an hour and the harbour turns silver-blue, with warm lofi composed live in your browser.',
};

export function pageMeta(scene?:SceneId):PageMeta {
  if(!scene)return {
    title:'Motes — warm lofi and living scenes',
    description:'Beautiful living scenes and warm, jazzy lofi composed live in your browser, with a new atmosphere every day. A place to leave the world on quiet.',
    path:'/',image:'/scenes/og/neon-rain.jpg',imageAlt:'A rainy neon rooftop shelter turning from blue hour to evening.',
  };
  const place=SCENES[scene];
  return {
    title:`${place.name} · Motes`,description:descriptions[scene],path:placePath(scene),
    image:`/scenes/og/${place.slug}.jpg`,imageAlt:`${place.name}, from arrival to evening.`,
    painting:paintingUrl(place.image,'avif'),caption:{title:place.title,subtitle:place.subtitle},
  };
}

/** The plain account of what made Motes: the music, the paintings, the code, privacy and licences. */
export const madeMeta:PageMeta={
  title:'How Motes is made',
  description:'How the music, the paintings and the living light of Motes are made, what is measured, and the licences.',
  path:'/made/',image:'/scenes/og/made.jpg',
  imageAlt:'The four Motes places side by side: a rainy rooftop, a golden meadow, a snowy station and a bay at sunset.',
};

const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const setMeta=(html:string,attribute:'name'|'property',key:string,value:string)=>
  html.replace(new RegExp(`(<meta ${attribute}="${key}" content=")[^"]*(")`),`$1${escape(value)}$2`);

/** Rewrites index.html's preview tags (and a place's caption) for one page. */
export function withMeta(html:string,meta:PageMeta):string {
  let out=html.replace(/<title>[^<]*<\/title>/,`<title>${escape(meta.title)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/,`$1${SITE}${meta.path}$2`);
  for(const [attribute,key,value] of [
    ['name','description',meta.description],['property','og:title',meta.title],['property','og:description',meta.description],
    ['property','og:url',`${SITE}${meta.path}`],['property','og:image',`${SITE}${meta.image}`],['property','og:image:alt',meta.imageAlt],
    ['name','twitter:title',meta.title],['name','twitter:description',meta.description],['name','twitter:image',`${SITE}${meta.image}`],
    ['name','twitter:image:alt',meta.imageAlt],
  ] as const)out=setMeta(out,attribute,key,value);
  // A place page knows its painting and its words before any script runs.
  if(meta.painting)out=out.replace('</head>',`  <link rel="preload" as="image" href="${meta.painting}" type="image/avif" fetchpriority="high" />\n</head>`);
  if(meta.caption)out=out.replace(/(<h2 id="scene-title">)[^<]*(<\/h2>)/,`$1${escape(meta.caption.title)}$2`)
    .replace(/(<p id="scene-subtitle">)[^<]*(<\/p>)/,`$1${escape(meta.caption.subtitle)}$2`);
  return out;
}

/** Every page a search engine should know: home, the four places and How Motes is made. */
export const PAGES:readonly PageMeta[]=[pageMeta(),...SCENE_IDS.map(scene=>pageMeta(scene)),madeMeta];

export function sitemap():string {
  const urls=PAGES.map(page=>`  <url><loc>${SITE}${page.path}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
