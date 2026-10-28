import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells } from '../../draw';
import { type Ink, mono } from '../draw';

/** An illustrative final loss for 10^logN parameters on budget C: a floor plus a size and a data penalty, lowest near D = 20N. */
const loss = (logN: number, C = 1.2e22) => {
  const n = 10 ** logN;
  const d = C / (6 * n);
  return 1.7 + 400 / n ** 0.3 + 980 / d ** 0.3;
};
const SIZES = [8.5, 9, 9.5, 10, 10.5, 11, 11.5];
const sup = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]!);

/** Who measured it, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

function plot(s: Scene) {
  const l = (s.tall ? 12 : 16) * s.u;
  const r = s.w - 8 * s.u;
  const t = s.h * 0.16;
  const b = s.h - 17 * s.u;
  return { l, r, t, b, X: (x: number) => l + ((x - 8.3) / 3.4) * (r - l), Y: (y: number) => b - ((y - 2.4) / 0.75) * (b - t) };
}

/** A model as a square of parameter cells beside a column of token chips, sitting on `base`. */
function spend(s: Scene, cx: number, base: number, n: number, chips: number, title: string, k: Ink) {
  const c = 2.4 * s.u;
  const gx = cx - 7 * s.u - (n * c) / 2;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s.rrect(gx + i * c, base - (j + 1) * c, c * 0.84, c * 0.84, 0.3, { fill: s.tint('blue', 0.45) });
  for (let i = 0; i < chips; i++) s.rrect(cx + 5 * s.u, base - (i + 1) * 2.3 * s.u, 7 * s.u, 1.7 * s.u, 0.4, { fill: s.tint('orange', 0.55) });
  mono(s, 'N', cx - 7 * s.u, base + 3.6 * s.u, { size: 3.4, k: 'blue', weight: 650 });
  mono(s, 'D', cx + 8.5 * s.u, base + 3.6 * s.u, { size: 3.4, k: 'orange', weight: 650 });
  mono(s, title, cx, base - 33 * s.u, { size: 3.4, k, weight: 650 });
}

