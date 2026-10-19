import { fmt } from '../../core/code';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { type K, pill, playIcon, pointer, sliderIcon, spans } from './kit';

/** Seconds into the scene at which a fraction `f` of beat `id` has been spoken. */
const at = (s: Scene, id: string, f = 0): number => lerp(s.at(id), s.end(id), f);
/** Eased 0 -> 1 starting a fraction `f` into beat `id`. */
const easeAt = (s: Scene, id: string, f: number, dur = 0.6): number => (s.since(id) >= 0 ? smooth((s.t - at(s, id, f)) / dur) : 0);

// ---------------------------------------------------------------- layers

const LAYERS: { title: string; sub: string; teach: string; k: K; beat: string }[] = [
  { title: 'Watch', sub: 'the lecture: sit back', teach: 'builds the intuition', k: 'blue', beat: 'watch' },
  { title: 'Explore', sub: 'the chapter: every figure live', teach: 'makes it solid', k: 'orange', beat: 'explore' },
  { title: 'Practice', sub: 'the assignment: your own code', teach: 'really teaches', k: 'green', beat: 'practice' },
];

export const layers: SceneDef = {
  draw(s) {
    const { w, u, t } = s;
    const bw = Math.min(w - u * 12, u * 104);
    const bx = w / 2 - bw / 2;
    const rh = u * 24;
    const gap = u * 4;
    const y0 = u * 13;
    const teach = s.since('teach') >= 0;
    const tp = s.prog('teach');
    LAYERS.forEach((L, i) => {
      const a = s.ease('three', 0.6, 0.6 + 0.5 * i);
      if (a <= 0) return;
      const y = y0 + i * (rh + gap) + (1 - a) * u * 3;
      const own = s.since(L.beat) >= 0 && (i === 2 ? !teach : s.since(LAYERS[i + 1]!.beat) < 0);
      const on = own || (teach && tp >= i * 0.3) ? 1 : 0;
      s.alpha(a, () => {
        s.rrect(bx, y, bw, rh, 2.6, { fill: s.tint(L.k, 0.04 + 0.08 * on), stroke: s.tint(L.k, 0.3 + 0.6 * on), lw: 0.3 + 0.25 * on });
        s.circle(bx + u * 6.5, y + rh / 2, u * 3.2, { fill: s.tint(L.k, on ? 0.9 : 0.25) });
        s.text(String(i + 1), bx + u * 6.5, y + rh / 2 + u * 0.2, { size: 3.4, font: 'ui', weight: 700, color: on ? '#fff' : s.c(L.k) });
        const ix = bx + u * 23;
        const iy = y + rh / 2;
        if (i === 0) {
          playIcon(s, ix, iy - u * 2, u * 6.5, L.k);
          const pr = own ? (s.since(L.beat) * 0.12) % 1 : 0.3;
          s.line(ix - u * 8, iy + u * 7.5, ix + u * 8, iy + u * 7.5, s.tint('--ink', 0.18), 0.6);
          s.line(ix - u * 8, iy + u * 7.5, ix - u * 8 + u * 16 * pr, iy + u * 7.5, s.c(L.k), 0.6);
        } else if (i === 1) {
          const v = own ? 0.5 + 0.4 * Math.sin(s.since(L.beat) * 2.2) : 0.35;
          sliderIcon(s, ix - u * 9, iy - u * 5, u * 18, v, L.k);
          for (let j = 0; j < 3; j++) {
            const lit = own && j === 1;
            s.rrect(ix - u * 9, iy + j * u * 3.4 - u * 0.6, u * (j === 1 ? 15 : 11 - j * 2), u * 1.8, 0.6, { fill: lit ? s.tint('--accent', 0.6) : s.tint('--ink', 0.16) });
          }
        } else {
          s.rrect(ix - u * 8, iy - u * 9, u * 16, u * 18, 1.2, { fill: s.c('--card'), stroke: s.tint(L.k, 0.7), lw: 0.35 });
          const typed = own ? clamp01(s.since(L.beat) / 4) : 0.45;
          const lens = [11, 8, 12, 6];
          lens.forEach((n, j) => {
            const f = clamp01(typed * 4 - j);
            if (f > 0) s.line(ix - u * 5.5, iy - u * 5.4 + j * u * 3.6, ix - u * 5.5 + u * n * f, iy - u * 5.4 + j * u * 3.6, s.tint(L.k, 0.75), 0.55);
          });
          if (own && Math.sin(t * 8) > 0) {
            const j = Math.min(3, Math.floor(typed * 4));
            const f = clamp01(typed * 4 - j);
            const cx = ix - u * 5.5 + u * lens[j]! * f + u * 0.8;
            s.line(cx, iy - u * 6.6 + j * u * 3.6, cx, iy - u * 4.2 + j * u * 3.6, s.c('--ink'), 0.3);
          }
        }
        const tx = bx + u * 36;
        s.text(L.title, tx, y + u * 8.6, { size: 5.6, font: 'display', weight: 600, align: 'left', color: s.c(on ? L.k : '--ink') });
        // Row 1 swaps its subtitle for the two gestures while they are named.
        const gest = i === 0 ? s.win('lunch', 'explore', 0.5) : 0;
        const tAlpha = teach ? clamp01((tp - i * 0.3) * 6) : 0;
        s.alpha((1 - gest) * (1 - tAlpha), () => s.text(L.sub, tx, y + u * 16.4, { size: 3.4, italic: true, align: 'left', color: s.c('--ink-2') }));
        s.alpha(tAlpha, () => s.text(L.teach, tx, y + u * 16.4, { size: 3.6, italic: true, weight: 600, align: 'left', color: s.c(L.k) }));
        s.alpha(gest, () => {
          const pw = pill(s, 'tap: pause', tx, y + u * 16.4, L.k, { size: 2.9, align: 'left' });
          pill(s, 'hold: 2×', tx + pw + u * 2, y + u * 16.4, L.k, { size: 2.9, align: 'left' });
        });
      });
    });
  },
};

