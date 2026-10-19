import type { ChapterDef } from './index';
import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { CIFAR_CLASSES, type CifarSet, cifarImage, loadCifar } from '../core/data';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { blit, cell, count, frame, mono, txt } from '../lib/convnets-draw';
import { eig3, round16, roundStoch16 } from '../lib/convnets-practice-math';
import { CONVNETS_PRACTICE_SYMBOLS } from '../lib/convnets-practice-symbols';

function local(e: PointerEvent, c: HTMLCanvasElement): [number, number] {
  const r = c.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

const narrow = (): boolean => typeof window !== 'undefined' && window.innerWidth < 600;

// ---------------------------------------------------------------------------------------
// Fig: data augmentation playground

interface Draw {
  fl: boolean;
  s: number;
  y0: number;
  x0: number;
  angU: number;
  cU: number;
  al: number[];
}

function figAugment(f: Fig): void {
  let set: CifarSet | null = null;
  let list: number[] = [];
  let pick = 0;
  let mode: 'train' | 'test' = 'train';
  let flip = true;
  let crop = true;
  let rot = 10;
  let cmode: 'off' | 'contrast' | 'pca' = 'pca';
  let sig = 0.5;
  let seed = 1;
  let sel = 1;
  let evals = [0, 0, 0];
  let evecs = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  let cw = 0;
  let ch = 0;
  const src = document.createElement('canvas');
  src.width = src.height = 32;
  const off = document.createElement('canvas');
  off.width = off.height = 32;
  const octx = off.getContext('2d', { willReadFrequently: true })!;
  const draws = (k: number): Draw => {
    const r = new Rng(seed * 977 + k * 131);
    const fl = r.next() < 0.5;
    const s = 1 + 0.3 * r.next();
    const big = Math.round(32 * s);
    return { fl, s, y0: r.int(big - 31), x0: r.int(big - 31), angU: r.uniform(-1, 1), cU: r.uniform(-1, 1), al: [r.randn(), r.randn(), r.randn()] };
  };
  const OFFS: [number, number][] = [
    [0, 0],
    [0, 4],
    [4, 0],
    [4, 4],
    [2, 2],
  ];
  const CROP_NAMES = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];
  const renderAug = (d: Draw): ImageData => {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.fillStyle = '#000';
    octx.fillRect(0, 0, 32, 32);
    octx.save();
    octx.imageSmoothingEnabled = true;
    octx.translate(16, 16);
    octx.rotate((d.angU * rot * Math.PI) / 180);
    octx.translate(-16, -16);
    if (crop) {
      const big = Math.round(32 * d.s);
      octx.translate(-d.x0, -d.y0);
      octx.scale(big / 32, big / 32);
    }
    if (flip && d.fl) {
      octx.translate(32, 0);
      octx.scale(-1, 1);
    }
    octx.drawImage(src, 0, 0);
    octx.restore();
    const img = octx.getImageData(0, 0, 32, 32);
    const px = img.data;
    if (cmode === 'contrast') {
      let m = 0;
      for (let q = 0; q < 1024; q++) m += px[q * 4] + px[q * 4 + 1] + px[q * 4 + 2];
      m /= 3072;
      const c = 1 + sig * d.cU;
      for (let q = 0; q < 1024; q++) for (let k = 0; k < 3; k++) px[q * 4 + k] = (px[q * 4 + k] - m) * c + m;
    } else if (cmode === 'pca') {
      const shift = [0, 1, 2].map((j) => 255 * [0, 1, 2].reduce((a, i) => a + evecs[j][i] * d.al[i] * sig * evals[i], 0));
      for (let q = 0; q < 1024; q++) for (let k = 0; k < 3; k++) px[q * 4 + k] = px[q * 4 + k] + shift[k];
    }
    return img;
  };
  const renderCrop = (n: number): ImageData => {
    const img = new ImageData(28, 28);
    if (!set) return img;
    const [y, x] = OFFS[n % 5];
    const fl = n >= 5;
    const o = list[pick] * 3072;
    for (let r = 0; r < 28; r++)
      for (let c = 0; c < 28; c++) {
        const sc = fl ? x + 27 - c : x + c;
        const p = (y + r) * 32 + sc;
        const q = (r * 28 + c) * 4;
        img.data[q] = set.pixels[o + p];
        img.data[q + 1] = set.pixels[o + 1024 + p];
        img.data[q + 2] = set.pixels[o + 2048 + p];
        img.data[q + 3] = 255;
      }
    return img;
  };
  const geo = (w: number, h: number) => {
    const gap = Math.max(8, w * 0.02);
    const lab = 17;
    const t = Math.min((w - 3 * gap) / 4, (h - 3 * lab - 2 * gap) / 3);
    const x0 = (w - (4 * t + 3 * gap)) / 2;
    return { gap, lab, t, x0, pos: (k: number) => [x0 + (k % 4) * (t + gap), Math.floor(k / 4) * (t + lab + gap)] as [number, number] };
  };
  const label = (k: number): string => {
    if (mode === 'test') {
      const n = k - 1;
      return `${CROP_NAMES[n % 5]}${n >= 5 ? ' ↔' : ''}`;
    }
    const d = draws(k);
    const bits: string[] = [];
    if (flip && d.fl) bits.push('flip');
    if (crop) bits.push(`${d.s.toFixed(2)}×`);
    if (rot > 0) bits.push(`${Math.round(d.angU * rot)}°`);
    return bits.join(' ') || 'no change';
  };
  const cv = f.canvas(640, 560, (ctx, w, h) => {
    cw = w;
    ch = h;
    const g = geo(w, h);
    const n = mode === 'test' ? 11 : 12;
    for (let k = 0; k < n; k++) {
      const [x, y] = g.pos(k);
      if (!set) {
        ctx.fillStyle = color('--paper-2');
        ctx.fillRect(x, y, g.t, g.t);
        continue;
      }
      if (k === 0) blit(ctx, cifarImage(set, list[pick]), x, y, g.t, g.t);
      else if (mode === 'test') blit(ctx, renderCrop(k - 1), x, y, g.t, g.t);
      else blit(ctx, renderAug(draws(k)), x, y, g.t, g.t);
      if (k === sel) frame(ctx, x - 2, y - 2, g.t + 4, g.t + 4, color('--accent'), 2.5);
      const txtS = k === 0 ? `original: ${CIFAR_CLASSES[set.labels[list[pick]]]}` : label(k);
      txt(ctx, txtS, x + g.t / 2, y + g.t + 13, { size: 11, align: 'center', ink: k === sel ? color('--ink') : color('--ink-2'), bold: k === 0 || k === sel });
    }
    // the selected view's window on the original
    if (set && sel > 0) {
      const [x, y] = g.pos(0);
      const u = g.t / 32;
      if (mode === 'test') {
        const [oy, ox] = OFFS[(sel - 1) % 5];
        ctx.setLineDash([4, 3]);
        frame(ctx, x + ox * u, y + oy * u, 28 * u, 28 * u, color('--accent'), 2);
        ctx.setLineDash([]);
      } else if (crop) {
        const d = draws(sel);
        const big = Math.round(32 * d.s);
        const k = 32 / big;
        let wx = d.x0 * k;
        if (flip && d.fl) wx = 32 - wx - 32 * k;
        ctx.setLineDash([4, 3]);
        frame(ctx, x + wx * u, y + d.y0 * k * u, 32 * k * u, 32 * k * u, color('--accent'), 2);
        ctx.setLineDash([]);
      }
    }
  });
  const sync = () => {
    const v: Record<string, string | number> = { flip: flip ? 'True' : 'False', crop: crop ? 'True' : 'False', cm: cmode, seed, sig: fmt(sig, 2) };
    if (set) v.idx = list[pick];
    if (mode === 'train' && sel > 0) {
      const d = draws(sel);
      v.fl = flip ? (d.fl ? 'flipped' : 'not flipped') : '-';
      v.s = crop ? d.s.toFixed(2) : '-';
      v.y0 = crop ? d.y0 : '-';
      v.x0 = crop ? d.x0 : '-';
      v.ang = `${(d.angU * rot).toFixed(1)}°`;
      v.c = cmode === 'contrast' ? (1 + sig * d.cU).toFixed(2) : '-';
      v.al = cmode === 'pca' ? `[${d.al.map((a) => (a * sig).toFixed(2)).join(', ')}]` : '-';
      const hl: string[] = [];
      if (flip && d.fl) hl.push('flip');
      if (crop) hl.push('crop');
      if (rot > 0) hl.push('rot');
      if (cmode !== 'off') hl.push(cmode);
      f.code.highlight(hl.length ? hl : 'batch');
    } else if (mode === 'test') f.code.highlight(sel > 0 ? 'crops' : 'test');
    else f.code.highlight(null);
    f.code.setMany(v);
    cv.redraw();
  };
  cv.canvas.classList.add('scroll-ok');
  cv.canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = local(e, cv.canvas);
    const g = geo(cw, ch);
    for (let k = 0; k < 12; k++) {
      const [tx, ty] = g.pos(k);
      if (x >= tx && x < tx + g.t && y >= ty && y < ty + g.t + g.lab) {
        if (mode === 'test' && k === 11) return;
        sel = k;
        sync();
        return;
      }
    }
  });
  f.segmented({
    label: 'phase',
    options: [
      { value: 'train', label: 'training: random' },
      { value: 'test', label: 'test: 10 crops' },
    ],
    value: 'train',
    onChange: (v) => {
      mode = v as 'train' | 'test';
      sel = Math.min(sel, 10);
      sync();
    },
  });
  f.button('Resample', () => { seed++; sync(); }, { primary: true });
  f.button('Next image', () => {
    if (!set) return;
    pick = (pick + 1) % list.length;
    src.getContext('2d')!.putImageData(cifarImage(set, list[pick]), 0, 0);
    sync();
  });
  f.toggle({ label: 'flip', value: true, onChange: (v) => { flip = v; sync(); } });
  f.toggle({ label: 'crop + scale', value: true, onChange: (v) => { crop = v; sync(); } });
  f.slider({ label: 'max rotation', min: 0, max: 30, step: 1, value: 10, format: (v) => `${v}°`, onInput: (v) => { rot = v; f.code.set('rot', v); sync(); } });
  f.code.set('rot', 10);
  f.segmented({
    label: 'color',
    options: [
      { value: 'off', label: 'off' },
      { value: 'contrast', label: 'contrast' },
      { value: 'pca', label: 'PCA (AlexNet)' },
    ],
    value: 'pca',
    onChange: (v) => {
      cmode = v as typeof cmode;
      sync();
    },
  });
  f.slider({ label: 'color strength σ', min: 0, max: 1, step: 0.05, value: 0.5, format: (v) => fmt(v, 2), onInput: (v) => { sig = v; sync(); } });
  f.status('Loading CIFAR-10…');
  sync();
  loadCifar()
    .then(({ train }) => {
      set = train;
      list = [7, 3, 8, 1, 2, 4, 9, 0, 5, 6].map((c) => {
        for (let i = 0; i < train.n; i++) if (train.labels[i] === c) return i;
        return 0;
      });
      // RGB covariance over every pixel of every training image, values in 0..1
      const mean = [0, 0, 0];
      const S = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      const n = train.n * 1024;
      for (let i = 0; i < train.n; i++)
        for (let p = 0; p < 1024; p++) for (let k = 0; k < 3; k++) mean[k] += train.pixels[i * 3072 + k * 1024 + p] / 255 / n;
      for (let i = 0; i < train.n; i++)
        for (let p = 0; p < 1024; p++) {
          const v = [0, 1, 2].map((k) => train.pixels[i * 3072 + k * 1024 + p] / 255 - mean[k]);
          for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) S[a][b] += (v[a] * v[b]) / (n - 1);
        }
      const e = eig3(S);
      evals = e.vals;
      evecs = e.vecs;
      src.getContext('2d')!.putImageData(cifarImage(train, list[0]), 0, 0);
      const v1 = [0, 1, 2].map((r) => evecs[r][0].toFixed(2)).join(', ');
      f.status(`PCA of all 1,024,000 training pixels: eigenvalues λ = ${evals.map((x) => fmt(x, 2)).join(', ')}. The first direction, (${v1}), is almost equal parts red, green and blue: overall brightness. Tap any tile to see its random draws in the code.`);
      sync();
    })
    .catch((err) => f.status(`Could not load CIFAR-10: ${(err as Error).message}`));
}

