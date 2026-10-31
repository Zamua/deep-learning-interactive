import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { cells, rowLabel } from '../../draw';
import type { Ink } from '../../../lecture/scene';
import { after } from '../../draw';
import { block } from '../draw';

const CLS = ['cat', 'dog', 'car'];
/** The teacher's scores for one cat image. */
const S = [4, 2, 0];
const LABEL = [1, 0, 0];
/** The student's probabilities at the same temperature. */
const P = [0.6, 0.2, 0.2];
const soft = (z: number[]) => {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
};
/** The soft targets at T = 2, rounded as the narration reads them. */
const Q = [0.67, 0.24, 0.09];
const f2 = (v: number) => v.toFixed(2);
const nl = (p: number) => -Math.log(p);

/** Who introduced an idea, and when: small, at the top right of the stage, or `y` stage units down. */
function cite(s: Scene, text: string, a: number, y = 5) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, y * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.3) {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });
}

/** One x per class, `gap` stage units apart, nudged right by `shift` to leave room for row labels. */
const groups = (s: Scene, gap: number, shift = 0) => CLS.map((_, i) => s.w / 2 + ((i - 1) * gap + shift) * s.u);

interface Series {
  vals: number[];
  k: Ink;
  a: number;
  /** Prints each value above its bar. */
  fmt?: (v: number) => string;
  /** An outline only, for a reference the bars are compared against. */
  ghost?: boolean;
  /** Which place beside the others it takes; series that cross-fade share one. */
  slot?: number;
}

/** Bars standing on `base`, the series side by side at each x; a value of 1 is `height` stage units tall. */
function grouped(s: Scene, xs: number[], base: number, height: number, series: Series[], bw: number) {
  const u = s.u;
  s.line(xs[0]! - (bw + 6) * u, base, xs[xs.length - 1]! + (bw + 6) * u, base, s.c('--axis'), 0.35);
  const n = Math.max(...series.map((x, i) => (x.ghost ? 0 : (x.slot ?? i) + 1)));
  series.forEach((ser, i) => {
    const off = ser.ghost ? 0 : ((ser.slot ?? i) - (n - 1) / 2) * (bw + 1.4) * u;
    const w = (ser.ghost ? bw + 3 : bw) * u;
    if (ser.a <= 0.003) return;
    s.alpha(ser.a, () =>
      xs.forEach((x, i) => {
        const v = ser.vals[i]!;
        const hh = Math.max(v * height * u, 0.5 * u);
        if (ser.ghost) {
          const c = s.ctx;
          c.save();
          c.setLineDash([1 * u, 0.8 * u]);
          s.rrect(x + off - w / 2, base - hh, w, hh, 0.8, { stroke: s.tint(ser.k, 0.7), lw: 0.3 });
          c.restore();
          return;
        }
        s.rrect(x + off - w / 2, base - hh, w, hh, 0.8, { fill: s.tint(ser.k, 0.38), stroke: s.tint(ser.k, 0.9), lw: 0.3 });
        if (ser.fmt) s.text(ser.fmt(v), x + off, base - hh - 2.8 * u, { size: bw < 10 ? 2.9 : 3.3, font: 'mono', weight: 600, color: s.c(ser.k), halo: true });
      }),
    );
  });
}

function names(s: Scene, xs: number[], y: number) {
  CLS.forEach((c, i) => s.text(c, xs[i]!, y, { size: 3.3, font: 'mono', weight: 600, color: s.c('--ink-2') }));
}

/** A small legend: a swatch and a name per entry, centered on the stage. */
function legend(s: Scene, items: [string, Ink, number][], y: number) {
  const u = s.u;
  const o = { size: 3, font: 'mono', weight: 600 } as const;
  const ws = items.map(([t]) => s.measure(t, o) + 6 * u);
  let x = s.w / 2 - ws.reduce((a, b) => a + b, 0) / 2;
  items.forEach(([t, k, a], i) => {
    s.alpha(a, () => {
      s.rrect(x, y - 1.3 * u, 2.6 * u, 2.6 * u, 0.5, { fill: s.tint(k, 0.38), stroke: s.tint(k, 0.9), lw: 0.3 });
      s.text(t, x + 3.6 * u, y, { ...o, align: 'left', color: s.c(k) });
    });
    x += ws[i]!;
  });
}

// ---- why: a large teacher, a small student, and what the teacher knows beyond the label

