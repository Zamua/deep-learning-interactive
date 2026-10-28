import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { columns } from '../../draw';
import { after } from '../../networks/draw';
import { brace, type Ink, mini, rich, slab, sub, vtext } from '../draw';

const RAD = Math.PI / 180;
const SUB = ['₀', '₁', '₂'];
const f2 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2)).replace('-', '−');
const softmax = (e: number[]) => {
  const x = e.map(Math.exp);
  const t = x.reduce((a, b) => a + b, 0);
  return x.map((v) => v / t);
};
const dot = (a: number[], b: number[]) => a.reduce((t, v, i) => t + v * b[i]!, 0);
const matvec = (M: number[][], x: number[]) => M.map((r) => dot(r, x));

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.4, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });
const caption = (s: Scene, t: string, y: number, k: Ink = '--ink-2', size = 3.4) => mono(s, t, s.w / 2, y, k, size, 'center', 500);

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

type P = (x: number, y: number) => [number, number];

/** A plane for data in [x0, x1] by [y0, y1], fitted into a screen box and centered in it, with its axes. */
function plane(s: Scene, d: { x0: number; x1: number; y0: number; y1: number }, box: { l: number; t: number; r: number; b: number }, axes = 1): P {
  const k = Math.min((box.r - box.l) / (d.x1 - d.x0), (box.b - box.t) / (d.y1 - d.y0));
  const ox = (box.l + box.r) / 2 - ((d.x0 + d.x1) / 2) * k;
  const oy = (box.t + box.b) / 2 + ((d.y0 + d.y1) / 2) * k;
  const p: P = (x, y) => [ox + x * k, oy - y * k];
  s.alpha(axes, () => {
    s.line(...p(d.x0, 0), ...p(d.x1, 0), s.c('--axis'), 0.3);
    s.line(...p(0, d.y0), ...p(0, d.y1), s.c('--axis'), 0.3);
  });
  return p;
}

// ---- jobs: in attention over the encoder, one arrow is both scored and handed over

const SRC = ['je', 'suis', 'étudiant'];
const H = [
  [2, 1],
  [0, 2],
  [1, -1],
];
const Q0 = [1, 0];
/** Where each state's label sits, beside its arrow's tip. */
const TIP: [number, number][] = [
  [2.08, 1.2],
  [0.14, 2.15],
  [1.12, -1.18],
];
/** The attention weights as rnn-attention speaks them: the softmax of [2, 0, 1], rounded. */
const A = [0.67, 0.09, 0.24];
const JOB = ['next word', 'be scored', 'hand over'];
const JOBK: Ink[] = ['blue', 'purple', 'gold'];

