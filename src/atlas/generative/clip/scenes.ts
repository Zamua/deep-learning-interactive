import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { block, caption, fmt, PICS, picture, rich } from '../draw';

const rad = (a: number) => (a * Math.PI) / 180;

/** An arrow from the circle's center at `deg` degrees, `len` radii long, with an optional label past its tip. */
function spoke(s: Scene, cx: number, cy: number, r: number, deg: number, k: Ink, o: { len?: number; label?: string; lw?: number; gap?: number; italic?: boolean } = {}) {
  const len = o.len ?? 1;
  const x = cx + r * len * Math.cos(rad(deg));
  const y = cy - r * len * Math.sin(rad(deg));
  s.arrow(cx, cy, x, y, s.c(k), o.lw ?? 0.55, 2.2);
  if (!o.label) return;
  const g = (o.gap ?? 4) * s.u;
  const c = Math.cos(rad(deg));
  const align = c > 0.3 ? 'left' : c < -0.3 ? 'right' : 'center';
  s.text(o.label, x + g * c, y - g * Math.sin(rad(deg)), { size: 3.1, font: o.italic ? 'serif' : 'mono', italic: o.italic, weight: o.italic ? 500 : 650, align, color: s.c(k), halo: true });
}

/** The unit circle and its center. */
function ring(s: Scene, cx: number, cy: number, r: number) {
  s.circle(cx, cy, r, { stroke: s.c('--axis'), lw: 0.3 });
  s.line(cx - r - 2 * s.u, cy, cx + r + 2 * s.u, cy, s.tint('--axis', 0.6), 0.2);
  s.line(cx, cy - r - 2 * s.u, cx, cy + r + 2 * s.u, s.tint('--axis', 0.6), 0.2);
  s.circle(cx, cy, 0.7 * s.u, { fill: s.c('--ink-3') });
}

// ---- scene 1: a classifier keeps one learned row per class; a new class needs a new row

const CLASSES = ['tree', 'boat', 'sunset'] as const;
const PIC = { tree: PICS.tree, boat: PICS.boat, sunset: PICS.sun };
const ROWS = [
  [0.9, -0.2, 0.4, 0.1, -0.5],
  [-0.3, 0.8, -0.1, 0.6, 0.2],
  [0.2, 0.1, 0.9, -0.4, 0.7],
];
const ROW_SCORE = [2.4, 0.3, 0.9];
const KITE = [0.5, 0.7, -0.2, 0.3, -0.6];

