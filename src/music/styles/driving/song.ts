import {keyNames,type Theme,type Track} from '../../composer';
import {KEY_SCALES} from '../../composer/harmony';
import {isStrong,makeContour} from '../../composer/melody';
import {performer} from '../../composer/perform';
import {partSeed,randomSource} from '../../composer/random';
import {ARPS,BASS,INTERVALS,LEAD_CELLS,SYNTH_FORMS,SYNTH_LOOPS,type ArpCell,type BassPattern,type SynthChord,type SynthForm,type SynthPatch,type SynthQuality,type SynthRole} from './library';

/** `focus` is the part that carries the choruses; `voice` the patch every synth part plays. */
export interface SynthArrangement {bpm:number;tonic:number;darkness:number;energy:number;form:SynthForm;voice:SynthPatch;focus:'lead'|'arp';loop:string;arp:ArpCell;groove:BassPattern;hook:Theme;lift:boolean}
type Register=readonly [lo:number,hi:number];
type Cell=readonly (readonly [at:number,duration:number])[];

/** A two-bar hook: an authored straight rhythm, a contour of scale steps and the key degree it sings around. */
export const makeHook=(random:()=>number):Theme=>({cell:Math.floor(random()*LEAD_CELLS.length),contour:makeContour(random),degree:random()<.5?2:4});

const AEOLIAN=KEY_SCALES.minor,TOMS=[50,47,45,43],LIFT:Partial<Record<SynthQuality,SynthQuality>>={min:'maj',madd9:'add9'};
const LEVEL:Record<SynthRole,(bar:number,bars:number)=>number>={intro:()=>.7,verse:()=>.85,build:(i,n)=>.8+.2*i/(n-1),chorus:()=>1,break:()=>.65,outro:(i,n)=>.8-.25*i/(n-1)};

/** The chord voice-led inside 52–76: every rotation and octave, keeping the least total motion from the previous voicing. */
function voice(root:number,quality:SynthQuality,previous:number[]):number[] {
  const intervals=INTERVALS[quality];let best:number[]=[],least=Infinity;
  for(let r=0;r<intervals.length;r++)for(let octave=-1;octave<=2;octave++){
    const notes=[...intervals.slice(r),...intervals.slice(0,r).map(n=>n+12)].map(n=>root+n+octave*12).sort((x,y)=>x-y);
    if(notes[0]<52||notes[notes.length-1]>76||new Set(notes).size<notes.length)continue;
    const motion=notes.reduce((sum,n,i)=>sum+Math.abs(n-(previous[i]??previous[previous.length-1])),0);
    if(motion<least){best=notes;least=motion;}
  }
  return best;
}

/** The pitch inside the register nearest the target whose pitch class is allowed. */
function nearest(target:number,classes:Set<number>,[lo,hi]:Register):number {
  let best=-1;
  for(let p=lo;p<=hi;p++)if(classes.has(p%12)&&(best<0||Math.abs(p-target)<Math.abs(best-target)))best=p;
  return best;
}