const jobs: SceneDef = {
  draw(s) {
    const u = s.u;
    const P = plane(s, { x0: -0.6, x1: 2.9, y0: -1.5, y1: 2.5 }, { l: 6 * u, t: 7 * u, r: s.w - 6 * u, b: s.h * 0.84 });
    const blend = s.win('blend', 'tug');
    const dim = 1 - 0.97 * s.ease('daniluk', 0.8);
    // suis turns toward q, from straight up to 50 degrees.
    const turn = s.ease('tug', 2, 2.2);
    const phi = lerp(90, 50, turn);
    const states = H.map((h, j) => (j === 1 ? [2 * Math.cos(phi * RAD), 2 * Math.sin(phi * RAD)] : h));
    const E = states.map((h) => dot(h, Q0));
    s.alpha(dim, () => {
      // The states, full length, dimmed to ghosts while the blend is on screen.
      s.alpha(s.ease('recall', 0.6), () =>
        states.forEach((h, j) => {
          s.alpha(1 - 0.7 * blend, () => s.arrow(...P(0, 0), ...P(h[0]!, h[1]!), s.c('gold'), 0.6 + 0.3 * (j === 1 ? turn : 0), 2.6));
          const tip: [number, number] = j === 1 ? [h[0]! + 0.12, h[1]! + 0.16] : TIP[j]!;
          rich(s, [[`h${SUB[j]}`, 'gold'], [` ${SRC[j]}`, 'orange']], ...P(...tip), { size: 3.3, weight: 650, align: 'left', halo: true });
        }),
      );
      // The original suis, left behind as a ghost once it turns.
      s.alpha(turn, () => s.line(...P(0, 0), ...P(0, 2), s.tint('gold', 0.6), 0.3, [1.2, 1.2]));
      s.alpha(s.ease('recall', 0.6, 0.8), () => {
        s.arrow(...P(0, 0), ...P(Q0[0]!, Q0[1]!), s.c('teal'), 0.9, 2.8);
        mono(s, 'q', ...P(0.55, -0.26), 'teal', 3.8, 'center', 700);
      });
      // Each state's reach along q: its score.
      s.alpha(after(s, 'recall', 0.55) * (1 - 0.8 * blend), () =>
        states.forEach((h, j) => {
          if (Math.abs(h[1]!) > 0.01) s.line(...P(h[0]!, h[1]!), ...P(E[j]!, 0), s.tint('purple', 0.9), 0.35, [1, 1]);
          s.circle(...P(E[j]!, 0), 1.2 * u, { fill: s.c('purple') });
          const at: [number, number] = j === 0 ? [2, -0.3] : j === 2 ? [1.12, 0.26] : turn > 0.01 ? [E[j]!, -0.3] : [-0.24, -0.3];
          mono(s, j === 1 ? E[j]!.toFixed(turn > 0.01 ? 1 : 0) : String(E[j]), ...P(...at), 'purple', 3.6, 'center', 700);
        }),
      );
      // The blend: each arrow shrunk by its weight, laid tip to tail into the context.
      s.alpha(blend, () => {
        const shrink = s.ease('blend', 1.4, 1.2);
        const chain = s.ease('blend', 1.2, 2.8);
        let at = [0, 0];
        states.forEach((h, j) => {
          const v = h.map((c) => lerp(c, c * A[j]!, shrink));
          const o = at.map((c) => c * chain);
          s.arrow(...P(o[0]!, o[1]!), ...P(o[0]! + v[0]!, o[1]! + v[1]!), s.c('gold'), 0.7, 2.2);
          at = [at[0]! + h[0]! * A[j]!, at[1]! + h[1]! * A[j]!];
        });
        s.alpha(s.ease('blend', 0.6, 3.6), () => {
          s.arrow(...P(0, 0), ...P(at[0]!, at[1]!), s.c('green'), 0.9, 3);
          mono(s, `context ${vtext(at, 2)}`, ...P(at[0]! + 0.12, at[1]! + 0.3), 'green', 3.2, 'left', 650);
        });
      });
    });
    // One vector, three jobs; then one vector per job.
    s.alpha(s.ease('daniluk', 0.8, 0.4), () => {
      const xs = columns(s, 3, s.tall ? 34 : 40);
      const yb = s.h * 0.32;
      const yj = s.h * 0.62;
      const split = after(s, 'daniluk', 0.76, 0.9);
      xs.forEach((x, j) => {
        const bx = lerp(s.w / 2, x, split);
        s.line(bx, yb + 4 * u, x, yj - 3.5 * u, s.tint(JOBK[j]!, 0.8), 0.4);
        mono(s, JOB[j]!, x, yj, JOBK[j]!, 3.2);
      });
      xs.forEach((x, j) => {
        const bx = lerp(s.w / 2, x, split);
        const k: Ink = split > 0.5 ? JOBK[j]! : 'slate';
        s.cell(bx - 11 * u, yb - 4 * u, 22 * u, 8 * u, '', k, { on: 0.4 });
      });
      s.alpha(1 - split, () => mono(s, 'one vector', s.w / 2, yb + 0.2 * u, 'slate', 3.2));
      s.alpha(split, () => xs.forEach((x, j) => mono(s, 'its own', x, yb + 0.2 * u, JOBK[j]!, 3)));
    });
    cite(s, 'Daniluk, Rocktäschel, Welbl & Riedel, 2017', s.ease('daniluk', 0.6));
    const cy = s.h * 0.93;
    s.alpha(s.win('recall', 'blend') * s.ease('recall', 0.6, 1), () => caption(s, 'score: how far each state reaches along q', cy, 'purple'));
    s.alpha(s.win('blend', 'tug') * s.ease('blend', 0.6, 3.6), () => caption(s, 'the same arrows, shrunk and added', cy, 'gold'));
    s.alpha(s.win('tug', 'clash') * turn, () => caption(s, 'its score rises, and what it gives turns', cy, '--ink-2'));
    s.alpha(s.win('clash', 'daniluk'), () => caption(s, 'easy to find is not what to hand over', cy, 'red'));
    s.alpha(after(s, 'daniluk', 0.78), () => caption(s, 'one vector per job', cy, '--ink-2'));
  },
};

