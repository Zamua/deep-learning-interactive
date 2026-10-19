import type { Page } from '../core/page';
import { fmt } from '../core/code';
import { CIFAR_CLASSES, type CifarSet, loadCifar } from '../core/data';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { FONT, blit, diverging, heatmap, imgCanvas, label, maxAbs, fit, isTall, thumbs } from './vit-draw';
import { type TinyViT, type VitTrace, loadVits } from './vit-model';

/** Test-set images the figures offer (indices into the 200-image CIFAR-10 test sample). */
export const SHOW = [0, 34, 17, 73, 4, 49, 31, 69];

/** CIFAR test images and both trained models, loaded once. */
export interface Assets {
  test: CifarSet;
  vit: TinyViT;
  nopos: TinyViT;
}
let assetsP: Promise<Assets> | null = null;
export function loadAssets(): Promise<Assets> {
  assetsP ??= Promise.all([loadCifar(), loadVits()]).then(([c, m]) => ({ test: c.test, vit: m.vit, nopos: m.nopos }));
  return assetsP;
}

const traces = new Map<string, VitTrace>();
/** Cached forward pass of a model on test image i (optionally with patches reordered). */
export function traceOf(a: Assets, m: TinyViT, i: number, order?: number[]): VitTrace {
  const key = `${m.hasPos ? 'p' : 'n'}${i}${order ? `:${order.join(',')}` : ''}`;
  let t = traces.get(key);
  if (!t) {
    t = m.forward(m.patches(a.test.pixels, i * 3072), order);
    if (!order) traces.set(key, t);
  }
  return t;
}

export function argmax(a: ArrayLike<number>): number {
  let k = 0;
  for (let i = 1; i < a.length; i++) if (a[i]! > a[k]!) k = i;
  return k;
}

/* ------------------------------------------------------------------ */
/* Fig: an image cut into patches                                       */
/* ------------------------------------------------------------------ */

