import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cells, columns } from '../../draw';
import { box } from '../../sequences/draw';
import { num } from '../draw';

/** A paper's people and year, in italics at (x, y). */
function cite(s: Scene, text: string, a: number, x: number, y: number) {
  s.alpha(a, () => s.text(text, x, y, { size: 3.1, italic: true, color: s.c('--ink-2'), halo: true }));
}

// ---- the stream: blocks stacked up one token's path, then seen as one vector that each block reads and adds to

/** The blocks drawn, bottom to top; blocks 3 to 8 hide behind the dots. */
const BLOCKS: { label: string; k: Ink; y: number; lane: number }[] = [
  { label: 'block 0', k: 'blue', y: 0.74, lane: -1.8 },
  { label: 'block 1', k: 'gold', y: 0.6, lane: -0.6 },
  { label: 'block 2', k: 'blue', y: 0.46, lane: 0.6 },
  { label: 'block 9', k: 'purple', y: 0.22, lane: 1.8 },
];
const DOTS = 0.34;
const BW = 6;
const BOX = { w: 24, h: 8 };

const stream: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const sx = s.tall ? s.w * 0.28 : s.w * 0.38;
    const bx = s.tall ? s.w * 0.68 : s.w * 0.6;
    const top = s.h * 0.12;
    const bot = s.h * 0.82;
    const m = s.ease('adds', 1.2);
    const x = lerp(cx, bx, m);
    const wired = s.ease('adds', 0.8, 1);
    const named = s.ease('x0', 0.6);
    const keep = s.ease('keep', 0.6);
    const pad = s.win('pad', 'history');
    const capX = x;
    const capY = s.h * 0.94;
    const cap = { size: s.tall ? 3.2 : 3.6, font: 'mono', color: s.c('--ink-2'), halo: true } as const;

    // The chain: each block hands its output to the next.
    s.alpha(1 - m, () => {
      s.arrow(cx, bot, cx, BLOCKS[0]!.y * s.h + (BOX.h / 2) * u, s.c('--ink-3'), 0.4, 1.8);
      const ends = [...BLOCKS.slice(0, 3).map((b) => b.y * s.h), DOTS * s.h, BLOCKS[3]!.y * s.h];
      for (let i = 0; i < ends.length - 1; i++) {
        const from = ends[i]! - (i < 3 ? BOX.h / 2 : 2.4) * u;
        const to = ends[i + 1]! + (i + 1 === 3 ? 2.4 : BOX.h / 2) * u;
        s.arrow(cx, from, cx, to, s.c('--ink-3'), 0.4, 1.8);
      }
      s.arrow(cx, BLOCKS[3]!.y * s.h - (BOX.h / 2) * u, cx, top, s.c('--ink-3'), 0.4, 1.8);
      // Block 1's result, handed up block by block.
      const p = clamp01((s.prog('stack') - 0.45) / 0.5);
      if (p > 0) s.circle(cx, lerp(BLOCKS[1]!.y, BLOCKS[3]!.y, p) * s.h, 1.4 * u, { fill: s.c('gold'), stroke: s.c('--card'), lw: 0.35 });
    });

    // The stream itself, x₀ at the bottom.
    s.alpha(m, () => {
      s.rrect(sx - (BW / 2) * u, top, BW * u, bot - top, 1.2, { fill: s.tint('orange', 0.16), stroke: s.tint('orange', 0.7), lw: 0.35 });
      s.ctx.fillStyle = s.c('orange');
      s.ctx.beginPath();
      s.ctx.moveTo(sx, top - 3.4 * u);
      s.ctx.lineTo(sx - 3.6 * u, top + 0.4 * u);
      s.ctx.lineTo(sx + 3.6 * u, top + 0.4 * u);
      s.ctx.closePath();
      s.ctx.fill();
      // Chevrons drifting up while the stream is being named.
      s.alpha(0.5 * s.win('stream', 'x0'), () => {
        const gap = 7 * u;
        const off = (s.t * 4 * u) % gap;
        for (let y = bot - 2 * u - off; y > top + 3 * u; y -= gap) {
          s.line(sx - 1.4 * u, y + 1 * u, sx, y, s.c('orange'), 0.35);
          s.line(sx, y, sx + 1.4 * u, y + 1 * u, s.c('orange'), 0.35);
        }
      });
    });
    s.alpha(s.ease('stream', 0.6, 1.5), () => {
      const hi = s.win('name', 'x0');
      s.text('residual stream', sx, top - 6 * u, { size: 3.2 + 0.3 * hi, font: 'mono', weight: 600 + 100 * hi, color: s.c('orange'), halo: true });
    });
    s.alpha(named, () => s.text('x₀ = embedding', sx, bot + 4 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange'), halo: true }));

    // Each block's write, carried up the stream from where it was added.
    s.alpha(named, () => {
      BLOCKS.forEach((b, i) => {
        const dim = i === 1 ? 1 : 1 - 0.6 * keep;
        s.alpha(dim, () => s.line(sx + b.lane * u, b.y * s.h - 2 * u, sx + b.lane * u, top + 1.5 * u, s.c(b.k), i === 1 ? 0.4 + 0.3 * keep : 0.4));
      });
      // Block 1's write rising to block 9.
      const p = clamp01((s.prog('keep') - 0.2) / 0.6) * (1 - s.ease('pad', 0.4));
      if (p > 0 && p < 1) s.circle(sx + BLOCKS[1]!.lane * u, lerp(BLOCKS[1]!.y * s.h - 2 * u, BLOCKS[3]!.y * s.h + 2 * u, p), 1.2 * u, { fill: s.c('gold'), stroke: s.c('--card'), lw: 0.3 });
    });

    // The blocks, with their reads and writes once they sit beside the stream.
    BLOCKS.forEach((b, i) => {
      const y = b.y * s.h;
      const left = x - (BOX.w / 2) * u;
      s.alpha(wired, () => {
        const rk = i === 3 ? (keep > 0 ? 'gold' : '--ink-3') : '--ink-3';
        const lw = 0.3 + 0.2 * pad + (i === 3 ? 0.2 * keep : 0);
        s.arrow(sx + (BW / 2) * u, y + 2 * u, left - 0.5 * u, y + 2 * u, s.c(rk as Ink), lw, 1.5);
        s.arrow(left, y - 2 * u, sx + 2.4 * u, y - 2 * u, s.c(b.k), lw + 0.1, 1.6);
        s.circle(sx, y - 2 * u, 2 * u, { fill: s.c('--card'), stroke: s.c('orange'), lw: 0.4 });
        s.text('+', sx, y - 1.85 * u, { size: 3.2, font: 'mono', weight: 700, color: s.c('orange') });
      });
      const on = i === 1 ? Math.max(1 - m, keep) : i === 3 ? keep : pad;
      box(s, x, y, b.label, b.k, { ...BOX, size: 3.2, on });
    });
    s.text('⋮', x, DOTS * s.h, { size: 4.4, font: 'mono', weight: 700, color: s.c('--ink-3') });
    s.alpha(named * (1 - keep), () => {
      const y = BLOCKS[0]!.y * s.h;
      const mx = (sx + bx - (BOX.w / 2) * u) / 2;
      s.text('read', mx, y + 4.6 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3'), halo: true });
      s.text('write', mx, y - 4.6 * u, { size: 2.8, font: 'mono', color: s.c('blue'), halo: true });
    });

    s.alpha(s.win('stack', 'adds'), () => s.text('each block passes it on', capX, capY, { ...cap, color: s.c('gold') }));
    s.alpha(s.win('adds', 'stream') * after(s, 'adds', 0.3), () => s.text('added, never replaced', capX, capY, cap));
    s.alpha(s.win('stream', 'x0'), () => s.text('flows up past every block', capX, capY, { ...cap, color: s.c('orange') }));
    s.alpha(s.win('x0', 'keep'), () => s.text('a block\'s output: its write', capX, capY, cap));
    s.alpha(s.win('keep', 'pad'), () => s.text('block 1\'s write stays', capX, capY, { ...cap, color: s.c('gold') }));
    s.alpha(pad, () => s.text('all read it, all add to it', capX, capY, cap));
    cite(s, 'Elhage, Olah et al. · 2021', s.ease('history', 0.6), capX, capY);
  },
};

// ---- a running sum: one block's two writes, added to the stream as it rises

const X0 = [1, 0, 2];
const ATT = [0, 1, -1];
const MLP = [2, 0, 1];
const MID = X0.map((v, i) => v + ATT[i]!);
const TOP = MID.map((v, i) => v + MLP[i]!);

const sum: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const xs = [-19, -8, 3].map((d) => cx + d * u);
    const ax = cx - (s.tall ? 35 : 40) * u;
    const lx = cx + 10 * u;
    const sumOn = s.win('sum', 'diff');
    const diff = s.ease('diff', 0.6);
    const rows: { y: number; v: number[]; k: Ink; name: string; op: string; a: number; on: number }[] = [
      { y: 0.76, v: X0, k: 'orange', name: 'x₀', op: '', a: s.ease('x0', 0.6, 0.6), on: sumOn },
      { y: 0.62, v: ATT, k: 'blue', name: 'attention writes', op: '+', a: after(s, 'a', 0.3), on: sumOn },
      { y: 0.48, v: MID, k: 'orange', name: 'stream', op: '=', a: after(s, 'a', 0.65), on: diff },
      { y: 0.34, v: MLP, k: 'blue', name: 'MLP writes', op: '+', a: after(s, 'm', 0.3), on: sumOn + after(s, 'diff', 0.7) },
      { y: 0.2, v: TOP, k: 'orange', name: 'stream', op: '=', a: after(s, 'm', 0.65), on: diff },
    ];
    // The stream, rising past the block.
    s.arrow(ax, s.h * 0.86, ax, s.h * 0.1, s.c('orange'), 0.6, 2.4);
    s.text('x', ax - 3.5 * u, s.h * 0.84, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('orange') });
    rows.forEach((r) => {
      s.alpha(r.a, () => {
        const y = r.y * s.h;
        if (r.op) s.text(r.op, cx - 28 * u, y, { size: 4, font: 'mono', weight: 650, color: s.c('--ink-3') });
        cells(s, xs, y, r.v.map((v) => num(v)), r.k, { w: 9.5, h: 7.5, size: 3.4, on: r.v.map(() => Math.min(1, r.on)) });
        s.text(r.name, lx, y, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c(r.k) });
      });
    });
    const cy = s.h * 0.93;
    const cap = { size: s.tall ? 3.3 : 3.6, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
    s.alpha(s.win('zoom', 'x0'), () => s.text('one block: attention, then MLP', cx, cy, cap));
    s.alpha(s.win('x0', 'sum') * (1 - s.ease('a', 0.4)), () => s.text('d = 3: three numbers per token', cx, cy, cap));
    s.alpha(sumOn, () => s.text('x₀ + every write so far', cx, cy, { ...cap, color: s.c('orange') }));
    s.alpha(after(s, 'diff', 0.35), () => s.text('[3, 1, 2] − [1, 1, 1] = [2, 0, 1]', cx, cy, { ...cap, color: s.c('blue') }));
  },
};

