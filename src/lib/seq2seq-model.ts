// The chapter's toy translators: a forward pass over weights trained offline in PyTorch
// (GRU encoders and decoders, PyTorch's gate layout). Import-free, so plain Node can run it.

export const NOUNS: [string, string][] = [
  ['cat', 'chat'], ['dog', 'chien'], ['wolf', 'loup'], ['fish', 'poisson'], ['horse', 'cheval'],
  ['rabbit', 'lapin'], ['fox', 'renard'], ['pig', 'cochon'], ['duck', 'canard'], ['tiger', 'tigre'],
];
export const COLORS: [string, string][] = [['black', 'noir'], ['white', 'blanc'], ['red', 'rouge'], ['green', 'vert'], ['gray', 'gris'], ['brown', 'brun']];
export const VERBS: [string, string][] = [['sees', 'voit'], ['chases', 'chasse'], ['eats', 'mange'], ['likes', 'aime'], ['follows', 'suit']];
export const DETS: [string, string][] = [['the', 'le'], ['a', 'un']];
export const MINL = 5;
export const MAXL = 40;

const LEX = new Map<string, string>([...NOUNS, ...COLORS, ...VERBS, ...DETS, ['and', 'et']]);
const COLOR_SET = new Set(COLORS.map((c) => c[0]));

/** The reference translation: word for word, with every color moved after its noun. */
export function reference(src: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < src.length; i++) {
    const w = src[i]!;
    if (COLOR_SET.has(w) && i + 1 < src.length) {
      out.push(LEX.get(src[i + 1]!)!, LEX.get(w)!);
      i++;
    } else out.push(LEX.get(w)!);
  }
  return out;
}

type Uniform = () => number;
const pick = <T>(r: Uniform, a: T[]): T => a[Math.floor(r() * a.length)]!;

/** One random sentence: a subject, a verb and `k` objects joined by "and"; `pc` is the chance of a color. */
export function sentence(r: Uniform, k: number, pc = 0.5): string[] {
  const np = () => {
    const d = pick(r, DETS)[0], n = pick(r, NOUNS)[0];
    return r() < pc ? [d, pick(r, COLORS)[0], n] : [d, n];
  };
  const s = [...np(), pick(r, VERBS)[0]];
  for (let i = 0; i < k; i++) {
    if (i) s.push('and');
    s.push(...np());
  }
  return s;
}

/** A random sentence of exactly `len` words (5 to 40), or null if the draw keeps missing. */
export function sentenceOfLength(r: Uniform, len: number): string[] | null {
  for (let tries = 0; tries < 4000; tries++) {
    const k = 1 + Math.floor(r() * 10);
    const s = sentence(r, k, r());
    if (s.length === len) return s;
  }
  return null;
}

/* ------------------------------------------------------------------ weights */

interface TensorSpec { shape: number[]; offset: number }
interface ModelSpec { kind: 'encdec' | 'attn'; H: number; score?: 'additive' | 'general'; tensors: Record<string, TensorSpec> }
export interface Manifest { src: string[]; tgt: string[]; models: Record<string, ModelSpec> }

class Mat {
  readonly d: Float32Array;
  readonly rows: number;
  readonly cols: number;
  constructor(d: Float32Array, rows: number, cols: number) {
    this.d = d;
    this.rows = rows;
    this.cols = cols;
  }
  /** out[r] = sum_c M[r, c] x[c], over the column range [c0, c0 + x.length). */
  mv(x: ArrayLike<number>, out: Float64Array, c0 = 0, acc = false): Float64Array {
    const { d, cols } = this;
    const n = x.length;
    for (let r = 0; r < this.rows; r++) {
      let s = acc ? out[r]! : 0;
      const o = r * cols + c0;
      for (let c = 0; c < n; c++) s += d[o + c]! * x[c]!;
      out[r] = s;
    }
    return out;
  }
  row(r: number): Float32Array {
    return this.d.subarray(r * this.cols, (r + 1) * this.cols);
  }
}

const sig = (z: number) => 1 / (1 + Math.exp(-z));