/** A straight-sixteenth synth song: one loop per song, layers by section role, and a two-bar hook stated low in verses and high in choruses. */
export function composeSynthSong(a:SynthArrangement,songSeed:number,title:string):Track {
  const loop=SYNTH_LOOPS.find(l=>l.id===a.loop)??SYNTH_LOOPS[0],slowburn=a.form==='slowburn',descent=a.form==='descent',cruise=a.form==='cruise';
  let bars=0;
  const sections=SYNTH_FORMS[a.form].map(([role,length,name])=>{const s={name,role,startBar:bars,endBar:bars+length};bars+=length;return s;});
  // A lifted final chorus turns the tonic and the dominant major; the last bar comes home to the tonic.
  const last=sections.filter(s=>s.role==='chorus').pop(),finale=a.lift?last:undefined;
  let previous=[57,60,64];
  const harmony=Array.from({length:bars},(_,bar)=>{
    let chord:SynthChord=bar===bars-1?{degree:0,quality:'min'}:loop.bars[Math.floor(bar/(loop.slow?2:1))%loop.bars.length];
    if(finale&&bar>=finale.startBar&&bar<finale.endBar)chord={degree:chord.degree,quality:chord.degree===7?'maj':chord.degree===0?LIFT[chord.quality]??chord.quality:chord.quality};
    const root=48+(a.tonic+chord.degree)%12,notes=voice(root,chord.quality,previous);previous=notes;
    return [{root,quality:chord.quality,notes,beat:0}];
  });
  const levels=sections.flatMap(s=>{const n=s.endBar-s.startBar;return Array.from({length:n},(_,i)=>LEVEL[s.role](i,n)*a.energy);});
  const part=(tag:string)=>performer({swing:0,songSeed,random:randomSource(partSeed(songSeed,tag)),bars,tight:true});
  const pad=part('pad'),bass=part('bass'),drums=part('drums'),arp=part('arp'),lead=part('lead');

  // After dark the pad keeps only root, fifth and octave.
  const fifths=(root:number)=>{const r=root<52?root+12:root;return [r,r+7,r+12];};
  // The hook: authored rhythm, contour on the aeolian scale around its anchor degree, fitted into each register.
  const scale=new Set(AEOLIAN.map(n=>(a.tonic+n)%12)),contour=a.hook.contour;
  const pitch=(step:number)=>60+a.tonic+12*Math.floor(step/7)+AEOLIAN[(step%7+7)%7];
  const statement=(register:Register,velocity:number)=>{
    const [lo,hi]=register,cost=(anchor:number)=>{const p=[0,1].flatMap(shift=>contour.map(c=>pitch(anchor+c+shift)));
      return p.filter(x=>x<lo||x>hi).length*10+Math.abs(p.reduce((x,y)=>x+y,0)/p.length-(lo+hi)/2);};
    return {register,velocity,anchor:[-7,0,7].map(o=>a.hook.degree+o).reduce((best,x)=>cost(x)<cost(best)?x:best)};
  };
  const low=statement([60,74],.7),high=statement([67,84],.95);
  const cell=LEAD_CELLS[a.hook.cell],opening=cell.filter(([at])=>at<4);
  const tail:Cell=opening.map(([at,d],i)=>i===opening.length-1?[at,Math.max(d,5.5-at)]:[at,d]);
  const place=(bar:number,notes:Cell,shift:number,{register,velocity,anchor}:ReturnType<typeof statement>)=>{
    // Beats 0 and 2, and anything held a beat, sit on the loop chord; other notes on the scale.
    const out=notes.map(([at,duration],i)=>{
      const beat=bar*4+at,b=Math.floor(beat/4),tones=new Set(harmony[b][0].notes.map(n=>n%12)),target=pitch(anchor+contour[i%contour.length]+shift);
      return {beat,duration,b,tones,target,note:nearest(target,isStrong(beat,duration)?tones:scale,register)};
    });
    // A note off the chord must step to a chord-tone neighbour, otherwise it becomes a chord tone.
    for(let i=out.length-2;i>=0;i--){const n=out[i],next=out[i+1];
      if(!n.tones.has(n.note%12)&&!(next.tones.has(next.note%12)&&Math.abs(next.note-n.note)<=2))n.note=nearest(n.target,n.tones,register);}
    for(const n of out)lead.add('lead',n.beat,n.note,n.duration,velocity*levels[n.b]);
  };

  // One melodic focus per song, so no bar sounds more than three synth parts: a lead song keeps its arp out of the
  // choruses and out of the bars where the build teases the hook; an arp song's lead sings the verses and takes back the final chorus.
  // A descent has no verses, so an arp descent's lead teases the hook in the build and sings the break low instead.
  const leadSong=a.focus==='lead',stabs=a.darkness>=.75||a.voice==='dark';
  const leadIn=(bar:number)=>lead.events.some(e=>e.beat<bar*4+4&&e.beat+e.duration>bar*4);
  for(const section of sections){
    const {role,startBar,endBar}=section,length=endBar-startBar,sings=role==='verse'||role==='chorus'&&(leadSong||section===last)||descent&&!leadSong&&role==='break';
    // A stab bar is the pad's rest. Darksynth stabs at any darkness.
    const stabAt=(i:number)=>stabs&&(role==='chorus'&&i%8===0||role==='verse'&&i===0);
    const padAt=(bar:number)=>stabAt(bar-startBar)?[]:a.darkness>.6?fifths(harmony[bar][0].root):harmony[bar][0].notes;
    for(let bar=startBar,end=bar;bar<endBar;bar=end){
      const notes=padAt(bar);
      for(end=bar+1;end<endBar&&padAt(end).join()===notes.join();end++);
      for(const n of notes)pad.add('pad',bar*4,n,(end-bar)*4-.05,.7*levels[bar]);
    }
    if(sings){const s=role==='chorus'?high:low;for(let p=startBar;p<endBar;p+=8){place(p,cell,0,s);place(p+2,cell,1,s);place(p+4,cell,0,s);place(p+6,tail,0,s);}}
    if(role==='build'&&(leadSong||descent))place(startBar+4,opening,0,low);
    for(let bar=startBar;bar<endBar;bar++){
      const i=bar-startBar,v=levels[bar],at=bar*4,chord=harmony[bar][0];
      // Every intro builds: the pad plays the loop alone for 4 bars, then a soft pulse bass and the arp join together.
      const introBass=role==='intro'&&i>=4;
      const pattern:BassPattern=role==='break'||slowburn||introBass?'pulse':a.groove;
      if(role==='intro'?introBass:role!=='outro'||!cruise&&i<8){
        const steps=BASS[pattern],note=28+((loop.pedal?a.tonic:chord.root)%12-4+12)%12;
        steps.forEach(([t,octave],k)=>bass.add('bass',at+t,note+(octave?12:0),(steps[k+1]?.[0]??4)-t-.05,(role==='intro'?.35:role==='break'?.5:.8)*v));
      }
      if(role==='intro'?introBass:role==='chorus'?!sings:role!=='verse'&&!leadIn(bar)){
        const step=a.arp==='eighth'?.5:.25,tones=[...new Set(chord.notes.flatMap(n=>[n,n+12,n+24,n+36]))].filter(p=>p<=88).sort((x,y)=>x-y);
        ARPS[a.arp].forEach((k,j)=>arp.add('arp',at+j*step,tones[Math.min(k,tones.length-1)],step,.35*v));
      }
      if(stabAt(i))for(const n of chord.notes)pad.add('stab',at,n,1,.8*v);
      if(role==='chorus'&&i%8===0)drums.add('crash',at,49,4,.8*v);
      const kit=role==='verse'||role==='chorus'?'full':role==='build'?'build':role==='outro'&&!cruise&&i<8?'outro':undefined;
      // A descent's longer intro adds quiet closed eighth hats from bar 9 and carries them into the build.
      if(role==='intro'&&descent&&i>=8)for(let t=0;t<4;t+=.5)drums.add('hat',at+t,42,.1,(t%1===0?.35:.25)*v);
      if(!kit)continue;
      for(const t of slowburn?[0,2]:a.darkness>=.45?[0,1,2,3]:BASS[pattern].some(([t])=>t===3.75)?[0,2,3.75]:[0,2])drums.add('kick',at+t,36,.25,(t===3.75?.6:.95)*v);
      if(kit==='full')for(const t of [1,3]){drums.add('snare',at+t,38,.25,.9*v);if(!slowburn&&a.darkness>=.45)drums.add('clap',at+t,39,.25,.8*v);}
      if(kit==='build'&&i>=length-2)for(let t=0;t<4;t+=.5)drums.add('snare',at+t,38,.25,.7*v);
      const fill=kit==='full'&&i%8===7||kit==='build'&&i===length-1;
      if(fill)TOMS.forEach((n,k)=>drums.add('tom',at+3+k*.25,n,.25,.8*v));
      if(slowburn)continue;
      // Hats run eighths when the song's bass and arpeggio both run sixteenths: never three sixteenth layers.
      const step=(pattern==='sixteenths'||pattern==='gallop')&&a.arp!=='eighth'?.5:.25;
      for(let t=0;t<(fill?3:4);t+=step)drums.add(t===3.5?'open':'hat',at+t,t===3.5?46:42,t===3.5?.5:.1,(t%1===0?.9:t%.5===0?.6:.45)*v);
    }
  }
  // A note held a beat or more straight into the next lead note hands over with a glide.
  lead.events.forEach((e,i,all)=>{const p=all[i-1];if(p&&p.duration>=1&&Math.abs(p.beat+p.duration-e.beat)<1e-6)e.legato=true;});
  const events=[pad,bass,drums,arp,lead].flatMap(p=>p.events).sort((x,y)=>x.beat-y.beat);
  return {seed:songSeed,index:0,title,bpm:a.bpm,key:keyNames[a.tonic]+'m',bars,swing:0,events,harmony,sections,
    voice:a.voice,form:a.form,mode:'minor',theme:a.hook,loop:loop.id,style:'driving',darkness:a.darkness};
}
