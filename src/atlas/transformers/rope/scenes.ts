import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { cite } from '../../draw';
import { rich } from '../../linear-algebra/draw';

const RAD = Math.PI / 180;
const Q = [2, 1];
const K = [1, 1];
const turned = (p: number[], a: number) => [p[0]! * Math.cos(a * RAD) - p[1]! * Math.sin(a * RAD), p[0]! * Math.sin(a * RAD) + p[1]! * Math.cos(a * RAD)];
const lenOf = (p: number[]) => Math.hypot(p[0]!, p[1]!);
const angOf = (p: number[]) => Math.atan2(p[1]!, p[0]!) / RAD;

/** One centered line of mono text. */
function line(s: Scene, text: string, y: number, k: Ink, a: number, size = 3.3) {
  s.alpha(a, () => s.text(text, s.w / 2, y, { size, font: 'mono', weight: 600, color: s.c(k), halo: true }));
}

/** An arrow from (x, y) at angle `a` (degrees) and length `r` px. */
function spoke(s: Scene, x: number, y: number, r: number, a: number, k: Ink, width = 0.5, head = 2): void {
  s.arrow(x, y, x + Math.cos(a * RAD) * r, y - Math.sin(a * RAD) * r, s.c(k), width, head);
}

// ---- scene 1: added positions know slots, not distances

/** Each slot's learned position vector, as a direction: unrelated from slot to slot. */
const PANG = [70, 200, 15, 130, 300, 45, 250, 160, 330, 100];
const SLOTS = PANG.length;

