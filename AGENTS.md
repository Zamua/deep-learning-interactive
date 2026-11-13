# Atlas: notes for a coding agent

A Vite + TypeScript static site (no framework): Atlas, courses built as concept graphs, each
concept a voiced explainer plus generated problems practiced to mastery. Hash routes: `#/` is the topics page (every
course; an address the app does not know lands there), `#/atlas/...` the first course (`dl`), `#/c/<course>/...` any
other, and `#/account` sync (see
`docs/MASTERY.md`). `docs/MASTERY.md` is the design and the authoring contract, `docs/EXPLAINERS.md` the
explainer craft, `docs/SYNC.md` progress sync.

## Commands

    npm run dev                          vite on 127.0.0.1:5340
    npm run build                        tsc --noEmit && vite build -> dist/
    npm test                             Vitest (src/**/*.test.ts): mastery domain, sync model, every generator
    ATLAS_STRICT=1 npm test              also fails concepts with no explainer or no problems
    npm run check                        tsc (app and push/) + ATLAS_STRICT tests: what CI runs, and main requires
    node tools/e2e/offline-update.mjs <old dist> <new dist>   every page offline after an update (system Chrome)
    node tools/shot.mjs <route> <name> [w h mobile full]   Playwright + system Chrome screenshot
                                         (prints page errors; env SCROLL='.fig:2', THEME=dark)
    node tools/lecture/build.mjs atlas-<concept-id> [--check]   synthesize an explainer's narration
                                         (ElevenLabs via OpenRouter, or Kokoro)
    node tools/lecture/shots.mjs atlas-<concept-id> <dir> [w h mobile] [scene/beat ...]   screenshot every beat
    node tools/lecture/lookup.mjs [atlas-<concept-id> ...]   lookup terms still missing a note
    node tools/course/course.mjs check|scaffold <outline.json>   validate an outline, or write its folders
    node tools/course/course.mjs status <course>   what each concept is still missing

A new course goes through the `/make-course` skill (`.claude/skills/make-course/`).

Design and motion skills, vendored and pinned (`.claude/skills/THIRD-PARTY.md`): `animate` to build motion, `choreograph`
when several things move together, `gestures` for drags and sheets, `animation-performance` for dropped frames,
`animation-vocabulary` to name an effect, `find-animation-opportunities` and `improve-animations` to survey (both
read-only), `review-animations` on a diff with motion, `remove-animations` to subtract, `break-ui` for worst-case data,
`prototype` for variants to flip through, `emil-design-eng` for the design philosophy. `review-animations`,
`remove-animations`, `prototype` and `emil-design-eng` run only when asked for.
They assume React and Motion in places: this site is plain TypeScript and CSS, and a new dependency is the owner's call.
Where one disagrees with the rules here, these win: nothing moves when content lands, Reduce Motion means no motion that
is not needed (never leave content hidden behind a removed animation), Phosphor icons, no em dashes, and
`code-review:code-review` for review.

## Layout

- `src/main.ts`: the shell (top bar whose wordmark leads to the topics page, side menu of topics or of the open
  course's concepts, routing, redraw on synced progress). `src/settings.ts`: the menu behind the gear (color theme,
  pace, reminder, sync, offline status).
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
  learner's records in the synced progress store; `ui/` renders the topics page (`topics.ts`), a course's home, map,
  tracks, concept pages, sessions and placement.
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
- `src/offline/`: `sw.js`, the service worker (installs only once it holds every file of its build and takes over
  then, so the build before it keeps answering whole until that moment; serves pages from the cache, never the
  network; saves narration as it plays and, ahead of time, that of the explainers the page says come next, up to
  40 MB; saves whole courses' narration the learner chose in the settings menu, kept in `atlas-keep` and fetched
  again for each new build, so only changed tracks download; answers range requests from the cache, shows
  reminders), `register.ts` (registers it once the first page draws; the settings menu's offline status, per course
  too), `ahead.ts` (which narration comes next: each course's next concept and the next three on each track, from
  `upcoming` in `mastery/domain/tracks.ts`; sent after every page that is not a session, nothing ahead on Save-Data),
  `catalog.ts` (each course's narration addresses, sent with every message, since the worker knows files, not
  courses) and `save-courses.ts` (the settings menu's Save all sound: checks storage room first, asks for persistent
  storage, and nudges the worker when a save was cut short, as Safari has no background downloads). The worker's
  prefix carries each track's size (`sizes`), so the menu can state what saving costs. `tools/e2e/offline-update.mjs`
  checks all of it with no connection, the saved-course case included. `main.ts` looks for a new worker at
  launch and after a minute away, because iOS resumes an installed app without loading anything, and reloads onto
  the new build when its worker takes over, unless a session or an explainer is under way. Plain JS: the build only
  prefixes it, with `wire.json`, the names the page and the worker share (the messages, and
  where the next reminder's words are saved). Every page of the app loads the lazy `ui` chunk, so a build that took
  over before all of it was saved would open on an error with no connection: keep the install whole.
- `tools/service-worker.mjs`: a Vite plugin; writes `dist/sw.js` prefixed with the files it keeps
  (every built file but narration, source maps and legacy font formats). The worker installs only once every listed
  file has arrived, so the host must serve them all.
- `tools/e2e/offline-update.mjs <old dist> <new dist>`: a learner on the old build meets the new one and loses the
  connection, part way and after; every page must still open, and the next explainer must play with sound. Run it before a release that touches `src/offline/`,
  how pages load, or the build's chunks.
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
- **Touch and motion** (`src/styles/components.css`): every control is at least 44 pt (small ones grow an `::after`
  hit area), presses scale to 0.97, hover styles sit behind `@media (hover: hover) and (pointer: fine)`, and Reduce
  Motion keeps fades and drops movement.
- The router disposes everything registered with `onDispose` on navigation.
- A scene's `draw(s)` is a pure function of time; the narration track is the clock.
  `timing.json` and `narration.m4a` are generated together from `script.ts` and must be
  rebuilt (and committed) whenever the narration text changes.