/** A GRU cell in PyTorch's layout: gates stacked as [reset, update, new]. */
class GRU {
  readonly H: number;
  readonly Wih: Mat;
  readonly Whh: Mat;
  readonly bih: Float32Array;
  readonly bhh: Float32Array;
  private gi: Float64Array;
  private gh: Float64Array;
  constructor(Wih: Mat, Whh: Mat, bih: Float32Array, bhh: Float32Array) {
    this.Wih = Wih;
    this.Whh = Whh;
    this.bih = bih;
    this.bhh = bhh;
    this.H = Whh.cols;
    this.gi = new Float64Array(3 * this.H);
    this.gh = new Float64Array(3 * this.H);
  }
  /** h' = (1 - z) n + z h, with the input given as consecutive pieces (e.g. [embedding, context]). */
  step(h: ArrayLike<number>, ...xs: ArrayLike<number>[]): Float64Array {
    const { H, gi, gh } = this;
    let c0 = 0;
    xs.forEach((x, i) => {
      this.Wih.mv(x, gi, c0, i > 0);
      c0 += x.length;
    });
    this.Whh.mv(h, gh);
    const out = new Float64Array(H);
    for (let k = 0; k < H; k++) {
      const r = sig(gi[k]! + this.bih[k]! + gh[k]! + this.bhh[k]!);
      const z = sig(gi[H + k]! + this.bih[H + k]! + gh[H + k]! + this.bhh[H + k]!);
      const n = Math.tanh(gi[2 * H + k]! + this.bih[2 * H + k]! + r * (gh[2 * H + k]! + this.bhh[2 * H + k]!));
      out[k] = (1 - z) * n + z * h[k]!;
    }
    return out;
  }
}

