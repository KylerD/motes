export type Mood = 'rain' | 'meadow' | 'snow' | 'coast';
export type Instrument = 'piano' | 'melody' | 'bass' | 'kick' | 'snare' | 'hat' | 'rim';
export type MusicMode = 'beats' | 'ambient';
export interface ScoreEvent { beat: number; duration: number; note: number; velocity: number; pan: number; instrument: Instrument }
export interface Chord { root: number; notes: number[]; quality: HarmonySpec[1] }
export interface Section { name: string; startBar: number; endBar: number }
export interface Track {
  seed: number; index: number; title: string; bpm: number; key: string; bars: number;
  swing: number; events: ScoreEvent[]; harmony: Chord[]; sections: Section[];
}

/** Small deterministic generator: score choices never depend on wall time or rendering. */
export function randomSource(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let x = Math.imul(value ^ value >>> 15, 1 | value);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

type HarmonySpec = [number, 'maj9' | 'min9' | 'dom9' | 'six9'];
const progressions: HarmonySpec[][] = [
  [[0,'maj9'],[0,'six9'],[9,'min9'],[9,'min9'],[2,'min9'],[7,'dom9'],[0,'maj9'],[7,'dom9']],
  [[5,'maj9'],[5,'maj9'],[4,'min9'],[9,'min9'],[2,'min9'],[7,'dom9'],[0,'maj9'],[0,'six9']],
  [[9,'min9'],[9,'min9'],[5,'maj9'],[5,'maj9'],[2,'min9'],[7,'dom9'],[0,'maj9'],[0,'maj9']],
  [[2,'min9'],[7,'dom9'],[0,'maj9'],[0,'six9'],[5,'maj9'],[4,'min9'],[9,'min9'],[7,'dom9']],
];
const extensions = { maj9: [0,4,7,11,14], min9: [0,3,7,10,14], dom9: [0,4,10,14], six9: [0,4,7,9,14] };
const keyNames = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const words: Record<Mood, string[]> = {
  rain: ['Window Seat','After the Rain','Blue Hour','Last Train','Umbrella Waltz','Warm Windows'],
  meadow: ['Honey Light','Dandelion Days','Cloud Watching','Sunday Pages','Golden Hour','Slow Morning'],
  snow: ['Paper Lantern','Snow on the Sill','The Quiet Car','Wool & Ink','A Small Fire','Northern Postcard'],
  coast: ['Saltwater Pages','Low Tide Letters','Sea Glass','Harbour Lights','Driftwood Notes','The Reading Room'],
};
const subtitles = ['a little later','side streets','soft focus','the long way home','in the margins','second cup'];

function voiceChord(root: number, quality: HarmonySpec[1], previous: number[]): number[] {
  const source = extensions[quality].map(n => root + n);
  let best = source, bestCost = Infinity;
  for (let inversion = 0; inversion < source.length; inversion++) {
    const rotated = source.slice(inversion).concat(source.slice(0,inversion).map(n => n+12));
    for (let octave = -2; octave <= 1; octave++) {
      const notes = rotated.map(n => n + octave*12);
      if (notes[0] < 48 || notes[notes.length-1] > 76) continue;
      const centre = notes.reduce((a,b) => a+b,0)/notes.length;
      const motion = notes.reduce((sum,n,i) => sum + Math.abs(n-(previous[i] ?? 63)),0);
      const cost = motion + Math.abs(centre - 62)*0.9;
      if (cost < bestCost) { best = notes; bestCost = cost; }
    }
  }
  return best;
}

/** A song has a written 64-bar form. Randomness chooses an edition, never each new note in real time. */
export function composeTrack(seed: number, mood: Mood, index = 0): Track {
  const songSeed = (seed ^ Math.imul(index+1,0x9e3779b1) ^ Math.imul(['rain','meadow','snow','coast'].indexOf(mood)+1,0x45d9f3b)) >>> 0;
  const random = randomSource(songSeed);
  const choose = <T>(values: T[]): T => values[Math.floor(random()*values.length)];
  const tonic = choose([0,2,3,5,7,8,10]);
  const bpm = (mood === 'snow' ? 69 : mood === 'meadow' ? 76 : 72) + Math.floor(random()*10);
  const main = choose(progressions);
  const bridge: HarmonySpec[] = [[5,'maj9'],[5,'six9'],[4,'min9'],[9,'min9'],[2,'min9'],[2,'min9'],[7,'dom9'],[7,'dom9']];
  const swing = 0.075 + random()*0.045;
  const sections: Section[] = [
    {name:'Opening',startBar:0,endBar:8}, {name:'First light',startBar:8,endBar:24},
    {name:'Wandering',startBar:24,endBar:32}, {name:'Room to breathe',startBar:32,endBar:40},
    {name:'Home again',startBar:40,endBar:56}, {name:'Last page',startBar:56,endBar:64},
  ];
  const harmony: Chord[] = [];
  let lastVoicing = [52,57,60,64,67];
  for (let bar=0; bar<64; bar++) {
    const [degree, quality] = bar === 63 ? [0,'maj9'] as HarmonySpec : (bar>=24 && bar<40 ? bridge : main)[bar%8];
    const root = 48 + (tonic+degree)%12;
    const notes = voiceChord(root,quality,lastVoicing);
    harmony.push({root,quality,notes});
    lastVoicing=notes;
  }
  // The same eight-bar phrase returns in A and A'. Two bars speak, then one leaves air.
  const motifs = [
    [[0.5,2],[1.65,3],[2.5,1]], [[0.1,2],[1.5,1],[2.65,0]],
    [[0.5,1],[1.1,2],[2.5,3]], [[0.1,2],[2,1]],
  ];
  const motif = choose(motifs);
  const phrase = Array.from({length:8},(_,bar) => {
    if (bar===3 || bar===7) return [[0.15,0]];
    if (bar===2 || bar===6) return [[1.5,2],[2.65,1]];
    return motif.map(([beat,n]) => [beat, (n + (bar%2 ? 1 : 0))%4]);
  });
  const events: ScoreEvent[] = [];
  function add(instrument: Instrument, beat:number, note:number, duration:number, velocity:number, pan=0) {
    const jitter = instrument === 'kick' ? 0 : (random()-0.5)*0.025;
    events.push({instrument,beat:Math.max(0,Math.min(255.99,beat+jitter)),note,duration,velocity:velocity*(0.91+random()*0.16),pan});
  }
  const drumVariant = Math.floor(random()*3);
  for (let bar=0;bar<64;bar++) {
    const chord=harmony[bar], at=bar*4;
    const opening=bar<8, breath=bar>=32 && bar<40, ending=bar>=56;
    const lift=bar>=40 && bar<56;
    const volume=opening ? 0.66 : breath ? 0.72 : ending ? 0.8-(bar-56)*0.05 : 1;
    // Piano comping: rolled, voice-led extensions, with a restrained offbeat answer.
    chord.notes.forEach((note,i) => add('piano',at+i*0.015,note,breath?3.5:2.0,0.30*volume,i*0.09-0.18));
    if (!opening && !breath && bar%4!==3 && bar<60) {
      chord.notes.slice(1).forEach((note,i) => add('piano',at+2.5+swing+i*0.012,note,1.0,0.18*volume,i*0.08-0.12));
    }
    if ((!opening || bar>=4) && bar<62) {
      let bass=chord.root-12; if(bass>45)bass-=12;
      add('bass',at+0.01,bass,1.45,0.63*volume);
      if (!breath) {
        add('bass',at+2.5+swing,bar%2===0?bass+7:bass,0.8,0.46*volume);
        if (bar%4===3) {
          let target=harmony[Math.min(63,bar+1)].root-12; if(target>45)target-=12;
          add('bass',at+3.5+swing,target+(target>bass?-1:1),0.33,0.34*volume);
        }
      }
    }
    if (bar>=8 && bar<60 && !breath) {
      // Melody takes chord tones above the left hand; the theme is repeated verbatim on return.
      const tones=extensions[chord.quality].slice(1).map(n => chord.root+n);
      const octave=tones[0]<64?12:0;
      const pattern=phrase[bar%8];
      for (let n=0;n<pattern.length;n++) {
        const [beat,degree]=pattern[n];
        const tone=tones[(bar>=24 && bar<32 ? 3-degree : degree)%tones.length]+octave;
        add('melody',at+beat,tone,pattern.length===1?2.3:n===pattern.length-1?1.05:0.58,0.43*volume,0.14);
      }
      // A high, short answer only at the end of alternate phrases.
      if(lift && bar>=48 && bar%8===5) add('melody',at+3.4,tones[0]+octave,0.5,0.26, -0.18);
    } else if ((opening || breath) && bar%4===2) {
      const note=chord.notes[chord.notes.length-1];
      add('melody',at+1.5,note,1.4,0.28,0.1);
      add('melody',at+3,note-2,0.75,0.23,-0.06);
    }
    const drums=bar>=4 && bar<60 && !breath;
    if (drums) {
      const dv=(opening?0.65:1)*volume;
      add('kick',at,36,0.35,0.78*dv);
      add('kick',at+(drumVariant===1?2.5+swing:2.0),36,0.3,0.60*dv);
      if (bar%4===2 && !opening) add('kick',at+3.5+swing,36,0.25,0.36*dv);
      add('snare',at+1.035,38,0.2,0.52*dv,-0.04);
      add('snare',at+3.045,38,0.2,0.57*dv,-0.04);
      if(bar%4===3 && !opening) add('rim',at+2.65,40,0.08,0.25*dv,0.12);
      for(let eighth=0;eighth<8;eighth++) {
        if ((bar+eighth)%11===0 || (opening && eighth%2))continue;
        add('hat',at+eighth*0.5+(eighth%2?swing:0),42,eighth===7&&bar%4===3?0.22:0.06,(eighth%2?0.16:0.25)*dv,0.25);
      }
    }
  }
  events.sort((a,b)=>a.beat-b.beat);
  return {seed:songSeed,index,title:`${choose(words[mood])} · ${choose(subtitles)}`,bpm,key:keyNames[tonic],bars:64,swing,events,harmony,sections};
}
