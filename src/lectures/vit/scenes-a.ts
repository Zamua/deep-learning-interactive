import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { traceOf } from '../../lib/vit-figs';
import { MAIN, data } from './data';
import { type K, block, current, grid, pill, pix, strip, title } from './kit';

/** Placeholder while the model and images load. */
export function loading(s: Scene): void {
  s.text('loading the trained tiny ViT…', s.w / 2, s.h / 2, { size: 3.6, italic: true, color: s.c('--ink-3') });
}

/** Patch k of a G x G grid over a 32 x 32 image: draws it at (x, y) with side t. */
function patch(s: Scene, src: CanvasImageSource, k: number, G: number, x: number, y: number, t: number): void {
  const P = 32 / G;
  pix(s, src, x, y, t, t, (k % G) * P, Math.floor(k / G) * P, P, P);
}

// ---------------------------------------------------------------- intro

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = data(s);
    title(s, 'Vision transformers', 'an image is worth 16 × 16 words', s.win('hello', 'convs'));
    // Two beliefs: a ConvNet's and a transformer's.
    const pA = s.win('convs', 'question');
    if (pA > 0) {
      const tall = s.tall;
      const pw = tall ? w - 10 * u : (w - 15 * u) / 2;
      const ph = tall ? (h - 15 * u) / 2 : h - 10 * u;
      const ax = 5 * u, ay = 5 * u;
      const bx = tall ? ax : ax + pw + 5 * u, by = tall ? ay + ph + 5 * u : ay;
      s.alpha(pA, () => {
        s.rrect(ax, ay, pw, ph, 2.5, { fill: s.tint('blue', 0.05), stroke: s.tint('blue', 0.5), lw: 0.3 });
        s.text('ConvNet', ax + 4 * u, ay + 6 * u, { size: 4.6, font: 'display', weight: 600, align: 'left', color: s.c('blue') });
        const S = tall ? Math.min(ph - 16 * u, pw * 0.5) : Math.min(ph - 34 * u, pw * 0.6);
        const ix = ax + 4 * u, iy = ay + 11 * u;
        if (d) pix(s, d.img(MAIN), ix, iy, S, S);
        // a 3x3-pixel filter sliding in raster order
        const p = s.span('beliefs', 'tf');
        const steps = 6;
        const k = Math.min(steps * steps - 1, Math.floor(p * steps * steps));
        const fx = ix + ((k % steps) / steps) * (S - (3 * S) / 32), fy = iy + (Math.floor(k / steps) / steps) * (S - (3 * S) / 32);
        s.alpha(s.ease('beliefs', 0.5), () => s.rrect(fx, fy, (3 * S) / 32 + 2, (3 * S) / 32 + 2, 0.4, { stroke: s.c('blue'), lw: 0.7 }));
        const side = ix + S + 4 * u + s.measure('one filter, everywhere', { size: 3.8, font: 'ui', weight: 600 }) < ax + pw - 2 * u;
        const tx = side ? ix + S + 4 * u : ix;
        const ty = side ? iy + S * 0.3 : iy + S + 6 * u;
        s.alpha(s.ease('beliefs', 0.6), () => {
          s.text('look locally', tx, ty, { size: 3.8, align: 'left', font: 'ui', weight: 600 });
          s.text('one filter, everywhere', tx, ty + 6 * u, { size: 3.8, align: 'left', font: 'ui', weight: 600 });
        });
      });
      s.alpha(pA * s.ease('tf', 0.6), () => {
        s.rrect(bx, by, pw, ph, 2.5, { fill: s.tint('purple', 0.05), stroke: s.tint('purple', 0.5), lw: 0.3 });
        s.text('Transformer', bx + 4 * u, by + 6 * u, { size: 4.6, font: 'display', weight: 600, align: 'left', color: s.c('purple') });
        const n = 7;
        const cy = by + ph * 0.62;
        const xs = Array.from({ length: n }, (_, i) => bx + pw * (0.12 + (0.76 * i) / (n - 1)));
        const r = Math.min(3.2 * u, pw / n / 3);
        for (let i = 0; i < n; i++)
          for (let j = i + 1; j < n; j++) {
            const c = s.ctx;
            c.beginPath();
            c.moveTo(xs[i]!, cy - r);
            c.quadraticCurveTo((xs[i]! + xs[j]!) / 2, cy - r - (xs[j]! - xs[i]!) * 0.45, xs[j]!, cy - r);
            c.strokeStyle = s.tint('purple', 0.35);
            c.lineWidth = 0.25 * u;
            c.stroke();
          }
        xs.forEach((x) => s.circle(x, cy, r, { fill: s.tint('purple', 0.2), stroke: s.c('purple'), lw: 0.3 }));
        s.text('every token attends to every token', bx + pw / 2, cy + r + 6 * u, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
      });
    }
    // The answer: cut the image into patches and line them up.
    const pB = s.win('question', 'plan');
    if (pB > 0 && d) {
      const src = d.img(MAIN);
      const S0 = Math.min(h * 0.42, w * 0.42);
      const cut = s.ease('answer', 0.6, 0.4);
      const fly = s.ease('answer', 1.6, 2.2);
      const G = 4;
      const n = 16;
      const per = s.tall ? 8 : 16;
      const t1 = Math.min((w - 10 * u) / per - 0.8 * u, 11 * u);
      const rowW = per * (t1 + 0.8 * u) - 0.8 * u;
      const rows = n / per;
      const S = lerp(S0, S0 * 0.5, fly);
      const ix = (w - S) / 2, iy = 6 * u;
      const t0 = S / G;
      const ry = iy + S + 6 * u;
      s.alpha(pB, () => {
        s.alpha(fly * 0.18, () => pix(s, src, ix, iy, S, S));
        for (let k = 0; k < n; k++) {
          const gx = ix + (k % G) * t0, gy = iy + Math.floor(k / G) * t0;
          const sx = (w - rowW) / 2 + (k % per) * (t1 + 0.8 * u);
          const sy = ry + Math.floor(k / per) * (t1 + 0.8 * u);
          const gap = cut * 0.6 * u;
          patch(s, src, k, G, lerp(gx + gap * ((k % G) - 1.5), sx, fly), lerp(gy + gap * (Math.floor(k / G) - 1.5), sy, fly), lerp(t0, t1, fly));
        }
        const yb = ry + rows * (t1 + 0.8 * u);
        s.alpha(fly, () => {
          s.text('16 patches = 16 "words"', w / 2, yb + 4 * u, { size: 3.8, font: 'ui', weight: 600, color: s.c('orange') });
          s.arrow(w / 2, yb + 7.5 * u, w / 2, yb + 12 * u, s.c('--ink-3'), 0.4, 2);
          block(s, w / 2 - 22 * u, yb + 13 * u, 44 * u, 9 * u, 'transformer', 'purple', 3.8);
        });
        s.alpha(s.ease('result', 0.6), () => s.text('matched the best ConvNets, given enough data', w / 2, Math.min(h - 5 * u, yb + 29 * u), { size: 3.6, italic: true, color: s.c('--ink-2') }));
      });
    }
    // The plan.
    const pC = s.ease('plan', 0.6);
    if (pC > 0) {
      const items: [string, K][] = [['build it on real images', 'orange'], ['look inside a trained one', 'purple'], ['what did it give up?', 'red']];
      items.forEach(([t, k], i) => s.alpha(pC * s.ease('plan', 0.5, 0.7 * i), () => pill(s, t, w / 2, h * 0.3 + i * 13 * u, k, 4, 'center', 'ui')));
    }
  },
};

