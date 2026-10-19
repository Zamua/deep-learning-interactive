import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { LIN, LIN_FINAL, LIN_WRONG, NET_FINAL, NET_WRONG, NPTS, PASS0, PASS200, ROWS, XS, YS, lerpLin, linModel } from './data';
import { type K, Plane, at, boundary, classColor, cycle, liveRegions, margin, mark, pill, points, regions, top, within } from './draw';
import { barCell, crossfade, fit, num, plotSide, swap, twoPlots } from './kit';

// ---------------------------------------------------------------- intro

const INGREDIENTS: [string, string, K][] = [
  ['scores', 'chapter 4', 'purple'],
  ['softmax loss', 'chapter 4', 'red'],
  ['backprop', 'chapter 6', 'teal'],
  ['gradient descent', 'chapter 5', 'blue'],
];

/** A tiny falling curve standing for "all you see with images". */
function sparkline(s: Scene, x: number, y: number, w: number, h: number): void {
  s.rrect(x, y, w, h, 1.6, { fill: s.c('--paper'), stroke: s.c('--rule'), lw: 0.25 });
  const c = s.ctx;
  c.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const v = 0.15 + 0.7 * Math.exp(-4 * t) + 0.04 * Math.sin(t * 37);
    const px = x + s.u * 2 + t * (w - s.u * 4);
    const py = y + h - s.u * 2 - v * (h - s.u * 4);
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.strokeStyle = s.c('red');
  c.lineWidth = s.u * 0.4;
  c.stroke();
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const m = margin(s);
    const T = top(s);
    // Title, then the four ingredients.
    const aA = s.win('hello', 'data');
    if (aA > 0)
      s.alpha(aA, () => {
        const lift = s.ease('forty', 0.9);
        const ty = lerp(h * 0.44, T + u * 4, lift);
        fit(s, 'Putting it together', w / 2, ty, w - 2 * m, { size: lerp(10, 7, lift), font: 'display', weight: 600 });
        s.alpha(1 - lift, () => fit(s, 'a classifier and a network, from scratch', w / 2, ty + u * 10, w - 2 * m, { size: 4.4, italic: true, color: s.c('--ink-2') }));
        const cols = s.tall ? 2 : 4;
        const gap = u * 3;
        const tw = (w - 2 * m - gap * (cols - 1)) / cols;
        const th = u * 19;
        const rows = 4 / cols;
        const blockH = rows * th + (rows - 1) * gap + u * 9;
        const y0 = lerp(T + u * 12, Math.max(T + u * 12, (T + u * 8 + h - m - blockH) / 2), 0.5);
        const when = [0, 0.08, 0.2, 0.33];
        INGREDIENTS.forEach(([name, ch, k], i) => {
          const a = within(s, 'forty', when[i]!, when[i]! + 0.14);
          if (a <= 0) return;
          const x = m + (i % cols) * (tw + gap);
          const y = y0 + Math.floor(i / cols) * (th + gap) + (1 - a) * u * 3;
          s.alpha(a, () => {
            s.rrect(x, y, tw, th, 2.2, { fill: s.tint(k, 0.08), stroke: s.tint(k, 0.6), lw: 0.35 });
            fit(s, name, x + tw / 2, y + th * 0.42, tw - u * 3, { size: 5, font: 'display', weight: 560, color: s.c(k) });
            s.text(ch, x + tw / 2, y + th * 0.74, { size: 3.2, font: 'ui', weight: 600, color: s.c('--ink-3') });
          });
        });
        s.alpha(within(s, 'forty', 0.45, 0.6), () =>
          s.text('≈ 40 lines of NumPy', w / 2, y0 + rows * (th + gap) + u * 5, { size: 5, font: 'mono', weight: 650, color: s.c('--accent') }),
        );
      });
    // The spiral, and why two dimensions.
    const bA = s.win('data', 'lin');
    if (bA > 0)
      s.alpha(bA, () => {
        const avail = h - T - m;
        const size = Math.min(avail, w * 0.52);
        const pl = new Plane(s, w - m - size, T + (avail - size) / 2, size);
        pl.card();
        const p = clamp01(s.prog('data') * 1.5);
        points(s, pl, XS, YS, { each: (i) => clamp01((p * (NPTS + 20) - i) / 20) });
        const lx = m;
        const lw = w - 3 * m - size;
        const ly = pl.y + u * 6;
        fit(s, '300 points', lx, ly, lw, { size: 6.5, font: 'display', weight: 600, align: 'left' });
        fit(s, '3 classes, 2 numbers each', lx, ly + u * 7, lw, { size: 3.6, color: s.c('--ink-2'), align: 'left' });
        const wa = s.ease('why2d', 0.6);
        s.alpha(wa, () => {
          const cw = Math.min(lw, u * 36);
          const cy = ly + u * 15;
          fit(s, 'images: a loss curve', lx, cy, lw, { size: 3.4, font: 'ui', weight: 600, color: s.c('--ink-3'), align: 'left' });
          sparkline(s, lx, cy + u * 3, cw, u * 16);
        });
        s.alpha(s.ease('why2d', 0.6, at(s, 'why2d', 0.5) - s.at('why2d')), () => {
          const cy = ly + u * 42;
          fit(s, 'points: the whole picture', lx, cy, lw, { size: 3.4, font: 'ui', weight: 600, color: s.c('--ink'), align: 'left' });
          s.arrow(lx + Math.min(lw, u * 30), cy + u * 4, pl.x - u * 1.5, cy + u * 4, s.c('--ink-3'), 0.4, 2.4);
        });
      });
    // The two endings.
    const cA = s.win('lin', 'loop');
    if (cA > 0)
      s.alpha(cA, () => {
        const [q1, p2] = twoPlots(s, 9);
        const slide = s.ease('net', 0.8);
        const p1 = new Plane(s, lerp((s.w - q1.size) / 2, q1.x, slide), q1.y, q1.size);
        const la = s.ease('lin', 0.6);
        s.alpha(la, () => {
          p1.card();
          regions(s, p1, 'lin200', LIN_FINAL);
          boundary(s, p1, 'lin200', LIN_FINAL, 0.7 * s.win('why', 'net'), 200);
          points(s, p1, XS, YS, { wrong: LIN_WRONG, ring: s.ease('lin', 0.6, 2) });
          header(s, p1, 'linear classifier', '49%', 'red');
        });
        const na = s.ease('net', 0.6);
        s.alpha(na, () => {
          p2.card();
          regions(s, p2, 'net10000', NET_FINAL, 1, 140);
          points(s, p2, XS, YS, { wrong: NET_WRONG, ring: s.ease('net', 0.6, 2) });
          header(s, p2, 'two-layer network', '99%', 'green');
        });
      });
    // The loop both share.
    const dA = s.ease('loop', 0.6);
    if (dA > 0) {
      const R = Math.min(w, h) * 0.27;
      const marks = [0.36, 0.54, 0.7, 0.86];
      const lit = (k: number) => {
        if (s.since('go') >= 0) return 0.35 + 0.65 * (Math.floor(s.since('go') * 1.6) % 4 === k ? 1 : 0);
        return s.t >= at(s, 'loop', marks[k]!) ? 1 : 0;
      };
      cycle(s, w / 2, T + (h - T) / 2, R, lit, { a: dA, size: s.tall ? 4 : 4.4, center: 'repeat' });
    }
  },
};

