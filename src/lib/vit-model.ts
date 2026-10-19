/**
 * The chapter's tiny vision transformer: ViT equations 1 to 4 at small size (P = 4, D = 64,
 * 6 pre-norm blocks of 4 heads), trained offline on CIFAR-10 and run here in Float32.
 * Weights: public/data/vit-tiny.{json,bin} (with position embeddings) and vit-nopos.* (without).
 * No imports, so the forward pass can be checked in Node against the PyTorch reference.
 */

export interface VitManifest {
  P: number;
  D: number;
  L: number;
  H: number;
  M: number;
  pos: boolean;
  params: number;
  mean: number[];
  std: number[];
  testAcc: number;
  epochs: number;
  tensors: { name: string; shape: number[]; offset: number }[];
}

interface Block {
  ln1w: Float32Array; ln1b: Float32Array;
  qkvW: Float32Array; qkvB: Float32Array;
  projW: Float32Array; projB: Float32Array;
  ln2w: Float32Array; ln2b: Float32Array;
  fc1W: Float32Array; fc1B: Float32Array;
  fc2W: Float32Array; fc2B: Float32Array;
}

/** Everything one forward pass computed that the figures draw. */
export interface VitTrace {
  /** Tokens entering block 1: (N + 1) x D, class token first. */
  z0: Float32Array;
  /** Patch embeddings before positions are added: N x D. */
  emb: Float32Array;
  /** Attention weights per layer: H x T x T, T = N + 1. */
  A: Float32Array[];
  logits: Float32Array;
  probs: Float32Array;
}

let HALF: Float32Array | null = null;
function halfTable(): Float32Array {
  if (HALF) return HALF;
  HALF = new Float32Array(65536);
  for (let h = 0; h < 65536; h++) {
    const s = h & 0x8000 ? -1 : 1;
    const e = (h >> 10) & 0x1f;
    const f = h & 0x3ff;
    HALF[h] = e === 0 ? s * f * 2 ** -24 : e === 31 ? (f ? NaN : s * Infinity) : s * (1 + f / 1024) * 2 ** (e - 15);
  }
  return HALF;
}

/** y = x W^T + b for x: n x din, W: dout x din (PyTorch layout). */
function linear(x: Float32Array, n: number, din: number, W: Float32Array, b: Float32Array | null, dout: number): Float32Array {
  const y = new Float32Array(n * dout);
  for (let i = 0; i < n; i++) {
    const xo = i * din;
    for (let o = 0; o < dout; o++) {
      const wo = o * din;
      let s = b ? b[o]! : 0;
      for (let k = 0; k < din; k++) s += x[xo + k]! * W[wo + k]!;
      y[i * dout + o] = s;
    }
  }
  return y;
}

function layerNorm(x: Float32Array, n: number, d: number, w: Float32Array, b: Float32Array): Float32Array {
  const y = new Float32Array(n * d);
  for (let i = 0; i < n; i++) {
    let mu = 0;
    for (let k = 0; k < d; k++) mu += x[i * d + k]!;
    mu /= d;
    let v = 0;
    for (let k = 0; k < d; k++) v += (x[i * d + k]! - mu) ** 2;
    const r = 1 / Math.sqrt(v / d + 1e-6);
    for (let k = 0; k < d; k++) y[i * d + k] = (x[i * d + k]! - mu) * r * w[k]! + b[k]!;
  }
  return y;
}

const gelu = (x: number): number => 0.5 * x * (1 + Math.tanh(0.7978845608028654 * (x + 0.044715 * x * x * x)));

export function softmax(z: ArrayLike<number>): Float32Array {
  let mx = -Infinity;
  for (let i = 0; i < z.length; i++) mx = Math.max(mx, z[i]!);
  const p = new Float32Array(z.length);
  let s = 0;
  for (let i = 0; i < z.length; i++) s += p[i] = Math.exp(z[i]! - mx);
  for (let i = 0; i < z.length; i++) p[i]! /= s;
  return p;
}

export class TinyViT {
  readonly P: number;
  readonly D: number;
  readonly L: number;
  readonly H: number;
  readonly M: number;
  /** Patches per side and in all. */
  readonly G: number;
  readonly N: number;
  readonly hasPos: boolean;
  readonly testAcc: number;
  readonly params: number;
  readonly mean: number[];
  readonly std: number[];
  /** D x (P·P·3): row o is the filter that makes number o of every token. */
  readonly E: Float32Array;
  readonly cls: Float32Array;
  /** (N + 1) x D, or zeros for the model trained without positions. */
  readonly pos: Float32Array;
  private readonly blocks: Block[];
  private readonly lnW: Float32Array;
  private readonly lnB: Float32Array;
  private readonly headW: Float32Array;
  private readonly headB: Float32Array;

