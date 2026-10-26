import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import { block, caption, type Ink, PICS, picture } from '../../generative/draw';
import { chips, row, rowWidth } from '../../post-training/draw';

type RGB = [number, number, number];

/** A 24 by 24 picture, one color per patch: sky, sun, hills and a house. */
const IMG24: string[][] = Array.from({ length: 24 }, (_, i) =>
  Array.from({ length: 24 }, (_, j) => {
    const hill = 15.5 + 2.2 * Math.cos((j - 4) / 3.8) + (j > 13 ? 1.1 * Math.sin((j - 13) / 2.3) : 0);
    let c: RGB;
    if (i > hill) c = i > 20 ? [70, 135, 60] : [92, 160, 78];
    else if (j >= 4 && j <= 8 && i >= 11 && i <= hill + 1) c = i < 13 ? [150, 60, 50] : j === 6 && i >= 14 ? [90, 60, 40] : [205, 95, 70];
    else if (Math.hypot(i - 4.5, j - 15) < 2.8) c = [250, 205, 70];
    else c = [Math.round(105 + 4.5 * i), Math.round(165 + 3 * i), Math.round(230 + 1 * i)];
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }),
);

/** A fixed pseudo-random strip pattern, `n` values in [0, 1]. */
const pattern = (n: number, seed: number) => Array.from({ length: n }, (_, i) => 0.5 + 0.45 * Math.sin(i * 2.1 + seed) * Math.cos(i * 0.7 + seed * 1.3));
const SHORT = pattern(24, 1);
const LONG = pattern(64, 2);

/** A vector drawn as a thin striped bar, `w` stage units long, centered on (cx, cy). */
function strip(s: Scene, cx: number, cy: number, w: number, vals: number[], k: Ink, o: { h?: number; upto?: number } = {}): void {
  const h = (o.h ?? 3.4) * s.u;
  const seg = (w * s.u) / vals.length;
  const l = cx - (w * s.u) / 2;
  const shown = Math.floor(vals.length * clamp01(o.upto ?? 1));
  for (let i = 0; i < shown; i++) {
    s.ctx.fillStyle = s.tint(k, 0.15 + 0.75 * vals[i]!);
    s.ctx.fillRect(l + i * seg, cy - h / 2, seg + 0.4, h);
  }
  s.rrect(l, cy - h / 2, w * s.u, h, 0.4, { stroke: s.tint(k, 0.8), lw: 0.25 });
}

const mono = (size: number, k: string, o: { align?: CanvasTextAlign; weight?: number } = {}) => ({ size, font: 'mono' as const, weight: o.weight ?? 600, align: o.align, color: k, halo: true });

