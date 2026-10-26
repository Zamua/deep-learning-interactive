import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import { type Ink, volume } from '../draw';

const RGB: Ink[] = ['red', 'green', 'blue'];
const IN_STEP = 3;

/** Shared geometry: sheet size, the input's front sheet, the output's front sheet. */
function frame(s: Scene) {
  const sz = (s.tall ? 21 : 26) * s.u;
  const top = s.h * 0.42 - sz / 2;
  return { sz, top, ix: s.w * 0.07, ox: s.w * 0.62, mx: s.w * 0.47, ly: s.h * 0.42 + sz / 2 + 6 * s.u };
}

const label = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.4) => s.text(t, x, y, { size, font: 'mono', weight: 600, color: s.c(k), halo: true });

/** The input image: three colored sheets, with an optional window outlined on each at (u, v) in [0, 1]. */
function input(s: Scene, f: ReturnType<typeof frame>, win: { u: number; v: number; a: number }) {
  volume(s, f.ix, f.top, f.sz, 3, (l) => RGB[l]!, { step: IN_STEP });
  if (win.a > 0) {
    const ws = f.sz * 0.28;
    s.alpha(win.a, () => {
      for (let l = 2; l >= 0; l--) {
        const x = f.ix + l * IN_STEP * s.u + win.u * (f.sz - ws);
        const y = f.top - l * IN_STEP * s.u + win.v * (f.sz - ws);
        s.rrect(x, y, ws, ws, 0.6, { stroke: s.c('--ink'), lw: l === 0 ? 0.5 : 0.3 });
      }
    });
  }
  label(s, '(3, 32, 32)', f.ix + f.sz / 2 + IN_STEP * s.u, f.ly, '--ink-2');
}

/** A small filter: `n` sheets of a few stage units, centered on (cx, cy). */
function miniFilter(s: Scene, cx: number, cy: number, n: number, size: number, ink: (l: number) => Ink, on = 0, st = 1.4) {
  const sz = size * s.u;
  volume(s, cx - sz / 2 - ((n - 1) * st * s.u) / 2, cy - sz / 2 + ((n - 1) * st * s.u) / 2, sz, n, ink, { step: st, on: () => on });
}

const depth: SceneDef = {
  draw(s) {
    const f = frame(s);
    const one = s.ease('one', 0.6);
    const sweep = clamp01((s.since('map') - 0.6) / 5);
    const rows = 4;
    const r = Math.min(rows - 1, Math.floor(sweep * rows));
    const u = sweep >= 1 ? 1 : (sweep * rows) % 1;
    const v = r / (rows - 1);
    const pos = s.ease('map', 0.3) > 0 ? { u, v } : { u: 0.25, v: 0.3 };
    input(s, f, { ...pos, a: s.ease('filter', 0.6) });

    const fy = s.h * 0.42;
    s.alpha(s.ease('filter', 0.6, 0.6), () => {
      miniFilter(s, f.mx, fy, 3, 8, (l) => RGB[l]!, one);
      label(s, '3 × 3 × 3', f.mx, f.ly, 'blue');
      label(s, '27 weights', f.mx, f.ly + 5 * s.u, '--ink-3', 3.1);
    });

    const outA = s.ease('one', 0.6, 1.5);
    s.alpha(outA, () => {
      s.rrect(f.ox, f.top, f.sz, f.sz, 0.8, { stroke: s.tint('gold', 0.7), lw: 0.3, fill: s.tint('gold', 0.05) });
      // Filled so far: whole rows above the window's row, and the current row up to it.
      const rh = f.sz / rows;
      const done = s.ease('map', 0.3) > 0 ? sweep : 0;
      const full = Math.floor(done * rows);
      if (full > 0) s.rrect(f.ox, f.top, f.sz, rh * full, 0.4, { fill: s.tint('gold', 0.3) });
      if (full < rows && done > 0) s.rrect(f.ox, f.top + rh * full, f.sz * ((done * rows) % 1), rh, 0.4, { fill: s.tint('gold', 0.3) });
      const dx = f.ox + (0.14 + 0.72 * pos.u) * f.sz;
      const dy = f.top + (0.14 + 0.72 * pos.v) * f.sz;
      s.circle(dx, dy, 1.4 * s.u, { fill: s.c('gold') });
      const wx = f.ix + pos.u * (f.sz - f.sz * 0.28) + f.sz * 0.28;
      const wy = f.top + pos.v * (f.sz - f.sz * 0.28) + f.sz * 0.14;
      s.alpha(1 - s.ease('map', 0.5, 0.2), () => {
        s.arrow(wx + 1 * s.u, wy, f.mx - 6 * s.u, fy, s.tint('--ink-3', 0.9), 0.35, 2);
        s.arrow(f.mx + 6 * s.u, fy, dx - 2 * s.u, dy, s.tint('gold', 0.9), 0.35, 2);
      });
    });
    s.alpha(s.ease('one', 0.6, 2.4) * (1 - s.ease('map', 0.5)), () => s.text('27 products add up to 1 number', s.w / 2, s.h * 0.88, { size: 3.6, font: 'mono', color: s.c('gold') }));
    s.alpha(s.ease('map', 0.6, 4), () => {
      label(s, '(30, 30)', f.ox + f.sz / 2, f.ly, 'gold');
      s.text('one output channel', s.w / 2, s.h * 0.88, { size: 3.6, font: 'mono', color: s.c('gold') });
    });
  },
};

