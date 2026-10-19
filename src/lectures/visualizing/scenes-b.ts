import { CIFAR_CLASSES } from '../../core/data';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { type Assets, assets, atlas, codeOf, heatCanvas, mapCanvas, occludedCanvas, occludedProb, occlusion, once, sampleImg, saliency, testImg } from './data';
import { type K, area, cap, colorbar, fit, loading, pic, pill, rfBox, ring } from './kit';

// ---------------------------------------------------------------- top images

type Unit = [number, number, number, number][];

/** Where the top-eight grid sits: 2 x 4 pictures with a label under each. */
function topGrid(s: Scene) {
  const [rx, ry, rw, rh] = area(s, 0.2, 0.05);
  const gap = s.u * 2.4;
  const lab = s.u * 6;
  const cell = Math.min((rw - gap * 3) / 4, (rh - 2 * lab - gap) / 2);
  const gx = rx + (rw - (cell * 4 + gap * 3)) / 2;
  const gy = ry + (rh - (2 * (cell + lab) + gap)) / 2;
  return { cell, at: (k: number): [number, number] => [gx + (k % 4) * (cell + gap), gy + Math.floor(k / 4) * (cell + lab + gap)], gx, gy, gw: cell * 4 + gap * 3 };
}

function drawTop(s: Scene, a: Assets, list: Unit, rfA: number): void {
  const { cell, at } = topGrid(s);
  list.forEach(([i, yy, xx], k) => {
    const [x, y] = at(k);
    pic(s, sampleImg(a, i), x, y, cell);
    if (rfA > 0) rfBox(s, x, y, cell, a.net.receptiveField('pool3', yy, xx), rfA);
    cap(s, CIFAR_CLASSES[a.an.labels[i]!]!, x + cell / 2, y + cell + s.u * 3, { size: 3.2 });
  });
}

