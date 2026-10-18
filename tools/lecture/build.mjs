#!/usr/bin/env node
// Synthesizes a lecture's narration and timing:
//   node tools/lecture/build.mjs <lecture-id> [--check]
// --check transcribes every beat back with whisper-cli and lists the ones that drift from the script.
// Env: TTS_PY (python with kokoro-onnx), KOKORO_DIR, OPENROUTER_KEY_FILE, TTS_CACHE, WHISPER_MODEL.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const [id, ...flags] = process.argv.slice(2);
if (!id) {
  console.error('usage: node tools/lecture/build.mjs <lecture-id> [--check]');
  process.exit(2);
}
const { script } = await import(pathToFileURL(join(root, `src/lectures/${id}/script.ts`)).href);
const { GAP, spokenText } = await import(pathToFileURL(join(root, 'src/lecture/types.ts')).href);

const job = {
  model: script.model,
  voice: script.voice,
  speed: script.speed,
  gap: GAP,
  scenes: script.scenes.map((s) => ({
    id: s.id,
    beats: s.beats.map((b) => ({ id: b.id, text: spokenText(b.say), pause: b.pause ?? 0 })),
  })),
  audio: join(root, `src/lectures/${id}/narration.m4a`),
  timing: join(root, `src/lectures/${id}/timing.json`),
  check: flags.includes('--check'),
};
mkdirSync(dirname(job.audio), { recursive: true });
const jobFile = join(mkdtempSync(join(tmpdir(), 'lecture-')), 'job.json');
writeFileSync(jobFile, JSON.stringify(job));
const py = process.env.TTS_PY ?? join(homedir(), 'ml/envs/tts/bin/python');
const r = spawnSync(py, [join(import.meta.dirname, 'tts.py'), jobFile], { stdio: 'inherit' });
process.exit(r.status ?? 1);
