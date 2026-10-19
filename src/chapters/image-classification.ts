import type { ChapterDef } from './index';
import { fmt } from '../core/code';
import { CIFAR_CLASSES, type CifarSet, drawCifar, loadCifar } from '../core/data';
import { CLASS_COLORS, color, rgbOf, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { type Metric, crossValidateFold, distanceMatrix, distancesTo, l2, nearest, vote } from '../lib/image-classification-knn';
import { IMAGE_CLASSIFICATION_SYMBOLS } from '../lib/image-classification-symbols';

const I1 = String.raw`\sym{Ia}{I_1}`;
const I2 = String.raw`\sym{Ib}{I_2}`;

/** Draws a CHW float/byte image (3 planes of 32 x 32) with crisp pixels. */
const scratch = (() => {
  let c: HTMLCanvasElement | null = null;
  return () => {
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 32;
    }
    return c;
  };
})();
function drawCHW(ctx: CanvasRenderingContext2D, px: ArrayLike<number>, off: number, x: number, y: number, size: number): void {
  const img = new ImageData(32, 32);
  for (let q = 0; q < 1024; q++) {
    for (let ch = 0; ch < 3; ch++) img.data[q * 4 + ch] = Math.max(0, Math.min(255, Math.round(px[off + ch * 1024 + q]!)));
    img.data[q * 4 + 3] = 255;
  }
  const tmp = scratch();
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, x, y, size, size);
  ctx.restore();
}

const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
const UI = 'system-ui, sans-serif';

function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: { size?: number; mono?: boolean; bold?: boolean; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline } = {}): void {
  ctx.fillStyle = o.color ?? color('--ink-2');
  ctx.font = `${o.bold ? '600 ' : ''}${o.size ?? 12}px ${o.mono ? MONO : UI}`;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.base ?? 'alphabetic';
  ctx.fillText(s, x, y);
}

/** 123456 -> "123k", 4321.7 -> "4,322". */
function short(v: number): string {
  if (v >= 1e5) return `${Math.round(v / 1000)}k`;
  if (v >= 1e4) return `${(v / 1000).toFixed(1)}k`;
  return Math.round(v).toLocaleString('en-US');
}

/** First index of each class in a set, in class order. */
function firstOfClass(set: CifarSet): number[] {
  const out = new Array<number>(10).fill(-1);
  for (let i = 0; i < set.n; i++) if (out[set.labels[i]!]! < 0) out[set.labels[i]!] = i;
  return out;
}

