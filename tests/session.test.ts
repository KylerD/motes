import {describe,it,expect} from 'vitest';
import {createSession,sessionAt,composeSessionTrack} from '../src/session/session';
import {LOOPS,formBars,randomSource,type Arrangement,type Track} from '../src/music/composer';
import {FORM_SEQUENCES} from '../src/music/styles/lofi';
import {STYLES,styleOf} from '../src/music/styles';
import {PLACES,DRAFTS,placeById} from '../src/places';
import {composeSynthSong,makeHook} from '../src/music/styles/synthwave/song';
import {SYNTH_FORMS} from '../src/music/styles/synthwave/library';
import {chordAt} from '../src/music/composer/harmony';
import {SEQUENCES,NOMINAL,DARKNESS} from '../src/music/styles/synthwave';
import {lightningAt} from '../src/places/deck';

const ids=[...PLACES,...DRAFTS].map(p=>p.id),lofi=ids.filter(id=>placeById(id).music.style==='lofi');

describe('an hour in a scene',()=>{
  it.each(ids)('%s reproduces eighteen contiguous arrangements spanning exactly one hour',mood=>{
    const plan=createSession(42,mood);
    expect(createSession(42,mood)).toEqual(plan);
    expect(plan.slots).toHaveLength(18);
    let end=0;
    for(const slot of plan.slots){
      const track=composeSessionTrack(plan,slot.index);
      expect(slot.start).toBeCloseTo(end,8);
      expect(slot.duration).toBeCloseTo(track.bars*4*60/track.bpm,8);
      end+=slot.duration;
    }
    expect(end).toBeCloseTo(3600,8);
    expect(new Set(plan.slots.map(s=>s.chapter)).size).toBe(6);
  });
  it('writes related, varied scores while returning to the opening theme',()=>{
    const plan=createSession(42,'coast');
    const scores=plan.slots.map((_,i)=>composeSessionTrack(plan,i));
    expect(scores[0].key).toBe(scores[17].key);
    expect(new Set(scores.map(s=>s.key)).size).toBeGreaterThan(1);
    expect(new Set(scores.map(s=>s.voice)).size).toBe(4);
    expect(scores.every(s=>s.session?.seed===42)).toBe(true);
    expect(scores[17].session!.offset+scores[17].bars*4*60/scores[17].bpm).toBeCloseTo(3600,7);
    expect(composeSessionTrack(createSession(43,'coast'),0).events).not.toEqual(scores[0].events);
  });
  it.each(ids)('%s keeps the scene continuous across chapter edges and quiet between events',mood=>{
    const plan=createSession(7,mood);
    for(const slot of plan.slots.slice(1)){
      const before=sessionAt(plan,slot.start-.01),after=sessionAt(plan,slot.start+.01);
      expect(Math.abs(after.dusk-before.dusk)).toBeLessThan(.001);
      expect(Math.abs(after.weather-before.weather)).toBeLessThan(.001);
    }
    for(const event of plan.events){
      expect(sessionAt(plan,event.start+event.duration/2).events.some(e=>e.kind===event.kind)).toBe(true);
      expect(sessionAt(plan,event.start-1).events.some(e=>e.kind===event.kind)).toBe(false);
    }
    expect(plan.events.reduce((sum,e)=>sum+e.duration,0)).toBeLessThan(720);
  });
  it('preserves the shared groove and playable scores through every instrumental change',()=>{
    for(const mood of ids){
      const plan=createSession(913,mood),style=styleOf(placeById(mood).music.style),g=style.limits.grid;
      // styleOf falls back to lofi, so a mistyped style would pass unnoticed.
      expect(Object.keys(STYLES)).toContain(placeById(mood).music.style);
      // After hours shares the grid: check a few songs past the first hour too.
      for(const index of [...plan.slots.map(s=>s.index),18,19,27,35]){
        const track=composeSessionTrack(plan,index),bass=track.events.filter(e=>e.instrument==='bass');
        expect(track.bpm).toBeGreaterThanOrEqual(style.limits.bpm[0]);expect(track.bpm).toBeLessThanOrEqual(style.limits.bpm[1]);
        expect(track.events.length).toBeLessThan(style.limits.perTrack);
        for(const event of track.events){
          expect(Number.isFinite(event.beat+event.duration+event.velocity+event.note)).toBe(true);
          expect(event.beat).toBeGreaterThanOrEqual(0);expect(event.beat).toBeLessThan(track.bars*4);
          if(event.instrument==='piano')continue;
          const n=Math.round(event.beat*g),grid=n/g+(n%2?track.swing:0);
          expect(Math.abs(event.beat-grid)).toBeLessThanOrEqual(.025);
          if(event.instrument==='kick')expect(bass.some(note=>Math.abs(note.beat-event.beat)<.015)).toBe(true);
        }
      }
    }
  });
  it.each(ids)('%s continues after the hour without rewinding the evening or replaying events',mood=>{
    const plan=createSession(12,mood);
    expect(sessionAt(plan,3600).dusk).toBe(sessionAt(plan,7200).dusk);
    expect(sessionAt(plan,7200).events).toEqual([]);
    expect(sessionAt(plan,7200).chapter).toBe('After hours');
    expect(composeSessionTrack(plan,18).session!.offset).toBeCloseTo(3600);
    expect(composeSessionTrack(plan,18).events).not.toEqual(composeSessionTrack(plan,0).events);
  });
  it('draws or feels every planned event kind',()=>{
    for(const place of [...PLACES,...DRAFTS])for(const {kind} of place.environment.events){
      const weather=(strength:number)=>place.environment.weather({progress:.5,dusk:.5,events:strength?[{kind,progress:.5,strength}]:[]});
      expect(place.draw.some(layer=>layer.kind===kind)||weather(1)!==weather(0),`${place.id} ${kind}`).toBe(true);
    }
  });
  it('plans song shapes, loops and grooves so neighbours never match',()=>{
    for(const sequence of FORM_SEQUENCES){
      expect(sequence).toHaveLength(18);
      expect(sequence.reduce((sum,f)=>sum+formBars(f),0)).toBe(1128);
      sequence.slice(1).forEach((f,i)=>expect(f).not.toBe(sequence[i]));
      expect(sequence[10]).toBe('nocturne');expect(sequence[16]).toBe('nocturne');expect(sequence[8]).not.toBe('nocturne');
      expect(['beat-tape','hook']).toContain(sequence[0]);expect(['beat-tape','hook']).toContain(sequence[17]);
    }
    for(const mood of lofi)for(let seed=0;seed<200;seed++){
      const plan=createSession(seed,mood),a=plan.slots.map(s=>s.arrangement as Arrangement);
      expect(new Set(a.map(x=>x.voice)).size).toBe(4);
      a.slice(1).forEach((x,i)=>{
        expect(x.loop).not.toBe(a[i].loop);expect(x.comp).not.toBe(a[i].comp);expect(x.groove).not.toBe(a[i].groove);
      });
      expect(a.filter(x=>x.stretch).length).toBeLessThanOrEqual(2);
      const counts=new Map<string,number>();for(const x of a.slice(0,17))counts.set(x.loop,(counts.get(x.loop)??0)+1);
      expect(Math.max(...counts.values()),'no loop dominates the hour').toBeLessThanOrEqual(2);
      expect(a[10].mode).toBe('minor');expect(a[16].mode).toBe('minor');expect(a[0].mode).toBe('major');
      expect(a[17].loop).toBe(a[0].loop);expect(a[17].theme).toEqual(a[0].theme);
      expect(LOOPS.find(l=>l.id===a[0].loop)!.bars[0][0][0],'the hour opens on its tonic').toBe(0);
      expect(a[15].theme.cell).toBe(a[0].theme.cell);expect(a[16].theme.cell).toBe(a[0].theme.cell);
      for(const x of a){expect(x.bpm).toBeGreaterThan(68);expect(x.bpm).toBeLessThan(88);}
      expect(plan.slots.reduce((sum,s)=>sum+s.duration,0)).toBeCloseTo(3600,6);
    }
  });
});

