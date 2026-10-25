// Generator helpers shared by the language-model concepts.
export { argmax, clean, E2, lit, lits, LN2, mat, ORD, prodTex, shapeTex, sumTex, traps, vtraps } from '../sequences/kit';
export { big } from '../optimization/kit';
export { matrix } from '../linear-algebra/kit';

/** Once, twice, 3 times. */
export const times = (n: number): string => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/** A whole number with thousands commas, for prose outside TeX: `50,257`. */
export const commas = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
