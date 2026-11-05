import { advanceSpecies, initialSpecies, type SpeciesPopulations } from './species.ts';
export { speciesDefinitions } from './species.ts';
export type { SpeciesId } from './species.ts';
export type Intervention = 'none' | 'water' | 'predators' | 'food';
export interface Snapshot {
  year: number; rainfall: number; water: number; vegetation: number;
  population: number; predators: number;
  species: SpeciesPopulations;
}
export const interventionLabels: Record<Intervention, string> = {
  none: 'Original history', water: 'Restore freshwater',
  predators: 'Remove Glasswing predators', food: 'Provide emergency food',
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
// Weather is indexed by year and seed, independent of intervention or call order.
function weather(year: number, seed: number) {
  const n = Math.sin((year + 1) * 127.1 + seed * 311.7) * 43758.5453;
  return clamp(Math.max(.035, .88 - Math.max(0, year - 5) * .075) + (n - Math.floor(n) - .5) * .025);
}
/** Simplified fictional case model. Intervention starts after the selected snapshot. */
export function simulate(intervention: Intervention = 'none', startYear = 14, seed = 42): Snapshot[] {
  if (!(intervention in interventionLabels)) throw new Error('Unknown intervention');
  if (!Number.isInteger(startYear) || startYear < 0 || startYear > 29 || !Number.isFinite(seed)) throw new Error('Invalid simulation inputs');
  let water = .88, vegetation = .9, population = 120;
  const snapshots: Snapshot[] = [];
  let fauna = initialSpecies;
  for (let year = 0; year <= 30; year++) {
    const rainfall = weather(year, seed), active = year > startYear;
    const predators = intervention === 'predators' && active ? 0 : .32;
    if (year > 0) {
      water = clamp(water * .55 + rainfall * .45 + (active && intervention === 'water' ? .38 : 0));
      vegetation = clamp(vegetation * .65 + water * .35);
      const supplement = active && intervention === 'food' && year <= startYear + 3 ? .65 : 0;
      const nutrition = clamp(vegetation + supplement);
      const births = population * .24 * nutrition * Math.max(0, 1 - population / 300);
      const deaths = population * (.018 + predators * .035 + Math.max(0, .58 - nutrition) * .78);
      population = population === 0 ? 0 : Math.max(0, population + births - deaths);
      if (population < 4) population = 0;
    }
    if (year > 0) fauna = advanceSpecies(fauna, water, vegetation, Math.round(population));
    snapshots.push(Object.freeze({year, rainfall, water, vegetation, population: Math.round(population), predators, species: fauna}));
  }
  return snapshots;
}
const baseline = simulate();
const first = (predicate: (s: Snapshot) => boolean) => baseline.find(predicate)?.year ?? 30;
const rainYear = first(s => s.rainfall < .5);
const plantYear = first(s => s.vegetation < .45);
const stressYear = first(s => s.vegetation < .3);
const extinctYear = first(s => s.population === 0);
export const evidence = [
  {id:'rainfall', title:'Rainfall records', label:'Weather station', observation:`Sediment bands record rainfall falling below half its usual scale in year ${rainYear}. The decline continues through the later layers.`},
  {id:'pollen', title:'Ancient pollen', label:'Pollen bed', observation:`Edible-plant pollen falls sharply around year ${plantYear}. Earlier layers contain abundant traces of the Glasswing’s food plants.`},
  {id:'fossil', title:'Glasswing fossils', label:'Fossil ridge', observation:`Remains from year ${stressYear} show nutritional stress. Many specimens lack the damage expected from a predator attack.`},
  {id:'tracks', title:'Predator tracks', label:'Forest trail', observation:'Predator tracks appear in both thriving and declining years. Their presence alone does not establish what caused the collapse.'},
  {id:'population', title:'Population timeline', label:'Field archive', observation:`Plant decline appears by year ${plantYear}; Glasswing numbers then fall, reaching extinction in year ${extinctYear}. Compare the order of these changes with the other clues.`},
];

