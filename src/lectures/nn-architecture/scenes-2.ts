import { fmt } from '../../core/code';
import { CLASS_COLORS, rgbOf } from '../../core/plot';
import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { Frame, type Rect, area, card, check, cross, fit, split } from './draw';
import { BLOBS, NEURON_PATH, NEURON_STEPS, neuronStats, sig } from './models';

/** Stacked readout lines in a side column (or a card in the plot corner when the column is narrow). */
function readouts(s: Scene, side: Rect, rows: [string, string, number][], y0 = 0.08): void {
  const [x, y, w] = side;
  rows.forEach(([t, k, a], i) => s.alpha(a, () => fit(s, t, x, y + side[3] * y0 + i * s.u * 6, w, { size: 3.6, font: 'mono', align: 'left', color: k ? s.c(k as Color) : undefined })));
}

// ---------------------------------------------------------------- one neuron

const NDOM: [number, number, number, number] = [-1.25, 1.25, -1.25, 1.25];
const FIELD = 56;
let fieldCv: HTMLCanvasElement | null = null;
let fieldKey = '';
/** The neuron's output sigma(w.x + b) as a blue-to-orange wash, cached per (w, b, theme). */
function neuronField(s: Scene, w0: number, w1: number, b: number): HTMLCanvasElement {
  const c0 = rgbOf(s.c(CLASS_COLORS[0]!));
  const c1 = rgbOf(s.c(CLASS_COLORS[1]!));
  const key = `${w0.toFixed(4)},${w1.toFixed(4)},${b.toFixed(4)},${c0},${c1}`;
  if (fieldCv && key === fieldKey) return fieldCv;
  fieldCv ??= document.createElement('canvas');
  fieldCv.width = fieldCv.height = FIELD;
  const ctx = fieldCv.getContext('2d')!;
  const img = ctx.createImageData(FIELD, FIELD);
  for (let j = 0; j < FIELD; j++)
    for (let i = 0; i < FIELD; i++) {
      const x = lerp(NDOM[0], NDOM[1], (i + 0.5) / FIELD);
      const y = lerp(NDOM[3], NDOM[2], (j + 0.5) / FIELD);
      const q = sig(w0 * x + w1 * y + b);
      const k = 4 * (j * FIELD + i);
      img.data[k] = lerp(c0[0], c1[0], q);
      img.data[k + 1] = lerp(c0[1], c1[1], q);
      img.data[k + 2] = lerp(c0[2], c1[2], q);
      img.data[k + 3] = 30 + 70 * Math.abs(q - 0.5) * 2;
    }
  ctx.putImageData(img, 0, 0);
  fieldKey = key;
  return fieldCv;
}

/** Points where the line w.x + b = c crosses the frame's square, for drawing it. */
function levelLine(w0: number, w1: number, b: number, c: number, lim = 1.25): [number, number, number, number] | null {
  const n2 = w0 * w0 + w1 * w1;
  if (n2 < 1e-9) return null;
  const fx = ((c - b) * w0) / n2;
  const fy = ((c - b) * w1) / n2;
  const nrm = Math.sqrt(n2);
  const tx = -w1 / nrm;
  const ty = w0 / nrm;
  if (Math.hypot(fx, fy) > lim * 1.42) return null;
  return [fx - tx * 4, fy - ty * 4, fx + tx * 4, fy + ty * 4];
}

