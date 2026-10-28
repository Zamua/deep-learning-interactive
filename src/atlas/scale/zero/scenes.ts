import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import { bars, columns } from '../../draw';
import type { Ink } from '../../linear-algebra/draw';
import { after } from '../../networks/draw';
import { rich } from '../modern-draw';
import { gpu, mono, stack } from '../draw';

const PARTS = [
  { n: 2, k: 'blue', name: 'w' },
  { n: 2, k: 'red', name: 'grad' },
  { n: 4, k: 'purple', name: 'master' },
  { n: 4, k: 'orange', name: 'm' },
  { n: 4, k: 'teal', name: 'v' },
] as const;

/** Billions of parameters, and how many bytes per parameter fill an 80 GB GPU. */
const N = 7;
const CAP = 80 / N;
/** Stage units per byte. */
const UNIT = 4;

/** How far one group of parts is cut: `c` fades the pieces a GPU gives away, `k` closes the gaps they leave. */
interface Cut {
  c: number;
  k: number;
}
const WHOLE: Cut = { c: 0, k: 0 };
/** Weights, gradients, then Adam's three parts together. */
const group = (i: number) => (i === 0 ? 0 : i === 1 ? 1 : 2);

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** Where the GPU rows sit: a bar from `x0`, one row per GPU, the 80 GB mark at `cap`. */
function rowsAt(s: Scene) {
  const x0 = s.w / 2 - (s.tall ? 34 : 30) * s.u;
  return { x0, cap: x0 + CAP * UNIT * s.u, ys: [0, 1, 2, 3].map((g) => s.h * (0.26 + g * 0.15)) };
}

const gb = (bytes: number) => {
  const v = Math.round(bytes * N * 100) / 100;
  return `${v} GB`;
};

/**
 * GPU g's bytes per parameter as a bar from x. Each cut part is drawn as four pieces, of which GPU g
 * keeps piece g; `grow` reveals the bar left to right. Returns the bytes held once the cuts close, and
 * the bar's drawn length in bytes.
 */
function bar(s: Scene, x: number, y: number, g: number, cuts: readonly Cut[], o: { grow?: number; mine?: number } = {}): { held: number; len: number } {
  const U = UNIT * s.u;
  const H = 8 * s.u;
  let shown = (o.grow ?? 1) * 16;
  let at = x;
  let held = 0;
  PARTS.forEach((p, i) => {
    const cut = cuts[group(i)]!;
    const pieces = cut.c > 0.003 || cut.k > 0.003 || (i === 0 && (o.mine ?? 0) > 0.003) ? 4 : 1;
    for (let j = 0; j < pieces; j++) {
      const kept = pieces === 1 || j === g;
      const n = (p.n / pieces) * (kept ? 1 : 1 - cut.k);
      const w = Math.max(0, Math.min(n, shown));
      shown -= n;
      held += kept ? p.n / pieces : (p.n / pieces) * (cut.k > 0.5 ? 0 : 1);
      if (w * U > 0.4 * s.u) {
        const fade = kept ? 1 : 1 - cut.c;
        s.rrect(at + 0.15 * s.u, y - H / 2, w * U - 0.3 * s.u, H, 0.8, { fill: s.tint(p.k, 0.32 * fade), stroke: s.tint(p.k, 0.25 + 0.65 * fade), lw: 0.3 });
        if (i === 0 && j === g && (o.mine ?? 0) > 0.003) s.alpha(o.mine!, () => s.rrect(at - 0.2 * s.u, y - H / 2 - 0.9 * s.u, w * U + 0.4 * s.u, H + 1.8 * s.u, 1, { stroke: s.c('green'), lw: 0.45 }));
      }
      at += n * U;
    }
  });
  return { held, len: Math.min((at - x) / U, (o.grow ?? 1) * 16) };
}

