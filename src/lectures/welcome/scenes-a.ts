import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { CLASSES, type K, PICK, cell, check, eye, features, photo, pill } from './kit';

/** Seconds into the scene at which a fraction `f` of beat `id` has been spoken. */
const at = (s: Scene, id: string, f = 0): number => lerp(s.at(id), s.end(id), f);

// ---------------------------------------------------------------- intro

const STAFF: { name: [string, string]; initials: string; role: string[]; k: K }[] = [
  { name: ['Fei-Fei', 'Li'], initials: 'FL', role: ['instructor'], k: 'teal' },
  { name: ['Andrej', 'Karpathy'], initials: 'AK', role: ['course notes', 'lectures'], k: 'blue' },
  { name: ['Justin', 'Johnson'], initials: 'JJ', role: ['assignments', 'lectures'], k: 'green' },
];

/** Ten class scores for the cat photo; the cat wins. */
const SCORES = [0.5, 0.3, 1.2, 3.1, 0.9, 2.2, 0.7, 0.4, 0.2, 0.3];

export const intro: SceneDef = {
  draw(s) {
    const { w, u } = s;
    // Title, then the three people who taught it.
    const tA = s.win('hello', 'task');
    s.alpha(tA, () => {
      const lift = s.ease('term', 0.9);
      const ty = lerp(u * 36, u * 13, lift);
      s.text('CS231n', w / 2, ty, { size: lerp(15, 9, lift), font: 'display', weight: 650 });
      s.alpha(s.ease('hello', 0.8, 0.6) * (1 - lift), () => {
        s.text('Convolutional Neural Networks', w / 2, u * 52, { size: 4.6, italic: true, color: s.c('--ink-2') });
        s.text('for Visual Recognition', w / 2, u * 58.5, { size: 4.6, italic: true, color: s.c('--ink-2') });
      });
      s.alpha(s.ease('famous', 0.6) * (1 - lift), () => s.text('Stanford · first taught in 2015', w / 2, u * 71, { size: 3.4, font: 'mono', color: s.c('--ink-3') }));
      s.alpha(lift, () => pill(s, 'Stanford · Winter 2016', w / 2, u * 24, 'slate', { size: 3.2 }));
      const gap = u * 3;
      const cw = Math.min(u * 36, (w - u * 10 - 2 * gap) / 3);
      const ch = u * 52;
      const x0 = w / 2 - (3 * cw + 2 * gap) / 2;
      const y0 = u * 33;
      STAFF.forEach((p, i) => {
        const a = s.ease('term', 0.6, 1.2 + 0.7 * i);
        if (a <= 0) return;
        const x = x0 + i * (cw + gap);
        const y = y0 + (1 - a) * u * 3;
        // Karpathy and Johnson light up while their roles are read.
        const rp = s.prog('roles');
        const reading = s.since('roles') >= 0;
        const on = !reading || i === 0 ? 0.2 : rp >= 0.72 ? 1 : (i === 1) === rp < 0.4 ? 1 : 0.35;
        s.alpha(a, () => {
          s.rrect(x, y, cw, ch, 2.4, { fill: s.tint(p.k, 0.05 + 0.08 * on), stroke: s.tint(p.k, 0.35 + 0.6 * on), lw: 0.3 + 0.25 * on });
          s.circle(x + cw / 2, y + u * 10, u * 6, { fill: s.tint(p.k, 0.18), stroke: s.c(p.k), lw: 0.4 });
          s.text(p.initials, x + cw / 2, y + u * 10.3, { size: 4.2, font: 'ui', weight: 650, color: s.c(p.k) });
          s.text(p.name[0], x + cw / 2, y + u * 22, { size: 3.9, font: 'display', weight: 600 });
          s.text(p.name[1], x + cw / 2, y + u * 27.5, { size: 3.9, font: 'display', weight: 600 });
          p.role.forEach((r, j) => {
            const ra = i === 0 ? s.ease('term', 0.6, 2.6) : reading ? smooth((s.t - at(s, 'roles', j ? 0.72 : i === 1 ? 0.05 : 0.4)) / 0.5) : 0;
            s.alpha(ra, () => s.text(r, x + cw / 2, y + u * (38 + j * 5.4), { size: 3.2, italic: true, color: s.c(p.k) }));
          });
        });
      });
    });

    // One problem: what is in the photo?
    const pA = s.ease('task', 0.7);
    if (pA <= 0) return;
    s.alpha(pA, () => {
      const P = Math.min(u * 34, w * 0.3);
      const px = u * 6;
      const py = u * 50 - P / 2;
      s.text('img', px + P / 2, py - u * 3.6, { size: 3.6, font: 'mono', weight: 600, color: s.c('orange') });
      photo(s, PICK[3]!, px, py, P, s.c('orange'), 0.5);
      s.alpha(s.win('task', 'guess'), () => s.text('what is in it?', px + P / 2, py + P + u * 5, { size: 3.8, italic: true, color: s.c('--ink-2') }));
      // The model and its ten scores.
      const gA = s.ease('guess', 0.6);
      const bx = px + P + u * 5;
      const bw = u * 16;
      const mid = u * 50;
      s.alpha(gA, () => {
        s.arrow(px + P + u * 1, mid, bx - u * 0.8, mid, s.c('--ink-3'), 0.4, 2);
        s.rrect(bx, mid - u * 8, bw, u * 16, 2, { fill: s.tint('--ink', 0.05), stroke: s.tint('--ink', 0.45), lw: 0.4 });
        s.text('model', bx + bw / 2, mid + u * 0.2, { size: 3.4, font: 'mono', weight: 600 });
        s.arrow(bx + bw + u * 0.8, mid, bx + bw + u * 4.5, mid, s.c('--ink-3'), 0.4, 2);
      });
      s.alpha(s.ease('scratch', 0.6, 0.8), () => {
        s.text('NumPy,', bx + bw / 2, mid + u * 12.5, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('from scratch', bx + bw / 2, mid + u * 17, { size: 3, font: 'mono', color: s.c('--ink-3') });
      });
      const lx = bx + bw + u * 16;
      const x0 = lx + u * 1.5;
      const x1 = w - u * 6;
      const top = u * 21;
      const rh = u * 6;
      const grow = s.since('guess') >= 0 ? smooth((s.t - at(s, 'guess', 0.15)) / 1.4) : 0;
      const win = s.since('guess') >= 0 ? smooth((s.t - at(s, 'guess', 0.7)) / 0.5) : 0;
      s.alpha(gA, () => {
        s.text('scores', (x0 + x1) / 2, top - u * 4.6, { size: 3.4, font: 'mono', weight: 600, color: s.c('purple') });
        SCORES.forEach((v, i) => {
          const y = top + i * rh;
          const best = i === 3;
          s.text(CLASSES[i]!, lx, y + rh / 2, { size: 3, font: 'ui', align: 'right', weight: best && win > 0.5 ? 650 : 450, color: s.c(best && win > 0.5 ? 'purple' : '--ink-2') });
          const bl = (x1 - x0) * (v / 3.4) * grow;
          s.rrect(x0, y + rh * 0.18, Math.max(1, bl), rh * 0.64, 0.6, { fill: s.tint('purple', best ? 0.35 + 0.5 * win : 0.28) });
        });
      });
      s.alpha(win, () => {
        const gy = top + 10 * rh + u * 5;
        pill(s, 'guess: cat', (x0 + x1) / 2, gy, 'purple', { size: 3.2 });
      });
      s.alpha(s.ease('site', 0.6, 0.3), () => pill(s, 'an unofficial companion', w / 2, u * 9, 'slate', { size: 3, font: 'ui' }));
    });
  },
};

// ---------------------------------------------------------------- history

const ENTRIES: [number, string, number, boolean][] = [
  [2010, 'NEC-UIUC', 28.2, false],
  [2011, 'XRCE', 25.8, false],
  [2012, 'AlexNet', 16.4, true],
  [2013, 'ZFNet', 11.7, true],
  [2014, 'VGG', 7.3, true],
  [2014, 'GoogLeNet', 6.7, true],
  [2015, 'ResNet', 3.6, true],
];
const HUMAN = 5.1;
/** Fifteen photos for the ImageNet thumbnail: the class picks, then five more. */
const MOSAIC = [...PICK, 6, 18, 10, 12, 8];
const XMAX = 32;

/** When each bar grows: its beat, and a stagger inside that beat. */
const BAR_AT: [string, number][] = [
  ['early', 0.1],
  ['early', 0.35],
  ['alexnet', 0.45],
  ['deeper', 0.2],
  ['deeper', 0.4],
  ['deeper', 0.6],
  ['resnet', 0.25],
];

function chartLayout(s: Scene) {
  const { w, u } = s;
  const L = Math.min(u * 31, w * 0.3);
  const X = (v: number) => L + u * 2 + (v / XMAX) * (w - u * 12 - L - u * 2);
  const top = u * 19;
  const rh = u * 8.8;
  return { L, X, top, rh, base: top + ENTRIES.length * rh };
}

/** A tiny GPU: a chip with pins. */
function chip(s: Scene, cx: number, cy: number, r: number, k: K): void {
  for (let i = -2; i <= 2; i++) {
    const o = (i * r) / 2.8;
    s.line(cx + o, cy - r * 1.25, cx + o, cy + r * 1.25, s.tint(k, 0.6), 0.35);
    s.line(cx - r * 1.25, cy + o, cx + r * 1.25, cy + o, s.tint(k, 0.6), 0.35);
  }
  s.rrect(cx - r, cy - r, 2 * r, 2 * r, 1, { fill: s.c('--card'), stroke: s.c(k), lw: 0.45 });
  s.rrect(cx - r, cy - r, 2 * r, 2 * r, 1, { fill: s.tint(k, 0.14) });
  s.text('GPU', cx, cy + s.u * 0.2, { size: (r / s.u) * 0.62, font: 'mono', weight: 650, color: s.c(k) });
}

export const history: SceneDef = {
  draw(s) {
    const { w, u, t } = s;
    // Four milestones on the way to ImageNet.
    const cA = s.win('eyes', 'contest');
    s.alpha(cA, () => {
      const gap = u * 4;
      const cw = (w - u * 10 - gap) / 2;
      const ch = u * 38;
      const y0 = u * 13;
      const box = (i: number, beat: string, k: K, year: string, cap: string, art: (cx: number, cy: number) => void) => {
        const a = s.ease(beat, 0.7);
        if (a <= 0) return;
        const x = u * 5 + (i % 2) * (cw + gap);
        const y = y0 + Math.floor(i / 2) * (ch + gap);
        const cur = s.since(beat) >= 0 && (i === 3 || s.since(['cat', 'features', 'imagenet'][i]!) < 0) ? 1 : 0;
        s.alpha(a, () => {
          s.rrect(x, y, cw, ch, 2.4, { fill: s.tint(k, 0.04 + 0.05 * cur), stroke: s.tint(k, 0.3 + 0.5 * cur), lw: 0.3 + 0.2 * cur });
          art(x + cw / 2, y + u * 15);
          s.text(year, x + cw / 2, y + ch - u * 10.5, { size: 3.1, font: 'mono', weight: 600, color: s.c(k) });
          s.text(cap, x + cw / 2, y + ch - u * 5, { size: 3.6, color: s.c('--ink-2') });
        });
      };
      box(0, 'eyes', 'teal', '540 million years ago', 'the first eyes', (cx, cy) => {
        const blink = Math.sin(t * 1.3) > 0.97 ? 0.15 : 1;
        eye(s, cx, cy, u * 10, 'teal', Math.sin(t * 0.8) * 0.8, blink);
      });
      box(1, 'cat', 'gold', '1959 · Hubel and Wiesel', 'cells that see edges', (cx, cy) => {
        const bp = s.ease('blueprint', 0.8);
        // The bar of light sweeps; the cell fires near its preferred angle.
        const ang = Math.sin(t * 0.9) * 1.1;
        const fire = clamp01(1 - Math.abs(ang - 0.5) / 0.35);
        s.alpha(1 - bp, () => cell(s, cx - u * 5, cy, u * 7, ang, 'gold', fire, t));
        s.alpha(bp, () => {
          const angs = [0.5, -0.6, 1.5];
          angs.forEach((a, j) => {
            const yy = cy + (j - 1) * u * 7.5;
            s.circle(cx - u * 11, yy, u * 3, { fill: s.tint('gold', 0.1), stroke: s.tint('gold', 0.7), lw: 0.3 });
            s.line(cx - u * 11 - Math.cos(a) * u * 2.1, yy - Math.sin(a) * u * 2.1, cx - u * 11 + Math.cos(a) * u * 2.1, yy + Math.sin(a) * u * 2.1, s.c('gold'), 0.55);
            s.arrow(cx - u * 7.4, yy, cx + u * 2.6, cy + (j - 1) * u * 2, s.tint('--ink', 0.4), 0.3, 1.6);
          });
          s.circle(cx + u * 8, cy, u * 5.5, { fill: s.tint('gold', 0.14), stroke: s.c('gold'), lw: 0.45 });
          s.line(cx + u * 5.5, cy + u * 2, cx + u * 8, cy - u * 2.4, s.c('gold'), 0.55);
          s.line(cx + u * 8, cy - u * 2.4, cx + u * 10.5, cy + u * 2, s.c('gold'), 0.55);
        });
      });
      box(2, 'features', 'slate', '1999 to 2008', 'features made by hand', (cx, cy) => {
        const fs = u * 15;
        features(s, cx - u * 15, cy - fs / 2, fs, 'slate', t);
        s.arrow(cx + u * 1.5, cy, cx + u * 6, cy, s.c('--ink-3'), 0.35, 1.8);
        s.rrect(cx + u * 7, cy - u * 4, u * 11, u * 8, 1.2, { fill: s.tint('slate', 0.1), stroke: s.c('slate'), lw: 0.35 });
        s.text('SVM', cx + u * 12.5, cy + u * 0.2, { size: 3, font: 'mono', weight: 600, color: s.c('slate') });
      });
      box(3, 'imagenet', 'blue', '2009 · ImageNet', '14 million+ labeled photos', (cx, cy) => {
        const n = 5;
        const ps = u * 4.6;
        const g = u * 0.6;
        const x0 = cx - (n * ps + (n - 1) * g) / 2;
        const y0 = cy - (3 * ps + 2 * g) / 2;
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < n; c++) {
            const k = r * n + c;
            const a = clamp01((s.since('imagenet') - 0.4 - k * 0.07) / 0.3);
            s.alpha(a, () => photo(s, MOSAIC[k]!, x0 + c * (ps + g), y0 + r * (ps + g), ps, null));
          }
      });
    });

    // The ImageNet results, year by year.
    const kA = s.ease('contest', 0.7);
    if (kA <= 0) return;
    const fuel = s.win('fuel', 'wave', 0.7);
    const { L, X, top, rh, base } = chartLayout(s);
    s.alpha(kA, () => {
      s.text('ImageNet top-5 error', w / 2, u * 7.5, { size: 4, font: 'display', weight: 600 });
      for (let v = 0; v <= 30; v += 10) {
        s.line(X(v), top - u * 1, X(v), base, s.c(v === 0 ? '--axis' : '--grid'), 0.25);
        s.text(String(v), X(v), base + u * 3.4, { size: 3, font: 'mono', color: s.c('--ink-3') });
      }
      s.text('top-5 error (%)', X(15), base + u * 8.4, { size: 3.2, font: 'ui', color: s.c('--ink-3') });
      const hA = s.since('resnet') >= 0 ? smooth((s.t - at(s, 'resnet', 0.55)) / 0.6) : 0;
      ENTRIES.forEach(([yr, nm, err, deep], i) => {
        const y = top + i * rh;
        const [beat, f] = BAR_AT[i]!;
        const g = s.since(beat) >= 0 ? smooth((s.t - at(s, beat, f)) / 0.8) : 0;
        const lit = s.since(beat) >= 0 && s.t - at(s, beat, f) < 2.6 ? 1 : 0;
        const k: K = deep ? 'blue' : 'slate';
        s.text(`${yr} ${nm}`, L, y + rh / 2, { size: 3.2, font: 'ui', align: 'right', weight: lit ? 650 : 450, color: s.c(lit ? '--ink' : '--ink-2') });
        if (g <= 0) return;
        const x1 = lerp(X(0), X(err), g);
        s.rrect(X(0), y + rh * 0.2, x1 - X(0), rh * 0.6, 0.6, { fill: s.tint(k, 0.5 + 0.35 * lit) });
        // A value left of the human line moves past it once the line is drawn.
        const vx = err < HUMAN ? lerp(x1, X(HUMAN), hA) : x1;
        s.alpha(smooth((g - 0.6) / 0.4), () => s.text(`${err}%`, vx + u * 1.2, y + rh / 2, { size: 3, font: 'mono', align: 'left', weight: lit ? 650 : 500, color: s.c(lit ? (deep ? 'blue' : '--ink') : '--ink-3') }));
      });
      // The human estimate.
      s.alpha(hA, () => {
        s.line(X(HUMAN), top - u * 1.5, X(HUMAN), base, s.c('red'), 0.4, [1.4, 1]);
        s.text(`human ${HUMAN}%`, X(HUMAN) + u * 1.2, top - u * 3.2, { size: 3, font: 'ui', align: 'left', weight: 600, color: s.c('red'), halo: true });
      });
      // CS231n began between the 2014 and 2015 results.
      const cA = s.ease('wave', 0.7, 0.3);
      s.alpha(cA, () => {
        const y = top + 6 * rh;
        s.line(X(0), y, w - u * 6, y, s.c('--accent'), 0.35, [1.2, 0.9]);
        pill(s, 'CS231n begins, 2015', w - u * 6, y - u * 0.2, '--accent', { size: 3, align: 'right', font: 'ui', fill: 0.16, opaque: true });
      });
    });
    // Five guesses per photo: a hit if the label is among them.
    const gA = s.win('contest', 'early');
    s.alpha(gA * kA, () => {
      const ps = u * 18;
      const gx = X(5);
      const gy = top + u * 8;
      const cardW = Math.min(w - u * 4, gx + ps + u * 27) - gx + u * 3;
      s.rrect(gx - u * 3, gy - u * 3, cardW, ps + u * 17, 2, { fill: s.c('--card'), stroke: s.tint('--ink', 0.2), lw: 0.3 });
      photo(s, PICK[3]!, gx, gy, ps, s.c('orange'), 0.4);
      s.text('label: cat', gx + ps / 2, gy + ps + u * 4, { size: 3, font: 'mono', color: s.c('gold') });
      const guesses = ['tiger', 'cat', 'lynx', 'fox', 'dog'];
      guesses.forEach((g, i) => {
        const a = clamp01((s.since('contest') - 0.6 - i * 0.25) / 0.3);
        const yy = gy + u * 1.5 + i * u * 4.6;
        s.alpha(a, () => pill(s, `${i + 1} ${g}`, gx + ps + u * 4, yy, i === 1 ? 'green' : 'slate', { size: 2.8, align: 'left' }));
      });
      s.alpha(clamp01((s.since('contest') - 2.4) / 0.4), () => {
        check(s, gx + ps + u * 22, gy + u * 1.5 + u * 4.6, u * 1.8);
        s.text('a hit: cat is in the top five', gx - u * 3 + cardW / 2, gy + ps + u * 10, { size: 3.2, italic: true, color: s.c('--ink-2') });
      });
    });
    // What changed in 2012: the fuel, over a wash that quiets the chart.
    s.alpha(fuel * 0.95, () => s.rrect(0, 0, w, s.h, 0, { fill: s.c('--card') }));
    s.alpha(fuel, () => {
      const fw = Math.min(u * 32, (w - u * 14) / 3);
      const fh = u * 36;
      const x0 = w / 2 - (3 * fw + u * 4) / 2;
      const y0 = u * 30;
      const items: [string, string, K][] = [
        ['data', 'big labeled sets', 'gold'],
        ['compute', 'graphics cards', 'teal'],
        ['tricks', 'ReLU, dropout', 'green'],
      ];
      items.forEach(([head, sub, k], i) => {
        const a = s.ease('fuel', 0.6, 1.8 + i * 0.9);
        const x = x0 + i * (fw + u * 2);
        s.alpha(a, () => {
          s.rrect(x, y0, fw, fh, 2.4, { fill: s.c('--card') });
          s.rrect(x, y0, fw, fh, 2.4, { fill: s.tint(k, 0.08), stroke: s.c(k), lw: 0.4 });
          const cx = x + fw / 2;
          const cy = y0 + u * 12;
          if (i === 0) {
            const ps = u * 4.4;
            for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) photo(s, PICK[(r * 3 + c + 4) % 10]!, cx - ps * 1.5 - u * 0.5 + c * (ps + u * 0.5), cy - ps - u * 0.25 + r * (ps + u * 0.5), ps, null);
          } else if (i === 1) chip(s, cx, cy, u * 5, k);
          else {
            s.line(cx - u * 8, cy + u * 3, cx, cy + u * 3, s.c(k), 0.6);
            s.line(cx, cy + u * 3, cx + u * 7, cy - u * 5, s.c(k), 0.6);
            s.line(cx - u * 8, cy + u * 3, cx + u * 8, cy + u * 3, s.tint('--ink', 0.25), 0.25);
          }
          s.text(head, cx, y0 + u * 24.5, { size: 4.2, font: 'display', weight: 600, color: s.c(k) });
          s.text(sub, cx, y0 + u * 30.5, { size: 3, italic: true, color: s.c('--ink-2') });
        });
      });
      s.text('old ideas, new fuel', w / 2, u * 21, { size: 4.4, italic: true, color: s.c('--ink') });
    });
  },
};

