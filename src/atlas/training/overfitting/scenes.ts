import { clamp01, type Ink, lerp, type Scene, type SceneDef } from '../../../lecture/scene';
import { after } from '../../draw';
import { caption, Frame } from '../../networks/draw';
import { axes, curve, frame } from '../../optimization/draw';
import { key, xTicks, yTicks } from '../draw';

// The fit: eight noisy examples of a gentle pattern, and a curve that goes from flat, to the
// pattern, to an exact fit through every dot (the pattern plus a polynomial through the leftovers).
const pattern = (x: number) => 1 + 0.8 * Math.sin(0.5 * x - 0.6);
const XS = [0.8, 2, 3.2, 4.4, 5.6, 6.8, 8, 9.2];
const QUIRK = [0.28, -0.22, 0.3, 0.12, -0.3, 0.26, -0.18, 0.24];
const YS = XS.map((x, i) => pattern(x) + QUIRK[i]!);
const NX = [1.4, 2.6, 5, 6.2, 7.4, 8.6];
const NY = NX.map((x, i) => pattern(x) + [-0.1, 0.12, 0.08, -0.12, 0.1, -0.06][i]!);
const MEAN = YS.reduce((a, b) => a + b) / YS.length;
const wiggle = (x: number) => XS.reduce((acc, xi, i) => acc + QUIRK[i]! * XS.reduce((p, xj, j) => (j === i ? p : (p * (x - xj)) / (xi - xj)), 1), 0);
const mse = (xs: number[], ys: number[], f: (x: number) => number) => xs.reduce((a, x, i) => a + (f(x) - ys[i]!) ** 2, 0) / xs.length;

/** The model's curve at this moment: flat, then bent toward the pattern by training, then through every dot. */
function model(s: Scene): (x: number) => number {
  const a = s.ease('train', 2.6, 0.8);
  const b = s.ease('wiggle', 3, 1.2);
  const span = Math.max(1, s.end('weights') - s.at('weights') - 0.6);
  const amp = Math.sin(Math.PI * clamp01((s.since('weights') - 0.6) / span));
  const ph = s.since('weights');
  return (x) => MEAN + a * (pattern(x) - MEAN) + b * wiggle(x) + amp * (0.45 * Math.sin(0.65 * x + 1.7 * ph) + 0.07 * (x - 5) * Math.cos(1.2 * ph));
}

const fit: SceneDef = {
  draw(s) {
    const F = new Frame(s, 10 * s.u, s.h * 0.08, s.w - 6 * s.u, s.h * 0.8, [0, 10], [-0.65, 2.4]);
    axes(s, F, 'input', 'answer', { x: '--ink-3', y: '--ink-3' });
    const f = model(s);
    const grow = s.ease('model', 1.2, 0.3);
    // The plain pattern, for comparison once the new examples arrive.
    s.alpha(0.55 * s.ease('new', 0.6, 2.5), () => F.fn(pattern, '--ink-3', 0.45, 0.6, 9.3, [1.2, 1]));
    const sticks = s.ease('miss', 0.6, 1);
    s.alpha(sticks, () => XS.forEach((x, i) => F.seg(x, YS[i]!, x, f(x), 'red', 0.45)));
    const fresh = s.ease('new', 0.6, 0.4);
    s.alpha(fresh * s.ease('new', 0.6, 2), () => NX.forEach((x, i) => F.seg(x, NY[i]!, x, f(x), 'gold', 0.45)));
    if (grow > 0) F.fn(f, 'purple', 0.7, 0.6, 0.6 + 8.7 * grow);
    XS.forEach((x, i) => s.alpha(s.ease('dots', 0.4, 2.5 + 0.25 * i), () => F.dot(x, YS[i]!, 'blue', 1.5)));
    NX.forEach((x, i) => s.alpha(s.ease('new', 0.4, 0.4 + 0.15 * i), () => s.circle(F.X(x), F.Y(NY[i]!), 1.4 * s.u, { fill: s.c('--card'), stroke: s.c('gold'), lw: 0.5 })));
    const rx = F.r - 1 * s.u;
    s.alpha(s.ease('loss', 0.6, 1), () => s.text(`L = ${mse(XS, YS, f).toFixed(2)}`, rx, F.t + 2 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true }));
    s.alpha(s.ease('new', 0.6, 2), () => s.text(`L_new = ${mse(NX, NY, f).toFixed(2)}`, rx, F.t + 7 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('gold'), halo: true }));
    const cy = s.h * 0.92;
    s.alpha(s.win('dots', 'model'), () => caption(s, 'each dot: an input and its right answer', cy, 'blue', 3.4));
    s.alpha(s.win('model', 'miss'), () => caption(s, 'the model: input → guess', cy, 'purple', 3.4));
    s.alpha(s.win('miss', 'train'), () => caption(s, 'L: the average squared miss', cy, 'red', 3.4));
    s.alpha(s.win('train', 'new'), () => caption(s, 'training: step w downhill on L', cy, '--ink-2', 3.4));
    s.alpha(s.win('new', 'name'), () => caption(s, 'hollow dots: new examples', cy, 'gold', 3.4));
    s.alpha(s.ease('name', 0.6), () => caption(s, 'overfitting: zero loss, bad on new data', cy, 'red', 3.4));
  },
};

