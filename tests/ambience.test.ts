import {describe,it,expect} from 'vitest';
import {readFileSync,statSync} from 'node:fs';
import {BED_SWAP,BED_SWAP_JITTER,bedSegment,bedSegmentAt,createSession,eventSpotsBetween,eventStrength,sessionAt,spotsBetween} from '../src/session/session';
import {SOUND_MAPS,across,pathAt} from '../src/music/ambience-maps';
import {PANNER_BUDGET,SPOT_PANNERS,arcAt,placeAt} from '../src/music/ambience';

const rain=SOUND_MAPS.rain!;
const encoded=JSON.parse(readFileSync('public/audio/ambience/encoded.json','utf8')) as {place:string;bytes:number;files:{file:string;seconds:number;channels:number}[]}[];

describe('scene sounds',()=>{
  it('gives every place recorded scene sounds',()=>{
    expect(Object.keys(SOUND_MAPS).sort()).toEqual(['coast','meadow','rain','snow']);
  });

  it('ships every recording a sound map names, inside its 1.2 MB place budget',()=>{
    for(const [place,map] of Object.entries(SOUND_MAPS)) {
      const names=new Set([...map!.beds,...map!.spots,...map!.movers??[],...map!.calls??[]].map(sound=>sound.file));
      const files=[...names].map(name=>`public/audio/ambience/${place}/${name}.mp3`);
      expect(files.reduce((sum,file)=>sum+statSync(file).size,0)).toBeLessThanOrEqual(1.2e6);
      // Nothing ships that no map plays.
      expect(encoded.find(entry=>entry.place===place)!.files.map(f=>f.file).sort()).toEqual([...names].map(name=>`${place}/${name}.mp3`).sort());
      const written=encoded.find(entry=>entry.place===place)!;
      for(const bed of map!.beds) {
        const file=written.files.find(f=>f.file===`${place}/${bed.file}.mp3`)!;
        // Loop points come from the map, so they must match what the encoder wrote.
        expect(bed.seconds).toBeCloseTo(file.seconds,2);
        expect(file.channels).toBe(bed.position?1:2);
      }
      for(const spots of [...map!.spots,...map!.calls??[]])expect(written.files.find(f=>f.file===`${place}/${spots.file}.mp3`)!.seconds).toBeCloseTo(spots.variants*spots.slot,2);
      for(const mover of map!.movers??[])expect(written.files.find(f=>f.file===`${place}/${mover.file}.mp3`)!.seconds).toBeCloseTo(mover.seconds,2);
    }
  });

  it('gives a voice only to events the place plans, along paths that run start to end',()=>{
    for(const [place,map] of Object.entries(SOUND_MAPS)) {
      const kinds=new Set(createSession(1,place as keyof typeof SOUND_MAPS).events.map(e=>e.kind));
      for(const sound of [...map!.movers??[],...map!.calls??[]]) {
        expect(kinds.has(sound.kind),`${place} plans no ${sound.kind}`).toBe(true);
        const progress=sound.path.map(key=>key[0]);
        expect(progress[0]).toBe(0);expect(progress.at(-1)).toBe(1);
        for(let i=1;i<progress.length;i++)expect(progress[i]).toBeGreaterThan(progress[i-1]);
      }
      // Every sound is placed somewhere a listener can hear it come from.
      const positions=[...map!.beds.flatMap(b=>b.position?[b.position]:[]),...map!.spots.flatMap(s=>[s.position,...s.elsewhere??[]]),
        ...[...map!.movers??[],...map!.calls??[]].flatMap(s=>s.path.map(([,azimuth,elevation,distance])=>({azimuth,elevation,distance})))];
      for(const p of positions){expect(Math.abs(p.azimuth)).toBeLessThanOrEqual(90);expect(Math.abs(p.elevation)).toBeLessThanOrEqual(60);expect(p.distance).toBeGreaterThan(0);}
    }
  });

  it('keeps within the panner budget, leaving one for a moving event',()=>{
    for(const map of Object.values(SOUND_MAPS)) {
      expect(map!.beds.filter(bed=>bed.position).length+SPOT_PANNERS+1).toBeLessThanOrEqual(PANNER_BUDGET);
      // Movers of one kind never overlap, and a place moves one kind of thing.
      expect(new Set((map!.movers??[]).map(mover=>mover.kind)).size).toBeLessThanOrEqual(1);
    }
  });

  it('follows an event along the path the picture draws',()=>{
    const path=[[0,across(.21),0,200,.3],[.32,across(.66),0,120,1],[.59,across(.66),0,120,1],[1,across(1.05),0,200,.2]] as const;
    expect(pathAt(path,0).position.azimuth).toBeCloseTo(-17.4);
    expect(pathAt(path,.45).position.azimuth).toBeCloseTo(across(.66));
    expect(pathAt(path,.16).level).toBeCloseTo(.65,1);
    expect(pathAt(path,2).position.azimuth).toBeCloseTo(across(1.05));
    // Sound and picture share one envelope.
    const plan=createSession(9,'snow'),train=plan.events.find(e=>e.kind==='train')!;
    const midway=train.start+train.duration*.3;
    expect(eventStrength(.3)).toBe(sessionAt(plan,midway).events.find(e=>e.kind==='train')!.strength);
  });

  it('lets an event call only while it runs, the same way every time',()=>{
    const plan=createSession(11,'coast'),birds=plan.events.filter(e=>e.kind==='birds');
    const family={name:'gulls',period:2,chance:.6,variants:4,spread:5};
    const calls=eventSpotsBetween(11,family,birds[0],0,0,3600);
    expect(calls.length).toBeGreaterThan(3);
    for(const call of calls){expect(call.time).toBeGreaterThanOrEqual(birds[0].start);expect(call.time).toBeLessThan(birds[0].start+birds[0].duration);expect(call.progress).toBeGreaterThanOrEqual(0);expect(call.progress).toBeLessThan(1);}
    expect(eventSpotsBetween(11,family,birds[0],0,0,3600)).toEqual(calls);
    expect(eventSpotsBetween(11,family,birds[1],1,0,3600).map(c=>c.progress)).not.toEqual(calls.map(c=>c.progress));
    // A spot family can sound from several places.
    const places=new Set(spotsBetween(3,{...family,places:3},0,600).map(s=>s.place));
    expect([...places].sort()).toEqual([0,1,2]);
  });

  it('plans spots from the edition seed alone, the same every time',()=>{
    const drips=rain.spots.find(s=>s.name==='drips')!;
    const first=spotsBetween(20260917,drips,0,600);
    expect(spotsBetween(20260917,drips,0,600)).toEqual(first);
    // Any stretch samples the same plan: two halves make the whole.
    expect([...spotsBetween(20260917,drips,0,300),...spotsBetween(20260917,drips,300,600)]).toEqual(first);
    expect(spotsBetween(20260918,drips,0,600)).not.toEqual(first);
    expect(first.length).toBeGreaterThan(600/drips.period*drips.chance*.7);
    for(const spot of first) {
      expect(Math.abs(spot.detune)).toBeLessThanOrEqual(50);
      expect(Math.abs(spot.azimuth)).toBeLessThanOrEqual(drips.spread);
    }
    for(let i=1;i<first.length;i++)expect(first[i].time).toBeGreaterThan(first[i-1].time);
  });

  it('never replays the hour after hours',()=>{
    for(const family of rain.spots) {
      const hour=spotsBetween(7,family,0,3600).map(s=>[+(s.time%3600).toFixed(3),s.variant]);
      const after=spotsBetween(7,family,3600,7200).map(s=>[+(s.time%3600).toFixed(3),s.variant]);
      expect(after).not.toEqual(hour);
    }
    const before=bedSegmentAt(7,'garden',1800),later=bedSegmentAt(7,'garden',5400);
    expect(later.offset).not.toBe(before.offset);
  });

  it('swaps each bed between readings every few seconds, never in a regular loop',()=>{
    let previous=bedSegment(3,'roof',0),gaps=new Set<number>();
    expect(previous.start).toBe(0);
    for(let index=1;index<300;index++) {
      const segment=bedSegment(3,'roof',index),gap=segment.start-previous.start;
      expect(gap).toBeGreaterThanOrEqual(BED_SWAP-2*BED_SWAP_JITTER);
      expect(gap).toBeLessThanOrEqual(BED_SWAP+2*BED_SWAP_JITTER);
      expect(Math.abs(segment.drift)).toBeLessThanOrEqual(1.5);
      expect(bedSegmentAt(3,'roof',segment.start+.01).index).toBe(index);
      expect(bedSegmentAt(3,'roof',segment.start-.01).index).toBe(index-1);
      gaps.add(Math.round(gap));previous=segment;
    }
    expect(gaps.size).toBeGreaterThan(5);
  });

  it('follows the evening and holds it after hours',()=>{
    for(const [place,map] of Object.entries(SOUND_MAPS))for(const sound of [...map!.beds,...map!.spots]) {
      const mood=place as keyof typeof SOUND_MAPS;
      expect(arcAt(mood,sound.arc,0)).toBeLessThan(.05);
      expect(arcAt(mood,sound.arc,3600)).toBeCloseTo(1,5);
      expect(arcAt(mood,sound.arc,9000)).toBe(arcAt(mood,sound.arc,3600));
    }
  });

  it('places sounds in the listener frame, and nearer the middle on speakers',()=>{
    const right=placeAt({azimuth:90,elevation:0,distance:2},'headphones');
    expect(right.x).toBeCloseTo(2);expect(right.z).toBeCloseTo(0);
    const ahead=placeAt({azimuth:0,elevation:0,distance:3},'headphones');
    expect(ahead.z).toBeCloseTo(-3);
    const above=placeAt({azimuth:0,elevation:90,distance:1},'speakers');
    expect(above.y).toBeCloseTo(1);
    const speakers=placeAt({azimuth:-60,elevation:0,distance:1},'speakers');
    expect(Math.atan2(speakers.x,-speakers.z)*180/Math.PI).toBeCloseTo(-40);
  });

  it('leaves the session plan and its music untouched',()=>{
    // Scene sounds sample their own streams; the plan is the same object it was.
    expect(Object.keys(createSession(5,'rain')).sort()).toEqual(['duration','events','mood','seed','slots','style']);
  });
});