// ---- lookup: a dictionary pairs keys with values; attention matches every key a little

const WORDS = ['cats', 'like', 'fish'];
const KEYS = [
  [1, 2],
  [2, 0],
  [-1, 1],
];
const VALS = [
  [2, 0],
  [0, 2],
  [1, 1],
];
const QF = [0, 1];
const EF = KEYS.map((k) => dot(QF, k));
const AF = softmax(EF);
const OUT = [0, 1].map((c) => VALS.reduce((t, v, j) => t + AF[j]! * v[c]!, 0));

const lookup: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const qx = cx - (s.tall ? 36 : 46) * u;
    const kx = cx - (s.tall ? 9 : 13) * u;
    const vx = cx + (s.tall ? 21 : 25) * u;
    const ys = [0.38, 0.52, 0.66].map((f) => s.h * f);
    const CW = 17 * u;
    const CH = 8 * u;
    const soft = s.ease('soft', 0.8);
    const exact = s.ease('exact', 0.6) * (1 - soft);
    const names = s.ease('names', 0.6);
    const hy = s.h * 0.23;
    // Column heads, then what each does.
    mono(s, 'keys', kx, hy, 'purple', 3.6, 'center', 650);
    mono(s, 'values', vx, hy, 'gold', 3.6, 'center', 650);
    s.alpha(s.ease('exact', 0.6), () => {
      s.alpha(1 - names, () => mono(s, 'ask for', qx, hy, 'teal', 3.4, 'center', 600));
      s.alpha(names, () => mono(s, 'query', qx, hy, 'teal', 3.6, 'center', 650));
    });
    s.alpha(names, () => {
      const y = hy + 5 * u;
      mono(s, 'asks', qx, y, '--ink-3', 3, 'center', 500);
      mono(s, 'matched', kx, y, '--ink-3', 3, 'center', 500);
      mono(s, 'returned', vx, y, '--ink-3', 3, 'center', 500);
    });
    // The query: a word to ask for, then a vector.
    s.alpha(s.ease('exact', 0.6), () => {
      const lw = AF.map((a, j) => lerp(j === 0 ? 1.1 : 0.2, 0.15 + 1.6 * a, soft));
      ys.forEach((y, j) => s.line(qx + 8 * u, ys[1]!, kx - CW / 2, y, s.tint('teal', lerp(j === 0 ? 0.95 : 0.35, 0.3 + 0.7 * AF[j]!, soft)), lw[j]!));
      s.cell(qx - 8 * u, ys[1]! - CH / 2, 16 * u, CH, '', 'teal', { on: 0.6 });
      s.alpha(1 - soft, () => mono(s, '\'cats\'', qx, ys[1]! + 0.2 * u, 'teal', 3.2));
      s.alpha(soft, () => mono(s, vtext(QF), qx, ys[1]! + 0.2 * u, 'teal', 3.2));
    });
    // The table: each key beside its value.
    s.alpha(s.ease('dict', 0.6), () =>
      ys.forEach((y, j) => {
        const on = j === 0 ? exact : 0;
        const w = soft * AF[j]!;
        s.cell(kx - CW / 2, y - CH / 2, CW, CH, '', 'purple', { on: Math.max(on, w) });
        s.alpha(1 - soft, () => mono(s, `'${WORDS[j]}'`, kx, y + 0.2 * u, 'purple', 3.2));
        s.alpha(soft, () => mono(s, vtext(KEYS[j]!), kx, y + 0.2 * u, 'purple', 3.2));
        mono(s, ':', (kx + vx) / 2, y, '--ink-3', 3.6);
        s.cell(vx - CW / 2, y - CH / 2, CW, CH, '', 'gold', { on: Math.max(on, w) });
        mono(s, vtext(VALS[j]!), vx, y + 0.2 * u, 'gold', 3.2);
        s.alpha(soft * s.ease('soft', 0.6, 2), () => mono(s, `× ${f2(AF[j]!)}`, vx + CW / 2 + 2 * u, y, 'teal', 3, 'left', 600));
      }),
    );
    const oy = s.h * 0.8;
    s.alpha(exact * s.ease('exact', 0.6, 2), () => rich(s, [['table[\'cats\']', '--ink-2'], [' → ', '--ink-3'], ['[2, 0]', 'gold']], cx, oy, { size: 3.6, weight: 650 }));
    s.alpha(s.ease('soft', 0.6, 4), () => rich(s, [['a blend of all: ', '--ink-2'], [vtext(OUT, 2), 'green']], cx, oy, { size: 3.6, weight: 650 }));
    cite(s, 'Attention Is All You Need · Vaswani et al., 2017', s.ease('vaswani', 0.6));
    const cy = s.h * 0.93;
    s.alpha(s.win('dict', 'exact') * s.ease('dict', 0.6, 2), () => caption(s, 'a key to look up by, a value to get back', cy));
    s.alpha(s.win('exact', 'names') * s.ease('exact', 0.6, 3), () => caption(s, 'exact: one key matches, one value comes back', cy));
    s.alpha(s.win('soft', 'vaswani') * s.ease('soft', 0.6, 2), () => caption(s, 'soft: every key matches a little', cy, 'teal'));
    s.alpha(s.ease('vaswani', 0.6), () => caption(s, 'query + key-value pairs → weighted sum of values', cy, '--ink-2', s.tall ? 3 : 3.4));
  },
};

