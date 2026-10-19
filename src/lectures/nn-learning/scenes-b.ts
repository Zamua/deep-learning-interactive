import { CLASS_COLORS } from '../../core/plot';
import { type Scene, type SceneDef, lerp, smooth } from '../../lecture/scene';
import { OPT_COLOR, OPT_LABEL, type OptName } from '../../lib/nn-learning-optim';
import { ACT_HISTS, ADAM_T, EPOCHS, FILTERS, GAP_ITERS, LR_RUNS, SADDLE, STEP_T, VALLEY, WAVY_FLIPPED, WAVY_TRAIN, adamStream, gapRuns, lrRuns, saddleTrails, stepSizes, valleyTrails } from './data';
import { type K, type Rect, Frame, area, at, contours, legend, regions, split, star } from './kit';

/** A horizontal legend row centered at (cx, y). */
function legendRow(s: Scene, cx: number, y: number, items: { label: string; k: K; a?: number }[], size = 3.2): void {
  const gap = s.u * 3.2;
  const ws = items.map((it) => s.measure(it.label, { size, font: 'ui', weight: 550 }) + size * 1.6 * s.u);
  const tot = ws.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let x = cx - tot / 2;
  items.forEach((it, i) => {
    s.alpha(it.a ?? 1, () => {
      s.circle(x + size * 0.4 * s.u, y, size * 0.36 * s.u, { fill: s.c(it.k) });
      s.text(it.label, x + size * 1.2 * s.u, y + s.u * 0.15, { size, font: 'ui', weight: 550, align: 'left', color: s.c('--ink-2') });
    });
    x += ws[i]! + gap;
  });
}

/** Axis lines on the left and bottom of a box. */
function axes(s: Scene, r: Rect): void {
  const [x, y, w, h] = r;
  s.line(x, y + h, x + w, y + h, s.c('--axis'), 0.35);
  s.line(x, y, x, y + h, s.c('--axis'), 0.35);
}

// ---------------------------------------------------------------- loss curves

