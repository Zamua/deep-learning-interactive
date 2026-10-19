import type { ChapterDef } from './index';
import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { CIFAR_CLASSES, type CifarSet, loadCifar } from '../core/data';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { type ConvNet, type ReluRule, type Stage, addTvGrad, argmax, blur3, clampImage, gram, loadNet, roll, softmax } from '../lib/visualizing-net';
import { blit, cifarImg, imagePicker, inferno, inputImage, label, mapImage, probBars, stretchedImage, viridis } from '../lib/visualizing-ui';
import { VISUALIZING_SYMBOLS } from '../lib/visualizing-symbols';

/** Ten distinguishable colors for the ten CIFAR classes (the course palette has eight). */
const TAB10 = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#9c755f', '#76b7b2', '#edc948', '#2f6fd6', '#ff9da7'];
const SNAP_LABELS = ['initial', '100 steps', '1 epoch', '3 epochs', '10 epochs', '30 epochs'];

interface Analysis {
  tsne: { codes: [number, number][]; pixels: [number, number][] };
  nn: { codes: number[][]; pixels: number[][] };
  units: Record<string, [number, number, number, number][][]>;
  labels: number[];
  stats: Record<string, { zeros: number; everOn: number[] }>;
  gallery: number[];
  occGallery: number[];
}

interface Assets {
  net: ConvNet;
  train: CifarSet;
  test: CifarSet;
  an: Analysis;
  /** 20 test-set indices: the first row has one image per class, the second another. */
  gallery: number[];
  /** Same layout, chosen for images whose prediction is sensitive to occlusion. */
  occGallery: number[];
}

let assetsP: Promise<Assets> | null = null;

function assets(): Promise<Assets> {
  assetsP ??= Promise.all([
    loadNet(),
    loadCifar(),
    fetch('./data/visualizing-analysis.json').then((r) => {
      if (!r.ok) throw new Error(`visualizing-analysis.json: ${r.status}`);
      return r.json() as Promise<Analysis>;
    }),
  ]).then(([net, c, an]) => {
    const rows = (g: number[]) => [...g.filter((_, i) => i % 2 === 0), ...g.filter((_, i) => i % 2 === 1)];
    return { net, train: c.train, test: c.test, an, gallery: rows(an.gallery), occGallery: rows(an.occGallery) };
  });
  return assetsP;
}

/** Runs `fn` once the network, images and precomputed analysis have arrived. */
function ready(f: Fig, fn: (a: Assets) => void): void {
  f.status('Loading the trained network…');
  assets()
    .then((a) => {
      f.status('');
      fn(a);
    })
    .catch((e) => f.status(`Could not load the network: ${(e as Error).message}`));
}

/** Image i of the 1,200-image sample: 0-999 are the "train" sample, 1000-1199 the "test" one. */
function sampleImg(a: Assets, i: number): ImageData {
  return i < 1000 ? cifarImg(a.train, i) : cifarImg(a.test, i - 1000);
}

/** Spends about `budget` ms per animation frame on `step`, at least once; returns how many ran. */
function timed(budget: number, step: () => boolean): number {
  const t0 = performance.now();
  let n = 0;
  do {
    n++;
    if (!step()) break;
  } while (performance.now() - t0 < budget);
  return n;
}

/** Simple "Run / Pause" toggle wired to an f.loop. */
function runButton(f: Fig, loop: { start(): void; stop(): void; running(): boolean }, onStart?: () => void, labels = ['Run', 'Pause']): { btn: HTMLButtonElement; stop(): void } {
  const btn = f.button(labels[0]!, () => {
    if (loop.running()) stop();
    else {
      onStart?.();
      loop.start();
      btn.textContent = labels[1]!;
    }
  }, { primary: true });
  const stop = () => {
    loop.stop();
    btn.textContent = labels[0]!;
    f.code.highlight(null);
  };
  return { btn, stop };
}

/* ---------------------------------------------------------------- figures */

function filtersFig(f: Fig): void {
  let net: ConvNet | null = null;
  let k = SNAP_LABELS.length - 1;
  const cv = f.canvas(640, 168, (ctx, w, h) => {
    if (!net) return;
    const W = net.snapshots[k]!.W;
    const cols = 8;
    const gap = Math.max(4, w * 0.012);
    const size = Math.min((w - gap * (cols - 1)) / cols, (h - gap) / 2);
    const left = (w - (size * cols + gap * (cols - 1))) / 2;
    const top = (h - (2 * size + gap)) / 2;
    for (let j = 0; j < 16; j++) {
      const x0 = left + (j % cols) * (size + gap);
      const y0 = top + Math.floor(j / cols) * (size + gap);
      blit(ctx, stretchedImage(W, 7, j * 147), x0, y0, size, size);
    }
  });
  const accRo = f.readout('test accuracy at that point');
  const sync = () => {
    const s = net?.snapshots[k];
    accRo.set(s?.acc !== undefined ? `${(s.acc * 100).toFixed(1)}%` : '–');
    cv.redraw();
  };
  f.slider({
    label: 'training',
    min: 0,
    max: SNAP_LABELS.length - 1,
    step: 1,
    value: k,
    slot: 'snap',
    format: (v) => SNAP_LABELS[Math.round(v)]!,
    onInput: (v) => {
      k = Math.round(v);
      sync();
    },
  });
  ready(f, (a) => {
    net = a.net;
    sync();
  });
}

function activationsFig(f: Fig): void {
  let A: Assets | null = null;
  let img = 0;
  let layer: Stage = 'relu1';
  let sel = 0;
  let F: Float32Array | null = null;
  let grid = { x0: 0, y0: 0, cell: 1, cols: 1, n: 0 };
  const pick = imagePicker(f, (i) => {
    img = i;
    compute();
  });
  const cv = f.canvas(640, 330, (ctx, w, h) => {
    if (!A || !F) return;
    const [C, H] = A.net.shape(layer);
    const L = Math.min(w * 0.3, (h - 44) / 2);
    label(ctx, 'input', L / 2, 13, { size: 12 });
    blit(ctx, cifarImg(A.test, img), 0, 18, L, L);
    let mx = 0;
    for (let i = 0; i < F.length; i++) mx = Math.max(mx, F[i]!);
    label(ctx, `map ${sel}`, L / 2, L + 38, { size: 12 });
    blit(ctx, mapImage(F, sel * H * H, H, mx), 0, L + 44, L, L);
    const cols = C === 16 ? 4 : 8;
    const rows = C / cols;
    const gx0 = L + Math.max(12, w * 0.03);
    const gw = w - gx0;
    const gap = Math.max(1.5, Math.min(4, gw * 0.008));
    const cell = Math.min((gw - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows);
    const gy0 = (h - (cell * rows + gap * (rows - 1))) / 2;
    grid = { x0: gx0, y0: gy0, cell: cell + gap, cols, n: C };
    for (let k = 0; k < C; k++) {
      const x0 = gx0 + (k % cols) * (cell + gap);
      const y0 = gy0 + Math.floor(k / cols) * (cell + gap);
      blit(ctx, mapImage(F, k * H * H, H, mx), x0, y0, cell, cell);
      let on = false;
      for (let i = k * H * H; i < (k + 1) * H * H; i++) if (F[i]! > 0) on = true;
      if (!on) {
        ctx.strokeStyle = withAlpha(color('--ink-3'), 0.8);
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, cell - 1, cell - 1);
        ctx.setLineDash([]);
      }
      if (k === sel) {
        ctx.strokeStyle = color('--accent');
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x0 - 1, y0 - 1, cell + 2, cell + 2);
      }
    }
  });
  cv.canvas.classList.add('scroll-ok');
  cv.canvas.addEventListener('click', (e) => {
    const r = cv.canvas.getBoundingClientRect();
    const px = e.clientX - r.left - grid.x0;
    const py = e.clientY - r.top - grid.y0;
    if (px < 0 || py < 0) return;
    const k = Math.floor(py / grid.cell) * grid.cols + Math.floor(px / grid.cell);
    if (Math.floor(px / grid.cell) < grid.cols && k < grid.n) {
      sel = k;
      cv.redraw();
    }
  });
  const zRo = f.readout('zeros');
  const sRo = f.readout('silent maps');
  f.segmented({
    label: 'layer',
    options: [
      { value: 'relu1', label: 'conv1' },
      { value: 'relu2', label: 'conv2' },
      { value: 'relu3', label: 'conv3' },
    ],
    value: 'relu1',
    onChange: (v) => {
      layer = v as Stage;
      sel = 0;
      compute();
    },
  });
  function compute() {
    if (!A) return;
    const t = A.net.forward(A.net.input(A.test.pixels, img));
    F = A.net.stage(t, layer);
    const [C, H] = A.net.shape(layer);
    let zeros = 0;
    let silent = 0;
    for (let k = 0; k < C; k++) {
      let on = false;
      for (let i = k * H * H; i < (k + 1) * H * H; i++) {
        if (F[i]! > 0) on = true;
        else zeros++;
      }
      if (!on) silent++;
    }
    const zf = zeros / F.length;
    zRo.set(`${(zf * 100).toFixed(0)}%`);
    sRo.set(`${silent} of ${C}`);
    f.code.setMany({ layer: layer.replace('relu', 'conv'), shape: `(${C}, ${H}, ${H})`, zeros: fmt(zf, 2), silent });
    cv.redraw();
  }
  ready(f, (a) => {
    A = a;
    pick.setItems(a.test, a.gallery);
    img = a.gallery[0]!;
    compute();
  });
}

function topImagesFig(f: Fig): void {
  let A: Assets | null = null;
  let layer: 'pool2' | 'pool3' = 'pool3';
  let unit = 20;
  let mode: 'channel' | 'random' = 'channel';
  let dir = 9;
  const cv = f.canvas(640, 330, (ctx, w, h) => {
    if (!A) return;
    const list = mode === 'channel' ? A.an.units[layer]![unit]! : A.an.units[`${layer}_rand`]![dir]!;
    const gap = Math.max(6, w * 0.015);
    const cols = 4;
    const size = Math.min((w - gap * (cols - 1)) / cols, (h - 2 * 18 - gap) / 2);
    const left = (w - (size * cols + gap * (cols - 1))) / 2;
    list.forEach(([i, yy, xx], k) => {
      const x0 = left + (k % cols) * (size + gap);
      const y0 = Math.floor(k / cols) * (size + 18 + gap);
      blit(ctx, sampleImg(A!, i), x0, y0, size, size);
      const [ry0, rx0, ry1, rx1] = A!.net.receptiveField(layer, yy, xx);
      const s = size / 32;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeRect(x0 + rx0 * s + 1.5, y0 + ry0 * s + 1.5, (rx1 - rx0 + 1) * s - 3, (ry1 - ry0 + 1) * s - 3);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffd400';
      ctx.strokeRect(x0 + rx0 * s + 1.5, y0 + ry0 * s + 1.5, (rx1 - rx0 + 1) * s - 3, (ry1 - ry0 + 1) * s - 3);
      label(ctx, `${CIFAR_CLASSES[A!.an.labels[i]!]}`, x0 + size / 2, y0 + size + 13, { size: 11, color: color('--ink-2') });
    });
  });
  cv.canvas.classList.add('scroll-ok');
  const commonRo = f.readout('most common label');
  const unitSlider = f.slider({
    label: 'channel',
    min: 0,
    max: 63,
    step: 1,
    value: unit,
    slot: 'unit',
    format: (v) => String(Math.round(v)),
    onInput: (v) => {
      unit = Math.round(v);
      if (mode !== 'channel') modeSeg.set('channel');
      else sync();
    },
  });
  f.segmented({
    label: 'layer',
    options: [
      { value: 'pool2', label: 'pool2 (32 ch.)' },
      { value: 'pool3', label: 'pool3 (64 ch.)' },
    ],
    value: 'pool3',
    slot: 'layer',
    onChange: (v) => {
      layer = v as 'pool2' | 'pool3';
      const C = layer === 'pool2' ? 32 : 64;
      unitSlider.input.max = String(C - 1);
      if (unit > C - 1) unitSlider.set(C - 1, false);
      unit = Math.min(unit, C - 1);
      sync();
    },
  });
  const modeSeg = f.segmented({
    label: 'direction',
    options: [
      { value: 'channel', label: 'one channel' },
      { value: 'random', label: 'random' },
    ],
    value: 'channel',
    slot: 'mode',
    onChange: (v) => {
      mode = v as 'channel' | 'random';
      sync();
    },
  });
  f.button('New random direction', () => {
    dir = (dir + 1) % 12;
    if (mode !== 'random') modeSeg.set('random');
    else sync();
  }, { icon: 'shuffle' });
  function sync() {
    if (!A) return;
    const list = mode === 'channel' ? A.an.units[layer]![unit]! : A.an.units[`${layer}_rand`]![dir]!;
    const counts = new Array(10).fill(0) as number[];
    for (const [i] of list) counts[A.an.labels[i]!]!++;
    const best = argmax(counts);
    commonRo.set(`${CIFAR_CLASSES[best]}: ${counts[best]} of 8`);
    f.code.highlight(mode === 'channel' ? 'unit' : 'rand');
    f.code.set('dir', dir);
    cv.redraw();
  }
  ready(f, (a) => {
    A = a;
    sync();
  });
}

