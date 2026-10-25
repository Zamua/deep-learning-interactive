import type { Scene, SceneDef } from '../../../lecture/scene';
import { after } from '../../networks/draw';
import { type Ink, grid, rich, volume } from '../draw';

// An 8 x 8 picture: sky on top, a tree on the left, ground below. 0 sky, 1 tree, 2 ground.
const LABELS = [
  '00000000',
  '00110000',
  '01111000',
  '01111000',
  '00110000',
  '00110000',
  '22222222',
  '22222222',
].map((r) => [...r].map(Number));
const CLASS: Ink[] = ['blue', 'green', 'gold'];
const RGB: Ink[] = ['red', 'green', 'blue'];
// Pixel brightness jitter, so the picture reads as an image and not as labels.
const SHADE = LABELS.map((r, i) => r.map((_, j) => 0.18 + 0.2 * ((Math.sin(i * 7.1 + j * 3.7) + 1) / 2)));

/** An 8 x 8 grid of colored squares; `image` draws the picture, otherwise the flat label map. */
function picture(s: Scene, cx: number, cy: number, pitch: number, image: boolean, a: number): void {
  const g = grid(s, cx, cy, 8, 8, pitch);
  const w = (pitch - 0.35) * s.u;
  s.alpha(a, () => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const k = CLASS[LABELS[i]![j]!]!;
      s.rrect(g.x(j) - w / 2, g.y(i) - w / 2, w, w, 0.3, { fill: s.tint(k, image ? SHADE[i]![j]! : 0.55) });
    }
  });
}

const label = (s: Scene, t: string, x: number, y: number, k: Ink = '--ink-2', size = 3.2) => s.text(t, x, y, { size, font: 'mono', weight: 600, color: s.c(k), halo: true });

const pixels: SceneDef = {
  draw(s) {
    const pitch = 3.6;
    const y1 = s.h * 0.27;
    const xa = s.w / 2 - 24 * s.u;
    const xb = s.w / 2 + 24 * s.u;
    picture(s, xa, y1, pitch, true, 1);
    label(s, 'image', xa, y1 + 17.5 * s.u);
    const lab = after(s, 'label', 0.3, 0.8);
    s.alpha(lab, () => s.arrow(xa + 17 * s.u, y1, xb - 17 * s.u, y1, s.c('--ink-3'), 0.4, 2.2));
    picture(s, xb, y1, pitch, false, lab);
    s.alpha(lab, () => label(s, 'a label per pixel', xb, y1 + 17.5 * s.u));
    s.alpha(after(s, 'label', 0.55), () => {
      const names = ['sky', 'tree', 'ground'];
      names.forEach((n, i) => s.text(n, xb + 16.5 * s.u, y1 - 9 * s.u + i * 7 * s.u, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c(CLASS[i]!) }));
    });

    // The network: shrink, then grow back.
    const y2 = s.h * 0.72;
    const big = 15 * s.u;
    const small = 6 * s.u;
    const xs = [s.w / 2 - 36 * s.u, s.w / 2 - 3 * s.u, s.w / 2 + 26 * s.u];
    const sA = after(s, 'shrink', 0.1);
    const gA = after(s, 'grow', 0.1, 0.8);
    s.alpha(sA, () => {
      volume(s, xs[0]! - big / 2, y2 - big / 2, big, 3, (l) => RGB[l]!, { step: 1.2 });
      label(s, '(3, 64, 64)', xs[0]! + 1 * s.u, y2 + big / 2 + 4.5 * s.u);
    });
    const sB = after(s, 'shrink', 0.45, 0.8);
    s.alpha(sB, () => {
      s.arrow(xs[0]! + big / 2 + 4 * s.u, y2, xs[1]! - small / 2 - 3 * s.u, y2, s.c('--ink-3'), 0.4, 2.2);
      volume(s, xs[1]! - small / 2, y2 - small / 2, small, 12, () => 'purple', { step: 0.7 });
      label(s, '(256, 8, 8)', xs[1]! + 3 * s.u, y2 + big / 2 + 4.5 * s.u, 'purple');
    });
    s.alpha(gA, () => {
      s.arrow(xs[1]! + small / 2 + 10 * s.u, y2, xs[2]! - big / 2 - 3 * s.u, y2, s.c('--ink-3'), 0.4, 2.2);
      volume(s, xs[2]! - big / 2, y2 - big / 2, big, 4, () => 'gold', { step: 1.2, on: () => after(s, 'grow', 0.7) });
      label(s, '(C, 64, 64)', xs[2]! + 2 * s.u, y2 + big / 2 + 4.5 * s.u, 'gold');
    });
    s.alpha(after(s, 'shrink', 0.45), () => label(s, 'shrink', (xs[0]! + xs[1]!) / 2 + 2 * s.u, y2 - 4 * s.u, '--ink-3', 2.8));
    s.alpha(gA, () => label(s, 'grow', (xs[1]! + xs[2]!) / 2 + 2 * s.u, y2 - 4 * s.u, '--ink-3', 2.8));
  },
};

