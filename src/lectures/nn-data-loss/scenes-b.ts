import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { BN, DEEP_L, type DeepKey, VAR, deep } from './data';
import { type K, type Rect, Frame, area, badge, covEllipse, histo, mix, network, pill, stats } from './draw';

// ---------------------------------------------------------------- init

const INIT_X = [1.0, 0.5, -0.8];
const W_RAND = [
  [0.012, -0.004, 0.018, 0.015],
  [0.006, 0.011, -0.013, 0.002],
  [-0.007, -0.014, 0.003, 0.008],
];
const H_RAND = [0, 1, 2, 3].map((j) => Math.max(0, INIT_X.reduce((a, x, i) => a + x * W_RAND[i]![j]!, 0)));

const init: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const netA = 1 - s.ease('danger', 0.6);
    // which weights: 0 = all zero, 1 = constant 0.3, 2 = small random
    const mode = s.since('random') >= 0 ? 2 : s.since('symmetry') >= 0 ? 1 : 0;
    const swap = mode === 2 ? s.ease('random', 0.6) : mode === 1 ? s.ease('symmetry', 0.6) : 1;
    if (netA > 0) {
      s.alpha(netA, () => {
        const nw = Math.min(w * 0.62, u * 76);
        const r: Rect = [w * 0.68 - nw, h * 0.17, nw, h * 0.56];
        const pos = network(s, r, [3, 4, 1], {
          rad: Math.min(u * 4.4, h * 0.05),
          node: (l) => ({ fill: s.tint(l === 0 ? 'orange' : l === 2 ? 'purple' : 'green', 0.8), on: true }),
          edge: (l, i, j) => {
            if (l === 1) return { col: s.tint('--ink-3', 0.45), w: 0.3 };
            if (mode === 0) return { col: s.tint('--ink-3', 0.3 * swap + 0.25), w: 0.22 };
            if (mode === 1) return { col: s.tint('blue', 0.55 * swap + 0.2), w: 0.5 };
            const v = W_RAND[i]![j]!;
            return { col: s.tint(v > 0 ? 'blue' : 'red', 0.3 + Math.abs(v) * 30 * swap), w: 0.2 + Math.abs(v) * 50 * swap };
          },
        });
        // input values
        pos[0]!.forEach(([x, y], i) => s.text(INIT_X[i]!.toFixed(1).replace('-', '−'), x - u * 6, y, { size: 3.3, font: 'mono', color: s.c('orange'), align: 'right' }));
        // hidden outputs, beside each neuron
        const shown = s.ease('clones', 0.5, 0.5);
        s.alpha(shown, () => {
          const vx = w * 0.74;
          s.text('outputs h', vx, pos[1]![0]![1] - u * 6, { size: 3.1, font: 'ui', weight: 600, color: s.c('--ink-3'), align: 'left' });
          pos[1]!.forEach(([, y], j) => {
            const v = mode === 0 ? '0' : mode === 1 ? '0.21' : H_RAND[j]!.toFixed(3);
            s.text(v, vx, y, { size: 3.6, font: 'mono', weight: 600, color: s.c('green'), align: 'left' });
          });
        });
        // gradients flowing back
        const gA = s.ease('grads', 0.6);
        s.alpha(gA * (mode === 2 ? s.ease('differ', 0.6) : 1), () => {
          const [ox, oy] = pos[2]![0]!;
          pos[1]!.forEach(([x, y], j) => {
            const len = mode === 2 ? [0.35, 0.8, 0.55, 0.2][j]! : 0.55;
            const tx = lerp(ox, x, 0.5 + 0.45 * len);
            const ty = lerp(oy, y, 0.5 + 0.45 * len);
            s.arrow(lerp(ox, x, 0.3), lerp(oy, y, 0.3), tx, ty, s.c('--accent'), 0.5, 2.2);
          });
        });
        const caption = (t: string, a: number, k: K = '--ink-2') => s.alpha(a, () => s.text(t, w / 2, h * 0.84, { size: 4.2, font: 'display', weight: 560, color: s.c(k) }));
        caption('W = 0 everywhere?', s.win('question', 'clones'));
        caption('same output from every neuron', s.win('clones', 'grads'));
        caption('same gradient, same update', s.win('grads', 'forever'));
        caption('four neurons acting as one', s.win('forever', 'symmetry'), 'red');
        caption('W = 0.3 everywhere: still clones', s.win('symmetry', 'random'), 'red');
        caption('W = 0.01 * randn: all different', s.win('random', 'danger'), 'green');
        // the clones, bracketed together
        s.alpha(s.win('forever', 'random'), () => {
          const ys = pos[1]!.map(([, y]) => y);
          const x = pos[1]![0]![0] - u * 6.5;
          s.rrect(x, ys[0]! - u * 6, u * 13, ys[3]! - ys[0]! + u * 12, 3, { stroke: s.c('red'), lw: 0.5 });
        });
      });
    }
    // what a deep stack does to "small"
    const dA = s.ease('danger', 0.6);
    if (dA > 0) {
      s.alpha(dA, () => {
        const n = 10;
        const x0 = w * 0.1;
        const x1 = w * 0.9;
        const cy = h * 0.5;
        for (let l = 0; l < n; l++) {
          const x = x0 + ((x1 - x0) * l) / (n - 1);
          const a = s.ease('danger', 0.4, 0.8 + l * 0.18);
          const fade = 10 ** (-l * 0.32);
          s.alpha(a, () => {
            for (let i = 0; i < 4; i++) s.circle(x, cy + (i - 1.5) * u * 7, u * 2.4, { fill: s.tint('green', 0.08 + 0.75 * fade), stroke: s.tint('--ink-3', 0.6), lw: 0.25 });
            s.text(String(l + 1), x, cy + u * 16, { size: 3, font: 'mono', color: s.c('--ink-3') });
          });
        }
        s.text('ten layers of small weights', w / 2, h * 0.24, { size: 4.6, font: 'display', weight: 560 });
        s.alpha(s.ease('danger', 0.6, 2.6), () => s.text('does the signal survive?', w / 2, h * 0.82, { size: 4.2, italic: true, color: s.c('--accent') }));
      });
    }
  },
};

