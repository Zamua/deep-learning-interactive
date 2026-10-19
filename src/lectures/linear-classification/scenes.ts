import { fmt } from '../../core/code';
import { blobs, loadCifar } from '../../core/data';
import { softmax } from '../../core/nn';
import { CLASS_COLORS, rgbOf } from '../../core/plot';
import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { ACCURACY, HIST_CENTERED, HIST_RAW, MEAN_B64, SHIP_B64, SHIP_INIT, SHIP_TRAINED, TEMPLATES_B64 } from './cifar-data';
import { CIFAR10, CLS3, CLS3_COL, Frame, type Rect, area, bars3, box, bytes, drawTile, fitText, tile } from './draw';

// ---------------------------------------------------------------- shared data, built once

const SHIP = bytes(SHIP_B64);
const MEAN = bytes(MEAN_B64);
const TPL = TEMPLATES_B64.map(bytes);
const SHIP_IDX = 8;
const shipTile = tile(SHIP);
const meanTile = tile(MEAN);
const centeredTile = tile(SHIP, (v, ch, p) => (v - MEAN[ch * 1024 + p]!) / 2 + 128);
const tplTiles = TPL.map((t) => tile(t));
const productTile = tile(SHIP, (v, ch, p) => (v * TPL[SHIP_IDX]![ch * 1024 + p]!) / 255);
const channelTiles = [0, 1, 2].map((k) => tile(SHIP, (v, ch, p) => (ch === k ? SHIP[k * 1024 + p]! : 0)));

/** A 1 x 3072 strip of an image's values in reshape order, tinted by color channel. */
function strip(px: ArrayLike<number>): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 3072;
  const img = new ImageData(1, 3072);
  for (let d = 0; d < 3072; d++) {
    const v = px[d]!;
    const ch = Math.floor(d / 1024);
    img.data[d * 4] = ch === 0 ? v : v * 0.3;
    img.data[d * 4 + 1] = ch === 1 ? v : v * 0.3;
    img.data[d * 4 + 2] = ch === 2 ? v : v * 0.3;
    img.data[d * 4 + 3] = 255;
  }
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}
const shipStrip = strip(SHIP);

/** W as a 3072 x 10 image: `val(c, d)` in 0..255 for row c, column d, colored by `rgb`. */
function matrixImage(val: (c: number, d: number) => number, rgb: (v: number) => [number, number, number]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 3072;
  c.height = 10;
  const img = new ImageData(3072, 10);
  for (let r = 0; r < 10; r++)
    for (let d = 0; d < 3072; d++) {
      const [R, G, B] = rgb(val(r, d));
      const o = (r * 3072 + d) * 4;
      img.data[o] = R;
      img.data[o + 1] = G;
      img.data[o + 2] = B;
      img.data[o + 3] = 255;
    }
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}
const initRng = new Rng(2);
const randomW = matrixImage(
  () => initRng.randn(),
  (v) => (v > 0 ? [255 - Math.min(1, v / 2.2) * 200, 255 - Math.min(1, v / 2.2) * 130, 255] : [255, 255 - Math.min(1, -v / 2.2) * 170, 255 - Math.min(1, -v / 2.2) * 170]),
);
const templateW = matrixImage((c, d) => TPL[c]![d]!, (v) => [v, v, v]);

const SHIP_LOSS = -Math.log(softmax(SHIP_TRAINED)[SHIP_IDX]!);

// Nearest-neighbor thumbnails for the opening, once the CIFAR subset has loaded.
const knn: { thumbs: HTMLCanvasElement[]; nearest: number } = { thumbs: [], nearest: -1 };
loadCifar()
  .then(({ train }) => {
    const per = new Array(10).fill(0) as number[];
    const picks: number[] = [];
    for (let i = 0; i < train.n && picks.length < 24; i++) {
      const c = train.labels[i]!;
      if (per[c]! < (c < 4 ? 3 : 2)) {
        per[c]!++;
        picks.push(i);
      }
    }
    new Rng(9).shuffle(picks);
    let best = Infinity;
    picks.forEach((i, k) => {
      const px = train.pixels.subarray(i * 3072, i * 3072 + 3072);
      let d = 0;
      for (let q = 0; q < 3072; q++) d += Math.abs(px[q]! - SHIP[q]!);
      if (d < best) {
        best = d;
        knn.nearest = k;
      }
      knn.thumbs.push(tile(px));
    });
  })
  .catch(() => {});

/** Rounded label chip with a soft fill. */
function chipText(s: Scene, str: string, x: number, y: number, k: Color | `--${string}`, size = 3.4, align: 'left' | 'center' | 'right' = 'center'): void {
  const tw = s.measure(str, { size, font: 'ui', weight: 600 });
  const pad = s.u * 1.6;
  const x0 = align === 'center' ? x - tw / 2 - pad : align === 'left' ? x : x - tw - 2 * pad;
  s.rrect(x0, y - size * s.u * 0.85, tw + 2 * pad, size * s.u * 1.7, 2, { fill: s.tint(k, 0.14), stroke: s.tint(k, 0.6), lw: 0.3 });
  s.text(str, x0 + pad + tw / 2, y + s.u * 0.15, { size, font: 'ui', weight: 600, color: s.c(k) });
}

/** A check mark in a filled circle. */
function check(s: Scene, cx: number, cy: number, r: number, k: Color = 'green'): void {
  s.circle(cx, cy, r, { fill: s.c(k) });
  s.line(cx - r * 0.45, cy, cx - r * 0.1, cy + r * 0.35, '#fff', 0.45);
  s.line(cx - r * 0.1, cy + r * 0.35, cx + r * 0.5, cy - r * 0.35, '#fff', 0.45);
}

