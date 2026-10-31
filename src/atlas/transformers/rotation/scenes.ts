import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { cite } from '../../draw';
import { rich } from '../../linear-algebra/draw';

const RAD = Math.PI / 180;
const Q: [number, number] = [2, 1];
const K: [number, number] = [1, 1];
const angOf = (p: readonly number[]) => Math.atan2(p[1]!, p[0]!) / RAD;
const lenOf = (p: readonly number[]) => Math.hypot(p[0]!, p[1]!);
/** [x, y] turned by `a` degrees. */
const turn = (p: readonly number[], a: number): [number, number] => {
  const c = Math.cos(a * RAD);
  const n = Math.sin(a * RAD);
  return [p[0]! * c - p[1]! * n, p[0]! * n + p[1]! * c];
};

/** Plane coordinates on the stage. */
interface Plane {
  P(x: number, y: number): [number, number];
  k: number;
}

/** The plane above the text unless the stage is wide enough to hold them side by side; `row(i)` is the i-th text line. */
function layout(s: Scene) {
  const u = s.u;
  const tall = s.tall || s.w / s.h < 1.45;
  return {
    tall,
    rect: tall ? [4 * u, 3 * u, s.w - 4 * u, s.h * 0.69] : [4 * u, 5 * u, s.w * 0.56, s.h - 5 * u],
    tx: tall ? s.w / 2 : (s.w * 0.56 + s.w) / 2,
    room: tall ? s.w - 10 * u : s.w * 0.44 - 8 * u,
    row: (i: number) => (tall ? s.h * 0.75 + i * 6.2 * u : s.h * 0.3 + i * 8.5 * u),
  };
}

/** A plane fitted into the layout's rect showing `box` = [x0, x1, y0, y1], with its two axes. */
function fit(s: Scene, box: [number, number, number, number]): Plane {
  const [l, t, r, b] = layout(s).rect as [number, number, number, number];
  const [x0, x1, y0, y1] = box;
  const k = Math.min((r - l) / (x1 - x0), (b - t) / (y1 - y0));
  const ox = (l + r) / 2 - ((x0 + x1) / 2) * k;
  const oy = (t + b) / 2 + ((y0 + y1) / 2) * k;
  const P = (x: number, y: number): [number, number] => [ox + x * k, oy - y * k];
  s.line(...P(x0, 0), ...P(x1, 0), s.c('--axis'), 0.3);
  s.line(...P(0, y0), ...P(0, y1), s.c('--axis'), 0.3);
  return { P, k };
}

const lab = { size: 3.3, font: 'mono' as const, weight: 650, halo: true };
const mono = { size: 3.4, font: 'mono' as const, weight: 600 };

/** An arrow between two plane points. */
function arrow(s: Scene, F: Plane, a: readonly number[], b: readonly number[], k: Ink, width = 0.7): void {
  s.arrow(...F.P(a[0]!, a[1]!), ...F.P(b[0]!, b[1]!), s.c(k), width, 3);
}

/** A label `push` plane units past the tip of the arrow from the origin to p. */
function tipLabel(s: Scene, F: Plane, p: readonly number[], text: string, k: Ink, push = 0.42, size = 3.3): void {
  const r = lenOf(p) || 1;
  const d = (r + push) / r;
  s.text(text, ...F.P(p[0]! * d, p[1]! * d), { ...lab, size, color: s.c(k) });
}