/** The GPU rows: names, the 80 GB mark, the bars, and what each holds in GB. */
function rows(s: Scene, cuts: readonly Cut[], o: { show?: number[]; grow?: number[]; mine?: number; capBelow?: boolean } = {}): void {
  const L = rowsAt(s);
  const H = 8 * s.u;
  L.ys.forEach((y, g) => {
    const a = o.show?.[g] ?? 1;
    s.alpha(a, () => {
      mono(s, `GPU ${g}`, L.x0 - 3 * s.u, y, { size: 3, k: '--ink-2', align: 'right' });
      // The GPU's own memory: an empty track up to 80 GB.
      s.rrect(L.x0 - 0.6 * s.u, y - H / 2 - 1.2 * s.u, L.cap - L.x0 + 1.2 * s.u, H + 2.4 * s.u, 1.2, { fill: s.tint('slate', 0.05), stroke: s.tint('slate', 0.55), lw: 0.3 });
      const { held, len } = bar(s, L.x0, y, g, cuts, { grow: o.grow?.[g], mine: o.mine });
      const grown = o.grow?.[g] ?? 1;
      const over = held > CAP + 1e-9;
      // What spills past the GPU's memory.
      if (len > CAP) s.rrect(L.cap, y - H / 2, (len - CAP) * UNIT * s.u, H, 0.8, { fill: s.tint('red', 0.16) });
      s.alpha(smooth((grown - 0.9) / 0.1), () => {
        const end = L.x0 + Math.max(held, CAP) * UNIT * s.u;
        mono(s, gb(held), end + 3 * s.u, y, { size: 3.4, k: over ? 'red' : 'green', align: 'left', weight: 650 });
      });
    });
  });
  // The 80 GB mark, labelled once, above the top row or below the bottom one.
  s.alpha(o.show?.[o.capBelow ? 3 : 0] ?? 1, () => mono(s, '80 GB', L.cap, o.capBelow ? L.ys[3]! + 8.5 * s.u : L.ys[0]! - 8.5 * s.u, { size: 3, k: '--ink-2' }));
}

/** A legend for the five parts, since the cut pieces get too narrow to label. */
function legend(s: Scene, y: number, hi: (i: number) => number = () => 0): void {
  const o = { size: 3, font: 'mono' } as const;
  const widths = PARTS.map((p) => s.measure(p.name, o) + 6.5 * s.u);
  let x = s.w / 2 - widths.reduce((a, w) => a + w, 0) / 2;
  PARTS.forEach((p, i) => {
    const on = hi(i);
    s.rrect(x, y - 1.4 * s.u, 2.8 * s.u, 2.8 * s.u, 0.5, { fill: s.tint(p.k, 0.5 + 0.3 * on), stroke: s.c(p.k), lw: 0.25 + 0.2 * on });
    mono(s, p.name, x + 4 * s.u, y, { size: 3, k: p.k, align: 'left', weight: 650 + 100 * on });
    x += widths[i]!;
  });
}

const cutAt = (s: Scene, id: string, f: number, closeId: string, cf: number): Cut => ({ c: after(s, id, f, 0.8), k: after(s, closeId, cf, 1) });

const copies: SceneDef = {
  draw(s) {
    const idea = cutAt(s, 'idea', 0.25, 'idea', 0.55);
    const cuts = [idea, idea, idea];
    const dp = [1, 2, 3].map((g) => s.ease('dp', 0.6, 0.6 + 0.35 * g));
    rows(s, cuts, { show: [1, ...dp], grow: [s.ease('state', 1.4, 0.4), 1, 1, 1] });
    const top = (text: string, a: number, k: Ink = '--ink-3') => s.alpha(a, () => mono(s, text, s.w / 2, s.h * 0.08, { size: 3.4, k }));
    top('one GPU: 80 GB of memory', s.win('gpu', 'state'));
    top('16 bytes × 7 × 10⁹ = 112 GB', s.win('state', 'waste'));
    top('4 GPUs × 80 GB = 320 GB in all', s.win('waste', 'idea'));
    top('112 GB / 4 = 28 GB each', s.win('idea', 'name'), 'green');
    const cy = s.h * 0.88;
    const cap = (text: string, a: number, k: Ink = '--ink-2') => s.alpha(a, () => mono(s, text, s.w / 2, cy, { size: s.tall ? 3.2 : 3.6, k, weight: 600, halo: true }));
    cap('training state: past the 80 GB mark', after(s, 'state', 0.6) * (1 - s.ease('dp', 0.5)), 'red');
    cap('data parallelism: a full copy on each', s.win('dp', 'waste'));
    cap('four identical copies; none fits', s.win('waste', 'idea'), 'red');
    cap('one copy, in four pieces', s.win('idea', 'shard'), 'green');
    cap('a shard: a broken-off piece', s.win('shard', 'name'));
    cap('ZeRO: Zero Redundancy Optimizer', s.ease('name', 0.6), 'green');
    cite(s, 'Rajbhandari, Rasley, Ruwase & He, 2019', s.ease('name', 0.6));
  },
};

