import { LINEAGES } from './model';
import type { Pool } from './model';
import { colonies } from './world';
import type { SanctuaryMood } from './sanctuary-space';

interface Voice { oscillator: OscillatorNode; overtone: OscillatorNode; gain: GainNode; filter: BiquadFilterNode; pan: StereoPannerNode }
export class PoolAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: Voice[] = [];
  muted = true;
  private volume = 0.55;
  private chimes = new Map<number, number>();
  private atmosphere: GainNode | null = null;
  private airFilter: BiquadFilterNode | null = null;
  private mood: SanctuaryMood = 'rain';
  private weather = true;
  async enable(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      const ctx = this.context;
      this.master = ctx.createGain(); this.master.gain.value = 0;
      const compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -18; compressor.ratio.value = 5;
      this.master.connect(compressor); compressor.connect(ctx.destination);
      const delay = ctx.createDelay(1); delay.delayTime.value = 0.38;
      const feedback = ctx.createGain(); feedback.gain.value = 0.24;
      const wet = ctx.createGain(); wet.gain.value = 0.3;
      this.master.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(compressor);
      // A bounded, seamless noise bed: rain in the city, softer wind in the meadow.
      const buffer = ctx.createBuffer(1,ctx.sampleRate*6,ctx.sampleRate), data = buffer.getChannelData(0);
      let state = 73521, brown = 0;
      for (let i = 0; i < data.length; i++) {
        state = (Math.imul(state,1664525)+1013904223) >>> 0;
        const white = state / 4294967296 * 2 - 1; brown = (brown + white*.02)/1.02;
        data[i] = white*.32 + brown*2.5;
      }
      // Crossfade the end into the beginning to avoid a click at the loop boundary.
      const fade = Math.floor(ctx.sampleRate*.05);
      for (let i = 0; i < fade; i++) data[data.length-fade+i] = data[data.length-fade+i]*(1-i/fade)+data[i]*(i/fade);
      const air = ctx.createBufferSource(); air.buffer = buffer; air.loop = true; air.loopStart = fade/ctx.sampleRate;
      this.airFilter = ctx.createBiquadFilter(); this.airFilter.type = 'lowpass'; this.airFilter.Q.value = .35;
      this.atmosphere = ctx.createGain(); this.atmosphere.gain.value = 0;
      air.connect(this.airFilter); this.airFilter.connect(this.atmosphere); this.atmosphere.connect(this.master); air.start();
      for (let i = 0; i < 5; i++) {
        const oscillator = ctx.createOscillator(), overtone = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter(), pan = ctx.createStereoPanner();
        oscillator.type = 'sine'; overtone.type = 'triangle';
        filter.type = 'lowpass'; filter.frequency.value = 750; gain.gain.value = 0;
        oscillator.connect(filter); overtone.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(this.master);
        oscillator.start(); overtone.start(); this.voices.push({ oscillator, overtone, gain, filter, pan });
      }
    }
    await this.context.resume(); this.setMuted(false);
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.context && this.master) this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.context.currentTime, 0.35);
  }
  setVolume(volume: number): void { this.volume = Math.max(0, Math.min(1, volume)); this.setMuted(this.muted); }
  setAtmosphere(mood: SanctuaryMood, weather: boolean): void { this.mood = mood; this.weather = weather; }
  update(pool: Pool, selected: number | null, paused = false): void {
    if (!this.context || this.muted) return;
    const groups = colonies(pool).filter(g => g.cells.length >= 3).slice(0, 5), now = this.context.currentTime;
    this.atmosphere?.gain.setTargetAtTime(paused || !this.weather ? 0 : this.mood === 'rain' ? .16 : .07,now,.7);
    this.airFilter?.frequency.setTargetAtTime(this.mood === 'rain' ? 3800 : 650,now,.8);
    this.voices.forEach((v, i) => {
      const g = groups[i];
      if (!g || paused) { v.gain.gain.setTargetAtTime(0, now, 0.25); return; }
      const base = LINEAGES[g.lineage].note, phase = g.cells.reduce((s, c) => s + Math.sin(c.phase), 0) / g.cells.length;
      const focus = g.cells.some(c => c.id === selected);
      const volume = (0.013 + Math.max(0, phase) * 0.034) * g.energy * (selected === null || focus ? 1 : 0.45);
      v.oscillator.frequency.setTargetAtTime(base * (g.cells.length < 15 ? 2 : 1), now, 0.3);
      v.overtone.frequency.setTargetAtTime(base * 2.002, now, 0.3);
      v.gain.gain.setTargetAtTime(volume, now, 0.12);
      v.filter.frequency.setTargetAtTime(320 + g.coherence * 1100, now, 0.3);
      v.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, (g.x - 800) / 800)), now, 0.3);
      // Soft electric-piano overtones arrive on the organism's pulse, not a separate soundtrack clock.
      const cycle = Math.floor(g.cells[0].phase / (Math.PI * 2));
      const previous = this.chimes.get(g.id);
      if (previous !== undefined && cycle > previous && this.master) {
        const note = this.context!.createOscillator(), envelope = this.context!.createGain(), mellow = this.context!.createBiquadFilter();
        note.type = 'triangle'; note.frequency.value = base * [2, 3, 4, 3][((cycle % 4) + 4) % 4];
        mellow.type = 'lowpass'; mellow.frequency.value = 1150;
        envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(0.032 * g.energy, now + 0.025);
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
        note.connect(mellow); mellow.connect(envelope); envelope.connect(this.master);
        note.start(now); note.stop(now + 2.5);
        note.onended = () => { note.disconnect(); mellow.disconnect(); envelope.disconnect(); };
      }
      this.chimes.set(g.id, cycle);
    });
    const livingIds = new Set(groups.map(g => g.id));
    for (const id of this.chimes.keys()) if (!livingIds.has(id)) this.chimes.delete(id);
  }
  dispose(): void { void this.context?.close(); this.context = null; this.voices = []; }
}
