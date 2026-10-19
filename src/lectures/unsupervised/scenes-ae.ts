import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { AE_LIN, AE_MLP, AE_STEPS, VAE_CURVES, VAE_GEN, VAE_KL, VAE_REC, VAE_STEPS } from './data';
import { type K, type Rect, Frame, PHOTOS, area, bell, blend, box, check, cross, face, fit, gauss, lerpArr, mlp, mosaic, pill, pix, trap } from './kit';

// ---------------------------------------------------------------- data

/** The chapter's arc for the autoencoder figure: 150 points, seed 3. */
const AE_X = (() => {
  const r = new Rng(3);
  const X = new Float64Array(300);
  for (let i = 0; i < 150; i++) {
    const t = (0.35 + 1.3 * r.next()) * Math.PI;
    X[2 * i] = 1.1 * Math.cos(t) + 0.05 * r.randn();
    X[2 * i + 1] = 0.95 * Math.sin(t) + 0.05 * r.randn();
  }
  return X;
})();

/** The chapter's arc for the VAE figure: 300 points, seed 21. */
const VAE_X = (() => {
  const r = new Rng(21);
  const X = new Float64Array(600);
  for (let i = 0; i < 300; i++) {
    const t = (0.35 + 1.3 * r.next()) * Math.PI;
    X[2 * i] = Math.cos(t) + 0.04 * r.randn();
    X[2 * i + 1] = 0.8 * Math.sin(t) + 0.04 * r.randn();
  }
  return X;
})();

const VAE_ZN = VAE_CURVES[0]!.length / 2;
const vaeZ = (i: number) => -2.6 + (5.2 * i) / (VAE_ZN - 1);

/** The trained decoder's output at code z, read off the stored curve. */
function vaeDecode(z: number, curve = VAE_CURVES[VAE_CURVES.length - 1]!): [number, number] {
  const f = clamp01((z + 2.6) / 5.2) * (VAE_ZN - 1);
  const i = Math.min(VAE_ZN - 2, Math.floor(f));
  const t = f - i;
  return [lerp(curve[2 * i]!, curve[2 * i + 2]!, t), lerp(curve[2 * i + 1]!, curve[2 * i + 3]!, t)];
}

/** 2-D toy clouds for the "kinds of structure" panels. */
const CLUSTERS = (() => {
  const r = new Rng(5);
  const centers = [
    [-0.55, 0.45],
    [0.5, 0.5],
    [0, -0.5],
  ];
  return Array.from({ length: 45 }, (_, i) => {
    const c = centers[i % 3]!;
    return [c[0]! + 0.13 * r.randn(), c[1]! + 0.13 * r.randn(), i % 3] as const;
  });
})();
const CLOUD = (() => {
  const r = new Rng(8);
  return Array.from({ length: 40 }, () => {
    const a = 0.55 * r.randn();
    const b = 0.12 * r.randn();
    return [a * 0.87 - b * 0.5, a * 0.5 + b * 0.87] as const;
  });
})();
/** Codes of a plain autoencoder: clumps with gaps, colored by class. */
const CODES = (() => {
  const r = new Rng(13);
  const cs = [
    [-0.62, 0.55],
    [0.55, 0.6],
    [-0.5, -0.5],
    [0.62, -0.35],
    [0.05, 0.05],
  ];
  return Array.from({ length: 60 }, (_, i) => {
    const c = cs[i % 5]!;
    return [c[0]! + 0.09 * r.randn(), c[1]! + 0.09 * r.randn(), i % 5] as const;
  });
})();
const CODE_K: K[] = ['orange', 'blue', 'green', 'red', 'gold'];

/** An 8 x 8 digit seven, and a noisy copy of it. */
const SEVEN = [
  '........',
  '.######.',
  '......#.',
  '.....#..',
  '....#...',
  '...#....',
  '...#....',
  '........',
];
const sevenAt = (i: number, j: number) => (SEVEN[i]![j] === '#' ? 1 : 0);
/** The autoencoder's reconstruction of PHOTOS[2]: each pixel averaged with its neighbors. */
const SOFT = (i: number, j: number): [number, number, number] => {
  const acc = [0, 0, 0];
  let n = 0;
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++) {
      const ii = i + a;
      const jj = j + b;
      if (ii < 0 || jj < 0 || ii > 5 || jj > 5) continue;
      const wgt = a === 0 && b === 0 ? 2 : 1;
      const px = PHOTOS[2]!(ii, jj);
      for (let q = 0; q < 3; q++) acc[q]! += wgt * px[q]!;
      n += wgt;
    }
  return [acc[0]! / n, acc[1]! / n, acc[2]! / n];
};
const NOISE = (() => {
  const r = new Rng(17);
  return Array.from({ length: 64 }, () => 0.45 * r.randn());
})();
const GARBAGE = (() => {
  const r = new Rng(23);
  return Array.from({ length: 64 }, () => r.next() * 0.9);
})();

// ---------------------------------------------------------------- unlabeled

