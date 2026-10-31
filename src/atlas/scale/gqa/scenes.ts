import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cite, columns } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { chip } from '../../sequences/draw';
import { line } from '../modern-draw';

const H = 8;

const pitch = (s: Scene) => (s.tall ? 11.5 : 13);

/** Query heads in a row, and `g` key heads and value heads below, each wired to the query heads it serves. */
function heads(s: Scene, g: number, o: { yq: number; yk: number; yv?: number; on?: number; qOn?: number; links?: number }): void {
  const p = pitch(s);
  const xq = columns(s, H, p);
  const per = H / g;
  const xk = Array.from({ length: g }, (_, j) => (xq[j * per]! + xq[(j + 1) * per - 1]!) / 2);
  const w = g === H ? p - 3 : Math.min(per * p - 3, 30);
  s.alpha(o.links ?? 1, () => {
    xq.forEach((x, i) => s.line(x, o.yq + 3.5 * s.u, xk[Math.floor(i / per)]!, o.yk - 3.5 * s.u, s.tint('green', 0.6), 0.3));
    if (o.yv !== undefined) xk.forEach((x) => s.line(x, o.yk + 3.5 * s.u, x, o.yv! - 3.5 * s.u, s.tint('gold', 0.6), 0.3));
  });
  xq.forEach((x, i) => chip(s, x, o.yq, `q${i}`, 'purple', { w: p - 3, h: 7, size: 2.8, on: o.qOn ?? 0 }));
  const kv = o.yv === undefined;
  xk.forEach((x) => chip(s, x, o.yk, kv ? 'k, v' : 'k', 'green', { w, h: 7, size: kv && g === H ? 2.4 : 3, on: o.on ?? 0 }));
  if (!kv) xk.forEach((x) => chip(s, x, o.yv!, 'v', 'gold', { w, h: 7, size: 3, on: o.on ?? 0 }));
}

