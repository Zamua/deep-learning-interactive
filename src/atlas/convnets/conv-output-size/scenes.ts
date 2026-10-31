import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, smooth } from '../../../lecture/scene';
import { after, cells, cite, columns } from '../../draw';
import { caption } from '../../networks/draw';
import { rich } from '../draw';

const IN = [3, 1, 4, 1, 5, 9, 2];
const PADDED = ['0', ...IN.map(String), '0'];
const CH = 8.5;
const cw = (pitch: number) => Math.min(pitch - 1.4, 11);
const mono = { font: 'mono', weight: 600 } as const;

/** Hops completed `t` seconds in, one every `every` seconds, each eased over `dur`: 0 .. n. */
function hops(t: number, n: number, every = 0.9, dur = 0.5): number {
  let p = 0;
  for (let k = 0; k < n; k++) p += smooth(clamp01((t - k * every) / dur));
  return p;
}

/** Cell centers of an `n`-cell row, shifted `dx` cells to the right. */
const rowXs = (s: Scene, n: number, pitch: number, dx = 0) => columns(s, n, pitch).map((x) => x + dx * pitch * s.u);

/** The filter's window over `F` cells of a row, its left edge at cell `p` (fractional while it moves). */
function windowAt(s: Scene, xs: number[], pitch: number, p: number, F: number, y: number, k: Ink, a = 1) {
  const P = pitch * s.u;
  s.alpha(a, () => s.rrect(xs[0]! + (p - 0.5) * P - 0.6 * s.u, y - 5.8 * s.u, F * P + 1.2 * s.u, 11.6 * s.u, 1.8, { fill: s.tint(k, 0.07), stroke: s.c(k), lw: 0.5 }));
}

/** A curved arrow from x0 to x1, rising `lift` stage units above y. */
function hop(s: Scene, x0: number, x1: number, y: number, k: Ink, a: number, lift = 4) {
  if (a <= 0.003) return;
  s.alpha(a, () => {
    const c = s.ctx;
    const top = y - lift * s.u;
    const mx = (x0 + x1) / 2;
    const end = x1 - 0.4 * s.u;
    c.beginPath();
    c.moveTo(x0 + 0.4 * s.u, y);
    c.quadraticCurveTo(mx, top, end, y);
    c.strokeStyle = s.c(k);
    c.lineWidth = 0.35 * s.u;
    c.stroke();
    const dx = end - mx;
    const dy = y - top;
    const len = Math.hypot(dx, dy);
    const [ux, uy] = [dx / len, dy / len];
    const hd = 1.6 * s.u;
    c.beginPath();
    c.moveTo(end, y);
    c.lineTo(end - ux * hd - uy * hd * 0.5, y - uy * hd + ux * hd * 0.5);
    c.lineTo(end - ux * hd + uy * hd * 0.5, y - uy * hd - ux * hd * 0.5);
    c.closePath();
    c.fillStyle = s.c(k);
    c.fill();
  });
}

/** Fades in once a fraction `f` of beat `id` has been spoken, so it follows the voice at any pace. */
const at = (s: Scene, id: string, f: number) => after(s, id, f, 0.6);

/** Appears as the window's left edge passes cell `i` (window position `p`, in cells). */
const passed = (p: number, i: number) => smooth(clamp01((p - i + 0.6) / 0.4));

// ---- every pass shrinks: 7 -> 5 -> 3 -> 1, then W, F and the count of positions

