import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, lerp, smooth } from '../../lecture/scene';
import { Frame, type Rect, area, card, drawNet, fit, hbar, horse, pixelImage, points, regionImage, runs, split } from './draw';
import { SPIRAL, SPIRAL_NETS, accuracy } from './models';

const SPIRAL_DOM: [number, number, number, number] = [-1.1, 1.1, -1.1, 1.1];

/** Text lines stacked down a side column, each shrunk to fit its width. */
function column(s: Scene, side: Rect, rows: { t: string; a: number; size?: number; font?: 'display' | 'mono' | 'serif'; color?: string; italic?: boolean; gap?: number }[], y0 = 0.3): void {
  const [x, y, w, h] = side;
  let yy = y + h * y0;
  for (const r of rows) {
    const size = r.size ?? 4;
    s.alpha(r.a, () => fit(s, r.t, x, yy, w, { size, font: r.font ?? 'serif', color: r.color, italic: r.italic, align: 'left', weight: r.font === 'display' ? 600 : undefined }));
    yy += s.u * (size * 1.5 + (r.gap ?? 0));
  }
}

// ---------------------------------------------------------------- intro

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'recap'), () => {
      const nw = Math.min(w * 0.4, u * 44);
      drawNet(s, [w / 2 - nw / 2, h * 0.14, nw, h * 0.34], [3, 4, 2], { rMax: 3, col: (l) => s.ease('hello', 0.6, 0.3 * l) });
      s.text('Neural networks', w / 2, h * 0.62, { size: 10, font: 'display', weight: 600 });
      s.text('the architecture', w / 2, h * 0.74, { size: 4.8, italic: true, color: s.c('--ink-2') });
    });

    // The spiral, first with straight walls, later with a small network's bent ones.
    const spA = s.win('recap', 'horse') + s.win('bent', 'plan');
    if (spA > 0) {
      const { panel, side } = split(s, 0.13);
      const fr = new Frame(s, panel, SPIRAL_DOM, true);
      const lin = SPIRAL_NETS[0]!.get();
      const deep = SPIRAL_NETS[20]!.get();
      const bent = s.ease('bent', 0.9, 0.3);
      s.alpha(spA, () => {
        s.rrect(...fr.box, 1.5, { stroke: s.c('--rule'), lw: 0.25 });
        s.alpha(s.ease('walls', 0.8) * (1 - bent), () => fr.image(regionImage(lin, SPIRAL_DOM, 3)));
        s.alpha(bent, () => fr.image(regionImage(deep, SPIRAL_DOM, 3)));
        points(fr, SPIRAL, { r: 0.85 });
        const linA = s.win('recap', 'bent');
        column(s, side, [
          { t: 'linear', a: linA, size: 5, font: 'display' },
          { t: 'classifier', a: linA, size: 5, font: 'display', gap: 1 },
          { t: 'scores = W.dot(x)', a: linA * s.ease('recap', 0.5, 1), size: 3.4, font: 'mono', color: s.c('blue'), gap: 3 },
          { t: 'straight walls', a: linA * s.ease('walls', 0.5), size: 4, italic: true, color: s.c('--ink-2') },
          { t: `${Math.round(accuracy(lin, SPIRAL) * 100)}% right`, a: linA * s.ease('walls', 0.5, 3.5), size: 6, font: 'mono', color: s.c('red') },
        ]);
        column(s, side, [
          { t: 'a small', a: bent, size: 5, font: 'display' },
          { t: 'network', a: bent, size: 5, font: 'display', gap: 1 },
          { t: '20 hidden ReLUs', a: bent, size: 3.4, font: 'mono', color: s.c('gold'), gap: 3 },
          { t: 'bent walls', a: bent, size: 4, italic: true, color: s.c('--ink-2') },
          { t: `${Math.round(accuracy(deep, SPIRAL) * 100)}% right`, a: s.ease('bent', 0.5, 1.2), size: 6, font: 'mono', color: s.c('green') },
        ]);
      });
    }

    // One template per class: a horse facing left and one facing right blur into one.
    const hA = s.win('horse', 'fix');
    if (hA > 0) {
      s.alpha(hA, () => {
        const hw = Math.min(w * 0.22, h * 0.3);
        const cy = h * 0.42;
        const xs = [w * 0.2, w * 0.47, w * 0.8];
        const ink = s.c('--ink-2');
        s.alpha(s.ease('horse', 0.5, 0.2), () => horse(s, xs[0]! - hw / 2, cy - hw * 0.4, hw, -1, ink));
        s.alpha(s.ease('horse', 0.5, 0.8), () => horse(s, xs[1]! - hw / 2, cy - hw * 0.4, hw, 1, ink));
        const bA = s.ease('horse', 0.8, 2.2);
        s.alpha(bA, () => {
          s.alpha(0.5, () => horse(s, xs[2]! - hw / 2, cy - hw * 0.4, hw, -1, s.c('purple')));
          s.alpha(0.5, () => horse(s, xs[2]! - hw / 2, cy - hw * 0.4, hw, 1, s.c('purple')));
          s.arrow(xs[1]! + hw * 0.58, cy, xs[2]! - hw * 0.62, cy, s.c('--ink-3'), 0.5);
        });
        const ly = cy + hw * 0.55 + u * 4;
        s.alpha(s.ease('horse', 0.5, 0.2), () => s.text('facing left', xs[0]!, ly, { size: 3.6, color: s.c('--ink-2') }));
        s.alpha(s.ease('horse', 0.5, 0.8), () => s.text('facing right', xs[1]!, ly, { size: 3.6, color: s.c('--ink-2') }));
        s.alpha(bA, () => {
          s.text('one template', xs[2]!, ly, { size: 3.6, color: s.c('purple'), weight: 600 });
          s.text('a two-headed blur', xs[2]!, ly + u * 5, { size: 3.4, italic: true, color: s.c('--ink-3') });
        });
        s.alpha(s.ease('horse', 0.6, 3.6), () => fit(s, 'no way to say "left or right"', w / 2, h * 0.86, w * 0.9, { size: 4.6, font: 'display', weight: 560 }));
      });
    }

    // The three pieces.
    const fA = s.win('fix', 'bent');
    if (fA > 0) {
      const pieces: [string, string, Color][] = [
        ['matrix multiplies', 'W1.dot(x)', 'blue'],
        ['a simple bend', 'np.maximum(0, z)', 'red'],
        ['backprop to train', 'Chapter 6', 'teal'],
      ];
      const [ax, ay, aw, ah] = area(s, 0.16);
      const stack = s.tall;
      const gap = u * 3;
      const cw = stack ? aw * 0.86 : (aw - 2 * gap) / 3;
      const ch = stack ? Math.min((ah - 2 * gap) / 3, u * 22) : Math.min(ah * 0.45, u * 30);
      const oy = ay + (ah - (stack ? 3 * ch + 2 * gap : ch)) / 2;
      s.alpha(fA, () =>
        pieces.forEach(([t, code, k], i) => {
          const x = stack ? ax + (aw - cw) / 2 : ax + i * (cw + gap);
          const y = stack ? oy + i * (ch + gap) : oy;
          const a = s.ease('fix', 0.5, 2.4 + i * 1.6);
          s.alpha(a, () => {
            s.rrect(x, y + (1 - a) * u * 2, cw, ch, 2, { fill: s.tint(k, 0.08), stroke: s.tint(k, 0.6), lw: 0.4 });
            fit(s, t, x + cw / 2, y + ch * 0.38, cw * 0.9, { size: 5, font: 'display', weight: 560 });
            fit(s, code, x + cw / 2, y + ch * 0.68, cw * 0.9, { size: 3.8, font: 'mono', color: s.c(k) });
          });
        }),
      );
    }

    // The road ahead.
    const pA = s.ease('plan', 0.6);
    if (pA > 0) {
      const rows: [string, string][] = [
        ['the plain math', 'two multiplies and a bend'],
        ['the brain analogy', 'where the name comes from'],
        ['design choices', 'activation, depth, width'],
      ];
      const [ax, ay, aw, ah] = area(s, 0.16);
      const rh = Math.min(ah / 3.4, u * 20);
      const oy = ay + (ah - rh * 3) / 2;
      s.alpha(pA, () =>
        rows.forEach(([t, sub], i) => {
          const a = s.ease('plan', 0.5, [0, 1.6, 4.6][i]!);
          const y = oy + i * rh + rh / 2;
          const x = ax + aw * 0.12;
          s.alpha(a, () => {
            s.circle(x, y, u * 4, { fill: s.c('--accent') });
            s.text(String(i + 1), x, y + u * 0.3, { size: 4.2, font: 'mono', weight: 700, color: '#fff' });
            fit(s, t, x + u * 8, y - u * 2.2, aw * 0.8, { size: 5.2, font: 'display', weight: 560, align: 'left' });
            fit(s, sub, x + u * 8, y + u * 3.8, aw * 0.8, { size: 3.6, italic: true, color: s.c('--ink-2'), align: 'left' });
          });
        }),
      );
    }
  },
};

