import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { OBJECTS, sceneMasks } from '../../lib/detection-scene';
import { AP, AP_SCORES, AP_TP, ENV, FP_CUM, PREC, REC, TP_CUM, fcnLabels } from './data';
import { type K, type Rect, View, after, check, chip, clsK, cross, cue, fit, labelImage, pill, stage, stacked } from './kit';

// ---------------------------------------------------------------- mAP

const SHUF = [3, 7, 0, 9, 5, 1, 8, 2, 6, 4];
const CLASS_AP: [string, number, K][] = [
  ['car', 0.78, 'red'],
  ['person', 0.64, 'blue'],
  ['dog', AP, 'orange'],
  ['cat', 0.55, 'purple'],
];
const COCO = [0.7, 0.68, 0.65, 0.61, 0.56, 0.5, 0.42, 0.33, 0.21, 0.08];

const mapScene: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.slot('ap', AP.toFixed(2));
    const tA = 1 - s.ease('mean', 0.5);
    if (tA > 0) {
      s.alpha(tA, () => {
        const lc = u * 15;
        const cw = Math.min(u * 10, (w - u * 8 - lc) / 10);
        const x0 = (w - lc - 10 * cw) / 2 + lc;
        const y0 = Math.max(h * 0.1, u * 9);
        const rh = u * 5.4;
        const rg = u * 1;
        const rowY = (k: number) => y0 + k * (rh + rg);
        const walk = s.since('trade') >= 0 ? Math.min(9, Math.floor(s.prog('trade') * 10.5)) : -1;
        const cursor = walk >= 0 && s.since('env') < 0 ? walk : -1;
        if (cursor >= 0) s.rrect(x0 + cursor * cw, y0 - u * 0.6, cw, 6 * (rh + rg), 1, { fill: s.tint('--accent', 0.14) });
        const rowNames: [string, string][] = [
          ['score', 'grade'],
          ['tp', 'tp'],
          ['tp_cum', 'cum'],
          ['fp_cum', 'cum'],
          ['precision', 'prec'],
          ['recall', 'rec'],
        ];
        // The ranked scores start large and centered, then settle into the table's first row.
        const up = s.ease('tp', 0.9);
        const sy = lerp(h * 0.42, rowY(0), up);
        const sh = lerp(rh * 1.5, rh, up);
        rowNames.forEach(([n, b], k) => s.alpha(s.ease(b, 0.4, k === 3 ? 0.6 : 0), () => s.text(n, x0 - u * 2, (k ? rowY(k) : sy) + (k ? rh : sh) / 2, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-2') })));
        s.alpha(s.win('grade', 'tp'), () => s.text(s.since('rank') >= 0 ? 'every detection, sorted by score' : 'every detection on the test set', w / 2, sy + sh + u * 7, { size: 3.3, font: 'display', italic: true, color: s.c('--ink-2') }));
        const rank = s.ease('rank', 1.2, 0.4);
        const tpOn = s.ease('tp', 0.4);
        for (let i = 0; i < 10; i++) {
          const x = x0 + lerp(SHUF[i]!, i, rank) * cw;
          const tp = AP_TP[i] === 1;
          const k: K = tpOn > 0.5 ? (tp ? 'green' : 'red') : 'slate';
          s.alpha(s.ease('grade', 0.4, 0.08 * SHUF[i]!), () => s.cell(x + u * 0.3, sy, cw - u * 0.6, sh, AP_SCORES[i]!.toFixed(2).slice(1), k, { size: lerp(3.6, 2.9, up), on: tpOn }));
          const col = x0 + i * cw;
          s.alpha(s.ease('tp', 0.3, 0.6 + 0.12 * i), () => (tp ? check : cross)(s, col + cw / 2, rowY(1) + rh / 2, u * 1.8));
          const rows: [number, string, K, string][] = [
            [2, String(TP_CUM[i]), 'green', 'cum'],
            [3, String(FP_CUM[i]), 'red', 'cum'],
            [4, PREC[i]!.toFixed(2).replace(/^1\.00$/, '1').replace(/^0/, ''), 'blue', 'prec'],
            [5, REC[i]!.toFixed(2).replace(/^0/, ''), 'teal', 'rec'],
          ];
          rows.forEach(([ri, txt, kk, beat]) => s.alpha(s.ease(beat, 0.3, (ri === 3 ? 0.9 : 0.4) + 0.14 * i), () => s.text(txt, col + cw / 2, rowY(ri) + rh / 2 + u * 0.1, { size: 3, font: 'mono', weight: 600, color: s.c(kk) })));
        }
        // The precision-recall plot.
        const pA = s.ease('prec', 0.5);
        if (pA > 0) {
          const top = rowY(6) + u * 6;
          const ph = Math.min(h - top - u * 9, u * 46);
          const pw = Math.min(w - u * 30, ph * 1.6);
          const px0 = (w - pw) / 2 + u * 3;
          const X = (r: number) => px0 + r * pw;
          const Y = (p: number) => top + ph - p * ph;
          s.alpha(pA, () => {
            s.line(X(0), Y(0), X(1), Y(0), s.c('--axis'), 0.35);
            s.line(X(0), Y(0), X(0), Y(1), s.c('--axis'), 0.35);
            s.text('recall', X(0.5), Y(0) + u * 4, { size: 3, font: 'mono', color: s.c('teal') });
            s.text('precision', X(0) - u * 1.5, Y(1) - u * 0.2, { size: 3, font: 'mono', align: 'right', color: s.c('blue') });
            s.text('1', X(0) - u * 1.5, Y(1) + u * 3.6, { size: 2.6, font: 'mono', align: 'right', color: s.c('--ink-3') });
            s.text('0', X(0) - u * 1.5, Y(0), { size: 2.6, font: 'mono', align: 'right', color: s.c('--ink-3') });
            s.text('1', X(1), Y(0) + u * 4, { size: 2.6, font: 'mono', align: 'center', color: s.c('--ink-3') });
            const envA = s.ease('env', 0.8);
            const areaA = s.ease('ap', 0.6);
            const c = s.ctx;
            const stair = () => {
              c.beginPath();
              c.moveTo(X(0), Y(ENV[0]!));
              let pr = 0;
              for (let i = 0; i < 10; i++) {
                if (REC[i]! > pr) {
                  c.lineTo(X(pr), Y(ENV[i]!));
                  c.lineTo(X(REC[i]!), Y(ENV[i]!));
                  pr = REC[i]!;
                }
              }
            };
            if (areaA > 0) {
              stair();
              c.lineTo(X(REC[9]!), Y(0));
              c.lineTo(X(0), Y(0));
              c.closePath();
              c.fillStyle = s.tint('teal', 0.22 * areaA);
              c.fill();
            }
            if (envA > 0) {
              s.alpha(envA, () => {
                stair();
                c.strokeStyle = s.c('teal');
                c.lineWidth = 0.55 * u;
                c.stroke();
              });
            }
            const shown = s.since('env') >= 0 ? 10 : walk + 1;
            for (let i = 0; i < shown; i++) s.circle(X(REC[i]!), Y(PREC[i]!), u * (i === cursor ? 1.3 : 0.9), { fill: s.c(AP_TP[i] ? 'green' : 'red'), stroke: s.c('--card'), lw: 0.3 });
            s.alpha(areaA, () => pill(s, `AP = ${AP.toFixed(2)}`, X(0.55), Y(0.35), 'teal', { size: 3.4, fill: 0.16 }));
          });
        }
      });
    }
    // Mean over classes.
    const mA = s.win('mean', 'coco');
    s.alpha(mA, () => {
      const x0 = w * 0.1 + u * 16;
      const bw = w * 0.8 - u * 26;
      const mean = CLASS_AP.reduce((a, [, v]) => a + v, 0) / CLASS_AP.length;
      s.text('AP per class', w / 2, h * 0.18, { size: 3.6, font: 'display', weight: 600 });
      const mx = x0 + bw * mean;
      s.alpha(s.ease('mean', 0.5, 2), () => {
        s.line(mx, h * 0.3 - u * 6, mx, h * 0.3 + u * 36, s.c('--ink'), 0.4, [1, 0.8]);
        pill(s, `mAP = ${mean.toFixed(2)}`, mx, h * 0.3 + u * 40, 'gold', { size: 3.4, fill: 0.16 });
      });
      CLASS_AP.forEach(([n, val, k], i) => {
        const y = h * 0.3 + i * u * 10;
        const len = bw * val * s.ease('mean', 0.8, 0.3 * i);
        s.text(n, x0 - u * 2, y, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-2') });
        s.rrect(x0, y - u * 3, len, u * 6, 0.6, { fill: s.tint(k, 0.65) });
        s.text(val.toFixed(2), x0 + len + u * 1.5, y, { size: 3, font: 'mono', align: 'left', weight: 600, halo: true });
      });
    });
    // COCO: average over IoU cutoffs.
    const cA = s.ease('coco', 0.5);
    s.alpha(cA, () => {
      const n = COCO.length;
      const pw = Math.min(w - u * 16, u * 100);
      const bw = pw / n;
      const x0 = (w - pw) / 2;
      const base = h * 0.72;
      const bh = h * 0.42;
      s.text('AP at each IoU cutoff', w / 2, h * 0.18, { size: 3.6, font: 'display', weight: 600 });
      COCO.forEach((v, i) => {
        const a = s.ease('coco', 0.4, 0.5 + 0.12 * i);
        s.alpha(a, () => {
          s.rrect(x0 + i * bw + bw * 0.15, base - bh * v, bw * 0.7, bh * v, 0.4, { fill: s.tint(i === 0 ? 'teal' : 'slate', 0.6) });
          s.text((0.5 + 0.05 * i).toFixed(2).slice(1), x0 + i * bw + bw / 2, base + u * 3.6, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
        });
      });
      const mean = COCO.reduce((a, b) => a + b, 0) / n;
      s.alpha(s.ease('coco', 0.5, 2.2), () => {
        s.line(x0, base - bh * mean, x0 + pw, base - bh * mean, s.c('--ink'), 0.4, [1, 0.8]);
        s.text('PASCAL: 0.5 only', x0 + bw * 0.5, base - bh * COCO[0]! - u * 3, { size: 2.8, font: 'mono', align: 'left', color: s.c('teal'), halo: true });
        pill(s, `COCO: mean = ${mean.toFixed(2)}`, w / 2, base + u * 11, 'gold', { size: 3.2, fill: 0.16 });
      });
    });
  },
};

// ---------------------------------------------------------------- semantic segmentation

const SEG_BG = 0.08;

function labelMapImage(s: Scene, stride: number): HTMLCanvasElement {
  const m = sceneMasks(2);
  return labelImage(`fcn${stride}`, fcnLabels(stride), m.w, m.h, [null, ...[1, 2, 3, 4].map((c) => s.c(clsK(c)))]);
}

/** The encoder-decoder shape: blocks shrinking, then growing back. */
function hourglass(s: Scene, cx: number, cy: number, scale: number, o: { strides?: number; skips?: number } = {}): void {
  const { u } = s;
  const hs = [30, 21, 14, 8, 14, 21, 30].map((v) => v * scale * u);
  const bw = u * 6 * scale;
  const gap = u * 3.4 * scale;
  const total = hs.length * bw + (hs.length - 1) * gap;
  const x0 = cx - total / 2;
  const xs = hs.map((_, i) => x0 + i * (bw + gap));
  hs.forEach((hh, i) => {
    const k: K = i < 3 ? 'orange' : i === 3 ? 'slate' : 'blue';
    s.rrect(xs[i]!, cy - hh / 2, bw, hh, 0.8, { fill: s.tint(k, 0.18), stroke: s.tint(k, 0.8), lw: 0.3 });
    if (i) s.arrow(xs[i - 1]! + bw + u * 0.4, cy, xs[i]! - u * 0.4, cy, s.c('--ink-3'), 0.25, 1.1);
  });
  const lbl = (t: string, i: number, k: K = '--ink-3') => s.text(t, xs[i]! + bw / 2, cy + hs[0]! / 2 + u * 3.4, { size: 2.6, font: 'mono', color: s.c(k) });
  lbl('320×480', 0);
  lbl('320×480', 6);
  lbl('10×15', 3);
  s.alpha(o.strides ?? 0, () => {
    lbl('/8', 1, 'orange');
    lbl('/16', 2, 'orange');
    s.text('downsample', xs[1]! + bw / 2, cy - hs[0]! / 2 - u * 2, { size: 2.6, font: 'mono', color: s.c('orange') });
    s.text('upsample', xs[5]! + bw / 2, cy - hs[0]! / 2 - u * 2, { size: 2.6, font: 'mono', color: s.c('blue') });
  });
  const sk = o.skips ?? 0;
  if (sk > 0) {
    const c = s.ctx;
    [
      [2, 4],
      [1, 5],
    ].forEach(([a, b], i) => {
      const al = clamp01(sk * 2 - i);
      if (al <= 0) return;
      s.alpha(al, () => {
        const xa = xs[a!]! + bw / 2;
        const xb = xs[b!]! + bw / 2;
        const ya = cy - hs[a!]! / 2 - u * 0.6;
        c.beginPath();
        c.moveTo(xa, ya);
        c.bezierCurveTo(xa, ya - u * (8 + 5 * i) * scale, xb, ya - u * (8 + 5 * i) * scale, xb, ya);
        c.strokeStyle = s.c('green');
        c.lineWidth = 0.4 * u;
        c.stroke();
      });
    });
  }
}

const segment: SceneDef = {
  marks: {
    loss: { tex: String.raw`\symL = \frac{1}{HW} \sum_{i,j} -\log \frac{e^{\sym{s}{s_{y_{ij},ij}}}}{\sum_c e^{\sym{s}{s_{c,ij}}}}`, x: 0.5, y: 0.7, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const tall = stacked(s);
    const aA = s.win('pixel', 'down');
    if (aA > 0) {
      const r = tall ? fit(u * 4, h * 0.1, w - u * 8, h * 0.6) : fit(u * 4, h * 0.09, w - u * 8, h * 0.58);
      const v = View.in(s, r);
      s.alpha(aA, () => {
        v.paint(1);
        // The label map wipes in from the right until it covers half the picture.
        const wipe = 0.5 * s.ease('pixel', 1.6, 0.8);
        const xw = r[0] + r[2] * (1 - wipe);
        if (wipe > 0.002) {
          const c = s.ctx;
          c.save();
          c.beginPath();
          c.roundRect(r[0], r[1], r[2], r[3], u * 1.2);
          c.clip();
          c.beginPath();
          c.rect(xw, r[1], r[0] + r[2] - xw, r[3]);
          c.clip();
          c.fillStyle = s.c('--card');
          c.fillRect(xw, r[1], r[0] + r[2] - xw, r[3]);
          c.fillStyle = s.tint('--ink', SEG_BG);
          c.fillRect(xw, r[1], r[0] + r[2] - xw, r[3]);
          v.overlay(labelMapImage(s, 0), 1);
          c.restore();
          s.line(xw, r[1], xw, r[1] + r[3], s.c('--ink'), 0.4);
        }
        const ly = r[1] + r[3] + u * 4;
        s.text('img', r[0] + r[2] * 0.25, ly, { size: 3.2, font: 'mono', color: s.c('orange') });
        s.alpha(s.ease('pixel', 0.5, 1.6), () => s.text('labels: a class per pixel', r[0] + r[2] * 0.75, ly, { size: 3.2, font: 'mono', color: s.c('--ink-2') }));
        s.show('loss', aA * s.win('loss', 'how'), { y: (r[1] + r[3] + u * (tall ? 14 : 16)) / h });
        const sA = s.ease('slow', 0.5);
        if (sA > 0) {
          const k = Math.floor(s.prog('slow') * 12);
          const px = 40 + (k % 3) * 70;
          const py = 40 + Math.floor(k / 3) * 80;
          s.alpha(sA, () => {
            v.box([px - 30, py - 30, px + 30, py + 30], s.c('teal'), 0.55);
            s.circle(v.X(px), v.Y(py), u * 0.9, { fill: s.c('teal') });
            s.text('one ConvNet pass per pixel: 153,600 passes', w / 2, ly + u * 8, { size: 3.2, font: 'mono', weight: 600, color: s.c('red') });
          });
        }
      });
    }
    const dA = s.win('down', 'blob');
    s.alpha(dA, () => {
      hourglass(s, w / 2, h * 0.5, tall ? 1 : 1.15, { strides: s.ease('fcn', 0.5) });
      s.alpha(s.ease('down', 0.5, 0.6), () => s.text('downsample, then upsample', w / 2, h * 0.17, { size: 3.6, font: 'display', italic: true, color: s.c('--ink-2') }));
      s.alpha(s.ease('fcn', 0.5, 1), () => s.text('FCN: all convolutions, learned upsampling', w / 2, h * 0.84, { size: 3.1, font: 'mono', color: s.c('blue') }));
    });
    const cA = s.ease('blob', 0.6);
    if (cA <= 0) return;
    const r = tall ? fit(u * 4, h * 0.1, w - u * 8, h * 0.64) : fit(u * 4, h * 0.09, w * 0.68, h * 0.84);
    const v = View.in(s, r);
    const stride = s.since('eight') >= 0 ? 8 : s.since('skip') >= 0 ? 16 : 32;
    s.slot('up', stride);
    s.alpha(cA, () => {
      v.paint(1, 0.35);
      v.overlay(labelMapImage(s, stride), 0.72);
      s.alpha(stride === 32 ? 0.5 : 0.3, () => {
        for (let x = stride; x < 480; x += stride) s.line(v.X(x), v.y, v.X(x), v.y + v.h, s.tint('--ink', 0.4), 0.12);
        for (let y = stride; y < 320; y += stride) s.line(v.x, v.Y(y), v.x + v.w, v.Y(y), s.tint('--ink', 0.4), 0.12);
      });
      const px = tall ? w / 2 : r[0] + r[2] + (w - r[0] - r[2]) / 2;
      const py = tall ? r[1] + r[3] + u * 6 : r[1] + r[3] * 0.2;
      const opts: [string, number][] = [
        ['stride 32', 32],
        ['+ skip 16', 16],
        ['+ skip 8', 8],
      ];
      opts.forEach(([t, st], i) => {
        const on = st >= stride ? 1 : 0;
        const x = tall ? px + (i - 1) * u * 27 : px;
        const y = tall ? py : py + i * u * 8;
        s.alpha(i === 0 ? 1 : s.ease(i === 1 ? 'skip' : 'eight', 0.4), () => pill(s, t, x, y, on ? (st === stride ? '--accent' : 'green') : '--ink-3', { size: 3, fill: on ? 0.16 : 0.05 }));
      });
      const wA = s.ease('what', 0.5);
      s.alpha(wA, () => {
        const y = tall ? py + u * 8 : py + u * 32;
        s.text('deep layers: what', px, y, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange') });
        s.text('shallow layers: where', px, y + u * (tall ? 5.5 : 6.5), { size: 3.2, font: 'mono', weight: 600, color: s.c('green') });
      });
      s.alpha(s.win('blob', 'skip') * s.ease('blob', 0.5, 2.5), () => {
        const p = OBJECTS[1]!.box;
        chip(s, 'two people, one blob', v.X(p[0]) - u * 6, v.Y(p[1]) - u * 5, s.c('blue'), { size: 2.7 });
      });
    });
  },
};

// ---------------------------------------------------------------- upsampling

const X2 = [
  [1, 2],
  [3, 4],
];
const SRC_K: K[] = ['blue', 'orange', 'green', 'purple'];
const SW: [number, number][] = [
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
];

function unpool(mode: number): (string | null)[][] {
  const out: (string | null)[][] = Array.from({ length: 4 }, () => Array<string | null>(4).fill('0'));
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      const v = String(X2[i]![j]);
      if (mode === 0) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) out[2 * i + a]![2 * j + b] = v;
      else if (mode === 1) out[2 * i]![2 * j] = v;
      else {
        const [di, dj] = SW[i * 2 + j]!;
        out[2 * i + di]![2 * j + dj] = v;
      }
    }
  return out;
}

const OUT1 = [3, 6, 8, 10, 5];
const OVER = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => {
  const n = (k: number) => [0, 1, 2, 3].filter((i) => 2 * i <= k && k <= 2 * i + 2).length;
  return n(r) * n(c);
}));

const upsample: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Unpooling: 2 x 2 in, 4 x 4 out.
    const aA = s.win('grow', 'tconv');
    if (aA > 0) {
      s.alpha(aA, () => {
        const ci = u * 11;
        const co = u * 9;
        const total = 2 * ci + u * 12 + 4 * co;
        const x0 = (w - total) / 2;
        const cy = h * 0.5;
        const iy = cy - ci;
        X2.forEach((row, i) => row.forEach((val, j) => s.cell(x0 + j * ci, iy + i * ci, ci, ci, String(val), SRC_K[i * 2 + j]!, { on: 0.3, size: 4.4 })));
        s.text('x', x0 + ci, iy - u * 4, { size: 3.6, font: 'mono', weight: 600 });
        s.arrow(x0 + 2 * ci + u * 2.5, cy, x0 + 2 * ci + u * 9.5, cy, s.c('--ink-3'), 0.4, 1.8);
        const ox = x0 + 2 * ci + u * 12;
        const oy = cy - 2 * co;
        const mode = stage(s, ['near', 'nails', 'max']);
        const out = mode >= 0 ? unpool(mode) : null;
        const fill = mode >= 0 ? s.ease(['near', 'nails', 'max'][mode]!, 0.5, mode === 2 ? 1.2 : 0.3) : 0;
        for (let a = 0; a < 4; a++)
          for (let b = 0; b < 4; b++) {
            const src = Math.floor(a / 2) * 2 + Math.floor(b / 2);
            const val = out ? out[a]![b]! : '';
            const live = val !== '0' && val !== '';
            s.cell(ox + b * co, oy + a * co, co, co, fill > 0.5 ? val : '', live && fill > 0 ? SRC_K[src]! : '--ink-3', { on: live ? fill * 0.6 : 0, size: 3.6 });
          }
        if (mode === 2) {
          const pA = 1 - s.ease('max', 0.4, 1.2);
          s.alpha(pA * s.ease('max', 0.3), () =>
            SW.forEach(([di, dj], q) => {
              const i = Math.floor(q / 2);
              const j = q % 2;
              s.circle(ox + (2 * j + dj + 0.5) * co, oy + (2 * i + di + 0.5) * co, u * 1.3, { fill: s.c(SRC_K[q]!) });
            }),
          );
        }
        const titles = ['nearest neighbor', 'bed of nails', 'max unpooling: where the max was'];
        titles.forEach((t, i) => s.alpha(s.win(['near', 'nails', 'max'][i]!, ['nails', 'max', 'tconv'][i]!, 0.35), () => s.text(t, ox + 2 * co, oy - u * 4, { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink-2') })));
        s.alpha(s.win('grow', 'near'), () => s.text('2 × 2 → 4 × 4 ?', ox + 2 * co, oy - u * 4, { size: 3.4, font: 'mono', weight: 600 }));
        s.alpha(s.ease('near', 0.5, 0.4), () => s.text('no weights to learn', w / 2, cy + 2 * co + u * 9, { size: 3.2, font: 'display', italic: true, color: s.c('--ink-3') }));
      });
    }

    // Transpose convolution in one dimension.
    const bA = s.win('tconv', 'names');
    if (bA > 0) {
      s.alpha(bA, () => {
        const cw = Math.min(u * 14, (w - u * 12) / 5.5);
        const x0 = (w - 5 * cw) / 2;
        const conv = s.since('rev') < 0;
        const topY = h * 0.24;
        const botY = h * 0.6;
        const c = s.ctx;
        if (conv) {
          for (let i = 0; i < 5; i++) s.cell(x0 + i * cw, topY, cw, cw * 0.75, '', 'orange', { on: 0.2 });
          const k = s.prog('tconv') < 0.5 ? 0 : 1;
          const ox = x0 + (2 * k + 1.5) * cw;
          for (let q = 0; q < 2; q++) s.cell(x0 + (2 * q + 1) * cw, botY, cw, cw * 0.75, '', 'blue', { on: q === k ? 1 : 0.1 });
          s.rrect(x0 + 2 * k * cw - u * 0.5, topY - u * 0.5, 3 * cw + u, cw * 0.75 + u, 1.2, { stroke: s.c('teal'), lw: 0.6 });
          for (let q = 0; q < 3; q++) s.line(x0 + (2 * k + q + 0.5) * cw, topY + cw * 0.75 + u * 0.6, ox, botY - u * 0.6, s.tint('teal', 0.7), 0.35);
          s.text('convolution, stride 2: reads 3, writes 1', w / 2, botY + cw + u * 6, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
        } else {
          // Input a, b on top; output five cells below.
          const ix = (q: number) => x0 + (2 * q + 1) * cw;
          [3, 5].forEach((val, q) => s.cell(ix(q) - cw / 2, topY, cw, cw * 0.75, String(val), 'orange', { on: 0.4, size: 3.8 }));
          pill(s, 'w = [1, 2, 1]', w / 2, topY - u * 6, 'teal', { size: 3 });
          const st1 = s.ease('stamp', 0.6, 0.2);
          const st2 = after(s, cue(s, 'upsample', 'stamp', 'five') - 0.3, 0.6);
          const sums = s.ease('add', 0.5, 0.5);
          const stamps: [number, number][] = [
            [0, st1],
            [1, st2],
          ];
          stamps.forEach(([q, a]) => {
            if (a <= 0) return;
            s.alpha(a, () => {
              for (let k = 0; k < 3; k++) {
                const tx = x0 + (2 * q + k + 0.5) * cw;
                s.line(ix(q), topY + cw * 0.75 + u * 0.6, tx, botY - u * 7.4 + (q ? u * 3.4 : 0) - u * 0.6, s.tint('orange', 0.5), 0.3);
                const val = [3, 5][q]! * [1, 2, 1][k]!;
                s.text(String(val), tx, botY - u * 5.6 + (q ? u * 3.4 : 0), { size: 2.9, font: 'mono', weight: 600, color: s.c(q ? 'purple' : 'orange'), halo: true });
              }
            });
          });
          for (let i = 0; i < 5; i++) {
            const mid = i === 2;
            s.cell(x0 + i * cw, botY, cw, cw * 0.75, sums > 0.5 ? String(OUT1[i]) : '', mid ? 'red' : 'blue', { on: mid ? sums : sums * 0.3, size: 3.8 });
          }
          s.alpha(sums, () => s.text('overlap adds: 3 + 5 = 8', w / 2, botY + cw + u * 6, { size: 3.2, font: 'mono', weight: 600, color: s.c('red') }));
          s.alpha(s.win('rev', 'stamp'), () => s.text('one input stamps a whole scaled filter', w / 2, botY + cw + u * 6, { size: 3.1, font: 'mono', color: s.c('--ink-2') }));
        }
      });
    }

    // Names, and why "transpose".
    const cA = s.win('names', 'checker');
    if (cA > 0) {
      s.alpha(cA, () => {
        const nA = s.win('names', 'why');
        s.alpha(nA, () => {
          const names: [string, boolean][] = [
            ['deconvolution', false],
            ['upconvolution', true],
            ['fractionally strided conv', true],
            ['transpose convolution', true],
          ];
          names.forEach(([n, ok], i) => {
            const y = h * 0.26 + i * u * 11;
            s.alpha(s.ease('names', 0.4, 0.3 * i), () => {
              s.text(n, w / 2, y, { size: 4.2, font: 'mono', weight: 600, color: s.c(ok ? '--ink' : 'red') });
              if (!ok) {
                const tw = s.measure(n, { size: 4.2, font: 'mono', weight: 600 });
                s.line(w / 2 - tw / 2 - u, y, w / 2 + tw / 2 + u, y, s.c('red'), 0.45);
              }
            });
          });
        });
        const mA = s.ease('why', 0.5);
        s.alpha(mA, () => {
          const cs = Math.min(u * 8, h * 0.085);
          const flip = s.ease('why', 0.8, 2.2);
          const MT = [
            [1, 0],
            [2, 0],
            [1, 1],
            [0, 2],
            [0, 1],
          ];
          const total = 2 * cs + u * 5 + cs + u * 8 + cs;
          const x0 = (w - total) / 2;
          const y0 = h * 0.18;
          const label = flip > 0.5 ? 'M.T  (5 × 2)' : 'M  (2 × 5)';
          s.text(label, x0 + cs, y0 - u * 3.5, { size: 3, font: 'mono', weight: 600, color: s.c('teal') });
          for (let i = 0; i < 5; i++)
            for (let j = 0; j < 2; j++) {
              const tx = x0 + j * cs;
              const ty = y0 + i * cs;
              const mx = lerp(x0 + i * cs - cs * 1.5, tx, flip);
              const my = lerp(y0 + j * cs + cs * 1.5, ty, flip);
              s.cell(mx, my, cs, cs, String(MT[i]![j]), 'teal', { on: MT[i]![j] ? 0.5 : 0, size: 3 });
            }
          s.alpha(flip, () => {
            const xx = x0 + 2 * cs + u * 5;
            s.text('·', xx - u * 2.5, y0 + 2.5 * cs, { size: 5, font: 'mono' });
            [3, 5].forEach((v, i) => s.cell(xx, y0 + (1.5 + i) * cs, cs, cs, String(v), 'orange', { on: 0.4, size: 3 }));
            s.text('=', xx + cs + u * 4, y0 + 2.5 * cs, { size: 4, font: 'mono' });
            const ox = xx + cs + u * 8;
            OUT1.forEach((v, i) => s.cell(ox, y0 + i * cs, cs, cs, String(v), 'blue', { on: 0.3, size: 3 }));
          });
          s.alpha(s.ease('learn', 0.5), () => {
            const y = y0 + 5 * cs + u * 9;
            s.text('2 numbers back up to 5: the right shape', w / 2, y, { size: 3.1, font: 'mono', color: s.c('green'), weight: 600 });
            s.text('not the original values; w is learned', w / 2, y + u * 6, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
          });
        });
      });
    }

    // Uneven overlap in 2-D.
    const dA = s.ease('checker', 0.6);
    if (dA > 0) {
      s.alpha(dA, () => {
        const cs = Math.min(u * 6.2, (h * 0.62) / 9);
        const x0 = (w - 9 * cs) / 2;
        const y0 = h * 0.2;
        for (let r = 0; r < 9; r++)
          for (let c = 0; c < 9; c++) {
            const n = OVER[r]![c]!;
            const a = s.ease('checker', 0.3, 0.4 + (r + c) * 0.06);
            s.alpha(a, () => s.cell(x0 + c * cs, y0 + r * cs, cs, cs, String(n), n === 4 ? 'red' : n === 2 ? 'gold' : 'slate', { on: (n - 1) / 3, size: 2.6 }));
          }
        s.text('stamps per output cell: 4 × 4 in, stride 2, 3 × 3 filter', w / 2, y0 - u * 4, { size: 2.9, font: 'mono', color: s.c('--ink-2') });
        s.alpha(s.ease('checker', 0.5, 2), () => s.text('uneven overlap: a faint checkerboard', w / 2, y0 + 9 * cs + u * 6, { size: 3.3, font: 'display', italic: true, color: s.c('--ink-2') }));
      });
    }
  },
};

// ---------------------------------------------------------------- outro

const INST_K = ['red', 'blue', 'teal', 'orange', 'purple'] as const;
const TILES: [string, string, K, number][] = [
  ['localization', '4 numbers, L2', 'purple', 0],
  ['IoU', 'shared / total', 'teal', 1],
  ['NMS', 'keep best, drop dupes', 'slate', 1],
  ['mAP', 'area under P-R', 'gold', 1],
  ['R-CNN family', 'proposals, RoI pool', 'green', 2],
  ['anchors', 'offsets t', 'teal', 2],
  ['YOLO, SSD', 'one look', 'blue', 2],
  ['segmentation', 'down, up, skips', 'red', 3],
];
const TILE_BEATS = ['recap', 'grade', 'det', 'seg'];

let dogMask: number[] | null = null;
/** The dog's mask on a 14 x 14 grid inside its box, as a mask head would predict it. */
function dogMask14(): number[] {
  if (dogMask) return dogMask;
  const m = sceneMasks(2);
  const b = OBJECTS[3]!.box;
  const out: number[] = [];
  for (let i = 0; i < 14; i++)
    for (let j = 0; j < 14; j++) {
      const x = Math.floor((b[0] + ((j + 0.5) * (b[2] - b[0])) / 14) / 2);
      const y = Math.floor((b[1] + ((i + 0.5) * (b[3] - b[1])) / 14) / 2);
      out.push(m.inst[y * m.w + x] === 4 ? 1 : 0);
    }
  dogMask = out;
  return out;
}

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = stacked(s);
    const aA = s.win('inst', 'recap');
    if (aA > 0) {
      const r = tall ? fit(u * 4, h * 0.1, w - u * 8, h * 0.6) : fit(u * 4, h * 0.09, w * 0.64, h * 0.84);
      const v = View.in(s, r);
      const m = sceneMasks(2);
      s.alpha(aA, () => {
        v.paint(1);
        const img = labelImage('inst', m.inst, m.w, m.h, [null, ...INST_K.map((k) => s.c(k))]);
        const era = s.since('era') >= 0;
        if (!era) v.overlay(img, 0.62 * s.ease('inst', 0.6, 0.6));
        else {
          OBJECTS.forEach((o, i) => {
            const a = s.ease('era', 0.4, 0.5 + 0.5 * i);
            const ma = s.ease('era', 0.4, 1 + 0.5 * i);
            s.alpha(a, () => v.box(o.box, s.c(INST_K[i]!), 0.5));
            if (ma > 0) {
              const c = s.ctx;
              c.save();
              const [bx, by, bw, bh] = v.rect(o.box);
              c.beginPath();
              c.rect(bx, by, bw, bh);
              c.clip();
              v.overlay(img, 0.62 * ma);
              c.restore();
            }
          });
        }
        // Mask R-CNN: a 14 x 14 mask inside the dog's box.
        const mA = s.ease('mask', 0.5, 1.2);
        if (mA > 0) {
          const px = tall ? u * 4 : r[0] + r[2] + u * 5;
          const pw = tall ? w - u * 8 : w - px - u * 4;
          const top = tall ? r[1] + r[3] + u * 4 : r[1] + r[3] * 0.18;
          const g = tall ? Math.min(u * 22, h - top - u * 9) : Math.min(pw * 0.62, u * 30);
          const cs = g / 14;
          const cropW = g * 1.5;
          const total = tall ? cropW + u * 8 + g : g;
          const cx0 = tall ? (w - total) / 2 : px + (pw - g) / 2;
          s.alpha(mA, () => {
            const b = OBJECTS[3]!.box;
            const cropR: Rect = tall ? [cx0, top, cropW, g] : [cx0 + (g - cropW / 1.4) / 2, top, cropW / 1.4, g / 1.4];
            v.crop(b, cropR);
            s.rrect(cropR[0], cropR[1], cropR[2], cropR[3], 0.5, { stroke: s.c('orange'), lw: 0.4 });
            const gx = tall ? cx0 + cropW + u * 8 : cx0;
            const gy = tall ? top : top + g / 1.4 + u * 9;
            if (tall) s.arrow(cx0 + cropW + u * 1.5, top + g / 2, gx - u * 1.5, top + g / 2, s.c('--ink-3'), 0.35, 1.5);
            else s.arrow(cx0 + g / 2, top + g / 1.4 + u * 1.5, cx0 + g / 2, gy - u * 1.5, s.c('--ink-3'), 0.35, 1.5);
            const mk = dogMask14();
            for (let i = 0; i < 14; i++)
              for (let j = 0; j < 14; j++) {
                const on = mk[i * 14 + j]! * s.ease('mask', 0.3, 1.6 + (i + j) * 0.04);
                s.ctx.fillStyle = on > 0.5 ? s.tint('orange', 0.75) : s.tint('--ink', 0.08);
                s.ctx.fillRect(gx + j * cs + 0.4, gy + i * cs + 0.4, cs - 0.8, cs - 0.8);
              }
            s.text('14 × 14 mask', gx + g / 2, gy + g + u * 3.4, { size: 2.8, font: 'mono', color: s.c('orange') });
          });
        }
      });
    }
    // The whole ladder.
    const tA = s.ease('recap', 0.5);
    if (tA > 0) {
      const lit = stage(s, TILE_BEATS);
      const endA = s.ease('next', 0.6, 0.3);
      const [ax, ay, aw, ah] = [u * 4, Math.max(h * 0.1, u * 9), w - u * 8, h - Math.max(h * 0.1, u * 9) - u * 4];
      const cols = tall ? 2 : 4;
      const rows = TILES.length / cols;
      const gap = u * 2;
      const tw = (aw - gap * (cols - 1)) / cols;
      const th = Math.min((ah - gap * (rows - 1)) / rows, tw * 0.6);
      const oy = ay + (ah - (th * rows + gap * (rows - 1))) / 2;
      s.alpha(tA * (1 - endA * 0.93), () => {
        TILES.forEach(([name, sub, k, grp], i) => {
          const a = s.ease('recap', 0.4, 0.1 * i);
          const x = ax + (i % cols) * (tw + gap);
          const y = oy + Math.floor(i / cols) * (th + gap);
          const on = lit === grp ? 1 : lit > grp ? 0.35 : 0;
          s.alpha(a, () => {
            s.rrect(x, y, tw, th, 2, { fill: s.tint(k, 0.06 + 0.18 * on), stroke: s.tint(k, 0.35 + 0.65 * on), lw: 0.3 + 0.3 * on });
            const fs = Math.min(4.6, (tw / u) * 0.13);
            const subW = s.measure(sub, { size: fs * 0.7, font: 'mono' });
            const ss = fs * 0.7 * Math.min(1, (tw - u * 3) / subW);
            s.text(name, x + tw / 2, y + th * 0.4, { size: fs, font: 'display', weight: 600 });
            s.text(sub, x + tw / 2, y + th * 0.68, { size: ss, font: 'mono', color: s.c(k) });
          });
        });
      });
      s.alpha(endA, () => {
        s.text('next: the interactive chapter', w / 2, h * 0.42, { size: 6, font: 'display', weight: 600 });
        s.text('drag boxes, step through NMS, train a detector', w / 2, h * 0.54, { size: 3.6, italic: true, color: s.c('--ink-2') });
        s.alpha(s.ease('bye', 0.6), () => s.text('see you there', w / 2, h * 0.68, { size: 4.6, font: 'display', italic: true, color: s.c('--accent') }));
      });
    }
  },
};

export { mapScene, segment, upsample, outro };