const valley: SceneDef = {
  draw(s) {
    // One budget, spent two ways: a big model on few tokens, a small one on many.
    const cards = 1 - s.ease('budget', 0.6);
    s.alpha(cards, () => {
      const dx = (s.tall ? 25 : 28) * s.u;
      const base = s.h * 0.6;
      s.alpha(s.ease('spend', 0.6), () => mono(s, 'one budget, two ways to spend it', s.w / 2, s.h * 0.08, { size: 3.4, k: '--ink-2' }));
      s.alpha(s.ease('spend', 0.7, 3), () => spend(s, s.w / 2 - dx, base, 6, 3, 'bigger model', 'blue'));
      s.alpha(s.ease('spend', 0.7, 7.5), () => spend(s, s.w / 2 + dx, base, 3, 12, 'more tokens', 'orange'));
      s.alpha(s.ease('cost', 0.6, 0.5), () => mono(s, 'C = 6 N D FLOPs', s.w / 2, s.h * 0.76, { size: 3.6, k: 'purple', weight: 650 }));
      s.alpha(s.ease('cost', 0.6, 8), () => mono(s, 'C fixed: N × D fixed', s.w / 2, s.h * 0.84, { size: 3.4, k: '--ink-2' }));
    });
    const P = s.ease('budget', 0.6, 0.3);
    if (P <= 0.003) return;
    s.alpha(P, () => {
      const F = plot(s);
      mono(s, 'C = 1.2 × 10²² FLOPs', s.w / 2, s.h * 0.07, { size: 3.6, k: 'purple', weight: 650 });
      s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
      s.line(F.l, F.b, F.l, F.t, s.c('--axis'), 0.35);
      mono(s, 'loss', F.l + 2 * s.u, F.t, { size: 3.2, k: 'red', align: 'left', weight: 650 });
      [9, 10, 11].forEach((e) => {
        mono(s, `N 10${sup(e)}`, F.X(e), F.b + 3.6 * s.u, { size: 3, k: 'blue' });
        const at = e === 9 ? s.ease('budget', 0.6, 3) : s.ease('trade', 0.6, e === 10 ? 1.5 : 4.5);
        s.alpha(at, () => mono(s, `D 2×10${sup(21 - e)}`, F.X(e), F.b + 7.6 * s.u, { size: 3, k: 'orange' }));
      });
      // The curve and the runs on it.
      const reveal = s.ease('sizes', 2.4, 0.8);
      s.alpha(s.ease('sizes', 0.6), () => {
        const c = s.ctx;
        c.beginPath();
        const n = 80;
        for (let i = 0; i <= n * reveal; i++) {
          const x = 8.4 + (3.2 * i) / n;
          if (i) c.lineTo(F.X(x), F.Y(loss(x)));
          else c.moveTo(F.X(x), F.Y(loss(x)));
        }
        c.strokeStyle = s.tint('red', 0.75);
        c.lineWidth = 0.5 * s.u;
        c.stroke();
        for (const x of SIZES) if ((x - 8.4) / 3.2 <= reveal + 0.01) s.circle(F.X(x), F.Y(loss(x)), 1.3 * s.u, { fill: s.c('red'), stroke: s.c('--card'), lw: 0.35 });
      });
      s.alpha(s.win('trade', 'small'), () => mono(s, 'N × 10, D ÷ 10', s.w / 2, s.h * 0.12, { size: 3.4, k: 'orange', weight: 650, halo: true }));
      s.alpha(s.ease('trade', 0.6, 1), () => [9, 10].forEach((e) => s.rrect(F.X(e) - 9 * s.u, F.b + 1.2 * s.u, 18 * s.u, 8.6 * s.u, 1, { stroke: s.tint('orange', 0.6 * (1 - s.ease('small', 0.6))), lw: 0.3 })));
      s.alpha(s.ease('small', 0.6), () => mono(s, 'too small', F.X(8.75), F.Y(loss(8.6)) + 1 * s.u, { size: 3.4, k: '--ink-2', align: 'left', halo: true }));
      s.alpha(s.ease('big', 0.6), () => {
        mono(s, 'too big:', F.X(11.25), F.Y(loss(11.4)) - 1 * s.u, { size: 3.4, k: '--ink-2', align: 'right', halo: true });
        mono(s, 'too few tokens', F.X(11.25), F.Y(loss(11.4)) + 3.4 * s.u, { size: 3.4, k: '--ink-2', align: 'right', halo: true });
      });
      s.alpha(s.ease('best', 0.6), () => {
        const x = F.X(10);
        const y = F.Y(loss(10));
        const ty = F.t + 8 * s.u;
        s.circle(x, y, 2.6 * s.u, { stroke: s.c('green'), lw: 0.6 });
        s.line(x, ty + 10.5 * s.u, x, y - 3.2 * s.u, s.tint('green', 0.7), 0.35, [1, 0.8]);
        mono(s, '10¹⁰ parameters', x, ty - 2 * s.u, { size: 3.4, k: 'blue', weight: 650, halo: true });
        mono(s, '2 × 10¹¹ tokens', x, ty + 2.4 * s.u, { size: 3.4, k: 'orange', weight: 650, halo: true });
        s.alpha(s.ease('ratio', 0.6, 3), () => mono(s, '20 tokens per parameter', x, ty + 6.8 * s.u, { size: 3.4, k: 'green', weight: 650, halo: true }));
      });
    });
  },
};

/** Three budgets, each with its own valley: the curve's range, and where its label sits. */
const BUDGETS: { C: number; lo: number; hi: number; best: number; tag: string; label: [string, string]; at: 'left' | 'center' | 'right' }[] = [
  { C: 1.2e20, lo: 8.35, hi: 9.75, best: 9, tag: '1.2 × 10²⁰ FLOPs', label: ['1B on 20B', '20 per parameter'], at: 'left' },
  { C: 1.2e22, lo: 8.4, hi: 11.6, best: 10, tag: '1.2 × 10²² FLOPs', label: ['10B on 200B', '20 per parameter'], at: 'center' },
  { C: 1.2e24, lo: 10.25, hi: 11.65, best: 11, tag: '1.2 × 10²⁴ FLOPs', label: ['100B on 2T', '20 per parameter'], at: 'right' },
];
const SPAN = BUDGETS.map((B) => {
  const xs = Array.from({ length: 81 }, (_, i) => B.lo + ((B.hi - B.lo) * i) / 80);
  const ls = xs.map((x) => loss(x, B.C));
  return { min: Math.min(...ls), max: Math.max(...ls) };
});