// ---- make: three matrices turn one token into its query, key and value

const X = [2, 1];
const MAPS: { sub: string; M: number[][]; k: Ink; name: string; beat: string }[] = [
  { sub: 'Q', M: [[1, 1], [0, 1]], k: 'teal', name: 'q', beat: 'q' },
  { sub: 'K', M: [[1, -1], [0, -1]], k: 'purple', name: 'k', beat: 'k' },
  { sub: 'V', M: [[-1, 1], [1, 0]], k: 'gold', name: 'v', beat: 'v' },
];
const OUTS = MAPS.map((m) => matvec(m.M, X));
const NEXT = ['k', 'v', 'rows'];

/** W times x = out, as a small matrix, two columns and the result, centered on (x, y). */
function product(s: Scene, x: number, y: number, m: (typeof MAPS)[number], lit: number[]) {
  const u = s.u;
  const box = mini(s, x - 12 * u, y, m.M.map((r) => r.map((v) => String(v).replace('-', '−'))), 'blue', { w: 7, h: 6.5, pitch: 8, on: (i) => lit[i]! });
  sub(s, 'W', m.sub, box.l - 1.6 * u, y, { k: 'blue', align: 'right', size: 3.8 });
  mini(s, x + 1 * u, y, X.map((v) => [v]), 'orange', { w: 7, h: 6.5, on: () => Math.max(...lit) });
  mono(s, '=', x + 8 * u, y, '--ink-3', 3.8);
  const out = matvec(m.M, X);
  mini(s, x + 15 * u, y, out.map((v) => [String(v).replace('-', '−')]), m.k, { w: 7, h: 6.5, on: (i) => lit[i]! });
  mono(s, m.name, x + 21 * u, y, m.k, 4, 'left', 700);
}