// ---------------------------------------------------------------- two multiplies and a max

const Z = [0.9, -0.6, 1.3, -1.1, 0.4, 1.0, -0.3, -0.9, 1.1, 0.5, -0.7, 0.8];
const SC = [0.6, -0.4, 0.2, 1.0, -0.2, 0.5, -0.7, 1.8, 0.3, -0.1];
/** The two hidden units the narration calls 17 and 42, and the horse score. */
const T17 = 2;
const T42 = 8;
const HORSE = 7;

const twoLayer: SceneDef = {
  marks: {
    formula: { tex: String.raw`\syms = \sym{W}{W_2}\,\max(0,\; \sym{W}{W_1}\,\symx)`, x: 0.5, y: 0.2, size: 6.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    s.show('formula', s.ease('formula', 0.6));
    const cy = h * 0.57;
    const span = h * 0.46;
    const img = Math.min(w * 0.18, h * 0.27);
    const x0 = u * 5 + img / 2;
    const xb = w * 0.45;
    const hb = w * 0.08;
    const hs = w * 0.07;
    const room = s.measure('horse', { size: 3.4, weight: 600 }) + u * 2.5;
    const xs = w - u * 5 - room - hs;
    const lab = cy + span / 2 + u * 4.5;
    const shape = lab + u * 4.6;
    const top = cy - span / 2 - u * 3.2;
    const a1 = x0 + img / 2 + u * 2;
    const a2 = xb - hb - u * 2.5;
    const a3 = xb + hb + u * 2.5;
    const a4 = xs - hs - u * 2;
    const label = (x: number, a: number, name: string, k: Color, dims: string) =>
      s.alpha(a, () => {
        s.text(name, x, lab, { size: 4, italic: true, weight: 600, color: s.c(k) });
        s.text(dims, x, shape, { size: 3, font: 'mono', color: s.c('--ink-3') });
      });

    // Placeholders, until each station fills in.
    const ghost = (x: number, hw: number, hh: number, name: string, beat: string) =>
      s.alpha(s.ease('formula', 0.6, 0.8) * (1 - s.ease(beat, 0.5)) * 0.8, () => {
        s.rrect(x - hw / 2, cy - hh / 2, hw, hh, 1.4, { stroke: s.c('--ink-3'), lw: 0.3 });
        s.text(name, x, cy, { size: 3.6, italic: true, color: s.c('--ink-3') });
      });
    ghost(x0, img, img, 'x', 'x');
    ghost(xb, hb * 2, span, 'h', 'w1');
    ghost(xs, hs * 2, span * 0.86, 'scores', 'w2');

    // x: an image, flattened.
    const xA = s.ease('x', 0.6);
    s.alpha(xA, () => pixelImage(s, x0 - img / 2, cy - img / 2, img));
    label(x0, xA, 'x', 'orange', '(3072,)');

    // W1 x, then the max, in place.
    const w1 = s.ease('w1', 0.6);
    const arrow = (xa: number, xb2: number, a: number, name: string, dims: string) =>
      s.alpha(a, () => {
        s.arrow(xa, cy, lerp(xa, xb2, a), cy, s.c('--ink-3'), 0.5);
        s.text(name, (xa + xb2) / 2, cy - u * 4, { size: 4.2, italic: true, weight: 600, color: s.c('blue'), halo: true });
        fit(s, dims, (xa + xb2) / 2, cy + u * 4.4, xb2 - xa + u * 3, { size: 2.6, font: 'mono', color: s.c('--ink-3'), halo: true });
      });
    arrow(a1, a2, w1, 'W1', '(100, 3072)');
    const mx = s.ease('max', 1.2, 0.8);
    const pitch = span / Z.length;
    const hi = s.win('or', 'learned');
    const barY = (i: number) => cy - span / 2 + (i + 0.5) * pitch;
    s.alpha(w1, () => {
      s.line(xb, cy - span / 2, xb, cy + span / 2, s.c('--axis'), 0.3);
      Z.forEach((v, i) => {
        const g = smooth(s.prog('w1') * 2.2 - i * 0.08);
        const neg = v < 0;
        const len = v * hb * 0.9 * g * (neg ? 1 - mx : 1);
        const k: Color = neg ? 'red' : mx > 0.5 ? 'gold' : 'slate';
        const lit = i === T17 || i === T42 ? hi : 0;
        hbar(s, xb, barY(i), len, pitch * 0.62, k, 0.55 + 0.4 * lit);
      });
      s.text('⋮', xb, cy + span / 2 + u * 1.2, { size: 3, color: s.c('--ink-3') });
    });
    const note = (t: string, a: number, k: Color, italic = true) => s.alpha(a, () => s.text(t, xb, top, { size: 3.6, italic, font: italic ? 'serif' : 'mono', weight: 600, color: s.c(k), halo: true }));
    note('max(0, ·)', s.win('max', 'hidden') * s.ease('max', 0.4), 'red', false);
    note('hidden layer', s.win('hidden', 'w2'), 'gold');
    label(xb, w1 * (1 - mx), 'W1 x', 'blue', '(100,)');
    label(xb, mx, 'h', 'gold', '(100,)');

    // W2 h: ten scores.
    const w2 = s.ease('w2', 0.6);
    arrow(a3, a4, w2, 'W2', '(10, 100)');
    const sp = span * 0.86;
    const sPitch = sp / SC.length;
    const yh = cy - sp / 2 + (HORSE + 0.5) * sPitch;
    s.alpha(w2, () => {
      s.line(xs, cy - sp / 2, xs, cy + sp / 2, s.c('--axis'), 0.3);
      SC.forEach((v, i) => {
        const g = smooth(s.prog('w2') * 2.2 - i * 0.08);
        const y = cy - sp / 2 + (i + 0.5) * sPitch;
        hbar(s, xs, y, (v / 1.8) * hs * 0.95 * g, sPitch * 0.6, 'purple', i === HORSE ? 0.55 + 0.4 * hi : 0.55);
      });
    });
    label(xs, w2, 'scores', 'purple', '(10,)');

    // "Horse if 17 fires, or if 42 fires."
    if (hi > 0) {
      s.alpha(hi, () => {
        for (const i of [T17, T42]) s.line(xb + Z[i]! * hb * 0.9 + u * 0.8, barY(i), xs - u * 0.6, yh, s.tint('gold', 0.85), 0.45);
        const hw = Math.min(u * 10, w * 0.09);
        const hx = xb - hw - u * 1.2;
        horse(s, hx, barY(T17) - hw * 0.42, hw, -1, s.tint('--ink-2', 0.8));
        horse(s, hx, barY(T42) - hw * 0.42, hw, 1, s.tint('--ink-2', 0.8));
        for (const i of [T17, T42]) s.text(i === T17 ? '17' : '42', hx - u, barY(i), { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('gold'), halo: true });
        s.text('horse', xs + hs + u * 1.5, yh, { size: 3.4, weight: 600, align: 'left', color: s.c('purple'), halo: true });
      });
    }

    // Learned matrices, a chosen width, and the biases left out.
    const t1 = (a1 + a2) / 2;
    const t2 = (a3 + a4) / 2;
    s.alpha(s.win('learned', 'bias'), () => {
      for (const t of [t1, t2]) s.text('learned', t, cy - u * 9, { size: 3, italic: true, color: s.c('teal'), halo: true });
    });
    note('100: a hyperparameter', s.win('learned', 'bias') * s.ease('learned', 0.5, 3.6), 'slate');
    s.alpha(s.ease('bias', 0.6), () => {
      for (const [t, b] of [[t1, '+ b1'], [t2, '+ b2']] as const) s.text(b, t, cy - u * 9, { size: 3.4, font: 'mono', weight: 600, color: s.tint('green', 0.7), halo: true });
    });
    note('biases: left out here', s.ease('bias', 0.6, 0.8), 'green');
  },
};

// ---------------------------------------------------------------- why the bend matters

const TOY_W1 = [1, -1, 1];
const TOY_B1 = [1, 0.5, -1];
const TOY_W2 = [0.8, 0.7, -1.4];
const relu = (z: number) => (z > 0 ? z : 0);
const toyZ = (i: number, x: number) => TOY_W1[i]! * x + TOY_B1[i]!;
const toyOut = (x: number) => TOY_W2.reduce((a, c, i) => a + c * relu(toyZ(i, x)), 0);
const toyLin = (x: number) => TOY_W2.reduce((a, c, i) => a + c * toyZ(i, x), 0);
/** Many hinges: the piecewise-linear interpolant of a smooth wave, one hinge per knot. */
const KNOTS = Array.from({ length: 13 }, (_, i) => -3 + 0.5 * i);
const wave = (x: number) => 1.1 + 1.1 * Math.sin(1.4 * x + 0.5);
const manyHinges = (x: number) => {
  const i = Math.max(0, Math.min(KNOTS.length - 2, Math.floor((x + 3) / 0.5)));
  const a = KNOTS[i]!;
  return lerp(wave(a), wave(a + 0.5), (x - a) / 0.5);
};

const collapse: SceneDef = {
  marks: {
    full: { tex: String.raw`\syms = \sym{W}{W_2}\,\max(0,\; \sym{W}{W_1}\,\symx)`, x: 0.5, y: 0.26, size: 6 },
    assoc: { tex: String.raw`\sym{W}{W_2}\,(\sym{W}{W_1}\,\symx) = (\sym{W}{W_2}\sym{W}{W_1})\,\symx = \symW\symx`, x: 0.5, y: 0.26, size: 5.6 },
    three: { tex: String.raw`\syms = \sym{W}{W_3}\max(0,\; \sym{W}{W_2}\max(0,\; \sym{W}{W_1}\symx))`, x: 0.5, y: 0.4, size: 5.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: without the max, two multiplies are one.
    const aA = s.win('why', 'toy');
    if (aA > 0) {
      s.show('full', aA * s.win('why', 'assoc'));
      s.alpha(aA * s.win('why', 'assoc') * s.ease('why', 0.5, 1.2), () => s.text('and without the max?', w / 2, h * 0.42, { size: 4.6, italic: true, color: s.c('red') }));
      const chips: [string, Color][] = [['W1 x', 'blue'], ['max(0, ·)', 'red'], ['W2 ·', 'blue']];
      const gone = s.ease('why', 0.6, 1.6);
      s.alpha(aA * s.win('why', 'one') * s.ease('why', 0.5, 0.4), () => {
        const cw = Math.min(u * 22, w * 0.24);
        const gap = u * 6;
        let x = (w - (3 * cw + 2 * gap)) / 2;
        const y = h * 0.6;
        chips.forEach(([t, k], i) => {
          s.alpha(i === 1 ? 1 - 0.75 * gone : 1, () => {
            s.rrect(x, y - u * 4, cw, u * 8, 2, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.6), lw: 0.35 });
            fit(s, t, x + cw / 2, y + u * 0.2, cw * 0.86, { size: 3.8, font: 'mono', weight: 600, color: s.c(k) });
          });
          if (i === 1) s.alpha(gone, () => s.line(x - u, y + u * 5, x + cw + u, y - u * 5, s.c('red'), 0.6));
          if (i < 2) s.text('→', x + cw + gap / 2, y, { size: 4, color: s.c('--ink-3') });
          x += cw + gap;
        });
      });
      s.show('assoc', aA * s.ease('assoc', 0.6));
      const oA = s.ease('one', 0.6, 0.4);
      s.alpha(aA * oA, () => {
        const cy = h * 0.52;
        const sc = Math.min(1, w / (u * 110));
        const boxes: [string, number, number, string][] = [
          ['W2', 9, 6, '(10, 100)'],
          ['W1', 30, 12, '(100, 3072)'],
          ['W', 30, 6, '(10, 3072)'],
        ];
        const gap = u * 9 * sc;
        const total = boxes.reduce((a, b) => a + b[1] * u * sc, 0) + 2 * gap;
        let x = (w - total) / 2;
        boxes.forEach(([lab, bw, bh, dims], i) => {
          const W = bw * u * sc;
          const H = bh * u * sc;
          const a = i < 2 ? 1 : s.ease('one', 0.5, 1.6);
          s.alpha(a, () => {
            s.rrect(x, cy - H / 2, W, H, 1, { fill: s.tint('blue', i === 2 ? 0.22 : 0.12), stroke: s.c('blue'), lw: 0.45 });
            s.text(lab, x + W / 2, cy, { size: 4.2 * Math.max(0.8, sc), italic: true, weight: 600, color: s.c('blue') });
            s.text(dims, x + W / 2, cy + Math.max(H / 2, u * 6 * sc) + u * 3.4, { size: 3 * Math.max(0.85, sc), font: 'mono', color: s.c('--ink-3') });
          });
          x += W;
          if (i < 2) s.text(i === 0 ? '·' : '=', x + gap / 2, cy, { size: 6, color: s.c('--ink-3') });
          x += gap;
        });
      });
      s.alpha(aA * s.ease('disguise', 0.6), () => fit(s, 'one linear classifier, in disguise', w / 2, h * 0.73, w * 0.9, { size: 5, font: 'display', weight: 560 }));
      const rows: [string, string, boolean, number][] = [
        ['without the max', 'same answer', true, s.ease('disguise', 0.5, 3.4)],
        ['with the max', 'a different answer', false, s.ease('with', 0.5)],
      ];
      rows.forEach(([a, b, ok, al], i) =>
        s.alpha(aA * al, () => {
          const y = h * 0.82 + i * u * 6;
          s.text(`${a}:`, w / 2 - u * 2, y, { size: 3.8, align: 'right', color: s.c('--ink-2') });
          s.text(b, w / 2 + u * 2, y, { size: 3.8, align: 'left', weight: 600, color: s.c(ok ? 'green' : 'red') });
        }),
      );
    }

    // Phase 2: a 1-D toy, one input, three hidden units, one output.
    const bA = s.win('toy', 'three');
    if (bA > 0) {
      const fr = new Frame(s, area(s, 0.13), [-3, 3, -1.6, 3.6]);
      const fold = s.ease('lines', 1.6, 3.2);
      const many = s.ease('straight', 1.2, 4.6);
      s.alpha(bA, () => {
        fr.grid(1, 0.8);
        s.text('x', fr.X(2.85), fr.Y(0) + u * 3, { size: 3.6, italic: true, weight: 600, color: s.c('orange') });
        // Mini net 1 -> 3 -> 1 in the top-left corner.
        const [bx, by] = fr.box;
        const cw = Math.min(u * 26, fr.box[2] * 0.3);
        const chh = cw * 0.62;
        s.alpha(s.ease('toy', 0.6), () => {
          card(s, bx + u * 1.5, by + u * 1.5, cw, chh);
          drawNet(s, [bx + u * 4, by + u * 3, cw - u * 5, chh - u * 3], [1, 3, 1], { rMax: 1.8 });
        });
        const hingeA = (1 - many) * s.ease('lines', 0.5);
        for (let i = 0; i < 3; i++) {
          const a = hingeA * s.ease('lines', 0.5, i * 0.6);
          s.alpha(a, () => {
            fr.fn((x) => toyZ(i, x), s.tint('--ink-3', 0.9 * (1 - fold)), 0.45, -3, 3, [1.2, 1]);
            fr.fn((x) => lerp(toyZ(i, x), relu(toyZ(i, x)), fold), s.tint('gold', 0.35 + 0.6 * fold), 0.6);
            const lx = [1.6, -1.7, 2.6][i]!;
            const ly = lerp(toyZ(i, lx), relu(toyZ(i, lx)), fold);
            runs(s, [{ t: 'h' }, { t: String(i + 1), sub: true }], fr.X(lx) + u * 2.2, fr.Y(Math.min(3.3, ly)) - u * 1.5, { size: 3.8, italic: true, weight: 600, color: s.c('gold'), halo: true });
          });
        }
        // The weighted sum bends at every hinge.
        const sumP = s.ease('sum', 2.2, 0.3);
        s.alpha((1 - many) * Math.min(1, sumP * 3), () => {
          fr.fn(toyOut, s.c('purple'), 0.9, -3, lerp(-3, 3, sumP));
          for (const kx of [-1, 0.5, 1]) if (lerp(-3, 3, sumP) > kx) fr.dot(kx, toyOut(kx), 1.1, s.c('purple'));
          s.alpha(s.ease('sum', 0.5, 2.4), () => s.text('y = W2 · h', fr.X(-0.2), fr.Y(toyOut(-0.2)) - u * 4.5, { size: 3.6, font: 'mono', weight: 600, color: s.c('purple'), halo: true }));
        });
        s.alpha(s.ease('straight', 0.6) * (1 - many), () => {
          fr.fn(toyLin, s.c('purple'), 0.6, -3, 3, [1.6, 1.2]);
          s.text('no max: a straight line', fr.X(-1.55), fr.Y(toyLin(-1.55)) - u * 3.5, { size: 3.6, italic: true, color: s.c('purple'), halo: true, align: 'left' });
        });
        s.alpha(many, () => {
          fr.fn(manyHinges, s.c('purple'), 0.9);
          KNOTS.slice(1, -1).forEach((kx) => fr.dot(kx, wave(kx), 0.8, s.c('purple')));
          s.text('11 hidden units, 11 bends', fr.X(0), fr.Y(-1.15), { size: 3.8, italic: true, color: s.c('purple'), halo: true });
        });
      });
    }

    // Phase 3: three layers, the same pattern twice.
    const cA = s.ease('three', 0.6);
    if (cA > 0) {
      s.show('three', cA);
      const chain: [string, Color][] = [
        ['multiply', 'blue'],
        ['bend', 'red'],
        ['multiply', 'blue'],
        ['bend', 'red'],
        ['multiply', 'blue'],
      ];
      const fs = Math.min(3.8, (w / u) * 0.042);
      const widths = chain.map(([t]) => s.measure(t, { size: fs }) + u * 3);
      const gap = u * 4;
      const total = widths.reduce((a, b) => a + b, 0) + gap * (chain.length - 1);
      let x = (w - total) / 2;
      const y = h * 0.62;
      chain.forEach(([t, k], i) => {
        const a = cA * s.ease('three', 0.4, 1.4 + i * 0.5);
        const cw = widths[i]!;
        s.alpha(a, () => {
          s.rrect(x, y - u * 3.6, cw, u * 7.2, 3.6, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.6), lw: 0.35 });
          s.text(t, x + cw / 2, y + u * 0.2, { size: fs, color: s.c(k), weight: 600 });
          if (i < chain.length - 1) s.text('→', x + cw + gap / 2, y, { size: 3.4, color: s.c('--ink-3') });
        });
        x += cw + gap;
      });
    }
  },
};

