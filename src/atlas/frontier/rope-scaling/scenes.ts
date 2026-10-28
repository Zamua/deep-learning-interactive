import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { after } from '../../networks/draw';
import type { Ink } from '../../linear-algebra/draw';
import { sub } from '../../transformers/draw';

const RAD = Math.PI / 180;
const TRAIN = 1000;
const NEW = 4000;
const THETA = 0.1;
const SEEN = (TRAIN - 1) * THETA;

const txt = (s: Scene, t: string, x: number, y: number, k: Ink = '--ink-2', o: { size?: number; align?: CanvasTextAlign; weight?: number; font?: 'mono' | 'serif' } = {}) =>
  s.text(t, x, y, { size: o.size ?? 3.2, font: o.font ?? 'mono', weight: o.weight ?? 600, align: o.align ?? 'center', color: s.c(k), halo: true });

const commas = (n: number) => n.toLocaleString('en-US');

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A circle of angles: the range training made shaded, and an arrow at `angle` degrees. */
function dial(s: Scene, cx: number, cy: number, r: number, o: { seen: number; angle?: number; k?: Ink; label?: string; full?: boolean }): void {
  const c = s.ctx;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.strokeStyle = s.tint('--ink-3', 0.5);
  c.lineWidth = 0.3 * s.u;
  c.stroke();
  c.beginPath();
  c.moveTo(cx, cy);
  if (o.full) c.arc(cx, cy, r, 0, Math.PI * 2);
  else c.arc(cx, cy, r, 0, -Math.min(o.seen, 359.9) * RAD, true);
  c.closePath();
  c.fillStyle = s.tint('green', 0.22);
  c.fill();
  s.line(cx, cy, cx + r * 1.06, cy, s.tint('--ink-3', 0.6), 0.25);
  if (o.angle === undefined) return;
  const a = o.angle * RAD;
  const k = o.k ?? 'teal';
  s.arrow(cx, cy, cx + r * 0.92 * Math.cos(a), cy - r * 0.92 * Math.sin(a), s.c(k), 0.6, 2.4);
  if (o.label) {
    const lr = r + 4.5 * s.u;
    txt(s, o.label, cx + lr * Math.cos(a), cy - lr * Math.sin(a), k, { size: 3 });
  }
}

/** A number line from 0 to `max` between x0 and x1, with [0, shade) shaded and labeled ticks. */
function ruler(s: Scene, x0: number, x1: number, y: number, max: number, shade: number, ticks: number[], o: { a?: number } = {}): (v: number) => number {
  const X = (v: number) => x0 + ((x1 - x0) * v) / max;
  s.alpha(o.a ?? 1, () => {
    s.rrect(x0, y - 1.6 * s.u, X(shade) - x0, 3.2 * s.u, 0.6, { fill: s.tint('green', 0.3) });
    s.line(x0, y, x1, y, s.c('--ink-3'), 0.35);
    for (const t of ticks) {
      s.line(X(t), y - 1.4 * s.u, X(t), y + 1.4 * s.u, s.c('--ink-3'), 0.3);
      txt(s, commas(t), X(t), y + 4 * s.u, '--ink-3', { size: 2.7, weight: 500 });
    }
  });
  return X;
}

// ---- scene 1: a slow pair's angles in training, and past it