const T = (e: number) => 2.3 * 0.84 ** e;
const V = (e: number) => T(e) + 0.05 + 0.007 * e * e;

const curves: SceneDef = {
  draw(s) {
    const F = frame(12 * s.u, s.h * 0.1, s.w - 8 * s.u, s.h - 10 * s.u, [0, 16], [0, 2.5]);
    axes(s, F, 'epoch', 'L', { x: '--ink-3', y: 'red' });
    xTicks(s, F, [4, 8, 12]);
    let kx = F.X(4.2);
    kx = key(s, kx, F.t + 2 * s.u, 'blue', 'train');
    key(s, kx, F.t + 2 * s.u, 'gold', 'val');
    // Twelve examples; three step aside to be held back.
    s.alpha(1 - s.ease('both', 0.6), () => {
      const n = 12;
      const gap = (s.tall ? 6.4 : 6) * s.u;
      const y = s.h * 0.42;
      const move = s.ease('hold', 0.8, 1.5);
      for (let i = 0; i < n; i++) {
        const held = i >= 9;
        const x = s.w / 2 + (i - (n - 1) / 2) * gap + (held ? 2.5 * s.u * move : 0);
        const yy = y + (held ? 9 * s.u * move : 0);
        const k = held && move > 0.5 ? 'gold' : 'blue';
        s.circle(x, yy, 1.6 * s.u, { fill: s.c(k), stroke: s.c('--card'), lw: 0.35 });
      }
      s.alpha(move, () => {
        s.text('trains', s.w / 2 - 1.5 * gap, y + 6 * s.u, { size: 3.2, font: 'mono', color: s.c('blue') });
        s.text('held back', s.w / 2 + 4.5 * gap, y + 15 * s.u, { size: 3.2, font: 'mono', color: s.c('gold') });
      });
      s.alpha(s.ease('val', 0.6, 1), () => s.text('validation: checks the model', s.w / 2 + 4.5 * gap, y + 20.5 * s.u, { size: 3.2, align: 'right', color: s.c('--ink-2') }));
    });
    const e = s.ease('both', 1) + 6 * s.ease('early', 3, 0.3) + 9 * s.ease('gap', 4, 0.3);
    s.alpha(s.ease('blind', 0.8), () => {
      // The gap between the curves, shaded where it widens.
      const c = s.ctx;
      c.beginPath();
      for (let x = 7.5; x <= 16; x += 0.25) c.lineTo(F.X(x), F.Y(V(x)));
      for (let x = 16; x >= 7.5; x -= 0.25) c.lineTo(F.X(x), F.Y(T(x)));
      c.closePath();
      c.fillStyle = s.tint('red', 0.1);
      c.fill();
      s.text('overfitting', F.X(13), F.Y((T(13) + V(13)) / 2), { size: 3.6, weight: 600, color: s.c('red'), halo: true });
    });
    curve(s, F, T, 0, 16, 'blue', { upto: e / 16 });
    curve(s, F, V, 0, 16, 'gold', { upto: e / 16 });
    s.alpha(s.ease('gap', 0.6, 4.3), () => {
      s.circle(F.X(7.6), F.Y(V(7.6)), 1.2 * s.u, { fill: s.c('gold') });
      s.text('lowest', F.X(7.6), F.Y(V(7.6)) + 4.5 * s.u, { size: 3.2, font: 'mono', color: s.c('gold'), halo: true });
    });
    s.alpha(after(s, 'gap', 0.75), () => s.text('still falling', F.X(16) - 1 * s.u, F.Y(T(16)) - 4 * s.u, { size: 3.2, font: 'mono', align: 'right', color: s.c('blue'), halo: true }));
  },
};

