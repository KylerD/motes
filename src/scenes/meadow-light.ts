const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};

/** Light leaves the clearing before the blue hour reaches the water. */
export function meadowLightAt(seconds:number) {
  const t=Math.max(0,Number.isFinite(seconds)?seconds:0);
  return {
    sky:smooth(t/3000),distance:smooth((t-180)/2820),
    clearing:smooth((t-60)/2460),water:smooth((t-240)/2700),
    lamps:smooth((t-1500)/1380),fireflies:smooth((t-1700)/1100),
    caption:t<900?'Sun through the branches':t<1800?'The sunlight slips away':t<2700?'Blue hour by the water':'Lantern light and fireflies',
    subtitle:t<1200?'A little longer in the afternoon.':t<2400?'Stay while the light changes.':'A little light, just for you.',
  };
}