export function figPatches(p: Page): void {
  p.figure({
    title: 'A CIFAR-10 image cut into patches',
    codeTitle: 'patchify.py',
    code: `
      img = X_test[{{idx:0}}]          # (32, 32, 3): H, W, C
      P = {{P:8}}                        # patch size in pixels
      H, W, C = img.shape
      N = (H // P) * (W // P)            # {{N:16}} patches       #@n
      patches = (img.reshape(H // P, P, W // P, P, C)   #@flat
                    .transpose(0, 2, 1, 3, 4)           #@flat
                    .reshape(N, P * P * C))             #@flat
      # patches.shape == ({{N}}, {{pd:192}})

      r, c = divmod({{j:0}}, W // P)     # row {{r:0}}, column {{c:0}}  #@pick
      x_p = patches[{{j}}]   # img[{{y0:0}}:{{y1:8}}, {{x0:0}}:{{x1:8}}].ravel()  #@pick
    `,
    setup(f) {
      let A: Assets | null = null;
      let idx = SHOW[0]!;
      let P = 8;
      let j = 0;
      const G = () => 32 / P;
      const N = () => G() * G();
      let geo = { ix: 0, iy: 0, S: 1 };
      const cv = f.canvas(360, 470, (ctx, w, hh) => {
        const tall = isTall(w);
        if (!A) {
          label(ctx, 'Loading CIFAR-10…', w / 2, hh / 2, { align: 'center' });
          return;
        }
        const src = imgCanvas(A.test, idx);
        const g = G();
        const S = tall ? Math.min(w * 0.58, 260) : Math.min(w * 0.42, 300);
        const ix = tall ? (w - S) / 2 : 8;
        const iy = 26;
        geo = { ix, iy, S };
        label(ctx, `the image: 32 × 32 × 3 = 3,072 numbers`, tall ? w / 2 : ix, 16, { font: FONT.ui(12, 600), color: color('--ink'), align: tall ? 'center' : 'left' });
        blit(ctx, src, ix, iy, S, S);
        const cs = S / g;
        const gy = Math.floor(j / g), gx = j % g;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let k = 0; k < g * g; k++) if (k !== j) ctx.fillRect(ix + (k % g) * cs, iy + Math.floor(k / g) * cs, cs, cs);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 1; k < g; k++) {
          ctx.moveTo(ix + k * cs + 0.5, iy);
          ctx.lineTo(ix + k * cs + 0.5, iy + S);
          ctx.moveTo(ix, iy + k * cs + 0.5);
          ctx.lineTo(ix + S, iy + k * cs + 0.5);
        }
        ctx.stroke();
        ctx.strokeStyle = color('orange');
        ctx.lineWidth = 3;
        ctx.strokeRect(ix + gx * cs, iy + gy * cs, cs, cs);
        // the sequence
        const rx = tall ? 8 : ix + S + 26;
        const rw = w - rx - 8;
        let y = tall ? iy + S + 30 : 16;
        label(ctx, `the sequence: N = ${N()} patches, in reading order`, rx, y, { font: FONT.ui(12, 600), color: color('--ink') });
        y += 10;
        const lay = (n: number) => {
          const per = n === 64 ? 16 : n === 16 ? 8 : 4;
          const gap = n === 64 ? 3 : 6;
          const t = Math.min((rw - gap * (per - 1)) / per, 46);
          const lab = t >= 26 ? 14 : 0;
          return { per, gap, t, lab, height: (n / per) * (t + gap + lab) };
        };
        const { per, gap, t } = lay(N());
        const ribbonH = Math.max(lay(64).height, lay(16).height, lay(4).height);
        for (let k = 0; k < N(); k++) {
          const x = rx + (k % per) * (t + gap);
          const yy = y + Math.floor(k / per) * (t + gap + (t >= 26 ? 14 : 0));
          blit(ctx, src, x, yy, t, t, (k % g) * P, Math.floor(k / g) * P, P, P);
          if (k === j) {
            ctx.strokeStyle = color('orange');
            ctx.lineWidth = 2.5;
            ctx.strokeRect(x - 1, yy - 1, t + 2, t + 2);
          }
          if (t >= 26) label(ctx, String(k), x + t / 2, yy + t + 11, { font: FONT.mono(10.5), align: 'center', color: k === j ? color('orange') : color('--ink-3') });
        }
        y += ribbonH + 22;
        // the flattened patch
        const pd = P * P * 3;
        label(ctx, `x_p for patch ${j}: one row of P·P·C = ${pd} numbers`, rx, y, { font: FONT.ui(12, 600), color: color('orange') });
        y += 8;
        const bh = 22;
        const cw = rw / pd;
        const px = A.test.pixels;
        const o = idx * 3072;
        for (let q = 0; q < pd; q++) {
          const c = q % 3;
          const pix = Math.floor(q / 3);
          const py = Math.floor(pix / P), pxx = pix % P;
          const v = px[o + c * 1024 + (gy * P + py) * 32 + gx * P + pxx]!;
          ctx.fillStyle = c === 0 ? `rgb(${v},0,0)` : c === 1 ? `rgb(0,${v},0)` : `rgb(0,0,${v})`;
          ctx.fillRect(rx + q * cw, y, Math.max(cw, 0.6) + 0.3, bh);
        }
        ctx.strokeStyle = color('--rule');
        ctx.lineWidth = 1;
        ctx.strokeRect(rx, y, rw, bh);
        y += bh + 15;
        label(ctx, 'red, green, blue of pixel (0, 0), then (0, 1), …', rx, y, { font: FONT.ui(11.5), color: color('--ink-3') });
        fit(cv.canvas, w, hh, Math.max(y, iy + S) + 10);
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        const g = G();
        const r = Math.floor(j / g), c = j % g;
        f.code.setMany({ idx, P, N: N(), pd: P * P * 3, j, r, c, y0: r * P, y1: (r + 1) * P, x0: c * P, x1: (c + 1) * P });
        cv.redraw();
      };
      f.segmented({
        label: 'patch size P',
        options: [
          { value: '4', label: '4 × 4' },
          { value: '8', label: '8 × 8' },
          { value: '16', label: '16 × 16' },
        ],
        value: '8',
        onChange: (v) => {
          P = Number(v);
          f.code.highlight(['n', 'flat']);
          st.setSteps(N());
          sync();
        },
      });
      const st = f.stepper({
        steps: N(),
        interval: 450,
        label: (k) => `patch ${k} of ${N()}`,
        onStep: (k) => {
          j = k;
          f.code.highlight('pick');
          sync();
        },
      });
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const x = e.clientX - r.left - geo.ix, y = e.clientY - r.top - geo.iy;
        if (x < 0 || y < 0 || x >= geo.S || y >= geo.S) return;
        const g = G();
        st.go(Math.floor(y / (geo.S / g)) * g + Math.floor(x / (geo.S / g)));
      });
      loadCifar()
        .then(({ test }) => {
          A = { test } as Assets;
          thumbs(f, test, SHOW, idx, (id) => {
            idx = id;
            sync();
          });
          sync();
        })
        .catch((e) => f.status(`Could not load CIFAR-10: ${(e as Error).message}`));
    },
    caption: `The image is cut into a grid of $\\symP \\times \\symP$ squares, read left to right and top to bottom like words on a page, and each square is unrolled into one row of numbers $\\symxp$. That is the entire trick that lets a transformer read an image. **Tap a patch** or press play to walk the sequence, and switch the patch size: halving $\\symP$ makes four times as many patches, each a quarter as long. Pick another image from the thumbnails.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: patches to tokens                                               */
/* ------------------------------------------------------------------ */

type Mat = { data: ArrayLike<number>; rows: number; cols: number; k: 'orange' | 'blue' | 'gold' | 'green' | 'red'; name: string; hi?: number };

export function figTokens(p: Page): void {
  p.figure({
    title: 'From patches to tokens, in the trained tiny ViT',
    codeTitle: 'embed.py',
    code: `
      patches = patchify(img, P=4)   # (64, 48)              #@xp
      tokens = patches @ E           # (64, 48) @ (48, 64)   #@emb
      z0 = np.vstack([cls, tokens])  # (65, 64), class first #@cls
      z0 = z0 + E_pos                # (65, 64) + (65, 64)   #@pos
      # step {{step:1}} of 4

      # column k of E, as a 4x4 color patch, is filter k:  #@filt
      filt = E[:, {{k:0}}].reshape(4, 4, 3)               #@filt
    `,
    setup(f) {
      let A: Assets | null = null;
      let idx = SHOW[0]!;
      let step = 0;
      let k = 0;
      let mosaic = { x: 0, y: 0, t: 1 };
      const cv = f.canvas(360, 470, (ctx, w, hh) => {
        const tall = isTall(w);
        if (!A) {
          label(ctx, 'Loading the trained tiny ViT…', w / 2, hh / 2, { align: 'center' });
          return;
        }
        const m = A.vit;
        const tr = traceOf(A, m, idx);
        const xp = m.patches(A.test.pixels, idx * 3072);
        const Et = new Float32Array(48 * 64);
        for (let o = 0; o < 64; o++) for (let q = 0; q < 48; q++) Et[q * 64 + o] = m.E[o * 48 + q]!;
        const tokens = tr.emb;
        const stacked = new Float32Array(65 * 64);
        stacked.set(m.cls, 0);
        stacked.set(tokens, 64);
        const mats: { a: Mat; op?: string; b?: Mat; res?: Mat } =
          step === 0 ? { a: { data: xp, rows: 64, cols: 48, k: 'orange', name: 'patches' } }
          : step === 1 ? { a: { data: xp, rows: 64, cols: 48, k: 'orange', name: 'patches' }, op: '@', b: { data: Et, rows: 48, cols: 64, k: 'blue', name: 'E' }, res: { data: tokens, rows: 64, cols: 64, k: 'green', name: 'tokens' } }
          : step === 2 ? { a: { data: m.cls, rows: 1, cols: 64, k: 'gold', name: 'cls' }, op: 'stack', b: { data: tokens, rows: 64, cols: 64, k: 'green', name: 'tokens' }, res: { data: stacked, rows: 65, cols: 64, k: 'green', name: 'z0', hi: 0 } }
          : { a: { data: stacked, rows: 65, cols: 64, k: 'green', name: 'z0', hi: 0 }, op: '+', b: { data: m.pos, rows: 65, cols: 64, k: 'red', name: 'E_pos' }, res: { data: tr.z0, rows: 65, cols: 64, k: 'green', name: 'z0', hi: 0 } };
        const opw = 30;
        const cell = (w - 2 * opw - 12) / 192;
        const top = 34;
        const drawMat = (M: Mat, x: number) => {
          const mw = M.cols * cell;
          const mh = M.rows * cell;
          const y = top + (65 * cell - mh) / 2;
          heatmap(ctx, M.data, M.rows, M.cols, x, y, mw, Math.max(mh, 3), diverging('--paper-3', M.k), maxAbs(M.data) * 0.6);
          ctx.strokeStyle = color(M.k);
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, mw, Math.max(mh, 3));
          if (M.hi !== undefined) {
            ctx.strokeStyle = color('gold');
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 1, y - 1, mw + 2, cell + 2);
          }
          label(ctx, M.name, x + mw / 2, top - 18, { font: FONT.mono(12.5, 600), color: color(M.k), align: 'center' });
          label(ctx, `(${M.rows}, ${M.cols})`, x + mw / 2, top - 5, { font: FONT.mono(11), align: 'center', color: color('--ink-3') });
          return x + mw;
        };
        let x = 4;
        x = drawMat(mats.a, x);
        if (mats.b && mats.res) {
          const opLabel = mats.op === 'stack' ? '↓' : mats.op!;
          label(ctx, mats.op === 'stack' ? 'stack' : opLabel, x + opw / 2, top + 32 * cell + 5, { font: mats.op === 'stack' ? FONT.ui(11, 600) : FONT.mono(17, 600), align: 'center', color: color('--ink-2') });
          x = drawMat(mats.b, x + opw);
          label(ctx, '=', x + opw / 2, top + 32 * cell + 6, { font: FONT.mono(17, 600), align: 'center', color: color('--ink-2') });
          drawMat(mats.res, x + opw);
        }
        // what this step did
        const notes = [
          ['patches: 64 rows, one per patch, 48 numbers each', '(4 · 4 pixels · 3 colors).'],
          ['Each number of a token is one column of E dotted', 'with the patch: the response of one filter.'],
          ['A learned class token goes in front as row 0.', 'Now there are 65 tokens.'],
          ['Each row gets its own learned position vector.', 'The result, z0, is what the encoder reads.'],
        ][step]!;
        const ny = top + 65 * cell + 26;
        notes.forEach((t, i) => label(ctx, t, 6, ny + i * 17, { font: FONT.ui(12.5), color: color('--ink-2') }));
        // the filters of E
        const y0 = ny + 2 * 17 + 18;
        const t = Math.floor(Math.min((w - 16) / 8 - 3, tall ? 34 : 26));
        const mx = 6;
        const my = y0 + 10;
        mosaic = { x: mx, y: my, t };
        label(ctx, 'columns of E as 4 × 4 color filters (tap one)', mx, y0, { font: FONT.ui(12, 600), color: color('blue') });
        for (let o = 0; o < 64; o++) {
          let lo = Infinity, hi = -Infinity;
          for (let q = 0; q < 48; q++) {
            lo = Math.min(lo, m.E[o * 48 + q]!);
            hi = Math.max(hi, m.E[o * 48 + q]!);
          }
          const img = new ImageData(4, 4);
          for (let q = 0; q < 16; q++)
            for (let c = 0; c < 3; c++) img.data[q * 4 + c] = (255 * (m.E[o * 48 + q * 3 + c]! - lo)) / (hi - lo + 1e-9);
          for (let q = 0; q < 16; q++) img.data[q * 4 + 3] = 255;
          const tmp = document.createElement('canvas');
          tmp.width = tmp.height = 4;
          tmp.getContext('2d')!.putImageData(img, 0, 0);
          const tx = mx + (o % 8) * (t + 3), ty = my + Math.floor(o / 8) * (t + 3);
          blit(ctx, tmp, tx, ty, t, t, 0, 0, 4, 4);
          if (o === k) {
            ctx.strokeStyle = color('blue');
            ctx.lineWidth = 2;
            ctx.strokeRect(tx - 1.5, ty - 1.5, t + 3, t + 3);
          }
        }
        fit(cv.canvas, w, hh, my + 8 * (t + 3) + 6);
      });
      cv.canvas.classList.add('scroll-ok');
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const x = e.clientX - r.left - mosaic.x, y = e.clientY - r.top - mosaic.y;
        const cx = Math.floor(x / (mosaic.t + 3)), cy = Math.floor(y / (mosaic.t + 3));
        if (x < 0 || y < 0 || cx > 7 || cy > 7) return;
        k = cy * 8 + cx;
        f.code.set('k', k);
        f.code.highlight('filt', 'alt');
        cv.redraw();
      });
      f.stepper({
        steps: 4,
        interval: 1800,
        label: (s) => ['the patches', 'project with E', 'add the class token', 'add positions'][s]!,
        onStep: (s) => {
          step = s;
          f.code.set('step', s + 1);
          f.code.highlight(['xp', 'emb', 'cls', 'pos'][s]!);
          cv.redraw();
        },
      });
      loadAssets()
        .then((a) => {
          A = a;
          thumbs(f, a.test, SHOW, idx, (id) => {
            idx = id;
            cv.redraw();
          });
          cv.redraw();
        })
        .catch((e) => f.status(`Could not load the model: ${(e as Error).message}`));
    },
    caption: `The actual numbers inside a tiny ViT trained on CIFAR-10 (details below). Step through the four lines of code: 64 patches of 48 numbers become 64 tokens of $\\symD$ = 64 numbers through one matrix multiply with $\\symE$, a learned class token $\\symcls$ joins at the front, and the learned position embeddings $\\symEpos$ are added row by row. Color shows sign and size (paper color is zero). Below, every column of $\\symE$ drawn as the 4 × 4 color patch it responds to: these are the same kind of object as a ConvNet's first-layer filters.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: attention from the class token                                  */
