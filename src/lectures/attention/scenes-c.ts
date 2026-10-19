import { fmt } from '../../core/code';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { affine, bilinearAt, pictures, sourceOf, warp } from './data';
import { type K, block, fit, loading, picture, pill, tag } from './kit';

type M = [number, number, number, number, number, number];

/** Inverse of the 2-D affine map [a, b, c, d, e, f] (canvas order: x' = a x + c y + e). */
function invert([a, b, c, d, e, f]: M): M {
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/**
 * Draws `content` (painted in a unit square) into the square at (x, y, S), then the part of it
 * inside `box` (a map from [-1, 1]^2 into that unit square) into the square at (ox, oy, oS):
 * a spatial transformer's read, done with canvas transforms.
 */
function transformRead(s: Scene, content: (ctx: CanvasRenderingContext2D) => void, x: number, y: number, S: number, box: M, ox: number, oy: number, oS: number, k: K, out = 1): void {
  const ctx = s.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, S, S);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(S, S);
  content(ctx);
  ctx.restore();
  const corner = (u: number, v: number): [number, number] => [x + S * (box[0] * u + box[2] * v + box[4]), y + S * (box[1] * u + box[3] * v + box[5])];
  ctx.beginPath();
  [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)].forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.strokeStyle = s.c(k);
  ctx.lineWidth = 0.55 * s.u;
  ctx.stroke();
  if (out <= 0) return;
  s.alpha(out, () => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, oS, oS);
    ctx.clip();
    ctx.fillStyle = s.c('--card');
    ctx.fillRect(ox, oy, oS, oS);
    // output pixel (u, v) in [-1, 1]^2 -> unit square of the content
    ctx.translate(ox + oS / 2, oy + oS / 2);
    ctx.scale(oS / 2, oS / 2);
    const inv = invert(box);
    ctx.transform(...inv);
    content(ctx);
    ctx.restore();
    s.rrect(ox, oy, oS, oS, 0.6, { stroke: s.c(k), lw: 0.45 });
  });
}

/** A box map: center (cx, cy), half-size r, rotation (degrees) and shear, in unit-square coordinates. */
function boxMap(cx: number, cy: number, r: number, rot = 0, shear = 0): M {
  const t = (rot * Math.PI) / 180;
  const c = Math.cos(t);
  const sn = Math.sin(t);
  return [r * c, r * sn, r * (c * shear - sn), r * (sn * shear + c), cx, cy];
}
const lerpM = (a: M, b: M, t: number): M => a.map((v, i) => lerp(v, b[i]!, t)) as M;

// ---------------------------------------------------------------- spatial transformer

/** theta over the scene, as [scale, rotation, tx, ty, shear]. */
function stnParams(s: Scene): [number, number, number, number, number] {
  let scale = 1;
  let rot = 0;
  let tx = 0;
  let ty = 0;
  let shear = 0;
  if (s.since('zoom') >= 0) scale = lerp(1, 0.5, s.ease('zoom', 1.4, 0.6));
  if (s.since('rotate') >= 0) {
    rot = lerp(0, 30, s.ease('rotate', 1.6, 0.3));
    scale = lerp(0.5, 0.62, s.ease('rotate', 1.2));
  }
  if (s.since('shear') >= 0) {
    const a = s.ease('shear', 1.6, 0.2);
    tx = lerp(0, 0.22, a);
    ty = lerp(0, -0.12, a);
    shear = lerp(0, 0.35, a);
  }
  return [scale, rot, tx, ty, shear];
}

