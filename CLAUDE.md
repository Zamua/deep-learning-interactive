# Atlas: notes for a coding agent

A Vite + TypeScript static site (no framework): Atlas, an AI course built as a concept graph,
each concept a voiced explainer plus generated problems practiced to mastery. Hash routes:
`#/atlas/...` (see `docs/MASTERY.md`) and `#/account` (sync); any other address lands on the
Atlas home. `docs/MASTERY.md` is the design and the authoring contract, `docs/EXPLAINERS.md` the
explainer craft, `docs/SYNC.md` progress sync.

## Commands

    npm run dev                          vite on 127.0.0.1:5340
    npm run build                        tsc --noEmit && vite build -> dist/
    npm test                             Vitest (src/**/*.test.ts): mastery domain, sync model, every generator
    ATLAS_STRICT=1 npm test              also fails concepts with no explainer or no problems
    node tools/shot.mjs <route> <name> [w h mobile full]   Playwright + system Chrome screenshot
                                         (prints page errors; env SCROLL='.fig:2', THEME=dark)
    node tools/lecture/build.mjs atlas-<concept-id> [--check]   synthesize an explainer's narration
                                         (ElevenLabs via OpenRouter, or Kokoro)
    node tools/lecture/shots.mjs atlas-<concept-id> <dir> [w h mobile] [scene/beat ...]   screenshot every beat
    node tools/lecture/lookup.mjs [atlas-<concept-id> ...]   lookup terms still missing a note

## Layout

- `src/main.ts`: the shell (top bar, side menu of concepts, routing, redraw on synced progress).
  `src/routes.ts` builds every address and parses them back; link with `routes.*`, never a literal.
- `src/core/`: shared pieces. `code.ts` (Python highlighter + CodePanel with `{{slots}}` and
  `#@labels`), `math.ts` (KaTeX + the small markdown dialect), `symbols.ts` (color-linked
  symbols and tap-to-name), `plot.ts` (HiDPI canvas, theme colors), `controls.ts` (icons),
  `rand.ts`, `format.ts` (times as pages print them), `storage.ts` (localStorage that never throws).
- `src/lecture/`: the explainer player. `player.ts` composes it from `theater.ts` (picture, marks,
  code, caption), `playback.ts` (play state, saved place, wake lock) on `clock.ts` (the narration or
  a wall clock), `timeline.ts` (the script laid out in time) and the controls: `gestures.ts` (tap,
  double tap to skip, hold for 2x; a unit-tested state machine), `speed.ts`, `scrub.ts`,
  `sections.ts`, `keys.ts`, `media-session.ts`, `poster.ts`; `prefs.ts` keeps speed and captions on
  the device. `progress.ts`: each explainer's resume point and heard time, in the synced store.
  `scene.ts`: beat-anchored easing and a drawing kit in stage units; `types.ts`: script and timing
  types; `lookup.ts`: the cards for symbols and calls; `library.ts`: notes on common library calls.
- `src/mastery/`: the engine. `domain/` is pure and unit tested (concept graph, student model,
  scheduler, tracks, placement, graders, expression parser); `learner.ts` + `store.ts` keep the
  learner's records in the synced progress store; `ui/` renders the home, map, tracks, concept
  pages, sessions and placement.
- `src/atlas/<domain>/<concept>/`: each concept: `meta.ts`, `problems.ts`, and an explainer
  (`script.ts`, `scenes.ts`, `explainer.ts`, generated `timing.json` + `narration.m4a`).
  `src/atlas/symbols.ts` and `notation.ts` hold the course's symbols, code notes and notation.
- `src/sync/`: progress sync on hearthsync. `model.ts` holds the records and their merges
  (pure, tested), `cloud.ts` the store and engine, `ui.ts` the account page (`#/account`,
  `#/link/<code>`). Only `mastery/store.ts` and `lecture/progress.ts` edit the store.
  Changing a record's shape needs a new `Model.version` (see hearthsync's README), never a quiet
  edit: older builds on the same account would write the old shape back.
- `tools/timing-duration.mjs`: a Vite plugin; `timing.json?duration` imports only a narration's
  length, so pages total explainer time without loading the explainers.
- `src/offline/`: `sw.js`, the service worker (caches the app at install and narration as it
  plays, answers range requests from the cache, shows reminders), and `register.ts` (registers
  it once the first page draws; the settings menu's offline status). Plain JS: the build only
  prefixes it, with `wire.json`, the names the page and the worker share (the status message, and
  where the next reminder's words are saved).
- `tools/service-worker.mjs`: a Vite plugin; writes `dist/sw.js` prefixed with the files it keeps
  (every built file but narration, source maps and legacy font formats). The worker installs only
  once it has cached every listed file, so the host must serve them all.
- `push/`: the daily reminder Worker (Web Push). `push/src/wire.ts` types what the page sends it
  and what a push carries to the service worker; `api.ts` reads request bodies at the boundary.

## Invariants

- A concept uses only itself and its prerequisite chain: its explainer, problems and lookup
  notes never lean on a concept the learner may not have met (`docs/MASTERY.md`).
- A display equation or a visual in an explainer never appears without its code: every scene
  has a listing, and each beat lights the lines it talks about.
- Symbol keys are `[A-Za-z][A-Za-z0-9]*`; they become CSS classes `sym-<key>` and TeX macros
  `\sym<key>`. TeX command names are letters only, so a key with a digit (`W1`) has no shorthand:
  write `\sym{W1}{W_1}`.
- Theme colors are CSS variables read at draw time (`color('blue')`), so canvases follow dark
  mode; palette tokens must stay 6-digit hex for `withAlpha`/`rgbOf`.
- The router disposes everything registered with `onDispose` on navigation.
- A scene's `draw(s)` is a pure function of time; the narration track is the clock.
  `timing.json` and `narration.m4a` are generated together from `script.ts` and must be
  rebuilt (and committed) whenever the narration text changes.
