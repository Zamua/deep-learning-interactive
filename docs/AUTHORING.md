# Authoring a chapter

This is the contract every chapter follows. Read it fully, then read
`src/chapters/linear-classification.ts`: it is the reference chapter and shows every
pattern below in working form.

## The course

An interactive companion to Stanford CS231n as taught in Winter 2016 (Karpathy, Johnson,
Fei-Fei Li). It follows the 2016 lectures and the course notes at cs231n.github.io.

**Audience:** a capable programmer whose math stopped at Calculus 1, a long time ago.
Explain every equation in plain words. Never assume they remember what a partial derivative,
a sum symbol, a matrix product, a log, or an expectation is: say it, briefly, every time it
matters (link to `#/math-kit` for the long version).

## Hard rules

1. **Every visualization has code beside it.** Use `p.figure(...)`; it always renders the viz
   and a Python listing side by side (stacked on phones). No canvas, chart or diagram may
   appear anywhere else. The code must be the computation the figure shows, written as
   CS231n-style Python/NumPy, and the figure must drive it: mirror live values into `{{slots}}`,
   and light the running line with `#@labels` when stepping or animating.
2. **Every display equation has code beside it.** Use `p.math(...)` with `code`, `terms`
   (piece-by-piece reading) and `explain` (plain words). Never put `$$...$$` display math in
   prose. Inline `$...$` in prose is fine for symbols and tiny expressions.
3. **Relate math to code.** Use the chapter's `symbols` so the same quantity has the same
   color in TeX, code and prose. The reader hovers `W` in an equation and every `W` in code
   lights up. Name code variables to match the math where reasonable.
4. **No em dashes** (the character U+2014) anywhere: prose, captions, code comments. Use a
   colon, parentheses, a comma, or two sentences. Plain hyphens are fine.
5. **Original wording.** Cover the same material as the 2016 notes and lectures, but write it
   yourself; do not paste passages from cs231n.github.io. Short code idioms that are standard
   (e.g. `np.maximum(0, x)`) are fine.
6. **Accurate.** This is a course. Numbers, formulas, architecture details, dates and who did
   what must be right. If unsure, say less rather than invent.
7. **Phone first.** The reader is often on an iPhone. Interactions must work by tap and drag;
   text in canvases at least 11px; nothing wider than the screen. Keep per-frame compute small
   (a few ms); training loops do a few steps per frame and stop at a sensible point.

## File layout and lanes

- A chapter is one file: `src/chapters/<id>.ts`, default-exporting a `ChapterDef`. The id,
  number, title, part and blurb already live in `src/chapters/index.ts`; do not edit that file.
- Chapter-specific helpers that grow large may go in `src/lib/<id>-<name>.ts`.
- Data or model files go in `public/data/<id>-*.{bin,json}` (fetch with `fetch('./data/...')`)
  and images in `public/img/<id>-*.{jpg,png}`. Keep each chapter's assets under ~1.5 MB total.
- **Do not edit** anything under `src/core/`, `src/styles/`, `src/main.ts`, `src/home.ts`,
  `src/chapters/index.ts`, or another chapter. If the core needs a change, work around it
  locally and describe the needed change in your final report.

## Chapter skeleton

```ts
import type { ChapterDef } from './index';

const chapter: ChapterDef = {
  symbols: {
    W: { color: 'blue', name: 'W: the weights, one row per class' },
    x: { color: 'orange', name: 'x: the input', code: ['x', 'X'] },
    lam: { color: 'slate', name: 'λ: regularization strength', tex: '\\lambda', code: ['reg'] },
  },
  render(p) {
    p.prose(`Intro paragraph...`);
    p.h2('First section', 'first-section');
    p.math({ ... });
    p.figure({ ... });
    p.callout('idea', '...', 'Takeaways');
  },
};
export default chapter;
```

### Symbols

`symbols` maps a key (letters and digits only) to `{ color, name, tex?, code? }`.

- `color`: one of `blue orange green purple red teal gold slate`.
- `name`: shown in a tooltip when the symbol is hovered or tapped. Write it as
  "W: the weights, one row per class".
- `tex`: TeX for the `\sym<key>` shorthand (default: the key).
- `code`: identifiers in code that ARE this symbol (default: `[key]`). Every matching
  identifier in every listing on the page gets colored, so do not map generic names (`i`,
  `n`, `out`) or names you also use for something else.