const budgets: SceneDef = {
  draw(s) {
    const l = (s.tall ? 8 : 12) * s.u;
    const r = s.w - 8 * s.u;
    const t0 = s.h * 0.13;
    const b = s.h - 15 * s.u;
    const gap = 4 * s.u;
    const ph = (b - t0 - 2 * gap) / 3;
    const X = (x: number) => l + ((x - 8.3) / 3.4) * (r - l);
    s.alpha(1 - s.ease('hoffmann', 0.5), () => mono(s, 'final loss against size, one budget per row', s.w / 2, s.h * 0.06, { size: 3, k: '--ink-3' }));
    BUDGETS.forEach((B, i) => {
      const pt = t0 + i * (ph + gap);
      const pb = pt + ph;
      const a = i === 1 ? 1 : s.ease('more', 0.7, i === 0 ? 2.2 : 5.5);
      const Y = (L: number) => pb - 1.5 * s.u - ((L - SPAN[i]!.min) / (SPAN[i]!.max - SPAN[i]!.min)) * ph * 0.7;
      s.alpha(a, () => {
        s.line(l, pb, r, pb, s.c('--axis'), 0.3);
        mono(s, B.tag, l + 1 * s.u, pt + 1.5 * s.u, { size: 3, k: 'purple', align: 'left', weight: 650, halo: true });
        const c = s.ctx;
        c.beginPath();
        for (let j = 0; j <= 60; j++) {
          const x = B.lo + ((B.hi - B.lo) * j) / 60;
          if (j) c.lineTo(X(x), Y(loss(x, B.C)));
          else c.moveTo(X(x), Y(loss(x, B.C)));
        }
        c.strokeStyle = s.tint('red', 0.75);
        c.lineWidth = 0.45 * s.u;
        c.stroke();
      });
      // Each bottom, and its tokens per parameter.
      s.alpha(a * s.ease('same', 0.6, [5, 1.5, 7.5][i]!), () => {
        const x = X(B.best);
        const y = Y(loss(B.best, B.C));
        s.circle(x, y, 1.6 * s.u, { fill: s.c('green'), stroke: s.c('--card'), lw: 0.35 });
        const lx = B.at === 'left' ? X(B.hi) + 3 * s.u : B.at === 'right' ? X(B.lo) - 3 * s.u : x;
        const ly = B.at === 'center' ? pt + ph * 0.42 : pb - ph * 0.42;
        mono(s, B.label[0], lx, ly - 1.8 * s.u, { size: 3.2, k: 'green', weight: 650, align: B.at, halo: true });
        mono(s, B.label[1], lx, ly + 2 * s.u, { size: 3, k: '--ink-2', align: B.at, halo: true });
      });
    });
    [9, 10, 11].forEach((e) => mono(s, `N 10${sup(e)}`, X(e), b + 3.6 * s.u, { size: 3, k: 'blue' }));
    mono(s, 'parameters', s.w / 2, b + 8.6 * s.u, { size: 3, k: '--ink-3' });
    cite(s, 'Hoffmann et al., DeepMind, 2022', s.ease('hoffmann', 0.6));
  },
};

const MODELS: { beat: string; ratio: number; name: string; label: string; note: string; k: 'red' | 'green' | 'blue'; row: number }[] = [
  { beat: 'under', ratio: 300 / 175, name: 'GPT-3', label: '175B on 300B', note: '1.7', k: 'red', row: 0 },
  { beat: 'opt', ratio: 20, name: 'Chinchilla', label: '70B on 1.4T', note: '20', k: 'green', row: 1 },
  { beat: 'over', ratio: 1875, name: 'Llama 3', label: '8B on 15T', note: '1,875', k: 'blue', row: 0 },
];

