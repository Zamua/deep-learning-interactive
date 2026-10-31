import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, lerp } from '../../../lecture/scene';
import { cite } from '../../draw';
import { volume } from '../draw';

const RGB: Ink[] = ['red', 'green', 'blue'];
const IN_STEP = 3;

/** A 12 by 12 photo: a red apple on green leaves, as red, green and blue amounts in 0..1. */
const N = 12;
const APPLE: number[][][] = (() => {
  const inside = (i: number, j: number) => Math.hypot(i - 5.5, j - 6.5) < 4.2;
  return [0, 1, 2].map((ch) => Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => (inside(i, j) ? [0.95, 0.08, 0.1] : [0.08, 0.75, 0.12])[ch]!)));
})();
/** Rows and columns of the window that straddles the apple's left edge. */
const EDGE = { r: 4, c: 1 };

/** Shared geometry: sheet size, the input's front sheet, the output's front sheet. */
function frame(s: Scene) {
  const sz = (s.tall ? 21 : 26) * s.u;
  const top = s.h * 0.42 - sz / 2;
  return { sz, top, ix: s.w * 0.07, ox: s.w * 0.62, mx: s.w * 0.47, ly: s.h * 0.42 + sz / 2 + 6 * s.u };
}
type F = ReturnType<typeof frame>;

const label = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.4) => s.text(t, x, y, { size, font: 'mono', weight: 600, color: s.c(k), halo: true });

/** Eases in a fraction `f` of the way through beat `id`, so it follows the voice at any pace. */
const at = (s: Scene, id: string, f: number) => s.ease(id, 0.6, f * (s.end(id) - s.at(id)));

/** One channel of the photo as a square of `size` px at (x, y), each pixel tinted by its amount. */
function sheet(s: Scene, x: number, y: number, size: number, ch: number) {
  const p = size / N;
  const g = s.ctx;
  s.rrect(x, y, size, size, 0.8, { fill: s.c('--card') });
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      g.fillStyle = s.tint(RGB[ch]!, 0.06 + 0.86 * APPLE[ch]![i]![j]!);
      g.fillRect(x + j * p, y + i * p, p + 0.4, p + 0.4);
    }
  }
  s.rrect(x, y, size, size, 0.8, { stroke: s.tint(RGB[ch]!, 0.8), lw: 0.3 });
}

/** The photo itself, each pixel its own mix of the three amounts. */
function photo(s: Scene, x: number, y: number, size: number) {
  const p = size / N;
  const g = s.ctx;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const [r, gr, b] = [0, 1, 2].map((ch) => Math.round(255 * APPLE[ch]![i]![j]!));
      g.fillStyle = `rgb(${r}, ${gr}, ${b})`;
      g.fillRect(x + j * p, y + i * p, p + 0.4, p + 0.4);
    }
  }
  s.rrect(x, y, size, size, 0.8, { stroke: s.c('--ink-3'), lw: 0.3 });
}

/** A 3 by 3 window on a sheet at (x, y) of `size` px, at pixel row r, column c. */
function win3(s: Scene, x: number, y: number, size: number, r: number, c: number, lw = 0.5) {
  const p = size / N;
  s.rrect(x + c * p, y + r * p, 3 * p, 3 * p, 0.4, { stroke: s.c('--ink'), lw });
}

/** A small filter: `n` sheets of a few stage units, centered on (cx, cy). */
function miniFilter(s: Scene, cx: number, cy: number, n: number, size: number, ink: (l: number) => Ink, on = 0, st = 1.4) {
  const sz = size * s.u;
  volume(s, cx - sz / 2 - ((n - 1) * st * s.u) / 2, cy - sz / 2 + ((n - 1) * st * s.u) / 2, sz, n, ink, { step: st, on: () => on });
}

