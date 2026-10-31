import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after } from '../../draw';
import { mono } from '../draw';

const sup = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]!);

/** The family from log-log: log L = 2.4 − 0.1 log C, so 3.98 at 10^18 and 2.00 at 10^21. */
const ALPHA = 0.1;
const LOG_A = 2.4;
const lossAt = (c: number) => 10 ** (LOG_A - ALPHA * c);
const RUNS = [18, 19, 20, 21];
const LABELS = ['3.98', '3.16', '2.51', '2.00'];
const DROPS = ['−0.82', '−0.65', '−0.51'];
/** Kaplan's exponent, from the same first run. */
const slow = (c: number) => lossAt(18) * 10 ** (-0.05 * (c - 18));

interface Box { l: number; t: number; r: number; b: number }
/** x runs over log C from c0 to c1; y blends a log L axis (plain = 0) into a plain L axis (plain = 1). */
interface View { c0: number; c1: number; l0: number; l1: number; p0: number; p1: number; plain: number }

const TOP = 0.27;
const R1 = 0.065;
const R2 = 0.15;

function plotBox(s: Scene): Box {
  return { l: (s.tall ? 15 : 16) * s.u, t: s.h * TOP, r: s.w - 8 * s.u, b: s.h - 12 * s.u };
}
const X = (B: Box, V: View, c: number) => B.l + ((c - V.c0) / (V.c1 - V.c0)) * (B.r - B.l);
function Y(B: Box, V: View, L: number): number {
  const yLog = B.b - ((Math.log10(L) - V.l0) / (V.l1 - V.l0)) * (B.b - B.t);
  const yLin = B.b - ((L - V.p0) / (V.p1 - V.p0)) * (B.b - B.t);
  return lerp(yLog, yLin, V.plain);
}

function axes(s: Scene, B: Box): void {
  s.line(B.l, B.b, B.r, B.b, s.c('--axis'), 0.35);
  s.line(B.l, B.b, B.l, B.t, s.c('--axis'), 0.35);
}