const ratioAxis = (s: Scene, y: number) => {
  const l = (s.tall ? 10 : 16) * s.u;
  const r = s.w - (s.tall ? 10 : 16) * s.u;
  const X = (v: number) => l + (Math.log10(v) / 4) * (r - l);
  s.line(l, y, r, y, s.c('--axis'), 0.4);
  [1, 10, 100, 1000, 10000].forEach((v) => {
    s.line(X(v), y - 1.2 * s.u, X(v), y + 1.2 * s.u, s.c('--axis'), 0.35);
    mono(s, v.toLocaleString('en-US'), X(v), y + 4.6 * s.u, { size: 3, k: '--ink-3' });
  });
  s.rrect(X(14), y - 3 * s.u, X(28) - X(14), 6 * s.u, 1, { fill: s.tint('green', 0.25) });
  return X;
};

const ratio: SceneDef = {
  draw(s) {
    const y = s.h * 0.64;
    const X = ratioAxis(s, y);
    mono(s, 'tokens per parameter', s.w / 2, y + 10 * s.u, { size: 3.2, k: '--ink-2' });
    s.alpha(s.ease('judge', 0.6), () => mono(s, 'D / N vs 20', s.w / 2, s.h * 0.1, { size: 4, k: '--ink', weight: 650 }));
    MODELS.forEach((m, i) => {
      const a = m.beat === 'under' ? s.ease('gpt3', 0.6, 1) : s.ease(m.beat, 0.6);
      s.alpha(a, () => {
        const x = X(m.ratio);
        const ty = s.h * (0.27 + m.row * 0.14);
        const align = i === 0 ? 'left' : i === 2 ? 'right' : 'center';
        const tx = i === 0 ? x - 3 * s.u : i === 2 ? x + 3 * s.u : x;
        mono(s, m.name, tx, ty - 5.4 * s.u, { size: 3.4, k: m.k, weight: 700, align });
        if (m.beat === 'under') s.alpha(s.win('gpt3', 'under'), () => mono(s, 'generative pre-trained transformer', tx, ty - 1.6 * s.u, { size: 3, k: '--ink-2', align }));
        // The numbers come with the beat that reads them.
        s.alpha(m.beat === 'under' ? s.ease('under', 0.6) : 1, () => {
          s.line(x, ty + 4.8 * s.u, x, y - 2 * s.u, s.tint(m.k, 0.7), 0.35, [1, 0.8]);
          s.circle(x, y, 1.6 * s.u, { fill: s.c(m.k), stroke: s.c('--card'), lw: 0.4 });
          mono(s, m.label, tx, ty - 1.6 * s.u, { size: 3.2, k: m.k, weight: 600, align });
          mono(s, `${m.note} per parameter`, tx, ty + 2 * s.u, { size: 3, k: '--ink-2', align });
        });
      });
    });
    s.alpha(s.ease('under', 0.6, 4), () => mono(s, 'under-trained', X(1.7), y + 15 * s.u, { size: 3.2, k: 'red', align: 'left' }));
    s.alpha(s.ease('over', 0.6, 6), () => mono(s, 'past optimal', X(1875), y + 15 * s.u, { size: 3.2, k: 'blue', align: 'right' }));
    s.alpha(s.ease('why', 0.6, 3), () => mono(s, 'cheaper to run: 2N FLOPs per token', s.w / 2, y + 22 * s.u, { size: 3.2, k: 'blue', weight: 600 }));
    cite(s, 'Brown et al., OpenAI, 2020', s.win('gpt3', 'opt'));
    cite(s, 'Hoffmann et al., DeepMind, 2022', s.win('opt', 'over'));
    cite(s, 'Meta, 2024', s.ease('over', 0.6));
  },
};

