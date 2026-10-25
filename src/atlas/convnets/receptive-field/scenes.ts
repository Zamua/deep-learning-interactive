import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../draw';

const N = 9;

/** x positions of the N columns, the stage's left labels kept clear. */
function cols(s: Scene, cx: number, pitch: number, n = N): number[] {
  return Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * pitch * s.u);
}

function unit(s: Scene, x: number, y: number, k: Ink, on: number): void {
  s.circle(x, y, 2.2 * s.u, { fill: s.tint(k, 0.15 + 0.5 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.3 });
}

function pixel(s: Scene, x: number, y: number, on: number): void {
  const w = 6.4 * s.u;
  s.rrect(x - w / 2, y - w / 2, w, w, 1, { fill: s.tint('orange', 0.12 + 0.4 * on), stroke: s.tint('orange', 0.45 + 0.55 * on), lw: 0.3 });
}

/** A bracket under positions a..b of xs with a label. */
function under(s: Scene, xs: number[], a: number, b: number, y: number, label: string, k: Ink): void {
  const x0 = xs[a]! - 3.2 * s.u;
  const x1 = xs[b]! + 3.2 * s.u;
  s.line(x0, y - 1.2 * s.u, x0, y, s.c(k), 0.3);
  s.line(x0, y, x1, y, s.c(k), 0.3);
  s.line(x1, y - 1.2 * s.u, x1, y, s.c(k), 0.3);
  s.text(label, (x0 + x1) / 2, y + 3.6 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c(k) });
}

const rowName = (s: Scene, t: string, x: number, y: number, k: Ink = '--ink-3') => s.text(t, x, y, { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c(k) });

