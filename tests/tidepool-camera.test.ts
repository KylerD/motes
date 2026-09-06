import { describe, expect, it } from 'vitest';
import { PondCamera } from '../src/tidepool/camera';
import type { View } from '../src/tidepool/model';

describe('pond projection', () => {
  it.each([[1440, 960, 1.15], [390, 844, 3], [900, 500, 0.65], [1200, 800, 5]])('maps the water surface back to simulation coordinates at %ix%i', (width, height, zoom) => {
    const camera = new PondCamera();
    const view: View = { x: 780, y: 450, zoom, selected: null, lens: 'life', tool: 'observe', pointer: null, reduced: false };
    camera.update(width, height, view);
    for (const [x, y] of [[100, 100], [800, 480], [1450, 800]]) {
      const screen = camera.toScreen(x, y), world = camera.toWorld(screen.x, screen.y);
      expect(world.x).toBeCloseTo(x, 8); expect(world.y).toBeCloseTo(y, 8);
    }
    expect(camera.toWorld(width / 2, height / 2).x).toBeCloseTo(view.x, 8);
    expect(camera.toWorld(width / 2, height / 2).y).toBeCloseTo(view.y, 8);
  });
});
