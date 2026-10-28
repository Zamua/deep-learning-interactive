import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { block, caption, funnel, picture, rich, shades, type Ink } from '../draw';

/** Image side in drawn pixels, and the encoder's shrink per side: 64 by 64 pixels, 8 by 8 spots. */
const N = 64;
const F = 8;
const M = N / F;

type RGB = [number, number, number];
const mixc = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((k) => a[k]! + (b[k]! - a[k]!) * t) as RGB;

/** A sunset over the sea, 64 by 64, with faint per-pixel grain: the detail the eye barely notices. */
const IMG: RGB[][] = (() => {
  const rng = new Rng(5);
  return Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => {
      const grain = (rng.next() - 0.5) * 6;
      let c: RGB;
      if (i < 38) {
        c = mixc([92, 104, 168], [238, 150, 96], i / 37);
        const d = Math.hypot(i - 27, j - 40);
        if (d < 8) c = mixc([255, 214, 110], c, smoothstep(6.5, 8, d));
      } else {
        c = mixc([60, 90, 140], [24, 44, 92], (i - 38) / 25);
        const wave = Math.sin(j * 0.55 + i * 1.7) * Math.sin(i * 0.9);
        if (wave > 0.6) c = mixc(c, [120, 150, 190], 0.5);
        if (Math.abs(j - 40) < 5 - (i - 38) * 0.08 && (i + j) % 3 !== 0) c = mixc(c, [250, 190, 100], 0.55);
      }
      return c.map((v) => Math.max(0, Math.min(255, Math.round(v + grain)))) as RGB;
    }),
  );
})();
function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
const css = ([r, g, b]: RGB) => `rgb(${r},${g},${b})`;
const IMGCSS = IMG.map((row) => row.map(css));

/** Fixed noise, one standard normal per number of the image. */
const PXNOISE: RGB[][] = (() => {
  const rng = new Rng(9);
  return IMG.map((row) => row.map(() => [rng.randn(), rng.randn(), rng.randn()] as RGB));
})();
/** The image noised to signal level `ab`, as CSS colors. */
function noisedImage(ab: number): string[][] {
  const a = Math.sqrt(ab);
  const b = Math.sqrt(1 - ab);
  return IMG.map((row, i) => row.map((c, j) => css(c.map((v, k) => Math.max(0, Math.min(255, 127.5 * (1 + a * (v / 127.5 - 1) + b * 0.8 * PXNOISE[i]![j]![k]!)))) as RGB)));
}

