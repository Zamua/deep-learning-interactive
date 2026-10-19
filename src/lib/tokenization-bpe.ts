/** Byte-level BPE: a trainer and codec that mirror the chapter's Python listings line for line. */

/** GPT-2's pre-tokenization pattern: merges never cross the chunk boundaries it finds. */
export const GPT2_SPLIT = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

const ENC = new TextEncoder();
const DEC = new TextDecoder('utf-8');
const STRICT = new TextDecoder('utf-8', { fatal: true });

export const bytesOf = (s: string): number[] => Array.from(ENC.encode(s));

export function chunksOf(text: string, split: boolean): string[] {
  if (!split) return text ? [text] : [];
  return text.match(GPT2_SPLIT) ?? [];
}

/** Pair (a, b) as one number; ids stay below 65536. */
export const pairKey = (a: number, b: number): number => a * 65536 + b;
export const pairOf = (k: number): [number, number] => [Math.floor(k / 65536), k % 65536];

/** Counts adjacent pairs, in first-seen order (Python dicts keep insertion order, and `max` takes the first winner). */
export function getStats(chunks: number[][], counts = new Map<number, number>()): Map<number, number> {
  for (const ids of chunks) for (let i = 0; i + 1 < ids.length; i++) {
    const k = pairKey(ids[i]!, ids[i + 1]!);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export function topPair(stats: Map<number, number>): [number, number] | null {
  let best = -1;
  let bestN = 0;
  for (const [k, n] of stats) if (n > bestN) {
    best = k;
    bestN = n;
  }
  return best < 0 ? null : [best, bestN];
}

/** Replaces every non-overlapping (a, b), left to right, with `idx`. */
export function merge(ids: number[], a: number, b: number, idx: number): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < ids.length) {
    if (i < ids.length - 1 && ids[i] === a && ids[i + 1] === b) {
      out.push(idx);
      i += 2;
    } else {
      out.push(ids[i]!);
      i += 1;
    }
  }
  return out;
}

export interface BPE {
  /** merges[k] = [a, b] made token 256 + k. */
  merges: [number, number][];
  /** The bytes behind every id. */
  vocab: Uint8Array[];
  /** pairKey -> merge rank k. */
  rank: Map<number, number>;
  /** Corpus length in tokens after k merges, k = 0..merges.length. */
  lens: number[];
  /** How often the winning pair occurred when merge k was made. */
  counts: number[];
  split: boolean;
  bytes: number;
}

/** Trains up to `maxMerges` merges, stopping early once no pair occurs twice. */
export function train(text: string, maxMerges: number, split: boolean): BPE {
  let chunks = chunksOf(text, split).map(bytesOf);
  const vocab = Array.from({ length: 256 }, (_, i) => Uint8Array.of(i));
  const merges: [number, number][] = [];
  const rank = new Map<number, number>();
  const total = () => chunks.reduce((s, c) => s + c.length, 0);
  const lens = [total()];
  const counts: number[] = [];
  for (let k = 0; k < maxMerges; k++) {
    const top = topPair(getStats(chunks));
    if (!top || top[1] < 2) break;
    const [a, b] = pairOf(top[0]);
    const idx = 256 + k;
    chunks = chunks.map((c) => merge(c, a, b, idx));
    merges.push([a, b]);
    rank.set(top[0], k);
    const v = new Uint8Array(vocab[a]!.length + vocab[b]!.length);
    v.set(vocab[a]!);
    v.set(vocab[b]!, vocab[a]!.length);
    vocab.push(v);
    lens.push(total());
    counts.push(top[1]);
  }
  return { merges, vocab, rank, lens, counts, split, bytes: lens[0]! };
}

/** Applies the first `k` merges to one chunk: always the present pair with the lowest rank. */
export function encodeChunk(ids: number[], bpe: BPE, k = bpe.merges.length): number[] {
  let cur = ids;
  for (;;) {
    let best = Infinity;
    for (let i = 0; i + 1 < cur.length; i++) {
      const r = bpe.rank.get(pairKey(cur[i]!, cur[i + 1]!));
      if (r !== undefined && r < best && r < k) best = r;
    }
    if (best === Infinity) return cur;
    const [a, b] = bpe.merges[best]!;
    cur = merge(cur, a, b, 256 + best);
  }
}

/** Token ids per chunk. */
export function encodeChunks(text: string, bpe: BPE, k = bpe.merges.length, split = bpe.split): number[][] {
  return chunksOf(text, split).map((c) => encodeChunk(bytesOf(c), bpe, k));
}

export function encode(text: string, bpe: BPE, k = bpe.merges.length): number[] {
  return encodeChunks(text, bpe, k).flat();
}

export interface TraceStep {
  /** Merge rank applied to reach this state, or -1 for the raw bytes. */
  rank: number;
  chunks: number[][];
  /** How many places the merge fired. */
  hits: number;
}

/** Encoding as a sequence of states: raw bytes, then one state per merge rank that fires. */
export function encodeTrace(text: string, bpe: BPE, k = bpe.merges.length): TraceStep[] {
  let chunks = chunksOf(text, bpe.split).map(bytesOf);
  const steps: TraceStep[] = [{ rank: -1, chunks, hits: 0 }];
  for (;;) {
    let best = Infinity;
    for (const c of chunks) for (let i = 0; i + 1 < c.length; i++) {
      const r = bpe.rank.get(pairKey(c[i]!, c[i + 1]!));
      if (r !== undefined && r < best && r < k) best = r;
    }
    if (best === Infinity) return steps;
    const [a, b] = bpe.merges[best]!;
    let hits = 0;
    chunks = chunks.map((c) => {
      const m = merge(c, a, b, 256 + best);
      hits += c.length - m.length;
      return m;
    });
    steps.push({ rank: best, chunks, hits });
  }
}

export function decodeBytes(ids: number[], bpe: BPE): Uint8Array {
  const parts = ids.map((i) => bpe.vocab[i]!);
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Python's `bytes.decode('utf-8', errors='replace')`. */
export function decode(ids: number[], bpe: BPE): string {
  return DEC.decode(decodeBytes(ids, bpe));
}

/** How a token's bytes read on a chip: spaces as ␣, newlines as ⏎, stray bytes of a split character in hex. */
export function show(bytes: Uint8Array): string {
  let s: string;
  try {
    s = STRICT.decode(bytes);
  } catch {
    return Array.from(bytes, (b) => (b < 128 ? visible(String.fromCharCode(b)) : `\\x${b.toString(16).padStart(2, '0')}`)).join('');
  }
  return visible(s);
}

export const visible = (s: string): string => s.replace(/ /g, '␣').replace(/\n/g, '⏎');

/** Python-style repr of a short byte string for code slots, e.g. b' th'. */
export function pyBytes(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) {
    if (b === 39) s += "\\'";
    else if (b === 92) s += '\\\\';
    else if (b === 10) s += '\\n';
    else if (b >= 32 && b < 127) s += String.fromCharCode(b);
    else s += `\\x${b.toString(16).padStart(2, '0')}`;
  }
  return `b'${s}'`;
}

/** Number of UTF-8 bytes for one code point. */
export const utf8Len = (cp: number): number => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);
