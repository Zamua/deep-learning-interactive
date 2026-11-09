# Atlas: notes for a coding agent

A Vite + TypeScript static site (no framework): Atlas, courses built as concept graphs, each
concept a voiced explainer plus generated problems practiced to mastery. Hash routes: `#/` (the
shelf), `#/review`, `#/path`, `#/settings`, `#/atlas/...` (the first course, `dl`), `#/c/<course>/...`
(any other; see `docs/MASTERY.md`) and `#/account` (sync); any other address lands on the shelf. `docs/MASTERY.md` is the design and the authoring contract, `docs/EXPLAINERS.md` the
explainer craft, `docs/SYNC.md` progress sync.

## Commands

    npm run dev                          vite on 127.0.0.1:5340
    npm run build                        tsc --noEmit && vite build -> dist/
    npm test                             Vitest (src/**/*.test.ts): mastery domain, sync model, every generator
    ATLAS_STRICT=1 npm test              also fails concepts with no explainer or no problems
    npm run check                        tsc (app and push/) + ATLAS_STRICT tests: what CI runs, and main requires
    node tools/e2e/map-search.mjs <base> [png]   phone e2e of the map search against a dev or preview server
    node tools/shot.mjs <route> <name> [w h mobile full]   Playwright + system Chrome screenshot
                                         (prints page errors; env SCROLL='.fig:2', THEME=dark)
    node tools/lecture/build.mjs atlas-<concept-id> [--check]   synthesize an explainer's narration
                                         (ElevenLabs via OpenRouter, or Kokoro)
    node tools/lecture/shots.mjs atlas-<concept-id> <dir> [w h mobile] [scene/beat ...]   screenshot every beat
    node tools/lecture/lookup.mjs [atlas-<concept-id> ...]   lookup terms still missing a note
    node tools/course/course.mjs check|scaffold <outline.json>   validate an outline, or write its folders
    node tools/course/course.mjs status <course>   what each concept is still missing

A new course goes through the `/make-course` skill (`.claude/skills/make-course/`).

## Layout

- `src/main.ts`: the shell (four tabs, a rail on desktop; routing; redraw on synced progress).
  `src/theme.ts`: the color theme.
  `src/routes.ts` builds every address and parses them back; link with a course's `routes.*`
  (site pages: `routes.*`), never a literal.
- `src/core/`: shared pieces. `code.ts` (CodePanel with `{{slots}}` and `#@labels`),
  `highlight.ts` (one line at a time, for Python, Nix and shell; a course adds a language here),
  `math.ts` (KaTeX + the small markdown dialect), `symbols.ts` (color-linked
  symbols and tap-to-name), `plot.ts` (the HiDPI stage canvas, theme colors), `controls.ts` (icons),
  `rand.ts`, `format.ts` (times as pages print them), `storage.ts` (localStorage that never throws).