const stn: SceneDef = {
  marks: {
    grid: { tex: String.raw`\begin{pmatrix} x^s \\ y^s \end{pmatrix} = \symtheta \begin{pmatrix} x^t \\ y^t \\ 1 \end{pmatrix}`, x: 0.5, y: 0.86, size: 4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const P = pictures(s);
    const plane = P?.plane ?? null;
    // Phase 1: the three parts.
    const dA = s.win('jader', 'gridgen');
    s.alpha(dA, () => {
      const x0 = (w - 102 * u) / 2;
      const X = (v: number) => x0 + v * u;
      const Y = (v: number) => v * u + 2 * u;
      const lit = (from: string, until?: string) => s.win(from, until, 0.4);
      const num = (n: string, x: number, y: number, a: number) =>
        s.alpha(a, () => {
          s.circle(x, y, 2.2 * u, { fill: s.c('--accent') });
          s.text(n, x, y + 0.15 * u, { size: 3, font: 'mono', weight: 700, color: '#ffffff' });
        });
      const S = 22 * u;
      if (plane) picture(s, 'plane', plane.rgb, X(0), Y(18), S);
      else loading(s, X(0), Y(18), S);
      s.text('input U', X(11), Y(44), { size: 3.2, weight: 600, color: s.c('slate') });
      // 1: localization net
      s.alpha(0.25 + 0.75 * s.ease('loc', 0.5), () => {
        block(s, X(30), Y(23), 30 * u, 12 * u, 'localization net', 'blue', { on: lit('loc', 'six'), size: 3.2 });
        s.arrow(X(22.5), Y(29), X(29.5), Y(29), s.c('slate'), 0.4, 1.8);
        num('1', X(30), Y(23), 1);
      });
      // theta: six numbers
      s.alpha(0.25 + 0.75 * s.ease('loc', 0.5, 0.9), () => {
        s.arrow(X(60.5), Y(29), X(67.5), Y(29), s.c('blue'), 0.4, 1.8);
        const vals = ['1', '0', '0', '0', '1', '0'];
        const on = lit('six', 'gridgen');
        vals.forEach((v, k) => {
          const cx = X(68) + (k % 3) * 10 * u;
          const cy = Y(21) + Math.floor(k / 3) * 8 * u;
          s.cell(cx, cy, 9.4 * u, 7.4 * u, v, 'blue', { on, size: 3.2 });
        });
        s.text('theta: 6 numbers', X(83), Y(40.5), { size: 3, weight: 600, color: s.c('blue') });
      });
      s.alpha(s.ease('six', 0.6, 0.6), () => fit(s, 'zoom, rotate, shift, shear', X(83), Y(46), 32 * u, { size: 2.9, italic: true, color: s.c('--ink-2') }));
      // 2, 3: grid generator and sampler; V
      s.alpha(0.25 + 0.75 * s.ease('in', 0.6, 0.6), () => {
        block(s, X(68), Y(56), 30 * u, 12 * u, 'grid generator', '--accent', { size: 3.2 });
        block(s, X(30), Y(56), 30 * u, 12 * u, 'sampler', '--accent', { size: 3.2 });
        s.arrow(X(83), Y(49.5), X(83), Y(55.5), s.c('blue'), 0.4, 1.8);
        s.arrow(X(67.5), Y(62), X(60.5), Y(62), s.c('--accent'), 0.4, 1.8);
        s.arrow(X(29.5), Y(62), X(23), Y(62), s.c('--accent'), 0.4, 1.8);
        s.line(X(20), Y(40.5), X(34), Y(55.5), s.tint('slate', 0.8), 0.35, [0.8, 0.6]);
        s.rrect(X(0), Y(51), S, S, 0.4, { fill: s.tint('red', 0.08), stroke: s.tint('red', 0.6), lw: 0.3 });
        s.text('V', X(11), Y(62), { size: 6, italic: true, weight: 600, color: s.c('red') });
        s.text('output V', X(11), Y(77), { size: 3.2, weight: 600, color: s.c('red') });
        num('2', X(68), Y(56), s.ease('in', 0.5, 1.2));
        num('3', X(30), Y(56), s.ease('in', 0.5, 1.6));
      });
    });

    // Phase 2: the warp.
    const wA = s.ease('gridgen', 0.7);
    s.alpha(wA, () => {
      const S = Math.min(46 * u, (w - 26 * u) / 2, h - 40 * u);
      const ix = w / 2 - S - 6 * u;
      const ox = w / 2 + 6 * u;
      const iy = 16 * u;
      if (!plane) return loading(s, ix, iy, S);
      const [scale, rot, tx, ty, shear] = stnParams(s);
      const theta = affine(scale, rot, tx, ty, shear);
      ['a', 'b', 'tx', 'c', 'd', 'ty'].forEach((k, i) => s.slot(k, theta[i]!.toFixed(2)));
      picture(s, 'plane', plane.rgb, ix, iy, S);
      const fill = s.since('sampler') < 0 ? 0 : s.ease('sampler', 1.2, 0.3);
      s.rrect(ox, iy, S, S, 0.3, { fill: s.tint('red', 0.06), stroke: s.tint('red', 0.6), lw: 0.3 });
      s.alpha(fill, () => picture(s, 'stn-out', warp(plane.rgb, theta), ox, iy, S));
      s.arrow(ix + S + 2 * u, iy + S / 2, ox - 2 * u, iy + S / 2, s.c('--ink-3'), 0.45, 2);
      // the sampling grid on U, and the regular target grid on V
      const n = 9;
      const at = (i: number, j: number): [number, number] => {
        const [xs, ys] = sourceOf(theta, i, j, n);
        return [ix + ((xs + 1) / 2) * S, iy + ((ys + 1) / 2) * S];
      };
      const ctx = s.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ix - 2, iy - 2, S + 4, S + 4);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = Math.max(0.8, 0.22 * u);
      ctx.beginPath();
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const [x, y] = at(i, j);
          if (j) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const [x, y] = at(i, j);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
      ctx.stroke();
      ctx.strokeStyle = s.c('--accent');
      ctx.lineWidth = 0.6 * u;
      ctx.beginPath();
      [at(0, 0), at(0, n - 1), at(n - 1, n - 1), at(n - 1, 0)].forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      s.alpha(1 - fill, () => {
        for (let k = 0; k < n; k++) {
          const t = (k / (n - 1)) * S;
          s.line(ox + t, iy, ox + t, iy + S, s.tint('red', 0.35), 0.15);
          s.line(ox, iy + t, ox + S, iy + t, s.tint('red', 0.35), 0.15);
        }
      });
      // one output pixel and where it reads
      s.alpha(s.win('matrix', 'identity'), () => {
        const [pi, pj] = [2, 6];
        const tx0 = ox + (pj / (n - 1)) * S;
        const ty0 = iy + (pi / (n - 1)) * S;
        const [sx, sy] = at(pi, pj);
        s.circle(tx0, ty0, 1.3 * u, { fill: s.c('red'), stroke: '#ffffff', lw: 0.3 });
        s.circle(sx, sy, 1.3 * u, { fill: s.c('--accent'), stroke: '#ffffff', lw: 0.3 });
        const c2 = s.ctx;
        c2.beginPath();
        c2.moveTo(tx0, ty0);
        c2.quadraticCurveTo((tx0 + sx) / 2, iy - 8 * u, sx, sy);
        c2.strokeStyle = s.c('--accent');
        c2.lineWidth = 0.45 * u;
        c2.setLineDash([u, 0.7 * u]);
        c2.stroke();
        c2.setLineDash([]);
        tag(s, 'reads from here', sx, sy + 4.5 * u, 2.7);
      });
      s.text('input U, sampling grid', ix + S / 2, iy + S + 4.5 * u, { size: 3, color: s.c('--ink-2') });
      s.text('output V', ox + S / 2, iy + S + 4.5 * u, { size: 3, color: s.c('red'), weight: 600 });
      const label = s.since('shear') >= 0 ? 'shift + shear' : s.since('rotate') >= 0 ? 'rotate 30°' : s.since('zoom') >= 0 ? 'scale 0.5: zoom in' : s.since('identity') >= 0 ? 'identity' : '';
      if (label) pill(s, label, w / 2, iy + S + 12 * u, 'blue', { size: 3.2, font: 'ui', on: 1 });
    });
    s.show('grid', s.win('matrix', 'sampler'), { y: Math.min(0.88, (16 * u + Math.min(46 * u, (w - 26 * u) / 2, h - 40 * u) + 15 * u) / h) });
  },
};