const patches: SceneDef = {
  draw(s) {
    const u = s.u;
    const px = s.tall ? 1.55 : 1.7;
    const side = 24 * px * u;
    const cx = s.w / 2 - (s.tall ? 27 : 32) * u;
    const cy = s.h * 0.4;
    const g = picture(s, cx, cy, px, IMG24);
    const cut = s.ease('count', 0.8);
    s.alpha(cut * 0.85, () => {
      for (let k = 1; k < 24; k++) {
        s.line(g.l + k * g.p, g.t, g.l + k * g.p, g.t + side, s.tint('--card', 0.7), 0.12);
        s.line(g.l, g.t + k * g.p, g.l + side, g.t + k * g.p, s.tint('--card', 0.7), 0.12);
      }
    });
    s.rrect(g.l, g.t, side, side, 0.4, { stroke: s.c('--ink-3'), lw: 0.3 });
    const ly = g.t + side + 5 * u;
    s.text('336 × 336 pixels', cx, ly, mono(3.5, s.c('orange')));
    s.alpha(s.ease('count', 0.6), () => s.text('patches of 14 × 14', cx, ly + 6.5 * u, mono(3.3, s.c('slate'))));
    s.alpha(s.ease('count', 0.6, 1.4), () => s.text('336 / 14 = 24 per side', cx, ly + 13 * u, mono(3.3, s.c('--ink-2'))));
    s.alpha(s.ease('count', 0.6, 3), () => s.text('24 × 24 = 576 patches', cx, ly + 19.5 * u, mono(3.5, s.c('blue'), { weight: 700 })));

    // The vision transformer and its output: one vector per patch, plus the class token.
    const rx = s.w / 2 + (s.tall ? 25 : 30) * u;
    const by = s.h * 0.12;
    const va = s.ease('vit', 0.6);
    s.alpha(va, () => {
      const half = (s.measure('vision transformer', { size: 3.4, font: 'mono', weight: 650 }) / u + 5) / 2;
      s.arrow(g.l + side + 1.5 * u, g.t + 4 * u, rx - (half + 1.5) * u, by, s.c('--ink-3'), 0.35, 2);
      block(s, rx, by, 28, 11, 'vision transformer', 'blue', { sub: 'already trained', size: 3.4, on: s.win('vit', 'drop') });
    });
    const rows = ['cls', '0', '1', '2', '⋮', '575'];
    const top = s.h * 0.32;
    const pitch = 7.4 * u;
    const drop = s.ease('drop', 0.8);
    const sw = 26;
    s.alpha(s.ease('vit', 0.6, 0.8), () => {
      s.arrow(rx, by + 6.5 * u, rx, top - 7.5 * u, s.c('--ink-3'), 0.35, 2);
      s.text('1,024 numbers each', rx, top - 4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      rows.forEach((r, i) => {
        const y = top + 1.5 * u + i * pitch;
        const cls = i === 0;
        if (r === '⋮') {
          s.text('⋮', rx, y, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
          return;
        }
        s.alpha(cls ? 1 - 0.75 * drop : 1, () => {
          strip(s, rx, y, sw, pattern(24, i + 3), cls ? 'purple' : 'orange');
          s.text(r, rx - (sw / 2 + 2) * u, y, mono(2.8, s.c(cls ? 'purple' : '--ink-3'), { align: 'right' }));
        });
        if (cls) s.alpha(drop, () => s.line(rx - (sw / 2 + 1) * u, y, rx + (sw / 2 + 1) * u, y, s.c('red'), 0.5));
      });
      const sy = top + 1.5 * u + rows.length * pitch + 1 * u;
      s.alpha(1 - drop, () => s.text('(577, 1,024)', rx, sy, mono(3.3, s.c('orange'))));
      s.alpha(drop, () => s.text('(576, 1,024)', rx, sy, mono(3.3, s.c('orange'), { weight: 700 })));
    });
  },
};

const IMG_TOK = ['img 0', 'img 1', '⋯', 'img 575'];
const TEXT_TOK = ['What', 'is', 'this', '?'];

const project: SceneDef = {
  draw(s) {
    const u = s.u;
    const y0 = s.h * 0.15;
    const lx = s.w / 2 - (s.tall ? 36 : 40) * u;
    const mx = s.w / 2 - (s.tall ? 4 : 6) * u;
    const rx = s.w / 2 + (s.tall ? 31 : 34) * u;
    const lw = 10;
    const rw = s.tall ? 34 : 40;
    // The patch vector and a word vector: different lengths.
    strip(s, lx, y0, lw, SHORT, 'orange');
    s.text('patch: 1,024', lx, y0 + 5.5 * u, mono(2.9, s.c('orange')));
    const wa = s.ease('W', 0.6);
    s.alpha(s.ease('width', 0.6), () => {
      strip(s, rx, y0, rw, LONG, 'gold');
      s.alpha(1 - wa, () => s.text('word: d = 4,096', rx, y0 + 5.5 * u, mono(2.9, s.c('gold'))));
      s.alpha(1 - wa, () => s.text('different lengths', (lx + (lw / 2) * u + rx - (rw / 2) * u) / 2, y0, mono(2.9, s.c('red'))));
    });
    s.alpha(wa, () => {
      s.arrow(lx + (lw / 2 + 1.5) * u, y0, mx - 13 * u, y0, s.c('--ink-3'), 0.35, 2);
      block(s, mx, y0, 22, 9, 'W, b', 'blue', { sub: '1,024 × 4,096', size: 3.4, on: s.win('W', 'mlp') });
      s.arrow(mx + 13 * u, y0, rx - (rw / 2 + 1.5) * u, y0, s.c('--ink-3'), 0.35, 2);
      s.text('image token: 4,096', rx, y0 + 5.5 * u, mono(2.9, s.c('gold')));
    });
    const cy = s.h * 0.36;
    const off = 1 - s.ease('prompt', 0.6);
    s.alpha(s.ease('count', 0.6) * off, () => caption(s, '1,024 × 4,096 + 4,096 = 4,198,400', cy, 'blue', 3.4, { weight: 650 }));
    s.alpha(s.ease('count', 0.6, 1.6) * off, () => caption(s, 'shared by all 576 patches', cy + 7 * u, '--ink-3', 3.2));
    s.alpha(s.ease('mlp', 0.6) * off, () => caption(s, 'or an MLP: map, activation, map', cy + 14 * u, '--ink-2', 3.2));

    // The prompt: image tokens first, then the text.
    const toks = [...IMG_TOK, ...TEXT_TOK];
    const size = s.tall ? 2.9 : 3.2;
    const gap = 1.2;
    const width = rowWidth(s, toks, size, gap);
    const r = row(s, toks, s.w / 2 - width / 2, size, gap);
    const py = s.h * 0.7;
    const pa = s.ease('prompt', 0.6);
    s.alpha(pa, () => {
      chips(s, toks, r, py, (i) => (i < IMG_TOK.length ? 'gold' : 'purple'), { size, h: 6.4, a: (i) => clamp01(pa * 8 - i * 0.6) });
      s.text('image tokens', (r.xs[0]! + r.xs[IMG_TOK.length - 1]!) / 2, py + 6.5 * u, { size: 2.7, font: 'mono', color: s.c('gold') });
      s.text('text', (r.xs[IMG_TOK.length]! + r.xs[toks.length - 1]!) / 2, py + 6.5 * u, { size: 2.7, font: 'mono', color: s.c('purple') });
    });
    // A text token attends back to the image tokens.
    const ra = s.ease('read', 0.8);
    s.alpha(ra, () => {
      const from = r.xs[IMG_TOK.length + 2]!;
      for (const k of [0, 1, 3]) {
        const to = r.xs[k]!;
        const mid = (from + to) / 2;
        const lift = (3 + Math.abs(from - to) / u / 10) * u;
        const c = s.ctx;
        c.beginPath();
        c.moveTo(from, py - 3.6 * u);
        c.quadraticCurveTo(mid, py - 3.6 * u - lift * 2, to, py - 3.6 * u);
        c.strokeStyle = s.tint('purple', 0.75);
        c.lineWidth = 0.3 * u;
        c.stroke();
      }
      s.text('attends to every image token', s.w / 2, s.h * 0.47, { size: 3.2, font: 'mono', color: s.c('purple'), halo: true });
      s.text('decoder-only model → reply, one token at a time', s.w / 2, s.h * 0.88, { size: s.tall ? 3 : 3.2, font: 'mono', color: s.c('--ink-2'), halo: true });
    });
  },
};

/** The three parts in a row, each frozen or training; `on` lights the ones that train. */
function parts(s: Scene, y: number, trains: [number, number, number]): void {
  const u = s.u;
  const xs = [s.w / 2 - (s.tall ? 34 : 40) * u, s.w / 2, s.w / 2 + (s.tall ? 34 : 40) * u];
  const names: [string, string][] = [['vision', 'transformer'], ['projection', 'W, b'], ['language', 'model']];
  const w = s.tall ? 29 : 32;
  xs.forEach((x, i) => {
    const t = trains[i]!;
    const k: Ink = t > 0.5 ? 'green' : 'slate';
    s.rrect(x - (w / 2) * u, y - 7 * u, w * u, 14 * u, 1.6, { fill: s.tint(k, 0.1 + 0.18 * t), stroke: s.tint(k, 0.5 + 0.5 * t), lw: 0.35 + 0.2 * t });
    s.text(names[i]![0], x, y - 2.4 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c(k) });
    s.text(names[i]![1], x, y + 2.6 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c(k) });
    s.text(t > 0.5 ? 'learns' : 'frozen', x, y + 11 * u, { size: 3, font: 'mono', weight: 600, color: s.c(t > 0.5 ? 'green' : '--ink-3') });
  });
  s.arrow(xs[0]! + (w / 2 + 0.6) * u, y, xs[1]! - (w / 2 + 0.6) * u, y, s.c('--ink-3'), 0.35, 1.6);
  s.arrow(xs[1]! + (w / 2 + 0.6) * u, y, xs[2]! - (w / 2 + 0.6) * u, y, s.c('--ink-3'), 0.35, 1.6);
}

