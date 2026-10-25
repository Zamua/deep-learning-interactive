import type { Scene, SceneDef } from '../../../lecture/scene';
import { type Ink, rich, volume } from '../draw';

interface Row {
  op: string;
  shape: string;
  C: number;
  S: number;
  k: Ink;
  beat: string;
  delay: number;
}

const ROWS: Row[] = [
  { op: 'input', shape: '(3, 32, 32)', C: 3, S: 32, k: 'orange', beat: 'input', delay: 0 },
  { op: 'conv 3 × 3, 16', shape: '(16, 32, 32)', C: 16, S: 32, k: 'blue', beat: 'conv', delay: 0.3 },
  { op: 'ReLU', shape: '(16, 32, 32)', C: 16, S: 32, k: 'gold', beat: 'relu', delay: 0.3 },
  { op: 'max pool 2 × 2', shape: '(16, 16, 16)', C: 16, S: 16, k: 'teal', beat: 'pool', delay: 0.3 },
  { op: 'conv 3 × 3, 32', shape: '(32, 16, 16)', C: 32, S: 16, k: 'blue', beat: 'repeat', delay: 0.6 },
  { op: 'ReLU', shape: '(32, 16, 16)', C: 32, S: 16, k: 'gold', beat: 'repeat', delay: 2.2 },
  { op: 'max pool 2 × 2', shape: '(32, 8, 8)', C: 32, S: 8, k: 'teal', beat: 'repeat', delay: 3.8 },
];

/** A volume glyph centered on (cx, cy): side from the spatial size, sheets from the channels. */
function glyph(s: Scene, cx: number, cy: number, C: number, S: number, k: Ink, on = 0): void {
  const side = (S >= 32 ? 7.2 : S >= 16 ? 5 : 3.4) * s.u;
  const n = C <= 3 ? C : C <= 16 ? 4 : 8;
  const st = 0.45;
  const ext = (n - 1) * st * s.u;
  volume(s, cx - (side + ext) / 2, cy - side / 2 + ext / 2, side, n, () => k, { step: st, on: () => on });
}

const stages: SceneDef = {
  draw(s) {
    const gx = s.w * 0.5;
    const y0 = s.h * 0.1;
    const pitch = (s.h * 0.8) / (ROWS.length - 1);
    // The row lit is the newest one shown.
    let cur = 0;
    ROWS.forEach((r, i) => {
      if (s.ease(r.beat, 0.4, r.delay) > 0.5) cur = i;
    });
    ROWS.forEach((r, i) => {
      const a = s.ease(r.beat, 0.6, r.delay);
      const y = y0 + i * pitch;
      const on = i === cur ? 1 : 0;
      s.alpha(a * (on ? 1 : 0.6), () => {
        if (i > 0) s.arrow(gx, y - pitch + 5.4 * s.u, gx, y - 5.4 * s.u, s.c('--ink-3'), 0.3, 1.6);
        glyph(s, gx, y, r.C, r.S, r.k, on);
        s.text(r.op, gx - 8 * s.u, y, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c(on ? r.k : '--ink-2') });
        s.text(r.shape, gx + 8 * s.u, y, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c(on ? '--ink' : '--ink-2') });
      });
    });
  },
};

const PARAMS: [string, number, Ink][] = [
  ['conv 1', 448, 'blue'],
  ['conv 2', 4640, 'blue'],
  ['linear', 20490, 'purple'],
];
const fmtN = (n: number) => n.toLocaleString('en-US');

const head: SceneDef = {
  draw(s) {
    const y = s.h * 0.14;
    const gx = s.w * 0.12;
    glyph(s, gx, y, 32, 8, 'teal');
    s.text('(32, 8, 8)', gx, y + 7 * s.u, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
    const fl = s.ease('flatten', 0.8, 0.4);
    const bx0 = s.w * 0.26;
    const bx1 = s.w * 0.92;
    s.alpha(fl, () => {
      s.arrow(gx + 5 * s.u, y, bx0 - 2 * s.u, y, s.c('--ink-3'), 0.3, 1.8);
      const w = (bx1 - bx0) * fl;
      s.rrect(bx0, y - 1.6 * s.u, w, 3.2 * s.u, 0.6, { fill: s.tint('teal', 0.3), stroke: s.tint('teal', 0.8), lw: 0.3 });
      for (let k = 1; k < 32; k++) s.line(bx0 + (w * k) / 32, y - 1.6 * s.u, bx0 + (w * k) / 32, y + 1.6 * s.u, s.tint('teal', 0.5), 0.15);
      s.alpha(s.ease('flatten', 0.6, 1.6), () => rich(s, [['32 × 8 × 8 = ', '--ink-2'], ['2,048', 'teal']], (bx0 + bx1) / 2, y + 7 * s.u, { size: 3.6, weight: 600 }));
    });
    const sy = s.h * 0.4;
    s.alpha(s.ease('fc', 0.6), () => {
      s.arrow((bx0 + bx1) / 2, y + 10.5 * s.u, (bx0 + bx1) / 2, sy - 5 * s.u, s.c('--ink-3'), 0.3, 1.8);
      s.text('linear', (bx0 + bx1) / 2 + 2 * s.u, (y + sy) / 2 + 3 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('purple') });
      const p = 6.2 * s.u;
      for (let k = 0; k < 10; k++) s.cell((bx0 + bx1) / 2 + (k - 5) * p + 0.4 * s.u, sy - 2.6 * s.u, p - 0.8 * s.u, 5.2 * s.u, '', 'purple', { on: 0.4 });
      s.text('10 scores', (bx0 + bx1) / 2, sy + 6 * s.u, { size: 3.2, font: 'mono', color: s.c('purple') });
    });
    const max = PARAMS[2]![1];
    const lx = s.w * 0.22;
    const span = s.w * 0.5;
    PARAMS.forEach(([name, n, k], i) => {
      const by = s.h * (0.6 + i * 0.1);
      const a = s.ease('params', 0.5, 0.8 + i * 1.6);
      s.alpha(a, () => {
        const on = i === 2 ? s.ease('most', 0.6) : 0;
        s.text(name, lx - 2.5 * s.u, by, { size: 3.3, font: 'mono', align: 'right', color: s.c(k) });
        s.rrect(lx, by - 1.8 * s.u, Math.max(0.6 * s.u, (span * n * a) / max), 3.6 * s.u, 0.6, { fill: s.tint(k, 0.3 + 0.35 * on), stroke: s.tint(k, 0.7 + 0.3 * on), lw: 0.3 });
        s.text(fmtN(n), lx + Math.max(0.6 * s.u, (span * n) / max) + 2 * s.u, by, { size: 3.3, font: 'mono', weight: 600, align: 'left', color: s.c(k), halo: true });
      });
    });
    s.alpha(s.ease('most', 0.6, 1), () => s.text('total 25,578: 80% in the linear layer', s.w / 2, s.h * 0.92, { size: 3.4, font: 'mono', color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { stages, head };
