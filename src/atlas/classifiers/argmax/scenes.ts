import { clamp01, type Ink, lerp, type Scene, type SceneDef } from '../../../lecture/scene';
import { after } from '../../draw';
import { cells, columns, rowLabel } from '../../draw';

const S = [2, 7, 1, 5];
const NAMES = ['cat', 'dog', 'bird', 'fish'];
const TOP = S.indexOf(Math.max(...S));
const LOW = S.indexOf(Math.min(...S));

interface Board {
  /** 0..1: the bars standing up. */
  grow: number;
  /** 0..1: the scores lifting off the bars into the row s. */
  lift: number;
  /** 0..1 per entry: how lit each bar and score is, and in which color. */
  hi: number[];
  hiK: Ink[];
  /** 0..1: the positions under the names; `ring` circles one of them. */
  pos: number;
  ring: number;
  ringAt: number;
  /** 0..1 per entry: how lit each name is. */
  name: number[];
}

/** Four answers as bars, their scores as the vector s above them, names and positions below. */
function board(s: Scene, o: Board) {
  const xs = columns(s, S.length, s.tall ? 22 : 24);
  const rowY = s.h * 0.2;
  const base = s.h * 0.68;
  const tall = (base - rowY) / s.u - 15;
  const barW = 11;
  const landed = clamp01((o.lift - 0.85) / 0.15);
  s.line(xs[0]! - barW * s.u, base, xs[xs.length - 1]! + barW * s.u, base, s.c('--axis'), 0.35);
  S.forEach((v, i) => {
    const hh = (v / 7) * tall * s.u * o.grow;
    const hi = o.hi[i] ?? 0;
    const k = o.hiK[i] ?? 'purple';
    const a = 0.5 + 0.5 * hi;
    s.rrect(xs[i]! - (barW / 2) * s.u, base - hh, barW * s.u, Math.max(hh, 0.6 * s.u), 1, { fill: s.tint(k, 0.3 * a + 0.12), stroke: s.tint(k, a), lw: 0.3 + 0.25 * hi });
    // The score rides on its bar, then lifts into the row above.
    const ty = lerp(base - hh - 3.4 * s.u, rowY, o.lift);
    s.alpha(o.grow * (1 - landed), () => s.text(String(v), xs[i]!, ty, { size: 3.8, font: 'mono', weight: 650, color: s.c(k), halo: true }));
  });
  s.alpha(landed, () => {
    rowLabel(s, 's', xs[0]! - 12 * s.u, rowY, 'purple');
    cells(s, xs, rowY, S.map(String), 'purple', { w: 11, h: 8.5, on: o.hi });
  });
  const ny = base + 4.8 * s.u;
  const py = ny + 6.4 * s.u;
  xs.forEach((x, i) => {
    const n = o.name[i] ?? 0;
    s.text(NAMES[i]!, x, ny, { size: 3.5, font: 'mono', weight: 500 + 200 * n, color: n > 0.5 ? s.c('gold') : s.c('--ink-2') });
    s.alpha(o.pos, () => {
      const r = i === o.ringAt ? o.ring : 0;
      if (r > 0.01) s.circle(x, py, 3.3 * s.u * Math.min(1, r * 1.5), { stroke: s.tint('gold', r), lw: 0.45 });
      s.text(String(i), x, py, { size: 3.6, font: 'mono', weight: 500 + 200 * r, color: r > 0.5 ? s.c('gold') : s.c('--ink-3') });
    });
  });
  s.alpha(o.pos, () => rowLabel(s, 'position', xs[0]! - 5 * s.u, py, '--ink-3', 3));
  return { xs, rowY, base, ny, py };
}

/** One line under the board, centered. */
function caption(s: Scene, text: string, a: number, k: Ink = '--ink-2', size = 3.8) {
  s.alpha(a, () => s.text(text, s.w / 2, s.h * 0.93, { size, font: 'mono', weight: 650, color: s.c(k), halo: true }));
}

const off = S.map(() => 0);
const purple = S.map((): Ink => 'purple');

const pick: SceneDef = {
  draw(s) {
    const top = s.ease('pick', 0.7, 1.2);
    board(s, {
      grow: s.ease('score', 1.2, 0.8),
      lift: s.ease('vector', 1, 1),
      hi: S.map((_, i) => (i === TOP ? top : 0)),
      hiK: purple,
      pos: 0,
      ring: 0,
      ringAt: TOP,
      name: S.map((_, i) => (i === TOP ? top : 0)),
    });
    s.alpha(1 - s.ease('vector', 0.6, 1), () => s.text('which animal is in the photo?', s.w / 2, s.h * 0.08, { size: 3.8, font: 'mono', weight: 650, color: s.c('--ink-2'), halo: true }));
    caption(s, 'four possible answers', s.win('ask', 'score'));
    caption(s, 'a score per answer: higher, more favored', s.win('score', 'vector'), 'purple', 3.4);
    caption(s, 's = [2, 7, 1, 5]', s.win('vector', 'pick'), 'purple');
    caption(s, 'pick the highest score', s.ease('pick', 0.6), 'gold');
  },
};

