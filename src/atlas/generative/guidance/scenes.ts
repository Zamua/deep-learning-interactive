import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells, columns } from '../../draw';
import { block, caption, Frame, fmt, noised, rich, shades, subText } from '../draw';

const EU = [0.2, -0.4];
const EC = [0.5, -0.1];
const at = (w: number) => EU.map((v, i) => +(v + w * (EC[i]! - v)).toFixed(2));
const XT = noised(0.5);

/** The guidance plane: the two guesses and the line through them. */
function plane(s: Scene, top: number, bottom: number): Frame {
  const u = s.u;
  const half = Math.min(s.w / 2 - 10 * u, 60 * u);
  const F = new Frame(s, s.w / 2 - half, top, s.w / 2 + half, bottom, [-0.3, 1.5], [-0.7, 0.75]);
  F.axes(0.8);
  s.text('noise guess, 2 pixels', F.r, F.b + 3.5 * u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
  return F;
}

function label(s: Scene, F: Frame, p: number[], text: string, k: 'slate' | 'teal' | 'red', dx: number, dy: number, size = 3.2): void {
  const o = { size, color: s.c(k), halo: true, align: dx < 0 ? 'right' : dx > 0 ? 'left' : 'center' } as const;
  const m = /^ε_([cu])$/.exec(text);
  if (m) subText(s, 'ε', m[1]!, F.X(p[0]!) + dx * s.u, F.Y(p[1]!) + dy * s.u, o);
  else s.text(text, F.X(p[0]!) + dx * s.u, F.Y(p[1]!) + dy * s.u, { ...o, font: 'mono', weight: 650 });
}

const two: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const y = s.h * 0.24;
    shades(s, X(0.13), y, 1, XT, '--ink', { lo: -2.2, hi: 2.2 });
    s.text('xₜ', X(0.13), y + 10 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('purple') });
    s.arrow(X(0.13) + 8 * u, y, X(0.4) - 10 * u, y, s.c('--ink-3'), 0.35, 2);
    block(s, X(0.4), y, 18, 10, 'denoiser', 'blue', { size: 3.4 });
    s.text('“a red bicycle”', X(0.4), y - 10 * u, { size: 3.2, font: 'serif', italic: true, color: s.c('teal') });
    const xs = columns(s, 2, 12).map((x) => x + X(0.3));
    const pc = s.ease('prompt', 0.6, 1);
    s.alpha(pc, () => {
      s.arrow(X(0.4) + 10 * u, y - 2 * u, xs[0]! - 9 * u, y - 7 * u, s.c('teal'), 0.35, 2);
      cells(s, xs, y - 7 * u, EC.map((v) => fmt(v)), 'teal', { w: 11, h: 7 });
      subText(s, 'ε', 'c', xs[1]! + 7.5 * u, y - 7 * u, { size: 3.6, align: 'left', color: s.c('teal') });
    });
    const dr = s.ease('drop', 0.6);
    s.alpha(dr, () => {
      s.text('“ ” (empty)', X(0.4), y + 10 * u, { size: 3.2, font: 'serif', italic: true, color: s.c('slate') });
      s.arrow(X(0.4) + 10 * u, y + 2 * u, xs[0]! - 9 * u, y + 7 * u, s.c('slate'), 0.35, 2);
      cells(s, xs, y + 7 * u, EU.map((v) => fmt(v)), 'slate', { w: 11, h: 7 });
      subText(s, 'ε', 'u', xs[1]! + 7.5 * u, y + 7 * u, { size: 3.6, align: 'left', color: s.c('slate') });
    });
    const df = s.ease('diff', 0.6);
    s.alpha(df, () => {
      const F = plane(s, s.h * 0.46, s.h * 0.92);
      F.dot(EU[0]!, EU[1]!, 'slate', 1.5);
      F.dot(EC[0]!, EC[1]!, 'teal', 1.5);
      const k = s.ease('diff', 0.8, 0.6);
      s.arrow(F.X(EU[0]!), F.Y(EU[1]!), F.X(EU[0]! + (EC[0]! - EU[0]!) * k), F.Y(EU[1]! + (EC[1]! - EU[1]!) * k), s.c('red'), 0.5, 2.4);
      label(s, F, EU, 'ε_u', 'slate', -3, 2);
      label(s, F, EC, 'ε_c', 'teal', -3, -2);
      label(s, F, [0.35, -0.25], 'the prompt\'s direction', 'red', 4, 2, 3.2);
    });
  },
};