const seen: SceneDef = {
  draw(s) {
    const u = s.u;
    const x0 = s.w / 2 - (s.tall ? 42 : 56) * u;
    const x1 = s.w / 2 + (s.tall ? 42 : 56) * u;
    const yl = s.h * 0.13;
    const past = s.ease('past', 0.6);
    txt(s, 'positions', x1, yl - 5.5 * u, '--ink-3', { align: 'right', size: 2.8, weight: 500 });
    const X = ruler(s, x0, x1, yl, NEW, TRAIN, [0, 1000, 2000, 3000, 4000]);
    s.alpha(s.ease('problem', 0.6, 1.2), () => txt(s, 'trained: 0 to 999', X(TRAIN / 2), yl - 5.5 * u, 'green', { size: 2.8 }));
    // Past the trained length: positions the model never saw.
    s.alpha(s.ease('problem', 0.6, 4.5) * (1 - s.ease('slow', 0.6)), () => {
      s.rrect(X(TRAIN), yl - 1.6 * u, X(NEW) - X(TRAIN), 3.2 * u, 0.6, { fill: s.tint('red', 0.18) });
      txt(s, 'never seen in training', X(2500), s.h * 0.36, 'red', { size: 3.4 });
      txt(s, 'its predictions fall apart here', s.w / 2, s.h * 0.5, '--ink-2', { size: 3.2, weight: 500 });
    });
    // L_train marks the end of the trained range.
    s.alpha(s.ease('L', 0.6), () => {
      s.line(X(TRAIN), yl - 3 * u, X(TRAIN), yl + 2 * u, s.c('slate'), 0.45);
      const w = sub(s, 'L', 'train', X(TRAIN) + 1.2 * u, yl + 9.5 * u, { k: 'slate', align: 'left', size: 3.2 });
      txt(s, ' = 1,000', X(TRAIN) + 1.2 * u + w, yl + 9.5 * u, 'slate', { align: 'left', size: 3.2 });
    });
    // The pair's angle sweeps with the position: through training, then on to 3,000.
    const pos = lerp(0, TRAIN - 1, smooth(s.prog('slow') * 1.6 - 0.3)) + (3000 - (TRAIN - 1)) * s.ease('past', 1.6, 0.4);
    const ang = pos * THETA;
    s.alpha(s.ease('slow', 0.6), () => {
      s.circle(X(pos), yl, 1.2 * u, { fill: s.c(past > 0.5 ? 'red' : 'teal') });
    });
    const fast = s.ease('fast', 0.6);
    const cx = lerp(s.w / 2, s.w * (s.tall ? 0.33 : 0.36), fast);
    const cy = s.h * 0.55;
    const r = (s.tall ? 21 : 22) * u;
    s.alpha(s.ease('slow', 0.6), () => {
      dial(s, cx, cy, r, { seen: Math.min(ang, SEEN), angle: ang, k: past > 0.5 ? 'red' : 'teal', label: `${ang.toFixed(ang < 99.95 ? 1 : 0)}°` });
      txt(s, 'θ = 0.1° per position', cx, cy + r + 6 * u, '--ink-2', { size: 3 });
      s.alpha(s.win('slow', 'past'), () => txt(s, 'seen in training: 0° to 99.9°', cx, cy + r + 11.5 * u, 'green', { size: 2.9, weight: 500 }));
      s.alpha(past, () => txt(s, 'position 3,000: 300°, never seen', cx, cy + r + 11.5 * u, 'red', { size: 2.9, weight: 500 }));
    });
    s.alpha(s.ease('fail', 0.6) * (1 - fast), () => txt(s, 'scores go wrong past the trained length', s.w / 2, s.h * 0.27, 'red', { size: 3.1, font: 'serif', weight: 550 }));
    // A fast pair goes round many times in training, so every angle is familiar.
    s.alpha(fast, () => {
      const fx = s.w * (s.tall ? 0.78 : 0.74);
      const fr = (s.tall ? 12 : 15) * u;
      dial(s, fx, cy, fr, { seen: 360, full: true, angle: 57 * 3, k: 'teal' });
      txt(s, 'fast pair: 57°', fx, cy + r + 6 * u, '--ink-2', { size: 3 });
      txt(s, 'every angle seen', fx, cy + r + 11.5 * u, 'green', { size: 2.9, weight: 500 });
    });
  },
};

// ---- scene 2: divide every position by s

