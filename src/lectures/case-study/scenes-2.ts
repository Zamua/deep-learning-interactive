import { rgbOf } from '../../core/plot';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { LIN, LIN_FINAL, LIN_WRONG, NET_FINAL, NPTS, XS, YS, linModel, netScore, unitOf, SHOW_UNIT } from './data';
import { type K, at, boundary, classColor, cycle, field, hillshade, liveRegions, lossChart, margin, mark, pill, points, readout, top, unitLine, within } from './draw';
import { fit, num, plotSide } from './kit';

// ---------------------------------------------------------------- dscores

/** A row of labelled boxes joined by arrows, returning each box's center. */
function chain(s: Scene, y: number, items: [string, K][], o: { size?: number; x0?: number; x1?: number } = {}): number[] {
  const { u } = s;
  const size = o.size ?? 3.2;
  const x0 = o.x0 ?? margin(s);
  const x1 = o.x1 ?? s.w - margin(s);
  const widths = items.map(([t]) => s.measure(t, { font: 'mono', size, weight: 650 }) + u * size * 1.4);
  const gap = (x1 - x0 - widths.reduce((a, b) => a + b, 0)) / (items.length - 1);
  let x = x0;
  const cs: number[] = [];
  items.forEach(([t, k], i) => {
    const bw = widths[i]!;
    s.rrect(x, y - u * size * 1.05, bw, u * size * 2.1, 1.2, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.7), lw: 0.3 });
    s.text(t, x + bw / 2, y + u * 0.15, { size, font: 'mono', weight: 650, color: s.c(k) });
    cs.push(x + bw / 2);
    if (i < items.length - 1) s.arrow(x + bw + u, y, x + bw + gap - u, y, s.tint('--ink-3', 0.7), 0.3, 1.8);
    x += bw + gap;
  });
  return cs;
}

const EX_P = [0.2, 0.3, 0.5];
const EX_Y = 1;