const CAPTION = ['[576 image tokens]', 'a', 'dog', 'on', 'a', 'beach'];
const QA = ['[576 image tokens]', 'What', 'is', 'he', 'holding', '?', 'A', 'frisbee'];

const train: SceneDef = {
  draw(s) {
    const u = s.u;
    const two = s.ease('s2', 0.8);
    s.alpha(1 - two, () => caption(s, 'stage 1: images with captions', s.h * 0.1, '--ink-2', 3.4, { weight: 650 }));
    s.alpha(two, () => caption(s, 'stage 2: images, questions, answers', s.h * 0.1, '--ink-2', 3.4, { weight: 650 }));
    parts(s, s.h * 0.32, [0, 1, two]);
    const size = s.tall ? 2.6 : 2.9;
    const ty = s.h * 0.68;
    const draw = (toks: string[], from: number, a: number) =>
      s.alpha(a, () => {
        const width = rowWidth(s, toks, size, 1.2);
        const r = row(s, toks, s.w / 2 - width / 2, size, 1.2);
        chips(s, toks, r, ty, (i) => (i === 0 ? 'gold' : i >= from ? 'green' : 'purple'), { size, h: 6.2, on: (i) => (i >= from ? s.ease('loss', 0.6) : 0) });
        s.alpha(s.ease('loss', 0.6, 0.6), () => {
          const x0 = r.xs[from]! - r.ws[from]! / 2;
          const x1 = r.xs[toks.length - 1]! + r.ws[toks.length - 1]! / 2;
          s.line(x0, ty + 5 * u, x1, ty + 5 * u, s.c('green'), 0.35);
          s.text('predicted: next-token loss', Math.min((x0 + x1) / 2, s.w - 4 * u - s.measure('predicted: next-token loss', { size: 2.9, font: 'mono' }) / 2), ty + 9 * u, { size: 2.9, font: 'mono', color: s.c('green'), halo: true });
        });
      });
    draw(CAPTION, 1, s.ease('s1', 0.6, 0.8) * (1 - two));
    draw(QA, 6, two);
    s.alpha(s.ease('loss', 0.6, 1.8) * (1 - two), () => caption(s, 'only W, b can move: they learn the model\'s language', s.h * 0.88, 'blue', 2.9));
  },
};