/** An arc round the origin from a0 to a1 degrees, radius r, with a label at its middle. */
function arc(s: Scene, F: Plane, r: number, a0: number, a1: number, k: Ink, label?: string, o: { lw?: number; head?: boolean; lr?: number } = {}): void {
  if (Math.abs(a1 - a0) < 0.5) return;
  const [ox, oy] = F.P(0, 0);
  const c = s.ctx;
  c.beginPath();
  c.arc(ox, oy, r * F.k, -a0 * RAD, -a1 * RAD, a1 > a0);
  c.strokeStyle = s.tint(k, 0.85);
  c.lineWidth = (o.lw ?? 0.35) * s.u;
  c.stroke();
  if (o.head) {
    // A small arrowhead at a1, pointing the way the arc turns.
    const e = F.P(r * Math.cos(a1 * RAD), r * Math.sin(a1 * RAD));
    const dir = Math.sign(a1 - a0);
    const tx = -Math.sin(a1 * RAD) * dir;
    const ty = -Math.cos(a1 * RAD) * dir;
    const h = 1.6 * s.u;
    s.line(e[0], e[1], e[0] - tx * h - ty * h * 0.6, e[1] - ty * h + tx * h * 0.6, s.tint(k, 0.85), o.lw ?? 0.35);
    s.line(e[0], e[1], e[0] - tx * h + ty * h * 0.6, e[1] - ty * h - tx * h * 0.6, s.tint(k, 0.85), o.lw ?? 0.35);
  }
  if (label) {
    const m = ((a0 + a1) / 2) * RAD;
    const lr = r + (o.lr ?? 0.3);
    s.text(label, ...F.P(lr * Math.cos(m), lr * Math.sin(m)), { ...lab, size: 3, color: s.c(k) });
  }
}

/** A dashed circle round the origin. */
function ring(s: Scene, F: Plane, r: number, k: Ink, a: number, from = 0, to = 360): void {
  s.alpha(a, () => {
    const [ox, oy] = F.P(0, 0);
    const c = s.ctx;
    c.save();
    c.setLineDash([0.8 * s.u, 0.8 * s.u]);
    c.beginPath();
    c.arc(ox, oy, r * F.k, -from * RAD, -to * RAD, true);
    c.strokeStyle = s.tint(k, 0.55);
    c.lineWidth = 0.3 * s.u;
    c.stroke();
    c.restore();
  });
}

/** A line of text in the layout's text area, shrunk if it would not fit. */
function say(s: Scene, i: number, runs: [string, Ink][], a = 1, size = 3.6): void {
  if (a <= 0.003) return;
  const L = layout(s);
  const w = s.measure(runs.map(([t]) => t).join(''), { ...mono, size });
  const fitted = w > L.room ? (size * L.room) / w : size;
  s.alpha(a, () => rich(s, runs, L.tx, L.row(i), { ...mono, size: fitted }));
}

const fmt = (v: number) => (Math.abs(v) < 0.05 ? '0.0' : v.toFixed(1)).replace('-', '−');

// ---- turning an arrow: the score with q changes, the length does not

