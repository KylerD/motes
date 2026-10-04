import {describe,expect,it} from 'vitest';
import {coverLayout} from '../src/scenes/cover';

const aspect=1672/941;
describe('cover crops',()=>{
  it('fills a portrait view and slides from the left edge to the right edge',()=>{
    const left=coverLayout(405,720,aspect,0),right=coverLayout(405,720,aspect,1);
    expect(left.ih).toBeCloseTo(720,6);expect(left.oy).toBeCloseTo(0,6);
    expect(left.ox).toBeCloseTo(0,6);
    expect(right.ox+right.iw).toBeCloseTo(405,6);
  });
  it('keeps a landscape view covered at the place anchor',()=>{
    const layout=coverLayout(1280,720,aspect,.43);
    expect(layout.iw).toBeGreaterThanOrEqual(1280);expect(layout.ih).toBeGreaterThanOrEqual(720);
    expect(layout.ox).toBeLessThanOrEqual(0);expect(layout.ox+layout.iw).toBeGreaterThanOrEqual(1280);
  });
});
