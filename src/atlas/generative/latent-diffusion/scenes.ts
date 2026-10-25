import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { block, caption, funnel, PICS, picture, rich, shades, type Ink } from '../draw';

/** The sun picture's colors as numbers, 16 by 16 by 3. */
const RGB = PICS.sun.map((row) => row.map((c) => (/rgb\((\d+),(\d+),(\d+)\)/.exec(c) ?? []).slice(1, 4).map(Number)));

/** A stand-in latent: 8 by 8 spots, 4 numbers each, from 2 by 2 blocks of the picture. */
const LAT: number[][][] = (() => {
  const feats = (i: number, j: number) => {
    const px = [0, 1].flatMap((a) => [0, 1].map((b) => RGB[2 * i + a]![2 * j + b]!));
    const m = [0, 1, 2].map((k) => px.reduce((s, p) => s + p[k]!, 0) / 4);
    const spread = px.reduce((s, p) => s + Math.abs(p[0]! - m[0]!) + Math.abs(p[2]! - m[2]!), 0);
    return [(m[0]! + m[1]! + m[2]!) / 3, m[0]! - m[2]!, m[1]! - (m[0]! + m[2]!) / 2, spread];
  };
  const raw = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => feats(i, j)));
  // Each channel scaled to mean 0, spread 1.
  return [0, 1, 2, 3].map((k) => {
    const vs = raw.flat().map((f) => f[k]!);
    const mu = vs.reduce((a, b) => a + b, 0) / vs.length;
    const sd = Math.sqrt(vs.reduce((a, b) => a + (b - mu) ** 2, 0) / vs.length) || 1;
    return raw.map((r) => r.map((f) => (f[k]! - mu) / sd));
  });
})();
const rng = new Rng(12);
const NOISE = LAT.map((ch) => ch.map((r) => r.map(() => rng.randn())));
const noisy = (ab: number) => LAT.map((ch, k) => ch.map((r, i) => r.map((v, j) => Math.sqrt(ab) * v + Math.sqrt(1 - ab) * NOISE[k]![i]![j]!)));
const ZT = noisy(0.4);
const CH: Ink[] = ['blue', 'gold', 'purple', 'teal'];

/** A latent as 4 stacked 8 by 8 sheets, centered on (cx, cy); returns its half width in px. */
function latent(s: Scene, cx: number, cy: number, cell: number, sheets: number[][][]): number {
  const u = s.u;
  const off = cell * 1.3 * u;
  for (let k = 3; k >= 0; k--) {
    const d = (k - 1.5) * off;
    s.rrect(cx + d - 4 * cell * u, cy - d - 4 * cell * u, 8 * cell * u, 8 * cell * u, 0.3, { fill: s.c('--card') });
    shades(s, cx + d, cy - d, cell, sheets[k]!, CH[k]!, { lo: -2.2, hi: 2.2 });
  }
  return 4 * cell * u + 1.5 * off;
}

/** Centers for items of the given widths (stage units), laid in a row `gap` apart around the middle. */
function row(s: Scene, widths: number[], gap: number): number[] {
  const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  let x = s.w / 2 - (total / 2) * s.u;
  return widths.map((w) => {
    const c = x + (w / 2) * s.u;
    x += (w + gap) * s.u;
    return c;
  });
}

const lab = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;

const squeeze: SceneDef = {
  draw(s) {
    const u = s.u;
    const y = s.h * 0.36;
    const X = (f: number) => s.w * f;
    picture(s, X(0.2), y, 2, PICS.sun);
    s.text('x: 512 × 512 × 3', X(0.2), y + 20 * u, { ...lab, color: s.c('orange') });
    s.text('786,432 numbers', X(0.2), y + 25 * u, { ...lab, size: 3, color: s.c('--ink-2') });
    const en = s.ease('enc', 0.8);
    s.alpha(en, () => funnel(s, X(0.37), X(0.55), y, 30, 14, 'blue', 'encoder', s.win('enc', 'count')));
    s.alpha(s.ease('enc', 0.6, 1.2), () => {
      latent(s, X(0.75), y, 1.6, LAT);
      s.text('z: 64 × 64 × 4', X(0.75), y + 20 * u, { ...lab, color: s.c('green') });
    });
    const ct = s.ease('count', 0.6);
    s.alpha(ct, () => {
      s.text('16,384 numbers', X(0.75), y + 25 * u, { ...lab, size: 3, color: s.c('--ink-2') });
      caption(s, 'sides 8× shorter: 64× fewer spots', s.h * 0.8, '--ink-2', 3.2);
    });
    s.alpha(s.ease('count', 0.6, 3), () => rich(s, [['64 × 3 / 4 = ', '--ink-2'], ['48× fewer numbers', 'green']], s.w / 2, s.h * 0.88, { size: 3.4, weight: 650, halo: true }));
  },
};