function tsneFig(f: Fig): void {
  let A: Assets | null = null;
  let space: 'codes' | 'pixels' = 'codes';
  let showImages = true;
  let t = 1;
  let from: 'codes' | 'pixels' = 'codes';
  let q = 13;
  let atlas: HTMLCanvasElement | null = null;
  const pos = (i: number): [number, number] => {
    const a = A!.an.tsne[from][i]!;
    const b = A!.an.tsne[space][i]!;
    const s = t * t * (3 - 2 * t);
    return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
  };
  let geom = { cx: 0, cy: 0, r: 1 };
  const map = f.canvas(640, 560, (ctx, w, h) => {
    if (!A || !atlas) return;
    const th = Math.max(9, w / 32);
    const r = Math.min(w, h) / 2 - th / 2 - 2;
    geom = { cx: w / 2, cy: h / 2, r };
    const order = Array.from({ length: 1000 }, (_, i) => i);
    for (const i of order) {
      const [px, py] = pos(i);
      const X = w / 2 + px * (w / 2 - th / 2 - 2);
      const Y = h / 2 - py * r;
      if (showImages) {
        ctx.drawImage(atlas, (i % 40) * 32, Math.floor(i / 40) * 32, 32, 32, X - th / 2, Y - th / 2, th, th);
      } else {
        ctx.beginPath();
        ctx.arc(X, Y, Math.max(2.5, th * 0.22), 0, Math.PI * 2);
        ctx.fillStyle = TAB10[A.an.labels[i]!]!;
        ctx.fill();
      }
    }
    const hl = [q, ...A.an.nn[space][q]!];
    hl.forEach((i, k) => {
      const [px, py] = pos(i);
      const X = w / 2 + px * (w / 2 - th / 2 - 2);
      const Y = h / 2 - py * r;
      ctx.lineWidth = k === 0 ? 3 : 2;
      ctx.strokeStyle = k === 0 ? color('--accent') : color('--ink');
      ctx.strokeRect(X - th / 2 - 2, Y - th / 2 - 2, th + 4, th + 4);
    });
  });
  const legend = f.canvas(640, 52, (ctx, w, h) => {
    const cols = 5;
    const cw = w / cols;
    CIFAR_CLASSES.forEach((c, k) => {
      const x0 = (k % cols) * cw;
      const y0 = Math.floor(k / cols) * (h / 2) + h / 4 + 5;
      ctx.fillStyle = TAB10[k]!;
      ctx.beginPath();
      ctx.arc(x0 + 8, y0 - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, c, x0 + 17, y0, { align: 'left', size: 12 });
    });
  });
  legend.canvas.classList.add('scroll-ok');
  legend.canvas.style.border = '0';
  legend.canvas.style.background = 'transparent';
  const nnCv = f.canvas(640, 270, (ctx, w, h) => {
    if (!A) return;
    const Q = Math.min(w * 0.2, h * 0.5);
    label(ctx, 'tapped', Q / 2, 14, { size: 12, bold: true });
    blit(ctx, cifarImg(A.train, q), 0, 22, Q, Q);
    label(ctx, CIFAR_CLASSES[A.an.labels[q]!]!, Q / 2, 22 + Q + 15, { size: 12, bold: true, color: color('--ink') });
    const x0 = Q + Math.max(10, w * 0.03);
    const gap = 4;
    const s = Math.min((w - x0 - gap * 5) / 6, (h - 2 * 34) / 2);
    (['codes', 'pixels'] as const).forEach((sp, row) => {
      const y0 = row * (s + 36);
      label(ctx, sp === 'codes' ? 'nearest in CNN-code space' : 'nearest in pixel space', x0, y0 + 13, { align: 'left', size: 12, bold: sp === space, color: sp === space ? color('--ink') : color('--ink-2') });
      A!.an.nn[sp][q]!.forEach((i, k) => {
        const xx = x0 + k * (s + gap);
        blit(ctx, cifarImg(A!.train, i), xx, y0 + 19, s, s);
        const same = A!.an.labels[i] === A!.an.labels[q];
        label(ctx, CIFAR_CLASSES[A!.an.labels[i]!]!, xx + s / 2, y0 + 19 + s + 13, { size: 11, bold: same, color: same ? color('green') : color('--ink-3') });
      });
    });
  });
  nnCv.canvas.classList.add('scroll-ok');
  const agreeRo = f.readout('neighbors sharing the label');
  f.segmented({
    label: 'embed',
    options: [
      { value: 'codes', label: 'CNN codes' },
      { value: 'pixels', label: 'raw pixels' },
    ],
    value: 'codes',
    slot: 'space',
    onChange: (v) => {
      from = space;
      space = v as 'codes' | 'pixels';
      t = 0;
      anim.start();
      sync();
    },
  });
  f.toggle({ label: 'thumbnails', value: true, onChange: (v) => { showImages = v; map.redraw(); } });
  const anim = f.loop((dt) => {
    t = Math.min(1, t + dt / 0.7);
    map.redraw();
    if (t >= 1) return false;
  });
  map.canvas.addEventListener('pointerdown', (e) => {
    if (!A) return;
    const r = map.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const th = Math.max(9, r.width / 32);
    let best = -1;
    let bd = (th * 1.2) ** 2;
    for (let i = 0; i < 1000; i++) {
      const [px, py] = pos(i);
      const X = r.width / 2 + px * (r.width / 2 - th / 2 - 2);
      const Y = geom.cy - py * geom.r;
      const d = (X - mx) ** 2 + (Y - my) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best >= 0) {
      q = best;
      sync();
    }
  });
  map.canvas.classList.add('scroll-ok');
  function sync() {
    if (!A) return;
    const same = (sp: 'codes' | 'pixels') => A!.an.nn[sp][q]!.filter((i) => A!.an.labels[i] === A!.an.labels[q]).length;
    agreeRo.set(`codes ${same('codes')}/6, pixels ${same('pixels')}/6`);
    f.code.set('q', q);
    map.redraw();
    nnCv.redraw();
  }
  ready(f, (a) => {
    A = a;
    atlas = document.createElement('canvas');
    atlas.width = 40 * 32;
    atlas.height = 25 * 32;
    const actx = atlas.getContext('2d')!;
    for (let i = 0; i < 1000; i++) actx.putImageData(cifarImg(a.train, i), (i % 40) * 32, Math.floor(i / 40) * 32);
    q = 13;
    sync();
  });
}

function occlusionFig(f: Fig): void {
  let A: Assets | null = null;
  let img = 0;
  let patch = 8;
  let heat = new Float32Array(256).fill(NaN);
  let pos = 0;
  let base = 0;
  let x0: Float32Array | null = null;
  const pick = imagePicker(f, (i) => {
    img = i;
    restart();
  });
  const cv = f.canvas(640, 300, (ctx, w, h) => {
    if (!A || !x0) return;
    const bar = 52;
    const gap = Math.max(10, w * 0.03);
    const S = Math.min((w - gap * 2 - bar) / 2, h - 24);
    const top = 20;
    const narrow = S < 230;
    const cls = CIFAR_CLASSES[A.test.labels[img]!];
    label(ctx, narrow ? 'patched image' : 'image with the gray patch', S / 2, 13, { size: 12 });
    label(ctx, narrow ? `p(${cls}) map` : `p(${cls}) at each patch spot`, S + gap + S / 2, 13, { size: 12 });
    const live = pos < 256 ? pos : -1;
    const xi = Float32Array.from(x0);
    if (live >= 0) occlude(xi, live);
    blit(ctx, inputImage(xi, A.net.mean), 0, top, S, S);
    const hx = S + gap;
    ctx.fillStyle = color('--paper-2');
    ctx.fillRect(hx, top, S, S);
    let lo = Infinity;
    let hi2 = -Infinity;
    for (let k = 0; k < 256; k++) {
      if (Number.isNaN(heat[k]!)) continue;
      lo = Math.min(lo, heat[k]!);
      hi2 = Math.max(hi2, heat[k]!);
    }
    if (!(hi2 - lo > 1e-3)) lo = hi2 - 1e-3;
    const im = new ImageData(16, 16);
    for (let k = 0; k < 256; k++) {
      const v = heat[k]!;
      const [r, g, b] = Number.isNaN(v) ? [0, 0, 0] : viridis((v - lo) / (hi2 - lo));
      im.data[k * 4] = r;
      im.data[k * 4 + 1] = g;
      im.data[k * 4 + 2] = b;
      im.data[k * 4 + 3] = Number.isNaN(v) ? 0 : 255;
    }
    blit(ctx, im, hx, top, S, S);
    if (live >= 0) {
      const rr = Math.floor(live / 16);
      const cc = live % 16;
      const s = S / 32;
      const y0 = Math.max(0, 2 * rr + 1 - Math.floor(patch / 2));
      const x00 = Math.max(0, 2 * cc + 1 - Math.floor(patch / 2));
      const y1 = Math.min(32, 2 * rr + 1 - Math.floor(patch / 2) + patch);
      const x1 = Math.min(32, 2 * cc + 1 - Math.floor(patch / 2) + patch);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx + x00 * s, top + y0 * s, (x1 - x00) * s, (y1 - y0) * s);
    }
    const bx = hx + S + 10;
    for (let i = 0; i < S; i++) {
      const [r, g, b] = viridis(1 - i / S);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(bx, top + i, 10, 1);
    }
    if (Number.isFinite(lo)) {
      label(ctx, hi2.toFixed(2), bx + 13, top + 9, { align: 'left', size: 11, mono: true });
      label(ctx, lo.toFixed(2), bx + 13, top + S, { align: 'left', size: 11, mono: true });
    }
  });
  cv.canvas.classList.add('scroll-ok');
  const baseRo = f.readout('p, nothing covered');
  const minRo = f.readout('lowest p');
  f.slider({
    label: 'patch size',
    min: 2,
    max: 16,
    step: 2,
    value: patch,
    slot: 'patch',
    format: (v) => `${Math.round(v)}`,
    onInput: (v) => {
      patch = Math.round(v);
      restart();
    },
  });
  function occlude(xi: Float32Array, k: number) {
    const rr = Math.floor(k / 16);
    const cc = k % 16;
    const t0 = 2 * rr + 1 - Math.floor(patch / 2);
    const l0 = 2 * cc + 1 - Math.floor(patch / 2);
    for (let c = 0; c < 3; c++)
      for (let y = Math.max(0, t0); y < Math.min(32, t0 + patch); y++)
        for (let q = Math.max(0, l0); q < Math.min(32, l0 + patch); q++) xi[c * 1024 + y * 32 + q] = 0;
  }
  const loop = f.loop(() => {
    if (!A || !x0) return false;
    const y = A.test.labels[img]!;
    timed(10, () => {
      const xi = Float32Array.from(x0!);
      occlude(xi, pos);
      heat[pos] = softmax(A!.net.forward(xi).scores)[y]!;
      pos++;
      return pos < 256;
    });
    f.code.highlight(['patch', 'fwd', 'rec'][pos % 3]!);
    let mn = 1;
    for (let k = 0; k < pos; k++) mn = Math.min(mn, heat[k]!);
    minRo.set(mn.toFixed(3));
    f.code.set('pmin', mn.toFixed(3));
    cv.redraw();
    if (pos >= 256) {
      f.code.highlight(null);
      return false;
    }
  });
  function restart() {
    if (!A) return;
    x0 = A.net.input(A.test.pixels, img);
    base = softmax(A.net.forward(x0).scores)[A.test.labels[img]!]!;
    baseRo.set(base.toFixed(3));
    f.code.setMany({ p0: base.toFixed(3), y: A.test.labels[img]!, yname: CIFAR_CLASSES[A.test.labels[img]!]! });
    heat = new Float32Array(256).fill(NaN);
    pos = 0;
    cv.redraw();
    loop.start();
  }
  ready(f, (a) => {
    A = a;
    pick.setItems(a.test, a.occGallery);
    img = a.occGallery[2]!;
    pick.set(img);
    restart();
  });
}