const squeeze: SceneDef = {
  marks: {
    rule: { tex: String.raw`m \;\to\; \frac{m}{\sym{stretch}{s}},\qquad \sym{stretch}{s} = \frac{\text{new length}}{\sym{Ltrain}{L_{\text{train}}}} = \frac{4000}{1000} = 4`, x: 0.5, y: 0.08, size: 4 },
  },
  draw(s) {
    const u = s.u;
    const x0 = s.w / 2 - (s.tall ? 42 : 56) * u;
    const x1 = s.w / 2 + (s.tall ? 42 : 56) * u;
    const y0 = s.h * 0.24;
    const y1 = s.h * 0.47;
    s.show('rule', s.ease('s', 0.6));
    cite(s, 'Chen, Wong, Chen & Tian, 2023', s.win('idea', 's'));
    txt(s, 'in the text', x0, y0 - 5 * u, '--ink-3', { align: 'left', size: 2.8, weight: 500 });
    const X = ruler(s, x0, x1, y0, NEW, TRAIN, [0, 1000, 2000, 3000, 4000]);
    const sq = s.ease('idea', 0.8, 1.5);
    s.alpha(sq, () => {
      txt(s, 'turned as', x0, y1 - 5 * u, '--ink-3', { align: 'left', size: 2.8, weight: 500 });
      ruler(s, x0, x1, y1, NEW, TRAIN, [0, 1000]);
    });
    // The whole text, squeezed into the trained range.
    s.alpha(after(s, 'idea', 0.62, 0.8) * (1 - 0.7 * s.ease('angle', 0.6)), () => {
      const g = s.ctx;
      g.beginPath();
      g.moveTo(X(0), y0 + 2 * u);
      g.lineTo(X(NEW), y0 + 2 * u);
      g.lineTo(X(TRAIN), y1 - 2 * u);
      g.lineTo(X(0), y1 - 2 * u);
      g.closePath();
      g.fillStyle = s.tint('teal', 0.14);
      g.fill();
      s.alpha(1 - s.ease('angle', 0.6), () => txt(s, '÷ the same number', X(1700), (y0 + y1) / 2 + 1 * u, 'teal', { size: 3 }));
    });
    // Each position slides to a quarter of itself.
    const pts: [number, string, string][] = [
      [3000, 'angle', '750: 75°'],
      [3999, 'last', '999.75'],
    ];
    pts.forEach(([p, beat, label], i) => {
      const t = s.ease(beat, 1.2, 0.4);
      s.alpha(s.ease(beat, 0.5), () => {
        s.circle(X(p), y0, 1.2 * u, { fill: s.c('red') });
        const xs = lerp(X(p), X(p / 4), t);
        const ys = lerp(y0, y1, t);
        s.line(lerp(X(p), X(p / 4), 0.22), y0 + 6.5 * u, xs, ys - 1.6 * u, s.tint('--ink-3', 0.7 * smooth(t / 0.3)), 0.3, [0.8, 0.8]);
        s.circle(xs, ys, 1.2 * u, { fill: s.c(t > 0.9 ? 'green' : 'red') });
        s.alpha(smooth((t - 0.8) / 0.2), () => txt(s, label, X(p / 4) + (i === 0 ? -1.5 : 1.5) * u, y1 + 8.6 * u, 'green', { align: i === 0 ? 'right' : 'left', size: 3 }));
      });
    });
    // Neighbors before and after: a tenth of a degree apart, then a quarter of that.
    s.alpha(s.ease('close', 0.6), () => {
      const a = s.w / 2 - (s.tall ? 36 : 44) * u;
      const b = s.w / 2 + (s.tall ? 36 : 44) * u;
      const step = (b - a) / 4;
      const yA = s.h * 0.66;
      const yB = s.h * 0.78;
      txt(s, 'neighbors before: 0.1° apart', a, yA - 4.2 * u, '--ink-3', { align: 'left', size: 2.8, weight: 500 });
      s.line(a, yA, b, yA, s.c('--ink-3'), 0.3);
      for (let i = 0; i <= 4; i++) s.circle(a + i * step, yA, 0.9 * u, { fill: s.c('teal') });
      txt(s, 'after: 0.025° apart', a, yB - 4.2 * u, 'green', { align: 'left', size: 2.8, weight: 500 });
      s.line(a, yB, b, yB, s.c('--ink-3'), 0.3);
      for (let i = 0; i <= 16; i++) s.circle(a + (i * step) / 4, yB, 0.7 * u, { fill: s.c('green') });
    });
    // Between two trained positions: 3,001 turns as if at 750.25.
    s.alpha(s.win('between', 'close'), () => {
      const a = s.w / 2 - (s.tall ? 36 : 44) * u;
      const b = s.w / 2 + (s.tall ? 36 : 44) * u;
      const y = s.h * 0.72;
      const Z = (v: number) => a + ((b - a) * (v - 749)) / 3;
      s.line(a, y, b, y, s.c('--ink-3'), 0.3);
      for (const v of [749, 750, 751, 752]) {
        s.circle(Z(v), y, 1 * u, { fill: s.c('green') });
        txt(s, String(v), Z(v), y + 4.2 * u, '--ink-3', { size: 2.7, weight: 500 });
      }
      const p = s.ease('between', 0.8, 4);
      s.alpha(p, () => {
        s.circle(Z(750.25), y, 1.2 * u, { fill: s.c('teal') });
        txt(s, '3,001 → 750.25', Z(750.25), y - 4.5 * u, 'teal', { size: 3, align: 'left' });
      });
      txt(s, 'trained positions', a, y - 9 * u, 'green', { align: 'left', size: 2.8, weight: 500 });
    });
    s.alpha(s.ease('llama', 0.6), () => txt(s, 'LLaMA: 2,048 → 32,768 tokens, s = 16', s.w / 2, s.h * 0.88, 'teal', { size: 3.2, weight: 650 }));
    s.alpha(s.ease('steps', 0.6), () => txt(s, 'fine-tune: at most 1,000 steps', s.w / 2, s.h * 0.94, '--ink-2', { size: 3, weight: 550 }));
  },
};

