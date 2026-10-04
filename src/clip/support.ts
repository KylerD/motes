import {CLIP} from './plan';

/** Whether this browser can encode the clip's H.264 video, checked without loading the encoder. */
export async function canMakeClips():Promise<boolean> {
  if(typeof VideoEncoder==='undefined')return false;
  try {
    const {supported}=await VideoEncoder.isConfigSupported({codec:'avc1.640028',width:CLIP.width,height:CLIP.height,bitrate:CLIP.videoBitrate,framerate:CLIP.fps});
    return !!supported;
  } catch {return false;}
}