/* ------------------------------------------------------------------ */

/**
 * Draws a patch-grid map (G x G) as a veil over the image: bright where the map is high. The map
 * is stretched from its own minimum to its maximum, so nearly flat maps still show their shape.
 */
export function veil(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, map: ArrayLike<number>, G: number, x: number, y: number, S: number, strength = 0.85): void {
  blit(ctx, src, x, y, S, S);
  let mx = -Infinity, mn = Infinity;
  for (let i = 0; i < G * G; i++) {
    mx = Math.max(mx, map[i]!);
    mn = Math.min(mn, map[i]!);
  }
  const cs = S / G;
  for (let i = 0; i < G * G; i++) {
    const a = strength * (1 - (map[i]! - mn) / (mx - mn + 1e-12));
    ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
    ctx.fillRect(x + (i % G) * cs, y + Math.floor(i / G) * cs, cs + 0.4, cs + 0.4);
  }
}

/** A G x G map as a small heat tile in one color, stretched from its own minimum to its maximum. */
export function tile(ctx: CanvasRenderingContext2D, map: ArrayLike<number>, G: number, x: number, y: number, t: number, k: 'purple' | 'red' | 'teal'): void {
  let mx = -Infinity, mn = Infinity;
  for (let i = 0; i < G * G; i++) {
    mx = Math.max(mx, map[i]!);
    mn = Math.min(mn, map[i]!);
  }
  heatmap(ctx, Array.from({ length: G * G }, (_, i) => map[i]! - mn), G, G, x, y, t, t, diverging('--paper', k), mx - mn + 1e-12);
}