// ---------------------------------------------------------------- patches

const patches: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = data(s);
    if (!d) return loading(s);
    const src = d.img(MAIN);
    const tall = s.tall;
    const S = tall ? Math.min(h * 0.5, w * 0.6) : Math.min(h * 0.72, w * 0.4);
    const ix = tall ? (w - S) / 2 : 6 * u;
    const iy = tall ? 5 * u : (h - S) / 2;
    const rx = tall ? 6 * u : ix + S + 8 * u;
    const ry = tall ? iy + S + 7 * u : iy;
    const rw = w - rx - 6 * u;
    const beat = current(s, ['seq', 'count', 'square', 'group', 'cifar', 'order', 'unroll', 'vit', 'cheap', 'dial', 'names']);
    const phaseD = s.ease('dial', 0.6);
    // the image (phases A to C)
    s.alpha(1 - phaseD, () => {
      const fly = s.ease('unroll', 1.4, 0.2);
      const G = 4;
      if (fly < 1) {
        s.alpha(1 - fly, () => {
          pix(s, src, ix, iy, S, S);
          s.alpha(s.win('seq', 'group'), () => grid(s, ix, iy, S, 32, 'rgba(255,255,255,0.35)', 0.1));
          s.alpha(s.ease('group', 0.6), () => grid(s, ix, iy, S, G, 'rgba(255,255,255,0.9)', 0.35));
        });
      }
      // reading order
      s.alpha(s.win('order', 'unroll') * (1 - fly), () => {
        const shown = Math.floor(clamp01(s.prog('order') * 1.4) * 16);
        for (let k = 0; k < shown; k++) {
          const cx = ix + ((k % G) + 0.5) * (S / G), cy = iy + (Math.floor(k / G) + 0.5) * (S / G);
          s.circle(cx, cy, 3.4 * u, { fill: s.tint('--card', 0.85) });
          s.text(String(k), cx, cy + 0.2 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('orange') });
        }
      });
      // the sequence, and one patch unrolled
      if (fly > 0) {
        const n = 16;
        const per = tall ? 8 : 16;
        const t1 = Math.min((w - 12 * u) / per - 0.8 * u, tall ? 11 * u : 8 * u);
        const rowW = per * (t1 + 0.8 * u) - 0.8 * u;
        const sy = tall ? 9 * u : h * 0.3;
        for (let k = 0; k < n; k++) {
          const gx = ix + (k % G) * (S / G), gy = iy + Math.floor(k / G) * (S / G);
          const sx = (w - rowW) / 2 + (k % per) * (t1 + 0.8 * u);
          patch(s, src, k, G, lerp(gx, sx, fly), lerp(gy, sy + Math.floor(k / per) * (t1 + 0.8 * u), fly), lerp(S / G, t1, fly));
        }
        const seqH = (n / per) * (t1 + 0.8 * u);
        s.alpha(s.win('unroll', 'vit') * fly, () => {
          s.text('the sequence: 16 patches', w / 2, sy - 3 * u, { size: 3.4, font: 'ui', weight: 600, color: s.c('--ink-2') });
          const px = d.a.test.pixels;
          const vals: number[] = [];
          const o = MAIN * 3072;
          for (let q = 0; q < 192; q++) {
            const c = q % 3, pi = Math.floor(q / 3);
            vals.push(px[o + c * 1024 + Math.floor(pi / 8) * 32 + (pi % 8)]! / 255);
          }
          const by = sy + seqH + 9 * u, bw = w - 12 * u, bh = 6 * u;
          s.arrow((w - rowW) / 2 + t1 / 2, sy + t1 + 1 * u, 6 * u + 2 * u, by - 1 * u, s.c('orange'), 0.35, 2);
          vals.forEach((v, q) => {
            const c = q % 3;
            s.ctx.fillStyle = `rgb(${c === 0 ? Math.round(v * 255) : 0},${c === 1 ? Math.round(v * 255) : 0},${c === 2 ? Math.round(v * 255) : 0})`;
            s.ctx.fillRect(6 * u + (q * bw) / 192, by, bw / 192 + 0.4, bh);
          });
          s.text('patch 0 as one row: 8 × 8 pixels × 3 colors = 192 numbers', w / 2, by + bh + 4.5 * u, { size: 3.3, font: 'ui', color: s.c('orange') });
        });
      }
    });
    // right-hand notes for the pixel and patch phases
    const note = (lines: [string, K | '--ink' | '--ink-2', number][], a: number, y0 = ry + 4 * u) =>
      s.alpha(a, () => lines.forEach(([t, k, sz], i) => s.text(t, tall ? w / 2 : rx, y0 + i * 7.5 * u, { size: sz, font: 'ui', weight: 600, align: tall ? 'center' : 'left', color: s.c(k) })));
    note([['every pixel a token?', '--ink', 4.2], ['224 × 224 photo: 50,176 tokens', '--ink-2', 3.6]], s.win('seq', 'square') * s.ease('count', 0.5));
    if (beat === 'seq') note([['every pixel a token?', '--ink', 4.2]], s.ease('seq', 0.5) * (1 - s.ease('count', 0.5)));
    note([['attention pairs: 50,176²', '--ink-2', 3.6], ['≈ 2.5 billion per layer', 'red', 4.4]], s.win('square', 'group'));
    note([['cut into P × P patches', '--ink', 4.2], ['32 × 32 image, P = 8', '--ink-2', 3.6], ['a 4 × 4 grid: 16 patches', 'orange', 3.8]], s.win('group', 'unroll') * s.ease('cifar', 0.5));
    if (beat === 'group') note([['cut into P × P patches', '--ink', 4.2]], s.ease('group', 0.5) * (1 - s.ease('cifar', 0.5)));
    // full-size numbers
    const pC = s.win('vit', 'dial');
    if (pC > 0) {
      s.alpha(pC, () => {
        const cy = tall ? h * 0.62 : h * 0.66;
        s.text('224 × 224 photo, P = 16', w / 2, cy - 12 * u, { size: 4, font: 'ui', weight: 600 });
        s.text('N = 196 patches × 768 numbers', w / 2, cy - 5 * u, { size: 4.2, font: 'mono', weight: 600, color: s.c('orange') });
        s.alpha(s.ease('cheap', 0.6), () => {
          s.text('pairs: 196² = 38,416 instead of 2.5 billion', w / 2, cy + 4 * u, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
          s.text('65,536 times fewer', w / 2, cy + 11 * u, { size: 4.4, font: 'display', weight: 600, color: s.c('green') });
        });
      });
    }
    // the dial: three patch sizes
    if (phaseD > 0) {
      s.alpha(phaseD, () => {
        const opts: [number, string][] = [[16, 'P = 16'], [8, 'P = 8'], [4, 'P = 4']];
        const T = Math.min((w - 20 * u) / 3, h * 0.5);
        const y0 = (h - T) / 2 - 4 * u;
        opts.forEach(([P, lab], i) => {
          const x = 5 * u + i * (T + 5 * u) + (w - 10 * u - 3 * T - 10 * u) / 2;
          const G = 32 / P;
          pix(s, src, x, y0, T, T);
          grid(s, x, y0, T, G, 'rgba(255,255,255,0.9)', 0.3);
          s.text(lab, x + T / 2, y0 + T + 5 * u, { size: 3.8, font: 'mono', weight: 600, color: s.c('slate') });
          s.text(`N = ${G * G}`, x + T / 2, y0 + T + 11 * u, { size: 3.8, font: 'mono', weight: 600, color: s.c('orange') });
          s.text(`${G * G * G * G} pairs`, x + T / 2, y0 + T + 17 * u, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
        });
        s.alpha(s.ease('names', 0.6), () => pill(s, 'ViT-B/16 = Base model, 16 × 16 patches', w / 2, y0 - 5 * u, 'slate', 3.6, 'center', 'ui'));
      });
    }
  },
};