// ---------------------------------------------------------------- variance

const variance: SceneDef = {
  marks: {
    sum: { tex: String.raw`s = \sum_{i=1}^{n} \sym{W}{w}_i\,\symx_i`, x: 0.5, y: 0.5, size: 5 },
    f1: { tex: String.raw`\mathrm{Var}(a + b) = \mathrm{Var}(a) + \mathrm{Var}(b)`, x: 0.5, y: 0.3, size: 4.6 },
    f2: { tex: String.raw`\mathrm{Var}(c\,a) = c^2\,\mathrm{Var}(a)`, x: 0.5, y: 0.52, size: 4.6 },
    f3: { tex: String.raw`\mathrm{Var}(a\,b) = \mathrm{Var}(a)\,\mathrm{Var}(b)`, x: 0.5, y: 0.74, size: 4.6 },
    d1: { tex: String.raw`\mathrm{Var}(s) = \mathrm{Var}\Big(\sum_{i=1}^{n} \sym{W}{w}_i\,\symx_i\Big)`, x: 0.5, y: 0.3, size: 4.8 },
    d2: { tex: String.raw`= \sum_{i=1}^{n} \mathrm{Var}(\sym{W}{w}_i)\,\mathrm{Var}(\symx_i)`, x: 0.5, y: 0.52, size: 4.8 },
    d3: { tex: String.raw`= n\,\mathrm{Var}(\sym{W}{w})\,\mathrm{Var}(\symx)`, x: 0.5, y: 0.73, size: 5.4 },
    law: { tex: String.raw`\mathrm{Var}(s) = n\,\mathrm{Var}(\sym{W}{w})\,\mathrm{Var}(\symx)`, x: 0.5, y: 0.2, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // the neuron
    const nA = 1 - s.ease('f1', 0.6);
    if (nA > 0) {
      s.alpha(nA, () => {
        const top = h * 0.14;
        const bot = s.since('ev') >= 0 ? lerp(h * 0.62, h * 0.52, s.ease('ev', 0.8)) : h * 0.62;
        const ix = w * 0.22;
        const sx = w * 0.62;
        const sy = (top + bot) / 2;
        const labels = ['x₁', 'x₂', 'x₃', '⋮', 'xₙ'];
        labels.forEach((t, i) => {
          const y = top + ((bot - top) * i) / 4;
          if (t === '⋮') {
            s.text(t, ix, y, { size: 4.4, color: s.c('--ink-3') });
            return;
          }
          s.line(ix + u * 3, y, sx - u * 5, sy, s.tint('blue', 0.5), 0.35);
          s.circle(ix, y, u * 2.8, { fill: s.tint('orange', 0.18), stroke: s.c('orange'), lw: 0.35 });
          s.text(t, ix - u * 6, y, { size: 3.6, italic: true, color: s.c('orange'), align: 'right' });
          const mx = lerp(ix, sx, 0.42);
          const my = lerp(y, sy, 0.42);
          s.text(`w${t.slice(1)}`, mx, my - u * 2.2, { size: 3.2, italic: true, color: s.c('blue'), halo: true });
        });
        s.circle(sx, sy, u * 5, { fill: s.c('--card'), stroke: s.c('--ink-2'), lw: 0.45 });
        s.text('Σ', sx, sy + u * 0.3, { size: 5, color: s.c('--ink') });
        s.arrow(sx + u * 5.5, sy, sx + u * 15, sy, s.c('--ink-2'), 0.45, 2.4);
        s.text('s', sx + u * 17.5, sy, { size: 5, italic: true, weight: 600 });
        s.show('sum', nA * s.ease('neuron', 0.6, 1.2) * (1 - s.ease('ev', 0.6)), { x: 0.5, y: (bot + u * 9) / h });
      });
      // a pile of draws: the mean and the spread
      const eA = s.ease('ev', 0.6) * nA;
      if (eA > 0) {
        s.alpha(eA, () => {
          const r: Rect = [w * 0.12, h * 0.6, w * 0.76, h * 0.26];
          const n = Math.max(20, Math.round(3000 * smooth(s.prog('ev') * 1.6) ** 1.5));
          const fr = new Frame(s, r, [-4, 4, 0, 1]);
          histo(s, r, VAR.x.subarray(0, n), -4, 4, 40, s.tint('orange', 0.45));
          s.line(r[0], r[1] + r[3], r[0] + r[2], r[1] + r[3], s.c('--axis'), 0.35);
          s.line(fr.X(0), r[1] - u, fr.X(0), r[1] + r[3], s.c('teal'), 0.5);
          s.text('average', fr.X(0) + u, r[1] - u * 1.5, { size: 3.2, font: 'ui', color: s.c('teal'), align: 'left' });
          s.alpha(s.ease('ev', 0.6, 3), () => {
            const y = r[1] + r[3] * 0.35;
            s.line(fr.X(-1), y, fr.X(1), y, s.c('--ink'), 0.45);
            s.line(fr.X(-1), y - u, fr.X(-1), y + u, s.c('--ink'), 0.45);
            s.line(fr.X(1), y - u, fr.X(1), y + u, s.c('--ink'), 0.45);
            s.text('spread', fr.X(1) + u * 1.5, y, { size: 3.2, font: 'ui', align: 'left', halo: true });
          });
          s.text(`${n} draws of x`, r[0], r[1] + r[3] + u * 3.4, { size: 3.1, font: 'mono', align: 'left', color: s.c('--ink-3') });
        });
      }
    }
    // three facts
    const fA = s.win('f1', 'derive');
    if (fA > 0) {
      const tags: [string, string, string][] = [
        ['f1', '1  independent: variances add', 'f1'],
        ['f2', '2  scale by c: variance times c²', 'f2'],
        ['f3', '3  independent, mean 0: product', 'f3'],
      ];
      tags.forEach(([mk, t, beat], i) => {
        const a = fA * s.ease(beat, 0.6);
        const y = [0.3, 0.52, 0.74][i]!;
        s.alpha(a, () => s.text(t, w * 0.08, h * (y - 0.075), { size: 3.2, font: 'ui', weight: 600, color: s.c('--ink-3'), align: 'left' }));
        s.show(mk, a);
      });
    }
    // the derivation
    const dA = s.win('derive', 'shrink');
    if (dA > 0) {
      s.show('d1', dA * s.ease('derive', 0.6));
      s.show('d2', dA * s.ease('derive', 0.6, 1.6));
      s.show('d3', dA * s.ease('law', 0.6));
      s.alpha(dA * s.ease('law', 0.6, 0.4), () => s.rrect(w * 0.2, h * 0.65, w * 0.6, h * 0.16, 2, { stroke: s.c('--accent'), lw: 0.5 }));
    }
    // the factor, on real numbers
    const hA = s.ease('shrink', 0.6);
    if (hA > 0) {
      s.show('law', hA);
      const fixT = s.ease('fix', 1.6, 0.6);
      const k = lerp(1, 10, fixT);
      const sv = VAR.sSmall.map((v) => v * k);
      const vs = VAR.varSmall * k * k;
      s.slot('scale', fixT > 0.5 ? '1 / np.sqrt(n)' : '0.01');
      s.slot('var', fmt(vs, 2));
      s.alpha(hA, () => {
        const box: Rect = s.tall ? [w * 0.08, h * 0.32, w * 0.84, h * 0.6] : [w * 0.06, h * 0.34, w * 0.88, h * 0.56];
        const panels: Rect[] = s.tall
          ? [[box[0], box[1] + u * 4, box[2], box[3] * 0.32], [box[0], box[1] + box[3] * 0.56, box[2], box[3] * 0.32]]
          : [[box[0], box[1] + u * 6, box[2] * 0.46, box[3] * 0.62], [box[0] + box[2] * 0.54, box[1] + u * 6, box[2] * 0.46, box[3] * 0.62]];
        const draw = (r: Rect, vals: Float64Array, title: string, k2: K, peak?: number) => {
          s.text(title, r[0], r[1] - u * 2.4, { size: 3.4, font: 'mono', weight: 600, color: s.c(k2), align: 'left' });
          const m = histo(s, r, vals, -4, 4, 48, s.tint(k2, 0.5), peak);
          s.line(r[0], r[1] + r[3], r[0] + r[2], r[1] + r[3], s.c('--axis'), 0.35);
          for (const t of [-3, 0, 3]) s.text(String(t), r[0] + (r[2] * (t + 4)) / 8, r[1] + r[3] + u * 2.8, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
          return m;
        };
        const peak = draw(panels[0]!, VAR.x, `inputs x: Var = ${VAR.varX.toFixed(2)}`, 'orange');
        draw(panels[1]!, sv, `sums s: Var = ${fmt(vs, 2)}`, fixT > 0.5 ? 'green' : 'red', peak);
        const f = fixT > 0.5 ? 'n · Var(w) = 100 × 0.01 = 1' : 'n · Var(w) = 100 × 0.0001 = 0.01';
        s.text(f, w / 2, box[1] + box[3] + u * 1, { size: 3.4, font: 'mono', weight: 600, color: s.c(fixT > 0.5 ? 'green' : 'red') });
      });
    }
  },
};

// ---------------------------------------------------------------- ten layers

const CONFIGS: Record<DeepKey, { label: string; scale: string; relu: boolean }> = {
  small: { label: 'tanh, W × 0.01', scale: '0.01', relu: false },
  big: { label: 'tanh, W × 1.0', scale: '1.0', relu: false },
  xavier: { label: 'tanh, Xavier: Var = 1/n', scale: '1 / np.sqrt(fan_in)', relu: false },
  'relu-xavier': { label: 'ReLU, Xavier: Var = 1/n', scale: '1 / np.sqrt(fan_in)', relu: true },
  'relu-he': { label: 'ReLU, He: Var = 2/n', scale: 'np.sqrt(2 / fan_in)', relu: true },
};

function deepPanels(s: Scene, r: Rect, key: DeepKey, a: number, upto: number, flat: number): void {
  const { u } = s;
  const { H } = deep(key);
  const relu = CONFIGS[key].relu;
  const lo = relu ? 0 : -1;
  const hi = relu ? 4 : 1;
  const cols = 5;
  const gx = u * 1.4;
  const gy = u * 1.6;
  const pw = (r[2] - gx * (cols - 1)) / cols;
  const ph = (r[3] - gy) / 2;
  for (let l = 0; l < DEEP_L; l++) {
    const px = r[0] + (l % cols) * (pw + gx);
    const py = r[1] + Math.floor(l / cols) * (ph + gy);
    s.alpha(a, () => {
      s.rrect(px, py, pw, ph, 1.2, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.25 });
      s.text(`${l + 1}`, px + u * 1.2, py + u * 2.6, { size: 2.9, font: 'mono', weight: 600, color: s.c('--ink-3'), align: 'left' });
      const inner: Rect = [px + u * 1, py + u * 4.6, pw - u * 2, ph - u * 6.4];
      if (flat > 0 && !relu)
        s.alpha(flat, () => {
          s.rrect(inner[0], inner[1], inner[2] * 0.08, inner[3], 0, { fill: s.tint('red', 0.14) });
          s.rrect(inner[0] + inner[2] * 0.92, inner[1], inner[2] * 0.08, inner[3], 0, { fill: s.tint('red', 0.14) });
        });
      if (l < upto) {
        const vals = H[l]!;
        if (relu) {
          let zeros = 0;
          for (let i = 0; i < vals.length; i++) if (vals[i] === 0) zeros++;
          const nz = vals.filter((v) => v > 0);
          histo(s, [inner[0] + inner[2] * 0.06, inner[1], inner[2] * 0.94, inner[3]], nz, lo, hi, 20, s.tint('orange', 0.85));
          s.rrect(inner[0], inner[1] + inner[3] * (1 - Math.min(1, zeros / vals.length / 0.6)), Math.max(1.5, inner[2] * 0.04), inner[3] * Math.min(1, zeros / vals.length / 0.6), 0, { fill: s.tint('slate', 0.75) });
        } else histo(s, inner, vals, lo, hi, 21, s.tint('orange', 0.85));
      }
      s.line(inner[0], inner[1] + inner[3], inner[0] + inner[2], inner[1] + inner[3], s.c('--axis'), 0.25);
    });
  }
}

const deepScene: SceneDef = {
  marks: {
    xav: { tex: String.raw`\text{Xavier: } \mathrm{Var}(\symW) = 1/n_{\text{in}}`, x: 0.5, y: 0.6, size: 4.4 },
    glo: { tex: String.raw`\text{Glorot: } \mathrm{Var}(\symW) = 2/(n_{\text{in}} + n_{\text{out}})`, x: 0.5, y: 0.72, size: 4.4 },
    he: { tex: String.raw`\text{He: } \mathrm{Var}(\symW) = 2/n_{\text{in}}`, x: 0.5, y: 0.84, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const seq: [string, DeepKey][] = [
      ['setup', 'small'],
      ['big', 'big'],
      ['xavier', 'xavier'],
      ['relu', 'relu-xavier'],
      ['he', 'relu-he'],
    ];
    let cur = 0;
    for (let i = 1; i < seq.length; i++) if (s.since(seq[i]![0]) >= 0) cur = i;
    const key = seq[cur]![1];
    const prevKey = seq[Math.max(0, cur - 1)]![1];
    const e = cur === 0 ? 1 : s.ease(seq[cur]![0], 1.0);
    const sdNow = deep(key).sd.map(Math.log10);
    const sdPrev = deep(prevKey).sd.map(Math.log10);
    const ys = sdNow.map((v, i) => lerp(sdPrev[i]!, v, e));
    const upto = cur === 0 ? (s.since('small') >= 0 ? clamp01(s.prog('small') * 1.4) * DEEP_L : 0) : DEEP_L;
    const cfg = CONFIGS[key];
    s.slot('scale', s.since('small') >= 0 ? cfg.scale : '0.01');
    s.slot('act', cfg.relu ? 'np.maximum(0, H)' : 'np.tanh(H)');
    s.slot('std', upto >= DEEP_L ? fmt(deep(key).sd[DEEP_L - 1]!, 2) : '…');
    const gA = s.ease('glorot', 0.6);
    const [rx, ry, rw, rh] = area(s, 0.12, 0.05);
    const chart: Rect = [rx + u * 9, ry + u * 7, rw - u * 9, rh * 0.36];
    const panels: Rect = [rx, ry + rh * 0.5, rw, rh * 0.5];
    s.alpha(1 - gA * 0.85, () => {
      // the spread per layer
      const fr = new Frame(s, chart, [0.5, 10.5, -10.6, 1.2]);
      s.rrect(fr.X(0.5), fr.Y(0), fr.X(10.5) - fr.X(0.5), fr.Y(-1) - fr.Y(0), 0, { fill: s.tint('green', 0.12) });
      for (const v of [0, -2, -4, -6, -8, -10]) {
        s.line(fr.X(0.5), fr.Y(v), fr.X(10.5), fr.Y(v), s.c('--grid'), 0.25);
        s.text(v === 0 ? '1' : `1e${v}`, fr.X(0.5) - u * 1.2, fr.Y(v), { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
      }
      s.text('std per layer (log)', fr.X(10.5), ry + u * 2.6, { size: 3, font: 'ui', color: s.c('--ink-3'), align: 'right' });
      const n = Math.floor(upto);
      if (n > 0) {
        fr.path(ys.slice(0, n).map((_, i) => i + 1), ys.slice(0, n), s.c('orange'), 0.6);
        ys.slice(0, n).forEach((y, i) => fr.dot(i + 1, Math.max(-10.6, y), 0.9, s.c('orange')));
      }
      pill(s, cfg.label, rx, ry + u * 2.6, cfg.relu ? 'purple' : 'blue', { align: 'left', size: 3.2 });
      // histograms, crossfading between settings
      const flat = s.win('flat', 'xavier');
      if (e < 1 && cur > 0) deepPanels(s, panels, prevKey, 1 - e, DEEP_L, 0);
      deepPanels(s, panels, key, cur > 0 ? e : 1, upto, flat);
      s.alpha(s.win('dead', 'big'), () => {
        const pw = (panels[2] - u * 1.4 * 4) / 5;
        const ph = (panels[3] - u * 1.6) / 2;
        const px = panels[0] + 4 * (pw + u * 1.4);
        const py = panels[1] + ph + u * 1.6;
        s.rrect(px - u * 0.5, py - u * 0.5, pw + u, ph + u, 1.4, { stroke: s.c('red'), lw: 0.6 });
        s.text('≈ 0', px + pw - u, py + u * 2.6, { size: 3.2, font: 'mono', weight: 600, color: s.c('red'), align: 'right', halo: true });
      });
      s.alpha(s.win('flat', 'xavier'), () => s.text('saturated: tanh is flat here', w / 2, panels[1] - u * 2.2, { size: 3.4, italic: true, color: s.c('red'), halo: true }));
    });
    if (gA > 0) {
      const bA = s.ease('bias', 0.6);
      s.show('xav', gA * (1 - bA));
      s.show('glo', gA * (1 - bA));
      s.show('he', gA * (1 - bA));
      s.alpha(gA * (1 - bA), () => s.text('three calibrated initializations', w / 2, h * 0.48, { size: 4.2, font: 'display', weight: 560 }));
      s.alpha(bA, () => {
        const cw = Math.min(w * 0.8, u * 92);
        const cx = (w - cw) / 2;
        const cy = h * 0.5;
        s.rrect(cx, cy, cw, h * 0.36, 2.4, { fill: s.c('--card'), stroke: s.c('green'), lw: 0.5 });
        s.text('the recipe for ReLU networks', w / 2, cy + u * 6, { size: 4.2, font: 'display', weight: 600, color: s.c('green') });
        s.text('W = np.random.randn(n, H)', w / 2, cy + h * 0.16, { size: 3.6, font: 'mono', weight: 600 });
        s.text('W *= np.sqrt(2.0 / n)', w / 2, cy + h * 0.16 + u * 5.4, { size: 3.6, font: 'mono', weight: 600, color: s.c('blue') });
        s.text('b = np.zeros(H)', w / 2, cy + h * 0.16 + u * 10.8, { size: 3.6, font: 'mono', weight: 600, color: s.c('green') });
      });
    }
  },
};

// ---------------------------------------------------------------- batch normalization

const DRIFT = (() => {
  const r = new Rng(77);
  return [0.35, -0.3, 0.6].map((bias) => {
    const pts: number[] = [];
    let v = 0;
    for (let i = 0; i <= 80; i++) {
      pts.push(v);
      v += 0.012 * bias + r.randn() * 0.035;
    }
    return pts;
  });
})();

/** x -> W -> BN -> tanh, as boxes, with an optional backward arrow and pointer at BN. */
function blocks(s: Scene, cy: number, back: number, point: number): void {
  const { w, u } = s;
  const names: [string, K][] = [
    ['x', 'orange'],
    ['W', 'blue'],
    ['BN', 'purple'],
    ['tanh', 'slate'],
  ];
  const bw = Math.min(w * 0.16, u * 18);
  const gap = (Math.min(w * 0.9, u * 120) - bw * 4) / 3;
  const x0 = (w - (bw * 4 + gap * 3)) / 2;
  names.forEach(([t, k], i) => {
    const x = x0 + i * (bw + gap);
    const bn = i === 2;
    s.rrect(x, cy - u * 5, bw, u * 10, 1.6, { fill: s.tint(k, bn ? 0.2 : 0.08), stroke: s.tint(k, bn ? 1 : 0.6), lw: bn ? 0.6 : 0.35 });
    s.text(t, x + bw / 2, cy + u * 0.3, { size: 4, font: t === 'x' || t === 'W' ? 'serif' : 'mono', italic: t === 'x' || t === 'W', weight: 600, color: s.c(k) });
    if (i < 3) s.arrow(x + bw + u, cy, x + bw + gap - u, cy, s.c('--ink-3'), 0.45, 2.2);
  });
  s.alpha(back, () => {
    const y = cy + u * 10;
    s.arrow(x0 + 3 * (bw + gap) + bw / 2, y, x0 + bw * 1.5, y, s.c('--accent'), 0.5, 2.4);
    s.text('gradients flow back through BN', w / 2, y + u * 4.4, { size: 3.4, italic: true, color: s.c('--accent') });
  });
  s.alpha(point, () => {
    const x = x0 + 2 * (bw + gap) + bw / 2;
    s.arrow(x, cy - u * 15, x, cy - u * 6.5, s.c('purple'), 0.5, 2.4);
    s.text('after the layer, before the nonlinearity', w / 2, cy - u * 18, { size: 3.6, italic: true, color: s.c('purple') });
  });
}

const batchnorm: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // phase A: drift, then pinned
    const aA = 1 - s.ease('batch', 0.6);
    if (aA > 0) {
      s.alpha(aA, () => {
        const cA = 1 - s.ease('diff', 0.6);
        s.alpha(cA, () => {
          const fr = new Frame(s, [w * 0.08, h * 0.28, w * 0.7, h * 0.56], [0, 80, -1.4, 1.4]);
          s.line(fr.X(0), fr.Y(0), fr.X(80), fr.Y(0), s.tint('green', 0.6), 0.4, [1, 0.8]);
          s.line(fr.X(0), fr.Y(-1.4), fr.X(0), fr.Y(1.4), s.c('--axis'), 0.3);
          s.text('1', fr.X(0) - u * 1.2, fr.Y(0), { size: 3, font: 'mono', weight: 600, color: s.c('green'), align: 'right' });
          s.line(fr.X(0), fr.Y(-1.4), fr.X(80), fr.Y(-1.4), s.c('--axis'), 0.35);
          s.text('training steps →', fr.X(80), fr.Y(-1.4) + u * 3, { size: 3, font: 'ui', color: s.c('--ink-3'), align: 'right' });
          s.text('each layer\'s spread (log)', fr.X(0), fr.Y(1.4) - u * 1, { size: 3, font: 'ui', color: s.c('--ink-3'), align: 'left' });
          const pin = s.ease('idea', 1.4, 0.8);
          const n = Math.max(2, Math.round(81 * clamp01(s.prog('drift') * 1.3)));
          const ks: K[] = ['blue', 'purple', 'orange'];
          const ends: [number, number][] = [];
          DRIFT.forEach((pts, j) => {
            const ys = pts.slice(0, n).map((v) => v * (1 - pin));
            fr.path(ys.map((_, i) => i), ys, s.c(ks[j]!), 0.5);
            ends.push([j, fr.Y(ys[ys.length - 1]!)]);
          });
          // labels at the line ends, pushed apart so they never stack
          ends.sort((a, b) => a[1] - b[1]);
          for (let i = 1; i < ends.length; i++) ends[i]![1] = Math.max(ends[i]![1], ends[i - 1]![1] + u * 3.4);
          for (const [j, y] of ends) s.text(`layer ${[2, 5, 8][j]}`, fr.X(n - 1) + u * 1.2, y, { size: 3, font: 'mono', weight: 600, color: s.c(ks[j]!), align: 'left', halo: true });
          s.alpha(s.ease('idea', 0.6, 1.4), () => s.text('BatchNorm: pinned to 1, every step', w / 2, h * 0.17, { size: 4, font: 'display', weight: 560, color: s.c('purple') }));
        });
        s.alpha(s.ease('diff', 0.6), () => blocks(s, h * 0.45, s.ease('diff', 0.6, 1.2), 0));
      });
    }
    // phase B and D: the mini-batch
    const sA = s.win('batch', 'where') + s.win('test', 'buys');
    if (sA > 0) {
      const [rx, ry, rw, rh] = area(s, 0.12, 0.05);
      const fr = new Frame(s, [rx, ry, rw, rh * 0.64], [-4.6, 8, -3.6, 3.6], true);
      const tb: Rect = [fr.box[0], ry + rh * 0.7, fr.box[2], rh * 0.3];
      const tf = new Frame(s, tb, [-4.6, 8, -1.35, 1.35]);
      const raw = BN.batches[0]!;
      const st0 = BN.st[0]!;
      const sd = [Math.sqrt(st0.cxx), Math.sqrt(st0.cyy)];
      const cen = raw.map((v, i) => v - (i % 2 ? st0.my : st0.mx));
      const nrm = cen.map((v, i) => v / Math.sqrt(sd[i % 2]! ** 2 + 1e-5));
      let P: Float64Array;
      let tag = 'raw pre-activations';
      let k = 0;
      if (s.since('test') >= 0) {
        k = Math.round(30 * clamp01(s.prog(s.since('converge') >= 0 ? 'converge' : 'test') * 1.2));
        const b = BN.batches[k]!;
        if (s.since('converge') >= 0) {
          const R = BN.running[k]!;
          P = b.map((v, i) => (v - R.m[i % 2]!) / Math.sqrt(R.v[i % 2]! + 1e-5));
          tag = `normalized with running averages, batch ${k}`;
        } else {
          P = b;
          tag = `batch ${k}: its mean (teal) and the running mean`;
        }
      } else {
        const m = s.ease('mean', 1.4, 0.3);
        const v = s.ease('var', 1.4, 0.6);
        const un = s.ease('undo', 2, 0.6);
        P = un > 0 ? mix(nrm, raw, un) : v > 0 ? mix(cen, nrm, v) : mix(raw, cen, m);
        if (m > 0) tag = 'minus the mean';
        if (v > 0) tag = 'divided by the std';
        if (s.since('gamma') >= 0) tag = 'times γ, plus β';
        if (un > 0) tag = 'γ = σ, β = μ: the original values';
        s.slot('g', fmt(lerp(1, sd[0]!, un), 2));
        s.slot('b', fmt(lerp(0, st0.mx, un), 2));
      }
      s.alpha(sA, () => {
        fr.grid(1, 1);
        const testing = s.since('test') >= 0;
        if (testing && s.since('converge') < 0) {
          // batch means, and the running mean chasing them
          for (let j = 1; j <= k; j++) fr.dot(BN.st[j]!.mx, BN.st[j]!.my, 0.8, s.tint('teal', 0.5));
          const path = BN.running.slice(0, k + 1);
          fr.path(path.map((r) => r.m[0]), path.map((r) => r.m[1]), s.c('teal'), 0.5);
          const R = BN.running[k]!;
          fr.dot(R.m[0], R.m[1], 1.6, s.c('teal'), true);
          s.text('running mean', fr.X(R.m[0]), fr.Y(R.m[1]) + u * 4.5, { size: 3.2, font: 'mono', weight: 600, color: s.c('teal'), halo: true });
        }
        for (let i = 0; i < P.length; i += 2) fr.dot(P[i]!, P[i + 1]!, 1.05, s.tint('orange', testing && s.since('converge') < 0 ? 0.35 : 0.7));
        covEllipse(fr, P, { ring: 0.8, mean: testing ? 0 : 1 });
        s.text(tag, fr.box[0] + u, fr.box[1] + u * 2.6, { size: 3.6, font: 'display', weight: 560, align: 'left', halo: true });
        s.text('feature 1 →', fr.box[0] + fr.box[2] - u, fr.box[1] + fr.box[3] - u * 2, { size: 3, font: 'ui', color: s.c('--ink-3'), align: 'right', halo: true });
        s.alpha(s.win('tilt', 'gamma'), () => s.text('still tilted', fr.X(2.6), fr.Y(2.7), { size: 3.8, font: 'display', weight: 600, color: s.c('purple'), align: 'left', halo: true }));
        // what tanh receives
        const c = s.ctx;
        c.fillStyle = s.tint('red', 0.08);
        c.fillRect(tb[0], tb[1], tf.X(-2) - tb[0], tb[3]);
        c.fillRect(tf.X(2), tb[1], tb[0] + tb[2] - tf.X(2), tb[3]);
        s.line(tb[0], tf.Y(0), tb[0] + tb[2], tf.Y(0), s.c('--axis'), 0.3);
        s.line(tf.X(0), tb[1], tf.X(0), tb[1] + tb[3], s.c('--axis'), 0.3);
        tf.fn(Math.tanh, s.c('--ink-2'), 0.5);
        let sat = 0;
        for (let i = 0; i < P.length; i += 2) {
          const v = P[i]!;
          if (Math.abs(v) > 2) sat++;
          tf.dot(v, Math.tanh(v), 0.9, s.tint('orange', 0.75));
        }
        s.text(`saturated: ${Math.round((100 * sat) / (P.length / 2))}%`, tb[0] + tb[2] - u, tb[1] + tb[3] - u * 2, { size: 3.2, font: 'mono', weight: 600, color: s.c(sat > 10 ? 'red' : 'green'), align: 'right', halo: true });
        s.text('tanh of feature 1', tb[0] + u, tb[1] + u * 2, { size: 3, font: 'ui', color: s.c('--ink-3'), align: 'left' });
      });
    }
    // phase C: where it goes
    const wA = s.win('where', 'test');
    if (wA > 0) s.alpha(wA, () => blocks(s, h * 0.55, 0, 1));
    // phase E: what it buys
    const eA = s.ease('buys', 0.6);
    if (eA > 0) {
      s.alpha(eA, () => {
        const items: [string, string][] = [
          ['better gradient flow', 'buys'],
          ['less sensitive to initialization', 'buys'],
          ['higher learning rates', 'buys'],
          ['a mild regularizer', 'noise'],
        ];
        const rw = Math.min(w * 0.84, u * 96);
        const x0 = (w - rw) / 2;
        s.text('what BatchNorm buys', w / 2, h * 0.2, { size: 4.6, font: 'display', weight: 600, color: s.c('purple') });
        items.forEach(([t, beat], i) => {
          const a = s.ease(beat, 0.5, beat === 'buys' ? 0.6 + i * 1.3 : 0.3);
          const y = h * 0.34 + i * h * 0.15;
          s.alpha(a, () => {
            s.rrect(x0, y - h * 0.055, rw, h * 0.11, 2, { fill: s.tint('purple', 0.06), stroke: s.tint('purple', 0.4), lw: 0.3 });
            badge(s, x0 + u * 5, y, u * 2.4, true);
            s.text(t, x0 + u * 10, y + u * 0.2, { size: 4, font: 'serif', align: 'left' });
          });
        });
      });
    }
  },
};

export const scenesB: Record<string, SceneDef> = { init, variance, deep: deepScene, batchnorm };