In TeX: `\symW` (shorthand, renders the symbol's `tex`; only for keys made of letters,
since a TeX command name cannot contain digits) or `\sym{W}{W_{ij}}` (explicit content,
e.g. with subscripts). For an indicator function write `\mathbf{1}` (KaTeX has no
blackboard-bold 1). Shorthands are greedy macro names, so write `\symW x` or
`\symW{}x`, never `\symWx`. Remember `String.raw` for TeX in TS strings, or double the
backslashes inside normal template strings (prose uses normal strings, so `$\\symW$`).

In prose markdown, a backticked identifier that is in some symbol's `code` list is linked:
`` `W` ``.

Use 4 to 8 symbols per chapter for the quantities that matter. Colors are per chapter, but
keep the course-wide habits: weights `blue`, inputs `orange`, biases `green`, scores or
outputs `purple`, loss `red`, gradients `teal`, labels `gold`, hyperparameters `slate`.

## Page API (`p`)

- `p.prose(md)`: markdown dialect: blank-line paragraphs, `- ` / `1. ` lists, `### h3`,
  `**bold**`, `*italic*`, `` `code` ``, `[text](url)`, `$inline tex$`. A block starting with
  `<` passes through as raw HTML. Write `\\$` for a literal dollar sign.
- `p.h2(title, id)`: a section; it also feeds the "On this page" list. Give a short
  kebab-case id.
- `p.callout(kind, md, title?)`: kinds `idea` (key takeaway), `intuition`, `warning`,
  `aside`, `math` (math help for the non-expert), `history`. End each chapter with an `idea`
  callout titled "Takeaways".
- `p.math({ label, tex, code, codeTitle?, terms, explain })`: an equation card. `terms` is a
  list of `[texFragment, markdownMeaning]` read in order: walk the equation left to right,
  piece by piece. `explain` is the plain-words version.
- `p.code(src, { title, bare })`: a standalone listing (for longer code with no picture).
- `p.table(head, rows, { caption })`: cells are markdown.
- `p.figure({ title, code, codeTitle?, layout?, caption, setup(f) })`: see below.
- `p.md(src)` / `p.tex(src)`: render to an HTML string, for hand-built DOM.

## Figures (`f` inside `setup`)

```ts
p.figure({
  title: 'Gradient descent on a bowl',
  codeTitle: 'descent.py',
  code: `
    w = np.array([{{w0:-1.5}}, {{w1:1.2}}])
    for step in range(100):
        grad = loss_grad(w)        #@grad
        w -= {{lr:0.1}} * grad      #@update
  `,
  setup(f) {
    const pl = f.plot({ aspect: 1.2, domain: [-2, 2, -2, 2], draw: (pl) => { ... } });
    f.slider({ label: 'learning rate', min: 0.01, max: 1, value: 0.1, slot: 'lr', onInput: (v) => { ... } });
    const run = f.loop((dt) => { ...; f.code.highlight('update'); pl.redraw(); });
    f.button('Run', () => run.start(), { primary: true });
  },
  caption: 'What it shows, then what to try. Markdown.',
});
```

Code listing markup (inside `code`):

- `{{name}}` or `{{name:initial}}` is a live slot: `f.code.set('name', value)` or
  `f.code.setMany({...})` rewrites it (numbers are formatted compactly; pass strings to control
  formatting with `fmt(v, digits)` from `core/code`). Sliders and segmented controls with a
  `slot` option update their slot automatically.
- A trailing `#@label` (or `#@a,b`) tags a line; `f.code.highlight('label')`,
  `f.code.highlight(['a', 'b'])`, `f.code.highlight(7)` (line number) or `null` lights lines.
  `highlight(sel, 'alt')` uses a second (teal) highlight for "the other thing".
- Code is dedented automatically. Keep lines under ~70 characters so phones need little
  horizontal scrolling; put long explanations in the caption, not in comments.

Panes and builders:

- `f.plot({ aspect?, height?, domain?, square?, draw })` returns a `Plot` (data coordinates,
  y up): `sx/sy` map data to CSS px, `pointer(e)` maps an event back, `axes({grid, labels})`,
  `dot`, `path`, `fn(f)` (graph y=f(x)), `arrow`, `text(s, x, y, {align, base, size, mono, bold, color})`,
  `field((x,y) => [r,g,b,a], cellPx)` (heatmaps, decision regions), `setDomain`, `view()`,
  `ctx` for raw canvas 2D calls in CSS px. **The first draw happens on the next frame, never in
  the constructor**; call `pl.redraw()` after changing state. `square: false` lets x and y
  scale independently (charts).
- `f.canvas(w, h, (ctx, w, h) => ...)` returns `{ canvas, redraw }`: a HiDPI canvas with
  aspect `w:h`, drawn in CSS px, for diagrams and pixel grids.