const why: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    // The two networks: large and centered at first, then up top once the bars arrive.
    const m = s.ease('label', 0.9);
    const y = lerp(40, 17, m) * u;
    const k = lerp(1.5, 1, m);
    const tx = cx - lerp(24, 20, m) * u;
    const sx = cx + lerp(28, 24, m) * u;
    const tOn = s.ease('teacher', 0.6) * (1 - 0.6 * s.ease('hint', 0.6, 4));
    block(s, tx, y, 28 * k * u, 15 * k * u, 'teacher', 'green', { size: 4 * k, on: tOn });
    s.alpha(after(s, 'big', 0.6), () => block(s, sx, y, 15 * k * u, 7.5 * k * u, 'student', 'teal', { size: 3 * k }));
    const sub = { size: 2.9, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
    s.alpha(after(s, 'big', 0.1), () => s.text('big: accurate, slow', tx, y + (7.5 * k + 3.5) * u, sub));
    s.alpha(after(s, 'big', 0.6), () => s.text('small: fast, cheap', sx, y + (3.75 * k + 3.5) * u, sub));
    s.alpha(s.ease('copy', 0.6, 0.6), () => {
      s.arrow(tx + (14 * k + 1.5) * u, y, sx - (7.5 * k + 1.5) * u, y, s.c('--ink-3'), 0.45, 2);
      s.text('copy', (tx + 14 * k * u + sx - 7.5 * k * u) / 2, y - 3.2 * u, { size: 2.9, font: 'mono', color: s.c('--ink-3'), halo: true });
    });
    cite(s, 'Bucilă, Caruana & Niculescu-Mizil, 2006', s.win('compress', 'label'));
    s.alpha(s.win('compress', 'label') * after(s, 'compress', 0.5), () => caption(s, '1000× smaller and faster, nearly as accurate', s.h * 0.75, 'teal', 3.2));

    // The label and the teacher's probabilities for the same cat.
    const xs = groups(s, s.tall ? 30 : 34);
    const base = s.h * 0.8;
    s.alpha(m, () => {
      grouped(s, xs, base, 33, [
        { vals: LABEL, k: 'gold', a: 1, fmt: (v) => String(v) },
        { vals: soft(S), k: 'green', a: s.ease('teacher', 0.6, 0.4), fmt: f2 },
      ], 8);
      names(s, xs, base + 4 * u);
      legend(s, [['label', 'gold', 1], ['teacher', 'green', s.ease('teacher', 0.6, 0.4)]], s.h * 0.36);
    });
    const hint = s.ease('hint', 0.6);
    s.alpha(hint, () => {
      const o = { size: 2.8, font: 'mono', color: s.c('green'), halo: true } as const;
      s.text('a little', xs[1]!, base + 8.5 * u, o);
      s.text('almost none', xs[2]!, base + 8.5 * u, o);
    });
    s.alpha(s.win('label', 'teacher'), () => caption(s, 'the label: one right answer', s.h * 0.94, 'gold'));
    s.alpha(s.win('teacher', 'hint'), () => caption(s, 'scores [4, 2, 0] → softmax', s.h * 0.94, 'green'));
    s.alpha(after(s, 'hint', 0.3), () => caption(s, 'a BMW: rarely a garbage truck, more rarely a carrot', s.h * 0.94, '--ink-2', 3.1));
    cite(s, 'Hinton, Vinyals & Dean, 2015', after(s, 'hint', 0.25));
  },
};

// ---- soften: divide the teacher's scores by T, and its probabilities flatten

/** The temperature over the scene: 1, then 2; in `higher`, up to 4, down to 0.5, and back to 2. */
function temp(s: Scene): number {
  if (s.since('higher') < 0) return lerp(1, 2, smooth((s.t - s.at('temp') - 0.55 * (s.end('temp') - s.at('temp'))) / 1.2));
  const p = s.prog('higher');
  const up = smooth(p / 0.14);
  const down = smooth((p - 0.42) / 0.14);
  const back = smooth((p - 0.8) / 0.12);
  return 2 + 2 * up - 3.5 * down + 1.5 * back;
}

const fmtT = (v: number) => String(+v.toFixed(1));

