import { CIFAR_CLASSES } from '../../core/data';
import { CLASS_COLORS, rgbOf } from '../../core/plot';
import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, lerp, smooth } from '../../lecture/scene';
import { cifar, distRow, firstPreds, nearestK, photo, stripCanvas } from './data';
import { Frame, area, pill } from './kit';
import { NN, Q, checkMark, crossMark, late } from './scenes-a';

const fmtInt = (v: number): string => Math.round(v).toLocaleString('en-US');

/** A 1024 x 1 strip from 3072 channel-major values, the flattened look of a derived image. */
const strips = new Map<string, HTMLCanvasElement>();
function stripOf(key: string, make: () => ArrayLike<number>): HTMLCanvasElement {
  let c = strips.get(key);
  if (c) return c;
  const vals = make();
  c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1;
  const img = new ImageData(1024, 1);
  for (let q = 0; q < 1024; q++) {
    for (let ch = 0; ch < 3; ch++) img.data[q * 4 + ch] = Math.max(0, Math.min(255, Math.round(vals[ch * 1024 + q]!)));
    img.data[q * 4 + 3] = 255;
  }
  c.getContext('2d')!.putImageData(img, 0, 0);
  strips.set(key, c);
  return c;
}
function drawStrip(s: Scene, c: HTMLCanvasElement, x: number, y: number, sw: number, sh: number, frame: string): void {
  const ctx = s.ctx;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, x, y, sw, sh);
  ctx.restore();
  ctx.strokeStyle = frame;
  ctx.lineWidth = Math.max(1, s.u * 0.22);
  ctx.strokeRect(x, y, sw, sh);
}

// ---------------------------------------------------------------- nn

const ROWS = [3, 4, 5, 6, 7, 8, 9, 10];