// ---- scene 3: the worked problem on an axis of angles

const tryIt: SceneDef = {
  draw(s) {
    const u = s.u;
    const sz = s.tall ? 3.1 : 3.4;
    txt(s, 'trained on 2,048, reads 8,192', s.w / 2, s.h * 0.09, '--ink-2', { size: sz });
    s.alpha(s.ease('p', 0.6, 2), () => txt(s, 'θ = 0.1°: angle at position 6,000?', s.w / 2, s.h * 0.16, '--ink-2', { size: sz }));
    s.alpha(s.ease('s', 0.6), () => txt(s, 's = 8,192 / 2,048 = 4', s.w / 2, s.h * 0.27, 'teal', { size: sz * 1.05, weight: 650 }));
    const x0 = s.w / 2 - (s.tall ? 40 : 52) * u;
    const x1 = s.w / 2 + (s.tall ? 40 : 52) * u;
    const y = s.h * 0.56;
    const X = (deg: number) => x0 + ((x1 - x0) * deg) / 600;
    s.alpha(s.ease('p', 0.6, 3), () => {
      txt(s, 'angle turned', x0, y - 13 * u, '--ink-3', { align: 'left', size: 2.8, weight: 500 });
      s.rrect(x0, y - 1.6 * u, X(204.7) - x0, 3.2 * u, 0.6, { fill: s.tint('green', 0.3) });
      s.line(x0, y, x1, y, s.c('--ink-3'), 0.35);
      for (const t of [0, 200, 400, 600]) {
        s.line(X(t), y - 1.4 * u, X(t), y + 1.4 * u, s.c('--ink-3'), 0.3);
        txt(s, `${t}°`, X(t), y + 4 * u, '--ink-3', { size: 2.7, weight: 500 });
      }
      txt(s, 'trained: up to 204.7°', x0, y - 5.5 * u, 'green', { align: 'left', size: 2.8, weight: 500 });
    });
    s.alpha(s.ease('raw', 0.6), () => {
      s.circle(X(600), y, 1.4 * u, { fill: s.c('red') });
      txt(s, 'without: 6,000 × 0.1° = 600°', x1, y - 9 * u, 'red', { align: 'right', size: sz * 0.92 });
    });
    s.alpha(s.ease('scaled', 0.6), () => {
      s.circle(X(150), y, 1.4 * u, { fill: s.c('green') });
      txt(s, 'with: 6,000 / 4 = 1,500', s.w / 2, s.h * 0.72, 'green', { size: sz });
      txt(s, '1,500 × 0.1° = 150°', s.w / 2, s.h * 0.79, 'green', { size: sz * 1.05, weight: 650 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { seen, squeeze, try: tryIt };
