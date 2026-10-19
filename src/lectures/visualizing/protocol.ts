/** Messages between the lecture and its experiment worker, and the experiments' fixed choices. */
import type { ConvNet, ReluRule, Stage } from '../../lib/visualizing-net';

export interface Init {
  type: 'init';
  manifest: ConstructorParameters<typeof ConvNet>[0];
  buf: ArrayBuffer;
  occ: { x: Float32Array; y: number };
  sal: { x: Float32Array; classes: number[] };
  frog: Float32Array;
  dream: Float32Array;
  fool: { x: Float32Array; y: number; target: number };
}
export type In = Init | { type: 'want'; keys: string[] } | { type: 'pause' } | { type: 'resume' };

export type Out =
  | { key: string; kind: 'occ'; pos: number; p: number }
  | { key: string; kind: 'sal'; rule: ReluRule; c: number; sal: Float32Array }
  | { key: string; kind: 'frame'; step: number; x: Float32Array; v: number; g?: Float32Array }
  | { key: string; kind: 'gram-src'; g: Float32Array }
  | { key: string; kind: 'fool'; x: Float32Array; probs: Float32Array }
  | { key: string; kind: 'fgsm'; eps: number; pred: number; conf: number }
  | { key: string; kind: 'done' };

export const CLASS_VIZ = [4, 7, 1, 8];
export const INVERT: Stage[] = ['relu1', 'relu2', 'relu3', 'pool3'];
export const FRAME = 5;
