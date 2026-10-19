import type { ChapterDef } from './index';
import type { Page } from '../core/page';
import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { TRANSFORMER_SYMBOLS } from '../lib/transformer-symbols';
import { arrow, cellNum, fitHeight, matrix, measure, rbox, signed, text } from '../lib/transformer-draw';
import {
  BLOCK_D,
  BLOCK_FF,
  HEADS,
  type HeadName,
  type Mat,
  SENTENCE,
  WK4,
  WQ4,
  WV4,
  type Word,
  blockTrace,
  fig1,
  headAttention,
  human,
  mean,
  paramCount,
  sinusoids,
  softmax,
  std,
  transpose,
} from '../lib/transformer-model';

const TOKEN_OPTS = SENTENCE.map((w, i) => ({ value: String(i), label: w }));

/* ------------------------------------------------------------------ */
/* Fig: self-attention, one matrix at a time                           */
/* ------------------------------------------------------------------ */

interface MatItem {
  M: Mat;
  name: string;
  col: string;
  /** One row per token (gets row labels and the follow highlight). */
  rows: boolean;
  colLabels?: boolean;
  heat?: boolean;
  dropZero?: boolean;
  /** Row tints by weight, for V in the last step. */
  weights?: boolean;
}
type Item = MatItem | string;

