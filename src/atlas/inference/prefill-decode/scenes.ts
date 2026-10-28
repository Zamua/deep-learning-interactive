import type { Scene, SceneDef } from '../../../lecture/scene';
import { columns } from '../../draw';
import { hbar, pass, word, type Ink } from '../draw';

const PROMPT = ['The', 'cat', 'sat', 'on', 'the'];
const NEW = ['mat', 'and', 'it', 'slept'];
const TOK = { size: 3.2, h: 7 };

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A small caption. */
function note(s: Scene, text: string, x: number, y: number, k: Ink = '--ink-2', size = 3, align: CanvasTextAlign = 'center', weight = 500) {
  s.text(text, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });
}

/** A horizontal brace from x0 to x1 at y, opening downward when `down`. */
function brace(s: Scene, x0: number, x1: number, y: number, k: Ink, down = false) {
  const d = (down ? -1 : 1) * 1.2 * s.u;
  s.line(x0, y + d, x0, y, s.c(k), 0.3);
  s.line(x0, y, x1, y, s.c(k), 0.3);
  s.line(x1, y, x1, y + d, s.c(k), 0.3);
}

const CHIP_GAP = 1.6;

/** Widths of word chips, as `word` draws them. */
const chipWidths = (s: Scene, words: string[], size: number) => words.map((t) => Math.max(8, 3 + (s.measure(t, { size, font: 'mono' }) / s.u) * 1.05) * s.u);
const rowWidth = (s: Scene, words: string[], size: number) => chipWidths(s, words, size).reduce((a, b) => a + b, 0) + CHIP_GAP * s.u * (words.length - 1);

/** Word chips laid left to right from x0; returns their centers. */
function chipRow(s: Scene, words: string[], x0: number, size: number): number[] {
  const gap = CHIP_GAP * s.u;
  let x = x0;
  return chipWidths(s, words, size).map((w) => {
    const c = x + w / 2;
    x += w + gap;
    return c;
  });
}

// ---- the felt timeline: a pause while the prompt is read, then the answer streaming in

const ANSWER = ['mat', 'and', 'it', 'slept', 'on', 'the', 'rug'];
const PRE = 16;
const DEC = 10;
const GAP = 1.2;
const SPAN = PRE + (ANSWER.length - 1) * (DEC + GAP);

