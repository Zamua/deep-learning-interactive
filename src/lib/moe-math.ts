/** Parameter accounting and counting helpers shared by the MoE chapter and lecture. */

export interface BaseShape {
  name: string;
  /** Model width. */
  d: number;
  /** Hidden width of one SwiGLU expert (three d x d_ff matrices). */
  dff: number;
  /** Total width of the key (or value) heads under grouped-query attention. */
  dkv: number;
  layers: number;
  vocab: number;
}

/** Mistral 7B, the dense model whose shape Mixtral 8x7B copies (published configs). */
export const SHAPE_7B: BaseShape = { name: '7B shape', d: 4096, dff: 14336, dkv: 1024, layers: 32, vocab: 32000 };
/** The shape of Mixtral 8x22B. */
export const SHAPE_22B: BaseShape = { name: '22B shape', d: 6144, dff: 16384, dkv: 1024, layers: 56, vocab: 32768 };

export interface MoeCount {
  embed: number;
  attn: number;
  router: number;
  expert: number;
  total: number;
  active: number;
  /** Totals split by part, for stacked bars. */
  parts: { embed: number; attn: number; router: number; experts: number };
  activeParts: { embed: number; attn: number; router: number; experts: number };
}

/** Counts a decoder whose every layer has attention plus E SwiGLU experts, k used per token. Norms are ignored (well under 0.01%). */
export function moeParams(s: BaseShape, E: number, k: number): MoeCount {
  const { d, dff, dkv, layers: L, vocab: V } = s;
  const embed = 2 * V * d;
  const attn = 2 * d * d + 2 * d * dkv;
  const router = E > 1 ? d * E : 0;
  const expert = 3 * d * dff;
  const parts = { embed, attn: L * attn, router: L * router, experts: L * E * expert };
  const activeParts = { embed, attn: L * attn, router: L * router, experts: L * k * expert };
  const sum = (o: typeof parts) => o.embed + o.attn + o.router + o.experts;
  return { embed, attn, router, expert, total: sum(parts), active: sum(activeParts), parts, activeParts };
}

/** Expected number of distinct experts a batch of B tokens uses in one layer, if each token picks k of E uniformly. */
export function touched(E: number, k: number, B: number): number {
  return E * (1 - Math.pow(1 - k / E, B));
}

/** Binomial coefficient, exact. */
export function comb(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(n - k + i)) / BigInt(i);
  return r;
}

/** 46_702_000_000 -> "46.7B", 12_900_000 -> "12.9M". */
export function human(n: number, digits = 3): string {
  const a = Math.abs(n);
  const f = (v: number, u: string) => `${Number(v.toPrecision(digits))}${u}`;
  if (a >= 1e12) return f(n / 1e12, 'T');
  if (a >= 1e9) return f(n / 1e9, 'B');
  if (a >= 1e6) return f(n / 1e6, 'M');
  if (a >= 1e3) return f(n / 1e3, 'K');
  return String(Math.round(n));
}

/** 4426165368n -> "4,426,165,368". */
export function commas(n: bigint | number): string {
  return n.toLocaleString('en-US');
}
