import { DiffNet, moons, spiral, type Points } from './diffusion-net';
import { LOSS, LOSS_EVERY, SNAPSHOTS, STEPS, WEIGHTS } from './diffusion-weights';

export type ModelKind = keyof typeof WEIGHTS;

export function decodeF32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

const cache = new Map<ModelKind, DiffNet>();

/** The shipped networks, trained with the page's own `Trainer` on `MOONS`. */
export function model(kind: ModelKind): DiffNet {
  let net = cache.get(kind);
  if (!net) {
    net = new DiffNet({ classes: kind === 'cond' ? 2 : 0 });
    net.load(decodeF32(WEIGHTS[kind]), STEPS[kind]);
    cache.set(kind, net);
  }
  return net;
}

export const MOONS: Points = moons(1000);
export const SPIRAL: Points = spiral(1000);

export const TRAIN_LOSS = { every: LOSS_EVERY, loss: LOSS };

/** Sample clouds of the unconditional run at a few training steps. */
export function snapshots(): { step: number; pts: Float32Array }[] {
  return Object.entries(SNAPSHOTS)
    .map(([k, v]) => ({ step: Number(k), pts: decodeF32(v) }))
    .sort((a, b) => a.step - b.step);
}
