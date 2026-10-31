import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { rich, volume } from '../draw';

const label = (s: Scene, t: string, x: number, y: number, k: Ink = '--ink-2', size = 3.2) => s.text(t, x, y, { size, font: 'mono', weight: 600, color: s.c(k), halo: true });

// ---- the picture: sky, a tree and the ground, 32 by 32 squares standing for 64 by 64 pixels

const N = 32;
const CLASS: Ink[] = ['blue', 'green', 'gold'];
const NAMES = ['sky', 'tree', 'ground'];
/** 0 sky, 1 tree, 2 ground. */
const LABELS = Array.from({ length: N }, (_, i) =>
  Array.from({ length: N }, (_, j) => {
    if (i >= 24) return 2;
    if (Math.hypot(i - 11, (j - 12) * 0.95) < 7.2) return 1;
    if (i >= 16 && j >= 11 && j <= 13) return 1;
    return 0;
  }),
);
/** Brightness jitter, so the picture reads as a photo and not as labels. */
const SHADE = LABELS.map((r, i) => r.map((_, j) => 0.2 + 0.22 * ((Math.sin(i * 1.7 + j * 2.3) * Math.cos(j * 0.9 - i * 0.4) + 1) / 2)));

/** The picture (or its flat label map) as a square `side` stage units wide, centered on (cx, cy). */
function picture(s: Scene, cx: number, cy: number, side: number, image: boolean) {
  const p = (side / N) * s.u;
  const l = cx - (side * s.u) / 2;
  const t = cy - (side * s.u) / 2;
  const g = s.ctx;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      g.fillStyle = s.tint(CLASS[LABELS[i]![j]!]!, image ? SHADE[i]![j]! : 0.55);
      g.fillRect(l + j * p, t + i * p, p + 0.4, p + 0.4);
    }
  return { l, t, p };
}

