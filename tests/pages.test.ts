import {describe,expect,it} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {SCENES,SCENE_IDS,placePath,sceneFromPath} from '../src/scenes/edition';
import {SITE,pageMeta,withMeta} from '../src/share/pages';

const index=readFileSync('index.html','utf8');
const tag=(html:string,attribute:string,name:string)=>new RegExp(`<meta ${attribute}="${name}" content="([^"]*)"`).exec(html)?.[1];

describe('place pages',()=>{
  it.each(SCENE_IDS)('%s has a stable shareable path',scene=>{
    expect(placePath(scene)).toBe(`/places/${SCENES[scene].slug}/`);
    expect(sceneFromPath(placePath(scene))).toBe(scene);
    expect(sceneFromPath(placePath(scene).slice(0,-1))).toBe(scene);
  });
  it('ignores paths that are not places',()=>{
    for(const path of ['/','/places/','/places/elsewhere/','/places/neon-rain/extra'])expect(sceneFromPath(path)).toBeUndefined();
  });
  it.each(SCENE_IDS)('%s carries its own link preview',scene=>{
    const meta=pageMeta(scene),html=withMeta(index,meta);
    expect(html).toContain(`<title>${meta.title}</title>`);
    expect(tag(html,'name','description')).toBe(meta.description);
    expect(tag(html,'property','og:title')).toBe(meta.title);
    expect(tag(html,'property','og:url')).toBe(`${SITE}${placePath(scene)}`);
    expect(tag(html,'property','og:image')).toBe(`${SITE}/scenes/og/${SCENES[scene].slug}.jpg`);
    expect(tag(html,'name','twitter:card')).toBe('summary_large_image');
    expect(html).toContain(`<link rel="canonical" href="${SITE}${placePath(scene)}" />`);
    expect(html).toContain(`<link rel="preload" as="image" href="${SCENES[scene].image.replace(/\.png$/,'.avif')}" type="image/avif" fetchpriority="high" />`);
    expect(existsSync(`public/scenes/og/${SCENES[scene].slug}.jpg`)).toBe(true);
  });
  it('keeps the home page as today’s edition',()=>{
    const meta=pageMeta(),html=withMeta(index,meta);
    expect(tag(html,'property','og:url')).toBe(`${SITE}/`);
    expect(html).not.toContain('rel="preload" as="image"');
    expect(withMeta(index,meta)).toBe(index);
  });
});
