"""Kokoro narration for a lecture: one cached clip per beat, joined into one track plus its timing."""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

SR = 24000


def env_path(name, default):
    return os.path.expanduser(os.environ.get(name, default))


def trim(a, thresh=0.01, keep=0.04):
    """Drops the model's leading and trailing silence so the gaps between beats are exactly GAP."""
    loud = np.flatnonzero(np.abs(a) > thresh)
    if not len(loud):
        return a
    k = int(keep * SR)
    return a[max(0, loud[0] - k): loud[-1] + k]


def words(s):
    return re.sub(r"[^a-z0-9' ]", ' ', s.lower()).split()


def wer(ref, hyp):
    r, h = words(ref), words(hyp)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
    return d[len(h)] / max(1, len(r))


def main():
    job = json.load(open(sys.argv[1]))
    cache = env_path('TTS_CACHE', '~/ml/caches/cs231n-tts')
    os.makedirs(cache, exist_ok=True)
    kokoro = None

    def clip(text):
        nonlocal kokoro
        key = hashlib.sha1(f"{job['voice']}|{job['speed']}|{text}".encode()).hexdigest()[:20]
        path = os.path.join(cache, f'{key}.wav')
        if not os.path.exists(path):
            if kokoro is None:
                from kokoro_onnx import Kokoro
                d = env_path('KOKORO_DIR', '~/ml/models/kokoro')
                kokoro = Kokoro(os.path.join(d, 'kokoro-v1.0.onnx'), os.path.join(d, 'voices-v1.0.bin'))
            samples, sr = kokoro.create(text, voice=job['voice'], speed=job['speed'], lang='en-us')
            assert sr == SR, sr
            sf.write(path, trim(samples), SR)
        return path

    gap = job['gap']
    sil = lambda s: np.zeros(int(round(s * SR)), dtype=np.float32)
    parts, n, beats, scenes, clips = [], 0, {}, {}, []
    for s in job['scenes']:
        start = n
        parts.append(sil(gap['sceneLead']))
        n += len(parts[-1])
        for i, b in enumerate(s['beats']):
            path = clip(b['text'])
            a = sf.read(path, dtype='float32')[0]
            beats[f"{s['id']}/{b['id']}"] = [round(n / SR, 3), round((n + len(a)) / SR, 3), b['text']]
            clips.append((f"{s['id']}/{b['id']}", b['text'], path))
            parts.append(a)
            n += len(a)
            parts.append(sil((gap['sceneTail'] if i == len(s['beats']) - 1 else gap['beat']) + b['pause']))
            n += len(parts[-1])
        scenes[s['id']] = [round(start / SR, 3), round(n / SR, 3)]
        print(f"  {s['id']:<14} {round((n - start) / SR):>4}s", flush=True)

    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, 'full.wav')
        sf.write(wav, np.concatenate(parts), SR)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
                        '-ar', str(SR), '-ac', '1', '-c:a', 'aac', '-b:a', '48k', '-movflags', '+faststart',
                        job['audio']], check=True)
    with open(job['timing'], 'w') as f:
        json.dump({'duration': round(n / SR, 3), 'scenes': scenes, 'beats': beats}, f, indent=1)
        f.write('\n')
    print(f"{round(n / SR / 60, 1)} min, {os.path.getsize(job['audio']) / 2**20:.1f} MiB -> {job['audio']}")

    if job['check']:
        model = env_path('WHISPER_MODEL', '~/ml/models/whisper/ggml-large-v3-turbo-q5_0.bin')
        for key, text, path in clips:
            out = subprocess.run(['whisper-cli', '-m', model, '-f', path, '-nt', '-np'],
                                 capture_output=True, text=True).stdout
            heard = ' '.join(out.split())
            e = wer(text, heard)
            if e > 0.12:
                print(f'\n[{e:.2f}] {key}\n  said:  {text}\n  heard: {heard}')


if __name__ == '__main__':
    main()