/** Two worked models: 8B on 1.6T judged by its ratio, then the tokens for a compute-optimal 30B, and back. */
const tryIt: SceneDef = {
  marks: {
    a0: { tex: String.raw`\sym{Nparams}{N} = 8\ \text{billion},\quad \sym{Dtokens}{D} = 1.6\ \text{trillion}`, x: 0.5, y: 0.1, size: 4.6 },
    a1: { tex: String.raw`1.6\ \text{trillion} = 1{,}600\ \text{billion}`, x: 0.5, y: 0.24, size: 4.2 },
    a2: { tex: String.raw`\sym{Dtokens}{D} / \sym{Nparams}{N} = 1{,}600 / 8 = 200\ \text{per parameter}`, x: 0.5, y: 0.35, size: 4.2 },
    a3: { tex: String.raw`\text{far above 20: well past compute-optimal}`, x: 0.5, y: 0.46, size: 4.2 },
    b0: { tex: String.raw`\sym{Nparams}{N} = 30\ \text{billion, compute-optimal:}\ \ \sym{Dtokens}{D} = \,?`, x: 0.5, y: 0.1, size: 4.6 },
    b1: { tex: String.raw`\sym{Dtokens}{D} = 20\,\sym{Nparams}{N} = 20 \times 30\ \text{billion}`, x: 0.5, y: 0.24, size: 4.2 },
    b2: { tex: String.raw`= 600\ \text{billion tokens}`, x: 0.5, y: 0.35, size: 4.6 },
    b3: { tex: String.raw`\sym{Nparams}{N} = \sym{Dtokens}{D} / 20 = 600 / 20 = 30\ \text{billion}`, x: 0.5, y: 0.46, size: 4.2 },
  },
  draw(s) {
    const second = s.ease('p2', 0.6);
    const a = 1 - second;
    s.show('a0', a);
    s.show('a1', a * s.ease('r1', 0.6));
    s.show('a2', a * s.ease('div', 0.6, 0.5));
    s.show('a3', a * s.ease('v1', 0.6));
    s.show('b0', second);
    s.show('b1', s.ease('r2', 0.6));
    s.show('b2', s.ease('r2', 0.6, 3));
    s.show('b3', s.ease('back', 0.6, 2));
    const y = s.h * 0.72;
    s.alpha(a * s.ease('p1', 0.6, 1), () => {
      const X = ratioAxis(s, y);
      mono(s, 'tokens per parameter', s.w / 2, y + 10 * s.u, { size: 3.2, k: '--ink-2' });
      s.alpha(s.ease('div', 0.6, 2.5), () => {
        const x = X(1600 / 8);
        s.line(x, y - 9 * s.u, x, y - 2 * s.u, s.tint('blue', 0.7), 0.35, [1, 0.8]);
        s.circle(x, y, 1.6 * s.u, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
        mono(s, '8B on 1.6T: 200', x, y - 11.5 * s.u, { size: 3.3, k: 'blue', weight: 650 });
      });
      s.alpha(s.ease('v1', 0.6, 1), () => mono(s, 'past optimal', X(200), y + 15 * s.u, { size: 3.2, k: 'blue' }));
    });
    // 30 billion parameters, 20 tokens each, and back.
    s.alpha(second, () => {
      const xs = [s.w / 2 - (s.tall ? 24 : 30) * s.u, s.w / 2 + (s.tall ? 24 : 30) * s.u];
      mono(s, 'N', xs[0]!, y - 9 * s.u, { size: 3.6, k: 'blue', weight: 650 });
      mono(s, 'D', xs[1]!, y - 9 * s.u, { size: 3.6, k: 'orange', weight: 650 });
      cells(s, [xs[0]!], y, ['30B'], 'blue', { w: 16, h: 8, size: 3.4, on: [s.ease('back', 0.6, 2)] });
      s.arrow(xs[0]! + 9 * s.u, y - 1.6 * s.u, xs[1]! - 9 * s.u, y - 1.6 * s.u, s.c('--ink-3'), 0.35, 2);
      s.alpha(s.ease('r2', 0.6), () => mono(s, '× 20', s.w / 2, y - 4.4 * s.u, { size: 3.2, k: '--ink-2' }));
      s.alpha(s.ease('back', 0.6), () => {
        s.arrow(xs[1]! - 9 * s.u, y + 1.6 * s.u, xs[0]! + 9 * s.u, y + 1.6 * s.u, s.c('--ink-3'), 0.35, 2);
        mono(s, '÷ 20', s.w / 2, y + 4.6 * s.u, { size: 3.2, k: '--ink-2' });
      });
      const got = s.ease('r2', 0.6, 3);
      cells(s, [xs[1]!], y, [got > 0.5 ? '600B' : '?'], 'orange', { w: 16, h: 8, size: 3.4, on: [got * (1 - s.ease('back', 0.6, 2))] });
    });
  },
};

export const scenes: Record<string, SceneDef> = { valley, budgets, ratio, try: tryIt };
