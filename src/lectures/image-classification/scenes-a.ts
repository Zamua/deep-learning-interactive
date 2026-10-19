import { CIFAR_CLASSES } from '../../core/data';
import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, lerp } from '../../lecture/scene';
import { blit, chwCanvas, cifar, edgeMap, photo, px, signedDiff } from './data';
import { area, cross, pill } from './kit';

/** A negative number with a true minus sign (mono ligatures turn "|-" into a glyph). */
const neg = (v: number): string => (v < 0 ? `−${-v}` : String(v));

/** Eased 0 -> 1 starting `frac` of the way through beat `id`. */
export const late = (s: Scene, id: string, frac: number, dur = 0.5): number => s.ease(id, dur, frac * (s.end(id) - s.at(id)));

/** The cat of the opening scenes (a training image). */
export const CAT = 104;
/** A test cat and its nearest training image under L1 (also a cat). */
export const Q = 45;
export const NN = 9;

/** An n x n block of the cat's red-channel bytes: what the computer gets. */
function numberBlock(s: Scene, cx: number, cy: number, size: number, n: number, appear: (i: number) => number): void {
  const d = cifar(s);
  s.rrect(cx - size / 2, cy - size / 2, size, size, 1.6, { fill: s.c('--paper-2'), stroke: s.c('--rule') });
  if (!d) return;
  const cell = size / n;
  const fs = Math.min(3.6, (cell / s.u) * 0.34);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const a = appear(r * n + c);
      if (a <= 0) continue;
      const v = px(d.train, CAT, 0, Math.floor(((r + 0.5) * 32) / n), Math.floor(((c + 0.5) * 32) / n));
      s.alpha(a, () => s.text(String(v), cx - size / 2 + (c + 0.5) * cell, cy - size / 2 + (r + 0.5) * cell + s.u * 0.2, { size: fs, font: 'mono', color: s.c('--ink-2') }));
    }
}

// ---------------------------------------------------------------- intro

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    // The title, then the cat a child names at a glance.
    s.alpha(s.win('hello', 'numbers'), () => {
      s.text('Image classification', w / 2, h * 0.24, { size: tall ? 7.6 : 8.6, font: 'display', weight: 600 });
      s.text('and nearest neighbors', w / 2, h * 0.24 + u * (tall ? 8.5 : 9.5), { size: 4.4, italic: true, color: s.c('--ink-2') });
    });
    const mv = s.ease('numbers', 1.1);
    const S0 = Math.min(h * 0.36, w * 0.36);
    const S1 = Math.min(w * 0.36, h * 0.5);
    const S = lerp(S0, S1, mv);
    const cx = lerp(w / 2, w * 0.27, mv);
    const cy = lerp(h * 0.64, h * 0.47, mv);
    const panelA = s.ease('hello', 0.6, 0.5) * (1 - s.ease('simple', 0.6));
    s.alpha(panelA, () => {
      photo(s, 'train', CAT, cx - S / 2, cy - S / 2, S);
      const ba = late(s, 'hello', 0.6) * (1 - s.ease('numbers', 0.5));
      s.alpha(ba, () => {
        const bx = cx + S / 2 + u * 3;
        const by = cy - S * 0.2;
        const tw = s.measure('cat!', { size: 5, font: 'display' }) + u * 5;
        const c = s.ctx;
        c.beginPath();
        c.moveTo(bx + u * 1.5, by + u * 2);
        c.lineTo(bx - u * 2, by + u * 6);
        c.lineTo(bx + u * 5, by + u * 3);
        c.fillStyle = s.tint('gold', 0.25);
        c.fill();
        s.rrect(bx, by - u * 5, tw, u * 9, 3, { fill: s.tint('gold', 0.25), stroke: s.c('gold') });
        s.text('cat!', bx + tw / 2, by - u * 0.4, { size: 5, font: 'display', weight: 600 });
      });
      s.alpha(s.ease('numbers', 0.6, 0.8), () => s.text('what you see', cx, cy + S / 2 + u * 5, { size: 3.8, color: s.c('--ink-2') }));
    });
    // What the computer gets: bytes, and nothing that says "cat".
    const panelB = s.ease('numbers', 0.6, 0.6) * (1 - s.ease('simple', 0.6));
    if (panelB > 0) {
      const bx = w * 0.73;
      s.alpha(panelB, () => {
        const n = tall ? 6 : 8;
        numberBlock(s, bx, h * 0.47, S1, n, (i) => s.ease('numbers', 0.4, 1.0 + ((i * 7) % 23) * 0.07));
        s.text('what the computer gets', bx, h * 0.47 + S1 / 2 + u * 5, { size: 3.8, color: s.c('--ink-2') });
        s.alpha(s.ease('gap', 0.6), () => {
          const x0 = w * 0.27 + S1 / 2 + u * 1.5;
          const x1 = bx - S1 / 2 - u * 1.5;
          s.arrow((x0 + x1) / 2, h * 0.47, x1, h * 0.47, s.c('--accent'), 0.6, 2.4);
          s.arrow((x0 + x1) / 2, h * 0.47, x0, h * 0.47, s.c('--accent'), 0.6, 2.4);
          s.text('?', (x0 + x1) / 2, h * 0.47 - u * 5, { size: 6, font: 'display', weight: 600, color: s.c('--accent') });
        });
      });
    }
    // The whole idea: find the most similar image already seen, copy its label.
    const cA = s.ease('simple', 0.7, 0.3);
    if (cA > 0) {
      const up = s.ease('habits', 0.8);
      const T = Math.min(tall ? w * 0.25 : w * 0.2, h * 0.32) * lerp(1, 0.82, up);
      const y = lerp(h * 0.45, h * 0.34, up);
      const xs = tall ? [w * 0.19, w * 0.5, w * 0.81] : [w * 0.22, w * 0.5, w * 0.78];
      s.alpha(cA, () => {
        s.alpha(s.ease('simple', 0.5, 0.3), () => {
          photo(s, 'test', Q, xs[0]! - T / 2, y - T / 2, T, s.c('orange'));
          s.text('new image', xs[0]!, y + T / 2 + u * 4, { size: 3.4, color: s.c('orange') });
        });
        s.alpha(late(s, 'simple', 0.45), () => {
          s.text('≈', (xs[0]! + xs[1]!) / 2, y, { size: 7, color: s.c('--ink-3') });
          photo(s, 'train', NN, xs[1]! - T / 2, y - T / 2, T, s.c('blue'));
          s.text(tall ? 'most similar' : 'most similar seen', xs[1]!, y + T / 2 + u * 4, { size: 3.4, color: s.c('blue') });
        });
        s.alpha(late(s, 'simple', 0.8), () => {
          s.arrow(xs[1]! + T / 2 + u * 2, y, xs[2]! - u * 9, y, s.c('--ink-3'), 0.5);
          pill(s, 'cat', xs[2]!, y, 'gold', { size: 5, font: 'serif', on: 1 });
          s.text('its label', xs[2]!, y + T / 2 + u * 4, { size: 3.4, color: s.c('gold') });
        });
      });
      // What it teaches along the way.
      const chips: [string, number][] = [
        ['training · validation · test data', 0.56],
        ['hyperparameters', 0.8],
        ['honest evaluation', 0.9],
      ];
      chips.forEach(([t, f], i) => {
        s.alpha(late(s, 'habits', f, 0.4), () => pill(s, t, w / 2, h * (tall ? 0.66 : 0.66) + i * u * (tall ? 8 : 8.5), '--ink', { size: tall ? 3.8 : 4, font: 'serif' }));
      });
    }
  },
};

