#!/usr/bin/env node
// Synthesizes a lecture's narration and timing:
//   node tools/lecture/build.mjs <lecture-id | atlas-<concept-id>> [--check]
// --check transcribes every beat back with whisper-cli and lists the ones that drift from the script.
// Env: TTS_PY, KOKORO_DIR, OPENROUTER_API_KEY or OPENROUTER_KEY_FILE, TTS_CACHE, WHISPER_MODEL;
// tools/lecture/local.env (KEY=value lines, untracked) supplies any that are unset.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const localEnv = join(import.meta.dirname, 'local.env');
if (existsSync(localEnv)) {
  for (const line of readFileSync(localEnv, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^~(?=\/)/, homedir());
  }
}
const [id, ...flags] = process.argv.slice(2);
if (!id) {
  console.error('usage: node tools/lecture/build.mjs <lecture-id> [--check]');
  process.exit(2);
}
// An Atlas explainer lives in its concept's folder: src/atlas/<domain>/<concept>/.
const atlas = id.startsWith('atlas-') ? id.slice(6) : null;
const domain = atlas && readdirSync(join(root, 'src/atlas'), { withFileTypes: true }).find((d) => d.isDirectory() && existsSync(join(root, 'src/atlas', d.name, atlas, 'script.ts')));
if (atlas && !domain) {
  console.error(`no explainer script for concept ${atlas}`);
  process.exit(2);
}
const dir = atlas ? `src/atlas/${domain.name}/${atlas}` : `src/lectures/${id}`;
const { script } = await import(pathToFileURL(join(root, dir, 'script.ts')).href);
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
  audio: join(root, dir, 'narration.m4a'),
  timing: join(root, dir, 'timing.json'),
  check: flags.includes('--check'),
};
mkdirSync(dirname(job.audio), { recursive: true });
const jobFile = join(mkdtempSync(join(tmpdir(), 'lecture-')), 'job.json');
writeFileSync(jobFile, JSON.stringify(job));
const py = process.env.TTS_PY ?? 'python3';
const r = spawnSync(py, [join(import.meta.dirname, 'tts.py'), jobFile], { stdio: 'inherit' });
process.exit(r.status ?? 1);
