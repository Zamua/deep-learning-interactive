/** Seeded PRNG (mulberry32) so every figure starts from the same picture on every load. */
export class Rng {
  private s: number;
  constructor(seed = 1) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uniform(a = 0, b = 1): number {
    return a + (b - a) * this.next();
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  /** Standard normal via Box-Muller. */
  randn(): number {
    let u = 0;
    while (u === 0) u = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }
  shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }
}

/** An integer in [lo, hi]. */
export const int = (rng: Rng, lo: number, hi: number): number => lo + rng.int(hi - lo + 1);

/** One of the items. */
export const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[rng.int(xs.length)]!;
