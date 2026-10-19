import { clamp01, lerp, smooth, type Scene, type SceneDef } from '../../lecture/scene';
import { HEADS, type Word, fig1 } from '../../lib/transformer-model';
import { type K, HEAD_A, NEXT_MASKED, P64, TR, WORDS, area, check, chip, colLabels, heat, pill, rowLabels, short, signedFill, spread } from './kit';

/* ------------------------------------------------------------------ heads */

const HEAD_K: K[] = ['teal', 'green', 'orange', 'gold'];
const HEAD_BEAT = ['prev', 'next', 'nouns', 'sameword'];

const heads: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.13);
    // Opening: what sat might want to know.
    const bA = s.win('budget', 'many');
    s.alpha(bA, () => {
      const xs = spread(6, ax, ax + aw);
      const y = ay + ah * 0.62;
      const c = s.ctx;
      const targets: [number, string, K][] = [
        [1, 'who sat?', 'teal'],
        [5, 'where?', 'orange'],
      ];
      targets.forEach(([j, q, k], n) => {
        const a = s.ease('budget', 0.6, 1.2 + n * 0.8);
        s.alpha(a, () => {
          const mid = (xs[2]! + xs[j]!) / 2;
          const rise = Math.abs(j - 2) * u * 7;
          c.beginPath();
          c.moveTo(xs[2]!, y - u * 3.6);
          c.quadraticCurveTo(mid, y - u * 3.6 - rise * 2, xs[j]!, y - u * 3.6);
          c.strokeStyle = s.c(k);
          c.lineWidth = u * 0.5;
          c.stroke();
          s.text(q, mid, y - u * 4 - rise, { font: 'serif', size: 4.4, italic: true, color: s.c(k), halo: true });
        });
      });
      WORDS.forEach((wd, i) => chip(s, wd, xs[i]!, y, i === 2 ? 'teal' : 'orange', { on: i === 2 ? 1 : 0, size: 3.8, maxW: aw / 6 - u }));
      s.text('one softmax row: one blend', w / 2, ay + ah * 0.88, { font: 'ui', size: 3.6, color: s.c('--ink-2') });
    });
    const gA = s.ease('many', 0.6);
    if (gA <= 0) return;
    // Four grids: 2 x 2, shrinking toward the top when the concat diagram arrives.
    const cc = s.ease('concat', 0.8);
    const tall = s.tall;
    const lab = u * 8;
    const gridsW = tall ? aw : aw * lerp(1, 0.6, cc);
    const gridsH = ah;
    const cs = Math.min((gridsW / 2 - lab - u * 3) / 6, (gridsH / 2 - u * 9) / 6);
    const gw = lab + 6 * cs;
    const gh = u * 9 + 6 * cs;
    const gx0 = ax + (gridsW - 2 * gw - u * 3) / 2;
    const gy0 = ay + u * 2;
    s.alpha(gA * (tall ? 1 - cc : 1), () => {
      HEADS.forEach((hn, k) => {
        const x = gx0 + (k % 2) * (gw + u * 3) + lab;
        const y = gy0 + Math.floor(k / 2) * (gh + u * 2) + u * 7;
        const fill = s.ease(HEAD_BEAT[k]!, 0.6);
        const named = fill > 0.5;
        const tagA = s.win('how', 'concat');
        s.alpha(1 - tagA, () => s.text(named ? hn : `head ${k + 1}`, x + 3 * cs, y - u * 5.2, { font: 'ui', size: 3.3, weight: 650, color: s.c(named ? HEAD_K[k]! : '--ink-3') }));
        s.alpha(tagA, () => s.text(k < 2 ? 'reads positions' : 'reads words', x + 3 * cs, y - u * 5.2, { font: 'ui', size: 3.3, weight: 650, italic: true, color: s.c(HEAD_K[k]!) }));
        if (cs >= u * 4.2) rowLabels(s, WORDS, x - u * 1.2, y, cs, { size: Math.min(2.8, (cs / u) * 0.45) });
        else rowLabels(s, WORDS.map((wd) => wd[0]!), x - u * 1.2, y, cs, { size: 2.8 });
        const lit = s.since(HEAD_BEAT[k]!) >= 0 && (k === 3 || s.since(HEAD_BEAT[k + 1]!) < 0) && s.since('how') < 0;
        heat(s, x, y, cs, HEAD_A[k]!, { a: (i) => fill * clamp01(fill * 7 - i * 0.8) + (1 - fill) * 0.0001, k: 'purple', sel: lit ? 2 : undefined });
        s.rrect(x - u * 0.4, y - u * 0.4, 6 * cs + u * 0.8, 6 * cs + u * 0.8, 1.2, { stroke: s.tint(named ? HEAD_K[k]! : '--ink-3', 0.6), lw: 0.3 });
      });
    });
    // Concatenate the four head outputs and mix them with W_O.
    if (cc > 0) {
      const r: [number, number, number, number] = tall ? [ax, ay + u * 4, aw, ah * 0.8] : [ax + aw * 0.62, ay + u * 6, aw * 0.38, ah * 0.8];
      const [rx, ry, rw, rh] = r;
      const rowH = tall ? Math.min(u * 7, (rh - u * 14) / 6) : Math.min(u * 3.6, (rh - u * 14) / 6);
      const colW = tall ? Math.min(u * 8, rw / 9) : Math.min(u * 5, rw / 12);
      const slide = s.ease('concat', 1.2, 0.8);
      const wo = s.ease('wo', 0.6);
      const blockW = 4 * colW;
      const startX = tall ? rx + rw * 0.06 : rx + (rw - blockW) / 2;
      const yTop = ry + u * 6;
      s.alpha(cc, () => {
        HEADS.forEach((_, k) => {
          const spreadX = startX + k * (colW + u * 3);
          const packedX = startX + k * colW;
          const x = lerp(spreadX, packedX, slide);
          for (let i = 0; i < 6; i++) s.rrect(x + 0.5, yTop + i * rowH + 0.5, colW - 1, rowH - 1, 0.5, { fill: s.tint(HEAD_K[k]!, 0.55) });
        });
        s.text(slide > 0.5 ? 'concat: (6, d)' : '4 heads, (6, d/4) each', startX + (slide > 0.5 ? blockW / 2 : (4 * colW + 9 * u) / 2), yTop - u * 2.6, { font: 'mono', size: 3, weight: 600, color: s.c('--ink-2') });
      });
      s.alpha(wo, () => {
        const ox = tall ? rx + rw * 0.94 - blockW : startX;
        const oy = tall ? yTop : yTop + 6 * rowH + u * 13;
        if (tall) {
          s.arrow(startX + blockW + u * 2, yTop + 3 * rowH, ox - u * 2, yTop + 3 * rowH, s.c('blue'), 0.45, 2);
          s.text('× Wo', (startX + blockW + ox) / 2, yTop + 3 * rowH - u * 3, { font: 'mono', size: 3.2, weight: 600, color: s.c('blue') });
        } else {
          s.arrow(startX + blockW / 2, yTop + 6 * rowH + u * 2, startX + blockW / 2, oy - u * 2.4, s.c('blue'), 0.45, 2);
          s.text('× Wo', startX + blockW / 2 + u * 3, yTop + 6 * rowH + u * 6.5, { font: 'mono', size: 3.2, weight: 600, align: 'left', color: s.c('blue') });
        }
        for (let i = 0; i < 6; i++) s.rrect(ox + 0.5, oy + i * rowH + 0.5, blockW - 1, rowH - 1, 0.5, { fill: s.tint('orange', 0.45) });
        s.text('one vector per token', ox + blockW / 2, oy + 6 * rowH + u * 3, { font: 'ui', size: 3, color: s.c('--ink-2') });
      });
      s.alpha(s.ease('cost', 0.6), () => {
        const y = tall ? yTop + 6 * rowH + u * 14 : yTop + 12 * rowH + u * 21;
        const x = tall ? w / 2 : rx + rw / 2;
        pill(s, '8 heads × 64 = 512', x, y, 'purple', { size: 3.4 });
      });
    }
  },
};