// ---------------------------------------------------------------------------------------
// Fig: transfer-learning decision quadrant

function figTransfer(f: Fig): void {
  let logn = 3.5;
  let sim = 0.8;
  let cw = 0;
  let ch = 0;
  const LAYERS = ['conv1', 'conv2', 'conv3', 'conv4', 'conv5', 'fc6', 'fc7', 'fc8'];
  type St = 'frozen' | 'ft10' | 'ft100' | 'new' | 'cut';
  const plan = (): { st: St[]; name: string; k: number; layer: string } => {
    const small = logn < 4;
    const similar = sim >= 0.5;
    const st: St[] = LAYERS.map(() => 'frozen' as St);
    st[7] = 'new';
    if (small && similar) return { st, name: 'linear classifier on fc7 codes', k: 0, layer: 'fc7' };
    if (small) {
      st[4] = st[5] = st[6] = 'cut';
      return { st, name: 'linear classifier on conv4 features', k: 0, layer: 'conv4' };
    }
    let k = Math.max(1, Math.min(7, Math.round((logn - 4) * 2.4) + 1 + (similar ? 0 : 2)));
    if (logn >= 6.2) k = 7;
    for (let i = 0; i < k; i++) st[6 - i] = i < 2 ? 'ft10' : 'ft100';
    return { st, name: k >= 7 ? 'fine-tune every layer' : `fine-tune the top ${k} pretrained layer${k > 1 ? 's' : ''}`, k, layer: '' };
  };
  const geo = (w: number, h: number) => {
    const qx = 10;
    const qy = 26;
    const qw = w - 20;
    const qh = Math.min(h * 0.62, h - 156);
    return { qx, qy, qw, qh, X: (l: number) => qx + ((l - 2) / 5) * qw, Y: (s: number) => qy + (1 - s) * qh };
  };
  const cv = f.canvas(640, narrow() ? 720 : 560, (ctx, w, h) => {
    cw = w;
    ch = h;
    const g = geo(w, h);
    const pl = plan();
    const bx = g.X(4);
    const by = g.Y(0.5);
    const quads: [number, number, number, number, boolean, boolean, string[]][] = [
      [g.qx, g.qy, bx - g.qx, by - g.qy, true, true, ['linear classifier', 'on top-layer codes']],
      [bx, g.qy, g.qx + g.qw - bx, by - g.qy, false, true, ['fine-tune a few', 'top layers (or all)']],
      [g.qx, by, bx - g.qx, g.qy + g.qh - by, true, false, ['in trouble: try linear', 'classifiers on earlier', 'layers']],
      [bx, by, g.qx + g.qw - bx, g.qy + g.qh - by, false, false, ['fine-tune many', 'or all layers']],
    ];
    const small = logn < 4;
    const similar = sim >= 0.5;
    quads.forEach(([x, y, qw, qh, sm, si, lines]) => {
      const on = sm === small && si === similar;
      ctx.fillStyle = on ? withAlpha(color('--accent'), 0.14) : withAlpha(color('--ink'), 0.03);
      ctx.fillRect(x, y, qw, qh);
      lines.forEach((s, i) => txt(ctx, s, x + qw / 2, y + qh * 0.68 + (i - (lines.length - 1) / 2) * 15, { size: 11.5, align: 'center', base: 'middle', ink: on ? color('--ink') : color('--ink-3'), bold: on }));
    });
    ctx.strokeStyle = color('--rule');
    ctx.lineWidth = 1;
    ctx.strokeRect(g.qx, g.qy, g.qw, g.qh);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = color('--ink-3');
    ctx.beginPath();
    ctx.moveTo(bx, g.qy);
    ctx.lineTo(bx, g.qy + g.qh);
    ctx.moveTo(g.qx, by);
    ctx.lineTo(g.qx + g.qw, by);
    ctx.stroke();
    ctx.setLineDash([]);
    txt(ctx, 'similar to ImageNet ↑', g.qx + 4, g.qy - 8, { size: 11, ink: color('--ink-3') });
    txt(ctx, 'very different ↓', g.qx + g.qw, g.qy - 8, { size: 11, ink: color('--ink-3'), align: 'right' });
    ['100', '1K', '10K', '100K', '1M', '10M'].forEach((s, i) => {
      const x = g.X(2 + i);
      txt(ctx, s, Math.min(Math.max(x, g.qx + 10), g.qx + g.qw - 12), g.qy + g.qh + 14, { size: 11, align: 'center', ink: color('--ink-3'), font: 'mono' });
    });
    txt(ctx, 'images in your dataset →', g.qx + g.qw / 2, g.qy + g.qh + 29, { size: 11, align: 'center', ink: color('--ink-3') });
    // the dataset
    const dx = g.X(logn);
    const dy = g.Y(sim);
    ctx.beginPath();
    ctx.arc(dx, dy, 8, 0, Math.PI * 2);
    ctx.fillStyle = color('orange');
    ctx.fill();
    ctx.strokeStyle = color('--paper');
    ctx.lineWidth = 2;
    ctx.stroke();
    // the network strip
    const ny = g.qy + g.qh + 58;
    const gap = 4;
    const bw = (w - 20 - 7 * gap) / 8;
    const bh = Math.max(14, Math.min(30, h - ny - 40));
    const STC: Record<St, [string, string]> = {
      frozen: [color('slate'), '0'],
      ft100: [color('teal'), 'η/100'],
      ft10: [color('teal'), 'η/10'],
      new: [color('orange'), 'η'],
      cut: [color('--rule'), 'cut'],
    };
    txt(ctx, `AlexNet, layer by layer: ${pl.name}`, 10, ny - 7, { size: 12, ink: color('--ink'), bold: true });
    pl.st.forEach((s, i) => {
      const x = 10 + i * (bw + gap);
      const [col, lr] = STC[s];
      cell(ctx, x, ny, bw, bh, { fill: s === 'cut' ? 'transparent' : withAlpha(col, s === 'frozen' ? 0.18 : 0.32), stroke: col, lw: s === 'frozen' || s === 'cut' ? 1 : 2, dash: s === 'cut' ? [3, 3] : undefined });
      txt(ctx, i === 7 && s === 'new' && pl.layer === 'conv4' ? 'clf' : LAYERS[i], x + bw / 2, ny + bh / 2 + 0.5, { size: 11, align: 'center', base: 'middle', ink: s === 'cut' ? color('--ink-3') : color('--ink') });
      txt(ctx, lr, x + bw / 2, ny + bh + 14, { size: 11, align: 'center', font: 'mono', ink: s === 'frozen' || s === 'cut' ? color('--ink-3') : col });
    });
    txt(ctx, 'learning rate per layer: 0 = frozen, η = the new head’s rate', 10, ny + bh + 32, { size: 11, ink: color('--ink-3') });
  });
  const sync = () => {
    const pl = plan();
    const n = Math.round(10 ** logn);
    f.code.setMany({ n: n.toLocaleString('en-US').replace(/,/g, '_'), sim: fmt(sim, 2), layer: pl.layer || 'fc7', k: pl.k || 1 });
    f.code.highlight(logn < 4 ? ['head', 'small'] : ['head', 'big']);
    const msg = logn < 4
      ? sim >= 0.5
        ? 'Little data, similar images: freeze everything, compute 4,096-number CNN codes from fc7, and train only a linear classifier on them.'
        : 'Little data, very different images: the hard case. Top layers are too ImageNet-specific and fine-tuning would overfit, so try linear classifiers on earlier, more generic features (conv4 here) and compare.'
      : sim >= 0.5
        ? 'Enough data, similar images: replace the head and fine-tune the top layers with small learning rates; with more data, fine-tune deeper.'
        : 'Enough data, very different images: fine-tune many layers, or all of them. With a lot of data you could train from scratch, but starting from pretrained weights usually still helps.';
    f.status(msg);
    cv.redraw();
  };
  const nS = f.slider({ label: 'dataset size', min: 2, max: 7, step: 0.05, value: logn, map: (r) => r, format: (v) => count(Math.round(10 ** v)), onInput: (v) => { logn = v; sync(); } });
  const sS = f.slider({ label: 'similarity', min: 0, max: 1, step: 0.01, value: sim, format: (v) => fmt(v, 2), onInput: (v) => { sim = v; sync(); } });
  let drag = false;
  const move = (e: PointerEvent) => {
    const [x, y] = local(e, cv.canvas);
    const g = geo(cw, ch);
    logn = Math.max(2, Math.min(7, 2 + ((x - g.qx) / g.qw) * 5));
    sim = Math.max(0, Math.min(1, 1 - (y - g.qy) / g.qh));
    nS.set(logn, false);
    sS.set(sim, false);
    sync();
  };
  cv.canvas.addEventListener('pointerdown', (e) => {
    const [, y] = local(e, cv.canvas);
    const g = geo(cw, ch);
    if (y > g.qy + g.qh + 4) return;
    drag = true;
    cv.canvas.setPointerCapture(e.pointerId);
    move(e);
  });
  cv.canvas.addEventListener('pointermove', (e) => drag && move(e));
  cv.canvas.addEventListener('pointerup', () => (drag = false));
  sync();
}

// ---------------------------------------------------------------------------------------
// Fig: stacking convolutions: parameters and compute of five designs

interface Design {
  key: string;
  label: string;
  layers: [number, number, number, number][]; // [fh, fw, cin, cout] as fractions of C
}

const DESIGNS: Design[] = [
  { key: '7x7', label: 'one 7×7', layers: [[7, 7, 1, 1]] },
  { key: '3x3x3', label: 'three 3×3', layers: [[3, 3, 1, 1], [3, 3, 1, 1], [3, 3, 1, 1]] },
  { key: '3x3', label: 'one 3×3', layers: [[3, 3, 1, 1]] },
  { key: 'bottleneck', label: 'bottleneck', layers: [[1, 1, 1, 0.5], [3, 3, 0.5, 0.5], [1, 1, 0.5, 1]] },
  { key: '1x3', label: '1×3 then 3×1', layers: [[1, 3, 1, 1], [3, 1, 1, 1]] },
];