const rows: SceneDef = {
  draw(s) {
    const u = s.u;
    const n = 5;
    const pitch = 7.6 * u;
    const cw = 7 * u;
    // Row names, then the row's weights, then whatever the beat shows beside them.
    const total = 16 * u + n * pitch + 34 * u;
    const x0 = (s.w - total) / 2;
    const nameX = x0 + 14 * u;
    const cell0 = x0 + 16 * u;
    const side = cell0 + n * pitch + 4 * u;
    const ys = [0.36, 0.5, 0.64, 0.8].map((f) => s.h * f);
    const lab = s.ease('labels', 0.6);
    const kite = s.ease('kite', 0.6);
    const words = s.ease('words', 0.8, 2.5);
    // The image being scored.
    s.alpha(1 - lab, () => {
      picture(s, s.w / 2 - 12 * u, s.h * 0.14, 0.75, PICS.tree);
      rich(s, [['x', 'orange'], [': an image', '--ink-2']], s.w / 2 - 2 * u, s.h * 0.14, { size: 3.4, weight: 650, align: 'left' });
    });
    s.alpha(lab, () => caption(s, 'W: learned from labeled photos', s.h * 0.14, '--ink-2', 3.3));
    s.text('W', cell0 + ((n - 1) / 2) * pitch, ys[0]! - 8.5 * u, { size: 4, font: 'mono', weight: 700, color: s.c('blue') });
    const rowsShown = [...CLASSES, 'kite'];
    rowsShown.forEach((name, k) => {
      const isKite = k === 3;
      s.alpha(isKite ? kite : 1, () => {
        const y = ys[k]!;
        s.text(name, nameX, y, { size: 3.3, font: 'mono', weight: 650, align: 'right', color: s.c(isKite ? (words > 0.5 ? 'teal' : 'red') : '--ink') });
        for (let j = 0; j < n; j++) {
          const x = cell0 + j * pitch;
          if (isKite) {
            s.alpha(1 - words, () => {
              s.rrect(x, y - cw / 2, cw, cw, 1, { stroke: s.c('red'), lw: 0.3 });
              s.text('?', x + cw / 2, y, { size: 3, font: 'mono', color: s.c('red') });
            });
            s.alpha(words, () => s.cell(x, y - cw / 2, cw, cw, fmt(KITE[j]!), 'teal', { size: 2.5 }));
          } else s.cell(x, y - cw / 2, cw, cw, fmt(ROWS[k]![j]!), 'blue', { size: 2.5, on: s.win('rows', 'labels') * (k === 0 ? 1 : 0) });
        }
        // Beside the row: its score for x, then where its weights came from.
        if (!isKite)
          s.alpha(1 - lab, () => {
            s.text('· x', side, y, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
            const bw = (ROW_SCORE[k]! / 2.4) * 18 * u * s.ease('rows', 0.8, 1.5);
            s.rrect(side + 8 * u, y - 1.8 * u, Math.max(bw, 0.4 * u), 3.6 * u, 0.5, { fill: s.tint('purple', 0.45), stroke: s.c('purple'), lw: 0.2 });
          });
        s.alpha(lab, () => {
          if (isKite) {
            s.alpha(1 - words, () => {
              for (let q = 0; q < 3; q++) {
                const px = side + q * 7 * u;
                s.rrect(px, y - 3 * u, 6 * u, 6 * u, 0.6, { stroke: s.c('red'), lw: 0.25 });
              }
              s.text('none yet', side + 22 * u, y, { size: 2.8, font: 'mono', align: 'left', color: s.c('red') });
            });
          } else {
            for (let q = 0; q < 3; q++) picture(s, side + 3 * u + q * 7 * u, y, 0.36, PIC[CLASSES[k]!]);
            s.text(`"${name}"`, side + 22 * u, y, { size: 2.8, font: 'mono', align: 'left', color: s.c('gold') });
            s.arrow(side - 0.5 * u, y, side - 3.2 * u, y, s.c('--ink-3'), 0.3, 1.2);
          }
        });
      });
    });
    // The kite's row, written from words.
    s.alpha(s.ease('words', 0.6, 0.6), () => {
      const y = s.h * 0.92;
      const t = '"a photo of a kite"';
      const tw = s.measure(t, { size: 3.2, font: 'serif', italic: true });
      const x = s.w / 2 - (tw + 22 * u) / 2;
      s.text(t, x, y, { size: 3.2, font: 'serif', italic: true, align: 'left', color: s.c('teal') });
      s.arrow(x + tw + 1 * u, y, x + tw + 5 * u, y, s.c('--ink-3'), 0.3, 1.4);
      block(s, x + tw + 13 * u, y, 14, 6.5, 'txt_enc', 'teal', { size: 2.9 });
      s.arrow(x + tw + 13 * u, y - 3.6 * u, x + tw + 13 * u, ys[3]! + cw / 2 + 1 * u, s.c('teal'), 0.35, 1.4);
    });
    s.alpha(s.win('rows', 'labels'), () => caption(s, 'scores = W @ x: one dot product per row', s.h * 0.92, 'purple', 3.3));
    s.alpha(s.win('kite', 'words'), () => caption(s, 'a new class: gather, label, train again', s.h * 0.92, 'red', 3.3));
  },
};

// ---- scene 2: two encoders, unit vectors, and similarity as the dot product

const IMG_DEG = (Math.atan2(0.8, 0.6) * 180) / Math.PI;
const TXT_DEG = (Math.atan2(0.6, 0.8) * 180) / Math.PI;

const space: SceneDef = {
  draw(s) {
    const u = s.u;
    const r = Math.min(s.h * 0.3, s.w * 0.27);
    const cx = s.w * 0.64;
    const cy = s.h * 0.48;
    const lx = s.w * 0.17;
    const imgY = s.h * 0.24;
    const capY = s.h * 0.66;
    // The photo and its caption, each through its encoder.
    picture(s, lx, imgY, 0.8, PICS.tree);
    s.text('"a tree on a hill"', lx, capY, { size: 3.1, font: 'serif', italic: true, color: s.c('--ink-2') });
    const enc = s.ease('img', 0.6, 1.2);
    s.alpha(enc, () => {
      block(s, lx, imgY + 14 * u, 14, 9, 'img_enc', 'orange', { size: 2.9, sub: 'out: z' });
      block(s, lx, capY + 10 * u, 14, 9, 'txt_enc', 'teal', { size: 2.9, sub: 'out: t' });
    });
    const unit = s.ease('unit', 1.2, 0.4);
    const goal = after(s, 'sim', 0.6);
    s.alpha(s.ease('img', 0.6, 2.5), () => {
      ring(s, cx, cy, r);
      spoke(s, cx, cy, r, IMG_DEG, 'orange', { len: lerp(1.35, 1, unit), label: 'z', gap: 3 });
      spoke(s, cx, cy, r, TXT_DEG, 'teal', { len: lerp(0.6, 1, unit), label: 't', gap: 3 });
    });
    s.alpha(s.win('unit', 'sim'), () => caption(s, 'scaled to length 1: only direction counts', s.h * 0.93, '--ink-2', 3.3));
    s.alpha(s.ease('sim', 0.6) * (1 - goal), () => rich(s, [['z', 'orange'], [' · ', '--ink-2'], ['t', 'teal'], [' = 0.6·0.8 + 0.8·0.6 = 0.96', '--ink-2']], s.w / 2, s.h * 0.93, { size: 3.2, weight: 600 }));
    s.alpha(goal, () => caption(s, 'own caption: toward; the rest: away', s.h * 0.93, '--ink-2', 3.2));
    s.alpha(s.ease('sim', 0.6), () => {
      const c = s.ctx;
      c.beginPath();
      c.arc(cx, cy, r * 0.35, -rad(IMG_DEG), -rad(TXT_DEG));
      c.strokeStyle = s.c('purple');
      c.lineWidth = 0.4 * u;
      c.stroke();
    });
    // Other captions: pushed away, while the photo's own is pulled in.
    s.alpha(goal, () => {
      spoke(s, cx, cy, r, -40, 'red', { label: 'a boat', italic: true, lw: 0.4, gap: 3 });
      spoke(s, cx, cy, r, 235, 'red', { label: 'a sunset', italic: true, lw: 0.4, gap: 3 });
    });
  },
};

// ---- scene 3: a batch's grid of similarities, trained so each image picks its own caption

const KINDS = ['tree', 'boat', 'sun'] as const;
const CAPS = ['a tree on a hill', 'a boat at sea', 'sunset over the sea'];
const SHORT = ['tree', 'boat', 'sunset'];
const SIM = [
  [0.8, 0.1, 0.3],
  [0.2, 0.7, 0.1],
  [0.3, 0.2, 0.9],
];

/** The 3 by 3 grid centered on (gx, gy), `cell` stage units per cell, images down the left and captions across the top. */
function grid(s: Scene, gx: number, gy: number, cell: number, on: (i: number, j: number) => number, ink: (i: number, j: number) => Ink, a: (i: number, j: number) => number = () => 1): void {
  const u = s.u;
  const p = cell * u;
  for (let i = 0; i < 3; i++) {
    picture(s, gx - 1.5 * p - 0.75 * 8 * u - 2 * u, gy + (i - 1) * p, 0.75, PICS[KINDS[i]!]);
    s.text(SHORT[i]!, gx + (i - 1) * p, gy - 1.5 * p - 3 * u, { size: 3, font: 'mono', color: s.c('teal') });
    for (let j = 0; j < 3; j++) s.alpha(a(i, j), () => s.cell(gx + (j - 1.5) * p + 0.4 * u, gy + (i - 1.5) * p + 0.4 * u, p - 0.8 * u, p - 0.8 * u, fmt(SIM[i]![j]!), ink(i, j), { on: on(i, j), size: Math.min(3.4, cell * 0.3) }));
  }
}

const train: SceneDef = {
  draw(s) {
    const u = s.u;
    const pairs = 1 - s.ease('sim', 0.6);
    // The pairs, as they came from the web.
    s.alpha(pairs, () => {
      const ys = [0.2, 0.36, 0.52].map((f) => s.h * f);
      KINDS.forEach((k, i) => {
        s.alpha(s.ease('web', 0.5, 0.3 * i), () => {
          picture(s, s.w * 0.22, ys[i]!, 0.75, PICS[k]);
          s.text(`"${CAPS[i]}"`, s.w * 0.22 + 9 * u, ys[i]!, { size: 3.1, font: 'serif', italic: true, align: 'left', color: s.c('--ink-2') });
        });
      });
      s.alpha(s.win('web', 'batch') * after(s, 'web', 0.55), () => caption(s, '400 million image and text pairs', s.h * 0.72, '--ink', 3.4, { weight: 650 }));
      s.alpha(s.ease('batch', 0.6), () => caption(s, 'a batch: N = 3 pairs', s.h * 0.66, '--ink', 3.4, { weight: 650 }));
    });
    const gx = s.w / 2 + 5 * u;
    const gy = s.h * 0.44;
    const cell = 12;
    const p = cell * u;
    const gridA = s.ease('sim', 0.6);
    const d = s.ease('diag', 0.6);
    const r = s.win('rows', 'cols');
    const c = s.win('cols', 'count');
    const k = s.ease('count', 0.6);
    // The batch: encoders' outputs, then the grid of every image with every caption.
    s.alpha(s.win('batch', 'sim'), () => {
      rich(s, [['z', 'orange'], [': (N, d), one row per image', '--ink-2']], s.w / 2, s.h * 0.76, { size: 3.3, weight: 600 });
      rich(s, [['t', 'teal'], [': (N, d), one row per caption', '--ink-2']], s.w / 2, s.h * 0.84, { size: 3.3, weight: 600 });
    });
    s.alpha(gridA, () => {
      grid(
        s,
        gx,
        gy,
        cell,
        (i, j) => (i === j ? d : 0) + (i === 0 ? 0.6 * r : 0) + (j === 0 ? 0.6 * c : 0),
        (i, j) => (i === j ? (d > 0.3 ? 'green' : 'slate') : r * (i === 0 ? 1 : 0) + c * (j === 0 ? 1 : 0) + k > 0.3 ? 'red' : 'slate'),
        (i, j) => s.ease('sim', 0.4, 0.8 + 0.12 * (i * 3 + j)),
      );
      const o = { size: 3.1, font: 'mono', weight: 650, halo: true } as const;
      // The label of each row: the column of its own caption.
      s.alpha(d * (1 - k), () => {
        for (let i = 0; i < 3; i++) s.text(`label ${i}`, gx + 1.5 * p + 2 * u, gy + (i - 1) * p, { ...o, align: 'left', color: s.c('green') });
      });
      s.alpha(r, () => s.rrect(gx - 1.5 * p - 0.2 * u, gy - 1.5 * p - 0.2 * u, 3 * p + 0.4 * u, p + 0.4 * u, 1, { stroke: s.c('purple'), lw: 0.5 }));
      s.alpha(c, () => s.rrect(gx - 1.5 * p - 0.2 * u, gy - 1.5 * p - 0.2 * u, p + 0.4 * u, 3 * p + 0.4 * u, 1, { stroke: s.c('purple'), lw: 0.5 }));
      // Up on the diagonal, down everywhere else.
      s.alpha(k, () => {
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) {
            const x = gx + (j - 1) * p + p * 0.32;
            const y = gy + (i - 1) * p - p * 0.22;
            const up = i === j;
            s.arrow(x, y + (up ? 1.2 : -1.2) * u, x, y + (up ? -1.2 : 1.2) * u, s.c(up ? 'green' : 'red'), 0.3, 1.1);
          }
      });
    });
    const cy = s.h * 0.84;
    const cy2 = s.h * 0.91;
    s.alpha(s.win('sim', 'diag'), () => rich(s, [['z', 'orange'], [' @ ', '--ink-2'], ['t', 'teal'], ['.T: every image · every caption', '--ink-2']], s.w / 2, cy, { size: 3.2, weight: 600 }));
    s.alpha(s.win('sim', 'diag'), () => caption(s, '(N, d) @ (d, N) = (N, N)', cy2, '--ink-3', 3.2));
    s.alpha(s.win('diag', 'rows'), () => caption(s, 'right pairs on the diagonal', cy, 'green', 3.3));
    s.alpha(r, () => {
      caption(s, 'row 0: softmax over captions, pick 0', cy, 'purple', 3.2);
      caption(s, 'negatives in the row: N − 1 = 2', cy2, 'red', 3.2);
    });
    s.alpha(c, () => caption(s, 'column 0: each caption picks its image', cy, 'purple', 3.2));
    s.alpha(s.win('count', 'big'), () => {
      rich(s, [['3', 'green'], [' up, ', '--ink-2'], ['6', 'red'], [' down', '--ink-2']], s.w / 2, cy, { size: 3.4, weight: 650 });
      caption(s, 'negatives: N² − N = 9 − 3 = 6', cy2, '--ink-3', 3.2);
    });
    s.alpha(s.win('big', 'name'), () => {
      caption(s, 'N = 32,768 pairs per batch', cy, '--ink', 3.3, { weight: 650 });
      caption(s, 'N − 1 = 32,767 negatives per row', cy2, 'red', 3.2);
    });
    s.alpha(s.ease('name', 0.6), () => {
      const runs: [string, Ink][] = [['C', 'purple'], ['ontrastive ', '--ink-2'], ['L', 'purple'], ['anguage-', '--ink-2'], ['I', 'purple'], ['mage ', '--ink-2'], ['P', 'purple'], ['re-training', '--ink-2']];
      s.text('CLIP', s.w / 2, cy - 7 * u, { size: 5, font: 'mono', weight: 700, color: s.c('purple') });
      rich(s, runs, s.w / 2, cy2, { size: 3.3, weight: 650 });
    });
    cite(s, 'Radford et al., OpenAI, 2021', s.win('web', 'batch'));
  },
};