const topImages: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const a = assets(s);
    if (!a) return loading(s);
    const ch20 = a.an.units.pool3![20]!;
    const rand9 = a.an.units.pool3_rand![9]!;
    // Twelve hundred images, and the eight that win.
    const [rx, ry, rw, rh] = area(s, 0.13, 0.05);
    const at = atlas('sample1200', 1200, 40, (i) => sampleImg(a, i));
    const aw = Math.min(rw, (rh * 40) / 30);
    const ah = (aw * 30) / 40;
    const ax = rx + (rw - aw) / 2;
    const ay = ry + (rh - ah) / 2;
    const ts = aw / 40;
    const fly = s.ease('ch20', 1.2);
    const atA = s.win('idea', 'ch20', 0.8);
    s.alpha(atA, () => {
      pic(s, at, ax, ay, aw, ah);
      const hl = s.ease('idea', 0.6, 0.7 * (s.end('idea') - s.at('idea')));
      s.alpha(hl, () =>
        ch20.forEach(([i]) => {
          const x = ax + (i % 40) * ts;
          const y = ay + Math.floor(i / 40) * ts;
          ring(s, x, y, ts, ts, '#ffd400', 0.5);
        }),
      );
    });
    const gA = s.win('ch20', 'space');
    if (gA > 0) {
      const { cell, at: cellAt, gx, gy, gw } = topGrid(s);
      s.alpha(gA, () => {
        pill(s, 'pool3, channel 20', gx + gw / 2, gy - u * 5, 'purple', { size: 3.4 });
        ch20.forEach(([i, yy, xx], k) => {
          const [tx, ty] = cellAt(k);
          const sx = ax + (i % 40) * ts;
          const sy = ay + Math.floor(i / 40) * ts;
          const x = lerp(sx, tx, fly);
          const y = lerp(sy, ty, fly);
          const size = lerp(ts, cell, fly);
          pic(s, sampleImg(a, i), x, y, size);
          rfBox(s, x, y, size, a.net.receptiveField('pool3', yy, xx), s.ease('rf', 0.6));
          s.alpha(fly, () => cap(s, CIFAR_CLASSES[a.an.labels[i]!]!, x + size / 2, y + size + u * 3, { size: 3.2 }));
        });
      });
    }
    // One axis of a 64-dimensional space, and a random direction through it.
    const sA = s.win('space', 'same');
    if (sA > 0) {
      const side = Math.min(rw * 0.7, rh * 0.8);
      const ox = w / 2 - side / 2 + u * 4;
      const oy = ry + (rh + side) / 2 - u * 2;
      const rng = new Rng(4);
      s.alpha(sA, () => {
        s.line(ox, oy, ox + side, oy, s.c('--axis'), 0.4);
        s.line(ox, oy, ox, oy - side, s.c('--axis'), 0.4);
        for (let k = 0; k < 70; k++) {
          const px = Math.abs(rng.randn()) * 0.22 + 0.08;
          const py = Math.abs(rng.randn()) * 0.22 + 0.08;
          s.circle(ox + px * side, oy - py * side, u * 0.75, { fill: s.tint('--ink-3', 0.55) });
        }
        cap(s, 'channel 20', ox + side, oy + u * 4, { align: 'right', size: 3.2, color: s.c('purple'), weight: 650 });
        s.text('channel 45', ox - u * 2.5, oy - side, { size: 3.2, font: 'ui', weight: 650, color: s.c('--ink-3'), align: 'right' });
        s.text('…and 62 more axes', ox + u * 3, oy - side + u * 1, { size: 3, font: 'ui', italic: true, color: s.c('--ink-3'), align: 'left' });
        s.alpha(s.ease('space', 0.6, 0.55 * (s.end('space') - s.at('space'))), () => s.arrow(ox, oy, ox + side * 0.86, oy, s.c('purple'), 0.8, 3));
        s.alpha(s.ease('random', 0.6, 0.8), () => {
          const ang = 0.72;
          s.arrow(ox, oy, ox + Math.cos(ang) * side * 0.85, oy - Math.sin(ang) * side * 0.85, s.c('gold'), 0.8, 3);
          cap(s, 'a random direction', ox + Math.cos(ang) * side * 0.6 + u * 2, oy - Math.sin(ang) * side * 0.6, { align: 'left', size: 3.3, color: s.c('gold'), weight: 650 });
        });
      });
    }
    const rA = s.win('same', 'count');
    if (rA > 0) {
      const { gx, gy, gw } = topGrid(s);
      s.alpha(rA, () => {
        pill(s, 'pool3, a random direction', gx + gw / 2, gy - u * 5, 'gold', { size: 3.4 });
        drawTop(s, a, rand9, 1);
      });
    }
    // How coherent: shared labels in the top eight.
    const cA = s.ease('count', 0.6);
    if (cA > 0) {
      const items: [string, number, K][] = [
        ['one channel', 4.1, 'purple'],
        ['random direction', 4.0, 'gold'],
        ['random images', 2.4, 'slate'],
      ];
      const base = ry + rh * 0.72;
      const top = ry + rh * 0.12;
      const bw = Math.min(rw / 5, u * 20);
      s.alpha(cA * (1 - 0.6 * s.ease('meaning', 0.6)), () => {
        const t = 'top 8 sharing one label, on average';
        s.text(t, w / 2, ry + u, { size: fit(s, t, rw, 3.6, 'ui'), font: 'ui', color: s.c('--ink-2') });
        s.line(rx, base, rx + rw, base, s.c('--axis'), 0.35);
        items.forEach(([name, v, k], i) => {
          const cx = rx + rw * (0.2 + 0.3 * i);
          const g = s.ease('count', 0.7, 0.3 + i * 0.9);
          const bh = ((base - top) * v * g) / 8;
          s.rrect(cx - bw / 2, base - bh, bw, bh, 0.8, { fill: s.tint(k, 0.6) });
          s.alpha(g, () => s.text(v.toFixed(1), cx, base - bh - u * 3, { size: 4.4, font: 'mono', weight: 600, color: s.c(k) }));
          s.text(name, cx, base + u * 4, { size: fit(s, name, rw * 0.3, 3.4, 'ui'), font: 'ui', weight: 600 });
          s.text('of 8', cx, base + u * 8, { size: 3, font: 'ui', color: s.c('--ink-3') });
        });
      });
      s.alpha(s.ease('meaning', 0.7), () => {
        const t1 = 'single neurons are not special;';
        const t2 = 'meaning lives in the whole space';
        const fs = fit(s, t1, w * 0.86, 5.4, 'display', 600);
        s.rrect(w * 0.06, h * 0.4, w * 0.88, fs * u * 3.6, 2.5, { fill: s.c('--card'), stroke: s.c('--accent'), lw: 0.45 });
        s.text(t1, w / 2, h * 0.4 + fs * u * 1.2, { size: fs, font: 'display', weight: 600 });
        s.text(t2, w / 2, h * 0.4 + fs * u * 2.5, { size: fs, font: 'display', weight: 600, color: s.c('--accent') });
      });
    }
  },
};

