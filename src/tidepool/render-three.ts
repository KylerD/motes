import * as T from 'three';
import { DT, LINEAGES, MAX_CELLS } from './model';
import type { Pool, View, Cell, Colony } from './model';
import { colonies } from './world';
import { PondCamera, WATER, UNIT, sceneX, sceneZ } from './camera';
import { makeGarden, makeWater, disposeObject, visualNoise } from './garden';
import { PostcardPass, paintedMaterial } from './postcard';

const TAU = Math.PI * 2;
const white = new T.Color('#fff1cf'), colors = LINEAGES.map(l => new T.Color(l.color));
type Body = { mesh: T.Mesh<T.ExtrudeGeometry, T.MeshStandardMaterial>; step: number; count: number };
export const cellElevation = (cell: Cell) => 0.243 + Math.sin(cell.phase) * 0.006;

function hull(cells: Cell[]): Cell[] {
  const points = cells.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: Cell, b: Cell, c: Cell) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lower: Cell[] = [], upper: Cell[] = [];
  for (const p of points) { while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of points.reverse()) { while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function skin(group: Colony): T.ExtrudeGeometry {
  const points = hull(group.cells).map(c => {
    const dx = c.x - group.x, dy = c.y - group.y, d = Math.hypot(dx, dy) || 1;
    return new T.Vector2(sceneX(c.x + dx / d * 5), -sceneZ(c.y + dy / d * 5));
  });
  const shape = new T.Shape();
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length], c = points[(i + 2) % points.length];
    if (i === 0) shape.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
    shape.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
  });
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.075, bevelSize: 0.055, bevelSegments: 3, steps: 1, curveSegments: 3 });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, WATER + 0.025, 0);
  return geometry;
}

export class ThreePoolRenderer {
  readonly kind = 'three';
  private renderer: T.WebGLRenderer;
  private postcard: PostcardPass;
  private scene = new T.Scene();
  private projection = new PondCamera();
  private garden: T.Group | null = null;
  private gardenKey = '';
  private water = makeWater();
  private cells: T.InstancedMesh;
  private eyes: T.InstancedMesh;
  private glints: T.InstancedMesh;
  private food: T.InstancedMesh;
  private bonds: T.InstancedMesh;
  private fireflies: T.InstancedMesh;
  private bodies = new Map<number, Body>();
  private rings = new T.Group();
  private cursor: T.Mesh;
  private selection: T.Mesh;
  private previousPool: Pool | null = null;
  private dummy = new T.Object3D();
  private color = new T.Color();
  private width = 1;
  private height = 1;
  private lastEffectKey = '';
  scale = 1;