function saliencyFig(f: Fig): void {
  let A: Assets | null = null;
  let img = 0;
  let cls = 0;
  let rule: ReluRule = 'grad';
  let sal: Float32Array | null = null;
  let probs: Float32Array | null = null;
  const pick = imagePicker(f, (i) => {
    img = i;
    cls = -1;
    compute();
  });
  const cv = f.canvas(640, 236, (ctx, w, h) => {
    if (!A || !sal) return;
    const gap = Math.max(8, w * 0.025);
    const S = Math.min((w - 2 * gap) / 3, h - 22);
    const left = (w - (3 * S + 2 * gap)) / 2;
    label(ctx, 'image', left + S / 2, 13, { size: 12 });
    label(ctx, 'saliency', left + S + gap + S / 2, 13, { size: 12 });
    label(ctx, 'image × saliency', left + 2 * (S + gap) + S / 2, 13, { size: 12 });
    const im = cifarImg(A.test, img);
    blit(ctx, im, left, 20, S, S);
    const sorted = Float32Array.from(sal).sort();
    const hi = sorted[Math.floor(1023 * 0.99)]! || 1;
    blit(ctx, mapImage(sal, 0, 32, hi, inferno), left + S + gap, 20, S, S);
    const m = new ImageData(32, 32);
    for (let i = 0; i < 1024; i++) {
      const s = Math.min(1, sal[i]! / hi);
      for (let c = 0; c < 3; c++) m.data[i * 4 + c] = 16 * (1 - s) + im.data[i * 4 + c]! * s;
      m.data[i * 4 + 3] = 255;
    }
    blit(ctx, m, left + 2 * (S + gap), 20, S, S);
  });
  cv.canvas.classList.add('scroll-ok');
  const bars = f.canvas(640, 260, (ctx, w, h) => {
    if (!A || !probs) return;
    probBars(ctx, probs, 0, 0, w, h, { mark: cls });
  });
  bars.canvas.classList.add('scroll-ok');
  bars.canvas.addEventListener('click', (e) => {
    const r = bars.canvas.getBoundingClientRect();
    const k = Math.floor(((e.clientY - r.top) / r.height) * 10);
    if (k >= 0 && k < 10) {
      cls = k;
      compute();
    }
  });
  f.segmented({
    label: 'backward rule',
    options: [
      { value: 'grad', label: 'gradient' },
      { value: 'deconv', label: 'deconvnet' },
      { value: 'guided', label: 'guided' },
    ],
    value: 'grad',
    slot: 'rule',
    onChange: (v) => {
      rule = v as ReluRule;
      compute();
    },
  });
  function compute() {
    if (!A) return;
    const x = A.net.input(A.test.pixels, img);
    const t0 = A.net.forward(x);
    probs = softmax(t0.scores);
    if (cls < 0) cls = argmax(t0.scores);
    const { dx } = A.net.scoreGrad(x, cls, rule);
    sal = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) sal[i] = Math.max(Math.abs(dx[i]!), Math.abs(dx[1024 + i]!), Math.abs(dx[2048 + i]!));
    f.code.setMany({ c: cls, cname: CIFAR_CLASSES[cls]! });
    f.code.highlight(rule, 'alt');
    f.code.highlight(['bwd', 'sal']);
    cv.redraw();
    bars.redraw();
  }
  ready(f, (a) => {
    A = a;
    pick.setItems(a.test, a.gallery);
    img = a.gallery[5]!;
    pick.set(img);
    cls = -1;
    compute();
  });
}

function classVizFig(f: Fig): void {
  let A: Assets | null = null;
  let target = 4;
  let reg = 1e-3;
  let sigma = 0.5;
  let jitter = true;
  let x: Float32Array = new Float32Array(3072);
  let step = 0;
  let rng = new Rng(3);
  let probs: Float32Array | null = null;
  const done: (Float32Array | null)[] = new Array(10).fill(null);
  const STEPS = 300;
  const cv = f.canvas(640, 400, (ctx, w, h) => {
    if (!A) return;
    const stripH = (w - 9 * 4) / 10;
    const S = Math.min(w * 0.42, h - stripH - 46);
    label(ctx, `${CIFAR_CLASSES[target]}, step ${step}`, S / 2, 13, { size: 12, bold: true });
    blit(ctx, inputImage(x, A.net.mean), 0, 20, S, S, false);
    if (probs) probBars(ctx, probs, S + Math.max(10, w * 0.03), 20, w - S - Math.max(10, w * 0.03), S, { mark: target });
    const sy = h - stripH - 2;
    label(ctx, 'finished pictures, in class order (tap to revisit)', 0, sy - 8, { align: 'left', size: 11, color: color('--ink-3') });
    for (let k = 0; k < 10; k++) {
      const xx = k * (stripH + 4);
      const im = done[k];
      if (im) blit(ctx, inputImage(im, A.net.mean), xx, sy, stripH, stripH);
      else {
        ctx.strokeStyle = color('--rule');
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(xx + 0.5, sy + 0.5, stripH - 1, stripH - 1);
        ctx.setLineDash([]);
      }
      if (k === target) {
        ctx.strokeStyle = color('--accent');
        ctx.lineWidth = 2;
        ctx.strokeRect(xx - 1, sy - 1, stripH + 2, stripH + 2);
        ctx.lineWidth = 1;
      }
    }
  });
  cv.canvas.classList.add('scroll-ok');
  cv.canvas.addEventListener('click', (e) => {
    const r = cv.canvas.getBoundingClientRect();
    const stripH = (r.width - 36) / 10;
    if (e.clientY - r.top < r.height - stripH - 4) return;
    const k = Math.floor((e.clientX - r.left) / (stripH + 4));
    if (k >= 0 && k < 10) seg.set(String(k));
  });
  const seg = f.segmented({
    label: 'class',
    options: CIFAR_CLASSES.map((c, i) => ({ value: String(i), label: c })),
    value: String(target),
    onChange: (v) => {
      target = Number(v);
      f.code.setMany({ target, tname: CIFAR_CLASSES[target]! });
      ctl.stop();
      if (done[target]) {
        x = Float32Array.from(done[target]!);
        step = STEPS;
        probs = softmax(A!.net.forward(x).scores);
        cv.redraw();
      } else reset(true);
    },
  });
  f.slider({ label: 'λ (L2)', sym: 'lam', min: -5, max: -1, step: 0.1, value: -3, map: (r) => 10 ** r, format: (v) => fmt(v, 2), slot: 'reg', onInput: (v) => (reg = v) });
  f.slider({ label: 'blur σ', min: 0, max: 1.2, step: 0.05, value: 0.5, slot: 'sigma', format: (v) => fmt(v, 2), onInput: (v) => (sigma = v) });
  f.toggle({ label: 'jitter', value: true, onChange: (v) => { jitter = v; f.code.set('jit', v ? 2 : 0); } });
  const loop = f.loop(() => {
    if (!A) return false;
    const net = A.net;
    timed(12, () => {
      const jit = jitter ? 2 : 0;
      const jy = rng.int(2 * jit + 1) - jit;
      const jx = rng.int(2 * jit + 1) - jit;
      const xr = roll(x, jy, jx);
      const { dx } = net.scoreGrad(xr, target);
      for (let i = 0; i < 3072; i++) xr[i]! += 0.05 * (dx[i]! - 2 * reg * xr[i]!);
      x = roll(xr, -jy, -jx);
      clampImage(x, net.mean);
      if (sigma > 0 && step % 10 === 0) blur3(x, sigma);
      step++;
      return step < STEPS;
    });
    const t = net.forward(x);
    probs = softmax(t.scores);
    f.code.highlight(['jit', 'fwd', 'bwd', 'step'][step % 4]!);
    f.code.setMany({ t: step, score: fmt(t.scores[target]!, 3), prob: fmt(probs[target]!, 3) });
    cv.redraw();
    if (step >= STEPS) {
      done[target] = Float32Array.from(x);
      cv.redraw();
      ctl.stop();
      f.status(`Done: ${STEPS} steps. Pick another class, or change λ and blur and press **Run** again.`);
      return false;
    }
  });
  const ctl = runButton(f, loop, () => {
    if (step >= STEPS) reset(false);
    f.status('');
  });
  f.button('Reset', () => {
    ctl.stop();
    reset(true);
  }, { icon: 'reset' });
  function reset(newSeed: boolean) {
    if (newSeed) rng = new Rng(Math.floor(Math.random() * 1e6));
    const r0 = new Rng(target + 1);
    x = Float32Array.from({ length: 3072 }, () => 0.02 * r0.randn());
    step = 0;
    if (A) probs = softmax(A.net.forward(x).scores);
    f.code.setMany({ t: 0, score: '…', prob: '…' });
    cv.redraw();
  }
  ready(f, (a) => {
    A = a;
    reset(false);
    f.code.setMany({ target, tname: CIFAR_CLASSES[target]! });
    f.status('Press **Run** to grow the image for the chosen class from near-gray noise.');
  });
}

function inversionFig(f: Fig): void {
  let A: Assets | null = null;
  let img = 0;
  let layer: Stage = 'relu2';
  let x: Float32Array = new Float32Array(3072);
  let v: Float32Array = new Float32Array(3072);
  let F0: Float32Array | null = null;
  let z0 = 1;
  let step = 0;
  let loss = NaN;
  const STEPS = 200;
  const pick = imagePicker(f, (i) => {
    img = i;
    restart();
  });
  const cv = f.canvas(640, 290, (ctx, w, h) => {
    if (!A) return;
    const gap = Math.max(12, w * 0.04);
    const S = Math.min((w - gap) / 2, h - 22);
    const left = (w - (2 * S + gap)) / 2;
    label(ctx, 'original', left + S / 2, 13, { size: 12 });
    label(ctx, `rebuilt from ${layer.replace('relu', 'conv')}, step ${step}`, left + S + gap + S / 2, 13, { size: 12 });
    blit(ctx, cifarImg(A.test, img), left, 20, S, S);
    blit(ctx, inputImage(x, A.net.mean), left + S + gap, 20, S, S);
  });
  cv.canvas.classList.add('scroll-ok');
  const lossRo = f.readout('feature mismatch');
  f.segmented({
    label: 'invert',
    options: [
      { value: 'relu1', label: 'conv1' },
      { value: 'relu2', label: 'conv2' },
      { value: 'relu3', label: 'conv3' },
      { value: 'pool3', label: 'pool3' },
    ],
    value: 'relu2',
    onChange: (v) => {
      layer = v as Stage;
      f.code.set('layer', layer.replace('relu', 'conv'));
      restart();
    },
  });
  const loop = f.loop(() => {
    if (!A || !F0) return false;
    const net = A.net;
    timed(12, () => {
      const t = net.forward(x);
      const F = net.stage(t, layer);
      const dF = new Float32Array(F.length);
      let l = 0;
      for (let i = 0; i < F.length; i++) {
        const d = F[i]! - F0![i]!;
        l += d * d;
        dF[i] = (2 * d) / z0;
      }
      loss = l / z0;
      const dx = net.backward(t, { [layer]: dF });
      addTvGrad(x, dx, 0.005);
      for (let i = 0; i < 3072; i++) {
        v[i] = 0.9 * v[i]! - 0.2 * dx[i]!;
        x[i]! += v[i]!;
      }
      clampImage(x, net.mean);
      step++;
      return step < STEPS;
    });
    lossRo.set(loss.toFixed(3));
    f.code.highlight(['fwd', 'loss', 'bwd', 'step'][step % 4]!);
    f.code.setMany({ t: step, loss: loss.toFixed(3) });
    cv.redraw();
    if (step >= STEPS) {
      f.code.highlight(null);
      return false;
    }
  });
  f.button('Run again', () => restart(), { icon: 'reset' });
  function restart() {
    if (!A) return;
    const net = A.net;
    F0 = Float32Array.from(net.stage(net.forward(net.input(A.test.pixels, img)), layer));
    z0 = 0;
    for (let i = 0; i < F0.length; i++) z0 += F0[i]! * F0[i]!;
    const r = new Rng(11);
    x = Float32Array.from({ length: 3072 }, () => 0.02 * r.randn());
    v = new Float32Array(3072);
    step = 0;
    cv.redraw();
    loop.start();
  }
  ready(f, (a) => {
    A = a;
    pick.setItems(a.test, a.gallery);
    img = a.gallery[6]!;
    pick.set(img);
    restart();
  });
}

function dreamFig(f: Fig): void {
  let A: Assets | null = null;
  let img = 0;
  let layer: Stage = 'relu3';
  let x: Float32Array = new Float32Array(3072);
  let step = 0;
  const MAX = 60;
  const rng = new Rng(5);
  const pick = imagePicker(f, (i) => {
    img = i;
    reset();
  });
  const cv = f.canvas(640, 290, (ctx, w, h) => {
    if (!A) return;
    const gap = Math.max(12, w * 0.04);
    const S = Math.min((w - gap) / 2, h - 22);
    const left = (w - (2 * S + gap)) / 2;
    label(ctx, 'original', left + S / 2, 13, { size: 12 });
    label(ctx, `dreaming on ${layer.replace('relu', 'conv')}, step ${step}`, left + S + gap + S / 2, 13, { size: 12 });
    blit(ctx, cifarImg(A.test, img), left, 20, S, S);
    blit(ctx, inputImage(x, A.net.mean), left + S + gap, 20, S, S);
  });
  cv.canvas.classList.add('scroll-ok');
  f.segmented({
    label: 'amplify',
    options: [
      { value: 'relu1', label: 'conv1' },
      { value: 'relu2', label: 'conv2' },
      { value: 'relu3', label: 'conv3' },
    ],
    value: 'relu3',
    onChange: (v) => {
      layer = v as Stage;
      f.code.set('layer', layer.replace('relu', 'conv'));
      ctl.stop();
      reset();
    },
  });
  let last = 0;
  const loop = f.loop((_, t) => {
    if (!A) return false;
    if (t - last < 0.06) return;
    last = t;
    const net = A.net;
    const jy = rng.int(5) - 2;
    const jx = rng.int(5) - 2;
    const xr = roll(x, jy, jx);
    const tr = net.forward(xr);
    const F = net.stage(tr, layer);
    const dx = net.backward(tr, { [layer]: F });
    let m = 0;
    for (let i = 0; i < 3072; i++) m += Math.abs(dx[i]!);
    m /= 3072;
    for (let i = 0; i < 3072; i++) xr[i]! += (0.004 * dx[i]!) / (m || 1);
    x = roll(xr, -jy, -jx);
    clampImage(x, net.mean);
    step++;
    f.code.highlight(['fwd', 'bwd', 'step'][step % 3]!);
    f.code.set('t', step);
    cv.redraw();
    if (step >= MAX) {
      ctl.stop();
      f.status(`Stopped after ${MAX} steps. **Reset** to start over from the original.`);
      return false;
    }
  });
  const ctl = runButton(f, loop, () => f.status(''), ['Dream', 'Pause']);
  f.button('Reset', () => {
    ctl.stop();
    reset();
  }, { icon: 'reset' });
  function reset() {
    if (!A) return;
    x = A.net.input(A.test.pixels, img);
    step = 0;
    f.code.set('t', 0);
    f.status('');
    cv.redraw();
  }
  ready(f, (a) => {
    A = a;
    pick.setItems(a.test, a.gallery);
    img = a.gallery[16]!;
    pick.set(img);
    reset();
  });
}