const dscores: SceneDef = {
  marks: {
    f1: { tex: String.raw`\dfrac{\partial \symL_i}{\partial \syms_k} = p_k - \mathbb{1}(\symy_i = k)`, x: 0.5, y: 0.42, size: 6.2 },
    f2: { tex: String.raw`\symL_i = -\log\dfrac{e^{\syms_{\symy_i}}}{\sum_j e^{\syms_j}} = -\syms_{\symy_i} + \log\sum_j e^{\syms_j}`, x: 0.5, y: 0.6, size: 4.4 },
    f3a: { tex: String.raw`\dfrac{\partial}{\partial \syms_k}\big(-\syms_{\symy_i}\big) = -\mathbb{1}(\symy_i = k)`, x: 0.5, y: 0.74, size: 4.1 },
    f3b: { tex: String.raw`\dfrac{\partial}{\partial \syms_k}\log\sum_j e^{\syms_j} = \dfrac{e^{\syms_k}}{\sum_j e^{\syms_j}} = p_k`, x: 0.5, y: 0.885, size: 4.1 },
  },
  draw(s) {
    const { w, h, u } = s;
    const m = margin(s);
    const T = top(s);
    // Phase 1: where the gradient starts, and why it is so simple.
    const aA = s.win('back', 'code');
    if (aA > 0) {
      s.alpha(aA, () => {
        const y = T + u * 5;
        const cs = chain(s, y, [['W, b', 'blue'], ['scores', 'purple'], ['probs', '--ink'], ['loss', 'red']], { x0: m + u * 2, x1: w - m - u * 2 });
        const back = within(s, 'back', 0.35, 0.95);
        if (back > 0) {
          const xa = cs[3]!;
          const xb = lerp(cs[3]!, cs[1]!, back);
          const c = s.ctx;
          c.beginPath();
          c.moveTo(xa, y + u * 4.2);
          c.quadraticCurveTo((xa + xb) / 2, y + u * 9, xb, y + u * 4.4);
          c.strokeStyle = s.c('teal');
          c.lineWidth = u * 0.5;
          c.stroke();
          s.arrow(xb + u * 1.4, y + u * 5.6, xb, y + u * 4, s.c('teal'), 0.5, 2);
          s.alpha(clamp01(back * 2 - 1), () => s.text('first stop', (cs[1]! + cs[2]!) / 2, y + u * 10.5, { size: 2.8, font: 'ui', weight: 650, color: s.c('teal') }));
        }
      });
      const fa = aA * s.ease('formula', 0.6);
      s.show('f1', fa, { y: lerp(0.47, 0.4, s.ease('why1', 0.7)) });
      s.show('f2', aA * s.ease('why1', 0.6, 0.4));
      s.show('f3a', aA * within(s, 'why2', 0.15, 0.3));
      s.show('f3b', aA * within(s, 'why2', 0.5, 0.65));
    }
    // Phase 2: the advice in bars.
    const bA = s.ease('code', 0.6);
    if (bA <= 0) return;
    s.alpha(bA, () => {
      const gw = (w - 2 * m - u * 6) / 2;
      const zero = h * 0.5;
      const H = Math.min(h * 0.3, u * 30);
      const bw = Math.min(gw / 4.4, u * 10);
      const lx = m;
      const rx = m + gw + u * 6;
      const done = within(s, 'done', 0.1, 0.4) * (1 - s.ease('div', 0.6));
      const probs = EX_P.map((p, k) => lerp(p, k === EX_Y ? 1 : 0, done));
      const copy = within(s, 'code', 0.1, 0.4);
      const sub = within(s, 'code', 0.55, 0.85);
      const grad = probs.map((p, k) => p - (k === EX_Y ? sub : 0));
      const scaled = s.since('div') >= 0 ? s.ease('div', 0.6, 0.6) : 0;
      const bx = (gx: number, k: number) => gx + (gw - 3 * bw - 2 * bw * 0.45) / 2 + k * bw * 1.45;
      const hiP = s.win('ex', 'res');
      const hiG = s.win('res', 'pos');
      const panel = (gx: number, name: string, k: K, vals: number[], a: number, hi: number, fmt: (v: number) => string) =>
        s.alpha(a, () => {
          s.text(name, gx + gw / 2, zero - H - u * 7.5, { size: 3.6, font: 'mono', weight: 650, color: s.c(k) });
          s.line(gx + u * 2, zero, gx + gw - u * 2, zero, s.c('--axis'), 0.3);
          vals.forEach((v, c) => {
            const x = bx(gx, c);
            const hh = v * H;
            const col = name === 'probs' ? classColor(c) : 'teal';
            s.rrect(x, Math.min(zero, zero - hh), bw, Math.max(0.5, Math.abs(hh)), 0.6, { fill: s.tint(col, 0.75) });
            if (c === EX_Y) s.rrect(x - u * 0.5, Math.min(zero, zero - hh) - u * 0.5, bw + u, Math.max(0.5, Math.abs(hh)) + u, 0.9, { stroke: s.c('gold'), lw: 0.5 });
            const ly = v >= 0 ? zero - hh - u * 2.8 : zero - hh + u * 3;
            s.text(fmt(v), x + bw / 2, ly, { size: 3 + hi * 0.5, font: 'mono', weight: 600 + 100 * hi, color: hi > 0.5 ? s.c(k === '--ink' ? '--accent' : k) : s.c('--ink'), halo: true });
            s.text(String(c), x + bw / 2, zero + H * 0.7 + u * 8, { size: 2.8, font: 'mono', color: s.c(classColor(c)) });
          });
          s.text('y = 1', bx(gx, EX_Y) + bw / 2, zero + H * 0.7 + u * 12, { size: 2.6, font: 'mono', weight: 650, color: s.c('gold') });
        });
      panel(lx, 'probs', '--ink', probs, 1, hiP, (v) => num(v, 1));
      panel(rx, 'dscores', 'teal', grad, copy, hiG, (v) => (scaled > 0.5 ? num(v / NPTS, 4) : num(v, 1)));
      s.alpha(copy * (1 - copy), () => s.arrow(lx + gw - u * 4, zero - H * 0.5, rx + u * 4, zero - H * 0.5, s.c('teal'), 0.4, 2));
      s.alpha(within(s, 'code', 0.55, 0.7) * (1 - s.ease('ex', 0.4)), () => s.text('− 1 at the correct class', rx + gw / 2, zero + H * 0.7 + u * 17, { size: 2.9, font: 'ui', weight: 650, color: s.c('teal') }));
      // push down, pull up
      const pa = s.win('pos', 'done');
      const na = s.win('neg', 'done');
      [0, 2].forEach((c) => {
        const x = bx(rx, c) + bw + u * 1.6;
        s.alpha(pa, () => {
          s.arrow(x, zero - grad[c]! * H * 0.2 - u * 2, x, zero - grad[c]! * H * 0.2 + grad[c]! * H * 0.8, s.c('red'), 0.5, 2);
        });
      });
      s.alpha(pa, () => s.text('pushed down', rx + gw / 2, zero - H - u * 3, { size: 2.8, font: 'ui', weight: 650, color: s.c('red') }));
      s.alpha(na, () => {
        const x = bx(rx, EX_Y) + bw / 2;
        s.arrow(x, zero + u * 4, x, zero - u * 6, s.c('green'), 0.7, 2.6);
        s.text('pulled up', x, zero - H * 0.5, { size: 2.8, font: 'ui', weight: 650, color: s.c('green'), halo: true });
      });
      s.alpha(s.win('done', 'div'), () => s.text('all zeros: nothing to teach', rx + gw / 2, zero - H * 0.45, { size: 2.9, font: 'ui', weight: 650, color: s.c('teal') }));
      s.alpha(scaled, () => pill(s, '÷ 300', rx + gw / 2, zero - H - u * 2.6, 'teal', { size: 3 }));
    });
  },
};

// ---------------------------------------------------------------- backprop (linear)

/** A stand-in for a long axis: a block with ticks, too long to draw cell by cell. */
function longBlock(s: Scene, x: number, y: number, w: number, h: number, k: K, o: { on?: number; along?: 'x' | 'y'; hi?: number } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y, w, h, 1, { fill: s.tint(k, 0.1 + 0.12 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.3 });
  const n = 12;
  for (let i = 1; i < n; i++) {
    if (o.along === 'x') s.line(x + (w * i) / n, y + s.u * 0.4, x + (w * i) / n, y + h - s.u * 0.4, s.tint(k, 0.25), 0.15);
    else s.line(x + s.u * 0.4, y + (h * i) / n, x + w - s.u * 0.4, y + (h * i) / n, s.tint(k, 0.25), 0.15);
  }
  if (o.hi !== undefined && o.hi >= 0) {
    const f = o.hi;
    if (o.along === 'x') s.rrect(x + f * w - s.u * 0.9, y - s.u * 0.4, s.u * 1.8, h + s.u * 0.8, 0.6, { fill: s.tint('--accent', 0.35), stroke: s.c('--accent'), lw: 0.3 });
    else s.rrect(x - s.u * 0.4, y + f * h - s.u * 0.9, w + s.u * 0.8, s.u * 1.8, 0.6, { fill: s.tint('--accent', 0.35), stroke: s.c('--accent'), lw: 0.3 });
  }
}

