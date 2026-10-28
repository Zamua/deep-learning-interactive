import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { after } from '../../networks/draw';
import { box, links, rich, type Ink } from '../draw';

const SRC = ['je', 'suis', 'étudiant'];
const OUT = ['I', 'am', 'a', 'student'];
const SUB = ['₀', '₁', '₂'];
/** The encoder states and the decoder's state q, in two dimensions so they can be drawn. */
const H = [
  [2, 1],
  [0, 2],
  [1, -1],
];
const Q = [1, 0];
const E = H.map((h) => h[0]! * Q[0]! + h[1]! * Q[1]!);
/** The attention weights as spoken, rounded: the softmax of E. */
const A = [0.67, 0.09, 0.24];
const AH = H.map((h, j) => h.map((v) => v * A[j]!));
const CTX = [0, 1].map((k) => AH.reduce((t, v) => t + v[k]!, 0));
const f2 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2)).replace('-', '−');
const vec = (v: number[]) => `[${v.map(f2).join(', ')}]`;

/** Weights for each output word over the input words: each row adds up to 1. */
const GRID = [
  [0.67, 0.09, 0.24],
  [0.1, 0.8, 0.1],
  [0.15, 0.6, 0.25],
  [0.05, 0.1, 0.85],
];

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.4, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });
const caption = (s: Scene, t: string, y: number, k: Ink = '--ink-2', size = 3.4) => mono(s, t, s.w / 2, y, k, size, 'center', 500);

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

// ---- the bottleneck: a whole sentence through one fixed-size vector

/** The encoder above, the decoder below: x positions and rows. */
function chains(s: Scene) {
  return { ex: columns(s, 3, 26), dx: columns(s, 4, 21), ye: s.h * 0.27, yv: s.h * 0.5, yd: s.h * 0.74 };
}

function decoderRow(s: Scene, dx: number[], yd: number, on: number[] = []) {
  dx.forEach((x, i) => box(s, x, yd, '', 'blue', { w: 10, h: 8, on: on[i] ?? 0 }));
  links(s, dx, yd, 6);
  OUT.forEach((t, i) => mono(s, t, dx[i]!, yd + 9 * s.u, 'blue', 3.4));
}

const squeeze: SceneDef = {
  draw(s) {
    const u = s.u;
    const { ex, dx, ye, yv, yd } = chains(s);
    const lng = s.win('long', 'bahdanau');
    const look = after(s, 'bahdanau', 0.66, 0.8);
    const keep = s.ease('keep', 0.6, 1.5);
    // The sentence and the encoder's states: three words, or a long sentence.
    s.alpha(1 - lng, () => {
      SRC.forEach((t, j) => mono(s, t, ex[j]!, s.h * 0.14, 'orange', 3.4));
      ex.forEach((x, j) => {
        box(s, x, ye, '', 'gold', { w: 12, h: 9, on: look });
        s.alpha(keep, () => mono(s, `h${SUB[j]}`, x, ye + 0.2 * u, 'gold', 3.6, 'center', 650));
      });
      links(s, ex, ye, 7);
    });
    const LONG = columns(s, 14, 6.4);
    s.alpha(lng, () => {
      LONG.forEach((x) => box(s, x, ye, '', 'gold', { w: 4.6, h: 6 }));
      mono(s, '… a sentence of 50 words …', s.w / 2, s.h * 0.14, 'orange', 3.2, 'center', 500);
    });
    // Everything funnels into one vector of a fixed size, which starts the decoder.
    s.alpha((1 - look) * s.ease('recall', 0.6, 3), () => {
      const half = lerp(ex[2]! - ex[0]! + 14 * u, LONG[13]! - LONG[0]! + 6 * u, lng) / 2;
      const g = s.ctx;
      g.beginPath();
      g.moveTo(s.w / 2 - half, ye + 5.5 * u);
      g.lineTo(s.w / 2 + half, ye + 5.5 * u);
      g.lineTo(s.w / 2 + 12 * u, yv - 4 * u);
      g.lineTo(s.w / 2 - 12 * u, yv - 4 * u);
      g.closePath();
      g.fillStyle = s.tint('slate', 0.13);
      g.fill();
      [0, 1, 2, 3].forEach((i) => s.cell(s.w / 2 + (i - 2) * 5.6 * u + 0.3 * u, yv - 3 * u, 5 * u, 6 * u, '', 'gold', { on: 0.6 }));
      mono(s, 'one vector', s.w / 2 - 14 * u, yv, '--ink-2', 3.2, 'right', 500);
      s.arrow(s.w / 2, yv + 3.5 * u, dx[0]!, yd - 5 * u, s.c('--ink-3'), 0.4, 2);
    });
    s.alpha(s.ease('recall', 0.6, 5), () => decoderRow(s, dx, yd, [look]));
    // Looking back: a line from the decoder to every encoder state.
    s.alpha(look * (1 - lng), () => ex.forEach((x) => s.line(dx[0]!, yd - 4.5 * u, x, ye + 5 * u, s.tint('teal', 0.85), 0.45)));
    cite(s, 'Bahdanau, Cho & Bengio, 2014', s.ease('bahdanau', 0.6));
    const cy = s.h * 0.93;
    s.alpha(s.win('recall', 'long') * s.ease('recall', 0.6, 3), () => caption(s, 'the whole input passes through one vector', cy));
    s.alpha(lng, () => caption(s, '3 words or 50: the same 4 numbers', cy, 'gold'));
    s.alpha(s.ease('bahdanau', 0.6) * (1 - look), () => caption(s, 'the fixed-length vector: a bottleneck', cy, 'gold'));
    s.alpha(look * (1 - s.ease('keep', 0.6)), () => caption(s, 'look back at every encoder state', cy, 'teal'));
    s.alpha(keep, () => caption(s, 'hⱼ: the state after word j', cy, 'gold'));
  },
};