const grow: SceneDef = {
  draw(s) {
    const pitch = s.tall ? 8.4 : 9;
    const xs = cols(s, s.w / 2 + 3 * s.u, pitch);
    const ys = [0.78, 0.6, 0.42, 0.24].map((f) => s.h * f);
    const lx = xs[0]! - 5 * s.u;
    const a = [1, 1, s.ease('two', 0.6), s.ease('three', 0.6)];
    // Weight of the cone whose top is layer t: one layer at a time, crossfading.
    const top = [0, 1 - s.ease('two', 0.6, 0.6), s.ease('two', 0.6, 0.6) * (1 - s.ease('three', 0.6, 0.6)), s.ease('three', 0.6, 0.6)];
    const lit = (layer: number, p: number) => top.reduce((acc, w, t) => acc + (t >= layer && Math.abs(p - 4) <= t - layer ? w : 0), 0);
    for (let L = 3; L >= 1; L--) {
      s.alpha(a[L]!, () => {
        for (let p = 0; p < N; p++) {
          const on = lit(L, p);
          if (on > 0.01) for (const q of [p - 1, p, p + 1]) if (q >= 0 && q < N) s.alpha(on, () => s.line(xs[p]!, ys[L]! + 2.2 * s.u, xs[q]!, ys[L - 1]! - (L === 1 ? 3.4 : 2.2) * s.u, s.tint('blue', 0.8), 0.3));
        }
        for (let p = 0; p < N; p++) unit(s, xs[p]!, ys[L]!, 'blue', lit(L, p));
        rowName(s, `L${L}`, lx, ys[L]!);
      });
    }
    for (let p = 0; p < N; p++) pixel(s, xs[p]!, ys[0]!, lit(0, p));
    rowName(s, 'x', lx, ys[0]!, 'orange');
    const by = ys[0]! + 5 * s.u;
    [1, 2, 3].forEach((t) => s.alpha(top[t]! * s.ease('one', 0.6, 1.2), () => under(s, xs, 4 - t, 4 + t, by, `${2 * t + 1} wide`, 'blue')));
    s.alpha(s.ease('three', 0.6, 2.5), () => s.text('L layers of 3 × 3:  1 + 2L', s.w / 2, s.h * 0.1, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') }));
  },
};

const stride: SceneDef = {
  draw(s) {
    const pitch = s.tall ? 8.4 : 9;
    const xs = cols(s, s.w / 2 + 3 * s.u, pitch);
    const ys = [0.74, 0.54, 0.32].map((f) => s.h * f);
    const lx = xs[0]! - 5 * s.u;
    const l1 = [0, 2, 4, 6, 8];
    const adds = s.ease('adds', 0.6);
    const kids = (p: number) => [p - 1, p, p + 1].filter((q) => q >= 0 && q < N);
    const litL1 = (p: number) => (p === 4 ? 1 - adds : 0) + (Math.abs(p - 4) <= 2 ? adds : 0);
    const litX = (q: number) => (Math.abs(q - 4) <= 1 ? 1 - adds : 0) + (Math.abs(q - 4) <= 3 ? adds : 0);
    for (const p of l1) {
      const on = litL1(p);
      if (on > 0.01) for (const q of kids(p)) s.alpha(on, () => s.line(xs[p]!, ys[1]! + 2.2 * s.u, xs[q]!, ys[0]! - 3.4 * s.u, s.tint('blue', 0.8), 0.3));
    }
    for (const p of l1) unit(s, xs[p]!, ys[1]!, 'blue', litL1(p));
    rowName(s, 'S = 2', lx, ys[1]!);
    for (let q = 0; q < N; q++) pixel(s, xs[q]!, ys[0]!, litX(q));
    rowName(s, 'x', lx, ys[0]!, 'orange');
    s.alpha(s.win('jump', 'adds'), () => {
      const y = ys[1]! - 5.5 * s.u;
      s.line(xs[4]!, y, xs[6]!, y, s.c('slate'), 0.35);
      s.line(xs[4]!, y - 1 * s.u, xs[4]!, y + 1 * s.u, s.c('slate'), 0.35);
      s.line(xs[6]!, y - 1 * s.u, xs[6]!, y + 1 * s.u, s.c('slate'), 0.35);
      s.text('2 pixels apart', xs[5]!, y - 3.4 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('slate') });
    });
    s.alpha(adds, () => {
      for (const p of [2, 4, 6]) s.line(xs[4]!, ys[2]! + 2.2 * s.u, xs[p]!, ys[1]! - 2.2 * s.u, s.tint('blue', 0.8), 0.3);
      unit(s, xs[4]!, ys[2]!, 'blue', 1);
      rowName(s, 'S = 1', lx, ys[2]!);
    });
    const by = ys[0]! + 5 * s.u;
    s.alpha(s.ease('jump', 0.6) * (1 - adds), () => under(s, xs, 3, 5, by, '3 wide', 'blue'));
    s.alpha(adds, () => under(s, xs, 1, 7, by, '7 wide', 'blue'));
    s.alpha(s.ease('adds', 0.6, 2), () => s.text('3 + (3 − 1) × 2 = 7', s.w / 2, s.h * 0.12, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    s.alpha(s.ease('deep', 0.6), () => s.text('small filters, a wide view', s.w / 2, s.h * 0.93, { size: 3.6, color: s.c('--ink-2') }));
  },
};

const why: SceneDef = {
  draw(s) {
    const pitch = s.tall ? 6.6 : 7.6;
    const L = cols(s, s.w * (s.tall ? 0.27 : 0.3), pitch, 5);
    const R = cols(s, s.w * (s.tall ? 0.73 : 0.7), pitch, 5);
    const [yt, ym, yx] = [0.3, 0.48, 0.66].map((f) => s.h * f);
    const title = (t: string, x: number) => s.text(t, x, s.h * 0.13, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink-2') });
    title('two 3 × 3', L[2]!);
    title('one 5 × 5', R[2]!);
    for (const p of [1, 2, 3]) {
      s.line(L[2]!, yt + 2.2 * s.u, L[p]!, ym - 2.2 * s.u, s.tint('blue', 0.8), 0.3);
      for (const q of [p - 1, p, p + 1]) s.line(L[p]!, ym + 2.2 * s.u, L[q]!, yx - 3.4 * s.u, s.tint('blue', 0.6), 0.3);
    }
    unit(s, L[2]!, yt, 'blue', 1);
    for (let p = 0; p < 5; p++) unit(s, L[p]!, ym, 'blue', p >= 1 && p <= 3 ? 1 : 0);
    for (let q = 0; q < 5; q++) s.line(R[2]!, yt + 2.2 * s.u, R[q]!, yx - 3.4 * s.u, s.tint('purple', 0.8), 0.3);
    unit(s, R[2]!, yt, 'purple', 1);
    for (let q = 0; q < 5; q++) {
      pixel(s, L[q]!, yx, 1);
      pixel(s, R[q]!, yx, 1);
    }
    s.alpha(s.ease('same', 0.6, 1), () => {
      under(s, L, 0, 4, yx + 5 * s.u, '5 wide', 'blue');
      under(s, R, 0, 4, yx + 5 * s.u, '5 wide', 'purple');
    });
    s.alpha(s.ease('fewer', 0.6, 1), () => {
      const y = s.h * 0.86;
      s.text('9 + 9 = 18 weights', L[2]!, y, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') });
      s.text('25 weights', R[2]!, y, { size: 3.4, font: 'mono', weight: 650, color: s.c('red') });
    });
    s.alpha(s.ease('more', 0.6, 1), () => s.text('3 layers, 7 × 7 view: 27 vs 49', s.w / 2, s.h * 0.93, { size: 3.2, font: 'mono', color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { grow, stride, why };