// ---------------------------------------------------------------- bilinear

/** Where the point reads over the scene, in patch coordinates. */
function readAt(s: Scene): [number, number] {
  const home: [number, number] = [0.6, 0.3];
  if (s.since('slide') >= 0 && s.since('grad') < 0) {
    const path: [number, number][] = [home, [1.45, 0.45], [1.3, 1.55], [0.35, 1.3], home];
    const t = clamp01(s.prog('slide') * 1.1) * (path.length - 1);
    const k = Math.min(path.length - 2, Math.floor(t));
    const f = smooth(t - k);
    return [lerp(path[k]![0], path[k + 1]![0], f), lerp(path[k]![1], path[k + 1]![1], f)];
  }
  if (s.since('where') >= 0) {
    const B = bilinearAt(...home);
    const g = Math.hypot(B.gx, B.gy);
    const d = 0.25 * s.ease('where', 1.6, 0.4);
    return [home[0] + (B.gx / g) * d, home[1] + (B.gy / g) * d];
  }
  return home;
}

const NB: K[] = ['blue', 'orange', 'green', 'purple'];

const bilinear: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cell = Math.min(18 * u, (h - 30 * u) / 3);
    const pw = Math.min(42 * u, w - 3 * cell - 18 * u);
    const ox = (w - (3 * cell + 8 * u + pw)) / 2;
    const oy = 14 * u;
    const [x, y] = readAt(s);
    const B = bilinearAt(x, y);
    s.slot('x', x.toFixed(2));
    s.slot('y', y.toFixed(2));
    ['wa', 'wb', 'wc', 'wd'].forEach((k, i) => s.slot(k, B.w[i]!.toFixed(2)));
    s.slot('v', B.v.toFixed(1));
    s.slot('gx', fmt(Math.round(B.gx * 10) / 10));
    s.slot('gy', fmt(Math.round(B.gy * 10) / 10));
    const cx = (gx: number) => ox + (gx + 0.5) * cell;
    const cy = (gy: number) => oy + (gy + 0.5) * cell;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const g = [[40, 200, 120], [90, 30, 250], [180, 140, 60]][r]![c]!;
        s.ctx.fillStyle = `rgb(${g},${g},${g})`;
        s.ctx.fillRect(ox + c * cell, oy + r * cell, cell + 0.5, cell + 0.5);
      }
    s.rrect(ox, oy, 3 * cell, 3 * cell, 0.3, { stroke: s.c('--rule'), lw: 0.3 });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) s.circle(cx(c), cy(r), 0.5 * u, { fill: s.tint('slate', 0.8) });
    const X0 = cx(B.x0);
    const Y0 = cy(B.y0);
    const X1 = cx(B.x0 + 1);
    const Y1 = cy(B.y0 + 1);
    const PX = cx(x);
    const PY = cy(y);
    // four rectangles, each opposite its corner
    const aA = s.ease('area', 0.7);
    s.alpha(aA, () => {
      const rects: [number, number, number, number][] = [
        [PX, PY, X1, Y1],
        [X0, PY, PX, Y1],
        [PX, Y0, X1, PY],
        [X0, Y0, PX, PY],
      ];
      rects.forEach(([a, b, c2, d], k) => {
        s.ctx.fillStyle = s.tint(NB[k]!, 0.5);
        s.ctx.fillRect(a, b, c2 - a, d - b);
        if (c2 - a > 9 * u && d - b > 6.5 * u) s.text(B.w[k]!.toFixed(2), (a + c2) / 2, (b + d) / 2, { size: 2.9, font: 'mono', weight: 700, color: '#ffffff' });
      });
    });
    s.alpha(s.ease('four', 0.6), () => {
      s.rrect(X0, Y0, X1 - X0, Y1 - Y0, 0.2, { stroke: s.c('--accent'), lw: 0.4 });
      [[X0, Y0], [X1, Y0], [X0, Y1], [X1, Y1]].forEach(([a, b], k) => s.circle(a!, b!, 1.4 * u, { fill: s.c(NB[k]!), stroke: '#ffffff', lw: 0.35 }));
    });
    s.alpha(s.ease('grad', 0.6), () => {
      const g = Math.hypot(B.gx, B.gy);
      if (g > 1) s.arrow(PX, PY, PX + (B.gx / g) * cell * 0.55, PY + (B.gy / g) * cell * 0.55, s.c('red'), 0.7, 2.6);
    });
    s.circle(PX, PY, 1.6 * u, { fill: s.c('--accent'), stroke: '#ffffff', lw: 0.45 });
    s.text('a 3 × 3 patch of gray pixels', ox + 1.5 * cell, oy + 3 * cell + 5 * u, { size: 3, color: s.c('--ink-2') });
    s.text(`reading at (${x.toFixed(2)}, ${y.toFixed(2)})`, ox + 1.5 * cell, oy + 3 * cell + 10 * u, { size: 3, font: 'mono', weight: 600, color: s.c('--accent') });

    // Panel: the read value and its weights.
    const px = ox + 3 * cell + 8 * u;
    const g = Math.round(B.v);
    const sw = Math.min(18 * u, pw * 0.5);
    s.alpha(s.ease('value', 0.6), () => {
      s.text('V', px, oy + 2 * u, { size: 4, italic: true, weight: 600, align: 'left', color: s.c('red') });
      s.rrect(px, oy + 6 * u, sw, sw, 1.4, { fill: `rgb(${g},${g},${g})`, stroke: s.c('--rule'), lw: 0.3 });
      s.text(B.v.toFixed(1), px + sw + 2.5 * u, oy + 6 * u + sw / 2, { size: 4, font: 'mono', weight: 700, align: 'left' });
    });
    const wy = oy + 6 * u + sw + 7 * u;
    s.alpha(s.win('area', 'kink'), () => {
      const names = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
      names.forEach((nm, k) => {
        const yy = wy + k * 5.4 * u;
        s.circle(px + 1.2 * u, yy, 1.1 * u, { fill: s.c(NB[k]!) });
        s.text(nm, px + 3.6 * u, yy, { size: 2.9, align: 'left', color: s.c('--ink-2') });
        s.text(B.w[k]!.toFixed(2), px + pw - 1 * u, yy, { size: 3, font: 'mono', weight: 600, align: 'right' });
      });
      s.alpha(s.ease('sum', 0.6), () => {
        const yy = wy + 4 * 5.4 * u + 1 * u;
        s.line(px, yy - 2.5 * u, px + pw, yy - 2.5 * u, s.c('--rule'), 0.3);
        s.text('sum', px + 3.6 * u, yy + 0.5 * u, { size: 2.9, align: 'left', color: s.c('--ink-2') });
        s.text(B.w.reduce((a, b) => a + b, 0).toFixed(2), px + pw - 1 * u, yy + 0.5 * u, { size: 3, font: 'mono', weight: 700, align: 'right', color: s.c('teal') });
      });
    });
    s.alpha(s.win('grad', 'kink'), () => {
      const yy = wy + 4 * 5.4 * u + 9 * u;
      fit(s, 'red: the gradient of V', px, yy, pw, { size: 3, align: 'left', color: s.c('red'), weight: 600 });
    });
    // the tent: one weight as a function of position
    s.alpha(s.ease('kink', 0.6), () => {
      const L = px + 2 * u;
      const R = px + pw - 2 * u;
      const base = wy + 18 * u;
      const top = wy + 2 * u;
      s.line(L, base, R, base, s.c('--axis'), 0.3);
      const m = (L + R) / 2;
      const half = (R - L) / 2.4;
      const c = s.ctx;
      c.beginPath();
      c.moveTo(L, base);
      c.lineTo(m - half, base);
      c.lineTo(m, top);
      c.lineTo(m + half, base);
      c.lineTo(R, base);
      c.strokeStyle = s.c('blue');
      c.lineWidth = 0.6 * u;
      c.stroke();
      [m - half, m, m + half].forEach((xx, k) => s.circle(xx, k === 1 ? top : base, 0.9 * u, { fill: s.c('red') }));
      s.text('a weight vs position', (L + R) / 2, base + 4.5 * u, { size: 2.9, color: s.c('--ink-2') });
      s.text('kinks: sub-gradients', (L + R) / 2, base + 9.5 * u, { size: 2.9, color: s.c('red') });
    });
  },
};