function figStack(f: Fig): void {
  let di = 3;
  let C = 256;
  let H = 28;
  const coef = (d: Design) => d.layers.reduce((a, [fh, fw, ci, co]) => a + fh * fw * ci * co, 0);
  const frac = (x: number) => (x === 1 ? 'C' : x === 0.5 ? 'C/2' : `${x}C`);
  const cv = f.canvas(640, narrow() ? 700 : 560, (ctx, w, h) => {
    const d = DESIGNS[di];
    // block diagram
    const rowH = Math.min(26, h / 22);
    let y = 18;
    txt(ctx, `${d.label}: input and output are H × W × C`, 6, y, { size: 12, bold: true, ink: color('--ink') });
    y += 12;
    const bw = Math.min(w - 12, 420);
    const bx = 6;
    const tensor = (s: string) => {
      txt(ctx, s, bx + 12, y + rowH * 0.62, { size: 11, font: 'mono', ink: color('orange') });
      y += rowH * 0.9;
    };
    tensor('H × W × C');
    d.layers.forEach(([fh, fw, ci, co], i) => {
      const c = fh * fw * ci * co;
      cell(ctx, bx, y, bw, rowH, { fill: withAlpha(color('blue'), 0.12), stroke: withAlpha(color('blue'), 0.6) });
      txt(ctx, `conv ${fh}×${fw}, ${frac(co)} filters (each ${fh}×${fw}×${frac(ci)})`, bx + 10, y + rowH / 2, { size: 11, base: 'middle', ink: color('--ink') });
      txt(ctx, `${fmt(c, 3)} C²`, bx + bw - 8, y + rowH / 2, { size: 11.5, base: 'middle', align: 'right', font: 'mono', ink: color('blue'), bold: true });
      y += rowH + 2;
      tensor(i === d.layers.length - 1 ? 'H × W × C' : `H × W × ${frac(co)}   + ReLU`);
    });
    // comparison bars
    y = Math.max(y + 14, h * 0.5);
    txt(ctx, 'weights, in units of C² (multiply-adds are H·W times these)', 6, y, { size: 11, ink: color('--ink-3') });
    y += 8;
    const rh = Math.min(34, (h - y - 6) / DESIGNS.length);
    const labW = Math.min(110, w * 0.3);
    const barMax = w - labW - 70;
    DESIGNS.forEach((dd, i) => {
      const yy = y + i * rh;
      const on = i === di;
      const c = coef(dd);
      if (on) {
        ctx.fillStyle = withAlpha(color('--accent'), 0.1);
        ctx.fillRect(0, yy + 2, w, rh - 4);
      }
      txt(ctx, dd.label, 6, yy + rh * 0.42, { size: 11.5, base: 'middle', ink: on ? color('--ink') : color('--ink-2'), bold: on });
      const relu = dd.layers.length;
      txt(ctx, `${relu} ReLU${relu > 1 ? 's' : ''}`, 6, yy + rh * 0.42 + 13, { size: 11, base: 'middle', ink: color('--ink-3') });
      const len = (c / 49) * barMax;
      ctx.fillStyle = withAlpha(color('blue'), on ? 0.75 : 0.35);
      ctx.fillRect(labW, yy + rh * 0.22, len, rh * 0.5);
      txt(ctx, `${fmt(c, 3)} C²`, labW + len + 6, yy + rh * 0.47, { size: 12, base: 'middle', font: 'mono', ink: on ? color('--ink') : color('--ink-2'), bold: on });
    });
  });
  cv.canvas.classList.add('scroll-ok');
  const roP = f.readout('weights');
  const roF = f.readout('multiply-adds');
  const roR = f.readout('vs one 3×3');
  const sync = () => {
    const d = DESIGNS[di];
    const c = coef(d);
    const params = c * C * C;
    roP.set(count(params));
    roF.set(count(params * H * H));
    roR.set(`${fmt(c / 9, 3)}×`);
    f.code.setMany({ d: d.key, C, H, p: count(params), fl: count(params * H * H) });
    f.code.highlight(['pick', 'sum']);
    cv.redraw();
  };
  f.segmented({
    label: 'design',
    options: DESIGNS.map((d, i) => ({ value: String(i), label: d.label })),
    value: '3',
    onChange: (v) => {
      di = Number(v);
      sync();
    },
  });
  f.slider({ label: 'channels C', sym: 'C', min: 5, max: 10, step: 1, value: 8, map: (r) => 2 ** Math.round(r), format: (v) => String(v), onInput: (v) => { C = v; sync(); } });
  f.slider({ label: 'size H', min: 7, max: 112, step: 7, value: 28, onInput: (v) => { H = v; sync(); } });
  sync();
}

// ---------------------------------------------------------------------------------------
// Fig: im2col, step by step

function figIm2col(f: Fig): void {
  const rng = new Rng(17);
  const X = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => rng.int(5)));
  const W = [0, 1].map(() => Array.from({ length: 9 }, () => rng.int(3) - 1));
  const pos: [number, number][] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) pos.push([i, j]);
  const col = (m: number) => {
    const [i, j] = pos[m];
    const out: number[] = [];
    for (let u = 0; u < 3; u++) for (let v = 0; v < 3; v++) out.push(X[i + u][j + v]);
    return out;
  };
  const res = W.map((wr) => pos.map((_, m) => col(m).reduce((a, x, r) => a + x * wr[r], 0)));
  let cur = 0;
  const cv = f.canvas(640, 600, (ctx, w, h) => {
    const c = Math.min((w - 14) / 18.8, (h - 62) / 15.5);
    const xL = Math.max(4, (w - 18.8 * c) / 2);
    const xC = xL + 9.6 * c;
    const yC = 22;
    const m = Math.min(cur, 8);
    const building = cur <= 8;
    // input
    const ic = c;
    txt(ctx, 'X (5×5)', xL, yC - 8, { size: 11.5, ink: color('orange'), bold: true });
    const [pi, pj] = pos[m];
    for (let r = 0; r < 5; r++)
      for (let q = 0; q < 5; q++) {
        const inW = building && r >= pi && r < pi + 3 && q >= pj && q < pj + 3;
        cell(ctx, xL + q * ic, yC + r * ic, ic, ic, { fill: withAlpha(color('orange'), inW ? 0.35 : 0.1), stroke: withAlpha(color('orange'), 0.5), text: String(X[r][q]), size: 11, radius: 3 });
      }
    if (building) frame(ctx, xL + pj * ic, yC + pi * ic, 3 * ic, 3 * ic, color('orange'), 2);
    // the two filters
    const fc = c * 0.9;
    const fx = xL + 5 * ic + 0.5 * c;
    for (let k = 0; k < 2; k++) {
      const fy = yC + k * (3 * fc + 0.9 * c) + 0.2 * c;
      txt(ctx, `W[${k}]`, fx, fy - 3, { size: 11, ink: color('blue') });
      for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) cell(ctx, fx + q * fc, fy + r * fc, fc, fc, { fill: withAlpha(color('blue'), cur === 9 ? 0.32 : 0.1), stroke: withAlpha(color('blue'), 0.5), text: String(W[k][r * 3 + q]), size: 11, radius: 3 });
    }
    // X_col
    txt(ctx, 'X_col (9×9)', xC, yC - 8, { size: 11.5, ink: color('orange'), bold: true });
    for (let mm = 0; mm < 9; mm++) {
      const filled = cur > 8 || mm <= m;
      const vals = col(mm);
      for (let r = 0; r < 9; r++) {
        const on = building && mm === m;
        const hot = cur === 10 && mm === 4;
        cell(ctx, xC + mm * c, yC + r * c, c, c, { fill: withAlpha(color('orange'), on || hot ? 0.35 : filled ? 0.12 : 0.02), stroke: withAlpha(color('orange'), filled ? 0.5 : 0.18), text: filled ? String(vals[r]) : '', size: 11, radius: 2 });
      }
    }
    // W_row and result
    const yR = yC + 9 * c + 0.7 * c;
    txt(ctx, 'W_row (2×9)', xL, yR - 4, { size: 11, ink: color('blue'), bold: true });
    for (let k = 0; k < 2; k++)
      for (let r = 0; r < 9; r++) {
        const on = cur === 9 || (cur === 10 && k === 0);
        cell(ctx, xL + r * c, yR + 4 + k * c, c, c, { fill: withAlpha(color('blue'), cur >= 9 ? (on ? 0.3 : 0.14) : 0.03), stroke: withAlpha(color('blue'), cur >= 9 ? 0.6 : 0.2), text: cur >= 9 ? String(W[k][r]) : '', size: 11, radius: 2 });
      }
    for (let k = 0; k < 2; k++)
      for (let mm = 0; mm < 9; mm++) {
        const hot = cur === 10 && k === 0 && mm === 4;
        cell(ctx, xC + mm * c, yR + 4 + k * c, c, c, { fill: withAlpha(color('purple'), hot ? 0.4 : cur >= 10 ? 0.16 : 0.03), stroke: withAlpha(color('purple'), cur >= 10 ? 0.7 : 0.2), lw: hot ? 2.5 : 1, text: cur >= 10 ? String(res[k][mm]) : '', size: 11, radius: 2 });
      }
    txt(ctx, 'out = W_row · X_col (2×9)', xC, yR + 4 + 2 * c + 14, { size: 11, ink: color('purple'), bold: true });
    // reshaped output
    const yO = yR + 4 + 2 * c + 40;
    const oc = Math.min(c * 1.15, (h - yO - 4) / 3);
    for (let k = 0; k < 2; k++) {
      const ox = xC + k * (3 * oc + c);
      txt(ctx, `A[${k}]`, ox, yO - 5, { size: 11, ink: color('purple'), bold: true });
      for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) cell(ctx, ox + q * oc, yO + r * oc, oc, oc, { fill: withAlpha(color('purple'), cur === 11 ? 0.2 : 0.03), stroke: withAlpha(color('purple'), cur === 11 ? 0.7 : 0.2), text: cur === 11 ? String(res[k][r * 3 + q]) : '', size: 11, radius: 3 });
    }
  });
  cv.canvas.classList.add('scroll-ok');
  f.stepper({
    steps: 12,
    interval: 1000,
    label: (k) => (k <= 8 ? `column ${k + 1} / 9` : k === 9 ? 'filters → rows' : k === 10 ? 'one matrix multiply' : 'reshape'),
    onStep: (k) => {
      cur = k;
      const [pi, pj] = pos[Math.min(k, 8)];
      f.status(k <= 8 ? `Column ${k}: the 3 × 3 patch whose corner is at (${pi}, ${pj}), read row by row.` : k === 9 ? 'Each 3 × 3 filter is stretched into a row of `W_row`.' : k === 10 ? `One matrix product fills all 18 outputs. For example out[0, 4] = W_row[0] · X_col[:, 4] = ${res[0][4]}, the dot product of filter 0 with the center patch.` : 'Reshape: each row of `out` is one 3 × 3 activation map.');
      f.code.set('m', Math.min(k, 8));
      f.code.highlight(k <= 8 ? ['patch', 'col'] : k === 9 ? 'wrow' : k === 10 ? 'mm' : 'reshape');
      cv.redraw();
    },
  });
  f.readout('X_col size vs X').set('81 vs 25 numbers (3.2×)');
}

// ---------------------------------------------------------------------------------------
// Fig: Winograd F(2, 3)