const unlabeled: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const names = ['cat', 'dog', 'car', 'ship', 'bird', 'frog'];
    const n = 6;
    const gap = u * 2;
    const tw = Math.min((w * 0.9 - gap * (n - 1)) / n, h * 0.14);
    const x0 = (w - n * tw - (n - 1) * gap) / 2;
    const y0 = h * 0.2;
    // Pairs, then just the data.
    const pA = s.win('sofar', 'kinds');
    s.alpha(pA, () => {
      const tagA = 1 - s.ease('unsup', 0.8, 0.3);
      for (let k = 0; k < n; k++) {
        const x = x0 + k * (tw + gap);
        mosaic(s, x, y0, tw, 6, PHOTOS[k]!);
        s.alpha(tagA, () => pill(s, names[k]!, x + tw / 2, y0 + tw + u * 4 + (1 - tagA) * u * 6, 'gold', { size: 2.9 }));
      }
      s.text('x', x0 - u * 3, y0 + tw / 2, { size: 4.4, italic: true, weight: 600, color: s.c('orange') });
      s.alpha(tagA, () => s.text('y', x0 - u * 3, y0 + tw + u * 4, { size: 4.4, italic: true, weight: 600, color: s.c('gold') }));
      s.alpha(s.ease('sofar', 0.6, 1.6) * tagA, () => {
        const cy = y0 + tw + u * 15;
        pill(s, 'learn x → y', w / 2, cy, 'slate', { size: 3.8 });
      });
      const cA = s.win('cost', 'unsup');
      s.alpha(cA, () => {
        const cy = h * 0.66;
        const p = smooth(s.prog('cost') * 1.3);
        const v = Math.round(1281167 * p);
        fit(s, v.toLocaleString('en-US'), w / 2, cy, w * 0.9, { size: 10, font: 'mono', weight: 650, color: s.c('gold') });
        s.text('ImageNet training images, each labeled by a person', w / 2, cy + u * 8, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
      });
      s.alpha(s.win('unsup', 'kinds'), () => {
        fit(s, 'just x: find structure in it', w / 2, h * 0.62, w * 0.9, { size: 5, font: 'display', weight: 600 });
      });
    });
    // Kinds of structure.
    const kA = s.win('kinds', 'feat');
    if (kA > 0) {
      s.alpha(kA, () => {
        const tall = s.tall;
        const cols = tall ? 2 : 4;
        const pw = tall ? w * 0.42 : w * 0.21;
        const ph = tall ? h * 0.34 : h * 0.5;
        const gx = (w - cols * pw) / (cols + 1);
        const labels = ['clusters', 'main directions', 'features', 'density'];
        for (let i = 0; i < 4; i++) {
          const a = s.ease('kinds', 0.5, 0.2 + i * 1.3);
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = gx + col * (pw + gx);
          const y = (tall ? h * 0.12 : h * 0.22) + row * (ph + u * 4);
          s.alpha(a, () => {
            s.rrect(x, y, pw, ph, 2, { fill: s.tint('--ink', 0.03), stroke: s.tint('--ink', 0.15), lw: 0.3 });
            s.text(labels[i]!, x + pw / 2, y + ph - u * 3.4, { size: 3.4, font: 'ui', weight: 600, color: s.c('--ink-2') });
            const fr = new Frame(s, [x + u * 2, y + u * 2, pw - u * 4, ph - u * 9], [-1.1, 1.1, -1.1, 1.1], true);
            if (i === 0) {
              const ks: K[] = ['orange', 'blue', 'green'];
              for (const [px, py, c] of CLUSTERS) fr.dot(px, py, 0.8, s.c(ks[c]!));
              for (const [cx, cy] of [
                [-0.55, 0.45],
                [0.5, 0.5],
                [0, -0.5],
              ])
                s.circle(fr.X(cx!), fr.Y(cy!), fr.kx * 0.38, { stroke: s.tint('--ink', 0.4), lw: 0.25 });
            } else if (i === 1) {
              for (const [px, py] of CLOUD) fr.dot(px, py, 0.8, s.c('orange'));
              s.arrow(fr.X(-0.95 * 0.87), fr.Y(-0.95 * 0.5), fr.X(0.95 * 0.87), fr.Y(0.95 * 0.5), s.c('purple'), 0.5, 2);
            } else if (i === 2) {
              const t = Math.min(fr.kx * 0.8, (pw - u * 4) * 0.36);
              mosaic(s, fr.X(-0.95), fr.Y(0) - t / 2, t, 6, PHOTOS[4]!);
              s.arrow(fr.X(-0.95) + t + u, fr.Y(0), fr.X(0.3), fr.Y(0), s.c('--ink-3'), 0.4, 1.8);
              for (let q = 0; q < 4; q++) s.cell(fr.X(0.4), fr.Y(0) - t / 2 + (q * t) / 4, t * 0.3, (t / 4) * 0.9, '', 'purple', { on: 0.5 });
            } else {
              for (let ring = 1; ring <= 4; ring++) {
                const c = s.ctx;
                c.beginPath();
                c.ellipse(fr.X(0), fr.Y(0), fr.kx * 0.22 * ring, fr.kx * 0.14 * ring, -0.5, 0, Math.PI * 2);
                c.strokeStyle = s.tint('teal', 0.85 - ring * 0.15);
                c.lineWidth = 0.35 * u;
                c.stroke();
              }
              for (const [px, py] of CLOUD.slice(0, 26)) fr.dot(px * 0.8, py * 0.5, 0.7, s.c('orange'));
            }
          });
        }
      });
    }
    // Two flavors.
    const fA = s.ease('feat', 0.6);
    if (fA > 0) {
      const tall = s.tall;
      const cw = tall ? w * 0.86 : w * 0.43;
      const chh = tall ? h * 0.36 : h * 0.56;
      const rects: Rect[] = tall
        ? [
            [w * 0.07, h * 0.12, cw, chh],
            [w * 0.07, h * 0.12 + chh + u * 3, cw, chh],
          ]
        : [
            [w * 0.05, h * 0.22, cw, chh],
            [w * 0.52, h * 0.22, cw, chh],
          ];
      const titles = ['learning features', 'generative models'];
      rects.forEach(([x, y, rw, rh], i) => {
        const a = s.ease(i ? 'gen' : 'feat', 0.6);
        s.alpha(a, () => {
          s.rrect(x, y, rw, rh, 2.4, { fill: s.tint('--ink', 0.03), stroke: s.tint('--ink', 0.18), lw: 0.35 });
          s.text(titles[i]!, x + rw / 2, y + u * 5, { size: 4.2, font: 'display', weight: 600 });
          const cy = y + rh * 0.58;
          const t = Math.min(rh * 0.42, rw * 0.2);
          if (i === 0) {
            mosaic(s, x + rw * 0.08, cy - t / 2, t, 6, PHOTOS[5]!);
            trap(s, x + rw * 0.08 + t + u * 2, t, x + rw * 0.62, t * 0.35, cy, 'slate', 'encoder');
            for (let q = 0; q < 3; q++) s.cell(x + rw * 0.68, cy - t * 0.3 + q * t * 0.2, t * 0.22, t * 0.18, '', 'purple', { on: 0.6 });
            s.text('z', x + rw * 0.68 + t * 0.11, cy + t * 0.42, { size: 3.8, italic: true, weight: 600, color: s.c('purple') });
            s.text('a code', x + rw * 0.84, cy, { size: 3.3, font: 'ui', color: s.c('--ink-3') });
          } else {
            for (let q = 0; q < 3; q++) s.cell(x + rw * 0.06, cy - t * 0.3 + q * t * 0.2, t * 0.22, t * 0.18, '', 'purple');
            s.text('noise', x + rw * 0.06 + t * 0.11, cy + t * 0.44, { size: 3.1, font: 'ui', color: s.c('--ink-3') });
            box(s, x + rw * 0.2, cy - t * 0.35, rw * 0.22, t * 0.7, 'model', 'blue', { size: 3.4 });
            s.arrow(x + rw * 0.43, cy, x + rw * 0.5, cy, s.c('--ink-3'), 0.4, 1.8);
            const tt = Math.min(t * 0.8, rw * 0.13);
            for (let q = 0; q < 3; q++) {
              const qa = s.ease('gen', 0.4, 1 + q * 0.5);
              s.alpha(qa, () => mosaic(s, x + rw * 0.52 + q * (tt + u * 1.5), cy - tt / 2, tt, 6, PHOTOS[7 + q]!, { frame: 'blue', lw: 0.5 }));
            }
          }
        });
      });
    }
  },
};

// ---------------------------------------------------------------- autoencoder

const LIN_S: [number[], ('tanh' | 'linear')[]] = [[2, 1], ['linear']];
const LIN_D: [number[], ('tanh' | 'linear')[]] = [[1, 2], ['linear']];
const MLP_S: [number[], ('tanh' | 'linear')[]] = [[2, 16, 1], ['tanh', 'linear']];
const MLP_D: [number[], ('tanh' | 'linear')[]] = [[1, 16, 2], ['tanh', 'linear']];
const encLen = (sz: number[]) => sz.slice(1).reduce((a, n, i) => a + n * sz[i]! + n, 0);

/** Codes, reconstructions and the decoder's curve for one stored autoencoder. */
function aeState(lin: boolean, k: number) {
  const run = lin ? AE_LIN : AE_MLP;
  const [es, ea] = lin ? LIN_S : MLP_S;
  const [ds, da] = lin ? LIN_D : MLP_D;
  const wts = run.w[k]!;
  const we = wts.slice(0, encLen(es));
  const wd = wts.slice(encLen(es));
  const z = mlp(es, ea, we, AE_X, 150);
  const xh = mlp(ds, da, wd, z, 150);
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of z) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const pad = (hi - lo) * 0.08 + 1e-6;
  const zs = new Float64Array(97).map((_, i) => lo - pad + ((hi - lo + 2 * pad) * i) / 96);
  const curve = mlp(ds, da, wd, zs, 97);
  return { xh, curve, loss: run.loss[k]! };
}
const AE_CACHE = new Map<string, ReturnType<typeof aeState>>();
const aeAt = (lin: boolean, k: number) => {
  const key = `${lin}${k}`;
  let v = AE_CACHE.get(key);
  if (!v) AE_CACHE.set(key, (v = aeState(lin, k)));
  return v;
};

