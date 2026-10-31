// Generator helpers shared by the convnets concepts.
import type { Rng } from '../../core/rand';
import { int, num, round } from '../kit';

/** (W - F + 2P) / S + 1, possibly fractional. */
export const outSize = (W: number, F: number, S: number, P: number): number => (W - F + 2 * P) / S + 1;