/** Model name and accuracy above a plane. */
function header(s: Scene, pl: Plane, name: string, acc: string, k: K): void {
  const y = pl.y - s.u * 4.2;
  const pw = s.measure(acc, { font: 'mono', size: 3.6, weight: 600 }) + s.u * 3.6 * 0.9;
  fit(s, name, pl.x, y, pl.size - pw - s.u * 2, { size: 3.8, font: 'ui', weight: 650, align: 'left' });
  pill(s, acc, pl.x + pl.size, y, k, { size: 3.6, align: 'right' });
}

// ---------------------------------------------------------------- data

/** The noise-free arm j at fraction q along it: (x0, x1) = (r sin t, r cos t). */
const armAt = (j: number, q: number): [number, number] => {
  const t = 4 * j + 4 * q;
  return [q * Math.sin(t), q * Math.cos(t)];
};

function armCurve(s: Scene, pl: Plane, j: number, upto: number, col: string, width: number, dash?: number[]): void {
  if (upto <= 0) return;
  const c = s.ctx;
  c.save();
  c.beginPath();
  const n = Math.max(2, Math.ceil(120 * upto));
  for (let i = 0; i <= n; i++) {
    const [a, b] = armAt(j, (upto * i) / n);
    if (i) c.lineTo(pl.X(a), pl.Y(b));
    else c.moveTo(pl.X(a), pl.Y(b));
  }
  c.strokeStyle = col;
  c.lineWidth = width * s.u;
  c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
  c.lineCap = 'round';
  c.stroke();
  c.restore();
}

