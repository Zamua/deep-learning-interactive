import type { ChapterDef } from './index';
import { fmt } from '../core/code';
import { h } from '../core/dom';
import { type Plot, color, withAlpha } from '../core/plot';
import { SCALING_LAWS_SYMBOLS } from '../lib/scaling-laws-symbols';
import { type Axis, Frame, decades, drawAxes, halo, rich } from '../lib/scaling-laws-chart';
import {
  MODELS,
  type PowerFit,
  SURF,
  type Surface,
  TRUE_RUNS,
  count,
  fitPower,
  kaplanN,
  kaplanND,
  logspace,
  lossND,
  optimum,
  pySci,
  sci,
  syntheticRuns,
  tokensFor,
} from '../lib/scaling-laws-math';

const FONT = 11;
const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
const UI = 'system-ui, -apple-system, sans-serif';
const SERIF = "'Source Serif 4 Variable', Georgia, serif";
const mono = (px: number, w = 500): string => `${w} ${px}px ${MONO}`;
const ui = (px: number, w = 400): string => `${w} ${px}px ${UI}`;
const ital = (px: number, w = 600): string => `italic ${w} ${px}px ${SERIF}`;

/** A frame filling the plot inside pixel margins (room for tick labels and the y label). */
function frameIn(pl: Plot, xa: Axis, ya: Axis, m: { l?: number; r?: number; t?: number; b?: number } = {}): Frame {
  const l = m.l ?? 44;
  const r = m.r ?? 14;
  const t = m.t ?? 24;
  const b = m.b ?? 40;
  return new Frame([l, t, Math.max(10, pl.w - l - r), Math.max(10, pl.h - t - b)], xa, ya);
}

/** Pointer position in the plot's CSS px. */
function local(pl: Plot, e: PointerEvent): [number, number] {
  const r = pl.canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

/** Calls `fn` with the pointer position while the reader presses and drags on the plot. */
function onDrag(pl: Plot, fn: (x: number, y: number) => void): void {
  let on = false;
  pl.canvas.addEventListener('pointerdown', (e) => {
    on = true;
    pl.canvas.setPointerCapture(e.pointerId);
    fn(...local(pl, e));
  });
  pl.canvas.addEventListener('pointermove', (e) => on && fn(...local(pl, e)));
  const off = () => (on = false);
  pl.canvas.addEventListener('pointerup', off);
  pl.canvas.addEventListener('pointercancel', off);
}

const lossTicks = (lo: number, hi: number): number[] => [1.5, 2, 2.5, 3, 4, 5, 6, 8].filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9);
const pow10 = (v: number): string => `10^${Math.round(Math.log10(v))}`;
const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke?: string, lw = 1.5): void => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
};
const vline = (ctx: CanvasRenderingContext2D, fr: Frame, x: number, col: string, dash: number[] = [5, 4], lw = 1.5): void => {
  ctx.beginPath();
  ctx.moveTo(fr.X(x), fr.top);
  ctx.lineTo(fr.X(x), fr.bottom);
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
};
/** A row of legend swatches drawn right-aligned in the top margin. */
function legend(ctx: CanvasRenderingContext2D, right: number, y: number, items: { label: string; col: string; dash?: boolean }[]): void {
  ctx.font = ui(FONT);
  let x = right;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]!;
    const tw = ctx.measureText(it.label).width;
    ctx.fillStyle = color('--ink-2');
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.label, x, y);
    x -= tw + 5;
    ctx.beginPath();
    ctx.moveTo(x - 16, y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = it.col;
    ctx.lineWidth = 2.2;
    ctx.setLineDash(it.dash ? [4, 3] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    x -= 16 + 12;
  }
}
const ratioStr = (r: number): string => (r >= 1e5 || r < 0.01 ? pySci(r, 2) : r >= 100 ? String(Math.round(r)) : fmt(r, 2));
/** Forces the next controls onto a new row. */
const brk = (f: { controls: HTMLElement }): void => void f.controls.append(h('div', { style: 'flex-basis:100%;height:0' }));
const pct = (v: number): string => `${v >= 0 ? '' : '−'}${Math.abs(Math.round(v * 100))}%`;

