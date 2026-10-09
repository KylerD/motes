import {describe,it,expect} from 'vitest';
import {edition,seasonOf,seasonalWords,arrivalImage,eveningImage,SCENES,SCENE_IDS} from '../src/scenes/edition';
import {createSession,composeSessionTrack} from '../src/session/session';
import {MELODY_CELLS,HALLOWEEN_THEME} from '../src/music/composer';
import {HOOKS,HALLOWEEN_HOOK} from '../src/music/synthwave/catalog';

const fnv=(s:string)=>{let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return (n>>>0).toString(16);};
const minorRun=(modes:string[],forms:string[])=>modes.some((m,i)=>i>0&&m==='minor'&&modes[i-1]==='minor'&&forms[i]!=='nocturne'&&forms[i-1]!=='nocturne');

describe('the Halloween season',()=>{
  it('runs from 24 to 31 October in any year',()=>{
    for(const day of ['2026-10-24','2026-10-27','2026-10-31','2031-10-24'])expect(seasonOf(day)).toBe('halloween');
    for(const day of ['2026-10-23','2026-11-01','2026-09-24','2026-10-32','nonsense'])expect(seasonOf(day)).toBeUndefined();
  });
  it('keeps the edition draws and changes only the atmosphere words',()=>{
    for(const scene of SCENE_IDS) {
      const halloween=edition('2026-10-29',scene),{season,light,...draws}=halloween;
      expect(season).toBe('halloween');
      expect(light).not.toBe('');
      // The same draws as the edition would have without a season.
      expect(draws.seed).toBe(edition('2026-10-29',scene).seed);
      expect(Object.keys(draws).sort()).toEqual(['day','intensity','scene','seed','warmth','wind']);
    }
    expect(edition('2026-11-01')).not.toHaveProperty('season');
  });
  it('gives each place two Halloween days in 2026',()=>{
    const scenes=Array.from({length:8},(_,i)=>edition(`2026-10-${24+i}`).scene);
    for(const id of SCENE_IDS)expect(scenes.filter(s=>s===id)).toHaveLength(2);
  });
  it('paints each place with its own Halloween pair, and only in the season',()=>{
    for(const scene of SCENE_IDS) {
      const halloween=edition('2026-10-28',scene),ordinary=edition('2026-11-01',scene);
      expect(arrivalImage(halloween)).toBe(`/scenes/${SCENES[scene].slug}-halloween`);
      expect(eveningImage(halloween)).toBe(`/scenes/${SCENES[scene].slug}-halloween-evening`);
      expect(arrivalImage(ordinary)).toBe(SCENES[scene].image);
      expect(eveningImage(ordinary)).toBe(SCENES[scene].eveningImage);
    }
  });
  it('keeps a place\'s own words for the first half-hour',()=>{
    const day=edition('2026-10-26','rain');
    expect(seasonalWords(day,1799)).toEqual({});
    expect(seasonalWords(day,1800).caption).toBeTruthy();
    expect(seasonalWords(day,2399).subtitle).toBeUndefined();
    expect(seasonalWords(day,2400).subtitle).toBeTruthy();
    expect(seasonalWords(edition('2026-10-31','coast'),3000).subtitle).toBe('Happy Halloween.');
    expect(seasonalWords(edition('2026-11-02','rain'),3000)).toEqual({});
  });
});

