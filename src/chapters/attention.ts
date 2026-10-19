import type { ChapterDef } from './index';
import type { Page } from '../core/page';
import { fmt } from '../core/code';
import { loadCifar } from '../core/data';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { FEAT_NAMES, bilinear, cellFeatures, cifarRGB, drawRGB, softmax, type RGB } from '../lib/attention-img';
import { ATTENTION_SYMBOLS } from '../lib/attention-symbols';
import { arrow, rbox, text } from '../lib/rnn-draw';

const IMGS = [
  { value: 'ship', label: 'ship', idx: 15 },
  { value: 'horse', label: 'horse', idx: 60 },
  { value: 'plane', label: 'airplane', idx: 126 },
];
const G = 8;
/** Hand-set queries in the five-feature space: [bright, blue, green, warm, texture]. */
const WORDS: Record<string, number[]> = {
  sky: [1, 0.8, -0.3, -0.5, -1],
  water: [-0.6, 1, 0, -0.4, 0],
  grass: [0, -0.3, 1, 0, 0.3],
  object: [0, -0.5, -0.3, 0.3, 1],
};

let images: Record<string, RGB> | null = null;
let imagesP: Promise<Record<string, RGB>> | null = null;
function loadImages(): Promise<Record<string, RGB>> {
  imagesP ??= loadCifar().then(({ test }) => {
    images = Object.fromEntries(IMGS.map((m) => [m.value, cifarRGB(test, m.idx)]));
    return images;
  });
  return imagesP;
}

/** Resizes a fixed-aspect canvas to `need` px tall; returns true when it did (the redraw follows). */
function fitHeight(canvas: HTMLCanvasElement, w: number, h: number, need: number): boolean {
  if (Math.abs(need - h) <= 2) return false;
  canvas.style.aspectRatio = `${w} / ${need}`;
  return true;
}

/** Side-by-side image and panel on wide canvases, stacked on narrow ones. */
function splitLayout(w: number, panelH: number) {
  const narrow = w < 440;
  const S = narrow ? Math.min(w * 0.72, 260) : Math.min(w * 0.55, 300);
  return narrow
    ? { narrow, S, ix: (w - S) / 2, iy: 4, px: 4, py: S + 16, pw: w - 8, need: S + 22 + panelH }
    : { narrow, S, ix: 4, iy: 4, px: S + 22, py: 6, pw: w - S - 26, need: Math.max(S + 8, panelH + 8) };
}