/* ------------------------------------------------------------------ causal mask */

const TARGETS = ['cat', 'sat', 'on', 'the', 'mat', '.'];

const mask: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.13);
    const tall = s.tall;
    // Inputs and the targets they predict.
    const pA = s.win('lm', 'cheat') + s.win('payoff', 'generate');
    if (pA > 0) {
      const xs = spread(6, ax, ax + aw);
      const y0 = ay + ah * 0.3;
      const y1 = ay + ah * 0.66;
      const par = s.since('parallel') >= 0;
      s.alpha(Math.min(1, pA), () => {
        s.text('input', ax, y0 - u * 6, { font: 'ui', size: 3, color: s.c('--ink-3'), align: 'left' });
        s.text('predict', ax, y1 - u * 6, { font: 'ui', size: 3, color: s.c('--ink-3'), align: 'left' });
        WORDS.forEach((wd, i) => {
          const a = par ? 1 : s.ease('lm', 0.4, 0.5 + i * 0.5);
          s.alpha(a, () => {
            chip(s, wd, xs[i]!, y0, 'orange', { size: 3.6, maxW: aw / 6 - u });
            s.arrow(xs[i]!, y0 + u * 3.6, xs[i]!, y1 - u * 3.8, s.tint(par ? 'purple' : '--ink-3', 0.85), 0.35, 1.6);
            chip(s, TARGETS[i]!, xs[i]!, y1, 'purple', { size: 3.6, maxW: aw / 6 - u, on: par ? 0.4 : 0 });
          });
          if (s.since('payoff') >= 0) s.alpha(s.ease('payoff', 0.4, 0.15 * i), () => check(s, xs[i]!, y1 + u * 7, u * 2));
        });
        const msg = s.since('payoff') >= 0 ? 'one pass: six lessons, no peeking' : par ? 'one pass: six predictions at once' : '';
        if (msg) s.text(msg, w / 2, ay + ah * 0.95, { font: 'ui', size: 3.6, weight: 600, color: s.c(s.since('payoff') >= 0 ? 'green' : 'purple') });
      });
    }
    // The cheating head, the mask, the triangle.
    const mA = s.win('cheat', 'payoff');
    if (mA > 0) {
      const lab = u * 8;
      const both = s.since('mask') >= 0;
      const cs = tall ? Math.min((aw - 2 * lab - u * 6) / 12, (ah - u * 16) / 6) : Math.min((aw - 2 * lab - u * 10) / 12, (ah - u * 18) / 6);
      const gwid = lab + 6 * cs;
      const x1 = both ? ax + (aw - 2 * gwid - u * 6) / 2 + lab : w / 2 - gwid / 2 + lab;
      const x2 = x1 + gwid + u * 6;
      const y = ay + u * 10;
      const masked = s.ease('triangle', 0.8);
      const next = s.since('next') >= 0;
      s.alpha(mA, () => {
        // Left: the next-word head, first unmasked, then masked.
        const A = next ? NEXT_MASKED : HEAD_A[1]!;
        const cheatFlag = s.since('mask') < 0 ? s.ease('cheat', 0.5, 1) : 0;
        rowLabels(s, WORDS, x1 - u * 1.2, y, cs, { size: Math.min(2.9, (cs / u) * 0.42) });
        colLabels(s, WORDS, x1, y - u * 2.2, cs, { size: Math.min(2.6, (cs / u) * 0.4) });
        heat(s, x1, y, cs, A, { mask: next ? 1 : 0, flag: (i, j) => (j === i + 1 ? cheatFlag : 0) });
        s.text(next ? 'next-word head, masked' : 'next-word head', x1 + 3 * cs, y - u * 6.5, { font: 'ui', size: 3.2, weight: 650, color: s.c('--ink') });
        s.alpha(cheatFlag, () => s.text('row i reads token i + 1: the answer', x1 + 3 * cs, y + 6 * cs + u * 4, { font: 'ui', size: 3.1, weight: 600, color: s.c('red') }));
        s.alpha(s.ease('next', 0.5), () => s.text('falls back on the current word', x1 + 3 * cs, y + 6 * cs + u * 4, { font: 'ui', size: 3.1, weight: 600, color: s.c('purple') }));
        // Right: the mask itself, becoming a lower triangle.
        s.alpha(s.ease('mask', 0.6), () => {
          s.text(masked > 0.5 ? 'what each row may see' : 'the mask M', x2 + 3 * cs, y - u * 6.5, { font: 'ui', size: 3.2, weight: 650, color: s.c('--ink') });
          for (let i = 0; i < 6; i++)
            for (let j = 0; j < 6; j++) {
              const fut = j > i;
              const cx = x2 + j * cs;
              const cy = y + i * cs;
              const k: K = fut ? 'red' : 'slate';
              s.alpha(1 - masked, () => s.cell(cx, cy, cs, cs, fut ? '−∞' : '0', k, { on: fut ? 0.4 : 0, size: Math.min(3, (cs / u) * 0.4) }));
              s.alpha(masked, () => s.rrect(cx + 1, cy + 1, cs - 2, cs - 2, 0.8, { fill: fut ? s.tint('--ink-3', 0.08) : s.tint('purple', 0.4) }));
            }
          s.alpha(s.ease('zero', 0.5) * (1 - masked), () => s.text('e to the −∞ = 0', x2 + 3 * cs, y + 6 * cs + u * 4, { font: 'mono', size: 3.1, weight: 600, color: s.c('red') }));
          s.alpha(masked, () => s.text('itself and its past', x2 + 3 * cs, y + 6 * cs + u * 4, { font: 'ui', size: 3.1, weight: 600, color: s.c('purple') }));
        });
      });
    }
    // Generating, one token at a time.
    const gA = s.ease('generate', 0.6);
    if (gA > 0) {
      const n = 1 + Math.min(5, Math.floor(s.prog('generate') * 6.5));
      const lab = u * 8;
      const cs = Math.min(u * 7, (ah * 0.5) / 6);
      const gx = w / 2 - (lab + 6 * cs) / 2 + lab;
      const gy = ay + ah * 0.32;
      s.alpha(gA, () => {
        const xs = spread(6, ax, ax + aw);
        WORDS.forEach((wd, i) => s.alpha(i < n ? 1 : 0.15, () => chip(s, wd, xs[i]!, ay + u * 4, i === n - 1 ? 'purple' : 'orange', { size: 3.4, maxW: aw / 6 - u, on: i === n - 1 ? 1 : 0 })));
        rowLabels(s, WORDS.slice(0, n), gx - u * 1.2, gy, cs, { size: 2.8 });
        for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) s.rrect(gx + j * cs + 1, gy + i * cs + 1, cs - 2, cs - 2, 0.8, { fill: s.tint('purple', i === n - 1 ? 0.55 : 0.3) });
        s.text('write one, append it, run again', w / 2, gy + 6 * cs + u * 5, { font: 'ui', size: 3.4, weight: 600, color: s.c('--ink-2') });
      });
    }
  },
};

