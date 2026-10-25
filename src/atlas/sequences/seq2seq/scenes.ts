import type { Scene, SceneDef } from '../../../lecture/scene';
import { box, chip } from '../draw';

const SRC = ['je', 'suis', 'étudiant'];
const OUT = ['I', 'am', 'a', 'student', '<end>'];
const IN = ['<start>', 'I', 'am', 'a', 'student'];

/** Decoder steps: five boxes across the stage. */
const decX = (s: Scene, shift = 4) => [-40, -20, 0, 20, 40].map((d) => s.w / 2 + (d + shift) * s.u);

/** A word chip wide enough for its word. */
const word = (s: Scene, x: number, y: number, t: string, k: 'orange' | 'gold' | 'red' | 'teal', on = 0) =>
  chip(s, x, y, t, k, { w: Math.max(8, 2.2 + t.length * 1.75), h: 6.5, size: 2.8, on });

const readwrite: SceneDef = {
  draw(s) {
    const ey = s.h * 0.15;
    const ex = [-30, -8, 14].map((d) => s.w / 2 + d * s.u);
    const hx = s.w / 2 + 34 * s.u;
    const r = 4.4 * s.u;
    const dx = decX(s);
    const dy = s.h * 0.64;
    const enc = (i: number) => s.ease('enc', 0.5, 0.4 + 0.8 * i);
    // The sentence pair, then the encoder reading it.
    s.alpha(1 - s.ease('enc', 0.5), () => {
      s.text('je suis étudiant', s.w / 2, s.h * 0.3, { size: 4.2, font: 'mono', weight: 600, color: s.c('orange') });
      s.text('↓', s.w / 2, s.h * 0.42, { size: 4.2, color: s.c('--ink-3') });
      s.text('I am a student', s.w / 2, s.h * 0.54, { size: 4.2, font: 'mono', weight: 600, color: s.c('gold') });
    });
    s.alpha(s.ease('enc', 0.5), () => {
      s.text('encoder', s.w / 2 - 8 * s.u, s.h * 0.05, { size: 3, font: 'mono', color: s.c('--ink-3') });
      SRC.forEach((t, i) =>
        s.alpha(enc(i), () => {
          word(s, ex[i]!, s.h * 0.29, t, 'orange');
          s.arrow(ex[i]!, s.h * 0.29 - 3.25 * s.u, ex[i]!, ey + 4 * s.u, s.c('--ink-3'), 0.3, 1.6);
          box(s, ex[i]!, ey, '', 'blue', { w: 10, h: 8 });
          const nx = i < 2 ? ex[i + 1]! - 5 * s.u : hx - r;
          s.arrow(ex[i]! + 5 * s.u, ey, nx, ey, s.c('--ink-3'), 0.35, 1.6);
        }),
      );
      s.alpha(enc(3), () => {
        s.circle(hx, ey, r, { fill: s.tint('gold', 0.25), stroke: s.c('gold'), lw: 0.45 });
        s.text('h', hx, ey + 0.2 * s.u, { size: 3.4, font: 'mono', weight: 700, color: s.c('gold') });
        s.text('one vector', hx, ey + r + 3.5 * s.u, { size: 2.8, font: 'mono', color: s.c('gold') });
      });
    });
    // The decoder, started from h.
    s.alpha(s.ease('dec', 0.5), () => {
      const gx = dx[0]! - 13 * s.u;
      const gy = s.h * 0.4;
      const k = s.tint('gold', 0.8);
      s.line(hx, ey + r + 6 * s.u, hx, gy, k, 0.45);
      s.line(hx, gy, gx, gy, k, 0.45);
      s.line(gx, gy, gx, dy, k, 0.45);
      s.arrow(gx, dy, dx[0]! - 5.5 * s.u, dy, k, 0.45, 1.8);
      s.text('decoder', s.w / 2, s.h * 0.92, { size: 3, font: 'mono', color: s.c('--ink-3') });
    });
    const step = (i: number) => (i === 0 ? s.ease('dec', 0.5, 0.8) : i < 4 ? s.ease('feed', 0.5, 0.3 + 1.1 * (i - 1)) : s.ease('end', 0.5, 0.3));
    for (let i = 0; i < 5; i++) {
      s.alpha(step(i), () => {
        word(s, dx[i]!, s.h * 0.8, IN[i]!, i === 0 ? 'teal' : 'gold');
        s.arrow(dx[i]!, s.h * 0.8 - 3.25 * s.u, dx[i]!, dy + 4 * s.u, s.c('--ink-3'), 0.3, 1.6);
        box(s, dx[i]!, dy, '', 'teal', { w: 11, h: 8 });
        if (i > 0) s.arrow(dx[i - 1]! + 5.5 * s.u, dy, dx[i]! - 5.5 * s.u, dy, s.c('--ink-3'), 0.35, 1.6);
        s.arrow(dx[i]!, dy - 4 * s.u, dx[i]!, s.h * 0.5 + 3.25 * s.u, s.c('--ink-3'), 0.3, 1.6);
        word(s, dx[i]!, s.h * 0.5, OUT[i]!, i === 4 ? 'teal' : 'gold', i === 4 ? s.ease('end', 0.6, 1) : 0);
      });
      if (i < 4) {
        s.alpha(step(i + 1) * 0.6 * (1 - s.ease('end', 0.6, 2)), () => s.line(dx[i]! + 3 * s.u, s.h * 0.5 + 3 * s.u, dx[i + 1]! - 3 * s.u, s.h * 0.8 - 3.5 * s.u, s.tint('gold', 0.8), 0.3, [1, 1]));
      }
    }
    s.alpha(s.ease('end', 0.6, 2.5), () => s.text('5 decoder steps', dx[4]! + 2 * s.u, s.h * 0.92, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('teal') }));
  },
};