// ---------------------------------------------------------------- figures

/** The chapter's 8 x 8 smiley, values 0..255. */
const SMILEY = [
  [20, 20, 60, 90, 90, 60, 20, 20],
  [20, 80, 140, 140, 140, 140, 80, 20],
  [60, 140, 30, 140, 140, 30, 140, 60],
  [90, 140, 140, 140, 140, 140, 140, 90],
  [90, 140, 30, 140, 140, 30, 140, 90],
  [60, 140, 140, 30, 30, 140, 140, 60],
  [20, 80, 140, 140, 140, 140, 80, 20],
  [20, 20, 60, 90, 90, 60, 20, 20],
];
const meanAt = (g: number): number => SMILEY.flat().reduce((a, v) => a + Math.min(255, v * g), 0) / 64;

/** A miniature screen: a figure box and a code box, side by side (m = 0) or stacked (m = 1). */
function miniScreen(s: Scene, cx: number, cy: number, m: number, t: number): void {
  const { u } = s;
  const fw = lerp(u * 76, u * 34, m);
  const fh = lerp(u * 46, u * 62, m);
  const x = cx - fw / 2;
  const y = cy - fh / 2;
  s.rrect(x, y, fw, fh, lerp(2.4, 4, m), { fill: s.tint('--ink', 0.03), stroke: s.tint('--ink', 0.45), lw: 0.45 });
  const pad = u * 3;
  const figW = lerp(fw * 0.56, fw - 2 * pad, m);
  const figH = lerp(fh - 2 * pad, fh * 0.4, m);
  const codeX = lerp(x + pad + figW + u * 2.5, x + pad, m);
  const codeY = lerp(y + pad, y + pad + figH + u * 3, m);
  const codeW = lerp(fw - figW - 2 * pad - u * 2.5, figW, m);
  const codeH = lerp(fh - 2 * pad, fh - figH - 2 * pad - u * 3, m);
  // The figure: three bars that breathe.
  s.rrect(x + pad, y + pad, figW, figH, 1.4, { fill: s.c('--card'), stroke: s.tint('--ink', 0.25), lw: 0.3 });
  [0.55, 0.85, 0.4].forEach((v, i) => {
    const bh = figH * 0.7 * (v + 0.08 * Math.sin(t * 1.4 + i));
    const bwid = figW * 0.16;
    s.rrect(x + pad + figW * (0.2 + i * 0.24), y + pad + figH * 0.86 - bh, bwid, bh, 0.5, { fill: s.tint(i === 1 ? 'purple' : 'blue', 0.6) });
  });
  // The code: lines, one lit.
  s.rrect(codeX, codeY, codeW, codeH, 1.4, { fill: s.tint('--accent', 0.05), stroke: s.tint('--ink', 0.25), lw: 0.3 });
  const n = 5;
  const lit = Math.floor(t * 0.8) % n;
  for (let j = 0; j < n; j++) {
    const ly = codeY + u * 2.4 + j * Math.min(u * 3.4, (codeH - u * 3) / n);
    if (j === lit) s.rrect(codeX + u * 0.6, ly - u * 1.2, codeW - u * 1.2, u * 2.4, 0.5, { fill: s.tint('--accent', 0.22) });
    s.line(codeX + u * 2, ly, codeX + u * 2 + (codeW - u * 4) * [0.8, 0.55, 0.7, 0.45, 0.6][j]!, ly, s.tint(j === lit ? '--accent' : '--ink', 0.45), 0.55);
  }
}