export function softmax(v: ArrayLike<number>): number[] {
  let m = -Infinity;
  for (let i = 0; i < v.length; i++) m = Math.max(m, v[i]!);
  const e = Array.from(v, (x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

export interface Translation {
  src: string[];
  words: string[];
  /** Probability the model gave each word it wrote. */
  probs: number[];
  /** The three likeliest words at each step. */
  top: [string, number][][];
  /** Encoder states, one per source word (for the attention model: forward and backward halves joined). */
  enc: number[][];
  /** Decoder states s_t, one per written word. */
  dec: number[][];
  /** Fixed-vector models: the one context vector. */
  c?: number[];
  /** Attention models: scores e[t][j] and weights alpha[t][j]. */
  scores?: number[][];
  alpha?: number[][];
}

export class Translator {
  readonly kind: 'encdec' | 'attn';
  readonly H: number;
  readonly score: 'additive' | 'general' | null;
  private T: Record<string, Mat | Float32Array> = {};
  private si: Map<string, number>;
  readonly man: Manifest;

  constructor(man: Manifest, buf: Float32Array, name: string) {
    this.man = man;
    const spec = man.models[name];
    if (!spec) throw new Error(`no model ${name}`);
    this.kind = spec.kind;
    this.H = spec.H;
    this.score = spec.score ?? null;
    for (const [k, t] of Object.entries(spec.tensors)) {
      const n = t.shape.reduce((a, b) => a * b, 1);
      const d = buf.subarray(t.offset, t.offset + n);
      this.T[k] = t.shape.length === 2 ? new Mat(d, t.shape[0]!, t.shape[1]!) : d;
    }
    this.si = new Map(man.src.map((w, i) => [w, i]));
  }
  private m(k: string): Mat {
    return this.T[k] as Mat;
  }
  private v(k: string): Float32Array {
    return this.T[k] as Float32Array;
  }
  private gru(p: string, sfx = ''): GRU {
    return new GRU(this.m(`${p}.weight_ih${sfx}`), this.m(`${p}.weight_hh${sfx}`), this.v(`${p}.bias_ih${sfx}`), this.v(`${p}.bias_hh${sfx}`));
  }

  /**
   * Greedy decoding: write the likeliest word, feed it back, stop at <eos> or `maxLen` words.
   * With `record` false only the words and probabilities are kept (for bulk evaluation).
   */
  translate(src: string[], maxLen = src.length + 3, record = true): Translation {
    const ids = src.map((w) => {
      const i = this.si.get(w);
      if (i === undefined) throw new Error(`not in the toy vocabulary: ${w}`);
      return i;
    });
    const semb = this.m('semb.weight');
    const temb = this.m('temb.weight');
    const out = this.m('out.weight');
    const ob = this.v('out.bias');
    const tgt = this.man.tgt;
    const H = this.H;
    const res: Translation = { src, words: [], probs: [], top: [], enc: [], dec: [] };
    const logits = new Float64Array(tgt.length);
    const emit = (s: Float64Array, c: ArrayLike<number>): number => {
      out.mv(s, logits, 0);
      out.mv(c, logits, H, true);
      for (let i = 0; i < logits.length; i++) logits[i]! += ob[i]!;
      const p = softmax(logits);
      let best = 0;
      p.forEach((q, i) => q > p[best]! && (best = i));
      if (record) {
        const order = p.map((q, i) => [i, q] as const).sort((a, b) => b[1] - a[1]).slice(0, 3);
        res.top.push(order.map(([i, q]) => [tgt[i]!, q]));
      }
      res.probs.push(p[best]!);
      return best;
    };
    let y = tgt.indexOf('<bos>');
    const eos = tgt.indexOf('<eos>');

    if (this.kind === 'encdec') {
      const enc = this.gru('enc', '_l0');
      let h: Float64Array = new Float64Array(H);
      for (const i of ids) {
        h = enc.step(h, semb.row(i));
        if (record) res.enc.push([...h]);
      }
      const c = h;
      res.c = [...c];
      const dec = this.gru('dec');
      let s: Float64Array = c;
      for (let t = 0; t < maxLen; t++) {
        s = dec.step(s, temb.row(y), c);
        if (record) res.dec.push([...s]);
        y = emit(s, c);
        if (y === eos) break;
        res.words.push(tgt[y]!);
      }
      return res;
    }

    // Bidirectional encoder: annotation h_j = [forward state after x_j ; backward state after x_j].
    const fw = this.gru('enc', '_l0');
    const bw = this.gru('enc', '_l0_reverse');
    const Hh = H / 2;
    const n = ids.length;
    const fs: Float64Array[] = [];
    const bs: Float64Array[] = new Array(n);
    let h: Float64Array = new Float64Array(Hh);
    for (let j = 0; j < n; j++) fs.push((h = fw.step(h, semb.row(ids[j]!))));
    h = new Float64Array(Hh);
    for (let j = n - 1; j >= 0; j--) bs[j] = h = bw.step(h, semb.row(ids[j]!));
    const hs = fs.map((f, j) => Float64Array.from([...f, ...bs[j]!]));
    if (record) res.enc = hs.map((a) => [...a]);
    let s: Float64Array = new Float64Array(H);
    this.m('init.weight').mv(bs[0]!, s);
    const ib = this.v('init.bias');
    for (let k = 0; k < H; k++) s[k] = Math.tanh(s[k]! + ib[k]!);

    // Keys that do not depend on the decoder are computed once.
    let keys: Float64Array[];
    if (this.score === 'additive') {
      const Ua = this.m('Ua.weight');
      const ub = this.v('Ua.bias');
      keys = hs.map((hj) => {
        const k = Ua.mv(hj, new Float64Array(Ua.rows));
        for (let a = 0; a < k.length; a++) k[a]! += ub[a]!;
        return k;
      });
    } else keys = hs;
    res.scores = [];
    res.alpha = [];
    const dec = this.gru('dec');
    for (let t = 0; t < maxLen; t++) {
      const e: number[] = [];
      if (this.score === 'additive') {
        const Wa = this.m('Wa.weight');
        const va = this.m('va.weight').row(0);
        const ws = Wa.mv(s, new Float64Array(Wa.rows));
        for (const kj of keys) {
          let acc = 0;
          for (let a = 0; a < ws.length; a++) acc += va[a]! * Math.tanh(ws[a]! + kj[a]!);
          e.push(acc);
        }
      } else {
        const q = this.m('Wg.weight').mv(s, new Float64Array(H));
        for (const kj of keys) {
          let acc = 0;
          for (let a = 0; a < H; a++) acc += q[a]! * kj[a]!;
          e.push(acc);
        }
      }
      const alpha = softmax(e);
      const c = new Float64Array(H);
      alpha.forEach((a, j) => {
        const hj = hs[j]!;
        for (let k = 0; k < H; k++) c[k]! += a * hj[k]!;
      });
      res.scores.push(e);
      res.alpha.push(alpha);
      s = dec.step(s, temb.row(y), c);
      if (record) res.dec.push([...s]);
      y = emit(s, c);
      if (y === eos) break;
      res.words.push(tgt[y]!);
    }
    return res;
  }
}

/** Parses the exported manifest and weight blob into one translator per model. */
export function buildModels(man: Manifest, buf: ArrayBuffer): Record<string, Translator> {
  const f = new Float32Array(buf);
  return Object.fromEntries(Object.keys(man.models).map((k) => [k, new Translator(man, f, k)]));
}

let cache: Promise<Record<string, Translator>> | null = null;
/** Fetches the four toy models once per page load (about 0.4 MB). */
export function loadModels(): Promise<Record<string, Translator>> {
  cache ??= Promise.all([
    fetch('./data/seq2seq-models.json').then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<Manifest>;
    }),
    fetch('./data/seq2seq-models.bin').then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer();
    }),
  ]).then(([man, buf]) => buildModels(man, buf));
  cache.catch(() => (cache = null));
  return cache;
}