const chapter: ChapterDef = {
  symbols: IMAGE_CLASSIFICATION_SYMBOLS,

  render(p) {
    p.prose(`
Show a photo to a three-year-old and ask what is in it, and you get an answer in under a second. Show it to a computer and it receives something far less friendly: a block of a few thousand numbers. This chapter is about the gap between those two, and about the simplest possible way to bridge it.

We start with the task itself, see why it is so much harder than it sounds, and then build a first classifier that needs no cleverness at all: to label a new image, find the most similar image you have already seen and copy its label. It does better than chance, it fails in instructive ways, and along the way it teaches the habits every later chapter relies on: training, validation and test data, hyperparameters, and honest evaluation.`);

    // ------------------------------------------------------------------ task
    p.h2('The task: one label per image', 'task');
    p.prose(`
**Image classification** means: given an image, pick one label from a fixed list of categories, such as {cat, dog, ship, …}. That is the whole task. It sounds narrow, but many other vision problems in this course (finding objects, outlining them, describing a scene in words) are built on top of a good classifier.

To a computer an image is a grid of pixels, and each pixel is three numbers: how much red, green and blue light it has, each a whole number from 0 (none) to 255 (full). A CIFAR-10 image is 32 pixels wide and 32 tall, so it is a block of $32 \\times 32 \\times 3 = 3072$ numbers. A classifier's entire job is to turn those 3,072 numbers into one word.`);

    p.math({
      label: 'An image is an array of numbers',
      tex: String.raw`I \in \{0, 1, \dots, 255\}^{\,32 \times 32 \times 3}`,
      codeTitle: 'image.py',
      code: `
        img = X_train[0]      # one CIFAR-10 image
        img.shape             # (32, 32, 3): rows, columns, colors
        img.dtype             # uint8: whole numbers 0 to 255
        img[0, 0]             # the top-left pixel: array([R, G, B])
        img.size              # 3072 numbers in total
      `,
      terms: [
        ['I', 'an image'],
        [String.raw`\in`, 'is one of: "belongs to the set on the right"'],
        [String.raw`\{0, 1, \dots, 255\}`, 'the values each number may take: whole numbers from 0 to 255 (one byte)'],
        [String.raw`^{\,32 \times 32 \times 3}`, 'one such number for every row, every column and every color channel: 3,072 of them'],
      ],
      explain: 'Read it as a shape declaration: an image is a 32 by 32 by 3 block, and every cell holds a byte. NumPy says the same thing with `img.shape` and `img.dtype`. Nothing in those numbers says "cat"; that meaning lives only in how they are arranged.',
    });

    p.figure({
      title: 'An image is a grid of numbers',
      codeTitle: 'pixels.py',
      code: `
        img = X_train[{{i:0}}]    # a {{cls:…}}, (32, 32, 3)

        img[{{row:14}}, {{col:16}}]        # [{{r:…}}, {{g:…}}, {{b:…}}]     #@px
        img[{{row}}, {{col}}, {{ch:0}}]     # {{chname:red}} only: {{v:…}}   #@ch
        patch = img[{{r0:…}}:{{r1:…}}, {{c0:…}}:{{c1:…}}, {{ch}}]   # 5 x 5   #@patch

        x = img.reshape(-1)     # 3,072 numbers in a row
      `,
      setup(f) {
        let tr: CifarSet | null = null;
        let picks: number[] = [];
        let pi = 0;
        let row = 14;
        let col = 16;
        let ch = 0;
        const CH = ['red', 'green', 'blue'];
        const lay = (w: number, h: number) => {
          const S = Math.min(h - 22, w * 0.47);
          const x0 = S + 16;
          const cell = Math.min((w - x0) / 5, (h - 66) / 5);
          return { S, x0, cell };
        };
        const val = (r: number, c: number, k: number) => tr!.pixels[picks[pi]! * 3072 + k * 1024 + r * 32 + c]!;
        const patch0 = () => [Math.max(0, Math.min(27, row - 2)), Math.max(0, Math.min(27, col - 2))] as const;
        const cv = f.canvas(640, 400, (ctx, w, h) => {
          if (!tr) return;
          const { S, x0, cell } = lay(w, h);
          const i = picks[pi]!;
          drawCifar(ctx, tr, i, 0, 0, S);
          const ps = S / 32;
          const [pr, pc] = patch0();
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = color('--paper');
          ctx.lineWidth = 1.5;
          ctx.strokeRect(pc * ps, pr * ps, 5 * ps, 5 * ps);
          ctx.setLineDash([]);
          ctx.strokeStyle = color('--ink');
          ctx.lineWidth = 2;
          ctx.strokeRect(col * ps - 1, row * ps - 1, ps + 2, ps + 2);
          ctx.strokeStyle = color('--paper');
          ctx.lineWidth = 1;
          ctx.strokeRect(col * ps - 2.5, row * ps - 2.5, ps + 5, ps + 5);
          txt(ctx, `X_train[${i}]: a ${CIFAR_CLASSES[tr.labels[i]!]}`, 0, S + 16, { size: 12, color: color('--ink-3') });
          // the selected pixel's three values
          txt(ctx, `img[${row}, ${col}]`, x0, 16, { mono: true, size: 13, color: color('--ink') });
          const rgb = [val(row, col, 0), val(row, col, 1), val(row, col, 2)];
          const chipW = Math.min(66, (w - x0) / 3);
          const sq = chipW < 60 ? 8 : 12;
          rgb.forEach((v, k) => {
            const cx = x0 + k * chipW;
            const c = [0, 0, 0];
            c[k] = v;
            ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
            ctx.fillRect(cx, 36 - sq, sq, sq);
            txt(ctx, `${'RGB'[k]} ${v}`, cx + sq + 3, 36, { mono: true, size: chipW < 60 ? 11 : 12, bold: k === ch, color: color('--ink') });
          });
          txt(ctx, `${CH[ch]} channel, 5 × 5 around it`, x0, 58, { size: 11, color: color('--ink-3') });
          for (let a = 0; a < 5; a++)
            for (let b = 0; b < 5; b++) {
              const r = pr + a;
              const c = pc + b;
              const v = val(r, c, ch);
              const rgbc = [0, 0, 0];
              rgbc[ch] = v;
              const X = x0 + b * cell;
              const Y = 66 + a * cell;
              ctx.fillStyle = `rgb(${rgbc[0]},${rgbc[1]},${rgbc[2]})`;
              ctx.fillRect(X + 1, Y + 1, cell - 2, cell - 2);
              const on = r === row && c === col;
              if (on) {
                ctx.strokeStyle = color('--ink');
                ctx.lineWidth = 2;
                ctx.strokeRect(X + 1, Y + 1, cell - 2, cell - 2);
              }
              txt(ctx, String(v), X + cell / 2, Y + cell / 2 + 1, { mono: true, size: Math.max(11, Math.min(13, cell * 0.32)), bold: on, align: 'center', base: 'middle', color: v > 150 ? '#000' : '#fff' });
            }
        });
        cv.canvas.classList.add('scroll-ok');
        const sync = () => {
          if (!tr) return;
          const i = picks[pi]!;
          const [pr, pc] = patch0();
          f.code.setMany({
            i,
            cls: CIFAR_CLASSES[tr.labels[i]!]!,
            row,
            col,
            r: val(row, col, 0),
            g: val(row, col, 1),
            b: val(row, col, 2),
            ch,
            chname: CH[ch]!,
            v: val(row, col, ch),
            r0: pr,
            r1: pr + 5,
            c0: pc,
            c1: pc + 5,
          });
          cv.redraw();
        };
        const pick = (e: PointerEvent) => {
          const rect = cv.canvas.getBoundingClientRect();
          const { S } = lay(rect.width, rect.height);
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          if (x < 0 || y < 0 || x >= S || y >= S) return;
          const r = Math.floor((y / S) * 32);
          const c = Math.floor((x / S) * 32);
          if (r === row && c === col) return;
          row = r;
          col = c;
          f.code.highlight('px');
          sync();
        };
        cv.canvas.addEventListener('pointerdown', pick);
        cv.canvas.addEventListener('pointermove', (e) => {
          if (e.pointerType === 'mouse' || e.buttons) pick(e);
        });
        f.segmented({
          label: 'channel',
          options: [
            { value: '0', label: 'red' },
            { value: '1', label: 'green' },
            { value: '2', label: 'blue' },
          ],
          value: '0',
          onChange: (v) => {
            ch = Number(v);
            f.code.highlight(['ch', 'patch']);
            sync();
          },
        });
        f.button('Next image', () => {
          pi = (pi + 1) % picks.length;
          sync();
        });
        f.status('Loading CIFAR-10 sample…');
        loadCifar()
          .then(({ train }) => {
            tr = train;
            const first = firstOfClass(train);
            picks = [1, 7, 8, 3, 0, 6, 4, 9, 2, 5].map((c) => first[c]!);
            f.status('');
            sync();
          })
          .catch((e) => f.status(`Could not load CIFAR-10: ${(e as Error).message}`));
      },
      caption: `**Hover or tap the picture** to pick a pixel. The panel shows that pixel's three values, and below them the 5 × 5 neighborhood around it as raw numbers for one color channel at a time. This is everything the computer gets. Switch channels and notice that a pixel that looks plainly brown is just a red number somewhat larger than its blue number. Press **Next image** and look for anything in the numbers that announces what the object is.`,
    });

    p.prose(`The CIFAR-10 files actually store each image as three separate 32 × 32 planes (all the red values, then all the green, then all the blue); the assignment's data loader rearranges them into the (32, 32, 3) layout used here. Either way it is the same 3,072 numbers, and most classifiers in this course start by flattening them into one long row.`);

    // ------------------------------------------------------------ challenges
    p.h2('Why it is hard', 'challenges');
    p.prose(`
Recognizing a cat is effortless for you, which makes it easy to underestimate. The difficulty has a name: the **semantic gap**, the distance between raw pixel values and the meaning we want from them. Each of the following changes the numbers a great deal while leaving the correct label untouched.`);
    p.table(
      ['Challenge', 'What happens', 'What it does to the numbers'],
      [
        ['**Viewpoint**', 'the camera moves around the object', 'nearly every pixel value changes, yet it is the same cat'],
        ['**Scale**', 'objects appear near or far, big or small', 'the object covers 30 pixels or 3,000'],
        ['**Deformation**', 'cats stretch, curl up and sit in odd poses', 'the outline itself bends'],
        ['**Occlusion**', 'part of the object is hidden', 'sometimes only an ear and a tail are visible'],
        ['**Illumination**', 'bright sun, dim lamp, hard shadows', 'whole regions get brighter or darker'],
        ['**Background clutter**', 'the object blends into its surroundings', 'background pixels look like object pixels'],
        ['**Intra-class variation**', '"chair" covers thousands of designs', 'one label, wildly different pixels'],
      ],
    );
    p.prose(`
A good classifier must be **invariant** to all of these (its answer must not change) while staying **sensitive** to the differences that do matter, such as a house cat versus a lynx. Nobody knows how to write that down as a list of rules. Early computer vision tried: detect edges and corners, then describe a cat as an arrangement of shapes. Such systems were brittle, and every new category meant starting over.`);

    // ----------------------------------------------------------- data-driven
    p.h2('The data-driven approach', 'data-driven');
    p.prose(`
So we do what you would do to teach a child: show lots of examples. Instead of describing what a cat looks like, we collect many labeled images and write an algorithm that learns the appearance of each class from them. Every method in this course follows the same three steps:

1. **Input**: a *training set* of $N$ images, each labeled with one of $K$ classes.
2. **Learning**: use the training set to build a model. This step is called *training*.
3. **Evaluation**: ask the model to label new images it has never seen, the *test set*, and compare its answers with the true labels.

In code, that means every classifier exposes two functions:`);
    p.code(
      `
      def train(images, labels):
          """Look at labeled examples and build a model."""
          model = ...          # the machine learning happens here
          return model

      def predict(model, test_images):
          """Use the model to label new images."""
          test_labels = ...
          return test_labels
    `,
      { title: 'classifier_api.py' },
    );
    p.prose(`
### CIFAR-10

The dataset used throughout the course is **CIFAR-10**: 60,000 tiny color images, 32 × 32 pixels each, in 10 classes (airplane, automobile, bird, cat, deer, dog, frog, horse, ship, truck). It comes pre-split into 50,000 training images and 10,000 test images. To keep this site light, the figures use a class-balanced sample of it: 1,000 training and 200 test images (100 and 20 per class), downloaded once when a figure first needs them (3.7 MB).`);
    p.callout('history', 'CIFAR-10 was assembled by Alex Krizhevsky, Vinod Nair and Geoffrey Hinton and released in 2009, as a hand-labeled subset of a much larger collection called "80 Million Tiny Images". Krizhevsky went on to build AlexNet, the convolutional network whose 2012 ImageNet win started the deep learning boom (Chapter 11).', 'Where CIFAR-10 came from');

    p.figure({
      title: 'CIFAR-10: ten classes, many faces',
      codeTitle: 'show_cifar.py',
      code: `
        classes = ['plane', 'car', 'bird', 'cat', 'deer',
                   'dog', 'frog', 'horse', 'ship', 'truck']
        per_class = {{m:8}}
        for c, name in enumerate(classes):
            idxs = np.flatnonzero(y_train == c)   # class c
            idxs = np.random.choice(idxs, per_class,   #@pick
                                    replace=False)     #@pick
            for j, i in enumerate(idxs):
                n = c * per_class + j + 1     # grid cell
                plt.subplot(10, per_class, n)
                plt.imshow(X_train[i])                 #@show
                plt.axis('off')
        plt.show()
      `,
      setup(f) {
        let tr: CifarSet | null = null;
        let byClass: number[][] = [];
        let rng = new Rng(3);
        let shown: number[][] = [];
        let cols = 8;
        const choose = () => {
          shown = byClass.map((idxs) => rng.shuffle(idxs.slice()).slice(0, 10));
        };
        const cv = f.canvas(640, 680, (ctx, w, h) => {
          if (!tr) return;
          const labelW = 44;
          const gap = 3;
          cols = Math.max(4, Math.min(10, Math.floor((w - labelW) / 40)));
          const size = Math.min(44, (w - labelW - gap * (cols - 1)) / cols);
          const want = 10 * size + 9 * gap;
          if (Math.abs(want - h) > 1.5) {
            cv.canvas.style.aspectRatio = `${w} / ${want}`;
            return;
          }
          const left = (w - (labelW + cols * size + (cols - 1) * gap)) / 2;
          for (let c = 0; c < 10; c++) {
            const y = c * (size + gap);
            txt(ctx, CIFAR_CLASSES[c]!, left + labelW - 6, y + size / 2, { size: 12, align: 'right', base: 'middle', color: color('--ink-2') });
            for (let j = 0; j < cols; j++) drawCifar(ctx, tr, shown[c]![j]!, left + labelW + j * (size + gap), y, size);
          }
          f.code.set('m', cols);
        });
        cv.canvas.classList.add('scroll-ok');
        f.button('Shuffle', () => {
          rng = new Rng(Math.floor(Math.random() * 1e6));
          choose();
          f.code.highlight(['pick', 'show']);
          cv.redraw();
        }, { icon: 'shuffle' });
        f.status('Loading CIFAR-10 sample…');
        loadCifar()
          .then(({ train }) => {
            tr = train;
            byClass = Array.from({ length: 10 }, () => [] as number[]);
            for (let i = 0; i < train.n; i++) byClass[train.labels[i]!]!.push(i);
            choose();
            f.status('');
            cv.redraw();
          })
          .catch((e) => f.status(`Could not load CIFAR-10: ${(e as Error).message}`));
      },
      caption: `Each row is one class, filled with randomly chosen training images of that class; press **Shuffle** for others. Read along a single row and most of the challenges above show up at once: cats from the front and the side, close up and far away, in every color, half hidden, on carpet and on grass. A classifier has to call every one of them "cat". The code is close to the snippet that opens Assignment 1.`,
    });

    // ------------------------------------------------------ nearest neighbor
    p.h2('Nearest neighbor', 'nearest-neighbor');
    p.prose(`
Here is the simplest classifier one could write. **Training:** memorize every training image and its label. **Prediction:** for a new image, find the training image that looks most similar, and answer with its label.

"Looks most similar" needs to become a number. The most direct choice compares the two images position by position: subtract, drop the sign so that differences in either direction count, and add it all up. This is the **L1 distance** (also called the Manhattan distance, after walking a city grid).`);
    p.math({
      label: 'L1 distance between two images',
      tex: String.raw`\symd_1(${I1}, ${I2}) = \sum_{p} \left| \sym{Ia}{I_1^{\,p}} - \sym{Ib}{I_2^{\,p}} \right|`,
      codeTitle: 'l1.py',
      code: `
        I1 = X_test[0].astype(np.int32)    # the image we want to label
        I2 = X_train[0].astype(np.int32)   # one training image
        d1 = np.sum(np.abs(I1 - I2))       # one number; 0 if identical
      `,
      terms: [
        [String.raw`\sym{Ia}{I_1^{\,p}}`, 'number $p$ of the first image, where $p$ runs over all 3,072 positions (every pixel, every channel)'],
        [String.raw`\sym{Ia}{I_1^{\,p}} - \sym{Ib}{I_2^{\,p}}`, 'how much the two images differ at that one position'],
        [String.raw`\left|\,\cdot\,\right|`, 'absolute value: drop the minus sign, so a gap of 30 and a gap of −30 both count as 30'],
        [String.raw`\sum_p`, 'add those up over every position $p$'],
        [String.raw`\symd_1`, 'the result: one number. 0 for identical images, larger for more different ones'],
      ],
      explain: 'Lay one image on top of the other, measure the gap at each of the 3,072 positions, and total the gaps. The figure below does exactly this for two real CIFAR images and shows the gaps themselves as a third picture.',
    });
    p.callout('warning', 'Images usually arrive as `uint8`: unsigned bytes. Subtracting bytes in NumPy does not produce negative numbers; `10 - 20` wraps around to `246`. That silently wrecks every distance. Convert first, with `.astype(np.int32)` or `.astype(float)`, as every snippet in this chapter does.', 'Unsigned bytes wrap around');

    p.figure({
      title: 'The L1 distance, one difference at a time',
      codeTitle: 'difference.py',
      code: `
        I1 = X_test[{{i1:…}}].astype(np.int32)    # a {{c1:…}}
        I2 = X_train[{{i2:…}}].astype(np.int32)   # a {{c2:…}}
        diff = np.abs(I1 - I2)     # the third picture   #@diff

        # the red 4 x 4 window: sums to {{ps:…}}
        diff[{{wr0:…}}:{{wr1:…}}, {{wc0:…}}:{{wc1:…}}, 0]             #@patch

        d1 = np.sum(diff)                 # {{d1:…}}   #@d1
        d2 = np.sqrt(np.sum(diff ** 2))   # {{d2:…}}   #@d2
      `,
      setup(f) {
        let tr: CifarSet | null = null;
        let te: CifarSet | null = null;
        let tests: number[] = [];
        let ti = 0;
        let tj = 0;
        let wr = 12;
        let wc = 12;
        const rng = new Rng(17);
        const lay = (w: number) => {
          const gap = 12;
          const T = Math.min((w - 2 * gap) / 3, 150);
          const left = (w - (3 * T + 2 * gap)) / 2;
          return { gap, T, left };
        };
        const a = (set: CifarSet, i: number, k: number, r: number, c: number) => set.pixels[i * 3072 + k * 1024 + r * 32 + c]!;
        const diffImg = () => {
          const out = new Float64Array(3072);
          for (let q = 0; q < 3072; q++) out[q] = Math.abs(te!.pixels[tests[ti]! * 3072 + q]! - tr!.pixels[tj * 3072 + q]!);
          return out;
        };
        const cv = f.canvas(640, 500, (ctx, w, h) => {
          if (!tr || !te) return;
          const { gap, T, left } = lay(w);
          const want = 2 * T + 72;
          if (Math.abs(want - h) > 1.5) {
            cv.canvas.style.aspectRatio = `${w} / ${want}`;
            return;
          }
          const i1 = tests[ti]!;
          const xs = [left, left + T + gap, left + 2 * (T + gap)];
          drawCifar(ctx, te, i1, xs[0]!, 0, T);
          drawCifar(ctx, tr, tj, xs[1]!, 0, T);
          const D = diffImg();
          drawCHW(ctx, D, 0, xs[2]!, 0, T);
          const ps = T / 32;
          for (const x of xs) {
            ctx.strokeStyle = color('--paper');
            ctx.lineWidth = 2;
            ctx.strokeRect(x + wc * ps, wr * ps, 4 * ps, 4 * ps);
            ctx.strokeStyle = color('--ink');
            ctx.lineWidth = 1;
            ctx.strokeRect(x + wc * ps - 1, wr * ps - 1, 4 * ps + 2, 4 * ps + 2);
          }
          const sz = T < 120 ? 11 : 12;
          txt(ctx, `I₁: a ${CIFAR_CLASSES[te.labels[i1]!]}`, xs[0]! + T / 2, T + 16, { size: sz, align: 'center', color: color('orange') });
          txt(ctx, `I₂: a ${CIFAR_CLASSES[tr.labels[tj]!]}`, xs[1]! + T / 2, T + 16, { size: sz, align: 'center', color: color('blue') });
          txt(ctx, '|I₁ − I₂|', xs[2]! + T / 2, T + 16, { size: sz, align: 'center', color: color('--ink-2') });
          // the 4 x 4 red-channel window, as numbers
          const y0 = T + 44;
          const cell = T / 4;
          const heads = ['I₁, red', 'I₂, red', 'difference'];
          let psum = 0;
          for (let g = 0; g < 3; g++) {
            txt(ctx, heads[g]!, xs[g]! + T / 2, y0 - 8, { size: 11, align: 'center', color: color('--ink-3') });
            for (let r = 0; r < 4; r++)
              for (let c = 0; c < 4; c++) {
                const v1 = a(te, i1, 0, wr + r, wc + c);
                const v2 = a(tr, tj, 0, wr + r, wc + c);
                const v = g === 0 ? v1 : g === 1 ? v2 : Math.abs(v1 - v2);
                if (g === 2) psum += v;
                const X = xs[g]! + c * cell;
                const Y = y0 + r * cell;
                ctx.fillStyle = g === 2 ? `rgb(${v},${v},${v})` : `rgb(${v},0,0)`;
                ctx.fillRect(X + 1, Y + 1, cell - 2, cell - 2);
                txt(ctx, String(v), X + cell / 2, Y + cell / 2 + 1, { mono: true, size: Math.max(11, Math.min(13, cell * 0.34)), align: 'center', base: 'middle', color: v > 140 ? '#000' : '#fff' });
              }
          }
          txt(ctx, '−', xs[1]! - gap / 2, y0 + T / 2, { size: 16, align: 'center', base: 'middle', color: color('--ink-2') });
          txt(ctx, '→', xs[2]! - gap / 2, y0 + T / 2, { size: 14, align: 'center', base: 'middle', color: color('--ink-2') });
          txt(ctx, `window sum: ${psum}`, xs[2]! + T, y0 + T + 18, { size: 12, mono: true, align: 'right', color: color('red') });
          txt(ctx, 'tap a picture to move the window', xs[0]!, y0 + T + 18, { size: 11, color: color('--ink-3') });
        });
        cv.canvas.classList.add('scroll-ok');
        const d1Ro = f.readout('L1 distance d₁', { sym: 'd' });
        const d2Ro = f.readout('L2 distance d₂', { sym: 'd' });
        const sync = () => {
          if (!tr || !te) return;
          const i1 = tests[ti]!;
          let s1 = 0;
          let s2 = 0;
          for (let q = 0; q < 3072; q++) {
            const v = te.pixels[i1 * 3072 + q]! - tr.pixels[tj * 3072 + q]!;
            s1 += Math.abs(v);
            s2 += v * v;
          }
          let psum = 0;
          for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) psum += Math.abs(a(te, i1, 0, wr + r, wc + c) - a(tr, tj, 0, wr + r, wc + c));
          f.code.setMany({
            i1,
            i2: tj,
            c1: CIFAR_CLASSES[te.labels[i1]!]!,
            c2: CIFAR_CLASSES[tr.labels[tj]!]!,
            ps: psum,
            wr0: wr,
            wr1: wr + 4,
            wc0: wc,
            wc1: wc + 4,
            d1: s1,
            d2: fmt(Math.sqrt(s2), 5),
          });
          d1Ro.set(s1.toLocaleString('en-US'));
          d2Ro.set(Math.round(Math.sqrt(s2)).toLocaleString('en-US'));
          cv.redraw();
        };
        cv.canvas.addEventListener('pointerdown', (e) => {
          const rect = cv.canvas.getBoundingClientRect();
          const { gap, T, left } = lay(rect.width);
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          if (y < 0 || y >= T) return;
          const g = Math.floor((x - left) / (T + gap));
          if (g < 0 || g > 2) return;
          const lx = x - left - g * (T + gap);
          if (lx < 0 || lx >= T) return;
          wr = Math.max(0, Math.min(28, Math.floor((y / T) * 32) - 2));
          wc = Math.max(0, Math.min(28, Math.floor((lx / T) * 32) - 2));
          f.code.highlight('patch');
          sync();
        });
        f.button('Another test image', () => {
          ti = (ti + 1) % tests.length;
          f.code.highlight('diff');
          sync();
        });
        f.button('Another training image', () => {
          tj = rng.int(1000);
          f.code.highlight(['d1', 'd2']);
          sync();
        });
        loadCifar()
          .then(({ train, test }) => {
            tr = train;
            te = test;
            const ft = firstOfClass(test);
            tests = [3, 8, 1, 6, 0, 7, 4, 9, 2, 5].map((c) => ft[c]!);
            tj = firstOfClass(train)[5]!;
            sync();
          })
          .catch((e) => f.status(`Could not load CIFAR-10: ${(e as Error).message}`));
      },
      caption: `Left, a test image $${I1}$; middle, a training image $${I2}$; right, the absolute difference at every pixel and channel (black where they agree, bright where they differ). The L1 distance $\\symd_1$ is the sum of all 3,072 of those values. **Tap any picture** to move the 4 × 4 window and see the red-channel numbers under it, subtracted and summed. Then press **Another training image** several times: the distance swings with brightness and background much more than with what the pictures show.`,
    });

    p.prose(`
Wrap that distance in the train / predict skeleton and we have a complete classifier. Training is a single assignment; all the work happens at prediction time.`);
    p.code(
      `
      import numpy as np

      class NearestNeighbor:
          def train(self, X, y):
              """X: N x 3072, one flattened image per row. y: N labels."""
              self.Xtr = X.astype(np.int32)   # memorize everything
              self.ytr = y

          def predict(self, X):
              """X: M x 3072 test images. Returns M predicted labels."""
              M = X.shape[0]
              y_pred = np.zeros(M, dtype=self.ytr.dtype)
              for i in range(M):
                  # L1 distance from test image i to every training image
                  d = np.sum(np.abs(self.Xtr - X[i]), axis=1)
                  y_pred[i] = self.ytr[np.argmin(d)]   # closest label
              return y_pred
    `,
      { title: 'nearest_neighbor.py' },
    );
    p.prose(`The line \`d = np.sum(np.abs(self.Xtr - X[i]), axis=1)\` does a lot. \`X[i]\` is one row of 3,072 numbers; subtracting it from the 1000-by-3072 (or 50000-by-3072) training matrix subtracts it from *every* row at once (NumPy calls this broadcasting), and \`axis=1\` sums along each row, leaving one distance per training image. Then the prediction rule is:`);
    p.math({
      label: 'Nearest-neighbor prediction',
      tex: String.raw`\hat{\symy} = \symy_{j^\star}, \qquad j^\star = \arg\min_{j}\; \symd\big(${I1},\, \symX_j\big)`,
      codeTitle: 'predict_one.py',
      code: `
        d = np.sum(np.abs(Xtr - I1), axis=1)   # N distances
        j_star = np.argmin(d)                  # where the smallest is
        y_hat = ytr[j_star]                    # its label is the answer
      `,
      terms: [
        [String.raw`\symX_j`, 'training image $j$: row $j$ of the training matrix'],
        [String.raw`\symd(${I1}, \symX_j)`, 'its distance to the image we are labeling'],
        [String.raw`\arg\min_j`, 'not the smallest distance itself, but *which* $j$ produces it. That is `np.argmin`'],
        [String.raw`\symy_{j^\star}`, 'the label of that closest training image'],
        [String.raw`\hat{\symy}`, 'our prediction. The hat marks a guess, as opposed to the true label $y$'],
      ],
      explain: 'Of all the training images, find the one at the smallest distance and answer with its label. "min" would hand you the smallest distance; "arg min" hands you the position where it occurs, which is what you need to look up a label.',
    });
    p.prose(`And to see how good the classifier is, we count how often it is right on the test set:`);
    p.math({
      label: 'Accuracy',
      tex: String.raw`\text{accuracy} = \frac{1}{M}\sum_{i=1}^{M} \mathbf{1}\big[\,\hat{\symy}_i = \symy_i\,\big]`,
      codeTitle: 'accuracy.py',
      code: `
        nn = NearestNeighbor()
        nn.train(X_train, y_train)
        y_pred = nn.predict(X_test)            # M guesses
        accuracy = np.mean(y_pred == y_test)   # fraction that match
      `,
      terms: [
        [String.raw`\hat{\symy}_i = \symy_i`, 'the statement "the guess for test image $i$ is right"'],
        [String.raw`\mathbf{1}[\,\cdot\,]`, 'the indicator: 1 if the statement inside is true, 0 if it is false'],
        [String.raw`\frac{1}{M}\sum_{i=1}^{M}`, 'add up over all $M$ test images, then divide by $M$: an average'],
      ],
      explain: 'Accuracy is just the fraction of test images labeled correctly. In NumPy, `y_pred == y_test` produces an array of True and False, and taking its mean counts True as 1 and False as 0.',
    });
    p.prose(`
How well does it do? On the full CIFAR-10 (all 50,000 training images, all 10,000 test images) the nearest-neighbor classifier with L1 distance gets about **38.6%** of the test images right. That is far better than the 10% you would get by guessing, and far worse than people (about 94%) or the convolutional networks of 2016 (about 95%).

### The L2 distance

There are many other ways to measure how far apart two images are. The other common one is the **L2 distance**, the ordinary straight-line (Euclidean) distance: square the differences instead of taking absolute values, add them up, and take the square root.`);
    p.math({
      label: 'L2 distance between two images',
      tex: String.raw`\symd_2(${I1}, ${I2}) = \sqrt{\sum_{p} \left( \sym{Ia}{I_1^{\,p}} - \sym{Ib}{I_2^{\,p}} \right)^{2}}`,
      codeTitle: 'l2.py',
      code: `
        d2 = np.sqrt(np.sum((I1 - I2) ** 2))
        # when only the nearest one matters, the square root
        # can be skipped: it never changes which d is smallest
      `,
      terms: [
        [String.raw`\left(\sym{Ia}{I_1^{\,p}} - \sym{Ib}{I_2^{\,p}}\right)^2`, 'the gap at position $p$, squared: always positive, and large gaps count disproportionately (a gap of 10 counts 100, a gap of 100 counts 10,000)'],
        [String.raw`\sum_p`, 'total over all 3,072 positions'],
        [String.raw`\sqrt{\;\cdot\;}`, 'the square root brings the total back to the scale of a single pixel difference'],
      ],
      explain: 'This is Pythagoras\'s theorem with 3,072 sides instead of two. The squaring is the real difference from L1: L2 is much more upset by one large difference than by many small ones, while L1 counts every unit of difference the same wherever it is. With the same nearest-neighbor code, L2 reaches about **35.4%** on CIFAR-10, a little below L1.',
    });

    p.figure({
      title: 'The nearest neighbors of a test image',
      codeTitle: 'knn_one.py',
      code: `
        Xtr = X_train.reshape(1000, -1).astype(np.int32)
        I1 = X_test[{{q:…}}].reshape(-1)         # a {{qc:…}}
        metric = '{{metric:L1}}'
        if metric == 'L1':
            d = np.sum(np.abs(Xtr - I1), axis=1)             #@l1
        else:
            d = np.sqrt(np.sum((Xtr - I1) ** 2, axis=1))     #@l2
        nearest = np.argsort(d)[:{{k:1}}]        # the k closest    #@sort
        votes = np.bincount(ytr[nearest], minlength=10)        #@vote
        y_pred = np.argmax(votes)              # {{pred:…}}     #@pred
        # on all 200 test images: accuracy {{acc:not scored yet}}
      `,
      setup(f) {
        let tr: CifarSet | null = null;
        let te: CifarSet | null = null;
        let q = 0;
        let k = 1;
        let metric: Metric = 'L1';
        let row: Float64Array | null = null;
        let order: number[] = [];
        let acc: Record<string, number | null> = {};
        const queries = [4, 0, 11, 7, 2, 19, 27, 33, 41, 50];
        let qi = 0;
        const recompute = () => {
          if (!tr || !te) return;
          row = distancesTo(te, q, tr, metric);
          order = nearest(row, 10);
        };
        const cv = f.canvas(640, 310, (ctx, w, h) => {
          if (!tr || !te || !row) return;
          const Q = Math.min(w * 0.26, h - 76, 124);
          drawCifar(ctx, te, q, 0, 20, Q);
          txt(ctx, 'test image', 0, 13, { size: 12, color: color('orange'), bold: true });
          const truth = te.labels[q]!;
          const { pred } = vote(tr.labels, order, k);
          txt(ctx, `truth: ${CIFAR_CLASSES[truth]}`, 0, 20 + Q + 17, { size: 12, color: color('--ink-2') });
          txt(ctx, `${k}-NN: ${CIFAR_CLASSES[pred]} ${pred === truth ? '✓' : '✗'}`, 0, 20 + Q + 35, { size: 12, bold: true, color: pred === truth ? color('green') : color('red') });
          const x0 = Q + 18;
          const gap = 6;
          const cell = Math.min((w - x0 - 4 * gap) / 5, (h - 20 - 2 * 30 - gap) / 2);
          txt(ctx, `10 closest of 1,000 training images (${metric})`, x0, 13, { size: 12, color: color('--ink-2') });
          for (let t = 0; t < 10; t++) {
            const j = order[t]!;
            const X = x0 + (t % 5) * (cell + gap);
            const Y = 20 + Math.floor(t / 5) * (cell + 30 + gap);
            drawCifar(ctx, tr, j, X, Y, cell);
            const lab = tr.labels[j]!;
            if (t < k) {
              ctx.strokeStyle = color('slate');
              ctx.lineWidth = 3;
              ctx.strokeRect(X - 1.5, Y - 1.5, cell + 3, cell + 3);
            }
            const fs = cell < 56 ? 11 : 12;
            txt(ctx, CIFAR_CLASSES[lab]!, X, Y + cell + 13, { size: fs, bold: lab === truth, color: lab === truth ? color('green') : color('--ink-2') });
            txt(ctx, short(row[j]!), X, Y + cell + 26, { size: 11, mono: true, color: color('--ink-3') });
          }
        });
        cv.canvas.classList.add('scroll-ok');
        const votesRo = f.readout('votes');
        const accRo = f.readout('accuracy, 200 test images');
        const sync = () => {
          if (!tr || !te || !row) return;
          const { pred, votes } = vote(tr.labels, order, k);
          const parts = votes
            .map((v, c) => [v, c] as const)
            .filter(([v]) => v > 0)
            .sort((a, b) => b[0] - a[0] || a[1] - b[1])
            .map(([v, c]) => `${CIFAR_CLASSES[c]} ${v}`);
          votesRo.set(parts.join(' · '));
          const key = `${metric}-${k}`;
          const a = acc[key];
          accRo.set(a == null ? 'press Score' : `${Math.round(a * 100)}%`);
          f.code.setMany({
            q,
            qc: CIFAR_CLASSES[te.labels[q]!]!,
            pred: `${pred} = '${CIFAR_CLASSES[pred]}'`,
            acc: a == null ? 'not scored yet' : `${fmt(a, 3)}`,
          });
          f.code.highlight(metric === 'L1' ? 'l1' : 'l2', 'alt');
          cv.redraw();
        };
        f.segmented({
          label: 'distance',
          options: [
            { value: 'L1', label: 'L1' },
            { value: 'L2', label: 'L2' },
          ],
          value: 'L1',
          slot: 'metric',
          onChange: (v) => {
            metric = v as Metric;
            recompute();
            sync();
          },
        });
        f.slider({
          label: 'k',
          sym: 'k',
          min: 1,
          max: 10,
          step: 1,
          value: 1,
          slot: 'k',
          onInput: (v) => {
            k = v;
            f.code.highlight(['sort', 'vote', 'pred']);
            sync();
          },
        });
        f.button('Next test image', () => {
          qi = (qi + 1) % queries.length;
          q = queries[qi]!;
          recompute();
          sync();
        });
        const scoreBtn = f.button('Score all 200', () => {
          if (!tr || !te) return;
          scoreBtn.disabled = true;
          const m = metric;
          distanceMatrix('test-train', m, (fr) => f.status(fr < 1 ? `Computing 200 × 1,000 ${m} distances… ${Math.round(fr * 100)}%` : ''))
            .then((D) => {
              for (let kk = 1; kk <= 10; kk++) {
                let correct = 0;
                for (let i = 0; i < te!.n; i++) {
                  const nn = nearest(D.subarray(i * 1000, (i + 1) * 1000), kk);
                  if (vote(tr!.labels, nn, kk).pred === te!.labels[i]) correct++;
                }
                acc[`${m}-${kk}`] = correct / te!.n;
              }
              scoreBtn.disabled = false;
              f.status('');
              sync();
            })
            .catch(() => (scoreBtn.disabled = false));
        });
        f.status('Loading CIFAR-10 sample…');
        loadCifar()
          .then(({ train, test }) => {
            tr = train;
            te = test;
            q = queries[0]!;
            f.status('');
            recompute();
            sync();
          })
          .catch((e) => f.status(`Could not load CIFAR-10: ${(e as Error).message}`));
      },
      caption: `The image on the left is one of our 200 test images; on the right are its ten closest training images out of 1,000, nearest first, with their distances. The first $\\symk$ of them (outlined) vote, and the most common label wins; on a tie \`np.argmax\` picks the smaller class index. Neighbors with the correct label are shown in green. Switch between **L1** and **L2** and watch the order shuffle. Then press **Score all 200** to classify every test image: with this small training set, 1-NN gets 33% right with L1 and 28% with L2. Look at *why* the neighbors were chosen: very often it is a shared background color or overall brightness, not the object.`,
    });

    p.prose(`
### Without any loops

Assignment 1 asks you to compute all the test-to-training distances at once, with no Python loop at all. The trick is to expand the square:`);
    p.math({
      label: 'All L2 distances with one matrix multiply',
      tex: String.raw`\lVert a - b \rVert^2 = \lVert a \rVert^2 + \lVert b \rVert^2 - 2\, a \cdot b`,
      codeTitle: 'no_loops.py',
      code: `
        Xte = X_test.reshape(200, -1).astype(float)
        Xtr = X_train.reshape(1000, -1).astype(float)
        te = np.sum(Xte ** 2, axis=1)      # (200,)  |a|^2 per test image
        tr = np.sum(Xtr ** 2, axis=1)      # (1000,) |b|^2 per train image
        cross = Xte.dot(Xtr.T)             # (200, 1000): every a . b
        dists = np.sqrt(te[:, None] + tr[None, :] - 2 * cross)
      `,
      terms: [
        [String.raw`\lVert a - b \rVert^2`, 'the squared L2 distance between a test image $a$ and a training image $b$'],
        [String.raw`\lVert a \rVert^2`, 'the sum of the squares of $a$\'s own numbers (likewise for $b$)'],
        [String.raw`a \cdot b`, 'the dot product: multiply matching numbers and add them up'],
        [String.raw`-2\, a \cdot b`, 'the cross term: the only part that involves both images'],
      ],
      explain: 'It is the familiar $(x - y)^2 = x^2 + y^2 - 2xy$, applied at every position and summed. The payoff is that the cross terms for *every* test/training pair together form one matrix product, which NumPy hands to a heavily optimized library. `te[:, None] + tr[None, :]` uses broadcasting to add a column to a row, producing the full 200 by 1000 table. On real CIFAR-10 data it is typically a hundred times faster than two nested Python loops, or more.',
    });

    // ------------------------------------------------------------------- knn
    p.h2('k-nearest neighbors', 'knn');
    p.prose(`
Copying the label of the single closest image is fragile. If that one image is unusual (a mislabeled photo, or a cat that happens to sit on a blue blanket like a ship on water), the prediction is wrong. The fix is to consult more neighbors. **k-nearest neighbors (kNN)** finds the $\\symk$ closest training images and lets them vote; the most common label wins. With $\\symk = 1$ it is exactly the nearest-neighbor classifier again.`);
    p.math({
      label: 'The kNN vote',
      tex: String.raw`\hat{\symy} = \arg\max_{c}\; \sum_{j \,\in\, \mathcal{N}_{\symk}} \mathbf{1}\big[\,\symy_j = c\,\big]`,
      codeTitle: 'vote.py',
      code: `
        nearest = np.argsort(d)[:k]          # the k smallest distances
        votes = np.bincount(ytr[nearest], minlength=10)   # per class
        y_hat = np.argmax(votes)             # most votes wins
      `,
      terms: [
        [String.raw`\mathcal{N}_{\symk}`, 'the set of the $k$ training images closest to the one being labeled'],
        [String.raw`\mathbf{1}[\,\symy_j = c\,]`, '1 if neighbor $j$ has label $c$, otherwise 0'],
        [String.raw`\sum_{j \in \mathcal{N}_{\symk}}`, 'add that up over the $k$ neighbors: the number of votes for class $c$'],
        [String.raw`\arg\max_c`, 'the class $c$ with the most votes'],
      ],
      explain: '`np.argsort(d)` lists the training images from nearest to farthest, so its first $k$ entries are the neighbors. `np.bincount` counts how many of them carry each label, and `np.argmax` picks the largest count. Every neighbor gets one equal vote here; a common variant gives closer neighbors heavier votes.',
    });
    p.prose(`In two dimensions we can watch what this does. Below, every point of the plane is colored by the label kNN would give it. Those colored areas are the classifier's **decision regions**, and the borders between them are its **decision boundaries**.`);

    p.figure({
      title: 'kNN in two dimensions',
      codeTitle: 'knn_2d.py',
      code: `
        def knn_predict(q, X, y, k={{k:1}}, metric='{{metric:L2}}'):
            if metric == 'L1':
                d = np.sum(np.abs(X - q), axis=1)              #@l1
            else:
                d = np.sqrt(np.sum((X - q) ** 2, axis=1))      #@l2
            nearest = np.argsort(d)[:k]
            votes = np.bincount(y[nearest], minlength=3)
            if np.sum(votes == votes.max()) > 1:
                return -1          # a tie: left uncolored
            return np.argmax(votes)

        # color every spot of the plane by its prediction
        xs, ys = np.meshgrid(np.linspace(-1.1, 1.1, 120),
                             np.linspace(-1.1, 1.1, 120))
        grid = np.c_[xs.ravel(), ys.ravel()]
        regions = [knn_predict(g, X, y) for g in grid]
        # X holds {{n:…}} training points
      `,
      setup(f) {
        const initial = () => {
          const rng = new Rng(21);
          const pts: [number, number, number][] = [];
          for (let c = 0; c < 3; c++) {
            const a = (c / 3) * Math.PI * 2 + 0.6;
            for (let i = 0; i < 12; i++) pts.push([0.58 * Math.cos(a) + rng.randn() * 0.2, 0.58 * Math.sin(a) + rng.randn() * 0.2, c]);
          }
          pts.push([-0.42, 0.22, 0], [0.5, 0.12, 2], [0.1, -0.45, 1]);
          return pts;
        };
        let pts = initial();
        let k = 1;
        let metric: Metric = 'L2';
        let add = 0;
        const pl = f.plot({
          aspect: 1.15,
          domain: [-1.1, 1.1, -1.1, 1.1],
          draw: (pp) => {
            const cols = CLASS_COLORS.slice(0, 3).map((c) => rgbOf(color(c)));
            const paper = rgbOf(color('--paper'));
            const n = pts.length;
            const px = new Float64Array(n);
            const py = new Float64Array(n);
            const lab = new Int32Array(n);
            pts.forEach(([a, b, c], i) => {
              px[i] = a;
              py[i] = b;
              lab[i] = c;
            });
            const kk = Math.min(k, n);
            const bestD = new Float64Array(kk);
            const bestL = new Int32Array(kk);
            pp.field((x, y) => {
              if (!n) return [paper[0], paper[1], paper[2], 255];
              let m = 0;
              for (let i = 0; i < n; i++) {
                const dx = px[i]! - x;
                const dy = py[i]! - y;
                const dd = metric === 'L1' ? Math.abs(dx) + Math.abs(dy) : dx * dx + dy * dy;
                if (m < kk) {
                  let t = m++;
                  while (t > 0 && bestD[t - 1]! > dd) {
                    bestD[t] = bestD[t - 1]!;
                    bestL[t] = bestL[t - 1]!;
                    t--;
                  }
                  bestD[t] = dd;
                  bestL[t] = lab[i]!;
                } else if (dd < bestD[kk - 1]!) {
                  let t = kk - 1;
                  while (t > 0 && bestD[t - 1]! > dd) {
                    bestD[t] = bestD[t - 1]!;
                    bestL[t] = bestL[t - 1]!;
                    t--;
                  }
                  bestD[t] = dd;
                  bestL[t] = lab[i]!;
                }
              }
              const v = [0, 0, 0];
              for (let t = 0; t < m; t++) v[bestL[t]!]!++;
              const mx = Math.max(v[0]!, v[1]!, v[2]!);
              const winners = v.filter((c) => c === mx).length;
              if (winners > 1) return [paper[0], paper[1], paper[2], 255];
              const c = cols[v.indexOf(mx)]!;
              return [c[0], c[1], c[2], 75];
            }, 4);
            for (const [a, b, c] of pts) pp.dot(a, b, 5, color(CLASS_COLORS[c]!), color('--paper'));
          },
        });
        pl.canvas.classList.add('scroll-ok');
        const sync = () => {
          f.code.set('n', pts.length);
          f.code.highlight(metric === 'L1' ? 'l1' : 'l2');
          pl.redraw();
        };
        pl.canvas.addEventListener('click', (e) => {
          const [x, y] = pl.pointer(e);
          if (add === 3) {
            let best = -1;
            let bd = Infinity;
            pts.forEach(([a, b], i) => {
              const dd = Math.hypot(pl.sx(a) - pl.sx(x), pl.sy(b) - pl.sy(y));
              if (dd < bd) {
                bd = dd;
                best = i;
              }
            });
            if (best >= 0 && bd < 18) pts.splice(best, 1);
          } else pts.push([x, y, add]);
          sync();
        });
        f.segmented({
          label: 'tap adds',
          options: [
            { value: '0', label: 'blue' },
            { value: '1', label: 'orange' },
            { value: '2', label: 'green' },
            { value: '3', label: 'erase' },
          ],
          value: '0',
          onChange: (v) => (add = Number(v)),
        });
        f.slider({
          label: 'k',
          sym: 'k',
          min: 1,
          max: 15,
          step: 1,
          value: 1,
          slot: 'k',
          onInput: (v) => {
            k = v;
            sync();
          },
        });
        f.segmented({
          label: 'distance',
          options: [
            { value: 'L1', label: 'L1' },
            { value: 'L2', label: 'L2' },
          ],
          value: 'L2',
          slot: 'metric',
          onChange: (v) => {
            metric = v as Metric;
            sync();
          },
        });
        f.button('Reset', () => {
          pts = initial();
          sync();
        }, { icon: 'reset' });
        sync();
      },
      caption: `**Tap the plane** to add a point of the selected color (or choose **erase** and tap a point to remove it). At $\\symk = 1$ every training point claims the area nearest to it, so the three planted outliers carve out islands of the wrong color. Raise $\\symk$ to 5 or 7: the outliers are outvoted, the islands disappear and the boundaries smooth out. Uncolored patches are ties, where no class has a clear majority. Compare L1 and L2 at $\\symk = 1$: L1 boundaries run only horizontally, vertically or diagonally, while L2 boundaries can point any way.`,
    });

    p.prose(`
In practice you almost always want $\\symk$ larger than 1: a larger $\\symk$ smooths the boundaries and makes the classifier less sensitive to individual oddballs, which usually means it does better on new data. But how large? Too large and small classes get outvoted by big neighbors everywhere. That turns out to be a question you cannot settle by thinking; you settle it with data.`);

    // ------------------------------------------------------------ validation
    p.h2('Hyperparameters and validation', 'validation');
    p.prose(`
$\\symk$ is a **hyperparameter**: a setting of the learning algorithm itself, as opposed to something learned from the data. The choice of distance (L1, L2, or something else) is another. Hyperparameters show up all over machine learning, and there is rarely a way to know good values in advance. You try several and keep what works best.

But works best *on what*? The tempting answer is the test set, and it is a serious mistake. If you try twenty values of $\\symk$ and keep whichever scores best on the test set, you have quietly tuned your classifier to that test set. The accuracy you then report is optimistic: it measures how well you fit those particular test images, not how well the classifier will do on images it has never seen. The test set is valuable only as long as it plays no part in any decision.`);
    p.callout('warning', 'Treat the test set like a sealed exam paper. Using it to choose hyperparameters is *overfitting to the test set*, and afterwards its number no longer means what you think it means. Make every choice without it, then evaluate on it **exactly once**, at the very end.', 'Never tune on the test set');
    p.prose(`
The fix is to carve a **validation set** out of the training data. With CIFAR-10, for instance, you might keep 49,000 training images for training and hold back 1,000 as validation. Each candidate $\\symk$ is trained on the 49,000 and scored on the 1,000; the best one wins. The validation set plays the role of a practice test that you are allowed to look at.`);
    p.code(
      `
      # hold out 1,000 training images as a validation set
      X_val, y_val = X_train[:1000], y_train[:1000]
      X_tr, y_tr = X_train[1000:], y_train[1000:]

      results = {}
      for k in [1, 3, 5, 10, 20, 50, 100]:
          knn = KNearestNeighbor()
          knn.train(X_tr, y_tr)
          y_pred = knn.predict(X_val, k=k)
          results[k] = np.mean(y_pred == y_val)
          print(f'k = {k}: validation accuracy {results[k]:.3f}')

      best_k = max(results, key=results.get)   # then test, once
    `,
      { title: 'validation_split.py' },
    );
    p.prose(`
### Cross-validation

When the training set is small, a single validation set is a noisy judge: a handful of lucky images can make one $\\symk$ look better than it really is. **Cross-validation** spends more computation to get a steadier verdict. Split the training data into, say, 5 equal *folds*. Train on 4 of them and validate on the 5th; then rotate, so that every fold takes one turn as the validation set; then average the 5 scores.`);
    p.math({
      label: '5-fold cross-validation',
      tex: String.raw`\text{acc}_{\text{cv}}(\symk) = \frac{1}{5}\sum_{f=1}^{5} \text{acc}_f(\symk)`,
      codeTitle: 'cv_score.py',
      code: `
        scores = []
        for f in range(5):
            others = [g for g in range(5) if g != f]
            scores.append(evaluate(k, train_on=others, val_on=f))
        cv_acc = np.mean(scores)
      `,
      terms: [
        [String.raw`f`, 'which fold is being held out this round: 1 to 5'],
        [String.raw`\text{acc}_f(\symk)`, 'the validation accuracy of kNN with this $k$ when fold $f$ is held out: trained on the other four folds, scored on fold $f$'],
        [String.raw`\frac{1}{5}\sum_{f=1}^{5}`, 'the average over the five rounds'],
      ],
      explain: 'Every training image is used for validation exactly once and for training four times, so the score does not hinge on one arbitrary split. The price is five times the work for every candidate $k$. Common choices are 3, 5 or 10 folds.',
    });

    p.figure({
      title: 'Choosing k by 5-fold cross-validation',
      codeTitle: 'cross_validate.py',
      code: `
        # knn(Xtr, ytr, X, k, metric): kNN on every row of X
        num_folds = 5
        k_choices = [1, 3, 5, 8, 10, 12, 15, 20, 50, 100]
        X_folds = np.array_split(X_train, num_folds)
        y_folds = np.array_split(y_train, num_folds)

        acc = {k: [] for k in k_choices}
        for f in range(num_folds):                        #@fold
            X_val, y_val = X_folds[f], y_folds[f]   # held out
            X_tr = np.concatenate(X_folds[:f] + X_folds[f+1:])
            y_tr = np.concatenate(y_folds[:f] + y_folds[f+1:])
            for k in k_choices:
                y_pred = knn(X_tr, y_tr, X_val, k, '{{metric:L1}}')   #@pred
                acc[k].append(np.mean(y_pred == y_val))   #@acc

        means = {k: np.mean(acc[k]) for k in k_choices}
        best_k = max(means, key=means.get)    # {{best:…}}   #@best
        # then, once, on the test set: {{test:…}}   #@test
      `,
      setup(f) {
        const KS = [1, 3, 5, 8, 10, 12, 15, 20, 50, 100];
        let metric: Metric = 'L1';
        const results: Record<string, number[][]> = {};
        const tests: Record<string, { k: number; acc: number }> = {};
        let busy = false;
        const res = () => results[metric] ?? [];
        const best = () => {
          const r = res();
          if (r.length < 5) return -1;
          let bi = 0;
          let bm = -1;
          KS.forEach((_, t) => {
            const m = r.reduce((a, fold) => a + fold[t]!, 0) / r.length;
            if (m > bm + 1e-12) {
              bm = m;
              bi = t;
            }
          });
          return bi;
        };
        const pl = f.plot({
          aspect: 1.3,
          square: false,
          draw: (pp) => {
            const c = pp.ctx;
            const W = pp.w;
            const H = pp.h;
            const m = { l: 42, r: 10, t: 26, b: 34 };
            const r = res();
            const all = r.flat();
            const tst = tests[metric];
            const lo0 = all.length ? Math.min(...all, tst?.acc ?? 1) : 0.15;
            const hi0 = all.length ? Math.max(...all, tst?.acc ?? 0) : 0.35;
            const lo = Math.floor((lo0 - 0.02) * 20) / 20;
            const hi = Math.ceil((hi0 + 0.02) * 20) / 20;
            const X = (t: number) => m.l + ((t + 0.5) / KS.length) * (W - m.l - m.r);
            const Y = (v: number) => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);
            c.lineWidth = 1;
            for (let v = lo; v <= hi + 1e-9; v += 0.05) {
              c.strokeStyle = color('--grid');
              c.beginPath();
              c.moveTo(m.l, Math.round(Y(v)) + 0.5);
              c.lineTo(W - m.r, Math.round(Y(v)) + 0.5);
              c.stroke();
              txt(c, `${Math.round(v * 100)}%`, m.l - 6, Y(v), { size: 11, mono: true, align: 'right', base: 'middle', color: color('--ink-3') });
            }
            KS.forEach((kk, t) => txt(c, String(kk), X(t), H - m.b + 15, { size: 11, mono: true, align: 'center', color: color('--ink-3') }));
            txt(c, 'k', W - m.r, H - 4, { size: 12, align: 'right', color: color('slate'), bold: true });
            txt(c, 'validation accuracy (5 folds)', m.l, 13, { size: 11, color: color('--ink-3') });
            if (!r.length) {
              txt(c, busy ? 'computing…' : 'press Run', (m.l + W - m.r) / 2, (m.t + H - m.b) / 2, { size: 13, align: 'center', color: color('--ink-3') });
              return;
            }
            const bi = best();
            if (bi >= 0) {
              c.fillStyle = withAlpha(color('slate'), 0.12);
              const cw = (W - m.l - m.r) / KS.length;
              c.fillRect(X(bi) - cw / 2, m.t, cw, H - m.t - m.b);
            }
            for (const fold of r) KS.forEach((_, t) => dotAt(X(t), Y(fold[t]!), 3, withAlpha(color('--ink-3'), 0.7)));
            if (r.length === 5) {
              const means = KS.map((_, t) => r.reduce((a, fold) => a + fold[t]!, 0) / 5);
              const sds = KS.map((_, t) => Math.sqrt(r.reduce((a, fold) => a + (fold[t]! - means[t]!) ** 2, 0) / 5));
              c.strokeStyle = color('blue');
              c.lineWidth = 1.5;
              KS.forEach((_, t) => {
                c.beginPath();
                c.moveTo(X(t), Y(means[t]! - sds[t]!));
                c.lineTo(X(t), Y(means[t]! + sds[t]!));
                c.moveTo(X(t) - 4, Y(means[t]! - sds[t]!));
                c.lineTo(X(t) + 4, Y(means[t]! - sds[t]!));
                c.moveTo(X(t) - 4, Y(means[t]! + sds[t]!));
                c.lineTo(X(t) + 4, Y(means[t]! + sds[t]!));
                c.stroke();
              });
              c.lineWidth = 2;
              c.beginPath();
              KS.forEach((_, t) => (t ? c.lineTo(X(t), Y(means[t]!)) : c.moveTo(X(t), Y(means[t]!))));
              c.stroke();
              KS.forEach((_, t) => dotAt(X(t), Y(means[t]!), t === bi ? 5.5 : 4, color('blue')));
              if (tst) {
                const ti = KS.indexOf(tst.k);
                dotAt(X(ti), Y(tst.acc), 6, color('gold'));
                txt(c, `test ${Math.round(tst.acc * 100)}%`, X(ti) + (ti > 6 ? -10 : 10), Y(tst.acc) + 4, { size: 12, bold: true, align: ti > 6 ? 'right' : 'left', color: color('--ink') });
              }
            }
            function dotAt(x: number, y: number, rad: number, fill: string) {
              c.beginPath();
              c.arc(x, y, rad, 0, Math.PI * 2);
              c.fillStyle = fill;
              c.fill();
              c.strokeStyle = color('--paper');
              c.lineWidth = 1.2;
              c.stroke();
            }
          },
        });
        const bestRo = f.readout('best k', { sym: 'k' });
        const cvRo = f.readout('its mean accuracy');
        const sync = () => {
          const bi = best();
          if (bi >= 0) {
            const r = res();
            const m = r.reduce((a, fold) => a + fold[bi]!, 0) / 5;
            bestRo.set(KS[bi]!);
            cvRo.set(`${(m * 100).toFixed(1)}%`);
            f.code.set('best', KS[bi]!);
          } else {
            bestRo.set('–');
            cvRo.set('–');
            f.code.set('best', '…');
          }
          const t = tests[metric];
          f.code.set('test', t ? `${(t.acc * 100).toFixed(1)}% with k = ${t.k}` : '…');
          testBtn.disabled = busy || bi < 0 || !!t;
          runBtn.disabled = busy || res().length === 5;
          pl.redraw();
        };
        f.segmented({
          label: 'distance',
          options: [
            { value: 'L1', label: 'L1' },
            { value: 'L2', label: 'L2' },
          ],
          value: 'L1',
          slot: 'metric',
          onChange: (v) => {
            if (busy) return;
            metric = v as Metric;
            sync();
          },
        });
        const runBtn = f.button('Run', () => {
          if (busy) return;
          busy = true;
          const m = metric;
          f.code.highlight('pred');
          sync();
          distanceMatrix('train-train', m, (fr) => f.status(`Computing all 499,500 pairwise ${m} distances between the 1,000 training images… ${Math.round(fr * 100)}%`))
            .then(async (D) => {
              const { train } = await loadCifar();
              results[m] = [];
              for (let fold = 0; fold < 5; fold++) {
                f.status(`Fold ${fold + 1} of 5: training on 800 images, validating on 200…`);
                f.code.highlight(['fold', 'acc']);
                await new Promise((r) => setTimeout(r, 220));
                results[m]!.push(crossValidateFold(D, train.labels, 1000, 5, fold, KS));
                if (metric === m) pl.redraw();
              }
              busy = false;
              f.status('Done. The shaded column is the best k. Press **Test once** to score it on the test set.');
              f.code.highlight('best');
              sync();
            })
            .catch(() => {
              busy = false;
              sync();
            });
        }, { primary: true });
        const testBtn = f.button('Test once', () => {
          const bi = best();
          if (busy || bi < 0) return;
          busy = true;
          const m = metric;
          const kk = KS[bi]!;
          sync();
          distanceMatrix('test-train', m, (fr) => f.status(`Computing 200 × 1,000 test distances… ${Math.round(fr * 100)}%`))
            .then(async (D) => {
              const { train, test } = await loadCifar();
              let correct = 0;
              for (let i = 0; i < test.n; i++) {
                const nn = nearest(D.subarray(i * 1000, (i + 1) * 1000), kk);
                if (vote(train.labels, nn, kk).pred === test.labels[i]) correct++;
              }
              tests[m] = { k: kk, acc: correct / test.n };
              busy = false;
              f.status(`The test set has now been used. That ${(tests[m]!.acc * 100).toFixed(1)}% is the number to report; no more tuning after this.`);
              f.code.highlight('test');
              sync();
            })
            .catch(() => {
              busy = false;
              sync();
            });
        });
        sync();
      },
      caption: `Press **Run** to cross-validate kNN on our 1,000 training images, live. The first run computes all 499,500 pairwise distances, which takes a second or two. Each faint dot is one fold's validation accuracy, the blue line is their mean, and the bars span one standard deviation. With so few images the curve sits low and nearly flat, and the folds disagree by several points: exactly when averaging over folds earns its keep. (On the full CIFAR-10 the course notes found $\\symk \\approx 7$ worked best.) Try both distances, then press **Test once** for the only test-set number you get to report.`,
    });

    p.prose(`
### What people do in practice

Cross-validation is the careful choice when data is scarce, but it multiplies the cost of every experiment by the number of folds. With large datasets, and especially with neural networks that take hours or days to train, people use a single validation split instead, typically keeping somewhere between 50% and 90% of the training data for training and the rest for validation. The more hyperparameters you are tuning, the larger the validation set should be. If it would only hold a few hundred examples, cross-validation is the safer bet.`);

    // -------------------------------------------------------------- pros/cons
    p.h2('Pros and cons of nearest neighbors', 'pros-cons');
    p.prose(`
Nearest neighbors is easy to understand and to implement, and it takes no time to train: training is just storing the data. It pays for that at prediction time, where labeling one image means comparing it with every stored training image. That is backwards from what we usually want. Training happens once, offline, and can be allowed to take days; prediction happens every time someone uses the model, often on a phone, and must be fast. The linear classifiers and neural networks in the rest of the course make the opposite trade: expensive to train, cheap to use.`);
    p.table(
      ['', 'k-nearest neighbors', 'What we want'],
      [
        ['Training time', 'none: just store the data', 'may be slow; it happens once'],
        ['Memory at test time', 'the entire training set', 'a compact model'],
        ['Prediction time', 'grows with the training set', 'fast, and independent of it'],
        ['Accuracy on CIFAR-10', 'about 35 to 40% on raw pixels', 'as high as possible'],
      ],
    );
    p.prose(`A whole research area is devoted to speeding up the search itself. **Approximate nearest neighbor** methods (FLANN is a well-known library) build clever index structures that find a neighbor that is *almost certainly* among the closest, much faster than checking everything. They matter a great deal in practice, for example to search large image collections, but they cannot fix the deeper problem with pixel distances.`);

    // ---------------------------------------------------------- pixel distance
    p.h2('Why pixel distances are a poor judge', 'pixel-distance');
    p.prose(`
L1 and L2 on raw pixels measure whether two images have similar colors in the same places. That is related to what the images show, but only loosely. Two images can be close because both have a blue background. An image can be far from a lightly edited copy of *itself*.`);

    p.figure({
      title: 'Pixel distance is easily fooled',
      codeTitle: 'fooled.py',
      code: `
        I = X_train[{{i:…}}].astype(float)   # a {{cls:…}}
        shifted = np.roll(I, {{s:4}}, axis=1)   # wraps around   #@shift
        darker = I * {{a:0.6}}                                   #@dark
        boxed = I.copy()
        boxed[{{b0:…}}:{{b1:…}}, {{b0}}:{{b1}}] = 0    # black square   #@box

        # the closest training image of another class
        others = Xtr[ytr != ytr[{{i}}]]
        d = np.sqrt(np.sum((others - I.ravel())**2, axis=1))
        other = others[np.argmin(d)]        # a {{ocls:…}}   #@other

        for J in [shifted, darker, boxed, other]:   # L2 distances
            print(np.linalg.norm(I.ravel() - J.ravel()))
        # {{ds:…}}  {{dd:…}}  {{db:…}}  {{dot:…}}
      `,
      setup(f) {
        let tr: CifarSet | null = null;
        const picks = [489, 20, 761, 990, 759, 205, 374, 588];
        let pi = 0;
        let shift = 4;
        let dark = 0.6;
        let box = 12;
        let other = -1;
        const variant = (kind: 'shift' | 'dark' | 'box') => {
          const i = picks[pi]!;
          const out = new Float64Array(3072);
          const lo = 16 - box / 2;
          const hi = 16 + box / 2;
          for (let ch = 0; ch < 3; ch++)
            for (let r = 0; r < 32; r++)
              for (let c = 0; c < 32; c++) {
                const qq = ch * 1024 + r * 32 + c;
                let v = tr!.pixels[i * 3072 + qq]!;
                if (kind === 'shift') v = tr!.pixels[i * 3072 + ch * 1024 + r * 32 + ((((c - shift) % 32) + 32) % 32)]!;
                else if (kind === 'dark') v *= dark;
                else if (r >= lo && r < hi && c >= lo && c < hi) v = 0;
                out[qq] = v;
              }
          return out;
        };
        const distTo = (v: Float64Array) => {
          const i = picks[pi]!;
          let s = 0;
          for (let qq = 0; qq < 3072; qq++) {
            const t = tr!.pixels[i * 3072 + qq]! - v[qq]!;
            s += t * t;
          }
          return Math.sqrt(s);
        };
        const findOther = () => {
          const i = picks[pi]!;
          let bd = Infinity;
          for (let j = 0; j < tr!.n; j++) {
            if (tr!.labels[j] === tr!.labels[i]) continue;
            const dd = l2(tr!.pixels, i, tr!.pixels, j);
            if (dd < bd) {
              bd = dd;
              other = j;
            }
          }
        };
        let ds = [0, 0, 0, 0];
        const cv = f.canvas(640, 400, (ctx, w, h) => {
          if (!tr) return;
          const i = picks[pi]!;
          const gap = 8;
          const T = Math.min((w - 4 * gap) / 5, 104);
          const left = (w - (5 * T + 4 * gap)) / 2;
          const imgs = [null, variant('shift'), variant('dark'), variant('box'), null];
          const names = ['original', `shifted ${shift} px`, `${Math.round(dark * 100)}% light`, `${box} px box`, `a ${CIFAR_CLASSES[tr.labels[other]!]}`];
          const fs = T < 70 ? 11 : 12;
          for (let t = 0; t < 5; t++) {
            const x = left + t * (T + gap);
            if (t === 0) drawCifar(ctx, tr, i, x, 0, T);
            else if (t === 4) drawCifar(ctx, tr, other, x, 0, T);
            else drawCHW(ctx, imgs[t]!, 0, x, 0, T);
            txt(ctx, names[t]!, x + T / 2, T + 15, { size: fs, align: 'center', color: t === 4 ? color('red') : color('--ink-2') });
            txt(ctx, t === 0 ? `a ${CIFAR_CLASSES[tr.labels[i]!]}` : `d = ${short(ds[t - 1]!)}`, x + T / 2, T + 30, { size: 11, mono: t > 0, align: 'center', color: color('--ink-3') });
          }
          // bars: distance to the original
          const top = T + 50;
          const labW = Math.min(110, w * 0.3);
          const rowH = Math.min(30, (h - top) / 4);
          const mx = Math.max(...ds);
          const barW = w - labW - 60;
          txt(ctx, 'L2 distance to the original', labW, top - 6, { size: 11, color: color('--ink-3') });
          ds.forEach((v, t) => {
            const y = top + t * rowH;
            txt(ctx, names[t + 1]!, labW - 8, y + rowH / 2, { size: fs, align: 'right', base: 'middle', color: t === 3 ? color('red') : color('--ink-2') });
            const bw = (v / mx) * barW;
            const col = t === 3 ? color('red') : color('blue');
            ctx.fillStyle = withAlpha(col, 0.7);
            ctx.beginPath();
            ctx.roundRect(labW, y + 4, Math.max(2, bw), rowH - 10, [0, 4, 4, 0]);
            ctx.fill();
            txt(ctx, short(v), labW + bw + 6, y + rowH / 2, { size: 11, mono: true, base: 'middle', color: color('--ink-2') });
          });
          ctx.strokeStyle = withAlpha(color('red'), 0.8);
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 1.5;
          const xr = labW + (ds[3]! / mx) * barW;
          ctx.beginPath();
          ctx.moveTo(xr, top);
          ctx.lineTo(xr, top + 4 * rowH);
          ctx.stroke();
          ctx.setLineDash([]);
        });
        cv.canvas.classList.add('scroll-ok');
        const verdict = f.readout('closest to the original');
        const sync = () => {
          if (!tr) return;
          const i = picks[pi]!;
          ds = [distTo(variant('shift')), distTo(variant('dark')), distTo(variant('box')), l2(tr.pixels, i, tr.pixels, other)];
          const names = ['the shifted copy', 'the darker copy', 'the boxed copy', `the ${CIFAR_CLASSES[tr.labels[other]!]}`];
          verdict.set(names[ds.indexOf(Math.min(...ds))]!);
          f.code.setMany({
            i,
            cls: CIFAR_CLASSES[tr.labels[i]!]!,
            ocls: CIFAR_CLASSES[tr.labels[other]!]!,
            b0: 16 - box / 2,
            b1: 16 + box / 2,
            ds: fmt(ds[0]!, 4),
            dd: fmt(ds[1]!, 4),
            db: fmt(ds[2]!, 4),
            dot: fmt(ds[3]!, 4),
          });
          cv.redraw();
        };
        f.slider({ label: 'shift (px)', min: 0, max: 10, step: 1, value: 4, slot: 's', onInput: (v) => { shift = v; f.code.highlight('shift'); sync(); } });
        f.slider({ label: 'brightness', min: 0.2, max: 1, step: 0.05, value: 0.6, slot: 'a', format: (v) => v.toFixed(2), onInput: (v) => { dark = v; f.code.highlight('dark'); sync(); } });
        f.slider({ label: 'box size', min: 0, max: 20, step: 2, value: 12, onInput: (v) => { box = v; f.code.highlight('box'); sync(); } });
        f.button('Next image', () => {
          pi = (pi + 1) % picks.length;
          findOther();
          f.code.highlight('other');
          sync();
        });
        f.status('Loading CIFAR-10 sample…');
        loadCifar()
          .then(({ train }) => {
            tr = train;
            findOther();
            f.status('');
            sync();
          })
          .catch((e) => f.status(`Could not load CIFAR-10: ${(e as Error).message}`));
      },
      caption: `Three edits of one training image, none of which changes what it shows, scored by their L2 distance to the original. On the right, for comparison, the closest training image of a *different* class (the red dashed line marks its distance). Each edit lands about as far from the original as an image of something else entirely, often farther. This is not a cherry-picked fluke: across all 1,000 training images, a 4-pixel shift moves the image farther away than its nearest other-class neighbor 47% of the time, and dimming it to 60% does so 62% of the time. Drag the sliders to see how little it takes.`,
    });

    p.prose(`
For the same reason, nearest neighbors under a pixel distance tend to share overall color and layout rather than content. The course notes show this vividly with a **t-SNE** embedding of CIFAR-10. t-SNE is a technique that lays images out on a 2-D map so that images close in L2 distance end up close on the map. On that map, neighbors tend to share a background and an overall color scheme far more often than a class.

### The curse of dimensionality

There is also a problem of sheer size. Nearest neighbors works when the training examples cover the space densely, so that every new example has a genuinely similar one nearby. But the number of examples needed to cover a space grows exponentially with its number of dimensions.`);
    p.math({
      label: 'Covering a space densely',
      tex: String.raw`\text{examples needed} \;\approx\; m^{D}`,
      codeTitle: 'curse.py',
      code: `
        m = 10                 # samples per axis: one every 0.1
        for D in [1, 2, 3, 3072]:
            n = m ** D
            print(D, n if D < 10 else f'{len(str(n))} digits')
        # 1 10 / 2 100 / 3 1000 / 3072 3073 digits
      `,
      terms: [
        ['m', 'how many samples you want along each axis, say 10 (one every tenth of the range)'],
        ['D', 'the number of dimensions: 2 for points on a page, 3,072 for a CIFAR image'],
        ['m^{D}', '$m$ multiplied by itself $D$ times: a grid with $m$ samples along every axis'],
      ],
      explain: 'A line needs 10 samples to be covered at a spacing of 0.1; a square needs 100; a cube, 1,000. Every extra dimension multiplies the bill by 10. At 3,072 dimensions the number has 3,073 digits, so no dataset that could ever exist comes close to covering pixel space. And as the next figure shows, in high dimensions random points also end up at nearly the *same* distance from one another, which drains the word "nearest" of meaning.',
    });

    p.figure({
      title: 'Distances bunch up in high dimensions',
      codeTitle: 'concentration.py',
      code: `
        D = {{D:2}}                     # dimensions
        X = np.random.rand(500, D)    # 500 points in a cube
        q = np.random.rand(D)         # one query point
        d = np.sqrt(np.sum((X - q) ** 2, axis=1))
        d.min() / d.max()             # {{ratio:…}}   #@ratio
        plt.hist(d / d.max(), bins=30)              #@hist
      `,
      setup(f) {
        let D = 2;
        let hist = new Array<number>(30).fill(0);
        let ratio = 0;
        const compute = () => {
          const rng = new Rng(7);
          const q = new Float64Array(D);
          for (let t = 0; t < D; t++) q[t] = rng.next();
          const ds = new Float64Array(500);
          for (let i = 0; i < 500; i++) {
            let s = 0;
            for (let t = 0; t < D; t++) {
              const v = rng.next() - q[t]!;
              s += v * v;
            }
            ds[i] = Math.sqrt(s);
          }
          let mx = 0;
          let mn = Infinity;
          for (const v of ds) {
            mx = Math.max(mx, v);
            mn = Math.min(mn, v);
          }
          ratio = mn / mx;
          hist = new Array<number>(30).fill(0);
          for (const v of ds) hist[Math.min(29, Math.floor((v / mx) * 30))]!++;
          f.code.setMany({ D, ratio: fmt(ratio, 3) });
          ratioRo.set(fmt(ratio, 3));
          pl.redraw();
        };
        const pl = f.plot({
          aspect: 1.6,
          square: false,
          draw: (pp) => {
            const c = pp.ctx;
            const m = { l: 12, r: 12, t: 34, b: 28 };
            const W = pp.w - m.l - m.r;
            const H = pp.h - m.t - m.b;
            const top = Math.max(...hist, 1);
            const bw = W / 30;
            c.strokeStyle = color('--axis');
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(m.l, m.t + H + 0.5);
            c.lineTo(m.l + W, m.t + H + 0.5);
            c.stroke();
            hist.forEach((v, b) => {
              if (!v) return;
              const hh = (v / top) * H;
              c.fillStyle = withAlpha(color('red'), 0.75);
              c.beginPath();
              c.roundRect(m.l + b * bw + 1, m.t + H - hh, bw - 2, hh, [3, 3, 0, 0]);
              c.fill();
            });
            const xr = m.l + ratio * W;
            c.strokeStyle = color('teal');
            c.lineWidth = 2;
            c.setLineDash([5, 4]);
            c.beginPath();
            c.moveTo(xr, m.t - 4);
            c.lineTo(xr, m.t + H);
            c.stroke();
            c.setLineDash([]);
            txt(c, 'nearest', xr + (ratio > 0.8 ? -5 : 5), m.t + 8, { size: 11, color: color('teal'), align: ratio > 0.8 ? 'right' : 'left' });
            [0, 0.25, 0.5, 0.75, 1].forEach((v) => txt(c, String(v), m.l + v * W, m.t + H + 16, { size: 11, mono: true, align: v === 0 ? 'left' : v === 1 ? 'right' : 'center', color: color('--ink-3') }));
            txt(c, 'count of points at each distance ÷ largest distance', m.l, 14, { size: 11, color: color('--ink-3') });
          },
        });
        const ratioRo = f.readout('nearest ÷ farthest', { sym: 'd' });
        f.slider({
          label: 'dimensions D',
          min: 0,
          max: 3.49,
          step: 0.01,
          value: 0.3,
          map: (r) => Math.min(3072, Math.round(10 ** r)),
          format: (v) => String(v),
          onInput: (v) => {
            if (v === D) return;
            D = v;
            f.code.highlight(['ratio', 'hist']);
            compute();
          },
        });
        compute();
      },
      caption: `500 random points in a $D$-dimensional cube, and a histogram of their distances to one more random point, each divided by the largest. With $D = 2$ the distances spread across the whole range: some points really are near and others really are far. Slide $D$ up toward 3,072 and the histogram collapses into a narrow spike: the nearest point is barely closer than the farthest. Real images are far from uniformly random (which is why kNN beats chance at all), but this pull toward "everything is equally far" is what every method working on raw pixels fights.`,
    });

    // ---------------------------------------------------------------- summary
    p.h2('kNN in practice', 'in-practice');
    p.prose(`
If you do want to use kNN (on good features rather than raw pixels it can make a decent baseline), the recipe is:

1. **Preprocess.** Normalize each feature, for instance to zero mean and unit variance. Raw pixels already share one 0 to 255 scale, so this matters less for images than for mixed data.
2. **Reduce dimensionality** if the data is very high-dimensional, for example with PCA or a random projection.
3. **Split** the training data into training and validation parts (or into folds, if it is small).
4. **Tune** $\\symk$ and the distance (L1, L2, …) on the validation data, trying many values.
5. If prediction is too slow, switch to an **approximate nearest neighbor** library such as FLANN.
6. **Record** the best hyperparameters. It is cleanest to leave the validation data out of the final model (it has been "used up" choosing hyperparameters), then evaluate **once** on the test set and report that number.

### Where this leads

kNN does no real learning: it stores the data and postpones all the work until a question arrives. The next chapter turns that around. A [linear classifier](#/linear-classification) studies the training set once, distills it into a small table of numbers (one template per class), and then throws the training images away. Prediction becomes a single matrix multiply, however large the training set was, and it is the first step on the road to neural networks.`);
    p.callout('idea', `Image classification turns a block of 3,072 numbers into one label, across a wide **semantic gap**. The **data-driven** approach learns from labeled examples instead of hand-written rules. **kNN** labels an image by letting its $\\symk$ most similar training images vote, under a distance such as L1 or L2; it trains instantly but predicts slowly, and pixel distances track color and layout more than content. Hyperparameters like $\\symk$ are chosen on **validation data** (or by cross-validation), never on the test set, which is used exactly once.`, 'Takeaways');
  },
};

export default chapter;