const train: SceneDef = {
  draw(s) {
    const u = s.u;
    const y1 = s.h * 0.22;
    const [px, en, lz, de, ph] = row(s, [12.8, 18.4, 10, 18.4, 12.8], 5);
    const arrow = (a: number, b: number, y: number) => s.arrow(a + 1 * u, y, b - 1 * u, y, s.c('--ink-3'), 0.3, 1.6);
    const ae = s.ease('ae', 0.6);
    s.alpha(ae, () => {
      picture(s, px!, y1, 0.8, PICS.sun);
      s.text('x', px!, y1 + 9.5 * u, { ...lab, color: s.c('orange') });
      arrow(px! + 6.4 * u, en! - 9.2 * u, y1);
      block(s, en!, y1, 18, 9, 'encoder', 'blue', { size: 3.2, on: s.win('ae', 'dn') });
      arrow(en! + 9.2 * u, lz! - 5 * u, y1);
      latent(s, lz!, y1, 0.8, LAT);
      s.text('z', lz!, y1 + 9.5 * u, { ...lab, color: s.c('green') });
      arrow(lz! + 5 * u, de! - 9.2 * u, y1);
      block(s, de!, y1, 18, 9, 'decoder', 'purple', { size: 3.2, on: s.win('ae', 'dn') });
      arrow(de! + 9.2 * u, ph! - 6.4 * u, y1);
      picture(s, ph!, y1, 0.8, PICS.sun);
      s.text('x̂', ph!, y1 + 9.5 * u, { ...lab, color: s.c('purple') });
    });
    s.alpha(s.win('ae', 'dn'), () => caption(s, 'trained on images alone: rebuild the input', s.h * 0.4, '--ink-2', 3.2));
    s.alpha(s.ease('ae', 0.6, 4), () => {
      s.rrect(en! - 10 * u, y1 - 9 * u, de! - en! + 20 * u, 18 * u, 1.5, { stroke: s.tint('--ink-3', 0.6), lw: 0.3 });
      s.text('frozen', s.w / 2, y1 - 11.5 * u, { ...lab, size: 3, color: s.c('--ink-3') });
    });
    const y2 = s.h * 0.62;
    const [z0, plus, zt, dn, eh] = row(s, [10, 8, 10, 22, 6], 5);
    s.alpha(s.ease('dn', 0.6), () => {
      s.line(lz!, y1 + 12 * u, z0!, y2 - 8 * u, s.tint('--ink-3', 0.6), 0.3, [0.8, 0.6]);
      latent(s, z0!, y2, 0.8, LAT);
      s.text('z', z0!, y2 + 9.5 * u, { ...lab, color: s.c('green') });
    });
    s.alpha(s.win('dn', 'loss'), () => caption(s, 'z takes the place of the clean image', s.h * 0.84, '--ink-2', 3.2));
    const ls = s.ease('loss', 0.6);
    s.alpha(ls, () => {
      s.text('+ ε', plus!, y2, { ...lab, size: 3.4, color: s.c('slate') });
      latent(s, zt!, y2, 0.8, ZT);
      s.text('zₜ', zt!, y2 + 9.5 * u, { ...lab, color: s.c('purple') });
      arrow(zt! + 5 * u, dn! - 11 * u, y2);
      block(s, dn!, y2, 20, 9, 'denoiser', 'blue', { size: 3.2, on: 1 });
      arrow(dn! + 11 * u, eh! - 3 * u, y2);
      s.text('ε̂', eh!, y2, { ...lab, size: 3.6, color: s.c('red') });
      caption(s, 'the same noise loss, never a pixel', s.h * 0.84, '--ink-2', 3.2);
    });
  },
};

const LEVELS = [0, 0.4, 0.8, 1];
const STAGES = LEVELS.map(noisy);

const make: SceneDef = {
  draw(s) {
    const u = s.u;
    const y = s.h * 0.2;
    const gap = s.tall ? 25 : 27;
    STAGES.forEach((st, k) => {
      const x = s.w / 2 + (k - 1.5) * gap * u;
      const a = k === 0 ? s.ease('start', 0.6) : s.ease('loop', 0.5, 0.5 + 1.1 * k);
      s.alpha(a, () => {
        latent(s, x, y, 1.4, st);
        if (k > 0) s.arrow(x - (gap - 9.5) * u, y, x - 9.5 * u, y, s.c('--ink-3'), 0.3, 1.6);
      });
    });
    s.alpha(s.win('start', 'loop'), () => caption(s, 'noise, 64 × 64 × 4: no encoder', s.h * 0.38, 'slate', 3.2));
    s.alpha(s.ease('loop', 0.6, 0.6), () => {
      const n = Math.round(50 * Math.min(1, s.prog('loop') * 1.3));
      rich(s, [['denoiser calls: ', '--ink-2'], [String(n), 'blue'], ['  ·  16,384 numbers each', '--ink-3']], s.w / 2, s.h * 0.38, { size: 3.2, weight: 650, halo: true });
    });
    const dc = s.ease('decode', 0.6);
    const y2 = s.h * 0.66;
    s.alpha(dc, () => {
      const X = (f: number) => s.w * f;
      latent(s, X(0.2), y2, 1.4, STAGES[3]!);
      funnel(s, X(0.33), X(0.52), y2, 14, 28, 'purple', 'decoder', 1);
      picture(s, X(0.7), y2, 1.7, PICS.sun);
      s.text('512 × 512 × 3', X(0.7), y2 + 17 * u, { ...lab, color: s.c('orange') });
    });
    s.alpha(s.ease('decode', 0.6, 1.5), () => caption(s, 'the decoder runs once, at the very end', s.h * 0.92, 'purple', 3.2));
  },
};

export const scenes: Record<string, SceneDef> = { squeeze, train, make };