/** The big encoder, code, decoder picture. `dec` dims the decoder; `on` lights a part. */
function aeBig(s: Scene, r: Rect, o: { enc?: number; dec?: number; z?: number; noisy?: boolean; out?: 'photo' | 'seven' } = {}): { x0: number; x1: number; zx: number; cy: number; S: number } {
  const [x, y, w, h] = r;
  const u = s.u;
  const S = Math.min(w * 0.22, h * 0.62);
  const cy = y + h / 2;
  const x0 = x;
  const x1 = x + w - S;
  const zx = x + w / 2;
  const encA = o.enc ?? 1;
  const decA = o.dec ?? 1;
  const seven = o.out === 'seven';
  const drawIn = (xx: number, noisy: boolean) =>
    seven ? pix(s, xx, cy - S / 2, S, 8, (i, j) => sevenAt(i, j) + (noisy ? NOISE[i * 8 + j]! : 0), '--ink', { frame: 'orange', lw: 0.5 }) : mosaic(s, xx, cy - S / 2, S, 6, PHOTOS[2]!, { frame: 'orange', lw: 0.5 });
  drawIn(x0, !!o.noisy);
  s.alpha(encA, () => trap(s, x0 + S + u * 2, S, zx - u * 4, S * 0.32, cy, 'slate', 'encoder'));
  const zc = o.z ?? 1;
  for (let q = 0; q < 3; q++) s.cell(zx - u * 2.6, cy - S * 0.15 + q * S * 0.1, u * 5.2, S * 0.095, '', 'purple', { on: 0.4 + 0.6 * zc });
  s.alpha(decA, () => {
    trap(s, zx + u * 4, S * 0.32, x1 - u * 2, S, cy, 'slate', 'decoder');
    if (seven) pix(s, x1, cy - S / 2, S, 8, sevenAt, '--ink', { frame: 'purple', lw: 0.5 });
    else mosaic(s, x1, cy - S / 2, S, 6, SOFT, { frame: 'purple', lw: 0.5 });
  });
  return { x0, x1, zx, cy, S };
}

