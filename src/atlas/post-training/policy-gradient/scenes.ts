import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { after } from '../../networks/draw';
import { push as arrowPush, row } from '../draw';

const ANS = ['56', '54', '64'];
const PI = [0.5, 0.3, 0.2];
const R = [1, 0, 0];
/** The scores θ that the softmax turns into 0.5, 0.3 and 0.2. */
const TH = [0, Math.log(0.6), Math.log(0.4)];
/** ∇ln π for each answer of the 7 × 8 model: one-hot minus π, one entry per score. */
const GL = ANS.map((_, y) => PI.map((p, i) => Math.round(((i === y ? 1 : 0) - p) * 10) / 10));
/** The scores and the policy after one step of 0.5 along R ∇ln π(56), for a reward r. */
const stepTh = (r: number) => TH.map((t, i) => t + 0.5 * r * GL[0]![i]!);
const softmax = (th: number[]) => {
  const e = th.map(Math.exp);
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
};
const UP = softmax(stepTh(1));
const DOWN = softmax(stepTh(-1));
/** The answers a run of draws picks, seeded so every viewing shows the same run: 56 five times in ten. */
const DRAWS = [0, 1, 0, 2, 0, 0, 1, 0, 2, 1];
/** Some of the other things a model could say when asked 7 × 8. */
const CLOUD = ['56', 'It is 56.', 'fifty-six', '54', '7 × 8 = 56', 'Maybe 64?', '56!', 'I think 56', '64', '8 × 7 is 56', 'Hmm, 54', '48', 'Fifty six.', '56, of course', '7 × 8 is 54', '…'];
// The worked problems: 54 with R = -1, then averaged with 56 with R = 1.
const E1 = GL[1]!.map((g) => -g);
const E2 = GL[0]!;
const SUM = E1.map((v, i) => Math.round((v + E2[i]!) * 10) / 10);
const AVG = SUM.map((v) => v / 2);
const f2 = (v: number) => v.toFixed(2);
const f1 = (v: number) => (Math.abs(v) < 1e-9 ? '0' : v < 0 ? `−${-v}` : String(v));

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

function caption(s: Scene, text: string, y: number, k: Parameters<Scene['c']>[0] = '--ink-2', size = 3.4) {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });
}

/** `toks` as chips, wrapped into centered rows that fit the stage, from `y0`, each chip faded in by `a(i)`. */
function cloud(s: Scene, toks: string[], y0: number, a: (i: number) => number) {
  const size = 3;
  const maxW = s.w - 12 * s.u;
  const lines: string[][] = [[]];
  for (const t of toks) {
    const cur = lines[lines.length - 1]!;
    if (cur.length && row(s, [...cur, t], 0, size).width > maxW) lines.push([t]);
    else cur.push(t);
  }
  let i = 0;
  lines.forEach((ln, r) => {
    const L = row(s, ln, 0, size);
    const x0 = s.w / 2 - L.width / 2;
    const y = y0 + r * 8.5 * s.u;
    const h = 6.5 * s.u;
    ln.forEach((t, j) => {
      const k = i++;
      const w = L.ws[j]!;
      const right = ['56', '7 × 8 = 56', 'It is 56.', 'fifty-six', '56!', 'I think 56', '8 × 7 is 56', 'Fifty six.', '56, of course'].includes(t);
      s.alpha(a(k), () => s.cell(x0 + L.xs[j]! - w / 2, y - h / 2, w, h, t, t === '…' ? '--ink-3' : right ? 'purple' : 'slate', { size }));
    });
  });
}

const P = String.raw`\sym{pi}{\pi}`;
const RR = String.raw`\sym{R}{R}`;