function figWinograd(f: Fig): void {
  let d = [2, -1, 3, 1];
  let g = [1, 2, -1];
  let cur = 0;
  let seed = 5;
  const pv = (v: number) => (v < 0 ? `(${fmt(v, 3)})` : fmt(v, 3));
  const compute = () => {
    const G = [g[0], (g[0] + g[1] + g[2]) / 2, (g[0] - g[1] + g[2]) / 2, g[2]];
    const m = [(d[0] - d[2]) * G[0], (d[1] + d[2]) * G[1], (d[2] - d[1]) * G[2], (d[1] - d[3]) * G[3]];
    const yd = [d[0] * g[0] + d[1] * g[1] + d[2] * g[2], d[1] * g[0] + d[2] * g[1] + d[3] * g[2]];
    return { G, m, yd, yw: [m[0] + m[1] + m[2], m[1] - m[2] - m[3]] };
  };
  const STEPS = ['d0', 'd1', 'G', 'm1', 'm2', 'm3', 'm4', 'yw'];
  const cv = f.canvas(640, narrow() ? 640 : 520, (ctx, w, h) => {
    const r = compute();
    const c = Math.min(40, w / 11);
    txt(ctx, 'd (inputs)', 6, 14, { size: 11.5, ink: color('orange'), bold: true });
    d.forEach((v, i) => cell(ctx, 6 + i * c, 20, c, c * 0.8, { fill: withAlpha(color('orange'), 0.14), stroke: withAlpha(color('orange'), 0.6), text: String(v), size: 12 }));
    const gx = 6 + 4 * c + c * 0.7;
    txt(ctx, 'g (filter)', gx, 14, { size: 11.5, ink: color('blue'), bold: true });
    g.forEach((v, i) => cell(ctx, gx + i * c, 20, c, c * 0.8, { fill: withAlpha(color('blue'), 0.14), stroke: withAlpha(color('blue'), 0.6), text: String(v), size: 12 }));
    const lines: { s: string; step: number; head?: boolean }[] = [
      { s: 'direct: 3 multiplies per output', step: -1, head: true },
      { s: `y0 = ${d[0]}·${pv(g[0])} + ${pv(d[1])}·${pv(g[1])} + ${pv(d[2])}·${pv(g[2])} = ${r.yd[0]}`, step: 0 },
      { s: `y1 = ${pv(d[1])}·${pv(g[0])} + ${pv(d[2])}·${pv(g[1])} + ${pv(d[3])}·${pv(g[2])} = ${r.yd[1]}`, step: 1 },
      { s: 'Winograd F(2,3): 4 multiplies for both', step: -1, head: true },
      { s: `G = [${r.G.map((v) => fmt(v, 3)).join(', ')}]  (once per filter)`, step: 2 },
      { s: `m1 = (d0 − d2)·G0 = ${pv(d[0] - d[2])}·${pv(r.G[0])} = ${fmt(r.m[0], 3)}`, step: 3 },
      { s: `m2 = (d1 + d2)·G1 = ${pv(d[1] + d[2])}·${pv(r.G[1])} = ${fmt(r.m[1], 3)}`, step: 4 },
      { s: `m3 = (d2 − d1)·G2 = ${pv(d[2] - d[1])}·${pv(r.G[2])} = ${fmt(r.m[2], 3)}`, step: 5 },
      { s: `m4 = (d1 − d3)·G3 = ${pv(d[1] - d[3])}·${pv(r.G[3])} = ${fmt(r.m[3], 3)}`, step: 6 },
      { s: `y0 = m1 + m2 + m3 = ${fmt(r.yw[0], 3)}`, step: 7 },
      { s: `y1 = m2 − m3 − m4 = ${fmt(r.yw[1], 3)}`, step: 7 },
    ];
    const lh = Math.min(26, (h - 20 - c - 50) / lines.length);
    const fs = Math.max(11, Math.min(13, (w - 20) / 40));
    let y = 20 + c * 0.8 + 22;
    lines.forEach((L) => {
      if (L.head) y += 4;
      const on = L.step === cur;
      const seen = L.step <= cur;
      if (on) {
        ctx.fillStyle = withAlpha(color('--accent'), 0.13);
        ctx.fillRect(0, y - lh * 0.66, w, lh * 0.95);
      }
      if (L.head) txt(ctx, L.s, 6, y, { size: 12, bold: true, ink: color('--ink') });
      else txt(ctx, L.s, 14, y, { size: fs, font: 'mono', ink: seen ? color('--ink') : color('--ink-3') });
      y += lh;
    });
    const nd = cur >= 1 ? 6 : cur === 0 ? 3 : 0;
    const nw = Math.max(0, Math.min(4, cur - 2));
    ctx.font = mono(12, 600);
    txt(ctx, `multiplies so far: direct ${nd} of 6, Winograd ${nw} of 4`, 6, h - 8, { size: 12, ink: color('purple'), bold: true });
  });
  cv.canvas.classList.add('scroll-ok');
  f.stepper({
    steps: STEPS.length,
    interval: 1200,
    label: (k) => `step ${k + 1} / ${STEPS.length}`,
    onStep: (k) => {
      cur = k;
      const r = compute();
      f.code.setMany({ d: d.join(', '), g: g.join(', '), y: `[${r.yw.map((v) => fmt(v, 3)).join(', ')}]` });
      f.code.highlight(STEPS[k]);
      cv.redraw();
    },
  });
  f.button('New numbers', () => {
    const r = new Rng(seed++);
    d = [0, 1, 2, 3].map(() => r.int(7) - 3);
    g = [0, 1, 2].map(() => r.int(5) - 2);
    const rr = compute();
    f.code.setMany({ d: d.join(', '), g: g.join(', '), y: `[${rr.yw.map((v) => fmt(v, 3)).join(', ')}]` });
    cv.redraw();
  });
}

// ---------------------------------------------------------------------------------------
// Fig: stochastic rounding keeps tiny updates alive in float16

function figRounding(f: Fig): void {
  let step = 1e-4;
  const T = 400;
  let w32: number[] = [];
  let wn: number[] = [];
  let ws: number[] = [];
  let seed = 3;
  let rng = new Rng(seed);
  let t = 0;
  const reset = () => {
    w32 = [1];
    wn = [1];
    ws = [1];
    t = 0;
    rng = new Rng(seed);
  };
  const advance = (n: number) => {
    for (let k = 0; k < n && t < T; k++, t++) {
      w32.push(Math.fround(w32[t] - step));
      wn.push(round16(wn[t] - step));
      ws.push(roundStoch16(ws[t] - step, rng.next()));
    }
  };
  const pl = f.plot({
    aspect: 1.5,
    square: false,
    domain: [0, T, 0.9, 1.01],
    draw: (p) => {
      const lo = Math.min(1 - T * step * 1.25, ...ws, ...wn);
      const hi = 1 + Math.max(T * step * 0.12, 0.002);
      p.setDomain(-T * 0.02, T * 1.02, lo, hi);
      const [, , y0, y1] = p.view();
      const ctx = p.ctx;
      ctx.strokeStyle = color('--grid');
      ctx.lineWidth = 1;
      const nice = (r: number) => {
        const e = 10 ** Math.floor(Math.log10(r));
        return r / e < 2 ? e : r / e < 5 ? 2 * e : 5 * e;
      };
      const gs = nice((y1 - y0) / 5);
      for (let v = Math.ceil(y0 / gs) * gs; v <= y1; v += gs) {
        ctx.beginPath();
        ctx.moveTo(0, p.sy(v));
        ctx.lineTo(p.w, p.sy(v));
        ctx.stroke();
        p.text(v.toFixed(Math.max(0, -Math.floor(Math.log10(gs)))), 4, v, { size: 11, mono: true, color: color('--ink-3'), base: 'bottom' });
      }
      const xs = (a: number[]) => a.map((_, i) => i);
      p.path(xs(w32), w32, color('--ink-2'), 2, [6, 4]);
      p.path(xs(wn), wn, color('red'), 2.2);
      p.path(xs(ws), ws, color('teal'), 1.6);
      const lab = (s: string, col: string, k: number) => p.text(s, T * 0.17, y0 + (y1 - y0) * (0.25 - k * 0.075), { size: 11.5, color: col, bold: true });
      lab('float32 (reference)', color('--ink-2'), 0);
      lab('float16, round to nearest', color('red'), 1);
      lab('float16, stochastic rounding', color('teal'), 2);
      p.text(`step ${t} / ${T}`, T * 0.98, y0 + (y1 - y0) * 0.04, { size: 11, color: color('--ink-3'), mono: true, align: 'right' });
    },
  });
  pl.canvas.classList.add('scroll-ok');
  const r32 = f.readout('float32');
  const rn = f.readout('nearest');
  const rs = f.readout('stochastic');
  const sync = () => {
    r32.set(fmt(w32[t], 5));
    rn.set(fmt(wn[t], 5));
    rs.set(fmt(ws[t], 5));
    f.code.setMany({ t, w32: fmt(w32[t], 5), wn: fmt(wn[t], 5), ws: fmt(ws[t], 5) });
    pl.redraw();
  };
  let phase = 0;
  const loop = f.loop(() => {
    advance(4);
    f.code.highlight(['ref', 'near', 'stoch'][phase++ % 3]);
    sync();
    if (t >= T) {
      f.code.highlight(null);
      runBtn.textContent = 'Run again';
      return false;
    }
  });
  f.slider({
    label: 'update size',
    min: -5,
    max: -3,
    step: 0.05,
    value: -4,
    map: (r) => 10 ** r,
    format: (v) => v.toExponential(1),
    slot: 'step',
    onInput: (v) => {
      step = v;
      reset();
      advance(T);
      sync();
    },
  });
  const runBtn = f.button('Run', () => {
    seed++;
    reset();
    sync();
    loop.start();
    runBtn.textContent = 'Running…';
  }, { primary: true });
  reset();
  advance(T);
  sync();
}

// ---------------------------------------------------------------------------------------

