"""Lecture narration: one cached clip per beat (Kokoro locally, or an OpenRouter speech model),
joined into one track plus its timing."""
import concurrent.futures
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

import numpy as np
import soundfile as sf


def env_path(name, default):
    return os.path.expanduser(os.environ.get(name, default))


def trim(a, sr, thresh=0.01, keep=0.04):
    """Drops leading and trailing silence so the gaps between beats are exactly GAP."""
    loud = np.flatnonzero(np.abs(a) > thresh)
    if not len(loud):
        return a
    k = int(keep * sr)
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


class Kokoro:
    sr = 24000

    def __init__(self, voice, speed):
        self.voice, self.speed, self.k = voice, speed, None

    def key(self, text):
        return f'{self.voice}|{self.speed}|{text}'

    def synth(self, text):
        if self.k is None:
            from kokoro_onnx import Kokoro as K
            d = env_path('KOKORO_DIR', '~/ml/models/kokoro')
            self.k = K(os.path.join(d, 'kokoro-v1.0.onnx'), os.path.join(d, 'voices-v1.0.bin'))
        samples, sr = self.k.create(text, voice=self.voice, speed=self.speed, lang='en-us')
        assert sr == self.sr, sr
        return samples


class OpenRouter:
    sr = 44100
    parallel = 6

    def __init__(self, model, voice):
        self.model, self.voice = model, voice
        with open(env_path('OPENROUTER_KEY_FILE', '~/keys/openrouter')) as f:
            self.token = f.read().strip()

    def key(self, text):
        return f'{self.model}|{self.voice}|{text}'

    def synth(self, text):
        body = json.dumps({'model': self.model, 'input': text, 'voice': self.voice, 'response_format': 'mp3'}).encode()
        for attempt in range(4):
            req = urllib.request.Request('https://openrouter.ai/api/v1/audio/speech', data=body, headers={
                'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'})
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    mp3 = r.read()
                break
            except (urllib.error.URLError, TimeoutError) as e:
                if attempt == 3:
                    raise RuntimeError(f'speech request failed for {text[:40]!r}: {e}')
                time.sleep(2 ** attempt)
        pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', str(self.sr), 'pipe:1'],
                             input=mp3, capture_output=True, check=True).stdout
        return np.frombuffer(pcm, dtype=np.float32)


def main():
    job = json.load(open(sys.argv[1]))
    cache = env_path('TTS_CACHE', '~/ml/caches/cs231n-tts')
    os.makedirs(cache, exist_ok=True)
    tts = Kokoro(job['voice'], job['speed']) if job['model'] == 'kokoro' else OpenRouter(job['model'], job['voice'])
    sr = tts.sr

    def path_of(text):
        return os.path.join(cache, hashlib.sha1(tts.key(text).encode()).hexdigest()[:20] + '.wav')

    def make(text):
        sf.write(path_of(text), trim(tts.synth(text), sr), sr)

    todo = sorted({b['text'] for s in job['scenes'] for b in s['beats'] if not os.path.exists(path_of(b['text']))})
    if todo:
        print(f'synthesizing {len(todo)} beats with {job["model"]}:{job["voice"]}', flush=True)
        with concurrent.futures.ThreadPoolExecutor(getattr(tts, 'parallel', 1)) as ex:
            list(ex.map(make, todo))

    gap = job['gap']
    sil = lambda s: np.zeros(int(round(s * sr)), dtype=np.float32)
    parts, n, beats, scenes, clips = [], 0, {}, {}, []
    for s in job['scenes']:
        start = n
        parts.append(sil(gap['sceneLead']))
        n += len(parts[-1])
        for i, b in enumerate(s['beats']):
            path = path_of(b['text'])
            a = sf.read(path, dtype='float32')[0]
            beats[f"{s['id']}/{b['id']}"] = [round(n / sr, 3), round((n + len(a)) / sr, 3), b['text']]
            clips.append((f"{s['id']}/{b['id']}", b['text'], path))
            parts.append(a)
            n += len(a)
            parts.append(sil((gap['sceneTail'] if i == len(s['beats']) - 1 else gap['beat']) + b['pause']))
            n += len(parts[-1])
        scenes[s['id']] = [round(start / sr, 3), round(n / sr, 3)]
        print(f"  {s['id']:<14} {round((n - start) / sr):>4}s", flush=True)

    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, 'full.wav')
        sf.write(wav, np.concatenate(parts), sr)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
                        '-ar', str(sr), '-ac', '1', '-c:a', 'aac', '-b:a', '64k' if sr > 24000 else '48k',
                        '-movflags', '+faststart', job['audio']], check=True)
    with open(job['timing'], 'w') as f:
        json.dump({'duration': round(n / sr, 3), 'scenes': scenes, 'beats': beats}, f, indent=1)
        f.write('\n')
    print(f"{round(n / sr / 60, 1)} min, {os.path.getsize(job['audio']) / 2**20:.1f} MiB -> {job['audio']}")

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