const draws: SceneDef = {
  marks: {
    sum: { tex: String.raw`\nabla J = \sum_y ${P}(y)\,${RR}(y)\,\nabla\ln ${P}(y)`, x: 0.5, y: 0.1, size: 4.4 },
    est: { tex: String.raw`\nabla J \approx ${RR}(y)\,\nabla \ln ${P}(y),\ \ y \sim ${P}`, x: 0.5, y: 0.76, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
    s.show('sum', s.ease('sum', 0.6, 0.2));
    // The three terms for 7 × 8: answers with their π and R.
    const three = 1 - s.ease('many', 0.6);
    const xs = columns(s, 3, 16);
    s.alpha(s.ease('sum', 0.6, 0.6), () => {
      s.text('7 × 8 = ?', s.w / 2, s.h * 0.24, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink') });
    });
    s.alpha(s.ease('sum', 0.6, 0.8) * three, () => {
      cells(s, xs, s.h * 0.34, ANS, 'purple', { w: 11, h: 7 });
      rowLabel(s, 'π', xs[0]! - 8 * u, s.h * 0.44, 'teal', 3.6);
      cells(s, xs, s.h * 0.44, PI.map(String), 'teal', { w: 11, h: 7 });
      rowLabel(s, 'R', xs[0]! - 8 * u, s.h * 0.54, 'gold', 3.6);
      cells(s, xs, s.h * 0.54, R.map(String), 'gold', { w: 11, h: 7 });
      s.alpha(after(s, 'sum', 0.75), () => caption(s, 'three answers: three terms', s.h * 0.66, '--ink-2'));
    });
    // Everything else it could say.
    const gone = 1 - s.ease('draws', 0.6);
    s.alpha(gone, () => cloud(s, CLOUD, s.h * 0.34, (i) => s.ease('many', 0.4, 0.3 + i * 0.12)));
    s.alpha(after(s, 'many', 0.6) * gone, () => caption(s, 'far too many to add up', s.h * 0.8, 'red'));
    // Ten draws: 56 lights up in five of them.
    s.alpha(s.ease('draws', 0.6, 0.6), () => {
      const n = DRAWS.length;
      const cw = Math.min(8 * u, (s.w - 12 * u - (n - 1) * 1.4 * u) / n);
      const gap = 1.4 * u;
      const x0 = s.w / 2 - (n * cw + (n - 1) * gap) / 2;
      const y = s.h * 0.4;
      const shown = Math.min(n, Math.floor((s.since('draws') - 0.6) / 0.3) + 1);
      DRAWS.forEach((d, i) => {
        if (i >= shown) return;
        s.cell(x0 + i * (cw + gap), y - 3.5 * u, cw, 7 * u, ANS[d]!, 'purple', { on: d === 0 ? after(s, 'draws', 0.6) : 0, size: 2.8 });
      });
      s.alpha(after(s, 'draws', 0.6), () => caption(s, '56 in 5 of 10 draws: weight 0.5', y + 8 * u, 'teal', 3.2));
    });
    s.show('est', s.ease('est', 0.6, 0.4));
    s.alpha(after(s, 'est', 0.5), () => caption(s, 'y ∼ π: y is one draw from π', s.h * 0.88, '--ink-2', 3.2));
  },
};

/** One row of values under the bars, with its name at the left. */
function vals(s: Scene, xs: number[], y: number, label: string, v: string[], k: 'blue' | 'red', on: number[] = [0, 0, 0]) {
  cells(s, xs, y, v, k, { w: 12, h: 7, on });
  s.text(label, xs[0]! - 7.5 * s.u, y, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c(k) });
}

const push: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 22);
    const yc = s.h * 0.1;
    const base = s.h * 0.55;
    const H = 50;
    const up = s.ease('up', 1.2, 2.4);
    const back = s.ease('zero', 0.8);
    const down = s.ease('neg', 1.2, 0.6);
    const mix = (a: number[], b: number[], c: number[]) => a.map((v, i) => v + (b[i]! - v) * up * (1 - back) + (c[i]! - v) * down);
    const p = mix(PI, UP, DOWN);
    const th = mix(TH, stepTh(1), stepTh(-1));
    // The starting probabilities stay as dashed outlines.
    xs.forEach((x, i) => {
      const hh = PI[i]! * H * u;
      s.ctx.save();
      s.ctx.setLineDash([1 * u, 0.8 * u]);
      s.rrect(x - 5 * u, base - hh, 10 * u, hh, 1, { stroke: s.tint('teal', 0.7), lw: 0.25 });
      s.ctx.restore();
    });
    ANS.forEach((a, i) => s.cell(xs[i]! - 6 * u, yc - 4 * u, 12 * u, 8 * u, a, 'purple', { on: i === 0 ? s.ease('grad', 0.6, 0.3) : 0, size: 3.6 }));
    bars(s, xs, base, p, 'teal', { max: 1, height: H, w: 10 });
    xs.forEach((x, i) => s.text(f2(p[i]!), x, base - Math.max(p[i]!, PI[i]!) * H * u - 3.2 * u, { size: 3.6, font: 'mono', weight: 600, color: s.c('teal'), halo: true }));
    vals(s, xs, base + 8 * u, 'θ', th.map((v) => f1(Math.round(v * 100) / 100)), 'blue', [up * (1 - back) + down, up * (1 - back) + down, up * (1 - back) + down].map((v) => Math.min(1, v) * 0.6));
    // ∇ln π(56): which way each score pushes 56.
    const g = s.ease('grad', 0.6, 5);
    s.alpha(g, () => vals(s, xs, base + 18 * u, '∇ln π(56)', GL[0]!.map(f1), 'red'));
    s.alpha(s.win('grad', 'up') * after(s, 'grad', 0.7), () => xs.forEach((x, i) => arrowPush(s, x + 7.5 * u, base - PI[i]! * H * u * 0.5, GL[0]![i]!, 14)));
    const cy = s.h * 0.92;
    s.alpha(s.win('grad', 'up') * after(s, 'grad', 0.7), () => caption(s, 'own score helps, rivals\' scores hurt', cy));
    s.alpha(s.win('up', 'zero'), () => caption(s, 'drew 56, R = 1: pushed up', cy, 'green'));
    s.alpha(s.win('zero', 'neg'), () => caption(s, 'R = 0: the estimate is zero', cy, 'slate'));
    s.alpha(s.ease('neg', 0.6), () => caption(s, 'R = −1: pushed down', cy, 'red'));
  },
};