const shrink: SceneDef = {
  draw(s) {
    const pitch = s.tall ? 11.5 : 12;
    const [yA, yB, yC, yD] = [0.22, 0.4, 0.56, 0.7].map((f) => s.h * f);
    const xs = rowXs(s, 7, pitch);
    const w = cw(pitch);
    const focus = s.ease('W', 0.8);

    cells(s, xs, yA, IN.map(String), 'orange', { w, h: CH, on: xs.map(() => s.win('W', 'F')) });

    // The window sweeps row A once, returns to the start for F, and sweeps again for the steps.
    const p1 = hops(s.since('shrink') - 0.8, 4, 0.75, 0.45);
    const p2 = hops(s.since('steps') - 0.3, 4, 0.7, 0.4);
    const p = s.t < s.at('W') ? p1 : 4 * (1 - s.ease('W', 0.8)) + p2 - 4 * s.ease('plus', 0.8, 0.3);
    const winA = Math.max(s.win('shrink', 'again'), s.ease('F', 0.5));
    windowAt(s, xs, pitch, p, 3, yA, 'blue', winA);
    s.alpha(s.win('F', 'steps'), () => s.text('F = 3', xs[1]!, yA - 9 * s.u, { ...mono, size: 3.6, color: s.c('slate') }));
    s.alpha(s.win('W', 'steps') + s.ease('plus', 0.6), () => s.text('W = 7', s.w / 2, yA + 9 * s.u, { ...mono, size: 3.4, color: s.c('orange'), halo: true }));

    // Steps: one hop per move of the window, above the row.
    for (let k = 0; k < 4; k++) hop(s, xs[k + 1]!, xs[k + 2]!, yA - 7.5 * s.u, 'blue', clamp01(p2 - k) * (1 - s.ease('plus', 0.6, 3)), 3.5);

    // Row B: one output under the middle of each window.
    const firstOn = s.ease('plus', 0.6);
    for (let j = 0; j < 5; j++) {
      const a = s.ease('shrink', 0.4) * passed(p1, j);
      s.alpha(a, () => cells(s, [xs[j + 1]!], yB, [String(j)], 'gold', { w, h: CH, on: [j === 0 ? firstOn : 0] }));
    }
    s.alpha(firstOn, () => s.text('start', xs[1]!, yB + 7.5 * s.u, { ...mono, size: 3.1, color: s.c('gold') }));

    // Rows C and D: the same filter again, and again; they fade once the counting starts.
    s.alpha(1 - focus, () => {
      const pB = hops(s.since('again') - 0.3, 2, 0.6, 0.35);
      windowAt(s, xs, pitch, 1 + pB, 3, yB, 'blue', s.win('again', 'layer') * (1 - after(s, 'again', 0.55)));
      for (let j = 0; j < 3; j++) s.alpha(s.ease('again', 0.3, 0.3) * passed(pB, j), () => cells(s, [xs[j + 2]!], yC, [String(j)], 'gold', { w, h: CH }));
      windowAt(s, xs, pitch, 2, 3, yC, 'blue', at(s, 'again', 0.55) * (1 - s.ease('layer', 0.5)));
      s.alpha(at(s, 'again', 0.7), () => cells(s, [xs[3]!], yD, ['0'], 'gold', { w, h: CH }));
      ['layer 1', 'layer 2', 'layer 3'].forEach((l, i) => {
        const x = xs[i + 1]! - (pitch / 2 + 2.5) * s.u;
        s.alpha(s.ease('layer', 0.5, 0.4 + 0.5 * i), () => s.text(l, x, [yB, yC, yD][i]!, { ...mono, size: 3.1, align: 'right', color: s.c('--ink-2') }));
      });
      s.alpha(s.ease('layer', 0.6, 2.2), () => caption(s, 'widths: 7, 5, 3, 1', s.h * 0.86, '--ink-2', 4.2));
    });

    const yS = s.h * 0.6;
    s.alpha(at(s, 'steps', 0.4) * (1 - s.ease('plus', 0.6, 3)), () => rich(s, [['W − F = 7 − 3 = ', '--ink-2'], ['4', 'blue'], [' steps', '--ink-2']], s.w / 2, yS, { size: 3.8, weight: 600 }));
    s.alpha(at(s, 'plus', 0.25), () => rich(s, [['W − F + 1 = 7 − 3 + 1 = ', '--ink-2'], ['5', 'gold']], s.w / 2, s.h * 0.72, { size: 4, weight: 650 }));
    s.alpha(at(s, 'plus', 0.7), () => caption(s, 'count positions, not steps', s.h * 0.84, '--ink-2', 3.6));
  },
};

// ---- padding: the ends come back

