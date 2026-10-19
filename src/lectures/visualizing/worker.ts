/**
 * Runs the lecture's slow experiments off the main thread: occlusion, saliency, class
 * visualization, inversion, DeepDream, texture synthesis and the fooling attacks. Jobs the scene
 * on screen wants run first; every result is posted back as it is produced.
 */
import { Rng } from '../../core/rand';
import { ConvNet, type ReluRule, type Stage, type Trace, addTvGrad, argmax, blur3, clampImage, gram, roll, softmax } from '../../lib/visualizing-net';
import { CLASS_VIZ, FRAME, INVERT, type In, type Init, type Out } from './protocol';

const scope = self as unknown as { onmessage: ((e: MessageEvent<In>) => void) | null; postMessage(m: Out, o?: { transfer?: Transferable[] }): void };
const post = (m: Out, transfer: Transferable[] = []) => scope.postMessage(m, { transfer });

interface Job {
  key: string;
  done: boolean;
  step(): boolean;
}

let jobs: Job[] = [];
let wanted = new Set<string>();
let paused = false;
let running = false;

function loop(): void {
  running = false;
  if (paused) return;
  const open = jobs.filter((j) => !j.done);
  if (!open.length) return;
  const w = open.filter((j) => wanted.has(j.key));
  const pool = w.length ? w : [open[0]!];
  const t0 = performance.now();
  let k = 0;
  while (performance.now() - t0 < 25 && pool.some((j) => !j.done)) {
    const j = pool[k++ % pool.length]!;
    if (j.done) continue;
    if (!j.step()) {
      j.done = true;
      post({ key: j.key, kind: 'done' });
    }
  }
  kick();
}

function kick(): void {
  if (!running) {
    running = true;
    setTimeout(loop, 0);
  }
}

