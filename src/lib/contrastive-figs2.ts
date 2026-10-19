import { fmt } from '../core/code';
import { type CifarSet, loadCifar } from '../core/data';
import { h } from '../core/dom';
import type { Page } from '../core/page';
import { CLASS_COLORS, color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { type Img, GRID, NPATCH, PATCH, SIDE, drawImg, fromCifar, maskFromOrder, maskedMSE, naiveFill } from './contrastive-aug';
import { COLORS, SHAPES, SIZES, type ShapeImage, ToyClip, VOCAB, drawShape, makeSet, render } from './contrastive-clip';
import { DINO_K, ToyDino } from './contrastive-dino';
import { badge, heat, localXY, rbox, txt } from './contrastive-draw';
import { rowSoftmax, simMatrix } from './contrastive-net';
import { makeToy } from './contrastive-toy';

const CSS = `
.cl-prompts{display:flex;flex-direction:column;gap:6px;width:100%}
.cl-row{display:grid;grid-template-columns:12px minmax(0,1fr);gap:4px 8px;align-items:center}
.cl-dot{width:12px;height:12px;border-radius:50%}
.cl-input{font:500 16px var(--font-mono);padding:6px 9px;border:1px solid var(--rule);border-radius:8px;background:var(--paper);
  color:var(--ink);width:100%;min-width:0;box-sizing:border-box}
.cl-note{grid-column:2;font:450 12px/1.3 var(--font-ui);color:var(--ink-3)}
.cl-note s{color:var(--c-red)}
`;

function installCss(root: HTMLElement): void {
  if (root.querySelector('style[data-cl]')) return;
  const st = document.createElement('style');
  st.dataset.cl = '1';
  st.textContent = CSS;
  root.prepend(st);
}

/* ------------------------------------------------------------------ */
/* The toy CLIP, shared by the training and zero-shot figures          */
/* ------------------------------------------------------------------ */

export const CLIP_STEPS = 1200;

interface ClipShared {
  model: ToyClip;
  losses: number[];
  listeners: (() => void)[];
  running: boolean;
  notify(): void;
  /** One frame of training; returns false when done. */
  tick(): boolean;
  reset(): void;
}

function clipShared(): ClipShared {
  const model = new ToyClip(12, 5);
  const s: ClipShared = {
    model,
    losses: [],
    listeners: [],
    running: false,
    notify() {
      for (const fn of s.listeners) fn();
    },
    tick() {
      for (let k = 0; k < 3; k++) {
        const l = model.train(model.sample(16), 0.003);
        const prev = s.losses.length ? s.losses[s.losses.length - 1]! : l;
        s.losses.push(0.9 * prev + 0.1 * l);
      }
      s.notify();
      return model.step < CLIP_STEPS;
    },
    reset() {
      model.reset(5);
      s.losses.length = 0;
      s.notify();
    },
  };
  return s;
}

/** The display batch, as (shape, color, size): some pairs differ only in shape. */
const SHOW6: [number, number, number][] = [
  [0, 0, 1],
  [1, 0, 1],
  [2, 0, 1],
  [0, 2, 0],
  [1, 2, 0],
  [2, 3, 0],
];

export function figClip(p: Page): ClipShared {
  const shared = clipShared();
  p.figure({
    title: 'A toy CLIP',
    codeTitle: 'clip_step.py',
    code: `
      # N image-caption pairs, no caption repeated
      z = normalize(image_encoder(images))   #@img
      t = normalize(text_encoder(captions))  #@txt
      scale = min(np.exp(log_scale), 100)  # 1/tau #@S
      S = scale * z @ t.T       # (N, N)   #@S
      labels = np.arange(N)
      loss = (cross_entropy(S, labels)           #@loss
              + cross_entropy(S.T, labels)) / 2  #@loss
      # step {{step:0}}  loss {{loss:…}}  tau {{tau:0.070}}
    `,
    setup(f) {
      const r = new Rng(31);
      const imgs = SHOW6.map(([sh, c, z]) => render(sh, c, z, r));
      const SHORT: Record<string, string> = { small: 'sml', yellow: 'yel', green: 'grn', circle: 'circ', square: 'sq', triangle: 'tri' };
      const cv = f.canvas(640, 520, (c, w, hh) => {
        const n = imgs.length;
        const { model } = shared;
        const z = model.encodeImages(imgs);
        const t = model.encodeTexts(imgs.map((im) => im.caption));
        const S = simMatrix(z, n, t, n, model.d, 1 / model.tau);
        const P = rowSoftmax(S, n, n);
        const thumb = Math.min(44, w * 0.1);
        const head = 52;
        const cell = Math.min((w - thumb - 24) / n, (hh - head - 26) / n);
        const mx = thumb + 14 + (w - thumb - 14 - cell * n) / 2;
        const my = head;
        const full = cell >= 52;
        imgs.forEach((im, i) => {
          const ts = Math.min(thumb, cell - 4);
          drawShape(c, im, mx - ts - 8, my + i * cell + (cell - ts) / 2, ts);
          const words = im.caption.split(' ').slice(1);
          words.forEach((wd, q) => txt(c, full ? wd : SHORT[wd] ?? wd, mx + i * cell + cell / 2, 9 + q * 14, { size: full ? 10.5 : 10, mono: true, color: color(q === 1 ? 'green' : '--ink-2'), weight: q === 1 ? 600 : 500 }));
        });
        heat(c, mx, my, cell, P, n, n, { col: 'teal', label: (v) => String(Math.round(v * 100)), font: 11 });
        txt(c, 'rows: images, columns: captions; each row is a softmax, in %', w / 2, hh - 8, { size: 10.5, color: color('--ink-3') });
      });
      cv.canvas.classList.add('scroll-ok');
      const chart = f.plot({
        height: 84,
        square: false,
        domain: [0, CLIP_STEPS, 0, 3],
        draw: (pl) => {
          pl.axes({ grid: 0.5 });
          const L = shared.losses;
          if (L.length > 1) pl.path(L.map((_, i) => i), L, color('red'), 2);
          pl.text('training loss', CLIP_STEPS * 0.99, 2.4, { size: 11, align: 'right', color: color('red') });
        },
      });
      const stepRo = f.readout('step');
      const lossRo = f.readout('loss', { sym: 'L' });
      const tauRo = f.readout('learned τ', { sym: 'tau' });
      let phase = 0;
      shared.listeners.push(() => {
        const { model } = shared;
        stepRo.set(model.step);
        lossRo.set(Number.isNaN(model.lastLoss) ? '–' : fmt(shared.losses[shared.losses.length - 1]!, 3));
        tauRo.set(fmt(model.tau, 3));
        f.code.setMany({ step: model.step, loss: Number.isNaN(model.lastLoss) ? '…' : fmt(shared.losses[shared.losses.length - 1]!, 3), tau: fmt(model.tau, 3) });
        cv.redraw();
        chart.redraw();
      });
      const loop = f.loop(() => {
        f.code.highlight([['img', 'txt'], ['S'], ['loss']][phase++ % 3]!);
        if (!shared.tick()) {
          stop();
          f.status('Done. The diagonal is nearly solid: each image picks out its own caption. The next figure uses this model.');
          return false;
        }
      });
      const stop = () => {
        loop.stop();
        btn.textContent = 'Train';
        f.code.highlight(null);
      };
      const btn = f.button('Train', () => {
        if (loop.running()) stop();
        else {
          if (shared.model.step >= CLIP_STEPS) shared.reset();
          loop.start();
          btn.textContent = 'Pause';
          f.status('');
        }
      }, { primary: true });
      f.button('Reset', () => {
        stop();
        shared.reset();
        f.status('');
      });
      shared.notify();
    },
    caption: `The image encoder is a small network on the 16 × 16 pixels; the text encoder averages one learned vector per word. Both map into the same 12-dimensional space, normalized. Rows are six images, columns their six captions, and each row is a softmax over the captions, so the gold diagonal is the right answer for every row (and, read down the columns, for every caption). Press **Train**. Color is learned within a hundred steps or so; size soon after; telling a circle from a square takes several hundred, and you can watch the off-diagonal cells between such pairs fade last. The temperature is a parameter too: it starts at CLIP's 0.07 and the model lowers it as it grows confident.`,
  });
  return shared;
}

/* ------------------------------------------------------------------ */
/* Fig: zero-shot classification with editable prompts                 */
/* ------------------------------------------------------------------ */

type Task = 'shape' | 'color' | 'size';
const DEFAULT_PROMPTS: Record<Task, string[]> = {
  shape: SHAPES.map((s) => `a ${s}`),
  color: COLORS.map((c) => `a ${c} shape`),
  size: SIZES.map((z) => `a ${z} one`),
};
const truth = (task: Task, im: ShapeImage) => (task === 'shape' ? im.shape : task === 'color' ? im.color : im.size);

export function figZeroShot(p: Page, shared: ClipShared): void {
  installCss(p.root);
  p.figure({
    title: 'Zero-shot: a classifier written in words',
    codeTitle: 'zero_shot.py',
    code: `
      prompts = [{{prompts}}]
      t = normalize(text_encoder(prompts))   # (C, d)   #@txt
      z = normalize(image_encoder(images))   # (M, d)   #@img
      S = z @ t.T                             # (M, C)   #@S
      pred = S.argmax(axis=1)   # most similar prompt    #@pred
      acc = (pred == labels).mean()           # {{acc}}  #@acc
    `,
    setup(f) {
      const test = makeSet(3, 77);
      const grid = makeSet(1, 78);
      let task: Task = 'shape';
      const prompts: Record<Task, string[]> = { shape: [...DEFAULT_PROMPTS.shape], color: [...DEFAULT_PROMPTS.color], size: [...DEFAULT_PROMPTS.size] };
      let sel = 0;
      let cells: { x: number; y: number; s: number }[] = [];
      const cv = f.canvas(640, 430, (c, w, hh) => {
        const pr = prompts[task];
        const { model } = shared;
        const { pred, S } = model.classify(grid, pr);
        const cols = 8;
        const gap = 6;
        const s = Math.min((w - gap * (cols - 1)) / cols, 52);
        const ox = (w - (s * cols + gap * (cols - 1))) / 2;
        cells = [];
        grid.forEach((im, i) => {
          const x = ox + (i % cols) * (s + gap);
          const y = 6 + Math.floor(i / cols) * (s + gap);
          cells.push({ x, y, s });
          drawShape(c, im, x, y, s);
          const k = color(CLASS_COLORS[pred[i]!]!);
          rbox(c, x - 1.5, y - 1.5, s + 3, s + 3, 4, null, k, i === sel ? 4 : 2.2);
          badge(c, x + s - 6, y + 6, 6, pred[i] === truth(task, im));
        });
        // The selected image's similarity to every prompt, as a softmax with the learned tau.
        const y0 = 6 + 3 * (s + gap) + 16;
        const row = Array.from({ length: pr.length }, (_, q) => S[sel * pr.length + q]! / model.tau);
        const mx = Math.max(...row);
        const e = row.map((v) => Math.exp(v - mx));
        const tot = e.reduce((a, b) => a + b, 0);
        const bh = Math.min(22, (hh - y0 - 4) / pr.length - 4);
        const lw = Math.min(150, w * 0.32);
        txt(c, `selected image vs each prompt (softmax of S / τ)`, w / 2, y0 - 7, { size: 10.5, color: color('--ink-3') });
        pr.forEach((q, k) => {
          const y = y0 + 4 + k * (bh + 4);
          const label = q.length > 22 ? `${q.slice(0, 21)}…` : q;
          txt(c, label || '(empty)', lw, y + bh / 2, { size: 11.5, mono: true, align: 'right', color: color(CLASS_COLORS[k]!) });
          const bw = (w - lw - 70) * (e[k]! / tot);
          rbox(c, lw + 8, y, Math.max(2, bw), bh, 4, withAlpha(color(CLASS_COLORS[k]!), 0.7), null);
          txt(c, `${Math.round((100 * e[k]!) / tot)}%`, lw + 14 + Math.max(2, bw), y + bh / 2, { size: 11, mono: true, align: 'left', color: color('--ink-2') });
        });
      });
      cv.canvas.classList.add('scroll-ok');
      cv.canvas.addEventListener('pointerdown', (e) => {
        const [px, py] = localXY(cv.canvas, e);
        const k = cells.findIndex((q) => px >= q.x && px <= q.x + q.s && py >= q.y && py <= q.y + q.s);
        if (k >= 0) {
          sel = k;
          cv.redraw();
        }
      });
      const accRo = f.readout('zero-shot accuracy');
      const box = h('div', { class: 'cl-prompts' });
      const rows: { inp: HTMLInputElement; note: HTMLElement; dot: HTMLElement }[] = [];
      const buildRows = () => {
        box.replaceChildren();
        rows.length = 0;
        prompts[task].forEach((q, k) => {
          const inp = h('input', { class: 'cl-input', type: 'text', value: q, spellcheck: 'false', autocapitalize: 'off', 'aria-label': `prompt for class ${k}` });
          const dot = h('span', { class: 'cl-dot' });
          dot.style.background = `var(--c-${CLASS_COLORS[k]})`;
          const note = h('span', { class: 'cl-note' });
          inp.addEventListener('input', () => {
            prompts[task][k] = inp.value;
            f.code.highlight('txt');
            update();
          });
          box.append(h('div', { class: 'cl-row' }, dot, inp, note));
          rows.push({ inp, note, dot });
        });
      };
      f.segmented({
        label: 'classify by',
        options: [
          { value: 'shape', label: 'shape' },
          { value: 'color', label: 'color' },
          { value: 'size', label: 'size' },
        ],
        value: 'shape',
        onChange: (v) => {
          task = v as Task;
          buildRows();
          update();
        },
      });
      f.controls.append(box);
      const trainBtn = f.button('Train the toy CLIP', () => {
        if (trainLoop.running()) {
          trainLoop.stop();
          trainBtn.textContent = 'Train the toy CLIP';
        } else {
          if (shared.model.step >= CLIP_STEPS) shared.reset();
          trainLoop.start();
          trainBtn.textContent = 'Pause';
        }
      });
      const trainLoop = f.loop(() => {
        if (!shared.tick()) {
          trainBtn.textContent = 'Train the toy CLIP';
          return false;
        }
      });
      f.button('Restore prompts', () => {
        prompts[task] = [...DEFAULT_PROMPTS[task]];
        buildRows();
        update();
      });
      function update() {
        const pr = prompts[task];
        const { model } = shared;
        const { pred } = model.classify(test, pr);
        const acc = pred.filter((q, i) => q === truth(task, test[i]!)).length / test.length;
        accRo.set(`${Math.round(acc * 100)}%  (chance ${Math.round(100 / pr.length)}%)`);
        f.code.setMany({ prompts: pr.map((q) => `"${q}"`).join(', '), acc: fmt(acc, 2) });
        rows.forEach((rw, k) => {
          const enc = model.encodeText(pr[k]!);
          rw.note.innerHTML = enc.unknown.length
            ? `ignored (not in the toy's ${VOCAB.length}-word vocabulary): ${enc.unknown.map((u) => `<s>${u.replace(/[<>&]/g, '')}</s>`).join(' ')}`
            : enc.known.length ? '' : 'no known words: this prompt is the zero vector';
        });
        f.status(model.step === 0 ? 'The toy CLIP is untrained, so this is guessing. Press **Train the toy CLIP** (or Train in the figure above).' : model.step < CLIP_STEPS ? `trained for ${model.step} of ${CLIP_STEPS} steps` : '');
        cv.redraw();
      }
      shared.listeners.push(update);
      buildRows();
      update();
    },
    caption: `Each prompt becomes a text embedding, and the prompts together are the weights of a classifier: an image goes to the prompt it is most similar to. No image was ever labeled "circle"; every training caption named a size, a color and a shape at once. Train the model (here or above), then classify by shape, color or size. Rings show each image's predicted class; tap an image to see its scores. Now edit the prompts. Swap two of them and accuracy collapses, because the classes are now described wrongly. Try \`a big red circle\` against \`a small blue square\`, or words the toy never saw, such as \`photo\`: they are ignored, because this text encoder only knows its ${VOCAB.length} words. Real CLIP reads any text through a tokenizer and a transformer, and there the exact wording of a prompt changes accuracy, as described below this figure.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: MAE masking, with a no-learning fill                           */
/* ------------------------------------------------------------------ */

export function figMAE(p: Page): void {
  p.figure({
    title: 'Hide most of the image',
    codeTitle: 'mae_mask.py',
    code: `
      patches = patchify(img, 4)      # (64, 48) #@patch
      ratio = {{ratio:0.75}}
      n_keep = int(64 * (1 - ratio))  # {{keep:16}}   #@keep
      ids = np.argsort(np.random.rand(64))       #@shuffle
      keep, masked = ids[:n_keep], ids[n_keep:]  #@shuffle
      # MAE: pred = decoder(encoder(patches[keep]), ids)
      pred = naive_fill(patches, keep)  # no network  #@fill
      err = ((pred[masked] - patches[masked]) ** 2).mean()  #@loss
      # err = {{err}}
    `,
    setup(f) {
      let set: CifarSet | null = null;
      let pick = 0;
      let img: Img | null = null;
      let order: number[] = [];
      let ratio = 0.75;
      let fill: Img | null = null;
      let curve: [number, number][] = [];
      let meanErr = 0;
      const picks = [3, 11, 25, 40, 57, 74];
      let mr = new Rng(5);
      const newOrder = () => {
        const noise = Array.from({ length: NPATCH }, () => mr.next());
        order = Array.from({ length: NPATCH }, (_, i) => i).sort((a, b) => noise[a]! - noise[b]!);
      };
      const recompute = () => {
        if (!img) return;
        const { keep, masked } = maskFromOrder(order, ratio);
        fill = naiveFill(img, keep);
        const err = maskedMSE(fill, img, masked);
        f.code.setMany({ keep: keep.length, err: fmt(err, 4) });
        visRo.set(`${keep.length} of ${NPATCH}`);
        errRo.set(fmt(err, 4));
        cv.redraw();
        pl.redraw();
      };
      const cv = f.canvas(640, 250, (c, w, hh) => {
        if (!img || !fill) {
          txt(c, 'loading CIFAR-10…', w / 2, hh / 2, { color: color('--ink-3') });
          return;
        }
        const gap = Math.max(10, w * 0.03);
        const size = Math.min((w - 2 * gap) / 3, hh - 34);
        const ox = (w - 3 * size - 2 * gap) / 2;
        const y = 6;
        const { keep } = maskFromOrder(order, ratio);
        const vis = new Set(keep);
        drawImg(c, img, ox, y, size);
        // What the encoder sees: visible patches only.
        const ps = size / GRID;
        const x1 = ox + size + gap;
        c.fillStyle = color('--paper-2');
        c.fillRect(x1, y, size, size);
        c.save();
        c.beginPath();
        for (const k of vis) c.rect(x1 + (k % GRID) * ps, y + Math.floor(k / GRID) * ps, ps, ps);
        c.clip();
        drawImg(c, img, x1, y, size);
        c.restore();
        c.strokeStyle = withAlpha(color('--ink'), 0.12);
        c.lineWidth = 1;
        for (let g = 1; g < GRID; g++) {
          c.beginPath();
          c.moveTo(x1 + g * ps, y);
          c.lineTo(x1 + g * ps, y + size);
          c.moveTo(x1, y + g * ps);
          c.lineTo(x1 + size, y + g * ps);
          c.stroke();
        }
        drawImg(c, fill, ox + 2 * (size + gap), y, size);
        for (let q = 0; q < 3; q++) rbox(c, ox + q * (size + gap) - 1, y - 1, size + 2, size + 2, 3, null, withAlpha(color('--ink'), 0.25));
        const labels = ['original', `encoder sees ${keep.length}`, 'naive fill'];
        labels.forEach((lb, q) => txt(c, lb, ox + q * (size + gap) + size / 2, y + size + 14, { size: 11, color: color(q === 1 ? 'orange' : '--ink-3') }));
      });
      cv.canvas.classList.add('scroll-ok');
      const pl = f.plot({
        height: 120,
        square: false,
        domain: [0, 1, 0, 0.03],
        draw: (q) => {
          const ymax = Math.max(0.01, meanErr, ...curve.map((v) => v[1])) * 1.15;
          q.setDomain(0, 1, 0, ymax);
          q.axes({ grid: 0.1 });
          if (meanErr) {
            q.path([0, 1], [meanErr, meanErr], withAlpha(color('--ink-3'), 0.9), 1.2, [5, 4]);
            q.text('average color', 0.02, meanErr + ymax * 0.04, { size: 10.5, color: color('--ink-3') });
          }
          if (curve.length > 1) q.path(curve.map((v) => v[0]), curve.map((v) => v[1]), color('red'), 2);
          for (const [x, yv] of curve) q.dot(x, yv, 2.5, color('red'));
          q.path([ratio, ratio], [0, ymax], withAlpha(color('orange'), 0.8), 1.5, [4, 3]);
          q.text('naive-fill error on hidden pixels', 0.02, ymax * 0.6, { size: 10.5, color: color('red') });
          q.text(`${Math.round(ratio * 100)}%`, ratio + (ratio > 0.85 ? -0.01 : 0.01), ymax * 0.08, { size: 10.5, align: ratio > 0.85 ? 'right' : 'left', color: color('orange') });
        },
      });
      const visRo = f.readout('visible patches');
      const errRo = f.readout('fill error');
      f.slider({
        label: 'mask ratio',
        min: 0.05,
        max: 0.95,
        step: 0.05,
        value: 0.75,
        slot: 'ratio',
        format: (v) => fmt(v, 2),
        onInput: (v) => {
          ratio = v;
          f.code.highlight(['keep', 'fill']);
          recompute();
        },
      });
      f.button('New mask', () => {
        newOrder();
        f.code.highlight('shuffle');
        recompute();
      }, { icon: 'shuffle' });
      f.button('Other image', () => {
        if (!set) return;
        pick = (pick + 1) % picks.length;
        img = fromCifar(set, picks[pick]!);
        recompute();
      });
      newOrder();
      loadCifar()
        .then((d) => {
          set = d.train;
          img = fromCifar(set, picks[0]!);
          recompute();
          // The curve: average error over 12 images at each ratio, one fixed random order per image.
          const cr = new Rng(9);
          const imgs = Array.from({ length: 12 }, (_, k) => fromCifar(set!, 100 + 37 * k));
          const orders = imgs.map(() => {
            const noise = Array.from({ length: NPATCH }, () => cr.next());
            return Array.from({ length: NPATCH }, (_, i) => i).sort((a, b) => noise[a]! - noise[b]!);
          });
          curve = [];
          meanErr = 0;
          for (let rt = 0.1; rt < 0.951; rt += 0.1) {
            let e = 0;
            imgs.forEach((im, k) => {
              const { keep, masked } = maskFromOrder(orders[k]!, rt);
              e += maskedMSE(naiveFill(im, keep), im, masked) / imgs.length;
            });
            curve.push([rt, e]);
          }
          // Reference: fill every hidden pixel with the image's average color (all patches hidden).
          imgs.forEach((im) => {
            const avg = new Float32Array(im.length);
            for (let c = 0; c < 3; c++) {
              let m = 0;
              for (let q = c; q < im.length; q += 3) m += im[q]! / (im.length / 3);
              for (let q = c; q < im.length; q += 3) avg[q] = m;
            }
            meanErr += maskedMSE(avg, im, Array.from({ length: NPATCH }, (_, i) => i)) / imgs.length;
          });
          pl.redraw();
        })
        .catch((e) => f.status(`Could not load CIFAR-10: ${(e as Error).message}`));
      void PATCH;
      void SIDE;
    },
    caption: `A CIFAR-10 image cut into 64 patches of 4 × 4 pixels (MAE on ImageNet uses 196 patches of 16 × 16). The middle panel is all the encoder gets. The right panel fills the holes with no learning at all: every hidden pixel is a weighted average of the nearest visible pixels. Slide the ratio down to 25%: the naive fill already recovers much of each hidden patch, because neighboring pixels are nearly the same, so a network could do well at that task just by interpolating, and would learn little. At 75% the fill smears every edge and texture: on the red curve (12 images) its error is about 70% higher, and at 90% it is barely better than painting every hole with the image's average color (dashed). To do better than smearing at 75%, MAE's network has to know what birds, wheels and horses look like. This figure shows the task, not MAE's result; a trained MAE's reconstructions are blurry but recognizable.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: DINO's centering and sharpening, on the toy data               */
/* ------------------------------------------------------------------ */

const DINO_STEPS = 1500;

export function figDino(p: Page): void {
  p.figure({
    title: 'Self-distillation: centering and sharpening',
    codeTitle: 'dino.py',
    code: `
      gt.params = gs.params.copy()  # teacher = student
      center = np.zeros(K)          # K = 6 outputs
      for x in loader:
          g1, g2 = global_view(x), global_view(x)  #@teacher
          l1, l2 = local_view(x), local_view(x)    #@student
          s1, s2 = gs(l1), gs(l2)                  #@student
          t1, t2 = gt(g1), gt(g2)       # no grad  #@teacher
          loss = H(t1, s2) / 2 + H(t2, s1) / 2     #@loss
          gs.step(grad(loss))                      #@upd
          gt.params = m * gt.params + (1 - m) * gs.params  #@ema
          batch_mean = np.vstack([t1, t2]).mean(0) #@center
          center = 0.9 * center + 0.1 * batch_mean #@center

      def H(tl, sl):
          pt = softmax((tl - {{c:center}}) / {{tt:0.04}})  #@sharp
          ps = softmax(sl / 0.1)
          return -(pt * np.log(ps)).sum(1).mean()
      # m = 0.99   step {{step:0}}
    `,
    setup(f) {
      const data = makeToy();
      const dn = new ToyDino(data, 5);
      let centering = true;
      let tt = 0.04;
      const pl = f.plot({
        aspect: 1.35,
        domain: [-1.25, 1.25, -1.15, 1.2],
        draw: (q) => {
          q.axes({ grid: 0.5 });
          const st = dn.stats(centering, tt);
          for (let i = 0; i < data.n; i++) {
            const k = color(CLASS_COLORS[st.argmax[i]!]!);
            const a = 0.15 + 0.85 * Math.max(0, (st.conf[i]! - 1 / DINO_K) / (1 - 1 / DINO_K));
            q.dot(data.X[i * 6]!, data.X[i * 6 + 1]!, 5, withAlpha(k, a), withAlpha(color('--paper'), 0.9));
          }
          q.text("color: the teacher's top output", -1.2, -1.08, { size: 10.5, color: color('--ink-3') });
        },
      });
      const bars = f.canvas(640, 160, (c, w, hh) => {
        const st = dn.stats(centering, tt);
        const left = 8;
        const bw = (w - left * 2) / DINO_K;
        txt(c, "teacher's average output over its 6 dimensions", w / 2, 9, { size: 10.5, color: color('--ink-3') });
        const base = hh - 17;
        const top = 24;
        const full = Math.max(0.5, ...st.mean);
        const yOf = (v: number) => base - (v / full) * (base - top);
        for (let k = 0; k < DINO_K; k++) {
          const v = st.mean[k]!;
          const x = left + k * bw + bw * 0.15;
          rbox(c, x, yOf(v), bw * 0.7, Math.max(1, base - yOf(v)), 3, withAlpha(color(CLASS_COLORS[k]!), 0.8), null);
          txt(c, v.toFixed(2), x + bw * 0.35, base + 9, { size: 10.5, mono: true, color: color('--ink-2') });
        }
        c.strokeStyle = withAlpha(color('--ink'), 0.35);
        c.setLineDash([4, 3]);
        c.beginPath();
        c.moveTo(left, yOf(1 / DINO_K));
        c.lineTo(w - left, yOf(1 / DINO_K));
        c.stroke();
        c.setLineDash([]);
        txt(c, 'uniform', left + 2, yOf(1 / DINO_K) - 7, { size: 10, align: 'left', color: color('--ink-3'), halo: true });
      });
      bars.canvas.classList.add('scroll-ok');
      const stepRo = f.readout('step');
      const entRo = f.readout('per-item entropy');
      const usedRo = f.readout('dimensions in use');
      const sync = () => {
        const st = dn.stats(centering, tt);
        const used = new Set(Array.from(st.argmax)).size;
        stepRo.set(dn.step);
        entRo.set(`${fmt(st.sampleEntropy, 2)} of ${fmt(Math.log(DINO_K), 2)}`);
        usedRo.set(`${used} of ${DINO_K}`);
        f.code.set('step', dn.step);
        pl.redraw();
        bars.redraw();
      };
      let phase = 0;
      const loop = f.loop(() => {
        for (let k = 0; k < 4; k++) dn.train({ centering, tt });
        f.code.highlight([['student', 'teacher'], ['loss', 'sharp'], ['upd', 'ema', 'center']][phase++ % 3]!);
        sync();
        if (dn.step >= DINO_STEPS) {
          stop();
          const st = dn.stats(centering, tt);
          const used = new Set(Array.from(st.argmax)).size;
          f.status(used <= 1 ? 'Collapsed: one dimension takes everything, whatever the input.' : st.sampleEntropy > Math.log(DINO_K) * 0.9 ? 'Collapsed the other way: every output is close to uniform, so it says nothing about the input.' : 'Done: the teacher sorts the items into groups that follow the hidden classes, without ever seeing a label.');
          return false;
        }
      });
      const stop = () => {
        loop.stop();
        btn.textContent = 'Train';
        f.code.highlight(null);
      };
      const reset = () => {
        stop();
        dn.reset(5);
        f.status('');
        sync();
      };
      const btn = f.button('Train', () => {
        if (loop.running()) stop();
        else {
          if (dn.step >= DINO_STEPS) reset();
          loop.start();
          btn.textContent = 'Pause';
          f.status('');
        }
      }, { primary: true });
      f.button('Reset', reset);
      f.toggle({
        label: 'centering',
        value: true,
        onChange: (v) => {
          centering = v;
          f.code.set('c', v ? 'center' : '0');
          f.code.highlight('sharp');
          reset();
        },
      });
      f.segmented({
        label: 'teacher τ (student: 0.1)',
        options: [
          { value: '0.04', label: '0.04' },
          { value: '0.1', label: '0.1' },
        ],
        value: '0.04',
        slot: 'tt',
        onChange: (v) => {
          tt = Number(v);
          f.code.highlight('sharp');
          reset();
        },
      });
      sync();
    },
    caption: `The toy data of the training figure, now with DINO: a student network outputs 6 numbers, a teacher with the same shape is a moving average of the student, and the student learns to match the teacher's softmax on a different view. The student's views are jittered more than the teacher's, like DINO's small local crops against its large global ones. Each dot is an item placed at its two content numbers and colored by the teacher's top output (faint means unsure). At the start the teacher is a random network: sharp, but its choices are scattered, so neighbors disagree. Press **Train** with both tricks on: the outputs organize along the four hidden blobs, each blob taking one or two of the six dimensions. Now turn **centering** off and train: one dimension swallows everything, and the loss falls to zero, which looks like success. Turn it back on but set the teacher's τ to the student's 0.1 (no sharpening): every output flattens to uniform. Each trick alone collapses in its own direction; together they balance.`,
  });
}
