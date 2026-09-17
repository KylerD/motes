import { describe, expect, it } from 'vitest';
import { SanctuarySpace } from '../src/tidepool/sanctuary-space';
import type { SanctuaryMood } from '../src/tidepool/sanctuary-space';

describe('painted water interaction', () => {
  for (const mood of ['rain','meadow'] as SanctuaryMood[]) {
    it(`${mood} maps real cell positions back through desktop and phone crops`, () => {
      const space = new SanctuarySpace(mood);
      for (const [width,height] of [[1440,960],[390,844],[2560,1080]]) {
        space.resize(width,height);
        for (const [x,y] of [[0,0],[1600,960],[800,480],[400,720]]) {
          const screen = space.project(x,y), world = space.unproject(screen.x,screen.y);
          expect(world.x).toBeCloseTo(x,8); expect(world.y).toBeCloseTo(y,8);
        }
        expect(space.imageWidth).toBeGreaterThanOrEqual(width); expect(space.imageHeight).toBeGreaterThanOrEqual(height);
        expect(space.hit(-100,-100)).toBeNull();
      }
    });
    it(`${mood} keeps zoomed and panned inspection aligned with the painting`,() => {
      const space = new SanctuarySpace(mood);
      for (const zoom of [1,2.4,5]) {
        const view = {x:700,y:420,zoom}; space.resize(1200,800,16/9,view);
        expect(space.offsetX).toBeLessThanOrEqual(0); expect(space.offsetY).toBeLessThanOrEqual(0);
        expect(space.offsetX+space.imageWidth).toBeGreaterThanOrEqual(1200);
        expect(space.offsetY+space.imageHeight).toBeGreaterThanOrEqual(800);
        for (const [x,y] of [[250,300],[1000,700]]) {
          const screen = space.project(x,y), world = space.unproject(screen.x,screen.y);
          expect(world.x).toBeCloseTo(x,8); expect(world.y).toBeCloseTo(y,8);
        }
      }
    });
  }
});