/* ------------------------------------------------------------------ order */

const PERM = [3, 0, 5, 1, 4, 2];
const OUT2 = fig1(PERM.map((i) => WORDS[i]! as Word)).out;

const order: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.13);
    const xs = spread(6, ax, ax + aw);
    const bag = s.ease('bag', 0.6);
    const mainA = 1 - bag;
    const shuf = s.ease('shuffle', 1.6, 0.6);
    const y = ay + ah * 0.34;
    const cw = Math.min(aw / 6 - u * 2, u * 13);
    s.alpha(mainA, () => {
      // Word i slides from slot i to the slot where the permutation puts it.
      const slotOf = (i: number) => PERM.indexOf(i);
      WORDS.forEach((wd, i) => {
        const x = lerp(xs[i]!, xs[slotOf(i)]!, shuf);
        const lift = Math.sin(shuf * Math.PI) * u * 8 * (i % 2 ? 1 : -1);
        chip(s, wd, x, y + lift, 'orange', { size: 3.8, maxW: aw / 6 - u, on: s.win('why', 'outs') * (i === 1 || i === 5 ? 1 : 0) });
        const oa = s.ease('outs', 0.5, 0.12 * i);
        s.alpha(oa, () => {
          const v = TR.out[i]!;
          v.forEach((val, j) => {
            const cy = y + lift + u * 6 + j * u * 6.4;
            s.rrect(x - cw / 2, cy, cw, u * 5.6, 1, { fill: signedFill(s, val, 1.2), stroke: s.tint('orange', 0.5), lw: 0.25 });
            s.text(short(val), x, cy + u * 3, { font: 'mono', size: 3, color: s.c('--ink') });
          });
          if (s.since('moved') >= 0) {
            const same = OUT2[slotOf(i)]!.every((v2, j) => Math.abs(v2 - TR.out[i]![j]!) < 1e-12);
            if (same) s.alpha(s.ease('moved', 0.4, 0.1 * i), () => check(s, x, y + lift + u * 22, u * 2.2));
          }
        });
      });
      s.alpha(s.win('why', 'outs'), () => s.text('score(cat, mat) uses only their two vectors', w / 2, ay + ah * 0.08, { font: 'ui', size: 3.4, weight: 600, color: s.c('--ink-2') }));
      s.alpha(s.ease('moved', 0.5), () => s.text('same outputs: the rows only moved', w / 2, ay + ah * 0.9, { font: 'ui', size: 3.8, weight: 650, color: s.c('green') }));
      s.alpha(s.win('strange', 'why'), () => s.text('which came first?', w / 2, ay + ah * 0.8, { font: 'serif', size: 5, italic: true, color: s.c('--ink-2') }));
    });
    s.alpha(bag, () => {
      const lines = ['the cat sat on the mat', 'the mat sat on the cat'];
      lines.forEach((ln, k) => s.text(ln, w / 2, h * (0.36 + 0.14 * k), { font: 'serif', size: 5.6, italic: true, color: s.c('--ink') }));
      s.text('same bag of words, same outputs', w / 2, h * 0.64, { font: 'ui', size: 3.6, weight: 600, color: s.c('red') });
      s.alpha(s.ease('fix', 0.5), () => pill(s, '+ position', w / 2, h * 0.8, 'red', { size: 4.4 }));
    });
  },
};