const autoencoder: SceneDef = {
  marks: {
    loss: { tex: String.raw`\symL = \lVert \symx - \hat{\symx} \rVert^2`, x: 0.5, y: 0.84, size: 6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // The idea.
    const iA = s.win('idea', 'toy');
    if (iA > 0) {
      s.alpha(iA, () => {
        const encOn = s.since('enc') >= 0 && s.since('dec') < 0;
        const decOn = s.since('dec') >= 0 && s.since('loss') < 0;
        const r: Rect = [w * 0.06, h * 0.2, w * 0.88, h * 0.46];
        const g = aeBig(s, r, { enc: s.ease('idea', 0.6, 0.6) * (decOn ? 0.4 : 1), dec: s.ease('idea', 0.6, 1.2) * (encOn ? 0.4 : 1), z: encOn ? 1 : 0.3 });
        s.text('x', g.x0 + g.S / 2, g.cy - g.S / 2 - u * 3.6, { size: 4.6, italic: true, weight: 600, color: s.c('orange') });
        s.alpha(s.ease('idea', 0.5, 0.9), () => s.text('z', g.zx, g.cy - g.S * 0.15 - u * 4, { size: 4.6, italic: true, weight: 600, color: s.c('purple') }));
        s.alpha(s.ease('idea', 0.5, 1.4), () => s.text('x̂', g.x1 + g.S / 2, g.cy - g.S / 2 - u * 3.6, { size: 4.6, italic: true, weight: 600, color: s.c('purple') }));
        s.alpha(s.ease('idea', 0.5, 1.2) * (1 - s.ease('loss', 0.4)), () => fit(s, 'a bottleneck: too small to copy', w / 2, h * 0.74, w * 0.9, { size: 4, font: 'ui', color: s.c('--ink-2') }));
        s.show('loss', iA * s.ease('loss', 0.6));
        s.alpha(s.ease('loss', 0.5, 0.4), () => {
          const ly = g.cy + g.S / 2 + u * 3;
          s.line(g.x0 + g.S / 2, ly, g.x0 + g.S / 2, ly + u * 4, s.tint('red', 0.6), 0.35);
          s.line(g.x1 + g.S / 2, ly, g.x1 + g.S / 2, ly + u * 4, s.tint('red', 0.6), 0.35);
          s.line(g.x0 + g.S / 2, ly + u * 4, g.x1 + g.S / 2, ly + u * 4, s.tint('red', 0.6), 0.35);
          s.text('compare', w / 2, ly + u * 6.4, { size: 3.2, font: 'ui', color: s.c('red'), halo: true });
        });
      });
    }
    // The toy: 2-D points through a single number.
    const tA = s.win('toy', 'keep');
    if (tA > 0) {
      const fr = new Frame(s, area(s, 0.12, 0.05), [-1.9, 1.9, -1.45, 1.45], true);
      const lin = s.since('nonlin') < 0;
      let prog = 0;
      if (lin && s.since('pca') >= 0) prog = smooth(s.prog('pca') * 1.3);
      if (!lin) prog = s.since('bend') >= 0 ? smooth(s.prog('bend') * 1.3) : 0;
      const [k0, k1, f] = blend(
        AE_STEPS.map((_, i) => i / (AE_STEPS.length - 1)),
        prog,
      );
      const A = aeAt(lin, k0);
      const B = aeAt(lin, k1);
      const xh = lerpArr(Array.from(A.xh), Array.from(B.xh), f);
      const cv = lerpArr(Array.from(A.curve), Array.from(B.curve), f);
      const step = Math.round(lerp(AE_STEPS[k0]!, AE_STEPS[k1]!, f));
      const loss = Math.exp(lerp(Math.log(A.loss), Math.log(B.loss), f));
      s.slot('enc', lin ? 'X.dot(W_e) + b_e' : 'mlp_e(X)  # 16 tanh');
      s.slot('dec', lin ? 'z.dot(W_d) + b_d' : 'mlp_d(z)  # 16 tanh');
      s.slot('step', step);
      s.slot('loss', fmt(loss, 3));
      s.alpha(tA, () => {
        fr.grid(0.5, 0.8);
        const recA = s.ease('curve', 0.6);
        s.alpha(recA * 0.9, () => {
          for (let i = 0; i < 150; i++) s.line(fr.X(AE_X[2 * i]!), fr.Y(AE_X[2 * i + 1]!), fr.X(xh[2 * i]!), fr.Y(xh[2 * i + 1]!), s.tint('--ink', 0.2), 0.2);
        });
        for (let i = 0; i < 150; i++) fr.dot(AE_X[2 * i]!, AE_X[2 * i + 1]!, 0.95, s.tint('orange', 0.85));
        s.alpha(recA, () => {
          fr.clip(() => fr.path(cv.filter((_, i) => i % 2 === 0), cv.filter((_, i) => i % 2 === 1), s.c('purple'), 0.75));
          for (let i = 0; i < 150; i++) fr.dot(xh[2 * i]!, xh[2 * i + 1]!, 0.7, s.c('purple'));
        });
        const [vx0, , , vy1] = fr.view;
        const tx = fr.X(vx0) + u * 2;
        const ty = fr.Y(vy1) + u * 3;
        s.alpha(s.ease('toy', 0.5, 0.6), () => {
          s.text('2 numbers → 1 → 2 numbers', tx, ty, { size: 3.4, font: 'mono', color: s.c('--ink-2'), align: 'left', halo: true });
        });
        s.alpha(s.ease('linear', 0.5), () => {
          s.text(lin ? 'linear' : 'nonlinear: 16 tanh units', tx, ty + u * 5, { size: 3.6, font: 'ui', weight: 650, color: s.c('purple'), align: 'left', halo: true });
          s.text(`loss ${fmt(loss, 3)}`, tx, ty + u * 10, { size: 3.6, font: 'mono', color: s.c('red'), align: 'left', halo: true });
        });
      });
    }
    // What autoencoders are for.
    const kA = s.win('keep', 'history');
    if (kA > 0) {
      s.alpha(kA, () => {
        const r: Rect = [w * 0.15, h * 0.16, w * 0.7, h * 0.42];
        const g = aeBig(s, r, { dec: 1 - 0.85 * s.ease('keep', 0.6, 0.6) });
        s.alpha(s.ease('keep', 0.4, 0.9), () => cross(s, g.x1 + g.S / 2, g.cy, u * 3));
        const cA = s.ease('keep', 0.6, 2.6);
        s.alpha(cA, () => {
          const by = g.cy + g.S / 2 + u * 9;
          s.arrow(g.zx, g.cy + g.S * 0.17, g.zx, by - u * 1.5, s.c('--ink-3'), 0.4, 2);
          box(s, g.zx - w * 0.14, by, w * 0.28, u * 9, 'classifier', 'slate', { size: 3.6 });
          s.arrow(g.zx + w * 0.14 + u, by + u * 4.5, g.zx + w * 0.22, by + u * 4.5, s.c('--ink-3'), 0.4, 2);
          pill(s, 'cat', g.zx + w * 0.23, by + u * 4.5, 'gold', { size: 3.4, align: 'left' });
          s.text('features learned without labels', w / 2, by + u * 16, { size: 3.6, font: 'ui', italic: true, color: s.c('--ink-2') });
        });
      });
    }
    const hA = s.win('history', 'noise');
    if (hA > 0) {
      s.alpha(hA, () => {
        const dimS = 1 - 0.85 * s.ease('fell', 0.6);
        const lw = Math.min(w * 0.42, u * 56);
        const lx = w / 2 - lw / 2;
        const lh = u * 7;
        const base = h * 0.78;
        const p = s.prog('history');
        s.alpha(dimS, () => {
          s.rrect(lx, base, lw, lh, 1.5, { fill: s.tint('orange', 0.2), stroke: s.c('orange'), lw: 0.4 });
          s.text('x (pixels)', w / 2, base + lh / 2, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange') });
          for (let k = 0; k < 3; k++) {
            const y = base - (k + 1) * (lh + u * 6);
            const active = s.since('history') >= 0 && s.since('fell') < 0 && Math.floor(p * 3.3) === k;
            const done = s.since('fell') >= 0 || p * 3.3 > k + 1;
            const kk: K = active ? 'teal' : done ? 'slate' : '--ink-3';
            s.alpha(done || active ? 1 : 0.35, () => {
              s.rrect(lx, y, lw, lh, 1.5, { fill: s.tint(kk, active ? 0.25 : 0.1), stroke: s.c(kk), lw: active ? 0.6 : 0.35 });
              s.text(`layer ${k + 1}`, w / 2, y + lh / 2, { size: 3.4, font: 'mono', weight: 600, color: s.c(kk) });
            });
            s.line(w / 2, y + lh, w / 2, y + lh + u * 6, s.tint('--ink', 0.3), 0.3);
            if (active) {
              const ax = lx + lw + u * 3;
              s.arrow(ax, y + lh / 2, ax, y + lh + u * 6 + lh / 2, s.c('teal'), 0.45, 2);
              fit(s, 'rebuild below', ax + u * 2 + (w - ax - u * 6) / 2, y + lh + u * 3, w - ax - u * 6, { size: 3.2, font: 'ui', color: s.c('teal'), halo: true });
            }
          }
        });
        s.alpha(1 - s.ease('fell', 0.4), () => s.text('2006 to 2010: greedy, layer by layer', w / 2, h * 0.12, { size: 3.8, font: 'ui', weight: 600, color: s.c('--ink-2') }));
        s.alpha(s.ease('fell', 0.6, 0.3), () => {
          const y = h * 0.11;
          pill(s, 'ReLU + good init + batch norm', w / 2, y, 'teal', { size: 3.6, font: 'ui' });
          fit(s, 'deep nets train from random weights', w / 2, y + u * 9, w * 0.9, { size: 4.4, font: 'display', weight: 600 });
        });
      });
    }
    const nA = s.win('noise', 'gaps');
    if (nA > 0) {
      s.alpha(nA, () => {
        const r: Rect = [w * 0.06, h * 0.2, w * 0.88, h * 0.48];
        const g = aeBig(s, r, { noisy: true, out: 'seven' });
        s.text('noisy input', g.x0 + g.S / 2, g.cy + g.S / 2 + u * 4, { size: 3.3, font: 'ui', color: s.c('orange') });
        s.text('clean target', g.x1 + g.S / 2, g.cy + g.S / 2 + u * 4, { size: 3.3, font: 'ui', color: s.c('purple') });
        s.alpha(s.ease('noise', 0.6, 2.5), () => fit(s, 'the code must capture structure', w / 2, h * 0.84, w * 0.9, { size: 4.2, font: 'display', italic: true, color: s.c('--accent') }));
      });
    }
    const gA = s.ease('gaps', 0.6);
    if (gA > 0) {
      s.alpha(gA, () => {
        const tall = s.tall;
        const side = Math.min(tall ? w * 0.5 : w * 0.42, h * 0.62);
        const fx = tall ? w * 0.06 : w * 0.06;
        const fy = h * 0.2;
        const fr = new Frame(s, [fx, fy, side, side], [-1.05, 1.05, -1.05, 1.05], true);
        s.rrect(fx, fy, side, side, 1.5, { fill: s.tint('--ink', 0.03), stroke: s.tint('--ink', 0.2), lw: 0.3 });
        for (const [px, py, c] of CODES) fr.dot(px, py, 0.85, s.c(CODE_K[c]!));
        s.text('code space (z)', fx + side / 2, fy - u * 3.4, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        const st = s.ease('gaps', 0.6, 2.2);
        s.alpha(st, () => {
          const sx = fr.X(0.32);
          const sy = fr.Y(0.3);
          s.circle(sx, sy, u * 1.8, { fill: s.c('purple') });
          s.circle(fx + u * 2, fy + side + u * 4, u * 1.2, { fill: s.c('purple') });
          s.text('a random z', fx + u * 4, fy + side + u * 4, { size: 3.2, font: 'ui', color: s.c('purple'), align: 'left' });
          const ox = fx + side + u * 8;
          const T = Math.min(w - ox - u * 6, side * 0.55);
          s.arrow(sx + u * 2.5, sy, ox - u, fy + side / 2, s.c('--ink-3'), 0.4, 2);
          s.alpha(s.ease('gaps', 0.6, 3.6), () => {
            pix(s, ox, fy + side / 2 - T / 2, T, 8, (i, j) => GARBAGE[i * 8 + j]!, '--ink', { frame: 'red', lw: 0.5 });
            s.text('garbage', ox + T / 2, fy + side / 2 + T / 2 + u * 4, { size: 3.6, font: 'ui', weight: 600, color: s.c('red') });
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- VAE

/** Where the VAE scene's three parts sit: the code axis, the network box, and the data plot. */
function vaeLayout(s: Scene): { bellR: Rect; boxR: Rect; plotR: Rect; tall: boolean } {
  const { w, h } = s;
  if (s.tall)
    return {
      tall: true,
      bellR: [w * 0.08, h * 0.14, w * 0.84, h * 0.24],
      boxR: [w * 0.34, h * 0.45, w * 0.32, h * 0.1],
      plotR: [w * 0.22, h * 0.6, w * 0.56, h * 0.36],
    };
  return {
    tall: false,
    bellR: [w * 0.05, h * 0.3, w * 0.36, h * 0.34],
    boxR: [w * 0.44, h * 0.42, w * 0.14, h * 0.13],
    plotR: [w * 0.62, h * 0.22, w * 0.34, h * 0.52],
  };
}

const vae: SceneDef = {
  marks: {
    prior: { tex: String.raw`\symz \sim \mathcal{N}(0, 1)`, x: 0.5, y: 0.1, size: 4.4 },
    rep: { tex: String.raw`\symz = \symmu + \symsig\,\symeps`, x: 0.5, y: 0.12, size: 5.4 },
    grad: { tex: String.raw`\tfrac{\partial \symz}{\partial \symmu} = 1, \quad \tfrac{\partial \symz}{\partial \symsig} = \symeps`, x: 0.5, y: 0.12, size: 4.8 },
  },
  draw(s) {
    const { w, h, u } = s;
    const L = vaeLayout(s);
    // Parts A and B: the story, then the encoder's distribution.
    const abA = s.win('vae', 'coin');
    if (abA > 0) {
      s.alpha(abA, () => {
        const enc = s.since('encoder') >= 0;
        const fb = new Frame(s, L.bellR, [-3, 3, -0.06, 0.62]);
        const [bx, by, bw, bh] = L.bellR;
        s.line(bx, fb.Y(0), bx + bw, fb.Y(0), s.c('--axis'), 0.35);
        for (const t of [-2, 0, 2]) s.text(String(t), fb.X(t), fb.Y(0) + u * 3, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
        s.text('z', bx + bw + u * 1.5, fb.Y(0), { size: 3.8, italic: true, weight: 600, color: s.c('purple'), align: 'left' });
        const pA = s.ease('story', 0.6);
        s.alpha(pA, () => {
          bell(fb, 0, 1, '--ink-3', { fill: enc ? 0 : 0.08, dash: enc ? [1.2, 0.9] : undefined, width: 0.5 });
          s.text('prior', fb.X(enc ? -2.3 : 1.4), fb.Y(enc ? 0.12 : 0.3), { size: 3.2, font: 'ui', color: s.c('--ink-3'), align: 'left', halo: true });
        });
        s.show('prior', s.ease('story', 0.6, 1) * (1 - s.ease('encoder', 0.5)) * abA);
        // The plot of data space.
        const fp = new Frame(s, L.plotR, [-1.25, 1.25, -1, 1], true);
        s.alpha(s.ease('vae', 0.6), () => {
          s.rrect(L.plotR[0], L.plotR[1], L.plotR[2], L.plotR[3], 1.5, { fill: s.tint('--ink', 0.02), stroke: s.tint('--ink', 0.12), lw: 0.3 });
          for (let i = 0; i < 300; i += 2) fp.dot(VAE_X[2 * i]!, VAE_X[2 * i + 1]!, 0.6, s.tint('orange', 0.35));
          s.alpha(1 - s.win('logvar', 'coin'), () => s.text('data space', L.plotR[0] + L.plotR[2] / 2, L.plotR[1] + L.plotR[3] + u * 3.2, { size: 3, font: 'ui', color: s.c('--ink-3') }));
        });
        s.alpha(s.win('vae', 'story'), () => fit(s, 'variational autoencoder', w / 2, h * 0.08, w * 0.9, { size: 4.6, font: 'display', weight: 600 }));
        const [qx, qy, qw, qh] = L.boxR;
        const decA = s.ease('decode', 0.5) * (1 - s.ease('encoder', 0.5));
        const encA = s.ease('encoder', 0.5);
        s.alpha(decA, () => box(s, qx, qy, qw, qh, 'decoder', 'blue', { size: 3.4 }));
        s.alpha(encA, () => box(s, qx, qy, qw, qh, 'encoder', 'teal', { size: 3.4 }));
        // Story: one code, then many.
        const one = 0.62;
        const dropP = s.ease('story', 1.2, 3.5);
        s.alpha(s.win('story', 'encoder') * (dropP > 0 ? 1 : 0), () => {
          s.circle(fb.X(one), lerp(fb.Y(0.38), fb.Y(0), dropP), u * 1.4, { fill: s.c('purple') });
        });
        s.alpha(s.win('decode', 'encoder'), () => {
          const [ox, oy] = vaeDecode(one);
          const fromX = fb.X(one);
          const fromY = fb.Y(0);
          if (L.tall) {
            s.arrow(fromX, fromY + u * 4, qx + qw / 2, qy - u, s.c('--ink-3'), 0.4, 2);
            s.arrow(qx + qw / 2, qy + qh + u, fp.X(ox), fp.Y(oy) - u * 2, s.c('--ink-3'), 0.4, 2);
          } else {
            s.arrow(fromX + u * 2, fromY, qx - u, qy + qh / 2, s.c('--ink-3'), 0.4, 2);
            s.arrow(qx + qw + u, qy + qh / 2, fp.X(ox) - u * 2, fp.Y(oy), s.c('--ink-3'), 0.4, 2);
          }
          s.alpha(s.ease('decode', 0.4, 1), () => fp.dot(ox, oy, 1.5, s.c('blue'), true));
        });
        s.alpha(s.win('easy', 'encoder'), () => {
          const n = Math.floor(clamp01(s.prog('easy') * 1.2) * 60);
          for (let i = 0; i < n; i++) {
            const z = clamp01((VAE_GENZ[i]! + 3) / 6) * 6 - 3;
            fb.dot(z, 0.015, 0.7, s.c('purple'));
            const [ox, oy] = [VAE_GEN[2 * i]!, VAE_GEN[2 * i + 1]!];
            fp.dot(ox, oy, 0.9, s.c('blue'));
          }
          s.text('sample, decode', L.tall ? qx - u * 2 : w / 2, L.tall ? qy + qh / 2 : h * 0.24, { size: 3.4, font: 'ui', color: s.c('--ink-2'), align: L.tall ? 'right' : 'center', halo: true });
        });
        // Encoder: from a point to a bell over codes.
        s.alpha(encA, () => {
          const xi = 40;
          const px = VAE_X[2 * xi]!;
          const py = VAE_X[2 * xi + 1]!;
          fp.dot(px, py, 1.6, s.c('orange'), true);
          s.text('x', fp.X(px) + u * 2.5, fp.Y(py) - u * 2, { size: 4, italic: true, weight: 600, color: s.c('orange'), halo: true });
          if (L.tall) {
            s.arrow(fp.X(px), fp.Y(py) - u * 2, qx + qw / 2, qy + qh + u, s.c('--ink-3'), 0.4, 2);
            s.arrow(qx + qw / 2, qy - u, fb.X(0.7), fb.Y(0) + u * 4, s.c('--ink-3'), 0.4, 2);
          } else {
            s.arrow(fp.X(px) - u * 2, fp.Y(py), qx + qw + u, qy + qh / 2, s.c('--ink-3'), 0.4, 2);
            s.arrow(qx - u, qy + qh / 2, fb.X(1.4), fb.Y(0.5), s.c('--ink-3'), 0.4, 2);
          }
          const distA = s.ease('dist', 0.6);
          s.alpha(distA, () => {
            const sd = lerp(0.35, 0.1, s.ease('give', 0.8));
            bell(fb, 0.7, sd, 'teal', { fill: 0.25, width: 0.6, scale: 0.5 / gauss(0, 0, sd) });
            const topY = fb.Y(0.53);
            s.line(fb.X(0.7), fb.Y(0), fb.X(0.7), topY, s.c('teal'), 0.45, [1, 0.7]);
            s.text(`μ = 0.7`, fb.X(0.7) + u * 1.5, topY - u * 2.5, { size: 3.4, font: 'mono', weight: 600, color: s.c('teal'), align: 'left', halo: true });
            const sy = fb.Y(0.5 * 0.6);
            s.line(fb.X(0.7), sy, fb.X(0.7 + sd), sy, s.c('green'), 0.5);
            s.text(`σ = ${fmt(Math.round(sd * 100) / 100, 2)}`, fb.X(0.7 + sd) + u * 1.5, sy, { size: 3.4, font: 'mono', weight: 600, color: s.c('green'), align: 'left', halo: true });
          });
        });
        // log sigma squared: any number in, a positive spread out.
        const lA = s.win('logvar', 'coin');
        if (lA > 0) {
          s.alpha(lA, () => {
            const [rx, ry, rw, rh] = L.plotR;
            s.rrect(rx - u, ry - u, rw + 2 * u, rh + 2 * u, 1.5, { fill: s.c('--card') });
            const fl = new Frame(s, [rx + u * 6, ry + u * 3, rw - u * 9, rh - u * 10], [-4, 2, 0, 2.8]);
            s.line(fl.X(-4), fl.Y(0), fl.X(2), fl.Y(0), s.c('--axis'), 0.35);
            s.line(fl.X(0), fl.Y(0), fl.X(0), fl.Y(2.8), s.c('--axis'), 0.3);
            fl.fn((v) => Math.exp(0.5 * v), s.c('green'), 0.6, -4, 2);
            s.text('log σ²', fl.X(-1), fl.Y(0) + u * 3.4, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
            s.text('σ', fl.X(0) - u * 2, fl.Y(2.4), { size: 3.6, italic: true, weight: 600, color: s.c('green') });
            s.text('always > 0', fl.X(-3.8), fl.Y(1.6), { size: 3.2, font: 'ui', color: s.c('green'), align: 'left' });
          });
        }
      });
    }
    // Part C: the coin flip, then the trick.
    const cA = s.win('coin', 'trick');
    if (cA > 0) {
      s.alpha(cA, () => {
        const nodes: [string, K][] = [
          ['x', 'orange'],
          ['encoder', 'teal'],
          ['μ, σ', 'teal'],
          ['sample', 'slate'],
          ['z', 'purple'],
          ['decoder', 'blue'],
          ['loss', 'red'],
        ];
        const tall = s.tall;
        const perRow = tall ? 4 : 7;
        const nw = (w * 0.9) / perRow;
        const bw = nw * 0.8;
        const bh = u * 9;
        const rowY = (r: number) => (tall ? h * (0.3 + 0.3 * r) : h * 0.42);
        const pos = (i: number): [number, number] => {
          const r = tall && i >= 3 ? 1 : 0;
          const col = tall ? (r ? i - 3 : i) : i;
          return [w * 0.05 + col * nw + (nw - bw) / 2, rowY(r)];
        };
        nodes.forEach(([name, k], i) => {
          const [x, cy] = pos(i);
          box(s, x, cy - bh / 2, bw, bh, name, k, { size: Math.min(3.6, (bw / u) * 0.22) });
          if (i < nodes.length - 1) {
            const [nx, ny] = pos(i + 1);
            if (ny === cy) s.arrow(x + bw + u * 0.4, cy, nx - u * 0.4, cy, s.c('--ink-3'), 0.35, 1.4);
            else s.arrow(x + bw / 2, cy + bh / 2 + u * 0.5, nx + bw / 2, ny - bh / 2 - u * 0.5, s.c('--ink-3'), 0.35, 1.6);
          }
        });
        const [lx, ly] = pos(6);
        const [sx] = pos(3);
        const y = ly + bh / 2 + u * 6;
        const p = smooth(s.prog('coin') * 1.3 - 0.2);
        const xL = lx + bw / 2;
        const xS = sx + bw / 2;
        s.line(xL, y, lerp(xL, xS + bw * 0.4, p), y, s.c('teal'), 0.5, [1.2, 0.8]);
        s.text('gradient', (xL + xS) / 2 + bw * 0.5, y + u * 3.6, { size: 3.2, font: 'ui', color: s.c('teal') });
        s.alpha(s.ease('coin', 0.4, 2.4), () => {
          cross(s, xS + bw * 0.25, y, u * 2.6);
          s.text('random: no gradient', xS + bw * 0.25, y + u * 8, { size: 3.4, font: 'ui', weight: 600, color: s.c('red'), align: tall ? 'left' : 'center' });
        });
      });
    }
    const tA = s.ease('trick', 0.6);
    if (tA > 0) {
      let mu = 1.2;
      let sg = 0.6;
      if (s.since('grads') >= 0) {
        const q = s.since('grads');
        mu = 1.2 - 0.9 * Math.sin(Math.min(1, q / 4) * Math.PI) ** 2 + 0.25 * Math.sin(q * 1.2) * smooth((q - 4) / 1);
        sg = 0.6 + 0.45 * Math.sin(clamp01((q - 1.5) / 4) * Math.PI);
      }
      s.slot('mu', fmt(Math.round(mu * 100) / 100, 2));
      s.slot('sigma', fmt(Math.round(sg * 100) / 100, 2));
      const p = s.since('grads') >= 0 ? 1 : s.prog('trick');
      const stretch = smooth((p - 0.3) / 0.25);
      const shift = smooth((p - 0.62) / 0.25);
      const m = mu * shift;
      const sd = lerp(1, sg, stretch);
      s.alpha(tA, () => {
        const fr = new Frame(s, area(s, 0.2, 0.05), [-4, 4, -0.66, 1.2]);
        bell(fr, 0, 1, '--ink-3', { fill: 0, dash: [1.2, 0.9], width: 0.5 });
        bell(fr, m, sd, 'teal', { fill: 0.22, width: 0.6 });
        const zy = -0.2;
        const ey = -0.5;
        s.line(fr.X(-4), fr.Y(zy), fr.X(4), fr.Y(zy), s.tint('--ink', 0.25), 0.25);
        s.line(fr.X(-4), fr.Y(ey), fr.X(4), fr.Y(ey), s.tint('--ink', 0.25), 0.25);
        s.text('z', fr.X(-3.9), fr.Y(zy) - u * 2.4, { size: 3.8, italic: true, weight: 650, color: s.c('purple'), align: 'left' });
        s.text('ε', fr.X(-3.9), fr.Y(ey) - u * 2.4, { size: 3.8, italic: true, weight: 650, color: s.c('slate'), align: 'left' });
        const nA = s.ease('trick', 0.6, 0.4);
        EPS12.forEach((e, i) => {
          s.alpha(nA * clamp01(nA * 12 - i), () => {
            const z = m + sd * e;
            s.line(fr.X(e), fr.Y(ey), fr.X(z), fr.Y(zy), s.tint('slate', 0.35), 0.25);
            fr.dot(e, ey, 1, s.c('slate'));
            fr.dot(z, zy, 1.1, s.c('purple'));
          });
        });
        s.text('standard bell', fr.X(-3.9), fr.Y(1.08), { size: 3.1, font: 'ui', color: s.c('--ink-3'), align: 'left' });
        s.text('the encoder\'s bell', fr.X(-3.9), fr.Y(0.94), { size: 3.1, font: 'ui', color: s.c('teal'), align: 'left' });
        const lab = stretch < 0.5 ? 'ε' : shift < 0.5 ? 'σ · ε' : 'μ + σ · ε';
        s.alpha(s.ease('trick', 0.5, 1.5) * (1 - s.ease('grads', 0.4)), () => pill(s, lab, w / 2, h * 0.14, 'purple', { size: 3.8 }));
      });
      s.show('grad', tA * s.ease('grads', 0.6, 0.4));
    }
  },
};

const EPS12 = (() => {
  const r = new Rng(5);
  return Array.from({ length: 12 }, () => r.randn());
})();
/** The 200 codes the stored VAE samples were decoded from (Rng 77), in the same order. */
const VAE_GENZ = (() => {
  const r = new Rng(77);
  return Array.from({ length: 200 }, () => r.randn());
})();

// ---------------------------------------------------------------- KL

const klOf = (mu: number, sd: number) => 0.5 * (mu * mu + sd * sd - 1 - Math.log(sd * sd));
const SCATTER = [-3.1, -1.75, 0.45, 1.9, 3.25];

const kl: SceneDef = {
  marks: {
    form: { tex: String.raw`D_{\mathrm{KL}} = \tfrac{1}{2}\big(\symmu^2 + \symsig^2 - 1 - \log \symsig^2\big)`, x: 0.5, y: 0.1, size: 5 },
    elbo: {
      tex: String.raw`\begin{aligned}\log p(\symx) \ge\; &\underbrace{\mathbb{E}_{\symz \sim q}\big[\log p(\symx \mid \symz)\big]}_{\text{reconstruct well}} \\ &- \underbrace{D_{\mathrm{KL}}\big(q(\symz \mid \symx)\,\Vert\,p(\symz)\big)}_{\text{stay near the prior}}\end{aligned}`,
      x: 0.5,
      y: 0.34,
      size: 4.6,
    },
    loss: { tex: String.raw`\symL = \text{reconstruction error} + D_{\mathrm{KL}}`, x: 0.5, y: 0.64, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const fr = new Frame(s, area(s, 0.24, 0.05), [-4.2, 4.2, -0.08, 1]);
    const axis = () => {
      s.line(fr.X(-4.2), fr.Y(0), fr.X(4.2), fr.Y(0), s.c('--axis'), 0.35);
      for (const t of [-4, -2, 0, 2, 4]) s.text(String(t), fr.X(t), fr.Y(0) + u * 3, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
      s.text('z', fr.X(4.2) - u, fr.Y(0) - u * 2.6, { size: 3.8, italic: true, weight: 650, color: s.c('purple') });
    };
    // Left alone: narrow bells, scattered, with gaps.
    const aA = s.win('loose', 'kl');
    if (aA > 0) {
      s.alpha(aA, () => {
        axis();
        bell(fr, 0, 1, '--ink-3', { fill: 0, dash: [1.2, 0.9], width: 0.5, scale: 1.3 });
        s.text('prior', fr.X(0.9), fr.Y(0.56), { size: 3.2, font: 'ui', color: s.c('--ink-3'), align: 'left', halo: true });
        const p = smooth(s.prog('loose') * 1.3);
        SCATTER.forEach((c) => {
          const sd = lerp(0.9, 0.15, p);
          bell(fr, lerp(c * 0.25, c, p), sd, 'teal', { fill: 0.2, width: 0.5, scale: 0.85 / gauss(0, 0, sd) * lerp(0.5, 1, p) });
        });
        s.text('the encoder\'s bells, left alone', w / 2, h * 0.15, { size: 3.8, font: 'ui', weight: 600, color: s.c('teal') });
        const gA = s.ease('gaps', 0.6, 0.6);
        s.alpha(gA, () => {
          const zx = -0.62;
          const yy = lerp(0.6, 0.02, smooth((s.since('gaps') - 0.6) / 1));
          fr.dot(zx, yy, 1.4, s.c('purple'), true);
          s.alpha(s.ease('gaps', 0.4, 1.8), () => {
            cross(s, fr.X(zx), fr.Y(0) - u * 6, u * 2.2);
            s.text('a random code lands in a gap', fr.X(zx), fr.Y(0) + u * 8, { size: 3.4, font: 'ui', color: s.c('red'), halo: true });
          });
        });
      });
    }
    // One bell against the prior, and its KL.
    const bA = s.win('kl', 'fill');
    if (bA > 0) {
      let mu = 1.2;
      let sd = 0.6;
      if (s.since('kldef') >= 0 && s.since('closed') < 0) {
        const p = smooth(s.prog('kldef') / 0.55);
        mu = lerp(1.2, 0, p);
        sd = lerp(0.6, 1, p);
      }
      if (s.since('closed') >= 0) {
        const p = s.ease('closed', 1.2);
        mu = lerp(0, 1.2, p);
        sd = lerp(1, 0.6, p);
      }
      if (s.since('mu') >= 0) {
        mu = lerp(1.2, 0, smooth(s.prog('mu') / 0.8));
        sd = 0.6;
      }
      if (s.since('sigma') >= 0) {
        mu = 0;
        const p = s.prog('sigma');
        sd = p < 0.4 ? lerp(0.6, 1, smooth(p / 0.35)) : p < 0.75 ? lerp(1, 1.7, smooth((p - 0.45) / 0.3)) : lerp(1.7, 1, smooth((p - 0.8) / 0.2));
      }
      const v = klOf(mu, sd);
      s.slot('mu', fmt(Math.round(mu * 100) / 100, 2));
      s.slot('sigma', fmt(Math.round(sd * 100) / 100, 2));
      s.slot('kl', fmt(v, 2));
      s.alpha(bA, () => {
        axis();
        bell(fr, 0, 1, '--ink-3', { fill: 0, dash: [1.2, 0.9], width: 0.5, scale: 1.3 });
        bell(fr, mu, sd, 'teal', { fill: 0.25, width: 0.6, scale: 1.3 });
        s.text('prior', fr.X(-2.4), fr.Y(0.3), { size: 3.2, font: 'ui', color: s.c('--ink-3'), halo: true });
        s.text('q(z | x)', fr.X(mu + sd + 0.3), fr.Y(Math.min(0.85, 1.3 * gauss(0, 0, sd) * 0.6)), { size: 3.3, font: 'mono', color: s.c('teal'), align: 'left', halo: true });
        // KL as two stacked parts.
        const bx = w * 0.06;
        const by = h * 0.25;
        const bw = Math.min(w * 0.3, u * 34);
        const bh = u * 4.5;
        const scale = bw / 1.6;
        const m2 = 0.5 * mu * mu;
        const s2 = v - m2;
        s.text(`KL = ${v.toFixed(2)}`, bx, by - u * 3, { size: 3.8, font: 'mono', weight: 650, color: s.c('red'), align: 'left', halo: true });
        s.rrect(bx, by, bw, bh, 0.6, { fill: s.tint('--ink', 0.05), stroke: s.tint('--ink', 0.2), lw: 0.25 });
        if (m2 > 0.002) s.rrect(bx, by, Math.min(bw, m2 * scale), bh, 0.5, { fill: s.tint('teal', 0.7) });
        if (s2 > 0.002) s.rrect(bx + Math.min(bw, m2 * scale), by, Math.min(bw - Math.min(bw, m2 * scale), s2 * scale), bh, 0.5, { fill: s.tint('green', 0.7) });
        s.alpha(s.ease('mu', 0.5), () => {
          s.text('μ part', bx, by + bh + u * 3.2, { size: 3, font: 'ui', color: s.c('teal'), align: 'left', halo: true });
          s.text('σ part', bx + u * 12, by + bh + u * 3.2, { size: 3, font: 'ui', color: s.c('green'), align: 'left', halo: true });
        });
        s.alpha(s.win('kldef', 'closed'), () => {
          if (v < 0.02) {
            check(s, bx + bw + u * 4, by + bh / 2, u * 2.2);
            s.text('match: KL = 0', bx + bw + u * 7.5, by + bh / 2, { size: 3.3, font: 'ui', weight: 600, color: s.c('green'), align: 'left', halo: true });
          }
        });
      });
      s.show('form', bA * s.ease('closed', 0.6));
    }
    // Pulled toward the prior: bells overlap and fill it.
    const fA = s.win('fill', 'elbo');
    if (fA > 0) {
      s.alpha(fA, () => {
        axis();
        const p = smooth(s.prog('fill') * 1.6);
        const cs = [-3.1, -2.3, -1.75, -0.8, 0.45, 1.2, 1.9, 2.6, 3.25];
        const sd = lerp(0.15, 0.5, p);
        const c2 = cs.map((c) => c * lerp(1, 0.42, p));
        const mix = (z: number) => c2.reduce((a, c) => a + gauss(z, c, sd), 0) / c2.length;
        const c = s.ctx;
        fr.clip(() => {
          c.beginPath();
          c.moveTo(fr.X(-4.2), fr.Y(0));
          for (let i = 0; i <= 160; i++) {
            const z = -4.2 + (8.4 * i) / 160;
            c.lineTo(fr.X(z), fr.Y(1.3 * mix(z)));
          }
          c.lineTo(fr.X(4.2), fr.Y(0));
          c.fillStyle = s.tint('teal', 0.18);
          c.fill();
        });
        c2.forEach((cc) => bell(fr, cc, sd, 'teal', { fill: 0, width: 0.35, scale: (0.85 / gauss(0, 0, sd)) * lerp(1, 0.32, p) }));
        bell(fr, 0, 1, '--ink-3', { fill: 0, dash: [1.2, 0.9], width: 0.5, scale: 1.3 });
        s.text('pulled toward the prior', w / 2, h * 0.15, { size: 3.8, font: 'ui', weight: 600, color: s.c('teal') });
        s.alpha(s.ease('fill', 0.5, 3.2), () => {
          const zx = -0.62;
          fr.dot(zx, 0.02, 1.4, s.c('purple'), true);
          check(s, fr.X(zx), fr.Y(0) - u * 7, u * 2.2);
          s.text('a random code lands on covered ground', fr.X(0), fr.Y(0) + u * 8, { size: 3.4, font: 'ui', color: s.c('green'), halo: true });
        });
      });
    }
    // The ELBO, the loss, and the balance.
    const eA = s.ease('elbo', 0.6);
    if (eA > 0) {
      s.show('elbo', eA);
      s.alpha(s.win('elbo', 'terms'), () => fit(s, 'push up a floor under how probable the data looks', w / 2, h * 0.56, w * 0.9, { size: 3.6, font: 'ui', italic: true, color: s.c('--ink-2') }));
      s.show('loss', s.ease('terms', 0.6));
      s.alpha(s.ease('balance', 0.6), () => {
        const cx = w / 2;
        const cy = h * 0.84;
        const len = Math.min(w * 0.36, u * 44);
        const ang = 0.12 * Math.sin(s.since('balance') * 1.4);
        const dx = Math.cos(ang) * len;
        const dy = Math.sin(ang) * len;
        s.line(cx - dx, cy - dy, cx + dx, cy + dy, s.c('--ink-2'), 0.6);
        const c = s.ctx;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx - u * 2.5, cy + u * 5);
        c.lineTo(cx + u * 2.5, cy + u * 5);
        c.closePath();
        c.fillStyle = s.c('--ink-3');
        c.fill();
        pill(s, 'precise codes', cx - dx, cy - dy - u * 4, 'orange', { size: 3.2, font: 'ui' });
        pill(s, 'like the prior', cx + dx, cy + dy - u * 4, 'teal', { size: 3.2, font: 'ui' });
      });
    }
  },
};

// ---------------------------------------------------------------- the tiny VAE

const vaeLive: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const fr = new Frame(s, area(s, 0.13, 0.05), [-1.6, 1.6, -1.25, 1.25], true);
    let prog = 0;
    if (s.since('train') >= 0) prog = smooth(s.span('train', 'gen'));
    const [k0, k1, f] = blend(
      VAE_STEPS.map((_, i) => i / (VAE_STEPS.length - 1)),
      prog,
    );
    const curve = lerpArr(VAE_CURVES[k0]!, VAE_CURVES[k1]!, f);
    const step = Math.round(lerp(VAE_STEPS[k0]!, VAE_STEPS[k1]!, f));
    s.slot('step', step);
    const rec = lerp(VAE_REC[k0]!, VAE_REC[k1]!, f);
    const kv = lerp(VAE_KL[k0]!, VAE_KL[k1]!, f);
    s.slot('rec', Number.isFinite(rec) ? fmt(rec, 3) : '…');
    s.slot('kl', Number.isFinite(kv) ? fmt(kv, 3) : '…');
    const pA = 1 - s.ease('faces', 0.7);
    s.alpha(pA, () => {
      fr.grid(0.5, 0.8);
      for (let i = 0; i < 300; i++) fr.dot(VAE_X[2 * i]!, VAE_X[2 * i + 1]!, 0.75, s.tint('orange', 0.55));
      const cA = s.ease('curve', 0.6);
      s.alpha(cA, () => {
        for (let i = 0; i < VAE_ZN - 1; i++) {
          const z = vaeZ(i + 0.5);
          const a = Math.exp(-0.5 * z * z);
          s.line(fr.X(curve[2 * i]!), fr.Y(curve[2 * i + 1]!), fr.X(curve[2 * i + 2]!), fr.Y(curve[2 * i + 3]!), s.tint('purple', 0.2 + 0.8 * a), 0.75);
        }
      });
      const gA = s.ease('gen', 0.5);
      if (gA > 0) {
        const n = Math.floor(clamp01(s.prog('gen') * 1.4) * 200);
        for (let i = 0; i < n; i++) fr.dot(VAE_GEN[2 * i]!, VAE_GEN[2 * i + 1]!, 0.75, s.c('blue'));
      }
      const [vx0, , , vy1] = fr.view;
      const tx = fr.X(vx0) + u * 2;
      const ty = fr.Y(vy1) + u * 3;
      s.text(`step ${step}`, tx, ty, { size: 3.4, font: 'mono', color: s.c('--ink-2'), align: 'left', halo: true });
      const legend: [string, K, string][] = [
        ['data', 'orange', 'setup'],
        ['decoder(z)', 'purple', 'curve'],
        ['samples', 'blue', 'gen'],
      ];
      legend.forEach(([name, k, b], i) => {
        s.alpha(s.ease(b, 0.5), () => {
          const y = ty + u * (5 + 4.4 * i);
          s.circle(tx + u, y, u * 1, { fill: s.c(k) });
          s.text(name, tx + u * 3, y, { size: 3.2, font: 'ui', color: s.c('--ink-2'), align: 'left', halo: true });
        });
      });
      // A magnifier on one stretch of the arc.
      const mA = s.win('blur', 'faces');
      if (mA > 0) {
        s.alpha(mA, () => {
          const c0: [number, number] = [-0.97, 0.18];
          const rr = 0.2;
          const zoom = 2.6;
          const R = rr * zoom * fr.kx;
          const mx = fr.X(0.95);
          const my = fr.Y(0.08);
          s.circle(fr.X(c0[0]), fr.Y(c0[1]), rr * fr.kx, { stroke: s.c('--ink-2'), lw: 0.4 });
          s.line(fr.X(c0[0]) + rr * fr.kx, fr.Y(c0[1]), mx - R, my, s.tint('--ink', 0.4), 0.3, [1, 0.8]);
          const c = s.ctx;
          c.save();
          c.beginPath();
          c.arc(mx, my, R, 0, Math.PI * 2);
          c.fillStyle = s.c('--card');
          c.fill();
          c.clip();
          const Z = (x: number, y: number): [number, number] => [mx + (x - c0[0]) * zoom * fr.kx, my - (y - c0[1]) * zoom * fr.ky];
          for (let i = 0; i < 300; i++) {
            const [px, py] = Z(VAE_X[2 * i]!, VAE_X[2 * i + 1]!);
            s.circle(px, py, u * 1.1, { fill: s.tint('orange', 0.6) });
          }
          for (let i = 0; i < 200; i++) {
            const [px, py] = Z(VAE_GEN[2 * i]!, VAE_GEN[2 * i + 1]!);
            s.circle(px, py, u * 0.9, { fill: s.c('blue') });
          }
          c.restore();
          s.circle(mx, my, R, { stroke: s.c('--ink-2'), lw: 0.5 });
          const lx = fr.X(fr.view[1]) - u * 2;
          s.text('data: thick', lx, my + R + u * 3.4, { size: 3.2, font: 'ui', color: s.c('orange'), align: 'right', halo: true });
          s.text('samples: a thin line', lx, my + R + u * 7.4, { size: 3.2, font: 'ui', color: s.c('blue'), align: 'right', halo: true });
        });
      }
    });
    // Faces morphing through a smooth latent space.
    const fA = s.ease('faces', 0.7);
    if (fA > 0) {
      s.alpha(fA, () => {
        const n = 5;
        const r = Math.min((w * 0.86) / n / 2.3, h * 0.12);
        const gap = (w - n * 2 * r) / (n + 1);
        const cy = h * 0.46;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const a = s.ease('faces', 0.4, 0.6 + i * 0.35);
          s.alpha(a, () => face(s, gap + r + i * (2 * r + gap), cy, r, { smile: lerp(-0.4, 1, t), hair: lerp(0.9, 0.1, t), tone: lerp(0.2, 0.7, t), blur: Math.max(1.2, r * 0.07) }));
        }
        s.arrow(gap, cy + r * 1.5, w - gap, cy + r * 1.5, s.c('purple'), 0.45, 2.2);
        s.text('a straight walk through z', w / 2, cy + r * 1.5 + u * 4.4, { size: 3.6, font: 'ui', color: s.c('purple') });
        s.text('blurry, but smooth', w / 2, cy - r * 2.2, { size: 4.2, font: 'display', weight: 600 });
      });
    }
  },
};

export const aeScenes: Record<string, SceneDef> = { unlabeled, autoencoder, vae, kl, 'vae-live': vaeLive };
