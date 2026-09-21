import {describe,it,expect} from 'vitest';
import {EnvironmentClock} from '../src/session/environment';
import {meadowLightAt} from '../src/scenes/meadow-light';

describe('the environmental clock',()=>{
  it('counts listening time independently of score position, rendering and polling',()=>{
    const clock=new EnvironmentClock();
    expect(clock.seconds(100)).toBe(0);
    clock.start(100);
    expect(clock.seconds(130)).toBe(30);
    // No animation frames or polls are needed while the tab is hidden.
    expect(clock.seconds(1300)).toBe(1200);
    clock.start(1300); // An already-running play action must not restart sunset.
    expect(clock.seconds(1320)).toBe(1220);
  });
  it('holds while paused and resumes without counting silence',()=>{
    const clock=new EnvironmentClock();clock.start(10);clock.pause(70);
    expect(clock.seconds(300)).toBe(60);
    clock.pause(300);clock.start(350);
    expect(clock.seconds(380)).toBe(90);
  });
  it('starts a fresh place immediately and preserves whether listening is active',()=>{
    const clock=new EnvironmentClock();clock.start(0);clock.reset(500);
    expect(clock.seconds(530)).toBe(30);
    clock.pause(530);clock.reset(600);
    expect(clock.seconds(900)).toBe(0);
    clock.start(920);expect(clock.seconds(950)).toBe(30);
  });
});

describe('meadow light',()=>{
  it('changes the clearing, sky and water at different rates without reversing',()=>{
    const fields=['sky','distance','clearing','water','lamps','fireflies'] as const;
    let previous=meadowLightAt(0);
    for(let seconds=30;seconds<=7200;seconds+=30){
      const state=meadowLightAt(seconds);
      for(const field of fields){expect(state[field]).toBeGreaterThanOrEqual(previous[field]);expect(state[field]).toBeLessThanOrEqual(1);}
      previous=state;
    }
    const mid=meadowLightAt(1200);
    expect(mid.clearing).toBeGreaterThan(.4);
    expect(mid.sky).not.toBe(mid.water);
    expect(mid.fireflies).toBe(0);
    expect(meadowLightAt(3300).fireflies).toBe(1);
    expect(meadowLightAt(3600)).toEqual(meadowLightAt(7200));
  });
});
