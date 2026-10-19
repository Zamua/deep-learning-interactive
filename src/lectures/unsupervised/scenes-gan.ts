import { fmt } from '../../core/code';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { GAN_COLLAPSE, GAN_OK, type GanRun } from './data';
import { type K, type Rect, Frame, PHOTOS, aeMini, area, box, check, face, fit, gauss, ganMini, juggler, mosaic, pill, slab } from './kit';

/** The real data of the 1-D GAN: two bumps. */
const pdf = (x: number) => 0.5 * gauss(x, -1.6, 0.35) + 0.5 * gauss(x, 1.6, 0.35);

// ---------------------------------------------------------------- the game

const gan: SceneDef = {
  marks: {
    vmm: { tex: String.raw`\min_{\symG}\,\max_{\symD}\; V(\symD, \symG)`, x: 0.5, y: 0.12, size: 5 },
    v1: { tex: String.raw`V = \mathbb{E}_{\symx \sim p_{\text{data}}}\big[\log \symD(\symx)\big]`, x: 0.5, y: 0.27, size: 4.6 },
    v2: { tex: String.raw`+\; \mathbb{E}_{\symz \sim p(\symz)}\big[\log\big(1 - \symD(\symG(\symz))\big)\big]`, x: 0.5, y: 0.43, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // The two players.
    const pA = s.win('game', 'v1');
    if (pA > 0) {
      s.alpha(pA, () => {
        const cy = h * 0.56;
        const bh = Math.min(h * 0.2, u * 17);
        const T = Math.min(w * 0.12, bh * 0.9);
        const zx = w * 0.05;
        const gx = w * 0.15;
        const gw = w * 0.19;
        const fx = gx + gw + u * 6;
        const dx = fx + T + u * 9;
        const dw = w * 0.19;
        const ox = dx + dw + u * 5;
        s.alpha(s.win('game', 'G'), () => fit(s, 'two networks play a game', w / 2, h * 0.14, w * 0.9, { size: 4.6, font: 'display', weight: 600 }));
        const gA = s.ease('G', 0.6);
        s.alpha(Math.max(gA, s.ease('game', 0.6, 1.5) * 0.45), () => {
          for (let i = 0; i < 4; i++) s.cell(zx, cy - u * 8 + i * u * 4, u * 4, u * 3.7, '', 'purple');
          s.text('z', zx + u * 2, cy - u * 11, { size: 4, italic: true, weight: 600, color: s.c('purple') });
          s.arrow(zx + u * 5, cy, gx - u, cy, s.c('--ink-3'), 0.4, 1.8);
          box(s, gx, cy - bh / 2, gw, bh, 'G', 'blue', { sub: 'generator', size: 5 });
          s.arrow(gx + gw + u, cy, fx - u, cy, s.c('--ink-3'), 0.4, 1.8);
          mosaic(s, fx, cy - T / 2, T, 6, PHOTOS[9]!, { frame: 'blue', lw: 0.6 });
          s.text(s.since('clf') >= 0 && s.since('through') < 0 ? 'fake: label 0' : 'fake', fx + T / 2, cy + T / 2 + u * 3.4, { size: 3.3, font: 'ui', weight: 600, color: s.c('blue') });
        });
        const dA = s.ease('D', 0.6);
        s.alpha(Math.max(dA, s.ease('game', 0.6, 1.5) * 0.45), () => {
          const ry = cy - bh / 2 - T - u * 6;
          mosaic(s, fx, ry, T, 6, PHOTOS[1]!, { frame: 'orange', lw: 0.6 });
          s.text(s.since('clf') >= 0 && s.since('through') < 0 ? 'real: label 1' : 'real', fx + T / 2, ry - u * 3, { size: 3.3, font: 'ui', weight: 600, color: s.c('orange') });
          s.arrow(fx + T + u, ry + T / 2, dx - u, cy - bh * 0.25, s.c('--ink-3'), 0.4, 1.8);
          s.arrow(fx + T + u, cy, dx - u, cy, s.c('--ink-3'), 0.4, 1.8);
          box(s, dx, cy - bh / 2, dw, bh, 'D', 'gold', { sub: 'critic', size: 5 });
          s.arrow(dx + dw + u, cy, ox - u, cy, s.c('--ink-3'), 0.4, 1.8);
          // D's verdict alternates between the real and the fake sample.
          const real = Math.floor(s.since('D') / 1.6) % 2 === 0;
          const p = real ? 0.91 : 0.12;
          const gw2 = w - ox - u * 4;
          s.rrect(ox, cy - u * 1.5, gw2, u * 3, 1, { fill: s.tint('--ink', 0.06), stroke: s.tint('--ink', 0.25), lw: 0.25 });
          s.rrect(ox, cy - u * 1.5, gw2 * p, u * 3, 1, { fill: s.tint(real ? 'orange' : 'blue', 0.7) });
          fit(s, `P(real) = ${p.toFixed(2)}`, ox + gw2 / 2, cy + u * 5, gw2 + u * 3, { size: 3.1, font: 'mono', color: s.c('gold') });
        });
        s.alpha(s.win('clf', 'through'), () => {
          fit(s, 'G wins when D gets the fake wrong', w / 2, h * 0.88, w * 0.9, { size: 3.8, font: 'ui', color: s.c('blue') });
        });
        const tA = s.ease('through', 0.6);
        s.alpha(tA, () => {
          const y = cy + bh / 2 + u * 7;
          const p = smooth(s.prog('through') * 1.6);
          const x1 = dx + dw * 0.8;
          const x0 = gx + gw * 0.5;
          const xe = lerp(x1, x0, p);
          s.line(x1, cy + bh / 2 + u, x1, y, s.c('teal'), 0.5, [1.2, 0.8]);
          s.line(x1, y, xe, y, s.c('teal'), 0.5, [1.2, 0.8]);
          if (p > 0.95) s.arrow(x0, y, x0, cy + bh / 2 + u, s.c('teal'), 0.5, 2);
          s.text('gradient, back through D into G', (x0 + x1) / 2, y + u * 4, { size: 3.3, font: 'ui', color: s.c('teal'), halo: true });
        });
      });
    }
    // The value of the game.
    const vA = s.win('v1', 'flat');
    if (vA > 0) {
      const cur = s.since('minmax') >= 0 ? 2 : s.since('v2') >= 0 ? 1 : 0;
      const lit = (i: number) => (cur === 2 || cur === i ? 1 : 0.3);
      s.show('vmm', vA * s.ease('v1', 0.6) * (cur === 2 ? 1 : 0.35));
      s.show('v1', vA * s.ease('v1', 0.6) * lit(0));
      s.show('v2', vA * s.ease('v2', 0.6) * lit(1));
      s.alpha(vA * (1 - s.ease('end', 0.5)), () => {
        s.alpha(s.ease('v1', 0.6, 1.2) * lit(0), () => fit(s, 'high when D calls real data real', w / 2, h * 0.34, w * 0.9, { size: 3.4, font: 'ui', color: s.c('--ink-2') }));
        s.alpha(s.ease('v2', 0.6, 0.6) * lit(1), () => fit(s, 'high when D calls the fakes fake', w / 2, h * 0.51, w * 0.9, { size: 3.4, font: 'ui', color: s.c('--ink-2') }));
        s.alpha(s.ease('minmax', 0.6), () => {
          const y = h * 0.7;
          const bob = Math.sin(s.since('minmax') * 3) * u * 1.2;
          s.arrow(w * 0.3, y + u * 5 - bob, w * 0.3, y - u * 6 - bob, s.c('gold'), 0.7, 2.6);
          s.text('D pushes V up', w * 0.3, y + u * 10, { size: 3.6, font: 'ui', weight: 600, color: s.c('gold') });
          s.arrow(w * 0.7, y - u * 6 + bob, w * 0.7, y + u * 5 + bob, s.c('blue'), 0.7, 2.6);
          s.text('G pushes V down', w * 0.7, y + u * 10, { size: 3.6, font: 'ui', weight: 600, color: s.c('blue') });
        });
      });
      const eA = s.ease('end', 0.6);
      s.alpha(eA * vA, () => {
        const fr = new Frame(s, [w * 0.08, h * 0.6, w * 0.84, h * 0.3], [-3.6, 3.6, -0.05, 1.05]);
        s.line(fr.X(-3.6), fr.Y(0), fr.X(3.6), fr.Y(0), s.c('--axis'), 0.35);
        fr.fn((x) => pdf(x) * 1.6, s.c('orange'), 0.7);
        fr.fn((x) => pdf(x) * 1.6, s.c('blue'), 0.5, -3.6, 3.6, [1.4, 1]);
        fr.fn(() => 0.5, s.c('gold'), 0.6);
        s.text('D = ½', fr.X(3.55), fr.Y(0.5) - u * 2.6, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold'), align: 'right', halo: true });
        fit(s, 'G matches the data: dashed blue on orange', fr.X(0), fr.Y(0) + u * 3.6, w * 0.9, { size: 3.1, font: 'ui', color: s.c('blue') });
      });
    }
    // Why G maximizes log D(G(z)).
    const cA = s.ease('flat', 0.6);
    if (cA > 0) {
      const d = 0.05;
      s.alpha(cA, () => {
        const fr = new Frame(s, area(s, 0.12, 0.06), [-0.04, 1.04, -3.4, 3.4]);
        const [x0, x1, y0, y1] = fr.view;
        for (const v of [0.5, 1]) s.line(fr.X(v), fr.Y(y0), fr.X(v), fr.Y(y1), s.c('--grid'), 0.25);
        s.line(fr.X(x0), fr.Y(0), fr.X(x1), fr.Y(0), s.c('--axis'), 0.35);
        s.line(fr.X(0), fr.Y(y0), fr.X(0), fr.Y(y1), s.c('--axis'), 0.35);
        for (const v of [0.5, 1]) s.text(String(v), fr.X(v), fr.Y(0) + u * 3, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('D(G(z)) →', fr.X(1), fr.Y(0) + u * 7.5, { size: 3.2, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        // The region where G is bad.
        const c = s.ctx;
        c.fillStyle = s.tint('red', 0.08);
        c.fillRect(fr.X(0), fr.Y(y1), fr.X(0.15) - fr.X(0), fr.Y(y0) - fr.Y(y1));
        s.text('fakes look fake', fr.X(0.02), fr.Y(-2.95), { size: 3.1, font: 'ui', color: s.c('red'), align: 'left', halo: true });
        fr.fn((x) => (x > 0.002 && x < 0.998 ? Math.log(1 - x) : NaN), s.c('slate'), 0.75);
        s.text('log(1 − D(G(z)))', fr.X(0.2), fr.Y(-2.1), { size: 3.4, font: 'mono', color: s.c('slate'), align: 'left', halo: true });
        const tangent = (y: number, slope: number, k: K) => {
          const dx = 0.13;
          fr.clip(() => s.line(fr.X(d - dx * 0.4), fr.Y(y - slope * dx * 0.4), fr.X(d + dx), fr.Y(y + slope * dx), s.c(k), 0.45, [1.2, 0.8]));
          fr.dot(d, y, 1.3, s.c(k), true);
        };
        tangent(Math.log(1 - d), -1 / (1 - d), 'slate');
        const nA = s.ease('ns', 0.6);
        s.alpha(nA, () => {
          const reach = lerp(0.999, 0.03, s.ease('ns', 1.6, 0.3));
          fr.fn((x) => (x > 0.03 ? -Math.log(x) : NaN), s.c('blue'), 0.75, reach, 1.04);
          s.text('−log D(G(z))', fr.X(0.2), fr.Y(2.4), { size: 3.4, font: 'mono', color: s.c('blue'), align: 'left', halo: true });
          s.alpha(s.ease('ns', 0.4, 1.9), () => tangent(-Math.log(d), -1 / d, 'blue'));
        });
        s.alpha(s.ease('slopes', 0.6), () => {
          s.text('slope ≈ −1', fr.X(0.25), fr.Y(-1.05), { size: 3.6, font: 'mono', weight: 650, color: s.c('slate'), align: 'left', halo: true });
          s.text('slope = −20', fr.X(0.5), fr.Y(1.35), { size: 3.6, font: 'mono', weight: 650, color: s.c('blue'), align: 'left', halo: true });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- a 1-D GAN

/** One run's snapshot at a fractional step: histogram, D curve, G map and smoothed losses. */
function ganAt(run: GanRun, step: number) {
  const n = run.hist.length - 1;
  const f = clamp01(step / (run.every * n)) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const t = f - i;
  const mix = (a: number[][]) => a[i]!.map((v, k) => lerp(v, a[i + 1]![k]!, t));
  const num = (a: number[]) => (Number.isFinite(a[i]!) ? lerp(a[i]!, a[i + 1]!, t) : a[i + 1]!);
  return { hist: mix(run.hist), d: mix(run.d), g: mix(run.g), ld: num(run.ld), lg: num(run.lg) };
}

/** Piecewise-linear step over beat starts: `marks` are [beat, step] pairs. */
function stepOver(s: Scene, marks: [string, number][]): number {
  let v = marks[0]![1];
  for (let k = 0; k + 1 < marks.length; k++) {
    const [a, va] = marks[k]!;
    const [b, vb] = marks[k + 1]!;
    if (s.since(a) >= 0) v = lerp(va, vb, s.span(a, b));
  }
  return v;
}

const ganLive: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const collapse = s.since('reseed') >= 0;
    const run = collapse ? GAN_COLLAPSE : GAN_OK;
    const step = collapse
      ? stepOver(s, [
          ['reseed', 0],
          ['collapse', 500],
          ['recover', 1200],
          ['hard', 2000],
        ])
      : stepOver(s, [
          ['alt', 0],
          ['dmove', 100],
          ['gmove', 400],
          ['jump', 900],
          ['done', 4000],
        ]);
    const st = ganAt(run, step);
    const shownStep = Math.round(step);
    s.slot('step', shownStep);
    s.slot('ld', Number.isFinite(st.ld) && shownStep > 0 ? fmt(st.ld, 3) : '…');
    s.slot('lg', Number.isFinite(st.lg) && shownStep > 0 ? fmt(st.lg, 3) : '…');
    const mainR: Rect = [w * 0.06, h * 0.1, w * 0.88, h * 0.58];
    const lowR: Rect = [w * 0.06, h * 0.78, w * 0.88, h * 0.18];
    const fr = new Frame(s, mainR, [-4, 4, -0.06, 1.12]);
    const netsA = s.ease('nets', 0.6);
    const swap = collapse ? s.ease('reseed', 0.5) : 1;
    // Main plot.
    for (const v of [-4, -2, 0, 2, 4]) s.line(fr.X(v), fr.Y(-0.06), fr.X(v), fr.Y(1.12), s.c('--grid'), 0.25);
    s.line(fr.X(-4), fr.Y(0), fr.X(4), fr.Y(0), s.c('--axis'), 0.35);
    for (const v of [-4, -2, 0, 2, 4]) s.text(String(v), fr.X(v), fr.Y(0) + u * 3, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
    s.alpha(netsA * swap, () => {
      const bw = 8 / 48;
      st.hist.forEach((cnt, b) => {
        const hgt = Math.min(1.1, cnt / (3000 * bw));
        if (hgt < 0.003) return;
        s.rrect(fr.X(-4 + b * bw) + 0.5, fr.Y(hgt), fr.kx * bw - 1, fr.Y(0) - fr.Y(hgt), 0.2, { fill: s.tint('blue', 0.45) });
      });
    });
    fr.fn(pdf, s.c('orange'), 0.7);
    s.alpha(netsA * swap, () => {
      s.line(fr.X(-4), fr.Y(0.5), fr.X(4), fr.Y(0.5), s.tint('gold', 0.5), 0.3, [1, 1]);
      fr.path(
        st.d.map((_, i) => -4 + (8 * i) / (st.d.length - 1)),
        st.d,
        s.c('gold'),
        0.7,
      );
    });
    const legend: [string, K, number][] = [
      ['real data', 'orange', 1],
      ['G(z) samples', 'blue', netsA],
      ['D(x)', 'gold', netsA],
    ];
    legend.forEach(([name, k, a], i) => {
      s.alpha(a, () => {
        const y = fr.Y(1.08) + i * u * 4.4;
        s.rrect(fr.X(-3.9), y - u * 0.9, u * 3, u * 1.8, 0.4, { fill: s.c(k) });
        s.text(name, fr.X(-3.9) + u * 4, y, { size: 3.2, font: 'ui', color: s.c('--ink-2'), align: 'left', halo: true });
      });
    });
    s.text(`step ${shownStep}`, fr.X(3.9), fr.Y(1.08), { size: 3.3, font: 'mono', color: s.c('--ink-2'), align: 'right', halo: true });
    s.alpha(s.ease('reseed', 0.5), () => pill(s, 'another seed', fr.X(3.9), fr.Y(1.08) + u * 5.4, 'red', { size: 3, align: 'right' }));
    // Mode collapse: one bump left empty.
    s.alpha(s.win('collapse', 'recover'), () => {
      const right = st.hist.slice(30).reduce((a, b) => a + b, 0) / 3000;
      if (right < 0.15) {
        s.rrect(fr.X(0.7), fr.Y(0.78), fr.X(2.5) - fr.X(0.7), fr.Y(0) - fr.Y(0.78), 1.2, { stroke: s.c('red'), lw: 0.45 });
        s.text('no samples here', fr.X(1.6), fr.Y(0.7), { size: 3.2, font: 'ui', weight: 600, color: s.c('red'), halo: true });
      }
    });
    // D up where fakes are few, down where they pile up.
    s.alpha(s.win('dmove', 'gmove'), () => {
      s.text('D high: too few fakes', fr.X(1.6), fr.Y(0.98), { size: 3.1, font: 'ui', color: s.c('gold'), halo: true });
    });
    s.alpha(s.win('done', 'reseed'), () => check(s, fr.X(3.6), fr.Y(0.6), u * 2.2));
    s.alpha(s.ease('hard', 0.6, 2), () => fit(s, 'judge by the samples, not the loss', fr.X(0), fr.Y(0.7), w * 0.5, { size: 3.4, font: 'ui', weight: 600, color: s.c('--accent'), halo: true }));
    // G itself.
    const lA = s.ease('nets', 0.6, 0.6);
    s.alpha(lA, () => {
      const fg = new Frame(s, lowR, [-3, 3, -4.2, 4.2]);
      s.rrect(lowR[0], lowR[1], lowR[2], lowR[3], 1, { fill: s.tint('--ink', 0.02), stroke: s.tint('--ink', 0.12), lw: 0.25 });
      s.line(fg.X(-3), fg.Y(0), fg.X(3), fg.Y(0), s.c('--axis'), 0.3);
      s.line(fg.X(0), fg.Y(-4.2), fg.X(0), fg.Y(4.2), s.c('--axis'), 0.3);
      s.alpha(swap, () =>
        fg.clip(() =>
          fg.path(
            st.g.map((_, i) => -3 + (6 * i) / (st.g.length - 1)),
            st.g,
            s.c('blue'),
            0.65,
          ),
        ),
      );
      s.text('the generator: x = G(z), z from −3 to 3', lowR[0], lowR[1] - u * 2.2, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'left' });
      s.alpha(s.win('jump', 'done'), () => {
        s.circle(fg.X(0), fg.Y(0), u * 4.5, { stroke: s.c('teal'), lw: 0.5 });
        s.text('a steep jump', fg.X(0) + u * 6, fg.Y(-2.4), { size: 3.2, font: 'ui', weight: 600, color: s.c('teal'), align: 'left', halo: true });
      });
    });
  },
};

// ---------------------------------------------------------------- DCGAN

/** A made-up bedroom, as a color function on the unit square. */
function bedroom(v: number, x: number): [number, number, number] {
  if (v > 0.68) return x > 0.15 && x < 0.75 && v < 0.85 ? [230, 230, 240] : [150, 115, 85];
  if (x > 0.58 && x < 0.86 && v > 0.14 && v < 0.42) return [160, 200, 230];
  if (v > 0.46 && x > 0.12 && x < 0.8) return v < 0.56 ? [235, 235, 238] : [70, 95, 150];
  return [205, 185, 160];
}

/** The pyramid picture: sky, a sun, hills. */
function scenery(v: number, x: number): [number, number, number] {
  if ((x - 0.7) ** 2 + (v - 0.28) ** 2 < 0.02) return [250, 200, 70];
  const hill = 0.62 + 0.12 * Math.sin(x * 6);
  if (v > hill) return [lerp(90, 50, v), lerp(160, 110, v), 70];
  return [lerp(110, 180, v), lerp(160, 210, v), 235];
}

function room(s: Scene, x: number, y: number, sz: number, t: number): void {
  s.rrect(x, y, sz, sz, 0.6, { fill: 'rgb(214,196,170)', stroke: s.c('--rule'), lw: 0.3 });
  s.ctx.fillStyle = 'rgb(150,115,85)';
  s.ctx.fillRect(x, y + sz * 0.78, sz, sz * 0.22);
  const ow = sz * lerp(0.42, 0.56, t);
  const oh = sz * lerp(0.3, 0.46, t);
  const ox = x + sz / 2 - ow / 2;
  const oy = y + sz * lerp(0.36, 0.14, t);
  const col = [lerp(45, 165, t), lerp(45, 205, t), lerp(50, 235, t)];
  s.rrect(ox, oy, ow, oh, 0.4, { fill: `rgb(${col.map((c) => c | 0).join(',')})`, stroke: `rgba(250,250,250,${t})`, lw: 0.6 * t + 0.2 });
  s.alpha(t, () => {
    s.line(ox + ow / 2, oy, ox + ow / 2, oy + oh, 'rgb(250,250,250)', 0.35);
    s.line(ox, oy + oh / 2, ox + ow, oy + oh / 2, 'rgb(250,250,250)', 0.35);
  });
  s.alpha(1 - t, () => {
    s.rrect(x + sz * 0.3, oy + oh + sz * 0.02, sz * 0.4, sz * 0.12, 0.3, { fill: 'rgb(110,80,60)' });
  });
}

const dcgan: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // The generator's shape.
    const aA = s.win('fragile', 'walk');
    if (aA > 0) {
      s.alpha(aA, () => {
        const sizes = [4, 8, 16, 32];
        const chans = [1024, 512, 256, 128];
        const B = Math.min((w * 0.86) / 46, h * 0.026);
        const cy = h * 0.36;
        const gap = u * 3.2;
        let x = w * 0.05;
        const zh = B * 9;
        s.rrect(x, cy - zh / 2, B * 1.4, zh, 0.4, { fill: s.tint('purple', 0.25), stroke: s.c('purple'), lw: 0.35 });
        const labels: [number, string][] = [[x + B * 0.7, 'z: 100']];
        x += B * 1.4 + gap;
        sizes.forEach((sz, i) => {
          const side = B * Math.sqrt(sz);
          const d = (B * Math.sqrt(chans[i]!)) / 4;
          const a = s.ease('fragile', 0.4, 0.5 + i * 0.3);
          const sx = x;
          s.alpha(a, () => {
            s.arrow(sx - gap + u * 0.4, cy, sx - u * 0.4, cy, s.c('--ink-3'), 0.3, 1.2);
          });
          const lx = x + (side + d * 0.7) / 2;
          slab(s, x, cy - side / 2 + d * 0.25, side, side, d, 'teal', a);
          labels.push([lx, `${sz}×${sz}×${chans[i]}`]);
          x += side + d * 0.7 + gap;
        });
        const img = B * 8;
        s.alpha(s.ease('fragile', 0.4, 1.8), () => {
          s.arrow(x - gap + u * 0.4, cy, x - u * 0.4, cy, s.c('--ink-3'), 0.3, 1.2);
          mosaic(s, x, cy - img / 2, img, 12, (i, j) => bedroom(i / 11, j / 11), { frame: 'blue', lw: 0.5 });
        });
        labels.push([x + img / 2, '64×64×3']);
        const ly = cy + img / 2 + u * 6;
        labels.forEach(([lx, t], i) => {
          const a = i === 0 ? s.ease('fragile', 0.4, 0.3) : s.ease('fragile', 0.4, 0.5 + (i - 1) * 0.3);
          s.alpha(a, () => s.text(t, lx, ly + (i % 2) * u * 4, { size: 2.9, font: 'mono', color: s.c('--ink-2') }));
        });
        s.text('the DCGAN generator', w / 2, h * 0.11, { size: 4.2, font: 'display', weight: 600 });
        // The rules, as chips that wrap.
        const chips: [string, K, string][] = [
          ['no pooling', 'teal', 'rules'],
          ['batch norm in both', 'teal', 'rules'],
          ['no FC hidden layers', 'teal', 'rules'],
          ['G: ReLU, tanh out', 'blue', 'acts'],
          ['D: leaky ReLU', 'gold', 'acts'],
        ];
        const chipA = 1 - s.ease('results', 0.5);
        const size = 3.2;
        const ph = u * size * 1.7;
        let row: { t: string; k: K; b: string; i: number; pw: number }[] = [];
        const rows: (typeof row)[] = [];
        let rw = 0;
        chips.forEach(([t, k, b], i) => {
          const pw = s.measure(t, { font: 'ui', size, weight: 600 }) + u * size * 0.95;
          if (rw + pw + u * 2 > w * 0.92 && row.length) {
            rows.push(row);
            row = [];
            rw = 0;
          }
          row.push({ t, k, b, i, pw });
          rw += pw + u * 2;
        });
        rows.push(row);
        rows.forEach((r, ri) => {
          const tot = r.reduce((a, c) => a + c.pw, 0) + u * 2 * (r.length - 1);
          let cx = w / 2 - tot / 2;
          const y = h * 0.66 + ri * (ph + u * 2.4);
          r.forEach((c) => {
            const within = chips.filter(([, , b]) => b === c.b).findIndex(([t]) => t === c.t);
            s.alpha(chipA * s.ease(c.b, 0.4, 0.3 + within * 1.4), () => pill(s, c.t, cx, y, c.k, { size, font: 'ui', align: 'left' }));
            cx += c.pw + u * 2;
          });
        });
        const rA = s.ease('results', 0.6);
        s.alpha(rA, () => {
          const T = Math.min(w * 0.17, h * 0.2);
          const n = 4;
          const g = (w - n * T) / (n + 1);
          const y = h * 0.62;
          for (let i = 0; i < n; i++) {
            const x0 = g + i * (T + g);
            if (i < 2) mosaic(s, x0, y, T, 12, (a, b) => bedroom(a / 11, ((i ? 11 - b : b) / 11) * 0.9 + 0.05), { frame: 'blue', lw: 0.5 });
            else {
              s.rrect(x0, y, T, T, 0.6, { fill: 'rgb(200,205,215)', stroke: s.c('blue'), lw: 0.5 });
              face(s, x0 + T / 2, y + T * 0.52, T * 0.36, { smile: i === 2 ? 0.6 : 0.1, hair: i === 2 ? 0.8 : 0.2, tone: i === 2 ? 0.3 : 0.6, blur: 0.6 });
            }
          }
          s.text('64 × 64 bedrooms and faces (stand-ins)', w / 2, y + T + u * 4.5, { size: 3.3, font: 'ui', color: s.c('--ink-3') });
        });
      });
    }
    // Walking between two codes.
    const wA = s.win('walk', 'arith');
    if (wA > 0) {
      s.alpha(wA, () => {
        const n = 6;
        const g = u * 1.6;
        const sz = Math.min((w * 0.9 - g * (n - 1)) / n, h * 0.3);
        const x0 = (w - n * sz - (n - 1) * g) / 2;
        const y = h * 0.34;
        for (let i = 0; i < n; i++) {
          const a = s.ease('walk', 0.4, 1 + i * 0.3);
          s.alpha(a, () => room(s, x0 + i * (sz + g), y, sz, i / (n - 1)));
        }
        s.arrow(x0, y + sz + u * 5, x0 + n * sz + (n - 1) * g, y + sz + u * 5, s.c('purple'), 0.45, 2.2);
        s.text('z₁', x0 + sz / 2, y + sz + u * 9, { size: 3.8, italic: true, weight: 600, color: s.c('purple') });
        s.text('z₂', x0 + (n - 0.5) * sz + (n - 1) * g, y + sz + u * 9, { size: 3.8, italic: true, weight: 600, color: s.c('purple') });
        s.text('TV', x0 + sz / 2, y - u * 3.4, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        s.text('window', x0 + (n - 0.5) * sz + (n - 1) * g, y - u * 3.4, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        s.text('a straight line between two codes', w / 2, h * 0.14, { size: 4, font: 'display', weight: 600 });
      });
    }
    // Arithmetic on faces.
    const fA = s.win('arith', 'hybrids');
    if (fA > 0) {
      s.alpha(fA, () => {
        const rowEq = (y: number, faces: { smile: number; hair: number; glasses: number; label: string }[], ops: string[], appear: (i: number) => number) => {
          const slot = (w * 0.94) / 4;
          const r = Math.min(slot * 0.28, h * 0.1);
          faces.forEach((f, i) => {
            const cx = w * 0.03 + slot * (i + 0.5);
            s.alpha(appear(i), () => {
              face(s, cx, y, r, { smile: f.smile, hair: f.hair, glasses: f.glasses, tone: 0.4 });
              fit(s, f.label, cx, y + r * 1.25 + u * 2.6, slot * 0.96, { size: 3.1, font: 'ui', color: s.c('--ink-2') });
              if (i > 0) s.text(ops[i - 1]!, cx - slot / 2, y, { size: 6, font: 'mono', weight: 600, color: s.c(i === 3 ? 'purple' : '--ink-2') });
            });
          });
        };
        const W1 = { smile: 1, hair: 0.95, glasses: 0 };
        rowEq(
          h * 0.3,
          [
            { ...W1, label: 'smiling woman' },
            { smile: 0, hair: 0.95, glasses: 0, label: 'neutral woman' },
            { smile: 0, hair: 0.05, glasses: 0, label: 'neutral man' },
            { smile: 1, hair: 0.05, glasses: 0, label: 'smiling man' },
          ],
          ['−', '+', '='],
          (i) => (i < 3 ? s.ease('arith', 0.5, 0.3 + i * 1.3) : s.ease('men', 0.6)),
        );
        s.alpha(s.ease('glasses', 0.6), () =>
          rowEq(
            h * 0.7,
            [
              { smile: 0.3, hair: 0.05, glasses: 1, label: 'man, glasses' },
              { smile: 0.3, hair: 0.05, glasses: 0, label: 'man' },
              { smile: 0.3, hair: 0.95, glasses: 0, label: 'woman' },
              { smile: 0.3, hair: 0.95, glasses: 1, label: 'woman, glasses' },
            ],
            ['−', '+', '='],
            (i) => s.ease('glasses', 0.5, 0.2 + i * 0.8),
          ),
        );
        s.alpha(1 - s.ease('glasses', 0.5), () => fit(s, 'average codes, then add and subtract', w / 2, h * 0.68, w * 0.9, { size: 3.8, font: 'ui', color: s.c('--ink-3') }));
      });
    }
    // LAPGAN and VAE-GAN hybrids.
    const hA = s.ease('hybrids', 0.6);
    if (hA > 0) {
      s.alpha(hA, () => {
        const T = Math.min(w * 0.18, h * 0.22);
        const y1 = h * 0.18;
        const res = [4, 8, 16];
        const g = (w * 0.9 - 3 * T) / 2;
        s.text('LAPGAN: coarse to fine', w * 0.05, y1 - u * 3.6, { size: 3.6, font: 'ui', weight: 600, align: 'left' });
        res.forEach((n, i) => {
          const x = w * 0.05 + i * (T + g);
          s.alpha(s.ease('hybrids', 0.4, 0.4 + i * 0.5), () => {
            mosaic(s, x, y1, T, n, (a, b) => scenery((a + 0.5) / n, (b + 0.5) / n));
            s.text(`${n}×${n}`, x + T / 2, y1 + T + u * 3.4, { size: 3, font: 'mono', color: s.c('--ink-3') });
            if (i > 0) s.arrow(x - g + u * 1.5, y1 + T / 2, x - u * 1.5, y1 + T / 2, s.c('--ink-3'), 0.4, 1.8);
          });
        });
        const y2 = h * 0.66;
        s.alpha(s.ease('hybrids', 0.5, 3.4), () => {
          s.text('VAE + a GAN critic: sharper', w * 0.05, y2 - T / 2 - u * 4, { size: 3.6, font: 'ui', weight: 600, align: 'left' });
          const bw = w * 0.2;
          box(s, w * 0.05, y2 - u * 5, bw, u * 10, 'VAE', 'purple', { size: 3.8 });
          s.arrow(w * 0.05 + bw + u, y2, w * 0.05 + bw + u * 6, y2, s.c('--ink-3'), 0.4, 1.8);
          const ix = w * 0.05 + bw + u * 7;
          const c = s.ctx;
          c.save();
          c.filter = `blur(${Math.max(1, T / 30)}px)`;
          face(s, ix + T * 0.45, y2, T * 0.38, { smile: 0.5, hair: 0.6, tone: 0.4 });
          c.restore();
          s.arrow(ix + T + u, y2, ix + T + u * 6, y2, s.c('--ink-3'), 0.4, 1.8);
          box(s, ix + T + u * 7, y2 - u * 5, w * 0.14, u * 10, 'D', 'gold', { size: 3.8 });
          const fx = ix + T + u * 9 + w * 0.14;
          s.arrow(fx - u, y2, fx + u * 3, y2, s.c('--ink-3'), 0.4, 1.8);
          face(s, Math.min(w - T * 0.45 - u * 4, fx + u * 4 + T * 0.4), y2, T * 0.38, { smile: 0.5, hair: 0.6, tone: 0.4 });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- recap

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const beats = ['video', 'ae', 'vae', 'gan'];
    const titles = ['video', 'autoencoder', 'VAE', 'GAN'];
    const fade = 1 - s.ease('next', 0.6, 0.3);
    const cw = w * 0.43;
    const ch = h * 0.36;
    const gx = (w - 2 * cw) / 3;
    beats.forEach((b, i) => {
      const a = s.ease(b, 0.6);
      if (a <= 0) return;
      const x = gx + (i % 2) * (cw + gx);
      const y = h * 0.12 + Math.floor(i / 2) * (ch + u * 4);
      s.alpha(a * fade, () => {
        s.rrect(x, y, cw, ch, 2.4, { fill: s.tint('--ink', 0.03), stroke: s.tint('--ink', 0.18), lw: 0.35 });
        fit(s, titles[i]!, x + cw / 2, y + u * 5, cw * 0.7, { size: 4, font: 'display', weight: 600 });
        const inner: Rect = [x + cw * 0.08, y + u * 9, cw * 0.84, ch - u * 12];
        if (i === 0) {
          const n = 3;
          const fw = Math.min((inner[2] - u * 4) / n, inner[3] / 0.72);
          for (let k = 0; k < n; k++) juggler(s, inner[0] + k * (fw + u * 2), inner[1] + (inner[3] - fw * 0.72) / 2, fw, fw * 0.72, k * 2, 6);
        } else if (i < 3) aeMini(s, inner, i === 2);
        else ganMini(s, inner);
        s.alpha(s.ease(b, 0.4, 1.2), () => check(s, x + cw - u * 3.4, y + u * 3.4, u * 2));
      });
    });
    const nA = s.ease('next', 0.7, 0.4);
    s.alpha(nA, () => {
      fit(s, 'no labels needed', w / 2, h * 0.4, w * 0.9, { size: 6, font: 'display', weight: 600 });
      fit(s, 'all three models learn the shape of the data itself', w / 2, h * 0.5, w * 0.9, { size: 3.8, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('dl26', 0.6), () => {
        fit(s, 'then DL26: contrastive learning, diffusion', w / 2, h * 0.64, w * 0.9, { size: 4.4, font: 'display', color: s.c('--accent') });
      });
    });
  },
};

export const ganScenes: Record<string, SceneDef> = { gan, 'gan-live': ganLive, dcgan, outro };