// ---------------------------------------------------------------- what it learns

/** A cluttered MNIST-style canvas with a rotated 7, in unit coordinates. */
function mnistContent(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#111418';
  ctx.fillRect(0, 0, 1, 1);
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.035;
  const clutter: [number, number, number, number][] = [
    [0.08, 0.12, 0.18, 0.2],
    [0.78, 0.1, 0.9, 0.16],
    [0.12, 0.78, 0.2, 0.9],
    [0.82, 0.82, 0.9, 0.74],
    [0.5, 0.88, 0.6, 0.92],
  ];
  clutter.forEach(([a, b, c, d]) => {
    ctx.beginPath();
    ctx.moveTo(a, b);
    ctx.lineTo(c, d);
    ctx.stroke();
  });
  ctx.save();
  ctx.translate(0.6, 0.42);
  ctx.rotate((38 * Math.PI) / 180);
  ctx.scale(0.17, 0.17);
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  ctx.moveTo(-0.7, -0.8);
  ctx.lineTo(0.7, -0.8);
  ctx.lineTo(-0.15, 0.9);
  ctx.moveTo(-0.3, 0.05);
  ctx.lineTo(0.45, 0.05);
  ctx.stroke();
  ctx.restore();
}

/** A house number on a brick wall, sheared. */
function svhnContent(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#b5654a';
  ctx.fillRect(0, 0, 1, 1);
  ctx.strokeStyle = 'rgba(255,235,220,0.35)';
  ctx.lineWidth = 0.008;
  for (let r = 0; r < 12; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r / 12);
    ctx.lineTo(1, r / 12);
    ctx.stroke();
    for (let c = 0; c < 7; c++) {
      const x = (c + (r % 2) * 0.5) / 6;
      ctx.beginPath();
      ctx.moveTo(x, r / 12);
      ctx.lineTo(x, (r + 1) / 12);
      ctx.stroke();
    }
  }
  ctx.save();
  ctx.translate(0.48, 0.52);
  ctx.transform(1, -0.25, 0.32, 1, 0, 0);
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(-0.3, -0.13, 0.6, 0.26);
  ctx.fillStyle = '#1d2a3a';
  ctx.font = '700 0.2px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('254', 0, 0.01);
  ctx.restore();
}