const name: SceneDef = {
  marks: {
    step: { tex: String.raw`\sym{theta}{\theta} \to \sym{theta}{\theta} + 0.5\,${RR}\,\nabla \ln ${P}(y)`, x: 0.5, y: 0.77, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
    // The model as a rule: a situation, and how often it does each thing.
    const bx = s.tall ? s.w * 0.22 : s.w * 0.3;
    const ax = s.tall ? s.w * 0.74 : s.w * 0.66;
    const yq = s.h * 0.36;
    const ys = [0.2, 0.36, 0.52].map((f) => s.h * f);
    s.rrect(bx - 11 * u, yq - 5 * u, 22 * u, 10 * u, 1.4, { fill: s.tint('slate', 0.12), stroke: s.tint('slate', 0.7), lw: 0.35 });
    s.text('7 × 8 = ?', bx, yq, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink') });
    ANS.forEach((a, i) => {
      const y = ys[i]!;
      s.arrow(bx + 12 * u, yq + (y - yq) * 0.15, ax - 8 * u, y, s.tint('teal', 0.85), 0.35 + 1.6 * PI[i]!, 2.4);
      s.cell(ax - 6 * u, y - 4 * u, 12 * u, 8 * u, a, 'purple', { size: 3.4 });
      // The label sits beside the arrow, pushed off it along the side that faces up.
      const [x0, y0, x1, y1] = [bx + 12 * u, yq + (y - yq) * 0.15, ax - 8 * u, y];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const [nx, ny] = [(y1 - y0) / len, -(x1 - x0) / len];
      s.text(String(PI[i]), x0 + (x1 - x0) * 0.6 + nx * 4.5 * u, y0 + (y1 - y0) * 0.6 + ny * 4.5 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('teal'), halo: true });
    });
    s.alpha(s.win('policy', 'williams'), () => caption(s, 'a policy: what to do, and how often', s.h * 0.67, '--ink-2'));
    s.alpha(s.win('sutton', 'williams') * after(s, 'sutton', 0.15), () => {
      caption(s, 'π: the probability of each choice', s.h * 0.77, 'teal', 3.2);
      caption(s, 'θ: the parameters that set it', s.h * 0.84, 'blue', 3.2);
    });
    cite(s, 'Sutton, McAllester, Singh & Mansour, 1999', s.win('sutton', 'williams'));
    cite(s, 'REINFORCE · Williams, 1992', s.ease('williams', 0.6));
    s.show('step', s.ease('williams', 0.6, 0.4));
    s.alpha(after(s, 'williams', 0.65), () => caption(s, 'on average: uphill on J', s.h * 0.89, 'green', 3.2));
  },
};

/** One worked row: a label at the left, three cells, and an optional note at the right. */
function vrow(s: Scene, xs: number[], y: number, label: string, v: number[], k: 'teal' | 'red' | 'green', o: { note?: string; on?: number } = {}): void {
  cells(s, xs, y, v.map(f1), k, { w: 11, h: 7, on: v.map(() => o.on ?? 0) });
  s.text(label, xs[0]! - 7.5 * s.u, y, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c(k) });
  if (o.note) s.text(o.note, xs[2]! + 7.5 * s.u, y, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('gold') });
}

