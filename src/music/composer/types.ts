export type Mood = 'rain' | 'meadow' | 'snow' | 'coast';
export type Instrument = 'piano' | 'melody' | 'bass' | 'kick' | 'snare' | 'hat' | 'rim';
export type MusicMode = 'beats' | 'ambient';
export type KeyVoice = 'upright' | 'felt' | 'electric' | 'vibes';
export type Mode = 'major' | 'minor';
export type FormName = 'beat-tape' | 'hook' | 'long' | 'nocturne';
export type Role = 'intro' | 'head' | 'contrast' | 'breath' | 'stretch' | 'return' | 'tag';
export type Quality = 'maj7' | 'maj9' | 'six9' | 'maj9#11' | 'min7' | 'min9' | 'min11' | 'min6'
  | 'dom7' | 'dom9' | 'dom13' | 'dom7sus' | 'dom7b9' | 'halfdim';
export type CompCell = 'roll' | 'stab' | 'push' | 'halves' | 'charleston' | 'pad';
export type GrooveCell = 'home' | 'skip' | 'late' | 'lean';

/** A two-bar melodic idea: an authored rhythm cell, a contour of scale steps, and the key degree it starts from. */
export interface Theme { cell: number; contour: number[]; degree: 2 | 4 }

export interface Arrangement {
  bpm: number; tonic: number; voice: KeyVoice; energy: number; swing: number;
  form: FormName; mode: Mode; loop: string; comp: CompCell; groove: GrooveCell; theme: Theme; stretch: boolean;
}
export interface ScoreEvent { beat: number; duration: number; note: number; velocity: number; pan: number; instrument: Instrument; voice?: KeyVoice }
/** A chord starting at `beat` within its bar; `notes` is the rootless piano voicing, `root` belongs to the bass. */
export interface Chord { root: number; quality: Quality; notes: number[]; beat: number }
export interface Section { name: string; role: Role; startBar: number; endBar: number }
export interface Track {
  seed: number; index: number; title: string; bpm: number; key: string; bars: number;
  swing: number; events: ScoreEvent[]; harmony: Chord[][]; sections: Section[];
  voice: KeyVoice; form: FormName; mode: Mode; theme: Theme; loop: string;
  session?: { seed: number; offset: number };
}
