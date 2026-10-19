import type { Page } from '../core/page';
import { type Plot, color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { box, gridLines, mono, narrow, txt, ui } from './inference-draw';
import {
  AX_D,
  AX_T,
  MODEL,
  P_TARGET,
  QW_COLS,
  QW_ROWS,
  type Gran,
  type Rule,
  type Scheme,
  VOCAB,
  activations,
  alphaOf,
  draftDist,
  expectedTokens,
  fmtCount,
  int8Errors,
  quantMatrix,
  specPass,
  speedup,
  weightsWith,
} from './inference-math';

// ------------------------------------------------------------------ 5. quantizing a weight matrix

export function figQuant(p: Page): void {
  p.figure({
    title: 'Quantization error on a weight histogram',
    codeTitle: 'quantize.py',
    code: `
      def absmax(w, bits):                          #@abs
          qmax = 2 ** (bits - 1) - 1                #@abs
          s = np.abs(w).max() / qmax                #@abs
          return np.round(w / s) * s                #@abs

      def zero_point(w, bits):                      #@zp
          s = (w.max() - w.min()) / (2**bits - 1)   #@zp
          z = np.round(-w.min() / s)                #@zp
          w_int = np.clip(np.round(w / s) + z,      #@zp
                          0, 2**bits - 1)           #@zp
          return (w_int - z) * s                    #@zp

      groups = {{split:list(W)}}   # {{gran:one per row}}
      W_hat = [{{fn:absmax}}(g, {{bits:8}}) for g in groups]
      # SQNR {{sqnr}} dB at {{bpw}} bits per weight
    `,
    setup(f) {
      let bits = 4;
      let scheme: Scheme = 'absmax';
      let gran: Gran = 'channel';
      let outliers = false;
      let res = quantMatrix(weightsWith(false), QW_ROWS, QW_COLS, bits, scheme, gran);
      let W = weightsWith(false);
      const panel = (row: number, title: string) =>
        f.plot({
          aspect: 2.5,
          square: false,
          domain: [-1, 1, 0, 1.12],
          draw: (pl) => drawRow(pl, row, title),
        });
      function drawRow(pl: Plot, row: number, title: string) {
        const vals = W.subarray(row * QW_COLS, (row + 1) * QW_COLS);
        const deq = res.What.subarray(row * QW_COLS, (row + 1) * QW_COLS);
        let m = 0;
        for (const v of vals) m = Math.max(m, Math.abs(v));
        const R = m * 1.08;
        const bins = 61;
        const hist = new Array(bins).fill(0);
        for (const v of vals) hist[Math.min(bins - 1, Math.max(0, Math.floor(((v + R) / (2 * R)) * bins)))]++;
        const levels = new Map<number, number>();
        for (const v of deq) levels.set(v, (levels.get(v) ?? 0) + 1);
        const hmax = Math.max(...hist, ...levels.values());
        const X = (v: number) => v / R;
        const c = pl.ctx;
        // original weights
        for (let i = 0; i < bins; i++) {
          if (!hist[i]) continue;
          const x0 = pl.sx(-1 + (2 * i) / bins);
          const x1 = pl.sx(-1 + (2 * (i + 1)) / bins);
          c.fillStyle = withAlpha(color('blue'), 0.28);
          c.fillRect(x0, pl.sy((hist[i] / hmax) * 0.92), x1 - x0 - 0.5, pl.sy(0) - pl.sy((hist[i] / hmax) * 0.92));
        }
        // dequantized values: one spike per level in use
        for (const [v, n] of levels) {
          const x = pl.sx(X(v));
          c.strokeStyle = color('teal');
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(x, pl.sy(0));
          c.lineTo(x, pl.sy(Math.max(0.03, (n / hmax) * 0.92)));
          c.stroke();
        }
        c.strokeStyle = color('--axis');
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(0, pl.sy(0) + 0.5);
        c.lineTo(pl.w, pl.sy(0) + 0.5);
        c.stroke();
        pl.text('0', 0, -0.0, { align: 'center', size: 10.5, mono: true, color: color('--ink-3') });
        txt(c, title, 8, 12, { font: ui(12, 600), color: color('--ink-2') });
        txt(c, `${levels.size} value${levels.size === 1 ? '' : 's'} in use`, pl.w - 8, 12, { font: mono(11.5, 600), color: color('teal'), align: 'right' });
        txt(c, `±${R.toFixed(3)}`, pl.w - 8, pl.h - 10, { font: mono(10.5), color: color('--ink-3'), align: 'right' });
      }
      const quiet = panel(0, 'row 0: small weights');
      const loud = panel(QW_ROWS - 1, `row ${QW_ROWS - 1}: large weights`);
      const sqnrRo = f.readout('SQNR');
      const sizeRo = f.readout('an 8B model takes');
      const sync = () => {
        W = weightsWith(outliers);
        res = quantMatrix(W, QW_ROWS, QW_COLS, bits, scheme, gran);
        f.code.setMany({
          split: gran === 'tensor' ? '[W]' : gran === 'channel' ? 'list(W)' : 'W.reshape(-1, 32)',
          gran: gran === 'tensor' ? 'one scale for all' : gran === 'channel' ? 'one per row' : 'one per 32',
          fn: scheme === 'absmax' ? 'absmax' : 'zero_point',
          bits,
          sqnr: Number.isFinite(res.sqnr) ? res.sqnr.toFixed(1) : '∞',
          bpw: res.bpw.toFixed(2),
        });
        f.code.highlight(scheme === 'absmax' ? 'abs' : 'zp');
        sqnrRo.set(`${res.sqnr.toFixed(1)} dB`);
        sizeRo.set(`${((MODEL.params * res.bpw) / 8 / 1e9).toFixed(1)} GB`);
        quiet.redraw();
        loud.redraw();
      };
      f.segmented({ label: 'bits', options: [8, 4, 3, 2].map((b) => ({ value: String(b), label: String(b) })), value: '4', onChange: (v) => { bits = Number(v); sync(); } });
      f.segmented({ label: 'scheme', options: [{ value: 'absmax', label: 'absmax' }, { value: 'zero', label: 'zero point' }], value: 'absmax', onChange: (v) => { scheme = v as Scheme; sync(); } });
      f.segmented({ label: 'one scale per', options: [{ value: 'tensor', label: 'tensor' }, { value: 'channel', label: 'row' }, { value: 'group', label: '32 weights' }], value: 'channel', onChange: (v) => { gran = v as Gran; sync(); } });
      f.toggle({ label: 'two outlier weights in row 7', value: false, onChange: (v) => { outliers = v; sync(); } });
      sync();
    },
    caption: `An 8 by 256 weight matrix whose rows differ eightfold in size, like the output channels of a real layer. Each panel is one row: the pale bars are its original weights, the teal spikes the values they round to. Start at 4 bits, one scale per row: both rows use about a dozen levels. Switch to **one scale per tensor**: row 0 shares a step size set by row 7's largest weight and collapses onto three values. Turn on the **outliers** and the damage spreads to row 7 itself. **Groups of 32** fix most of it for an extra half bit per weight (an fp16 scale per group). SQNR, the signal-to-quantization-noise ratio $10\\log_{10}(\\sum w^2 / \\sum (w - \\hat w)^2)$, gains roughly 6 dB per extra bit at the higher widths.`,
  });
}

// ------------------------------------------------------------------ 6. outlier features and LLM.int8

export function figOutliers(p: Page): void {
  p.figure({
    title: 'Outlier features break per-token int8',
    codeTitle: 'llm_int8.py',
    code: `
      X = activations()   # (16, 64): tokens, features
      X[:, [9, 44]] *= {{mag:20}}   # two outlier features  #@out
      big = np.abs(X).max(axis=0) >= 6.0   # {{n:2}} found   #@find

      # 16-bit matmul for the few outlier features
      Y_hi = X[:, big] @ W[big]                             #@hi
      # int8 for the rest (row scales for X, col for W)
      Y_lo = int8_matmul(X[:, ~big], W[~big])               #@lo
      Y = Y_hi + Y_lo
      # error on the ordinary features' share of Y:
      # one scale {{e1}}, per row {{e2}}, LLM.int8 {{e3}}
    `,
    setup(f) {
      let mag = 20;
      let X = activations(mag);
      let err = int8Errors(X);
      const cv = f.canvas(640, narrow() ? 520 : 330, (c, w, h) => {
        const L = 10;
        const hm = Math.min(150, h * 0.46);
        const cw = (w - 2 * L) / AX_D;
        const ch = hm / AX_T;
        let mx = 0;
        for (const v of X) mx = Math.max(mx, Math.abs(v));
        txt(c, '|X|: 16 tokens × 64 features', L, 9, { font: ui(12, 600), color: color('--ink-2') });
        for (let t = 0; t < AX_T; t++)
          for (let d = 0; d < AX_D; d++) {
            const v = Math.abs(X[t * AX_D + d]!) / mx;
            c.fillStyle = withAlpha(color(err.outlierCols[d] ? 'red' : 'orange'), 0.08 + 0.92 * Math.sqrt(v));
            c.fillRect(L + d * cw, 20 + t * ch, cw - 0.6, ch - 0.6);
          }
        const nOut = err.outlierCols.filter(Boolean).length;
        txt(c, nOut ? `${nOut} features reach |x| ≥ 6: kept in 16 bits` : 'no feature reaches |x| ≥ 6', L, 20 + hm + 12, { font: ui(11.5), color: color(nOut ? 'red' : '--ink-3') });
        // error bars
        const rows: [string, number][] = [
          ['int8, one scale', err.tensor],
          ['int8, per token', err.row],
          ['LLM.int8()', err.mixed],
        ];
        const by = 20 + hm + 34;
        const bh = Math.min(26, (h - by - 22) / 3 - 8);
        const lab = Math.min(140, w * 0.34);
        const vmax = 0.15;
        rows.forEach(([name, e], i) => {
          const y = by + i * (bh + 8);
          txt(c, name, L, y + bh / 2, { font: ui(12, i === 2 ? 650 : 500), color: color(i === 2 ? 'green' : '--ink-2') });
          const x0 = L + lab;
          const bw = w - x0 - 70;
          box(c, x0, y, bw, bh, 4, withAlpha(color('--ink-3'), 0.06));
          box(c, x0, y, Math.max(3, (bw * Math.min(e, vmax)) / vmax), bh, 4, withAlpha(color(i === 2 ? 'green' : 'red'), 0.55));
          txt(c, `${(e * 100).toFixed(1)}%`, x0 + bw + 8, y + bh / 2, { font: mono(12, 600), color: color('--ink') });
        });
        txt(c, "error on the ordinary features' share of X @ W", L, h - 8, { font: ui(11), color: color('--ink-3') });
      });
      const sync = () => {
        X = activations(mag);
        err = int8Errors(X);
        const pc = (v: number) => `${(v * 100).toFixed(1)}%`;
        f.code.setMany({ n: err.outlierCols.filter(Boolean).length, e1: pc(err.tensor), e2: pc(err.row), e3: pc(err.mixed) });
        cv.redraw();
      };
      f.slider({ label: 'outlier size', min: 1, max: 60, step: 1, value: 20, slot: 'mag', onInput: (v) => { mag = v; f.code.highlight('out'); sync(); } });
      sync();
    },
    caption: `Sixteen tokens' activations, with two features made large in every token, the pattern Dettmers et al. (2022) found in transformers from about 6.7 billion parameters up. Absmax int8 with one scale per token sets each token's step size by its largest value. Drag the outliers to 40 times the typical size: the ordinary features get only a few integer steps each, and their share of the output is off by about 7%, ten times the error without outliers. LLM.int8() finds the features that ever reach magnitude 6, multiplies those few in 16 bits, and the rest in int8 with scales that no longer see the outliers: the error stays at the no-outlier level whatever the slider says.`,
  });
}

// ------------------------------------------------------------------ 7. speculative decoding, simulated

export function figSpeculative(p: Page): void {
  p.figure({
    title: 'Speculative decoding: draft, verify, and check the output',
    codeTitle: 'speculative.py',
    code: `
      def speculative_pass(p, q, k):
          out = []
          for i in range(k):                    # draft  #@draft
              x = sample(q)
              if {{test:rand() < min(1, p[x] / q[x])}}:   #@accept
                  out.append(x)                 # keep
                  continue
              r = {{resid:np.maximum(p - q, 0)}}            #@resid
              out.append(sample(r / r.sum()))   # fix    #@resid
              return out
          out.append(sample(p))     # all k kept: bonus  #@bonus
          return out
      # k = {{k:4}}, alpha = {{alpha}}: {{tpp}} tokens per pass
    `,
    setup(f) {
      let k = 4;
      let quality = 0.5;
      let rule: Rule = 'exact';
      let q = draftDist(quality);
      const rng = new Rng(77);
      const counts = P_TARGET.map(() => 0);
      let tokens = 0;
      let passes = 0;
      let accepted = 0;
      let drafted = 0;
      let last = specPass(P_TARGET, q, k, rng, rule);
      const reset = () => {
        counts.fill(0);
        tokens = passes = accepted = drafted = 0;
      };
      const cv = f.canvas(640, narrow() ? 640 : 420, (c, w, h) => {
        const L = 10;
        const R = w - 10;
        const n = VOCAB.length;
        const gw = (R - L) / n;
        const top = 20;
        const ph = h * 0.3;
        const sy = (v: number) => top + ph - (ph * v) / 0.36;
        txt(c, 'target p and draft q', L, 9, { font: ui(12, 600), color: color('--ink-2') });
        const alpha = alphaOf(P_TARGET, q);
        txt(c, `α = Σ min(p, q) = ${alpha.toFixed(3)}`, R, 9, { font: mono(11.5, 600), color: color('orange'), align: 'right' });
        for (let i = 0; i < n; i++) {
          const x = L + i * gw;
          const bw = gw * 0.34;
          const pv = P_TARGET[i]!;
          const qv = q[i]!;
          box(c, x + gw * 0.14, sy(pv), bw, sy(0) - sy(pv), 3, withAlpha(color('purple'), 0.6), color('purple'));
          box(c, x + gw * 0.14 + bw + 2, sy(qv), bw, sy(0) - sy(qv), 3, withAlpha(color('gold'), 0.55), color('gold'));
          if (pv > qv) {
            c.setLineDash([3, 3]);
            box(c, x + gw * 0.14 + bw + 2, sy(pv), bw, sy(qv) - sy(pv), 2, undefined, color('purple'), 1.2);
            c.setLineDash([]);
          }
          txt(c, VOCAB[i]!, x + gw / 2, top + ph + 11, { font: mono(11.5, 600), color: color('--ink-2'), align: 'center' });
        }
        // the last pass
        const ly = top + ph + 34;
        txt(c, 'last pass', L, ly, { font: ui(12, 600), color: color('--ink-2') });
        const cellW = Math.min(58, (R - L - 70) / (k + 1) - 4);
        last.drafts.forEach((d, i) => {
          const x = L + 70 + i * (cellW + 4);
          const ok = last.ok[i]!;
          box(c, x, ly - 12, cellW, 24, 4, withAlpha(color(ok ? 'gold' : 'red'), ok ? 0.25 : 0.15), color(ok ? 'gold' : 'red'));
          txt(c, `${VOCAB[d]}${ok ? ' ✓' : ' ✗'}`, x + cellW / 2, ly, { font: mono(11, 600), color: color('--ink'), align: 'center' });
        });
        const lastTok = last.out[last.out.length - 1]!;
        const lx = L + 70 + last.drafts.length * (cellW + 4);
        box(c, lx, ly - 12, cellW, 24, 4, withAlpha(color('purple'), 0.3), color('purple'));
        txt(c, VOCAB[lastTok]!, lx + cellW / 2, ly, { font: mono(11, 600), color: color('--ink'), align: 'center' });
        txt(c, last.last === 'bonus' ? 'all kept: a bonus token from p' : 'rejected: resampled', L + 70, ly + 22, { font: ui(11), color: color('--ink-3') });
        // empirical output distribution versus p
        const ey = ly + 44;
        const eh = h - ey - 24;
        const ey0 = ey + eh;
        const esy = (v: number) => ey0 - (eh * v) / 0.36;
        txt(c, `output tokens (${fmtCount(tokens)} so far) against p`, L, ey, { font: ui(12, 600), color: color('--ink-2') });
        const emp = counts.map((v) => (tokens ? v / tokens : 0));
        const tv = 0.5 * emp.reduce((a, e, i) => a + Math.abs(e - P_TARGET[i]!), 0);
        txt(c, tokens ? `distance from p: ${tv.toFixed(3)}` : '', R, ey, { font: mono(11.5, 600), color: color(tv < 0.01 ? 'green' : 'red'), align: 'right' });
        for (let i = 0; i < n; i++) {
          const x = L + i * gw + gw * 0.18;
          const bw = gw * 0.64;
          box(c, x, esy(P_TARGET[i]!), bw, ey0 - esy(P_TARGET[i]!), 3, withAlpha(color('purple'), 0.12), withAlpha(color('purple'), 0.6));
          if (tokens) {
            c.strokeStyle = color('--ink');
            c.lineWidth = 2.5;
            c.beginPath();
            c.moveTo(x + 3, esy(emp[i]!));
            c.lineTo(x + bw - 3, esy(emp[i]!));
            c.stroke();
          }
        }
        txt(c, 'bars: p   lines: how often each token came out', L, h - 8, { font: ui(11), color: color('--ink-3') });
      });
      const accRo = f.readout('kept', { sym: 'alpha' });
      const tppRo = f.readout('tokens per pass');
      const sync = () => {
        const alpha = alphaOf(P_TARGET, q);
        const exp = expectedTokens(alpha, k);
        accRo.set(drafted ? `${(accepted / drafted).toFixed(3)} (α ${alpha.toFixed(3)})` : `α ${alpha.toFixed(3)}`);
        tppRo.set(passes ? `${(tokens / passes).toFixed(2)} (formula ${exp.toFixed(2)})` : `formula ${exp.toFixed(2)}`);
        f.code.setMany({ alpha: alpha.toFixed(2), tpp: exp.toFixed(2) });
        cv.redraw();
      };
      const step = (nPass: number) => {
        for (let i = 0; i < nPass; i++) {
          last = specPass(P_TARGET, q, k, rng, rule);
          passes++;
          tokens += last.out.length;
          for (const x of last.out) counts[x]!++;
          drafted += last.drafts.length;
          accepted += last.ok.filter(Boolean).length;
        }
      };
      let phase = 0;
      const run = f.loop(() => {
        step(passes < 200 ? 4 : 120);
        f.code.highlight(['draft', 'accept', last.last === 'bonus' ? 'bonus' : 'resid'][phase++ % 3]!);
        sync();
        if (passes >= 20000) {
          f.code.highlight(null);
          btn.textContent = 'Run';
          return false;
        }
      });
      const btn = f.button('Run', () => {
        if (run.running()) {
          run.stop();
          btn.textContent = 'Run';
          f.code.highlight(null);
        } else {
          if (passes >= 20000) reset();
          run.start();
          btn.textContent = 'Pause';
        }
      }, { primary: true });
      f.button('One pass', () => {
        run.stop();
        btn.textContent = 'Run';
        step(1);
        f.code.highlight(last.last === 'bonus' ? 'bonus' : 'resid');
        sync();
      });
      f.slider({ label: 'draft quality', min: 0, max: 1, step: 0.01, value: quality, onInput: (v) => { quality = v; q = draftDist(v); reset(); sync(); } });
      f.slider({ label: 'draft tokens k', sym: 'k', min: 1, max: 8, step: 1, value: k, slot: 'k', onInput: (v) => { k = v; reset(); sync(); } });
      f.segmented({
        label: 'on rejection',
        options: [{ value: 'exact', label: 'residual' }, { value: 'fromp', label: 'sample p' }, { value: 'accept', label: 'never reject' }],
        value: 'exact',
        onChange: (v) => {
          rule = v as Rule;
          f.code.setMany({
            test: rule === 'accept' ? 'True' : 'rand() < min(1, p[x] / q[x])',
            resid: rule === 'fromp' ? 'p' : 'np.maximum(p - q, 0)',
          });
          reset();
          sync();
        },
      });
      sync();
    },
    caption: `A six-word vocabulary where the target $\\symp$ (purple) and the draft $\\symq$ (gold) do not depend on the context, so every pass is the same experiment. Dashed outlines mark the residual, where $\\symp$ exceeds $\\symq$. Press **Run**: thousands of passes, and the black lines (how often each word came out) settle onto the purple bars; the distance from $\\symp$ (total variation, half the summed gaps) falls toward 0 as the sample grows. Lower the draft quality: fewer drafts are kept and passes yield fewer tokens, but the output stays exactly $\\symp$. Now switch the rejection rule to **sample p** (an innocent-looking shortcut) or **never reject**: the output drifts toward $\\symq$ and the distance stops shrinking.`,
  });
}

// ------------------------------------------------------------------ 8. how many tokens to draft

export function figChooseK(p: Page): void {
  p.figure({
    title: 'How many tokens to draft',
    codeTitle: 'choose_k.py',
    code: `
      alpha, c = {{alpha:0.8}}, {{c:0.05}}
      for k in range(1, 13):
          tokens = (1 - alpha ** (k + 1)) / (1 - alpha)  #@tok
          cost = k * c + 1   # k draft steps, 1 big pass   #@cost
          speedup = tokens / cost                         #@sp
      # best k = {{best}}: {{sp}}x the plain decoder
    `,
    setup(f) {
      let alpha = 0.8;
      let c = 0.05;
      const pl = f.plot({
        aspect: 1.6,
        square: false,
        domain: [0.4, 12.6, 0, 6.3],
        draw: (pl) => {
          gridLines(pl, 'y', [1, 2, 3, 4, 5, 6], (v) => `${v}×`);
          gridLines(pl, 'x', [1, 3, 6, 9, 12], (v) => `k=${v}`);
          pl.path([0.4, 12.6], [1, 1], withAlpha(color('--ink-3'), 0.8), 1.5, [4, 4]);
          const ks = Array.from({ length: 12 }, (_, i) => i + 1);
          pl.path(ks, ks.map((k) => expectedTokens(alpha, k)), color('orange'), 2, [6, 4]);
          pl.path(ks, ks.map((k) => speedup(alpha, k, c)), color('purple'), 2.5);
          ks.forEach((k) => pl.dot(k, speedup(alpha, k, c), 3.5, color('purple'), color('--card')));
          const best = ks.reduce((b, k) => (speedup(alpha, k, c) > speedup(alpha, b, c) ? k : b), 1);
          pl.dot(best, speedup(alpha, best, c), 6.5, color('purple'), color('--card'));
          pl.text(`best k = ${best}`, best, speedup(alpha, best, c) + 0.35, { align: 'center', size: 12, bold: true, color: color('purple') });
          pl.text('tokens per big pass', 12.4, Math.min(6.05, expectedTokens(alpha, 12) + 0.25), { align: 'right', size: 11.5, color: color('orange') });
          pl.text('wall-clock speedup', 12.4, speedup(alpha, 12, c) - 0.35, { align: 'right', size: 11.5, bold: true, color: color('purple') });
        },
      });
      const sync = () => {
        const ks = Array.from({ length: 12 }, (_, i) => i + 1);
        const best = ks.reduce((b, k) => (speedup(alpha, k, c) > speedup(alpha, b, c) ? k : b), 1);
        f.code.setMany({ best, sp: speedup(alpha, best, c).toFixed(2) });
        pl.redraw();
      };
      f.slider({ label: 'acceptance α', sym: 'alpha', min: 0.3, max: 0.97, step: 0.01, value: alpha, slot: 'alpha', onInput: (v) => { alpha = v; sync(); } });
      f.slider({ label: 'draft cost c', min: 0, max: 0.5, step: 0.01, value: c, slot: 'c', onInput: (v) => { c = v; sync(); } });
      sync();
    },
    caption: `The dashed orange curve is the expected number of tokens one pass of the big model produces; it climbs toward $1/(1-\\symalpha)$ and flattens, because a long draft is rarely accepted to the end. The purple curve divides by the cost of the pass, $\\symk$ draft steps at $c$ big-model steps each plus the one verification pass. At $\\symalpha = 0.8$ and $c = 0.05$ (a draft about twenty times faster than the target) the gain is about 3×, over a broad optimum from $\\symk = 6$ to 9. Make the draft expensive ($c = 0.3$): the best $\\symk$ falls to 3 and the gain to about 1.5×. Make it a poor guesser ($\\symalpha = 0.4$) and speculation gains less than 1.5×. The model assumes verifying $\\symk + 1$ positions costs one ordinary decode step, true while decode is memory-bound.`,
  });
}