const turnScene: SceneDef = {
  draw(s) {
    const F = fit(s, [-1.7, 2.7, -1.7, 2.5]);
    // k sweeps once round while the score is read, its tip on a circle.
    const sweep = s.ease('spin', 0.3) > 0 ? 360 * smoothSpan(s) : 0;
    const kA = angOf(K) + sweep;
    const kp: [number, number] = [lenOf(K) * Math.cos(kA * RAD), lenOf(K) * Math.sin(kA * RAD)];
    const score = Q[0] * kp[0] + Q[1] * kp[1];
    const kOn = s.ease('key', 0.6) * (1 - s.ease('quarter', 0.6));
    // Spokes, for the wheel.
    s.alpha(s.win('name', 'quarter') * 0.5, () => {
      for (let i = 0; i < 8; i++) arrowless(s, F, [0, 0], turn([lenOf(K), 0], i * 45), '--ink-3');
    });
    ring(s, F, lenOf(K), 'purple', s.ease('length', 0.8) * (1 - s.ease('quarter', 0.6)));
    s.alpha(kOn, () => {
      arrow(s, F, [0, 0], kp, 'purple');
      tipLabel(s, F, kp, 'k', 'purple', 0.3, 3.8);
    });

    // q, then its quarter turn as a path of steps.
    const qa = s.ease('pair', 0.6);
    const th = 90 * s.ease('steps', 1.6, 0.6);
    const pathA = s.ease('path', 0.6);
    s.alpha(qa * pathA * Math.min(1, th / 20) * 0.35, () => {
      // Where q and its path started.
      s.line(...F.P(0, 0), ...F.P(2, 0), s.c('--ink-3'), 0.4);
      s.line(...F.P(2, 0), ...F.P(2, 1), s.c('--ink-3'), 0.4);
      arrow(s, F, [0, 0], Q, '--ink-3', 0.4);
    });
    s.alpha(qa, () => {
      s.alpha(s.win('quarter', 'steps'), () => arc(s, F, 0.9, angOf(Q), angOf(Q) + 90, 'slate', '90°', { head: true }));
      s.alpha(pathA, () => {
        const c = turn([2, 0], th);
        const e = turn(Q, th);
        s.line(...F.P(0, 0), ...F.P(c[0], c[1]), s.c('blue'), 0.9);
        s.line(...F.P(c[0], c[1]), ...F.P(e[0], e[1]), s.c('gold'), 0.9);
        const done = th > 85;
        const across = done ? '2 up' : th < 5 ? '2 across' : '';
        const up = done ? '1 left' : th < 5 ? '1 up' : '';
        if (across) s.text(across, ...(done ? F.P(0.32, 1.0) : F.P(1.0, -0.28)), { ...lab, align: done ? 'left' : 'center', color: s.c('blue') });
        if (up) s.text(up, ...(done ? F.P(-0.5, 2.3) : F.P(2.12, 0.5)), { ...lab, align: done ? 'center' : 'left', color: s.c('gold') });
      });
      const e = turn(Q, th);
      arrow(s, F, [0, 0], e, 'teal');
      if (th > 85) s.text('[−1, 2]', ...F.P(-1.12, 2.0), { ...lab, align: 'right', color: s.c('teal') });
      else if (th < 5) tipLabel(s, F, e, pathA > 0.5 ? '[2, 1]' : 'q', 'teal', pathA > 0.5 ? 0.55 : 0.3, pathA > 0.5 ? 3.3 : 3.8);
    });

    // The text: the pairs and their score, then the turn.
    say(s, 0, [['q = [2, 1]', 'teal']], s.win('pair', 'spin'));
    say(s, 1, [['k = [1, 1]', 'purple']], s.win('key', 'spin'));
    say(s, 2, [['q · k = 2 + 1 = 3', '--ink-2']], after(s, 'key', 0.45) * (1 - s.ease('spin', 0.5)));
    const live = s.win('spin', 'quarter');
    const sk: Ink = score > 0.15 ? 'green' : score < -0.15 ? 'red' : 'slate';
    say(s, 0, [['score q · k = ', '--ink-2'], [fmt(score), sk]], live, 3.8);
    say(s, 1, [['‖k‖ ≈ 1.41, all the way round', 'purple']], s.win('length', 'quarter'));
    say(s, 2, [['rotation: from rota, a wheel', '--ink-2']], s.win('name', 'quarter'));
    say(s, 0, [['90°, counterclockwise', 'slate']], s.win('quarter', 'swap'));
    say(s, 1, [['from across toward up', '--ink-3']], s.win('quarter', 'path'));
    say(s, 1, [['2 across, 1 up', '--ink-2']], s.win('path', 'steps'));
    say(s, 1, [['[2, 1] → [−1, 2]', 'teal']], s.ease('steps', 0.6, 2.2));
    say(s, 2, [['[a, b] → [−b, a]', '--ink']], s.ease('swap', 0.6, 0.8), 4.2);
  },
};

/** The sweep's progress: eased from the start of `spin` to the start of `name`. */
function smoothSpan(s: Scene): number {
  const v = s.span('spin', 'name');
  return v * v * (3 - 2 * v);
}