- Interactive canvases block page scrolling while touched (`touch-action: none`). For a
  canvas that only needs taps, add `canvas.classList.add('scroll-ok')` so the page still
  scrolls over it on phones.
- `f.slider({ label, min, max, step?, value, onInput, slot?, map?, format?, sym? })`
  (`map` for log scales: `min: -4, max: 0, map: (r) => 10 ** r`).
- `f.segmented({ label?, options: [{ value, label }], value, onChange, slot? })`.
- `f.toggle({ label, value, onChange })`, `f.button(label, onClick, { primary?, icon? })`,
  `f.readout(label, { sym? })` with `.set(v)`, `f.stepper({ steps, onStep, interval?, label? })`
  (prev / play / next transport, calls `onStep(0)` on start).
- `f.loop(frame)` returns `{ start, stop, running }`: a rAF loop that pauses while the figure
  is off screen. Return `false` from `frame` to stop.
- `f.status(md)` writes a status line under the viz.
- `f.onSym((key) => ...)` fires when the reader hovers or taps a symbol (null on leave): use
  it to highlight the matching part of the viz.
- `f.viz` / `f.controls` are the raw containers if you need custom DOM.

Colors in canvases: `color('blue')` or `color('--ink')` (`--ink`, `--ink-2`, `--ink-3`,
`--paper`, `--paper-2`, `--card`, `--rule`, `--grid`, `--axis`, `--accent`) read the live
theme, so call them inside draw functions (the page has a dark mode). `withAlpha(hex, a)`,
`rgbOf(hex)` and `CLASS_COLORS` (palette order for dataset classes) are in `core/plot`.

## Shared code

- `core/data`: `spiral(N, K)`, `blobs`, `circles`, `xor` return `{ X: Float64Array (N*2),
  y: Int32Array, n, classes }`. `loadCifar()` resolves `{ train, test }` with 1000 / 200
  CIFAR-10 images (`pixels`: per image 3072 bytes, CIFAR's channel-major layout: 1024 red,
  1024 green, 1024 blue; `labels`), plus `cifarImage(set, i)` (ImageData), `drawCifar(ctx,
  set, i, x, y, size)` and `CIFAR_CLASSES`.
- `core/nn`: `MLP({ sizes, activation, init, seed })` with `forward`, `predict`,
  `lossAndGrad(X, y, idx, { loss: 'softmax' | 'svm', reg })`, `step(lr, optimizer, mu)`
  (`sgd momentum nesterov adagrad rmsprop adam`), `accuracy`, `reset`. `act`, `dact`,
  `softmax`.
- `core/rand`: `new Rng(seed)` with `next`, `uniform`, `int`, `randn`, `shuffle`. Seed
  everything so figures look the same on every load.
- `core/code`: `fmt(v, digits)`.
- `core/controls`: `icon(name)` (Phosphor Light glyph names, see the `ICON_SVGS` glob).

## Writing style

- Warm, direct, concrete. Short paragraphs. Second person is fine.
- Show, don't tell: no prose about the site itself or its features (how figures work, that code
  sits beside them, how to read the site). A caption may say what to try with its own figure.
- Lead each idea with intuition, then the equation (with code), then a figure to play with.
- Captions say what the figure shows, then give one or two concrete things to try.
- Tie back to the assignments where relevant ("Assignment 1 asks you to vectorize this").
- Use `### subheadings` inside long sections; `p.h2` for the 5 to 10 main sections.
- A chapter is roughly 4 to 8 figures and 4 to 10 equation cards, plus prose, callouts and
  tables. Depth over breadth, but cover every topic listed in your brief.

## Checking your work

The dev server runs at `http://127.0.0.1:5340` (do not start another on that port; if it is
down, start one on another port and pass `BASE=http://127.0.0.1:<port>/` to the tools).

```sh
npx tsc --noEmit 2>&1 | grep 'src/chapters/<id>\|src/lib/<id>'   # only your files matter
node tools/shot.mjs <id> <name> 1280 900          # desktop, prints page/console errors
node tools/shot.mjs <id> <name> 390 844 1         # iPhone-sized
SCROLL='.fig:2' node tools/shot.mjs <id> <name>   # scrolled to the third figure
THEME=dark node tools/shot.mjs <id> <name>        # dark mode
```

Screenshots land in `shots/` (git-ignored). **Look at every screenshot you take** (Read the
PNG) and fix what you see: clipped text, overlapping labels, empty canvases, a figure whose
code does not match its picture. Zero page errors is required. To test interactions, write a
throwaway Playwright script in the scratchpad (see `tools/shot.mjs` for the setup) that clicks
or drags and screenshots.

Do not commit, push, or deploy; the integrator does that.