export const figures: SceneDef = {
  draw(s) {
    const { w, u, t } = s;
    // The promise: a picture always travels with its code.
    const pA = s.win('promise', 'real');
    s.alpha(pA, () => {
      const m = easeAt(s, 'beside', 0.45, 1.2);
      miniScreen(s, w / 2, u * 46, m, t);
      const b = s.ease('beside', 0.5);
      s.alpha(1 - b, () => s.text('every picture comes with its code', w / 2, u * 86, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      s.alpha(b * (1 - smooth((m - 0.3) / 0.2)), () => s.text('wide screen: side by side', w / 2, u * 86, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      s.alpha(smooth((m - 0.5) / 0.2), () => s.text('phone: code underneath', w / 2, u * 86, { size: 3.6, italic: true, color: s.c('--ink-2') }));
    });

    // The brightening, step by step.
    const scaleIn = easeAt(s, 'lit', 0.45, 0.9);
    const drag = s.since('live') >= 0 ? smooth((s.t - at(s, 'live', 0.12)) / Math.max(0.5, (s.end('live') - s.at('live')) * 0.6)) : 0;
    const gainRaw = lerp(1.5, 2.5, drag);
    const gain = Math.round(gainRaw * 10) / 10;
    const clipIn = easeAt(s, 'clip', 0.35, 0.8);
    const step = s.since('mean') >= 0 ? 3 : s.since('clip') >= 0 ? 2 : s.since('lit') >= 0 ? 1 : 0;
    s.slot('gain', fmt(gain, 2));
    s.slot('mean', fmt(meanAt(gain), 4));
    const gA = s.ease('real', 0.7, 0.3);
    if (gA <= 0) return;

    const G = Math.min(u * 76, w * 0.62);
    const gx = u * 6;
    const gy = u * 50 - G / 2 + u * 2;
    const cs = G / 8;
    const fs = Math.min(3.2, (cs / u) * 0.34);
    s.alpha(gA, () => {
      s.text('img', gx + G / 2, gy - u * 3.4, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange') });
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
          const v0 = SMILEY[r]![c]!;
          const scaled = lerp(v0, v0 * gain, scaleIn);
          const v = lerp(scaled, Math.min(255, scaled), clipIn);
          const g = Math.round(Math.max(0, Math.min(255, v)));
          s.ctx.fillStyle = `rgb(${g},${g},${g})`;
          s.ctx.fillRect(gx + c * cs, gy + r * cs, cs + 0.5, cs + 0.5);
          const bad = v > 255.5;
          if (bad) s.rrect(gx + c * cs + u * 0.5, gy + r * cs + u * 0.5, cs - u, cs - u, 0.4, { stroke: s.c('red'), lw: 0.45 });
          s.alpha(s.ease('pixels', 0.6, 0.6), () =>
            s.text(String(Math.round(v)), gx + c * cs + cs / 2, gy + r * cs + cs / 2 + u * 0.2, { size: fs, font: 'mono', weight: bad ? 700 : 500, color: bad ? s.c('red') : g > 120 ? '#1a1a1a' : '#f2f2f2' }),
          );
        }
      s.rrect(gx, gy, G, G, 0.4, { stroke: s.c('orange'), lw: 0.45 });
    });

    // Side panel: the running line, the slider and the mean.
    const px = gx + G + u * 5;
    const pw = w - u * 5 - px;
    const pcx = px + pw / 2;
    s.alpha(gA, () => {
      const labels = ['line 1: load', 'line 3: × gain', 'line 4: clip', 'line 5: mean'];
      const lA = s.ease('lit', 0.5, 0.2);
      s.alpha(lA, () => pill(s, labels[step]!, pcx, gy + u * 3, '--accent', { size: 2.9, fill: 0.14 }));
      // 0 is black, 255 is white.
      s.alpha(s.win('pixels', 'live'), () => {
        const by = gy + u * 14;
        const grd = s.ctx.createLinearGradient(px, 0, px + pw, 0);
        grd.addColorStop(0, '#000');
        grd.addColorStop(1, '#fff');
        s.ctx.fillStyle = grd;
        s.ctx.fillRect(px, by, pw, u * 3.6);
        s.rrect(px, by, pw, u * 3.6, 0.3, { stroke: s.c('--rule'), lw: 0.25 });
        s.text('0', px, by + u * 7.6, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-2') });
        s.text('255', px + pw, by + u * 7.6, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-2') });
      });
      // The gain slider, which the next beats drag.
      const sA = s.ease('lit', 0.6, 0.6);
      s.alpha(sA, () => {
        const sy = gy + u * 33;
        s.text('gain', px, sy - u * 5, { size: 3.3, font: 'mono', weight: 600, align: 'left', color: s.c('slate') });
        s.text(gain.toFixed(1), px + pw, sy - u * 5, { size: 3.3, font: 'mono', weight: 600, align: 'right', color: s.c('slate') });
        sliderIcon(s, px + u * 1.5, sy, pw - u * 3, (gain - 0.2) / 2.8, 'slate');
        const hand = s.since('live') >= 0 && s.since('clip') < 0 ? s.ease('live', 0.4) * (1 - easeAt(s, 'live', 0.85, 0.4)) : 0;
        if (hand > 0) s.alpha(hand, () => pointer(s, px + u * 1.5 + (pw - u * 3) * ((gain - 0.2) / 2.8), sy + u * 0.5, 5.5, 0));
        const over = SMILEY.flat().filter((v) => v * gain > 255).length;
        s.alpha(over > 0 && clipIn < 1 ? 1 - clipIn : 0, () => s.text(`${over} over 255`, pcx, sy + u * 11, { size: 3.1, font: 'mono', weight: 600, color: s.c('red') }));
        s.alpha(clipIn, () => s.text('capped at 255', pcx, sy + u * 11, { size: 3.1, italic: true, color: s.c('--ink-2') }));
      });
      // The mean, which the last line's comment shows too.
      const mA = s.ease('mean', 0.6);
      s.alpha(mA, () => {
        const my = gy + G - u * 9;
        const flash = Math.sin(clamp01(s.since('mean') / 1.2) * Math.PI);
        s.rrect(px, my - u * 5.5, pw, u * 11, 1.6, { fill: s.tint('--accent', 0.08 + 0.2 * flash), stroke: s.tint('--accent', 0.6), lw: 0.3 });
        s.text('mean', pcx, my - u * 2, { size: 3, font: 'mono', color: s.c('--ink-2') });
        s.text(fmt(meanAt(gain), 4), pcx, my + u * 2.6, { size: 4.2, font: 'mono', weight: 650 });
      });
    });
  },
};

// ---------------------------------------------------------------- colors

const PALETTE: [string, string, K][] = [
  ['W', 'weights', 'blue'],
  ['x', 'inputs', 'orange'],
  ['b', 'biases', 'green'],
  ['s', 'scores', 'purple'],
  ['L', 'losses', 'red'],
  ['dW', 'gradients', 'teal'],
  ['y', 'labels', 'gold'],
  ['gain', 'knobs', 'slate'],
];

/** The equation's left edge (fraction of the stage width) and the em size in u. */
const EQ_EM = 5;
const eqLeft = (s: Scene): number => (s.w / 2 - s.u * 30) / s.w;

export const colors: SceneDef = {
  marks: {
    eq: { tex: String.raw`\symerr = \frac{1}{N}\sum_{i=1}^{N} \mathbf{1}\!\left[\,\symy_i \notin \operatorname{top5}(\syms_i)\,\right]`, x: 0.2, y: 0.25, size: EQ_EM, align: 'left' },
    card: { tex: String.raw`\symerr = \frac{1}{N}\sum_{i} \mathbf{1}[\,\symy_i \notin \operatorname{top5}(\syms_i)\,]`, x: 0.5, y: 0.26, size: 3.6 },
  },
  draw(s) {
    const { w, u } = s;
    // Three quantities, three colors.
    const keys: [string, string, K][] = [
      ['s', 'scores', 'purple'],
      ['y', 'the correct label', 'gold'],
      ['err', 'the error', 'red'],
    ];
    s.alpha(s.win('color', 'eq'), () => {
      keys.forEach(([sym, name, k], i) => {
        const a = s.ease('color', 0.6, 1 + 0.6 * i);
        const cx = w / 2 + (i - 1) * Math.min(u * 34, w * 0.3);
        s.alpha(a, () => {
          s.circle(cx, u * 44, u * 9, { fill: s.tint(k, 0.14), stroke: s.c(k), lw: 0.5 });
          s.text(sym, cx, u * 44.5, { size: sym.length > 1 ? 5.4 : 7, italic: sym.length === 1, weight: 600, color: s.c(k) });
          s.text(name, cx, u * 60, { size: 3.6, italic: true, color: s.c('--ink-2') });
        });
      });
    });

    // Math, code and words share the colors.
    const rowsA = s.win('eq', 'habit');
    const left = eqLeft(s);
    s.show('eq', rowsA * s.ease('eq', 0.6, 0.4), { x: left, y: 0.25 });
    const x0 = u * 6;
    s.alpha(rowsA, () => {
      const label = (txt: string, y: number, a: number) => s.alpha(a, () => s.text(txt, x0, y, { size: 2.8, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-3') }));
      label('MATH', u * 13, s.ease('eq', 0.5));
      const cA = s.ease('code', 0.6);
      label('CODE', u * 37, cA);
      const lines: [string, K?][][] = [
        [['top5 = np.argsort(-'], ['scores', 'purple'], [', axis=1)[:, :5]']],
        [['hit = (top5 == '], ['y', 'gold'], ['[:, None]).any(axis=1)']],
        [['err', 'red'], [' = 1.0 - hit.mean()']],
      ];
      const fsz = Math.min(3.3, ((w - u * 14) / u / 41) * 1.62);
      const cw = s.measure('top5 = np.argsort(-scores, axis=1)[:, :5]', { font: 'mono', size: fsz });
      const cx = Math.max(x0, w / 2 - cw / 2);
      lines.forEach((ln, i) => s.alpha(clamp01((s.since('code') - i * 0.5) / 0.4), () => spans(s, ln, cx, u * (44 + i * 5.6), { font: 'mono', size: fsz })));
      const wA = s.ease('tap', 0.6);
      label('WORDS', u * 64, wA);
      const wsz = 3.7;
      const w1: [string, K?, number?][] = [['When the label '], ['y', 'gold', 650], [' misses the top five '], ['scores', 'purple', 650], [',']];
      const w2: [string, K?, number?][] = [['the error '], ['err', 'red', 650], [' counts it as a miss.']];
      s.alpha(wA, () => {
        spans(s, w1, w / 2, u * 71, { size: wsz, align: 'center' });
        spans(s, w2, w / 2, u * 77, { size: wsz, align: 'center' });
      });
      // Pointing at err lights it everywhere.
      const press = s.since('tap') >= 0 ? clamp01((s.t - at(s, 'tap', 0.35)) / 0.35) : 0;
      const glow = press > 0.6 ? 0.55 + 0.45 * Math.sin((s.t - at(s, 'tap', 0.35)) * 4) ** 2 : 0;
      const ww1 = s.measure('the error ', { size: wsz });
      const wTot = w2.reduce((a, [tt, , wt]) => a + s.measure(tt, { size: wsz, weight: wt }), 0);
      const errW = s.measure('err', { size: wsz, weight: 650 });
      const ex = w / 2 - wTot / 2 + ww1 + errW / 2;
      const ey = u * 77;
      if (glow > 0) {
        const halo = (x: number, y: number, hw: number, hh: number) => s.rrect(x - hw / 2, y - hh / 2, hw, hh, 1.2, { fill: s.tint('red', 0.18 * glow), stroke: s.tint('red', 0.8 * glow), lw: 0.4 });
        halo(ex, ey, errW + u * 2, u * 6);
        const ce = s.measure('err', { font: 'mono', size: fsz });
        halo(cx + ce / 2, u * 55.2, ce + u * 2, u * 5.4);
        halo(left * w + EQ_EM * u * 0.66, u * 25, EQ_EM * u * 1.7, u * 7.5);
        s.alpha(clamp01((press - 0.6) * 3), () => {
          const tip = 'err: the top-5 error';
          const tw = s.measure(tip, { font: 'ui', size: 3 }) + u * 4;
          const tx = Math.min(w - u * 4 - tw, ex + u * 7);
          s.rrect(tx, ey + u * 5, tw, u * 6.4, 1.2, { fill: s.c('--ink') });
          s.text(tip, tx + tw / 2, ey + u * 8.3, { size: 3, font: 'ui', weight: 600, color: s.c('--card') });
        });
      }
      const pin = s.since('tap') >= 0 ? smooth((s.t - at(s, 'tap', 0.05)) / 1) : 0;
      if (pin > 0) s.alpha(pin * (1 - s.ease('habit', 0.4)), () => pointer(s, lerp(w - u * 4, ex + u * 0.5, pin), lerp(u * 97, ey + u * 1.5, pin), 5.5, press > 0 && press < 1 ? press : 0));
    });

    // The habit: one color per kind of quantity.
    const pA = s.win('habit', 'cards');
    s.alpha(pA, () => {
      const cols = 4;
      const sp = Math.min(u * 26, (w - u * 10) / cols);
      PALETTE.forEach(([sym, name, k], i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const cx = w / 2 + (c - 1.5) * sp;
        const cy = u * (30 + r * 33);
        const beat = i < 4 ? 'habit' : 'habit2';
        const f = 0.32 + 0.16 * (i % 4);
        const a = s.since(beat) >= 0 ? smooth((s.t - at(s, beat, i < 4 ? f : 0.05 + 0.2 * (i % 4))) / 0.5) : 0;
        s.alpha(0.25 + 0.75 * a, () => {
          s.circle(cx, cy, u * 8, { fill: s.tint(k, 0.08 + 0.1 * a), stroke: s.tint(k, 0.4 + 0.6 * a), lw: 0.45 });
          s.text(sym, cx, cy + u * 0.4, { size: sym.length > 2 ? 3.8 : 5.6, italic: sym.length < 3, weight: 600, font: sym.length > 2 ? 'mono' : 'serif', color: s.c(k) });
          s.text(name, cx, cy + u * 13, { size: 3.4, italic: true, color: s.c(a > 0.5 ? k : '--ink-2') });
        });
      });
    });

    // An equation card: four parts, and the shortcut to plain words.
    const kA = s.ease('cards', 0.7);
    if (kA <= 0) return;
    const cw = Math.min(u * 74, w - u * 26);
    const cx0 = w / 2 - cw / 2;
    const parts: [string, number][] = [
      ['equation', 17],
      ['piece by piece', 16],
      ['same thing in code', 14],
      ['in plain words', 14],
    ];
    let y = u * 12;
    const ys: number[] = [];
    s.alpha(kA, () => {
      s.rrect(cx0, y, cw, u * (parts.reduce((a, [, hh]) => a + hh, 0) + 3 * 1.2), 2.4, { fill: s.tint('--ink', 0.03), stroke: s.tint('--ink', 0.35), lw: 0.35 });
      const skip = s.since('skip') >= 0 ? smooth((s.t - at(s, 'skip', 0.3)) / 0.9) : 0;
      parts.forEach(([name, hh], i) => {
        const a = s.since('cards') >= 0 ? smooth((s.t - at(s, 'cards', 0.08 + 0.2 * i)) / 0.5) : 0;
        const yy = y;
        ys.push(yy + (u * hh) / 2);
        const dim = skip > 0 && (i === 1 || i === 2) ? 1 - 0.6 * skip : 1;
        const lit = i === 3 ? skip : 0;
        s.alpha(a * dim, () => {
          if (i > 0) s.line(cx0 + u * 2, yy - u * 0.6, cx0 + cw - u * 2, yy - u * 0.6, s.tint('--ink', 0.18), 0.25);
          if (lit > 0) s.rrect(cx0 + u * 1, yy + u * 0.4, cw - u * 2, u * hh - u * 1.4, 1.4, { fill: s.tint('green', 0.14 * lit), stroke: s.tint('green', 0.7 * lit), lw: 0.35 });
          s.text(name, cx0 + u * 3, yy + u * 3.2, { size: 2.8, font: 'mono', weight: 600, align: 'left', color: s.c(i === 3 && lit > 0.5 ? 'green' : '--ink-3') });
          if (i === 1) {
            spans(s, [['s', 'purple', 650], [': the class scores']], cx0 + u * 6, yy + u * 8.4, { size: 3.2, italic: true });
            spans(s, [['y', 'gold', 650], [': the correct label']], cx0 + u * 6, yy + u * 13, { size: 3.2, italic: true });
          } else if (i === 2) {
            spans(s, [['err', 'red'], [' = 1.0 - hit.mean()']], cx0 + u * 6, yy + u * 9.2, { size: 3.2, font: 'mono' });
          } else if (i === 3) {
            s.text('how often all five guesses miss', cx0 + u * 6, yy + u * 9.2, { size: 3.4, italic: true, align: 'left', color: s.c('--ink') });
          }
        });
        y += u * (hh + 1.2);
      });
      s.show('card', kA * (s.since('cards') >= 0 ? smooth((s.t - at(s, 'cards', 0.08)) / 0.5) : 0), { y: (u * 12 + u * 9.6) / s.h });
      // The shortcut: straight from the equation to the plain words.
      if (skip > 0) {
        const ax = cx0 + cw + u * 4;
        const c = s.ctx;
        const y1 = ys[0]!;
        const y2 = lerp(y1, ys[3]!, skip);
        c.beginPath();
        c.moveTo(cx0 + cw + u * 0.5, y1);
        c.bezierCurveTo(ax + u * 6, y1, ax + u * 6, y2, cx0 + cw + u * 1.2, y2);
        c.strokeStyle = s.c('green');
        c.lineWidth = u * 0.5;
        c.stroke();
        if (skip > 0.95) s.arrow(cx0 + cw + u * 4, ys[3]!, cx0 + cw + u * 0.8, ys[3]!, s.c('green'), 0.5, 2);
      }
    });
  },
};

// ---------------------------------------------------------------- map

const PARTS: { name: string; note: string; items: string[]; beat: string; k: K }[] = [
  { name: 'Start here', note: 'this page, math, NumPy', items: ['0', '1', '2'], beat: 'start', k: 'slate' },
  { name: 'Neural networks', note: 'the core, read in order', items: ['3', '4', '5', '6', '7', '8', '9', '10'], beat: 'nn', k: 'blue' },
  { name: 'Convolutional networks', note: 'networks for images', items: ['11', '12', '13', '14'], beat: 'conv', k: 'green' },
  { name: 'Beyond still images', note: 'sequences, video', items: ['15', '16', '17'], beat: 'beyond', k: 'purple' },
  { name: 'Assignments', note: 'what each asked for', items: ['A1', 'A2', 'A3'], beat: 'asg', k: 'gold' },
];

export const map: SceneDef = {
  draw(s) {
    const { w, u, t } = s;
    const bw = Math.min(w - u * 12, u * 104);
    const bx = w / 2 - bw / 2;
    const rh = u * 16;
    const y0 = u * 15.5;
    const sp = Math.min(u * 8.2, (bw - u * 4) / 8);
    const r = Math.min(u * 3, sp * 0.4);
    const next = s.ease('next', 0.8, 0.4);
    PARTS.forEach((P, i) => {
      const a = s.ease('five', 0.5, 0.3 + 0.35 * i);
      if (a <= 0) return;
      const y = y0 + i * rh;
      const lit = s.since(P.beat) >= 0;
      const p = lit ? s.prog(P.beat) : 0;
      const recap = s.since('recap') >= 0 && s.since('next') < 0 ? 1 : 0;
      s.alpha(a, () => {
        s.text(P.name, bx, y + u * 3, { size: 3.8, font: 'display', weight: 600, align: 'left', color: s.c(lit ? P.k : '--ink-2') });
        s.alpha(s.ease(P.beat, 0.5), () => s.text(P.note, bx + bw, y + u * 3, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2') }));
        const cy = y + u * 10.2;
        const n = P.items.length;
        const cx0 = bx + r + u * 0.5;
        s.line(cx0, cy, cx0 + (n - 1) * sp, cy, s.tint(lit ? P.k : '--ink', lit ? 0.5 : 0.18), 0.35);
        P.items.forEach((it, j) => {
          const on = lit ? clamp01(p * (n + 2) - j) : 0;
          const cx = cx0 + j * sp;
          const asg = i === 4;
          const k: K = P.k;
          const fillA = Math.max(on, recap);
          if (asg) {
            s.rrect(cx - r * 1.2, cy - r, r * 2.4, r * 2, 0.9, { fill: s.c('--card') });
            s.rrect(cx - r * 1.2, cy - r, r * 2.4, r * 2, 0.9, { fill: s.tint(k, 0.08 + 0.3 * fillA), stroke: s.tint(k, 0.35 + 0.65 * fillA), lw: 0.35 });
          }
          else s.circle(cx, cy, r, { fill: fillA > 0.5 ? s.tint(k, 0.85) : s.c('--card'), stroke: s.tint(k, 0.4 + 0.6 * fillA), lw: 0.35 });
          const txt = !asg && fillA > 0.5 ? '#fff' : s.c(fillA > 0.5 ? k : '--ink-2');
          s.text(it, cx, cy + u * 0.2, { size: it.length > 1 ? 2.4 : 2.8, font: 'mono', weight: 650, color: txt });
        });
        // You are here, and the next stop.
        if (i === 0) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 3);
          s.circle(cx0, cy, r + u * (1 + pulse * 0.8), { stroke: s.tint('--accent', 0.5 + 0.4 * pulse), lw: 0.45 });
          const lx = cx0 + 2 * sp + r + u * 4;
          s.alpha(s.ease('five', 0.6, 0.8) * (1 - next), () => s.text('← you are here', lx, cy + u * 0.2, { size: 3.1, font: 'ui', weight: 600, align: 'left', color: s.c('--accent') }));
          s.alpha(next, () => {
            s.circle(cx0 + sp, cy, r + u * 1.2, { stroke: s.c('--accent'), lw: 0.5 });
            s.text('← next: the math survival kit', lx, cy + u * 0.2, { size: 3.1, font: 'ui', weight: 600, align: 'left', color: s.c('--accent') });
          });
        }
      });
    });
  },
};