function build(m: Init): Job[] {
  const net = new ConvNet(m.manifest, m.buf);
  const mean = net.mean;
  const out: Job[] = [];
  const add = (key: string, step: () => boolean) => out.push({ key, done: false, step });

  // An 8 x 8 gray patch at 256 positions: the true class's probability at each.
  {
    let pos = 0;
    add('occlusion', () => {
      const xi = Float32Array.from(m.occ.x);
      const t0 = 2 * Math.floor(pos / 16) + 1 - 4;
      const l0 = 2 * (pos % 16) + 1 - 4;
      for (let ch = 0; ch < 3; ch++)
        for (let y = Math.max(0, t0); y < Math.min(32, t0 + 8); y++)
          for (let q = Math.max(0, l0); q < Math.min(32, l0 + 8); q++) xi[ch * 1024 + y * 32 + q] = 0;
      post({ key: 'occlusion', kind: 'occ', pos, p: softmax(net.forward(xi).scores)[m.occ.y]! });
      return ++pos < 256;
    });
  }

  // Saliency under the three backward rules, for each requested class.
  {
    const todo: [ReluRule, number][] = [];
    for (const r of ['grad', 'deconv', 'guided'] as ReluRule[]) for (const c of m.sal.classes) todo.push([r, c]);
    let i = 0;
    add('saliency', () => {
      const [rule, c] = todo[i]!;
      const { dx } = net.scoreGrad(m.sal.x, c, rule);
      const sal = new Float32Array(1024);
      for (let q = 0; q < 1024; q++) sal[q] = Math.max(Math.abs(dx[q]!), Math.abs(dx[1024 + q]!), Math.abs(dx[2048 + q]!));
      post({ key: 'saliency', kind: 'sal', rule, c, sal }, [sal.buffer]);
      return ++i < todo.length;
    });
  }

  // Class visualization: gradient ascent on the pixels, with jitter, L2, blur and clipping.
  for (const target of CLASS_VIZ) {
    const key = `class-${target}`;
    const r0 = new Rng(target + 1);
    let x: Float32Array = Float32Array.from({ length: 3072 }, () => 0.02 * r0.randn());
    const rng = new Rng(3);
    let step = 0;
    const snap = () => {
      const v = softmax(net.forward(x).scores)[target]!;
      const c = Float32Array.from(x);
      post({ key, kind: 'frame', step, x: c, v }, [c.buffer]);
    };
    snap();
    add(key, () => {
      const jy = rng.int(5) - 2;
      const jx = rng.int(5) - 2;
      const xr = roll(x, jy, jx);
      const { dx } = net.scoreGrad(xr, target);
      for (let i = 0; i < 3072; i++) xr[i]! += 0.05 * (dx[i]! - 2 * 1e-3 * xr[i]!);
      x = roll(xr, -jy, -jx);
      clampImage(x, mean);
      if (step % 10 === 0) blur3(x, 0.5);
      step++;
      if (step % FRAME === 0) snap();
      return step < 300;
    });
  }

  // Feature inversion: from noise, match one layer's code of the frog.
  for (const layer of INVERT) {
    const key = `invert-${layer}`;
    const F0 = Float32Array.from(net.stage(net.forward(m.frog), layer));
    let z0 = 0;
    for (let i = 0; i < F0.length; i++) z0 += F0[i]! * F0[i]!;
    const r = new Rng(11);
    const x = Float32Array.from({ length: 3072 }, () => 0.02 * r.randn());
    const v = new Float32Array(3072);
    let step = 0;
    {
      const c = Float32Array.from(x);
      post({ key, kind: 'frame', step: 0, x: c, v: 1 }, [c.buffer]);
    }
    add(key, () => {
      const t = net.forward(x);
      const F = net.stage(t, layer);
      const dF = new Float32Array(F.length);
      let l = 0;
      for (let i = 0; i < F.length; i++) {
        const d = F[i]! - F0[i]!;
        l += d * d;
        dF[i] = (2 * d) / z0;
      }
      const dx = net.backward(t, { [layer]: dF });
      addTvGrad(x, dx, 0.005);
      for (let i = 0; i < 3072; i++) {
        v[i] = 0.9 * v[i]! - 0.2 * dx[i]!;
        x[i]! += v[i]!;
      }
      clampImage(x, mean);
      step++;
      if (step % FRAME === 0) {
        const c = Float32Array.from(x);
        post({ key, kind: 'frame', step, x: c, v: l / z0 }, [c.buffer]);
      }
      return step < 200;
    });
  }

  // DeepDream on conv3: the activations injected as their own gradient.
  {
    let x: Float32Array = Float32Array.from(m.dream);
    const rng = new Rng(5);
    let step = 0;
    add('dream', () => {
      const jy = rng.int(5) - 2;
      const jx = rng.int(5) - 2;
      const xr = roll(x, jy, jx);
      const tr = net.forward(xr);
      const dx = net.backward(tr, { relu3: net.stage(tr, 'relu3') });
      let s = 0;
      for (let i = 0; i < 3072; i++) s += Math.abs(dx[i]!);
      s /= 3072;
      for (let i = 0; i < 3072; i++) xr[i]! += (0.004 * dx[i]!) / (s || 1);
      x = roll(xr, -jy, -jx);
      clampImage(x, mean);
      step++;
      const c = Float32Array.from(x);
      post({ key: 'dream', kind: 'frame', step, x: c, v: step }, [c.buffer]);
      return step < 60;
    });
  }

  // Texture synthesis: match the frog's Gram matrices at conv1 and conv2.
  {
    const LAYERS: Stage[] = ['relu1', 'relu2'];
    const grams = (t: Trace) =>
      LAYERS.map((l) => {
        const [C, H] = net.shape(l);
        return gram(net.stage(t, l), C, H * H);
      });
    const G0 = grams(net.forward(m.frog));
    const Z = G0.map((g) => g.reduce((s, q) => s + q * q, 0));
    post({ key: 'texture', kind: 'gram-src', g: Float32Array.from(G0[0]!) });
    const r = new Rng(4);
    const x = Float32Array.from({ length: 3072 }, () => 0.05 * r.randn());
    const v = new Float32Array(3072);
    let step = 0;
    const snap = (loss: number) => {
      const c = Float32Array.from(x);
      const g = grams(net.forward(x))[0]!;
      post({ key: 'texture', kind: 'frame', step, x: c, v: loss, g }, [c.buffer, g.buffer]);
    };
    snap(NaN);
    add('texture', () => {
      const t = net.forward(x);
      const Gx = grams(t);
      const inj: Partial<Record<Stage, Float32Array>> = {};
      let loss = 0;
      LAYERS.forEach((l, li) => {
        const [C, H] = net.shape(l);
        const M = H * H;
        const G = Gx[li]!;
        const F = net.stage(t, l);
        const dF = new Float32Array(C * M);
        for (let i = 0; i < C; i++)
          for (let j = 0; j < C; j++) {
            const d = G[i * C + j]! - G0[li]![i * C + j]!;
            loss += (d * d) / Z[li]!;
            const g = (4 * d) / Z[li]! / M;
            if (g === 0) continue;
            for (let k = 0; k < M; k++) dF[i * M + k]! += g * F[j * M + k]!;
          }
        inj[l] = dF;
      });
      const dx = net.backward(t, inj);
      addTvGrad(x, dx, 0.002);
      for (let i = 0; i < 3072; i++) {
        v[i] = 0.9 * v[i]! - 0.05 * dx[i]!;
        x[i]! += v[i]!;
      }
      clampImage(x, mean);
      step++;
      if (step % FRAME === 0) snap(loss);
      return step < 300;
    });
  }

  // Fooling: sign steps of a quarter brightness level toward the target until the network agrees.
  {
    const x = Float32Array.from(m.fool.x);
    const snap = (scores: Float32Array) => {
      const c = Float32Array.from(x);
      const probs = softmax(scores);
      post({ key: 'fool', kind: 'fool', x: c, probs }, [c.buffer, probs.buffer]);
    };
    snap(net.forward(x).scores);
    let n = 0;
    add('fool', () => {
      const tr = net.forward(x);
      if (argmax(tr.scores) === m.fool.target || n >= 120) return false;
      const g = new Float32Array(10);
      g[m.fool.target] = 1;
      const dx = net.backward(tr, { scores: g });
      for (let i = 0; i < 3072; i++) x[i]! += (0.25 / 255) * Math.sign(dx[i]!);
      clampImage(x, mean);
      n++;
      snap(net.forward(x).scores);
      return true;
    });
  }

  // One FGSM step away from the true label, at a few sizes of epsilon.
  add('fgsm', () => {
    const tr = net.forward(m.fool.x);
    const g = Float32Array.from(softmax(tr.scores));
    g[m.fool.y]! -= 1;
    const dx = net.backward(tr, { scores: g });
    for (const e of [1, 2, 4, 8]) {
      const x = Float32Array.from(m.fool.x);
      for (let i = 0; i < 3072; i++) x[i]! += (e / 255) * Math.sign(dx[i]!);
      clampImage(x, mean);
      const p = softmax(net.forward(x).scores);
      post({ key: 'fgsm', kind: 'fgsm', eps: e, pred: argmax(p), conf: p[argmax(p)]! });
    }
    return false;
  });
  return out;
}

scope.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') jobs = build(m);
  else if (m.type === 'want') wanted = new Set(m.keys);
  else paused = m.type === 'pause';
  kick();
};
