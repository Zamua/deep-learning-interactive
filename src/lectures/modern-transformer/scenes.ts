import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import * as M from '../../lib/modern-transformer-math';
import { type K, type Rect, area, box, current, fitSize, pill, sup } from './kit';

// ---------------------------------------------------------------- the block diagram

interface BPart {
  id: string;
  kind: 'branch' | 'stream' | 'plus';
  row: number;
  branch?: number;
  label: string;
  k: K;
}
interface Block {
  rows: number;
  parts: BPart[];
}

const NEW_BLOCK: Block = {
  rows: 11,
  parts: [
    { id: 'norm1', kind: 'branch', branch: 0, row: 1, label: 'RMSNorm', k: 'slate' },
    { id: 'gqa', kind: 'branch', branch: 0, row: 2, label: 'Wq Wk Wv (GQA)', k: 'blue' },
    { id: 'qk', kind: 'branch', branch: 0, row: 3, label: 'QK-norm', k: 'teal' },
    { id: 'rope', kind: 'branch', branch: 0, row: 4, label: 'RoPE', k: 'red' },
    { id: 'flash', kind: 'branch', branch: 0, row: 5, label: 'FlashAttention', k: 'purple' },
    { id: 'plus1', kind: 'plus', branch: 0, row: 6, label: '+', k: 'orange' },
    { id: 'norm2', kind: 'branch', branch: 1, row: 7, label: 'RMSNorm', k: 'slate' },
    { id: 'mlp', kind: 'branch', branch: 1, row: 8, label: 'SwiGLU MLP', k: 'gold' },
    { id: 'plus2', kind: 'plus', branch: 1, row: 9, label: '+', k: 'orange' },
  ],
};

const OLD_BLOCK: Block = {
  rows: 8,
  parts: [
    { id: 'attn', kind: 'branch', branch: 0, row: 1, label: 'attention', k: 'purple' },
    { id: 'plus1', kind: 'plus', branch: 0, row: 2, label: '+', k: 'orange' },
    { id: 'onorm1', kind: 'stream', row: 3, label: 'LayerNorm', k: 'slate' },
    { id: 'mlp', kind: 'branch', branch: 1, row: 4, label: 'ReLU MLP', k: 'gold' },
    { id: 'plus2', kind: 'plus', branch: 1, row: 5, label: '+', k: 'orange' },
    { id: 'onorm2', kind: 'stream', row: 6, label: 'LayerNorm', k: 'slate' },
  ],
};

/** A block drawn bottom to top inside `r`: the orange residual stream on the left, branches on the right. */
function drawBlock(s: Scene, r: Rect, b: Block, lit: (id: string) => number, title?: string): void {
  const [x0, y0, w, h] = r;
  const u = s.u;
  const top = title ? u * 8 : u * 2;
  const pad = u * 2.6;
  const rh = (h - top - pad * 2) / (b.rows - 1);
  const Y = (row: number) => y0 + h - pad - row * rh;
  const sx = x0 + w * 0.17;
  const bx = x0 + w * 0.36;
  const bw = w * 0.63;
  const bh = Math.min(rh * 0.78, u * 9);
  const fs = Math.max(3.1, Math.min(4.2, (bh / u) * 0.52));
  if (title) s.text(title, x0 + w / 2, y0 + u * 3.6, { size: 5, font: 'display', weight: 600 });
  s.line(sx, Y(0) + u, sx, Y(b.rows - 1) + u * 3, s.c('orange'), 0.9);
  s.arrow(sx, Y(b.rows - 1) + u * 3.5, sx, Y(b.rows - 1) - u * 0.5, s.c('orange'), 0.9, 2.6);
  s.text('x in', sx + u * 2, Y(0) + u * 0.4, { size: 3.2, font: 'ui', align: 'left', color: s.c('--ink-2') });
  s.text('x out', sx + u * 2.5, Y(b.rows - 1) + u * 0.6, { size: 3.2, font: 'ui', align: 'left', color: s.c('--ink-2') });
  const ink = s.tint('--ink-2', 0.7);
  for (const br of [0, 1]) {
    const ps = b.parts.filter((p) => p.branch === br).sort((a, c) => a.row - c.row);
    const boxes = ps.filter((p) => p.kind === 'branch');
    const plus = ps.find((p) => p.kind === 'plus')!;
    const cx = bx + bw / 2;
    const r0 = boxes[0]!.row;
    s.circle(sx, Y(r0), u * 1.1, { fill: s.c('orange') });
    s.arrow(sx, Y(r0), bx - u * 0.3, Y(r0), ink, 0.35, 1.8);
    for (let i = 1; i < boxes.length; i++) s.line(cx, Y(boxes[i - 1]!.row) - bh / 2, cx, Y(boxes[i]!.row) + bh / 2, ink, 0.35);
    const last = boxes[boxes.length - 1]!;
    s.line(cx, Y(last.row) - bh / 2, cx, Y(plus.row), ink, 0.35);
    s.arrow(cx, Y(plus.row), sx + u * 3, Y(plus.row), ink, 0.35, 1.8);
  }
  for (const p of b.parts) {
    const y = Y(p.row);
    const on = lit(p.id);
    if (p.kind === 'plus') {
      s.circle(sx, y, u * 2.5, { fill: s.c('--card') });
      s.circle(sx, y, u * 2.5, { fill: s.tint('orange', 0.08 + 0.3 * on), stroke: s.c('orange'), lw: 0.45 + 0.4 * on });
      s.text('+', sx, y + u * 0.25, { size: 4, font: 'mono', weight: 700 });
    } else {
      const x = p.kind === 'stream' ? sx - w * 0.16 : bx;
      const ww = p.kind === 'stream' ? w * 0.32 : bw;
      box(s, x, y - bh / 2, ww, bh, p.label, p.k, { on, size: Math.min(fs, fitSize(s, p.label, ww - u * 2, fs)) });
    }
  }
}

// ---------------------------------------------------------------- intro