// ---------------------------------------------------------------- tokens

const tokens: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = data(s);
    if (!d) return loading(s);
    const m = d.a.vit;
    const src = d.img(MAIN);
    const tall = s.tall;
    const PK = [26, 27, 28, 29, 30, 31];
    const n = PK.length;
    const filt = s.win('filters', 'cls');
    // the token row (shifts left while the filters panel is open on a wide stage)
    const avail = tall ? w - 22 * u : w * 0.6;
    const slot = Math.min(13 * u, avail / (n + 1));
    const colW = slot / 1.45;
    const rowX = tall ? 17 * u + (avail - (n + 1) * slot) / 2 : Math.max(17 * u, w / 2 - ((n + 1) * slot) / 2);
    const yImg = 6 * u;
    const yP = yImg + colW + 2.5 * u;
    const pH = h * (tall ? 0.16 : 0.2);
    const yE = yP + pH + 3 * u;
    const yT = yE + 10 * u;
    const tH = h * (tall ? 0.19 : 0.23);
    const yPos = yT + tH + 4 * u;
    const posH = tH * 0.5;
    const xp = m.patches(d.a.test.pixels, MAIN * 3072);
    const tr = traceOf(d.a, m, MAIN);
    let mxp = 1e-9, mxe = 1e-9, mxpos = 1e-9, mxc = 1e-9;
    for (const k of PK) {
      for (let i = 0; i < 48; i++) mxp = Math.max(mxp, Math.abs(xp[k * 48 + i]!));
      for (let i = 0; i < 64; i++) mxe = Math.max(mxe, Math.abs(tr.emb[k * 64 + i]!));
      for (let i = 0; i < 64; i++) mxpos = Math.max(mxpos, Math.abs(m.pos[(k + 1) * 64 + i]!));
    }
    for (let i = 0; i < 64; i++) mxc = Math.max(mxc, Math.abs(m.cls[i]!));
    const G = m.G;
    const showCls = s.ease('cls', 0.7);
    const showPos = s.ease('pos', 0.7);
    const rowA = 1 - 0.85 * filt;
    const lab = (t: string, y: number, k: K) => s.text(t, rowX - 1.5 * u, y, { size: 3.3, font: 'mono', weight: 600, align: 'right', color: s.c(k) });
    s.alpha(rowA, () => {
      PK.forEach((pk, k) => {
        const x = rowX + (k + 1) * slot;
        patch(s, src, pk, G, x, yImg, colW);
        strip(s, x + colW * 0.25, yP, colW * 0.5, pH, Array.from(xp.subarray(pk * 48, (pk + 1) * 48), (v) => v / mxp), 'orange', true);
        s.alpha(s.ease('E', 0.8, 0.4 + 0.15 * k), () => strip(s, x + colW * 0.2, yT, colW * 0.6, tH, Array.from(tr.emb.subarray(pk * 64, (pk + 1) * 64), (v) => v / mxe), 'green', true));
        s.alpha(showPos, () => strip(s, x + colW * 0.2, yPos, colW * 0.6, posH, Array.from(m.pos.subarray((pk + 1) * 64, (pk + 2) * 64), (v) => v / mxpos), 'red', true));
      });
      s.text('…', rowX + (n + 1) * slot + colW * 0.2, yP + pH / 2, { size: 5, color: s.c('--ink-3') });
      lab('patches', yP + pH / 2, 'orange');
      s.alpha(s.ease('E', 0.6), () => {
        const x0 = rowX + slot, x1 = rowX + n * slot + colW;
        s.rrect(x0 - 1 * u, yE - 1.2 * u, x1 - x0 + 2 * u, 6.4 * u, 1.2, { fill: s.tint('blue', 0.12), stroke: s.c('blue'), lw: 0.35 });
        s.text('@ E  (48 × 64)', (x0 + x1) / 2, yE + 2 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('blue') });
        lab('tokens', yT + tH / 2, 'green');
      });
      s.alpha(showCls, () => {
        const x = rowX + lerp(-1.5, 0, showCls) * slot;
        strip(s, x + colW * 0.2, yT, colW * 0.6, tH, Array.from(m.cls, (v) => v / mxc), 'gold', true);
        s.text('cls', x + colW / 2, yT - 2.5 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c('gold') });
      });
      s.alpha(showPos, () => {
        strip(s, rowX + colW * 0.2, yPos, colW * 0.6, posH, Array.from(m.pos.subarray(0, 64), (v) => v / mxpos), 'red', true);
        lab('+ E_pos', yPos + posH / 2, 'red');
      });
    });
    const py = Math.min(h - 4.5 * u, yPos + posH + 6 * u);
    s.alpha(s.win('learned', 'z0'), () => pill(s, 'cls and E_pos: random at first, then trained', w / 2, py, 'gold', 3.2, 'center', 'ui'));
    s.alpha(s.ease('z0', 0.6), () => pill(s, 'z0: 65 rows of D = 64 numbers', w / 2, py, 'green', 3.2, 'center', 'ui'));
    // the filters of E
    if (filt > 0) {
      s.alpha(filt, () => {
        const T = tall ? Math.min(w * 0.62, h * 0.62) : Math.min(w * 0.36, h * 0.62);
        const fx = tall ? (w - T) / 2 : w - T - 6 * u;
        const fy = tall ? 14 * u : (h - T) / 2;
        s.rrect(fx - 3 * u, fy - 8 * u, T + 6 * u, T + 17 * u, 2, { fill: s.c('--card'), stroke: s.tint('blue', 0.6), lw: 0.3 });
        s.text('columns of E as filters', fx + T / 2, fy - 3.5 * u, { size: 3.3, font: 'ui', weight: 600, color: s.c('blue') });
        const t = T / 8;
        for (let o = 0; o < 64; o++) {
          let lo = Infinity, hi = -Infinity;
          for (let q = 0; q < 48; q++) {
            lo = Math.min(lo, m.E[o * 48 + q]!);
            hi = Math.max(hi, m.E[o * 48 + q]!);
          }
          for (let q = 0; q < 16; q++) {
            const rgb = [0, 1, 2].map((c) => Math.round((255 * (m.E[o * 48 + q * 3 + c]! - lo)) / (hi - lo + 1e-9)));
            s.ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
            s.ctx.fillRect(fx + (o % 8) * t + (q % 4) * (t * 0.22) + t * 0.06, fy + Math.floor(o / 8) * t + Math.floor(q / 4) * (t * 0.22) + t * 0.06, t * 0.22 + 0.4, t * 0.22 + 0.4);
          }
        }
        s.alpha(s.ease('conv', 0.6), () => s.text('a conv: size P, stride P', fx + T / 2, fy + T + 4.5 * u, { size: 3.3, font: 'mono', weight: 600, color: s.c('blue') }));
      });
    }
    s.alpha(s.win('little', 'cls'), () => pill(s, 'all ViT keeps from ConvNets', w / 2, tall ? h - 5 * u : py, 'blue', 3.2, 'center', 'ui'));
  },
};