const oneNeuron: SceneDef = {
  marks: {
    p: { tex: String.raw`P(y{=}1 \mid \symx) = \sigma(\symW\cdot\symx + \symb)`, x: 0.5, y: 0.19, size: 5 },
    reg: { tex: String.raw`\symW \leftarrow \symW - \eta\,(\sym{g}{\nabla} L + \symlam\symW)`, x: 0.5, y: 0.19, size: 5 },
    regroup: { tex: String.raw`\symW \leftarrow (1 - \eta\symlam)\,\symW - \eta\,\sym{g}{\nabla} L`, x: 0.5, y: 0.19, size: 5 },
  },
  draw(s) {
    const { u } = s;
    const { panel, side } = split(s, 0.27);
    const fr = new Frame(s, panel, NDOM, true);
    // Weights over time: the chapter's start, trained, then decaying with the data switched off.
    let k = 0;
    if (s.since('train') >= 0) k = Math.round(NEURON_STEPS * s.prog('train') ** 2);
    const [tw0, tw1, tb] = NEURON_PATH[k]!;
    let decay = 0;
    if (s.since('forget') >= 0) decay = Math.round(1000 * smooth((s.prog('forget') - 0.3) / 0.65));
    const shrink = 0.995 ** decay;
    const w0 = tw0 * shrink;
    const w1 = tw1 * shrink;
    const b = tb;
    const st = neuronStats(w0, w1, b);
    s.slot('w0', fmt(w0, 3));
    s.slot('w1', fmt(w1, 3));
    s.slot('b', fmt(b, 2));
    s.slot('loss', fmt(st.loss, 3));
    s.slot('acc', `${Math.round(st.acc * 100)}%`);

    s.show('p', s.win('sig', 'reg'));
    s.show('reg', s.win('reg', 'regroup'));
    s.show('regroup', s.ease('regroup', 0.6));
    s.alpha(s.win('known', 'sig'), () => fit(s, 'one neuron, two classes', s.w / 2, s.h * 0.19, s.w * 0.9, { size: 5, font: 'display', weight: 560 }));

    const shade = s.ease('sig', 0.8);
    s.rrect(...fr.box, 1.2, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.25 });
    s.alpha(shade, () => fr.image(neuronField(s, w0, w1, b)));
    fr.grid(0.5, 0.6);
    // Score contours: the score grows along w.
    s.alpha(s.win('score', 'sig'), () =>
      fr.clip(() => {
        for (const c of [-2, -1, 0, 1, 2]) {
          const L = levelLine(w0, w1, b, c);
          if (!L) continue;
          fr.seg(L[0], L[1], L[2], L[3], s.tint('blue', c === 0 ? 0.8 : 0.35), c === 0 ? 0.45 : 0.3, [1, 1]);
          const n2 = w0 * w0 + w1 * w1;
          const px = ((c - b) * w0) / n2;
          const py = ((c - b) * w1) / n2;
          if (Math.abs(px) < 1.1 && Math.abs(py) < 1.1) s.text(c > 0 ? `+${c}` : String(c), fr.X(px), fr.Y(py), { size: 3, font: 'mono', weight: 600, color: s.c('blue'), halo: true });
        }
      }),
    );
    // Boundary and the 0.1 / 0.9 lines.
    const bA = s.ease('sig', 0.6, 1);
    s.alpha(bA, () =>
      fr.clip(() => {
        const L = levelLine(w0, w1, b, 0);
        if (L) fr.seg(L[0], L[1], L[2], L[3], s.c('--ink'), 0.5);
        for (const c of [-2.197, 2.197]) {
          const M = levelLine(w0, w1, b, c);
          if (M) s.alpha(s.ease('pred', 0.6) * (1 - s.ease('forget', 0.5)), () => fr.seg(M[0], M[1], M[2], M[3], s.tint('--ink-3', 0.85), 0.3, [1.2, 1.2]));
        }
      }),
    );
    // Points; misclassified ones ringed.
    for (let i = 0; i < BLOBS.n; i++) {
      const x0 = BLOBS.X[2 * i]!;
      const x1 = BLOBS.X[2 * i + 1]!;
      const yi = BLOBS.y[i]!;
      const wrong = shade > 0.5 && (w0 * x0 + w1 * x1 + b > 0 ? 1 : 0) !== yi;
      fr.dot(x0, x1, wrong ? 1.05 : 0.9, s.c(CLASS_COLORS[yi]!), wrong ? s.c('--ink') : undefined);
    }
    // w as an arrow from the origin.
    s.alpha(s.ease('score', 0.6), () => {
      fr.arrow(0, 0, w0 * 0.25, w1 * 0.25, s.c('blue'), 0.75, 2.6);
      const ex = w0 * 0.25;
      const ey = w1 * 0.25;
      const lx = Math.hypot(ex, ey) > 0.08 ? ex * 1.25 : 0.12;
      const ly = Math.hypot(ex, ey) > 0.08 ? ey * 1.25 : 0.12;
      s.text('w', fr.X(lx), fr.Y(ly), { size: 4.2, italic: true, weight: 600, color: s.c('blue'), halo: true });
    });
    s.alpha(s.win('pred', 'reg'), () => {
      const L = levelLine(w0, w1, b, 0);
      if (!L) return;
      const t = 0.62;
      const px = lerp(L[0], L[2], t);
      const py = lerp(L[1], L[3], t);
      if (Math.abs(px) < 1.1 && Math.abs(py) < 1.1) s.text('score = 0', fr.X(px), fr.Y(py) - u * 2.5, { size: 3.2, font: 'mono', weight: 600, halo: true });
    });

    // Side column.
    const cls = (c: number) => s.c(CLASS_COLORS[c]!);
    readouts(s, side, [
      [`w0 ${fmt(w0, 2)}`, 'blue', s.ease('score', 0.5)],
      [`w1 ${fmt(w1, 2)}`, 'blue', s.ease('score', 0.5)],
      [`b  ${fmt(b, 2)}`, 'green', s.ease('score', 0.5)],
      [`loss ${st.loss.toFixed(2)}`, '', s.ease('train', 0.5)],
      [`acc  ${Math.round(st.acc * 100)}%`, '', s.ease('train', 0.5)],
    ]);
    const ty = side[1] + side[3] * 0.08 + u * 34;
    const tag = (t: string, i: number, a: number, k?: string) => s.alpha(a, () => fit(s, t, side[0], ty + i * u * 5.4, side[2], { size: 3.6, italic: true, align: 'left', color: k ?? s.c('--ink-2') }));
    tag('class 1: orange', 0, s.win('sig', 'train'), cls(1));
    tag('class 0: blue', 1, s.win('sig', 'train'), cls(0));
    tag('logistic', 0, s.win('logreg', 'reg'), s.c('purple'));
    tag('regression', 1, s.win('logreg', 'reg'), s.c('purple'));
    tag('hinge loss:', 2, s.win('logreg', 'reg') * s.ease('logreg', 0.5, 3.6));
    tag('a binary SVM', 3, s.win('logreg', 'reg') * s.ease('logreg', 0.5, 3.6));
    tag(`steps: ${decay}`, 0, s.ease('forget', 0.5, 2), s.c('slate'));
    tag(`× 0.995^${decay}`, 1, s.ease('forget', 0.5, 2), s.c('slate'));
    tag(`= ${shrink.toFixed(3)}`, 2, s.ease('forget', 0.5, 2), s.c('slate'));
    s.alpha(s.ease('keep', 0.6), () => {
      fit(s, 'gradual', side[0], ty + u * 18, side[2], { size: 4.6, font: 'display', weight: 600, align: 'left', color: s.c('slate') });
      fit(s, 'forgetting', side[0], ty + u * 24, side[2], { size: 4.6, font: 'display', weight: 600, align: 'left', color: s.c('slate') });
    });
  },
};

