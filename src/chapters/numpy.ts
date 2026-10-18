import type { ChapterDef } from './index';
import { fmt } from '../core/code';
import { h } from '../core/dom';
import { CIFAR_CLASSES, type CifarSet, loadCifar } from '../core/data';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { cellBox, haloText, ital, mono, pxArrow, ui } from '../lib/math-kit-draw';
import { evalIndex, shapeStr } from '../lib/numpy-index';

/** Splits "a | b | c" rows (written with String.raw) into table cells. */
const rows = (src: string) =>
  src
    .trim()
    .split('\n')
    .map((l) => l.split(' | ').map((c) => c.trim()));

/** Nested-list text for values laid out in `shape` (row-major). */
function listText(vals: number[], shape: number[], f: (v: number) => string = (v) => fmt(v, 3)): string {
  if (shape.length === 0) return f(vals[0]!);
  if (shape.length === 1) return `[${vals.map(f).join(', ')}]`;
  const out: string[] = [];
  for (let r = 0; r < shape[0]!; r++) out.push(`[${vals.slice(r * shape[1]!, (r + 1) * shape[1]!).map(f).join(', ')}]`);
  return `[${out.join(', ')}]`;
}

/** Breaks a long comment into at most `n` lines of about `width` characters. */
function wrap(s: string, width: number, n: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > width) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  if (lines.length > n) {
    const keep = lines.slice(0, n);
    keep[n - 1] = `${keep[n - 1]} ...`;
    return keep;
  }
  while (lines.length < n) lines.push('');
  return lines;
}

const textInput = (value: string, label: string): { el: HTMLElement; input: HTMLInputElement } => {
  const input = h('input', { type: 'text', value, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': label });
  input.setAttribute('autocorrect', 'off');
  Object.assign(input.style, {
    font: "500 16px 'JetBrains Mono Variable', ui-monospace, monospace",
    padding: '7px 10px',
    border: '1px solid var(--rule)',
    borderRadius: '9px',
    background: 'var(--paper)',
    color: 'var(--ink)',
    width: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
  });
  const el = h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, label), input);
  Object.assign(el.style, { flex: '1 1 100%', display: 'flex', gap: '8px', alignItems: 'center' });
  return { el, input };
};

