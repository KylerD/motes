import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sceneX, sceneZ, UNIT, WATER } from './camera';
import type { Pool } from './model';
import { paintedMaterial } from './postcard';

export const visualNoise = (n: number): number => { const f = Math.sin(n * 127.1 + 311.7) * 43758.5453; return f - Math.floor(f); };

function organic(geometry: T.BufferGeometry, seed: number): T.BufferGeometry {
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), angle = Math.atan2(z, x);
    const edge = 0.966 + Math.sin(angle * 3 + seed) * 0.017 + Math.sin(angle * 7 - seed) * 0.009;
    positions.setXYZ(i, x * edge, y, z * edge);
  }
  positions.needsUpdate = true; geometry.computeVertexNormals(); return geometry;
}

/** Static diorama, rebuilt only when the actual obstacle geometry changes. */
export function makeGarden(pool: Pool): T.Group {
  const root = new T.Group(), materials = new Map<string, T.MeshStandardMaterial>();
  const material = (color: string, glow = false) => {
    const key = color + glow;
    if (!materials.has(key)) materials.set(key, paintedMaterial(color, glow));
    return materials.get(key)!;
  };
  const mesh = (geo: T.BufferGeometry, color: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, glow = false) => {
    const m = new T.Mesh(geo, material(color, glow)); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = !glow; m.receiveShadow = true; root.add(m); return m;
  };
  const pebble = (color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) => mesh(new T.SphereGeometry(1, 12, 8), color, x, y, z, sx, sy, sz);
  const box = (color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, glow = false) => mesh(new T.BoxGeometry(1, 1, 1), color, x, y, z, sx, sy, sz, glow);
  const tree = (x: number, z: number, size: number) => {
    const y = 0.6;
    mesh(new T.CylinderGeometry(0.06, 0.1, 1.05, 7), '#8e7060', x, y + 0.48 * size, z, size, size, size);
    for (let k = 0; k < 5; k++) {
      const angle = k * 2.4, radius = k === 4 ? 0 : 0.28 * size;
      const canopy = organic(new T.SphereGeometry(1, 16, 12), k + x * 3 + z);
      mesh(canopy, ['#477a6c', '#568774', '#76a386', '#65977d', '#8ab494'][k], x + Math.cos(angle) * radius, y + (1.02 + k * 0.075) * size, z + Math.sin(angle) * radius, 0.57 * size, (0.58 + visualNoise(k + x) * 0.2) * size, 0.54 * size);
    }
  };
  const mushroom = (x: number, z: number, size: number, rose: boolean) => {
    mesh(new T.CylinderGeometry(0.025, 0.04, 0.2, 7), '#eddbaf', x, 0.68, z, size, size, size);
    pebble(rose ? '#cf8b91' : '#d9b175', x, 0.68 + 0.1 * size, z, 0.12 * size, 0.075 * size, 0.12 * size);
    pebble('#f6dfb6', x - 0.03 * size, 0.68 + 0.17 * size, z, 0.025 * size, 0.01, 0.02 * size);
  };
  for (const [index, r] of pool.obstacles.entries()) {
    const x = sceneX(r.x), z = sceneZ(r.y), rx = r.rx * UNIT, rz = r.ry * UNIT;
    mesh(organic(new T.CylinderGeometry(1, 0.96, 0.38, 64), r.seed), '#69767d', x, -0.2, z, rx + 0.13, 1, rz + 0.13);
    mesh(organic(new T.CylinderGeometry(1, 1.02, 0.22, 64), r.seed), '#b2b29a', x, 0.03, z, rx + 0.055, 1, rz + 0.055);
    mesh(organic(new T.CylinderGeometry(0.97, 1, 0.32, 64), r.seed), '#78987d', x, 0.23, z, rx, 1, rz);
    mesh(organic(new T.SphereGeometry(1, 24, 12), r.seed), '#8ba783', x, 0.33, z, rx * 0.98, 0.22, rz * 0.98);
    const seed = pool.seed % 999 + r.seed * 337;
    for (let i = 0; i < 20; i++) {
      const angle = visualNoise(seed + i) * Math.PI * 2, radial = 0.25 + visualNoise(seed + i + 65) * 0.62;
      const px = x + Math.cos(angle) * rx * radial, pz = z + Math.sin(angle) * rz * radial;
      if (index === (pool.preset === 'channel' ? 0 : 1) && Math.hypot(px - (x - 0.35), pz - (z + rz * 0.35)) < (i < 4 ? 1.2 : 0.65)) continue;
      if (i < 4) tree(px, pz, 0.6 + visualNoise(seed + i + 132) * 0.5);
      else if (i < 10) mushroom(px, pz, 0.7 + visualNoise(seed + i + 21), i % 2 === 0);
      else {
        for (let blade = 0; blade < 3; blade++) {
          const grass = mesh(new T.ConeGeometry(0.035, 0.3 + blade * 0.045, 4), '#537f6b', px + blade * 0.035, 0.65, pz, 1, 1, 0.5);
          grass.rotation.z = (blade - 1) * 0.2;
        }
        if (i % 3 === 0) pebble('#efc0b2', px, 0.81, pz, 0.055, 0.045, 0.055);
      }
    }
    // Smooth stones define the waterline, never a second collision boundary.
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + index, s = 0.07 + visualNoise(seed + i * 2) * 0.11;
      pebble(i % 3 ? '#a0afa3' : '#c2bda7', x + Math.cos(a) * rx * 0.96, 0.19, z + Math.sin(a) * rz * 0.96, s * 1.5, s * 0.65, s);
    }
    // Ornamental lily pads sit at the water surface, beneath the simulated swimmers.
    for (let i = 0; i < 5; i++) {
      const a = visualNoise(seed + i * 37) * Math.PI * 2, size = 0.1 + visualNoise(seed + i * 19) * 0.1;
      const px = x + Math.cos(a) * (rx + 0.23 + i * 0.04), pz = z + Math.sin(a) * (rz + 0.21 + i * 0.04);
      const pad = mesh(new T.CircleGeometry(size, 32, 0.24, Math.PI * 2 - 0.48), i % 2 ? '#748f7d' : '#8a9f84', px, WATER - 0.005, pz);
      pad.rotation.x = -Math.PI / 2; pad.rotation.z = a;
      if (i % 3 === 0) for (let petal = 0; petal < 5; petal++) {
        const angle = petal / 5 * Math.PI * 2;
        pebble('#dfb2b1', px + Math.cos(angle) * 0.025, WATER + 0.02, pz + Math.sin(angle) * 0.025, 0.032, 0.035, 0.024);
      }
    }
  }
  // A tiny, warm landmark on an existing bank, scaled to every preset's geometry.
  const bank = pool.obstacles[pool.preset === 'channel' ? 0 : 1];
  if (bank) {
    const x = sceneX(bank.x) - 0.35, z = sceneZ(bank.y) + bank.ry * UNIT * 0.35;
    box('#e4c69b', x, 0.95, z, 0.85, 0.7, 0.7);
    const gable = new T.Shape(); gable.moveTo(-0.56, 0); gable.lineTo(0, 0.43); gable.lineTo(0.56, 0); gable.closePath();
    const roof = new T.ExtrudeGeometry(gable, { depth: 0.92, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, steps: 1 });
    roof.translate(0, 0, -0.46); mesh(roof, '#a06d78', x, 1.3, z);
    for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
      const tile = box(row % 2 ? '#b27f83' : '#a9747e', x + side * 0.275, 1.535, z - 0.34 + row * 0.23, 0.69, 0.025, 0.217);
      tile.rotation.z = -side * Math.atan2(0.43, 0.56);
    }
    box('#775f63', x - 0.18, 0.84, z + 0.356, 0.22, 0.46, 0.035);
    box('#ffd79a', x + 0.22, 1.02, z + 0.36, 0.22, 0.25, 0.04, true);
    box('#ab856c', x + 0.22, 1.02, z + 0.388, 0.025, 0.26, 0.025);
    box('#ab856c', x + 0.22, 1.02, z + 0.39, 0.23, 0.025, 0.025);
    box('#a28b85', x + 0.25, 1.72, z - 0.12, 0.16, 0.38, 0.17);
    const front = sceneZ(bank.y) + bank.ry * UNIT;
    for (let i = 0; i < 8; i++) box(i % 2 ? '#af9271' : '#c1a07b', x, 0.17, front - 0.36 + i * 0.12, 0.62, 0.09, 0.105);
    for (const side of [-1, 1]) {
      mesh(new T.CylinderGeometry(0.035, 0.05, 0.55, 6), '#856e60', x + side * 0.32, 0.29, front + 0.38);
      mesh(new T.SphereGeometry(1, 8, 6), '#ffd09a', x + side * 0.32, 0.65, front + 0.38, 0.085, 0.11, 0.085, true);
      box('#7c685e', x + side * 0.32, 0.74, front + 0.38, 0.16, 0.045, 0.16);
    }
    const lantern = new T.PointLight('#ffc28b', 3.2, 3.8, 2); lantern.position.set(x, 0.75, front + 0.3); root.add(lantern);
  }
  // Bake static geometry by material: many little details, few draw calls.
  root.updateMatrixWorld(true);
  const buckets = new Map<T.Material, T.BufferGeometry[]>();
  for (const child of [...root.children]) if (child instanceof T.Mesh) {
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    const list = buckets.get(child.material) ?? []; list.push(geometry); buckets.set(child.material, list);
    child.geometry.dispose(); root.remove(child);
  }
  for (const [mat, geometries] of buckets) {
    const combined = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
    if (!combined) continue;
    const m = new T.Mesh(combined, mat); m.castShadow = true; m.receiveShadow = true; root.add(m);
  }
  return root;
}