const backprop: SceneDef = {
  marks: {
    rule: { tex: String.raw`\dfrac{\partial \symL}{\partial \symW} = \symX^{\top}\,\dfrac{\partial \symL}{\partial \syms}`, x: 0.5, y: 0.22, size: 5.2 },
    upd: { tex: String.raw`\symW \leftarrow \symW - \eta\,\dfrac{\partial \symL}{\partial \symW}`, x: 0.5, y: 0.22, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const m = margin(s);
    const T = top(s);
    // Phase 1: the forward graph, and the gradient heading back into W and b.
    const aA = s.win('carry', 'rule');
    if (aA > 0)
      s.alpha(aA, () => {
        const y = h * 0.42;
        const xs = [0.12, 0.33, 0.52, 0.72, 0.9].map((f) => m + f * (w - 2 * m));
        const node = (x: number, t: string, k: K) => {
          const bw = s.measure(t, { font: 'mono', size: 3.4, weight: 650 }) + u * 4.4;
          s.rrect(x - bw / 2, y - u * 3.6, bw, u * 7.2, 1.2, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.7), lw: 0.3 });
          s.text(t, x, y + u * 0.2, { size: 3.4, font: 'mono', weight: 650, color: s.c(k) });
          return bw;
        };
        const op = (x: number, t: string, k: K) => {
          s.circle(x, y, u * 3.6, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.7), lw: 0.3 });
          s.text(t, x, y + u * 0.2, { size: 3.2, font: 'mono', weight: 650, color: s.c(k) });
        };
        const bX = node(xs[0]!, 'X', 'orange');
        op(xs[1]!, '·W', 'blue');
        op(xs[2]!, '+b', 'green');
        const bS = node(xs[3]!, 'scores', 'purple');
        node(xs[4]!, 'loss', 'red');
        s.arrow(xs[0]! + bX / 2 + u, y, xs[1]! - u * 4.4, y, s.c('--ink-3'), 0.3, 1.8);
        s.arrow(xs[1]! + u * 4.4, y, xs[2]! - u * 4.4, y, s.c('--ink-3'), 0.3, 1.8);
        s.arrow(xs[2]! + u * 4.4, y, xs[3]! - bS / 2 - u, y, s.c('--ink-3'), 0.3, 1.8);
        s.arrow(xs[3]! + bS / 2 + u, y, xs[4]! - u * 6, y, s.c('--ink-3'), 0.3, 1.8);
        // parameters below their operations
        const pW = [xs[1]!, y + u * 17] as const;
        const pB = [xs[2]!, y + u * 17] as const;
        s.rrect(pW[0] - u * 4, pW[1] - u * 3.4, u * 8, u * 6.8, 1.2, { fill: s.tint('blue', 0.1), stroke: s.tint('blue', 0.7), lw: 0.3 });
        s.text('W', pW[0], pW[1] + u * 0.2, { size: 3.6, italic: true, weight: 650, color: s.c('blue') });
        s.rrect(pB[0] - u * 4, pB[1] - u * 3.4, u * 8, u * 6.8, 1.2, { fill: s.tint('green', 0.1), stroke: s.tint('green', 0.7), lw: 0.3 });
        s.text('b', pB[0], pB[1] + u * 0.2, { size: 3.6, italic: true, weight: 650, color: s.c('green') });
        s.line(pW[0], pW[1] - u * 3.4, xs[1]!, y + u * 3.6, s.c('--ink-3'), 0.3);
        s.line(pB[0], pB[1] - u * 3.4, xs[2]!, y + u * 3.6, s.c('--ink-3'), 0.3);
        // the gradient flowing back
        const g = within(s, 'carry', 0.15, 0.6);
        const g2 = within(s, 'carry', 0.55, 0.9);
        const yb = y - u * 7;
        s.alpha(g, () => {
          s.arrow(xs[4]!, yb, lerp(xs[4]!, xs[3]!, g), yb, s.c('teal'), 0.5, 2);
          s.text('dscores', (xs[3]! + xs[4]!) / 2, yb - u * 2.6, { size: 2.8, font: 'mono', weight: 650, color: s.c('teal') });
        });
        s.alpha(g2, () => {
          s.arrow(xs[3]!, yb, lerp(xs[3]!, xs[1]!, g2), yb, s.c('teal'), 0.5, 2);
          s.arrow(pW[0] + u * 5.5, y + u * 5, pW[0] + u * 5.5, pW[1], s.c('teal'), 0.45, 2);
          s.arrow(pB[0] + u * 5.5, y + u * 5, pB[0] + u * 5.5, pB[1], s.c('teal'), 0.45, 2);
          s.text('dW', pW[0] + u * 8.5, (y + pW[1]) / 2 + u * 2, { size: 2.8, font: 'mono', weight: 650, color: s.c('teal'), align: 'left' });
          s.text('db', pB[0] + u * 8.5, (y + pB[1]) / 2 + u * 2, { size: 2.8, font: 'mono', weight: 650, color: s.c('teal'), align: 'left' });
        });
      });
    // Phase 2: dW = X.T dscores, with the shapes deciding.
    const bA = s.win('rule', 'db');
    if (bA > 0) {
      s.show('rule', bA * s.ease('rule', 0.6), { y: (T + u * 7) / h });
      s.alpha(bA, () => {
        const c = u * 4.6;
        const Lg = Math.min(u * 38, (w - 2 * m) * 0.36);
        const total = Lg + u * 7 + 3 * c + u * 7 + 3 * c;
        const x0 = (w - total) / 2;
        const yMid = h * 0.56;
        const xT = [x0, yMid - c, Lg, 2 * c] as const;
        const xD = [x0 + Lg + u * 7, yMid - Lg / 2, 3 * c, Lg] as const;
        const xW = [xD[0] + 3 * c + u * 7, yMid - c, 3 * c, 2 * c] as const;
        const vote = s.since('votes') >= 0 ? s.prog('votes') : -1;
        longBlock(s, xT[0], xT[1], xT[2], xT[3], 'orange', { along: 'x', hi: vote >= 0 ? vote : undefined });
        longBlock(s, xD[0], xD[1], xD[2], xD[3], 'teal', { along: 'y', hi: vote >= 0 ? vote : undefined });
        s.text('·', xT[0] + Lg + u * 3.5, yMid, { size: 6, weight: 700 });
        s.text('=', xD[0] + 3 * c + u * 3.5, yMid, { size: 5, weight: 600 });
        const pulse = vote >= 0 ? 0.5 + 0.5 * Math.sin(s.t * 9) : 0;
        for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) s.cell(xW[0] + k * c, xW[1] + r * c, c, c, '', 'teal', { on: pulse });
        s.text('X.T', xT[0] + Lg / 2, xT[1] - u * 2.8, { size: 3.4, font: 'mono', weight: 650, color: s.c('orange') });
        s.text('dscores', xD[0] + 1.5 * c, xD[1] - u * 2.8, { size: 3.2, font: 'mono', weight: 650, color: s.c('teal') });
        s.text('dW', xW[0] + 1.5 * c, xW[1] - u * 2.8, { size: 3.4, font: 'mono', weight: 650, color: s.c('teal') });
        const sa = s.ease('shapes', 0.6);
        s.alpha(sa, () => {
          pill(s, '(2, 300)', xT[0] + Lg / 2, xT[1] + 2 * c + u * 4, 'orange', { size: 2.8 });
          pill(s, '(300, 3)', xD[0] + 1.5 * c, xD[1] + Lg + u * 4, 'teal', { size: 2.8 });
          pill(s, '(2, 3)', xW[0] + 1.5 * c, xW[1] + 2 * c + u * 4, 'teal', { size: 2.8 });
          s.alpha(within(s, 'shapes', 0.0, 0.2), () => s.text('like W', xW[0] + 1.5 * c, xW[1] + 2 * c + u * 9, { size: 2.6, font: 'ui', weight: 600, color: s.c('blue') }));
        });
        s.alpha(s.win('votes', 'db'), () => {
          s.text('one point at a time,', xT[0] + Lg / 2, xT[1] + 2 * c + u * 10, { size: 2.8, font: 'ui', weight: 600, color: s.c('--ink-2') });
          s.text('all 300 summed', xT[0] + Lg / 2, xT[1] + 2 * c + u * 14, { size: 2.8, font: 'ui', weight: 600, color: s.c('--ink-2') });
        });
      });
    }
    // Phase 3: db sums down the rows; regularization adds reg * W.
    const cA = s.win('db', 'upd');
    if (cA > 0)
      s.alpha(cA, () => {
        const c = u * 5.2;
        const H = Math.min(h * 0.46, u * 42);
        const x0 = Math.max(m + u * 6, w * 0.16);
        const y0 = T + u * 8;
        longBlock(s, x0, y0, 3 * c, H, 'teal', { along: 'y' });
        s.text('dscores', x0 + 1.5 * c, y0 - u * 2.8, { size: 3.2, font: 'mono', weight: 650, color: s.c('teal') });
        const p = within(s, 'db', 0.3, 0.8);
        for (let k = 0; k < 3; k++) {
          const x = x0 + k * c + c / 2;
          s.arrow(x, y0 + H * 0.15, x, lerp(y0 + H * 0.15, y0 + H + u * 5, p), s.tint('teal', 0.8), 0.4, 1.8);
        }
        s.alpha(p, () => {
          for (let k = 0; k < 3; k++) s.cell(x0 + k * c, y0 + H + u * 6, c, c, '', 'teal', { on: 0.6 });
          s.text('db', x0 - u * 3.4, y0 + H + u * 6 + c / 2, { size: 3.2, font: 'mono', weight: 650, color: s.c('teal') });
          s.text('(1, 3)', x0 + 1.5 * c, y0 + H + u * 6 + c + u * 3, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
          s.text('Σ down the rows', x0 + 3 * c + u * 3, y0 + H * 0.6, { size: 2.8, font: 'ui', weight: 600, color: s.c('--ink-2'), align: 'left' });
        });
        const ra = s.ease('reg', 0.6);
        s.alpha(ra, () => {
          const rx = Math.max(x0 + 3 * c + u * 30, w * 0.55);
          const ry = y0 + u * 10;
          const cw = u * 5;
          for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) s.cell(rx + k * cw, ry + r * cw, cw, cw, '', 'teal', { on: 0.4 });
          s.text('dW', rx + 1.5 * cw, ry - u * 2.6, { size: 3.2, font: 'mono', weight: 650, color: s.c('teal') });
          s.text('+=', rx + 3 * cw + u * 4, ry + cw, { size: 3.4, font: 'mono', weight: 650 });
          const rx2 = rx + 3 * cw + u * 8;
          for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) s.cell(rx2 + k * cw, ry + r * cw, cw, cw, '', 'blue', { on: 0.2 });
          s.text('reg · W', rx2 + 1.5 * cw, ry - u * 2.6, { size: 3.2, font: 'mono', weight: 650, color: s.c('blue') });
          fit(s, 'from ½ · reg · W²', rx, ry + 2 * cw + u * 5, w - rx - m, { size: 2.8, font: 'ui', weight: 600, color: s.c('--ink-3'), align: 'left' });
        });
      });
    // Phase 4: one step downhill, then many.
    const dA = s.win('upd', 'one');
    if (dA > 0) {
      s.show('upd', dA * s.ease('upd', 0.6), { y: (T + u * 6) / h });
      s.alpha(dA, () => {
        const x0 = m + u * 6;
        const x1 = w - m - u * 4;
        const yb = h - m - u * 8;
        const yt = T + u * 16;
        const L = (v: number) => 0.5 * (v - 1) * (v - 1);
        const X = (v: number) => x0 + ((v + 1.6) / 4.6) * (x1 - x0);
        const Y = (l: number) => yb - (l / 3.4) * (yb - yt);
        s.line(x0, yb, x1, yb, s.c('--axis'), 0.3);
        s.line(x0, yb, x0, yt - u * 2, s.c('--axis'), 0.3);
        s.text('W', x1, yb + u * 3, { size: 3.2, italic: true, weight: 650, color: s.c('blue'), align: 'right' });
        s.text('loss', x0 + u * 1.5, yt - u * 2, { size: 2.8, font: 'ui', weight: 650, color: s.c('red'), align: 'left' });
        const c = s.ctx;
        c.beginPath();
        for (let i = 0; i <= 80; i++) {
          const v = -1.6 + (4.6 * i) / 80;
          if (i) c.lineTo(X(v), Y(L(v)));
          else c.moveTo(X(v), Y(L(v)));
        }
        c.strokeStyle = s.c('red');
        c.lineWidth = u * 0.45;
        c.stroke();
        // the ball's walk: w <- w - 0.5 * slope
        const walk = [-1.2];
        for (let i = 0; i < 6; i++) walk.push(walk[i]! - 0.5 * (walk[i]! - 1));
        let wv = walk[0]!;
        if (s.since('gd') >= 0) {
          const f = clamp01(s.prog('gd') / 0.9) * (walk.length - 1);
          const i = Math.min(walk.length - 2, Math.floor(f));
          wv = lerp(walk[i]!, walk[i + 1]!, smooth((f - i) * 1.6));
          for (let k = 0; k <= i; k++) s.circle(X(walk[k]!), Y(L(walk[k]!)), u * 0.7, { fill: s.tint('blue', 0.4) });
        } else wv = lerp(walk[0]!, walk[1]!, within(s, 'upd', 0.7, 0.95));
        const bx = X(wv);
        const by = Y(L(wv));
        const showArrows = s.since('gd') < 0 ? within(s, 'upd', 0.2, 0.35) * (1 - within(s, 'upd', 0.95, 1)) : 0;
        s.alpha(showArrows, () => {
          const slope = wv - 1;
          const len = u * 12;
          s.arrow(bx, by - u * 4, bx + Math.sign(slope) * len, by - u * 4, s.c('teal'), 0.5, 2.2);
          s.text('gradient: uphill', bx + Math.sign(slope) * len * 0.5, by - u * 7.5, { size: 2.7, font: 'ui', weight: 650, color: s.c('teal'), halo: true });
          s.arrow(bx, by + u * 4, bx - Math.sign(slope) * len, by + u * 4, s.c('blue'), 0.5, 2.2);
          s.text('step: downhill', bx - Math.sign(slope) * len * 0.5, by + u * 8, { size: 2.7, font: 'ui', weight: 650, color: s.c('blue'), halo: true });
        });
        s.circle(bx, by, u * 1.6, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
        s.alpha(s.ease('gd', 0.5, 1), () => fit(s, 'all 300 points, step size 1', (x0 + x1) / 2, yb + u * 4, x1 - x0 - u * 16, { size: 2.8, font: 'ui', weight: 600, color: s.c('--ink-3') }));
      });
    }
    // Phase 5: one full iteration.
    const eA = s.ease('one', 0.6);
    if (eA > 0) {
      const lit = (k: number) => (s.t >= at(s, 'one', 0.45 + 0.13 * k) ? 1 : 0.2);
      cycle(s, w / 2, T + (h - T) / 2, Math.min(w, h) * 0.27, lit, { a: eA, size: s.tall ? 4 : 4.4, center: 'one iteration' });
    }
  },
};

