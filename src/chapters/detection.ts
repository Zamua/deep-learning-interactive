import type { ChapterDef } from './index';
import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { color, rgbOf, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { TinyNet } from '../lib/unsupervised-net';
import { type Box, CLASS_COLOR, OBJECTS, SCENE_CLASSES, SCENE_H, SCENE_W, drawScene, iou, sceneMasks } from '../lib/detection-scene';
import { DETECTION_SYMBOLS } from '../lib/detection-symbols';

type Ctx = CanvasRenderingContext2D;

const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
const UI = 'system-ui, sans-serif';
const font = (size: number, weight = 500, mono = false) => `${weight} ${size}px ${mono ? MONO : UI}`;
const clsColor = (cls: number) => color(CLASS_COLOR[cls]!);
const r0 = (v: number) => String(Math.round(v));
const boxStr = (b: Box) => b.map(r0).join(', ');

/** A label chip with its top-left near (x, y), kept inside the canvas width. */
function chip(c: Ctx, text: string, x: number, y: number, bg: string, maxW: number, minX = 0, minY = 0): void {
  c.font = font(11, 600);
  const tw = c.measureText(text).width + 8;
  const X = Math.max(minX, Math.min(x, maxW - tw));
  const Y = Math.max(minY, y);
  c.fillStyle = bg;
  c.beginPath();
  c.roundRect(X, Y, tw, 16, 3);
  c.fill();
  c.fillStyle = '#ffffff';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(text, X + 4, Y + 8.5);
}

type Rect = [number, number, number, number];

/**
 * Chip above a box, or inside its top edge, or under it: the first spot that stays on the
 * canvas and clear of the chips already in `placed`.
 */
function boxChip(c: Ctx, k: number, b: Box, text: string, bg: string, w: number, placed?: Rect[]): void {
  c.font = font(11, 600);
  const tw = c.measureText(text).width + 8;
  const x = Math.max(0, Math.min(b[0] * k, w - tw));
  const spots = [b[1] * k - 17, b[1] * k + 1, b[3] * k + 1, b[3] * k - 17].filter((y) => y >= 0);
  const hits = (y: number) => (placed ?? []).some(([px, py, pw, ph]) => x < px + pw && x + tw > px && y < py + ph && y + 16 > py);
  const y = spots.find((yy) => !hits(yy)) ?? spots[0]!;
  placed?.push([x, y, tw, 16]);
  chip(c, text, x, y, bg, w);
}

function strokeBox(c: Ctx, k: number, b: Box, stroke: string, width = 2, dash: number[] = []): void {
  c.save();
  c.strokeStyle = stroke;
  c.lineWidth = width;
  c.setLineDash(dash);
  c.strokeRect(b[0] * k, b[1] * k, (b[2] - b[0]) * k, (b[3] - b[1]) * k);
  c.restore();
}

/** A window onto the scene: left, top and width in scene pixels (height follows the 3:2 aspect). */
type View = [number, number, number];
const FULL: View = [0, 0, SCENE_W];

/** Pointer position in scene pixels. */
function scenePoint(canvas: HTMLCanvasElement, e: PointerEvent, view: View = FULL): [number, number] {
  const r = canvas.getBoundingClientRect();
  const k = r.width / view[2];
  return [(e.clientX - r.left) / k + view[0], (e.clientY - r.top) / k + view[1]];
}

/**
 * A canvas holding the scene (or a zoomed window of it). `paint` draws in scene pixels times
 * k (CSS px per scene px); `w` is the right edge of the visible area in those units.
 */
function sceneCanvas(f: Fig, paint: (c: Ctx, k: number, w: number, h: number) => void, alpha = 1, view: View = FULL) {
  return f.canvas(SCENE_W, SCENE_H, (c, w, h) => {
    const k = w / view[2];
    c.save();
    c.translate(-view[0] * k, -view[1] * k);
    drawScene(c, 0, 0, SCENE_W * k, alpha);
    paint(c, k, (view[0] + view[2]) * k, (view[1] + (view[2] * SCENE_H) / SCENE_W) * k);
    c.restore();
  });
}

/** Paints a label map (one palette entry per label, null = transparent) over the full canvas. */
function paintLabels(c: Ctx, labels: Uint8Array, lw: number, lh: number, palette: (string | null)[], alpha: number, w: number, h: number): void {
  const img = new ImageData(lw, lh);
  const rgb = palette.map((p) => (p ? rgbOf(p) : null));
  for (let i = 0; i < lw * lh; i++) {
    const col = rgb[labels[i]!];
    if (!col) continue;
    img.data[i * 4] = col[0];
    img.data[i * 4 + 1] = col[1];
    img.data[i * 4 + 2] = col[2];
    img.data[i * 4 + 3] = Math.round(alpha * 255);
  }
  const tmp = document.createElement('canvas');
  tmp.width = lw;
  tmp.height = lh;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  c.save();
  c.imageSmoothingEnabled = false;
  c.drawImage(tmp, 0, 0, w, h);
  c.restore();
}

/** Toy images for the box regressor: one solid or hollow rectangle on a noisy 20 x 20 background. */
const R = 20;
function toyBatch(n: number, rng: Rng) {
  const X = new Float64Array(n * R * R);
  const y = new Int32Array(n);
  const Y = new Float64Array(n * 4);
  for (let k = 0; k < n; k++) {
    const w = 4 + rng.int(11);
    const h = 4 + rng.int(11);
    const x0 = rng.int(R - w + 1);
    const y0 = rng.int(R - h + 1);
    const frame = rng.next() < 0.5;
    y[k] = frame ? 1 : 0;
    for (let yy = 0; yy < R; yy++) {
      for (let xx = 0; xx < R; xx++) {
        const inRect = xx >= x0 && xx < x0 + w && yy >= y0 && yy < y0 + h;
        const edge = xx === x0 || xx === x0 + w - 1 || yy === y0 || yy === y0 + h - 1;
        const inside = inRect && (!frame || edge);
        X[k * R * R + yy * R + xx] = (inside ? 0.75 + rng.next() * 0.25 : rng.next() * 0.3) - 0.3;
      }
    }
    Y[k * 4] = (x0 + w / 2) / R;
    Y[k * 4 + 1] = (y0 + h / 2) / R;
    Y[k * 4 + 2] = w / R;
    Y[k * 4 + 3] = h / R;
  }
  return { X, y, Y };
}

/** IoU of two boxes given as (cx, cy, w, h). */
function iouCenter(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const A: Box = [a[0]! - a[2]! / 2, a[1]! - a[3]! / 2, a[0]! + a[2]! / 2, a[1]! + a[3]! / 2];
  const B: Box = [b[0]! - b[2]! / 2, b[1]! - b[3]! / 2, b[0]! + b[2]! / 2, b[1]! + b[3]! / 2];
  if (A[2] <= A[0] || A[3] <= A[1]) return 0;
  return iou(A, B);
}

/** Candidate detections for the NMS figure: [class, score, box]. */
const CANDIDATES: [number, number, Box][] = [
  [1, 0.97, [30, 172, 200, 262]],
  [1, 0.91, [18, 182, 186, 268]],
  [1, 0.74, [40, 168, 210, 258]],
  [1, 0.52, [10, 190, 150, 270]],
  [2, 0.95, [212, 110, 258, 272]],
  [2, 0.83, [208, 120, 262, 268]],
  [2, 0.66, [216, 100, 252, 250]],
  [2, 0.88, [260, 176, 292, 272]],
  [2, 0.71, [258, 186, 288, 268]],
  [2, 0.62, [210, 114, 292, 270]],
  [3, 0.93, [302, 204, 402, 272]],
  [3, 0.85, [310, 200, 396, 266]],
  [3, 0.69, [296, 212, 388, 274]],
  [3, 0.47, [330, 198, 404, 262]],
  [4, 0.81, [412, 194, 464, 270]],
  [4, 0.64, [418, 200, 466, 266]],
  [2, 0.34, [338, 80, 378, 214]],
  [4, 0.38, [368, 200, 404, 236]],
];

const chapter: ChapterDef = {
  symbols: DETECTION_SYMBOLS,

  render(p) {
    p.prose(`
Everything so far has produced one answer per image: "this is a cat." Real pictures are messier. A street photo holds a car, two people, a dog and a cat, and we usually want to know *where* each of them is, not just that they are in there somewhere.

This chapter climbs a ladder of harder tasks, each built from pieces you already have. Localization adds four numbers (a box) to a classifier. Detection finds a box for every object, however many there are. Segmentation labels every single pixel. Along the way you will meet the ideas that made modern detectors work: region proposals, the R-CNN family, anchors, single-shot detectors like YOLO, and the "upsampling" layers that let a ConvNet paint a full-resolution answer.`);

    p.h2('Four tasks, one scene', 'tasks');
    p.prose(`
Here are the tasks, roughly from easiest to hardest. They differ in *what the network has to output*:

- **Classification:** one label for the whole image.
- **Classification + localization:** one label and one box around that object. You know in advance there is exactly one thing to find.
- **Object detection:** a box and a label for *every* object of the classes you care about. The number of outputs changes from image to image.
- **Semantic segmentation:** a class label for every pixel. It does not separate objects: two people standing together are just "person pixels".
- **Instance segmentation:** a pixel mask for each object separately, so the two people get two masks.`);

    p.figure({
      title: 'One scene, five kinds of answer',
      codeTitle: 'outputs.py',
      code: `
        img = load('scene.png')     # (320, 480, 3) pixels

        # classification: one label for the image
        label = 'car'                                    #@cls
        # classification + localization: label and box
        label, box = 'car', (24, 176, 172, 90)           #@loc
        # detection: (class, score, box) for each object
        dets = [('car', 0.98, (24, 176, 172, 90)),       #@det
                ('person', 0.95, (214, 112, 42, 158)),   #@det
                ('dog', 0.93, (304, 206, 96, 64)), ...]  #@det
        # semantic segmentation: a class per pixel
        mask = np.zeros((320, 480), dtype=int)           #@sem
        # instance segmentation: one mask per object
        instances = [('person', m1), ('person', m2), ...]  #@inst
        # output size: {{n:1 label}}
      `,
      setup(f) {
        let task = 'cls';
        const scores = [0.98, 0.95, 0.9, 0.93, 0.86];
        const cv = sceneCanvas(f, (c, k, w, h) => {
          if (task === 'cls') {
            c.fillStyle = withAlpha(color('--card'), 0.88);
            c.beginPath();
            c.roundRect(10, 10, 132, 30, 6);
            c.fill();
            c.fillStyle = color('--ink');
            c.font = font(14, 600);
            c.textAlign = 'left';
            c.textBaseline = 'middle';
            c.fillText('label: car', 20, 25.5);
          } else if (task === 'loc') {
            const o = OBJECTS[0]!;
            strokeBox(c, k, o.box, clsColor(o.cls), 2.5);
            boxChip(c, k, o.box, 'car', clsColor(o.cls), w);
          } else if (task === 'det') {
            OBJECTS.forEach((o) => strokeBox(c, k, o.box, clsColor(o.cls), 2.5));
            const placed: Rect[] = [];
            OBJECTS.forEach((o, i) => boxChip(c, k, o.box, `${o.name} ${scores[i]}`, clsColor(o.cls), w, placed));
          } else {
            const m = sceneMasks(2);
            if (task === 'sem') {
              const pal = SCENE_CLASSES.map((_, i) => (i === 0 ? null : clsColor(i)));
              paintLabels(c, m.cls, m.w, m.h, pal, 0.62, w, h);
            } else {
              const inst = ['red', 'blue', 'teal', 'orange', 'purple'] as const;
              const pal = [null, ...inst.map((n) => color(n))];
              paintLabels(c, m.inst, m.w, m.h, pal, 0.62, w, h);
            }
          }
        });
        const outRo = f.readout('output');
        const sizes: Record<string, string> = {
          cls: '1 label',
          loc: '1 label + 4 numbers',
          det: '5 x (label, score, 4 numbers)',
          sem: '153,600 labels (one per pixel)',
          inst: '5 masks + 5 labels',
        };
        f.segmented({
          options: [
            { value: 'cls', label: 'class' },
            { value: 'loc', label: 'localize' },
            { value: 'det', label: 'detect' },
            { value: 'sem', label: 'semantic' },
            { value: 'inst', label: 'instance' },
          ],
          value: 'cls',
          onChange: (v) => {
            task = v;
            f.code.highlight(v);
            f.code.set('n', sizes[v]!);
            outRo.set(sizes[v]!);
            cv.redraw();
          },
        });
        f.code.highlight('cls');
        outRo.set(sizes.cls!);
      },
      caption: `Tap through the tasks. Notice how the *shape* of the output changes: a single label, a label plus four numbers, a list whose length depends on the picture, a whole image of labels, and finally one mask per object. Semantic segmentation paints both people the same color; instance segmentation tells them apart. Boxes are written as $(x, y, w, h)$: left edge, top edge, width and height in pixels, with $y$ growing downward as it does in images.`,
    });

    p.h2('Localization as regression', 'localization');
    p.prose(`
Start with the gentlest step up. If we know the image contains exactly one object of interest, finding it means producing **four numbers**: the box's position and size, $\\symbp = (x, y, w, h)$. Predicting real numbers (rather than picking a class) is called **regression**, and it is no harder for a neural network than classification: the last layer simply outputs four numbers instead of a score per class.

To train it, we need a loss that says how far the predicted box is from the true one, $\\symbg$. The simplest choice is the **L2 loss**: square each coordinate's error and add them up.`);
    p.math({
      label: 'L2 loss for box regression',
      tex: String.raw`\symL_{\text{box}} = \sum_{k} \big(\sym{bp}{\hat{b}_k} - \sym{bg}{b^{*}_k}\big)^2 = \lVert \symbp - \symbg \rVert^2`,
      code: `
        box = np.array([48., 30., 100., 80.])  # x, y, w, h
        gt  = np.array([50., 34.,  90., 85.])  # true box
        loss = np.sum((box - gt) ** 2)   # 4+16+100+25 = 145
      `,
      terms: [
        [String.raw`\sym{bp}{\hat{b}_k}`, 'one of the four numbers the network predicts (the hat means "an estimate")'],
        [String.raw`\sym{bg}{b^{*}_k}`, 'the same number for the true box, drawn by a human annotator'],
        [String.raw`(\cdot)^2`, 'square the error, so being off in either direction counts, and big misses count a lot'],
        [String.raw`\sum_k`, 'add up over the four coordinates, $k = x, y, w, h$'],
        [String.raw`\lVert \cdot \rVert^2`, 'shorthand for "sum of squares of a vector"'],
      ],
      explain: 'Measure how far off each of the four numbers is, square those errors, and add them. A perfect box scores 0. This is exactly the loss you would use to fit a line through points in high school statistics, just with four outputs instead of one. In practice the coordinates are first scaled (say, divided by the image size) so that no single coordinate dominates the sum.',
    });

    p.prose(`
### Bolting a regression head onto a classifier

We do not train this from scratch. Take a ConvNet already trained for classification on ImageNet, keep its convolutional layers, and attach a second small "head": a few fully-connected layers that output the four box numbers. The original classification head stays too. Training then minimizes both losses at once.

Where you attach the regression head is a design choice: Overfeat fed it the output of the last convolutional layer, while DeepPose and R-CNN regressed from the fully-connected layers' features. The head can also be:

- **class-agnostic:** one box (4 numbers), whatever the class, or
- **class-specific:** one box per class ($C \\times 4$ numbers), and you read off the box belonging to the predicted class. It costs more outputs but lets each class learn its own idea of a good box (cats and buses have different shapes).

The same trick handles **human pose estimation**: regress the $(x, y)$ positions of a fixed number of body joints (DeepPose, Toshev and Szegedy 2014).`);
    p.math({
      label: 'Classification + localization: a multi-task loss',
      tex: String.raw`\symL = \underbrace{-\log \frac{e^{\sym{s}{s_{y}}}}{\sum_j e^{\sym{s}{s_j}}}}_{\text{what?}} + \lambda\, \underbrace{\lVert \symbp - \symbg \rVert^2}_{\text{where?}}`,
      code: `
        scores, box = net(img)          # two heads, one body
        l_cls = softmax_loss(scores, y) # Chapter 4
        l_box = np.sum((box - gt) ** 2)
        loss = l_cls + lam * l_box      # lam balances the two
      `,
      terms: [
        [String.raw`-\log \frac{e^{s_y}}{\sum_j e^{s_j}}`, 'the softmax (cross-entropy) loss from Chapter 4: small when the correct class $y$ gets most of the probability'],
        [String.raw`\lVert \symbp - \symbg \rVert^2`, 'the L2 box loss above'],
        [String.raw`\lambda`, 'a weight (a hyperparameter) that says how much a box error counts compared with a class error'],
      ],
      explain: 'One network, two questions, one number to minimize. Because both heads share the same convolutional layers, the gradient from each loss shapes features that are useful for both "what" and "where". Getting $\\lambda$ right matters: too small and the boxes are sloppy, too large and classification suffers.',
    });

    p.figure({
      title: 'Training a classifier with a box-regression head',
      codeTitle: 'cls_and_box.py',
      code: `
        W1 = np.random.randn(400, 64) * np.sqrt(2 / 400)
        W2 = np.random.randn(64, {{nout:6}}) * np.sqrt(2 / 64)
        b1, b2 = np.zeros(64), np.zeros({{nout:6}})

        for step in range(3000):
            X, y, gt = make_batch(32)  # 32 new images
            h = np.maximum(0, X.dot(W1) + b1)          #@fwd
            out = h.dot(W2) + b2                       #@fwd
            scores = out[:, :2]   # solid or frame     #@heads
            boxes = out[:, 2:].reshape(32, -1, 4)      #@heads
            box = boxes[np.arange(32), {{bidx:0}}]     #@heads
            l_cls = softmax_loss(scores, y)            #@loss
            l_box = np.mean(np.sum((box - gt)**2, 1))  #@loss
            loss = l_cls + 10 * l_box                  #@loss
            backprop_and_adam_step(loss)               #@upd
        # step {{step:0}}  loss {{loss:…}}  test IoU {{iou:…}}
      `,
      setup(f) {
        let specific = false;
        const rngInit = new Rng(4);
        const randn = () => rngInit.randn();
        let net = new TinyNet([R * R, 64, 6], ['relu', 'linear'], randn, Math.SQRT2);
        const rng = new Rng(11);
        const show = toyBatch(8, new Rng(99));
        const test = toyBatch(200, new Rng(123));
        const losses: number[] = [];
        let step = 0;
        let ema = 0;
        let preds: Float64Array = new Float64Array(8 * 6);
        const nout = () => (specific ? 10 : 6);
        const boxOf = (out: Float64Array, i: number, cls: number) => {
          const o = i * nout() + 2 + (specific ? 4 * cls : 0);
          return out.subarray(o, o + 4);
        };
        const predCls = (out: Float64Array, i: number) => (out[i * nout() + 1]! > out[i * nout()]! ? 1 : 0);
        const evalTest = () => {
          const out = net.run(test.X, 200);
          let mi = 0;
          let acc = 0;
          for (let i = 0; i < 200; i++) {
            const pc = predCls(out, i);
            if (pc === test.y[i]) acc++;
            mi += iouCenter(boxOf(out, i, pc), test.Y.subarray(i * 4, i * 4 + 4));
          }
          iouRo.set(fmt(mi / 200, 2));
          accRo.set(`${Math.round(acc / 2)}%`);
          f.code.set('iou', fmt(mi / 200, 2));
        };
        const tiles = f.canvas(640, 360, (c, w, hh) => {
          const cols = 4;
          const gap = w * 0.025;
          const size = Math.min((w - gap * (cols - 1)) / cols, hh / 2 - 26);
          const tileH = size + 26;
          const left = (w - size * cols - gap * (cols - 1)) / 2;
          for (let i = 0; i < 8; i++) {
            const gx = left + (i % cols) * (size + gap);
            const gy = Math.floor(i / cols) * tileH;
            const img = new ImageData(R, R);
            for (let q = 0; q < R * R; q++) {
              const v = Math.round(Math.max(0, Math.min(1, show.X[i * R * R + q]! + 0.3)) * 255);
              img.data[q * 4] = img.data[q * 4 + 1] = img.data[q * 4 + 2] = v;
              img.data[q * 4 + 3] = 255;
            }
            const tmp = document.createElement('canvas');
            tmp.width = tmp.height = R;
            tmp.getContext('2d')!.putImageData(img, 0, 0);
            c.save();
            c.imageSmoothingEnabled = false;
            c.drawImage(tmp, gx, gy, size, size);
            c.restore();
            const sc = size;
            const drawCB = (b: ArrayLike<number>, col: string, lw: number, dash: number[]) => {
              c.save();
              c.strokeStyle = col;
              c.lineWidth = lw;
              c.setLineDash(dash);
              c.strokeRect(gx + (b[0]! - b[2]! / 2) * sc, gy + (b[1]! - b[3]! / 2) * sc, b[2]! * sc, b[3]! * sc);
              c.restore();
            };
            const gtb = show.Y.subarray(i * 4, i * 4 + 4);
            drawCB(gtb, color('gold'), 2, [5, 3]);
            const pc = predCls(preds, i);
            const pb = boxOf(preds, i, pc);
            if (step > 0) drawCB(pb, color('purple'), 2, []);
            c.fillStyle = color('--ink-2');
            c.font = font(12, 500);
            c.textAlign = 'center';
            c.textBaseline = 'top';
            const ok = pc === show.y[i];
            const txt = step > 0 ? `${pc ? 'frame' : 'solid'} ${ok ? '✓' : '✗'}  IoU ${iouCenter(pb, gtb).toFixed(2)}` : show.y[i] ? 'frame' : 'solid';
            c.fillText(txt, gx + size / 2, gy + size + 5);
          }
        });
        const curve = f.plot({
          height: 96,
          square: false,
          domain: [0, 3000, 0, 1.5],
          draw: (pl) => {
            pl.axes({ grid: 500 });
            if (losses.length > 1) pl.path(losses.map((_, i) => i * 10), losses, color('red'), 2);
            pl.ctx.fillStyle = color('red');
            pl.ctx.font = font(11, 500);
            pl.ctx.textAlign = 'left';
            pl.ctx.fillText('training loss', 8, 15);
          },
        });
        const stepRo = f.readout('step');
        const lossRo = f.readout('loss', { sym: 'L' });
        const iouRo = f.readout('test IoU');
        const accRo = f.readout('class acc');
        const trainStep = () => {
          const B = 32;
          const n = nout();
          const { X, y, Y } = toyBatch(B, rng);
          const out = net.forward(X, B);
          const d = new Float64Array(B * n);
          let lc = 0;
          let lb = 0;
          for (let i = 0; i < B; i++) {
            const o = i * n;
            const m = Math.max(out[o]!, out[o + 1]!);
            const e0 = Math.exp(out[o]! - m);
            const e1 = Math.exp(out[o + 1]! - m);
            const p0 = e0 / (e0 + e1);
            const p1 = 1 - p0;
            lc += -Math.log(Math.max(1e-12, y[i] ? p1 : p0));
            d[o] = (p0 - (y[i] === 0 ? 1 : 0)) / B;
            d[o + 1] = (p1 - (y[i] === 1 ? 1 : 0)) / B;
            const bo = o + 2 + (specific ? 4 * y[i]! : 0);
            for (let q = 0; q < 4; q++) {
              const e = out[bo + q]! - Y[i * 4 + q]!;
              lb += e * e;
              d[bo + q] = (10 * 2 * e) / B;
            }
          }
          net.backward(d);
          net.adam(1e-3);
          return (lc + 10 * lb) / B;
        };
        let phase = 0;
        const loop = f.loop(() => {
          for (let q = 0; q < 3; q++) {
            const l = trainStep();
            ema = step === 0 ? l : 0.97 * ema + 0.03 * l;
            step++;
            if (step % 10 === 0) losses.push(ema);
          }
          preds = net.run(show.X, 8);
          f.code.highlight(['fwd', 'heads', 'loss', 'upd'][phase++ % 4]!);
          f.code.setMany({ step, loss: fmt(ema, 3) });
          stepRo.set(step);
          lossRo.set(fmt(ema, 3));
          if (step % 60 === 0) evalTest();
          tiles.redraw();
          curve.redraw();
          if (step >= 3000) {
            stop();
            f.status('Done: 3,000 steps of 32 fresh images each.');
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          btn.textContent = 'Train';
          f.code.highlight(null);
          evalTest();
        };
        const btn = f.button('Train', () => {
          if (loop.running()) stop();
          else {
            if (step >= 3000) reset();
            loop.start();
            btn.textContent = 'Pause';
            f.status('');
          }
        }, { primary: true });
        const reset = () => {
          stop();
          const r = new Rng(Math.floor(Math.random() * 1e6));
          net = new TinyNet([R * R, 64, nout()], ['relu', 'linear'], () => r.randn(), Math.SQRT2);
          losses.length = 0;
          step = 0;
          preds = net.run(show.X, 8);
          f.code.setMany({ step: 0, loss: '…', iou: '…' });
          stepRo.set(0);
          lossRo.set('–');
          evalTest();
          tiles.redraw();
          curve.redraw();
        };
        f.button('Reset', reset);
        f.segmented({
          label: 'box head',
          options: [
            { value: 'agnostic', label: 'class-agnostic' },
            { value: 'specific', label: 'class-specific' },
          ],
          value: 'agnostic',
          onChange: (v) => {
            specific = v === 'specific';
            f.code.setMany({ nout: nout(), bidx: specific ? 'y' : '0' });
            reset();
          },
        });
        preds = net.run(show.X, 8);
        evalTest();
      },
      caption: `A tiny network learns, live, to say both *what* is in a 20 × 20 image (a solid rectangle or a hollow frame) and *where* it is. Gold dashed boxes are the truth $\\symbg$, purple boxes the prediction $\\symbp$. Press **Train**: the class is easy and is learned within a few hundred steps, while the boxes keep tightening for the whole run and the test IoU (overlap, defined below; 1 is perfect) climbs past 0.7. Switch to the class-specific head to give each class its own four outputs; only the true class's box receives a loss. A real system would feed ConvNet features, not raw pixels, into the heads, but the losses are exactly these.`,
    });

    p.h2('Measuring overlap: IoU', 'iou');
    p.prose(`
How good is a predicted box? We need a single number that is 1 when the boxes match exactly, 0 when they do not touch, and fair to boxes of every size. The standard answer is **intersection over union** (IoU, also called the Jaccard index): the area the two boxes share, divided by the area they cover together.`);
    p.math({
      label: 'Intersection over union',
      tex: String.raw`\begin{aligned} \operatorname{IoU}(\symbp, \symbg) &= \frac{I}{U} \\ I &= \text{area}(\symbp \cap \symbg) \\ U &= \text{area}(\symbp \cup \symbg) \\ &= \text{area}(\symbp) + \text{area}(\symbg) - I \end{aligned}`,
      code: `
        def iou(a, b):              # boxes as (x1, y1, x2, y2)
            iw = max(0, min(a[2], b[2]) - max(a[0], b[0]))
            ih = max(0, min(a[3], b[3]) - max(a[1], b[1]))
            inter = iw * ih
            union = area(a) + area(b) - inter
            return inter / union
      `,
      terms: [
        [String.raw`\cap`, '"intersection": the region inside *both* boxes. For two axis-aligned boxes it is itself a box (or nothing)'],
        [String.raw`\cup`, '"union": the region inside *either* box'],
        [String.raw`I, U`, 'short names for the intersection and union areas'],
        [String.raw`- I`, 'adding the two areas counts the shared part twice, so subtract it once'],
      ],
      explain: 'The intersection of two boxes runs from the larger of the two left edges to the smaller of the two right edges (and the same for top and bottom). If those cross, there is no overlap and the width is clamped to 0. Dividing by the union keeps the score fair: a huge box that covers the object has a large intersection, but an even larger union, so it scores poorly.',
    });

    p.figure({
      title: 'IoU playground',
      codeTitle: 'iou.py',
      code: `
        def iou(a, b):          # (x1, y1, x2, y2) boxes
            ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])    #@inter
            ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])    #@inter
            inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)  #@inter
            area_a = (a[2] - a[0]) * (a[3] - a[1])         #@union
            area_b = (b[2] - b[0]) * (b[3] - b[1])         #@union
            union = area_a + area_b - inter                #@union
            return inter / union                           #@ratio

        gt  = ({{gt}})     # the dog
        box = ({{box}})
        iou(box, gt)       # {{inter}} / {{union}} = {{iou}}
      `,
      setup(f) {
        const gtBox = OBJECTS[3]!.box;
        const box: Box = [290, 196, 380, 262];
        const view: View = [232, 150, 248];
        const vx1 = view[0] + view[2], vy1 = view[1] + (view[2] * SCENE_H) / SCENE_W;
        const cv = sceneCanvas(f, (c, k, w) => {
          const ix1 = Math.max(box[0], gtBox[0]), iy1 = Math.max(box[1], gtBox[1]);
          const ix2 = Math.min(box[2], gtBox[2]), iy2 = Math.min(box[3], gtBox[3]);
          c.fillStyle = withAlpha(color('--paper'), 0.35);
          for (const b of [box, gtBox]) c.fillRect(b[0] * k, b[1] * k, (b[2] - b[0]) * k, (b[3] - b[1]) * k);
          if (ix2 > ix1 && iy2 > iy1) {
            c.fillStyle = withAlpha(color('teal'), 0.55);
            c.fillRect(ix1 * k, iy1 * k, (ix2 - ix1) * k, (iy2 - iy1) * k);
          }
          strokeBox(c, k, gtBox, color('gold'), 2.5, [6, 4]);
          strokeBox(c, k, box, color('purple'), 2.5);
          for (const [hx, hy] of [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]] as const) {
            c.fillStyle = color('purple');
            c.fillRect(hx * k - 5, hy * k - 5, 10, 10);
          }
          chip(c, 'truth b*', gtBox[0] * k, gtBox[1] * k - 17, color('gold'), w, view[0] * k, view[1] * k);
          chip(c, 'prediction b̂', box[0] * k, Math.min(box[3] * k + 3, vy1 * k - 17), color('purple'), w, view[0] * k);
        }, 1, view);
        const interRo = f.readout('intersection');
        const unionRo = f.readout('union');
        const iouRo = f.readout('IoU');
        const verdict = f.readout('at τ = 0.5', { sym: 'tau' });
        const update = () => {
          const iw = Math.max(0, Math.min(box[2], gtBox[2]) - Math.max(box[0], gtBox[0]));
          const ih = Math.max(0, Math.min(box[3], gtBox[3]) - Math.max(box[1], gtBox[1]));
          const inter = iw * ih;
          const union = (box[2] - box[0]) * (box[3] - box[1]) + (gtBox[2] - gtBox[0]) * (gtBox[3] - gtBox[1]) - inter;
          const v = inter / union;
          f.code.setMany({ gt: boxStr(gtBox), box: boxStr(box), inter: r0(inter), union: r0(union), iou: fmt(v, 3) });
          interRo.set(r0(inter));
          unionRo.set(r0(union));
          iouRo.set(fmt(v, 3));
          verdict.set(v >= 0.5 ? 'a hit' : 'a miss');
        };
        let mode: 'move' | 'c0' | 'c1' | 'c2' | 'c3' | null = null;
        let off = [0, 0];
        cv.canvas.addEventListener('pointerdown', (e) => {
          const [px, py] = scenePoint(cv.canvas, e, view);
          const k = cv.canvas.getBoundingClientRect().width / view[2];
          const tol = 16 / k;
          const corners = [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]];
          const ci = corners.findIndex(([x, y]) => Math.abs(px - x!) < tol && Math.abs(py - y!) < tol);
          if (ci >= 0) mode = `c${ci}` as 'c0';
          else if (px > box[0] && px < box[2] && py > box[1] && py < box[3]) {
            mode = 'move';
            off = [px - box[0], py - box[1]];
          } else {
            const w = box[2] - box[0], h = box[3] - box[1];
            box[0] = Math.max(view[0], Math.min(vx1 - w, px - w / 2));
            box[1] = Math.max(view[1], Math.min(vy1 - h, py - h / 2));
            box[2] = box[0] + w;
            box[3] = box[1] + h;
            mode = 'move';
            off = [px - box[0], py - box[1]];
          }
          f.code.highlight(mode === 'move' ? 'inter' : 'union');
          cv.canvas.setPointerCapture(e.pointerId);
          update();
          cv.redraw();
        });
        cv.canvas.addEventListener('pointermove', (e) => {
          if (!mode) return;
          const [px0, py0] = scenePoint(cv.canvas, e, view);
          const px = Math.max(view[0], Math.min(vx1, px0));
          const py = Math.max(view[1], Math.min(vy1, py0));
          if (mode === 'move') {
            const w = box[2] - box[0], h = box[3] - box[1];
            box[0] = Math.max(view[0], Math.min(vx1 - w, px - off[0]!));
            box[1] = Math.max(view[1], Math.min(vy1 - h, py - off[1]!));
            box[2] = box[0] + w;
            box[3] = box[1] + h;
          } else {
            const ci = Number(mode[1]);
            if (ci === 0 || ci === 2) box[0] = Math.min(px, box[2] - 8);
            else box[2] = Math.max(px, box[0] + 8);
            if (ci === 0 || ci === 1) box[1] = Math.min(py, box[3] - 8);
            else box[3] = Math.max(py, box[1] + 8);
          }
          update();
          cv.redraw();
        });
        cv.canvas.addEventListener('pointerup', () => {
          mode = null;
          f.code.highlight('ratio');
        });
        update();
      },
      caption: `**Drag** the purple box to move it, or drag a corner square to resize it. The teal patch is the intersection; the pale area covered by either box is the union. Try making the purple box much bigger than the dog: it still contains the whole dog, yet IoU drops fast. Then try shifting a perfect box by a quarter of its width: IoU falls to about 0.6. The usual rule, from the PASCAL VOC benchmark, is that a detection counts as correct when its IoU with a true box is at least $\\symtau = 0.5$.`,
    });

    p.h2('Sliding windows and Overfeat', 'sliding-window');
    p.prose(`
A classifier with a box head finds *one* object. To find objects anywhere, an obvious idea is to run it on many crops of the image: slide a window across every position, at several sizes, and ask the network about each crop. Each window produces class scores and a box, and the good boxes are merged at the end.

**Overfeat** (Sermanet et al., 2013) did this well enough to win the ImageNet localization challenge in 2013. The trouble with a naive version is cost: every window is a full ConvNet forward pass, and the number of windows multiplies quickly.`);

    p.figure({
      title: 'Counting the crops of a sliding window',
      codeTitle: 'sliding_window.py',
      code: `
        H, W = 320, 480
        runs = 0
        for win in {{wins:[96]}}:                     #@scale
            for y in range(0, H - win + 1, {{stride:32}}):  #@pos
                for x in range(0, W - win + 1, {{stride:32}}):  #@pos
                    crop = img[y:y + win, x:x + win]  #@crop
                    scores = convnet(resize(crop))    #@run
                    runs += 1                         #@run
        # window ({{wx:0}}, {{wy:0}}), run {{runs:0}} of {{total}}
      `,
      setup(f) {
        let wins = [96];
        let stride = 32;
        let list: Box[] = [];
        let cur = -1;
        const best = (b: Box) => Math.max(...OBJECTS.map((o) => iou(b, o.box)));
        const rebuild = () => {
          list = [];
          for (const win of wins)
            for (let y = 0; y + win <= SCENE_H; y += stride)
              for (let x = 0; x + win <= SCENE_W; x += stride) list.push([x, y, x + win, y + win]);
          cur = -1;
          f.code.setMany({ total: list.length, runs: 0, wx: 0, wy: 0, wins: `[${wins.join(', ')}]` });
          totalRo.set(list.length);
          hitRo.set(list.filter((b) => best(b) >= 0.5).length);
          cv.redraw();
        };
        const cv = sceneCanvas(f, (c, k, w) => {
          const upto = cur < 0 ? list.length : cur + 1;
          for (let i = 0; i < upto; i++) {
            const b = list[i]!;
            const v = best(b);
            if (v >= 0.5) strokeBox(c, k, b, color('green'), 2);
            else if (cur >= 0) {
              c.fillStyle = withAlpha(color('--ink'), 0.5);
              c.beginPath();
              c.arc(((b[0] + b[2]) / 2) * k, ((b[1] + b[3]) / 2) * k, 1.8, 0, Math.PI * 2);
              c.fill();
            }
          }
          if (cur >= 0) {
            const b = list[cur]!;
            c.fillStyle = withAlpha(color('purple'), 0.18);
            c.fillRect(b[0] * k, b[1] * k, (b[2] - b[0]) * k, (b[3] - b[1]) * k);
            strokeBox(c, k, b, color('purple'), 2.5);
            chip(c, `best IoU ${best(b).toFixed(2)}`, b[0] * k, b[3] * k + 3, color('purple'), w);
          }
        });
        const totalRo = f.readout('ConvNet runs');
        const hitRo = f.readout('crops framing an object (IoU ≥ 0.5)');
        let acc = 0;
        const loop = f.loop((dt) => {
          acc += dt * Math.max(20, list.length / 3.5);
          const n = Math.floor(acc);
          acc -= n;
          cur = Math.min(list.length - 1, cur + Math.max(1, n));
          const b = list[cur]!;
          f.code.setMany({ wx: b[0], wy: b[1], runs: cur + 1 });
          f.code.highlight(['pos', 'crop', 'run'][Math.floor(cur / 2) % 3]!);
          cv.redraw();
          if (cur >= list.length - 1) {
            playBtn.textContent = 'Scan';
            f.code.highlight(null);
            return false;
          }
        });
        const playBtn = f.button('Scan', () => {
          if (loop.running()) {
            loop.stop();
            playBtn.textContent = 'Scan';
          } else {
            if (cur >= list.length - 1) cur = -1;
            loop.start();
            playBtn.textContent = 'Pause';
          }
        }, { primary: true });
        f.segmented({
          label: 'window size',
          options: [
            { value: '64', label: '64' },
            { value: '96', label: '96' },
            { value: '128', label: '128' },
            { value: 'all', label: 'all three' },
          ],
          value: '96',
          onChange: (v) => {
            wins = v === 'all' ? [64, 96, 128] : [Number(v)];
            loop.stop();
            playBtn.textContent = 'Scan';
            rebuild();
          },
        });
        f.slider({
          label: 'stride',
          min: 8,
          max: 64,
          step: 8,
          value: 32,
          slot: 'stride',
          onInput: (v) => {
            stride = v;
            loop.stop();
            playBtn.textContent = 'Scan';
            rebuild();
          },
        });
        rebuild();
      },
      caption: `Press **Scan** to watch the window visit every position. Green boxes are crops that frame some object well (IoU at least 0.5 with a true box); these are the ones a good classifier would fire on. Drop the stride to 8 and use all three sizes: over 4,000 ConvNet runs for one small image. Notice also that square windows never frame the tall, thin people well: real systems also vary the window's shape, which multiplies the count again.`,
    });

    p.prose(`
### Sliding windows for free: fully convolutional networks

Overfeat's key efficiency trick reuses an idea from Chapter 11: a fully-connected layer can be rewritten as a convolution whose filter covers its entire input. Do that for every FC layer and the network contains only convolutions and pooling, so it accepts an input of *any* size. Feed it a larger image and, instead of one vector of class scores, it produces a small *grid* of score vectors, one per window position. Overlapping windows share all the overlapping convolution work.`);
    p.math({
      label: 'Output size of a convolution or pooling layer',
      tex: String.raw`N_{\text{out}} = \frac{N_{\text{in}} - F}{S} + 1`,
      code: `
        def out_size(n, F, S=1):
            return (n - F) // S + 1

        for n in [14, 16]:         # train size, test size
            n = out_size(n, 5)     # 5x5 conv:  10 | 12
            n = out_size(n, 2, 2)  # 2x2 pool:   5 |  6
            n = out_size(n, 5)     # FC as 5x5:  1 |  2
            print(n)               # 1, then 2 (a 2x2 grid)
      `,
      terms: [
        [String.raw`N_{\text{in}}`, 'the width (or height) of the layer\'s input'],
        [String.raw`F`, 'the filter (or pooling window) size'],
        [String.raw`S`, 'the stride: how far the filter jumps between positions'],
        [String.raw`N_{\text{out}}`, 'how many positions the filter fits into, which is the output width'],
      ],
      explain: 'You met this formula in Chapter 11 (here without padding). Follow the example: a network built for 14 × 14 inputs ends in a 1 × 1 output. Hand it a 16 × 16 image and every layer just keeps going: the last layer fits into 2 × 2 positions, so you get four sets of class scores, one for each 14 × 14 window, at the cost of slightly more than one forward pass.',
    });

    p.figure({
      title: 'One forward pass scores every window',
      codeTitle: 'fully_conv.py',
      code: `
        x = img                 # (3, {{n0:16}}, {{n0:16}})
        h = conv(x, F=5)        # -> {{n1:12}} x {{n1:12}}       #@c1
        h = maxpool(h, F=2, S=2)  # -> {{n2:6}} x {{n2:6}}      #@p1
        h = conv(h, F=5)        # was FC: -> {{n3:2}} x {{n3:2}}  #@c2
        s = conv(h, F=1)        # was FC: -> {{n3:2}} x {{n3:2}}  #@c3
        # cell ({{i:0}}, {{j:0}}) scores the 14x14 window at
        # rows {{r0:0}}-{{r1:13}}, cols {{q0:0}}-{{q1:13}} of the input
      `,
      setup(f) {
        let N = 16;
        let oi = 0;
        let oj = 0;
        const M = () => (N - 14) / 2 + 1;
        const cv = f.canvas(640, 250, (c, w, h) => {
          const n1 = N - 4, n2 = n1 / 2, m = M();
          const sizes = [N, n1, n2, m];
          const gapCells = 4;
          const total = sizes.reduce((a, b) => a + b, 0) + gapCells * 3;
          const cs = Math.min((w - 8) / total, (h - 44) / N);
          let x = (w - total * cs) / 2;
          const regions = [
            [2 * oi, 2 * oj, 14],
            [2 * oi, 2 * oj, 10],
            [oi, oj, 5],
            [oi, oj, 1],
          ];
          const names = ['input', 'conv', 'pool', 'out'];
          const cols = ['orange', 'teal', 'teal', 'blue'] as const;
          sizes.forEach((n, li) => {
            const top = (h - 36 - n * cs) / 2;
            const [ri, rj, rs] = regions[li]!;
            for (let a = 0; a < n; a++)
              for (let b = 0; b < n; b++) {
                const inR = a >= ri! && a < ri! + rs! && b >= rj! && b < rj! + rs!;
                c.fillStyle = inR ? withAlpha(color(cols[li]!), 0.55) : withAlpha(color('--ink'), 0.07);
                c.fillRect(x + b * cs + 0.5, top + a * cs + 0.5, cs - 1, cs - 1);
              }
            c.strokeStyle = color(cols[li]!);
            c.lineWidth = 2;
            c.strokeRect(x + rj! * cs, top + ri! * cs, rs! * cs, rs! * cs);
            c.fillStyle = color('--ink-2');
            c.font = font(12, 500);
            c.textAlign = 'center';
            c.textBaseline = 'alphabetic';
            c.fillText(names[li]!, x + (n * cs) / 2, h - 20);
            c.font = font(11, 500, true);
            c.fillText(`${n}×${n}`, x + (n * cs) / 2, h - 5);
            x += (n + gapCells) * cs;
          });
        });
        cv.canvas.classList.add('scroll-ok');
        const st = f.stepper({
          steps: 4,
          interval: 900,
          label: (k) => `output cell ${Math.floor(k / M())}, ${k % M()}`,
          onStep: (k) => {
            oi = Math.floor(k / M());
            oj = k % M();
            sync();
          },
        });
        const sync = () => {
          const n1 = N - 4;
          f.code.setMany({ n0: N, n1, n2: n1 / 2, n3: M(), i: oi, j: oj, r0: 2 * oi, r1: 2 * oi + 13, q0: 2 * oj, q1: 2 * oj + 13 });
          f.code.highlight('c3');
          cv.redraw();
        };
        f.slider({
          label: 'input size',
          min: 14,
          max: 24,
          step: 2,
          value: 16,
          onInput: (v) => {
            N = v;
            st.setSteps(M() * M());
            st.go(0);
          },
        });
      },
      caption: `The network was trained on 14 × 14 crops. Slide the input size up: each extra 2 pixels adds one more output position (the 2 × 2 pool means the windows step by 2 input pixels). Step through the output cells to see which 14 × 14 input window each one scores, and which part of each intermediate layer it depends on. Neighboring windows share most of their computation, which is why this is so much cheaper than cropping. This is the network from the lecture's example, with the numbers kept small.`,
    });

    p.prose(`
Overfeat ran this fully convolutional network at six scales. At every output position it predicted class scores and a class-specific box, then greedily merged boxes that agreed. The localization results on ImageNet (where an answer counts if the class is right and the box has IoU at least 0.5, with five guesses allowed) improved quickly as networks got deeper:`);
    p.table(
      ['Year', 'Method', 'ImageNet localization error (top 5)'],
      [
        ['2012', 'AlexNet', 'about 34%'],
        ['2013', 'Overfeat', 'about 30%'],
        ['2014', 'VGG', 'about 25%'],
        ['2015', 'ResNet', 'about 9%'],
      ],
      { caption: 'Winners of the ILSVRC localization task, rounded. ResNet\'s jump came from a much deeper network combined with a region proposal approach (below).' },
    );

    p.h2('Too many boxes: non-maximum suppression', 'nms');
    p.prose(`
Any detector that looks at many windows fires many times on the same object: neighboring windows all see most of the dog, so they all say "dog". **Non-maximum suppression** (NMS) cleans this up. Sort the boxes by score. Keep the best one, and delete every remaining box that overlaps it by more than a threshold $\\symtau$. Repeat with the best of what is left. Boxes of different classes never suppress each other.`);

    p.figure({
      title: 'Non-maximum suppression, one box at a time',
      codeTitle: 'nms.py',
      code: `
        def nms(boxes, scores, classes, thresh={{tau:0.5}}):
            order = list(np.argsort(-scores))   # best first
            keep = []
            while order:                                    #@loop
                i = order.pop(0)                            #@pick
                keep.append(i)                              #@pick
                rest = np.array(order, dtype=int)
                ious = iou_many(boxes[i], boxes[rest])      #@iou
                same = classes[rest] == classes[i]          #@iou
                drop = (ious > thresh) & same               #@drop
                order = list(rest[~drop])                   #@drop
            return keep
        # kept {{nk:0}}, removed {{nr:0}}, left to check {{nl:18}}
      `,
      setup(f) {
        let tau = 0.5;
        type State = { keep: number[]; removed: number[]; just: number[]; cur: number; phase: 'start' | 'pick' | 'drop' | 'done' };
        let states: State[] = [];
        let k = 0;
        const build = () => {
          const order = CANDIDATES.map((_, i) => i).sort((a, b) => CANDIDATES[b]![1] - CANDIDATES[a]![1]);
          const keep: number[] = [];
          const removed: number[] = [];
          states = [{ keep: [], removed: [], just: [], cur: -1, phase: 'start' }];
          while (order.length) {
            const i = order.shift()!;
            keep.push(i);
            states.push({ keep: [...keep], removed: [...removed], just: [], cur: i, phase: 'pick' });
            const just: number[] = [];
            for (let q = order.length - 1; q >= 0; q--) {
              const j = order[q]!;
              if (CANDIDATES[j]![0] === CANDIDATES[i]![0] && iou(CANDIDATES[i]![2], CANDIDATES[j]![2]) > tau) {
                just.push(j);
                order.splice(q, 1);
              }
            }
            removed.push(...just);
            states.push({ keep: [...keep], removed: [...removed], just, cur: i, phase: 'drop' });
          }
          states.push({ keep: [...keep], removed: [...removed], just: [], cur: -1, phase: 'done' });
        };
        const cv = sceneCanvas(f, (c, kk, w) => {
          const st = states[k]!;
          const gone = new Set(st.removed);
          const kept = new Set(st.keep);
          const just = new Set(st.just);
          CANDIDATES.forEach(([cls, sc, b], i) => {
            if (kept.has(i) || just.has(i)) return;
            if (gone.has(i)) {
              if (st.phase !== 'done') strokeBox(c, kk, b, withAlpha(color('--ink'), 0.25), 1, [3, 3]);
              return;
            }
            strokeBox(c, kk, b, withAlpha(clsColor(cls), 0.25 + 0.6 * sc), 1.5);
          });
          st.just.forEach((i) => {
            const [, , b] = CANDIDATES[i]!;
            strokeBox(c, kk, b, color('red'), 2, [5, 4]);
            chip(c, `IoU ${iou(CANDIDATES[st.cur]![2], b).toFixed(2)}`, b[0] * kk + 2, b[3] * kk - 18, color('red'), w);
          });
          st.keep.forEach((i) => {
            const [cls, , b] = CANDIDATES[i]!;
            strokeBox(c, kk, b, clsColor(cls), i === st.cur ? 4 : 2.5);
          });
          const placed: Rect[] = [];
          st.keep.forEach((i) => {
            const [cls, sc, b] = CANDIDATES[i]!;
            boxChip(c, kk, b, `${SCENE_CLASSES[cls]} ${sc.toFixed(2)}`, clsColor(cls), w, placed);
          });
        });
        const st = f.stepper({
          steps: 2,
          interval: 900,
          label: (i) => {
            const s = states[i]!;
            return s.phase === 'start' ? 'all candidates' : s.phase === 'done' ? 'done' : s.phase === 'pick' ? `keep the best left` : `suppress ${s.just.length}`;
          },
          onStep: (i) => {
            k = i;
            const s = states[i]!;
            f.code.highlight(s.phase === 'pick' ? 'pick' : s.phase === 'drop' ? ['iou', 'drop'] : s.phase === 'done' ? null : 'loop');
            f.code.setMany({ nk: s.keep.length, nr: s.removed.length, nl: CANDIDATES.length - s.keep.length - s.removed.length });
            cv.redraw();
          },
        });
        f.slider({
          label: 'IoU threshold τ',
          sym: 'tau',
          min: 0.1,
          max: 0.9,
          step: 0.05,
          value: 0.5,
          slot: 'tau',
          format: (v) => v.toFixed(2),
          onInput: (v) => {
            tau = v;
            build();
            st.setSteps(states.length);
            st.go(states.length - 1);
          },
        });
        build();
        st.setSteps(states.length);
      },
      caption: `Eighteen raw detections, as a detector might emit them. Step through: each round keeps the highest-scoring box left (thick outline) and deletes same-class boxes that overlap it by more than $\\symtau$ (red, with their IoU). At $\\symtau = 0.5$ a weak duplicate on the car (IoU 0.48 with the best car box) slips through. Drag $\\symtau$ down to 0.45 and it is suppressed; drag it up to 0.65 and the box spanning both people survives too. Low thresholds also risk deleting a genuine second object standing right next to the first. Real pipelines usually drop very low scores (say below 0.05) before NMS, and the leftover low-confidence boxes here, like the "person" on the tree, are exactly what that removes.`,
    });

    p.h2('Detection as classification: region proposals', 'proposals');
    p.prose(`
Why not treat detection like localization and just regress boxes? Because the number of objects varies: one image has a single cat, another has forty people. A network with a fixed number of outputs fits awkwardly.

The alternative is **detection as classification**: look at many regions and, for each, ask a classifier "which class is this, or is it background?" That handles any number of objects, but brute force means evaluating a huge number of windows at many positions, sizes and shapes, each needing an expensive ConvNet.

The way out is to look only at a few likely regions. **Region proposal** methods are fast, class-agnostic "blob finders" that return around a thousand or two boxes likely to contain *some* object, chosen by low-level cues such as color, texture and edges:

- **Selective Search** (Uijlings et al., 2013) starts from an over-segmentation of the image into small patches and greedily merges similar neighbors, emitting a box at every step of the merging. About 2,000 proposals in a couple of seconds on a CPU.
- **EdgeBoxes** (Zitnick and Dollár, 2014) scores boxes by how many edge contours lie entirely inside them, and is much faster.

Proposals do not need to be precise. They need high *recall*: almost every real object should be covered by at least one proposal. The classifier and a box-regression step clean up the rest.`);

    p.h2('R-CNN, Fast R-CNN, Faster R-CNN', 'rcnn');
    p.prose(`
### R-CNN

**R-CNN** (Girshick et al., 2014) put proposals and ConvNets together:

1. Run Selective Search to get about 2,000 region proposals $\\symP$.
2. Warp each proposal to the fixed input size of the ConvNet (227 × 227 for AlexNet).
3. Run the ConvNet (pretrained on ImageNet, then fine-tuned on detection data) on each warped crop to get a feature vector.
4. Score each region with one linear SVM per class.
5. Refine each box with a linear **bounding-box regressor** that predicts how to nudge the proposal onto the object.

It was a big jump: 53.3% mean average precision on PASCAL VOC 2012, about 30% better (relative) than the previous best. But it was slow and clumsy: 2,000 full ConvNet passes per image (on the order of a minute per image with VGG-16), and training happened in separate stages (fine-tune the ConvNet, cache features to disk, train SVMs, train regressors) that never improved each other.

The box regressor's parameterization is worth seeing, because every detector since uses some version of it:`);
    p.math({
      label: 'Box regression targets (R-CNN)',
      tex: String.raw`\begin{aligned} \sym{t}{t_x} &= \frac{\sym{bg}{b^{*}_x} - \sym{P}{P_x}}{\sym{P}{P_w}}, & \sym{t}{t_y} &= \frac{\sym{bg}{b^{*}_y} - \sym{P}{P_y}}{\sym{P}{P_h}} \\[4pt] \sym{t}{t_w} &= \log\frac{\sym{bg}{b^{*}_w}}{\sym{P}{P_w}}, & \sym{t}{t_h} &= \log\frac{\sym{bg}{b^{*}_h}}{\sym{P}{P_h}} \end{aligned}`,
      code: `
        def box_deltas(P, gt):     # boxes as (cx, cy, w, h)
            t_x = (gt[0] - P[0]) / P[2]
            t_y = (gt[1] - P[1]) / P[3]
            t_w = np.log(gt[2] / P[2])
            t_h = np.log(gt[3] / P[3])
            return np.array([t_x, t_y, t_w, t_h])

        def apply_deltas(P, t):    # undo: proposal + offsets
            cx = P[0] + t[0] * P[2]
            cy = P[1] + t[1] * P[3]
            w, h = P[2] * np.exp(t[2]), P[3] * np.exp(t[3])
            return np.array([cx, cy, w, h])
      `,
      terms: [
        [String.raw`\sym{P}{P_x}, \sym{P}{P_y}, \sym{P}{P_w}, \sym{P}{P_h}`, 'the proposal\'s center, width and height'],
        [String.raw`\sym{bg}{b^{*}}`, 'the true box in the same format'],
        [String.raw`\sym{t}{t_x}`, 'how far to move the center sideways, *measured in proposal widths*'],
        [String.raw`\log\frac{b^{*}_w}{P_w}`, 'how much to stretch the width, as a log of the ratio: 0 means "keep it", positive means "wider"'],
      ],
      explain: 'Instead of predicting raw pixel coordinates, the network predicts *corrections relative to the proposal*. Dividing by the proposal size makes the targets the same for a small and a large box that are off by the same proportion, so one regressor works at every scale. The log turns "twice as wide" and "half as wide" into $+0.69$ and $-0.69$: symmetric, and the box can never get a negative width because $e^{t_w}$ is always positive.',
    });

    p.prose(`
### Fast R-CNN: share the convolutions

Most of R-CNN's work is redundant, because overlapping proposals recompute the same convolutions. **Fast R-CNN** (Girshick, 2015; building on the shared computation of SPP-net, He et al. 2014) swaps the order: run the convolutional layers *once* on the whole image, then cut each proposal's region out of the resulting feature map.

The cut-out regions have different sizes, but the fully-connected layers that follow need a fixed-size input. **RoI pooling** (region-of-interest pooling) fixes that: project the proposal onto the feature map, divide it into a fixed grid of $H \\times W$ cells (7 × 7 for VGG-16), and max-pool within each cell. Every proposal, large or small, comes out the same size.`);

    p.figure({
      title: 'RoI pooling: any region in, a fixed grid out',
      codeTitle: 'roi_pool.py',
      code: `
        def roi_pool(fmap, roi, H={{H:2}}, W={{W:2}}):
            x1, y1, x2, y2 = roi      # in cells
            h, w = y2 - y1, x2 - x1
            out = np.zeros((H, W))
            for i in range(H):                                #@loop
                for j in range(W):                            #@loop
                    ys = y1 + int(np.floor(i * h / H))        #@bin
                    ye = y1 + int(np.ceil((i + 1) * h / H))   #@bin
                    xs = x1 + int(np.floor(j * w / W))        #@bin
                    xe = x1 + int(np.ceil((j + 1) * w / W))   #@bin
                    out[i, j] = fmap[ys:ye, xs:xe].max()      #@max
            return out

        # image box ({{px}}) / 40
        # -> roi ({{roi}})
        # out = {{out}}
      `,
      setup(f) {
        const FW = 12, FH = 8, STRIDE = 40;
        const m = sceneMasks(2);
        const rng = new Rng(3);
        const fmap: number[] = [];
        for (let a = 0; a < FH; a++)
          for (let b = 0; b < FW; b++) {
            let cnt = 0;
            for (let yy = a * 20; yy < a * 20 + 20; yy++) for (let xx = b * 20; xx < b * 20 + 20; xx++) if (m.cls[yy * m.w + xx]) cnt++;
            fmap.push(Math.max(0, Math.min(9, Math.round((8 * cnt) / 400 + 2.4 * rng.next()))));
          }
        const roi: Box = [1, 4, 5, 7];
        let H = 2, W = 2;
        let sel = -1;
        const bins = () => {
          const [x1, y1, x2, y2] = roi;
          const h = y2 - y1, w = x2 - x1;
          const out: { ys: number; ye: number; xs: number; xe: number; v: number; ai: number; aj: number }[] = [];
          for (let i = 0; i < H; i++)
            for (let j = 0; j < W; j++) {
              const ys = y1 + Math.floor((i * h) / H), ye = y1 + Math.ceil(((i + 1) * h) / H);
              const xs = x1 + Math.floor((j * w) / W), xe = x1 + Math.ceil(((j + 1) * w) / W);
              let v = -1, ai = ys, aj = xs;
              for (let a = ys; a < ye; a++)
                for (let b = xs; b < xe; b++)
                  if (fmap[a * FW + b]! > v) {
                    v = fmap[a * FW + b]!;
                    ai = a;
                    aj = b;
                  }
              out.push({ ys, ye, xs, xe, v, ai, aj });
            }
          return out;
        };
        const binCols = ['blue', 'orange', 'green', 'purple', 'red', 'teal', 'gold', 'slate', 'blue'] as const;
        let geo = { cs: 0, ox: 0, oy: 0, outX: 0, outY: 0, oc: 0 };
        const cv = f.canvas(640, 300, (c, w, h) => {
          const cs = Math.min((w * 0.66) / FW, (h - 26) / FH);
          const ox = 0, oy = 20;
          drawScene(c, ox, oy, FW * cs, 0.45);
          const bs = bins();
          for (let a = 0; a < FH; a++)
            for (let b = 0; b < FW; b++) {
              const inR = b >= roi[0] && b < roi[2] && a >= roi[1] && a < roi[3];
              c.strokeStyle = withAlpha(color('--ink'), 0.18);
              c.lineWidth = 1;
              c.strokeRect(ox + b * cs, oy + a * cs, cs, cs);
              c.fillStyle = inR ? color('--ink') : withAlpha(color('--ink'), 0.55);
              c.font = font(Math.max(11, cs * 0.42), inR ? 700 : 500, true);
              c.textAlign = 'center';
              c.textBaseline = 'middle';
              c.fillText(String(fmap[a * FW + b]), ox + (b + 0.5) * cs, oy + (a + 0.5) * cs + 1);
            }
          bs.forEach((bn, q) => {
            if (sel >= 0 && sel !== q) return;
            const col = color(binCols[q % binCols.length]!);
            c.fillStyle = withAlpha(col, 0.2);
            c.fillRect(ox + bn.xs * cs + 2, oy + bn.ys * cs + 2, (bn.xe - bn.xs) * cs - 4, (bn.ye - bn.ys) * cs - 4);
            c.strokeStyle = col;
            c.lineWidth = 2;
            c.beginPath();
            c.arc(ox + (bn.aj + 0.5) * cs, oy + (bn.ai + 0.5) * cs, cs * 0.36, 0, Math.PI * 2);
            c.stroke();
          });
          c.strokeStyle = color('green');
          c.lineWidth = 3;
          c.strokeRect(ox + roi[0] * cs, oy + roi[1] * cs, (roi[2] - roi[0]) * cs, (roi[3] - roi[1]) * cs);
          c.fillStyle = color('green');
          c.fillRect(ox + roi[2] * cs - 6, oy + roi[3] * cs - 6, 12, 12);
          c.fillStyle = color('--ink-2');
          c.font = font(12, 500);
          c.textAlign = 'left';
          c.textBaseline = 'alphabetic';
          c.fillText(`feature map ${FW}×${FH} (1 cell = ${STRIDE} px)`, ox, 13);
          const restW = w - FW * cs;
          const oc = Math.min((restW - 24) / W, (FH * cs) / H, 56);
          const outX = FW * cs + (restW - W * oc) / 2;
          const outY = oy + (FH * cs - H * oc) / 2;
          geo = { cs, ox, oy, outX, outY, oc };
          c.fillStyle = color('--ink-2');
          c.textAlign = 'center';
          c.fillText(`out ${H}×${W}`, outX + (W * oc) / 2, outY - 8);
          bs.forEach((bn, q) => {
            const i = Math.floor(q / W), j = q % W;
            const col = color(binCols[q % binCols.length]!);
            c.fillStyle = withAlpha(col, sel === q ? 0.5 : 0.28);
            c.fillRect(outX + j * oc + 1, outY + i * oc + 1, oc - 2, oc - 2);
            c.strokeStyle = col;
            c.lineWidth = sel === q ? 3 : 1.5;
            c.strokeRect(outX + j * oc + 1, outY + i * oc + 1, oc - 2, oc - 2);
            c.fillStyle = color('--ink');
            c.font = font(Math.max(12, oc * 0.38), 700, true);
            c.textBaseline = 'middle';
            c.fillText(String(bn.v), outX + (j + 0.5) * oc, outY + (i + 0.5) * oc + 1);
          });
        });
        const sync = () => {
          const bs = bins();
          const rows: string[] = [];
          for (let i = 0; i < H; i++) rows.push(`[${bs.slice(i * W, i * W + W).map((b) => b.v).join(', ')}]`);
          f.code.setMany({ roi: roi.join(', '), px: roi.map((v) => v * STRIDE).join(', '), out: `[${rows.join(', ')}]`, H, W });
          cv.redraw();
        };
        let mode: 'move' | 'size' | null = null;
        let grab = [0, 0];
        const cell = (e: PointerEvent): [number, number] => {
          const r = cv.canvas.getBoundingClientRect();
          return [(e.clientX - r.left - geo.ox) / geo.cs, (e.clientY - r.top - geo.oy) / geo.cs];
        };
        cv.canvas.addEventListener('pointerdown', (e) => {
          const [cx, cy] = cell(e);
          const r = cv.canvas.getBoundingClientRect();
          const px = e.clientX - r.left, py = e.clientY - r.top;
          if (px >= geo.outX && py >= geo.outY && px < geo.outX + W * geo.oc && py < geo.outY + H * geo.oc) {
            const q = Math.floor((py - geo.outY) / geo.oc) * W + Math.floor((px - geo.outX) / geo.oc);
            sel = sel === q ? -1 : q;
            f.code.highlight(sel >= 0 ? ['bin', 'max'] : null);
            cv.redraw();
            return;
          }
          if (cx < 0 || cx > FW || cy < 0 || cy > FH) return;
          if (Math.abs(cx - roi[2]) < 0.7 && Math.abs(cy - roi[3]) < 0.7) mode = 'size';
          else if (cx >= roi[0] && cx < roi[2] && cy >= roi[1] && cy < roi[3]) {
            mode = 'move';
            grab = [cx - roi[0], cy - roi[1]];
          } else {
            roi[0] = Math.floor(cx);
            roi[1] = Math.floor(cy);
            roi[2] = roi[0] + 1;
            roi[3] = roi[1] + 1;
            mode = 'size';
          }
          sel = -1;
          f.code.highlight('max');
          cv.canvas.setPointerCapture(e.pointerId);
          sync();
        });
        cv.canvas.addEventListener('pointermove', (e) => {
          if (!mode) return;
          const [cx, cy] = cell(e);
          if (mode === 'move') {
            const w = roi[2] - roi[0], h = roi[3] - roi[1];
            roi[0] = Math.max(0, Math.min(FW - w, Math.round(cx - grab[0]!)));
            roi[1] = Math.max(0, Math.min(FH - h, Math.round(cy - grab[1]!)));
            roi[2] = roi[0] + w;
            roi[3] = roi[1] + h;
          } else {
            roi[2] = Math.max(roi[0] + 1, Math.min(FW, Math.round(cx)));
            roi[3] = Math.max(roi[1] + 1, Math.min(FH, Math.round(cy)));
          }
          sync();
        });
        cv.canvas.addEventListener('pointerup', () => {
          mode = null;
          f.code.highlight(null);
        });
        f.segmented({
          label: 'output grid',
          options: [
            { value: '2', label: '2 × 2' },
            { value: '3', label: '3 × 3' },
          ],
          value: '2',
          onChange: (v) => {
            H = W = Number(v);
            sel = -1;
            sync();
          },
        });
        sync();
      },
      caption: `The numbers are a made-up one-channel feature map laid over the scene (larger where objects are). The green rectangle is a proposal (it starts on the car), already projected from image pixels onto the feature map by dividing by the stride and rounding. **Drag** it to move it, drag its corner square to resize it, or tap elsewhere and drag to draw a new one. Colored patches are the bins; each output number is the max (circled) of its bin. Tap an output cell to see just its bin. Whatever the proposal's size, the output is always $H \\times W$. When the size does not divide evenly, neighboring bins overlap by a cell, exactly as the floor/ceil code says.`,
    });

    p.prose(`
Because RoI pooling is just max pooling (whose gradient Chapter 6 showed how to compute), the whole network can be trained **end to end** with one multi-task loss: a softmax over $C + 1$ classes (the extra one is "background") plus a class-specific box-offset regression with the targets $\\symt$ above. Fast R-CNN used the **smooth L1** loss for the boxes, which is quadratic for small errors and linear for large ones ($0.5\\,e^2$ if $|e| < 1$, else $|e| - 0.5$), so a few wildly wrong boxes cannot dominate training.

The payoff was dramatic. On VGG-16, training time dropped from about 84 hours to under 10, and test time, not counting proposals, from about 47 seconds per image to about a third of a second, with slightly *better* accuracy. Now the bottleneck was the region proposals themselves, at around 2 seconds per image on a CPU.

### Faster R-CNN: let the network propose

**Faster R-CNN** (Ren, He, Girshick and Sun, 2015) removed that bottleneck by making the ConvNet produce its own proposals. A small **Region Proposal Network** (RPN) slides a 3 × 3 convolution over the shared feature map. At every position it considers $k$ reference boxes called **anchors**, of several sizes and aspect ratios (in the paper, $k = 9$: three scales times three ratios), all centered at that position. For each anchor it predicts:

- an **objectness score** (object or not object: 2 numbers per anchor, so $2k$ per position), and
- four **box offsets** $\\symt$ that turn the anchor into a better box ($4k$ per position), with exactly the parameterization above, anchors playing the role of $\\symP$.

The top-scoring adjusted anchors, after NMS, become the proposals for the Fast R-CNN head on the same features. Training an anchor's objectness needs labels: anchors overlapping a true box with IoU above 0.7 are positives (and so is the single best anchor for each true box, in case none clears 0.7), those below 0.3 for every true box are negatives, and the rest are ignored.`);

    p.figure({
      title: 'Anchors of a region proposal network',
      codeTitle: 'anchors.py',
      code: `
        stride = 32                # 10 x 15 positions
        sizes = [{{sizes:96}}]
        ratios = [{{ratios:1}}]    # ratio = w / h
        anchors = []
        for i in range(320 // stride):
            for j in range(480 // stride):
                cx = (j + 0.5) * stride              #@center
                cy = (i + 0.5) * stride              #@center
                for s in sizes:
                    for r in ratios:
                        w = s * np.sqrt(r)           #@shape
                        h = s / np.sqrt(r)           #@shape
                        anchors.append((cx, cy, w, h))  #@shape
        anchors = np.array(anchors)  # ({{n:150}}, 4)
        # k = {{k:1}}: 2k = {{k2:2}} scores, 4k = {{k4:4}} offsets
        ious = iou_matrix(anchors, gt_boxes)         #@label
        best_iou = ious.max(axis=0)  # per object    #@label
        # {{best}}
      `,
      setup(f) {
        const STRIDE = 32, GW = 15, GH = 10;
        let sizes = [96];
        let ratios = [1];
        let pi = 7, pj = 10;
        let showBest = true;
        const anchorsAt = (i: number, j: number): Box[] => {
          const cx = (j + 0.5) * STRIDE, cy = (i + 0.5) * STRIDE;
          const out: Box[] = [];
          for (const s of sizes)
            for (const r of ratios) {
              const w = s * Math.sqrt(r), h = s / Math.sqrt(r);
              out.push([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]);
            }
          return out;
        };
        /** For each object: its best anchor and that anchor's IoU. */
        const bestPer = () =>
          OBJECTS.map((o) => {
            let bv = -1;
            let bb: Box = [0, 0, 0, 0];
            for (let i = 0; i < GH; i++)
              for (let j = 0; j < GW; j++)
                for (const a of anchorsAt(i, j)) {
                  const v = iou(a, o.box);
                  if (v > bv) {
                    bv = v;
                    bb = a;
                  }
                }
            return { box: bb, v: bv, cls: o.cls };
          });
        const cv = sceneCanvas(f, (c, k, w) => {
          for (let i = 0; i < GH; i++)
            for (let j = 0; j < GW; j++) {
              c.fillStyle = withAlpha(color('--ink'), 0.45);
              c.beginPath();
              c.arc((j + 0.5) * STRIDE * k, (i + 0.5) * STRIDE * k, 1.8, 0, Math.PI * 2);
              c.fill();
            }
          if (showBest) {
            for (const bp of bestPer()) {
              strokeBox(c, k, bp.box, clsColor(bp.cls), 2.2);
              chip(c, `IoU ${bp.v.toFixed(2)}`, bp.box[0] * k + 2, bp.box[3] * k - 18, clsColor(bp.cls), w);
            }
          }
          for (const a of anchorsAt(pi, pj)) {
            const v = Math.max(...OBJECTS.map((o) => iou(a, o.box)));
            const col = v > 0.7 ? color('green') : v < 0.3 ? color('slate') : color('gold');
            strokeBox(c, k, a, col, 2.4, v < 0.3 ? [5, 4] : []);
          }
          c.fillStyle = color('purple');
          c.beginPath();
          c.arc((pj + 0.5) * STRIDE * k, (pi + 0.5) * STRIDE * k, 5, 0, Math.PI * 2);
          c.fill();
        });
        const kRo = f.readout('anchors per position');
        const nRo = f.readout('anchors total');
        const meanRo = f.readout('mean best IoU');
        const sync = () => {
          const kk = sizes.length * ratios.length;
          const bp = bestPer();
          f.code.setMany({ sizes: sizes.join(', '), ratios: ratios.join(', '), n: GW * GH * kk, k: kk, k2: 2 * kk, k4: 4 * kk, best: `[${bp.map((b) => b.v.toFixed(2)).join(', ')}]` });
          kRo.set(kk);
          nRo.set(GW * GH * kk);
          meanRo.set(fmt(bp.reduce((a, b) => a + b.v, 0) / bp.length, 2));
          cv.redraw();
        };
        cv.canvas.addEventListener('pointerdown', (e) => {
          const [x, y] = scenePoint(cv.canvas, e);
          pj = Math.max(0, Math.min(GW - 1, Math.floor(x / STRIDE)));
          pi = Math.max(0, Math.min(GH - 1, Math.floor(y / STRIDE)));
          f.code.highlight(['center', 'shape']);
          cv.redraw();
        });
        cv.canvas.classList.add('scroll-ok');
        f.segmented({
          label: 'sizes',
          options: [
            { value: '1', label: '96' },
            { value: '3', label: '48, 96, 192' },
          ],
          value: '1',
          onChange: (v) => {
            sizes = v === '1' ? [96] : [48, 96, 192];
            f.code.highlight('label');
            sync();
          },
        });
        f.segmented({
          label: 'ratios',
          options: [
            { value: '1', label: '1' },
            { value: '3', label: '0.5, 1, 2' },
          ],
          value: '1',
          onChange: (v) => {
            ratios = v === '1' ? [1] : [0.5, 1, 2];
            f.code.highlight('label');
            sync();
          },
        });
        f.toggle({
          label: "each object's best anchor",
          value: true,
          onChange: (v) => {
            showBest = v;
            f.code.highlight(v ? 'label' : null);
            cv.redraw();
          },
        });
        sync();
      },
      caption: `Each dot is one position of the 10 × 15 feature map (stride 32). **Tap** anywhere to see the anchors centered at that position (purple dot), colored by their best IoU with any object: green above 0.7 (object), dashed gray below 0.3 (background), gold in between (ignored in training). The colored boxes are each object's best-matching anchor anywhere in the image. With one size and one ratio, the best matches are poor (IoU 0.23 to 0.50): no single square fits a car, a tall person and a small cat. Switch on three sizes and three ratios, the paper's $k = 9$, and every object's best match improves, the child's most of all (0.23 to 0.55). Even then nothing here clears 0.7, which is why Faster R-CNN also labels each object's single best anchor as positive, and why the predicted offsets $\\symt$ matter: anchors only need to be roughly right. (The paper used sizes of 128, 256 and 512 pixels and stride 16 on images about 600 pixels tall; ours are scaled to this smaller scene.)`,
    });

    p.prose(`
With the RPN, the whole detector is one network, trained with four losses at once (RPN objectness, RPN box offsets, final classification, final box offsets). Test time fell to about 0.2 seconds per image on a GPU, close to real time, at the same accuracy:`);
    p.table(
      ['', 'R-CNN', 'Fast R-CNN', 'Faster R-CNN'],
      [
        ['Proposals', 'Selective Search (CPU)', 'Selective Search (CPU)', 'RPN, shared features'],
        ['Conv work', 'once per proposal', 'once per image', 'once per image'],
        ['Training', 'multi-stage: ConvNet, SVMs, regressors', 'end to end (given proposals)', 'end to end'],
        ['Test time per image, with proposals', 'about 50 s', 'about 2 s', 'about 0.2 s'],
        ['mAP, PASCAL VOC 2007 (VGG-16)', '66.0', '66.9', '66.9'],
      ],
      { caption: 'The R-CNN family, as summarized in the 2016 lecture. In 2015, swapping VGG-16 for a 101-layer ResNet inside Faster R-CNN won the detection tasks of both ImageNet and COCO.' },
    );

    p.h2('Single-shot detectors: YOLO and SSD', 'yolo');
    p.prose(`
Faster R-CNN still runs in two stages: propose, then classify each proposal. **YOLO** ("You Only Look Once", Redmon et al., 2015/2016) asks a single network to do everything in one pass. It divides the image into an $S \\times S$ grid ($S = 7$). Each grid cell predicts:

- $B$ boxes ($B = 2$), each as five numbers: a center $(x, y)$ relative to the cell, a width and height relative to the whole image, and a **confidence** that the box contains an object and fits it well;
- one set of $C$ **class probabilities**, shared by the cell's boxes.

The cell that contains an object's center is the one responsible for detecting it. The whole output is one tensor of size $S \\times S \\times (5B + C)$: for PASCAL VOC's 20 classes, $7 \\times 7 \\times 30$.`);
    p.math({
      label: 'YOLO: per-box, per-class scores',
      tex: String.raw`\begin{aligned} \sym{s}{s_{c}} &= \underbrace{\Pr(\text{class}_c \mid \text{object})}_{\text{from the cell}} \\ &\quad \times \underbrace{\Pr(\text{object}) \cdot \operatorname{IoU}^{\text{truth}}_{\text{pred}}}_{\text{the box's confidence}} \end{aligned}`,
      code: `
        p_cls = cell[B * 5:]    # (C,) class probabilities
        conf = cell[k * 5 + 4]  # box k's confidence
        scores = conf * p_cls   # (C,) a score per class
        best = scores.argmax()  # keep it if this is high
      `,
      terms: [
        [String.raw`\Pr(\text{class}_c \mid \text{object})`, 'probability of class $c$ *given* that there is an object in this cell (read the bar as "given")'],
        [String.raw`\Pr(\text{object})`, 'probability that the box holds any object at all'],
        [String.raw`\operatorname{IoU}^{\text{truth}}_{\text{pred}}`, 'how well the predicted box overlaps the true one. During training the confidence is taught to equal this product'],
        [String.raw`\sym{s}{s_c}`, 'the final score for "this box is a class-$c$ object, and it is well placed"'],
      ],
      explain: 'Each box has one confidence ("is there something here, and does my box fit it?") and each cell has one opinion about the class ("if something is here, it is probably a dog"). Multiply them to get a score per class per box. Then, as always, threshold the scores and run non-maximum suppression.',
    });

    p.figure({
      title: 'YOLO\'s grid and what each cell predicts',
      codeTitle: 'yolo_decode.py',
      code: `
        S, B, C = {{S:7}}, 2, 4   # grid, boxes/cell, classes
        out = yolo_net(img)       # (S, S, B*5+C): {{shape:7x7x14}}
        dets = []
        for row in range(S):
            for col in range(S):
                cell = out[row, col]
                p_cls = cell[B*5:]                     #@cls
                for k in range(B):
                    v = cell[k*5 : k*5+5]              #@box
                    tx, ty, w, h, conf = v             #@box
                    cx = (col + tx) / S                #@box
                    cy = (row + ty) / S                #@box
                    scores = conf * p_cls              #@score
                    if scores.max() > 0.2:             #@score
                        dets.append((scores, (cx, cy, w, h)))
        dets = nms(dets)                               #@nms
        # cell ({{r:0}}, {{c:0}}): conf {{conf}}
        # p_cls {{pc}}
      `,
      setup(f) {
        let S = 7;
        let view = 'boxes';
        let sel: [number, number] = [0, 0];
        type Cell = { boxes: { b: Box; conf: number }[]; p: number[] };
        let cells: Cell[] = [];
        const build = () => {
          const rng = new Rng(S * 7 + 1);
          const cw = SCENE_W / S, ch = SCENE_H / S;
          cells = [];
          for (let r = 0; r < S; r++)
            for (let c = 0; c < S; c++) {
              const x0 = c * cw, y0 = r * ch;
              const cellBox: Box = [x0, y0, x0 + cw, y0 + ch];
              const resp = OBJECTS.filter((o) => {
                const cx = (o.box[0] + o.box[2]) / 2, cy = (o.box[1] + o.box[3]) / 2;
                return cx >= x0 && cx < x0 + cw && cy >= y0 && cy < y0 + ch;
              }).sort((a, b) => (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]) - (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]));
              const p = [0, 0, 0, 0];
              for (const o of OBJECTS) {
                const ov = iou(o.box, cellBox) > 0 ? Math.max(0, Math.min(o.box[2], cellBox[2]) - Math.max(o.box[0], cellBox[0])) * Math.max(0, Math.min(o.box[3], cellBox[3]) - Math.max(o.box[1], cellBox[1])) : 0;
                p[o.cls - 1]! += ov / (cw * ch);
              }
              if (resp[0]) p[resp[0].cls - 1]! += 2;
              for (let q = 0; q < 4; q++) p[q] = p[q]! + 0.08 + 0.1 * rng.next();
              const z = p.reduce((a, b) => a + b, 0);
              for (let q = 0; q < 4; q++) p[q] = p[q]! / z;
              const jitter = (o: Box, amt: number): Box => {
                const w = o[2] - o[0], h = o[3] - o[1];
                const dx = (rng.next() - 0.5) * amt * w, dy = (rng.next() - 0.5) * amt * h;
                const sw = 1 + (rng.next() - 0.5) * amt, sh = 1 + (rng.next() - 0.5) * amt;
                const cx = (o[0] + o[2]) / 2 + dx, cy = (o[1] + o[3]) / 2 + dy;
                return [cx - (w * sw) / 2, cy - (h * sh) / 2, cx + (w * sw) / 2, cy + (h * sh) / 2];
              };
              const randomBox = (conf: number) => {
                const cx = x0 + cw * (0.2 + 0.6 * rng.next()), cy = y0 + ch * (0.2 + 0.6 * rng.next());
                const w = SCENE_W * (0.06 + 0.25 * rng.next()), h = SCENE_H * (0.08 + 0.3 * rng.next());
                return { b: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2] as Box, conf };
              };
              const boxes: Cell['boxes'] = [];
              if (resp[0]) boxes.push({ b: jitter(resp[0].box, 0.12), conf: 0.72 + 0.22 * rng.next() });
              if (resp[1]) boxes.push({ b: jitter(resp[1].box, 0.12), conf: 0.55 + 0.2 * rng.next() });
              while (boxes.length < 2) boxes.push(randomBox(resp[0] ? 0.05 + 0.12 * rng.next() : 0.01 + 0.1 * rng.next()));
              cells.push({ boxes, p });
            }
        };
        const finalDets = () => {
          const dets: { cls: number; s: number; b: Box }[] = [];
          for (const cell of cells)
            for (const bx of cell.boxes) {
              const sc = cell.p.map((v) => v * bx.conf);
              const best = sc.indexOf(Math.max(...sc));
              if (sc[best]! > 0.2) dets.push({ cls: best + 1, s: sc[best]!, b: bx.b });
            }
          dets.sort((a, b) => b.s - a.s);
          const keep: typeof dets = [];
          for (const d of dets) if (!keep.some((kd) => kd.cls === d.cls && iou(kd.b, d.b) > 0.5)) keep.push(d);
          return keep;
        };
        const cv = sceneCanvas(f, (c, k, w) => {
          const cw = (SCENE_W / S) * k, ch = (SCENE_H / S) * k;
          if (view === 'classes') {
            cells.forEach((cell, q) => {
              const best = cell.p.indexOf(Math.max(...cell.p));
              c.fillStyle = withAlpha(clsColor(best + 1), 0.45);
              c.fillRect((q % S) * cw, Math.floor(q / S) * ch, cw, ch);
            });
          }
          if (view === 'grid') {
            OBJECTS.forEach((o) => {
              const cx = (o.box[0] + o.box[2]) / 2, cy = (o.box[1] + o.box[3]) / 2;
              const col = Math.floor(cx / (SCENE_W / S)), row = Math.floor(cy / (SCENE_H / S));
              c.fillStyle = withAlpha(clsColor(o.cls), 0.35);
              c.fillRect(col * cw, row * ch, cw, ch);
              strokeBox(c, k, o.box, clsColor(o.cls), 1.5, [4, 3]);
              c.fillStyle = clsColor(o.cls);
              c.beginPath();
              c.arc(cx * k, cy * k, 4.5, 0, Math.PI * 2);
              c.fill();
            });
          }
          c.strokeStyle = withAlpha(color('--paper'), 0.85);
          c.lineWidth = 1;
          c.beginPath();
          for (let q = 1; q < S; q++) {
            c.moveTo(q * cw, 0);
            c.lineTo(q * cw, SCENE_H * k);
            c.moveTo(0, q * ch);
            c.lineTo(SCENE_W * k, q * ch);
          }
          c.stroke();
          if (view === 'boxes') {
            cells.forEach((cell) =>
              cell.boxes.forEach((bx) => {
                c.globalAlpha = Math.min(1, 0.12 + bx.conf);
                strokeBox(c, k, bx.b, color('--ink'), 0.5 + 3.5 * bx.conf);
                c.globalAlpha = 1;
              }),
            );
          }
          if (view === 'final') {
            const dets = finalDets();
            for (const d of dets) strokeBox(c, k, d.b, clsColor(d.cls), 2.5);
            const placed: Rect[] = [];
            for (const d of dets) boxChip(c, k, d.b, `${SCENE_CLASSES[d.cls]} ${d.s.toFixed(2)}`, clsColor(d.cls), w, placed);
          }
          const cell = cells[sel[0] * S + sel[1]];
          if (cell && view !== 'final') {
            c.strokeStyle = color('purple');
            c.lineWidth = 3;
            c.strokeRect(sel[1] * cw, sel[0] * ch, cw, ch);
            cell.boxes.forEach((bx) => strokeBox(c, k, bx.b, color('purple'), 2.5, [6, 3]));
          }
        });
        const shapeRo = f.readout('output tensor');
        const sync = () => {
          const cell = cells[sel[0] * S + sel[1]]!;
          f.code.setMany({
            S,
            shape: `${S}x${S}x14`,
            r: sel[0],
            c: sel[1],
            conf: `[${cell.boxes.map((b) => b.conf.toFixed(2)).join(', ')}]`,
            pc: `[${cell.p.map((v) => v.toFixed(2)).join(', ')}]`,
          });
          shapeRo.set(`${S}×${S}×14 = ${S * S * 14} numbers`);
          cv.redraw();
        };
        cv.canvas.addEventListener('pointerdown', (e) => {
          const [x, y] = scenePoint(cv.canvas, e);
          sel = [Math.max(0, Math.min(S - 1, Math.floor(y / (SCENE_H / S)))), Math.max(0, Math.min(S - 1, Math.floor(x / (SCENE_W / S))))];
          f.code.highlight(['cls', 'box', 'score']);
          sync();
        });
        cv.canvas.classList.add('scroll-ok');
        f.segmented({
          label: 'show',
          options: [
            { value: 'grid', label: 'responsible cells' },
            { value: 'boxes', label: 'all boxes' },
            { value: 'classes', label: 'class map' },
            { value: 'final', label: 'after NMS' },
          ],
          value: 'boxes',
          onChange: (v) => {
            view = v;
            f.code.highlight(v === 'final' ? 'nms' : v === 'classes' ? 'cls' : v === 'boxes' ? 'box' : null);
            cv.redraw();
          },
        });
        f.slider({
          label: 'grid size S',
          min: 3,
          max: 9,
          step: 1,
          value: 7,
          onInput: (v) => {
            S = v;
            sel = [Math.min(sel[0], S - 1), Math.min(sel[1], S - 1)];
            build();
            sync();
          },
        });
        build();
        const dog = OBJECTS[3]!.box;
        sel = [Math.floor(((dog[1] + dog[3]) / 2) / (SCENE_H / S)), Math.floor(((dog[0] + dog[2]) / 2) / (SCENE_W / S))];
        sync();
      },
      caption: `The predictions here are made up by hand to show the *format* of YOLO's output, not produced by a trained network. "All boxes" draws every one of the $S \\cdot S \\cdot B$ boxes with thickness proportional to its confidence; **tap** a cell to outline its two boxes (purple) and read its numbers in the code. "Class map" colors each cell by its most likely class. "Responsible cells" marks the cell holding each object's center. "After NMS" multiplies confidences by class probabilities, thresholds and suppresses. Now set the grid to $S = 3$ and look at "after NMS": the dog's and the cat's centers land in the same cell, which has only one set of class probabilities, so the cat comes out labeled as a dog. A coarse grid with a few boxes and one class per cell is YOLO's known weakness with small objects in groups.`,
    });

    p.prose(`
YOLO ran at 45 frames per second (a smaller "Fast YOLO" at 155), several times faster than Faster R-CNN, at the cost of some accuracy: 63.4% mAP on PASCAL VOC 2007 against Faster R-CNN's 73.2%. Its coarse grid made small and crowded objects hard. **SSD** (Liu et al., 2015/2016) kept the single pass but predicted offsets for default boxes (like anchors) from several feature maps at different resolutions, so small objects are handled by the finer maps; it roughly matched Faster R-CNN's accuracy at YOLO-like speed.`);

    p.h2('Evaluating a detector: precision, recall, mAP', 'evaluation');
    p.prose(`
Accuracy does not work for detection: there is no fixed list of answers to be right or wrong about. Instead, collect every detection the system makes on the test set, sort them by score, and walk down the list. A detection is a **true positive** if it overlaps a true box of its class with IoU at least 0.5 and that true box has not already been claimed by a higher-scoring detection; otherwise it is a **false positive**. True boxes that nobody claims are **misses**.`);
    p.math({
      label: 'Precision and recall at a cutoff',
      tex: String.raw`\begin{aligned} \text{precision} &= \frac{\text{TP}}{\text{TP} + \text{FP}} \\[4pt] \text{recall} &= \frac{\text{TP}}{\text{number of true boxes}} \end{aligned}`,
      code: `
        tp_cum = np.cumsum(tp)      # TPs so far
        fp_cum = np.cumsum(1 - tp)  # FPs so far
        precision = tp_cum / (tp_cum + fp_cum)
        recall = tp_cum / n_gt
      `,
      terms: [
        [String.raw`\text{TP}, \text{FP}`, 'true and false positives among the detections kept so far (everything above the current score cutoff)'],
        [String.raw`\text{precision}`, 'of the boxes we reported, what fraction were right?'],
        [String.raw`\text{recall}`, 'of the objects that exist, what fraction did we find?'],
      ],
      explain: '`np.cumsum` is a running total: element $i$ is the sum of everything up to $i$. So after walking $i$ steps down the ranked list, we know precision and recall *if we had cut off there*. Lowering the cutoff finds more objects (recall up) but lets in more junk (precision usually down). The curve of precision against recall shows the whole tradeoff at once.',
    });
    p.math({
      label: 'Average precision and mAP',
      tex: String.raw`\begin{aligned} \text{AP} &= \int_0^1 \text{precision}(r)\, dr \\[2pt] \text{mAP} &= \frac{1}{C}\sum_{c=1}^{C} \text{AP}_c \end{aligned}`,
      code: `
        # area under the smoothed precision-recall curve
        ap = np.sum((mrec[i + 1] - mrec[i]) * mpre[i + 1])
        mAP = np.mean([ap_per_class[c] for c in classes])
      `,
      terms: [
        [String.raw`\int_0^1 \ldots\, dr`, 'the integral sign means "area under the curve" as recall $r$ runs from 0 to 1. For a step-shaped curve it is a sum of rectangle areas'],
        [String.raw`\text{precision}(r)`, 'the precision at recall $r$, after smoothing so it never goes up as recall grows'],
        [String.raw`\frac{1}{C}\sum_c`, 'the average over all $C$ classes'],
      ],
      explain: 'A single score per class: the area under its precision-recall curve. A perfect detector ranks every true positive above every false one and finds everything, scoring 1. **mAP** ("mean average precision") averages the AP of every class and is *the* headline number for detectors. PASCAL VOC uses IoU 0.5; its 2007 version approximates the area with 11 evenly spaced recall points. COCO averages AP over IoU thresholds from 0.5 to 0.95, rewarding tighter boxes.',
    });

    p.figure({
      title: 'Average precision from a ranked list',
      codeTitle: 'average_precision.py',
      code: `
        scores = np.array([.98, .95, .91, .87, .80,
                           .72, .65, .51, .40, .33])
        tp = np.array([{{tp:1, 1, 0, 1, 1, 0, 1, 0, 0, 1}}])
        n_gt = {{ngt:7}}           # true boxes in test set
        tp_cum = np.cumsum(tp)                          #@cum
        fp_cum = np.cumsum(1 - tp)                      #@cum
        precision = tp_cum / (tp_cum + fp_cum)          #@pr
        recall = tp_cum / n_gt                          #@pr
        mrec = np.concatenate([[0], recall, [1]])       #@ap
        mpre = np.concatenate([[0], precision, [0]])    #@ap
        for i in range(len(mpre) - 2, -1, -1):          #@env
            mpre[i] = max(mpre[i], mpre[i + 1])         #@env
        i = np.where(mrec[1:] != mrec[:-1])[0]          #@ap
        ap = np.sum((mrec[i + 1] - mrec[i]) * mpre[i + 1])  #@ap
        # AP = {{ap}}
      `,
      setup(f) {
        const scores = [0.98, 0.95, 0.91, 0.87, 0.8, 0.72, 0.65, 0.51, 0.4, 0.33];
        const tp = [1, 1, 0, 1, 1, 0, 1, 0, 0, 1];
        let ngt = 7;
        const compute = () => {
          let t = 0, fp = 0;
          const prec: number[] = [], rec: number[] = [];
          for (let i = 0; i < 10; i++) {
            t += tp[i]!;
            fp += 1 - tp[i]!;
            prec.push(t / (t + fp));
            rec.push(t / ngt);
          }
          const mrec = [0, ...rec, 1], mpre = [0, ...prec, 0];
          for (let i = mpre.length - 2; i >= 0; i--) mpre[i] = Math.max(mpre[i]!, mpre[i + 1]!);
          let ap = 0;
          for (let i = 0; i + 1 < mrec.length; i++) if (mrec[i + 1] !== mrec[i]) ap += (mrec[i + 1]! - mrec[i]!) * mpre[i + 1]!;
          return { prec, rec, mrec, mpre, ap };
        };
        const chipRows = (w: number) => (w < 520 ? 2 : 1);
        const chips = f.canvas(640, 150, (c, w, h) => {
          const rows = chipRows(w);
          const cols = 10 / rows;
          const cw = w / cols;
          const ch = h / rows;
          for (let i = 0; i < 10; i++) {
            const x0 = (i % cols) * cw, y0 = Math.floor(i / cols) * ch;
            const on = tp[i] === 1;
            const col = on ? color('green') : color('red');
            c.fillStyle = withAlpha(col, on ? 0.22 : 0.14);
            c.strokeStyle = col;
            c.lineWidth = 1.5;
            c.beginPath();
            c.roundRect(x0 + 3, y0 + 3, cw - 6, ch - 6, 6);
            c.fill();
            c.stroke();
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            const roomy = ch > 64;
            if (roomy) {
              c.fillStyle = color('--ink-3');
              c.font = font(11, 500);
              c.fillText(`#${i + 1}`, x0 + cw / 2, y0 + ch * 0.24);
            }
            c.fillStyle = color('--ink');
            c.font = font(13, 600, true);
            c.fillText(scores[i]!.toFixed(2).slice(1), x0 + cw / 2, y0 + ch * (roomy ? 0.5 : 0.36));
            c.fillStyle = col;
            c.font = font(12, 700);
            c.fillText(on ? 'TP' : 'FP', x0 + cw / 2, y0 + ch * (roomy ? 0.76 : 0.7));
          }
        });
        chips.canvas.classList.add('scroll-ok');
        const plot = f.plot({
          aspect: 1.7,
          square: false,
          domain: [-0.1, 1.05, -0.12, 1.12],
          draw: (pl) => {
            const r = compute();
            pl.axes({ grid: 0.2 });
            const xs: number[] = [], ys: number[] = [];
            for (let i = 0; i + 1 < r.mrec.length; i++) {
              xs.push(r.mrec[i]!, r.mrec[i + 1]!);
              ys.push(r.mpre[i + 1]!, r.mpre[i + 1]!);
            }
            pl.ctx.fillStyle = withAlpha(color('teal'), 0.22);
            pl.ctx.beginPath();
            pl.ctx.moveTo(pl.sx(0), pl.sy(0));
            xs.forEach((x, i) => pl.ctx.lineTo(pl.sx(x), pl.sy(ys[i]!)));
            pl.ctx.lineTo(pl.sx(1), pl.sy(0));
            pl.ctx.closePath();
            pl.ctx.fill();
            pl.path(xs, ys, color('teal'), 2);
            r.rec.forEach((x, i) => pl.dot(x, r.prec[i]!, 4, tp[i] ? color('green') : color('red')));
            pl.text('recall →', 0.75, -0.1, { align: 'center', size: 11, color: color('--ink-2') });
            pl.text('↑ precision', 0.01, 1.05, { size: 11, color: color('--ink-2') });
            for (const v of [0.5, 1]) {
              pl.text(String(v), v, -0.1, { align: 'center', size: 11, mono: true, color: color('--ink-3') });
              pl.text(String(v), -0.025, v - 0.02, { align: 'right', size: 11, mono: true, color: color('--ink-3') });
            }
          },
        });
        const apRo = f.readout('AP');
        const sync = () => {
          const r = compute();
          f.code.setMany({ tp: tp.join(', '), ngt, ap: fmt(r.ap, 3) });
          apRo.set(fmt(r.ap, 3));
          chips.redraw();
          plot.redraw();
        };
        chips.canvas.addEventListener('click', (e) => {
          const rr = chips.canvas.getBoundingClientRect();
          const rows = chipRows(rr.width);
          const cols = 10 / rows;
          const i = Math.floor(((e.clientY - rr.top) / rr.height) * rows) * cols + Math.floor(((e.clientX - rr.left) / rr.width) * cols);
          if (i < 0 || i > 9) return;
          tp[i] = 1 - tp[i]!;
          const nTP = tp.reduce((a, b) => a + b, 0);
          if (nTP > ngt) {
            ngt = nTP;
            gtSlider.set(ngt, false);
          }
          f.code.highlight(['cum', 'pr']);
          sync();
        });
        const gtSlider = f.slider({
          label: 'true boxes in test set',
          min: 5,
          max: 12,
          step: 1,
          value: 7,
          onInput: (v) => {
            const nTP = tp.reduce((a, b) => a + b, 0);
            ngt = Math.max(v, nTP);
            if (ngt !== v) gtSlider.set(ngt, false);
            f.code.highlight('ap');
            sync();
          },
        });
        sync();
      },
      caption: `Ten detections of one class, ranked by score. **Tap** a chip to flip it between true and false positive. Each dot on the plot is (recall, precision) after keeping the top $i$ detections; the teal staircase is the smoothed envelope, and its shaded area is the AP. Try moving the false positives to the top of the list: AP drops sharply, because early mistakes drag precision down at every cutoff. Add more true boxes with the slider: the curve stops short of recall 1 (those objects were never found), and the area shrinks.`,
    });

    p.h2('Semantic segmentation', 'segmentation');
    p.prose(`
Now the output is a label for **every pixel**. Training data is an image plus a label map of the same size, and the loss is simply the classification loss you already know, applied at each pixel and averaged.`);
    p.math({
      label: 'Per-pixel softmax loss',
      tex: String.raw`\symL = \frac{1}{HW} \sum_{i=1}^{H}\sum_{j=1}^{W} -\log \frac{e^{\sym{s}{s_{y_{ij},\,ij}}}}{\sum_{c} e^{\sym{s}{s_{c,\,ij}}}}`,
      code: `
        scores = net(img)                # (C, H, W) maps
        s = scores - scores.max(axis=0)  # stability shift
        log_probs = s - np.log(np.exp(s).sum(axis=0))
        rows, cols = np.indices(labels.shape)
        loss = -log_probs[labels, rows, cols].mean()
      `,
      terms: [
        [String.raw`s_{c,\,ij}`, 'the score for class $c$ at pixel $(i, j)$; the network outputs one $H \\times W$ score map per class'],
        [String.raw`y_{ij}`, 'the true class of pixel $(i, j)$'],
        [String.raw`-\log \frac{e^{s_{y}}}{\sum_c e^{s_c}}`, 'the softmax loss of Chapter 4 at that one pixel'],
        [String.raw`\frac{1}{HW}\sum_i\sum_j`, 'average over all $H \\times W$ pixels'],
      ],
      explain: 'Segmentation is classification, done once per pixel, with all pixels sharing one network. The fancy indexing `log_probs[labels, rows, cols]` just picks, at every pixel, the log-probability of that pixel\'s correct class.',
    });
    p.prose(`
The question is how to build a network that outputs a full-resolution label map.

- **Sliding window, one patch per pixel.** Crop a patch around each pixel and classify its center. It works, but it is absurdly slow: a separate ConvNet pass for every pixel, recomputing nearly identical features for neighbors.
- **Fully convolutional, no downsampling.** Keep every layer at full resolution. Correct, but convolutions on large images with many channels are very expensive, and receptive fields grow slowly.
- **Downsample, then upsample.** Let the network shrink the image with strided convolutions and pooling (cheap, with large receptive fields), then grow it back to full size inside the network. This is the design that won.

Earlier work by Farabet et al. (2013) ran a shared ConvNet on several rescaled copies of the image (**multi-scale**), upsampled and stacked the features, classified every pixel, and cleaned up the result with superpixels. Pinheiro and Collobert (2014) used **iterative refinement**: run the network, then feed its own output back in alongside the image and run it again, a few times, each pass sharpening the labels.

**Fully Convolutional Networks** (Long, Shelhamer and Darrell, 2015) took an ImageNet classifier, converted its FC layers to convolutions, and added learnable upsampling at the end, trained end to end on per-pixel labels. Its last feature map has stride 32 (each cell covers a 32 × 32 patch), so upsampling straight from there gives blobby, blocky edges. The fix was **skip connections**: predict scores from the earlier, finer pooling layers too (stride 16 and 8), and add them in after upsampling the coarse scores. Deep layers know *what*, shallow layers know *where*.`);

    p.figure({
      title: 'Coarse to fine: FCN-32s, 16s and 8s',
      codeTitle: 'fcn_skips.py',
      code: `
        f3, f4, f5 = backbone(img)  # strides 8,16,32
        s = score5(f5)                # (C, 10, 15)          #@s32
        s = upsample(s, 2) + score4(f4)   # (C, 20, 30)      #@s16
        s = upsample(s, 2) + score3(f3)   # (C, 40, 60)      #@s8
        s = upsample(s, {{up:32}})    # (C, 320, 480)        #@up
        labels = s.argmax(axis=0)     # (320, 480)           #@arg
        # pixel accuracy {{acc}}, mean IoU {{miou}}
      `,
      setup(f) {
        const m = sceneMasks(2);
        const C = SCENE_CLASSES.length;
        const cache = new Map<number, Uint8Array>();
        const predict = (stride: number): Uint8Array => {
          const hit = cache.get(stride);
          if (hit) return hit;
          const bs = stride / 2;
          const gw = m.w / bs, gh = m.h / bs;
          const frac = new Float32Array(C * gw * gh);
          for (let y = 0; y < m.h; y++)
            for (let x = 0; x < m.w; x++) {
              const cell = Math.floor(y / bs) * gw + Math.floor(x / bs);
              frac[m.cls[y * m.w + x]! * gw * gh + cell]! += 1 / (bs * bs);
            }
          const out = new Uint8Array(m.w * m.h);
          for (let y = 0; y < m.h; y++)
            for (let x = 0; x < m.w; x++) {
              const gx = Math.max(0, Math.min(gw - 1.0001, (x + 0.5) / bs - 0.5));
              const gy = Math.max(0, Math.min(gh - 1.0001, (y + 0.5) / bs - 0.5));
              const x0 = Math.floor(gx), y0 = Math.floor(gy);
              const ax = gx - x0, ay = gy - y0;
              let best = 0, bv = -1;
              for (let c = 0; c < C; c++) {
                const o = c * gw * gh;
                const v = (1 - ay) * ((1 - ax) * frac[o + y0 * gw + x0]! + ax * frac[o + y0 * gw + x0 + 1]!) + ay * ((1 - ax) * frac[o + (y0 + 1) * gw + x0]! + ax * frac[o + (y0 + 1) * gw + x0 + 1]!);
                if (v > bv) {
                  bv = v;
                  best = c;
                }
              }
              out[y * m.w + x] = best;
            }
          cache.set(stride, out);
          return out;
        };
        let stride = 32;
        const cv = sceneCanvas(f, (c, k, w, h) => {
          const lab = stride ? predict(stride) : m.cls;
          const pal = SCENE_CLASSES.map((_, i) => (i === 0 ? null : clsColor(i)));
          paintLabels(c, lab, m.w, m.h, pal, 0.68, w, h);
          if (stride) {
            c.strokeStyle = withAlpha(color('--ink'), 0.16);
            c.lineWidth = 1;
            c.beginPath();
            for (let x = stride; x < SCENE_W; x += stride) {
              c.moveTo(x * k, 0);
              c.lineTo(x * k, h);
            }
            for (let y = stride; y < SCENE_H; y += stride) {
              c.moveTo(0, y * k);
              c.lineTo(w, y * k);
            }
            c.stroke();
          }
        }, 0.7);
        const accRo = f.readout('pixel accuracy');
        const iouRo = f.readout('mean IoU');
        const sync = () => {
          const lab = stride ? predict(stride) : m.cls;
          let ok = 0;
          const inter = new Array(C).fill(0), uni = new Array(C).fill(0);
          for (let i = 0; i < lab.length; i++) {
            const a = lab[i]!, b = m.cls[i]!;
            if (a === b) {
              ok++;
              inter[a]++;
              uni[a]++;
            } else {
              uni[a]++;
              uni[b]++;
            }
          }
          const miou = inter.reduce((s, v, c) => s + v / Math.max(1, uni[c]), 0) / C;
          const acc = ok / lab.length;
          accRo.set(`${(acc * 100).toFixed(1)}%`);
          iouRo.set(fmt(miou, 3));
          f.code.setMany({ acc: `${(acc * 100).toFixed(1)}%`, miou: fmt(miou, 3), up: stride || 1 });
          f.code.highlight(stride === 32 ? ['s32', 'up', 'arg'] : stride === 16 ? ['s32', 's16', 'up', 'arg'] : stride === 8 ? ['s32', 's16', 's8', 'up', 'arg'] : null);
          cv.redraw();
        };
        f.segmented({
          label: 'predict at',
          options: [
            { value: '32', label: 'stride 32' },
            { value: '16', label: '+ skip: 16' },
            { value: '8', label: '+ skip: 8' },
            { value: '0', label: 'truth' },
          ],
          value: '32',
          onChange: (v) => {
            stride = Number(v);
            sync();
          },
        });
        sync();
      },
      caption: `What each output stride can hope to achieve. This is a simulation, not a trained network: for each stride we compute the *best possible* coarse score maps (the fraction of each grid cell covered by each class), upsample them bilinearly, and take the most likely class per pixel. At stride 32 (grid lines show the cells) the two people melt into one blob, the cat loses its tail and ears, and every edge is rounded off. Each skip connection halves the cell size and recovers detail. Mean IoU, the usual segmentation metric, averages the per-class IoU of the predicted and true pixel sets; it punishes losing small objects much more than pixel accuracy does. In the real FCN, each skip helped, and the first helped most.`,
    });

    p.h2('Upsampling inside the network', 'upsampling');
    p.prose(`
How does a network make a feature map *bigger*? Two families of layers do it.

**Unpooling** reverses pooling without learning anything. *Nearest-neighbor* unpooling copies each value into a 2 × 2 block. *"Bed of nails"* puts each value in one corner of its block and zeros elsewhere. *Max unpooling* is smarter: the matching max-pooling layer earlier in the network remembers which position held each max (the "switches"), and unpooling puts each value back exactly there. Networks like DeconvNet (Noh et al., 2015) mirror every pooling layer with an unpooling layer this way.`);
    p.code(`
      def unpool_nearest(x):         # (H, W) -> (2H, 2W)
          return x.repeat(2, axis=0).repeat(2, axis=1)

      def unpool_max(x, switches):   # from the matching max pool
          # switches[i, j] = (di, dj): where the max sat in its 2x2 window
          out = np.zeros((2 * x.shape[0], 2 * x.shape[1]))
          for i in range(x.shape[0]):
              for j in range(x.shape[1]):
                  di, dj = switches[i, j]
                  out[2 * i + di, 2 * j + dj] = x[i, j]
          return out
    `, { title: 'unpooling.py' });
    p.prose(`
**Transpose convolution** is the learnable option, and the one FCN used. A stride-2 convolution reads a 3 × 3 window of input to write one output value, then jumps 2 pixels. A stride-2 *transpose* convolution does the reverse: it reads one input value, multiplies the whole 3 × 3 filter by it, *writes* that 3 × 3 block into the output, and jumps 2 pixels in the output. Where neighboring blocks overlap, their contributions are added.

It goes by many names: "deconvolution" (common but misleading, since it does not undo a convolution), "upconvolution", "fractionally strided convolution" (it acts like a convolution with stride 1/2), "backward strided convolution". The last name explains the transpose: a convolution is a matrix multiply, and this layer multiplies by the *transpose* of that matrix, which is exactly the operation a strided convolution uses in its backward pass to send gradients to its input.`);
    p.math({
      label: 'A 1-D transpose convolution, stride 2',
      tex: String.raw`\begin{bmatrix} w_0 & 0 \\ w_1 & 0 \\ w_2 & w_0 \\ 0 & w_1 \\ 0 & w_2 \end{bmatrix} \begin{bmatrix} a \\ b \end{bmatrix} = \begin{bmatrix} a w_0 \\ a w_1 \\ a w_2 + b w_0 \\ b w_1 \\ b w_2 \end{bmatrix}`,
      code: `
        w = np.array([1.0, 2.0, 1.0])     # filter w0, w1, w2
        x = np.array([3.0, 5.0])          # input a, b
        out = np.zeros(5)                 # (2 - 1) * 2 + 3 = 5
        for i in range(2):
            out[2 * i : 2 * i + 3] += x[i] * w
        # out = [3, 6, 8, 10, 5]: the middle got 3*1 + 5*1

        M = np.array([[1, 2, 1, 0, 0],   # stride-2 conv of a
                      [0, 0, 1, 2, 1]])  # length-5 signal
        np.allclose(M.T.dot(x), out)     # True
      `,
      terms: [
        [String.raw`\begin{bmatrix} a \\ b \end{bmatrix}`, 'two input values'],
        [String.raw`w_0, w_1, w_2`, 'the three filter weights, learned like any other weights'],
        [String.raw`a w_2 + b w_0`, 'the overlap: both input values write to the middle output, and the contributions add'],
        [String.raw`\text{the } 5 \times 2 \text{ matrix}`, 'the transpose of the $2 \\times 5$ matrix that performs a stride-2 convolution on a length-5 signal'],
      ],
      explain: 'Each input value stamps a scaled copy of the filter into the output, and the stamps advance by the stride. A stride-2 convolution maps 5 numbers to 2; its transpose maps 2 numbers back to 5. It does not recover the original 5 numbers (that would be a true inverse); it only has the right *shape* and connectivity, and the filter weights are learned to make the upsampling useful.',
    });

    p.figure({
      title: 'Transpose convolution in 2-D: stamp and add',
      codeTitle: 'conv_transpose.py',
      code: `
        x = np.array([[1, 2], [3, 1]])     # input
        w = np.array([[1, 2, 1],
                      [2, 4, 2],
                      [1, 2, 1]])          # filter
        S = {{S:2}}                        # stride
        n = (2 - 1) * S + 3                # {{n:5}}
        out = np.zeros((n, n))
        for i in range(2):                           #@loop
            for j in range(2):                       #@loop
                r, c = i * S, j * S                  #@stamp
                out[r:r+3, c:c+3] += x[i, j] * w     #@stamp
        # i = {{i:0}}, j = {{j:0}}
      `,
      setup(f) {
        const X = [[1, 2], [3, 1]];
        const Wf = [[1, 2, 1], [2, 4, 2], [1, 2, 1]];
        let S = 2;
        let step = 0;
        const stampCols = ['blue', 'orange', 'green', 'purple'] as const;
        const cv = f.canvas(640, 270, (c, w, h) => {
          const n = S + 3;
          const cs = Math.min((w - 40) / (2 + 3 + n + 3), (h - 34) / Math.max(n, 3));
          const mid = (h - 14) / 2;
          let x = (w - cs * (2 + 3 + n) - 2 * 1.5 * cs) / 2;
          const label = (s: string, cx: number) => {
            c.fillStyle = color('--ink-2');
            c.font = font(12, 500);
            c.textAlign = 'center';
            c.textBaseline = 'alphabetic';
            c.fillText(s, cx, h - 4);
          };
          const cellBox = (bx: number, by: number, txt: string, fill: string, stroke: string, lw = 1) => {
            c.fillStyle = fill;
            c.fillRect(bx + 1, by + 1, cs - 2, cs - 2);
            c.strokeStyle = stroke;
            c.lineWidth = lw;
            c.strokeRect(bx + 1, by + 1, cs - 2, cs - 2);
            c.fillStyle = color('--ink');
            c.font = font(Math.max(11, Math.min(16, cs * 0.4)), 600, true);
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(txt, bx + cs / 2, by + cs / 2 + 1);
          };
          const curIdx = step - 1;
          const top2 = mid - cs;
          for (let i = 0; i < 2; i++)
            for (let j = 0; j < 2; j++) {
              const q = i * 2 + j;
              const col = color(stampCols[q]!);
              const on = q === curIdx;
              cellBox(x + j * cs, top2 + i * cs, String(X[i]![j]), withAlpha(col, on ? 0.5 : q < step ? 0.2 : 0.06), on ? col : withAlpha(color('--ink'), 0.3), on ? 2.5 : 1);
            }
          label('input x', x + cs);
          x += 2 * cs + 1.5 * cs;
          const top3 = mid - 1.5 * cs;
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cellBox(x + j * cs, top3 + i * cs, String(Wf[i]![j]), withAlpha(color('--ink'), 0.05), withAlpha(color('--ink'), 0.3));
          label('filter w', x + 1.5 * cs);
          x += 3 * cs + 1.5 * cs;
          const topN = mid - (n * cs) / 2;
          const sums: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
          const cnt: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
          for (let q = 0; q < step; q++) {
            const i = Math.floor(q / 2), j = q % 2;
            for (let a = 0; a < 3; a++)
              for (let b = 0; b < 3; b++) {
                sums[i * S + a]![j * S + b]! += X[i]![j]! * Wf[a]![b]!;
                cnt[i * S + a]![j * S + b]!++;
              }
          }
          for (let a = 0; a < n; a++)
            for (let b = 0; b < n; b++) {
              const k = cnt[a]![b]!;
              const fill = k >= 2 ? withAlpha(color('red'), 0.12 + 0.1 * k) : k === 1 ? withAlpha(color('--ink'), 0.08) : withAlpha(color('--ink'), 0.02);
              cellBox(x + b * cs, topN + a * cs, k ? String(sums[a]![b]) : '', fill, withAlpha(color('--ink'), 0.25));
            }
          if (curIdx >= 0) {
            const i = Math.floor(curIdx / 2), j = curIdx % 2;
            c.strokeStyle = color(stampCols[curIdx]!);
            c.lineWidth = 3;
            c.strokeRect(x + j * S * cs, topN + i * S * cs, 3 * cs, 3 * cs);
          }
          label(`output ${n}×${n}`, x + (n * cs) / 2);
        });
        cv.canvas.classList.add('scroll-ok');
        const st = f.stepper({
          steps: 5,
          interval: 1100,
          label: (k) => (k === 0 ? 'empty output' : `stamp ${k} of 4`),
          onStep: (k) => {
            step = k;
            const q = Math.max(0, k - 1);
            f.code.setMany({ i: Math.floor(q / 2), j: q % 2 });
            f.code.highlight(k === 0 ? null : 'stamp');
            cv.redraw();
          },
        });
        f.segmented({
          label: 'stride',
          options: [
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
          ],
          value: '2',
          slot: 'S',
          onChange: (v) => {
            S = Number(v);
            f.code.set('n', S + 3);
            st.go(4);
          },
        });
      },
      caption: `Step through the four input values. Each one multiplies the filter and stamps the result into the output at its own position, $S$ pixels apart; red cells received more than one stamp, and their values are sums. With stride 2 the stamps overlap in a cross through the middle (the center cell gets all four). With stride 3 they tile with no overlap at all; with stride 1 they overlap heavily and the output is barely bigger than the input. Uneven overlap is why transpose convolutions can leave faint checkerboard patterns in generated images.`,
    });

    p.h2('Instance segmentation', 'instance');
    p.prose(`
Instance segmentation combines detection and segmentation: find each object, then label its pixels. The 2016-era approaches mostly looked like R-CNN with a mask step bolted on:

- **SDS** (Hariharan et al., 2014) took region proposals, extracted ConvNet features from both the bounding box and the masked-out foreground region, classified each region, and refined its mask.
- **Hypercolumns** (Hariharan et al., 2015) refined masks using features gathered from several layers at each pixel (a "hypercolumn" of deep and shallow features), the same deep-knows-what, shallow-knows-where idea as FCN's skips.
- **Multi-task network cascades** (Dai, He and Sun, 2015/2016) chained three stages on shared features: propose boxes (with an RPN), estimate a mask inside each box (with RoI pooling), then classify the masked region. It won the COCO 2015 segmentation challenge.

After this course, **Mask R-CNN** (He et al., 2017) made this the standard recipe: Faster R-CNN plus a small fully convolutional head that predicts a mask for every detected box, with a more careful version of RoI pooling (RoIAlign) that avoids rounding coordinates.`);

    p.callout('idea', `
- **Localization** is regression: four more numbers per image, trained with an L2 (or smooth L1) loss alongside the classification loss.
- **IoU** measures box agreement; **non-maximum suppression** removes duplicate detections; **mAP** (area under precision-recall curves, averaged over classes) grades detectors.
- **Detection** became practical with **region proposals** plus ConvNet classifiers (R-CNN), then got fast by **sharing convolutions** with **RoI pooling** (Fast R-CNN) and by letting the network propose regions from **anchors** (Faster R-CNN). **YOLO** and **SSD** predict everything in one pass.
- Box regressors predict **offsets relative to a proposal or anchor**, scaled by its size, with log-ratios for width and height.
- **Semantic segmentation** is per-pixel classification with a fully convolutional net that **downsamples then upsamples**, using **skip connections** for detail and **transpose convolutions** (stamp and add) to grow feature maps.`, 'Takeaways');
  },
};

export default chapter;