const stages: SceneDef = {
  draw(s) {
    const opt = cutAt(s, 's1', 0.45, 's1b', 0.1);
    const grad = cutAt(s, 's2', 0.3, 's2b', 0.1);
    const w = cutAt(s, 's3', 0.15, 's3', 0.55);
    rows(s, [w, grad, opt], { mine: s.win('own', 's1b'), capBelow: true });
    legend(s, s.h * 0.16, (i) => s.win('bar', 's1') * after(s, 'bar', [0.15, 0.3, 0.6, 0.8, 0.85][i]!) + (i >= 2 ? s.win('s1', 's1b') : 0));
    const label = (text: string, a: number) => s.alpha(a, () => mono(s, text, s.w / 2, s.h * 0.08, { size: s.tall ? 3.2 : 3.6, weight: 650 }));
    label('16 bytes per parameter, on every GPU', s.win('bar', 's1'));
    label('stage 1: Adam\'s 12 bytes, split 4 ways', s.win('s1', 's2'));
    label('stage 2: + the gradients', s.win('s2', 's3'));
    label('stage 3: + the weights', s.ease('s3', 0.6));
    // Bytes per parameter on each GPU, then the GB they come to.
    const o = { size: s.tall ? 3.2 : 3.4 };
    const ink: Ink = '--ink-2';
    const y1 = s.h * 0.855;
    const y2 = s.h * 0.925;
    const line2 = (text: string, a: number, k: Ink = '--ink') => s.alpha(a, () => mono(s, text, s.w / 2, y2, { ...o, k, weight: 650 }));
    s.alpha(s.win('own', 's1b'), () => mono(s, 'GPU i updates weight quarter i, then all swap', s.w / 2, y1, { ...o, k: 'green' }));
    s.alpha(s.win('s1b', 's2'), () => rich(s, [['2', 'blue'], [' + ', ink], ['2', 'red'], [' + ', ink], ['12', '--ink'], [' / 4 = 7 bytes per parameter', ink]], s.w / 2, y1, o));
    line2('7 × 7 × 10⁹ bytes = 49 GB: it fits', s.win('s1gb', 's2'), 'green');
    s.alpha(s.win('s2', 's2b'), () => mono(s, 'a GPU needs the gradient of its own quarter', s.w / 2, y1, { ...o, k: ink }));
    s.alpha(s.win('s2b', 's3'), () => rich(s, [['2', 'blue'], [' + (', ink], ['2', 'red'], [' + ', ink], ['12', '--ink'], [') / 4 = 2 + 3.5', ink]], s.w / 2, y1, o));
    line2('5.5 bytes per parameter: 38.5 GB', s.win('s2gb', 's3'));
    s.alpha(s.win('s3', 'rule'), () => rich(s, [['16', '--ink'], [' / 4 = 4 bytes per parameter', ink]], s.w / 2, y1, o));
    line2('4 × 7 × 10⁹ bytes = 28 GB = 112 / 4', s.win('s3gb', 'rule'));
    s.alpha(s.ease('rule', 0.6), () => rich(s, [['16 ', '--ink'], ['N', 'slate'], [' / ', ink], ['G', 'slate'], [' bytes per GPU: ', ink], ['G', 'slate'], ['× less', ink]], s.w / 2, y1, o));
    line2('saved: 112 − 28 = 84 GB per GPU', s.ease('saved', 0.6), 'green');
  },
};

const PIECE = ['blue', 'orange', 'green', 'purple'] as const;