function gramFig(f: Fig): void {
  let A: Assets | null = null;
  let img = 0;
  let show: 'relu1' | 'relu2' = 'relu1';
  let G0: Record<string, Float32Array> = {};
  let Z: Record<string, number> = {};
  let Gx: Record<string, Float32Array> = {};
  let x: Float32Array = new Float32Array(3072);
  let v: Float32Array = new Float32Array(3072);
  let step = 0;
  let loss = NaN;
  const STEPS = 300;
  const LAYERS = ['relu1', 'relu2'] as const;
  const pick = imagePicker(f, (i) => {
    img = i;
    restart();
  });
  const drawGram = (ctx: CanvasRenderingContext2D, G: Float32Array | undefined, C: number, hi: number, x0: number, y0: number, S: number) => {
    if (!G) return;
    const im = new ImageData(C, C);
    for (let i = 0; i < C * C; i++) {
      const [r, g, b] = inferno(Math.sqrt(Math.max(0, G[i]!) / hi));
      im.data[i * 4] = r;
      im.data[i * 4 + 1] = g;
      im.data[i * 4 + 2] = b;
      im.data[i * 4 + 3] = 255;
    }
    blit(ctx, im, x0, y0, S, S);
  };
  const cv = f.canvas(640, 470, (ctx, w, h) => {
    if (!A) return;
    const gap = Math.max(12, w * 0.04);
    const S = Math.min((w - gap) / 2, (h - 2 * 22 - gap) / 2);
    const left = (w - (2 * S + gap)) / 2;
    const C = show === 'relu1' ? 16 : 32;
    let hi = 0;
    const g0 = G0[show];
    if (g0) for (let i = 0; i < g0.length; i++) hi = Math.max(hi, g0[i]!);
    const name = show.replace('relu', 'conv');
    label(ctx, 'source', left + S / 2, 13, { size: 12 });
    label(ctx, `Gram, ${name} (${C}×${C})`, left + S + gap + S / 2, 13, { size: 12 });
    blit(ctx, cifarImg(A.test, img), left, 20, S, S);
    drawGram(ctx, g0, C, hi, left + S + gap, 20, S);
    const y2 = 20 + S + gap + 2;
    label(ctx, `synthesized, step ${step}`, left + S / 2, y2 - 7, { size: 12 });
    label(ctx, 'its Gram', left + S + gap + S / 2, y2 - 7, { size: 12 });
    blit(ctx, inputImage(x, A.net.mean), left, y2, S, S);
    drawGram(ctx, Gx[show], C, hi, left + S + gap, y2, S);
  });
  cv.canvas.classList.add('scroll-ok');
  const lossRo = f.readout('style loss');
  f.segmented({
    label: 'show Gram of',
    options: [
      { value: 'relu1', label: 'conv1' },
      { value: 'relu2', label: 'conv2' },
    ],
    value: 'relu1',
    onChange: (vv) => {
      show = vv as 'relu1' | 'relu2';
      cv.redraw();
    },
  });
  const grams = (t: ReturnType<ConvNet['forward']>) => {
    const out: Record<string, Float32Array> = {};
    for (const l of LAYERS) {
      const [C, H] = A!.net.shape(l);
      out[l] = gram(A!.net.stage(t, l), C, H * H);
    }
    return out;
  };
  const loop = f.loop(() => {
    if (!A) return false;
    const net = A.net;
    timed(12, () => {
      const t = net.forward(x);
      Gx = grams(t);
      const inj: Partial<Record<Stage, Float32Array>> = {};
      loss = 0;
      for (const l of LAYERS) {
        const [C, H] = net.shape(l);
        const M = H * H;
        const G = Gx[l]!;
        const F = net.stage(t, l);
        const dG = new Float32Array(C * C);
        for (let i = 0; i < C * C; i++) {
          const d = G[i]! - G0[l]![i]!;
          loss += (d * d) / Z[l]!;
          dG[i] = (2 * d) / Z[l]!;
        }
        const dF = new Float32Array(C * M);
        for (let i = 0; i < C; i++)
          for (let j = 0; j < C; j++) {
            const g = (2 * dG[i * C + j]!) / M;
            if (g === 0) continue;
            for (let k = 0; k < M; k++) dF[i * M + k]! += g * F[j * M + k]!;
          }
        inj[l] = dF;
      }
      const dx = net.backward(t, inj);
      addTvGrad(x, dx, 0.002);
      for (let i = 0; i < 3072; i++) {
        v[i] = 0.9 * v[i]! - 0.05 * dx[i]!;
        x[i]! += v[i]!;
      }
      clampImage(x, net.mean);
      step++;
      return step < STEPS;
    });
    lossRo.set(loss.toFixed(3));
    f.code.highlight(['gram', 'loss', 'bwd', 'step'][step % 4]!);
    f.code.setMany({ t: step, loss: loss.toFixed(3) });
    cv.redraw();
    if (step >= STEPS) {
      Gx = grams(net.forward(x));
      cv.redraw();
      ctl.stop();
      return false;
    }
  });
  const ctl = runButton(f, loop, () => {
    if (step >= STEPS) restart();
  }, ['Synthesize', 'Pause']);
  function restart() {
    if (!A) return;
    ctl.stop();
    const t0 = A.net.forward(A.net.input(A.test.pixels, img));
    G0 = grams(t0);
    Z = {};
    for (const l of LAYERS) Z[l] = G0[l]!.reduce((s, q) => s + q * q, 0);
    const r = new Rng(4);
    x = Float32Array.from({ length: 3072 }, () => 0.05 * r.randn());
    v = new Float32Array(3072);
    Gx = grams(A.net.forward(x));
    step = 0;
    loss = NaN;
    lossRo.set('–');
    cv.redraw();
  }
  ready(f, (a) => {
    A = a;
    pick.setItems(a.test, a.gallery);
    img = a.gallery[6]!;
    pick.set(img);
    restart();
  });
}

function linearFig(f: Fig): void {
  const NMAX = 150528;
  const rng = new Rng(17);
  const W = Float32Array.from({ length: NMAX }, () => 0.1 * rng.randn());
  const X = Float32Array.from({ length: NMAX }, () => rng.next());
  X[0] = 0.5;
  const NS = [1, 3, 10, 30, 100, 300, 1000, 3072, 10000, 30000, 100000, NMAX];
  let n = 3072;
  let eps = 2 / 255;
  let s0 = 0;
  let shift = 0;
  let sd = 1;
  let mu = 0;
  const cv = f.canvas(640, 360, (ctx, w, h) => {
    const mono = (s: string, x0: number, y0: number, al: CanvasTextAlign = 'left', col = color('--ink-2')) => label(ctx, s, x0, y0, { align: al, size: 12, mono: true, color: col });
    // top: one input number on a 0..255 ruler
    label(ctx, 'one input value (of n), on the 0 to 255 pixel scale', 0, 14, { align: 'left', size: 12, bold: true, color: color('--ink') });
    const rx0 = 10;
    const rx1 = w - 10;
    const ry = 44;
    ctx.strokeStyle = color('--axis');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx0, ry);
    ctx.lineTo(rx1, ry);
    ctx.stroke();
    for (let v = 0; v <= 255; v += 51) {
      const xx = rx0 + ((rx1 - rx0) * v) / 255;
      ctx.beginPath();
      ctx.moveTo(xx, ry - 4);
      ctx.lineTo(xx, ry + 4);
      ctx.stroke();
      mono(String(v), xx, ry + 18, v === 0 ? 'left' : v === 255 ? 'right' : 'center', color('--ink-3'));
    }
    const xv = X[0]! * 255;
    const xa = Math.min(255, xv + eps * 255 * Math.sign(W[0]!));
    const px = (v: number) => rx0 + ((rx1 - rx0) * v) / 255;
    ctx.fillStyle = withAlpha(color('red'), 0.35);
    ctx.fillRect(Math.min(px(xv), px(xa)), ry - 9, Math.max(2, Math.abs(px(xa) - px(xv))), 18);
    ctx.fillStyle = color('orange');
    ctx.beginPath();
    ctx.arc(px(xv), ry, 5, 0, Math.PI * 2);
    ctx.fill();
    // bottom: score axis with the spread of w.x over random inputs
    const top = 88;
    label(ctx, 'the score W·x (gray: spread over random inputs)', 0, top, { align: 'left', size: 12, bold: true, color: color('--ink') });
    const half = Math.max(4 * sd, Math.abs(s0 - mu) + shift + sd);
    const ax0 = 10;
    const ax1 = w - 10;
    const base = h - 30;
    const sx = (v: number) => ax0 + ((v - mu + half) / (2 * half)) * (ax1 - ax0);
    const peak = base - top - 24;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const v = mu - half + (2 * half * i) / 200;
      const yy = base - peak * Math.exp(-((v - mu) ** 2) / (2 * sd * sd));
      if (i) ctx.lineTo(sx(v), yy);
      else ctx.moveTo(sx(v), yy);
    }
    ctx.lineTo(sx(mu + half), base);
    ctx.lineTo(sx(mu - half), base);
    ctx.closePath();
    ctx.fillStyle = withAlpha(color('--ink-3'), 0.18);
    ctx.fill();
    ctx.strokeStyle = color('--axis');
    ctx.beginPath();
    ctx.moveTo(ax0, base);
    ctx.lineTo(ax1, base);
    ctx.stroke();
    const tick = niceTick(half);
    for (let v = Math.ceil((mu - half) / tick) * tick; v <= mu + half; v += tick) {
      ctx.beginPath();
      ctx.moveTo(sx(v), base - 3);
      ctx.lineTo(sx(v), base + 3);
      ctx.stroke();
      mono(fmt(v, 3), sx(v), base + 17, 'center', color('--ink-3'));
    }
    const ya = base - peak * 0.55;
    ctx.strokeStyle = color('red');
    ctx.fillStyle = color('red');
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sx(s0), ya);
    ctx.lineTo(sx(s0 + shift) - 6, ya);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx(s0 + shift), ya);
    ctx.lineTo(sx(s0 + shift) - 9, ya - 5);
    ctx.lineTo(sx(s0 + shift) - 9, ya + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color('orange');
    ctx.beginPath();
    ctx.arc(sx(s0), ya, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color('red');
    ctx.beginPath();
    ctx.arc(sx(s0 + shift), ya, 6, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, `+${fmt(shift, 3)}`, (sx(s0) + sx(s0 + shift)) / 2, ya - 12, { size: 12, mono: true, bold: true, color: color('red') });
  });
  cv.canvas.classList.add('scroll-ok');
  const shiftRo = f.readout('score change');
  const sdRo = f.readout('in typical spreads');
  const sync = () => {
    let a = 0;
    let s = 0;
    let q = 0;
    let m = 0;
    for (let i = 0; i < n; i++) {
      a += W[i]! * X[i]!;
      s += Math.abs(W[i]!);
      q += W[i]! * W[i]!;
      m += 0.5 * W[i]!;
    }
    s0 = a;
    mu = m;
    shift = eps * s;
    sd = Math.sqrt(q / 12);
    shiftRo.set(fmt(shift, 3));
    sdRo.set(`${(shift / sd).toFixed(1)}×`);
    f.code.setMany({ maxd: fmt(eps, 3), shift: fmt(shift, 4), s0: fmt(s0, 3) });
    cv.redraw();
  };
  f.slider({
    label: 'inputs n',
    min: 0,
    max: NS.length - 1,
    step: 1,
    value: NS.indexOf(3072),
    map: (r) => NS[Math.round(r)]!,
    format: (v) => v.toLocaleString('en-US'),
    slot: 'n',
    onInput: (v) => {
      n = v;
      sync();
    },
  });
  f.slider({
    label: 'ε',
    sym: 'eps',
    min: 0,
    max: 8,
    step: 0.25,
    value: 2,
    format: (v) => `${fmt(v, 3)}/255`,
    onInput: (v) => {
      eps = v / 255;
      f.code.set('eps', `${fmt(v, 3)} / 255`);
      sync();
    },
  });
  f.code.set('eps', '2 / 255');
  sync();
}