const synthSong=(form:string,darkness:number,seed:number,focus:'lead'|'arp'='lead')=>composeSynthSong({bpm:120,tonic:9,darkness,energy:.9,form:form as never,
  voice:darkness<.5?'analog':'dark',focus,loop:darkness<.5?'horizon':'chrome',arp:'up16',groove:'sixteenths',hook:makeHook(randomSource(seed)),lift:false},seed,'Test');
describe('synthwave songs',()=>{
  it('fills every form with a straight, bounded, playable score',()=>{
    for(const form of Object.keys(SYNTH_FORMS))for(const darkness of [0,.5,1])for(let seed=0;seed<6;seed++){
      const t=synthSong(form,darkness,seed,seed%2?'arp':'lead'),perBar=new Array(t.bars).fill(0),bass=t.events.filter(e=>e.instrument==='bass');
      // One melodic focus: no bar sounds more than three of pad, bass, arp, lead and stab.
      const parts=Array.from({length:t.bars},()=>new Set<string>());
      for(const e of t.events)if(['pad','bass','arp','lead','stab'].includes(e.instrument))
        for(let b=Math.floor(e.beat/4);b<Math.min(t.bars,Math.ceil((e.beat+e.duration)/4-1e-6));b++)parts[b].add(e.instrument);
      expect(Math.max(...parts.map(p=>p.size)),`${form} at ${darkness}, seed ${seed}`).toBeLessThanOrEqual(3);
      // An arp descent has no verses: its lead teases the hook in the build and sings the break.
      if(form==='descent'&&seed%2)for(const s of t.sections.filter(s=>s.role==='build'||s.role==='break'))
        expect(t.events.some(e=>e.instrument==='lead'&&e.beat>=s.startBar*4&&e.beat<s.endBar*4),`${s.role} at ${darkness}, seed ${seed}`).toBe(true);
      for(const e of t.events){
        perBar[Math.min(t.bars-1,Math.floor(e.beat/4))]++;
        expect(Number.isFinite(e.beat+e.duration+e.velocity+e.note)).toBe(true);
        expect(e.duration).toBeGreaterThan(0);expect(e.velocity).toBeGreaterThan(0);expect(e.velocity).toBeLessThanOrEqual(1);
        if(e.instrument!=='hat'&&e.instrument!=='open')expect(Math.abs(e.beat-Math.round(e.beat*4)/4)).toBeLessThan(.001);
        if(e.instrument==='kick')expect(bass.some(b=>Math.abs(b.beat-e.beat)<.015)).toBe(true);
      }
      expect(Math.max(...perBar)).toBeLessThanOrEqual(64);
      expect(t.events.length/t.bars).toBeLessThanOrEqual(44);
      expect(t.events.length).toBeLessThan(6000);
      expect(t.sections.at(-1)!.endBar).toBe(t.bars);
    }
  });
  it('drops the drums in breaks and states the hook on chord tones',()=>{
    const t=synthSong('drive',.3,4);
    for(const s of t.sections.filter(s=>s.role==='break'))
      expect(t.events.some(e=>['kick','snare','clap','hat','open','tom'].includes(e.instrument)&&e.beat>=s.startBar*4&&e.beat<s.endBar*4)).toBe(false);
    for(const e of t.events.filter(e=>e.instrument==='lead')){
      const within=e.beat%4,chord=chordAt(t.harmony,e.beat,false);
      if(within===0||within===2||e.duration>=1)expect(chord.notes.map(n=>n%12)).toContain(e.note%12);
    }
  });
});