const chapter: ChapterDef = {
  symbols: {
    X: { color: 'orange', name: 'X: a batch of inputs, one example (image) per row', code: ['X', 'X_train', 'Xtr'] },
    W: { color: 'blue', name: 'W: the weights' },
    b: { color: 'green', name: 'b: the biases, one per class' },
    scores: { color: 'purple', name: 'scores: one row of class scores per example', tex: 's', code: ['scores'] },
    y: { color: 'gold', name: 'y: the correct class index of each example', code: ['y', 'y_train'] },
    dists: { color: 'teal', name: 'dists: the distance from every test image to every training image', tex: 'd', code: ['dists'] },
    mask: { color: 'red', name: 'mask: a boolean array, True where a condition holds', code: ['mask'] },
  },

  render(p) {
    p.prose(`
Every CS231n assignment is written in Python, and every line that does real work goes through **NumPy**, Python's library for arrays of numbers. If you already program in another language, you can pick up the Python you need in an afternoon. NumPy takes a little longer, because it asks you to stop thinking in loops and start thinking in **whole arrays**.

That shift is the real goal of this chapter. By the end, lines like \`scores[np.arange(N), y]\` and \`X - X.mean(axis=0)\` should read as naturally as a for loop, and you should be able to predict the **shape** of every array before you print it.`);
    p.callout('aside', 'Keep a Python prompt open while you read: `pip install numpy matplotlib`, then run `python` (or a Jupyter notebook, which the assignments use) and try each listing. The 2016 assignments targeted Python 2.7; everything here is modern Python 3, and the one difference that bites most often, division, is flagged below.', 'Follow along');

    // ------------------------------------------------------------------ python
    p.h2('Python for programmers in a hurry', 'python');
    p.prose(`Python is dynamically typed, uses indentation instead of braces, and counts from 0. Read each listing like a session at the prompt: results are in the comments.`);
    p.code(`
      x = 3                   # no declarations, no semicolons
      z = 2.5
      print(x + z, x * z)     # 5.5 7.5
      print(7 / 2, 7 // 2)    # 3.5 3   / always gives a float; // floors
      print(2 ** 10, 7 % 3)   # 1024 1  ** is power, % is remainder

      name = 'cat'
      print(f'{name} has {len(name)} letters')   # cat has 3 letters

      ok, done = True, False
      print(ok and not done, ok or done)         # True True
      nothing = None                             # "no value", like null
    `, { title: 'basics.py' });
    p.code(`
      nums = [3, 1, 4, 1, 5]      # a list: ordered and mutable
      nums.append(9)              # [3, 1, 4, 1, 5, 9]
      len(nums)                   # 6
      nums[0], nums[-1]           # (3, 9)   negative indices count from the end
      nums[1:4]                   # [1, 4, 1]  start included, stop excluded
      nums[:2], nums[3:]          # ([3, 1], [1, 5, 9])
      nums[::2]                   # [3, 4, 5]  every second item

      squares = [n ** 2 for n in nums if n > 2]   # [9, 16, 25, 81]

      for i, n in enumerate(nums):    # index and value together
          print(i, n)
      for p, q in zip([1, 2], ['a', 'b']):   # walk two lists in step
          print(p, q)

      point = (3, 4)              # a tuple: like a list, but immutable
      px, py = point              # unpacking
    `, { title: 'lists.py' });
    p.code(`
      counts = {'cat': 3, 'dog': 5}     # a dict: key -> value
      counts['ship'] = 1                # add a key
      counts['cat']                     # 3
      'dog' in counts                   # True
      counts.get('frog', 0)             # 0, a default for missing keys
      for name, n in counts.items():
          print(name, n)

      results = {}                      # Assignment 1 style: tuple keys
      results[(1e-7, 2.5e4)] = (0.38, 0.37)   # (lr, reg) -> (train, val)

      kinds = {'cat', 'dog', 'cat'}     # a set: {'cat', 'dog'}
    `, { title: 'dicts.py' });
    p.code(`
      def relu(v, leak=0.0):            # leak has a default value
          return v if v > 0 else leak * v

      relu(3.0)                         # 3.0
      relu(-2.0, leak=0.1)              # -0.2, passing by keyword

      def min_max(values):
          return min(values), max(values)   # returns a tuple

      lo, hi = min_max([4, 2, 8])       # lo = 2, hi = 8
      square = lambda v: v * v          # a tiny anonymous function

      class NearestNeighbor:
          def __init__(self):           # the constructor
              self.X_train = None       # self is the instance ("this")

          def train(self, X, y):
              self.X_train = X          # just remember the data
              self.y_train = y

      clf = NearestNeighbor()           # no "new" keyword
      clf.train(X_train, y_train)
    `, { title: 'functions_and_classes.py' });
    p.table(
      ['If you expect', 'Python does'],
      rows(String.raw`
blocks in ` + '`{ }`' + String.raw` | indentation is the block, and a colon starts one
` + '`&&`, `||`, `!`' + String.raw` | ` + '`and`, `or`, `not`' + String.raw` (but on NumPy arrays you need ` + '`&`, `|`, `~`' + String.raw`, as you will see)
` + '`null`' + String.raw` | ` + '`None`' + String.raw`
` + '`for (i = 0; i < n; i++)`' + String.raw` | ` + '`for i in range(n)`' + String.raw`, which stops *before* ` + '`n`' + String.raw`
` + '`b = a`' + String.raw` makes a copy | it does not: both names now refer to the same object
` + '`7 / 2`' + String.raw` gives 3 | it gives 3.5; use ` + '`//`' + String.raw` to floor. (In Python 2.7, ` + '`/`' + String.raw` on two integers floored)`),
      { caption: 'Habits from other languages that trip people up.' },
    );

    // ------------------------------------------------------------------ arrays
    p.h2('NumPy arrays', 'arrays');
    p.prose(`
A NumPy array (\`np.ndarray\`) is a grid of numbers that all share one type, stored in a single block of memory. That restriction is exactly what makes it fast: an operation on a whole array runs as one tight loop in compiled C instead of millions of slow Python steps.

Every array knows three things about itself:

- its **shape**: a tuple with one size per axis, like \`(2, 3)\` for 2 rows and 3 columns,
- its number of axes, **ndim**, which is just \`len(shape)\`,
- its element type, **dtype**: \`float64\` for ordinary decimals, \`int64\` for whole numbers, \`uint8\` for raw pixel values from 0 to 255, \`bool\` for True/False.`);
    p.code(`
      import numpy as np

      v = np.array([1, 2, 3])          # from a list
      v.shape, v.ndim, v.dtype         # ((3,), 1, dtype('int64'))

      M = np.array([[1., 2., 3.],
                    [4., 5., 6.]])
      M.shape, M.ndim, M.dtype         # ((2, 3), 2, dtype('float64'))
      M.size                           # 6 entries in total

      np.zeros((2, 3))                 # 2 x 3 of 0.0 (the shape is a tuple)
      np.ones(4)                       # [1. 1. 1. 1.]
      np.full((2, 2), 7)               # [[7 7] [7 7]]
      np.eye(3)                        # the 3 x 3 identity matrix
      np.arange(5)                     # [0 1 2 3 4], like range()
      np.arange(2, 10, 3)              # [2 5 8]
      np.linspace(0, 1, 5)             # [0.   0.25 0.5  0.75 1.  ]
      np.random.randn(2, 3)            # 2 x 3 samples from a standard normal
      np.random.randint(0, 10, size=5) # 5 random integers in [0, 10)
      np.zeros_like(M)                 # zeros with M's shape and dtype
      M.astype(np.int64)               # convert the dtype (a copy)
    `, { title: 'creating_arrays.py' });
    p.callout('warning', 'The shape `(3,)` describes a **1-D array** of 3 numbers; the trailing comma is just how Python writes a one-element tuple. It is *not* the same as `(3, 1)` (a column, 2-D) or `(1, 3)` (a row, 2-D). Mixing these up produces some of the most confusing bugs in the assignments; the [pitfalls section](#/numpy/pitfalls) shows why.', 'Watch the trailing comma');

    // ------------------------------------------------------------------ indexing
    p.h2('Indexing and slicing', 'indexing');
    p.prose(`
Indexing works like Python lists, extended to several axes: **one index or slice per axis, separated by commas.** \`a[i, j]\` is row \`i\`, column \`j\`.

A **slice** \`start:stop:step\` picks a range along one axis. Leave out any part to get its default (start at 0, stop at the end, step 1), and use negative numbers to count back from the end. An axis you do not mention at all means "everything along it", so \`a[1]\` is the whole of row 1.

One subtle point matters a lot: an **integer index removes its axis** from the result, while a slice keeps it. \`a[:, 0]\` (every row, column 0) is a flat 1-D array, not a column.`);

    p.figure({
      title: 'What does this index select?',
      codeTitle: 'slicing.py',
      code: `
        a = np.arange(24).reshape(4, 6)

        r = {{expr:a[1:3, 2:5]}}
        # {{v1}}
        # {{v2}}
        # {{info}}
      `,
      setup(f) {
        const R = 4, C = 6;
        const val = (r: number, c: number) => r * C + c;
        let expr = 'a[1:3, 2:5]';
        let res = evalIndex(expr, R, C, val);
        const cv = f.canvas(640, 400, (ctx, w, h) => {
          const cell = Math.min(w / 7.4, h / 8.6);
          const fs = Math.max(11, cell * 0.36);
          const x0 = (w - C * cell) / 2 + cell * 0.2;
          const y0 = cell * 0.62;
          const P = color('purple');
          const S = color('slate');
          const sel = new Map<string, number>();
          if (res.ok) res.cells.forEach(([r, c], k) => sel.set(`${r},${c}`, sel.has(`${r},${c}`) ? sel.get(`${r},${c}`)! : k));
          ctx.font = mono(11, 500);
          ctx.fillStyle = color('--ink-3');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          for (let c = 0; c < C; c++) ctx.fillText(String(c), x0 + c * cell + cell / 2, y0 - cell * 0.32);
          ctx.textAlign = 'right';
          for (let r = 0; r < R; r++) ctx.fillText(String(r), x0 - 8, y0 + r * cell + cell / 2);
          for (let r = 0; r < R; r++)
            for (let c = 0; c < C; c++) {
              const on = sel.has(`${r},${c}`);
              cellBox(ctx, x0 + c * cell, y0 + r * cell, cell, cell, String(val(r, c)), on ? P : S, { on, dim: res.ok && !on, size: fs });
            }
          // the result
          const ry = y0 + R * cell + cell * 0.55;
          if (!res.ok) {
            const lines = wrap(res.error, Math.max(24, Math.floor(w / 8.2)), 3).filter(Boolean);
            lines.forEach((l, i) => haloText(ctx, l, w / 2, ry + 8 + i * 17, color('red'), mono(Math.max(11, Math.min(13, w / 46)), 500), 'center'));
            return;
          }
          const vals = res.cells.map(([r, c]) => val(r, c));
          const kindTxt = res.kind === 'scalar' ? 'a single number' : res.kind === 'view' ? 'a view of a' : 'a copy';
          haloText(ctx, `result: shape ${shapeStr(res.shape)}, ${kindTxt}`, w / 2, ry, color('--ink-2'), ui(Math.max(11, Math.min(13, w / 44)), 600), 'center');
          const top = ry + 14;
          const avail = h - top - 6;
          if (vals.length === 0) {
            haloText(ctx, 'empty: nothing selected', w / 2, top + 16, color('--ink-3'), mono(12), 'center');
            return;
          }
          if (res.shape.length === 2) {
            const [nr, nc] = res.shape as [number, number];
            const bs = Math.min(cell * 0.8, (w - 20) / nc, avail / nr);
            const bx = (w - nc * bs) / 2;
            for (let i = 0; i < nr; i++)
              for (let j = 0; j < nc; j++) cellBox(ctx, bx + j * bs, top + i * bs, bs, bs, String(vals[i * nc + j]), P, { on: true, fill: 0.16, size: Math.max(11, bs * 0.36) });
          } else {
            const n = vals.length;
            const per = Math.max(1, Math.min(n, Math.floor((w - 20) / 26)));
            const rowsN = Math.ceil(n / per);
            const bs = Math.min(cell * 0.8, (w - 20) / per, avail / rowsN);
            for (let k = 0; k < n; k++) {
              const i = Math.floor(k / per), j = k % per;
              const inRow = Math.min(per, n - i * per);
              const bx = (w - inRow * bs) / 2;
              cellBox(ctx, bx + j * bs, top + i * bs, bs, bs, String(vals[k]), P, { on: true, fill: 0.16, size: Math.max(11, bs * 0.36), radius: res.shape.length === 0 ? 8 : 4 });
            }
            if (rowsN > 1) haloText(ctx, '(one flat row, wrapped to fit)', w / 2, top + rowsN * bs + 10, color('--ink-3'), ui(11), 'center');
          }
        });
        const sync = () => {
          res = evalIndex(expr, R, C, val);
          f.code.set('expr', expr.trim() || 'a[]');
          if (res.ok) {
            const vals = res.cells.map(([r, c]) => val(r, c));
            const [l1, l2] = wrap(`r = ${listText(vals, res.shape)}`, 44, 2);
            const kindTxt = res.kind === 'scalar' ? 'a single number' : res.kind === 'view' ? 'a view: shares memory with a' : 'a copy: new memory';
            const lines = l2 ? [l1!, l2, `shape ${shapeStr(res.shape)}, ${kindTxt}`] : [l1!, `r.shape == ${shapeStr(res.shape)}`, kindTxt];
            f.code.setMany({ v1: lines[0]!, v2: lines[1]!, info: lines[2]! });
          } else {
            const [l1, l2, l3] = wrap(res.error, 46, 3);
            f.code.setMany({ v1: l1!, v2: l2!, info: l3! });
          }
          f.code.highlight(res.ok ? null : [3, 4, 5, 6], 'alt');
          cv.redraw();
        };
        const { el, input } = textInput(expr, 'r =');
        input.addEventListener('input', () => {
          expr = input.value;
          sync();
        });
        const presets = ['a[1, 3]', 'a[2]', 'a[:, 0]', 'a[1:3, 2:5]', 'a[::2, ::3]', 'a[-1]', 'a[:, -2:]', 'a[::-1, 0]', 'a[a > 15]', 'a[a % 5 == 0]', 'a[[2, 0]]', 'a[[0, 3], [1, 4]]'];
        for (const pr of presets) {
          const btn = f.button(pr, () => {
            expr = pr;
            input.value = pr;
            sync();
          });
          Object.assign(btn.style, { fontFamily: 'var(--font-mono)', fontSize: '12.5px', padding: '5px 10px' });
        }
        f.controls.append(el);
        sync();
      },
      caption: `Tap a preset or type your own expression in the box; the lit cells are the ones selected, and the strip below shows the result in order, with its shape. Compare \`a[2]\`, a 1-D row of shape (6,), with \`a[:, 0]\`, which also comes back 1-D with shape (4,), even though it was a column. The code says whether the result is a **view** (a window onto \`a\`'s memory, so writing into it changes \`a\`) or a **copy**. Try breaking it too: \`a[4, 0]\`, \`a[0, 1, 2]\`, or the classic \`a[a > 3 & a < 10]\`.`,
    });

    p.prose(`
### Integer-array indexing

Instead of a single integer, you can index an axis with a whole list or array of integers. Give one such array per axis and NumPy **pairs them up**, element by element: \`a[[0, 3], [1, 4]]\` picks \`a[0, 1]\` and \`a[3, 4]\`.

That looks like a curiosity, but it is one of the most-used lines in all of CS231n. Suppose \`scores\` has one row per example and one column per class, and \`y\` holds each example's correct class. Then one expression pulls out every example's correct-class score:`);
    p.math({
      label: 'Correct-class scores',
      tex: String.raw`c_i = \symscores_{\,i,\;\symy_i} \qquad\text{for } i = 0, 1, \dots, N-1`,
      code: `
        N = scores.shape[0]
        correct = scores[np.arange(N), y]   # shape (N,)

        # the same thing, one Python step at a time:
        correct = [scores[i, y[i]] for i in range(N)]
      `,
      terms: [
        [String.raw`\symscores_{\,i,\;\symy_i}`, 'row $i$ of the scores, and within that row, the column named by $\\symy_i$, the correct class of example $i$'],
        [String.raw`i = 0, \dots, N-1`, 'one result per example'],
      ],
      explain: '`np.arange(N)` is `[0, 1, ..., N-1]`, one row number per example, and `y` holds one column number per example. NumPy walks the two arrays together, like `zip`, and returns one entry per pair. The vectorized SVM and softmax losses of Assignment 1 both lean on this line, and the same trick works for *writing*: `margins[np.arange(N), y] = 0` zeroes the correct-class entry of every row in one line.',
    });

    p.figure({
      title: 'scores[np.arange(N), y] picks one cell per row',
      codeTitle: 'pick_correct.py',
      code: `
        scores = np.array([[ 1.2, -0.4,  3.1,  0.5],
                           [ 2.8,  1.0, -1.3,  0.2],
                           [ 0.3,  0.9,  1.4,  2.6],
                           [-0.7,  3.3,  0.8,  1.1],
                           [ 1.9,  0.1,  0.6, -0.5]])
        y = np.array({{y:[2, 0, 3, 1, 0]}})
        N = scores.shape[0]                 # 5

        rows = np.arange(N)       # [0, 1, 2, 3, 4]
        correct = scores[rows, y]                 #@pick
        # {{correct}}

        wrong = scores[:, y]                #@wrong
        # wrong.shape == (5, 5): every row, at every label
      `,
      setup(f) {
        const S = [
          [1.2, -0.4, 3.1, 0.5],
          [2.8, 1.0, -1.3, 0.2],
          [0.3, 0.9, 1.4, 2.6],
          [-0.7, 3.3, 0.8, 1.1],
          [1.9, 0.1, 0.6, -0.5],
        ];
        const NAMES = ['cat', 'dog', 'ship', 'frog'];
        const y = [2, 0, 3, 1, 0];
        let mistake = false;
        let geo = { x0: 0, y0: 0, cell: 1 };
        const cv = f.canvas(640, 460, (ctx, w, hh) => {
          const cell = Math.min(w / 8.3, hh / 7.3);
          const fs = Math.max(11, cell * 0.33);
          const x0 = (w - cell * 7.4) / 2 + cell * 0.7;
          const y0 = cell * 1.05;
          geo = { x0, y0, cell };
          const P = color('purple'), G = color('gold'), Sl = color('slate'), Rd = color('red');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = ui(Math.max(11, Math.min(13, cell * 0.34)), 600);
          for (let j = 0; j < 4; j++) {
            ctx.fillStyle = color('--ink-2');
            ctx.fillText(NAMES[j]!, x0 + j * cell + cell / 2, y0 - cell * 0.62);
            ctx.fillStyle = color('--ink-3');
            ctx.font = mono(11, 500);
            ctx.fillText(String(j), x0 + j * cell + cell / 2, y0 - cell * 0.24);
            ctx.font = ui(Math.max(11, Math.min(13, cell * 0.34)), 600);
          }
          ctx.font = mono(11, 500);
          ctx.fillStyle = color('--ink-3');
          for (let i = 0; i < 5; i++) ctx.fillText(String(i), x0 - cell * 0.35, y0 + i * cell + cell / 2);
          const usedCols = new Set(y);
          for (let i = 0; i < 5; i++)
            for (let j = 0; j < 4; j++) {
              const picked = mistake ? usedCols.has(j) : y[i] === j;
              cellBox(ctx, x0 + j * cell, y0 + i * cell, cell, cell, fmt(S[i]![j]!, 2), picked ? (mistake ? Rd : G) : Sl, { on: picked, dim: !picked, size: fs });
            }
          // y column and the result column
          const yx = x0 + 4 * cell + cell * 0.45;
          const cx = yx + cell * 1.25;
          ctx.font = ital(Math.max(14, cell * 0.42));
          ctx.fillStyle = G;
          ctx.fillText('y', yx + cell * 0.4, y0 - cell * 0.4);
          ctx.fillStyle = P;
          ctx.font = mono(Math.max(11, cell * 0.28), 600);
          ctx.fillText(mistake ? '' : 'correct', cx + cell * 0.6, y0 - cell * 0.4);
          for (let i = 0; i < 5; i++) {
            cellBox(ctx, yx, y0 + i * cell, cell * 0.8, cell, String(y[i]), G, { on: true, fill: 0.14, size: fs });
            if (!mistake) {
              pxArrow(ctx, yx + cell * 0.84, y0 + i * cell + cell / 2, cx - 3, y0 + i * cell + cell / 2, withAlpha(color('--ink-3'), 0.8), 1.2, 5);
              cellBox(ctx, cx, y0 + i * cell, cell * 1.2, cell, fmt(S[i]![y[i]!]!, 2), P, { on: true, fill: 0.16, size: fs });
            }
          }
          const narrow = w < 430;
          const msg = mistake ? (narrow ? 'scores[:, y] has shape (5, 5)' : 'scores[:, y]: all 5 rows at each of the 5 labels, shape (5, 5)') : (narrow ? 'pairs: ' : 'pairs (row i, column y[i]): ') + y.map((c, i) => `(${i},${c})`).join(' ');
          haloText(ctx, msg, w / 2, y0 + 5 * cell + cell * 0.5, mistake ? Rd : color('--ink-2'), mono(Math.max(11, Math.min(12.5, w / 52)), 500), 'center');
        });
        cv.canvas.classList.add('scroll-ok');
        cv.canvas.addEventListener('click', (e) => {
          const r = cv.canvas.getBoundingClientRect();
          const j = Math.floor((e.clientX - r.left - geo.x0) / geo.cell);
          const i = Math.floor((e.clientY - r.top - geo.y0) / geo.cell);
          if (i >= 0 && i < 5 && j >= 0 && j < 4) {
            y[i] = j;
            sync();
          }
        });
        const sync = () => {
          f.code.setMany({ y: `[${y.join(', ')}]`, correct: `correct = [${y.map((c, i) => fmt(S[i]![c]!, 2)).join(', ')}]` });
          f.code.highlight(mistake ? 'wrong' : 'pick');
          cv.redraw();
        };
        f.toggle({ label: 'show the classic mistake, scores[:, y]', value: false, onChange: (v) => { mistake = v; sync(); } });
        sync();
      },
      caption: `Each gold cell is the score of that row's correct class. **Tap** any score to make its column the correct class for that row, and watch \`y\` and \`correct\` change in the code. Then switch on the classic mistake: \`scores[:, y]\` uses a slice for the rows, so instead of pairing row $i$ with $\\symy_i$, it takes *every* row at *every* label, a (5, 5) array that usually goes on to broadcast silently into a wrong loss.`,
    });

    p.prose(`
### Boolean masks

Comparing an array with something gives a **boolean array** of the same shape, True where the comparison holds. Indexing with it, \`a[mask]\`, selects exactly the True positions and returns them as a flat 1-D copy. Assigning through a mask changes only those positions.`);
    p.code(`
      a = np.arange(24).reshape(4, 6)
      mask = a > 15             # shape (4, 6), True where a > 15
      a[mask]                   # [16 17 18 19 20 21 22 23]
      a[a % 5 == 0]             # [ 0  5 10 15 20]
      a[(a > 3) & (a < 10)]     # & | ~ with parentheses, never and/or/not

      hidden = X.dot(W)
      hidden[hidden < 0] = 0    # assign through a mask: a ReLU, in place

      acc = np.mean(y_pred == y)   # accuracy: the fraction of True
    `, { title: 'masks.py' });
    p.callout('warning', 'Python\'s `and`, `or` and `not` ask a single True-or-False question, and an array of many booleans has no single answer, so NumPy raises *"The truth value of an array with more than one element is ambiguous."* Use the elementwise operators `&`, `|` and `~` instead, and always wrap each comparison in parentheses: `&` binds more tightly than `>`, so `a > 3 & a < 10` means `a > (3 & a) < 10`, which fails with the same error.', 'and / or versus & / |');

    // ------------------------------------------------------------------ math
    p.h2('Elementwise math, matrix products and reductions', 'math');
    p.prose(`
The arithmetic operators work **entry by entry** on arrays: \`A + B\`, \`A * B\`, \`A / B\`, \`A ** 2\` and \`A > 0\` all pair up matching entries. So do NumPy's math functions, the *ufuncs*: \`np.exp\`, \`np.log\`, \`np.sqrt\`, \`np.abs\`, \`np.maximum\`. The shapes must match, or be compatible under broadcasting (next section).

The **matrix product** from the [math survival kit](#/math-kit/matrices) is a different operation with its own spelling: \`A.dot(B)\`, \`np.dot(A, B)\` or \`A @ B\`.`);
    p.math({
      label: '* versus @',
      tex: String.raw`\begin{gathered} (A \odot B)_{ij} = A_{ij}\,B_{ij} \\[6pt] (AB)_{ij} = \sum_k A_{ik}\,B_{kj} \end{gathered}`,
      code: `
        A = np.array([[1., 2.],
                      [3., 4.]])
        A * A      # [[ 1.,  4.], [ 9., 16.]]
        A @ A      # [[ 7., 10.], [15., 22.]]
        A.dot(A)   # the same as A @ A
        # * pairs up entries; @ is the matrix product
      `,
      terms: [
        [String.raw`A \odot B`, 'the elementwise (or *Hadamard*) product: multiply matching entries. Written `*` in NumPy'],
        [String.raw`AB`, 'the matrix product: entry $(i, j)$ is row $i$ of $A$ dotted with column $j$ of $B$'],
      ],
      explain: 'Mixing the two up is a classic bug, and it often does not crash: for square matrices both are legal and give different answers. In the course, `X.dot(W)` computes the scores, while `*` shows up in places like the backward pass of a ReLU, `dx = dout * (x > 0)`, which zeroes the gradient wherever the input was negative.',
    });
    p.prose(`
### Reductions and the axis argument

A **reduction** collapses an array to fewer numbers: \`sum\`, \`mean\`, \`max\`, \`min\`, \`argmax\`, \`std\`. With no arguments it reduces everything to a single number. With \`axis=k\` it collapses only axis \`k\`. The rule to remember: **the axis you name is the one that disappears.** For a matrix, \`axis=0\` collapses the rows, leaving one result per column, and \`axis=1\` collapses the columns, leaving one result per row.`);
    p.math({
      label: 'Summing along an axis',
      tex: String.raw`\begin{gathered} \texttt{A.sum(axis=0)}_j = \sum_i A_{ij} \\[6pt] \texttt{A.sum(axis=1)}_i = \sum_j A_{ij} \end{gathered}`,
      code: `
        A = np.array([[1, 5, 2, 0],
                      [4, 3, 6, 1],
                      [2, 7, 1, 3]])    # shape (3, 4)
        A.sum()           # 35
        A.sum(axis=0)     # [ 7 15  9  4]  shape (4,)
        A.sum(axis=1)     # [ 8 14 13]     shape (3,)
        A.sum(axis=1, keepdims=True)   # shape (3, 1)
      `,
      terms: [
        [String.raw`\sum_i A_{ij}`, 'add down each column: the row index $i$ is used up, one result per column $j$'],
        [String.raw`\sum_j A_{ij}`, 'add along each row: one result per row $i$'],
      ],
      explain: 'In shape terms, `axis=k` deletes entry `k` from the shape: (3, 4) summed over axis 0 is (4,), and over axis 1 it is (3,). Pass `keepdims=True` to keep the collapsed axis with size 1, giving (3, 1), so the result still lines up against the original. That is what makes row normalization a one-liner: `A / A.sum(axis=1, keepdims=True)`.',
    });

    p.figure({
      title: 'Which axis collapses?',
      codeTitle: 'reduce.py',
      code: `
        A = np.array([[1, 5, 2, 0],
                      [4, 3, 6, 1],
                      [2, 7, 1, 3]])   # shape (3, 4)

        r = {{call:A.sum(axis=0)}}
        # r = {{res}}
        # r.shape == {{shape}}
      `,
      setup(f) {
        const A = [
          [1, 5, 2, 0],
          [4, 3, 6, 1],
          [2, 7, 1, 3],
        ];
        type Op = 'sum' | 'mean' | 'max' | 'argmax';
        let op: Op = 'sum';
        let axis: 'None' | '0' | '1' = '0';
        let keep = false;
        let t = 1;
        const reduce = (vals: number[]): number => {
          if (op === 'sum') return vals.reduce((a, v) => a + v, 0);
          if (op === 'mean') return vals.reduce((a, v) => a + v, 0) / vals.length;
          if (op === 'max') return Math.max(...vals);
          return vals.indexOf(Math.max(...vals));
        };
        const result = (): { vals: number[]; shape: number[]; win: [number, number][] } => {
          const all = A.flat();
          const argOf = (vals: number[]) => vals.indexOf(Math.max(...vals));
          if (axis === 'None') {
            const k = argOf(all);
            return { vals: [reduce(all)], shape: keep ? [1, 1] : [], win: [[Math.floor(k / 4), k % 4]] };
          }
          if (axis === '0') {
            const cols = [0, 1, 2, 3].map((j) => A.map((row) => row[j]!));
            return { vals: cols.map(reduce), shape: keep ? [1, 4] : [4], win: cols.map((c, j): [number, number] => [argOf(c), j]) };
          }
          return { vals: A.map(reduce), shape: keep ? [3, 1] : [3], win: A.map((r, i): [number, number] => [i, argOf(r)]) };
        };
        const show = (v: number) => (op === 'mean' ? fmt(v, 3) : String(v));
        const cv = f.canvas(640, 330, (ctx, w, hh) => {
          const cell = Math.min(w / 7.2, (hh - 28) / 5.25);
          const fs = Math.max(11, cell * 0.36);
          const gx = (w - cell * 5.6) / 2;
          const gy = cell * 0.5;
          const B = color('blue'), P = color('purple'), G = color('gold');
          const res = result();
          const winners = new Set(op === 'max' || op === 'argmax' ? res.win.map(([i, j]) => `${i},${j}`) : []);
          for (let i = 0; i < 3; i++)
            for (let j = 0; j < 4; j++) cellBox(ctx, gx + j * cell, gy + i * cell, cell, cell, String(A[i]![j]), winners.has(`${i},${j}`) ? G : B, { on: winners.has(`${i},${j}`), size: fs });
          // where each result cell sits
          const target = (k: number): [number, number] => {
            if (axis === '0') return [gx + k * cell, gy + 3 * cell + cell * 0.7];
            if (axis === '1') return [gx + 4 * cell + cell * 0.7, gy + k * cell];
            return [gx + 4 * cell + cell * 0.7, gy + 3 * cell + cell * 0.7];
          };
          // collapse arrows
          const ink = withAlpha(color('--ink-3'), 0.85);
          if (axis === '0') for (let j = 0; j < 4; j++) pxArrow(ctx, gx + j * cell + cell / 2, gy + 3 * cell + 3, gx + j * cell + cell / 2, gy + 3 * cell + cell * 0.66, ink, 1.4, 6);
          else if (axis === '1') for (let i = 0; i < 3; i++) pxArrow(ctx, gx + 4 * cell + 3, gy + i * cell + cell / 2, gx + 4 * cell + cell * 0.66, gy + i * cell + cell / 2, ink, 1.4, 6);
          else pxArrow(ctx, gx + 4 * cell, gy + 3 * cell, gx + 4 * cell + cell * 0.66, gy + 3 * cell + cell * 0.66, ink, 1.4, 6);
          // values in flight
          if (t < 1) {
            const e = t * t * (3 - 2 * t);
            for (let i = 0; i < 3; i++)
              for (let j = 0; j < 4; j++) {
                const k = axis === '0' ? j : axis === '1' ? i : 0;
                const [tx, ty] = target(k);
                const x = gx + j * cell + (tx - gx - j * cell) * e;
                const y = gy + i * cell + (ty - gy - i * cell) * e;
                ctx.globalAlpha = 1 - e * 0.7;
                cellBox(ctx, x, y, cell, cell, String(A[i]![j]), B, { on: true, fill: 0.2, size: fs });
                ctx.globalAlpha = 1;
              }
          } else {
            res.vals.forEach((v, k) => {
              const [tx, ty] = target(k);
              cellBox(ctx, tx, ty, cell, cell, show(v), P, { on: true, fill: keep ? 0.22 : 0.12, size: Math.max(11, cell * (op === 'mean' ? 0.3 : 0.36)) });
              if (!keep && res.shape.length < 2) {
                ctx.setLineDash([3, 3]);
                ctx.strokeStyle = withAlpha(P, 0.6);
                ctx.lineWidth = 1;
                ctx.strokeRect(tx - 1, ty - 1, cell + 2, cell + 2);
                ctx.setLineDash([]);
              }
            });
          }
          const lab = `${op}(axis=${axis}${keep ? ', keepdims=True' : ''}) -> shape ${shapeStr(res.shape)}`;
          haloText(ctx, lab, w / 2, hh - 12, color('--ink-2'), mono(Math.max(11, Math.min(13, w / 44)), 600), 'center');
        });
        const anim = f.loop((dt) => {
          t = Math.min(1, t + dt * 1.8);
          cv.redraw();
          if (t >= 1) return false;
        });
        const sync = (animate = true) => {
          const res = result();
          const args = [axis === 'None' ? '' : `axis=${axis}`, keep ? 'keepdims=True' : ''].filter(Boolean).join(', ');
          f.code.setMany({ call: `A.${op}(${args})`, res: res.shape.length === 0 ? show(res.vals[0]!) : listText(res.vals, res.shape, show), shape: shapeStr(res.shape) });
          if (animate) {
            t = 0;
            anim.start();
          } else cv.redraw();
        };
        f.segmented({ label: 'op', options: (['sum', 'mean', 'max', 'argmax'] as Op[]).map((o) => ({ value: o, label: o })), value: 'sum', onChange: (v) => { op = v; sync(); } });
        f.segmented({ label: 'axis', options: [{ value: 'None', label: 'None' }, { value: '0', label: '0' }, { value: '1', label: '1' }], value: '0', onChange: (v) => { axis = v; sync(); } });
        f.toggle({ label: 'keepdims', value: false, onChange: (v) => { keep = v; sync(false); } });
        sync(false);
      },
      caption: `Pick an operation and an axis, and watch the values slide together. \`axis=0\` squeezes each column down to one number; \`axis=1\` squeezes each row; \`None\` squeezes everything. For \`max\` and \`argmax\` the winning cells light up gold: \`argmax\` reports *where* the winner sits (a row index for \`axis=0\`, a column index for \`axis=1\`), which is how a classifier turns a row of scores into a predicted label. Turn on **keepdims** and notice the shape keep its collapsed axis as a 1, drawn with a solid border.`,
    });

    // ------------------------------------------------------------------ broadcasting
    p.h2('Broadcasting', 'broadcasting');
    p.prose(`
What happens when you add two arrays of *different* shapes? Often, exactly what you meant. Adding a bias vector \`b\` of shape (10,) to a score matrix of shape (N, 10) adds \`b\` to every row. This is **broadcasting**: NumPy stretches the smaller array to match the larger one, without actually copying any data.

The rules, applied to the two shapes:

1. Line the shapes up **from the right**. If one has fewer axes, pad it on the left with 1s: (10,) against (N, 10) is treated as (1, 10).
2. Compare the sizes axis by axis. A pair is compatible if the sizes are **equal**, or if **one of them is 1**.
3. Every size-1 axis is stretched (repeated) to match the other. If any pair is incompatible, NumPy raises an error.`);
    p.math({
      label: 'Adding a bias to every row',
      tex: String.raw`\symscores_{ij} = (\symX\symW)_{ij} + \symb_j`,
      code: `
        X = np.random.randn(5, 3072)       # (N, D)
        W = 0.001 * np.random.randn(3072, 10)
        b = np.zeros(10)                   # (C,)
        scores = X.dot(W) + b              # (N, C) + (C,)
        scores.shape                       # (5, 10)
      `,
      terms: [
        [String.raw`(\symX\symW)_{ij}`, "example $i$'s raw score for class $j$; Assignment 1 stores `W` as (D, C), so the product is `X.dot(W)`"],
        [String.raw`\symb_j`, 'the bias of class $j$: it has no $i$ in it, so every row gets the same biases'],
      ],
      explain: 'The math says it per entry: $\\symb_j$ does not depend on $i$. Broadcasting is how NumPy reads that: the shape (C,) is padded to (1, C) and stretched down all N rows.',
    });

    p.figure({
      title: 'Broadcasting: line up from the right, stretch the 1s',
      codeTitle: 'broadcast.py',
      code: `
        A = {{adef:np.arange(12).reshape(3, 4)}}
        B = {{bdef:np.array([10, 20, 30, 40])}}
        C = A {{op:+}} B

        # A:  {{sa}}
        # B:  {{sb}}
        # C:  {{sc}}
      `,
      setup(f) {
        type Pre = { key: string; label: string; adef: string; ashape: number[]; aval: (i: number, j: number) => number; bdef: string; bshape: number[]; bval: (i: number, j: number) => number; op: '+' | '*' | '/' };
        const ar = (i: number, j: number) => i * 4 + j;
        const PRE: Pre[] = [
          { key: 'bias', label: '(3, 4) + (4,)', adef: 'np.arange(12).reshape(3, 4)', ashape: [3, 4], aval: ar, bdef: 'np.array([10, 20, 30, 40])', bshape: [4], bval: (_, j) => (j + 1) * 10, op: '+' },
          { key: 'col', label: '(3, 4) + (3, 1)', adef: 'np.arange(12).reshape(3, 4)', ashape: [3, 4], aval: ar, bdef: 'np.array([[100], [200], [300]])', bshape: [3, 1], bval: (i) => (i + 1) * 100, op: '+' },
          { key: 'outer', label: '(3, 1) * (1, 4)', adef: 'np.array([[1], [2], [3]])', ashape: [3, 1], aval: (i) => i + 1, bdef: 'np.array([[1, 2, 3, 4]])', bshape: [1, 4], bval: (_, j) => j + 1, op: '*' },
          { key: 'scalar', label: '(3, 4) + 10', adef: 'np.arange(12).reshape(3, 4)', ashape: [3, 4], aval: ar, bdef: '10', bshape: [], bval: () => 10, op: '+' },
          { key: 'norm', label: '(3, 4) / (3, 1)', adef: 'np.arange(12).reshape(3, 4)', ashape: [3, 4], aval: ar, bdef: 'A.sum(axis=1, keepdims=True)', bshape: [3, 1], bval: (i) => [6, 22, 38][i]!, op: '/' },
          { key: 'bad', label: '(3, 4) + (3,)', adef: 'np.arange(12).reshape(3, 4)', ashape: [3, 4], aval: ar, bdef: 'np.array([1, 2, 3])', bshape: [3], bval: (_, j) => j + 1, op: '+' },
        ];
        let pre = PRE[0]!;
        let t = 1;
        const pad = (s: number[]) => [...Array(2 - s.length).fill(1), ...s] as [number, number];
        const outShape = (): [number, number] | null => {
          const a = pad(pre.ashape), b = pad(pre.bshape);
          const o: number[] = [];
          for (let k = 0; k < 2; k++) {
            if (a[k] === b[k] || b[k] === 1) o.push(a[k]!);
            else if (a[k] === 1) o.push(b[k]!);
            else return null;
          }
          return o as [number, number];
        };
        const cv = f.canvas(640, 400, (ctx, w, hh) => {
          const out = outShape();
          const [ar0, ac0] = pad(pre.ashape);
          const [br0, bc0] = pad(pre.bshape);
          const R = out ? out[0] : Math.max(ar0, br0);
          const Cn = out ? out[1] : Math.max(ac0, bc0);
          const cell = Math.min(w / 10.4, (hh - 46) / 7.2);
          const fs = Math.max(11, cell * 0.34);
          const Bc = color('blue'), Oc = color('orange'), Pc = color('purple'), Rd = color('red');
          const topY = cell * 0.55;
          const ax = (w - (Cn * 2 + 1.2) * cell) / 2;
          const bx = ax + Cn * cell + cell * 1.2;
          const e = t * t * (3 - 2 * t);
          const drawOperand = (x0: number, rr: number, cc: number, val: (i: number, j: number) => number, col: string) => {
            // stretched copies first, sliding out from the real cells
            if (out)
              for (let i = 0; i < R; i++)
                for (let j = 0; j < Cn; j++) {
                  if (i < rr && j < cc) continue;
                  const si = i < rr ? i : 0, sj = j < cc ? j : 0;
                  const x = x0 + (sj + (j - sj) * e) * cell;
                  const y = topY + (si + (i - si) * e) * cell;
                  ctx.globalAlpha = 0.35 + 0.35 * e;
                  ctx.setLineDash([3, 3]);
                  cellBox(ctx, x, y, cell, cell, String(val(si, sj)), col, { fill: 0.04, size: fs });
                  ctx.setLineDash([]);
                  ctx.globalAlpha = 1;
                }
            for (let i = 0; i < rr; i++)
              for (let j = 0; j < cc; j++) cellBox(ctx, x0 + j * cell, topY + i * cell, cell, cell, String(val(i, j)), col, { on: true, fill: 0.16, size: fs });
          };
          drawOperand(ax, ar0, ac0, pre.aval, Bc);
          ctx.fillStyle = color('--ink-2');
          ctx.font = mono(Math.max(15, cell * 0.55), 400);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pre.op === '*' ? '×' : pre.op === '/' ? '÷' : '+', ax + Cn * cell + cell * 0.6, topY + (R * cell) / 2);
          drawOperand(bx, br0, bc0, pre.bval, Oc);
          const labY = topY + R * cell + 14;
          haloText(ctx, `A ${shapeStr(pre.ashape)}`, ax + (Cn * cell) / 2, labY, Bc, mono(Math.max(11, Math.min(13, cell * 0.36)), 600), 'center');
          haloText(ctx, `B ${shapeStr(pre.bshape)}`, bx + (Cn * cell) / 2, labY, Oc, mono(Math.max(11, Math.min(13, cell * 0.36)), 600), 'center');
          const by = labY + cell * 0.55;
          if (out) {
            const cx = (w - Cn * cell) / 2;
            ctx.fillStyle = color('--ink-2');
            ctx.font = mono(Math.max(15, cell * 0.55), 400);
            ctx.textAlign = 'center';
            ctx.fillText('=', cx - cell * 0.55, by + (R * cell) / 2);
            for (let i = 0; i < R; i++)
              for (let j = 0; j < Cn; j++) {
                const a = pre.aval(i < ar0 ? i : 0, j < ac0 ? j : 0);
                const b = pre.bval(i < br0 ? i : 0, j < bc0 ? j : 0);
                const v = pre.op === '+' ? a + b : pre.op === '*' ? a * b : a / b;
                ctx.globalAlpha = e;
                cellBox(ctx, cx + j * cell, by + i * cell, cell, cell, fmt(v, 2), Pc, { on: true, fill: 0.14, size: Math.max(11, cell * (pre.op === '/' ? 0.3 : 0.34)) });
                ctx.globalAlpha = 1;
              }
            haloText(ctx, `C ${shapeStr(out)}`, w / 2, by + R * cell + 14, Pc, mono(Math.max(11, Math.min(13, cell * 0.36)), 600), 'center');
          } else {
            const bw = Math.min(w - 20, cell * 8);
            const bh = cell * 1.9;
            const x = (w - bw) / 2;
            ctx.beginPath();
            ctx.roundRect(x, by + 4, bw, bh, 10);
            ctx.fillStyle = withAlpha(Rd, 0.08);
            ctx.fill();
            ctx.strokeStyle = Rd;
            ctx.setLineDash([5, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
            haloText(ctx, 'ValueError: cannot broadcast', w / 2, by + 4 + bh * 0.33, Rd, mono(Math.max(11, Math.min(13, w / 44)), 600), 'center');
            haloText(ctx, `last axes: ${ac0} vs ${bc0}, neither is 1`, w / 2, by + 4 + bh * 0.68, Rd, ui(Math.max(11, Math.min(13, w / 44)), 500), 'center');
          }
        });
        const anim = f.loop((dt) => {
          t = Math.min(1, t + dt * 1.3);
          cv.redraw();
          if (t >= 1) return false;
        });
        const dimsTxt = (s: number[]) => (s.length === 0 ? '(a scalar)' : s.join(' x '));
        const sync = (animate = true) => {
          const out = outShape();
          const width = 9;
          const right = (s: string) => s.padStart(width);
          const note = (s: number[]) => {
            const ps = pad(s);
            if (!out) return '';
            const stretched = ps.map((d, k) => (d === 1 && out[k] !== 1 ? k : -1)).filter((k) => k >= 0);
            if (s.length < 2 && stretched.length) return `   treated as ${pad(s).join(' x ')}, stretched`;
            if (stretched.length) return '   size-1 axis stretched';
            return '';
          };
          f.code.setMany({
            adef: pre.adef,
            bdef: pre.bdef,
            op: pre.op,
            sa: right(dimsTxt(pre.ashape)) + note(pre.ashape),
            sb: right(dimsTxt(pre.bshape)) + note(pre.bshape),
            sc: out ? right(out.join(' x ')) : `ValueError: shapes ${shapeStr(pre.ashape).replace(/ /g, '')} ${shapeStr(pre.bshape).replace(/ /g, '')} don't line up`,
          });
          f.code.highlight(out ? null : 7, 'alt');
          if (animate) {
            t = 0;
            anim.start();
          } else cv.redraw();
        };
        f.segmented({
          label: 'shapes',
          options: PRE.map((q) => ({ value: q.key, label: q.label })),
          value: 'bias',
          onChange: (v) => {
            pre = PRE.find((q) => q.key === v)!;
            sync();
          },
        });
        f.button('Replay', () => {
          t = 0;
          anim.start();
        }, { icon: 'reset' });
        sync(false);
      },
      caption: `Pick a pair of shapes. The solid cells are the real data; the dashed ones are the copies broadcasting *pretends* exist, sliding out along every size-1 axis (no memory is actually used for them). The comments in the code line the shapes up from the right, which is the whole rule. \`(3, 1) * (1, 4)\` stretches *both* operands into a multiplication table. \`(3, 4) / (3, 1)\` is row normalization with \`keepdims\`. And \`(3, 4) + (3,)\` fails, because lined up from the right, 3 meets 4.`,
    });

    p.prose(`### Idioms you will use constantly`);
    p.code(`
      X -= X.mean(axis=0)          # (N, D) - (D,): subtract the mean image
      X /= X.std(axis=0)           # (N, D) / (D,): unit spread per pixel

      probs = np.exp(scores)
      probs /= probs.sum(axis=1, keepdims=True)   # (N, C) / (N, 1)

      col = np.arange(3)[:, None]  # (3, 1): None inserts a new axis of size 1
      row = np.arange(4)[None, :]  # (1, 4)
      table = col * 10 + row       # (3, 4), every pair, no loops
    `, { title: 'broadcasting_idioms.py' });
    p.prose(`
### The distance trick

Assignment 1 asks you to compute the distance from every test image to every training image without a single loop. The trick is to expand the square. For one pair of vectors, $\\|x - t\\|^2 = \\|x\\|^2 - 2\\,x \\cdot t + \\|t\\|^2$ (multiply it out and check). Each of the three terms can be computed for *all* pairs at once, and broadcasting glues them together.`);
    p.math({
      label: 'All distances, no loops',
      tex: String.raw`\begin{aligned} \symdists_{ij}^{\,2} = &\underbrace{\|\symX_i\|^2}_{(N,\,1)} \;-\; 2\,\underbrace{\symX_i \cdot \sym{X}{X^{\mathrm{tr}}_j}}_{(N,\,M)} \\ &+\; \underbrace{\|\sym{X}{X^{\mathrm{tr}}_j}\|^2}_{(M,)} \end{aligned}`,
      code: `
        # X: (N, D) test images, Xtr: (M, D) training
        x2 = (X ** 2).sum(axis=1, keepdims=True)  # (N, 1)
        t2 = (Xtr ** 2).sum(axis=1)              # (M,)
        cross = X.dot(Xtr.T)                     # (N, M)
        dists = np.sqrt(x2 - 2 * cross + t2)     # (N, M)
      `,
      terms: [
        [String.raw`\|\symX_i\|^2`, 'the squared length of each test image: a column of $N$ numbers, shape (N, 1)'],
        [String.raw`\symX_i \cdot \sym{X}{X^{\mathrm{tr}}_j}`, 'every test image dotted with every training image: one matrix product, shape (N, M)'],
        [String.raw`\|\sym{X}{X^{\mathrm{tr}}_j}\|^2`, 'the squared length of each training image: shape (M,), lined up as a row'],
      ],
      explain: 'Broadcasting does the rest: (N, 1) and (N, M) and (M,) all line up as (N, M). Nearly all of the work is the middle term, a single matrix multiply, and matrix multiplication is among the most heavily optimized code in existence. That is why this version runs a hundred or more times faster than the double loop (measured below). One practical caveat: rounding can push a tiny squared distance slightly below zero, so robust code clips with `np.maximum(..., 0)` before the square root.',
    });

    // ------------------------------------------------------------------ reshape
    p.h2('Reshape, transpose and image layouts', 'reshape');
    p.prose(`
\`reshape\` reinterprets the same numbers with a new shape. NumPy reads the numbers in **row-major order** (the *last* axis changes fastest, like reading a book: along a row, then down to the next) and pours them into the new shape in that same order. The total count must not change; write \`-1\` for one axis and NumPy works it out. \`transpose\` (or \`.T\`) reorders the axes instead.`);
    p.code(`
      v = np.arange(6)          # [0 1 2 3 4 5]
      M = v.reshape(2, 3)       # [[0 1 2]
                                #  [3 4 5]]
      v.reshape(3, -1)          # -1 means "whatever fits": shape (3, 2)
      M.T                       # transpose: shape (3, 2), [[0 3] [1 4] [2 5]]
      M.ravel()                 # flatten: [0 1 2 3 4 5] (a view when possible)
      M.flatten()               # the same values, always a copy
      v[:, None].shape          # (6, 1): add an axis of size 1
      np.stack([v, v]).shape    # (2, 6): a new leading axis
      np.concatenate([v, v])    # [0 1 2 3 4 5 0 1 2 3 4 5]
    `, { title: 'reshape.py' });
    p.prose(`
### Images as arrays

A color image is a 3-D array. The assignments load CIFAR-10 as shape (32, 32, 3): height, width, channels, or **HWC**. So \`img[r, c]\` is one pixel's [red, green, blue] triple. The raw CIFAR files, and the convolution layers you will write in Assignment 2, use channels-first instead, **CHW**, shape (3, 32, 32), where \`img[0]\` is the entire red plane. \`transpose\` converts between the two.

A linear classifier wants each image as a single vector of 3072 numbers, and a batch of N images as an (N, 3072) matrix: \`X_train.reshape(N, -1)\`. Where does each pixel end up in that vector? Row-major order answers it exactly:`);
    p.math({
      label: 'Where a pixel lands',
      tex: String.raw`\begin{gathered} k_{\text{HWC}} = (r \cdot 32 + c)\cdot 3 + ch \\[6pt] k_{\text{CHW}} = ch \cdot 1024 + r \cdot 32 + c \end{gathered}`,
      code: `
        img = np.random.rand(32, 32, 3)   # HWC
        r, c, ch = 5, 7, 2

        x = img.reshape(3072)
        k = (r * 32 + c) * 3 + ch         # 503
        x[k] == img[r, c, ch]             # True

        x = img.transpose(2, 0, 1).reshape(3072)
        k = ch * 1024 + r * 32 + c        # 2215
        x[k] == img[r, c, ch]             # True
      `,
      terms: [
        [String.raw`r \cdot 32 + c`, 'which pixel it is, counting along the rows: 32 pixels per row'],
        [String.raw`(\cdots)\cdot 3 + ch`, "HWC keeps each pixel's three channel values side by side"],
        [String.raw`ch \cdot 1024`, 'CHW stores all 1024 red values first, then all green, then all blue'],
      ],
      explain: 'Row-major order means the *last* axis varies fastest. In HWC the last axis is the channel, so the flat vector runs r, g, b, r, g, b, and so on; in CHW the last axis is the column, so it runs through an entire channel plane before starting the next. A linear classifier works with either layout, as long as every image uses the same one. Mixing them up silently scrambles your data.',
    });

    p.figure({
      title: 'One CIFAR-10 image, flattened two ways',
      layout: 'stack',
      codeTitle: 'flatten_image.py',
      code: `
        img = X_train[{{idx:0}}]       # (32, 32, 3): height, width, channels
        r, c = {{r:12}}, {{c:20}}
        img[r, c]                      # {{rgb}}: one pixel

        x = img.reshape(3072)          # HWC: r, g, b, r, g, b, ...       #@hwc
        k = (r * 32 + c) * 3           # {{khwc}}: red; green k+1, blue k+2   #@hwc

        chw = img.transpose(2, 0, 1)   # (3, 32, 32): channels first      #@chw
        x = chw.reshape(3072)          # 1024 reds, greens, then blues    #@chw
        k = r * 32 + c                 # {{kchw}}: red; green k+1024, blue k+2048   #@chw

        X = X_train.reshape(N, -1)     # a batch of N images: (N, 3072)
      `,
      setup(f) {
        let set: CifarSet | null = null;
        let idx = 0;
        let r = 12, c = 20;
        let chw = false;
        let geo = { ix: 0, iy: 0, S: 1, sx: 0, sy: 0, cw: 1 };
        const COLS = 96;
        const pix = (ch: number, rr: number, cc: number) => (set ? set.pixels[idx * 3072 + ch * 1024 + rr * 32 + cc]! : 0);
        const cv = f.canvas(640, 540, (ctx, w, hh) => {
          if (!set) return;
          const S = Math.min(w * 0.36, hh - 62 - w / 3);
          const ix = 0, iy = 4;
          // the image
          const tmp = document.createElement('canvas');
          tmp.width = tmp.height = 32;
          const img = new ImageData(32, 32);
          for (let q = 0; q < 1024; q++) {
            for (let ch = 0; ch < 3; ch++) img.data[q * 4 + ch] = set.pixels[idx * 3072 + ch * 1024 + q]!;
            img.data[q * 4 + 3] = 255;
          }
          tmp.getContext('2d')!.putImageData(img, 0, 0);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tmp, ix, iy, S, S);
          const ps = S / 32;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(ix + c * ps - 1, iy + r * ps - 1, ps + 2, ps + 2);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.strokeRect(ix + c * ps - 2.5, iy + r * ps - 2.5, ps + 5, ps + 5);
          haloText(ctx, `${CIFAR_CLASSES[set.labels[idx]!]} #${idx}`, ix, iy + S + 13, color('--ink-2'), mono(Math.max(11, Math.min(13, w / 48)), 500), 'left');
          // the pixel's three values
          const px = ix + S + Math.max(14, w * 0.04);
          const pw = w - px;
          const chans = ['red', 'green', 'blue'];
          const ccol = ['#e5484d', '#30a46c', '#3e63dd'];
          const bh = Math.max(22, Math.min(30, S / 4.2));
          haloText(ctx, `img[${r}, ${c}] = [${[0, 1, 2].map((ch) => pix(ch, r, c)).join(', ')}]`, px, iy + 10, color('--ink'), mono(Math.max(11, Math.min(14, w / 42)), 600), 'left');
          const kH = (r * 32 + c) * 3;
          const kC = r * 32 + c;
          for (let ch = 0; ch < 3; ch++) {
            const y = iy + 26 + ch * (bh + 6);
            const v = pix(ch, r, c);
            ctx.fillStyle = withAlpha(color('--ink-3'), 0.12);
            ctx.fillRect(px, y, pw * 0.5, bh);
            ctx.fillStyle = ccol[ch]!;
            ctx.fillRect(px, y, (pw * 0.5 * v) / 255, bh);
            const k = chw ? kC + ch * 1024 : kH + ch;
            haloText(ctx, `${chans[ch]} ${v}  ->  x[${k}]`, px + 6, y + bh / 2, color('--ink'), mono(Math.max(11, Math.min(13, w / 46)), 500), 'left');
          }
          const note = chw ? 'CHW: the three values sit 1024 apart' : 'HWC: the three values sit side by side';
          const noteY = iy + 26 + 3 * (bh + 6) + 10;
          haloText(ctx, note, px, noteY, color('--ink-2'), ui(Math.max(11, Math.min(13, w / 46)), 600), 'left');
          // the flat vector, wrapped at COLS entries per row
          const sy = Math.max(iy + S + 30, noteY + 16);
          const cw = w / COLS;
          const rowsN = 3072 / COLS;
          geo = { ix, iy, S, sx: 0, sy, cw };
          const strip = new ImageData(COLS, rowsN);
          for (let k = 0; k < 3072; k++) {
            let ch: number, q: number;
            if (chw) {
              ch = Math.floor(k / 1024);
              q = k % 1024;
            } else {
              ch = k % 3;
              q = Math.floor(k / 3);
            }
            const v = set.pixels[idx * 3072 + ch * 1024 + q]!;
            strip.data[k * 4 + ch] = v;
            strip.data[k * 4 + 3] = 255;
          }
          const t2 = document.createElement('canvas');
          t2.width = COLS;
          t2.height = rowsN;
          t2.getContext('2d')!.putImageData(strip, 0, 0);
          ctx.drawImage(t2, 0, sy, w, rowsN * cw);
          if (chw)
            for (let ch = 0; ch < 3; ch++) {
              const k0 = ch * 1024;
              const yy = sy + Math.floor(k0 / COLS) * cw;
              haloText(ctx, `x[${k0}:${k0 + 1024}] ${chans[ch]}`, w - 4, yy + cw * 1.6, color('--ink'), mono(11, 600), 'right');
            }
          for (let ch = 0; ch < 3; ch++) {
            const k = chw ? kC + ch * 1024 : kH + ch;
            const kx = (k % COLS) * cw, ky = sy + Math.floor(k / COLS) * cw;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(kx - 2, ky - 2, cw + 4, cw + 4);
            ctx.strokeStyle = ccol[ch]!;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(kx - 3.5, ky - 3.5, cw + 7, cw + 7);
          }
          haloText(ctx, w < 500 ? `x: 3072 numbers (${chw ? 'CHW' : 'HWC'}), ${COLS} per row` : `x: 3072 numbers in ${chw ? 'CHW' : 'HWC'} order, wrapped every ${COLS} for display`, w / 2, sy + rowsN * cw + 13, color('--ink-2'), ui(Math.max(11, Math.min(13, w / 50)), 500), 'center');
        });
        cv.canvas.classList.add('scroll-ok');
        const pick = (e: MouseEvent) => {
          const rc = cv.canvas.getBoundingClientRect();
          const mx = e.clientX - rc.left, my = e.clientY - rc.top;
          if (mx >= geo.ix && mx < geo.ix + geo.S && my >= geo.iy && my < geo.iy + geo.S) {
            c = Math.min(31, Math.floor(((mx - geo.ix) / geo.S) * 32));
            r = Math.min(31, Math.floor(((my - geo.iy) / geo.S) * 32));
          } else if (my >= geo.sy && my < geo.sy + 32 * geo.cw) {
            const k = Math.floor((my - geo.sy) / geo.cw) * COLS + Math.min(COLS - 1, Math.floor(mx / geo.cw));
            const q = chw ? k % 1024 : Math.floor(k / 3);
            r = Math.floor(q / 32);
            c = q % 32;
          } else return;
          sync();
        };
        cv.canvas.addEventListener('click', pick);
        cv.canvas.addEventListener('pointermove', (e) => {
          if (e.pointerType === 'mouse' && e.buttons === 1) pick(e);
        });
        const sync = () => {
          f.code.setMany({ idx, r, c, rgb: `[${[0, 1, 2].map((ch) => pix(ch, r, c)).join(', ')}]`, khwc: (r * 32 + c) * 3, kchw: r * 32 + c });
          f.code.highlight(chw ? 'chw' : 'hwc');
          cv.redraw();
        };
        f.segmented({
          label: 'flatten as',
          options: [
            { value: 'hwc', label: 'HWC' },
            { value: 'chw', label: 'CHW' },
          ],
          value: 'hwc',
          onChange: (v) => {
            chw = v === 'chw';
            sync();
          },
        });
        const nextBtn = f.button('Next image', () => {
          if (!set) return;
          idx = (idx + 1) % set.n;
          sync();
        });
        nextBtn.disabled = true;
        f.status('Loading CIFAR-10 images…');
        loadCifar()
          .then(({ train }) => {
            set = train;
            idx = Math.max(0, Array.from(train.labels).indexOf(7));
            nextBtn.disabled = false;
            f.status('');
            sync();
          })
          .catch((e) => f.status(`Could not load CIFAR-10: ${(e as Error).message}`));
      },
      caption: `The strip at the bottom is the image as one long vector of 3072 numbers, drawn 96 per row, each value tinted by its channel. **Tap** the image (or the strip) to pick a pixel: its three values are ringed in the strip. In **HWC** order the three sit side by side, so the strip looks like a squashed copy of the picture made of red, green and blue specks. Switch to **CHW**: the strip splits into a red band, a green band and a blue band, and the same pixel's values now sit 1024 places apart. The numbers are identical; only the order differs.`,
    });

    // ------------------------------------------------------------------ vectorization
    p.h2('Vectorization: keep the loops out of Python', 'vectorization');
    p.prose(`
Python is interpreted: every pass through a loop, every \`+\`, every index carries overhead for type checks, object creation and dispatch. A NumPy call hands the whole loop to compiled code that runs over raw memory. So the rule for fast code is short: **keep the loops out of Python.** Express the computation as whole-array operations, and let NumPy do the looping.`);
    p.code(`
      import time
      v = np.random.randn(1_000_000)

      t = time.time()
      total = 0.0
      for value in v:          # a million Python steps
          total += value
      print(time.time() - t)   # roughly 0.05 s

      t = time.time()
      total = np.sum(v)        # one call into compiled code
      print(time.time() - t)   # well under a millisecond
    `, { title: 'loop_vs_numpy.py' });
    p.prose(`On the machine we measured, the loop took about 50 ms and \`np.sum\` about 0.15 ms: over 300 times faster. The exact ratio depends on the hardware and the operation, but tens to hundreds of times is typical. Assignment 1 makes you feel this with the nearest-neighbor distances, which you write three ways.`);

    p.figure({
      title: 'Three ways to fill the distance matrix',
      layout: 'stack',
      codeTitle: 'knn_distances.py',
      code: `
        # X: (N, D) test images, Xtr: (M, D) training images
        dists = np.zeros((N, M))

        # two loops: one Python step per (test, train) pair
        for i in range(N):                                             #@two
            for j in range(M):                                         #@two
                dists[i, j] = np.sqrt(np.sum((X[i] - Xtr[j]) ** 2))    #@two

        # one loop: one Python step per test image
        for i in range(N):                                             #@one
            dists[i] = np.sqrt(np.sum((Xtr - X[i]) ** 2, axis=1))      #@one

        # no loops: one Python step; the work happens in compiled code
        dists = np.sqrt((X ** 2).sum(axis=1, keepdims=True)            #@zero
                        - 2 * X.dot(Xtr.T)                             #@zero
                        + (Xtr ** 2).sum(axis=1))                      #@zero
        # Python steps so far: {{steps:0}}
      `,
      setup(f) {
        const N = 6, M = 16;
        const rng = new Rng(3);
        const D = 8;
        const Xte = Array.from({ length: N }, () => Array.from({ length: D }, () => rng.randn()));
        const Xtr = Array.from({ length: M }, () => Array.from({ length: D }, () => rng.randn()));
        const dist = Xte.map((a) => Xtr.map((b) => Math.sqrt(a.reduce((s, v, k) => s + (v - b[k]!) ** 2, 0))));
        const lo = Math.min(...dist.flat()), hi = Math.max(...dist.flat());
        let mode: 'two' | 'one' | 'zero' = 'two';
        let filled = 0;
        let steps = 0;
        let acc = 0;
        const cellsPerStep = () => (mode === 'two' ? 1 : mode === 'one' ? M : N * M);
        const cv = f.canvas(640, 300, (ctx, w, hh) => {
          const cell = Math.min((w - 70) / M, (hh - 56) / N);
          const x0 = (w - M * cell) / 2 + 18;
          const y0 = 30;
          const T = color('teal');
          ctx.font = ui(11, 500);
          ctx.fillStyle = color('--ink-3');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`training images j = 0 … ${M - 1}`, x0 + (M * cell) / 2, y0 - 14);
          ctx.save();
          ctx.translate(x0 - 14, y0 + (N * cell) / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText('test i', 0, 0);
          ctx.restore();
          for (let i = 0; i < N; i++)
            for (let j = 0; j < M; j++) {
              const k = i * M + j;
              const done = k < filled;
              const tt = (dist[i]![j]! - lo) / (hi - lo);
              ctx.fillStyle = done ? withAlpha(T, 0.15 + 0.75 * tt) : withAlpha(color('--ink-3'), 0.08);
              ctx.fillRect(x0 + j * cell + 1, y0 + i * cell + 1, cell - 2, cell - 2);
              const justNow = done && k >= filled - cellsPerStep() && filled < N * M;
              if (justNow) {
                ctx.strokeStyle = color('--ink');
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x0 + j * cell + 1, y0 + i * cell + 1, cell - 2, cell - 2);
              }
            }
          const total = mode === 'two' ? N * M : mode === 'one' ? N : 1;
          haloText(ctx, `Python-level steps: ${steps} of ${total}`, w / 2, y0 + N * cell + 16, color('--ink'), mono(Math.max(11, Math.min(13, w / 50)), 600), 'center');
        });
        const STEP_MS = 55;
        const run = f.loop((dt) => {
          acc += dt * 1000;
          while (acc >= STEP_MS && filled < N * M) {
            acc -= STEP_MS;
            filled = Math.min(N * M, filled + cellsPerStep());
            steps++;
          }
          f.code.set('steps', steps);
          cv.redraw();
          if (filled >= N * M) {
            f.status(`Done in **${steps}** Python-level step${steps > 1 ? 's' : ''}. At Assignment 1's sizes (500 test images, 5,000 training images) that would be **${mode === 'two' ? '2,500,000' : mode === 'one' ? '500' : '1'}**.`);
            return false;
          }
        });
        const reset = () => {
          run.stop();
          filled = 0;
          steps = 0;
          acc = STEP_MS;
          f.code.set('steps', 0);
          f.status('');
          cv.redraw();
        };
        f.segmented({
          label: 'version',
          options: [
            { value: 'two', label: 'two loops' },
            { value: 'one', label: 'one loop' },
            { value: 'zero', label: 'no loops' },
          ],
          value: 'two',
          onChange: (v) => {
            mode = v;
            f.code.highlight(mode);
            reset();
          },
        });
        f.button('Run', () => {
          reset();
          run.start();
        }, { primary: true, icon: 'play' });
        f.code.highlight('two');
        reset();
      },
      caption: `Each square is one entry of \`dists\`, shaded by distance. Every **Python-level step** (one trip around a Python loop, or one call into NumPy) has a fixed overhead, so here each step takes the same time. With **two loops** the matrix fills one cell per step, with **one loop** a whole row per step, and with **no loops** all at once. The amount of arithmetic is the same in every version; what changes is how many times Python itself has to get involved.`,
    });
    p.table(
      ['Version', 'Python-level steps (500 × 5,000)', 'Time we measured'],
      [
        ['two loops', '2,500,000', 'about 6 s'],
        ['one loop', '500', 'about 5 s'],
        ['no loops', 'a handful', 'about 0.04 s'],
      ],
      { caption: "Assignment 1's sizes: 500 test images, 5,000 training images, 3072 numbers each. Measured with NumPy 2.5 on an Apple-silicon desktop in 2026; your times will differ, but the ratio is the point. The one-loop version is barely faster than two loops because every step still builds a temporary (5000, 3072) array; the no-loop version wins by turning the work into one big matrix multiply." },
    );
    p.callout('intuition', 'When you vectorize, think in shapes, not in indices. Write down the shape of each input, decide the shape of the answer, and look for operations that get you from one to the other: a matrix product to combine every row with every row, a reduction to collapse an axis, broadcasting to apply something along an axis, integer-array indexing to pick one item per row. Then check your vectorized version against the slow loop on a small input with `np.allclose`.', 'How to vectorize');

    // ------------------------------------------------------------------ pitfalls
    p.h2('Common pitfalls', 'pitfalls');
    p.prose(`### Views versus copies`);
    p.code(`
      a = np.arange(6)
      s = a[1:4]          # basic slicing returns a VIEW, not a copy
      s[0] = 99
      a                   # [ 0 99  2  3  4  5]: a changed too!

      c = a[1:4].copy()   # an explicit copy is independent
      d = a[[1, 2, 3]]    # integer-array and mask indexing always copy
      e = a.reshape(2, 3) # reshape and .T usually return views as well
    `, { title: 'views.py' });
    p.prose(`A view costs nothing (no numbers are copied), which is part of why slicing is fast. The price is that writing through it changes the original. In the assignments this bites when a function modifies an array it was handed: call \`.copy()\` first if you need to change it.`);
    p.prose(`### dtype surprises`);
    p.code(`
      z = np.zeros(3, dtype=np.int64)
      z[0] = 0.9                   # silently truncated: z is [0 0 0]

      np.array([1, 2, 3]) / 2      # [0.5 1.  1.5]: / always gives floats
      np.array([1, 2, 3]) // 2     # [0 1 1]

      px = np.array([200, 100], dtype=np.uint8)   # raw pixel values
      px + px                      # [144 200]: uint8 wraps around at 256!
      px.astype(np.float64) + px   # [400. 200.]: convert first
    `, { title: 'dtypes.py' });
    p.prose(`Image data arrives as \`uint8\`, where 200 + 200 wraps around to 144 without any warning. Convert to \`float64\` (or \`float32\`) before doing any arithmetic; the assignment's data loader does exactly that.`);
    p.prose(`### Shape (N,) versus (N, 1)`);
    p.code(`
      v = np.array([1, 2, 3])
      v.shape              # (3,): 1-D, neither a row nor a column
      v.T.shape            # (3,): transposing a 1-D array does nothing!
      col = v[:, None]     # (3, 1), the same as v.reshape(-1, 1)
      row = v[None, :]     # (1, 3)

      (v + col).shape      # (3, 3)!  broadcasting built a table
    `, { title: 'shapes.py' });
    p.callout('warning', 'That last line is the nastiest bug in this chapter: no error, just a silently wrong (3, 3) result where you expected (3,). It typically happens when one array has shape (N,) and another, say from `keepdims=True`, has shape (N, 1). If a shape surprises you, print it, and sprinkle `assert scores.shape == (N, C)` lines through your code: they are cheap insurance.', 'Silent broadcasting');

    // ------------------------------------------------------------------ plotting
    p.h2('Plotting with matplotlib', 'plotting');
    p.prose(`The assignments use **matplotlib** for loss curves, accuracy plots and image grids. A handful of calls covers nearly everything:`);
    p.code(`
      import matplotlib.pyplot as plt

      xs = np.linspace(-3, 3, 100)
      plt.plot(xs, np.maximum(0, xs), label='ReLU')
      plt.plot(xs, np.tanh(xs), label='tanh')
      plt.xlabel('x'); plt.legend(); plt.show()

      plt.plot(loss_history)                   # a training curve
      plt.xlabel('iteration'); plt.ylabel('loss')
      plt.show()

      plt.imshow(X_train[0].astype('uint8'))   # an HWC image, values 0..255
      plt.axis('off')                          # hide the ticks
      plt.show()

      for i in range(10):                      # a 2 x 5 grid of images
          plt.subplot(2, 5, i + 1)
          plt.imshow(X_train[i].astype('uint8'))
          plt.axis('off')
      plt.show()
    `, { title: 'plotting.py' });
    p.prose(`\`imshow\` expects an HWC image with either integers from 0 to 255 or floats from 0 to 1, which is why the assignments cast pixel data back to \`uint8\` before showing it.`);

    p.callout('idea', `
- An array is a typed grid with a **shape**. Predict the shape of every result before you compute it; most bugs show up as a surprising shape first.
- Index with one entry per axis. Integers drop their axis, slices keep it, and slices are **views**. \`scores[np.arange(N), y]\` pairs rows with labels.
- \`*\` is elementwise, \`@\` or \`.dot\` is the matrix product. Reductions take \`axis=k\`, and axis \`k\` is the one that disappears.
- Broadcasting lines shapes up from the right and stretches the 1s: it adds biases, centers data and builds the distance table of Assignment 1.
- Loops in Python are slow; whole-array operations are tens to hundreds of times faster. Vectorize, then check against the loop with \`np.allclose\`.`, 'Takeaways');
  },
};

export default chapter;