/** Labels for the three rows, at the left, when the stage has room for them. */
function rowNames(s: Scene, y: { yq: number; yk: number; yv: number }, a = 1) {
  const x = s.w / 2 - (H / 2) * pitch(s) * s.u - 4 * s.u;
  const o = { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') } as const;
  if (x - s.measure('queries', o) < 4 * s.u) return;
  s.alpha(a, () => {
    s.text('queries', x, y.yq, o);
    s.text('keys', x, y.yk, o);
    s.text('values', x, y.yv, o);
  });
}

/** A horizontal bar from the stage's middle-left, `frac` of the full length, with a name and a value. */
function bar(s: Scene, y: number, frac: number, k: Ink, name: string, value: string, a: number) {
  const u = s.u;
  const full = (s.tall ? 48 : 70) * u;
  const x0 = s.w / 2 - full / 2 + (s.tall ? 10 : 6) * u;
  s.alpha(a, () => {
    s.text(name, x0 - 2 * u, y, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-2') });
    s.rrect(x0, y - 2.2 * u, Math.max(0.8 * u, full * frac * a), 4.4 * u, 0.8, { fill: s.tint(k, 0.35), stroke: s.tint(k, 0.8), lw: 0.3 });
    s.text(value, x0 + full * frac + 2 * u, y, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c(k) });
  });
}

// ---- reread: the cache grows with the text, and every new token reads all of it

const TOKS = ['the', 'cat', 'sat', 'on', 'a', 'warm', 'mat'];
const BLOCKS = 3;

const reread: SceneDef = {
  draw(s) {
    const u = s.u;
    const up = s.ease('heads', 0.9);
    const p = s.tall ? 13 : 14;
    const xs = columns(s, TOKS.length, p);
    const shown = Math.min(TOKS.length, 3 + Math.floor(s.prog('gen') * 4.99));
    const last = shown - 1;
    const read = s.prog('read');
    const wy = lerp(s.h * 0.2, s.h * 0.08, up);
    const pitchB = 18 * u;
    const rowY = (b: number) => wy + 9 * u + b * pitchB;
    const x0 = xs[0]! - (p / 2) * u;
    const x1 = xs[TOKS.length - 1]! + (p / 2) * u;
    xs.forEach((x, i) => {
      if (i >= shown) return;
      s.alpha(i === last && i >= 3 ? s.ease('gen', 0.35) : 1, () => s.text(TOKS[i]!, x, wy, { size: 3.2, font: 'mono', weight: 600, color: s.c(i === last ? 'purple' : '--ink-2') }));
    });
    // Every block keeps a key and a value for every token so far.
    for (let b = 0; b < BLOCKS; b++) {
      const y = rowY(b);
      s.alpha(b === 0 ? 1 : (1 - up) * s.ease('gen', 0.6, 1 + b), () => {
        s.rrect(x0, y - 6.5 * u, x1 - x0, 15.5 * u, 1.2, { fill: s.tint('--ink-3', 0.04), stroke: s.tint('--ink-3', 0.4), lw: 0.25 });
        s.text(`block ${b + 1}`, x0 + 1.2 * u, y - 4.6 * u, { size: 2.5, font: 'mono', align: 'left', color: s.c('--ink-3') });
        xs.forEach((x, i) => {
          if (i >= shown) return;
          const lit = i < last && read * last > i ? 1 : 0;
          s.alpha(i === last && i >= 3 ? s.ease('gen', 0.35) : 1, () => {
            chip(s, x, y, 'k', 'green', { w: p - 4, h: 4.6, size: 2.6, on: lit });
            chip(s, x, y + 5.6 * u, 'v', 'gold', { w: p - 4, h: 4.6, size: 2.6, on: lit });
          });
        });
      });
    }
    // The newest token's query, reading every cached key.
    s.alpha(s.win('read', 'heads'), () => {
      const xq = xs[last]!;
      const yq = rowY(BLOCKS - 1) + 17 * u;
      chip(s, xq, yq, 'q', 'purple', { w: p - 4, h: 5, size: 2.8, on: 1 });
      for (let i = 0; i < last; i++) {
        if (read * last <= i) continue;
        s.line(xq, yq - 2.5 * u, xs[i]!, rowY(BLOCKS - 1) + 8.2 * u, s.tint('purple', 0.45), 0.3);
      }
    });
    const ly = s.h * 0.9;
    const sz = s.tall ? 3.2 : 3.6;
    s.alpha(s.win('gen', 'read'), () => line(s, 1, 'the cache: every earlier token\'s k and v', s.w / 2, ly, '--ink-2', { size: sz }));
    s.alpha(s.win('read', 'shazeer'), () => line(s, 1, 'each new token reads it all, every step', s.w / 2, ly, 'purple', { size: sz }));
    s.alpha(s.win('shazeer', 'heads'), () => line(s, 1, 'arithmetic is fast; reading memory is slow', s.w / 2, ly, 'red', { size: s.tall ? 3 : 3.4 }));
    cite(s, 'Shazeer, 2019', s.win('shazeer', 'heads'));
    // One token's share of one block, opened up into its heads.
    s.alpha(up, () => {
      const x = xs[TOKS.length - 1]!;
      const y0 = rowY(0);
      s.rrect(x - (p / 2 - 0.8) * u, y0 - 3.4 * u, (p - 1.6) * u, 12.4 * u, 1.2, { stroke: s.c('--ink-2'), lw: 0.4 });
      const y = { yq: s.h * 0.42, yk: s.h * 0.56, yv: s.h * 0.68 };
      s.line(x, y0 + 9 * u, s.w / 2, y.yq - 5 * u, s.c('--ink-3'), 0.25, [1, 1]);
      heads(s, H, { ...y, on: s.ease('count', 0.6), links: s.ease('heads', 0.6, 0.8) });
      rowNames(s, y);
    });
    line(s, s.win('heads', 'count'), 'h = 8 query heads, each with its own k and v', s.w / 2, s.h * 0.8, '--ink-2', { size: s.tall ? 3 : 3.4 });
    line(s, s.ease('count', 0.6), '2 × 8 × 64 = 1,024 numbers', s.w / 2, s.h * 0.8, 'teal', { size: s.tall ? 3.6 : 3.8, font: 'mono', weight: 650 });
    line(s, s.ease('count', 0.6, 1.5), 'per token, per block', s.w / 2, s.h * 0.88, '--ink-3', { size: 3.2 });
  },
};

// ---- mqa: all the query heads share one key head and one value head

const mqa: SceneDef = {
  draw(s) {
    const y = { yq: s.h * 0.16, yk: s.h * 0.34, yv: s.h * 0.47 };
    const m = s.ease('mqa', 0.9);
    s.alpha(1 - m, () => heads(s, H, { ...y, qOn: s.win('ask', 'mqa') }));
    s.alpha(m, () => heads(s, 1, { ...y, on: s.ease('small', 0.6) }));
    rowNames(s, y);
    cite(s, 'Shazeer, 2019: multi-query attention', 1);
    const sz = s.tall ? 3.2 : 3.6;
    line(s, s.win('ask', 'mqa'), 'own queries: each head looks for its own thing', s.w / 2, s.h * 0.6, 'purple', { size: s.tall ? 3 : 3.4 });
    line(s, s.win('mqa', 'small'), 'many queries, one key and value', s.w / 2, s.h * 0.6, 'green', { size: sz, weight: 600 });
    line(s, s.ease('small', 0.6), '2 × 1 × 64 = 128 numbers: 8 times fewer', s.w / 2, s.h * 0.6, 'teal', { size: s.tall ? 3.2 : 3.6, font: 'mono', weight: 650 });
    bar(s, s.h * 0.7, 1, 'red', 'multi-head', '1,024', s.ease('small', 0.6, 0.8));
    bar(s, s.h * 0.78, 128 / 1024, 'green', 'multi-query', '128', s.ease('small', 0.6, 1.4));
    line(s, s.ease('fast', 0.6), 'each new token: over 10× faster', s.w / 2, s.h * 0.87, '--ink-2', { size: sz });
    line(s, s.ease('fast', 0.6, 1.2), 'with a minor loss in quality', s.w / 2, s.h * 0.93, '--ink-3', { size: s.tall ? 3 : 3.2 });
  },
};

// ---- groups: g key-value heads, each shared by a group of query heads

/** Brackets over each group of query heads. */
function brackets(s: Scene, g: number, yq: number, a: number) {
  const xq = columns(s, H, pitch(s));
  const per = H / g;
  s.alpha(a, () => {
    for (let j = 0; j < g; j++) {
      const l = xq[j * per]! - 4.5 * s.u;
      const r = xq[(j + 1) * per - 1]! + 4.5 * s.u;
      const yb = yq - 6 * s.u;
      s.line(l, yb + 1.2 * s.u, l, yb, s.c('--ink-3'), 0.3);
      s.line(l, yb, r, yb, s.c('--ink-3'), 0.3);
      s.line(r, yb, r, yb + 1.2 * s.u, s.c('--ink-3'), 0.3);
      s.text(`group of ${per}`, (l + r) / 2, yb - 3 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    }
  });
}

const groups: SceneDef = {
  draw(s) {
    const u = s.u;
    const y = { yq: s.h * 0.2, yk: s.h * 0.38, yv: s.h * 0.51 };
    const g2 = s.ease('group', 0.9);
    const three = s.ease('ends', 0.7);
    s.alpha(1 - three, () => {
      s.alpha(1 - g2, () => heads(s, 1, y));
      s.alpha(g2, () => heads(s, 2, { ...y, on: s.ease('shrink', 0.6) }));
      brackets(s, 2, y.yq, s.ease('group', 0.6, 1.5));
      rowNames(s, y);
      const sz = s.tall ? 3.2 : 3.6;
      line(s, s.win('cost', 'group'), 'one shared head can cost quality', s.w / 2, s.h * 0.65, 'red', { size: sz });
      s.alpha(s.win('cost', 'group'), () => line(s, s.ease('cost', 0.6, 2), 'a middle way: grouped-query attention, GQA', s.w / 2, s.h * 0.73, 'green', { size: s.tall ? 3 : 3.4, weight: 600 }));
      line(s, s.win('group', 'attend'), 'g = 2 key-value heads, 4 query heads each', s.w / 2, s.h * 0.65, 'green', { size: s.tall ? 3 : 3.4 });
      line(s, s.win('attend', 'shape'), 'own scores, its group\'s keys and values', s.w / 2, s.h * 0.65, '--ink-2', { size: s.tall ? 3 : 3.4 });
      s.alpha(s.win('shape', 'shrink'), () => {
        const o = { size: s.tall ? 3 : 3.4, weight: 600 };
        rich(s, [['queries ', '--ink-3'], ['(8, T, 64)', 'purple']], s.w / 2, s.h * 0.65, o);
        s.alpha(s.ease('shape', 0.6, 2.5), () => rich(s, [['keys ', '--ink-3'], ['(2, T, 64)', 'green'], ['  values ', '--ink-3'], ['(2, T, 64)', 'gold']], s.w / 2, s.h * 0.72, o));
      });
      line(s, s.ease('shrink', 0.6), '2 × 2 × 64 = 256 numbers', s.w / 2, s.h * 0.66, 'teal', { size: s.tall ? 3.6 : 3.8, font: 'mono', weight: 650 });
      line(s, s.ease('shrink', 0.6, 2.5), 'h / g = 8 / 2: four times fewer', s.w / 2, s.h * 0.74, 'green', { size: sz, weight: 600 });
    });
    // g from 8 down to 1, with grouped-query in between.
    const rows: [number, string, Ink][] = [
      [H, 'g = h = 8: multi-head', '--ink-2'],
      [2, 'g = 2: grouped-query', 'green'],
      [1, 'g = 1: multi-query', '--ink-2'],
    ];
    s.alpha(three, () => {
      rows.forEach(([g, label, k], r) => {
        const y0 = s.h * (0.12 + r * 0.27);
        s.alpha(s.ease('ends', 0.6, 0.6 * r), () => {
          s.text(label, s.w / 2, y0, { size: 3.4, font: 'mono', weight: 600, color: s.c(k) });
          heads(s, g, { yq: y0 + 6.5 * u, yk: y0 + 15 * u, on: g === 2 ? s.ease('paper', 0.6) : 0 });
        });
      });
    });
    line(s, s.ease('paper', 0.6, 0.6), 'quality near multi-head, speed near multi-query', s.w / 2, s.h * 0.93, 'green', { size: s.tall ? 2.9 : 3.4 });
    cite(s, 'Ainslie et al., 2023', Math.max(s.win('cost', 'attend'), s.ease('paper', 0.6)));
  },
};

// ---- model: the cache per token across all layers, in bytes and KB

/** The worked numbers, one line per beat: a label and its value. */
const STEPS: { beat: string; delay: number; label: string; value: string; k: Ink }[] = [
  { beat: 'all', delay: 0, label: 'one layer', value: '2 × 2 × 64 = 256', k: 'green' },
  { beat: 'all', delay: 2.5, label: '32 layers', value: '32 × 256 = 8,192', k: 'teal' },
  { beat: 'bytes', delay: 0, label: 'bytes', value: '8,192 × 2 = 16,384', k: 'gold' },
  { beat: 'kb', delay: 0, label: 'KB', value: '16,384 ÷ 1,024 = 16', k: 'red' },
];

const model: SceneDef = {
  draw(s) {
    const sz = s.tall ? 3.2 : 3.6;
    line(s, s.ease('p', 0.6), '32 layers,  h = 8,  g = 2', s.w / 2, s.h * 0.08, '--ink-2', { size: sz, font: 'mono', weight: 600 });
    line(s, s.ease('p', 0.6, 1.5), 'each head 64 wide', s.w / 2, s.h * 0.15, '--ink-2', { size: sz, font: 'mono', weight: 600 });
    line(s, s.ease('kb', 0.6), '1 KB = 1,024 bytes', s.w / 2, s.h * 0.22, '--ink-3', { size: s.tall ? 2.9 : 3.2, font: 'mono' });
    const lx = s.w / 2 - (s.tall ? 12 : 16) * s.u;
    STEPS.forEach((st, i) => {
      const y = s.h * (0.32 + i * 0.09);
      s.alpha(s.ease(st.beat, 0.6, st.delay), () => {
        s.text(st.label, lx - 2 * s.u, y, { size: sz, font: 'mono', weight: 650, align: 'right', color: s.c(st.k) });
        s.text(st.value, lx + 2 * s.u, y, { size: sz, font: 'mono', align: 'left', color: s.c('--ink') });
      });
    });
    bar(s, s.h * 0.75, 1, 'red', 'multi-head', '64 KB', s.ease('mha', 0.6));
    bar(s, s.h * 0.84, 0.25, 'green', 'grouped', '16 KB', s.ease('mha', 0.6, 0.6));
    line(s, s.ease('mha', 0.6, 1.4), 'per token', s.w / 2, s.h * 0.92, '--ink-3', { size: 3.2 });
  },
};

export const scenes: Record<string, SceneDef> = { reread, mqa, groups, model };