const feel: SceneDef = {
  draw(s) {
    const u = s.u;
    const size = 3;
    const py = s.h * 0.15;
    const ay = s.h * 0.29;
    const W = Math.min((s.tall ? 84 : 120) * u, s.w - 18 * u);
    const tx0 = s.w / 2 - W / 2;
    const ty = s.h * 0.58;
    const bh = 7 * u;
    const X = (t: number) => tx0 + (t / SPAN) * W;
    // The clock sweeps across the first beat, then stays at the end.
    const now = Math.min(1, s.prog('feel') / 0.85) * (SPAN + 2);
    const ends = ANSWER.map((_, i) => (i === 0 ? PRE : PRE + i * (DEC + GAP)));
    const starts = ANSWER.map((_, i) => (i === 0 ? 0 : PRE + (i - 1) * (DEC + GAP) + GAP));

    // Both rows start at one left edge, so the answer reads as the prompt's continuation.
    const left = s.w / 2 - Math.max(rowWidth(s, PROMPT, size), rowWidth(s, ANSWER, size)) / 2 + 5 * u;
    const pxs = chipRow(s, PROMPT, left, size);
    PROMPT.forEach((t, i) => word(s, pxs[i]!, py, t, 'orange', { size }));
    note(s, 'prompt', pxs[0]! - 6 * u, py, 'orange', 2.8, 'right');
    const axs = chipRow(s, ANSWER, left, size);
    ANSWER.forEach((t, i) => s.alpha(Math.min(1, Math.max(0, (now - ends[i]!) / 1.5)), () => word(s, axs[i]!, ay, t, 'gold', { size, on: i === 0 ? 1 : 0 })));
    s.alpha(now > 0.5 && now < PRE ? 0.5 + 0.5 * Math.sin(s.t * 6) : 0, () => s.text('…', axs[0]!, ay, { size: 4, font: 'mono', color: s.c('--ink-3') }));
    note(s, 'answer', axs[0]! - 6 * u, ay, 'gold', 2.8, 'right');

    // The timeline: one wide block for the prompt, then one narrow block per new token.
    s.arrow(tx0, ty + bh / 2 + 1.6 * u, tx0 + W + 3 * u, ty + bh / 2 + 1.6 * u, s.c('--axis'), 0.3, 1.6);
    note(s, 'time', tx0 + W + 3 * u, ty + bh / 2 + 4.6 * u, '--ink-3', 2.7, 'right');
    ANSWER.forEach((_, i) => {
      const a = starts[i]!;
      const b = Math.min(ends[i]!, now);
      if (b <= a) return;
      const k: Ink = i === 0 ? 'orange' : 'gold';
      s.rrect(X(a), ty - bh / 2, X(b) - X(a), bh, 0.8, { fill: s.tint(k, 0.35), stroke: s.tint(k, 0.8), lw: 0.3 });
    });
    if (now < SPAN) s.line(X(now), ty - bh / 2 - 2 * u, X(now), ty + bh / 2 + 1.6 * u, s.c('--ink-2'), 0.3);

    // What the two parts are: first in plain words, then by name.
    const lab = (a: number, top: string, sub: string, x: number, y: number, k: Ink, sub2Y: number) =>
      s.alpha(a, () => {
        note(s, top, x, y, k, 3.1, 'left', 650);
        note(s, sub, x, sub2Y, '--ink-2', 2.8, 'left');
      });
    const plain = s.win('two', 'names');
    const named = s.ease('names', 0.6);
    const yA = ty - bh / 2 - 9 * u;
    const yB = ty + bh / 2 + 9 * u;
    lab(plain * s.ease('two', 0.6, 0.4), 'the pause', 'reading the prompt', X(0), yA, 'orange', yA + 4.4 * u);
    lab(plain * s.ease('two', 0.6, 2.6), 'the stream', 'one pass per new token', X(starts[1]!), yB, 'gold', yB + 4.4 * u);
    lab(named * s.ease('names', 0.6, 1.2), 'prefill', 'fills the KV cache', X(0), yA, 'orange', yA + 4.4 * u);
    lab(named * s.ease('names', 0.6, 4), 'decode', 'writes one token per pass', X(starts[1]!), yB, 'gold', yB + 4.4 * u);
    cite(s, 'Pope et al., 2022 · Google', s.ease('pope', 0.6));
  },
};

/** The KV cache as a row of small cells, `n` of them lit, centered on y. */
function cacheRow(s: Scene, y: number, n: number, total: number, a = 1): void {
  const cw = 4.2;
  const xs = columns(s, total, cw + 1.2);
  s.alpha(a, () => {
    for (let i = 0; i < total; i++) {
      const on = Math.min(1, Math.max(0, n - i));
      if (on > 0) s.alpha(on, () => s.cell(xs[i]! - (cw / 2) * s.u, y - 2.4 * s.u, cw * s.u, 4.8 * s.u, '', 'gold', { on: 0.6 }));
    }
    const shown = Math.min(total, Math.floor(n + 0.001));
    s.text(`KV cache: ${shown} token${shown === 1 ? '' : 's'}`, s.w / 2, y + 6 * s.u, { size: 2.9, font: 'mono', color: s.c('gold') });
  });
}

