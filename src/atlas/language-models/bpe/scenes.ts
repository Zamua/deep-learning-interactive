import { lerp, type Scene, type SceneDef } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { bars } from '../../draw';
import { note, rich, spread } from '../draw';

const BYTE: Record<string, number> = { h: 104, u: 117, g: 103, s: 115, p: 112 };
const T0 = ['h', 'u', 'g', 'h', 'u', 'g', 's', 'p', 'u', 'g'];
const T1 = ['h', 'ug', 'h', 'ug', 's', 'p', 'ug'];
const T2 = ['hug', 'hug', 's', 'p', 'ug'];
const ID: Record<string, number> = { ...BYTE, ug: 256, hug: 257 };
/** Which tokens of the row before each token of the next row came from. */
const G1 = [[0], [1, 2], [3], [4, 5], [6], [7], [8, 9]];
const G2 = [[0, 1], [2, 3], [4], [5], [6]];
const P1: [string, number][] = [['(u,g)', 3], ['(h,u)', 2], ['(g,h)', 1], ['(g,s)', 1], ['(s,p)', 1], ['(p,u)', 1]];
const P2: [string, number][] = [['(h,ug)', 2], ['(ug,h)', 1], ['(ug,s)', 1], ['(s,p)', 1], ['(p,ug)', 1]];
/** The text cut three ways, as spans of its ten letters: whole words, BPE after two merges. */
const WORDS: [number, number, string][] = [[0, 2, 'hug'], [3, 6, 'hugs'], [7, 9, 'pug']];
const BPE: [number, number, string][] = [[0, 2, 'hug'], [3, 5, 'hug'], [6, 6, 's'], [7, 7, 'p'], [8, 9, 'ug']];

/** Token cells share one pitch, so a merged row lines up under the row it came from. */
const pitch = (s: Scene) => (s.tall ? 9 : 11.5);
const cw = (s: Scene) => (s.tall ? 7.8 : 8.6);
const CH = 7.5;

/** A token in a cell, `w` stage units wide, with its id underneath. */
function token(s: Scene, x: number, y: number, label: string, w: number, o: { on?: number; id?: number; k?: Color } = {}): void {
  const k = o.k ?? (label.length > 1 ? 'gold' : 'orange');
  s.cell(x - (w / 2) * s.u, y - (CH / 2) * s.u, w * s.u, CH * s.u, label, k, { on: o.on ?? 0, size: 3.2 });
  if (o.id !== undefined) s.text(String(ID[label]), x, y + (CH / 2 + 2.8) * s.u, { size: 2.3, font: 'mono', color: s.c('--ink-3') });
}

/** A row of tokens, or the row before it morphing into it as `t` goes 0 -> 1. */
function row(s: Scene, y: number, toks: string[], o: { on?: (i: number) => number; ids?: number } = {}): number[] {
  const xs = spread(s, toks.length, pitch(s));
  toks.forEach((t, i) => token(s, xs[i]!, y, t, cw(s), { on: o.on?.(i), id: o.ids && o.ids > 0.01 ? 1 : undefined }));
  return xs;
}

/** Tokens drawn as spans over the ten letter slots, so different cuts of the text line up. */
function spans(s: Scene, y: number, cuts: [number, number, string][], k?: Color): void {
  const xs = spread(s, T0.length, pitch(s));
  for (const [a, b, label] of cuts) token(s, (xs[a]! + xs[b]!) / 2, y, label, (b - a) * pitch(s) + cw(s), { k: k ?? (label.length > 1 ? 'gold' : 'orange') });
}

function morph(s: Scene, y: number, from: string[], to: string[], groups: number[][], t: number, ids: boolean): void {
  const a = spread(s, from.length, pitch(s));
  const b = spread(s, to.length, pitch(s));
  const p = pitch(s);
  groups.forEach((g, j) => {
    const x0 = (a[g[0]!]! + a[g[g.length - 1]!]!) / 2;
    const w0 = (g.length - 1) * p + cw(s);
    token(s, lerp(x0, b[j]!, t), y, to[j]!, lerp(w0, cw(s), t), { on: g.length > 1 ? 1 - t * 0.5 : 0, id: ids && t > 0.95 ? 1 : undefined });
  });
}

