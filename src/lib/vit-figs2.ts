import type { Page } from '../core/page';
import { fmt } from '../core/code';
import { CIFAR_CLASSES } from '../core/data';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import type { Color } from '../core/symbols';
import { FONT, blit, imgCanvas, label, fit, isTall, thumbs } from './vit-draw';
import { type Assets, SHOW, argmax, loadAssets, traceOf, veil } from './vit-figs';
import type { TinyViT } from './vit-model';

/** Ten class-probability bars, top-left at (x, y). */
function probBars(ctx: CanvasRenderingContext2D, probs: ArrayLike<number>, truth: number, x: number, y: number, w: number, title: string, k: Color): void {
  label(ctx, title, x, y, { font: FONT.mono(12, 600), color: color(k) });
  const lw = 40;
  const bw = w - lw - 34;
  const top = argmax(probs);
  for (let c = 0; c < 10; c++) {
    const yy = y + 10 + c * 20;
    label(ctx, CIFAR_CLASSES[c]!, x + lw - 4, yy + 11, { font: FONT.ui(11.5, c === truth ? 700 : 400), align: 'right', color: c === truth ? color('gold') : color('--ink-2') });
    ctx.fillStyle = withAlpha(color(k), c === top ? 0.8 : 0.35);
    ctx.fillRect(x + lw, yy + 2, Math.max(1, bw * probs[c]!), 13);
    label(ctx, `${Math.round(probs[c]! * 100)}%`, x + lw + bw * probs[c]! + 4, yy + 12.5, { font: FONT.mono(10.5), color: color('--ink-3') });
  }
}

/* ------------------------------------------------------------------ */
/* Fig: shuffle the patches                                             */
/* ------------------------------------------------------------------ */

