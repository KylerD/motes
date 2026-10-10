import {describe,expect,it} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {SCENES,SCENE_IDS,placePath,sceneFromPath} from '../src/scenes/edition';
import {PAGES,SITE,madeMeta,pageMeta,sitemap,withMeta} from '../src/share/pages';

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
    expect(tag(html,'name','twitter:image:alt')).toBe(meta.imageAlt);
    expect(html).toContain(`<link rel="canonical" href="${SITE}${placePath(scene)}" />`);
    expect(html).toContain(`<link rel="preload" as="image" href="${SCENES[scene].image}.avif" type="image/avif" fetchpriority="high" />`);
    expect(existsSync(`public/scenes/og/${SCENES[scene].slug}.jpg`)).toBe(true);
  });
  it.each(SCENE_IDS)('%s says its own words before any script runs',scene=>{
    const html=withMeta(index,pageMeta(scene));
    expect(html).toContain(`<h2 id="scene-title">${SCENES[scene].title}</h2>`);
    expect(html).toContain(`<p id="scene-subtitle">${SCENES[scene].subtitle}</p>`);
  });
  it('keeps the home page as today’s edition',()=>{
    const meta=pageMeta(),html=withMeta(index,meta);
    expect(tag(html,'property','og:url')).toBe(`${SITE}/`);
    expect(html).not.toContain('rel="preload" as="image"');
    expect(withMeta(index,meta)).toBe(index);
  });
  it('gives the made page its own preview, kept in step with pages.ts',()=>{
    const made=readFileSync('made/index.html','utf8'),html=withMeta(made,madeMeta);
    expect(html).toBe(made);
    expect(html).toContain(`<title>${madeMeta.title}</title>`);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/made/" />`);
    expect(tag(html,'property','og:url')).toBe(`${SITE}/made/`);
    expect(tag(html,'property','og:image')).toBe(`${SITE}/scenes/og/made.jpg`);
    expect(tag(html,'name','twitter:card')).toBe('summary_large_image');
    expect(html).not.toContain('rel="preload" as="image"');
    expect(tag(html,'name','twitter:image:alt')).toBe(madeMeta.imageAlt);
    expect(existsSync('public/scenes/og/made.jpg')).toBe(true);
  });
});

describe('search',()=>{
  it('lists every page in the sitemap at its canonical address',()=>{
    const locs=[...sitemap().matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
    expect(locs).toEqual([`${SITE}/`,...SCENE_IDS.map(scene=>`${SITE}${placePath(scene)}`),`${SITE}/made/`]);
    expect(PAGES.map(page=>`${SITE}${page.path}`)).toEqual(locs);
  });
  it('points crawlers at the sitemap',()=>{
    expect(readFileSync('public/robots.txt','utf8')).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
  it('names the site for search results on the home page',()=>{
    const json=/<script type="application\/ld\+json">([^<]+)<\/script>/.exec(index)?.[1];
    expect(JSON.parse(json??'{}')).toMatchObject({'@type':'WebSite',name:'Motes',url:`${SITE}/`});
  });
});