/** Pair counts as bars, the top one lit. */
function pairBars(s: Scene, pairs: [string, number][], base: number, a: number, top: number): void {
  s.alpha(a, () => {
    const xs = spread(s, pairs.length, s.tall ? 15.5 : 17);
    bars(s, xs, base, pairs.map((p) => p[1]), 'purple', { max: 3, height: s.tall ? 20 : 22, w: 8, grow: a, fmt: (v) => String(v), hi: pairs.map((_, i) => (i === 0 ? top : 0)) });
    pairs.forEach(([l], i) => s.text(l, xs[i]!, base + 3.4 * s.u, { size: 2.7, font: 'mono', weight: 600, color: s.c(i === 0 && top > 0.5 ? 'purple' : '--ink-2') }));
  });
}

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** The 256 byte values as a 32 by 8 grid, the five this text uses lit. */
function byteGrid(s: Scene, top: number) {
  const c = 2;
  const x0 = s.w / 2 - 16 * c * s.u;
  const used = new Set(Object.values(BYTE));
  for (let i = 0; i < 256; i++) {
    const on = used.has(i);
    s.rrect(x0 + (i % 32) * c * s.u, top + Math.floor(i / 32) * c * s.u, c * 0.82 * s.u, c * 0.82 * s.u, 0.35, { fill: s.tint(on ? 'orange' : 'slate', on ? 0.9 : 0.22) });
  }
  note(s, 'the starting vocabulary: 256 tokens, ids 0 to 255', s.w / 2, top + 8 * c * s.u + 3.6 * s.u, '--ink-3', 3);
}

/** Whole words on top, bytes at the bottom, and BPE's cut landing between them. */
const cut: SceneDef = {
  draw(s) {
    const yW = s.h * 0.2;
    const yM = s.h * 0.42;
    const yB = s.h * 0.62;
    const below = (CH / 2 + 4) * s.u;
    const xs = spread(s, T0.length, pitch(s));
    // The uncut text, letter by letter over the slots every cut shares.
    s.alpha(s.win('tokens', 'unk'), () => {
      T0.forEach((l, i) => s.text(l, xs[i]!, yM, { size: 4.6, font: 'mono', weight: 600, color: s.c('--ink-2') }));
      s.alpha(s.ease('tokens', 0.6, 3.5) * (1 - s.ease('words', 0.6)), () => note(s, 'a tokenizer cuts text into tokens', s.w / 2, yM + below, '--ink-3', 3.2));
    });
    s.alpha(s.ease('words', 0.7, 0.6), () => {
      spans(s, yW, WORDS, 'blue');
      note(s, 'whole words: 3 tokens', s.w / 2, yW + below, 'blue', 3.2);
    });
    // A word the vocabulary lacks, then the same word spelled in bytes.
    s.alpha(s.win('unk', 'bytes'), () => {
      token(s, s.w / 2, yM, 'pugs', 4 * pitch(s), { k: 'red' });
      s.text('?', s.w / 2 + (2 * pitch(s) + 3.5) * s.u, yM, { size: 4.6, font: 'mono', weight: 700, color: s.c('red') });
      note(s, 'not in the vocabulary: no token', s.w / 2, yM + below, 'red', 3.2);
    });
    s.alpha(s.win('any', 'long'), () => {
      const px = spread(s, 4, pitch(s));
      ['p', 'u', 'g', 's'].forEach((l, i) => token(s, px[i]!, yM, l, cw(s), { id: 1 }));
    });
    s.alpha(s.ease('bytes', 0.7, 0.4), () => row(s, yB, T0, { ids: 1 }));
    s.alpha(s.ease('bytes', 0.7, 3) * (1 - s.ease('long', 0.5)), () => byteGrid(s, yB + 11 * s.u));
    s.alpha(s.ease('long', 0.6, 0.6), () => note(s, 'bytes: 10 tokens', s.w / 2, yB + 11 * s.u, 'orange', 3.2));
    s.alpha(s.ease('middle', 0.7, 0.8), () => {
      spans(s, yM, BPE);
      note(s, 'BPE: 5 tokens', s.w / 2, yM + below, 'gold', 3.2);
    });
    s.alpha(s.ease('sennrich', 0.6, 2), () => note(s, 'their vocabularies: 30,000 to 50,000 words', s.w / 2, s.h * 0.88, '--ink-2', 3.2));
    cite(s, 'Sennrich, Haddow & Birch, 2016', s.ease('sennrich', 0.6));
  },
};

