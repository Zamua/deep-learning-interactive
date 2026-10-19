import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { OPT_COLOR } from '../../lib/nn-learning-optim';
import { ANNEAL_T, AVG_FROM, GRID_PTS, RAND_PTS, SADDLE, SCHEDS, VALLEY, annealFast, annealRuns, bowl, runningAvg, saddleTrails, scoreLr, searchScore, valleyTrails } from './data';
import { type K, type Rect, Frame, area, at, card, check, contours, cross, legend, pill, split, star } from './kit';
import { stepTiles } from './scenes-a';
import { axes, drawValley, legendRow, valleyFrame } from './scenes-b';

const BOWL = { id: 'bowl', f: bowl, fmin: 0 };

// ---------------------------------------------------------------- annealing

const anneal: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const runs = annealRuns();
    const [rb, rc] = split(s, area(s, 0.12, 0.05), s.tall ? 0.5 : 0.52, 3);
    const fr = new Frame(s, rb, [-4, 4, -2, 2], true);
    contours(s, fr, BOWL, s.ease('bounce', 0.6));
    star(s, fr.X(0), fr.Y(0), u * 2, s.c('--ink'));
    // How far each run has progressed, tied to its own beat.
    const beat = ['bounce', 'step', 'exp', 'inv'];
    const tOf = (i: number): number => {
      if (i === 0) {
        if (s.since('floor') >= 0) return lerp(ANNEAL_T * 0.55, ANNEAL_T, smooth(s.prog('floor')));
        return s.since('bounce') >= 0 ? ANNEAL_T * 0.55 * s.prog('bounce') : 0;
      }
      return s.since(beat[i]!) >= 0 ? ANNEAL_T * smooth(s.prog(beat[i]!) * 1.1) : -1;
    };
    let cur = 0;
    beat.forEach((b, i) => {
      if (s.since(b) >= 0) cur = i;
    });
    if (s.since('settle') >= 0) cur = -1;
    if (s.since('practice') >= 0) cur = 1;
    // Late in the scene, every run idles by cycling through its last 200 steps.
    const idle = (i: number) => {
      const t = tOf(i);
      if (t < ANNEAL_T - 0.5 || s.since('settle') < 0) return t;
      return ANNEAL_T - 200 + ((s.t * 25 + i * 37) % 200);
    };
    // Loss chart (log scale).
    const cf = new Frame(s, [rc[0] + u * 8, rc[1] + u * 2, rc[2] - u * 9, rc[3] - u * 13], [0, ANNEAL_T, -3.3, 1.4]);
    axes(s, cf.box);
    [-3, -2, -1, 0, 1].forEach((v) => s.text(v === 0 ? '1' : `1e${v}`, cf.box[0] - u * 1.2, cf.Y(v), { size: 2.7, font: 'mono', color: s.c('--ink-3'), align: 'right' }));
    s.text('loss, smoothed', cf.box[0] + u, cf.box[1] + cf.box[3] - u * 2.4, { size: 2.9, font: 'mono', color: s.c('red'), align: 'left' });
    s.text('step 800', cf.box[0] + cf.box[2], cf.box[1] + cf.box[3] + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
    runs.forEach((r, i) => {
      const t = Math.floor(tOf(i));
      if (t < 1) return;
      const on = cur < 0 || cur === i;
      const a = (on ? 1 : 0.45) * (1 - 0.6 * s.win('timing', 'practice'));
      s.alpha(a, () => {
        const pts: [number, number][] = [];
        for (let q = 0; q <= t; q += 4) pts.push([q, Math.max(-3.3, Math.log10(r.loss[q]!))]);
        cf.poly(pts, s.c(SCHEDS[i]!.col), on ? 0.6 : 0.4);
        const tt = idle(i);
        const from = Math.max(0, Math.floor(tt) - (on ? 160 : 60));
        const xs = r.xs.slice(from, Math.floor(tt) + 1);
        const ys = r.ys.slice(from, Math.floor(tt) + 1);
        fr.trail(xs, ys, xs.length, s.tint(SCHEDS[i]!.col, on ? 0.75 : 0.35), on ? 0.35 : 0.25);
        const [px, py] = at(r.xs, r.ys, tt);
        fr.dot(px, py, on ? 1.2 : 0.9, s.c(SCHEDS[i]!.col));
      });
    });
    // The highlighted schedule, dashed, in the top band of the chart.
    if (cur >= 1) {
      const sc = SCHEDS[cur]!;
      s.alpha(1, () => {
        const pts: [number, number][] = [];
        for (let q = 0; q <= ANNEAL_T; q += 8) pts.push([q, 0.45 + 0.8 * (sc.lr(q) / 0.15)]);
        cf.poly(pts, s.tint(sc.col, 0.85), 0.4, [1.2, 0.9]);
        s.text(`η: ${sc.name}`, cf.X(ANNEAL_T) - u, cf.Y(1.25) + u * 2.4, { size: 2.9, font: 'mono', color: s.c(sc.col), align: 'right', halo: true });
      });
    }
    s.alpha(s.win('lower', 'step'), () => {
      const pts: [number, number][] = [];
      for (let q = 0; q <= ANNEAL_T; q += 8) pts.push([q, 0.45 + 0.8 / (1 + 0.01 * q)]);
      cf.poly(pts, s.c('slate'), 0.45, [1.2, 0.9]);
      s.text('η, lowered over time', cf.X(ANNEAL_T * 0.35), cf.Y(1.05), { size: 3, color: s.c('slate'), align: 'left', halo: true });
    });
    // The noise floor.
    s.alpha(s.ease('floor', 0.6, 1) * (1 - s.ease('exp', 0.5)), () => {
      const lv = Math.log10(runs[0]!.loss[ANNEAL_T]!);
      cf.poly([[0, lv], [ANNEAL_T, lv]], s.tint('red', 0.7), 0.3, [1, 1]);
      s.text('noise floor', cf.X(ANNEAL_T * 0.98), cf.Y(lv) + u * 3, { size: 3.1, weight: 650, color: s.c('red'), align: 'right', halo: true });
    });
    // Cooling too fast: frozen before the bottom.
    s.alpha(s.win('timing', 'practice'), () => {
      const fz = annealFast();
      const n = 1 + 799 * smooth(s.prog('timing') * 1.4);
      fr.trail(fz.xs, fz.ys, n, s.c('--ink'), 0.45);
      const [px, py] = at(fz.xs, fz.ys, n - 1);
      fr.dot(px, py, 1.3, s.c('--ink'));
      s.text('k = 0.2: frozen', fr.X(px), fr.Y(py) + u * 4.4, { size: 3.3, weight: 650, color: s.c('--ink'), halo: true });
    });
    const runT = cur >= 0 ? Math.max(0, Math.floor(tOf(cur))) : ANNEAL_T;
    s.slot('t', runT);
    s.alpha(s.ease('practice', 0.6, 1.2), () => pill(s, 'val error stalls? lr *= 0.5', fr.X(0), fr.box[1] + fr.box[3] - u * 3, 'blue', { size: 3 }));
    legendRow(s, w / 2, h - u * 5, SCHEDS.map((sc, i) => ({ label: sc.name, k: sc.col, a: tOf(i) >= 0 ? 1 : 0.3 })), s.tall ? 2.9 : 3.1);
  },
};

