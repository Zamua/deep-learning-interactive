/** 2-D test surfaces and the chapter 9 update rules, run on a single point. */

export type OptName = 'sgd' | 'momentum' | 'nesterov' | 'adagrad' | 'rmsprop' | 'adam' | 'newton';

export const OPT_NAMES: OptName[] = ['sgd', 'momentum', 'nesterov', 'adagrad', 'rmsprop', 'adam', 'newton'];

export const OPT_LABEL: Record<OptName, string> = {
  sgd: 'SGD',
  momentum: 'Momentum',
  nesterov: 'Nesterov',
  adagrad: 'Adagrad',
  rmsprop: 'RMSprop',
  adam: 'Adam',
  newton: 'Newton',
};

export const OPT_COLOR: Record<OptName, 'red' | 'blue' | 'teal' | 'gold' | 'green' | 'purple' | 'orange'> = {
  sgd: 'red',
  momentum: 'blue',
  nesterov: 'teal',
  adagrad: 'gold',
  rmsprop: 'green',
  adam: 'purple',
  newton: 'orange',
};

export interface Surface {
  id: string;
  label: string;
  f(x: number, y: number): number;
  g(x: number, y: number): [number, number];
  /** Hessian [fxx, fxy, fyy]. */
  H(x: number, y: number): [number, number, number];
  start: [number, number];
  domain: [number, number, number, number];
  minima: [number, number][];
  fmin: number;
  /** Base learning rate per optimizer, tuned so each one shows its character here. */
  lr: Record<OptName, number>;
}

export const SURFACES: Surface[] = [
  {
    id: 'valley',
    label: 'long valley',
    f: (x, y) => 0.05 * x * x + 2 * y * y,
    g: (x, y) => [0.1 * x, 4 * y],
    H: () => [0.1, 0, 4],
    start: [-4.4, 1.3],
    domain: [-5, 5, -2.4, 2.4],
    minima: [[0, 0]],
    fmin: 0,
    lr: { sgd: 0.42, momentum: 0.045, nesterov: 0.045, adagrad: 0.9, rmsprop: 0.05, adam: 0.12, newton: 1 },
  },
  {
    id: 'saddle',
    label: 'saddle',
    f: (x, y) => 0.5 * x * x - 0.5 * y * y + (y * y * y * y) / 16,
    g: (x, y) => [x, -y + (y * y * y) / 4],
    H: (_x, y) => [1, 0, -1 + (3 * y * y) / 4],
    start: [-2.7, 1e-6],
    domain: [-3.2, 3.2, -3, 3],
    minima: [[0, 2], [0, -2]],
    fmin: -1,
    lr: { sgd: 0.08, momentum: 0.012, nesterov: 0.012, adagrad: 0.35, rmsprop: 0.035, adam: 0.08, newton: 1 },
  },
  {
    id: 'banana',
    label: 'banana (Rosenbrock)',
    f: (x, y) => (1 - x) ** 2 + 20 * (y - x * x) ** 2,
    g: (x, y) => [-2 * (1 - x) - 80 * x * (y - x * x), 40 * (y - x * x)],
    H: (x, y) => [2 - 80 * (y - x * x) + 160 * x * x, -80 * x, 40],
    start: [-1.5, 2.4],
    domain: [-2.1, 2.1, -1.0, 3.2],
    minima: [[1, 1]],
    fmin: 0,
    lr: { sgd: 0.0035, momentum: 0.0018, nesterov: 0.0018, adagrad: 0.25, rmsprop: 0.012, adam: 0.06, newton: 1 },
  },
];

const MU = 0.9, DECAY = 0.99, B1 = 0.9, B2 = 0.999, EPS = 1e-8;

/** One optimizer walking on one surface, keeping its own state and trail. */
export class Walker {
  w: [number, number];
  v: [number, number] = [0, 0];
  cache: [number, number] = [0, 0];
  m: [number, number] = [0, 0];
  t = 0;
  xs: number[] = [];
  ys: number[] = [];
  dead = false;

  constructor(readonly name: OptName, start: [number, number]) {
    this.w = [start[0], start[1]];
    this.xs.push(start[0]);
    this.ys.push(start[1]);
  }

  step(s: Surface, lr: number): void {
    if (this.dead) return;
    const [x, y] = this.w;
    const g = s.g(x, y);
    this.t++;
    for (let i = 0; i < 2; i++) {
      const gi = g[i]!;
      switch (this.name) {
        case 'sgd':
          this.w[i]! -= lr * gi;
          break;
        case 'momentum':
          this.v[i] = MU * this.v[i]! - lr * gi;
          this.w[i]! += this.v[i]!;
          break;
        case 'nesterov': {
          const prev = this.v[i]!;
          this.v[i] = MU * this.v[i]! - lr * gi;
          this.w[i]! += -MU * prev + (1 + MU) * this.v[i]!;
          break;
        }
        case 'adagrad':
          this.cache[i]! += gi * gi;
          this.w[i]! -= (lr * gi) / (Math.sqrt(this.cache[i]!) + EPS);
          break;
        case 'rmsprop':
          this.cache[i] = DECAY * this.cache[i]! + (1 - DECAY) * gi * gi;
          this.w[i]! -= (lr * gi) / (Math.sqrt(this.cache[i]!) + EPS);
          break;
        case 'adam': {
          this.m[i] = B1 * this.m[i]! + (1 - B1) * gi;
          this.cache[i] = B2 * this.cache[i]! + (1 - B2) * gi * gi;
          const mt = this.m[i]! / (1 - B1 ** this.t);
          const vt = this.cache[i]! / (1 - B2 ** this.t);
          this.w[i]! -= (lr * mt) / (Math.sqrt(vt) + EPS);
          break;
        }
        case 'newton':
          break;
      }
    }
    if (this.name === 'newton') {
      const [a, b, c] = s.H(x, y);
      const det = a * c - b * b;
      if (Math.abs(det) > 1e-12) {
        this.w[0] -= (c * g[0] - b * g[1]) / det;
        this.w[1] -= (-b * g[0] + a * g[1]) / det;
      }
    }
    if (!Number.isFinite(this.w[0]) || !Number.isFinite(this.w[1]) || Math.hypot(this.w[0], this.w[1]) > 60) {
      this.dead = true;
      return;
    }
    this.xs.push(this.w[0]);
    this.ys.push(this.w[1]);
  }
}