const prefill: SceneDef = {
  draw(s) {
    const xs = columns(s, 5, s.tall ? 16 : 17);
    const yIn = s.h * 0.72;
    const yBox = s.h * 0.45;
    const bh = s.h * 0.24;
    const yOut = s.h * 0.15;
    PROMPT.forEach((t, i) => s.alpha(s.ease('prompt', 0.4, 0.3 + 0.25 * i), () => word(s, xs[i]!, yIn, t, 'orange', TOK)));
    const go = s.ease('prefill', 0.8);
    s.alpha(go, () => {
      const l = xs[0]! - 8 * s.u;
      const r = xs[4]! + 8 * s.u;
      pass(s, (l + r) / 2, yBox, 'blue', { w: (r - l) / s.u, h: bh / s.u, on: s.win('prefill', 'first') });
      xs.forEach((x) => s.arrow(x, yIn - 3.6 * s.u, x, yBox + bh / 2 + 0.8 * s.u, s.c('--ink-3'), 0.35, 1.8));
      s.text('one pass, all five at once', s.w / 2 - 6 * s.u, yBox - bh / 2 - 4 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c('blue') });
    });
    cacheRow(s, s.h * 0.86, 5 * s.ease('prefill', 1.2, 1.5), 5, s.ease('prefill', 0.5, 1.2));
    s.alpha(s.ease('first', 0.6, 0.6), () => {
      const x = xs[4]!;
      s.arrow(x, yBox - bh / 2 - 0.8 * s.u, x, yOut + 3.6 * s.u, s.c('--ink-3'), 0.35, 1.8);
      word(s, x, yOut, 'mat', 'gold', { ...TOK, on: 1 });
      s.text('first new token', x - 8 * s.u, yOut, { size: 2.9, font: 'mono', align: 'right', color: s.c('gold') });
    });
  },
};

// ---- decode: one pass per token, then a hundred tokens on a timeline drawn to scale

const PRE_MS = 40;
const DEC_MS = 25;
const N_DEC = 99;
const TOTAL_MS = PRE_MS + N_DEC * DEC_MS;

const decode: SceneDef = {
  draw(s) {
    const u = s.u;
    const px = s.w / 2 - 30 * u;
    const dx = [-6, 14, 34].map((d) => s.w / 2 + d * u);
    const yIn = s.h * 0.66;
    const yBox = s.h * 0.42;
    const bh = s.h * 0.22;
    const yOut = s.h * 0.17;
    const step = (i: number) => (i === 0 ? s.ease('one', 0.6, 0.8) : s.ease('cache', 0.6, 1.4 + 1.6 * (i - 1)));
    const away = 1 - s.ease('hundred', 0.7);
    // The prefill, already done, then three decode passes, each fed the token before it.
    s.alpha(away, () => {
      word(s, px, yIn, 'prompt: 5', 'orange', TOK);
      s.arrow(px, yIn - 3.6 * u, px, yBox + bh / 2 + 0.8 * u, s.c('--ink-3'), 0.35, 1.8);
      pass(s, px, yBox, 'blue', { w: 16, h: bh / u });
      s.text('prefill', px, yIn + 6.5 * u, { size: 2.9, font: 'mono', weight: 650, color: s.c('blue') });
      s.arrow(px, yBox - bh / 2 - 0.8 * u, px, yOut + 3.6 * u, s.c('--ink-3'), 0.35, 1.8);
      word(s, px, yOut, NEW[0]!, 'gold', TOK);
      dx.forEach((x, i) => {
        s.alpha(step(i), () => {
          const prevX = i === 0 ? px : dx[i - 1]!;
          s.line(prevX + 5 * u, yOut + 2.5 * u, x - 4.5 * u, yIn - 2.5 * u, s.tint('gold', 0.8), 0.35, [1.2, 1]);
          word(s, x, yIn, NEW[i]!, 'gold', TOK);
          s.arrow(x, yIn - 3.6 * u, x, yBox + bh / 2 + 0.8 * u, s.c('--ink-3'), 0.35, 1.8);
          pass(s, x, yBox, 'blue', { w: 11, h: bh / u, on: s.win('cache', 'count') * (i === 0 ? 1 : 0) });
          s.arrow(x, yBox - bh / 2 - 0.8 * u, x, yOut + 3.6 * u, s.c('--ink-3'), 0.35, 1.8);
          word(s, x, yOut, NEW[i + 1]!, 'gold', TOK);
        });
      });
      s.alpha(step(0), () => s.text('decode: one token per pass', dx[1]!, yIn + 6.5 * u, { size: 2.9, font: 'mono', weight: 650, color: s.c('blue') }));
      const fed = 5 + step(0) + step(1) + step(2);
      cacheRow(s, s.h * 0.84, fed, 8, 1 - s.ease('count', 0.5));
      s.alpha(s.ease('count', 0.6), () => note(s, '4 new tokens = 1 prefill + 3 decode passes', s.w / 2, s.h * 0.86, '--ink-2', 3.1, 'center', 650));
    });

    // A hundred new tokens, to scale: the prefill is a sliver, the decode passes a long train.
    const W = Math.min((s.tall ? 84 : 120) * u, s.w - 18 * u);
    const x0 = s.w / 2 - W / 2;
    const X = (ms: number) => x0 + (ms / TOTAL_MS) * W;
    const ty = s.h * 0.44;
    const th = 7 * u;
    const show = s.ease('hundred', 0.7, 0.3);
    s.alpha(show, () => {
      s.rrect(X(0), ty - th / 2, X(PRE_MS) - X(0), th, 0.3, { fill: s.tint('orange', 0.7) });
      for (let i = 0; i < N_DEC; i++) {
        const a = X(PRE_MS + i * DEC_MS);
        const b = X(PRE_MS + (i + 1) * DEC_MS);
        s.rrect(a + 0.08 * u, ty - th / 2, b - a - 0.16 * u, th, 0.2, { fill: s.tint('gold', i % 2 ? 0.45 : 0.65) });
      }
      s.line(X(PRE_MS) / 2 + X(0) / 2, ty - th / 2 - 0.6 * u, X(0) + 2 * u, ty - th / 2 - 6 * u, s.c('orange'), 0.3);
      note(s, s.ease('time', 0.6, 2.4) > 0.5 ? 'prefill: 40 ms' : '1 prefill', X(0) + 2.6 * u, ty - th / 2 - 7.5 * u, 'orange', 3, 'left', 650);
      brace(s, X(PRE_MS), X(TOTAL_MS), ty + th / 2 + 2 * u, 'gold', true);
      note(s, s.ease('time', 0.6, 4.5) > 0.5 ? '99 decode passes, 25 ms each' : '99 decode passes', (X(PRE_MS) + X(TOTAL_MS)) / 2, ty + th / 2 + 5.6 * u, 'gold', 3, 'center', 650);
    });
    const ey = s.h * 0.66;
    const eq = (txt: string, y: number, k: Ink, a: number) => s.alpha(a, () => note(s, txt, s.w / 2, y, k, s.tall ? 3.4 : 3.6, 'center', 650));
    eq('99 × 25 = 2,475 ms', ey, 'gold', s.ease('dtime', 0.6, 1.5));
    eq('40 + 2,475 = 2,515 ms', ey + 8 * u, '--ink-2', s.ease('total', 0.6, 1));
    eq('2,515 ms = 2.515 s', ey + 16 * u, 'blue', s.ease('secs', 0.6, 1.5));
    s.alpha(s.ease('total', 0.6, 1), () => brace(s, X(0), X(TOTAL_MS), ty + th / 2 + 9.5 * u, '--ink-2', true));
  },
};

