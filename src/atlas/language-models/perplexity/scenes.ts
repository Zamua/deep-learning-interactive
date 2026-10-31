import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { after, bars, cite, verdict } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { chip } from '../../sequences/draw';
import { note, spread } from '../draw';

const f2 = (v: number) => v.toFixed(2);

/** A check or a cross with its caption, centered on the stage as one line. */
function centered(s: Scene, ok: boolean, text: string, y: number, size = 3.3) {
  const w = s.measure(text, { size }) + size * 1.4 * s.u;
  verdict(s, ok, text, s.w / 2 - w / 2, y, size);
}

// ---- scene 1: an even bet over k tokens has perplexity k

const TOK4 = ['cat', 'dog', 'cow', 'owl'];
/** Ten shares with the right token (index 0) at 1/10, the rest spread three different ways. */
const UNEVEN = [
  [0.1, 0.3, 0.05, 0.15, 0.02, 0.08, 0.12, 0.03, 0.1, 0.05],
  [0.1, 0.04, 0.22, 0.06, 0.18, 0.03, 0.09, 0.14, 0.05, 0.09],
  [0.1, 0.12, 0.08, 0.02, 0.07, 0.27, 0.04, 0.11, 0.16, 0.03],
];

/** One bar chart of shares over tokens, with optional token chips under it. */
function bet(s: Scene, base: number, vals: number[], o: { pitch: number; w: number; hi?: number; label?: (i: number) => string; tokens?: string[] }) {
  const xs = spread(s, vals.length, o.pitch);
  const hi = vals.map((_, i) => (i === o.hi ? 1 : 0));
  bars(s, xs, base, vals, 'teal', { max: 0.5, height: 26, w: o.w, hi });
  xs.forEach((x, i) => {
    const lab = o.label?.(i) ?? '';
    const hh = (vals[i]! / 0.5) * 26 * s.u;
    if (lab) s.text(lab, x, base - hh - 3.2 * s.u, { size: 3.3, font: 'mono', weight: 600, color: s.c(i === o.hi ? 'gold' : 'teal'), halo: true });
    if (o.tokens) chip(s, x, base + 5 * s.u, o.tokens[i]!, i === o.hi ? 'gold' : '--ink-3', { w: 10, h: 6.5, size: 3, on: i === o.hi ? 1 : 0 });
  });
}