const chapter: ChapterDef = {
  symbols: SCALING_LAWS_SYMBOLS,

  render(p) {
    p.prose(`
In 2016 a bigger network was a gamble. It might overfit, it might refuse to train, and nobody could tell you in advance how much better it would be. By 2020 that had changed. Train a family of language models of different sizes, plot their final loss against their size on the right kind of axes, and the points fall on a straight line. The same happens for the amount of training data and for the amount of compute. A straight line can be extended, so for the first time you could predict how good a model would be *before* paying to train it.

That turned scale into a research direction with its own central question: **if you can afford a fixed amount of compute, how big should the model be, and how many tokens should it read?** This chapter builds the answer in steps. First what a power law is and why it is straight on log axes, and how to fit one. Then the laws themselves (Kaplan et al., 2020), the arithmetic that turns parameters and tokens into compute (about $6\\symN\\symD$), and the budget question, which Kaplan and then Chinchilla (Hoffmann et al., 2022) answered very differently. Finally, why almost every model since has deliberately trained *past* the answer.

Throughout, the loss is the next-token cross-entropy from [the pretraining chapter](#/pretraining), averaged over tokens of held-out text and measured in nats (natural-log units). Lower is better, and a drop of a few hundredths is a big deal. $\\symN$ is the number of parameters, $\\symD$ the number of training tokens, and $\\symC$ the training compute.`);

    // ------------------------------------------------------------------ power laws
    p.h2('Power laws and log axes', 'power-laws');
    p.prose(`
A **power law** says one quantity is a fixed power of another: $y = a\\,x^{-k}$. Read $x$ as the number of parameters, $y$ as the loss, and the exponent $k$ as a small positive number, so $y$ falls as $x$ grows. The defining property: **multiplying $x$ by any factor multiplies $y$ by a fixed factor, wherever you start.** Going from 10 million to 100 million parameters buys the same *fractional* improvement as going from 10 billion to 100 billion.

That is not how the decays you may know behave. An exponential decay $e^{-x}$ loses a fixed fraction every fixed *step* in $x$; a power law loses a fixed fraction every fixed *ratio* in $x$. Power laws drop quickly and then keep falling slowly for a very long time. On ordinary axes that long tail looks like nothing is happening, which is why every plot in this chapter uses logarithmic axes.`);

    p.math({
      label: 'A power law, before and after taking logs',
      tex: String.raw`\begin{aligned} y &= a\,x^{-k} \\ \log y &= \log a - k \log x \end{aligned}`,
      code: `
        a, k = 10.0, 0.5
        x = np.logspace(0, 4, 50)   # 1 to 10,000
        y = a * x**(-k)
        u, v = np.log10(x), np.log10(y)
        np.diff(v) / np.diff(u)     # every slope: -0.5
      `,
      codeTitle: 'power_law.py',
      terms: [
        [String.raw`a`, 'the prefactor: the value of $y$ at $x = 1$'],
        [String.raw`x^{-k}`, '$x$ to the power $-k$, which is $1 / x^k$: the bigger $x$, the smaller $y$'],
        [String.raw`\log`, 'the logarithm, here base 10: it counts powers of ten, so $\\log 10 = 1$, $\\log 100 = 2$, $\\log 1000 = 3$'],
        [String.raw`\log y = \log a - k \log x`, 'the same law in log units: a straight line with intercept $\\log a$ and slope $-k$'],
      ],
      explain: 'Two rules of logarithms do all the work: the log of a product is the sum of the logs, and the log of $x^k$ is $k \\log x$. Applied to $a\\,x^{-k}$ they give $\\log a - k \\log x$, which is the equation of a straight line written in log units. So a power law plotted on **log-log axes** (both axes spaced by powers of ten) is a straight line, and its slope is the exponent. One step of a decade to the right (ten times more $x$) moves the line down by $k$ decades, which means $y$ gets multiplied by $10^{-k}$.',
    });

    p.figure({
      title: 'The same two curves on three kinds of axes',
      codeTitle: 'log_axes.py',
      code: `
        x = np.linspace(1, 1000, 1000)
        y_pow = 10 * x ** -{{k:0.5}}     # power law    #@pow
        y_exp = 10 * np.exp(-x / 150)   # exponential  #@exp
        plt.plot(x, y_pow)
        plt.plot(x, y_exp)
        plt.xscale('{{xs:linear}}')                     #@axes
        plt.yscale('{{ys:linear}}')                     #@axes
        # 10x more x: y_pow times {{f:0.316}}, from any x
      `,
      setup(f) {
        let k = 0.5;
        let mode: 'lin' | 'logy' | 'loglog' = 'lin';
        const pw = (x: number) => 10 * x ** -k;
        const ex = (x: number) => 10 * Math.exp(-x / 150);
        const pl = f.plot({
          aspect: 1.25,
          square: false,
          draw: (pl) => {
            const ctx = pl.ctx;
            const xa: Axis = mode === 'loglog' ? { lo: 1, hi: 1000, log: true } : { lo: 0, hi: 1000 };
            const ya: Axis = mode === 'lin' ? { lo: 0, hi: 11 } : { lo: 1e-4, hi: 30, log: true };
            const fr = frameIn(pl, xa, ya, { l: 46, t: 30 });
            drawAxes(ctx, fr, {
              font: FONT,
              xTicks: mode === 'loglog' ? [1, 10, 100, 1000] : [0, 250, 500, 750, 1000],
              yTicks: mode === 'lin' ? [0, 2, 4, 6, 8, 10] : decades(1e-4, 10),
              xFmt: (v) => String(v),
              yFmt: mode === 'lin' ? (v) => String(v) : (v) => (v >= 1 ? String(v) : pow10(v)),
              xLabel: 'x',
              yLabel: 'y',
            });
            legend(ctx, fr.right, 11, [
              { label: 'power law', col: color('red') },
              { label: 'exponential', col: color('slate'), dash: true },
            ]);
            fr.fn(ctx, ex, color('slate'), 2, { from: 1, n: 400, dash: [6, 4] });
            fr.fn(ctx, pw, color('red'), 2.6, { from: 1, n: 400 });
            const marks = [1, 10, 100, 1000];
            for (const x of marks) dot(ctx, fr.X(x), fr.Y(pw(x)), 4.5, color('red'), color('--paper'));
            if (mode === 'loglog') {
              const y0 = pw(10);
              const y1 = pw(100);
              const c = color('--ink-2');
              ctx.strokeStyle = c;
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(fr.X(10), fr.Y(y0));
              ctx.lineTo(fr.X(100), fr.Y(y0));
              ctx.lineTo(fr.X(100), fr.Y(y1));
              ctx.stroke();
              halo(ctx, '×10', (fr.X(10) + fr.X(100)) / 2, fr.Y(y0) - 9, c, mono(FONT), 'center');
              halo(ctx, `× ${fmt(10 ** -k, 3)}`, fr.X(100) + 6, (fr.Y(y0) + fr.Y(y1)) / 2, c, mono(FONT), 'left');
              for (const x of marks) {
                const first = x === 1;
                halo(ctx, fmt(pw(x), 3), fr.X(x) + (first ? 7 : -7), fr.Y(pw(x)) + (first ? -11 : 12), color('red'), mono(FONT), first ? 'left' : 'right');
              }
            }
          },
        });
        const factorRo = f.readout('10× in x multiplies y by');
        const slopeRo = f.readout('slope on log-log axes');
        f.segmented({
          label: 'axes',
          options: [
            { value: 'lin', label: 'linear' },
            { value: 'logy', label: 'log y' },
            { value: 'loglog', label: 'log-log' },
          ],
          value: 'lin',
          onChange: (v) => {
            mode = v as typeof mode;
            f.code.setMany({ xs: mode === 'loglog' ? 'log' : 'linear', ys: mode === 'lin' ? 'linear' : 'log' });
            f.code.highlight('axes');
            pl.redraw();
          },
        });
        f.slider({
          label: 'exponent k',
          min: 0.05,
          max: 1.5,
          step: 0.05,
          value: 0.5,
          slot: 'k',
          format: (v) => fmt(v, 2),
          onInput: (v) => {
            k = v;
            sync();
            f.code.highlight('pow');
            pl.redraw();
          },
        });
        const sync = () => {
          f.code.set('f', fmt(10 ** -k, 3));
          factorRo.set(fmt(10 ** -k, 3));
          slopeRo.set(fmt(-k, 2));
        };
        sync();
      },
      caption: `Switch the axes. On ordinary axes both curves are a fast drop and a long, flat-looking tail. With a log scale on $y$ only, the exponential becomes straight: it loses the same fraction for every fixed step in $x$. On **log-log** axes it is the power law that becomes straight, while the exponential falls off a cliff. Drag $k$: on log-log axes it is exactly the slope, and the dots at $x$ = 1, 10, 100, 1000 step down by the same factor each time.`,
    });

    p.callout('math', `$\\log_{10} x$ asks "10 to what power gives $x$?": $\\log_{10} 1000 = 3$ and $\\log_{10} 0.01 = -2$. Two rules do almost everything: $\\log(ab) = \\log a + \\log b$ and $\\log(x^k) = k \\log x$. The natural log $\\ln$ uses $e \\approx 2.718$ instead of 10 and differs from $\\log_{10}$ only by a constant factor ($\\ln x \\approx 2.303 \\log_{10} x$), so a slope on log-log axes is the same in either base. That is why papers can quote exponents without saying which log they used. The [math survival kit](#/math-kit) has the long version.`, 'Math help: logarithms');

    // ------------------------------------------------------------------ fitting
    p.h2('Fitting a power law', 'fitting');
    p.prose(`
Real measurements are noisy points, not curves. If they follow a power law, then their logarithms follow a straight line, and fitting a straight line to points is the oldest trick in statistics: **least squares**, which picks the line that makes the squared vertical misses as small as possible. Do it on the logs and the slope is your exponent.`);

    p.math({
      label: 'Least-squares slope, in log space',
      tex: String.raw`m = \frac{\sum_i (u_i - \bar u)(v_i - \bar v)}{\sum_i (u_i - \bar u)^2}`,
      code: `
        u, v = np.log10(N), np.log10(L)
        du, dv = u - u.mean(), v - v.mean()
        m = np.sum(du * dv) / np.sum(du * du)  # slope -k
        c = v.mean() - m * u.mean()            # log a
        m, c = np.polyfit(u, v, 1)             # same fit
      `,
      codeTitle: 'fit_loglog.py',
      terms: [
        [String.raw`u_i = \log \symN_i,\ v_i = \log \symL_i`, 'the logs of run $i$\'s model size and final loss'],
        [String.raw`\bar u,\ \bar v`, 'a bar means the average over all runs'],
        [String.raw`\sum_i (u_i - \bar u)(v_i - \bar v)`, 'how $u$ and $v$ move together: negative when bigger runs have lower loss'],
        [String.raw`\sum_i (u_i - \bar u)^2`, 'how spread out the run sizes are'],
        [String.raw`m`, 'the slope of the best line, so the exponent is $k = -m$; the intercept $c$ gives $a = 10^c$'],
      ],
      explain: 'This is ordinary linear regression, done on logarithms. Run by run, multiply "how far this run\'s log-size is from the average" by "how far its log-loss is from the average", add those up, and divide by the spread of the log-sizes: that is the slope. Fitting in log space treats a 1% miss on a small run and a 1% miss on a large run as equally bad, which is what you want when the runs span many orders of magnitude.',
    });

    p.prose(`
### The floor

A pure power law heads all the way to zero. Real loss cannot: language is partly unpredictable (the next word of a sentence is often genuinely uncertain), so even a perfect model pays some cross-entropy. The honest form is a power law sitting on a floor, $\\symL = \\symE + a\\,\\symN^{-k}$, where $\\symE$ is the **irreducible loss**. Over a narrow range of sizes the floor is invisible and a straight line fits fine. Extrapolate a hundred times further and the straight line dives below the floor.`);

    p.figure({
      title: 'Fit small runs, predict a big one (synthetic data)',
      codeTitle: 'extrapolate.py',
      code: `
        N = np.logspace(6, 9, 10)    # 1M to 1B params
        L = 1.9 + 40 * N**-0.22      # hidden truth
        L *= 1 + 0.01 * np.random.randn(10)           #@data
        use = N <= {{Nmax:1e9}}      # runs in the fit  #@use
        best = (np.inf, 0, 0, 0)
        for E in {{Egrid:[0.0]}}:                      #@floor
            u = np.log10(N[use])                       #@fit
            v = np.log10(L[use] - E)                   #@fit
            m, c = np.polyfit(u, v, 1)                 #@fit
            fit = E + 10**c * N[use]**m
            err = np.sum(np.log10(L[use] / fit) ** 2)
            best = min(best, (err, E, m, c))
        _, E, m, c = best    # E = {{E:0}}, m = {{m}}    #@best
        pred = E + 10**c * 1e11**m   # {{pred}}        #@pred
        # truth at 100B: {{truth}}
      `,
      setup(f) {
        const TARGET = 1e11;
        const truth = TRUE_RUNS.E + TRUE_RUNS.a * TARGET ** -TRUE_RUNS.k;
        let seed = 3;
        let runs = syntheticRuns(seed);
        let nUse = 10;
        let floor = false;
        let fit: PowerFit = fitPower(runs.N, runs.L, false);
        const pl = f.plot({
          aspect: 1.2,
          square: false,
          draw: (pl) => {
            const ctx = pl.ctx;
            const fr = frameIn(pl, { lo: 5e5, hi: 3e11, log: true }, { lo: 1.4, hi: 4.4, log: true }, { t: 30 });
            const lastN = runs.N[nUse - 1]!;
            ctx.fillStyle = withAlpha(color('purple'), 0.07);
            ctx.fillRect(fr.X(lastN * 1.4), fr.top, fr.right - fr.X(lastN * 1.4), fr.bottom - fr.top);
            drawAxes(ctx, fr, {
              font: FONT,
              xTicks: decades(1e6, 1e11),
              yTicks: [1.5, 2, 2.5, 3, 4],
              xFmt: count,
              yFmt: (v) => String(v),
              xLabel: 'parameters N',
              xLabelColor: color('blue'),
              yLabel: 'final loss L',
              yLabelColor: color('red'),
            });
            legend(ctx, fr.right, 11, [{ label: floor ? 'fit with a floor' : 'straight-line fit', col: color('purple') }]);
            halo(ctx, 'extrapolation', fr.X(lastN * 1.4) + 5, fr.top + 11, withAlpha(color('purple'), 0.8), ui(FONT), 'left');
            if (floor && fit.E > 0) {
              ctx.beginPath();
              ctx.moveTo(fr.left, fr.Y(fit.E));
              ctx.lineTo(fr.right, fr.Y(fit.E));
              ctx.strokeStyle = color('green');
              ctx.setLineDash([5, 4]);
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.setLineDash([]);
              halo(ctx, `floor E = ${fmt(fit.E, 3)}`, fr.left + 6, fr.Y(fit.E) - 9, color('green'), ui(FONT), 'left');
            }
            fr.fn(ctx, (n) => fit.at(n), color('purple'), 2.2, { from: 6e5 });
            runs.N.forEach((n, i) => {
              const used = i < nUse;
              dot(ctx, fr.X(n), fr.Y(runs.L[i]!), 4.5, used ? color('red') : color('--paper'), used ? color('--paper') : color('red'));
            });
            vline(ctx, fr, TARGET, color('--ink-3'), [3, 4], 1);
            const pred = fit.at(TARGET);
            const yp = fr.Y(pred);
            const yt = fr.Y(truth);
            dot(ctx, fr.X(TARGET), yt, 6, 'transparent', color('--ink'), 2);
            dot(ctx, fr.X(TARGET), yp, 4.5, color('purple'), color('--paper'));
            const xL = fr.X(TARGET) - 9;
            if (Math.abs(yp - yt) < 15) halo(ctx, `prediction ≈ truth`, xL, Math.min(yp, yt) - 12, color('--ink'), ui(FONT, 600), 'right');
            else {
              const predHigher = yp < yt;
              halo(ctx, `truth ${fmt(truth, 3)}`, xL, yt + (predHigher ? 11 : -11), color('--ink'), ui(FONT, 600), 'right');
              halo(ctx, `prediction ${fmt(pred, 3)}`, xL, yp + (predHigher ? -11 : 11), color('purple'), ui(FONT, 600), 'right');
            }
          },
        });
        const kRo = f.readout('slope m');
        const eRo = f.readout('floor E', { sym: 'E' });
        const pRo = f.readout('predicted at 100B');
        const tRo = f.readout('truth');
        const refit = () => {
          fit = fitPower(runs.N.slice(0, nUse), runs.L.slice(0, nUse), floor);
          f.code.setMany({
            Nmax: pySci(runs.N[nUse - 1]!, 2),
            Egrid: floor ? 'np.linspace(0, L.min(), 300)' : '[0.0]',
            E: fmt(fit.E, 3),
            m: fmt(fit.m, 3),
            pred: fmt(fit.at(TARGET), 3),
            truth: fmt(truth, 3),
          });
          kRo.set(fmt(fit.m, 3));
          eRo.set(floor ? fmt(fit.E, 3) : 'none');
          pRo.set(fmt(fit.at(TARGET), 3));
          tRo.set(fmt(truth, 3));
          pl.redraw();
        };
        brk(f);
        f.slider({
          label: 'runs used (smallest first)',
          min: 4,
          max: 10,
          step: 1,
          value: 10,
          format: (v) => String(v),
          onInput: (v) => {
            nUse = v;
            f.code.highlight('use');
            refit();
          },
        });
        brk(f);
        f.toggle({
          label: 'fit a floor E',
          value: false,
          onChange: (v) => {
            floor = v;
            f.code.highlight(v ? ['floor', 'best'] : 'fit');
            refit();
          },
        });
        f.button('New noise', () => {
          seed = (seed * 7 + 11) % 997;
          runs = syntheticRuns(seed);
          f.code.highlight('data');
          refit();
        }, { icon: 'shuffle' });
        refit();
      },
      caption: `Ten synthetic training runs (made up for this figure from $\\symL = 1.9 + 40\\,\\symN^{-0.22}$ plus 1% noise) stand in for the small models a lab can afford to train. The straight-line fit matches them well, yet predicts a 100-billion-parameter model far too optimistically, because it ignores the floor. Turn on **fit a floor E**: the curve bends, and the prediction lands near the truth. Now drop to four or five runs: with a narrow range the floor is poorly pinned down and the prediction wanders. Press **New noise** a few times to see how much.`,
    });

    p.callout('history', `This is how large runs are planned. The GPT-4 technical report (2023) describes predicting the final loss of GPT-4 in advance, by fitting a scaling law with an irreducible-loss term to models trained with the same recipe on up to 10,000 times less compute. A scaling law is above all a forecasting tool: it lets small, cheap experiments decide how to spend a very expensive one.`, 'Context');

    // ------------------------------------------------------------------ kaplan
    p.h2('Loss versus parameters, data and compute', 'kaplan');
    p.prose(`
In January 2020, Jared Kaplan, Sam McCandlish and colleagues at OpenAI published *Scaling Laws for Neural Language Models*. They trained many transformer language models (link: [the Transformer chapter](#/transformer)), from tiny ones up to 1.5 billion parameters, on web text, and measured how the final test loss depended on three resources. Each one, when the other two were not holding it back, gave a clean power law, with some trends spanning more than seven orders of magnitude.`);

    p.math({
      label: "Kaplan's three scaling laws (approximate fits)",
      tex: String.raw`\begin{aligned} \symL(\symN) &\approx \Big(\frac{N_c}{\symN}\Big)^{\sym{alpha}{\alpha_N}} \\ \symL(\symD) &\approx \Big(\frac{D_c}{\symD}\Big)^{\sym{beta}{\alpha_D}} \\ \symL(\symC) &\approx \Big(\frac{C_c}{\symC}\Big)^{\alpha_C} \end{aligned}`,
      code: `
        # Kaplan et al. (2020), approximate fits
        N_c, alpha_N = 8.8e13, 0.076   # non-embedding N
        D_c, alpha_D = 5.4e13, 0.095   # tokens
        alpha_C = 0.050                # compute, well spent
        L_N = (N_c / N) ** alpha_N     # plenty of data
        L_D = (D_c / D) ** alpha_D     # big model, early stop
        2 ** -alpha_N                  # 0.949: about 5% lower
      `,
      codeTitle: 'kaplan.py',
      terms: [
        [String.raw`\symL(\symN)`, 'the loss of a model with $N$ parameters (not counting the embedding table), trained on enough data to converge'],
        [String.raw`\symL(\symD)`, 'the loss of a large model trained on $D$ tokens, stopped early before it overfits'],
        [String.raw`\symL(\symC)`, 'the best loss reachable with compute $C$, when the model size is chosen well for that budget'],
        [String.raw`N_c,\ D_c,\ C_c`, 'fitted constants that set where each line sits'],
        [String.raw`\sym{alpha}{\alpha_N} \approx 0.076,\ \sym{beta}{\alpha_D} \approx 0.095,\ \alpha_C \approx 0.050`, 'the exponents: the slopes of the three lines on log-log axes'],
      ],
      explain: 'Each law says the same thing about a different resource: multiply it by 10 and the loss gets multiplied by a fixed factor, about 0.84 for parameters, 0.80 for data and 0.89 for compute. The exponents are small, so progress is real but expensive: by this law alone, halving the loss through parameters would take about 9,000 times more of them ($2^{1/0.076}$). Kaplan\'s forms have no floor, so they describe the range that was measured, not the far limit.',
    });

    p.prose(`
Three more findings from the paper shaped the years that followed:

- **Shape barely matters.** At a fixed parameter count, the loss hardly changed across a wide range of depths, widths and numbers of heads. What counts is how many parameters there are, not how they are arranged (within reason).
- **Bigger models are more sample-efficient.** A larger model reaches a given loss after fewer tokens than a smaller one does.
- **Parameters and data must grow together.** Each law holds only while the other resource is plentiful. With a fixed dataset, adding parameters helps less and less, then stops helping. The figure below uses Kaplan's combined formula to show that bend.`);

    p.figure({
      title: 'Loss versus model size, at a fixed amount of data',
      codeTitle: 'kaplan_nd.py',
      code: `
        N_c, alpha_N = 8.8e13, 0.076   # Kaplan et al.
        D_c, alpha_D = 5.4e13, 0.095   # (approximate)
        D = {{D:1e9}}                  # tokens      #@D
        N = np.logspace(5, 11, 200)
        L_inf = (N_c / N) ** alpha_N   # unlimited data  #@inf
        r = (N_c / N) ** (alpha_N / alpha_D)          #@L
        L = (r + D_c / D) ** alpha_D                  #@L
        # N = {{Nq:1e9}}: {{Li}} unlimited, {{Ld}} with D
      `,
      setup(f) {
        let D = 1e9;
        let Nq = 1e9;
        const fam = [1e7, 1e8, 1e9, 1e10, 1e11];
        let frRef: Frame | null = null;
        const pl = f.plot({
          aspect: 1.2,
          square: false,
          draw: (pl) => {
            const ctx = pl.ctx;
            const fr = frameIn(pl, { lo: 1e5, hi: 1e11, log: true }, { lo: 1.5, hi: 5.2, log: true }, { r: 46, t: 30 });
            frRef = fr;
            drawAxes(ctx, fr, {
              font: FONT,
              xTicks: decades(1e5, 1e11),
              yTicks: lossTicks(1.5, 5),
              xFmt: count,
              yFmt: (v) => String(v),
              xLabel: 'parameters N',
              xLabelColor: color('blue'),
              yLabel: 'loss L',
              yLabelColor: color('red'),
            });
            legend(ctx, fr.right + 40, 11, [
              { label: 'unlimited data', col: color('--ink-2'), dash: true },
              { label: 'D tokens', col: color('orange') },
            ]);
            // the data penalty: gap between the two curves
            const xs = logspace(5, 11, 120);
            ctx.beginPath();
            xs.forEach((n, i) => (i ? ctx.lineTo(fr.X(n), fr.Y(kaplanND(n, D))) : ctx.moveTo(fr.X(n), fr.Y(kaplanND(n, D)))));
            for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(fr.X(xs[i]!), fr.Y(kaplanN(xs[i]!)));
            ctx.closePath();
            ctx.fillStyle = withAlpha(color('orange'), 0.12);
            ctx.fill();
            for (const d of fam) {
              fr.fn(ctx, (n) => kaplanND(n, d), withAlpha(color('orange'), 0.3), 1.3);
              halo(ctx, count(d), fr.right + 4, fr.Y(kaplanND(1e11, d)), withAlpha(color('orange'), 0.85), mono(FONT - 1), 'left');
            }
            fr.fn(ctx, kaplanN, color('--ink-2'), 1.8, { dash: [6, 4] });
            fr.fn(ctx, (n) => kaplanND(n, D), color('orange'), 2.8);
            vline(ctx, fr, Nq, color('blue'), [3, 3], 1.2);
            dot(ctx, fr.X(Nq), fr.Y(kaplanN(Nq)), 4, color('--ink-2'), color('--paper'));
            dot(ctx, fr.X(Nq), fr.Y(kaplanND(Nq, D)), 5, color('orange'), color('--paper'));
            halo(ctx, 'tap or drag to read off a size', fr.left + 6, fr.bottom - 10, color('--ink-3'), ui(FONT), 'left');
          },
        });
        onDrag(pl, (x) => {
          if (!frRef) return;
          Nq = Math.min(1e11, Math.max(1e5, frRef.ix(x)));
          sync();
        });
        const liRo = f.readout('unlimited data');
        const ldRo = f.readout('with D tokens', { sym: 'D' });
        const gRo = f.readout('data penalty');
        const sync = () => {
          const li = kaplanN(Nq);
          const ld = kaplanND(Nq, D);
          f.code.setMany({ D: pySci(D, 2), Nq: pySci(Nq, 2), Li: fmt(li, 3), Ld: fmt(ld, 3) });
          liRo.set(fmt(li, 3));
          ldRo.set(fmt(ld, 3));
          gRo.set(`+${fmt(ld - li, 2)} nats`);
          pl.redraw();
        };
        f.slider({
          label: 'tokens D',
          sym: 'D',
          min: 7,
          max: 11,
          step: 0.05,
          value: 9,
          map: (r) => 10 ** r,
          format: count,
          onInput: (v) => {
            D = v;
            f.code.highlight(['D', 'L']);
            sync();
          },
        });
        sync();
      },
      caption: `Curves from Kaplan's combined formula with their approximate constants, as an illustration of its shape. The dashed line is the pure power law in $\\symN$. With a fixed dataset of $\\symD$ tokens, the orange curve follows it while the model is small, then bends flat: the data, not the model, is now the bottleneck, and more parameters buy almost nothing (the shaded gap is the data penalty). Slide $\\symD$ up and the bend moves right. Notice how much the 10-billion-parameter models lose on a billion tokens: that is the cost of mismatching model and data.`,
    });

    // ------------------------------------------------------------------ flops
    p.h2('Counting compute: C ≈ 6ND', 'flops');
    p.prose(`
Kaplan's third law is about compute, so we need to count it. The unit is the **FLOP**, one floating-point operation: one multiply or one add. (FLOP/s, per second, is a speed, how fast a GPU works; FLOPs without the /s is a count, how much work a training run does.) Nearly all of a transformer's work is matrix multiplies against its weights, and those are easy to count.`);

    p.math({
      label: 'Training compute',
      tex: String.raw`\symC \;\approx\; 6\,\symN\,\symD \;=\; \underbrace{2\symN\symD}_{\text{forward}} \;+\; \underbrace{4\symN\symD}_{\text{backward}}`,
      code: `
        N, D = 70e9, 1.4e12      # Chinchilla's size
        forward = 2 * N * D      # multiply + add per weight
        backward = 4 * N * D     # input and weight grads
        C = forward + backward   # 5.9e23 FLOPs
      `,
      codeTitle: 'flops.py',
      terms: [
        [String.raw`\symN`, 'the number of parameters: each weight takes part in one multiply-add for every token'],
        [String.raw`\symD`, 'the number of training tokens'],
        [String.raw`2\symN\symD`, 'the forward pass: each token meets each weight once, a multiply and then an add into a running sum'],
        [String.raw`4\symN\symD`, 'the backward pass, about twice the forward: one matrix product sends the gradient back to the layer\'s input, another computes the gradient of the weights'],
        [String.raw`\symC`, 'total training FLOPs'],
      ],
      explain: 'Count per weight, per token. In the forward pass a weight multiplies one incoming number and adds the product to a sum: 2 FLOPs. [Backpropagation](#/backprop) needs two matrix products the same size as each forward one, so 4 more. Training therefore costs about 6 FLOPs per parameter per token, and running a trained model costs about 2 per parameter per token (forward only). The rule ignores the attention scores themselves, which grow with context length but stay a small correction while the context is short compared with 12 times the model width (the [Transformer chapter](#/transformer) shows where a block\'s $12d^2$ parameters come from).',
    });

    p.figure({
      title: 'Six FLOPs per weight per token',
      codeTitle: 'six_nd.py',
      code: `
        # one layer: W has shape (d_in, d_out)
        y = x @ W        # forward: 2 per weight     #@fwd
        dx = dy @ W.T    # back to the input: 2      #@bx
        dW = x.T @ dy    # back to the weights: 2    #@bw
        # 6 FLOPs per weight per token, so:
        N, D = {{N:175e9}}, {{D:300e9}}  # {{name:GPT-3}}  #@model
        C = 6 * N * D                # {{C}} FLOPs    #@C
        days = C / (400e12 * 86400)  # {{days}} GPU-days  #@days
      `,
      setup(f) {
        let step = 0;
        let sel = 0;
        const PRESETS = MODELS.filter((m) => ['GPT-3', 'Gopher', 'Chinchilla', 'Llama 3 8B', 'Llama 3.1 405B'].includes(m.name));
        const diagram = f.plot({
          height: 246,
          square: false,
          draw: (pl) => {
            const ctx = pl.ctx;
            const w = pl.w;
            const cs = Math.min(26, (w - 24) / 15.5);
            const cell = (x: number, y: number, k: string, on: number) => {
              ctx.beginPath();
              ctx.roundRect(x + 1.5, y + 1.5, cs - 3, cs - 3, 4);
              ctx.fillStyle = withAlpha(color(k as 'blue'), 0.1 + 0.3 * on);
              ctx.fill();
              ctx.strokeStyle = withAlpha(color(k as 'blue'), 0.45 + 0.55 * on);
              ctx.lineWidth = on ? 1.8 : 1;
              ctx.stroke();
            };
            const block = (x: number, y: number, rows: number, cols: number, k: string, on: number, name: string, shape: string) => {
              for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) cell(x + j * cs, y + i * cs, k, on);
              ctx.fillStyle = color(k as 'blue');
              ctx.font = ital(15);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(name, x + (cols * cs) / 2, y - 4);
              ctx.fillStyle = color('--ink-3');
              ctx.font = mono(FONT - 1);
              ctx.textBaseline = 'top';
              ctx.fillText(shape, x + (cols * cs) / 2, y + rows * cs + 3);
            };
            const op = (s: string, x: number, y: number) => {
              ctx.fillStyle = color('--ink-2');
              ctx.font = mono(15, 400);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(s, x, y);
            };
            const titles = ['forward: y = x @ W', 'backward to the input: dx = dy @ W.T', 'backward to the weights: dW = x.T @ dy', 'all three, for every weight and token'];
            ctx.fillStyle = color('--ink');
            ctx.font = ui(13, 600);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(titles[step]!, 10, 8);
            const top = 62;
            const mid = top + 2 * cs;
            const gap = cs * 0.9;
            // three products laid out left to right: A @ B = R
            type Blk = [number, number, string, string, string];
            const layouts: Blk[][] = [
              [[1, 4, 'orange', 'x', '1×4'], [4, 3, 'blue', 'W', '4×3'], [1, 3, 'purple', 'y', '1×3']],
              [[1, 3, 'teal', 'dy', '1×3'], [3, 4, 'blue', 'W.T', '3×4'], [1, 4, 'teal', 'dx', '1×4']],
              [[4, 1, 'orange', 'x.T', '4×1'], [1, 3, 'teal', 'dy', '1×3'], [4, 3, 'teal', 'dW', '4×3']],
            ];
            const lay = layouts[Math.min(step, 2)]!;
            const widths = lay.map((b) => b[1] * cs);
            const total = widths.reduce((a, b) => a + b, 0) + 2 * (gap + cs * 0.4) + gap;
            let x = Math.max(8, (w - total) / 2);
            const on = step < 3 ? 1 : 0.35;
            lay.forEach((b, i) => {
              const y = mid - (b[0] * cs) / 2;
              block(x, y, b[0], b[1], b[2], i === 2 ? on : 0.25, b[3], b[4]);
              x += widths[i]!;
              if (i < 2) {
                op(i === 0 ? '@' : '=', x + gap / 2 + cs * 0.2, mid);
                x += gap + cs * 0.4;
              }
            });
            // tally: six units, two per product
            const tw = Math.min(w - 20, 300);
            const tx = (w - tw) / 2;
            const ty = pl.h - 28;
            const names = ['y', 'dx', 'dW'];
            const cols = ['purple', 'teal', 'teal'];
            for (let i = 0; i < 3; i++) {
              const filled = i <= step;
              const x0 = tx + (i * tw) / 3;
              ctx.beginPath();
              ctx.roundRect(x0 + 2, ty, tw / 3 - 4, 20, 5);
              ctx.fillStyle = withAlpha(color(cols[i] as 'teal'), filled ? (i === step || step === 3 ? 0.55 : 0.3) : 0.06);
              ctx.fill();
              ctx.strokeStyle = withAlpha(color(cols[i] as 'teal'), filled ? 0.9 : 0.3);
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.fillStyle = filled ? color('--ink') : color('--ink-3');
              ctx.font = mono(FONT);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(`${names[i]} +2`, x0 + tw / 6, ty + 10.5);
            }
            ctx.fillStyle = color('--ink-2');
            ctx.font = ui(FONT);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const sofar = 2 * Math.min(step + 1, 3);
            ctx.fillText(`FLOPs per weight per token so far: ${sofar}${step === 3 ? ', so C ≈ 6ND' : ''}`, w / 2, ty - 6);
          },
        });
        diagram.canvas.classList.add('scroll-ok');
        const bars = f.plot({
          height: PRESETS.length * 34 + 30,
          square: false,
          draw: (pl) => {
            const ctx = pl.ctx;
            const w = pl.w;
            const nameW = Math.min(118, w * 0.33);
            const x0 = nameW + 6;
            const x1 = w - 24;
            const lo = 21;
            const hi = 26;
            const X = (c: number) => x0 + ((Math.log10(c) - lo) / (hi - lo)) * (x1 - x0);
            for (let e = lo; e <= hi; e++) {
              rich(ctx, `10^${e}`, X(10 ** e), 10, { px: FONT, family: MONO, fill: color('--ink-3'), align: 'center' });
              ctx.beginPath();
              ctx.moveTo(Math.round(X(10 ** e)) + 0.5, 18);
              ctx.lineTo(Math.round(X(10 ** e)) + 0.5, pl.h - 4);
              ctx.strokeStyle = color('--grid');
              ctx.lineWidth = 1;
              ctx.stroke();
            }
            PRESETS.forEach((m, i) => {
              const y = 22 + i * 34;
              const C = 6 * m.N * m.D;
              const on = i === sel;
              if (on) {
                ctx.fillStyle = withAlpha(color('purple'), 0.08);
                ctx.fillRect(2, y, w - 4, 32);
              }
              ctx.fillStyle = on ? color('--ink') : color('--ink-2');
              ctx.font = ui(12, on ? 600 : 400);
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              ctx.fillText(m.name, 8, y + 3);
              ctx.font = mono(FONT - 1);
              ctx.fillStyle = color('--ink-3');
              ctx.fillText(`${count(m.N)} × ${count(m.D)}`, 8, y + 18);
              ctx.beginPath();
              ctx.roundRect(x0, y + 8, Math.max(2, X(C) - x0), 16, 4);
              ctx.fillStyle = withAlpha(color('purple'), on ? 0.7 : 0.3);
              ctx.fill();
              const label = sci(C, 2, true);
              const ro = { px: FONT, family: MONO, weight: on ? 600 : 500, fill: color('--ink'), align: 'right' as CanvasTextAlign };
              const lw = rich(ctx, label, -1e4, -1e4, ro);
              const inside = X(C) - x0 > lw + 12;
              rich(ctx, label, inside ? X(C) - 6 : X(C) + 6, y + 16.5, { ...ro, fill: inside ? (on ? color('--paper') : color('--ink')) : color('--ink-2'), align: inside ? 'right' : 'left' });
            });
          },
        });
        bars.canvas.classList.add('scroll-ok');
        bars.canvas.addEventListener('click', (e) => {
          const [, y] = local(bars, e as PointerEvent);
          const i = Math.floor((y - 22) / 34);
          if (i >= 0 && i < PRESETS.length) {
            sel = i;
            f.code.highlight(['model', 'C', 'days']);
            sync();
          }
        });
        const cRo = f.readout('C = 6ND', { sym: 'C' });
        const dRo = f.readout('GPU-days at 400 TFLOP/s');
        const sync = () => {
          const m = PRESETS[sel]!;
          const C = 6 * m.N * m.D;
          const days = C / (400e12 * 86400);
          f.code.setMany({ N: pySci(m.N, 3), D: pySci(m.D, 3), name: m.name, C: pySci(C, 2), days: Math.round(days).toLocaleString('en-US') });
          cRo.set(sci(C, 2));
          dRo.set(Math.round(days).toLocaleString('en-US'));
          bars.redraw();
        };
        f.stepper({
          steps: 4,
          interval: 1600,
          label: (k) => ['forward', 'backward: input', 'backward: weights', 'total: 6'][k]!,
          onStep: (k) => {
            step = k;
            f.code.highlight(['fwd', 'bx', 'bw', ['fwd', 'bx', 'bw']][k] as string | string[]);
            diagram.redraw();
          },
        });
        sync();
      },
      caption: `Step through one layer's three matrix products. Each has one multiply and one add per weight per token, so a training step costs 6 FLOPs per parameter per token; the whole network is just many such layers. Then tap a model in the list. Four of these runs used similar compute, within a factor of about 2.5, yet split it very differently between parameters and tokens: that split is what the rest of the chapter is about. GPU-days assume a sustained 400 trillion FLOPs per second per GPU, roughly 40% of an H100's peak bf16 rate; [Training across many GPUs](#/parallelism) covers why the real rate is well below the peak.`,
    });

    // ------------------------------------------------------------------ frontier
    p.h2('The compute frontier', 'frontier');
    p.prose(`
Now combine the pieces. Pick a model size $\\symN$ and train it on more and more tokens: every token costs $6\\symN$ FLOPs and lowers the loss, quickly at first and then slowly, until the model's size becomes the bottleneck and its curve flattens. Do that for many sizes and plot loss against compute. Small models are cheap per token, so they win at small budgets; large models win at large budgets. The lower edge of the whole family, the best loss *any* model reaches for each budget, is the **compute-efficient frontier**, and it is close to a straight line on log-log axes. That is the law for $\\symL(\\symC)$.`);

    p.figure({
      title: 'Many model sizes, one frontier',
      codeTitle: 'frontier.py',
      code: `
        E, A, B = 1.7, 400, 980        # illustrative
        alpha = beta = 0.3
        sizes = np.logspace(7, 11, 9)  # 10M to 100B
        for N in sizes:                                #@runs
            D = np.logspace(8, 13, 200)  # tokens
            C = 6 * N * D                              #@cost
            L = E + A / N**alpha + B / D**beta         #@loss
            plt.loglog(C, L{{minusE:}})                #@plot
        # C = {{C}}: best N = {{Nbest}}             #@best
        # that is {{ratio}} tokens per parameter     #@best
      `,
      setup(f) {
        let Cb = 1e21;
        let minusE = false;
        const sizes = logspace(7, 11, 9);
        let frRef: Frame | null = null;
        const curveL = (N: number, C: number) => lossND(SURF, N, C / (6 * N));
        const best = () => {
          let bi = 0;
          sizes.forEach((N, i) => {
            if (curveL(N, Cb) < curveL(sizes[bi]!, Cb)) bi = i;
          });
          return bi;
        };
        const pl = f.plot({
          aspect: 1.15,
          square: false,
          draw: (pl) => {
            const ctx = pl.ctx;
            const off = minusE ? SURF.E : 0;
            const ya: Axis = minusE ? { lo: 0.1, hi: 7, log: true } : { lo: 1.8, hi: 8, log: true };
            const fr = frameIn(pl, { lo: 1e16, hi: 1e24, log: true }, ya, { t: 30, r: 16 });
            frRef = fr;
            drawAxes(ctx, fr, {
              font: FONT,
              xTicks: decades(1e16, 1e24, 2),
              yTicks: minusE ? [0.1, 0.2, 0.5, 1, 2, 5] : lossTicks(1.8, 8),
              xFmt: pow10,
              yFmt: (v) => String(v),
              xLabel: 'training compute C (FLOPs)',
              xLabelColor: color('purple'),
              yLabel: minusE ? 'L − E' : 'loss L',
              yLabelColor: color('red'),
            });
            legend(ctx, fr.right, 11, [
              { label: 'one model size', col: withAlpha(color('blue'), 0.6) },
              { label: 'frontier', col: color('red') },
            ]);
            const bi = best();
            sizes.forEach((N, i) => {
              const D = logspace(8, 13, 120);
              fr.path(ctx, D.map((d) => 6 * N * d), D.map((d) => lossND(SURF, N, d) - off), withAlpha(color('blue'), i === bi ? 1 : 0.32), i === bi ? 2.6 : 1.3);
              const e = Math.round(Math.log10(N));
              if (Math.abs(Math.log10(N) - e) < 1e-6 && N < 1e11) {
                const xEnd = 6 * N * 1e13;
                halo(ctx, count(N), fr.X(xEnd) + 4, fr.Y(lossND(SURF, N, 1e13) - off), withAlpha(color('blue'), 0.9), mono(FONT - 1), 'left');
              }
            });
            fr.fn(ctx, (C) => optimum(SURF, C).L - off, color('red'), 2.6);
            vline(ctx, fr, Cb, color('purple'));
            const o = optimum(SURF, Cb);
            dot(ctx, fr.X(Cb), fr.Y(curveL(sizes[bi]!, Cb) - off), 5, color('blue'), color('--paper'));
            dot(ctx, fr.X(Cb), fr.Y(o.L - off), 4, color('red'), color('--paper'));
            halo(ctx, 'drag to move the budget', fr.left + 6, fr.bottom - 10, color('--ink-3'), ui(FONT), 'left');
          },
        });
        onDrag(pl, (x) => {
          if (!frRef) return;
          Cb = Math.min(1e24, Math.max(1e16, frRef.ix(x)));
          cSlider.set(Math.log10(Cb), false);
          sync();
        });
        const nRo = f.readout('best size drawn', { sym: 'N' });
        const rRo = f.readout('its tokens per parameter');
        const oRo = f.readout('exact optimum');
        const sync = () => {
          const N = sizes[best()]!;
          const D = Cb / (6 * N);
          f.code.setMany({ C: pySci(Cb, 2), Nbest: pySci(N, 3), ratio: ratioStr(D / N) });
          nRo.set(count(N, 2));
          rRo.set(ratioStr(D / N));
          oRo.set(`${count(optimum(SURF, Cb).N, 2)} params`);
          f.code.highlight('best');
          pl.redraw();
        };
        const cSlider = f.slider({
          label: 'budget C',
          sym: 'C',
          min: 16,
          max: 24,
          step: 0.05,
          value: 21,
          map: (r) => 10 ** r,
          format: (v) => sci(v, 2),
          onInput: (v) => {
            Cb = v;
            sync();
          },
        });
        f.toggle({
          label: 'subtract the floor (plot L − E)',
          value: false,
          onChange: (v) => {
            minusE = v;
            f.code.set('minusE', v ? ' - E' : '');
            f.code.highlight('plot');
            pl.redraw();
          },
        });
        sync();
      },
      caption: `Each blue curve is one model size: the final loss it reaches when trained (with a learning-rate schedule matched to the run's length) on more and more tokens, plotted against the compute that costs. The red curve is the frontier. Drag the budget: the winning size moves right as compute grows, and it always sits near the knee of its curve. The losses come from an illustrative formula of Chinchilla's form, introduced in the next section. Tick **subtract the floor** and the frontier becomes a straight line: a power law plus a constant.`,
    });

    p.prose(`
### Kaplan's answer

Kaplan et al. measured how the winning model size grows along the frontier and found, roughly, $\\symN_{\\text{opt}} \\propto \\symC^{0.73}$, while the data grows only as $\\symC^{0.27}$ (the symbol $\\propto$ means "proportional to"). Ten times more compute should buy a model about 5.4 times bigger, trained on fewer than twice as many tokens. Their advice, in their words, was to train very large models on a relatively modest amount of data and to stop significantly before convergence.`);

    p.callout('history', `The field followed. GPT-3 (2020) had 175 billion parameters and was trained on 300 billion tokens, under 2 tokens per parameter. DeepMind's Gopher (2021) had 280 billion parameters, also on 300 billion tokens. Megatron-Turing NLG (2022) had 530 billion on 270 billion. The race was for parameters, and the token budget barely moved.`, 'Context');

    // ------------------------------------------------------------------ chinchilla
    p.h2('Chinchilla: compute-optimal training', 'chinchilla');
    p.prose(`
In March 2022, Jordan Hoffmann and colleagues at DeepMind asked the budget question again. They trained over 400 models, from 70 million to over 16 billion parameters, on 5 to 500 billion tokens, and gave each run a learning-rate schedule whose length matched that run's own number of tokens. They then estimated the best split three independent ways:

1. **The frontier**, as in the figure above: train each size for several lengths and read off which size is best at each budget.
2. **IsoFLOP profiles**: fix a budget, train models of many sizes using exactly that budget, and find the size with the lowest final loss. Repeat for several budgets.
3. **A fitted formula** for the loss as a function of both $\\symN$ and $\\symD$, then solve for the best split on paper.

All three agreed with each other, and disagreed with Kaplan. Here is the formula from the third method:`);

    p.math({
      label: "Chinchilla's parametric loss",
      tex: String.raw`\symL(\symN, \symD) \;=\; \symE \;+\; \frac{A}{\symN^{\symalpha}} \;+\; \frac{B}{\symD^{\symbeta}}`,
      code: `
        # Chinchilla's published fit (approximate)
        E, A, B = 1.69, 406.4, 410.7
        alpha, beta = 0.34, 0.28
        def loss(N, D):
            return E + A / N**alpha + B / D**beta
        loss(70e9, 1.4e12)    # about 1.94 nats per token
      `,
      codeTitle: 'chinchilla_fit.py',
      terms: [
        [String.raw`\symE`, 'the irreducible loss: the uncertainty left in text itself, which a perfect model would still pay'],
        [String.raw`A / \symN^{\symalpha}`, 'the penalty for having only $N$ parameters; it shrinks as the model grows'],
        [String.raw`B / \symD^{\symbeta}`, 'the penalty for having seen only $D$ tokens; it shrinks with more data'],
        [String.raw`\symalpha,\ \symbeta`, 'how fast each penalty shrinks. The fit put both near 0.3'],
      ],
      explain: 'Three things add up: a floor you cannot beat, a model-size penalty and a data penalty. Each penalty is a power law, so it falls by a fixed fraction every time its resource is multiplied by ten, and neither ever reaches zero. Give a model unlimited data and its loss stops at $E + A/N^{\\alpha}$; give it unlimited parameters and the loss stops at $E + B/D^{\\beta}$. A fixed budget forces you to buy some of each, and the question is the mix.',
    });

    p.callout('warning', `Treat these constants as approximate. Plugged into the optimum formula below, the published fit recommends a noticeably smaller model at Gopher's budget than the paper's other two methods do, and a 2024 replication attempt (Besiroglu et al.) re-estimated the fit. So every figure from here on uses **round illustrative constants** of the same form, $\\symE = 1.7$, $A = 400$, $B = 980$, $\\symalpha = \\symbeta = 0.3$, chosen to reproduce the paper's headline result: about 20 tokens per parameter.`, 'Approximate constants');

    p.prose(`
### Spending one budget

Fix a budget $\\symC$. Every way to spend it all satisfies $\\symC = 6\\symN\\symD$, so choosing $\\symN$ forces $\\symD = \\symC / (6\\symN)$. Plotted on log axes with $\\symN$ across and $\\symD$ up, those choices form a straight line with slope $-1$. The loss formula draws contours on the same plane: curves of equal loss, like height lines on a map. The best split is the point where the budget line just touches the lowest contour it can reach. Walk along the budget line and the loss traces a valley; too small a model is limited by its size, too large a model by its data.`);

    p.figure({
      title: 'Split a compute budget between parameters and tokens',
      codeTitle: 'isoflop.py',
      code: `
        E, A, B = 1.7, 400, 980       # illustrative
        alpha = beta = 0.3
        C = {{C:5.8e23}}              # the budget   #@C
        N = np.logspace(7, 13, 600)   # candidate sizes
        D = C / (6 * N)               # spend it all  #@line
        L = E + A / N**alpha + B / D**beta            #@L
        i = np.argmin(L)              # valley floor  #@argmin
        N_opt, D_opt = N[i], D[i]                     #@argmin
        # N_opt = {{Nopt}}, D_opt = {{Dopt}}
        # {{ratio}} tokens per parameter
      `,
      setup(f) {
        let C = 5.8e23;
        let pickN = 1e10;
        let showModels = false;
        let frP: Frame | null = null;
        let frV: Frame | null = null;
        const levels = [1.9, 2.0, 2.2, 2.5, 3.0, 3.5, 4.0, 5.0];
        const along = (N: number) => lossND(SURF, N, C / (6 * N));
        const plane = f.plot({
          aspect: 1.05,
          square: false,
          draw: (pl) => {
            const ctx = pl.ctx;
            const fr = frameIn(pl, { lo: 1e7, hi: 1e13, log: true }, { lo: 1e8, hi: 1e14, log: true }, { r: 40, t: 26 });
            frP = fr;
            // loss as a faint heat map: darker is lower
            const cellPx = 6;
            const cols = Math.ceil((fr.right - fr.left) / cellPx);
            const rows = Math.ceil((fr.bottom - fr.top) / cellPx);
            const img = new ImageData(cols, rows);
            const [r0, g0, b0] = [parseInt(color('red').slice(1, 3), 16), parseInt(color('red').slice(3, 5), 16), parseInt(color('red').slice(5, 7), 16)];
            for (let j = 0; j < rows; j++)
              for (let i = 0; i < cols; i++) {
                const N = fr.ix(fr.left + (i + 0.5) * cellPx);
                const D = fr.iy(fr.top + (j + 0.5) * cellPx);
                const L = lossND(SURF, N, D);
                const a = Math.max(0, Math.min(1, (5.5 - L) / 3.6)) ** 1.4;
                const o = (j * cols + i) * 4;
                img.data[o] = r0;
                img.data[o + 1] = g0;
                img.data[o + 2] = b0;
                img.data[o + 3] = Math.round(34 * a);
              }
            const tmp = document.createElement('canvas');
            tmp.width = cols;
            tmp.height = rows;
            tmp.getContext('2d')!.putImageData(img, 0, 0);
            fr.clip(ctx, () => {
              ctx.imageSmoothingEnabled = true;
              ctx.drawImage(tmp, fr.left, fr.top, cols * cellPx, rows * cellPx);
            });
            drawAxes(ctx, fr, {
              font: FONT,
              xTicks: decades(1e7, 1e13),
              yTicks: decades(1e8, 1e14),
              xFmt: count,
              yFmt: count,
              xLabel: 'parameters N',
              xLabelColor: color('blue'),
              yLabel: 'tokens D',
              yLabelColor: color('orange'),
            });
            const o = optimum(SURF, C);
            const Ns = logspace(7, 13, 200);
            for (const Lv of levels) {
              fr.path(ctx, Ns, Ns.map((n) => tokensFor(SURF, n, Lv)), withAlpha(color('red'), 0.45), 1);
              const yEnd = tokensFor(SURF, 1e13, Lv);
              if (yEnd > 1e8 && yEnd < 1e14) halo(ctx, String(Lv), fr.right + 4, fr.Y(yEnd), withAlpha(color('red'), 0.85), mono(FONT - 1), 'left');
            }
            fr.path(ctx, Ns, Ns.map((n) => tokensFor(SURF, n, o.L)), color('red'), 2.2);
            // 20 tokens per parameter
            fr.path(ctx, [1e7, 5e12], [2e8, 1e14], color('--ink-3'), 1.2, [4, 4]);
            halo(ctx, 'D = 20 N', fr.X(4e8) - 8, fr.Y(8e9) - 4, color('--ink-3'), ui(FONT), 'right', 'bottom');
            // the budget line
            fr.path(ctx, [1e7, 1e13], [C / 6e7, C / 6e13], color('purple'), 2.2);
            const lx = Math.max(1e7 * 1.3, C / 6 / 1e14 * 1.3);
            halo(ctx, 'C = 6ND', fr.X(lx), fr.Y(C / (6 * lx)) - 4, color('purple'), ui(FONT, 600), 'left', 'bottom');
            if (showModels) {
              const place: Record<string, [number, number, CanvasTextAlign]> = {
                'GPT-3': [-7, 0, 'right'],
                Gopher: [7, 0, 'left'],
                'MT-NLG': [7, 0, 'left'],
                Chinchilla: [7, 0, 'left'],
                'LLaMA 7B': [-7, 0, 'right'],
                'Llama 2 70B': [7, -2, 'left'],
                'Llama 3 8B': [-7, 0, 'right'],
                'Llama 3.1 405B': [-7, 10, 'right'],
              };
              for (const m of MODELS) {
                if (m.name === 'MT-NLG' || m.name === 'Llama 2 70B') continue;
                const [dx, dy, al] = place[m.name]!;
                dot(ctx, fr.X(m.N), fr.Y(m.D), 4, color('--ink'), color('--paper'));
                halo(ctx, m.name, fr.X(m.N) + dx, fr.Y(m.D) + dy, color('--ink'), ui(FONT, 600), al);
              }
            }
            dot(ctx, fr.X(pickN), fr.Y(C / (6 * pickN)), 6, 'transparent', color('blue'), 2.2);
            dot(ctx, fr.X(o.N), fr.Y(o.D), 5.5, color('red'), color('--paper'));
          },
        });
        const valley = f.plot({
          height: 168,
          square: false,
          draw: (pl) => {
            const ctx = pl.ctx;
            const o = optimum(SURF, C);
            const lo = o.L - 0.35;
            const hi = o.L + 0.9;
            const fr = frameIn(pl, { lo: 1e7, hi: 1e13, log: true }, { lo, hi }, { r: 40, t: 24, b: 34 });
            frV = fr;
            const step = 0.2;
            const yt: number[] = [];
            for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yt.push(Number(v.toFixed(2)));
            drawAxes(ctx, fr, { font: FONT, xTicks: decades(1e7, 1e13), yTicks: yt, xFmt: count, yFmt: (v) => fmt(v, 3), yLabel: 'loss along the budget line (drag to pick)', yLabelColor: color('red') });
            fr.fn(ctx, along, color('red'), 2.4, { n: 300 });
            const kN = Math.sqrt(C / 6 / 1.7);
            if (along(kN) < hi) {
              dot(ctx, fr.X(kN), fr.Y(along(kN)), 4, color('--ink-3'), color('--paper'));
              halo(ctx, "GPT-3's 1.7 tok/param", fr.X(kN) + 6, fr.Y(along(kN)) + 13, color('--ink-3'), ui(FONT), 'left');
            }
            dot(ctx, fr.X(pickN), fr.Y(along(pickN)), 6, 'transparent', color('blue'), 2.2);
            dot(ctx, fr.X(o.N), fr.Y(o.L), 5, color('red'), color('--paper'));
          },
        });
        const drag = (fr: () => Frame | null) => (x: number) => {
          const F = fr();
          if (!F) return;
          pickN = Math.min(1e13, Math.max(1e7, F.ix(x)));
          sync();
        };
        onDrag(plane, drag(() => frP));
        onDrag(valley, drag(() => frV));
        const nRo = f.readout('best N', { sym: 'N' });
        const dRo = f.readout('best D', { sym: 'D' });
        const rRo = f.readout('tokens per parameter');
        const lRo = f.readout('best loss', { sym: 'L' });
        const pRo = f.readout('your pick');
        const sync = () => {
          const o = optimum(SURF, C);
          f.code.setMany({ C: pySci(C, 2), Nopt: pySci(o.N, 2), Dopt: pySci(o.D, 2), ratio: ratioStr(o.D / o.N) });
          nRo.set(count(o.N, 2));
          dRo.set(count(o.D, 2));
          rRo.set(ratioStr(o.D / o.N));
          lRo.set(fmt(o.L, 3));
          const dl = along(pickN) - o.L;
          pRo.set(`${count(pickN, 2)} · ${ratioStr(C / 6 / pickN / pickN)}/param · +${fmt(dl, 2)}`);
          plane.redraw();
          valley.redraw();
        };
        f.slider({
          label: 'budget C',
          sym: 'C',
          min: 18,
          max: 26,
          step: 0.02,
          value: Math.log10(5.8e23),
          map: (r) => 10 ** r,
          format: (v) => sci(v, 2),
          onInput: (v) => {
            C = v;
            f.code.highlight(['C', 'line']);
            sync();
          },
        });
        f.toggle({
          label: 'show real models (N and D only)',
          value: false,
          onChange: (v) => {
            showModels = v;
            plane.redraw();
          },
        });
        sync();
      },
      caption: `**Top:** the plane of model size against tokens, both on log axes. Red contours are equal loss (darker background is lower loss), the purple line is every way to spend the budget, and the red dot is where it touches the lowest contour. **Bottom:** the loss along that line, an isoFLOP valley. Drag on either plot to try your own size (the blue ring) and see how much loss a bad split costs; the grey dot is GPT-3's 1.7 tokens per parameter at the same budget. Slide the budget: the optimum slides along the dashed line of 20 tokens per parameter. **Show real models** places published models by their parameter and token counts only (their losses are not on this illustrative surface): the 2020 to 2021 models sit far below the line, recent ones far above it.`,
    });

    p.math({
      label: 'The compute-optimal split',
      tex: String.raw`\begin{aligned} \sym{N}{N_{\text{opt}}} &= G\Big(\frac{\symC}{6}\Big)^{\frac{\symbeta}{\symalpha+\symbeta}} \\ \sym{D}{D_{\text{opt}}} &= \frac{1}{G}\Big(\frac{\symC}{6}\Big)^{\frac{\symalpha}{\symalpha+\symbeta}} \\ G &= \Big(\frac{\symalpha A}{\symbeta B}\Big)^{\frac{1}{\symalpha+\symbeta}} \end{aligned}`,
      code: `
        def optimum(C, A=400, B=980, alpha=0.3, beta=0.3):
            G = (alpha * A / (beta * B)) ** (1 / (alpha + beta))
            N_opt = G * (C / 6) ** (beta / (alpha + beta))
            D_opt = (C / 6) / N_opt     # the rest: tokens
            return N_opt, D_opt
        optimum(5.8e23)   # 7.0e10 params, 1.4e12 tokens
      `,
      codeTitle: 'optimum.py',
      terms: [
        [String.raw`\symC / 6`, 'the budget in units of "parameter-tokens": exactly $N \\times D$'],
        [String.raw`\frac{\symbeta}{\symalpha+\symbeta}`, 'the share of each extra decade of compute that goes to model size'],
        [String.raw`\frac{\symalpha}{\symalpha+\symbeta}`, 'the share that goes to data. The two shares add up to 1'],
        [String.raw`G`, 'a constant that sets the ratio of tokens to parameters'],
      ],
      explain: 'This comes from one line of calculus: substitute $D = C/(6N)$ into the loss and find where its slope with respect to $N$ is zero, the bottom of the valley. What matters is the exponents. Multiply the budget by 10 and the best model grows by $10^{\\beta/(\\alpha+\\beta)}$, the data by $10^{\\alpha/(\\alpha+\\beta)}$. When the two penalties shrink at the same rate ($\\alpha = \\beta$), both shares are one half: each 10 times more compute becomes about 3.2 times more parameters *and* 3.2 times more tokens, and the tokens-per-parameter ratio stays fixed. Chinchilla\'s three methods put the model-size exponent at 0.46 to 0.50; Kaplan had 0.73.',
    });

    p.callout('math', `Write the loss along the budget line as $f(N) = E + A N^{-\\alpha} + B (C/6)^{-\\beta} N^{\\beta}$, using $D^{-\\beta} = (C/6)^{-\\beta} N^{\\beta}$. Its slope is $f'(N) = -\\alpha A N^{-\\alpha-1} + \\beta B (C/6)^{-\\beta} N^{\\beta-1}$. At the bottom of the valley the slope is zero, which rearranges to $N^{\\alpha+\\beta} = \\frac{\\alpha A}{\\beta B}(C/6)^{\\beta}$. Take the $(\\alpha+\\beta)$-th root of both sides and you have the formula above. The two penalty terms are then in a fixed proportion: at the optimum, $\\alpha$ times the size penalty equals $\\beta$ times the data penalty.`, 'Math help: the bottom of the valley');

    p.figure({
      title: 'Where the optimum goes as compute grows',
      codeTitle: 'exponents.py',
      code: `
        E, A, B = 1.7, 400, 980
        alpha, beta = {{alpha:0.3}}, {{beta:0.3}}
        budgets = 10.0 ** np.arange(18, 25)  # FLOPs
        N = np.logspace(3, 21, 1800)         # wide grid
        N_opt = []
        for C in budgets:                              #@valley
            D = C / (6 * N)                            #@valley
            L = E + A / N**alpha + B / D**beta         #@valley
            N_opt.append(N[np.argmin(L)])              #@argmin
        u = np.log10(budgets)
        a, _ = np.polyfit(u, np.log10(N_opt), 1)       #@fit
        # a = {{a}}; theory beta/(alpha+beta) = {{ab}}
      `,
      setup(f) {
        let al = 0.3;
        let be = 0.3;
        const budgets = Array.from({ length: 7 }, (_, i) => 10 ** (18 + i));
        const grid = logspace(3, 21, 1800);
        let res: { C: number; N: number; D: number; L: number; curve: number[] }[] = [];
        let slopeN = 0.5;
        let slopeD = 0.5;
        const surf = (): Surface => ({ ...SURF, alpha: al, beta: be });
        const solve = () => {
          const s = surf();
          res = budgets.map((C) => {
            let bi = 0;
            const curve = grid.map((n) => lossND(s, n, C / (6 * n)));
            curve.forEach((v, i) => {
              if (v < curve[bi]!) bi = i;
            });
            const N = grid[bi]!;
            return { C, N, D: C / (6 * N), L: curve[bi]!, curve };
          });
          const u = budgets.map(Math.log10);
          const fitLine = (vs: number[]) => {
            const mu = u.reduce((a, b) => a + b, 0) / u.length;
            const mv = vs.reduce((a, b) => a + b, 0) / vs.length;
            let sxy = 0;
            let sxx = 0;
            u.forEach((x, i) => {
              sxy += (x - mu) * (vs[i]! - mv);
              sxx += (x - mu) ** 2;
            });
            return sxy / sxx;
          };
          slopeN = fitLine(res.map((r) => Math.log10(r.N)));
          slopeD = fitLine(res.map((r) => Math.log10(r.D)));
        };
        const valleys = f.plot({
          aspect: 1.7,
          square: false,
          draw: (pl) => {
            const ctx = pl.ctx;
            const nLo = Math.min(...res.map((r) => r.N));
            const nHi = Math.max(...res.map((r) => r.N));
            const xlo = 10 ** Math.floor(Math.log10(nLo) - 1);
            const xhi = 10 ** Math.ceil(Math.log10(nHi) + 1);
            const lLo = Math.min(...res.map((r) => r.L));
            const lHi = Math.max(...res.map((r) => r.L));
            const ylo = Math.max(SURF.E, lLo - 0.15);
            const yhi = lHi + 0.8;
            const fr = frameIn(pl, { lo: xlo, hi: xhi, log: true }, { lo: ylo, hi: yhi }, { t: 24, b: 34 });
            const span = yhi - ylo;
            const st = span > 4 ? 1 : span > 2 ? 0.5 : 0.25;
            const yt: number[] = [];
            for (let v = Math.ceil(ylo / st) * st; v <= yhi; v += st) yt.push(Number(v.toFixed(2)));
            const every = Math.log10(xhi / xlo) > 8 ? 2 : 1;
            drawAxes(ctx, fr, { font: FONT, xTicks: decades(xlo, xhi, every), yTicks: yt, xFmt: count, yFmt: (v) => fmt(v, 3), yLabel: 'isoFLOP valleys: loss vs N', yLabelColor: color('red') });
            res.forEach((r, i) => {
              const a = 0.35 + (0.6 * i) / (res.length - 1);
              fr.path(ctx, grid, r.curve, withAlpha(color('red'), a), 1.6);
            });
            fr.path(ctx, res.map((r) => r.N), res.map((r) => r.L), color('--ink-2'), 1.2, [3, 3]);
            res.forEach((r) => dot(ctx, fr.X(r.N), fr.Y(r.L), 4, color('blue'), color('--paper')));
            rich(ctx, 'C = 10^18', fr.X(res[0]!.N) + 7, fr.Y(res[0]!.L) - 10, { px: FONT, family: MONO, fill: color('purple'), align: 'left', halo: '--paper' });
            rich(ctx, '10^24', fr.X(res[6]!.N) + 7, fr.Y(res[6]!.L) - 9, { px: FONT, family: MONO, fill: color('purple'), align: 'left', halo: '--paper' });
          },
        });
        const lines = f.plot({
          aspect: 1.35,
          square: false,
          draw: (pl) => {
            const ctx = pl.ctx;
            const all = res.flatMap((r) => [r.N, r.D]);
            const ylo = 10 ** Math.floor(Math.log10(Math.min(...all)));
            const yhi = 10 ** Math.ceil(Math.log10(Math.max(...all)));
            const fr = frameIn(pl, { lo: 3e17, hi: 3e24, log: true }, { lo: ylo, hi: yhi, log: true }, { t: 30 });
            const every = Math.log10(yhi / ylo) > 9 ? 2 : 1;
            drawAxes(ctx, fr, { font: FONT, xTicks: decades(1e18, 1e24, 2), yTicks: decades(ylo, yhi, every), xFmt: pow10, yFmt: count, xLabel: 'compute C (FLOPs)', xLabelColor: color('purple') });
            legend(ctx, fr.right, 11, [
              { label: 'N_opt', col: color('blue') },
              { label: 'D_opt', col: color('orange') },
              { label: 'slope 0.73', col: color('--ink-3'), dash: true },
            ]);
            const r0 = res[0]!;
            fr.path(ctx, [1e18, 1e24], [r0.N, r0.N * 10 ** (6 * 0.73)], color('--ink-3'), 1.3, [4, 4]);
            fr.path(ctx, res.map((r) => r.C), res.map((r) => r.N), color('blue'), 2.2);
            fr.path(ctx, res.map((r) => r.C), res.map((r) => r.D), color('orange'), 2.2);
            res.forEach((r) => {
              dot(ctx, fr.X(r.C), fr.Y(r.N), 3.5, color('blue'), color('--paper'));
              dot(ctx, fr.X(r.C), fr.Y(r.D), 3.5, color('orange'), color('--paper'));
            });
            const r3 = res[3]!;
            halo(ctx, `slope ${fmt(slopeN, 2)}`, fr.X(r3.C) + 8, fr.Y(r3.N) + 12, color('blue'), mono(FONT, 600), 'left');
            halo(ctx, `slope ${fmt(slopeD, 2)}`, fr.X(r3.C) - 8, fr.Y(r3.D) - 12, color('orange'), mono(FONT, 600), 'right');
          },
        });
        const aRo = f.readout('size exponent', { sym: 'N' });
        const bRo = f.readout('data exponent', { sym: 'D' });
        const rRo = f.readout('tokens per parameter at 10²⁴');
        const sync = () => {
          solve();
          const ab = be / (al + be);
          f.code.setMany({ alpha: fmt(al, 2), beta: fmt(be, 2), a: fmt(slopeN, 3), ab: fmt(ab, 3) });
          aRo.set(fmt(slopeN, 2));
          bRo.set(fmt(slopeD, 2));
          rRo.set(ratioStr(res[6]!.D / res[6]!.N));
          valleys.redraw();
          lines.redraw();
        };
        brk(f);
        const aS = f.slider({ label: 'α (size penalty)', sym: 'alpha', min: 0.2, max: 0.5, step: 0.01, value: 0.3, onInput: (v) => { al = v; f.code.highlight(['valley', 'fit']); sync(); } });
        brk(f);
        const bS = f.slider({ label: 'β (data penalty)', sym: 'beta', min: 0.2, max: 0.55, step: 0.01, value: 0.3, onInput: (v) => { be = v; f.code.highlight(['valley', 'fit']); sync(); } });
        brk(f);
        f.button('α = β = 0.3', () => {
          aS.set(0.3, false);
          bS.set(0.3, false);
          al = be = 0.3;
          sync();
        });
        f.button('published 0.34 / 0.28', () => {
          aS.set(0.34, false);
          bS.set(0.28, false);
          al = 0.34;
          be = 0.28;
          sync();
        });
        sync();
      },
      caption: `**Top:** isoFLOP valleys for seven budgets, from $10^{18}$ to $10^{24}$ FLOPs, with each valley's minimum in blue. This is Chinchilla's second method run on the illustrative surface. **Bottom:** the minima on log-log axes: the best model size (blue) and token count (orange) both rise as straight lines, and a least-squares fit reads off their slopes. With $\\symalpha = \\symbeta$ both slopes are 0.5 and the ratio of tokens to parameters is the same at every budget. Make $\\symbeta$ larger than $\\symalpha$ (data penalty shrinking faster) and the model-size slope climbs toward Kaplan's 0.73 (dashed). Try the published exponents: the slope drops to about 0.45, so the ratio slowly grows with budget. (At the extremes the absolute sizes become absurd, because $A$ and $B$ stay fixed; watch the slopes.)`,
    });

    p.prose(`
### Twenty tokens per parameter

At every budget they studied, Chinchilla's analysis came out near the same ratio: about **20 training tokens per parameter**, with model size and data doubling together. By that measure the large models of 2020 and 2021 were badly under-trained: too many parameters, too few tokens. Gopher's budget would have been better spent on a model a quarter of the size trained on about five times the data.

DeepMind tested that directly. They trained **Chinchilla**, 70 billion parameters on 1.4 trillion tokens, with about the same compute as Gopher.`);

    p.table(
      ['', 'Gopher (2021)', 'Chinchilla (2022)'],
      [
        ['Parameters $\\symN$', '280 billion', '70 billion'],
        ['Training tokens $\\symD$', '300 billion', '1.4 trillion'],
        ['Tokens per parameter', 'about 1', 'about 20'],
        ['Training compute $\\symC$', 'about the same', 'about the same (roughly $6 \\times 10^{23}$ FLOPs)'],
        ['Result', '', 'better on the large majority of evaluations, at a quarter of the inference cost per token'],
      ],
      { caption: 'Chinchilla uniformly and significantly outperformed Gopher, and also GPT-3 and the 530-billion-parameter Megatron-Turing NLG, on a large range of downstream tasks, while being a quarter of Gopher\'s size.' },
    );

    p.prose(`
### Why Kaplan got a different answer

The Chinchilla paper traced most of the gap to the learning-rate schedule. Kaplan's runs used one schedule length regardless of how many tokens a run would actually see, so a run stopped early was measured partway through a schedule designed for a longer run, before its learning rate had decayed. That makes short training look worse than it really is, which pushes the conclusion toward bigger models trained briefly. Kaplan's study also leaned on smaller models than Chinchilla's. Later reanalyses in 2024 added more causes, among them counting only non-embedding parameters (which matters most for small models) and hyperparameters such as warmup not being retuned per size. The lesson is broader than either paper: **a scaling law is a fact about a training recipe**, and a careless detail in the recipe can tilt the law.`);

    // ------------------------------------------------------------------ beyond
    p.h2('Training past compute-optimal', 'beyond');
    p.prose(`
Chinchilla answers one question precisely: the cheapest way to *train* a model to a given loss. But a model is trained once and then used, often for a very long time and by many people. Running it costs about $2\\symN$ FLOPs per token processed (the forward pass only; see [Fast inference](#/inference)), so a smaller model is cheaper for every token it will ever serve. It is also faster to respond and fits on fewer GPUs.

The data penalty $B/\\symD^{\\symbeta}$ keeps shrinking as training continues, so a smaller model can reach the same loss as a larger compute-optimal one by reading more tokens. That costs extra training compute. If the model will serve enough tokens, the savings at inference repay it many times over.`);

    p.math({
      label: 'Lifetime compute',
      tex: String.raw`\symC_{\text{total}} \;\approx\; 6\,\symN\,\symD \;+\; 2\,\symN\,\symDinf`,
      code: `
        def lifetime(N, D, D_inf):
            train = 6 * N * D        # paid once
            serve = 2 * N * D_inf    # forward pass, every token served
            return train + serve
      `,
      codeTitle: 'lifetime.py',
      terms: [
        [String.raw`6\,\symN\,\symD`, 'training: paid once'],
        [String.raw`\symDinf`, 'every token the model will process at inference over its life, prompts and answers together'],
        [String.raw`2\,\symN\,\symDinf`, 'inference: one forward pass, 2 FLOPs per parameter per token'],
      ],
      explain: 'Hold the target loss fixed and slide toward smaller models. Each one needs more training tokens to get there, so $6ND$ rises, but costs less per served token, so $2ND_{\\text{inf}}$ falls. The best size balances the two, and the more the model will be used, the smaller and longer-trained it should be. FLOPs are only a proxy for cost here: in practice inference is often limited by memory traffic rather than arithmetic, which favors small models even more.',
    });

    p.figure({
      title: 'Smaller and longer: sizing a model for its lifetime',
      codeTitle: 'lifetime_opt.py',
      code: `
        E, A, B = 1.7, 400, 980
        alpha = beta = 0.3
        N0 = {{N0:7e9}}    # trained at 20 tokens per param
        L_t = E + A / N0**alpha + B / (20 * N0)**beta
        N = np.logspace(8, 12, 400)
        gap = L_t - E - A / N**alpha   # left for data
        D = (B / gap) ** (1 / beta)    # tokens to hit L_t  #@D
        D_inf = {{Dinf:1e12}}          # tokens served    #@serve
        train = 6 * N * D                              #@train
        serve = 2 * N * D_inf                          #@serve
        best = np.argmin(train + serve)                #@best
        # N = {{Nb}}, D/N = {{ratio}}                   #@best
        # lifetime compute {{save}} vs N0               #@best
      `,
      setup(f) {
        let N0 = 7e9;
        let Dinf = 1e12;
        const Ns = logspace(8, 12, 400);
        const target = () => lossND(SURF, N0, 20 * N0);
        const curves = () => {
          const Lt = target();
          const tr = Ns.map((n) => 6 * n * tokensFor(SURF, n, Lt));
          const sv = Ns.map((n) => 2 * n * Dinf);
          const tot = tr.map((t, i) => t + sv[i]!);
          let bi = 0;
          tot.forEach((v, i) => {
            if (v < tot[bi]!) bi = i;
          });
          return { tr, sv, tot, bi };
        };
        const pl = f.plot({
          aspect: 1.15,
          square: false,
          draw: (pl) => {
            const ctx = pl.ctx;
            const fr = frameIn(pl, { lo: 1e8, hi: 1e12, log: true }, { lo: 1e19, hi: 1e28, log: true }, { t: 30 });
            drawAxes(ctx, fr, {
              font: FONT,
              xTicks: decades(1e8, 1e12),
              yTicks: decades(1e19, 1e28),
              xFmt: count,
              yFmt: (v) => (Math.round(Math.log10(v)) % 2 ? '' : pow10(v)),
              xLabel: 'parameters N',
              xLabelColor: color('blue'),
              yLabel: 'compute (FLOPs)',
              yLabelColor: color('purple'),
            });
            legend(ctx, fr.right, 11, [
              { label: 'train', col: color('purple') },
              { label: 'serve', col: color('slate'), dash: true },
              { label: 'total', col: color('red') },
            ]);
            const { tr, sv, tot, bi } = curves();
            const nMin = Ns.find((n, i) => Number.isFinite(tr[i]!)) ?? 1e8;
            ctx.fillStyle = withAlpha(color('--ink-3'), 0.1);
            ctx.fillRect(fr.left, fr.top, fr.X(nMin) - fr.left, fr.bottom - fr.top);
            if (fr.X(nMin) - fr.left > 60) halo(ctx, 'never reaches', fr.left + 5, fr.bottom - 24, color('--ink-3'), ui(FONT), 'left');
            if (fr.X(nMin) - fr.left > 60) halo(ctx, 'the target', fr.left + 5, fr.bottom - 10, color('--ink-3'), ui(FONT), 'left');
            fr.path(ctx, Ns, sv, color('slate'), 1.8, [6, 4]);
            fr.path(ctx, Ns, tr, color('purple'), 2);
            fr.path(ctx, Ns, tot, color('red'), 2.8);
            const t0 = 6 * N0 * 20 * N0 + 2 * N0 * Dinf;
            dot(ctx, fr.X(N0), fr.Y(t0), 6, 'transparent', color('--ink'), 2);
            const same = Math.abs(fr.X(N0) - fr.X(Ns[bi]!)) < 14;
            if (!same) halo(ctx, '20 tok/param', fr.X(N0) + 4, fr.Y(t0) - 14, color('--ink'), ui(FONT), 'left');
            dot(ctx, fr.X(Ns[bi]!), fr.Y(tot[bi]!), 5.5, color('red'), color('--paper'));
            halo(ctx, same ? 'best = 20 tok/param' : 'best', fr.X(Ns[bi]!), fr.Y(tot[bi]!) + 16, color('red'), ui(FONT, 600), 'center');
          },
        });
        const nRo = f.readout('best size', { sym: 'N' });
        const rRo = f.readout('tokens per parameter');
        const sRo = f.readout('lifetime compute vs 20 tok/param');
        const sync = () => {
          const { tot, bi } = curves();
          const Nb = Ns[bi]!;
          const D = tokensFor(SURF, Nb, target());
          const t0 = 6 * N0 * 20 * N0 + 2 * N0 * Dinf;
          const save = tot[bi]! / t0 - 1;
          f.code.setMany({ N0: pySci(N0, 2), Dinf: pySci(Dinf, 2), Nb: pySci(Nb, 2), ratio: ratioStr(D / Nb), save: pct(save) });
          nRo.set(count(Nb, 2));
          rRo.set(ratioStr(D / Nb));
          sRo.set(pct(save));
          pl.redraw();
        };
        f.slider({
          label: 'target N₀',
          sym: 'N',
          min: 9,
          max: 11,
          step: 0.02,
          value: Math.log10(7e9),
          map: (r) => 10 ** r,
          format: (v) => count(v, 2),
          onInput: (v) => {
            N0 = v;
            f.code.highlight('D');
            sync();
          },
        });
        brk(f);
        f.slider({
          label: 'tokens served',
          sym: 'Dinf',
          min: 9,
          max: 15,
          step: 0.05,
          value: 12,
          map: (r) => 10 ** r,
          format: (v) => count(v),
          onInput: (v) => {
            Dinf = v;
            f.code.highlight(['serve', 'best']);
            sync();
          },
        });
        sync();
      },
      caption: `Every point on the red curve reaches the *same* loss: the loss of a compute-optimal model of the chosen size (the black ring, at 20 tokens per parameter). Moving left means a smaller model trained on more tokens: training compute (purple) rises steeply, serving compute (dashed) falls in proportion to size. Slide **tokens served** up: the best size moves left and its tokens per parameter climb into the hundreds or thousands, at a large saving in lifetime compute. Left of the shaded edge, the model is too small to reach the target with any amount of data. Illustrative constants, as above.`,
    });

    p.prose(`
This is what the field did. Meta's LLaMA (2023) trained a 7-billion-parameter model on a trillion tokens, about 140 per parameter, and found it still improving. By Llama 3 (2024), an 8-billion-parameter model saw over 15 trillion tokens; Meta noted that the Chinchilla-optimal amount for that size is about 200 billion tokens, and that the model kept improving roughly log-linearly up to 75 times more. "Chinchilla-optimal" became the *least* data a serious model is trained on, not the target.`);

    p.table(
      ['Model', 'Year', '$\\symN$', '$\\symD$', '$\\symD / \\symN$'],
      MODELS.map((m) => [m.name, String(m.year), count(m.N), count(m.D), ratioStr(m.D / m.N)]),
      { caption: 'Parameters $\\symN$, training tokens $\\symD$ and tokens per parameter, as reported by each model\'s paper or announcement (Llama 3 8B: "over 15T"). The ratio climbs from about 1 to about 2,000 in four years.' },
    );

    // ------------------------------------------------------------------ limits
    p.h2('What scaling laws do not tell you', 'limits');
    p.prose(`
A scaling law predicts one number, the average loss, for one recipe. Four caveats keep it in its place.

**Loss is not ability.** The loss falls smoothly, but a specific skill can look like it appears suddenly. Part of the reason is how skills are scored. Suppose each token of a 20-token answer is right with probability $p$, and the answer counts only if all of it is right: the score is about $p^{20}$. As $p$ climbs smoothly from 0.5 to 0.95, the score jumps from about one in a million to about 0.36. Wei et al. (2022) called such jumps *emergent abilities*; Schaeffer et al. (2023) showed that many of them turn smooth when measured with a continuous metric. Both views agree the underlying loss is predictable; what is hard to predict is which threshold a given task needs.

**Data is finite.** The laws assume fresh tokens. High-quality public text is limited, so the largest runs already approach it. Muennighoff et al. (2023) found that repeating data for up to about four epochs is nearly as good as fresh data, with returns falling off quickly after that. Better filtering, synthetic data and other modalities are all attempts to keep $\\symD$ growing.

**The constants belong to a recipe.** Data quality, the [tokenizer](#/tokenization), the architecture ([the modern block](#/modern-transformer)) and the [optimizer](#/optimizers) all shift the line. A better recipe moves the whole line down, and labs describe such improvements as *compute multipliers*: how much compute the old recipe would need to match the new one. For a [mixture of experts](#/moe), the $\\symN$ in $6\\symN\\symD$ is the number of *active* parameters per token.

**Training is not the only axis.** Similar laws describe vision transformers ([ViT](#/vit)), and spending more compute at inference, by sampling longer chains of thought or more candidate answers, has its own curve ([Reasoning and test-time compute](#/reasoning)).`);

    // ------------------------------------------------------------------ exercises
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **Fit a power law (NumPy, 10 minutes).** Generate $y = 3\\,x^{-0.4}$ at 20 log-spaced points between 1 and $10^4$, multiply by $1 + 0.03\\,\\epsilon$ with Gaussian noise $\\epsilon$, and fit a line to $\\log y$ against $\\log x$ with \`np.polyfit\`. *Success:* the recovered exponent is within about 0.02 of 0.4. Then add a floor of 1.5 to $y$, watch the straight-line fit fail, and write the grid search over $E$ from Fig 5.2. *Success:* $E$ and the exponent both come back within a few percent.
2. **Count a real model (20 minutes).** A GPT-style model with $n$ layers of width $d$ has about $12 n d^2$ non-embedding parameters, and its forward pass costs about $2N + 2 n T d$ FLOPs per token for context length $T$. Plug in GPT-3's shape ($n = 96$, $d = 12288$, $T = 2048$, a vocabulary of 50,257). *Success:* $N$ comes out within 1% of 175 billion once you add the embedding table, the attention term is under 2% of $2N$, and $6ND$ for 300 billion tokens is about $3.1 \\times 10^{23}$.
3. **Derive and check the optimum (30 minutes).** Derive $N_{\\text{opt}}$ by setting the slope of the loss along the budget line to zero, then check it against a brute-force \`argmin\` over a fine log grid for five budgets, using Chinchilla's published constants ($E = 1.69$, $A = 406.4$, $B = 410.7$, $\\alpha = 0.34$, $\\beta = 0.28$). *Success:* closed form and grid agree to within the grid spacing, and you can show that the tokens-per-parameter ratio drifts upward with budget because $\\alpha \\neq \\beta$.
4. **Your own isoFLOP study (a few hours, a small project).** Pick a tiny task you can train many times: a character-level model on a few megabytes of text (the [RNN chapter](#/rnn) has one) or a small MLP. For three compute budgets a factor of 4 apart, train 4 to 6 model sizes each, setting the number of training tokens so that $6ND$ equals the budget, with a cosine learning-rate schedule matched to each run's length. Plot final validation loss against $N$ for each budget, fit a parabola in $\\log N$ to find each minimum, and fit the minima against $C$ on log-log axes. *Success:* three visible valleys, and a model-size exponent with an honest error bar (rerun with two seeds).
5. **Size a model for its users (1 to 2 hours).** Using the illustrative surface from this chapter, compute the lifetime-optimal size for a target loss as the number of inference tokens goes from $10^9$ to $10^{15}$, and plot its tokens per parameter. Then add a second cost: inference measured in GPU-seconds, assuming decoding is memory-bound so its cost per token is proportional to the bytes of weights. *Success:* a curve that starts near 20 tokens per parameter and rises into the thousands, and a sentence explaining how the memory-bound assumption moves it.`);

    p.callout('idea', `- On log-log axes a power law is a straight line, and its slope is the exponent; fit it with least squares on the logs, and include an irreducible floor $\\symE$ before extrapolating.
- Loss falls as a power law in parameters, data and compute (Kaplan et al., 2020), as long as the other resources are not the bottleneck.
- Training costs about $6\\symN\\symD$ FLOPs: 2 per parameter per token forward, 4 backward. Inference costs about $2\\symN$ per token.
- With a fixed budget, model size and data should grow together. Chinchilla (2022) found about 20 tokens per parameter, and its 70B model beat the 280B Gopher at similar compute.
- A model that will be used a lot should be smaller and trained far longer than compute-optimal, which is why recent models see hundreds or thousands of tokens per parameter.`, 'Takeaways');
  },
};

export default chapter;
