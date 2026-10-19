import { CIFAR_CLASSES } from '../../core/data';
import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, lerp, smooth } from '../../lecture/scene';
import { blit, chwCanvas, cifar, classMeans, concentration, edits, photo } from './data';
import { Frame, area, lock, pill } from './kit';
import { checkMark, late } from './scenes-a';
import { TSNE } from './tsne';

// ---------------------------------------------------------------- validation

const KS_VAL = [1, 3, 5, 10, 20, 50, 100];

/** A horizontal data bar of [fraction, color, alpha] segments. Returns each segment's left edge. */
function dataBar(s: Scene, x: number, y: number, bw: number, bh: number, segs: [number, Color | `--${string}`, number][]): number[] {
  let at = x;
  const xs: number[] = [];
  segs.forEach(([f, k, a]) => {
    const sw = bw * f;
    xs.push(at);
    s.alpha(a, () => s.rrect(at + 1, y, Math.max(1.5, sw - 2), bh, 0.8, { fill: s.tint(k, 0.28), stroke: s.c(k), lw: 0.4 }));
    at += sw;
  });
  return xs;
}

const validation: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const m = Math.max(u * 5, w * 0.06);
    // Hyperparameters: settings of the algorithm, chosen by trying.
    const cy = lerp(h * 0.42, h * 0.2, s.ease('onwhat', 0.8));
    const chipsA = s.ease('hyper', 0.6, 0.3);
    const tick = Math.floor(s.t * 1.1);
    const kSel = s.since('onwhat') >= 0 ? -1 : tick % KS_VAL.length;
    const kx: number[] = [];
    s.alpha(chipsA, () => {
      s.alpha(1 - s.ease('onwhat', 0.6), () => s.text('hyperparameters', w / 2, h * 0.24, { size: tall ? 5 : 5.6, font: 'display', weight: 600 }));
      const fs = tall ? 3.3 : 3.8;
      const chipGap = u * (tall ? 1.4 : 2);
      const rowW = u * 6 + KS_VAL.reduce((a, kv) => a + s.measure(String(kv), { size: fs, font: 'mono' }) + u * fs * 0.9 + chipGap, -chipGap);
      const left = tall ? m : (w - rowW) / 2;
      s.text('k', left, cy, { size: 4.2, italic: true, weight: 650, color: s.c('slate'), align: 'left' });
      let x = left + u * 6;
      KS_VAL.forEach((kv, i) => {
        const done = s.since('loop') >= 0 ? late(s, 'loop', 0.1 + i * 0.1, 0.3) : 0;
        const wdt = pill(s, String(kv), x, cy, 'slate', { size: fs, align: 'left', on: i === kSel ? 1 : 0 });
        kx.push(x + wdt / 2);
        if (done > 0) s.alpha(done, () => checkMark(s, x + wdt - u * 0.6, cy - u * 3.4, u * 1.5));
        x += wdt + chipGap;
      });
      s.alpha(s.ease('more', 0.5, 0.2), () => {
        const dy = cy + u * 9;
        s.text('distance', left, dy, { size: 3.6, align: 'left', color: s.c('--ink-2') });
        const dSel = s.since('onwhat') >= 0 ? -1 : Math.floor(s.t * 0.55) % 2;
        let xx = left + u * 18;
        ['L1', 'L2'].forEach((t, i) => {
          xx += pill(s, t, xx, dy, 'slate', { size: fs, align: 'left', on: i === dSel ? 1 : 0 }) + u * 2;
        });
      });
    });
    // The data: training, and a test set that must stay sealed.
    const bA = s.ease('onwhat', 0.6, 0.4);
    if (bA > 0) {
      const by = h * 0.58;
      const bh = h * 0.12;
      const bw = w - 2 * m;
      const split = s.ease('carve', 1.0, 0.6);
      const trainF = 50 / 60;
      const segs: [number, Color | `--${string}`, number][] = [
        [trainF * (1 - split * 0.02), 'teal', 1],
        [trainF * split * 0.02, 'purple', split],
        [10 / 60, 'red', 1],
      ];
      s.alpha(bA, () => {
        const xs = dataBar(s, m, by, bw, bh, segs);
        const fs = tall ? 3.2 : 3.6;
        s.text(split > 0.5 ? 'train: 49,000' : 'training: 50,000', m + u * 2, by + bh / 2, { size: fs, align: 'left', color: s.c('teal'), weight: 600 });
        const tx = xs[2]! + (bw * 10) / 60 / 2;
        s.text('test', tx, by + bh / 2 - u * 2.4, { size: fs, color: s.c('red'), weight: 600 });
        s.text('10,000', tx, by + bh / 2 + u * 2.6, { size: fs * 0.9, font: 'mono', color: s.c('red') });
        // Peeking at the test set while tuning.
        const tA = s.win('tuned', 'exam');
        if (tA > 0) {
          s.alpha(tA, () => {
            [0, 2, 4, 6].forEach((i, n) => {
              const p = smooth(((s.since('tuned') - n * 0.7) % 3) / 1.2);
              if (!kx[i]) return;
              s.alpha(Math.sin(p * Math.PI), () => s.arrow(kx[i]!, cy + u * 4, tx, by - u * 1.5, s.c('red'), 0.4, 2));
            });
            s.text('tuned to these test images', w / 2, by + bh + u * 7, { size: 3.6, color: s.c('red'), weight: 600 });
            s.alpha(late(s, 'tuned', 0.5), () => s.text('so the score is too optimistic', w / 2, by + bh + u * 13, { size: 3.4, italic: true, color: s.c('red') }));
          });
        }
        // Sealed: opened once, at the very end.
        const lA = s.ease('exam', 0.5, 0.4);
        s.alpha(lA, () => {
          lock(s, tx, by - u * 5.5, u * 4.4, s.c('red'));
          s.alpha(1 - s.ease('carve', 0.5), () => s.text('sealed: open once, at the end', w / 2, by + bh + u * 7, { size: 3.6, color: s.c('--ink-2'), italic: true }));
        });
        // The validation set: a practice test carved from training data.
        s.alpha(split, () => {
          const vx = xs[1]! + (bw * trainF * 0.02) / 2;
          s.line(vx, by + bh + u * 1, vx, by + bh + u * 5, s.c('purple'), 0.4);
          s.text('validation: 1,000', vx, by + bh + u * 8.5, { size: tall ? 3.3 : 3.6, color: s.c('purple'), weight: 600, align: 'right' });
          const lp = s.ease('loop', 0.6, 0.3);
          s.alpha(lp, () => {
            KS_VAL.forEach((_, i) => {
              const a = late(s, 'loop', 0.1 + i * 0.1, 0.3);
              s.alpha(a * 0.8, () => s.line(kx[i] ?? vx, cy + u * 4, vx, by - u * 1.5, s.tint('purple', 0.6), 0.3));
            });
            s.alpha(late(s, 'loop', 0.85), () => pill(s, 'best_k: highest validation score', w / 2, cy + u * (tall ? 19 : 21), 'slate', { size: tall ? 3.2 : 3.6, font: 'serif', on: 1, solid: true }));
          });
          s.alpha(s.ease('practice', 0.6), () => s.text('a practice test: look as often as you like', vx, by + bh + u * 14.5, { size: 3.3, italic: true, color: s.c('purple'), align: 'right' }));
        });
      });
    }
  },
};