const losscurve: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const runs = lrRuns();
    const [ax, ay, aw, ah] = area(s, 0.13, 0.05);
    const box: Rect = [ax + u * 8, ay + u * 2, aw - u * 9, ah - u * 15];
    const [bx, by, bw, bh] = box;
    const X = (e: number) => bx + (e / EPOCHS) * bw;
    // Linear axis 0..1.6, morphing to a log axis 0.2..30 for the last beat.
    const lp = s.ease('logscale', 1.6, 0.4);
    const frac = (v: number) => {
      const lin = v / 1.6;
      const lg = (Math.log10(Math.max(v, 1e-3)) - Math.log10(0.2)) / (Math.log10(30) - Math.log10(0.2));
      return lerp(lin, lg, lp);
    };
    const Y = (v: number) => by + bh * (1 - frac(v));
    s.alpha(s.ease('watch', 0.6), () => {
      axes(s, box);
      s.alpha(1 - lp, () =>
        [0.4, 0.8, 1.2, 1.6].forEach((v) => {
          s.line(bx, Y(v), bx + bw, Y(v), s.c('--grid'), 0.25);
          s.text(String(v), bx - u * 1.2, Y(v), { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        }),
      );
      s.alpha(lp, () =>
        [0.3, 1, 3, 10, 30].forEach((v) => {
          s.line(bx, Y(v), bx + bw, Y(v), s.c('--grid'), 0.25);
          s.text(String(v), bx - u * 1.2, Y(v), { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        }),
      );
      [0, 10, 20, 30, 40].forEach((e) => s.text(String(e), X(e), by + bh + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
      s.text('epoch →', bx + bw, by + bh + u * 6.6, { size: 3, font: 'mono', color: s.c('--ink-2'), align: 'right' });
      s.text(lp > 0.5 ? 'loss (log scale)' : 'loss', bx + u * 1.5, by + u * 1.2, { size: 3, font: 'mono', color: s.c('red'), align: 'left', halo: true });
    });
    s.alpha(s.win('watch', 'four') * s.ease('watch', 0.6, 2.4), () => {
      s.text('1 epoch = one pass over all N examples', bx + bw / 2, by + bh * 0.5, { size: 3.6, italic: true, color: s.c('--ink-2') });
      s.ctx.fillStyle = s.tint('--accent', 0.12);
      const e = (s.since('watch') * 2) % EPOCHS;
      s.ctx.fillRect(X(Math.floor(e)), by, X(1) - X(0), bh);
    });
    // Which run is being talked about, and how far each curve is drawn.
    const beats = ['low', 'good', 'high', 'vhigh'];
    const drawn = (i: number) => (s.since(beats[i]!) >= 0 ? smooth(s.prog(beats[i]!) * 1.25) : 0);
    let sel = 1;
    beats.forEach((b, i) => {
      if (s.since(b) >= 0 && s.since('wiggle') < 0) sel = i;
    });
    s.slot('lr', String(LR_RUNS[sel]!.lr));
    s.slot('name', LR_RUNS[sel]!.name);
    const dim = 1 - 0.7 * s.win('plateau', 'logscale');
    const c = s.ctx;
    c.save();
    c.beginPath();
    c.rect(bx, by - u * 0.5, bw, bh + u * 0.5);
    c.clip();
    // Per-batch losses of the good run behind its epoch curve.
    s.alpha(s.ease('wiggle', 0.8) * dim, () => {
      const r = runs[1]!;
      c.beginPath();
      r.iters.forEach((e, i) => (i ? c.lineTo(X(e), Y(Math.min(r.batch[i]!, 40))) : c.moveTo(X(e), Y(r.batch[i]!))));
      c.strokeStyle = s.tint('green', 0.4);
      c.lineWidth = u * 0.25;
      c.stroke();
    });
    runs.forEach((r, i) => {
      const p = drawn(i);
      if (p <= 0) return;
      const n = Math.max(1, Math.round((r.epochs.length - 1) * p));
      c.beginPath();
      for (let e = 0; e <= n; e++) {
        const y = Y(Math.min(r.epochs[e]!, 60));
        if (e) c.lineTo(X(e), y);
        else c.moveTo(X(e), y);
      }
      c.strokeStyle = s.tint(r.col, dim);
      c.lineWidth = u * (i === sel && s.since('wiggle') < 0 ? 0.75 : 0.55);
      c.lineJoin = 'round';
      c.stroke();
    });
    c.restore();
    s.alpha(drawn(3) * (1 - lp) * dim, () => s.text('very high: off the chart ↑', X(3), by + u * 6.5, { size: 3.2, color: s.c('red'), align: 'left', halo: true, weight: 600 }));
    s.alpha(s.win('four', 'low'), () => {
      s.circle(X(0), Y(runs[0]!.epochs[0]!), u * 1.4, { fill: s.c('--ink') });
      s.text('same network, same start', X(0) + u * 3, Y(runs[0]!.epochs[0]!), { size: 3.3, align: 'left', color: s.c('--ink-2'), halo: true });
    });
    s.alpha(s.ease('wiggle', 0.6, 1) * (1 - s.ease('plateau', 0.4)), () => {
      s.text('each mini-batch: noisy', X(39), Y(0.12), { size: 3.2, color: s.c('green'), align: 'right', halo: true });
      s.text('full training set: smooth', X(39), Y(0.5) - u * 1.5, { size: 3.2, color: s.c('green'), align: 'right', halo: true, weight: 650 });
    });
    // A plateau, then a drop: the shape of a bad initialization.
    s.alpha(s.win('plateau', 'logscale'), () => {
      const iw = Math.min(bw * 0.62, u * 56);
      const ih = Math.min(bh * 0.55, u * 30);
      const ix = bx + bw - iw - u;
      const iy = by + u * 1.5;
      s.rrect(ix, iy, iw, ih, 1.6, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.3 });
      const fr = new Frame(s, [ix + u * 3, iy + u * 7, iw - u * 6, ih - u * 10], [0, 1, 0, 1.2]);
      axes(s, fr.box);
      const p = s.ease('plateau', 2.2, 0.3);
      fr.fn((x) => 1.05 - 0.75 / (1 + Math.exp(-(x - 0.55) * 22)) + 0.015 * Math.sin(x * 60), s.c('red'), 0.6, 0, Math.max(0.01, p));
      s.text('plateau, then a drop: bad init', ix + iw / 2, iy + u * 3.6, { size: 3.2, weight: 600, color: s.c('--ink-2') });
    });
    // Legend row under the chart.
    legendRow(
      s,
      w / 2,
      h - u * 5.5,
      runs.map((r, i) => ({ label: `${r.name} ${r.lr}`, k: r.col, a: s.since('four') < 0 ? 0 : s.since('low') < 0 ? 1 : drawn(i) > 0 ? 1 : 0.35 })),
      s.tall ? 2.9 : 3.2,
    );
  },
};

// ---------------------------------------------------------------- train vs validation

const gap: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Train/val curves and the decision regions.
    const pA = s.win('second', 'ratio');
    if (pA > 0) {
      const g = gapRuns();
      const [rp, rc] = split(s, area(s, 0.13, 0.05), s.tall ? 0.46 : 0.44, 4);
      const pp = new Frame(s, rp, [-1.05, 1.05, -1.05, 1.05], true);
      const which = s.since('lin') >= 0 ? 2 : s.since('fix') >= 0 ? 1 : 0;
      const keys = ['over', 'regd', 'lin'] as const;
      const runA = (i: number) => {
        const b = ['over', 'fix', 'lin'][i]!;
        const nb = ['fix', 'lin', ''][i];
        return s.ease(b, 0.7) * (nb ? 1 - s.ease(nb, 0.7) : 1);
      };
      s.alpha(pA, () => {
        // Region panel.
        const tA = s.ease('task', 0.6);
        s.alpha(tA, () => {
          const [bx, by, bw, bh] = pp.box;
          s.rrect(bx, by, bw, bh, 1, { stroke: s.c('--rule'), lw: 0.3 });
          keys.forEach((k, i) => {
            const a = runA(i) * (i === 0 ? smooth((s.prog('over') - 0.2) / 0.3) + (s.since('gapmeans') >= 0 ? 1 : 0) : 1);
            if (a > 0) regions(s, pp, g[k].region, CLASS_COLORS.slice(0, 2), Math.min(1, a) * 1.4, `gap-${k}`);
          });
          const bpts: [number, number][] = [];
          for (let i = 0; i <= 80; i++) {
            const a = -1.05 + (2.1 * i) / 80;
            bpts.push([a, 0.5 * Math.sin(4 * a)]);
          }
          pp.clip(() => pp.poly(bpts, s.tint('--ink', 0.45), 0.35, [1.2, 1]));
          for (let i = 0; i < WAVY_TRAIN.n; i++) {
            const x = WAVY_TRAIN.X[2 * i]!;
            const y = WAVY_TRAIN.X[2 * i + 1]!;
            pp.dot(x, y, 1.05, s.c(CLASS_COLORS[WAVY_TRAIN.y[i]!]!));
            if (WAVY_FLIPPED[i]) s.alpha(smooth((s.prog('task') - 0.6) / 0.2), () => s.circle(pp.X(x), pp.Y(y), u * 2.1, { stroke: s.c('red'), lw: 0.4 }));
          }
          s.alpha(smooth((s.prog('task') - 0.6) / 0.2), () => s.text('ringed: wrong label', bx + bw / 2, by + bh + u * 3.4, { size: 3, color: s.c('red'), font: 'mono' }));
        });
        // Accuracy chart.
        const cf = new Frame(s, [rc[0] + u * 8, rc[1] + u * 1, rc[2] - u * 9, rc[3] - u * 11], [0, GAP_ITERS, 0.45, 1.02]);
        const box = cf.box;
        axes(s, box);
        [0.6, 0.8, 1].forEach((v) => {
          s.line(box[0], cf.Y(v), box[0] + box[2], cf.Y(v), s.c('--grid'), 0.25);
          s.text(`${Math.round(v * 100)}%`, box[0] - u * 1.2, cf.Y(v), { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        });
        cf.poly([[0, 0.9], [GAP_ITERS, 0.9]], s.tint('--ink-2', 0.5), 0.3, [1, 1]);
        s.alpha(1 - s.ease('gapmeans', 0.5), () => s.text('best possible 90%', cf.X(GAP_ITERS * 0.3), cf.Y(0.9) - u * 2.2, { size: 2.7, font: 'mono', color: s.c('--ink-3'), align: 'left', halo: true }));
        s.text('steps →', box[0] + box[2], box[1] + box[3] + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        legendRow(s, box[0] + box[2] / 2, box[1] + box[3] + u * 8, [
          { label: 'train', k: 'blue' },
          { label: 'validation', k: 'orange' },
        ], 3.1);
        keys.forEach((k, i) => {
          const a = runA(i);
          if (a <= 0) return;
          const r = g[k];
          const b = ['over', 'fix', 'lin'][i]!;
          const p = smooth(s.prog(b) * 1.3);
          const n = Math.max(1, Math.round((r.tr.length - 1) * p));
          const pts = (arr: number[]) => arr.slice(0, n + 1).map((v, j) => [j * 25, v] as [number, number]);
          s.alpha(a, () => {
            cf.poly(pts(r.tr), s.c('blue'), 0.6);
            cf.poly(pts(r.va), s.c('orange'), 0.6);
          });
          if (i === which) s.slot('gap', Math.round((r.tr[n]! - r.va[n]!) * 100));
          // The gap, bracketed at the right end.
          const bA = a * (i === 0 ? s.ease('gapmeans', 0.6) : smooth((p - 0.8) / 0.2));
          s.alpha(bA, () => {
            const last = r.tr.length - 1;
            const x = cf.X(GAP_ITERS) - u * 2;
            const y0 = cf.Y(r.tr[last]!);
            const y1 = cf.Y(r.va[last]!);
            const pts2 = Math.round((r.tr[last]! - r.va[last]!) * 100);
            if (Math.abs(y1 - y0) > u * 1.5) {
              s.line(x, y0, x, y1, s.c('--ink'), 0.4);
              s.line(x - u, y0, x + u * 0.2, y0, s.c('--ink'), 0.4);
              s.line(x - u, y1, x + u * 0.2, y1, s.c('--ink'), 0.4);
            }
            const lab = i === 2 ? 'no gap, but low' : `gap ${pts2} pts`;
            s.text(lab, x - u * 2, i === 2 ? y1 + u * 4.5 : (y0 + y1) / 2, { size: 3.3, weight: 650, align: 'right', halo: true, color: s.c(i === 0 ? 'red' : '--ink') });
          });
        });
      });
    }
    // The update-to-weight ratio for the four learning rates.
    const qA = s.win('ratio', 'hist');
    if (qA > 0) {
      const runs = lrRuns();
      s.alpha(qA, () => {
        const [ax, , aw] = area(s, 0.13, 0.1);
        const fr = new Frame(s, [ax, h * 0.3, aw, h * 0.3], [-5, -1, 0, 1]);
        const y = h * 0.52;
        s.text('norm(update) / norm(W)', w / 2, h * 0.24, { size: 3.8, font: 'mono', weight: 600 });
        s.rrect(fr.X(-3.4), y - u * 3, fr.X(-2.6) - fr.X(-3.4), u * 6, 1, { fill: s.tint('green', 0.22), stroke: s.tint('green', 0.6), lw: 0.3 });
        s.text('about right', fr.X(-3), y + u * 10, { size: 3.2, color: s.c('green'), weight: 650, halo: true });
        s.line(fr.X(-5), y, fr.X(-1), y, s.c('--axis'), 0.4);
        for (let e = -5; e <= -1; e++) {
          s.line(fr.X(e), y - u, fr.X(e), y + u, s.c('--axis'), 0.35);
          s.text(`1e${e}`, fr.X(e), y + u * 4, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
        }
        runs.forEach((r, i) => {
          const a = s.ease('ratio', 0.5, 1.6 + i * 0.5);
          s.alpha(a, () => {
            const x = fr.X(r.ratio);
            s.circle(x, y, u * 1.5, { fill: s.c(r.col), stroke: s.c('--card'), lw: 0.3 });
            const below = i === 0 || i === 2;
            const ly = below ? y + u * 10 : y - u * 12;
            s.line(x, y + (below ? u * 1.8 : -u * 1.8), x, ly + (below ? -u * 2 : u * 2), s.tint(r.col, 0.6), 0.25);
            s.text(r.name, x, ly, { size: 3.3, color: s.c(r.col), weight: 650, halo: true });
          });
        });
      });
    }
    // Activation histograms.
    const hA = s.win('hist', 'filt');
    if (hA > 0) {
      s.alpha(hA, () => {
        const [ax, ay, aw, ah] = area(s, 0.16, 0.06);
        const titles: [string, K][] = [
          ['weights too small', 'red'],
          ['weights too large', 'red'],
          ['about right', 'green'],
        ];
        const gw = (aw - u * 12) / 3;
        titles.forEach(([t, k], i) => {
          const a = s.ease('hist', 0.5, 0.4 + i * 1.6);
          s.alpha(a, () => {
            const x0 = ax + i * (gw + u * 6);
            const top = ay + u * 10;
            const bh = ah * 0.55;
            const bins = ACT_HISTS[i]!;
            const bw = gw / bins.length;
            bins.forEach((v, j) => s.rrect(x0 + j * bw + bw * 0.08, top + bh * (1 - v), bw * 0.84, bh * v, 0.2, { fill: s.tint(k, 0.55) }));
            s.line(x0, top + bh, x0 + gw, top + bh, s.c('--axis'), 0.3);
            ['−1', '0', '1'].forEach((l, q) => s.text(l, x0 + (q * gw) / 2, top + bh + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
            s.text(t, x0 + gw / 2, ay + u * 4, { size: Math.min(3.4, (gw / u) * 0.11), weight: 650, color: s.c(k) });
            (i === 2 ? checkMark : crossMark)(s, x0 + gw / 2, top + bh + u * 10);
          });
        });
        s.alpha(s.ease('hist', 0.5, 0.4), () => s.text('tanh activations of one layer', w / 2, h - u * 6, { size: 3.3, italic: true, color: s.c('--ink-2') }));
      });
    }
    // First-layer filters as pictures.
    const fA = s.ease('filt', 0.6);
    if (fA > 0) {
      s.alpha(fA, () => {
        const [r0, r1] = split(s, area(s, 0.15, 0.06), 0.5, 6);
        const grid = (r: Rect, set: [number, number, number][][][], title: string, ok: boolean, a: number) =>
          s.alpha(a, () => {
            const [x, y, rw, rh] = r;
            const size = Math.min(rw, rh - u * 10);
            const x0 = x + (rw - size) / 2;
            const y0 = y + u * 8;
            const cell = size / 4;
            set.forEach((f, q) => {
              const fx = x0 + (q % 4) * cell;
              const fy = y0 + Math.floor(q / 4) * cell;
              const px = (cell - u * 0.8) / f.length;
              f.forEach((row, i) =>
                row.forEach(([r2, g2, b2], j) => {
                  s.ctx.fillStyle = `rgb(${r2 | 0},${g2 | 0},${b2 | 0})`;
                  s.ctx.fillRect(fx + j * px, fy + i * px, px + 0.4, px + 0.4);
                }),
              );
            });
            s.text(title, x + rw / 2, y + u * 3.4, { size: 3.6, weight: 650, color: s.c(ok ? 'green' : 'red') });
          });
        grid(r0, FILTERS.noisy, 'noisy: a warning sign', false, s.ease('filt', 0.5, 2));
        grid(r1, FILTERS.clean, 'smooth, varied: healthy', true, s.ease('filt', 0.5, 4));
      });
    }
  },
};

function checkMark(s: Scene, x: number, y: number): void {
  s.circle(x, y, s.u * 1.9, { fill: s.c('green') });
  s.line(x - s.u * 0.9, y, x - s.u * 0.2, y + s.u * 0.7, '#fff', 0.45);
  s.line(x - s.u * 0.2, y + s.u * 0.7, x + s.u, y - s.u * 0.7, '#fff', 0.45);
}
function crossMark(s: Scene, x: number, y: number): void {
  s.circle(x, y, s.u * 1.9, { fill: s.c('red') });
  const d = s.u * 0.8;
  s.line(x - d, y - d, x + d, y + d, '#fff', 0.45);
  s.line(x - d, y + d, x + d, y - d, '#fff', 0.45);
}

// ---------------------------------------------------------------- momentum and Nesterov

/** The valley frame shared by the momentum and adaptive scenes: top of the stage, below the chip. */
function valleyFrame(s: Scene): Frame {
  const [ax, ay, aw, ah] = area(s, 0.12, 0.05);
  return new Frame(s, [ax, ay, aw, ah * (s.tall ? 0.6 : 0.66)], VALLEY.domain, true);
}

function drawValley(s: Scene, fr: Frame, a = 1): void {
  contours(s, fr, VALLEY, a);
  s.alpha(a, () => {
    star(s, fr.X(0), fr.Y(0), s.u * 2, s.c('--ink'));
    fr.dot(VALLEY.start[0], VALLEY.start[1], 0.9, s.c('--ink'));
  });
}

const momentum: SceneDef = {
  marks: {
    sgd: { tex: String.raw`\symw \leftarrow \symw - \symlr\,\symdw`, x: 0.5, y: 0.84, size: 5.4 },
    mom: { tex: String.raw`v \leftarrow \symmu\,v - \symlr\,\symdw, \quad \symw \leftarrow \symw + v`, x: 0.5, y: 0.82, size: 5 },
    nes: { tex: String.raw`v \leftarrow \symmu\,v - \symlr\,\nabla L(\symw + \symmu v)`, x: 0.5, y: 0.82, size: 5 },
  },
  draw(s) {
    const { h, u } = s;
    const T = valleyTrails();
    const fr = valleyFrame(s);
    drawValley(s, fr, s.ease('what', 0.7));
    const sg = T.sgd!;
    const mo = T.momentum!;
    const ne = T.nesterov!;
    const below = fr.box[1] + fr.box[3];
    s.show('sgd', s.win('sgd', 'ball'), { y: (below + u * 9) / h });
    s.show('mom', s.win('mu', 'nesterov'), { y: (below + u * 8) / h });
    s.show('nes', s.ease('nesterov', 0.6), { y: (below + u * 8) / h });
    // The first SGD step: mostly across the valley.
    s.alpha(s.win('sgd', 'zig'), () => {
      const [x0, y0] = VALLEY.start;
      const [gx, gy] = VALLEY.g(x0, y0);
      fr.arrow(x0, y0, x0 - VALLEY.lr.sgd * gx, y0 - VALLEY.lr.sgd * gy, s.c('teal'), 0.7);
      s.text('−η∇L', fr.X(x0 - VALLEY.lr.sgd * gx) + u * 1.5, fr.Y(y0 - VALLEY.lr.sgd * gy * 0.5), { size: 3.4, font: 'mono', color: s.c('teal'), align: 'left', halo: true });
    });
    // SGD zigzags.
    const nS = s.since('zig') >= 0 ? 60 * smooth(s.prog('zig') * 1.1) : 0;
    const sgA = s.since('ball') >= 0 ? 0.3 : 1;
    s.alpha(sgA, () => fr.trail(sg.xs, sg.ys, nS + 1, s.c(OPT_COLOR.sgd), 0.45));
    s.alpha(s.win('zig', 'ball') * smooth((s.prog('zig') - 0.15) / 0.15), () => {
      fr.arrow(-3.2, -1.9, -3.2, 1.9, s.tint('--ink-2', 0.7), 0.35, 2);
      fr.arrow(-3.2, 1.9, -3.2, -1.9, s.tint('--ink-2', 0.7), 0.35, 2);
      s.text('steep', fr.X(-3.2) + u * 1.5, fr.Y(1.5), { size: 3.2, align: 'left', color: s.c('--ink-2'), halo: true });
      fr.arrow(-1.8, -1.95, 1.8, -1.95, s.tint('--ink-2', 0.7), 0.35, 2);
      s.text('shallow: the progress is here', fr.X(0), fr.Y(-1.95) - u * 2.4, { size: 3.2, color: s.c('--ink-2'), halo: true });
    });
    // Momentum: a ball with a velocity.
    const mA = s.ease('ball', 0.6);
    if (mA > 0) {
      let nM = 0;
      if (s.since('ball') >= 0) nM = lerp(0, 34, s.span('ball', 'mu'));
      if (s.since('mu') >= 0) nM = lerp(34, 60, s.span('mu', 'overshoot'));
      if (s.since('overshoot') >= 0) nM = lerp(60, 160, smooth(s.prog('overshoot')));
      const moA = s.since('nesterov') >= 0 ? 0.35 : 1;
      s.alpha(mA * moA, () => fr.trail(mo.xs, mo.ys, nM + 1, s.c(OPT_COLOR.momentum), 0.55));
      const [px, py] = at(mo.xs, mo.ys, nM);
      const [qx, qy] = at(mo.xs, mo.ys, Math.max(0, nM - 1));
      s.alpha(mA * s.win('ball', 'nesterov'), () => {
        const vx = px - qx;
        const vy = py - qy;
        if (s.since('ball') >= 0 && Math.hypot(vx, vy) > 0.01) fr.arrow(px, py, px + vx * 2.2, py + vy * 2.2, s.c('blue'), 0.55, 2.2);
        const [gx, gy] = VALLEY.g(px, py);
        s.alpha(smooth((s.prog('ball') - 0.55) / 0.15) + (s.since('cancel') >= 0 ? 1 : 0), () => fr.arrow(px, py, px - gx * 0.12, py - gy * 0.12, s.c('teal'), 0.5, 2));
        s.circle(fr.X(px), fr.Y(py), u * 1.8, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
        s.circle(fr.X(px) - u * 0.5, fr.Y(py) - u * 0.5, u * 0.5, { fill: s.tint('--card', 0.7) });
      });
      s.alpha(s.win('ball', 'mu') * smooth((s.prog('ball') - 0.55) / 0.15), () =>
        legend(s, fr.box[0] + fr.box[2] - u, fr.box[1] + u, [
          { label: 'velocity', k: 'blue' },
          { label: 'gradient force', k: 'teal' },
        ], { size: 3, align: 'right' }),
      );
      s.alpha(s.win('cancel', 'mu'), () => {
        s.text('sideways pushes cancel', fr.X(-1), fr.Y(1.95), { size: 3.2, color: s.c('--ink-2'), halo: true });
        s.text('the push along the floor adds up →', fr.X(0.6), fr.Y(-1.95), { size: 3.2, color: s.c('blue'), halo: true, weight: 600 });
      });
      s.alpha(s.ease('mu', 0.6, 1.2) * (1 - s.ease('nesterov', 0.5)), () =>
        s.text('μ = 0.9: steps up to 1/(1 − μ) = 10× larger', fr.X(0), below + u * 16, { size: 3.2, font: 'mono', color: s.c('gold') }),
      );
      // The overshoot past the minimum.
      s.alpha(s.win('overshoot', 'nesterov') * s.ease('overshoot', 0.5, 1), () => {
        let mx = 0;
        for (let i = 0; i < mo.xs.length; i++) if (mo.xs[i]! > mo.xs[mx]!) mx = i;
        s.circle(fr.X(mo.xs[mx]!), fr.Y(mo.ys[mx]!), u * 3.2, { stroke: s.c('--accent'), lw: 0.5 });
        s.text('overshoot', fr.X(mo.xs[mx]!), fr.Y(mo.ys[mx]!) - u * 5, { size: 3.4, weight: 650, color: s.c('--accent'), halo: true });
      });
    }
    // Nesterov: the gradient at the look-ahead point.
    const nA = s.ease('nesterov', 0.6);
    if (nA > 0) {
      // Just before the first overshoot: momentum is about to carry the ball past the minimum.
      let k = 1;
      while (k < mo.xs.length - 1 && mo.xs[k]! < -0.7) k++;
      const wx = mo.xs[k]!;
      const wy = mo.ys[k]!;
      const vx = wx - mo.xs[k - 1]!;
      const vy = wy - mo.ys[k - 1]!;
      // Drawn longer than true scale so the arrows read on a phone.
      const vs = 2.4 / Math.max(1e-6, Math.hypot(vx, vy));
      const ahx = wx + 0.9 * vx * vs;
      const ahy = wy + 0.9 * vy * vs;
      // The along-the-floor part of the gradient there: the part that brakes.
      const gx = Math.sign(VALLEY.g(ahx, ahy)[0]) * 1.5;
      const gy = 0;
      s.alpha(nA * s.win('nesterov', 'ahead'), () => {
        fr.dot(wx, wy, 1.2, s.c('blue'));
        s.alpha(s.ease('nesterov', 0.5, 1.2), () => {
          fr.arrow(wx, wy, ahx, ahy, s.c('gold'), 0.55, 2.2);
          s.circle(fr.X(ahx), fr.Y(ahy), u * 1.2, { stroke: s.c('gold'), lw: 0.45, fill: s.c('--card') });
          s.text('μv: look ahead', (fr.X(wx) + fr.X(ahx)) / 2, Math.min(fr.Y(wy), fr.Y(ahy)) - u * 4.4, { size: 3.2, color: s.c('gold'), halo: true, weight: 600 });
        });
        s.alpha(s.ease('nesterov', 0.5, 3.2), () => {
          fr.arrow(ahx, ahy, ahx - gx, ahy - gy, s.c('teal'), 0.55, 2.2);
          s.text('gradient there: brake', fr.X(ahx) + u * 2, fr.Y(ahy) + u * 4.4, { size: 3.2, color: s.c('teal'), halo: true, weight: 600, align: 'left' });
        });
      });
      const nN = s.since('ahead') >= 0 ? 160 * smooth(s.prog('ahead') * 1.2) : 0;
      s.alpha(s.ease('ahead', 0.5), () => fr.trail(ne.xs, ne.ys, nN + 1, s.c(OPT_COLOR.nesterov), 0.6));
      s.alpha(s.ease('ahead', 0.6, 1), () =>
        legend(s, fr.box[0] + fr.box[2] - u, fr.box[1] + u, (['sgd', 'momentum', 'nesterov'] as OptName[]).map((n) => ({ label: OPT_LABEL[n], k: OPT_COLOR[n] })), { size: 3, align: 'right' }),
      );
    }
  },
};

// ---------------------------------------------------------------- adaptive

const adaptive: SceneDef = {
  marks: {
    betas: { tex: String.raw`\beta_1 = 0.9,\quad \beta_2 = 0.999,\quad \epsilon = 10^{-8}`, x: 0.5, y: 0.88, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: per-parameter steps on the valley.
    const vA = s.win('one', 'decay');
    if (vA > 0) {
      const T = valleyTrails();
      const fr = valleyFrame(s);
      s.alpha(vA, () => {
        drawValley(s, fr);
        s.alpha(0.3, () => fr.trail(T.sgd!.xs, T.sgd!.ys, 60, s.c(OPT_COLOR.sgd), 0.4));
        const nV = s.since('valley') >= 0 ? 90 * smooth(s.prog('valley') * 1.1) : 0;
        s.alpha(s.ease('valley', 0.4), () => {
          fr.trail(T.adagrad!.xs, T.adagrad!.ys, nV + 1, s.c(OPT_COLOR.adagrad), 0.6);
          fr.trail(T.rmsprop!.xs, T.rmsprop!.ys, nV + 1, s.c(OPT_COLOR.rmsprop), 0.6);
          legend(s, fr.box[0] + fr.box[2] - u, fr.box[1] + u, (['sgd', 'adagrad', 'rmsprop'] as OptName[]).map((n) => ({ label: OPT_LABEL[n], k: OPT_COLOR[n], a: n === 'sgd' ? 0.5 : 1 })), { size: 3, align: 'right' });
        });
        // Two parameters, their gradients and their steps.
        const below = fr.box[1] + fr.box[3] + u * 4;
        const [gx, gy] = VALLEY.g(...VALLEY.start);
        const rows: [string, number][] = [
          ['w₁ along', Math.abs(gx)],
          ['w₂ across', Math.abs(gy)],
        ];
        const lx = w * 0.08;
        const barX = lx + u * 18;
        const full = w * 0.9 - barX;
        const norm = s.ease('norm', 1.2, 0.3);
        const cacheA = s.ease('ada', 0.6, 1.2);
        const rh = Math.min(u * 7, (h - below - u * 4) / 2.4);
        rows.forEach(([lab, g], i) => {
          const y = below + i * rh * 1.15;
          s.text(lab, lx, y + rh / 2, { size: 3.2, font: 'mono', align: 'left', color: s.c('blue') });
          const len = (g / 5.2) * full * 0.62;
          const step = lerp(len, full * 0.3, norm);
          s.rrect(barX, y + rh * 0.12, Math.max(u * 0.6, step), rh * 0.76, 0.8, { fill: s.tint('teal', 0.55) });
          s.text(norm > 0.5 ? 'step ≈ η' : `|grad| ${g.toFixed(2)}`, barX + Math.max(u * 0.6, step) + u * 1.5, y + rh / 2, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-2') });
        });
        s.alpha(cacheA, () => s.text(norm > 0.5 ? 'after ÷ √cache' : 'then ÷ √cache', w * 0.9, below - u * 1.2, { size: 3.1, font: 'mono', align: 'right', color: s.c('green'), weight: 650 }));
      });
    }
    // Phase 2: Adagrad's step keeps shrinking; RMSprop's recovers.
    const dA = s.win('decay', 'adam');
    if (dA > 0) {
      const st = stepSizes();
      s.alpha(dA, () => {
        const [ax, ay, aw, ah] = area(s, 0.14, 0.05);
        const fr = new Frame(s, [ax + u * 8, ay + u * 6, aw - u * 9, ah - u * 16], [0, STEP_T, 0, 1.15]);
        axes(s, fr.box);
        s.text('effective step size, for one parameter', fr.box[0], ay + u * 1.5, { size: 3.3, align: 'left', color: s.c('--ink-2'), weight: 600 });
        s.text('steps →', fr.box[0] + fr.box[2], fr.box[1] + fr.box[3] + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        fr.poly([[STEP_T / 2, 0], [STEP_T / 2, 1.15]], s.tint('--ink-2', 0.5), 0.3, [1, 1]);
        s.text('gradients shrink 10×', fr.X(STEP_T / 2) + u * 1.5, fr.Y(1.05), { size: 3, color: s.c('--ink-2'), align: 'left', halo: true });
        const sc = (arr: number[], k: K, p: number, scale: number) => {
          const n = Math.max(1, Math.round(arr.length * p));
          fr.poly(arr.slice(0, n).map((v, i) => [i, Math.min(1.12, v * scale)] as [number, number]), s.c(k), 0.6);
        };
        sc(st.ada, OPT_COLOR.adagrad, s.ease('decay', 2.6, 0.3), 1);
        sc(st.rms, OPT_COLOR.rmsprop, s.since('rms') >= 0 ? s.ease('rms', 2.6, 0.8) : 0, 0.1);
        legendRow(s, w / 2, h - u * 5.5, [
          { label: 'Adagrad: a sum, only grows', k: OPT_COLOR.adagrad },
          { label: 'RMSprop: a moving average', k: OPT_COLOR.rmsprop, a: s.ease('rms', 0.5) },
        ], s.tall ? 2.8 : 3.1);
      });
    }
    // Phase 3: Adam's two averages and the bias correction.
    const aA = s.win('adam', 'saddle');
    if (aA > 0) {
      const st = adamStream();
      s.alpha(aA, () => {
        const [ax, ay, aw, ah] = area(s, 0.14, 0.05);
        const fr = new Frame(s, [ax + u * 8, ay + u * 6, aw - u * 9, ah - u * 22], [0, ADAM_T, -0.4, 2.4]);
        axes(s, fr.box);
        s.text('one parameter, step by step', fr.box[0], ay + u * 1.5, { size: 3.3, align: 'left', color: s.c('--ink-2'), weight: 600 });
        [0, 1, 2].forEach((v) => s.text(String(v), fr.box[0] - u * 1.2, fr.Y(v), { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' }));
        const p = s.ease('adam', 3, 0.3);
        const n = Math.max(1, Math.round(ADAM_T * p));
        for (let i = 0; i < n; i++) s.circle(fr.X(i + 1), fr.Y(st.g[i]!), u * 0.55, { fill: s.tint('teal', 0.6) });
        const line = (arr: number[], k: K, width: number, dash?: number[]) => fr.poly(arr.slice(0, n).map((v, i) => [i + 1, v] as [number, number]), s.c(k), width, dash);
        line(st.mt, 'purple', 0.7);
        s.alpha(smooth((s.prog('adam') - 0.5) / 0.2) + (s.since('bias') >= 0 ? 1 : 0), () => line(st.sv, 'green', 0.6));
        s.alpha(s.ease('bias', 0.6, 0.5), () => line(st.raw, 'purple', 0.45, [1.2, 1]));
        const rows: { label: string; k: K; a?: number }[] = [
          { label: 'gradient', k: 'teal' },
          { label: 'm: average gradient', k: 'purple' },
          { label: '√v: typical size', k: 'green', a: smooth((s.prog('adam') - 0.5) / 0.2) },
        ];
        legendRow(s, w / 2, fr.box[1] + fr.box[3] + u * 5, rows, s.tall ? 2.7 : 3.1);
        s.alpha(s.ease('bias', 0.6, 1.6), () => {
          s.text('m uncorrected: starts at 0', fr.X(4), fr.Y(0.12), { size: 3, color: s.c('purple'), align: 'left', halo: true });
          s.text('÷ (1 − β₁ᵗ): right from step 1', fr.X(ADAM_T * 0.98), fr.Y(2.15), { size: 3, color: s.c('purple'), align: 'right', halo: true, weight: 650 });
        });
        s.show('betas', s.ease('defaults', 0.6), { y: (h - u * 7) / h });
      });
    }
    // Phase 4: the saddle.
    const sA = s.ease('saddle', 0.6);
    if (sA > 0) {
      const T = saddleTrails();
      s.alpha(sA, () => {
        const fr = new Frame(s, area(s, 0.12, 0.04), SADDLE.domain, true);
        contours(s, fr, SADDLE, 1);
        for (const [mx, my] of SADDLE.minima) star(s, fr.X(mx), fr.Y(my), u * 2, s.c('--ink'));
        s.text('saddle point', fr.X(0), fr.Y(0) + u * 4.4, { size: 3.1, color: s.c('--ink-2'), halo: true });
        s.circle(fr.X(0), fr.Y(0), u * 0.9, { fill: s.c('--ink-2') });
        const names: OptName[] = ['sgd', 'momentum', 'adagrad', 'rmsprop', 'adam'];
        const n = s.since('escape') >= 0 ? lerp(25, 160, smooth(s.prog('escape') * 1.1)) : 25 * s.prog('saddle');
        for (const nm of names) {
          const wk = T[nm]!;
          fr.trail(wk.xs, wk.ys, n + 1, s.c(OPT_COLOR[nm]), nm === 'sgd' || nm === 'momentum' ? 0.7 : 0.55);
          const [px, py] = at(wk.xs, wk.ys, n);
          fr.dot(px, py, 0.95, s.c(OPT_COLOR[nm]));
        }
        fr.dot(SADDLE.start[0], SADDLE.start[1], 0.8, s.c('--ink'));
        const [bx, by, bw] = fr.box;
        legend(s, bx + bw - u, by + u, names.map((nm) => ({ label: OPT_LABEL[nm], k: OPT_COLOR[nm] })), { size: 3, align: 'right' });
      });
    }
  },
};

export const scenesB: Record<string, SceneDef> = { losscurve, gap, momentum, adaptive };
export { valleyFrame, drawValley, legendRow, axes };
