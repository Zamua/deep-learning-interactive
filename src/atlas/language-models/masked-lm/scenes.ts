import { Rng } from '../../../core/rand';
import type { Scene, SceneDef } from '../../../lecture/scene';
import { chip, note, rich, spread } from '../draw';

const TOK = ['the', 'cat', 'sat', 'on', 'a', 'mat'];
const K = 2;
/** 30 of 200 positions, picked at random as a masker would. */
const HID = new Set(new Rng(7).shuffle(Array.from({ length: 200 }, (_, i) => i)).slice(0, 30));

/** An arc above the row from token j to token K. */
function arc(s: Scene, xs: number[], y: number, j: number, k: string, a: number, dash?: number[]): void {
  s.alpha(a, () => {
    const c = s.ctx;
    const x0 = xs[j]!;
    const x1 = xs[K]!;
    const top = y - (5 + 2.2 * Math.abs(j - K)) * s.u;
    c.beginPath();
    c.moveTo(x0, y);
    c.quadraticCurveTo((x0 + x1) / 2, top, x1, y);
    c.strokeStyle = s.c(k as 'green');
    c.lineWidth = 0.45 * s.u;
    c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
    c.stroke();
    c.setLineDash([]);
  });
}

const hide: SceneDef = {
  draw(s) {
    const xs = spread(s, 6, s.tall ? 17 : 18);
    const y = s.h * 0.38;
    const m = s.ease('mask', 0.6, 1.4);
    const both = s.ease('both', 0.6);
    const cnt = s.ease('count', 0.6);
    s.alpha(1 - cnt, () => {
      TOK.forEach((t, i) => {
        if (i === K) {
          s.alpha(1 - m, () => chip(s, xs[i]!, y, t, 'gold', { w: 12, h: 7, size: 3.2, on: s.ease('causal', 0.6, 1) }));
          s.alpha(m, () => chip(s, xs[i]!, y, '[MASK]', 'slate', { w: 13, h: 7, size: 2.6, on: 1 }));
        } else {
          const after = i > K;
          const dim = after ? s.ease('causal', 0.6, 1.5) * (1 - m) : 0;
          s.alpha(1 - 0.65 * dim, () => chip(s, xs[i]!, y, t, 'orange', { w: 12, h: 7, size: 3.2 }));
        }
      });
      const top = y - 3.5 * s.u;
      [0, 1].forEach((j) => arc(s, xs, top, j, 'green', s.ease('causal', 0.5, 1 + 0.4 * j) * (1 - m) + both));
      [3, 4, 5].forEach((j) => {
        arc(s, xs, top, j, 'red', s.ease('causal', 0.5, 2) * (1 - m) * 0.8, [1.2, 1]);
        arc(s, xs, top, j, 'green', both * s.ease('both', 0.5, 0.8 + 0.4 * (j - 3)));
      });
      s.alpha(s.ease('causal', 0.6, 2) * (1 - m), () => {
        note(s, 'causal: only the tokens before it', s.w / 2, s.h * 0.78, 'gold', 3.2);
        note(s, 'the rest is hidden by the causal mask', s.w / 2, s.h * 0.86, 'red', 3);
      });
      s.alpha(s.ease('mask', 0.6, 2.4), () => {
        s.arrow(xs[K]!, y + 5 * s.u, xs[K]!, s.h * 0.6 - 4.5 * s.u, s.c('--ink-3'), 0.35, 1.8);
        chip(s, xs[K]!, s.h * 0.6, 'sat', 'gold', { w: 12, h: 7, size: 3.2, on: 1 });
        s.text('target', xs[K]! + 8 * s.u, s.h * 0.6, { size: 3, font: 'mono', align: 'left', color: s.c('gold') });
      });
      s.alpha(m * (1 - both), () => note(s, 'masked: about 15% of tokens hidden, then recovered', s.w / 2, s.h * 0.78, 'slate', 3.2));
      s.alpha(both, () => note(s, 'no causal mask: it reads both sides', s.w / 2, s.h * 0.78, 'green', 3.2));
    });
    s.alpha(cnt, () => {
      const c = s.tall ? 3.8 : 3.6;
      const cols = 20;
      const x0 = s.w / 2 - (cols / 2) * c * s.u;
      const y0 = s.h * 0.2;
      for (let i = 0; i < 200; i++) {
        const on = HID.has(i);
        s.rrect(x0 + (i % cols) * c * s.u, y0 + Math.floor(i / cols) * c * s.u, c * 0.8 * s.u, c * 0.8 * s.u, 0.4, { fill: s.tint(on ? 'gold' : 'slate', on ? 0.9 : 0.25) });
      }
      rich(s, [['masked: ', '--ink-3'], ['30', 'gold'], [' of 200 scored', '--ink-2']], s.w / 2, y0 + 10 * c * s.u + 6 * s.u, { size: 3.4, weight: 600 });
      note(s, 'causal: all 200 scored', s.w / 2, y0 + 10 * c * s.u + 13 * s.u, '--ink-3', 3.2);
    });
  },
};

/** A 6 by 6 attention pattern: which positions (columns) each position (row) can see. */
function pattern(s: Scene, cx: number, cy: number, causal: boolean, a: number, label: string): void {
  s.alpha(a, () => {
    const c = (s.tall ? 5.6 : 6) * s.u;
    const x0 = cx - 3 * c;
    const y0 = cy - 3 * c;
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const ok = !causal || j <= i;
        const row = i === K;
        s.rrect(x0 + j * c + 0.4 * s.u, y0 + i * c + 0.4 * s.u, c - 0.8 * s.u, c - 0.8 * s.u, 0.6, { fill: s.tint(ok ? (row ? 'gold' : 'green') : 'slate', ok ? (row ? 0.85 : 0.35) : 0.1) });
      }
    }
    s.text(label, cx, y0 - 4 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('--ink-2') });
    s.text(`row 2: ${causal ? 3 : 6}`, cx, y0 + 6 * c + 4.4 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('gold') });
  });
}

const jobs: SceneDef = {
  draw(s) {
    const dx = s.tall ? 24 : 30;
    const cy = s.h * 0.36;
    pattern(s, s.w / 2 - dx * s.u, cy, true, 1, 'causal');
    pattern(s, s.w / 2 + dx * s.u, cy, false, s.ease('attend', 0.6, 3), 'masked');
    s.alpha(s.ease('generate', 0.6), () => rich(s, [['write left to right', '--ink-2'], ['  →  ', '--ink-3'], ['causal (GPT)', 'gold']], s.w / 2, s.h * 0.78, { size: 3.4, weight: 600 }));
    s.alpha(s.ease('fill', 0.6), () => rich(s, [['fill a blank from both sides', '--ink-2'], ['  →  ', '--ink-3'], ['masked (BERT)', 'green']], s.w / 2, s.h * 0.87, { size: 3.4, weight: 600 }));
  },
};

export const scenes: Record<string, SceneDef> = { hide, jobs };