/* ------------------------------------------------------------------ positions */

const W16 = [0, 1, 2, 3].map((i) => 1 / 10000 ** ((2 * i) / 16));
const WAVE_K: K[] = ['red', 'orange', 'gold', 'green'];

/** P64 as an image, rebuilt only when the theme changes. */
let posImg: { key: string; c: HTMLCanvasElement } | null = null;
function posImage(s: Scene): HTMLCanvasElement {
  const key = `${s.c('orange')}${s.c('slate')}${s.c('--card')}`;
  if (posImg?.key === key) return posImg.c;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const im = g.createImageData(64, 64);
  const hex = (k: string) => (k.match(/[0-9a-f]{2}/gi) ?? ['80', '80', '80']).map((x) => parseInt(x, 16));
  const pc = hex(s.c('orange'));
  const nc = hex(s.c('slate'));
  const bg = hex(s.c('--card'));
  for (let r = 0; r < 64; r++)
    for (let q = 0; q < 64; q++) {
      const v = P64[r]![q]!;
      const k = v >= 0 ? pc : nc;
      const a = Math.abs(v);
      const o = (r * 64 + q) * 4;
      for (let ch = 0; ch < 3; ch++) im.data[o + ch] = Math.round(bg[ch]! * (1 - a) + k[ch]! * a);
      im.data[o + 3] = 255;
    }
  g.putImageData(im, 0, 0);
  posImg = { key, c };
  return c;
}

