import {describe,expect,it} from 'vitest';
import {createSession,composeSessionTrack} from '../src/session/session';
import {composeTrack,type Mood,type Track} from '../src/music/composer';
import {MELODY_TONES,allowedPitchClasses,chordAt} from '../src/music/composer/harmony';
import {chordTones,isStrong} from '../src/music/composer/melody';

const keys=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const tracks:Track[]=[
  ...(['rain','meadow','snow','coast'] as Mood[]).flatMap(mood=>[20260917,4242].flatMap(seed=>{const plan=createSession(seed,mood);return plan.slots.map((_,i)=>composeSessionTrack(plan,i));})),
  ...Array.from({length:20},(_,seed)=>composeTrack(seed,'rain',seed%5)),
];

describe('melodic hygiene',()=>{
  it('lands strong beats on chord tones, resolves passing notes by step and stays in register',()=>{
    for(const track of tracks){
      const tonic=keys.indexOf(track.key.replace('m','')),melody=track.events.filter(e=>e.instrument==='melody');
      melody.forEach((e,i)=>{
        const beat=Math.round(e.beat*2)/2,chord=chordAt(track.harmony,beat),pc=e.note%12,where=`${track.title} beat ${beat}`;
        expect(e.note,where).toBeGreaterThanOrEqual(Math.max(64,Math.max(...chord.notes)-2));
        expect(e.note,where).toBeLessThanOrEqual(81);
        if(isStrong(beat,e.duration)){
          expect(MELODY_TONES[chord.quality].map(n=>(chord.root+n)%12),where).toContain(pc);
        }else if(!chordTones(chord).has(pc)){
          expect(allowedPitchClasses(chord,tonic,track.mode).has(pc),where).toBe(true);
          const next=melody[i+1],nextChord=chordAt(track.harmony,Math.round(next.beat*2)/2);
          expect(chordTones(nextChord).has(next.note%12)&&Math.abs(next.note-e.note)<=2,where).toBe(true);
        }
      });
    }
  });
});