// ---------------------------------------------------------------- a neuron, loosely

type Seg = [number, number, number, number, number, number];
/** A dendrite tree around the soma, in soma radii: [x0, y0, x1, y1, depth, parent index or -1]. */
const DENDRITES: Seg[] = (() => {
  const r = new Rng(12);
  const out: Seg[] = [];
  const grow = (x: number, y: number, ang: number, len: number, d: number, parent: number) => {
    const x1 = x + Math.cos(ang) * len;
    const y1 = y + Math.sin(ang) * len;
    const me = out.push([x, y, x1, y1, d, parent]) - 1;
    if (d >= 3) return;
    for (const sgn of [-1, 1]) grow(x1, y1, ang + sgn * r.uniform(0.25, 0.55), len * r.uniform(0.55, 0.72), d + 1, me);
  };
  [2.2, 2.75, 3.3, 3.85, 4.3].forEach((a) => {
    const ang = a + r.uniform(-0.1, 0.1);
    grow(Math.cos(ang), Math.sin(ang), ang, r.uniform(0.9, 1.2), 1, -1);
  });
  return out;
})();
/** Polylines from three dendrite tips back to the soma, for the travelling signals. */
const PULSE_PATHS: [number, number][][] = [3, 13, 30].map((tip) => {
  const pts: [number, number][] = [];
  let i = DENDRITES.filter((d) => d[4] === 3).map((d) => DENDRITES.indexOf(d))[tip % 20]!;
  pts.push([DENDRITES[i]![2], DENDRITES[i]![3]]);
  while (i >= 0) {
    pts.push([DENDRITES[i]![0], DENDRITES[i]![1]]);
    i = DENDRITES[i]![5];
  }
  pts.push([0, 0]);
  return pts;
});
const along = (pts: [number, number][], p: number): [number, number] => {
  const f = p * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const t = f - i;
  return [lerp(pts[i]![0], pts[i + 1]![0], t), lerp(pts[i]![1], pts[i + 1]![1], t)];
};

