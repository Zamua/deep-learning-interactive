import { fmt } from '../../core/code';
import type { Dataset2D } from '../../core/data';
import type { MLP } from '../../core/nn';
import { CLASS_COLORS } from '../../core/plot';
import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { Frame, type Rect, area, card, check, drawNet, fit, points, regionImage, split } from './draw';
import { DISC, DISC_NETS, DISC_R, DISC_TEST, FWD_B, FWD_SIZES, FWD_VALS, FWD_W, RESTARTS, SPIRAL, SPIRAL_NETS, accuracy, bumpError, bumps, edge, sig, steep, target } from './models';

const pct = (v: number) => `${Math.round(v * 100)}%`;

// ---------------------------------------------------------------- layers, and counting

interface Config {
  sizes: number[];
  names: string[];
}
const NET_A: Config = { sizes: [3, 4, 2], names: ['input', 'layer 1', 'layer 2'] };
const NET_1: Config = { sizes: [3, 1], names: ['input', 'layer 1'] };
const NET_B: Config = { sizes: [3, 4, 4, 1], names: ['input', 'layer 1', 'layer 2', 'layer 3'] };

function counts(sizes: number[]): { L: number; neurons: number; weights: number; biases: number } {
  let weights = 0;
  for (let l = 1; l < sizes.length; l++) weights += sizes[l - 1]! * sizes[l]!;
  const neurons = sizes.slice(1).reduce((a, b) => a + b, 0);
  return { L: sizes.length - 1, neurons, weights, biases: neurons };
}

const layers: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const one = s.win('single', 'out');
    const deep = s.ease('deeper', 0.8);
    const scaleA = s.ease('scale', 0.7);
    const cur = deep > 0.5 ? NET_B : one > 0.5 ? NET_1 : NET_A;
    const c = counts(cur.sizes);
    s.slot('sizes', cur.sizes.join(', '));
    s.slot('L', c.L);
    s.slot('neurons', c.neurons);
    s.slot('weights', c.weights);
    s.slot('biases', c.biases);
    s.slot('params', c.weights + c.biases);
    const rect: Rect = [u * 10, h * 0.24, w - u * 20, h * 0.46];
    const labelY = rect[1] + rect[3] + u * 5;
    const tallyY = h * 0.89;
    const pA = s.ease('params', 0.5);
    const draw = (cfg: Config, a: number) => {
      if (a <= 0.01) return;
      const L = cfg.sizes.length;
      s.alpha(a * (1 - 0.92 * scaleA), () => {
        const fc = s.win('fc', 'count');
        const outHi = s.win('out', 'params');
        const g = drawNet(s, rect, cfg.sizes, {
          col: (l) => s.ease('org', 0.5, 0.6 + l * 0.7),
          wire: (l, i) => {
            if (fc > 0 && l === 1) return i === 1 ? 1 : 1 - 0.75 * fc;
            if (fc > 0) return 1 - 0.75 * fc;
            if (pA > 0 && cfg === NET_A) return l === 1 ? 0.35 + 0.65 * s.ease('params', 0.6, 1.2) : 0.35 + 0.65 * s.ease('params', 0.6, 3);
            return 1;
          },
          fill: (l, i) => (fc > 0 && l === 1 && i === 1 ? fc : outHi > 0 && l === L - 1 ? 0.6 * outHi : 0),
        });
        // Column names; the input is not counted.
        const cnt = s.ease('count', 0.5);
        cfg.names.forEach((nm, l) => {
          const x = g.colX(l);
          s.alpha(s.ease('org', 0.5, 0.6 + l * 0.7), () => {
            const counted = l > 0;
            const label = cnt > 0.5 ? nm : l === 0 ? 'input' : l === L - 1 ? 'output' : 'hidden';
            s.text(label, x, labelY, { size: 3.6, color: s.c(counted || cnt < 0.5 ? '--ink-2' : '--ink-3'), weight: counted && cnt > 0.5 ? 600 : 450 });
            s.text(String(cfg.sizes[l]), x, labelY + u * 4.8, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
            if (!counted) s.alpha(cnt, () => s.text('not counted', x, labelY + u * 9.4, { size: 3, italic: true, color: s.c('red') }));
          });
        });
        s.alpha(outHi, () => s.text('no activation', g.colX(L - 1) + g.r, rect[1] - u * 3, { size: 3.4, italic: true, weight: 600, color: s.c('purple'), halo: true, align: 'right' }));
        s.alpha(fc, () => s.text('every neuron in the layer before', (g.colX(0) + g.colX(1)) / 2, rect[1] - u * 3, { size: 3.4, italic: true, color: s.c('--accent'), halo: true }));
      });
    };
    draw(NET_A, (1 - one) * (1 - deep));
    draw(NET_1, one);
    draw(NET_B, deep);
    // Titles.
    s.alpha(s.win('org', 'fc') * s.ease('org', 0.5, 2.6), () => fit(s, 'each layer feeds the next; no cycles', w / 2, h * 0.17, w * 0.9, { size: 4.2, italic: true, color: s.c('--ink-2') }));
    s.alpha(s.win('count', 'single') * s.ease('count', 0.5, 4), () => fit(s, 'a 2-layer network', w / 2, h * 0.17, w * 0.9, { size: 5, font: 'display', weight: 600 }));
    s.alpha(one, () => fit(s, 'a 1-layer network: logistic regression, SVM', w / 2, h * 0.17, w * 0.9, { size: 4.4, font: 'display', weight: 560 }));
    // The tally.
    const t1 = s.win('params', 'deeper');
    s.alpha(t1 * (1 - scaleA), () => {
      const a1 = s.ease('params', 0.5, 1.2);
      const a2 = s.ease('params', 0.5, 3);
      const a3 = s.ease('params', 0.5, 5.6);
      const parts: [string, number, Color][] = [
        ['3×4', a1, 'blue'],
        [' + 4×2 = 20 weights', a2, 'blue'],
        ['  + 6 biases = 26', a3, 'green'],
      ];
      const fs = Math.min(4.2, (w / u) * 0.046);
      let x = (w - parts.reduce((acc, [t]) => acc + s.measure(t, { size: fs, font: 'mono' }), 0)) / 2;
      for (const [t, a, k] of parts) {
        s.alpha(a, () => s.text(t, x, tallyY, { size: fs, font: 'mono', weight: 600, align: 'left', color: s.c(k) }));
        x += s.measure(t, { size: fs, font: 'mono' });
      }
    });
    s.alpha(deep * (1 - scaleA), () => {
      const fs = Math.min(4.2, (w / u) * 0.046);
      fit(s, '12 + 16 + 4 = 32 weights  + 9 biases = 41', w / 2, tallyY, w * 0.92, { size: fs, font: 'mono', weight: 600, color: s.c('blue') });
    });
    s.alpha(scaleA, () => {
      fit(s, '~100,000,000', w / 2, h * 0.46, w * 0.9, { size: 10, font: 'mono', weight: 600, color: s.c('blue') });
      fit(s, 'parameters, across 10 to 20 layers', w / 2, h * 0.58, w * 0.9, { size: 4.4, color: s.c('--ink-2') });
      fit(s, 'the ConvNets later in the course', w / 2, h * 0.66, w * 0.9, { size: 3.8, italic: true, color: s.c('--ink-3') });
    });
  },
};

