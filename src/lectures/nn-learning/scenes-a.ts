import { fmt } from '../../core/code';
import { CLASS_COLORS } from '../../core/plot';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { SPIRAL, TINY, gcDF, gcF, relCurves, sanityRuns } from './data';
import { type K, type Rect, Frame, area, check, cross, hgrid, legend, pill, regions, split } from './kit';

// ---------------------------------------------------------------- the six steps

const STEPS: { name: string; sub: string; k: K; glyph: 'check' | 'curve' | 'path' | 'stairs' | 'dots' | 'bars' }[] = [
  { name: 'check', sub: 'gradients, sanity', k: 'green', glyph: 'check' },
  { name: 'watch', sub: 'loss, accuracy', k: 'red', glyph: 'curve' },
  { name: 'update', sub: 'momentum, Adam', k: 'purple', glyph: 'path' },
  { name: 'decay', sub: 'the learning rate', k: 'slate', glyph: 'stairs' },
  { name: 'search', sub: 'hyperparameters', k: 'gold', glyph: 'dots' },
  { name: 'ensemble', sub: 'average models', k: 'blue', glyph: 'bars' },
];

/** A small pictogram for one step, inside a box of half-size g centered at (cx, cy). */
function glyph(s: Scene, kind: (typeof STEPS)[number]['glyph'], cx: number, cy: number, g: number, k: K, p: number): void {
  const col = s.c(k);
  const u = s.u;
  switch (kind) {
    case 'check':
      check(s, cx, cy, g * 0.62);
      break;
    case 'curve': {
      s.line(cx - g, cy + g * 0.8, cx + g, cy + g * 0.8, s.c('--axis'), 0.3);
      s.line(cx - g, cy + g * 0.8, cx - g, cy - g * 0.8, s.c('--axis'), 0.3);
      const c = s.ctx;
      c.beginPath();
      const n = Math.max(2, Math.round(30 * p));
      for (let i = 0; i <= n; i++) {
        const t = i / 30;
        const x = cx - g * 0.9 + t * g * 1.8;
        const y = cy - g * 0.7 + g * 1.35 * (1 - Math.exp(-4 * t)) + Math.sin(i * 2.3) * g * 0.05;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.strokeStyle = col;
      c.lineWidth = u * 0.5;
      c.stroke();
      break;
    }
    case 'path': {
      const c = s.ctx;
      c.beginPath();
      c.moveTo(cx - g, cy - g * 0.6);
      for (let i = 1; i <= 6; i++) c.lineTo(cx - g + (i * g) / 3.4, cy + (i % 2 ? 0.5 : -0.5) * g * (1 - i / 7));
      c.strokeStyle = s.tint('red', 0.45);
      c.lineWidth = u * 0.35;
      c.stroke();
      c.beginPath();
      c.moveTo(cx - g, cy - g * 0.6);
      c.quadraticCurveTo(cx - g * 0.2, cy + g * 0.6, cx + g * 0.85, cy);
      c.strokeStyle = col;
      c.lineWidth = u * 0.6;
      c.stroke();
      s.circle(cx + g * 0.85, cy, u * 0.9, { fill: col });
      break;
    }
    case 'stairs': {
      const c = s.ctx;
      c.beginPath();
      c.moveTo(cx - g, cy - g * 0.7);
      for (let i = 0; i < 4; i++) {
        const x1 = cx - g + ((i + 1) * 2 * g) / 4;
        const y0 = cy - g * 0.7 + i * g * 0.42;
        c.lineTo(x1, y0);
        if (i < 3) c.lineTo(x1, y0 + g * 0.42);
      }
      c.strokeStyle = col;
      c.lineWidth = u * 0.55;
      c.stroke();
      break;
    }
    case 'dots': {
      const pts = [
        [-0.8, 0.4], [-0.3, -0.6], [0.5, 0.5], [0.9, -0.3], [-0.6, -0.1], [0.1, 0.1], [0.4, -0.7], [-0.1, 0.75],
      ];
      pts.forEach(([x, y], i) => s.circle(cx + x! * g, cy + y! * g, u * (i === 5 ? 1.1 : 0.75), { fill: i === 5 ? s.c('green') : s.tint(k, 0.85) }));
      break;
    }
    case 'bars': {
      const hs = [[0.5, 0.8, 0.3], [0.7, 0.5, 0.4], [0.6, 0.9, 0.2]];
      hs.forEach((grp, gi) =>
        grp.forEach((v, j) => {
          const bw = g * 0.18;
          const x = cx - g + gi * g * 0.72 + j * bw * 1.1;
          s.rrect(x, cy + g * 0.75 - v * g * 1.4, bw, v * g * 1.4, 0.3, { fill: s.tint(k, 0.4 + 0.25 * j) });
        }),
      );
      break;
    }
  }
}

/** The six steps of a training run as tiles; `lit` brightens, `ticks` counts check marks (0..2). */
function stepTiles(s: Scene, rect: Rect, appear: (i: number) => number, lit: (i: number) => number, ticks: (i: number) => number = () => 0, draw: (i: number) => number = () => 1): void {
  const [rx, ry, rw, rh] = rect;
  const cols = 3;
  const gap = s.u * 2.4;
  const tw = (rw - gap * (cols - 1)) / cols;
  const th = Math.min((rh - gap) / 2, tw * 0.95);
  const oy = ry + (rh - (th * 2 + gap)) / 2;
  STEPS.forEach((st, i) => {
    const a = appear(i);
    if (a <= 0.003) return;
    const x = rx + (i % cols) * (tw + gap);
    const y = oy + Math.floor(i / cols) * (th + gap) + (1 - a) * s.u * 3;
    const on = lit(i);
    s.alpha(a, () => {
      s.rrect(x, y, tw, th, 2.2, { fill: s.tint(st.k, 0.06 + 0.16 * on), stroke: s.tint(st.k, 0.3 + 0.7 * on), lw: 0.3 + 0.35 * on });
      const g = Math.min(tw, th) * 0.2;
      glyph(s, st.glyph, x + tw / 2, y + th * 0.34, g, st.k, draw(i));
      const fs = Math.min(5, (tw / s.u) * 0.13);
      s.text(st.name, x + tw / 2, y + th * 0.68, { size: fs, font: 'display', weight: 560 });
      s.text(st.sub, x + tw / 2, y + th * 0.85, { size: Math.min(fs * 0.66, (tw / s.u) * 0.082), font: 'mono', color: s.c(st.k) });
      const n = ticks(i);
      for (let q = 0; q < 2; q++) {
        const ta = clamp01(n - q);
        if (ta > 0) s.alpha(ta, () => check(s, x + tw - s.u * (3 + q * 4.4), y + s.u * 3, s.u * 1.8));
      }
    });
  });
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'have'), () => {
      s.text('Training', w / 2, h * 0.44, { size: 12, font: 'display', weight: 600 });
      s.text('updates, monitoring, tuning', w / 2, h * 0.58, { size: 4.6, italic: true, color: s.c('--ink-2') });
    });
    // The ingredients from earlier chapters.
    const ing: [string, string, K][] = [
      ['architecture', 'Ch 7', 'purple'],
      ['data', 'Ch 8', 'orange'],
      ['initialization', 'Ch 8', 'blue'],
      ['loss', 'Ch 8', 'red'],
      ['backprop', 'Ch 6', 'teal'],
    ];
    const iA = s.win('have', 'tend');
    if (iA > 0) {
      s.alpha(iA, () => {
        s.text('what you already have', w / 2, h * 0.26, { size: 4.2, italic: true, color: s.c('--ink-2') });
        const size = s.tall ? 4.2 : 4;
        const widths = ing.map(([t]) => s.measure(t, { font: 'mono', size, weight: 600 }) + u * size * 0.95);
        const perRow = [2, 3];
        let k = 0;
        perRow.forEach((n, row) => {
          const items = ing.slice(k, k + n);
          const ws = widths.slice(k, k + n);
          const tot = ws.reduce((a, b) => a + b, 0) + u * 3 * (n - 1);
          let x = w / 2 - tot / 2;
          const y = h * (0.42 + row * 0.22);
          items.forEach(([t, ch, kk], j) => {
            const a = s.ease('have', 0.5, 0.35 + (k + j) * 0.75);
            s.alpha(a, () => {
              pill(s, t, x, y, kk, { size, align: 'left' });
              s.text(ch, x + ws[j]! / 2, y + u * 6, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
            });
            x += ws[j]! + u * 3;
          });
          k += n;
        });
      });
    }
    const tA = s.ease('tend', 0.7);
    if (tA > 0) {
      const lit = (i: number) => {
        if (s.since('go') >= 0) return i === 0 ? 0.6 + 0.4 * Math.sin(s.since('go') * 5) : 0;
        if (s.since('search') >= 0) return i >= 4 ? 1 : 0;
        if (s.since('update') >= 0) return i === 2 || i === 3 ? 1 : 0;
        if (s.since('watch') >= 0) return i === 1 ? 1 : 0;
        if (s.since('check') >= 0) return i === 0 ? 1 : 0;
        return 0;
      };
      const drawP = (i: number) => (i === 1 && s.since('watch') >= 0 ? s.ease('watch', 1.6, 0.4) : 1);
      stepTiles(s, area(s, 0.15, 0.06), (i) => s.ease('tend', 0.5, 0.25 + 0.18 * i), lit, () => 0, drawP);
    }
  },
};