// ---------------------------------------------------------------- sigmoid and tanh

const sigD = (z: number) => sig(z) * (1 - sig(z));
const tanhD = (z: number) => 1 - Math.tanh(z) ** 2;

/** Shades the plot's columns where `slope` is nearly zero: gradients die there. */
function deadZones(s: Scene, fr: Frame, slope: (z: number) => number, a: number, thr = 0.03): void {
  if (a <= 0) return;
  const [x0, x1] = fr.dom;
  const n = 240;
  const [, by, , bh] = fr.box;
  s.ctx.fillStyle = s.tint('red', 0.1 * a);
  let run = -1;
  for (let i = 0; i <= n; i++) {
    const dead = i < n && Math.abs(slope(x0 + ((i + 0.5) * (x1 - x0)) / n)) < thr;
    if (dead && run < 0) run = i;
    if (!dead && run >= 0) {
      const za = x0 + (run * (x1 - x0)) / n;
      const zb = x0 + (i * (x1 - x0)) / n;
      s.ctx.fillRect(fr.X(za), by, fr.X(zb) - fr.X(za), bh);
      run = -1;
    }
  }
}

const squash: SceneDef = {
  draw(s) {
    const { u } = s;
    // Phases 1 and 3: the activation plot, sigmoid morphing into tanh.
    const pA = s.win('why', 'center') + s.ease('tanh', 0.7);
    if (pA > 0) {
      const fr = new Frame(s, area(s, 0.13), [-6, 6, -1.3, 1.45]);
      const m = s.ease('tanh', 1.4, 0.5);
      const F = (z: number) => lerp(sig(z), Math.tanh(z), m);
      const D = (z: number) => lerp(sigD(z), tanhD(z), m);
      let z = 1.5;
      if (s.since('tails') >= 0) z = lerp(1.5, 5, smooth(s.prog('tails') / 0.35));
      if (s.since('peak') >= 0) z = lerp(5, 0, smooth(s.prog('peak') / 0.5));
      if (s.since('tanh') >= 0) z = 0;
      if (s.since('still') >= 0) z = lerp(0, 4, smooth(s.prog('still') / 0.4));
      s.slot('z', fmt(Math.round(z * 10) / 10));
      s.slot('dsig', fmt(sigD(z), 3));
      s.slot('dtanh', fmt(tanhD(z), 3));
      s.alpha(pA, () => {
        deadZones(s, fr, D, s.ease('tails', 0.8, 2.5) * (s.since('tanh') >= 0 ? s.ease('still', 0.8, 2) : 1) * (1 + 0.6 * s.win('sat', 'center') * (0.5 + 0.5 * Math.sin(s.since('sat') * 4))));
        fr.grid(1, 0.8);
        [-5, 5].forEach((v) => s.text(String(v), fr.X(v), fr.Y(0) + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
        [1, -1].forEach((v) => s.text(String(v), fr.X(0) - u * 1.5, fr.Y(v), { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') }));
        s.text('z', fr.X(5.75), fr.Y(0) - u * 2.6, { size: 3.6, italic: true, color: s.c('--ink-2') });
        s.alpha(s.ease('tanh', 0.6), () => fr.fn(sig, s.tint('red', 0.35), 0.5, -6, 6, [1.2, 1]));
        fr.fn(D, s.c('teal'), 0.6, -6, 6, [1.6, 1]);
        const draw = s.since('sig') >= 0 ? s.ease('sig', 1.4) : 1;
        s.alpha(s.since('sig') >= 0 ? 1 : 0.35, () => fr.fn(F, s.c('red'), 0.9, -6, lerp(-6, 6, draw)));
        // The moving input.
        fr.seg(z, 0, z, F(z), s.tint('--ink-3', 0.8), 0.3, [0.8, 0.8]);
        fr.dot(z, F(z), 1.3, s.c('red'));
        fr.dot(z, D(z), 1.1, s.c('teal'));
        // Readout card, top left.
        const [bx, by] = fr.box;
        const cw = Math.min(u * 40, fr.box[2] * 0.42);
        card(s, bx + u * 1.5, by + u * 1.5, cw, u * 17);
        const tx = bx + u * 4;
        s.text(`z = ${fmt(Math.round(z * 10) / 10)}`, tx, by + u * 5.5, { size: 3.4, font: 'mono', align: 'left', color: s.c('orange') });
        s.text(`f(z) = ${F(z).toFixed(3)}`, tx, by + u * 10.5, { size: 3.4, font: 'mono', align: 'left', color: s.c('red') });
        s.text(`slope = ${D(z).toFixed(3)}`, tx, by + u * 15.5, { size: 3.4, font: 'mono', align: 'left', color: s.c('teal'), weight: 650 });
        // Labels.
        const rx = fr.box[0] + fr.box[2] - u * 2;
        s.alpha(s.win('why', 'sig'), () => {
          fit(s, 'gradient below = slope × gradient above', rx, fr.Y(-0.75), fr.box[2] * 0.62, { size: 3.6, italic: true, align: 'right', color: s.c('teal'), halo: true });
        });
        s.alpha(s.win('sig', 'tanh'), () => s.text(m < 0.5 ? 'sigmoid' : 'tanh', fr.X(2.6), fr.Y(F(2.6)) - u * 3.4, { size: 4.2, weight: 600, color: s.c('red'), halo: true }));
        s.alpha(s.ease('tanh', 0.6, 1.2), () => s.text('tanh', fr.X(2.6), fr.Y(Math.tanh(2.6)) - u * 3.4, { size: 4.2, weight: 600, color: s.c('red'), halo: true }));
        s.alpha(s.ease('tanh', 0.6, 2.4), () => fit(s, 'tanh(z) = 2σ(2z) − 1', rx, fr.Y(-0.75), fr.box[2] * 0.5, { size: 3.8, font: 'mono', align: 'right', color: s.c('red'), halo: true }));
        s.alpha(s.win('peak', 'sat') * s.ease('peak', 0.5, 1.6), () => s.text('steepest: 0.25', fr.X(0) + u * 2, fr.Y(0.25) - u * 3, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('teal'), halo: true }));
        s.alpha(s.win('sat', 'center'), () => {
          s.text('saturated', fr.X(-4.4), fr.Y(0.5), { size: 3.8, italic: true, weight: 600, color: s.c('red'), halo: true });
          s.text('saturated', fr.X(4.4), fr.Y(0.5), { size: 3.8, italic: true, weight: 600, color: s.c('red'), halo: true });
        });
      });
    }

    // Phase 2: all-positive inputs make every weight gradient share a sign.
    const cA = s.win('center', 'tanh');
    if (cA > 0) {
      const wide = !s.tall;
      const [ax, ay, aw, ah] = area(s, 0.13);
      const lift = s.ease('zig', 0.8);
      const cellsR: Rect = wide ? [ax, ay, aw * 0.44, ah] : [ax, ay + lerp(ah * 0.22, 0, lift), aw, ah * 0.4];
      const planeR: Rect = wide ? [ax + aw * 0.5, ay, aw * 0.5, ah] : [ax, ay + ah * 0.44, aw, ah * 0.56];
      s.alpha(cA, () => {
        const cw = Math.min(u * 14, cellsR[2] / 4.2);
        const ch = cw * 0.62;
        const gx = cellsR[0] + (cellsR[2] - 3 * cw - u * 2) / 2 + u * 4;
        const gy = cellsR[1] + (wide ? cellsR[3] / 2 - ch - u * 3.5 : u * 3);
        const row = (y: number, vals: string[], k: Color, lab: string, a: number) =>
          s.alpha(a, () => {
            s.text(lab, gx - u * 2.5, y + ch / 2, { size: 4, italic: true, weight: 600, align: 'right', color: s.c(k) });
            vals.forEach((v, i) => s.cell(gx + i * (cw + u), y, cw, ch, v, k, { size: 3.4 }));
          });
        row(gy, ['0.9', '0.2', '0.6'], 'orange', 'x', s.ease('center', 0.5));
        s.alpha(s.ease('center', 0.5, 1.2), () => fit(s, 'all positive', gx + 1.5 * cw + u, gy - u * 3.2, cellsR[2], { size: 3.2, italic: true, color: s.c('orange') }));
        s.alpha(s.win('center', 'same') * s.ease('center', 0.5, 1.6), () => fit(s, 'each one a sigmoid output, between 0 and 1', gx + 1.5 * cw + u, gy + ch + u * 5, cellsR[2] * 0.95, { size: 3.4, italic: true, color: s.c('--ink-2') }));
        s.alpha(s.ease('same', 0.5), () => s.text('× dout (−0.8)', gx + 1.5 * cw + u, gy + ch + u * 3.4, { size: 3.4, font: 'mono', color: s.c('teal') }));
        row(gy + ch + u * 7, ['−0.72', '−0.16', '−0.48'], 'teal', 'dw', s.ease('same', 0.5, 1));
        s.alpha(s.ease('same', 0.5, 3), () => fit(s, 'every one negative', gx + 1.5 * cw + u, gy + 2 * ch + u * 11, cellsR[2], { size: 3.4, italic: true, weight: 600, color: s.c('teal') }));

        // The weight plane: steps may only go up-right or down-left.
        const zA = s.ease('zig', 0.6);
        s.alpha(zA, () => {
          const fr = new Frame(s, planeR, [-2.2, 2.2, -1.8, 1.8], true);
          const start: [number, number] = [-1.5, 1.1];
          const goal: [number, number] = [1.5, -1.1];
          const steps: [number, number][] = [];
          let p: [number, number] = [...start];
          steps.push(p);
          for (let i = 0; i < 4; i++) {
            p = [p[0] + 0.9, p[1] + 0.35];
            steps.push(p);
            p = [p[0] - 0.15, p[1] - 0.9];
            steps.push(p);
          }
          const prog = clamp01((s.since('zig') - 0.8) / 3.2) * (steps.length - 1);
          const at = Math.min(steps.length - 1, Math.floor(prog));
          const f = prog - at;
          const cur: [number, number] = at < steps.length - 1 ? [lerp(steps[at]![0], steps[at + 1]![0], f), lerp(steps[at]![1], steps[at + 1]![1], f)] : steps[at]!;
          fr.clip(() => {
            const c = s.ctx;
            const big = 9;
            c.fillStyle = s.tint('green', 0.12);
            c.fillRect(fr.X(cur[0]), fr.Y(cur[1] + big), fr.kx * big, fr.ky * big);
            c.fillRect(fr.X(cur[0] - big), fr.Y(cur[1]), fr.kx * big, fr.ky * big);
          });
          fr.grid(1, 0.7);
          s.text('w1', fr.X(2.05), fr.Y(0) - u * 2.6, { size: 3.4, italic: true, color: s.c('blue'), align: 'right' });
          s.text('w2', fr.X(0) + u * 1.6, fr.Y(1.7), { size: 3.4, italic: true, color: s.c('blue'), align: 'left' });
          fr.seg(start[0], start[1], goal[0], goal[1], s.tint('--ink-3', 0.7), 0.35, [1.2, 1]);
          for (let i = 0; i < at; i++) fr.seg(steps[i]![0], steps[i]![1], steps[i + 1]![0], steps[i + 1]![1], s.c('teal'), 0.55);
          if (at < steps.length - 1) fr.seg(steps[at]![0], steps[at]![1], cur[0], cur[1], s.c('teal'), 0.55);
          fr.dot(goal[0], goal[1], 1.4, s.c('purple'));
          s.text('target', fr.X(goal[0]), fr.Y(goal[1]) + u * 4, { size: 3.2, italic: true, color: s.c('purple'), halo: true });
          fr.dot(cur[0], cur[1], 1.3, s.c('blue'));
          s.text('all up, or all down', fr.X(-0.2), fr.Y(-1.55), { size: 3.2, italic: true, color: s.c('green'), halo: true });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- ReLU and its cousins

/** Inputs one ReLU unit sees across the training set, before and after a bad update. */
const UNIT_Z = (() => {
  const r = new Rng(4);
  return Array.from({ length: 22 }, () => 0.7 + 0.95 * r.randn());
})();
const SHOVE = 3.4;

const relu: SceneDef = {
  draw(s) {
    const { u } = s;
    const advA = s.ease('advice', 0.6);
    const fr = new Frame(s, area(s, 0.13), [-4, 4, -2.3, 4.2]);
    const plotA = 1 - advA;
    // Shape of the curve: ReLU, then leaky (drawn steeper than 0.01 so it shows), then maxout.
    const lk = s.win('leaky', 'maxout');
    const mo = s.ease('maxout', 0.7);
    const sp = s.ease('special', 1.4, 0.6);
    const a2 = lerp(-0.4, 0, sp);
    const c2 = lerp(-0.6, 0, sp);
    const alpha = 0.1 * lk;
    const F = (z: number) => (mo > 0 ? lerp(z > 0 ? z : alpha * z, Math.max(z, a2 * z + c2), mo) : z > 0 ? z : alpha * z);
    const D = (z: number) => (mo > 0.5 ? (z >= a2 * z + c2 ? 1 : a2) : z > 0 ? 1 : 0.01 * lk);
    s.alpha(plotA, () => {
      deadZones(s, fr, D, s.ease('relu', 0.6, 2) * (1 - lk) * (1 - mo), 0.005);
      fr.grid(1, 0.8);
      [-3, 3].forEach((v) => s.text(String(v), fr.X(v), fr.Y(0) + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
      s.text('z', fr.X(3.8), fr.Y(0) - u * 2.6, { size: 3.6, italic: true, color: s.c('--ink-2') });
      // Maxout's two pieces.
      s.alpha(mo, () => {
        fr.fn((z) => z, s.tint('--ink-3', 0.9), 0.4, -4, 4, [1.2, 1]);
        fr.fn((z) => a2 * z + c2, s.tint('--ink-3', 0.9), 0.4, -4, 4, [1.2, 1]);
        s.text('w1·x + b1', fr.X(-1.2) + u * 2, fr.Y(-1.9), { size: 3.2, font: 'mono', color: s.c('--ink-2'), halo: true, align: 'left' });
        s.text(sp > 0.5 ? 'piece 2 = 0' : 'w2·x + b2', fr.X(-3.9), fr.Y(a2 * -3.4 + c2) - u * 4, { size: 3.2, font: 'mono', color: s.c('--ink-2'), halo: true, align: 'left' });
      });
      fr.fn(D, s.c('teal'), 0.6, -4, 4, [1.6, 1]);
      const dr = s.ease('relu', 1.2);
      fr.fn(F, s.c('red'), 0.95, -4, lerp(-4, 4, dr));
      s.alpha(s.ease('relu', 0.5, 1) * (1 - mo), () => s.text(lk > 0.5 ? 'leaky ReLU' : 'ReLU', fr.X(2.2), fr.Y(2.2) - u * 4, { size: 4.4, weight: 600, color: s.c('red'), halo: true, align: 'right' }));
      s.alpha(mo, () => s.text(sp > 0.5 ? 'maxout = ReLU' : 'maxout', fr.X(2.2), fr.Y(2.2) - u * 4, { size: 4.4, weight: 600, color: s.c('red'), halo: true, align: 'right' }));
      s.alpha(s.win('why', 'die'), () => {
        s.text('slope 1, never flat', fr.X(1.6) + u * 3, fr.Y(1.2), { size: 3.4, italic: true, color: s.c('teal'), halo: true, align: 'left' });
        s.text('slope 0', fr.X(-2), fr.Y(0) - u * 3, { size: 3.4, italic: true, color: s.c('teal'), halo: true });
      });
      s.alpha(lk * s.ease('leaky', 0.5, 1), () => fit(s, 'slope 0.01 (drawn 10× steeper)', fr.X(-2), fr.Y(0.6), fr.box[2] * 0.48, { size: 3.2, italic: true, color: s.c('teal'), halo: true }));
      s.alpha(s.ease('special', 0.5, 4), () => s.text('2× the parameters', fr.X(3.8), fr.Y(-1.15), { size: 3.4, italic: true, weight: 600, align: 'right', color: s.c('slate'), halo: true }));

      // Six times faster.
      s.alpha(s.win('fast', 'why'), () => {
        const [bx, by] = fr.box;
        const cw = Math.min(u * 44, fr.box[2] * 0.46);
        card(s, bx + u * 1.5, by + u * 1.5, cw, u * 19);
        const lx = bx + u * 4;
        const bw0 = cw - u * 18;
        s.text('time to train', lx, by + u * 5.5, { size: 3.2, italic: true, align: 'left', color: s.c('--ink-2') });
        const grow = s.ease('fast', 1.2, 0.4);
        s.text('tanh', lx, by + u * 11, { size: 3.4, font: 'mono', align: 'left' });
        s.rrect(lx + u * 10, by + u * 9.5, bw0 * grow, u * 3, 0.6, { fill: s.tint('slate', 0.6) });
        s.text('ReLU', lx, by + u * 16, { size: 3.4, font: 'mono', align: 'left', color: s.c('red') });
        s.rrect(lx + u * 10, by + u * 14.5, (bw0 / 6) * grow, u * 3, 0.6, { fill: s.tint('red', 0.7) });
        s.alpha(s.ease('fast', 0.5, 1.8), () => s.text('6× faster', lx + u * 12 + bw0 / 6, by + u * 16, { size: 3.2, weight: 600, align: 'left', color: s.c('red') }));
      });

      // A dying unit: its input on every example.
      const dA = s.win('die', 'maxout');
      if (dA > 0) {
        const shove = s.ease('shove', 1.4, 0.8);
        s.alpha(dA, () => {
          const y = -1.5;
          fit(s, 'this unit\'s input z, one dot per example', fr.X(-3.9), fr.Y(-0.95), fr.box[2] * 0.7, { size: 3.2, italic: true, align: 'left', color: s.c('--ink-2'), halo: true });
          UNIT_Z.forEach((z0, i) => {
            const z = Math.max(-3.9, z0 - SHOVE * shove);
            const alive = z > 0;
            const k = alive ? s.c('teal') : lk > 0.5 ? s.tint('teal', 0.4) : s.c('--ink-3');
            fr.dot(z, y + ((i % 3) - 1) * 0.16, 0.9, k);
          });
          s.alpha(s.win('dead', 'leaky'), () => fit(s, 'dead: zero output, zero gradient', fr.X(3.9), fr.Y(-2.05), fr.box[2] * 0.6, { size: 3.4, weight: 600, italic: true, color: s.c('red'), halo: true, align: 'right' }));
          s.alpha(lk, () => fit(s, 'a trickle of gradient', fr.X(3.9), fr.Y(-2.05), fr.box[2] * 0.6, { size: 3.4, italic: true, color: s.c('teal'), halo: true, align: 'right' }));
        });
      }
    });

    // The advice card.
    if (advA > 0) {
      const rows: [string, 'ok' | 'dot' | 'no', Color, string][] = [
        ['ReLU: the default', 'ok', 'green', 'advice'],
        ['mind the learning rate', 'dot', 'gold', 'advice'],
        ['watch for dead units', 'dot', 'gold', 'advice'],
        ['leaky ReLU or maxout, if units die', 'dot', 'teal', 'else'],
        ['tanh: worth a try, expect worse', 'dot', 'slate', 'else'],
        ['sigmoid in hidden layers', 'no', 'red', 'else'],
      ];
      const [ax, ay, aw, ah] = area(s, 0.15);
      const rh = Math.min(ah / 6.4, u * 11);
      const oy = ay + (ah - rh * 6) / 2;
      const delays = [0.4, 1.8, 3.2, 0.3, 2.6, 5];
      s.alpha(advA, () =>
        rows.forEach(([t, kind, k, beat], i) => {
          const a = s.ease(beat, 0.5, delays[i]!);
          const y = oy + i * rh + rh / 2;
          const x = ax + u * 4;
          s.alpha(a, () => {
            if (kind === 'ok') check(s, x, y, u * 2.6, k);
            else if (kind === 'no') cross(s, x, y, u * 2.6, k);
            else s.circle(x, y, u * 1.4, { fill: s.c(k) });
            fit(s, t, x + u * 6, y, aw - u * 12, { size: 4.2, align: 'left', weight: kind === 'dot' ? 450 : 600 });
          });
        }),
      );
    }
  },
};

export const scenes2: Record<string, SceneDef> = { 'one-neuron': oneNeuron, squash, relu };
