# Deep learning, interactive

Two interactive courses. **CS231n** is a companion to Stanford's CS231n (Convolutional Neural
Networks for Visual Recognition) as taught in Winter 2016. **DL26** continues it: attention
and transformers, scale, modern optimizers, ViT, CLIP and diffusion, and post-training with
RLHF, PPO, DPO, RLVR and GRPO (syllabus in `docs/DL26.md`). In both, every figure sits beside the Python it illustrates
and drives it live; every equation is read out piece by piece next to its NumPy twin; colored
symbols link math, code and prose. Chapters can open with a narrated lecture (`#/watch/<id>`):
the same ideas as a hands-off watch, drawn live in the browser in sync with a voice track.
Unofficial and unaffiliated.

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
OpenRouter's speech API or locally with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), and committed as `src/lectures/<id>/narration.m4a` plus its
`timing.json`. See `docs/LECTURES.md`.

The player: tap the picture to pause, double tap its left or right side to skip 10 s back or
ahead (keep tapping to skip further), hold it to play at 2×, and slide down while holding to
lock 2× until the next hold (or a tap on the 2× pill). Resuming after a pause backs up to the
start of the interrupted phrase. Keys: space or `k` play, `j`/`l` ±10 s,
arrows ±5 s, `[`/`]` previous/next section, `<`/`>` speed, `c` captions, `f` full screen.
