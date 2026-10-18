import type { ChapterDef } from './index';
import { fmt } from '../core/code';
import { color, rgbOf, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { cellBox, clamp, dragNearest, gear, haloText, ital, mono, plotLabel, pxArrow, pyf, pyList, snap, ui } from '../lib/math-kit-draw';

const deg = (r: number) => (r * 180) / Math.PI;

/** Splits "a | b | c" rows (written with String.raw) into table cells. */
const rows = (src: string) =>
  src
    .trim()
    .split('\n')
    .map((l) => l.split(' | ').map((c) => c.trim()));

const chapter: ChapterDef = {
  symbols: {
    x: { color: 'orange', name: 'x: an input (one number, or a vector of numbers)' },
    w: { color: 'blue', name: 'w: a vector of weights (the blue arrow)' },
    W: { color: 'blue', name: 'W: a matrix, a grid of numbers (in the course: the weights)' },
    f: { color: 'purple', name: 'f: a function, the machine that turns inputs into an output' },
    h: { color: 'slate', name: 'h: a tiny step, used to measure a slope numerically' },
    grad: { color: 'teal', name: '∇f: the gradient, the vector of all partial derivatives', tex: '\\nabla f', code: ['grad'] },
    mu: { color: 'gold', name: 'μ: the mean (the average)', tex: '\\mu', code: ['mu'] },
    sigma: { color: 'green', name: 'σ: the standard deviation (the typical spread)', tex: '\\sigma', code: ['sigma'] },
  },

  render(p) {
    p.prose(`
Deep learning papers look like a wall of symbols, but almost everything in this course is built from about a dozen ideas, and as a programmer you already use most of them under other names. This chapter rebuilds those ideas from scratch, in the order the course needs them, and pins every one of them to a few lines of NumPy. If you can read a for loop, you can read every equation in CS231n.

Nobody expects you to read this in one sitting. Skim it now, then come back whenever a later chapter links here. Each section stands on its own.`);
    p.callout('aside', `Every equation in this course comes as a card: the math on one side, the same computation in Python on the other, a piece-by-piece reading, and a plain-words version. Colored symbols are linked: hover or tap $\\symx$ in an equation and every \`x\` in the code lights up too. Figures always show the code they run, and the numbers in that code change as you play.`, 'How to read this chapter');

    // ------------------------------------------------------------------ functions
    p.h2('Variables, functions and graphs', 'functions');
    p.prose(`
A **variable** is a name that stands for a number, exactly like a variable in code. A **function** is a machine: feed it an input, and it hands back an output, always the same output for the same input. A mathematician writes $\\symf(\\symx) = 2\\symx + 1$; you would write \`def f(x): return 2 * x + 1\`. Same thing.

Functions can take several inputs, as in $\\symf(\\symx, y) = \\symx^2 + 3y^2$, or a whole list of numbers at once. The two most important functions in this course are enormous. The **network** takes an image (3072 numbers) and returns ten class scores. The **loss** takes every weight of the network and returns one number that says how badly it is doing. Learning means adjusting the loss's inputs until its output is small.

The **graph** of a function is a picture of every answer at once: for each input $\\symx$ along the horizontal axis, put a dot at height $\\symf(\\symx)$. NumPy draws graphs the same way: evaluate the function on a few hundred inputs in one go, then join the dots.`);

    p.figure({
      title: 'A function is a machine; its graph is every answer at once',
      codeTitle: 'function.py',
      code: `
        def f(x):
            return {{expr:2 * x + 1}}

        x = {{x:1.0}}
        y = f(x)                       # {{y:3.0}}     #@one

        xs = np.linspace(-3, 3, 200)   # 200 inputs    #@all
        ys = f(xs)                     # 200 outputs   #@all
        plt.plot(xs, ys)               # the graph     #@all
      `,
      setup(f) {
        type K = 'line' | 'sq' | 'relu' | 'exp';
        const FN: Record<K, { expr: string; label: string; fn: (x: number) => number; dom: [number, number, number, number] }> = {
          line: { expr: '2 * x + 1', label: '2x + 1', fn: (x) => 2 * x + 1, dom: [-3.3, 3.3, -5.6, 7.6] },
          sq: { expr: 'x ** 2', label: 'x²', fn: (x) => x * x, dom: [-3.3, 3.3, -1.6, 9.6] },
          relu: { expr: 'np.maximum(0, x)', label: 'max(0, x)', fn: (x) => Math.max(0, x), dom: [-3.3, 3.3, -1.3, 3.6] },
          exp: { expr: 'np.exp(x)', label: 'eˣ', fn: Math.exp, dom: [-3.3, 3.3, -1.6, 9.6] },
        };
        let k: K = 'line';
        let x = 1;
        let curve = true;
        const trail: number[] = [];
        const F = () => FN[k];
        const mach = f.canvas(640, 84, (ctx, w, h) => {
          const y = F().fn(x);
          const fs = Math.max(11, Math.min(14, w / 36));
          const bh = Math.min(h - 14, 52);
          const y0 = (h - bh) / 2;
          const inW = w * 0.25;
          const mW = w * 0.36;
          const gap = (w - inW * 2 - mW) / 2;
          cellBox(ctx, 0, y0, inW, bh, `x = ${pyf(x, 3)}`, color('orange'), { on: true, size: fs, radius: 10 });
          pxArrow(ctx, inW + 3, h / 2, inW + gap - 3, h / 2, color('--ink-3'), 1.5);
          const mx = inW + gap;
          ctx.beginPath();
          ctx.roundRect(mx, y0 - 2, mW, bh + 4, 12);
          ctx.fillStyle = color('--paper-2');
          ctx.fill();
          ctx.strokeStyle = color('purple');
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = color('purple');
          ctx.font = ital(fs + 2);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText('f', mx + 8, y0 + 3);
          ctx.fillStyle = color('--ink');
          ctx.font = mono(Math.max(11, fs - 1));
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(F().expr, mx + mW / 2 + 4, h / 2 + 2);
          pxArrow(ctx, mx + mW + 3, h / 2, mx + mW + gap - 3, h / 2, color('--ink-3'), 1.5);
          cellBox(ctx, w - inW, y0, inW, bh, `y = ${pyf(y, 4)}`, color('purple'), { on: true, size: fs, radius: 10 });
        });
        const pl = f.plot({
          aspect: 1.3,
          square: false,
          domain: FN.line.dom,
          draw: (pp) => {
            pp.ctx.font = mono(11, 400); // axes() keeps the current font for its labels
            pp.axes({ grid: 1, labels: true });
            const col = color('purple');
            if (curve) pp.fn(F().fn, withAlpha(col, 0.85), 2.5);
            for (const t of trail) pp.dot(t, F().fn(t), 3.5, col);
            const y = F().fn(x);
            const ox = color('orange');
            pp.path([x, x], [0, y], withAlpha(ox, 0.85), 1.5, [4, 4]);
            pp.path([x, 0], [y, y], withAlpha(col, 0.85), 1.5, [4, 4]);
            pp.dot(x, 0, 5.5, ox, color('--paper'));
            pp.dot(x, y, 6.5, col, color('--paper'));
            haloText(pp.ctx, `y = ${F().label}`, 12, 16, col, ital(15), 'left');
          },
        });
        const sync = () => {
          f.code.setMany({ x: pyf(x, 3), y: pyf(F().fn(x), 4) });
          mach.redraw();
          pl.redraw();
        };
        const xs = f.slider({ label: 'x', sym: 'x', min: -3, max: 3, step: 0.1, value: 1, format: (v) => pyf(v, 3), onInput: (v) => { x = Math.round(v * 10) / 10; f.code.highlight('one'); sync(); } });
        dragNearest(pl, () => [[x, F().fn(x)]], (_, mx) => {
          sweep.stop();
          x = clamp(Math.round(mx * 10) / 10, -3, 3);
          xs.set(x, false);
          f.code.highlight('one');
          sync();
        });
        f.segmented({
          label: 'f(x) =',
          options: (Object.keys(FN) as K[]).map((key) => ({ value: key, label: FN[key].label })),
          value: 'line',
          onChange: (v) => {
            k = v;
            pl.setDomain(...F().dom);
            f.code.set('expr', F().expr);
            sync();
          },
        });
        let sweepX = -3;
        let nextDot = -3;
        const sweep = f.loop((dt) => {
          sweepX = Math.min(3, sweepX + dt * 2.2);
          while (nextDot <= sweepX + 1e-9) {
            trail.push(nextDot);
            nextDot += 0.25;
          }
          x = Math.round(sweepX * 10) / 10;
          xs.set(x, false);
          f.code.highlight('one');
          sync();
          if (sweepX >= 3) {
            curve = true;
            f.code.highlight('all');
            pl.redraw();
            return false;
          }
        });
        f.button('Sweep x across', () => {
          trail.length = 0;
          sweepX = -3;
          nextDot = -3;
          curve = false;
          sweep.start();
        }, { primary: true });
      },
      caption: `The machine on top takes one input and returns one output. **Drag** on the graph (or use the slider) to feed it different values of $\\symx$. Press **Sweep** to feed it inputs from $-3$ to $3$ one after another: each answer leaves a dot, and the dots fill in the graph. That is all \`plt.plot(xs, ys)\` does, with 200 inputs at once. Switch functions to meet the four shapes this course leans on: a line, a parabola, the ReLU $\\max(0, \\symx)$, and the exponential.`,
    });

    // ------------------------------------------------------------------ vectors
    p.h2('Vectors: lists of numbers, drawn as arrows', 'vectors');
    p.prose(`
A **vector** is an ordered list of numbers, like $\\symx = [3, 1]$. How many numbers it holds is its *dimension*. A CIFAR-10 image flattened into one long list is a vector with 3072 dimensions; the ten class scores form a vector with 10.

With two numbers, you can draw a vector as an **arrow** from the origin to the point $(3, 1)$: three steps right, one step up. Nobody can picture 3072 dimensions, but every idea below (adding, stretching, length, angle) works exactly the same way there, so flat arrows on a page are the right mental model.

- **Adding** two vectors adds them entry by entry: $[2, 1] + [1, 3] = [3, 4]$. As arrows, put the tail of the second on the tip of the first.
- **Scaling** multiplies every entry by the same number: $2 \\times [2, 1] = [4, 2]$. The arrow stretches; a negative number flips it around.
- **Subtracting**, $\\symx - \\symw$, gives the arrow from the tip of $\\symw$ to the tip of $\\symx$. Its length is the *distance* between the two points, which is exactly what the nearest-neighbor classifier in Chapter 3 measures between two images.

In NumPy each of these is a single operator applied to whole arrays: \`w + x\`, \`x - w\`, \`2 * w\`. No loops.`);

    p.figure({
      title: 'Vectors as arrows: add, subtract, scale, measure',
      codeTitle: 'vectors.py',
      code: `
        w = np.array([{{w0:2}}, {{w1:1}}])
        x = np.array([{{x0:1}}, {{x1:3}}])
        c = {{c:1.5}}

        w + x     # {{a}}   tip to tail        #@add
        x - w     # {{d}}   from w's tip to x's  #@sub
        c * w     # {{s}}   w, stretched        #@scale

        r = {{rexpr:w + x}}               # the purple arrow
        np.linalg.norm(r)        # {{l2}}   L2 length
        np.sum(np.abs(r))        # {{l1}}   L1 length
      `,
      setup(f) {
        const w = [2, 1];
        const x = [1, 3];
        let c = 1.5;
        let mode: 'add' | 'sub' | 'scale' = 'add';
        const result = () => (mode === 'add' ? [w[0]! + x[0]!, w[1]! + x[1]!] : mode === 'sub' ? [x[0]! - w[0]!, x[1]! - w[1]!] : [c * w[0]!, c * w[1]!]);
        const pl = f.plot({
          aspect: 1.2,
          domain: [-5, 5, -4, 4.5],
          draw: (pp) => {
            pp.ctx.font = mono(11, 400); // axes() keeps the current font for its labels
            pp.axes({ grid: 1, labels: true });
            const B = color('blue');
            const O = color('orange');
            const P = color('purple');
            const r = result();
            if (mode === 'add') {
              pp.path([w[0]!, r[0]!, x[0]!], [w[1]!, r[1]!, x[1]!], withAlpha(color('--ink-3'), 0.5), 1, [3, 4]);
              pp.arrow(0, 0, x[0]!, x[1]!, withAlpha(O, 0.35), 2);
              pp.arrow(w[0]!, w[1]!, r[0]!, r[1]!, O, 2.5);
              pp.arrow(0, 0, w[0]!, w[1]!, B, 2.5);
              pp.arrow(0, 0, r[0]!, r[1]!, P, 3);
              lab(r, 'w + x', P, 15);
            } else if (mode === 'sub') {
              pp.arrow(0, 0, r[0]!, r[1]!, withAlpha(P, 0.3), 2);
              pp.arrow(0, 0, w[0]!, w[1]!, B, 2.5);
              pp.arrow(0, 0, x[0]!, x[1]!, O, 2.5);
              pp.arrow(w[0]!, w[1]!, x[0]!, x[1]!, P, 3);
              plotLabel(pp, 'x − w', (w[0]! + x[0]!) / 2 + 0.35, (w[1]! + x[1]!) / 2 + 0.35, P, 15);
            } else {
              pp.path([-6 * w[0]!, 6 * w[0]!], [-6 * w[1]!, 6 * w[1]!], withAlpha(color('--ink-3'), 0.35), 1, [3, 4]);
              pp.arrow(0, 0, x[0]!, x[1]!, withAlpha(O, 0.3), 2);
              pp.arrow(0, 0, r[0]!, r[1]!, P, 5);
              pp.arrow(0, 0, w[0]!, w[1]!, B, 2.5);
              if (Math.abs(c) > 0.01) lab(r, `${fmt(c, 2)} w`, P, 15);
            }
            pp.dot(w[0]!, w[1]!, 6, B, color('--paper'));
            pp.dot(x[0]!, x[1]!, 6, O, color('--paper'));
            lab(w, 'w', B);
            lab(x, 'x', O);
          },
        });
        /** Label just beyond an arrow's tip, kept inside the visible area. */
        function lab(v: number[], s: string, col: string, size = 17) {
          const n = Math.hypot(v[0]!, v[1]!) || 1;
          const [a0, a1, b0, b1] = pl.view();
          plotLabel(pl, s, clamp(v[0]! + (v[0]! / n) * 0.5, a0 + 0.4, a1 - 0.4), clamp(v[1]! + (v[1]! / n) * 0.5, b0 + 0.3, b1 - 0.3), col, size);
        }
        const l2Ro = f.readout('purple L2 length');
        const l1Ro = f.readout('L1 length');
        const sync = () => {
          const r = result();
          const fl = [...w, ...x].some((v) => !Number.isInteger(v));
          f.code.setMany({
            w0: fmt(w[0]!), w1: fmt(w[1]!), x0: fmt(x[0]!), x1: fmt(x[1]!),
            a: pyList([w[0]! + x[0]!, w[1]! + x[1]!], fl),
            d: pyList([x[0]! - w[0]!, x[1]! - w[1]!], fl),
            s: pyList([c * w[0]!, c * w[1]!], fl || !Number.isInteger(c)),
            rexpr: mode === 'add' ? 'w + x' : mode === 'sub' ? 'x - w' : 'c * w',
            l2: pyf(Math.hypot(r[0]!, r[1]!), 4),
            l1: fl || (mode === 'scale' && !Number.isInteger(c)) ? pyf(Math.abs(r[0]!) + Math.abs(r[1]!), 4) : fmt(Math.abs(r[0]!) + Math.abs(r[1]!)),
          });
          l2Ro.set(Math.hypot(r[0]!, r[1]!));
          l1Ro.set(Math.abs(r[0]!) + Math.abs(r[1]!));
          f.code.highlight(mode);
          pl.redraw();
        };
        dragNearest(pl, () => [[w[0]!, w[1]!], [x[0]!, x[1]!]], (i, mx, my) => {
          const v = i === 0 ? w : x;
          v[0] = clamp(snap(mx), -4.5, 4.5);
          v[1] = clamp(snap(my), -3.5, 4);
          sync();
        });
        f.segmented({
          label: 'show',
          options: [
            { value: 'add', label: 'w + x' },
            { value: 'sub', label: 'x − w' },
            { value: 'scale', label: 'c · w' },
          ],
          value: 'add',
          onChange: (v) => {
            mode = v;
            sync();
          },
        });
        f.slider({ label: 'c', min: -2, max: 2.5, step: 0.25, value: 1.5, slot: 'c', format: (v) => fmt(v), onInput: (v) => { c = v; sync(); } });
        sync();
      },
      caption: `**Drag** either arrow's tip (they snap to halves). In **w + x** mode, the orange arrow is copied onto the tip of the blue one, and the purple sum ends where that copy ends. In **x − w** mode, the purple arrow runs from the tip of $\\symw$ to the tip of $\\symx$: its length is the distance between the two points. In **c · w** mode, slide $c$ and watch the arrow stretch, shrink, and flip when $c$ goes negative. The readouts give the purple arrow's two kinds of length, defined just below.`,
    });

    p.math({
      label: 'Length: the L2 and L1 norms',
      tex: String.raw`\begin{gathered} \|\symx\|_2 = \sqrt{\textstyle\sum_i \symx_i^{\,2}} \\[6pt] \|\symx\|_1 = \textstyle\sum_i |\symx_i| \end{gathered}`,
      code: `
        x = np.array([3.0, 4.0])
        np.sqrt(np.sum(x ** 2))   # 5.0  L2 norm
        np.linalg.norm(x)         # 5.0  same, built in
        np.sum(np.abs(x))         # 7.0  L1 norm
      `,
      terms: [
        [String.raw`\|\symx\|_2`, 'the **L2 norm** of $\\symx$: its ordinary straight-line length. Double bars mean "the length of"'],
        [String.raw`\symx_i^{\,2}`, 'entry number $i$ of $\\symx$, squared'],
        [String.raw`\sqrt{\textstyle\sum_i \cdots}`, 'add up the squares, then take the square root. In two dimensions this is Pythagoras: $\\sqrt{3^2 + 4^2} = 5$'],
        [String.raw`\|\symx\|_1`, 'the **L1 norm**: add up the sizes of the entries. It is the distance a taxi drives on a grid of streets: 3 blocks across plus 4 up'],
        [String.raw`|\symx_i|`, 'absolute value: drop the minus sign, if any'],
      ],
      explain: 'Both norms turn a whole list of numbers into one number that answers "how big is this?" Apply one to a difference, $\\|\\symx - \\symw\\|$, and you get a distance between two vectors: Chapter 3 compares images with exactly these two distances. The *squared* L2 norm, which is the same sum without the square root, is the L2 regularization penalty of Chapter 4.',
    });

    // ------------------------------------------------------------------ dot product
    p.h2('The dot product', 'dot-product');
    p.prose(`If you take one thing from this chapter, make it this. The **dot product** of two vectors of the same length: multiply them entry by entry, then add up the products. Two lists in, one number out.`);
    p.math({
      label: 'Dot product: multiply, add',
      tex: String.raw`\begin{aligned} \symw \cdot \symx &= \sum_{i=1}^{D} \symw_i\,\symx_i \\ &= \symw_1\symx_1 + \symw_2\symx_2 + \cdots + \symw_D\symx_D \end{aligned}`,
      codeTitle: 'dot.py',
      code: `
        w = np.array([2.0, -1.0, 0.5])
        x = np.array([1.0,  3.0, 4.0])

        total = 0.0
        for i in range(3):
            total += w[i] * x[i]   # 2 - 3 + 2
        print(total)               # 1.0
        print(np.dot(w, x))        # 1.0 in one call
        print(w @ x)               # 1.0 operator form
      `,
      terms: [
        [String.raw`\symw \cdot \symx`, 'read "w dot x". Both vectors must have the same length $D$'],
        [String.raw`\symw_i\,\symx_i`, 'entry $i$ of one times entry $i$ of the other'],
        [String.raw`\sum_{i=1}^{D}`, 'add those products up for every $i$ from 1 to $D$ (the $\\Sigma$ symbol is unpacked [below](#/math-kit/sums))'],
      ],
      explain: 'This is the workhorse of the entire course. A linear classifier\'s score for a class is the dot product of that class\'s row of weights with the image. Every neuron in every network starts by taking the dot product of its weights with its inputs. A convolution slides a small dot product across an image. When a later chapter says "multiply and add", it means this.',
    });
    p.prose(`
The arithmetic is simple, but the dot product also has a *meaning*, and that meaning is why it is everywhere. It measures how much two arrows **agree**:

- arrows pointing the same way give a large positive number,
- arrows at a right angle (*perpendicular*, also called *orthogonal*) give exactly zero,
- arrows pointing in opposite directions give a large negative number.

Precisely:`);
    p.math({
      label: 'Dot product and angle',
      tex: String.raw`\symw \cdot \symx = \|\symw\|\,\|\symx\|\,\cos\theta`,
      code: `
        len_w = np.linalg.norm(w)
        len_x = np.linalg.norm(x)
        cos_theta = np.dot(w, x) / (len_w * len_x)
        theta = np.degrees(np.arccos(cos_theta))
        # cos_theta is in [-1, 1]; theta is in degrees
      `,
      terms: [
        [String.raw`\|\symw\|\,\|\symx\|`, 'the two lengths multiplied: longer arrows make bigger dot products'],
        [String.raw`\theta`, '"theta": the angle between the two arrows'],
        [String.raw`\cos\theta`, 'the **cosine** of that angle: 1 when the arrows point the same way, 0 at a right angle, $-1$ when they point in opposite directions'],
      ],
      explain: 'Read it as "how much the arrows agree, times how long they are." Another view: drop a perpendicular from the tip of $\\symx$ onto the line through $\\symw$. The *shadow* that $\\symx$ casts along $\\symw$ has length $\\|\\symx\\|\\cos\\theta$, so the dot product is the length of $\\symw$ times the shadow of $\\symx$ on it. You will almost never compute an angle in this course; what matters is the reading: **a dot product is a similarity score.**',
    });
    p.callout('math', 'No trigonometry needed. $\\cos\\theta$ is just a number between $-1$ and $1$ that measures how aligned two directions are. Some anchors: $\\cos 0^\\circ = 1$, $\\cos 60^\\circ = 0.5$, $\\cos 90^\\circ = 0$, $\\cos 120^\\circ = -0.5$, $\\cos 180^\\circ = -1$.', 'Cosine in one breath');

    p.figure({
      title: 'The dot product measures how much two arrows agree',
      codeTitle: 'dot_geometry.py',
      code: `
        w = np.array([{{w0:2}}, {{w1:1}}])
        x = np.array([{{x0:0.5}}, {{x1:2}}])

        w[0] * x[0] + w[1] * x[1]   # {{expr}}   #@dot
        np.dot(w, x)                # {{dot}}    #@dot

        len_w = np.linalg.norm(w)            # {{lw}}
        len_x = np.linalg.norm(x)            # {{lx}}
        cos_theta = np.dot(w, x) / (len_w * len_x)   #@cos
        # cos_theta = {{cos}}
        np.degrees(np.arccos(cos_theta))     # {{theta}}   #@cos
      `,
      setup(f) {
        const w = [2, 1];
        const x = [0.5, 2];
        const dot = () => w[0]! * x[0]! + w[1]! * x[1]!;
        const signedTheta = () => Math.atan2(w[0]! * x[1]! - w[1]! * x[0]!, dot());
        const pl = f.plot({
          aspect: 1.25,
          domain: [-4, 4, -3.2, 3.2],
          draw: (pp) => {
            const B = color('blue');
            const O = color('orange');
            const nw2 = w[0]! * w[0]! + w[1]! * w[1]!;
            const bR = rgbOf(B);
            const rR = rgbOf(color('red'));
            if (nw2 > 1e-9) {
              pp.field((a, b) => (w[0]! * a + w[1]! * b > 0 ? [bR[0], bR[1], bR[2], 22] : [rR[0], rR[1], rR[2], 16]), 6);
            }
            pp.axes({ grid: 1 });
            if (nw2 < 1e-9) return;
            const nw = Math.sqrt(nw2);
            const ux = w[0]! / nw, uy = w[1]! / nw;
            // the zero line, perpendicular to w
            pp.path([-uy * 9, uy * 9], [ux * 9, -ux * 9], withAlpha(color('--ink-3'), 0.7), 1.2, [6, 5]);
            // the shadow of x on w
            const d = dot();
            const t = d / nw2;
            const fx = t * w[0]!, fy = t * w[1]!;
            pp.path([-ux * 9, ux * 9], [-uy * 9, uy * 9], withAlpha(B, 0.2), 1);
            const sc = d >= 0 ? color('purple') : color('red');
            pp.ctx.lineCap = 'round';
            pp.path([0, fx], [0, fy], withAlpha(sc, 0.55), 8);
            pp.ctx.lineCap = 'butt';
            pp.path([x[0]!, fx], [x[1]!, fy], withAlpha(color('--ink-2'), 0.8), 1.2, [3, 3]);
            // angle arc
            const aw = Math.atan2(w[1]!, w[0]!);
            const th = signedTheta();
            const c = pp.ctx;
            const ox = pp.sx(0), oy = pp.sy(0);
            if (Math.hypot(x[0]!, x[1]!) > 1e-9) {
              c.beginPath();
              c.arc(ox, oy, 26, -aw, -aw - th, th > 0);
              c.strokeStyle = color('--ink-2');
              c.lineWidth = 1.5;
              c.stroke();
              const am = aw + th / 2;
              haloText(c, 'θ', ox + Math.cos(am) * 40, oy - Math.sin(am) * 40, color('--ink-2'), ital(14), 'center');
            }
            pp.arrow(0, 0, w[0]!, w[1]!, B, 3);
            pp.arrow(0, 0, x[0]!, x[1]!, O, 3);
            pp.dot(w[0]!, w[1]!, 6, B, color('--paper'));
            pp.dot(x[0]!, x[1]!, 6, O, color('--paper'));
            const lab = (v: number[], s: string, col: string) => {
              const n = Math.hypot(v[0]!, v[1]!) || 1;
              plotLabel(pp, s, v[0]! + (v[0]! / n) * 0.42, v[1]! + (v[1]! / n) * 0.42, col, 17);
            };
            lab(w, 'w', B);
            lab(x, 'x', O);
            const [vx0, vx1, vy0, vy1] = pp.view();
            const corner = (s: string, col: string, sx: number, sy: number, align: CanvasTextAlign) => haloText(c, s, pp.sx(sx), pp.sy(sy), col, ui(12, 600), align);
            // label the two half-planes on the side each actually occupies
            const pos: [number, number] = [ux * 2.6, uy * 2.6];
            const neg: [number, number] = [-ux * 2.6, -uy * 2.6];
            const inView = (q: [number, number]) => q[0] > vx0 + 0.3 && q[0] < vx1 - 0.3 && q[1] > vy0 + 0.3 && q[1] < vy1 - 0.3;
            if (inView(pos)) corner('w · x > 0', B, pos[0] - uy * 1.1, pos[1] + ux * 1.1, 'center');
            if (inView(neg)) corner('w · x < 0', color('red'), neg[0] - uy * 1.1, neg[1] + ux * 1.1, 'center');
          },
        });
        const cosPl = f.plot({
          height: 104,
          square: false,
          domain: [-200, 200, -1, 1],
          draw: (pp) => {
            const L = Math.hypot(w[0]!, w[1]!) * Math.hypot(x[0]!, x[1]!);
            const M = Math.max(L, 0.5) * 1.35;
            pp.setDomain(-200, 200, -M, M);
            const c = pp.ctx;
            c.strokeStyle = color('--grid');
            c.lineWidth = 1;
            for (const a of [-180, -90, 0, 90, 180]) {
              c.beginPath();
              c.moveTo(pp.sx(a), 0);
              c.lineTo(pp.sx(a), pp.h);
              c.stroke();
              pp.text(`${a}°`, a + (a === 180 ? -4 : a === -180 ? 4 : 0), -M * 0.92, { size: 11, align: a === 180 ? 'right' : a === -180 ? 'left' : 'center', mono: true, color: color('--ink-3') });
            }
            pp.path([-200, 200], [0, 0], color('--axis'), 1);
            pp.fn((t) => L * Math.cos((t * Math.PI) / 180), withAlpha(color('purple'), 0.8), 2);
            const th = deg(signedTheta());
            pp.path([th, th], [0, dot()], withAlpha(color('purple'), 0.6), 1, [3, 3]);
            pp.dot(th, dot(), 5, dot() >= 0 ? color('purple') : color('red'), color('--paper'));
            haloText(c, 'w · x as x swings around w (angle θ)', 8, 12, color('--ink-3'), ui(11), 'left');
          },
        });
        const dotRo = f.readout('w · x');
        const thRo = f.readout('θ');
        const cosRo = f.readout('cos θ');
        const sync = () => {
          const d = dot();
          const lw = Math.hypot(w[0]!, w[1]!), lx = Math.hypot(x[0]!, x[1]!);
          const cs = lw * lx > 1e-9 ? d / (lw * lx) : NaN;
          const th = Math.abs(deg(signedTheta()));
          const fl = [...w, ...x].some((v) => !Number.isInteger(v));
          const n = (v: number) => (v < 0 ? `(${fmt(v, 3)})` : fmt(v, 3));
          f.code.setMany({
            w0: fmt(w[0]!, 3), w1: fmt(w[1]!, 3), x0: fmt(x[0]!, 3), x1: fmt(x[1]!, 3),
            expr: `${n(w[0]!)}*${n(x[0]!)} + ${n(w[1]!)}*${n(x[1]!)} = ${fl ? pyf(d, 4) : fmt(d, 4)}`,
            dot: fl ? pyf(d, 4) : fmt(d, 4),
            lw: pyf(lw, 4), lx: pyf(lx, 4),
            cos: Number.isNaN(cs) ? 'nan' : pyf(cs, 3),
            theta: Number.isNaN(cs) ? 'nan' : pyf(th, 3),
          });
          dotRo.set(d);
          thRo.set(Number.isNaN(cs) ? '–' : `${fmt(th, 3)}°`);
          cosRo.set(Number.isNaN(cs) ? '–' : fmt(cs, 3));
          let verdict = '';
          if (Number.isNaN(cs)) verdict = 'One arrow has zero length, so there is no angle (and the dot product is 0).';
          else if (cs > 0.95) verdict = '**Pointing the same way:** the dot product is as large as these lengths allow.';
          else if (cs > 0.02) verdict = '**Roughly agreeing:** the dot product is positive.';
          else if (cs >= -0.02) verdict = '**Perpendicular:** the dot product is zero. Neither arrow has any shadow on the other.';
          else if (cs >= -0.95) verdict = '**Disagreeing:** the dot product is negative.';
          else verdict = '**Pointing opposite ways:** the dot product is as negative as these lengths allow.';
          f.status(verdict);
          pl.redraw();
          cosPl.redraw();
        };
        let spinning = false;
        const spin = f.loop((dt) => {
          const a = dt * 0.9;
          const ca = Math.cos(a), sa = Math.sin(a);
          const x0 = x[0]!, x1 = x[1]!;
          x[0] = x0 * ca - x1 * sa;
          x[1] = x0 * sa + x1 * ca;
          f.code.highlight(['dot', 'cos']);
          sync();
        });
        const stopSpin = () => {
          spin.stop();
          spinning = false;
          spinBtn.textContent = 'Spin x';
          f.code.highlight(null);
        };
        dragNearest(pl, () => [[w[0]!, w[1]!], [x[0]!, x[1]!]], (i, mx, my) => {
          const v = i === 0 ? w : x;
          v[0] = clamp(snap(mx), -3.5, 3.5);
          v[1] = clamp(snap(my), -3, 3);
          f.code.highlight('dot');
          sync();
        }, () => spinning && stopSpin());
        const spinBtn = f.button('Spin x', () => {
          if (spinning) stopSpin();
          else {
            spinning = true;
            spin.start();
            spinBtn.textContent = 'Stop';
          }
        }, { primary: true });
        sync();
      },
      caption: `**Drag** the arrow tips (they snap to halves, so the arithmetic in the code stays readable). The thick bar along $\\symw$ is the shadow of $\\symx$: the dot product is that shadow's length times $\\|\\symw\\|$, and the bar turns red when the dot product goes negative. The tint marks every point whose dot product with $\\symw$ is positive (blue) or negative (red), split by the dashed line where it is exactly zero. Press **Spin x**: as $\\symx$ swings around, the chart below traces a cosine wave. Then try to make the dot product exactly 0 with both arrows still long, for example $\\symw = [2, 1]$ and $\\symx = [-1, 2]$.`,
    });
    p.prose(`That picture is a linear classifier in miniature. Let $\\symw$ be one class's weights and $\\symx$ an image: the score $\\symw \\cdot \\symx$ is positive on one side of a line through the origin (in many dimensions, a flat wall) and negative on the other. Chapter 4 adds a bias to slide that wall around and builds a whole classifier out of it.`);

    // ------------------------------------------------------------------ matrices
    p.h2('Matrices', 'matrices');
    p.prose(`
A **matrix** is a rectangular grid of numbers. Its **shape** is (rows, columns), always in that order: a grid with 2 rows and 3 columns has shape $(2, 3)$, written $2 \\times 3$ and read "two by three". The entry in row $i$ and column $j$ is written $\\symW_{ij}$ in math and \`W[i, j]\` in NumPy (where rows and columns are counted from 0).

The most useful way to see a matrix is as a **stack of row vectors**. In Chapter 4, the weight matrix $\\symW$ has shape $(10, 3072)$: ten rows, one per class, each one a vector of 3072 weights.

### Matrix times vector

Multiplying a matrix by a vector is not a new operation. It is **one dot product per row**: each row of $\\symW$ is dotted with $\\symx$, and the answers are stacked into a new vector with one number per row.`);
    p.math({
      label: 'Matrix times vector',
      tex: String.raw`\begin{aligned} (\symW\symx)_i &= \sum_{j} \symW_{ij}\,\symx_j \\ &= (\text{row } i \text{ of } \symW)\cdot \symx \end{aligned}`,
      code: `
        W = np.array([[1, 2,  0],
                      [0, 1, -1]])   # shape (2, 3)
        x = np.array([3, 1, 2])      # shape (3,)
        W.dot(x)       # array([ 5, -1]), shape (2,)
        # row 0: 1*3 + 2*1 + 0*2 =  5
        # row 1: 0*3 + 1*1 - 1*2 = -1
      `,
      terms: [
        [String.raw`(\symW\symx)_i`, 'entry $i$ of the result'],
        [String.raw`\symW_{ij}`, 'the number in row $i$, column $j$ of $\\symW$'],
        [String.raw`\sum_j \symW_{ij}\,\symx_j`, 'walk along row $i$ and down $\\symx$ together, multiply the pairs, and add: a dot product'],
      ],
      explain: 'The number of columns of $\\symW$ must equal the length of $\\symx$, or the pairs would not line up. A $(2, 3)$ matrix times a length-3 vector gives a length-2 vector: one number per row. With $\\symW$ of shape $(10, 3072)$ and an image of 3072 numbers, you get the 10 class scores.',
    });

    p.figure({
      title: 'W.dot(x) is a double loop',
      codeTitle: 'matvec.py',
      code: `
        W = np.array([[ 2, 1,  0, -1],
                      [ 0, 3,  1,  2],
                      [-1, 0,  2,  1]])   # (3, 4)
        x = np.array([1, 2, -1, 3])       # (4,)

        out = np.zeros(3)
        for i in range(3):                # each row     #@row
            for j in range(4):            # along it     #@col
                out[i] += W[i, j] * x[j]  #@mul
        # i = {{i:0}}, j = {{j:0}}, out = {{out}}

        np.allclose(out, W.dot(x))        # True         #@check
      `,
      setup(f) {
        const W = [
          [2, 1, 0, -1],
          [0, 3, 1, 2],
          [-1, 0, 2, 1],
        ];
        const X = [1, 2, -1, 3];
        const steps: { i: number; j: number }[] = [];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) steps.push({ i, j });
        steps.push({ i: 3, j: 0 });
        let cur = 0;
        const partial = (i: number, upto: number) => W[i]!.slice(0, upto + 1).reduce((a, v, j) => a + v * X[j]!, 0);
        const full = (i: number) => partial(i, 3);
        const cv = f.canvas(640, 320, (ctx, w, h) => {
          const st = steps[cur]!;
          const done = st.i === 3;
          const cell = Math.min(w / 8, h / 6.1);
          const fs = Math.max(11, cell * 0.36);
          const B = color('blue');
          const O = color('orange');
          const P = color('purple');
          const outW = cell * 1.35;
          const total = cell * 4 + cell * 1.0 + outW;
          const L = (w - total) / 2 + cell * 0.35;
          const yX = cell * 0.35;
          const yW = yX + cell * 1.55;
          const lab = (s: string, cx: number, cy: number, col: string) => {
            ctx.fillStyle = col;
            ctx.font = ital(Math.max(14, cell * 0.42));
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s, cx, cy);
          };
          lab('x', L - cell * 0.5, yX + cell * 0.42, O);
          for (let j = 0; j < 4; j++) cellBox(ctx, L + j * cell, yX, cell, cell * 0.84, String(X[j]), O, { on: !done && j === st.j, size: fs });
          lab('W', L - cell * 0.5, yW + cell * 1.5, B);
          for (let i = 0; i < 3; i++)
            for (let j = 0; j < 4; j++) {
              const on = !done && i === st.i && j === st.j;
              cellBox(ctx, L + j * cell, yW + i * cell, cell, cell, String(W[i]![j]), B, { on, dim: !done && i !== st.i, size: fs });
            }
          if (!done) {
            // the pair being multiplied
            const cx = L + st.j * cell + cell / 2;
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = O;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, yX + cell * 0.84);
            ctx.lineTo(cx, yW + st.i * cell + 3);
            ctx.stroke();
            ctx.setLineDash([]);
            // row bracket
            ctx.strokeStyle = withAlpha(B, 0.8);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(L - 2, yW + st.i * cell - 1, cell * 4 + 4, cell + 2, 8);
            ctx.stroke();
          }
          const ox = L + cell * 4 + cell * 1.0;
          ctx.fillStyle = color('--ink-2');
          ctx.font = mono(Math.max(13, cell * 0.45), 400);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          for (let i = 0; i < 3; i++) {
            const yy = yW + i * cell + cell / 2;
            pxArrow(ctx, L + cell * 4 + cell * 0.14, yy, ox - cell * 0.14, yy, withAlpha(color('--ink-3'), !done && i !== st.i ? 0.35 : 0.9), 1.3, 6);
          }
          ctx.fillStyle = P;
          ctx.font = mono(Math.max(11, cell * 0.3), 500);
          ctx.fillText('out', ox + outW / 2, yX + cell * 0.42);
          for (let i = 0; i < 3; i++) {
            let val = '';
            if (done || i < st.i) val = fmt(full(i));
            else if (i === st.i) val = st.j === 3 ? fmt(full(i)) : `${fmt(partial(i, st.j))}…`;
            cellBox(ctx, ox, yW + i * cell, outW, cell, val, P, { on: !done && i === st.i, size: fs });
          }
          // the running expansion
          const ty = yW + cell * 3 + cell * 0.62;
          ctx.font = mono(Math.max(11, Math.min(14, w / 40)), 500);
          ctx.fillStyle = color('--ink-2');
          ctx.textAlign = 'center';
          let msg: string;
          if (done) msg = `W.dot(x) = [${[0, 1, 2].map((i) => fmt(full(i))).join(', ')}]: the same three numbers`;
          else {
            const parts = W[st.i]!.slice(0, st.j + 1).map((v, j) => `${v < 0 ? `(${v})` : v}×${X[j]! < 0 ? `(${X[j]})` : X[j]}`);
            msg = `out[${st.i}] = ${parts.join(' + ')}${st.j === 3 ? ` = ${fmt(full(st.i))}` : ' + …'}`;
          }
          ctx.fillText(msg, w / 2, ty);
        });
        f.stepper({
          steps: steps.length,
          interval: 700,
          label: (k) => (k === steps.length - 1 ? 'check' : `step ${k + 1} / ${steps.length - 1}`),
          onStep: (k) => {
            cur = k;
            const st = steps[k]!;
            const out = [0, 1, 2].map((i) => (i < st.i ? full(i) : i === st.i ? partial(i, st.j) : 0));
            if (st.i === 3) {
              f.code.highlight('check');
              f.code.highlight(null, 'alt');
              f.code.setMany({ i: 2, j: 3, out: pyList([0, 1, 2].map(full), true) });
            } else {
              f.code.highlight('mul');
              f.code.highlight(st.j === 0 ? 'row' : 'col', 'alt');
              f.code.setMany({ i: st.i, j: st.j, out: pyList(out, true) });
            }
            cv.redraw();
          },
        });
      },
      caption: `Press play or step through the double loop. Each step multiplies one weight by one entry of $\\symx$ (the dashed line shows the pair) and adds the product to that row's running total. Four steps finish a row: that row's dot product with $\\symx$. The last step checks that \`W.dot(x)\` gives the same three numbers in one call, computed in fast compiled code. Notice row 2 comes out exactly 0: that row happens to be perpendicular to $\\symx$.`,
    });

    p.prose(`
### Matrix times matrix

Multiplying two matrices is matrix-times-vector done for several vectors at once. Treat each **column** of $B$ as a separate vector, multiply $A$ by each one, and stand the results side by side. Equivalently: entry $(i, j)$ of the result is row $i$ of $A$ dotted with column $j$ of $B$.`);
    p.math({
      label: 'Matrix times matrix',
      tex: String.raw`(AB)_{ij} = \sum_{k} A_{ik}\,B_{kj}`,
      code: `
        A = np.random.randn(2, 3)
        B = np.random.randn(3, 4)
        C = A.dot(B)        # shape (2, 4); or A @ B
        # C[i, j] is row i of A dot column j of B:
        np.isclose(C[1, 2], A[1, :].dot(B[:, 2]))
        # True
      `,
      terms: [
        [String.raw`A_{ik}`, 'row $i$ of $A$, walked along by $k$'],
        [String.raw`B_{kj}`, 'column $j$ of $B$, walked down by the same $k$'],
        [String.raw`\sum_k`, 'multiply the pairs and add: the dot product of a row with a column'],
      ],
      explain: 'A row of $A$ is as long as $A$ has columns, and a column of $B$ is as long as $B$ has rows, so those two sizes must match. They then disappear from the result: $(2, 3)$ times $(3, 4)$ gives $(2, 4)$. In the course this is how a whole batch gets scored at once: stack $N$ images as the rows of `X`, shape $(N, 3072)$, and `X.dot(W.T)` returns all $N \\times 10$ scores in one call. Order matters: $AB$ and $BA$ are different, and usually only one of them is even allowed.',
    });
    p.prose(`
### Transpose

The **transpose** $\\symW^\\top$ (in code \`W.T\`) flips a matrix over its diagonal so that rows become columns. A $(2, 3)$ matrix becomes $(3, 2)$, and entry \`W.T[j, i]\` equals \`W[i, j]\`. It costs nothing in NumPy (no data is copied), and it is the usual way to make shapes line up, as in \`X.dot(W.T)\` above.`);
    p.code(`
      W = np.array([[1, 2, 3],
                    [4, 5, 6]])   # shape (2, 3)
      W.T                         # array([[1, 4],
                                  #        [2, 5],
                                  #        [3, 6]])   shape (3, 2)
    `, { title: 'transpose.py' });
    p.prose(`
### Shape algebra

Here is the habit that will save you more debugging time than any other in this course: **write the shape next to every array.** Matrix products follow a tiny algebra, $(m, n) \\cdot (n, p) \\to (m, p)$. The inner sizes must be equal, and they cancel; the outer sizes survive. If the inner sizes differ, NumPy refuses.`);

    p.figure({
      title: 'Shape algebra: will it multiply?',
      codeTitle: 'shapes.py',
      code: `
        A = np.random.randn({{m:2}}, {{n:3}})
        B = np.random.randn({{k:3}}, {{p:4}})
        C = A.dot({{bexpr:B}})
        # {{r1}}
        # {{r2}}
      `,
      setup(f) {
        let m = 2, n = 3, k = 3, q = 4;
        let useT = false;
        let sel = { r: 0, c: 0 };
        let geo = { cx: 0, cy: 0, cell: 1, rows: 0, cols: 0 };
        const eff = (): [number, number] => (useT ? [q, k] : [k, q]);
        const cv = f.canvas(640, 300, (ctx, w, h) => {
          const [br, bc] = eff();
          const ok = n === br;
          const B = color('blue'), O = color('orange'), P = color('purple');
          const okC = color('green'), bad = color('red');
          const cols = n + bc + (ok ? bc : 3.4) + 2.4;
          const maxRows = Math.max(m, br, 3);
          const cell = Math.min(w / (cols + 0.6), (h - 70) / maxRows, 34);
          const fs = Math.max(11, Math.min(14, w / 42));
          let xc = (w - cols * cell) / 2;
          const midY = (h - 46) / 2 + 6;
          if (sel.r >= m) sel.r = m - 1;
          if (sel.c >= bc) sel.c = bc - 1;
          const grid = (x0: number, r: number, c: number, col: string, hi: (i: number, j: number) => boolean) => {
            const y0 = midY - (r * cell) / 2;
            for (let i = 0; i < r; i++)
              for (let j = 0; j < c; j++) cellBox(ctx, x0 + j * cell, y0 + i * cell, cell, cell, '', col, { on: ok && hi(i, j), radius: 3 });
            return y0 + r * cell;
          };
          const shapeLabel = (cx: number, y: number, name: string, r: number, c: number, which: 0 | 1 | -1, hcol: string) => {
            const parts: [string, string][] = [[`${name} (`, color('--ink-2')], [String(r), which === 0 ? hcol : color('--ink-2')], [', ', color('--ink-2')], [String(c), which === 1 ? hcol : color('--ink-2')], [')', color('--ink-2')]];
            ctx.font = mono(fs, 600);
            const tw = parts.reduce((a, [s]) => a + ctx.measureText(s).width, 0);
            let xx = cx - tw / 2;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            for (const [s, col] of parts) {
              ctx.fillStyle = col;
              ctx.fillText(s, xx, y);
              xx += ctx.measureText(s).width;
            }
          };
          const inner = ok ? okC : bad;
          const yA = grid(xc, m, n, B, (i) => i === sel.r);
          shapeLabel(xc + (n * cell) / 2, Math.max(yA, midY + cell * 1.5) + 10, 'A', m, n, 1, inner);
          xc += n * cell;
          ctx.fillStyle = color('--ink-2');
          ctx.font = mono(Math.max(16, cell * 0.7), 400);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('·', xc + cell * 0.6, midY);
          xc += cell * 1.2;
          const yB = grid(xc, br, bc, O, (_, j) => j === sel.c);
          shapeLabel(xc + (bc * cell) / 2, Math.max(yB, midY + cell * 1.5) + 10, useT ? 'B.T' : 'B', br, bc, 0, inner);
          xc += bc * cell;
          ctx.fillStyle = color('--ink-2');
          ctx.font = mono(Math.max(16, cell * 0.7), 400);
          ctx.textAlign = 'center';
          ctx.fillText('=', xc + cell * 0.6, midY);
          xc += cell * 1.2;
          if (ok) {
            const yC = grid(xc, m, bc, P, (i, j) => i === sel.r && j === sel.c);
            geo = { cx: xc, cy: midY - (m * cell) / 2, cell, rows: m, cols: bc };
            shapeLabel(xc + (bc * cell) / 2, Math.max(yC, midY + cell * 1.5) + 10, 'C', m, bc, -1, P);
            haloText(ctx, `C[${sel.r}, ${sel.c}] = row ${sel.r} of A · column ${sel.c} of ${useT ? 'B.T' : 'B'}`, w / 2, h - 12, color('--ink-2'), mono(Math.max(11, fs - 1), 500), 'center');
          } else {
            geo = { cx: 0, cy: 0, cell: 1, rows: 0, cols: 0 };
            const bw = cell * 3.4;
            const bh = Math.min(cell * 2.6, 84);
            ctx.beginPath();
            ctx.roundRect(xc, midY - bh / 2, bw, bh, 10);
            ctx.fillStyle = withAlpha(bad, 0.1);
            ctx.fill();
            ctx.strokeStyle = bad;
            ctx.setLineDash([5, 4]);
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = bad;
            ctx.font = ui(Math.max(11, fs - 1), 600);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('error', xc + bw / 2, midY - 9);
            ctx.font = mono(Math.max(11, fs - 1), 500);
            ctx.fillText(`${n} ≠ ${br}`, xc + bw / 2, midY + 10);
            haloText(ctx, `inner sizes differ: ${n} columns in A, ${br} rows in ${useT ? 'B.T' : 'B'}`, w / 2, h - 12, bad, ui(Math.max(11, fs - 1), 500), 'center');
          }
        });
        cv.canvas.classList.add('scroll-ok');
        cv.canvas.addEventListener('click', (e) => {
          if (!geo.rows) return;
          const r = cv.canvas.getBoundingClientRect();
          const j = Math.floor((e.clientX - r.left - geo.cx) / geo.cell);
          const i = Math.floor((e.clientY - r.top - geo.cy) / geo.cell);
          if (i >= 0 && i < geo.rows && j >= 0 && j < geo.cols) {
            sel = { r: i, c: j };
            cv.redraw();
          }
        });
        const sync = () => {
          const [br, bc] = eff();
          f.code.setMany({ m, n, k, p: q, bexpr: useT ? 'B.T' : 'B' });
          if (n === br) f.code.setMany({ r1: `C.shape == (${m}, ${bc})`, r2: `each entry: a dot product of length ${n}` });
          else f.code.setMany({ r1: `ValueError: shapes (${m},${n}) and (${br},${bc}) not aligned:`, r2: `  ${n} (dim 1) != ${br} (dim 0)` });
          cv.redraw();
        };
        const sl = (label: string, v: number, set: (x: number) => void) => f.slider({ label, min: 1, max: 5, step: 1, value: v, format: (x) => String(x), onInput: (x) => { set(Math.round(x)); sync(); } });
        sl('A rows', m, (v) => (m = v));
        sl('A cols', n, (v) => (n = v));
        sl('B rows', k, (v) => (k = v));
        sl('B cols', q, (v) => (q = v));
        f.toggle({ label: 'transpose B first (B.T)', value: false, onChange: (v) => { useT = v; sync(); } });
        sync();
      },
      caption: `Set the shapes of $A$ and $B$ with the sliders. When the inner sizes match (green), the result $C$ appears with the outer sizes; when they differ (red), the code shows the error NumPy actually raises. **Tap** a cell of $C$ to see which row of $A$ and which column of $B$ produce it. Try $A$ as $(2, 3)$ and $B$ as $(2, 3)$: it fails, until you transpose $B$.`,
    });
    p.callout('intuition', 'In this course you will constantly see lines like `scores = X.dot(W) + b` with a comment such as `# (N, D) . (D, C) -> (N, C)`. Writing those shape comments is not pedantry: most bugs in the assignments show up first as a shape that does not match what you expected.', 'The shape habit');

    // ------------------------------------------------------------------ sums
    p.h2('Sums and products: loops in disguise', 'sums');
    p.prose(`The capital Greek letter $\\Sigma$ (sigma, think **S** for sum) is a for loop that adds. The expression under it says where the loop variable starts, the number on top says where it stops, and whatever sits to its right is what gets added on each pass.`);
    p.math({
      label: 'Sum notation, and the mean',
      tex: String.raw`\begin{gathered} \sum_{i=1}^{N} \symx_i = \symx_1 + \symx_2 + \cdots + \symx_N \\[6pt] \symmu = \frac{1}{N}\sum_{i=1}^{N}\symx_i \end{gathered}`,
      codeTitle: 'sums.py',
      code: `
        x = np.array([4.0, 1.0, 3.0, 2.0])   # N = 4

        total = 0.0
        for i in range(len(x)):   # i = 0, 1, 2, 3
            total += x[i]
        print(total)              # 10.0
        print(np.sum(x))          # 10.0, compiled

        mu = np.sum(x) / len(x)   # 2.5, the mean
        print(np.mean(x))         # 2.5
      `,
      terms: [
        [String.raw`\sum`, '"sum": add up everything that follows'],
        [String.raw`i=1`, 'the loop variable is $i$, and it starts at 1'],
        [String.raw`N`, 'it stops at $N$, *including* $N$'],
        [String.raw`\symx_i`, 'what gets added on pass $i$: entry $i$ of $\\symx$'],
        [String.raw`\symmu = \frac{1}{N}\sum`, 'the **mean** ("mu"): the sum divided by how many numbers there are'],
      ],
      explain: 'Math counts from 1 and includes the top number; Python counts from 0 and `range` stops one short. Both visit exactly $N$ items, so $\\sum_{i=1}^{N}$ becomes `for i in range(N)`. When the limits are left off, as in $\\sum_i \\symx_i$, it means "over every $i$ there is". Two sums in a row, as in $\\sum_i \\sum_j \\symW_{ij}^2$, are two nested loops: square every entry of a matrix and add them all, which NumPy does with `np.sum(W ** 2)`. The mean is everywhere: the loss over a dataset is the *mean* of the per-example losses, and preprocessing subtracts the *mean* image from every image.',
    });
    p.math({
      label: 'Product notation',
      tex: String.raw`\prod_{i=1}^{N} p_i = p_1 \times p_2 \times \cdots \times p_N`,
      code: `
        p = np.array([0.9, 0.5, 0.8])

        result = 1.0              # start at 1, not 0
        for i in range(len(p)):
            result *= p[i]
        print(result)             # 0.36 (up to rounding)
        print(np.prod(p))         # the same
      `,
      terms: [
        [String.raw`\prod`, 'capital pi, think **P** for product: multiply everything that follows'],
        [String.raw`p_i`, 'the factor on pass $i$'],
      ],
      explain: 'Exactly like $\\Sigma$ but multiplying instead of adding, so the running result starts at 1. Products appear when several independent things must all happen: three independent guesses that are each right with probability 0.9, 0.5 and 0.8 are all right together with probability 0.36. A $\\Pi$ rarely survives for long in this course, because, as the next section shows, a logarithm turns it into a $\\Sigma$.',
    });

    // ------------------------------------------------------------------ exp / log
    p.h2('Exponentials and logarithms', 'exp-log');
    p.prose(`
The number $e \\approx 2.718$ is to growth what $\\pi$ is to circles. The **exponential** function $e^{\\symx}$ (in code \`np.exp(x)\`) raises it to the power $\\symx$. Three facts are all you need:

- $e^0 = 1$, and every step of $+1$ in $\\symx$ **multiplies** the output by about 2.718: $e^1 \\approx 2.7$, $e^2 \\approx 7.4$, $e^3 \\approx 20$, $e^{10} \\approx 22{,}026$. It explodes.
- Negative inputs give small positive outputs: $e^{-1} \\approx 0.37$, $e^{-5} \\approx 0.0067$. The output is **never zero or negative**, which is why the softmax uses $e^{s}$ to turn arbitrary scores into positive numbers.
- Adding inputs multiplies outputs: $e^{a + b} = e^a \\, e^b$.

The **logarithm** $\\log y$ (the *natural* log, also written $\\ln$; in code \`np.log\`) undoes the exponential. It answers the question "what power of $e$ gives me $y$?" So $\\log 1 = 0$, $\\log e = 1$, and $\\log 20 \\approx 3$. It only accepts positive numbers.`);
    p.math({
      label: 'log undoes exp',
      tex: String.raw`\begin{gathered} \log\!\big(e^{\symx}\big) = \symx \\[4pt] e^{\log y} = y \quad (y > 0) \end{gathered}`,
      code: `
        np.exp(1.0)            # 2.718281828459045
        np.log(np.exp(-2.0))   # -2.0
        np.exp(np.log(5.0))    # 4.999999999999999
        np.log(1.0)            # 0.0
        np.log(0.01)           # -4.605...
        np.log(0.0)            # -inf, and a warning
      `,
      terms: [
        [String.raw`e^{\symx}`, 'the exponential: always positive, and it grows explosively'],
        [String.raw`\log`, 'the natural logarithm, its inverse: "which power of $e$ gives this?"'],
        [String.raw`y > 0`, 'the log of zero or of a negative number does not exist; NumPy returns `-inf` or `nan` with a warning'],
      ],
      explain: 'The graph of $\\log$ is the graph of $e^{\\symx}$ flipped across the diagonal line $y = x$, which is what "inverse" looks like (see the figure). The region that matters most in this course is between 0 and 1: $\\log 1 = 0$, $\\log 0.5 \\approx -0.69$, $\\log 0.01 \\approx -4.6$, and as $y$ approaches 0 the log plunges toward $-\\infty$. The softmax loss, $-\\log p$, is built on exactly this: zero cost when the correct class gets probability 1, and a steep, ever-growing cost as that probability heads to 0. (Floating-point arithmetic is not exact, which is why one line prints 4.999999999999999 instead of 5.)',
    });

    p.figure({
      title: 'exp and log are mirror images',
      codeTitle: 'exp_log.py',
      code: `
        x = {{x:1.0}}
        y = np.exp(x)       # {{y}}   always positive   #@exp
        back = np.log(y)    # {{back}}   back to x       #@log

        # each +1 on x multiplies exp(x) by e:
        np.exp(x + 1) / np.exp(x)    # 2.718...
      `,
      setup(f) {
        let x = 1;
        const pl = f.plot({
          aspect: 1.1,
          domain: [-3.4, 5.4, -3.4, 5.4],
          draw: (pp) => {
            pp.ctx.font = mono(11, 400); // axes() keeps the current font for its labels
            pp.axes({ grid: 1, labels: true });
            const P = color('purple');
            const T = color('teal');
            pp.path([-4, 6], [-4, 6], withAlpha(color('--ink-3'), 0.7), 1.2, [6, 5]);
            pp.fn(Math.exp, P, 2.5);
            const lx: number[] = [];
            const ly: number[] = [];
            for (let i = 0; i <= 400; i++) {
              const t = 0.004 * Math.pow(1.0158, i * 1.15);
              if (t > 6) break;
              lx.push(t);
              ly.push(Math.log(t));
            }
            pp.path(lx, ly, T, 2.5);
            const y = Math.exp(x);
            pp.path([x, y], [y, x], withAlpha(color('--ink-2'), 0.7), 1.2, [3, 3]);
            pp.path([x, x], [0, y], withAlpha(P, 0.6), 1, [3, 3]);
            pp.path([0, y], [x, x], withAlpha(T, 0.6), 1, [3, 3]);
            pp.dot(x, y, 6, P, color('--paper'));
            pp.dot(y, x, 6, T, color('--paper'));
            plotLabel(pp, 'y = eˣ', 0.95, 4.1, P, 15, 'right');
            plotLabel(pp, 'y = log x', 4.3, 0.75, T, 15, 'center');
            plotLabel(pp, 'y = x', -2.3, -1.55, color('--ink-3'), 13, 'center');
            haloText(pp.ctx, `(${fmt(x, 3)}, ${fmt(y, 3)})`, pp.sx(x) + 9, pp.sy(y) + 4, P, mono(11), 'left', 'top');
            haloText(pp.ctx, `(${fmt(y, 3)}, ${fmt(x, 3)})`, pp.sx(y) - 8, pp.sy(x) - 5, T, mono(11), 'right', 'bottom');
          },
        });
        const eRo = f.readout('exp(x)');
        const lRo = f.readout('log(exp(x))');
        f.slider({
          label: 'x',
          sym: 'x',
          min: -3,
          max: 1.65,
          step: 0.05,
          value: 1,
          format: (v) => fmt(v, 3),
          onInput: (v) => {
            x = v;
            sync();
          },
        });
        const sync = () => {
          const y = Math.exp(x);
          f.code.setMany({ x: pyf(x, 3), y: pyf(y, 4), back: pyf(Math.round(x * 1000) / 1000, 3) });
          f.code.highlight(['exp', 'log']);
          eRo.set(y);
          lRo.set(Math.round(x * 1000) / 1000);
          pl.redraw();
        };
        sync();
      },
      caption: `The purple point sits on $y = e^{\\symx}$; the teal point is its mirror image across the dashed diagonal, so it sits on $y = \\log x$ with the coordinates swapped. Slide $\\symx$ to 0: $e^0 = 1$ and $\\log 1 = 0$. Slide it down to $-3$: $e^{-3} \\approx 0.05$, and the teal point shows that the log of a small positive number is a large negative one. Slide it up and watch the purple point race off the top while the teal one barely climbs: the log grows very slowly.`,
    });

    p.math({
      label: 'Logs turn products into sums',
      tex: String.raw`\begin{gathered} \log(a\,b) = \log a + \log b \\[4pt] \log \prod_{i} p_i = \sum_{i} \log p_i \end{gathered}`,
      code: `
        p = np.full(400, 0.1)  # 400 probabilities
        np.prod(p)             # 0.0: 1e-400 underflows
        np.sum(np.log(p))      # -921.03..., no problem
      `,
      terms: [
        [String.raw`\log(a\,b)`, 'the log of a product...'],
        [String.raw`\log a + \log b`, '...is the sum of the logs'],
        [String.raw`\log\prod_i p_i = \sum_i \log p_i`, 'so a long product of probabilities becomes a long sum of log-probabilities'],
      ],
      explain: 'This is why log-probabilities are everywhere in machine learning. Multiplying hundreds of probabilities produces numbers too small for a computer to store (the smallest positive 64-bit float is about $5 \\times 10^{-324}$), while adding their logs is perfectly safe. Sums are also much easier to differentiate than products. And because $\\log$ always increases when its input increases, making $\\log p$ as large as possible is the same as making $p$ as large as possible, so nothing is lost by switching.',
    });

    // ------------------------------------------------------------------ derivatives
    p.h2('Slope and the derivative', 'derivatives');
    p.prose(`
The **slope** of a straight line is rise over run: how far it goes up for each step to the right. The line $y = 2x + 1$ climbs 2 for every 1 across, so its slope is 2 everywhere.

A curve has a different steepness at every point. The **derivative** of $\\symf$ at $\\symx$, written $\\frac{d\\symf}{d\\symx}$ or $\\symf'(\\symx)$, is the slope right there: if you nudge the input by a tiny amount, how many times that amount does the output move? Positive means the function is rising, negative means it is falling, and zero means it is flat (as at the bottom of a valley).

You can measure it with nothing but the function itself: evaluate it at two nearby points and divide the rise by the run. The straight line through those two points is called a **secant**. Shrink the gap $\\symh$ between them and the secant swings into the **tangent**, the line that just grazes the curve at $\\symx$; its slope settles on the derivative.`);
    p.math({
      label: 'The derivative',
      tex: String.raw`\frac{d\symf}{d\symx} = \lim_{\symh \to 0}\; \frac{\symf(\symx + \symh) - \symf(\symx)}{\symh}`,
      code: `
        def f(x):
            return x ** 2

        x, h = 3.0, 1e-5
        slope = (f(x + h) - f(x)) / h
        print(slope)   # 6.000009999951316
        # exact, by the power rule: 2 * x = 6.0
      `,
      terms: [
        [String.raw`\frac{d\symf}{d\symx}`, '"d f d x": the derivative of $\\symf$ with respect to $\\symx$. Not a real fraction, but it behaves like the ratio of a tiny change in output to a tiny change in input'],
        [String.raw`\symf(\symx+\symh) - \symf(\symx)`, 'the rise: how much the output moved'],
        [String.raw`\symh`, 'the run: how far the input was nudged'],
        [String.raw`\lim_{\symh\to 0}`, '"the limit as $\\symh$ goes to 0": the value the ratio settles on as $\\symh$ shrinks toward zero'],
      ],
      explain: 'With a small but finite $\\symh$, the fraction is called a **finite-difference approximation**, and it is how CS231n checks gradients: compute the slope straight from this definition and compare it with the formula you derived by hand. Chapter 5 calls this the *numerical gradient*.',
    });
    p.math({
      label: 'The centered difference',
      tex: String.raw`\frac{d\symf}{d\symx} \approx \frac{\symf(\symx + \symh) - \symf(\symx - \symh)}{2\symh}`,
      code: `
        slope = (f(x + h) - f(x - h)) / (2 * h)
        print(slope)   # 6.000000000039306
        # error about 4e-11, instead of 1e-5
      `,
      terms: [
        [String.raw`\symf(\symx+\symh) - \symf(\symx-\symh)`, 'step the same distance to both sides of $\\symx$'],
        [String.raw`2\symh`, 'so the run is twice as long'],
      ],
      explain: 'Looking both ways cancels most of the error. The one-sided version is off by an amount roughly proportional to $\\symh$; the centered one by an amount roughly proportional to $\\symh^2$, which is far smaller when $\\symh$ is small. The course\'s gradient checks use the centered formula with $\\symh$ around $10^{-5}$.',
    });

    p.figure({
      title: 'From secant to tangent',
      codeTitle: 'finite_difference.py',
      code: `
        def f(x):
            return {{expr:x ** 2}}

        x = {{x:1.0}}
        h = {{h:0.5}}
        forward = (f(x + h) - f(x)) / h              # {{fwd}}   #@fwd
        centered = (f(x + h) - f(x - h)) / (2 * h)   # {{ctr}}   #@ctr
        exact = {{dexpr:2 * x}}   # {{exact}}, from the rules below
      `,
      setup(f) {
        type K = 'sq' | 'exp' | 'log' | 'relu';
        const FN: Record<K, { expr: string; dexpr: string; label: string; fn: (x: number) => number; df: (x: number) => number; dom: [number, number, number, number]; lo: number; hi: number }> = {
          sq: { expr: 'x ** 2', dexpr: '2 * x', label: 'x²', fn: (x) => x * x, df: (x) => 2 * x, dom: [-3, 3, -2, 9.4], lo: -2.6, hi: 2.6 },
          exp: { expr: 'np.exp(x)', dexpr: 'np.exp(x)', label: 'eˣ', fn: Math.exp, df: Math.exp, dom: [-3, 2.4, -1.5, 8.5], lo: -2.6, hi: 1.9 },
          log: { expr: 'np.log(x)', dexpr: '1 / x', label: 'log x', fn: (x) => (x > 0 ? Math.log(x) : NaN), df: (x) => 1 / x, dom: [-0.4, 4.6, -3.6, 2.4], lo: 0.15, hi: 4.2 },
          relu: { expr: 'np.maximum(0, x)', dexpr: '1.0 if x > 0 else 0.0', label: 'max(0, x)', fn: (x) => Math.max(0, x), df: (x) => (x > 0 ? 1 : 0), dom: [-3, 3, -1.4, 3.4], lo: -2.6, hi: 2.6 },
        };
        let k: K = 'sq';
        let x = 1;
        let h = 0.5;
        let centered = false;
        const F = () => FN[k];
        const pts = () => {
          const fn = F().fn;
          const x1 = centered ? x - h : x;
          const x2 = x + h;
          return { x1, y1: fn(x1), x2, y2: fn(x2) };
        };
        const pl = f.plot({
          aspect: 1.2,
          square: false,
          domain: FN.sq.dom,
          draw: (pp) => {
            pp.ctx.font = mono(11, 400); // axes() keeps the current font for its labels
            pp.axes({ grid: 1, labels: true });
            const fn = F().fn;
            const P = color('purple'), B = color('blue'), T = color('teal'), O = color('orange');
            pp.fn(fn, withAlpha(P, 0.85), 2.5);
            const [v0, v1] = pp.view();
            const y0 = fn(x);
            const d = F().df(x);
            pp.path([v0, v1], [y0 + d * (v0 - x), y0 + d * (v1 - x)], withAlpha(T, 0.95), 2, [7, 5]);
            const { x1, y1, x2, y2 } = pts();
            if (Number.isFinite(y1) && Number.isFinite(y2)) {
              const s = (y2 - y1) / (x2 - x1);
              pp.path([v0, v1], [y1 + s * (v0 - x1), y1 + s * (v1 - x1)], B, 2);
              pp.path([x1, x2, x2], [y1, y1, y2], withAlpha(color('--ink-2'), 0.8), 1.2);
              const c = pp.ctx;
              haloText(c, centered ? '2h' : 'h', pp.sx((x1 + x2) / 2), pp.sy(y1) + (y2 >= y1 ? 11 : -11), color('slate'), ital(14), 'center');
              if (Math.abs(pp.sy(y2) - pp.sy(y1)) > 16) haloText(c, 'rise', pp.sx(x2) + 6, (pp.sy(y1) + pp.sy(y2)) / 2, color('--ink-2'), ui(11), 'left');
              pp.dot(x1, y1, 5, B, color('--paper'));
              pp.dot(x2, y2, 5, B, color('--paper'));
            }
            pp.dot(x, y0, 6, O, color('--paper'));
            haloText(pp.ctx, 'secant', pp.w - 10, pp.h - 30, B, ui(12, 600), 'right');
            haloText(pp.ctx, 'tangent (exact slope)', pp.w - 10, pp.h - 14, T, ui(12, 600), 'right');
          },
        });
        const secRo = f.readout('secant slope');
        const exRo = f.readout('exact');
        const errRo = f.readout('error');
        const sync = () => {
          const fn = F().fn;
          const fwd = (fn(x + h) - fn(x)) / h;
          const ctr = (fn(x + h) - fn(x - h)) / (2 * h);
          const ex = F().df(x);
          const sl = centered ? ctr : fwd;
          f.code.setMany({ expr: F().expr, dexpr: F().dexpr, x: pyf(x, 3), fwd: pyf(fwd, 5), ctr: pyf(ctr, 5), exact: pyf(ex, 5) });
          f.code.highlight(centered ? 'ctr' : 'fwd');
          secRo.set(Number.isFinite(sl) ? fmt(sl, 4) : 'nan');
          exRo.set(fmt(ex, 4));
          errRo.set(Number.isFinite(sl) ? fmt(Math.abs(sl - ex), 2) : '–');
          f.status(!Number.isFinite(sl) ? 'The secant needs log of a number at or below 0, which does not exist: NumPy gives `nan`. Shrink h or move x right.' : k === 'relu' && Math.abs(x) < 1e-9 ? 'At exactly x = 0 the ReLU has a corner, so there is no single slope. Code picks 0 by convention, and the finite differences disagree with it and with each other.' : '');
          pl.redraw();
        };
        dragNearest(pl, () => [[x, F().fn(x)]], (_, mx) => {
          x = clamp(snap(mx, 0.05), F().lo, F().hi);
          sync();
        });
        f.segmented({
          label: 'f(x) =',
          options: (Object.keys(FN) as K[]).map((key) => ({ value: key, label: FN[key].label })),
          value: 'sq',
          onChange: (v) => {
            k = v;
            x = clamp(x, F().lo, F().hi);
            if (k === 'log' && x < 0.5) x = 1;
            pl.setDomain(...F().dom);
            sync();
          },
        });
        f.slider({ label: 'h', sym: 'h', min: -3, max: 0.3, step: 0.01, value: Math.log10(0.5), map: (r) => Math.pow(10, r), format: (v) => fmt(v, 2), slot: 'h', onInput: (v) => { h = v; sync(); } });
        f.toggle({ label: 'centered difference', value: false, onChange: (v) => { centered = v; sync(); } });
        sync();
      },
      caption: `The blue line is the secant through two points on the curve; the dashed teal line is the tangent, whose slope is the exact derivative. **Drag** to move $\\symx$ (the orange point) and slide $\\symh$ down: the secant swings onto the tangent and the error collapses. Turn on **centered difference** and compare the errors at the same $\\symh$: for $\\symx^2$ the centered version is exact for every $\\symh$, a happy accident of parabolas. For the ReLU, park $\\symx$ at exactly 0 to meet its corner.`,
    });

    p.prose(`
### The handful of rules you need

Finite differences are for *checking*. For actual training we want exact derivatives, and a short list of rules covers nearly everything in this course. Combined with the chain rule below, they can differentiate any network you will meet.`);
    p.table(
      ['Function', 'Its derivative', 'In words'],
      rows(String.raw`
$c$ (a constant) | $0$ | a flat line has no slope
$x^n$ | $n\,x^{n-1}$ | the power rule: $x^2 \to 2x$, $x^3 \to 3x^2$, $x \to 1$
$c\,f(x)$ | $c\,f'(x)$ | constant multiples come along for the ride
$f(x) + g(x)$ | $f'(x) + g'(x)$ | the slope of a sum is the sum of the slopes
$e^{x}$ | $e^{x}$ | the exponential is its own slope
$\log x$ | $1/x$ | steep near 0, flattening as $x$ grows
$\max(0, x)$ | $1$ if $x > 0$, else $0$ | the ReLU: slope 1 on the right, 0 on the left`),
      { caption: 'For example, $f(x) = 3x^2 + 5x + 2$ has $f\'(x) = 6x + 5$: the power rule on each term, the constant multiples carried along, the sum split up, and the constant 2 dropped.' },
    );
    p.code(`
      def d_power(x, n): return n * x ** (n - 1)
      def d_exp(x):      return np.exp(x)
      def d_log(x):      return 1 / x           # for x > 0
      def d_relu(x):     return 1.0 * (x > 0)   # 0 at the corner

      d_power(3.0, 2)    # 6.0, the slope of x ** 2 at x = 3
      d_relu(np.array([-2.0, 0.0, 1.5]))   # [0. 0. 1.]
    `, { title: 'derivative_rules.py' });
    p.callout('warning', 'At exactly $x = 0$, $\\max(0, x)$ has a corner and no single slope. Code simply picks a side (usually 0). It almost never matters in practice, but a numerical gradient check whose two probe points straddle such a corner can disagree with your formula. Chapter 9 calls these *kinks*.', 'Corners');

    // ------------------------------------------------------------------ gradient
    p.h2('Partial derivatives and the gradient', 'gradient');
    p.prose(`
The loss in this course is a function of *all* the weights at once: thousands or millions of inputs. The derivative extends to that case with no new machinery. To get the slope with respect to one input, **nudge just that input** and freeze all the others. That is a **partial derivative**, written with a curly $\\partial$ (say "partial") as a reminder that other inputs exist.

Take $\\symf(\\symx, y) = \\symx^2 + 3y^2$. Freeze $y$, so $3y^2$ is just a constant, and use the rules: $\\frac{\\partial \\symf}{\\partial \\symx} = 2\\symx$. Freeze $\\symx$ instead: $\\frac{\\partial \\symf}{\\partial y} = 6y$.`);
    p.math({
      label: 'Partial derivatives',
      tex: String.raw`\frac{\partial \symf}{\partial \symx} = \lim_{\symh\to 0}\frac{\symf(\symx + \symh,\; y) - \symf(\symx,\; y)}{\symh}`,
      code: `
        def f(x, y):
            return x ** 2 + 3 * y ** 2

        x, y, h = 1.0, 2.0, 1e-5
        df_dx = (f(x + h, y) - f(x, y)) / h
        df_dy = (f(x, y + h) - f(x, y)) / h
        # df_dx = 2.00001...   exact: 2x = 2
        # df_dy = 12.00003...  exact: 6y = 12
      `,
      terms: [
        [String.raw`\partial`, '"partial": a derivative with respect to one input among several'],
        [String.raw`\symf(\symx+\symh,\; y)`, 'only $\\symx$ moves; $y$ stays exactly where it was'],
      ],
      explain: 'The same recipe as before, applied to one input at a time. A function of $D$ inputs has $D$ partial derivatives, one per input.',
    });
    p.math({
      label: 'The gradient',
      tex: String.raw`\symgrad(\symx, y) = \begin{bmatrix} \dfrac{\partial \symf}{\partial \symx} \\[10pt] \dfrac{\partial \symf}{\partial y} \end{bmatrix} = \begin{bmatrix} 2\symx \\[4pt] 6y \end{bmatrix}`,
      code: `
        grad = np.array([2 * x, 6 * y])  # [2., 12.]

        # grad points uphill: step the other way
        lr = 0.1
        x, y = x - lr * grad[0], y - lr * grad[1]
      `,
      terms: [
        [String.raw`\symgrad`, '"nabla f", often read "grad f": the gradient of $\\symf$'],
        [String.raw`\begin{bmatrix}\cdot\\\cdot\end{bmatrix}`, 'a column vector holding the partial derivatives, one entry per input'],
      ],
      explain: 'The gradient has one entry per input, so it always has the same shape as whatever you differentiate with respect to: the gradient of the loss with respect to a $(10, 3073)$ weight matrix is itself a $(10, 3073)$ array (the assignments call it `dW`). And it has a beautiful meaning: it **points in the direction of steepest ascent**, with a length that says how steep that is. So $-\\symgrad$ points straight *downhill*, and taking small steps along $-\\symgrad$ is **gradient descent**, the engine of all training (Chapter 5).',
    });

    p.figure({
      title: 'The gradient points uphill',
      codeTitle: 'gradient.py',
      code: `
        def f(x, y):
            return x ** 2 + 3 * y ** 2

        x, y = {{x:1.6}}, {{y:0.7}}      # f = {{fv}}
        df_dx = 2 * x                    # {{dx}}   #@px
        df_dy = 6 * y                    # {{dy}}   #@py
        grad = np.array([df_dx, df_dy])  # uphill   #@grad

        lr = {{lr:0.1}}
        x, y = x - lr * df_dx, y - lr * df_dy   # downhill   #@step
      `,
      setup(f) {
        let P = [1.6, 0.7];
        let lr = 0.1;
        let showNeg = true;
        const trail: number[][] = [];
        const fv = (a: number, b: number) => a * a + 3 * b * b;
        const S = 0.15;
        const pl = f.plot({
          aspect: 1.45,
          domain: [-3, 3, -2, 2],
          draw: (pp) => {
            const paper = rgbOf(color('--paper'));
            const tint = rgbOf(color('blue'));
            pp.field((a, b) => {
              const t = Math.min(1, fv(a, b) / 22);
              const m = 0.04 + 0.42 * t;
              return [paper[0] * (1 - m) + tint[0] * m, paper[1] * (1 - m) + tint[1] * m, paper[2] * (1 - m) + tint[2] * m, 255];
            }, 5);
            const c = pp.ctx;
            const vy1 = pp.view()[3];
            for (const lev of [0.5, 1.5, 3, 5, 7.5, 10.5, 14, 18, 23]) {
              c.beginPath();
              c.ellipse(pp.sx(0), pp.sy(0), pp.len(Math.sqrt(lev)), pp.len(Math.sqrt(lev / 3)), 0, 0, Math.PI * 2);
              c.strokeStyle = withAlpha(color('--ink-2'), 0.32);
              c.lineWidth = 1;
              c.stroke();
              const ly = Math.sqrt(lev / 3);
              if (ly < vy1 - 0.15 && lev >= 1.5) haloText(c, fmt(lev, 3), pp.sx(0), pp.sy(ly), color('--ink-3'), mono(11), 'center', 'middle');
            }
            pp.dot(0, 0, 3, color('--ink-3'));
            if (trail.length > 1) pp.path(trail.map((q) => q[0]!), trail.map((q) => q[1]!), withAlpha(color('red'), 0.85), 1.5);
            for (const q of trail) pp.dot(q[0]!, q[1]!, 2.5, color('red'));
            const [x, y] = P as [number, number];
            const dx = 2 * x, dy = 6 * y;
            // the contour through P: perpendicular to the gradient
            const g = Math.hypot(dx, dy);
            if (g > 1e-9) {
              const tx = -dy / g, ty = dx / g;
              pp.path([x - tx * 0.55, x + tx * 0.55], [y - ty * 0.55, y + ty * 0.55], withAlpha(color('--ink'), 0.55), 1.5);
            }
            pp.arrow(x, y, x + S * dx, y, withAlpha(color('orange'), 0.95), 2);
            pp.arrow(x + S * dx, y, x + S * dx, y + S * dy, withAlpha(color('gold'), 0.95), 2);
            if (showNeg) pp.arrow(x, y, x - S * dx, y - S * dy, color('red'), 2.5);
            pp.arrow(x, y, x + S * dx, y + S * dy, color('teal'), 3.5);
            pp.dot(x, y, 6, color('--ink'), color('--paper'));
            const lab = (s: string, a: number, b: number, col: string) => haloText(c, s, pp.sx(a), pp.sy(b), col, ital(14), 'center');
            if (Math.abs(dx) * S > 0.25) lab('∂f/∂x', x + (S * dx) / 2, y - (dy >= 0 ? 0.2 : -0.2), color('orange'));
            if (Math.abs(dy) * S > 0.25) lab('∂f/∂y', x + S * dx + (dx >= 0 ? 0.42 : -0.42), y + (S * dy) / 2, color('gold'));
            const gx = g > 1e-9 ? dx / g : 0, gy = g > 1e-9 ? dy / g : 0;
            if (g * S > 0.15) lab('∇f', x + S * dx + gx * 0.3, y + S * dy + gy * 0.3, color('teal'));
            if (showNeg && g * S > 0.15) lab('−∇f', x - S * dx - gx * 0.32, y - S * dy - gy * 0.32, color('red'));
          },
        });
        const fRo = f.readout('f(x, y)', { sym: 'f' });
        const dxRo = f.readout('∂f/∂x');
        const dyRo = f.readout('∂f/∂y');
        const sync = () => {
          const [x, y] = P as [number, number];
          f.code.setMany({ x: pyf(x, 3), y: pyf(y, 3), fv: pyf(fv(x, y), 4), dx: pyf(2 * x, 4), dy: pyf(6 * y, 4) });
          fRo.set(fv(x, y));
          dxRo.set(2 * x);
          dyRo.set(6 * y);
          pl.redraw();
        };
        dragNearest(pl, () => [[P[0]!, P[1]!]], (_, mx, my) => {
          P = [clamp(snap(mx, 0.1), -2.9, 2.9), clamp(snap(my, 0.1), -1.9, 1.9)];
          trail.length = 0;
          f.code.highlight(['px', 'py', 'grad']);
          sync();
        });
        f.slider({ label: 'step size', min: 0.02, max: 0.4, step: 0.01, value: 0.1, slot: 'lr', format: (v) => fmt(v, 2), onInput: (v) => { lr = v; } });
        f.toggle({ label: 'show −∇f (downhill)', value: true, onChange: (v) => { showNeg = v; pl.redraw(); } });
        f.button('Step downhill', () => {
          if (!trail.length) trail.push([...P]);
          const [x, y] = P as [number, number];
          P = [x - lr * 2 * x, y - lr * 6 * y];
          if (Math.abs(P[0]!) > 50 || Math.abs(P[1]!) > 50) P = [clamp(P[0]!, -50, 50), clamp(P[1]!, -50, 50)];
          trail.push([...P]);
          f.code.highlight('step');
          sync();
        }, { primary: true });
        f.button('Reset', () => {
          P = [1.6, 0.7];
          trail.length = 0;
          f.code.highlight(null);
          sync();
        });
        sync();
      },
      caption: `Each oval is a **contour**: every point on it has the same value of $\\symf$, like the lines on a hiking map (a stronger tint means higher). **Drag** the point. The orange and gold arrows are the two partial derivatives, how steep the ground is going straight right and straight up; placed tip to tail they add up to the gradient (teal), exactly like the vector sum earlier. The gradient always crosses the contour at a right angle, pointing straight uphill. Press **Step downhill** a few times to follow $-\\symgrad$ to the bottom. Then raise the step size above about 0.33 and step again: the steps overshoot the valley and zigzag outward, a first taste of why the learning rate matters.`,
    });

    // ------------------------------------------------------------------ chain rule
    p.h2('The chain rule', 'chain-rule');
    p.prose(`
Neural networks are pipelines: the output of one function feeds the next, many times over. The **chain rule** says how a change at the start ripples through to the end, and the answer is pleasingly simple: **the rates multiply.**

Think of a train of gears. If gear $u$ turns 3 times for every turn of gear $\\symx$, and gear $v$ turns 4 times for every turn of $u$, then $v$ turns $3 \\times 4 = 12$ times for every turn of $\\symx$. Each gear only needs to know its own ratio to its neighbor.`);
    p.math({
      label: 'The chain rule',
      tex: String.raw`\frac{dz}{d\symx} = \frac{dz}{dv}\cdot\frac{dv}{du}\cdot\frac{du}{d\symx}`,
      code: `
        # a pipeline:  x -> u -> v -> z
        u = 3 * x + 1     # du/dx = 3
        v = u ** 2        # dv/du = 2u   (power rule)
        z = np.log(v)     # dz/dv = 1/v  (log rule)

        # multiply the local rates:
        dz_dx = (1 / v) * (2 * u) * 3
      `,
      terms: [
        [String.raw`\frac{du}{d\symx}`, 'the first stage\'s local rate: how fast $u$ moves when $\\symx$ moves'],
        [String.raw`\frac{dv}{du}`, 'the second stage\'s rate, computed as if $u$ were its only input'],
        [String.raw`\frac{dz}{dv}`, 'the last stage\'s rate'],
        [String.raw`\frac{dz}{d\symx}`, 'the rate from start to finish: their product'],
      ],
      explain: 'The notation is designed so that the $du$ and $dv$ seem to cancel like fractions, which is a handy way to remember the order. The key point is that each stage computes its own rate *locally*, knowing nothing about the rest of the pipeline. **Backpropagation** (Chapter 6) is nothing more than the chain rule applied one stage at a time, starting at the loss and walking backward, multiplying as it goes.',
    });

    p.figure({
      title: 'The chain rule: rates multiply through a pipeline',
      codeTitle: 'chain_rule.py',
      code: `
        x = {{x:1.0}}
        u = 3 * x + 1      # {{u}}     #@f1
        v = u ** 2         # {{v}}     #@f2
        z = np.log(v)      # {{z}}     #@f3

        # local rates: each stage only knows its own
        du_dx = 3                       #@r1
        dv_du = 2 * u      # {{r2}}     #@r2
        dz_dv = 1 / v      # {{r3}}     #@r3

        dz_dx = dz_dv * dv_du * du_dx   # {{total}}   #@total
        # check: (z(x + 1e-5) - z(x)) / 1e-5 = {{check}}
      `,
      setup(f) {
        let x = 1;
        let step = 0;
        let backward = false;
        const angles = [0, 0, 0, 0];
        const vals = () => {
          const u = 3 * x + 1;
          const v = u * u;
          return { u, v, z: Math.log(v) };
        };
        const cv = f.canvas(640, 380, (ctx, w, h) => {
          const { u, v, z } = vals();
          const rates = [3, 2 * u, 1 / v];
          const fwdAcc = [1, 3, 6 * u, 6 / u];
          const bwdAcc = [6 / u, 2 / u, 1 / v, 1];
          const names = ['x', 'u', 'v', 'z'];
          const values = [x, u, v, z];
          const cols = [color('orange'), color('slate'), color('slate'), color('purple')];
          const ops = ['3x + 1', 'u²', 'log v'];
          const cxs = [0.12, 0.373, 0.627, 0.88].map((t) => t * w);
          const fs = Math.max(11, Math.min(14, w / 40));
          const gr = Math.min(h * 0.1, w * 0.052);
          const gy = h * 0.03 + gr;
          // gears
          for (let i = 0; i < 4; i++) gear(ctx, cxs[i]!, gy, gr, angles[i]!, cols[i]!);
          // op labels between gears
          for (let i = 0; i < 3; i++) {
            const mx = (cxs[i]! + cxs[i + 1]!) / 2;
            pxArrow(ctx, cxs[i]! + gr + 6, gy, cxs[i + 1]! - gr - 6, gy, withAlpha(color('--ink-3'), 0.7), 1.2, 6);
            haloText(ctx, ops[i]!, mx, gy - 11, color('--ink-2'), mono(Math.max(11, fs - 1)), 'center');
          }
          // value boxes
          const bw = Math.min(w * 0.19, 104);
          const bh = Math.max(38, h * 0.17);
          const by = gy + gr + 8;
          for (let i = 0; i < 4; i++) {
            const x0 = cxs[i]! - bw / 2;
            ctx.beginPath();
            ctx.roundRect(x0, by, bw, bh, 10);
            ctx.fillStyle = withAlpha(cols[i]!, 0.1);
            ctx.fill();
            ctx.strokeStyle = withAlpha(cols[i]!, 0.7);
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = cols[i]!;
            ctx.font = ital(fs + 3);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(names[i]!, cxs[i]!, by + bh * 0.3);
            ctx.fillStyle = color('--ink');
            ctx.font = mono(fs, 500);
            ctx.fillText(fmt(values[i]!, 3), cxs[i]!, by + bh * 0.72);
          }
          // accumulated-rate row
          const pw = Math.min(w * 0.17, 92);
          const ph = Math.max(26, h * 0.085);
          const ry = by + bh + Math.max(24, h * 0.09) + ph / 2;
          const acc = backward ? bwdAcc : fwdAcc;
          const shown = (i: number) => (backward ? 3 - i <= step : i <= step);
          for (let i = 0; i < 4; i++) {
            const lbl = backward ? `dz/d${names[i]}` : `d${names[i]}/dx`;
            haloText(ctx, lbl, cxs[i]!, ry - ph / 2 - 9, color('teal'), ital(Math.max(12, fs)), 'center');
            const on = shown(i);
            const fresh = on && (backward ? 3 - i === step : i === step) && step < 4;
            cellBox(ctx, cxs[i]! - pw / 2, ry - ph / 2, pw, ph, on ? fmt(acc[i]!, 3) : '?', color('teal'), { on: fresh, dim: !on, size: fs, radius: 8 });
          }
          for (let i = 0; i < 3; i++) {
            const mx = (cxs[i]! + cxs[i + 1]!) / 2;
            const lit = backward ? step >= 3 - i : step >= i + 1;
            const a0 = backward ? cxs[i + 1]! - pw / 2 - 3 : cxs[i]! + pw / 2 + 3;
            const a1 = backward ? cxs[i]! + pw / 2 + 3 : cxs[i + 1]! - pw / 2 - 3;
            pxArrow(ctx, a0, ry, a1, ry, withAlpha(color('teal'), lit ? 0.9 : 0.25), 1.5, 6);
            haloText(ctx, `×${fmt(rates[i]!, 3)}`, mx, ry + ph / 2 + 4, lit ? color('--ink') : color('--ink-3'), mono(Math.max(11, fs - 1), 600), 'center', 'top');
          }
          // summary
          let msg: string;
          const r = rates.map((q) => fmt(q, 3));
          if (step === 0) msg = backward ? 'start at the output: dz/dz = 1' : 'start at the input: dx/dx = 1';
          else if (!backward) msg = step === 1 ? `du/dx = ${r[0]}` : step === 2 ? `dv/dx = ${r[0]} × ${r[1]} = ${fmt(6 * u, 3)}` : `dz/dx = ${r[0]} × ${r[1]} × ${r[2]} = ${fmt(6 / u, 3)}`;
          else msg = step === 1 ? `dz/dv = ${r[2]}` : step === 2 ? `dz/du = ${r[2]} × ${r[1]} = ${fmt(2 / u, 3)}` : `dz/dx = ${r[2]} × ${r[1]} × ${r[0]} = ${fmt(6 / u, 3)}`;
          if (step === 4) msg = `both orders agree: dz/dx = ${fmt(6 / u, 4)}`;
          haloText(ctx, msg, w / 2, h - 12, color('--ink-2'), mono(Math.max(11, Math.min(13, w / 44)), 600), 'center');
        });
        const highlightFor = () => {
          if (step === 0) f.code.highlight(['f1', 'f2', 'f3']);
          else if (step === 4) f.code.highlight('total');
          else f.code.highlight(backward ? ['r3', 'r2', 'r1'][step - 1]! : ['r1', 'r2', 'r3'][step - 1]!);
        };
        const sync = () => {
          const { u, v, z } = vals();
          const zz = (t: number) => Math.log((3 * t + 1) ** 2);
          f.code.setMany({
            x: pyf(x, 3), u: pyf(u, 4), v: pyf(v, 4), z: pyf(z, 4),
            r2: pyf(2 * u, 4), r3: pyf(1 / v, 4), total: pyf(6 / u, 4),
            check: pyf((zz(x + 1e-5) - zz(x)) / 1e-5, 6),
          });
          highlightFor();
          cv.redraw();
        };
        f.slider({ label: 'x', sym: 'x', min: 0, max: 1.5, step: 0.05, value: 1, format: (v) => fmt(v, 3), onInput: (v) => { x = v; sync(); } });
        f.segmented({
          label: 'multiply',
          options: [
            { value: 'fwd', label: 'forward' },
            { value: 'bwd', label: 'backward (backprop)' },
          ],
          value: 'fwd',
          onChange: (v) => {
            backward = v === 'bwd';
            stepper.go(0);
          },
        });
        const stepper = f.stepper({
          steps: 5,
          interval: 1100,
          label: (k) => ['values', 'stage 1', 'stage 2', 'stage 3', 'result'][k]!,
          onStep: (k) => {
            step = k;
            sync();
          },
        });
        f.loop((dt) => {
          const { u } = vals();
          const speed = [1, 3, 6 * u, 6 / u];
          for (let i = 0; i < 4; i++) angles[i] = (angles[i]! + dt * 0.35 * Math.min(speed[i]!, 30)) % (Math.PI * 2);
          cv.redraw();
        }).start();
        sync();
      },
      caption: `The gears spin at speeds proportional to how fast each value changes while $\\symx$ turns steadily: $u$ always runs exactly 3 times as fast as $\\symx$, while $v$ and $z$ speed up or slow down as you slide $\\symx$, because their local rates depend on where they are. Step through the multiplication **forward** (building $du/dx$, $dv/dx$, $dz/dx$ from the left) or **backward** (building $dz/dv$, $dz/du$, $dz/dx$ from the right). Both arrive at the same number, and the code checks it against a finite difference. Backward is the order backpropagation uses: one sweep from the output gives the rate of the output with respect to *every* value in the pipeline.`,
    });

    // ------------------------------------------------------------------ probability
    p.h2('Probability basics', 'probability');
    p.prose(`
A **probability** is a number between 0 and 1 saying how likely something is: 0 means never, 1 means certainly. A **probability distribution** over a set of outcomes gives each outcome one such number, and those numbers add up to exactly 1, because *something* has to happen.

The softmax classifier in Chapter 4 outputs exactly this: a distribution over the ten classes, such as "cat 0.7, dog 0.2, ship 0.1".`);
    p.code(`
      p = np.array([0.7, 0.2, 0.1])   # cat, dog, ship

      np.all(p >= 0)            # True: no negative probabilities
      np.isclose(p.sum(), 1.0)  # True: they add up to 1
      np.argmax(p)              # 0: the most likely class, "cat"
      np.random.choice(3, p=p)  # draw a class: 0 about 70% of the time
    `, { title: 'distribution.py' });
    p.prose(`
### Mean, variance and standard deviation

For a pile of numbers (measurements, pixel values, random samples), two summaries matter most. The **mean** $\\symmu$ says where they are centered. The **variance** $\\symsigma^2$ is the average *squared* distance from the mean, and its square root, the **standard deviation** $\\symsigma$, is a typical distance from the mean in the original units: how spread out the numbers are.`);
    p.math({
      label: 'Mean and standard deviation',
      tex: String.raw`\begin{gathered} \symmu = \frac{1}{N}\sum_{i} \symx_i \\[6pt] \symsigma^2 = \frac{1}{N}\sum_{i} \big(\symx_i - \symmu\big)^2 \end{gathered}`,
      code: `
        x = np.array([2., 4., 4., 4., 5., 5., 7., 9.])
        mu = x.mean()                  # 5.0
        var = np.mean((x - mu) ** 2)   # 4.0
        sigma = np.sqrt(var)           # 2.0
        x.std()                        # 2.0, the same
      `,
      terms: [
        [String.raw`\symmu`, 'the mean: the balance point of the numbers'],
        [String.raw`\symx_i - \symmu`, 'how far each number sits from the mean'],
        [String.raw`\big(\cdot\big)^2`, 'squared, so distances below and above the mean both count as positive'],
        [String.raw`\symsigma^2`, 'the variance: the mean of those squared distances. Its square root $\\symsigma$ ("sigma") is the standard deviation'],
      ],
      explain: 'These two numbers come back in Chapter 8: preprocessing shifts and scales each input so it has mean 0 and standard deviation 1, and *batch normalization* does the same to the values inside a network, using exactly these formulas.',
    });
    p.prose(`
### The Gaussian (normal) distribution

Many quantities pile up in a bell shape: lots of values near the middle, fewer and fewer further out. This is the **Gaussian**, or **normal**, distribution, and it has exactly two knobs: the mean $\\symmu$ (where the peak sits) and the standard deviation $\\symsigma$ (how wide the bell is). About 68% of samples land within one $\\symsigma$ of the mean, and about 95% within two.

\`np.random.randn(N)\` draws $N$ samples from the *standard* normal, with $\\symmu = 0$ and $\\symsigma = 1$. To get any other bell, stretch and shift: \`mu + sigma * np.random.randn(N)\`. The course uses this constantly to fill weight matrices with small random numbers, as in \`W = 0.01 * np.random.randn(D, H)\`.`);

    p.figure({
      title: 'Sampling from a Gaussian',
      codeTitle: 'gaussian.py',
      code: `
        mu, sigma = {{mu:0}}, {{sigma:1}}
        N = {{n:1000}}
        samples = mu + sigma * np.random.randn(N)   #@draw

        samples.mean()   # {{m}}  (close to mu)
        samples.std()    # {{s}}  (close to sigma)
        inside = np.abs(samples - mu) < sigma
        inside.mean()    # {{w1}}  (about 0.68)

        plt.hist(samples, 48, (-6, 6), density=True)
        xs = np.linspace(-6, 6, 200)
        pdf = np.exp(-(xs - mu)**2 / (2 * sigma**2))
        plt.plot(xs, pdf / (sigma * np.sqrt(2 * np.pi)))
      `,
      setup(f) {
        const rng = new Rng(7);
        const z: number[] = [];
        let mu = 0;
        let sigma = 1;
        const add = (n: number) => {
          for (let i = 0; i < n; i++) z.push(rng.randn());
        };
        add(1000);
        const pl = f.plot({
          aspect: 1.55,
          square: false,
          domain: [-6.3, 6.3, -0.05, 0.5],
          draw: (pp) => {
            const bins = 48, lo = -6, bw = 0.25;
            const counts = new Array(bins).fill(0) as number[];
            for (const q of z) {
              const s = mu + sigma * q;
              const b = Math.floor((s - lo) / bw);
              if (b >= 0 && b < bins) counts[b]!++;
            }
            const N = Math.max(1, z.length);
            const dens = counts.map((c) => c / (N * bw));
            const peak = 1 / (sigma * Math.sqrt(2 * Math.PI));
            const ymax = Math.max(0.42, peak * 1.18, Math.max(...dens) * 1.08);
            pp.setDomain(-6.3, 6.3, -ymax * 0.1, ymax);
            const c = pp.ctx;
            // one-sigma band
            c.fillStyle = withAlpha(color('green'), 0.1);
            c.fillRect(pp.sx(mu - sigma), 0, pp.sx(mu + sigma) - pp.sx(mu - sigma), pp.sy(0));
            const B = color('blue');
            for (let b = 0; b < bins; b++) {
              if (!dens[b]) continue;
              const x0 = pp.sx(lo + b * bw), x1 = pp.sx(lo + (b + 1) * bw);
              c.fillStyle = withAlpha(B, 0.38);
              c.fillRect(x0 + 0.5, pp.sy(dens[b]!), x1 - x0 - 1, pp.sy(0) - pp.sy(dens[b]!));
            }
            pp.path([-6.3, 6.3], [0, 0], color('--axis'), 1);
            for (let t = -6; t <= 6; t += 2) pp.text(String(t), t, -ymax * 0.085, { align: 'center', size: 11, mono: true, color: color('--ink-3') });
            pp.fn((t) => Math.exp(-((t - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI)), color('purple'), 2.5);
            pp.path([mu, mu], [0, ymax], withAlpha(color('gold'), 0.9), 1.5, [5, 4]);
            pp.path([mu - sigma, mu - sigma], [0, ymax * 0.82], withAlpha(color('green'), 0.9), 1.2, [3, 4]);
            pp.path([mu + sigma, mu + sigma], [0, ymax * 0.82], withAlpha(color('green'), 0.9), 1.2, [3, 4]);
            haloText(c, 'μ', pp.sx(mu), pp.sy(ymax) + 10, color('gold'), ital(15), 'center');
            haloText(c, 'μ−σ', pp.sx(mu - sigma) - 3, pp.sy(ymax * 0.86), color('green'), ital(13), 'right');
            haloText(c, 'μ+σ', pp.sx(mu + sigma) + 3, pp.sy(ymax * 0.86), color('green'), ital(13), 'left');
          },
        });
        const nRo = f.readout('N');
        const mRo = f.readout('mean', { sym: 'mu' });
        const sRo = f.readout('std', { sym: 'sigma' });
        const wRo = f.readout('within 1σ');
        const sync = () => {
          const N = z.length;
          let m = 0, s2 = 0, inside = 0;
          for (const q of z) m += mu + sigma * q;
          m = N ? m / N : 0;
          for (const q of z) {
            const s = mu + sigma * q;
            s2 += (s - m) ** 2;
            if (Math.abs(s - mu) < sigma) inside++;
          }
          const sd = N ? Math.sqrt(s2 / N) : 0;
          f.code.setMany({ n: N, m: N ? pyf(m, 3) : 'nan', s: N ? pyf(sd, 3) : 'nan', w1: N ? pyf(inside / N, 3) : 'nan' });
          nRo.set(N);
          mRo.set(N ? fmt(m, 3) : '–');
          sRo.set(N ? fmt(sd, 3) : '–');
          wRo.set(N ? `${(100 * inside / N).toFixed(1)}%` : '–');
          pl.redraw();
        };
        f.slider({ label: 'μ', sym: 'mu', min: -3, max: 3, step: 0.1, value: 0, slot: 'mu', format: (v) => fmt(v, 2), onInput: (v) => { mu = v; sync(); } });
        f.slider({ label: 'σ', sym: 'sigma', min: 0.3, max: 2.5, step: 0.05, value: 1, slot: 'sigma', format: (v) => fmt(v, 3), onInput: (v) => { sigma = v; sync(); } });
        const draw = (n: number) => {
          add(n);
          f.code.highlight('draw');
          sync();
        };
        f.button('Draw 10', () => draw(10));
        f.button('Draw 1,000', () => draw(1000), { primary: true });
        f.button('Clear', () => {
          z.length = 0;
          f.code.highlight(null);
          sync();
        });
        sync();
      },
      caption: `Each bar counts the samples that landed in its bin, scaled so that bars and curve share units; the smooth purple curve is the exact bell the samples come from. Press **Clear**, then **Draw 10** a few times: with few samples the histogram is ragged, and its mean and standard deviation wander. Keep drawing and it hugs the curve. Move the sliders: the same standard draws from \`randn\` are shifted by \`mu\` and stretched by \`sigma\`, exactly as in line 3 of the code, and the share inside the green band stays near 68% whatever you choose.`,
    });

    // ------------------------------------------------------------------ notation
    p.h2('max, argmax, and a notation decoder', 'notation');
    p.prose(`Two more operations appear on nearly every page. $\\max$ gives the **largest value** in a list. $\\arg\\max$ gives the **position** of the largest value. When a classifier predicts a label, it takes the $\\arg\\max$ of its scores: we do not want the winning score itself, we want *which class* won.`);
    p.math({
      label: 'max versus argmax',
      tex: String.raw`\begin{gathered} s = [3.2,\ 5.1,\ -1.7] \\[4pt] \max_k\, s_k = 5.1 \qquad \operatorname*{arg\,max}_k\, s_k = 1 \end{gathered}`,
      code: `
        s = np.array([3.2, 5.1, -1.7])  # cat, dog, ship
        np.max(s)          # 5.1: the best score
        np.argmax(s)       # 1: where it is ("dog")

        np.maximum(0, s)   # [3.2, 5.1, 0.0]
        # entry by entry against 0: not the same!
      `,
      terms: [
        [String.raw`\max_k s_k`, 'the largest of the $s_k$, over every $k$'],
        [String.raw`\operatorname*{arg\,max}_k s_k`, '"arg max": the $k$ (the *argument*) at which the largest value occurs. Counting from 0, as Python does'],
      ],
      explain: 'Do not confuse `np.max`, which collapses an array to its single largest value, with `np.maximum(0, s)`, which compares *each* entry with 0 and keeps the larger. The second is the ReLU and the SVM hinge, $\\max(0, \\cdot)$, applied entry by entry.',
    });
    p.prose(`### From notation to NumPy`);
    p.table(
      ['Math', 'Read it as', 'NumPy'],
      rows(String.raw`
$\sum_i x_i$ | add up every entry | ` + '`np.sum(x)`' + String.raw`
$\sum_i \sum_j W_{ij}^2$ | square every entry of a matrix, add them all | ` + '`np.sum(W ** 2)`' + String.raw`
$\prod_i p_i$ | multiply every entry | ` + '`np.prod(p)`' + String.raw`
$\frac{1}{N}\sum_i x_i$ | the mean | ` + '`np.mean(x)`' + String.raw`
$\|x\|_2$ | the length | ` + '`np.linalg.norm(x)`' + String.raw`
$w \cdot x$ | dot product | ` + '`np.dot(w, x)` or `w @ x`' + String.raw`
$Wx$ | matrix times vector | ` + '`W.dot(x)` or `W @ x`' + String.raw`
$W^\top$ | transpose | ` + '`W.T`' + String.raw`
$e^{x}$, $\log x$ | exponential, natural log | ` + '`np.exp(x)`, `np.log(x)`' + String.raw`
$\max_k s_k$ | the largest entry | ` + '`np.max(s)`' + String.raw`
$\arg\max_k s_k$ | the position of the largest entry | ` + '`np.argmax(s)`' + String.raw`
$\max(0, x)$ | entrywise ReLU | ` + '`np.maximum(0, x)`'),
    );
    p.prose(`### Greek letter decoder

Every symbol this course uses, how to say it out loud, and what it usually means here. The meanings are conventions, not laws: a paper can use any letter for anything, but these are the common habits.`);
    p.table(
      ['Symbol', 'Say it', 'Usually means'],
      rows(String.raw`
$\Sigma$ | "sigma" (capital), or "the sum of" | add up a sequence: a loop with ` + '`+=`' + String.raw`
$\Pi$ | "pi" (capital), or "the product of" | multiply a sequence together
$\lambda$ | "lambda" | regularization strength (` + '`reg`' + String.raw` in the assignments)
$\Delta$ | "delta" (capital) | the SVM margin in Chapter 4; elsewhere "a change in", as in $\Delta x$
$\delta$ | "delta" | a small change, or an error signal flowing backward
$\theta$ | "theta" | an angle; in general writing, all of a model's parameters
$\sigma$ | "sigma" | a standard deviation; also the sigmoid function $\sigma(x) = 1/(1+e^{-x})$
$\mu$ | "mew" | a mean; in Chapter 9 also the momentum coefficient
$\epsilon$ | "epsilon" | a tiny number, such as ` + '`1e-8`' + String.raw`, added to avoid dividing by zero
$\alpha$ | "alpha" | a learning rate or step size; the small slope of a Leaky ReLU
$\beta$ | "beta" | Adam's decay rates $\beta_1, \beta_2$; batch norm's learned shift
$\gamma$ | "gamma" | batch norm's learned scale; a learning-rate decay factor
$\eta$ | "eta" | a learning rate, in some papers
$\partial$ | "partial", or "del" | a partial derivative: $\partial L / \partial W$
$\nabla$ | "nabla", or "grad" | the gradient: $\nabla_W L$ is "the gradient of $L$ with respect to $W$"
$\in$ | "in", "is an element of" | $x \in \mathbb{R}^{3072}$: $x$ is a list of 3072 real numbers
$\mathbb{R}$ | "R", "the reals" | ordinary numbers; $\mathbb{R}^{m \times n}$ is the set of $m \times n$ matrices
$\|x\|$ | "the norm of x" | the length of a vector
$\hat{x}$ | "x hat" | an estimate, or a normalized version of $x$
$\odot$ | "elementwise times" | multiply entry by entry (` + '`*`' + String.raw` in NumPy)
$\mathbf{1}(\cdot)$ | "indicator" | 1 if the condition inside is true, otherwise 0
$\approx$ | "approximately" | close to, as in $e \approx 2.718$`),
    );

    p.callout('idea', `
- A vector is a list of numbers and an arrow; a matrix is a grid, best read as a stack of rows. Write down every shape.
- The **dot product** (multiply pairs, add up) is a similarity score, and it is inside every score, neuron and convolution in this course. Matrix products are just many dot products.
- $\\Sigma$ and $\\Pi$ are loops. $\\log$ turns products into sums, which is why log-probabilities are everywhere.
- A derivative is a slope; a partial derivative nudges one input; the **gradient** collects them and points uphill, so training walks along $-\\symgrad$.
- The **chain rule** multiplies local rates through a pipeline. Backpropagation is that, done backward.`, 'Takeaways');
  },
};

export default chapter;
