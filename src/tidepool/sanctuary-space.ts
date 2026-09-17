import { WIDTH, HEIGHT } from './model';
import type { View } from './model';

export type SanctuaryMood = 'rain' | 'meadow';
export const SANCTUARIES = {
  rain: { title: 'Rain, above the city.', subtitle: 'A little shelter from the world.', image: '/scenes/neon-rain.png', anchor: .43,
    water: { far: .69, near: .92, leftFar: .45, rightFar: .69, leftNear: .25, rightNear: .61 } },
  meadow: { title: 'Nowhere else to be.', subtitle: 'The long way home can wait.', image: '/scenes/golden-hour.png', anchor: .60,
    water: { far: .73, near: .93, leftFar: .48, rightFar: .80, leftNear: .44, rightNear: .74 } },
} as const;

/** Shared perspective mapping for the painted water, living cells, camera and input. */
export class SanctuarySpace {
  width = 1; height = 1; imageWidth = 1; imageHeight = 1; offsetX = 0; offsetY = 0;
  constructor(public mood: SanctuaryMood) {}
  resize(width: number, height: number, aspect = 16 / 9, view?: Pick<View,'x'|'y'|'zoom'>): void {
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    this.imageWidth = Math.max(this.width, this.height * aspect); this.imageHeight = this.imageWidth / aspect;
    this.offsetX = (this.width - this.imageWidth) * SANCTUARIES[this.mood].anchor;
    this.offsetY = (this.height - this.imageHeight) * .5;
    if (view) {
      const home = { x: this.width*.5,y: this.height*.48 }, focus = this.project(view.x,view.y);
      this.offsetX = home.x + (this.offsetX-focus.x)*view.zoom;
      this.offsetY = home.y + (this.offsetY-focus.y)*view.zoom;
      this.imageWidth *= view.zoom; this.imageHeight *= view.zoom;
      // The camera may approach the edge of the painting, never reveal empty canvas beyond it.
      this.offsetX = Math.max(this.width-this.imageWidth,Math.min(0,this.offsetX));
      this.offsetY = Math.max(this.height-this.imageHeight,Math.min(0,this.offsetY));
    }
  }
  screen(u: number, v: number) { return { x: this.offsetX + u * this.imageWidth, y: this.offsetY + v * this.imageHeight }; }
  project(x: number, y: number) {
    const w = SANCTUARIES[this.mood].water, t = y / HEIGHT;
    const left = w.leftFar + (w.leftNear - w.leftFar) * t, right = w.rightFar + (w.rightNear - w.rightFar) * t;
    return this.screen(left + (right - left) * x / WIDTH, w.far + (w.near - w.far) * t);
  }
  unproject(x: number, y: number) {
    const w = SANCTUARIES[this.mood].water, u = (x - this.offsetX) / this.imageWidth, v = (y - this.offsetY) / this.imageHeight;
    const t = (v - w.far) / (w.near - w.far);
    const left = w.leftFar + (w.leftNear - w.leftFar) * t, right = w.rightFar + (w.rightNear - w.rightFar) * t;
    return { x: (u - left) / (right - left) * WIDTH, y: t * HEIGHT };
  }
  hit(x: number, y: number) {
    const p = this.unproject(x, y);
    return Number.isFinite(p.x) && p.x >= 0 && p.x <= WIDTH && p.y >= 0 && p.y <= HEIGHT ? p : null;
  }
}
