# Deep learning, interactive

Interactive deep learning courses, where every figure runs beside the Python that draws it and
most chapters open with a narrated lecture. Unofficial and unaffiliated.

## Courses

- **CS231n**: Convolutional Neural Networks for Visual Recognition, as taught at Stanford in
  Winter 2016.
- **DL26**: the continuation, 2017 to 2026: transformers, scale, and post-training. Syllabus in
  `docs/DL26.md`.

## Run

    npm install
    npm run dev        # http://127.0.0.1:5340
    npm run build      # typecheck + static build to dist/

`dist/` is a plain static site (hash routing, relative asset paths) and can be served from
any static host.

## Data

`public/data/cifar-{train,test}.bin` hold a class-balanced 1,000 / 200 image sample of
CIFAR-10 (Krizhevsky, 2009) in CIFAR's binary record format, built by
`tools/pack_cifar.py` from the dataset's parquet release.

## Lectures

Narration is synthesized offline by `tools/lecture/build.mjs`, with an ElevenLabs voice through
OpenRouter's speech API or locally with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx),
and committed as `src/lectures/<id>/narration.m4a` plus its `timing.json`. See
`docs/LECTURES.md`.