const torn: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{perplexity} = e^{\symL}`, x: 0.5, y: 0.8, size: 5 },
    v: { tex: String.raw`e^{1.39} \approx 4`, x: 0.5, y: 0.9, size: 4.4 },
  },
  draw(s) {
    const base = s.h * 0.5;
    const ly = s.h * 0.66;
    const top = s.h * 0.1;
    // Which picture the bars show: four even, two even, ten even, then the right token at 1/10.
    const a2 = after(s, 'k', 0.02) * (1 - after(s, 'k', 0.36));
    const a10 = after(s, 'k', 0.36) * (1 - s.ease('q', 0.5));
    const aq = s.ease('q', 0.5) * (1 - s.ease('name', 0.5));
    const a4 = Math.max(0, 1 - a2 - a10 - aq);
    // "Whichever token is right": the highlight walks across the four while the loss is read.
    const walk = s.since('loss') >= 0 && s.since('same') < 0 ? Math.floor(s.prog('loss') * 6) % 4 : -1;

    s.alpha(s.win('problem', 'same'), () => rich(s, [['average loss ', '--ink-3'], ['1.39', 'red'], [' per token', '--ink-3'], ['   good?', '--ink-2']], s.w / 2, top, { size: 3.6, weight: 600 }));
    s.alpha(s.win('same', 'k'), () => rich(s, [['1.39', 'red'], [' per token = a fair pick among ', '--ink-3'], ['4', 'gold']], s.w / 2, top, { size: 3.4, weight: 600 }));
    s.alpha(s.win('problem', 'even') * after(s, 'problem', 0.55), () => note(s, 'a loss with no picture', s.w / 2, base, '--ink-3', 3.2));

    s.alpha(s.ease('even', 0.6), () => {
      s.alpha(a4, () => bet(s, base, [0.25, 0.25, 0.25, 0.25], { pitch: s.tall ? 17 : 19, w: 11, hi: walk, label: () => '1/4', tokens: TOK4 }));
      s.alpha(a4 * s.win('even', 'loss'), () => note(s, 'an even bet over 4 tokens', s.w / 2, s.h * 0.2, '--ink-3', 3.2));
      s.alpha(a2, () => bet(s, base, [0.5, 0.5], { pitch: 22, w: 12, label: () => '1/2', tokens: TOK4.slice(0, 2) }));
      s.alpha(a10, () => {
        bet(s, base, Array(10).fill(0.1), { pitch: s.tall ? 8.4 : 9, w: 6 });
        note(s, '1/10 each', s.w / 2, base - 9 * s.u, 'teal', 3.2);
      });
      const pat = UNEVEN[Math.max(0, Math.floor(s.since('q') / 1.4)) % 3]!;
      s.alpha(aq, () => {
        bet(s, base, pat, { pitch: s.tall ? 8.4 : 9, w: 6, hi: 0, label: (i) => (i === 0 ? '1/10' : '') });
        note(s, 'right token', spread(s, 10, s.tall ? 8.4 : 9)[0]!, base + 4.5 * s.u, 'gold', 2.8);
      });
    });

    const line = (runs: [string, Ink][], a: number) => s.alpha(a, () => rich(s, runs, s.w / 2, ly, { size: 3.5, weight: 600 }));
    line([['−ln(1/4) = ', '--ink-2'], ['ln 4 ≈ 1.39', 'red'], ['  every step', '--ink-3']], s.win('loss', 'k'));
    line([['even over 2: ', '--ink-3'], ['e^(ln 2) = 2', 'gold']], a2);
    line([['even over 10: ', '--ink-3'], ['e^(ln 10) = 10', 'gold']], a10 * s.win('k', 'q'));
    line([['right token 1/10: ', '--ink-3'], ['ln 10', 'red'], ['  →  ', '--ink-3'], ['10', 'gold']], s.win('q', 'name'));
    s.alpha(s.ease('name', 0.6), () => note(s, 'perplexed: torn between ways to go', s.w / 2, ly, '--ink-2', 3.4));

    s.show('f', s.ease('undo', 0.6));
    s.show('v', s.ease('undo', 0.6, 1.4) * (1 - s.ease('k', 0.5)));
    cite(s, 'Jelinek, Mercer, Bahl & Baker, 1977', s.ease('history', 0.6));
  },
};

// ---- scene 2: an uneven model, one loss worked, then the average and e to it

const TGT = ['cat', 'sat', 'on', 'a'];
const PY = [1 / 2, 1 / 4, 1 / 2, 1 / 8];
const PYL = ['1/2', '1/4', '1/2', '1/8'];
const LOSS = PY.map((p) => -Math.log(p));
const MEAN = LOSS.reduce((a, b) => a + b, 0) / LOSS.length;
const TOTAL = LOSS.reduce((a, b) => a + b, 0);

const uneven: SceneDef = {
  marks: {
    v: { tex: String.raw`e^{1.21} \approx 3.36`, x: 0.5, y: 0.8, size: 4.6 },
  },
  draw(s) {
    const xs = spread(s, 4, s.tall ? 22 : 25);
    const base = s.h * 0.37;
    const yT = s.h * 0.43;
    const yL = s.h * 0.58;
    const worst = s.win('loss', 'mean');
    s.alpha(s.ease('real', 0.6), () => {
      note(s, 'probability of the right next token', s.w / 2, s.h * 0.05, '--ink-3', 3.1);
      bars(s, xs, base, PY, 'teal', { max: 0.5, height: 20, w: 10, grow: s.ease('real', 0.9, 0.4), hi: [0, 0, 0, worst] });
      xs.forEach((x, i) => {
        s.alpha(after(s, 'real', 0.45 + 0.12 * i), () => s.text(PYL[i]!, x, base - (PY[i]! / 0.5) * 20 * s.u - 3.4 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('teal'), halo: true }));
        chip(s, x, yT, TGT[i]!, 'gold', { w: 11, h: 6.5, size: 3 });
      });
    });
    s.alpha(s.ease('loss', 0.6), () => {
      note(s, 'loss: −ln p', s.w / 2, s.h * 0.51, 'red', 3.2);
      xs.forEach((x, i) => {
        const a = i === 3 ? s.ease('loss', 0.5, 0.2) : after(s, 'loss', 0.55 + 0.08 * i);
        s.alpha(a, () => s.cell(x - 6 * s.u, yL - 4 * s.u, 12 * s.u, 8 * s.u, f2(LOSS[i]!), 'red', { on: Math.max(i === 3 ? worst : 0, s.win('mean', 'exp')), size: 3.2 }));
      });
      s.alpha(worst, () => s.text('ln 8', xs[3]!, yL + 7 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('red'), halo: true }));
    });
    s.alpha(s.ease('mean', 0.6), () => {
      rich(s, [['mean loss ', '--ink-3'], ['L', 'red'], [` = ${f2(MEAN)}`, '--ink-2'], [' per token', '--ink-3']], s.w / 2, s.h * 0.69, { size: 3.4, weight: 600 });
    });
    const order = s.ease('order', 0.6);
    s.show('v', s.ease('exp', 0.6) * (1 - order));
    s.alpha(s.ease('means', 0.6) * (1 - order), () => note(s, 'as torn as a fair pick among ≈ 3.4 tokens', s.w / 2, s.h * 0.9, 'gold', 3.2));
    s.alpha(order, () => {
      centered(s, true, `e^(mean ${f2(MEAN)}) ≈ 3.36: per token`, s.h * 0.8);
      s.alpha(after(s, 'order', 0.35), () => centered(s, false, `e^(total ${f2(TOTAL)}) = 128: whole text`, s.h * 0.89));
    });
  },
};

// ---- scene 3: one line read two ways, perplexity above and loss below

const LMAX = 11;
const V = 50_000;

const scale: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{perplexity} = e^{\symL}, \quad \symL = \ln(\text{perplexity})`, x: 0.5, y: 0.86, size: 4.2 },
  },
  draw(s) {
    const u = s.u;
    const span = Math.min(s.w - 44 * u, 120 * u);
    const x0 = s.w / 2 - span / 2 + 8 * u;
    const X = (L: number) => x0 + (span * L) / LMAX;
    const y = s.h * 0.5;
    const mono = (t: string, x: number, yy: number, k: Ink, size = 3, align: CanvasTextAlign = 'center', weight = 600) => s.text(t, x, yy, { size, font: 'mono', weight, align, color: s.c(k), halo: true });
    // The line itself, with perplexity ticks above (log spaced) and loss ticks below (even).
    s.line(x0, y, x0 + span, y, s.c('--axis'), 0.4);
    mono('perplexity', x0 - 3 * u, y - 4.4 * u, 'gold', 2.8, 'right', 650);
    mono('loss', x0 - 3 * u, y + 4.4 * u, 'red', 2.8, 'right', 650);
    // Tick labels go on last, so their halos break the point lines that cross them; the points label 1 and 0.
    const ticks = () => {
      ([[1, ''], [10, '10'], [100, '100'], [1000, '1k'], [10_000, '10k']] as const).forEach(([p, lab]) => {
        const x = X(Math.log(p));
        s.line(x, y - 1.6 * u, x, y, s.c('--ink-3'), 0.35);
        if (lab) mono(lab, x, y - 4.4 * u, '--ink-3', 2.8);
      });
      [0, 2, 4, 6, 8, 10].forEach((L) => {
        const x = X(L);
        s.line(x, y, x, y + 1.6 * u, s.c('--ink-3'), 0.35);
        if (L) mono(String(L), x, y + 4.4 * u, '--ink-3', 2.8);
      });
    };

    /** A point on the line, its perplexity above and its loss below, with a caption under it all. */
    const point = (L: number, a: number, k: Ink, up: string, down: string, o: { cap?: string; align?: CanvasTextAlign } = {}) =>
      s.alpha(a, () => {
        const x = X(L);
        const al = o.align ?? 'center';
        const lx = al === 'left' ? x + 1.2 * u : al === 'right' ? x - 1.2 * u : x;
        s.line(x, y - 7.5 * u, x, y + 7.5 * u, s.c(k), 0.35);
        s.circle(x, y, 1.3 * u, { fill: s.c(k) });
        mono(up, lx, y - 10 * u, 'gold', 3.2, al, 650);
        mono(down, lx, y + 10 * u, 'red', 3.2, al, 650);
        if (o.cap) mono(o.cap, lx, y + 15.5 * u, k, 2.9, al, 500);
      });
    const endA = (id: string) => s.ease(id, 0.6) * (1 - 0.6 * s.ease('back', 0.5));
    point(0, endA('one'), 'green', '1', '0', { cap: 'always right', align: 'left' });
    point(Math.log(V), endA('V'), 'slate', 'V', 'ln V', { cap: 'knows nothing', align: 'right' });
    point(Math.log(20), s.win('back', 'compare'), 'purple', '20', '≈ 3.0');
    point(Math.log(12), s.win('compare', 'units'), 'green', 'A: 12', '2.48', { align: 'right' });
    point(Math.log(30), s.win('compare', 'units'), 'red', 'B: 30', '3.40', { align: 'left' });
    point(2, s.ease('units', 0.6), 'purple', '7.39', '2');
    ticks();

    const head = s.h * 0.2;
    const runs = (r: [string, Ink][], a: number) => s.alpha(a, () => rich(s, r, s.w / 2, head, { size: 3.4, weight: 600 }));
    runs([['always right: loss ', '--ink-3'], ['0', 'red'], [', perplexity ', '--ink-3'], ['e⁰ = 1', 'gold']], s.win('one', 'V'));
    runs([['even over V: loss ', '--ink-3'], ['ln V', 'red'], [', perplexity ', '--ink-3'], ['V', 'gold']], s.win('V', 'back'));
    s.alpha(s.win('V', 'back') * after(s, 'V', 0.6), () => note(s, 'V = 50,000: perplexity 50,000', s.w / 2, head + 6 * u, '--ink-3', 3));
    runs([['perplexity ', '--ink-3'], ['20', 'gold'], ['  →  loss ', '--ink-3'], ['ln 20 ≈ 3.0', 'red']], s.win('back', 'compare'));
    runs([['lower loss, lower perplexity: ', '--ink-3'], ['A', 'green'], [' is better', '--ink-3']], s.win('compare', 'units'));
    s.alpha(s.win('compare', 'units') * after(s, 'compare', 0.5), () => {
      const ya = y + 21 * u;
      s.arrow(X(Math.log(30)) + 2 * u, ya, X(Math.log(12)) - 4 * u, ya, s.c('green'), 0.4, 1.8);
      mono('fewer tokens to choose from', (X(Math.log(12)) + X(Math.log(30))) / 2, ya + 4.4 * u, 'green', 2.8, 'center', 500);
    });
    runs([['loss ', '--ink-3'], ['2', 'red'], ['  →  perplexity ', '--ink-3'], ['e² ≈ 7.39', 'gold']], s.ease('units', 0.6));
    s.show('f', s.ease('back', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { torn, uneven, scale };