const K = 8;

const many: SceneDef = {
  draw(s) {
    const f = frame(s);
    input(s, f, { u: 0.25, v: 0.3, a: 0 });
    const pitch = (s.tall ? 7 : 7.4) * s.u;
    const fy = (k: number) => s.h * 0.42 + (k - (K - 1) / 2) * pitch;
    const at = (l: number) => s.ease('stack', 0.4, 0.4 + l * 0.45);
    const kA = s.ease('k', 0.6);
    s.alpha(kA, () => {
      for (let k = 0; k < K; k++) miniFilter(s, f.mx, fy(k), 3, 4.2, () => 'blue', at(k) * (1 - at(k + 1)), 0.7);
      label(s, 'K = 8', f.mx, fy(0) - 6 * s.u, 'slate');
    });
    // Sheet 0 is the map from scene one; the rest arrive one per filter.
    volume(s, f.ox, f.top, f.sz, K, () => 'gold', { step: 1.1, a: (l) => (l === 0 ? 1 : at(l)), on: (l) => at(l) * (1 - at(l + 1)) });
    s.alpha(s.ease('stack', 0.6, 4), () => label(s, '(8, 30, 30)', f.ox + f.sz / 2 + 4 * s.u, f.ly, 'gold'));
    s.alpha(s.win('shape', 'next'), () => {
      s.text('depth = K', s.w / 2, s.h * 0.84, { size: 3.6, font: 'mono', weight: 600, color: s.c('gold') });
      s.text('height, width: 32 − 3 + 1 = 30', s.w / 2, s.h * 0.91, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('next', 0.6, 0.4), () => {
      const cx = s.w / 2 - 12 * s.u;
      miniFilter(s, cx, s.h * 0.86, K, 6, () => 'gold', 1, 0.6);
      s.text('next filter: 8 × 3 × 3', cx + 8 * s.u, s.h * 0.86, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
    });
  },
};

/** Eases in a fraction `f` of the way through beat `id`, so it follows the voice at any pace. */
const at = (s: Scene, id: string, f: number) => s.ease(id, 0.6, f * (s.end(id) - s.at(id)));

/** The call's text, with the x center of each run returned so labels can sit under its numbers. */
function call(s: Scene, runs: [string, Ink][], x: number, y: number, size: number): number[] {
  const o = { size, font: 'mono' as const, weight: 600 };
  const ws = runs.map(([t]) => s.measure(t, o));
  let cur = x - ws.reduce((a, b) => a + b, 0) / 2;
  return runs.map(([t, k], i) => {
    s.text(t, cur, y, { ...o, align: 'left', color: s.c(k) });
    cur += ws[i]!;
    return cur - ws[i]! / 2;
  });
}

const layer: SceneDef = {
  draw(s) {
    const f = frame(s);
    const out = s.ease('out', 0.7);
    const xs = call(s, [['nn.Conv2d(', '--ink-2'], ['3', 'blue'], [', ', '--ink-2'], ['8', 'gold'], [', kernel_size=', '--ink-2'], ['5', 'slate'], [')', '--ink-2']], s.w / 2, s.h * 0.1, s.tall ? 4 : 4.4);
    const tag = (t: string, x: number, k: Ink, a: number) => s.alpha(a * (1 - out), () => s.text(t, x, s.h * 0.18, { size: 3.2, font: 'mono', color: s.c(k) }));
    tag('in', xs[1]!, 'blue', at(s, 'args', 0.48));
    tag('out', xs[3]!, 'gold', at(s, 'args', 0.6));
    tag('size', xs[5]!, 'slate', at(s, 'args', 0.72));

    s.alpha(s.ease('filters', 0.6) * (1 - out), () => {
      const gap = (s.tall ? 12 : 13) * s.u;
      const y = s.h * 0.37;
      for (let k = 0; k < 8; k++) miniFilter(s, s.w / 2 + (k - 3.5) * gap, y, 3, 6.5, (l) => RGB[l]!, k === 0 ? at(s, 'filters', 0.4) : 0, 1.1);
      label(s, 'K = 8 filters', s.w / 2, y - 9 * s.u, 'gold');
      s.alpha(at(s, 'filters', 0.4), () => label(s, 'each 3 × 5 × 5: 75 weights', s.w / 2, y + 9 * s.u, 'blue'));
    });

    s.alpha(s.ease('weight', 0.6) * (1 - out), () => {
      const gap = (s.tall ? 19 : 21) * s.u;
      const cx = [0, 1, 2, 3].map((i) => s.w / 2 + (i - 1.5) * gap);
      const y = s.h * 0.7;
      const ink: Ink[] = ['gold', 'blue', 'slate', 'slate'];
      label(s, 'conv.weight.shape', s.w / 2, y - 10 * s.u, '--ink-2');
      ['8', '3', '5', '5'].forEach((t, i) => {
        s.alpha(at(s, 'weight', 0.45 + 0.08 * i), () => {
          s.cell(cx[i]! - 5 * s.u, y - 4.5 * s.u, 10 * s.u, 9 * s.u, t, ink[i]!, { on: 0.6 });
          s.text(['filters', 'depth', 'height', 'width'][i]!, cx[i]!, y + 8.5 * s.u, { size: 3.2, font: 'mono', color: s.c(ink[i]!) });
        });
      });
    });

    s.alpha(out, () => {
      volume(s, f.ix, f.top, f.sz, 3, (l) => RGB[l]!, { step: IN_STEP });
      label(s, '(3, 32, 32)', f.ix + f.sz / 2 + IN_STEP * s.u, f.ly, '--ink-2');
      miniFilter(s, f.mx, s.h * 0.42, 3, 8, (l) => RGB[l]!, 0, 1.4);
      label(s, '× 8', f.mx, s.h * 0.42 + 9 * s.u, 'gold');
    });
    s.alpha(at(s, 'out', 0.3), () => {
      volume(s, f.ox, f.top, f.sz, 8, () => 'gold', { step: 1.1 });
      label(s, '(8, 28, 28)', f.ox + f.sz / 2 + 4 * s.u, f.ly, 'gold');
    });
    s.alpha(at(s, 'out', 0.5), () => s.text('down and across: 32 − 5 + 1 = 28', s.w / 2, s.h * 0.88, { size: 3.4, font: 'mono', color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { depth, many, layer };