  constructor(m: VitManifest, buf: ArrayBuffer) {
    const tab = halfTable();
    const u16 = new Uint16Array(buf);
    const t = (name: string): Float32Array => {
      const d = m.tensors.find((q) => q.name === name);
      if (!d) throw new Error(`vit: missing tensor ${name}`);
      const n = d.shape.reduce((a, b) => a * b, 1);
      const out = new Float32Array(n);
      const o = d.offset / 2;
      for (let i = 0; i < n; i++) out[i] = tab[u16[o + i]!]!;
      return out;
    };
    this.P = m.P;
    this.D = m.D;
    this.L = m.L;
    this.H = m.H;
    this.M = m.M;
    this.G = 32 / m.P;
    this.N = this.G * this.G;
    this.hasPos = m.pos;
    this.testAcc = m.testAcc;
    this.params = m.params;
    this.mean = m.mean;
    this.std = m.std;
    this.E = t('E');
    this.cls = t('cls');
    this.pos = m.pos ? t('pos') : new Float32Array((this.N + 1) * this.D);
    this.blocks = Array.from({ length: m.L }, (_, i) => ({
      ln1w: t(`b${i}.ln1.w`), ln1b: t(`b${i}.ln1.b`),
      qkvW: t(`b${i}.qkv.w`), qkvB: t(`b${i}.qkv.b`),
      projW: t(`b${i}.proj.w`), projB: t(`b${i}.proj.b`),
      ln2w: t(`b${i}.ln2.w`), ln2b: t(`b${i}.ln2.b`),
      fc1W: t(`b${i}.fc1.w`), fc1B: t(`b${i}.fc1.b`),
      fc2W: t(`b${i}.fc2.w`), fc2B: t(`b${i}.fc2.b`),
    }));
    this.lnW = t('ln.w');
    this.lnB = t('ln.b');
    this.headW = t('head.w');
    this.headB = t('head.b');
  }

  /**
   * One CIFAR image (3072 bytes, channel-major) to N x (P·P·3) normalized patches, row-major
   * over the patch grid, each patch flattened row, column, channel.
   */
  patches(px: ArrayLike<number>, off = 0): Float32Array {
    const { P, G } = this;
    const pd = P * P * 3;
    const out = new Float32Array(this.N * pd);
    for (let gy = 0; gy < G; gy++)
      for (let gx = 0; gx < G; gx++) {
        const j = gy * G + gx;
        for (let py = 0; py < P; py++)
          for (let pxx = 0; pxx < P; pxx++)
            for (let c = 0; c < 3; c++) {
              const v = px[off + c * 1024 + (gy * P + py) * 32 + gx * P + pxx]! / 255;
              out[j * pd + (py * P + pxx) * 3 + c] = (v - this.mean[c]!) / this.std[c]!;
            }
      }
    return out;
  }

  /** Forward pass. `order[slot]` names the patch placed in each slot (a shuffle); positions stay with slots. */
  forward(xp: Float32Array, order?: ArrayLike<number>): VitTrace {
    const { D, H, N, M } = this;
    const T = N + 1;
    const pd = this.P * this.P * 3;
    let src = xp;
    if (order) {
      src = new Float32Array(xp.length);
      for (let s = 0; s < N; s++) src.set(xp.subarray(order[s]! * pd, (order[s]! + 1) * pd), s * pd);
    }
    const emb = linear(src, N, pd, this.E, null, D);
    let z = new Float32Array(T * D);
    z.set(this.cls, 0);
    z.set(emb, D);
    for (let i = 0; i < T * D; i++) z[i]! += this.pos[i]!;
    const z0 = z.slice();
    const dk = D / H;
    const scale = 1 / Math.sqrt(dk);
    const As: Float32Array[] = [];
    for (const b of this.blocks) {
      const qkv = linear(layerNorm(z, T, D, b.ln1w, b.ln1b), T, D, b.qkvW, b.qkvB, 3 * D);
      const A = new Float32Array(H * T * T);
      const o = new Float32Array(T * D);
      const row = new Float32Array(T);
      for (let h = 0; h < H; h++) {
        const qo = h * dk, ko = D + h * dk, vo = 2 * D + h * dk;
        for (let i = 0; i < T; i++) {
          let mx = -Infinity;
          for (let j = 0; j < T; j++) {
            let s = 0;
            for (let k = 0; k < dk; k++) s += qkv[i * 3 * D + qo + k]! * qkv[j * 3 * D + ko + k]!;
            row[j] = s * scale;
            if (row[j]! > mx) mx = row[j]!;
          }
          let sum = 0;
          for (let j = 0; j < T; j++) sum += row[j] = Math.exp(row[j]! - mx);
          const ao = (h * T + i) * T;
          for (let j = 0; j < T; j++) {
            const a = row[j]! / sum;
            A[ao + j] = a;
            for (let k = 0; k < dk; k++) o[i * D + h * dk + k]! += a * qkv[j * 3 * D + vo + k]!;
          }
        }
      }
      As.push(A);
      const att = linear(o, T, D, b.projW, b.projB, D);
      for (let i = 0; i < T * D; i++) z[i]! += att[i]!;
      const hid = linear(layerNorm(z, T, D, b.ln2w, b.ln2b), T, D, b.fc1W, b.fc1B, M);
      for (let i = 0; i < hid.length; i++) hid[i] = gelu(hid[i]!);
      const mlp = linear(hid, T, M, b.fc2W, b.fc2B, D);
      z = z.slice();
      for (let i = 0; i < T * D; i++) z[i]! += mlp[i]!;
    }
    const y = layerNorm(z.subarray(0, D), 1, D, this.lnW, this.lnB);
    const logits = linear(y, 1, D, this.headW, this.headB, 10);
    return { z0, emb, A: As, logits, probs: softmax(logits) };
  }