describe('ordinary days',()=>{
  // Recorded on main before the season existed: no ordinary song may change.
  const fingerprints:Record<string,string>={
    'lofi:42:rain':'8b7461f1','synth:42:rain':'8e862789','lofi:42:meadow':'a25560bf','synth:42:meadow':'e6446f8b',
    'lofi:42:snow':'738e4273','synth:42:snow':'857dd377','lofi:42:coast':'f460f576','synth:42:coast':'8b4005fe',
    'lofi:20260917:rain':'6c5c8968','synth:20260917:rain':'b485ac26','lofi:20260917:meadow':'c54847ec','synth:20260917:meadow':'d48ab418',
    'lofi:20260917:snow':'a788b709','synth:20260917:snow':'31c20735','lofi:20260917:coast':'4b21c9d9','synth:20260917:coast':'8b565767',
    'lofi:987654321:rain':'1efe27c2','synth:987654321:rain':'9e405911','lofi:987654321:meadow':'2d747492','synth:987654321:meadow':'1271229f',
    'lofi:987654321:snow':'a8e34bb5','synth:987654321:snow':'785e615e','lofi:987654321:coast':'d230411a','synth:987654321:coast':'f699e34d',
  };
  it('compose exactly as before',()=>{
    for(const [key,print] of Object.entries(fingerprints)) {
      const [style,seed,mood]=key.split(':') as ['lofi'|'synth',string,'rain'];
      const plan=style==='lofi'?createSession(Number(seed),mood):createSession(Number(seed),mood,'synthwave');
      expect(fnv(JSON.stringify(plan)),key).toBe(print);
    }
    const lofi=createSession(20260917,'rain'),synth=createSession(20260917,'snow','synthwave');
    expect(fnv(JSON.stringify(composeSessionTrack(lofi,0).events))).toBe('8f626545');
    expect(fnv(JSON.stringify(composeSessionTrack(lofi,18).events))).toBe('68b0f6e6');
    expect(fnv(JSON.stringify(composeSessionTrack(synth,0).events))).toBe('2d2dd121');
    expect(fnv(JSON.stringify(composeSessionTrack(synth,18).events))).toBe('efa01e36');
  });
  it('keep their editions',()=>{
    expect(edition('2026-10-23')).toEqual({day:'2026-10-23',scene:'meadow',seed:9904290,intensity:0.67472694425378,wind:0.2943201804533601,warmth:0.17298043053597212,light:'Sun through the branches'});
    expect(edition('2026-11-01')).toEqual({day:'2026-11-01',scene:'snow',seed:4091603387,intensity:0.8100298392702825,wind:-0.023310968652367592,warmth:0.06061642221175134,light:'The quiet between trains'});
  });
});

describe('the Halloween motif',()=>{
  it('is a cell like the others: in order, on the eighth grid, leaving air and ending held',()=>{
    for(const cell of MELODY_CELLS) {
      cell.forEach(([at,duration],i)=>{
        expect(at*2%1).toBe(0);expect(duration*2%1).toBe(0);
        expect(at+duration).toBeLessThanOrEqual(i+1<cell.length?cell[i+1][0]:8);
      });
      expect(cell.reduce((sum,[,duration])=>sum+duration,0)).toBeLessThan(8);
      expect(cell[cell.length-1][1]).toBeGreaterThanOrEqual(1.5);
    }
    expect(MELODY_CELLS[HALLOWEEN_THEME.cell]).toEqual(HOOKS[HALLOWEEN_HOOK.cell]);
  });
  it('opens and closes a lofi Halloween hour in minor, with more minor and vibes',()=>{
    for(const seed of [7,20261031,123456789]) for(const mood of SCENE_IDS) {
      const plan=createSession(seed,mood,'lofi','halloween'),a=plan.slots.map(s=>s.arrangement);
      expect(a[0].theme).toEqual(HALLOWEEN_THEME);expect(a[17].theme).toEqual(HALLOWEEN_THEME);
      expect(a[15].theme.cell).toBe(HALLOWEEN_THEME.cell);expect(a[16].theme.cell).toBe(HALLOWEEN_THEME.cell);
      expect(a[0].mode).toBe('minor');expect(a[17].mode).toBe('minor');expect(a[17].loop).toBe(a[0].loop);
      expect(a[3].voice).toBe('vibes');expect(a[17].voice).toBe('vibes');
      expect(a.filter(x=>x.mode==='minor').length).toBeGreaterThan(createSession(seed,mood).slots.filter(s=>s.arrangement.mode==='minor').length);
      expect(minorRun(a.map(x=>x.mode),a.map(x=>x.form))).toBe(false);
      expect(plan.slots.reduce((sum,s)=>sum+s.duration,0)).toBeCloseTo(3600,6);
      // After hours returns to fresh ordinary themes.
      expect(composeSessionTrack(plan,18).events.length).toBeGreaterThan(0);
    }
  });
  it('carries the synthwave hour\'s opening and return',()=>{
    for(const seed of [7,20261031]) {
      const plan=createSession(seed,'coast','synthwave','halloween'),a=plan.slots.map(s=>s.arrangement);
      expect(a[0].theme).toEqual(HALLOWEEN_HOOK);expect(a[17].theme).toEqual(HALLOWEEN_HOOK);
      expect(plan.slots.reduce((sum,s)=>sum+s.duration,0)).toBeCloseTo(3600,6);
      expect(plan.events).toEqual(createSession(seed,'coast','lofi','halloween').events);
    }
  });
});