// ---- the plane: the states and q as arrows, scored by how far each reaches along q

const BOX = { x0: -0.6, x1: 2.7, y0: -1.5, y1: 2.5 };

function plane(s: Scene, frac = 0.6) {
  const u = s.u;
  const right = s.w * frac;
  const k = Math.min((right - 8 * u) / (BOX.x1 - BOX.x0), (s.h - 20 * u) / (BOX.y1 - BOX.y0));
  const ox = 5 * u - BOX.x0 * k;
  const oy = 6 * u + BOX.y1 * k;
  const P = (x: number, y: number): [number, number] => [ox + x * k, oy - y * k];
  s.line(...P(BOX.x0, 0), ...P(BOX.x1, 0), s.c('--axis'), 0.3);
  s.line(...P(0, BOX.y0), ...P(0, BOX.y1), s.c('--axis'), 0.3);
  return { P, k, right };
}

/** Where each state's label sits, beside its arrow's tip. */
const TIP: [number, number][] = [
  [2.08, 1.2],
  [0.14, 2.15],
  [1.12, -1.18],
];

function stateLabel(s: Scene, P: (x: number, y: number) => [number, number], j: number, weight = 0) {
  const runs: [string, Ink][] = [[`h${SUB[j]}`, 'gold'], [` ${SRC[j]}`, 'orange']];
  if (weight > 0.003) runs.push([` × ${f2(A[j]!)}`, 'teal']);
  rich(s, runs, ...P(TIP[j]![0], TIP[j]![1]), { size: 3.3, weight: 650, align: 'left' });
}

/** The right-hand column: the scores in a row, then the weights as bars. */
function weights(s: Scene, right: number, o: { head: number; sc: number; w: number; grow: number; lit?: number[] }) {
  const u = s.u;
  const gap = Math.min(12 * u, (s.w - right - 8 * u) / 3);
  const cx = (right + s.w - 4 * u) / 2 + 1 * u;
  const xs = [-1, 0, 1].map((k) => cx + k * gap);
  const lab = xs[0]! - gap / 2 - 1 * u;
  s.alpha(o.head, () => xs.forEach((x, j) => mono(s, `h${SUB[j]}`, x, s.h * 0.14, 'gold', 3.2)));
  s.alpha(o.sc, () => {
    rowLabel(s, 's', lab, s.h * 0.24, 'purple', 3.8);
    cells(s, xs, s.h * 0.24, E.map(String), 'purple', { w: 9, h: 7, on: o.lit ?? [] });
  });
  s.alpha(o.w, () => {
    mono(s, 'softmax ↓', cx, s.h * 0.33, '--ink-3', 3, 'center', 500);
    rowLabel(s, 'α', lab, s.h * 0.7, 'teal', 3.8);
    bars(s, xs, s.h * 0.76, A, 'teal', { max: 1, height: 36, w: 8, fmt: f2, grow: o.grow });
    xs.forEach((x, j) => mono(s, SRC[j]!, x, s.h * 0.8, 'orange', 2.8, 'center', 500));
  });
}