/** A stand-in latent: 8 by 8 spots, 4 numbers each, from the 8 by 8 patches of the image. */
const LAT: number[][][] = (() => {
  const feats = (i: number, j: number) => {
    const px = Array.from({ length: F * F }, (_, q) => IMG[F * i + Math.floor(q / F)]![F * j + (q % F)]!);
    const m = [0, 1, 2].map((k) => px.reduce((s, p) => s + p[k]!, 0) / px.length);
    const spread = px.reduce((s, p) => s + Math.abs(p[0]! - m[0]!) + Math.abs(p[2]! - m[2]!), 0) / px.length;
    return [(m[0]! + m[1]! + m[2]!) / 3, m[0]! - m[2]!, m[1]! - (m[0]! + m[2]!) / 2, spread];
  };
  const raw = Array.from({ length: M }, (_, i) => Array.from({ length: M }, (_, j) => feats(i, j)));
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

/** The sky patch the scenes zoom into, in spots: rows 8 to 15, columns 48 to 55 of the image. */
const PATCH: [number, number] = [1, 6];

/** A latent as 4 stacked 8 by 8 sheets, centered on (cx, cy); returns its half width in px. */
function latent(s: Scene, cx: number, cy: number, cell: number, sheets: number[][][], spot?: { at: [number, number]; a: number }): number {
  const u = s.u;
  const off = cell * 1.3 * u;
  for (let k = 3; k >= 0; k--) {
    const d = (k - 1.5) * off;
    s.rrect(cx + d - (M / 2) * cell * u, cy - d - (M / 2) * cell * u, M * cell * u, M * cell * u, 0.3, { fill: s.c('--card') });
    shades(s, cx + d, cy - d, cell, sheets[k]!, CH[k]!, { lo: -2.2, hi: 2.2 });
    if (spot && spot.a > 0.003) {
      const [i, j] = spot.at;
      s.alpha(spot.a, () => s.rrect(cx + d - (M / 2 - j) * cell * u, cy - d - (M / 2 - i) * cell * u, cell * u, cell * u, 0.2, { stroke: s.c('red'), lw: 0.5 }));
    }
  }
  return (M / 2) * cell * u + 1.5 * off;
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

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** An outline around patch (i, j) of an image drawn by `picture`. */
function patchBox(s: Scene, img: { l: number; t: number; p: number }, [i, j]: [number, number], k: Ink, lw = 0.45) {
  s.rrect(img.l + j * F * img.p, img.t + i * F * img.p, F * img.p, F * img.p, 0.3, { stroke: s.c(k), lw });
}

const lab = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;

const cost: SceneDef = {
  draw(s) {
    const u = s.u;
    const cy = s.h * 0.4;
    const zx = Math.min(s.w - 23 * u, s.w * 0.72);
    // Centered while it is the whole story, then moved aside for the blown-up patch.
    const ix = lerp(s.w / 2, Math.max(25 * u, s.w * 0.28), s.ease('patch', 0.8));
    const px = 40 / N;
    // The walk back from noise: the image clears as the beat plays, and a band sweeps it at every step.
    const ab = s.since('walk') < 0 ? 0 : smoothstep(0.1, 0.95, s.prog('walk'));
    const img = picture(s, ix, cy, px, ab >= 0.999 ? IMGCSS : noisedImage(ab));
    const sweeping = s.since('walk') >= 0 && s.since('px') < 0;
    if (sweeping) {
      const f = (s.prog('walk') * 6) % 1;
      s.alpha(Math.sin(f * Math.PI), () => s.rrect(img.l, img.t + f * (N * img.p - 2 * u), N * img.p, 2 * u, 0.4, { fill: s.tint('blue', 0.35), stroke: s.c('blue'), lw: 0.3 }));
    }
    s.alpha(s.win('walk', 'px'), () => {
      const n = Math.max(0, 50 - Math.round(50 * Math.min(1, s.prog('walk') * 1.05)));
      s.text(`step ${n}`, ix, img.t - 3.5 * u, { ...lab, color: s.c('blue') });
      caption(s, 'every step: the network reads every number', s.h * 0.88, '--ink-2', 3.2);
    });
    s.alpha(s.ease('px', 0.6), () => {
      s.text('x: 512 × 512 × 3', ix, img.t + N * img.p + 4.5 * u, { ...lab, color: s.c('orange') });
      s.text('786,432 numbers', ix, img.t + N * img.p + 9.5 * u, { ...lab, size: 3, color: s.c('--ink-2') });
    });
    s.alpha(s.win('px', 'patch'), () => caption(s, '786,432 numbers, read at each of 50 steps', s.h * 0.88, '--ink-2', 3.2));
    // One sky patch, blown up: 64 pixels that nearly all agree.
    const z = s.ease('patch', 0.8);
    s.alpha(z, () => {
      patchBox(s, img, PATCH, '--ink');
      const cell = 4.4 * u;
      const l = zx - (F / 2) * cell;
      const t = cy - (F / 2) * cell;
      const c = s.ctx;
      c.strokeStyle = s.tint('--ink-3', 0.7);
      c.lineWidth = 0.25 * u;
      c.beginPath();
      c.moveTo(img.l + (PATCH[1] + 1) * F * img.p, img.t + PATCH[0] * F * img.p);
      c.lineTo(l, t);
      c.moveTo(img.l + (PATCH[1] + 1) * F * img.p, img.t + (PATCH[0] + 1) * F * img.p);
      c.lineTo(l, t + F * cell);
      c.stroke();
      for (let i = 0; i < F; i++) {
        for (let j = 0; j < F; j++) {
          c.fillStyle = IMGCSS[PATCH[0] * F + i]![PATCH[1] * F + j]!;
          c.fillRect(l + j * cell + 0.2 * u, t + i * cell + 0.2 * u, cell - 0.4 * u, cell - 0.4 * u);
        }
      }
      s.text('8 × 8 pixels', zx, t + F * cell + 4.5 * u, { ...lab, color: s.c('orange') });
      s.text('192 numbers', zx, t + F * cell + 9.5 * u, { ...lab, size: 3, color: s.c('--ink-2') });
    });
    s.alpha(s.win('patch', 'rombach'), () => caption(s, '192 numbers, nearly all alike', s.h * 0.88, '--ink-2', 3.2));
    s.alpha(s.ease('rombach', 0.6), () => {
      caption(s, 'most numbers: detail the eye barely notices', s.h * 0.86, '--ink-2', 3.2);
      caption(s, 'pixel diffusion reads them all, every step', s.h * 0.92, 'red', 3.2);
    });
    cite(s, 'Rombach, Blattmann, Lorenz, Esser & Ommer, 2021', s.ease('rombach', 0.6));
  },
};

const squeeze: SceneDef = {
  draw(s) {
    const u = s.u;
    const y = s.h * 0.38;
    const ix = Math.max(21 * u, s.w * 0.2);
    const zx = Math.min(s.w - 15 * u, s.w * 0.78);
    const cell = 1.8;
    const img = picture(s, ix, y, 32 / N, IMGCSS);
    const half = (M / 2) * cell * u + 1.5 * cell * 1.3 * u;
    s.text('x: 512 × 512 × 3', ix, y + 20.5 * u, { ...lab, color: s.c('orange') });
    s.text('786,432 numbers', ix, y + 25.5 * u, { ...lab, size: 3, color: s.c('--ink-2') });
    const en = s.ease('enc', 0.8);
    s.alpha(en, () => funnel(s, img.l + N * img.p + 3 * u, zx - half - 3 * u, y, 30, 14, 'blue', 'encoder', s.win('enc', 'grid')));
    // One patch of the image and the spot that describes it.
    const g = s.win('grid', 'spots');
    s.alpha(s.ease('enc', 0.6, 1.2), () => latent(s, zx, y, cell, LAT, { at: PATCH, a: g }));
    s.alpha(g, () => patchBox(s, img, PATCH, 'red', 0.55));
    s.alpha(s.win('grid', 'z'), () => caption(s, 'one spot: one 8 × 8 patch, in 4 numbers', s.h * 0.8, '--ink-2', 3.2));
    s.alpha(s.ease('z', 0.6), () => s.text('z: 64 × 64 × 4', zx, y + 20.5 * u, { ...lab, color: s.c('green') }));
    s.alpha(s.win('z', 'name'), () => caption(s, 'Stable Diffusion, 2022: 512 × 512 → 64 × 64 × 4', s.h * 0.8, '--ink-2', 3.1));
    s.alpha(s.win('name', 'spots'), () => {
      caption(s, 'latent: from the Latin for lying hidden', s.h * 0.8, 'green', 3.2);
      caption(s, 'only the decoder turns it back into pixels', s.h * 0.87, '--ink-2', 3.1);
    });
    // The patch grid over the image: one spot per patch.
    const sp = s.ease('spots', 0.8);
    s.alpha(sp, () => {
      const c = s.ctx;
      c.strokeStyle = s.tint('--card', 0.85);
      c.lineWidth = 0.25 * u;
      c.beginPath();
      for (let k = 1; k < M; k++) {
        c.moveTo(img.l + k * F * img.p, img.t);
        c.lineTo(img.l + k * F * img.p, img.t + N * img.p);
        c.moveTo(img.l, img.t + k * F * img.p);
        c.lineTo(img.l + N * img.p, img.t + k * F * img.p);
      }
      c.stroke();
      caption(s, 'sides 8× shorter: 8 × 8 = 64× fewer spots', s.h * 0.8, '--ink-2', 3.2);
    });
    s.alpha(s.ease('count', 0.6), () => {
      s.text('16,384 numbers', zx, y + 25.5 * u, { ...lab, size: 3, color: s.c('--ink-2') });
      caption(s, '4 numbers per spot, not 3', s.h * 0.87, '--ink-2', 3.2);
    });
    s.alpha(s.ease('ratio', 0.6), () => rich(s, [['64 × 3 / 4 = ', '--ink-2'], ['48× fewer numbers', 'green']], s.w / 2, s.h * 0.94, { size: 3.4, weight: 650, halo: true }));
  },
};

const train: SceneDef = {
  draw(s) {
    const u = s.u;
    const y1 = s.h * 0.24;
    const [px, en, lz, de, ph] = row(s, [12.8, 18.4, 10, 18.4, 12.8], 5);
    const arrow = (a: number, b: number, y: number) => s.arrow(a + 1 * u, y, b - 1 * u, y, s.c('--ink-3'), 0.3, 1.6);
    const fz = s.ease('frozen', 0.6);
    s.alpha(s.ease('ae', 0.6), () => {
      picture(s, px!, y1, 12.8 / N, IMGCSS);
      s.text('x', px!, y1 + 9.5 * u, { ...lab, color: s.c('orange') });
      arrow(px! + 6.4 * u, en! - 9.2 * u, y1);
      block(s, en!, y1, 18, 9, 'encoder', fz > 0.5 ? 'slate' : 'blue', { size: 3.2, on: s.win('ae', 'frozen') });
      arrow(en! + 9.2 * u, lz! - 5 * u, y1);
      latent(s, lz!, y1, 0.8, LAT);
      s.text('z', lz!, y1 + 9.5 * u, { ...lab, color: s.c('green') });
      arrow(lz! + 5 * u, de! - 9.2 * u, y1);
      block(s, de!, y1, 18, 9, 'decoder', fz > 0.5 ? 'slate' : 'purple', { size: 3.2, on: s.win('ae', 'frozen') });
      arrow(de! + 9.2 * u, ph! - 6.4 * u, y1);
      picture(s, ph!, y1, 12.8 / N, IMGCSS);
      s.text('x̂', ph!, y1 + 9.5 * u, { ...lab, color: s.c('purple') });
    });
    s.alpha(s.win('ae', 'frozen'), () => caption(s, 'trained on images alone: rebuild the input', s.h * 0.43, '--ink-2', 3.2));
    s.alpha(fz, () => {
      s.rrect(en! - 10.5 * u, y1 - 8 * u, de! - en! + 21 * u, 16 * u, 1.5, { stroke: s.c('slate'), lw: 0.35 });
      s.text('frozen', s.w / 2, y1 - 10.5 * u, { ...lab, size: 3.2, color: s.c('slate') });
    });
    s.alpha(s.win('frozen', 'dn'), () => caption(s, 'frozen: its weights never change again', s.h * 0.43, 'slate', 3.2));
    const y2 = s.h * 0.64;
    const [z0, plus, zt, dn, eh] = row(s, [10, 8, 10, 22, 6], 5);
    s.alpha(s.ease('dn', 0.6), () => {
      s.line(lz!, y1 + 12 * u, z0!, y2 - 8 * u, s.tint('--ink-3', 0.6), 0.3, [0.8, 0.6]);
      latent(s, z0!, y2, 0.8, LAT);
      s.text('z', z0!, y2 + 9.5 * u, { ...lab, color: s.c('green') });
    });
    s.alpha(s.win('dn', 'zt'), () => caption(s, 'z takes the place of the clean image', s.h * 0.86, '--ink-2', 3.2));
    s.alpha(s.ease('zt', 0.6), () => {
      s.text('+ ε', plus!, y2, { ...lab, size: 3.4, color: s.c('slate') });
      latent(s, zt!, y2, 0.8, ZT);
      s.text('zₜ', zt!, y2 + 9.5 * u, { ...lab, color: s.c('purple') });
    });
    s.alpha(s.win('zt', 'loss'), () => caption(s, 'the same blend as for pixels, at a random t', s.h * 0.86, '--ink-2', 3.2));
    s.alpha(s.ease('loss', 0.6), () => {
      arrow(zt! + 5 * u, dn! - 11 * u, y2);
      block(s, dn!, y2, 20, 9, 'denoiser', 'blue', { size: 3.2, on: 1 });
      arrow(dn! + 11 * u, eh! - 3 * u, y2);
      s.text('ε̂', eh!, y2, { ...lab, size: 3.6, color: s.c('red') });
      caption(s, 'ε̂: the latent\'s shape, never a pixel', s.h * 0.86, '--ink-2', 3.2);
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
      picture(s, X(0.7), y2, 27 / N, IMGCSS);
      s.text('512 × 512 × 3', X(0.7), y2 + 17 * u, { ...lab, color: s.c('orange') });
    });
    s.alpha(s.ease('decode', 0.6, 1.5), () => caption(s, 'the decoder runs once, at the very end', s.h * 0.92, 'purple', 3.2));
  },
};

export const scenes: Record<string, SceneDef> = { cost, squeeze, train, make };