/** Bars for the 5 features: optional outlined bar (query) and filled bar (context). */
function featureBars(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rowH: number, filled: number[] | null, outline: number[] | null, fillCol: string, lit: boolean) {
  const lab = 54;
  const mid = x + lab + (w - lab) / 2;
  const half = (w - lab) / 2 - 4;
  const sc = (v: number) => Math.max(-1, Math.min(1, v / 2)) * half;
  ctx.strokeStyle = withAlpha(color('--ink-3'), 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mid, y - 2);
  ctx.lineTo(mid, y + rowH * FEAT_NAMES.length);
  ctx.stroke();
  FEAT_NAMES.forEach((nm, d) => {
    const yy = y + d * rowH;
    text(ctx, nm, x + lab - 6, yy + rowH / 2, { size: 11, color: color('--ink-2'), align: 'right' });
    if (filled) {
      const v = sc(filled[d]!);
      rbox(ctx, Math.min(mid, mid + v), yy + rowH * 0.2, Math.max(1.5, Math.abs(v)), rowH * 0.6, 3, withAlpha(fillCol, lit ? 0.8 : 0.35), null);
    }
    if (outline) {
      const v = sc(outline[d]!);
      ctx.strokeStyle = color('slate');
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(Math.min(mid, mid + v), yy + rowH * 0.12, Math.max(1.5, Math.abs(v)), rowH * 0.76);
      ctx.setLineDash([]);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Fig: soft attention over a grid                                      */
/* ------------------------------------------------------------------ */

function figSoftAttention(p: Page): void {
  p.figure({
    title: 'Soft attention: scores, softmax, weighted sum',
    codeTitle: 'soft_attention.py',
    code: `
      feats = conv_features(U)       # (64, 5): an 8x8 grid, 5 numbers each
      q = np.dot(Wa, h)              # what the RNN wants to see next   #@q
      # q = [{{q:…}}]   ("{{word:sky}}")
      scores = np.dot(feats, q) * {{beta:2}}   # one score per location #@e
      alpha = np.exp(scores - scores.max())                           #@a
      alpha = alpha / alpha.sum()    # positive, sums to 1             #@a
      z = np.dot(alpha, feats)       # (5,) weighted average of feats  #@z
      # z = [{{z:…}}]
    `,
    setup(f) {
      let img = 'horse';
      let word = 'sky';
      let q = WORDS.sky!;
      let beta = 2;
      let stage = 0;
      let st = { feats: [] as number[][], colors: [] as [number, number, number][] };
      let scores: number[] = [];
      let alpha: number[] = [];
      let z: number[] = [0, 0, 0, 0, 0];
      let L = splitLayout(640, 150);
      const compute = () => {
        if (!images) return;
        st = cellFeatures(images[img]!, G);
        scores = st.feats.map((v) => v.reduce((a, x, d) => a + x * q[d]!, 0) * beta);
        alpha = softmax(scores);
        z = [0, 1, 2, 3, 4].map((d) => st.feats.reduce((a, v, i) => a + alpha[i]! * v[d]!, 0));
      };
      const cv = f.canvas(640, 330, (ctx, w, h) => {
        if (!images || !alpha.length) return;
        L = splitLayout(w, 150);
        if (fitHeight(cv.canvas, w, h, L.need)) return;
        const { S, ix, iy } = L;
        drawRGB(ctx, images[img]!, 32, 32, ix, iy, S);
        const cs = S / G;
        const amax = Math.max(...alpha);
        const smax = Math.max(...scores.map(Math.abs));
        let best = 0;
        alpha.forEach((a, i) => a > alpha[best]! && (best = i));
        for (let i = 0; i < G * G; i++) {
          const x = ix + (i % G) * cs, y = iy + Math.floor(i / G) * cs;
          if (stage === 0) {
            const v = scores[i]! / smax;
            ctx.fillStyle = v >= 0 ? withAlpha(color('purple'), 0.6 * v) : `rgba(0,0,0,${-0.45 * v})`;
            ctx.fillRect(x, y, cs, cs);
            if (cs >= 30) text(ctx, fmt(scores[i]!, 2), x + cs / 2, y + cs / 2, { font: 'mono', size: 11, weight: 600, color: '#fff' });
          } else {
            ctx.fillStyle = `rgba(0,0,0,${0.82 * (1 - Math.sqrt(alpha[i]! / amax))})`;
            ctx.fillRect(x, y, cs, cs);
            if (cs >= 30 && alpha[i]! >= 0.01) text(ctx, `${Math.round(alpha[i]! * 100)}%`, x + cs / 2, y + cs / 2, { font: 'mono', size: 11, weight: 600, color: '#fff' });
          }
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 1; k < G; k++) {
          ctx.moveTo(ix + k * cs, iy);
          ctx.lineTo(ix + k * cs, iy + S);
          ctx.moveTo(ix, iy + k * cs);
          ctx.lineTo(ix + S, iy + k * cs);
        }
        ctx.stroke();
        rbox(ctx, ix + (best % G) * cs, iy + Math.floor(best / G) * cs, cs, cs, 2, null, color('teal'), 2.5);
        // panel: the query (dashed) and the context z (filled)
        const { px, py, pw } = L;
        text(ctx, 'query q (dashed) and context z', px, py + 7, { size: 11.5, weight: 600, color: color('--ink-2'), align: 'left' });
        featureBars(ctx, px, py + 18, pw, 19, z, q, color('gold'), stage === 2);
        const sy = py + 18 + 19 * 5 + 8;
        const avg = [0, 1, 2].map((c) => st.colors.reduce((a, col, i) => a + alpha[i]! * col[c]!, 0));
        rbox(ctx, px + 54, sy, 30, 22, 5, `rgb(${avg.map((v) => Math.round(v)).join(',')})`, color('--rule'), 1);
        text(ctx, 'average color', px + 92, sy + 11, { size: 11, color: color('--ink-3'), align: 'left' });
      });
      cv.canvas.style.touchAction = 'pan-y';
      cv.canvas.addEventListener('click', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const cs = L.S / G;
        const gx = Math.floor((e.clientX - r.left - L.ix) / cs), gy = Math.floor((e.clientY - r.top - L.iy) / cs);
        if (gx < 0 || gy < 0 || gx >= G || gy >= G || !st.feats.length) return;
        q = [...st.feats[gy * G + gx]!];
        word = 'cell';
        wordSeg.set('cell', false);
        sync();
      });
      const sync = () => {
        compute();
        f.code.setMany({
          q: q.map((v) => fmt(v, 2)).join(', '),
          word: word === 'cell' ? 'the cell you tapped' : word,
          z: z.map((v) => fmt(v, 2)).join(', '),
        });
        f.code.highlight((['e', 'a', 'z'] as const)[stage]);
        cv.redraw();
      };
      const stepper = f.stepper({
        steps: 3,
        interval: 1300,
        label: (k) => ['1. scores', '2. softmax', '3. weighted sum'][k]!,
        onStep: (k) => {
          stage = k;
          sync();
        },
      });
      queueMicrotask(() => stepper.go(2));
      const wordSeg = f.segmented({
        label: 'the next word is about',
        options: [...Object.keys(WORDS).map((k) => ({ value: k, label: k })), { value: 'cell', label: 'your tap' }],
        value: 'sky',
        onChange: (v) => {
          word = v;
          if (v !== 'cell') q = WORDS[v]!;
          sync();
        },
      });
      f.segmented({
        label: 'image',
        options: IMGS.map((m) => ({ value: m.value, label: m.label })),
        value: img,
        onChange: (v) => {
          img = v;
          if (word === 'cell') {
            word = 'sky';
            q = WORDS.sky!;
            wordSeg.set('sky', false);
          }
          sync();
        },
      });
      f.slider({
        label: 'sharpness',
        min: 0.2,
        max: 6,
        step: 0.1,
        value: 2,
        slot: 'beta',
        onInput: (v) => {
          beta = v;
          sync();
        },
      });
      f.status('Loading CIFAR-10 images…');
      loadImages()
        .then(() => {
          f.status('');
          sync();
        })
        .catch((e) => f.status(`Could not load images: ${(e as Error).message}`));
    },
    caption: `A real CIFAR-10 image cut into an $8 \\times 8$ grid. To keep it small enough to see, each cell's "feature vector" $\\symv_i$ is five hand-made numbers (brightness, blueness, greenness, warmth, texture) standing in for the 512 learned numbers of a real conv layer. Pick what the next word is about: that sets the query $q$, and the three steps run. **Scores** (purple: high, dark: low), then **softmax** (bright cells get the attention, the teal box is the winner), then the **weighted sum** $\\symz$, shown as bars next to the query. **Tap any cell** to use its own features as the query and light up everything that looks like it. Lower the sharpness and the attention spreads out; raise it and it locks onto one cell. (Five hand-made numbers cannot tell a pale sky from pale water; a real network learns hundreds of features and can.)`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: soft vs hard attention                                          */
/* ------------------------------------------------------------------ */

function figHardAttention(p: Page): void {
  p.figure({
    title: 'Soft attention averages; hard attention picks one',
    codeTitle: 'soft_vs_hard.py',
    code: `
      alpha = softmax(np.dot(feats, q) * 2)    # same as before
      # soft: the expectation, deterministic and differentiable
      z_soft = np.dot(alpha, feats)                         #@soft
      # hard: sample one location and use only its features
      i = np.random.choice(64, p=alpha)                     #@hard
      z_hard = feats[i]                                     #@hard
      # z_soft                    = [{{zs:…}}]
      # mean of {{n:0}} hard samples  = [{{mean:…}}]
    `,
    setup(f) {
      let img = 'horse';
      let word = 'grass';
      let st = { feats: [] as number[][], colors: [] as [number, number, number][] };
      let alpha: number[] = [];
      let zs: number[] = [0, 0, 0, 0, 0];
      const samples: { i: number; jx: number; jy: number }[] = [];
      const rng = new Rng(4);
      const compute = () => {
        if (!images) return;
        st = cellFeatures(images[img]!, G);
        const q = WORDS[word]!;
        alpha = softmax(st.feats.map((v) => v.reduce((a, x, d) => a + x * q[d]!, 0) * 2));
        zs = [0, 1, 2, 3, 4].map((d) => st.feats.reduce((a, v, i) => a + alpha[i]! * v[d]!, 0));
      };
      const mean = () => (samples.length ? [0, 1, 2, 3, 4].map((d) => samples.reduce((a, s) => a + st.feats[s.i]![d]!, 0) / samples.length) : null);
      const cv = f.canvas(640, 330, (ctx, w, h) => {
        if (!images || !alpha.length) return;
        const L = splitLayout(w, 150);
        if (fitHeight(cv.canvas, w, h, L.need)) return;
        const { S, ix, iy, px, py, pw } = L;
        drawRGB(ctx, images[img]!, 32, 32, ix, iy, S);
        const cs = S / G;
        const amax = Math.max(...alpha);
        for (let i = 0; i < G * G; i++) {
          ctx.fillStyle = `rgba(0,0,0,${0.75 * (1 - Math.sqrt(alpha[i]! / amax))})`;
          ctx.fillRect(ix + (i % G) * cs, iy + Math.floor(i / G) * cs, cs, cs);
        }
        samples.slice(-200).forEach((s, k, arr) => {
          const x = ix + ((s.i % G) + 0.5 + s.jx) * cs, y = iy + (Math.floor(s.i / G) + 0.5 + s.jy) * cs;
          ctx.beginPath();
          ctx.arc(x, y, k === arr.length - 1 ? 5 : 3, 0, Math.PI * 2);
          ctx.fillStyle = k === arr.length - 1 ? color('--accent') : '#fff';
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
        text(ctx, 'z_soft (gold) vs mean of hard picks (teal)', px, py + 7, { size: 11.5, weight: 600, color: color('--ink-2'), align: 'left' });
        featureBars(ctx, px, py + 18, pw, 19, zs, null, color('gold'), true);
        const m = mean();
        if (m) {
          const lab = 54, mid = px + lab + (pw - lab) / 2, half = (pw - lab) / 2 - 4;
          m.forEach((v, d) => {
            const xx = mid + Math.max(-1, Math.min(1, v / 2)) * half;
            const yy = py + 18 + d * 19;
            ctx.strokeStyle = color('teal');
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(xx, yy + 1);
            ctx.lineTo(xx, yy + 18);
            ctx.stroke();
          });
        }
        if (samples.length) {
          const last = samples[samples.length - 1]!;
          text(ctx, `last pick: cell (${last.i % G}, ${Math.floor(last.i / G)}), alpha = ${(alpha[last.i]! * 100).toFixed(1)}%`, px, py + 18 + 19 * 5 + 14, { size: 11, color: color('--ink-3'), align: 'left' });
        }
      });
      cv.canvas.classList.add('scroll-ok');
      const nRo = f.readout('hard samples');
      const sync = (hl: string | null = null) => {
        compute();
        const m = mean();
        f.code.setMany({ zs: zs.map((v) => fmt(v, 2)).join(', '), n: samples.length, mean: m ? m.map((v) => fmt(v, 2)).join(', ') : '…' });
        nRo.set(samples.length);
        f.code.highlight(hl);
        cv.redraw();
      };
      const draw = (k: number) => {
        for (let t = 0; t < k; t++) {
          let u = rng.next();
          let i = alpha.length - 1;
          for (let j = 0; j < alpha.length; j++) {
            u -= alpha[j]!;
            if (u <= 0) {
              i = j;
              break;
            }
          }
          samples.push({ i, jx: (rng.next() - 0.5) * 0.6, jy: (rng.next() - 0.5) * 0.6 });
        }
        sync('hard');
      };
      f.button('Pick 1', () => draw(1), { primary: true });
      f.button('Pick 25', () => draw(25));
      f.button('Clear', () => {
        samples.length = 0;
        sync('soft');
      });
      f.segmented({
        label: 'word',
        options: Object.keys(WORDS).map((k) => ({ value: k, label: k })),
        value: word,
        onChange: (v) => {
          word = v;
          samples.length = 0;
          sync('soft');
        },
      });
      f.segmented({
        label: 'image',
        options: IMGS.map((m) => ({ value: m.value, label: m.label })),
        value: img,
        onChange: (v) => {
          img = v;
          samples.length = 0;
          sync('soft');
        },
      });
      loadImages().then(() => sync('soft')).catch(() => {});
    },
    caption: `The same attention distribution, used two ways. **Soft** attention computes the gold bars directly: the average of all 64 feature vectors, weighted by $\\symalpha$. **Hard** attention rolls a 64-sided die loaded by $\\symalpha$ and looks only at the cell it lands on (the dots). Each pick is noisy, but press **Pick 25** a few times and the teal marks, the average of the picks, close in on the gold bars: soft attention is the *expected value* of hard attention.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: DRAW's Gaussian read                                            */
/* ------------------------------------------------------------------ */

function figDraw(p: Page): void {
  const N = 6;
  p.figure({
    title: "DRAW's read: a grid of Gaussian filters",
    codeTitle: 'draw_read.py',
    code: `
      N = 6
      gX, gY = {{gx:16}}, {{gy:16}}      # grid center, in pixels
      delta, sigma = {{delta:3}}, {{sigma:1}}   # stride and blur
      i = np.arange(1, N + 1)
      mu_x = gX + (i - N / 2 - 0.5) * delta     # filter centers  #@mu
      mu_y = gY + (i - N / 2 - 0.5) * delta                       #@mu
      a = np.arange(32)
      Fx = np.exp(-(a - mu_x[:, None])**2 / (2 * sigma**2))   # (N, 32) #@F
      Fx = Fx / Fx.sum(axis=1, keepdims=True)   # rows sum to 1        #@F
      Fy = np.exp(-(a - mu_y[:, None])**2 / (2 * sigma**2))           #@F
      Fy = Fy / Fy.sum(axis=1, keepdims=True)                          #@F
      glimpse = np.dot(np.dot(Fy, U), Fx.T)     # (N, N) per channel   #@read
    `,
    setup(f) {
      let img = 'horse';
      let gx = 16, gy = 16, delta = 3, sigma = 1;
      let glimpse = new Float32Array(N * N * 3);
      const bank = (g: number) => {
        const F: number[][] = [];
        for (let i = 1; i <= N; i++) {
          const mu = g + (i - N / 2 - 0.5) * delta;
          const row = Array.from({ length: 32 }, (_, a) => Math.exp(-((a - mu) ** 2) / (2 * sigma * sigma)));
          const s = row.reduce((x, y) => x + y, 0) + 1e-9;
          F.push(row.map((v) => v / s));
        }
        return F;
      };
      const compute = () => {
        if (!images) return;
        const U = images[img]!;
        const Fx = bank(gx), Fy = bank(gy);
        glimpse = new Float32Array(N * N * 3);
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (let ch = 0; ch < 3; ch++) {
          let s = 0;
          for (let y = 0; y < 32; y++) {
            const wy = Fy[r]![y]!;
            if (wy < 1e-5) continue;
            for (let x = 0; x < 32; x++) s += wy * Fx[c]![x]! * U[(y * 32 + x) * 3 + ch]!;
          }
          glimpse[(r * N + c) * 3 + ch] = s;
        }
      };
      let lay = { ix: 0, iy: 0, S: 1 };
      const cv = f.canvas(640, 320, (ctx, w, h) => {
        if (!images) return;
        const narrow = w < 440;
        const S = narrow ? Math.min(w * 0.6, 220) : Math.min(w * 0.5, 280);
        const gS = narrow ? Math.min(w - S - 24, S * 0.62) : Math.min(w - S - 40, S * 0.75);
        const need = S + 26;
        if (fitHeight(cv.canvas, w, h, need)) return;
        const ix = 4, iy = 4;
        lay = { ix, iy, S };
        drawRGB(ctx, images[img]!, 32, 32, ix, iy, S);
        const k = S / 32;
        const px = (v: number) => ix + (v + 0.5) * k;
        const py = (v: number) => iy + (v + 0.5) * k;
        const lo = (g: number) => g + (1 - N / 2 - 0.5) * delta;
        const hi = (g: number) => g + (N - N / 2 - 0.5) * delta;
        ctx.strokeStyle = color('--accent');
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(px(lo(gx) - sigma), py(lo(gy) - sigma), (hi(gx) - lo(gx) + 2 * sigma) * k, (hi(gy) - lo(gy) + 2 * sigma) * k);
        ctx.setLineDash([]);
        for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) {
          const mx = gx + (i - N / 2 - 0.5) * delta, my = gy + (j - N / 2 - 0.5) * delta;
          ctx.beginPath();
          ctx.arc(px(mx), py(my), Math.max(1.5, sigma * k), 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(px(mx), py(my), 2.2, 0, Math.PI * 2);
          ctx.fillStyle = color('--accent');
          ctx.fill();
        }
        const gxp = ix + S + (w - ix - S - gS) / 2;
        const gyp = iy + (S - gS) / 2;
        arrow(ctx, ix + S + 4, iy + S / 2, gxp - 6, iy + S / 2, color('--ink-3'), 1.5);
        drawRGB(ctx, glimpse, N, N, gxp, gyp, gS);
        text(ctx, `${N}×${N} glimpse`, gxp + gS / 2, gyp + gS + 12, { size: 11.5, color: color('--ink-2') });
        text(ctx, 'drag to move the grid', ix, iy + S + 13, { size: 11, color: color('--ink-3'), align: 'left' });
      });
      let drag = false;
      const move = (e: PointerEvent) => {
        const r = cv.canvas.getBoundingClientRect();
        gx = Math.max(0, Math.min(31, (e.clientX - r.left - lay.ix) / (lay.S / 32) - 0.5));
        gy = Math.max(0, Math.min(31, (e.clientY - r.top - lay.iy) / (lay.S / 32) - 0.5));
        sync();
      };
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        if (e.clientX - r.left > lay.ix + lay.S) return;
        drag = true;
        cv.canvas.setPointerCapture(e.pointerId);
        move(e);
      });
      cv.canvas.addEventListener('pointermove', (e) => drag && move(e));
      cv.canvas.addEventListener('pointerup', () => (drag = false));
      const sync = () => {
        compute();
        f.code.setMany({ gx: fmt(gx, 3), gy: fmt(gy, 3) });
        f.code.highlight(['mu', 'read']);
        cv.redraw();
      };
      f.slider({ label: 'stride δ', min: 0.5, max: 6, step: 0.1, value: 3, slot: 'delta', onInput: (v) => { delta = v; sync(); } });
      f.slider({ label: 'blur σ', min: 0.3, max: 4, step: 0.1, value: 1, slot: 'sigma', onInput: (v) => { sigma = v; sync(); } });
      f.segmented({
        label: 'image',
        options: IMGS.map((m) => ({ value: m.value, label: m.label })),
        value: img,
        onChange: (v) => {
          img = v;
          sync();
        },
      });
      loadImages().then(() => sync()).catch(() => {});
    },
    caption: `Each orange dot is the center of one Gaussian filter; the white rings show its blur $\\sigma$. The ${N}×${N} glimpse on the right is what the network reads: every glimpse pixel is a blurred average of the image around one dot. **Drag** on the image to move the grid, widen the **stride** to see the whole image at low resolution, shrink it to zoom in on a detail, and raise the **blur** to smooth the read. Every number here is a smooth function of $g_X, g_Y, \\delta, \\sigma$, so backprop can learn where to look.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: spatial transformer                                             */
/* ------------------------------------------------------------------ */

function figSTN(p: Page): void {
  p.figure({
    title: 'A spatial transformer: grid generator and sampler',
    codeTitle: 'spatial_transformer.py',
    code: `
      theta = np.array([[{{a:1}}, {{b:0}}, {{tx:0}}],
                        [{{c:0}}, {{d:1}}, {{ty:0}}]])   # from the localization net  #@theta
      H, W = 32, 32
      ys, xs = np.meshgrid(np.linspace(-1, 1, H),
                           np.linspace(-1, 1, W), indexing='ij')
      target = np.stack([xs.ravel(), ys.ravel(), np.ones(H * W)])  # (3, HW) #@grid
      source = np.dot(theta, target)   # (2, HW): where each output pixel reads #@grid
      V = bilinear_sample(U, source).reshape(H, W, 3)                         #@sample
    `,
    setup(f) {
      let img = 'plane';
      let scale = 1, rot = 0, tx = 0, ty = 0, shear = 0;
      let theta = [1, 0, 0, 0, 1, 0];
      let out = new Float32Array(32 * 32 * 3);
      const lin = (k: number, n: number) => -1 + (2 * k) / (n - 1);
      const toPx = (v: number) => (v + 1) * 16 - 0.5;
      const compute = () => {
        const r = (rot * Math.PI) / 180;
        const c = Math.cos(r), s = Math.sin(r);
        // A = R(rot) [[scale, shear], [0, scale]]
        theta = [c * scale, c * shear - s * scale, tx, s * scale, s * shear + c * scale, ty];
        if (!images) return;
        const U = images[img]!;
        out = new Float32Array(32 * 32 * 3);
        const px = [0, 0, 0];
        for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) {
          const xt = lin(j, 32), yt = lin(i, 32);
          const xs = theta[0]! * xt + theta[1]! * yt + theta[2]!;
          const ys = theta[3]! * xt + theta[4]! * yt + theta[5]!;
          bilinear(U, 32, 32, toPx(xs), toPx(ys), px);
          out.set(px, (i * 32 + j) * 3);
        }
      };
      const cv = f.canvas(640, 320, (ctx, w, h) => {
        if (!images) return;
        const narrow = w < 440;
        const S = narrow ? (w - 30) / 2 : Math.min((w - 50) / 2, 260);
        const need = S + 30;
        if (fitHeight(cv.canvas, w, h, need)) return;
        const ix = 4, iy = 18;
        const ox = w - S - 4;
        text(ctx, 'input U and the sampling grid', ix, 8, { size: 11.5, color: color('--ink-2'), align: 'left' });
        text(ctx, 'output V', ox, 8, { size: 11.5, color: color('--ink-2'), align: 'left' });
        drawRGB(ctx, images[img]!, 32, 32, ix, iy, S);
        drawRGB(ctx, out, 32, 32, ox, iy, S);
        arrow(ctx, ix + S + 4, iy + S / 2, ox - 4, iy + S / 2, color('--ink-3'), 1.5);
        // the sampling grid: where a 9x9 subset of output pixels read from
        const n = 9;
        const P = (i: number, j: number): [number, number] => {
          const xt = lin(j, n), yt = lin(i, n);
          const xs = theta[0]! * xt + theta[1]! * yt + theta[2]!;
          const ys = theta[3]! * xt + theta[4]! * yt + theta[5]!;
          return [ix + ((xs + 1) / 2) * S, iy + ((ys + 1) / 2) * S];
        };
        ctx.save();
        ctx.beginPath();
        ctx.rect(ix - 3, iy - 3, S + 6, S + 6);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const [x, y] = P(i, j);
            if (j) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
        }
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            const [x, y] = P(i, j);
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
        }
        ctx.stroke();
        // outline of the sampled region, with the output's top-left corner marked
        ctx.strokeStyle = color('--accent');
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        [P(0, 0), P(0, n - 1), P(n - 1, n - 1), P(n - 1, 0)].forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.stroke();
        const [cx0, cy0] = P(0, 0);
        ctx.beginPath();
        ctx.arc(cx0, cy0, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = color('--accent');
        ctx.fill();
        ctx.restore();
        rbox(ctx, ox, iy, 9, 9, 2, color('--accent'), null);
      });
      cv.canvas.classList.add('scroll-ok');
      const sliders: { set(v: number, fire?: boolean): void }[] = [];
      const sync = () => {
        compute();
        f.code.setMany({ a: fmt(theta[0]!, 2), b: fmt(theta[1]!, 2), tx: fmt(theta[2]!, 2), c: fmt(theta[3]!, 2), d: fmt(theta[4]!, 2), ty: fmt(theta[5]!, 2) });
        f.code.highlight(['theta', 'grid']);
        cv.redraw();
      };
      sliders.push(f.slider({ label: 'scale', min: 0.3, max: 1.5, step: 0.01, value: 1, sym: 'theta', onInput: (v) => { scale = v; sync(); } }));
      sliders.push(f.slider({ label: 'rotation°', min: -180, max: 180, step: 1, value: 0, sym: 'theta', format: (v) => `${Math.round(v)}°`, onInput: (v) => { rot = v; sync(); } }));
      sliders.push(f.slider({ label: 'shift x', min: -1, max: 1, step: 0.01, value: 0, sym: 'theta', onInput: (v) => { tx = v; sync(); } }));
      sliders.push(f.slider({ label: 'shift y', min: -1, max: 1, step: 0.01, value: 0, sym: 'theta', onInput: (v) => { ty = v; sync(); } }));
      sliders.push(f.slider({ label: 'shear', min: -1, max: 1, step: 0.01, value: 0, sym: 'theta', onInput: (v) => { shear = v; sync(); } }));
      f.button('Zoom on center', () => {
        [0.5, 0, 0, 0, 0].forEach((v, k) => sliders[k]!.set(v, false));
        scale = 0.5; rot = 0; tx = 0; ty = 0; shear = 0;
        sync();
      });
      f.button('Reset', () => {
        [1, 0, 0, 0, 0].forEach((v, k) => sliders[k]!.set(v, false));
        scale = 1; rot = 0; tx = 0; ty = 0; shear = 0;
        sync();
      });
      f.segmented({
        label: 'image',
        options: IMGS.map((m) => ({ value: m.value, label: m.label })),
        value: img,
        onChange: (v) => {
          img = v;
          sync();
        },
      });
      loadImages().then(() => sync()).catch(() => {});
    },
    caption: `The six numbers of $\\symtheta$ (here set by sliders; in a real network, predicted by the localization net) map the output's regular grid onto a warped grid over the input (white lines; the orange outline is the region being read, its dot the output's top-left corner). Each output pixel is read from its grid point with bilinear sampling, so the output is that region, straightened out. Scale below 1 **zooms in**; rotate and the output rotates the other way, because the grid says where to *read*, not where to *write*. Grid points outside the image read zeros (black), and the overlay is cropped to the image.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: bilinear close-up                                               */
/* ------------------------------------------------------------------ */

function figBilinear(p: Page): void {
  const U = [
    [40, 200, 120],
    [90, 30, 250],
    [180, 140, 60],
  ];
  p.figure({
    title: 'Bilinear sampling, up close',
    codeTitle: 'bilinear.py',
    code: `
      U = np.array([[ 40, 200, 120],
                    [ 90,  30, 250],
                    [180, 140,  60]])   # a 3x3 patch of gray values
      x, y = {{x:0.6}}, {{y:0.3}}        # where the grid asks to read
      x0, y0 = int(x), int(y)
      x1, y1 = x0 + 1, y0 + 1
      wa = (x1 - x) * (y1 - y)   # top-left      {{wa:…}}  #@w
      wb = (x - x0) * (y1 - y)   # top-right     {{wb:…}}  #@w
      wc = (x1 - x) * (y - y0)   # bottom-left   {{wc:…}}  #@w
      wd = (x - x0) * (y - y0)   # bottom-right  {{wd:…}}  #@w
      V = (wa * U[y0, x0] + wb * U[y0, x1]
           + wc * U[y1, x0] + wd * U[y1, x1])   # {{v:…}}  #@v
      # slopes: dV/dx = {{gx:…}}, dV/dy = {{gy:…}}            #@g
    `,
    setup(f) {
      let x = 0.6, y = 0.3;
      let lay = { ox: 0, oy: 0, cell: 1 };
      const val = () => {
        const x0 = Math.floor(x), y0 = Math.floor(y), dx = x - x0, dy = y - y0;
        const w = [(1 - dx) * (1 - dy), dx * (1 - dy), (1 - dx) * dy, dx * dy];
        const c = [U[y0]![x0]!, U[y0]![x0 + 1]!, U[y0 + 1]![x0]!, U[y0 + 1]![x0 + 1]!];
        const v = w.reduce((a, wi, k) => a + wi * c[k]!, 0);
        const gx = (1 - dy) * (c[1]! - c[0]!) + dy * (c[3]! - c[2]!);
        const gy = (1 - dx) * (c[2]! - c[0]!) + dx * (c[3]! - c[1]!);
        return { x0, y0, dx, dy, w, c, v, gx, gy };
      };
      const cv = f.canvas(640, 400, (ctx, w, h) => {
        const cell = Math.min((h - 16) / 3, (w * 0.62) / 3);
        const ox = 6, oy = 6;
        lay = { ox, oy, cell };
        const B = val();
        const cx = (gx: number) => ox + (gx + 0.5) * cell;
        const cy = (gy: number) => oy + (gy + 0.5) * cell;
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
          const g = U[r]![c]!;
          ctx.fillStyle = `rgb(${g},${g},${g})`;
          ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
          ctx.strokeStyle = color('--rule');
          ctx.strokeRect(ox + c * cell, oy + r * cell, cell, cell);
        }
        // the four sub-rectangles between pixel centers: each corner's weight is the opposite area
        const X0 = cx(B.x0), Y0 = cy(B.y0), X1 = cx(B.x0 + 1), Y1 = cy(B.y0 + 1);
        const PX = cx(x), PY = cy(y);
        const cols = [color('blue'), color('orange'), color('green'), color('purple')];
        const rects: [number, number, number, number][] = [
          [PX, PY, X1, Y1], // opposite of top-left
          [X0, PY, PX, Y1], // opposite of top-right
          [PX, Y0, X1, PY], // opposite of bottom-left
          [X0, Y0, PX, PY], // opposite of bottom-right
        ];
        rects.forEach(([a, b, c2, d], k) => {
          ctx.fillStyle = withAlpha(cols[k]!, 0.45);
          ctx.fillRect(a, b, c2 - a, d - b);
          if ((c2 - a) > 30 && (d - b) > 18) text(ctx, B.w[k]!.toFixed(2), (a + c2) / 2, (b + d) / 2, { font: 'mono', size: 11.5, weight: 700, color: '#fff' });
        });
        ctx.strokeStyle = color('--accent');
        ctx.lineWidth = 1.5;
        ctx.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
        [[X0, Y0], [X1, Y0], [X0, Y1], [X1, Y1]].forEach(([a, b], k) => {
          ctx.beginPath();
          ctx.arc(a!, b!, 6, 0, Math.PI * 2);
          ctx.fillStyle = cols[k]!;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
        // gradient arrow: which way to move the point to make V brighter
        const gn = Math.hypot(B.gx, B.gy);
        if (gn > 1) {
          const L = cell * 0.55;
          arrow(ctx, PX, PY, PX + (B.gx / gn) * L, PY + (B.gy / gn) * L, color('red'), 2.5);
        }
        ctx.beginPath();
        ctx.arc(PX, PY, 7, 0, Math.PI * 2);
        ctx.fillStyle = color('--accent');
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        // result swatch
        const rx = ox + 3 * cell + 18;
        const rw = w - rx - 4;
        if (rw > 60) {
          text(ctx, 'sampled value V', rx, oy + 10, { size: 12, color: color('--ink-2'), align: 'left' });
          const g = Math.round(B.v);
          rbox(ctx, rx, oy + 22, Math.min(rw, 90), Math.min(rw, 90), 8, `rgb(${g},${g},${g})`, color('--rule'), 1);
          text(ctx, B.v.toFixed(1), rx, oy + 34 + Math.min(rw, 90), { font: 'mono', size: 14, weight: 700, color: color('--ink'), align: 'left' });
          ['red arrow:', 'the gradient', 'of V'].forEach((t, k) => text(ctx, t, rx, oy + 62 + k * 15 + Math.min(rw, 90), { size: 11, color: color('red'), align: 'left' }));
        }
      });
      let drag = false;
      const move = (e: PointerEvent) => {
        const r = cv.canvas.getBoundingClientRect();
        x = Math.max(0, Math.min(1.999, (e.clientX - r.left - lay.ox) / lay.cell - 0.5));
        y = Math.max(0, Math.min(1.999, (e.clientY - r.top - lay.oy) / lay.cell - 0.5));
        sync();
      };
      cv.canvas.addEventListener('pointerdown', (e) => {
        drag = true;
        cv.canvas.setPointerCapture(e.pointerId);
        move(e);
      });
      cv.canvas.addEventListener('pointermove', (e) => drag && move(e));
      cv.canvas.addEventListener('pointerup', () => (drag = false));
      const sync = () => {
        const B = val();
        f.code.setMany({
          x: fmt(x, 2), y: fmt(y, 2),
          wa: fmt(B.w[0]!, 3), wb: fmt(B.w[1]!, 3), wc: fmt(B.w[2]!, 3), wd: fmt(B.w[3]!, 3),
          v: fmt(B.v, 4), gx: fmt(B.gx, 3), gy: fmt(B.gy, 3),
        });
        f.code.highlight(['w', 'v']);
        cv.redraw();
      };
      sync();
    },
    caption: `Pixel centers sit at whole-number coordinates; the orange point is a fractional coordinate the grid wants to read. Its four neighbors (colored dots) each get a weight equal to the area of the rectangle *opposite* them (same color), so the closer neighbor counts more, and the four weights always sum to 1. **Drag the point.** The red arrow is the gradient of $\\symV$ with respect to the point's position: the direction that makes the output brighter. Because that gradient exists, backprop can tell the localization net which way to move its grid.`,
  });
}

/* ------------------------------------------------------------------ */
/* Chapter                                                              */
/* ------------------------------------------------------------------ */

const chapter: ChapterDef = {
  symbols: ATTENTION_SYMBOLS,

  render(p) {
    p.prose(`
The captioning RNN of the last chapter looks at its image exactly once. A ConvNet squeezes the whole picture into one vector, the vector nudges the RNN's first hidden state, and from then on the RNN writes from memory. Every word, whether it is "dog", "frisbee" or "grass", has to be dug out of that same summary.

This chapter, following Lecture 13 of the 2016 course, is about a better idea: let the network **choose where to look**, and look somewhere different for each step. We will meet two families of answers. **Soft attention** looks everywhere at once, but with weights, and turned out to be one of the most important ideas in deep learning. **Spatial transformers** learn to crop, zoom and straighten their input with a differentiable warp. Both have the same secret: they make *where to look* a smooth function, so plain backprop can learn it.`);

    p.h2('The bottleneck', 'bottleneck');
    p.prose(`
The same problem shows up in machine translation. The 2014 sequence-to-sequence models (Sutskever, Vinyals and Le) read the whole English sentence with one RNN, then hand its final hidden state, one fixed-size vector, to a second RNN that writes the French. A five-word sentence and a fifty-word sentence get the same number of numbers. Long sentences come out noticeably worse.

The fix in both cases: keep the whole input around, as a *set* of vectors instead of one. For an image, that is the grid of feature vectors from a conv layer, before the fully connected layers flatten it: each vector describes one region. For a sentence, it is the encoder's hidden state after each word. Then, at every output step, let the decoder pick out what it needs right now.`);
    p.callout('intuition', 'Think of describing a photo to a friend over the phone. You do not memorize the picture and then talk with your eyes closed; you glance back at the relevant part before each phrase: the dog, then the frisbee, then the grass. Attention gives the network that glance.');

    p.h2('Soft attention for captioning', 'soft-attention');
    p.prose(`
*Show, Attend and Tell* (Xu et al. 2015) turned this into a captioning model. Run the image through a ConvNet (VGG) and stop at the last convolutional layer, where the image is still a grid: $14 \\times 14$ locations with 512 numbers each. That gives $L = 196$ feature vectors $\\symv_1, \\dots, \\symv_L$, each describing one patch of the image. At every time step, the RNN does three small things.

First, it **scores** every location: how relevant is this patch to what I am about to say?`);
    p.math({
      label: 'Attention scores',
      tex: String.raw`\syme_i = f_{\text{att}}\big(\symv_i,\ \symh\big) \quad\text{for example}\quad \syme_i = \symv_i \cdot (W_a\,\symh)`,
      code: `
        q = np.dot(Wa, h)          # the question the RNN is asking
        scores = np.dot(feats, q)  # (L,) one score per location
      `,
      terms: [
        [String.raw`\symv_i`, 'the feature vector of location $i$ (one row of `feats`)'],
        [String.raw`\symh`, "the RNN's current hidden state: what it has said so far and what it is about to say"],
        [String.raw`f_{\text{att}}`, 'a small learned function. Xu et al. used a tiny neural network; the simplest choice is shown on the right'],
        [String.raw`\symv_i \cdot (W_a \symh)`, 'a *dot product*: multiply matching entries and add them up. Large when the location has the features the RNN is asking for'],
      ],
      explain: 'The hidden state is turned into a query (a wish list of features), and every location is graded by how well it matches. Nothing is chosen yet: these are just scores, one per location, like the class scores of Chapter 4.',
    });
    p.prose(`Second, it turns the scores into a **probability distribution** over locations, with the same softmax used for class scores:`);
    p.math({
      label: 'Attention weights',
      tex: String.raw`\symalpha_i = \frac{e^{\syme_i}}{\sum_{j=1}^{L} e^{\syme_j}}`,
      code: `
        alpha = np.exp(scores - scores.max())
        alpha = alpha / alpha.sum()   # (L,) positive, sums to 1
      `,
      terms: [
        [String.raw`e^{\syme_i}`, 'exponentiate each score: always positive, and higher scores win by a lot'],
        [String.raw`\sum_j e^{\syme_j}`, 'the total over all $L$ locations'],
        [String.raw`\symalpha_i`, "location $i$'s share of the attention: between 0 and 1, all of them summing to 1"],
      ],
      explain: 'Now the RNN has a budget of attention, 100% in total, spread over the image. Most of it lands on a few high-scoring places.',
    });
    p.prose(`Third, it reads the image through those weights, taking the **weighted average** of the feature vectors:`);
    p.math({
      label: 'The context vector',
      tex: String.raw`\symz = \sum_{i=1}^{L} \symalpha_i\, \symv_i \;=\; \mathbb{E}_{i \sim \symalpha}\big[\symv_i\big]`,
      code: `
        z = np.dot(alpha, feats)   # (D,) weighted average of the rows
      `,
      terms: [
        [String.raw`\symalpha_i\,\symv_i`, "location $i$'s feature vector, scaled by its attention weight"],
        [String.raw`\sum_i`, 'add them all up: a weighted average, since the weights sum to 1'],
        [String.raw`\mathbb{E}_{i\sim\symalpha}[\symv_i]`, 'the same thing read as an *expectation*: the average feature vector you would get if you picked locations at random with probabilities $\\alpha$'],
      ],
      explain: '$\\symz$ is a single vector the same size as one location\'s features, but it mostly describes the places with high attention. It goes into the RNN along with the previous word, and the RNN produces two things: a distribution over the vocabulary for the next word, and a new hidden state, which will score the locations again for the step after. Every operation here is a multiply, an add or an exponential, so the whole loop is differentiable and trains with ordinary backprop: no labels ever say where to look.',
    });
    p.callout('math', 'An **expectation** (written $\\mathbb{E}$) is a probability-weighted average: the long-run average value you would see if you drew at random many times. Roll a fair die and the expectation is $(1+2+3+4+5+6)/6 = 3.5$, even though no single roll is 3.5. Soft attention computes the expectation of the feature vector directly, instead of drawing.', 'Math help: expectation');
    figSoftAttention(p);
    p.prose(`
In the trained model, the attention maps line up with the words in a way that is startling to watch. While writing "a dog", the bright region sits on the dog; when the next word is "frisbee", it jumps to the frisbee; for "water" it spreads over the lake. Nobody labeled any of these regions: the model discovered that looking at the frisbee helps predict the word "frisbee". The maps also make mistakes legible: when a caption goes wrong, you can often see that the model was looking at the wrong thing.

### The whole loop

Put together, one time step of an attention captioner reads like this. Start from the grid of features, with $h_0$ computed from the image.

1. Score every location against the current hidden state, softmax: a distribution $\\symalpha$ over the $L$ locations.
2. Average the features with those weights: the context $\\symz$, a single $D$-dimensional vector.
3. Feed $\\symz$ and the previous word into the RNN (an LSTM in the paper). Out come a distribution over the vocabulary, from which the next word is sampled, and the next hidden state, which goes back to step 1.`);

    p.h2('Soft versus hard attention', 'hard-attention');
    p.prose(`Xu et al. also tried the more literal version: instead of averaging, **pick one location** and look only there.`);
    p.math({
      label: 'Hard attention',
      tex: String.raw`s \sim \operatorname{Categorical}(\symalpha_1, \dots, \symalpha_L), \qquad \symz = \symv_s`,
      code: `
        s = np.random.choice(L, p=alpha)   # roll a loaded die
        z = feats[s]                       # look only there
      `,
      terms: [
        [String.raw`s \sim \operatorname{Categorical}(\symalpha)`, 'draw one location at random, location $i$ with probability $\\alpha_i$'],
        [String.raw`\symz = \symv_s`, 'the context is just that one location\'s features'],
      ],
      explain: 'Cheaper (only one location is read) and arguably closer to how eyes work. But a random draw has no gradient: nudging $\\alpha_i$ a tiny bit does not smoothly change which location gets picked, so backprop cannot say how to adjust the scores.',
    });
    figHardAttention(p);
    p.prose(`
Hard attention is therefore trained with tools from **reinforcement learning** (the REINFORCE family of estimators): sample a location, see how good the resulting caption was, and make that choice more likely if it helped and less likely if it hurt. It works, but the gradient estimates are noisy and training is fiddlier. Soft attention sidesteps all of that by computing the expectation exactly, which is why it became the default. The cost is that soft attention reads *every* location at every step, which gets expensive for very large inputs.`);

    p.h2('Attention for translation, speech and video', 'translation');
    p.prose(`Soft attention for captioning was inspired by machine translation. Bahdanau, Cho and Bengio (2015) let the decoder of a translation RNN attend over the encoder's hidden states, one per source word, using exactly the three steps above:`);
    p.math({
      label: 'Attention in translation (Bahdanau et al.)',
      tex: String.raw`\symalpha_{tj} = \operatorname{softmax}_j\big(f_{\text{att}}(\symh_{t-1}, \symv_j)\big), \qquad \symz_t = \sum_j \symalpha_{tj}\, \symv_j`,
      code: `
        # v[j]: encoder state after source word j;  h: decoder state
        scores = np.array([f_att(h, v[j]) for j in range(len(v))])
        alpha = softmax(scores)       # which source words matter now
        z = np.dot(alpha, v)          # context for the next output word
      `,
      terms: [
        [String.raw`\symv_j`, 'the encoder\'s hidden state after reading source word $j$: a summary of that word in context'],
        [String.raw`\symh_{t-1}`, 'the decoder\'s state before writing output word $t$'],
        [String.raw`\symalpha_{tj}`, 'how much output word $t$ attends to source word $j$'],
        [String.raw`\symz_t`, 'the context fed to the decoder when it writes word $t$'],
      ],
      explain: 'The same machine with words instead of image patches. Plotting $\\alpha_{tj}$ as a grid (output words down, source words across) gives a soft *alignment*: mostly diagonal, but bending where languages order words differently, as when an English adjective-noun pair becomes a French noun-adjective pair.',
    });
    p.prose(`
The pattern spread quickly to anything sequential: speech recognition that attends over audio frames (Chorowski et al. 2015; Chan et al., *Listen, Attend and Spell*, 2015) and video captioning that attends over frames in time (Yao et al. 2015).`);

    p.h2('Attending to arbitrary regions: DRAW', 'draw');
    p.prose(`
Soft attention over a fixed grid can only pick among the grid's cells, at the grid's resolution. Can a network attend to an arbitrary box, at any position and size? **DRAW** (Gregor et al. 2015), an RNN that generates images by painting onto a canvas over many steps, reads and writes through a grid of $N \\times N$ Gaussian filters. The RNN outputs just a few numbers: the grid's center $(g_X, g_Y)$, its stride $\\delta$ (how far apart the filters are, which sets the zoom) and the blur $\\sigma$ of each filter (plus an intensity).`);
    p.math({
      label: "DRAW's Gaussian filterbank",
      tex: String.raw`\mu_X^i = g_X + \big(i - \tfrac{N}{2} - 0.5\big)\,\delta, \qquad F_X[i, a] = \frac{1}{Z_X}\exp\!\Big(-\frac{(a - \mu_X^i)^2}{2\sigma^2}\Big)`,
      code: `
        i = np.arange(1, N + 1)
        mu_x = gX + (i - N / 2 - 0.5) * delta          # N filter centers
        a = np.arange(width)                            # pixel columns
        Fx = np.exp(-(a - mu_x[:, None])**2 / (2 * sigma**2))
        Fx = Fx / Fx.sum(axis=1, keepdims=True)         # (N, width)
        glimpse = np.dot(np.dot(Fy, U), Fx.T)           # (N, N)
      `,
      terms: [
        [String.raw`\mu_X^i`, 'the horizontal center of filter $i$: $N$ evenly spaced points around $g_X$, $\\delta$ pixels apart'],
        [String.raw`F_X[i, a]`, 'how much pixel column $a$ contributes to filter $i$: a bell curve centered on $\\mu_X^i$, as wide as $\\sigma$'],
        [String.raw`Z_X`, 'a normalizer so each filter\'s weights sum to 1'],
        [String.raw`F_Y\, U\, F_X^{\top}`, 'blur-and-sample the image $U$ down to $N \\times N$, rows with $F_Y$ and columns with $F_X$'],
      ],
      explain: 'A crop and a zoom, made out of smooth bell curves instead of hard pixel boundaries. Because every weight is a smooth function of the center, stride and blur, the network gets a gradient telling it how to move and resize its window.',
    });
    figDraw(p);

    p.h2('Spatial transformer networks', 'stn');
    p.prose(`
**Spatial transformer networks** (Jaderberg, Simonyan, Zisserman and Kavukcuoglu, 2015) generalize the idea to any smooth warp and package it as a layer you can drop into any ConvNet. A spatial transformer takes an input $\\symU$ (an image or a feature map) and produces an output $\\symV$ in three parts:

1. A **localization network**, any small network, looks at $\\symU$ and outputs the parameters $\\symtheta$ of a transformation. For an affine transformation (any mix of zoom, rotation, shift and shear) that is just 6 numbers.
2. A **grid generator** lays a regular grid over the *output* and asks, for each output pixel, where in the input it should read from.
3. A **sampler** reads the input at those (generally fractional) positions with bilinear interpolation.`);
    p.math({
      label: 'The grid generator (affine)',
      tex: String.raw`\begin{pmatrix} x^s_i \\ y^s_i \end{pmatrix} = \symtheta \begin{pmatrix} x^t_i \\ y^t_i \\ 1 \end{pmatrix} = \begin{bmatrix} \theta_{11} & \theta_{12} & \theta_{13} \\ \theta_{21} & \theta_{22} & \theta_{23} \end{bmatrix} \begin{pmatrix} x^t_i \\ y^t_i \\ 1 \end{pmatrix}`,
      code: `
        # (x_t, y_t): output pixel i, coordinates scaled to [-1, 1]
        x_s = theta[0, 0] * x_t + theta[0, 1] * y_t + theta[0, 2]
        y_s = theta[1, 0] * x_t + theta[1, 1] * y_t + theta[1, 2]
      `,
      terms: [
        [String.raw`(x^t_i, y^t_i)`, 'the position of output pixel $i$ on the regular *target* grid'],
        [String.raw`(x^s_i, y^s_i)`, 'the position in the *source* (the input) to read from'],
        [String.raw`\symtheta`, 'the $2 \\times 3$ affine matrix from the localization net: the left $2\\times2$ block rotates, scales and shears, the last column shifts'],
        [String.raw`1`, 'the same trailing 1 as the bias trick of Chapter 4: it lets one matrix multiply also add the shift'],
      ],
      explain: 'Read it backward: for every output pixel, compute where to fetch it from. With $\\theta$ equal to the identity $[[1,0,0],[0,1,0]]$, every pixel reads from its own position and the layer does nothing. Halve the diagonal and the grid covers only the middle half of the input: a 2x zoom.',
    });
    figSTN(p);
    p.prose(`The source positions are almost never exactly on a pixel, so the sampler interpolates between the four nearest pixels:`);
    p.math({
      label: 'Bilinear sampling',
      tex: String.raw`\symV_i = \sum_{n}\sum_{m} \symU_{nm}\, \max\big(0,\, 1 - |x^s_i - m|\big)\, \max\big(0,\, 1 - |y^s_i - n|\big)`,
      code: `
        x0, y0 = int(np.floor(x_s)), int(np.floor(y_s))
        dx, dy = x_s - x0, y_s - y0
        V_i = ((1 - dx) * (1 - dy) * U[y0, x0] + dx * (1 - dy) * U[y0, x0 + 1]
               + (1 - dx) * dy * U[y0 + 1, x0] + dx * dy * U[y0 + 1, x0 + 1])
      `,
      terms: [
        [String.raw`\symU_{nm}`, 'the input pixel in row $n$, column $m$'],
        [String.raw`\max(0, 1 - |x^s_i - m|)`, 'a tent-shaped weight: 1 when column $m$ is exactly at $x^s_i$, falling to 0 one pixel away. Only the two nearest columns get a nonzero weight'],
        [String.raw`\sum_n \sum_m`, 'formally a sum over every pixel, but only the four nearest have nonzero weight, which is what the code computes'],
      ],
      explain: 'A weighted average of the four nearest pixels, with weights set by distance. Crucially, it has a gradient with respect to the *input values* (so earlier layers learn) and with respect to the *sampling position* $(x^s_i, y^s_i)$ (so the localization net learns where to look). The tent function has kinks, so strictly the gradient is a *sub*-gradient at whole-pixel positions, which in practice does not matter.',
    });
    figBilinear(p);
    p.prose(`
Nothing ever tells the localization network what transformation is "right". It is trained only by the final loss: if straightening the input makes the classifier more accurate, gradients flowing back through the sampler push $\\symtheta$ toward straightening. In the paper's experiments:

- On **distorted MNIST** (digits randomly rotated, scaled, translated or warped, sometimes placed in a large cluttered image), the transformer learned to undo the distortion, presenting the classifier with an upright, centered, consistently sized digit, and beat comparable ConvNets without it.
- On **Street View house numbers**, transformers inserted into the network improved accuracy by cropping and rectifying the digits.
- On **fine-grained bird classification** (CUB-200-2011), a network with several transformers in parallel learned, with no part labels at all, to have one zoom in on the bird's head and another on its body, reaching state-of-the-art accuracy at the time.

Because the whole module is differentiable, it is a drop-in layer: put it at the input or anywhere between conv layers, and the rest of the network trains as usual.`);
    p.callout('history', `
**After the course: attention without recurrence.** In 2017, *Attention Is All You Need* (Vaswani et al.) asked what happens if you drop the RNN entirely and keep only attention. In the **Transformer**, every position of a sequence attends to every other position: each word computes a query, every word offers a key and a value, and each word's new representation is the softmax-weighted average of the values, scored by query-key dot products. That is exactly the scores, softmax, weighted-sum recipe of this chapter, run for all positions at once and stacked in layers. Without a recurrence to step through, it trains in parallel on GPUs, and it took over machine translation and then nearly all of language processing.

Vision followed. The **Vision Transformer** (Dosovitskiy et al., 2020) cut an image into 16×16-pixel patches, treated each patch as a word, and matched the best ConvNets when trained on enough data. Today's image captioners and multimodal models are built from these layers. The idea you just played with, *let the model decide where to look, softly, and learn it with backprop*, turned out to be one of the most consequential in the field.`, 'After the course');
    p.callout('idea', `A single summary vector is a bottleneck. **Soft attention** keeps a set of vectors (image regions, source words) and, at every step, scores them against the current state, softmaxes the scores into weights $\\symalpha$, and reads the weighted average $\\symz$: differentiable, so ordinary backprop learns where to look. **Hard attention** samples one location instead and needs reinforcement-learning tricks. **Spatial transformers** predict a warp $\\symtheta$, turn it into a sampling grid, and read the input with bilinear interpolation, which is differentiable in both the pixels and the sampling positions.`, 'Takeaways');
  },
};

export default chapter;
