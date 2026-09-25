import type { FormName, Role, Section } from './types';

type Part = [role: Role, bars: number, name: string];
const part = (role: Role, bars: number, name: string): Part => [role, bars, name];

/** Every section is a multiple of eight bars, so loops, phrases and themes always line up. */
export const FORMS: Record<FormName, Part[]> = {
  'beat-tape': [part('intro', 8, 'Opening'), part('head', 16, 'First light'), part('contrast', 8, 'Wandering'),
    part('breath', 8, 'Room to breathe'), part('return', 16, 'Home again'), part('tag', 8, 'Last page')],
  hook: [part('intro', 8, 'Opening'), part('head', 16, 'The hook'), part('contrast', 8, 'Side street'),
    part('return', 16, 'The hook again'), part('tag', 8, 'Last page')],
  long: [part('intro', 8, 'Opening'), part('head', 16, 'First light'), part('contrast', 8, 'Wandering'),
    part('return', 16, 'Home again'), part('breath', 8, 'Room to breathe'), part('return', 8, 'One more time'), part('tag', 8, 'Last page')],
  nocturne: [part('intro', 8, 'Lamps on'), part('head', 16, 'Nocturne'), part('breath', 8, 'Quiet'),
    part('return', 8, 'Nocturne again'), part('tag', 8, 'Goodnight')],
};

export const formBars = (form: FormName) => FORMS[form].reduce((sum, [, bars]) => sum + bars, 0);

/** Lay out a form's sections; `stretch` replaces the long form's breath when the planner allows it. */
export function sectionsFor(form: FormName, stretch = false): Section[] {
  let startBar = 0;
  return FORMS[form].map(([role, bars, name]) => {
    const section: Section = stretch && form === 'long' && role === 'breath'
      ? { name: 'Stretch out', role: 'stretch', startBar, endBar: startBar + bars }
      : { name, role, startBar, endBar: startBar + bars };
    startBar += bars;
    return section;
  });
}

/** Level of every part in each role; the tag fades linearly across its eight bars. */
export function roleDynamics(role: Role, barInSection: number): number {
  switch (role) {
    case 'intro': return 0.76;
    case 'contrast': return 0.92;
    case 'breath': return 0.72;
    case 'stretch': return 0.88;
    case 'tag': return 0.8 - barInSection / 7 * 0.2;
    default: return 1;
  }
}

/** A small lift and settle across each 8-bar phrase keeps loops breathing without changing the level. */
export const PHRASE_CONTOUR = [1, 0.96, 1, 0.94, 1, 0.97, 1.02, 0.93];
