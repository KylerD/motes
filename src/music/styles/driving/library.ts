export type SynthQuality='min'|'maj'|'sus2'|'madd9'|'add9'|'five';
export const INTERVALS:Record<SynthQuality,number[]>={min:[0,3,7],maj:[0,4,7],sus2:[0,2,7],madd9:[0,3,7,14],add9:[0,4,7,14],five:[0,7,12]};
export interface SynthChord {degree:number;quality:SynthQuality}
export interface SynthLoop {id:string;bars:readonly SynthChord[];darkness:readonly [number,number];slow?:boolean;pedal?:boolean}
const L=(id:string,darkness:[number,number],chords:[number,SynthQuality][],flags:{slow?:boolean;pedal?:boolean}={}):SynthLoop=>
  ({id,darkness,bars:chords.map(([degree,quality])=>({degree,quality})),...flags});
/** Four-chord loops in semitones above the minor tonic; `slow` holds each chord two bars, `pedal` keeps the bass on the tonic. */
export const SYNTH_LOOPS:readonly SynthLoop[]=[
  L('horizon',[0,.5],[[0,'madd9'],[8,'maj'],[10,'maj'],[0,'min']]),
  L('coastline',[0,.6],[[0,'min'],[8,'add9'],[10,'maj'],[7,'min']]),
  L('overpass',[0,.5],[[8,'maj'],[10,'maj'],[0,'min'],[3,'maj']]),
  L('afterglow',[0,.7],[[0,'min'],[10,'maj'],[8,'maj'],[5,'min']]),
  L('uplift',[0,.4],[[8,'add9'],[10,'sus2'],[0,'madd9'],[0,'min']]),
  L('dorian',[.1,.6],[[0,'min'],[5,'maj'],[0,'min'],[5,'maj']]),
  L('chrome',[.4,1],[[8,'maj'],[5,'maj'],[0,'min'],[0,'min']]),
  L('riser',[.4,1],[[3,'maj'],[5,'maj'],[0,'min'],[0,'five']]),
  L('tunnel',[.5,1],[[5,'maj'],[3,'maj'],[0,'min'],[7,'maj']]),
  L('undertow',[.5,1],[[0,'five'],[8,'maj'],[10,'maj'],[8,'maj']],{pedal:true}),
  L('descent',[.6,1],[[0,'five'],[10,'five'],[8,'five'],[7,'maj']]),
  L('longroad',[.6,1],[[0,'five'],[8,'five'],[3,'five'],[10,'five']],{slow:true}),
];
/** The four synth voices an hour rotates through; each brings its own patches and snare. */
export type SynthPatch='analog'|'pulse'|'glass'|'dark';
export type SynthRole='intro'|'verse'|'build'|'chorus'|'break'|'outro';
export type SynthForm='cruise'|'drive'|'descent'|'slowburn';
const S=(...parts:[SynthRole,number,string][])=>parts;
/** Each part's role, bars and the name shown while it plays. */
export const SYNTH_FORMS:Record<SynthForm,readonly [SynthRole,number,string][]>={
  cruise:S(['intro',8,'First gear'],['verse',16,'Open lanes'],['build',8,'Up the ramp'],['chorus',16,'Full beam'],['break',8,'At the lights'],['chorus',16,'Full beam again'],['outro',16,'Heading home']),
  drive:S(['intro',8,'First gear'],['verse',16,'Open lanes'],['build',8,'Up the ramp'],['chorus',16,'Full beam'],['break',8,'At the lights'],['verse',16,'Ring road'],['build',8,'Last climb'],['chorus',16,'Full beam again'],['outro',16,'Heading home']),
  descent:S(['intro',16,'Low hum'],['build',16,'Foot down'],['chorus',32,'Flat out'],['break',16,'Coasting'],['chorus',32,'Flat out again'],['outro',16,'Easing off']),
  slowburn:S(['intro',8,'Pulled over'],['verse',16,'Engine ticking'],['chorus',16,'City glow'],['break',8,'Windows down'],['chorus',8,'City glow again'],['outro',8,'Rolling on']),
};
export type BassPattern='sixteenths'|'octaves'|'gallop'|'pulse';
/** Onsets within a bar, and whether the note is the octave above. */
export const BASS:Record<BassPattern,readonly [at:number,octave:boolean][]>={
  sixteenths:Array.from({length:16},(_,i)=>[i/4,false] as [number,boolean]),
  octaves:Array.from({length:8},(_,i)=>[i/2,i%2===1] as [number,boolean]),
  gallop:[0,1,2,3].flatMap(b=>[[b,false],[b+.5,false],[b+.75,false]] as [number,boolean][]),
  pulse:[[0,false],[1,false],[2,false],[3,false]],
};
export type ArpCell='eighth'|'up16'|'updown16'|'octave16'|'broken16';
/** Chord-tone indices per step; 'eighth' steps every half beat, the rest every quarter beat. */
export const ARPS:Record<ArpCell,readonly number[]>={
  eighth:[0,1,2,3,4,3,2,1],
  up16:[0,1,2,3,0,1,2,3,0,1,2,3,0,1,2,3],
  updown16:[0,1,2,3,4,3,2,1,0,1,2,3,4,3,2,1],
  octave16:[0,3,1,4,2,5,1,4,0,3,1,4,2,5,1,4],
  broken16:[0,2,1,3,2,4,3,5,0,2,1,3,2,4,3,5],
};
/** Two-bar straight lead rhythms: [beat, duration]. Each leaves air and ends on a held note. */
export const LEAD_CELLS:readonly (readonly [number,number][])[]=[
  [[0,1.5],[1.5,.5],[2,1],[3,1],[4,3]],
  [[0,.5],[.5,.5],[1,.5],[1.5,1.5],[4,.5],[4.5,.5],[5,2]],
  [[.5,.5],[1,1],[2,.5],[2.5,1.5],[4.5,.5],[5,.5],[5.5,.5],[6,1.5]],
  [[0,.75],[.75,.75],[1.5,2.5],[4,.75],[4.75,.75],[5.5,2]],
  [[0,2],[2,.5],[2.5,.5],[3,1],[4,.5],[4.5,.5],[5,.5],[5.5,.5],[6,1.5]],
  [[1,.5],[1.5,.5],[2,1],[3,.75],[3.75,1.25],[6,1.5]],
];
