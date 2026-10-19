import { Rng } from '../core/rand';

/** A loss surface of Chinchilla's form, L(N, D) = E + A / N^alpha + B / D^beta. */
export interface Surface {
  E: number;
  A: number;
  B: number;
  alpha: number;
  beta: number;
}

/** Round illustrative constants of Chinchilla's form, chosen so the optimum sits near 20 tokens per parameter. */
export const SURF: Surface = { E: 1.7, A: 400, B: 980, alpha: 0.3, beta: 0.3 };

/** Chinchilla's published parametric fit (Hoffmann et al., 2022), rounded as printed. */
export const CHIN_FIT: Surface = { E: 1.69, A: 406.4, B: 410.7, alpha: 0.34, beta: 0.28 };

export const lossND = (s: Surface, N: number, D: number): number => s.E + s.A / N ** s.alpha + s.B / D ** s.beta;

/** The compute-optimal split of a budget of C FLOPs under C = 6ND. */
export function optimum(s: Surface, C: number): { N: number; D: number; L: number } {
  const K = C / 6;
  const G = ((s.alpha * s.A) / (s.beta * s.B)) ** (1 / (s.alpha + s.beta));
  const N = G * K ** (s.beta / (s.alpha + s.beta));
  const D = K / N;
  return { N, D, L: lossND(s, N, D) };
}

/** Training tokens a model of size N needs to reach `target`; Infinity when N alone cannot get there. */
export function tokensFor(s: Surface, N: number, target: number): number {
  const gap = target - s.E - s.A / N ** s.alpha;
  return gap > 0 ? (s.B / gap) ** (1 / s.beta) : Infinity;
}

/** Kaplan et al. (2020), approximate fitted constants (non-embedding parameters, tokens). */
export const KAPLAN = { Nc: 8.8e13, Dc: 5.4e13, aN: 0.076, aD: 0.095 };
export const kaplanN = (N: number): number => (KAPLAN.Nc / N) ** KAPLAN.aN;
export const kaplanND = (N: number, D: number): number => ((KAPLAN.Nc / N) ** (KAPLAN.aN / KAPLAN.aD) + KAPLAN.Dc / D) ** KAPLAN.aD;

export interface Model {
  name: string;
  year: number;
  N: number;
  D: number;
}

/** Parameter and token counts as reported by each model's paper or announcement. */
export const MODELS: Model[] = [
  { name: 'GPT-3', year: 2020, N: 175e9, D: 300e9 },
  { name: 'Gopher', year: 2021, N: 280e9, D: 300e9 },
  { name: 'MT-NLG', year: 2022, N: 530e9, D: 270e9 },
  { name: 'Chinchilla', year: 2022, N: 70e9, D: 1.4e12 },
  { name: 'LLaMA 7B', year: 2023, N: 7e9, D: 1e12 },
  { name: 'Llama 2 70B', year: 2023, N: 70e9, D: 2e12 },
  { name: 'Llama 3 8B', year: 2024, N: 8e9, D: 15e12 },
  { name: 'Llama 3.1 405B', year: 2024, N: 405e9, D: 15.6e12 },
];

/** The law behind the synthetic runs of the fitting figure: L = E + a N^-k. */
export const TRUE_RUNS = { E: 1.9, a: 40, k: 0.22 };

/** Ten synthetic "small runs" from 1M to 1B parameters, with 1% multiplicative noise. */
export function syntheticRuns(seed: number): { N: number[]; L: number[] } {
  const r = new Rng(seed);
  const N: number[] = [];
  const L: number[] = [];
  for (let i = 0; i < 10; i++) {
    const n = 10 ** (6 + (3 * i) / 9);
    N.push(n);
    L.push((TRUE_RUNS.E + TRUE_RUNS.a * n ** -TRUE_RUNS.k) * (1 + 0.01 * r.randn()));
  }
  return { N, L };
}

/** Least-squares line v = c + m u. */
export function polyfit1(u: number[], v: number[]): { m: number; c: number } {
  const n = u.length;
  const mu = u.reduce((a, b) => a + b, 0) / n;
  const mv = v.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (u[i]! - mu) * (v[i]! - mv);
    sxx += (u[i]! - mu) ** 2;
  }
  const m = sxx > 0 ? sxy / sxx : 0;
  return { m, c: mv - m * mu };
}

export interface PowerFit {
  E: number;
  m: number;
  c: number;
  at(N: number): number;
}

/** Fits L = E + 10^c N^m in log space; with `floor`, also grid-searches E for the lowest log error. */
export function fitPower(N: number[], L: number[], floor: boolean): PowerFit {
  const lmin = Math.min(...L);
  const Es = floor ? Array.from({ length: 300 }, (_, i) => (i * (lmin - 0.01)) / 299) : [0];
  let best = { err: Infinity, E: 0, m: 0, c: 0 };
  const u = N.map(Math.log10);
  for (const E of Es) {
    const { m, c } = polyfit1(u, L.map((l) => Math.log10(l - E)));
    let err = 0;
    for (let i = 0; i < N.length; i++) err += (Math.log10(L[i]!) - Math.log10(E + 10 ** c * N[i]! ** m)) ** 2;
    if (err < best.err) best = { err, E, m, c };
  }
  const { E, m, c } = best;
  return { E, m, c, at: (n) => E + 10 ** c * n ** m };
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export const sup = (n: number): string => String(n).split('').map((ch) => SUP[ch] ?? ch).join('');

/** "10²³" for a power of ten, "5.9 × 10²³" otherwise; `caret` writes "10^23" for canvas rich text. */
export function sci(v: number, digits = 2, caret = false): string {
  if (!(v > 0) || !Number.isFinite(v)) return '–';
  let e = Math.floor(Math.log10(v));
  let m = v / 10 ** e;
  if (Number(m.toPrecision(digits)) >= 10) {
    m /= 10;
    e += 1;
  }
  const ms = String(Number(m.toPrecision(digits)));
  const p = caret ? `10^${e}` : `10${sup(e)}`;
  return ms === '1' ? p : `${ms} × ${p}`;
}

/** Python-style scientific literal, e.g. 5.8e23. */
export function pySci(v: number, digits = 2): string {
  if (!(v > 0) || !Number.isFinite(v)) return 'inf';
  const e = Math.floor(Math.log10(v));
  let m = Number((v / 10 ** e).toPrecision(digits));
  let ee = e;
  if (m >= 10) {
    m /= 10;
    ee += 1;
  }
  return `${m}e${ee}`;
}

/** Counts with K, M, B, T suffixes: 70B, 1.4T, 300M. */
export function count(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '∞';
  if (v >= 1e15) return pySci(v, 2);
  const units: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [k, s] of units) {
    if (Math.abs(v) >= k * 0.9995) {
      const x = v / k;
      if (x >= 1000 && s === 'T') return `${Number((x / 1000).toPrecision(digits))}Q`;
      return `${Number(x.toPrecision(Math.max(digits, Math.floor(Math.log10(x)) + 1)))}${s}`;
    }
  }
  return String(Number(v.toPrecision(digits)));
}

/** Log-spaced values from 10^a to 10^b inclusive. */
export function logspace(a: number, b: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => 10 ** (a + ((b - a) * i) / (n - 1)));
}