const goal: SceneDef = {
  draw(s) {
    const u = s.u;
    const pitch = Math.min(11.5, (s.w / u - 16) / (SLOTS - 1)) * u;
    const X = (m: number) => s.w / 2 + (m - (SLOTS - 1) / 2) * pitch;
    const yl = s.h * 0.27;
    const su = s.ease('su', 0.8);
    const nameA = s.ease('name', 0.6);
    // The slots, each with its added vector; at `su` the vectors give way to turned arrows.
    s.line(X(0) - 3 * u, yl, X(SLOTS - 1) + 3 * u, yl, s.c('--axis'), 0.3);
    for (let m = 0; m < SLOTS; m++) {
      s.circle(X(m), yl, 0.7 * u, { fill: s.tint('--ink-3', 0.6) });
      s.text(String(m), X(m), yl + 3.6 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      const vy = yl + 12 * u;
      s.alpha(s.ease('add', 0.6, 0.4 + 0.08 * m) * (1 - su), () => {
        s.circle(X(m), vy, 0.5 * u, { fill: s.c('slate') });
        spoke(s, X(m), vy, 4.4 * u, PANG[m]!, 'slate', 0.45, 1.8);
      });
      s.alpha(su, () => {
        s.circle(X(m), vy, 4.6 * u, { stroke: s.tint('--ink-3', 0.4), lw: 0.22 });
        spoke(s, X(m), vy, 4 * u, angOf(Q) + 36 * m * s.ease('su', 2, 0.8), 'teal', 0.45, 1.8);
      });
    }
    s.alpha(s.ease('add', 0.6, 1.2) * (1 - s.ease('back', 0.6)), () => rich(s, [['P', 'slate'], [': one learned vector per slot, added', '--ink-2']], s.w / 2, yl + 22 * u, { size: 3.1, weight: 600 }));
    s.alpha(su * (1 - nameA), () => rich(s, [['q, k', 'teal'], [': turned by position, nothing added', '--ink-2']], s.w / 2, yl + 22 * u, { size: 3.1, weight: 600 }));

    // A query and the key just before it, at two places.
    const pairA = s.ease('back', 0.6) * (1 - s.ease('su', 0.6));
    s.alpha(pairA, () => {
      [[5, 4], [9, 8]].forEach(([qm, km], i) => {
        s.alpha(s.ease('back', 0.6, i * 2.6), () => {
          const top = yl - 12 * u;
          const c = s.ctx;
          c.beginPath();
          c.moveTo(X(km!), yl - 2 * u);
          c.quadraticCurveTo((X(km!) + X(qm!)) / 2, top - 2 * u, X(qm!), yl - 2 * u);
          c.strokeStyle = s.tint('slate', 0.8);
          c.lineWidth = 0.35 * u;
          c.stroke();
          s.text('1 back', (X(km!) + X(qm!)) / 2, top - 3.4 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('slate'), halo: true });
          s.circle(X(qm!), yl, 1.6 * u, { fill: s.tint('teal', 0.4), stroke: s.c('teal'), lw: 0.3 });
          s.circle(X(km!), yl, 1.6 * u, { fill: s.tint('purple', 0.4), stroke: s.c('purple'), lw: 0.3 });
          s.text('q', X(qm!), yl - 5 * u, { size: 3, font: 'mono', weight: 650, color: s.c('teal'), halo: true });
          s.text('k', X(km!), yl - 5 * u, { size: 3, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
        });
      });
    });

    // The two cases' added vectors, side by side: nothing in common.
    const cases = s.ease('twice', 0.6) * (1 - s.ease('want', 0.6));
    const py = s.h * 0.66;
    const R = (s.tall ? 9 : 10) * u;
    s.alpha(cases, () => {
      [[5, 4], [9, 8]].forEach(([qm, km], i) => {
        const cx = s.w * (i === 0 ? 0.3 : 0.7);
        s.text(`query ${qm}, key ${km}`, cx, py - R - 8.5 * u, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2') });
        s.circle(cx, py, 0.6 * u, { fill: s.c('slate') });
        for (const [m, k] of [[qm!, 'teal'], [km!, 'purple']] as const) {
          spoke(s, cx, py, R, PANG[m]!, k, 0.6, 2.4);
          const lr = R + 3.4 * u;
          s.text(`P[${m}]`, cx + Math.cos(PANG[m]! * RAD) * lr, py - Math.sin(PANG[m]! * RAD) * lr, { size: 3, font: 'mono', weight: 650, color: s.c(k), halo: true });
        }
      });
      s.text('vs', s.w / 2, py, { size: 3.4, font: 'mono', weight: 600, color: s.c('red') });
    });
    line(s, 'nothing ties the two together', s.h * 0.9, 'red', cases);
    s.alpha(s.ease('want', 0.6) * (1 - s.ease('su', 0.6)), () => {
      rich(s, [['5 − 4', 'teal'], [' = ', '--ink-2'], ['9 − 8', 'teal'], [' = 1', '--ink']], s.w / 2, s.h * 0.62, { size: 4.4, weight: 650 });
      line(s, 'want: a score set by the gap alone', s.h * 0.72, 'green', 1, 3.4);
    });

    cite(s, 'Su, Lu, Pan, Murtadha, Wen & Liu, 2021', s.ease('su', 0.6));
    s.alpha(s.win('su', 'name'), () => line(s, 'turn q and k by position', s.h * 0.66, '--ink', 1, 3.6));
    s.alpha(nameA, () => {
      rich(s, [['RoPE', 'teal']], s.w / 2, s.h * 0.62, { size: 6, weight: 700 });
      rich(s, [['Ro', 'teal'], ['tary ', '--ink-2'], ['P', 'teal'], ['osition ', '--ink-2'], ['E', 'teal'], ['mbedding', '--ink-2']], s.w / 2, s.h * 0.72, { size: 3.6, weight: 600 });
      s.alpha(s.ease('name', 0.6, 2.2), () => line(s, 'rotary: it rotates', s.h * 0.82, '--ink-2', 1, 3.1));
      s.alpha(s.ease('name', 0.6, 4), () => line(s, 'position embedding: like P, but nothing added', s.h * 0.9, '--ink-2', 1, 3.1));
    });
  },
};

// ---- scene 2: each position turns the pair a little further

/** A dial: a circle with an arrow turned to angle `a` (degrees), centered on (x, y), radius `r` px. */
function dial(s: Scene, x: number, y: number, r: number, a: number, k: Ink, base: number, on = 0): void {
  s.circle(x, y, r, { stroke: s.tint(on > 0.5 ? k : '--ink-3', 0.4 + 0.4 * on), lw: 0.25 + 0.15 * on, fill: s.tint(k, 0.04 + 0.12 * on) });
  s.line(x, y, x + Math.cos(base * RAD) * r * 0.85, y - Math.sin(base * RAD) * r * 0.85, s.tint('--ink-3', 0.5), 0.25, [0.8, 0.8]);
  spoke(s, x, y, r * 0.85, a, k, 0.55, 2.2);
}

/** Positions on show: 0 to 4, then 12 after a gap. */
const POS = [0, 1, 2, 3, 4, 12];

const turn: SceneDef = {
  draw(s) {
    const u = s.u;
    const pitch = (s.tall ? 16.5 : 19) * u;
    const r = (s.tall ? 6.3 : 7.5) * u;
    const gap = 3 * u;
    const wrapA = s.ease('wrap', 0.6);
    // Five dials sit centered until position 12 joins them.
    const shift = (1 - s.ease('wrap', 1, 0.2)) * (pitch + gap) / 2;
    const xs = POS.map((_, i) => s.w / 2 + (i - 2.5) * pitch + (i === 5 ? gap / 2 : -gap / 2) + shift);
    const q0 = angOf(Q);
    const y1 = s.h * 0.27;
    const y2 = s.h * 0.63;
    const o = { size: 3, font: 'mono' as const, weight: 600 };
    const grow = s.ease('theta', 1.6, 0.6);
    const shown = (i: number) => (i === 5 ? wrapA : 1);
    const lit = (m: number) => (m === 3 ? s.win('three', 'wrap') : 0) + (m === 0 ? s.win('three', 'wrap') + s.win('wrap', 'pairs') : 0) + (m === 12 ? s.win('wrap', 'pairs') : 0);
    xs.forEach((x, i) => {
      const m = POS[i]!;
      s.alpha(shown(i), () => {
        const a = q0 + 30 * m * (i === 5 ? 1 : grow);
        dial(s, x, y1, r, a, 'teal', q0, Math.min(1, lit(m)));
        s.text(`pos ${m}`, x, y1 - r - 3.4 * u, { ...o, color: s.c('--ink-2') });
        s.alpha(s.ease('m', 0.6, 1.2), () => s.text(m === 0 ? 'no turn' : `${m === 1 ? '' : m}θ`, x, y1 + r + 3.6 * u, { size: 3.4, font: 'serif', italic: m > 0, weight: 600, color: s.c('teal') }));
        s.alpha(i === 5 ? 1 : grow, () => s.text(`${30 * m}°`, x, y1 + r + 8.2 * u, { ...o, color: s.c('--ink-3') }));
      });
    });
    s.alpha(wrapA, () => s.text('⋯', (xs[4]! + xs[5]!) / 2, y1, { size: 3.4, color: s.c('--ink-3') }));
    const ty = y1 - r - 10 * u;
    s.alpha(s.ease('pair', 0.6, 2) * (1 - s.ease('theta', 0.5)), () => rich(s, [['pair 0: ', '--ink-3'], ['q = [2, 1]', 'teal']], s.w / 2, ty, { size: 3.4, weight: 600 }));
    s.alpha(s.ease('theta', 0.6, 0.3), () => rich(s, [['pair 0: ', '--ink-3'], ['θ = 30°', 'teal'], [' per position', '--ink-3']], s.w / 2, ty, { size: 3.4, weight: 600 }));

    // A slower pair: the same turns, a tenth as fast.
    s.alpha(s.ease('pairs', 0.6), () => {
      const g = s.ease('pairs', 1.6, 0.6);
      xs.forEach((x, i) => {
        const m = POS[i]!;
        const on = m === 0 || m === 12 ? s.win('clock', 'speeds') : 0;
        dial(s, x, y2, r, q0 + 3 * m * g, 'purple', q0, on);
        s.alpha(g, () => s.text(`${3 * m}°`, x, y2 + r + 3.6 * u, { ...o, color: s.c('--ink-3') }));
      });
      s.text('⋯', (xs[4]! + xs[5]!) / 2, y2, { size: 3.4, color: s.c('--ink-3') });
      rich(s, [['pair 1: ', '--ink-3'], ['θ = 3°', 'purple'], [' per position', '--ink-3']], s.w / 2, y2 - r - 4.4 * u, { size: 3.4, weight: 600 });
    });

    const cy = s.h * 0.92;
    s.alpha(s.win('m', 'three'), () => rich(s, [['position m: turned ', '--ink-2'], ['mθ', 'teal']], s.w / 2, cy, { size: 3.4, weight: 600 }));
    s.alpha(s.win('three', 'wrap'), () => rich(s, [['position 3: ', '--ink-2'], ['3 × 30° = 90°', 'teal']], s.w / 2, cy, { size: 3.4, weight: 600 }));
    s.alpha(s.win('wrap', 'pairs'), () => rich(s, [['12 × 30° = 360°', 'teal'], [': back to pos 0', '--ink-2']], s.w / 2, cy, { size: 3.4, weight: 600 }));
    s.alpha(s.win('clock', 'speeds'), () => rich(s, [['pair 1: ', 'purple'], ['0° and 36°', '--ink'], [', told apart', '--ink-2']], s.w / 2, cy, { size: 3.4, weight: 600 }));
    s.alpha(s.win('speeds', 'only'), () => rich(s, [['dₖ = 64: ', '--ink-2'], ['57°', 'teal'], [' down to ', '--ink-2'], ['< 0.01°', 'purple'], [' a step', '--ink-2']], s.w / 2, cy, { size: 3.3, weight: 600 }));
    s.alpha(s.ease('only', 0.6), () => {
      const parts: [string, Ink][] = [['q, k: turned', 'teal'], ['nothing added', '--ink-2'], ['nothing learned', '--ink-2']];
      const sp = (s.tall ? 33 : 40) * u;
      parts.forEach(([t, k], i) => s.text(t, s.w / 2 + (i - 1) * sp, cy, { size: s.tall ? 3 : 3.3, font: 'mono', weight: 650, color: s.c(k), halo: true }));
    });
  },
};

// ---- scene 3: turning both together keeps the score, so only the distance counts

/** Plane coordinates mapped onto the stage: `k` stage px per unit, the box's center at (cx, cy). */
interface Plane {
  P(x: number, y: number): [number, number];
  k: number;
}

function plane(s: Scene, cx: number, cy: number, k: number, box: [number, number, number, number]): Plane {
  const [x0, x1, y0, y1] = box;
  const ox = cx - ((x0 + x1) / 2) * k;
  const oy = cy + ((y0 + y1) / 2) * k;
  const P = (x: number, y: number): [number, number] => [ox + x * k, oy - y * k];
  s.line(...P(x0, 0), ...P(x1, 0), s.c('--axis'), 0.3);
  s.line(...P(0, y0), ...P(0, y1), s.c('--axis'), 0.3);
  return { P, k };
}

/** An arrow from the origin at angle `a` (degrees) and length `r`, with a label beyond its tip. */
function ray(s: Scene, F: Plane, r: number, a: number, k: Ink, label?: string, o: { width?: number; size?: number; push?: number } = {}): void {
  const x = r * Math.cos(a * RAD);
  const y = r * Math.sin(a * RAD);
  s.arrow(...F.P(0, 0), ...F.P(x, y), s.c(k), o.width ?? 0.7, 3);
  if (!label) return;
  const d = r + (o.push ?? 0.42);
  s.text(label, ...F.P(d * Math.cos(a * RAD), d * Math.sin(a * RAD)), { size: o.size ?? 3.4, font: 'mono', weight: 650, color: s.c(k), halo: true });
}

/** An arc around the origin from angle a0 to a1 (degrees), radius r in plane units, with a label. */
function arc(s: Scene, F: Plane, r: number, a0: number, a1: number, k: Ink, label?: string): void {
  const [ox, oy] = F.P(0, 0);
  const c = s.ctx;
  c.beginPath();
  c.arc(ox, oy, r * F.k, -a0 * RAD, -a1 * RAD, a1 > a0);
  c.strokeStyle = s.tint(k, 0.8);
  c.lineWidth = 0.35 * s.u;
  c.stroke();
  if (label) {
    const m = ((a0 + a1) / 2) * RAD;
    s.text(label, ...F.P((r + 0.32) * Math.cos(m), (r + 0.32) * Math.sin(m)), { size: 3, font: 'mono', weight: 600, color: s.c(k), halo: true });
  }
}

const f2 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2).replace(/\.?0+$/, '').replace('-', '−'));

const relative: SceneDef = {
  draw(s) {
    const u = s.u;
    const tall = s.tall;
    const k = (tall ? 13 : 15) * u;
    const F = plane(s, s.w * 0.3, tall ? s.h * 0.24 : s.h * 0.3, k, [-1.6, 2.6, -0.4, 2.5]);
    const sw = s.ease('both', 1.8, 0.8);
    const a = 90 * sw;
    const tr = s.ease('try', 0.6);
    const fade = (1 - 0.6 * s.ease('apart', 0.6)) * (1 - tr);
    s.alpha(fade, () => {
      ray(s, F, lenOf(Q), angOf(Q), '--ink-3', undefined, { width: 0.35 });
      ray(s, F, lenOf(K), angOf(K), '--ink-3', undefined, { width: 0.35 });
      ray(s, F, lenOf(Q), angOf(Q) + a, 'teal', 'q', { size: 4 });
      ray(s, F, lenOf(K), angOf(K) + a, 'purple', 'k', { size: 4, push: 0.3 });
      s.alpha(s.ease('both', 0.5, 1.2), () => arc(s, F, 0.5, angOf(K), angOf(K) + a, 'slate', sw > 0.9 ? '90°' : undefined));
    });
    // The dot product, unchanged by the shared turn.
    const rx = tall ? s.w * 0.74 : s.w * 0.72;
    const ry = tall ? s.h * 0.17 : s.h * 0.22;
    s.alpha(fade, () => {
      const qt = turned(Q, a);
      const kt = turned(K, a);
      const dotv = qt[0]! * kt[0]! + qt[1]! * kt[1]!;
      rich(s, [['q', 'teal'], [' · ', '--ink-2'], ['k', 'purple'], [` = ${f2(dotv)}`, '--ink']], rx, ry, { size: 4.6, weight: 650 });
      s.alpha(s.ease('numbers', 0.6), () => {
        const o = { size: 3.1, weight: 600 };
        rich(s, [['[2, 1]', 'teal'], [' · ', '--ink-3'], ['[1, 1]', 'purple'], [' = 3', '--ink-2']], rx, ry + 8 * u, o);
        s.alpha(s.ease('numbers', 0.6, 1.6), () => rich(s, [['[−1, 2]', 'teal'], [' · ', '--ink-3'], ['[−1, 1]', 'purple'], [' = 3', '--ink-2']], rx, ry + 14 * u, o));
      });
    });

    // Positions on a line: the query and key move together and stay three apart.
    const n = 11;
    const pitch = (tall ? 8.4 : 10) * u;
    const ly = s.h * (tall ? 0.7 : 0.75);
    const lx = (i: number) => s.w / 2 + (i - (n - 1) / 2) * pitch;
    s.alpha(s.ease('apart', 0.6) * (1 - tr), () => {
      for (let i = 0; i < n; i++) {
        s.circle(lx(i), ly, 0.7 * u, { fill: s.tint('--ink-3', 0.5) });
        s.text(String(i), lx(i), ly + 4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      }
      const mv = s.ease('shift', 1.4, 0.4);
      const qp = lerp(5, 9, mv);
      const kp = lerp(2, 6, mv);
      const mark = (p: number, label: string, kk: Ink) => {
        s.circle(lx(p), ly, 2 * u, { fill: s.tint(kk, 0.35), stroke: s.c(kk), lw: 0.35 });
        s.text(label, lx(p), ly - 5.4 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c(kk), halo: true });
        s.alpha(s.ease('apart', 0.6, 1.5), () => s.text(`${Math.round(p)}θ`, lx(p), ly - 10.4 * u, { size: 3.4, font: 'serif', italic: true, weight: 600, color: s.c(kk), halo: true }));
      };
      mark(kp, `k at ${Math.round(kp)}`, 'purple');
      mark(qp, `q at ${Math.round(qp)}`, 'teal');
      const by = ly + 9.5 * u;
      s.line(lx(kp), by, lx(qp), by, s.c('slate'), 0.35);
      s.line(lx(kp), by - 1.2 * u, lx(kp), by + 1.2 * u, s.c('slate'), 0.35);
      s.line(lx(qp), by - 1.2 * u, lx(qp), by + 1.2 * u, s.c('slate'), 0.35);
      const same = mv > 0.95;
      s.text(same ? '3θ apart: the same score' : '3θ apart', (lx(kp) + lx(qp)) / 2, by + 4 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c(same ? 'green' : 'slate'), halo: true });
    });
    s.alpha(s.ease('distance', 0.6) * (1 - tr), () => {
      s.text('only the distance and the order count', s.w / 2, s.h * 0.94, { size: tall ? 2.9 : 3.2, color: s.c('--ink'), halo: true });
    });

    // A worked score: the query at position 1 makes a quarter turn, the key at position 0 stays.
    s.alpha(tr, () => {
      const qs = s.ease('tq', 1.4, 0.6);
      ray(s, F, lenOf(Q), angOf(Q), '--ink-3', undefined, { width: 0.35 });
      s.alpha(s.ease('tq', 0.5), () => arc(s, F, 0.8, angOf(Q), angOf(Q) + 90 * qs, 'slate', qs > 0.9 ? '90°' : undefined));
      ray(s, F, lenOf(Q), angOf(Q) + 90 * qs, 'teal', 'q', { size: 4 });
      ray(s, F, lenOf(K), angOf(K), 'purple', 'k', { size: 4, push: 0.3 });
      const o = { size: 3.1, weight: 600 };
      rich(s, [['θ = 90°', 'slate']], rx, ry, { size: 4, weight: 650 });
      rich(s, [['q at 1: ', 'teal'], ['turns 90°', '--ink-2']], rx, ry + 8 * u, o);
      rich(s, [['k at 0: ', 'purple'], ['no turn', '--ink-2']], rx, ry + 14 * u, o);
    });
    const o2 = { size: tall ? 3.1 : 3.4, weight: 600 };
    s.alpha(s.ease('tq', 0.6, 1.5), () => rich(s, [['quarter turn: ', '--ink-2'], ['[a, b] → [−b, a]', '--ink']], s.w / 2, s.h * 0.62, o2));
    s.alpha(s.ease('tq', 0.6, 4), () => rich(s, [['q → ', 'teal'], ['[−1, 2]', '--ink'], ['    k = ', 'purple'], ['[1, 1]', '--ink']], s.w / 2, s.h * 0.7, o2));
    s.alpha(s.ease('tdot', 0.6), () => rich(s, [['[−1, 2] · [1, 1] = −1 + 2 = ', '--ink-2'], ['1', 'green']], s.w / 2, s.h * 0.8, { ...o2, size: o2.size + 0.3 }));
    s.alpha(s.ease('tdot', 0.6, 3), () => rich(s, [['unturned: [2, 1] · [1, 1] = 3', '--ink-3']], s.w / 2, s.h * 0.88, o2));
  },
};

export const scenes: Record<string, SceneDef> = { goal, turn, relative };