// ---- memory: a decode pass reads every weight once, and the reading is what takes the time

/** The GPU as a chip: its memory holding the weights, its arithmetic units, and the path between. */
function chip(s: Scene, cy: number, flow: number, hot: number) {
  const u = s.u;
  const W = (s.tall ? 76 : 90) * u;
  const H = 18 * u;
  const x0 = s.w / 2 - W / 2;
  s.rrect(x0, cy - H / 2, W, H, 2, { fill: s.tint('--ink-3', 0.05), stroke: s.tint('--ink-2', 0.6), lw: 0.35 });
  s.text('GPU', x0 + 1 * u, cy - H / 2 - 2.8 * u, { size: 3, font: 'mono', weight: 700, align: 'left', color: s.c('--ink-2') });
  const bw = W * 0.34;
  const mx = x0 + 4 * u;
  const ax = x0 + W - 4 * u - bw;
  const by = cy - 5 * u;
  s.rrect(mx, by, bw, 11 * u, 1.2, { fill: s.tint('blue', 0.14 + 0.2 * hot), stroke: s.tint('blue', 0.6 + 0.4 * hot), lw: 0.3 + 0.2 * hot });
  s.text('memory', mx + bw / 2, by + 3.4 * u, { size: 2.8, font: 'mono', weight: 650, color: s.c('blue') });
  s.text('the weights', mx + bw / 2, by + 7.6 * u, { size: 2.6, font: 'mono', color: s.c('blue') });
  s.rrect(ax, by, bw, 11 * u, 1.2, { fill: s.tint('purple', 0.14), stroke: s.tint('purple', 0.6), lw: 0.3 });
  s.text('arithmetic', ax + bw / 2, by + 5.5 * u, { size: 2.8, font: 'mono', weight: 650, color: s.c('purple') });
  const ya = by + 5.5 * u;
  s.arrow(mx + bw + 1 * u, ya, ax - 1 * u, ya, s.c('--ink-3'), 0.35, 1.6);
  // Weights in transit while a pass runs.
  s.alpha(flow, () => {
    for (let i = 0; i < 4; i++) {
      const f = (s.t * 0.6 + i / 4) % 1;
      const x = mx + bw + 1.5 * u + f * (ax - mx - bw - 4 * u);
      s.rrect(x - 0.9 * u, ya - 0.9 * u, 1.8 * u, 1.8 * u, 0.3, { fill: s.tint('blue', 0.8) });
    }
  });
}