// ---------------------------------------------------------------- goal

const TAGS: [string, K][] = [
  ['A1', 'blue'],
  ['A1', 'blue'],
  ['A1', 'blue'],
  ['A1', 'blue'],
  ['A2', 'green'],
  ['A3', 'purple'],
];
const BUILD_BEATS = ['cifar', 'knn', 'lin', 'net', 'conv', 'rnn'];
const BUILD_NAMES = ['CIFAR-10', 'nearest neighbor', 'linear classifier', 'neural network', 'ConvNet', 'captions'];

/** Points for the nearest-neighbor sketch: three classes, then the query. */
const DOTS: [number, number, number][] = [
  [-0.7, 0.5, 0], [-0.4, 0.75, 0], [-0.85, 0.15, 0], [-0.3, 0.3, 0],
  [0.55, 0.6, 1], [0.8, 0.25, 1], [0.35, 0.85, 1], [0.6, -0.05, 1],
  [-0.2, -0.6, 2], [0.15, -0.8, 2], [0.45, -0.5, 2], [-0.55, -0.45, 2],
];
const DOT_K: K[] = ['orange', 'blue', 'green'];

function drawCard(s: Scene, i: number, x: number, y: number, cw: number, ch: number, t: number): void {
  const { u } = s;
  const cx = x + cw / 2;
  const cy = y + ch * 0.58;
  const R = Math.min(cw * 0.36, ch * 0.3);
  const beat = BUILD_BEATS[i]!;
  const p = s.since(beat) >= 0 ? clamp01(s.since(beat) / 2.5) : 1;
  if (i === 0) {
    const n = 5;
    const g = u * 0.5;
    const ps = Math.min((cw - u * 5 - g * (n - 1)) / n, (ch * 0.62 - g) / 2);
    const x0 = cx - (n * ps + (n - 1) * g) / 2;
    const y0 = cy - ps - g / 2;
    for (let k = 0; k < 10; k++) {
      const a = clamp01(p * 12 - k);
      s.alpha(a, () => photo(s, PICK[k]!, x0 + (k % n) * (ps + g), y0 + Math.floor(k / n) * (ps + g), ps, null));
    }
  } else if (i === 1) {
    const q: [number, number] = [0.1, 0.35];
    const P = (a: number, b: number): [number, number] => [cx + a * R, cy - b * R * 0.85];
    const near = DOTS.map((d, j) => [Math.hypot(d[0] - q[0], d[1] - q[1]), j] as [number, number]).sort((a, b) => a[0] - b[0]).slice(0, 3);
    near.forEach(([, j], m) => {
      const a = clamp01(p * 3 - 0.5 - m * 0.4);
      const [x1, y1] = P(DOTS[j]![0], DOTS[j]![1]);
      const [qx, qy] = P(q[0], q[1]);
      s.line(qx, qy, lerp(qx, x1, a), lerp(qy, y1, a), s.tint('--ink', 0.45), 0.3);
    });
    DOTS.forEach(([a, b, k]) => {
      const [px, py] = P(a, b);
      s.circle(px, py, u * 1.1, { fill: s.c(DOT_K[k]!) });
    });
    const [qx, qy] = P(q[0], q[1]);
    s.circle(qx, qy, u * 1.6, { fill: s.c('--card'), stroke: s.c('--ink'), lw: 0.45 });
    s.text('?', qx, qy + u * 0.2, { size: 2.4, font: 'ui', weight: 700 });
  } else if (i === 2) {
    const c = Math.min(u * 3.2, cw / 11);
    const wx = cx - c * 4.6;
    const wy = cy - c * 1.5;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) s.rrect(wx + k * c, wy + r * c, c * 0.9, c * 0.9, 0.4, { fill: s.tint('blue', 0.25 + 0.5 * Math.abs(Math.sin(r * 2.1 + k * 1.3))) });
    s.text('W', wx + c * 2, wy - c * 0.9, { size: 3, italic: true, weight: 650, color: s.c('blue') });
    const xx = wx + c * 4.6;
    for (let k = 0; k < 4; k++) s.rrect(xx, wy - c * 0.5 + k * c, c * 0.9, c * 0.9, 0.4, { fill: s.tint('orange', 0.3 + 0.4 * Math.abs(Math.cos(k * 1.7))) });
    s.text('x', xx + c * 0.45, wy - c * 1.5, { size: 3, italic: true, weight: 650, color: s.c('orange') });
    s.text('=', xx + c * 2.1, cy, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
    const sx = xx + c * 3.2;
    const lit = Math.floor(p * 6) % 3;
    for (let r = 0; r < 3; r++) s.rrect(sx, wy + r * c, c * 0.9, c * 0.9, 0.4, { fill: s.tint('purple', r === lit && p < 1 ? 0.85 : 0.4) });
    s.text('s', sx + c * 0.45, wy - c * 0.9, { size: 3, italic: true, weight: 650, color: s.c('purple') });
  } else if (i === 3) {
    const layers = [3, 4, 2];
    const lx = (l: number) => cx + (l - 1) * R * 0.95;
    const ly = (l: number, j: number) => cy + (j - (layers[l]! - 1) / 2) * R * 0.48;
    // A teal pulse runs backward during the beat: backpropagation.
    const back = s.since('net') >= 0 && s.since('conv') < 0 ? (s.since('net') * 0.6) % 1 : -1;
    for (let l = 0; l < 2; l++)
      for (let a = 0; a < layers[l]!; a++)
        for (let b = 0; b < layers[l + 1]!; b++) {
          const hot = back >= 0 && Math.abs(1 - back * 2 - (l - 0.5)) < 0.5;
          s.line(lx(l), ly(l, a), lx(l + 1), ly(l + 1, b), hot ? s.tint('teal', 0.7) : s.tint('--ink', 0.25), hot ? 0.35 : 0.22);
        }
    layers.forEach((n, l) => {
      for (let j = 0; j < n; j++) s.circle(lx(l), ly(l, j), u * 1.5, { fill: s.c('--card'), stroke: s.c(l === 0 ? 'orange' : l === 2 ? 'purple' : '--ink-2'), lw: 0.4 });
    });
  } else if (i === 4) {
    const sizes = [1, 0.78, 0.58, 0.4];
    sizes.forEach((f, j) => {
      const sw = R * 0.62 * f;
      const sh = R * 1.15 * f;
      const sx = cx - R * 1.05 + j * R * 0.62;
      const depth = u * (2.6 - j * 0.3);
      const k: K = j === 3 ? 'purple' : 'green';
      const c = s.ctx;
      c.beginPath();
      c.moveTo(sx, cy - sh / 2);
      c.lineTo(sx + depth, cy - sh / 2 - depth * 0.7);
      c.lineTo(sx + depth + sw * 0.3, cy - sh / 2 - depth * 0.7);
      c.lineTo(sx + depth + sw * 0.3, cy + sh / 2 - depth * 0.7);
      c.lineTo(sx + sw * 0.3, cy + sh / 2);
      c.lineTo(sx, cy + sh / 2);
      c.closePath();
      c.fillStyle = s.tint(k, 0.2 + 0.12 * j);
      c.fill();
      c.strokeStyle = s.c(k);
      c.lineWidth = u * 0.3;
      c.stroke();
    });
  } else {
    const ps = Math.min(ch * 0.36, cw * 0.4);
    const px = cx - ps / 2;
    const py = y + u * 8.5;
    photo(s, PICK[5]!, px, py, ps, null);
    const lines = ['a dog on', 'the grass'];
    const n = Math.floor(clamp01(p * 1.6) * 17);
    const ty = py + ps + u * 3.4;
    const caret = p < 1 && Math.sin(t * 9) > 0 ? '|' : '';
    s.text(lines[0]!.slice(0, n) + (n < 8 ? caret : ''), cx, ty, { size: 2.9, font: 'mono', color: s.c('purple') });
    if (n > 8) s.text(lines[1]!.slice(0, n - 8) + caret, cx, ty + u * 4, { size: 2.9, font: 'mono', color: s.c('purple') });
  }
}