/** Eased 0 -> 1 starting a fraction `f` of the way through beat `id`. */
function after(s: Scene, id: string, f: number, dur = 0.5): number {
  const v = (s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur;
  const x = v < 0 ? 0 : v > 1 ? 1 : v;
  return x * x * (3 - 2 * x);
}

/** A plain segment between two plane points. */
function arrowless(s: Scene, F: Plane, a: readonly number[], b: readonly number[], k: Ink): void {
  s.line(...F.P(a[0]!, a[1]!), ...F.P(b[0]!, b[1]!), s.tint(k, 0.6), 0.3);
}

// ---- an arrow of length one: its tip is (cos, sin)

/** The unit arrow's angle: out to 60°, up to 90° and back, then held. */
function unitAngle(s: Scene): number {
  return 60 * s.ease('tip', 1.4, 0.8) + 30 * s.ease('ninety', 1, 0.6) - 30 * s.ease('gunter', 1);
}

const unit: SceneDef = {
  draw(s) {
    const F = fit(s, [-1.3, 1.4, -0.35, 1.3]);
    ring(s, F, 1, '--ink-3', 1, 0, 180);
    const a = unitAngle(s);
    const tip: [number, number] = [Math.cos(a * RAD), Math.sin(a * RAD)];
    // Measured from straight up, for the complement.
    const comp = s.win('complement', 'lookup');
    s.alpha(comp, () => {
      s.line(...F.P(0, 0), ...F.P(0, 1.18), s.tint('gold', 0.8), 0.5, [0.9, 0.7]);
      arc(s, F, 0.55, 90, a, 'gold', '30°', { lr: 0.2 });
    });
    const cosA = s.ease('cos', 0.6);
    const sinA = s.ease('sin', 0.6);
    s.alpha(cosA, () => {
      s.line(...F.P(tip[0], tip[1]), ...F.P(tip[0], 0), s.tint('--ink-3', 0.8), 0.3, [0.8, 0.8]);
      s.line(...F.P(0, 0), ...F.P(tip[0], 0), s.c('blue'), 1.1);
      const cx = Math.max(tip[0] / 2, 0.08);
      s.text(comp > 0.5 ? 'sin 30°' : 'cos', ...F.P(cx, -0.17), { ...lab, color: s.c('blue') });
    });
    s.alpha(sinA, () => {
      s.line(...F.P(tip[0], 0), ...F.P(tip[0], tip[1]), s.c('gold'), 1.1);
      s.text('sin', ...F.P(tip[0] + 0.08, tip[1] / 2), { ...lab, align: 'left', color: s.c('gold') });
    });
    s.alpha(1 - comp, () => arc(s, F, 0.22, 0, a, 'slate', a > 8 ? `${Math.round(a)}°` : undefined, { lr: 0.17 }));
    s.arrow(...F.P(0, 0), ...F.P(tip[0], tip[1]), s.c('--ink'), 0.7, 3);
    s.alpha(1 - s.ease('tip', 0.4, 0.8), () => s.text('[1, 0]', ...F.P(1.0, -0.17), { ...lab, color: s.c('--ink-2') }));
    s.alpha(s.win('one', 'tip'), () => s.text('length 1', ...F.P(0.5, 0.14), { ...lab, color: s.c('--ink-3') }));

    // The values, then the name, then the table.
    const at90 = s.ease('ninety', 0.5, 1.2) * (1 - s.ease('gunter', 0.5));
    const vals = 1 - s.ease('lookup', 0.5);
    say(s, 0, [['cos 60° = 0.5', 'blue']], cosA * (1 - at90) * vals);
    say(s, 1, [['sin 60° ≈ 0.87', 'gold']], sinA * (1 - at90) * vals);
    say(s, 0, [['cos 90° = 0', 'blue']], at90);
    say(s, 1, [['sin 90° = 1', 'gold']], at90);
    say(s, 2, [['cosine: the complement\'s sine', '--ink-2']], s.win('gunter', 'complement'));
    say(s, 2, [['cos 60° = ', 'blue'], ['sin 30°', 'gold'], [' = 0.5', '--ink-2']], comp);
    cite(s, 'Gunter, Canon triangulorum, 1620', s.win('gunter', 'lookup'));
    const tb = s.ease('lookup', 0.6, 0.3);
    s.alpha(tb, () => {
      const L = layout(s);
      const cols = [-15, 0, 15].map((d) => L.tx + d * s.u);
      const step = L.tall ? 5.4 * s.u : 6.5 * s.u;
      const y0 = L.row(0) - (L.tall ? 1.5 * s.u : 0);
      (['angle', 'cos', 'sin'] as const).forEach((t, i) => s.text(t, cols[i]!, y0, { ...mono, size: 3.2, color: s.c(i === 0 ? '--ink-3' : i === 1 ? 'blue' : 'gold') }));
      [['30°', '0.87', '0.5'], ['60°', '0.5', '0.87'], ['90°', '0', '1']].forEach((r, j) =>
        r.forEach((t, i) => s.text(t, cols[i]!, y0 + (j + 1) * step, { ...mono, size: 3.2, color: s.c(i === 0 ? '--ink-2' : '--ink') })),
      );
    });
  },
};

// ---- any pair: a steps along [1, 0] and b steps along [0, 1], turned together

const RULE = String.raw`[a,\ b] \;\to\; [\,a\cos{} - b\sin{},\ \ a\sin{} + b\cos{}\,]`;

/** Where the rule's TeX sits: on row `i` of the text area, as fractions of the stage. */
function rulePos(s: Scene, i: number): { x: number; y: number } {
  const L = layout(s);
  return { x: L.tx / s.w, y: L.row(i) / s.h };
}

function ruleAngle(s: Scene): number {
  return 60 * s.ease('both', 1.6, 0.6) + 30 * s.ease('check', 1.2, 0.4);
}

const rule: SceneDef = {
  marks: { rule: { tex: RULE, x: 0.5, y: 0.5, size: 3.6 } },
  draw(s) {
    const F = fit(s, [-1.4, 2.6, -0.45, 2.6]);
    const th = ruleAngle(s);
    const u1 = turn([1, 0], th);
    const u2 = turn([0, 1], th);
    const [a, b] = Q;
    const mid: [number, number] = [a * u1[0], a * u1[1]];
    const end: [number, number] = [mid[0] + b * u2[0], mid[1] + b * u2[1]];
    // Where the path started, once it has turned.
    s.alpha(Math.min(1, th / 15) * 0.35, () => {
      s.line(...F.P(0, 0), ...F.P(2, 0), s.c('--ink-3'), 0.4);
      s.line(...F.P(2, 0), ...F.P(2, 1), s.c('--ink-3'), 0.4);
      arrow(s, F, [0, 0], Q, '--ink-3', 0.4);
    });
    s.alpha(after(s, 'both', 0.3) * (1 - s.ease('check', 0.4)), () => arc(s, F, 0.45, 0, th, 'slate', th > 50 ? `${Math.round(th)}°` : undefined));
    // The path: a pieces of the turned [1, 0], then b of the turned [0, 1].
    s.line(...F.P(0, 0), ...F.P(mid[0], mid[1]), s.tint('blue', 0.55), 0.9);
    s.line(...F.P(mid[0], mid[1]), ...F.P(end[0], end[1]), s.c('gold'), 0.9);
    const tick = F.P(u1[0], u1[1]);
    s.circle(tick[0], tick[1], 0.7 * s.u, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.3 });
    arrow(s, F, [0, 0], end, 'teal');
    const tipName = th < 3 ? '[2, 1]' : th > 87 ? '[−1, 2]' : '';
    if (tipName) tipLabel(s, F, end, tipName, 'teal', 0.5);
    s.alpha(1 - s.ease('both', 0.4), () => {
      s.text('a = 2', ...F.P(1.0, -0.28), { ...lab, color: s.c('blue') });
      s.text('b = 1', ...F.P(2.12, 0.5), { ...lab, align: 'left', color: s.c('gold') });
    });
    // The two unit arrows from the origin.
    arrow(s, F, [0, 0], u1, 'blue', 0.9);
    const upA = s.ease('split', 0.6, 1.2);
    const u2t = turn([0, 1], th * s.ease('up', 1.4, 1.2));
    const upTurned = s.ease('up', 0.5, 0.2);
    s.alpha(upA, () => arrow(s, F, [0, 0], upTurned > 0 ? u2t : [0, 1], 'gold', 0.9));
    s.alpha(1 - s.ease('both', 0.4), () => s.text('[1, 0]', ...F.P(1.0, 0.2), { ...lab, color: s.c('blue') }));
    s.alpha(upA * (1 - s.ease('up', 0.4, 1.2)), () => s.text('[0, 1]', ...F.P(-0.1, 1.08), { ...lab, align: 'right', color: s.c('gold') }));
    // [cos, sin] sits just right of the turned [1, 0], off the path.
    const side: [number, number] = [u1[0] + 0.28 * u1[1], u1[1] - 0.28 * u1[0]];
    s.alpha(after(s, 'both', 0.55) * (1 - s.ease('check', 0.4)), () => s.text('[cos, sin]', ...F.P(side[0], side[1]), { ...lab, size: 3.1, align: 'left', color: s.c('blue') }));
    s.alpha(after(s, 'up', 0.55) * (1 - s.ease('check', 0.4)), () => s.text('[−sin, cos]', ...F.P(u2[0] - 0.05, u2[1] + 0.22), { ...lab, size: 3.1, color: s.c('gold') }));

    // The text.
    const lines = 1 - s.ease('rule', 0.5);
    say(s, 0, [['[a, b] = a·', '--ink-2'], ['[1, 0]', 'blue'], [' + b·', '--ink-2'], ['[0, 1]', 'gold']], s.ease('split', 0.6, 0.8) * lines, 3.3);
    say(s, 1, [['[1, 0] → ', 'blue'], ['[cos, sin]', 'blue']], after(s, 'both', 0.55) * lines, 3.3);
    say(s, 2, [['[0, 1] → ', 'gold'], ['[−sin, cos]', 'gold']], after(s, 'up', 0.55) * lines, 3.3);
    say(s, 0, [['a·', '--ink-2'], ['[cos, sin]', 'blue'], [' + b·', '--ink-2'], ['[−sin, cos]', 'gold']], s.ease('rule', 0.6, 0.3), 3.3);
    s.show('rule', s.ease('rule', 0.6, 4), rulePos(s, 1.2));
    say(s, 2.4, [['90°: cos 0, sin 1 → [−b, a]', '--ink-2']], s.ease('check', 0.6, 1.5), 3.3);
  },
};