function figMatrices(p: Page): void {
  p.figure({
    title: 'Self-attention, one matrix at a time',
    codeTitle: 'self_attention.py',
    code: `
      ids = [0, 1, 3, 4, 0, 5]   # the cat sat on the mat
      X = E[ids]              # (6, 4) a row per token   #@x
      Q = X @ Wq              # (6, 2)  Wq is (4, 2)     #@q
      K = X @ Wk              # (6, 2)                   #@k
      V = X @ Wv              # (6, 2)                   #@v
      d_k = 2
      S = Q @ K.T / np.sqrt(d_k)  # (6, 6)               #@s
      A = softmax(S, axis=1)  # (6, 6) rows sum to 1     #@a
      out = A @ V             # (6, 2) blended values    #@out
      # {{tok:sat}}: A[{{i:2}}] = [{{arow}}]
    `,
    setup(f) {
      const tr = fig1();
      const KT = transpose(tr.K);
      const m = {
        X: { M: tr.X, name: 'X', col: 'orange', rows: true } as MatItem,
        Wq: { M: WQ4, name: 'W_Q', col: 'blue', rows: false } as MatItem,
        Wk: { M: WK4, name: 'W_K', col: 'blue', rows: false } as MatItem,
        Wv: { M: WV4, name: 'W_V', col: 'blue', rows: false } as MatItem,
        Q: { M: tr.Q, name: 'Q', col: 'teal', rows: true } as MatItem,
        K: { M: tr.K, name: 'K', col: 'green', rows: true } as MatItem,
        KT: { M: KT, name: 'Kᵀ', col: 'green', rows: false, colLabels: true } as MatItem,
        V: { M: tr.V, name: 'V', col: 'gold', rows: true } as MatItem,
        Vw: { M: tr.V, name: 'V', col: 'gold', rows: true, weights: true } as MatItem,
        S: { M: tr.S, name: 'S', col: 'purple', rows: true, colLabels: true } as MatItem,
        A: { M: tr.A, name: 'A', col: 'purple', rows: true, colLabels: true, heat: true, dropZero: true } as MatItem,
        out: { M: tr.out, name: 'out', col: 'orange', rows: true } as MatItem,
      };
      const steps: { title: string; items: Item[]; line: string }[] = [
        { title: 'X: six tokens, four numbers each', items: [m.X], line: 'x' },
        { title: 'Q = X W_Q: one query per token', items: [m.X, '·', m.Wq, '=', m.Q], line: 'q' },
        { title: 'K = X W_K: one key per token', items: [m.X, '·', m.Wk, '=', m.K], line: 'k' },
        { title: 'V = X W_V: one value per token', items: [m.X, '·', m.Wv, '=', m.V], line: 'v' },
        { title: 'S = Q Kᵀ / √2: every query against every key', items: [m.Q, '·', m.KT, '=', m.S], line: 's' },
        { title: 'A = softmax(S), one row at a time', items: [m.S, '→', m.A], line: 'a' },
        { title: 'out = A V: each token blends the values', items: [m.A, '·', m.Vw, '=', m.out], line: 'out' },
      ];
      let step = 0;
      let sel = 2;
      let hits: { x0: number; x1: number; y0: number; ch: number }[] = [];
      const LBL = 34;
      const OP = 20;
      const GAP = 6;
      const lineCols = (items: Item[]) => items.reduce((a, it) => a + (typeof it === 'string' ? 0 : it.M[0]!.length), 0);
      const firstMat = (items: Item[]) => items.findIndex((it) => typeof it !== 'string');
      const lineFixed = (items: Item[]) =>
        items.reduce((a, it, k) => a + (typeof it === 'string' ? OP : GAP) + (k === firstMat(items) && typeof it !== 'string' && it.rows ? LBL : 0), 0);
      const cv = f.canvas(640, 330, (ctx, w, h) => {
        const st = steps[step]!;
        // One line if the cells stay readable, else the result goes on a second line.
        let lines: Item[][] = [st.items];
        const fit = (ls: Item[][]) => Math.min(...ls.map((l) => (w - 8 - lineFixed(l)) / Math.max(1, lineCols(l))));
        if (fit(lines) < 34 && st.items.length > 1) {
          const k = st.items.findIndex((it) => it === '=' || it === '→');
          lines = [st.items.slice(0, k), st.items.slice(k)];
        }
        const cw = Math.max(24, Math.min(46, fit(lines)));
        const ch = Math.max(20, Math.min(26, cw * 0.62));
        const fs = cw < 31 ? 10 : 11.5;
        const titleH = 26;
        const headH = 18;
        const colH = 14;
        const lineH = (l: Item[]) => {
          const rows = Math.max(...l.map((it) => (typeof it === 'string' ? 0 : it.M.length)));
          const hasCol = l.some((it) => typeof it !== 'string' && it.colLabels);
          return headH + (hasCol ? colH : 0) + rows * ch;
        };
        const need = titleH + lines.reduce((a, l) => a + lineH(l) + 14, 0) + 4;
        if (fitHeight(cv.canvas, w, h, need)) return;
        text(ctx, st.title, w / 2, 13, { size: 13, weight: 600, color: color('--ink') });
        hits = [];
        let y = titleH;
        lines.forEach((l) => {
          const lh = lineH(l);
          const hasCol = l.some((it) => typeof it !== 'string' && it.colLabels);
          const rowsMax = Math.max(...l.map((it) => (typeof it === 'string' ? 0 : it.M.length)));
          const width = lineFixed(l) + lineCols(l) * cw - GAP;
          let x = Math.max(4, (w - width) / 2);
          const gridTop = y + headH + (hasCol ? colH : 0);
          const midY = gridTop + (rowsMax * ch) / 2;
          l.forEach((it, k) => {
            if (typeof it === 'string') {
              text(ctx, it, x + OP / 2 - GAP / 2, midY, { size: 16, color: color('--ink-2') });
              x += OP;
              return;
            }
            const lead = k === firstMat(l) && it.rows;
            if (lead) x += LBL;
            const rows = it.M.length;
            const cols = it.M[0]!.length;
            const top = gridTop + ((rowsMax - rows) * ch) / 2;
            const head = top - (it.colLabels ? colH : 0) - headH + 9;
            const c = color(it.col as 'blue');
            const nm = it.name.startsWith('W_') ? 'W' : it.name;
            const sub = it.name.startsWith('W_') ? it.name.slice(2) : '';
            const shape = `(${rows}, ${cols})`;
            const nw = measure(ctx, nm, { font: 'serif', size: 14, italic: true, weight: 600 });
            const sw = sub ? measure(ctx, sub, { font: 'serif', size: 10, italic: true, weight: 600 }) : 0;
            const shw = measure(ctx, shape, { font: 'mono', size: 10 });
            const cx = x + (cols * cw) / 2;
            const tw = nw + sw + 5 + shw;
            text(ctx, nm, cx - tw / 2, head, { font: 'serif', size: 14, italic: true, weight: 600, color: c, align: 'left' });
            if (sub) text(ctx, sub, cx - tw / 2 + nw, head + 4, { font: 'serif', size: 10, italic: true, weight: 600, color: c, align: 'left' });
            text(ctx, shape, cx - tw / 2 + nw + sw + 5, head + 1, { font: 'mono', size: 10, color: color('--ink-3'), align: 'left' });
            if (it.colLabels) SENTENCE.forEach((wd, j) => text(ctx, wd, x + j * cw + cw / 2, top - 7, { size: cw < 31 ? 9.5 : 10, color: color('--ink-3') }));
            if (lead) {
              SENTENCE.forEach((wd, i) =>
                text(ctx, wd, x - 6, top + i * ch + ch / 2, { size: 11, align: 'right', weight: i === sel ? 700 : 400, color: i === sel ? color('teal') : color('--ink-3') }),
              );
            }
            if (it.weights) {
              const a = tr.A[sel]!;
              it.M.forEach((_, i) => rbox(ctx, x - 2, top + i * ch, cols * cw + 4, ch, 5, withAlpha(color('purple'), 0.08 + 0.5 * a[i]!), null));
            }
            const follow = it.rows && !it.weights;
            matrix(ctx, x, top, cw, ch, it.M, { col: it.col, heat: it.heat, dropZero: it.dropZero, hiRow: follow ? sel : undefined, dimRows: follow && step > 0, font: fs, digits: 2, short: cw < 40 });
            if (it.rows) hits.push({ x0: x - (lead ? LBL : 0), x1: x + cols * cw, y0: top, ch });
            x += cols * cw + GAP;
          });
          y += lh + 14;
        });
      });
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        for (const hb of hits) {
          if (px < hb.x0 || px > hb.x1) continue;
          const i = Math.floor((py - hb.y0) / hb.ch);
          if (i >= 0 && i < SENTENCE.length) {
            seg.set(String(i));
            return;
          }
        }
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        f.code.setMany({ i: sel, tok: SENTENCE[sel]!, arow: tr.A[sel]!.map((v) => cellNum(v, 2, true)).join(', ') });
        cv.redraw();
      };
      f.stepper({
        steps: steps.length,
        interval: 1600,
        label: (k) => `step ${k + 1} / ${steps.length}`,
        onStep: (k) => {
          step = k;
          f.code.highlight(steps[k]!.line);
          sync();
        },
      });
      const seg = f.segmented({
        label: 'follow',
        options: TOKEN_OPTS,
        value: '2',
        onChange: (v) => {
          sel = Number(v);
          sync();
        },
      });
      sync();
    },
    caption: `Step through the computation; each step is one line of the code, drawn as the matrices it multiplies. **Tap a word** (or a row) to follow one token: its query, its row of scores, its row of weights and its output. Things to notice: *sat* puts the most weight on *cat* (these toy weights happen to make the verb look for a noun); every row of $\\symA$ adds up to 1; and in the last step the rows of $\\symV$ are tinted by how much the followed token takes from each. The two *the* rows are identical at every step: nothing yet tells the model that they sit in different places.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: why divide by sqrt(d_k)                                        */
/* ------------------------------------------------------------------ */

function figScaling(p: Page): void {
  p.figure({
    title: 'Scores grow like √dₖ, and the softmax saturates',
    codeTitle: 'why_scale.py',
    code: `
      d_k = {{dk:64}}
      q = np.random.randn(2000, d_k)    # random queries  #@sample
      k = np.random.randn(2000, d_k)    # and keys        #@sample
      scale = {{scale:1}}   # 1 / np.sqrt(d_k) if scaling   #@scale
      dots = (q * k).sum(axis=1) * scale  # std {{std}}   #@dot
      row = q[0] @ k[:8].T * scale      # 8 keys          #@row
      a = softmax(row)                  # max {{amax}}    #@soft
      signal = 1 - (a ** 2).sum()       # {{sig}}         #@sig
    `,
    setup(f) {
      const N = 2000;
      const POW = 10;
      let seed = 3;
      let pIdx = 6;
      let scaled = false;
      // Running sums, kept at every power of two, so changing d_k costs nothing.
      let dotsBy: Float64Array[] = [];
      let rowBy: number[][] = [];
      const sample = () => {
        const rng = new Rng(seed);
        dotsBy = Array.from({ length: POW }, () => new Float64Array(N));
        for (let n = 0; n < N; n++) {
          let s = 0;
          for (let i = 0, pw = 0; i < 1 << (POW - 1); i++) {
            s += rng.randn() * rng.randn();
            if (i + 1 === 1 << pw) dotsBy[pw++]![n] = s;
          }
        }
        const q = Array.from({ length: 1 << (POW - 1) }, () => rng.randn());
        rowBy = Array.from({ length: POW }, () => new Array<number>(8).fill(0));
        for (let j = 0; j < 8; j++) {
          let s = 0;
          for (let i = 0, pw = 0; i < 1 << (POW - 1); i++) {
            s += q[i]! * rng.randn();
            if (i + 1 === 1 << pw) rowBy[pw++]![j] = s;
          }
        }
      };
      sample();
      const dk = () => 1 << pIdx;
      const sc = () => (scaled ? 1 / Math.sqrt(dk()) : 1);
      const R = 30;
      const hist = f.plot({
        aspect: 2.3,
        square: false,
        domain: [-R, R, 0, 1],
        draw: (pl) => {
          const dots = dotsBy[pIdx]!;
          const s = sc();
          const bins = new Array<number>(2 * R).fill(0);
          let lo = 0;
          let hi = 0;
          for (const v0 of dots) {
            const v = v0 * s;
            if (v < -R) lo++;
            else if (v >= R) hi++;
            else bins[Math.floor(v + R)]!++;
          }
          const mx = Math.max(...bins);
          pl.setDomain(-R, R, -0.16 * mx, mx * 1.18);
          pl.axes({ grid: 10 });
          const c = color('purple');
          bins.forEach((b, i) => {
            if (!b) return;
            const x0 = pl.sx(i - R) + 0.5;
            const x1 = pl.sx(i - R + 1) - 0.5;
            pl.ctx.fillStyle = withAlpha(c, 0.55);
            pl.ctx.fillRect(x0, pl.sy(b), x1 - x0, pl.sy(0) - pl.sy(b));
          });
          for (const v of [-20, -10, 0, 10, 20]) pl.text(String(v), v, -0.08 * mx, { align: 'center', base: 'middle', size: 11, mono: true, color: color('--ink-3') });
          const fr = (n: number) => `${Math.round((100 * n) / N)}%`;
          if (lo) pl.text(`◀ ${fr(lo)}`, -R + 0.6, mx * 0.5, { size: 11, mono: true, color: color('red') });
          if (hi) pl.text(`${fr(hi)} ▶`, R - 0.6, mx * 0.5, { size: 11, mono: true, align: 'right', color: color('red') });
          pl.text(`q · k${scaled ? ' / √dₖ' : ''}, 2000 pairs`, -R + 0.8, mx * 1.08, { size: 11, color: color('--ink-2') });
        },
      });
      const bars = f.canvas(640, 170, (ctx, w, h) => {
        const row = rowBy[pIdx]!.map((v) => v * sc());
        const a = softmax(row);
        const top = 22;
        const bot = h - 34;
        const bw = (w - 16) / 8;
        text(ctx, 'softmax of one query against 8 keys', 8, 10, { size: 11, align: 'left', color: color('--ink-2') });
        a.forEach((v, j) => {
          const x = 8 + j * bw;
          const bh = (bot - top) * v;
          rbox(ctx, x + bw * 0.16, bot - bh, bw * 0.68, Math.max(1, bh), 3, withAlpha(color('purple'), 0.75), null);
          text(ctx, `${Math.round(v * 100)}%`, x + bw / 2, Math.max(top + 6, bot - bh - 9), { font: 'mono', size: 11, color: color('--ink') });
          text(ctx, fmt(row[j]!, 2), x + bw / 2, bot + 12, { font: 'mono', size: w < 420 ? 10 : 11, color: color('--ink-3') });
        });
        ctx.strokeStyle = color('--axis');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(8, bot + 0.5);
        ctx.lineTo(w - 8, bot + 0.5);
        ctx.stroke();
        text(ctx, 'scores', w / 2, bot + 27, { size: 10, color: color('--ink-3') });
      });
      bars.canvas.classList.add('scroll-ok');
      const stdRo = f.readout('std of scores');
      const maxRo = f.readout('largest weight', { sym: 'A' });
      const sigRo = f.readout('gradient signal');
      const update = () => {
        const s = sc();
        const dots = dotsBy[pIdx]!;
        let ss = 0;
        for (const v of dots) ss += v * v;
        const sd = Math.sqrt(ss / dots.length) * s;
        const a = softmax(rowBy[pIdx]!.map((v) => v * s));
        const amax = Math.max(...a);
        const sig = 1 - a.reduce((t, v) => t + v * v, 0);
        stdRo.set(fmt(sd, 3));
        maxRo.set(`${Math.round(amax * 100)}%`);
        sigRo.set(fmt(sig, 2));
        f.code.setMany({ std: fmt(sd, 3), amax: fmt(amax, 2), sig: fmt(sig, 2), scale: scaled ? fmt(s, 3) : '1' });
        hist.redraw();
        bars.redraw();
      };
      f.slider({
        label: 'd_k',
        sym: 'dk',
        min: 0,
        max: POW - 1,
        step: 1,
        value: pIdx,
        map: (r) => 2 ** r,
        format: (v) => String(v),
        slot: 'dk',
        onInput: (v) => {
          pIdx = Math.round(Math.log2(v));
          f.code.highlight(['sample', 'dot']);
          update();
        },
      });
      f.toggle({
        label: 'divide by √dₖ',
        value: false,
        onChange: (v) => {
          scaled = v;
          f.code.highlight('scale');
          update();
        },
      });
      f.button('Resample', () => {
        seed++;
        sample();
        f.code.highlight(['sample', 'row']);
        update();
      });
      update();
    },
    caption: `**Top**: the dot products of 2,000 random query and key pairs whose entries have mean 0 and standard deviation 1, at width $\\symdk$. With the scaling off, slide $\\symdk$ up and the histogram spreads out like $\\sqrt{\\symdk}$ (red counts are off the chart). Turn the scaling on and it stays put. **Bottom**: one query's softmax over eight keys. Unscaled, at $\\symdk = 64$ one key usually takes nearly all the weight, and the *gradient signal* collapses toward 0. That number is $1 - \\sum_j a_j^2$, the sum of the slopes $\\partial a_j / \\partial s_j$: how much the weights would move if each score were nudged. Zero means the softmax has stopped listening.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: hand-built heads                                               */
/* ------------------------------------------------------------------ */

const SENTS: Word[][] = [SENTENCE, ['the', 'dog', 'sat', 'on', 'the', 'cat'], ['on', 'the', 'mat', 'the', 'cat', 'sat']];
const HOW: Record<HeadName, string> = {
  'previous word': 'Wq turns position codes back a step',
  'next word': 'Wq turns position codes on a step',
  nouns: 'one query for all; only nouns get a key',
  'same word': 'Wq and Wk both copy the word',
};
const SHORT: Record<HeadName, string> = { 'previous word': 'previous', 'next word': 'next', nouns: 'nouns', 'same word': 'same word' };

/** A T x T attention grid: rows are queries, columns keys; masked cells are blank. */
function attnGrid(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, A: Mat, words: readonly string[], o: { sel: number; causal: boolean; numbers: boolean; labels: boolean; colKey?: string }) {
  const T = A.length;
  const pur = color('purple');
  if (o.labels) {
    words.forEach((wd, j) => text(ctx, wd, x + j * cs + cs / 2, y - 8, { size: 10, color: color('--ink-3') }));
    words.forEach((wd, i) =>
      text(ctx, wd, x - 6, y + i * cs + cs / 2, { size: 11, align: 'right', weight: i === o.sel ? 700 : 400, color: i === o.sel ? color('teal') : color('--ink-3') }),
    );
  }
  for (let i = 0; i < T; i++)
    for (let j = 0; j < T; j++) {
      const cx = x + j * cs;
      const cy = y + i * cs;
      if (o.causal && j > i) {
        rbox(ctx, cx + 1, cy + 1, cs - 2, cs - 2, 3, withAlpha(color('--ink-3'), 0.07), null);
        continue;
      }
      const v = A[i]![j]!;
      rbox(ctx, cx + 1, cy + 1, cs - 2, cs - 2, 3, withAlpha(pur, 0.04 + 0.86 * v), withAlpha(pur, 0.3), 1);
      if (o.numbers && v >= 0.005) text(ctx, cellNum(v, 2, true), cx + cs / 2, cy + cs / 2 + 0.5, { font: 'mono', size: cs < 34 ? 10 : 11, color: v > 0.55 ? '#ffffff' : color('--ink') });
    }
  rbox(ctx, x, y + o.sel * cs, T * cs, cs, 4, null, color('teal'), 2);
}

function figHeads(p: Page): void {
  p.figure({
    title: 'Four heads, four ways of looking',
    codeTitle: 'heads.py',
    code: `
      # a token: a one-hot word (6 numbers),
      # plus 6 position features (P's last columns)
      X = onehot(tokens) + P          # (6, 12)
      Wq, Wk = HEADS["{{head:previous word}}"]   #@w
      # {{how:Wq turns position codes back a step}}
      Q, K = X @ Wq, X @ Wk           # (6, 6) each   #@qk
      S = Q @ K.T / np.sqrt(6)        # d_k = 6       #@s
      causal = {{causal:False}}                       #@mask
      if causal:                                      #@mask
          S[np.triu(np.ones((6, 6)), 1) == 1] = -np.inf   #@mask
      A = softmax(S, axis=1)          # row i: token i   #@a
      # A[{{i:2}}] = [{{arow}}]
    `,
    setup(f) {
      let si = 0;
      let head: HeadName | 'all' = 'previous word';
      let causal = false;
      let sel = 2;
      let hit: { x: number; y: number; cs: number; n: number }[] = [];
      let lineHit: { y0: number; y1: number; xs: number[] } | null = null;
      const words = () => SENTS[si]!;
      const cv = f.canvas(640, 400, (ctx, w, h) => {
        const ws = words();
        hit = [];
        lineHit = null;
        if (head === 'all') {
          const cols = 2;
          const lab = 38;
          const gap = 18;
          const cs = Math.min(30, (w - 8 - cols * lab - gap) / (cols * 6));
          const gw = lab + 6 * cs;
          const gh = 18 + 14 + 6 * cs;
          const need = 2 * gh + gap + 6;
          if (fitHeight(cv.canvas, w, h, need)) return;
          const x0 = (w - (cols * gw + gap)) / 2;
          HEADS.forEach((hn, k) => {
            const gx = x0 + (k % 2) * (gw + gap) + lab;
            const gy = 4 + Math.floor(k / 2) * (gh + gap);
            text(ctx, `head ${k + 1}: ${hn}`, gx + 3 * cs, gy + 8, { size: 12, weight: 600, color: color('--ink') });
            const { A } = headAttention(ws, hn, causal);
            attnGrid(ctx, gx, gy + 32, cs, A, ws, { sel, causal, numbers: cs >= 30, labels: true });
            hit.push({ x: gx - lab, y: gy + 32, cs, n: 6 });
          });
          return;
        }
        const { A } = headAttention(ws, head, causal);
        const wide = w >= 560;
        const lab = 40;
        const cs = wide ? Math.min(38, (w * 0.5 - lab - 12) / 6) : Math.min(44, (w - lab - 12) / 6);
        const gridW = lab + 6 * cs;
        const lineW = wide ? w - gridW - 28 : w - 8;
        const lineH = 150;
        const need = wide ? Math.max(18 + 6 * cs + 20, lineH + 30) : lineH + 26 + 18 + 6 * cs + 12;
        if (fitHeight(cv.canvas, w, h, need)) return;
        // Lines from each query (top) to each key (bottom).
        const lx = wide ? gridW + 24 : 4;
        const ly = wide ? Math.max(8, (h - lineH) / 2) : 4;
        const step = lineW / 6;
        const xs = ws.map((_, i) => lx + step * (i + 0.5));
        const yq = ly + 26;
        const yk = ly + lineH - 26;
        text(ctx, 'looking (queries)', lx + 2, ly + 6, { size: 10, align: 'left', color: color('--ink-3') });
        text(ctx, 'looked at (keys)', lx + 2, ly + lineH - 4, { size: 10, align: 'left', color: color('--ink-3') });
        for (let i = 0; i < 6; i++)
          for (let j = 0; j < 6; j++) {
            const v = A[i]![j]!;
            if (v < 0.02) continue;
            const on = i === sel;
            ctx.strokeStyle = withAlpha(color(on ? 'purple' : '--ink-3'), on ? 0.15 + 0.85 * v : 0.22 * v);
            ctx.lineWidth = on ? 1 + 6 * v : 1 + 2 * v;
            ctx.beginPath();
            ctx.moveTo(xs[i]!, yq + 11);
            ctx.lineTo(xs[j]!, yk - 11);
            ctx.stroke();
          }
        const chip = (x: number, y: number, s: string, k: string, a: number, bold: boolean) => {
          const tw = Math.min(step - 4, measure(ctx, s, { size: 12 }) + 12);
          rbox(ctx, x - tw / 2, y - 11, tw, 22, 6, withAlpha(color(k as 'teal'), a), withAlpha(color(k as 'teal'), 0.6), 1);
          text(ctx, s, x, y + 0.5, { size: 12, weight: bold ? 700 : 500, color: color('--ink') });
        };
        ws.forEach((wd, i) => chip(xs[i]!, yq, wd, 'teal', i === sel ? 0.35 : 0.08, i === sel));
        ws.forEach((wd, j) => chip(xs[j]!, yk, wd, 'green', 0.06 + 0.6 * A[sel]![j]!, false));
        lineHit = { y0: yq - 12, y1: yq + 12, xs };
        const gx = wide ? lab + 4 : (w - gridW) / 2 + lab;
        const gy = wide ? (h - 6 * cs) / 2 + 8 : lineH + 26 + 18;
        attnGrid(ctx, gx, gy, cs, A, ws, { sel, causal, numbers: cs >= 30, labels: true });
        hit.push({ x: gx - lab, y: gy, cs, n: 6 });
      });
      const pick = (e: PointerEvent) => {
        const r = cv.canvas.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        if (lineHit && py >= lineHit.y0 && py <= lineHit.y1) {
          let best = 0;
          lineHit.xs.forEach((x, i) => Math.abs(x - px) < Math.abs(lineHit!.xs[best]! - px) && (best = i));
          return best;
        }
        for (const g of hit) {
          if (px < g.x || px > g.x + 40 + g.n * g.cs) continue;
          const i = Math.floor((py - g.y) / g.cs);
          if (i >= 0 && i < g.n) return i;
        }
        return -1;
      };
      cv.canvas.addEventListener('pointerdown', (e) => {
        const i = pick(e);
        if (i >= 0) {
          sel = i;
          sync();
        }
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        const hn = head === 'all' ? 'previous word' : head;
        const { A } = headAttention(words(), hn, causal);
        f.code.setMany({ head: head === 'all' ? 'all four' : head, how: head === 'all' ? 'four (Wq, Wk) pairs at once' : HOW[head], causal: causal ? 'True' : 'False', i: sel, arow: A[sel]!.map((v) => cellNum(v, 2, true)).join(', ') });
        f.code.highlight(causal ? ['mask', 'a'] : ['w', 'a']);
        cv.redraw();
      };
      f.segmented({
        label: 'head',
        options: [...HEADS.map((hn) => ({ value: hn, label: SHORT[hn] })), { value: 'all', label: 'all four' }],
        value: 'previous word',
        onChange: (v) => {
          head = v as HeadName | 'all';
          sync();
        },
      });
      f.toggle({
        label: 'causal mask',
        value: false,
        onChange: (v) => {
          causal = v;
          sync();
        },
      });
      f.button('Next sentence', () => {
        si = (si + 1) % SENTS.length;
        sync();
      });
      sync();
    },
    caption: `Pick a head. The grid is its attention matrix $\\symA$: each row is a token doing the looking, each column a token being looked at, and darker means more weight. **Tap a row** (or a word on top) to draw that row as lines. The four heads are built by hand: *previous* and *next* read only the position features (their $\\sym{W}{W_Q}$ rotates each sine and cosine pair by one step, so a query matches the position one step away); *nouns* and *same word* read only the one-hot words. Press **Next sentence**: position heads follow positions whatever the words, content heads follow words wherever they sit. **All four** is what multi-head attention computes in one layer. Then turn on the **causal mask** and look at the *next* head: it was reading the very word a language model is supposed to predict. (The toy's position features use base 10 instead of 10,000, since its sentences are six tokens long.)`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: permutation, without and with positions                        */
/* ------------------------------------------------------------------ */

function figShuffle(p: Page): void {
  p.figure({
    title: 'Without positions, order is invisible',
    codeTitle: 'shuffle.py',
    code: `
      def encode(ids, use_pos):
          X = E[ids]                 # (6, 4)          #@x
          if use_pos:
              X = X + P[:len(ids)]   # slot i: P[i]    #@p
          return attention(X)        # (6, 2), Fig 2.1  #@att

      perm = [{{perm:0, 1, 2, 3, 4, 5}}]
      out = encode(ids, {{pos:False}})                    #@a
      out2 = encode(ids[perm], {{pos2:False}})            #@b
      np.allclose(out2, out[perm])   # {{same:True}}    #@check
    `,
    setup(f) {
      let perm = [0, 1, 2, 3, 4, 5];
      let usePos = false;
      let seed = 1;
      const cv = f.canvas(640, 290, (ctx, w, h) => {
        const o1 = fig1(SENTENCE, usePos).out;
        const tok2 = perm.map((i) => SENTENCE[i]!);
        const o2 = fig1(tok2, usePos).out;
        const need = 270;
        if (fitHeight(cv.canvas, w, h, need)) return;
        const step = (w - 12) / 6;
        const xs = SENTENCE.map((_, i) => 6 + step * (i + 0.5));
        const cw = Math.min(46, step - 12);
        const rowY = [34, 172];
        text(ctx, 'original order', 6, 10, { size: 11, align: 'left', color: color('--ink-3') });
        text(ctx, 'shuffled', 6, rowY[1]! - 26, { size: 11, align: 'left', color: color('--ink-3') });
        // Lines from each word to where it went.
        perm.forEach((src, i) => {
          ctx.strokeStyle = withAlpha(color('--ink-3'), 0.5);
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(xs[src]!, rowY[0]! + 58);
          ctx.lineTo(xs[i]!, rowY[1]! - 15);
          ctx.stroke();
          ctx.setLineDash([]);
        });
        // The two output numbers, stacked.
        const strip = (x: number, y: number, v: number[], ok: boolean | null) => {
          v.forEach((val, j) => {
            const cy = y + j * 19;
            rbox(ctx, x - cw / 2, cy, cw, 18, 4, signed(val, 1.2), withAlpha(color('orange'), 0.5), 1);
            text(ctx, cellNum(val, 2), x, cy + 9.5, { font: 'mono', size: 10.5, color: color('--ink') });
          });
          if (ok !== null) rbox(ctx, x - cw / 2 - 3, y - 3, cw + 6, 43, 6, null, color(ok ? 'green' : 'red'), 2);
        };
        const chip = (x: number, y: number, s: string) => {
          const tw = Math.min(step - 6, measure(ctx, s, { size: 12 }) + 14);
          rbox(ctx, x - tw / 2, y - 11, tw, 22, 6, withAlpha(color('orange'), 0.12), withAlpha(color('orange'), 0.6), 1);
          text(ctx, s, x, y + 0.5, { size: 12, weight: 600, color: color('--ink') });
        };
        let worst = 0;
        SENTENCE.forEach((wd, i) => {
          chip(xs[i]!, rowY[0]!, wd);
          strip(xs[i]!, rowY[0]! + 18, o1[i]!, null);
        });
        tok2.forEach((wd, i) => {
          const d = Math.max(...o2[i]!.map((v, j) => Math.abs(v - o1[perm[i]!]![j]!)));
          worst = Math.max(worst, d);
          chip(xs[i]!, rowY[1]!, wd);
          strip(xs[i]!, rowY[1]! + 18, o2[i]!, d < 1e-9);
        });
        const same = worst < 1e-9;
        const ident = perm.every((v, i) => v === i);
        const msg = ident ? 'press Shuffle' : same ? (w < 420 ? 'same outputs: order left no trace' : 'every word kept its output: the order left no trace') : `outputs changed, by up to ${fmt(worst, 2)}`;
        text(ctx, msg, w / 2, h - 14, { size: 12, weight: 600, color: ident ? color('--ink-3') : color(same ? 'green' : 'red') });
        f.code.setMany({ same: same ? 'True' : 'False' });
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        f.code.setMany({ perm: perm.join(', '), pos: usePos ? 'True' : 'False', pos2: usePos ? 'True' : 'False' });
        cv.redraw();
      };
      f.button('Shuffle', () => {
        const r = new Rng(seed++);
        do perm = r.shuffle([0, 1, 2, 3, 4, 5]);
        while (perm.every((v, i) => v === i));
        f.code.highlight(['b', 'check']);
        sync();
      }, { primary: true, icon: 'shuffle' });
      f.toggle({
        label: 'add positions',
        value: false,
        onChange: (v) => {
          usePos = v;
          f.code.highlight(v ? 'p' : 'x');
          sync();
        },
      });
      f.button('Reset', () => {
        perm = [0, 1, 2, 3, 4, 5];
        f.code.highlight(null);
        sync();
      });
      sync();
    },
    caption: `Each word carries its two-number output from the attention of Figure 2.1. Press **Shuffle**: without positions, every output simply travels with its word, unchanged to the last digit, so nothing downstream can know the order. Turn on **add positions** and shuffle again: now the same word at a different place gets a different output (the outline turns red).`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: sinusoidal encodings                                            */
/* ------------------------------------------------------------------ */

function figSinusoids(p: Page): void {
  p.figure({
    title: 'Sinusoidal positions: a clock with many hands',
    codeTitle: 'positions.py',
    code: `
      T, d = 64, 64
      pos = np.arange(T)[:, None]       # (64, 1)     #@grid
      i = np.arange(0, d, 2)[None, :]   # (1, 32)     #@grid
      angle = pos / 10000 ** (i / d)    # (64, 32)    #@angle
      P = np.zeros((T, d))
      P[:, 0::2] = np.sin(angle)        # even columns  #@sin
      P[:, 1::2] = np.cos(angle)        # odd columns   #@sin
      sim = P @ P[{{pos:10}}]   # (64,): vs every position  #@sim
      # sim[{{pos2:10}}] = {{peak:32}}, sim[{{posn:11}}] = {{next:31.4}}
    `,
    setup(f) {
      const T = 64;
      const d = 64;
      const P = sinusoids(T, d);
      let pos = 10;
      const img = document.createElement('canvas');
      img.width = d;
      img.height = T;
      const paint = () => {
        const g = img.getContext('2d')!;
        const im = g.createImageData(d, T);
        const pc = color('orange').match(/[0-9a-f]{2}/gi)!.map((x) => parseInt(x, 16));
        const nc = color('slate').match(/[0-9a-f]{2}/gi)!.map((x) => parseInt(x, 16));
        const bg = color('--paper').match(/[0-9a-f]{2}/gi)?.map((x) => parseInt(x, 16)) ?? [255, 255, 255];
        for (let r = 0; r < T; r++)
          for (let c = 0; c < d; c++) {
            const v = P[r]![c]!;
            const k = v >= 0 ? pc : nc;
            const a = Math.abs(v);
            const o = (r * d + c) * 4;
            for (let ch = 0; ch < 3; ch++) im.data[o + ch] = Math.round(bg[ch]! * (1 - a) + k[ch]! * a);
            im.data[o + 3] = 255;
          }
        g.putImageData(im, 0, 0);
      };
      const heat = f.canvas(640, 300, (ctx, w, h) => {
        paint();
        const left = 34;
        const top = 22;
        const H = h - top - 8;
        const W = w - left - 10;
        const x0 = left;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x0, top, W, H);
        const rh = H / T;
        rbox(ctx, x0 - 2, top + pos * rh - 1, W + 4, rh + 2, 2, null, color('teal'), 2);
        text(ctx, w < 420 ? 'columns 0 to 63: fast waves to slow' : 'columns 0 to 63: fast waves on the left, slow on the right', x0, 10, { size: 10.5, align: 'left', color: color('--ink-3') });
        text(ctx, 'pos', 4, 10, { size: 10.5, align: 'left', color: color('--ink-3') });
        for (const r of [0, 16, 32, 48, 63]) if (Math.abs(r - pos) > 4) text(ctx, String(r), x0 - 6, top + r * rh + rh / 2, { size: 10, align: 'right', font: 'mono', color: color('--ink-3') });
        text(ctx, String(pos), x0 - 6, top + pos * rh + rh / 2, { size: 11, align: 'right', font: 'mono', weight: 700, color: color('teal') });
      });
      heat.canvas.classList.add('scroll-ok');
      const sim = f.plot({
        aspect: 2.6,
        square: false,
        domain: [-2, 65, -9, 36],
        draw: (pl) => {
          pl.axes({ grid: 8 });
          const ys = P.map((r) => r.reduce((a, v, j) => a + v * P[pos]![j]!, 0));
          pl.path(ys.map((_, j) => j), ys, color('teal'), 2.2);
          pl.dot(pos, ys[pos]!, 4.5, color('teal'));
          for (const x of [0, 16, 32, 48]) pl.text(String(x), x, -6, { align: 'center', size: 10, mono: true, color: color('--ink-3') });
          pl.text('32', -1.5, 32, { size: 10, mono: true, color: color('--ink-3'), base: 'middle' });
          pl.text(`P[${pos}] · P[j]`, 50, 31, { size: 11, color: color('teal'), align: 'center' });
          pl.text('j', 63.5, -6, { size: 11, color: color('--ink-3'), align: 'right' });
        },
      });
      const sync = () => {
        const dot = (a: number, b: number) => P[a]!.reduce((t, v, j) => t + v * P[b]![j]!, 0);
        const nb = pos < T - 1 ? pos + 1 : pos - 1;
        f.code.setMany({ pos2: pos, posn: nb, peak: fmt(dot(pos, pos), 3), next: fmt(dot(pos, nb), 3) });
        heat.redraw();
        sim.redraw();
      };
      f.slider({
        label: 'position',
        min: 0,
        max: T - 1,
        step: 1,
        value: pos,
        slot: 'pos',
        format: (v) => String(Math.round(v)),
        onInput: (v) => {
          pos = Math.round(v);
          f.code.highlight('sim');
          sync();
        },
      });
      sync();
    },
    caption: `**Top**: the encoding matrix $\\symP$ for 64 positions (rows) and $\\symd = 64$ (columns), orange for positive and blue-gray for negative. Each pair of columns is one sine and cosine at one frequency, slower from left to right. The slider picks a row: the code for that position. **Bottom**: the dot product of that code with every position's code. It peaks at the position itself (where it equals $\\symd/2 = 32$) and falls off with distance, and the bump keeps the same shape wherever you slide it: the similarity of two positions depends only on how far apart they are.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: the block, lit by the code                                     */
/* ------------------------------------------------------------------ */

const STAGE_INFO: Record<string, { node: number; title: string; line: string }> = {
  x: { node: 0, title: 'x: the tokens coming in, (6, 8)', line: 'x' },
  attn: { node: 1, title: 'a = multi-head attention(x), (6, 8)', line: 'attn' },
  add1: { node: 2, title: 'x + a: the residual add', line: 'add1' },
  ln1: { node: 3, title: 'layer norm: every row to mean 0, std 1', line: 'ln1' },
  ffn1: { node: 4, title: 'h = ReLU(x W1 + b1): 4x wider, (6, 32)', line: 'ffn1' },
  ffn2: { node: 4, title: 'f = h W2 + b2: back to (6, 8)', line: 'ffn2' },
  add2: { node: 5, title: 'x + f: the second residual add', line: 'add2' },
  ln2: { node: 6, title: 'layer norm again: the block output', line: 'ln2' },
};

function figBlock(p: Page): void {
  p.figure({
    title: 'One block, lit up by its code',
    codeTitle: 'block.py',
    code: `
      def block(x):              # x: (6, 8)          #@x
          a = multi_head(x, n_heads=2)   # (6, 8)     #@attn
          x = x + a              # residual add       #@add1
          x = layer_norm(x)      # rows: mean 0, std 1  #@ln1
          h = np.maximum(0, x @ W1 + b1)   # (6, 32)  #@ffn1
          f = h @ W2 + b2        # back to (6, 8)     #@ffn2
          x = x + f              # residual add       #@add2
          x = layer_norm(x)                           #@ln2
          return x
      # row {{row:sat}}: mean {{mu:0.63}}, std {{sd:1.23}}
    `,
    setup(f) {
      const stages = blockTrace();
      let k = 0;
      const nodes = ['input x', 'multi-head attention', 'add', 'layer norm', 'feed-forward', 'add', 'layer norm'];
      const nodeCol = ['orange', 'purple', '--ink-3', 'teal', 'blue', '--ink-3', 'teal'];
      const cv = f.canvas(640, 400, (ctx, w, h) => {
        const st = stages[k]!;
        const info = STAGE_INFO[st.key]!;
        const wide = w >= 560;
        const M = st.M;
        const cols = M[0]!.length;
        const statW = 108;
        const lab = 34;
        const heatW = wide ? w * 0.58 - 8 : w - 8;
        const cw = Math.min(cols > 8 ? 12 : 30, (heatW - lab - statW) / cols);
        const ch = cols > 8 ? 22 : Math.min(26, cw * 0.85);
        const heatH = 30 + 6 * ch;
        const nodeH = 26;
        const gapN = 14;
        const diagH = 7 * nodeH + 6 * gapN + 26;
        const need = wide ? Math.max(diagH, heatH) + 8 : diagH + heatH + 16;
        if (fitHeight(cv.canvas, w, h, need)) return;
        // Diagram, input at the bottom as in the paper.
        const dw = wide ? w * 0.42 - 16 : w - 8;
        const nw = Math.min(220, dw - 70);
        const nx = wide ? 50 : Math.max(40, (w - nw) / 2);
        const ny = (i: number) => diagH - 6 - (i + 1) * nodeH - i * gapN;
        const cx = nx + nw / 2;
        for (let i = 0; i < 6; i++) arrow(ctx, cx, ny(i), cx, ny(i + 1) + nodeH + 1, withAlpha(color('--ink-3'), 0.7), 1.2, 6);
        // Residual paths around attention and around the MLP.
        const res = (from: number, to: number, on: boolean) => {
          const xr = nx - 18;
          const y0 = ny(from) + nodeH * 0.2;
          const y1 = ny(to) + nodeH / 2;
          ctx.strokeStyle = on ? color('orange') : withAlpha(color('--ink-3'), 0.6);
          ctx.lineWidth = on ? 2.4 : 1.3;
          ctx.beginPath();
          ctx.moveTo(nx, y0);
          ctx.lineTo(xr, y0);
          ctx.lineTo(xr, y1);
          ctx.stroke();
          arrow(ctx, xr, y1, nx - 1, y1, on ? color('orange') : withAlpha(color('--ink-3'), 0.6), on ? 2.4 : 1.3, 6);
        };
        res(0, 2, st.key === 'add1');
        res(3, 5, st.key === 'add2');
        for (const [a, b] of [[0, 2], [3, 5]] as const) {
          ctx.save();
          ctx.translate(nx - 26, (ny(a) + ny(b)) / 2 + nodeH / 2);
          ctx.rotate(-Math.PI / 2);
          text(ctx, 'residual', 0, 0, { size: 10, color: color('--ink-3') });
          ctx.restore();
        }
        nodes.forEach((nm, i) => {
          const on = i === info.node;
          const c = color(nodeCol[i] as 'blue');
          const small = nm === 'add';
          const bw = small ? 60 : nw;
          rbox(ctx, cx - bw / 2, ny(i), bw, nodeH, small ? 13 : 7, withAlpha(c, on ? 0.3 : 0.08), on ? c : withAlpha(c, 0.5), on ? 2.2 : 1);
          let label = nm === 'add' ? '+  add' : nm;
          if (nm === 'feed-forward') label = `feed-forward ${BLOCK_D} → ${BLOCK_FF} → ${BLOCK_D}`;
          text(ctx, label, cx, ny(i) + nodeH / 2 + 0.5, { size: 12, weight: on ? 700 : 500, color: color('--ink') });
        });
        text(ctx, 'block output', cx, ny(6) - 9, { size: 10, color: color('--ink-3') });
        // The numbers at this point.
        const hx = wide ? w * 0.42 + 4 : 4;
        const hy = wide ? (h - heatH) / 2 : diagH + 12;
        text(ctx, info.title, hx, hy + 9, { size: 12, weight: 600, color: color('--ink'), align: 'left' });
        const gx = hx + lab;
        const gy = hy + 24;
        const range = Math.max(1, ...M.flat().map(Math.abs));
        M.forEach((row, i) => {
          text(ctx, SENTENCE[i]!, gx - 6, gy + i * ch + ch / 2, { size: 11, align: 'right', color: color('--ink-3') });
          row.forEach((v, j) => rbox(ctx, gx + j * cw + 0.5, gy + i * ch + 0.5, cw - 1, ch - 1, cols > 8 ? 2 : 4, signed(v, range), null));
          if (cols <= 8 && cw >= 28) row.forEach((v, j) => text(ctx, cellNum(v, 1), gx + j * cw + cw / 2, gy + i * ch + ch / 2 + 0.5, { font: 'mono', size: 10, color: color('--ink') }));
          const mu = mean(row);
          const sd = std(row);
          const ln = st.key === 'ln1' || st.key === 'ln2';
          text(ctx, `μ ${cellNum(mu, 2)}  σ ${cellNum(sd, 2)}`, gx + cols * cw + 8, gy + i * ch + ch / 2, { font: 'mono', size: 10.5, align: 'left', weight: ln ? 700 : 400, color: ln ? color('teal') : color('--ink-3') });
        });
      });
      cv.canvas.classList.add('scroll-ok');
      f.stepper({
        steps: stages.length,
        interval: 1500,
        label: (i) => `step ${i + 1} / ${stages.length}`,
        onStep: (i) => {
          k = i;
          const st = stages[i]!;
          f.code.highlight(STAGE_INFO[st.key]!.line);
          const r = st.M[2]!;
          f.code.setMany({ row: SENTENCE[2]!, mu: fmt(mean(r), 2), sd: fmt(std(r), 3) });
          cv.redraw();
        },
      });
    },
    caption: `Step through one block on the six-token sentence: width $\\symd = 8$, two heads, an MLP 32 wide, random weights. The diagram lights the part that runs, the code lights its line, and the grid shows the actual numbers at that point, one row per token (orange positive, blue-gray negative), with each row's mean $\\mu$ and standard deviation $\\sigma$ beside it. Watch the two layer norms: whatever comes in, every row leaves with mean 0 and standard deviation 1. And notice that a residual add changes each row a little instead of replacing it: the block's output is still recognizably its input, plus corrections.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: encoder, decoder, encoder-decoder                              */
/* ------------------------------------------------------------------ */

const SRC: string[] = [...SENTENCE];
const TGT = ['<s>', 'le', 'chat', "s'est", 'assis'];

function figArchitectures(p: Page): void {
  p.figure({
    title: 'Who can see whom: three ways to wire blocks',
    codeTitle: 'masks.py',
    code: `
      S, T = 6, 5        # source and target lengths
      mode = "{{mode:decoder}}"
      if mode == "encoder":              # BERT       #@enc
          mask = np.ones((S, S))         # all see all  #@enc
      elif mode == "decoder":            # GPT        #@dec
          mask = np.tril(np.ones((S, S)))   # the past  #@dec
      else:                              # 2017, T5   #@ed
          enc = np.ones((S, S))          # full         #@ed
          dec = np.tril(np.ones((T, T))) # causal       #@ed
          cross = np.ones((T, S))   # target sees source  #@cross
    `,
    setup(f) {
      let mode: 'encoder' | 'decoder' | 'encdec' = 'decoder';
      let sel = 3;
      let selT = 2;
      let hits: { x: number; y: number; cs: number; n: number; which: 'src' | 'tgt' }[] = [];
      const grid = (ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, rows: string[], cols: string[], allow: (i: number, j: number) => boolean, kq: string, kk: string, title: string, hi: number) => {
        const fs = cs < 30 ? 9.5 : 10.5;
        const stagger = cols.some((wd) => measure(ctx, wd, { size: fs }) > cs - 3);
        text(ctx, title, x + (cols.length * cs) / 2, y - (stagger ? 34 : 26), { size: 12, weight: 600, color: color('--ink') });
        cols.forEach((wd, j) => text(ctx, wd, x + j * cs + cs / 2, y - (stagger && j % 2 ? 19 : 8), { size: fs, color: color(kk as 'green') }));
        rows.forEach((wd, i) => text(ctx, wd, x - 5, y + i * cs + cs / 2, { size: 11, align: 'right', weight: i === hi ? 700 : 400, color: i === hi ? color(kq as 'teal') : color('--ink-3') }));
        for (let i = 0; i < rows.length; i++)
          for (let j = 0; j < cols.length; j++) {
            const ok = allow(i, j);
            const lit = i === hi;
            rbox(ctx, x + j * cs + 1, y + i * cs + 1, cs - 2, cs - 2, 3, ok ? withAlpha(color('purple'), lit ? 0.75 : 0.32) : withAlpha(color('--ink-3'), 0.07), ok ? withAlpha(color('purple'), 0.5) : null, 1);
          }
        rbox(ctx, x, y + hi * cs, cols.length * cs, cs, 4, null, color(kq as 'teal'), 2);
      };
      const cv = f.canvas(640, 380, (ctx, w, h) => {
        hits = [];
        const lab = 44;
        if (mode !== 'encdec') {
          const cs = Math.min(40, (w - lab - 16) / 6);
          const need = 40 + 6 * cs + 34;
          if (fitHeight(cv.canvas, w, h, need)) return;
          const x = (w - (lab + 6 * cs)) / 2 + lab;
          const y = 40;
          const enc = mode === 'encoder';
          grid(ctx, x, y, cs, SRC, SRC, (i, j) => enc || j <= i, 'teal', 'green', enc ? 'self-attention, no mask' : 'masked (causal) self-attention', sel);
          hits.push({ x: x - lab, y, cs, n: 6, which: 'src' });
          const seen = SRC.filter((_, j) => enc || j <= sel).length;
          text(ctx, `"${SRC[sel]}" can use ${seen} of 6 tokens`, w / 2, y + 6 * cs + 18, { size: 12, color: color('--ink-2') });
          return;
        }
        const wide = w >= 600;
        const cs = wide ? Math.min(30, (w - 3 * lab - 40) / 17) : Math.min(27, (w - 2 * lab - 20) / 11);
        const need = wide ? 40 + 6 * cs + 30 : 40 + 6 * cs + 50 + 5 * cs + 30;
        if (fitHeight(cv.canvas, w, h, need)) return;
        if (wide) {
          const tot = 3 * lab + 17 * cs + 40;
          let x = (w - tot) / 2 + lab;
          const y = 40;
          grid(ctx, x, y, cs, SRC, SRC, () => true, 'teal', 'green', 'encoder: self', sel);
          hits.push({ x: x - lab, y, cs, n: 6, which: 'src' });
          x += 6 * cs + 20 + lab;
          grid(ctx, x, y + cs * 0.5, cs, TGT, TGT, (i, j) => j <= i, 'teal', 'green', 'decoder: masked self', selT);
          hits.push({ x: x - lab, y: y + cs * 0.5, cs, n: 5, which: 'tgt' });
          x += 5 * cs + 20 + lab;
          grid(ctx, x, y + cs * 0.5, cs, TGT, SRC, () => true, 'teal', 'green', 'decoder: cross', selT);
          hits.push({ x: x - lab, y: y + cs * 0.5, cs, n: 5, which: 'tgt' });
        } else {
          const x1 = (w - (lab + 6 * cs)) / 2 + lab;
          grid(ctx, x1, 40, cs, SRC, SRC, () => true, 'teal', 'green', 'encoder: self-attention', sel);
          hits.push({ x: x1 - lab, y: 40, cs, n: 6, which: 'src' });
          const y2 = 40 + 6 * cs + 50;
          const tot = 2 * lab + 11 * cs + 14;
          let x = (w - tot) / 2 + lab;
          grid(ctx, x, y2, cs, TGT, TGT, (i, j) => j <= i, 'teal', 'green', 'decoder: masked', selT);
          hits.push({ x: x - lab, y: y2, cs, n: 5, which: 'tgt' });
          x += 5 * cs + 14 + lab;
          grid(ctx, x, y2, cs, TGT, SRC, () => true, 'teal', 'green', 'decoder: cross', selT);
          hits.push({ x: x - lab, y: y2, cs, n: 5, which: 'tgt' });
        }
        text(ctx, `"${TGT[selT]}" sees ${selT + 1} target tokens and all 6 source tokens`, w / 2, h - 12, { size: 12, color: color('--ink-2') });
      });
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        for (const g of hits) {
          if (px < g.x || px > g.x + 44 + 6 * g.cs) continue;
          const i = Math.floor((py - g.y) / g.cs);
          if (i < 0 || i >= g.n) continue;
          if (g.which === 'src') sel = i;
          else selT = i;
          cv.redraw();
          return;
        }
      });
      cv.canvas.classList.add('scroll-ok');
      f.segmented({
        label: 'architecture',
        options: [
          { value: 'encoder', label: 'encoder only' },
          { value: 'decoder', label: 'decoder only' },
          { value: 'encdec', label: 'encoder-decoder' },
        ],
        value: 'decoder',
        onChange: (v) => {
          mode = v;
          f.code.set('mode', v === 'encdec' ? 'encoder-decoder' : v);
          f.code.highlight(v === 'encoder' ? 'enc' : v === 'decoder' ? 'dec' : ['ed', 'cross']);
          cv.redraw();
        },
      });
      f.code.highlight('dec');
    },
    caption: `Each grid is a mask: a row is a token doing the looking (its query), a column a token it may look at (a key), and a filled cell means allowed. **Tap a row** to light what one token can use. The encoder's grid is full; the decoder's is a lower triangle; the encoder-decoder adds a third, full rectangle of **cross-attention** from every target token to every source token, the attention of [the previous chapter](#/seq2seq) rebuilt from the same parts.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: parameter count                                                */
/* ------------------------------------------------------------------ */

const PRESETS: Record<string, [number, number, number]> = {
  'GPT-2 small': [768, 12, 50257],
  'GPT-2 XL': [1600, 48, 50257],
  'GPT-3': [12288, 96, 50257],
};

function figParams(p: Page): void {
  p.figure({
    title: 'Counting a stack’s parameters',
    codeTitle: 'count.py',
    code: `
      d, n_layers = {{d:768}}, {{L:12}}
      vocab = {{V:50257}}
      attn = 4 * d * d         # Wq Wk Wv Wo: {{attn}}   #@attn
      mlp = 2 * d * (4 * d)    # W1, W2: {{mlp}}         #@mlp
      block = attn + mlp       # 12 d^2 = {{block}}      #@block
      embed = vocab * d        # {{emb}}                 #@emb
      total = n_layers * block + embed  # {{total}}      #@total
    `,
    setup(f) {
      let d = 768;
      let L = 12;
      let V = 50257;
      const cv = f.canvas(640, 200, (ctx, w, h) => {
        const pc = paramCount(d, L, V);
        const x0 = 8;
        const bw = w - 16;
        // One block: attention is a third, the MLP two thirds.
        text(ctx, 'one block', x0, 12, { size: 11, align: 'left', color: color('--ink-3') });
        const y1 = 22;
        const aW = (bw * pc.attn) / pc.perBlock;
        rbox(ctx, x0, y1, aW - 2, 30, 6, withAlpha(color('purple'), 0.3), color('purple'), 1.2);
        rbox(ctx, x0 + aW, y1, bw - aW, 30, 6, withAlpha(color('blue'), 0.3), color('blue'), 1.2);
        const fitText = (opts: string[], room: number) => opts.find((t) => measure(ctx, t, { size: 11.5, weight: 600 }) + 10 < room) ?? opts[opts.length - 1]!;
        text(ctx, fitText([`attention 4d² = ${human(pc.attn)}`, `attn ${human(pc.attn)}`, '4d²'], aW), x0 + aW / 2, y1 + 15.5, { size: 11.5, weight: 600, color: color('--ink') });
        text(ctx, fitText([`MLP 8d² = ${human(pc.mlp)}`, `MLP ${human(pc.mlp)}`], bw - aW), x0 + aW + (bw - aW) / 2, y1 + 15.5, { size: 11.5, weight: 600, color: color('--ink') });
        // The whole model.
        text(ctx, `the whole model: ${human(pc.total)} parameters`, x0, 80, { size: 11, align: 'left', color: color('--ink-3') });
        const y2 = 90;
        const bW = (bw * pc.blocks) / pc.total;
        rbox(ctx, x0, y2, Math.max(2, bW - 2), 30, 6, withAlpha(color('blue'), 0.3), color('blue'), 1.2);
        rbox(ctx, x0 + bW, y2, Math.max(2, bw - bW), 30, 6, withAlpha(color('orange'), 0.3), color('orange'), 1.2);
        const share = (100 * pc.blocks) / pc.total;
        const pct = (v: number) => (v < 1 ? '<1%' : v > 99 ? '>99%' : `${Math.round(v)}%`);
        const lb = `${L} blocks: ${human(pc.blocks)} (${pct(share)})`;
        const le = `embedding: ${human(pc.embed)} (${pct(100 - share)})`;
        const roomB = measure(ctx, lb, { size: 11.5, weight: 600 }) + 10 < bW;
        const roomE = measure(ctx, le, { size: 11.5, weight: 600 }) + 10 < bw - bW;
        if (roomB) text(ctx, lb, x0 + bW / 2, y2 + 15.5, { size: 11.5, weight: 600, color: color('--ink') });
        if (roomE) text(ctx, le, x0 + bW + (bw - bW) / 2, y2 + 15.5, { size: 11.5, weight: 600, color: color('--ink') });
        const need = y2 + 48 + 18 * ((roomB ? 0 : 1) + (roomE ? 0 : 1)) + 12;
        if (fitHeight(cv.canvas, w, h, need)) return;
        let y3 = y2 + 48;
        if (!roomB) {
          text(ctx, `■ ${lb}`, x0, y3, { size: 11.5, align: 'left', color: color('blue') });
          y3 += 18;
        }
        if (!roomE) {
          text(ctx, `■ ${le}`, x0, y3, { size: 11.5, align: 'left', color: color('orange') });
          y3 += 18;
        }
        text(ctx, `12 × ${L} × ${d}² = ${human(12 * L * d * d)}`, x0, y3, { size: 11.5, align: 'left', font: 'mono', color: color('--ink-2') });
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        const pc = paramCount(d, L, V);
        f.code.setMany({ d, L, V, attn: human(pc.attn), mlp: human(pc.mlp), block: human(pc.perBlock), emb: human(pc.embed), total: human(pc.total) });
        cv.redraw();
      };
      const dS = f.slider({
        label: 'width d',
        sym: 'd',
        min: 6,
        max: 14,
        value: Math.log2(d),
        map: (r) => Math.max(64, Math.round(2 ** r / 64) * 64),
        format: (v) => String(v),
        onInput: (v) => {
          d = v;
          f.code.highlight(['attn', 'mlp', 'block']);
          sync();
        },
      });
      const lS = f.slider({
        label: 'blocks',
        min: 1,
        max: 128,
        step: 1,
        value: L,
        format: (v) => String(Math.round(v)),
        onInput: (v) => {
          L = Math.round(v);
          f.code.highlight('total');
          sync();
        },
      });
      const vS = f.slider({
        label: 'vocabulary',
        min: 10,
        max: 18,
        value: Math.log2(V),
        map: (r) => Math.round(2 ** r),
        format: (v) => String(v),
        onInput: (v) => {
          V = v;
          f.code.highlight('emb');
          sync();
        },
      });
      f.segmented({
        label: 'preset',
        options: Object.keys(PRESETS).map((k) => ({ value: k, label: k })),
        value: 'GPT-2 small',
        onChange: (k) => {
          const [pd, pl, pv] = PRESETS[k]!;
          dS.set(Math.log2(pd), false);
          lS.set(pl, false);
          vS.set(Math.log2(pv), false);
          d = pd;
          L = pl;
          V = pv;
          f.code.highlight('total');
          sync();
        },
      });
      sync();
    },
    caption: `Drag the width and the depth, or pick a real model. The top bar is one block; it is always one third attention and two thirds MLP. The bottom bar is the whole stack plus the token embedding (biases and layer norms ignored; they add well under 1%). GPT-2 small comes out at 124 million, of which a third is the embedding; at GPT-3's size the embedding is a rounding error and $12 N d^2$ is the whole story. Double the width and the parameters quadruple; double the depth and they only double.`,
  });
}

/* ------------------------------------------------------------------ */

const chapter: ChapterDef = {
  symbols: TRANSFORMER_SYMBOLS,

  render(p) {
    p.prose(`
In 2017 a team at Google Brain and Google Research published a paper with a confident title: *Attention Is All You Need* (Vaswani et al.). It described a translation model, the **Transformer**, that kept the attention of the [previous chapter](#/seq2seq) and threw away the recurrence. No RNN reads the sentence word by word. Instead every token looks at every other token at once, through attention, and a stack of identical blocks refines what each token knows, layer after layer.

It trained much faster than the recurrent models it replaced, and it translated better. Within two years the same block was the base of BERT and GPT; within a few more it was reading images, audio and code. Nearly every model in the rest of this course is a stack of the block this chapter builds.

The plan: why recurrence had to go; then the parts, one at a time. Self-attention with queries, keys and values; the division by $\\sqrt{\\symdk}$ that keeps it trainable; several heads at once; the mask that stops a decoder from peeking; the positional encodings that give back word order; and the residual connections, layer norm and MLP that turn attention into a block. Then the three ways to wire blocks together, and how to count a block's parameters in your head.`);

    /* ---------------------------------------------------------------- why */
    p.h2('Why drop recurrence', 'why');
    p.prose(`
An RNN reads a sentence like a ticker tape: one token at a time, each folded into a hidden state ([CS231n's recurrent networks chapter](#/rnn)). Two things about that shape hurt more and more as models and datasets grew.

**It is sequential.** The hidden state at step $t$ needs the one at step $t - 1$, so a 50-token sentence takes 50 dependent steps, forward and again backward. A GPU is a machine for doing thousands of independent multiplications at once; an RNN hands it one small step at a time, and most of the machine waits.

**Information travels far.** For the 50th token to use the 1st, the information has to survive 49 updates of the hidden state, and the gradient has to survive the same 49 steps on the way back. LSTMs help, but the path stays long.

Attention had already removed the worst bottleneck in translation, by letting the decoder look back at every encoder state instead of one summary vector ([Chapter 1](#/seq2seq)). The Transformer's move was to use attention for *everything*: inside the encoder, inside the decoder, and between them. Every token reaches every other token in one step, and all the positions of a layer are computed together, as one big matrix multiply.`);
    p.table(
      ['Layer type', 'Work per layer', 'Steps that must run in order', 'Longest path between two tokens'],
      [
        ['Recurrent', '$O(T \\cdot d^2)$', '$O(T)$', '$O(T)$'],
        ['Self-attention', '$O(T^2 \\cdot d)$', '$O(1)$', '$O(1)$'],
      ],
      { caption: 'Adapted from Table 1 of Vaswani et al. (2017), for $T$ tokens of width $d$. The $O(\\cdot)$ ("big O") notation keeps only how a cost grows: $O(T)$ steps means twice the length takes twice as many steps, and $O(1)$ means the count does not grow with $T$ at all.' },
    );
    p.prose(`The price is in the second column. Self-attention compares every token with every token, so its work and memory grow with $T^2$. For a 50-token sentence that is nothing; for a book it is everything, and a good part of the [modern transformer](#/modern-transformer) is about paying that bill efficiently.`);

    /* ---------------------------------------------------------------- self-attention */
    p.h2('Self-attention: every token asks every token', 'self-attention');
    p.prose(`
Start with a sentence of $T$ tokens, each already turned into a vector of $\\symd$ numbers (its *embedding*; [Chapter 3](#/tokenization) covers where those come from). Stack them as the rows of a matrix $\\symX$ of shape $(T, \\symd)$.

In [Chapter 1](#/seq2seq), attention was a soft lookup: a query is compared with every key, the match scores become weights through a softmax, and the result is the weighted average of the values. **Self-attention** runs that lookup with every token of the same sequence playing all three parts. Each token produces

- a **query** $\\symQ$: what am I looking for?
- a **key** $\\symK$: what do I contain, for others to find?
- a **value** $\\symV$: what do I hand over to whoever attends to me?

All three come from the same token vector, through three different learned matrices:`);
    p.math({
      label: 'Queries, keys and values',
      tex: String.raw`\begin{aligned} \symQ &= \symX\,\sym{W}{W_Q} \\ \symK &= \symX\,\sym{W}{W_K} \\ \symV &= \symX\,\sym{W}{W_V} \end{aligned}`,
      code: `
        X = E[ids]            # (T, d)    a row per token
        Wq = 0.02 * np.random.randn(d, d_k)   # learned
        Wk = 0.02 * np.random.randn(d, d_k)
        Wv = 0.02 * np.random.randn(d, d_v)
        Q = X @ Wq            # (T, d_k)  a query per token
        K = X @ Wk            # (T, d_k)  a key per token
        V = X @ Wv            # (T, d_v)  a value per token
      `,
      codeTitle: 'qkv.py',
      terms: [
        [String.raw`\symX`, 'the input: $T$ rows, one per token, $d$ numbers each'],
        [String.raw`\sym{W}{W_Q}`, 'a learned $d$ by $d_k$ matrix, shared by every token and every position'],
        [String.raw`\symX\,\sym{W}{W_Q}`, "a matrix product: every token's row is multiplied by the same matrix, which turns that token into its query of length $d_k$ ([math kit](#/math-kit/matrices))"],
        [String.raw`\symQ, \symK, \symV`, 'three new matrices, still with one row per token'],
      ],
      explain: `Why three different matrices instead of using $\\symX$ itself three times? Because what a token is looking for is not the same as what it offers. A verb might look for its subject, while what it offers to others is "I am an action, in the past tense." Separate projections let the model learn those roles separately. (The \`@\` is Python's matrix multiply; for two-dimensional arrays it is the same as \`np.dot\`.)`,
    });
    p.prose(`
Now the lookup. Every query is compared with every key by a [dot product](#/math-kit/dot-product), and one matrix multiply does all $T \\times T$ comparisons at once: row $i$ of the result holds token $i$'s score for every token. Each row then goes through a softmax, so it becomes positive weights that add up to 1, and token $i$'s output is the weighted average of all the value rows:`);
    p.math({
      label: 'Scaled dot-product attention',
      tex: String.raw`\begin{gathered} \symA = \operatorname{softmax}\!\left(\frac{\symQ\,\symK^{\!\top}}{\sqrt{\symdk}}\right) \\[2pt] \operatorname{Attention}(\symQ, \symK, \symV) = \symA\,\symV \end{gathered}`,
      code: `
        S = Q @ K.T / np.sqrt(d_k)   # (T, T): i vs j
        S = S - S.max(axis=1, keepdims=True)   # stability
        A = np.exp(S)
        A = A / A.sum(axis=1, keepdims=True)   # row softmax
        out = A @ V                  # (T, d_v)
      `,
      codeTitle: 'attention.py',
      terms: [
        [String.raw`\symK^{\!\top}`, 'the keys *transposed*: flipped so that rows become columns'],
        [String.raw`\symQ\,\symK^{\!\top}`, 'a $T$ by $T$ grid; entry $(i, j)$ is the dot product of query $i$ with key $j$: how well token $j$ matches what token $i$ is looking for'],
        [String.raw`/\sqrt{\symdk}`, 'divide every score by the square root of the key length. The next section is about why'],
        [String.raw`\operatorname{softmax}`, "applied to each row on its own: exponentiate, then divide by the row's total, so each row becomes positive weights that sum to 1 ([softmax](#/linear-classification/softmax))"],
        [String.raw`\symA`, 'that grid of weights is the **attention matrix**: row $i$ says how much token $i$ takes from each token'],
        [String.raw`\symA\,\symV`, "row $i$ of the output is $\\sum_j A_{ij}\\, v_j$: all the values, mixed in the proportions token $i$ chose"],
      ],
      explain: `Three matrix multiplies and a softmax. Nothing in it loops over time and nothing in it knows the sentence length: six tokens and six hundred go through the same lines, and every token's output is computed at once. The figure runs it on six tokens with numbers small enough to read.`,
    });
    figMatrices(p);
    p.callout('math', `Shapes are the quickest check on any of this. A $(T, d)$ matrix times a $(d, d_k)$ matrix gives $(T, d_k)$: the inner sizes must match and they disappear. So $(T, d_k)$ times $(d_k, T)$ is $(T, T)$: one score for every pair of tokens. Writing the shape next to every line, as the listings here do, catches most bugs before they run ([NumPy chapter](#/numpy/reshape)).`, 'Math help: reading the shapes');

    /* ---------------------------------------------------------------- scaling */
    p.h2('Why divide by √dₖ', 'scaling');
    p.prose(`
The $\\sqrt{\\symdk}$ looks like a detail. It decides whether the model can learn at all.

Picture a query and a key whose $\\symdk$ entries are random numbers with average 0 and standard deviation 1, roughly what they look like when training starts. Their dot product adds up $\\symdk$ products, and each product also has average 0 and *variance* 1. (The **variance** of a random number is the square of its standard deviation: the average squared distance from its mean. See the [math kit](#/math-kit/probability) for mean and spread.) When you add up independent random numbers, their variances add:`);
    p.math({
      label: 'The size of a dot product',
      tex: String.raw`\begin{aligned} \operatorname{Var}(\symQ_i \cdot \symK_j) &= \sum_{m=1}^{\symdk} \operatorname{Var}(q_m\, k_m) = \symdk \\ \operatorname{std}(\symQ_i \cdot \symK_j) &= \sqrt{\symdk} \end{aligned}`,
      code: `
        d_k = 64
        q = np.random.randn(10000, d_k)   # random queries
        k = np.random.randn(10000, d_k)   # and keys
        dots = (q * k).sum(axis=1)        # a dot per pair
        dots.std()                    # about 8.0 = sqrt(64)
        (dots / np.sqrt(d_k)).std()   # about 1.0
      `,
      codeTitle: 'variance.py',
      terms: [
        [String.raw`\symQ_i \cdot \symK_j`, 'one score: $\\sum_m q_m k_m$, a sum of $d_k$ products'],
        [String.raw`\operatorname{Var}(q_m\,k_m) = 1`, 'one product of two independent numbers, each with mean 0 and variance 1, has mean 0 and variance $1 \\times 1 = 1$'],
        [String.raw`\sum_{m=1}^{\symdk}`, 'variances of independent terms add, so the sum has variance $d_k$'],
        [String.raw`\sqrt{\symdk}`, "the standard deviation is the square root: a typical score is about $\\sqrt{d_k}$ in size, 8 for the paper's $d_k = 64$"],
      ],
      explain: `Scores that grow with the width are a problem because of what comes next. A softmax of 0.5, −1 and 2 gives a soft blend. A softmax of the same numbers times 8 (4, −8 and 16) gives almost everything to the largest. And a softmax that has *saturated* like that, one weight near 1 and the rest near 0, has almost no gradient: nudging any score barely moves any weight, so the queries and keys get almost no signal about how to improve. Dividing by $\\sqrt{d_k}$ brings the scores back to a typical size of 1, whatever the width.`,
    });
    figScaling(p);
    p.callout('aside', `[Chapter 1](#/seq2seq) compared two ways to score a query against a key: Bahdanau's *additive* attention (a small network) and the *dot product*. The Transformer paper notes, citing earlier experiments, that additive attention beats *unscaled* dot products when $d_k$ is large, and suspects saturation as the reason. With the $1/\\sqrt{d_k}$, dot products keep up while staying a single, very fast matrix multiply.`, 'Dot products versus additive scores');

    /* ---------------------------------------------------------------- multi-head */
    p.h2('Multi-head attention', 'multi-head');
    p.prose(`
One row of weights per token is a tight budget. In "the cat sat on the mat", the word *sat* might want to know who sat (*cat*), where (*mat*), and what came just before it, all at once. One softmax row gives one blend.

**Multi-head attention** runs $h$ attentions side by side, each with its own small $\\sym{W}{W_Q}$, $\\sym{W}{W_K}$ and $\\sym{W}{W_V}$. Each head works at a reduced width, $\\symdk = \\symd / h$ (the paper's base model: $\\symd = 512$, $h = 8$ heads of 64), so all the heads together cost about as much as one full-width head. Their outputs are concatenated (laid side by side) back to width $\\symd$, and one more matrix, $\\sym{W}{W_O}$, mixes them:`);
    p.math({
      label: 'Multi-head attention',
      tex: String.raw`\begin{gathered} \text{head}_i = \operatorname{Attention}(\symQ_i, \symK_i, \symV_i) \\ \symQ_i = \symX\sym{W}{W_Q^{i}},\ \symK_i = \symX\sym{W}{W_K^{i}},\ \dots \\ \operatorname{MultiHead}(\symX) = [\text{head}_1 \cdots \text{head}_h]\sym{W}{W_O} \end{gathered}`,
      code: `
        def multi_head(X, n_heads):
            T, d = X.shape
            d_k = d // n_heads
            heads = []
            for i in range(n_heads):
                Q = X @ Wq[i]              # (T, d_k)
                K = X @ Wk[i]
                V = X @ Wv[i]
                A = softmax(Q @ K.T / np.sqrt(d_k), axis=1)
                heads.append(A @ V)        # (T, d_k)
            H = np.concatenate(heads, axis=1)   # (T, d)
            return H @ Wo                  # (T, d)
      `,
      codeTitle: 'multi_head.py',
      terms: [
        [String.raw`\sym{W}{W_Q^{i}}`, 'head $i$\'s own query matrix, $d$ by $d_k$; its keys and values come from its own $W_K^i$ and $W_V^i$'],
        [String.raw`\text{head}_i`, 'an ordinary attention, with its own pattern of weights: a $T$ by $d_k$ result'],
        [String.raw`[\,\cdots]`, 'concatenate: put the $h$ results side by side, giving $T$ by $h\\,d_k = T$ by $d$'],
        [String.raw`\sym{W}{W_O}`, 'a $d$ by $d$ output matrix that mixes what the heads found into one vector per token'],
      ],
      explain: `Nobody actually loops over heads: one $(d, d)$ matrix computes every head's queries at once, and a reshape splits the columns into heads (exercise 3 below). Splitting does not add parameters, since $h$ heads of width $d/h$ have exactly the weights of one head of width $d$. What it buys is $h$ separate softmaxes: $h$ different places to look, in every layer.`,
    });
    p.prose(`
What do heads learn to look at? Trained models are full of recognizable patterns: heads that attend to the previous token, heads that link a word to an earlier copy of itself, heads that connect a verb to its subject ([Chapter 20](#/interpretability) goes looking for them). The four heads below are built by hand, with their $\\sym{W}{W_Q}$ and $\\sym{W}{W_K}$ written out, to show that a pattern is nothing more than a choice of those two matrices.`);
    figHeads(p);

    /* ---------------------------------------------------------------- causal */
    p.h2('Causal masking: no peeking', 'causal');
    p.prose(`
A language model learns to predict each next token from the tokens before it ([Chapter 4](#/pretraining)). A transformer can learn from every position of a text at once: feed in all $T$ tokens, get $T$ outputs, and train output $i$ to predict token $i + 1$. One forward pass, $T$ training examples.

The *next* head above shows the catch. If token $i$ can attend to token $i + 1$, the model can simply copy the answer, and it learns nothing it could use when generating, where the next token does not exist yet. The fix is the **causal mask**: before the softmax, set every score where the key comes *after* the query to $-\\infty$.`);
    p.math({
      label: 'The causal mask',
      tex: String.raw`\begin{aligned} \symA &= \operatorname{softmax}\!\left(\frac{\symQ\,\symK^{\!\top}}{\sqrt{\symdk}} + M\right) \\[2pt] M_{ij} &= \begin{cases} 0 & j \le i \\ -\infty & j > i \end{cases} \end{aligned}`,
      code: `
        T = S.shape[0]
        M = np.triu(np.full((T, T), -np.inf), 1)
        # M: 0 on and below the diagonal, -inf above
        A = softmax(S + M, axis=1)   # exp(-inf) = 0
      `,
      codeTitle: 'causal.py',
      terms: [
        [String.raw`M`, 'the mask: 0 where token $i$ may look ($j \\le i$, itself and earlier), $-\\infty$ where it may not'],
        [String.raw`+\,M`, 'adding 0 changes nothing; adding $-\\infty$ turns the score into $-\\infty$'],
        [String.raw`\operatorname{softmax}`, '$e^{-\\infty} = 0$, so a masked key gets exactly zero weight, and the visible weights still add up to 1'],
      ],
      explain: `Row $i$ of the attention matrix can now only spread its weight over tokens 0 to $i$: the matrix is zero above its diagonal, a lower triangle. Every output depends only on its past, so a single pass over a text trains every next-token prediction in it at once, with no cheating. When generating, the model produces one token, appends it, and runs again; the mask makes sure that what each position saw in training matches what it sees then. (Recomputing the whole prefix for every new token would waste work; caching each past token's keys and values avoids it, see [Chapter 6](#/modern-transformer).)`,
    });
    p.prose(`Switch the causal mask on in Figure 2.3 to see it act: the grids turn into lower triangles, the *next* head loses its target and falls back on the current word, and the first token, with nothing before it, can only attend to itself. This is also where much of the transformer's training speed comes from. An RNN must step through a 1,000-token document one token at a time; a masked transformer processes all 1,000 positions in one parallel pass.`);

    /* ---------------------------------------------------------------- positions */
    p.h2('Where am I? Positional information', 'positions');
    p.prose(`
Here is a strange fact about everything so far: self-attention has no idea what order its tokens are in. The score between *cat* and *mat* depends only on their two vectors, not on where they sit. Shuffle the rows of $\\symX$ and the rows of the output are shuffled the same way, and nothing else changes. (In math words, attention is *permutation equivariant*: permuting the input just permutes the output.) "the cat sat on the mat" and "the mat sat on the cat" contain the same bag of words, and an attention layer on its own cannot tell them apart.`);
    figShuffle(p);
    p.prose(`
The fix is to write position into the vectors themselves. Before the first block, add to each token's vector a **positional encoding**: a vector $\\symP_{pos}$ that depends only on the token's position. The paper builds it from sines and cosines of many frequencies:`);
    p.math({
      label: 'Sinusoidal positional encoding',
      tex: String.raw`\begin{aligned} \symP_{pos,\,2i} &= \sin\!\left(\frac{pos}{10000^{2i/\symd}}\right) \\[2pt] \symP_{pos,\,2i+1} &= \cos\!\left(\frac{pos}{10000^{2i/\symd}}\right) \\[2pt] \symX &\leftarrow \symX + \symP \end{aligned}`,
      code: `
        pos = np.arange(T)[:, None]       # (T, 1): 0, 1, 2...
        i = np.arange(0, d, 2)[None, :]   # (1, d/2): 0, 2...
        angle = pos / 10000 ** (i / d)    # (T, d/2)
        P = np.zeros((T, d))
        P[:, 0::2] = np.sin(angle)        # even: sines
        P[:, 1::2] = np.cos(angle)        # odd: cosines
        X = E[ids] + P                    # added, not appended
      `,
      codeTitle: 'positions.py',
      terms: [
        [String.raw`pos`, 'the position in the sequence: 0, 1, 2, ...'],
        [String.raw`2i,\ 2i+1`, 'a pair of neighboring columns: the even one gets a sine, the odd one the matching cosine'],
        [String.raw`10000^{2i/\symd}`, 'how slowly that pair turns: from one cycle every $2\\pi \\approx 6.3$ positions for the first pair to about $2\\pi \\times 10{,}000$ for the last, growing by the same factor from pair to pair'],
        [String.raw`\symX + \symP`, 'the encoding is *added* to the token vectors, so the width stays $d$'],
      ],
      explain: `Think of a clock with many hands, or of the digits of a counter. The first pair of columns spins fast and tells neighbors apart; later pairs turn slowly and tell the start of a document from its middle. Every position gets its own pattern. And there is a deeper reason for sines and cosines: moving forward by a fixed offset $k$ rotates every (sine, cosine) pair by a fixed angle, so the code for $pos + k$ is a fixed *linear function* of the code for $pos$, the same for every $pos$. A single matrix can therefore express "the token $k$ places back", which is exactly how the *previous* head of Figure 2.3 was built.`,
    });
    figSinusoids(p);
    p.callout('history', `The paper also tried learning one position vector per slot as ordinary parameters and got nearly identical results; it kept the sinusoids in the hope that they would carry over to sequences longer than any seen in training. GPT and BERT (2018) used learned position vectors. Most models today use *rotary* embeddings instead (RoPE, 2021), which rotate the queries and keys so that their dot product depends directly on the offset between two tokens; see [Chapter 6](#/modern-transformer). One more detail from the paper: the token embeddings are multiplied by $\\sqrt{d}$ before the encoding is added, so the two have comparable sizes.`, 'Learned positions, and what came next');

    /* ---------------------------------------------------------------- block */
    p.h2('The Transformer block', 'block');
    p.prose(`
Attention moves information *between* tokens. A model also needs to work on the information *within* each token, and it has to stay trainable when dozens of layers are stacked. The block wraps attention with three more pieces:

1. **A feed-forward network** (an MLP), applied to every token separately with the same weights: two linear layers with a ReLU between them, widening to $4\\symd$ in the middle ($d_{ff} = 2048$ for $\\symd = 512$). Attention mixes across tokens; the MLP processes each token on its own.
2. **Residual connections.** Each sublayer's output is *added* to its input instead of replacing it, the trick that made 152-layer ResNets trainable ([ConvNet case studies](#/convnets/case-studies)). A sublayer only has to learn a correction, and the gradient has a direct path down through the additions.
3. **Layer normalization** (Ba, Kiros and Hinton, 2016): rescale each token's vector to mean 0 and standard deviation 1, then apply a learned gain and shift.`);
    p.math({
      label: 'Layer normalization',
      tex: String.raw`\begin{aligned} \operatorname{LN}(\symX_i) &= \gamma \odot \frac{\symX_i - \mu_i}{\sqrt{\sigma_i^2 + \epsilon}} + \beta \\[2pt] \mu_i &= \tfrac{1}{\symd}\textstyle\sum_{m} x_{im} \\[2pt] \sigma_i^2 &= \tfrac{1}{\symd}\textstyle\sum_{m} (x_{im} - \mu_i)^2 \end{aligned}`,
      code: `
        def layer_norm(x, gamma, beta, eps=1e-5):
            mu = x.mean(axis=1, keepdims=True)   # (T, 1)
            var = x.var(axis=1, keepdims=True)   # (T, 1)
            xhat = (x - mu) / np.sqrt(var + eps)
            return gamma * xhat + beta    # gamma, beta: (d,)
      `,
      codeTitle: 'layer_norm.py',
      terms: [
        [String.raw`\symX_i`, "one token's vector of $d$ numbers"],
        [String.raw`\mu_i,\ \sigma_i^2`, 'the mean and the variance of those $d$ numbers'],
        [String.raw`\frac{\symX_i - \mu_i}{\sqrt{\sigma_i^2 + \epsilon}}`, 'shift to mean 0 and scale to standard deviation 1; the tiny $\\epsilon$ avoids dividing by zero'],
        [String.raw`\gamma \odot \cdot + \beta`, 'a learned gain and shift per feature ($\\odot$: multiply entry by entry), so the network can undo the normalization where that helps'],
      ],
      explain: `It is [batch normalization](#/nn-data-loss/batchnorm) turned sideways. Batch norm averages each feature over the examples in a batch; layer norm averages each token over its own features. So it does not care about batch size, and it behaves the same in training and at test time, which matters for sequences of different lengths and for generating one token at a time.`,
    });
    p.prose(`Put together, the 2017 block applies a sublayer, adds the input back, and normalizes, twice:`);
    p.math({
      label: 'One Transformer block (post-norm, as in 2017)',
      tex: String.raw`\begin{aligned} \symX &\leftarrow \operatorname{LN}\big(\symX + \operatorname{MultiHead}(\symX)\big) \\ \symX &\leftarrow \operatorname{LN}\big(\symX + \operatorname{FFN}(\symX)\big) \\ \operatorname{FFN}(x) &= \max(0,\, x\,\sym{W}{W_1} + b_1)\,\sym{W}{W_2} + b_2 \end{aligned}`,
      code: `
        def block(x):                       # x: (T, d)
            x = layer_norm(x + multi_head(x, n_heads))
            h = np.maximum(0, x @ W1 + b1)  # (T, 4d)
            x = layer_norm(x + h @ W2 + b2) # (T, d)
            return x

        x = E[ids] * np.sqrt(d) + P[:len(ids)]
        for _ in range(n_layers):     # N = 6 in the paper
            x = block(x)              # (T, d) in and out
      `,
      codeTitle: 'transformer_block.py',
      terms: [
        [String.raw`\symX + \operatorname{MultiHead}(\symX)`, 'attention computes a correction; the residual connection adds it to what was there'],
        [String.raw`\operatorname{LN}`, 'normalize each token to mean 0 and standard deviation 1'],
        [String.raw`\max(0,\, x\,\sym{W}{W_1} + b_1)`, 'widen each token to $4d$ numbers and apply a ReLU ($W_1$ is $d$ by $4d$)'],
        [String.raw`\sym{W}{W_2}`, 'project back down to $d$ ($4d$ by $d$)'],
      ],
      explain: `A block takes a $(T, d)$ matrix and returns one of the same shape, which is what lets blocks stack: $N$ copies, one after another, each with its own weights. The whole model is just embed the tokens, add positions, run the blocks, and finish with a linear layer to one score per vocabulary word followed by a softmax (the *unembedding*, [Chapter 3](#/tokenization)). Between the embedding and the unembedding, it is the same block over and over.`,
    });
    figBlock(p);
    p.callout('warning', `The 2017 block normalizes *after* each residual add (post-norm), as above. GPT-2 (2019) moved the layer norm to the start of each sublayer, $x + \\operatorname{Attention}(\\operatorname{LN}(x))$, which leaves the residual path from input to output untouched and makes deep stacks much easier to train. Nearly every model since does the same. [The modern transformer block](#/modern-transformer) covers that change and the others (RMSNorm, rotary positions, SwiGLU, grouped-query attention).`, 'Post-norm and pre-norm');
    p.callout('history', `The paper's base model used $N = 6$ blocks in both the encoder and the decoder, $d = 512$, $h = 8$ heads and $d_{ff} = 2048$: about 65 million parameters, trained for about 12 hours on eight GPUs. A "big" version ($d = 1024$, 16 heads, about 3.5 days of training) set a new state of the art in English-to-German and English-to-French translation, and even the base model beat every earlier English-to-German result, at a small fraction of their training cost. Training used Adam with a warmup and decay schedule for the learning rate ([Chapter 7](#/optimizers)), dropout and label smoothing.`, 'The original recipe');

    /* ---------------------------------------------------------------- architectures */
    p.h2('Encoder, decoder, encoder-decoder', 'architectures');
    p.prose(`
The original Transformer was built for translation, so it has two halves. The **encoder** reads the source sentence with unmasked self-attention: every source token sees every other. The **decoder** writes the translation with masked self-attention, plus a third sublayer in each of its blocks, **cross-attention**: its queries come from the decoder, its keys and values from the encoder's final output, so every target token can look at the whole source sentence.

Later models kept one half or the other:`);
    p.table(
      ['Shape', 'Attention', 'Trained to', 'Examples'],
      [
        ['Encoder only', 'full: every token sees all', 'fill in words that were masked out', 'BERT (2018)'],
        ['Decoder only', 'causal: every token sees its past', 'predict the next token', 'GPT (2018), GPT-2, GPT-3, today\'s chat models'],
        ['Encoder-decoder', 'full in the encoder, causal in the decoder, plus cross-attention', 'turn one sequence into another', 'the 2017 Transformer, T5 (2019)'],
      ],
    );
    figArchitectures(p);
    p.prose(`An encoder is the natural choice for understanding a text you already have (classify it, find things in it); a decoder for producing text. Today's large language models are almost all decoder-only: one causal stack, trained on next-token prediction, which turns out to be general enough to cover translation, summarization and question answering by phrasing them as text to continue ([Chapter 4](#/pretraining)).`);

    /* ---------------------------------------------------------------- params */
    p.h2('Counting parameters: about 12 d²', 'parameters');
    p.prose(`
How big is a block? Count its matrices; biases and layer-norm gains are vectors of length $d$ or $4d$ and hardly matter.

- **Attention**: $\\sym{W}{W_Q}$, $\\sym{W}{W_K}$, $\\sym{W}{W_V}$ and $\\sym{W}{W_O}$ are each $\\symd \\times \\symd$ (the $h$ heads of width $\\symd/h$ fill exactly $\\symd$ columns), so $4\\symd^2$.
- **MLP**: $\\sym{W}{W_1}$ is $\\symd \\times 4\\symd$ and $\\sym{W}{W_2}$ is $4\\symd \\times \\symd$, so $8\\symd^2$.`);
    p.math({
      label: 'Parameters of a decoder-only stack',
      tex: String.raw`\begin{aligned} \text{per block} &\approx 4\symd^2 + 8\symd^2 = 12\,\symd^2 \\ \text{total} &\approx 12\,N\,\symd^2 + |\mathcal{V}|\,\symd \end{aligned}`,
      code: `
        def count(d, n_layers, vocab):
            attn = 4 * d * d      # Wq, Wk, Wv, Wo
            mlp = 2 * d * 4 * d   # W1 (d, 4d), W2 (4d, d)
            return n_layers * (attn + mlp) + vocab * d

        count(768, 12, 50257)     # 123.5 million: GPT-2 small
        count(12288, 96, 50257)   # 174.6 billion: GPT-3
      `,
      codeTitle: 'count.py',
      terms: [
        [String.raw`12\,\symd^2`, 'one block: a third of it attention, two thirds MLP'],
        [String.raw`N`, 'the number of blocks'],
        [String.raw`|\mathcal{V}|\,\symd`, 'the token embedding: one row of $d$ numbers per vocabulary entry (often shared with the unembedding at the output)'],
      ],
      explain: `Twelve $d$ squared is worth memorizing. GPT-2 small has $d = 768$ and 12 blocks: $12 \\times 12 \\times 768^2 \\approx 85$ million in the blocks, plus $50{,}257 \\times 768 \\approx 39$ million in the embedding, about 124 million in all. GPT-3 has $d = 12{,}288$ and 96 blocks: $12 \\times 96 \\times 12{,}288^2 \\approx 174$ billion, its famous 175B. Parameters grow with the *square* of the width but only linearly with depth.`,
    });
    figParams(p);
    p.prose(`Parameters are not the whole cost, though. The $T \\times T$ score matrix has no parameters at all, yet its compute and memory grow with the square of the sequence length. And training compute depends on parameters *and* tokens: roughly 6 floating-point operations per parameter per token, which is where [Chapter 5](#/scaling-laws) picks up.`);

    p.callout('idea', `
- **Self-attention** turns every token into a query, a key and a value with three learned matrices, scores every query against every key in one matrix multiply, and gives each token a softmax-weighted blend of the values. Every token reaches every other in one step, and all positions are computed in parallel; the price is $T^2$ work.
- **Divide by $\\sqrt{d_k}$**: dot products of width $d_k$ have standard deviation $\\sqrt{d_k}$, which would saturate the softmax and starve it of gradient.
- **Multiple heads** give each token several softmaxes, several places to look, at the same total cost.
- **The causal mask** ($-\\infty$ above the diagonal) lets a decoder train on every next-token prediction of a text in one pass without seeing the future.
- **Attention ignores order**; positional encodings (sinusoids in 2017) put it back.
- **A block** is attention plus a per-token MLP, each wrapped in a residual add and a layer norm. Encoders, decoders and encoder-decoders are stacks of it with different masks, and each block holds about $12d^2$ parameters.`, 'Takeaways');

    /* ---------------------------------------------------------------- exercises */
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **Warm-up: attention in five lines** (10 minutes). Write \`attention(X, Wq, Wk, Wv)\` in NumPy for \`X\` of shape (T, d). Check that every row of \`A\` sums to 1, and that shuffling the rows of \`X\` shuffles the output the same way: \`np.allclose(attention(X[perm], ...), attention(X, ...)[perm])\`. Then add sinusoidal positions to \`X\` before the call and watch that check fail. Success: both checks behave as described for several random permutations.
2. **The square-root experiment** (20 minutes). For $d_k$ in 4, 16, 64 and 256, draw 10,000 random query and key pairs; record the standard deviation of their dot products and, for one query against 8 keys, the largest softmax weight and $1 - \\sum a^2$, with and without dividing by $\\sqrt{d_k}$. Plot each against $d_k$ on log axes. Success: the unscaled standard deviation is a straight line of slope one half, the scaled one is flat at 1, and the unscaled softmax approaches one-hot as $d_k$ grows.
3. **Batched multi-head attention with a mask** (an hour). Take \`x\` of shape (B, T, C) for batch, time and channels. Compute $Q$, $K$ and $V$ with one (C, C) matrix each, reshape them to (B, h, T, C/h) with \`reshape\` and \`transpose\`, apply causal attention to all heads at once, transpose back to (B, T, C) and multiply by $W_O$. Write a slow version that loops over the batch and the heads and compare. Success: the two agree to about \`1e-10\`, and changing token $t$ of the input never changes any output before position $t$.
4. **Count GPT-2 exactly** (30 minutes). Extend the parameter count to include biases, the two layer norms per block, the final layer norm and the 1,024 learned position vectors, with the output layer tied to the token embedding. Success: GPT-2 small comes out at about 124.4 million. If you have the \`transformers\` library, load the real model and compare your count with \`sum(p.numel() for p in model.parameters())\`.
5. **Project: a tiny GPT** (a weekend). Build a decoder-only transformer in PyTorch: token embeddings, positions, 2 to 4 pre-norm blocks with causal multi-head attention and an MLP, a final layer norm and an output layer. Train it on a small text, such as a megabyte of Shakespeare, one character per token. Success: the validation loss falls well below that of a model that only knows letter frequencies, samples look like the source text at a glance, and plotting the attention matrices of the first layer reveals at least one head that attends mostly to the previous character.`);
  },
};

export default chapter;