export const goal: SceneDef = {
  draw(s) {
    const { w, u, t } = s;
    const cols = 3;
    const gap = u * 3;
    const cw = Math.min(u * 40, (w - u * 10 - gap * (cols - 1)) / cols);
    const ch = u * 34;
    const x0 = w / 2 - (cols * cw + (cols - 1) * gap) / 2;
    const y0 = u * 15;
    const heading = s.ease('end', 0.6);
    s.alpha(heading, () => s.text('what you will build', w / 2, u * 8.5, { size: 4.2, font: 'display', weight: 600 }));
    const tags = s.ease('three', 0.6);
    for (let i = 0; i < 6; i++) {
      const x = x0 + (i % cols) * (cw + gap);
      const y = y0 + Math.floor(i / cols) * (ch + u * 6);
      const beat = BUILD_BEATS[i]!;
      const app = s.ease('end', 0.5, 0.25 * i);
      const fill = s.ease(beat, 0.6);
      const cur = s.since(beat) >= 0 && (i === 5 ? s.since('three') < 0 : s.since(BUILD_BEATS[i + 1]!) < 0) ? 1 : 0;
      const [tag, tk] = TAGS[i]!;
      const k: K = tags > 0 ? tk : '--ink-3';
      s.alpha(app, () => {
        if (fill <= 0) {
          s.ctx.save();
          s.ctx.setLineDash([u * 1, u * 0.8]);
          s.rrect(x, y, cw, ch, 2.4, { stroke: s.tint('--ink', 0.25), lw: 0.3 });
          s.ctx.restore();
          s.text(String(i + 1), x + cw / 2, y + ch / 2, { size: 5, font: 'display', color: s.c('--ink-3') });
          return;
        }
        s.alpha(fill, () => {
          const kk: K = tags > 0 ? tk : 'slate';
          s.rrect(x, y, cw, ch, 2.4, { fill: s.tint(kk, 0.05 + 0.07 * cur + 0.05 * tags), stroke: s.tint(kk, 0.35 + 0.55 * Math.max(cur, tags)), lw: 0.3 + 0.25 * cur });
          s.text(BUILD_NAMES[i]!, x + cw / 2, y + u * 5.2, { size: 3.3, font: 'ui', weight: 650, color: s.c(cur ? '--ink' : '--ink-2') });
          drawCard(s, i, x, y, cw, ch, t);
        });
      });
      s.alpha(tags * s.ease('three', 0.5, 0.4 + 0.5 * [0, 0, 0, 0, 1, 2][i]!), () => pill(s, tag, x + cw - u * 1.6, y + ch, k, { size: 2.8, align: 'right', fill: 0.2, opaque: true }));
    }
    // CIFAR-10's two numbers, under its card.
    s.alpha(s.win('cifar', 'knn'), () => {
      s.text('32 × 32 pixels', x0 + cw / 2, y0 + ch - u * 4, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
    });
  },
};
