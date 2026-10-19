import { type SceneDef, clamp01 } from '../../lecture/scene';
import type { K } from './kit';

// ---------------------------------------------------------------- map

const PARTS: { name: string; note: string; items: string[]; beat: string; k: K }[] = [
  { name: 'Start here', note: 'overview, math, NumPy', items: ['0', '1', '2'], beat: 'start', k: 'slate' },
  { name: 'Neural networks', note: 'the core, read in order', items: ['3', '4', '5', '6', '7', '8', '9', '10'], beat: 'nn', k: 'blue' },
  { name: 'Convolutional networks', note: 'networks for images', items: ['11', '12', '13', '14'], beat: 'conv', k: 'green' },
  { name: 'Beyond still images', note: 'sequences, video', items: ['15', '16', '17'], beat: 'beyond', k: 'purple' },
  { name: 'Assignments', note: 'what each asked for', items: ['A1', 'A2', 'A3'], beat: 'asg', k: 'gold' },
];

export const map: SceneDef = {
  draw(s) {
    const { w, u, t } = s;
    const bw = Math.min(w - u * 12, u * 104);
    const bx = w / 2 - bw / 2;
    const rh = u * 16;
    const y0 = u * 15.5;
    const sp = Math.min(u * 8.2, (bw - u * 4) / 8);
    const r = Math.min(u * 3, sp * 0.4);
    const next = s.ease('next', 0.8, 0.4);
    PARTS.forEach((P, i) => {
      const a = s.ease('five', 0.5, 0.3 + 0.35 * i);
      if (a <= 0) return;
      const y = y0 + i * rh;
      const lit = s.since(P.beat) >= 0;
      const p = lit ? s.prog(P.beat) : 0;
      const recap = s.since('recap') >= 0 && s.since('next') < 0 ? 1 : 0;
      s.alpha(a, () => {
        s.text(P.name, bx, y + u * 3, { size: 3.8, font: 'display', weight: 600, align: 'left', color: s.c(lit ? P.k : '--ink-2') });
        s.alpha(s.ease(P.beat, 0.5), () => s.text(P.note, bx + bw, y + u * 3, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2') }));
        const cy = y + u * 10.2;
        const n = P.items.length;
        const cx0 = bx + r + u * 0.5;
        s.line(cx0, cy, cx0 + (n - 1) * sp, cy, s.tint(lit ? P.k : '--ink', lit ? 0.5 : 0.18), 0.35);
        P.items.forEach((it, j) => {
          const on = lit ? clamp01(p * (n + 2) - j) : 0;
          const cx = cx0 + j * sp;
          const asg = i === 4;
          const k: K = P.k;
          const fillA = Math.max(on, recap);
          if (asg) {
            s.rrect(cx - r * 1.2, cy - r, r * 2.4, r * 2, 0.9, { fill: s.c('--card') });
            s.rrect(cx - r * 1.2, cy - r, r * 2.4, r * 2, 0.9, { fill: s.tint(k, 0.08 + 0.3 * fillA), stroke: s.tint(k, 0.35 + 0.65 * fillA), lw: 0.35 });
          }
          else s.circle(cx, cy, r, { fill: fillA > 0.5 ? s.tint(k, 0.85) : s.c('--card'), stroke: s.tint(k, 0.4 + 0.6 * fillA), lw: 0.35 });
          const txt = !asg && fillA > 0.5 ? '#fff' : s.c(fillA > 0.5 ? k : '--ink-2');
          s.text(it, cx, cy + u * 0.2, { size: it.length > 1 ? 2.4 : 2.8, font: 'mono', weight: 650, color: txt });
        });
        // You are here, and the next stop.
        if (i === 0) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 3);
          s.circle(cx0, cy, r + u * (1 + pulse * 0.8), { stroke: s.tint('--accent', 0.5 + 0.4 * pulse), lw: 0.45 });
          const lx = cx0 + 2 * sp + r + u * 4;
          s.alpha(s.ease('five', 0.6, 0.8) * (1 - next), () => s.text('← you are here', lx, cy + u * 0.2, { size: 3.1, font: 'ui', weight: 600, align: 'left', color: s.c('--accent') }));
          s.alpha(next, () => {
            s.circle(cx0 + sp, cy, r + u * 1.2, { stroke: s.c('--accent'), lw: 0.5 });
            s.text('← next: the math survival kit', lx, cy + u * 0.2, { size: 3.1, font: 'ui', weight: 600, align: 'left', color: s.c('--accent') });
          });
        }
      });
    });
  },
};