const count: SceneDef = {
  draw(s) {
    const y = s.h * 0.2;
    const m = s.ease('merge', 1.1, 1.2);
    const join = s.ease('merge', 0.5, 0.4);
    const lit = (i: number) => ([1, 2, 4, 5, 8, 9].includes(i) ? s.win('top', 'merge') : 0);
    s.alpha(1 - join, () => {
      const xs = row(s, y, T0, { on: lit, ids: 1 });
      [1, 4, 8].forEach((i) => {
        const x0 = xs[i]! - (cw(s) / 2 + 0.8) * s.u;
        s.alpha(s.win('top', 'merge') * 0.9, () => s.rrect(x0, y - (CH / 2 + 1) * s.u, (pitch(s) + cw(s) + 1.6) * s.u, (CH + 2) * s.u, 1.6, { stroke: s.c('purple'), lw: 0.45 }));
      });
    });
    s.alpha(join, () => morph(s, y, T0, T1, G1, m, true));
    const base = s.h * 0.74;
    pairBars(s, P1, base, s.ease('pairs', 0.8, 0.4) * (1 - s.ease('merge', 0.6, 1.6)), s.ease('top', 0.6));
    s.alpha(s.ease('pairs', 0.6, 0.4) * (1 - s.ease('merge', 0.6, 1.6)), () => note(s, 'how often each neighboring pair occurs, in order', s.w / 2, s.h * 0.88, '--ink-3', 3));
    s.alpha(s.ease('merge', 0.6, 2.2), () => {
      rich(s, [['u g', 'orange'], ['  →  ', '--ink-3'], ['ug', 'gold'], [' = id 256', '--ink-2']], s.w / 2, s.h * 0.44, { size: 3.8, weight: 600 });
      note(s, 'vocabulary: 256 + 1 = 257 tokens', s.w / 2, s.h * 0.54, '--ink-3', 3.2);
    });
    s.alpha(s.ease('shorter', 0.6), () => rich(s, [['10', '--ink-2'], [' − 3 = ', '--ink-3'], ['7 tokens', 'gold']], s.w / 2, s.h * 0.7, { size: 3.8, weight: 600 }));
    s.alpha(s.win('shorter', 'gage'), () => note(s, 'each replacement: two tokens become one', s.w / 2, s.h * 0.8, '--ink-3', 3.2));
    s.alpha(s.ease('gage', 0.6, 4), () => note(s, 'a pair of bytes, encoded as one', s.w / 2, s.h * 0.8, '--ink-2', 3.2));
    cite(s, 'Philip Gage, 1994', s.ease('gage', 0.6));
  },
};