  /** Head-averaged attention of layer l: T x T. */
  meanHeads(tr: VitTrace, l: number): Float32Array {
    const T = this.N + 1;
    const out = new Float32Array(T * T);
    const A = tr.A[l]!;
    for (let h = 0; h < this.H; h++) for (let i = 0; i < T * T; i++) out[i]! += A[h * T * T + i]! / this.H;
    return out;
  }

  /**
   * Attention rollout (Abnar and Zuidema, 2020) through layer `upto`: multiply the head-averaged
   * maps, each mixed half and half with the identity for the residual path. Returns T x T.
   */
  rollout(tr: VitTrace, upto = this.L - 1): Float32Array {
    const T = this.N + 1;
    let R = new Float32Array(T * T);
    for (let i = 0; i < T; i++) R[i * T + i] = 1;
    for (let l = 0; l <= upto; l++) {
      const A = this.meanHeads(tr, l);
      const next = new Float32Array(T * T);
      for (let i = 0; i < T; i++)
        for (let k = 0; k < T; k++) {
          const a = 0.5 * A[i * T + k]! + (i === k ? 0.5 : 0);
          if (a === 0) continue;
          for (let j = 0; j < T; j++) next[i * T + j]! += a * R[k * T + j]!;
        }
      R = next;
    }
    return R;
  }

  /** Pixel distance between the centres of patches i and j (0-based patch indices). */
  dist(i: number, j: number): number {
    const G = this.G;
    return this.P * Math.hypot((i % G) - (j % G), Math.floor(i / G) - Math.floor(j / G));
  }

  /**
   * Mean attention distance of one head: for every patch query, the attention-weighted pixel
   * distance to the patches it attends to (class token left out, weights renormalized), averaged.
   */
  attnDistance(tr: VitTrace, l: number, h: number): number {
    const N = this.N, T = N + 1;
    const A = tr.A[l]!;
    let tot = 0;
    for (let i = 0; i < N; i++) {
      const o = (h * T + i + 1) * T;
      let s = 0, w = 0;
      for (let j = 0; j < N; j++) {
        const a = A[o + j + 1]!;
        s += a * this.dist(i, j);
        w += a;
      }
      tot += s / Math.max(1e-9, w);
    }
    return tot / N;
  }
}

/** Loads both trained models once per session. */
let loading: Promise<{ vit: TinyViT; nopos: TinyViT }> | null = null;
export function loadVits(): Promise<{ vit: TinyViT; nopos: TinyViT }> {
  const one = async (name: string): Promise<TinyViT> => {
    const [m, buf] = await Promise.all([
      fetch(`./data/${name}.json`).then((r) => {
        if (!r.ok) throw new Error(`${name}.json: ${r.status}`);
        return r.json() as Promise<VitManifest>;
      }),
      fetch(`./data/${name}.bin`).then((r) => {
        if (!r.ok) throw new Error(`${name}.bin: ${r.status}`);
        return r.arrayBuffer();
      }),
    ]);
    return new TinyViT(m, buf);
  };
  loading ??= Promise.all([one('vit-tiny'), one('vit-nopos')]).then(([vit, nopos]) => ({ vit, nopos }));
  return loading;
}