const intro: SceneDef = {
  draw(s) {
    const [x0, y0, w, h] = area(s);
    const u = s.u;
    const mv = s.ease('but', 1.0);
    const cards = s.win('plan', 'go');
    const back = s.ease('go', 0.8);
    const dim = 1 - 0.88 * cards;
    const sets: Record<string, string[]> = { list1: ['norm1', 'norm2', 'rope'], list2: ['mlp', 'gqa'], list3: ['qk', 'flash'] };
    const litNew = (id: string) => {
      const c = current(s, ['list1', 'list2', 'list3', 'why']);
      return c && sets[c]?.includes(id) ? s.ease(c, 0.5) : 0;
    };
    const litOld = (id: string) => (id.startsWith('onorm') ? s.ease('go', 0.5) * (0.7 + 0.3 * Math.sin(s.since('go') * 4)) : 0);
    if (!s.tall) {
      const bw = Math.min(w * 0.48, h * 0.95);
      const cxOld = lerp(x0 + w / 2, x0 + w * 0.25, mv);
      s.alpha(dim, () => drawBlock(s, [cxOld - bw / 2, y0, bw, h], OLD_BLOCK, litOld, '2017'));
      s.alpha(mv * dim, () => drawBlock(s, [x0 + w * 0.75 - bw / 2, y0, bw, h], NEW_BLOCK, litNew, '2024'));
    } else {
      const bw = Math.min(w, h * 1.2);
      const r: Rect = [x0 + (w - bw) / 2, y0, bw, h];
      s.alpha(Math.min(1, 1 - mv + back) * dim, () => drawBlock(s, r, OLD_BLOCK, litOld, '2017'));
      s.alpha(mv * (1 - back) * dim, () => drawBlock(s, r, NEW_BLOCK, litNew, '2024'));
    }
    if (cards > 0) {
      const heads = ['the problem', 'the cost', 'the picture'];
      const subs = ['what broke at scale', 'what it gives up', 'what makes it obvious'];
      const ks: K[] = ['red', 'gold', 'teal'];
      const row = !s.tall;
      const cw = row ? Math.min((w - u * 8) / 3, u * 52) : Math.min(w * 0.86, u * 80);
      const ch = row ? u * 26 : u * 17;
      const gap = u * 4;
      const tw = row ? 3 * cw + 2 * gap : cw;
      const th = row ? ch : 3 * ch + 2 * gap;
      const ox = x0 + (w - tw) / 2;
      const oy = y0 + (h - th) / 2;
      heads.forEach((t, i) => {
        const a = cards * s.ease('plan', 0.5, 0.45 * i);
        const cx = row ? ox + i * (cw + gap) : ox;
        const cy = row ? oy : oy + i * (ch + gap);
        s.alpha(a, () => {
          s.rrect(cx, cy, cw, ch, 2.5, { fill: s.c('--card') });
          s.rrect(cx, cy, cw, ch, 2.5, { fill: s.tint(ks[i]!, 0.1), stroke: s.tint(ks[i]!, 0.7), lw: 0.4 });
          s.text(String(i + 1), cx + u * 5, cy + ch / 2, { size: 6, font: 'display', weight: 700, color: s.c(ks[i]!) });
          s.text(t, cx + u * 10, cy + ch * 0.4, { size: Math.min(5, fitSize(s, t, cw - u * 13, 5, { font: 'display' })), font: 'display', weight: 600, align: 'left' });
          s.text(subs[i]!, cx + u * 10, cy + ch * 0.72, { size: Math.min(3.4, fitSize(s, subs[i]!, cw - u * 13, 3.4, { font: 'serif' })), italic: true, align: 'left', color: s.c('--ink-2') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- pre-norm

const HW = { post: M.highway(24, 'post', 1), pre: M.highway(24, 'pre', 1) };

const prenorm: SceneDef = {
  draw(s) {
    const [x0, y0, w, h] = area(s);
    const u = s.u;
    const dh = h * 0.42;
    const N = 5;
    const lift = (h - dh) * 0.38 * (1 - s.ease('compound', 0.9));
    const ly = y0 + lift + dh * 0.8;
    const xs = x0 + u * 7;
    const xe = x0 + w - u * 7;
    const step = (xe - xs) / (N + 0.6);
    const px = (i: number) => xs + step * (i + 1);
    const dx = step * 0.42;
    const by = y0 + lift + dh * 0.36;
    const bwid = Math.min(step * 0.5, u * 10);
    const bht = Math.min(dh * 0.28, u * 8);
    const ink = s.tint('--ink-2', 0.7);
    const postA = s.ease('post', 0.8);
    const preT = s.ease('pre', 1.4);
    // stream and sub-blocks
    s.line(xs - u * 2, ly, xe + u * 1, ly, s.c('orange'), 0.9);
    s.arrow(xe, ly, xe + u * 3.5, ly, s.c('orange'), 0.9, 2.4);
    s.text('x₀', xs - u * 3.5, ly, { size: 4, italic: true, weight: 650, color: s.c('orange'), align: 'right' });
    s.text('top', xe + u * 1, ly + u * 4.5, { size: 3.2, font: 'ui', color: s.c('--ink-2'), align: 'right' });
    s.alpha(s.win('stream', 'grad'), () => s.text('residual stream', x0 + w / 2, ly + u * 5, { size: 3.4, italic: true, color: s.c('orange') }));
    for (let i = 0; i < N; i++) {
      const cx = px(i);
      const tap = cx - dx;
      s.circle(tap, ly, u * 0.9, { fill: s.c('orange') });
      s.line(tap, ly, tap, by, ink, 0.35);
      s.arrow(tap, by, cx - bwid / 2 - u * 0.3, by, ink, 0.35, 1.5);
      box(s, cx - bwid / 2, by - bht / 2, bwid, bht, 'F', 'blue', { size: 3.6 });
      s.arrow(cx, by + bht / 2, cx, ly - u * 2.3, ink, 0.35, 1.5);
      s.circle(cx, ly, u * 2, { fill: s.c('--card'), stroke: s.c('orange'), lw: 0.45 });
      s.text('+', cx, ly + u * 0.2, { size: 3.4, font: 'mono', weight: 700 });
      if (postA > 0) {
        const nw = Math.min(step * 0.34, u * 6.5);
        const nh = u * 5.4;
        const nx = lerp((cx + u * 2 + cx + step - dx) / 2, tap, preT);
        const ny = lerp(ly, (ly + by) / 2 + u * 1.5, preT);
        s.alpha(postA, () => box(s, nx - nw / 2, ny - nh / 2, nw, nh, 'N', 'slate', { size: 3.4, on: s.win('divide', 'compound') * 0.6 }));
      }
    }
    s.alpha(postA, () => s.text(preT < 0.5 ? 'N on the stream: post-norm' : 'N on the branch: pre-norm', x0 + w / 2, by - bht / 2 - u * 2.5, { size: 3.4, font: 'ui', weight: 600, color: s.c('slate') }));
    // the gradient travelling back
    const beat = current(s, ['grad', 'post', 'divide', 'compound', 'measure', 'pre', 'flat', 'history']);
    if (beat === 'grad' || beat === 'divide' || beat === 'flat') {
      const p = smooth(s.prog(beat));
      const x = lerp(xe, xs, p);
      let f = 1;
      if (beat === 'divide') for (let i = 0; i < N; i++) if (x < (px(i) + u * 2 + px(i) + step - dx) / 2) f /= Math.SQRT2;
      s.alpha(Math.min(1, s.since(beat) * 3), () => {
        s.circle(x, ly, Math.max(u * 0.6, u * 2.2 * f), { fill: s.c('teal'), stroke: s.c('--card'), lw: 0.3 });
        s.text(f < 0.99 ? `gradient ×${fmt(f, 2)}` : 'gradient', x, ly + u * 5, { size: 3.2, font: 'ui', weight: 600, color: s.c('teal'), halo: true });
      });
    }
    // bars: how strongly each write reaches the top
    const barsA = s.ease('compound', 0.7);
    if (barsA > 0) {
      s.alpha(barsA, () => {
        const bx0 = x0 + u * 9;
        const bxw = w - u * 9;
        const top = y0 + dh + u * 9;
        const bot = y0 + h - u * 5;
        const L = 24;
        const LO = -4;
        const Y = (lv: number) => lerp(bot, top, (lv - LO) / -LO);
        for (const e of [0, -2, -4]) {
          s.line(bx0, Y(e), x0 + w, Y(e), s.c('--grid'), 0.25);
          s.text(e === 0 ? '1' : `10${sup(e)}`, x0, Y(e), { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
        }
        const mix = s.ease('pre', 1.6);
        const cw = bxw / (L + 1);
        for (let l = 0; l <= L; l++) {
          const a = s.ease('compound', 0.4, 0.05 * (L - l));
          const lv = lerp(Math.max(LO, Math.log10(HW.post.reach[l]!)), 0, mix);
          s.alpha(a, () => s.rrect(bx0 + l * cw + cw * 0.15, Y(lv), cw * 0.7, bot - Y(lv), 0.3, { fill: s.tint(l === 0 ? 'slate' : 'orange', 0.8) }));
        }
        s.text('embedding', bx0, bot + u * 2.6, { size: 3, font: 'ui', align: 'left', color: s.c('slate') });
        s.text('layer 24', x0 + w, bot + u * 2.6, { size: 3, font: 'ui', align: 'right', color: s.c('--ink-2') });
        s.text(mix < 0.5 ? 'post-norm: how much of each write reaches the top' : 'pre-norm: every write arrives with weight 1', x0 + w, top - u * 4, { size: Math.min(3.4, fitSize(s, 'post-norm: how much of each write reaches the top', w * 0.98, 3.4)), font: 'ui', weight: 600, align: 'right', color: s.c('--ink-2') });
        s.alpha(s.win('compound', 'measure'), () => pill(s, '÷√2 per layer → ÷4096 over 24', bx0 + bxw * 0.34, Y(-0.55), 'red', { size: 3.2 }));
        s.alpha(s.win('measure', 'pre'), () => pill(s, `measured: ÷${Math.round(1 / HW.post.reach[0]!)}`, bx0 + bxw * 0.3, Y(-0.55), 'red', { size: 3.2 }));
        s.alpha(s.ease('cost', 0.6), () => pill(s, `stream RMS: 1 → ${fmt(HW.pre.rms[23]!, 2)} at layer 24`, bx0 + bxw * 0.5, Y(-2), 'gold', { size: 3.2 }));
      });
    }
  },
};

// ---------------------------------------------------------------- RMSNorm

const X0 = [1.2, -0.4, 2.1, 0.3, -1.1, 0.8, 1.6, -0.2];

const rmsnorm: SceneDef = {
  draw(s) {
    const [x0, y0, w, h] = area(s);
    const u = s.u;
    const aUp = lerp(1, 2.2, s.ease('scale', 1.4));
    const a = lerp(aUp, 1, s.ease('shift', 0.8));
    const c = lerp(0, 2.2, s.ease('shift', 1.4, 0.4));
    const xs = X0.map((t) => a * t + c);
    const bands: { label: string; k: K; range: number; vals: number[]; alpha: number; note: string }[] = [
      { label: 'x', k: 'orange', range: 4.8, vals: xs, alpha: 1, note: `x = ${fmt(a, 2)} · x0 + ${fmt(c, 2)}` },
      { label: 'LayerNorm(x)', k: 'slate', range: 2.6, vals: M.layerNorm(xs), alpha: s.ease('ln2', 0.7), note: 'mean, then spread: 2 passes, + bias' },
      { label: 'RMSNorm(x)', k: 'blue', range: 2.6, vals: M.rmsNorm(xs), alpha: s.ease('rms', 0.7), note: 'sum of squares: 1 pass' },
    ];
    const bh = h / 3;
    const cw = w / 8;
    bands.forEach((b, bi) => {
      if (b.alpha <= 0) return;
      s.alpha(b.alpha, () => {
        const top = y0 + bi * bh;
        const lab = u * 5;
        const mid = top + lab + (bh - lab) / 2;
        const half = (bh - lab) / 2 - u * 3;
        s.text(b.label, x0, top + lab * 0.5, { size: bi === 0 ? 4.4 : 3.6, font: bi === 0 ? 'serif' : 'mono', italic: bi === 0, weight: 650, align: 'left', color: s.c(b.k) });
        const showNote = bi === 0 ? s.win('scale', 'why') : s.ease('cheap', 0.6);
        s.alpha(showNote, () => s.text(b.note, x0 + w, top + lab * 0.5, { size: 3.1, font: bi === 0 ? 'mono' : 'ui', align: 'right', color: s.c('--ink-2') }));
        s.line(x0, mid, x0 + w, mid, s.c('--axis'), 0.2);
        b.vals.forEach((t, j) => {
          const v = Math.max(-b.range, Math.min(b.range, t));
          const yy = mid - (v / b.range) * half;
          const bx = x0 + j * cw + cw * 0.2;
          s.rrect(bx, Math.min(mid, yy), cw * 0.6, Math.max(1, Math.abs(yy - mid)), 0.4, { fill: s.tint(b.k, 0.7) });
          s.text(fmt(t, 2), bx + cw * 0.3, yy + (t >= 0 ? -u * 1.8 : u * 1.8), { size: 2.9, font: 'mono', color: s.c('--ink-2') });
        });
        if (bi === 0) {
          const mu = M.mean(xs);
          const yMu = mid - (mu / b.range) * half;
          s.alpha(s.win('ln', 'ln2'), () => {
            s.line(x0, yMu, x0 + w, yMu, s.c('red'), 0.35, [1.2, 1]);
            s.text('mean', x0 + w, yMu - u * 1.6, { size: 3, font: 'ui', weight: 600, align: 'right', color: s.c('red'), halo: true });
          });
        }
      });
    });
  },
};

// ---------------------------------------------------------------- RoPE

const RT = M.ropeTheta(16);
const PAIR = 1;
const PHI_Q = 0.45;
const PHI_K = 1.95;
const LQ = 1;
const LK = 0.82;
const WORDS = ['the', 'cat', 'sat', 'down'];
const PERM = [2, 0, 3, 1];

function dial(s: Scene, cx: number, cy: number, r: number, ang: number, label: string): void {
  s.circle(cx, cy, r, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.35 });
  s.line(cx, cy, cx + Math.cos(ang) * r * 0.85, cy - Math.sin(ang) * r * 0.85, s.c('teal'), 0.6);
  s.circle(cx, cy, s.u * 0.6, { fill: s.c('teal') });
  s.text(label, cx, cy + r + s.u * 2.6, { size: 3, font: 'mono', color: s.c('--ink-2') });
}

const rope: SceneDef = {
  draw(s) {
    const [x0, y0, w, h] = area(s);
    const u = s.u;
    // A: order, and added positions
    const aA = 1 - s.ease('rope', 0.6);
    if (aA > 0) {
      s.alpha(aA, () => {
        const n = WORDS.length;
        const cw = Math.min(w / (n + 0.6), u * 22);
        const ox = x0 + (w - cw * n) / 2;
        const ty = y0 + h * 0.08;
        const oy = y0 + h * 0.5;
        const sh = smooth((s.prog('order') - 0.2) / 0.4) * (1 - s.ease('old', 0.9));
        WORDS.forEach((wd, i) => {
          const slot = lerp(i, PERM[i]!, sh);
          const x = ox + slot * cw;
          box(s, x + u, ty, cw - 2 * u, u * 9, wd, 'orange', { size: 3.8 });
          s.arrow(x + cw / 2, ty + u * 10, x + cw / 2, oy - u * 1, s.tint('--ink-3', 0.8), 0.3, 1.6);
          box(s, x + u, oy, cw - 2 * u, u * 9, `out ${i}`, 'purple', { size: 3.4 });
          s.alpha(s.ease('old', 0.6, 0.15 * i), () => pill(s, `+ p${i}`, x + cw / 2, ty + u * 15, 'red', { size: 3.2, mono: true }));
        });
        s.text('attention', x0 + w / 2, (ty + oy) / 2 + u * 5, { size: 3.4, italic: true, color: s.c('--ink-3'), halo: true });
        s.alpha(s.ease('problems', 0.6), () => {
          const py = y0 + h * 0.8;
          pill(s, 'relative offsets? work them out', x0 + w / 2, py - u * 3.5, 'red', { size: 3.3 });
          s.alpha(s.ease('problems', 0.6, 2.5), () => pill(s, 'a learned table ends where training did', x0 + w / 2, py + u * 4.5, 'red', { size: 3.3 }));
        });
      });
    }
    // B: one pair, rotated
    const aB = s.win('rope', 'speeds');
    if (aB > 0) {
      s.alpha(aB, () => {
        const th = RT[PAIR]!;
        const m = 3;
        const n = 7;
        const t = 24 * smooth(s.prog('shift')) + (s.since('relative') >= 0 ? 0 : 0);
        const shiftT = s.since('shift') >= 0 ? t : 0;
        const aq = PHI_Q + th * (m * s.ease('rotate', 1.6) + shiftT);
        const ak = PHI_K + th * (n * s.ease('both', 1.6) + shiftT);
        const R = s.tall ? Math.min(w * 0.3, h * 0.28) : Math.min(h * 0.38, w * 0.24);
        const cx = s.tall ? x0 + w / 2 : x0 + w * 0.3;
        const cy = s.tall ? y0 + h * 0.43 : y0 + h * 0.52;
        s.line(cx - R * 1.15, cy, cx + R * 1.15, cy, s.c('--grid'), 0.25);
        s.line(cx, cy - R * 1.15, cx, cy + R * 1.15, s.c('--grid'), 0.25);
        s.circle(cx, cy, R, { stroke: s.tint('--ink-3', 0.5), lw: 0.3 });
        const P = (ang: number, len: number): [number, number] => [cx + Math.cos(ang) * R * len, cy - Math.sin(ang) * R * len];
        const pa = s.ease('rope', 0.6, 0.8);
        s.alpha(pa * 0.5, () => {
          const [qx, qy] = P(PHI_Q, LQ);
          const [kx, ky] = P(PHI_K, LK);
          s.line(cx, cy, qx, qy, s.c('teal'), 0.35, [1.2, 1]);
          s.line(cx, cy, kx, ky, s.c('green'), 0.35, [1.2, 1]);
        });
        s.alpha(pa, () => {
          let d = ak - aq;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          const c = s.ctx;
          c.beginPath();
          c.arc(cx, cy, R * 0.3, -aq, -(aq + d), d > 0);
          c.strokeStyle = s.c('purple');
          c.lineWidth = u * 0.5;
          c.stroke();
          const [qx, qy] = P(aq, LQ);
          const [kx, ky] = P(ak, LK);
          s.arrow(cx, cy, qx, qy, s.c('teal'), 0.8, 3);
          s.arrow(cx, cy, kx, ky, s.c('green'), 0.8, 3);
          const [lqx, lqy] = P(aq, LQ + 0.2);
          const [lkx, lky] = P(ak, LK + 0.24);
          s.text('q', lqx, lqy, { size: 4.6, italic: true, weight: 650, color: s.c('teal'), halo: true });
          s.text('k', lkx, lky, { size: 4.6, italic: true, weight: 650, color: s.c('green'), halo: true });
          const score = LQ * LK * Math.cos(ak - aq);
          const lines: [string, K][] = [
            [`pair i = ${PAIR}: θ = ${fmt(th, 3)} rad/token`, 'red'],
            [`q at m = ${fmt(m * s.ease('rotate', 1.6) + shiftT, 3)}`, 'teal'],
            [`k at n = ${fmt(n * s.ease('both', 1.6) + shiftT, 3)}`, 'green'],
            [`angle between: ${Math.round((Math.abs(d) * 180) / Math.PI)}°`, 'purple'],
            [`q · k = ${fmt(score, 3)}`, 'purple'],
          ];
          if (s.tall) {
            const ly = cy + R * 1.22 + u * 4;
            s.text(`${lines[1]![0]}   ${lines[2]![0]}`, x0 + w / 2, ly, { size: 3.3, font: 'mono', color: s.c('--ink') });
            s.text(`${lines[3]![0]}   ${lines[4]![0]}`, x0 + w / 2, ly + u * 5, { size: 3.3, font: 'mono', color: s.c('purple') });
            s.text(lines[0]![0], x0 + w / 2, ly + u * 10, { size: 3.1, font: 'mono', color: s.c('red') });
          } else {
            const lx = x0 + w * 0.58;
            const lsz = Math.min(3.6, fitSize(s, lines[0]![0], x0 + w - lx, 3.6, { font: 'mono' }));
            lines.forEach(([tx, k], i) => s.text(tx, lx, y0 + h * 0.2 + i * u * 7, { size: lsz, font: 'mono', align: 'left', color: s.c(k) }));
          }
          s.alpha(s.ease('relative', 0.6), () => pill(s, 'depends only on n − m = 4', s.tall ? x0 + w / 2 : x0 + w * 0.72, s.tall ? y0 + u * 2.5 : y0 + h * 0.84, 'purple', { size: 3.4 }));
        });
      });
    }
    // C: eight speeds, like clock hands
    const aC = s.ease('speeds', 0.7);
    if (aC > 0) {
      s.alpha(aC, () => {
        const pos = 6 * Math.max(0, s.since('speeds'));
        const cols = 4;
        const rows = 2;
        const cw = w / cols;
        const r = Math.min(cw * 0.36, (h * 0.62) / rows / 2.6);
        const gy = y0 + u * 14;
        s.text(`position ${Math.floor(pos)}`, x0 + w / 2, y0 + u * 4, { size: 3.8, font: 'mono', weight: 600 });
        RT.forEach((th, i) => {
          const cx = x0 + cw * ((i % cols) + 0.5);
          const cy = gy + r + Math.floor(i / cols) * (r * 2 + u * 10);
          const per = (2 * Math.PI) / th;
          dial(s, cx, cy, r, pos * th, per >= 1000 ? `${fmt(per / 1000, 2)}K` : String(Math.round(per)));
        });
        const by = gy + rows * (r * 2 + u * 10) + u * 1;
        s.text('tokens per full turn: fast pairs left, slow pairs right', x0 + w / 2, by, { size: Math.min(3.2, fitSize(s, 'tokens per full turn: fast pairs left, slow pairs right', w, 3.2, { font: 'serif' })), italic: true, color: s.c('--ink-2') });
        s.alpha(s.ease('cost', 0.6), () => pill(s, 'no parameters · only q and k rotate', x0 + w / 2, by + u * 8, 'red', { size: 3.3 }));
      });
    }
  },
};

// ---------------------------------------------------------------- SwiGLU

const W1 = [1.2, 0.5];
const W3 = [-0.4, 1.1];
const unitVal = (kind: 'relu' | 'swiglu', x: number, y: number): number => {
  const a = W1[0]! * x + W1[1]! * y;
  return kind === 'relu' ? M.relu(a) : M.silu(a) * (W3[0]! * x + W3[1]! * y);
};
const heatCache = new Map<string, HTMLCanvasElement>();
function heat(kind: 'relu' | 'swiglu', pos: string, neg: string): HTMLCanvasElement {
  const key = `${kind}|${pos}|${neg}`;
  const hit = heatCache.get(key);
  if (hit) return hit;
  const n = 96;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const img = new ImageData(n, n);
  const rgb = (c: string) => {
    const v = parseInt(c.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  const P = rgb(pos);
  const Ng = rgb(neg);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = -2.2 + (4.4 * (i + 0.5)) / n;
      const y = 2.2 - (4.4 * (j + 0.5)) / n;
      const v = unitVal(kind, x, y);
      const c = v >= 0 ? P : Ng;
      const o = (j * n + i) * 4;
      img.data[o] = c[0]!;
      img.data[o + 1] = c[1]!;
      img.data[o + 2] = c[2]!;
      img.data[o + 3] = Math.tanh(Math.abs(v) / 2.2) * 215;
    }
  cv.getContext('2d')!.putImageData(img, 0, 0);
  heatCache.set(key, cv);
  return cv;
}

const swiglu: SceneDef = {
  draw(s) {
    const [x0, y0, w, h] = area(s);
    const u = s.u;
    const S = Math.min(w * 0.56, h - u * 6);
    const hx = x0;
    const top0 = y0 + Math.max(0, (h - S - u * 6) / 2);
    const hy = top0 + u * 6;
    const X = (x: number) => hx + ((x + 2.2) / 4.4) * S;
    const Y = (y: number) => hy + ((2.2 - y) / 4.4) * S;
    const sw = s.ease('glu', 1.2);
    s.text(sw < 0.5 ? 'one ReLU unit' : 'one SwiGLU unit', hx + S / 2, top0 + u * 2, { size: 3.6, font: 'ui', weight: 600, color: s.c('--ink-2') });
    const c = s.ctx;
    c.save();
    c.beginPath();
    c.rect(hx, hy, S, S);
    c.clip();
    c.imageSmoothingEnabled = true;
    const pos = s.c('orange');
    const neg = s.c('blue');
    s.alpha(1 - sw, () => c.drawImage(heat('relu', pos, neg), hx, hy, S, S));
    s.alpha(sw, () => c.drawImage(heat('swiglu', pos, neg), hx, hy, S, S));
    s.line(X(0), hy, X(0), hy + S, s.c('--grid'), 0.25);
    s.line(hx, Y(0), hx + S, Y(0), s.c('--grid'), 0.25);
    const zero = (wv: number[], k: K, a: number) => {
      const L = Math.hypot(wv[0]!, wv[1]!);
      const ux = -wv[1]! / L;
      const uy = wv[0]! / L;
      s.alpha(a, () => s.line(X(-ux * 4), Y(-uy * 4), X(ux * 4), Y(uy * 4), s.c(k), 0.4, [1.4, 1.1]));
    };
    zero(W1, 'blue', 1);
    zero(W3, 'slate', sw);
    c.restore();
    s.rrect(hx, hy, S, S, 1, { stroke: s.c('--rule'), lw: 0.3 });
    s.arrow(X(0), Y(0), X(W1[0]!), Y(W1[1]!), s.c('blue'), 0.7, 2.6);
    s.text(sw > 0.5 ? 'w1 (gate)' : 'w1', X(W1[0]! * 1.18), Y(W1[1]! * 1.18) - u * 2, { size: 3.6, italic: true, weight: 650, color: s.c('blue'), halo: true });
    s.alpha(sw, () => {
      s.arrow(X(0), Y(0), X(W3[0]!), Y(W3[1]!), s.c('slate'), 0.7, 2.6);
      s.text('w3', X(W3[0]! * 1.2), Y(W3[1]! * 1.2) - u * 1.5, { size: 3.6, italic: true, weight: 650, color: s.c('slate'), halo: true });
    });
    s.alpha(s.win('product', 'size'), () => {
      const pts: [number, number][] = [[1.4, 1.4], [1.5, -1.3], [-1.5, 1.2], [-1.2, -1.6], [0.2, 1.8], [1.8, -0.1]];
      for (const [px, py] of pts) {
        const v = unitVal('swiglu', px, py);
        if (Math.abs(v) < 0.25) continue;
        s.text(v > 0 ? '+' : '−', X(px), Y(py), { size: 6, font: 'mono', weight: 700, color: s.c(v > 0 ? '--ink' : '--ink'), halo: true });
      }
    });
    // right column
    const rx = hx + S + u * 5;
    const rw = x0 + w - rx;
    const actA = s.win('silu', 'size');
    if (actA > 0) {
      s.alpha(actA, () => {
        const ph = Math.min(rw * 0.75, S * 0.5);
        const py = hy;
        const FX = (z: number) => rx + ((z + 4) / 7) * rw;
        const FY = (v: number) => py + ph - ((v + 0.7) / 3.7) * ph;
        s.line(rx, FY(0), rx + rw, FY(0), s.c('--axis'), 0.25);
        s.line(FX(0), py, FX(0), py + ph, s.c('--axis'), 0.25);
        const curve = (fn: (z: number) => number, k: K, lw: number) => {
          c.beginPath();
          for (let i = 0; i <= 80; i++) {
            const z = -4 + (7 * i) / 80;
            const X2 = FX(z);
            const Y2 = FY(fn(z));
            if (i) c.lineTo(X2, Y2);
            else c.moveTo(X2, Y2);
          }
          c.strokeStyle = s.c(k);
          c.lineWidth = lw * u;
          c.stroke();
        };
        curve(M.relu, 'slate', 0.4);
        curve(M.silu, 'blue', 0.7);
        s.text('ReLU', rx, py + u * 2, { size: 3.2, font: 'ui', weight: 600, align: 'left', color: s.c('slate') });
        s.text('SiLU = z · σ(z)', rx, py + u * 6.5, { size: 3.2, font: 'ui', weight: 600, align: 'left', color: s.c('blue') });
      });
    }
    const sizeA = s.win('size', 'shrug');
    if (sizeA > 0) {
      s.alpha(sizeA, () => {
        const unit = rw / 8.6;
        const bh = u * 6;
        const rowY = [hy + S * 0.18, hy + S * 0.5];
        const rowsDef: [string, number, K][] = [
          ['ReLU MLP: 2 × 4d', 2, 'slate'],
          ['SwiGLU: 3 × 8d/3', 3, 'blue'],
        ];
        rowsDef.forEach(([lab, nmat, k], ri) => {
          const each = 8 / nmat;
          s.text(lab, rx, rowY[ri]! - u * 3, { size: Math.min(3.4, fitSize(s, lab, rw, 3.4)), font: 'ui', weight: 600, align: 'left', color: s.c(k) });
          for (let i = 0; i < nmat; i++) s.rrect(rx + i * each * unit + u * 0.3, rowY[ri]!, each * unit - u * 0.6, bh, 0.8, { fill: s.tint(k, 0.55) });
        });
        s.text('same total: 8d² weights', rx, hy + S * 0.5 + u * 14, { size: Math.min(3.3, fitSize(s, 'same total: 8d² weights', rw, 3.3, { font: 'serif' })), italic: true, align: 'left', color: s.c('--ink-2') });
      });
    }
    const quoteA = s.win('shrug', 'adopt');
    if (quoteA > 0) {
      s.alpha(quoteA, () => {
        const lines = ['"we attribute their', 'success, as all else,', 'to divine benevolence."', '(Shazeer, 2020)'];
        const sz = Math.min(3.6, fitSize(s, lines[2]!, rw, 3.6, { font: 'serif' }));
        lines.forEach((l, i) => s.text(l, rx, hy + S * 0.3 + i * u * sz * 1.6, { size: sz, italic: true, align: 'left', color: s.c(i === 3 ? '--ink-3' : '--ink') }));
      });
    }
    s.alpha(s.ease('adopt', 0.6), () => {
      pill(s, 'PaLM (2022)', rx, hy + S * 0.3, 'blue', { size: 3.3, align: 'left' });
      pill(s, 'LLaMA (2023)', rx, hy + S * 0.3 + u * 9, 'blue', { size: 3.3, align: 'left' });
      pill(s, 'now the default', rx, hy + S * 0.3 + u * 18, 'gold', { size: 3.3, align: 'left' });
    });
    s.alpha(s.win('old', 'size') * (1 - actA), () => {
      const fl = sw < 0.5 ? ['relu(x · w1)'] : ['silu(x · w1)', '· (x · w3)'];
      const fsz = Math.min(3.6, fitSize(s, 'silu(x · w1)', rw, 3.6, { font: 'mono' }));
      s.text('unit =', rx, hy + S * 0.36, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink-2') });
      fl.forEach((l, i) => s.text(l, rx, hy + S * 0.36 + u * (6 + i * fsz * 1.5), { size: fsz, font: 'mono', weight: 650, align: 'left', color: s.c('blue') }));
    });
  },
};

// ---------------------------------------------------------------- KV cache

const TOKS = ['The', 'cat', 'sat', 'on', 'the', 'mat'];

const kvcache: SceneDef = {
  draw(s) {
    const [x0, y0, w, h] = area(s);
    const u = s.u;
    const aA = 1 - s.ease('mem', 0.7);
    if (aA > 0) {
      s.alpha(aA, () => {
        const n = Math.max(1, Math.min(6, 1 + Math.floor(Math.max(0, s.t - s.at('loop')) / 0.9)));
        const cw = Math.min(w / 6.4, u * 18);
        const ox = x0 + (w - cw * 6) / 2;
        const qy = y0 + u * 1;
        const ty = y0 + h * 0.2;
        const ky = y0 + h * 0.48;
        const vy = ky + u * 9;
        const ch = u * 8;
        const newest = n - 1;
        s.alpha(s.ease('loop', 0.4), () => {
          {
            const nx0 = ox + newest * cw + cw / 2;
            for (let j = 0; j <= newest; j++) s.line(nx0, qy + ch, ox + j * cw + cw / 2, ky, s.tint('teal', 0.45), 0.3);
          }
          for (let j = 0; j < n; j++) {
            const x = ox + j * cw;
            const fresh = j === newest ? 1 : 0;
            box(s, x + u * 0.8, ty, cw - u * 1.6, ch, TOKS[j]!, 'orange', { size: 3.4, on: fresh * 0.6 });
            box(s, x + u * 0.8, ky, cw - u * 1.6, ch, `k${j}`, 'green', { size: 3.2, mono: true, on: fresh * (s.since('store') >= 0 ? 0.5 + 0.5 * Math.sin(s.since('store') * 5) : 0.4) });
            box(s, x + u * 0.8, vy, cw - u * 1.6, ch, `v${j}`, 'gold', { size: 3.2, mono: true, on: fresh * 0.4 });
            if (j < newest) s.alpha(s.ease('same', 0.5), () => s.text('✓', x + cw / 2, vy + ch + u * 3.4, { size: 3.4, color: s.c('green'), weight: 700 }));
          }
          const nx = ox + newest * cw + cw / 2;
          box(s, nx - cw / 2 + u * 0.8, qy, cw - u * 1.6, ch, `q${newest}`, 'teal', { size: 3.2, mono: true, on: 0.4 });
          s.text('sample one token, append, repeat', x0 + w / 2, y0 + h - u * 2, { size: 3.3, italic: true, color: s.c('--ink-2') });
          s.alpha(s.win('same', 'cache'), () => s.text('✓ old keys and values never change', x0 + w / 2, vy + ch + u * 9, { size: 3.3, font: 'ui', weight: 600, color: s.c('green') }));
        });
        s.alpha(s.ease('cache', 0.6), () => {
          const fx = ox - u * 1;
          s.rrect(fx, ky - u * 3.5, cw * 6 + u * 2, ch * 2 + u * 6.5, 2, { stroke: s.c('--accent'), lw: 0.5 });
          pill(s, 'KV cache', fx + u * 2, ky - u * 3.5, '--accent', { size: 3.2, align: 'left' });
        });
      });
    }
    const aB = s.ease('mem', 0.7);
    if (aB > 0) {
      s.alpha(aB, () => {
        const rows: [string, string][] = [
          ['2', 'key + value'],
          ['× 32', 'layers'],
          ['× 32', 'kv heads'],
          ['× 128', 'head width'],
          ['× 2', 'bytes (bf16)'],
        ];
        const showN = s.ease('llama', 0.6);
        const tw = w * 0.5;
        const fsz = s.tall ? 3.6 : 4.2;
        const rh = u * fsz * 1.55;
        const ty = y0 + u * 1;
        const nx = x0 + tw * 0.36;
        rows.forEach(([num, lab], i) => {
          const a = s.ease(i === 0 ? 'mem' : 'formula', 0.5, i * 0.5);
          const y = ty + i * rh;
          s.alpha(Math.max(a, s.since('llama') >= 0 ? 1 : 0), () => {
            s.alpha(showN, () => s.text(num, nx, y, { size: fsz, font: 'mono', weight: 650, align: 'right', base: 'top', color: s.c('--ink') }));
            s.text(i === 0 ? lab : `× ${lab}`, nx + u * 2, y, { size: Math.min(fsz, fitSize(s, `× ${lab}`, tw * 0.6, fsz)), font: 'ui', align: 'left', base: 'top', color: s.c('--ink-2') });
          });
        });
        const ry = ty + rows.length * rh + u * 1;
        s.alpha(showN, () => {
          s.line(x0, ry, x0 + tw * 0.95, ry, s.c('--rule'), 0.3);
          const t = '= 512 KiB per token';
          s.text(t, x0, ry + u * 1.5, { size: Math.min(fsz, fitSize(s, t, tw * 0.95, fsz, { font: 'mono' })), font: 'mono', weight: 650, align: 'left', base: 'top', color: s.c('green') });
        });
        // one token's cache: a K and a V for every layer and kv head
        const gA = s.ease('mem', 0.7, 0.4) * (1 - s.ease('ctx', 0.6));
        if (gA > 0) {
          s.alpha(gA, () => {
            const gsz = Math.min(w * 0.46, h - u * 14);
            const cell = gsz / 32;
            const gx = x0 + w - gsz;
            const gy = y0 + u * 1;
            const fill = s.since('llama') >= 0 ? 32 : Math.min(32, 32 * clamp01(s.since('mem') / 4));
            const c = s.ctx;
            c.fillStyle = s.tint('--ink-3', 0.08);
            c.fillRect(gx, gy, gsz, gsz);
            for (let l = 0; l < Math.floor(fill); l++)
              for (let hd = 0; hd < 32; hd++) {
                c.fillStyle = s.tint('green', 0.85);
                c.fillRect(gx + hd * cell + cell * 0.08, gy + l * cell + cell * 0.08, cell * 0.84, cell * 0.4);
                c.fillStyle = s.tint('gold', 0.9);
                c.fillRect(gx + hd * cell + cell * 0.08, gy + l * cell + cell * 0.5, cell * 0.84, cell * 0.4);
              }
            const l1 = 'one token: 32 layers ×';
            const l2 = '32 heads × (k, v)';
            const lsz = Math.min(3.2, fitSize(s, l1, gsz, 3.2));
            s.text(l1, gx + gsz / 2, gy + gsz + u * 3, { size: lsz, font: 'ui', weight: 600, color: s.c('--ink-2') });
            s.text(l2, gx + gsz / 2, gy + gsz + u * (3 + lsz * 1.4), { size: lsz, font: 'ui', weight: 600, color: s.c('--ink-2') });
          });
        }
        const barsA = s.ease('ctx', 0.6);
        if (barsA > 0) {
          s.alpha(barsA, () => {
            const bx = s.tall ? x0 : x0 + w * 0.52;
            const bw = s.tall ? w : w * 0.48;
            const by = s.tall ? ry + u * 14 : y0 + h * 0.2;
            const bh = s.tall ? u * 6.5 : u * 9;
            const gap = s.tall ? u * 6 : u * 10;
            const GPU = 80;
            const max = 92;
            const Xb = (g: number) => bx + (g / max) * bw;
            const cache = lerp(2, 64, s.ease('batch', 1.4));
            s.line(Xb(GPU), by - u * 3, Xb(GPU), by + 2 * bh + gap + u * 2, s.c('red'), 0.4, [1.2, 1]);
            s.text('80 GB GPU', Xb(GPU) - u * 1, by - u * 4.5, { size: 3.1, font: 'ui', weight: 600, align: 'right', color: s.c('red') });
            s.rrect(bx, by, Xb(12.6) - bx, bh, 0.8, { fill: s.tint('blue', 0.75) });
            s.text('weights 12.6 GiB', Xb(12.6) + u * 1.5, by + bh / 2, { size: 3.3, font: 'ui', weight: 600, align: 'left', halo: true });
            s.rrect(bx, by + bh + gap, Math.max(u, Xb(cache) - bx), bh, 0.8, { fill: s.tint('green', 0.75) });
            const cl = s.since('batch') >= 0 ? `cache, 32 sequences: ${Math.round(cache)} GiB` : 'cache, one sequence: 2 GiB';
            const csz = Math.min(3.3, fitSize(s, cl, bw - u * 3, 3.3));
            const inside = Xb(cache) - bx > s.measure(cl, { size: csz, font: 'ui', weight: 600 }) + u * 3;
            const right = !inside && Xb(cache) + u * 1.5 + s.measure(cl, { size: csz, font: 'ui', weight: 600 }) < Xb(GPU) - u;
            const ly2 = inside || right ? by + bh + gap + bh / 2 : by + bh + gap - u * 2.4;
            s.text(cl, inside ? bx + u * 1.5 : right ? Xb(cache) + u * 1.5 : bx, ly2, { size: csz, font: 'ui', weight: 600, align: 'left', color: inside ? '#ffffff' : s.c('--ink'), halo: !inside });
            s.alpha(s.ease('speed', 0.5), () => {
              const f = (Math.max(0, s.since('speed')) % 1.6) / 1.6;
              const sx = bx + f * (Xb(cache) - bx);
              s.rrect(sx - u * 2, by + bh + gap - u * 0.6, u * 4, bh + u * 1.2, 1, { fill: s.tint('--accent', 0.55) });
              s.text('read all of it, every token', bx, by + 2 * bh + gap + u * 5, { size: 3.3, italic: true, align: 'left', color: s.c('--accent') });
            });
          });
        }
      });
    }
  },
};

// ---------------------------------------------------------------- GQA

function heads(s: Scene, r: Rect, nkv: number, a: number, rep: number): void {
  const [x0, y0, w] = r;
  const u = s.u;
  const H = 32;
  const qw = w / H;
  const qy = y0 + u * 6;
  const ky = y0 + u * 30;
  const group = H / nkv;
  s.alpha(a, () => {
    for (let j = 0; j < H; j++) {
      const g = Math.floor(j / group);
      s.rrect(x0 + j * qw + qw * 0.12, qy, qw * 0.76, u * 5, 0.5, { fill: s.tint('teal', g % 2 ? 0.5 : 0.85) });
    }
    const kw = w / nkv;
    for (let g = 0; g < nkv; g++) {
      const cx = x0 + g * kw + kw / 2;
      const q0 = x0 + g * group * qw;
      const q1 = q0 + group * qw;
      const c = s.ctx;
      c.beginPath();
      c.moveTo(q0 + qw * 0.5, qy + u * 5.2);
      c.lineTo(cx, ky - u * 0.4);
      c.lineTo(q1 - qw * 0.5, qy + u * 5.2);
      c.strokeStyle = s.tint('--ink-3', 0.5);
      c.lineWidth = u * 0.22;
      c.stroke();
      const bw = Math.max(u * 0.8, Math.min(kw - u * 0.8, u * 10));
      s.rrect(cx - bw / 2, ky, bw, u * 4, 0.4, { fill: s.tint('green', 0.8) });
      s.rrect(cx - bw / 2, ky + u * 4.4, bw, u * 4, 0.4, { fill: s.tint('gold', 0.85) });
    }
    if (rep > 0 && nkv < H) {
      s.alpha(rep, () => {
        for (let j = 0; j < group; j++) {
          const x = x0 + j * qw + qw * 0.12;
          const c = s.ctx;
          c.save();
          c.setLineDash([u * 0.6, u * 0.5]);
          s.rrect(x, qy + u * 7, qw * 0.76, u * 3, 0.4, { stroke: s.c('green'), lw: 0.3 });
          s.rrect(x, qy + u * 10.4, qw * 0.76, u * 3, 0.4, { stroke: s.c('gold'), lw: 0.3 });
          c.restore();
        }
        s.text('reused, not new weights', x0 + group * qw + u * 2, qy + u * 10, { size: 3.1, italic: true, align: 'left', color: s.c('--ink-2'), halo: true });
      });
    }
  });
}

const gqa: SceneDef = {
  draw(s) {
    const [x0, y0, w, h] = area(s);
    const u = s.u;
    const toMqa = s.ease('mqa', 1.0);
    const toGqa = s.ease('gqa', 1.0);
    const r: Rect = [x0, y0 + u * 3, w, h * 0.5];
    const nkvA = toGqa > 0 ? 1 : 32;
    const aA = toGqa > 0 ? 1 - toGqa : 1 - toMqa;
    heads(s, r, nkvA, aA * (toGqa > 0 ? 1 : 1), 0);
    if (toGqa > 0) heads(s, r, 8, toGqa, 0);
    else heads(s, r, 1, toMqa, 0);
    const kv = toGqa > 0.5 ? 8 : toMqa > 0.5 ? 1 : 32;
    const kind = kv === 32 ? 'MHA: 32 query heads, 32 key-value heads' : kv === 1 ? 'MQA: 32 query heads share 1' : 'GQA: 8 groups of 4';
    s.text(kind, x0 + w / 2, y0 + u * 1, { size: Math.min(3.6, fitSize(s, kind, w, 3.6)), font: 'ui', weight: 600, base: 'top', color: s.c('--ink-2') });
    const cmp = s.ease('llama3', 0.7);
    const barY = y0 + h * 0.6;
    const bw = w;
    const kib = lerp(lerp(512, 16, toMqa), 128, toGqa);
    const zoom = s.win('repeat', 'quality');
    s.alpha((1 - cmp) * (1 - zoom), () => {
      s.text('cache per token (Llama-2-7B shape)', x0, barY - u * 3, { size: 3.3, font: 'ui', align: 'left', color: s.c('--ink-2') });
      s.rrect(x0, barY, Math.max(u, (kib / 512) * bw), u * 7, 0.8, { fill: s.tint('green', 0.75) });
      const lab = `${Math.round(kib)} KiB`;
      s.text(lab, x0 + Math.max(u, (kib / 512) * bw) + u * 1.5 > x0 + w - u * 15 ? x0 + u * 1.5 : x0 + Math.max(u, (kib / 512) * bw) + u * 1.5, barY + u * 3.6, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: kib > 400 ? '#ffffff' : s.c('--ink') });
      s.alpha(s.win('mqa2', 'gqa'), () => pill(s, '32x smaller, a little worse', x0 + w / 2, barY + u * 14, 'red', { size: 3.3 }));
      s.alpha(s.win('quality', 'llama3'), () => pill(s, 'close to MHA quality, 1/4 of the cache', x0 + w / 2, barY + u * 14, 'green', { size: 3.3 }));
    });
    s.alpha(cmp * (1 - s.ease('further', 0.6) * 0.6), () => {
      const rows: [string, number][] = [
        ['Llama 2 7B: 32 kv heads', 512],
        ['Llama 3 8B: 8 kv heads', 128],
      ];
      const full = bw - s.measure('128 KiB per token', { size: 3.4, font: 'mono', weight: 650 }) - u * 3;
      rows.forEach(([lab, v], i) => {
        const y = barY - u * 2 + i * u * 13;
        const bl = (v / 512) * full;
        s.text(lab, x0, y, { size: 3.3, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
        s.rrect(x0, y + u * 2.5, bl, u * 6, 0.8, { fill: s.tint('green', 0.75) });
        const t = `${v} KiB per token`;
        const fits = bl > s.measure(t, { size: 3.4, font: 'mono', weight: 650 }) + u * 3;
        s.text(t, fits ? x0 + u * 1.5 : x0 + bl + u * 1.5, y + u * 5.5, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: fits ? '#ffffff' : s.c('--ink') });
      });
    });
    // one group up close: four query heads, one shared key and value head
    if (zoom > 0) {
      s.alpha(zoom, () => {
        const zw = Math.min(w, u * 90);
        const zx = x0 + (w - zw) / 2;
        const zy = barY - u * 4;
        const qw = zw / 6;
        s.text('one group, up close', x0 + w / 2, zy, { size: 3.3, font: 'ui', weight: 600, color: s.c('--ink-2') });
        for (let j = 0; j < 4; j++) {
          const qx = zx + (j + 0.5) * (zw / 4) - qw / 2;
          box(s, qx, zy + u * 3, qw, u * 6, `q${j}`, 'teal', { size: 3.2, mono: true, on: 0.4 });
          const c = s.ctx;
          c.save();
          c.setLineDash([u * 0.7, u * 0.5]);
          s.rrect(qx, zy + u * 11, qw * 0.48, u * 5, 0.6, { stroke: s.c('green'), lw: 0.35, fill: s.tint('green', 0.08) });
          s.rrect(qx + qw * 0.52, zy + u * 11, qw * 0.48, u * 5, 0.6, { stroke: s.c('gold'), lw: 0.35, fill: s.tint('gold', 0.08) });
          c.restore();
          s.text('k', qx + qw * 0.24, zy + u * 13.7, { size: 3, font: 'mono', color: s.c('green') });
          s.text('v', qx + qw * 0.76, zy + u * 13.7, { size: 3, font: 'mono', color: s.c('gold') });
          s.arrow(x0 + w / 2, zy + u * 21, qx + qw / 2, zy + u * 16.6, s.tint('--ink-3', 0.8), 0.3, 1.6);
        }
        const kx = x0 + w / 2 - qw;
        box(s, kx, zy + u * 21, qw, u * 6, 'k', 'green', { size: 3.4, mono: true, on: 0.6 });
        box(s, kx + qw, zy + u * 21, qw, u * 6, 'v', 'gold', { size: 3.4, mono: true, on: 0.6 });
        s.text('stored once, read by all four', x0 + w / 2, zy + u * 31, { size: 3.2, italic: true, color: s.c('--ink-2') });
      });
    }
    s.alpha(s.ease('further', 0.6), () => {
      pill(s, 'MLA (DeepSeek-V2): one compressed vector per token', x0 + w / 2, y0 + h - u * 9, 'purple', { size: Math.min(3.2, fitSize(s, 'MLA (DeepSeek-V2): one compressed vector per token', w * 0.86, 3.2)) });
      pill(s, 'paged caches, batching: fast inference', x0 + w / 2, y0 + h - u * 1.5, 'slate', { size: 3.1 });
    });
  },
};

// ---------------------------------------------------------------- QK-norm and biases

const QK = (() => {
  const r = new Rng(8);
  const d = 16;
  const q0 = Array.from({ length: d }, () => r.randn());
  const K0 = Array.from({ length: 8 }, () => Array.from({ length: d }, () => r.randn()));
  return { d, q0, K0 };
})();
function attendQK(sv: number, norm: boolean): number[] {
  let q = QK.q0.map((t) => t * sv);
  let K = QK.K0.map((row) => row.map((t) => t * sv));
  if (norm) {
    q = M.rmsNorm(q);
    K = K.map((row) => M.rmsNorm(row));
  }
  return M.softmax(K.map((row) => M.dot(row, q) / Math.sqrt(QK.d)));
}
const BIAS_S = [0.6, -0.4, 1.3, 0.1, -0.9, 0.4];

function bars(s: Scene, r: Rect, vals: number[], k: K, max: number, labels?: string[]): void {
  const [x0, y0, w, h] = r;
  const u = s.u;
  const n = vals.length;
  const cw = w / n;
  const base = y0 + h;
  vals.forEach((v, j) => {
    const hh = (Math.max(0, v) / max) * h;
    s.rrect(x0 + j * cw + cw * 0.18, base - hh, cw * 0.64, Math.max(1, hh), 0.5, { fill: s.tint(k, 0.75) });
    if (labels) s.text(labels[j]!, x0 + j * cw + cw / 2, base - hh - u * 2, { size: 2.9, font: 'mono', color: s.c('--ink-2') });
  });
  s.line(x0, base, x0 + w, base, s.c('--axis'), 0.25);
}

const stability: SceneDef = {
  draw(s) {
    const [x0, y0, w, h] = area(s);
    const u = s.u;
    const aA = 1 - s.ease('biases', 0.7);
    if (aA > 0) {
      s.alpha(aA, () => {
        const g = 2 ** (4 * clamp01((s.t - s.at('growth')) / Math.max(0.1, s.at('vit') - s.at('growth'))));
        const mixN = s.ease('fix', 1.2);
        const raw = attendQK(g, false);
        const nrm = attendQK(g, true);
        const A = raw.map((v, j) => lerp(v, nrm[j]!, mixN));
        const H = M.entropyBits(A);
        const r: Rect = [x0, y0 + u * 10, w, h * 0.52];
        bars(s, r, A, 'purple', 1, A.map((v) => (v > 0.995 ? '1.00' : v.toFixed(2))));
        s.text('attention weights over 8 keys', x0, y0 + u * 1, { size: 3.4, font: 'ui', weight: 600, align: 'left', base: 'top', color: s.c('--ink-2') });
        const info = `weights grown ×${fmt(g, 2)}   entropy ${H < 0.005 ? '0.00' : fmt(H, 2)} bits`;
        s.text(info, x0 + w / 2, y0 + h * 0.52 + u * 16, { size: Math.min(3.6, fitSize(s, info, w, 3.6, { font: 'mono' })), font: 'mono', weight: 600 });
        const py = y0 + h * 0.52 + u * 25;
        s.alpha(s.win('stuck', 'fix'), () => pill(s, 'one key takes it all: little gradient elsewhere', x0 + w / 2, py, 'red', { size: Math.min(3.2, fitSize(s, 'one key takes it all: little gradient elsewhere', w * 0.9, 3.2)) }));
        s.alpha(s.win('vit', 'fix'), () => pill(s, 'ViT-22B (2023): logits grew, loss diverged', x0 + w / 2, py + u * 8, 'red', { size: Math.min(3.2, fitSize(s, 'ViT-22B (2023): logits grew, loss diverged', w * 0.9, 3.2)) }));
        s.alpha(s.win('fix', 'who'), () => pill(s, 'QK-norm on: scores bounded', x0 + w / 2, py, 'teal', { size: 3.3 }));
        s.alpha(s.ease('who', 0.6), () => {
          const names = ['OLMo 2', 'Gemma 3', 'Qwen 3'];
          names.forEach((nm, i) => pill(s, nm, x0 + w * (0.25 + 0.25 * i), py, 'teal', { size: 3.3 }));
        });
      });
    }
    const aB = s.ease('biases', 0.7);
    if (aB > 0) {
      s.alpha(aB, () => {
        pill(s, 'PaLM (2022): no biases anywhere', x0 + w / 2, y0 + u * 2, 'slate', { size: 3.3 });
        s.alpha(s.win('biases', 'keybias'), () => {
          const lines: [string, string, string][] = [
            ['q = x @ Wq', ' + bq', ''],
            ['k = x @ Wk', ' + bk', ''],
            ['v = x @ Wv', ' + bv', ''],
            ['h = relu(x @ W1', ' + b1', ')'],
            ['y = layer_norm(x) * g', ' + b', ''],
          ];
          const fsz = Math.min(3.8, fitSize(s, 'y = layer_norm(x) * g + b', w * 0.9, 3.8, { font: 'mono' }));
          const lx = x0 + w * 0.08;
          lines.forEach(([a, b, tail], i) => {
            const y = y0 + u * 12 + i * u * fsz * 2;
            s.text(a, lx, y, { size: fsz, font: 'mono', align: 'left', color: s.c('--ink') });
            const aw = s.measure(a, { size: fsz, font: 'mono' });
            const bw = s.measure(b, { size: fsz, font: 'mono' });
            s.text(b, lx + aw, y, { size: fsz, font: 'mono', align: 'left', color: s.c('red') });
            if (tail) s.text(tail, lx + aw + bw, y, { size: fsz, font: 'mono', align: 'left', color: s.c('--ink') });
            const st = s.ease('biases', 0.4, 0.8 + i * 0.35);
            s.line(lx + aw + u * 0.5, y, lx + aw + u * 0.5 + (bw - u * 0.5) * st, y, s.c('red'), 0.45);
          });
        });
        const add = 1.4 * s.ease('keybias', 1.2, 1.0);
        const sc = BIAS_S.map((v) => v + add);
        const p = M.softmax(sc);
        const top = y0 + u * 12;
        const rr: Rect = s.tall ? [x0, top + u * 5, w, h * 0.26] : [x0, top + u * 6, w * 0.44, h * 0.5];
        const rp: Rect = s.tall ? [x0, top + h * 0.26 + u * 16, w, h * 0.22] : [x0 + w * 0.56, top + u * 6, w * 0.44, h * 0.5];
        s.alpha(s.ease('keybias', 0.5), () => {
          s.text(add > 0.05 ? `scores + q·b (= ${fmt(add, 2)} on every key)` : 'scores q·k', rr[0], rr[1] - u * 3, { size: Math.min(3.3, fitSize(s, 'scores + q·b (= 1.4 on every key)', rr[2], 3.3)), font: 'ui', weight: 600, align: 'left', color: s.c('purple') });
          const r2: Rect = [rr[0], rr[1], rr[2], rr[3]];
          bars(s, r2, sc.map((v) => v + 1.2), 'purple', 4.9, sc.map((v) => fmt(v, 2)));
          s.text('softmax', rp[0], rp[1] - u * 3, { size: 3.3, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
          bars(s, rp, p, 'gold', 0.6, p.map((v) => v.toFixed(2)));
        });
        s.alpha(s.ease('cancel', 0.6), () => pill(s, '✓ softmax unchanged: gradient of b is 0', x0 + w / 2, y0 + h - u * 2, 'green', { size: Math.min(3.3, fitSize(s, '✓ softmax unchanged: gradient of b is 0', w * 0.9, 3.3)) }));
      });
    }
  },
};

// ---------------------------------------------------------------- the memory wall

const flash: SceneDef = {
  draw(s) {
    const [x0, y0, w, h] = area(s);
    const u = s.u;
    const hb: Rect = s.tall ? [x0, y0, w, h * 0.6] : [x0, y0, w * 0.56, h];
    const sb: Rect = s.tall ? [x0, y0 + h * 0.68, w * 0.62, h * 0.32] : [x0 + w * 0.64, y0 + h * 0.28, w * 0.36, h * 0.42];
    const sA = s.ease('sram', 0.6);
    s.rrect(hb[0], hb[1], hb[2], hb[3], 2, { fill: s.tint('blue', 0.06), stroke: s.tint('blue', 0.6), lw: 0.4 });
    s.text('HBM', hb[0] + u * 3, hb[1] + u * 4.5, { size: 5, font: 'display', weight: 650, align: 'left', color: s.c('blue') });
    s.text('40 to 80 GB, about 2 TB/s', hb[0] + u * 3, hb[1] + u * 10, { size: 3.2, font: 'ui', align: 'left', color: s.c('--ink-2') });
    s.alpha(sA, () => {
      s.rrect(sb[0], sb[1], sb[2], sb[3], 2, { fill: s.tint('teal', 0.08), stroke: s.tint('teal', 0.7), lw: 0.4 });
      s.text('SRAM', sb[0] + u * 3, sb[1] + u * 4.5, { size: 4.6, font: 'display', weight: 650, align: 'left', color: s.c('teal') });
      const sub = 'about 200 KB per unit, ~10x faster';
      s.text(sub, sb[0] + u * 3, sb[1] + u * 9.5, { size: Math.min(3.1, fitSize(s, sub, sb[2] - u * 5, 3.1)), font: 'ui', align: 'left', color: s.c('--ink-2') });
    });
    const idle = 1 - s.ease('standard', 0.5);
    s.alpha(idle, () => {
      s.text('big, slow', hb[0] + hb[2] / 2, hb[1] + hb[3] * 0.6, { size: 5, font: 'display', italic: true, color: s.c('--ink-3') });
      s.alpha(sA, () => s.text('tiny, fast', sb[0] + sb[2] / 2, sb[1] + sb[3] * 0.72, { size: 4.2, font: 'display', italic: true, color: s.c('--ink-3') }));
    });
    s.alpha(s.win('wait', 'standard'), () => {
      const [ax0, ay0, ax1, ay1] = s.tall ? [sb[0] + sb[2] * 0.3, hb[1] + hb[3] + u * 0.5, sb[0] + sb[2] * 0.3, sb[1] - u * 0.5] : [hb[0] + hb[2] + u * 0.5, sb[1] + sb[3] / 2, sb[0] - u * 0.5, sb[1] + sb[3] / 2];
      s.arrow(ax0, ay0, ax1, ay1, s.c('red'), 0.6, 2.4);
      const t = 'the bottleneck: moving data';
      pill(s, t, s.tall ? sb[0] + sb[2] * 0.3 + u * 3 : (hb[0] + hb[2] + sb[0]) / 2 + u * 10, s.tall ? (ay0 + ay1) / 2 : sb[1] - u * 6, 'red', { size: Math.min(3.2, fitSize(s, t, w * 0.6, 3.2)), align: s.tall ? 'left' : 'center' });
    });
    // the T x T grid inside HBM
    const n = 12;
    const gs = Math.min(hb[2] - u * 8, hb[3] - u * 21);
    const gx = hb[0] + (hb[2] - gs) / 2;
    const gy = hb[1] + u * 14;
    const cs = gs / n;
    const fillS = s.since('standard') >= 0 ? clamp01(s.prog('standard') * 1.2) : 0;
    const rb = s.since('readback') >= 0 ? s.prog('readback') : 0;
    const never = s.ease('tiles', 0.8);
    s.alpha(s.ease('standard', 0.5) * (1 - never * 0.75), () => {
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const k = i * n + j;
          const on = k < fillS * n * n;
          const isP = rb > 0.45 && k < ((rb - 0.45) / 0.3) * n * n;
          s.rrect(gx + j * cs + cs * 0.08, gy + i * cs + cs * 0.08, cs * 0.84, cs * 0.84, 0.3, { fill: on ? s.tint(isP ? 'gold' : 'purple', 0.55) : s.tint('--ink-3', 0.08) });
        }
      s.text('T x T scores', gx + gs / 2, gy + gs + u * 3, { size: 3.2, font: 'ui', weight: 600, color: s.c('purple') });
    });
    // the round trips
    const trips: [string, number][] = [['write S', 0], ['read S', 0.25], ['write P', 0.45], ['read P', 0.75]];
    const tx = s.tall ? sb[0] + sb[2] + u * 4 : sb[0];
    const ty = s.tall ? sb[1] + u * 2 : sb[1] + sb[3] + u * 6;
    s.alpha(s.win('standard', 'tiles'), () => {
      trips.forEach(([lab, at], i) => {
        const a = i === 0 ? s.ease('standard', 0.4) : rb >= at ? 1 : 0;
        s.alpha(a, () => pill(s, `${i % 2 ? '←' : '→'} ${lab}`, tx, ty + i * u * 6.5, i % 2 ? 'teal' : 'blue', { size: 3.1, align: 'left' }));
      });
    });
    s.alpha(s.win('size', 'tiles'), () => {
      const t = '8,192² × 2 bytes = 128 MiB per head';
      pill(s, t, hb[0] + hb[2] / 2, gy + gs / 2, 'red', { size: Math.min(3.3, fitSize(s, t, hb[2] * 0.9, 3.3)) });
    });
    // tiles: only small blocks ever exist, in SRAM
    if (never > 0) {
      s.alpha(never, () => {
        const ti = Math.floor(Math.max(0, s.since('tiles')) * 1.5) % 9;
        const bi = Math.floor(ti / 3);
        const bj = ti % 3;
        s.rrect(gx + bj * 4 * cs, gy + bi * 4 * cs, 4 * cs, 4 * cs, 0.6, { stroke: s.c('teal'), lw: 0.6 });
        s.text('never written', gx + gs / 2, gy + gs + u * 3, { size: 3.2, italic: true, color: s.c('--ink-3'), halo: true });
        const ss = Math.min(sb[2] * 0.35, sb[3] - u * 14);
        const sx = sb[0] + sb[2] - ss - u * 3;
        const sy = sb[1] + sb[3] - ss - u * 2.5;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s.rrect(sx + (j * ss) / 4 + ss * 0.02, sy + (i * ss) / 4 + ss * 0.02, ss / 4 - ss * 0.04, ss / 4 - ss * 0.04, 0.2, { fill: s.tint('teal', 0.6) });
        s.alpha(s.win('snag', 'next'), () => {
          const ry = gy + 5 * cs;
          s.rrect(gx - u * 0.5, ry, gs + u, cs, 0.5, { stroke: s.c('red'), lw: 0.6, fill: s.tint('red', 0.12) });
          pill(s, 'max and sum: over the whole row', gx + gs / 2, ry + cs * 2.4, 'red', { size: Math.min(3.2, fitSize(s, 'max and sum: over the whole row', hb[2] * 0.85, 3.2)) });
        });
        s.alpha(s.ease('next', 0.5), () => pill(s, 'next: online softmax', s.tall ? sb[0] + sb[2] + u * 4 : sb[0] + sb[2] / 2, s.tall ? sb[1] + sb[3] / 2 : sb[1] + sb[3] + u * 8, '--accent', { size: 3.3, align: s.tall ? 'left' : 'center' }));
      });
    }
  },
};

// ---------------------------------------------------------------- online softmax

const ROW = M.toyRow(19);
const ONL = M.onlineSoftmax(ROW.S, ROW.v, 4);

const online: SceneDef = {
  draw(s) {
    const [x0, y0, w, h] = area(s);
    const u = s.u;
    const beat = current(s, ['idea', 'three', 'tile1', 'tile2', 'fix', 'add', 'tile3', 'done', 'same', 'flash', 'exact']);
    const step = beat === 'tile1' ? 1 : beat === 'tile2' || beat === 'fix' || beat === 'add' ? 2 : beat === 'tile3' || beat === 'done' || beat === 'same' || beat === 'flash' || beat === 'exact' ? 3 : 0;
    const st = step > 0 ? ONL.steps[step - 1]! : null;
    const nC = 12;
    const cw = w / nC;
    const ch = Math.min(cw * 1.05, u * 9);
    const sy = y0 + u * 8;
    const vy = sy + ch + u * 7;
    s.text('scores S', x0, sy - u * 4.5, { size: 3.3, font: 'mono', weight: 600, align: 'left', color: s.c('purple') });
    s.text('values v (one channel)', x0, vy - u * 2.4, { size: 3.1, font: 'mono', weight: 600, align: 'left', color: s.c('gold') });
    for (let t = 0; t < 3; t++) {
      const cur = t === step - 1;
      const a = t * 4;
      s.line(x0 + a * cw + u * 0.6, sy - u * 1.4, x0 + (a + 4) * cw - u * 0.6, sy - u * 1.4, cur ? s.c('--accent') : s.tint('--ink-3', t < step ? 0.8 : 0.35), cur ? 0.6 : 0.3);
    }
    const fs = Math.max(2.9, Math.min(3.6, (cw / u) * 0.3));
    ROW.S.forEach((sv, j) => {
      const inTile = st && j >= st.from && j < st.to ? 1 : 0;
      const seen = st && j < st.to;
      s.alpha(seen ? 1 : 0.45, () => {
        s.cell(x0 + j * cw + u * 0.3, sy, cw - u * 0.6, ch, fmt(sv, 2), 'purple', { on: inTile, size: fs });
        s.cell(x0 + j * cw + u * 0.3, vy, cw - u * 0.6, ch, fmt(ROW.v[j]!, 2), 'gold', { on: inTile, size: fs });
      });
    });
    // running state
    const by = vy + ch + u * 6;
    const bw = (w - u * 6) / 3;
    const bh = u * 17;
    const fixOn = beat === 'fix' ? 1 : 0;
    const cols: [string, string, string, number][] = [
      ['m  max', st ? `${Number.isFinite(st.mOld) ? fmt(st.mOld, 2) : '-inf'} → ${fmt(st.mNew, 2)}` : '-inf', st && st.corr > 0 ? `tile max ${fmt(st.tileMax, 2)}` : '', beat === 'tile2' ? 1 : 0],
      ['ℓ  sum', st ? `${fmt(st.lOld, 3)} → ${fmt(st.lNew, 3)}` : '0', st && st.corr > 0 ? `old × ${fmt(st.corr, 3)}` : '', fixOn],
      ['o  output', st ? `${fmt(st.oOld, 3)} → ${fmt(st.oNew, 3)}` : '0', st && st.corr > 0 ? `old × ${fmt(st.corr, 3)}` : '', fixOn],
    ];
    s.alpha(s.ease('three', 0.6) || (step > 0 ? 1 : 0), () => {
      cols.forEach(([t, v, note, hl], i) => {
        const x = x0 + i * (bw + u * 3);
        s.rrect(x, by, bw, bh, 1.6, { fill: s.tint(hl ? 'red' : '--ink-3', hl ? 0.1 : 0.06), stroke: hl ? s.c('red') : s.c('--rule'), lw: hl ? 0.5 : 0.3 });
        s.text(t, x + u * 2, by + u * 3.5, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
        const vs = Math.min(3.5, fitSize(s, v, bw - u * 3, 3.5, { font: 'mono' }));
        s.text(v, x + u * 2, by + u * 9, { size: vs, font: 'mono', weight: 650, align: 'left' });
        if (note) s.text(note, x + u * 2, by + u * 14, { size: Math.min(3, fitSize(s, note, bw - u * 3, 3)), font: 'ui', weight: 600, align: 'left', color: s.c('red') });
      });
    });
    s.alpha(s.win('fix', 'add'), () => {
      const t = `× e^(m − m′) = e^(${fmt(st?.mOld ?? 0, 2)} − ${fmt(st?.mNew ?? 0, 2)}) = ${fmt(st?.corr ?? 0, 3)}`;
      pill(s, t, x0 + w / 2, by + bh + u * 6, 'red', { size: Math.min(3.3, fitSize(s, t, w * 0.9, 3.3, { font: 'mono' })), mono: true });
    });
    const ry = by + bh + u * 6;
    s.alpha(s.ease('done', 0.6), () => {
      const t1 = `o / ℓ = ${ONL.online.toFixed(4)}`;
      s.text(t1, x0, ry, { size: 3.6, font: 'mono', weight: 650, align: 'left' });
      s.alpha(s.ease('same', 0.5), () => {
        const t2 = `softmax(S) @ v = ${ONL.direct.toFixed(4)}  ✓`;
        s.text(t2, s.tall ? x0 : x0 + w * 0.5, s.tall ? ry + u * 6 : ry, { size: Math.min(3.6, fitSize(s, t2, s.tall ? w : w * 0.5, 3.6, { font: 'mono' })), font: 'mono', weight: 650, align: 'left', color: s.c('green') });
      });
    });
    s.alpha(s.ease('flash', 0.6), () => {
      const py = s.tall ? ry + u * 13 : ry + u * 8;
      const tags = ['FlashAttention (2022)', 'memory: linear in T'];
      tags.forEach((t, i) => pill(s, t, x0 + w * (0.27 + 0.48 * i), py, 'purple', { size: Math.min(3.2, fitSize(s, t, w * 0.44, 3.2)) }));
      s.alpha(s.ease('exact', 0.6), () => {
        const t = 'exact · backward recomputes tiles';
        pill(s, t, x0 + w / 2, py + u * 8, 'green', { size: Math.min(3.2, fitSize(s, t, w * 0.9, 3.2)) });
      });
    });
  },
};

// ---------------------------------------------------------------- long context

const LD = 128;
const LT = 4096;
const SCALE = 4;
const TH0 = M.ropeTheta(LD, 10000);
const lw2 = (t: number) => Math.log2((2 * Math.PI) / t);
const LAM = {
  none: TH0.map(lw2),
  pi: M.scaledTheta('pi', SCALE, LD, 10000, LT).map(lw2),
  ntk: M.scaledTheta('ntk', SCALE, LD, 10000, LT).map(lw2),
  yarn: M.scaledTheta('yarn', SCALE, LD, 10000, LT).map(lw2),
};
const OVER = {
  pi: M.overshoot(TH0, M.scaledTheta('pi', SCALE, LD, 10000, LT), LT, LT * SCALE),
  ntk: M.overshoot(TH0, M.scaledTheta('ntk', SCALE, LD, 10000, LT), LT, LT * SCALE),
  yarn: M.overshoot(TH0, M.scaledTheta('yarn', SCALE, LD, 10000, LT), LT, LT * SCALE),
};

const longctx: SceneDef = {
  draw(s) {
    const [x0, y0, w, h] = area(s);
    const u = s.u;
    const winA = s.ease('window', 0.6);
    const ph = h - u * 6 - winA * (s.tall ? u * 22 : u * 18);
    const left = x0 + u * 9;
    const pw = w - u * 9;
    const top = y0 + u * 6;
    const X = (i: number) => left + ((i + 1) / 65) * pw;
    const Y = (lv: number) => top + ph - ((lv - 2) / 20) * ph;
    for (const e of [3, 6, 9, 12, 15, 18, 21]) {
      s.line(left, Y(e), x0 + w, Y(e), s.c('--grid'), 0.22);
      const lab = e >= 20 ? `${2 ** (e - 20)}M` : e >= 10 ? `${2 ** (e - 10)}K` : String(2 ** e);
      s.text(lab, x0, Y(e), { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
    }
    s.text('tokens per full turn', left, y0 + u * 2, { size: 3.2, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
    s.text('pairs: fast → slow', x0 + w, y0 + u * 2, { size: 3.2, font: 'ui', align: 'right', color: s.c('--ink-3') });
    s.line(left, Y(12), x0 + w, Y(12), s.c('green'), 0.45, [1.4, 1]);
    s.text('trained: 4K', left + u * 1, Y(12) + u * 3, { size: 3.2, font: 'ui', weight: 650, align: 'left', color: s.c('green'), halo: true });
    const newA = s.ease('unseen', 0.6);
    s.alpha(newA, () => {
      s.line(left, Y(14), x0 + w, Y(14), s.c('red'), 0.45, [1.4, 1]);
      s.text('new: 16K', left + u * 1, Y(14) - u * 2.4, { size: 3.2, font: 'ui', weight: 650, align: 'left', color: s.c('red'), halo: true });
    });
    s.alpha(s.win('why', 'breaks'), () => pill(s, 'pretrain at 4K tokens, stretch near the end', x0 + w / 2, Y(17), 'slate', { size: Math.min(3.3, fitSize(s, 'pretrain at 4K tokens, stretch near the end', w * 0.9, 3.3)) }));
    s.alpha(s.win('breaks', 'wave'), () => pill(s, 'past the trained length: the loss shoots up', x0 + w / 2, Y(17), 'red', { size: Math.min(3.3, fitSize(s, 'past the trained length: the loss shoots up', w * 0.9, 3.3)) }));
    const dotsA = s.ease('wave', 0.8) * (1 - 0.65 * s.ease('base', 0.6));
    const ePi = s.ease('pi', 1.2);
    const eNtk = s.ease('ntk', 1.2);
    const eYarn = s.ease('yarn', 1.2);
    const beat = current(s, ['wave', 'slow', 'unseen', 'pi', 'ntk', 'yarn', 'base', 'window']);
    s.alpha(dotsA, () => {
      for (let i = 0; i < 64; i++) {
        const y0v = LAM.none[i]!;
        const yv = lerp(lerp(lerp(y0v, LAM.pi[i]!, ePi), LAM.ntk[i]!, eNtk), LAM.yarn[i]!, eYarn);
        const slow = y0v > 12;
        let k: K = 'green';
        if (beat === 'unseen' && slow) k = 'red';
        else if (beat === 'pi' || beat === 'ntk' || beat === 'yarn' || beat === 'base' || beat === 'window') {
          const m = beat === 'pi' ? 'pi' : beat === 'ntk' ? 'ntk' : 'yarn';
          k = OVER[m][i]! > 1.001 ? 'red' : Math.abs(yv - y0v) > 0.05 ? 'blue' : 'green';
        }
        if (Math.abs(yv - y0v) > 0.05) s.line(X(i), Y(y0v), X(i), Y(yv), s.tint('--ink-3', 0.5), 0.2);
        if (Math.abs(yv - y0v) > 0.05) s.circle(X(i), Y(y0v), u * 0.5, { fill: s.tint('--ink-3', 0.6) });
        s.circle(X(i), Y(yv), u * (k === 'red' ? 0.95 : 0.75), { fill: s.c(k) });
        if (beat === 'slow' && slow) s.circle(X(i), Y(yv), u * 1.6, { stroke: s.c('red'), lw: 0.3 });
      }
    });
    const tagY = Y(19.5);
    const tag = (beatId: string, text: string, k: K) => s.alpha(s.win(beatId, ['pi', 'ntk', 'yarn', 'base', 'window'][['unseen', 'pi', 'ntk', 'yarn', 'base'].indexOf(beatId)] ?? 'window'), () => pill(s, text, x0 + w / 2, tagY, k, { size: Math.min(3.3, fitSize(s, text, w * 0.9, 3.3)) }));
    tag('unseen', 'red: angles never seen in training', 'red');
    tag('pi', 'PI: every speed ÷ 4, nothing unseen', 'blue');
    tag('ntk', 'NTK-aware: fast kept, slow ÷ 4, some overshoot', 'red');
    tag('yarn', 'YaRN: fast kept, never-turned pairs ÷ 4', 'green');
    s.alpha(s.win('base', 'window'), () => {
      const ts = ['Code Llama: base 1,000,000', 'Llama 3: base 500,000', 'Llama 3.1: 128K tokens'];
      ts.forEach((t, i) => pill(s, t, x0 + w / 2, Y(21) + i * u * 6.8, 'slate', { size: Math.min(3.3, fitSize(s, t, w * 0.9, 3.3)) }));
    });
    if (winA > 0) {
      s.alpha(winA, () => {
        const n = 24;
        const sy = y0 + h - (s.tall ? u * 15 : u * 12);
        const cw = w / n;
        const W = 6;
        const off = Math.floor(Math.max(0, s.since('window')) * 2.2) % (n - W + 1);
        for (let j = 0; j < n; j++) s.rrect(x0 + j * cw + cw * 0.1, sy, cw * 0.8, u * 5, 0.4, { fill: s.tint(j >= off && j < off + W ? 'teal' : '--ink-3', j >= off && j < off + W ? 0.6 : 0.15) });
        s.rrect(x0 + off * cw, sy - u * 1, W * cw, u * 7, 1, { stroke: s.c('teal'), lw: 0.5 });
        s.text('sliding window: each layer looks back W tokens', x0 + w / 2, sy + u * 10, { size: Math.min(3.3, fitSize(s, 'sliding window: each layer looks back W tokens', w, 3.3, { font: 'serif' })), italic: true, color: s.c('--ink-2') });
      });
    }
  },
};

// ---------------------------------------------------------------- outro

const RECAP: [string, string[], string][] = [
  ['r1', ['norm1', 'norm2', 'plus1', 'plus2'], 'pre-norm + RMSNorm'],
  ['r2', ['rope'], 'RoPE: relative positions'],
  ['r3', ['mlp'], 'SwiGLU: a gated MLP'],
  ['r4', ['gqa'], 'GQA: a smaller KV cache'],
  ['r5', ['qk'], 'QK-norm, no biases'],
  ['r6', ['flash'], 'FlashAttention: exact, in tiles'],
  ['r7', ['rope'], 'rescaled RoPE: longer context'],
];

const outro: SceneDef = {
  draw(s) {
    const [x0, y0, w, h] = area(s);
    const u = s.u;
    const beat = current(s, RECAP.map((r) => r[0]).concat('next'));
    const lit = (id: string) => {
      const r = RECAP.find((x) => x[0] === beat);
      if (beat === 'next') return 0.35;
      return r && r[1].includes(id) ? s.ease(beat!, 0.5) : 0;
    };
    if (s.tall) {
      const bw = Math.min(w, h * 1.2);
      drawBlock(s, [x0 + (w - bw) / 2, y0, bw, h], NEW_BLOCK, lit);
    } else {
      const bw = Math.min(w * 0.5, h * 0.95);
      drawBlock(s, [x0, y0, bw, h], NEW_BLOCK, lit);
      const lx = x0 + bw + u * 6;
      const lwid = x0 + w - lx;
      RECAP.forEach(([id, , text], i) => {
        const a = s.ease(id, 0.5);
        const on = beat === id ? 1 : 0;
        s.alpha(a, () => s.text(text, lx, y0 + u * 6 + i * u * 8.5, { size: Math.min(3.8, fitSize(s, text, lwid, 3.8)), font: 'ui', weight: on ? 700 : 500, align: 'left', color: s.c(on ? '--ink' : '--ink-2') }));
      });
    }
    s.alpha(s.ease('next', 0.6), () => {
      const t = 'next: optimizers at scale';
      pill(s, t, s.tall ? x0 + w : x0 + w * 0.75, s.tall ? y0 + u * 3 : y0 + h - u * 6, '--accent', { size: 3.6, align: s.tall ? 'right' : 'center' });
    });
  },
};

export const scenes: Record<string, SceneDef> = { intro, prenorm, rmsnorm, rope, swiglu, kvcache, gqa, stability, flash, online, longctx, outro };