const SPLITS = [
  { name: 'train', n: '40,000', from: 0, to: 0.8, k: 'blue', role: 'fits the weights', beat: 'train' },
  { name: 'val', n: '5,000', from: 0.8, to: 0.9, k: 'gold', role: 'makes the choices', beat: 'val' },
  { name: 'test', n: '5,000', from: 0.9, to: 1, k: 'teal', role: 'reports once, at the end', beat: 'test' },
] as const;

const splits: SceneDef = {
  draw(s) {
    const l = 8 * s.u;
    const r = s.w - 8 * s.u;
    const y = s.h * 0.22;
    const bh = 11 * s.u;
    const X = (f: number) => l + (r - l) * f;
    s.alpha(s.ease('data', 0.6), () => {
      s.text('50,000 examples', s.w / 2, y - bh / 2 - 5 * s.u, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') });
      s.rrect(l, y - bh / 2, r - l, bh, 1.2, { fill: s.tint('--ink-3', 0.15), stroke: s.tint('--ink-3', 0.5), lw: 0.3 });
    });
    const roles = 1 - s.ease('rest', 0.6);
    SPLITS.forEach((p, i) => {
      s.alpha(s.ease(p.beat, 0.6), () => {
        s.rrect(X(p.from) + 0.3 * s.u, y - bh / 2, X(p.to) - X(p.from) - 0.6 * s.u, bh, 1, { fill: s.tint(p.k, 0.35), stroke: s.c(p.k), lw: 0.35 });
        if (i === 0) s.text(`train  ${p.n}`, (X(p.from) + X(p.to)) / 2, y, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink') });
        else {
          const cx = (X(p.from) + X(p.to)) / 2;
          const ly = y + bh / 2 + (i === 1 ? 5 : 11) * s.u;
          s.line(cx, y + bh / 2 + 0.6 * s.u, cx, ly - 2 * s.u, s.c(p.k), 0.3);
          s.text(`${p.name}  ${p.n}`, cx + 1 * s.u, ly, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c(p.k) });
        }
      });
      s.alpha(roles * s.ease(p.beat, 0.6, 1), () => {
        const ry = s.h * (0.56 + 0.13 * i);
        const nx = s.w / 2 - (s.tall ? 20 : 26) * s.u;
        s.rrect(nx - 15 * s.u, ry - 3.5 * s.u, 15 * s.u, 7 * s.u, 1, { fill: s.tint(p.k, 0.25), stroke: s.c(p.k), lw: 0.3 });
        s.text(p.name, nx - 7.5 * s.u, ry, { size: 3.4, font: 'mono', weight: 650, color: s.c(p.k) });
        s.text(p.role, nx + 3 * s.u, ry, { size: 3.8, align: 'left', color: s.c('--ink-2') });
      });
    });
    // Test set aside first, then validation as a share of what is left.
    const y2 = s.h * 0.66;
    const cut = s.ease('rest', 0.6, 0.6);
    const share = after(s, 'rest', 0.55);
    s.alpha(cut, () => {
      s.rrect(l, y2 - bh / 2, X(0.9) - l - 0.3 * s.u, bh, 1.2, { fill: s.tint('--ink-3', 0.15), stroke: s.tint('--ink-3', 0.5), lw: 0.3 });
      s.rrect(X(0.9) + 0.3 * s.u, y2 - bh / 2, X(1) - X(0.9) - 0.3 * s.u, bh, 1, { fill: s.tint('teal', 0.35), stroke: s.c('teal'), lw: 0.35 });
      s.text('test first: 5,000', X(1), y2 - bh / 2 - 4 * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('teal') });
      s.text('45,000 left', (l + X(0.9)) / 2, y2, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink-2') });
    });
    s.alpha(share, () => {
      s.rrect(X(0.81) + 0.3 * s.u, y2 - bh / 2, X(0.9) - X(0.81) - 0.6 * s.u, bh, 1, { fill: s.tint('gold', 0.4), stroke: s.c('gold'), lw: 0.35 });
      s.line(X(0.855), y2 + bh / 2 + 0.6 * s.u, X(0.855), y2 + bh / 2 + 3 * s.u, s.c('gold'), 0.3);
      s.text('val: 10% of 45,000 = 4,500', X(0.9), y2 + bh / 2 + 6 * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('gold') });
    });
  },
};

