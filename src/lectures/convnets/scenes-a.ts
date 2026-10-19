import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { VEDGE, cifar, filterTiles } from './data';
import { type K, box, check, dashed, depthVec, flash, frame, pic, pill, slices, wire } from './kit';

// ---------------------------------------------------------------- intro

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const P = cifar(s);
    s.alpha(s.win('hello', 'flat'), () => {
      s.text('Convolutional networks', w / 2, h * 0.44, { size: 8, font: 'display', weight: 600 });
      s.text('seeing in patches', w / 2, h * 0.57, { size: 4.6, italic: true, color: s.c('--ink-2') });
    });

    // The flattened view: an image read as one long row, wired to everything.
    const fA = s.win('flat', 'big');
    if (fA > 0) {
      s.alpha(fA, () => {
        const isz = 30 * u;
        const ix = w / 2 - isz / 2;
        const iy = 13 * u;
        const len = Math.min(w - 12 * u, 96 * u);
        const sx = w / 2 - len / 2;
        const sy = 52 * u;
        const sh = 3.6 * u;
        const reveal = s.ease('flat', 1.6, 0.5);
        if (P) pic(s, P.car, ix, iy, isz, isz);
        else s.rrect(ix, iy, isz, isz, 1, { fill: s.c('--paper-2') });
        s.rrect(ix, iy, isz, isz, 0.6, { stroke: s.c('--rule'), lw: 0.3 });
        s.arrow(w / 2, iy + isz + 1.5 * u, w / 2, sy - 1.5 * u, s.tint('--ink-3', reveal), 0.45);
        if (P && reveal > 0) {
          const c = s.ctx;
          c.save();
          c.beginPath();
          c.rect(sx, sy - u, len * reveal, sh + 2 * u);
          c.clip();
          pic(s, P.strip, sx, sy, len, sh);
          c.restore();
        }
        s.rrect(sx, sy, len, sh, 0.4, { stroke: s.tint('--ink-3', 0.6 * reveal), lw: 0.25 });
        s.alpha(reveal, () => s.text('3,072 numbers', w / 2 + 2.5 * u, sy - 4 * u, { size: 3.4, font: 'mono', color: s.c('orange'), align: 'left', halo: true }));
        // every number wired to every neuron
        const wA = s.ease('wired', 0.8);
        if (wA > 0) {
          const ny = 84 * u;
          const nx = [-2, -1, 0, 1, 2].map((k) => w / 2 + k * Math.min(15 * u, len / 5));
          s.alpha(wA, () => {
            for (let q = 0; q < 16; q++) {
              const px = sx + ((q + 0.5) / 16) * len;
              for (const x of nx) s.line(px, sy + sh, x, ny - 2.6 * u, s.tint('blue', 0.16), 0.18);
            }
            nx.forEach((x) => s.circle(x, ny, 2.6 * u, { fill: s.tint('purple', 0.18), stroke: s.c('purple'), lw: 0.4 }));
          });
          // a pixel and its neighbor, and two opposite corners: all wired the same way
          const pA = s.ease('wired', 0.6, 1.8);
          if (pA > 0)
            s.alpha(pA * wA, () => {
              const ps = isz / 32;
              const marks: [number, number][] = [
                [14, 12],
                [14, 13],
                [0, 0],
                [31, 31],
              ];
              for (const [r, c] of marks) {
                s.rrect(ix + c * ps - 0.5 * u, iy + r * ps - 0.5 * u, ps + u, ps + u, 0.3, { stroke: s.c('orange'), lw: 0.45 });
                const px = sx + ((r * 32 + c + 0.5) / 1024) * len;
                s.line(px, sy + sh, nx[2]!, ny - 2.6 * u, s.tint('orange', 0.8), 0.3);
              }
              s.text('neighbors', ix - 2 * u, iy + 14.5 * ps, { size: 3, align: 'right', color: s.c('orange') });
              s.text('corners', ix + isz + 2 * u, iy + isz - u, { size: 3, align: 'left', color: s.c('orange') });
            });
        }
      });
    }

    // The cost of full wiring on a real photo.
    const bA = s.win('big', 'keep');
    if (bA > 0) {
      s.alpha(bA, () => {
        const isz = 34 * u;
        const ix = w / 2 - isz / 2;
        const iy = 13 * u;
        if (P) pic(s, P.car, ix, iy, isz, isz, true);
        s.rrect(ix, iy, isz, isz, 0.6, { stroke: s.c('--rule'), lw: 0.3 });
        s.text('200 × 200 × 3', w / 2, iy + isz + 4 * u, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
        const p = s.prog('big');
        const l1 = s.ease('big', 0.6, 0.6);
        const l2 = smooth((p - 0.45) / 0.15);
        const l3 = smooth((p - 0.62) / 0.15);
        s.alpha(l1, () => s.text('120,000 numbers per image', w / 2, 62 * u, { size: 4.2, font: 'mono', weight: 600, color: s.c('orange') }));
        s.alpha(l2, () => s.text('× 1,000 neurons', w / 2, 71 * u, { size: 4.2, font: 'mono', color: s.c('--ink-2') }));
        const n = Math.round(120e6 * smooth((p - 0.62) / 0.18));
        s.alpha(l3, () => s.text(`= ${n.toLocaleString('en-US')} weights`, w / 2, 82 * u, { size: 5.4, font: 'mono', weight: 650, color: s.c('blue') }));
      });
    }

    // Keep everything, change the wiring.
    const kA = s.win('keep', 'patch');
    if (kA > 0) {
      s.alpha(kA, () => {
        const items = ['weighted sums', 'nonlinearities', 'a loss', 'backprop'];
        const two = true;
        items.forEach((t, i) => {
          const a = s.ease('keep', 0.4, 0.5 + i * 0.55);
          const row = two ? Math.floor(i / 2) : 0;
          const col = two ? i % 2 : i;
          const cols = two ? 2 : 4;
          const cw = two ? 44 * u : 28 * u;
          const x = w / 2 + (col - (cols - 1) / 2) * cw;
          const y = 30 * u + row * 11 * u;
          s.alpha(a, () => {
            const tw = s.measure(t, { size: 4 });
            s.text(t, x + 2.6 * u, y, { size: 4 });
            check(s, x - tw / 2 - 1.2 * u, y, 1.9 * u);
          });
        });
        const ya = two ? 64 * u : 50 * u;
        s.alpha(s.ease('keep', 0.6, 3.4), () => {
          s.text('only the wiring changes:', w / 2, ya, { size: 4.2, italic: true, color: s.c('--ink-2') });
          s.text('small patches, shared weights', w / 2, ya + 9 * u, { size: 5, font: 'display', weight: 600, color: s.c('--accent') });
        });
      });
    }

    // A small shared filter sliding over the image.
    const cA = s.ease('patch', 0.6);
    if (cA > 0) {
      s.alpha(cA, () => {
        const isz = Math.min(36 * u, (w - 40 * u) / 2);
        const fw = 14 * u;
        const gap = (w - 2 * isz - fw - 8 * u) / 4;
        const xX = 4 * u + gap;
        const xW = xX + isz + gap;
        const xA = xW + fw + gap;
        const top = 22 * u;
        s.text('X', xX + isz / 2, top - 4 * u, { size: 4.6, italic: true, weight: 600, color: s.c('orange') });
        s.text('W', xW + fw / 2, top + isz / 2 - fw / 2 - 4 * u, { size: 4.6, italic: true, weight: 600, color: s.c('blue') });
        s.text('A', xA + isz / 2, top - 4 * u, { size: 4.6, italic: true, weight: 600, color: s.c('purple') });
        if (P) pic(s, P.car, xX, top, isz, isz);
        s.rrect(xX, top, isz, isz, 0.6, { stroke: s.c('--rule'), lw: 0.3 });
        // the shared 5 x 5 filter
        const rng = new Rng(5);
        const cs = fw / 5;
        for (let i = 0; i < 5; i++)
          for (let j = 0; j < 5; j++) {
            const v = rng.uniform(-1, 1);
            s.rrect(xW + j * cs + 0.15 * u, top + isz / 2 - fw / 2 + i * cs + 0.15 * u, cs - 0.3 * u, cs - 0.3 * u, 0.4, { fill: s.tint('blue', 0.15 + 0.5 * Math.abs(v)) });
          }
        s.rrect(xA, top, isz, isz, 0.6, { fill: s.c('--paper-2'), stroke: s.c('--rule'), lw: 0.3 });
        const ps = isz / 32;
        // window position: fixed during 'patch', sweeping during 'share'
        const q = s.since('share') >= 0 ? s.prog('share') : -1;
        const nPos = 28 * 28;
        const at = q < 0 ? 13 * 28 + 9 : Math.min(nPos - 1, Math.floor(q * nPos));
        const wi = Math.floor(at / 28);
        const wj = at % 28;
        if (P && q >= 0) {
          const c = s.ctx;
          c.save();
          c.beginPath();
          c.rect(xA, top, isz, (wi + 2) * ps);
          c.rect(xA, top + (wi + 2) * ps, (wj + 3) * ps, ps);
          c.clip();
          pic(s, P.maps[0]!, xA, top, isz, isz);
          c.restore();
          if (s.since('payoff') >= 0) pic(s, P.maps[0]!, xA, top, isz, isz);
        }
        const winA = 1 - s.ease('payoff', 0.5);
        s.alpha(winA, () => {
          frame(s, xX + wj * ps, top + wi * ps, 5 * ps, 5 * ps, 'orange', 0.5, 0.1);
          const ox = xA + (wj + 2.5) * ps;
          const oy = top + (wi + 2.5) * ps;
          s.line(xX + (wj + 5) * ps, top + (wi + 2.5) * ps, xW, top + isz / 2, s.tint('orange', 0.6), 0.3, [0.8, 0.6]);
          s.line(xW + fw, top + isz / 2, ox, oy, s.tint('purple', 0.6), 0.3, [0.8, 0.6]);
          s.circle(ox, oy, Math.max(ps * 0.8, 0.9 * u), { fill: s.c('purple') });
        });
        s.alpha(s.ease('share', 0.5, 0.5), () => s.text('same W at every position', w / 2, top + isz + 6 * u, { size: 3.6, italic: true, color: s.c('blue') }));
        s.alpha(s.ease('payoff', 0.6, 0.4), () => {
          s.text('fully connected:  120,000 weights per neuron', w / 2, 80 * u, { size: 3.5, font: 'mono', color: s.c('--ink-3') });
          s.text('convolutional:  75 weights per filter', w / 2, 88 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('blue') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- volumes

/** The five volumes of a minimal ConvNet, laid out in two rows. */
function pipeLayout(s: Scene) {
  const u = s.u;
  const big = 24 * u;
  const small = 12 * u;
  const dConv = 11 * u;
  const dIn = 4 * u;
  const arrowW = 7 * u;
  const wIn = big + depthVec(dIn)[0];
  const wConv = big + depthVec(dConv)[0];
  const row1 = wIn + 2 * wConv + 2 * arrowW;
  const x1 = s.w / 2 - row1 / 2;
  const y1 = 18 * u;
  const wPool = small + depthVec(dConv)[0];
  const wFc = 18 * u;
  const row2 = wPool + arrowW + wFc;
  const x2 = s.w / 2 - row2 / 2;
  const y2 = 62 * u;
  return {
    big,
    small,
    dConv,
    dIn,
    input: { x: x1, y: y1 },
    conv: { x: x1 + wIn + arrowW, y: y1 },
    relu: { x: x1 + wIn + wConv + 2 * arrowW, y: y1 },
    pool: { x: x2, y: y2 + (big - small) / 2 },
    fc: { x: x2 + wPool + arrowW, y: y2 },
    wFc,
    arrowW,
  };
}

function mapStack(s: Scene, x: number, y: number, size: number, d: number, maps: HTMLCanvasElement[] | null, k: K): void {
  slices(s, x, y, size, size, 12, d, (i, sx, sy) => {
    if (maps) pic(s, maps[i]!, sx, sy, size, size);
    else s.rrect(sx, sy, size, size, 0.2, { fill: s.c('--paper-2') });
    s.rrect(sx, sy, size, size, 0.2, { stroke: s.tint(k, 0.7), lw: 0.25 });
  });
}

const volumes: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const P = cifar(s);
    const L = pipeLayout(s);
    // The input volume: large at first, then it moves into the pipeline.
    const mv = s.ease('contract', 1.1);
    const bigF = 40 * u;
    const bigD = lerp(4 * u, 24 * u, s.ease('cifar', 1.2, 0.3));
    const fx = lerp(w / 2 - bigF / 2 - depthVec(bigD)[0] / 2, L.input.x, mv);
    const fy = lerp(30 * u, L.input.y, mv);
    const fs = lerp(bigF, L.big, mv);
    const fd = lerp(bigD, L.dIn, mv);
    const colorA = 1 - s.ease('cifar', 0.8, 0.3);
    slices(s, fx, fy, fs, fs, 3, fd, (i, sx, sy) => {
      if (P) pic(s, P.carCh[i]!, sx, sy, fs, fs);
      else s.rrect(sx, sy, fs, fs, 0.3, { fill: s.c('--paper-2') });
      s.rrect(sx, sy, fs, fs, 0.3, { stroke: s.tint('orange', 0.8), lw: 0.3 });
      if (i === 0 && P && colorA > 0) s.alpha(colorA, () => pic(s, P.car, sx, sy, fs, fs));
    });
    // dimension labels on the big volume
    s.alpha((1 - mv) * s.ease('block', 0.6, 0.8), () => {
      const [dx, dy] = depthVec(fd);
      s.text('width 32', fx + fs / 2, fy + fs + 4 * u, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      s.text('height 32', fx - 2 * u, fy + fs / 2, { size: 3.4, font: 'mono', color: s.c('--ink-2'), align: 'right' });
      s.alpha(s.ease('block', 0.5, 1.8), () => s.text('depth 3', fx + fs + dx / 2 + 2 * u, fy + fs + dy / 2 + 4 * u, { size: 3.4, font: 'mono', color: s.c('--ink-2'), align: 'left' }));
      const names = ['R', 'G', 'B'];
      const cols: K[] = ['red', 'green', 'blue'];
      s.alpha(s.ease('cifar', 0.6, 1.2), () =>
        names.forEach((n, i) => {
          const t = i / 2;
          s.text(n, fx + fs + dx * t + 1.2 * u, fy + fs + dy * t - 2 * u, { size: 3.6, font: 'mono', weight: 700, color: s.c(cols[i]!), align: 'left' });
        }),
      );
    });
    s.alpha(s.win('word', 'contract'), () => {
      s.text('depth = channels, not layers', w / 2, 88 * u, { size: 4.4, italic: true, color: s.c('--accent') });
    });

    // The pipeline.
    const label = (cx: number, y: number, name: string, shape: string, k: K, a: number) =>
      s.alpha(a, () => {
        s.text(name, cx, y, { size: 3.4, font: 'mono', weight: 700, color: s.c(k) });
        s.text(shape, cx, y + 4.4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      });
    const below = (y: number, size: number) => y + size + 4.5 * u;
    const pA = s.ease('contract', 0.6, 0.8);
    label(L.input.x + L.big / 2, below(L.input.y, L.big), 'INPUT', '32×32×3', 'orange', pA);

    const conv = s.ease('conv', 0.7);
    const relu = s.ease('relu', 0.7);
    const pool = s.ease('pool', 0.7);
    const fc = s.ease('fc', 0.7);
    const arr = (x0: number, y0: number, x1: number, y1: number, a: number) => s.alpha(a, () => s.arrow(x0, y0, x1, y1, s.c('--ink-3'), 0.45));
    const midY = L.input.y + L.big / 2;
    const inRight = L.input.x + L.big + depthVec(L.dIn)[0];
    const convRight = L.conv.x + L.big + depthVec(L.dConv)[0];
    arr(inRight + 1.5 * u, midY, L.conv.x - 1.5 * u, midY, conv);
    s.alpha(conv, () => mapStack(s, L.conv.x, L.conv.y, L.big, L.dConv, P?.maps ?? null, 'purple'));
    label(L.conv.x + L.big / 2, below(L.conv.y, L.big), 'CONV', '32×32×12', 'purple', conv);
    arr(convRight + 1.5 * u, midY, L.relu.x - 1.5 * u, midY, relu);
    s.alpha(relu, () => mapStack(s, L.relu.x, L.relu.y, L.big, L.dConv, P?.relus ?? null, 'purple'));
    label(L.relu.x + L.big / 2, below(L.relu.y, L.big), 'RELU', '32×32×12', 'slate', relu);
    // elbow from RELU down to POOL
    s.alpha(pool, () => {
      const c = s.ctx;
      const x0 = L.relu.x + L.big / 2;
      const y0 = below(L.relu.y, L.big) + 7 * u;
      const yb = 56 * u;
      const x1 = L.pool.x - 3.5 * u;
      const y1 = L.pool.y + L.small / 2;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x0, yb);
      c.lineTo(x1 - 2 * u, yb);
      c.quadraticCurveTo(x1 - 4 * u, yb, x1 - 4 * u, yb + 2 * u);
      c.lineTo(x1 - 4 * u, y1 - 2 * u);
      c.strokeStyle = s.c('--ink-3');
      c.lineWidth = 0.45 * u;
      c.stroke();
      s.arrow(x1 - 4 * u, y1 - 2 * u, x1, y1, s.c('--ink-3'), 0.45);
      mapStack(s, L.pool.x, L.pool.y, L.small, L.dConv, P?.pools ?? null, 'purple');
    });
    label(L.pool.x + L.small / 2, below(L.pool.y, L.small), 'POOL', '16×16×12', 'slate', pool);
    const poolRight = L.pool.x + L.small + depthVec(L.dConv)[0];
    arr(poolRight + 1.5 * u, L.pool.y + L.small / 2, L.fc.x - 1.5 * u, L.pool.y + L.small / 2, fc);
    s.alpha(fc, () => {
      const sc = [0.25, 0.95, 0.15, 0.3, 0.2, 0.18, 0.12, 0.22, 0.35, 0.6];
      const bw = L.wFc / 10;
      const base = L.fc.y + L.big * 0.8;
      s.line(L.fc.x - 0.5 * u, base, L.fc.x + L.wFc + 0.5 * u, base, s.c('--axis'), 0.3);
      sc.forEach((v, i) => {
        const bh = L.big * 0.75 * v * smooth(s.prog('fc') * 2 - i * 0.06);
        s.rrect(L.fc.x + i * bw + bw * 0.15, base - bh, bw * 0.7, bh, 0.3, { fill: s.c(i === 1 ? 'purple' : '--ink-3') });
      });
      s.alpha(s.ease('fc', 0.5, 1.4), () => s.text('car', L.fc.x + 1.5 * bw, base - L.big * 0.75 * 0.95 - 2.5 * u, { size: 3, font: 'mono', weight: 650, color: s.c('purple') }));
    });
    label(L.fc.x + L.wFc / 2, below(L.fc.y, L.big * 0.8) - 0.5 * u, 'FC', '1×1×10', 'purple', fc);

    // Which layers hold weights.
    const wA = s.ease('weights', 0.6);
    s.alpha(wA, () => {
      const top = depthVec(L.dConv)[1];
      pill(s, 'W', L.conv.x + L.big / 2, L.conv.y + top - 4 * u, 'blue', { size: 3.4 });
      pill(s, 'W', L.fc.x + L.wFc + 5 * u, L.fc.y + L.big * 0.45, 'blue', { size: 3.4 });
      s.text('no weights', L.relu.x + L.big / 2, L.relu.y + top - 4 * u, { size: 3.2, italic: true, color: s.c('--ink-3') });
      s.text('no weights', L.pool.x + L.small / 2, L.pool.y + top - 2.6 * u, { size: 3.2, italic: true, color: s.c('--ink-3') });
    });
    const [cdx, cdy] = depthVec(L.dConv);
    s.alpha(s.ease('weights', 0.6, 3.2), () => frame(s, L.conv.x - u, L.conv.y + cdy - u, L.big + cdx + 2 * u, L.big - cdy + 2 * u, '--accent', 0.6, 0.5));
  },
};

// ---------------------------------------------------------------- slide

const KERNELS: { name: string; k: number[] }[] = [
  { name: 'horizontal edges', k: [-1, -2, -1, 0, 0, 0, 1, 2, 1] },
  { name: 'blur', k: [1, 2, 1, 2, 4, 2, 1, 2, 1] },
  { name: 'sharpen', k: [0, -1, 0, -1, 5, -1, 0, -1, 0] },
];

const slide: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const P = cifar(s);
    const learn = s.ease('learn', 0.8);
    const mainA = 1 - learn;
    const isz = Math.min(42 * u, (w - 26 * u) / 2);
    const xX = w / 2 - isz - 5 * u;
    const xA = w / 2 + 5 * u;
    const top = 13 * u;
    const ps = isz / 32;
    const [hi, hj] = P?.hit ?? [16, 13];
    const at = (r: number, c: number) => (!P || r < 0 || c < 0 || r > 31 || c > 31 ? 0 : P.truck[r * 32 + c]!);

    // Where the window sits, and how much of A is known.
    let win: [number, number] | null = null;
    let known = 0; // cells of A filled in raster order; -1 means only the stepped cells
    let steps = 0;
    if (s.since('lay') >= 0 && s.since('slide') < 0) {
      win = [hi, hj];
      known = -1;
    } else if (s.since('slide') >= 0 && s.since('pad') < 0) {
      const p = s.prog('slide');
      if (p < 0.3) {
        steps = Math.min(3, Math.floor((p / 0.3) * 4));
        win = [hi, Math.min(31, hj + steps)];
        known = -1;
      } else {
        const k = Math.min(1023, Math.floor(smooth((p - 0.3) / 0.62) * 1024));
        win = [Math.floor(k / 32), k % 32];
        known = k + 1;
      }
    } else if (s.since('pad') >= 0 && s.since('map') < 0) {
      win = [0, 0];
      known = 1024;
    } else if (s.since('map') >= 0) known = 1024;
    const aVal = win && P ? P.vedge[win[0] * 32 + win[1]]! : 0;
    if (win) {
      s.slot('i', win[0]);
      s.slot('j', win[1]);
      s.slot('a', fmt(aVal, 3));
    }

    s.alpha(mainA, () => {
      // input and output
      if (P) pic(s, P.truckC, xX, top, isz, isz);
      else s.rrect(xX, top, isz, isz, 0.4, { fill: s.c('--paper-2') });
      s.rrect(xX, top, isz, isz, 0.4, { stroke: s.c('--rule'), lw: 0.3 });
      s.alpha(s.win('pad', 'map'), () => dashed(s, xX - ps, top - ps, isz + 2 * ps, isz + 2 * ps, s.c('--ink-3'), 0.3));
      s.rrect(xA, top, isz, isz, 0.4, { fill: s.c('--paper-2'), stroke: s.c('--rule'), lw: 0.3 });
      if (P && known !== 0) {
        const c = s.ctx;
        c.save();
        c.beginPath();
        if (known === -1) c.rect(xA + hj * ps, top + hi * ps, (steps + 1) * ps, ps);
        else {
          const r = Math.floor((known - 1) / 32);
          c.rect(xA, top, isz, r * ps);
          c.rect(xA, top + r * ps, (((known - 1) % 32) + 1) * ps, ps);
        }
        c.clip();
        pic(s, P.vedgeC, xA, top, isz, isz);
        c.restore();
        s.alpha(s.ease('relu', 0.8), () => pic(s, P.vedgeR, xA, top, isz, isz));
      }
      const relu = s.since('relu') >= 0;
      s.text(P ? 'input X: a truck' : 'input X', xX + isz / 2, top + isz + 4 * u, { size: 3.4, color: s.c('orange') });
      s.text(relu ? 'output A, after ReLU' : s.since('map') >= 0 ? 'activation map A' : 'output A', xA + isz / 2, top + isz + 4 * u, { size: 3.4, color: s.c('purple') });
      if (win) {
        const [r, c] = win;
        frame(s, xX + (c - 1) * ps, top + (r - 1) * ps, 3 * ps, 3 * ps, 'orange', 0.5, 0.15);
        frame(s, xA + c * ps, top + r * ps, ps, ps, 'purple', 0.5, 0.15);
        s.line(xX + (c + 2) * ps + 0.5 * u, top + (r + 0.5) * ps, xA + c * ps - 0.6 * u, top + (r + 0.5) * ps, s.tint('purple', 0.5), 0.25, [0.8, 0.6]);
      }

      // patch (*) W = A[i, j], or other filters' maps
      const rowA = 1 - s.ease('other', 0.6);
      const cs = 8.6 * u;
      const rowW = 3 * cs * 2 + 2 * 7 * u + 15 * u;
      const rx = w / 2 - rowW / 2;
      const ry = 62 * u;
      const xW = rx + 3 * cs + 7 * u;
      const xR = xW + 3 * cs + 7 * u;
      s.alpha(rowA, () => {
        const patchA = (win ? 1 : 0.35) * (1 - s.ease('map', 0.6));
        const hand = s.since('hand') >= 0 && s.since('lay') < 0 ? s.prog('hand') : -1;
        const lit = s.since('lay') >= 0 && s.since('match') < 0 ? Math.floor(clamp01(s.prog('lay') * 1.25) * 9) : -1;
        for (let a = 0; a < 3; a++)
          for (let b = 0; b < 3; b++) {
            const n = a * 3 + b;
            const r = (win?.[0] ?? hi) + a - 1;
            const c = (win?.[1] ?? hj) + b - 1;
            const pad = r < 0 || c < 0 || r > 31 || c > 31;
            const v = at(r, c);
            s.alpha(patchA, () => s.cell(rx + b * cs, ry + a * cs, cs, cs, win ? (pad ? '0' : v.toFixed(2).replace(/^0/, '')) : '', 'orange', { on: lit === n ? 1 : 0, size: 3.1 }));
            const colOn = hand >= 0 && ((b === 0 && hand < 0.5) || (b === 2 && hand >= 0.5)) ? 1 : 0;
            s.cell(xW + b * cs, ry + a * cs, cs, cs, String(VEDGE[n]), 'blue', { on: Math.max(colOn, lit === n ? 1 : 0), size: 3.6 });
          }
        const restA = 1 - s.ease('map', 0.6);
        s.alpha(restA, () => {
          s.text('⊙', rx + 3 * cs + 3.5 * u, ry + 1.5 * cs, { size: 5, color: s.c('--ink-2') });
          s.text('=', xW + 3 * cs + 3.5 * u, ry + 1.5 * cs, { size: 5, color: s.c('--ink-2') });
        });
        const shown = win && (s.since('match') >= 0 || s.prog('lay') > 0.82);
        if (s.since('match') >= 0 && s.since('slide') < 0) flash(s, xR, ry + cs, 15 * u, cs, s.since('match') / 1.2, 'purple');
        const ly = ry + 3 * cs + 3.4 * u;
        s.alpha(restA, () => {
          s.cell(xR, ry + cs, 15 * u, cs, shown ? fmt(aVal, 3) : '', 'purple', { on: shown ? 1 : 0, size: 3.6 });
          s.text('patch of X', rx + 1.5 * cs, ly, { size: 3, color: s.c('orange') });
          s.text(win ? `A[${win[0]}, ${win[1]}]` : 'A[i, j]', xR + 7.5 * u, ly, { size: 3, font: 'mono', color: s.c('purple') });
        });
        s.text('filter W', xW + 1.5 * cs, ly, { size: 3, color: s.c('blue') });
      });
      // other filters
      s.alpha(s.ease('other', 0.6) * (1 - s.ease('learn', 0.5)), () => {
        const tw = Math.min(20 * u, (w - 20 * u) / 3.6);
        const gap = Math.min(10 * u, (w - 3 * tw - 10 * u) / 2);
        const x0 = w / 2 - (3 * tw + 2 * gap) / 2;
        const cvs = P ? [P.hedgeC, P.blurC, P.sharpC] : [];
        KERNELS.forEach((kk, i) => {
          const a = s.ease('other', 0.5, 0.9 + i * 0.7);
          const x = x0 + i * (tw + gap);
          s.alpha(a, () => {
            if (cvs[i]) pic(s, cvs[i]!, x, ry, tw, tw);
            s.rrect(x, ry, tw, tw, 0.4, { stroke: s.c('--rule'), lw: 0.3 });
            s.text(kk.name, x + tw / 2, ry + tw + 4 * u, { size: 3.2, color: s.c('--ink-2') });
          });
        });
      });
    });

    // what trained first-layer filters look like
    s.alpha(learn, () => {
      const tiles = filterTiles();
      const cols = 6;
      const ts = Math.min(11 * u, (w - 24 * u) / 6.9);
      const gap = ts * 0.2;
      const gw = cols * ts + (cols - 1) * gap;
      const x0 = w / 2 - gw / 2;
      const y0 = 16 * u;
      tiles.forEach((t, i) => {
        const a = s.ease('learn', 0.4, 0.4 + i * 0.06);
        s.alpha(a, () => {
          pic(s, t, x0 + (i % cols) * (ts + gap), y0 + Math.floor(i / cols) * (ts + gap), ts, ts);
          s.rrect(x0 + (i % cols) * (ts + gap), y0 + Math.floor(i / cols) * (ts + gap), ts, ts, 0.3, { stroke: s.c('--rule'), lw: 0.25 });
        });
      });
      const yb = y0 + 4 * ts + 3 * gap;
      s.text('the look of trained first-layer filters', w / 2, yb + 7 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
      s.text('edges at many angles, blobs of color', w / 2, yb + 14 * u, { size: 3.4, font: 'mono', color: s.c('blue') });
    });
  },
};

// ---------------------------------------------------------------- depth

/** The chapter's 3-D example: V is 5 x 5 x 3, two 3 x 3 x 3 filters, biases 1 and 0, stride 2. */
const VOL = (() => {
  const rng = new Rng(231);
  const V = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => [rng.int(3), rng.int(3), rng.int(3)]));
  const Wf = [0, 1].map(() => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => [rng.int(3) - 1, rng.int(3) - 1, rng.int(3) - 1])));
  const bias = [1, 0];
  const X = (r: number, c: number, d: number) => (r < 1 || c < 1 || r > 5 || c > 5 ? 0 : V[r - 1]![c - 1]![d]!);
  const sums = (k: number, i: number, j: number) =>
    [0, 1, 2].map((d) => {
      let t = 0;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) t += Wf[k]![a]![b]![d]! * X(i * 2 + a, j * 2 + b, d);
      return t;
    });
  const out = (k: number, i: number, j: number) => sums(k, i, j).reduce((a, b) => a + b, 0) + bias[k]!;
  return { Wf, bias, X, sums, out };
})();

