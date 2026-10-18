import { Rng } from '../core/rand';

/**
 * A line-for-line port of min-char-rnn (vanilla RNN, softmax over characters, truncated BPTT,
 * element-wise gradient clipping to [-5, 5], Adagrad). Matrices are row-major Float64Arrays.
 */
export class CharRNN {
  readonly V: number;
  readonly H: number;
  Wxh: Float64Array; // H x V
  Whh: Float64Array; // H x H
  Why: Float64Array; // V x H
  bh: Float64Array;
  by: Float64Array;
  dWxh: Float64Array;
  dWhh: Float64Array;
  dWhy: Float64Array;
  dbh: Float64Array;
  dby: Float64Array;
  private mem: Float64Array[];
  /** Probability given to each target during the last lossFun forward pass. */
  lastPt: number[] = [];
  private hs: Float64Array[] = [];
  private ps: Float64Array[] = [];

  constructor(V: number, H: number, seed = 1) {
    this.V = V;
    this.H = H;
    this.Wxh = new Float64Array(H * V);
    this.Whh = new Float64Array(H * H);
    this.Why = new Float64Array(V * H);
    this.bh = new Float64Array(H);
    this.by = new Float64Array(V);
    this.dWxh = new Float64Array(H * V);
    this.dWhh = new Float64Array(H * H);
    this.dWhy = new Float64Array(V * H);
    this.dbh = new Float64Array(H);
    this.dby = new Float64Array(V);
    this.mem = [this.Wxh, this.Whh, this.Why, this.bh, this.by].map((a) => new Float64Array(a.length));
    this.reset(seed);
  }

  /** Weights ~ 0.01 * randn, biases 0, Adagrad memory cleared. */
  reset(seed: number): void {
    const r = new Rng(seed);
    for (const a of [this.Wxh, this.Whh, this.Why]) for (let i = 0; i < a.length; i++) a[i] = 0.01 * r.randn();
    this.bh.fill(0);
    this.by.fill(0);
    for (const m of this.mem) m.fill(0);
  }

  params(): Float64Array[] {
    return [this.Wxh, this.Whh, this.Why, this.bh, this.by];
  }

  grads(): Float64Array[] {
    return [this.dWxh, this.dWhh, this.dWhy, this.dbh, this.dby];
  }

  /** One step of the recurrence: h = tanh(Wxh[:, ix] + Whh h_prev + bh). Writes into `out`. */
  stepHidden(ix: number, hprev: Float64Array, out: Float64Array): void {
    const { H, V } = this;
    for (let i = 0; i < H; i++) {
      let a = this.Wxh[i * V + ix]! + this.bh[i]!;
      const row = i * H;
      for (let j = 0; j < H; j++) a += this.Whh[row + j]! * hprev[j]!;
      out[i] = Math.tanh(a);
    }
  }

  /** Output scores y = Why h + by. Writes into `y`. */
  scores(h: Float64Array, y: Float64Array): void {
    const { H, V } = this;
    for (let k = 0; k < V; k++) {
      let s = this.by[k]!;
      const row = k * H;
      for (let j = 0; j < H; j++) s += this.Why[row + j]! * h[j]!;
      y[k] = s;
    }
  }

  /** Softmax over Why h + by, with scores divided by `temp`. Writes into `p`. */
  probs(h: Float64Array, p: Float64Array, temp = 1): void {
    const { V } = this;
    this.scores(h, p);
    let mx = -Infinity;
    for (let k = 0; k < V; k++) {
      p[k] = p[k]! / temp;
      if (p[k]! > mx) mx = p[k]!;
    }
    let tot = 0;
    for (let k = 0; k < V; k++) {
      p[k] = Math.exp(p[k]! - mx);
      tot += p[k]!;
    }
    for (let k = 0; k < V; k++) p[k]! /= tot;
  }