// ---------------------------------------------------------------- crossval

const KS = [1, 3, 5, 8, 10, 12, 15, 20, 50, 100];
/** 5-fold validation accuracy (L1) on the 1,000-image sample, folds as in the chapter's figure. */
const FOLDS = [
  [0.295, 0.245, 0.27, 0.285, 0.27, 0.26, 0.26, 0.28, 0.27, 0.255],
  [0.26, 0.255, 0.29, 0.265, 0.29, 0.275, 0.255, 0.25, 0.23, 0.22],
  [0.265, 0.3, 0.28, 0.27, 0.27, 0.29, 0.27, 0.29, 0.27, 0.24],
  [0.225, 0.26, 0.22, 0.225, 0.2, 0.195, 0.205, 0.235, 0.225, 0.265],
  [0.245, 0.26, 0.28, 0.27, 0.275, 0.265, 0.26, 0.285, 0.29, 0.285],
];
const BEST = 2;
/** k = 5 with L1 on all 200 test images. */
const TEST_ACC = 0.31;

const crossval: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const m = Math.max(u * 5, w * 0.06);
    const bw = w - 2 * m;
    const chart = s.ease('run', 0.8);
    s.slot('best', s.since('best') >= 0 ? KS[BEST]! : '…');
    s.slot('test', s.since('test') >= 0 ? `${(TEST_ACC * 100).toFixed(1)}%` : '…');
    const by = lerp(h * 0.4, h * 0.15, chart);
    const bh = lerp(h * 0.13, h * 0.07, chart);
    const foldA = s.ease('folds', 0.8, 0.3);
    // Which fold is held out right now.
    let round = 4;
    if (s.since('rotate') >= 0 && s.since('avg') < 0) round = Math.min(4, Math.floor(s.prog('rotate') * 5.4));
    const rotating = s.since('rotate') >= 0 && s.since('avg') < 0;
    const fs = tall ? 3.2 : 3.6;
    s.alpha(1 - 0.75 * s.ease('practice', 0.6), () => {
      s.alpha(foldA, () => {
        for (let f = 0; f < 5; f++) {
          const x = m + (f * bw) / 5;
          const k: Color = rotating && f === round ? 'purple' : 'teal';
          s.rrect(x + 2, by, bw / 5 - 4, bh, 0.8, { fill: s.tint(k, 0.28), stroke: s.c(k), lw: 0.4 });
          s.text(`fold ${f + 1}`, x + bw / 10, by + bh / 2, { size: fs, color: s.c(k), weight: 600 });
        }
      });
      s.alpha(1 - foldA, () => {
        s.rrect(m + 1, by, bw * 0.8 - 2, bh, 0.8, { fill: s.tint('teal', 0.28), stroke: s.c('teal'), lw: 0.4 });
        s.rrect(m + bw * 0.8 + 1, by, bw * 0.2 - 2, bh, 0.8, { fill: s.tint('purple', 0.28), stroke: s.c('purple'), lw: 0.4 });
        s.text('train: 800', m + bw * 0.4, by + bh / 2, { size: fs, color: s.c('teal'), weight: 600 });
        s.text('val: 200', m + bw * 0.9, by + bh / 2, { size: fs, color: s.c('purple'), weight: 600 });
      });
      // One split is a noisy judge.
      s.alpha(s.win('noisy', 'folds'), () => {
        s.text('our 1,000 training images, k = 5', w / 2, by - u * 5, { size: 3.4, color: s.c('--ink-2') });
        s.alpha(late(s, 'noisy', 0.4), () => s.text('one split says 22%, another says 29%', w / 2, by + bh + u * 8, { size: tall ? 3.8 : 4.2, weight: 600, color: s.c('purple') }));
      });
      // Rotate, score each round, average.
      s.alpha(s.ease('rotate', 0.5) * (1 - chart), () => {
        for (let f = 0; f < 5; f++) {
          const shown = s.since('avg') >= 0 || (rotating && f <= round);
          if (!shown) continue;
          s.text(`${Math.round(FOLDS[f]![BEST]! * 100)}%`, m + (f + 0.5) * (bw / 5), by + bh + u * 6, { size: 3.8, font: 'mono', weight: 600, color: s.c('purple') });
        }
        if (rotating) s.text(`round ${round + 1}: validate on fold ${round + 1}, train on the rest`, w / 2, by - u * 5, { size: 3.3, color: s.c('--ink-2') });
        s.alpha(s.ease('avg', 0.5, 0.8), () => {
          const mean = FOLDS.reduce((a, f) => a + f[BEST]!, 0) / 5;
          s.text(`mean: ${(mean * 100).toFixed(1)}%`, w / 2, by + bh + u * 15, { size: tall ? 4.6 : 5, font: 'mono', weight: 650 });
        });
      });
    });
    // The whole experiment: every k, every fold.
    if (chart > 0) {
      const top = h * 0.3;
      const bot = h * 0.86;
      const lo = 0.18;
      const hi = 0.34;
      const x0 = m + u * 9;
      const x1 = w - m;
      const X = (t: number) => x0 + ((t + 0.5) / KS.length) * (x1 - x0);
      const Y = (v: number) => bot - ((v - lo) / (hi - lo)) * (bot - top);
      const means = KS.map((_, t) => FOLDS.reduce((a, f) => a + f[t]!, 0) / 5);
      const sds = KS.map((_, t) => Math.sqrt(FOLDS.reduce((a, f) => a + (f[t]! - means[t]!) ** 2, 0) / 5));
      s.alpha(chart * (1 - 0.75 * s.ease('practice', 0.6)), () => {
        [0.2, 0.25, 0.3].forEach((v) => {
          s.line(x0, Y(v), x1, Y(v), s.c('--grid'), 0.25);
          s.text(`${Math.round(v * 100)}%`, x0 - u * 1.5, Y(v), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
        });
        KS.forEach((kv, t) => s.text(String(kv), X(t), bot + u * 4, { size: 3, font: 'mono', color: s.c('--ink-3') }));
        s.text('k', x1, bot + u * 9, { size: 3.6, italic: true, weight: 650, align: 'right', color: s.c('slate') });
        const bestA = s.ease('best', 0.5);
        s.alpha(bestA, () => {
          const cw = (x1 - x0) / KS.length;
          s.rrect(X(BEST) - cw / 2, top - u * 2, cw, bot - top + u * 2, 0.6, { fill: s.tint('slate', 0.14) });
          s.text('best: k = 5', X(BEST) + cw / 2 + u, top + u * 1, { size: 3.4, align: 'left', weight: 650, color: s.c('slate'), halo: true });
        });
        const dotsA = s.ease('run', 0.6, 1.0);
        FOLDS.forEach((f, fi) =>
          s.alpha(dotsA * s.ease('run', 0.4, 1.0 + fi * 0.35), () => f.forEach((v, t) => s.circle(X(t) + (fi - 2) * u * 0.5, Y(v), u * 0.85, { fill: s.tint('--ink-3', 0.55) }))),
        );
        const lineA = late(s, 'run', 0.55, 0.8);
        s.alpha(lineA, () => {
          KS.forEach((_, t) => {
            s.line(X(t), Y(means[t]! - sds[t]!), X(t), Y(means[t]! + sds[t]!), s.c('blue'), 0.35);
            s.line(X(t) - u, Y(means[t]! - sds[t]!), X(t) + u, Y(means[t]! - sds[t]!), s.c('blue'), 0.35);
            s.line(X(t) - u, Y(means[t]! + sds[t]!), X(t) + u, Y(means[t]! + sds[t]!), s.c('blue'), 0.35);
          });
          const c = s.ctx;
          c.beginPath();
          KS.forEach((_, t) => (t ? c.lineTo(X(t), Y(means[t]!)) : c.moveTo(X(t), Y(means[t]!))));
          c.strokeStyle = s.c('blue');
          c.lineWidth = u * 0.55;
          c.stroke();
          KS.forEach((_, t) => s.circle(X(t), Y(means[t]!), u * (t === BEST && bestA > 0.5 ? 1.5 : 1.05), { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.3 }));
        });
        s.alpha(s.ease('test', 0.5, 1.2), () => {
          s.circle(X(BEST), Y(TEST_ACC), u * 1.8, { fill: s.c('gold'), stroke: s.c('--card'), lw: 0.4 });
          s.text('test, once: 31%', X(BEST) + u * 3.5, Y(TEST_ACC) - u * 2.8, { size: 3.6, weight: 650, align: 'left', halo: true });
        });
        s.alpha(s.ease('run', 0.5, 0.4) * (1 - s.ease('best', 0.4)), () => s.text('validation accuracy, 5 folds, L1', x0, top - u * 3, { size: 3.2, align: 'left', color: s.c('--ink-3') }));
      });
    }
    // In practice: one split.
    const pA = s.ease('practice', 0.6, 0.6);
    s.alpha(pA, () => {
      const y = h * 0.52;
      const bh2 = h * 0.12;
      s.rrect(m - u * 2, y - u * 10, bw + u * 4, bh2 + u * 14, 2, { fill: s.tint('--card', 0.94), stroke: s.c('--rule') });
      s.text('big data, slow models: one split', w / 2, y - u * 4.5, { size: tall ? 3.8 : 4.2, font: 'display', weight: 600 });
      const f = 0.7;
      s.rrect(m, y, bw * f - 2, bh2, 0.8, { fill: s.tint('teal', 0.28), stroke: s.c('teal'), lw: 0.4 });
      s.rrect(m + bw * f + 2, y, bw * (1 - f) - 2, bh2, 0.8, { fill: s.tint('purple', 0.28), stroke: s.c('purple'), lw: 0.4 });
      s.text('train: 50 to 90%', m + (bw * f) / 2, y + bh2 / 2, { size: 3.4, color: s.c('teal'), weight: 600 });
      s.text('validation', m + bw * f + (bw * (1 - f)) / 2, y + bh2 / 2, { size: 3.4, color: s.c('purple'), weight: 600 });
    });
  },
};