const pixels: SceneDef = {
  draw(s) {
    const u = s.u;
    const side = 30;
    const y1 = s.h * 0.27;
    const xa = s.w / 2 - 24 * u;
    const xb = s.w / 2 + 24 * u;
    const img = picture(s, xa, y1, side, true);
    label(s, 'image', xa, y1 + (side / 2 + 4) * u);

    // One label for the whole image, then a label for every pixel.
    s.arrow(xa + (side / 2 + 2.5) * u, y1, xb - (side / 2 + 2.5) * u, y1, s.c('--ink-3'), 0.4, 2.2);
    const map = s.ease('every', 0.8, 1);
    s.alpha(s.ease('one', 0.6, 0.6) * (1 - map), () => {
      s.text('tree', xb, y1, { size: 6, font: 'mono', weight: 650, color: s.c('green') });
      label(s, 'one label', xb, y1 + (side / 2 + 4) * u);
    });
    s.alpha(map, () => {
      picture(s, xb, y1, side, false);
      rich(s, [['sky', 'blue'], [' · ', '--ink-3'], ['tree', 'green'], [' · ', '--ink-3'], ['ground', 'gold']], xb, y1 + (side / 2 + 4) * u, { size: 3.2, weight: 600 });
    });

    // The network: shrink, then grow back.
    const y2 = s.h * 0.69;
    const big = 15 * u;
    const small = 6 * u;
    const xs = [s.w / 2 - 36 * u, s.w / 2 - 3 * u, s.w / 2 + 26 * u];
    const RGB: Ink[] = ['red', 'green', 'blue'];
    const ly = y2 + big / 2 + 4.5 * u;
    s.alpha(s.ease('shrink', 0.6), () => {
      volume(s, xs[0]! - big / 2, y2 - big / 2, big, 3, (l) => RGB[l]!, { step: 1.2 });
      label(s, '(3, 64, 64)', xs[0]! + 1 * u, ly);
    });
    const sB = after(s, 'shrink', 0.5, 0.8);
    const deep = s.win('deep', 'fcn');
    s.alpha(sB, () => {
      s.arrow(xs[0]! + big / 2 + 4 * u, y2, xs[1]! - small / 2 - 3 * u, y2, s.c('--ink-3'), 0.4, 2.2);
      label(s, 'shrink', (xs[0]! + xs[1]!) / 2 + 2 * u, y2 - 4 * u, '--ink-3', 2.8);
      const layers = Math.round(lerp(3, 12, s.ease('deep', 1)));
      volume(s, xs[1]! - small / 2, y2 - small / 2, small, layers, () => 'purple', { step: 0.7 });
      s.alpha(1 - s.ease('deep', 0.4), () => label(s, '8 × 8', xs[1]! + 3 * u, ly, 'purple'));
      s.alpha(s.ease('deep', 0.6), () => label(s, '(256, 8, 8)', xs[1]! + 3 * u, ly, 'purple'));
    });

    // Each cell of the 8 by 8 grid stands for an 8 by 8 patch of pixels.
    s.alpha(deep, () => {
      const g = s.ctx;
      g.strokeStyle = s.tint('--ink', 0.35);
      g.lineWidth = 0.18 * u;
      for (let k = 1; k < 8; k++) {
        const o = k * 4 * img.p;
        g.beginPath();
        g.moveTo(img.l + o, img.t);
        g.lineTo(img.l + o, img.t + N * img.p);
        g.moveTo(img.l, img.t + o);
        g.lineTo(img.l + N * img.p, img.t + o);
        g.stroke();
      }
      const c = 4 * img.p;
      s.rrect(img.l + 2 * c, img.t + 2 * c, c, c, 0.3, { stroke: s.c('orange'), lw: 0.55 });
      const fc = small / 8;
      const fx = xs[1]! - small / 2 + 2 * fc;
      const fy = y2 - small / 2 + 2 * fc;
      s.rrect(fx, fy, fc, fc, 0.1, { fill: s.c('orange') });
      s.line(img.l + 2.5 * c, img.t + 3 * c, fx + fc / 2, fy, s.tint('orange', 0.8), 0.3, [1, 1]);
    });
    s.alpha(deep, () => label(s, '1 cell = 8 × 8 pixels', s.w / 2, s.h * 0.93, 'orange', 3.3));

    // Upsampling grows the grid back: C scores at every pixel.
    const gA = after(s, 'fcn', 0.45, 0.8);
    s.alpha(gA, () => {
      s.arrow(xs[1]! + small / 2 + 10 * u, y2, xs[2]! - big / 2 - 3 * u, y2, s.c('--ink-3'), 0.4, 2.2);
      label(s, 'grow', (xs[1]! + xs[2]!) / 2 + 3 * u, y2 - 4 * u, '--ink-3', 2.8);
      volume(s, xs[2]! - big / 2, y2 - big / 2, big, 3, (l) => CLASS[l]!, { step: 1.2, on: () => s.win('grow', 'argmax') });
    });
    s.alpha(s.win('fcn', 'grow'), () => label(s, 'upsampling', s.w / 2, s.h * 0.93, '--ink-2', 3.3));
    s.alpha(s.ease('grow', 0.6), () => label(s, '(C, 64, 64)', xs[2]! + 2 * u, ly, 'gold'));
    s.alpha(s.win('grow', 'argmax'), () => label(s, 'C scores at every pixel', s.w / 2, s.h * 0.93, 'gold', 3.3));
    s.alpha(s.ease('argmax', 0.6), () => {
      label(s, 'label = the class with the top score', s.w / 2, s.h * 0.93, '--ink-2', 3.2);
      s.rrect(xb - (side / 2 + 1) * u, y1 - (side / 2 + 1) * u, (side + 2) * u, (side + 2) * u, 1, { stroke: s.c('gold'), lw: 0.5 });
    });
    cite(s, 'Long, Shelhamer & Darrell, 2015', s.ease('fcn', 0.6));
  },
};

// ---- the stamps: three inputs, the filter [1, 2, 1], stride 2

const X = [1, 2, 3];
const W = [1, 2, 1];
const S = 2;
const OUT = [1, 2, 3, 4, 5, 6, 3];
const NOUT = OUT.length;

/** Output positions, `pitch` stage units apart, centered on the stage. */
const slots = (s: Scene, pitch: number) => Array.from({ length: NOUT }, (_, j) => s.w / 2 + (j - (NOUT - 1) / 2) * pitch * s.u);

