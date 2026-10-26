# Deep learning, interactive

Interactive deep learning courses, where every figure runs beside the Python that draws it and
most chapters open with a narrated lecture. Unofficial and unaffiliated.

## Courses

- **CS231n**: Convolutional Neural Networks for Visual Recognition, as taught at Stanford in
  Winter 2016.
- **DL26**: the continuation, 2017 to 2026: transformers, scale, and post-training. Syllabus in
  `docs/DL26.md`.
- **Atlas**: AI by mastery. A graph of small concepts, each with a short voiced explainer and
  generated problems; mastering a concept unlocks the ones built on it, and mastered concepts
  come back as spaced reviews. Design in `docs/MASTERY.md`.

Progress (Atlas mastery, lectures heard, chapters read) is kept in the browser and syncs between
devices through a short account code, with no sign-up. See `docs/SYNC.md`.

## Run

    npm install
    npm run dev        # http://127.0.0.1:5340
    npm run build      # typecheck + static build to dist/
    npm test           # Vitest: the mastery engine, and every Atlas problem generator

`dist/` is a plain static site (hash routing, relative asset paths) and can be served from
any static host. Sync needs the host to also serve
[hearthsync](https://github.com/Zamua/hearthsync)'s rooms API at `/api/rooms`; without it,
progress stays on each device. The dev server serves one in memory.

## Data

`public/data/cifar-{train,test}.bin` hold a class-balanced 1,000 / 200 image sample of
CIFAR-10 (Krizhevsky, 2009) in CIFAR's binary record format, built by
`tools/pack_cifar.py` from the dataset's parquet release.

## Lectures

Narration is synthesized offline by `tools/lecture/build.mjs`, with an ElevenLabs voice through
OpenRouter's speech API or locally with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx),
and committed as `src/lectures/<id>/narration.m4a` plus its `timing.json`. See
`docs/LECTURES.md`.

## License

MIT, see [LICENSE](LICENSE). The CIFAR-10 sample in `public/data/` remains under its own terms.
