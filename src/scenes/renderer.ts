import { SCENES, type Edition, type Point, type SceneId } from './edition';

const TAU = Math.PI*2;
const noise = (n: number) => { const f = Math.sin(n*127.1+311.7)*43758.5453; return f-Math.floor(f); };
interface Ripple { u:number; v:number; born:number; }

/** A place unfolding in time. No organism model or simulated music controls the painting. */
export class SceneRenderer {
  private ctx: CanvasRenderingContext2D;
  private images = new Map<SceneId,HTMLImageElement>();
  private failures = new Set<SceneId>();
  private glows = new Map<string,HTMLCanvasElement>();
  private previous: HTMLCanvasElement | null = null;
  private changedAt = 0;
  private width = 1; private height = 1; private ratio = 1;
  private iw = 1; private ih = 1; private ox = 0; private oy = 0;
  private ripples: Ripple[] = [];
  motion = true;
  constructor(private canvas: HTMLCanvasElement, public edition: Edition) {
    const ctx = canvas.getContext('2d',{alpha:false});
    if (!ctx) throw new Error('This browser could not open the scene. Try reloading the page.');
    this.ctx = ctx; this.load(edition.scene); this.resize();
  }
  get ready() { return !!this.images.get(this.edition.scene)?.naturalWidth; }
  get failed() { return this.failures.has(this.edition.scene); }
  get diagnostics() { return { images:this.images.size, glows:this.glows.size, ripples:this.ripples.length }; }
  setEdition(next: Edition): void {
    if(this.ready && this.motion) {
      this.previous = document.createElement('canvas');
      this.previous.width = this.canvas.width; this.previous.height = this.canvas.height;
      this.previous.getContext('2d')!.drawImage(this.canvas,0,0);
    }
    this.changedAt = 0; this.edition = next; this.ripples = []; this.load(next.scene); this.layout();
  }
  retry(): void { this.images.delete(this.edition.scene); this.failures.delete(this.edition.scene); this.load(this.edition.scene); }
  private load(id: SceneId): void {
    if (this.images.has(id)) return;
    const image = new Image(); image.decoding = 'async';
    image.onload = () => { if(id===this.edition.scene) this.layout(); };
    image.onerror = () => this.failures.add(id);
    this.images.set(id,image); image.src = SCENES[id].image;
  }
  resize(): void {
    const box = this.canvas.getBoundingClientRect(); this.width = Math.max(1,box.width); this.height = Math.max(1,box.height);
    this.ratio = Math.min(devicePixelRatio || 1,2,2560/this.width);
    this.canvas.width = Math.round(this.width*this.ratio); this.canvas.height = Math.round(this.height*this.ratio);
    this.previous = null; this.layout();
  }
  private layout(): void {
    const image = this.images.get(this.edition.scene), aspect = image?.naturalWidth ? image.naturalWidth/image.naturalHeight : 16/9;
    this.iw = Math.max(this.width,this.height*aspect); this.ih = this.iw/aspect;
    this.ox = (this.width-this.iw)*SCENES[this.edition.scene].anchor; this.oy = (this.height-this.ih)*.5;
  }
  point(u:number,v:number) { return { x:this.ox+u*this.iw, y:this.oy+v*this.ih }; }
  private waterPath(): void {
    const ctx = this.ctx; ctx.beginPath();
    SCENES[this.edition.scene].water.forEach(([u,v],i)=>{ const p=this.point(u,v); if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y); });
    ctx.closePath();
  }
  ripple(x:number,y:number,time:number): boolean {
    if(!this.motion || !this.ready) return false;
    const u=(x-this.ox)/this.iw,v=(y-this.oy)/this.ih, poly=SCENES[this.edition.scene].water;
    // Polygon containment keeps interactions inside the actual illustrated shoreline.
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
      const [xi,yi]=poly[i],[xj,yj]=poly[j];
      if(((yi>v)!==(yj>v)) && u<(xj-xi)*(v-yi)/(yj-yi)+xi) inside=!inside;
    }
    if(inside) { this.ripples.push({u,v,born:time}); this.ripples=this.ripples.slice(-12); }
    return inside;
  }
  private glow(color:string):HTMLCanvasElement {
    const saved=this.glows.get(color);if(saved)return saved;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=80;
    const ctx=canvas.getContext('2d')!, g=ctx.createRadialGradient(40,40,0,40,40,40);
    g.addColorStop(0,color+'b0');g.addColorStop(.25,color+'40');g.addColorStop(1,color+'00');
    ctx.fillStyle=g;ctx.fillRect(0,0,80,80);this.glows.set(color,canvas);return canvas;
  }
  draw(time:number,now=performance.now()):void {
    const ctx=this.ctx,{scene,intensity,warmth,seed}=this.edition,image=this.images.get(scene);
    ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    ctx.fillStyle=SCENES[scene].color;ctx.fillRect(0,0,this.width,this.height);
    if(image?.naturalWidth) {
      ctx.drawImage(image,this.ox,this.oy,this.iw,this.ih);
      if(SCENES[scene].water.length) {
        ctx.save();this.waterPath();ctx.clip();
        const strip=Math.ceil(image.naturalHeight/135),start=scene==='coast'?.38:.60;
        for(let y=Math.floor(image.naturalHeight*start);y<image.naturalHeight;y+=strip) {
          const h=Math.min(strip,image.naturalHeight-y),v=y/image.naturalHeight;
          const shift=(Math.sin(v*92+time*.58)*1.2+Math.sin(v*149-time*.37)*.7)*(scene==='coast'?1.5:1);
          ctx.drawImage(image,0,y,image.naturalWidth,h,this.ox+shift,this.oy+v*this.ih,this.iw,h/image.naturalHeight*this.ih+.6);
        }
        this.water(time);ctx.restore();
      }
      // Very slow cloud shadow and warm/cool variation, always subordinate to the painting.
      ctx.fillStyle=warmth>.5?'#ffb575':'#557cb3';ctx.globalCompositeOperation='soft-light';
      ctx.globalAlpha=.035+warmth*.035+Math.sin(time*.012+seed%13)*.018;ctx.fillRect(0,0,this.width,this.height);
      ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
      this.lights(time);
    }
    if(scene==='rain')this.rain(time,intensity);
    if(scene==='snow')this.snow(time,intensity);
    if(scene==='meadow')this.meadow(time);
    if(scene==='coast'||scene==='meadow')this.birds(time);
    if(scene==='coast'||scene==='snow')this.steam(time);
    if(this.previous) {
      if(!this.motion) this.previous=null;
      else {
        if(this.ready && !this.changedAt) this.changedAt=now;
        const blend=this.changedAt?Math.min(1,(now-this.changedAt)/1600):0;
        ctx.globalAlpha=1-blend;ctx.drawImage(this.previous,0,0,this.width,this.height);ctx.globalAlpha=1;
        if(blend===1)this.previous=null;
      }
    }
  }
  private water(time:number):void {
    const ctx=this.ctx,{scene,seed,intensity}=this.edition;
    ctx.lineWidth=.6;ctx.strokeStyle=scene==='rain'?'#bcecff':'#ffe3ae';
    if(scene==='rain')for(let i=0;i<30*intensity;i++) {
      const p=this.point(.2+noise(seed+i)*.57,.66+noise(i+82)*.34),age=(time*.39+noise(i+21))%1;
      ctx.globalAlpha=(1-age)*.22;ctx.beginPath();ctx.ellipse(p.x,p.y,2+age*17,1+age*4,0,0,TAU);ctx.stroke();
    }
    this.ripples=this.ripples.filter(r=>time-r.born<6);
    for(const r of this.ripples) {
      const p=this.point(r.u,r.v),age=time-r.born;
      for(let i=0;i<3;i++) {ctx.globalAlpha=(1-age/6)*(.32-i*.07);ctx.beginPath();ctx.ellipse(p.x,p.y,8+age*22+i*10,3+age*5+i*2,0,0,TAU);ctx.stroke();}
    }
    ctx.globalAlpha=1;
  }
  private rain(time:number,intensity:number):void {
    const ctx=this.ctx,{seed,wind}=this.edition;ctx.save();ctx.strokeStyle='#c6e1ff';ctx.lineCap='round';
    const n=Math.min(230,this.width/6)*intensity, gust=Math.sin(time*.035)*.5;
    for(let i=0;i<n;i++) {
      const depth=.2+noise(i+55)*.8,travel=(noise(i+seed)+time*(.10+depth*.17))%1;
      const x=noise(i+401)*this.width-travel*(wind*65+gust*12),y=travel*(this.height+120)-60;
      ctx.globalAlpha=.06+depth*.20;ctx.lineWidth=.45+depth*.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+wind*4,y+9+depth*23);ctx.stroke();
    }ctx.restore();
  }
  private snow(time:number,intensity:number):void {
    const ctx=this.ctx,{seed,wind}=this.edition;ctx.save();ctx.fillStyle='#e0e8ff';
    for(let i=0;i<Math.min(170,this.width/7)*intensity;i++) {
      const depth=.2+noise(i+61)*.8,fall=(noise(seed+i)+time*(.012+depth*.024))%1;
      const x=((noise(i+532)+Math.sin(time*.09+i)*.02+fall*wind*.22+1)%1)*this.width,y=fall*(this.height+30)-15;
      ctx.globalAlpha=.18+depth*.55;ctx.beginPath();ctx.ellipse(x,y,.6+depth*1.8,.8+depth*1.6,0,0,TAU);ctx.fill();
    }ctx.restore();
  }
  private meadow(time:number):void {
    const ctx=this.ctx,{seed,intensity}=this.edition;ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<32*intensity;i++) {
      const x=((noise(seed+i)+time*.002)%1)*this.width+Math.sin(time*.21+i)*15,y=noise(i+80)*this.height+Math.sin(time*.16+i)*12;
      const size=1+noise(i+170)*3;ctx.globalAlpha=.18+Math.pow(Math.max(0,Math.sin(time*.3+i)),2)*.4;
      ctx.drawImage(this.glow('#ffe7a0'),x-size,y-size,size*2,size*2);
    }
    ctx.globalCompositeOperation='source-over';
    for(let i=0;i<4;i++) {
      const p=this.point(.27+noise(i+seed)*.46+Math.sin(time*.055+i)*.035,.51+noise(i+84)*.25+Math.cos(time*.08+i)*.025),wing=.2+Math.abs(Math.sin(time*3+i))*.8;
      ctx.globalAlpha=.7;ctx.fillStyle=i%2?'#fff1ac':'#ffd788';
      for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(p.x+side*2*wing,p.y,2.5*wing,2.2,-side*.4,0,TAU);ctx.fill();}
    }ctx.restore();
  }
  private birds(time:number):void {
    const ctx=this.ctx,cycle=(time+this.edition.seed%130)%130;
    if(cycle>26)return;
    ctx.save();ctx.lineWidth=.85;ctx.strokeStyle=this.edition.scene==='coast'?'#223148':'#34515a';
    for(let i=0;i<5;i++) {
      const progress=cycle/26, p=this.point(-.08+progress*1.22-i*.012,.23+Math.sin(progress*3)*.035+i*.009);
      const size=2+noise(i+33)*2,wing=Math.sin(time*3.2-i)*size;
      ctx.globalAlpha=Math.min(1,cycle,26-cycle)*.6;ctx.beginPath();ctx.moveTo(p.x-size,p.y-wing);ctx.quadraticCurveTo(p.x-size*.4,p.y-1,p.x,p.y);ctx.quadraticCurveTo(p.x+size*.4,p.y-1,p.x+size,p.y-wing);ctx.stroke();
    }ctx.restore();
  }
  private lights(time:number):void {
    const ctx=this.ctx,scene=this.edition.scene;ctx.save();ctx.globalCompositeOperation='screen';
    const spots:Record<SceneId,readonly Point[]>={rain:[[.221,.326]],meadow:[],snow:[[.208,.326],[.341,.375]],coast:[[.061,.452],[.451,.72]]};
    for(const [u,v] of spots[scene]) {
      const p=this.point(u,v),size=this.iw*(scene==='meadow'?.014:.033);
      ctx.globalAlpha=.12+(Math.sin(time*.63+u*10)+Math.sin(time*.21))* .025;
      ctx.drawImage(this.glow('#ffd0a0'),p.x-size,p.y-size,size*2,size*2);
    }
    if(scene==='rain') {
      // Distant windows brighten and settle on independent, slow rhythms.
      for(let i=0;i<22;i++) {
        const p=this.point(.50+noise(i+31)*.47,.29+noise(i+79)*.25),level=Math.max(0,Math.sin(time*(.015+noise(i)*.025)+i));
        ctx.globalAlpha=level*.23;ctx.fillStyle=i%3?'#ffdca0':'#edabe7';ctx.fillRect(p.x,p.y,1.6,2.1);
      }
    }ctx.restore();
  }
  private steam(time:number):void {
    const ctx=this.ctx,spot=this.edition.scene==='coast'?[.084,.587]:[.13,.525];
    ctx.save();ctx.strokeStyle='#fff0dd';ctx.lineWidth=1.1;
    for(let i=0;i<3;i++) {
      const age=(time*.13+i/3)%1,p=this.point(spot[0],spot[1]-age*.048);
      ctx.globalAlpha=Math.sin(age*Math.PI)*.10;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.bezierCurveTo(p.x-7,p.y-8,p.x+9,p.y-15,p.x+Math.sin(time*.5+i)*7,p.y-25);ctx.stroke();
    }ctx.restore();
  }
  dispose():void { this.images.forEach(i=>{i.onload=null;i.onerror=null;});this.images.clear();this.glows.clear();this.previous=null; }
}