const nn: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const d = cifar(s);
    const mA = s.win('wrap', 'acc');
    if (mA > 0) {
      const m = Math.max(u * 4, w * 0.05);
      const qy = h * 0.15;
      const top = h * 0.3;
      const rh = (h * 0.93 - top) / ROWS.length;
      const th = rh * 0.84;
      const sx = m + th + u * 2;
      const sw = w * (tall ? 0.4 : 0.42);
      const labX = w - m;
      const bwMax = w - m - sx - u * (tall ? 30 : 34);
      const row = d ? distRow(d, Q, 'L1') : null;
      const shown = row ? ROWS.map((j) => row[j]!) : [];
      const dmax = shown.length ? Math.max(...shown) : 1;
      const jmin = row ? nearestK(row, 1)[0]! : NN;
      const sub = s.ease('broad', 1.4, 0.6);
      const coll = s.ease('axis', 1.0, 0.4);
      const pick = s.ease('argmin', 0.5, 0.6);
      const lab = s.ease('label', 0.5, 0.3);
      const name = d ? CIFAR_CLASSES[d.train.labels[jmin]!]! : 'cat';
      s.slot('j', s.since('argmin') >= 0 ? String(jmin) : '…');
      s.slot('lab', s.since('label') >= 0 ? `'${name}'` : '…');
      s.alpha(mA, () => {
        // The test image: one row of 3,072 numbers.
        photo(s, 'test', Q, m, qy - th / 2, th, s.c('orange'));
        if (d) drawStrip(s, stripCanvas(d.test, 'test', Q), sx, qy - th * 0.3, sw, th * 0.6, s.c('orange'));
        s.alpha(1 - lab, () => s.text(tall ? 'X[i]: test' : 'X[i]: one test image', sx + sw + u * 3, qy, { size: 3.4, align: 'left', color: s.c('orange'), weight: 600 }));
        s.alpha(lab, () => s.text(`prediction: ${name}`, sx + sw + u * 3, qy, { size: 3.4, align: 'left', color: s.c('green'), weight: 650 }));
        s.alpha(s.ease('train', 0.5) * (1 - coll), () => s.text(tall ? 'self.Xtr: one training image per row' : 'self.Xtr: every training image, one per row', m, top - u * 4, { size: 3.2, align: 'left', color: s.c('teal') }));
        s.alpha(coll, () => s.text(tall ? 'd: one distance per row' : 'd: each row summed, one distance per training image', m, top - u * 4, { size: 3.2, align: 'left', color: s.c('red') }));
        ROWS.forEach((j, r) => {
          const y = top + r * rh + rh / 2;
          const isMin = j === jmin;
          const dim = pick > 0 && !isMin ? 1 - 0.55 * pick : 1;
          s.alpha(s.ease('wrap', 0.4, 0.4 + r * 0.12) * dim, () => {
            photo(s, 'train', j, m, y - th / 2, th);
            if (!d) return;
            const diffA = smooth((sub - 0.55) / 0.45);
            s.alpha(1 - coll, () => {
              drawStrip(s, stripCanvas(d.train, 'train', j), sx, y - th * 0.3, sw, th * 0.6, s.c('--rule'));
              if (diffA > 0) {
                const strip = stripOf(`d-${j}`, () => Array.from({ length: 3072 }, (_, p) => Math.abs(d.train.pixels[j * 3072 + p]! - d.test.pixels[Q * 3072 + p]!)));
                s.alpha(diffA, () => drawStrip(s, strip, sx, y - th * 0.3, sw, th * 0.6, s.c('red')));
              }
            });
            // The test row, broadcast down over every training row at once.
            if (sub > 0 && sub < 1) {
              const yy = lerp(qy, y, smooth(sub / 0.6));
              s.alpha(0.55 * (1 - smooth((sub - 0.6) / 0.4)), () => drawStrip(s, stripCanvas(d.test, 'test', Q), sx, yy - th * 0.3, sw, th * 0.6, s.c('orange')));
            }
            // Each strip sums down to one bar: its distance.
            if (coll > 0 && row) {
              const len = Math.max(u, (row[j]! / dmax) * bwMax);
              const bl = lerp(sw, len, coll);
              s.alpha(coll, () => {
                s.rrect(sx, y - th * 0.28, bl, th * 0.56, 0.6, { fill: s.tint('red', isMin && pick > 0 ? 0.8 : 0.45) });
                s.text(fmtInt(row[j]!), sx + bl + u * 1.5, y, { size: tall ? 2.9 : 3.1, font: 'mono', align: 'left', color: s.c(isMin && pick > 0 ? 'red' : '--ink-2'), weight: isMin && pick > 0 ? 650 : 500 });
              });
            }
          });
          if (isMin && pick > 0 && row) {
            s.alpha(pick, () => s.rrect(m - u * 0.8, y - rh / 2 + u * 0.2, w - 2 * m + u * 1.6, rh - u * 0.4, 1, { stroke: s.c('red'), lw: 0.5 }));
            s.alpha(pick * (1 - lab), () => {
              s.text(`← argmin: ${j}`, labX, y, { size: 3.1, font: 'mono', align: 'right', color: s.c('red'), weight: 600 });
            });
          }
          if (isMin && lab > 0) s.alpha(lab, () => pill(s, name, labX, y, 'gold', { size: 3.4, font: 'serif', align: 'right', on: 1, solid: true }));
        });
      });
    }
    // Accuracy: the fraction of guesses that match.
    const aA = s.win('acc', 'result');
    if (aA > 0 && d) {
      const preds = firstPreds(d, 10);
      const cols = tall ? 5 : 10;
      const m = Math.max(u * 4, w * 0.05);
      const gap = u * 2;
      const t = Math.min((w - 2 * m - (cols - 1) * gap) / cols, h * (tall ? 0.18 : 0.2));
      const gx = (w - (cols * t + (cols - 1) * gap)) / 2;
      const gy = h * (tall ? 0.17 : 0.22);
      let right = 0;
      s.alpha(aA, () => {
        for (let i = 0; i < 10; i++) {
          const x = gx + (i % cols) * (t + gap);
          const y = gy + Math.floor(i / cols) * (t + u * 12);
          const ok = preds[i] === d.test.labels[i];
          if (ok) right++;
          s.alpha(s.ease('acc', 0.4, 0.3 + i * 0.12), () => {
            photo(s, 'test', i, x, y, t);
            s.text(CIFAR_CLASSES[preds[i]!]!, x + t / 2, y + t + u * 3, { size: 3, color: s.c(ok ? 'green' : 'red') });
            (ok ? checkMark : crossMark)(s, x + t - u * 1.2, y + u * 1.2, u * 1.7);
          });
        }
        const ry = gy + (tall ? 2 : 1) * (t + u * 12) + u * 3;
        s.alpha(late(s, 'acc', 0.55), () => {
          s.text('y_pred == y_test', w / 2, ry, { size: 3.6, font: 'mono', color: s.c('--ink-2') });
          s.text(`mean → ${right}/10 = ${(right / 10).toFixed(1)}`, w / 2, ry + u * 7, { size: tall ? 4.4 : 4.8, font: 'mono', weight: 650 });
        });
      });
    }
    // Where it lands.
    const rA = s.ease('result', 0.6);
    if (rA > 0) {
      const bars: [string, number, Color | '--ink-3', string][] = [
        ['guessing', 10, '--ink-3', 'result'],
        ['nearest neighbor (L1)', 38.6, 'red', 'result'],
        ['people', 94, 'green', 'compare'],
        ['convnets, 2016', 95, 'blue', 'compare'],
      ];
      const m = Math.max(u * 5, w * 0.06);
      const labW = tall ? 0 : w * 0.3;
      const x0 = m + labW;
      const bw = w - m - x0 - u * 14;
      const rowH = tall ? h * 0.17 : h * 0.15;
      const y0 = h * (tall ? 0.24 : 0.28);
      s.alpha(rA, () => {
        s.text('accuracy on CIFAR-10', w / 2, h * (tall ? 0.15 : 0.16), { size: tall ? 4 : 4.4, font: 'display', weight: 600 });
        bars.forEach(([name, v, k, b], i) => {
          const y = y0 + i * rowH;
          const delay = b === 'result' ? 0.3 + i * 1.6 : 0.3 + (i - 2) * 2.6;
          const a = s.ease(b, 0.6, delay);
          s.alpha(a, () => {
            const by = tall ? y + u * 3.4 : y;
            s.text(name, tall ? m : x0 - u * 2.5, tall ? y - u * 2.6 : y, { size: 3.4, align: tall ? 'left' : 'right', color: s.c('--ink-2') });
            s.rrect(x0, by - u * 2, bw, u * 4, 1, { fill: s.c('--paper-2') });
            s.rrect(x0, by - u * 2, (bw * v * a) / 100, u * 4, 1, { fill: s.tint(k, 0.7) });
            s.text(`${b === 'compare' ? '~' : ''}${v}%`, x0 + (bw * v * a) / 100 + u * 2, by, { size: 3.6, font: 'mono', weight: 650, align: 'left' });
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- l2

const Q2 = 35;

const l2: SceneDef = {
  marks: {
    d1: { tex: String.raw`\symd_1 = \sum_{p} \left| \sym{Ia}{I_1^{\,p}} - \sym{Ib}{I_2^{\,p}} \right|`, x: 0.5, y: 0.32, size: 5.2 },
    d2: { tex: String.raw`\symd_2 = \sqrt{\sum_{p} \left( \sym{Ia}{I_1^{\,p}} - \sym{Ib}{I_2^{\,p}} \right)^{2}}`, x: 0.5, y: 0.58, size: 6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const d = cifar(s);
    const fA = s.win('other', 'two');
    s.show('d1', fA * 0.55);
    s.show('d2', fA * s.ease('other', 0.6, 1.2));
    s.alpha(fA, () => {
      ['square', 'add up', 'square root'].forEach((t, i) =>
        s.alpha(late(s, 'recipe', 0.05 + i * 0.3, 0.4), () => pill(s, t, w / 2 + (i - 1) * u * (tall ? 24 : 26), h * 0.82, 'red', { size: 3.4, font: 'serif' })),
      );
      s.text('L1', w * 0.5 - u * (tall ? 34 : 40), h * 0.32, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
      s.alpha(s.ease('other', 0.6, 1.2), () => s.text('L2', w * 0.5 - u * (tall ? 34 : 40), h * 0.58, { size: 3.4, font: 'mono', color: s.c('red') }));
    });
    // Pythagoras: L1 walks the grid, L2 cuts across.
    const pA = s.win('two', 'squares');
    if (pA > 0) {
      const fr = new Frame(s, area(s, 0.12, 0.08), [-0.8, 4.8, -0.6, 4.6], true);
      const walk = s.ease('two', 1.6, 2.2);
      const cut = s.ease('two', 1.0, 5.2);
      s.alpha(pA, () => {
        fr.grid(1, 0.9, false);
        const c = s.ctx;
        c.beginPath();
        const pathLen = 7 * walk;
        c.moveTo(fr.X(0), fr.Y(0));
        c.lineTo(fr.X(Math.min(3, pathLen)), fr.Y(0));
        if (pathLen > 3) c.lineTo(fr.X(3), fr.Y(pathLen - 3));
        c.strokeStyle = s.c('slate');
        c.lineWidth = u * 0.7;
        c.setLineDash([u * 1.4, u * 1]);
        c.stroke();
        c.setLineDash([]);
        s.alpha(walk, () => {
          s.text('3', fr.X(1.5), fr.Y(0) + u * 4, { size: 3.6, font: 'mono', color: s.c('slate') });
          s.text('4', fr.X(3) + u * 3, fr.Y(2), { size: 3.6, font: 'mono', color: s.c('slate') });
        });
        s.alpha(cut, () => s.line(fr.X(0), fr.Y(0), fr.X(3 * cut), fr.Y(4 * cut), s.c('red'), 0.8));
        fr.dot(0, 0, 1.6, s.c('orange'));
        fr.dot(3, 4, 1.6, s.c('blue'));
        s.text('I₁', fr.X(0) - u * 3, fr.Y(0) + u * 3, { size: 3.6, color: s.c('orange'), weight: 600, halo: true });
        s.text('I₂', fr.X(3) + u * 3, fr.Y(4) - u * 2, { size: 3.6, color: s.c('blue'), weight: 600, halo: true });
        const lx = fr.X(-0.6);
        s.alpha(walk, () => s.text('L1 = 3 + 4 = 7', lx, fr.Y(4.2), { size: tall ? 3.6 : 4, font: 'mono', align: 'left', color: s.c('slate'), weight: 600, halo: true }));
        s.alpha(cut, () => s.text('L2 = √(3² + 4²) = 5', lx, fr.Y(3.6), { size: tall ? 3.6 : 4, font: 'mono', align: 'left', color: s.c('red'), weight: 600, halo: true }));
        s.alpha(late(s, 'two', 0.75), () => s.text('images: 3,072 directions', lx, fr.Y(3.0), { size: 3.3, align: 'left', italic: true, color: s.c('--ink-2'), halo: true }));
      });
    }
    // Squaring: same L1, very different L2.
    const qA = s.win('squares', 'real');
    if (qA > 0) {
      const many = s.win('squares', 'acc');
      s.alpha(qA, () => {
        s.alpha(many, () => {
          const panels: [string, number[], string, string][] = [
            ['ten gaps of 10', new Array(10).fill(10), 'L1 = 100', 'L2 = 31.6'],
            ['one gap of 100', [0, 0, 0, 0, 100, 0, 0, 0, 0, 0], 'L1 = 100', 'L2 = 100'],
          ];
          const pw = tall ? w * 0.42 : w * 0.36;
          const ph = h * 0.4;
          panels.forEach(([title, vals, a, b], i) => {
            const x0 = i === 0 ? w / 2 - pw - u * 4 : w / 2 + u * 4;
            const base = h * 0.66;
            const bw = pw / 10;
            s.alpha(s.ease('squares', 0.5, 0.4 + i * 2.6), () => {
              s.text(title, x0 + pw / 2, h * 0.2, { size: 3.6, weight: 600 });
              s.line(x0, base, x0 + pw, base, s.c('--axis'), 0.35);
              vals.forEach((v, k) => {
                if (!v) return;
                const bh = (v / 100) * ph;
                s.rrect(x0 + k * bw + bw * 0.15, base - bh, bw * 0.7, bh, 0.4, { fill: s.tint('red', 0.6) });
              });
              s.text(a, x0 + pw / 2, base + u * 5.5, { size: 3.6, font: 'mono', color: s.c('slate') });
              s.text(b, x0 + pw / 2, base + u * 11.5, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') });
            });
          });
        });
        s.alpha(s.ease('acc', 0.6), () => {
          const m = Math.max(u * 6, w * 0.1);
          const bw = w - 2 * m - u * 18;
          s.text('1-NN accuracy, full CIFAR-10', w / 2, h * 0.3, { size: tall ? 4 : 4.4, font: 'display', weight: 600 });
          ([['L1', 38.6, 'slate'], ['L2', 35.4, 'red']] as [string, number, Color][]).forEach(([t, v, k], i) => {
            const y = h * (0.46 + i * 0.16);
            s.text(t, m, y, { size: 3.8, font: 'mono', align: 'left', weight: 650, color: s.c(k) });
            s.rrect(m + u * 8, y - u * 2.2, bw, u * 4.4, 1, { fill: s.c('--paper-2') });
            s.rrect(m + u * 8, y - u * 2.2, (bw * v) / 100, u * 4.4, 1, { fill: s.tint(k, 0.7) });
            s.text(`${v}%`, m + u * 10 + (bw * v) / 100, y, { size: 3.8, font: 'mono', align: 'left', weight: 650 });
          });
        });
      });
    }
    // A real query and its ten nearest training images.
    const nA = s.ease('real', 0.6);
    if (nA > 0) {
      const useL1 = s.ease('swap', 0.8, 0.6);
      const metric = useL1 > 0.5 ? 'L1' : 'L2';
      s.slot('dline', metric === 'L1' ? 'np.sum(np.abs(diff), axis=1)' : 'np.sqrt(np.sum(diff ** 2, axis=1))');
      const m = Math.max(u * 4, w * 0.04);
      const Tq = tall ? Math.min(h * 0.3, w * 0.3) : Math.min(h * 0.42, w * 0.26);
      const qx = m;
      const qy = tall ? h * 0.13 : h * 0.22;
      const gx = tall ? m : qx + Tq + u * 8;
      const gy = tall ? qy + Tq + u * 6 : qy - u * 2;
      const gwid = w - m - gx;
      const gap = u * (tall ? 1.6 : 2);
      const t = Math.min((gwid - 4 * gap) / 5, tall ? h * 0.2 : h * 0.24);
      const labH = u * (tall ? 5 : 9);
      s.alpha(nA, () => {
        photo(s, 'test', Q2, qx, qy, Tq, s.c('orange'));
        const tx = tall ? qx + Tq + u * 4 : qx + Tq / 2;
        const ty = tall ? qy + u * 4 : qy + Tq + u * 4.5;
        const al: CanvasTextAlign = tall ? 'left' : 'center';
        s.text('test image: a cat', tx, ty, { size: 3.6, align: al, color: s.c('orange'), weight: 600 });
        s.text(`10 nearest of 1,000, by ${metric}`, tx, ty + u * 6, { size: 3.3, align: al, color: s.c('--ink-2') });
        if (!d) return;
        const rowA = distRow(d, Q2, 'L2');
        const rowB = distRow(d, Q2, 'L1');
        const nbA = nearestK(rowA, 10);
        const nbB = nearestK(rowB, 10);
        const draw = (nb: number[], row: Float64Array, a: number) =>
          s.alpha(a, () => {
            nb.forEach((j, k) => {
              const x = gx + (k % 5) * (t + gap);
              const y = gy + Math.floor(k / 5) * (t + labH + gap);
              s.alpha(s.ease('real', 0.35, 0.8 + k * 0.12), () => {
                photo(s, 'train', j, x, y, t);
                const lab = d.train.labels[j]!;
                const isCat = lab === 3;
                const none = s.ease('none', 0.5);
                s.text(CIFAR_CLASSES[lab]!, x + t / 2, y + t + u * 2.6, { size: tall ? 2.9 : 3.3, color: none > 0.5 ? s.c(isCat ? 'green' : 'red') : s.c('--ink-2'), weight: none > 0.5 ? 600 : 450 });
                if (!tall) s.text(fmtInt(row[j]!), x + t / 2, y + t + u * 6.6, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
                // Each image's average color.
                const wy = s.ease('why', 0.5, 0.8 + k * 0.08);
                if (wy > 0) {
                  let r = 0;
                  let g = 0;
                  let b = 0;
                  for (let q = 0; q < 1024; q++) {
                    r += d.train.pixels[j * 3072 + q]!;
                    g += d.train.pixels[j * 3072 + 1024 + q]!;
                    b += d.train.pixels[j * 3072 + 2048 + q]!;
                  }
                  const sw = t * 0.32;
                  s.alpha(wy, () => s.rrect(x + t - sw - u * 0.8, y + u * 0.8, sw, sw, 0.6, { fill: `rgb(${Math.round(r / 1024)},${Math.round(g / 1024)},${Math.round(b / 1024)})`, stroke: '#ffffff', lw: 0.35 }));
                }
              });
            });
          });
        draw(nbA, rowA, 1 - useL1);
        draw(nbB, rowB, useL1);
        const nb = metric === 'L1' ? nbB : nbA;
        const counts = new Map<string, number>();
        nb.forEach((j) => counts.set(CIFAR_CLASSES[d.train.labels[j]!]!, (counts.get(CIFAR_CLASSES[d.train.labels[j]!]!) ?? 0) + 1));
        s.slot('labs', [...counts].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${c} ${n}${c > 1 && n !== 'deer' ? 's' : ''}`).join(', '));
        const wy = s.ease('why', 0.5, 0.4);
        if (wy > 0) {
          let r = 0;
          let g = 0;
          let b = 0;
          for (let q = 0; q < 1024; q++) {
            r += d.test.pixels[Q2 * 3072 + q]!;
            g += d.test.pixels[Q2 * 3072 + 1024 + q]!;
            b += d.test.pixels[Q2 * 3072 + 2048 + q]!;
          }
          const sw = Tq * 0.3;
          s.alpha(wy, () => {
            s.rrect(qx + Tq - sw - u, qy + u, sw, sw, 0.8, { fill: `rgb(${Math.round(r / 1024)},${Math.round(g / 1024)},${Math.round(b / 1024)})`, stroke: '#ffffff', lw: 0.4 });
            s.text('average color', tall ? tx : qx + Tq / 2, tall ? ty + u * 12 : ty + u * 12, { size: 3, align: al, italic: true, color: s.c('--ink-3') });
          });
        }
      });
    }
  },
};

// ---------------------------------------------------------------- noloops

const noloops: SceneDef = {
  marks: {
    sc: { tex: String.raw`(\sym{Ia}{a} - \sym{Ib}{b})^2 = \sym{Ia}{a}^2 + \sym{Ib}{b}^2 - 2\sym{Ia}{a}\sym{Ib}{b}`, x: 0.5, y: 0.19, size: 5.4 },
    vec: { tex: String.raw`\lVert \sym{Ia}{a} - \sym{Ib}{b} \rVert^2 = \lVert \sym{Ia}{a} \rVert^2 + \lVert \sym{Ib}{b} \rVert^2 - 2\, \sym{Ia}{a} \cdot \sym{Ib}{b}`, x: 0.5, y: 0.19, size: 5.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const vec = late(s, 'expand', 0.55, 0.6);
    s.show('sc', s.ease('expand', 0.6) * (1 - vec));
    s.show('vec', vec);
    const tx0 = w * (tall ? 0.24 : 0.28);
    const tx1 = w * (tall ? 0.94 : 0.9);
    const ty0 = h * (tall ? 0.46 : 0.45);
    const ty1 = h * 0.9;
    const tw = tx1 - tx0;
    const th = ty1 - ty0;
    const colW = u * (tall ? 4.5 : 5);
    // The 200 x 1000 table of distances.
    s.rrect(tx0, ty0, tw, th, 0.8, { fill: s.c('--paper-2'), stroke: s.c('--rule') });
    s.text('1,000 training images', (tx0 + tx1) / 2, ty0 - u * (s.since('own') >= 0 ? 10 : 3.5), { size: 3.3, color: s.c('--ink-2') });
    s.text('200', tx0 - u * (s.since('own') >= 0 ? colW / u + 5 : 4), (ty0 + ty1) / 2 - u * 2.6, { size: 3.3, align: 'right', color: s.c('--ink-2') });
    s.text('test', tx0 - u * (s.since('own') >= 0 ? colW / u + 5 : 4), (ty0 + ty1) / 2 + u * 2.6, { size: 3.3, align: 'right', color: s.c('--ink-2') });
    // Two loops: one pair at a time.
    const slowA = 1 - s.ease('expand', 0.6);
    if (slowA > 0) {
      const n = 40;
      const cw = tw / n;
      const ch = th / 8;
      const p = s.since('slow') * 2.2;
      s.alpha(slowA, () => {
        for (let k = 0; k < Math.min(p, n * 8); k++) {
          const r = Math.floor(k / n);
          const c = k % n;
          s.ctx.fillStyle = s.tint('red', 0.35);
          s.ctx.fillRect(tx0 + c * cw + 0.5, ty0 + r * ch + 0.5, cw - 1, ch - 1);
        }
        s.text('two Python loops: one pair at a time', (tx0 + tx1) / 2, ty0 + th * 0.62, { size: 3.4, italic: true, color: s.c('--ink-2'), halo: true });
      });
    }
    // Each image's own sum of squares.
    const oA = s.ease('own', 0.6);
    s.alpha(oA, () => {
      s.rrect(tx0 - colW - u * 2, ty0, colW, th, 0.8, { fill: s.tint('orange', 0.22), stroke: s.c('orange') });
      s.rrect(tx0, ty0 - colW - u * 2, tw, colW, 0.8, { fill: s.tint('blue', 0.2), stroke: s.c('blue') });
      s.text('te (200,)', tx0 - colW - u * 2, ty1 + u * 4.5, { size: 3, font: 'mono', color: s.c('orange'), align: 'left' });
      s.text('tr (1000,)', tx1 - u * 2, ty0 - colW / 2 - u * 2, { size: 3, font: 'mono', color: s.c('blue'), align: 'right' });
    });
    // The cross term: one matrix product.
    const cA = s.ease('cross', 0.6, 0.4);
    s.alpha(cA * (1 - s.ease('broad', 0.6, 1.2)), () => {
      s.rrect(tx0 + u * 0.3, ty0 + u * 0.3, tw - u * 0.6, th - u * 0.6, 0.6, { fill: s.tint('purple', 0.18) });
      s.text('cross = Xte.dot(Xtr.T)', (tx0 + tx1) / 2, ty0 + th * 0.4, { size: tall ? 3.4 : 3.8, font: 'mono', weight: 600, color: s.c('purple'), halo: true });
      s.alpha(late(s, 'cross', 0.4), () =>
        s.text('(200, 3072) · (3072, 1000)', (tx0 + tx1) / 2, ty0 + th * 0.62, { size: tall ? 3.1 : 3.4, font: 'mono', color: s.c('--ink-2'), halo: true }),
      );
    });
    // Broadcasting fills the whole table at once.
    const bA = s.ease('broad', 0.8, 0.3);
    if (bA > 0) {
      s.alpha(bA, () => {
        const n = 5;
        for (let k = 0; k < n; k++) {
          const yy = ty0 + ((k + 0.5) / n) * th;
          s.arrow(tx0 - u * 1.5, yy, tx0 + tw * smooth(bA * 1.3 - k * 0.05), yy, s.tint('orange', 0.6), 0.35, 1.6);
          const xx = tx0 + ((k + 0.5) / n) * tw;
          s.arrow(xx, ty0 - u * 1.5, xx, ty0 + th * smooth(bA * 1.3 - k * 0.05), s.tint('blue', 0.6), 0.35, 1.6);
        }
      });
      const fA = s.ease('broad', 0.6, 1.4);
      s.alpha(fA, () => {
        s.rrect(tx0 + u * 0.3, ty0 + u * 0.3, tw - u * 0.6, th - u * 0.6, 0.6, { fill: s.tint('red', 0.2) });
        s.text('dists: (200, 1000), all at once', (tx0 + tx1) / 2, ty0 + th * 0.42, { size: tall ? 3.4 : 3.8, font: 'mono', weight: 600, color: s.c('red'), halo: true });
      });
      s.alpha(late(s, 'broad', 0.55), () => pill(s, '~100× faster than two loops', (tx0 + tx1) / 2, ty0 + th * 0.7, 'green', { size: tall ? 3.2 : 3.6, font: 'serif', on: 1, solid: true }));
    }
  },
};

// ---------------------------------------------------------------- knn

/** The chapter's 2-D toy set: three blobs plus three planted outliers. */
const PTS: [number, number, number][] = (() => {
  const rng = new Rng(21);
  const pts: [number, number, number][] = [];
  for (let c = 0; c < 3; c++) {
    const a = (c / 3) * Math.PI * 2 + 0.6;
    for (let i = 0; i < 12; i++) pts.push([0.58 * Math.cos(a) + rng.randn() * 0.2, 0.58 * Math.sin(a) + rng.randn() * 0.2, c]);
  }
  pts.push([-0.42, 0.22, 0], [0.5, 0.12, 2], [0.1, -0.45, 1]);
  return pts;
})();
const OUTLIERS = [36, 37, 38];
const QUERY: [number, number] = [-0.38, 0.19];
const GRID = 150;

function knnLabel(x: number, y: number, k: number, metric: 'L1' | 'L2'): number {
  const ds = PTS.map(([a, b, c]) => [metric === 'L1' ? Math.abs(a - x) + Math.abs(b - y) : (a - x) ** 2 + (b - y) ** 2, c] as [number, number]);
  ds.sort((p, q) => p[0] - q[0]);
  const v = [0, 0, 0];
  for (let t = 0; t < k; t++) v[ds[t]![1]]!++;
  const mx = Math.max(...v);
  return v.filter((c) => c === mx).length > 1 ? -1 : v.indexOf(mx);
}

const labelGrids = new Map<string, Int8Array>();
function labelGrid(k: number, metric: 'L1' | 'L2'): Int8Array {
  const key = `${k}-${metric}`;
  let g = labelGrids.get(key);
  if (g) return g;
  g = new Int8Array(GRID * GRID);
  for (let j = 0; j < GRID; j++)
    for (let i = 0; i < GRID; i++) g[j * GRID + i] = knnLabel(-1.1 + ((i + 0.5) * 2.2) / GRID, 1.1 - ((j + 0.5) * 2.2) / GRID, k, metric);
  labelGrids.set(key, g);
  return g;
}
const regionCanvases = new Map<string, HTMLCanvasElement>();
function regionCanvas(s: Scene, k: number, metric: 'L1' | 'L2'): HTMLCanvasElement {
  const cols = CLASS_COLORS.slice(0, 3).map((c) => rgbOf(s.c(c)));
  const key = `${k}-${metric}-${cols.flat().join(',')}`;
  let c = regionCanvases.get(key);
  if (c) return c;
  const g = labelGrid(k, metric);
  c = document.createElement('canvas');
  c.width = c.height = GRID;
  const img = new ImageData(GRID, GRID);
  for (let q = 0; q < GRID * GRID; q++) {
    const l = g[q]!;
    if (l < 0) continue;
    const [r, gg, b] = cols[l]!;
    img.data[q * 4] = r;
    img.data[q * 4 + 1] = gg;
    img.data[q * 4 + 2] = b;
    img.data[q * 4 + 3] = 80;
  }
  c.getContext('2d')!.putImageData(img, 0, 0);
  regionCanvases.set(key, c);
  return c;
}
/** The center of the densest patch of ties at k = 5. */
const TIE: [number, number] = (() => {
  const g = labelGrid(5, 'L2');
  let best = -1;
  let at: [number, number] = [0, 0];
  for (let j = 0; j < GRID; j++)
    for (let i = 0; i < GRID; i++) {
      if (g[j * GRID + i]! >= 0) continue;
      let n = 0;
      for (let dj = -6; dj <= 6; dj++) for (let di = -6; di <= 6; di++) if (g[Math.min(GRID - 1, Math.max(0, j + dj)) * GRID + Math.min(GRID - 1, Math.max(0, i + di))]! < 0) n++;
      if (n > best) {
        best = n;
        at = [-1.1 + ((i + 0.5) * 2.2) / GRID, 1.1 - ((j + 0.5) * 2.2) / GRID];
      }
    }
  return at;
})();

const knn: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const tall = s.tall;
    const [rx, ry, rw, rh] = area(s, 0.11, 0.04);
    const P = tall ? Math.min(rw, rh) : Math.min(rh, w * 0.58);
    const px0 = tall ? (w - P) / 2 : rx;
    const py0 = ry + (rh - P) / 2;
    const fr = new Frame(s, [px0, py0, P, P], [-1.1, 1.1, -1.1, 1.1], true);
    // Which regions: k and distance, by beat.
    let k = 1;
    let metric: 'L1' | 'L2' = 'L2';
    if (s.since('vote') >= 0 && s.since('plane') < 0) k = s.since('vote') > 1.2 ? 5 : 1;
    if (s.since('five') >= 0) k = s.since('five') > 0.6 ? 5 : 1;
    if (s.since('metric') >= 0) {
      k = 1;
      metric = s.since('metric') > 0.8 ? 'L1' : 'L2';
    }
    if (s.since('howbig') >= 0) {
      metric = 'L2';
      k = 1 + 2 * Math.min(7, Math.floor(s.prog('howbig') * 9));
    }
    s.slot('k', k);
    s.slot('dist', metric === 'L1' ? 'np.sum(np.abs(X - q), axis=1)' : 'np.sqrt(np.sum((X - q) ** 2, axis=1))');
    const regA = s.ease('plane', 0.8, 1.6);
    s.rrect(px0, py0, P, P, 0.8, { fill: s.c('--card'), stroke: s.c('--rule') });
    if (regA > 0) {
      const ctx = s.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(px0, py0, P * smooth(regA), P);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(regionCanvas(s, k, metric), px0, py0, P, P);
      ctx.restore();
    }
    fr.grid(0.5, 0.5, false);
    const colOf = (c: number) => s.c(CLASS_COLORS[c]!);
    const isl = s.win('islands', 'five');
    PTS.forEach(([x, y, c], i) => {
      s.alpha(s.ease('fragile', 0.4, 0.2 + (i % 13) * 0.04), () => fr.dot(x, y, 1.25, colOf(c)));
      if (isl > 0 && OUTLIERS.includes(i)) {
        const pulse = 1 + 0.15 * Math.sin(s.t * 5);
        s.alpha(isl, () => s.circle(fr.X(x), fr.Y(y), u * 3.6 * pulse, { stroke: s.c('--ink'), lw: 0.45 }));
      }
    });
    // The query and its neighbors: one is fragile, five vote.
    const qA = s.win('fragile', 'plane');
    if (qA > 0) {
      const ds = PTS.map(([x, y, c], i) => [Math.hypot(x - QUERY[0], y - QUERY[1]), c, i] as [number, number, number]).sort((a, b) => a[0] - b[0]);
      const five = s.ease('vote', 0.6, 1.2);
      const v = [0, 0, 0];
      ds.slice(0, 5).forEach(([, c]) => v[c]!++);
      const win = v.indexOf(Math.max(...v));
      const pred = s.since('win') >= 0 ? win : ds[0]![1];
      s.alpha(qA, () => {
        const nk = five > 0 ? 5 : 1;
        ds.slice(0, nk).forEach(([, , i], t) =>
          s.alpha(t === 0 ? s.ease('fragile', 0.5, 1) : five, () => s.line(fr.X(QUERY[0]), fr.Y(QUERY[1]), fr.X(PTS[i]![0]), fr.Y(PTS[i]![1]), s.c('--ink-2'), 0.35)),
        );
        s.alpha(five, () => s.circle(fr.X(QUERY[0]), fr.Y(QUERY[1]), ds[4]![0] * fr.kx + u * 1.5, { stroke: s.c('--ink-3'), lw: 0.3 }));
        const qc = s.ease('fragile', 0.5, 1) > 0 ? colOf(pred) : s.c('--ink');
        s.circle(fr.X(QUERY[0]), fr.Y(QUERY[1]), u * 2.2, { fill: s.c('--card'), stroke: qc, lw: 0.7 });
        s.circle(fr.X(QUERY[0]), fr.Y(QUERY[1]), u * 1, { fill: qc });
        s.text('new point', fr.X(QUERY[0]), fr.Y(QUERY[1]) - u * 5, { size: 3.2, halo: true, color: s.c('--ink-2') });
        s.alpha(s.win('odd', 'vote'), () => s.text('nearest: an odd one out', fr.X(PTS[36]![0]) + u * 2, fr.Y(PTS[36]![1]) + u * 6, { size: 3.2, align: 'left', italic: true, halo: true, color: s.c('blue') }));
        s.alpha(five, () => {
          const names = ['blue', 'orange', 'green'];
          const line = v.map((n, c) => [n, c] as const).filter(([n]) => n > 0).sort((a, b) => b[0] - a[0]).map(([n, c]) => `${names[c]} ${n}`).join(' · ');
          if (tall) s.text(`5 votes: ${line}`, fr.X(QUERY[0]), fr.Y(QUERY[1]) + u * 14, { size: 3.4, font: 'mono', weight: 600, halo: true });
          else {
            s.text('5 votes:', px0 + P + u * 7, py0 + u * 56, { size: 3.6, align: 'left', color: s.c('--ink-2') });
            s.text(line, px0 + P + u * 7, py0 + u * 62, { size: 3.6, font: 'mono', weight: 650, align: 'left' });
          }
        });
      });
    }
    s.alpha(s.win('ties', 'metric'), () => {
      s.arrow(fr.X(TIE[0]) + u * 9, fr.Y(TIE[1]) + u * 9, fr.X(TIE[0]) + u * 1.2, fr.Y(TIE[1]) + u * 1.2, s.c('--ink'), 0.45, 2);
      s.text('tie', fr.X(TIE[0]) + u * 10, fr.Y(TIE[1]) + u * 11, { size: 3.6, align: 'left', weight: 650, halo: true });
    });
    // Settings readout.
    const info = `k = ${k} · ${metric}`;
    s.alpha(tall ? s.ease('plane', 0.5, 1.2) : s.ease('fragile', 0.5, 0.4), () => {
      if (tall) {
        const bw = s.measure(info, { size: 3.6, font: 'mono' }) + u * 5;
        s.rrect(px0 + u * 2, py0 + P - u * 10, bw, u * 8, 1.4, { fill: s.tint('--card', 0.92), stroke: s.c('--rule') });
        s.text(info, px0 + u * 2 + bw / 2, py0 + P - u * 5.8, { size: 3.6, font: 'mono', weight: 650 });
      } else {
        const ix = px0 + P + u * 7;
        s.text(`k = ${k}`, ix, py0 + u * 8, { size: 6, font: 'mono', weight: 650, align: 'left', color: s.c('slate') });
        s.text(`distance: ${metric}`, ix, py0 + u * 17, { size: 4, font: 'mono', align: 'left', color: s.c('--ink-2') });
        ['blue', 'orange', 'green'].forEach((n, c) => {
          s.circle(ix + u * 1.5, py0 + u * (30 + c * 7), u * 1.4, { fill: colOf(c) });
          s.text(`class ${c}`, ix + u * 5, py0 + u * (30 + c * 7), { size: 3.6, align: 'left', color: s.c('--ink-2') });
        });
        s.alpha(s.ease('plane', 0.5, 2.5), () => {
          s.text('colored: decision regions', ix, py0 + u * 56, { size: 3.4, align: 'left', italic: true, color: s.c('--ink-2') });
          s.text('blank: a tie', ix, py0 + u * 62, { size: 3.4, align: 'left', italic: true, color: s.c('--ink-2') });
        });
      }
    });
  },
};

export const scenesB: Record<string, SceneDef> = { nn, l2, noloops, knn };
