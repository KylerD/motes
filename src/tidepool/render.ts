import type { Cell, Pool, View } from './model';
import { CanvasPoolRenderer } from './render-canvas';
import { ThreePoolRenderer, cellElevation } from './render-three';

export class PoolRenderer {
  private backend: CanvasPoolRenderer | ThreePoolRenderer;
  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'low-power' });
    this.backend = context ? new ThreePoolRenderer(canvas, context) : new CanvasPoolRenderer(canvas);
    canvas.dataset.renderer = this.backend.kind;
  }
  get kind() { return this.backend.kind; }
  get scale() { return this.backend.scale; }
  get diagnostics() { return this.backend instanceof ThreePoolRenderer ? this.backend.diagnostics : { kind: this.kind }; }
  resize() { this.backend.resize(); }
  toWorld(x: number, y: number, view: View) { return this.backend.toWorld(x, y, view); }
  toScreen(x: number, y: number, view: View) { return this.backend.toScreen(x, y, view); }
  toScreenCell(cell: Cell, view: View) {
    return this.backend instanceof ThreePoolRenderer ? this.backend.toScreen(cell.x, cell.y, view, cellElevation(cell)) : this.backend.toScreen(cell.x, cell.y, view);
  }
  pick(pool: Pool, x: number, y: number, view: View): number | null {
    let closest: number | null = null, distance = Infinity;
    for (const cell of pool.cells) {
      const point = this.toScreenCell(cell, view), d = Math.hypot(point.x - x, point.y - y);
      if (d < distance && d < Math.max(12, cell.radius * this.scale * 1.5 + 4)) { closest = cell.id; distance = d; }
    }
    return closest;
  }
  draw(pool: Pool, view: View) { this.backend.draw(pool, view); }
  dispose() { this.backend.dispose(); }
}
