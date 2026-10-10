import {describe,it,expect} from 'vitest';
import {readFileSync,statSync} from 'node:fs';
import {BED_SWAP,BED_SWAP_JITTER,bedSegment,bedSegmentAt,createSession,spotsBetween} from '../src/session/session';
import {SOUND_MAPS} from '../src/music/ambience-maps';
import {PANNER_BUDGET,SPOT_PANNERS,arcAt,placeAt} from '../src/music/ambience';

const rain=SOUND_MAPS.rain!;
const encoded=JSON.parse(readFileSync('public/audio/ambience/encoded.json','utf8')) as {place:string;bytes:number;files:{file:string;seconds:number;channels:number}[]}[];

describe('scene sounds',()=>{
  it('ships every recording a sound map names, inside its 1.2 MB place budget',()=>{
    for(const [place,map] of Object.entries(SOUND_MAPS)) {
      const files=[...map!.beds,...map!.spots].map(sound=>`public/audio/ambience/${place}/${sound.file}.mp3`);
      expect(files.reduce((sum,file)=>sum+statSync(file).size,0)).toBeLessThanOrEqual(1.2e6);
      const written=encoded.find(entry=>entry.place===place)!;
      for(const bed of map!.beds) {
        const file=written.files.find(f=>f.file===`${place}/${bed.file}.mp3`)!;
        // Loop points come from the map, so they must match what the encoder wrote.
        expect(bed.seconds).toBeCloseTo(file.seconds,2);
        expect(file.channels).toBe(bed.position?1:2);
      }
      for(const spots of map!.spots)expect(written.files.find(f=>f.file===`${place}/${spots.file}.mp3`)!.seconds).toBeCloseTo(spots.variants*spots.slot,2);
    }
  });

  it('keeps within the panner budget, leaving one for a moving event',()=>{
    for(const map of Object.values(SOUND_MAPS))expect(map!.beds.filter(bed=>bed.position).length+SPOT_PANNERS+1).toBeLessThanOrEqual(PANNER_BUDGET);
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
    for(const sound of [...rain.beds,...rain.spots]) {
      expect(arcAt('rain',sound.arc,0)).toBeLessThan(.05);
      expect(arcAt('rain',sound.arc,3600)).toBeCloseTo(1,5);
      expect(arcAt('rain',sound.arc,9000)).toBe(arcAt('rain',sound.arc,3600));
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