const paren = (v: number) => (v < 0 ? `(${v})` : String(v));

const depth: SceneDef = {
  marks: {
    sum: {
      tex: String.raw`\begin{gathered}\symA[i, j, k] = b_k + \sum_{u}\sum_{v}\sum_{d} \\ \symW_k[u, v, d]\; \symX[i\symS + u,\, j\symS + v,\, d]\end{gathered}`,
      x: 0.5,
      y: 0.2,
      size: 4.6,
    },
  },
  draw(s) {
    const { w, u } = s;
    // Phase 1: a filter through the full depth of its input.
    const p1 = s.win('depth', 'sum');
    if (p1 > 0) {
      s.alpha(p1, () => {
        const deep = s.ease('deep', 1.0);
        const face = lerp(40 * u, 32 * u, deep);
        const d = lerp(10 * u, 30 * u, deep);
        const n = Math.round(lerp(32, 16, deep));
        const f = deep > 0.5 ? 3 : 5;
        const cs = face / n;
        const [dx, dy] = depthVec(d);
        const vx = w / 2 - 34 * u;
        const vy = 30 * u - dy * 0.3;
        box(s, vx, vy, face, face, d, 'orange', { fill: 0.1 });
        // a light grid on the front face
        for (let q = 1; q < n; q += deep > 0.5 ? 1 : 2) {
          s.line(vx + q * cs, vy, vx + q * cs, vy + face, s.tint('orange', 0.12), 0.15);
          s.line(vx, vy + q * cs, vx + face, vy + q * cs, s.tint('orange', 0.12), 0.15);
        }
        const fr = Math.round(n * 0.3);
        const fc = Math.round(n * 0.45);
        const fxp = vx + fc * cs;
        const fyp = vy + fr * cs;
        const fA = s.ease('size', 0.6);
        s.alpha(fA, () => wire(s, fxp, fyp, f * cs, f * cs, d, 'blue', 0.45, 0.3));
        s.alpha(s.ease('depth', 0.6, 0.6), () => {
          s.text(deep > 0.5 ? '16 × 16 × 20' : '32 × 32 × 3', vx + face / 2, vy + face + 4.5 * u, { size: 3.4, font: 'mono', color: s.c('orange') });
          s.text(deep > 0.5 ? 'depth 20' : 'depth 3', vx + face + dx / 2 + 2 * u, vy + face + dy / 2 + 2.5 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3'), align: 'left' });
        });
        // the neuron it feeds
        const nx = w / 2 + 30 * u;
        const ny = vy + face * 0.42;
        const nA = s.ease('field', 0.6);
        s.alpha(nA, () => {
          const corners: [number, number][] = [
            [fxp, fyp],
            [fxp + f * cs, fyp],
            [fxp + f * cs + dx, fyp + dy],
            [fxp + f * cs, fyp + f * cs],
            [fxp, fyp + f * cs],
          ];
          for (const [x, y] of corners) s.line(x, y, nx - 2.5 * u, ny, s.tint('purple', 0.45), 0.25);
          s.circle(nx, ny, 2.5 * u, { fill: s.tint('purple', 0.2), stroke: s.c('purple'), lw: 0.45 });
          s.text('one neuron', nx, ny + 6 * u, { size: 3.2, color: s.c('purple') });
          s.text('receptive field', fxp - 2 * u, fyp - 3 * u, { size: 3.2, italic: true, color: s.c('orange'), align: 'right', halo: true });
        });
        s.alpha(fA * (1 - s.ease('field', 0.4)), () => s.text('filter W: 5 × 5 × 3', w / 2, 86 * u, { size: 4, font: 'mono', weight: 600, color: s.c('blue') }));
        const t1 = s.ease('field', 0.6, 1.5) * (1 - deep);
        const t2 = deep;
        s.alpha(t1, () => s.text('5 × 5 × 3 = 75 weights + 1 bias', w / 2, 86 * u, { size: 4, font: 'mono', weight: 600, color: s.c('blue') }));
        s.alpha(t2, () => s.text('3 × 3 × 20 = 180 weights + 1 bias', w / 2, 86 * u, { size: 4, font: 'mono', weight: 600, color: s.c('blue') }));
      });
    }

    // Phase 2: the triple sum as three nested loops.
    const p2 = s.win('sum', 'stride');
    s.show('sum', p2);
    if (p2 > 0) {
      s.alpha(p2, () => {
        const cs = 6.2 * u;
        const colW = 3 * cs;
        const gap = 8 * u;
        const x0 = w / 2 - (3 * colW + 2 * gap) / 2;
        const yX = 39 * u;
        const yW = yX + colW + 5 * u;
        const q = s.since('loops') >= 0 ? s.prog('loops') : -1;
        const step = q < 0 ? -1 : Math.min(26, Math.floor(q * 1.15 * 27));
        let run = 0;
        const k = 0;
        for (let d = 0; d < 3; d++) {
          const x = x0 + d * (colW + gap);
          s.text(`d = ${d}`, x + colW / 2, yX - 3 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
          for (let a = 0; a < 3; a++)
            for (let b = 0; b < 3; b++) {
              const idx = d * 9 + a * 3 + b;
              const on = idx === step ? 1 : 0;
              const xv = VOL.X(a, b, d);
              const wv = VOL.Wf[k]![a]![b]![d]!;
              if (step >= idx) run += xv * wv;
              s.cell(x + b * cs, yX + a * cs, cs, cs, String(xv), 'orange', { on, size: 3.2 });
              s.cell(x + b * cs, yW + a * cs, cs, cs, String(wv), 'blue', { on, size: 3.2 });
            }
        }
        s.text('X', x0 - 3 * u, yX + colW / 2, { size: 4, italic: true, weight: 600, color: s.c('orange') });
        s.text('W', x0 - 3 * u, yW + colW / 2, { size: 4, italic: true, weight: 600, color: s.c('blue') });
        const yb = yW + colW + 6 * u;
        if (step >= 0) {
          const ui = Math.floor((step % 9) / 3);
          const vi = step % 3;
          const di = Math.floor(step / 9);
          s.text(`u = ${ui}   v = ${vi}   d = ${di}     running sum = ${run}`, w / 2, yb, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
        } else s.alpha(s.ease('sum', 0.6, 1), () => s.text('rows u, columns v, channels d', w / 2, yb, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      });
    }

    // Phase 3: the 7 x 7 x 3 example, two filters, stride 2.
    const p3 = s.ease('stride', 0.6);
    if (p3 > 0) {
      s.alpha(p3, () => {
        const c = Math.min(4.2 * u, (w - 20 * u) / 22);
        const sw = 7 * c;
        const gap = Math.min(6 * u, (w - 10 * u - 3 * sw) / 2);
        const x0 = w / 2 - (3 * sw + 2 * gap) / 2;
        const yA = 16 * u;
        // the current step: [k, i, j]
        let k = 0;
        let pos = 0;
        let stepA = 0;
        if (s.since('demo') < 0) pos = Math.min(2, Math.floor(s.prog('stride') * 3.2));
        else if (s.since('jump') < 0) pos = 0;
        else if (s.since('second') < 0) pos = Math.min(8, Math.floor(s.prog('jump') * 1.2 * 9));
        else if (s.since('column') < 0) {
          k = 1;
          pos = Math.min(8, Math.floor(s.prog('second') * 1.2 * 9));
        } else {
          k = 1;
          pos = 4;
        }
        const done = (kk: number, n: number) => {
          if (s.since('one') < 0) return false;
          const cur = (s.since('second') >= 0 ? 9 : 0) + pos;
          const idx = kk * 9 + n;
          if (s.since('column') >= 0) return true;
          if (idx < cur) return true;
          return idx === cur && (s.since('jump') >= 0 || s.prog('one') > 0.7);
        };
        const i = Math.floor(pos / 3);
        const j = pos % 3;
        if (s.since('demo') >= 0) {
          s.slot('i', i);
          s.slot('j', j);
          s.slot('k', k);
          s.slot('a', done(k, pos) ? VOL.out(k, i, j) : '…');
        }
        for (let d = 0; d < 3; d++) {
          const sx = x0 + d * (sw + gap);
          s.text(`X[:, :, ${d}]`, sx + sw / 2, yA - 2.8 * u, { size: 2.9, font: 'mono', color: s.c('orange') });
          for (let r = 0; r < 7; r++)
            for (let q = 0; q < 7; q++) {
              const pad = r < 1 || q < 1 || r > 5 || q > 5;
              const v = VOL.X(r, q, d);
              const inWin = r >= i * 2 && r < i * 2 + 3 && q >= j * 2 && q < j * 2 + 3;
              s.rrect(sx + q * c + 0.12 * u, yA + r * c + 0.12 * u, c - 0.24 * u, c - 0.24 * u, 0.4, {
                fill: pad ? s.c('--paper-2') : s.tint('orange', 0.08 + 0.22 * v + (inWin ? 0.12 : 0)),
                stroke: s.tint(pad ? '--ink-3' : 'orange', pad ? 0.25 : 0.35),
                lw: 0.2,
              });
              if (inWin) s.text(String(v), sx + (q + 0.5) * c, yA + (r + 0.5) * c + 0.15 * u, { size: Math.min(2.8, (c / u) * 0.62), font: 'mono', color: s.c(pad ? '--ink-3' : '--ink') });
            }
          frame(s, sx + j * 2 * c, yA + i * 2 * c, 3 * c, 3 * c, 'orange', 0.45, 0.1);
        }
        s.alpha(s.win('stride', 'demo'), () => s.text('the window jumps S = 2 cells', w / 2, yA + sw + 7 * u, { size: 3.6, italic: true, color: s.c('--ink-2') }));
        // filters, slice sums, outputs
        const dA = s.ease('demo', 0.6);
        s.alpha(dA, () => {
          const fc = Math.min(6 * u, sw / 3.4);
          const yW = yA + sw + 7 * u;
          s.text(`filter W[${k}]`, w / 2, yW - 2.6 * u, { size: 3, font: 'mono', color: s.c('blue') });
          const sums = VOL.sums(k, i, j);
          for (let d = 0; d < 3; d++) {
            const fx = x0 + d * (sw + gap) + (sw - 3 * fc) / 2;
            for (let a = 0; a < 3; a++)
              for (let b = 0; b < 3; b++) s.cell(fx + b * fc, yW + a * fc, fc, fc, String(VOL.Wf[k]![a]![b]![d]), 'blue', { size: Math.min(3, (fc / u) * 0.5) });
          }
          const yO = yW + 3 * fc + 6.5 * u;
          const oc = Math.min(5.4 * u, (96 * u - yO) / 3);
          for (let kk = 0; kk < 2; kk++) {
            const gx = x0 + kk * (3 * oc + 5 * u);
            s.text(`A[:, :, ${kk}]`, gx + 1.5 * oc, yO - 2.6 * u, { size: 3, font: 'mono', color: s.c('purple') });
            for (let r = 0; r < 3; r++)
              for (let q = 0; q < 3; q++) {
                const n = r * 3 + q;
                const cur = kk === k && n === pos && s.since('one') >= 0;
                const col = s.since('column') >= 0 && n === 4;
                s.cell(gx + q * oc, yO + r * oc, oc, oc, done(kk, n) ? String(VOL.out(kk, r, q)) : '', 'purple', { on: cur || col ? 1 : 0, size: Math.min(3.2, (oc / u) * 0.5) });
              }
          }
          // the arithmetic for the current output
          const ex = x0 + 6 * oc + 10 * u;
          const lines = [`A[${i}, ${j}, ${k}]`, `= ${sums.map(paren).join(' + ')}`, `+ b[${k}] (${VOL.bias[k]})`, `= ${VOL.out(k, i, j)}`];
          const shown = s.since('one') >= 0 ? (s.since('jump') >= 0 ? 4 : Math.floor(clamp01(s.prog('one') * 1.3) * 4.99)) : 0;
          const colA = 1 - s.ease('column', 0.5);
          s.alpha(colA, () =>
            lines.slice(0, shown).forEach((t, n) => s.text(t, ex, yO + 1.4 * u + n * 4.3 * u, { size: 3.2, font: 'mono', align: 'left', weight: n === 3 ? 700 : 500, color: s.c(n === 3 ? 'purple' : '--ink') })),
          );
          s.alpha(s.ease('column', 0.6, 0.3), () => {
            const y = yO + 1.5 * oc;
            s.text('depth column:', ex, y - 2.5 * u, { size: 3.4, align: 'left', italic: true, color: s.c('purple') });
            s.text(`A[1, 1, :] = [${VOL.out(0, 1, 1)}, ${VOL.out(1, 1, 1)}]`, ex, y + 2.5 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('purple') });
          });
        });
      });
    }
  },
};

export const scenesA: Record<string, SceneDef> = { intro, volumes, slide, depth };