export function figShuffle(p: Page): void {
  p.figure({
    title: 'Shuffle the patches: who notices?',
    codeTitle: 'bag_of_patches.py',
    code: `
      order = {{order:np.arange(64)}}   # slot -> patch     #@shuf
      x = patches[order]       # same 64 patches, new slots   #@shuf
      p1 = vit(x)          # adds E_pos slot by slot          #@pos
      p2 = vit_nopos(x)    # trained with no positions at all #@bag
      # p1: {{a:…}}
      # p2: {{b:…}}
      # largest change in p2 since unshuffled: {{d:0}}
    `,
    setup(f) {
      let A: Assets | null = null;
      let idx = SHOW[0]!;
      let order: number[] | null = null;
      const rng = new Rng(3);
      const cv = f.canvas(360, 470, (ctx, w, hh) => {
        const tall = isTall(w);
        if (!A) {
          label(ctx, 'Loading the trained tiny ViTs…', w / 2, hh / 2, { align: 'center' });
          return;
        }
        const src = imgCanvas(A.test, idx);
        const S = tall ? Math.min(200, w * 0.5) : Math.min(230, w * 0.36);
        const ix = tall ? (w - S) / 2 : 6, iy = 24;
        label(ctx, order ? 'the patches, in shuffled slots' : 'the patches, in order', tall ? w / 2 : ix, 15, { font: FONT.ui(12, 600), color: color('orange'), align: tall ? 'center' : 'left' });
        const G = 8, P = 4, cs = S / G;
        for (let s = 0; s < 64; s++) {
          const j = order ? order[s]! : s;
          blit(ctx, src, ix + (s % G) * cs, iy + Math.floor(s / G) * cs, cs + 0.3, cs + 0.3, (j % G) * P, Math.floor(j / G) * P, P, P);
        }
        const t1 = traceOf(A, A.vit, idx, order ?? undefined);
        const t2 = traceOf(A, A.nopos, idx, order ?? undefined);
        const truth = A.test.labels[idx]!;
        const bx = tall ? 4 : ix + S + 22;
        const by = tall ? iy + S + 30 : 16;
        const bw = tall ? (w - 16) / 2 : (w - bx - 10) / 2;
        probBars(ctx, t1.probs, truth, bx, by, bw, 'vit (positions)', 'purple');
        probBars(ctx, t2.probs, truth, bx + bw + 8, by, bw, 'vit_nopos', 'teal');
        fit(cv.canvas, w, hh, Math.max(iy + S, by + 212) + 6);
      });
      cv.canvas.classList.add('scroll-ok');
      const dRo = f.readout('vit_nopos change');
      const sync = () => {
        if (!A) return;
        const t1 = traceOf(A, A.vit, idx, order ?? undefined);
        const t2 = traceOf(A, A.nopos, idx, order ?? undefined);
        const base = traceOf(A, A.nopos, idx);
        let d = 0;
        for (let c = 0; c < 10; c++) d = Math.max(d, Math.abs(t2.probs[c]! - base.probs[c]!));
        const top = (pr: Float32Array) => `${CIFAR_CLASSES[argmax(pr)]} ${Math.round(pr[argmax(pr)]! * 100)}%`;
        f.code.setMany({ order: order ? 'rng.permutation(64)' : 'np.arange(64)', a: top(t1.probs), b: top(t2.probs), d: d < 5e-5 ? '0.0000' : d.toFixed(4) });
        dRo.set(d < 5e-5 ? '0.0000' : d.toFixed(4));
        cv.redraw();
      };
      f.button('Shuffle', () => {
        order = rng.shuffle(Array.from({ length: 64 }, (_, i) => i));
        f.code.highlight(['shuf', 'pos', 'bag']);
        sync();
      }, { primary: true, icon: 'shuffle' });
      f.button('In order', () => {
        order = null;
        f.code.highlight(null);
        sync();
      }, { icon: 'reset' });
      loadAssets()
        .then((a) => {
          A = a;
          thumbs(f, a.test, SHOW, idx, (id) => {
            idx = id;
            sync();
          });
          sync();
        })
        .catch((e) => f.status(`Could not load the models: ${(e as Error).message}`));
    },
    caption: `Two tiny ViTs with identical architecture and training, except that \`vit_nopos\` never had position embeddings. **Shuffle** the patches and compare. The model with positions sees a scrambled picture and often changes its mind: over the 200 test images, a random shuffle changes its answer about 45% of the time, and its accuracy falls from 77% to about half. The model without positions gives exactly the same answer for every one of the 64! orderings, because without $\\symEpos$ attention treats its input as a set: nothing in the computation depends on which slot a patch sits in. (The readout shows its largest change, which is zero up to float rounding.) And it still gets 73% of CIFAR-10's test images right, from colors, textures and parts alone.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: shifting the image                                              */
/* ------------------------------------------------------------------ */

const EDGE = [-1, 0, 1, -2, 0, 2, -1, 0, 1];

/** 3 x 3 vertical-edge filter on the gray image, wrapping at the borders (so shifts are exact). */
export function edgeMap(px: Uint8Array, off: number, shift: number): Float32Array {
  const g = new Float32Array(1024);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const sx = (x - shift + 32) % 32;
      const q = y * 32 + sx;
      g[y * 32 + x] = (0.299 * px[off + q]! + 0.587 * px[off + 1024 + q]! + 0.114 * px[off + 2048 + q]!) / 255;
    }
  const out = new Float32Array(1024);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += EDGE[(dy + 1) * 3 + dx + 1]! * g[((y + dy + 32) % 32) * 32 + ((x + dx + 32) % 32)]!;
      out[y * 32 + x] = s;
    }
  return out;
}

/** CIFAR bytes of image i rolled right by `shift` pixels. */
export function rolled(px: Uint8Array, i: number, shift: number): Uint8Array {
  const out = new Uint8Array(3072);
  for (let c = 0; c < 3; c++)
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) out[c * 1024 + y * 32 + x] = px[i * 3072 + c * 1024 + y * 32 + ((x - shift + 32) % 32)]!;
  return out;
}

export function figShift(p: Page): void {
  p.figure({
    title: 'Slide the image: a convolution follows, patches break',
    codeTitle: 'shift.py',
    code: `
      x2 = np.roll(img, {{s:0}}, axis=1)    # slide right, wrapping  #@shift
      f1 = conv(gray(img), w_edge)          # 3x3 filter, wrap pad  #@conv
      f2 = conv(gray(x2), w_edge)                                   #@conv
      np.abs(f2 - np.roll(f1, {{s}}, axis=1)).max()   # {{err:0.0}}  #@conv

      same = sum(any((a == b).all() for b in patches(img))
                 for a in patches(x2))      # {{same:64}} of 64      #@vit
      vit(x2)                               # {{pred:…}}             #@vit
    `,
    setup(f) {
      let A: Assets | null = null;
      let idx = SHOW[0]!;
      let s = 0;
      const conf: number[] = [];
      const curve = () => {
        if (!A || conf.length) return;
        const m = A.vit;
        const truth = A.test.labels[idx]!;
        for (let k = 0; k <= 8; k++) conf.push(m.forward(m.patches(rolled(A.test.pixels, idx, k))).probs[truth]!);
      };
      const cv = f.canvas(360, 470, (ctx, w, hh) => {
        const tall = isTall(w);
        if (!A) {
          label(ctx, 'Loading…', w / 2, hh / 2, { align: 'center' });
          return;
        }
        curve();
        const px = rolled(A.test.pixels, idx, s);
        const tmp = document.createElement('canvas');
        tmp.width = tmp.height = 32;
        const id = new ImageData(32, 32);
        for (let q = 0; q < 1024; q++) {
          id.data[q * 4] = px[q]!;
          id.data[q * 4 + 1] = px[1024 + q]!;
          id.data[q * 4 + 2] = px[2048 + q]!;
          id.data[q * 4 + 3] = 255;
        }
        tmp.getContext('2d')!.putImageData(id, 0, 0);
        const S = tall ? (w - 24) / 2 : Math.min(190, (w - 60) / 3);
        const y0 = 26;
        // the shifted image with the patch grid
        label(ctx, `image, slid ${s} px`, 6, 16, { font: FONT.ui(12, 600), color: color('orange') });
        blit(ctx, tmp, 6, y0, S, S);
        ctx.strokeStyle = s % 4 === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 1; k < 8; k++) {
          ctx.moveTo(6 + (k * S) / 8 + 0.5, y0);
          ctx.lineTo(6 + (k * S) / 8 + 0.5, y0 + S);
          ctx.moveTo(6, y0 + (k * S) / 8 + 0.5);
          ctx.lineTo(6 + S, y0 + (k * S) / 8 + 0.5);
        }
        ctx.stroke();
        // the conv response
        const ex = 6 + S + 12;
        label(ctx, 'conv response', ex, 16, { font: FONT.ui(12, 600), color: color('teal') });
        const fm = edgeMap(A.test.pixels, idx * 3072, s);
        const im2 = new ImageData(32, 32);
        const tc = [0, 0, 0];
        const t = color('teal');
        const m = t.match(/^#([0-9a-f]{6})$/i);
        if (m) {
          const n = parseInt(m[1]!, 16);
          tc[0] = (n >> 16) & 255;
          tc[1] = (n >> 8) & 255;
          tc[2] = n & 255;
        }
        for (let q = 0; q < 1024; q++) {
          const v = Math.min(1, Math.abs(fm[q]!) / 1.2);
          im2.data[q * 4] = 255 - (255 - tc[0]!) * v;
          im2.data[q * 4 + 1] = 255 - (255 - tc[1]!) * v;
          im2.data[q * 4 + 2] = 255 - (255 - tc[2]!) * v;
          im2.data[q * 4 + 3] = 255;
        }
        const t2 = document.createElement('canvas');
        t2.width = t2.height = 32;
        t2.getContext('2d')!.putImageData(im2, 0, 0);
        blit(ctx, t2, ex, y0, S, S);
        // ViT readout
        const rx = tall ? 6 : ex + S + 22;
        const ry = tall ? y0 + S + 30 : 16;
        const rw = w - rx - 8;
        const same = s % 4 === 0 ? 64 : 0;
        label(ctx, 'ViT patches', rx, ry, { font: FONT.ui(12, 600), color: color('purple') });
        label(ctx, `${same} of 64 patches match an original one`, rx, ry + 20, { font: FONT.ui(12), color: color('--ink-2') });
        label(ctx, s % 4 === 0 ? (s ? 'same patches, but in new slots' : 'nothing has moved yet') : 'every patch now holds new pixels', rx, ry + 38, { font: FONT.ui(12), color: color('--ink-3') });
        // confidence in the true class against the shift
        const cx0 = rx + 30, cy0 = ry + 62, cw = Math.min(rw - 40, 260), ch = tall ? 90 : 120;
        label(ctx, `vit's confidence in "${CIFAR_CLASSES[A.test.labels[idx]!]}"`, rx, cy0 - 4, { font: FONT.ui(11.5), color: color('--ink-2') });
        ctx.strokeStyle = color('--axis');
        ctx.lineWidth = 1;
        ctx.strokeRect(cx0, cy0 + 4, cw, ch);
        const X = (k: number) => cx0 + (k / 8) * cw;
        const Y = (v: number) => cy0 + 4 + ch * (1 - v);
        ctx.strokeStyle = color('purple');
        ctx.lineWidth = 2;
        ctx.beginPath();
        conf.forEach((v, k) => (k ? ctx.lineTo(X(k), Y(v)) : ctx.moveTo(X(k), Y(v))));
        ctx.stroke();
        conf.forEach((v, k) => {
          ctx.beginPath();
          ctx.arc(X(k), Y(v), k === s ? 5 : 3, 0, Math.PI * 2);
          ctx.fillStyle = k === s ? color('purple') : withAlpha(color('purple'), 0.5);
          ctx.fill();
        });
        for (let k = 0; k <= 8; k += 4) label(ctx, `${k}`, X(k), cy0 + ch + 18, { font: FONT.mono(10.5), align: 'center', color: color('--ink-3') });
        label(ctx, 'shift (px)', cx0 + cw / 2, cy0 + ch + 32, { font: FONT.ui(10.5), align: 'center', color: color('--ink-3') });
        label(ctx, '100%', cx0 - 5, Y(1) + 8, { font: FONT.mono(10), align: 'right', color: color('--ink-3') });
        label(ctx, '0%', cx0 - 5, Y(0), { font: FONT.mono(10), align: 'right', color: color('--ink-3') });
        fit(cv.canvas, w, hh, Math.max(y0 + S, cy0 + ch + 40) + 6);
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        if (!A) return;
        const pr = A.vit.forward(A.vit.patches(rolled(A.test.pixels, idx, s))).probs;
        const c = argmax(pr);
        f.code.setMany({ s, err: '0.0', same: s % 4 === 0 ? 64 : 0, pred: `${CIFAR_CLASSES[c]} ${Math.round(pr[c]! * 100)}%` });
        cv.redraw();
      };
      f.slider({
        label: 'slide right (px)',
        min: 0,
        max: 8,
        step: 1,
        value: 0,
        onInput: (v) => {
          s = v;
          f.code.highlight(['shift', 'conv', 'vit']);
          sync();
        },
      });
      loadAssets()
        .then((a) => {
          A = a;
          thumbs(f, a.test, SHOW, idx, (id) => {
            idx = id;
            conf.length = 0;
            sync();
          });
          sync();
        })
        .catch((e) => f.status(`Could not load the model: ${(e as Error).message}`));
    },
    caption: `Slide the image right, wrapping around the edge. The convolution's response slides with it, exactly: the difference from the shifted original response is zero for every shift, because the same filter is applied at every position. That property, *translation equivariance*, is built into every CONV layer. The ViT's input does not have it. Shift by 1 to 3 pixels and every patch holds a different mix of pixels; shift by a multiple of 4 and the patches come back, but in different slots, with different position embeddings added. Whatever robustness to shifts the ViT shows (the curve) it had to learn, here from training with random shifts and flips.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: mean attention distance                                         */
/* ------------------------------------------------------------------ */

const HEAD_K: Color[] = ['blue', 'orange', 'green', 'red'];

export function figDistance(p: Page): void {
  p.figure({
    title: 'How far each head looks, layer by layer',
    codeTitle: 'attention_distance.py',
    code: `
      dist = patch_distances(G=8, P=4)    # (64, 64), pixels
      def mean_distance(A_lh):            # one head: (65, 65)
          W = A_lh[1:, 1:]                # patches to patches  #@w
          W = W / W.sum(axis=1, keepdims=True)                  #@w
          return (W * dist).sum(axis=1).mean()                  #@d

      d = np.zeros((6, 4))
      for img in X_test[:{{n:0}}]:                              #@loop
          _, A = vit(img)
          for l, h in np.ndindex(6, 4):
              d[l, h] += mean_distance(A[l, h])                 #@loop
      d /= {{n}}
      # uniform attention would give {{uni:…}} px
      # layer {{l:1}}, head {{h:1}}: {{dl:…}} px
    `,
    setup(f) {
      let A: Assets | null = null;
      let idx = SHOW[0]!;
      let q = 27;
      let sel = { l: 0, h: 0 };
      let n = 0;
      const sum = new Float64Array(24);
      let uni = 0;
      let geo = { cx: 0, cy: 0, cw: 1, ch: 1, ymax: 1, ix: 0, iy: 0, S: 1 };
      const cv = f.canvas(360, 560, (ctx, w, hh) => {
        const tall = isTall(w);
        if (!A) {
          label(ctx, 'Loading the trained tiny ViT…', w / 2, hh / 2, { align: 'center' });
          return;
        }
        const m = A.vit;
        // chart
        const cx = 40;
        const cw = tall ? w - cx - 12 : w * 0.55 - cx;
        const cy = cw < 330 ? 60 : 46;
        const ch = tall ? 220 : 260;
        const ymax = 20;
        geo = { ...geo, cx, cy, cw, ch, ymax };
        label(ctx, n ? `mean attention distance (px), ${n} test images` : 'mean attention distance (px)', cx - 34, 14, { font: FONT.ui(12, 600), color: color('purple') });
        ctx.strokeStyle = color('--grid');
        ctx.lineWidth = 1;
        for (let v = 0; v <= ymax; v += 4) {
          const y = cy + ch * (1 - v / ymax);
          ctx.beginPath();
          ctx.moveTo(cx, y + 0.5);
          ctx.lineTo(cx + cw, y + 0.5);
          ctx.stroke();
          label(ctx, `${v}`, cx - 6, y + 4, { font: FONT.mono(10.5), align: 'right', color: color('--ink-3') });
        }
        const X = (l: number) => cx + ((l + 0.5) / m.L) * cw;
        const Y = (v: number) => cy + ch * (1 - v / ymax);
        for (let l = 0; l < m.L; l++) label(ctx, `${l + 1}`, X(l), cy + ch + 16, { font: FONT.mono(11), align: 'center', color: l === sel.l ? color('--ink') : color('--ink-3') });
        label(ctx, 'layer', cx + cw, cy + ch + 32, { font: FONT.ui(11), align: 'right', color: color('--ink-3') });
        // uniform baseline
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = color('--ink-3');
        ctx.beginPath();
        ctx.moveTo(cx, Y(uni));
        ctx.lineTo(cx + cw, Y(uni));
        ctx.stroke();
        ctx.setLineDash([]);
        if (n) {
          for (let l = 0; l < m.L; l++)
            for (let h = 0; h < m.H; h++) {
              const v = sum[l * 4 + h]! / n;
              const x = X(l) + (h - 1.5) * Math.min(9, cw / m.L / 6);
              ctx.beginPath();
              ctx.arc(x, Y(v), l === sel.l && h === sel.h ? 6 : 4.5, 0, Math.PI * 2);
              ctx.fillStyle = color(HEAD_K[h]!);
              ctx.fill();
              if (l === sel.l && h === sel.h) {
                ctx.strokeStyle = color('--ink');
                ctx.lineWidth = 2;
                ctx.stroke();
              }
            }
        }
        const per = cw < 330 ? 3 : 5;
        HEAD_K.forEach((k, h) => {
          const lx = cx - 34 + (h % per) * 64, ly = 24 + Math.floor(h / per) * 15;
          ctx.fillStyle = color(k);
          ctx.beginPath();
          ctx.arc(lx + 4, ly + 4, 4, 0, Math.PI * 2);
          ctx.fill();
          label(ctx, `head ${h + 1}`, lx + 11, ly + 8, { font: FONT.ui(11), color: color('--ink-2') });
        });
        {
          const lx = cx - 34 + (4 % per) * 64, ly = 24 + Math.floor(4 / per) * 15;
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = color('--ink-3');
          ctx.beginPath();
          ctx.moveTo(lx, ly + 4.5);
          ctx.lineTo(lx + 16, ly + 4.5);
          ctx.stroke();
          ctx.setLineDash([]);
          label(ctx, 'uniform', lx + 20, ly + 8, { font: FONT.ui(11), color: color('--ink-2') });
        }
        // one query patch, one head, this image
        const S = tall ? Math.min(w - 130, 230) : Math.min(w - cx - cw - 34, 260);
        const ix = tall ? 6 : cx + cw + 26, iy = tall ? cy + ch + 62 : 30;
        geo = { ...geo, ix, iy, S };
        const tr = traceOf(A, m, idx);
        const T = m.N + 1;
        const row = tr.A[sel.l]!.subarray((sel.h * T + q + 1) * T + 1, (sel.h * T + q + 1) * T + T);
        label(ctx, `patch ${q}, layer ${sel.l + 1}, head ${sel.h + 1}`, ix, iy - 10, { font: FONT.ui(12, 600), color: color(HEAD_K[sel.h]!) });
        veil(ctx, imgCanvas(A.test, idx), row, m.G, ix, iy, S);
        const cs = S / m.G;
        ctx.strokeStyle = color('orange');
        ctx.lineWidth = 2.5;
        ctx.strokeRect(ix + (q % m.G) * cs, iy + Math.floor(q / m.G) * cs, cs, cs);
        let ds = 0, ws = 0;
        for (let j = 0; j < m.N; j++) {
          ds += row[j]! * m.dist(q, j);
          ws += row[j]!;
        }
        const tx = tall ? ix + S + 12 : ix;
        const ty = tall ? iy + 14 : iy + S + 20;
        label(ctx, `${(ds / ws).toFixed(1)} px`, tx, ty, { font: FONT.mono(13, 600), color: color(HEAD_K[sel.h]!) });
        label(ctx, 'for this patch', tx, ty + 16, { font: FONT.ui(11), color: color('--ink-3') });
        fit(cv.canvas, w, hh, Math.max(cy + ch + 40, iy + S + (tall ? 8 : 40)));
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        f.code.setMany({ n, uni: fmt(uni, 3), l: sel.l + 1, h: sel.h + 1, dl: n ? fmt(sum[sel.l * 4 + sel.h]! / n, 3) : '…' });
        cv.redraw();
      };
      cv.canvas.addEventListener('pointerdown', (e) => {
        if (!A) return;
        const r = cv.canvas.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const g = geo;
        if (x >= g.ix && y >= g.iy && x < g.ix + g.S && y < g.iy + g.S) {
          q = Math.floor((y - g.iy) / (g.S / 8)) * 8 + Math.floor((x - g.ix) / (g.S / 8));
          sync();
          return;
        }
        if (x >= g.cx && x <= g.cx + g.cw && y >= g.cy - 10 && y <= g.cy + g.ch + 10 && n) {
          const l = Math.max(0, Math.min(5, Math.floor(((x - g.cx) / g.cw) * 6)));
          let best = 0, bd = Infinity;
          for (let h = 0; h < 4; h++) {
            const v = sum[l * 4 + h]! / n;
            const d = Math.abs(g.cy + g.ch * (1 - v / g.ymax) - y);
            if (d < bd) { bd = d; best = h; }
          }
          sel = { l, h: best };
          sync();
        }
      });
      const run = f.loop(() => {
        if (!A) return;
        const m = A.vit;
        const tr = m.forward(m.patches(A.test.pixels, n * 3072));
        for (let l = 0; l < m.L; l++) for (let h = 0; h < m.H; h++) sum[l * 4 + h]! += m.attnDistance(tr, l, h);
        n++;
        f.code.highlight('loop');
        sync();
        if (n >= A.test.n) {
          f.code.highlight(null);
          f.status(`Averaged over all ${n} test images. **Tap a dot** to pick a layer and head, and **tap the image** to pick a query patch.`);
          return false;
        }
      });
      loadAssets()
        .then((a) => {
          A = a;
          let s = 0;
          for (let i = 0; i < a.vit.N; i++) for (let j = 0; j < a.vit.N; j++) s += a.vit.dist(i, j);
          uni = s / (a.vit.N * a.vit.N);
          thumbs(f, a.test, SHOW, idx, (id) => {
            idx = id;
            sync();
          });
          sync();
          run.start();
        })
        .catch((e) => f.status(`Could not load the model: ${(e as Error).message}`));
    },
    caption: `For every patch, the attention weights of one head say where that patch gathers information; weighting each source patch by its distance in pixels and averaging gives the head's *mean attention distance*, the transformer's version of a receptive field. The chart averages over 200 test images, adding them one at a time, and plots every head of every layer. The dashed line is what attention spread evenly over all patches would give.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: Swin windows                                                    */
/* ------------------------------------------------------------------ */

type Mode = 'global' | 'win' | 'shift' | 'merge';

export function figSwin(p: Page): void {
  p.figure({
    title: 'Global attention, windows, shifted windows',
    codeTitle: 'windows.py',
    code: `
      M = 7                       # window side, in patches
      x = z.reshape(14, 14, D)    # tokens on their grid
      if {{shifted:False}}:       # every second block    #@sw
          x = np.roll(x, (-3, -3), axis=(0, 1))           #@sw
      w = x.reshape(2, M, 2, M, D)                        #@win
      w = w.transpose(0, 2, 1, 3, 4)                      #@win
      w = w.reshape(4, M * M, D)  # 4 windows of 49       #@win
      # attend inside each window; after a roll,
      # mask pieces that wrapped around, then roll back

      # patch merging: 2x2 neighbors -> one token        #@merge
      x = x.reshape(7, 2, 7, 2, D)                        #@merge
      x = x.transpose(0, 2, 1, 3, 4)                      #@merge
      x = x.reshape(7, 7, 4 * D) @ W_merge  # 2D wide     #@merge

      side = {{side:224}}         # image width, pixels
      N = (side // 4) ** 2        # {{N:3136}} tokens    #@cost
      N * N                       # {{g:…}} global       #@cost
      N * M * M                   # {{wn:…}} windowed    #@cost
    `,
    setup(f) {
      let mode: Mode = 'win';
      let q = 3 * 14 + 9;
      let side = 224;
      let geo = { x: 0, y: 0, S: 1 };
      const human = (v: number) => (v >= 1e9 ? `${(v / 1e9).toPrecision(3)} billion` : v >= 1e6 ? `${(v / 1e6).toPrecision(3)} million` : v.toLocaleString('en-US'));
      const can = (r: number, c: number): boolean => {
        const r0 = Math.floor(q / 14), c0 = q % 14;
        if (mode === 'global') return true;
        if (mode === 'merge') return true;
        if (mode === 'win') return Math.floor(r / 7) === Math.floor(r0 / 7) && Math.floor(c / 7) === Math.floor(c0 / 7);
        const reg = (v: number) => (v < 3 ? 0 : v < 10 ? 1 : 2);
        return reg(r) === reg(r0) && reg(c) === reg(c0);
      };
      const cv = f.canvas(360, 590, (ctx, w, hh) => {
        const tall = isTall(w);
        const S = tall ? Math.min(w - 12, 330) : Math.min(w * 0.48, 330);
        const gx = 6, gy = 26;
        geo = { x: gx, y: gy, S };
        const titles: Record<Mode, string> = {
          global: 'ViT: every token attends to all 196',
          win: 'windows: attend only inside your 7 × 7 window',
          shift: 'next block: windows shifted by 3',
          merge: 'after patch merging: 7 × 7 tokens, one window',
        };
        label(ctx, titles[mode], gx, 15, { font: FONT.ui(12, 600), color: color('--ink') });
        const G = mode === 'merge' ? 7 : 14;
        const cs = S / G;
        const r0 = Math.floor(q / 14), c0 = q % 14;
        for (let r = 0; r < G; r++)
          for (let c = 0; c < G; c++) {
            const rr = mode === 'merge' ? r * 2 : r, cc = mode === 'merge' ? c * 2 : c;
            const on = can(rr, cc);
            const self = mode === 'merge' ? Math.floor(r0 / 2) === r && Math.floor(c0 / 2) === c : r === r0 && c === c0;
            ctx.fillStyle = self ? color('orange') : on ? withAlpha(color('purple'), 0.45) : withAlpha(color('--ink-3'), 0.12);
            ctx.fillRect(gx + c * cs + 1, gy + r * cs + 1, cs - 2, cs - 2);
          }
        ctx.strokeStyle = color('--ink');
        ctx.lineWidth = 2.5;
        const bounds = mode === 'win' ? [0, 7, 14] : mode === 'shift' ? [0, 3, 10, 14] : [0, 14];
        for (const b of bounds) {
          const v = (b / 14) * S;
          ctx.beginPath();
          ctx.moveTo(gx + v, gy);
          ctx.lineTo(gx + v, gy + S);
          ctx.moveTo(gx, gy + v);
          ctx.lineTo(gx + S, gy + v);
          ctx.stroke();
        }
        // cost chart
        const px = tall ? 46 : gx + S + 64;
        const py = tall ? gy + S + 44 : 40;
        const pw = w - px - 14;
        const ph = tall ? 170 : S - 40;
        label(ctx, 'attention pairs per layer (4 × 4 patches, M = 7)', tall ? 6 : px - 50, py - 16, { font: FONT.ui(12, 600), color: color('--ink') });
        const sides = [112, 1024];
        const lx = (v: number) => px + ((Math.log(v) - Math.log(sides[0]!)) / (Math.log(sides[1]!) - Math.log(sides[0]!))) * pw;
        const ly = (v: number) => py + ph * (1 - (Math.log10(v) - 4) / (12 - 4));
        ctx.strokeStyle = color('--grid');
        ctx.lineWidth = 1;
        for (let e = 4; e <= 12; e += 2) {
          ctx.beginPath();
          ctx.moveTo(px, ly(10 ** e) + 0.5);
          ctx.lineTo(px + pw, ly(10 ** e) + 0.5);
          ctx.stroke();
          label(ctx, `${e}`, px - 6, ly(10 ** e) - 1, { font: FONT.mono(9), align: 'right', color: color('--ink-3') });
          label(ctx, '10', px - 6 - ctx.measureText(`${e}`).width, ly(10 ** e) + 5, { font: FONT.mono(11), align: 'right', color: color('--ink-3') });
        }
        for (const sd of [112, 224, 512, 1024]) label(ctx, `${sd}`, lx(sd), py + ph + 16, { font: FONT.mono(10.5), align: 'center', color: color('--ink-3') });
        label(ctx, 'image side (px)', px + pw, py + ph + 32, { font: FONT.ui(10.5), align: 'right', color: color('--ink-3') });
        const line = (fn: (s: number) => number, k: Color) => {
          ctx.strokeStyle = color(k);
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          for (let i = 0; i <= 60; i++) {
            const sd = sides[0]! * (sides[1]! / sides[0]!) ** (i / 60);
            const y = ly(fn(sd));
            if (i) ctx.lineTo(lx(sd), y);
            else ctx.moveTo(lx(sd), y);
          }
          ctx.stroke();
        };
        const Nof = (sd: number) => (sd / 4) ** 2;
        line((sd) => Nof(sd) ** 2, 'red');
        line((sd) => Nof(sd) * 49, 'teal');
        const N = Nof(side);
        for (const [v, k] of [[N * N, 'red'], [N * 49, 'teal']] as const) {
          ctx.beginPath();
          ctx.arc(lx(side), ly(v), 5, 0, Math.PI * 2);
          ctx.fillStyle = color(k);
          ctx.fill();
        }
        label(ctx, 'global: N²', lx(400), ly(Nof(400) ** 2) - 12, { font: FONT.ui(11.5, 600), align: 'right', color: color('red') });
        label(ctx, 'windows: N·M²', lx(560), ly(Nof(560) * 49) + 20, { font: FONT.ui(11.5, 600), color: color('teal') });
        fit(cv.canvas, w, hh, Math.max(gy + S, py + ph + 36) + 6);
      });
      const sync = () => {
        const N = (side / 4) ** 2;
        f.code.setMany({ shifted: mode === 'shift' ? 'True' : 'False', side, N: N.toLocaleString('en-US'), g: human(N * N), wn: human(N * 49) });
        f.code.highlight(mode === 'shift' ? ['sw', 'win'] : mode === 'win' ? 'win' : mode === 'merge' ? 'merge' : null);
        cv.redraw();
      };
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const x = e.clientX - r.left - geo.x, y = e.clientY - r.top - geo.y;
        if (x < 0 || y < 0 || x >= geo.S || y >= geo.S) return;
        const G = mode === 'merge' ? 7 : 14;
        const rr = Math.floor(y / (geo.S / G)), cc = Math.floor(x / (geo.S / G));
        q = mode === 'merge' ? rr * 2 * 14 + cc * 2 : rr * 14 + cc;
        cv.redraw();
      });
      cv.canvas.classList.add('scroll-ok');
      f.segmented({
        options: [
          { value: 'global', label: 'ViT' },
          { value: 'win', label: 'windows' },
          { value: 'shift', label: 'shifted' },
          { value: 'merge', label: 'merged' },
        ],
        value: 'win',
        onChange: (v) => {
          mode = v as Mode;
          sync();
        },
      });
      f.slider({
        label: 'image side',
        min: 112,
        max: 1024,
        step: 16,
        value: 224,
        format: (v) => `${v} px`,
        onInput: (v) => {
          side = v;
          f.code.highlight('cost');
          sync();
        },
      });
      sync();
    },
    caption: `A 14 × 14 grid of patch tokens (orange: the one you tapped; purple: the tokens it may attend to). **Tap any token** and switch modes. ViT lets every token attend to every other. Swin's *windows* restrict attention to 7 × 7 blocks, so a token only sees its neighborhood; in the next block the window grid is *shifted* by 3, so tokens near a border now share a window with their neighbors across it. *Patch merging* then fuses each 2 × 2 group into one token, so the same windows cover four times the image: a pyramid, like a ConvNet's. The chart shows why this matters: global attention grows with the fourth power of the image side, windowed attention only with the square.`,
  });
}
