import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { catImage } from './data';
import { type K, Frame, area, bend, matTile, node, pill, pillWidth } from './kit';

/** A deterministic pseudo-random vector for token k (the reader's changing memory). */
function memVec(k: number, n = 5): number[] {
  return Array.from({ length: n }, (_, i) => Math.sin(k * 2.3 + i * 1.7) * 0.9);
}

/** The CIFAR cat, or a placeholder while it loads. */
function cat(s: Scene, x: number, y: number, size: number): void {
  const img = catImage(s);
  if (img) {
    const c = s.ctx;
    c.save();
    c.imageSmoothingEnabled = false;
    c.drawImage(img, x, y, size, size);
    c.restore();
    s.rrect(x, y, size, size, 0.6, { stroke: s.c('--rule'), lw: 0.3 });
  } else s.rrect(x, y, size, size, 0.6, { fill: s.tint('--ink-3', 0.15) });
}

// ---------------------------------------------------------------- intro

const WORDS = ['the', 'cat', 'sat', 'on', 'the', 'mat', 'and', 'then', 'it', 'slept', 'all', 'day'];
const CODE_CHARS = 'def step(h, x): return h'.split('');

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Title.
    s.alpha(s.win('hello', 'fixed'), () => {
      s.text('Recurrent networks', w / 2, h * 0.44, { size: 9, font: 'display', weight: 600 });
      s.text('networks with memory, and image captioning', w / 2, h * 0.57, { size: 4.2, italic: true, color: s.c('--ink-2') });
    });
    // A fixed-shape network: image in, ten scores out.
    s.alpha(s.win('fixed', 'world'), () => {
      const cy = h * 0.5;
      const img = Math.min(w * 0.2, h * 0.3);
      const x0 = w * 0.07;
      cat(s, x0, cy - img / 2, img);
      s.text('one image', x0 + img / 2, cy + img / 2 + u * 4, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
      const nx = w * 0.5;
      const nw = Math.min(w * 0.22, u * 26);
      const nh = img * 0.7;
      s.arrow(x0 + img + u * 2, cy, nx - nw / 2 - u * 1.5, cy, s.c('--ink-3'), 0.5);
      s.rrect(nx - nw / 2, cy - nh / 2, nw, nh, 2.5, { fill: s.tint('purple', 0.1), stroke: s.c('purple'), lw: 0.5 });
      s.text('network', nx, cy, { size: 4.4, font: 'serif', italic: true, weight: 600, color: s.c('purple') });
      const bx = nx + nw / 2 + u * 5;
      s.arrow(nx + nw / 2 + u * 1.5, cy, bx - u, cy, s.c('--ink-3'), 0.5);
      const bw = (w * 0.94 - bx) / 10;
      const sc = [0.3, 0.45, 0.2, 0.95, 0.4, 0.55, 0.25, 0.35, 0.3, 0.5];
      sc.forEach((v, i) => {
        const bh = img * 0.8 * v * smooth(s.prog('fixed') * 2.5 - i * 0.08);
        s.rrect(bx + i * bw + bw * 0.15, cy + img * 0.4 - bh, bw * 0.7, bh, 0.3, { fill: s.c(i === 3 ? 'purple' : '--ink-3') });
      });
      s.text('10 scores', bx + bw * 5, cy + img / 2 + u * 4, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
      s.text('a fixed shape', w / 2, h * 0.2, { size: 5, font: 'display', weight: 560 });
    });
    // Sequences arrive: words, frames, characters.
    const seqA = s.win('world', 'trick');
    if (seqA > 0) {
      s.alpha(seqA, () => {
        const lx = w * 0.06;
        const rowY = [h * 0.24, h * 0.47, h * 0.7];
        const names = ['words', 'frames', 'characters'];
        const ks: K[] = ['purple', 'blue', 'orange'];
        rowY.forEach((y, r) => {
          const a = s.ease('world', 0.6, r * 0.9);
          s.alpha(a, () => s.text(names[r]!, lx, y - u * 5.5, { size: 3.4, font: 'mono', color: s.c(ks[r]!), align: 'left' }));
        });
        const drift = (s.t - s.at('world')) * u * 3;
        const c = s.ctx;
        c.save();
        c.beginPath();
        c.rect(lx, 0, w - 2 * lx, h);
        c.clip();
        // words: four at first, then the sentence keeps growing
        s.alpha(s.ease('world', 0.6), () => {
          const n = s.since('length') >= 0 ? Math.min(WORDS.length, 4 + Math.floor(s.prog('length') * 9)) : 4;
          let x = lx;
          for (let i = 0; i < n; i++) {
            const pw = pillWidth(s, WORDS[i]!, 3.6);
            const a = i < 4 ? 1 : smooth((s.prog('length') * 9 - (i - 4)) * 2);
            s.alpha(a, () => pill(s, WORDS[i]!, x, rowY[0]!, 'purple', { align: 'left' }));
            x += pw + u * 1.2;
          }
        });
        // frames: a ball crossing a small film strip
        s.alpha(s.ease('world', 0.6, 0.9), () => {
          const fw = u * 11;
          for (let i = 0; i < 9; i++) {
            const x = lx + i * (fw + u * 1.5) - (drift % (fw + u * 1.5));
            const y = rowY[1]! - u * 4;
            s.rrect(x, y, fw, u * 8, 0.8, { fill: s.tint('blue', 0.08), stroke: s.tint('blue', 0.5), lw: 0.25 });
            const k = i + Math.floor(drift / (fw + u * 1.5));
            s.circle(x + fw * (0.2 + 0.6 * ((k % 5) / 4)), y + u * (2 + 4 * Math.abs(Math.sin(k * 0.9))), u * 1.1, { fill: s.c('blue') });
          }
        });
        // characters of a program
        s.alpha(s.ease('world', 0.6, 1.8), () => {
          const cw = u * 5.4;
          CODE_CHARS.forEach((ch, i) => {
            const x = lx + i * (cw + u * 0.5);
            if (x > w) return;
            s.cell(x, rowY[2]! - u * 3, cw, u * 6, ch === ' ' ? '␣' : ch, 'orange', { size: 3.4 });
          });
        });
        c.restore();
        s.alpha(s.ease('length', 0.6, 0.4), () => s.text('any length: 4 words, or 40', w / 2, h * 0.9, { size: 4, italic: true, color: s.c('--ink-2') }));
      });
    }
    // The recurrent reader: tokens go in one at a time, the memory changes.
    const rA = s.win('trick', 'karpathy');
    if (rA > 0) {
      s.alpha(rA, () => {
        const cx = w * 0.36;
        const cy = h * 0.5;
        const sz = Math.min(u * 17, h * 0.18);
        const t0 = s.at('trick') + 0.6;
        const per = 1.3;
        const tt = s.t - t0;
        const k = Math.max(0, Math.floor(tt / per));
        const ph = tt < 0 ? 0 : (tt % per) / per;
        // conveyor of words from the left into x
        const xY = cy + sz * 1.45;
        s.line(cx + sz * 0.9, xY, w * 0.95, xY, s.tint('--ink-3', 0.5), 0.3, [1, 1]);
        node(s, cx, xY, sz * 0.7, 'x', 'orange');
        s.arrow(cx, xY - sz * 0.4, cx, cy + sz * 0.55, s.c('orange'), 0.5);
        for (let j = 0; j < 4; j++) {
          const idx = k + j;
          const word = WORDS[idx % WORDS.length]!;
          const pos = j - ph;
          const x = cx + sz * 0.9 + u * 4 + pos * u * 15;
          if (tt < 0 && j === 0) continue;
          const a = clamp01(pos + 0.6) * clamp01((w * 0.96 - x - pillWidth(s, word, 3.3)) / (u * 4));
          if (x > cx + sz * 0.6 && a > 0) s.alpha(a, () => pill(s, word, x, xY, 'purple', { align: 'left', size: 3.3 }));
        }
        // memory: h with its vector, changing as each word lands
        const lit = tt > 0 && ph > 0.75 ? 1 - (ph - 0.75) * 4 : 0;
        node(s, cx, cy, sz, 'h', 'green', { on: lit });
        const vals = memVec(tt > 0 ? k + (ph > 0.8 ? 1 : 0) : 0);
        const cw = u * 3.4;
        vals.forEach((v, i) => {
          const x = cx + sz * 0.75 + u * 2;
          const y = cy - (vals.length * cw) / 2 + i * cw;
          s.rrect(x, y + cw * 0.08, cw * 1.6, cw * 0.84, 0.5, { fill: v >= 0 ? s.tint('green', 0.1 + 0.5 * Math.abs(v)) : s.tint('slate', 0.1 + 0.4 * Math.abs(v)), stroke: s.tint('green', 0.5), lw: 0.2 });
        });
        s.text('hidden state', cx + sz * 0.75 + u * 3.6 + cw * 1.6, cy, { size: 3.2, font: 'mono', color: s.c('--ink-3'), align: 'left' });
        // the loop back into itself, with the shared weights
        const la = s.ease('trick', 0.6, 0.3);
        s.alpha(la, () => {
          bend(s, cx - sz * 0.35, cy - sz * 0.5, cx - sz * 1.8, cy - sz * 1.9, cx - sz * 0.5, cy - sz * 0.05, s.tint('green', 0.8), 0.45, undefined, 2.2);
        });
        s.alpha(s.ease('same', 0.6), () => pill(s, 'same W, every step', cx - sz * 0.5, cy - sz * 2.05, 'blue', { size: 3.3 }));
        // the answer, read off the memory
        s.alpha(s.ease('same', 0.6, 2.6), () => {
          const yy = cy - sz * 1.5;
          s.arrow(cx + sz * 0.15, cy - sz * 0.55, cx + sz * 0.6, yy + sz * 0.4, s.c('purple'), 0.5);
          node(s, cx + sz * 0.85, yy, sz * 0.7, 'y', 'purple');
          s.text('an answer', cx + sz * 1.35, yy, { size: 3.2, font: 'mono', color: s.c('--ink-3'), align: 'left' });
        });
      });
    }
    // The source.
    s.alpha(s.win('karpathy', 'plan'), () => {
      const cw = Math.min(w * 0.8, u * 90);
      const ch = h * 0.5;
      const x = (w - cw) / 2;
      const y = h * 0.25;
      s.rrect(x, y, cw, ch, 2.5, { fill: s.tint('--ink-3', 0.06), stroke: s.c('--rule'), lw: 0.3 });
      s.text('CS231n · Lecture 10 · 2016', w / 2, y + ch * 0.2, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
      s.text('Andrej Karpathy', w / 2, y + ch * 0.42, { size: 6.5, font: 'display', weight: 600 });
      s.alpha(s.ease('karpathy', 0.6, 2.2), () => pill(s, 'min-char-rnn.py · 112 lines', w / 2, y + ch * 0.72, 'orange', { font: 'mono', size: 3.6 }));
    });
    // The plan: four stops.
    const pA = s.ease('plan', 0.6);
    if (pA > 0) {
      const tiles: [string, string, Color][] = [
        ['write Shakespeare', 'sample, feed back', 'purple'],
        ['why it forgets', 'vanishing gradients', 'teal'],
        ['the LSTM', 'a gradient highway', 'gold'],
        ['caption photos', 'ConvNet + RNN', 'orange'],
      ];
      const [rx, ry, rw, rh] = area(s, 0.14, 6);
      const gap = u * 3;
      const tw = (rw - gap) / 2;
      const th = Math.min((rh - gap) / 2, tw * 0.55);
      const oy = ry + (rh - 2 * th - gap) / 2;
      const p = s.prog('plan');
      tiles.forEach(([t1, t2, k], i) => {
        const a = s.ease('plan', 0.5, 0.3 + i * 0.25);
        const x = rx + (i % 2) * (tw + gap);
        const y = oy + Math.floor(i / 2) * (th + gap);
        const on = clamp01(1 - Math.abs(p * 4.4 - i - 0.6) * 1.5);
        s.alpha(a, () => {
          s.rrect(x, y, tw, th, 2.2, { fill: s.tint(k, 0.08 + 0.2 * on), stroke: s.tint(k, 0.4 + 0.6 * on), lw: 0.3 + 0.3 * on });
          const fs = Math.min(5, (tw / s.u) * 0.12);
          s.text(t1, x + tw / 2, y + th * 0.42, { size: fs, font: 'display', weight: 560 });
          s.text(t2, x + tw / 2, y + th * 0.7, { size: fs * 0.72, font: 'mono', color: s.c(k) });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- shapes

interface Shape {
  name: string;
  ex: string;
  ins: string[];
  outs: string[];
  fb: boolean;
}

const BLANK4 = ['', '', '', ''];
const SHAPES: Record<string, Shape> = {
  cols: { name: '', ex: '', ins: BLANK4, outs: BLANK4, fb: false },
  one: { name: 'one to one', ex: 'image classification', ins: ['image'], outs: ['"cat"'], fb: false },
  cap: { name: 'one to many', ex: 'image captioning', ins: ['image', '', '', ''], outs: ['a', 'cat', 'on', 'grass'], fb: true },
  sent: { name: 'many to one', ex: 'sentiment', ins: ['so', 'much', 'fun', '!'], outs: ['', '', '', 'happy'], fb: false },
  mt: { name: 'many to many', ex: 'machine translation', ins: ['the', 'black', 'cat', '', '', ''], outs: ['', '', '', 'le', 'chat', 'noir'], fb: true },
  vid: { name: 'many to many, in step', ex: 'labeling video frames', ins: ['frame', 'frame', 'frame', 'frame'], outs: ['walk', 'walk', 'jump', 'land'], fb: false },
};

/** One shape's columns: x at the bottom, h in the middle, y on top. `cur` dims later columns. */
function drawShape(s: Scene, sh: Shape, cur: number, o: { rows?: number[]; arrowsOn?: number; labels?: number }): void {
  const { w, h, u } = s;
  const n = sh.ins.length;
  const gutter = o.labels ? Math.min(w * 0.2, u * 22) : 0;
  const colW = Math.min(u * 22, (w - u * 10 - gutter) / n);
  const x0 = gutter + (w - gutter - colW * n) / 2;
  const bs = Math.min(colW * 0.56, h * 0.13, u * 13);
  const rowY = [h * 0.36, h * 0.59, h * 0.82];
  const lit = s.c('--accent');
  const dim = s.tint('--ink-3', 0.8);
  const rows = o.rows ?? [0, 0, 0];
  if (o.labels) {
    s.alpha(o.labels, () => {
      (['output', 'memory', 'input'] as const).forEach((t, r) => s.text(t, x0 - u * 3, rowY[r]!, { size: 3.4, font: 'mono', color: s.c((['purple', 'green', 'orange'] as const)[r]), align: 'right' }));
    });
  }
  for (let c = 0; c < n; c++) {
    const cx = x0 + colW * (c + 0.5);
    const now = c === cur;
    s.alpha(c > cur ? 0.22 : 1, () => {
      if (c > 0) {
        const on = Math.max(now ? 1 : 0, o.arrowsOn ?? 0);
        s.arrow(cx - colW + bs / 2 + u, rowY[1]!, cx - bs / 2 - u, rowY[1]!, on ? lit : dim, 0.35 + 0.3 * on);
        s.alpha(o.arrowsOn ?? 0, () => s.text('W', cx - colW / 2, rowY[1]! - u * 3.4, { size: 3.6, font: 'mono', weight: 650, color: s.c('blue'), halo: true }));
      }
      const fb = sh.fb && c > 0 && sh.outs[c - 1] && !sh.ins[c];
      if (sh.ins[c] !== undefined && (sh.ins[c] || sh === SHAPES.cols || sh === SHAPES.vid)) {
        node(s, cx, rowY[2]!, bs, 'x', 'orange', { on: Math.max(now ? 0.6 : 0, rows[2]!) });
        s.arrow(cx, rowY[2]! - bs / 2 - u * 0.4, cx, rowY[1]! + bs / 2 + u * 0.6, now ? lit : dim, now ? 0.6 : 0.35);
        if (sh.ins[c]) s.text(sh.ins[c]!, cx, rowY[2]! + bs / 2 + u * 3.6, { size: 3.4, color: s.c('--ink-2') });
      }
      node(s, cx, rowY[1]!, bs, 'h', 'green', { on: Math.max(now ? 0.6 : 0, rows[1]!) });
      if (sh.outs[c] || sh === SHAPES.cols) {
        node(s, cx, rowY[0]!, bs, 'y', 'purple', { on: Math.max(now ? 0.6 : 0, rows[0]!) });
        s.arrow(cx, rowY[1]! - bs / 2 - u * 0.4, cx, rowY[0]! + bs / 2 + u * 0.6, now ? lit : dim, now ? 0.6 : 0.35);
        if (sh.outs[c]) s.text(sh.outs[c]!, cx, rowY[0]! - bs / 2 - u * 3.2, { size: 3.6, weight: 600 });
      }
      if (fb) {
        const px = cx - colW + bs / 2;
        bend(s, px, rowY[0]! + bs * 0.25, cx - bs * 0.2, rowY[0]! + bs * 0.4, cx - bs * 0.32, rowY[1]! - bs / 2 - u * 0.6, now ? lit : dim, now ? 0.45 : 0.3, [1, 1], 1.8);
      }
    });
  }
}

const SHAPE_BEATS = ['one', 'cap', 'sent', 'mt', 'vid'] as const;

/** A house-number plate read by a moving glimpse window. */
function glimpses(s: Scene, x: number, y: number, pw: number, ph: number, p: number): void {
  const u = s.u;
  s.rrect(x, y, pw, ph, 1.5, { fill: '#8a4b38', stroke: s.c('--rule'), lw: 0.3 });
  s.rrect(x + pw * 0.12, y + ph * 0.2, pw * 0.76, ph * 0.6, 1, { fill: '#f1ead8' });
  s.text('247', x + pw / 2, y + ph * 0.52, { size: (ph / u) * 0.42, font: 'display', weight: 700, color: '#2a2a2a' });
  const path = [
    [0.25, 0.35],
    [0.3, 0.6],
    [0.5, 0.35],
    [0.5, 0.62],
    [0.72, 0.38],
    [0.72, 0.62],
  ];
  const k = Math.min(path.length - 1, Math.floor(p * path.length));
  const f = clamp01(p * path.length - k);
  const [ax, ay] = path[k]!;
  const [bx, by] = path[Math.min(path.length - 1, k + 1)]!;
  const m = smooth((f - 0.6) / 0.4);
  const gx = x + pw * lerp(ax!, bx!, m);
  const gy = y + ph * lerp(ay!, by!, m);
  const gs = ph * 0.34;
  s.rrect(gx - gs / 2, gy - gs / 2, gs, gs, 0.6, { stroke: s.c('--accent'), lw: 0.6 });
  s.text(`glimpse ${k + 1}`, x + pw / 2, y + ph + u * 4, { size: 3.3, font: 'mono', color: s.c('--ink-3') });
}

/** A digit painted in patches, as a canvas filled over many steps. */
function painting(s: Scene, x: number, y: number, sz: number, p: number): void {
  const u = s.u;
  s.rrect(x, y, sz, sz, 1.2, { fill: s.tint('--ink-3', 0.06), stroke: s.c('--rule'), lw: 0.3 });
  const pts = [
    [0.32, 0.22],
    [0.55, 0.18],
    [0.7, 0.3],
    [0.6, 0.46],
    [0.45, 0.5],
    [0.65, 0.6],
    [0.68, 0.76],
    [0.5, 0.86],
    [0.3, 0.8],
  ];
  const n = Math.floor(p * (pts.length + 0.99));
  const c = s.ctx;
  c.save();
  c.beginPath();
  for (let i = 0; i < Math.min(n, pts.length); i++) {
    const [px, py] = pts[i]!;
    c.moveTo(x + sz * px! + sz * 0.17, y + sz * py!);
    c.arc(x + sz * px!, y + sz * py!, sz * 0.17, 0, Math.PI * 2);
  }
  c.clip();
  s.text('3', x + sz / 2, y + sz * 0.54, { size: (sz / u) * 0.9, font: 'display', weight: 700, color: s.c('--ink') });
  c.restore();
  s.text(`step ${Math.min(n, pts.length)}`, x + sz / 2, y + sz + u * 4, { size: 3.3, font: 'mono', color: s.c('--ink-3') });
}

const shapes: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // The generic grid, then each named shape in turn, cross-faded.
    const gA = 1 - s.ease('one', 0.5);
    if (gA > 0) {
      const p = s.prog('cols');
      const band = (a: number, b: number) => smooth((p - a) * 8) * (1 - smooth((p - b) * 8));
      const rows = s.since('arrows') >= 0 ? [0, 0, 0] : [band(0.62, 2), band(0.32, 0.62), band(0, 0.32)];
      s.alpha(gA, () => drawShape(s, SHAPES.cols!, 99, { rows, arrowsOn: s.ease('arrows', 0.6), labels: 1 }));
    }
    const endA = 1 - s.ease('glimpse', 0.5);
    SHAPE_BEATS.forEach((id, i) => {
      const next = SHAPE_BEATS[i + 1];
      const a = s.ease(id, 0.5) * (next ? 1 - s.ease(next, 0.5) : endA);
      if (a <= 0) return;
      const sh = SHAPES[id]!;
      const n = sh.ins.length;
      const cur = Math.min(n - 1, Math.floor(clamp01(s.prog(id) * 1.15) * n));
      s.alpha(a, () => {
        drawShape(s, sh, cur, {});
        s.text(sh.name, w / 2, h * 0.11, { size: 5.2, font: 'display', weight: 600 });
        s.text(sh.ex, w / 2, h * 0.18, { size: 3.8, italic: true, color: s.c('--ink-2') });
      });
    });
    // Fixed-size inputs, worked on in steps.
    const fA = s.ease('glimpse', 0.6);
    if (fA > 0) {
      s.alpha(fA, () => {
        const p = s.prog('glimpse');
        const pw = Math.min(w * 0.42, h * 0.62);
        const ph = pw * 0.62;
        const gx = w * 0.27 - pw / 2;
        const gy = h * 0.5 - ph / 2;
        s.text('read in glimpses', w * 0.27, gy - u * 5, { size: 3.8, italic: true, color: s.c('--ink-2') });
        glimpses(s, gx, gy, pw, ph, clamp01(p / 0.55));
        const sz = Math.min(w * 0.3, h * 0.42);
        const px = w * 0.74 - sz / 2;
        const py = h * 0.5 - sz / 2;
        s.alpha(s.ease('glimpse', 0.6) * smooth((p - 0.5) * 6), () => {
          s.text('paint in strokes', w * 0.74, py - u * 5, { size: 3.8, italic: true, color: s.c('--ink-2') });
          painting(s, px, py, sz, clamp01((p - 0.58) / 0.38));
        });
      });
    }
  },
};

// ---------------------------------------------------------------- recurrence

const recurrence: SceneDef = {
  marks: {
    rec: { tex: String.raw`\symh_t = f_W\big(\symh_{t-1},\, \symx_t\big)`, x: 0.5, y: 0.15, size: 6.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const foldA = 1 - s.ease('unroll', 0.7);
    s.show('rec', foldA);
    const cx = w / 2;
    const cy = h * 0.52;
    const bw = Math.min(w * 0.28, u * 32);
    const bh = Math.min(h * 0.2, u * 20);
    const ns = Math.min(u * 12, h * 0.13);
    const hx0 = cx - bw / 2 - ns * 1.6;
    const hx1 = cx + bw / 2 + ns * 1.6;
    const accA = s.win('acc', 'learn');
    // The folded cell.
    s.alpha(foldA * (1 - accA), () => {
      const readOn = s.since('read') >= 0 && s.since('f') < 0 ? 0.6 + 0.4 * Math.sin(s.since('read') * 5) : 0;
      const fOn = s.since('f') >= 0 && s.since('same') < 0 ? 1 : 0;
      node(s, hx0, cy, ns, 'h', 'green', { on: readOn });
      s.text('old', hx0, cy + ns * 0.5 + u * 3.4, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      node(s, cx, cy + bh / 2 + ns * 1.1, ns, 'x', 'orange', { on: readOn });
      s.text('new input', cx + ns * 0.6 + u * 1.5, cy + bh / 2 + ns * 1.1, { size: 3.2, font: 'mono', color: s.c('--ink-3'), align: 'left' });
      s.arrow(hx0 + ns / 2 + u, cy, cx - bw / 2 - u, cy, s.c('green'), 0.5);
      s.arrow(cx, cy + bh / 2 + ns * 0.6 - u * 0.5, cx, cy + bh / 2 + u, s.c('orange'), 0.5);
      s.rrect(cx - bw / 2, cy - bh / 2, bw, bh, 2.5, { fill: s.tint('blue', 0.08 + 0.15 * fOn), stroke: s.tint('blue', 0.6 + 0.4 * fOn), lw: 0.4 + 0.3 * fOn });
      // learned weights appear inside f
      const lw = s.ease('learn', 0.8, 0.6);
      s.text('f', cx - (lw > 0 ? bw * 0.22 : 0) * lw, cy, { size: (bh / u) * 0.45, font: 'serif', italic: true, weight: 600, color: s.c('blue') });
      s.text('W', cx + u * 2.5 - (lw > 0 ? bw * 0.22 : 0) * lw, cy + bh * 0.2, { size: (bh / u) * 0.2, font: 'serif', italic: true, weight: 600, color: s.c('blue') });
      s.alpha(lw, () => {
        const gs = bh * 0.11;
        for (let i = 0; i < 5; i++)
          for (let j = 0; j < 5; j++) {
            const v = Math.sin(i * 3.1 + j * 1.7) * 0.5 + 0.5;
            s.rrect(cx + bw * 0.06 + j * gs * 1.15, cy - gs * 2.9 + i * gs * 1.15, gs, gs, 0.2, { fill: s.tint('blue', 0.15 + 0.6 * v) });
          }
      });
      const outA = s.ease('f', 0.6, 0.4);
      s.alpha(outA, () => {
        s.arrow(cx + bw / 2 + u, cy, hx1 - ns / 2 - u, cy, s.c('green'), 0.5);
        node(s, hx1, cy, ns, 'h', 'green', { on: fOn });
        s.text('new', hx1, cy + ns * 0.5 + u * 3.4, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      });
      // the new memory becomes the old one, step after step
      const sA = s.ease('same', 0.6);
      s.alpha(sA, () => {
        bend(s, hx1, cy - ns / 2 - u, cx, cy - bh * 1.7, hx0, cy - ns / 2 - u, s.tint('green', 0.85), 0.45, [1.2, 1]);
        const k = 1 + Math.floor(Math.max(0, s.since('same')) / 0.9);
        s.alpha(1 - s.ease('acc', 0.4), () => s.text(`step t = ${k}`, cx, cy - bh * 1.22, { size: 3.6, font: 'mono', color: s.c('--ink-2') }));
      });
    });
    // The same shape, as a running total.
    s.alpha(foldA * accA, () => {
      const nums = [3, 1, 4, 2];
      const k = Math.min(nums.length, Math.floor(Math.max(0, s.since('acc') - 0.5) / 1.2) + 1);
      const tot = nums.slice(0, k).reduce((a, b) => a + b, 0);
      s.rrect(cx - bw / 2, cy - bh / 2, bw, bh, 2.5, { fill: s.tint('slate', 0.08), stroke: s.c('slate'), lw: 0.4 });
      s.text('+', cx, cy, { size: (bh / u) * 0.5, weight: 600, color: s.c('slate') });
      s.cell(hx0 - ns * 0.6, cy - ns / 2, ns * 1.2, ns, String(tot - (nums[k - 1] ?? 0)), 'slate', { size: 4 });
      s.text('total', hx0, cy + ns * 0.5 + u * 3.4, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      s.arrow(hx0 + ns * 0.6 + u, cy, cx - bw / 2 - u, cy, s.c('slate'), 0.5);
      s.arrow(cx + bw / 2 + u, cy, hx1 - ns * 0.6 - u, cy, s.c('slate'), 0.5);
      s.cell(hx1 - ns * 0.6, cy - ns / 2, ns * 1.2, ns, String(tot), 'slate', { size: 4, on: 1 });
      s.cell(cx - ns * 0.6, cy + bh / 2 + ns * 0.6, ns * 1.2, ns, String(nums[k - 1] ?? ''), 'orange', { size: 4 });
      s.arrow(cx, cy + bh / 2 + ns * 0.6 - u * 0.5, cx, cy + bh / 2 + u, s.c('orange'), 0.5);
      bend(s, hx1, cy - ns / 2 - u, cx, cy - bh * 1.7, hx0, cy - ns / 2 - u, s.tint('slate', 0.85), 0.45, [1.2, 1]);
      s.text(`total = total + x`, cx, cy - bh * 1.22, { size: 3.6, font: 'mono', color: s.c('--ink-2') });
    });
    // Unrolled: three copies of f sharing W.
    const uA = s.ease('unroll', 0.7);
    if (uA > 0) {
      s.alpha(uA, () => {
        const xs = [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92].map((f) => w * f);
        const y = h * 0.5;
        const fs = Math.min(w * 0.1, u * 12);
        const nsz = Math.min(fs * 0.85, u * 10);
        const spread = smooth(s.prog('unroll') * 2);
        const deep = s.since('deep') >= 0 ? 0.5 + 0.5 * Math.sin(s.since('deep') * 4) : 0;
        for (let i = 0; i < 4; i++) {
          const x = lerp(w / 2, xs[i * 2]!, spread);
          node(s, x, y, nsz, 'h', 'green');
          s.text(String(i), x + nsz * 0.36, y + nsz * 0.28, { size: 2.6, font: 'mono', color: s.c('green') });
        }
        for (let i = 0; i < 3; i++) {
          const x = lerp(w / 2, xs[i * 2 + 1]!, spread);
          s.arrow(x - (xs[1]! - xs[0]!) + nsz / 2 + u * 0.5, y, x - fs / 2 - u * 0.5, y, s.c('green'), 0.4);
          s.arrow(x + fs / 2 + u * 0.5, y, x + (xs[1]! - xs[0]!) - nsz / 2 - u * 0.5, y, s.c('green'), 0.4);
          s.rrect(x - fs / 2, y - fs / 2, fs, fs, 1.5, { fill: s.tint('blue', 0.1), stroke: s.c('blue'), lw: 0.35 });
          s.text('f', x, y, { size: (fs / u) * 0.45, font: 'serif', italic: true, weight: 600, color: s.c('blue') });
          node(s, x, y + fs * 1.5, nsz * 0.85, 'x', 'orange');
          s.arrow(x, y + fs * 1.5 - nsz * 0.45, x, y + fs / 2 + u * 0.5, s.c('orange'), 0.4);
          pill(s, 'W', x, y - fs * 1.05, 'blue', { size: 3.2, font: 'mono', on: deep });
          // gradients from every copy, added into one
          s.alpha(s.ease('grad', 0.6, 0.3 + i * 0.3), () => {
            s.arrow(x, y - fs * 1.05 - u * 3, lerp(x, w / 2, 0.75), h * 0.2 + u * 3, s.c('teal'), 0.45);
            s.text(`dW${i + 1}`, lerp(x, w / 2, 0.42) + (i - 1) * u * 3, lerp(y - fs * 1.05, h * 0.2, 0.5) - u, { size: 3, font: 'mono', color: s.c('teal'), halo: true });
          });
        }
        s.alpha(s.ease('deep', 0.6), () => s.text('one layer per step, one set of weights', w / 2, h * 0.86, { size: 3.6, italic: true, color: s.c('--ink-2') }));
        s.alpha(s.ease('grad', 0.6, 1.2), () => pill(s, 'dW = dW1 + dW2 + dW3', w / 2, h * 0.17, 'teal', { font: 'mono', size: 3.6 }));
      });
    }
  },
};

// ---------------------------------------------------------------- vanilla

const vanilla: SceneDef = {
  marks: {
    van: { tex: String.raw`\symh_t = \tanh\big(\symWhh\,\symh_{t-1} + \symWxh\,\symx_t\big)`, x: 0.5, y: 0.1, size: 5 },
    out: { tex: String.raw`\symy_t = \symWhy\,\symh_t`, x: 0.5, y: 0.2, size: 5 },
    slope: { tex: String.raw`\text{slope} = 1 - \tanh^2 z`, x: 0.68, y: 0.7, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const dA = 1 - s.ease('curve', 0.6);
    s.show('van', dA + s.win('shared', undefined));
    s.show('out', dA * s.ease('why', 0.6));
    if (dA > 0) {
      s.alpha(dA, () => {
        const r1 = h * 0.42;
        const r2 = h * 0.76;
        const ns = Math.min(u * 11, h * 0.12);
        const ts = Math.min(u * 12, h * 0.13);
        const X = (f: number) => w * f;
        const order = ['whh', 'wxh', 'squash', 'why', 'curve'];
        const on = (id: string) => s.win(id, order[order.indexOf(id) + 1], 0.4);
        const flow = (id: string, x0: number, y0: number, x1: number, y1: number) => {
          const p = s.prog(id);
          if (p > 0 && p < 1) s.circle(lerp(x0, x1, smooth(p * 1.3)), lerp(y0, y1, smooth(p * 1.3)), u * 1, { fill: s.c('--accent') });
        };
        const lineCol = (k: K, a: number) => (a > 0.05 ? s.c('--accent') : s.tint(k, 0.7));
        // old memory -> Whh -> +
        node(s, X(0.09), r1, ns, 'h', 'green', { on: on('whh') });
        s.text('old memory', X(0.09), r1 - ns / 2 - u * 3, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
        s.arrow(X(0.09) + ns / 2 + u, r1, X(0.28) - ts / 2 - u, r1, lineCol('green', on('whh')), 0.45);
        matTile(s, X(0.28), r1, ts, 'Whh', { on: on('whh') });
        s.arrow(X(0.28) + ts / 2 + u, r1, X(0.47) - u * 4, r1, lineCol('blue', on('whh')), 0.45);
        flow('whh', X(0.09), r1, X(0.47), r1);
        // input -> Wxh -> up into +
        node(s, X(0.09), r2, ns, 'x', 'orange', { on: on('wxh') });
        s.text('input', X(0.09), r2 + ns / 2 + u * 3.2, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
        s.arrow(X(0.09) + ns / 2 + u, r2, X(0.28) - ts / 2 - u, r2, lineCol('orange', on('wxh')), 0.45);
        matTile(s, X(0.28), r2, ts, 'Wxh', { on: on('wxh') });
        s.line(X(0.28) + ts / 2 + u, r2, X(0.47), r2, lineCol('blue', on('wxh')), 0.45);
        s.arrow(X(0.47), r2, X(0.47), r1 + u * 4, lineCol('blue', on('wxh')), 0.45);
        flow('wxh', X(0.09), r2, X(0.47), r2);
        // + and the bias
        const pOn = on('wxh') * s.ease('wxh', 0.5, 2.2);
        s.circle(X(0.47), r1, u * 3.4, { fill: s.c('--card'), stroke: pOn > 0.05 ? s.c('--accent') : s.c('--ink-3'), lw: 0.4 + 0.3 * pOn });
        s.text('+', X(0.47), r1 + u * 0.2, { size: 5, weight: 600, color: s.c('--ink-2') });
        s.alpha(s.ease('wxh', 0.5, 2.2), () => s.text('+ bh', X(0.47), r1 - u * 6.5, { size: 3.2, font: 'mono', color: s.c('green'), halo: true }));
        // tanh
        const tOn = on('squash');
        s.arrow(X(0.47) + u * 3.6, r1, X(0.66) - ts * 0.6 - u, r1, lineCol('--ink-3', tOn), 0.45);
        s.rrect(X(0.66) - ts * 0.6, r1 - ts / 2, ts * 1.2, ts, 1.2, { fill: s.c('--card'), stroke: tOn > 0.05 ? s.c('--accent') : s.c('--ink-3'), lw: 0.35 + 0.3 * tOn });
        {
          const c = s.ctx;
          c.beginPath();
          for (let i = 0; i <= 30; i++) {
            const z = -3 + (6 * i) / 30;
            const px = X(0.66) - ts * 0.45 + (ts * 0.9 * i) / 30;
            const py = r1 - Math.tanh(z) * ts * 0.32;
            if (i) c.lineTo(px, py);
            else c.moveTo(px, py);
          }
          c.strokeStyle = s.c('green');
          c.lineWidth = u * 0.45;
          c.stroke();
        }
        s.text('tanh', X(0.66), r1 + ts / 2 + u * 3, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
        flow('squash', X(0.47), r1, X(0.87), r1);
        // new memory
        s.arrow(X(0.66) + ts * 0.6 + u, r1, X(0.88) - ns / 2 - u, r1, lineCol('green', tOn), 0.45);
        node(s, X(0.88), r1, ns, 'h', 'green', { on: tOn });
        s.text('new memory', X(0.88), r1 - ns / 2 - u * 3, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
        s.alpha(s.ease('squash', 0.5, 1) * (1 - s.ease('why', 0.4)), () => s.text('-1 … 1', X(0.88), r1 + ns / 2 + u * 3, { size: 3, font: 'mono', color: s.c('green') }));
        // Why -> scores
        const yOn = on('why');
        s.alpha(s.ease('why', 0.6), () => {
          const ym = (r1 + r2) / 2 + u;
          s.arrow(X(0.88), r1 + ns / 2 + u, X(0.88), ym - ts / 2 - u, lineCol('green', yOn), 0.45);
          matTile(s, X(0.88), ym, ts * 0.85, 'Why', { on: yOn });
          s.arrow(X(0.88), ym + ts * 0.42 + u, X(0.88), r2 - ns / 2 - u, lineCol('blue', yOn), 0.45);
          node(s, X(0.88), r2, ns, 'y', 'purple', { on: yOn });
          s.text('scores', X(0.88) - ns / 2 - u * 1.5, r2, { size: 3.1, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        });
      });
    }
    // tanh up close.
    const cA = s.win('curve', 'shared');
    if (cA > 0) {
      s.alpha(cA, () => {
        const fr = new Frame(s, area(s, 0.12, 7), [-4.2, 4.2, -1.35, 1.35]);
        fr.axes(1, 1, 0.5);
        for (const v of [-1, 1]) s.text(String(v), fr.X(-4.2) - u * 1, fr.Y(v), { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        s.line(fr.X(-4.2), fr.Y(1), fr.X(4.2), fr.Y(1), s.tint('green', 0.35), 0.25, [1, 1]);
        s.line(fr.X(-4.2), fr.Y(-1), fr.X(4.2), fr.Y(-1), s.tint('green', 0.35), 0.25, [1, 1]);
        const grow = s.ease('curve', 1.4, 0.3);
        fr.fn(Math.tanh, s.c('green'), 0.8, -4.2, -4.2 + 8.4 * grow);
        s.text('tanh z', fr.X(2.6), fr.Y(0.72), { size: 3.8, font: 'mono', color: s.c('green') });
        const sl = s.ease('slope', 0.6);
        s.alpha(sl, () => {
          fr.fn((z) => 1 - Math.tanh(z) ** 2, s.c('teal'), 0.5, -4.2, 4.2, [1.2, 1]);
          const p = s.prog('slope');
          const z0 = lerp(-3, 3, smooth(clamp01(p * 1.25)));
          const th = Math.tanh(z0);
          const m = 1 - th * th;
          s.line(fr.X(z0 - 1), fr.Y(th - m), fr.X(z0 + 1), fr.Y(th + m), s.c('--accent'), 0.4);
          s.circle(fr.X(z0), fr.Y(th), u * 1.2, { fill: s.c('--accent') });
          pill(s, `slope at the dot: ${m.toFixed(2)}`, fr.X(-4.2) + u * 2, fr.Y(1.18), '--accent', { font: 'mono', size: 3.2, align: 'left' });
          s.show('slope', sl * cA);
        });
        const flat = s.ease('slope', 0.8, (s.end('slope') - s.at('slope')) * 0.62);
        s.alpha(flat, () => {
          for (const [a, b] of [[-4.2, -2.2], [2.2, 4.2]] as const) {
            s.rrect(fr.X(a), fr.Y(1.3), fr.X(b) - fr.X(a), fr.Y(-1.3) - fr.Y(1.3), 0.5, { fill: s.tint('red', 0.08) });
            s.text('flat', (fr.X(a) + fr.X(b)) / 2, fr.Y(a < 0 ? -0.4 : 0.4), { size: 3.4, font: 'mono', color: s.c('red') });
          }
        });
      });
    }
    // Whh, shared by every step.
    const shA = s.ease('shared', 0.6);
    if (shA > 0) {
      s.alpha(shA, () => {
        const n = 5;
        const ns = Math.min(u * 11, h * 0.12);
        const xs = Array.from({ length: n }, (_, i) => w * (0.1 + (0.8 * i) / (n - 1)));
        const y = h * 0.52;
        const pulse = 0.5 + 0.5 * Math.sin(s.since('shared') * 4);
        xs.forEach((x, i) => {
          node(s, x, y, ns, 'h', 'green');
          node(s, x, y + ns * 1.9, ns * 0.8, 'x', 'orange');
          s.arrow(x, y + ns * 1.5, x, y + ns / 2 + u * 0.6, s.c('orange'), 0.4);
          if (i) {
            s.arrow(xs[i - 1]! + ns / 2 + u, y, x - ns / 2 - u, y, s.c('blue'), 0.45);
            pill(s, 'Whh', (xs[i - 1]! + x) / 2, y - ns * 0.95, 'blue', { size: 3, font: 'mono', on: pulse });
          }
        });
        s.text('one matrix, every step', w / 2, h * 0.86, { size: 3.8, italic: true, color: s.c('--ink-2') });
      });
    }
  },
};

export const scenesA: Record<string, SceneDef> = { intro, shapes, recurrence, vanilla };