// ---- one width: writes are added, so every write is d wide and the stream never grows

/** A bar standing for one token's vector, `w` stage units wide. */
function slab(s: Scene, x: number, y: number, w: number, label: string, k: Ink, on = 0): void {
  s.rrect(x - (w / 2) * s.u, y - 3.6 * s.u, w * s.u, 7.2 * s.u, 1.2, { fill: s.tint(k, 0.15 + 0.2 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.35 });
  s.text(label, x, y + 0.2 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
}

const width: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const D = 16;
    const small = { size: 3, color: s.c('--ink-3') } as const;
    // The add: the stream and a write, both d wide.
    s.alpha(s.ease('same', 0.6), () => {
      const y = s.h * 0.12;
      const g = D + 8;
      slab(s, cx - g * u, y, D, 'd', 'orange');
      s.text('+', cx - (g / 2) * u, y, { size: 4, font: 'mono', weight: 650, color: s.c('--ink-3') });
      s.alpha(s.ease('same', 0.6, 1.5), () => slab(s, cx, y, D, 'd', 'blue', 1));
      s.text('=', cx + (g / 2) * u, y, { size: 4, font: 'mono', weight: 650, color: s.c('--ink-3') });
      slab(s, cx + g * u, y, D, 'd', 'orange');
      s.alpha(s.ease('same', 0.6, 1.5), () => s.text('stream + write: same width', cx, y + 7.5 * u, small));
    });
    // Inside the MLP: wider, then back to d.
    s.alpha(s.ease('mlp', 0.6), () => {
      const ys = [0.34, 0.47, 0.6].map((f) => s.h * f);
      s.text('inside one MLP', cx, ys[0]! - 6.5 * u, small);
      slab(s, cx, ys[0]!, D, 'd', 'orange');
      s.arrow(cx, ys[0]! + 4 * u, cx, ys[1]! - 4 * u, s.c('--ink-3'), 0.3, 1.5);
      s.alpha(s.ease('mlp', 0.6, 1.2), () => slab(s, cx, ys[1]!, 4 * D, '4d', 'slate'));
      s.arrow(cx, ys[1]! + 4 * u, cx, ys[2]! - 4 * u, s.c('--ink-3'), 0.3, 1.5);
      s.alpha(after(s, 'mlp', 0.55), () => {
        slab(s, cx, ys[2]!, D, 'd', 'blue', 1);
        s.text('back to d', cx + (D / 2 + 3) * u, ys[2]!, { size: 3, font: 'mono', align: 'left', color: s.c('blue') });
      });
    });
    // The stream after every block: still one d-wide vector per token.
    s.alpha(s.ease('never', 0.6), () => {
      const labels = ['x₀', 'block 0', 'block 1', 'top'];
      const xs = columns(s, 4, s.tall ? 22 : 26);
      const y = s.h * 0.82;
      s.text('ten tokens × 768, after every block', cx, y - 7.5 * u, { ...small, color: s.c('--ink-2') });
      xs.forEach((x, i) => {
        s.alpha(s.ease('never', 0.5, 0.8 + i * 0.5), () => {
          slab(s, x, y, D, '768', 'orange', 1);
          s.text(labels[i]!, x, y + 6.8 * u, { size: 3, font: 'mono', color: s.c('--ink-2') });
          if (i) s.arrow(xs[i - 1]! + (D / 2 + 0.8) * u, y, x - (D / 2 + 0.8) * u, y, s.c('--ink-3'), 0.3, 1.4);
        });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { stream, sum, width };