const cost: SceneDef = {
  draw(s) {
    // Stage 3: each GPU keeps a quarter of the weights; a piece is gathered whole, then dropped.
    const cards = 1 - s.ease('traffic', 0.5);
    s.alpha(cards, () => {
      const xs = columns(s, 4, s.tall ? 26 : 30);
      const y = s.h * 0.62;
      xs.forEach((x, g) => {
        gpu(s, x, y, s.tall ? 23 : 26, 24, `GPU ${g}`);
        stack(s, x - 2 * 4 * s.u + g * 4 * s.u, y + 2 * s.u, 4, 6, [{ n: 1, k: PIECE[g]! }]);
      });
      const gather = after(s, 'gather', 0.35, 0.8);
      const drop = after(s, 'gather', 0.85, 0.6);
      s.alpha(gather * (1 - drop), () => {
        const yW = s.h * 0.28;
        xs.forEach((x, g) => s.arrow(x, y - 12 * s.u, s.w / 2 - 6 * s.u + g * 4 * s.u, yW + 5 * s.u, s.tint('--ink-3', 0.9), 0.3, 1.8));
        stack(s, s.w / 2 - 8 * s.u, yW, 4, 6, PIECE.map((k) => ({ n: 1, k })));
        mono(s, 'all the weights, just before use', s.w / 2, yW - 7 * s.u, { size: 3.2, k: '--ink-2' });
      });
      s.alpha(drop * (1 - s.ease('same', 0.5)), () => mono(s, 'used, then dropped', s.w / 2, s.h * 0.28, { size: 3.4, k: '--ink-3' }));
      s.alpha(s.ease('same', 0.6), () => {
        mono(s, 'same averaged gradient, same step', s.w / 2, s.h * 0.24, { size: s.tall ? 3.2 : 3.6, k: 'green', weight: 650 });
        mono(s, 'only where the numbers live changes', s.w / 2, s.h * 0.32, { size: s.tall ? 3 : 3.4, k: '--ink-2' });
      });
    });
    // Traffic per step, against plain data parallelism.
    s.alpha(s.win('traffic', 'more'), () => {
      const xs = columns(s, 4, s.tall ? 22 : 28);
      const base = s.h * 0.78;
      bars(s, xs, base, [1, 1, 1, 1.5], 'slate', { max: 1.5, height: 46, w: 12, grow: s.ease('traffic', 1, 0.4), fmt: (v) => `${v}×`, hi: [0, 0, 0, after(s, 'traffic', 0.7)] });
      ['plain', 'stage 1', 'stage 2', 'stage 3'].forEach((t, i) => mono(s, t, xs[i]!, base + 4 * s.u, { size: 3, k: '--ink-2' }));
      mono(s, 'traffic between GPUs, per step', s.w / 2, s.h * 0.12, { size: s.tall ? 3 : 3.4, k: '--ink-2' });
    });
    // Memory per GPU at stage 3, as GPUs are added.
    s.alpha(s.win('more', 'trillion'), () => {
      const xs = columns(s, 4, s.tall ? 22 : 28);
      const base = s.h * 0.78;
      bars(s, xs, base, [112, 28, 7, 1.75], 'purple', { max: 112, height: 50, w: 12, grow: s.ease('more', 1, 0.4), fmt: (v) => `${v} GB`, hi: [0, 0, 0, after(s, 'more', 0.6)] });
      ['1', '4', '16', '64'].forEach((g, i) => mono(s, `${g} GPU${g === '1' ? '' : 's'}`, xs[i]!, base + 4 * s.u, { size: 3, k: '--ink-2' }));
      mono(s, 'stage 3, 7 × 10⁹ parameters: GB per GPU', s.w / 2, s.h * 0.12, { size: s.tall ? 3 : 3.4, k: '--ink-2' });
    });
    // The paper's aim: a trillion parameters.
    s.alpha(s.ease('trillion', 0.6), () => {
      const size = s.tall ? 3.4 : 3.8;
      mono(s, 'a trillion parameters', s.w / 2, s.h * 0.34, { size: size + 0.6, k: '--ink', weight: 650 });
      mono(s, '10¹² × 16 bytes = 16,000 GB', s.w / 2, s.h * 0.48, { size, k: '--ink-2' });
      s.alpha(after(s, 'trillion', 0.55), () => mono(s, '16,000 GB / 1,024 GPUs ≈ 16 GB each', s.w / 2, s.h * 0.6, { size, k: 'green', weight: 650 }));
    });
    cite(s, 'Rajbhandari, Rasley, Ruwase & He, 2019', Math.max(s.win('traffic', 'more'), s.ease('trillion', 0.6)));
  },
};

export const scenes: Record<string, SceneDef> = { copies, stages, cost };
