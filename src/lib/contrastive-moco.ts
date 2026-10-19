import { Rng } from '../core/rand';

/** MoCo figure and lecture: steps shown, keys per batch, queue length. */
export const MOCO_T = 120;
export const MOCO_N = 4;
export const MOCO_Q = 16;
/** A stand-in for one weight of f_q under SGD: a slow drift plus step-to-step noise. */
export const THETA_Q: number[] = (() => {
  const r = new Rng(17);
  const out = [0];
  for (let t = 1; t < MOCO_T; t++) out.push(out[t - 1]! + 0.03 * Math.cos(t / 14) + 0.11 * r.randn());
  return out;
})();

export function emaPath(m: number): number[] {
  const out = [THETA_Q[0]!];
  for (let t = 1; t < MOCO_T; t++) out.push(m * out[t - 1]! + (1 - m) * THETA_Q[t]!);
  return out;
}