// ---- scene 4: zero-shot classification, one caption per class

const ZS = [
  { name: 'tree', v: [0.8, 0.6] },
  { name: 'boat', v: [1, 0] },
  { name: 'sunset', v: [0, -1] },
];
const Z = [0.6, 0.8];
const SCORE = ZS.map(({ v }) => v[0]! * Z[0]! + v[1]! * Z[1]!);
const deg = (v: number[]) => (Math.atan2(v[1]!, v[0]!) * 180) / Math.PI;

const zeroshot: SceneDef = {
  draw(s) {
    const u = s.u;
    const r = Math.min(s.h * 0.22, s.w * 0.19);
    const cx = s.w * 0.25;
    const cy = s.h * 0.47;
    const lx = s.w * 0.57;
    const ys = [0.3, 0.43, 0.56].map((f) => s.h * f);
    const em = s.ease('embed', 0.6, 0.6);
    const pick = after(s, 'rest', 0.75);
    const pr = s.win('prompt', 'embed');
    // One caption per class, with its score once computed.
    ZS.forEach(({ name }, i) => {
      s.alpha(s.ease('names', 0.5, 2 + 0.6 * i), () => {
        const win = i === 0 ? pick : 0;
        const pre = 'a photo of a ';
        const pw = s.measure(pre, { size: 3.1, font: 'serif', italic: true });
        s.rrect(lx - 1.5 * u, ys[i]! - 3.8 * u, s.w - lx - 3.5 * u, 7.6 * u, 1, { fill: s.tint(win > 0.5 ? 'green' : 'teal', 0.06 + 0.16 * win), stroke: s.tint(win > 0.5 ? 'green' : 'teal', 0.4 + 0.6 * win), lw: 0.3 });
        s.text(pre, lx, ys[i]!, { size: 3.1, font: 'serif', italic: true, align: 'left', color: s.c(pr > 0.5 ? 'gold' : '--ink-2') });
        s.text(name, lx + pw, ys[i]!, { size: 3.1, font: 'serif', italic: true, weight: 650, align: 'left', color: s.c('teal') });
        const shown = i === 0 ? after(s, 'tree', 0.8) : s.ease('rest', 0.5, 0.3 + 1.6 * (i - 1));
        s.alpha(shown, () => s.text(fmt(SCORE[i]!), s.w - 5.5 * u, ys[i]!, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c(i === 0 && win > 0.5 ? 'green' : 'purple') }));
      });
    });
    // The photo to classify, until it becomes an arrow on the circle.
    s.alpha(1 - em, () => {
      picture(s, cx, cy - 2 * u, 1.1, PICS.tree);
      s.text('the photo to classify', cx, cy + 12 * u, { size: 3, font: 'mono', color: s.c('orange') });
    });
    // The circle: the photo's arrow and the three captions'.
    s.alpha(em, () => {
      ring(s, cx, cy, r);
      ZS.forEach(({ name, v }, i) => s.alpha(s.ease('embed', 0.5, 0.9 + 0.3 * i), () => spoke(s, cx, cy, r, deg(v), i === 0 && pick > 0.5 ? 'green' : 'teal', { label: name, gap: 3 })));
      spoke(s, cx, cy, r, deg(Z), 'orange', { lw: 0.7 });
      const tip = [cx + r * Z[0]!, cy - r * Z[1]!];
      picture(s, tip[0]! - 5 * u, tip[1]! - 4 * u, 0.35, PICS.tree);
      s.alpha(after(s, 'embed', 0.6), () => s.text('[0.6, 0.8]', cx - r - 1 * u, cy - r - 1 * u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('orange'), halo: true }));
    });
    const cy1 = s.h * 0.78;
    const cy2 = s.h * 0.86;
    const cy3 = s.h * 0.93;
    s.alpha(s.win('names', 'prompt') * after(s, 'names', 0.3), () => caption(s, 'one caption per class, no labeled photos', cy2, '--ink-2', 3.2));
    s.alpha(pr, () => caption(s, 'web text is rarely a single word', cy2, 'gold', 3.2));
    s.alpha(s.win('tree', 'rest'), () => caption(s, '0.6·0.8 + 0.8·0.6 = 0.96', cy2, 'purple', 3.4, { weight: 650 }));
    s.alpha(s.win('rest', 'W') * pick, () => caption(s, 'argmax: tree', cy2, 'green', 3.4, { weight: 650 }));
    // The caption vectors as the rows of a classifier's W.
    s.alpha(s.win('W', 'zero'), () => {
      rich(s, [['t', 'teal'], [' = [[0.8, 0.6], [1, 0], [0, −1]]', '--ink-2']], s.w / 2, cy1, { size: 3.1, weight: 600 });
      rich(s, [['scores = ', '--ink-2'], ['t', 'teal'], [' @ ', '--ink-2'], ['z', 'orange'], [': W @ x, no b', '--ink-2']], s.w / 2, cy2, { size: 3.2, weight: 600 });
    });
    s.alpha(s.win('many', 'zero'), () => caption(s, '(M, d) @ (d, 3) = (M, 3): row per image', cy3, '--ink-3', 3.1));
    s.alpha(s.win('zero', 'imagenet'), () => caption(s, 'zero examples of any class: zero-shot', cy2, 'green', 3.3, { weight: 650 }));
    s.alpha(s.ease('imagenet', 0.6), () => {
      caption(s, 'ImageNet, 1,000 classes: matched a network', cy2, '--ink-2', 3.1);
      caption(s, 'trained on 1.28 million labeled photos', cy3, '--ink-2', 3.1);
    });
    cite(s, 'Radford et al., 2021', s.win('prompt', 'embed') + s.ease('imagenet', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { rows, space, train, zeroshot };