const pad: SceneDef = {
  draw(s) {
    const pitch = s.tall ? 9.8 : 11;
    const [y, yo] = [0.28, 0.48].map((f) => s.h * f);
    const xs = rowXs(s, 9, pitch);
    const w = cw(pitch);
    const grow = s.ease('pad', 0.8, 1.4);
    PADDED.forEach((l, i) => {
      const edge = i === 0 || i === 8;
      s.alpha(edge ? grow : 1, () => cells(s, [xs[i]!], y, [l], edge ? '--ink-3' : 'orange', { w, h: CH, on: [edge ? s.win('nine', 'formula') : 0] }));
    });
    s.alpha(at(s, 'pad', 0.75), () => {
      for (const i of [0, 8]) s.text('P = 1', xs[i]!, y - 9 * s.u, { ...mono, size: 3.3, color: s.c('slate') });
    });
    s.alpha(at(s, 'nine', 0.3), () => s.text('W + 2P = 9', s.w / 2, y + 8.4 * s.u, { ...mono, size: 3.4, color: s.c('orange'), halo: true }));

    // Unpadded, the window starts on cell 1 and outputs sit under cells 2..6; padded, it sweeps all seven places.
    const p = hops(s.since('nine') - 1.2, 6, 0.55, 0.35);
    windowAt(s, xs, pitch, s.t < s.at('nine') ? 1 : p, 3, y, 'blue', s.win('nine', 'formula'));
    for (let j = 0; j < 7; j++) {
      const ends = j === 0 || j === 6;
      const a = ends ? s.ease('nine', 0.4, 1.2) * passed(p, j) : 1;
      // Numbered once the padded sweep gives every place its output.
      s.alpha(a, () => {
        cells(s, [xs[j + 1]!], yo, [''], 'gold', { w, h: CH, on: [ends ? s.win('nine', 'formula') : 0] });
        s.alpha(s.ease('nine', 0.5, 1.2), () => s.text(String(j), xs[j + 1]!, yo + 0.2 * s.u, { font: 'mono', size: CH * 0.42 }));
      });
    }
    // The two places a filter three wide cannot reach without padding.
    s.alpha(s.ease('lose', 0.6, 0.8) * (1 - s.ease('nine', 0.4, 1.2)), () => {
      for (const i of [1, 7]) {
        s.rrect(xs[i]! - (w / 2) * s.u, yo - (CH / 2) * s.u, w * s.u, CH * s.u, 1.2, { stroke: s.c('red'), lw: 0.35 });
        s.text('✗', xs[i]!, yo, { size: 4, font: 'ui', weight: 700, color: s.c('red') });
      }
      caption(s, 'F − 1 = 2 lost: one at each end', yo + 9.5 * s.u, 'red', 3.4);
    });

    const [y1, y2, y3] = [0.66, 0.77, 0.88].map((f) => s.h * f);
    s.alpha(at(s, 'formula', 0.55), () => rich(s, [['W − F + 2P + 1 = 7 − 3 + 2 + 1 = ', '--ink-2'], ['7', 'gold']], s.w / 2, y1, { size: 3.4, weight: 600 }));
    s.alpha(at(s, 'same', 0.45), () => rich(s, [['2P = F − 1', 'slate'], [',  so  ', '--ink-3'], ['P = (F − 1) / 2', 'slate']], s.w / 2, y2, { size: 3.8, weight: 650 }));
    s.alpha(s.ease('five', 0.6, 0.4), () => rich(s, [['F = 5 loses 4:  ', '--ink-2'], ['P = 2', 'slate']], s.w / 2, y3, { size: 3.8, weight: 600 }));
  },
};

// ---- stride: jumps of S, and LeCun's zip codes

/** A 16 x 16 handwritten-looking 7, as intensities 0..1, and its 8 x 8 version two pixels apart. */
const DIGIT: number[][] = (() => {
  const segs: [number, number, number, number][] = [[3, 3, 12.5, 2.6], [12.5, 2.6, 6.5, 13.5], [6.5, 8.2, 11.5, 8]];
  const dist = (x: number, y: number, [x0, y0, x1, y1]: [number, number, number, number]) => {
    const t = clamp01(((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / ((x1 - x0) ** 2 + (y1 - y0) ** 2));
    return Math.hypot(x - x0 - t * (x1 - x0), y - y0 - t * (y1 - y0));
  };
  return Array.from({ length: 16 }, (_, i) => Array.from({ length: 16 }, (_, j) => clamp01(1.6 - Math.min(...segs.map((g) => dist(j + 0.5, i + 0.5, g))))));
})();
const HALF: number[][] = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => Math.max(DIGIT[2 * i]![2 * j]!, DIGIT[2 * i]![2 * j + 1]!, DIGIT[2 * i + 1]![2 * j]!, DIGIT[2 * i + 1]![2 * j + 1]!)));

/** A square grid of shaded cells, `side` stage units across, top-left at (x, y). */
function shade(s: Scene, x: number, y: number, side: number, v: number[][], k: Ink) {
  const n = v.length;
  const c = (side / n) * s.u;
  s.rrect(x, y, side * s.u, side * s.u, 0.6, { stroke: s.tint(k, 0.5), lw: 0.3 });
  v.forEach((row, i) => row.forEach((a, j) => {
    if (a > 0.02) s.rrect(x + j * c + 0.1 * s.u, y + i * c + 0.1 * s.u, c - 0.2 * s.u, c - 0.2 * s.u, 0.2, { fill: s.tint(k, 0.15 + 0.75 * a) });
  }));
}