// ---------------------------------------------------------------- gradient check

const X0 = 0.4;
const ERR_ROWS: [string, string, string][] = [1e-1, 1e-3, 1e-5].map((h) => {
  const a = gcDF(X0);
  const one = Math.abs((gcF(X0 + h) - gcF(X0)) / h - a);
  const cen = Math.abs((gcF(X0 + h) - gcF(X0 - h)) / (2 * h) - a);
  return [h.toExponential(0), one.toExponential(0), cen.toExponential(0)];
});

const gradcheck: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Bugs, and a loss that still falls.
    const bA = s.win('bug', 'defense');
    if (bA > 0) {
      s.alpha(bA, () => {
        const bugs = ['missing W.T', 'lost factor of 2', 'flipped sign'];
        const ys = [h * 0.19, h * 0.28, h * 0.37].map((y) => (s.tall ? y : y * 0.92));
        const xs = [w / 2, w / 2, w / 2];
        bugs.forEach((b, i) => s.alpha(smooth((s.prog('bug') - 0.25 - i * 0.2) / 0.12), () => pill(s, b, xs[i]!, ys[i]!, 'red', { size: 4.2 })));
        const cA = s.ease('hide', 0.6);
        s.alpha(cA, () => {
          const top = s.tall ? h * 0.46 : h * 0.36;
          const fr = new Frame(s, [w * 0.12, top, w * 0.76, h * 0.92 - top], [0, 1, 0, 1.15]);
          const [bx, by, bw, bh] = fr.box;
          s.line(bx, by + bh, bx + bw, by + bh, s.c('--axis'), 0.35);
          s.line(bx, by, bx, by + bh, s.c('--axis'), 0.35);
          s.text('loss', bx - u * 1.2, by + u * 1.5, { size: 3, font: 'mono', color: s.c('red'), align: 'right' });
          s.text('steps →', bx + bw, by + bh + u * 3, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'right' });
          const p = s.ease('hide', 2.2, 0.4);
          fr.fn((x) => 1 - 0.85 * (1 - Math.exp(-5 * x)), s.c('green'), 0.7, 0, Math.max(0.001, p));
          fr.fn((x) => 1 - 0.32 * (1 - Math.exp(-3 * x)) + 0.02 * Math.sin(30 * x), s.c('red'), 0.7, 0, Math.max(0.001, p));
          s.alpha(smooth((p - 0.7) / 0.3), () => {
            s.text('correct gradient', fr.X(0.98), fr.Y(0.15) - u * 3.4, { size: 3.6, color: s.c('green'), align: 'right', halo: true });
            s.text('buggy: still goes down', fr.X(0.98), fr.Y(0.68) - u * 4, { size: 3.6, color: s.c('red'), align: 'right', halo: true });
          });
        });
      });
    }
    // Two ways to the same gradient.
    const dA = s.win('defense', 'nudge');
    if (dA > 0) {
      s.alpha(dA, () => {
        const [r0, r1] = split(s, area(s, 0.22, 0.08), 0.5, 8);
        const box = (r: Rect, title: string, l1: string, l2: string, k: K, a: number) =>
          s.alpha(a, () => {
            const [x, y, bw, bh0] = r;
            const bh = Math.min(bh0, u * 26);
            const yy = y + (bh0 - bh) / 2;
            s.rrect(x, yy, bw, bh, 2, { fill: s.tint(k, 0.08), stroke: s.tint(k, 0.7), lw: 0.4 });
            s.text(title, x + bw / 2, yy + bh * 0.3, { size: 5, font: 'display', weight: 600, color: s.c(k) });
            s.text(l1, x + bw / 2, yy + bh * 0.58, { size: 3.4, color: s.c('--ink-2') });
            s.text(l2, x + bw / 2, yy + bh * 0.78, { size: 3.4, color: s.c('--ink-2') });
          });
        box(r0, 'analytic', 'backprop: fast, exact', 'easy to get wrong', 'teal', s.ease('defense', 0.5, 0.3));
        box(r1, 'numerical', 'nudge and measure', 'slow, nearly foolproof', 'orange', s.ease('defense', 0.5, 1.4));
        s.alpha(s.ease('defense', 0.5, 3.4), () => {
          const cx = s.tall ? w / 2 : (r0[0] + r0[2] + r1[0]) / 2;
          const cy = s.tall ? (r0[1] + r0[3] + r1[1]) / 2 : r0[1] + r0[3] / 2;
          s.circle(cx, cy, u * 4.2, { fill: s.c('--card'), stroke: s.c('--ink-3'), lw: 0.4 });
          s.text('≈ ?', cx, cy + u * 0.3, { size: 4, font: 'mono', weight: 650 });
        });
      });
    }
    // The curve, nudged both ways.
    const cA = s.win('nudge', 'table');
    if (cA > 0) {
      s.alpha(cA, () => {
        const fr = new Frame(s, area(s, 0.13, 0.06), [-0.95, 1.75, -0.8, 1.75], true);
        const fx = gcF(X0);
        const df = gcDF(X0);
        // The step: 0.6, shrinking during "rise", back to 0.6 for the one-sided comparison.
        let hh = 0.6;
        if (s.since('rise') >= 0 && s.since('one') < 0) hh = lerp(0.6, 0.03, smooth((s.prog('rise') - 0.35) / 0.5));
        if (s.since('one') >= 0) hh = lerp(0.03, 0.6, s.ease('one', 0.8));
        fr.clip(() => {
          s.line(fr.X(-0.95), fr.Y(0), fr.X(1.75), fr.Y(0), s.c('--axis'), 0.3);
          s.line(fr.X(0), fr.Y(-0.8), fr.X(0), fr.Y(1.75), s.c('--axis'), 0.3);
        });
        fr.fn(gcF, s.c('red'), 0.75);
        s.text('loss', fr.X(1.72), fr.Y(gcF(1.72)) + u * 4, { size: 3.4, font: 'mono', color: s.c('red'), halo: true, align: 'right' });
        // Parameter x, and the vertical drop to the curve.
        s.line(fr.X(X0), fr.Y(0), fr.X(X0), fr.Y(fx), s.tint('blue', 0.6), 0.3, [1, 1]);
        fr.dot(X0, 0, 1.1, s.c('blue'));
        s.text('x', fr.X(X0), fr.Y(0) + u * 3.4, { size: 3.6, italic: true, weight: 600, color: s.c('blue'), halo: true });
        fr.dot(X0, fx, 1.1, s.c('red'));
        // x + h and x - h.
        const pA = s.ease('both', 0.5, 0.2);
        const mA = s.since('both') >= 0 ? smooth((s.prog('both') - 0.5) / 0.15) : 0;
        const ends: [number, number, string][] = [
          [X0 + hh, pA, 'x + h'],
          [X0 - hh, mA, 'x − h'],
        ];
        ends.forEach(([xe, a, lab], i) =>
          s.alpha(a, () => {
            s.line(fr.X(xe), fr.Y(0), fr.X(xe), fr.Y(gcF(xe)), s.tint('orange', 0.7), 0.3, [1, 1]);
            fr.dot(xe, 0, 0.9, s.c('orange'));
            fr.dot(xe, gcF(xe), 1, s.c('orange'));
            s.alpha(clamp01((hh - 0.15) / 0.15), () => s.text(lab, fr.X(xe), fr.Y(0) + (gcF(xe) < 0 ? -u * 3.2 : u * 3.4), { size: 3.2, font: 'mono', color: s.c('orange'), halo: true }));
          }),
        );
        // The centered secant, then the tangent it converges to.
        const sec = (x0: number, x1: number) => (gcF(x1) - gcF(x0)) / (x1 - x0);
        const sA = s.since('rise') >= 0 ? s.ease('rise', 0.6) : 0;
        const slopeC = sec(X0 - hh, X0 + hh);
        s.alpha(sA, () => {
          const yl = (x: number) => gcF(X0 - hh) + slopeC * (x - (X0 - hh));
          fr.fn(yl, s.c('teal'), 0.6, -0.95, 1.75);
          // Rise and run brackets while the step is still wide.
          s.alpha(clamp01((hh - 0.25) / 0.2) * (1 - s.ease('one', 0.4)), () => {
            const yb = fr.Y(gcF(X0 - hh)) + u * 0;
            s.line(fr.X(X0 - hh), yb, fr.X(X0 + hh), yb, s.tint('--ink-2', 0.7), 0.3, [0.8, 0.8]);
            s.line(fr.X(X0 + hh), yb, fr.X(X0 + hh), fr.Y(gcF(X0 + hh)), s.tint('--ink-2', 0.7), 0.3, [0.8, 0.8]);
            s.text('2h', fr.X(X0), yb + u * 3, { size: 3.2, font: 'mono', color: s.c('--ink-2'), halo: true });
            s.text('rise', fr.X(X0 + hh) + u * 1.2, (yb + fr.Y(gcF(X0 + hh))) / 2, { size: 3.2, font: 'mono', color: s.c('--ink-2'), align: 'left', halo: true });
          });
        });
        const tgA = s.since('rise') >= 0 ? smooth((s.prog('rise') - 0.75) / 0.2) : 0;
        s.alpha(tgA, () => fr.fn((x) => fx + df * (x - X0), s.tint('--ink', 0.55), 0.4, -0.95, 1.75, [1.2, 1]));
        // One-sided secant.
        const oA = s.win('one', 'table') * s.ease('one', 0.6, 0.6);
        const slopeO = sec(X0, X0 + hh);
        s.alpha(oA, () => fr.fn((x) => fx + slopeO * (x - X0), s.c('gold'), 0.6, -0.95, 1.75, [1.6, 1]));
        // The bend: a parabola through x, lifting both ends above the tangent equally.
        const bA2 = s.ease('bend', 0.6);
        s.alpha(bA2, () => {
          const d2 = (gcDF(X0 + 1e-4) - gcDF(X0 - 1e-4)) / 2e-4;
          const par = (x: number) => fx + df * (x - X0) + 0.5 * d2 * (x - X0) ** 2;
          fr.fn(par, s.tint('purple', 0.8), 0.45, X0 - 0.75, X0 + 0.75, [0.8, 0.8]);
          for (const sg of [-1, 1]) {
            const xe = X0 + sg * hh;
            s.line(fr.X(xe), fr.Y(fx + df * (xe - X0)), fr.X(xe), fr.Y(par(xe)), s.c('purple'), 0.6);
          }
          s.text('same bend on both sides', fr.X(1.72), fr.Y(-0.55), { size: 3.4, color: s.c('purple'), halo: true, align: 'right' });
        });
        // Slopes, in a legend.
        const rows: { label: string; k: K; a?: number }[] = [{ label: `true slope ${df.toFixed(3)}`, k: '--ink-2', a: tgA }];
        if (sA > 0) rows.unshift({ label: `centered ${slopeC.toFixed(3)}`, k: 'teal' });
        if (oA > 0) rows.push({ label: `one-sided ${slopeO.toFixed(3)}`, k: 'gold', a: oA });
        if (sA > 0) {
          const [bx, by] = fr.box;
          s.alpha(sA, () => legend(s, bx + u, by, rows, { size: 3 }));
        }
      });
    }
    // The error table.
    const tA = s.ease('table', 0.6);
    if (tA > 0) {
      s.alpha(tA, () => {
        const tw = Math.min(w * 0.86, u * 96);
        const x0 = (w - tw) / 2;
        const y0 = h * 0.18;
        const rh = u * 8.5;
        const cx = [x0 + tw * 0.16, x0 + tw * 0.5, x0 + tw * 0.83];
        s.rrect(x0, y0, tw, rh * 5, 2, { fill: s.tint('--card', 1), stroke: s.c('--rule'), lw: 0.3 });
        ['h', 'one-sided error', 'centered error'].forEach((t, i) => s.text(t, cx[i]!, y0 + rh * 0.65, { size: 3.4, font: 'ui', weight: 650, color: s.c((['orange', 'gold', 'teal'] as K[])[i]!) }));
        ERR_ROWS.forEach((row, r) => {
          const a = smooth((s.prog('table') - 0.08 - r * 0.2) / 0.1);
          s.alpha(a, () => row.forEach((v, i) => s.text(v, cx[i]!, y0 + rh * (1.7 + r), { size: 4.2, font: 'mono', weight: 600 })));
        });
        s.alpha(smooth((s.prog('table') - 0.68) / 0.12), () => {
          s.text('÷ 100', cx[1]!, y0 + rh * 4.3, { size: 3.4, font: 'mono', weight: 650, color: s.c('gold') });
          s.text('÷ 10,000', cx[2]!, y0 + rh * 4.3, { size: 3.4, font: 'mono', weight: 650, color: s.c('teal') });
          s.text('per row', cx[0]!, y0 + rh * 4.3, { size: 3.2, italic: true, color: s.c('--ink-3') });
        });
        s.alpha(s.ease('cost', 0.6, 0.3), () => {
          const y = y0 + rh * 5 + u * 8;
          pill(s, 'f(x + h), f(x − h): 2 loss evaluations', w / 2, y, 'red', { size: 3.4 });
          s.text('for every single parameter', w / 2, y + u * 6.5, { size: 3.6, italic: true, color: s.c('--ink-2') });
          s.alpha(s.ease('cost', 0.6, 2.6), () => {
            const yy = y + u * 14;
            check(s, w / 2 - u * 24, yy, u * 2);
            s.text('a check', w / 2 - u * 20.5, yy + u * 0.2, { size: 3.6, align: 'left' });
            cross(s, w / 2 + u * 7, yy, u * 2);
            s.text('training', w / 2 + u * 10.5, yy + u * 0.2, { size: 3.6, align: 'left' });
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- relative error

const relerr: SceneDef = {
  marks: {
    rel: { tex: String.raw`\text{rel} = \frac{|f'_a - f'_n|}{\max(|f'_a|,\,|f'_n|)}`, x: 0.5, y: 0.87, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Same gap, different verdicts.
    const cA = s.win('two', 'thumbs');
    if (cA > 0) {
      s.alpha(cA, () => {
        const [ax0, ay0, aw0] = area(s, 0.14, 0.06);
        const r0: Rect = [ax0, ay0, (aw0 - u * 3) / 2, h * 0.6];
        const r1: Rect = [ax0 + (aw0 + u * 3) / 2, ay0, (aw0 - u * 3) / 2, h * 0.6];
        const card = (r: Rect, title: string, ana: string, num: string, rel: string, k: K) => {
          const [x, y, cw, ch0] = r;
          const ch = Math.min(ch0, u * 56);
          s.rrect(x, y, cw, ch, 2, { fill: s.tint('--card', 1), stroke: s.c('--rule'), lw: 0.3 });
          const lh = ch / 5.5;
          const fs = Math.min(4.2, (lh / u) * 0.5, (cw / u) * 0.1);
          s.text(title, x + cw / 2, y + lh * 0.75, { size: fs * 0.95, font: 'ui', weight: 650, color: s.c('--ink-2') });
          const row = (i: number, label: string, v: string, kk: K, a: number) =>
            s.alpha(a, () => {
              s.text(label, x + u * 2, y + lh * (1.5 + i), { size: fs * 0.88, font: 'ui', align: 'left', color: s.c('--ink-2') });
              s.text(v, x + cw - u * 2, y + lh * (1.5 + i), { size: fs, font: 'mono', weight: 600, align: 'right', color: s.c(kk) });
            });
          row(0, 'analytic', ana, 'teal', 1);
          row(1, 'numerical', num, 'orange', 1);
          const dA = s.ease('plain', 0.5, 0.6);
          s.alpha(dA, () => s.rrect(x + u, y + lh * 2.95, cw - 2 * u, lh * 1.1, 1.2, { fill: s.tint('--accent', 0.12 * (1 - s.ease('rel', 0.5))) }));
          row(2, '|diff|', '1e-4', '--ink', dA);
          row(3, 'relative', rel, k, s.ease('rel', 0.5, 1));
        };
        card(r0, 'near 0.01', '0.0123', '0.0124', '8e-3', 'gold');
        card(r1, 'near 1,500', '1520.0002', '1520.0003', '7e-8', 'green');
        s.show('rel', cA * s.ease('rel', 0.6, 0.3));
      });
    }
    // The verdict ruler.
    const BANDS: [number, number, K, string, string][] = [
      [0, -2, 'red', 'probably', 'wrong'],
      [-2, -4, 'gold', 'uncom-', 'fortable'],
      [-4, -7, 'slate', 'fine if', 'kinks'],
      [-7, -10, 'green', 'be', 'happy'],
    ];
    const rA = s.win('thumbs', 'precision');
    if (rA > 0) {
      s.alpha(rA, () => {
        const [ax, , aw] = area(s, 0.14, 0.08);
        const fr = new Frame(s, [ax, h * 0.3, aw, h * 0.4], [0, -10, 0, 1]);
        const y = h * 0.56;
        const bh = u * 6;
        BANDS.forEach(([a, b, k, l1, l2], i) => {
          const on = i === 2 ? s.ease('thumbs2', 0.6) : i === 1 ? smooth((s.prog('thumbs') - 0.45) / 0.15) : i === 0 ? s.ease('thumbs', 0.5, 0.3) : smooth((s.prog('thumbs') - 0.75) / 0.15);
          s.alpha(0.25 + 0.75 * on, () => {
            s.rrect(fr.X(a), y, fr.X(b) - fr.X(a), bh, 0.6, { fill: s.tint(k, 0.22 + 0.25 * on), stroke: s.tint(k, 0.6) , lw: 0.25 });
          });
          s.alpha(on, () => {
            const cx = (fr.X(a) + fr.X(b)) / 2;
            s.text(l1, cx, y - u * 8.2, { size: 3.3, color: s.c(k), weight: 600 });
            s.text(l2, cx, y - u * 4.4, { size: 3.3, color: s.c(k), weight: 600 });
          });
        });
        for (let e = 0; e >= -10; e -= 2) {
          s.line(fr.X(e), y + bh, fr.X(e), y + bh + u * 1.4, s.c('--axis'), 0.3);
          s.text(e === 0 ? '1' : `1e${e}`, fr.X(e), y + bh + u * 4, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
        }
        s.text('relative error  →  smaller', fr.X(-5), y + bh + u * 10, { size: 3.1, italic: true, color: s.c('--ink-3') });
        // The two examples from before.
        const pin = (e: number, lab: string, k: K) => {
          const x = fr.X(e);
          s.line(x, y - u * 0.5, x, y + bh + u * 0.5, s.c('--ink'), 0.5);
          s.circle(x, y + bh / 2, u * 1.1, { fill: s.c(k), stroke: s.c('--card'), lw: 0.3 });
          s.text(lab, x, y + bh + u * 16, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
        };
        s.alpha(s.ease('thumbs', 0.6, 1.2), () => {
          pin(Math.log10(8e-3), '8e-3', 'gold');
          pin(Math.log10(7e-8), '7e-8', 'green');
        });
      });
    }
    // Precision and the step size: the U-shaped curve.
    const uA = s.win('precision', 'kink');
    if (uA > 0) {
      s.alpha(uA, () => {
        const [ax, ay, aw, ah] = area(s, 0.13, 0.06);
        const fr = new Frame(s, [ax + u * 11, ay, aw - u * 11, ah - u * 7], [-12.3, 0.3, -17, 0.8]);
        const { lh, e64, e32 } = relCurves();
        const [bx, by, bw, bh] = fr.box;
        BANDS.forEach(([a, b, k]) => {
          const y0 = fr.Y(Math.min(0.8, a));
          const y1 = fr.Y(b === -10 ? -17 : b);
          s.ctx.fillStyle = s.tint(k, 0.08);
          s.ctx.fillRect(bx, y0, bw, y1 - y0);
        });
        s.ctx.save();
        s.ctx.translate(ax + u * 1.6, by + bh / 2);
        s.ctx.rotate(-Math.PI / 2);
        s.text('relative error', 0, 0, { size: 3, color: s.c('--ink-3') });
        s.ctx.restore();
        for (let v = 0; v >= -16; v -= 4) {
          s.line(bx, fr.Y(v), bx + bw, fr.Y(v), s.c('--grid'), 0.25);
          s.text(v === 0 ? '1' : `1e${v}`, bx - u * 1.2, fr.Y(v), { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        }
        for (let v = -12; v <= 0; v += 4) s.text(v === 0 ? '1' : `1e${v}`, fr.X(v), by + bh + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
        s.text('step h →', bx + bw, by + bh + u * 6.6, { size: 3, font: 'mono', color: s.c('orange'), align: 'right' });
        
        const curve = (ys: number[], k: K, p: number, width: number) => {
          const n = Math.floor(lh.length * p);
          const pts: [number, number][] = [];
          for (let i = lh.length - 1; i >= lh.length - n; i--) pts.push([lh[i]!, ys[i]!]);
          fr.clip(() => fr.poly(pts, s.c(k), width));
        };
        curve(e32, 'orange', s.ease('precision', 1.4, 2.2), 0.55);
        curve(e64, 'blue', s.ease('precision', 1.4, 0.4), 0.65);
        s.alpha(s.ease('precision', 0.5, 1.6), () => s.text('float64', fr.X(-1.2), fr.Y(-9.6), { size: 3.4, font: 'mono', weight: 650, color: s.c('blue'), halo: true, align: 'right' }));
        s.alpha(s.ease('precision', 0.5, 3.4), () => {
          s.text('float32', fr.X(-3.6), fr.Y(-1.7), { size: 3.4, font: 'mono', weight: 650, color: s.c('orange'), halo: true, align: 'left' });
          const i6 = 120;
          fr.dot(lh[i6]!, e32[i6]!, 1, s.c('orange'));
          s.text(`${(10 ** e32[i6]!).toExponential(0)} at h = 1e-6`, fr.X(lh[i6]!) - u * 1.5, fr.Y(-3.4), { size: 3, font: 'mono', color: s.c('orange'), halo: true, align: 'right' });
        });
        // Too big, then too small.
        const p = s.prog('hstep');
        const big = s.since('hstep') >= 0 && s.since('sweet') < 0 ? smooth(p / 0.12) * (1 - smooth((p - 0.42) / 0.1)) : 0;
        const small = s.since('hstep') >= 0 && s.since('sweet') < 0 ? smooth((p - 0.48) / 0.1) : 0;
        s.alpha(big, () => {
          s.ctx.fillStyle = s.tint('--accent', 0.1);
          s.ctx.fillRect(fr.X(-3), by, fr.X(0.3) - fr.X(-3), bh);
          s.text('line ≠ curve', fr.X(-1.4), fr.Y(-14.5), { size: 3.4, color: s.c('--accent'), weight: 600, halo: true });
        });
        s.alpha(small, () => {
          s.ctx.fillStyle = s.tint('--accent', 0.1);
          s.ctx.fillRect(bx, by, fr.X(-8.5) - bx, bh);
          s.text('digits cancel', fr.X(-10.4), fr.Y(-14.5), { size: 3.4, color: s.c('--accent'), weight: 600, halo: true });
        });
        // The sweet spot.
        let mi = 0;
        e64.forEach((v, i) => (v < e64[mi]! ? (mi = i) : 0));
        s.alpha(s.ease('sweet', 0.6, 0.6), () => {
          s.circle(fr.X(lh[mi]!), fr.Y(e64[mi]!), u * 2.2, { stroke: s.c('green'), lw: 0.6 });
          s.text('sweet spot', fr.X(lh[mi]!), fr.Y(e64[mi]!) + u * 5, { size: 3.4, weight: 650, color: s.c('green'), halo: true });
        });
      });
    }
    // A kink between the two nudges.
    const kA = s.win('kink', 'habits');
    if (kA > 0) {
      s.alpha(kA, () => {
        const fr = new Frame(s, area(s, 0.15, 0.08), [-1, 1, -0.35, 0.95], true);
        const relu = (x: number) => Math.max(0, x);
        const xk = -0.08;
        const hh = 0.3;
        fr.clip(() => s.line(fr.X(-1), fr.Y(0), fr.X(1), fr.Y(0), s.c('--axis'), 0.3));
        fr.fn(relu, s.c('red'), 0.8);
        s.text('max(0, x)', fr.X(0.62), fr.Y(0.62) - u * 4, { size: 3.4, font: 'mono', color: s.c('red'), halo: true, align: 'right' });
        s.alpha(s.ease('kink', 0.5, 1.2), () => {
          s.circle(fr.X(0), fr.Y(0), u * 2, { stroke: s.c('--ink-2'), lw: 0.4 });
          s.text('kink', fr.X(0), fr.Y(0) - u * 4.4, { size: 3.2, color: s.c('--ink-2'), halo: true });
        });
        const sA = smooth((s.prog('kink') - 0.45) / 0.12);
        s.alpha(sA, () => {
          fr.dot(xk, 0, 1, s.c('blue'));
          s.text('x', fr.X(xk), fr.Y(0) + u * 3.6, { size: 3.4, italic: true, weight: 600, color: s.c('blue'), halo: true });
          for (const sg of [-1, 1]) {
            const xe = xk + sg * hh;
            fr.dot(xe, relu(xe), 1, s.c('orange'));
            s.line(fr.X(xe), fr.Y(0), fr.X(xe), fr.Y(relu(xe)), s.tint('orange', 0.6), 0.3, [1, 1]);
          }
          const sl = (relu(xk + hh) - relu(xk - hh)) / (2 * hh);
          fr.fn((x) => relu(xk - hh) + sl * (x - (xk - hh)), s.c('teal'), 0.55, -0.7, 0.6);
          fr.fn(() => 0, s.c('blue'), 0.55, -0.7, 0.25, [1.2, 1]);
          legend(s, fr.X(-0.98), fr.Y(0.9), [
            { label: 'backprop slope: 0', k: 'blue' },
            { label: `numerical: ${sl.toFixed(2)}`, k: 'teal' },
          ], { size: 3.2 });
        });
        s.alpha(smooth((s.prog('kink') - 0.75) / 0.1), () => {
          cross(s, fr.X(0.5), fr.Y(0.15), u * 2.6);
          s.text('check fails', fr.X(0.5) + u * 4, fr.Y(0.15) + u * 0.2, { size: 3.6, weight: 650, color: s.c('red'), align: 'left', halo: true });
        });
      });
    }
    // Habits.
    const hA = s.ease('habits', 0.6);
    if (hA > 0) {
      s.alpha(hA, () => {
        const items = ['two or three examples', 'regularization and dropout off', 'train briefly first', 'a few entries of every array'];
        const lh = Math.min(h * 0.15, u * 13);
        const y0 = h * 0.55 - (lh * (items.length - 1)) / 2;
        const x0 = w / 2 - Math.min(w * 0.38, u * 44);
        items.forEach((t, i) => {
          const a = smooth((s.prog('habits') - i * 0.22) / 0.12);
          s.alpha(0.35 + 0.65 * a, () => {
            s.circle(x0, y0 + i * lh, u * 2.2, { stroke: s.c('--rule'), lw: 0.4 });
            if (a > 0) s.alpha(a, () => check(s, x0, y0 + i * lh, u * 2.2));
            s.text(t, x0 + u * 5, y0 + i * lh + u * 0.2, { size: 4, align: 'left' });
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- sanity checks

const sanity: SceneDef = {
  marks: {
    ln: { tex: String.raw`\symL = -\ln\tfrac{1}{10} = \ln 10 \approx 2.302`, x: 0.5, y: 0.72, size: 5.2 },
    svm: { tex: String.raw`\symL_{\text{SVM}} = (10 - 1)\cdot 1 = 9`, x: 0.5, y: 0.85, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // The three checks, as a header.
    const heads = ['starting loss', 'λ up, loss up', 'overfit 20'];
    const cur = s.since('tiny') >= 0 ? 2 : s.since('reg') >= 0 ? 1 : s.since('uniform') >= 0 ? 0 : -1;
    const [ax, ay, aw] = area(s, 0.13, 0.05);
    const hw = (aw - u * 4) / 3;
    const hh = u * 8;
    const big = 1 - s.ease('uniform', 0.6);
    heads.forEach((t, i) => {
      const a = s.ease('three', 0.5, 0.8 + i * 1.1);
      const on = cur === i ? 1 : cur < 0 ? 0.5 : 0;
      const y = lerp(ay, h * 0.42, big);
      const hh2 = lerp(hh, u * 20, big);
      s.alpha(a, () => {
        const x = ax + i * (hw + u * 2);
        s.rrect(x, y, hw, hh2, 2, { fill: s.tint('--accent', 0.05 + 0.12 * on), stroke: s.tint('--accent', 0.3 + 0.6 * on), lw: 0.3 + 0.3 * on });
        const fs = Math.min(lerp(3.2, 4.2, big), (hw / u) * 0.1);
        s.circle(x + u * 3.4 + big * u, y + hh2 / 2, u * lerp(2, 2.8, big), { fill: s.tint('--accent', 0.2 + 0.6 * on) });
        s.text(String(i + 1), x + u * 3.4 + big * u, y + hh2 / 2 + u * 0.2, { size: lerp(2.8, 3.6, big), font: 'mono', weight: 700, color: s.c(on > 0.6 ? '--card' : '--ink') });
        s.text(t, x + u * 6.6 + (hw - u * 6.6) / 2 + big * u, y + hh2 / 2 + u * 0.2, { size: fs, font: 'ui', weight: 600 });
      });
    });
    const top = ay + hh + u * 4;
    // Check one: ten equal probabilities.
    const oA = s.win('uniform', 'reg');
    if (oA > 0) {
      s.alpha(oA, () => {
        const bw = Math.min(u * 7, (w * 0.8) / 10);
        const x0 = w / 2 - (bw * 10 + u * 9) / 2;
        const scores = [0.012, -0.008, 0.004, -0.015, 0.009, 0.002, -0.006, 0.011, -0.003, 0.007];
        const sp = s.prog('uniform');
        const toP = smooth((sp - 0.55) / 0.2);
        const base = top + (h * 0.62 - top) * 0.95;
        const maxH = h * 0.62 - top - u * 8;
        scores.forEach((v, i) => {
          const x = x0 + i * (bw + u);
          const isY = i === 3;
          s.alpha(1 - toP, () => s.cell(x, top + u * 6, bw, bw * 0.8, v.toFixed(2).replace('0.', '.'), isY ? 'gold' : '--ink-3', { size: Math.min(2.4, bw / u * 0.33) }));
          s.alpha(toP, () => {
            const bh = maxH * 0.5;
            s.rrect(x, base - bh, bw, bh, 0.5, { fill: s.tint(isY ? 'gold' : 'slate', isY ? 0.75 : 0.35) });
            s.text('0.1', x + bw / 2, base - bh - u * 2.4, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
          });
        });
        s.alpha((1 - toP) * s.ease('uniform', 0.5, 0.8), () => s.text('scores, all near zero', w / 2, top + u * 2, { size: 3.4, italic: true, color: s.c('--ink-2') }));
        s.alpha(toP, () => {
          s.text('softmax: 1 in 10 each', w / 2, top + u * 2, { size: 3.4, italic: true, color: s.c('--ink-2') });
          s.text('correct class', x0 + 3 * (bw + u) + bw / 2, base + u * 3, { size: 2.8, color: s.c('gold'), weight: 600 });
        });
        s.show('ln', oA * s.ease('ln', 0.6) * (1 - s.ease('off', 0.5)));
        s.show('svm', oA * s.ease('ln', 0.6, 3.6) * (1 - s.ease('off', 0.5)));
        // A starting loss far from 2.302 means trouble.
        s.alpha(s.ease('off', 0.6), () => {
          const fr = new Frame(s, [w * 0.12, h * 0.7, w * 0.76, h * 0.1], [-1, 2, 0, 1]);
          const y = fr.Y(0.5);
          s.line(fr.X(-1), y, fr.X(2), y, s.c('--axis'), 0.4);
          [0.1, 1, 10, 100].forEach((v) => s.text(String(v), fr.X(Math.log10(v)), y + u * 7.5, { size: 2.6, font: 'mono', color: s.c('--ink-3') }));
          const mk = (v: number, ok: boolean, lab: string, d: number) =>
            s.alpha(s.ease('off', 0.4, d), () => {
              const x = fr.X(Math.log10(v));
              (ok ? check : cross)(s, x, y, u * 2.1);
              s.text(lab, x, y - u * 4.6, { size: 3.2, font: 'mono', weight: 600, color: s.c(ok ? 'green' : 'red') });
            });
          mk(2.302, true, '2.302', 0.2);
          mk(0.5, false, '0.5', 1.2);
          mk(40, false, '40', 2.2);
          s.text('starting loss', fr.X(2), y + u * 12, { size: 3, italic: true, color: s.c('--ink-3'), align: 'right' });
        });
      });
    }
    // Check two: the penalty raises the loss.
    const rA = s.win('reg', 'tiny');
    if (rA > 0) {
      s.alpha(rA, () => {
        const p = s.ease('reg', 2.4, 0.8);
        const lam = 10 ** lerp(-3, 3, p);
        const bx = w / 2 - u * 8;
        const bw = u * 16;
        const base = h * 0.86;
        const unit = (base - top - u * 10) / 7;
        const dataH = unit * 2.302;
        const regH = unit * 4.5 * smooth(p);
        s.rrect(bx, base - dataH, bw, dataH, 0.5, { fill: s.tint('red', 0.6) });
        s.rrect(bx, base - dataH - regH, bw, regH, 0.5, { fill: s.tint('purple', 0.6) });
        s.line(bx - u * 4, base, bx + bw + u * 4, base, s.c('--axis'), 0.4);
        s.text('data loss 2.30', bx + bw + u * 2.5, base - dataH / 2, { size: 3.3, align: 'left', color: s.c('red'), font: 'mono' });
        s.alpha(smooth(p * 3), () => s.text('λ · penalty', bx + bw + u * 2.5, base - dataH - regH / 2, { size: 3.3, align: 'left', color: s.c('purple'), font: 'mono' }));
        s.text(`λ = ${lam < 1 ? lam.toExponential(0) : Math.round(lam).toLocaleString('en-US')}`, bx - u * 3, base - u * 6, { size: 3.6, align: 'right', color: s.c('purple'), font: 'mono', weight: 650 });
        s.alpha(s.ease('reg', 0.5, 3.4), () => {
          check(s, bx - u * 14, top + u * 8, u * 2.1);
          s.text('loss rises', bx - u * 10.5, top + u * 8.2, { size: 3.6, align: 'left', weight: 600 });
        });
      });
    }
    // Check three: memorize twenty points.
    const fA = s.ease('tiny', 0.6);
    if (fA > 0) {
      const run = sanityRuns();
      const [rp, rc] = split(s, [ax, top, aw, h - top - u * 5], 0.42, 4);
      const pp = new Frame(s, rp, [-1.1, 1.1, -1.1, 1.1], true);
      const tinySet = new Set(TINY);
      const memoP = s.since('memo') >= 0 ? smooth(s.prog('memo') * 1.15) : 0;
      const stallP = s.since('stall') >= 0 ? smooth(s.prog('stall') * 1.2) : 0;
      s.alpha(fA, () => {
        const [bx, by, bw, bh] = pp.box;
        s.rrect(bx, by, bw, bh, 1, { stroke: s.c('--rule'), lw: 0.3 });
        s.alpha(s.since('stall') >= 0 ? 1 - stallP : smooth((memoP - 0.6) / 0.35), () => regions(s, pp, run.free.region, CLASS_COLORS.slice(0, 3), 1, 'sanity-free'));
        s.alpha(stallP, () => regions(s, pp, run.reg.region, CLASS_COLORS.slice(0, 3), 1, 'sanity-reg'));
        const sel = smooth((s.prog('tiny') - 0.3) / 0.25);
        for (let i = 0; i < SPIRAL.n; i++) {
          const on = tinySet.has(i);
          const col = s.c(CLASS_COLORS[SPIRAL.y[i]!]!);
          if (on) pp.dot(SPIRAL.X[2 * i]!, SPIRAL.X[2 * i + 1]!, lerp(0.7, 1.25, sel), col);
          else s.alpha(1 - sel * 0.88, () => pp.dot(SPIRAL.X[2 * i]!, SPIRAL.X[2 * i + 1]!, 0.6, col, false));
        }
        s.alpha(sel, () => s.text(stallP > 0.5 ? '20 examples, λ = 0.01' : '20 examples, λ = 0', bx + bw / 2, by + bh + u * 3.4, { size: 3.2, font: 'mono', color: s.c(stallP > 0.5 ? 'purple' : '--ink-2') }));
        // Loss chart.
        const cf = new Frame(s, [rc[0] + u * 7, rc[1] + u * 2, rc[2] - u * 8, rc[3] - u * 8], [0, 2000, 0, 1.3]);
        const [cx, cy, cw, ch] = cf.box;
        s.line(cx, cy + ch, cx + cw, cy + ch, s.c('--axis'), 0.35);
        s.line(cx, cy, cx, cy + ch, s.c('--axis'), 0.35);
        [0, 0.5, 1].forEach((v) => s.text(String(v), cx - u * 1.2, cf.Y(v), { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' }));
        s.text('loss', cx + u, cy + u * 1.5, { size: 3, font: 'mono', color: s.c('red'), align: 'left' });
        s.text('step 2000', cx + cw, cy + ch + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        cf.poly([[0, run.l0], [2000, run.l0]], s.tint('--ink-2', 0.6), 0.3, [1.2, 1]);
        s.text('chance: ln 3 = 1.099', cx + cw, cf.Y(run.l0) - u * 2.2, { size: 2.8, font: 'mono', color: s.c('--ink-2'), align: 'right', halo: true });
        const series = (ls: number[], k: K, p: number) => {
          const n = Math.max(1, Math.round((ls.length - 1) * p));
          const pts: [number, number][] = [];
          for (let i = 0; i <= n; i++) pts.push([i * 20, ls[i]!]);
          cf.poly(pts, s.c(k), 0.6);
          return n;
        };
        const nF = series(run.free.losses, 'red', memoP);
        let nR = 0;
        if (stallP > 0) nR = series(run.reg.losses, 'purple', stallP);
        s.alpha(stallP, () => s.text('λ = 0.01: stalls', cx + cw, cf.Y(run.reg.losses[run.reg.losses.length - 1]!) - u * 2.4, { size: 3, font: 'mono', color: s.c('purple'), align: 'right', halo: true }));
        s.alpha(smooth((memoP - 0.85) / 0.15), () => s.text('λ = 0: nearly 0', cx + cw, cf.Y(0.04) - u * 2.4, { size: 3, font: 'mono', color: s.c('red'), align: 'right', halo: true }));
        const useReg = stallP > 0;
        const k = useReg ? nR : nF;
        const rr = useReg ? run.reg : run.free;
        s.slot('reg', useReg ? '0.01' : '0.0');
        s.slot('it', k * 20);
        s.slot('loss', fmt(rr.losses[k]!, 3));
        s.slot('acc', `${Math.round(rr.accs[k]! * 100)}%`);
        // The converse.
        s.alpha(s.ease('converse', 0.6), () => {
          const y = cf.Y(0.42) - u * 3;
          const x = cx + cw * 0.12;
          s.rrect(x - u * 2, y - u * 4.5, Math.min(cw * 0.84, u * 52), u * 16, 1.6, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.3 });
          check(s, x + u * 1.5, y, u * 1.9);
          s.text('passes: proves little', x + u * 5, y + u * 0.2, { size: Math.min(3.4, (cw / u) * 0.08), align: 'left' });
          cross(s, x + u * 1.5, y + u * 7, u * 1.9);
          s.text('fails: proves a bug', x + u * 5, y + u * 7.2, { size: Math.min(3.4, (cw / u) * 0.08), align: 'left' });
        });
      });
    }
  },
};

export const scenesA: Record<string, SceneDef> = { intro, gradcheck, relerr, sanity };
export { stepTiles };
