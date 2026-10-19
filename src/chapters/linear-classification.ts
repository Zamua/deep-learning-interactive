import type { ChapterDef } from './index';
import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { CIFAR_CLASSES, blobs, loadCifar } from '../core/data';
import { MLP, softmax } from '../core/nn';
import { CLASS_COLORS, Plot, color, rgbOf, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { LINEAR_CLASSIFICATION_SYMBOLS } from '../lib/linear-classification-symbols';

const CLASSES3 = ['cat', 'dog', 'ship'];

/** Draggable bar chart of class scores shared by the SVM and Softmax figures. */
function scoreBars(f: Fig, init: number[], onChange: () => void, extra?: (p: Plot, xs: number[], bw: number) => void) {
  const scores = [...init];
  let correct = 0;
  const p = f.plot({
    aspect: 1.25,
    square: false,
    domain: [0, 3, -6, 8],
    draw: (pl) => {
      pl.axes({ grid: 2 });
      for (let v = -4; v <= 6; v += 2) pl.text(String(v), 0.03, v + 0.12, { size: 10, mono: true, color: color('--ink-3') });
      const xs = [0.5, 1.5, 2.5];
      const bw = 0.42;
      extra?.(pl, xs, bw);
      scores.forEach((s, i) => {
        const c = color(CLASS_COLORS[i]!);
        const x0 = pl.sx(xs[i]! - bw / 2);
        const x1 = pl.sx(xs[i]! + bw / 2);
        const y0 = pl.sy(0);
        const y1 = pl.sy(s);
        pl.ctx.fillStyle = withAlpha(c, i === correct ? 0.85 : 0.45);
        pl.ctx.fillRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0));
        pl.ctx.strokeStyle = c;
        pl.ctx.lineWidth = i === correct ? 2.5 : 1;
        pl.ctx.strokeRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0));
        pl.text(fmt(s, 3), xs[i]!, s + (s >= 0 ? 0.35 : -0.75), { align: 'center', mono: true, size: 12, color: color('--ink') });
        pl.text(CLASSES3[i]! + (i === correct ? ' ✓' : ''), xs[i]!, -5.6, { align: 'center', size: 13, bold: i === correct, color: color('--ink-2') });
      });
    },
  });
  let drag = -1;
  const pick = (e: PointerEvent) => {
    const [x] = p.pointer(e);
    return Math.max(0, Math.min(2, Math.floor(x)));
  };
  p.canvas.addEventListener('pointerdown', (e) => {
    drag = pick(e);
    p.canvas.setPointerCapture(e.pointerId);
    move(e);
  });
  const move = (e: PointerEvent) => {
    if (drag < 0) return;
    const [, y] = p.pointer(e);
    if (y < -4.9) return;
    scores[drag] = Math.round(Math.max(-4.5, Math.min(7.5, y)) * 10) / 10;
    onChange();
    p.redraw();
  };
  p.canvas.addEventListener('pointermove', move);
  p.canvas.addEventListener('pointerup', () => (drag = -1));
  const seg = f.segmented({
    label: 'correct class',
    options: CLASSES3.map((c, i) => ({ value: String(i), label: c })),
    value: '0',
    slot: 'y',
    onChange: (v) => {
      correct = Number(v);
      onChange();
      p.redraw();
    },
  });
  return { p, scores, get correct() { return correct; }, seg };
}

