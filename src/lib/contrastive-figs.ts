import { fmt } from '../core/code';
import { CIFAR_CLASSES, type CifarSet, loadCifar } from '../core/data';
import type { Page } from '../core/page';
import { CLASS_COLORS, color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { type AugOpts, type Img, SIDE, augmentImage, drawImg, fromCifar } from './contrastive-aug';
import { heat, localXY, rbox, txt, unitCircle } from './contrastive-draw';
import { rowSoftmax, simMatrix } from './contrastive-net';
import { MOCO_N, MOCO_Q, MOCO_T, THETA_Q, emaPath } from './contrastive-moco';
import { TOY_K, ToyContrastive, type ToyMode, augment, makeToy } from './contrastive-toy';

/* ------------------------------------------------------------------ */
/* Fig: two random views of every image                                */
/* ------------------------------------------------------------------ */

/** Classes of the four images shown at a time, cycled by "other images". */
const VIEW_CLASSES = [[3, 1, 7, 8], [5, 0, 2, 9], [6, 4, 3, 1]];

export function figViews(p: Page): void {
  p.figure({
    title: 'Two random views of every image',
    codeTitle: 'two_views.py',
    code: `
      def augment(img):                 # (32, 32, 3)
          if {{crop:True}}:
              img = random_resized_crop(img, (0.25, 1))  #@crop
          if {{flip:True}} and np.random.rand() < 0.5:
              img = img[:, ::-1]               # mirror  #@flip
          if {{color:True}} and np.random.rand() < 0.8:
              img = color_jitter(img, 0.4, 0.4, 0.4, 0.1)  #@color
          if {{gray:True}} and np.random.rand() < 0.2:
              img = to_gray(img)                         #@gray
          return img

      x = images[[{{ids}}]]       # 4 images
      x1 = np.stack([augment(im) for im in x])   #@views
      x2 = np.stack([augment(im) for im in x])   #@views
      # positive pair: x1[{{sel:0}}], x2[{{sel:0}}]  #@pair
    `,
    setup(f) {
      const opts: AugOpts = { crop: true, flip: true, color: true, gray: true };
      let set: CifarSet | null = null;
      let group = 0;
      let seed = 1;
      let sel = 0;
      let ids: number[] = [];
      let originals: Img[] = [];
      let views: ReturnType<typeof augmentImage>[][] = [];
      let colX: number[] = [];
      let colW = 0;
      const resample = () => {
        if (!set) return;
        const r = new Rng(seed * 7919 + group);
        views = originals.map((im) => [augmentImage(im, r, opts), augmentImage(im, r, opts)]);
        cv.redraw();
      };
      const pickImages = () => {
        if (!set) return;
        // The third group repeats two classes, so it takes a later example of each.
        ids = VIEW_CLASSES[group]!.map((c) => nthOfClass(set!, c, group === 2 ? 3 : 0) ?? 0);
        originals = ids.map((i) => fromCifar(set!, i));
        f.code.set('ids', ids.join(', '));
        resample();
      };
      const cv = f.canvas(640, 520, (c, w, h) => {
        if (!set || !views.length) {
          txt(c, 'loading CIFAR-10…', w / 2, h / 2, { color: color('--ink-3') });
          return;
        }
        const left = 30;
        const gap = Math.max(8, w * 0.025);
        colW = (w - left - gap * 3 - 4) / 4;
        const size = Math.min(colW, (h - 82) / 3);
        const rowY = [6, 6 + size + 22, 6 + 2 * size + 30];
        colX = [0, 1, 2, 3].map((k) => left + k * (colW + gap) + (colW - size) / 2);
        txt(c, 'x', 11, rowY[0]! + size / 2, { serif: true, italic: true, size: 15, weight: 600, color: color('--ink-3') });
        txt(c, 'x1', 13, rowY[1]! + size / 2, { mono: true, size: 12, weight: 600, color: color('orange') });
        txt(c, 'x2', 13, rowY[2]! + size / 2, { mono: true, size: 12, weight: 600, color: color('orange') });
        for (let k = 0; k < 4; k++) {
          const x = colX[k]!;
          const on = k === sel;
          drawImg(c, originals[k]!, x, rowY[0]!, size);
          rbox(c, x - 1, rowY[0]! - 1, size + 2, size + 2, 3, null, withAlpha(color('--ink'), 0.25), 1);
          txt(c, CIFAR_CLASSES[set.labels[ids[k]!]!]!, x + size / 2, rowY[0]! + size + 10, { size: 11, color: color('--ink-3') });
          if (on && opts.crop) {
            views[k]!.forEach((v, q) => {
              const [bx, by, bw, bh] = v.box;
              const s = size / SIDE;
              c.save();
              c.setLineDash(q ? [4, 3] : []);
              c.strokeStyle = color(q ? 'teal' : 'orange');
              c.lineWidth = 2;
              c.strokeRect(x + bx * s, rowY[0]! + by * s, bw * s, bh * s);
              c.restore();
            });
          }
          for (let q = 0; q < 2; q++) {
            const y = rowY[q + 1]!;
            drawImg(c, views[k]![q]!.img, x, y, size);
            rbox(c, x - 2, y - 2, size + 4, size + 4, 4, null, on ? color('gold') : withAlpha(color('--ink'), 0.2), on ? 3 : 1);
          }
        }
        const x0 = colX[sel]!;
        txt(c, 'positive pair', x0 + size / 2, rowY[2]! + size + 14, { size: 11.5, weight: 650, color: color('gold') });
        txt(c, 'tap a column to choose the positive pair', w / 2, h - 7, { size: 11, color: color('--ink-3') });
      });
      cv.canvas.classList.add('scroll-ok');
      cv.canvas.addEventListener('pointerdown', (e) => {
        const [px] = localXY(cv.canvas, e);
        let best = 0;
        colX.forEach((x, k) => {
          if (Math.abs(px - (x + colW / 2)) < Math.abs(px - (colX[best]! + colW / 2))) best = k;
        });
        sel = best;
        f.code.setMany({ sel });
        f.code.highlight('pair');
        cv.redraw();
      });
      const tog = (key: keyof AugOpts, label: string) =>
        f.toggle({
          label,
          value: true,
          onChange: (v) => {
            opts[key] = v;
            f.code.set(key, v ? 'True' : 'False');
            f.code.highlight(key);
            resample();
          },
        });
      tog('crop', 'crop');
      tog('flip', 'flip');
      tog('color', 'color jitter');
      tog('gray', 'grayscale');
      f.button('New views', () => {
        seed++;
        f.code.highlight('views');
        resample();
      }, { primary: true, icon: 'shuffle' });
      f.button('Other images', () => {
        group = (group + 1) % VIEW_CLASSES.length;
        pickImages();
      });
      loadCifar()
        .then((d) => {
          set = d.train;
          pickImages();
        })
        .catch((e) => f.status(`Could not load CIFAR-10: ${(e as Error).message}`));
    },
    caption: `Four CIFAR-10 images (top) and two augmented views of each, made by the function on the right with fresh randomness every time. The two views of one image (gold) form a **positive pair**; in this batch of eight views, the other six are its **negatives**. The dashed boxes on the selected original show where each view's crop came from. Press **New views** a few times: a pair can share almost no pixels, differ in color, or be mirrored, and yet both are still the same cat. Turn augmentations off one by one: with all four off, the two views are identical copies and the task becomes trivial (match each image to itself), which is why the augmentations, not the loss, decide what the network learns to ignore.`,
  });
}

function nthOfClass(set: CifarSet, c: number, n: number): number | null {
  let k = 0;
  for (let i = 0; i < set.n; i++) if (set.labels[i] === c && k++ === n) return i;
  return null;
}

/* ------------------------------------------------------------------ */
/* Fig: InfoNCE on a batch you can drag                                */
/* ------------------------------------------------------------------ */

export function figInfoNCE(p: Page): void {
  p.figure({
    title: 'InfoNCE: a softmax over the batch',
    codeTitle: 'info_nce.py',
    code: `
      tau = {{tau:0.3}}
      z1 = np.c_[np.cos(a1), np.sin(a1)]  #@z
      z2 = np.c_[np.cos(a2), np.sin(a2)]  #@z
      S = z1 @ z2.T / tau     # (4, 4)    #@S
      P = softmax(S, axis=1)              #@P
      labels = np.arange(4)   # diagonal  #@y
      L_i = -np.log(P[labels, labels])    #@loss
      loss = L_i.mean()       # {{loss}}  #@loss
      # row {{i:0}}: P = [{{prow}}]
    `,
    setup(f) {
      const N = 4;
      // Angles (radians) of view 1 and view 2; row 2's views start far apart.
      const a1 = [0.4, 1.9, 3.3, 4.6];
      const a2 = [0.75, 1.6, 5.1, 4.9];
      let tau = 0.3;
      let sel = 2;
      let drag: { which: 0 | 1; i: number } | null = null;
      let geo = { cx: 0, cy: 0, R: 0 };
      let mgeo = { mx: 0, my: 0, cell: 0 };
      const mats = () => {
        const z1 = new Float64Array(N * 2), z2 = new Float64Array(N * 2);
        for (let i = 0; i < N; i++) {
          z1[2 * i] = Math.cos(a1[i]!);
          z1[2 * i + 1] = Math.sin(a1[i]!);
          z2[2 * i] = Math.cos(a2[i]!);
          z2[2 * i + 1] = Math.sin(a2[i]!);
        }
        const S = simMatrix(z1, N, z2, N, 2, 1 / tau);
        return { S, P: rowSoftmax(S, N, N) };
      };
      const circ = f.canvas(640, 400, (c, w, h) => {
        const R = Math.min(h * 0.36, w * 0.3);
        const cx = w / 2;
        const cy = h * 0.5;
        geo = { cx, cy, R };
        unitCircle(c, cx, cy, R);
        for (let i = 0; i < N; i++) {
          const k = color(CLASS_COLORS[i]!);
          const on = i === sel;
          const pts = [a1[i]!, a2[i]!].map((a) => [cx + R * Math.cos(a), cy - R * Math.sin(a)] as const);
          c.strokeStyle = withAlpha(k, on ? 0.9 : 0.35);
          c.lineWidth = on ? 2 : 1;
          c.setLineDash([3, 3]);
          c.beginPath();
          for (const [x, y] of pts) {
            c.moveTo(cx, cy);
            c.lineTo(x, y);
          }
          c.stroke();
          c.setLineDash([]);
          const rad = on ? 9 : 7.5;
          c.beginPath();
          c.arc(pts[0]![0], pts[0]![1], rad, 0, Math.PI * 2);
          c.fillStyle = k;
          c.fill();
          c.beginPath();
          c.arc(pts[1]![0], pts[1]![1], rad, 0, Math.PI * 2);
          c.fillStyle = color('--paper');
          c.fill();
          c.strokeStyle = k;
          c.lineWidth = 3;
          c.stroke();
          [a1[i]!, a2[i]!].forEach((a, q) => {
            const lx = cx + (R + 34) * Math.cos(a);
            const ly = cy - (R + 22) * Math.sin(a);
            txt(c, `${q ? 'z2' : 'z1'}[${i}]`, lx, ly, { size: 11, mono: true, weight: 600, color: k, halo: true });
          });
        }
      });
      const mat = f.canvas(640, 290, (c, w, h) => {
        const { P } = mats();
        const cell = Math.min((h - 40) / N, w * 0.11);
        const mx = 42;
        const my = 24;
        mgeo = { mx, my, cell };
        txt(c, 'P = softmax(S), %', mx + (cell * N) / 2, 10, { size: 11, color: color('--ink-3') });
        for (let i = 0; i < N; i++) {
          txt(c, `z1[${i}]`, mx - 4, my + i * cell + cell / 2, { size: 11, mono: true, align: 'right', color: color(CLASS_COLORS[i]!) });
          txt(c, cell < 44 ? `${i}` : `z2[${i}]`, mx + i * cell + cell / 2, my + N * cell + 9, { size: 11, mono: true, color: color(CLASS_COLORS[i]!) });
        }
        heat(c, mx, my, cell, P, N, N, { col: 'teal', label: (v) => String(Math.round(v * 100)), hiRow: sel, font: 11 });
        // The selected row as bars: each candidate's probability is also its share of the push.
        const row = Array.from({ length: N }, (_, j) => P[sel * N + j]!);
        const bx0 = mx + cell * N + 26;
        const bw = (w - bx0 - 6) / N;
        const top = 34;
        const base = h - 28;
        const narrow = w - bx0 < 200;
        txt(c, narrow ? `row ${sel}` : `row ${sel}: who is z1[${sel}]'s partner?`, bx0 + (w - bx0) / 2, 10, { size: 11, color: color('--ink-3') });
        for (let j = 0; j < N; j++) {
          const v = row[j]!;
          const x = bx0 + j * bw + bw * 0.18;
          const hb = v * (base - top);
          rbox(c, x, base - hb, bw * 0.64, Math.max(1, hb), 3, withAlpha(color(j === sel ? 'gold' : 'teal'), j === sel ? 0.85 : 0.55), null);
          txt(c, `${Math.round(v * 100)}%`, x + bw * 0.32, base - hb - 8, { size: 11, mono: true, color: color('--ink-2') });
          txt(c, narrow ? `${j}` : `z2[${j}]`, x + bw * 0.32, base + 10, { size: 11, mono: true, color: color(CLASS_COLORS[j]!) });
        }
        c.strokeStyle = color('--axis');
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(bx0, base + 0.5);
        c.lineTo(w - 6, base + 0.5);
        c.stroke();
        txt(c, narrow ? `L_${sel} = ${fmt(-Math.log(row[sel]!), 3)}` : `L_${sel} = −log P[${sel},${sel}] = ${fmt(-Math.log(row[sel]!), 3)}`, bx0 + (w - bx0) / 2, h - 6, { size: 11.5, mono: true, weight: 600, color: color('red') });
      });
      mat.canvas.classList.add('scroll-ok');
      mat.canvas.addEventListener('pointerdown', (e) => {
        const [px, py] = localXY(mat.canvas, e);
        const { mx, my, cell } = mgeo;
        if (px >= mx - 40 && px <= mx + cell * N && py >= my && py <= my + cell * N) {
          sel = Math.floor((py - my) / cell);
          sync('P');
        }
      });
      const pick = (e: PointerEvent) => {
        const [px, py] = localXY(circ.canvas, e);
        const { cx, cy, R } = geo;
        let best: { which: 0 | 1; i: number } | null = null;
        let bd = Infinity;
        for (let i = 0; i < N; i++)
          for (const which of [0, 1] as const) {
            const a = which ? a2[i]! : a1[i]!;
            const d = Math.hypot(px - (cx + R * Math.cos(a)), py - (cy - R * Math.sin(a)));
            if (d < bd) {
              bd = d;
              best = { which, i };
            }
          }
        return bd < 34 ? best : null;
      };
      const move = (e: PointerEvent) => {
        if (!drag) return;
        const [px, py] = localXY(circ.canvas, e);
        (drag.which ? a2 : a1)[drag.i] = Math.atan2(-(py - geo.cy), px - geo.cx);
        sel = drag.i;
        sync('S');
      };
      circ.canvas.addEventListener('pointerdown', (e) => {
        drag = pick(e);
        if (drag) {
          circ.canvas.setPointerCapture(e.pointerId);
          move(e);
        }
      });
      circ.canvas.addEventListener('pointermove', move);
      circ.canvas.addEventListener('pointerup', () => (drag = null));
      const lossRo = f.readout('loss', { sym: 'L' });
      const rowRo = f.readout('selected row');
      f.slider({
        label: 'τ',
        sym: 'tau',
        min: Math.log10(0.05),
        max: 0,
        step: 0.01,
        value: Math.log10(0.3),
        map: (r) => 10 ** r,
        format: (v) => fmt(v, 2),
        slot: 'tau',
        onInput: (v) => {
          tau = v;
          sync('P');
        },
      });
      function sync(line: string) {
        const { P } = mats();
        let loss = 0;
        for (let i = 0; i < N; i++) loss -= Math.log(P[i * N + i]!) / N;
        f.code.setMany({ loss: fmt(loss, 3), i: sel, prow: Array.from({ length: N }, (_, j) => P[sel * N + j]!.toFixed(2)).join(', ') });
        f.code.highlight(line === 'S' ? ['z', 'S'] : line === 'P' ? ['P', 'loss'] : line);
        lossRo.set(loss);
        rowRo.set(`${sel}: ${fmt(-Math.log(P[sel * N + sel]!), 3)}`);
        circ.redraw();
        mat.redraw();
      }
      sync('loss');
    },
    caption: `Four images, two views each: filled dots are \`z1\`, rings are \`z2\`, one color per image. Every row of the matrix is a softmax over the four candidates in view 2, in percent, and the gold diagonal marks the right answers. **Drag** any dot around the circle, or tap a row. Pull ring 2 next to dot 2 and row 2 turns gold-heavy: its loss falls. Park two different images close together and both of their rows get confused. The bars show the selected row, and each bar is also how hard the loss pushes that candidate away (the next equation). Slide $\\symtau$ down: the softmax sharpens, the closest candidates take nearly all the probability, and the loss becomes much more sensitive to small angles.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: train an embedding; collapse without negatives                 */
/* ------------------------------------------------------------------ */

const TRAIN_STEPS = 1500;
/** Items shown in the batch matrix: two per hidden class. */
const SHOW = [0, 4, 1, 5, 2, 6, 3, 7];

export function figTrain(p: Page): void {
  p.figure({
    title: 'Training an embedding, and collapse',
    codeTitle: 'train_contrastive.py',
    code: `
      f = MLP([6, 32, 2])      # 2-D output, to look at
      tau = 0.2
      for step in range(1500):
          idx = np.random.choice(N, 32)    # 32 items
          x1 = augment(X[idx])             # view 1  #@aug
          x2 = augment(X[idx])             # view 2  #@aug
          z1 = normalize(f(x1))            # (32, 2) #@enc
          z2 = normalize(f(x2))                      #@enc
          S = z1 @ z2.T / tau              # (32, 32) #@S
          labels = np.arange(32)
          if mode == {{mode:"infonce"}}:
              loss = cross_entropy(S, labels)       #@nce
          else:   # "positives": the diagonal only
              loss = -np.diag(S).mean() * tau       #@pos
          f.step(grad(loss))               # Adam    #@upd
      # step {{step:0}}  loss {{loss:…}}  probe {{probe:…}}
    `,
    setup(f) {
      const data = makeToy();
      const model = new ToyContrastive(data, 3);
      let mode: ToyMode = 'infonce';
      let probe = model.probe();
      const curve: { step: number; probe: number }[] = [{ step: 0, probe }];
      const vr = new Rng(21);
      const v1 = augment(data, SHOW, vr);
      const v2 = augment(data, SHOW, vr);
      const cv = f.canvas(640, 360, (c, w, h) => {
        const F = model.embedAll();
        const R = Math.min(w * 0.19, h * 0.36);
        const cx = Math.max(w * 0.245, R * 1.3 + 4);
        const cy = h * 0.47;
        unitCircle(c, cx, cy, R);
        for (let i = 0; i < data.n; i++) {
          const k = color(CLASS_COLORS[data.y[i]!]!);
          c.beginPath();
          c.arc(cx + R * F[2 * i]!, cy - R * F[2 * i + 1]!, 3.4, 0, Math.PI * 2);
          c.fillStyle = withAlpha(k, 0.55);
          c.fill();
        }
        const e1 = model.embed(v1, SHOW.length);
        const e2 = model.embed(v2, SHOW.length);
        SHOW.forEach((it, b) => {
          const k = color(CLASS_COLORS[data.y[it]!]!);
          const r1 = R * 1.13;
          c.beginPath();
          c.arc(cx + r1 * e1[2 * b]!, cy - r1 * e1[2 * b + 1]!, 4.5, 0, Math.PI * 2);
          c.fillStyle = k;
          c.fill();
          c.beginPath();
          c.arc(cx + r1 * 1.1 * e2[2 * b]!, cy - r1 * 1.1 * e2[2 * b + 1]!, 4.5, 0, Math.PI * 2);
          c.strokeStyle = k;
          c.lineWidth = 2;
          c.stroke();
        });
        // Batch matrix: row softmax of S for the 8 displayed pairs.
        const B = SHOW.length;
        const S = simMatrix(e1, B, e2, B, 2, 1 / 0.2);
        const P = rowSoftmax(S, B, B);
        const mx0 = w * 0.5 + 14;
        const cell = Math.min((w - mx0 - 6) / B, (h - 58) / B);
        const mx = mx0 + (w - mx0 - 6 - cell * B) / 2;
        const my = 22;
        txt(c, 'P = softmax(S), 8 pairs', mx + (cell * B) / 2, 9, { size: 11, color: color('--ink-3') });
        for (let i = 0; i < B; i++) {
          c.fillStyle = color(CLASS_COLORS[data.y[SHOW[i]!]!]!);
          c.beginPath();
          c.arc(mx - 7, my + i * cell + cell / 2, 3.5, 0, Math.PI * 2);
          c.fill();
          c.beginPath();
          c.arc(mx + i * cell + cell / 2, my + B * cell + 8, 3.5, 0, Math.PI * 2);
          c.fill();
        }
        heat(c, mx, my, cell, P, B, B, { col: 'teal' });
        let d = 0;
        for (let i = 0; i < B; i++) d += P[i * B + i]! / B;
        txt(c, `diagonal mean ${d.toFixed(2)}`, mx + (cell * B) / 2, h - 8, { size: 11.5, mono: true, weight: 600, color: color('gold') });
      });
      const chart = f.plot({
        height: 92,
        square: false,
        domain: [0, TRAIN_STEPS, 0, 1.12],
        draw: (pl) => {
          pl.axes({ grid: 0.25 });
          pl.path([0, TRAIN_STEPS], [1 / TOY_K, 1 / TOY_K], withAlpha(color('--ink-3'), 0.8), 1, [4, 4]);
          if (curve.length > 1) pl.path(curve.map((q) => q.step), curve.map((q) => q.probe), color('gold'), 2);
          pl.text('linear-probe accuracy', TRAIN_STEPS * 0.995, 0.5, { size: 11, align: 'right', color: color('gold') });
          pl.text('chance', TRAIN_STEPS * 0.995, 1 / TOY_K + 0.05, { size: 10, align: 'right', color: color('--ink-3') });
        },
      });
      const stepRo = f.readout('step');
      const lossRo = f.readout('loss', { sym: 'L' });
      const probeRo = f.readout('probe accuracy');
      const syncRo = () => {
        stepRo.set(model.step);
        lossRo.set(Number.isNaN(model.lastLoss) ? '–' : fmt(model.lastLoss, 3));
        probeRo.set(`${Math.round(probe * 100)}%`);
        f.code.setMany({ step: model.step, loss: Number.isNaN(model.lastLoss) ? '…' : fmt(model.lastLoss, 3), probe: `${Math.round(probe * 100)}%` });
      };
      let phase = 0;
      const loop = f.loop(() => {
        for (let k = 0; k < 4; k++) {
          model.train(mode, 0.2);
          if (model.step % 50 === 0) {
            probe = model.probe();
            curve.push({ step: model.step, probe });
          }
        }
        f.code.highlight([['aug'], ['enc'], ['S'], [mode === 'infonce' ? 'nce' : 'pos', 'upd']][phase++ % 4]!);
        syncRo();
        cv.redraw();
        chart.redraw();
        if (model.step >= TRAIN_STEPS) {
          stop();
          f.status(mode === 'infonce'
            ? 'Done. The four hidden classes sit on four arcs, the diagonal is bright, and a linear probe reads the classes off the embedding. Now switch to **positives only** and train again.'
            : 'Done. Every item now maps to the same point: the loss is perfect and the embedding is useless. That is collapse.');
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
        model.reset(3);
        probe = model.probe();
        curve.length = 0;
        curve.push({ step: 0, probe });
        f.status('');
        syncRo();
        cv.redraw();
        chart.redraw();
      };
      const btn = f.button('Train', () => {
        if (loop.running()) stop();
        else {
          if (model.step >= TRAIN_STEPS) reset();
          loop.start();
          btn.textContent = 'Pause';
          f.status('');
        }
      }, { primary: true });
      f.button('Reset', reset);
      f.segmented({
        label: 'loss',
        options: [
          { value: 'infonce', label: 'InfoNCE' },
          { value: 'positives', label: 'positives only' },
        ],
        value: 'infonce',
        onChange: (v) => {
          mode = v as ToyMode;
          f.code.set('mode', `"${v}"`);
          reset();
        },
      });
      syncRo();
      f.status('Each toy item has 2 numbers of content and 4 of style; a view keeps the content (slightly jittered) and redraws the style. Press **Train**.');
    },
    caption: `A small encoder (6 inputs, 32 hidden units, 2 outputs, normalized onto the circle) trained with the loss above. The circle shows every item's embedding, colored by a hidden class used only for drawing. Outside it, the eight items of a fixed display batch: dots for view 1, rings for view 2. On the right, that batch's softmax matrix. Press **Train**: the classes spread into separate arcs, the diagonal lights up, and the linear-probe accuracy (gold curve; chance is 25%) climbs from about half to nearly all. The 2 by 2 blocks that stay bright around the diagonal are pairs of items from the same class: to the encoder they look alike, so it cannot fully tell them apart, and does not need to. Then pick **positives only** and train again: the loss improves just as happily while every point slides to one spot and the probe falls toward chance.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: MoCo's queue and momentum encoder                              */
/* ------------------------------------------------------------------ */

export function figMoCo(p: Page): void {
  p.figure({
    title: "MoCo's queue and momentum encoder",
    codeTitle: 'moco.py',
    code: `
      f_k.params = f_q.params.copy()  # identical at start
      m = {{m:0.99}}
      for x in loader:                # N = 4 images
          q = normalize(f_q(aug(x)))  # (N, d)   #@q
          k = normalize(f_k(aug(x)))  # (N, d)   #@q
          l_pos = (q * k).sum(1, keepdims=True)  #@logits
          l_neg = q @ queue.T         # (N, K)   #@logits
          logits = np.hstack([l_pos, l_neg]) / tau     #@logits
          labels = np.zeros(N, int)   # column 0 #@logits
          loss = cross_entropy(logits, labels)   #@loss
          f_q.step(grad(loss))        # not f_k  #@upd
          f_k.params = m * f_k.params + (1 - m) * f_q.params  #@ema
          queue = np.vstack([k, queue])[:K]      #@queue
      # step {{step:0}}: f_k drift across queue {{drift}}
    `,
    setup(f) {
      let m = 0.99;
      let t = 12;
      let path = emaPath(m);
      const lo = Math.min(...THETA_Q) - 0.1;
      const hi = Math.max(...THETA_Q) + 0.1;
      // How far the encoder that made a key is from today's f_k: 0 = consistent.
      const mismatch = (tt: number) => Math.min(1, Math.abs(path[tt]! - path[t]!) / 0.12);
      const cv = f.canvas(640, 190, (c, w, h) => {
        const slots = MOCO_Q;
        const gap = 3;
        const left = 70;
        const sw = Math.min(30, (w - left - 8 - gap * (slots - 1)) / slots);
        const y0 = 28;
        txt(c, 'keys, newest left; red = stale', left, 12, { size: 10.5, align: 'left', color: color('--ink-3') });
        txt(c, 'queue', 4, y0 + sw / 2, { size: 11, align: 'left', mono: true, color: color('--ink-2') });
        for (let s = 0; s < slots; s++) {
          const age = Math.floor(s / MOCO_N);
          const tt = t - age;
          const x = left + s * (sw + gap);
          if (tt < 0) {
            rbox(c, x, y0, sw, sw, 4, withAlpha(color('--ink'), 0.04), withAlpha(color('--ink'), 0.15));
            continue;
          }
          rbox(c, x, y0, sw, sw, 4, withAlpha(color('blue'), 0.7), withAlpha(color('purple'), age === 0 ? 0.95 : 0.4), age === 0 ? 2 : 1);
          rbox(c, x, y0, sw, sw, 4, withAlpha(color('red'), 0.9 * mismatch(tt)), null);
          if (s % MOCO_N === 0) txt(c, age === 0 ? 'now' : `t-${age}`, x + (sw * MOCO_N + gap * (MOCO_N - 1)) / 2, y0 + sw + 12, { size: 10.5, mono: true, color: color('--ink-3') });
        }
        const y1 = y0 + sw + 26;
        txt(c, 'queries', 4, y1 + sw / 2, { size: 11, align: 'left', mono: true, color: color('--ink-2') });
        for (let s = 0; s < MOCO_N; s++) {
          const x = left + s * (sw + gap);
          rbox(c, x, y1, sw, sw, sw / 2, withAlpha(color('purple'), 0.25), color('purple'), 1.5);
        }
        txt(c, 'positive: own new key; negatives: the queue', left, y1 + sw + 12, { size: 10.5, align: 'left', color: color('--ink-3') });
        void h;
      });
      cv.canvas.classList.add('scroll-ok');
      const pl = f.plot({
        height: 170,
        square: false,
        domain: [0, MOCO_T - 1, lo, hi + 0.4 * (hi - lo)],
        draw: (q) => {
          q.axes({ grid: 20 });
          const win0 = Math.max(0, t - MOCO_Q / MOCO_N + 1);
          q.ctx.fillStyle = withAlpha(color('purple'), 0.1);
          q.ctx.fillRect(q.sx(win0 - 0.5), 0, q.sx(t + 0.5) - q.sx(win0 - 0.5), q.h);
          const xs = THETA_Q.map((_, i) => i);
          q.path(xs.slice(0, t + 1), THETA_Q.slice(0, t + 1), withAlpha(color('blue'), 0.55), 1.2);
          q.path(xs.slice(0, t + 1), path.slice(0, t + 1), color('blue'), 3);
          q.dot(t, path[t]!, 4, color('blue'));
          q.text('f_q (trained)', 8 / q.len(1), hi + (hi - lo) * 0.27, { size: 11, mono: true, color: withAlpha(color('blue'), 0.8) });
          q.text('f_k (moving average)', 8 / q.len(1), hi + (hi - lo) * 0.13, { size: 11, mono: true, bold: true, color: color('blue') });
          q.text('shaded: steps with keys in the queue', (MOCO_T - 1) * 0.99, lo + (hi - lo) * 0.05, { size: 10.5, align: 'right', color: color('--ink-3') });
        },
      });
      const driftRo = f.readout('f_k drift across the queue');
      const sync = () => {
        const win = path.slice(Math.max(0, t - MOCO_Q / MOCO_N + 1), t + 1);
        const drift = Math.max(...win) - Math.min(...win);
        driftRo.set(fmt(drift, 3));
        f.code.setMany({ step: t, drift: fmt(drift, 3) });
        cv.redraw();
        pl.redraw();
      };
      const st = f.stepper({
        steps: MOCO_T,
        interval: 260,
        label: (k) => `step ${k}`,
        onStep: (k) => {
          t = k;
          f.code.highlight(['ema', 'queue']);
          sync();
        },
      });
      f.segmented({
        label: 'momentum m',
        options: [
          { value: '0', label: '0 (copy)' },
          { value: '0.9', label: '0.9' },
          { value: '0.99', label: '0.99' },
          { value: '0.999', label: '0.999' },
        ],
        value: '0.99',
        slot: 'm',
        onChange: (v) => {
          m = Number(v);
          path = emaPath(m);
          f.code.highlight('ema');
          sync();
        },
      });
      queueMicrotask(() => st.go(40));
    },
    caption: `Top: MoCo's queue. Each training step encodes a batch of four keys with the key encoder $f_k$, pushes them in at the left, and drops the four oldest at the right. A key turns red when the version of $f_k$ that made it differs from today's. Bottom: one weight of the trained encoder $f_q$ (thin, jittery: a stand-in for SGD noise) and the same weight in $f_k$, a moving average of it with momentum $\\symm$. Press play. With **m = 0** the key encoder is a copy of $f_q$: keys made a few steps apart come from noticeably different networks (the queue turns red, and the drift readout is large), so a query is compared against a mix of incompatible encodings. With **0.99** the key encoder moves slowly and every key in the queue is nearly consistent. MoCo used $\\symm = 0.999$ and a queue of 65,536 keys.`,
  });
}