const neuron: SceneDef = {
  marks: {
    model: { tex: String.raw`\text{output} = \symf\Big(\sum_i \sym{W}{w_i}\,\sym{x}{x_i} + \symb\Big)`, x: 0.5, y: 0.2, size: 5.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: the biological picture.
    const bioA = s.win('name', 'model');
    if (bioA > 0) {
      const sx = w * 0.4;
      const sy = h * 0.62;
      const R = Math.min(u * 6.5, h * 0.07);
      const ax1 = w * 0.84;
      s.alpha(bioA, () => {
        const ink = s.tint('--ink-2', 0.8);
        const dA = s.ease('name', 0.8);
        for (const [x0, y0, x1, y1, d] of DENDRITES) s.alpha(dA, () => s.line(sx + x0 * R, sy + y0 * R, sx + x1 * R, sy + y1 * R, ink, [0.9, 0.65, 0.45][d - 1]!));
        // Axon with myelin, then terminals.
        s.alpha(dA, () => {
          s.line(sx + R, sy, ax1, sy, ink, 0.8);
          for (let k = 0; k < 5; k++) {
            const x = sx + R * 2 + k * ((ax1 - sx - R * 3) / 5);
            s.rrect(x, sy - u * 1.4, (ax1 - sx - R * 3) / 5 - u * 1.2, u * 2.8, 1.4, { fill: s.tint('gold', 0.35), stroke: s.tint('gold', 0.7), lw: 0.25 });
          }
          [-0.7, -0.25, 0.25, 0.7].forEach((a) => {
            const ex = ax1 + Math.cos(a) * u * 7;
            const ey = sy + Math.sin(a) * u * 7;
            s.line(ax1, sy, ex, ey, ink, 0.5);
            s.circle(ex, ey, u * 1.1, { fill: s.tint('teal', 0.5), stroke: s.c('teal'), lw: 0.3 });
          });
          s.circle(sx, sy, R, { fill: s.tint('gold', 0.25), stroke: s.c('gold'), lw: 0.6 });
          s.circle(sx - R * 0.15, sy - R * 0.1, R * 0.36, { fill: s.tint('gold', 0.6) });
        });
        // Signals arrive along dendrites and leave along the axon.
        const go = s.since('parts');
        if (go > 0) {
          PULSE_PATHS.forEach((pts, k) => {
            const [px, py] = along(pts, (go * 0.45 + k * 0.33) % 1);
            s.circle(sx + px * R, sy + py * R, u * 1, { fill: s.c('orange') });
          });
          const q = (go * 0.4) % 1;
          s.circle(lerp(sx + R, ax1, q), sy, u * 1.2, { fill: s.c('orange') });
        }
        const lab = (t: string, x: number, y: number, a: number, align: CanvasTextAlign = 'center') => s.alpha(a, () => s.text(t, x, y, { size: 3.6, italic: true, color: s.c('--ink-2'), align, halo: true }));
        const pa = (d: number) => s.ease('parts', 0.5, d);
        lab('dendrites', sx - R * 3.3, sy - R * 3.4, pa(0));
        lab('cell body', sx, sy + R + u * 4, s.ease('cell', 0.5));
        lab('axon', (sx + ax1) / 2, sy + u * 5.5, pa(3.2));
        lab('synapses', ax1 + u * 2, sy + u * 10.5, s.ease('syn', 0.5, 1.6), 'right');
        s.alpha(s.win('name', 'cell'), () => fit(s, 'a biological neuron', w / 2, h * 0.2, w * 0.9, { size: 5, font: 'display', weight: 560 }));
        s.alpha(s.ease('cell', 0.5, 1.6), () => fit(s, '~86 billion neurons', w / 2, h * 0.2, w * 0.9, { size: 5, font: 'display', weight: 560 }));
        s.alpha(s.ease('syn', 0.5), () => fit(s, '10¹⁴ to 10¹⁵ synapses', w / 2, h * 0.28, w * 0.9, { size: 4.4, italic: true, weight: 600, color: s.c('teal') }));
      });
    }

    // Phase 2: the arithmetic model.
    const mA = s.ease('model', 0.8, 0.4) * (1 - 0.85 * s.ease('coarse', 0.6));
    if (mA > 0) {
      s.show('model', mA * s.ease('mul', 0.6) * (1 - s.ease('coarse', 0.4)));
      const ys = [h * 0.42, h * 0.62, h * 0.82];
      const ws = [0.8, -0.6, 0.5];
      const synX = w * 0.34;
      const bx = w * 0.56;
      const by = h * 0.62;
      const R = Math.min(u * 7.5, h * 0.09);
      const fx = w * 0.75;
      const fw = Math.min(u * 12, w * 0.11);
      const fh = fw * 0.8;
      s.alpha(mA, () => {
        ys.forEach((y, i) => {
          const a = s.ease('model', 0.5, 0.6 + i * 0.3);
          s.alpha(a, () => {
            runs(s, [{ t: 'x' }, { t: String(i), sub: true }], u * 5, y, { size: 4.4, italic: true, weight: 600, color: s.c('orange') });
            s.arrow(u * 11, y, synX - u * 1.6, y, s.tint('--ink-3', 0.9), 0.4, 2.2);
            const k: Color = ws[i]! > 0 ? 'blue' : 'red';
            const wa = s.ease('mul', 0.5);
            s.line(synX, y, bx - R * 0.95, by + (y - by) * 0.18, wa > 0 ? s.tint(k, 0.4 + 0.5 * wa) : s.tint('--ink-3', 0.7), 0.3 + Math.abs(ws[i]!) * 0.9 * wa);
            s.circle(synX, y, u * 1.3, { fill: wa > 0 ? s.c(k) : s.c('--ink-3') });
            s.alpha(wa, () => {
              runs(s, [{ t: 'w', color: s.c(k) }, { t: String(i), sub: true, color: s.c(k) }, { t: 'x', color: s.c('orange') }, { t: String(i), sub: true, color: s.c('orange') }], synX - u * 1, y - u * 3.6, { size: 3.8, italic: true, weight: 600, align: 'right', halo: true });
              s.alpha(s.ease('mul', 0.5, 4), () => s.text(ws[i]! > 0 ? 'excites' : 'inhibits', synX + u * 2.5, y + (i === 0 ? -u * 3.4 : u * 3.6), { size: 3, italic: true, color: s.c(k), halo: true, align: 'left' }));
            });
          });
        });
        const sA = s.ease('model', 0.5, 1.4);
        s.alpha(sA, () => {
          const on = s.win('sum', 'fire');
          s.circle(bx, by, R, { fill: s.tint('gold', 0.15 + 0.25 * on), stroke: s.c('gold'), lw: 0.5 + 0.3 * on });
          s.text('Σ', bx, by + u * 0.3, { size: 7, color: s.c('--ink') });
          s.alpha(s.ease('sum', 0.5), () => {
            s.arrow(bx, by + R + u * 9, bx, by + R + u * 0.6, s.c('green'), 0.45, 2.2);
            s.text('b', bx + u * 2, by + R + u * 7, { size: 4, italic: true, weight: 600, color: s.c('green'), align: 'left' });
          });
          s.arrow(bx + R, by, fx - fw / 2 - u * 0.8, by, s.c('--ink-3'), 0.45, 2.2);
          const fOn = s.ease('fire', 0.5);
          s.rrect(fx - fw / 2, by - fh / 2, fw, fh, 1.4, { fill: s.tint('red', 0.08 + 0.12 * fOn), stroke: s.c('red'), lw: 0.45 });
          const sg = s.ease('sig', 1.2, 0.2);
          if (sg > 0) {
            const c = s.ctx;
            c.beginPath();
            for (let k = 0; k <= 40; k++) {
              const t = (k / 40) * sg;
              const z = lerp(-6, 6, t);
              const px = fx - fw * 0.38 + fw * 0.76 * t;
              const py = by + fh * 0.32 - fh * 0.64 * (1 / (1 + Math.exp(-z)));
              if (k) c.lineTo(px, py);
              else c.moveTo(px, py);
            }
            c.strokeStyle = s.c('red');
            c.lineWidth = u * 0.5;
            c.stroke();
          } else s.text('f', fx, by + u * 0.3, { size: 5, italic: true, weight: 600, color: s.c('red') });
          s.alpha(s.ease('sig', 0.5, 1), () => s.text('sigmoid: 0 to 1', fx, by - fh / 2 - u * 3, { size: 3.2, italic: true, color: s.c('red'), halo: true }));
          s.arrow(fx + fw / 2 + u * 0.6, by, w - u * 5, by, s.c('--ink-3'), 0.45, 2.2);
          s.alpha(fOn, () => {
            s.text('firing rate', (fx + fw / 2 + w - u * 5) / 2, by + u * 4.4, { size: 3.2, italic: true, color: s.c('--ink-2'), halo: true });
            const q = (s.since('fire') * 0.7) % 1;
            s.circle(lerp(fx + fw / 2 + u, w - u * 6, q), by, u * 1.1, { fill: s.c('orange') });
          });
        });
      });
    }

    // Phase 3: a very coarse model.
    const cA = s.ease('coarse', 0.6);
    if (cA > 0) {
      const cw = Math.min(w * 0.86, u * 96);
      const chh = Math.min(h * 0.5, u * 44);
      const x = (w - cw) / 2;
      const y = h * 0.2;
      s.alpha(cA, () => {
        card(s, x, y, cw, chh, 0.96);
        fit(s, 'a very coarse model', w / 2, y + u * 7, cw * 0.9, { size: 5, font: 'display', weight: 600 });
        const items = ['many types of neurons', 'dendrites compute on their own', 'spike timing matters'];
        items.forEach((t, i) => {
          const a = s.ease('coarse', 0.5, 2 + i * 1.8);
          const yy = y + u * 17 + i * (chh - u * 22) / 2.4;
          s.alpha(a, () => {
            s.circle(x + u * 7, yy, u * 1, { fill: s.c('--accent') });
            fit(s, t, x + u * 11, yy, cw - u * 15, { size: 3.8, align: 'left', color: s.c('--ink-2') });
          });
        });
      });
      s.alpha(s.ease('math', 0.6, 1.4), () => {
        fit(s, 'a neural network is', w / 2, y + chh + u * 8, w * 0.9, { size: 4, italic: true, color: s.c('--ink-2') });
        fit(s, 'a mathematical function', w / 2, y + chh + u * 15, w * 0.9, { size: 5.6, font: 'display', weight: 600, color: s.c('purple') });
      });
    }
  },
};

export const scenes1: Record<string, SceneDef> = { intro, 'two-layer': twoLayer, collapse, neuron };