// ---------------------------------------------------------------- train-linear

/** Which of the 200 updates the animation has reached. */
function linIt(s: Scene): number {
  if (s.since('falls') < 0) return 0;
  if (s.since('flat') < 0) return Math.floor(60 * within(s, 'falls', 0.05, 0.95));
  return Math.floor(60 + 140 * within(s, 'flat', 0, 0.8));
}

const trainLinear: SceneDef = {
  draw(s) {
    const { u } = s;
    const { pl, side } = plotSide(s, 0.6);
    const [sx, sy, sw, sh] = side;
    const it = linIt(s);
    const st = LIN.states[it]!;
    pl.card();
    liveRegions(s, pl, linModel(st));
    s.alpha(s.win('why', 'bend'), () => boundary(s, pl, 'lin200', LIN_FINAL, 0.75, 200));
    // arms highlighted one at a time
    const armsP = s.since('arms') >= 0 && s.since('bend') < 0 ? s.prog('arms') : -1;
    const hiArm = armsP >= 0 ? Math.min(2, Math.floor(armsP * 3)) : -1;
    points(s, pl, XS, YS, { wrong: LIN_WRONG, ring: s.ease('guess', 0.6) * (1 - s.ease('bend', 0.5)), each: (i) => (hiArm < 0 || Math.floor(i / 100) === hiArm ? 1 : 0.25) });
    s.alpha(s.ease('bend', 0.6), () => {
      for (let j = 0; j < 3; j++) {
        const c = s.ctx;
        c.save();
        c.beginPath();
        for (let i = 0; i <= 120; i++) {
          const q = i / 120;
          const t = 4 * j + 4 * q;
          const px = pl.X(q * Math.sin(t));
          const py = pl.Y(q * Math.cos(t));
          if (i) c.lineTo(px, py);
          else c.moveTo(px, py);
        }
        c.strokeStyle = s.tint(classColor(j), 0.85);
        c.lineWidth = u * 0.6;
        c.setLineDash([u * 1.4, u * 0.9]);
        c.stroke();
        c.restore();
      }
    });
    // side: loss curve and readouts
    const chartH = Math.min(sh * 0.36, u * 26);
    const cx = sx + u * 6;
    lossChart(s, [cx, sy + u * 4, sw - u * 7, chartH], LIN.loss, 1, 200, s.since('first') >= 0 ? it : -1);
    const ry = sy + u * 4 + chartH + u * 9;
    const loss = LIN.loss[Math.min(199, it)]!;
    const step = s.tall ? 11 : 12;
    readout(s, sx, ry, 'iteration', String(it), '--ink', { size: s.tall ? 4.4 : 5 });
    s.alpha(s.ease('first', 0.4), () => readout(s, sx, ry + u * step, 'loss', num(loss, 3), 'red', { size: s.tall ? 4.4 : 5 }));
    const accA = s.ease('acc', 0.5, 1.5);
    s.alpha(accA, () => readout(s, sx, ry + u * step * 2, 'accuracy', `${Math.round((LIN.hits[200]! / NPTS) * 100)}%`, 'green', { size: s.tall ? 4.4 : 5 }));
    s.alpha(s.win('guess', 'why'), () => fit(s, 'guessing: 33%', sx, ry + u * (step * 3 + 1), sw, { size: 2.8, font: 'ui', weight: 600, color: s.c('--ink-3'), align: 'left' }));
    s.alpha(s.win('why', 'bend'), () => fit(s, 'straight edges only', sx, ry + u * (step * 3 + 1), sw, { size: 2.8, font: 'ui', weight: 650, color: s.c('--ink-2'), align: 'left' }));
    s.alpha(s.ease('bend', 0.6), () => fit(s, 'the edges must bend', sx, ry + u * (step * 3 + 1), sw, { size: 2.8, font: 'ui', weight: 650, color: s.c('--accent'), align: 'left' }));
    s.slot('log', s.since('first') >= 0 ? `${Math.floor(Math.min(it, 199) / 10) * 10} ${num(LIN.loss[Math.floor(Math.min(it, 199) / 10) * 10]!, 3)}` : '0 1.096');
    s.slot('acc', s.since('acc') >= 0 ? num(LIN.hits[200]! / NPTS, 2) : '…');
  },
};