const repeat: SceneDef = {
  marks: {
    v: { tex: String.raw`V = 256 + k`, x: 0.5, y: 0.5, size: 5.2 },
  },
  draw(s) {
    const y = s.h * 0.2;
    const m = s.ease('hug', 1.1, 0.8);
    const join = s.ease('hug', 0.5, 0.2);
    const lit = (i: number) => (i <= 3 ? s.win('again', 'hug') : 0);
    s.alpha(1 - join, () => {
      const xs = row(s, y, T1, { on: lit, ids: 1 });
      [0, 2].forEach((i) => s.alpha(s.win('again', 'hug') * 0.9, () => s.rrect(xs[i]! - (cw(s) / 2 + 0.8) * s.u, y - (CH / 2 + 1) * s.u, (pitch(s) + cw(s) + 1.6) * s.u, (CH + 2) * s.u, 1.6, { stroke: s.c('purple'), lw: 0.45 })));
    });
    s.alpha(join, () => morph(s, y, T1, T2, G2, m, true));
    const base = s.h * 0.74;
    pairBars(s, P2, base, s.ease('again', 0.8, 0.4) * (1 - s.ease('grow', 0.6)), s.ease('again', 0.6, 1.6));
    s.alpha(s.ease('hug', 0.6, 2) * (1 - s.ease('grow', 0.6)), () => rich(s, [['h ug', 'orange'], ['  →  ', '--ink-3'], ['hug', 'gold'], [' = id 257', '--ink-2'], ['    7 → 5 tokens', '--ink-3']], s.w / 2, s.h * 0.44, { size: 3.4, weight: 600 }));
    // The vocabulary: the bytes, then one new token per merge.
    const voc = s.ease('grow', 0.7) * (1 - s.ease('rows', 0.6));
    s.alpha(voc, () => {
      const xs = spread(s, 3, s.tall ? 30 : 34);
      const yy = s.h * 0.66;
      s.rrect(xs[0]! - 13 * s.u, yy - 4.5 * s.u, 26 * s.u, 9 * s.u, 1.4, { fill: s.tint('orange', 0.12), stroke: s.tint('orange', 0.6), lw: 0.3 });
      s.text('ids 0 to 255', xs[0]!, yy - 0.4 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('orange') });
      note(s, 'the bytes', xs[0]!, yy + 8 * s.u, '--ink-3', 2.8);
      ['ug', 'hug'].forEach((t, i) => {
        s.alpha(s.ease('grow', 0.5, 1.6 + 1.6 * i), () => {
          token(s, xs[i + 1]!, yy, t, 12, { on: 1 });
          note(s, `id ${256 + i}: merge ${i}`, xs[i + 1]!, yy + 8 * s.u, '--ink-3', 2.8);
        });
      });
    });
    s.alpha(s.ease('grow', 0.6, 8) * (1 - s.ease('radford', 0.5)), () => rich(s, [['merge k', '--ink-2'], ['  →  ', '--ink-3'], ['id 256 + k', 'gold']], s.w / 2, s.h * 0.86, { size: 3.4, weight: 600 }));
    s.show('v', s.ease('V', 0.6, 2.5) * (1 - s.ease('rows', 0.6)), { y: 0.45 });
    s.alpha(s.win('radford', 'real'), () => {
      rich(s, [['from bytes: 256', 'orange'], ['   from characters: 130,000+', '--ink-3']], s.w / 2, s.h * 0.86, { size: 3.1, weight: 600 });
    });
    s.alpha(s.ease('real', 0.6, 0.4) * (1 - s.ease('rows', 0.6)), () => {
      rich(s, [['50,000 merges', '--ink-2'], ['  →  ', '--ink-3'], ['50,256 tokens', 'gold']], s.w / 2, s.h * 0.86, { size: 3.4, weight: 600 });
    });
    cite(s, 'Radford et al., OpenAI, 2019', s.win('radford', 'rows'));
    // The embedding table gains one row per new token.
    s.alpha(s.ease('rows', 0.7), () => {
      const labels = ['0', '1', '⋮', '255', '256  ug', '257  hug'];
      const top = s.h * 0.4;
      const rh = 7.2 * s.u;
      const cx = spread(s, 4, 8.5, s.w / 2 + 8 * s.u);
      labels.forEach((l, i) => {
        const yy = top + i * rh;
        const fresh = i >= 4;
        s.alpha(fresh ? s.ease('rows', 0.5, 1 + 0.8 * (i - 4)) : 1, () => {
          s.text(l, cx[0]! - 6 * s.u, yy, { size: 2.8, font: 'mono', weight: fresh ? 650 : 500, align: 'right', color: s.c(fresh ? 'gold' : '--ink-3') });
          if (l !== '⋮') cx.forEach((x) => s.cell(x - 3.8 * s.u, yy - 2.9 * s.u, 7.6 * s.u, 5.8 * s.u, '', fresh ? 'gold' : 'blue', { on: fresh ? 0.8 : 0.1 }));
        });
      });
      note(s, 'E: one row per token', cx[3]! + 5 * s.u, top - 5.5 * s.u, 'blue', 3, 'right');
    });
  },
};

export const scenes: Record<string, SceneDef> = { cut, count, repeat };