// ---------------------------------------------------------------- task

const ROW = 17;
const COL = 15;
const P0: [number, number] = [15, 13];

const task: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const d = cifar(s);
    const S = tall ? Math.min(w * 0.46, h * 0.62) : Math.min(h * 0.62, w * 0.42);
    const x0 = tall ? w * 0.05 : w * 0.08;
    const y0 = tall ? h * 0.2 : (h - S) / 2 + h * 0.03;
    const rx = x0 + S + u * (tall ? 5 : 8);
    const rw = w - rx - Math.max(u * 4, w * 0.04);
    const ps = S / 32;
    photo(s, 'train', CAT, x0, y0, S);
    // The task: one label from a fixed list.
    const lA = s.win('task', 'grid');
    s.alpha(lA, () => {
      const rh = u * 6.4;
      CIFAR_CLASSES.forEach((name, i) => {
        const col = Math.floor(i / 5);
        const row = i % 5;
        const tx = rx + col * (rw / 2);
        const ty = y0 + u * 3 + row * rh;
        s.alpha(s.ease('task', 0.4, 0.8 + i * 0.08), () => {
          if (i === 3) pill(s, name, tx, ty, 'gold', { size: 3.8, font: 'serif', align: 'left', on: s.ease('task', 0.5, 2.2) });
          else s.text(name, tx + u * 1.7, ty, { size: 3.8, align: 'left', color: s.c('--ink-2') });
        });
      });
      s.alpha(s.ease('task', 0.5, 2.4), () => s.arrow(x0 + S + u * 0.5, y0 + u * 3 + 3 * rh, rx - u * 0.8, y0 + u * 3 + 3 * rh, s.c('gold'), 0.5, 2.2));
      const by = y0 + u * 3 + 5 * rh + u * 3;
      s.alpha(late(s, 'built', 0.35), () => s.text('built on top of it:', rx, by, { size: 3.3, align: 'left', italic: true, color: s.c('--ink-3') }));
      ['detection', 'segmentation', 'captioning'].forEach((t, i) =>
        s.alpha(late(s, 'built', 0.5 + i * 0.1, 0.4), () => pill(s, t, rx, by + u * (6.5 + i * 7), '--ink', { size: 3.3, align: 'left', font: 'serif' })),
      );
    });
    // Pixels: a grid, then one pixel's three bytes.
    const gA = s.win('grid', 'shape');
    if (gA > 0) {
      s.alpha(gA * 0.45, () => {
        for (let k = 1; k < 32; k++) {
          s.line(x0 + k * ps, y0, x0 + k * ps, y0 + S, s.c('--card'), 0.12);
          s.line(x0, y0 + k * ps, x0 + S, y0 + k * ps, s.c('--card'), 0.12);
        }
      });
      s.alpha(s.win('grid', 'zoom'), () => s.text('32 × 32 pixels', rx, y0 + u * 4, { size: tall ? 4.4 : 5, font: 'display', weight: 560, align: 'left' }));
    }
    const pA = s.win('pixel', 'zoom');
    if (pA > 0 && d) {
      s.alpha(pA, () => {
        const pxX = x0 + COL * ps;
        const pxY = y0 + ROW * ps;
        s.rrect(pxX - u * 0.4, pxY - u * 0.4, ps + u * 0.8, ps + u * 0.8, 0.3, { stroke: s.c('--card'), lw: 0.9 });
        s.rrect(pxX - u * 0.4, pxY - u * 0.4, ps + u * 0.8, ps + u * 0.8, 0.3, { stroke: s.c('--ink'), lw: 0.45 });
        const ty = y0 + u * 13;
        s.line(pxX + ps + u * 0.6, pxY + ps / 2, rx - u * 1.2, ty, s.c('--ink-3'), 0.3, [1, 0.8]);
        s.text(`img[${ROW}, ${COL}]`, rx, ty, { size: 3.8, font: 'mono', align: 'left' });
        const names = ['red', 'green', 'blue'];
        [0, 1, 2].forEach((ch) => {
          const v = px(d.train, CAT, ch, ROW, COL);
          const yy = ty + u * (7.5 + ch * 7);
          s.alpha(s.ease('pixel', 0.4, 1.2 + ch * 0.5), () => {
            const rgb = [0, 0, 0];
            rgb[ch] = 255;
            const sw = u * 4.6;
            s.rrect(rx, yy - sw / 2, sw, sw, 0.8, { fill: `rgb(${rgb.join(',')})`, stroke: s.c('--rule') });
            s.text(names[ch]!, rx + sw + u * 2, yy, { size: 3.6, align: 'left', color: s.c('--ink-2') });
            s.text(String(v), rx + rw, yy, { size: 4.2, font: 'mono', weight: 650, align: 'right' });
          });
        });
        // One byte: 0 to 255.
        s.alpha(s.ease('byte', 0.6), () => {
          const by = ty + u * 30;
          const bw = rw;
          const bh = u * 3.4;
          const c = s.ctx;
          const g = c.createLinearGradient(rx, 0, rx + bw, 0);
          g.addColorStop(0, '#000000');
          g.addColorStop(1, '#ff0000');
          c.fillStyle = g;
          c.fillRect(rx, by, bw, bh);
          const v = px(d.train, CAT, 0, ROW, COL);
          const mx = rx + (v / 255) * bw;
          s.arrow(mx, by - u * 3.4, mx, by - u * 0.4, s.c('--ink'), 0.4, 1.6);
          s.text('0', rx, by + bh + u * 3, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-3') });
          s.text('255', rx + bw, by + bh + u * 3, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-3') });
        });
      });
    }
    // Zoom: a 5 x 5 patch of the red channel is all there is.
    const zA = s.win('zoom', 'shape');
    if (zA > 0 && d) {
      s.alpha(zA, () => {
        const [r0, c0] = P0;
        const cell = Math.min(rw / 5, (S - u * 8) / 5, u * 11);
        const gx = rx;
        const gy = y0 + u * 8;
        const bx0 = x0 + c0 * ps;
        const by0 = y0 + r0 * ps;
        s.rrect(bx0, by0, 5 * ps, 5 * ps, 0.2, { stroke: s.c('--card'), lw: 0.9 });
        s.ctx.setLineDash([u * 1, u * 0.8]);
        s.rrect(bx0, by0, 5 * ps, 5 * ps, 0.2, { stroke: s.c('--ink'), lw: 0.4 });
        s.ctx.setLineDash([]);
        s.line(bx0 + 5 * ps, by0, gx, gy, s.c('--ink-3'), 0.25);
        s.line(bx0 + 5 * ps, by0 + 5 * ps, gx, gy + 5 * cell, s.c('--ink-3'), 0.25);
        s.text('red channel, 5 × 5', gx, y0 + u * 3, { size: 3.3, align: 'left', color: s.c('--ink-3') });
        for (let a = 0; a < 5; a++)
          for (let b = 0; b < 5; b++) {
            const v = px(d.train, CAT, 0, r0 + a, c0 + b);
            const appear = s.ease('zoom', 0.3, 0.6 + (a * 5 + b) * 0.04);
            s.alpha(appear, () => {
              s.ctx.fillStyle = `rgb(${v},0,0)`;
              s.ctx.fillRect(gx + b * cell + 1, gy + a * cell + 1, cell - 2, cell - 2);
              const on = a === ROW - r0 && b === COL - c0;
              s.text(String(v), gx + (b + 0.5) * cell, gy + (a + 0.5) * cell + u * 0.2, { size: Math.min(3.6, (cell / u) * 0.34), font: 'mono', weight: on ? 700 : 500, color: '#ffffff' });
              if (on) s.rrect(gx + b * cell + 1, gy + a * cell + 1, cell - 2, cell - 2, 0.3, { stroke: '#ffffff', lw: 0.45 });
            });
          }
      });
    }
    // 3,072 numbers, and one word to produce.
    const sA = s.ease('shape', 0.6);
    if (sA > 0) {
      s.alpha(sA, () => {
        const cy = y0 + S * 0.22;
        s.text('32 × 32 × 3', rx, cy, { size: tall ? 5 : 6, font: 'display', weight: 560, align: 'left' });
        s.text('= 3,072 numbers', rx, cy + u * (tall ? 7.5 : 9), { size: tall ? 4.4 : 5.2, font: 'display', weight: 560, align: 'left', color: s.c('teal') });
        s.alpha(s.ease('job', 0.5), () => {
          const jy = cy + u * (tall ? 19 : 23);
          s.arrow(rx + u * 2, jy - u * 4, rx + u * 2, jy + u * 2, s.c('--ink-3'), 0.5, 2);
          pill(s, 'cat', rx + u * 6, jy, 'gold', { size: 4.6, font: 'serif', align: 'left', on: 1 });
          s.text('one word', rx + u * 22, jy, { size: 3.6, align: 'left', italic: true, color: s.c('--ink-2') });
        });
        s.alpha(late(s, 'job', 0.42), () => {
          s.text('nothing in the numbers', rx, y0 + S - u * 8, { size: 3.5, italic: true, align: 'left', color: s.c('--ink-2') });
          s.text('says “cat”', rx, y0 + S - u * 3, { size: 3.5, italic: true, align: 'left', color: s.c('--ink-2') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- hard

const TILES: [string, number | number[], string][] = [
  ['the cat', CAT, ''],
  ['viewpoint', 55, 'view'],
  ['scale', 189, 'scale'],
  ['deformation', 9, 'deform'],
  ['occlusion', 20, 'occl'],
  ['illumination', 268, 'light'],
  ['clutter', 299, 'clutter'],
  ['intra-class', [179, 218, 48, 192], 'intra'],
];

const hard: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    // The semantic gap: pixels on one side, meaning on the other.
    const gA = s.win('gap', 'each');
    if (gA > 0) {
      s.alpha(gA, () => {
        const S = Math.min(w * 0.34, h * 0.46);
        const cy = h * 0.56;
        photo(s, 'train', CAT, w * 0.27 - S / 2, cy - S / 2, S);
        numberBlock(s, w * 0.73, cy, S, tall ? 6 : 8, () => 1);
        s.alpha(late(s, 'gap', 0.45), () => {
          const ty = cy - S / 2 - u * 8;
          s.text('the semantic gap', w / 2, ty, { size: tall ? 5 : 5.6, font: 'display', weight: 600, color: s.c('--accent') });
          s.arrow(w / 2, ty + u * 4, w * 0.27, cy - S / 2 - u * 1.5, s.c('--accent'), 0.4, 2);
          s.arrow(w / 2, ty + u * 4, w * 0.73, cy - S / 2 - u * 1.5, s.c('--accent'), 0.4, 2);
        });
        s.text('meaning', w * 0.27, cy + S / 2 + u * 4.5, { size: 3.6, color: s.c('--ink-2') });
        s.text('pixel values', w * 0.73, cy + S / 2 + u * 4.5, { size: 3.6, color: s.c('--ink-2') });
      });
    }
    // Seven ways the numbers change while the answer does not.
    const tA = s.win('each', 'rules');
    if (tA > 0) {
      const [rx, ry, rw, rh] = area(s, 0.12, 0.04);
      const gap = u * 2.5;
      const labH = u * 6;
      const size = Math.min((rw - 3 * gap) / 4, (rh - 2 * labH - gap) / 2);
      const gw = 4 * size + 3 * gap;
      const gh = 2 * (size + labH) + gap;
      const ox = rx + (rw - gw) / 2;
      const oy = ry + (rh - gh) / 2;
      const walk = ['view', 'scale', 'deform', 'occl', 'light', 'clutter', 'intra'];
      let active = -1;
      walk.forEach((b, i) => {
        if (s.since(b) >= 0) active = i + 1;
      });
      const walking = s.since('view') >= 0 && s.since('inv') < 0;
      s.alpha(tA, () => {
        TILES.forEach(([name, img, beat], i) => {
          const x = ox + (i % 4) * (size + gap);
          const y = oy + Math.floor(i / 4) * (size + labH + gap);
          const appear = i === 0 ? 1 : i < 7 ? s.ease('each', 0.4, 0.4 + i * 0.35) : s.ease('intra', 0.5);
          const on = walking && active === i ? s.ease(beat, 0.4) : 0;
          const dim = walking && active !== i ? 0.4 : 1;
          s.alpha(appear * dim, () => {
            if (Array.isArray(img)) img.forEach((j, k) => photo(s, 'train', j, x + (k % 2) * (size / 2), y + Math.floor(k / 2) * (size / 2), size / 2, null));
            else photo(s, 'train', img, x, y, size);
            if (on > 0) s.rrect(x - u * 0.8, y - u * 0.8, size + u * 1.6, size + u * 1.6, 1.2, { stroke: s.tint('--accent', on), lw: 0.8 });
            s.text(name, x + size / 2, y + size + labH * 0.55, { size: tall ? 3.3 : 3.6, color: s.c(on > 0.5 ? '--accent' : '--ink-2'), weight: on > 0.5 ? 600 : 450 });
            const ok = s.ease('inv', 0.4, 0.8 + i * 0.12);
            if (ok > 0) s.alpha(ok, () => checkMark(s, x + size - u * 2.6, y + u * 2.6, u * 2.2));
          });
        });
      });
    }
    // Hand-written rules: pixels -> edges -> shapes -> "cat?"
    const rA = s.ease('rules', 0.6);
    if (rA > 0) {
      const d = cifar(s);
      const arrowW = u * (tall ? 6 : 8);
      const pillW = u * (tall ? 14 : 16);
      const T = Math.min((w - 2 * u * 5 - 3 * arrowW - pillW) / 3, h * 0.38);
      const total = 3 * T + 3 * arrowW + pillW;
      const x0 = (w - total) / 2;
      const cy = h * 0.47;
      const xs = [0, 1, 2].map((i) => x0 + i * (T + arrowW));
      const labels = ['pixels', 'edges', 'shapes'];
      s.alpha(rA, () => {
        xs.forEach((x, i) => {
          const a = s.ease('rules', 0.5, 2.2 + i * 1.1);
          s.alpha(i === 0 ? 1 : a, () => {
            if (i === 0) photo(s, 'train', CAT, x, cy - T / 2, T);
            else blit(s, d ? chwCanvas('edges-cat', edgeMap(d, CAT)) : null, x, cy - T / 2, T);
            if (i === 2) {
              const k = T / 32;
              const c = s.ctx;
              c.strokeStyle = s.c('--accent');
              c.lineWidth = u * 0.5;
              c.beginPath();
              c.moveTo(x + 3 * k, cy - T / 2 + 14 * k);
              c.lineTo(x + 6 * k, cy - T / 2 + 2 * k);
              c.lineTo(x + 12 * k, cy - T / 2 + 10 * k);
              c.moveTo(x + 21 * k, cy - T / 2 + 9 * k);
              c.lineTo(x + 27 * k, cy - T / 2 + 2 * k);
              c.lineTo(x + 29 * k, cy - T / 2 + 14 * k);
              c.stroke();
              c.beginPath();
              c.ellipse(x + 15 * k, cy - T / 2 + 21 * k, 12 * k, 9 * k, 0, 0, Math.PI * 2);
              c.stroke();
            }
            s.text(labels[i]!, x + T / 2, cy + T / 2 + u * 4, { size: 3.4, color: s.c('--ink-2') });
            if (i > 0) s.arrow(x - arrowW + u, cy, x - u, cy, s.c('--ink-3'), 0.45, 2);
          });
        });
        const px0 = xs[2]! + T + arrowW;
        s.alpha(s.ease('rules', 0.5, 4.6), () => {
          s.arrow(px0 - arrowW + u, cy, px0 - u, cy, s.c('--ink-3'), 0.45, 2);
          pill(s, 'cat?', px0 + pillW / 2, cy, 'gold', { size: tall ? 3.8 : 4.2, font: 'serif' });
        });
        const bA = s.ease('brittle', 0.5, 0.3);
        s.alpha(bA, () => {
          cross(s, px0 + pillW / 2 + u * 5.5, cy - u * 4.5, u * 2.4);
          const others = ['dog?', 'ship?', 'truck?'];
          others.forEach((t, i) =>
            s.alpha(late(s, 'brittle', 0.45 + i * 0.12, 0.4), () => {
              const yy = cy + T / 2 + u * (12 + i * 7);
              pill(s, t, w * 0.36, yy, '--ink', { size: 3.3, font: 'serif', align: 'right' });
              s.text('start over', w * 0.39, yy, { size: 3.3, italic: true, align: 'left', color: s.c('red') });
            }),
          );
        });
      });
    }
  },
};

// ---------------------------------------------------------------- data

const EXAMPLES: [number, string][] = [
  [CAT, 'cat'],
  [990, 'dog'],
  [8, 'ship'],
  [4, 'plane'],
  [24, 'frog'],
  [2, 'car'],
];
/** Test images and their 1-NN (L1) answers from the 1,000-image sample. */
const TESTS: [number, string, boolean][] = [
  [9, 'ship', true],
  [Q, 'cat', true],
  [35, 'plane', false],
];

const data: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const pA = s.win('learn', 'cifar');
    if (pA > 0) {
      const m = Math.max(u * 4, w * 0.04);
      const cw = (w - 2 * m) / 3;
      const cx = [0, 1, 2].map((i) => m + cw * (i + 0.5));
      const hy = h * (tall ? 0.2 : 0.2);
      const heads: [string, string, string][] = [
        ['1. input', 'N labeled images', 'input'],
        ['2. learning', 'build a model', 'training'],
        ['3. evaluation', 'label new images', 'eval'],
      ];
      s.alpha(pA, () => {
        heads.forEach(([t, sub, b], i) =>
          s.alpha(s.ease(b, 0.5), () => {
            s.text(t, cx[i]!, hy, { size: tall ? 4 : 4.6, font: 'display', weight: 600 });
            s.text(sub, cx[i]!, hy + u * 5.5, { size: 3.2, italic: true, color: s.c('--ink-3') });
          }),
        );
        s.alpha(s.win('learn', 'input'), () => s.text('labeled examples', cx[0]!, hy + u * 2.5, { size: tall ? 3.8 : 4.4, font: 'display', weight: 600 }));
        const t = Math.min(cw * 0.36, h * 0.15);
        const gy = hy + u * 11;
        EXAMPLES.forEach(([j, lab], k) => {
          const x = cx[0]! + (k % 2 === 0 ? -t - u * 1.2 : u * 1.2);
          const y = gy + Math.floor(k / 2) * (t + u * 5.5);
          s.alpha(s.ease('learn', 0.4, 0.6 + k * 0.25), () => {
            photo(s, 'train', j, x, y, t);
            s.text(lab, x + t / 2, y + t + u * 2.4, { size: 3, color: s.c('gold') });
          });
        });
        const my = gy + 1.5 * (t + u * 5.5) - u * 2;
        s.alpha(s.ease('training', 0.6), () => {
          const bw = Math.min(cw * 0.7, u * 26);
          const bh = u * 13;
          s.arrow(cx[0]! + t + u * 2.5, my, cx[1]! - bw / 2 - u * 1.5, my, s.c('--ink-3'), 0.5, 2);
          s.rrect(cx[1]! - bw / 2, my - bh / 2, bw, bh, 2, { fill: s.tint('purple', 0.1), stroke: s.c('purple'), lw: 0.5 });
          s.text('model', cx[1]!, my + u * 0.3, { size: 4.2, italic: true, weight: 600, color: s.c('purple') });
          s.text('train()', cx[1]!, my + bh / 2 + u * 4.5, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
        });
        s.alpha(s.ease('eval', 0.6), () => {
          const tt = Math.min(t, h * 0.13);
          const bw = Math.min(cw * 0.7, u * 26);
          TESTS.forEach(([q, lab, ok], k) => {
            const y = gy + k * (tt + u * 4);
            const x = cx[2]! - tt - u * 2;
            s.alpha(s.ease('eval', 0.4, 0.8 + k * 0.6), () => {
              s.line(cx[1]! + bw / 2 + u, my, x - u * 1.2, y + tt / 2, s.tint('purple', 0.5), 0.3);
              photo(s, 'test', q, x, y, tt);
              s.text(lab, x + tt + u * 2, y + tt / 2, { size: 3.2, align: 'left', color: s.c(ok ? 'green' : 'red'), weight: 600 });
              const lw = s.measure(lab, { size: 3.2 });
              (ok ? checkMark : crossMark)(s, x + tt + u * 4.5 + lw, y + tt / 2, u * 1.6);
            });
          });
          s.alpha(late(s, 'eval', 0.75), () => s.text('predict()', cx[2]!, gy + 3 * (tt + u * 4) + u * 1.5, { size: 3.2, font: 'mono', color: s.c('--ink-2') }));
        });
      });
    }
    // CIFAR-10, one class per row.
    const cA = s.ease('cifar', 0.7);
    if (cA > 0) {
      const d = cifar(s);
      const [rx, ry, rw, rh] = area(s, tall ? 0.16 : 0.15, 0.04);
      const labW = u * (tall ? 10 : 11);
      const gap = Math.max(1, u * 0.45);
      const size0 = (rh - 9 * gap) / 10;
      const cols = Math.max(4, Math.floor((rw - labW + gap) / (size0 + gap)));
      const size = Math.min(size0, (rw - labW - gap * (cols - 1)) / cols);
      const gx = rx + (rw - (labW + cols * (size + gap) - gap)) / 2;
      const focus = s.ease('rows', 0.6);
      const header = s.since('sample') >= 0 ? 'our sample: 1,000 train + 200 test' : '60,000 images: 50,000 train + 10,000 test';
      s.alpha(cA, () => {
        s.alpha(s.since('sample') >= 0 ? s.ease('sample', 0.5) : 1, () => s.text(header, w / 2, ry - u * 4.2, { size: tall ? 3.6 : 4, color: s.c('--ink-2') }));
        for (let c = 0; c < 10; c++) {
          const y = ry + c * (size + gap);
          const on = c === 3;
          s.alpha(focus > 0 && !on ? 1 - 0.65 * focus : 1, () => {
            s.alpha(s.ease('cifar', 0.4, 0.2 + c * 0.08), () => s.text(CIFAR_CLASSES[c]!, gx + labW - u * 2.2, y + size / 2, { size: tall ? 3 : 3.3, align: 'right', color: s.c(on && focus > 0.5 ? '--accent' : '--ink-2'), weight: on && focus > 0.5 ? 650 : 450 }));
            if (!d) return;
            let j = 0;
            for (let i = 0; i < d.train.n && j < cols; i++) {
              if (d.train.labels[i] !== c) continue;
              const x = gx + labW + j * (size + gap);
              s.alpha(s.ease('cifar', 0.35, 0.3 + c * 0.08 + j * 0.03), () => photo(s, 'train', i, x, y, size, null));
              j++;
            }
          });
          if (on && focus > 0) s.rrect(gx + labW - u * 0.9, y - u * 0.8, cols * (size + gap) - gap + u * 1.8, size + u * 1.6, 1, { stroke: s.tint('--accent', focus), lw: 0.6 });
        }
      });
    }
  },
};

function checkMark(s: Scene, x: number, y: number, r: number): void {
  s.circle(x, y, r, { fill: s.c('green') });
  s.line(x - r * 0.45, y, x - r * 0.1, y + r * 0.35, '#ffffff', 0.3);
  s.line(x - r * 0.1, y + r * 0.35, x + r * 0.5, y - r * 0.35, '#ffffff', 0.3);
}
function crossMark(s: Scene, x: number, y: number, r: number): void {
  s.circle(x, y, r, { fill: s.c('red') });
  s.line(x - r * 0.38, y - r * 0.38, x + r * 0.38, y + r * 0.38, '#ffffff', 0.3);
  s.line(x - r * 0.38, y + r * 0.38, x + r * 0.38, y - r * 0.38, '#ffffff', 0.3);
}
export { checkMark, crossMark };

// ---------------------------------------------------------------- l1

const WR = 18;
const WC = 0;

const l1: SceneDef = {
  marks: {
    d1: { tex: String.raw`\symd_1(\sym{Ia}{I_1}, \sym{Ib}{I_2}) = \sum_{p} \left| \sym{Ia}{I_1^{\,p}} - \sym{Ib}{I_2^{\,p}} \right|`, x: 0.5, y: 0.7, size: 5.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const d = cifar(s);
    // The classifier in two sentences.
    const aA = s.win('rule', 'two');
    if (aA > 0) {
      s.alpha(aA, () => {
        const x0 = Math.max(u * 5, w * 0.08);
        const y1 = h * 0.28;
        const y2 = h * 0.6;
        const fs = tall ? 3.6 : 4.2;
        s.alpha(s.ease('rule', 0.5, 0.6), () => {
          const pw = pill(s, 'train', x0, y1, 'teal', { size: fs, align: 'left' });
          s.text('memorize every image and its label', x0 + pw + u * 2.5, y1, { size: fs, align: 'left' });
          const t = Math.min(u * 11, (w - 2 * x0 - 4 * u * 2) / 6);
          EXAMPLES.forEach(([j, lab], k) => {
            const x = x0 + k * (t + u * 2.4);
            photo(s, 'train', j, x, y1 + u * 5, t);
            s.text(lab, x + t / 2, y1 + u * 7.4 + t, { size: 2.9, color: s.c('gold') });
          });
        });
        s.alpha(late(s, 'rule', 0.55), () => {
          const pw = pill(s, 'predict', x0, y2, 'orange', { size: fs, align: 'left' });
          s.text(tall ? 'most similar? copy its label' : 'find the most similar, copy its label', x0 + pw + u * 2.5, y2, { size: fs, align: 'left' });
        });
        s.alpha(s.ease('number', 0.5, 1.2), () => {
          const tw = s.measure(tall ? 'most similar' : 'find the most similar', { size: fs });
          const pw = s.measure('predict', { size: fs, font: 'mono' }) + u * fs * 0.9;
          const lx = x0 + pw + u * 2.5;
          s.line(lx, y2 + u * 3, lx + tw, y2 + u * 3, s.c('red'), 0.45);
          s.arrow(lx + tw * 0.5, y2 + u * 4.5, lx + tw * 0.5, y2 + u * 11, s.c('red'), 0.4, 1.8);
          s.text('a number: the distance d', lx + tw * 0.5 + u * 2, y2 + u * 14.5, { size: fs, align: 'left', color: s.c('red'), weight: 600 });
        });
      });
    }
    // I1, I2 and the picture of their gaps.
    const bA = s.win('two', 'wrap');
    if (bA > 0) {
      const gap = u * (tall ? 6 : 8);
      const T = Math.min((w - 2 * Math.max(u * 4, w * 0.04) - 2 * gap) / 3, h * 0.3);
      const x0 = (w - (3 * T + 2 * gap)) / 2;
      const y0 = h * (tall ? 0.13 : 0.12);
      const xs = [x0, x0 + T + gap, x0 + 2 * (T + gap)];
      const k = T / 32;
      s.alpha(bA, () => {
        photo(s, 'test', Q, xs[0]!, y0, T, s.c('orange'));
        photo(s, 'train', NN, xs[1]!, y0, T, s.c('blue'));
        s.text('I₁: test', xs[0]! + T / 2, y0 + T + u * 4, { size: 3.4, color: s.c('orange'), weight: 600 });
        s.text('I₂: train', xs[1]! + T / 2, y0 + T + u * 4, { size: 3.4, color: s.c('blue'), weight: 600 });
        const sub = s.ease('sub', 0.6);
        s.alpha(sub, () => {
          s.text('−', xs[1]! - gap / 2, y0 + T / 2, { size: 6, color: s.c('--ink-2') });
          s.text('=', xs[2]! - gap / 2, y0 + T / 2, { size: 6, color: s.c('--ink-2') });
          if (d) {
            const diff = signedDiff(d, Q, NN);
            const signed = chwCanvas('diff-signed', Array.from(diff, (v) => 128 + v / 2));
            const abs = chwCanvas('diff-abs', Array.from(diff, (v) => Math.abs(v)));
            const ab = s.ease('abs', 0.9, 0.6);
            blit(s, signed, xs[2]!, y0, T);
            s.alpha(ab, () => blit(s, abs, xs[2]!, y0, T));
            s.text(ab > 0.5 ? '|I₁ − I₂|' : 'I₁ − I₂', xs[2]! + T / 2, y0 + T + u * 4, { size: 3.4, color: s.c('--ink-2'), weight: 600 });
          }
        });
        // One position, worked by hand.
        const exA = s.win('sub', 'win');
        if (exA > 0 && d) {
          const a = px(d.test, Q, 0, WR, WC);
          const b = px(d.train, NN, 0, WR, WC);
          const ey = y0 + T + u * (tall ? 17 : 20);
          s.alpha(exA, () => {
            s.text(`${a} − ${b} = ${neg(a - b)}`, w / 2, ey, { size: tall ? 4.6 : 5.2, font: 'mono', weight: 600 });
            s.alpha(s.ease('abs', 0.6, 0.8), () => s.text(`|${neg(a - b)}| = ${Math.abs(a - b)}`, w / 2, ey + u * (tall ? 8 : 9), { size: tall ? 4.6 : 5.2, font: 'mono', weight: 600, color: s.c('red') }));
            s.alpha(s.ease('pic', 0.5, 0.4), () => {
              s.text('dark: the images agree', w / 2, ey + u * (tall ? 17 : 19), { size: 3.4, italic: true, color: s.c('--ink-2') });
              s.text('bright: they differ', w / 2, ey + u * (tall ? 22.5 : 25), { size: 3.4, italic: true, color: s.c('--ink-2') });
            });
          });
        }
        // The same 4 x 4 window in all three, as numbers.
        const wA = s.win('win', 'sum');
        if (wA > 0 && d) {
          const diff = signedDiff(d, Q, NN);
          const gy = y0 + T + u * 9;
          const cell = T / 4;
          s.alpha(wA, () => {
            xs.forEach((x) => {
              s.rrect(x + WC * k, y0 + WR * k, 4 * k, 4 * k, 0.2, { stroke: s.c('--card'), lw: 0.8 });
              s.rrect(x + WC * k, y0 + WR * k, 4 * k, 4 * k, 0.2, { stroke: s.c('--ink'), lw: 0.35 });
            });
            for (let g = 0; g < 3; g++)
              for (let r = 0; r < 4; r++)
                for (let c = 0; c < 4; c++) {
                  const v1 = px(d.test, Q, 0, WR + r, WC + c);
                  const v2 = px(d.train, NN, 0, WR + r, WC + c);
                  const v = g === 0 ? v1 : g === 1 ? v2 : Math.abs(diff[(WR + r) * 32 + WC + c]!);
                  const X = xs[g]! + c * cell;
                  const Y = gy + r * cell;
                  s.alpha(s.ease('win', 0.3, 0.5 + g * 0.5 + (r * 4 + c) * 0.02), () => {
                    s.ctx.fillStyle = g === 2 ? `rgb(${v},${v},${v})` : `rgb(${v},0,0)`;
                    s.ctx.fillRect(X + 1, Y + 1, cell - 2, cell - 2);
                    s.text(String(v), X + cell / 2, Y + cell / 2 + u * 0.2, { size: Math.min(3.4, (cell / u) * 0.36), font: 'mono', color: g === 2 && v > 140 ? '#000000' : '#ffffff' });
                  });
                }
          });
        }
        // The L1 distance: one number.
        const sA = s.ease('sum', 0.6);
        if (sA > 0 && d) {
          let tot = 0;
          for (const v of signedDiff(d, Q, NN)) tot += Math.abs(v);
          s.slot('d1', tot.toLocaleString('en-US'));
          s.show('d1', bA * sA, { y: (y0 + T + u * (tall ? 19 : 22)) / h });
          s.alpha(sA * s.ease('sum', 0.6, 1.4), () => {
            const ty = y0 + T + u * (tall ? 34 : 40);
            s.text(`d₁ = ${tot.toLocaleString('en-US')}`, w / 2, ty, { size: tall ? 5.4 : 6, font: 'mono', weight: 650, color: s.c('red') });
            s.alpha(late(s, 'sum', 0.62), () => s.text('0 = identical, bigger = more different', w / 2, ty + u * 7, { size: 3.4, italic: true, color: s.c('--ink-2') }));
          });
        }
      });
    }
    // Unsigned bytes wrap around.
    const cA = s.ease('wrap', 0.6, 0.2);
    if (cA > 0) {
      s.alpha(cA, () => {
        const R = tall ? Math.min(h * 0.17, w * 0.22) : Math.min(h * 0.27, w * 0.18);
        const cx = tall ? w / 2 : w * 0.3;
        const cy = tall ? h * 0.37 : h * 0.54;
        const ang = (v: number) => -Math.PI / 2 + (v / 256) * Math.PI * 2;
        s.circle(cx, cy, R, { stroke: s.c('--rule'), lw: 1.4 });
        for (let v = 0; v < 256; v += 16) {
          const a = ang(v);
          s.line(cx + Math.cos(a) * (R - u * 1.4), cy + Math.sin(a) * (R - u * 1.4), cx + Math.cos(a) * (R + u * 1.4), cy + Math.sin(a) * (R + u * 1.4), s.c('--ink-3'), 0.25);
        }
        [0, 64, 128, 192].forEach((v) => {
          const a = ang(v);
          s.text(String(v), cx + Math.cos(a) * (R - u * 6), cy + Math.sin(a) * (R - u * 6), { size: 3, font: 'mono', color: s.c('--ink-3') });
        });
        const p = s.ease('wrap', 1.6, 2.2);
        const c = s.ctx;
        if (p > 0) {
          c.beginPath();
          c.arc(cx, cy, R + u * 3.5, ang(10), ang(10 - 20 * p), true);
          c.strokeStyle = s.c('red');
          c.lineWidth = u * 0.6;
          c.stroke();
        }
        const dot = (v: number, k: Color, lab: string, out: number) => {
          const a = ang(v);
          s.circle(cx + Math.cos(a) * R, cy + Math.sin(a) * R, u * 1.6, { fill: s.c(k), stroke: s.c('--card'), lw: 0.4 });
          s.text(lab, cx + Math.cos(a) * (R + u * out), cy + Math.sin(a) * (R + u * out), { size: 3.8, font: 'mono', weight: 650, color: s.c(k), halo: true });
        };
        dot(10, 'orange', '10', 9);
        s.alpha(p >= 1 ? 1 : 0, () => dot(246, 'red', '246', 9));
        const tx = tall ? w / 2 : w * 0.52;
        const ty = tall ? cy + R + u * 12 : h * 0.4;
        const al: CanvasTextAlign = tall ? 'center' : 'left';
        const cs = Math.min(tall ? 3.6 : 3.8, ((tall ? w - 2 * u * 5 : w - tx - u * 6) / s.measure('np.uint8(10) - np.uint8(20)', { size: 1, font: 'mono' })) * 0.98);
        s.text('np.uint8(10) - np.uint8(20)', tx, ty, { size: cs, font: 'mono', align: al });
        s.alpha(s.ease('wrap', 0.5, 3.6), () => s.text('→ 246', tx, ty + u * 7, { size: 5, font: 'mono', weight: 650, align: al, color: s.c('red') }));
        s.alpha(s.ease('astype', 0.5, 0.8), () => {
          s.text('after .astype(np.int32):', tx, ty + u * (tall ? 14.5 : 17), { size: 3.6, align: al, color: s.c('--ink-2') });
          s.text('10 - 20 → -10', tx, ty + u * (tall ? 21 : 24), { size: 5, font: 'mono', weight: 650, align: al, color: s.c('green') });
        });
      });
    }
  },
};

export const scenesA: Record<string, SceneDef> = { intro, task, hard, data, l1 };