const stride: SceneDef = {
  marks: {
    f: { tex: String.raw`\dfrac{W - \symF + 2\symP}{\symS} + 1`, x: 0.5, y: 0.12, size: 5 },
  },
  draw(s) {
    const pitch = s.tall ? 9.8 : 11;
    const [y, yo] = [0.4, 0.6].map((f) => s.h * f);
    const xs = rowXs(s, 9, pitch);
    const w = cw(pitch);
    const story = s.win('lecun', 'formula');
    const p = 2 * hops(s.since('every') - 0.3, 3, 0.75, 0.45);

    s.alpha(1 - story, () => {
      PADDED.forEach((l, i) => cells(s, [xs[i]!], y, [l], i === 0 || i === 8 ? '--ink-3' : 'orange', { w, h: CH }));
      windowAt(s, xs, pitch, p, 3, y, 'blue');
      // The first jump, drawn as soon as the stride is named.
      hop(s, xs[1]!, xs[3]!, y - 7.5 * s.u, 'slate', at(s, 'jump', 0.5) * (1 - s.ease('every', 0.4)), 5);
      s.alpha(at(s, 'jump', 0.5) * (1 - s.ease('every', 0.4)), () => s.text('S = 2', xs[2]!, y - 14.5 * s.u, { ...mono, size: 3.4, color: s.c('slate') }));
      for (let j = 0; j < 4; j++) {
        s.alpha(s.ease('every', 0.4) * passed(p / 2, j), () => cells(s, [xs[2 * j + 1]!], yo, [String(j)], 'gold', { w, h: CH, on: [s.ease('four', 0.6) * (j === 0 ? 1 : 0.4)] }));
      }
      // Six steps of one become three jumps of two.
      const f = s.ease('formula', 0.6, 1.5);
      for (let k = 0; k < 6; k++) hop(s, xs[k + 1]!, xs[k + 2]!, y - 7.5 * s.u, 'blue', 0.5 * f * (1 - s.ease('four', 0.5, 1.2)), 2.6);
      for (let k = 0; k < 3; k++) hop(s, xs[2 * k + 1]!, xs[2 * k + 3]!, y - 7.5 * s.u, 'slate', s.ease('four', 0.5, 0.9 + 0.3 * k), 6);
      s.alpha(s.ease('every', 0.6, 0.2) * (1 - s.ease('formula', 0.5)), () => s.text('S = 2', s.w / 2, yo + 9 * s.u, { ...mono, size: 3.4, color: s.c('slate') }));
      s.alpha(at(s, 'four', 0.4), () => rich(s, [['6 / 2 = 3 jumps, + 1 = ', '--ink-2'], ['4', 'gold']], s.w / 2, s.h * 0.8, { size: 4, weight: 650 }));
    });

    s.alpha(story, () => {
      const side = s.tall ? 30 : 36;
      const gap = s.tall ? 22 : 26;
      const x0 = s.w / 2 - (side + gap / 2) * s.u;
      const x1 = s.w / 2 + (gap / 2) * s.u;
      const top = s.h * 0.2;
      shade(s, x0, top, side, DIGIT, 'orange');
      s.alpha(at(s, 'lecun', 0.6), () => {
        shade(s, x1, top, side, HALF, 'gold');
        s.arrow(x0 + (side + 2) * s.u, top + (side / 2) * s.u, x1 - 2 * s.u, top + (side / 2) * s.u, s.c('--ink-3'), 0.35, 2.2);
        s.text('S = 2', s.w / 2, top + (side / 2) * s.u - 4 * s.u, { ...mono, size: 3.2, color: s.c('slate'), halo: true });
      });
      const ly = top + (side + 5) * s.u;
      s.text('16 × 16 digit', x0 + (side / 2) * s.u, ly, { ...mono, size: 3.3, color: s.c('orange') });
      s.alpha(at(s, 'lecun', 0.6), () => s.text('8 × 8 outputs', x1 + (side / 2) * s.u, ly, { ...mono, size: 3.3, color: s.c('gold') }));
      s.alpha(s.ease('reason', 0.6, 0.4), () => {
        caption(s, 'is a stroke there: fine detail', ly + 10 * s.u, '--ink-2', 3.4);
        caption(s, 'exactly where: coarser will do', ly + 16 * s.u, '--ink-2', 3.4);
      });
    });
    cite(s, 'LeCun et al., 1989 · zip codes', story);
    s.show('f', s.ease('formula', 0.6));
  },
};