const data: SceneDef = {
  marks: {
    x0: { tex: String.raw`\sym{X}{x_0} = r \sin t`, x: 0.7, y: 0.6, size: 4.4, align: 'left' },
    x1: { tex: String.raw`\sym{X}{x_1} = r \cos t`, x: 0.7, y: 0.7, size: 4.4, align: 'left' },
  },
  draw(s) {
    const { u } = s;
    const { pl, side } = plotSide(s, s.tall ? 0.56 : 0.58);
    const [sx, sy, sw] = side;
    pl.card();
    const arm = (i: number) => Math.floor(i / 100);
    // Points: the finished spiral, rebuilt arm by arm, then the demo arm, then all three.
    const built = clamp01(s.prog('loop') / 0.85);
    const each = (i: number): number => {
      const j = arm(i);
      const k = i % 100;
      if (s.since('loop') < 0) return 1;
      if (s.since('polar') < 0) return Math.max(clamp01((built * 3 - j) * 100 - k + 1), 1 - s.ease('loop', 0.35));
      if (s.since('lab') >= 0) return 1;
      const g = lerp(1, 0.15, s.ease('polar', 0.6));
      if (j === 0 && s.since('noise') >= 0) return g + (1 - g) * clamp01(s.prog('noise') * 1.4 * 110 - k);
      if (j > 0 && s.since('walk') >= 0) return g + (1 - g) * clamp01((s.prog('walk') * 2.2 - (j - 1)) * 110 - k);
      return g;
    };
    points(s, pl, XS, YS, { each });
    // The three rows the chapter follows.
    s.alpha(s.win('rows', 'loop'), () =>
      ROWS.forEach((i) => {
        const px = pl.X(XS.d[2 * i]!);
        const py = pl.Y(XS.d[2 * i + 1]!);
        s.circle(px, py, pl.r + u * 1.1, { stroke: s.c('--ink'), lw: 0.4 });
        s.text(String(i), px + u * 2.2, py - u * 2.6, { size: 2.8, font: 'mono', weight: 650, halo: true, align: 'left' });
      }),
    );
    // The demo point on the clean arm 0.
    const demo = s.win('polar', 'walk');
    let q = 0.62;
    if (s.since('r') >= 0 && s.since('noise') < 0) q = s.since('t') >= 0 ? 0.08 + 0.92 * within(s, 't', 0.05, 0.85) : 0.08 + 0.92 * within(s, 'r', 0.05, 0.85);
    if (demo > 0)
      s.alpha(demo, () => {
        const cx = pl.X(0);
        const cy = pl.Y(0);
        armCurve(s, pl, 0, 1, s.tint('blue', 0.3), 0.3, [1, 1]);
        armCurve(s, pl, 0, q, s.c('blue'), 0.5);
        const [a, b] = armAt(0, q);
        const px = pl.X(a);
        const py = pl.Y(b);
        const tq = 4 * q;
        s.line(cx, cy, px, py, s.c('--ink-2'), 0.4);
        const ctx = s.ctx;
        const R = Math.max(u * 4, q * pl.k * 0.35);
        ctx.beginPath();
        ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + tq);
        ctx.strokeStyle = s.c('--accent');
        ctx.lineWidth = u * (s.since('t') >= 0 && s.since('noise') < 0 ? 0.6 : 0.4);
        ctx.stroke();
        s.line(cx, cy, cx, cy - R - u * 2, s.tint('--accent', 0.5), 0.25, [0.8, 0.6]);
        const mid = -Math.PI / 2 + tq / 2;
        s.text('t', cx + (R + u * 2.6) * Math.cos(mid), cy + (R + u * 2.6) * Math.sin(mid), { size: 3.8, italic: true, weight: 650, color: s.c('--accent'), halo: true });
        s.text('r', (cx + px) / 2 - u * 2 * Math.cos(tq), (cy + py) / 2 - u * 2 * Math.sin(tq), { size: 3.8, italic: true, weight: 650, color: s.c('--ink'), halo: true });
        const xa = s.win('xy', 'walk');
        s.alpha(xa, () => {
          s.line(px, py, px, cy, s.c('orange'), 0.35, [0.8, 0.6]);
          s.line(px, py, cx, py, s.c('orange'), 0.35, [0.8, 0.6]);
          s.text('x₀', px, cy + u * 3, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange'), halo: true });
          s.text('x₁', cx - u * 3.2, py, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange'), halo: true });
        });
        s.circle(px, py, u * 1.3, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.35 });
      });
    // The other two arms as clean curves.
    const wA = s.win('walk', 'lab');
    if (wA > 0)
      s.alpha(wA, () => {
        for (let j = 1; j < 3; j++) armCurve(s, pl, j, clamp01(s.prog('walk') * 2.2 - (j - 1)), s.tint(classColor(j), 0.7), 0.4);
        armCurve(s, pl, 0, 1, s.tint('blue', 0.7), 0.4);
      });
    // A straight cut that fails.
    const cutA = s.win('cut', 'pre');
    if (cutA > 0)
      s.alpha(cutA, () => {
        const th = 0.5 + 2.4 * s.prog('cut');
        const off = 0.12 * Math.sin(s.prog('cut') * 7);
        const nx = Math.cos(th);
        const ny = Math.sin(th);
        pl.clip(() => {
          const c = s.ctx;
          const L = 3;
          const p0 = [off * nx - ny * L, off * ny + nx * L];
          const p1 = [off * nx + ny * L, off * ny - nx * L];
          c.beginPath();
          c.moveTo(pl.X(p0[0]!), pl.Y(p0[1]!));
          c.lineTo(pl.X(p1[0]!), pl.Y(p1[1]!));
          c.lineTo(pl.X(p1[0]! + nx * L), pl.Y(p1[1]! + ny * L));
          c.lineTo(pl.X(p0[0]! + nx * L), pl.Y(p0[1]! + ny * L));
          c.closePath();
          c.fillStyle = s.tint('--ink', 0.07);
          c.fill();
          s.line(pl.X(p0[0]!), pl.Y(p0[1]!), pl.X(p1[0]!), pl.Y(p1[1]!), s.c('--ink'), 0.5);
        });
      });
    const preA = s.ease('pre', 0.6);
    s.alpha(preA, () => {
      const c = s.ctx;
      c.save();
      c.setLineDash([u * 1, u * 0.8]);
      s.rrect(pl.X(-1), pl.Y(1), pl.X(1) - pl.X(-1), pl.Y(-1) - pl.Y(1), 0.5, { stroke: s.c('--ink-2'), lw: 0.35 });
      c.restore();
      s.text('1', pl.X(1) - u * 1.6, pl.Y(1) + u * 2.4, { size: 3, font: 'mono', color: s.c('--ink-2'), halo: true });
      s.text('−1', pl.X(-1) + u * 2.4, pl.Y(-1) - u * 2.4, { size: 3, font: 'mono', color: s.c('--ink-2'), halo: true });
    });

    // ---- side panel
    const L = (str: string, y: number, o: { size?: number; k?: K; mono?: boolean; w?: number } = {}) =>
      fit(s, str, sx, y, sw, { size: o.size ?? 3.2, font: o.mono ? 'mono' : 'ui', weight: 600, color: s.c(o.k ?? '--ink-3'), align: 'left' });
    const shA = s.win('shape', 'rows');
    s.alpha(shA, () => {
      const items: [string, string, number][] = [
        ['N = 100', 'points per class', 0.05],
        ['K = 3', 'classes', 0.25],
        ['D = 2', 'numbers per point', 0.72],
      ];
      items.forEach(([v, lab, f], i) => {
        const y = sy + u * 6 + i * u * 13;
        s.alpha(within(s, 'shape', f, f + 0.12), () => {
          pill(s, v, sx, y, 'slate', { size: 3.6, align: 'left' });
          L(lab, y + u * 5.2, { size: 2.9 });
        });
      });
    });
    const tA = s.win('rows', 'loop');
    s.alpha(tA, () => {
      const cw = Math.min(sw / 3.3, u * 12);
      const rh = u * 6;
      const y0 = sy + u * 6;
      s.text('X', sx + cw, y0, { size: 4.4, italic: true, weight: 650, color: s.c('orange') });
      s.text('y', sx + cw * 2.6, y0, { size: 4.4, italic: true, weight: 650, color: s.c('gold') });
      ROWS.forEach((i, r) => {
        const y = y0 + u * 4 + r * rh * 1.6;
        s.text(num(XS.d[2 * i]!), sx + cw * 0.5, y + rh / 2, { size: 2.9, font: 'mono' });
        s.text(num(XS.d[2 * i + 1]!), sx + cw * 1.5, y + rh / 2, { size: 2.9, font: 'mono' });
        s.text(String(YS[i]), sx + cw * 2.6, y + rh / 2, { size: 2.9, font: 'mono', weight: 700, color: s.c(classColor(YS[i]!)) });
        s.text('⋮', sx + cw, y + rh * 1.3, { size: 2.6, color: s.c('--ink-3') });
      });
      L('(300, 2)', y0 + u * 4 + 3 * rh * 1.6 + u * 2, { mono: true, size: 3 });
    });
    const pA = s.win('polar', 'xy');
    s.alpha(pA, () => {
      L('distance', sy + u * 5);
      s.text(`r = ${num(q)}`, sx, sy + u * 10.5, { size: 4.4, font: 'mono', weight: 650, align: 'left' });
      L('angle', sy + u * 18);
      s.text(`t = ${num(4 * q)}`, sx, sy + u * 23.5, { size: 4.4, font: 'mono', weight: 650, color: s.c('--accent'), align: 'left' });
      s.alpha(s.win('t', 'noise'), () => L('4 rad ≈ 229°', sy + u * 31, { size: 3 }));
    });
    const xyA = s.win('xy', 'walk');
    s.show('x0', xyA, { x: sx / s.w, y: (sy + u * 8) / s.h });
    s.show('x1', xyA, { x: sx / s.w, y: (sy + u * 17) / s.h });
    const walkA = s.win('walk', 'lab');
    s.alpha(walkA, () => {
      L('arm j: t from', sy + u * 5);
      for (let j = 0; j < 3; j++) {
        s.alpha(j === 0 ? 1 : clamp01(s.prog('walk') * 2.2 - (j - 1) + 0.3), () =>
          s.text(`${4 * j} to ${4 * j + 4}`, sx, sy + u * (11 + 6 * j), { size: 3.6, font: 'mono', weight: 650, color: s.c(classColor(j)), align: 'left' }),
        );
      }
    });
    const labA = s.win('lab', 'cut');
    s.alpha(labA, () => {
      for (let j = 0; j < 3; j++) {
        const y = sy + u * (6 + 7 * j);
        s.circle(sx + u * 1.5, y, u * 1.3, { fill: s.c(classColor(j)) });
        s.text(`y = ${j}`, sx + u * 4.5, y, { size: 3.6, font: 'mono', weight: 600, align: 'left' });
      }
    });
    const cutT = s.win('cut', 'pre');
    s.alpha(cutT, () => {
      mark(s, sx + u * 2, sy + u * 6, u * 2, false);
      L('no straight line', sy + u * 12, { k: '--ink-2' });
      L('separates them', sy + u * 16.5, { k: '--ink-2' });
    });
    s.alpha(preA, () => {
      L('already within', sy + u * 6, { k: '--ink-2' });
      L('−1 and 1', sy + u * 10.5, { k: '--ink-2', mono: true });
      L('no rescaling', sy + u * 17, { size: 3 });
    });
  },
};