describe('the synthwave hour',()=>{
  it('plans every sequence inside its chapter bands and lands exactly on the hour',()=>{
    const bands=[[105,115],[105,115],[105,115],[118,128],[118,128],[118,128],[124,130],[88,96],[124,130],[126,134],[126,134],[126,134],[130,140],[88,96],[130,140],[130,145],[130,145],[130,145]];
    for(let seed=0;seed<200;seed++){
      const plan=createSession(seed,'deck'),a=plan.slots.map(s=>s.arrangement as never as {bpm:number;form:string;voice:string;loop:string;arp:string;groove:string;darkness:number;hook:unknown});
      expect(plan.slots.reduce((sum,s)=>sum+s.duration,0)).toBeCloseTo(3600,6);
      a.forEach((x,i)=>{expect(x.bpm).toBeGreaterThanOrEqual(bands[i][0]);expect(x.bpm).toBeLessThanOrEqual(bands[i][1]);});
      expect(new Set(a.map(x=>x.voice)).size).toBe(4);
      a.slice(1).forEach((x,i)=>{for(const k of ['form','voice','loop','arp','groove'] as const)expect(x[k]).not.toBe(a[i][k]);});
      expect(a[17].loop).toBe(a[0].loop);expect(a[17].hook).toEqual(a[0].hook);
      // Song 18 turns the hour over on slot 0's arrangement: it never replays song 17's loop, voice, arpeggio or groove.
      expect(composeSessionTrack(plan,18).loop).not.toBe(a[17].loop);expect(a[17].arp).not.toBe(a[0].arp);expect(a[17].groove).not.toBe(a[0].groove);
      expect(a[17].voice).not.toBe(a[0].voice);
    }
    const deck=createSession(1,'deck'),label=(i:number)=>styleOf('synthwave').labels.voice(composeSessionTrack(deck,i));
    expect(new Set(deck.slots.map(s=>label(s.index)))).toEqual(new Set(['Analog synths','Soft pulse','Glass bells','Darksynth']));
    for(const s of SEQUENCES)expect(s.reduce((sum,f)=>sum+({cruise:88,drive:112,descent:128,slowburn:64} as Record<string,number>)[f],0)).toBe(1880);
    expect(NOMINAL).toHaveLength(18);
  });
  it('darkens by chapter, stays dark after hours and restates the opening hook',()=>{
    const plan=createSession(20260917,'deck');
    for(let c=1;c<6;c++)expect(Math.min(...DARKNESS.slice(c*3,c*3+3))).toBeGreaterThan(Math.max(...DARKNESS.slice(c*3-3,c*3)));
    for(const i of [18,19,27,35])expect(composeSessionTrack(plan,i).darkness!).toBeGreaterThanOrEqual(.8);
    const first=(t:Track)=>{const c=t.sections.find(s=>s.role==='chorus')!;return t.events.filter(e=>e.instrument==='lead'&&e.beat>=c.startBar*4&&e.beat<c.endBar*4).map(e=>e.note);};
    expect(first(composeSessionTrack(plan,17))).toEqual(first(composeSessionTrack(plan,0)));
  });
  it('builds every intro without kick or snare, and moves a descent\'s pad through its loop',()=>{
    const plan=createSession(20260917,'deck');
    for(let i=0;i<20;i++){
      const t=composeSessionTrack(plan,i),intro=t.events.filter(e=>e.beat<t.sections[0].endBar*4);
      expect(intro.some(e=>e.instrument==='kick'||e.instrument==='snare'),`song ${i}`).toBe(false);
      // The pad opens alone; arp and bass join at bar 5, and only a descent adds hats, from bar 9.
      const first=(part:string)=>Math.round(Math.min(...intro.filter(e=>e.instrument===part).map(e=>e.beat)));
      expect([first('arp'),first('bass'),first('hat')],`song ${i}`).toEqual([16,16,t.form==='descent'?32:Infinity]);
      if(t.form!=='descent')continue;
      const chords=new Map<number,number[]>();for(const e of intro)if(e.instrument==='pad')chords.set(e.beat,[...chords.get(e.beat)??[],e.note]);
      expect(new Set([...chords.values()].map(n=>n.sort().join())).size,`song ${i}`).toBeGreaterThan(1);
    }
  });
  it('gives every synthwave song a hook that repeats',()=>{
    const plan=createSession(4242,'deck');
    for(const i of [0,5,9,13,17]){
      const lead=composeSessionTrack(plan,i).events.filter(e=>e.instrument==='lead');
      const steps=lead.slice(1).map((e,j)=>`${e.note-lead[j].note}:${Math.round((e.beat-lead[j].beat)*4)}`);
      const grams=steps.slice(3).map((_,j)=>steps.slice(j,j+4).join('|')),counts=new Map<string,number>();
      for(const g of grams)counts.set(g,(counts.get(g)??0)+1);
      expect(grams.filter(g=>counts.get(g)!>=2).length/grams.length).toBeGreaterThanOrEqual(.4);
    }
  });
  it('keeps pending notes bounded under a 3 s horizon',()=>{
    const plan=createSession(20260917,'deck');
    for(const i of [12,14,16]){
      const t=composeSessionTrack(plan,i),spb=60/t.bpm,starts=t.events.map(e=>e.beat*spb),ends=t.events.map(e=>(e.beat+e.duration)*spb+.9);
      let peak=0;for(let now=0;now<t.bars*4*spb;now+=.25)peak=Math.max(peak,starts.filter((s,j)=>s<=now+3&&ends[j]>=now).length);
      expect(peak).toBeLessThan(160);
    }
  });
  it('never flashes lightning without motion, after the hour, or too often',()=>{
    for(let t=0;t<7200;t+=.01){
      expect(lightningAt(7,t,1,false)).toBe(0);
      if(t>=3600)expect(lightningAt(7,t,1,true)).toBe(0);
      expect(lightningAt(7,t,1,true)).toBeLessThanOrEqual(.12);
    }
    for(let w=0;w<3600;w+=20){let flashes=0,was=false;for(let t=w;t<w+20;t+=.005){const on=lightningAt(7,t,1,true)>0;if(on&&!was)flashes++;was=on;}expect(flashes).toBeLessThanOrEqual(2);}
  });
  it('draws a flash only in the sky band and only while motion is on',()=>{
    const draw=placeById('deck').draw,layer=draw[draw.length-1],seed=7;
    let elapsed=0;while(elapsed<3600&&lightningAt(seed,elapsed,1,true)<=0)elapsed+=.01;
    const space={width:1440,height:960,iw:1706,point:(u:number,v:number)=>({x:-114+u*1706,y:v*960})};
    const flash=(motion:boolean)=>{
      const rects:number[][]=[],ctx={createLinearGradient:()=>({addColorStop(){}}),save(){},restore(){},fillRect:(...r:number[])=>{rects.push(r);}};
      layer(ctx as never,{state:{elapsed,weather:1.1,events:[]} as never,time:0,space,light:{} as never,motion,seed});return rects;
    };
    const rects=flash(true);expect(rects).toHaveLength(1);
    const [x,y,w,h]=rects[0];
    expect(x).toBeCloseTo(space.point(.22,0).x);expect(x+w).toBeCloseTo(space.width);expect(y+h).toBeCloseTo(space.point(0,.33).y);
    expect(flash(false)).toEqual([]);
  });
});