const PRED = ['I', 'is', 'a', 'student', '<end>'];

const train: SceneDef = {
  draw(s) {
    const dx = decX(s, 0);
    const dy = s.h * 0.4;
    const ty = s.h * 0.2;
    const iy = s.h * 0.58;
    const test = s.ease('test', 0.8);
    const bn = s.ease('bottleneck', 0.6);
    s.alpha(1 - bn, () => {
      s.text('targets', dx[0]! - 8.5 * s.u, ty - 7.5 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
      for (let i = 0; i < 5; i++) {
        box(s, dx[i]!, dy, '', 'teal', { w: 11, h: 8 });
        if (i < 4) s.arrow(dx[i]! + 5.5 * s.u, dy, dx[i + 1]! - 5.5 * s.u, dy, s.c('--ink-3'), 0.35, 1.6);
        s.arrow(dx[i]!, dy - 4 * s.u, dx[i]!, ty + 3.25 * s.u, s.c('--ink-3'), 0.3, 1.6);
        word(s, dx[i]!, ty, OUT[i]!, 'gold');
        s.arrow(dx[i]!, iy - 3.25 * s.u, dx[i]!, dy + 4 * s.u, s.c('--ink-3'), 0.3, 1.6);
        // Inputs: the true previous word in training, the model's own guess at test time.
        s.alpha(1 - test, () => word(s, dx[i]!, iy, IN[i]!, i === 0 ? 'teal' : 'gold', i === 2 ? s.win('tf', 'loss') : 0));
        s.alpha(test, () => word(s, dx[i]!, iy, i === 0 ? IN[0]! : PRED[i - 1]!, i === 0 ? 'teal' : i === 2 ? 'red' : 'orange'));
      }
      // Step 1 guesses wrong; teacher forcing still feeds the true word.
      s.alpha(s.win('tf', 'loss'), () => {
        s.text('guess: is ✗', dx[1]!, s.h * 0.08, { size: 2.9, font: 'mono', weight: 650, color: s.c('red') });
        s.text('reads the true word', dx[2]!, iy + 7 * s.u, { size: 2.8, font: 'mono', color: s.c('gold') });
      });
      s.alpha(s.ease('loss', 0.6) * (1 - test), () => {
        for (let i = 0; i < 5; i++) s.text(String(i + 1), dx[i]!, s.h * 0.08, { size: 2.8, font: 'mono', weight: 650, color: s.c('red') });
        s.text('5 predictions, each scored', s.w / 2, s.h * 0.74, { size: 3.2, font: 'mono', color: s.c('red') });
      });
      s.alpha(test, () => s.text('test time: reads its own guesses', s.w / 2, s.h * 0.74, { size: 3.2, font: 'mono', color: s.c('orange') }));
    });
    // The bottleneck: any number of input states, one vector out.
    s.alpha(bn, () => {
      const vy = s.h * 0.45;
      const vx = s.w / 2 + 22 * s.u;
      const rows: [number, number][] = [
        [3, s.h * 0.22],
        [10, s.h * 0.68],
      ];
      rows.forEach(([n, y], r) =>
        s.alpha(r === 0 ? 1 : s.ease('bottleneck', 0.6, 2.5), () => {
          const w = n > 3 ? 4 : 4.4;
          for (let i = 0; i < n; i++) {
            const x = s.w / 2 - 44 * s.u + i * w * s.u * 1.2;
            s.rrect(x, y - 3 * s.u, w * s.u, 6 * s.u, 0.8, { fill: s.tint('blue', 0.3), stroke: s.tint('blue', 0.8), lw: 0.3 });
          }
          s.text(r === 0 ? '3 words' : 'or 50 words', s.w / 2 - 44 * s.u, y + 7 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
          s.arrow(s.w / 2 - 44 * s.u + n * w * s.u * 1.2 + 2 * s.u, y, vx - 6 * s.u, vy + (y < vy ? -2 : 2) * s.u, s.tint('gold', 0.8), 0.4, 1.8);
        }),
      );
      s.circle(vx, vy, 5 * s.u, { fill: s.tint('gold', 0.25), stroke: s.c('gold'), lw: 0.5 });
      s.text('h', vx, vy + 0.2 * s.u, { size: 3.6, font: 'mono', weight: 700, color: s.c('gold') });
      s.text('one vector,', vx + 7 * s.u, vy - 2.2 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('gold') });
      s.text('fixed size', vx + 7 * s.u, vy + 2.2 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('gold') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { readwrite, train };
