import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sceneX, sceneZ, UNIT, WATER } from './camera';
import type { Pool } from './model';

export const visualNoise = (n: number): number => { const f = Math.sin(n * 127.1 + 311.7) * 43758.5453; return f - Math.floor(f); };

/** Static diorama, rebuilt only when the actual obstacle geometry changes. */
export function makeGarden(pool: Pool): T.Group {
  const root = new T.Group(), materials = new Map<string, T.MeshStandardMaterial>();
  const material = (color: string, glow = false) => {
    const key = color + glow;
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness: 0.95, emissive: glow ? color : '#000000', emissiveIntensity: glow ? 1.8 : 0 }));
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
      pebble(['#688f78', '#739c7c', '#85ac88', '#7aa085', '#96b48b'][k], x + Math.cos(angle) * radius, y + (1.05 + k * 0.075) * size, z + Math.sin(angle) * radius, 0.54 * size, 0.65 * size, 0.51 * size);
    }
  };
  const mushroom = (x: number, z: number, size: number, rose: boolean) => {
    mesh(new T.CylinderGeometry(0.025, 0.04, 0.2, 7), '#eddbaf', x, 0.68, z, size, size, size);
    pebble(rose ? '#cf8b91' : '#d9b175', x, 0.68 + 0.1 * size, z, 0.12 * size, 0.075 * size, 0.12 * size);
    pebble('#f6dfb6', x - 0.03 * size, 0.68 + 0.17 * size, z, 0.025 * size, 0.01, 0.02 * size);
  };
  for (const [index, r] of pool.obstacles.entries()) {
    const x = sceneX(r.x), z = sceneZ(r.y), rx = r.rx * UNIT, rz = r.ry * UNIT;
    mesh(new T.CylinderGeometry(1, 0.96, 0.38, 64), '#667f83', x, -0.2, z, rx + 0.13, 1, rz + 0.13);
    mesh(new T.CylinderGeometry(1, 1.02, 0.22, 64), '#b4b69a', x, 0.03, z, rx + 0.055, 1, rz + 0.055);
    mesh(new T.CylinderGeometry(0.97, 1, 0.32, 64), '#6e957e', x, 0.23, z, rx, 1, rz);
    pebble('#8dac88', x, 0.33, z, rx * 0.98, 0.27, rz * 0.98);
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
  }
  // A tiny, warm landmark on an existing bank, scaled to every preset's geometry.
  const bank = pool.obstacles[pool.preset === 'channel' ? 0 : 1];
  if (bank) {
    const x = sceneX(bank.x) - 0.35, z = sceneZ(bank.y) + bank.ry * UNIT * 0.35;
    box('#e4c69b', x, 0.95, z, 0.85, 0.7, 0.7);
    const gable = new T.Shape(); gable.moveTo(-0.56, 0); gable.lineTo(0, 0.43); gable.lineTo(0.56, 0); gable.closePath();
    const roof = new T.ExtrudeGeometry(gable, { depth: 0.92, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, steps: 1 });
    roof.translate(0, 0, -0.46); mesh(roof, '#a06d78', x, 1.3, z);
    box('#775f63', x - 0.18, 0.84, z + 0.356, 0.22, 0.46, 0.035);
    box('#ffd79a', x + 0.22, 1.02, z + 0.36, 0.22, 0.25, 0.04, true);
    box('#ab856c', x + 0.22, 1.02, z + 0.388, 0.025, 0.26, 0.025);
    box('#ab856c', x + 0.22, 1.02, z + 0.39, 0.23, 0.025, 0.025);
    box('#a28b85', x + 0.25, 1.72, z - 0.12, 0.16, 0.38, 0.17);
    const front = sceneZ(bank.y) + bank.ry * UNIT;
    for (let i = 0; i < 8; i++) box(i % 2 ? '#af9271' : '#c1a07b', x, 0.17, front - 0.36 + i * 0.12, 0.62, 0.09, 0.105);
    for (const side of [-1, 1]) {
      mesh(new T.CylinderGeometry(0.035, 0.05, 0.55, 6), '#856e60', x + side * 0.32, 0.29, front + 0.38);
      box('#ffd694', x + side * 0.32, 0.63, front + 0.38, 0.12, 0.17, 0.12, true);
      box('#7c685e', x + side * 0.32, 0.74, front + 0.38, 0.16, 0.045, 0.16);
    }
    const lantern = new T.PointLight('#ffcf8b', 2.3, 3.8, 2); lantern.position.set(x, 0.75, front + 0.3); root.add(lantern);
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
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vP;
      void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; varying vec2 vP;
      void main() {
        vec2 p = vP;
        float wave = sin(p.x * 2.1 + sin(p.y * 1.4 + time * .16)) * sin(p.y * 3.0 - time * .24);
        float ribbons = smoothstep(.84, .98, wave) * .07;
        float poolLight = exp(-dot(p - vec2(-1., 1.), p - vec2(-1., 1.)) * .008);
        vec3 color = mix(vec3(.018,.030,.055), vec3(.040,.080,.105), poolLight);
        color += vec3(.2,.28,.25) * ribbons;
        float shimmer = pow(max(0., sin(p.x * 13. + sin(p.y * 8. + time * .3)) * sin(p.y * 21. - time * .4)), 22.) * .017;
        gl_FragColor = vec4(color + shimmer, 1.);
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