// ---------------------------------------------------------------- scores

/** Rows shown for X and scores in the multiply diagram; null is an ellipsis. */
const SHOWN: (number | null)[] = [0, 1, null, 60, null, 299];

function scoresLayout(s: Scene) {
  const { u } = s;
  const m = margin(s);
  const cw = (s.tall ? 10.4 : 10) * u;
  const ch = 6 * u;
  const span = u * 50 + 5 * cw;
  const xX = m + Math.max(0, (s.w - 2 * m - span) / 2) + u * 8;
  const xS = xX + 2 * cw + u * 3;
  const yW = top(s) + u * 5;
  const yB = yW + 2 * ch + u * 1.6;
  const yS = yB + ch + u * 7;
  const notes = xS + 3 * cw + u * 5;
  return { cw, ch, xX, xS, yW, yB, yS, notes };
}

const scores: SceneDef = {
  marks: {
    rows: { tex: String.raw`\syms = \symX\,\symW + \symb`, x: 0.8, y: 0.5, size: 4.6 },
    cols: { tex: String.raw`f(x) = \symW x + \symb`, x: 0.8, y: 0.62, size: 4.2 },
    plane: { tex: String.raw`\syms_k = \symX\,\symW_{:,k} + \symb_k`, x: 0.8, y: 0.62, size: 4, align: 'left' },
  },
  draw(s) {
    const { w, u } = s;
    const P0 = PASS0;
    const W0 = LIN.states[0]!;
    // Phase 1: the multiply, laid out so each score sits where its row of X meets its column of W.
    const aA = s.win('params', 'pred');
    if (aA > 0)
      s.alpha(aA, () => {
        const { cw, ch, xX, xS, yW, yB, yS, notes } = scoresLayout(s);
        const nw = w - notes - margin(s);
        // W and b
        const wa = s.ease('params', 0.6);
        s.alpha(wa, () => {
          s.text('W', xX + cw, yW + ch, { size: 5.4, italic: true, weight: 650, color: s.c('blue') });
          for (let k = 0; k < 3; k++) s.text(`class ${k}`, xS + k * cw + cw / 2, yW - u * 2.4, { size: 2.6, font: 'ui', weight: 650, color: s.c(classColor(k)) });
          ['x₀', 'x₁'].forEach((t, r) => s.text(t, xS - u * 2.2, yW + r * ch + ch / 2, { size: 2.8, font: 'mono', color: s.c('orange') }));
          const vals = s.ease('init', 0.5, 0.3);
          for (let r = 0; r < 2; r++)
            for (let k = 0; k < 3; k++) s.cell(xS + k * cw, yW + r * ch, cw, ch, vals > 0.5 ? num(W0.W[r * 3 + k]!, 3) : '', 'blue', { size: 2.7, on: sweepOn(s, k) });
        });
        const ba = s.ease('init', 0.5, at(s, 'init', 0.6) - s.at('init'));
        s.alpha(ba, () => {
          s.text('b', xX + cw, yB + ch / 2, { size: 5.4, italic: true, weight: 650, color: s.c('green') });
          for (let k = 0; k < 3; k++) s.cell(xS + k * cw, yB, cw, ch, '0', 'green', { size: 2.8 });
        });
        // X and scores
        const xa = s.ease('mult', 0.6);
        s.alpha(xa, () => {
          s.text('X', xX + cw, yS - u * 2.6, { size: 4.4, italic: true, weight: 650, color: s.c('orange') });
          s.text('scores', xS + 1.5 * cw, yS - u * 2.6, { size: 3.4, font: 'mono', weight: 650, color: s.c('purple') });
          SHOWN.forEach((i, r) => {
            const y = yS + r * ch;
            if (i === null) {
              s.text('⋮', xX + cw, y + ch / 2, { size: 3, color: s.c('--ink-3') });
              s.text('⋮', xS + 1.5 * cw, y + ch / 2, { size: 3, color: s.c('--ink-3') });
              return;
            }
            const hi = i === 60 ? rowFocus(s) : 0;
            s.text(String(i), xX - u * 3.4, y + ch / 2, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
            for (let c = 0; c < 2; c++) s.cell(xX + c * cw, y, cw, ch, num(XS.d[2 * i + c]!), 'orange', { size: 2.7, on: hi });
            for (let k = 0; k < 3; k++) s.cell(xS + k * cw, y, cw, ch, num(P0.scores.d[3 * i + k]!, 3), 'purple', { size: 2.6, on: Math.max(hi, i === 60 ? sweepOn(s, k) : 0) });
          });
        });
        // shapes
        const sa = s.win('shapes', 'row');
        s.alpha(sa, () => {
          const yb = yS + SHOWN.length * ch + u * 3.4;
          pill(s, '(300, 2)', xX + cw, yb, 'orange', { size: 2.8 });
          pill(s, '(300, 3)', xS + 1.5 * cw, yb, 'purple', { size: 2.8 });
          pill(s, '(2, 3)', xS + 3 * cw + u * 2, yW + ch, 'blue', { size: 2.8, align: 'left' });
          s.alpha(s.ease('shapes', 0.5, 1.2), () => {
            fit(s, '(300, 2)·(2, 3)', notes, yS + ch * 2, nw, { size: 3, font: 'mono', weight: 600, align: 'left' });
            fit(s, '→ (300, 3)', notes, yS + ch * 3, nw, { size: 3, font: 'mono', weight: 600, color: s.c('purple'), align: 'left' });
          });
        });
        // broadcasting: b copied down every row
        const bc = s.win('bcast', 'row');
        if (bc > 0)
          s.alpha(bc, () => {
            pill(s, '(1, 3)', xS + 3 * cw + u * 2, yB + ch / 2, 'green', { size: 2.8, align: 'left' });
            const p = s.prog('bcast');
            const c = s.ctx;
            c.save();
            c.setLineDash([u * 0.7, u * 0.6]);
            SHOWN.forEach((i, r) => {
              if (i === null) return;
              const a = clamp01(p * 7 - r);
              s.alpha(a, () => {
                for (let k = 0; k < 3; k++) s.rrect(xS + k * cw + u * 0.5, yS + r * ch + u * 0.5, cw - u, ch - u, 1, { stroke: s.c('green'), lw: 0.3 });
              });
            });
            c.restore();
            fit(s, '+ b on every row', notes, yS + ch * 4.5, nw, { size: 3, font: 'ui', weight: 600, color: s.c('green'), align: 'left' });
          });
        // row 60
        const ra = s.win('row', 'pred');
        s.alpha(ra, () => {
          const y = yS + 3 * ch;
          fit(s, 'row 60, class 0', notes, y - ch * 1.6, nw, { size: 3, font: 'ui', weight: 650, color: s.c('--ink-2'), align: 'left' });
          fit(s, 'scores ≈ 0', notes, y + ch * 0.5, nw, { size: 3.2, font: 'mono', weight: 600, color: s.c('purple'), align: 'left' });
          fit(s, 'W is tiny', notes, y + ch * 1.4, nw, { size: 2.9, font: 'ui', weight: 600, color: s.c('--ink-3'), align: 'left' });
        });
        const c4 = s.win('ch4', 'pred');
        const mx = (notes + nw / 2) / w;
        s.show('rows', aA * c4, { x: mx, y: (yW + ch * 0.4) / s.h });
        s.show('cols', aA * c4 * s.ease('ch4', 0.5, 1.4), { x: mx, y: (yW + ch * 1.9) / s.h });
        s.alpha(c4, () => fit(s, 'chapter 4: columns', notes, yW + ch * 2.9, nw, { size: 2.7, font: 'ui', weight: 600, color: s.c('--ink-3'), align: 'left' }));
      });
    // Phase 2: the argmax, and the wedges it carves.
    const bA = s.ease('pred', 0.6);
    if (bA > 0)
      s.alpha(bA, () => {
        const { pl, side } = plotSide(s, 0.6);
        const [sx, sy, sw] = side;
        pl.card();
        const st = s.since('planes') >= 0 ? lerpLin(LIN.states[0]!, LIN.states[200]!, within(s, 'planes', 0.08, 0.7)) : LIN.states[0]!;
        const model = linModel(st);
        liveRegions(s, pl, model, s.ease('wedges', 0.8));
        // the straight lines where two class scores tie
        s.alpha(s.ease('planes', 0.6), () =>
          pl.clip(() => {
            for (const [i, j] of [[0, 1], [1, 2], [0, 2]] as const) {
              const a = st.W[i]! - st.W[j]!;
              const b = st.W[3 + i]! - st.W[3 + j]!;
              const c = st.b[i]! - st.b[j]!;
              const n = Math.hypot(a, b);
              if (n < 1e-9) continue;
              const fx = (-c * a) / (n * n);
              const fy = (-c * b) / (n * n);
              const dx = -b / n;
              const dy = a / n;
              s.line(pl.X(fx - dx * 3), pl.Y(fy - dy * 3), pl.X(fx + dx * 3), pl.Y(fy + dy * 3), s.tint('--ink', 0.55), 0.3, [1, 0.8]);
            }
          }),
        );
        points(s, pl, XS, YS, { r: pl.r * 0.9 });
        const p60 = [pl.X(XS.d[120]!), pl.Y(XS.d[121]!)] as const;
        s.circle(p60[0], p60[1], pl.r + u * 1.2, { stroke: s.c('--ink'), lw: 0.45 });
        s.text('60', p60[0] + u * 3.6, p60[1] - u * 2.4, { size: 2.8, font: 'mono', weight: 650, halo: true });
        // side: the three scores of row 60, and the winner
        const sc = Array.from({ length: 3 }, (_, k) => P0.scores.d[180 + k]!);
        const win = sc.indexOf(Math.max(...sc));
        const bw = Math.min(sw / 4, u * 9);
        const base = sy + u * 26;
        fit(s, 'row 60: scores', sx, sy + u * 3, sw, { size: 3, font: 'ui', weight: 650, color: s.c('--ink-3'), align: 'left' });
        s.line(sx, base, sx + bw * 3.4, base, s.c('--axis'), 0.3);
        sc.forEach((v, k) => {
          const hh = (v / 0.007) * u * 14;
          const x = sx + k * bw * 1.15;
          s.rrect(x, Math.min(base, base - hh), bw, Math.abs(hh), 0.6, { fill: s.tint(classColor(k), k === win ? 0.85 : 0.35) });
          s.text(String(k), x + bw / 2, base + u * 3 + (v < 0 ? Math.abs(hh) : 0), { size: 2.8, font: 'mono', color: s.c(classColor(k)) });
        });
        s.alpha(s.ease('pred', 0.5, 1.2), () => {
          fit(s, `argmax → ${win}`, sx, base + u * 12, sw, { size: 3.6, font: 'mono', weight: 650, color: s.c(classColor(win)), align: 'left' });
          fit(s, 'its true class is 0', sx, base + u * 17, sw, { size: 2.8, font: 'ui', weight: 600, color: s.c('--ink-3'), align: 'left' });
        });
        s.alpha(s.win('wedges', 'planes'), () => fit(s, 'b = 0: wedges meet at 0', sx, base + u * 25, sw, { size: 2.8, font: 'ui', weight: 600, color: s.c('--ink-2'), align: 'left' }));
        s.alpha(s.ease('planes', 0.6), () => {
          fit(s, 'two flat planes', sx, base + u * 25, sw, { size: 3, font: 'ui', weight: 650, color: s.c('--ink-2'), align: 'left' });
          fit(s, 'meet in a line', sx, base + u * 29.5, sw, { size: 3, font: 'ui', weight: 650, color: s.c('--ink-2'), align: 'left' });
        });
      });
  },
};

/** How lit column k is while the multiply sweeps row 60 across W's columns. */
function sweepOn(s: Scene, k: number): number {
  if (s.since('mult') < 0 || s.since('shapes') >= 0) return 0;
  const p = s.prog('mult');
  const cur = Math.floor(clamp01((p - 0.35) / 0.6) * 3);
  return p > 0.35 && cur === k ? 1 : 0;
}
function rowFocus(s: Scene): number {
  const sweep = s.since('mult') >= 0 && s.since('shapes') < 0 && s.prog('mult') > 0.3 ? 0.6 : 0;
  return Math.max(sweep, s.win('row', 'pred'));
}

// ---------------------------------------------------------------- loss

function lossLayout(s: Scene) {
  const { u } = s;
  const m = margin(s);
  const cw = 12 * u;
  const ch = 8 * u;
  const x0 = Math.max(m, (s.w - 69 * u) / 2) + 14 * u;
  const y0 = top(s) + 8 * u;
  const xc = x0 + 3 * cw + 7 * u;
  return { cw, ch, x0, y0, xc, gridBottom: y0 + 3 * ch };
}

const loss: SceneDef = {
  marks: {
    Li: { tex: String.raw`\symL_i = -\log \dfrac{e^{\syms_{\symy_i}}}{\sum_j e^{\syms_j}}`, x: 0.5, y: 0.5, size: 5.6 },
    log3: { tex: String.raw`-\log \tfrac{1}{3} = \log 3 \approx 1.099`, x: 0.3, y: 0.8, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const m = margin(s);
    const { cw, ch, x0, y0, xc, gridBottom } = lossLayout(s);
    // Values switch to the untrained classifier at the bottom of a quick dip.
    const init = s.since('start') >= 0.25;
    const dip = s.since('start') < 0 ? 1 : clamp01(Math.abs(s.since('start') - 0.25) / 0.25);
    const P = init ? PASS0 : PASS200;
    // The formula, centered first, then parked bottom right.
    const park = s.ease('trained', 0.8);
    const fA = 1 - s.ease('avg', 0.5);
    s.show('Li', s.ease('job', 0.6) * fA, { x: lerp(0.5, 0.73, park), y: lerp(0.5, (gridBottom + (h - gridBottom) * 0.42) / h, park) });
    const gA = s.ease('trained', 0.6, 0.4);
    if (gA <= 0) return;
    s.alpha(gA, () => {
      // row and label columns
      for (let r = 0; r < 3; r++) {
        const i = ROWS[r]!;
        const y = y0 + r * ch;
        s.text(String(i), x0 - u * 10, y + ch / 2, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text(String(YS[i]), x0 - u * 4, y + ch / 2, { size: 3.2, font: 'mono', weight: 700, color: s.c('gold') });
      }
      s.text('row', x0 - u * 10, y0 - u * 3, { size: 2.6, font: 'ui', weight: 600, color: s.c('--ink-3') });
      s.text('y', x0 - u * 4, y0 - u * 3, { size: 3.4, italic: true, weight: 650, color: s.c('gold') });
      // the 3 x 3 grid: scores, then exp_scores, then probs
      const sw = swap(s, ['trained', 'exp', 'norm', 'start']);
      const names = ['scores', 'exp_scores', 'probs', 'probs'];
      const nameK: K[] = ['purple', '--ink', '--ink', '--ink'];
      const val = (stage: number, i: number, k: number): string => {
        const q = stage === 3 ? PASS0 : PASS200;
        if (stage === 0) return num(q.scores.d[3 * i + k]!);
        if (stage === 1) return num(q.exp_scores.d[3 * i + k]!);
        return num(q.probs.d[3 * i + k]!, stage === 3 ? 3 : 2);
      };
      const pickA = s.ease('pick', 0.5);
      crossfade(s, sw, (stage) => {
        s.text(names[stage]!, x0 + 1.5 * cw, y0 - u * 3, { size: 3.2, font: 'mono', weight: 650, color: s.c(nameK[stage]!) });
        for (let r = 0; r < 3; r++)
          for (let k = 0; k < 3; k++) {
            const i = ROWS[r]!;
            const correct = YS[i] === k;
            const pf = stage >= 2 ? (stage === 3 ? PASS0 : PASS200).probs.d[3 * i + k]! : undefined;
            barCell(s, x0 + k * cw + u * 0.4, y0 + r * ch + u * 0.5, cw - u * 0.8, ch - u * 1, val(stage, i, k), stage === 0 ? 'purple' : classColor(k), { fill: pf, gold: correct ? pickA : 0, size: 3 });
          }
      });
      for (let k = 0; k < 3; k++) s.text(`class ${k}`, x0 + k * cw + cw / 2, gridBottom + u * 2.6, { size: 2.4, font: 'ui', weight: 600, color: s.c(classColor(k)) });
      // each row sums to one
      s.alpha(s.win('norm', 'pick'), () => s.text('each row sums to 1', x0 + 1.5 * cw, gridBottom + u * 6.4, { size: 2.8, font: 'ui', weight: 600, color: s.c('--ink-2') }));
      // the correct column, then minus its log
      const cA = pickA;
      if (cA > 0)
        s.alpha(cA * dip, () => {
          const lg = init ? s.ease('log3', 0.5) : s.ease('log', 0.5) * (1 - s.ease('start', 0.4));
          const head = lg > 0.5 ? '−log' : 'correct';
          s.text(head, xc + cw / 2, y0 - u * 3, { size: 3.2, font: 'mono', weight: 650, color: s.c(lg > 0.5 ? 'red' : 'gold') });
          for (let r = 0; r < 3; r++) {
            const i = ROWS[r]!;
            const p = P.probs.d[3 * i + YS[i]!]!;
            const a = within(s, 'pick', 0.1 + 0.15 * r, 0.25 + 0.15 * r);
            s.alpha(init ? 1 : a, () => {
              s.arrow(x0 + 3 * cw + u * 0.4, y0 + r * ch + ch / 2, xc - u * 0.8, y0 + r * ch + ch / 2, s.tint('gold', 0.5), 0.25, 1.6);
              barCell(s, xc, y0 + r * ch + u * 0.5, cw, ch - u, lg > 0.5 ? num(-Math.log(p), 3) : num(p, init ? 3 : 2), lg > 0.5 ? 'red' : 'gold', { size: 3 });
            });
          }
        });
      // bottom left: the cost curve -log(p)
      const curveA = s.ease('log', 0.6);
      const bx = m + u * 2;
      const by = gridBottom + u * 9;
      const bw = Math.min(w * 0.4, u * 44);
      const bh = h - by - m - u * 4;
      if (curveA > 0)
        s.alpha(curveA, () => {
          const X = (p: number) => bx + p * bw;
          const Y = (v: number) => by + bh - (Math.min(v, 4.2) / 4.2) * bh;
          s.line(bx, by, bx, by + bh, s.c('--axis'), 0.3);
          s.line(bx, by + bh, bx + bw, by + bh, s.c('--axis'), 0.3);
          const c = s.ctx;
          c.beginPath();
          for (let k = 0; k <= 80; k++) {
            const p = 0.015 + (0.985 * k) / 80;
            if (k) c.lineTo(X(p), Y(-Math.log(p)));
            else c.moveTo(X(p), Y(-Math.log(p)));
          }
          c.strokeStyle = s.c('red');
          c.lineWidth = u * 0.45;
          c.stroke();
          s.text('p of the correct class', bx + bw / 2, by + bh + u * 3, { size: 2.5, font: 'ui', weight: 600, color: s.c('--ink-3') });
          s.text('0', bx, by + bh + u * 3, { size: 2.5, font: 'mono', color: s.c('--ink-3') });
          s.text('1', bx + bw, by + bh + u * 3, { size: 2.5, font: 'mono', color: s.c('--ink-3') });
          s.text('cost', bx + u * 1.5, by - u * 1.8, { size: 2.6, font: 'ui', weight: 650, color: s.c('red'), align: 'left' });
          s.alpha(dip, () => {
            for (let r = 0; r < 3; r++) {
              const i = ROWS[r]!;
              const p = P.probs.d[3 * i + YS[i]!]!;
              s.circle(X(p), Y(-Math.log(p)), u * 1, { fill: s.c(classColor(YS[i]!)), stroke: s.c('--card'), lw: 0.3 });
            }
          });
        });
      // bottom right: the tally
      const tx = Math.max(bx + bw + u * 8, w * 0.55);
      const tw = w - tx - m;
      s.show('log3', gA * s.ease('log3', 0.6, 0.5), { x: (tx + tw / 2) / w, y: (by + u * 29) / h });
      const tA = s.ease('avg', 0.6) * (1 - s.win('start', 'log3', 0.4));
      if (tA > 0)
        s.alpha(tA, () => {
          const line = (label: string, v: string, y: number, k: K, a: number) =>
            s.alpha(a, () => {
              fit(s, label, tx, y, tw * 0.62, { size: 3, font: 'mono', weight: 600, color: s.c(k), align: 'left' });
              s.text(v, tx + tw, y, { size: 3.4, font: 'mono', weight: 650, color: s.c(k), align: 'right' });
            });
          fit(s, 'mean of all 300 rows', tx, by, tw, { size: 2.6, font: 'ui', weight: 600, color: s.c('--ink-3'), align: 'left' });
          const q = s.since('log3') >= 0 ? PASS0 : PASS200;
          line('data_loss', num(q.data_loss, 3), by + u * 6, 'red', 1);
          line('+ reg_loss', num(q.reg_loss, 3), by + u * 12, 'red', s.ease('reg', 0.5, 1));
          s.alpha(s.ease('reg', 0.5, 2), () => s.line(tx, by + u * 15, tx + tw, by + u * 15, s.c('--axis'), 0.3));
          line('= loss', num(q.loss, 3), by + u * 19, 'red', s.ease('reg', 0.5, 2));
          s.slot('loss', s.since('reg') >= 0 && s.at('reg') + 2 < s.t ? num(q.loss, 3).replace('−', '-') : '…');
        });
    });
  },
};

export const scenes1: Record<string, SceneDef> = { intro, data, scores, loss };