// ---------------------------------------------------------------- limits

const DOG = 990;

const limits: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const d = cifar(s);
    // The trade: instant training, slow prediction.
    const tA = s.win('pros', 'deeper');
    if (tA > 0) {
      const m = Math.max(u * 4, w * 0.05);
      const c0 = m;
      const c1 = m + (w - 2 * m) * (tall ? 0.26 : 0.28);
      const c2 = m + (w - 2 * m) * (tall ? 0.63 : 0.64);
      const y0 = h * 0.22;
      const rh = h * 0.13;
      const fs = tall ? 3.2 : 3.8;
      const rows: [string, string, string, string][] = [
        ['training', 'none: just store', 'may be slow (once)', 'pros'],
        ['predicting', 'compare with all N', 'fast', 'pros'],
        ['memory', 'all the data', 'a compact model', 'backwards'],
      ];
      s.alpha(tA, () => {
        s.text('k-nearest neighbors', c1, y0, { size: fs, align: 'left', weight: 650, color: s.c('slate') });
        s.alpha(s.ease('backwards', 0.5), () => s.text('what we want', c2, y0, { size: fs, align: 'left', weight: 650, color: s.c('green') }));
        rows.forEach(([name, a, b, beat], i) => {
          const y = y0 + (i + 1) * rh;
          const appear = beat === 'pros' ? late(s, 'pros', i === 0 ? 0.25 : 0.62, 0.4) : late(s, 'backwards', 0.75, 0.4);
          s.alpha(appear, () => {
            s.line(c0, y - rh / 2, w - m, y - rh / 2, s.c('--rule'), 0.25);
            s.text(name, c0, y, { size: fs, align: 'left', color: s.c('--ink-2') });
            s.text(a, c1, y, { size: fs, align: 'left', color: s.c(i === 1 ? 'red' : '--ink') });
          });
          s.alpha(s.ease('backwards', 0.5, 0.4 + i * 0.5), () => s.text(b, c2, y, { size: fs, align: 'left', color: s.c('--ink') }));
        });
        s.alpha(s.ease('ann', 0.5, 0.3), () => pill(s, tall ? 'approximate NN (FLANN): faster' : 'approximate nearest neighbor (FLANN): faster search', w / 2, y0 + 4.4 * rh, 'teal', { size: tall ? 3.2 : 3.6, font: 'serif' }));
      });
    }
    // A dog, three harmless edits, and the nearest frog.
    const eA = s.ease('deeper', 0.6);
    if (eA > 0) {
      const gap = u * (tall ? 2 : 3);
      const m = Math.max(u * 4, w * 0.04);
      const T = Math.min((w - 2 * m - 4 * gap) / 5, h * 0.24);
      const x0 = (w - (5 * T + 4 * gap)) / 2;
      const y0 = lerp(h * 0.42 - T / 2, h * (tall ? 0.14 : 0.13), s.ease('bars', 0.8));
      const ed = d ? edits(d, DOG) : null;
      const names = ['the dog', 'shifted 4 px', '60% light', 'boxed', ed && d ? `a ${CIFAR_CLASSES[d.train.labels[ed.other]!]}` : 'other'];
      const beats: [string, number][] = [
        ['deeper', 0.2],
        ['edits', 0.3],
        ['edits', 0.52],
        ['edits', 0.74],
        ['frog', 0.3],
      ];
      if (ed && d) {
        s.slot('o', ed.other);
        s.slot('oc', CIFAR_CLASSES[d.train.labels[ed.other]!]!);
        const show = s.since('bars') >= 0;
        s.slot('ds', show ? Math.round(ed.ds[0]!) : '…');
        s.slot('dd', show ? Math.round(ed.ds[1]!) : '…');
        s.slot('db', show ? Math.round(ed.ds[2]!) : '…');
        s.slot('dot', show ? Math.round(ed.ds[3]!) : '…');
      }
      const mapA = s.ease('tsne', 0.7);
      s.alpha(eA * (1 - mapA), () => {
        for (let t = 0; t < 5; t++) {
          const x = x0 + t * (T + gap);
          const [b, f] = beats[t]!;
          s.alpha(late(s, b, f, 0.4), () => {
            if (t === 0) photo(s, 'train', DOG, x, y0, T);
            else if (t === 4) photo(s, 'train', ed?.other ?? 0, x, y0, T, s.c('red'));
            else blit(s, ed ? chwCanvas(`edit-${t}`, [ed.shifted, ed.darker, ed.boxed][t - 1]!) : null, x, y0, T);
            s.text(names[t]!, x + T / 2, y0 + T + u * 3.6, { size: tall ? 2.9 : 3.3, color: s.c(t === 4 ? 'red' : '--ink-2') });
          });
        }
        s.alpha(s.win('deeper', 'bars'), () => {
          const ty = y0 + T + u * (tall ? 13 : 15);
          s.text('pixel distance asks:', w / 2, ty, { size: tall ? 3.6 : 4, italic: true, color: s.c('--ink-2') });
          s.text('same colors, in the same places?', w / 2, ty + u * (tall ? 6 : 7), { size: tall ? 4 : 4.6, font: 'display', weight: 600 });
        });
        // L2 distance from the dog to each.
        const bA = s.ease('bars', 0.6, 0.4);
        if (bA > 0 && ed) {
          const top = y0 + T + u * 11;
          const rh = Math.min(u * 8, (h * 0.93 - top) / 4.6);
          const labW = tall ? u * 22 : w * 0.2;
          const bx = m + labW;
          const bwMax = w - m - bx - u * 14;
          const mx = Math.max(...ed.ds);
          s.alpha(bA, () => {
            s.text('L2 distance from the dog', bx, top - u * 1, { size: 3.2, align: 'left', color: s.c('--ink-3') });
            ed.ds.forEach((v, i) => {
              const y = top + (i + 0.7) * rh;
              const k: Color = i === 3 ? 'red' : 'blue';
              s.text(names[i + 1]!, bx - u * 2, y, { size: tall ? 3 : 3.3, align: 'right', color: s.c(i === 3 ? 'red' : '--ink-2') });
              const len = (v / mx) * bwMax * smooth(bA * 1.4 - i * 0.1);
              s.rrect(bx, y - rh * 0.3, Math.max(1, len), rh * 0.6, 0.6, { fill: s.tint(k, 0.65) });
              s.text(String(Math.round(v)), bx + len + u * 1.5, y, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-2') });
            });
            const xr = bx + (ed.ds[3]! / mx) * bwMax;
            s.line(xr, top + u * 1, xr, top + 4.4 * rh, s.c('red'), 0.35, [1, 0.8]);
          });
        }
        s.alpha(s.ease('fluke', 0.6, 0.3), () => {
          const bh = u * 14;
          const y = h - Math.max(u * 4, h * 0.03) - bh;
          s.rrect(m, y, w - 2 * m, bh, 1.5, { fill: s.c('--card'), stroke: s.c('--rule') });
          s.text('farther than the nearest other class:', w / 2, y + bh * 0.3, { size: tall ? 3.2 : 3.6, color: s.c('--ink-2') });
          s.text('4 px shift: 47% of images · 60% light: 62%', w / 2, y + bh * 0.68, { size: tall ? 3.3 : 3.8, weight: 650 });
        });
      });
      // t-SNE: a map where nearby means close in pixel distance.
      if (mapA > 0) {
        const [rx, ry, rw, rh] = area(s, 0.12, 0.04);
        const t = Math.max(u * 3.6, Math.min(rw, rh) * 0.075);
        s.alpha(mapA, () => {
          TSNE.forEach(([i, x, y], n) => {
            s.alpha(s.ease('tsne', 0.4, 0.3 + (n % 40) * 0.03), () => photo(s, 'train', i, rx + x * (rw - t), ry + y * (rh - t - u * 6), t, null));
          });
          s.text('t-SNE map of 240 training images by pixel L2', w / 2, ry + rh - u * 1.5, { size: 3.2, italic: true, color: s.c('--ink-2') });
        });
      }
    }
  },
};