const look: SceneDef = {
  draw(s) {
    const u = s.u;
    const { P, right } = plane(s);
    const al = s.ease('alpha', 0.8, 1);
    // The encoder states, then q, then each state's reach along q.
    s.alpha(s.ease('need', 0.6), () =>
      H.forEach((h, j) => {
        const lw = lerp(0.6 + 0.25 * s.win('arrows', 'q'), 0.2 + 1.4 * A[j]!, al);
        s.arrow(...P(0, 0), ...P(h[0]!, h[1]!), s.c('gold'), lw, 2.6);
        stateLabel(s, P, j);
      }),
    );
    s.alpha(s.ease('q', 0.6, 0.5), () => {
      s.arrow(...P(0, 0), ...P(Q[0]!, Q[1]!), s.c('teal'), 0.9, 2.8);
      mono(s, 'q', ...P(0.5, -0.24), 'teal', 3.8, 'center', 700);
    });
    const order = [0, 2, 1];
    const reach = order.map((_, n) => after(s, 'score', 0.7 + 0.08 * n));
    order.forEach((j, n) =>
      s.alpha(reach[n]! * (1 - 0.6 * s.ease('weights', 0.6)), () => {
        const h = H[j]!;
        if (h[1] !== 0 && E[j] !== 0) s.line(...P(h[0]!, h[1]!), ...P(E[j]!, 0), s.tint('purple', 0.9), 0.35, [1, 1]);
        s.circle(...P(E[j]!, 0), 1.2 * u, { fill: s.c('purple') });
        const at: [number, number] = E[j] === 2 ? [2, -0.28] : E[j] === 1 ? [1.2, 0.24] : [-0.24, -0.28];
        mono(s, String(E[j]), ...P(at[0], at[1]), 'purple', 3.6, 'center', 700);
      }),
    );
    weights(s, right, { head: s.ease('sj', 0.6), sc: s.ease('sj', 0.6, 0.4), w: s.ease('weights', 0.6), grow: s.ease('weights', 1, 0.4), lit: [s.win('sj', 'luong'), 0, 0] });
    cite(s, 'Luong, Pham & Manning, 2015', s.win('luong', 'weights'));
    cite(s, 'Bahdanau, Cho & Bengio, 2014', s.ease('alpha', 0.6));
    const cy = s.h * 0.92;
    s.alpha(s.win('need', 'arrows'), () => caption(s, 'to write I, the decoder needs je most', cy));
    s.alpha(s.win('arrows', 'q'), () => caption(s, 'each state: an arrow (here, 2 numbers)', cy, 'gold'));
    s.alpha(s.win('q', 'score'), () => caption(s, 'q: what the decoder is looking for', cy, 'teal'));
    s.alpha(s.win('score', 'sj'), () => caption(s, 'score: how far each reaches along q', cy, 'purple'));
    s.alpha(s.win('sj', 'weights'), () => rich(s, [['sⱼ', 'purple'], [' = ', '--ink-2'], ['q', 'teal'], [' · ', '--ink-2'], ['hⱼ', 'gold']], s.w / 2, cy, { size: 4, weight: 650 }));
    s.alpha(s.win('weights', 'alpha'), () => caption(s, 'softmax: positive, adding up to 1', cy, 'teal'));
    s.alpha(s.ease('alpha', 0.6), () => caption(s, 'αⱼ: how much attention hⱼ gets', cy, 'teal'));
  },
};

// ---- the blend: shrink each arrow by its weight, then lay them tip to tail

const mix: SceneDef = {
  draw(s) {
    const u = s.u;
    const { P } = plane(s, 0.72);
    const shrink = s.ease('blend', 1.6, 2.5);
    const chain = s.ease('add', 1.4, 0.6);
    // Ghosts of the full states, under the shrinking arrows.
    H.forEach((h, j) => {
      s.alpha(shrink, () => s.line(...P(0, 0), ...P(h[0]!, h[1]!), s.tint('gold', 0.35), 0.3, [1.2, 1.2]));
      stateLabel(s, P, j, 1);
    });
    // Each arrow's start slides to the previous one's tip as they line up.
    let at = [0, 0];
    AH.forEach((ah, j) => {
      const h = H[j]!;
      const v = [lerp(h[0]!, ah[0]!, shrink), lerp(h[1]!, ah[1]!, shrink)];
      const o = [at[0]! * chain, at[1]! * chain];
      const hiJe = j === 0 ? s.win('scale', 'add') : 0;
      s.arrow(...P(o[0]!, o[1]!), ...P(o[0]! + v[0]!, o[1]! + v[1]!), s.c('gold'), 0.6 + 0.4 * hiJe, 2.2);
      at = [at[0]! + ah[0]!, at[1]! + ah[1]!];
    });
    s.alpha(s.win('scale', 'add'), () => mono(s, vec(AH[0]!), ...P(AH[0]![0]! - 0.1, AH[0]![1]! + 0.3), 'gold', 3.2, 'right'));
    // The sum: the context vector.
    const sum = s.ease('add', 0.6, 3);
    s.alpha(sum, () => {
      s.arrow(...P(0, 0), ...P(CTX[0]!, CTX[1]!), s.c('green'), 0.9, 3);
      mono(s, vec(CTX), ...P(CTX[0]! + 0.2, CTX[1]! + 0.06), 'green', 3.2, 'left');
    });
    s.alpha(s.ease('context', 0.6, 0.4), () => mono(s, 'context vector', ...P(CTX[0]! + 0.2, CTX[1]! - 0.24), 'green', 3.2, 'left', 650));
    const cy = s.h * 0.92;
    s.alpha(s.win('blend', 'scale') * s.ease('blend', 0.6, 2.5), () => caption(s, 'shrink each hⱼ by its αⱼ', cy, 'gold'));
    s.alpha(s.win('scale', 'add'), () => caption(s, '0.67 × [2, 1] = [1.34, 0.67]', cy, 'gold', 3.6));
    s.alpha(s.win('add', 'context'), () => caption(s, 'add tip to tail: [1.58, 0.61]', cy, 'green', 3.6));
    s.alpha(s.win('context', 'use'), () => rich(s, [['context = Σ ', '--ink-2'], ['αⱼ', 'teal'], [' ', '--ink-2'], ['hⱼ', 'gold']], s.w / 2, cy, { size: 4, weight: 650 }));
    s.alpha(s.ease('use', 0.6), () => rich(s, [['decoder state + context vector → ', '--ink-2'], ['I', 'blue']], s.w / 2, cy, { size: 3.2, weight: 600 }));
  },
};

