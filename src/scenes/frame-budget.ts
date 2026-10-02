/** A place left open for hours should cost less than a video stream. The scene
 * paints at a calm, steady rate; crossfades and ripples get smoother frames, and a
 * still picture is only redrawn when something about it changes. */
export const STEADY_FPS=30,SMOOTH_FPS=60,STILL_CHECK_MS=1000;
/** Wake slightly early so the following animation frame lands on time. */
export const FRAME_SLACK_MS=4;

export function frameDelay({motion,smooth,spent}:{motion:boolean;smooth:boolean;spent:number}):number {
  if(!motion)return STILL_CHECK_MS;
  return Math.max(0,1000/(smooth?SMOOTH_FPS:STEADY_FPS)-spent-FRAME_SLACK_MS);
}
