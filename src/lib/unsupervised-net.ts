/** Activation applied after one dense layer. */
export type Act = 'relu' | 'leaky' | 'tanh' | 'sigmoid' | 'linear';

function fwdAct(a: Act, z: number): number {
  switch (a) {
    case 'relu':
      return z > 0 ? z : 0;
    case 'leaky':
      return z > 0 ? z : 0.2 * z;
    case 'tanh':
      return Math.tanh(z);
    case 'sigmoid':
      return 1 / (1 + Math.exp(-z));
    default:
      return z;
  }
}

/** Derivative of the activation, given its pre-activation z and output y. */
function dAct(a: Act, z: number, y: number): number {
  switch (a) {
    case 'relu':
      return z > 0 ? 1 : 0;
    case 'leaky':
      return z > 0 ? 1 : 0.2;
    case 'tanh':
      return 1 - y * y;
    case 'sigmoid':
      return y * (1 - y);
    default:
      return 1;
  }
}

/**
 * A small dense network with an arbitrary loss: `forward` a batch, then `backward` the loss
 * gradient with respect to the outputs. `backward` returns the gradient with respect to the
 * inputs, so two nets can be chained (a GAN's generator learns through its discriminator).
 */
export class TinyNet {
  readonly sizes: number[];
  readonly acts: Act[];
  W: Float64Array[] = [];
  b: Float64Array[] = [];
  dW: Float64Array[] = [];
  db: Float64Array[] = [];
  private mW: Float64Array[] = [];
  private vW: Float64Array[] = [];
  private mb: Float64Array[] = [];
  private vb: Float64Array[] = [];
  private t = 0;
  private ins: Float64Array[] = [];
  private zs: Float64Array[] = [];
  private outs: Float64Array[] = [];
  private n = 0;

  /** `acts[l]` follows layer l; weights start as randn() * gain / sqrt(fan-in). */
  constructor(sizes: number[], acts: Act[], randn: () => number, gain = 1) {
    this.sizes = sizes;
    this.acts = acts;
    this.init(randn, gain);
  }

  init(randn: () => number, gain = 1): void {
    this.W = [];
    this.b = [];
    this.t = 0;
    for (let l = 0; l + 1 < this.sizes.length; l++) {
      const nin = this.sizes[l]!;
      const nout = this.sizes[l + 1]!;
      const std = gain / Math.sqrt(nin);
      this.W.push(new Float64Array(nin * nout).map(() => randn() * std));
      this.b.push(new Float64Array(nout));
    }
    const like = (a: Float64Array[]) => a.map((x) => new Float64Array(x.length));
    this.dW = like(this.W);
    this.db = like(this.b);
    this.mW = like(this.W);
    this.vW = like(this.W);
    this.mb = like(this.b);
    this.vb = like(this.b);
  }

  /** X is n x d row-major. Returns n x out row-major and keeps what backward needs. */
  forward(X: Float64Array, n: number): Float64Array {
    this.n = n;
    this.ins = [];
    this.zs = [];
    this.outs = [];
    let a = X;
    for (let l = 0; l < this.W.length; l++) {
      const nin = this.sizes[l]!;
      const nout = this.sizes[l + 1]!;
      const W = this.W[l]!;
      const bb = this.b[l]!;
      const act = this.acts[l]!;
      const z = new Float64Array(n * nout);
      const y = new Float64Array(n * nout);
      for (let r = 0; r < n; r++) {
        const ro = r * nin;
        for (let o = 0; o < nout; o++) {
          let s = bb[o]!;
          const wo = o * nin;
          for (let i = 0; i < nin; i++) s += W[wo + i]! * a[ro + i]!;
          z[r * nout + o] = s;
          y[r * nout + o] = fwdAct(act, s);
        }
      }
      this.ins.push(a);
      this.zs.push(z);
      this.outs.push(y);
      a = y;
    }
    return a;
  }

  /** Adds dLoss/dparams into dW/db and returns dLoss/dX (n x d). */
  backward(dOut: Float64Array): Float64Array {
    const n = this.n;
    let d = dOut;
    for (let l = this.W.length - 1; l >= 0; l--) {
      const nin = this.sizes[l]!;
      const nout = this.sizes[l + 1]!;
      const W = this.W[l]!;
      const dW = this.dW[l]!;
      const db = this.db[l]!;
      const z = this.zs[l]!;
      const y = this.outs[l]!;
      const a = this.ins[l]!;
      const act = this.acts[l]!;
      const dz = new Float64Array(n * nout);
      for (let k = 0; k < dz.length; k++) dz[k] = d[k]! * dAct(act, z[k]!, y[k]!);
      const dIn = new Float64Array(n * nin);
      for (let r = 0; r < n; r++) {
        const ro = r * nin;
        for (let o = 0; o < nout; o++) {
          const g = dz[r * nout + o]!;
          if (g === 0) continue;
          db[o]! += g;
          const wo = o * nin;
          for (let i = 0; i < nin; i++) {
            dW[wo + i]! += g * a[ro + i]!;
            dIn[ro + i]! += g * W[wo + i]!;
          }
        }
      }
      d = dIn;
    }
    return d;
  }

  zeroGrad(): void {
    for (const g of this.dW) g.fill(0);
    for (const g of this.db) g.fill(0);
  }

  /** One Adam update from the accumulated gradients, then clears them. */
  adam(lr: number, beta1 = 0.9, beta2 = 0.999): void {
    this.t++;
    const c1 = 1 - Math.pow(beta1, this.t);
    const c2 = 1 - Math.pow(beta2, this.t);
    const upd = (p: Float64Array, g: Float64Array, m: Float64Array, v: Float64Array) => {
      for (let i = 0; i < p.length; i++) {
        const gi = g[i]!;
        m[i] = beta1 * m[i]! + (1 - beta1) * gi;
        v[i] = beta2 * v[i]! + (1 - beta2) * gi * gi;
        p[i]! -= (lr * (m[i]! / c1)) / (Math.sqrt(v[i]! / c2) + 1e-8);
      }
    };
    for (let l = 0; l < this.W.length; l++) {
      upd(this.W[l]!, this.dW[l]!, this.mW[l]!, this.vW[l]!);
      upd(this.b[l]!, this.db[l]!, this.mb[l]!, this.vb[l]!);
    }
    this.zeroGrad();
  }

  /** Forward without touching the backward caches (for drawing). */
  run(X: Float64Array, n: number): Float64Array {
    const { ins, zs, outs } = this;
    const keepN = this.n;
    const out = this.forward(X, n);
    this.ins = ins;
    this.zs = zs;
    this.outs = outs;
    this.n = keepN;
    return out;
  }
}