const soften: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{q}{q} = \mathrm{softmax}(\syms / \symT)`, x: 0.5, y: 0.08, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    s.show('f', s.ease('temp', 0.6));
    const T = temp(s);
    const q = soft(S.map((v) => v / T));
    const xs = groups(s, s.tall ? 30 : 34);
    const base = s.h * 0.78;
    grouped(s, xs, base, 44, [
      { vals: soft(S), k: 'green', a: s.ease('temp', 0.6, 2.5) * (T > 1.05 ? 1 : 0), ghost: true },
      { vals: q, k: 'green', a: 1, fmt: f2, slot: 0 },
    ], 12);
    names(s, xs, base + 4 * u);
    const row = { size: 3.4, weight: 650 } as const;
    const zs = S.map((v) => fmtT(v / T)).join(', ');
    const rx = s.w / 2;
    const ry = s.h * 0.2;
    s.text(`T = ${fmtT(T)}`, rx - 2 * u, ry, { ...row, font: 'mono', align: 'right', color: s.c('slate') });
    s.text(`s / T = [${zs}]`, rx + 2 * u, ry, { ...row, font: 'mono', align: 'left', color: s.c('purple') });
    s.alpha(s.win('faint', 'temp'), () => {
      s.circle(xs[2]!, base - (q[2]! * 44 + 3) * u, 4.6 * u, { stroke: s.c('red'), lw: 0.4 });
      caption(s, 'car: 0.02, barely there', s.h * 0.93, 'red');
    });
    s.alpha(s.win('temp', 'flat') * after(s, 'temp', 0.6), () => caption(s, 'dashed: the teacher at T = 1', s.h * 0.93, '--ink-3'));
    s.alpha(s.win('flat', 'higher'), () => {
      caption(s, 'cat: 7.39 / (7.39 + 2.72 + 1) = 0.67', s.h * 0.93, 'green', 3.2);
      s.alpha(after(s, 'flat', 0.7), () => s.text('q', xs[2]! + 9 * u, base - 18 * u, { size: 5, font: 'mono', weight: 700, color: s.c('green'), halo: true }));
    });
    const p = s.prog('higher');
    s.alpha(s.since('higher') >= 0 && p < 0.42 ? 1 : 0, () => caption(s, 'higher T: flatter', s.h * 0.93, 'green'));
    s.alpha(s.since('higher') >= 0 && p >= 0.42 && p < 0.8 ? 1 : 0, () => caption(s, 'lower T: sharper', s.h * 0.93, 'slate'));
    s.alpha(s.since('higher') >= 0 && p >= 0.8 && s.since('name') < 0 ? 1 : 0, () => caption(s, 'cat stays on top', s.h * 0.93, '--ink-2'));
    s.alpha(s.ease('name', 0.6), () => caption(s, 'heat draws out the essence', s.h * 0.93, '--ink-2'));
    cite(s, 'Hinton, Vinyals & Dean, 2015', s.ease('name', 0.6), 14);
  },
};

// ---- loss: cross-entropy with the soft targets in place of the label

const loss: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = -\sum_k \sym{q}{q}_k \ln \symp_k`, x: 0.5, y: 0.08, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    const xs = groups(s, s.tall ? 26 : 30, 6);
    const base = s.h * 0.58;
    const lx = xs[0]! - 9 * u;
    // The student's p, which in `best` slides onto q.
    const b = s.ease('best', 1.2, 0.4);
    const p = P.map((v, i) => lerp(v, Q[i]!, b));
    const hard = s.win('hard', 'soft', 0.8);
    grouped(s, xs, base, 34, [
      { vals: LABEL, k: 'gold', a: hard, fmt: (v) => String(v), slot: 0 },
      { vals: Q, k: 'green', a: 1 - hard, fmt: f2, slot: 0 },
      { vals: p, k: 'teal', a: s.ease('p', 0.6, 0.6), fmt: f2, slot: 1 },
    ], 8);
    names(s, xs, base + 4 * u);
    legend(s, [hard > 0.5 ? ['label', 'gold', 1] : ['q: teacher', 'green', 1], ['p: student', 'teal', s.ease('p', 0.6, 0.6)]], s.h * 0.17);

    // −ln p for every class, then each weighted by its target.
    const r1 = s.h * 0.695;
    const r2 = s.h * 0.785;
    const cw = { w: 12, h: 7, size: 3.1 };
    s.alpha(s.ease('hard', 0.6, 1), () => {
      rowLabel(s, '−ln p', lx, r1, 'red', 3.3);
      cells(s, xs, r1, p.map((v) => f2(nl(v))), 'red', cw);
    });
    const wHard = s.ease('hard', 0.6, 3) * (1 - s.ease('soft', 0.6));
    const terms = Q.map((v, i) => v * nl(p[i]!));
    const shown = [s.ease('cat', 0.6, 0.6), s.ease('sum', 0.6, 0.3), s.ease('sum', 0.6, 1.2)];
    s.alpha(Math.max(wHard, shown[0]!), () => rowLabel(s, 'weighted', lx, r2, 'red', 3.3));
    s.alpha(wHard, () => cells(s, xs, r2, [f2(nl(P[0]!)), '0', '0'], 'red', { ...cw, on: [1, 0, 0] }));
    xs.forEach((x, i) => s.alpha(shown[i]!, () => cells(s, [x], r2, [f2(terms[i]!)], 'red', { ...cw, on: [s.win(i === 0 ? 'cat' : 'sum', 'best')] })));

    // The loss itself.
    const ly = s.h * 0.88;
    const o = { size: 3.8, font: 'mono', weight: 650, color: s.c('red'), halo: true } as const;
    s.alpha(s.ease('hard', 0.6, 4) * (1 - s.ease('soft', 0.6)), () => s.text('L = −ln 0.6 ≈ 0.51', s.w / 2, ly, o));
    s.alpha(s.win('sum', 'best') * after(s, 'sum', 0.4), () => s.text('L = 0.34 + 0.39 + 0.14 ≈ 0.87', s.w / 2, ly, o));
    const L = terms.reduce((a, c) => a + c, 0);
    s.alpha(s.ease('best', 0.6), () => s.text(b > 0.98 ? 'p = q: L ≈ 0.83, the lowest' : `L ≈ ${f2(L)}`, s.w / 2, ly, { ...o, color: s.c(b > 0.98 ? 'green' : 'red') }));
    s.alpha(after(s, 'best', 0.5), () => s.text('p = [1, 0, 0]: L = ∞', s.w / 2, s.h * 0.95, { size: 3.3, font: 'mono', color: s.c('--ink-2'), halo: true }));
    s.show('f', s.ease('soft', 0.6, 1.5));
  },
};

export const scenes: Record<string, SceneDef> = { why, soften, loss };