// ---- every step: the decoder looks again, and the weights stack into a grid

/** Which output step the decoder is on during `again`, eased between steps. */
function stepAt(s: Scene): number {
  const p = s.prog('again');
  const marks = [0.12, 0.62, 0.84];
  return marks.reduce((k, m) => k + smooth((p - m) / 0.06), 0);
}

const every: SceneDef = {
  draw(s) {
    const u = s.u;
    const g = s.ease('grid', 0.8);
    // The decoder at one step, with a line to every encoder state, as thick as its weight.
    s.alpha(1 - g, () => {
      const ex = columns(s, 3, 26);
      const dx = columns(s, 4, 21);
      const ye = s.h * 0.24;
      const yd = s.h * 0.62;
      const t = stepAt(s);
      const i = Math.min(3, Math.floor(t));
      const f = t - i;
      const w = GRID[i]!.map((v, j) => (i < 3 ? lerp(v, GRID[i + 1]![j]!, f) : v));
      const x0 = i < 3 ? lerp(dx[i]!, dx[i + 1]!, f) : dx[3]!;
      SRC.forEach((tok, j) => mono(s, tok, ex[j]!, s.h * 0.11, 'orange', 3.4));
      ex.forEach((x, j) => {
        s.line(x0, yd - 4 * u, x, ye + 4.5 * u, s.tint('teal', 0.25 + 0.75 * w[j]!), 0.15 + 1.6 * w[j]!);
        box(s, x, ye, `h${SUB[j]}`, 'gold', { w: 12, h: 9, on: w[j]! });
        mono(s, f2(w[j]!), x + 9 * u, ye + 6 * u, 'teal', 3, 'left');
      });
      links(s, ex, ye, 7);
      decoderRow(s, dx, yd, dx.map((_, k) => Math.max(0, 1 - Math.abs(t - k))));
    });
    // The grid: one row per output word, one column per input word.
    s.alpha(g, () => {
      const xs = columns(s, 3, 17).map((x) => x + 6 * u);
      const y0 = s.h * 0.22;
      const pitch = 11 * u;
      SRC.forEach((t, j) => mono(s, t, xs[j]!, y0 - 9 * u, 'orange', 3.2));
      GRID.forEach((r, i) =>
        s.alpha(s.ease('grid', 0.5, 0.4 + 0.5 * i), () => {
          const y = y0 + i * pitch;
          mono(s, OUT[i]!, xs[0]! - 10 * u, y, 'blue', 3.2, 'right');
          r.forEach((v, j) => {
            const x = xs[j]! - 7.5 * u;
            s.rrect(x, y - 4.5 * u, 15 * u, 9 * u, 1.2, { fill: s.tint('teal', 0.08 + 0.75 * v), stroke: s.tint('teal', 0.5), lw: 0.3 });
            s.text(v.toFixed(2), xs[j]!, y + 0.2 * u, { size: 3, font: 'mono', weight: 600, color: s.c(v > 0.5 ? '--card' : '--ink-2') });
          });
        }),
      );
      s.alpha(s.ease('grid', 0.6, 3), () => caption(s, 'each row: one output word, adding up to 1', s.h * 0.74));
    });
    cite(s, 'Bahdanau, Cho & Bengio, 2014', s.win('grid', 'free'));
    s.alpha(s.win('again', 'grid'), () => caption(s, 'a fresh look at every step', s.h * 0.84, 'teal'));
    s.alpha(s.ease('free', 0.6), () => caption(s, 'every step reads every input state', s.h * 0.84, 'teal', 3.6));
  },
};

export const scenes: Record<string, SceneDef> = { squeeze, look, mix, every };