const tryIt: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 13);
    s.alpha(1 - s.ease('p2', 0.5), () => s.text('drew 54', s.w / 2, s.h * 0.08, { size: 3.2, font: 'mono', weight: 600, color: s.c('purple') }));
    s.alpha(s.ease('p1', 0.6, 0.3), () => {
      vrow(s, xs, s.h * 0.19, '∇ln π(54)', GL[1]!, 'teal', { note: 'R = −1' });
      s.alpha(after(s, 'p1', 0.8) * (1 - after(s, 'a1', 0, 0.3)), () => s.text('estimate?', s.w / 2, s.h * 0.3, { size: 3, color: s.c('--ink-3') }));
    });
    s.alpha(after(s, 'a1', 0.15), () => {
      xs.forEach((x) => s.text('× −1', x, s.h * 0.255, { size: 2.6, font: 'mono', color: s.c('gold'), halo: true }));
      vrow(s, xs, s.h * 0.33, 'R ∇ln π', E1, 'red', { on: 1 - after(s, 'p2', 0) });
    });
    s.alpha(after(s, 'a1', 0.7) * (1 - s.ease('p2', 0.5)), () => s.text('points where 54 gets less likely', s.w / 2, s.h * 0.43, { size: 3, color: s.c('--ink-3') }));
    s.alpha(s.ease('p2', 0.6, 0.3), () => vrow(s, xs, s.h * 0.47, 'R ∇ln π(56)', E2, 'red', { note: 'R = 1' }));
    s.alpha(after(s, 'a2', 0.1), () => {
      s.line(xs[0]! - 6 * s.u, s.h * 0.545, xs[2]! + 6 * s.u, s.h * 0.545, s.c('--axis'), 0.35);
      vrow(s, xs, s.h * 0.61, 'sum', SUM, 'red');
    });
    s.alpha(after(s, 'a2', 0.5), () => {
      xs.forEach((x) => s.text('÷ 2', x, s.h * 0.685, { size: 2.6, font: 'mono', color: s.c('--ink-3'), halo: true }));
      vrow(s, xs, s.h * 0.76, 'average', AVG, 'green', { on: 1 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { draws, push, name, try: tryIt };
