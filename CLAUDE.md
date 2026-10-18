# cs231n-course: notes for a coding agent

A Vite + TypeScript static site (no framework): an interactive CS231n course. Hash routes
`#/<chapter-id>[/<section-id>]`. `docs/AUTHORING.md` is the chapter-writing contract and
the API reference; read it before touching a chapter.

## Commands

    npm run dev                          vite on 127.0.0.1:5340
    npm run build                        tsc --noEmit && vite build -> dist/
    node tools/shot.mjs <route> <name> [w h mobile full]   Playwright + system Chrome screenshot
                                         (prints page errors; env SCROLL='.fig:2', THEME=dark)

## Layout

- `src/core/`: the shared engine. `page.ts` (Page: prose, math cards, figures, callouts),
  `code.ts` (Python highlighter + CodePanel with `{{slots}}` and `#@labels`), `math.ts`
  (KaTeX + the small markdown dialect), `symbols.ts` (color-linked symbols and hover linking),
  `plot.ts` (HiDPI canvas with data coordinates), `controls.ts`, `data.ts` (2-D toy sets,
  CIFAR loader), `nn.ts` (small trainable MLP), `rand.ts`.
- `src/chapters/index.ts`: chapter metadata and order; chapter modules are found by
  `import.meta.glob`, so a missing file shows as "still being written".
- `src/chapters/<id>.ts`: one chapter each; `src/lib/<id>-*.ts` chapter helpers.
- `public/data/`, `public/img/`: chapter assets.

## Invariants

- A visualization never appears without its code (`p.figure`), and a display equation never
  without its code (`p.math`). This is the product's core promise.
- `Plot` draws first on the next frame (ResizeObserver), never in its constructor, so draw
  callbacks may reference state declared after the plot.
- Symbol keys are `[A-Za-z][A-Za-z0-9]*`; they become CSS classes `sym-<key>` and TeX macros
  `\sym<key>`.
- Theme colors are CSS variables read at draw time (`color('blue')`), so canvases follow dark
  mode; palette tokens must stay 6-digit hex for `withAlpha`/`rgbOf`.
- Animation loops go through `f.loop` / `visibleLoop`, which pause off screen; the router
  disposes everything registered with `onDispose` on navigation.
