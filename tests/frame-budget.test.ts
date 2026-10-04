import {describe,expect,it} from 'vitest';
import {FRAME_SLACK_MS,SMOOTH_FPS,STEADY_FPS,STILL_CHECK_MS,frameDelay} from '../src/scenes/frame-budget';

describe('frame budget',()=>{
  it('paints a moving scene at a steady thirty frames a second',()=>{
    expect(STEADY_FPS).toBe(30);
    expect(frameDelay({motion:true,smooth:false,spent:0})).toBeCloseTo(1000/30-FRAME_SLACK_MS);
  });
  it('gives transitions and ripples smoother frames',()=>{
    expect(SMOOTH_FPS).toBe(60);
    expect(frameDelay({motion:true,smooth:true,spent:0})).toBeCloseTo(1000/60-FRAME_SLACK_MS);
  });
  it('subtracts the time already spent drawing and never waits a negative time',()=>{
    expect(frameDelay({motion:true,smooth:false,spent:10})).toBeCloseTo(1000/30-10-FRAME_SLACK_MS);
    expect(frameDelay({motion:true,smooth:false,spent:80})).toBe(0);
  });
  it('only checks a still picture occasionally',()=>{
    expect(frameDelay({motion:false,smooth:false,spent:0})).toBe(STILL_CHECK_MS);
    expect(frameDelay({motion:false,smooth:true,spent:0})).toBe(STILL_CHECK_MS);
    expect(STILL_CHECK_MS).toBeGreaterThanOrEqual(500);
  });
});