const chapter: ChapterDef = {
  symbols: LINEAR_CLASSIFICATION_SYMBOLS,

  render(p) {
    p.prose(`
In the last chapter, the nearest-neighbor classifier kept every training image around and compared each new image against all of them. That works, but it is slow at test time and it never really *learns* anything: it just remembers.

This chapter introduces the idea that the rest of the course is built on. Instead of remembering the training set, we will write down a **score function** with some adjustable numbers in it (the *parameters*), and a **loss function** that measures how bad the scores are. Learning then becomes a search for the parameter values that make the loss small. The simplest score function of all is a single matrix multiply, and that is where we start.`);

    p.h2('The score function', 'score-function');
    p.prose(`
Take a CIFAR-10 image: 32 by 32 pixels, three color values each, so $32 \\times 32 \\times 3 = 3072$ numbers. Stretch those numbers out into one long column and call it $\\symx$. We want ten numbers back, one *score* per class, where a high score means "this image looks like my class."

A linear classifier gets those scores with one multiplication and one addition:`);
    p.math({
      label: 'Linear score function',
      tex: String.raw`f(\symx_i, \symW, \symb) = \symW\,\symx_i + \symb`,
      code: `
        x = image.reshape(3072)   # (3072,)   one image, flattened
        W = 0.001 * np.random.randn(10, 3072)
        b = np.zeros(10)
        scores = W.dot(x) + b     # (10,)     one score per class
      `,
      codeTitle: 'linear_score.py',
      terms: [
        [String.raw`\symx_i`, 'the $i$-th image, as a column of 3072 numbers'],
        [String.raw`\symW`, 'the weights: a 10 by 3072 grid. Row $c$ belongs to class $c$'],
        [String.raw`\symW\,\symx_i`, 'matrix times vector: each row of `W` is multiplied element by element with the image, and the products are added up. Ten rows give ten numbers'],
        [String.raw`\symb`, 'the biases: ten numbers added at the end, one per class'],
        [String.raw`f`, 'the result: a column of ten class scores'],
      ],
      explain: `"Matrix times vector" sounds heavier than it is. For each class, walk along its row of weights and the image at the same time, multiply each pair, and add everything up. A weight that is large and positive says "a bright value here is evidence for my class"; a negative weight says "a bright value here is evidence against me." The figure below does exactly this, one multiplication at a time, on a toy image with only four pixels.`,
    });

    p.figure({
      title: 'A matrix multiply, one multiplication at a time',
      codeTitle: 'scores_by_hand.py',
      code: `
        x = np.array([56, 231, 24, 2])        # a 4-pixel image
        W = np.array([[ 0.2, -0.5,  0.1,  2.0],   # cat
                      [ 1.5,  1.3,  2.1,  0.0],   # dog
                      [ 0.0,  0.25, 0.2, -0.3]])  # ship
        b = np.array([1.1, 3.2, -1.2])

        scores = np.zeros(3)
        for c in range(3):                     #@loop
            total = 0.0
            for i in range(4):
                total += W[c, i] * x[i]        #@mul
            scores[c] = total + b[c]           #@bias
        # c = {{c:0}}   i = {{i:0}}   total = {{total:0}}
      `,
      setup(f) {
        const x = [56, 231, 24, 2];
        const W = [
          [0.2, -0.5, 0.1, 2.0],
          [1.5, 1.3, 2.1, 0.0],
          [0.0, 0.25, 0.2, -0.3],
        ];
        const b = [1.1, 3.2, -1.2];
        const steps: { c: number; i: number }[] = [];
        for (let c = 0; c < 3; c++) {
          for (let i = 0; i < 4; i++) steps.push({ c, i });
          steps.push({ c, i: 4 });
        }
        let cur = 0;
        const sym = (k: string) => color(k === 'W' ? 'blue' : k === 'x' ? 'orange' : k === 'b' ? 'green' : 'purple');
        const cv = f.canvas(640, 300, (ctx, w, h) => {
          const st = steps[cur]!;
          const cell = Math.min(w / 11.2, h / 4.6);
          const top = (h - cell * 3) / 2 + cell * 0.3;
          const mono = (sz: number, wt = 500) => `${wt} ${sz}px 'JetBrains Mono Variable', ui-monospace, monospace`;
          const box = (cx: number, cy: number, cw: number, ch: number, val: string, col: string, on: boolean, dim = false) => {
            ctx.fillStyle = on ? withAlpha(col, 0.28) : withAlpha(col, dim ? 0.04 : 0.1);
            ctx.strokeStyle = on ? col : withAlpha(col, 0.45);
            ctx.lineWidth = on ? 2 : 1;
            ctx.beginPath();
            ctx.roundRect(cx + 2, cy + 2, cw - 4, ch - 4, 6);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = color('--ink');
            ctx.font = mono(Math.max(10, cell * 0.27));
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(val, cx + cw / 2, cy + ch / 2);
          };
          const label = (s: string, cx: number, cy: number, col: string) => {
            ctx.fillStyle = col;
            ctx.font = `italic 600 ${Math.max(13, cell * 0.38)}px 'Source Serif 4 Variable', Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s, cx, cy);
          };
          // W: 3 x 4 grid
          const wx = cell * 0.2;
          label('W', wx + cell * 2, top - cell * 0.45, sym('W'));
          for (let c = 0; c < 3; c++)
            for (let i = 0; i < 4; i++) {
              const on = st.c === c && st.i === i;
              box(wx + i * cell, top + c * cell, cell, cell, String(W[c]![i]), sym('W'), on, st.c !== c);
            }
          // x: column, drawn as a 4-tall vertical strip scaled to the W height
          const xx = wx + 4.5 * cell;
          const xh = (cell * 3) / 4;
          label('x', xx + cell * 0.45, top - cell * 0.45, sym('x'));
          for (let i = 0; i < 4; i++) box(xx, top + i * xh, cell * 0.9, xh, String(x[i]), sym('x'), st.i === i && st.i < 4);
          // + b
          const bx = xx + cell * 1.45;
          ctx.fillStyle = color('--ink-2');
          ctx.font = mono(cell * 0.45, 400);
          ctx.fillText('+', bx - cell * 0.18, top + cell * 1.5);
          label('b', bx + cell * 0.55, top - cell * 0.45, sym('b'));
          for (let c = 0; c < 3; c++) box(bx + cell * 0.1, top + c * cell, cell * 0.9, cell, String(b[c]), sym('b'), st.c === c && st.i === 4, st.c !== c);
          // = scores
          const sx = bx + cell * 1.55;
          ctx.fillStyle = color('--ink-2');
          ctx.font = mono(cell * 0.45, 400);
          ctx.fillText('=', sx - cell * 0.15, top + cell * 1.5);
          label('s', sx + cell * 0.85, top - cell * 0.45, sym('s'));
          for (let c = 0; c < 3; c++) {
            const done = c < st.c || (c === st.c && st.i === 4);
            let val = '';
            if (done) val = fmt(W[c]!.reduce((a, w, i) => a + w * x[i]!, 0) + b[c]!, 4);
            else if (c === st.c) val = `${fmt(W[c]!.slice(0, st.i + 1).reduce((a, w, i) => a + w * x[i]!, 0), 4)}…`;
            box(sx + cell * 0.15, top + c * cell, cell * 1.45, cell, val, sym('s'), c === st.c);
            ctx.fillStyle = color('--ink-3');
            ctx.font = `${Math.max(11, cell * 0.26)}px system-ui, sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(CLASSES3[c]!, sx + cell * 1.7, top + c * cell + cell / 2);
          }
          // the product being added
          ctx.textAlign = 'left';
          ctx.fillStyle = color('--ink-2');
          ctx.font = mono(Math.max(11, cell * 0.28), 500);
          const msg =
            st.i < 4
              ? `W[${st.c},${st.i}] × x[${st.i}] = ${W[st.c]![st.i]} × ${x[st.i]} = ${fmt(W[st.c]![st.i]! * x[st.i]!, 4)}`
              : `scores[${st.c}] = ${fmt(W[st.c]!.reduce((a, w, i) => a + w * x[i]!, 0), 4)} + ${b[st.c]} = ${fmt(W[st.c]!.reduce((a, w, i) => a + w * x[i]!, 0) + b[st.c]!, 4)}`;
          ctx.fillText(msg, wx, top + cell * 3.55);
        });
        f.stepper({
          steps: steps.length,
          interval: 800,
          label: (k) => `step ${k + 1} / ${steps.length}`,
          onStep: (k) => {
            cur = k;
            const st = steps[k]!;
            const partial = W[st.c]!.slice(0, Math.min(st.i + 1, 4)).reduce((a, w, i) => a + w * x[i]!, 0);
            f.code.highlight(st.i < 4 ? 'mul' : 'bias');
            f.code.setMany({ c: st.c, i: st.i < 4 ? st.i : 3, total: fmt(partial, 4) });
            cv.redraw();
          },
        });
      },
      caption: `Press play or step through. Each step is one line of the inner loop: one weight times one pixel, added to a running total. After four of those, the bias is added and the class has its score. A real CIFAR-10 classifier does exactly this with 3072 pixels and 10 rows; \`W.dot(x)\` just does all of it at once, very fast.`,
    });

    p.callout('math', `A **vector** is just a list of numbers, like \`x\` here. A **matrix** is a grid of numbers, like \`W\`. "Matrix times vector" means: for each row of the matrix, multiply it element-by-element with the vector and add up the products. The result is a new vector with one number per row. The "piece by piece" readings in this course always say this in words, so you never have to decode the notation alone. The [math survival kit](#/math-kit) covers it from scratch.`, 'Math help: vectors and matrices');

    p.h2('Reading the weights: lines in space', 'geometry');
    p.prose(`
Here is a useful way to picture what $\\symW$ does. Imagine every image as a single point in a space with 3072 directions, one per pixel value. We cannot draw 3072 directions, but the idea survives perfectly in two, so let's use points with two numbers each.

Each class's score $\\syms_c = \\symW_c \\cdot \\symx + \\symb_c$ is zero along a straight line, positive on one side and negative on the other. The row $\\symW_c$ is an arrow pointing toward the side where the score grows. Its bias $\\symb_c$ slides the line back and forth without turning it. Every point gets the class whose score is highest there, which carves the plane into regions with straight borders. That is all a linear classifier can ever do: cut space with flat walls.`);

    p.figure({
      title: 'A linear classifier in two dimensions',
      codeTitle: 'linear_2d.py',
      code: `
        W = np.array([[{{w00}}, {{w01}}],    # class 0 (blue)
                      [{{w10}}, {{w11}}],    # class 1 (orange)
                      [{{w20}}, {{w21}}]])   # class 2 (green)
        b = np.array([{{b0}}, {{b1}}, {{b2}}])

        for step in range(1000):                 #@loop
            scores = X.dot(W.T) + b              #@scores
            loss, dW, db = {{loss_fn:svm}}_loss(scores, y, W, reg)   #@loss
            W -= {{lr:0.1}} * dW                 #@update
            b -= {{lr:0.1}} * db                 #@update
        # loss = {{loss:…}}, reg = {{reg:0.01}}
      `,
      setup(f) {
        const data = blobs(26, 3, 0.2, 11);
        const net = new MLP({ sizes: [2, 3], init: 1.2, seed: 4 });
        let lossKind: 'svm' | 'softmax' = 'svm';
        let reg = 0.01;
        let sel = 0;
        const L = net.layers[0]!;
        const all = Int32Array.from({ length: data.n }, (_, i) => i);
        const syncCode = () => {
          const v: Record<string, string> = {};
          for (let c = 0; c < 3; c++) {
            v[`w${c}0`] = fmt(L.W[c * 2]!, 2);
            v[`w${c}1`] = fmt(L.W[c * 2 + 1]!, 2);
            v[`b${c}`] = fmt(L.b[c]!, 2);
          }
          f.code.setMany(v);
          const loss = net.lossAndGrad(data.X, data.y, all, { loss: lossKind, reg });
          lossRo.set(loss);
          f.code.set('loss', fmt(loss, 3));
          accRo.set(`${Math.round(net.accuracy(data.X, data.y, data.n) * 100)}%`);
        };
        const pl = f.plot({
          aspect: 1.15,
          domain: [-1.3, 1.3, -1.3, 1.3],
          draw: (pp) => {
            const cols = CLASS_COLORS.slice(0, 3).map((c) => rgbOf(color(c)));
            pp.field((a, bb) => {
              const k = net.predict([a, bb]);
              const [r, g, b2] = cols[k]!;
              return [r, g, b2, 40];
            }, 5);
            pp.axes({ grid: 0.5 });
            for (let c = 0; c < 3; c++) {
              const w0 = L.W[c * 2]!, w1 = L.W[c * 2 + 1]!, bc = L.b[c]!;
              const n2 = w0 * w0 + w1 * w1;
              if (n2 < 1e-9) continue;
              const col = color(CLASS_COLORS[c]!);
              // the score-zero line: points t*(-w1, w0) + foot, foot = -b w / |w|^2
              const fx = (-bc * w0) / n2, fy = (-bc * w1) / n2;
              const nrm = Math.sqrt(n2);
              pp.path([fx - (w1 / nrm) * 4, fx + (w1 / nrm) * 4], [fy + (w0 / nrm) * 4, fy - (w0 / nrm) * 4], withAlpha(col, c === sel ? 0.95 : 0.55), c === sel ? 2.5 : 1.5, [6, 5]);
              const sc = 0.35;
              pp.arrow(fx, fy, fx + w0 * sc, fy + w1 * sc, col, c === sel ? 3 : 2);
            }
            for (let i = 0; i < data.n; i++) {
              const xi = data.X[2 * i]!, yi = data.X[2 * i + 1]!;
              const k = data.y[i]!;
              const wrong = net.predict([xi, yi]) !== k;
              pp.dot(xi, yi, wrong ? 5.5 : 4.5, color(CLASS_COLORS[k]!), wrong ? color('--ink') : withAlpha(color('--paper'), 0.9));
            }
          },
        });
        const lossRo = f.readout('loss', { sym: 'L' });
        const accRo = f.readout('accuracy');
        let dragging = false;
        const setRow = (e: PointerEvent) => {
          const [a, bb] = pl.pointer(e);
          const fx = (-L.b[sel]! * L.W[sel * 2]!) / Math.max(1e-6, L.W[sel * 2]! ** 2 + L.W[sel * 2 + 1]! ** 2);
          const fy = (-L.b[sel]! * L.W[sel * 2 + 1]!) / Math.max(1e-6, L.W[sel * 2]! ** 2 + L.W[sel * 2 + 1]! ** 2);
          L.W[sel * 2] = (a - fx) / 0.35;
          L.W[sel * 2 + 1] = (bb - fy) / 0.35;
          syncCode();
          pl.redraw();
        };
        pl.canvas.addEventListener('pointerdown', (e) => {
          dragging = true;
          train.stop();
          playBtn.textContent = 'Train';
          pl.canvas.setPointerCapture(e.pointerId);
          setRow(e);
        });
        pl.canvas.addEventListener('pointermove', (e) => dragging && setRow(e));
        pl.canvas.addEventListener('pointerup', () => (dragging = false));
        f.segmented({
          label: 'drag the arrow of',
          options: [
            { value: '0', label: 'class 0' },
            { value: '1', label: 'class 1' },
            { value: '2', label: 'class 2' },
          ],
          value: '0',
          onChange: (v) => {
            sel = Number(v);
            biasSlider.set(L.b[sel]!, false);
            pl.redraw();
          },
        });
        const biasSlider = f.slider({
          label: 'its bias b',
          sym: 'b',
          min: -1.5,
          max: 1.5,
          step: 0.01,
          value: L.b[0]!,
          onInput: (v) => {
            L.b[sel] = v;
            syncCode();
            pl.redraw();
          },
        });
        f.segmented({
          label: 'loss',
          options: [
            { value: 'svm', label: 'SVM' },
            { value: 'softmax', label: 'Softmax' },
          ],
          value: 'svm',
          slot: 'loss_fn',
          onChange: (v) => {
            lossKind = v;
            syncCode();
          },
        });
        f.slider({
          label: 'λ',
          sym: 'lam',
          min: -4,
          max: 0,
          step: 0.1,
          value: -2,
          map: (r) => Math.pow(10, r),
          format: (v) => fmt(v, 2),
          slot: 'reg',
          onInput: (v) => {
            reg = v;
            syncCode();
          },
        });
        let iter = 0;
        const train = f.loop(() => {
          for (let k = 0; k < 4; k++) {
            net.lossAndGrad(data.X, data.y, all, { loss: lossKind, reg });
            net.step(0.1);
          }
          f.code.highlight(['scores', 'loss', 'update'][iter++ % 3]!);
          biasSlider.set(L.b[sel]!, false);
          syncCode();
          pl.redraw();
        });
        const playBtn = f.button('Train', () => {
          if (train.running()) {
            train.stop();
            playBtn.textContent = 'Train';
            f.code.highlight(null);
          } else {
            train.start();
            playBtn.textContent = 'Pause';
          }
        }, { primary: true });
        f.button('Scramble', () => {
          const r = new Rng(Math.floor(Math.random() * 1e6));
          for (let i = 0; i < 6; i++) L.W[i] = r.randn() * 1.5;
          for (let i = 0; i < 3; i++) L.b[i] = r.randn() * 0.4;
          biasSlider.set(L.b[sel]!, false);
          syncCode();
          pl.redraw();
        });
        syncCode();
      },
      caption: `Each dashed line is where one class's score is exactly zero; the arrow is that class's row of $\\symW$, pointing toward higher scores. Background color shows which class wins where. **Drag** on the plot to aim the selected class's arrow, slide its bias to shift its line, or press **Train** and let gradient descent (Chapter 5) do it. Ringed points are currently misclassified. Raise $\\symlam$ and watch the arrows shrink: that is regularization, explained below.`,
    });

    p.h2('Reading the weights: templates', 'templates');
    p.prose(`
There is a second, more visual way to read $\\symW$. Each row has exactly one weight per pixel value, so it can be reshaped back into a 32 × 32 × 3 picture. The score for a class is then a measure of how well the image *lines up* with that picture: big where both are bright together. In other words, each row is a **template** for its class, and classifying an image means checking it against ten templates and picking the best match.

Below, a linear classifier trains on 1,000 real CIFAR-10 images, right here in your browser. Watch the templates form out of noise.`);

    p.figure({
      title: 'Learning ten templates from CIFAR-10',
      layout: 'side',
      codeTitle: 'train_templates.py',
      code: `
        X = X_train.reshape(1000, 3072) / 255.0
        X -= X.mean(axis=0)                       # center each pixel
        W = 0.001 * np.random.randn(10, 3072)
        b = np.zeros(10)

        for step in range(2000):
            idx = np.random.choice(1000, 100)     # a mini-batch of 100
            scores = X[idx].dot(W.T) + b          #@fwd
            loss, dW, db = softmax_loss(scores, y[idx], W, reg=0.05)   #@loss
            W -= 0.003 * dW                       #@upd
            b -= 0.003 * db                       #@upd
        # step {{step:0}}   loss {{loss:…}}

        templates = W.reshape(10, 3, 32, 32)      # one picture per class
      `,
      setup(f) {
        const tiles = f.canvas(640, 300, (ctx, w, h) => drawTiles(ctx, w, h));
        const curve = f.plot({ height: 110, square: false, domain: [0, 600, 1.4, 2.4], draw: (pl) => drawCurve(pl) });
        const stepRo = f.readout('step');
        const lossRo = f.readout('loss', { sym: 'L' });
        const trainRo = f.readout('train acc');
        const testRo = f.readout('test acc');
        f.status('Loading 1,200 CIFAR-10 images (3.7 MB)…');
        let X: Float64Array | null = null;
        let Xt: Float64Array | null = null;
        let y: Uint8Array | null = null;
        let yt: Uint8Array | null = null;
        const net = new MLP({ sizes: [3072, 10], init: 0.001, seed: 2 });
        const losses: number[] = [];
        let step = 0;
        const rng = new Rng(5);
        const toRows = (px: Uint8Array, n: number, mean?: Float64Array) => {
          const out = new Float64Array(n * 3072);
          for (let i = 0; i < n * 3072; i++) out[i] = px[i]! / 255;
          const mu = mean ?? new Float64Array(3072);
          if (!mean) {
            for (let i = 0; i < n; i++) for (let d = 0; d < 3072; d++) mu[d]! += out[i * 3072 + d]! / n;
          }
          for (let i = 0; i < n; i++) for (let d = 0; d < 3072; d++) out[i * 3072 + d]! -= mu[d]!;
          return { out, mu };
        };
        function drawTiles(ctx: CanvasRenderingContext2D, w: number, h: number) {
          const cols = 5;
          const gap = 10;
          const size = Math.min((w - gap * (cols - 1)) / cols, (h - 2 * 24) / 2);
          const left = (w - (size * cols + gap * (cols - 1))) / 2;
          const Wt = net.layers[0]!.W;
          for (let c = 0; c < 10; c++) {
            const gx = left + (c % cols) * (size + gap);
            const gy = Math.floor(c / cols) * (size + 24);
            let mn = Infinity, mx = -Infinity;
            for (let d = 0; d < 3072; d++) {
              mn = Math.min(mn, Wt[c * 3072 + d]!);
              mx = Math.max(mx, Wt[c * 3072 + d]!);
            }
            const img = new ImageData(32, 32);
            for (let q = 0; q < 1024; q++) {
              for (let ch = 0; ch < 3; ch++) img.data[q * 4 + ch] = (255 * (Wt[c * 3072 + ch * 1024 + q]! - mn)) / (mx - mn + 1e-12);
              img.data[q * 4 + 3] = 255;
            }
            const tmp = document.createElement('canvas');
            tmp.width = tmp.height = 32;
            tmp.getContext('2d')!.putImageData(img, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(tmp, gx, gy, size, size);
            ctx.fillStyle = color('--ink-2');
            ctx.font = '12px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(CIFAR_CLASSES[c]!, gx + size / 2, gy + size + 16);
          }
        }
        function drawCurve(pl: Plot) {
          pl.setDomain(0, Math.max(600, losses.length), 1.2, Math.max(2.4, ...losses.slice(0, 5)));
          pl.axes({ grid: 100 });
          if (losses.length > 1) pl.path(losses.map((_, i) => i), losses, color('red'), 2);
          pl.ctx.fillStyle = color('red');
          pl.ctx.font = '11px system-ui, sans-serif';
          pl.ctx.textAlign = 'left';
          pl.ctx.fillText('training loss', 8, 16);
        }
        const evalAcc = () => {
          if (!X || !Xt || !y || !yt) return;
          trainRo.set(`${Math.round(net.accuracy(X, y, 1000) * 100)}%`);
          testRo.set(`${Math.round(net.accuracy(Xt, yt, 200) * 100)}%`);
        };
        let phase = 0;
        const loop = f.loop(() => {
          if (!X || !y) return;
          for (let k = 0; k < 3; k++) {
            const idx = Int32Array.from({ length: 100 }, () => rng.int(1000));
            const loss = net.lossAndGrad(X, y, idx, { loss: 'softmax', reg: 0.05 });
            net.step(0.003);
            losses.push(loss);
            step++;
          }
          f.code.highlight(['fwd', 'loss', 'upd'][phase++ % 3]!);
          f.code.setMany({ step, loss: fmt(losses[losses.length - 1]!, 3) });
          stepRo.set(step);
          lossRo.set(losses[losses.length - 1]!);
          if (step % 30 === 0) evalAcc();
          tiles.redraw();
          curve.redraw();
          if (step >= 1500) {
            stop();
            f.status('Done: 1,500 steps. The templates have settled. Hit **Reset** to watch it again.');
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          btn.textContent = 'Train';
          f.code.highlight(null);
          evalAcc();
        };
        const btn = f.button('Train', () => {
          if (!X) return;
          if (loop.running()) stop();
          else {
            loop.start();
            btn.textContent = 'Pause';
            f.status('');
          }
        }, { primary: true });
        f.button('Reset', () => {
          stop();
          net.reset(0.001, Math.floor(Math.random() * 1000));
          losses.length = 0;
          step = 0;
          f.code.setMany({ step: 0, loss: '…' });
          stepRo.set(0);
          lossRo.set('–');
          evalAcc();
          tiles.redraw();
          curve.redraw();
        });
        loadCifar()
          .then(({ train, test }) => {
            const tr = toRows(train.pixels, 1000);
            X = tr.out;
            Xt = toRows(test.pixels, 200, tr.mu).out;
            y = train.labels;
            yt = test.labels;
            f.status('Ready. Press **Train**. (At the start the templates are random noise, and accuracy is about 10%: a coin with ten sides.)');
            evalAcc();
            tiles.redraw();
          })
          .catch((e) => f.status(`Could not load CIFAR-10: ${(e as Error).message}`));
      },
      caption: `Each tile is one row of $\\symW$ reshaped into an image, with its values stretched to the full brightness range. With only 1,000 images the templates stay blurry, but the gist appears within a few hundred steps: the *car* template goes red, *ship* and *plane* pick up blue water and sky, *frog* and *deer* turn green-brown. Expect test accuracy around 30 percent: far better than guessing, and a good illustration of the limits of one template per class (a horse facing left and a horse facing right have to share a single picture, so the horse template often grows two heads).`,
    });

    p.h2('The bias trick', 'bias-trick');
    p.prose(`Keeping track of $\\symW$ and $\\symb$ separately is a little clumsy. A common trick folds the bias into the weights: add one extra number, always 1, to the end of every image, and add $\\symb$ as one extra column of $\\symW$. The multiply then adds the bias by itself.`);
    p.math({
      label: 'Folding b into W',
      tex: String.raw`\symW\,\symx + \symb \;=\; \begin{bmatrix}\symW & \symb\end{bmatrix}\begin{bmatrix}\symx \\ 1\end{bmatrix}`,
      code: `
        x1 = np.append(x, 1.0)           # (3073,) image with a trailing 1
        W1 = np.hstack([W, b[:, None]])  # (10, 3073) bias as the last column
        np.allclose(W1.dot(x1), W.dot(x) + b)   # True
      `,
      terms: [
        [String.raw`\begin{bmatrix}\symW & \symb\end{bmatrix}`, 'the weight grid with `b` glued on as one more column'],
        [String.raw`\begin{bmatrix}\symx \\ 1\end{bmatrix}`, 'the image with a 1 appended at the bottom'],
      ],
      explain: 'The last column of the new weight grid gets multiplied by that constant 1, which is the same as adding it. One parameter array instead of two, and every formula after this gets shorter.',
    });

    p.prose(`
### A note on preprocessing

Raw pixels run from 0 to 255. In practice we first **center** the data: compute the average image over the training set and subtract it from every image, so each pixel value is spread around zero (the template figure above does exactly this). Often each value is also scaled into a range like $[-1, 1]$. Chapter 8 explains why this matters so much for training; for now it is just a habit worth forming.`);

    p.h2('Loss functions: grading the scores', 'loss');
    p.prose(`
We have a way to produce scores. Now we need a way to say how *good* they are. A **loss function** takes the scores and the correct answer and returns a single number: high when the scores are bad, low when they are good. "Training" will mean nudging $\\symW$ and $\\symb$ to make this number smaller.

The course introduces two classic choices. They agree on what a perfect answer looks like but disagree, interestingly, about everything else.`);

    p.h2('The multiclass SVM loss', 'svm');
    p.prose(`
The Support Vector Machine loss wants the correct class's score to beat every other score by at least a safety **margin** $\\Delta$ (usually 1). If a wrong class gets within $\\Delta$ of the correct one, or passes it, the loss grows by how far it intruded. Wrong classes that stay comfortably below cost nothing at all.`);
    p.math({
      label: 'Multiclass SVM (hinge) loss for one image',
      tex: String.raw`\symL_i = \sum_{j \ne \symy_i} \max\!\big(0,\; \syms_j - \syms_{\symy_i} + \Delta\big)`,
      code: `
        def svm_loss_one(scores, y, delta=1.0):
            margins = np.maximum(0, scores - scores[y] + delta)
            margins[y] = 0            # the correct class does not compete with itself
            return margins.sum()
      `,
      codeTitle: 'svm_loss.py',
      terms: [
        [String.raw`\symy_i`, 'the index of the correct class for image $i$'],
        [String.raw`\syms_{\symy_i}`, "the correct class's score"],
        [String.raw`\syms_j`, 'the score of some other class $j$'],
        [String.raw`\syms_j - \syms_{\symy_i} + \Delta`, 'how far class $j$ intrudes into the safety zone. Negative means it is safely below'],
        [String.raw`\max(0,\,\cdot)`, 'keep the intrusion if positive, otherwise 0. This shape, flat then rising, is called a *hinge*'],
        [String.raw`\sum_{j \ne \symy_i}`, 'add this up over every class $j$ except the correct one'],
      ],
      explain: 'The Greek letter Σ ("sigma") just means *add up*. Below it is what to loop over; here, every class except the right one. So: for each wrong class, measure how much it encroaches on the correct class plus a margin, ignore it if it does not, and total the rest.',
    });

    p.figure({
      title: 'The hinge loss, one class at a time',
      codeTitle: 'svm_loss.py',
      code: `
        scores = np.array([{{s0:3.2}}, {{s1:5.1}}, {{s2:-1.7}}])   # cat, dog, ship
        y = {{y:0}}                     # index of the correct class
        delta = {{delta:1.0}}

        margins = np.maximum(0, scores - scores[y] + delta)   #@m
        margins[y] = 0                                        #@zero
        # margins = [{{m0}}, {{m1}}, {{m2}}]
        loss = margins.sum()            # {{loss}}            #@sum
      `,
      setup(f) {
        let delta = 1;
        const bars: ReturnType<typeof scoreBars> = scoreBars(f, [3.2, 5.1, -1.7], () => update(), (pl, xs, bw) => {
          const sy = bars.scores[bars.correct]!;
          const line = sy - delta;
          pl.path([0, 3], [sy, sy], withAlpha(color('gold'), 0.9), 1.5, [3, 4]);
          pl.path([0, 3], [line, line], color('red'), 1.5, [7, 5]);
          pl.text(`correct − Δ`, 2.97, line + 0.25, { align: 'right', size: 11, color: color('red') });
          bars.scores.forEach((s, i) => {
            if (i === bars.correct || s <= line) return;
            const x0 = pl.sx(xs[i]! - bw / 2 - 0.05), x1 = pl.sx(xs[i]! + bw / 2 + 0.05);
            pl.ctx.fillStyle = withAlpha(color('red'), 0.35);
            pl.ctx.fillRect(x0, pl.sy(s), x1 - x0, pl.sy(line) - pl.sy(s));
            pl.ctx.strokeStyle = color('red');
            pl.ctx.lineWidth = 2;
            pl.ctx.strokeRect(x0, pl.sy(s), x1 - x0, pl.sy(line) - pl.sy(s));
          });
        });
        const lossRo = f.readout('loss', { sym: 'L' });
        f.slider({ label: 'margin Δ', min: 0, max: 3, step: 0.1, value: 1, slot: 'delta', onInput: (v) => { delta = v; update(); bars.p.redraw(); } });
        function update() {
          const s = bars.scores;
          const y = bars.correct;
          const m = s.map((v, j) => (j === y ? 0 : Math.max(0, v - s[y]! + delta)));
          const loss = m.reduce((a, b) => a + b, 0);
          f.code.setMany({ s0: fmt(s[0]!, 2), s1: fmt(s[1]!, 2), s2: fmt(s[2]!, 2), m0: fmt(m[0]!, 3), m1: fmt(m[1]!, 3), m2: fmt(m[2]!, 3), loss: fmt(loss, 3) });
          lossRo.set(loss);
          f.code.highlight(loss > 0 ? ['m', 'sum'] : 'zero');
        }
        update();
      },
      caption: `**Drag the bars** to change the scores and tap a class name to mark it correct. The red dashed line sits $\\Delta$ below the correct score. Any wrong class whose bar pokes above that line contributes the red overflow to the loss. Once every wrong class is below the line, the loss is exactly zero and the SVM is completely satisfied, however close the race actually is.`,
    });

    p.h2('Regularization', 'regularization');
    p.prose(`
There is a subtle problem with the SVM loss. Suppose some $\\symW$ classifies every training image with all margins satisfied, so the loss is zero. Then $2\\symW$ does too: every score doubles, so every gap doubles. So does $10\\symW$. The loss alone cannot tell these apart.

We break the tie by adding a preference for *small, spread-out* weights. The most common choice, **L2 regularization**, adds the sum of every squared weight to the loss:`);
    p.math({
      label: 'Full loss: data loss plus regularization',
      tex: String.raw`\symL = \underbrace{\frac{1}{N}\sum_{i=1}^{N} \symL_i}_{\text{data loss}} \;+\; \underbrace{\symlam \sum_{k}\sum_{l} \symW_{k,l}^{\,2}}_{\text{regularization loss}}`,
      code: `
        data_loss = np.mean([svm_loss_one(W.dot(x) + b, y) for x, y in zip(X, Y)])
        reg_loss = reg * np.sum(W * W)
        loss = data_loss + reg_loss
      `,
      terms: [
        [String.raw`\frac{1}{N}\sum_{i=1}^{N}\symL_i`, 'the average loss over all $N$ training images'],
        [String.raw`\symW_{k,l}^{\,2}`, 'one weight, squared (so negative weights count as much as positive ones)'],
        [String.raw`\sum_k\sum_l`, 'add up over every row $k$ and every column $l$: all the weights'],
        [String.raw`\symlam`, 'a knob (a *hyperparameter*) for how much we care about small weights versus fitting the data'],
      ],
      explain: 'Squaring punishes big weights much more than small ones, so the cheapest way to produce a given score is to spread the effort over many small weights instead of leaning hard on a few. For an input of four 1s, weights $[1, 0, 0, 0]$ and $[0.25, 0.25, 0.25, 0.25]$ give the same score of 1, but the squared sums are 1 and 0.25: regularization prefers the second, which uses all of the evidence. In practice this also generalizes better to new images. Notice it is only ever applied to $W$, not to $b$.',
    });

    p.h2('The Softmax classifier', 'softmax');
    p.prose(`
The second classic loss reads scores as **probabilities**. Scores can be any number, positive or negative; probabilities have to be positive and add up to 1. The **softmax** function makes that conversion in two moves: exponentiate every score (which makes it positive, and makes big scores much bigger), then divide by the total (which makes them add up to 1).`);
    p.math({
      label: 'Softmax: scores to probabilities',
      tex: String.raw`\symp_k = \frac{e^{\syms_k}}{\sum_j e^{\syms_j}}`,
      code: `
        def softmax(scores):
            shifted = scores - np.max(scores)   # see "numerical stability" below
            exps = np.exp(shifted)
            return exps / exps.sum()
      `,
      terms: [
        [String.raw`e^{\syms_k}`, '*e* (about 2.718) raised to the power of the score. Always positive; grows very fast'],
        [String.raw`\sum_j e^{\syms_j}`, 'the same thing for every class, added up'],
        [String.raw`\symp_k`, "class $k$'s share of the total: a probability between 0 and 1"],
      ],
      explain: '$e^s$ is the *exponential* function: it turns adding into multiplying, so a score that is 1 higher becomes about 2.7 times bigger, and one that is 3 higher becomes 20 times bigger. After dividing by the total, every class gets a slice of a pie, and the slices of higher scores are disproportionately larger.',
    });
    p.math({
      label: 'Cross-entropy loss',
      tex: String.raw`\symL_i = -\log \symp_{\symy_i} = -\log\!\left(\frac{e^{\syms_{\symy_i}}}{\sum_j e^{\syms_j}}\right)`,
      code: `
        probs = softmax(scores)
        loss = -np.log(probs[y])
      `,
      terms: [
        [String.raw`\symp_{\symy_i}`, 'the probability the classifier gives to the *correct* class'],
        [String.raw`\log`, 'the natural logarithm, the inverse of $e^x$. $\\log 1 = 0$ and $\\log$ of a small number is very negative'],
        [String.raw`-\log \symp`, 'flip the sign: 0 when the correct class gets probability 1, and growing without limit as that probability heads to 0'],
      ],
      explain: 'All the softmax loss looks at is how much probability landed on the right answer. Certain and right: loss 0. A 50/50 hedge: loss 0.69. Only 1% on the right class: loss 4.6. Unlike the SVM, it is never fully satisfied: there is always a little more probability to squeeze onto the correct class.',
    });

    p.figure({
      title: 'From scores to probabilities to loss',
      codeTitle: 'softmax_loss.py',
      code: `
        scores = np.array([{{s0:3.2}}, {{s1:5.1}}, {{s2:-1.7}}])   # cat, dog, ship
        y = {{y:0}}

        shifted = scores - scores.max()   # [{{z0}}, {{z1}}, {{z2}}]
        exps = np.exp(shifted)            # [{{e0}}, {{e1}}, {{e2}}]
        probs = exps / exps.sum()         # [{{p0}}, {{p1}}, {{p2}}]
        loss = -np.log(probs[y])          # {{loss}}

        # for comparison, the SVM loss on the same scores: {{svm}}
      `,
      setup(f) {
        const bars = scoreBars(f, [3.2, 5.1, -1.7], () => update());
        const pie = f.canvas(640, 60, (ctx, w, h) => {
          const pr = softmax(bars.scores);
          let x0 = 0;
          pr.forEach((q, i) => {
            const ww = q * w;
            ctx.fillStyle = withAlpha(color(CLASS_COLORS[i]!), i === bars.correct ? 0.9 : 0.5);
            ctx.fillRect(x0, 8, ww, h - 26);
            if (ww > 44) {
              ctx.fillStyle = color('--paper');
              ctx.font = "600 12px 'JetBrains Mono Variable', monospace";
              ctx.textAlign = 'center';
              ctx.fillText(`${(q * 100).toFixed(1)}%`, x0 + ww / 2, 8 + (h - 26) / 2 + 4);
            }
            x0 += ww;
          });
          ctx.fillStyle = color('--ink-3');
          ctx.font = '11px system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('probabilities (width = share of the total)', 0, h - 3);
        });
        const lossRo = f.readout('softmax loss', { sym: 'L' });
        const svmRo = f.readout('SVM loss');
        function update() {
          const s = bars.scores;
          const y = bars.correct;
          const mx = Math.max(...s);
          const z = s.map((v) => v - mx);
          const e = z.map(Math.exp);
          const tot = e.reduce((a, b) => a + b, 0);
          const pr = e.map((v) => v / tot);
          const loss = -Math.log(pr[y]!);
          const svm = s.reduce((a, v, j) => a + (j === y ? 0 : Math.max(0, v - s[y]! + 1)), 0);
          f.code.setMany({
            s0: fmt(s[0]!, 2), s1: fmt(s[1]!, 2), s2: fmt(s[2]!, 2),
            z0: fmt(z[0]!, 2), z1: fmt(z[1]!, 2), z2: fmt(z[2]!, 2),
            e0: fmt(e[0]!, 3), e1: fmt(e[1]!, 3), e2: fmt(e[2]!, 3),
            p0: fmt(pr[0]!, 3), p1: fmt(pr[1]!, 3), p2: fmt(pr[2]!, 3),
            loss: fmt(loss, 3), svm: fmt(svm, 3),
          });
          lossRo.set(loss);
          svmRo.set(svm);
          pie.redraw();
        }
        update();
      },
      caption: `Drag the bars and watch the three stages in the code update together. Try making the correct class win by a lot: the SVM loss hits 0 as soon as the margin is met, while the softmax loss keeps shrinking but never quite reaches 0. Now push the correct class far below the others: the softmax loss climbs steadily, because it always cares how much probability was lost.`,
    });

    p.callout('warning', `Exponentials explode. $e^{1000}$ is too large for a computer to store, so \`np.exp(scores)\` can overflow to infinity and the division turns into nonsense. The fix is free: subtract the largest score from all of them first. Every $e^{s}$ gets multiplied by the same constant $e^{-\\max s}$, which cancels in the division, so the probabilities are unchanged, but now the largest exponent is $e^0 = 1$. That is why the code has a \`shifted\` line.`, 'Numerical stability');

    p.h2('SVM versus Softmax', 'svm-vs-softmax');
    p.table(
      ['', 'Multiclass SVM', 'Softmax (cross-entropy)'],
      [
        ['Reads scores as', 'raw, uncalibrated numbers', 'unnormalized log-probabilities'],
        ['Is happy when', 'the correct class wins by a margin $\\Delta$', 'the correct class gets probability near 1'],
        ['Loss once correct by a lot', 'exactly 0: it stops caring', 'tiny but never 0: it always wants more'],
        ['Output you can use', 'just the ranking of classes', 'probabilities (with a grain of salt: their sharpness depends on $\\symlam$)'],
        ['In practice', 'performance is usually very similar', 'more common today, because probabilities are handy'],
      ],
    );
    p.prose(`
The deeper point of this chapter is the *shape* of the recipe, which every remaining chapter reuses:

1. a **score function** with parameters (here, $\\symW\\symx + \\symb$; later, a deep network),
2. a **loss function** that grades the scores (SVM, softmax, and friends),
3. an **optimization** procedure that adjusts the parameters to lower the loss.

We have the first two. The next chapter is about the third: how to actually find good values for $\\symW$.`);
    p.callout('idea', 'A linear classifier is a matrix multiply plus a bias. Each row of $\\symW$ is both a *direction* in pixel space (a flat wall between classes) and a *template* image for its class. A loss function turns "how good are these scores?" into one number to minimize, and regularization breaks ties in favor of small, spread-out weights.', 'Takeaways');
  },
};

export default chapter;
