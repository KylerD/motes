import { DT, WIDTH, HEIGHT, clamp } from './model';
import type { Pool, View, Cell } from './model';
import { colonies } from './world';
import { SanctuarySpace, SANCTUARIES } from './sanctuary-space';
import type { SanctuaryMood } from './sanctuary-space';

const noise = (n: number): number => { const f = Math.sin(n * 127.1 + 311.7) * 43758.5453; return f - Math.floor(f); };
const masks: Record<SanctuaryMood, number[][]> = {
  rain: [[.16,.82],[.23,.745],[.41,.657],[.52,.625],[.66,.667],[.774,.706],[.717,.813],[.651,.944],[.45,.98],[.253,.915]],
  meadow: [[.29,.81],[.40,.74],[.48,.71],[.51,.67],[.61,.65],[.77,.71],[.88,.73],[.84,.87],[.70,1],[.48,.98],[.39,.94]],
};

/** Original paintings with local water displacement, weather and lights from the real cells.
 * Everything moving uses model time. No image manipulation ever changes the simulation. */
export class SanctuaryRenderer {
  readonly kind = 'painting';
  readonly space: SanctuarySpace;
  weather = true;
  exploring = false;
  private ctx: CanvasRenderingContext2D;
  private images = new Map<SanctuaryMood, HTMLImageElement>();
  private failures = new Set<SanctuaryMood>();
  private sprites = new Map<string, HTMLCanvasElement>();
  private width = 1; private height = 1; private ratio = 1;
  private view: View | undefined;
  constructor(private canvas: HTMLCanvasElement, mood: SanctuaryMood) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.space = new SanctuarySpace(mood);
    this.load(mood);
  }
  get ready() { return !!this.images.get(this.space.mood)?.naturalWidth; }
  get failed() { return this.failures.has(this.space.mood); }
  get diagnostics() { return { kind: this.kind, images: this.images.size, sprites: this.sprites.size }; }
  get scale() { const a = this.space.project(WIDTH/2,HEIGHT/2), b = this.space.project(WIDTH/2+1,HEIGHT/2); return Math.abs(b.x-a.x); }
  retryArt(): void { this.images.delete(this.space.mood); this.failures.delete(this.space.mood); this.load(this.space.mood); }
  setMood(mood: SanctuaryMood): void { this.space.mood = mood; this.load(mood); this.resize(); }
  private load(mood: SanctuaryMood): void {
    if (this.images.has(mood)) return;
    const picture = new Image(); picture.decoding = 'async';
    picture.onload = () => this.resize(); picture.onerror = () => this.failures.add(mood);
    picture.src = SANCTUARIES[mood].image; this.images.set(mood, picture);
  }
  resize(): void {
    const r = this.canvas.getBoundingClientRect(); this.width = Math.max(1,r.width); this.height = Math.max(1,r.height);
    this.ratio = Math.min(devicePixelRatio, 2, 2400 / this.width);
    this.canvas.width = Math.round(this.width * this.ratio); this.canvas.height = Math.round(this.height * this.ratio);
    this.updateSpace();
  }
  private updateSpace(view = this.view): void {
    this.view = view;
    const picture = this.images.get(this.space.mood);
    this.space.resize(this.width,this.height,picture?.naturalWidth ? picture.naturalWidth/picture.naturalHeight : 16/9,this.exploring ? view : undefined);
  }
  toScreen(x: number,y: number,view: View) { this.updateSpace(view); return this.space.project(x,y); }
  toScreenCell(cell: Cell,view: View) { return this.toScreen(cell.x,cell.y,view); }
  toWorld(x: number,y: number,view: View) {
    this.updateSpace(view); const p = this.space.unproject(x,y);
    return {x:clamp(Number.isFinite(p.x)?p.x:WIDTH/2,0,WIDTH),y:clamp(Number.isFinite(p.y)?p.y:HEIGHT/2,0,HEIGHT)};
  }
  panDelta(dx: number,dy: number,view: View) {
    this.updateSpace(view); const center = this.space.project(view.x,view.y), after = this.space.unproject(center.x+dx,center.y+dy);
    return { x: view.x-after.x,y: view.y-after.y };
  }
  pick(pool: Pool,x: number,y: number,view: View): number | null {
    this.updateSpace(view); let nearest: number | null = null, distance = Infinity;
    for (const cell of pool.cells) {
      const p = this.space.project(cell.x,cell.y), d = Math.hypot(x-p.x,y-p.y);
      if (d < distance && d < Math.max(12,cell.radius*this.scale+5)) { nearest = cell.id; distance = d; }
    }
    return nearest;
  }
  private pathWater(): void {
    const ctx = this.ctx; ctx.beginPath();
    masks[this.space.mood].forEach(([u,v], i) => { const p = this.space.screen(u,v); if (i) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y); });
    ctx.closePath();
  }
  private glow(color: string): HTMLCanvasElement {
    const existing = this.sprites.get(color); if (existing) return existing;
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
    const ctx = sprite.getContext('2d')!, g = ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.07, color); g.addColorStop(.22, color + 'b0'); g.addColorStop(.5, color + '30'); g.addColorStop(1, color + '00');
    ctx.fillStyle = g; ctx.fillRect(0,0,64,64); this.sprites.set(color,sprite); return sprite;
  }
  draw(pool: Pool,view: View): void {
    this.updateSpace(view);
    const ctx = this.ctx, space = this.space, time = pool.step * DT, rain = space.mood === 'rain';
    const picture = this.images.get(space.mood);
    ctx.setTransform(this.ratio,0,0,this.ratio,0,0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rain ? '#071b38' : '#173d3d'; ctx.fillRect(0,0,this.width,this.height);
    if (picture?.naturalWidth) {
      ctx.drawImage(picture,space.offsetX,space.offsetY,space.imageWidth,space.imageHeight);
    // Displace only the painted water, retaining the illustration's irregular shoreline.
    ctx.save(); this.pathWater(); ctx.clip();
    const start = Math.floor(picture.naturalHeight * .60), strip = Math.ceil(picture.naturalHeight / 100);
    for (let y = start; y < picture.naturalHeight; y += strip) {
      const h = Math.min(strip,picture.naturalHeight-y), v = y / picture.naturalHeight;
      const shift = Math.sin(v * 91 + time * .75) * 1.4 + Math.sin(v * 157 - time * .42) * .8;
      ctx.drawImage(picture,0,y,picture.naturalWidth,h,space.offsetX + shift,space.offsetY + v * space.imageHeight,space.imageWidth,h / picture.naturalHeight * space.imageHeight + .5);
    }
    ctx.restore();
    }
    // Small, luminous communities inhabit the water; their positions and pulses are live cells.
    ctx.save(); this.pathWater(); ctx.clip(); ctx.globalCompositeOperation = 'screen';
    const palette = rain ? ['#ffca79','#64f6dd','#ff7fca','#b5abff'] : ['#ffde77','#c4f18e','#ffc3b5','#c6deff'];
    if (this.exploring && view.lens !== 'life') {
      ctx.globalCompositeOperation = 'source-over';
      this.shelves(pool); this.connections(pool,view);
    } else if (this.exploring && view.selected !== null) this.connections(pool,view);
    ctx.globalCompositeOperation = 'screen';
    for (const cell of pool.cells) {
      const p = space.project(cell.x,cell.y), pulse = .45 + .55 * Math.max(0,Math.sin(cell.phase));
      const size = (3 + pulse * 3) * (.6 + cell.energy * .6) * Math.min(3,space.imageWidth / 1500);
      ctx.globalAlpha = .25 + pulse * .42;
      const color = this.exploring && view.lens === 'energy' ? cell.energy > .55 ? '#bdff91' : '#ff967c' : palette[cell.lineage];
      ctx.drawImage(this.glow(color),p.x-size,p.y-size,size*2,size*2);
    }
    ctx.globalAlpha = 1;
    for (const flow of pool.disturbances) {
      const age = (pool.step-flow.born)*DT; if (age < 0 || age > 6) continue;
      const p = space.project(flow.x,flow.y);
      ctx.strokeStyle = rain ? '#a3e7ef' : '#fff0ac'; ctx.lineWidth = .8;
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = Math.max(0,(1-age/6)*(.38-i*.07));
        ctx.beginPath(); ctx.ellipse(p.x,p.y,8+age*20+i*9,3+age*5+i*2,0,0,Math.PI*2); ctx.stroke();
      }
    }
    if (this.weather && rain) for (let i = 0; i < 24; i++) {
      const p = space.project(noise(i+13)*WIDTH,noise(i+90)*HEIGHT), age = (time*.48+noise(i+31))%1;
      ctx.globalAlpha = (1-age)*.18; ctx.strokeStyle = i%3 ? '#8bdfff' : '#ffadd9'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.ellipse(p.x,p.y,2+age*16,1+age*4,0,0,Math.PI*2); ctx.stroke();
    }
    ctx.restore();
    if (this.exploring) this.instruments(pool,view);
    if (this.weather) {
      if (rain) this.rain(time,pool.seed); else this.meadow(time,pool.seed);
    }
  }
  private shelves(pool: Pool): void {
    const ctx = this.ctx; ctx.globalAlpha = .65; ctx.strokeStyle = '#7eaba9'; ctx.lineWidth = .8;
    for (const shelf of pool.obstacles) {
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) { const a = i/48*Math.PI*2,p = this.space.project(shelf.x+Math.cos(a)*shelf.rx,shelf.y+Math.sin(a)*shelf.ry); if (i) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y); }
      ctx.stroke();
    }
    for (const food of pool.nutrients) {
      const p = this.space.project(food.x,food.y); ctx.fillStyle = '#efda92'; ctx.globalAlpha = .15+food.amount*.15;
      ctx.beginPath(); ctx.ellipse(p.x,p.y,Math.max(2,food.radius*this.scale),Math.max(1,food.radius*this.scale*.45),0,0,Math.PI*2); ctx.fill();
    }
  }
  private connections(pool: Pool,view: View): void {
    const ctx = this.ctx, map = new Map(pool.cells.map(c => [c.id,c]));
    const selected = view.selected === null ? undefined : colonies(pool).find(g => g.cells.some(c => c.id === view.selected));
    const ids = new Set(selected?.cells.map(c => c.id));
    for (const bond of pool.bonds) {
      if (view.lens === 'life' && !ids.has(bond.a)) continue;
      const a = map.get(bond.a),b = map.get(bond.b); if (!a || !b) continue;
      const p = this.space.project(a.x,a.y),q = this.space.project(b.x,b.y);
      ctx.globalAlpha = view.lens === 'bonds' ? .7 : .4; ctx.strokeStyle = bond.strain > .45 ? '#ffab95' : '#a8e2e1'; ctx.lineWidth = Math.min(1.4,.65+Math.abs(bond.flow)*10);
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke();
    }
  }
  private instruments(pool: Pool,view: View): void {
    const ctx = this.ctx; ctx.save();
    const ring = (x: number,y: number,radius: number,color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = .8; ctx.beginPath();
      for (let i = 0; i <= 64; i++) { const a = i/64*Math.PI*2,p = this.space.project(x+Math.cos(a)*radius,y+Math.sin(a)*radius); if (i) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y); } ctx.stroke();
    };
    if (view.pointer && view.tool !== 'observe') ring(view.pointer.x,view.pointer.y,view.tool === 'cut' ? 24 : view.tool === 'feed' ? 85 : 115,'#ffe1ac');
    const selected = view.selected === null ? undefined : colonies(pool).find(g => g.cells.some(c => c.id === view.selected));
    if (selected) ring(selected.x,selected.y,selected.radius+18,'#ffedc8');
    ctx.restore();
  }
  private rain(time: number, seed: number): void {
    const ctx = this.ctx; ctx.save(); ctx.strokeStyle = '#b8dfff'; ctx.lineCap = 'round';
    const count = Math.round(Math.min(190,this.width/7));
    for (let i = 0; i < count; i++) {
      const depth = .25+noise(i+55)*.75, travel = (noise(i+seed)+time*(.12+depth*.18))%1;
      const x = noise(i+401)*this.width - travel*25, y = travel*(this.height+120)-60;
      ctx.globalAlpha = .07+depth*.19; ctx.lineWidth = .45+depth*.65;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-1.7*depth,y+12+depth*24); ctx.stroke();
    }
    ctx.restore();
  }
  private meadow(time: number, seed: number): void {
    const ctx = this.ctx; ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 48; i++) {
      const x = ((noise(i+seed)+time*.004)%1)*this.width + Math.sin(time*.3+i)*15;
      const y = noise(i+80)*this.height + Math.sin(time*.2+i)*12, s = 1.4+noise(i+170)*4;
      ctx.globalAlpha = .16+Math.pow(Math.max(0,Math.sin(time*.45+i)),2)*.46;
      ctx.drawImage(this.glow('#ffe7a0'),x-s,y-s,s*2,s*2);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 5; i++) {
      const p = this.space.screen(.18+noise(i+9)*.65+Math.sin(time*.08+i)*.035,.46+noise(i+84)*.35+Math.cos(time*.13+i)*.025);
      const wing = .4+Math.abs(Math.sin(time*3.4+i))*.6;
      ctx.globalAlpha = .72; ctx.fillStyle = i%2 ? '#fff1ac' : '#ffd788';
      for (const side of [-1,1]) { ctx.beginPath(); ctx.ellipse(p.x+side*2*wing,p.y,3*wing,2.5,-side*.4,0,Math.PI*2); ctx.fill(); }
    }
    ctx.restore();
  }
  dispose(): void { this.images.forEach(img => { img.onload = null; img.onerror = null; }); this.images.clear(); this.sprites.clear(); }
}
