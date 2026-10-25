// Generator helpers for the modern-architecture concepts of the scale domain: AdamW, MoE,
// RMSNorm, gated MLPs and grouped-query attention.
import { num } from '../kit';

export { clean, minus, paren, tenth } from '../optimization/kit';
export { straps, traps, vtraps } from '../networks/kit';
export { commas, whys } from '../training/kit';

/** TeX for the symbols these concepts add, through the generic `\sym{key}{tex}` macro. */
export const E = '\\sym{E}{E}';
export const K = '\\sym{topk}{k}';
export const D = '\\sym{d}{d}';
export const MH = '\\sym{m}{\\hat m}';
export const VH = '\\sym{v}{\\hat v}';

/** A whole number for TeX with `{,}` thousands separators: `8{,}192`. */
export const big = (n: number): string => num(n).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');

/** Experts named in prose: "experts 1 and 3", "experts 0, 2 and 5". */
export function experts(ids: readonly number[]): string {
  const xs = [...ids].sort((a, b) => a - b).map(String);
  return xs.length === 1 ? `expert ${xs[0]}` : `experts ${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
