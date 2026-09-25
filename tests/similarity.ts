import type {Track} from '../src/music/composer';

/** Melody n-grams of (interval, onset gap in half beats); timing noise is quantised away. */
export function melodyGrams(track:Track,n=4):Set<string> {
  const notes=track.events.filter(e=>e.instrument==='melody');
  const steps=notes.slice(1).map((e,i)=>`${e.note-notes[i].note}:${Math.round((e.beat-notes[i].beat)*2)}`);
  return grams(steps,n);
}

/** Harmony n-grams of (root motion, quality) across consecutive distinct chords. */
export function harmonyGrams(track:Track,n=4):Set<string> {
  const chords=track.harmony.flat();
  const steps=chords.slice(1).map((c,i)=>`${((c.root-chords[i].root)%12+12)%12}:${c.quality}`);
  return grams(steps,n);
}

function grams(steps:string[],n:number):Set<string> {
  const out=new Set<string>();
  for(let i=0;i+n<=steps.length;i++)out.add(steps.slice(i,i+n).join('|'));
  return out;
}

export function jaccard(a:Set<string>,b:Set<string>):number {
  let shared=0;for(const g of a)if(b.has(g))shared++;
  const union=a.size+b.size-shared;return union?shared/union:0;
}

/** Weighted Jaccard of counted n-grams: shared mass over total mass. */
export function weightedJaccard(a:Map<string,number>,b:Map<string,number>):number {
  let shared=0,total=0;
  for(const key of new Set([...a.keys(),...b.keys()])){const x=a.get(key)??0,y=b.get(key)??0;shared+=Math.min(x,y);total+=Math.max(x,y);}
  return total?shared/total:0;
}

export const median=(values:number[])=>{const s=[...values].sort((a,b)=>a-b);return s.length%2?s[s.length>>1]:(s[s.length/2-1]+s[s.length/2])/2;};

/** Rhythmic skeleton of one part: each bar's onsets on the eighth grid, as counted n-grams of bars.
 *  Counting matters: a song that is mostly one comp pattern differs from one that is mostly another. */
export function rhythmGrams(track:Track,instruments:string[],n=2):Map<string,number> {
  const bars:string[]=Array.from({length:track.bars},()=>'');
  const marks=Array.from({length:track.bars},()=>new Set<number>());
  for(const e of track.events)if(instruments.includes(e.instrument))marks[Math.min(track.bars-1,Math.floor(e.beat/4+1e-3))].add(Math.round((e.beat%4)*2)%8);
  marks.forEach((m,i)=>bars[i]=[...m].sort((a,b)=>a-b).join('.'));
  const counts=new Map<string,number>();
  for(let i=0;i+n<=bars.length;i++){const g=bars.slice(i,i+n).join('|');counts.set(g,(counts.get(g)??0)+1);}
  return counts;
}