// ---------------------------------------------------------------- curse

const DENSE: [number, number][] = (() => {
  const rng = new Rng(5);
  return Array.from({ length: 70 }, () => [rng.next(), rng.next()] as [number, number]);
})();
const DIMS: [number, string, number][] = [
  [2, 'two', 0],
  [10, 'up', 0.32],
  [100, 'up', 0.55],
  [1000, 'up', 0.78],
  [3072, 'spike', 0.05],
];

function isoDots(s: Scene, cx: number, cy: number, size: number, n3: boolean, a: number, col: string): void {
  const n = 10;
  const step = size / (n - 1);
  s.alpha(a, () => {
    for (let z = n3 ? n - 1 : 0; z >= 0; z--)
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const px = cx - size / 2 + x * step + (n3 ? z * step * 0.45 : 0) - (n3 ? size * 0.22 : 0);
          const py = cy + size / 2 - y * step - (n3 ? z * step * 0.38 : 0) + (n3 ? size * 0.2 : 0);
          s.circle(px, py, s.u * (n3 ? 0.42 : 0.6), { fill: col });
        }
  });
}

const curse: SceneDef = {
  marks: {
    big: { tex: String.raw`10^{3072}`, x: 0.5, y: 0.4, size: 11 },
  },
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    // Dense coverage: every query has a true neighbor.
    const sA = s.win('size', 'line');
    if (sA > 0) {
      const fr = new Frame(s, area(s, 0.12, 0.1), [0, 1, 0, 1], true);
      const q: [number, number] = [0.53, 0.46];
      let best = 0;
      DENSE.forEach(([x, y], i) => {
        if (Math.hypot(x - q[0], y - q[1]) < Math.hypot(DENSE[best]![0] - q[0], DENSE[best]![1] - q[1])) best = i;
      });
      s.alpha(sA, () => {
        s.rrect(fr.X(0), fr.Y(1), fr.kx, fr.ky, 0.6, { stroke: s.c('--rule') });
        DENSE.forEach(([x, y], i) => s.alpha(s.ease('size', 0.3, 0.4 + i * 0.02), () => fr.dot(x, y, 1, s.c('teal'))));
        s.alpha(late(s, 'size', 0.6), () => {
          s.line(fr.X(q[0]), fr.Y(q[1]), fr.X(DENSE[best]![0]), fr.Y(DENSE[best]![1]), s.c('--ink'), 0.4);
          s.circle(fr.X(q[0]), fr.Y(q[1]), u * 1.6, { fill: s.c('orange'), stroke: s.c('--card'), lw: 0.4 });
          s.text('a similar one nearby', fr.X(q[0]) + u * 3, fr.Y(q[1]) - u * 5, { size: 3.4, align: 'left', halo: true, color: s.c('--ink-2') });
        });
      });
    }
    // 10, 100, 1,000 ... examples to cover 1, 2, 3 dimensions.
    const gA = s.win('line', 'strange');
    if (gA > 0) {
      const up = s.ease('pixels', 0.8);
      const P = Math.min(w * 0.22, h * 0.34) * lerp(1, 0.6, up);
      const cy = lerp(h * 0.5, h * 0.2, up);
      const xs = [w * 0.2, w * 0.5, w * 0.8];
      const items: [string, number][] = [
        ['10', 0],
        ['100', 0.3],
        ['1,000', 0.52],
      ];
      s.alpha(gA, () => {
        items.forEach(([lab, f], i) => {
          const a = late(s, 'line', f, 0.5);
          if (i === 0)
            s.alpha(a, () => {
              s.line(xs[0]! - P / 2, cy + P / 2, xs[0]! + P / 2, cy + P / 2, s.c('--axis'), 0.3);
              for (let k = 0; k < 10; k++) s.circle(xs[0]! - P / 2 + (k * P) / 9, cy + P / 2, u * 0.7, { fill: s.c('teal') });
            });
          else isoDots(s, xs[i]!, cy, i === 2 ? P * 0.8 : P, i === 2, a, s.c('teal'));
          s.alpha(a * (1 - up * 0.3), () => {
            s.text(`${i + 1}-D`, xs[i]!, cy + P / 2 + u * (up > 0.5 ? 4 : 6), { size: 3.4, color: s.c('--ink-3') });
            s.text(lab, xs[i]!, cy + P / 2 + u * (up > 0.5 ? 9.5 : 12.5), { size: up > 0.5 ? 3.6 : 4.6, font: 'mono', weight: 650 });
          });
        });
        s.show('big', gA * up, { y: 0.56 });
        s.alpha(late(s, 'pixels', 0.45), () => {
          s.text('a number with 3,073 digits', w / 2, h * 0.7, { size: tall ? 4 : 4.4, italic: true, color: s.c('--ink-2') });
          s.text('1' + '0'.repeat(tall ? 22 : 34) + '…', w / 2, h * 0.79, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
        });
      });
    }
    // Distances bunch up as D grows.
    const hA = s.ease('strange', 0.6);
    if (hA > 0) {
      let i0 = 0;
      let mix = 0;
      for (let i = 1; i < DIMS.length; i++) {
        const [, b, f] = DIMS[i]!;
        const t0 = s.at(b) + f * (s.end(b) - s.at(b));
        if (s.t >= t0) {
          i0 = i;
          mix = 0;
        } else if (s.t >= t0 - 0.6 && i0 === i - 1) mix = smooth((s.t - (t0 - 0.6)) / 0.6);
      }
      const A = concentration(DIMS[i0]![0]);
      const B = concentration(DIMS[Math.min(DIMS.length - 1, i0 + 1)]![0]);
      const hist = A.hist.map((v, k) => lerp(v, B.hist[k]!, mix));
      const ratio = lerp(A.ratio, B.ratio, mix);
      const D = DIMS[mix > 0.5 ? Math.min(DIMS.length - 1, i0 + 1) : i0]![0];
      s.slot('D', D);
      s.slot('ratio', s.since('two') >= 0 ? ratio.toFixed(3) : '…');
      const m = Math.max(u * 5, w * 0.07);
      const x0 = m;
      const x1 = w - m;
      const top = h * 0.3;
      const bot = h * 0.82;
      const bw = (x1 - x0) / 30;
      const mx = Math.max(...hist, 1);
      s.alpha(hA, () => {
        s.text(`D = ${D.toLocaleString('en-US')}`, x0, h * 0.18, { size: tall ? 5.4 : 6, font: 'mono', weight: 650, align: 'left' });
        s.alpha(s.ease('two', 0.5), () => s.text(`nearest ÷ farthest = ${ratio.toFixed(2)}`, x1, h * 0.18, { size: tall ? 3.4 : 4, font: 'mono', align: 'right', color: s.c('teal') }));
        s.line(x0, bot, x1, bot, s.c('--axis'), 0.35);
        const grow = s.ease('strange', 1.0, 1.4);
        hist.forEach((v, k) => {
          if (v <= 0) return;
          const hh = (v / mx) * (bot - top) * grow;
          s.rrect(x0 + k * bw + 1, bot - hh, bw - 2, hh, 0.4, { fill: s.tint('red', 0.7) });
        });
        [0, 0.5, 1].forEach((v) => s.text(String(v), x0 + v * (x1 - x0), bot + u * 4, { size: 3, font: 'mono', align: v === 0 ? 'left' : v === 1 ? 'right' : 'center', color: s.c('--ink-3') }));
        s.text('distance ÷ largest distance', (x0 + x1) / 2, bot + u * 9, { size: 3.2, color: s.c('--ink-3') });
        s.alpha(s.ease('two', 0.5, 0.4), () => {
          const xr = x0 + ratio * (x1 - x0);
          s.line(xr, top - u * 3, xr, bot, s.c('teal'), 0.45, [1.2, 1]);
          s.text('nearest', xr + (ratio > 0.7 ? -u : u), top - u * 4.5, { size: 3.2, align: ratio > 0.7 ? 'right' : 'left', color: s.c('teal'), halo: true });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- closing

const STEPS: [string, string, number][] = [
  ['normalize features', 'pre', 0.15],
  ['reduce dimensions (PCA)', 'pre', 0.62],
  ['split off validation data', 'tune', 0.02],
  ['tune k and the distance', 'tune', 0.12],
  ['too slow? approximate NN', 'tune', 0.38],
  ['test once, report it', 'tune', 0.68],
];
const RECAP: [string, string, number][] = [
  ['3,072 numbers → 1 label', 'recap', 0.25],
  ['the semantic gap', 'recap', 0.55],
  ['learn from data', 'recap', 0.8],
  ['k nearest neighbors vote', 'recap2', 0.05],
  ['instant training, slow prediction', 'recap2', 0.3],
  ['tune on validation, test once', 'recap2', 0.78],
];

const closing: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const d = cifar(s);
    const m = Math.max(u * 5, w * 0.08);
    // The recipe.
    const rA = s.win('practice', 'recap');
    s.alpha(rA, () => {
      s.text('kNN in practice', w / 2, h * 0.2, { size: tall ? 5 : 5.6, font: 'display', weight: 600 });
      STEPS.forEach(([t, b, f], i) => {
        const on = late(s, b, f, 0.4);
        const y = h * 0.32 + i * h * 0.1;
        s.alpha(s.ease('practice', 0.4, 0.8 + i * 0.15) * (0.35 + 0.65 * on), () => {
          s.text(`${i + 1}`, m, y, { size: 3.6, font: 'mono', weight: 650, color: s.c('--accent') });
          s.text(t, m + u * 6, y, { size: tall ? 3.8 : 4.2, align: 'left' });
        });
        s.alpha(on, () => checkMark(s, w - m, y, u * 1.8));
      });
    });
    // The recap.
    const cA = s.win('recap', 'next');
    if (cA > 0) {
      const cols = tall ? 2 : 3;
      const rows = 6 / cols;
      const [rx, ry, rw, rh] = area(s, 0.14, 0.05);
      const gap = u * 2.5;
      const tw = (rw - gap * (cols - 1)) / cols;
      const th = Math.min((rh - gap * (rows - 1)) / rows, tw * (tall ? 0.5 : 0.56));
      const oy = ry + (rh - (th * rows + gap * (rows - 1))) / 2;
      s.alpha(cA, () =>
        RECAP.forEach(([t, b, f], i) =>
          s.alpha(late(s, b, f, 0.4), () => {
            const x = rx + (i % cols) * (tw + gap);
            const y = oy + Math.floor(i / cols) * (th + gap);
            const k: Color = (['teal', 'gold', 'green', 'slate', 'red', 'purple'] as Color[])[i]!;
            s.rrect(x, y, tw, th, 2, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.6) });
            const fs = Math.min(tall ? 3.4 : 4.4, (tw / u) * 0.105);
            const words = t.split(' ');
            const lines: string[] = [];
            for (const wd of words) {
              const last = lines[lines.length - 1];
              if (last !== undefined && s.measure(`${last} ${wd}`, { size: fs }) < tw - u * 4) lines[lines.length - 1] = `${last} ${wd}`;
              else lines.push(wd);
            }
            lines.forEach((ln, j) => s.text(ln, x + tw / 2, y + th / 2 + (j - (lines.length - 1) / 2) * u * fs * 1.25, { size: fs, weight: 550 }));
          }),
        ),
      );
    }
    // Next: one template per class, one multiply.
    const nA = s.ease('next', 0.6);
    if (nA > 0) {
      s.alpha(nA, () => {
        s.text('next: a linear classifier', w / 2, h * 0.2, { size: tall ? 4.6 : 5.4, font: 'display', weight: 600 });
        const cols = 5;
        const gap = u * 2;
        const t = Math.min((w - 2 * m - (cols - 1) * gap) / cols, h * 0.17);
        const gx = (w - (cols * t + (cols - 1) * gap)) / 2;
        const gy = h * 0.3;
        for (let c = 0; c < 10; c++) {
          const x = gx + (c % cols) * (t + gap);
          const y = gy + Math.floor(c / cols) * (t + u * 8);
          s.alpha(s.ease('next', 0.4, 1.4 + c * 0.15), () => {
            blit(s, d ? chwCanvas(`mean-${c}`, classMeans(d)[c]!) : null, x, y, t);
            s.text(CIFAR_CLASSES[c]!, x + t / 2, y + t + u * 3, { size: 3, color: s.c('--ink-2') });
          });
        }
        const by = gy + 2 * (t + u * 8) + u * 3;
        s.alpha(late(s, 'next', 0.3), () => s.text('one template per class (here, class averages)', w / 2, by, { size: 3.3, italic: true, color: s.c('--ink-3') }));
        s.alpha(late(s, 'next', 0.75), () => s.text('scores = W.dot(x): one multiply', w / 2, by + u * 8, { size: tall ? 3.8 : 4.4, font: 'mono', weight: 600 }));
      });
    }
  },
};

export const scenesC: Record<string, SceneDef> = { validation, crossval, limits, curse, closing };