export function makeWater(): T.Mesh<T.PlaneGeometry, T.ShaderMaterial> {
  const material = new T.ShaderMaterial({
    uniforms: { time: { value: 0 }, lamp: { value: new T.Vector2() }, hasLamp: { value: 0 } },
    vertexShader: `varying vec2 vP;
      void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; uniform vec2 lamp; uniform float hasLamp; varying vec2 vP;
      float strokeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main() {
        vec2 p = vec2(vP.x, -vP.y);
        vec2 grid = p * vec2(.6,1.25) + vec2(time * .024,0.);
        vec2 tile = floor(grid), local = fract(grid);
        float center = .25 + .5 * strokeHash(tile + vec2(2.7,8.1));
        float width = .13 + .2 * strokeHash(tile + vec2(6.2,1.4));
        float dy = local.y - center + sin(local.x * 4. + time * .1) * .025;
        float ribbons = (1. - smoothstep(.011,.032,abs(dy)))
          * (1. - smoothstep(width - .06,width,abs(local.x - .5)))
          * step(.54,strokeHash(tile + vec2(4.1,3.2)));
        float poolLight = exp(-dot(p - vec2(-1., 1.), p - vec2(-1., 1.)) * .008);
        vec3 color = mix(vec3(.025,.028,.048), vec3(.061,.080,.108), poolLight);
        color += vec3(.009,.010,.017) * ribbons;
        vec2 reflection = p - lamp - vec2(0., .4);
        reflection.x += sin(p.y * 8. - time * .5) * .055;
        float amber = exp(-reflection.x * reflection.x * 18. - reflection.y * reflection.y * 1.5) * hasLamp;
        color += vec3(.20,.11,.045) * amber * (.16 + ribbons * .7);
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = new T.Mesh(new T.PlaneGeometry(120, 120), material);
  water.rotation.x = -Math.PI / 2; water.position.y = WATER - 0.035;
  return water;
}

export function disposeObject(root: T.Object3D): void {
  const materials = new Set<T.Material>(), geometries = new Set<T.BufferGeometry>();
  root.traverse(o => {
    if (o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Points) {
      geometries.add(o.geometry);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m));
      if (o instanceof T.InstancedMesh) o.dispose();
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}