const BOAT = PICS.boat;

const tryIt: SceneDef = {
  draw(s) {
    const u = s.u;
    // A context bar: image tokens, then what is left for text.
    const bw = (s.tall ? 92 : 104) * u;
    const L = s.w / 2 - bw / 2;
    const bar = (y: number, img: number, labels: [string, string], a: number) =>
      s.alpha(a, () => {
        const hb = 6.5 * u;
        const split = L + (bw * img) / 2048;
        s.rrect(L, y - hb / 2, bw, hb, 1, { fill: s.tint('purple', 0.22), stroke: s.c('purple'), lw: 0.3 });
        s.rrect(L, y - hb / 2, split - L, hb, 1, { fill: s.tint('gold', 0.45), stroke: s.c('gold'), lw: 0.3 });
        s.text(labels[0], L, y + 7 * u, mono(2.9, s.c('gold'), { align: 'left' }));
        s.text(labels[1], L + bw, y + 7 * u, mono(2.9, s.c('purple'), { align: 'right' }));
      });
    const wy = s.h * 0.12;
    s.text('Tₘₐₓ = 2,048 tokens', s.w / 2, wy - 6.5 * u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
    bar(wy, 576, ['image: 576', 'text: 2,048 − 576 = 1,472'], 1);
    // The problem: a 224 by 224 image in 14-pixel patches.
    const px = s.tall ? 1.7 : 1.9;
    const cx = s.w / 2 - (s.tall ? 27 : 32) * u;
    const cy = s.h * 0.5;
    const pa = s.ease('p1', 0.6);
    s.alpha(pa, () => {
      const g = picture(s, cx, cy, px, BOAT);
      const side = 16 * g.p;
      s.alpha(s.ease('a1', 0.8), () => {
        for (let k = 1; k < 16; k++) {
          s.line(g.l + k * g.p, g.t, g.l + k * g.p, g.t + side, s.tint('--card', 0.7), 0.14);
          s.line(g.l, g.t + k * g.p, g.l + side, g.t + k * g.p, s.tint('--card', 0.7), 0.14);
        }
      });
      s.rrect(g.l, g.t, side, side, 0.4, { stroke: s.c('--ink-3'), lw: 0.3 });
    });
    const tx = s.w / 2 - (s.tall ? 8 : 10) * u;
    s.alpha(pa, () => {
      s.text('224 × 224 pixels', tx, cy - 9 * u, mono(3.2, s.c('orange'), { align: 'left' }));
      s.text('patches of 14 × 14', tx, cy - 3 * u, mono(3.1, s.c('slate'), { align: 'left' }));
    });
    s.alpha(s.ease('a1', 0.6, 0.3), () => s.text('224 / 14 = 16 per side', tx, cy + 3 * u, mono(3.1, s.c('--ink-2'), { align: 'left' })));
    s.alpha(s.ease('a1', 0.6, 2.2), () => s.text('16 × 16 = 256 tokens', tx, cy + 9 * u, mono(3.3, s.c('blue'), { align: 'left', weight: 700 })));
    bar(s.h * 0.82, 256, ['image: 256', 'text: 2,048 − 256 = 1,792'], s.ease('a2', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { patches, project, train, try: tryIt };