const memory: SceneDef = {
  draw(s) {
    const u = s.u;
    const hot = s.win('bound', 'pre');
    chip(s, s.h * 0.17, s.ease('read', 0.6) * (1 - s.ease('bytes', 0.6)) + hot, hot);
    const head = s.tall ? 3.2 : 3.4;
    s.alpha(s.ease('bytes', 0.6), () => note(s, '8 billion weights × 2 bytes', s.w / 2, s.h * 0.33, 'blue', head, 'center', 650));
    s.alpha(s.ease('bytes', 0.6, 4), () => note(s, s.ease('gb', 0.6, 0.6) > 0.5 ? '= 16 billion bytes = 16 GB' : '= 16 billion bytes', s.w / 2, s.h * 0.39, 'blue', head, 'center', 650));

    // Two bars on one scale: 8 ms across, so the prefill's arithmetic fits at the end.
    const x0 = s.w / 2 - (s.tall ? 42 : 46) * u;
    const full = (s.tall ? 70 : 76) * u;
    const ms = (v: number) => (v / 8) * full;
    s.alpha(s.ease('bw', 0.6), () => {
      note(s, 'read 16 GB at 3,200 GB/s', x0, s.h * 0.47, '--ink-2', 2.9, 'left');
      hbar(s, x0, s.h * 0.53, ms(5) * s.ease('bw', 1.2, 3), 'gold', '5 ms');
    });
    s.alpha(s.ease('rate', 0.6), () => note(s, '1 pass per 5 ms: 200 tokens/s', s.w / 2, s.h * 0.795, 'gold', s.tall ? 3.2 : 3.4, 'center', 650));
    s.alpha(s.ease('rate', 0.6, 3.5) * (1 - s.ease('pre', 0.5)), () => note(s, 'tokens/s = 3,200 ÷ 16 = 200', s.w / 2, s.h * 0.86, '--ink-2', 3));
    const pre = s.ease('pre', 1.6, 2.5);
    const opsLab = pre > 0.5 ? 'prefill: 500 × 16 billion ops' : s.ease('math', 0.6) > 0.5 ? '16 billion ops at 1,000 trillion/s' : '16 billion operations';
    s.alpha(s.ease('ops', 0.6), () => note(s, opsLab, x0, s.h * 0.62, pre > 0.5 ? 'orange' : '--ink-2', 2.9, 'left'));
    s.alpha(s.ease('math', 0.6, 1), () => hbar(s, x0, s.h * 0.68, ms(0.016 + (8 - 0.016) * pre), 'purple', pre > 0.5 ? '8 ms' : '0.016 ms'));
    s.alpha(hot, () => note(s, 'waiting on memory', x0 + ms(5) + 12 * u, s.h * 0.53, 'gold', 2.9, 'left', 650));
    cite(s, 'Pope et al., 2022', s.win('bound', 'pre'));
    s.alpha(s.ease('pre', 0.6), () => {
      note(s, 'prefill, 500 tokens: one read, 5 ms', s.w / 2, s.h * 0.88, 'orange', 3);
      note(s, 'arithmetic: 500 × 0.016 = 8 ms', s.w / 2, s.h * 0.94, 'orange', 3);
    });
  },
};

export const scenes: Record<string, SceneDef> = { feel, prefill, decode, memory };