// ---------------------------------------------------------------- t-SNE

const Q = 13;

/** A pool3 code as a 32 x 32 picture: its 64 maps of 4 x 4, tiled 8 x 8. */
function codeCanvas(a: Assets, i: number): HTMLCanvasElement {
  return once(`codepic-${i}`, () => {
    const f = codeOf(a, i);
    const tiled = new Float32Array(1024);
    for (let c = 0; c < 64; c++)
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) tiled[(Math.floor(c / 8) * 4 + y) * 32 + (c % 8) * 4 + x] = f[c * 16 + y * 4 + x]!;
    let hi = 0;
    for (const v of tiled) hi = Math.max(hi, v);
    return mapCanvas(tiled, 0, 32, hi);
  });
}

const dist = (p: Float32Array, q: Float32Array): number => {
  let d = 0;
  for (let k = 0; k < p.length; k++) d += (p[k]! - q[k]!) ** 2;
  return Math.sqrt(d);
};

/** Image-space t-SNE positions, eased between the two embeddings. */
function tsnePos(a: Assets, m: number): (i: number) => [number, number] {
  const s0 = m * m * (3 - 2 * m);
  return (i) => {
    const p = a.an.tsne.codes[i]!;
    const q = a.an.tsne.pixels[i]!;
    return [lerp(p[0], q[0], s0), lerp(p[1], q[1], s0)];
  };
}

