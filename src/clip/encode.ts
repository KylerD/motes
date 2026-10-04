import {AudioBufferSource,BufferTarget,CanvasSource,Mp4OutputFormat,Output,Quality,canEncodeAudio} from 'mediabunny';
import {CLIP,FRAMES} from './plan';

/** Draws and encodes every frame, plus the music, into a fast-start MP4. */
export async function encodeClip(canvas:HTMLCanvasElement,music:AudioBuffer,drawFrame:(index:number)=>void,
  {signal,onProgress}:{signal?:AbortSignal;onProgress?:(fraction:number)=>void}={}):Promise<Blob> {
  // Firefox and Linux Chromium can't encode AAC natively; a WebAssembly build of FFmpeg's encoder fills in.
  if(!await canEncodeAudio('aac')){const {registerAacEncoder}=await import('@mediabunny/aac-encoder');registerAacEncoder();}
  const output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target:new BufferTarget()});
  const video=new CanvasSource(canvas,{codec:'avc',quality:new Quality({bitrate:CLIP.videoBitrate}),keyFrameInterval:2});
  const audio=new AudioBufferSource({codec:'aac',quality:new Quality({bitrate:CLIP.audioBitrate})});
  output.addVideoTrack(video,{frameRate:CLIP.fps});output.addAudioTrack(audio);
  const stop=()=>{if(output.state==='started'||output.state==='pending')void output.cancel();};
  signal?.addEventListener('abort',stop,{once:true});
  try {
    await output.start();
    await audio.add(music);
    for(let i=0;i<FRAMES;i++) {
      signal?.throwIfAborted();
      drawFrame(i);
      await video.add(i/CLIP.fps,1/CLIP.fps);
      // Let the page, its music and the player breathe between small batches.
      if(i%6===5)await new Promise(resolve=>setTimeout(resolve,0));
      onProgress?.((i+1)/FRAMES);
    }
    signal?.throwIfAborted();
    await output.finalize();
    return new Blob([output.target.buffer!],{type:'video/mp4'});
  } catch(error) {
    if(output.state!=='canceled'&&output.state!=='finalized')await output.cancel().catch(()=>undefined);
    throw error;
  } finally {signal?.removeEventListener('abort',stop);}
}