const chapter: ChapterDef = {
  symbols: CONVNETS_PRACTICE_SYMBOLS,

  render(p) {
    p.prose(`
[Chapter 11](#/convnets) described what a ConvNet *is*. This chapter is about making one work on a real problem with a real budget. It follows two 2016 lectures, "CNNs in practice" and "software packages", and answers four practical questions:

1. You never have enough labeled images. How do you stretch the ones you have? (**data augmentation**)
2. How do you reuse a network that someone else trained on a million images? (**transfer learning**)
3. Which convolutions should you stack, and how does a computer actually compute them fast? (**all about convolutions**)
4. What hardware and software does it all run on? (**implementation details** and **deep learning frameworks**)`);

    // -------------------------------------------------------------------------------
    p.h2('Data augmentation', 'augmentation');
    p.prose(`
A ConvNet with millions of parameters can memorize a few thousand images. One of the cheapest and most effective defenses is to change the training images in ways that do not change their labels. A cat flipped left-to-right is still a cat. A cat photographed a little closer, or under warmer light, is still a cat.

So instead of feeding the network the same pixels every epoch, the training loop transforms each image at random every time it loads it: **load an image and its label, transform the image, compute the loss** as usual. Nothing else changes. The network sees a slightly different picture every time, and the only thing that stays constant, the cat, is what it has to learn. This is used almost everywhere.

### 1. Horizontal flips

Mirror the image left-to-right with probability one half. In NumPy that is \`img[:, ::-1]\` (reverse the column order). Vertical flips are usually a bad idea, because the world has an up and a down; and for text or digits even horizontal flips change the meaning.

### 2. Random crops and scales

Cut a random window out of a randomly resized image, so the network learns to recognize objects at different sizes and positions. ResNet's recipe for ImageNet was:

1. pick a random length $L$ between 256 and 480,
2. resize the training image so its shorter side is $L$,
3. cut out a random 224 × 224 patch.

At test time there is no randomness. Instead, average the predictions over a fixed set of crops. ResNet resized each test image to five scales (224, 256, 384, 480 and 640 pixels) and at each scale took ten 224 × 224 crops: the four corners and the center, plus the mirror image of each.

### 3. Color jitter

The simplest version randomly scales the contrast. A more careful version, used by AlexNet (and later ResNet), shifts the colors along the directions in which colors naturally vary across the whole dataset. You find those directions with *principal component analysis* (PCA) of all the RGB pixel values in the training set:`);
    p.math({
      label: 'PCA color augmentation (AlexNet)',
      tex: String.raw`\begin{gathered}\symX'_{xy} = \symX_{xy} + \big[\,\mathbf{p}_1\;\, \mathbf{p}_2\;\, \mathbf{p}_3\,\big] \begin{bmatrix} \alpha_1 \lambda_1 \\ \alpha_2 \lambda_2 \\ \alpha_3 \lambda_3 \end{bmatrix} \\ \alpha_i \sim \mathcal{N}(0,\, 0.1^2)\end{gathered}`,
      code: `
        pix = X_train.reshape(-1, 3)        # every pixel's RGB
        cov = np.cov(pix, rowvar=False)     # a 3x3 covariance
        evals, evecs = np.linalg.eigh(cov)  # lambda_i; p_i as columns
        alpha = np.random.normal(0, 0.1, 3) # fresh for every image
        img = img + evecs.dot(alpha * evals)  # same shift, all pixels
      `,
      terms: [
        [String.raw`\symX_{xy}`, 'the RGB color of one pixel, three numbers'],
        [String.raw`\mathbf{p}_i`, 'the principal directions of color in the dataset: the three directions in RGB space along which pixel colors vary independently, most first'],
        [String.raw`\lambda_i`, 'how much the colors vary along direction $i$ (an *eigenvalue* of the covariance matrix)'],
        [String.raw`\alpha_i \sim \mathcal{N}(0, 0.1^2)`, 'a random number from a bell curve centered at 0 with spread 0.1, drawn once per image each time it is used'],
        [String.raw`[\mathbf{p}_1\,\mathbf{p}_2\,\mathbf{p}_3]\,[\dots]`, 'add up the three directions, each scaled by its random amount: one color offset'],
      ],
      explain: 'The covariance matrix records how the red, green and blue values of pixels vary together across the dataset; its eigenvectors are the natural axes of that variation. For natural photos the first axis is close to "equal parts R, G and B", in other words brightness; the others trade colors against each other. Every pixel of the image gets the same small offset along these axes, so the image looks like the same scene under slightly different lighting, the kind of change that should never alter the label.',
    });
    p.figure({
      title: 'Data augmentation on CIFAR-10',
      layout: 'side',
      codeTitle: 'augment.py',
      code: `
        img = X_train[{{idx:0}}] / 255.0      # 32x32x3, in 0..1
        rng = np.random.RandomState({{seed:1}})

        def augment(img):
            if {{flip:True}} and rng.rand() < 0.5:   # {{fl}}
                img = img[:, ::-1]                    #@flip
            if {{crop:True}}:
                s = rng.uniform(1.0, 1.3)         # {{s}}
                big = resize(img, round(32 * s))      #@crop
                y0, x0 = rng.randint(0, len(big) - 31, 2)
                img = big[y0:y0+32, x0:x0+32]  # {{y0}}, {{x0}}  #@crop
            a = rng.uniform(-{{rot}}, {{rot}})    # {{ang}}
            img = rotate(img, a)                      #@rot
            if '{{cm:pca}}' == 'contrast':
                c = rng.uniform(1 - {{sig}}, 1 + {{sig}})  # {{c}}
                img = (img - img.mean()) * c + img.mean()  #@contrast
            elif '{{cm}}' == 'pca':
                alpha = rng.normal(0, {{sig}}, 3)
                img = img + evecs.dot(alpha * evals)       #@pca
                # alpha = {{al}}
            return np.clip(img, 0, 1)

        batch = [augment(img) for _ in range(11)]     #@batch

        def ten_crops(img, c=28):   # corners + center, + flips
            m = 32 - c
            offs = [(0,0), (0,m), (m,0), (m,m), (m//2,m//2)]
            crops = [img[y:y+c, x:x+c] for y, x in offs]  #@crops
            return crops + [cr[:, ::-1] for cr in crops]   #@crops
        probs = np.mean([net(c) for c in ten_crops(img)], 0)  #@test
      `,
      setup: figAugment,
      caption: `The top-left tile is the original; the other eleven are what one training loop might feed the network over eleven epochs. Each label lists that tile's random draws (flip, zoom factor, rotation); **tap a tile** to see its numbers in the code and its crop window drawn on the original. Turn the toggles off one at a time to see what each contributes, and press **Resample** for a new batch. The **test** phase shows the fixed ten crops whose predictions are averaged instead. AlexNet drew the PCA amounts with spread 0.1; the strength slider lets you exaggerate them to see the direction of the shift clearly. On 32-pixel images the crops are scaled down accordingly: zooms up to 1.3× with 32 × 32 windows for training, 28 × 28 crops for testing.`,
    });
    p.prose(`
### 4. Get creative

Anything that changes the pixels but not the label is fair game: small translations, rotations, stretching, shearing, lens distortions, and random combinations of all of them. What makes sense depends on the data: rotating satellite images by any angle is harmless, but rotating a 6 by 180 degrees turns it into a 9.

### The general theme: add noise, then average it out

Data augmentation is one example of a pattern that runs through this whole course: **during training, add random noise; at test time, average the noise away** (*marginalize* over it, in the statistics vocabulary). Dropout randomly zeroes activations during training and uses the expected value at test time; DropConnect does the same to weights; batch normalization normalizes with noisy mini-batch statistics during training and fixed averages at test time; a model ensemble averages several differently initialized networks. Augmentation puts the noise in the input, and test-time cropping averages over it:`);
    p.math({
      label: 'Averaging over fixed views at test time',
      tex: String.raw`\symp(y \mid \symX) \;\approx\; \frac{1}{M} \sum_{m=1}^{M} \symp\big(y \mid T_m(\symX)\big)`,
      code: `
        views = ten_crops(img)                # M = 10 fixed transforms
        probs = np.mean([net(v) for v in views], axis=0)
        label = probs.argmax()                # the averaged vote
      `,
      terms: [
        [String.raw`T_m(\symX)`, 'the image after the $m$-th fixed transformation: one particular crop, maybe flipped'],
        [String.raw`\symp(y \mid T_m(\symX))`, 'the class probabilities the network gives that view'],
        [String.raw`\frac{1}{M}\sum_{m=1}^{M}`, 'the average over all $M$ views'],
      ],
      explain: 'The vertical bar is read "given": $p(y \\mid X)$ is the probability of class $y$ given image $X$. During training the network learned to handle random crops and flips, so at test time we show it several of them and average the answers, which smooths out the luck of any single crop. It costs $M$ forward passes per image, so it is used when accuracy matters more than speed.',
    });
    p.callout('idea', `Data augmentation is simple to implement, so use it. It helps most when the dataset is small, and it fits the general recipe of adding noise during training and averaging it out at test time.`, 'In short');

    // -------------------------------------------------------------------------------
    p.h2('Transfer learning', 'transfer');
    p.prose(`
The other half of making the most of your data is **not starting from scratch**. A common belief is that you need a huge dataset to use ConvNets at all. For most applications that is not true, because the features a ConvNet learns on ImageNet (1.2 million images in 1,000 classes) turn out to be useful for almost any visual task. In practice very few people train a whole ConvNet from random initialization. They take a network pretrained on ImageNet and use it in one of two ways.

### The ConvNet as a fixed feature extractor

Take a pretrained network, remove its last fully-connected layer (the one that outputs the 1,000 ImageNet class scores), and treat the rest as a fixed function from images to vectors. For AlexNet this gives a 4,096-number vector per image: the activations of the last hidden layer, just before the classifier. These vectors are called **CNN codes**. Keep them *after* the ReLU (thresholded at zero), the way the network saw them during its own training. Then train a linear classifier (an SVM or softmax, as in [Chapter 4](#/linear-classification)) on the codes of your new dataset.

This simple recipe is remarkably strong. *DeCAF* (Donahue et al., 2013, a Python-based precursor of Caffe) and *CNN Features off-the-shelf: an Astounding Baseline for Recognition* (Razavian et al., 2014) showed that linear classifiers on ImageNet CNN codes matched or beat carefully engineered systems on a wide range of recognition tasks.

### Fine-tuning

Go one step further: replace the classifier, and also keep training the pretrained weights on the new data with backpropagation. You can fine-tune every layer, or freeze the early ones and fine-tune only the top. Freezing early layers makes sense because they hold the most generic features (edge and color-blob detectors that any image task can use), while later layers grow more and more specific to the original classes. ImageNet contains many dog breeds, for example, so a good share of a pretrained network's top layers is devoted to telling dogs apart. (*How transferable are features in deep neural networks?*, Yosinski et al., 2014, studies this layer by layer.)

### Pretrained models

Training a modern ConvNet on ImageNet took 2 to 3 weeks on several GPUs in 2016, so people release their final weights for others to use. Caffe's **Model Zoo** had AlexNet, VGG, GoogLeNet, ResNet and many more ready to download, and the other frameworks could load them.

### Which strategy, when?

Two things matter most: **how much data** you have, and **how similar** it is to ImageNet (photos of everyday objects, as opposed to, say, microscope slides or X-rays).`);
    p.figure({
      title: 'Choosing a transfer-learning strategy',
      codeTitle: 'transfer.py (sketch)',
      code: `
        net = load_pretrained('alexnet')     # ImageNet weights
        n, sim = {{n:3_162}}, {{sim:0.8}}        # your dataset
        net.fc8 = new_linear(4096, n_classes)   # fresh head  #@head
        if n < 10_000:                       # too little to fine-tune
            layer = '{{layer:fc7}}'          # top if similar  #@small
            codes = net.features(X, upto=layer)            #@small
            clf = train_linear(codes, y)     # SVM / softmax #@small
        else:                                # fine-tune the top k
            k = {{k:1}}                                       #@big
            for i, layer in enumerate(net.top_down()):
                layer.lr = (0 if i >= k else           # frozen
                            base_lr / 10 if i < 2 else
                            base_lr / 100)                   #@big
            train(net, X, y, lr=base_lr)                     #@big
      `,
      setup: figTransfer,
      caption: `**Drag the dot** (or use the sliders) to describe your dataset. The quadrant follows the 2016 lecture's table; the strip below shows what happens to each layer of a pretrained AlexNet: frozen layers (learning rate 0), fine-tuned layers (teal, with a reduced rate), the new head (orange), and layers that are cut off. Where exactly "little data" ends is a judgment call; here the line is drawn at 10,000 images. Within the right half, more data means fine-tuning deeper into the network, and dissimilar data means going deeper sooner. The code is a sketch: the helper names are made up, the structure is the real recipe.`,
    });
    p.prose(`
Reading the four corners:

- **Little data, similar images**: fine-tuning would overfit, but the top-layer features are relevant. Train a linear classifier on the CNN codes.
- **Lots of data, similar images**: there is enough data to fine-tune without overfitting. Fine-tune the top few layers, or the whole network.
- **Little data, very different images**: the hard case. Fine-tuning would overfit, and the top layers are too specific to ImageNet. Try linear classifiers on features from earlier, more generic layers.
- **Lots of data, very different images**: fine-tune a large part of the network, or all of it. With enough data you could train from scratch, but initializing from pretrained weights usually still helps.

### Practical advice

**Constraints from the pretrained model.** You inherit its architecture: you cannot freely remove CONV layers from the middle. Some changes are easy, though. Thanks to parameter sharing, a pretrained network runs on images of a different size (as long as the strides still fit), and its FC layers can be rewritten as CONV layers, as in [Chapter 11](#/convnets/norm-fc).

**Smaller learning rates for pretrained weights.** The pretrained weights are already good; you do not want to wreck them in the first few updates, while the new classifier on top is still random and producing large, noisy gradients. So pretrained layers get a much smaller learning rate than the new head:`);
    p.math({
      label: 'Fine-tuning with a learning rate per layer',
      tex: String.raw`\begin{gathered}\symW_\ell \;\leftarrow\; \symW_\ell - \symlr_\ell\, \frac{\partial \symL}{\partial \symW_\ell} \\[4pt] \symlr_\ell = \begin{cases} \symlr & \text{the new head} \\ \symlr / 10 & \text{top pretrained layers} \\ \symlr / 100 & \text{middle layers} \\ 0 & \text{frozen layers} \end{cases}\end{gathered}`,
      code: `
        for layer in net.layers:
            dW = layer.grad                  # from backpropagation
            layer.W -= layer.lr_mult * base_lr * dW
        # lr_mult: 1 for the new head, 0.1 or 0.01 for
        # fine-tuned layers, 0 for frozen ones
      `,
      terms: [
        [String.raw`\symW_\ell`, 'the weights of layer $\\ell$'],
        [String.raw`\frac{\partial \symL}{\partial \symW_\ell}`, 'the gradient: how the loss changes as each weight of that layer changes (Chapter 5)'],
        [String.raw`\symlr_\ell`, 'a learning rate chosen per layer'],
        [String.raw`0`, 'a learning rate of zero means the layer never changes: it is frozen'],
      ],
      explain: 'This is the usual gradient-descent step, just with a different step size for each layer. Here $\\eta$ is the learning rate you would use to train from scratch, and the fresh head gets all of it. The tenth and hundredth for pretrained layers are a rule of thumb from the 2016 lecture, not exact values. Caffe makes it a one-line change: every layer has a learning-rate multiplier in its definition, and setting it to 0 freezes the layer.',
    });
    p.prose(`
Transfer learning is the norm, not the exception. Object detectors such as Faster R-CNN ([Chapter 14](#/detection)) start from an ImageNet ConvNet, and image captioning systems ([Chapter 15](#/rnn)) pair a pretrained ConvNet with word vectors pretrained on text. The lecture's advice for projects: if your dataset has fewer than about a million images, find a large dataset of similar data, train (or download) a big ConvNet on it, and transfer to yours.`);

    // -------------------------------------------------------------------------------
    p.h2('How to stack convolutions', 'stacking');
    p.prose(`
[Chapter 11](#/convnets/architectures) argued for stacks of small 3 × 3 filters because they need fewer weights and add more nonlinearity than one large filter. The same holds for computation. Take an $H \\times W \\times \\symC$ input and convolutions with $\\symC$ filters, stride 1 and same padding, so that every volume stays $H \\times W \\times \\symC$. Each output number of a layer costs one multiply-add per filter weight, and there are $H \\cdot W \\cdot \\symC$ output numbers:`);
    p.math({
      label: 'Compute: one 7 × 7 layer versus three 3 × 3 layers',
      tex: String.raw`\begin{gathered}\underbrace{(H W \symC) \cdot (7 \cdot 7 \cdot \symC)}_{\text{one 7×7 layer}} = 49\,HW\symC^2 \\ \text{vs} \quad \underbrace{3\,(H W \symC) \cdot (3 \cdot 3 \cdot \symC)}_{\text{three 3×3 layers}} = 27\,HW\symC^2\end{gathered}`,
      code: `
        H = W = 56; C = 256
        one_7x7 = (H * W * C) * (7 * 7 * C)        # 7.87e9
        three_3x3 = 3 * (H * W * C) * (3 * 3 * C)  # 4.34e9
        three_3x3 / one_7x7                        # 27/49 = 0.55
      `,
      terms: [
        [String.raw`H W \symC`, 'how many numbers each layer outputs'],
        [String.raw`7 \cdot 7 \cdot \symC`, 'how many multiply-adds each of them costs: one per weight of its 7 × 7 × C filter'],
        [String.raw`3\,(\dots)`, 'three smaller layers, each costing $3 \\cdot 3 \\cdot C$ per output number'],
      ],
      explain: 'Both designs see a 7 × 7 region of the input, but the stack of three needs about 45% fewer multiply-adds (and, as Chapter 11 showed, 45% fewer weights) while applying three ReLUs instead of one. Fewer parameters, less compute, more nonlinearity: the lecture called that GOOD in capital letters.',
    });
    p.prose(`
### Why stop at 3 × 3? The 1 × 1 bottleneck

A 1 × 1 convolution mixes the channels at each pixel and nothing else, which makes it a cheap way to change depth. The **bottleneck sandwich** squeezes the channels down to $\\symC/2$ with a 1 × 1 convolution, does the expensive 3 × 3 work at the reduced depth, then expands back to $\\symC$ with another 1 × 1:`);
    p.math({
      label: 'The bottleneck sandwich',
      tex: String.raw`\begin{gathered}\underbrace{\symC \cdot \tfrac{\symC}{2}}_{\text{squeeze}} + \underbrace{9 \cdot \tfrac{\symC}{2} \cdot \tfrac{\symC}{2}}_{3\times3 \text{ at } \symC/2} + \underbrace{\tfrac{\symC}{2} \cdot \symC}_{\text{expand}} \\ = 3.25\,\symC^2 \quad\text{vs}\quad 9\,\symC^2 \text{ for one } 3\times3\end{gathered}`,
      code: `
        C = 256
        squeeze = 1 * 1 * C * (C // 2)          # 0.5 C^2
        middle = 3 * 3 * (C // 2) * (C // 2)    # 2.25 C^2
        expand = 1 * 1 * (C // 2) * C           # 0.5 C^2
        (squeeze + middle + expand) / C**2      # 3.25
        (3 * 3 * C * C) / C**2                  # 9: a plain 3x3
      `,
      terms: [
        [String.raw`\symC \cdot \tfrac{\symC}{2}`, '$C/2$ filters of size 1 × 1 × $C$'],
        [String.raw`9 \cdot \tfrac{\symC}{2} \cdot \tfrac{\symC}{2}`, '$C/2$ filters of size 3 × 3 × $C/2$: the 3 × 3 work happens at half depth'],
        [String.raw`\tfrac{\symC}{2} \cdot \symC`, '$C$ filters of size 1 × 1 × $C/2$, restoring the depth'],
      ],
      explain: 'Halving the depth before the 3 × 3 layer cuts its cost by four (both its input and output channels are halved), and the two 1 × 1 layers around it are cheap. Same input and output shape as a single 3 × 3 layer, about a third of the weights and compute, and three nonlinearities instead of one. The shape appears in *Network in Network*, GoogLeNet and ResNet.',
    });
    p.prose(`
### Splitting a 3 × 3 into 1 × 3 and 3 × 1

Even a 3 × 3 filter can be broken up: a 1 × 3 convolution followed by a 3 × 1 convolution still covers a 3 × 3 region.`);
    p.math({
      label: 'Factoring N × N into 1 × N and N × 1',
      tex: String.raw`\begin{gathered}\underbrace{1 \cdot 3 \cdot \symC \cdot \symC}_{1\times3} + \underbrace{3 \cdot 1 \cdot \symC \cdot \symC}_{3\times1} = 6\,\symC^2 \\ \text{vs} \quad 3 \cdot 3 \cdot \symC \cdot \symC = 9\,\symC^2\end{gathered}`,
      code: `
        N = 3
        factored = (1 * N + N * 1) * C * C     # 2N C^2 = 6 C^2
        full = N * N * C * C                   # N^2 C^2 = 9 C^2
        # the saving grows with N: N = 7 gives 14 vs 49
      `,
      terms: [
        [String.raw`1 \cdot 3 \cdot \symC \cdot \symC`, '$C$ filters, each one pixel tall and three wide, through all $C$ channels'],
        [String.raw`3 \cdot 1 \cdot \symC \cdot \symC`, 'then $C$ filters three tall and one wide'],
      ],
      explain: 'In general the factored pair costs $2N$ per channel pair instead of $N^2$, so the bigger the filter, the bigger the saving. The latest GoogLeNet at the time (*Rethinking the Inception Architecture for Computer Vision*, Szegedy et al.) used all three of these ideas.',
    });
    p.figure({
      title: 'Five ways to cover the same region',
      codeTitle: 'conv_cost.py',
      code: `
        C, H = {{C:256}}, {{H:28}}      # channels; height = width

        def cost(fh, fw, c_in, c_out):
            weights = fh * fw * c_in * c_out    # no biases
            return weights, H * H * weights     # multiply-adds

        designs = {
            '7x7': [(7, 7, C, C)],
            '3x3x3': [(3, 3, C, C)] * 3,
            '3x3': [(3, 3, C, C)],
            'bottleneck': [(1, 1, C, C // 2),
                           (3, 3, C // 2, C // 2),
                           (1, 1, C // 2, C)],
            '1x3': [(1, 3, C, C), (3, 1, C, C)],
        }
        layers = designs['{{d:bottleneck}}']              #@pick
        weights = sum(cost(*l)[0] for l in layers)  # {{p}}  #@sum
        flops = sum(cost(*l)[1] for l in layers)    # {{fl}} #@sum
      `,
      setup: figStack,
      caption: `Pick a design to see its layers, each with its weight count in units of $\\symC^2$, and compare all five in the bars. Every design maps $H \\times W \\times \\symC$ to $H \\times W \\times \\symC$; the ReLU count is the number of layers. Raise $\\symC$ and watch the absolute counts: they grow with $\\symC^2$, which is why the savings matter most deep in a network, where channels are many. The ratio "vs one 3×3" does not depend on $\\symC$ or $H$ at all.`,
    });

    // -------------------------------------------------------------------------------
    p.h2('How to compute convolutions', 'computing');
    p.prose(`
### im2col: convolution as one matrix multiplication

Matrix multiplication has been optimized to the last instruction on every platform there is (BLAS libraries on CPUs, cuBLAS on NVIDIA GPUs). So the most common way to compute a convolution is to rearrange it into one big matrix multiply:

1. Stretch every receptive field ($F \\times F \\times \\symC$ numbers) into a column. With $N_{\\text{pos}}$ filter positions you get a matrix $\\symX_{\\text{col}}$ with $F^2\\symC$ rows and $N_{\\text{pos}}$ columns. This step is called **im2col** ("image to columns").
2. Stretch each of the $K$ filters into a row: a matrix $\\symW_{\\text{row}}$ of size $K \\times F^2\\symC$.
3. Multiply. The result has one row per filter and one column per position. Reshape it into the output volume.`);
    p.figure({
      title: 'im2col: patches become columns, the layer becomes one matmul',
      codeTitle: 'im2col.py',
      code: `
        F, S = 3, 1                  # 5x5 input -> 3x3 output
        X_col = np.zeros((F * F, 9))
        for m, (i, j) in enumerate(np.ndindex(3, 3)):
            patch = X[i:i+F, j:j+F]               #@patch
            X_col[:, m] = patch.reshape(-1)       #@col
        # column {{m:0}} just filled
        W_row = W.reshape(2, F * F)   # filter -> row  #@wrow
        out = W_row.dot(X_col)        # (2, 9) matmul  #@mm
        A = out.reshape(2, 3, 3)      # 2 maps, 3x3    #@reshape
      `,
      setup: figIm2col,
      caption: `Step through. The 3 × 3 window visits all nine positions of the 5 × 5 input, and each patch, read row by row, becomes one column of $\\symX_{\\text{col}}$. Notice how the same input numbers show up in several columns: the middle pixel appears in all nine. Then each filter becomes a row, a single matrix product computes all 18 outputs at once, and a reshape turns them back into two 3 × 3 activation maps.`,
    });
    p.math({
      label: 'A CONV layer as one matrix product',
      tex: String.raw`\underbrace{\symA}_{K \,\times\, N_{\text{pos}}} \;=\; \underbrace{\sym{W}{W_{\text{row}}}}_{K \,\times\, F^2\symC} \;\; \underbrace{\sym{X}{X_{\text{col}}}}_{F^2\symC \,\times\, N_{\text{pos}}}`,
      code: `
        # AlexNet conv1: 227x227x3 input, 96 filters 11x11, stride 4
        X_col = im2col(X, F=11, S=4)    # (363, 3025): 11*11*3 by 55*55
        W_row = W.reshape(96, -1)       # (96, 363)
        A = W_row.dot(X_col)            # (96, 3025)
        A = A.reshape(96, 55, 55)       # the output volume
        X_col.size / X.size             # 1,098,075 / 154,587 = 7.1
      `,
      terms: [
        [String.raw`\sym{X}{X_{\text{col}}}`, 'every receptive field as a column: $F^2C$ numbers tall, one column per position'],
        [String.raw`\sym{W}{W_{\text{row}}}`, 'every filter as a row'],
        [String.raw`\symA`, 'row $k$, column $m$: filter $k$ dotted with patch $m$, which is exactly one output number of the layer'],
      ],
      explain: 'A matrix product computes every row of one matrix against every column of the other, and that is precisely "every filter against every patch". For AlexNet\'s first layer, the 55 × 55 = 3,025 patches of 363 numbers each make a matrix about 7 times larger than the image itself. That memory overhead is the price of im2col; the reward is that the heavy lifting is one call to a superbly optimized routine.',
    });
    p.prose(`
Caffe's CONV layer does exactly this: im2col, one call to cuBLAS for the multiply, then add the biases. So does \`fast_layers.py\` in Assignment 2, with \`np.dot\` (which calls BLAS) for the multiply.

### FFT: the convolution theorem

A classic result says that convolving two signals is the same as multiplying their *Fourier transforms* elementwise. The Fourier transform rewrites a signal as a sum of waves of different frequencies, and the **Fast Fourier Transform** (FFT) computes it for $n$ numbers in about $n \\log n$ steps instead of $n^2$. So a convolution can be done in three transforms and one cheap elementwise product:`);
    p.math({
      label: 'Convolution via the Fourier transform',
      tex: String.raw`\symX * \symW \;=\; \mathcal{F}^{-1}\big(\, \mathcal{F}(\symX) \odot \mathcal{F}(\symW) \,\big)`,
      code: `
        n = X.shape[0] + W.shape[0] - 1      # pad: no wrap-around
        FX = np.fft.rfft2(X, (n, n))         # 1. transform the image
        FW = np.fft.rfft2(W[::-1, ::-1], (n, n))  # 2. the filter, flipped
        full = np.fft.irfft2(FX * FW, (n, n))     # 3. multiply, 4. invert
        F = W.shape[0]
        A = full[F-1:n-F+1, F-1:n-F+1]       # keep the 'valid' part
      `,
      terms: [
        [String.raw`\mathcal{F}(\cdot)`, 'the Fourier transform (computed with the FFT)'],
        [String.raw`\odot`, 'elementwise multiplication'],
        [String.raw`\mathcal{F}^{-1}`, 'the inverse transform, back from frequencies to pixels'],
      ],
      explain: 'The expensive sliding of the filter over every position turns into a single elementwise multiply in the frequency domain, at the price of transforming in and out. The flip is there because ConvNet "convolution" is really cross-correlation (Chapter 11). FFT convolution gives big speedups for large filters, but for the 3 × 3 filters that dominate modern networks the speedup is small (Vasilache et al., *Fast Convolutional Nets with fbfft*).',
    });
    p.prose(`
### Fast algorithms

Multiplying two $N \\times N$ matrices the obvious way takes about $N^3$ multiplications. In 1969 Volker Strassen found a cleverer arrangement needing only about $N^{\\log_2 7} \\approx N^{2.81}$: trade some multiplications for extra additions, which are cheaper. Similar tricks exist for convolutions. Lavin and Gray (2015), *Fast Algorithms for Convolutional Neural Networks*, worked them out for 3 × 3 filters using Winograd's minimal filtering algorithms, and reported large speedups on VGG, especially at small batch sizes. The smallest case already shows the trick: two outputs of a 3-tap filter.`);
    p.math({
      label: 'Winograd F(2, 3): two outputs, four multiplications',
      tex: String.raw`\begin{aligned} m_1 &= (d_0 - d_2)\, g_0 \\ m_2 &= (d_1 + d_2)\, \tfrac{1}{2}(g_0 + g_1 + g_2) \\ m_3 &= (d_2 - d_1)\, \tfrac{1}{2}(g_0 - g_1 + g_2) \\ m_4 &= (d_1 - d_3)\, g_2 \\ y_0 &= m_1 + m_2 + m_3 \\ y_1 &= m_2 - m_3 - m_4 \end{aligned}`,
      code: `
        d = np.random.randn(4); g = np.random.randn(3)
        G = [g[0], (g[0]+g[1]+g[2]) / 2, (g[0]-g[1]+g[2]) / 2, g[2]]
        m1, m2 = (d[0] - d[2]) * G[0], (d[1] + d[2]) * G[1]
        m3, m4 = (d[2] - d[1]) * G[2], (d[1] - d[3]) * G[3]
        y = [m1 + m2 + m3, m2 - m3 - m4]
        np.allclose(y, np.correlate(d, g, 'valid'))   # True
      `,
      terms: [
        [String.raw`d_0 \ldots d_3`, 'four consecutive input values'],
        [String.raw`g_0, g_1, g_2`, 'the three filter weights'],
        [String.raw`\tfrac{1}{2}(g_0 \pm g_1 + g_2)`, 'combinations of the filter weights alone: computed once per filter, then reused at every position'],
        [String.raw`y_0, y_1`, 'the same two outputs as $d_0g_0 + d_1g_1 + d_2g_2$ and $d_1g_0 + d_2g_1 + d_3g_2$'],
      ],
      explain: 'The direct way needs 3 multiplications per output, 6 in all. Winograd\'s arrangement needs 4, plus some additions, which are cheaper. Expand $m_1 + m_2 + m_3$ by hand and everything cancels except $d_0g_0 + d_1g_1 + d_2g_2$. In two dimensions the same idea computes a 2 × 2 tile of 3 × 3 convolution outputs with 16 multiplications instead of 36, a 2.25× saving.',
    });
    p.figure({
      title: 'Six multiplications or four?',
      codeTitle: 'winograd_f23.py',
      code: `
        d = np.array([{{d:2, -1, 3, 1}}])    # 4 inputs
        g = np.array([{{g:1, 2, -1}}])       # a 3-tap filter
        # direct: 2 outputs x 3 taps = 6 multiplies
        y0 = d[0]*g[0] + d[1]*g[1] + d[2]*g[2]       #@d0
        y1 = d[1]*g[0] + d[2]*g[1] + d[3]*g[2]       #@d1
        # Winograd F(2,3): the filter part is precomputed
        G = [g[0], (g[0] + g[1] + g[2]) / 2,
             (g[0] - g[1] + g[2]) / 2, g[2]]          #@G
        m1 = (d[0] - d[2]) * G[0]                     #@m1
        m2 = (d[1] + d[2]) * G[1]                     #@m2
        m3 = (d[2] - d[1]) * G[2]                     #@m3
        m4 = (d[1] - d[3]) * G[3]                     #@m4
        y = [m1 + m2 + m3, m2 - m3 - m4]  # {{y}}     #@yw
      `,
      setup: figWinograd,
      caption: `Step through both methods on the same numbers. The direct way spends three multiplications per output. Winograd's way first combines the filter weights (once per filter, so in a real layer this cost disappears across thousands of positions), then gets both outputs from four products. Press **New numbers** to check that the two methods always agree.`,
    });
    p.prose(`In early 2016 these fast algorithms were promising but not yet widely used; NVIDIA's cuDNN library added a Winograd algorithm for 3 × 3 convolutions later that year. To sum up the three approaches: im2col is easy to implement but costs memory; FFT helps most for large filters; fast algorithms like Winograd's help exactly the small filters modern networks use.`);

    // -------------------------------------------------------------------------------
    p.h2('Hardware and implementation details', 'hardware');
    p.prose(`
### CPUs and GPUs

A CPU has a few fast cores (1 to 16 in 2016) and is good at sequential work. A GPU has thousands of slower cores, originally built for graphics, and is good at doing the same simple operation on lots of data at once, which is exactly what matrix multiplies and convolutions are. NVIDIA dominates deep learning hardware, largely because of **CUDA** (its platform for writing C code that runs on the GPU) and the libraries built on it: cuBLAS for matrix math, cuFFT, and **cuDNN**, hand-tuned kernels for convolutions and other neural network layers. OpenCL runs on any vendor's GPU but was usually slower. In practice you never write GPU code for standard layers: the frameworks call these libraries for you.

Even with GPUs, big models trained slowly: the lecture quoted about 2 to 3 weeks on 4 GPUs for VGG, and the same for ResNet-101.

### Bottlenecks

- **CPU to GPU.** Moving data between them is slow. Load and augment the next batch on the CPU in a separate thread while the GPU runs the current forward and backward pass.
- **Disk.** A spinning hard disk cannot keep up with a GPU reading millions of small image files. Preprocess the images, store them contiguously in large files, and read them as a raw stream of bytes, ideally from an SSD.
- **GPU memory.** In early 2016 the largest card (the Titan X) had 12 GB, and AlexNet needed about 3 GB at a batch size of 256. [Chapter 11](#/convnets/compute) shows how to estimate it.

### Floating-point precision

NumPy computes in 64-bit "double" precision by default. ConvNets are typically trained in 32-bit "single" precision (the CS231n assignments too), which halves memory and bandwidth and is accurate enough. The lecture predicted that 16-bit "half" precision would become the new standard: cuDNN already supported it, and NVIDIA's next generation of GPUs (Pascal) would add hardware for it. Research was pushing lower still:`);
    p.table(
      ['Format', 'Bits', 'Status in early 2016'],
      [
        ['double', '64', 'NumPy\'s default; rarely needed for deep learning'],
        ['single (float32)', '32', 'the standard for training ConvNets'],
        ['half (float16)', '16', 'supported by cuDNN; predicted to become standard'],
        ['fixed point', '16', 'trained successfully with *stochastic rounding* (Gupta et al., 2015)'],
        ['low-precision mix', '10 / 12', '10-bit activations and 12-bit parameter updates (Courbariaux et al., 2015)'],
        ['binary', '1', 'weights and activations of +1 or −1, multiplication by bitwise XNOR; gradients kept in higher precision (BinaryNet, Courbariaux and Bengio, February 2016)'],
      ],
    );
    p.prose(`The danger with few bits is that small numbers get rounded away. In float16 the representable values just below 1.0 are about 0.0005 apart, so a gradient step of 0.0001 applied to a weight near 1.0 rounds straight back to where it started, every single time. The fix Gupta et al. used is **stochastic rounding**: round up or down at random, with the probability of rounding up equal to how far the value is past the lower neighbor. Any one rounding is off, but on average it is exactly right.`);
    p.figure({
      title: 'Tiny updates in 16 bits: rounding to nearest versus stochastic rounding',
      codeTitle: 'fp16_rounding.py',
      code: `
        step = {{step:1e-4}}          # one small SGD update
        w32 = np.float32(1.0)
        w_near = np.float16(1.0)
        w_stoch = np.float16(1.0)
        for t in range(400):          # t = {{t:0}}
            w32 -= step                                 #@ref
            w_near = np.float16(w_near - step)          #@near
            w_stoch = stochastic_round(w_stoch - step)  #@stoch
        # {{w32}}, {{wn}}, {{ws}}

        def stochastic_round(v):      # to a float16 neighbor
            e = np.floor(np.log2(abs(v)))   # v's power of two
            ulp = 2.0 ** (e - 10)     # float16: 10 fraction bits
            lo = np.floor(v / ulp) * ulp
            up = np.random.rand() < (v - lo) / ulp
            return np.float16(lo + up * ulp)
      `,
      setup: figRounding,
      caption: `A weight starts at 1.0 and receives 400 identical updates. The dashed line is float32, effectively exact here. At the default step of $10^{-4}$, rounding to the nearest float16 (red) never moves at all: every update is smaller than half the gap between float16 values, so it is rounded away. Stochastic rounding (teal) jitters but tracks the true value. Drag the update size up past about $2.5 \\times 10^{-4}$ and round-to-nearest starts moving, but in steps of the float16 gap rather than the true step size, so it drifts away from the truth. Press **Run** to animate a fresh random run.`,
    });
    p.prose(`
### Multi-GPU and distributed training

One GPU is plenty for most problems, but big models and datasets can be spread over several. There are two basic ways to split the work:

- **Data parallelism**: every GPU holds a full copy of the model and processes a different slice of the batch; the gradients are then combined.
- **Model parallelism**: the model itself is split, with different GPUs computing different layers or different parts of a layer. Needed when the model does not fit on one GPU.

Alex Krizhevsky's *One weird trick for parallelizing convolutional neural networks* used data parallelism for the CONV layers (few weights, lots of compute) and model parallelism for the FC layers (lots of weights, little compute). With data parallelism, the gradients can be combined **synchronously** (wait for every worker, average, update: mathematically the same as one big batch) or **asynchronously** (each worker applies its gradient to a shared copy of the weights whenever it finishes, as in Google's DistBelief system by Dean et al.; no waiting, but workers compute with slightly stale weights). TensorFlow was designed to support both.`);
    p.math({
      label: 'Synchronous data parallelism',
      tex: String.raw`\begin{gathered}\nabla_{\symW} \symL \;=\; \frac{1}{G} \sum_{g=1}^{G} \nabla_{\symW} \symL^{(g)} \\ \symW \leftarrow \symW - \symlr\, \nabla_{\symW} \symL\end{gathered}`,
      code: `
        shards = np.array_split(batch, G)          # one slice per GPU
        grads = [grad_on_gpu(g, W, s)              # run in parallel
                 for g, s in enumerate(shards)]
        dW = sum(grads) / G                        # wait for all, average
        W -= lr * dW                               # same update everywhere
      `,
      terms: [
        [String.raw`\symL^{(g)}`, 'the loss on the slice of the batch that GPU number $g$ processed'],
        [String.raw`\nabla_{\symW} \symL^{(g)}`, 'the gradient that GPU computed, for all the weights'],
        [String.raw`\frac{1}{G}\sum_{g=1}^{G}`, 'average the $G$ gradients'],
      ],
      explain: 'Because the loss of a batch is an average over its examples, the average of the per-GPU gradients is exactly the gradient of the whole batch. So $G$ GPUs working synchronously behave like one GPU with a $G$ times larger batch, just faster. The cost is communication: every step, the gradients must travel between GPUs, and everyone waits for the slowest.',
    });

    // -------------------------------------------------------------------------------
    p.h2('Deep learning software (2016)', 'software');
    p.prose(`
Nobody writes a serious ConvNet in raw NumPy. In early 2016 four frameworks dominated, and Lecture 12 compared them. They differ in language and philosophy, but all of them solve the same two problems: run the computation fast on GPUs, and compute the gradients for you.

### Computational graphs and automatic differentiation

[Chapter 6](#/backprop) showed that any network is a **computational graph** of simple operations, and that backpropagation is the chain rule applied backward through that graph. A framework that knows the graph can do backprop *automatically*: you write only the forward pass, and it derives the backward pass. Theano and TensorFlow are built entirely around this idea. You first describe the graph with *symbolic* variables (placeholders that hold no data yet), ask for gradients symbolically, then compile the graph into a function and run it on real arrays:`);
    p.code(`
      import theano
      import theano.tensor as T

      x = T.matrix('x')             # symbolic: no data yet
      y = T.ivector('y')
      w1 = T.matrix('w1')
      w2 = T.matrix('w2')
      a = T.maximum(0, x.dot(w1))   # builds graph nodes only
      scores = a.dot(w2)
      probs = T.nnet.softmax(scores)
      loss = T.nnet.categorical_crossentropy(probs, y).mean()
      dw1, dw2 = T.grad(loss, [w1, w2])   # backprop, derived for you

      f = theano.function([x, y, w1, w2], [loss, dw1, dw2])  # compile
      out = f(xx, yy, ww1, ww2)     # now run it on NumPy arrays
    `, { title: 'theano_two_layer.py' });
    p.prose(`TensorFlow, released by Google in November 2015, follows the same plan with different names: *placeholders* are fed data at run time, *Variables* hold the weights inside the graph, and a *Session* runs it.`);
    p.code(`
      import tensorflow as tf      # the 2016 API

      x = tf.placeholder(tf.float32, shape=(N, D))
      y = tf.placeholder(tf.float32, shape=(N, K))   # one-hot
      w1 = tf.Variable(1e-3 * np.random.randn(D, H).astype(np.float32))
      w2 = tf.Variable(1e-3 * np.random.randn(H, K).astype(np.float32))
      a = tf.nn.relu(tf.matmul(x, w1))
      scores = tf.matmul(a, w2)
      loss = tf.reduce_mean(
          tf.nn.softmax_cross_entropy_with_logits(scores, y))
      train_step = tf.train.GradientDescentOptimizer(1e-5).minimize(loss)

      with tf.Session() as sess:
          sess.run(tf.initialize_all_variables())
          for t in range(1000):
              sess.run(train_step, feed_dict={x: xx, y: yy})
    `, { title: 'tensorflow_two_layer.py' });
    p.prose(`
### The four frameworks

**Caffe** (UC Berkeley; C++ with Python and MATLAB bindings) was built for feedforward networks, especially training and fine-tuning ConvNets. Its core classes are the *Blob* (an array holding data and its gradients), the *Layer* (computes top blobs from bottom blobs, forward and backward), the *Net* (a graph of layers) and the *Solver* (runs the updates). You can train without writing code at all: convert your images to a database file, describe the network and the solver in *.prototxt* text files, and run the \`caffe train\` tool with pretrained weights. To fine-tune, rename the last layer (layers whose names match the pretrained file get its weights; a renamed layer is initialized fresh), set the learning-rate multipliers of layers you want frozen to 0, and divide the base learning rate by about 100. On the downside, new GPU layers mean writing C++ and CUDA, recurrent networks fit poorly, and big models get unwieldy: the prototxt for ResNet-152 was 6,775 lines long. Its Model Zoo was the place to get pretrained networks.

**Torch** (NYU and IDIAP; written in C and Lua, used heavily at Facebook and DeepMind) gives you NumPy-like tensors where moving to the GPU is just a change of data type, and an \`nn\` package of *modules*, each with a forward and a backward method that are short and easy to read. Writing your own layer is easy and many pretrained models were available. The costs: Lua (a language few people knew, with 1-based indexing), less plug-and-play than Caffe (you write your own training loop), and recurrent networks were awkward.

**Theano** (Yoshua Bengio's group at the University of Montreal; Python) is the computational-graph approach shown above: symbolic variables, automatic gradients, compiled functions, \`scan\` for loops, and higher-level wrappers such as Keras and Lasagne. Graphs make recurrent networks natural. On the other hand raw Theano is low-level, error messages could be unhelpful, large models could take a long time to compile, and pretrained models were patchy.

**TensorFlow** (Google; Python) is very similar to Theano but compiles much faster, comes with **TensorBoard** for visualizing training and the graph itself, and supports both data and model parallelism across GPUs. In early 2016 its distributed (multi-machine) version was not yet open source, it was slower than the others, and there were few pretrained models.`);
    p.table(
      ['', 'Caffe', 'Torch', 'Theano', 'TensorFlow'],
      [
        ['Language', 'C++, Python', 'Lua', 'Python', 'Python'],
        ['Pretrained models', 'many', 'many', 'some (Lasagne)', 'Inception'],
        ['Multi-GPU, data parallel', 'yes', 'yes', 'yes', 'yes'],
        ['Multi-GPU, model parallel', 'no', 'yes', 'experimental', 'yes (best)'],
        ['Readable source code', 'yes (C++)', 'yes (Lua)', 'no', 'no'],
        ['Good at RNNs', 'no', 'mediocre', 'yes', 'yes (best)'],
      ],
      { caption: 'The overview from Lecture 12 (February 2016).' },
    );
    p.prose(`
The lecture's recommendations, by use case:

- Extract features from, or fine-tune, an existing model: **Caffe**.
- Complex uses of pretrained models: **Lasagne** (on Theano) or **Torch**.
- Writing your own layers: **Torch**.
- Unusual recurrent networks: **Theano** or **TensorFlow**.
- Huge models that need model parallelism: **TensorFlow**.`);
    p.callout('history', `Everything above describes early 2016, and the landscape moved quickly afterwards. TensorFlow open-sourced its distributed version within months. **PyTorch**, from Facebook, was released publicly in early 2017: it carried Torch's design over to Python and built the computational graph *as the code runs* ("define by run") instead of compiling it first. That made models easy to write and debug like ordinary Python, and within a few years it became the default choice for research. Theano's developers ended major development in 2017, Lua Torch was superseded by PyTorch, and Caffe's successor Caffe2 merged into PyTorch in 2018. TensorFlow 2 (2019) also switched to running code immediately by default. The listing below is in today's PyTorch style, for comparison only; it is not part of the 2016 course.`, 'Later context: what happened next');
    p.code(`
      import torch                  # later context, not 2016

      w1 = torch.randn(D, H, requires_grad=True)
      w2 = torch.randn(H, K, requires_grad=True)
      for t in range(1000):
          scores = (x @ w1).clamp(min=0) @ w2   # runs right away
          loss = torch.nn.functional.cross_entropy(scores, y)
          loss.backward()           # graph was recorded as it ran
          with torch.no_grad():
              for w in (w1, w2):
                  w -= 1e-3 * w.grad
                  w.grad.zero_()
    `, { title: 'later_context_pytorch.py' });

    p.callout('idea', `Stretch your data with label-preserving noise (flips, crops, scales, color shifts) and average over fixed views at test time. Do not train from scratch: start from an ImageNet model and freeze, fine-tune or retrain more of it as your data grows in size and differs from ImageNet, with small learning rates for pretrained layers. Prefer stacks of 3 × 3, 1 × 1 bottlenecks and factored 1 × N filters: fewer parameters, less compute, more nonlinearity. Under the hood, convolutions run as one big matrix multiply (im2col), via FFTs, or with Winograd-style fast algorithms, on GPUs, in ever lower precision. And let a framework build the graph and derive the gradients for you.`, 'Takeaways');
  },
};

export default chapter;
