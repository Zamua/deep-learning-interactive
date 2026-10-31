import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, lerp, smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { Rng } from '../../../core/rand';
import { after, cells, columns, stacked, verdict } from '../../draw';
import { Frame, rich } from '../../networks/draw';
import { num } from '../draw';

type P = [number, number];

/** A paper's people and year, in italics, centered on (x, y). */
function cite(s: Scene, text: string, a: number, x: number, y: number) {
  s.alpha(a, () => s.text(text, x, y, { size: 3.1, italic: true, color: s.c('--ink-2'), halo: true }));
}

/** The square `poly` cut down to where `f` is at least 0: a convex polygon. */
function cut(poly: P[], f: (p: P) => number): P[] {
  const out: P[] = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    const [fp, fq] = [f(p), f(q)];
    if (fp >= 0) out.push(p);
    if (fp >= 0 !== fq >= 0) {
      const t = fp / (fp - fq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  });
  return out;
}
const R = 3;
const WINDOW: P[] = [[-R, -R], [R, -R], [R, R], [-R, R]];

// ---- the noun probe: w = (1, 2), b = -1, so the line is h₀ + 2h₁ = 1

const WN: P = [1, 2];
const BN = -1;
const scoreN = (p: P) => WN[0] * p[0] + WN[1] * p[1] + BN;
const YES: P = [1, 1];
const NO: P = [0, -1];
const near = (p: P, q: P, r: number) => Math.hypot(p[0] - q[0], p[1] - q[1]) < r;

const rng = new Rng(11);
/** Stream vectors for 24 words, alternately not-noun (0) and noun (1), each on its side of the line. */
const PTS: [number, number, number][] = [];
while (PTS.length < 24) {
  const noun = PTS.length % 2;
  const p: P = noun ? [1.3 + rng.randn() * 0.55, 1.1 + rng.randn() * 0.5] : [-1.1 + rng.randn() * 0.6, -0.9 + rng.randn() * 0.5];
  const v = scoreN(p);
  if (Math.abs(p[0]) < 2.6 && Math.abs(p[1]) < 2.6 && (noun ? v > 0.7 : v < -0.7) && !near(p, YES, 0.4) && !near(p, NO, 0.4) && PTS.every((q) => !near(p, [q[0], q[1]], 0.3))) PTS.push([p[0], p[1], noun]);
}
/** The same words with a random label each, half of them 1. */
const RAND = rng.shuffle(PTS.map((_, i) => (i < 12 ? 1 : 0)));

/** Where a big probe that memorizes RAND draws its border: the zero contour of a bump at every point. */
const WIGGLE: [P, P][] = (() => {
  const sig2 = 2 * 0.3 * 0.3;
  const f = (x: number, y: number) => PTS.reduce((t, [a, b], i) => t + (RAND[i] ? 1 : -1) * Math.exp(-((x - a) ** 2 + (y - b) ** 2) / sig2), -0.12);
  const N = 90;
  const at = (i: number) => -R + (2 * R * i) / N;
  const v = Array.from({ length: N + 1 }, (_, i) => Array.from({ length: N + 1 }, (_, j) => f(at(i), at(j))));
  const segs: [P, P][] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const c: [number, number, number][] = [[i, j, v[i]![j]!], [i + 1, j, v[i + 1]![j]!], [i + 1, j + 1, v[i + 1]![j + 1]!], [i, j + 1, v[i]![j + 1]!]];
      const hits: P[] = [];
      for (let k = 0; k < 4; k++) {
        const [ai, aj, av] = c[k]!;
        const [bi, bj, bv] = c[(k + 1) % 4]!;
        if (av >= 0 !== bv >= 0) {
          const t = av / (av - bv);
          hits.push([at(ai + t * (bi - ai)), at(aj + t * (bj - aj))]);
        }
      }
      if (hits.length >= 2) segs.push([hits[0]!, hits[1]!]);
      if (hits.length === 4) segs.push([hits[2]!, hits[3]!]);
    }
  }
  return segs;
})();

function plane(s: Scene): Frame {
  const side = stacked(s) ? Math.min(s.w - 20 * s.u, s.h * 0.64) : Math.min(s.h * 0.84, s.w * 0.5);
  const l = stacked(s) ? s.w / 2 - side / 2 : s.w * 0.05;
  const t = stacked(s) ? s.h * 0.04 : (s.h - side) / 2;
  return new Frame(s, l, t, l + side, t + side, [-R, R], [-R, R]);
}