const X = [1, 2, 3];
const W = [1, 2, 1];
const S = 2;
const OUT = [1, 2, 3, 4, 5, 6, 3];
const NOUT = OUT.length;

/** Output positions, `pitch` stage units apart, centered on the stage. */
const slots = (s: Scene, pitch: number) => Array.from({ length: NOUT }, (_, j) => s.w / 2 + (j - (NOUT - 1) / 2) * pitch * s.u);

const stamp: SceneDef = {
  draw(s) {
    const pitch = s.tall ? 12.5 : 12;
    const xs = slots(s, pitch);
    const cw = (pitch - 1.6) * s.u;
    const ys = { head: s.h * 0.08, x: s.h * 0.2, st: [s.h * 0.38, s.h * 0.5, s.h * 0.62], out: s.h * 0.82 };
    rich(s, [['w = [1, 2, 1]', 'blue'], ['    S = 2', 'slate']], s.w / 2, ys.head, { size: 3.4, weight: 650 });
    const reveal = [after(s, 'first', 0.35), after(s, 'next', 0.55), after(s, 'all', 0.05)];
    X.forEach((v, i) => {
      const cx = xs[S * i + 1]!;
      s.cell(cx - cw / 2, ys.x - 4 * s.u, cw, 8 * s.u, String(v), 'orange', { on: reveal[i]! * (1 - s.ease('all', 0.5, 2.5)), size: 3.6 });
      s.alpha(reveal[i]!, () => {
        s.arrow(cx, ys.x + 5 * s.u, cx, ys.st[i]! - 5 * s.u, s.c('--ink-3'), 0.35, 2);
        W.forEach((wk, k) => {
          const j = S * i + k;
          const hot = j === 2 && i < 2 ? s.win('add', 'all') : j === 4 ? after(s, 'all', 0.3) * (1 - s.ease('all', 0.5, 3)) : 0;
          s.cell(xs[j]! - cw / 2, ys.st[i]! - 3.6 * s.u, cw, 7.2 * s.u, String(v * wk), 'orange', { on: hot, size: 3.4 });
        });
      });
    });
    s.text('x', xs[0]! - 3 * s.u, ys.x, { size: 4, font: 'mono', weight: 650, color: s.c('orange') });
    // Faint guides under every output position.
    xs.forEach((x, j) => s.text(String(j), x, ys.out + 7.5 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
    const shown = (j: number) => (j <= 2 ? after(s, 'add', 0.55) : after(s, 'all', 0.55));
    OUT.forEach((v, j) => {
      const a = shown(j);
      s.cell(xs[j]! - cw / 2, ys.out - 4 * s.u, cw, 8 * s.u, a > 0.5 ? String(v) : '', 'gold', { on: a * (j === 2 ? s.win('add', 'all') : 0), size: 3.6 });
    });
    s.alpha(after(s, 'all', 0.85), () => label(s, '3 in, 7 out', s.w / 2, ys.out + 13 * s.u, '--ink-2', 3.2));
  },
};

const size: SceneDef = {
  marks: {
    f: { tex: String.raw`\symS(W - 1) + \symF - 2\symP`, x: 0.5, y: 0.12, size: 5.2 },
  },
  draw(s) {
    s.show('f', after(s, 'pad', 0.75));
    const pitch = s.tall ? 12 : 11.5;
    const xs = slots(s, pitch);
    const cw = (pitch - 1.6) * s.u;
    const yo = s.h * 0.44;
    const trim = after(s, 'pad', 0.3, 0.8);
    const undo = s.ease('undo', 0.6);
    s.alpha(1 - undo, () => {
      // Each stamp as a span above the output row, staggered so the overlaps show.
      [0, 1, 2].forEach((i) => {
        const y = yo - (16 - 4.5 * i) * s.u;
        const x0 = xs[S * i]! - cw / 2;
        const x1 = xs[S * i + 2]! + cw / 2;
        s.rrect(x0, y - 1.4 * s.u, x1 - x0, 2.8 * s.u, 1.4, { fill: s.tint('orange', 0.3), stroke: s.c('orange'), lw: 0.3 });
        s.circle(x0, y, 1 * s.u, { fill: s.c('orange') });
      });
      OUT.forEach((v, j) => {
        const edge = j === 0 || j === NOUT - 1;
        s.alpha(edge ? 1 - 0.75 * trim : 1, () => s.cell(xs[j]! - cw / 2, yo - 4 * s.u, cw, 8 * s.u, String(v), edge && trim > 0.5 ? '--ink-3' : 'gold', { size: 3.6 }));
        if (edge && trim > 0.02) s.alpha(trim, () => s.line(xs[j]! - cw / 2, yo + 4 * s.u, xs[j]! + cw / 2, yo - 4 * s.u, s.c('red'), 0.5));
      });
      const by = yo + 7.5 * s.u;
      const brace = (a: number, b: number, text: string, k: Ink, alpha: number) =>
        s.alpha(alpha, () => {
          s.line(a, by, b, by, s.c(k), 0.4);
          s.line(a, by - 1.2 * s.u, a, by, s.c(k), 0.4);
          s.line(b, by - 1.2 * s.u, b, by, s.c(k), 0.4);
          label(s, text, (a + b) / 2, by + 3.6 * s.u, k, 3.2);
        });
      brace(xs[0]! - cw / 2, xs[4]! - cw / 2 - 0.6 * s.u, 'S(W − 1) = 4', 'slate', after(s, 'starts', 0.6) * (1 - trim));
      brace(xs[4]! - cw / 2 + 0.6 * s.u, xs[6]! + cw / 2, 'F = 3', 'blue', after(s, 'width', 0.2) * (1 - trim));
      s.alpha(after(s, 'width', 0.5) * (1 - trim), () => rich(s, [['4 + 3 = ', '--ink-2'], ['7', 'gold']], s.w / 2, yo + 18 * s.u, { size: 3.8, weight: 650 }));
      s.alpha(trim, () => rich(s, [['7 − 2 × 1 = ', '--ink-2'], ['5', 'gold']], s.w / 2, yo + 18 * s.u, { size: 3.8, weight: 650 }));
    });
    s.alpha(undo, () => {
      const y = s.h * 0.5;
      const lx = s.w / 2 - 37 * s.u;
      rich(s, [['conv:        ', '--ink-3'], ['(32 − 4 + 2) / 2 + 1 = ', '--ink-2'], ['16', 'purple']], lx, y + 2 * s.u, { size: 3.4, weight: 600, align: 'left' });
      s.alpha(after(s, 'undo', 0.6), () => rich(s, [['transposed:  ', '--ink-3'], ['2(16 − 1) + 4 − 2 = ', '--ink-2'], ['32', 'gold']], lx, y + 11 * s.u, { size: 3.4, weight: 600, align: 'left' }));
      s.alpha(after(s, 'undo', 0.25), () => label(s, 'F = 4, S = 2, P = 1', s.w / 2, y - 8 * s.u, 'slate', 3.2));
    });
  },
};

export const scenes: Record<string, SceneDef> = { pixels, stamp, size };