/** L = f(c) for c in [c0, c1], clipped to the box. */
function curve(s: Scene, B: Box, V: View, f: (c: number) => number, c0: number, c1: number, k: Ink, dash?: number[], width = 0.6): void {
  if (c1 <= c0) return;
  const g = s.ctx;
  g.save();
  g.beginPath();
  g.rect(B.l, B.t - 1 * s.u, B.r - B.l, B.b - B.t + 1 * s.u);
  g.clip();
  g.beginPath();
  for (let i = 0; i <= 120; i++) {
    const c = c0 + ((c1 - c0) * i) / 120;
    const x = X(B, V, c);
    const y = Y(B, V, f(c));
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.strokeStyle = s.c(k);
  g.lineWidth = width * s.u;
  g.lineJoin = 'round';
  g.setLineDash(dash ? dash.map((d) => d * s.u) : []);
  g.stroke();
  g.restore();
}

function dot(s: Scene, x: number, y: number, k: Ink = 'purple', r = 1.4): void {
  s.circle(x, y, r * s.u, { fill: s.c(k), stroke: s.c('--card'), lw: 0.35 });
}

/** One tenfold step from c to c + 1: across at the old loss, then down to the new one; `grow` draws the across half first. */
function step(s: Scene, B: Box, V: View, c: number, from: number, to: number, grow: number, k: Ink, o: { across?: string; down?: [string, Ink, number][]; lw?: number; la?: number } = {}): void {
  if (grow <= 0.003) return;
  const x0 = X(B, V, c);
  const x1 = X(B, V, c + 1);
  const y0 = Y(B, V, from);
  const y1 = Y(B, V, to);
  const a = Math.min(1, grow * 2);
  const d = Math.max(0, grow * 2 - 1);
  const lw = o.lw ?? 0.4;
  s.line(x0, y0, lerp(x0, x1, a), y0, s.c(k), lw, [1.2, 0.8]);
  if (d > 0) s.line(x1, y0, x1, lerp(y0, y1, d), s.c(k), lw, [1.2, 0.8]);
  const lab = { size: 3.3, weight: 650, halo: true } as const;
  const la = o.la ?? 1;
  // Inside the corner the step makes with the line, so it never meets the previous step's label.
  if (o.across) s.alpha(a * la, () => mono(s, o.across!, lerp(x0, x1, 0.66), y0 + 3.2 * s.u, { ...lab, k: 'purple' }));
  for (const [t, kk, al] of o.down ?? []) s.alpha(d * al * la, () => mono(s, t, x1 + 1.4 * s.u, (y0 + y1) / 2, { ...lab, k: kk, align: 'left' }));
}

/** A centered caption on one of the rows above the plot. */
function cap(s: Scene, text: string, row: number, a: number, k: Ink = '--ink-2', size = 3.5): void {
  s.alpha(a, () => mono(s, text, s.w / 2, s.h * row, { size: s.tall ? size - 0.2 : size, k, weight: 600, halo: true }));
}

/** Who measured it, and when: small and italic, centered on a row. */
function cite(s: Scene, text: string, row: number, a: number): void {
  s.alpha(a, () => s.text(text, s.w / 2, s.h * row, { size: 3.3, italic: true, color: s.c('--ink-2'), halo: true }));
}

/** Tick labels along the bottom at powers of ten, and their axis title. */
function xTicks(s: Scene, B: Box, V: View, cs: number[], label: (c: number) => string, title: string, hi: (c: number) => number = () => 0, k: Ink = 'purple'): void {
  for (const c of cs) {
    const x = X(B, V, c);
    if (x < B.l - 1 || x > B.r + 1) continue;
    const h = hi(c);
    mono(s, label(c), x, B.b + 3.6 * s.u, { size: 3, k: h > 0.5 ? k : '--ink-3', weight: 500 + 200 * h });
  }
  mono(s, title, B.r, B.b + 7.6 * s.u, { size: 3.2, k: 'purple', align: 'right', weight: 650 });
}

function yTick(s: Scene, B: Box, y: number, text: string): void {
  mono(s, text, B.l - 2 * s.u, y, { size: 3, k: '--ink-3', align: 'right' });
}

/** The loss of each run, below and left of its dot, clear of the steps above the line. */
function lossLabel(s: Scene, B: Box, V: View, i: number, a: number, k: Ink = 'red', weight = 650): void {
  const c = RUNS[i]!;
  s.alpha(a, () => mono(s, LABELS[i]!, X(B, V, c) - 1.8 * s.u, Y(B, V, lossAt(c)) + 4.4 * s.u, { size: 3.3, k, align: 'right', weight, halo: true }));
}

const LOG_VIEW: View = { c0: 17.5, c1: 21.45, l0: 0.25, l1: 0.65, p0: 1.6, p1: 4.4, plain: 0 };

const stepScene: SceneDef = {
  marks: {
    f1: { tex: String.raw`\log \symL - 0.1 = \log\,(\symL \times 10^{-0.1})`, x: 0.5, y: R1, size: 4.4 },
    f2: { tex: String.raw`10^{-0.1} \approx 0.79`, x: 0.5, y: R2, size: 4.6 },
    val: { tex: String.raw`3.98 \times 10^{-0.1} \approx 3.16`, x: 0.5, y: R1, size: 4.6 },
    same: { tex: String.raw`\times\, 10^{-\sym{alpha}{\alpha}} \text{ per tenfold step}`, x: 0.5, y: R2, size: 4.6 },
    law1: { tex: String.raw`\symL = a\,\sym{Cflops}{C}^{-\sym{alpha}{\alpha}}`, x: 0.5, y: R1, size: 4.6 },
    law2: { tex: String.raw`a\,(10\,\sym{Cflops}{C})^{-\sym{alpha}{\alpha}} = 10^{-\sym{alpha}{\alpha}} \times \symL`, x: 0.5, y: R2, size: 4.4 },
    two: { tex: String.raw`10^{-0.1} \times 10^{-0.1} = 10^{-0.2} \approx 0.63`, x: 0.5, y: R2, size: 4.4 },
    k1: { tex: String.raw`k \text{ steps:}\ \times\, 10^{-k\sym{alpha}{\alpha}}`, x: 0.5, y: R1, size: 4.6 },
    k2: { tex: String.raw`k = 3\!:\ 10^{-0.3} \approx 0.5\text{, half}`, x: 0.5, y: R2, size: 4.4 },
  },
  draw(s) {
    const B = plotBox(s);
    const V = LOG_VIEW;
    const u = s.u;
    axes(s, B);
    [0.3, 0.4, 0.5, 0.6].forEach((l) => yTick(s, B, Y(B, V, 10 ** l), l.toFixed(1)));
    mono(s, 'log₁₀ L', B.l + 1 * u, B.t - 2.6 * u, { size: 3.2, k: 'red', align: 'left', weight: 650 });
    xTicks(s, B, V, RUNS, (c) => `10${sup(c)}`, 'compute C, FLOPs');

    const hiTwo = s.win('two', 'k');
    const hiK = s.ease('k', 0.6);
    curve(s, B, V, lossAt, 17.6, 21.25, 'purple');
    RUNS.forEach((c) => dot(s, X(B, V, c), Y(B, V, lossAt(c))));

    // The question: from the first run, a lower loss costs how much more?
    const ask = s.win('ask', 'step');
    s.alpha(ask, () => {
      const x = X(B, V, 18);
      const y = Y(B, V, lossAt(18));
      s.circle(x, y, 3 * u, { stroke: s.c('red'), lw: 0.45 });
      s.arrow(x + 1 * u, y + 4 * u, x + 1 * u, y + 13 * u, s.c('red'), 0.45, 2);
      mono(s, 'lower?', x + 3 * u, y + 10 * u, { size: 3.1, k: 'red', align: 'left', weight: 650, halo: true });
    });

    // The steps: the first on its own beat, the other two once every step is the same.
    const lit = (i: number): Ink => (hiK > 0.5 || (hiTwo > 0.5 && i > 0) ? 'green' : 'slate');
    const downs = (i: number): [string, Ink, number][] =>
      i === 0 ? [['−0.1', 'teal', 1 - s.ease('factor', 0.6)], ['× 0.79', 'red', s.ease('factor', 0.6)]] : [['× 0.79', 'red', 1]];
    step(s, B, V, 18, lossAt(18), lossAt(19), s.ease('step', 1.4, 0.4), lit(0), { across: '×10', down: downs(0), lw: lit(0) === 'green' ? 0.55 : 0.4 });
    for (const i of [1, 2]) step(s, B, V, RUNS[i]!, lossAt(RUNS[i]!), lossAt(RUNS[i + 1]!), s.ease('same', 1.2, 0.8 + 0.9 * (i - 1)), lit(i), { across: '×10', down: downs(i), lw: lit(i) === 'green' ? 0.55 : 0.4 });

    // The losses, read off as they come.
    lossLabel(s, B, V, 0, s.ease('value', 0.6), hiK > 0.5 ? 'green' : 'red');
    lossLabel(s, B, V, 1, s.ease('value', 0.6, 1.2), hiTwo > 0.5 ? 'green' : 'red');
    lossLabel(s, B, V, 2, s.ease('same', 0.6, 1.6));
    lossLabel(s, B, V, 3, s.ease('same', 0.6, 2.5), hiTwo > 0.5 || hiK > 0.5 ? 'green' : 'red');

    cap(s, 'a lower loss: how much more compute?', R1, s.win('ask', 'line'), 'red');
    cap(s, 'a straight line, slope −α, with α = 0.1', R1, s.win('line', 'step'), 'teal');
    cap(s, 'one step right: 10× the compute', R1, s.win('step', 'factor'), 'purple');
    cap(s, 'log L − 0.1', R2, s.win('step', 'factor'), 'teal', 3.8);
    s.show('f1', s.win('factor', 'value'));
    s.show('f2', s.win('factor', 'same'));
    s.show('val', s.win('value', 'same'));
    cap(s, 'every step: the same factor', R1, s.win('same', 'law'));
    s.show('same', s.win('same', 'law'));
    s.show('law1', s.win('law', 'two'));
    s.show('law2', s.win('law', 'two'));
    cap(s, '100× the compute: two steps', R1, s.win('two', 'k'), 'green');
    s.show('two', s.win('two', 'k'));
    s.show('k1', s.ease('k', 0.6));
    s.show('k2', s.ease('k', 0.6, 3));
  },
};

const shrink: SceneDef = {
  marks: {
    tenth: { tex: String.raw`10^{-0.05} \approx 0.89`, x: 0.5, y: R2, size: 4.6 },
    half: { tex: String.raw`10^{-6 \times 0.05} = 10^{-0.3} \approx 0.5`, x: 0.5, y: R2, size: 4.4 },
  },
  draw(s) {
    const B = plotBox(s);
    const u = s.u;
    const plain = s.ease('plain', 1.6, 0.4);
    const wide = s.ease('million', 1.6, 0.3);
    const V: View = { ...LOG_VIEW, plain, c1: lerp(21.45, 24.4, wide) };
    axes(s, B);
    // The loss axis turns from logs into plain numbers.
    s.alpha(1 - plain, () => {
      [0.3, 0.4, 0.5, 0.6].forEach((l) => yTick(s, B, Y(B, V, 10 ** l), l.toFixed(1)));
      mono(s, 'log₁₀ L', B.l + 1 * u, B.t - 2.6 * u, { size: 3.2, k: 'red', align: 'left', weight: 650 });
    });
    s.alpha(plain, () => {
      [2, 3, 4].forEach((L) => yTick(s, B, Y(B, V, L), String(L)));
      mono(s, 'loss L', B.l + 1 * u, B.t - 2.6 * u, { size: 3.2, k: 'red', align: 'left', weight: 650 });
    });
    const price = s.win('price', 'kaplan');
    xTicks(s, B, V, [18, 19, 20, 21, 22, 23, 24], (c) => `10${sup(c)}`, 'compute C, FLOPs', (c) => (c <= 21 ? price : c === 24 ? s.ease('million', 0.6, 2) : 0), 'purple');

    // The family with α = 0.1 and its steps, dimmed once Kaplan's slower curve arrives.
    const dim = 1 - 0.65 * s.ease('kaplan', 0.6);
    s.alpha(dim, () => {
      curve(s, B, V, lossAt, 17.6, 21.25, 'purple');
      const drops = s.ease('drops', 0.6);
      for (let i = 0; i < 3; i++) {
        const al = s.ease('drops', 0.6, 1.2 + 1.1 * i);
        step(s, B, V, RUNS[i]!, lossAt(RUNS[i]!), lossAt(RUNS[i + 1]!), 1, 'slate', {
          across: '×10',
          down: [['× 0.79', 'red', 1 - drops], [DROPS[i]!, 'red', drops * al]],
          lw: 0.4 + 0.25 * price,
          la: 1 - wide,
        });
      }
      RUNS.forEach((c, i) => {
        dot(s, X(B, V, c), Y(B, V, lossAt(c)));
        lossLabel(s, B, V, i, 1 - wide, 'red', 600);
      });
    });

    // Kaplan's exponent: the same first run, a flatter curve.
    s.alpha(s.ease('kaplan', 0.8, 1), () => {
      curve(s, B, V, slow, 18, 24.3, 'teal', [1.4, 1], 0.55);
      const c = 21;
      if (wide < 0.5) mono(s, 'α ≈ 0.05', X(B, V, c), Y(B, V, slow(c)) - 3.4 * u, { size: 3.2, k: 'teal', weight: 650, halo: true });
    });
    // Six steps of ten halve the loss: the same 2.00 the α = 0.1 family reached in three.
    s.alpha(s.ease('million', 0.6, 2), () => {
      const y = Y(B, V, 2);
      s.line(X(B, V, 21), y, X(B, V, 24), y, s.c('green'), 0.4, [1, 0.8]);
      dot(s, X(B, V, 24), Y(B, V, slow(24)), 'green', 1.6);
      mono(s, 'half: 6 steps', X(B, V, 24) - 1.5 * u, y + 4.4 * u, { size: 3.1, k: 'green', align: 'right', weight: 650, halo: true });
      mono(s, 'α ≈ 0.05', X(B, V, 22.5), Y(B, V, slow(22.5)) - 3.4 * u, { size: 3.2, k: 'teal', weight: 650, halo: true });
    });

    cap(s, 'the steps of 10× stay; the loss goes plain', R1, s.win('plain', 'drops'));
    cap(s, 'the same factor, so smaller drops', R1, s.win('drops', 'price'), 'red');
    cap(s, 'each run: 10× the compute of the last', R1, s.win('price', 'kaplan'), 'purple');
    cap(s, 'the smallest drop costs the most', R2, s.win('price', 'kaplan'), '--ink-2', 3.3);
    cap(s, 'language models: α ≈ 0.05', R1, s.win('kaplan', 'million'), 'teal');
    cite(s, 'Kaplan et al., 2020', R2, s.win('kaplan', 'tenth'));
    s.show('tenth', s.win('tenth', 'million'));
    cap(s, 'half the loss: 10⁶× the compute', R1, s.ease('million', 0.6), 'green');
    s.show('half', s.ease('million', 0.6, 2.5));
  },
};

/** A family with factor 0.8 per tenfold step, over 1×, 10× and 100× its first run's compute. */
const F = 0.8;
const fam = (c: number) => 4 * F ** c;
const BACK: View = { c0: -0.45, c1: 2.5, l0: 0, l1: 1, p0: 2, p1: 4.25, plain: 1 };

const back: SceneDef = {
  draw(s) {
    const B = plotBox(s);
    const V = BACK;
    const u = s.u;
    axes(s, B);
    [2, 3, 4].forEach((L) => yTick(s, B, Y(B, V, L), String(L)));
    mono(s, 'loss L', B.l + 1 * u, B.t - 2.6 * u, { size: 3.2, k: 'red', align: 'left', weight: 650 });
    const hundred = s.ease('hundred', 0.6);
    xTicks(s, B, V, [0, 1, 2], (c) => `${10 ** c}×`, 'compute', (c) => (c === 2 ? hundred : 0), 'green');

    // The unknown run at 100×, until the factor finds it.
    const found = s.ease('again', 0.6, 1.5);
    s.alpha(1 - found, () => {
      const x = X(B, V, 2);
      s.line(x, B.b, x, B.t + 6 * u, s.tint('slate', 0.7), 0.35, [1, 0.8]);
      mono(s, '?', x, B.t + 3 * u, { size: 4.4, k: 'slate', weight: 700 });
    });
    s.alpha(s.ease('again', 0.6, 1), () => curve(s, B, V, fam, -0.3, 2.35, 'purple', [1.4, 1], 0.5));

    const green = s.ease('count', 0.6);
    const k: Ink = green > 0.5 ? 'green' : 'slate';
    step(s, B, V, 0, 4, 3.2, s.ease('factor', 1.2), k, { across: '×10', down: [['× 0.8', 'red', 1]], lw: green > 0.5 ? 0.55 : 0.4 });
    step(s, B, V, 1, 3.2, 2.56, s.ease('again', 1.2), k, { across: '×10', down: [['× 0.8', 'red', 1]], lw: green > 0.5 ? 0.55 : 0.4 });

    const lab = { size: 3.1, weight: 650, halo: true } as const;
    dot(s, X(B, V, 0), Y(B, V, 4), 'purple', 1.6);
    mono(s, '4', X(B, V, 0) - 2 * u, Y(B, V, 4) + 4 * u, { ...lab, k: 'red', align: 'right' });
    s.alpha(s.ease('given', 0.6, 2), () => {
      dot(s, X(B, V, 1), Y(B, V, 3.2), 'purple', 1.6);
      mono(s, '3.2', X(B, V, 1) - 2 * u, Y(B, V, 3.2) + 4 * u, { ...lab, k: 'red', align: 'right' });
    });
    s.alpha(found, () => {
      dot(s, X(B, V, 2), Y(B, V, 2.56), 'green', 1.8);
      mono(s, '2.56', X(B, V, 2) + 2.4 * u, Y(B, V, 2.56) - 1.6 * u, { ...lab, k: 'green', align: 'left' });
    });
    // The wrong guess: the same drop again.
    s.alpha(s.win('not', 'back'), () => {
      const x = X(B, V, 2);
      const y = Y(B, V, 2.4);
      s.circle(x, y, 1.6 * u, { stroke: s.c('red'), lw: 0.45 });
      mono(s, '2.4 ✗', x - 2.4 * u, y + 1 * u, { ...lab, k: 'red', align: 'right' });
    });
    // Backwards: the ratio from 4 to 2.56, beside the drop.
    s.alpha(s.ease('back', 0.6, 2.5), () => {
      const x = X(B, V, -0.2);
      s.arrow(x, Y(B, V, 4) + 2 * u, x, Y(B, V, 2.56), s.c('green'), 0.45, 2);
      s.line(x - 1 * u, Y(B, V, 2.56), X(B, V, 2) - 2 * u, Y(B, V, 2.56), s.tint('green', 0.6), 0.3, [0.8, 0.8]);
      mono(s, '× 0.64', x + 1.6 * u, Y(B, V, 3.3), { ...lab, k: 'green', align: 'left' });
    });

    cap(s, '1×: 4      10×: 3.2      100×: ?', R1, s.win('given', 'factor'));
    cap(s, '3.2 / 4 = 0.8 per step', R1, s.win('factor', 'again'), 'red', 3.8);
    cap(s, '3.2 × 0.8 = 2.56', R1, s.win('again', 'not'), 'green', 3.8);
    cap(s, 'not 3.2 − 0.8 = 2.4: the drops shrink', R1, s.win('not', 'back'), 'red');
    cap(s, '4 → 2.56: how much more compute?', R1, s.win('back', 'hundred'));
    cap(s, '2.56 / 4 = 0.64', R2, s.win('back', 'count', 0.6) * after(s, 'back', 0.6), 'green', 3.8);
    cap(s, '0.64 = 0.8 × 0.8: two steps', R2, s.win('count', 'hundred'), 'green', 3.8);
    cap(s, 'two steps: 10 × 10 = 100× the compute', R1, hundred, 'green');
    cap(s, '0.64 = 0.8 × 0.8', R2, hundred, 'green', 3.6);
  },
};

export const scenes: Record<string, SceneDef> = { step: stepScene, shrink, back };