const push: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{epshat}{\hat\epsilon} = \sym{epsu}{\epsilon_u} + \sym{wg}{w}\,(\sym{epsc}{\epsilon_c} - \sym{epsu}{\epsilon_u})`, x: 0.5, y: 0.1, size: 5 },
  },
  draw(s) {
    s.show('f', s.ease('rule', 0.6));
    const F = plane(s, s.h * 0.22, s.h * 0.84);
    const go = s.ease('three', 1.2, 0.5);
    const w = 1 + 2 * go;
    const end = at(Math.max(1, w));
    s.line(F.X(EU[0]!), F.Y(EU[1]!), F.X(end[0]!), F.Y(end[1]!), s.tint('red', 0.6), 0.4, [1, 0.8]);
    F.dot(EU[0]!, EU[1]!, 'slate', 1.5);
    F.dot(EC[0]!, EC[1]!, 'teal', 1.5);
    label(s, F, EU, 'ε_u', 'slate', -3, 2);
    label(s, F, EC, 'ε_c', 'teal', 3, 2.5);
    s.alpha(s.ease('ends', 0.6), () => {
      label(s, F, EU, 'w = 0', 'slate', 0, 5.5, 3);
      label(s, F, EC, 'w = 1', 'teal', -3, -3, 3);
    });
    s.alpha(s.ease('three', 0.6), () => {
      const p = at(w);
      F.dot(p[0]!, p[1]!, 'red', 1.8);
      label(s, F, p, `w = ${fmt(+w.toFixed(1))}`, 'red', -3, -1, 3.2);
      s.alpha(s.ease('three', 0.6, 2.5), () => label(s, F, at(3), '[1.1, 0.5]', 'red', 3, 3, 3.2));
    });
    s.alpha(s.ease('use', 0.6), () => caption(s, 'every step: 2 runs, with and without the prompt', s.h * 0.93, '--ink-2', 3.2));
  },
};

/** One bicycle: two wheels and a frame, in a color, centered on (cx, cy). */
function bike(s: Scene, cx: number, cy: number, b: Bike, a: number): void {
  const u = s.u;
  const r = b.r * u;
  const half = b.base * u;
  const c = s.ctx;
  s.alpha(a, () => {
    const lw = b.lw;
    s.circle(cx - half, cy + r * 0.2, r, { stroke: b.wheel, lw });
    s.circle(cx + half, cy + r * 0.2, r, { stroke: b.wheel, lw });
    const seat: [number, number] = [cx - half * 0.35, cy - r * 0.9];
    const head: [number, number] = [cx + half * 0.6, cy - r * 1.05];
    const crank: [number, number] = [cx, cy + r * 0.2];
    c.beginPath();
    c.moveTo(cx - half, cy + r * 0.2);
    c.lineTo(seat[0], seat[1]);
    c.lineTo(head[0], head[1]);
    c.lineTo(crank[0], crank[1]);
    c.lineTo(cx - half, cy + r * 0.2);
    c.moveTo(seat[0], seat[1]);
    c.lineTo(crank[0], crank[1]);
    c.moveTo(head[0], head[1]);
    c.lineTo(cx + half, cy + r * 0.2);
    c.strokeStyle = b.frame;
    c.lineWidth = lw * 1.5 * u;
    c.lineJoin = 'round';
    c.stroke();
    s.line(head[0] - 1 * u, head[1] - 0.6 * u, head[0] + 1.2 * u, head[1] - 1 * u, b.frame, lw * 1.3);
  });
}

interface Bike {
  r: number;
  base: number;
  frame: string;
  wheel: string;
  lw: number;
}

/** Three samples per guidance scale, from loose and varied to identical and overdone. */
function samples(s: Scene, w: number, k: number): Bike {
  const rng = new Rng(100 * w + k + 7);
  const jit = (amt: number) => (rng.next() - 0.5) * amt;
  const spread = w === 1 ? 1 : w === 3 ? 0.5 : w === 7.5 ? 0.15 : 0;
  const loose = w === 1 && k === 1;
  const hue = w === 1 ? (['red', 'blue', 'green'] as const)[k]! : 'red';
  const strength = w === 15 ? 1 : w === 7.5 ? 0.85 : 0.65;
  return {
    r: 3.4 + jit(1.6 * spread) + (loose ? 1 : 0),
    base: 4.6 + jit(2 * spread) + (loose ? -1.2 : 0),
    frame: w === 15 ? s.c('red') : s.tint(hue, strength),
    wheel: w === 15 ? s.c('--ink') : s.tint('--ink-2', 0.7 + 0.3 * strength),
    lw: w === 15 ? 0.55 : 0.35,
  };
}

const SCALES = [1, 3, 7.5, 15];

const scale: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, Math.min(25, (s.w / u - 12) / 4));
    const ys = [0.32, 0.5, 0.68].map((f) => s.h * f);
    const show = [s.ease('sweep', 0.6), s.ease('mid', 0.6), s.ease('big', 0.6)];
    const hi = [s.win('low', 'mid'), 0, s.win('mid', 'big'), s.ease('big', 0.6)];
    SCALES.forEach((w, i) => {
      const a = i === 0 ? show[0]! : i === 3 ? show[2]! : show[1]!;
      s.alpha(a, () => {
        s.text(`w = ${w}`, xs[i]!, s.h * 0.14, { size: 3.6, font: 'mono', weight: 650, color: s.c(hi[i]! > 0.5 ? 'red' : '--ink-2') });
        ys.forEach((y, k) => bike(s, xs[i]!, y, samples(s, w, k), 1));
        s.rrect(xs[i]! - 11 * u, s.h * 0.21, 22 * u, s.h * 0.56, 1.4, { stroke: s.tint('red', 0.15 + 0.6 * hi[i]!), lw: 0.3 + 0.2 * hi[i]! });
      });
    });
    const o = { size: 3.4, weight: 600, halo: true } as const;
    s.alpha(s.win('low', 'mid'), () => rich(s, [['w = 1: ', 'red'], ['varied, loosely on the prompt', '--ink-2']], s.w / 2, s.h * 0.88, o));
    s.alpha(s.win('mid', 'big'), () => rich(s, [['w ≈ 7: ', 'red'], ['red bicycles, closely on the prompt', '--ink-2']], s.w / 2, s.h * 0.88, o));
    s.alpha(s.ease('big', 0.6), () => rich(s, [['w = 15: ', 'red'], ['all alike, overdone', '--ink-2']], s.w / 2, s.h * 0.88, o));
    s.alpha(s.ease('big', 0.6, 3), () => caption(s, 'variety traded for the prompt', s.h * 0.94, '--ink-3', 3));
  },
};

export const scenes: Record<string, SceneDef> = { two, push, scale };
