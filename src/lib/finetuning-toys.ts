import { Rng } from '../core/rand';

/** The LoRA toy: a frozen 16 by 16 W0 and a task that needs a rank-2 change, trained with Adam. */
export const LD = 16;
export const LN = 96;
export const LSTEPS = 300;
export const LALPHA = 8;

/** The toy task: a frozen W0 and a new task whose answer is W0 plus a rank-2 change. */
export const TASK = (() => {
  const g = new Rng(5);
  const W0 = Float64Array.from({ length: LD * LD }, () => g.randn() / Math.sqrt(LD));
  const unit = () => {
    const v = Array.from({ length: LD }, () => g.randn());
    const s = Math.hypot(...v);
    return v.map((x) => x / s);
  };
  const u1 = unit(), u2 = unit(), v1 = unit(), v2 = unit();
  const target = new Float64Array(LD * LD);
  for (let i = 0; i < LD; i++) for (let j = 0; j < LD; j++) target[i * LD + j] = 2.4 * u1[i]! * v1[j]! + 1.2 * u2[i]! * v2[j]!;
  const X = Float64Array.from({ length: LN * LD }, () => g.randn());
  return { W0, target, X };
})();

export type Init = 'lora' | 'rand' | 'zero';

export class LoraRun {
  A: Float64Array;
  B: Float64Array;
  dW = new Float64Array(LD * LD);
  losses: number[] = [];
  t = 0;
  private mA: Float64Array;
  private vA: Float64Array;
  private mB: Float64Array;
  private vB: Float64Array;

  constructor(readonly r: number, init: Init) {
    const g = new Rng(11);
    this.A = Float64Array.from({ length: r * LD }, () => (init === 'zero' ? 0 : g.randn() / Math.sqrt(LD)));
    this.B = Float64Array.from({ length: LD * r }, () => (init === 'rand' ? g.randn() / Math.sqrt(r) : 0));
    this.mA = new Float64Array(this.A.length);
    this.vA = new Float64Array(this.A.length);
    this.mB = new Float64Array(this.B.length);
    this.vB = new Float64Array(this.B.length);
    this.forward();
  }

  get s(): number {
    return LALPHA / this.r;
  }

  /** dW = (alpha / r) B A, and the loss of W0 + dW on the new task. */
  forward(): Float64Array {
    const { r, A, B, dW } = this;
    for (let i = 0; i < LD; i++)
      for (let j = 0; j < LD; j++) {
        let a = 0;
        for (let q = 0; q < r; q++) a += B[i * r + q]! * A[q * LD + j]!;
        dW[i * LD + j] = this.s * a;
      }
    const { X, target } = TASK;
    const G = new Float64Array(LD * LD);
    let L = 0;
    for (let n = 0; n < LN; n++)
      for (let i = 0; i < LD; i++) {
        // W0 cancels: err = x (W0 + dW)^T - x (W0 + target)^T
        let e = 0;
        for (let j = 0; j < LD; j++) e += (dW[i * LD + j]! - target[i * LD + j]!) * X[n * LD + j]!;
        L += e * e;
        for (let j = 0; j < LD; j++) G[i * LD + j]! += (2 * e * X[n * LD + j]!) / (LN * LD);
      }
    this.losses[this.t] = L / (LN * LD);
    return G;
  }

  step(lr = 0.01): void {
    const G = this.forward();
    const { r, A, B } = this;
    const dB = new Float64Array(B.length), dA = new Float64Array(A.length);
    for (let i = 0; i < LD; i++)
      for (let q = 0; q < r; q++) {
        let a = 0;
        for (let j = 0; j < LD; j++) a += G[i * LD + j]! * A[q * LD + j]!;
        dB[i * r + q] = this.s * a;
      }
    for (let q = 0; q < r; q++)
      for (let j = 0; j < LD; j++) {
        let a = 0;
        for (let i = 0; i < LD; i++) a += B[i * r + q]! * G[i * LD + j]!;
        dA[q * LD + j] = this.s * a;
      }
    this.t++;
    const t = this.t;
    const adam = (P: Float64Array, g: Float64Array, m: Float64Array, v: Float64Array) => {
      for (let i = 0; i < P.length; i++) {
        m[i] = 0.9 * m[i]! + 0.1 * g[i]!;
        v[i] = 0.999 * v[i]! + 0.001 * g[i]! ** 2;
        P[i]! -= (lr * (m[i]! / (1 - 0.9 ** t))) / (Math.sqrt(v[i]! / (1 - 0.999 ** t)) + 1e-8);
      }
    };
    adam(B, dB, this.mB, this.vB);
    adam(A, dA, this.mA, this.vA);
    this.forward();
  }
}


/** 8,192 weights from a standard normal, and the same with six outliers. */
export const QW = (() => {
  const g = new Rng(3);
  return Float64Array.from({ length: 8192 }, () => g.randn());
})();
export const OUTLIERS = (() => {
  const w = QW.slice();
  const g = new Rng(8);
  for (let k = 0; k < 6; k++) w[g.int(w.length)] = (g.next() < 0.5 ? -1 : 1) * (7 + 3 * g.next());
  return w;
})();


/** The distillation toy: a made-up teacher distribution and a tabular softmax student. */
export const NEXT = ['Canberra', 'Sydney', 'a', 'located', 'the', 'Melbourne', 'home', 'one'];
export const TEACH = [0.55, 0.18, 0.08, 0.06, 0.05, 0.04, 0.02, 0.02];
export const DSTEPS = 300;

export class Student {
  z = new Float64Array(NEXT.length);
  kl: number[] = [];
  probs(): number[] {
    const m = Math.max(...this.z);
    const e = Array.from(this.z, (v) => Math.exp(v - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  }
  measure(): void {
    const q = this.probs();
    this.kl.push(TEACH.reduce((a, pt, i) => a + pt * Math.log(pt / q[i]!), 0));
  }
  step(target: number[], lr: number): void {
    const q = this.probs();
    for (let i = 0; i < q.length; i++) this.z[i]! -= lr * (q[i]! - target[i]!);
    this.measure();
  }
}

