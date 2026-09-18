import { describe,it,expect } from 'vitest';
import { edition,validDay,localDay,SCENE_IDS } from '../src/scenes/edition';

describe('daily scene editions',()=>{
  it('revisits the same scene, light and soundtrack seed on a date',()=>{
    expect(edition('2026-09-17')).toEqual(edition('2026-09-17'));
    expect(edition('2026-09-17','coast').seed).not.toEqual(edition('2026-09-17','rain').seed);
  });
  it('visits every place and never repeats a neighbouring daily scene',()=>{
    const days = Array.from({length:28},(_,i)=>edition(`2026-02-${String(i+1).padStart(2,'0')}`));
    expect(new Set(days.map(x=>x.scene)).size).toBe(SCENE_IDS.length);
    expect(new Set(days.map(x=>x.seed)).size).toBe(28);
    for(let i=1;i<days.length;i++) expect(days[i].scene).not.toBe(days[i-1].scene);
  });
  it('rejects impossible dates rather than silently rolling them forward',()=>{
    for(const day of ['2026-02-30','2025-02-29','2026-13-01','2026-09-17x','1999-01-01']) expect(validDay(day)).toBe(false);
    expect(validDay('2028-02-29')).toBe(true);
  });
  it('uses the viewer local calendar day and bounds the atmosphere',()=>{
    expect(localDay(new Date(2026,8,17,0,1))).toBe('2026-09-17');
    for(const id of SCENE_IDS) { const d=edition('2026-09-17',id); expect(d.intensity).toBeGreaterThan(0); expect(Math.abs(d.wind)).toBeLessThan(.5); }
  });
});