/** W_Q followed by `rest`, centered on x as one line. */
function named(s: Scene, rest: string, x: number, y: number) {
  const o = { size: 3.6, font: 'mono' as const, weight: 650 };
  const wr = s.measure(rest, o);
  const l = x - (s.measure('WQ', o) + wr) / 2;
  const w = sub(s, 'W', 'Q', l, y, { k: 'blue', align: 'left', size: 3.6 });
  s.text(rest, l + w, y, { ...o, align: 'left', color: s.c('--ink-2') });
}

const make: SceneDef = {
  draw(s) {
    const u = s.u;
    const shape = s.ease('rows', 0.8);
    const tall = s.tall || s.w / s.h < 1.45;
    const pbox = tall ? { l: 6 * u, t: 4 * u, r: s.w - 6 * u, b: s.h * 0.6 } : { l: 4 * u, t: 6 * u, r: s.w * 0.55, b: s.h - 8 * u };
    s.alpha(1 - shape, () => {
      const P = plane(s, { x0: -1.6, x1: 3.9, y0: -1.3, y1: 2.6 }, pbox);
      s.alpha(s.ease('maps', 0.6, 1), () => {
        s.arrow(...P(0, 0), ...P(X[0]!, X[1]!), s.c('orange'), 0.8, 2.6);
        rich(s, [['x ', 'orange'], ['[2, 1]', '--ink-2']], ...P(X[0]! - 0.1, X[1]! + 0.32), { size: 3.3, weight: 650, align: 'right', halo: true });
      });
      // Each new arrow starts as a copy of x and turns into what its matrix makes.
      MAPS.forEach((m, r) => {
        const g = s.ease(m.beat, 1.4, 2.2);
        if (s.t < s.at(m.beat)) return;
        const o = OUTS[r]!;
        const tip = [lerp(X[0]!, o[0]!, g), lerp(X[1]!, o[1]!, g)];
        s.alpha(s.ease(m.beat, 0.5, 2), () => s.arrow(...P(0, 0), ...P(tip[0]!, tip[1]!), s.c(m.k), 0.8, 2.6));
        const off: [number, number] = r === 0 ? [0.12, 0.05] : r === 1 ? [0.14, -0.08] : [-0.12, 0.08];
        s.alpha(smooth((g - 0.8) / 0.2), () => rich(s, [[`${m.name} `, m.k], [vtext(o), '--ink-2']], ...P(o[0]! + off[0], o[1]! + off[1]), { size: 3.3, weight: 650, align: r === 2 ? 'right' : 'left', halo: true }));
      });
    });
    // The three matrices, named for their jobs.
    const mx = tall ? s.w / 2 : s.w * 0.78;
    const my = tall ? s.h * 0.75 : s.h * 0.42;
    s.alpha(s.win('maps', 'q') * (1 - shape), () => {
      const xs = tall ? columns(s, 3, 34) : [mx, mx, mx];
      MAPS.forEach((m, r) => {
        const y = tall ? my : my + (r - 1) * 10 * u;
        s.alpha(s.ease('maps', 0.5, 7.4 + 0.7 * r), () => {
          const w = sub(s, 'W', m.sub, xs[r]! - 3 * u, y, { k: 'blue', align: 'right', size: 3.8 });
          void w;
          mono(s, `→ ${m.name === 'q' ? 'query' : m.name === 'k' ? 'key' : 'value'}`, xs[r]! - 1.5 * u, y, m.k, 3.3, 'left', 650);
        });
      });
    });
    // The product for the beat at hand, row by row.
    MAPS.forEach((m, r) => {
      const a = s.win(m.beat, NEXT[r]) * (1 - shape);
      if (a < 0.003) return;
      const lit = [s.win(m.beat, undefined) * (1 - after(s, m.beat, 0.55, 0.3)), after(s, m.beat, 0.55, 0.3)].map((v, i) => (i === 0 ? v * after(s, m.beat, 0.15, 0.3) : v));
      s.alpha(a, () => {
        product(s, mx - 4 * u, my, m, lit);
        const dy = tall ? s.h * 0.89 : my + 14 * u;
        const row = (i: number) => `${m.M[i]!.map((w, j) => `${w}·${X[j]}`).join(' + ')} = ${OUTS[r]![i]}`.replace(/\+ -/g, '− ').replace(/-/g, '−');
        s.alpha(lit[0]!, () => mono(s, row(0), mx, dy, m.k, 3.3));
        s.alpha(lit[1]!, () => mono(s, row(1), mx, dy, m.k, 3.3));
      });
    });
    s.alpha(s.ease('v', 0.6, 3.5) * (1 - shape), () => caption(s, 'one token, three arrows', tall ? s.h * 0.95 : s.h * 0.93, '--ink-2'));
    // The shapes: one row per entry made, one column per entry of x.
    const cells = s.win('rows', 'd');
    const cy = s.h * 0.42;
    s.alpha(cells * shape, () => {
      const p = 7 * u;
      const c = 6 * u;
      const wx = s.w / 2 - 16 * u;
      const band = s.ease('rows', 0.6, 1);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) s.cell(wx + (j - 1) * p - c / 2, cy + (i - 0.5) * p - c / 2, c, c, '', 'blue', { on: i === 0 ? band : 0 });
      sub(s, 'W', 'Q', wx - 1.5 * p - 2 * u, cy, { k: 'blue', align: 'right', size: 3.8 });
      const xx = s.w / 2 + 2 * u;
      for (let j = 0; j < 3; j++) s.cell(xx - c / 2, cy + (j - 1) * p - c / 2, c, c, '', 'orange', { on: band });
      mono(s, '=', xx + 7 * u, cy, '--ink-3', 3.8);
      const qx = xx + 14 * u;
      for (let i = 0; i < 2; i++) s.cell(qx - c / 2, cy + (i - 0.5) * p - c / 2, c, c, '', 'teal', { on: i === 0 ? band : 0 });
      mono(s, 'x', xx, cy - 1.5 * p - 3 * u, 'orange', 3.6, 'center', 700);
      mono(s, 'q', qx, cy - p - 3 * u, 'teal', 3.6, 'center', 700);
      s.alpha(s.ease('rows', 0.6, 3), () => {
        const lx = s.w / 2 - (tall ? 40 : 44) * u;
        rich(s, [['rows: ', '--ink-3'], ['one per entry of ', '--ink-2'], ['q', 'teal'], ['  (2)', '--ink-3']], lx, s.h * 0.7, { size: 3.3, align: 'left' });
        rich(s, [['columns: ', '--ink-3'], ['one per entry of ', '--ink-2'], ['x', 'orange'], ['  (3)', '--ink-3']], lx, s.h * 0.8, { size: 3.3, align: 'left' });
      });
    });
    // Then as blocks: W is d_k by d.
    s.alpha(s.ease('d', 0.8) * shape, () => {
      const big = s.ease('big', 0.6);
      const dw = 34 * u;
      const kh = 14 * u;
      const total = dw + 3 * u + 7 * u + 14 * u + 7 * u;
      const l = s.w / 2 - total / 2 + 3 * u;
      const top = cy - dw / 2;
      const wy = cy - kh / 2;
      slab(s, l, wy, dw, kh, 'blue', '', undefined, undefined, { on: 0.3 });
      sub(s, 'W', 'Q', l + dw / 2, cy, { k: 'blue', size: 3.8 });
      const xl = l + dw + 3 * u;
      slab(s, xl, top, 7 * u, dw, 'orange', 'x', undefined, undefined, { size: 3.4 });
      mono(s, '=', xl + 10.5 * u, cy, '--ink-3', 3.8);
      const ql = xl + 14 * u;
      s.alpha(s.ease('dk', 0.6), () => slab(s, ql, wy, 7 * u, kh, 'teal', 'q', undefined, undefined, { size: 3.4 }));
      const lab = (a: string, b: string) => (big > 0.5 ? b : a);
      s.alpha(1 - 0.0 * big, () => {
        brace(s, 'top', l, l + dw, wy - 2 * u, lab('d', '512'), 'slate', 3.4);
        mono(s, lab('d', '512'), xl + 3.5 * u, top + dw + 4 * u, 'slate', 3.4);
        s.alpha(s.ease('dk', 0.6), () => {
          brace(s, 'left', wy, wy + kh, l - 2 * u, lab('dₖ', '64'), 'slate', 3.4);
          mono(s, lab('dₖ', '64'), ql + 3.5 * u, wy + kh + 4 * u, 'slate', 3.4);
        });
      });
      const ly = s.h * 0.86;
      s.alpha(s.win('d', 'dk'), () => caption(s, 'd: the numbers in a token', ly, 'slate', 3.4));
      s.alpha(s.ease('dk', 0.6, 2.5) * (1 - big), () => named(s, ': dₖ by d', s.w / 2, ly));
      s.alpha(big, () => named(s, ': 64 by 512', s.w / 2, ly));
    });
    cite(s, 'Vaswani et al., 2017', s.ease('big', 0.6));
  },
};

