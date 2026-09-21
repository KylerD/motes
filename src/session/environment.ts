/** Elapsed listening time, independent of track positions and animation frames.
 * The caller supplies AudioContext time, so device suspension also holds the sky. */
export class EnvironmentClock {
  private elapsed=0;
  private startedAt:number|undefined;
  seconds(now:number):number {
    return this.elapsed+(this.startedAt===undefined?0:Math.max(0,now-this.startedAt));
  }
  start(now:number):void {if(this.startedAt===undefined)this.startedAt=now;}
  pause(now:number):void {this.elapsed=this.seconds(now);this.startedAt=undefined;}
  reset(now:number):void {this.elapsed=0;if(this.startedAt!==undefined)this.startedAt=now;}
}