// ---- a turn, worked

const tryIt: SceneDef = {
  marks: { rule: { tex: RULE, x: 0.5, y: 0.5, size: 3.6 } },
  draw(s) {
    const F = fit(s, [-1.1, 1.8, -0.3, 1.85]);
    const k0 = angOf(K);
    const sw = s.ease('p', 1.4, 2.5);
    const kp = turn(K, 60 * sw);
    ring(s, F, lenOf(K), 'purple', 0.6 * s.ease('done', 0.8, 0.8), 30, 120);
    arrow(s, F, [0, 0], K, '--ink-3', 0.4);
    tipLabel(s, F, K, 'k = [1, 1]', '--ink-2', 0.55, 3.1);
    arc(s, F, 0.5, k0, k0 + 60 * sw, 'slate', sw > 0.9 ? '60°' : undefined);
    arrow(s, F, [0, 0], kp, 'purple');
    const tip = sw < 0.95 ? '' : s.ease('done', 0.6) > 0.5 ? '[−0.37, 1.37]' : '?';
    if (tip) tipLabel(s, F, kp, tip, 'purple', tip === '?' ? 0.3 : 0.4);

    s.show('rule', 1, rulePos(s, 0));
    const done = s.ease('done', 0.6);
    say(s, 1, [['cos 60° = 0.5', 'blue'], ['   ', '--ink-2'], ['sin 60° ≈ 0.87', 'gold']], s.ease('p', 0.6, 4) * (1 - done), 3.3);
    say(s, 2, [['1×0.5 − 1×0.87 ≈ ', '--ink-2'], ['−0.37', 'purple']], s.ease('first', 0.6), 3.3);
    say(s, 3, [['1×0.87 + 1×0.5 ≈ ', '--ink-2'], ['1.37', 'purple']], s.ease('second', 0.6), 3.3);
    say(s, 1, [['k → ', 'purple'], ['[−0.37, 1.37]', '--ink']], s.ease('done', 0.6, 0.3), 3.6);
  },
};

export const scenes: Record<string, SceneDef> = { turn: turnScene, unit, rule, try: tryIt };