// ---------------------------------------------------------------- encoder

const encoder: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const beat = current(s, ['same', 'recap', 'recap2', 'block', 'only', 'mlp', 'stack', 'head', 'reads', 'tiny']);
    // tokens with attention from one query
    const n = 7;
    const ty = h * 0.22;
    const xs = Array.from({ length: n }, (_, i) => w * (0.15 + (0.7 * i) / (n - 1)));
    const r = Math.min(3.4 * u, w / n / 4);
    const q = beat === 'only' ? 6 : 3;
    const wts = [0.08, 0.22, 0.1, 0.25, 0.05, 0.18, 0.12];
    const att = s.win('recap', 'stack');
    s.alpha(att, () => {
      for (let j = 0; j < n; j++) {
        if (j === q) continue;
        const c = s.ctx;
        c.beginPath();
        c.moveTo(xs[q]!, ty - r);
        c.quadraticCurveTo((xs[q]! + xs[j]!) / 2, ty - r - Math.min(ty - r - 2 * u, Math.abs(xs[j]! - xs[q]!) * 0.35 + 2 * u) * 2, xs[j]!, ty - r);
        c.strokeStyle = s.tint('purple', 0.25 + 1.6 * wts[j]! * s.ease('recap2', 0.6));
        c.lineWidth = (0.2 + 2.2 * wts[j]! * s.ease('recap2', 0.6)) * u;
        c.stroke();
      }
    });
    s.alpha(s.ease('same', 0.5) * (1 - s.ease('stack', 0.6)), () => {
      xs.forEach((x, i) => s.circle(x, ty, r, { fill: s.tint(i === 0 ? 'gold' : 'green', 0.2), stroke: s.c(i === 0 ? 'gold' : 'green'), lw: i === q && att > 0 ? 0.7 : 0.3 }));
      s.alpha(s.win('recap', 'block'), () => {
        s.text('q', xs[q]!, ty + r + 4 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('purple') });
        s.text('k, v from every token', w / 2, ty + r + 9.5 * u, { size: 3.3, font: 'ui', color: s.c('--ink-2') });
      });
    });
    // the block
    const bA = s.ease('same', 0.6) * (0.35 + 0.65 * s.ease('block', 0.6)) * (1 - s.ease('head', 0.6));
    if (bA > 0) {
      s.alpha(bA, () => {
        const parts: [string, K][] = [['LN', 'slate'], ['MSA', 'purple'], ['+', '--ink-2'], ['LN', 'slate'], ['MLP', 'teal'], ['+', '--ink-2']];
        const y = h * 0.58;
        const bw = Math.min(14 * u, (w - 16 * u) / 7.2);
        const gap = (w - 10 * u - parts.length * bw) / (parts.length - 1);
        let x = 5 * u;
        parts.forEach(([lab, k], i) => {
          const on = (lab === 'MSA' && (beat === 'only' || beat === 'block')) || (lab === 'MLP' && (beat === 'mlp' || beat === 'block')) ? 1 : 0;
          if (lab === '+') {
            s.circle(x + bw / 2, y, 3 * u, { fill: s.c('--card'), stroke: s.c('--ink-2'), lw: 0.3 });
            s.text('+', x + bw / 2, y + 0.3 * u, { size: 4, font: 'mono', weight: 600, color: s.c('--ink-2') });
          } else {
            s.rrect(x, y - 4.5 * u, bw, 9 * u, 1.5, { fill: s.tint(k, 0.1 + 0.2 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.3 + 0.3 * on });
            s.text(lab, x + bw / 2, y, { size: 3.6, font: 'mono', weight: 650, color: s.c(k) });
          }
          if (i < parts.length - 1) s.arrow(x + bw + 0.5 * u, y, x + bw + gap - 0.5 * u, y, s.c('--ink-3'), 0.3, 1.5);
          x += bw + gap;
        });
        // residual bypasses
        const xAt = (i: number) => 5 * u + i * (bw + gap);
        for (const [a, b] of [[0, 2], [3, 5]] as const) {
          const x0 = xAt(a) - 1.5 * u, x1 = xAt(b) + bw / 2;
          s.line(x0, y, x0, y - 9 * u, s.c('--ink-3'), 0.3);
          s.line(x0, y - 9 * u, x1, y - 9 * u, s.c('--ink-3'), 0.3);
          s.arrow(x1, y - 9 * u, x1, y - 3.2 * u, s.c('--ink-3'), 0.3, 1.5);
        }
        s.text('residual', (xAt(0) + xAt(2)) / 2, y - 11 * u, { size: 3, italic: true, color: s.c('--ink-3') });
        s.alpha(s.ease('only', 0.5) * (1 - s.ease('mlp', 0.5)), () => s.text('patches meet only here', xAt(1) + bw / 2, y + 9 * u, { size: 3.3, font: 'ui', weight: 600, color: s.c('purple') }));
        s.alpha(s.ease('mlp', 0.5) * (1 - s.ease('stack', 0.5)), () => s.text('each token alone', xAt(4) + bw / 2, y + 9 * u, { size: 3.3, font: 'ui', weight: 600, color: s.c('teal') }));
        s.alpha(s.ease('stack', 0.5), () => {
          s.text('× L', w - 5 * u, y - 13 * u, { size: 5, font: 'mono', weight: 650, align: 'right', color: s.c('--ink') });
          const rows = [['ViT-Base', '12 layers · D = 768 · 86 M'], ['ViT-Large', '24 layers · D = 1,024 · 307 M'], ['ViT-Huge', '32 layers · D = 1,280 · 632 M']];
          rows.forEach(([a, b], i) => {
            const yy = y + 15 * u + i * 7 * u;
            s.text(a!, w * 0.32, yy, { size: 3.6, font: 'ui', weight: 650, align: 'right' });
            s.text(b!, w * 0.35, yy, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink-2') });
          });
        });
      });
    }
    // the head
    const hA = s.ease('head', 0.6) * (1 - s.ease('tiny', 0.6));
    if (hA > 0) {
      s.alpha(hA, () => {
        const y = h * 0.45;
        const x0 = 8 * u;
        s.circle(x0 + 3 * u, y, 3.4 * u, { fill: s.tint('gold', 0.25), stroke: s.c('gold'), lw: 0.4 });
        s.text('z_L[0]', x0 + 3 * u, y + 7.5 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('gold') });
        s.arrow(x0 + 8 * u, y, x0 + 15 * u, y, s.c('--ink-3'), 0.35, 1.6);
        block(s, x0 + 16 * u, y - 5 * u, 16 * u, 10 * u, 'LN', 'slate', 3.6);
        s.arrow(x0 + 33 * u, y, x0 + 40 * u, y, s.c('--ink-3'), 0.35, 1.6);
        block(s, x0 + 41 * u, y - 5 * u, 20 * u, 10 * u, 'W_head', 'blue', 3.4);
        s.arrow(x0 + 62 * u, y, x0 + 69 * u, y, s.c('--ink-3'), 0.35, 1.6);
        const sc = [0.1, 0.05, 0.6, 0.08, 0.04, 0.03, 0.05, 0.02, 0.02, 0.01];
        const bx = x0 + 71 * u, bwid = Math.max(6 * u, w - bx - 6 * u);
        sc.forEach((v, i) => {
          const yy = y - 10 * u + i * 2.2 * u;
          s.rrect(bx, yy, Math.max(0.4 * u, bwid * v), 1.6 * u, 0.3, { fill: s.tint('purple', i === 2 ? 0.8 : 0.35) });
        });
        s.text('10 scores', bx, y + 15 * u, { size: 3.2, font: 'ui', align: 'left', color: s.c('purple') });
        s.alpha(s.ease('reads', 0.6), () => s.text('one learned start vector, filled in layer by layer', w / 2, h * 0.72, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      });
    }
    // the tiny model
    s.alpha(s.ease('tiny', 0.6), () => {
      const d = data(s);
      const cw = Math.min(w - 12 * u, 90 * u);
      const cx = (w - cw) / 2, cy = h * 0.3;
      s.rrect(cx, cy, cw, 44 * u, 2.5, { fill: s.tint('purple', 0.06), stroke: s.tint('purple', 0.6), lw: 0.35 });
      s.text('the tiny ViT in this lecture', w / 2, cy + 7 * u, { size: 4.2, font: 'display', weight: 600, color: s.c('purple') });
      const lines = ['P = 4: 64 patches of 48 numbers', 'D = 64, 6 layers, 4 heads', '0.3 million parameters', `trained on CIFAR-10: ${d ? Math.round(d.a.vit.testAcc * 100) : 80}% on its test set`];
      lines.forEach((t, i) => s.text(t, w / 2, cy + 16 * u + i * 7 * u, { size: 3.6, font: 'mono', color: s.c('--ink-2') }));
    });
  },
};

export const scenesA: Record<string, SceneDef> = { intro, patches, tokens, encoder };