const stamp: SceneDef = {
  draw(s) {
    const pitch = s.tall ? 12.5 : 12;
    const xs = slots(s, pitch);
    const cw = (pitch - 1.6) * s.u;
    const ys = { head: s.h * 0.08, x: s.h * 0.2, st: [s.h * 0.38, s.h * 0.5, s.h * 0.62], out: s.h * 0.82 };
    // The filter from the start; the stride once it is named.
    const ho = { size: 3.4, font: 'mono', weight: 650 } as const;
    const wW = s.measure('w = [1, 2, 1]', ho);
    const wS = s.measure('    S = 2', ho);
    const hl = s.w / 2 - (wW + wS) / 2;
    s.text('w = [1, 2, 1]', hl, ys.head, { ...ho, align: 'left', color: s.c('blue') });
    s.alpha(s.ease('next', 0.6), () => s.text('    S = 2', hl + wW, ys.head, { ...ho, align: 'left', color: s.c('slate') }));
    const reveal = [after(s, 'first', 0.35), after(s, 'next', 0.55), after(s, 'all', 0.05)];
    X.forEach((v, i) => {
      const cx = xs[S * i + 1]!;
      s.cell(cx - cw / 2, ys.x - 4 * s.u, cw, 8 * s.u, String(v), 'orange', { on: reveal[i]! * (1 - s.ease('all', 0.5, 2.5)), size: 3.6 });
      s.alpha(reveal[i]!, () => {
        s.arrow(cx, ys.x + 5 * s.u, cx, ys.st[i]! - 5 * s.u, s.c('--ink-3'), 0.35, 2);
        W.forEach((wk, k) => {
          const j = S * i + k;
          const hot = j === 2 && i < 2 ? s.win('add', 'all') : j === 4 ? after(s, 'all', 0.3) * (1 - s.ease('all', 0.5, 3)) : 0;
          s.cell(xs[j]! - cw / 2, ys.st[i]! - 3.6 * s.u, cw, 7.2 * s.u, String(v * wk), 'orange', { on: hot, size: 3.4 });
        });
      });
    });
    // The step between stamp starts.
    s.alpha(s.win('next', 'add') * after(s, 'next', 0.3), () => {
      const y = ys.st[1]!;
      s.arrow(xs[0]! - cw / 2, y, xs[2]! - cw / 2 - 0.6 * s.u, y, s.c('slate'), 0.4, 1.8);
      label(s, 'S = 2', xs[1]! - cw / 2, y - 3.2 * s.u, 'slate', 3);
    });
    s.text('x', xs[0]! - 3 * s.u, ys.x, { size: 4, font: 'mono', weight: 650, color: s.c('orange') });
    xs.forEach((x, j) => s.text(String(j), x, ys.out + 7.5 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
    const shown = (j: number) => (j <= 2 ? after(s, 'add', 0.55) : after(s, 'all', 0.55));
    OUT.forEach((v, j) => {
      const a = shown(j);
      s.cell(xs[j]! - cw / 2, ys.out - 4 * s.u, cw, 8 * s.u, a > 0.5 ? String(v) : '', 'gold', { on: a * (j === 2 ? s.win('add', 'all') : 0), size: 3.6 });
    });
    s.alpha(after(s, 'all', 0.85), () => label(s, '3 in, 7 out', s.w / 2, ys.out + 13 * s.u, '--ink-2', 3.2));
  },
};

// ---- why "transposed": the same wiring run backwards, and the convolution's matrix turned

/** The convolution of 7 inputs with [1, 2, 1] at stride 2, as a 3 by 7 matrix. */
const M = [0, 1, 2].map((i) => Array.from({ length: NOUT }, (_, j) => (j >= S * i && j < S * i + 3 ? W[j - S * i]! : 0)));

const name: SceneDef = {
  draw(s) {
    const u = s.u;
    // The wiring: seven positions above, three below, each lower one tied to a patch of three.
    const wire = 1 - s.ease('matrix', 0.6);
    const pitch = s.tall ? 12.5 : 12;
    const xs = slots(s, pitch);
    const cw = (pitch - 1.6) * u;
    const yTop = s.h * 0.2;
    const yBot = s.h * 0.62;
    const back = s.ease('spread', 0.8);
    const lo = [1, 3, 5].map((j) => xs[j]!);
    s.alpha(wire, () => {
      [0, 1, 2].forEach((i) =>
        W.forEach((wk, k) => {
          const j = S * i + k;
          const [ax, ay, bx, by] = [xs[j]!, yTop + 4.6 * u, lo[i]!, yBot - 4.6 * u];
          const col = s.tint('blue', 0.75);
          // Down while it gathers, up once the wiring is reversed.
          s.alpha(1 - back, () => s.arrow(ax, ay, bx, by, col, 0.3 + 0.12 * wk, 1.8));
          s.alpha(back, () => s.arrow(bx, by, ax, ay, col, 0.3 + 0.12 * wk, 1.8));
          const f = 0.3;
          s.text(String(wk), lerp(ax, bx, f) + (k === 1 ? 1.6 * u : 0), lerp(ay, by, f), { size: 2.6, font: 'mono', weight: 650, color: s.c('blue'), halo: true });
        }),
      );
      xs.forEach((x, j) => s.cell(x - cw / 2, yTop - 4 * u, cw, 8 * u, back > 0.5 ? String(OUT[j]) : '', back > 0.5 ? 'gold' : 'slate', { size: 3.4 }));
      lo.forEach((x, i) => s.cell(x - cw / 2, yBot - 4 * u, cw, 8 * u, back > 0.5 ? String(X[i]) : '', back > 0.5 ? 'orange' : 'slate', { size: 3.4 }));
      const side = { size: 3, font: 'mono', weight: 600, align: 'right', halo: true } as const;
      s.text(back > 0.5 ? 'out' : 'in', xs[0]! - cw / 2 - 1.5 * u, yTop, { ...side, color: s.c('--ink-3') });
      s.text(back > 0.5 ? 'x' : 'out', lo[0]! - cw / 2 - 1.5 * u, yBot, { ...side, color: s.c(back > 0.5 ? 'orange' : '--ink-3') });
      const cy = s.h * 0.82;
      s.alpha(s.win('gather', 'spread'), () => label(s, 'convolution: 7 in, 3 out', s.w / 2, cy, '--ink-2', 3.3));
      s.alpha(back, () => label(s, 'reversed: 3 in, 7 out', s.w / 2, cy, 'gold', 3.3));
    });

    // The matrix: three rows of seven, then turned into seven rows of three.
    const mA = s.ease('matrix', 0.6, 0.3);
    if (mA <= 0.003) return;
    const flip = s.ease('flip', 1.4, 0.3);
    const p = (s.tall ? 7.6 : 7.4) * u;
    // Both share their top-left cell, so turning rows into columns is a mirror across the diagonal.
    const x0 = s.w / 2 - 3 * p;
    const y0 = s.h * 0.2 + p / 2;
    const scaled = after(s, 'flip', 0.6, 0.8);
    const mid = Math.abs(flip - 0.5) < 0.22;
    s.alpha(mA, () => {
      s.alpha(Math.sin(Math.PI * flip), () => s.line(x0 - p / 2, y0 - p / 2, x0 + 3 * p, y0 + 3.5 * p, s.tint('blue', 0.5), 0.3, [1, 1]));
      M.forEach((row, i) =>
        row.forEach((v, j) => {
          const x = x0 + lerp(j, i, flip) * p;
          const y = y0 + lerp(i, j, flip) * p;
          const val = mid ? '' : String(v ? (scaled > 0.5 ? v * X[i]! : v) : 0);
          const k: Ink = v ? (scaled > 0.5 ? 'orange' : 'blue') : '--ink-3';
          s.alpha(v ? 1 : 0.45, () => s.cell(x - p / 2 + 0.4 * u, y - p / 2 + 0.4 * u, p - 0.8 * u, p - 0.8 * u, val, k, { size: 3, on: v && scaled > 0.5 ? 0.5 : 0 }));
        }),
      );
      s.alpha(1 - flip, () => {
        label(s, 'M: one row per output', s.w / 2, y0 + 2.5 * p + 3.5 * u, '--ink-2', 3.2);
        s.text('3 × 7', x0 + 6.5 * p + 2 * u, y0 + p, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-3') });
      });
    });
    s.alpha(flip, () => {
      label(s, 'Mᵀ', x0 + p, y0 - p - 0.5 * u, 'blue', 3.4);
      s.text('7 × 3', x0 - p / 2 - 2 * u, y0 + 3 * p, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('--ink-3') });
    });
    // Each column, scaled by its input, is one stamp; the rows add up to the output.
    s.alpha(scaled, () => {
      X.forEach((v, i) => label(s, `×${v}`, x0 + i * p, y0 + 6.5 * p + 3 * u, 'orange', 3));
      const ox = x0 + 4.2 * p;
      s.text('=', x0 + 3.1 * p, y0 + 3 * p, { size: 4, font: 'mono', color: s.c('--ink-3') });
      OUT.forEach((v, j) => s.cell(ox - p / 2 + 0.4 * u, y0 + j * p - p / 2 + 0.4 * u, p - 0.8 * u, p - 0.8 * u, String(v), 'gold', { size: 3 }));
    });
    s.alpha(s.ease('history', 0.6, 1), () => {
      label(s, 'conv of the output: [8, 16, 20]', s.w / 2, s.h * 0.885, '--ink-2', 3.1);
      label(s, 'not [1, 2, 3]: only the size comes back', s.w / 2, s.h * 0.935, 'red', 3.1);
    });
    cite(s, 'Dumoulin & Visin, 2016', s.ease('history', 0.6));
  },
};

const size: SceneDef = {
  marks: {
    f: { tex: String.raw`\symS(W - 1) + \symF - 2\symP`, x: 0.5, y: 0.1, size: 5.2 },
  },
  draw(s) {
    s.show('f', s.ease('formula', 0.6) * (1 - s.ease('undo', 0.5)));
    const pitch = s.tall ? 12 : 11.5;
    const xs = slots(s, pitch);
    const cw = (pitch - 1.6) * s.u;
    const yo = s.h * 0.56;
    const yin = s.h * 0.22;
    const trim = after(s, 'pad', 0.55, 0.8);
    const undo = s.ease('undo', 0.6);
    s.alpha(1 - undo, () => {
      // The W inputs, each above the stamp it makes.
      X.forEach((v, i) => s.cell(xs[S * i + 1]! - cw / 2, yin - 3.6 * s.u, cw, 7.2 * s.u, String(v), 'orange', { on: after(s, 'starts', 0.15) * (1 - after(s, 'starts', 0.45)), size: 3.4 }));
      s.alpha(after(s, 'starts', 0.15) * (1 - s.ease('pad', 0.5)), () => s.text('W = 3', xs[0]! - cw / 2, yin, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('orange'), halo: true }));
      // Each stamp as a span above the output row, staggered so the overlaps show.
      [0, 1, 2].forEach((i) => {
        const y = yo - (16 - 4.5 * i) * s.u;
        const x0 = xs[S * i]! - cw / 2;
        const x1 = xs[S * i + 2]! + cw / 2;
        s.rrect(x0, y - 1.4 * s.u, x1 - x0, 2.8 * s.u, 1.4, { fill: s.tint('orange', 0.3), stroke: s.c('orange'), lw: 0.3 });
        s.circle(x0, y, 1 * s.u, { fill: s.c('orange') });
      });
      OUT.forEach((v, j) => {
        const edge = j === 0 || j === NOUT - 1;
        s.alpha(edge ? 1 - 0.75 * trim : 1, () => s.cell(xs[j]! - cw / 2, yo - 4 * s.u, cw, 8 * s.u, String(v), edge && trim > 0.5 ? '--ink-3' : 'gold', { size: 3.6 }));
        if (edge && trim > 0.02) s.alpha(trim, () => s.line(xs[j]! - cw / 2, yo + 4 * s.u, xs[j]! + cw / 2, yo - 4 * s.u, s.c('red'), 0.5));
      });
      const by = yo + 7.5 * s.u;
      const brace = (a: number, b: number, text: string, k: Ink, alpha: number) =>
        s.alpha(alpha, () => {
          s.line(a, by, b, by, s.c(k), 0.4);
          s.line(a, by - 1.2 * s.u, a, by, s.c(k), 0.4);
          s.line(b, by - 1.2 * s.u, b, by, s.c(k), 0.4);
          label(s, text, (a + b) / 2, by + 3.6 * s.u, k, 3.2);
        });
      brace(xs[0]! - cw / 2, xs[4]! - cw / 2 - 0.6 * s.u, 'S(W − 1) = 4', 'slate', after(s, 'starts', 0.6) * (1 - trim));
      brace(xs[4]! - cw / 2 + 0.6 * s.u, xs[6]! + cw / 2, 'F = 3', 'slate', after(s, 'width', 0.2) * (1 - trim));
      s.alpha(after(s, 'width', 0.5) * (1 - after(s, 'pad', 0.2)), () => rich(s, [['4 + 3 = ', '--ink-2'], ['7', 'gold']], s.w / 2, yo + 18 * s.u, { size: 3.8, weight: 650 }));
      s.alpha(trim, () => rich(s, [['7 − 2 × 1 = ', '--ink-2'], ['5', 'gold']], s.w / 2, yo + 18 * s.u, { size: 3.8, weight: 650 }));
      s.alpha(after(s, 'pad', 0.3) * (1 - trim), () => label(s, 'P = 1: trim one off each end', s.w / 2, yo + 18 * s.u, 'slate', 3.2));
    });
    s.alpha(undo, () => {
      const y = s.h * 0.5;
      const lx = s.w / 2 - 37 * s.u;
      rich(s, [['conv:        ', '--ink-3'], ['(32 − 4 + 2) / 2 + 1 = ', '--ink-2'], ['16', 'purple']], lx, y + 2 * s.u, { size: 3.4, weight: 600, align: 'left' });
      s.alpha(after(s, 'undo', 0.6), () => rich(s, [['transposed:  ', '--ink-3'], ['2(16 − 1) + 4 − 2 = ', '--ink-2'], ['32', 'gold']], lx, y + 11 * s.u, { size: 3.4, weight: 600, align: 'left' }));
      s.alpha(after(s, 'undo', 0.25), () => label(s, 'F = 4, S = 2, P = 1', s.w / 2, y - 8 * s.u, 'slate', 3.2));
    });
  },
};

export const scenes: Record<string, SceneDef> = { pixels, stamp, name, size };