const positions: SceneDef = {
  marks: {
    rot: { tex: String.raw`\begin{bmatrix}\cos\omega & -\sin\omega\\ \sin\omega & \cos\omega\end{bmatrix}`, x: 0.75, y: 0.5, size: 4.6 },
  },
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.13);
    const tall = s.tall;
    // X = E + P
    s.alpha(s.win('add', 'waves'), () => {
      const y = ay + ah * 0.45;
      const parts: [string, K][] = [['X', 'orange'], ['=', '--ink-3'], ['E[ids]', 'orange'], ['+', '--ink-3'], ['P', 'red']];
      const ws = parts.map(([t]) => s.measure(t, { font: 'mono', size: 6, weight: 600 }) + u * 4);
      let x = w / 2 - ws.reduce((a, b) => a + b, 0) / 2;
      parts.forEach(([t, k], i) => {
        s.text(t, x + ws[i]! / 2, y, { font: 'mono', size: 6, weight: 600, color: s.c(k) });
        x += ws[i]!;
      });
      s.text('P depends only on the position', w / 2, y + u * 11, { font: 'ui', size: 3.6, color: s.c('--ink-2') });
    });
    // Waves for four column pairs, and the clock hands they make.
    const wvA = s.win('waves', 'grid');
    if (wvA > 0) {
      const wr: [number, number, number, number] = tall ? [ax, ay + u * 2, aw, ah * 0.58] : [ax, ay + u * 2, aw * 0.64, ah * 0.9];
      const [wx, wy, ww, wh] = wr;
      const N = 24;
      const rowH = wh / 4;
      let pos = 0;
      if (s.since('clock') >= 0) pos = Math.min(N - 1, s.prog('clock') * (N - 1));
      const lit = (k: number) => (s.since('fast') >= 0 && s.since('slow') < 0 ? +(k === 0) : s.since('slow') >= 0 && s.since('clock') < 0 ? +(k === 3) : 0.5);
      s.alpha(wvA, () => {
        W16.forEach((om, k) => {
          const cy = wy + rowH * (k + 0.5);
          const amp = rowH * 0.34;
          const X = (p: number) => wx + u * 14 + (p / (N - 1)) * (ww - u * 16);
          const on = lit(k);
          const c = s.ctx;
          c.beginPath();
          for (let i = 0; i <= 200; i++) {
            const p = (i / 200) * (N - 1);
            const yy = cy - amp * Math.sin(om * p);
            if (i) c.lineTo(X(p), yy);
            else c.moveTo(X(p), yy);
          }
          c.strokeStyle = s.tint(WAVE_K[k]!, 0.3 + 0.7 * on);
          c.lineWidth = u * (0.25 + 0.3 * on);
          c.stroke();
          for (let p = 0; p < N; p++) s.circle(X(p), cy - amp * Math.sin(om * p), u * 0.55, { fill: s.tint(WAVE_K[k]!, 0.4 + 0.6 * on) });
          s.text(`pair ${k + 1}`, wx, cy, { font: 'mono', size: 2.8, align: 'left', color: s.c(WAVE_K[k]!) });
          if (s.since('clock') >= 0) {
            s.line(X(pos), wy, X(pos), wy + wh, s.tint('--ink-3', 0.5), 0.2);
            s.circle(X(pos), cy - amp * Math.sin(om * pos), u * 1.1, { fill: s.c(WAVE_K[k]!) });
          }
        });
        s.alpha(s.win('fast', 'slow'), () => s.text('fast: tells neighbors apart', wx + ww / 2, wy - u * 1, { font: 'ui', size: 3.3, weight: 600, color: s.c('red') }));
        s.alpha(s.win('slow', 'clock'), () => s.text('slow: tells start from middle', wx + ww / 2, wy - u * 1, { font: 'ui', size: 3.3, weight: 600, color: s.c('green') }));
        // Clock faces, one per pair.
        const cA = s.ease('clock', 0.6);
        s.alpha(cA, () => {
          const cr: [number, number, number, number] = tall ? [ax, ay + ah * 0.66, aw, ah * 0.3] : [ax + aw * 0.68, ay + u * 2, aw * 0.32, ah * 0.9];
          const [cx0, cy0, cw0, ch0] = cr;
          const r = tall ? Math.min(ch0 * 0.36, cw0 / 10) : Math.min(cw0 * 0.3, ch0 / 10);
          W16.forEach((om, k) => {
            const cx = tall ? cx0 + cw0 * ((k + 0.5) / 4) : cx0 + cw0 / 2;
            const cy = tall ? cy0 + ch0 * 0.45 : cy0 + ch0 * ((k + 0.5) / 4);
            s.circle(cx, cy, r, { fill: s.tint(WAVE_K[k]!, 0.08), stroke: s.tint(WAVE_K[k]!, 0.7), lw: 0.3 });
            const ang = om * pos;
            s.arrow(cx, cy, cx + Math.sin(ang) * r * 0.85, cy - Math.cos(ang) * r * 0.85, s.c(WAVE_K[k]!), 0.45, 1.6);
          });
          s.text(`position ${Math.round(pos)}`, tall ? w / 2 : cx0 + cw0 / 2, tall ? cy0 + ch0 * 0.98 : cy0 + ch0 + u * 1, { font: 'mono', size: 3.2, weight: 600, color: s.c('--ink-2') });
        });
      });
    }
    // The full 64 x 64 encoding.
    const gA = s.win('grid', 'rotate');
    if (gA > 0) {
      const side = Math.min(aw * 0.8, ah * 0.86);
      const gx = w / 2 - side / 2;
      const gy = ay + u * 4;
      s.alpha(gA, () => {
        s.ctx.imageSmoothingEnabled = false;
        s.ctx.drawImage(posImage(s), gx, gy, side, side);
        s.text('position ↓', gx - u * 1.5, gy + u * 2, { font: 'ui', size: 2.9, align: 'right', color: s.c('--ink-3') });
        s.text('column →', gx + side, gy - u * 2, { font: 'ui', size: 2.9, align: 'right', color: s.c('--ink-3') });
      });
    }
    // One pair as a point on a circle, rotating by a fixed angle per step.
    const rA = s.win('rotate', 'headlink');
    if (rA > 0) {
      const om = 0.7;
      const r = Math.min(ah * 0.32, aw * 0.22);
      const cx = tall ? ax + aw * 0.32 : ax + aw * 0.3;
      const cy = ay + ah * 0.48;
      const n = 1 + Math.min(7, Math.floor(s.prog('rotate') * 9));
      s.alpha(rA, () => {
        s.circle(cx, cy, r, { stroke: s.tint('red', 0.5), lw: 0.3 });
        s.line(cx - r * 1.1, cy, cx + r * 1.1, cy, s.c('--axis'), 0.2);
        s.line(cx, cy - r * 1.1, cx, cy + r * 1.1, s.c('--axis'), 0.2);
        for (let p = 0; p < n; p++) {
          const x = cx + Math.cos(p * om) * r;
          const y = cy - Math.sin(p * om) * r;
          if (p) {
            const xa = cx + Math.cos((p - 1) * om) * r;
            const ya = cy - Math.sin((p - 1) * om) * r;
            s.arrow(xa, ya, x, y, s.tint('red', 0.6), 0.3, 1.4);
          }
          s.circle(x, y, u * 1.4, { fill: s.c('red') });
          s.text(String(p), cx + Math.cos(p * om) * (r + u * 4.5), cy - Math.sin(p * om) * (r + u * 4.5), { font: 'mono', size: 3, color: s.c('--ink-2') });
        }
        s.text('(sin, cos) of one pair', cx, cy + r + u * 9, { font: 'ui', size: 3.2, color: s.c('--ink-2') });
      });
      s.show('rot', rA * s.ease('linear', 0.6), { x: tall ? 0.76 : 0.72, y: 0.48 });
      s.alpha(rA * s.ease('linear', 0.6), () =>
        s.text('p → p + 1: one fixed matrix', tall ? w * 0.76 : w * 0.72, ay + ah * 0.7, { font: 'ui', size: 3.2, weight: 600, color: s.c('red') }),
      );
    }
    // The previous-word head, built from that rotation.
    const hA = s.win('headlink', 'bump');
    if (hA > 0) {
      const lab = u * 8;
      const cs = Math.min(u * 8, (ah * 0.6) / 6, (aw - lab) / 7);
      const gx = w / 2 - (lab + 6 * cs) / 2 + lab;
      const gy = ay + u * 10;
      s.alpha(hA, () => {
        s.text('previous-word head', gx + 3 * cs, gy - u * 6.5, { font: 'ui', size: 3.3, weight: 650, color: s.c('teal') });
        rowLabels(s, WORDS, gx - u * 1.2, gy, cs, { size: 2.9 });
        colLabels(s, WORDS, gx, gy - u * 2.2, cs, { size: 2.8 });
        heat(s, gx, gy, cs, HEAD_A[0]!, { numbers: cs > u * 7 });
        s.text('Wq turns each pair back one step', gx + 3 * cs, gy + 6 * cs + u * 4.5, { font: 'mono', size: 3, weight: 600, color: s.c('blue') });
      });
    }
    // Similarity depends only on the offset.
    const bA = s.ease('bump', 0.6);
    if (bA > 0) {
      const pos = Math.round(lerp(12, 50, smooth(s.since('bump') / Math.max(1, s.end('bump') - s.at('bump')))));
      const sim = P64.map((r) => r.reduce((a, v, j) => a + v * P64[pos]![j]!, 0));
      const px = ax + u * 4;
      const pw = aw - u * 6;
      const py = ay + ah * 0.18;
      const ph = ah * 0.5;
      const X = (j: number) => px + (j / 63) * pw;
      const Y = (v: number) => py + ph - ((v - 8) / 26) * ph;
      s.alpha(bA * (1 - s.ease('today', 0.6)), () => {
        s.line(px, py + ph, px + pw, py + ph, s.c('--axis'), 0.2);
        const c = s.ctx;
        c.beginPath();
        sim.forEach((v, j) => (j ? c.lineTo(X(j), Y(v)) : c.moveTo(X(j), Y(v))));
        c.strokeStyle = s.c('teal');
        c.lineWidth = u * 0.5;
        c.stroke();
        s.circle(X(pos), Y(sim[pos]!), u * 1.2, { fill: s.c('teal') });
        s.text(`P[${pos}] · P[j]`, X(pos), Y(sim[pos]!) - u * 4, { font: 'mono', size: 3.2, weight: 600, color: s.c('teal'), halo: true });
        s.text('same bump, wherever it sits', w / 2, py + ph + u * 9, { font: 'ui', size: 3.4, weight: 600, color: s.c('--ink-2') });
      });
    }
    s.alpha(s.ease('today', 0.6), () => {
      const y = ay + ah * 0.42;
      pill(s, 'sinusoids (2017)', w / 2, y - u * 10, 'red', { size: 3.6, font: 'ui' });
      pill(s, 'learned positions (GPT, BERT)', w / 2, y, 'orange', { size: 3.6, font: 'ui' });
      pill(s, 'rotary, RoPE: chapter 6', w / 2, y + u * 10, 'purple', { size: 3.6, font: 'ui' });
    });
  },
};

export const scenesB: Record<string, SceneDef> = { heads, mask, order, positions };
