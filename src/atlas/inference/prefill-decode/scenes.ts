import type { Scene, SceneDef } from '../../../lecture/scene';
import { columns } from '../../draw';
import { hbar, pass, word } from '../draw';

const PROMPT = ['The', 'cat', 'sat', 'on', 'the'];
const NEW = ['mat', 'and', 'it', 'slept'];
const TOK = { size: 3.2, h: 7 };

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

const decode: SceneDef = {
  draw(s) {
    const px = s.w / 2 - 30 * s.u;
    const dx = [-6, 14, 34].map((d) => s.w / 2 + d * s.u);
    const yIn = s.h * 0.66;
    const yBox = s.h * 0.42;
    const bh = s.h * 0.22;
    const yOut = s.h * 0.17;
    const step = (i: number) => (i === 0 ? s.ease('one', 0.6, 0.8) : s.ease('cache', 0.6, 1.4 + 1.6 * (i - 1)));
    // The prefill, already done.
    word(s, px, yIn, 'prompt: 5', 'orange', TOK);
    s.arrow(px, yIn - 3.6 * s.u, px, yBox + bh / 2 + 0.8 * s.u, s.c('--ink-3'), 0.35, 1.8);
    pass(s, px, yBox, 'blue', { w: 16, h: bh / s.u });
    s.text('prefill', px, yIn + 6.5 * s.u, { size: 2.9, font: 'mono', weight: 650, color: s.c('blue') });
    s.arrow(px, yBox - bh / 2 - 0.8 * s.u, px, yOut + 3.6 * s.u, s.c('--ink-3'), 0.35, 1.8);
    word(s, px, yOut, NEW[0]!, 'gold', TOK);
    dx.forEach((x, i) => {
      s.alpha(step(i), () => {
        const prevX = i === 0 ? px : dx[i - 1]!;
        s.line(prevX + 5 * s.u, yOut + 2.5 * s.u, x - 4.5 * s.u, yIn - 2.5 * s.u, s.tint('gold', 0.8), 0.35, [1.2, 1]);
        word(s, x, yIn, NEW[i]!, 'gold', TOK);
        s.arrow(x, yIn - 3.6 * s.u, x, yBox + bh / 2 + 0.8 * s.u, s.c('--ink-3'), 0.35, 1.8);
        pass(s, x, yBox, 'blue', { w: 11, h: bh / s.u, on: s.win('cache', 'count') * (i === 0 ? 1 : 0) });
        s.arrow(x, yBox - bh / 2 - 0.8 * s.u, x, yOut + 3.6 * s.u, s.c('--ink-3'), 0.35, 1.8);
        word(s, x, yOut, NEW[i + 1]!, 'gold', TOK);
      });
    });
    s.alpha(step(0), () => s.text(`decode: one token per pass`, dx[1]!, yIn + 6.5 * s.u, { size: 2.9, font: 'mono', weight: 650, color: s.c('blue') }));
    const fed = 5 + step(0) + step(1) + step(2);
    cacheRow(s, s.h * 0.84, fed, 8, 1 - s.ease('wait', 0.5));
    s.alpha(s.ease('count', 0.6), () => s.text('4 new tokens = 1 prefill + 3 decode passes', s.w / 2, s.h * 0.05, { size: 3.1, font: 'mono', weight: 650, color: s.c('--ink-2') }));
    s.alpha(s.ease('wait', 0.6, 0.3), () => {
      s.text('wait for token 1', px, s.h * 0.84, { size: 2.9, font: 'mono', weight: 650, color: s.c('orange') });
      s.text('then how fast the rest come', dx[1]!, s.h * 0.84, { size: 2.9, font: 'mono', weight: 650, color: s.c('gold') });
    });
  },
};

const memory: SceneDef = {
  draw(s) {
    const x0 = s.w / 2 - (s.tall ? 40 : 44) * s.u;
    const full = (s.tall ? 62 : 68) * s.u;
    s.alpha(s.ease('bytes', 0.6), () => s.text('8 billion weights × 2 bytes = 16 GB', s.w / 2, s.h * 0.1, { size: 3.4, font: 'mono', weight: 650, color: s.c('blue') }));
    const lab = (t: string, y: number) => s.text(t, x0, y, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
    s.alpha(s.ease('bw', 0.6), () => {
      lab('read 16 GB at 3,200 GB/s', s.h * 0.26);
      hbar(s, x0, s.h * 0.33, full * s.ease('bw', 1.2, 0.5), 'gold', '5 ms');
    });
    s.alpha(s.ease('math', 0.6), () => {
      lab('16 billion operations at 1,000 trillion/s', s.h * 0.45);
      hbar(s, x0, s.h * 0.52, (full * 0.016) / 5, 'purple', '0.016 ms');
    });
    s.alpha(s.ease('bound', 0.6), () => {
      s.text('tokens per second = memory speed ÷ bytes', s.w / 2, s.h * 0.66, { size: 3, font: 'mono', color: s.c('--ink-2') });
      s.text('3,200 ÷ 16 = 200', s.w / 2, s.h * 0.73, { size: 3.8, font: 'mono', weight: 650, color: s.c('gold') });
    });
    s.alpha(s.ease('pre', 0.6), () => {
      s.text('prefill of 500 tokens: one read, 5 ms', s.w / 2, s.h * 0.85, { size: 3, font: 'mono', color: s.c('orange') });
      s.text('used 500 times: math 500 × 0.016 = 8 ms', s.w / 2, s.h * 0.91, { size: 3, font: 'mono', color: s.c('orange') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { prefill, decode, memory };