  /** Forward + backward over one chunk. Leaves gradients in d*, returns the summed loss and the last hidden state. */
  lossFun(inputs: number[], targets: number[], hprev: Float64Array): { loss: number; h: Float64Array } {
    const { H, V } = this;
    const T = inputs.length;
    while (this.hs.length < T + 1) this.hs.push(new Float64Array(H));
    while (this.ps.length < T) this.ps.push(new Float64Array(V));
    const hs = this.hs;
    hs[0]!.set(hprev);
    let loss = 0;
    this.lastPt.length = 0;
    for (let t = 0; t < T; t++) {
      this.stepHidden(inputs[t]!, hs[t]!, hs[t + 1]!);
      this.probs(hs[t + 1]!, this.ps[t]!);
      const pt = this.ps[t]![targets[t]!]!;
      this.lastPt.push(pt);
      loss += -Math.log(pt);
    }
    for (const g of this.grads()) g.fill(0);
    const dhnext = new Float64Array(H);
    const dh = new Float64Array(H);
    const dhraw = new Float64Array(H);
    for (let t = T - 1; t >= 0; t--) {
      const p = this.ps[t]!;
      const h = hs[t + 1]!;
      const hp = hs[t]!;
      p[targets[t]!]! -= 1; // dy = p - onehot(target)
      dh.set(dhnext);
      for (let k = 0; k < V; k++) {
        const dy = p[k]!;
        if (dy === 0) continue;
        this.dby[k]! += dy;
        const row = k * H;
        for (let j = 0; j < H; j++) {
          this.dWhy[row + j]! += dy * h[j]!;
          dh[j]! += this.Why[row + j]! * dy;
        }
      }
      for (let i = 0; i < H; i++) dhraw[i] = (1 - h[i]! * h[i]!) * dh[i]!;
      dhnext.fill(0);
      for (let i = 0; i < H; i++) {
        const d = dhraw[i]!;
        this.dbh[i]! += d;
        this.dWxh[i * V + inputs[t]!]! += d;
        const row = i * H;
        for (let j = 0; j < H; j++) {
          this.dWhh[row + j]! += d * hp[j]!;
          dhnext[j]! += this.Whh[row + j]! * d;
        }
      }
    }
    return { loss, h: Float64Array.from(hs[T]!) };
  }

  /** Clip every gradient entry to [-clip, clip], then an Adagrad step. */
  update(lr: number, clip = 5): void {
    const ps = this.params();
    const gs = this.grads();
    for (let a = 0; a < ps.length; a++) {
      const p = ps[a]!, g = gs[a]!, m = this.mem[a]!;
      for (let i = 0; i < p.length; i++) {
        const d = Math.max(-clip, Math.min(clip, g[i]!));
        m[i]! += d * d;
        p[i]! -= (lr * d) / Math.sqrt(m[i]! + 1e-8);
      }
    }
  }

  /** Sample n indices, feeding each sample back in as the next input. */
  sample(hprev: Float64Array, seedIx: number, n: number, rng: Rng, temp = 1): number[] {
    const h = Float64Array.from(hprev);
    const h2 = new Float64Array(this.H);
    const p = new Float64Array(this.V);
    let ix = seedIx;
    const out: number[] = [];
    for (let t = 0; t < n; t++) {
      this.stepHidden(ix, h, h2);
      h.set(h2);
      this.probs(h, p, temp);
      let u = rng.next();
      ix = this.V - 1;
      for (let k = 0; k < this.V; k++) {
        u -= p[k]!;
        if (u <= 0) {
          ix = k;
          break;
        }
      }
      out.push(ix);
    }
    return out;
  }

  /** Hidden state after each character of `ixs`, starting from zeros. */
  hiddenStates(ixs: number[]): Float64Array[] {
    let h = new Float64Array(this.H);
    const out: Float64Array[] = [];
    for (const ix of ixs) {
      const nh = new Float64Array(this.H);
      this.stepHidden(ix, h, nh);
      out.push(nh);
      h = nh;
    }
    return out;
  }

  toJSON(digits = 4): Record<string, number[] | number> {
    const r = (a: Float64Array) => Array.from(a, (v) => Number(v.toFixed(digits)));
    return { V: this.V, H: this.H, Wxh: r(this.Wxh), Whh: r(this.Whh), Why: r(this.Why), bh: r(this.bh), by: r(this.by) };
  }

  load(o: { Wxh: number[]; Whh: number[]; Why: number[]; bh: number[]; by: number[] }): void {
    this.Wxh.set(o.Wxh);
    this.Whh.set(o.Whh);
    this.Why.set(o.Why);
    this.bh.set(o.bh);
    this.by.set(o.by);
  }
}

/** Character vocabulary of a text, sorted, with lookup tables (min-char-rnn's chars / char_to_ix). */
export function vocab(text: string): { chars: string[]; ix: Map<string, number> } {
  const chars = [...new Set(text)].sort();
  return { chars, ix: new Map(chars.map((c, i) => [c, i])) };
}

let pretrained: Promise<CharRNN> | null = null;

/** The pretrained 64-unit model (30,000 min-char-rnn iterations on the corpus), fetched once. */
export function loadPretrained(): Promise<CharRNN> {
  pretrained ??= fetch('./data/rnn-charrnn.json')
    .then((r) => {
      if (!r.ok) throw new Error(`rnn-charrnn.json: ${r.status}`);
      return r.json();
    })
    .then((m) => {
      const net = new CharRNN(m.V, m.H, 1);
      net.load(m);
      return net;
    });
  return pretrained;
}