function niceTick(half: number): number {
  const raw = half / 2.5;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function foolFig(f: Fig): void {
  let A: Assets | null = null;
  let img = 0;
  let target = 0;
  let mode: 'target' | 'fgsm' = 'target';
  let eps = 2 / 255;
  let x0: Float32Array | null = null;
  let x: Float32Array = new Float32Array(3072);
  let step = 0;
  let probs: Float32Array | null = null;
  let status = '';
  const pick = imagePicker(f, (i) => {
    img = i;
    reset();
  });
  const cv = f.canvas(640, 236, (ctx, w, h) => {
    if (!A || !x0) return;
    const gap = Math.max(8, w * 0.025);
    const S = Math.min((w - 2 * gap) / 3, h - 22);
    const left = (w - (3 * S + 2 * gap)) / 2;
    const d = new Float32Array(3072);
    let mx = 0;
    for (let i = 0; i < 3072; i++) {
      d[i] = x[i]! - x0[i]!;
      mx = Math.max(mx, Math.abs(d[i]!));
    }
    const mag = mx > 0 ? 0.5 / mx : 1;
    label(ctx, 'original', left + S / 2, 13, { size: 12 });
    label(ctx, mx > 0 ? `difference × ${Math.round(mag)}` : 'difference', left + S + gap + S / 2, 13, { size: 12 });
    label(ctx, 'adversarial', left + 2 * (S + gap) + S / 2, 13, { size: 12 });
    blit(ctx, inputImage(x0, A.net.mean), left, 20, S, S);
    const dm = new ImageData(32, 32);
    for (let q = 0; q < 1024; q++) {
      for (let c = 0; c < 3; c++) dm.data[q * 4 + c] = 128 + 255 * mag * d[c * 1024 + q]!;
      dm.data[q * 4 + 3] = 255;
    }
    blit(ctx, dm, left + S + gap, 20, S, S);
    blit(ctx, inputImage(x, A.net.mean), left + 2 * (S + gap), 20, S, S);
  });
  cv.canvas.classList.add('scroll-ok');
  const bars = f.canvas(640, 260, (ctx, w, h) => {
    if (!A || !probs) return;
    probBars(ctx, probs, 0, 0, w, h, { mark: A.test.labels[img]!, mark2: mode === 'target' ? target : undefined });
  });
  bars.canvas.classList.add('scroll-ok');
  const stepRo = f.readout('steps');
  const linfRo = f.readout('largest change', { sym: 'eps' });
  const predRo = f.readout('network says');
  f.segmented({
    label: 'attack',
    options: [
      { value: 'target', label: 'steer to a class' },
      { value: 'fgsm', label: 'one FGSM step' },
    ],
    value: 'target',
    onChange: (v) => {
      mode = v as 'target' | 'fgsm';
      targetSeg.el.style.display = mode === 'target' ? '' : 'none';
      runCtl.btn.style.display = mode === 'target' ? '' : 'none';
      epsSlider.el.style.display = mode === 'fgsm' ? '' : 'none';
      reset();
    },
  });
  const targetSeg = f.segmented({
    label: 'target',
    options: CIFAR_CLASSES.map((c, i) => ({ value: String(i), label: c })),
    value: '0',
    onChange: (v) => {
      target = Number(v);
      reset();
    },
  });
  const epsSlider = f.slider({
    label: 'ε',
    sym: 'eps',
    min: 0,
    max: 16,
    step: 0.5,
    value: 2,
    format: (v) => `${fmt(v, 3)}/255`,
    onInput: (v) => {
      eps = v / 255;
      f.code.set('eps', `${fmt(v, 3)} / 255`);
      if (mode === 'fgsm') fgsm();
    },
  });
  epsSlider.el.style.display = 'none';
  f.code.set('eps', '2 / 255');
  let last = 0;
  const loop = f.loop((_, t) => {
    if (!A || !x0) return false;
    if (t - last < 0.05) return;
    last = t;
    const net = A.net;
    const tr = net.forward(x);
    if (argmax(tr.scores) === target) {
      finish(tr.scores);
      return false;
    }
    const g = new Float32Array(10);
    g[target] = 1;
    const dx = net.backward(tr, { scores: g });
    for (let i = 0; i < 3072; i++) x[i]! += (0.25 / 255) * Math.sign(dx[i]!);
    clampImage(x, net.mean);
    step++;
    f.code.highlight(['fwd', 'check', 'bwd', 'step'][step % 4]!);
    update(net.forward(x).scores);
    if (step >= 120) {
      finish(net.forward(x).scores);
      return false;
    }
  });
  const runCtl = runButton(f, loop, () => {
    status = '';
    f.status('');
  }, ['Attack', 'Pause']);
  f.button('Reset', () => {
    runCtl.stop();
    reset();
  }, { icon: 'reset' });
  function update(scores: Float32Array) {
    probs = softmax(scores);
    let mx = 0;
    for (let i = 0; i < 3072; i++) mx = Math.max(mx, Math.abs(x[i]! - x0![i]!));
    stepRo.set(mode === 'target' ? step : 1);
    linfRo.set(`${fmt(mx * 255, 3)}/255`);
    const p = argmax(scores);
    predRo.set(`${CIFAR_CLASSES[p]} (${(probs[p]! * 100).toFixed(0)}%)`);
    f.code.setMany({ t: step, linf: fmt(mx * 255, 3), pred: CIFAR_CLASSES[p]! });
    cv.redraw();
    bars.redraw();
  }
  function finish(scores: Float32Array) {
    runCtl.stop();
    update(scores);
    const p = argmax(scores);
    status = p === target ? `Fooled after ${step} steps: the network now says **${CIFAR_CLASSES[p]}**.` : `Gave up after ${step} steps.`;
    f.status(status);
  }
  function fgsm() {
    if (!A || !x0) return;
    const net = A.net;
    const tr = net.forward(x0);
    const pr = softmax(tr.scores);
    const y = A.test.labels[img]!;
    const g = Float32Array.from(pr);
    g[y]! -= 1;
    const dx = net.backward(tr, { scores: g });
    x = Float32Array.from(x0);
    for (let i = 0; i < 3072; i++) x[i]! += eps * Math.sign(dx[i]!);
    clampImage(x, net.mean);
    f.code.highlight('fgsm');
    update(net.forward(x).scores);
    const p = argmax(probs!);
    f.status(p === y ? `Still **${CIFAR_CLASSES[p]}**. Try a larger ε or another image.` : `One step of size ε flipped **${CIFAR_CLASSES[y]}** to **${CIFAR_CLASSES[p]}**.`);
  }
  function reset() {
    if (!A) return;
    x0 = A.net.input(A.test.pixels, img);
    x = Float32Array.from(x0);
    step = 0;
    f.code.setMany({ target, tname: CIFAR_CLASSES[target]! });
    f.code.highlight(null);
    if (mode === 'fgsm') fgsm();
    else {
      update(A.net.forward(x).scores);
      f.status('Pick a target class and press **Attack**.');
    }
  }
  ready(f, (a) => {
    A = a;
    pick.setItems(a.test, a.gallery);
    img = a.gallery[14]!;
    pick.set(img);
    target = 0;
    reset();
  });
}

/* ---------------------------------------------------------------- chapter */

const chapter: ChapterDef = {
  symbols: VISUALIZING_SYMBOLS,

  render(p) {
    p.prose(`
A trained ConvNet classifies images well, but *how* it does so is hidden inside tens of thousands (or, for the big ImageNet networks, tens of millions) of numbers. Reading those numbers one by one tells you almost nothing. Between roughly 2013 and 2015, researchers built a toolbox for looking inside: pictures of the weights and the activations, maps of which pixels matter, images that a network "wants to see", and one deeply unsettling discovery about how easily a network can be fooled.

This chapter walks through that toolbox. Every figure below runs a real ConvNet, trained on all 50,000 CIFAR-10 training images, right here in your browser: the filters you see are its filters, and every saliency map, occlusion map, dream and fooling image is computed live by the code next to it.`);

    p.h2('Why look inside?', 'why');
    p.prose(`
There are three practical reasons to visualize a network.

- **Debugging.** A picture can reveal that a model keys on the wrong evidence: a background, a watermark, a color that happens to correlate with a label in your data. Accuracy numbers alone will not tell you.
- **Trust.** Before a model makes decisions that matter, you want at least some evidence that it uses sensible parts of the image.
- **Science.** What representations does gradient descent discover when nobody tells it what an edge or an eye is? The answer turns out to be surprisingly structured.`);
    p.callout('warning', `Each technique in this chapter answers one narrow question: *which pixels change this score fastest*, *which images excite this unit*, *what image does gradient ascent produce*. None of them explains "how the network works" in full, and a striking picture can owe as much to the visualization method as to the network. Treat these tools as clues, not explanations.`, 'Explains a little, not everything');

    p.h2('The network on this page', 'network');
    p.prose(`
All figures share one small network, built from the same conv-relu-pool blocks you implement in Assignment 2. It takes a 32 × 32 color image (with the average color of the training set subtracted from every pixel), runs it through three conv-relu-pool blocks, and finishes with one fully connected layer that produces the ten class scores.`);
    p.table(
      ['Layer', 'What it does', 'Output shape', 'Parameters'],
      [
        ['input', 'image minus the mean color', '3 × 32 × 32', '0'],
        ['conv1', '16 filters, each 7 × 7 × 3, then ReLU', '16 × 32 × 32', '2,368'],
        ['pool1', '2 × 2 max pooling', '16 × 16 × 16', '0'],
        ['conv2', '32 filters, each 3 × 3 × 16, then ReLU', '32 × 16 × 16', '4,640'],
        ['pool2', '2 × 2 max pooling', '32 × 8 × 8', '0'],
        ['conv3', '64 filters, each 3 × 3 × 32, then ReLU', '64 × 8 × 8', '18,496'],
        ['pool3', '2 × 2 max pooling: the 1,024-number "CNN code"', '64 × 4 × 4', '0'],
        ['fc', 'one score per class', '10', '10,250'],
      ],
      { caption: 'In total 35,754 parameters. It reaches **82.3%** accuracy on the 10,000 CIFAR-10 test images. Every image shown in this chapter comes from that test set, so the network never saw any of them while training.' },
    );
    p.prose(`
Two functions do all the work. \`forward\` computes the scores and keeps every intermediate result in a \`cache\`. \`backward_to_image\` runs backpropagation (Chapter 6) all the way down to the pixels, so it returns one number per input value: how fast the output changes when that input changes. Every figure in this chapter is built from these two calls.`);
    p.code(`
      def forward(x):                       # x: (3, 32, 32)
          cache, a = {}, x
          for k in (1, 2, 3):
              z = conv_forward(a, W[k], b[k])   # same-size convolution
              r = np.maximum(0, z)              # ReLU
              a = max_pool_2x2(r)               # halve height and width
              cache['z%d' % k] = z
              cache['conv%d' % k], cache['pool%d' % k] = r, a
          scores = W_fc.dot(a.ravel()) + b_fc   # (10,)
          return scores, cache

      def backward_to_image(cache, dscores=None, inject={}, relu='grad'):
          """d(output)/d(image). dscores starts the gradient at the scores;
          inject adds gradients at inner layers, e.g. {'conv2': dF}."""
          da = 0 if dscores is None else W_fc.T.dot(dscores).reshape(64, 4, 4)
          for k in (3, 2, 1):
              da = da + inject.get('pool%d' % k, 0)
              dr = max_pool_backward(da, cache['conv%d' % k])
              dr = dr + inject.get('conv%d' % k, 0)
              dz = relu_backward(dr, cache['z%d' % k], relu)
              da = conv_backward_input(dz, W[k])
          return da                         # (3, 32, 32)
    `, { title: 'convnet.py' });
    p.callout('aside', `The network was trained offline in PyTorch: 30 passes over the 50,000 training images, SGD with Nesterov momentum, weight decay $5 \\times 10^{-4}$, random crops and mirror flips for data augmentation, and batch normalization (Chapter 8), which was folded into the conv weights afterwards so the network above is exactly what runs. Its scores in this page match PyTorch's to within $10^{-4}$, and its gradients agree with a finite-difference check.`, 'How it was trained');

    p.h2('Layer activations', 'activations');
    p.prose(`
The most direct thing to look at is what each layer *computes* for a given image. A conv layer with 16 filters produces 16 **activation maps** (or feature maps): one grid per filter, holding that filter's response at every position after the ReLU. Bright means "my pattern is here", and zero means "not here, or the opposite of my pattern".`);
    p.math({
      label: 'One value of a feature map',
      tex: String.raw`\symF_k[i, j] = \max\big(0,\; \symW_k \cdot \symx_{(i,j)} + b_k\big)`,
      code: `
        # filter k at output position (i, j);
        # x was zero-padded by 3 on every side
        patch = x[:, i:i+7, j:j+7]     # (3, 7, 7) window
        F[k, i, j] = max(0, np.sum(W[k] * patch) + b[k])
      `,
      terms: [
        [String.raw`\symW_k`, 'filter number $k$: a small 3 × 7 × 7 block of 147 weights'],
        [String.raw`\symx_{(i,j)}`, 'the 3 × 7 × 7 patch of the image whose corner sits at row $i$, column $j$ (after padding)'],
        [String.raw`\symW_k \cdot \symx_{(i,j)}`, 'multiply each of the 147 weights with the patch value at the same spot, and add up all 147 products: `np.sum(W[k] * patch)`'],
        [String.raw`b_k`, 'the filter\'s bias'],
        [String.raw`\max(0, \cdot)`, 'the ReLU: negative responses become 0'],
        [String.raw`\symF_k[i, j]`, 'one number of feature map $k$; sliding the patch to every $(i, j)$ fills the whole map'],
      ],
      explain: 'This is the convolution from Chapter 11, written for a single output number. The filter is a template; the multiply-and-add measures how well the image patch matches it (big when bright weights meet bright pixels); the ReLU keeps only the positive matches. A feature map is that match score painted at every position.',
    });
    p.figure({
      title: 'Feature maps of the trained network',
      codeTitle: 'activations.py',
      code: `
        scores, cache = forward(x)     # x: the tapped image
        F = cache['{{layer:conv1}}']        # {{shape:(16, 32, 32)}}, after ReLU
        zeros = (F == 0).mean()        # {{zeros}}
        silent = (F.max(axis=(1, 2)) == 0).sum()   # {{silent}}
        vmax = F.max()                 # one scale for all maps
        for k in range(len(F)):
            plt.subplot(rows, cols, k + 1)
            plt.imshow(F[k], cmap='inferno', vmin=0, vmax=vmax)
      `,
      setup: activationsFig,
      caption: `Tap an image at the top, pick a layer, and tap any map to see it enlarged on the left. All maps of a layer share one brightness scale, so a dim map is a weak response. **conv1** maps still look like the photo (edges and color regions), **conv2** maps are coarser and more selective, and **conv3** maps (8 × 8) are mostly dark with a few bright spots. A dashed outline marks a map that is zero everywhere for this image.`,
    });
    p.prose(`
Two things to notice. First, activations get **sparser** with depth. Measured over all 10,000 test images, the share of zeros after each ReLU is 52% in conv1, 59% in conv2 and 80% in conv3: deep units fire only for the specific things they detect. Second, look for maps that are black for *every* image. Such a filter is "dead": its ReLU never opens, so it never gets a gradient and never learns again. Dead filters are a classic symptom of a learning rate that was too high early in training. This network has none: even its least active conv3 channel fires on 82% of test images.`);

    p.h2('First-layer filters', 'filters');
    p.prose(`
Activations depend on the input; weights do not. The first layer is special because it looks directly at pixels, so each of its filters is itself a tiny 7 × 7 color image and we can simply draw it. The general rule of thumb from the course notes: **smooth, clean, structured filters indicate a network that trained well**, while noisy, speckled filters suggest it has not trained long enough, or that regularization was too weak and it overfit.`);
    p.figure({
      title: 'The 16 first-layer filters, from initialization to the end of training',
      codeTitle: 'show_filters.py',
      code: `
        W = snapshots['{{snap:30 epochs}}']['conv1']
        # W: (16, 3, 7, 7), sixteen 7x7 color filters
        for k in range(16):
            f = W[k].transpose(1, 2, 0)   # (7, 7, 3), like an image
            f = (f - f.min()) / (f.max() - f.min())
            plt.subplot(2, 8, k + 1)
            plt.imshow(f, interpolation='nearest')
            plt.axis('off')
      `,
      setup: filtersFig,
      caption: `Each tile is one filter of conv1, its 147 weights shown as a 7 × 7 RGB picture (stretched so its smallest weight is black and its largest white). Drag the slider back to **initial**: random noise, and 11% test accuracy (chance level). After 100 steps accuracy is already 46%, yet the filters still look like noise; by 3 epochs they have become smooth, and by the end you can see the two families every image network learns: **oriented edge detectors** (light and dark bars at different angles) and **color blob detectors** (a patch of one color against its opposite).`,
    });
    p.prose(`
AlexNet's famous first layer shows the same two families, and so does almost every network trained on natural images. Deeper layers have weights too, but they do not look at pixels: a conv2 filter is a 3 × 3 × 16 block that weighs the 16 feature maps of conv1. You *can* draw its slices as grayscale images, but they are much harder to interpret, which is why the next tools look at what deeper units *respond to* instead of at their weights.`);

    p.h2('Images that excite a neuron', 'top-images');
    p.prose(`
A simple and very effective idea, used by Girshick and colleagues in the R-CNN paper (2014): pick one unit deep in the network, run a large set of images through it, and keep the ones that make it fire hardest. If the top images share something (faces, wheels, text, a texture), that is a good hint about what the unit detects. Because a deep unit only sees part of the image (its **receptive field**), we can also box the region responsible.`);
    p.figure({
      title: 'The eight images (of 1,200) that excite a unit the most',
      codeTitle: 'top_images.py',
      code: `
        A = np.stack([forward(x)[1]['{{layer:pool3}}']
                      for x in images])   # (1200, C, H, W)
        C = A.shape[1]
        if '{{mode:channel}}' == 'channel':
            d = np.eye(C)[{{unit:20}}]          # one channel   #@unit
        else:
            d = np.random.randn(C)      # direction {{dir:9}}   #@rand
            d /= np.linalg.norm(d)                       #@rand
        resp = np.einsum('nchw,c->nhw', A, d)   # every spot
        best = resp.reshape(len(A), -1).max(axis=1)
        top8 = np.argsort(-best)[:8]
      `,
      setup: topImagesFig,
      caption: `Each image is drawn with the receptive field of its strongest spot boxed in yellow (12 × 12 pixels for pool2, 26 × 26 for pool3, which covers most of a CIFAR image). Slide through the channels: some pool3 channels collect a clear theme (20 and 56 are all cars, 45 mostly horses, 28 and 48 mostly dogs), many are a mix, and pool2 channels, which see only 12 × 12 pixels, rarely line up with a class at all: look at what their boxes share instead. Then switch the direction to **random** and press **New random direction** a few times.`,
    });
    p.prose(`
That last experiment comes from Szegedy and colleagues, "Intriguing properties of neural networks" (2013). They found that the top images for a **random direction** in a layer's activation space (a random mix of all the channels) look just as coherent as the top images for a single unit. Our small network agrees. Count how many of the top 8 images share their most common label: single pool3 channels average 4.1 of 8, and the 12 random directions in the figure average 4.0 (eight random images would give about 2.4). So individual neurons are not necessarily special. What carries meaning is the *space* the whole layer spans, and a single unit is just one arbitrary axis through it.`);
    p.callout('intuition', `Think of a layer's output at one position as a point in a 64-dimensional space. Asking "what excites channel 20?" means looking along one axis of that space. Szegedy et al. showed that looking along any other direction gives an equally sensible answer, much like a map can be read along north-south, or just as well along any rotated pair of axes.`);

    p.h2('Embedding the codes with t-SNE', 'tsne');
    p.prose(`
Here is a way to look at the whole representation at once. Take the 1,024 numbers of pool3 for an image: the input to the final classifier, often called the image's **CNN code**. Images whose codes are close together are, as far as the network is concerned, similar. To see those similarities we need to squash 1,024 dimensions down to 2 while keeping neighbors near each other, and the standard tool for that is **t-SNE** (van der Maaten and Hinton, 2008).`);
    p.callout('math', `t-SNE has no formula you need to memorize. It computes, for every pair of points, how likely they are to be neighbors in the original high-dimensional space, then moves points around on a 2-D sheet until the neighbor likelihoods there match. Nearby clusters are meaningful; the distance *between* far-apart clusters, and the size of a cluster, mostly are not.`, 'Math help: what t-SNE does');
    p.figure({
      title: 't-SNE of 1,000 test images: CNN codes versus raw pixels',
      codeTitle: 'tsne_codes.py',
      code: `
        F = np.stack([forward(x)[1]['pool3'].ravel()
                      for x in X])          # (1000, 1024)
        P = X.reshape(1000, -1)             # raw pixels
        P = P - P.mean(axis=0)
        F /= np.linalg.norm(F, axis=1, keepdims=True)
        P /= np.linalg.norm(P, axis=1, keepdims=True)
        feats = F if '{{space:codes}}' == 'codes' else P
        Y = TSNE(n_components=2, perplexity=30).fit_transform(
                PCA(50).fit_transform(feats))   # (1000, 2)

        q = {{q:13}}                            # the tapped image
        dist = ((feats - feats[q]) ** 2).sum(axis=1)
        neighbors = np.argsort(dist)[1:7]   # skip q itself
      `,
      setup: tsneFig,
      caption: `Each thumbnail sits at its t-SNE position. With **CNN codes**, vehicles gather in one region and animals in another, with planes and ships near the blue-sky and water images. Switch to **raw pixels** and the map reorganizes by overall color and brightness instead. Tap any image to see its six nearest neighbors in both spaces (green labels match the tapped image). Over all 1,000 images, a neighbor in code space shares the label 55% of the time, versus 26% in pixel space (chance is 10%). The embeddings were computed offline with scikit-learn; the neighbors use the same normalized vectors.`,
    });

    p.h2('Occlusion experiments', 'occlusion');
    p.prose(`
Here is a question you can ask any classifier without knowing anything about its insides: *if I hide part of the image, does the prediction suffer?* Zeiler and Fergus (2013) did exactly this. Slide a gray square across the image, and at every position record the probability the network assigns to the correct class. Where hiding the square makes the probability collapse, the network was relying on that region.`);
    p.figure({
      title: 'Occlusion sensitivity: probability of the true class as a gray patch slides',
      codeTitle: 'occlusion.py',
      code: `
        p = {{patch:8}}                     # side of the gray square
        heat = np.zeros((16, 16))       # one value every 2 px
        for r in range(16):
            for c in range(16):
                x_occ = x.copy()
                t, l = 2*r + 1 - p//2, 2*c + 1 - p//2
                x_occ[:, max(t, 0):t+p, max(l, 0):l+p] = 0   #@patch
                scores, _ = forward(x_occ)                   #@fwd
                heat[r, c] = softmax(scores)[y]              #@rec
        # y = {{y:3}} ({{yname:cat}}): p = {{p0}}, lowest {{pmin}}
      `,
      setup: occlusionFig,
      caption: `Left: the image with the patch at its current spot. Right: the map fills in as the patch slides. Its colors stretch from the lowest to the highest probability found (the numbers on the color bar): yellow means the network hardly noticed the patch there, dark purple means covering that spot hurt the most. Setting pixels to 0 makes them gray because \`x\` already has the mean color subtracted. These 20 images were chosen because their predictions *are* sensitive to occlusion; for most images this confident network shrugs off an 8 × 8 patch almost anywhere. Shrink the patch to find the decisive details, grow it and almost everything hurts. On 32 × 32 images these maps are necessarily coarser than Zeiler and Fergus's on full-size photos.`,
    });
    p.prose(`
Occlusion is honest and easy to explain, but it is expensive: one full forward pass per patch position (256 here, many thousands for a large image), and the answer depends on the patch size and on what you fill it with. The next technique gets a similar map from a single backward pass.`);

    p.h2('Saliency maps: the gradient of the score', 'saliency');
    p.prose(`
Simonyan, Vedaldi and Zisserman (2014) asked a local version of the occlusion question: for every pixel, *if I changed this pixel's value a tiny bit, how much would the class score change?* That is exactly a derivative, and backpropagation computes all 3,072 of them at once. The magnitude of the derivative, maximized over the three color channels, gives a **saliency map**.`);
    p.math({
      label: 'Saliency map (Simonyan et al. 2014)',
      tex: String.raw`M_{ij} = \max_{c \in \{r,g,b\}} \left|\, \frac{\partial \symS_{y}}{\partial \symx_{c,i,j}} \,\right|`,
      code: `
        scores, cache = forward(x)
        dscores = np.zeros(10)
        dscores[y] = 1.0                       # gradient of S_y only
        dx = backward_to_image(cache, dscores)    # (3, 32, 32)
        M = np.abs(dx).max(axis=0)            # (32, 32) saliency
      `,
      terms: [
        [String.raw`\symS_y`, 'the (unnormalized) score of class $y$, before the softmax'],
        [String.raw`\frac{\partial \symS_y}{\partial \symx_{c,i,j}}`, 'the slope: how much $S_y$ changes per unit change of the input value at row $i$, column $j$, color $c$'],
        [String.raw`|\cdot|`, 'ignore the sign: raising or lowering the pixel both count'],
        [String.raw`\max_c`, 'keep the largest of the three color channels, so each pixel gets one number'],
        [String.raw`\sym{dx}{\nabla_{\!x} S_y}`, 'all 3,072 slopes together: the gradient, `dx` in the code'],
      ],
      explain: 'A *partial derivative* is the slope of the output when you wiggle just one input and hold all others still. A large slope means the score is sensitive to that pixel. Setting `dscores` to a one-hot vector tells backpropagation "I care about the score of class y only", and one backward pass returns the slope for every pixel.',
    });
    p.figure({
      title: 'Saliency maps, live',
      codeTitle: 'saliency.py',
      code: `
        scores, cache = forward(x)
        dscores = np.zeros(10)
        dscores[{{c:3}}] = 1.0            # explain: {{cname:cat}}
        dx = backward_to_image(cache, dscores,        #@bwd
                               relu='{{rule:grad}}')       #@bwd
        saliency = np.abs(dx).max(axis=0)   # (32, 32)  #@sal

        def relu_backward(dr, z, rule):
            if rule == 'grad':                   #@grad
                return dr * (z > 0)              #@grad
            if rule == 'deconv':                 #@deconv
                return dr * (dr > 0)             #@deconv
            if rule == 'guided':                 #@guided
                return dr * (z > 0) * (dr > 0)   #@guided
      `,
      setup: saliencyFig,
      caption: `Pick an image, then **tap a class** in the bar chart to explain that class's score (it starts on the network's own prediction). The middle panel is the saliency map; the right panel keeps only the salient pixels. Plain gradients are speckled but usually concentrate on the object rather than the background. The **deconvnet** and **guided** options change one line of backpropagation, explained in the next section.`,
    });
    p.callout('aside', `Simonyan et al. also used saliency maps for weakly supervised segmentation: threshold the map, and use it to seed a standard segmentation algorithm (GraphCut), getting rough object masks from a network trained only on image labels.`, 'A use for saliency');

    p.h2('Deconvnets and guided backpropagation', 'guided');
    p.prose(`
Plain gradients make speckled, noisy maps. Two variants that give cleaner pictures change only how the backward pass treats each ReLU:

- **Deconvnet** (Zeiler and Fergus, 2013) passes a gradient back through a ReLU whenever the *gradient* is positive, ignoring whether the unit was active in the forward pass.
- **Guided backpropagation** (Springenberg et al., 2014) passes it only when *both* the forward input was positive (the ordinary rule) *and* the gradient is positive. In words: only follow paths that were active and that increase the output.`);
    p.table(
      ['Backward rule', 'Passes the signal through a ReLU when…', 'Look'],
      [
        ['true gradient', 'the unit was active in the forward pass ($z > 0$)', 'speckled, faithful to the math'],
        ['deconvnet', 'the incoming gradient is positive', 'edge-like; ignores which units this image switched on'],
        ['guided backprop', 'both of the above', 'crisp, image-like object outlines'],
      ],
    );
    p.prose(`
Switch the saliency figure above between the three rules. Guided backpropagation produces the cleanest pictures, which is why it became popular. But crispness is not the same as faithfulness. Tap different classes in the bar chart while on **guided**: the map barely changes. Measured over the 200 test images, the guided maps of two different classes for the same image have an average correlation of 0.68, versus 0.38 for plain gradients, so guided backpropagation says more about the image than about the class being explained. That is the warning at the top of the chapter in action: a sharp picture can come partly from the image's own edges rather than from the network's reasoning about one class.

Zeiler and Fergus used their deconvnet to project single *intermediate* units back to pixel space (start the backward pass from one unit instead of a class score), which is how the famous layer-by-layer "what does this neuron see" pictures were made.`);

    p.h2('Class model visualization', 'class-viz');
    p.prose(`
Saliency explains a given image. We can also turn the question around and ask the network to *draw*: which image would make the score of class $c$ as large as possible? Start from a gray image and do **gradient ascent** on the pixels, the same gradient descent you know from training, except that now the weights stay fixed, the image is what changes, and we climb instead of descend.`);
    p.math({
      label: 'Class model visualization (Simonyan et al. 2014)',
      tex: String.raw`\symx^{*} = \arg\max_{\symx}\; \symS_c(\symx) - \symlam \lVert \symx \rVert_2^2`,
      code: `
        for t in range(300):
            scores, cache = forward(x)
            dscores = np.zeros(10); dscores[target] = 1
            dx = backward_to_image(cache, dscores)
            x += 0.05 * (dx - 2 * reg * x)     # climb the objective
      `,
      terms: [
        [String.raw`\arg\max_{\symx}`, 'the input $x$ that makes what follows as large as possible'],
        [String.raw`\symS_c(\symx)`, 'the raw score for class $c$ (not the softmax probability)'],
        [String.raw`\lVert \symx \rVert_2^2`, 'the sum of every input value squared: large for a garish, extreme image'],
        [String.raw`\symlam`, 'how strongly we prefer modest images'],
      ],
      explain: 'Without the penalty, the easiest way to raise the score is to push pixels to extreme values. The penalty keeps the image near the mean, the way L2 regularization keeps weights small (Chapter 4). Its gradient is $2\\lambda x$, which is where `- 2 * reg * x` comes from. Simonyan et al. used the raw score rather than the probability because the probability can also be raised by pushing *other* classes down; climbing the score keeps the optimization focused on class $c$ itself.',
    });
    p.prose(`
A tiny penalty alone still gives noisy, high-frequency images. Yosinski and colleagues (2015) showed that simple image priors, such as blurring the image every few steps, help a lot. Assignment 3's version combines three tricks: periodic **blur** (which kills high-frequency noise), **jitter** (shift the image by a random pixel or two before each step and shift it back after, so the result cannot depend on exact pixel alignment), and **clipping** (keep every pixel a valid color).`);
    p.figure({
      title: 'Growing an image that the network scores as a class',
      codeTitle: 'class_visualization.py',
      code: `
        x = 0.02 * np.random.randn(3, 32, 32)   # near gray
        target = {{target:4}}                       # {{tname:deer}}
        for t in range(300):
            jy, jx = np.random.randint(-{{jit:2}}, {{jit:2}} + 1, 2)  #@jit
            x = np.roll(x, (jy, jx), axis=(1, 2))      #@jit
            scores, cache = forward(x)                 #@fwd
            dscores = np.zeros(10); dscores[target] = 1
            dx = backward_to_image(cache, dscores)     #@bwd
            x += 0.05 * (dx - 2 * reg * x)             #@step
            x = np.roll(x, (-jy, -jx), axis=(1, 2))
            x = np.clip(x, -mean, 1 - mean)   # valid colors
            if t % 10 == 0:
                x = blur(x, sigma={{sigma:0.5}})
        # reg = {{reg}}; step {{t:0}}: score {{score}}, p = {{prob}}
      `,
      setup: classVizFig,
      caption: `Press **Run** and watch the network paint its idea of the class. Even this small network on 32 × 32 images produces recognizable parts: deer grow antlers, horses grow legs, cars get wheels, ships sit on blue water. Turn the blur to 0 and λ down to see why the priors matter, or raise λ until the picture fades to gray. The probability passes 99% within the first 20 steps; the picture keeps sharpening long after, because the raw score keeps rising. Finished pictures collect in the strip.`,
    });

    p.h2('Feature inversion', 'inversion');
    p.prose(`
How much does a layer's code remember about the image? Mahendran and Vedaldi (2014) answered by **inverting** it: given the code of an image, search for a new image, starting from noise, whose code matches. Whatever the reconstruction gets right was preserved by the layer; whatever it gets wrong was thrown away.`);
    p.math({
      label: 'Feature inversion (Mahendran and Vedaldi 2014)',
      tex: String.raw`\symx^{*} = \arg\min_{\symx} \frac{\lVert \symF(\symx) - \symF_0 \rVert^2}{\lVert \symF_0 \rVert^2} + \symlam R(\symx)`,
      code: `
        F0 = forward(x0)[1][layer]          # the code to invert
        scores, cache = forward(x)
        F = cache[layer]
        loss = np.sum((F - F0) ** 2) / np.sum(F0 ** 2)
        dF = 2 * (F - F0) / np.sum(F0 ** 2)
        dx = backward_to_image(cache, inject={layer: dF})
        dx += reg * tv_grad(x)               # smoothness prior
      `,
      terms: [
        [String.raw`\symF(\symx)`, 'the chosen layer\'s activations for the image we are building'],
        [String.raw`\symF_0`, 'the activations of the original image: the code we are trying to match'],
        [String.raw`\lVert\cdot\rVert^2`, 'sum of squared differences, divided by the size of the target so every layer is on the same scale'],
        [String.raw`R(\symx)`, 'a smoothness penalty (a form of *total variation*): the sum of squared differences between neighboring pixels'],
      ],
      explain: 'This time we *descend*: we want the mismatch to be small. The gradient of the squared mismatch with respect to the activations is simply $2(F - F_0)$, and `backward_to_image` with `inject` carries it from that layer down to the pixels. The smoothness term plays the role the blur played above.',
    });
    p.figure({
      title: 'Rebuilding an image from one layer\'s code',
      codeTitle: 'invert.py',
      code: `
        F0 = forward(x0)[1]['{{layer:conv2}}']   # code to match
        x = 0.02 * np.random.randn(3, 32, 32)   # noise
        v = np.zeros_like(x)
        for t in range(200):
            scores, cache = forward(x)                 #@fwd
            F = cache['{{layer:conv2}}']
            Z = np.sum(F0 ** 2)
            loss = np.sum((F - F0) ** 2) / Z           #@loss
            dF = 2 * (F - F0) / Z
            dx = backward_to_image(cache,              #@bwd
                    inject={'{{layer:conv2}}': dF})         #@bwd
            dx += 0.005 * tv_grad(x)                   #@bwd
            v = 0.9 * v - 0.2 * dx       # momentum    #@step
            x = np.clip(x + v, -mean, 1 - mean)        #@step
        # step {{t:0}}, mismatch {{loss}}
      `,
      setup: inversionFig,
      caption: `Choose a layer and watch the reconstruction converge (it restarts from the same noise each time). From **conv1** the image comes back almost perfectly: 16 maps at full resolution keep nearly everything. From **conv2** the layout and colors survive with some smearing. From **conv3** and **pool3** you get the right arrangement of parts, but colors and textures drift: the network has learned to ignore details that do not matter for classification. That growing *invariance* is exactly what a good classifier needs.`,
    });

    p.h2('DeepDream', 'deepdream');
    p.prose(`
In 2015 a group at Google (Mordvintsev, Olah and Tyka) published "Inceptionism", a blog post and code soon nicknamed **DeepDream**. The recipe is a playful twist on class visualization: pick a layer, and instead of asking for a particular class, ask the image to *amplify whatever that layer already detects*. If a unit sees a hint of an eye, make it more of an eye; then run again.`);
    p.math({
      label: 'One DeepDream step',
      tex: String.raw`\begin{aligned} g &= \frac{\partial}{\partial \symx}\, \tfrac{1}{2}\lVert \symF(\symx) \rVert^2 \\ \symx &\leftarrow \symx + \eta\, \frac{g}{\operatorname{mean}|g|} \end{aligned}`,
      code: `
        scores, cache = forward(x)
        F = cache[layer]
        dx = backward_to_image(cache, inject={layer: F})  # dF = F
        x += 0.004 * dx / np.abs(dx).mean()
      `,
      terms: [
        [String.raw`\tfrac{1}{2}\lVert \symF(\symx)\rVert^2`, 'half the sum of squares of the layer\'s activations: big when the layer fires a lot'],
        [String.raw`g`, 'its gradient with respect to the image. Its gradient with respect to $F$ is just $F$ itself, so we inject the activations as their own gradient'],
        [String.raw`\operatorname{mean}|g|`, 'the average size of the gradient: dividing by it makes every step a similar size'],
        [String.raw`\eta`, 'the step size (0.004 here)'],
      ],
      explain: 'Setting the upstream gradient equal to the activations means "whatever you are doing, do more of it". Strong responses get stronger, and the image drifts toward the patterns the layer has learned to see.',
    });
    p.figure({
      title: 'DeepDream on a 32 × 32 image',
      codeTitle: 'deepdream.py',
      code: `
        x = x0.copy()
        for t in range(60):
            jy, jx = np.random.randint(-2, 3, 2)
            x = np.roll(x, (jy, jx), axis=(1, 2))
            scores, cache = forward(x)                 #@fwd
            F = cache['{{layer:conv3}}']
            dx = backward_to_image(cache,              #@bwd
                    inject={'{{layer:conv3}}': F})          #@bwd
            x += 0.004 * dx / np.abs(dx).mean()        #@step
            x = np.roll(x, (-jy, -jx), axis=(1, 2))
            x = np.clip(x, -mean, 1 - mean)
        # step {{t:0}}
      `,
      setup: dreamFig,
      caption: `Press **Dream** and watch. Amplifying **conv1** boosts colors and edges, **conv2** grows fine striped textures, and **conv3** adds coarser stripes and round, eye-like spots. Google's version ran on a large ImageNet network at several image scales ("octaves"), where the same process grows dogs, birds and pagodas out of clouds. The mechanism is exactly the four lines above.`,
    });

    p.h2('Neural style: content, style and the Gram matrix', 'style');
    p.prose(`
Gatys, Ecker and Bethge (2015) used the same machinery to separate an image's **content** from its **style**. Content is easy: the feature maps of a deep layer, which (as inversion showed) keep the arrangement of objects and drop exact textures. Style needs a representation that keeps the textures and drops the arrangement, and their answer was the **Gram matrix**.

In plain words: take a layer's feature maps, and for every *pair* of maps, multiply them together position by position and add up over all positions. The result is large when the two features tend to fire *at the same places*. A Gram matrix records which features co-occur (stripes with orange, say), but because it sums over all positions, it has no idea *where* anything is.`);
    p.math({
      label: 'Gram matrix of one layer',
      tex: String.raw`\symG_{ij} = \frac{1}{M} \sum_{k=1}^{M} \symF_{ik}\, \symF_{jk}`,
      code: `
        def gram(F):                   # F: (C, H, W) feature maps
            C = F.shape[0]
            F = F.reshape(C, -1)       # one row per map, M = H*W columns
            return F.dot(F.T) / F.shape[1]   # (C, C)
      `,
      terms: [
        [String.raw`\symF_{ik}`, 'feature map $i$ at position $k$ (the 2-D map flattened into one row of $M$ numbers)'],
        [String.raw`\sum_{k=1}^{M}`, 'add up over every position: this is where the *where* gets thrown away'],
        [String.raw`\symF_{ik}\symF_{jk}`, 'large only when maps $i$ and $j$ are both active at the same position'],
        [String.raw`\symG_{ij}`, 'one number per pair of maps; with $C$ maps, $G$ is a $C \\times C$ grid'],
      ],
      explain: '`F.dot(F.T)` multiplies every row of `F` with every other row and adds up, which is exactly the sum above for all pairs at once. The diagonal $G_{ii}$ is how strongly map $i$ fires overall; off-diagonal entries say which features appear together.',
    });
    p.prose(`
To see what a Gram matrix keeps, run the experiment Gatys et al. used for **texture synthesis**: start from noise and change the image until its Gram matrices (at conv1 and conv2 here) match those of a source image. Nothing asks for the objects to be in the right place, so they are not.`);
    p.figure({
      title: 'Texture synthesis: match the Gram matrices, lose the layout',
      codeTitle: 'texture.py',
      code: `
        layers = ('conv1', 'conv2')
        G_src = {l: gram(forward(x_src)[1][l]) for l in layers}
        x = 0.05 * np.random.randn(3, 32, 32)
        v = np.zeros_like(x)
        for t in range(300):
            scores, cache = forward(x)
            loss, inject = 0, {}
            for l in layers:
                F = cache[l]
                C, M = F.shape[0], F[0].size
                G = gram(F)                                 #@gram
                Z = np.sum(G_src[l] ** 2)
                loss += np.sum((G - G_src[l]) ** 2) / Z     #@loss
                dG = 2 * (G - G_src[l]) / Z
                dF = 2 * dG.dot(F.reshape(C, M)) / M
                inject[l] = dF.reshape(F.shape)
            dx = backward_to_image(cache, inject=inject)    #@bwd
            dx += 0.002 * tv_grad(x)                        #@bwd
            v = 0.9 * v - 0.05 * dx                         #@step
            x = np.clip(x + v, -mean, 1 - mean)             #@step
        # step {{t:0}}, style loss {{loss}}
      `,
      setup: gramFig,
      caption: `Press **Synthesize**. The bottom-right Gram matrix converges to the top-right one (shown as a square root of each entry so faint pairs are visible), while the synthesized image keeps the source's colors and local textures in scrambled positions: the frog's yellows and greens survive as patches, but the frog is gone. On full-size images with a big network (Gatys et al. used VGG-19 and five layers), the same procedure produces convincing textures of brick, foliage or paint.`,
    });
    p.math({
      label: 'Neural style transfer (Gatys et al. 2015)',
      tex: String.raw`\begin{aligned} \mathcal{L}(\symx) = {} & \alpha \,\lVert \symF_{\ell}(\symx) - \symF_{\ell}(\symx_{c}) \rVert^2 \\ & + \beta \sum_{l} w_{l}\, \lVert \symG_{l}(\symx) - \symG_{l}(\symx_{s}) \rVert^2 \end{aligned}`,
      code: `
        scores, cache = forward(x)
        loss = alpha * np.sum((cache[l_c] - F_content) ** 2)
        for l in style_layers:
            G = gram(cache[l])
            loss += beta * w[l] * np.sum((G - G_style[l]) ** 2)
        # then descend on x exactly as in texture.py
      `,
      terms: [
        [String.raw`\symF_{\ell}(\symx) - \symF_{\ell}(\symx_{c})`, 'content loss: match the deep-layer features of the content photo $x_c$, so the objects stay where they are'],
        [String.raw`\symG_{l}(\symx) - \symG_{l}(\symx_{s})`, 'style loss: match the Gram matrices of the style image $x_s$ (a painting, say) at several layers $l$, so its textures and colors transfer'],
        [String.raw`\alpha,\ \beta`, 'how much to care about each; their ratio trades a faithful photo for a stronger painting'],
        [String.raw`w_l`, 'a weight per style layer (often equal)'],
      ],
      explain: 'Style transfer is texture synthesis plus one more term. The content term pins down *what is where*; the style terms paint it with the statistics of another image. Everything else (start from noise or from the photo, gradient steps on the pixels) is the same optimization as in the figure above, so the result is "the photo, as painted by" whatever artwork supplied the Gram matrices.',
    });

    p.h2('Adversarial examples: fooling the network', 'adversarial');
    p.prose(`
Now the unsettling part. Szegedy and colleagues (2013), the same paper as the random-directions result, found that for essentially any correctly classified image, a perturbation too small for a person to notice can make the network output any wrong class with high confidence. Worse, the same perturbed image often fools *other* networks too, even ones trained on different data. A year later, Nguyen, Yosinski and Clune (2014) showed the reverse: images that look like noise or simple patterns to us, which networks label as a specific object with over 99% confidence.

The natural first guess was that deep networks are too *nonlinear* and overfit in strange ways. Goodfellow, Shlens and Szegedy (2014) argued the opposite: they are too **linear**.`);
    p.math({
      label: 'The linear explanation (Goodfellow et al. 2014)',
      tex: String.raw`\symW^{\top}\big(\symx + \symeps\,\operatorname{sign}(\symW)\big) = \symW^{\top}\symx + \symeps\,\lVert \symW \rVert_1`,
      code: `
        x_adv = x + eps * np.sign(W)     # every input moves by +-eps
        W.dot(x_adv) - W.dot(x)          # == eps * np.abs(W).sum()
      `,
      terms: [
        [String.raw`\operatorname{sign}(\symW)`, '$+1$ where a weight is positive, $-1$ where it is negative'],
        [String.raw`\symeps\,\operatorname{sign}(\symW)`, 'nudge every input by $\\epsilon$ in whichever direction raises the score. No single input changes by more than $\\epsilon$'],
        [String.raw`\lVert \symW \rVert_1`, 'the sum of the absolute values of all the weights: it grows with the number of inputs $n$'],
        [String.raw`\symeps\,\lVert\symW\rVert_1`, 'the total change in score: roughly $\\epsilon \\cdot n \\cdot$ (average weight size)'],
      ],
      explain: 'Each input changes imperceptibly, but every one of them changes in the direction that helps, so the effects add up instead of canceling. With $n$ inputs, the score moves by about $\\epsilon$ times $n$ times the average weight size. Meanwhile the *natural* variation of the score between ordinary images only grows like the square root of $n$. In high dimensions, many tiny coordinated changes beat any one big change.',
    });
    p.figure({
      title: 'Many tiny nudges add up: the linear explanation',
      codeTitle: 'linear_explanation.py',
      code: `
        n = {{n:3072}}                    # number of inputs
        W = 0.1 * np.random.randn(n)   # one weight per input
        x = np.random.rand(n)          # an ordinary input
        x[0] = 0.5                     # the one drawn on top
        eps = {{eps:2 / 255}}
        x_adv = x + eps * np.sign(W)   # nudge every input
        np.abs(x_adv - x).max()        # {{maxd}}
        W.dot(x)                       # {{s0}}
        W.dot(x_adv) - W.dot(x)        # {{shift}}
        eps * np.abs(W).sum()          # the same number
      `,
      setup: linearFig,
      caption: `Top: one of the $n$ input values, with the red band showing how far $\\epsilon$ moves it: a sliver of the 0 to 255 range. Bottom: the gray bump is how much $W \\cdot x$ varies across random ordinary inputs, the orange dot is this input's score, and the red arrow is the change from the nudge. Keep $\\epsilon$ at 2/255 and drag $n$ from 10 up to 3,072 (CIFAR-10) and 150,528 (a 224 × 224 ImageNet image): the arrow grows in proportion to $n$, while the bump grows only like $\\sqrt{n}$, so at ImageNet size an invisible change moves the score by several typical spreads.`,
    });
    p.prose(`
A ConvNet is far from linear overall, but ReLUs, max pooling and matrix multiplies are all piecewise linear, and networks are deliberately designed to behave nearly linearly because that makes them easy to optimize. That gives a cheap attack, the **fast gradient sign method**: take one step of size $\\epsilon$ in the sign of the gradient of the loss.`);
    p.math({
      label: 'Fast gradient sign method (FGSM)',
      tex: String.raw`\symx_{\text{adv}} = \symx + \symeps\, \operatorname{sign}\!\big(\nabla_{\!\symx} L(\symx, y)\big)`,
      code: `
        scores, cache = forward(x)
        dscores = softmax(scores) - np.eye(10)[y]   # d loss / d scores
        dx = backward_to_image(cache, dscores)      # d loss / d x
        x_adv = x + eps * np.sign(dx)
      `,
      terms: [
        [String.raw`L(\symx, y)`, 'the softmax loss for the true label $y$ (Chapter 4)'],
        [String.raw`\nabla_{\!\symx} L`, 'its gradient with respect to every input number: which way each one should move to make the network *more wrong*'],
        [String.raw`\operatorname{sign}(\cdot)`, 'keep only the direction, $\\pm 1$, exactly as in the linear explanation'],
        [String.raw`\symeps`, 'the size of the step: every input number moves by exactly $\\epsilon$'],
      ],
      explain: 'The gradient of the softmax loss with respect to the scores is the probabilities minus a one-hot vector for the true class (you derive it in Assignment 1). Backpropagating that to the image and taking its sign gives the linear-explanation attack for a real network, in one forward and one backward pass. In Goodfellow et al.\'s best-known example, $\\epsilon = 0.007$ turns a panda that GoogLeNet labels with 58% confidence into a "gibbon" at 99%.',
    });
    p.prose(`
Instead of one step, we can also take many small sign steps toward a chosen class and stop the moment the network agrees. Assignment 3 builds this kind of **fooling image** (it takes normalized gradient steps instead of sign steps; both work).`);
    p.figure({
      title: 'Fooling the network into any class',
      codeTitle: 'fooling.py',
      code: `
        x_fool = x.copy()
        target = {{target:0}}                       # {{tname:plane}}
        for t in range(120):
            scores, cache = forward(x_fool)              #@fwd
            if scores.argmax() == target:                #@check
                break                                    #@check
            dscores = np.zeros(10); dscores[target] = 1
            dx = backward_to_image(cache, dscores)       #@bwd
            x_fool += 0.25 / 255 * np.sign(dx)           #@step
            x_fool = np.clip(x_fool, -mean, 1 - mean)    #@step
        # {{t:0}} steps, max change {{linf}}/255: {{pred}}

        # or: one FGSM step away from the true label y
        eps = {{eps:2 / 255}}
        scores, cache = forward(x)                       #@fgsm
        dscores = softmax(scores) - np.eye(10)[y]        #@fgsm
        dx = backward_to_image(cache, dscores)           #@fgsm
        x_adv = np.clip(x + eps * np.sign(dx), -mean, 1 - mean)  #@fgsm
      `,
      setup: foolFig,
      caption: `Pick an image and a target, then press **Attack**. Each step changes every number by a quarter of one brightness level. Most attacks succeed within 10 to 40 steps, so no number changes by more than about 2 to 10 levels out of 255: compare the original and adversarial images, which look identical, while the middle panel magnifies the difference until you can see it. Switch to **one FGSM step** and raise $\\epsilon$ until the true class (outlined bar) loses; a few levels out of 255 is usually enough.`,
    });
    p.prose(`
Why this matters:

- **Security.** Any system that acts on a network's output (a spam filter, a content moderator, a car reading road signs) can be attacked by someone who controls the input. Because adversarial images often transfer between networks, the attacker may not even need your model.
- **Understanding.** A network that is 82% accurate on natural images, yet flips its answer for an invisible change, has not learned "cat" the way we have. It has learned a function that agrees with us on the narrow set of images we trained it on.
- **It is not special to deep learning.** Any high-dimensional linear model, including the linear classifier from Chapter 4, can be fooled the same way. Deep networks inherit the weakness through their linear pieces.

Goodfellow et al. also showed a partial remedy: **adversarial training**, which mixes FGSM examples into every training batch, makes networks more robust and acts as a regularizer. But as of this course (and long after), robustness to small adversarial changes remained an open problem.`);

    p.h2('The toolbox at a glance', 'summary');
    p.table(
      ['Technique', 'Question it answers', 'Cost'],
      [
        ['Activations', 'What does each layer compute for this image?', 'one forward pass'],
        ['First-layer weights', 'What patterns does the first layer look for?', 'none (just draw the weights)'],
        ['Top-activating images', 'Which images excite this unit or direction?', 'a forward pass per dataset image'],
        ['t-SNE of codes', 'Which images does the network consider similar?', 'forward passes plus an embedding'],
        ['Occlusion', 'Which regions does the prediction depend on?', 'a forward pass per patch position'],
        ['Saliency, guided backprop', 'Which pixels is the score most sensitive to?', 'one forward and one backward pass'],
        ['Class visualization', 'What image maximizes a class score?', 'hundreds of forward and backward passes'],
        ['Feature inversion', 'What does a layer\'s code remember?', 'hundreds of passes'],
        ['DeepDream, style', 'What happens if we amplify or recombine features?', 'hundreds of passes'],
        ['Adversarial examples', 'How fragile is the decision?', 'one to a few dozen passes'],
      ],
    );
    p.callout('idea', `
- Looking at **activations** and **first-layer filters** is the cheapest health check: sparse activations, no dead filters and smooth filters signal a well-trained net.
- **Top-activating images** and **t-SNE of CNN codes** show that a network groups images by meaning, not by pixels, but single neurons are not privileged: random directions are just as interpretable.
- **Occlusion** and **saliency maps** ask which parts of an image a decision depends on; one costs a forward pass per patch, the other a single forward and backward pass.
- Running backpropagation into the **image** turns the network into a drawing tool: class visualization, feature inversion, DeepDream and style transfer are all gradient steps on the pixels with different objectives.
- The same gradient finds **adversarial examples**: because networks behave nearly linearly in very many dimensions, invisible coordinated changes can steer them to any answer.`, 'Takeaways');
  },
};

export default chapter;