// ---- match: fish's query against every key, then a blend of the values

const match: SceneDef = {
  draw(s) {
    const u = s.u;
    const P = plane(s, { x0: -1.7, x1: 2.9, y0: -0.7, y1: 2.5 }, { l: 6 * u, t: 6 * u, r: s.w - 6 * u, b: s.h * 0.84 });
    const mix = s.ease('mix', 0.8);
    const keyA = s.ease('ask', 0.6, 2.8) * (1 - 0.85 * mix);
    const at: [number, number][] = [
      [1.12, 2.08],
      [2, -0.3],
      [-1, 1.24],
    ];
    const align: CanvasTextAlign[] = ['left', 'right', 'center'];
    // The keys, labelled with their tokens; the weight joins each label once softmax runs.
    s.alpha(keyA, () =>
      KEYS.forEach((k, j) => {
        s.arrow(...P(0, 0), ...P(k[0]!, k[1]!), s.c('purple'), 0.7, 2.6);
        const runs: [string, Ink][] = [[`k ${WORDS[j]}`, 'purple']];
        if (s.t > s.at('weights')) runs.push([` × ${f2(AF[j]!)}`, 'teal']);
        s.alpha(1 - mix, () => rich(s, runs, ...P(...at[j]!), { size: 3.2, weight: 650, align: align[j], halo: true }));
      }),
    );
    s.alpha(s.ease('ask', 0.6, 8) * (1 - 0.85 * mix), () => {
      s.arrow(...P(0, 0), ...P(QF[0]!, QF[1]!), s.c('teal'), 1, 2.8);
      s.alpha(1 - mix, () => mono(s, 'q', ...P(0.14, 0.78), 'teal', 3.8, 'left', 700));
    });
    // Each key's reach along q, which points straight up: its height.
    const reach = [s.ease('score', 0.7, 7.5), s.ease('others', 0.7, 0.5), s.ease('others', 0.7, 4.2)];
    KEYS.forEach((k, j) =>
      s.alpha(reach[j]! * (1 - mix), () => {
        if (k[0] !== 0) s.line(...P(k[0]!, k[1]!), ...P(0, EF[j]!), s.tint('purple', 0.9), 0.35, [1, 1]);
        s.circle(...P(0, EF[j]!), 1.2 * u, { fill: s.c('purple') });
        const lab: [number, number] = j === 0 ? [-0.22, 2] : j === 1 ? [-0.22, -0.3] : [0.22, 1.18];
        mono(s, String(EF[j]), ...P(...lab), 'purple', 3.8, 'center', 700);
      }),
    );
    // A right angle between q and like's key.
    s.alpha(s.win('others', 'weights'), () => {
      const g = s.ctx;
      const [a0, b0] = P(0.16, 0);
      const [a1, b1] = P(0.16, 0.16);
      const [a2, b2] = P(0, 0.16);
      g.beginPath();
      g.moveTo(a0, b0);
      g.lineTo(a1, b1);
      g.lineTo(a2, b2);
      g.strokeStyle = s.c('purple');
      g.lineWidth = 0.3 * u;
      g.stroke();
    });
    // The values: shrink each by its weight, then lay them tip to tail.
    s.alpha(mix, () => {
      const shrink = s.ease('mix', 1.4, 3);
      const chain = s.ease('mix', 1.2, 4.8);
      s.line(...P(0, 0), ...P(2, 0), s.tint('gold', 0.55), 0.3, [1.2, 1.2]);
      const vat: [number, number][] = [
        [2.08, 0.22],
        [0.1, 2.12],
        [1.1, 1.1],
      ];
      let o = [0, 0];
      VALS.forEach((v, j) => {
        const w = v.map((c) => lerp(c, c * AF[j]!, shrink));
        const p = o.map((c) => c * chain);
        s.arrow(...P(p[0]!, p[1]!), ...P(p[0]! + w[0]!, p[1]! + w[1]!), s.c('gold'), 0.7, 2.4);
        s.alpha(1 - shrink, () => rich(s, [[`v ${WORDS[j]}`, 'gold']], ...P(...vat[j]!), { size: 3.2, weight: 650, align: 'left', halo: true }));
        o = [o[0]! + v[0]! * AF[j]!, o[1]! + v[1]! * AF[j]!];
      });
      s.alpha(shrink, () => mono(s, 'v cats', ...P(2.06, -0.22), 'gold', 3.2, 'left', 650));
      s.alpha(s.ease('mix', 0.6, 6), () => {
        s.arrow(...P(0, 0), ...P(OUT[0]!, OUT[1]!), s.c('green'), 1, 3);
        mono(s, `out ${vtext(OUT, 2)}`, ...P(OUT[0]! + 0.25, OUT[1]! + 0.36), 'green', 3.3, 'right', 700);
      });
    });
    const cy = s.h * 0.93;
    s.alpha(s.win('ask', 'score') * s.ease('ask', 0.6, 8), () => caption(s, 'fish asks with q = [0, 1]', cy, 'teal'));
    s.alpha(s.win('score', 'weights') * s.ease('score', 0.6, 5.5), () => caption(s, 'score: how far a key reaches along q', cy, 'purple'));
    s.alpha(s.win('weights', 'mix'), () => caption(s, 'softmax: 0.67, 0.09, 0.24', cy, 'teal'));
    s.alpha(s.win('mix', 'roles') * s.ease('mix', 0.6, 6), () => caption(s, 'near cats\' value, [2, 0]', cy, 'green'));
    s.alpha(s.ease('roles', 0.6), () => {
      rich(s, [['q · k', 'purple'], [' → how much each counts', '--ink-2']], s.w / 2, s.h * 0.86, { size: 3.3 });
      rich(s, [['v', 'gold'], [' → what each brings', '--ink-2']], s.w / 2, s.h * 0.93, { size: 3.3 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { jobs, lookup, make, match };