const tsne: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const a = assets(s);
    if (!a) return loading(s);
    const [rx, ry, rw, rh] = area(s, 0.12, 0.05);
    const toPix = s.since('caveat') >= 0 ? 0 : s.ease('pixels', 1.4, 0.3);
    s.slot('feats', toPix > 0.5 ? 'P' : 'F');
    // A code, a near code, a far code.
    const cA = s.win('code', 'squash');
    if (cA > 0) {
      const near = a.an.nn.codes[Q]![0]!;
      const far = once('far', () => {
        let best = 0;
        let bd = -1;
        for (let i = 0; i < 1000; i += 7) {
          if (a.an.labels[i] !== 0) continue;
          const d = dist(codeOf(a, Q), codeOf(a, i));
          if (d > bd) [bd, best] = [d, i];
        }
        return best;
      });
      const rows: [number, string][] = [
        [Q, 'this horse'],
        [near, 'another horse'],
        [far, 'a plane'],
      ];
      const ps = Math.min(rh / 3.6, rw * 0.2);
      const gap = (rh - 3 * ps) / 3;
      const x0 = rx + rw * 0.06;
      s.alpha(cA, () => {
        rows.forEach(([i, name], r) => {
          const ra = r === 0 ? 1 : s.ease('close', 0.6, (r - 1) * 0.8);
          if (ra <= 0) return;
          const y = ry + gap / 2 + r * (ps + gap);
          s.alpha(ra, () => {
            pic(s, sampleImg(a, i), x0, y, ps);
            cap(s, name, x0 + ps / 2, y + ps + u * 2.8, { size: 3 });
            s.arrow(x0 + ps + u * 2, y + ps / 2, x0 + ps + u * 9, y + ps / 2, s.c('--ink-3'), 0.4, 2);
            pic(s, codeCanvas(a, i), x0 + ps + u * 11, y, ps, ps, s.c('green'));
            if (r === 0) cap(s, '1,024 numbers', x0 + ps * 1.5 + u * 11, y + ps + u * 2.8, { size: 3, font: 'mono', color: s.c('green') });
            if (r > 0) {
              const d = dist(codeOf(a, Q), codeOf(a, i));
              const tx = x0 + 2 * ps + u * 15;
              s.text(`distance ${d.toFixed(2)}`, tx, y + ps * 0.4, { size: fit(s, 'distance 0.00', rx + rw - tx, 3.6, 'mono'), font: 'mono', weight: 600, color: s.c(r === 1 ? 'green' : 'red'), align: 'left' });
              s.text(r === 1 ? 'similar' : 'different', tx, y + ps * 0.4 + u * 5, { size: 3.2, font: 'ui', color: s.c('--ink-3'), align: 'left' });
            }
          });
        });
      });
    }
    // The map.
    const mA = s.ease('squash', 0.6) * (1 - 0.95 * s.win('nn', 'caveat'));
    if (mA > 0) {
      const at = atlas('sample1000', 1000, 40, (i) => sampleImg(a, i));
      const th = Math.max(s.u * 2.4, Math.min(rw, rh) / 26);
      const pos = tsnePos(a, toPix);
      const sq = smooth(clamp01(s.prog('squash') * 1.3));
      const X = (px: number) => rx + rw / 2 + px * (rw / 2 - th / 2);
      const Y = (py: number) => ry + rh / 2 - py * (rh / 2 - th / 2);
      s.alpha(mA, () => {
        const ctx = s.ctx;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (let i = 0; i < 1000; i++) {
          const [px, py] = pos(i);
          const gx = ((i % 40) / 39) * 2 - 1;
          const gy = 1 - (Math.floor(i / 40) / 24) * 2;
          const x = X(lerp(gx * 0.9, px, sq));
          const y = Y(lerp(gy * 0.9, py, sq));
          ctx.drawImage(at, (i % 40) * 32, Math.floor(i / 40) * 32, 32, 32, x - th / 2, y - th / 2, th, th);
        }
        ctx.restore();
        // Class names at their centers, while the map shows codes.
        const lA = s.win('map', 'pixels') * (1 - toPix) + (s.since('caveat') >= 0 ? s.ease('caveat', 0.6) : 0);
        s.alpha(lA, () => {
          const cen = once('centroids', () => {
            const c = Array.from({ length: 10 }, () => [0, 0, 0]);
            for (let i = 0; i < 1000; i++) {
              const [px, py] = a.an.tsne.codes[i]!;
              const l = a.an.labels[i]!;
              c[l]![0]! += px;
              c[l]![1]! += py;
              c[l]![2]!++;
            }
            return c.map(([x, y, n]) => [x! / n!, y! / n!]);
          });
          cen.forEach(([cx, cy], k) => pill(s, CIFAR_CLASSES[k]!, X(cx!), Y(cy!), '--ink', { size: 3, font: 'ui' }));
        });
      });
      s.alpha(s.win('pixels', 'nn') * toPix, () => pill(s, 'raw pixels: sorted by color and brightness', w / 2, h * 0.93, 'slate', { size: fit(s, 'raw pixels: sorted by color and brightness', w * 0.8, 3.3, 'ui') * 0.95, font: 'ui' }));
      s.alpha(s.ease('caveat', 0.6, 0.5), () => pill(s, 'near: meaningful.  far apart: not', w / 2, h * 0.93, 'slate', { size: 3.3, font: 'ui' }));
    }
    // Nearest neighbors in both spaces.
    const nA = s.win('nn', 'caveat');
    if (nA > 0) {
      const qs = Math.min(rw * 0.24, rh * 0.36);
      const nx = rx + qs + u * 5;
      const ns = Math.min((rx + rw - nx - u * 5) / 6, rh * 0.22);
      const rowY = [ry + rh * 0.12, ry + rh * 0.56];
      const cnt = s.ease('count', 0.6);
      s.alpha(nA, () => {
        pic(s, sampleImg(a, Q), rx, ry + (rh - qs) / 2 - u * 3, qs);
        cap(s, 'horse', rx + qs / 2, ry + (rh + qs) / 2, { weight: 650, color: s.c('--ink') });
        (['codes', 'pixels'] as const).forEach((sp, r) => {
          const y = rowY[r]!;
          const ra = r === 0 ? 1 : s.ease('nn', 0.6, 0.5 * (s.end('nn') - s.at('nn')));
          s.alpha(ra, () => {
            const t = sp === 'codes' ? 'nearest by CNN code' : 'nearest by raw pixels';
            s.text(t, nx, y, { size: 3.4, font: 'ui', weight: 650, color: s.c(sp === 'codes' ? 'green' : 'slate'), align: 'left' });
            a.an.nn[sp][Q]!.forEach((i, k) => {
              const x = nx + k * (ns + u * 1);
              pic(s, sampleImg(a, i), x, y + u * 3.5, ns);
              const same = a.an.labels[i] === a.an.labels[Q];
              cap(s, CIFAR_CLASSES[a.an.labels[i]!]!, x + ns / 2, y + ns + u * 6.5, { size: fit(s, 'horse', ns * 0.95, 3, 'ui'), color: same ? s.c('green') : s.c('--ink-3'), weight: same ? 650 : 450 });
            });
            s.alpha(cnt, () => pill(s, sp === 'codes' ? '55% share the label' : '26% share the label', nx + 3 * (ns + u), y + ns + u * 13, sp === 'codes' ? 'green' : 'slate', { size: 3.2, font: 'ui' }));
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- occlusion

const occ: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const a = assets(s);
    const o = occlusion(s);
    if (!a || !o) return loading(s);
    const [rx, ry, rw, rh] = area(s, 0.14, 0.05);
    const bar = u * 12;
    const gap = u * 5;
    const S = Math.min((rw - gap - bar) / 2, rh * 0.7);
    const x0 = rx + (rw - (2 * S + gap + bar)) / 2;
    const y0 = ry + (rh - S) / 2 - u * 4;
    const hx = x0 + S + gap;
    const name = CIFAR_CLASSES[o.y]!;
    const sliding = s.since('slide') >= 0;
    const k0 = 7 * 16 + 9;
    const n = sliding ? Math.floor(clamp01(s.prog('slide') * 1.1) * 256) : 0;
    const k = sliding ? Math.min(255, n, o.pos) : k0;
    const patchA = s.ease('patch', 0.5);
    const done = s.since('read') >= 0;
    const showK = k;
    // The picture, with the patch where it is now.
    // Alone, the picture sits in the middle; the map's arrival moves it aside.
    const xi = lerp(rx + (rw - S) / 2, x0, s.ease('record', 0.8));
    pic(s, patchA > 0 && !done ? occludedCanvas(a, o, showK) : testImg(a, o.img), xi, y0, S);
    if (patchA > 0 && !done) {
      const r = Math.floor(showK / 16);
      const c = showK % 16;
      const kk = S / 32;
      const t0 = Math.max(0, 2 * r + 1 - 4);
      const l0 = Math.max(0, 2 * c + 1 - 4);
      const t1 = Math.min(32, 2 * r + 1 + 4);
      const l1 = Math.min(32, 2 * c + 1 + 4);
      s.alpha(patchA, () => {
        s.ctx.strokeStyle = '#ffffff';
        s.ctx.lineWidth = Math.max(1.5, u * 0.4);
        s.ctx.strokeRect(xi + l0 * kk, y0 + t0 * kk, (l1 - l0) * kk, (t1 - t0) * kk);
      });
    }
    const p = patchA > 0 && !done ? occludedProb(a, o, showK) : o.base;
    s.alpha(s.ease('ask', 0.5, 0.6), () => pill(s, `p(${name}) = ${p.toFixed(3)}`, xi + S / 2, y0 + S + u * 5, 'purple', { size: 3.3 }));
    // The map.
    const mA = s.ease('record', 0.6);
    if (mA > 0)
      s.alpha(mA, () => {
        s.rrect(hx, y0, S, S, 0.6, { fill: s.c('--paper-2') });
        const upto = done ? 256 : sliding ? k + 1 : 0;
        const hm = heatCanvas(o, upto);
        if (upto > 0) pic(s, hm.c, hx, y0, S, S, null);
        if (!done && sliding) {
          const cs = S / 16;
          s.ctx.strokeStyle = '#ffffff';
          s.ctx.lineWidth = Math.max(1.5, u * 0.4);
          s.ctx.strokeRect(hx + (k % 16) * cs, y0 + Math.floor(k / 16) * cs, cs, cs);
        }
        s.rrect(hx, y0, S, S, 0.6, { stroke: s.c('--rule'), lw: 0.25 });
        cap(s, `p(${name}) at each spot`, hx + S / 2, y0 + S + u * 5, { size: 3.3 });
        if (upto > 1) colorbar(s, hx + S + u * 2.5, y0, u * 2.4, S, hm.lo.toFixed(2), hm.hi.toFixed(2));
      });
    s.alpha(s.win('read', 'cost'), () => {
      cap(s, 'yellow: hardly noticed    purple: relied on it', w / 2, y0 - u * 4.5, { size: fit(s, 'yellow: hardly noticed    purple: relied on it', rw, 3.4, 'ui'), weight: 600 });
    });
    s.alpha(s.win('cost', 'next'), () => pill(s, `${Math.min(256, o.pos)} forward passes`, w / 2, y0 - u * 4.5, 'orange', { size: 3.6 }));
    s.alpha(s.ease('next', 0.6), () => pill(s, 'saliency: one backward pass', w / 2, y0 - u * 4.5, 'teal', { size: 3.6, font: 'ui' }));
  },
};

// ---------------------------------------------------------------- saliency

const RULES: [string, string, string][] = [
  ['grad', 'true gradient', 'unit was on: z > 0'],
  ['deconv', 'deconvnet', 'gradient is positive'],
  ['guided', 'guided backprop', 'both'],
];

const sal: SceneDef = {
  marks: {
    M: { tex: String.raw`M_{ij} = \max_{c}\, \left|\frac{\partial \symS_y}{\partial \symx_{c,i,j}}\right|`, x: 0.5, y: 0.86, size: 4.8 },
  },
  draw(s) {
    const { w, u } = s;
    const a = assets(s);
    const o = saliency(s);
    if (!a || !o) return loading(s);
    const [rx, ry, rw, rh] = area(s, 0.13, 0.05);
    const dog = CIFAR_CLASSES[o.pred]!;
    const cat = CIFAR_CLASSES[o.other]!;
    const phase2 = s.since('relu') >= 0;
    const ruleNow = !phase2 ? 'grad' : s.since('guided') >= 0 ? 'guided' : s.since('deconv') >= 0 ? 'deconv' : 'grad';
    s.slot('rule', ruleNow);
    const gap = u * 3.5;
    const S = Math.min((rw - 2 * gap) / 3, rh * 0.62);
    const x0 = rx + (rw - (3 * S + 2 * gap)) / 2;
    const y0 = ry + (rh - S) / 2 - u * (phase2 ? 2 : 8);
    // Phase 1: image, saliency, image times saliency.
    const p1 = s.win('local', 'relu');
    if (p1 > 0)
      s.alpha(p1, () => {
        pic(s, testImg(a, o.img), x0, y0, S);
        cap(s, `image: ${dog}`, x0 + S / 2, y0 + S + u * 3.6);
        // One pixel, wiggled.
        s.alpha(s.win('local', 'one'), () => {
          const kk = S / 32;
          const wob = Math.sin(s.t * 9) * 0.5 + 0.5;
          s.ctx.strokeStyle = s.c('--accent');
          s.ctx.lineWidth = Math.max(1.5, u * 0.45);
          s.ctx.strokeRect(x0 + 15 * kk - wob * 1.5, y0 + 12 * kk - wob * 1.5, kk + wob * 3, kk + wob * 3);
          const t1 = 'nudge one pixel:';
          const t2 = `how much does S_${dog} move?`;
          s.text(t1, x0 + S + gap, y0 + S * 0.38, { size: 3.6, font: 'ui', align: 'left' });
          s.text(t2, x0 + S + gap, y0 + S * 0.38 + u * 5.5, { size: fit(s, t2, 2 * S + gap, 3.6, 'ui'), font: 'ui', weight: 650, color: s.c('purple'), align: 'left' });
        });
        const g = o.maps.get(`grad-${o.pred}`);
        const sA = s.ease('one', 0.7, 0.5 * (s.end('one') - s.at('one')));
        if (sA > 0)
          s.alpha(sA, () => {
            pic(s, g?.sal, x0 + S + gap, y0, S);
            cap(s, 'saliency', x0 + 1.5 * S + gap, y0 + S + u * 3.6, { color: s.c('teal') });
          });
        s.alpha(s.ease('abs', 0.7, 0.4 * (s.end('abs') - s.at('abs'))), () => {
          pic(s, g?.masked, x0 + 2 * (S + gap), y0, S);
          cap(s, 'image × saliency', x0 + 2.5 * S + 2 * gap, y0 + S + u * 3.6);
        });
      });
    s.show('M', p1 * s.ease('deriv', 0.6) * (1 - s.ease('relu', 0.4)));
    // Phase 2: the three backward rules.
    const p2 = s.win('relu', 'but');
    if (p2 > 0)
      s.alpha(p2, () => {
        RULES.forEach(([r, name, rule], i) => {
          const x = x0 + i * (S + gap);
          const on = r === ruleNow;
          const mA = i === 0 ? s.ease('grad', 0.6) : s.ease(r, 0.6);
          s.rrect(x, y0, S, S, 0.6, { fill: s.c('--paper-2') });
          s.alpha(mA, () => pic(s, o.maps.get(`${r}-${o.pred}`)?.sal, x, y0, S));
          if (on && s.since('grad') >= 0) ring(s, x, y0, S, S, s.c('--accent'), 0.5);
          cap(s, name, x + S / 2, y0 + S + u * 3.8, { weight: 650, color: on ? s.c('--accent') : s.c('--ink'), size: fit(s, name, S, 3.4, 'ui') });
          cap(s, rule, x + S / 2, y0 + S + u * 8, { size: fit(s, rule, S, 3.1, 'ui'), font: 'ui', color: s.c('--ink-3') });
        });
      });
    // Phase 3: explain a different class.
    const p3 = s.ease('but', 0.6);
    if (p3 > 0) {
      const lab = u * 16;
      const S3 = Math.min((rw - lab - gap) / 2, (rh - u * 14 - gap) / 2);
      const gx = rx + (rw - (lab + 2 * S3 + gap)) / 2 + lab;
      const gy = ry + u * 5;
      const corr = s.ease('corr', 0.6);
      s.alpha(p3, () => {
        [dog, cat].forEach((c, j) => cap(s, `explain ${c}`, gx + j * (S3 + gap) + S3 / 2, gy - u * 2, { weight: 650, size: 3.3 }));
        (['guided', 'grad'] as const).forEach((r, i) => {
          const y = gy + i * (S3 + gap);
          const ra = i === 0 ? 1 : s.ease('but', 0.6, 0.5 * (s.end('but') - s.at('but')));
          s.alpha(ra, () => {
            s.text(r === 'guided' ? 'guided' : 'gradient', gx - u * 3, y + S3 * 0.4, { size: 3.4, font: 'ui', weight: 650, align: 'right' });
            s.alpha(corr, () => s.text(r === 'guided' ? 'r = 0.68' : 'r = 0.38', gx - u * 3, y + S3 * 0.4 + u * 5, { size: 3.1, font: 'mono', color: s.c(r === 'guided' ? 'red' : 'green'), align: 'right' }));
            [o.pred, o.other].forEach((c, j) => pic(s, o.maps.get(`${r}-${c}`)?.sal, gx + j * (S3 + gap), y, S3));
          });
        });
        s.alpha(corr, () => cap(s, 'r: how alike the two classes\' maps are, over 200 images', w / 2, gy + 2 * S3 + gap + u * 4.5, { size: fit(s, 'r: how alike the two classes\' maps are, over 200 images', rw, 3.2, 'ui'), italic: true }));
      });
    }
  },
};

export const scenesB: Record<string, SceneDef> = { 'top-images': topImages, tsne, occlusion: occ, saliency: sal };