/** The two text lines: under the plane on a narrow stage, beside it on a wide one. */
function slots(s: Scene, F: Frame) {
  const st = stacked(s);
  const x = st ? s.w / 2 : (F.r + s.w) / 2;
  const y1 = st ? F.b + 8 * s.u : s.h * 0.42;
  return { x, y1, y2: y1 + (st ? 7.5 : 9) * s.u, size: st ? 3.4 : 3.5 };
}
function say(s: Scene, F: Frame, line: 1 | 2, text: string, a: number, k: Ink = '--ink-2') {
  const T = slots(s, F);
  s.alpha(a, () => s.text(text, T.x, line === 1 ? T.y1 : T.y2, { size: T.size, font: 'mono', color: s.c(k), halo: true }));
}

function board(s: Scene, F: Frame) {
  s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
  F.axes();
}

function fill(s: Scene, F: Frame, poly: P[], k: Ink, a: number, edge = false) {
  if (poly.length < 3) return;
  const g = s.ctx;
  F.clip(() => {
    g.beginPath();
    poly.forEach(([x, y], i) => (i ? g.lineTo(F.X(x), F.Y(y)) : g.moveTo(F.X(x), F.Y(y))));
    g.closePath();
    g.fillStyle = s.tint(k, a);
    g.fill();
    if (edge) {
      g.strokeStyle = s.c('--ink-2');
      g.lineWidth = 0.45 * s.u;
      g.stroke();
    }
  });
}

/** The line n · p = c across the window. */
function lineAt(F: Frame, n: P, c: number, k: Ink, width = 0.7) {
  const len = Math.hypot(n[0], n[1]);
  const [nx, ny] = [n[0] / len, n[1] / len];
  const p0 = [nx * (c / len), ny * (c / len)];
  F.clip(() => F.seg(p0[0]! - ny * 9, p0[1]! + nx * 9, p0[0]! + ny * 9, p0[1]! - nx * 9, k, width));
}

const NOUN_SIDE = cut(WINDOW, scoreN);
const OTHER_SIDE = cut(WINDOW, (p) => -scoreN(p));

/** The fitted probe: its two sides, its line and w pointing to the nouns. */
function probeLine(s: Scene, F: Frame, o: { line: number; sides: number; w: number; wOn?: number }) {
  s.alpha(o.sides, () => {
    fill(s, F, NOUN_SIDE, 'teal', 0.1);
    fill(s, F, OTHER_SIDE, 'slate', 0.08);
  });
  s.alpha(o.line, () => lineAt(F, WN, -BN, 'purple', 0.7));
  s.alpha(o.w, () => {
    const foot: P = [-1, 1];
    const n = Math.hypot(WN[0], WN[1]);
    const tip: P = [foot[0] + (WN[0] / n) * 1.1, foot[1] + (WN[1] / n) * 1.1];
    s.arrow(F.X(foot[0]), F.Y(foot[1]), F.X(tip[0]), F.Y(tip[1]), s.c('blue'), 0.5 + 0.3 * (o.wOn ?? 0), 2);
    s.text('w', F.X(tip[0]) - 2.6 * s.u, F.Y(tip[1]) + 0.5 * s.u, { size: 3.6, font: 'mono', weight: 700, color: s.c('blue'), halo: true });
  });
}

