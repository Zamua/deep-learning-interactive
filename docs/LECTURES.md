# Writing a lecture

Each chapter can open with a narrated lecture: the passive first layer, before the interactive
chapter (second) and its assignment (third). A lecture is not a video file. It is a timeline
that the narration track drives, drawn live with the site's own canvas and code panels, so it
stays sharp, small, and in the chapter's colors. Route: `#/watch/<chapter-id>`.

## Files

    src/lectures/<id>/script.ts    narration, code listings and line cues (pure data, no imports
                                   except `import type`: the narration builder loads it in Node)
    src/lectures/<id>/scenes.ts    one SceneDef per scene: draw(s) and optional KaTeX marks
    src/lectures/<id>/index.ts     wires script, timing, scenes, symbols and the audio URL
    src/lectures/<id>/timing.json  generated: when every beat starts and ends, and where its phrases
                                   break (resuming after a pause backs up to the phrase start)
    src/lectures/<id>/narration.m4a generated: the voice track (hashed into dist/assets)

A chapter with a lecture gets the Watch / Explore / Practice card automatically
(`hasLecture`). `ChapterMeta.practice` fills the third row.

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

## Narration

    node tools/lecture/build.mjs <id>          # synthesize changed beats, write audio + timing
    node tools/lecture/build.mjs <id> --check  # also transcribe each beat back with whisper

The script's `model` and `voice` pick the speech engine: `elevenlabs/eleven-v4` with a preset
voice such as `george` goes through OpenRouter's `/api/v1/audio/speech` (key in
`OPENROUTER_KEY_FILE`, default `~/keys/openrouter`; about $40 per million characters, so a
15-minute lecture is about $0.50), and `kokoro` runs Kokoro locally for free. Each clip is
cached by model, voice and text, so a rebuild only pays for the beats that changed. `--check` lists beats whose transcript drifts from the script; most
hits are just digits written as numerals, but read them for real mispronunciations. Defaults:
`TTS_PY=~/ml/envs/tts/bin/python` (numpy, soundfile; kokoro-onnx for Kokoro), `KOKORO_DIR=~/ml/models/kokoro`,
`TTS_CACHE=~/ml/caches/cs231n-tts`, `WHISPER_MODEL=~/ml/models/whisper/ggml-large-v3-turbo-q5_0.bin`.

Edit the script and the player notices that the timing no longer matches: in dev it shows a
notice and plays silently on estimated timing, so visuals can be worked on before rebuilding.

## Review

    node tools/lecture/shots.mjs <id> <out-dir> 402 874 1     # every beat, phone
    node tools/lecture/shots.mjs <id> <out-dir> 1280 800 0 <scene/beat> ...

Tile the PNGs (`ffmpeg -pattern_type glob -i '*.png' -vf tile=4x2 sheet%02d.png`) and look at
all of them: clipped labels, overlaps, and empty stages are the usual defects.
