import { OrthographicCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { WIDTH, HEIGHT } from './model';
import type { View } from './model';

export const UNIT = 0.01;
export const WATER = 0.08;
export const sceneX = (x: number) => (x - WIDTH / 2) * UNIT;
export const sceneZ = (y: number) => (y - HEIGHT / 2) * UNIT;

/** One projection owns drawing, picking and gesture coordinates. */
export class PondCamera {
  readonly camera = new OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
  private ray = new Raycaster();
  private plane = new Plane(new Vector3(0, 1, 0), -WATER);
  private point = new Vector3();
  private width = 1;
  private height = 1;
  scale = 1;
  update(width: number, height: number, view: View): void {
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    const aspect = this.width / this.height, span = Math.max(WIDTH * UNIT / aspect, HEIGHT * UNIT) / view.zoom;
    const c = this.camera;
    c.left = -span * aspect / 2; c.right = span * aspect / 2; c.top = span / 2; c.bottom = -span / 2;
    c.position.set(sceneX(view.x), 18 + WATER, sceneZ(view.y) + 13);
    c.lookAt(sceneX(view.x), WATER, sceneZ(view.y));
    c.updateProjectionMatrix(); c.updateMatrixWorld();
    this.scale = this.height / span * UNIT;
  }
  toWorld(x: number, y: number): { x: number; y: number } {
    this.ray.setFromCamera(new Vector2(x / this.width * 2 - 1, 1 - y / this.height * 2), this.camera);
    this.ray.ray.intersectPlane(this.plane, this.point);
    return { x: this.point.x / UNIT + WIDTH / 2, y: this.point.z / UNIT + HEIGHT / 2 };
  }
  toScreen(x: number, y: number, elevation = 0): { x: number; y: number } {
    this.point.set(sceneX(x), WATER + elevation, sceneZ(y)).project(this.camera);
    return { x: (this.point.x + 1) / 2 * this.width, y: (1 - this.point.y) / 2 * this.height };
  }
}
