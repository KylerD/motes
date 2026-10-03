/** Small deterministic generator: score choices never depend on wall time or rendering. */
export function randomSource(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let x = Math.imul(value ^ value >>> 15, 1 | value);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

export const chooser = (random: () => number) => <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)];

/** Pick from options not used by the neighbours; the fallback order keeps assignment total. */
export function pick<T>(random: () => number, options: readonly T[], avoid: (T | undefined)[]): T {
  const open = options.filter(o => !avoid.includes(o));
  return (open.length ? open : options)[Math.floor(random() * (open.length || options.length))];
}

/** The least-used option, never the previous one while another is open. */
export function pickFewest<T>(random:()=>number,used:readonly T[],options:readonly T[],previous:T|undefined):T {
  const uses=(o:T)=>used.filter(u=>u===o).length,fewest=Math.min(...options.filter(o=>o!==previous).map(uses));
  return pick(random,options.filter(o=>uses(o)===fewest),[previous]);
}

/** Each part gets its own stream, so one part's jitter never shifts another's choices. */
export const partSeed = (songSeed: number, tag: string) =>
  [...tag].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0, songSeed ^ 0x811c9dc5) >>> 0;
