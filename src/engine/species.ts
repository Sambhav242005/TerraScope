/** Stable population identities used by ecology, the habitat renderer and accessible summaries. */
export type SpeciesId = 'deer' | 'rabbit' | 'fox' | 'squirrel' | 'songbird' | 'owl' | 'fish' | 'frog' | 'turtle' | 'glasswing';
export type Habitat = 'woodland' | 'meadow' | 'air' | 'river' | 'wetland';
export interface SpeciesDefinition { readonly id: SpeciesId; readonly name: string; readonly habitat: Habitat; }
export const speciesDefinitions: readonly SpeciesDefinition[] = Object.freeze([
  { id: 'deer', name: 'Valley deer', habitat: 'woodland' },
  { id: 'rabbit', name: 'Meadow rabbit', habitat: 'meadow' },
  { id: 'fox', name: 'Red fox', habitat: 'woodland' },
  { id: 'squirrel', name: 'Tree squirrel', habitat: 'woodland' },
  { id: 'songbird', name: 'Woodland songbird', habitat: 'air' },
  { id: 'owl', name: 'Forest owl', habitat: 'woodland' },
  { id: 'fish', name: 'Stream fish', habitat: 'river' },
  { id: 'frog', name: 'Wetland frog', habitat: 'wetland' },
  { id: 'turtle', name: 'River turtle', habitat: 'wetland' },
  { id: 'glasswing', name: 'Glasswing', habitat: 'meadow' },
].map(definition => Object.freeze(definition)) as SpeciesDefinition[]);
export const species = speciesDefinitions;
export interface SpeciesPopulation { readonly species: SpeciesId; readonly count: number; }
export type SpeciesPopulations = Readonly<Record<SpeciesId, number>>;
const initial = { deer: 18, rabbit: 50, fox: 6, squirrel: 24, songbird: 60, owl: 4, fish: 90, frog: 45, turtle: 12, glasswing: 120 };
export const initialSpecies: SpeciesPopulations = Object.freeze(initial);
/**
 * Resource-responsive population proxies for the surrounding fauna. These do not feed back
 * into the calibrated Glasswing case. They are simplified counts, not a validated food web.
 */
export function advanceSpecies(previous: SpeciesPopulations, water: number, vegetation: number, glasswing: number): SpeciesPopulations {
  const targets: Record<SpeciesId, number> = {
    deer: 25 * (.12 + vegetation * .65 + water * .23),
    rabbit: 75 * (.1 + vegetation * .8 + water * .1),
    fox: 8 * Math.min(1, .12 + previous.rabbit / 75 * .65 + previous.songbird / 95 * .23),
    squirrel: 38 * (.18 + vegetation * .72 + water * .1),
    songbird: 95 * (.12 + vegetation * .65 + water * .23),
    owl: 6 * Math.min(1, .1 + previous.rabbit / 75 * .55 + previous.frog / 75 * .35),
    fish: 140 * water * (.3 + vegetation * .7),
    frog: 75 * water * (.2 + vegetation * .8),
    turtle: 18 * (.12 + water * .68 + vegetation * .2),
    glasswing,
  };
  const rates: Record<SpeciesId,number> = {deer:.13,rabbit:.28,fox:.12,squirrel:.16,songbird:.23,owl:.1,fish:.3,frog:.32,turtle:.09,glasswing:0};
  const next = { ...initial };
  for (const { id } of speciesDefinitions) {
    next[id] = id === 'glasswing' ? glasswing : Math.max(0, Math.round(previous[id] + (targets[id] - previous[id]) * rates[id]));
  }
  return Object.freeze(next);
}