const where: SceneDef = {
  marks: { sub: { tex: String.raw`\syms_1 = 7`, x: 0.5, y: 0.93, size: 5 } },
  draw(s) {
    const mx = s.ease('max', 0.6) * (1 - s.ease('min', 0.6));
    const ring = s.ease('index', 0.6, 1.2) * (1 - s.ease('min', 0.6));
    const named = s.ease('answer', 0.6, 0.6) * (1 - s.ease('min', 0.6));
    const lo = s.ease('min', 0.6, 0.6);
    board(s, {
      grow: 1,
      lift: 1,
      hi: S.map((_, i) => (i === TOP ? mx : i === LOW ? lo : 0)),
      hiK: S.map((_, i): Ink => (i === LOW && lo > 0.01 ? 'teal' : 'purple')),
      pos: s.ease('which', 0.6, 1.4),
      ring: Math.max(ring, lo),
      ringAt: lo > 0.01 ? LOW : TOP,
      name: S.map((_, i) => (i === TOP ? named : i === LOW ? lo : 0)),
    });
    caption(s, 'max = 7: how high', s.win('max', 'which'), 'purple');
    caption(s, 'which answer?', s.win('which', 'index'));
    caption(s, '7 is at position 1', s.win('index', 'sub'), 'gold');
    s.show('sub', s.win('sub', 'name'));
    caption(s, 'argmax = 1: where the max is', s.win('name', 'answer'), 'gold');
    caption(s, 'position 1: dog', s.win('answer', 'min'), 'gold');
    caption(s, 'argmin = 2: the lowest, bird', s.ease('min', 0.6), 'teal');
  },
};

const ROWS = [
  [2, 7, 1],
  [4, 0, 3],
  [1, 2, 6],
  [5, 3, 0],
];
const Y = [1, 2, 2, 0];
const PRED = ROWS.map((r) => r.indexOf(Math.max(...r)));
const RIGHT = PRED.filter((p, i) => p === Y[i]).length;

const accuracy: SceneDef = {
  draw(s) {
    const g = s.tall ? 11 : 12;
    const left = s.w / 2 - ((2 * g + 51) / 2 - 4.75) * s.u;
    const sx = [0, 1, 2].map((i) => left + i * g * s.u);
    const px = left + (2 * g + 18) * s.u;
    const yx = px + 15 * s.u;
    const vx = yx + 11 * s.u;
    const ys = [0.3, 0.43, 0.56, 0.69].map((f) => s.h * f);
    const hy = s.h * 0.16;
    const row = (i: number) => s.ease('rows', 0.5, 1.2 + 0.7 * i);
    const yIn = s.ease('y', 0.6);
    // The first row's pick lands while the voice reads it; the rest follow at the end of the beat.
    const pred = (i: number) => (i === 0 ? after(s, 'pred', 0.4, 0.6) : after(s, 'pred', 0.78 + 0.06 * i));
    const cmp = (i: number) => s.ease('compare', 0.5, 1.2 + 0.4 * i);
    const head = { size: 3.4, font: 'mono', weight: 650 } as const;
    s.text('scores', sx[1]!, hy, { ...head, color: s.c('purple') });
    s.alpha(yIn, () => s.text('y', yx, hy, { ...head, color: s.c('gold') }));
    s.alpha(s.ease('pred', 0.6), () => s.text('argmax', px, hy, { ...head, color: s.c('--ink-2') }));
    const band = s.win('rows', 'y');
    ROWS.forEach((r, i) => {
      const y = ys[i]!;
      s.alpha(row(i), () => {
        s.alpha(band, () => {
          const x0 = sx[0]! - 6.6 * s.u;
          s.rrect(x0, y - 5.6 * s.u, sx[2]! + 6.6 * s.u - x0, 11.2 * s.u, 1.6, { fill: s.tint('purple', 0.06), stroke: s.tint('purple', 0.45), lw: 0.3 });
          s.text(`row ${i}`, x0 - 2 * s.u, y, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
        });
        cells(s, sx, y, r.map(String), 'purple', { w: 9.5, h: 8, on: r.map((_, j) => (j === PRED[i] ? pred(i) : 0)) });
      });
      s.alpha(yIn * Math.min(1, s.ease('y', 0.4, 0.5 + 0.3 * i)), () => cells(s, [yx], y, [String(Y[i])], 'gold', { w: 8, h: 8, on: [cmp(i) * (1 - s.ease('acc', 0.6))] }));
      s.alpha(pred(i), () => cells(s, [px], y, [String(PRED[i])], '--ink-2', { w: 8, h: 8 }));
      s.alpha(cmp(i), () => s.text(PRED[i] === Y[i] ? '✓' : '✗', vx, y, { size: 4.4, font: 'ui', weight: 700, color: s.c(PRED[i] === Y[i] ? 'green' : 'red') }));
    });
    const cy = s.h * 0.86;
    s.alpha(s.win('compare', 'acc'), () => s.text(`${RIGHT} of 4 picks match y`, s.w / 2, cy, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    s.alpha(s.ease('acc', 0.6), () => s.text(`accuracy: ${RIGHT} / 4 = 0.75`, s.w / 2, cy, { size: 4.4, font: 'mono', weight: 650, color: s.c('green') }));
  },
};

export const scenes: Record<string, SceneDef> = { pick, where, accuracy };
