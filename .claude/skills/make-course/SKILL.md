---
name: make-course
description: Build a new course on this site from a topic. Outlines a concept DAG, scaffolds it, authors explainers and problems, verifies them, narrates them and registers the book. Use when asked to make, add or generate a course.
argument-hint: "<topic> [--depth N] [--level beginner]"
---

# make-course

Makes one course: `src/courses/<id>/`, a tree of concepts that each hold an explainer and a problem set. Every step can be resumed: `status` shows what is left, and `scaffold` never overwrites a file.

`--depth` is roughly how many concepts (default 10). `--level` is who it is for (default: a programmer new to the topic).

## 1. Outline, and get it approved

Nothing expensive runs until the user has approved the outline.

Write `outline.json` outside the repo:

```json
{
  "id": "topic",
  "title": "Topic",
  "blurb": "One line that says what the reader will be able to do.",
  "cover": "#35466b",
  "idPrefix": "topic.",
  "domains": [{ "id": "first-part", "title": "The first part" }],
  "concepts": [
    { "id": "a-concept", "title": "A concept", "blurb": "One line.", "domain": "first-part", "prereqs": [] }
  ]
}
```

Ids are lowercase with hyphens and hold no dot, and `idPrefix` is the course id plus a dot. `cover` is a dark color (the check rejects a light one). Prereqs name concepts in this course only: a concept taught here must be a fact the reader can use, small enough for a 2 to 4 minute explainer. The graph must be connected and free of cycles.

```
node tools/course/course.mjs check outline.json
```

Show the user the domains and concepts, with their prereqs. Revise until they approve.

## 2. Scaffold

```
node tools/course/course.mjs scaffold outline.json
node tools/course/course.mjs status <course>
```

This writes `course.ts`, and each concept's `meta.ts` and `explainer.ts`. Add `src/courses/<course>/draw.ts` if the topic has a picture that recurs (see `src/courses/nix/draw.ts`). Until every concept is authored, `tsc` fails on the missing `scenes.ts` and `script.ts`, which is expected.

## 3. Author

Follow [references/concept-brief.md](references/concept-brief.md) for each concept. Hand-write the first one, and read it on a phone (below) before starting the rest: it sets the voice and the visual kit the others copy.

The rest can go to subagents, at most three at a time. Each writes only its own concept folder. Give each the brief, the concept's id and prereq chain, what the concepts before it have taught, and the exemplar to copy.

## 4. Verify

- Check every code listing and every computed answer against the real tool (for Nix: `nix eval --extra-experimental-features nix-command --expr '...'`).
- `ATLAS_STRICT=1 npm test`, then `npm run check`.
- `node tools/lecture/shots.mjs atlas-<idPrefix><concept> <dir> 402 874 1` for each concept, and again at desktop size (1280 800 0). Look at every frame: labels that collide, a stage empty on the first beat, text under the safe margin.
- Check the course's own pages at `#/c/<course>`.

## 5. Narrate

The default voice is local and free: `model: 'kokoro', voice: 'af_heart', speed: 1` in `script.ts`. It needs `TTS_PY`, `KOKORO_DIR`, `TTS_CACHE` and `WHISPER_MODEL`, set in `tools/lecture/local.env`.

One concept at a time, watching memory:

```
node tools/lecture/build.mjs atlas-<idPrefix><concept> --dry
node tools/lecture/build.mjs atlas-<idPrefix><concept>
node tools/lecture/build.mjs atlas-<idPrefix><concept> --check
```

`--check` prints the beats where what was said and what was heard differ. Fix a mispronounced term with a spoken form, `{shown|spoken}`, and rebuild: only changed beats are synthesized again. A paid voice needs the user's approval on a cost estimate from `--dry` first.

A course can ship silent and gain its narration later.

## 6. Register

The site finds a course by its folder, so there is no list to edit. `status` should show nothing missing and `npm run check` should be green. Open a pull request and let the project's normal release path carry it to staging, and confirm that the book is on the shelf there.

A new course adds records under its own id prefix. It must not change the shape of the progress store: if a change seems to need that, stop and ask.