/** Class token's attention over the patches: one layer and head selection, or the rollout through a layer. */
export function clsMap(m: TinyViT, tr: VitTrace, l: number, col: number): Float32Array {
  const T = m.N + 1;
  if (col === 5) return m.rollout(tr, l).slice(1, T);
  const A = col === 4 ? m.meanHeads(tr, l) : tr.A[l]!.subarray(col * T * T, (col + 1) * T * T);
  return A.slice(1, T);
}

export function figClsAttention(p: Page): void {
  p.figure({
    title: 'Where the class token looks',
    codeTitle: 'cls_attention.py',
    code: `
      probs, A = vit(img)          # A: (6, 4, 65, 65)          #@fwd
      # A[l, h, i, j]: how much token i takes from token j
      a = A[{{l:6}} - 1, {{hs::}}].mean(axis=0)   # {{nh:4}} head(s)   #@sel
      cls_row = a[0, 1:]           # class token -> 64 patches  #@sel
      amap = cls_row.reshape(8, 8)                              #@sel

      R = np.eye(65)               # rollout: layers 1 to {{l}}   #@roll
      for A_l in A[:{{l}}].mean(axis=1):                          #@roll
          R = (0.5 * A_l + 0.5 * np.eye(65)) @ R   # + residual  #@roll
      amap = R[0, 1:].reshape(8, 8)                              #@roll
      # vit says: {{pred:…}} ({{conf:…}})
    `,
    setup(f) {
      let A: Assets | null = null;
      let idx = SHOW[1]!;
      let sel = { l: 5, col: 5 };
      let grid = { x: 0, y: 0, t: 1, gap: 1 };
      const COLS = ['head 1', 'head 2', 'head 3', 'head 4', 'mean', 'rollout'];
      const cv = f.canvas(360, 590, (ctx, w, hh) => {
        const tall = isTall(w);
        if (!A) {
          label(ctx, 'Loading the trained tiny ViT…', w / 2, hh / 2, { align: 'center' });
          return;
        }
        const m = A.vit;
        const tr = traceOf(A, m, idx);
        const src = imgCanvas(A.test, idx);
        const S = tall ? Math.min(w * 0.45, 210) : Math.min(250, w * 0.4);
        const ix = 6, iy = 24;
        const map = clsMap(m, tr, sel.l, sel.col);
        label(ctx, sel.col === 5 ? `rollout through layer ${sel.l + 1}` : `layer ${sel.l + 1}, ${sel.col === 4 ? 'mean of 4 heads' : COLS[sel.col]}`, ix, 15, { font: FONT.ui(12, 600), color: color('purple') });
        veil(ctx, src, map, m.G, ix, iy, S);
        // prediction
        const order = Array.from(tr.probs).map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 3);
        const px = tall ? ix + S + 14 : ix;
        const py = tall ? iy + 16 : iy + S + 22;
        const bw = tall ? w - px - 50 : S - 50;
        label(ctx, `label: ${CIFAR_CLASSES[A.test.labels[idx]!]}`, px, py, { font: FONT.ui(12, 600), color: color('gold') });
        order.forEach(([v, c], r) => {
          const y = py + 12 + r * 20;
          label(ctx, CIFAR_CLASSES[c]!, px, y + 11, { font: FONT.ui(11.5), color: color('--ink-2') });
          ctx.fillStyle = withAlpha(color('purple'), r === 0 ? 0.75 : 0.35);
          ctx.fillRect(px + 42, y + 2, Math.max(1, (bw - 42) * v), 12);
          label(ctx, `${Math.round(v * 100)}%`, px + 46 + (bw - 42) * v, y + 12, { font: FONT.mono(11), color: color('--ink-2') });
        });
        // small multiples
        const gx0 = tall ? 52 : ix + S + 58;
        const gy0 = tall ? iy + S + 34 : iy + 14;
        const gap = 5;
        const t = Math.floor(Math.min((w - gx0 - 6 - gap * 5) / 6, tall ? 60 : 52));
        grid = { x: gx0, y: gy0, t, gap };
        COLS.forEach((c, j) => label(ctx, c, gx0 + j * (t + gap) + t / 2, gy0 - 6, { font: FONT.ui(11, j === sel.col ? 700 : 500), align: 'center', color: j === sel.col ? color('purple') : color('--ink-3') }));
        for (let l = 0; l < m.L; l++) {
          label(ctx, `layer ${l + 1}`, gx0 - 6, gy0 + l * (t + gap) + t / 2 + 4, { font: FONT.ui(11, l === sel.l ? 700 : 500), align: 'right', color: l === sel.l ? color('purple') : color('--ink-3') });
          for (let j = 0; j < 6; j++) {
            const x = gx0 + j * (t + gap), y = gy0 + l * (t + gap);
            tile(ctx, clsMap(m, tr, l, j), m.G, x, y, t, 'purple');
            if (l === sel.l && j === sel.col) {
              ctx.strokeStyle = color('purple');
              ctx.lineWidth = 2.5;
              ctx.strokeRect(x - 1.5, y - 1.5, t + 3, t + 3);
            }
          }
        }
        ctx.strokeStyle = color('--rule');
        ctx.lineWidth = 1;
        const sx = gx0 + 5 * (t + gap) - gap / 2;
        ctx.beginPath();
        ctx.moveTo(sx, gy0 - 2);
        ctx.lineTo(sx, gy0 + 6 * (t + gap) - gap);
        ctx.stroke();
        fit(cv.canvas, w, hh, Math.max(gy0 + 6 * (t + gap), iy + S, py + 72) + 6);
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        if (!A) return;
        const tr = traceOf(A, A.vit, idx);
        const c = argmax(tr.probs);
        f.code.setMany({
          l: sel.l + 1,
          hs: sel.col >= 4 ? ':' : `${sel.col}:${sel.col + 1}`,
          nh: sel.col >= 4 ? 4 : 1,
          pred: `"${CIFAR_CLASSES[c]}"`,
          conf: `${Math.round(tr.probs[c]! * 100)}%`,
        });
        f.code.highlight(sel.col === 5 ? ['fwd', 'roll'] : ['fwd', 'sel']);
        cv.redraw();
      };
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const x = e.clientX - r.left - grid.x, y = e.clientY - r.top - grid.y;
        const j = Math.floor(x / (grid.t + grid.gap)), l = Math.floor(y / (grid.t + grid.gap));
        if (x < 0 || y < 0 || j > 5 || l > 5) return;
        sel = { l, col: j };
        sync();
      });
      loadAssets()
        .then((a) => {
          A = a;
          thumbs(f, a.test, SHOW, idx, (id) => {
            idx = id;
            sync();
          });
          sync();
        })
        .catch((e) => f.status(`Could not load the model: ${(e as Error).message}`));
    },
    caption: `Each small square is the class token's row of attention weights in one layer and head, laid back on the 8 × 8 patch grid (bright = more weight; every map is stretched from its own smallest to its largest weight, because many are nearly flat). The big image is the selected square, drawn as a veil: patches the class token ignores go dark. **Tap any square.** The last column, *rollout* (Abnar and Zuidema, 2020), chains the layers together, counting the residual path as half of each step, to estimate how much of the final class token traces back to each input patch. In this model it often picks out the object; try the deer, the ship and the frog. Single heads can look strange: what a head reads in layer 5 has already been mixed by the layers below.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: what the position embeddings learned                            */
/* ------------------------------------------------------------------ */

let INIT: Float32Array | null = null;
/** Position embeddings at initialization: N(0, 0.02^2), as in training. */
export function initPos(rows: number, d: number): Float32Array {
  if (INIT) return INIT;
  const r = new Rng(10);
  INIT = Float32Array.from({ length: rows * d }, () => r.randn() * 0.02);
  return INIT;
}

/** Cosine similarity between the position embeddings of patch slots (class slot dropped): N x N. */
export function posSimilarity(pos: Float32Array, N: number, D: number): Float32Array {
  const U = new Float32Array(N * D);
  for (let i = 0; i < N; i++) {
    let n = 0;
    for (let k = 0; k < D; k++) n += pos[(i + 1) * D + k]! ** 2;
    n = Math.sqrt(n) || 1;
    for (let k = 0; k < D; k++) U[i * D + k] = pos[(i + 1) * D + k]! / n;
  }
  const S = new Float32Array(N * N);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      let s = 0;
      for (let k = 0; k < D; k++) s += U[i * D + k]! * U[j * D + k]!;
      S[i * N + j] = s;
    }
  return S;
}

export function figPosSimilarity(p: Page): void {
  p.figure({
    title: 'What the position embeddings learned',
    codeTitle: 'pos_similarity.py',
    code: `
      E_pos = vit.E_pos[1:]       # (64, 64): one row per slot  #@pos
      # {{when:after training}}
      U = E_pos / np.linalg.norm(E_pos, axis=1, keepdims=True)
      sim = U @ U.T               # (64, 64) cosine similarity  #@sim
      t = sim[{{i:27}}].reshape(8, 8)  # slot {{i}}: row {{r:3}}, col {{c:3}}  #@tile
      # mean sim to its 4 neighbors: {{nb:…}}
      # mean sim to slots 4+ apart:  {{far:…}}
    `,
    setup(f) {
      let A: Assets | null = null;
      let trained = true;
      let sel = 27;
      let geo = { x: 0, y: 0, t: 1, gap: 1 };
      let sims: { tr: Float32Array; init: Float32Array } | null = null;
      const nbRo = f.readout('neighbors');
      const farRo = f.readout('far apart');
      const cv = f.canvas(360, 400, (ctx, w, hh) => {
        const tall = isTall(w);
        if (!A || !sims) {
          label(ctx, 'Loading the trained tiny ViT…', w / 2, hh / 2, { align: 'center' });
          return;
        }
        const S = trained ? sims.tr : sims.init;
        const G = 8;
        const gap = 4;
        const big = tall ? 0 : Math.min(200, w * 0.32);
        const gw = Math.min(400, w - (big ? big + 40 : 12));
        const t = (gw - gap * (G - 1)) / G;
        const gx = tall ? (w - gw) / 2 : 6;
        const gy = 22;
        geo = { x: gx, y: gy, t, gap };
        label(ctx, trained ? 'similarity of each slot to every slot, after training' : 'the same at initialization: random vectors', gx, 13, { font: FONT.ui(12, 600), color: color('red') });
        const col = diverging('blue', 'red');
        for (let i = 0; i < 64; i++) {
          const x = gx + (i % G) * (t + gap), y = gy + Math.floor(i / G) * (t + gap);
          heatmap(ctx, S.subarray(i * 64, (i + 1) * 64), G, G, x, y, t, t, col, 1);
          if (i === sel) {
            ctx.strokeStyle = color('--ink');
            ctx.lineWidth = 2.5;
            ctx.strokeRect(x - 2, y - 2, t + 4, t + 4);
          }
        }
        const bar = (bx: number, cy: number, bw: number) => {
          for (let q = 0; q < 100; q++) {
            const [r, g, b] = col(q / 49.5 - 1);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(bx + (q * bw) / 100, cy, bw / 100 + 0.5, 10);
          }
          label(ctx, '−1', bx, cy + 24, { font: FONT.mono(11), color: color('--ink-3') });
          label(ctx, 'cosine similarity', bx + bw / 2, cy + 24, { font: FONT.ui(11.5), align: 'center', color: color('--ink-3') });
          label(ctx, '+1', bx + bw, cy + 24, { font: FONT.mono(11), align: 'right', color: color('--ink-3') });
          return cy + 30;
        };
        let bottom = gy + gw;
        if (big) {
          const bx = w - big - 8, by = gy + 10;
          label(ctx, `slot ${sel}: row ${Math.floor(sel / 8)}, column ${sel % 8}`, bx, by - 4, { font: FONT.ui(12, 600), color: color('--ink') });
          heatmap(ctx, S.subarray(sel * 64, (sel + 1) * 64), G, G, bx, by + 4, big, big, col, 1);
          const cs = big / G;
          ctx.strokeStyle = color('--ink');
          ctx.lineWidth = 2;
          ctx.strokeRect(bx + (sel % G) * cs + 1, by + 4 + Math.floor(sel / G) * cs + 1, cs - 2, cs - 2);
          bottom = Math.max(bottom, bar(bx, by + big + 22, big));
        } else {
          const bw = Math.min(240, w - 12);
          bottom = bar((w - bw) / 2, gy + gw + 14, bw);
        }
        fit(cv.canvas, w, hh, bottom + 6);
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        if (!sims) return;
        const S = trained ? sims.tr : sims.init;
        let nb = 0, nn = 0, far = 0, nf = 0;
        const r0 = Math.floor(sel / 8), c0 = sel % 8;
        for (let j = 0; j < 64; j++) {
          const d = Math.hypot(Math.floor(j / 8) - r0, (j % 8) - c0);
          if (d === 1) { nb += S[sel * 64 + j]!; nn++; }
          if (d >= 4) { far += S[sel * 64 + j]!; nf++; }
        }
        f.code.setMany({ when: trained ? 'after training' : 'at initialization', i: sel, r: r0, c: c0, nb: fmt(nb / nn, 2), far: nf ? fmt(far / nf, 2) : 'none' });
        nbRo.set(fmt(nb / nn, 2));
        farRo.set(nf ? fmt(far / nf, 2) : '–');
        f.code.highlight('tile');
        cv.redraw();
      };
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const x = e.clientX - r.left - geo.x, y = e.clientY - r.top - geo.y;
        const cx = Math.floor(x / (geo.t + geo.gap)), cy = Math.floor(y / (geo.t + geo.gap));
        if (x < 0 || y < 0 || cx > 7 || cy > 7) return;
        sel = cy * 8 + cx;
        sync();
      });
      f.segmented({
        label: 'embeddings',
        options: [
          { value: 'tr', label: 'after training' },
          { value: 'init', label: 'at initialization' },
        ],
        value: 'tr',
        onChange: (v) => {
          trained = v === 'tr';
          sync();
        },
      });
      loadAssets()
        .then((a) => {
          A = a;
          sims = { tr: posSimilarity(a.vit.pos, 64, a.vit.D), init: posSimilarity(initPos(65, a.vit.D), 64, a.vit.D) };
          sync();
        })
        .catch((e) => f.status(`Could not load the model: ${(e as Error).message}`));
    },
    caption: `Each small square belongs to one slot of the 8 × 8 patch grid and shows how similar that slot's learned position vector is to every other slot's (red: similar, blue: opposite). **Tap a square** to inspect it. Nobody told the model the patches form a grid: it received 64 unrelated random vectors and a list. Training alone pulled neighboring slots together and gave rows and columns a shared signature. Switch to *at initialization* to see where it started.`,
  });
}