// ---------------------------------------------------------------- hidden

const hidden: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const m = margin(s);
    const T = top(s);
    // Phase 1: the network's shape.
    const aA = s.win('ch7', 'lin');
    if (aA > 0)
      s.alpha(aA, () => {
        const xi = m + (w - 2 * m) * 0.14;
        const xh = w / 2;
        const xo = w - m - (w - 2 * m) * 0.14;
        const y0 = T + u * 12;
        const y1 = h - m - u * 16;
        const nh = 9;
        const hy = (j: number) => lerp(y0, y1, j / (nh - 1));
        const iy = (i: number) => lerp(y0, y1, 0.35 + 0.3 * i);
        const oy = (k: number) => lerp(y0, y1, 0.25 + 0.25 * k);
        const ea = s.ease('two', 0.6);
        s.alpha(ea, () => {
          for (let i = 0; i < 2; i++) for (let j = 0; j < nh; j++) if (j !== 6) s.line(xi, iy(i), xh, hy(j), s.tint('blue', 0.28), 0.18);
          for (let j = 0; j < nh; j++) for (let k = 0; k < 3; k++) if (j !== 6) s.line(xh, hy(j), xo, oy(k), s.tint('blue', 0.28), 0.18);
          s.text('W', (xi + xh) / 2, y0 - u * 4, { size: 4.4, italic: true, weight: 650, color: s.c('blue') });
          s.text('(2, 100)', (xi + xh) / 2, y0 - u * 0.4, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
          s.text('W2', (xh + xo) / 2, y0 - u * 4, { size: 4.4, italic: true, weight: 650, color: s.c('blue') });
          s.text('(100, 3)', (xh + xo) / 2, y0 - u * 0.4, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
        });
        const r = Math.min(u * 3, (y1 - y0) / (nh - 1) * 0.36);
        for (let i = 0; i < 2; i++) {
          s.circle(xi, iy(i), r * 1.2, { fill: s.tint('orange', 0.15), stroke: s.c('orange'), lw: 0.35 });
          s.text(`x${'₀₁'[i]}`, xi, iy(i) + u * 0.2, { size: 2.8, font: 'mono', weight: 650, color: s.c('orange') });
        }
        s.text('X', xi, iy(0) - r * 1.2 - u * 3, { size: 4, italic: true, weight: 650, color: s.c('orange') });
        for (let j = 0; j < nh; j++) {
          if (j === 6) {
            s.text('⋮', xh, hy(j), { size: 3.4, color: s.c('--ink-3') });
            continue;
          }
          const a = within(s, 'ch7', 0.6 + j * 0.03, 0.75 + j * 0.03);
          s.alpha(a, () => {
            s.circle(xh, hy(j), r, { fill: s.c('--card'), stroke: s.c('--ink-2'), lw: 0.3 });
            const c = s.ctx;
            c.beginPath();
            c.moveTo(xh - r * 0.05, hy(j) + r * 0.4);
            c.lineTo(xh + r * 0.62, hy(j) + r * 0.4);
            c.lineTo(xh + r * 0.62, hy(j) - r * 0.4);
            c.closePath();
            c.fillStyle = s.tint('blue', 0.55);
            c.fill();
            s.line(xh - r * 0.7, hy(j) + r * 0.4, xh + r * 0.62, hy(j) + r * 0.4, s.c('blue'), 0.2);
          });
        }
        s.alpha(within(s, 'ch7', 0.6, 0.8), () => fit(s, '100 hidden units', xh, y1 + r + u * 4, w * 0.3, { size: 2.8, font: 'ui', weight: 650, color: s.c('--ink-2') }));
        for (let k = 0; k < 3; k++) s.alpha(ea, () => s.circle(xo, oy(k), r * 1.2, { fill: s.tint(classColor(k), 0.25), stroke: s.c(classColor(k)), lw: 0.35 }));
        s.alpha(ea, () => s.text('scores', xo, oy(0) - r * 1.2 - u * 3, { size: 3, font: 'mono', weight: 650, color: s.c('purple') }));
        s.alpha(s.ease('count', 0.6), () => {
          const y = h - m - u * 3;
          pill(s, 'linear: 9', w / 2 - u * 2, y, '--ink-3', { size: 3, align: 'right' });
          pill(s, 'network: 603', w / 2 + u * 2, y, 'blue', { size: 3, align: 'left' });
        });
      });
    // Phase 2: a linear layer gives numbers along a line; the ReLU folds the negative ones up to zero.
    const bA = s.win('lin', 'unit');
    if (bA > 0)
      s.alpha(bA, () => {
        const units = [84, 98, 95, 60, 31, 23];
        const x = XS.d[120]!;
        const yv = XS.d[121]!;
        const pre = units.map((j) => {
          const un = unitOf(NET_FINAL, j);
          return un.a * x + un.b * yv + un.c;
        });
        const gx = m + u * 3;
        const gw = Math.min((w - 2 * m) * (s.tall ? 0.4 : 0.46), u * 48);
        const gy = T + u * 10;
        const gh = Math.min(h - gy - m - u * 8, gw * 0.85);
        const X = (z: number) => gx + ((z + 4) / 6.5) * gw;
        const Y = (v: number) => gy + gh - ((v + 0.6) / 3.1) * gh;
        const ra = s.ease('relu', 0.6);
        s.line(gx, Y(0), gx + gw, Y(0), s.c('--axis'), 0.3);
        s.line(X(0), gy, X(0), gy + gh, s.c('--axis'), 0.3);
        s.text('z', gx + gw, Y(0) + u * 3, { size: 3, italic: true, color: s.c('--ink-2') });
        s.alpha(ra, () => {
          s.line(X(-4), Y(0), X(0), Y(0), s.c('blue'), 0.7);
          s.line(X(0), Y(0), X(2.5), Y(2.5), s.c('blue'), 0.7);
          s.text('max(0, z)', X(-2), Y(1.6), { size: 3.2, font: 'mono', weight: 650, color: s.c('blue') });
        });
        const lift = within(s, 'relu', 0.3, 0.75);
        pre.forEach((z, k) => {
          const a = within(s, 'lin', 0.35 + k * 0.06, 0.45 + k * 0.06);
          s.alpha(a, () => s.circle(X(z), Y(z > 0 ? z * lift : 0), u * 1.2, { fill: s.c(z > 0 ? 'blue' : '--ink-3'), stroke: s.c('--card'), lw: 0.3 }));
        });
        const cx0 = gx + gw + u * (s.tall ? 5 : 8);
        const cw = Math.min((w - m - cx0) / 6, u * 10);
        const ch = u * 6.5;
        const cy = T + u * 16;
        fit(s, 'row 60, six of the units', cx0, cy - u * 6, w - m - cx0, { size: 2.7, font: 'ui', weight: 650, color: s.c('--ink-3'), align: 'left' });
        s.text('X·W + b', cx0, cy - u * 2, { size: 2.9, font: 'mono', weight: 650, color: s.c('blue'), align: 'left' });
        pre.forEach((v, k) => s.alpha(within(s, 'lin', 0.35 + k * 0.06, 0.45 + k * 0.06), () => s.cell(cx0 + k * cw, cy, cw, ch, num(v, 1), 'blue', { size: 2.6 })));
        s.alpha(ra, () => {
          s.text('ReLU', cx0, cy + ch + u * 6, { size: 2.9, font: 'mono', weight: 650, color: s.c('--ink-2'), align: 'left' });
          pre.forEach((v, k) => {
            const a = within(s, 'relu', 0.3 + k * 0.06, 0.4 + k * 0.06);
            s.alpha(a, () => s.cell(cx0 + k * cw, cy + ch + u * 9, cw, ch, num(Math.max(0, v), 1), v > 0 ? 'blue' : '--ink-3', { size: 2.6, on: v > 0 ? 0.4 : 0 }));
          });
        });
      });
    // Phase 3: one unit as a ramp over the plane, then all of them, then their weighted sum.
    const cA = s.ease('unit', 0.6);
    if (cA <= 0) return;
    s.alpha(cA, () => {
      const { pl, side } = plotSide(s, 0.6);
      const [sx, sy, sw] = side;
      const un = unitOf(NET_FINAL, SHOW_UNIT);
      pl.card();
      const vmax = Math.hypot(un.a, un.b) * 1.5 + Math.abs(un.c);
      const blue = rgbOf(s.c('blue'));
      const rampA = s.ease('ramp', 0.6) * (1 - 0.6 * s.ease('many', 0.6)) * (1 - s.ease('sum', 0.6));
      field(s, pl, `ramp${SHOW_UNIT}`, (x, y) => [blue[0], blue[1], blue[2], Math.round(235 * Math.min(1, Math.max(0, un.a * x + un.b * y + un.c) / vmax))], rampA);
      const sumA = s.ease('sum', 0.8);
      hillshade(s, pl, 'score0', (x, y) => netScore(NET_FINAL, x, y, 0), 'purple', sumA);
      const manyA = s.ease('many', 0.8) * (1 - 0.6 * sumA);
      s.alpha(manyA, () => {
        for (let j = 0; j < 100; j++) {
          const v = unitOf(NET_FINAL, j);
          unitLine(s, pl, v.a, v.b, v.c, s.tint('--ink', 0.32), 0.18);
        }
      });
      s.alpha(1 - s.ease('many', 0.6) * 0.6, () => unitLine(s, pl, un.a, un.b, un.c, s.c('--ink'), 0.45));
      points(s, pl, XS, YS, { a: 0.35 + 0.65 * (1 - s.ease('ramp', 0.6)) * (1 - sumA) + 0.3 * sumA, r: pl.r * 0.85 });
      // labels on the two sides of the line
      const n = Math.hypot(un.a, un.b);
      const fx = (-un.c * un.a) / (n * n);
      const fy = (-un.c * un.b) / (n * n);
      const sideA = s.win('ramp', 'many');
      s.alpha(sideA, () => {
        const o = 0.45;
        s.text('on', pl.X(fx + (un.a / n) * o), pl.Y(fy + (un.b / n) * o), { size: 3.6, font: 'ui', weight: 700, color: s.c('blue'), halo: true });
        s.text('off', pl.X(fx - (un.a / n) * o), pl.Y(fy - (un.b / n) * o), { size: 3.6, font: 'ui', weight: 700, color: s.c('--ink-3'), halo: true });
      });
      s.alpha(s.win('unit', 'ramp'), () => s.text('input = 0', pl.X(fx - (un.b / n) * 0.55) , pl.Y(fy + (un.a / n) * 0.55), { size: 3, font: 'ui', weight: 650, halo: true }));
      // side panel
      const L = (str: string, y: number, k: K = '--ink-2', size = 3) => fit(s, str, sx, y, sw, { size, font: 'ui', weight: 650, color: s.c(k), align: 'left' });
      s.alpha(s.win('unit', 'many'), () => {
        L('one hidden unit', sy + u * 4, '--ink-3', 2.8);
        const gx = sx;
        const gw = Math.min(sw, u * 30);
        const gy = sy + u * 10;
        const gh = u * 16;
        const ra = s.ease('ramp', 0.6);
        s.alpha(ra, () => {
          s.line(gx, gy + gh, gx + gw, gy + gh, s.c('--axis'), 0.3);
          s.line(gx, gy + gh - u * 0.3, gx + gw * 0.45, gy + gh - u * 0.3, s.c('blue'), 0.6);
          s.line(gx + gw * 0.45, gy + gh - u * 0.3, gx + gw, gy + u, s.c('blue'), 0.6);
          s.text('off', gx + gw * 0.2, gy + gh + u * 3, { size: 2.7, font: 'ui', weight: 650, color: s.c('--ink-3') });
          s.text('on', gx + gw * 0.75, gy + gh + u * 3, { size: 2.7, font: 'ui', weight: 650, color: s.c('blue') });
          L('a ramp', gy + gh + u * 9);
        });
      });
      s.alpha(s.win('many', 'sum'), () => {
        L('100 units,', sy + u * 4);
        L('100 lines', sy + u * 8.5);
      });
      s.alpha(s.win('sum', 'same'), () => {
        L('class 0 score:', sy + u * 4, '--ink-3', 2.8);
        L('Σ ramp × W2', sy + u * 9, 'purple', 3.2);
        L('a crease along', sy + u * 16, '--ink-2', 2.8);
        L('every line', sy + u * 20, '--ink-2', 2.8);
      });
      s.alpha(s.ease('same', 0.6), () => {
        L('unchanged:', sy + u * 4, '--ink-3', 2.8);
        ['softmax', 'loss', 'dscores'].forEach((t, i) => {
          const y = sy + u * (11 + 6.5 * i);
          s.alpha(within(s, 'same', 0.25 + 0.12 * i, 0.35 + 0.12 * i), () => {
            mark(s, sx + u * 1.6, y, u * 1.5, true);
            s.text(t, sx + u * 4.5, y, { size: 3.2, font: 'mono', weight: 600, color: s.c(t === 'loss' ? 'red' : t === 'dscores' ? 'teal' : '--ink'), align: 'left' });
          });
        });
      });
    });
  },
};

export const scenes2: Record<string, SceneDef> = { dscores, backprop, 'train-linear': trainLinear, hidden };