  constructor(private canvas: HTMLCanvasElement, context: WebGL2RenderingContext) {
    this.renderer = new T.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
    this.postcard = new PostcardPass(this.renderer);
    this.renderer.info.autoReset = false;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.03;
    this.renderer.setClearColor('#283d50');
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.scene.add(new T.HemisphereLight('#d3cce6', '#685479', 1.55));
    const sun = new T.DirectionalLight('#ffd5b2', 1.2); sun.position.set(-4, 12, 7);
    sun.castShadow = true; sun.shadow.mapSize.set(512, 512);
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 12, bottom: -12, near: 0.1, far: 40 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025; this.scene.add(sun);
    this.scene.add(this.water, this.rings);
    const shadow = new T.Mesh(new T.PlaneGeometry(35, 25), new T.ShadowMaterial({ color: '#343452', opacity: 0.17 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = WATER - 0.031; shadow.receiveShadow = true; this.scene.add(shadow);
    const instances = (geometry: T.BufferGeometry, material: T.Material, max: number) => {
      const mesh = new T.InstancedMesh(geometry, material, max); mesh.count = 0; mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); this.scene.add(mesh); return mesh;
    };
    this.cells = instances(new T.SphereGeometry(1, 10, 6), paintedMaterial('white'), MAX_CELLS);
    this.eyes = instances(new T.SphereGeometry(1, 10, 8), new T.MeshStandardMaterial({ color: '#29333e', roughness: 0.4 }), MAX_CELLS);
    this.glints = instances(new T.SphereGeometry(1, 6, 4), new T.MeshBasicMaterial({ color: '#fff4d9' }), MAX_CELLS);
    this.food = instances(new T.OctahedronGeometry(1), new T.MeshBasicMaterial({ color: '#f1d596', transparent: true, opacity: 0.62 }), 1800);
    this.bonds = instances(new T.CylinderGeometry(1, 1, 1, 5), new T.MeshBasicMaterial({ color: 'white', transparent: true, opacity: 0.75 }), 3000);
    this.fireflies = instances(new T.SphereGeometry(1, 5, 4), new T.MeshBasicMaterial({ color: new T.Color('#ffddb1').multiplyScalar(2.6), transparent: true, opacity: 0.72 }), 70);
    const ring = (color: string) => {
      const m = new T.Mesh(new T.RingGeometry(0.98, 1, 64), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: T.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; this.scene.add(m); return m;
    };
    this.cursor = ring('#f1dda9'); this.selection = ring('#e8e9c8');
    this.canvas.addEventListener('webglcontextrestored', this.restoreShadows);
  }
  private restoreShadows = () => { this.renderer.shadowMap.needsUpdate = true; };
  get diagnostics() { return { kind: this.kind, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures }; }
  resize(): void {
    const r = this.canvas.getBoundingClientRect(); this.width = Math.max(1, r.width); this.height = Math.max(1, r.height);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5, 1800 / this.width));
    this.renderer.setSize(this.width, this.height, false);
    this.postcard.resize(this.width, this.height);
  }
  toWorld(x: number, y: number, view: View) { this.projection.update(this.width, this.height, view); return this.projection.toWorld(x, y); }
  toScreen(x: number, y: number, view: View, elevation = 0) { this.projection.update(this.width, this.height, view); return this.projection.toScreen(x, y, elevation); }
  private instance(mesh: T.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, angle = 0): void {
    this.dummy.position.set(x, y, z); this.dummy.rotation.set(0, -angle, 0); this.dummy.scale.set(sx, sy, sz);
    this.dummy.updateMatrix(); mesh.setMatrixAt(i, this.dummy.matrix);
  }
  private finish(mesh: T.InstancedMesh, count: number): void {
    mesh.count = count; mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  draw(pool: Pool, view: View): void {
    this.renderer.info.reset();
    const terrainKey = JSON.stringify([pool.seed, pool.preset, pool.obstacles]);
    if (terrainKey !== this.gardenKey) {
      if (this.garden) { this.scene.remove(this.garden); disposeObject(this.garden); }
      this.garden = makeGarden(pool); this.scene.add(this.garden); this.gardenKey = terrainKey;
      const bank = pool.obstacles[pool.preset === 'channel' ? 0 : 1];
      this.water.material.uniforms.hasLamp.value = bank ? 1 : 0;
      if (bank) this.water.material.uniforms.lamp.value.set(sceneX(bank.x) - 0.35, sceneZ(bank.y) + bank.ry * UNIT + 0.38);
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.projection.update(this.width, this.height, view); this.scale = this.projection.scale;
    const time = pool.step * DT; this.water.material.uniforms.time.value = time;
    const groups = colonies(pool), ids = new Set<number>();
    let eyeCount = 0;
    for (const g of groups) {
      if (g.cells.length < 4) continue;
      ids.add(g.id);
      let body = this.bodies.get(g.id);
      if (!body) {
        const mesh = new T.Mesh(skin(g), paintedMaterial(colors[g.lineage]));
        this.scene.add(mesh); body = { mesh, step: pool.step, count: g.cells.length }; this.bodies.set(g.id, body);
      } else if (this.previousPool !== pool || pool.step !== body.step || body.count !== g.cells.length) {
        body.mesh.geometry.dispose(); body.mesh.geometry = skin(g); body.step = pool.step; body.count = g.cells.length;
      }
      body.mesh.visible = view.lens !== 'bonds';
      body.mesh.material.color.copy(view.lens === 'energy' ? this.color.set(g.energy > 0.55 ? '#b8d690' : '#d79582') : colors[g.lineage]);
      body.mesh.material.color.multiplyScalar(0.6 + g.energy * 0.4);
      if (view.lens === 'life' && g.cells.length >= 8) {
        const angle = Math.atan2(g.cells.reduce((s, c) => s + Math.sin(c.angle), 0), g.cells.reduce((s, c) => s + Math.cos(c.angle), 0));
        const dx = Math.cos(angle), dz = Math.sin(angle);
        const lead = g.cells.reduce((a, b) => a.x * dx + a.y * dz > b.x * dx + b.y * dz ? a : b);
        const x = sceneX(lead.x) - dx * 0.115, z = sceneZ(lead.y) - dz * 0.115;
        // Blink on model time, so a paused or replayed world keeps the same expression.
        const blink = Math.sin(time * 0.65 + g.id) > 0.995 ? 0.17 : 1;
        for (const side of [-1, 1]) {
          const ex = x - dz * side * 0.056, ez = z + dx * side * 0.056;
          this.instance(this.eyes, eyeCount, ex, WATER + 0.285, ez, 0.04, 0.038 * blink, 0.036);
          this.instance(this.glints, eyeCount++, ex - 0.009, WATER + 0.316, ez + 0.012, 0.013, 0.01 * blink, 0.011);
        }
      }
    }
    this.finish(this.eyes, eyeCount); this.finish(this.glints, eyeCount);
    for (const [id, body] of this.bodies) if (!ids.has(id)) { this.scene.remove(body.mesh); disposeObject(body.mesh); this.bodies.delete(id); }
    pool.cells.forEach((c, i) => {
      const radius = c.radius * UNIT * (1.05 + c.activity * 0.12), height = WATER + cellElevation(c);
      const subtle = view.lens === 'life' ? 0.66 : 1;
      this.instance(this.cells, i, sceneX(c.x), height, sceneZ(c.y), radius * (c.role === 1 ? 1.4 : 1) * subtle, radius * (view.lens === 'life' ? 0.17 : 0.75), radius * subtle, c.angle);
      this.color.copy(view.lens === 'energy' ? this.color.set(c.energy > 0.55 ? '#d7e99b' : '#ecab92') : colors[c.lineage]).lerp(white, 0.32 + c.activity * 0.3);
      this.cells.setColorAt(i, this.color);
    });
    this.finish(this.cells, pool.cells.length);
    const map = new Map(pool.cells.map(c => [c.id, c])), selected = groups.find(g => g.cells.some(c => c.id === view.selected));
    let bondCount = 0;
    if (view.lens !== 'life') for (const b of pool.bonds) {
      const a = map.get(b.a), c = map.get(b.b); if (!a || !c) continue;
      const start = new T.Vector3(sceneX(a.x), WATER + 0.255, sceneZ(a.y)), end = new T.Vector3(sceneX(c.x), WATER + 0.255, sceneZ(c.y));
      const delta = end.clone().sub(start);
      this.dummy.position.copy(start).add(end).multiplyScalar(0.5);
      this.dummy.quaternion.setFromUnitVectors(T.Object3D.DEFAULT_UP, delta.clone().normalize());
      const thickness = view.lens === 'bonds' ? 0.014 : 0.006 + Math.min(0.02, Math.abs(b.flow) * 8);
      this.dummy.scale.set(thickness, delta.length(), thickness); this.dummy.updateMatrix();
      this.bonds.setMatrixAt(bondCount, this.dummy.matrix); this.bonds.setColorAt(bondCount++, this.color.set(b.strain > 0.45 ? '#e89480' : LINEAGES[a.lineage].color));
    }
    this.finish(this.bonds, bondCount);
    let foodCount = 0;
    for (const r of pool.nutrients) for (let i = 0; i < Math.floor(r.amount * (view.lens === 'life' ? 17 : 35)) && foodCount < 1800; i++) {
      const a = visualNoise(i + r.id * 23) * TAU + time * 0.005, radius = Math.sqrt(visualNoise(i + r.id * 59)) * r.radius * UNIT * 0.8;
      const s = 0.012 + visualNoise(i + 7) * 0.009;
      this.instance(this.food, foodCount++, sceneX(r.x) + Math.cos(a) * radius, WATER + 0.008, sceneZ(r.y) + Math.sin(a) * radius, s, s * 0.45, s);
    }
    this.finish(this.food, foodCount);
    for (let i = 0; i < 70; i++) {
      const s = 0.01 * (0.4 + Math.pow(Math.max(0, Math.sin(time * 0.8 + i * 1.7)), 3));
      this.instance(this.fireflies, i, (visualNoise(i + pool.seed) - 0.5) * 19 + Math.sin(time * 0.12 + i) * 0.2, 0.2 + visualNoise(i + 66) * 1.7, (visualNoise(i + 89) - 0.5) * 11 + Math.cos(time * 0.09 + i) * 0.15, s, s, s);
    }
    this.finish(this.fireflies, 70);
    this.selection.visible = !!selected;
    if (selected) { this.selection.position.set(sceneX(selected.x), WATER + 0.008, sceneZ(selected.y)); this.selection.scale.setScalar((selected.radius + 15) * UNIT); }
    this.cursor.visible = !!view.pointer && view.tool !== 'observe';
    if (view.pointer) { this.cursor.position.set(sceneX(view.pointer.x), WATER + 0.009, sceneZ(view.pointer.y)); this.cursor.scale.setScalar((view.tool === 'cut' ? 24 : view.tool === 'feed' ? 85 : 115) * UNIT); }
    const effectKey = JSON.stringify(pool.disturbances);
    if (effectKey !== this.lastEffectKey) {
      disposeObject(this.rings); this.rings.clear(); this.lastEffectKey = effectKey;
      for (const flow of pool.disturbances) for (let i = 0; i < 3; i++) {
        const ring = new T.Mesh(new T.RingGeometry(0.985, 1, 64), new T.MeshBasicMaterial({ color: '#b0dace', transparent: true, opacity: 0.3, side: T.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(sceneX(flow.x), WATER + 0.012, sceneZ(flow.y));
        ring.userData = { born: flow.born, index: i }; this.rings.add(ring);
      }
    }
    for (const child of this.rings.children) {
      const ring = child as T.Mesh<T.RingGeometry, T.MeshBasicMaterial>, age = Math.max(0, (pool.step - ring.userData.born) * DT);
      ring.scale.setScalar((20 + age * 35 + ring.userData.index * 18) * UNIT); ring.material.opacity = Math.max(0, 0.35 - age * 0.065);
    }
    this.previousPool = pool;
    this.postcard.draw(this.renderer, this.scene, this.projection.camera, view.lens === 'life');
  }
  dispose(): void {
    this.canvas.removeEventListener('webglcontextrestored', this.restoreShadows);
    disposeObject(this.scene); this.postcard.dispose(); this.renderer.dispose();
  }
}
