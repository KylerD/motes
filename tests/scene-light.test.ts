import {describe,it,expect} from 'vitest';
import {SCENES,SCENE_IDS} from '../src/scenes/edition';
import {existsSync,readFileSync} from 'node:fs';
import {sceneLightAt,sceneLightWeights} from '../src/scenes/scene-light';
import {meadowLightAt} from '../src/scenes/meadow-light';

describe('authored evening coverage',()=>{
  it.each(SCENE_IDS)('%s has its own matching, local evening painting',scene=>{
    const place=SCENES[scene];
    expect(place.eveningImage).toMatch(/^\/scenes\/.+\.png$/);
    expect(place.eveningImage).not.toBe(place.image);
    expect(existsSync(`public${place.eveningImage}`)).toBe(true);
    const original=readFileSync(`public${place.image}`),evening=readFileSync(`public${place.eveningImage}`);
    expect([evening.readUInt32BE(16),evening.readUInt32BE(20)])
      .toEqual([original.readUInt32BE(16),original.readUInt32BE(20)]);
    const provenance=JSON.parse(readFileSync(`public${place.eveningImage}.json`,'utf8'));
    expect(provenance.sourceAsset).toBe(`public${place.image}`);
    expect(provenance.prompt.length).toBeGreaterThan(100);
  });
});

describe('lighting through the listening hour',()=>{
  const fields=['sky','distance','foreground','water','lamps'] as const;
  it.each(SCENE_IDS)('%s develops continuously and never restarts after hours',scene=>{
    let previous=sceneLightAt(scene,0);
    for(const field of fields)expect(previous[field]).toBe(0);
    for(let seconds=30;seconds<=7200;seconds+=30) {
      const state=sceneLightAt(scene,seconds);
      for(const field of fields) {
        expect(state[field]).toBeGreaterThanOrEqual(previous[field]);
        expect(state[field]-previous[field]).toBeLessThan(.04);
        expect(state[field]).toBeLessThanOrEqual(1);
      }
      previous=state;
    }
    for(const field of fields)expect(sceneLightAt(scene,3300)[field]).toBe(1);
    expect(sceneLightAt(scene,3600)).toEqual(sceneLightAt(scene,7200));
    const mid=sceneLightAt(scene,1200);
    expect(new Set([mid.sky,mid.distance,mid.foreground]).size).toBe(3);
    expect(mid.caption).not.toBe(sceneLightAt(scene,3300).caption);
    for(const invalid of [-20,NaN,Infinity])expect(sceneLightAt(scene,invalid)).toEqual(sceneLightAt(scene,0));
  });
  it('keeps the established meadow arc and the coastal sun/reflection in step',()=>{
    for(const seconds of [0,600,1200,1800,2400,3300,7200]) {
      const meadow=meadowLightAt(seconds);
      expect(sceneLightAt('meadow',seconds)).toEqual({...meadow,foreground:meadow.clearing});
      const coast=sceneLightAt('coast',seconds);
      expect(coast.water).toBe(coast.sky);
    }
  });
});

describe('painting regions',()=>{
  it.each(SCENE_IDS)('%s covers the painting once, without negative or unlit bands',scene=>{
    for(let v=0;v<=1;v+=.025)for(let u=0;u<=1;u+=.025) {
      const weights=sceneLightWeights(scene,u,v);
      expect(weights.reduce((sum,n)=>sum+n,0)).toBeCloseTo(1,6);
      for(const weight of weights) {expect(weight).toBeGreaterThanOrEqual(0);expect(weight).toBeLessThanOrEqual(1);}
    }
    expect(sceneLightWeights(scene,.57,.12)[0]).toBe(1); // Open sky.
    expect(sceneLightWeights(scene,.1,.6)[2]).toBe(1); // Sheltered foreground.
  });
  it('keeps pond and bay lighting inside painted water',()=>{
    expect(sceneLightWeights('rain',.5,.8)).toEqual([0,0,0,1]);
    expect(sceneLightWeights('meadow',.6,.8)).toEqual([0,0,0,1]);
    expect(sceneLightWeights('coast',.6,.45)).toEqual([0,0,0,1]);
    expect(sceneLightWeights('coast',.2,.55)[3]).toBe(0); // Books and chair.
    expect(sceneLightWeights('snow',.5,.8)[3]).toBe(0); // Rails, not water.
  });
});