// ---- when the division is not whole: drop the overhang; AlexNet's 224 and 227

const EIGHT = ['3', '1', '4', '1', '5', '9', '2', '6'];

const fit: SceneDef = {
  draw(s) {
    const pitch = s.tall ? 9.8 : 11;
    const [yg, y, yo] = [0.14, 0.34, 0.54].map((f) => s.h * f);
    const alex = s.ease('alexnet', 0.7);
    s.alpha(1 - alex, () => {
      const xs = rowXs(s, 9, pitch, -0.5);
      const w = cw(pitch);
      s.text('W = 8, F = 3, S = 2', s.w / 2, yg, { ...mono, size: 3.4, color: s.c('--ink-2') });
      EIGHT.forEach((l, i) => cells(s, [xs[i]!], y, [l], 'orange', { w, h: CH }));
      const p = 2 * hops(s.since('fit') - 0.3 * (s.end('fit') - s.at('fit')), 3, 1, 0.45);
      const over = p > 5;
      windowAt(s, xs, pitch, p, 3, y, over ? 'red' : 'blue');
      for (let j = 0; j < 3; j++) s.alpha(passed(p / 2, j), () => cells(s, [xs[2 * j + 1]!], yo, [String(j)], 'gold', { w, h: CH, on: [at(s, 'drop', 0.7)] }));
      const gone = s.ease('drop', 0.6, 0.6);
      s.alpha(gone, () => {
        cells(s, [xs[7]!], yo, ['✗'], 'red', { w, h: CH });
        s.text('dropped', xs[7]!, yo + 7.5 * s.u, { ...mono, size: 3.1, color: s.c('red') });
      });
      s.alpha(at(s, 'fit', 0.55), () => rich(s, [['5 / 2 = ', '--ink-2'], ['2.5', 'red'], [' jumps', '--ink-2']], s.w / 2, s.h * 0.72, { size: 4, weight: 600 }));
      s.alpha(at(s, 'drop', 0.6), () => rich(s, [['round down: 2, + 1 = ', '--ink-2'], ['3', 'gold']], s.w / 2, s.h * 0.83, { size: 4, weight: 650 }));
    });

    s.alpha(alex, () => {
      const side = s.tall ? 32 : 30;
      const x = s.w / 2 - (side / 2) * s.u;
      const top = s.h * 0.1;
      s.rrect(x, top, side * s.u, side * s.u, 0.8, { fill: s.tint('orange', 0.12), stroke: s.tint('orange', 0.7), lw: 0.35 });
      const fw = 6 * s.u;
      s.rrect(x + 1.2 * s.u, top + 1.2 * s.u, fw, fw, 0.6, { fill: s.tint('blue', 0.15), stroke: s.c('blue'), lw: 0.45 });
      s.text('11', x + 1.2 * s.u + fw / 2, top + 1.2 * s.u + fw / 2, { ...mono, size: 2.8, color: s.c('blue') });
      s.arrow(x + 2.4 * s.u + fw, top + 4.2 * s.u, x + 12 * s.u + fw, top + 4.2 * s.u, s.c('slate'), 0.35, 1.8);
      s.text('4', x + 7.2 * s.u + fw, top + 7.6 * s.u, { ...mono, size: 2.8, color: s.c('slate') });
      const fix = at(s, 'exact', 0.1);
      s.alpha(1 - fix, () => s.text('224', s.w / 2, top + (side + 4) * s.u, { ...mono, size: 3.4, color: s.c('orange') }));
      s.alpha(fix, () => s.text('227', s.w / 2, top + (side + 4) * s.u, { ...mono, size: 3.4, color: s.c('orange') }));
      const [y1, y2, y3] = [0.6, 0.72, 0.84].map((f) => s.h * f);
      s.alpha(at(s, 'odd', 0.05), () => rich(s, [['(224 − 11) / 4 + 1 = ', '--ink-2'], ['54.25', 'red']], s.w / 2, y1, { size: 3.8, weight: 600 }));
      s.alpha(at(s, 'odd', 0.6), () => caption(s, 'its figure: 55 across', y2, '--ink-2', 3.6));
      s.alpha(at(s, 'exact', 0.15), () => rich(s, [['(227 − 11) / 4 + 1 = ', '--ink-2'], ['55', 'gold']], s.w / 2, y3, { size: 3.8, weight: 650 }));
    });
    cite(s, 'AlexNet · Krizhevsky, Sutskever & Hinton, 2012', alex);
  },
};

export const scenes: Record<string, SceneDef> = { shrink, pad, stride, fit };