// Final losses for three runs, each ending at the numbers the narration reads.
const run = (start: number, end: number, rate: number) => (e: number) => end + (start - end) * rate ** e;
const RUNS = {
  under: { T: run(2.3, 1.9, 0.7), V: (e: number) => run(2.3, 1.9, 0.7)(e) + 0.1 * (1 - 0.7 ** e), tr: '1.9', va: '2.0' },
  over: { T: run(2.3, 0.1, 0.7), V: (e: number) => run(2.3, 0.1, 0.7)(e) + 0.05 + 0.0079 * e * e, tr: '0.1', va: '1.3' },
  fine: { T: run(2.3, 0.4, 0.7), V: (e: number) => run(2.3, 0.4, 0.7)(e) + 0.1 * (1 - 0.7 ** e), tr: '0.4', va: '0.5' },
};
const EVERY = [2, 4, 6, 8, 10, 12];

/** A question's mark (?, a check or a cross) and its text. */
function ask(s: Scene, mark: string, k: Ink, text: string, x: number, y: number) {
  s.text(mark, x, y, { size: 3.9, font: 'ui', weight: 700, color: s.c(k) });
  s.text(text, x + 4.2 * s.u, y, { size: 3.3, align: 'left', color: s.c('--ink-2') });
}

const stop: SceneDef = {
  draw(s) {
    const F = frame(12 * s.u, s.h * 0.1, s.w - 8 * s.u, s.h * 0.74, [0, 14], [0, 2.6]);
    axes(s, F, 'epoch', 'L', { x: '--ink-3', y: 'red' });
    xTicks(s, F, EVERY.slice(0, -1));
    let kx = F.X(4.6);
    kx = key(s, kx, F.t + 1 * s.u, 'blue', 'train');
    key(s, kx, F.t + 1 * s.u, 'gold', 'val');
    const mu = s.ease('under', 1.2);
    const mo = s.ease('over', 1.2);
    const mf = s.ease('fine', 1.2);
    const blend = (base: (e: number) => number, pick: 'T' | 'V') => (e: number) => lerp(lerp(lerp(base(e), RUNS.under[pick](e), mu), RUNS.over[pick](e), mo), RUNS.fine[pick](e), mf);
    const tr = blend(T, 'T');
    const va = blend(V, 'V');
    curve(s, F, tr, 0, 12, 'blue');
    curve(s, F, va, 0, 12, 'gold');
    // Checkpoints every two epochs, with the validation loss at each.
    const marks = 1 - s.ease('good', 0.6);
    s.alpha(marks, () => {
      EVERY.forEach((ep, i) => {
        s.alpha(s.ease('save', 0.4, 1.2 + 0.25 * i), () => {
          s.circle(F.X(ep), F.Y(T(ep)), 1 * s.u, { fill: s.c('blue') });
          s.circle(F.X(ep), F.Y(V(ep)), 1 * s.u, { fill: s.c('gold') });
          s.text(V(ep).toFixed(2), F.X(ep), F.Y(V(ep)) - 4.4 * s.u, { size: 2.9, font: 'mono', weight: ep === 8 ? 700 : 500, color: s.c('gold'), halo: true });
        });
      });
      s.alpha(s.ease('min', 0.6, 0.4), () => s.circle(F.X(8), F.Y(V(8)), 2.1 * s.u, { stroke: s.c('gold'), lw: 0.45 }));
      s.alpha(s.ease('keep', 0.6), () => {
        s.line(F.X(8), F.Y(V(8)) + 2.6 * s.u, F.X(8), F.b, s.tint('green', 0.8), 0.35, [1.2, 1]);
        s.text('keep epoch 8: early stopping', s.w / 2, s.h * 0.86, { size: 3.6, weight: 600, color: s.c('green') });
      });
    });
    // What a good model reaches, and where training started.
    s.alpha(s.ease('good', 0.6, 0.4), () => {
      yTicks(s, F, [2.3]);
    });
    s.alpha(after(s, 'good', 0.6), () => {
      s.line(F.l, F.Y(0.4), F.r, F.Y(0.4), s.tint('green', 0.8), 0.35, [1.2, 1]);
      s.text('good model: 0.4', F.X(0.3), F.Y(0.4) + 3.2 * s.u, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('green'), halo: true });
    });
    // End values, once a run's curves have settled.
    const cases = [['under', mu * (1 - mo)], ['over', mo * (1 - mf)], ['fine', mf]] as const;
    for (const [name, a] of cases) {
      s.alpha(Math.max(0, a * 2 - 1), () => {
        const R = RUNS[name];
        // Right of the curves' ends, nudged apart when the two ends nearly meet.
        let [ya, yb] = [F.Y(R.V(12)), F.Y(R.T(12))];
        if (yb - ya < 4 * s.u) [ya, yb] = [(ya + yb) / 2 - 2 * s.u, (ya + yb) / 2 + 2 * s.u];
        const lx = F.X(12) + 1.5 * s.u;
        s.text(R.va, lx, ya, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('gold'), halo: true });
        s.text(R.tr, lx, yb, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('blue'), halo: true });
      });
    }
    // Two questions, answered for each run.
    const qx = s.w / 2 - (s.tall ? 38 : 34) * s.u;
    const q1 = s.h * 0.83;
    const q2 = s.h * 0.89;
    const verdicts: Record<string, [boolean, boolean, string, Ink]> = {
      under: [false, true, 'underfitting', 'red'],
      over: [true, false, 'overfitting', 'red'],
      fine: [true, true, 'fits well', 'green'],
    };
    s.alpha(s.ease('ask', 0.6), () => {
      const now = mf > 0.5 ? 'fine' : mo > 0.5 ? 'over' : mu > 0.5 ? 'under' : null;
      const v = now ? verdicts[now]! : null;
      const m = (ok: boolean | undefined): [string, Ink] => (ok === undefined ? ['?', '--ink-3'] : ok ? ['✓', 'green'] : ['✗', 'red']);
      ask(s, ...m(v?.[0]), 'training near a good model?', qx, q1);
      ask(s, ...m(v?.[1]), 'validation close behind?', qx, q2);
      if (v) s.text(v[2], s.w - 6 * s.u, q1 + 3 * s.u, { size: 4.2, weight: 650, align: 'right', color: s.c(v[3]) });
    });
  },
};

export const scenes: Record<string, SceneDef> = { fit, curves, splits, stop };