/** Where channel `l` sits: side by side (k = 0) or stacked as the input volume (k = 1). */
function place(s: Scene, f: F, l: number, k: number) {
  const side = (s.tall ? 24 : 26) * s.u;
  const gap = side + (s.tall ? 5 : 9) * s.u;
  const ax = s.w / 2 + (l - 1) * gap - side / 2;
  const ay = s.h * 0.42 - side / 2;
  const bx = f.ix + l * IN_STEP * s.u;
  const by = f.top - l * IN_STEP * s.u;
  return { x: lerp(ax, bx, k), y: lerp(ay, by, k), size: lerp(side, f.sz, k) };
}

const color: SceneDef = {
  draw(s) {
    const f = frame(s);
    const u = s.u;
    const split = s.ease('color', 1.2, 0.5 * (s.end('color') - s.at('color')));
    const stack = s.ease('deep', 1);
    // The photo, which splits into its three channels.
    s.alpha(1 - split, () => {
      const side = (s.tall ? 30 : 34) * u;
      photo(s, s.w / 2 - side / 2, s.h * 0.42 - side / 2, side);
    });
    s.alpha(split, () => {
      for (let l = 2; l >= 0; l--) {
        const from = { x: s.w / 2 - 12 * u, y: s.h * 0.42 - 12 * u, size: 24 * u };
        const to = place(s, f, l, stack);
        const k = split;
        const p = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), size: lerp(from.size, to.size, k) };
        sheet(s, p.x, p.y, p.size, l);
        s.alpha(1 - stack, () => label(s, ['red', 'green', 'blue'][l]!, p.x + p.size / 2, p.y + p.size + 4.5 * u, RGB[l]!, 3.3));
      }
    });
    s.alpha(s.win('color', 'channel') * at(s, 'color', 0.6), () => s.text('3 numbers per pixel: 3 grids', s.w / 2, s.h * 0.86, { size: 3.6, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.win('channel', 'edge'), () => s.text('each grid: one channel', s.w / 2, s.h * 0.86, { size: 3.6, font: 'mono', color: s.c('--ink-2') }));

    // The edge window on the red and green channels, then on the red one alone.
    const edgeA = s.win('edge', 'deep') * at(s, 'edge', 0.2);
    s.alpha(edgeA, () => {
      for (const l of [0, 1]) {
        const p = place(s, f, l, 0);
        s.alpha(l === 1 ? 1 - s.ease('flat', 0.5) : 1, () => win3(s, p.x, p.y, p.size, EDGE.r, EDGE.c));
      }
    });
    s.alpha(s.win('edge', 'flat') * at(s, 'edge', 0.35), () => s.text('red: apple bright · green: leaves bright', s.w / 2, s.h * 0.86, { size: 3.3, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.win('flat', 'deep'), () => {
      const p = place(s, f, 0, 0);
      label(s, 'flat filter', p.x + p.size / 2, p.y - 4 * u, '--ink', 3.2);
      s.alpha(at(s, 'flat', 0.45), () => s.text('red alone: green leaves = black leaves', s.w / 2, s.h * 0.86, { size: 3.3, font: 'mono', color: s.c('red'), halo: true }));
    });

    // The filter block reaches through all three channels at one position.
    const pos = { u: 0.25, v: 0.3 };
    const one = s.ease('one', 0.6);
    const sweep = clamp01((s.since('map') - 0.6) / 5);
    const rows = 4;
    const r = Math.min(rows - 1, Math.floor(sweep * rows));
    const cu = sweep >= 1 ? 1 : (sweep * rows) % 1;
    const p0 = s.since('map') >= 0 ? { u: cu, v: r / (rows - 1) } : pos;
    const ws = f.sz * 0.28;
    s.alpha(s.ease('deep', 0.6, 0.8), () => {
      for (let l = 2; l >= 0; l--) {
        const x = f.ix + l * IN_STEP * u + p0.u * (f.sz - ws);
        const y = f.top - l * IN_STEP * u + p0.v * (f.sz - ws);
        s.rrect(x, y, ws, ws, 0.6, { stroke: s.c('--ink'), lw: l === 0 ? 0.5 : 0.3 });
      }
    });
    const fy = s.h * 0.42;
    s.alpha(s.ease('deep', 0.6, 1.2), () => {
      miniFilter(s, f.mx, fy, 3, 8, (l) => RGB[l]!, one);
      label(s, '3 × 3 × 3', f.mx, f.ly, 'blue');
      label(s, '27 weights', f.mx, f.ly + 5 * u, '--ink-3', 3.1);
    });

    s.alpha(s.ease('one', 0.6, 1.5), () => {
      s.rrect(f.ox, f.top, f.sz, f.sz, 0.8, { stroke: s.tint('gold', 0.7), lw: 0.3, fill: s.tint('gold', 0.05) });
      // Filled so far: whole rows above the window's row, and the current row up to it.
      const rh = f.sz / rows;
      const done = s.since('map') >= 0 ? sweep : 0;
      const full = Math.floor(done * rows);
      if (full > 0) s.rrect(f.ox, f.top, f.sz, rh * full, 0.4, { fill: s.tint('gold', 0.3) });
      if (full < rows && done > 0) s.rrect(f.ox, f.top + rh * full, f.sz * ((done * rows) % 1), rh, 0.4, { fill: s.tint('gold', 0.3) });
      const dx = f.ox + (0.14 + 0.72 * p0.u) * f.sz;
      const dy = f.top + (0.14 + 0.72 * p0.v) * f.sz;
      s.circle(dx, dy, 1.4 * u, { fill: s.c('gold') });
      const wx = f.ix + p0.u * (f.sz - ws) + ws;
      const wy = f.top + p0.v * (f.sz - ws) + ws / 2;
      s.alpha(1 - s.ease('map', 0.5, 0.2), () => {
        s.arrow(wx + 1 * u, wy, f.mx - 6 * u, fy, s.tint('--ink-3', 0.9), 0.35, 2);
        s.arrow(f.mx + 6 * u, fy, dx - 2 * u, dy, s.tint('gold', 0.9), 0.35, 2);
      });
    });
    s.alpha(s.win('deep', 'one') * at(s, 'deep', 0.5), () => s.text('a filter reaches through every channel', s.w / 2, s.h * 0.88, { size: 3.4, font: 'mono', color: s.c('blue') }));
    s.alpha(s.ease('one', 0.6, 2.4) * (1 - s.ease('map', 0.5)), () => s.text('27 products add up to 1 number', s.w / 2, s.h * 0.88, { size: 3.6, font: 'mono', color: s.c('gold') }));
    s.alpha(s.ease('map', 0.6, 4), () => s.text('one output channel', s.w / 2, s.h * 0.88, { size: 3.6, font: 'mono', color: s.c('gold') }));
  },
};

const K = 8;

/** The input as a stacked volume, with the photo's channels on its sheets. */
function inputVolume(s: Scene, f: F) {
  for (let l = 2; l >= 0; l--) {
    const p = place(s, f, l, 1);
    sheet(s, p.x, p.y, p.size, l);
  }
}

const many: SceneDef = {
  draw(s) {
    const f = frame(s);
    const u = s.u;
    inputVolume(s, f);
    s.alpha(s.ease('shape', 0.6, 0.6), () => {
      label(s, '(3, 32, 32)', f.ix + f.sz / 2 + IN_STEP * u, f.ly, '--ink-2');
      s.alpha(1 - s.ease('k', 0.5), () => s.text('channels, height, width', f.ix, f.ly + 5 * u, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-3'), halo: true }));
    });
    // One filter and its 30 by 30 map, then K of each.
    const pitch = (s.tall ? 7 : 7.4) * u;
    const fy = (k: number) => s.h * 0.42 + (k - (K - 1) / 2) * pitch;
    const kA = s.ease('k', 0.6);
    s.alpha(1 - kA, () => miniFilter(s, f.mx, s.h * 0.42, 3, 8, (l) => RGB[l]!, 0));
    const rise = (l: number) => s.ease('stack', 0.4, 0.4 + l * 0.45);
    s.alpha(kA, () => {
      for (let k = 0; k < K; k++) miniFilter(s, f.mx, fy(k), 3, 4.2, (l) => RGB[l]!, rise(k) * (1 - rise(k + 1)), 0.7);
      label(s, 'K = 8', f.mx, fy(0) - 6 * u, 'slate');
    });
    // Sheet 0 is the map from one filter; the rest arrive one per filter.
    volume(s, f.ox, f.top, f.sz, K, () => 'gold', { step: 1.1, a: (l) => (l === 0 ? 1 : rise(l)), on: (l) => rise(l) * (1 - rise(l + 1)) });
    s.alpha(s.ease('fit', 0.6, 1.2) * (1 - s.ease('stack', 0.5, 3.6)), () => label(s, '(30, 30)', f.ox + f.sz / 2, f.ly, 'gold'));
    s.alpha(s.ease('stack', 0.6, 4), () => label(s, '(8, 30, 30)', f.ox + f.sz / 2 + 4 * u, f.ly, 'gold'));
    const cy = s.h * 0.88;
    const cap = (t: string, k: Ink, a: number, size = 3.4) => s.alpha(a, () => s.text(t, s.w / 2, cy, { size, font: 'mono', color: s.c(k), halo: true }));
    cap('across: 32 − 3 + 1 = 30', '--ink-2', s.win('fit', 'k') * at(s, 'fit', 0.2), 3.6);
    cap('one filter, one pattern', '--ink-2', s.win('k', 'stack') * at(s, 'k', 0), 3.6);
    s.alpha(s.win('depth', 'alexnet'), () => {
      s.text('filter depth = input channels', s.w / 2, s.h * 0.84, { size: 3.4, font: 'mono', weight: 600, color: s.c('blue'), halo: true });
      s.text('output depth = K, the filters', s.w / 2, s.h * 0.91, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold'), halo: true });
    });
    s.alpha(s.win('alexnet', 'next'), () => {
      s.text('96 filters, each 11 × 11 × 3', s.w / 2, s.h * 0.84, { size: 3.4, font: 'mono', weight: 600, color: s.c('slate'), halo: true });
      s.alpha(at(s, 'alexnet', 0.6), () => s.text('3 channels in, 96 out', s.w / 2, s.h * 0.91, { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true }));
    });
    cite(s, 'AlexNet · Krizhevsky et al., 2012', s.win('alexnet', 'next'));
    s.alpha(s.ease('next', 0.6, 0.4), () => {
      const cx = s.w / 2 - 12 * u;
      miniFilter(s, cx, s.h * 0.86, K, 6, () => 'gold', 1, 0.6);
      s.text('next filter: 8 × 3 × 3', cx + 8 * u, s.h * 0.86, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
    });
  },
};

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
    tag('in', xs[1]!, 'blue', at(s, 'args', 0.42));
    tag('out', xs[3]!, 'gold', at(s, 'args', 0.52));
    tag('size', xs[5]!, 'slate', at(s, 'args', 0.66));

    // The eight filters, each three deep.
    s.alpha(at(s, 'args', 0.55) * (1 - out), () => {
      const gap = (s.tall ? 12 : 13) * s.u;
      const y = s.h * 0.37;
      for (let k = 0; k < 8; k++) miniFilter(s, s.w / 2 + (k - 3.5) * gap, y, 3, 6.5, (l) => RGB[l]!, 0, 1.1);
      label(s, 'K = 8 filters', s.w / 2, y - 9 * s.u, 'gold');
      s.alpha(s.ease('weight', 0.6), () => label(s, 'each 3 × 5 × 5', s.w / 2, y + 9 * s.u, 'blue'));
    });

    // The weight: the filters stacked along a new first axis.
    s.alpha(at(s, 'weight', 0.35) * (1 - out), () => {
      const gap = (s.tall ? 19 : 21) * s.u;
      const cx = [0, 1, 2, 3].map((i) => s.w / 2 + (i - 1.5) * gap);
      const y = s.h * 0.7;
      const ink: Ink[] = ['gold', 'blue', 'slate', 'slate'];
      label(s, 'conv.weight.shape', s.w / 2, y - 10 * s.u, '--ink-2');
      ['8', '3', '5', '5'].forEach((t, i) => {
        s.alpha(at(s, 'weight', 0.45 + 0.06 * i), () => {
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

export const scenes: Record<string, SceneDef> = { color, many, layer };
