# cs231n-course: notes for a coding agent

A Vite + TypeScript static site (no framework) hosting interactive courses: CS231n (Winter
2016) and DL26, its continuation (transformers, scale, post-training). Hash routes: `#/` the
course index, `#/<course-id>` a course's front page, `#/<chapter-id>[/<section-id>]` a
chapter, `#/watch/<chapter-id>` its lecture. Chapter ids are unique across courses.
`docs/AUTHORING.md` is the chapter-writing contract and the API reference; read it before
touching a chapter. `docs/DL26.md` is DL26's syllabus and replaces AUTHORING's course section
for DL26 chapters.

## Commands

    npm run dev                          vite on 127.0.0.1:5340
    npm run build                        tsc --noEmit && vite build -> dist/
    node tools/shot.mjs <route> <name> [w h mobile full]   Playwright + system Chrome screenshot
                                         (prints page errors; env SCROLL='.fig:2', THEME=dark)
    node tools/lecture/build.mjs <id> [--check]   synthesize a lecture's narration (ElevenLabs via OpenRouter, or Kokoro)
    node tools/lecture/shots.mjs <id> <dir> [w h mobile] [scene/beat ...]   screenshot every beat
    node tools/lecture/lookup.mjs [<id> ...]   lookup terms still missing a note

## Layout

- `src/core/`: the shared engine. `page.ts` (Page: prose, math cards, figures, callouts),
  `code.ts` (Python highlighter + CodePanel with `{{slots}}` and `#@labels`), `math.ts`
  (KaTeX + the small markdown dialect), `symbols.ts` (color-linked symbols and hover linking),
  `plot.ts` (HiDPI canvas with data coordinates), `controls.ts`, `data.ts` (2-D toy sets,
  CIFAR loader), `nn.ts` (small trainable MLP), `rand.ts`.
- `src/chapters/index.ts`: `COURSES` (code, title, parts) and chapter metadata and order,
  each chapter tagged with its `course`; chapter modules are found by
  `import.meta.glob`, so a missing file shows as "still being written".
- `src/chapters/<id>.ts`: one chapter each; `src/lib/<id>-*.ts` chapter helpers.
- `public/data/`, `public/img/`: chapter assets.
- `src/lecture/`: the lecture player (`player.ts`: theater, audio clock, controls; `scene.ts`:
  beat-anchored easing and a drawing kit in stage units; `types.ts`: script and timing types;
  `lookup.ts`: the cards for symbols and calls; `glossary.ts`: note types and `callKey`).
  `src/lectures/<id>/`: one lecture per chapter. `docs/LECTURES.md` is the authoring guide.

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
- A lecture scene's `draw(s)` is a pure function of time; the narration track is the clock.
  `timing.json` and `narration.m4a` are generated together from `script.ts` and must be
  rebuilt (and committed) whenever the narration text changes.
