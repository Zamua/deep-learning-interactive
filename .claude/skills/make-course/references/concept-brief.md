# Authoring one concept

You write three files in the concept's folder, and touch nothing else: `problems.ts`, `script.ts`, `scenes.ts`. Helpers shared with one concept only stay in its `scenes.ts`.

Read first: `docs/EXPLAINERS.md` (the rules for a good explainer), a finished concept to copy, `src/lecture/scene.ts` (the drawing API), `src/lecture/draw.ts` and the course's `draw.ts`, `src/courses/bank.ts` and the top of `src/courses/courses.test.ts` (what every generator must pass).

## The explainer

- Open on the problem and a picture. A definition comes after the reader wants it.
- 2 to 4 scenes, 2 to 4 minutes, and one idea at a time. Teach only what the concept's own prereq chain has taught, and define each term at first use.
- Every scene has a listing (`code`, `codeTitle`, `lang`) and beats light its lines through `#@label` tags. A shell listing writes commands as `$ command`, and any other line reads as output.
- The last beat of the last scene is `{ id: 'turn', say: 'Your turn.' }`.
- Something is on the stage from the first beat of each scene. Lay out for phone (`s.tall`, about 1.1:1) and desktop (about 1.6:1), keep a 4u margin, use `halo: true` for text over lines, and do not let labels collide.
- `draw(s)` is pure in `s.t`. `script.ts` imports only types, because Node loads it.
- `{shown|spoken}` separates the caption from the voice: `{.drv|dot D R V}`.
- Write as a person talks: short sentences, no em dashes, no filler like "simply" or "just".
- Use `model: 'kokoro', voice: 'af_heart', speed: 1` unless told otherwise. The script's id is `atlas-<idPrefix><concept>`.
- Keep example data generic: tools, libraries and public projects. Nothing personal.

## The problems

- Export `generators: Generator[]`. Aim for three: computed where the answer can be worked out (a `number`, an `order`, a computed `choice`), plus a `bank()` of at least 8 hand-written questions.
- Every generator must produce at least 8 distinct prompts. Traps are for `number`, `shape` and `vector` answers only, and each must grade wrong.
- A question tests understanding of the concept. Not trivia, and nothing a later concept teaches.
- A distractor names a real misconception, and `why` says what is wrong with it. In `bank()`, the right option comes first.
- `md()` reads `$...$` as math before backticks, so write a literal dollar as `\\$`, and put interpolated code in `p.code` with `lang`.

## Before you finish

- Run every listing and every computed answer through the real tool. Where a listing shows output, it is what the tool printed, shortened only with `…` in hashes.
- Run the concept's tests until they pass: `npx vitest run src/courses/courses.test.ts -t "<idPrefix><concept>"`.