- `src/lecture/`: the explainer player. `player.ts` composes it from `theater.ts` (picture, marks,
  code, caption), `playback.ts` (the shell for `playback-state.ts`, the play state as one pure,
  event-tested machine; saved place, wake lock) on `clock.ts` (the narration or
  a wall clock), `timeline.ts` (the script laid out in time) and the controls: `gestures.ts` (tap,
  double tap to skip, hold for 2x; a unit-tested state machine), `speed.ts`, `scrub.ts`,
  `sections.ts`, `keys.ts`, `media-session.ts`, `poster.ts`; `prefs.ts` keeps speed and captions on
  the device. `progress.ts`: each explainer's resume point and heard time, in the synced store.
  `scene.ts`: beat-anchored easing and a drawing kit in stage units; `draw.ts`: helpers any course's
  scenes share (a course's own are in `<course>/draw.ts`); `types.ts`: script and timing
  types; `lookup.ts`: the cards for symbols and calls; `library.ts`: notes on common library calls.
- `src/mastery/`: the engine. `domain/` is pure and unit tested (concept graph, student model,
  scheduler, tracks, placement, graders, expression parser); `learner.ts` + `store.ts` keep the
  learner's records in the synced progress store; `ui/` renders the shelf, Review, Path, Settings, a
  course's front page, the part map, tracks, concept pages, sessions and placement.
- `src/courses/`: the courses. `course.ts` says what a course is; `index.ts` finds every course and
  concept by glob and builds them (`COURSES`, `courseById`, `FIRST`); `symbols.ts` hands a course's
  symbols to the pages, imported only by them so they stay out of the main chunk. A course is
  `<course>/course.ts` (title, domains, `idPrefix`) and its concept folders. `bank.ts` turns
  hand-written multiple-choice questions into a generator.
- `src/courses/<course>/<domain>/<concept>/`: each concept: `meta.ts`, `problems.ts`, and an explainer
  (`script.ts`, `scenes.ts`, `explainer.ts`, generated `timing.json` + `narration.m4a`).
  `<course>/symbols.ts` and `notation.ts` hold a course's symbols, code notes and notation.
- `src/sync/`: progress sync on hearthsync. `model.ts` holds the records and their merges
  (pure, tested), `cloud.ts` the store and engine, `ui.ts` the account page (`#/account`,
  `#/link/<code>`). Only `mastery/store.ts` and `lecture/progress.ts` edit the store.
  Changing a record's shape needs a new `Model.version` (see hearthsync's README), never a quiet
  edit: older builds on the same account would write the old shape back.
- `tools/timing-duration.mjs`: a Vite plugin; `timing.json?duration` imports only a narration's
  length, so pages total explainer time without loading the explainers.
- `src/offline/`: `sw.js`, the service worker (installs on the shell and what it names so it takes
  over at once, saves the rest in the background across launches and narration as it plays, answers range requests from the cache, shows
  reminders), and `register.ts` (registers it once the first page draws; the settings page's offline
  status). `main.ts` looks for a new build at launch and after a minute away, because iOS resumes an
  installed app without loading anything. Plain JS: the build only
  prefixes it, with `wire.json`, the names the page and the worker share (the status message, and
  where the next reminder's words are saved).
- `tools/service-worker.mjs`: a Vite plugin; writes `dist/sw.js` prefixed with the files it keeps
  (every built file but narration, source maps and legacy font formats). The app counts as saved,
  and the old build's files go, only once every listed file has arrived, so the host must serve
  them all.
- `push/`: the daily reminder Worker (Web Push). `push/src/wire.ts` types what the page sends it
  and what a push carries to the service worker; `api.ts` reads request bodies at the boundary.

## Invariants

- A concept's id is its folder name after its course's `idPrefix`, and it names the learner's
  records. `dl` has no prefix and no id with a dot, which is how `course.owns` keeps one course's
  records from another's. Renaming a concept or changing a prefix strands what learners have done.
  An explainer's id is `atlas-<full id>`.
- A concept uses only itself and its prerequisite chain: its explainer, problems and lookup
  notes never lean on a concept the learner may not have met (`docs/MASTERY.md`).
- A display equation or a visual in an explainer never appears without its code: every scene
  has a listing, and each beat lights the lines it talks about.
- Symbol keys are `[A-Za-z][A-Za-z0-9]*`; they become CSS classes `sym-<key>` and TeX macros
  `\sym<key>`. TeX command names are letters only, so a key with a digit (`W1`) has no shorthand:
  write `\sym{W1}{W_1}`.
- Theme colors are CSS variables read at draw time (`color('blue')`), so canvases follow dark
  mode; palette tokens must stay 6-digit hex for `withAlpha`.
- The router disposes everything registered with `onDispose` on navigation.
- A scene's `draw(s)` is a pure function of time; the narration track is the clock.
  `timing.json` and `narration.m4a` are generated together from `script.ts` and must be
  rebuilt (and committed) whenever the narration text changes.
