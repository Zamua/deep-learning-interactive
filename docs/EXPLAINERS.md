# Writing an explainer

Every concept opens with a short voiced explainer. It is not a video file: it is a timeline that
the narration track drives, drawn live with the site's own canvas and code panel, so it stays
sharp, small, and in the course's colors. Route: `#/atlas/<concept-id>/watch`. What an explainer
may teach, and its length, are in `docs/MASTERY.md`; this is the craft.

## Files

In the concept's folder, `src/atlas/<domain>/<concept-id>/`:

    script.ts      narration, code listings and line cues (pure data, no imports except
                   `import type`: the narration builder loads it in Node); id `atlas-<concept-id>`
    scenes.ts      one SceneDef per scene: draw(s) and optional KaTeX marks
    explainer.ts   wires script, timing, scenes, lookup notes and the audio URL (copy softmax's)
    timing.json    generated: when every beat starts and ends, and where its phrases break
                   (resuming after a pause backs up to the phrase start)
    narration.m4a  generated: the voice track (hashed into dist/assets)

The narration files are optional, so an explainer runs (silently, on estimated timing) before its
first build.

## Script

A scene is a code listing plus beats. A beat is one or two sentences of narration; its `code`
lights listing lines (`#@label`s) while it plays. Write for the ear: numbers and symbols the way
they are said. `{shown|spoken}` splits caption from voice, e.g. `{3,072|three thousand and
seventy two}` or `{x²|x squared}`. No em dashes. Keep beats short; captions are chunked to
about two lines on a phone.

## Scenes

`draw(s)` is a pure function of `s.t` (seconds into the scene): it runs every frame, on seek
and on resize, so never keep animation state between calls. Anchor motion to the narration:

    s.ease('beat', dur, delay)   eased 0 -> 1 starting at that beat
    s.prog('beat')               linear 0 -> 1 across the beat's spoken duration
    s.win('from', 'until')       fade in at one beat, out at another
    s.show('mark', alpha, pos)   show a KaTeX overlay declared in `marks`
    s.slot('name', value)        rewrite a `{{slot}}` in the listing

Size everything in stage units: `s.u` is 1% of the stage's shorter side, and text sizes in
`s.text()` are in `u`. The stage is about 1.1:1 on a phone held upright and about 1.6:1 on a
desktop, so lay out for both. The code panel always shows the scene's listing: a visual is
never without its code.

## Craft checklist

What an explainer is for: the one idea of its concept, intuitive and hands-off, for someone who
took calculus long ago. A voice that carries the idea, a picture that makes it obvious, and a
listing that shows the same idea as code.

- Every scene has a listing (`code`, `codeTitle`) and every beat lights the lines it talks
  about, so the picture, the voice and the code always say the same thing. Use the course's
  symbol names and colors.
- Something must be on screen from a scene's first beat: a title, the previous result, or the
  object about to be discussed. An empty stage while the voice talks reads as broken.
- Lay out for both stages: `s.tall` is true on an upright phone. Prefer stacking over
  squeezing; prefer a small legend box over labels that crowd a plot.
- Keep text inside the stage with margin (at least 4u from every edge), and check the longest
  label at its final size. Put `halo: true` on text that sits over lines or fills.
- Labels must not collide with each other, with marks, or with the scene's moving parts at any
  beat, including mid-animation. Fade out what a beat no longer needs (`s.win`).
- Do heavy work once at module scope (seeded with `src/core/rand.ts`), never per frame.
- Show, don't tell: never describe the site or its features ("try it in your browser"). End on
  the subject itself, then `Your turn.`
- Numbers and symbols in `say` are written the way they are spoken; check anything a voice
  could read two ways (decimals, exponents, shapes like 32x32x3, `W.T`, Greek letters).

## Narration

    node tools/lecture/build.mjs atlas-<concept-id>          # synthesize changed beats, write audio + timing
    node tools/lecture/build.mjs atlas-<concept-id> --check  # also transcribe each beat back with whisper

The script's `model` and `voice` pick the speech engine: `elevenlabs/eleven-v4` with a preset
voice such as `george` goes through OpenRouter's `/api/v1/audio/speech` (key in
`OPENROUTER_API_KEY`, or in the file `OPENROUTER_KEY_FILE` names; about $40 per million
characters, so a 2-minute explainer is about 7 cents), and `kokoro` runs Kokoro locally for free. Each clip is
cached by model, voice and text, so a rebuild only pays for the beats that changed. `--check` lists beats whose transcript drifts from the script; most
hits are just digits written as numerals, but read them for real mispronunciations. Defaults:
`TTS_PY=python3` (numpy, soundfile; kokoro-onnx for Kokoro), `KOKORO_DIR=~/.cache/kokoro`,
`TTS_CACHE=~/.cache/lecture-tts`, `WHISPER_MODEL=~/.cache/whisper/ggml-large-v3-turbo-q5_0.bin`.
`tools/lecture/local.env` (untracked; see `local.env.example`) sets any of them per machine.

Edit the script and the player notices that the timing no longer matches: in dev it shows a
notice and plays silently on estimated timing, so visuals can be worked on before rebuilding.

## Lookup notes

Tapping a symbol or a call in the code panel opens a card, and the book button lists every one
in the scene. Every term the code shows needs a note:

- a symbol needs `about` in `src/atlas/symbols.ts`: a sentence or two beyond `name`, such as its
  role, its shape here, or where the name comes from (a concept whose meaning differs gets a
  `SCOPED` entry);
- a call needs a `GlossEntry` (`src/lecture/glossary.ts`): `is`, a short lower-case phrase shown
  in the list, plus optional `more` and `eg`. Keys follow `callKey`: `np.random.randn` for a
  module function, `.reshape` for a method, `softmax` for a bare name. Calls shared by every
  explainer live in `src/lecture/library.ts`; names a listing defines get a note in
  `src/atlas/symbols.ts`, course-wide or per concept in `SCOPED`.

    node tools/lecture/lookup.mjs [atlas-<concept-id> ...]    # terms still without a note (dev server running)

## Review

    node tools/lecture/shots.mjs atlas-<concept-id> <out-dir> 402 874 1     # every beat, phone
    node tools/lecture/shots.mjs atlas-<concept-id> <out-dir> 1280 800 0 <scene/beat> ...

Tile the PNGs (`ffmpeg -pattern_type glob -i '*.png' -vf tile=4x2 sheet%02d.png`) and look at
all of them: clipped labels, overlaps, and empty stages are the usual defects.