// ---------------------------------------------------------------- the forward pass

const forward: SceneDef = {
  marks: {
    layer: { tex: String.raw`\sym{h}{h_1} = \symf\big(\sym{W}{W_1}\,\symx + \sym{b}{b_1}\big)`, x: 0.5, y: 0.2, size: 6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const arr = (a: number[]) => `[${a.map((v) => v.toFixed(2)).join(', ')}]`;
    const lit = s.since('l3') >= 0 ? 3 : s.since('l2') >= 0 ? 2 : s.since('l1') >= 0 ? 1 : 0;
    s.slot('h1', lit >= 1 ? arr(FWD_VALS[1]!) : '…');
    s.slot('h2', lit >= 2 ? arr(FWD_VALS[2]!) : '…');
    s.slot('s', lit >= 3 ? arr(FWD_VALS[3]!) : '…');

    // Phase 1: a layer as one matrix multiply.
    const mA = s.win('payoff', 'input');
    if (mA > 0) {
      s.show('layer', mA * s.ease('payoff', 0.6));
      const W1 = FWD_W[0]!;
      const b1 = FWD_B[0]!;
      const h1 = FWD_VALS[1]!;
      const cols = 7;
      const cw = Math.min(u * 13, (w - u * 12) / (cols + 2.6));
      const ch = Math.min(cw * 0.7, h * 0.11);
      const nums = cw / u >= 10;
      const gy = h * 0.58 - 2 * ch;
      let x = (w - (cols * cw + 2.6 * cw)) / 2 + u * 2;
      const rowOn = (i: number) => {
        if (s.since('line') >= 0) {
          const p = s.prog('line');
          return Math.floor(p * 4.4) === i ? 1 : 0;
        }
        if (s.since('rows') >= 0) return Math.floor(s.prog('rows') * 4.6) === i ? 1 : 0;
        return 0;
      };
      const filled = (i: number) => s.since('line') >= 0 && s.prog('line') * 4.4 > i + 0.6;
      s.alpha(mA * s.ease('payoff', 0.6, 0.4), () => {
        // W1: one row per neuron.
        for (let i = 0; i < 4; i++) {
          const on = rowOn(i);
          s.circle(x - u * 3, gy + i * ch + ch / 2, u * 1.5, { fill: s.tint('gold', 0.3 + 0.6 * on), stroke: s.c('gold'), lw: 0.3 });
          for (let j = 0; j < 3; j++) {
            const v = W1[i]![j]!;
            s.cell(x + j * cw, gy + i * ch, cw, ch, nums ? fmt(v, 2) : '', v >= 0 ? 'blue' : 'red', { on, size: Math.min(3.2, (ch / u) * 0.42) });
          }
        }
        s.text('W1', x + 1.5 * cw, gy - u * 3.2, { size: 4, italic: true, weight: 600, color: s.c('blue') });
        s.alpha(s.ease('rows', 0.5), () => s.text('one row per neuron', x + 1.5 * cw, gy + 4 * ch + u * 3.6, { size: 3.2, italic: true, color: s.c('--ink-2') }));
        x += 3 * cw + u * 1.5;
        // x
        const xy = gy + ch / 2;
        for (let j = 0; j < 3; j++) s.cell(x, xy + j * ch, cw, ch, fmt(FWD_VALS[0]![j]!, 2), 'orange', { on: rowOn(0) + rowOn(1) + rowOn(2) + rowOn(3), size: Math.min(3.2, (ch / u) * 0.42) });
        s.text('x', x + cw / 2, gy - u * 3.2, { size: 4, italic: true, weight: 600, color: s.c('orange') });
        x += cw + u * 1.5;
        s.text('+', x + u * 1.5, gy + 2 * ch, { size: 5, color: s.c('--ink-3') });
        x += u * 3.5;
        for (let i = 0; i < 4; i++) s.cell(x, gy + i * ch, cw, ch, nums ? fmt(b1[i]!, 2) : '', 'green', { on: rowOn(i), size: Math.min(3.2, (ch / u) * 0.42) });
        s.text('b1', x + cw / 2, gy - u * 3.2, { size: 4, italic: true, weight: 600, color: s.c('green') });
        x += cw + u * 1.5;
        s.text('→ f →', x + cw * 0.55, gy + 2 * ch, { size: 3.6, font: 'mono', color: s.c('red') });
        x += cw * 1.1;
        for (let i = 0; i < 4; i++) s.cell(x, gy + i * ch, cw, ch, filled(i) ? fmt(h1[i]!, 2) : '', 'gold', { on: rowOn(i), size: Math.min(3.2, (ch / u) * 0.42) });
        s.text('h1', x + cw / 2, gy - u * 3.2, { size: 4, italic: true, weight: 600, color: s.c('gold') });
      });
    }

    // Phase 2: the whole network, one layer per line.
    const nA = s.ease('input', 0.7);
    if (nA > 0) {
      const rect: Rect = [u * 12, h * 0.19, w - u * 24, h * 0.55];
      const vis = (l: number) => (l === 0 ? 1 : lit >= l ? s.ease(['input', 'l1', 'l2', 'l3'][l]!, 0.6, 0.6) : 0);
      s.alpha(nA, () => {
        const g = drawNet(s, rect, FWD_SIZES, {
          W: FWD_W,
          wire: (l) => (lit === l ? 1 : lit > l ? 0.55 : 0.25),
          fill: (l, i) => (l === 0 ? Math.min(1, Math.abs(FWD_VALS[0]![i]!)) * 0.8 : vis(l) * Math.min(1, Math.abs(FWD_VALS[l]![i]!))),
          rMax: 3.8,
        });
        const names = ['x', 'h1', 'h2', 'scores'];
        const ks: Color[] = ['orange', 'gold', 'gold', 'purple'];
        FWD_SIZES.forEach((n, l) => {
          s.text(names[l]!, g.colX(l), rect[1] + rect[3] + u * 5, { size: 3.8, italic: l < 3, font: l === 3 ? 'mono' : 'serif', weight: 600, color: s.c(ks[l]!) });
          s.alpha(vis(l), () => {
            for (let i = 0; i < n; i++) {
              const v = FWD_VALS[l]![i]!;
              const t = fmt(v, 2);
              const tx = g.colX(l);
              const ty = g.ny(l, i) - g.r - u * 2.6;
              const tw = s.measure(t, { size: 3, font: 'mono' }) + u * 1.2;
              s.rrect(tx - tw / 2, ty - u * 2, tw, u * 4, 0.8, { fill: s.tint('--card', 0.9) });
              s.text(t, tx, ty + u * 0.1, { size: 3, font: 'mono', weight: 600 });
            }
          });
        });
        s.alpha(s.win('l3', 'batch') * s.ease('l3', 0.5, 1.4), () => s.text('no f', g.colX(3), g.ny(3, 0) + g.r + u * 4, { size: 3.2, italic: true, color: s.c('purple'), halo: true }));
        const bA = s.win('batch', 'learn');
        s.alpha(bA, () => {
          const cw = Math.min(w * 0.9, u * 100);
          card(s, (w - cw) / 2, h * 0.9 - u * 4.5, cw, u * 9, 0.95);
          fit(s, 'x: (3, N)  →  h1: (4, N)  →  scores: (1, N)', w / 2, h * 0.9, cw * 0.92, { size: 3.8, font: 'mono', weight: 600 });
        });
        s.alpha(s.ease('learn', 0.6), () => {
          const chips: [string, Color][] = [['W1', 'blue'], ['b1', 'green'], ['W2', 'blue'], ['b2', 'green'], ['W3', 'blue'], ['b3', 'green']];
          const cw = Math.min(u * 11, (w - u * 14) / 6.6);
          const gap = cw * 0.12;
          let x = (w - (6 * cw + 5 * gap)) / 2;
          chips.forEach(([t, k], i) => {
            s.alpha(s.ease('learn', 0.4, 0.8 + i * 0.25), () => s.cell(x, h * 0.9 - u * 3, cw, u * 6, t, k, { on: 0.5, size: 3.4 }));
            x += cw + gap;
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- representational power

/** A few random one-hidden-layer sigmoid nets on [0, 1]: one shape, many functions. */
const FAMILY = (() => {
  const r = new Rng(21);
  return Array.from({ length: 6 }, () => Array.from({ length: 5 }, () => [r.uniform(0.05, 0.95), r.uniform(8, 30) * (r.next() < 0.5 ? -1 : 1), r.randn() * 0.28] as const));
})();
const family = (k: number, x: number) => 0.5 + FAMILY[k]!.reduce((a, [t, wv, c]) => a + c * (sig(wv * (x - t)) - 0.5), 0);

const power: SceneDef = {
  marks: {
    uat: { tex: String.raw`g(\symx) = \sum_{i=1}^{n} c_i\, \sigma(\sym{W}{w_i}\,\symx + \sym{b}{b_i})`, x: 0.5, y: 0.42, size: 6 },
    eps: { tex: String.raw`|f(\symx) - g(\symx)| < \varepsilon \;\text{ for every }\symx`, x: 0.5, y: 0.58, size: 4.8 },
  },
  draw(s) {
    const { w, h, u } = s;
    // n grows during 'more'.
    let n = 6;
    if (s.since('more') >= 0) n = Math.round(6 * Math.pow(80 / 6, smooth(s.prog('more') / 0.75)));
    s.slot('n', n);
    s.slot('units', 2 * n);
    s.slot('err', s.since('stack') >= 0 ? fmt(bumpError(n), 3) : '…');

    // The family, then the theorem.
    s.alpha(s.win('family', 'rich'), () => {
      const fr = new Frame(s, area(s, 0.13), [-0.03, 1.03, -0.12, 1.15]);
      fr.grid(0.25, 0.7, false);
      for (let k = 0; k < FAMILY.length; k++) s.alpha(s.ease('family', 0.5, 0.4 + k * 0.5), () => fr.fn((x) => family(k, x), s.tint(CLASS_COLORS[k]!, 0.8), 0.6, 0, 1));
      s.alpha(s.ease('family', 0.5, 2.5), () => fit(s, 'one shape of network, many functions', w / 2, h * 0.92, w * 0.9, { size: 3.8, italic: true, color: s.c('--ink-2') }));
    });
    const tA = s.win('rich', 'target');
    s.show('uat', tA * s.ease('rich', 0.6, 0.4));
    s.show('eps', tA * s.ease('rich', 0.6, 3));
    s.alpha(tA * s.ease('rich', 0.6, 0.4), () => fit(s, 'one hidden layer of n sigmoids', w / 2, h * 0.29, w * 0.9, { size: 3.8, italic: true, color: s.c('--ink-2') }));
    s.alpha(tA * s.ease('rich', 0.6, 6), () => fit(s, 'universal approximation', w / 2, h * 0.74, w * 0.9, { size: 5, font: 'display', weight: 600, color: s.c('purple') }));

    // Building it from bumps.
    const pA = s.ease('target', 0.6) * (1 - 0.82 * s.ease('weak', 0.6)) * (1 - s.ease('deep', 0.5));
    if (pA > 0) {
      const fr = new Frame(s, area(s, 0.13), [-0.03, 1.03, -0.12, 1.15]);
      s.alpha(pA, () => {
        fr.grid(0.25, 0.8);
        fr.fn(target, s.c('--ink'), 0.5, -0.03, 1.03, [1.4, 1]);
        s.text('target f(x)', fr.X(0.02), fr.Y(1.08), { size: 3.4, weight: 600, align: 'left', color: s.c('--ink-2'), halo: true });
        const a = edge(6, 2);
        const b = edge(6, 3);
        const k = steep(6);
        const one = s.win('step', 'stack');
        s.alpha(one, () => {
          const up = (x: number) => sig(k * (x - a));
          const dn = (x: number) => sig(k * (x - b));
          s.alpha(s.ease('step', 0.5), () => fr.fn(up, s.c('blue'), 0.7));
          s.alpha(s.ease('bump', 0.5), () => fr.fn(dn, s.c('red'), 0.6, -0.03, 1.03, [1.2, 1]));
          s.alpha(s.ease('bump', 0.6, 1.4), () => fr.area((x) => up(x) - dn(x), s.tint('gold', 0.35)));
          for (const [v, lab, beat] of [[a, 'a', 'step'], [b, 'b', 'bump']] as const)
            s.alpha(s.ease(beat, 0.5), () => {
              fr.seg(v, -0.04, v, 0.04, s.c('--ink-2'), 0.4);
              s.text(lab, fr.X(v), fr.Y(-0.08), { size: 3.6, italic: true, weight: 600 });
            });
          s.alpha(s.ease('step', 0.5, 1) * (1 - s.ease('bump', 0.4)), () => s.text('a step', fr.X(0.62), fr.Y(0.93), { size: 3.4, italic: true, color: s.c('blue'), halo: true, align: 'left' }));
          s.alpha(s.ease('bump', 0.5, 1.6), () => s.text('a bump', fr.X(0.4), fr.Y(0.5), { size: 3.4, italic: true, weight: 600, color: s.c('gold'), halo: true }));
        });
        const stA = s.ease('stack', 0.6);
        if (stA > 0) {
          const showBumps = clamp01((14 - n) / 6);
          s.alpha(stA * showBumps, () => {
            for (let i = 0; i < n; i++) {
              const lo = edge(n, i);
              const hi = edge(n, i + 1);
              const kk = steep(n);
              const ht = target((lo + hi) / 2);
              s.alpha(s.ease('stack', 0.4, 0.5 + i * 0.35), () => fr.fn((x) => ht * (sig(kk * (x - lo)) - sig(kk * (x - hi))), s.tint(CLASS_COLORS[i % 6]!, 0.6), 0.45));
            }
          });
          s.alpha(s.ease('stack', 0.6, 3.2), () => {
            fr.fn((x) => bumps(n, x), s.c('purple'), 0.9);
            s.text('network g(x)', fr.X(0.38), fr.Y(1.08), { size: 3.4, weight: 600, align: 'left', color: s.c('purple'), halo: true });
            const [bx, by, bw] = fr.box;
            const cw = Math.min(u * 34, bw * 0.4);
            card(s, bx + bw - cw - u * 1.5, by + fr.box[3] - u * 14, cw, u * 12.5);
            s.text(`n = ${n} bumps`, bx + bw - cw + u * 1.5, by + fr.box[3] - u * 10, { size: 3.2, font: 'mono', align: 'left' });
            s.text(`error ${bumpError(n).toFixed(3)}`, bx + bw - cw + u * 1.5, by + fr.box[3] - u * 5, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
          });
        }
      });
    }

    // A weak promise.
    const wA = s.win('weak', 'deep');
    s.alpha(wA, () => {
      const cw = Math.min(w * 0.86, u * 90);
      const ch = u * 34;
      const x = (w - cw) / 2;
      const y = h * 0.3;
      card(s, x, y, cw, ch, 0.96);
      fit(s, 'can represent ≠ will learn', w / 2, y + u * 8, cw * 0.9, { size: 5, font: 'display', weight: 600 });
      ['how many units will it take?', 'will gradient descent find them?'].forEach((t, i) =>
        s.alpha(s.ease('weak', 0.5, 2.2 + i * 2.2), () => {
          s.circle(x + u * 7, y + u * (18 + i * 8), u * 1, { fill: s.c('--accent') });
          fit(s, t, x + u * 11, y + u * (18 + i * 8), cw - u * 15, { size: 3.8, align: 'left', color: s.c('--ink-2') });
        }),
      );
    });

    // Depth: fully connected nets gain little past three layers; ConvNets need depth.
    const dA = s.win('deep', 'hier');
    if (dA > 0) {
      const nets: [number[], string, string][] = [
        [[2, 4, 1], '2 layers', ''],
        [[2, 4, 4, 1], '3 layers', 'often better'],
        [[2, 4, 4, 4, 4, 1], '5 layers', 'rarely more'],
      ];
      const [ax, ay, aw, ah] = area(s, 0.16);
      const stack = s.tall;
      s.alpha(dA, () => {
        fit(s, 'fully connected networks', w / 2, ay + u * 2, aw, { size: 4.4, font: 'display', weight: 600 });
        nets.forEach(([sizes, name, note], i) => {
          const a = s.ease('deep', 0.5, 3.4 + i * 1.4);
          const cwid = stack ? aw * 0.6 : aw / 3.3;
          const chh = stack ? ah * 0.24 : ah * 0.5;
          const x = stack ? ax + u * 2 : ax + i * (aw / 3) + (aw / 3 - cwid) / 2;
          const y = stack ? ay + u * 8 + i * (chh + u * 3) : ay + u * 12;
          s.alpha(a, () => {
            drawNet(s, [x, y, cwid, chh], sizes, { rMax: 1.8 });
            const tx = stack ? x + cwid + u * 4 : x + cwid / 2;
            const ty = stack ? y + chh * 0.4 : y + chh + u * 5;
            s.text(name, tx, ty, { size: 3.8, weight: 600, align: stack ? 'left' : 'center' });
            if (note) s.text(note, tx, ty + u * 5, { size: 3.4, italic: true, color: s.c(i === 1 ? 'green' : '--ink-3'), align: stack ? 'left' : 'center' });
          });
        });
      });
    }

    // Images are hierarchical.
    const hA = s.ease('hier', 0.6);
    if (hA > 0) {
      const [ax, ay, aw, ah] = area(s, 0.2);
      const cy = ay + ah * 0.48;
      const xs = [ax + aw * 0.16, ax + aw * 0.5, ax + aw * 0.84];
      const R = Math.min(aw * 0.12, ah * 0.24);
      const ink = s.c('--ink-2');
      s.alpha(hA, () => {
        fit(s, 'ConvNets: depth is crucial, 10+ layers', w / 2, ay + u * 1, aw, { size: 4.4, font: 'display', weight: 600 });
        const lvl = (i: number) => s.ease('hier', 0.5, 4.5 + i * 1.6);
        // Edges and blobs.
        s.alpha(lvl(2), () => {
          const r = new Rng(5);
          for (let k = 0; k < 9; k++) {
            const x = xs[0]! + (k % 3 - 1) * R * 0.62;
            const y = cy + (Math.floor(k / 3) - 1) * R * 0.62;
            if (k % 4 === 3) s.circle(x, y, R * 0.12, { fill: s.tint('--ink-2', 0.7) });
            else {
              const an = r.uniform(0, Math.PI);
              s.line(x - Math.cos(an) * R * 0.2, y - Math.sin(an) * R * 0.2, x + Math.cos(an) * R * 0.2, y + Math.sin(an) * R * 0.2, ink, 0.5);
            }
          }
          s.text('edges, blobs', xs[0]!, cy + R + u * 5, { size: 3.6, italic: true, color: s.c('--ink-2') });
        });
        // Parts.
        s.alpha(lvl(1), () => {
          const x = xs[1]!;
          for (const dx of [-0.42, 0.42]) {
            s.ctx.beginPath();
            s.ctx.ellipse(x + dx * R, cy - R * 0.35, R * 0.28, R * 0.16, 0, 0, Math.PI * 2);
            s.ctx.strokeStyle = ink;
            s.ctx.lineWidth = u * 0.45;
            s.ctx.stroke();
            s.circle(x + dx * R, cy - R * 0.35, R * 0.07, { fill: ink });
          }
          s.line(x, cy - R * 0.1, x - R * 0.12, cy + R * 0.35, ink, 0.45);
          s.line(x - R * 0.12, cy + R * 0.35, x + R * 0.1, cy + R * 0.38, ink, 0.45);
          s.text('eyes, noses', x, cy + R + u * 5, { size: 3.6, italic: true, color: s.c('--ink-2') });
        });
        // A face.
        s.alpha(lvl(0), () => {
          const x = xs[2]!;
          s.circle(x, cy, R * 0.85, { stroke: ink, lw: 0.5 });
          for (const dx of [-0.3, 0.3]) s.circle(x + dx * R, cy - R * 0.22, R * 0.07, { fill: ink });
          s.line(x, cy - R * 0.05, x - R * 0.08, cy + R * 0.2, ink, 0.4);
          s.ctx.beginPath();
          s.ctx.arc(x, cy + R * 0.2, R * 0.32, 0.35, Math.PI - 0.35);
          s.ctx.strokeStyle = ink;
          s.ctx.lineWidth = u * 0.45;
          s.ctx.stroke();
          s.text('faces', x, cy + R + u * 5, { size: 3.6, italic: true, color: s.c('--ink-2') });
        });
        s.alpha(lvl(1), () => s.arrow(xs[0]! + R * 0.95, cy, xs[1]! - R * 0.95, cy, s.c('--ink-3'), 0.5));
        s.alpha(lvl(0), () => s.arrow(xs[1]! + R * 0.95, cy, xs[2]! - R * 0.95, cy, s.c('--ink-3'), 0.5));
      });
    }
  },
};

// ---------------------------------------------------------------- capacity

const DOM: [number, number, number, number] = [-1.1, 1.1, -1.1, 1.1];

/** A square panel of decision regions with points, and a side column of readouts. */
function regionPanel(s: Scene, d: Dataset2D, nets: [MLP | null, number][], o: { ring?: (i: number) => boolean; circle?: number; test?: number; creases?: MLP | null; creaseA?: number } = {}): { fr: Frame; side: Rect } {
  const { panel, side } = split(s, 0.13);
  const fr = new Frame(s, panel, DOM, true);
  s.rrect(...fr.box, 1.2, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.25 });
  for (const [net, a] of nets) if (net && a > 0.003) s.alpha(a, () => fr.image(regionImage(net, DOM, d.classes)));
  fr.grid(0.5, 0.5, false);
  if (o.creases && (o.creaseA ?? 0) > 0) {
    const L0 = o.creases.layers[0]!;
    s.alpha(o.creaseA!, () =>
      fr.clip(() => {
        for (let j = 0; j < L0.nout; j++) {
          const a = L0.W[2 * j]!;
          const b = L0.W[2 * j + 1]!;
          const c = L0.b[j]!;
          const n2 = a * a + b * b;
          const fx = (-c * a) / n2;
          const fy = (-c * b) / n2;
          const nrm = Math.sqrt(n2);
          fr.seg(fx - (-b / nrm) * 4, fy - (a / nrm) * 4, fx + (-b / nrm) * 4, fy + (a / nrm) * 4, s.tint('gold', 0.85), 0.35, [1.2, 0.9]);
        }
      }),
    );
  }
  if (o.test && o.test > 0) points(fr, DISC_TEST, { r: 0.45, alpha: 0.4 * o.test });
  if (o.circle && o.circle > 0) {
    s.alpha(o.circle, () => {
      const c = s.ctx;
      c.beginPath();
      c.arc(fr.X(0), fr.Y(0), DISC_R * fr.kx, 0, Math.PI * 2);
      c.strokeStyle = s.tint('--ink', 0.55);
      c.lineWidth = s.u * 0.35;
      c.setLineDash([s.u * 1.2, s.u * 1.2]);
      c.stroke();
      c.setLineDash([]);
    });
  }
  points(fr, d, { r: 0.85, ring: o.ring });
  return { fr, side };
}

function sideReadout(s: Scene, side: Rect, rows: [string, number, number, Color | '--ink-2', ('display' | 'mono' | 'serif')?][]): void {
  let y = side[1] + side[3] * 0.18;
  for (const [t, size, a, k, font] of rows) {
    s.alpha(a, () => fit(s, t, side[0], y, side[2], { size, font: font ?? 'mono', weight: font === 'display' ? 600 : 500, align: 'left', color: s.c(k) }));
    y += s.u * size * 1.55;
  }
}

const capacity: SceneDef = {
  draw(s) {
    // Which spiral net is on: 1 -> 2 -> 4 -> 8.
    const sw = (beat: string, at: number) => s.ease(beat, 0.6, (s.end(beat) - s.at(beat)) * at);
    const capA = s.ease('cap', 0.8, 1.6);
    const to2 = sw('one', 0.55);
    const to4 = s.ease('four', 0.6);
    const to8 = sw('four', 0.5);
    const disc = s.ease('cuts', 0.6);
    const H = to8 > 0.5 ? 8 : to4 > 0.5 ? 4 : to2 > 0.5 ? 2 : 1;
    if (disc < 1) {
      s.alpha(1 - disc, () => {
        const nets: [MLP | null, number][] = [
          [SPIRAL_NETS[1]!.get(), capA * (1 - to2)],
          [SPIRAL_NETS[2]!.get(), to2 * (1 - to4)],
          [SPIRAL_NETS[4]!.get(), to4 * (1 - to8)],
          [SPIRAL_NETS[8]!.get(), to8],
        ];
        const { side } = regionPanel(s, SPIRAL, nets, { creases: SPIRAL_NETS[8]!.get(), creaseA: s.win('crease', 'cuts') });
        const net = SPIRAL_NETS[H]!.get();
        sideReadout(s, side, [
          ['hidden', 3.6, s.ease('q', 0.5), '--ink-2', 'serif'],
          [`H = ${capA > 0 ? H : '?'}`, 7, s.ease('q', 0.5), 'gold', 'display'],
          ['train acc', 3.4, capA, '--ink-2', 'serif'],
          [pct(accuracy(net, SPIRAL)), 6, capA, 'purple'],
        ]);
        s.alpha(s.win('crease', 'cuts'), () => fit(s, 'creases: where a', side[0], side[1] + side[3] * 0.8, side[2], { size: 3.4, italic: true, color: s.c('gold'), align: 'left' }));
        s.alpha(s.win('crease', 'cuts'), () => fit(s, 'unit switches on', side[0], side[1] + side[3] * 0.8 + s.u * 5, side[2], { size: 3.4, italic: true, color: s.c('gold'), align: 'left' }));
      });
    }
    if (disc > 0) {
      const big = s.ease('islands', 0.8, 0.6);
      const small = s.ease('small', 0.8, 0.6);
      const nets: [MLP | null, number][] = [
        [DISC_NETS['50/0.0001']!.get(), big * (1 - small)],
        [DISC_NETS['3/0.0001']!.get(), small],
      ];
      s.alpha(disc, () => {
        const { side } = regionPanel(s, DISC, nets, { ring: (i) => s.ease('cuts', 0.5, 2.5) > 0.5 && DISC.flipped[i] === 1, circle: s.ease('cuts', 0.6, 1), test: s.win('overfit', 'small') });
        const cur = small > 0.5 ? DISC_NETS['3/0.0001']!.get() : DISC_NETS['50/0.0001']!.get();
        const on = big > 0.5;
        sideReadout(s, side, [
          ['hidden', 3.6, 1, '--ink-2', 'serif'],
          [`H = ${on ? (small > 0.5 ? 3 : 50) : '?'}`, 7, 1, 'gold', 'display'],
          ['train acc', 3.4, big, '--ink-2', 'serif'],
          [pct(accuracy(cur, DISC)), 5.4, big, 'purple'],
          ['held-out acc', 3.4, s.ease('overfit', 0.5), '--ink-2', 'serif'],
          [pct(accuracy(cur, DISC_TEST)), 5.4, s.ease('overfit', 0.5), 'red'],
        ]);
        s.alpha(s.win('cuts', 'islands') * s.ease('cuts', 0.5, 2.5), () => fit(s, 'ringed: flipped', side[0], side[1] + side[3] * 0.62, side[2], { size: 3.4, italic: true, color: s.c('--ink-2'), align: 'left' }));
      });
      const smallA = small > 0.5;
      s.slot('H', smallA ? 3 : 50);
      s.slot('C', 2);
      s.slot('steps', 4000);
      s.slot('reg', '1e-4');
      s.slot('tr', big > 0.5 ? pct(accuracy(smallA ? DISC_NETS['3/0.0001']!.get() : DISC_NETS['50/0.0001']!.get(), DISC)) : '…');
      s.slot('te', s.since('overfit') >= 0 ? pct(accuracy(smallA ? DISC_NETS['3/0.0001']!.get() : DISC_NETS['50/0.0001']!.get(), DISC_TEST)) : '–');
    } else {
      s.slot('H', H);
      s.slot('C', 3);
      s.slot('steps', 1500);
      s.slot('reg', '1e-3');
      s.slot('tr', capA > 0.5 ? pct(accuracy(SPIRAL_NETS[H]!.get(), SPIRAL)) : '…');
      s.slot('te', '–');
    }
  },
};

// ---------------------------------------------------------------- big networks, held in check

const bigNets: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const pA = s.win('wrong', 'second');
    if (pA > 0) {
      const mid = s.ease('same', 0.9, 0.6);
      const hiReg = s.ease('acc', 0.9, (s.end('acc') - s.at('acc')) * 0.62);
      const nets: [MLP | null, number][] = [
        [DISC_NETS['50/0.0001']!.get(), 1 - mid],
        [DISC_NETS['50/0.01']!.get(), mid * (1 - hiReg)],
        [DISC_NETS['50/0.3']!.get(), hiReg],
      ];
      const key = hiReg > 0.5 ? '50/0.3' : mid > 0.5 ? '50/0.01' : '50/0.0001';
      const net = DISC_NETS[key]!.get();
      const lam = key.split('/')[1]!;
      s.slot('reg', lam);
      s.slot('tr', pct(accuracy(net, DISC)));
      s.slot('te', pct(accuracy(net, DISC_TEST)));
      s.alpha(pA, () => {
        const { side } = regionPanel(s, DISC, nets, { circle: 1 });
        const toolsA = s.win('tools', 'same');
        const ra = s.ease('same', 0.6, 0.3);
        sideReadout(s, side, [
          ['λ', 3.6, ra, '--ink-2', 'serif'],
          [lam, 5.6, ra, 'slate'],
          ['train acc', 3.4, ra, '--ink-2', 'serif'],
          [pct(accuracy(net, DISC)), 5.4, ra, 'purple'],
          ['held-out acc', 3.4, ra, '--ink-2', 'serif'],
          [pct(accuracy(net, DISC_TEST)), 5.4, ra, 'red'],
        ]);
        s.alpha(toolsA, () => {
          ['L2 regularization', 'dropout', 'input noise'].forEach((t, i) =>
            s.alpha(s.ease('tools', 0.5, 2.6 + i * 0.9), () => {
              const y = side[1] + side[3] * 0.25 + i * u * 9;
              check(s, side[0] + u * 2, y, u * 2, 'green');
              fit(s, t, side[0] + u * 5.5, y, side[2] - u * 5.5, { size: 3.8, align: 'left', weight: 600 });
            }),
          );
          fit(s, 'Chapter 8', side[0], side[1] + side[3] * 0.25 + u * 30, side[2], { size: 3.4, italic: true, align: 'left', color: s.c('--ink-3') });
        });
        s.alpha(s.win('acc', 'second') * hiReg, () => fit(s, 'underfit', side[0], side[1] + side[3] * 0.9, side[2], { size: 4.2, italic: true, weight: 600, align: 'left', color: s.c('red') }));
      });
      // "Small networks are the safe choice": struck out.
      s.alpha(s.win('wrong', 'tools'), () => {
        const cw = Math.min(w * 0.84, u * 80);
        const x = (w - cw) / 2;
        const y = h * 0.42;
        card(s, x, y, cw, u * 16, 0.97);
        fit(s, 'small networks are the safe choice', w / 2, y + u * 8, cw * 0.86, { size: 4.2, font: 'display', weight: 560, color: s.c('--ink-2') });
        const sw2 = s.ease('wrong', 0.6, 0.8);
        s.line(x + u * 4, y + u * 8, lerp(x + u * 4, x + cw - u * 4, sw2), y + u * 8, s.c('red'), 0.7);
      });
    }

    // Ten restarts per size.
    const lA = s.win('second', 'minima');
    if (lA > 0) {
      const [ax, ay, aw, ah] = area(s, 0.15);
      const fr = new Frame(s, [ax + u * 12, ay + u * 6, aw - u * 14, ah - u * 14], [0.2, 0.8, -0.6, 3.6]);
      s.alpha(lA, () => {
        fit(s, 'small networks are a lottery', w / 2, ay + u * 1, aw, { size: 4.6, font: 'display', weight: 600 });
        RESTARTS.forEach(([H, losses], r) => {
          const y = 3 - r;
          const hl = r === 0 ? s.win('spread', 'minima') * (1 - s.ease('spread', 0.5, 4.5)) : r === 3 ? s.ease('spread', 0.5, 4.5) : 0;
          fr.seg(0.2, y, 0.8, y, s.c('--grid'), 0.3);
          s.text(`H = ${H}`, fr.X(0.2) - u * 2, fr.Y(y), { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c(hl > 0.5 ? '--ink' : '--ink-2') });
          losses.forEach((l, i) => {
            const a = s.ease('lottery', 0.3, 1.2 + r * 1.1 + i * 0.09);
            s.alpha(a, () => fr.dot(l, y + ((i % 3) - 1) * 0.12, 1.1 + 0.3 * hl, s.tint(CLASS_COLORS[r]!, 0.8)));
          });
        });
        for (const v of [0.2, 0.4, 0.6, 0.8]) s.text(v.toFixed(1), fr.X(v), fr.Y(-0.45), { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('final training loss →', fr.X(0.8), fr.Y(-0.15) + u * 0.4, { size: 3.2, italic: true, align: 'right', color: s.c('--ink-3') });
      });
    }

    // A cartoon of the two loss landscapes.
    const mA = s.win('minima', 'rule');
    if (mA > 0) {
      const [ax, ay, aw, ah] = area(s, 0.15);
      const gauss = (x: number, c: number, sd: number) => Math.exp(-((x - c) ** 2) / (2 * sd * sd));
      const smallF = (x: number) => 0.9 - 0.32 * gauss(x, 0.17, 0.07) - 0.7 * gauss(x, 0.5, 0.08) - 0.44 * gauss(x, 0.84, 0.07);
      const bigF = (x: number) => 0.34 + 0.06 * Math.sin(2 * Math.PI * 7 * x) + 0.025 * Math.sin(2 * Math.PI * 17 * x + 1);
      const minima = (f: (x: number) => number) => {
        const out: number[] = [];
        for (let i = 1; i < 399; i++) {
          const x = i / 399;
          if (f(x) < f(x - 1 / 399) && f(x) <= f(x + 1 / 399)) out.push(x);
        }
        return out;
      };
      s.alpha(mA, () => {
        const panels: [string, (x: number) => number, Color, string][] = [
          ['small network: fewer minima, many bad', smallF, 'red', 'minima'],
          ['big network: many minima, all about as good', bigF, 'green', 'minima'],
        ];
        panels.forEach(([lab, f, k], i) => {
          const a = s.ease('minima', 0.5, i === 0 ? 0.2 : 3.6);
          const rh = ah / 2 - u * 3;
          const fr = new Frame(s, [ax + u * 2, ay + i * (rh + u * 6) + u * 6, aw - u * 4, rh - u * 4], [0, 1, 0, 1.1]);
          s.alpha(a, () => {
            fit(s, lab, ax + u * 2, ay + i * (rh + u * 6) + u * 2, aw, { size: 3.6, italic: true, weight: 600, align: 'left', color: s.c(k) });
            fr.fn(f, s.c('--ink-2'), 0.6, 0, 1);
            for (const m of minima(f)) fr.dot(m, f(m) + 0.06, 1.1, s.c(f(m) > 0.4 ? 'red' : 'green'));
          });
        });
        s.alpha(s.ease('minima', 0.5, 6.5), () => fit(s, '(a cartoon)', ax + aw, ay + u * 2, aw * 0.3, { size: 3, italic: true, align: 'right', color: s.c('--ink-3') }));
      });
    }

    // The rule.
    const rA = s.ease('rule', 0.6);
    if (rA > 0) {
      const cw = Math.min(w * 0.88, u * 100);
      const x = (w - cw) / 2;
      const y = h * 0.24;
      const chh = Math.min(h * 0.6, u * 50);
      s.alpha(rA, () => {
        s.rrect(x, y, cw, chh, 2.4, { fill: s.tint('green', 0.08), stroke: s.tint('green', 0.6), lw: 0.4 });
        fit(s, 'the practical rule', w / 2, y + u * 8, cw * 0.9, { size: 4, italic: true, color: s.c('green') });
        const lines: [string, number][] = [
          ['as big a network', 5.4],
          ['as your budget allows,', 5.4],
          ['kept in check by regularization', 4.2],
          ['tuned on validation data', 4.2],
        ];
        let yy = y + u * 18;
        lines.forEach(([t, size], i) => {
          s.alpha(s.ease('rule', 0.5, [0.6, 1.4, 4.2, 6.4][i]!), () => fit(s, t, w / 2, yy, cw * 0.88, { size, font: i < 2 ? 'display' : 'serif', weight: i < 2 ? 600 : 450, color: i < 2 ? undefined : s.c('--ink-2') }));
          yy += u * size * 1.7;
        });
      });
    }
  },
};

// ---------------------------------------------------------------- outro

const TILES: [string, string, Color, string][] = [
  ['layers', 'multiply, bias, bend', 'blue', 'stack'],
  ['the bend', 'or it all collapses', 'red', 'stack'],
  ['the neuron', 'a loose cartoon', 'gold', 'neuron'],
  ['one neuron', 'a linear classifier', 'orange', 'neuron'],
  ['activations', 'ReLU by default', 'red', 'relu'],
  ['counting', 'skip the input layer', 'slate', 'count'],
  ['power', 'one layer: anything', 'purple', 'power'],
  ['capacity', 'big, regularized', 'green', 'power'],
];

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const nA = s.ease('next', 0.7, 0.4);
    const [ax, ay, aw, ah] = area(s, 0.13);
    const cols = aw > ah * 1.5 ? 4 : 3;
    const rows = Math.ceil(TILES.length / cols);
    const gap = u * 2;
    const tw = (aw - gap * (cols - 1)) / cols;
    const th = Math.min((ah - gap * (rows - 1)) / rows, tw * 0.62);
    const oy = ay + (ah - (th * rows + gap * (rows - 1))) / 2;
    s.alpha(1 - 0.94 * nA, () =>
      TILES.forEach(([name, sub, k, beat], i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, TILES.length - row * cols);
        const x = ax + (aw - (inRow * tw + (inRow - 1) * gap)) / 2 + col * (tw + gap);
        const y = oy + row * (th + gap);
        const order = TILES.filter((t) => t[3] === beat).indexOf(TILES[i]!);
        const on = s.ease(beat, 0.5, order * 1.6);
        s.rrect(x, y, tw, th, 2.2, { fill: s.tint(k, 0.07 + 0.15 * on), stroke: s.tint(k, 0.35 + 0.6 * on), lw: 0.3 + 0.3 * on });
        const fs = Math.min(5, (tw / u) * 0.13);
        fit(s, name, x + tw / 2, y + th * 0.4, tw * 0.86, { size: fs, font: 'display', weight: 600 });
        fit(s, sub, x + tw / 2, y + th * 0.68, tw * 0.86, { size: fs * 0.7, italic: true, color: s.c(k) });
        s.alpha(on, () => check(s, x + tw - u * 3, y + u * 3, u * 1.7, 'green'));
      }),
    );
    s.alpha(nA, () => {
      fit(s, 'next: the interactive chapter', w / 2, h * 0.42, w * 0.9, { size: 6.2, font: 'display', weight: 600 });
      fit(s, 'train the networks, try each activation, grow a hidden layer', w / 2, h * 0.55, w * 0.9, { size: 3.8, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('bye', 0.6), () => s.text('see you there', w / 2, h * 0.7, { size: 4.6, font: 'display', italic: true, color: s.c('--accent') }));
    });
  },
};

export const scenes3: Record<string, SceneDef> = { layers, forward, power, capacity, 'big-nets': bigNets, outro };

