import {renderPreview} from '../music/audio';
import type {MusicMode,MusicStyle} from '../music/composer';
import type {Edition} from '../scenes/edition';
import {createSession,composeSessionTrack} from '../session/session';
import {CLIP,loudnessGain,musicStartBeat} from './plan';

/** The edition's opening song from its first theme, rendered offline exactly as the radio plays it. */
export async function renderClipMusic(edition:Edition,style:MusicStyle,mode:MusicMode):Promise<AudioBuffer> {
  const track=composeSessionTrack(createSession(edition.seed,edition.scene,style),0);
  const {buffer}=await renderPreview({seed:edition.seed,mood:edition.scene,style,mode,index:0,seconds:CLIP.seconds,
    sampleRate:CLIP.sampleRate,fromBeat:musicStartBeat(track),fadeIn:CLIP.fadeIn,fadeOut:CLIP.fadeOut});
  const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
  let power=0,peak=0,count=0;
  for(const data of channels)for(const value of data){power+=value*value;peak=Math.max(peak,Math.abs(value));count++;}
  const gain=loudnessGain(Math.sqrt(power/Math.max(1,count)),peak);
  for(const data of channels)for(let i=0;i<data.length;i++)data[i]*=gain;
  return buffer;
}
