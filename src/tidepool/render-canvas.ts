import { WIDTH, HEIGHT, DT, LINEAGES } from './model';
import type { Pool, Cell, View, Colony } from './model';
import { colonies } from './world';

type Point = { x: number; y: number };
const hash = (n: number): number => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

function hull(cells: Cell[]): Point[] {
  const points = cells.map(c => ({ x: c.x, y: c.y })).sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lower: Point[] = [], upper: Point[] = [];
  for (const p of points) { while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of points.slice().reverse()) { while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function outline(ctx: CanvasRenderingContext2D, points: Point[], cx: number, cy: number, padding: number): void {
  const p = points.map(v => {
    const d = Math.hypot(v.x - cx, v.y - cy) || 1;
    return { x: v.x + (v.x - cx) / d * padding, y: v.y + (v.y - cy) / d * padding };
  });
  ctx.beginPath();
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    if (i === 0) ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
    const c = p[(i + 2) % p.length];
    ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
  }
  ctx.closePath();
}

export class CanvasPoolRenderer {
  readonly kind = 'canvas';
  private ctx: CanvasRenderingContext2D;
  private backdrop = document.createElement('canvas');
  private backdropKey = '';
  width = 1;
  height = 1;
  scale = 1;
  groups: Colony[] = [];
  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('This browser could not open a drawing canvas.');
    this.ctx = ctx;
  }
  resize(): void {
    const r = this.canvas.getBoundingClientRect(), dpr = Math.min(1, 1000 / r.width);
    this.width = r.width; this.height = r.height;
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
  }
  toWorld(x: number, y: number, view: View): Point {
    const s = Math.min(this.width / WIDTH, this.height / HEIGHT) * view.zoom;
    return { x: (x - this.width / 2) / s + view.x, y: (y - this.height / 2) / s + view.y };
  }
  toScreen(x: number, y: number, view: View): Point {
    const s = Math.min(this.width / WIDTH, this.height / HEIGHT) * view.zoom;
    return { x: this.width / 2 + (x - view.x) * s, y: this.height / 2 + (y - view.y) * s };
  }
  dispose(): void { this.backdrop.width = 0; this.backdrop.height = 0; }
  private terrain(pool: Pool): void {
    const key = `${pool.seed}:${pool.preset}`;
    if (key === this.backdropKey) return;
    this.backdropKey = key; this.backdrop.width = WIDTH; this.backdrop.height = HEIGHT;
    const c = this.backdrop.getContext('2d')!;
    c.fillStyle = '#273b50'; c.fillRect(0, 0, WIDTH, HEIGHT);
    const light = c.createRadialGradient(760, 440, 50, 780, 470, 830);
    light.addColorStop(0, '#3c6070'); light.addColorStop(0.55, '#314c63'); light.addColorStop(1, '#283a55');
    c.fillStyle = light; c.fillRect(0, 0, WIDTH, HEIGHT);
    // The mineral shelves use the same ellipses as collision detection.
    for (const rock of pool.obstacles) {
      c.save();
      c.translate(rock.x, rock.y);
      for (let layer = 4; layer >= 0; layer--) {
        c.beginPath(); c.ellipse(0, 0, rock.rx + layer * 7, rock.ry + layer * 7, 0, 0, Math.PI * 2);
        c.fillStyle = layer === 0 ? '#7d9a83' : ['#7d9a83', '#acb294', '#527a7f', '#426878', '#385b70'][layer];
        c.fill();
      }
      c.beginPath(); c.ellipse(0, 0, rock.rx, rock.ry, 0, 0, Math.PI * 2); c.clip();
      const shade = c.createLinearGradient(-rock.rx, -rock.ry, rock.rx, rock.ry);
      shade.addColorStop(0, '#8caa8a'); shade.addColorStop(0.45, '#718e7c'); shade.addColorStop(1, '#5e7875');
      c.fillStyle = shade; c.fillRect(-rock.rx, -rock.ry, rock.rx * 2, rock.ry * 2);
      for (let i = 0; i < 110; i++) {
        const seed = i + rock.seed * 1037, x = (hash(seed) - 0.5) * rock.rx * 2, y = (hash(seed + 38) - 0.5) * rock.ry * 2;
        const size = 2 + hash(seed + 60) * 4;
        c.fillStyle = hash(seed + 80) > 0.8 ? '#d9c3a1' : 'rgba(48,86,76,0.35)';
        c.fillRect(x, y, size, 2); c.fillRect(x + size * 0.4, y - size * 0.6, 2, size);
      }
      // Little reed tufts and flowers grow on the solid islands.
      for (let i = 0; i < 23; i++) {
        const x = (hash(i + rock.seed * 15) - 0.5) * rock.rx * 2, y = (hash(i + 95) - 0.5) * rock.ry * 2;
        c.strokeStyle = '#476e65'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x - 5, y - 11); c.lineTo(x, y); c.lineTo(x + 3, y - 17); c.moveTo(x, y); c.lineTo(x + 10, y - 9); c.stroke();
        if (i % 3 === 0) { c.fillStyle = i % 2 ? '#e9b6ae' : '#e2d4a2'; c.fillRect(x + 1, y - 20, 5, 5); }
      }
      c.restore();
      c.beginPath(); c.ellipse(rock.x, rock.y, rock.rx, rock.ry, 0, 0, Math.PI * 2);
      c.strokeStyle = '#b2b69a'; c.lineWidth = 2; c.stroke();
    }
  }
  draw(pool: Pool, view: View): void {
    const c = this.ctx, dpr = this.canvas.width / this.width;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#26364c'; c.fillRect(0, 0, this.width, this.height);
    this.scale = Math.min(this.width / WIDTH, this.height / HEIGHT) * view.zoom;
    c.translate(this.width / 2, this.height / 2); c.scale(this.scale, this.scale); c.translate(-view.x, -view.y);
    this.terrain(pool); c.drawImage(this.backdrop, 0, 0);
    const time = pool.step * DT;
    for (const r of pool.nutrients) {
      const glow = c.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.radius);
      glow.addColorStop(0, `rgba(153,198,153,${r.amount * (view.lens === 'energy' ? 0.25 : 0.085)})`);
      glow.addColorStop(1, 'rgba(92,162,127,0)'); c.fillStyle = glow;
      c.beginPath(); c.arc(r.x, r.y, r.radius, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < Math.floor(r.amount * 42); i++) {
        const angle = hash(i + r.id * 23) * 6.28, radius = Math.sqrt(hash(i + r.id * 59)) * r.radius * 0.8;
        const x = r.x + Math.cos(angle + time * 0.005) * radius, y = r.y + Math.sin(angle + time * 0.005) * radius;
        c.fillStyle = `rgba(219,217,160,${0.25 + hash(i + 7) * 0.3})`;
        c.fillRect(x, y, 2, 2);
      }
    }
    for (let i = 0; i < 190; i++) {
      const x = (hash(i + pool.seed) * WIDTH + time * (0.3 + hash(i + 5))) % WIDTH;
      const y = hash(i + 400) * HEIGHT + Math.sin(time * 0.07 + i) * 4;
      c.fillStyle = `rgba(209,208,174,${0.06 + hash(i + 17) * 0.15})`;
      c.fillRect(x, y, 1.5, 1.5);
    }
    this.groups = colonies(pool);
    const selected = this.groups.find(g => g.cells.some(cell => cell.id === view.selected));
    const selectedIds = new Set(selected?.cells.map(cell => cell.id) ?? []);
    for (const group of this.groups) {
      if (group.cells.length < 4) continue;
      const rgb = LINEAGES[group.lineage].rgb, points = hull(group.cells);
      c.save();
      outline(c, points, group.x, group.y, 7);
      c.fillStyle = `rgba(${rgb},${view.lens === 'bonds' ? 0.025 : 0.13 + group.energy * 0.1})`; c.fill();
      c.strokeStyle = `rgba(${rgb},${view.lens === 'energy' ? 0.25 : 0.65})`; c.lineWidth = 1.3; c.stroke();
      if (selected?.id === group.id) {
        outline(c, points, group.x, group.y, 17);
        c.strokeStyle = `rgba(${rgb},0.28)`; c.lineWidth = 0.8 / this.scale; c.setLineDash([2, 6]); c.stroke(); c.setLineDash([]);
      }
      c.restore();
    }
    const map = new Map(pool.cells.map(cell => [cell.id, cell]));
    for (const bond of pool.bonds) {
      const a = map.get(bond.a), b = map.get(bond.b);
      if (!a || !b) continue;
      const rgb = bond.strain > 0.45 ? '235,139,106' : LINEAGES[a.lineage].rgb;
      c.strokeStyle = `rgba(${rgb},${view.lens === 'bonds' ? 0.55 : 0.11 + (selectedIds.has(a.id) ? 0.13 : 0)})`;
      c.lineWidth = view.lens === 'bonds' ? 1.0 : 0.5;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      if (view.lens !== 'bonds') {
        const travel = ((time * 0.43 + a.phase * 0.17 + a.id * 0.13) % 1 + 1) % 1;
        const energyVisible = Math.min(1, Math.abs(bond.flow) * 700);
        const t = bond.flow > 0 ? travel : 1 - travel;
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        c.fillStyle = `rgba(${rgb},${0.06 + energyVisible * 0.65})`;
        c.beginPath(); c.arc(x, y, view.lens === 'energy' ? 1.5 : 0.8, 0, 6.28); c.fill();
      }
    }
    for (const cell of pool.cells) this.cell(cell, view, selectedIds.has(cell.id));
    // A tiny game-like face gives each assembled body a readable direction.
    // Its placement follows real cell positions and the body's average polarity.
    if (view.lens === 'life') for (const group of this.groups) {
      if (group.cells.length < 8) continue;
      const heading = Math.atan2(group.cells.reduce((s, cell) => s + Math.sin(cell.angle), 0), group.cells.reduce((s, cell) => s + Math.cos(cell.angle), 0));
      const dx = Math.cos(heading), dy = Math.sin(heading);
      const lead = group.cells.reduce((a, b) => (a.x - group.x) * dx + (a.y - group.y) * dy > (b.x - group.x) * dx + (b.y - group.y) * dy ? a : b);
      c.save(); c.translate(lead.x - dx * 12, lead.y - dy * 12); c.rotate(heading);
      c.fillStyle = '#33414b';
      for (const side of [-1, 1]) { c.beginPath(); c.ellipse(0, side * 4, 2.8, 2.2, 0, 0, 6.28); c.fill(); }
      c.fillStyle = '#fff0cd'; c.fillRect(0, -5, 1.2, 1.2); c.fillRect(0, 3, 1.2, 1.2);
      c.restore();
    }
    for (const flow of pool.disturbances) {
      const age = (pool.step - flow.born) * DT;
      if (age < 0) continue;
      c.strokeStyle = `rgba(141,193,207,${Math.max(0, 0.22 - age * 0.045)})`; c.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) {
        c.beginPath(); c.arc(flow.x, flow.y, 20 + age * 35 + i * 18, age * 0.2 + i, age * 0.2 + i + 3.4); c.stroke();
      }
    }
    for (const e of pool.events.slice(-5)) {
      const age = (pool.step - e.step) * DT;
      if (age < 0 || age > 3 || e.type !== 'birth') continue;
      c.strokeStyle = `rgba(222,234,195,${(1 - age / 3) * 0.4})`;
      c.beginPath(); c.arc(e.x, e.y, 10 + age * 14, 0, 6.28); c.stroke();
    }
    if (view.pointer && view.tool !== 'observe') {
      const radius = view.tool === 'cut' ? 24 : view.tool === 'feed' ? 85 : 115;
      const rgb = view.tool === 'cut' ? '226,151,135' : view.tool === 'feed' ? '164,201,156' : '160,200,222';
      c.strokeStyle = `rgba(${rgb},0.5)`; c.lineWidth = 1 / this.scale; c.setLineDash([3, 5]);
      c.beginPath(); c.arc(view.pointer.x, view.pointer.y, radius, 0, 6.28); c.stroke(); c.setLineDash([]);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vignette = c.createRadialGradient(this.width / 2, this.height / 2, this.width * 0.15, this.width / 2, this.height / 2, this.width * 0.7);
    vignette.addColorStop(0, 'rgba(25,26,48,0)'); vignette.addColorStop(1, 'rgba(25,26,48,0.3)');
    c.fillStyle = vignette; c.fillRect(0, 0, this.width, this.height);
  }
  private cell(cell: Cell, view: View, selected: boolean): void {
    const c = this.ctx, rgb = view.lens === 'energy' ? (cell.energy > 0.55 ? '193,225,147' : '229,143,102') : LINEAGES[cell.lineage].rgb;
    const pulse = cell.activity || 0.6, r = cell.radius * (1 + pulse * 0.11);
    const alpha = 0.6 + cell.energy * 0.4;
    c.save(); c.translate(cell.x, cell.y); c.rotate(cell.angle);
    // A small membrane, nucleus and motile cilia encode the real cell role.
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, r * 3);
    glow.addColorStop(0, `rgba(${rgb},${(0.06 + pulse * 0.08) * cell.energy})`); glow.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = glow; c.fillRect(-r * 3, -r * 3, r * 6, r * 6);
    c.beginPath(); c.ellipse(0, 0, r * (cell.role === 1 ? 1.25 : 1), r * 0.8, 0, 0, Math.PI * 2);
    c.fillStyle = `rgba(${rgb},${0.15 + cell.energy * 0.2})`; c.fill();
    c.strokeStyle = `rgba(${rgb},${alpha})`; c.lineWidth = selected ? 1.5 : 1.15; c.stroke();
    c.beginPath(); c.arc(r * 0.12, 0, cell.role === 0 ? 1.6 : 1.15, 0, 6.28);
    c.fillStyle = `rgba(${rgb},${alpha * (0.55 + pulse * 0.45)})`; c.fill();
    if (cell.role === 1) {
      c.strokeStyle = `rgba(${rgb},0.27)`; c.lineWidth = 0.45;
      c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(-r * 2.2, Math.sin(cell.phase) * 5, -r * 3.8, Math.sin(cell.phase + 1) * 4); c.stroke();
    } else if (cell.role === 2) {
      c.strokeStyle = `rgba(${rgb},0.24)`; c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(0, -r * 0.9); c.lineTo(0, r * 0.9); c.stroke();
    }
    c.restore();
  }
}