/** A small bird on a branch. */
function birdContent(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#dfe9df';
  ctx.fillRect(0, 0, 1, 1);
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 0.04;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0.05, 0.8);
  ctx.lineTo(0.95, 0.72);
  ctx.stroke();
  ctx.fillStyle = '#5a6f8f';
  ctx.beginPath();
  ctx.moveTo(0.3, 0.58);
  ctx.lineTo(0.08, 0.72);
  ctx.lineTo(0.14, 0.78);
  ctx.lineTo(0.36, 0.66);
  ctx.fill();
  ctx.fillStyle = '#c98a3c';
  ctx.beginPath();
  ctx.ellipse(0.46, 0.58, 0.2, 0.13, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a6f8f';
  ctx.beginPath();
  ctx.ellipse(0.42, 0.56, 0.12, 0.07, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3d5a80';
  ctx.beginPath();
  ctx.arc(0.66, 0.38, 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b04b';
  ctx.beginPath();
  ctx.moveTo(0.74, 0.36);
  ctx.lineTo(0.84, 0.39);
  ctx.lineTo(0.74, 0.42);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0.68, 0.36, 0.022, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(0.685, 0.36, 0.011, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(0.45, 0.7);
  ctx.lineTo(0.44, 0.77);
  ctx.moveTo(0.52, 0.69);
  ctx.lineTo(0.53, 0.76);
  ctx.stroke();
}

const learned: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: trained by the final loss only.
    const pA = s.win('nolabel', 'mnist');
    s.alpha(pA, () => {
      const x0 = (w - 104 * u) / 2;
      const X = (v: number) => x0 + v * u;
      const cy = h * 0.42;
      const S = 20 * u;
      const box = boxMap(0.6, 0.42, 0.21, 38);
      transformRead(s, mnistContent, X(0), cy - S / 2, S, box, X(44), cy - S / 2, S, 'blue', 1);
      s.arrow(X(20.5), cy, X(23.5), cy, s.c('--ink-3'), 0.35, 1.6);
      block(s, X(24), cy - 6 * u, 16 * u, 12 * u, 'ST', 'blue', { size: 3.6, sub: 'theta' });
      s.arrow(X(40.5), cy, X(43.5), cy, s.c('--ink-3'), 0.35, 1.6);
      s.arrow(X(64.5), cy, X(67.5), cy, s.c('--ink-3'), 0.35, 1.6);
      block(s, X(68), cy - 6 * u, 18 * u, 12 * u, 'ConvNet', 'slate', { size: 3.2, on: s.win('loss', 'push') });
      s.arrow(X(86.5), cy, X(89.5), cy, s.c('--ink-3'), 0.35, 1.6);
      pill(s, 'loss', X(97), cy, 'red', { size: 3.4, on: s.ease('loss', 0.5), font: 'ui' });
      s.text('U', X(10), cy + S / 2 + 4 * u, { size: 3.4, italic: true, weight: 600, color: s.c('slate') });
      s.text('V', X(54), cy + S / 2 + 4 * u, { size: 3.4, italic: true, weight: 600, color: s.c('red') });
      s.alpha(s.ease('nolabel', 0.6, 0.6) * (1 - s.ease('push', 0.5)), () => {
        s.text('label for theta?', X(32), cy - 13 * u, { size: 3.1, color: s.c('--ink-2') });
        s.line(X(20), cy - 13 * u, X(44), cy - 13 * u, s.c('red'), 0.4);
      });
      // gradients flow back
      s.alpha(s.ease('push', 0.6), () => {
        const t = s.since('push');
        const y = cy + 17 * u;
        s.line(X(97), y, X(32), y, s.tint('red', 0.5), 0.45, [1, 0.8]);
        s.arrow(X(33), y, X(32), cy + 6.5 * u, s.c('red'), 0.45, 2);
        s.line(X(97), cy + 3.2 * u, X(97), y, s.tint('red', 0.5), 0.45, [1, 0.8]);
        for (let k = 0; k < 3; k++) {
          const p = (t * 0.45 + k / 3) % 1;
          s.circle(lerp(X(97), X(32), p), y, 0.7 * u, { fill: s.c('red') });
        }
        s.text('gradients only', X(64), y + 4.5 * u, { size: 3, color: s.c('red'), weight: 600 });
      });
    });

    // Phase 2: distorted MNIST, SVHN, birds.
    const showcase = (content: (ctx: CanvasRenderingContext2D) => void, from: M, to: M, p: number, k: K, title: string, a: number) =>
      s.alpha(a, () => {
        const S = Math.min(50 * u, w * 0.46, h - 36 * u);
        const oS = Math.min(32 * u, S * 0.72);
        const x = (w - (S + 12 * u + oS)) / 2;
        const y = 16 * u;
        const box = lerpM(from, to, p);
        transformRead(s, content, x, y, S, box, x + S + 12 * u, y + (S - oS) / 2, oS, k, 1);
        s.arrow(x + S + 2 * u, y + S / 2, x + S + 10 * u, y + S / 2, s.c('--ink-3'), 0.4, 2);
        s.text(title, w / 2, y + S + 6 * u, { size: 3.4, weight: 600, color: s.c('--ink-2') });
        return { x, y, S, oS };
      });
    const full: M = [0.5, 0, 0, 0.5, 0.5, 0.5];
    const mA = s.win('mnist', 'svhn');
    if (mA > 0) {
      const p = s.since('undo') < 0 ? 0 : s.ease('undo', 2.2, 0.4);
      showcase(mnistContent, full, boxMap(0.6, 0.42, 0.2, 38), p, 'blue', 'distorted MNIST', mA);
      s.alpha(mA, () => {
        const lab = p < 0.5 ? 'before training: the whole canvas' : 'after: upright, centered';
        s.text(lab, w / 2, Math.min(h - 5 * u, 16 * u + Math.min(50 * u, w * 0.46, h - 36 * u) + 12 * u), { size: 3.1, italic: true, color: s.c(p < 0.5 ? '--ink-3' : 'teal') });
      });
    }
    const vA = s.win('svhn', 'birds');
    if (vA > 0) {
      const sheared: M = [0.32, -0.08, 0.1, 0.15, 0.48, 0.52];
      showcase(svhnContent, full, sheared, s.ease('svhn', 2, 0.8), 'blue', 'Street View house numbers', vA);
    }
    const bA = s.win('birds', 'drop');
    s.alpha(bA, () => {
      const S = Math.min(52 * u, w * 0.46, h - 34 * u);
      const oS = Math.min(24 * u, (h - 40 * u) / 2);
      const x = (w - (S + 12 * u + oS)) / 2;
      const y = 14 * u;
      const hp = s.ease('head', 1.6, 0.2);
      const head = lerpM(full, boxMap(0.69, 0.38, 0.14), hp);
      const body = lerpM(full, boxMap(0.44, 0.6, 0.24, -12), hp);
            const ox = x + S + 12 * u;
      transformRead(s, birdContent, x, y, S, body, ox, y + S / 2 + 2 * u, oS, '--accent', s.ease('head', 0.6, 0.8));
      transformRead(s, birdContent, x, y, S, head, ox, y + S / 2 - oS - 2 * u, oS, 'blue', s.ease('head', 0.6, 0.8));
      s.alpha(s.ease('head', 0.6, 1), () => {
        s.text('head', ox + oS + 2 * u, y + S / 2 - oS / 2 - 2 * u, { size: 3.2, align: 'left', color: s.c('blue'), weight: 600 });
        s.text('body', ox + oS + 2 * u, y + S / 2 + oS / 2 + 2 * u, { size: 3.2, align: 'left', color: s.c('--accent'), weight: 600 });
      });
      s.text('two transformers, no part labels', x + S / 2, y + S + 6 * u, { size: 3.2, weight: 600, color: s.c('--ink-2') });
    });

    // Phase 3: a drop-in layer.
    const dA = s.ease('drop', 0.7);
    s.alpha(dA, () => {
      const items: [string, K][] = [
        ['conv', 'slate'],
        ['conv', 'slate'],
        ['ST', 'blue'],
        ['conv', 'slate'],
        ['conv', 'slate'],
        ['fc', 'slate'],
      ];
      const bw = Math.min(14 * u, (w - 12 * u) / 6 - 3 * u);
      const tot = items.length * bw + (items.length - 1) * 3 * u;
      const x0 = (w - tot) / 2;
      const cy = h * 0.5;
      const drop = s.ease('drop', 1.2, 0.6);
      items.forEach(([t, k], i) => {
        const isST = k === 'blue';
        const slide = isST ? 0 : i < 2 ? (1 - drop) * 0.5 * (bw + 3 * u) : -(1 - drop) * 0.5 * (bw + 3 * u);
        const x = x0 + i * (bw + 3 * u) + slide;
        const y = isST ? lerp(cy - 30 * u, cy - 7 * u, drop) : cy - 7 * u;
        s.alpha(isST ? drop : 1, () => block(s, x, y, bw, 14 * u, t, k, { size: 3.2, on: isST ? 1 : 0 }));
        if (i && !isST && items[i - 1]![1] !== 'blue') s.arrow(x - 2.6 * u, cy, x - 0.4 * u, cy, s.c('--ink-3'), 0.3, 1.5);
      });
      s.text('drop it in anywhere; train as usual', w / 2, cy + 16 * u, { size: 3.4, italic: true, color: s.c('--ink-2') });
    });
  },
};

// ---------------------------------------------------------------- outro

const TOK = ['a', 'horse', 'stands', 'on', 'grass'];
const SELF = [
  [0.5, 0.3, 0.1, 0.05, 0.05],
  [0.08, 0.52, 0.2, 0.05, 0.15],
  [0.05, 0.45, 0.25, 0.1, 0.15],
  [0.05, 0.1, 0.2, 0.3, 0.35],
  [0.04, 0.2, 0.08, 0.2, 0.48],
];

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const P = pictures(s);
    // Phase 1: self-attention.
    const aA = s.win('after', 'vit');
    s.alpha(aA, () => {
      const sp = Math.min(19 * u, (w - 12 * u) / 5);
      const x0 = (w - 5 * sp) / 2;
      const ty = 16 * u;
      const par = s.ease('parallel', 0.6);
      TOK.forEach((t, j) => {
        const x = x0 + j * sp + sp / 2;
        pill(s, t, x, ty, '--ink-2', { size: 3.2, font: 'serif' });
        s.alpha(s.ease('qkv', 0.5, 0.3 * j), () => {
          const ks: [string, K][] = [
            ['q', 'slate'],
            ['k', 'orange'],
            ['v', 'gold'],
          ];
          ks.forEach(([lab, k], r) => {
            s.cell(x - 7 * u + r * 5 * u, ty + 5 * u, 4.4 * u, 4.4 * u, lab, k, { size: 2.6 });
          });
        });
      });
      // the recurrence being dropped
      s.alpha(s.win('after', 'every'), () => {
        const y = ty + 16 * u;
        TOK.forEach((_, j) => {
          const x = x0 + j * sp + sp / 2;
          block(s, x - 5 * u, y, 10 * u, 9 * u, 'h', 'green', { size: 3.4 });
          if (j) s.arrow(x - sp + 5.3 * u, y + 4.5 * u, x - 5.3 * u, y + 4.5 * u, s.c('green'), 0.35, 1.6);
          s.line(x, ty + 2.6 * u, x, y - 0.4 * u, s.tint('--ink-3', 0.6), 0.25);
        });
        s.text('the RNN: one step at a time', w / 2, y + 15 * u, { size: 3.1, color: s.c('green') });
        const k = s.ease('after', 0.8, 3);
        if (k > 0) s.line(x0, y + 4.5 * u, x0 + 5 * sp * k, y + 4.5 * u, s.c('red'), 0.7);
      });
      // one word attends to every word
      s.alpha(s.win('every', 'same'), () => {
        const from = 1;
        TOK.forEach((_, j) => {
          const a = SELF[from]![j]!;
          const xa = x0 + from * sp + sp / 2;
          const xb = x0 + j * sp + sp / 2;
          if (j === from) return;
          const yb = ty - 3.5 * u;
          const c = s.ctx;
          c.beginPath();
          c.moveTo(xa, yb);
          c.quadraticCurveTo((xa + xb) / 2, yb - 8 * u - Math.abs(j - from) * 2 * u, xb, yb);
          c.strokeStyle = s.tint('teal', 0.3 + 0.7 * a);
          c.lineWidth = (0.2 + 1.6 * a) * u;
          c.stroke();
        });
      });
      // the T x T weights, every row at once
      const mA = s.ease('every', 0.6, 0.8);
      const allRows = s.ease('same', 0.8);
      s.alpha(mA, () => {
        const cs = Math.min(8 * u, (h - 46 * u) / 5);
        const gx = w / 2 - 2.5 * cs;
        const gy = ty + 15 * u;
        for (let r = 0; r < 5; r++) {
          const on = r === 1 ? 1 : allRows;
          for (let j = 0; j < 5; j++) {
            const a = SELF[r]![j]!;
            s.rrect(gx + j * cs + 0.2 * u, gy + r * cs + 0.2 * u, cs - 0.4 * u, cs - 0.4 * u, 0.4, { fill: s.tint('teal', (0.08 + 0.85 * a) * on), stroke: s.tint('teal', 0.4), lw: 0.15 });
          }
          s.text(TOK[r]!, gx - 2 * u, gy + r * cs + cs / 2, { size: 2.8, align: 'right', font: 'serif', italic: true, color: s.c('--ink-2') });
        }
        s.alpha(allRows, () => s.text('alpha: every word attends to every word', w / 2, gy + 5 * cs + 4.5 * u, { size: 3, color: s.c('teal') }));
        s.alpha(1 - allRows, () => s.text('the row for "horse"', w / 2, gy + 5 * cs + 4.5 * u, { size: 3, color: s.c('teal') }));
        if (par > 0) {
          const pulse = 0.5 + 0.5 * Math.sin(s.since('parallel') * 4);
          s.alpha(par, () => s.rrect(gx - 0.6 * u, gy - 0.6 * u, 5 * cs + 1.2 * u, 5 * cs + 1.2 * u, 1, { stroke: s.tint('teal', 0.4 + 0.6 * pulse), lw: 0.6 }));
        }
        s.alpha(par, () => fit(s, 'no recurrence: all rows in parallel on a GPU', w / 2, gy + 5 * cs + 10 * u, w - 10 * u, { size: 3.1, italic: true, color: s.c('--ink-2') }));
      });
    });

    // Phase 2: an image as a sentence of patches.
    const vA = s.win('vit', 'recap1');
    s.alpha(vA, () => {
      if (!P) return loading(s, w / 2 - 15 * u, 16 * u, 30 * u);
      const S = Math.min(44 * u, h * 0.44);
      const ix = w / 2 - S / 2;
      const iy = 13 * u;
      const cut = s.ease('vit', 1, 0.6);
      const lay = s.ease('vit', 1.6, 2.2);
      const n = 4;
      const ps = S / n;
      const tw = Math.min((w - 8 * u) / 16, 7.5 * u);
      const rowY = iy + S + 14 * u;
      s.alpha(0.25 * lay, () => picture(s, 'horse', P.horse.rgb, ix, iy, S));
      const rx0 = (w - 16 * tw) / 2;
      for (let k = 0; k < 16; k++) {
        const r = Math.floor(k / n);
        const c = k % n;
        const gap = cut * 1.2 * u;
        const ax = ix + c * (ps + gap) - 1.5 * gap;
        const ay = iy + r * (ps + gap) - 1.5 * gap;
        const bx = rx0 + k * tw + 0.2 * u;
        const sz = lerp(ps, tw - 0.4 * u, lay);
        picture(s, 'horse', P.horse.rgb, lerp(ax, bx, lay), lerp(ay, rowY, lay), sz, { src: [c * 8, r * 8, 8, 8] });
      }
      s.alpha(lay, () => s.text('16 patches, read like 16 words', w / 2, rowY + tw + 5 * u, { size: 3.2, color: s.c('--ink-2') }));
    });

    // Phase 3: recap cards.
    const rA = s.win('recap1', 'next');
    s.alpha(rA, () => {
      const cards: [string, string, K, string][] = [
        ['soft attention', 'score, softmax, weighted average', 'teal', 'recap1'],
        ['hard attention', 'sample one place; train with REINFORCE', '--accent', 'recap2'],
        ['spatial transformer', 'theta, a sampling grid, bilinear reads', 'blue', 'recap3'],
      ];
      const cw = Math.min(w - 12 * u, 96 * u);
      const ch = 17 * u;
      const x = (w - cw) / 2;
      cards.forEach(([t, sub, k, beat], i) => {
        const y = 15 * u + i * (ch + 5 * u);
        s.alpha(s.ease(beat, 0.6), () => {
          s.rrect(x, y, cw, ch, 2, { fill: s.tint(k, 0.08), stroke: s.tint(k, 0.6), lw: 0.35 });
          fit(s, t, x + 5 * u, y + ch * 0.36, cw - 10 * u, { size: 4.2, font: 'display', weight: 600, align: 'left', color: s.c(k) });
          fit(s, sub, x + 5 * u, y + ch * 0.7, cw - 10 * u, { size: 3.2, align: 'left', color: s.c('--ink-2') });
        });
      });
    });

    // Phase 4: what next.
    const nA = s.ease('next', 0.7);
    s.alpha(nA, () => {
      fit(s, 'next: the interactive chapter', w / 2, h * 0.36, w - 12 * u, { size: 6, font: 'display', weight: 600 });
      fit(s, 'pick the word, tap the image, drag the grids', w / 2, h * 0.48, w - 14 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('dl26', 0.6), () => {
        fit(s, 'then DL26: transformers', w / 2, h * 0.66, w - 12 * u, { size: 5, font: 'display', italic: true, color: s.c('--accent') });
      });
    });
  },
};

export const scenesC: Record<string, SceneDef> = { stn, bilinear, learned, outro };