// ---------------------------------------------------------------- second order

/** A smooth non-quadratic 1-D loss, its slope and its curvature. */
const g1 = (x: number) => 0.3 + 0.15 * (x - 0.3) ** 2 + 0.008 * (x - 0.3) ** 4;
const dg1 = (x: number) => 0.3 * (x - 0.3) + 0.032 * (x - 0.3) ** 3;
const ddg1 = (x: number) => 0.3 + 0.096 * (x - 0.3) ** 2;
const NX0 = -2.2;

const newton: SceneDef = {
  marks: {
    H: { tex: String.raw`H = \begin{bmatrix} \frac{\partial^2 \symL}{\partial \symw_1^2} & \frac{\partial^2 \symL}{\partial \symw_1 \partial \symw_2} \\[4pt] \frac{\partial^2 \symL}{\partial \symw_2 \partial \symw_1} & \frac{\partial^2 \symL}{\partial \symw_2^2} \end{bmatrix}`, x: 0.5, y: 0.78, size: 4.4 },
    newton: { tex: String.raw`\symw \leftarrow \symw - H^{-1}\,\symdw`, x: 0.5, y: 0.88, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    // The 1-D picture: slope, curvature, and one Newton step.
    const oA = s.win('first', 'fit') + (s.since('fit') >= 0 ? 1 - smooth((s.prog('fit') - 0.45) / 0.1) : 0);
    if (oA > 0) {
      s.alpha(Math.min(1, oA), () => {
        const top = area(s, 0.13, 0.06);
        const fr = new Frame(s, [top[0], top[1], top[2], top[3] * (s.since('hess') >= 0 && s.since('fit') < 0 ? 0.52 : 0.82)], [-3.2, 3.2, 0, 2.2]);
        const [bx, by, bw, bh] = fr.box;
        s.line(bx, by + bh, bx + bw, by + bh, s.c('--axis'), 0.3);
        fr.fn(g1, s.c('red'), 0.75);
        const y0 = g1(NX0);
        fr.dot(NX0, y0, 1.1, s.c('blue'));
        s.alpha(s.ease('first', 0.6, 1.4), () => {
          fr.fn((x) => y0 + dg1(NX0) * (x - NX0), s.c('teal'), 0.5, NX0 - 0.8, NX0 + 1.1);
          s.text('slope', fr.X(NX0 + 1.1) + u, fr.Y(y0 + dg1(NX0) * 1.1), { size: 3.3, color: s.c('teal'), align: 'left', halo: true, weight: 600 });
        });
        const par = (x: number) => y0 + dg1(NX0) * (x - NX0) + 0.5 * ddg1(NX0) * (x - NX0) ** 2;
        const pA = s.since('first') >= 0 ? smooth((s.prog('first') - 0.6) / 0.15) : 0;
        s.alpha(pA, () => {
          fr.fn(par, s.c('purple'), 0.5, NX0 - 0.9, NX0 + 3.6, [1.2, 0.9]);
          s.text('curvature: a fitted bowl', fr.X(-0.2), fr.Y(1.95), { size: 3.3, color: s.c('purple'), halo: true, weight: 600, align: 'left' });
        });
        // Jump to the bottom of the fitted bowl.
        const jA = s.since('fit') >= 0 ? smooth(s.prog('fit') / 0.15) : 0;
        s.alpha(jA, () => {
          const x1 = NX0 - dg1(NX0) / ddg1(NX0);
          fr.arrow(NX0, par(NX0) - 0.02, x1, par(x1) + 0.02, s.c('orange'), 0.6);
          fr.dot(x1, par(x1), 1, s.c('orange'));
          s.text('jump to its bottom', fr.X(x1), fr.Y(par(x1)) + u * 3.6, { size: 3.3, color: s.c('orange'), halo: true, weight: 600 });
        });
      });
      s.show('H', s.win('hess', 'fit'));
    }
    // Newton on the valley: one step.
    const vA = s.since('fit') >= 0 ? smooth((s.prog('fit') - 0.5) / 0.12) * (1 - s.ease('size', 0.5)) : 0;
    if (vA > 0) {
      const T = valleyTrails();
      const fr = valleyFrame(s);
      s.alpha(vA, () => {
        drawValley(s, fr);
        s.alpha(0.4, () => fr.trail(T.sgd!.xs, T.sgd!.ys, 60, s.c(OPT_COLOR.sgd), 0.4));
        const [x0, y0] = VALLEY.start;
        // The quadratic model is exact here, so its contours are the valley's own.
        const j = smooth((s.prog('fit') - 0.62) / 0.15);
        fr.arrow(x0, y0, lerp(x0, 0, j), lerp(y0, 0, j), s.c(OPT_COLOR.newton), 0.75);
        s.alpha(smooth((s.prog('fit') - 0.8) / 0.1), () => s.text('Newton: one step', fr.X(-1.2), fr.Y(1.4), { size: 3.6, weight: 650, color: s.c(OPT_COLOR.newton), halo: true }));
        s.show('newton', vA, { y: (fr.box[1] + fr.box[3] + u * 9) / h });
      });
    }
    // The Hessian's size.
    const zA = s.win('size', 'saddle');
    if (zA > 0) {
      s.alpha(zA, () => {
        const side = Math.min(h * 0.42, w * 0.34);
        const x0 = s.tall ? w / 2 - side / 2 : w * 0.1;
        const y0 = s.tall ? h * 0.16 : h * 0.22;
        const c = s.ctx;
        for (let i = 0; i <= 16; i++) {
          s.line(x0 + (i * side) / 16, y0, x0 + (i * side) / 16, y0 + side, s.tint('slate', 0.35), 0.15);
          s.line(x0, y0 + (i * side) / 16, x0 + side, y0 + (i * side) / 16, s.tint('slate', 0.35), 0.15);
        }
        c.fillStyle = s.tint('purple', 0.12);
        c.fillRect(x0, y0, side, side);
        s.rrect(x0, y0, side, side, 0.5, { stroke: s.c('purple'), lw: 0.5 });
        s.text('H', x0 + side / 2, y0 + side / 2, { size: 9, font: 'display', italic: true, color: s.c('purple'), halo: true });
        const tx = s.tall ? w / 2 : x0 + side + u * 6;
        const ty = s.tall ? y0 + side + u * 7 : y0 + side * 0.2;
        const al = s.tall ? 'center' : 'left';
        s.text('1,000,000 × 1,000,000', tx, ty, { size: 4.2, font: 'mono', weight: 650, align: al });
        s.alpha(s.ease('size', 0.5, 2.4), () => s.text('= 10¹² numbers, 4 bytes each', tx, ty + u * 7, { size: 3.6, color: s.c('--ink-2'), align: al }));
        s.alpha(s.ease('size', 0.5, 5), () => s.text('≈ 3,725 GB', tx, ty + u * 16, { size: 7.5, font: 'display', weight: 650, color: s.c('red'), align: al }));
      });
    }
    // Newton on the saddle: drawn to the flat point.
    const sA = s.win('saddle', 'lbfgs');
    if (sA > 0) {
      const T = saddleTrails();
      s.alpha(sA, () => {
        const fr = new Frame(s, area(s, 0.12, 0.05), SADDLE.domain, true);
        contours(s, fr, SADDLE);
        for (const [mx, my] of SADDLE.minima) star(s, fr.X(mx), fr.Y(my), u * 2, s.c('--ink'));
        s.alpha(0.5, () => fr.trail(T.adam!.xs, T.adam!.ys, 160, s.c(OPT_COLOR.adam), 0.45));
        const [x0, y0] = SADDLE.start;
        const j = s.ease('saddle', 1, 1);
        fr.arrow(x0, y0, lerp(x0, 0, j), lerp(y0, 0, j), s.c(OPT_COLOR.newton), 0.75);
        fr.dot(x0, y0, 0.9, s.c('--ink'));
        s.alpha(s.ease('saddle', 0.6, 2.2), () => {
          s.circle(fr.X(0), fr.Y(0), u * 2.6, { stroke: s.c(OPT_COLOR.newton), lw: 0.5 });
          s.text('Newton: stuck on the ridge top', fr.X(0), fr.Y(0) - u * 5, { size: 3.4, weight: 650, color: s.c(OPT_COLOR.newton), halo: true });
        });
        const [bx, by, bw] = fr.box;
        legend(s, bx + bw - u, by + u, [
          { label: 'Newton', k: OPT_COLOR.newton },
          { label: 'Adam', k: OPT_COLOR.adam, a: 0.6 },
        ], { size: 3, align: 'right' });
      });
    }
    // L-BFGS, and the recommendation.
    const lA = s.win('lbfgs', 'rec');
    if (lA > 0) {
      s.alpha(lA, () => {
        const cw = Math.min(w * 0.84, u * 110);
        const x0 = (w - cw) / 2;
        card(s, x0, h * 0.2, cw, h * 0.22, 'L-BFGS', 'H⁻¹ estimated from recent gradients', 'slate', 0.6, 5.5);
        const y = h * 0.6;
        // Noisy mini-batch gradients versus a steady full-batch one.
        const r = (k: number) => Math.sin(k * 12.9898 + Math.floor(s.t * 3) * 78.233) * 0.5;
        s.alpha(s.ease('lbfgs', 0.6, 2.5), () => {
          for (let k = 0; k < 6; k++) s.arrow(w * 0.28, y + u * 4, w * 0.28 + Math.cos(r(k) * 2.4 - 0.4) * u * 14, y + u * 4 - Math.sin(r(k) * 2.4 + 0.8) * u * 12, s.tint('teal', 0.6), 0.4, 2);
          s.text('mini-batch: noisy', w * 0.28, y + u * 13, { size: 3.3, color: s.c('--ink-2') });
          cross(s, w * 0.28, y - u * 10, u * 2.2);
          s.arrow(w * 0.7, y + u * 4, w * 0.7 + u * 13, y - u * 6, s.c('teal'), 0.6, 2.4);
          s.text('full batch: needed', w * 0.7, y + u * 13, { size: 3.3, color: s.c('--ink-2') });
          check(s, w * 0.7, y - u * 10, u * 2.2);
        });
      });
    }
    const rA = s.ease('rec', 0.6);
    if (rA > 0) {
      s.alpha(rA, () => {
        const items: [string, string, K, string][] = [
          ['Adam', 'the default', OPT_COLOR.adam, 'rec'],
          ['SGD + Nesterov', 'the alternative', OPT_COLOR.nesterov, 'rec'],
          ['decay η', 'either way', 'slate', 'rec'],
        ];
        const [ax, ay, aw, ah] = area(s, 0.16, 0.06);
        const n = items.length;
        const gap = u * 3;
        const cw = s.tall ? aw : (aw - gap * (n - 1)) / n;
        const ch = s.tall ? Math.min((ah - gap * (n - 1)) / n, u * 20) : Math.min(ah * 0.5, u * 30);
        const oy = s.tall ? ay + (ah - (ch * n + gap * (n - 1))) / 2 : ay + (ah - ch) / 2;
        items.forEach(([t, sub, k], i) => {
          const a = s.ease('rec', 0.5, 0.4 + i * 1.6);
          s.alpha(a, () => {
            const x = s.tall ? ax : ax + i * (cw + gap);
            const y = s.tall ? oy + i * (ch + gap) : oy;
            card(s, x, y, cw, ch, t, sub, k, 0.5, s.tall ? 5.4 : 5.6);
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- hyperparameter search

const searchScene: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Three knobs.
    const kA = s.win('knobs', 'val');
    if (kA > 0) {
      s.alpha(kA, () => {
        const names: [string, K][] = [
          ['learning rate', 'slate'],
          ['decay', 'slate'],
          ['regularization', 'purple'],
        ];
        const r = Math.min(w * 0.11, h * 0.15);
        names.forEach(([t, k], i) => {
          const a = s.ease('knobs', 0.5, 0.3 + i * 0.9);
          s.alpha(a, () => {
            const cx = w * (0.2 + i * 0.3);
            const cy = h * 0.5;
            s.circle(cx, cy, r, { fill: s.tint(k, 0.1), stroke: s.c(k), lw: 0.6 });
            for (let q = 0; q <= 10; q++) {
              const ang = Math.PI * 0.75 + (q / 10) * Math.PI * 1.5;
              s.line(cx + Math.cos(ang) * r * 1.08, cy + Math.sin(ang) * r * 1.08, cx + Math.cos(ang) * r * 1.2, cy + Math.sin(ang) * r * 1.2, s.c('--ink-3'), 0.25);
            }
            const ang = Math.PI * 0.75 + (0.5 + 0.4 * Math.sin(s.t * 0.7 + i * 2)) * Math.PI * 1.5;
            s.line(cx, cy, cx + Math.cos(ang) * r * 0.8, cy + Math.sin(ang) * r * 0.8, s.c('--ink'), 0.7);
            s.circle(cx, cy, u * 1.2, { fill: s.c('--ink') });
            s.text(t, cx, cy + r * 1.2 + u * 5, { size: Math.min(3.6, (w * 0.28) / u / 7.5), weight: 600 });
          });
        });
      });
    }
    // The automated worker loop.
    const vA = s.win('val', 'log');
    if (vA > 0) {
      s.alpha(vA, () => {
        const steps = ['sample', 'train', 'evaluate', 'save'];
        const bw = Math.min(w * 0.2, u * 24);
        const gap = (w * 0.9 - bw * 4) / 3;
        const y = h * 0.24;
        steps.forEach((t, i) => {
          const x = w * 0.05 + i * (bw + gap);
          const on = Math.floor(s.since('val') * 1.4) % 4 === i ? 1 : 0;
          s.rrect(x, y, bw, u * 9, 1.6, { fill: s.tint('--accent', 0.06 + 0.16 * on), stroke: s.tint('--accent', 0.35 + 0.5 * on), lw: 0.35 });
          s.text(t, x + bw / 2, y + u * 4.7, { size: Math.min(3.4, (bw / u) * 0.16), weight: 600 });
          if (i < 3) s.arrow(x + bw + u, y + u * 4.5, x + bw + gap - u, y + u * 4.5, s.c('--ink-3'), 0.35, 1.8);
        });
        const files = [
          ['0.521', '3e-4', '2e-2'],
          ['0.508', '1e-4', '5e-3'],
          ['0.477', '8e-4', '1e-1'],
          ['0.302', '4e-6', '3e-4'],
          ['0.100', '2e-1', '9e+1'],
        ];
        const fy = y + u * 18;
        s.text('val acc   lr      reg', w / 2, fy, { size: 3, font: 'mono', color: s.c('--ink-3') });
        files.forEach((f, i) => {
          const a = s.ease('val', 0.4, 1.2 + i * 0.7);
          s.alpha(a, () => s.text(`${f[0]}    ${f[1]}    ${f[2]}`, w / 2, fy + u * (6 + i * 5.2), { size: 3.4, font: 'mono', weight: i === 0 ? 650 : 450, color: s.c(i === 0 ? 'green' : '--ink') }));
        });
      });
    }
    // Linear versus log scale.
    const lA = s.win('log', 'grid');
    if (lA > 0) {
      s.alpha(lA, () => {
        const x0 = w * 0.1;
        const x1 = w * 0.9;
        const row = (y: number, title: string, toX: (v: number) => number, ticks: [number, string][], a: number) =>
          s.alpha(a, () => {
            s.text(title, x0, y - u * 9, { size: 3.4, weight: 650, align: 'left', color: s.c('--ink-2') });
            s.line(x0, y, x1, y, s.c('--axis'), 0.4);
            for (const [v, l] of ticks) {
              s.line(toX(v), y - u, toX(v), y + u, s.c('--axis'), 0.3);
              s.text(l, toX(v), y + u * 4, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
            }
            const pin = (v: number, k: K, up: boolean, lab: string) => {
              s.circle(toX(v), y, u * 1.3, { fill: s.c(k), stroke: s.c('--card'), lw: 0.3 });
              s.text(lab, toX(v), y + (up ? -u * 4 : u * 9), { size: 3, font: 'mono', color: s.c(k), weight: 650, halo: true });
            };
            pin(0.001, 'green', true, '0.001');
            pin(0.011, 'red', false, '0.011');
            pin(10, 'green', true, '10');
            pin(10.01, 'red', false, '10.01');
          });
        const lin = (v: number) => x0 + ((x1 - x0) * v) / 10.5;
        const lg = (v: number) => x0 + ((x1 - x0) * (Math.log10(v) + 6)) / 7.2;
        row(h * 0.36, s.since('exp') >= 0 ? 'linear is fine for dropout: uniform(0, 1)' : 'linear: 0.001 and 0.011 look the same', lin, [[0, '0'], [5, '5'], [10, '10']], s.ease('log', 0.5, 0.3));
        row(h * 0.7, 'log: they are a decade apart', lg, [[1e-6, '1e-6'], [1e-4, '1e-4'], [1e-2, '1e-2'], [1, '1']], s.ease('log', 0.5, 3.5));
        // Uniform samples of the exponent.
        s.alpha(s.ease('exp', 0.5, 0.3), () => {
          for (let i = 0; i < 18; i++) {
            const e = -6 + 7 * ((i * 0.618034 + 0.13) % 1);
            s.circle(lg(10 ** e), h * 0.7 - u * 0, u * 0.7, { fill: s.tint('slate', 0.8) });
          }
          s.text('10 ** uniform(-6, 1)', w / 2, h * 0.7 + u * 15, { size: 3.3, font: 'mono', color: s.c('slate'), weight: 650 });
        });
      });
    }
    // Grid versus random: the field and its projection.
    const gA = s.win('grid', 'border');
    if (gA > 0) {
      s.alpha(gA, () => {
        const [ax, ay, aw, ah] = area(s, 0.12, 0.05);
        const topH = ah * 0.26;
        const pf = new Frame(s, [ax + u * 4, ay, aw - u * 4, topH], [-6.3, -0.7, 0, 1]);
        const mf = new Frame(s, [ax + u * 4, ay + topH + u * 3, aw - u * 4, ah - topH - u * 9], [-6.3, -0.7, -0.1, 1.1]);
        const [mx, my, mw, mh] = mf.box;
        const cell = 4;
        const c = s.ctx;
        for (let py = my; py < my + mh; py += cell)
          for (let px = mx; px < mx + mw; px += cell) {
            const x = -6.3 + ((px - mx) / mw) * 5.6;
            const y = 1.1 - ((py - my) / mh) * 1.2;
            const t = clamp01((searchScore(x, y) - 0.1) / 0.82);
            c.fillStyle = s.tint('green', 0.05 + 0.55 * t);
            c.fillRect(px, py, cell + 0.5, cell + 0.5);
          }
        s.text('learning rate (matters) →', mx + mw, my + mh + u * 3.4, { size: 3, align: 'right', color: s.c('--ink-2') });
        s.ctx.save();
        s.ctx.translate(ax + u * 1.5, my + mh / 2);
        s.ctx.rotate(-Math.PI / 2);
        s.text('other knob (barely)', 0, 0, { size: 3, color: s.c('--ink-2') });
        s.ctx.restore();
        pf.fn(scoreLr, s.c('--ink-2'), 0.5);
        s.text('score', pf.X(-0.8), pf.box[1] + u * 2, { size: 2.9, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        const gOn = s.ease('grid', 0.5, 0.6);
        const rOn = s.ease('random', 0.5, 0.3);
        s.alpha(gOn, () => {
          for (const [x, y] of GRID_PTS) {
            const sz = u * 2.2;
            c.fillStyle = s.c('slate');
            c.fillRect(mf.X(x) - sz / 2, mf.Y(y) - sz / 2, sz, sz);
            c.strokeStyle = s.c('--card');
            c.lineWidth = u * 0.3;
            c.strokeRect(mf.X(x) - sz / 2, mf.Y(y) - sz / 2, sz, sz);
          }
          const wA = s.since('waste') >= 0 ? 1 : 0;
          s.alpha(wA, () => {
            for (const x of [-6, -3.5, -1]) {
              pf.poly([[x, 0], [x, scoreLr(x)]], s.c('slate'), 0.8);
              mf.poly([[x, -0.1], [x, 1.1]], s.tint('slate', 0.5), 0.3, [1, 1]);
            }
            s.text('3 distinct values', pf.X(-6.2), pf.Y(0.78), { size: 3.1, color: s.c('slate'), weight: 650, halo: true, align: 'left' });
          });
        });
        s.alpha(rOn, () => {
          for (const [x, y] of RAND_PTS) {
            mf.dot(x, y, 1.15, s.c('purple'));
            pf.poly([[x, 0], [x, scoreLr(x)]], s.tint('purple', 0.85), 0.45);
          }
          const best = Math.max(...RAND_PTS.map(([x]) => scoreLr(x)));
          const bestG = Math.max(...GRID_PTS.map(([x]) => scoreLr(x)));
          s.text(`best: random ${Math.round(best * 100)}%, grid ${Math.round(bestG * 100)}%`, pf.X(-6.2), pf.Y(0.4), { size: 3, font: 'mono', color: s.c('purple'), weight: 650, align: 'left', halo: true });
        });
      });
    }
    // Borders, then coarse to fine.
    const bA = s.ease('border', 0.6);
    if (bA > 0) {
      s.alpha(bA, () => {
        const [ax, ay, aw, ah] = area(s, 0.14, 0.06);
        const fr = new Frame(s, [ax + u * 3, ay + u * 6, aw - u * 6, ah - u * 22], [-6.5, 1.5, 0, 1]);
        const [bx, by, bw, bh] = fr.box;
        s.line(bx, by + bh, bx + bw, by + bh, s.c('--axis'), 0.35);
        for (let e = -6; e <= 1; e++) s.text(`1e${e}`, fr.X(e), by + bh + u * 3, { size: 2.7, font: 'mono', color: s.c('--ink-3') });
        s.text('learning rate', bx + bw, by + bh + u * 6.6, { size: 3, color: s.c('--ink-2'), align: 'right' });
        // The range searched, and the epochs per trial.
        let lo = -6;
        let hi = -3;
        let ep = 1;
        if (s.since('border') >= 0) hi = lerp(-3, -1, s.ease('border', 1.2, 3.2));
        if (s.since('coarse') >= 0) {
          const p1 = s.ease('coarse', 1, 0.2);
          const p2 = smooth((s.prog('coarse') - 0.55) / 0.15);
          lo = lerp(lerp(-6, -6, p1), -3, p2);
          hi = lerp(lerp(-1, 1, p1), -1, p2);
          ep = p2 > 0.5 ? 5 : 1;
        }
        if (s.since('fine') >= 0) {
          const p3 = s.ease('fine', 1.2, 0.2);
          lo = lerp(-3, -2.4, p3);
          hi = lerp(-1, -1.6, p3);
          ep = p3 > 0.5 ? 20 : 5;
        }
        s.slot('lo', lo.toFixed(1).replace('.0', ''));
        s.slot('hi', hi.toFixed(1).replace('.0', ''));
        s.slot('ep', ep);
        s.ctx.fillStyle = s.tint('slate', 0.1);
        s.ctx.fillRect(fr.X(lo), by, fr.X(hi) - fr.X(lo), bh);
        s.line(fr.X(lo), by, fr.X(lo), by + bh, s.c('slate'), 0.4);
        s.line(fr.X(hi), by, fr.X(hi), by + bh, s.c('slate'), 0.4);
        s.alpha(0.35, () => fr.fn(scoreLr, s.c('--ink-3'), 0.4, -6.5, 1.5, [1, 1]));
        // Trials: evenly spread through the range, noisier with fewer epochs.
        const noise = ep === 1 ? 0.12 : ep === 5 ? 0.05 : 0.015;
        let best = -1;
        let bestX = 0;
        for (let i = 0; i < 12; i++) {
          const x = lo + (hi - lo) * ((i * 0.618034 + 0.31) % 1);
          const y = clamp01(scoreLr(x) * (ep === 1 ? 0.8 : ep === 5 ? 0.92 : 1) + noise * Math.sin(i * 7.3 + ep));
          if (y > best) {
            best = y;
            bestX = x;
          }
          fr.dot(x, y, 0.95, s.c('purple'));
        }
        s.circle(fr.X(bestX), fr.Y(best), u * 2.2, { stroke: s.c('green'), lw: 0.5 });
        const edge = s.since('border') >= 0 && s.since('coarse') < 0 && s.ease('border', 1.2, 3.2) < 0.2;
        s.alpha(edge ? 1 : 0, () => s.text('best at the edge: widen', fr.X(hi) - u * 2, by + u * 3, { size: 3.3, color: s.c('green'), weight: 650, align: 'right', halo: true }));
        const tag = s.since('fine') >= 0 ? 'fine: narrow range, many epochs' : s.since('coarse') >= 0 ? (ep === 1 ? 'coarse: wide range, 1 epoch each' : 'narrower, about 5 epochs') : '';
        if (tag) s.text(tag, w / 2, ay + u * 1.5, { size: 3.5, weight: 650, color: s.c('--ink-2') });
      });
    }
  },
};

// ---------------------------------------------------------------- ensembles

const PROBS: { name: string; p: number[] }[] = [
  { name: 'model 1', p: [0.55, 0.35, 0.1] },
  { name: 'model 2', p: [0.2, 0.5, 0.3] },
  { name: 'model 3', p: [0.12, 0.4, 0.48] },
];
const AVG = [0, 1, 2].map((j) => PROBS.reduce((a, m) => a + m.p[j]!, 0) / PROBS.length);
const CLASSES = ['cat', 'dog', 'ship'];

function probCard(s: Scene, r: Rect, title: string, p: number[], k: K, verdict: number, bars: number): void {
  const [x, y, cw, ch] = r;
  s.rrect(x, y, cw, ch, 1.8, { fill: s.tint(k, 0.06), stroke: s.tint(k, 0.5), lw: 0.35 });
  s.text(title, x + cw / 2, y + s.u * 3.6, { size: Math.min(3.4, (cw / s.u) * 0.14), weight: 650, color: s.c(k) });
  const best = p.indexOf(Math.max(...p));
  const bw = cw / 4.6;
  const base = y + ch - s.u * 5.5;
  const top = y + s.u * 8;
  p.forEach((v, j) => {
    const bx = x + bw * 0.55 + j * bw * 1.3;
    const bh = (base - top) * v * bars;
    s.rrect(bx, base - bh, bw, bh, 0.4, { fill: s.tint(j === 1 ? 'gold' : 'slate', j === best ? 0.85 : 0.4) });
    s.text(CLASSES[j]!, bx + bw / 2, base + s.u * 2.6, { size: Math.min(2.8, (bw / s.u) * 0.38), font: 'mono', color: s.c(j === 1 ? 'gold' : '--ink-3') });
  });
  if (verdict > 0) s.alpha(verdict, () => (best === 1 ? check : cross)(s, x + cw - s.u * 3.2, y + s.u * 3.6, s.u * 1.8));
}

const ensembles: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const pA = s.win('trick', 'members');
    if (pA > 0) {
      s.alpha(pA, () => {
        const [ax, ay, aw, ah] = area(s, 0.13, 0.06);
        const cols = s.tall ? 2 : 4;
        const rows = s.tall ? 2 : 1;
        const gap = u * 3;
        const cw = (aw - gap * (cols - 1)) / cols;
        const ch = Math.min((ah - gap * (rows - 1)) / rows, cw * 1.05);
        const oy = ay + (ah - (ch * rows + gap * (rows - 1))) / 2;
        const verdict = s.ease('why', 0.5, 0.3);
        [...PROBS, { name: 'average', p: AVG }].forEach((m, i) => {
          const a = i < 3 ? s.ease('trick', 0.5, 0.3 + i * 0.6) : s.ease('trick', 0.5, 3.6);
          s.alpha(a, () => {
            const x = ax + (i % cols) * (cw + gap);
            const y = oy + Math.floor(i / cols) * (ch + gap);
            probCard(s, [x, y, cw, ch], m.name, m.p, i === 3 ? 'blue' : '--ink-2', verdict, i === 3 ? smooth(s.ease('trick', 1, 3.8)) : 1);
          });
        });
        s.alpha(verdict, () => s.text('true class: dog', w / 2, h - u * 3.5, { size: 3.2, color: s.c('gold'), weight: 650 }));
      });
    }
    const mA = s.win('members', 'avgw');
    if (mA > 0) {
      s.alpha(mA, () => {
        const items: [string, string, K][] = [
          ['new random starts', 'same model, other seeds', 'blue'],
          ['top of the search', 'more variety, no extra cost', 'gold'],
          ['snapshots of one run', 'less variety, nearly free', 'slate'],
        ];
        const [ax, ay, aw, ah] = area(s, 0.15, 0.06);
        const gap = u * 3;
        const n = 3;
        const cw = s.tall ? aw : (aw - gap * 2) / 3;
        const ch = s.tall ? Math.min((ah - gap * 2) / 3, u * 22) : Math.min(ah * 0.5, u * 30);
        const oy = s.tall ? ay + (ah - (ch * n + gap * 2)) / 2 : ay + (ah - ch) / 2;
        const p = s.prog('members');
        items.forEach(([t, sub, k], i) => {
          const a = smooth((p - [0.05, 0.4, 0.7][i]!) / 0.1);
          s.alpha(0.25 + 0.75 * a, () => card(s, s.tall ? ax : ax + i * (cw + gap), s.tall ? oy + i * (ch + gap) : oy, cw, ch, t, sub, k, a, 5));
        });
      });
    }
    // A running average of the weights, on the bowl.
    const bA = s.win('avgw', 'cost');
    if (bA > 0) {
      const run = annealRuns()[0]!;
      const avg = runningAvg();
      s.alpha(bA, () => {
        const fr = new Frame(s, area(s, 0.12, 0.05), [-2.2, 2.2, -1.1, 1.1], true);
        contours(s, fr, BOWL);
        star(s, fr.X(0), fr.Y(0), u * 2.2, s.c('--ink'));
        const t = AVG_FROM + (ANNEAL_T - AVG_FROM) * s.span('avgw', 'cost');
        const ti = Math.floor(t);
        const from = Math.max(AVG_FROM, ti - 120);
        const xs = run.xs.slice(from, ti + 1);
        const ys = run.ys.slice(from, ti + 1);
        fr.trail(xs, ys, xs.length, s.tint('red', 0.55), 0.3);
        const [px, py] = at(run.xs, run.ys, t);
        fr.dot(px, py, 1.3, s.c('red'));
        const k = t - AVG_FROM;
        fr.trail(avg.xs, avg.ys, k + 1, s.c('blue'), 0.6);
        const [qx, qy] = at(avg.xs, avg.ys, k);
        fr.dot(qx, qy, 1.4, s.c('blue'));
        const [bx, by] = fr.box;
        legend(s, bx + u, by + u, [
          { label: 'w: jumps around', k: 'red' },
          { label: 'w_test: the running average', k: 'blue' },
        ], { size: 3.1 });
      });
    }
    // Distillation.
    const dA = s.ease('cost', 0.6);
    if (dA > 0) {
      s.alpha(dA, () => {
        const cy = h * 0.52;
        const bs = Math.min(u * 7, w * 0.06);
        const x0 = w * 0.08;
        for (let i = 0; i < 10; i++) {
          const x = x0 + (i % 5) * (bs + u * 1.2);
          const y = cy - bs - u * 0.6 + Math.floor(i / 5) * (bs + u * 1.2);
          s.rrect(x, y, bs, bs, 1, { fill: s.tint('blue', 0.18), stroke: s.tint('blue', 0.7), lw: 0.3 });
        }
        const gx = x0 + 5 * (bs + u * 1.2);
        s.text('10 models: 10× slower', x0 + (5 * (bs + u * 1.2)) / 2, cy + bs + u * 6, { size: 3.2, color: s.c('--ink-2') });
        s.alpha(s.ease('cost', 0.5, 2.4), () => {
          s.arrow(gx + u * 2, cy, w * 0.66, cy, s.c('--ink-2'), 0.5);
          s.text('distill', (gx + w * 0.66) / 2, cy - u * 3, { size: 3.4, italic: true, color: s.c('--ink-2') });
          s.rrect(w * 0.7, cy - bs, bs * 2, bs * 2, 1.4, { fill: s.tint('blue', 0.3), stroke: s.c('blue'), lw: 0.5 });
          s.text('one model', w * 0.7 + bs, cy + bs + u * 6, { size: 3.2, color: s.c('--ink-2') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- closing

const closing: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const shrink = s.ease('next', 0.8);
    const r = area(s, lerp(0.15, 0.12, shrink), 0.06);
    const rect: Rect = [r[0], r[1], r[2], r[3] * lerp(1, 0.62, shrink)];
    const ticks = (i: number) => {
      const b = [['c1', 'c2'], ['c3'], ['c4'], ['c4'], ['c6'], ['c6']][i]!;
      return b.reduce((acc, id) => acc + (s.since(id) >= 0 ? s.ease(id, 0.5, 0.4) : 0), 0);
    };
    const lit = (i: number) => {
      const b = [['c1', 'c2'], ['c3'], ['c4'], ['c4'], ['c6'], ['c6']][i]!;
      const nextB: Record<string, string> = { c1: 'c3', c2: 'c3', c3: 'c4', c4: 'c6', c6: 'next' };
      return b.some((id) => s.since(id) >= 0 && s.since(nextB[id]!) < 0) ? 1 : 0;
    };
    stepTiles(s, rect, (i) => s.ease('recap', 0.5, i * 0.12), lit, ticks);
    s.alpha(shrink, () => {
      const y = rect[1] + rect[3] + u * 9;
      const cw = Math.min(w * 0.8, u * 80);
      s.rrect(w / 2 - cw / 2, y - u * 6, cw, u * 12, 2, { fill: s.tint('--accent', 0.1), stroke: s.c('--accent'), lw: 0.4 });
      s.text('next: the interactive chapter →', w / 2, y + u * 0.3, { size: 4.2, font: 'display', weight: 600, color: s.c('--accent') });
      s.alpha(s.ease('bye', 0.6), () => s.text('Happy training.', w / 2, y + u * 14, { size: 4.6, italic: true, color: s.c('--ink-2') }));
    });
  },
};

export const scenesC: Record<string, SceneDef> = { anneal, newton, search: searchScene, ensembles, closing };