// ---------------------------------------------------------------- 1. intro

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'knn'), () => {
      fitText(s, 'Linear classifiers', w / 2, h * 0.44, w - 12 * u, { size: 10, font: 'display', weight: 600 });
      s.text('SVM and Softmax', w / 2, h * 0.58, { size: 5, italic: true, color: s.c('--ink-2') });
    });

    // Nearest neighbor: one new image against every stored one.
    const kA = s.win('knn', 'idea');
    if (kA > 0) {
      s.alpha(kA, () => {
        const gap = u * 1.2;
        const cell = Math.min((w * 0.6 - 5 * gap) / 6, (h * 0.56 - 3 * gap) / 4);
        const gw = 6 * cell + 5 * gap;
        const gx = w - 4 * u - gw - Math.max(0, (w - 112 * u) / 2);
        const gy = h * 0.16;
        const qs = Math.min(24 * u, gx - 14 * u);
        const qx = Math.max(4 * u, gx - qs - 12 * u - Math.max(0, (w - 112 * u) / 3));
        const qy = gy + (4 * cell + 3 * gap) / 2 - qs / 2;
        const p = s.prog('knn');
        const k = s.since('knn') < 0 ? -1 : Math.min(23, Math.floor(p * 1.25 * 24));
        const done = s.since('slow') >= 0 || p * 1.25 >= 1;
        for (let i = 0; i < 24; i++) {
          const x = gx + (i % 6) * (cell + gap);
          const y = gy + Math.floor(i / 6) * (cell + gap);
          if (i <= k && !done) s.line(qx + qs, qy + qs / 2, x + cell / 2, y + cell / 2, s.tint('slate', i === k ? 0.8 : 0.18), i === k ? 0.4 : 0.2);
          const best = done && i === knn.nearest;
          drawTile(s, knn.thumbs[i], x, y, cell, { stroke: best ? s.c('gold') : i === k ? s.c('--ink') : undefined, lw: best || i === k ? 0.7 : 0.3 });
        }
        if (done && knn.nearest >= 0) {
          const x = gx + (knn.nearest % 6) * (cell + gap);
          const y = gy + Math.floor(knn.nearest / 6) * (cell + gap);
          s.line(qx + qs, qy + qs / 2, x + cell / 2, y + cell / 2, s.c('gold'), 0.45, [1, 0.8]);
        }
        drawTile(s, shipTile, qx, qy, qs, { stroke: s.c('orange'), lw: 0.6 });
        s.text('new image', qx + qs / 2, qy + qs + 3.4 * u, { size: 3.4, color: s.c('orange'), weight: 600 });
        s.text('every training image, kept', gx + gw / 2, gy - 3 * u, { size: 3.2, color: s.c('--ink-3') });
        const ty = gy + 4 * cell + 3 * gap;
        s.alpha(s.ease('slow', 0.6), () => {
          fitText(s, 'each prediction compares against all of them', w / 2, ty + 7 * u, w - 10 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
          s.alpha(s.ease('slow', 0.6, 2.6), () => fitText(s, 'slow, and nothing is learned', w / 2, ty + 13 * u, w - 10 * u, { size: 3.8, italic: true, weight: 600, color: s.c('red') }));
        });
      });
    }

    // The recipe: score function, loss, and the search between them.
    const pA = s.ease('idea', 0.7);
    if (pA > 0) {
      s.alpha(pA, () => {
        const L0 = (w - 100 * u) / 2;
        const y1 = h * 0.3;
        const y2 = h * 0.7;
        const m = s.ease('learn', 2.6, 0.9);
        const vals = SHIP_INIT.map((v, i) => lerp(v, SHIP_TRAINED[i]!, m));
        const loss = lerp(-Math.log(0.1), SHIP_LOSS, m);
        const sA = 0.25 + 0.75 * s.ease('score', 0.6);
        const lA = 0.25 + 0.75 * s.ease('loss', 0.6);
        const minibars = (x0: number, wd: number, cy: number, hmax: number) => {
          const bw = wd / 10;
          s.line(x0, cy, x0 + wd, cy, s.c('--axis'), 0.25);
          vals.forEach((v, i) => {
            const bh = (v / 2.6) * hmax;
            s.rrect(x0 + i * bw + bw * 0.15, bh > 0 ? cy - bh : cy, bw * 0.7, Math.max(0.6, Math.abs(bh)), 0.3, { fill: s.tint('purple', i === SHIP_IDX ? 0.85 : 0.45) });
          });
        };
        // row 1: image -> W x + b -> ten scores
        drawTile(s, shipTile, L0, y1 - 8 * u, 16 * u, { stroke: s.c('orange'), lw: 0.5 });
        s.alpha(sA, () => {
          s.arrow(L0 + 18 * u, y1, L0 + 27 * u, y1, s.c('--ink-3'), 0.45);
          box(s, L0 + 43 * u, y1, 30 * u, 15 * u, 'W x + b', 'blue', { on: s.since('start') >= 0 ? 0.5 + 0.5 * Math.sin(s.since('start') * 4) : 0, size: 5 });
          s.arrow(L0 + 59 * u, y1, L0 + 68 * u, y1, s.c('--ink-3'), 0.45);
          minibars(L0 + 70 * u, 30 * u, y1 + 1.5 * u, 9 * u);
          s.text('10 scores', L0 + 85 * u, y1 + 10.5 * u, { size: 3, font: 'mono', color: s.c('purple') });
          s.alpha(1 - s.ease('start', 0.5), () => s.text('score function', L0 + 43 * u, y1 - 10.5 * u, { size: 3.6, weight: 600, color: s.c('blue') }));
          s.alpha(s.ease('start', 0.5, 0.3), () => s.text('one matrix multiply', L0 + 43 * u, y1 - 10.5 * u, { size: 3.6, weight: 600, color: s.c('blue') }));
        });
        // row 2: scores and y -> loss -> one number
        s.alpha(lA, () => {
          minibars(L0, 16 * u, y2 + 1 * u, 6 * u);
          s.text('y = ship', L0 + 8 * u, y2 + 8.5 * u, { size: 3, font: 'mono', weight: 600, color: s.c('gold') });
          s.arrow(L0 + 18 * u, y2, L0 + 27 * u, y2, s.c('--ink-3'), 0.45);
          box(s, L0 + 43 * u, y2, 30 * u, 15 * u, 'loss', 'red', { size: 5 });
          s.text('loss function', L0 + 43 * u, y2 - 10.5 * u, { size: 3.6, weight: 600, color: s.c('red') });
          s.arrow(L0 + 59 * u, y2, L0 + 68 * u, y2, s.c('--ink-3'), 0.45);
          s.rrect(L0 + 72 * u, y2 - 5.5 * u, 22 * u, 11 * u, 1.6, { fill: s.tint('red', 0.12), stroke: s.c('red') });
          s.text(loss.toFixed(2), L0 + 83 * u, y2 + 0.3 * u, { size: 5, font: 'mono', weight: 650, color: s.c('red') });
          s.text('one number', L0 + 83 * u, y2 + 9 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        });
        // the search: feed the loss back into W and b
        const fA = s.ease('learn', 0.6);
        s.alpha(fA, () => {
          const ym = (y1 + 7.5 * u + y2 - 7.5 * u) / 2 + 1 * u;
          const col = s.c('--accent');
          s.line(L0 + 83 * u, y2 - 6.5 * u, L0 + 83 * u, ym, col, 0.45, [1.2, 0.9]);
          s.line(L0 + 83 * u, ym, L0 + 43 * u, ym, col, 0.45, [1.2, 0.9]);
          s.arrow(L0 + 43 * u, ym, L0 + 43 * u, y1 + 8.5 * u, col, 0.45);
          s.text('adjust W, b', L0 + 63 * u, ym - 2.6 * u, { size: 3.2, weight: 600, color: col, halo: true });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 2. the score function

const score: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const L0 = (w - 104 * u) / 2;
    const lab = L0 + 11 * u;
    const Wx = L0 + 12 * u;
    const Ww = 34 * u;
    const xx = L0 + 52 * u;
    const bx = L0 + 62 * u;
    const sx = L0 + 72 * u;
    const zero = L0 + 92 * u;
    const rowH = 3.5 * u;
    const rowTop = h * 0.52 - 5 * rowH;
    const colTop = h * 0.14;
    const colH = h * 0.72;

    // The image, big at first, then parked above W as a thumbnail.
    const toThumb = s.ease('flat', 1.2);
    const S = Math.min(44 * u, w * 0.38);
    const bigX = w * 0.3 - S / 2;
    const bigY = h * 0.47 - S / 2;
    const tS = 16 * u;
    const tX = Wx;
    const tY = h * 0.09;
    const ix = lerp(bigX, tX, toThumb);
    const iy = lerp(bigY, tY, toThumb);
    const is = lerp(S, tS, toThumb);
    s.alpha(s.ease('img', 0.6), () => drawTile(s, shipTile, ix, iy, is, { stroke: s.c('orange'), lw: 0.5 }));
    const aA = 1 - toThumb;
    if (aA > 0) {
      const x0r = bigX + S + 6 * u;
      s.alpha(aA * s.ease('img', 0.6, 0.4), () => {
        s.text('32 × 32 pixels', x0r, h * 0.2, { size: 4.6, font: 'display', weight: 560, align: 'left' });
        s.text('red, green and blue in each', x0r, h * 0.27, { size: 3.2, color: s.c('--ink-2'), align: 'left' });
      });
      s.alpha(aA * s.ease('count', 0.6), () => {
        const ps = Math.min(16 * u, (w - x0r - 14 * u) * 0.7);
        const k: Color[] = ['red', 'green', 'blue'];
        channelTiles.forEach((c, i) => {
          const a = s.ease('count', 0.5, 0.3 + i * 0.4);
          s.alpha(a, () => {
            drawTile(s, c, x0r + i * 5 * u, h * 0.36 + i * 4 * u, ps, { stroke: s.c(k[i]!), lw: 0.5 });
          });
        });
        s.alpha(s.ease('count', 0.6, 1.8), () => {
          s.text('32 × 32 × 3', x0r, h * 0.36 + 8 * u + ps + 5 * u, { size: 3.8, font: 'mono', align: 'left', color: s.c('--ink-2') });
          s.text('= 3,072 numbers', x0r, h * 0.36 + 8 * u + ps + 11 * u, { size: 4.4, font: 'display', weight: 600, align: 'left', color: s.c('orange') });
        });
      });
    }

    // x: the image as one long column.
    const cA = s.ease('flat', 0.4, 0.6);
    if (cA > 0) {
      const rev = s.ease('flat', 1.8, 0.8);
      s.alpha(cA, () => {
        const c = s.ctx;
        c.save();
        c.beginPath();
        c.rect(xx - u, colTop - u, 6 * u, colH * rev + u);
        c.clip();
        c.imageSmoothingEnabled = true;
        c.drawImage(shipStrip, xx, colTop, 4 * u, colH);
        c.restore();
        s.rrect(xx, colTop, 4 * u, colH * rev, 0.6, { stroke: s.c('orange'), lw: 0.4 });
        s.text('x', xx + 2 * u, colTop - 3.2 * u, { size: 4.4, italic: true, weight: 600, color: s.c('orange') });
        s.alpha(rev, () => s.text('3,072', xx + 2 * u, colTop + colH + 3 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
        s.alpha(s.win('flat', 'W'), () => {
          s.arrow(tX + tS + 1.5 * u, tY + tS / 2, xx - 1.5 * u, colTop + 3 * u, s.c('--ink-3'), 0.4);
          s.text('reshape', (tX + tS + xx) / 2, tY + tS / 2 - 2.6 * u, { size: 3, font: 'mono', color: s.c('--ink-3'), halo: true });
        });
      });
    }

    // W, b and the scores, one row per class.
    const wantA = s.ease('want', 0.6);
    if (wantA > 0) {
      const sweep = s.since('mult') >= 0 ? Math.min(10, Math.floor(s.prog('mult') * 1.2 * 10)) : -1;
      const filled = (r: number) => s.since('b') >= 0 || (sweep >= 0 && r < sweep);
      const goal = s.ease('goal', 1.6, 0.6);
      const outA = s.ease('out', 0.6);
      const vals = SHIP_INIT.map((v, i) => lerp(v, SHIP_TRAINED[i]!, goal));
      const winRow = goal > 0.5;
      s.alpha(wantA, () => {
        CIFAR10.forEach((name, r) => {
          const y = rowTop + r * rowH + rowH / 2;
          const hot = winRow && r === SHIP_IDX;
          s.text(name, lab, y, { size: 2.9, font: 'mono', align: 'right', color: hot ? s.c('gold') : s.c('--ink-2'), weight: hot ? 700 : 500 });
          s.cell(sx, rowTop + r * rowH + 0.25 * u, 6 * u, rowH - 0.5 * u, '', 'purple', { on: r === sweep ? 1 : filled(r) ? 0.4 : 0 });
        });
        s.text('s', sx + 3 * u, rowTop - 3.2 * u, { size: 4.4, italic: true, weight: 600, color: s.c('purple') });
        s.text('=', L0 + 69.5 * u, rowTop + 5 * rowH, { size: 5, color: s.c('--ink-3') });
        s.alpha(1 - outA, () => s.text('?', zero, rowTop + 5 * rowH, { size: 6, font: 'display', color: s.c('--ink-3') }));
      });
      const wA = s.ease('W', 0.6);
      s.alpha(wA, () => {
        const c = s.ctx;
        c.save();
        c.imageSmoothingEnabled = false;
        c.globalAlpha *= 0.85;
        c.drawImage(randomW, Wx, rowTop, Ww, 10 * rowH);
        c.restore();
        s.rrect(Wx, rowTop, Ww, 10 * rowH, 0.5, { stroke: s.c('blue'), lw: 0.45 });
        s.text('W', Wx + Ww / 2, rowTop - 3.2 * u, { size: 4.4, italic: true, weight: 600, color: s.c('blue') });
        s.text('10 × 3,072', Wx + Ww / 2, rowTop + 10 * rowH + 3 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
        s.text('·', L0 + 49 * u, rowTop + 5 * rowH, { size: 6, color: s.c('--ink-3') });
        if (sweep >= 0 && sweep < 10) {
          s.rrect(Wx - 0.4 * u, rowTop + sweep * rowH, Ww + 0.8 * u, rowH, 0.6, { stroke: s.c('blue'), lw: 0.7 });
          s.rrect(xx - 0.4 * u, colTop, 4.8 * u, colH, 0.8, { stroke: s.c('orange'), lw: 0.7 });
        }
      });
      s.alpha(s.ease('b', 0.6), () => {
        s.text('+', L0 + 59.5 * u, rowTop + 5 * rowH, { size: 5, color: s.c('--ink-3') });
        CIFAR10.forEach((_, r) => s.cell(bx, rowTop + r * rowH + 0.25 * u, 4 * u, rowH - 0.5 * u, '', 'green', { on: s.since('b') < 1.5 ? 0.6 : 0.2 }));
        s.text('b', bx + 2 * u, rowTop - 3.2 * u, { size: 4.4, italic: true, weight: 600, color: s.c('green') });
      });
      // the scores as bars, tiny noise at first, then the trained answer
      s.alpha(outA, () => {
        s.line(zero, rowTop - u, zero, rowTop + 10 * rowH + u, s.c('--axis'), 0.3);
        vals.forEach((v, r) => {
          const len = (v / 2.6) * 11 * u;
          const hot = winRow && r === SHIP_IDX;
          s.rrect(len > 0 ? zero : zero + len, rowTop + r * rowH + 0.5 * u, Math.max(0.5, Math.abs(len)), rowH - u, 0.3, { fill: s.tint('purple', hot ? 0.85 : 0.45) });
        });
        s.alpha(1 - goal, () => s.text('all ≈ 0', zero, rowTop + 10 * rowH + 3 * u, { size: 2.8, font: 'mono', color: s.c('purple') }));
        s.alpha(goal, () => s.text('trained', zero, rowTop + 10 * rowH + 3 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('purple') }));
      });
      // parameters vs the given image
      const pA = s.win('params', 'fast');
      s.alpha(pA, () => {
        const pulse = 0.5 + 0.5 * Math.sin(s.since('params') * 4);
        s.rrect(Wx - u, rowTop - u, Ww + 2 * u, 10 * rowH + 2 * u, 1.2, { stroke: s.tint('blue', 0.5 + 0.5 * pulse), lw: 0.8 });
        s.rrect(bx - u, rowTop - u, 6 * u, 10 * rowH + 2 * u, 1.2, { stroke: s.tint('green', 0.5 + 0.5 * pulse), lw: 0.8 });
        chipText(s, 'parameters', Wx + Ww / 2, rowTop + 10 * rowH + 9 * u, 'blue', 3.2);
        chipText(s, 'given', xx + 2 * u, colTop + colH + 7.5 * u, 'orange', 3);
      });
      s.alpha(s.ease('fast', 0.6), () => {
        s.text('keep W and b only:', Wx + Ww / 2, rowTop + 10 * rowH + 9 * u, { size: 3.2, color: s.c('--ink-2') });
        s.text('30,730 numbers', Wx + Ww / 2, rowTop + 10 * rowH + 14 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('blue') });
      });
    }
  },
};

// ---------------------------------------------------------------- 3. by hand

const TOY_X = [56, 231, 24, 2];
const TOY_W = [
  [0.2, -0.5, 0.1, 2.0],
  [1.5, 1.3, 2.1, 0.0],
  [0.0, 0.25, 0.2, -0.3],
];
const TOY_B = [1.1, 3.2, -1.2];
const toyRow = (c: number, upto = 4) => TOY_W[c]!.slice(0, upto).reduce((a, wv, i) => a + wv * TOY_X[i]!, 0);
const TOY_S = [0, 1, 2].map((c) => toyRow(c) + TOY_B[c]!);
const num = (v: number) => fmt(Math.round(v * 100) / 100, 6).replace('-', '−');

const byHand: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cell = Math.min(9.6 * u, (w - 8 * u) / 10.9);
    const L0 = (w - 10.9 * cell) / 2;
    const top = h * 0.26;
    const xX = L0 + 4.5 * cell;
    const xh = (cell * 3) / 4;
    const bX = L0 + 5.95 * cell;
    const sX = L0 + 7.45 * cell;
    // the current step: row c, column i (i = 4 adds the bias)
    let st: { c: number; i: number } | null = null;
    let doneRows = 0;
    if (s.since('cat') >= 0) st = { c: 0, i: 0 };
    if (s.since('cat2') >= 0) st = { c: 0, i: 1 + Math.min(2, Math.floor(s.prog('cat2') * 3.3)) };
    if (s.since('catb') >= 0) st = { c: 0, i: 4 };
    if (s.since('rows') >= 0) {
      const p = s.prog('rows');
      doneRows = 1;
      st = p < 0.5 ? { c: 1, i: Math.min(4, Math.floor(p * 2 * 5.5)) } : { c: 2, i: Math.min(4, Math.floor((p - 0.5) * 2 * 5.5)) };
      if (p >= 0.5) doneRows = 2;
      if (p >= 0.97) {
        st = null;
        doneRows = 3;
      }
    }
    if (s.since('dot') >= 0) {
      st = null;
      doneRows = 3;
    }
    if (st && st.c === 0 && st.i === 4) doneRows = 1;
    if (st && st.i === 4) doneRows = st.c + 1;
    const partial = st ? toyRow(st.c, Math.min(st.i + 1, 4)) : 0;
    s.slot('c', st ? st.c : doneRows >= 3 ? 2 : 0);
    s.slot('total', st ? num(partial).replace('−', '-') : doneRows >= 3 ? fmt(toyRow(2), 6) : 0);
    const vote = s.since('vote') >= 0 && s.since('neg') < 0;
    const neg = s.since('neg') >= 0;
    const wrong = s.since('wrong') >= 0;

    const labA = s.ease('three', 0.6);
    // column labels
    s.alpha(labA, () => s.text('W', L0 + 2 * cell, top - 3.6 * u, { size: 4.4, italic: true, weight: 600, color: s.c('blue') }));
    s.text('x', xX + cell * 0.45, top - 3.6 * u, { size: 4.4, italic: true, weight: 600, color: s.c('orange') });
    // W
    s.alpha(labA, () => {
      for (let c = 0; c < 3; c++)
        for (let i = 0; i < 4; i++) {
          const v = TOY_W[c]![i]!;
          let on = st && st.c === c && st.i === i ? 1 : 0;
          if (vote && v >= 1.3) on = 0.8;
          if (neg && c === 0 && i === 1) on = 1;
          const dim = (st && st.c !== c) || (vote && v < 1.3) || (neg && !(c === 0 && i === 1));
          s.alpha(dim ? 0.45 : 1, () => s.cell(L0 + i * cell + 0.15 * u, top + c * cell + 0.15 * u, cell - 0.3 * u, cell - 0.3 * u, String(v), 'blue', { on, size: Math.min(3.6, (cell / u) * 0.36) }));
        }
    });
    // x, as a column the height of W
    TOY_X.forEach((v, i) => {
      const on = (st && st.i === i) || (neg && i === 1) ? 1 : 0;
      s.cell(xX, top + i * xh + 0.15 * u, cell * 0.9, xh - 0.3 * u, String(v), 'orange', { on, size: Math.min(3.4, (cell / u) * 0.34) });
    });
    // + b
    s.alpha(labA, () => {
      s.text('+', L0 + 5.62 * cell, top + cell * 1.5, { size: 5, color: s.c('--ink-3') });
      s.text('b', bX + cell * 0.45, top - 3.6 * u, { size: 4.4, italic: true, weight: 600, color: s.c('green') });
      for (let c = 0; c < 3; c++) s.cell(bX, top + c * cell + 0.15 * u, cell * 0.9, cell - 0.3 * u, String(TOY_B[c]), 'green', { on: st && st.c === c && st.i === 4 ? 1 : 0, size: Math.min(3.4, (cell / u) * 0.34) });
      s.text('=', L0 + 7.12 * cell, top + cell * 1.5, { size: 5, color: s.c('--ink-3') });
      s.text('s', sX + cell * 0.72, top - 3.6 * u, { size: 4.4, italic: true, weight: 600, color: s.c('purple') });
      for (let c = 0; c < 3; c++) {
        let val = '';
        if (c < doneRows) val = num(TOY_S[c]!);
        else if (st && st.c === c) val = `${num(partial)}…`;
        const winner = wrong && c === 1;
        s.cell(sX, top + c * cell + 0.15 * u, cell * 1.45, cell - 0.3 * u, val, winner ? 'orange' : 'purple', { on: (st && st.c === c) || winner ? 1 : 0, size: Math.min(3.4, (cell / u) * 0.3) });
        const truth = wrong && c === 0;
        s.text(CLS3[c]! + (truth ? ' ✓' : ''), sX + cell * 1.62, top + c * cell + cell / 2, { size: 3.4, align: 'left', weight: truth ? 700 : 450, color: truth ? s.c('gold') : s.c('--ink-2') });
      }
    });

    // the message line under the grid
    const my = top + 3 * cell + 7 * u;
    let msg = '';
    let sub = '';
    let col = s.c('--ink-2');
    let subCol = s.c('--ink-2');
    if (st && st.i < 4) msg = `W[${st.c},${st.i}] × x[${st.i}] = ${num(TOY_W[st.c]![st.i]!)} × ${TOY_X[st.i]} = ${num(TOY_W[st.c]![st.i]! * TOY_X[st.i]!)}`;
    else if (st) msg = `scores[${st.c}] = ${num(toyRow(st.c))} + ${num(TOY_B[st.c]!)} = ${num(TOY_S[st.c]!)}`;
    if (s.since('dot') >= 0) {
      msg = `W.dot(x) + b  →  [${TOY_S.map(num).join(', ')}]`;
      col = s.c('purple');
    }
    if (wrong) {
      msg = 'true class: cat';
      col = s.c('gold');
      sub = 'dog wins by a mile, cat comes last';
      subCol = s.c('red');
    }
    if (vote) {
      msg = 'big positive weights: 2, 1.5, 1.3, 2.1';
      col = s.c('blue');
      sub = 'a bright value here is a vote for my class';
      subCol = s.c('--ink-2');
    }
    if (neg) {
      msg = '−0.5 × 231 = −115.5';
      col = s.c('red');
      sub = 'the brightest pixel votes against cat';
      subCol = s.c('red');
    }
    if (msg) fitText(s, msg, w / 2, my, w - 8 * u, { size: 3.8, font: 'mono', weight: 600, color: col });
    if (sub) fitText(s, sub, w / 2, my + 6.5 * u, w - 8 * u, { size: 3.8, italic: true, color: subCol });

    // the four-pixel image itself
    s.alpha(s.win('toy', 'cat'), () => {
      const ps = Math.min(9 * u, cell);
      const gx = w / 2 - ps - 6 * u;
      const gy = my + 6 * u;
      TOY_X.forEach((v, i) => {
        s.ctx.fillStyle = `rgb(${v},${v},${v})`;
        s.ctx.fillRect(gx + (i % 2) * ps, gy + Math.floor(i / 2) * ps, ps, ps);
        s.text(String(v), gx + (i % 2) * ps + ps / 2, gy + Math.floor(i / 2) * ps + ps / 2, { size: 2.8, font: 'mono', color: v > 120 ? '#222' : '#eee' });
      });
      s.rrect(gx, gy, ps * 2, ps * 2, 0.4, { stroke: s.c('--rule'), lw: 0.3 });
      s.text('a 4-pixel image', gx + 2 * ps + 4 * u, gy + ps, { size: 3.4, italic: true, align: 'left', color: s.c('--ink-2') });
    });
  },
};

// ---------------------------------------------------------------- 4. geometry

const BLOBS = blobs(26, 3, 0.2, 11);
const FIELD = document.createElement('canvas');
FIELD.width = FIELD.height = 120;
const BASE_ANG = [0, 1, 2].map((c) => 0.6 + (c * 2 * Math.PI) / 3);
const WNORM = 2.2;
const BASE_B = -0.25;

const geometry: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const fr = new Frame(s, area(s, 0.1, 0.05), [-1.35, 1.35, -1.35, 1.35], true);
    let dth = 0;
    let b0 = BASE_B;
    if (s.since('turn') >= 0 && s.since('bias') < 0) dth = 0.7 * Math.sin(2 * Math.PI * clamp01(s.prog('turn') * 1.1));
    if (s.since('bias') >= 0 && s.since('all') < 0) b0 = BASE_B + 0.85 * Math.sin(2 * Math.PI * clamp01(s.prog('bias') * 1.1));
    const Wm = BASE_ANG.map((a, c) => [WNORM * Math.cos(a + (c === 0 ? dth : 0)), WNORM * Math.sin(a + (c === 0 ? dth : 0))] as [number, number]);
    const B = [b0, BASE_B, BASE_B];
    Wm.forEach(([a, b2], c) => {
      s.slot(`w${c}0`, fmt(Math.round(a * 100) / 100));
      s.slot(`w${c}1`, fmt(Math.round(b2 * 100) / 100));
      s.slot(`b${c}`, fmt(Math.round(B[c]! * 100) / 100));
    });
    const scoreAt = (x: number, y: number, c: number) => Wm[c]![0] * x + Wm[c]![1] * y + B[c]!;
    const argmax = (x: number, y: number) => {
      let k = 0;
      for (let c = 1; c < 3; c++) if (scoreAt(x, y, c) > scoreAt(x, y, k)) k = c;
      return k;
    };
    const [vx0, vx1, vy0, vy1] = fr.view;

    // decision regions
    const rA = s.ease('argmax', 0.9);
    if (rA > 0) {
      const [rx, ry, rw, rh] = fr.rect;
      const N = FIELD.width;
      const cols = CLASS_COLORS.slice(0, 3).map((k) => rgbOf(s.c(k)));
      const fctx = FIELD.getContext('2d')!;
      const img = fctx.createImageData(N, N);
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const [r, g, b2] = cols[argmax((rx + ((i + 0.5) / N) * rw - fr.ox) / fr.kx, (fr.oy - ry - ((j + 0.5) / N) * rh) / fr.ky)]!;
          const o = (j * N + i) * 4;
          img.data[o] = r;
          img.data[o + 1] = g;
          img.data[o + 2] = b2;
          img.data[o + 3] = 255;
        }
      fctx.putImageData(img, 0, 0);
      s.alpha(rA * 0.17, () => {
        s.ctx.save();
        s.ctx.imageSmoothingEnabled = true;
        s.ctx.drawImage(FIELD, rx, ry, rw, rh);
        s.ctx.restore();
      });
    }
    // class 0's half-planes
    const hA = s.win('zero', 'all');
    const line = (c: number) => {
      const [a, b2] = Wm[c]!;
      const n2 = a * a + b2 * b2;
      const fx = (-B[c]! * a) / n2;
      const fy = (-B[c]! * b2) / n2;
      const nn = Math.sqrt(n2);
      return { fx, fy, dx: -b2 / nn, dy: a / nn, nx: a / nn, ny: b2 / nn };
    };
    if (hA > 0) {
      const L = line(0);
      fr.clip(() => {
        const c = s.ctx;
        c.save();
        c.translate(fr.X(L.fx), fr.Y(L.fy));
        c.rotate(Math.atan2(-L.ny, L.nx));
        const big = Math.max(w, h) * 2;
        c.fillStyle = s.tint('blue', 0.12 * hA);
        c.fillRect(0, -big, big, 2 * big);
        c.fillStyle = s.tint('red', 0.06 * hA);
        c.fillRect(-big, -big, big, 2 * big);
        c.restore();
      });
    }
    fr.grid(0.5, 0.7);
    s.alpha(s.ease('two', 0.6), () => {
      s.text('x[0]', fr.X(vx1) - 1.5 * u, fr.Y(0) + 3 * u, { size: 3, font: 'mono', align: 'right', color: s.c('orange'), halo: true });
      s.text('x[1]', fr.X(0) + 1.5 * u, fr.Y(vy1) + 3 * u, { size: 3, font: 'mono', align: 'left', color: s.c('orange'), halo: true });
    });
    // region borders: rays from the triple point, opposite each class direction
    s.alpha(s.ease('regions', 0.8), () =>
      fr.clip(() => {
        for (let c = 0; c < 3; c++) {
          const a = BASE_ANG[c]! + Math.PI;
          s.line(fr.X(0), fr.Y(0), fr.X(2 * Math.cos(a)), fr.Y(2 * Math.sin(a)), s.c('--ink'), 0.55);
        }
      }),
    );
    // the points
    const colA = s.ease('two', 0.8);
    for (let i = 0; i < BLOBS.n; i++) {
      const k = BLOBS.y[i]!;
      const px = BLOBS.X[2 * i]!;
      const py = BLOBS.X[2 * i + 1]!;
      const col = colA > 0.5 ? s.c(CLASS_COLORS[k]!) : s.c('slate');
      s.alpha(s.ease('point', 0.4, (i % 13) * 0.08) * (0.55 + 0.45 * colA), () => fr.dot(px, py, 1.15, col));
    }
    // one image is one point
    s.alpha(s.win('point', 'zero'), () => {
      const ts = 13 * u;
      const tx = fr.X(-1.2);
      const ty = fr.Y(1.2);
      drawTile(s, shipTile, tx, ty, ts, { stroke: s.c('orange'), lw: 0.5 });
      s.arrow(tx + ts + 0.5 * u, ty + ts + 0.5 * u, fr.X(BLOBS.X[2]!) - 1.6 * u, fr.Y(BLOBS.X[3]!) - 1 * u, s.c('--ink-2'), 0.4);
      s.text('one image', tx + ts + 2.5 * u, ty + 2.5 * u, { size: 3.4, italic: true, align: 'left', color: s.c('--ink-2'), halo: true });
      s.text('= one point', tx + ts + 2.5 * u, ty + 7 * u, { size: 3.4, italic: true, align: 'left', color: s.c('--ink-2'), halo: true });
    });
    // lines and arrows
    const drawClass = (c: number, a: number, bold: boolean) =>
      s.alpha(a, () => {
        const L = line(c);
        const col = s.c(CLASS_COLORS[c]!);
        fr.clip(() => s.line(fr.X(L.fx - L.dx * 4), fr.Y(L.fy - L.dy * 4), fr.X(L.fx + L.dx * 4), fr.Y(L.fy + L.dy * 4), col, bold ? 0.6 : 0.45, [1.6, 1.1]));
        const aA = c === 0 ? s.ease('arrow', 0.7) : 1;
        s.alpha(aA, () => {
          const [wa, wb] = Wm[c]!;
          fr.arrow(L.fx, L.fy, L.fx + wa * 0.3, L.fy + wb * 0.3, col, bold ? 0.9 : 0.7);
          const tx = L.fx + wa * 0.39;
          const ty = L.fy + wb * 0.39;
          s.text(`W[${c}]`, fr.X(tx), fr.Y(ty), { size: 3.4, font: 'mono', weight: 650, color: col, halo: true });
        });
      });
    drawClass(0, s.ease('zero', 0.7), s.since('all') < 0);
    drawClass(1, s.ease('all', 0.6), false);
    drawClass(2, s.ease('all', 0.6, 0.3), false);
    // + and - labels for class 0
    // fixed spots in the empty corners, on the right side of the line for every pose it takes
    s.alpha(hA, () => {
      s.text('score > 0', fr.X(0.78), fr.Y(1.12), { size: 3.4, font: 'mono', weight: 600, color: s.c('blue'), halo: true });
      s.text('score < 0', fr.X(-0.82), fr.Y(-0.98), { size: 3.4, font: 'mono', weight: 600, color: s.c('red'), halo: true });
    });
    // the closing caption
    s.alpha(s.ease('walls', 0.6), () => {
      const str = 'flat walls, and nothing else';
      const tw = s.measure(str, { size: 3.8, weight: 600 }) + 6 * u;
      const cy = fr.rect[1] + fr.rect[3] - 5 * u;
      s.rrect(w / 2 - tw / 2, cy - 3.6 * u, tw, 7.2 * u, 1.6, { fill: s.tint('--card', 0.92), stroke: s.c('--rule') });
      s.text(str, w / 2, cy + 0.2 * u, { size: 3.8, weight: 600 });
    });
  },
};

// ---------------------------------------------------------------- 5. templates

const templates: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: W as ten gray rows; the ship row folds into a picture.
    const aA = s.win('second', 'line');
    if (aA > 0) {
      s.alpha(aA, () => {
        const bw = Math.min(78 * u, w - 26 * u);
        const bx = (w - bw) / 2 + 6 * u;
        const by = lerp(h * 0.36, h * 0.14, s.ease('fold', 0.8));
        const rh = 3 * u;
        const fold = s.ease('fold', 1.8, 0.8);
        const c = s.ctx;
        c.save();
        c.imageSmoothingEnabled = true;
        c.drawImage(templateW, bx, by, bw, 10 * rh);
        c.restore();
        s.rrect(bx, by, bw, 10 * rh, 0.5, { stroke: s.c('blue'), lw: 0.4 });
        CIFAR10.forEach((name, r) => s.text(name, bx - 1.5 * u, by + r * rh + rh / 2, { size: 2.6, font: 'mono', align: 'right', color: r === SHIP_IDX && s.since('fold') >= 0 ? s.c('gold') : s.c('--ink-3') }));
        s.text('W: 10 rows × 3,072 weights', bx + bw / 2, by - 3 * u, { size: 3.2, font: 'mono', color: s.c('blue') });
        if (s.since('fold') >= 0) {
          const T = Math.min(30 * u, h * 0.34);
          const tx = w / 2 - T / 2;
          const ty = h * 0.56;
          const x = lerp(bx, tx, fold);
          const y = lerp(by + SHIP_IDX * rh, ty, fold);
          const ww = lerp(bw, T, fold);
          const hh = lerp(rh, T, fold);
          s.rrect(bx - 0.4 * u, by + SHIP_IDX * rh, bw + 0.8 * u, rh, 0.4, { stroke: s.c('gold'), lw: 0.6 });
          c.save();
          c.globalAlpha *= 1 - smooth(fold * 1.4);
          c.drawImage(templateW, 0, SHIP_IDX, 3072, 1, x, y, ww, hh);
          c.restore();
          s.alpha(smooth(fold * 1.6 - 0.4), () => {
            c.save();
            c.imageSmoothingEnabled = true;
            c.drawImage(tplTiles[SHIP_IDX]!, x, y, ww, hh);
            c.restore();
            s.rrect(x, y, ww, hh, 0.5, { stroke: s.c('blue'), lw: 0.4 });
          });
          s.alpha(s.ease('fold', 0.6, 2.6), () => {
            s.text('W[8].reshape(3, 32, 32)', w / 2, ty + T + 4 * u, { size: 3.4, font: 'mono', color: s.c('blue') });
            s.text('the ship row, as a picture', w / 2, ty + T + 9.5 * u, { size: 3.4, italic: true, color: s.c('--ink-2') });
          });
        }
      });
    }
    // Phase 2: image times template, summed.
    const bA = s.win('line', 'tpl');
    if (bA > 0) {
      s.alpha(bA, () => {
        const T = Math.min(24 * u, (w - 40 * u) / 3.6);
        const gap = 8 * u;
        const total = 3 * T + 2 * gap + 22 * u;
        const x0 = (w - total) / 2;
        const cy = h * 0.42;
        const items: [HTMLCanvasElement, string, Color | '--ink'][] = [
          [shipTile, 'image x', 'orange'],
          [tplTiles[SHIP_IDX]!, 'ship template', 'blue'],
          [productTile, 'product', 'purple'],
        ];
        items.forEach(([c, label, k], i) => {
          const a = s.ease('line', 0.5, 0.2 + i * 0.9);
          s.alpha(a, () => {
            const x = x0 + i * (T + gap);
            drawTile(s, c, x, cy - T / 2, T, { smooth: i === 1, stroke: s.c(k), lw: 0.5 });
            s.text(label, x + T / 2, cy + T / 2 + 3.6 * u, { size: 3, color: s.c(k), weight: 600 });
            if (i > 0) s.text(i === 1 ? '×' : '=', x - gap / 2, cy, { size: 5, color: s.c('--ink-3') });
          });
        });
        s.alpha(s.ease('line', 0.6, 3.2), () => {
          const x = x0 + 3 * (T + gap) - gap + 3 * u;
          s.arrow(x, cy, x + 6 * u, cy, s.c('--ink-3'), 0.45);
          s.text('sum', x + 3 * u, cy - 3 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
          s.text(SHIP_TRAINED[SHIP_IDX]!.toFixed(2), x + 13.5 * u, cy, { size: 4.6, font: 'mono', weight: 650, color: s.c('purple') });
          s.text('score', x + 13.5 * u, cy + 5 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
        });
        s.alpha(s.ease('line', 0.6, 4.2), () =>
          fitText(s, 'bright where both are bright', w / 2, cy + T / 2 + 13 * u, w - 10 * u, { size: 3.8, italic: true, color: s.c('--ink-2') }),
        );
      });
    }
    // Phase 3 and 4: all ten templates, then the match.
    const cA = s.ease('tpl', 0.6);
    if (cA > 0) {
      s.alpha(cA, () => {
        const m = s.ease('match', 0.9);
        const gap = 3 * u;
        const T = Math.min((w - 8 * u - 4 * gap) / 5, (h * 0.66 - gap - 2 * 7 * u) / 2);
        const gw = 5 * T + 4 * gap;
        const gx = (w - gw) / 2;
        const gy = h * 0.12;
        const lit = (i: number): Color | null => {
          if (s.since('blue') >= 0 && s.since('green') < 0) return i === 0 || i === 8 ? 'blue' : null;
          if (s.since('green') >= 0 && s.since('horse') < 0) {
            if (i === 2 || i === 4 || i === 6) return 'green';
            if (i === 1 && s.prog('green') > 0.6) return 'red';
            return null;
          }
          if (s.since('horse') >= 0 && s.since('match') < 0) return i === 7 ? 'gold' : null;
          if (m > 0.5) return i === SHIP_IDX ? 'gold' : null;
          return null;
        };
        const anyLit = CIFAR10.some((_, i) => lit(i));
        const sc = SHIP_TRAINED;
        CIFAR10.forEach((name, i) => {
          const x = gx + (i % 5) * (T + gap);
          const y = gy + Math.floor(i / 5) * (T + 7 * u + gap);
          const a = s.ease('tpl', 0.5, 0.15 * i);
          const k = lit(i);
          s.alpha(a * (anyLit && !k ? 0.4 : 1), () => {
            drawTile(s, tplTiles[i], x, y, T, { smooth: true, stroke: k ? s.c(k) : undefined, lw: k ? 0.9 : 0.3 });
            s.text(name, x + T / 2, y + T + 3 * u, { size: 3, color: k ? s.c(k) : s.c('--ink-2'), weight: k ? 700 : 450 });
          });
          s.alpha(a * m, () => {
            const best = i === SHIP_IDX;
            s.text(sc[i]!.toFixed(2), x + T / 2, y + T + 6.6 * u, { size: 2.8, font: 'mono', weight: best ? 700 : 500, color: best ? s.c('purple') : s.c('--ink-3') });
          });
        });
        const by = gy + 2 * (T + 7 * u + gap) + 2 * u;
        s.alpha(s.win('horse', 'match'), () => {
          fitText(s, 'left-facing and right-facing horses share one picture', w / 2, by + 4 * u, w - 10 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
        });
        s.alpha(s.win('learned', 'blue'), () => {
          fitText(s, 'each tile: one row of W, stretched to full brightness', w / 2, by + 4 * u, w - 10 * u, { size: 3.4, italic: true, color: s.c('--ink-3') });
        });
        s.alpha(m * (1 - s.ease('acc', 0.5)), () => {
          const ts = Math.min(16 * u, h - by - 6 * u);
          const tx = w / 2 - ts - 4 * u;
          drawTile(s, shipTile, tx, by, ts, { stroke: s.c('orange'), lw: 0.5 });
          s.text('our ship', tx + ts + 4 * u, by + ts * 0.3, { size: 3.4, align: 'left', color: s.c('orange'), weight: 600 });
          s.text('best match: ship', tx + ts + 4 * u, by + ts * 0.72, { size: 3.6, align: 'left', font: 'mono', weight: 650, color: s.c('gold') });
        });
        s.alpha(s.ease('acc', 0.6), () => {
          const bwid = Math.min(60 * u, w - 40 * u);
          const x0 = w / 2 - bwid / 2 + 8 * u;
          const rows: [string, number, Color | '--ink-3'][] = [
            ['test', ACCURACY.test, 'purple'],
            ['guess', 0.1, '--ink-3'],
          ];
          rows.forEach(([lab, v, k], i) => {
            const y = by + 3 * u + i * 7 * u;
            s.text(lab, x0 - 2 * u, y, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-2') });
            s.rrect(x0, y - 2 * u, bwid - 16 * u, 4 * u, 0.6, { fill: s.tint('slate', 0.12) });
            s.rrect(x0, y - 2 * u, (bwid - 16 * u) * v * s.ease('acc', 1, 0.3 + i * 0.4), 4 * u, 0.6, { fill: s.tint(k, 0.7) });
            s.text(`${Math.round(v * 100)}%`, x0 + (bwid - 16 * u) * v + 2 * u, y, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c(k) });
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 6. bias trick and centering

const biasTrick: SceneDef = {
  marks: {
    eq: { tex: String.raw`\symW\symx + \symb \;=\; \begin{bmatrix}\symW & \symb\end{bmatrix}\begin{bmatrix}\symx \\ 1\end{bmatrix}`, x: 0.5, y: 0.13, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const aA = s.win('clumsy', 'raw');
    if (aA > 0) {
      s.alpha(aA, () => {
        const cw = Math.min(9 * u, (w - 8 * u) / 12.6);
        const ch = cw * 0.72;
        const L0 = (w - 12.6 * cw) / 2;
        const cy = h * 0.5;
        const one = s.ease('one', 0.8, 0.3);
        const glue = s.ease('col', 1.2, 0.3);
        const xRows = 4 + one;
        const xTop = cy - (xRows * ch) / 2;
        const wTop = cy - 1.5 * ch;
        const why = s.since('why') >= 0;
        // W, with b sliding in as its last column
        s.text(glue > 0.5 ? 'W1' : 'W', L0 + 2 * cw + glue * 0.5 * cw, wTop - 3.6 * u, { size: 4.2, italic: true, weight: 600, color: s.c('blue') });
        for (let c = 0; c < 3; c++)
          for (let i = 0; i < 4; i++)
            s.alpha(why ? 0.45 : 1, () => s.cell(L0 + i * cw + 0.1 * u, wTop + c * ch + 0.1 * u, cw - 0.2 * u, ch - 0.2 * u, String(TOY_W[c]![i]), 'blue', { size: Math.min(3.2, (cw / u) * 0.33) }));
        const bx = lerp(L0 + 8.6 * cw, L0 + 4 * cw, glue);
        for (let c = 0; c < 3; c++) s.cell(bx + 0.1 * u, wTop + c * ch + 0.1 * u, cw - 0.2 * u, ch - 0.2 * u, String(TOY_B[c]), 'green', { on: why ? 1 : glue > 0 && glue < 1 ? 0.6 : 0, size: Math.min(3.2, (cw / u) * 0.33) });
        s.alpha(1 - glue, () => {
          s.text('b', bx + cw / 2, wTop - 3.6 * u, { size: 4.2, italic: true, weight: 600, color: s.c('green') });
          s.text('+', L0 + 7.95 * cw, cy, { size: 5, color: s.c('--ink-3') });
        });
        // x, gaining a trailing 1
        const xx = L0 + 6.2 * cw;
        s.text('·', L0 + 5.6 * cw, cy, { size: 6, color: s.c('--ink-3') });
        s.text(one > 0.5 ? 'x1' : 'x', xx + cw / 2, xTop - 3.6 * u, { size: 4.2, italic: true, weight: 600, color: s.c('orange') });
        TOY_X.forEach((v, i) => s.alpha(why ? 0.45 : 1, () => s.cell(xx + 0.1 * u, xTop + i * ch + 0.1 * u, cw - 0.2 * u, ch - 0.2 * u, String(v), 'orange', { size: Math.min(3.2, (cw / u) * 0.33) })));
        s.alpha(one, () => s.cell(xx + 0.1 * u, xTop + 4 * ch + 0.1 * u, cw - 0.2 * u, ch - 0.2 * u, '1', 'gold', { on: why ? 1 : 0.6, size: Math.min(3.4, (cw / u) * 0.36) }));
        // = scores, unchanged
        const sx = L0 + 10.7 * cw;
        s.text('=', L0 + 10.1 * cw, cy, { size: 5, color: s.c('--ink-3') });
        s.text('s', sx + 0.95 * cw, wTop - 3.6 * u, { size: 4.2, italic: true, weight: 600, color: s.c('purple') });
        for (let c = 0; c < 3; c++) s.cell(sx, wTop + c * ch + 0.1 * u, cw * 1.9, ch - 0.2 * u, num(TOY_S[c]!), 'purple', { on: s.since('same') >= 0 ? 0.6 : 0, size: Math.min(3.2, (cw / u) * 0.3) });
        // messages
        const my = cy + 3.6 * ch + 4 * u;
        s.alpha(s.win('why', 'same'), () => fitText(s, 'last column × 1:  1.1 × 1 = 1.1, the bias, added', w / 2, my, w - 8 * u, { size: 3.6, font: 'mono', weight: 550, color: s.c('green') }));
        s.alpha(s.ease('same', 0.5), () => {
          fitText(s, 'W1.dot(x1) == W.dot(x) + b', w / 2, my, w - 8 * u, { size: 3.8, font: 'mono', weight: 600, color: s.c('purple') });
          fitText(s, 'real sizes: W1 is (10, 3073), x1 is (3073,)', w / 2, my + 6.5 * u, w - 8 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        });
        s.show('eq', aA * s.ease('col', 0.6, 1.4));
      });
    }
    // Centering and scaling.
    const bA = s.ease('raw', 0.6);
    if (bA > 0) {
      s.alpha(bA, () => {
        const T = Math.min(20 * u, (w - 40 * u) / 3);
        const gap = 8 * u;
        const tx0 = (w - (3 * T + 2 * gap)) / 2;
        const ty = h * 0.07;
        const cA = s.ease('center', 0.6);
        drawTile(s, shipTile, tx0, ty, T, { stroke: s.c('orange'), lw: 0.5 });
        s.text('image', tx0 + T / 2, ty + T + 3.2 * u, { size: 3, color: s.c('orange'), weight: 600 });
        s.alpha(cA, () => {
          s.text('−', tx0 + T + gap / 2, ty + T / 2, { size: 5, color: s.c('--ink-3') });
          drawTile(s, meanTile, tx0 + T + gap, ty, T, { smooth: false });
          s.text('mean image', tx0 + 1.5 * T + gap, ty + T + 3.2 * u, { size: 3, color: s.c('--ink-2'), weight: 600 });
        });
        s.alpha(s.ease('center', 0.6, 1.6), () => {
          s.text('=', tx0 + 2 * T + 1.5 * gap, ty + T / 2, { size: 5, color: s.c('--ink-3') });
          drawTile(s, centeredTile, tx0 + 2 * T + 2 * gap, ty, T, { stroke: s.c('purple'), lw: 0.5 });
          s.text('centered', tx0 + 2.5 * T + 2 * gap, ty + T + 3.2 * u, { size: 3, color: s.c('purple'), weight: 600 });
        });
        // histogram of every training pixel value
        const fr = new Frame(s, [6 * u, h * 0.5, w - 12 * u, h * 0.36], [-270, 270, 0, 1]);
        const rawMax = Math.max(...HIST_RAW) / 8;
        const cenMax = Math.max(...HIST_CENTERED) / 16;
        const top = Math.max(rawMax, cenMax) * 1.05;
        const shift = lerp(0, -118, s.ease('center', 1.4, 0.4));
        const mix = s.ease('center', 1.2, 1);
        s.line(fr.X(-270), fr.Y(0), fr.X(270), fr.Y(0), s.c('--axis'), 0.4);
        s.alpha(1 - mix, () =>
          HIST_RAW.forEach((n, i) => {
            const d = n / 8 / top;
            s.ctx.fillStyle = s.tint('orange', 0.5);
            s.ctx.fillRect(fr.X(i * 8 + shift) + 0.5, fr.Y(d), fr.kx * 8 - 1, fr.Y(0) - fr.Y(d));
          }),
        );
        s.alpha(mix, () =>
          HIST_CENTERED.forEach((n, i) => {
            const d = n / 16 / top;
            s.ctx.fillStyle = s.tint('purple', 0.5);
            s.ctx.fillRect(fr.X(-256 + i * 16) + 0.5, fr.Y(d), fr.kx * 16 - 1, fr.Y(0) - fr.Y(d));
          }),
        );
        const sc = s.ease('scale', 0.8, 0.6);
        const ticks: [number, string, string][] = [
          [-255, '−255', '−1'],
          [0, '0', '0'],
          [255, '255', '1'],
        ];
        ticks.forEach(([v, a, b2]) => {
          s.line(fr.X(v), fr.Y(0), fr.X(v), fr.Y(0) + 1.2 * u, s.c('--axis'), 0.35);
          s.alpha(1 - sc, () => s.text(a, fr.X(v), fr.Y(0) + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
          s.alpha(sc, () => s.text(b2, fr.X(v), fr.Y(0) + 4 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('purple') }));
        });
        s.text('pixel values, all training images', fr.X(-262), fr.Y(1) - 1 * u, { size: 3, align: 'left', color: s.c('--ink-3') });
        s.alpha(s.ease('around', 0.6), () => {
          s.text('negative', fr.X(-150), fr.Y(0.55), { size: 3.4, italic: true, color: s.c('red'), halo: true });
          s.text('positive', fr.X(150), fr.Y(0.55), { size: 3.4, italic: true, color: s.c('blue'), halo: true });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 7. grading

const BASE3 = [3.2, 5.1, -1.7];
const svmLoss = (v: number[], y = 0, delta = 1) => v.reduce((a, sv, j) => a + (j === y ? 0 : Math.max(0, sv - v[y]! + delta)), 0);
const ceLoss = (v: number[], y = 0) => -Math.log(softmax(v)[y]!);
const mix3 = (a: number[], b: number[], t: number) => a.map((v, i) => lerp(v, b[i]!, t));

const grading: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const L0 = (w - 102 * u) / 2;
    const fr = new Frame(s, [L0, h * 0.12, 44 * u, h * 0.66], [0, 3, -4.4, 7]);
    // scores: the example, a bad set, a good set, then a trained-ish set
    let v = BASE3;
    if (s.since('hilo') >= 0) {
      const p = s.prog('hilo');
      v = p < 0.5 ? mix3(BASE3, [-1.5, 5.5, 3], smooth(p * 3)) : mix3([-1.5, 5.5, 3], [6.2, 1, -2], smooth((p - 0.5) * 3));
    }
    if (s.since('train') >= 0) v = mix3(mix3([6.2, 1, -2], BASE3, s.ease('train', 0.8)), [5.6, 2.2, -1.2], s.ease('train', 2.2, 1.2));
    if (s.since('two') >= 0) v = mix3([5.6, 2.2, -1.2], BASE3, s.ease('two', 0.8));
    const loss = ceLoss(v);
    s.alpha(s.ease('have', 0.6), () => {
      s.line(fr.X(0), fr.Y(0), fr.X(3), fr.Y(0), s.c('--axis'), 0.35);
      bars3(s, fr, v, { correct: s.since('three') >= 0 ? 0 : undefined, values: s.ease('three', 0.5) });
    });
    const mx = L0 + 63 * u;
    const my = h * 0.42;
    s.alpha(s.ease('fn', 0.6), () => {
      s.arrow(L0 + 46 * u, my, mx - 12 * u, my, s.c('--ink-3'), 0.45);
      box(s, mx, my, 20 * u, 14 * u, 'loss', 'red', { size: 5 });
      s.text('y = cat', mx, my + 13 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('gold') });
      s.arrow(mx, my + 10.5 * u, mx, my + 8 * u, s.c('gold'), 0.4, 2);
      s.arrow(mx + 11 * u, my, mx + 17 * u, my, s.c('--ink-3'), 0.45);
      const nx = mx + 28 * u;
      s.rrect(nx - 10 * u, my - 6 * u, 20 * u, 12 * u, 1.6, { fill: s.tint('red', 0.12), stroke: s.c('red') });
      s.text(loss.toFixed(2), nx, my + 0.3 * u, { size: 5, font: 'mono', weight: 650, color: s.c('red') });
      s.text('one number', nx, my - 9 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      s.alpha(s.win('hilo', 'two'), () => {
        const hi = loss > 2;
        s.text(hi ? 'high: bad scores' : 'low: good scores', nx, my + 10 * u, { size: 3.4, weight: 650, color: hi ? s.c('red') : s.c('green') });
      });
      s.alpha(s.win('train', 'two'), () => {
        s.text('nudge W, b', nx, my + 16 * u, { size: 3.2, font: 'mono', color: s.c('--accent') });
      });
    });
    s.alpha(s.ease('two', 0.6, 1.2), () => {
      const cw = Math.min(46 * u, (w - 12 * u) / 2);
      const cy = h * 0.88;
      const cards: [string, string, Color][] = [
        ['SVM', `loss ${fmt(svmLoss(BASE3), 3)}`, 'red'],
        ['Softmax', `loss ${fmt(ceLoss(BASE3), 3)}`, 'teal'],
      ];
      cards.forEach(([t, sub, k], i) => {
        const x = w / 2 + (i === 0 ? -cw - 2 * u : 2 * u);
        s.rrect(x, cy - 5 * u, cw, 10 * u, 1.8, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.7) });
        s.text(t, x + 4 * u, cy, { size: 4.2, font: 'display', weight: 600, align: 'left', color: s.c(k) });
        s.text(sub, x + cw - 3 * u, cy, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-2') });
      });
    });
  },
};

// ---------------------------------------------------------------- 8. SVM

const svm: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL_i = \sum_{j \ne \symy_i} \max\!\big(0,\; \syms_j - \syms_{\symy_i} + \Delta\big)`, x: 0.5, y: 0.1, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    let c = 3.2;
    if (s.since('raise') >= 0) c = lerp(3.2, 6.3, smooth(s.prog('raise') * 1.1));
    const v = [c, 5.1, -1.7];
    const line = c - 1;
    const gaps = v.map((sv) => sv - c + 1);
    const m = gaps.map((g, j) => (j === 0 ? 0 : Math.max(0, g)));
    const loss = m[1]! + m[2]!;
    s.slot('c', fmt(Math.round(c * 10) / 10));
    s.slot('m0', 0);
    s.slot('m1', fmt(Math.round(m[1]! * 10) / 10));
    s.slot('m2', fmt(Math.round(m[2]! * 10) / 10));
    s.slot('loss', fmt(Math.round(loss * 10) / 10));
    const split = s.ease('hinge', 1);
    const full: Rect = [4 * u, h * 0.19, w - 8 * u, h * 0.77];
    const left: Rect = [4 * u, h * 0.19, (w - 8 * u) * 0.56, h * 0.77];
    const rect: Rect = full.map((q, i) => lerp(q, left[i]!, split)) as Rect;
    const fr = new Frame(s, rect, [0, 3, -3, 8.2]);
    s.line(fr.X(0), fr.Y(0), fr.X(3), fr.Y(0), s.c('--axis'), 0.35);
    // the margin line and the intrusions
    const lA = s.ease('line', 0.6);
    s.alpha(lA, () => {
      s.line(fr.X(0), fr.Y(c), fr.X(3), fr.Y(c), s.tint('gold', 0.9), 0.4, [0.8, 1]);
      s.line(fr.X(0), fr.Y(line), fr.X(3), fr.Y(line), s.c('red'), 0.45, [1.6, 1.1]);
      s.text('cat − Δ', fr.X(3) - u, fr.Y(line) + 2.8 * u, { size: 3.2, font: 'mono', align: 'right', color: s.c('red'), halo: true });
      const bxp = fr.X(3) - 1.2 * u;
      s.line(bxp, fr.Y(c), bxp, fr.Y(line), s.c('--ink-2'), 0.4);
      s.line(bxp - 0.8 * u, fr.Y(c), bxp, fr.Y(c), s.c('--ink-2'), 0.4);
      s.line(bxp - 0.8 * u, fr.Y(line), bxp, fr.Y(line), s.c('--ink-2'), 0.4);
      s.text('Δ', bxp - 1.6 * u, fr.Y(c - 0.5), { size: 3.4, align: 'right', color: s.c('--ink-2'), halo: true });
    });
    const dA = s.ease('intrude', 0.6);
    if (m[1]! > 0.001) {
      s.alpha(dA, () => {
        const x0 = fr.X(1.5 - 0.26);
        const x1 = fr.X(1.5 + 0.26);
        s.ctx.fillStyle = s.tint('red', 0.35);
        s.ctx.fillRect(x0, fr.Y(5.1), x1 - x0, fr.Y(line) - fr.Y(5.1));
        s.ctx.strokeStyle = s.c('red');
        s.ctx.lineWidth = 0.5 * u;
        s.ctx.strokeRect(x0, fr.Y(5.1), x1 - x0, fr.Y(line) - fr.Y(5.1));
      });
    }
    bars3(s, fr, v, { correct: 0, fmt: (q) => q.toFixed(1) });
    s.alpha(s.ease('dog', 0.6, 0.5), () => {
      if (m[1]! > 0.001) s.text(`+${m[1]!.toFixed(1)}`, fr.X(1.5) + fr.kx * 0.3, fr.Y((5.1 + line) / 2), { size: 3.6, font: 'mono', weight: 700, align: 'left', color: s.c('red'), halo: true });
    });
    s.alpha(s.ease('ship', 0.6, 0.4), () => {
      const x = fr.X(2.5) - fr.kx * 0.27;
      s.line(x, fr.Y(-1.7), x, fr.Y(line), s.c('green'), 0.35, [0.8, 0.8]);
      s.text(`${gaps[2]!.toFixed(1)} → 0`.replace('-', '−'), x - 1 * u, fr.Y(-0.9), { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('green'), halo: true });
    });
    s.alpha(s.win('self', 'sum'), () => {
      s.text('cat vs itself: margin set to 0', rect[0] + u, rect[1] + 3 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('gold'), halo: true });
    });
    // loss readout
    s.alpha(s.ease('sum', 0.6), () => {
      const ok = loss < 0.001;
      const col = ok ? s.c('green') : s.c('red');
      s.text(`loss = ${loss.toFixed(1)}`, rect[0] + rect[2] - u, rect[1] + 3 * u, { size: 4.4, font: 'mono', weight: 700, align: 'right', color: col, halo: true });
      if (s.since('happy') >= 0) s.alpha(s.ease('happy', 0.6, 0.6), () => s.text('satisfied', rect[0] + rect[2] - u, rect[1] + 8.5 * u, { size: 3.4, italic: true, align: 'right', color: s.c('green'), halo: true }));
    });
    // the hinge
    if (split > 0) {
      const hr: Rect = [4 * u + (w - 8 * u) * 0.62, h * 0.3, (w - 8 * u) * 0.38, h * 0.46];
      const hf = new Frame(s, hr, [-5, 4, -0.6, 4]);
      s.alpha(split, () => {
        hf.grid(1, 0.6);
        hf.fn((g) => Math.max(0, g), s.c('red'), 0.8);
        s.text('gap', hf.X(4) - u, hf.Y(0) + 3.4 * u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
        s.text('max(0, gap)', hf.X(-4.8), hf.Y(3.6), { size: 3, font: 'mono', align: 'left', color: s.c('red'), halo: true });
        s.text('hinge', hf.X(-2.5), hf.Y(0) - 3 * u, { size: 3.2, italic: true, color: s.c('--ink-2'), halo: true });
        hf.dot(Math.max(-4.8, gaps[2]!), 0, 1.3, s.c('green'));
        hf.dot(Math.max(-5, gaps[1]!), Math.max(0, gaps[1]!), 1.3, s.c('orange'));
      });
    }
    s.show('f', s.ease('formula', 0.6));
  },
};

// ---------------------------------------------------------------- 9. regularization

const REG_BASE = [4, 2.6, 0.8];

const regularization: SceneDef = {
  marks: {
    l2: { tex: String.raw`\symlam \sum_k \sum_l \symW_{k,l}^{\,2}`, x: 0.5, y: 0.17, size: 5.4 },
    full: { tex: String.raw`\symL = \underbrace{\frac{1}{N}\sum_{i=1}^{N} \symL_i}_{\text{data loss}} \;+\; \underbrace{\symlam \sum_{k}\sum_{l} \symW_{k,l}^{\,2}}_{\text{regularization}}`, x: 0.5, y: 0.2, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: scaling W keeps a zero loss.
    const aA = s.win('subtle', 'tie');
    if (aA > 0) {
      let k = 1;
      if (s.since('double') >= 0) k = lerp(1, 2, smooth(s.prog('double') * 2.4));
      s.slot('k', fmt(Math.round(k * 10) / 10));
      s.alpha(aA, () => {
        const fr = new Frame(s, [4 * u, h * 0.14, w - 8 * u, h * 0.8], [0, 3, -1.5, 9.6]);
        const v = REG_BASE.map((q) => q * k);
        const line = v[0]! - 1;
        s.line(fr.X(0), fr.Y(0), fr.X(3), fr.Y(0), s.c('--axis'), 0.35);
        s.line(fr.X(0), fr.Y(line), fr.X(3), fr.Y(line), s.c('red'), 0.45, [1.6, 1.1]);
        s.text('cat − Δ', fr.X(3) - u, fr.Y(line) + 2.8 * u, { size: 3.2, font: 'mono', align: 'right', color: s.c('red'), halo: true });
        bars3(s, fr, v, { correct: 0 });
        s.alpha(s.ease('zero', 0.6), () => {
          [1, 2].forEach((j) => {
            const x = fr.X(j + 0.5) - fr.kx * 0.27;
            s.line(x, fr.Y(v[j]!), x, fr.Y(line), s.c('green'), 0.35, [0.8, 0.8]);
            s.text(`${(v[j]! - line).toFixed(1)}`.replace('-', '−'), x - u, fr.Y((v[j]! + line) / 2), { size: 3, font: 'mono', align: 'right', color: s.c('green'), halo: true });
          });
          s.text(`${k > 1.05 ? `${fmt(Math.round(k * 10) / 10)} W` : 'W'}:  loss = 0`, fr.X(3) - u, fr.rect[1] + 3 * u, { size: 4.4, font: 'mono', weight: 700, align: 'right', color: s.c('green'), halo: true });
        });
        s.alpha(s.ease('double', 0.6, 4.2), () => s.text('10 W:  loss = 0 too', fr.X(3) - u, fr.rect[1] + 9 * u, { size: 3.6, font: 'mono', align: 'right', color: s.c('--ink-2'), halo: true }));
      });
    }
    // Phase 2: the penalty and the full loss.
    const bA = s.win('tie', 'square');
    if (bA > 0) {
      s.alpha(bA, () => {
        s.alpha(s.win('tie', 'l2'), () => {
          fitText(s, 'W and 2W: the loss cannot tell them apart', w / 2, h * 0.4, w - 10 * u, { size: 4, italic: true, color: s.c('--ink-2') });
          fitText(s, 'prefer small, spread-out weights', w / 2, h * 0.52, w - 10 * u, { size: 4.8, font: 'display', weight: 600 });
        });
        s.show('l2', bA * s.win('l2', 'full'));
        s.show('full', bA * s.ease('full', 0.6));
        // a weight grid where each weight is drawn as a square of its own area
        s.alpha(s.ease('l2', 0.6, 0.6), () => {
          const rng = new Rng(4);
          const rows = 4;
          const cols = 8;
          const cs = Math.min(9 * u, (w - 16 * u) / cols);
          const gx = (w - cols * cs) / 2;
          const gy = h * 0.45;
          for (let r = 0; r < rows; r++)
            for (let q = 0; q < cols; q++) {
              const v = rng.randn() * 0.5;
              const side = Math.min(1, Math.abs(v)) * cs * 0.9;
              const x = gx + q * cs + (cs - side) / 2;
              const y = gy + r * cs + (cs - side) / 2;
              s.rrect(gx + q * cs + 0.2 * u, gy + r * cs + 0.2 * u, cs - 0.4 * u, cs - 0.4 * u, 0.4, { stroke: s.tint('slate', 0.25), lw: 0.2 });
              s.rrect(x, y, side, side, 0.2, { fill: s.tint(v > 0 ? 'blue' : 'red', 0.6) });
            }
          s.text('each weight as a square: its area is W²', w / 2, gy + rows * cs + 4.5 * u, { size: 3.2, italic: true, color: s.c('--ink-2') });
        });
      });
    }
    // Phase 3: squaring favors many small weights.
    const cA = s.win('square', 'knob');
    if (cA > 0) {
      s.alpha(cA, () => {
        const pA = s.win('square', 'example');
        if (pA > 0) {
          const fr = new Frame(s, area(s, 0.12, 0.08), [-2.3, 2.3, -0.4, 4.8]);
          s.alpha(pA, () => {
            fr.grid(1, 0.6);
            fr.fn((x) => x * x, s.c('slate'), 0.8);
            s.text('penalty = weight²', fr.X(-2.2), fr.Y(4.4), { size: 3.4, font: 'mono', align: 'left', color: s.c('slate'), halo: true });
            [0.5, 1, 2].forEach((x, i) =>
              s.alpha(s.ease('square', 0.5, 0.6 + i * 0.6), () => {
                fr.dot(x, x * x, 1.3, s.c('blue'));
                s.text(`${fmt(x)} → ${fmt(x * x)}`, fr.X(x) + 2.5 * u, fr.Y(x * x) + 1.5 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('blue'), halo: true });
              }),
            );
          });
        }
        const eA = s.ease('example', 0.6);
        if (eA > 0) {
          s.alpha(eA, () => {
            const cw = Math.min(11 * u, (w - 48 * u) / 4);
            const ch = cw * 0.7;
            const x0 = (w - (4 * cw + 38 * u)) / 2 + 9 * u;
            const rowsY = [h * 0.16, h * 0.34, h * 0.6];
            const label = (t: string, y: number, k: Color) => s.text(t, x0 - 3 * u, y + ch / 2, { size: 4, italic: true, weight: 600, align: 'right', color: s.c(k) });
            label('x', rowsY[0]!, 'orange');
            [1, 1, 1, 1].forEach((v, i) => s.cell(x0 + i * cw, rowsY[0]!, cw - 0.4 * u, ch, String(v), 'orange', { size: Math.min(3.4, (cw / u) * 0.3) }));
            const groups: [string, number[], number][] = [
              ['w1', [1, 0, 0, 0], rowsY[1]!],
              ['w2', [0.25, 0.25, 0.25, 0.25], rowsY[2]!],
            ];
            const pk = s.ease('pick', 1, 0.3);
            groups.forEach(([name, vals, y], g) => {
              label(name, y, 'blue');
              vals.forEach((v, i) => {
                s.cell(x0 + i * cw, y, cw - 0.4 * u, ch, String(v), 'blue', { size: Math.min(3.4, (cw / u) * 0.3) });
                const side = v * cw * 0.95 * pk;
                if (side > 0.5) s.rrect(x0 + i * cw + (cw - 0.4 * u - side) / 2, y + ch + 1.2 * u, side, side, 0.2, { fill: s.tint('blue', 0.55) });
              });
              s.text('· x = 1', x0 + 4 * cw + 2 * u, y + ch / 2, { size: 3.4, font: 'mono', align: 'left', color: s.c('purple') });
              s.alpha(pk, () => {
                const sq = vals.reduce((a, q) => a + q * q, 0);
                s.text(`Σ w² = ${fmt(sq)}`, x0 + 4 * cw + 2 * u, y + ch + 5 * u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: g === 1 ? s.c('green') : s.c('--ink-2') });
                if (g === 1) check(s, x0 + 4 * cw + 2 * u + s.measure(`Σ w² = ${fmt(sq)}`, { size: 3.4, font: 'mono', weight: 650 }) + 4 * u, y + ch + 5 * u, 2 * u);
              });
            });
          });
        }
      });
    }
    // Phase 4: the knob, and what it touches.
    const dA = s.ease('knob', 0.6);
    if (dA > 0) {
      s.alpha(dA, () => {
        s.show('full', dA);
        const tw = Math.min(80 * u, w - 16 * u);
        const tx = (w - tw) / 2;
        const ty = h * 0.52;
        const kx = tx + tw * (0.5 + 0.38 * Math.sin(s.since('knob') * 1.3));
        s.rrect(tx, ty - 0.8 * u, tw, 1.6 * u, 0.8, { fill: s.tint('slate', 0.25) });
        s.circle(kx, ty, 2.6 * u, { fill: s.c('slate'), stroke: s.c('--card'), lw: 0.5 });
        s.text('λ', tx + tw / 2, ty - 6 * u, { size: 5, italic: true, weight: 600, color: s.c('slate') });
        s.text('small: fit the data', tx, ty + 6 * u, { size: 3.2, align: 'left', color: s.c('--ink-2') });
        s.text('large: small weights', tx + tw, ty + 6 * u, { size: 3.2, align: 'right', color: s.c('--ink-2') });
        s.alpha(s.ease('onlyW', 0.6), () => {
          chipText(s, 'W: penalized', w / 2 - 3 * u, h * 0.78, 'blue', 3.6, 'right');
          chipText(s, 'b: left alone', w / 2 + 3 * u, h * 0.78, 'green', 3.6, 'left');
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 10. softmax

const EXP3 = BASE3.map(Math.exp);
const P3 = softmax(BASE3);

function panels(s: Scene): [Rect, Rect, Rect] {
  const { w, h, u } = s;
  if (s.tall) {
    const pw = (w - 12 * u) / 2;
    return [
      [4 * u, h * 0.17, pw, h * 0.41],
      [8 * u + pw, h * 0.17, pw, h * 0.41],
      [4 * u, h * 0.62, w - 8 * u, h * 0.35],
    ];
  }
  const iw = w - 16 * u;
  return [
    [4 * u, h * 0.2, iw * 0.3, h * 0.74],
    [8 * u + iw * 0.3, h * 0.2, iw * 0.3, h * 0.74],
    [12 * u + iw * 0.6, h * 0.2, iw * 0.4, h * 0.74],
  ];
}

/** The probability pie, slices swept in by `sweep` (0..1), starting at 12 o'clock. */
function pie(s: Scene, cx: number, cy: number, r: number, probs: number[], sweep: number, hot = -1): void {
  let a0 = -Math.PI / 2;
  probs.forEach((q, i) => {
    const a1 = a0 + q * 2 * Math.PI * sweep;
    const c = s.ctx;
    c.beginPath();
    c.moveTo(cx, cy);
    c.arc(cx, cy, r, a0, Math.max(a0 + 0.0001, a1));
    c.closePath();
    c.fillStyle = s.tint(CLS3_COL[i]!, i === hot ? 0.9 : 0.6);
    c.fill();
    c.strokeStyle = s.c('--card');
    c.lineWidth = 0.4 * s.u;
    c.stroke();
    a0 = a1;
  });
  s.circle(cx, cy, r, { stroke: s.c('--rule'), lw: 0.3 });
}

const softmaxScene: SceneDef = {
  marks: {
    f: { tex: String.raw`\symp_k = \frac{e^{\syms_k}}{\sum_j e^{\syms_j}}`, x: 0.5, y: 0.085, size: 5.4 },
  },
  draw(s) {
    const { u } = s;
    const [P1, P2, P3r] = panels(s);
    const f1 = new Frame(s, [P1[0], P1[1] + 6 * u, P1[2], P1[3] - 6 * u], [0, 3, -4.4, 6.4]);
    const f2 = new Frame(s, [P2[0], P2[1] + 6 * u, P2[2], P2[3] - 6 * u], [0, 3, -20, 190]);
    const head = (r: Rect, t: string, k: Color | '--ink-2', a: number) => s.alpha(a, () => fitText(s, t, r[0] + r[2] / 2, r[1] + 1.5 * u, r[2], { size: 3.4, font: 'mono', weight: 650, color: s.c(k) }));
    // on a phone the third panel's heading sits beside the arrow coming down into it
    const p3head = (t: string, k: Color | '--ink-2', a: number) =>
      s.tall
        ? s.alpha(a, () => fitText(s, t, P2[0] + P2[2] - 4 * u, P3r[1] + 2.5 * u, P3r[2] * 0.6, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c(k) }))
        : head(P3r, t, k, a);
    // scores
    s.alpha(1, () => {
      s.line(f1.X(0), f1.Y(0), f1.X(3), f1.Y(0), s.c('--axis'), 0.35);
      bars3(s, f1, BASE3, { correct: undefined, fmt: (q) => q.toFixed(1) });
      head(P1, 'scores', 'purple', 1);
    });
    s.alpha(s.win('problem', 'divide'), () => {
      const cx = P3r[0] + P3r[2] / 2;
      const cy = P3r[1] + P3r[3] * 0.45;
      fitText(s, 'scores: any number at all', cx, cy - 4 * u, P3r[2] - 4 * u, { size: 3.6, color: s.c('purple') });
      fitText(s, 'probabilities: positive, summing to 1', cx, cy + 4 * u, P3r[2] - 4 * u, { size: 3.6, color: s.c('teal') });
    });
    // exps
    const eA = s.ease('exp', 0.6);
    s.alpha(s.ease('moves', 0.6), () => {
      head(P2, '1. exp', '--ink-2', 1 - eA);
      p3head('2. divide by the total', '--ink-2', 1 - s.ease('divide', 0.5));
    });
    s.alpha(eA, () => {
      head(P2, 'np.exp(scores)', 'purple', 1);
      s.line(f2.X(0), f2.Y(0), f2.X(3), f2.Y(0), s.c('--axis'), 0.35);
      const grow = s.ease('exp', 1.4, 0.6);
      bars3(s, f2, EXP3.map((v) => v * grow), {
        fmt: (q) => (q < 1 ? q.toFixed(2) : q.toFixed(1)),
        values: s.ease('pos', 0.5),
        dim: s.since('pos') >= 0 && s.since('bigger') < 0 ? [0.35, 0.35, 1] : undefined,
      });
      s.alpha(s.ease('bigger', 0.6, 1.4), () => {
        s.text('each +1:', f2.X(2.5), f2.Y(120), { size: 3, font: 'mono', color: s.c('--ink-3'), halo: true });
        s.text('×2.7', f2.X(2.5), f2.Y(120) + 4.5 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('--ink-2'), halo: true });
      });
    });
    // the arrows between panels
    s.alpha(s.ease('moves', 0.6), () => {
      if (s.tall) {
        s.arrow(P1[0] + P1[2] - 1 * u, f1.Y(1.5), P2[0] + 1 * u, f1.Y(1.5), s.c('--ink-3'), 0.4, 2.2);
        const ax = P2[0] + P2[2] - 1.5 * u;
        s.arrow(ax, P2[1] + P2[3] - 0.5 * u, ax, P3r[1] + 5 * u, s.c('--ink-3'), 0.4, 2.2);
      } else {
        s.arrow(P1[0] + P1[2] + 0.5 * u, P1[1] + P1[3] * 0.5, P2[0] - 0.5 * u, P1[1] + P1[3] * 0.5, s.c('--ink-3'), 0.4, 2.2);
        s.arrow(P2[0] + P2[2] + 0.5 * u, P2[1] + P2[3] * 0.5, P3r[0] - 0.5 * u, P2[1] + P2[3] * 0.5, s.c('--ink-3'), 0.4, 2.2);
      }
    });
    // the pie
    const dA = s.ease('divide', 0.6);
    s.alpha(dA, () => {
      p3head(`÷ ${EXP3.reduce((a, b) => a + b, 0).toFixed(1)}`, 'teal', 1);
      const r = Math.min(P3r[3] * 0.4, P3r[2] * (s.tall ? 0.2 : 0.36));
      const cx = s.tall ? P3r[0] + P3r[2] * 0.26 : P3r[0] + P3r[2] / 2;
      const cy = s.tall ? P3r[1] + P3r[3] * 0.55 : P3r[1] + r + 8 * u;
      pie(s, cx, cy, r, P3, s.ease('divide', 1.6, 0.6), s.since('sharp') >= 0 ? 1 : -1);
      const lx = s.tall ? P3r[0] + P3r[2] * 0.55 : P3r[0] + 2 * u;
      const ly0 = s.tall ? P3r[1] + P3r[3] * 0.4 : cy + r + 7 * u;
      s.alpha(s.ease('pie', 0.6), () => {
        P3.forEach((q, i) => {
          const y = ly0 + i * 5.6 * u;
          s.circle(lx + 1.2 * u, y, 1.2 * u, { fill: s.tint(CLS3_COL[i]!, 0.75) });
          const pct = q < 0.01 ? `${(q * 100).toFixed(1)}%` : `${Math.round(q * 100)}%`;
          s.text(`${CLS3[i]}`, lx + 4 * u, y, { size: 3.4, align: 'left', color: s.c('--ink-2') });
          s.text(pct, lx + 22 * u, y, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('teal') });
        });
      });
      s.alpha(s.ease('sharp', 0.6, 0.8), () => {
        const y = ly0 + 3 * 5.6 * u + 1 * u;
        fitText(s, 'lead 1.9 → 6.7 to 1', lx, y, s.tall ? P3r[0] + P3r[2] - lx : P3r[2] - 4 * u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('orange') });
      });
    });
    s.show('f', s.ease('formula', 0.6));
  },
};

// ---------------------------------------------------------------- 11. cross-entropy

const crossEntropy: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL_i = -\log \symp_{\symy_i}`, x: 0.72, y: 0.34, size: 5.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    const aA = 1 - s.ease('explode', 0.6);
    let p = 0.13;
    if (s.since('certain') >= 0) p = lerp(0.13, 1, smooth(s.prog('certain') * 1.6 - 0.3));
    if (s.since('half') >= 0) p = lerp(1, 0.5, smooth(s.prog('half') * 2));
    if (s.since('tiny') >= 0) p = lerp(0.5, 0.01, smooth(s.prog('tiny') * 2.2));
    if (s.since('never') >= 0) p = 1 - 0.1 * Math.pow(0.04, smooth(s.prog('never') * 1.2));
    if (s.since('never') >= 0 && s.prog('never') < 0.08) p = lerp(0.01, 0.9, s.prog('never') / 0.08);
    if (s.since('explode') >= 0) p = P3[0]!;
    const L = -Math.log(p);
    s.slot('p', p > 0.995 ? fmt(Math.round(p * 1000) / 1000, 4) : fmt(Math.round(p * 100) / 100));
    s.slot('loss', L < 0.1 ? fmt(Math.round(L * 1000) / 1000) : fmt(Math.round(L * 100) / 100));
    if (aA > 0) {
      s.alpha(aA, () => {
        // where the probability landed
        const bx = 6 * u;
        const bw = w - 12 * u;
        const by = h * 0.1;
        let x = bx;
        P3.forEach((q, i) => {
          const ww = q * bw;
          s.rrect(x, by, Math.max(0.5, ww), 6 * u, 0.4, { fill: s.tint(CLS3_COL[i]!, i === 0 ? 0.85 : 0.45) });
          x += ww;
        });
        s.rrect(bx, by, P3[0]! * bw, 6 * u, 0.4, { stroke: s.c('gold'), lw: 0.7 });
        s.text('cat ✓ 13%', bx + 1.5 * u, by + 10 * u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
        s.text('dog 87%', bx + bw - 1.5 * u, by + 10 * u, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-2') });
        // the -log curve
        const cA = s.ease('neglog', 0.6);
        const fr = new Frame(s, [6 * u, h * 0.3, w - 12 * u, h * 0.64], [0, 1.06, -0.25, 5.2]);
        s.alpha(cA, () => {
          fr.grid(1, 0.5, false);
          s.line(fr.X(0), fr.Y(0), fr.X(1.06), fr.Y(0), s.c('--axis'), 0.4);
          s.line(fr.X(0), fr.Y(-0.25), fr.X(0), fr.Y(5.2), s.c('--axis'), 0.4);
          fr.fn((q) => -Math.log(Math.max(q, 1e-4)), s.c('red'), 0.8, 0.0055, lerp(0.0055, 1, s.ease('neglog', 1.6, 0.4)));
          [0, 0.5, 1].forEach((q) => s.text(String(q), fr.X(q), fr.Y(0) + 3.4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
          s.text('p of the correct class', fr.X(0.53), fr.Y(0) + 7.4 * u, { size: 3, color: s.c('teal') });
          s.show('f', aA * cA);
          s.alpha(s.ease('ours', 0.5), () => {
            const right = p < 0.6;
            const str = `p = ${p > 0.995 ? p.toFixed(3) : p.toFixed(2)}, loss = ${L < 0.1 ? L.toFixed(3) : L.toFixed(2)}`;
            if (right) s.text(str, fr.X(p) + 3 * u, fr.Y(L) - 3.5 * u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
            else {
              // near p = 1 the curve hugs the axis, so the label sits well above it on a leader
              s.line(fr.X(p), fr.Y(L) - 1.8 * u, fr.X(p), fr.Y(1.25) + 1.5 * u, s.tint('red', 0.5), 0.3, [0.6, 0.6]);
              s.text(str, fr.X(p) + 1.5 * u, fr.Y(1.25), { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true });
            }
            fr.dot(p, L, 1.5, s.c('teal'));
          });
          s.alpha(s.ease('never', 0.6, 1.2), () => fitText(s, 'close to 0, never 0', fr.X(1.03), fr.Y(2.1), w * 0.5, { size: 3.4, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
        });
      });
    }
    // overflow, and the shift that prevents it
    const bA = s.ease('explode', 0.6);
    if (bA > 0) {
      s.alpha(bA, () => {
        s.alpha(1 - s.ease('shift', 0.6), () => {
          s.text('np.exp(1000)  →  inf', w / 2, h * 0.36, { size: 4.6, font: 'mono', weight: 600, color: s.c('red') });
          s.alpha(s.ease('explode', 0.6, 2.4), () => s.text('inf / inf  →  nan', w / 2, h * 0.48, { size: 4.6, font: 'mono', weight: 600, color: s.c('red') }));
          s.alpha(s.ease('explode', 0.6, 1.2), () => {
            fitText(s, 'e¹⁰⁰⁰ is about 10⁴³⁴,', w / 2, h * 0.64, w - 10 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
            fitText(s, 'and a float64 tops out near 10³⁰⁸', w / 2, h * 0.71, w - 10 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
          });
        });
        const sA = s.ease('shift', 0.6);
        if (sA > 0) {
          s.alpha(sA, () => {
            const fr = new Frame(s, [6 * u, h * 0.1, w - 12 * u, h * 0.5], [0, 3, -7.6, 6]);
            const sh = 5.1 * s.ease('shift', 1.6, 0.8);
            const v = BASE3.map((q) => q - sh);
            s.line(fr.X(0), fr.Y(0), fr.X(3), fr.Y(0), s.c('--axis'), 0.4);
            bars3(s, fr, v, { fmt: (q) => q.toFixed(1), nameY: fr.Y(0) - 3 * u, width: 0.36 });
            s.text(`scores − ${sh.toFixed(1)}`, fr.rect[0] + 1 * u, fr.rect[1] + 2 * u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true });
            s.alpha(s.ease('cancel', 0.6), () => {
              const sx = BASE3.map((q) => Math.exp(q - 5.1));
              const y0 = h * 0.7;
              fitText(s, `exps  = [${sx.map((q) => (q < 0.01 ? q.toFixed(4) : q.toFixed(2))).join(', ')}]`, w / 2, y0, w - 8 * u, { size: 3.6, font: 'mono', color: s.c('--ink') });
              fitText(s, 'largest: e⁰ = 1, nothing overflows', w / 2, y0 + 6.5 * u, w - 8 * u, { size: 3.4, italic: true, color: s.c('--ink-2') });
              s.alpha(s.ease('cancel', 0.6, 3.4), () =>
                fitText(s, `probs = [${P3.map((q) => (q < 0.01 ? q.toFixed(3) : q.toFixed(2))).join(', ')}]  unchanged`, w / 2, y0 + 14 * u, w - 8 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('teal') }),
              );
            });
          });
        }
      });
    }
  },
};

// ---------------------------------------------------------------- 12. SVM versus Softmax

const compare: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    let c = 3.2;
    if (s.since('svm') >= 0) c = lerp(3.2, 6.8, smooth(s.prog('svm') * 1.15));
    if (s.since('soft') >= 0) c = lerp(6.8, 10, smooth(s.prog('soft') * 1.15));
    const v = [c, 5.1, -1.7];
    const sv = svmLoss(v);
    const ce = ceLoss(v);
    s.slot('c', fmt(Math.round(c * 10) / 10));
    s.slot('svm', fmt(Math.round(sv * 100) / 100));
    s.slot('sm', fmt(Math.round(ce * 1000) / 1000));
    const aA = 1 - s.ease('read', 0.6);
    if (aA > 0) {
      s.alpha(aA, () => {
        const bf = new Frame(s, [4 * u, h * 0.06, w * 0.42, h * 0.44], [0, 3, -4.6, 10.6]);
        s.line(bf.X(0), bf.Y(0), bf.X(3), bf.Y(0), s.c('--axis'), 0.35);
        bars3(s, bf, v, { correct: 0, width: 0.4 });
        // readouts
        const rx = w - 6 * u;
        const show = s.ease('start', 0.6);
        s.alpha(show, () => {
          s.text('SVM loss', rx - 20 * u, h * 0.16, { size: 3.4, align: 'right', color: s.c('red') });
          s.text(sv.toFixed(2), rx, h * 0.16, { size: 4.6, font: 'mono', weight: 700, align: 'right', color: s.c('red') });
          s.text('softmax loss', rx - 20 * u, h * 0.27, { size: 3.4, align: 'right', color: s.c('teal') });
          s.text(ce.toFixed(ce < 0.1 ? 3 : 2), rx, h * 0.27, { size: 4.6, font: 'mono', weight: 700, align: 'right', color: s.c('teal') });
        });
        // both losses against the cat score
        const fr = new Frame(s, [10 * u, h * 0.56, w - 16 * u, h * 0.34], [2.8, 10.3, -0.2, 3.3]);
        s.alpha(s.ease('same', 0.6, 0.6), () => {
          s.line(fr.X(2.8), fr.Y(0), fr.X(10.3), fr.Y(0), s.c('--axis'), 0.4);
          s.line(fr.X(2.8), fr.Y(-0.2), fr.X(2.8), fr.Y(3.3), s.c('--axis'), 0.4);
          [4, 6, 8, 10].forEach((q) => s.text(String(q), fr.X(q), fr.Y(0) + 3.2 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
          s.text('cat score', fr.X(10.3), fr.Y(0) + 7 * u, { size: 3, align: 'right', color: s.c('blue') });
          s.text('loss', fr.X(2.8) - 1.5 * u, fr.Y(3.1), { size: 3, align: 'right', color: s.c('--ink-3') });
          s.line(fr.X(6.1), fr.Y(-0.2), fr.X(6.1), fr.Y(3.3), s.tint('red', 0.35), 0.3, [0.8, 0.8]);
          s.alpha(show, () => {
            fr.fn((q) => svmLoss([q, 5.1, -1.7]), s.c('red'), 0.75, 3.2, c);
            fr.fn((q) => ceLoss([q, 5.1, -1.7]), s.c('teal'), 0.75, 3.2, c);
            fr.dot(c, sv, 1.2, s.c('red'));
            fr.dot(c, ce, 1.2, s.c('teal'));
          });
          s.alpha(s.ease('svm', 0.6, 3), () => s.text('margin met', fr.X(6.1) + 1 * u, fr.Y(2.9), { size: 3, italic: true, align: 'left', color: s.c('red'), halo: true }));
        });
      });
    }
    // how each one reads the scores
    const bA = s.ease('read', 0.6);
    if (bA > 0) {
      s.alpha(bA, () => {
        const cw = (w - 12 * u) / 2;
        const top = h * 0.1;
        const ch = h * 0.8;
        const cols: [string, Color, [string, string, string][]][] = [
          ['SVM', 'red', [
            ['reads scores as', 'raw numbers', 'read'],
            ['happy when', 'the margin is met', 'read'],
            ['in practice', 'about as accurate', 'practice'],
          ]],
          ['Softmax', 'teal', [
            ['reads scores as', 'log-probabilities', 'prob'],
            ['happy when', 'p of correct ≈ 1', 'prob'],
            ['in practice', 'more common today', 'practice'],
          ]],
        ];
        cols.forEach(([t, k, rows], i) => {
          const x = 4 * u + i * (cw + 4 * u);
          s.rrect(x, top, cw, ch, 2, { fill: s.tint(k, 0.06), stroke: s.tint(k, 0.6) });
          s.text(t, x + cw / 2, top + 6 * u, { size: 5, font: 'display', weight: 600, color: s.c(k) });
          rows.forEach(([lab, val, beat], j) => {
            const y = top + 17 * u + j * (ch - 26 * u) / 3;
            s.alpha(s.ease(beat, 0.6, 0.4 + j * 0.5), () => {
              s.text(lab, x + 3 * u, y, { size: 3, align: 'left', color: s.c('--ink-3') });
              fitText(s, val, x + 3 * u, y + 5.5 * u, cw - 6 * u, { size: 3.8, align: 'left', weight: 600 });
            });
          });
        });
        s.alpha(s.ease('prob', 0.6, 3.5), () => {
          const x = 4 * u + cw + 4 * u;
          fitText(s, 'sharpness depends on λ', x + cw / 2, top + ch - 5 * u, cw - 6 * u, { size: 3.2, italic: true, color: s.c('slate') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 13. the recipe

const recipe: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const aA = 1 - s.ease('recap', 0.6);
    if (aA > 0) {
      s.alpha(aA, () => {
        s.alpha(s.ease('shape', 0.6), () => s.text('the recipe', w / 2, h * 0.11, { size: 5.6, font: 'display', weight: 600 }));
        const cards: [string, string, string, Color, string][] = [
          ['1', 'score function', 'W x + b', 'blue', 'one'],
          ['2', 'loss function', 'SVM or softmax, + λ', 'red', 'two'],
          ['3', 'optimization', 'next chapter', 'teal', 'three'],
        ];
        const tall = s.tall;
        const cw = tall ? w - 12 * u : (w - 16 * u) / 3;
        const chh = tall ? h * 0.22 : h * 0.5;
        cards.forEach(([n, t, sub, k, beat], i) => {
          const x = tall ? 6 * u : 4 * u + i * (cw + 4 * u);
          const y = tall ? h * 0.2 + i * (chh + 3 * u) : h * 0.28;
          const a = s.ease(beat, 0.6);
          s.alpha(0.25 + 0.75 * a, () => {
            s.rrect(x, y, cw, chh, 2, { fill: s.tint(k, 0.06 + 0.06 * a), stroke: s.tint(k, 0.35 + 0.5 * a) });
            const bx = x + (tall ? 8 * u : cw / 2);
            const by = y + (tall ? chh / 2 : 9 * u);
            s.circle(bx, by, 4 * u, { fill: s.c(k) });
            s.text(n, bx, by + 0.3 * u, { size: 4.4, font: 'mono', weight: 700, color: '#fff' });
            const tx = tall ? x + 16 * u : x + cw / 2;
            const al = tall ? 'left' : 'center';
            fitText(s, t, tx, tall ? y + chh * 0.36 : y + chh * 0.48, tall ? cw - 30 * u : cw - 6 * u, { size: 4.4, font: 'display', weight: 600, align: al });
            fitText(s, sub, tx, tall ? y + chh * 0.68 : y + chh * 0.66, tall ? cw - 30 * u : cw - 6 * u, { size: 3.6, font: 'mono', align: al, color: s.c(k) });
            if (i < 2 && s.since('three') >= 0) {
              s.alpha(s.ease('three', 0.5, 1.5), () => check(s, x + cw - 6 * u, tall ? y + chh / 2 : y + chh - 7 * u, 2.6 * u));
            }
          });
        });
      });
    }
    // the two readings of W
    const rA = s.win('recap', 'next');
    if (rA > 0) {
      s.alpha(rA, () => {
        const S = Math.min(34 * u, w * 0.3);
        const cy = h * 0.46;
        const lx = w / 2 - S - 6 * u;
        const rx = w / 2 + 6 * u;
        const fr = new Frame(s, [lx, cy - S / 2, S, S], [-1, 1, -1, 1], true);
        s.rrect(lx, cy - S / 2, S, S, 1, { stroke: s.c('--rule'), lw: 0.3 });
        fr.clip(() => {
          const c = s.ctx;
          c.fillStyle = s.tint('blue', 0.12);
          c.beginPath();
          c.moveTo(fr.X(-1), fr.Y(-0.4));
          c.lineTo(fr.X(1), fr.Y(0.6));
          c.lineTo(fr.X(1), fr.Y(1));
          c.lineTo(fr.X(-1), fr.Y(1));
          c.fill();
        });
        s.line(fr.X(-1), fr.Y(-0.4), fr.X(1), fr.Y(0.6), s.c('blue'), 0.6, [1.4, 1]);
        fr.arrow(0, 0.1, -0.22, 0.54, s.c('blue'), 0.8);
        s.text('a flat wall', lx + S / 2, cy + S / 2 + 4 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
        s.alpha(s.ease('recap', 0.6, 2.4), () => {
          drawTile(s, tplTiles[SHIP_IDX], rx, cy - S / 2, S, { smooth: true, stroke: s.c('blue'), lw: 0.5 });
          s.text('a template', rx + S / 2, cy + S / 2 + 4 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
        });
        s.text('each row of W', w / 2, cy - S / 2 - 6 * u, { size: 4.4, font: 'display', weight: 600, color: s.c('blue') });
      });
    }
    const nA = s.ease('next', 0.7, 0.3);
    s.alpha(nA, () => {
      fitText(s, 'next: optimization', w / 2, h * 0.4, w - 10 * u, { size: 6.4, font: 'display', weight: 600 });
      fitText(s, 'find the W that makes the loss small', w / 2, h * 0.53, w - 10 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('next', 0.6, 2.5), () => fitText(s, 'W -= learning_rate * dW', w / 2, h * 0.68, w - 10 * u, { size: 4.4, font: 'mono', weight: 600, color: s.c('teal') }));
    });
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  score,
  'by-hand': byHand,
  geometry,
  templates,
  'bias-trick': biasTrick,
  grading,
  svm,
  regularization,
  softmax: softmaxScene,
  'cross-entropy': crossEntropy,
  compare,
  recipe,
};

