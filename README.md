# Atlas: AI by mastery

An interactive AI course built as a map of small concepts, from vectors to post-training. Each
concept opens with a short voiced explainer, drawn live beside the code that computes it, then
generated problems until it is mastered. Mastering a concept unlocks the ones built on it, and
mastered concepts come back as spaced reviews. A track aims at any concept and lays out
everything it needs. Design in `docs/MASTERY.md`.

Progress is kept in the browser and syncs between devices through a short account code, with no
sign-up. See `docs/SYNC.md`.

Atlas works offline: after the first visit a service worker keeps the app and every concept's
code and problems (about 6 MB), and each explainer's narration once it has played.

## Run

    npm install
    npm run dev        # http://127.0.0.1:5340
    npm run build      # typecheck + static build to dist/
    npm test           # Vitest: the mastery engine, the sync records, and every problem generator

`dist/` is a plain static site (hash routing, relative asset paths) and can be served from
any static host that serves `sw.js` as JavaScript and answers range requests. Sync needs the host to also serve
[hearthsync](https://github.com/Zamua/hearthsync)'s rooms API at `/api/rooms`; without it,
progress stays on each device. The dev server serves one in memory.

## Explainers

Narration is synthesized offline by `tools/lecture/build.mjs`, with an ElevenLabs voice through
OpenRouter's speech API or locally with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx),
and committed as each concept's `narration.m4a` plus its `timing.json`. See
`docs/EXPLAINERS.md`.

## License

MIT, see [LICENSE](LICENSE).