function corners(s: Scene, F: Frame, a: number) {
  s.alpha(a, () => {
    s.text('noun', F.r - 1.5 * s.u, F.t + 3 * s.u, { size: 3.1, font: 'mono', weight: 650, align: 'right', color: s.c('teal'), halo: true });
    s.text('not a noun', F.l + 1.5 * s.u, F.b - 3 * s.u, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-2'), halo: true });
  });
}

/** The words, gray until `label` colors each by its label (`labels`, default the real ones). */
function words(s: Scene, F: Frame, label: number, o: { a?: (i: number) => number; labels?: number[] } = {}) {
  const ys = o.labels ?? PTS.map((p) => p[2]);
  PTS.forEach(([x, y], i) => {
    s.alpha(o.a?.(i) ?? 1, () => {
      F.dot(x, y, 'slate', 1.2);
      if (ys[i]) s.alpha(label, () => F.dot(x, y, 'teal', 1.2));
    });
  });
}

/** One sentence, each word with a column of stream numbers too many to read. */
const SENT = ['the', 'cat', 'sat', 'on', 'a', 'mat'];
const SHADES = SENT.map(() => Array.from({ length: 8 }, () => 0.15 + 0.7 * rng.next()));
function sentence(s: Scene, F: Frame) {
  const xs = columns(s, SENT.length, 12.5);
  const cy = (F.t + F.b) / 2;
  xs.forEach((x, i) => {
    s.cell(x - 5 * s.u, cy + 10 * s.u, 10 * s.u, 6.5 * s.u, SENT[i]!, '--ink-2', { size: 3 });
    SHADES[i]!.forEach((a, j) => s.rrect(x - 3 * s.u, cy + 5 * s.u - (j + 1) * 3.4 * s.u, 6 * s.u, 2.8 * s.u, 0.5, { fill: s.tint('slate', a) }));
  });
  s.text('…', xs[0]! - 9 * s.u, cy - 9 * s.u, { size: 4, color: s.c('--ink-3') });
}

const probe: SceneDef = {
  draw(s) {
    const F = plane(s);
    const T = slots(s, F);
    const pl = s.ease('points', 0.8);
    s.alpha(1 - pl, () => sentence(s, F));
    s.alpha(pl, () => board(s, F));
    const lab = s.ease('labels', 0.8, 1.2);
    words(s, F, lab, { a: (i) => pl * after(s, 'points', 0.35 + i * 0.015) });
    corners(s, F, lab);
    // The line swings into place as training fits it, then shows its two sides and w.
    const fit = smooth(clamp01((s.prog('line') - 0.3) / 0.55));
    const th = lerp(Math.atan2(WN[1], WN[0]) + 1.1, Math.atan2(WN[1], WN[0]), fit);
    const c = lerp(-0.7, -BN / Math.hypot(WN[0], WN[1]), fit);
    const lineA = s.ease('line', 0.6, 0.4);
    s.alpha(lineA * (1 - s.ease('score', 0.01)), () => lineAt(F, [Math.cos(th), Math.sin(th)], c, 'purple', 0.7));
    probeLine(s, F, { line: s.ease('score', 0.01), sides: s.ease('score', 0.8), w: s.ease('score', 0.6, 0.8) });
    s.alpha(s.ease('score', 0.6, 1.4), () => {
      s.text('s > 0', F.X(-1.7), F.Y(2.55), { size: 3.2, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
      s.text('s < 0', F.X(2.1), F.Y(-2.1), { size: 3.2, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
    });

    say(s, F, 1, 'is this word a noun?', s.win('ask', 'points'));
    say(s, F, 1, 'h: one point per word', s.win('points', 'labels'), 'gold');
    say(s, F, 1, 'y: each word\'s label', s.win('labels', 'line'), 'gold');
    say(s, F, 1, 'w turns it, b slides it', s.win('line', 'score') * after(s, 'line', 0.2));
    s.alpha(s.ease('score', 0.6), () => rich(s, [['s', 'purple'], [' = ', '--ink-2'], ['w', 'blue'], [' · ', '--ink-2'], ['h', 'gold'], [' + ', '--ink-2'], ['b', 'green']], T.x, T.y1, { size: T.size + 0.8, weight: 650 }));
    say(s, F, 2, 's > 0: noun', s.win('score', 'frozen'), 'purple');
    say(s, F, 2, 'frozen: only w and b train', s.win('frozen', 'history') * (1 - after(s, 'frozen', 0.42)));
    say(s, F, 2, 'measures, changes nothing', after(s, 'frozen', 0.45) * (1 - s.ease('history', 0.6)));
    cite(s, 'Alain & Bengio, 2016', s.ease('history', 0.6), T.x, T.y2);
  },
};

const score: SceneDef = {
  draw(s) {
    const F = plane(s);
    const T = slots(s, F);
    board(s, F);
    const dir = s.ease('dir', 0.6);
    probeLine(s, F, { line: 1, sides: 1, w: 1, wOn: dir });
    words(s, F, 1, { a: () => 1 - 0.55 * s.ease('yes', 0.6) });
    corners(s, F, 1);
    const pt = (p: P, k: Color, label: string, a: number, dx: number) =>
      s.alpha(a, () => {
        F.dot(p[0], p[1], k, 2);
        s.circle(F.X(p[0]), F.Y(p[1]), 3.2 * s.u, { stroke: s.c(k), lw: 0.4 });
        s.text(label, F.X(p[0]) + dx * s.u, F.Y(p[1]), { size: 3.6, font: 'mono', weight: 700, color: s.c('purple'), halo: true });
      });
    pt(YES, 'teal', '2', s.ease('yes', 0.6, 0.6), 6);
    pt(NO, 'slate', '−3', s.ease('no', 0.6, 0.6), 7);
    s.alpha(dir, () => s.text('s = 0', F.X(2.25), F.Y(-0.12), { size: 3.2, font: 'mono', weight: 650, color: s.c('purple'), halo: true }));
    s.alpha(s.ease('wb', 0.6), () => rich(s, [['w', 'blue'], [' = [1, 2]   ', '--ink-2'], ['b', 'green'], [' = −1', '--ink-2']], T.x, T.y1, { size: T.size + 0.4, weight: 600 }));
    say(s, F, 2, '1 + 2 − 1 = 2: noun', s.win('yes', 'no') * after(s, 'yes', 0.3), 'teal');
    say(s, F, 2, '0 − 2 − 1 = −3: not', s.win('no', 'dir') * after(s, 'no', 0.3));
    say(s, F, 2, 'w: a direction in the stream', dir, 'blue');
  },
};

// ---- three tenses: one row of W and one bias per class, the highest score claiming each region

const WT: P[] = [[2, 0], [-2, 2], [-1, -1]];
const BT = [-1, 0, 1];
const H: P = [1, 2];
const scoreT = (k: number, p: P) => WT[k]![0] * p[0] + WT[k]![1] * p[1] + BT[k]!;
const ST = WT.map((_, k) => scoreT(k, H));
const TENSES: { name: string; k: Color; at: P; c: P }[] = [
  { name: 'past', k: 'teal', at: [2.2, 0.5], c: [1.9, -1] },
  { name: 'present', k: 'orange', at: [-1.5, 2.6], c: [-0.6, 1.9] },
  { name: 'future', k: 'red', at: [-1.2, -2.65], c: [-1.5, -1.5] },
];
const REGIONS = WT.map((_, k) => WT.reduce((poly, _r, j) => (j === k ? poly : cut(poly, (p) => scoreT(k, p) - scoreT(j, p))), WINDOW));
const TPTS: [number, number, number][] = [];
while (TPTS.length < 24) {
  const k = TPTS.length % 3;
  const p: P = [TENSES[k]!.c[0] + rng.randn() * 0.45, TENSES[k]!.c[1] + rng.randn() * 0.45];
  const sc = WT.map((_, j) => scoreT(j, p));
  const others = sc.filter((_, j) => j !== k);
  if (Math.abs(p[0]) < 2.6 && Math.abs(p[1]) < 2.6 && sc[k]! > Math.max(...others) + 0.8 && !near(p, H, 0.6) && TPTS.every((q) => !near(p, [q[0], q[1]], 0.3))) TPTS.push([p[0], p[1], k]);
}

const classes: SceneDef = {
  draw(s) {
    const F = plane(s);
    const T = slots(s, F);
    const reg = s.ease('regions', 0.8, 1.5);
    const all = s.ease('all', 0.6, 1.5);
    REGIONS.forEach((poly, k) => s.alpha(reg, () => fill(s, F, poly, TENSES[k]!.k, k === 1 ? 0.14 + 0.12 * all : 0.14, true)));
    board(s, F);
    const pts = s.ease('three', 0.8, 0.6);
    TPTS.forEach(([x, y, k], i) => s.alpha(pts * after(s, 'three', 0.3 + i * 0.015), () => F.dot(x, y, TENSES[k]!.k, 1.2)));
    TENSES.forEach((c) => s.alpha(pts, () => s.text(c.name, F.X(c.at[0]), F.Y(c.at[1]), { size: 3.2, font: 'mono', weight: 650, color: s.c(c.k), halo: true })));
    s.alpha(s.ease('h', 0.6, 0.6), () => {
      F.dot(H[0], H[1], 'gold', 2);
      s.text('h', F.X(H[0]) + 3.4 * s.u, F.Y(H[1]) - 2 * s.u, { size: 3.8, font: 'mono', weight: 700, color: s.c('gold'), halo: true });
    });
    say(s, F, 1, 'past, present or future', s.win('three', 'regions'));
    say(s, F, 1, 'the highest score wins', s.win('regions', 'W'));
    s.alpha(s.ease('W', 0.6), () => rich(s, [['s', 'purple'], [' = ', '--ink-2'], ['W', 'blue'], ['h', 'gold'], [' + ', '--ink-2'], ['b', 'green']], T.x, T.y1, { size: T.size + 0.8, weight: 650 }));
    say(s, F, 2, 'h = [1, 2]: present', s.win('h', 'W'), 'gold');
    say(s, F, 2, 'one row of W per class', s.win('W', 'row'), 'blue');
    say(s, F, 2, 'w₀: 2·1 + 0·2 − 1 = 1', s.win('row', 'all'), 'teal');
    s.alpha(s.ease('all', 0.6, 0.4), () => {
      const runs: [string, Ink][] = [];
      ST.forEach((v, k) => {
        if (k) runs.push(['   ', '--ink-2']);
        runs.push([`${TENSES[k]!.name} ${num(v)}`, k === 1 ? 'orange' : '--ink-2']);
      });
      rich(s, runs, T.x, T.y2, { size: T.size - (stacked(s) ? 0.2 : 0.4), weight: 600 });
    });
  },
};

// ---- the test: held-out words, the probe's calls against their labels

const SCORES = [1.8, -0.6, 0.4, 2.1, -1.5, 0.7, -0.2, -1.1];
const LABELS = [1, 0, 0, 1, 0, 1, 1, 0];
const PREDS = SCORES.map((v) => (v > 0 ? 1 : 0));

const test: SceneDef = {
  draw(s) {
    const xs = columns(s, 8, s.tall ? 12.4 : 13);
    const rows: [string, string[], Color, number, number][] = [
      ['held-out words: score, s', SCORES.map((v) => num(v)), 'purple', s.h * 0.16, 1],
      ['prediction: s > 0', PREDS.map(String), 'teal', s.h * 0.38, s.ease('held', 0.6, 1.5)],
      ['label, y', LABELS.map(String), 'gold', s.h * 0.6, s.ease('count', 0.6)],
    ];
    rows.forEach(([name, vals, k, y, a]) => {
      s.alpha(a, () => {
        s.text(name, s.w / 2, y - 7.5 * s.u, { size: 3.1, color: s.c(k) });
        cells(s, xs, y, vals, k, { w: 11, h: 7.5, size: 3 });
      });
    });
    s.alpha(s.ease('count', 0.6, 1.5), () => {
      xs.forEach((x, i) => {
        const ok = PREDS[i] === LABELS[i];
        s.text(ok ? '✓' : '✗', x, s.h * 0.72, { size: 4, font: 'ui', weight: 700, color: s.c(ok ? 'green' : 'red') });
      });
    });
    s.alpha(s.ease('count', 0.6, 4), () => {
      rich(s, [['accuracy  6 / 8 = ', '--ink-2'], ['0.75', 'green'], ['   coin flip 0.5', '--ink-3']], s.w / 2, s.h * 0.86, { size: s.tall ? 3.4 : 3.8 });
    });
  },
};

// ---- what it means: present is not used, and only a simple probe's success describes the stream

function centered(s: Scene, ok: boolean, text: string, x: number, y: number, size: number) {
  const w = s.measure(text, { size }) + size * 1.4 * s.u;
  verdict(s, ok, text, x - w / 2, y, size);
}

const meaning: SceneDef = {
  draw(s) {
    const F = plane(s);
    const T = slots(s, F);
    board(s, F);
    const rnd = s.ease('random', 0.8, 1.5);
    const big = s.ease('random', 1, 4);
    const lin = s.ease('linear', 0.8);
    // Real labels and the straight line, then random labels with a border bent around every word.
    s.alpha(1 - rnd + lin, () => probeLine(s, F, { line: 1, sides: 1 - rnd + lin, w: 0 }));
    s.alpha(1 - rnd, () => words(s, F, 1));
    s.alpha(rnd, () => words(s, F, 1, { labels: RAND }));
    s.alpha(big * (1 - 0.7 * lin), () => F.clip(() => WIGGLE.forEach(([p, q]) => F.seg(p[0], p[1], q[0], q[1], 'purple', 0.55))));
    const sz = T.size;
    s.alpha(s.win('there', 'random'), () => centered(s, true, 'in the stream, linearly', T.x, T.y1, sz));
    s.alpha(s.win('use', 'random'), () => centered(s, false, 'used by it? not shown', T.x, T.y2, sz));
    say(s, F, 1, 'a random label per word', s.win('random', 'linear'));
    cite(s, 'Hewitt & Liang, 2019', s.win('random', 'linear'), T.x, T.y2);
    say(s, F, 1, 'random: MLP 93%, line 71%', s.ease('linear', 0.6), 'purple');
    say(s, F, 2, 'real labels: both about 97%', after(s, 'linear', 0.1) * (1 - after(s, 'linear', 0.42)));
    say(s, F, 2, 'a line barely memorizes', after(s, 'linear', 0.45));
  },
};

export const scenes: Record<string, SceneDef> = { probe, score, classes, test, meaning };
