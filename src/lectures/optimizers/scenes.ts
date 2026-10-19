import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import {
  FP16,
  NS_SPECTRUM,
  RACE_COLOR,
  RACE_OPTS,
  RACE_T,
  type RaceOpt,
  type RaceRun,
  type SchedKind,
  type SchedOpts,
  decayRun,
  formatRange,
  frob,
  gradLog2Samples,
  gradStream,
  lrAt,
  noisyQuadLoss,
  nsPoly,
  nsStep,
  raceBest,
  raceSetup,
  roundTo,
  scaled,
  singularValues,
  withSpectrum,
} from '../../lib/optimizers-math';
import { Frame, type K, type Rect, card, current, fit, pill } from './kit';

// ---------------------------------------------------------------- shared data, computed once

const DEC_L2 = decayRun('l2', 0.5);
const DEC_AW = decayRun('adamw', 0.5);
const DEC_COLORS: Color[] = ['blue', 'orange', 'green', 'purple', 'red'];
const DEC_LABELS = ['0.003', '0.03', '0.3', '3', '30'];

const SCH: SchedOpts = { T: 1000, warm: 50, decay: 0.2, minRatio: 0 };
const KINDS: SchedKind[] = ['constant', 'cosine', 'wsd'];
const KCOL: Record<SchedKind, Color> = { constant: 'slate', cosine: 'blue', wsd: 'purple' };
const LRS = Object.fromEntries(KINDS.map((k) => [k, Array.from({ length: SCH.T }, (_, t) => lrAt(k, t, SCH))])) as Record<SchedKind, number[]>;
const LOSSES = Object.fromEntries(KINDS.map((k) => [k, noisyQuadLoss(LRS[k]).map((v) => Math.log10(v))])) as Record<SchedKind, number[]>;
const BRANCHES = [500, 700].map((T) => {
  const o = { ...SCH, T };
  const lrs = Array.from({ length: T }, (_, t) => lrAt('wsd', t, o));
  return { T, start: Math.round(T * 0.8), lrs, loss: noisyQuadLoss(lrs).map((v) => Math.log10(v)) };
});

const STREAM = gradStream(200);
const NORMS = STREAM.map(([a, b]) => Math.hypot(a, b));
const NMAX = Math.max(...NORMS);
const bendOf = ([a, b]: [number, number], c: number) => {
  const va = Math.max(-c, Math.min(c, a)), vb = Math.max(-c, Math.min(c, b));
  return Math.abs(Math.atan2(vb, va) - Math.atan2(b, a)) * (180 / Math.PI);
};
const SPIKE = (() => {
  let sel = 0;
  STREAM.forEach((g, i) => {
    if (NORMS[i]! > 2 && NORMS[i]! < 4.2 && bendOf(g, 1) > bendOf(STREAM[sel]!, 1)) sel = i;
  });
  return sel;
})();
const CLIPPED_SHARE = NORMS.filter((n) => n > 1).length / NORMS.length;

const RAW = gradLog2Samples(20000);
const HB0 = -50, HB1 = 26;
const HIST = (() => {
  const c = new Array<number>(HB1 - HB0).fill(0);
  for (const v of RAW) {
    const b = Math.floor(v - HB0);
    if (b >= 0 && b < c.length) c[b]!++;
  }
  return c;
})();
const HMAX = Math.max(...HIST);
const FP16R = formatRange(FP16);
/** Fraction of values rounded to zero, left subnormal, or overflowed in fp16, per integer loss-scale exponent. */
const FATES = Array.from({ length: 33 }, (_, k) => {
  let zero = 0, sub = 0, inf = 0;
  for (const v of RAW) {
    const h = roundTo(2 ** (v + k), FP16);
    if (h === 0) zero++;
    else if (!Number.isFinite(h)) inf++;
    else if (h < FP16R.minNormal) sub++;
  }
  return { zero: zero / RAW.length, sub: sub / RAW.length, inf };
});

const NS_G = withSpectrum(8, 8, NS_SPECTRUM, new Rng(4));
const NS_SV: number[][] = (() => {
  let X = scaled(NS_G, 1 / frob(NS_G));
  const out = [singularValues(X)];
  for (let k = 1; k <= 6; k++) {
    X = nsStep(X);
    out.push(singularValues(X));
  }
  return out;
})();

const SU45 = raceSetup(Math.PI / 4, 1000);
const SU0 = raceSetup(0, 1000);
const R45 = Object.fromEntries(RACE_OPTS.map((o) => [o, raceBest(o, SU45)])) as Record<RaceOpt, RaceRun>;
const R0 = Object.fromEntries(RACE_OPTS.map((o) => [o, raceBest(o, SU0)])) as Record<RaceOpt, RaceRun>;
const RLABEL: Record<RaceOpt, string> = { sgd: 'SGD', adam: 'Adam', muon: 'Muon' };
const CLOUD = (() => {
  const r = new Rng(9);
  return Array.from({ length: 220 }, () => {
    const z0 = r.randn() * 0.55, z1 = (r.randn() * 0.55) / Math.sqrt(1000);
    const c = Math.cos(Math.PI / 4), sn = Math.sin(Math.PI / 4);
    return [c * z0 - sn * z1, sn * z0 + c * z1] as [number, number];
  });
})();

const RECIPE: { head: string; note: string; k: Color; beat: string }[] = [
  { head: 'AdamW', note: 'weight decay outside the step', k: 'blue', beat: 'adamw' },
  { head: 'warmup + cosine or WSD', note: 'smooth schedules', k: 'slate', beat: 'sched' },
  { head: 'clip the global norm', note: 'cap the spikes', k: 'teal', beat: 'clip' },
  { head: 'bf16 + fp32 master weights', note: 'mixed precision', k: 'orange', beat: 'bf16' },
  { head: 'Muon', note: 'orthogonalized momentum', k: 'purple', beat: 'muon' },
];

const sci = (v: number) => (v >= 1e-3 ? fmt(v, 2) : v.toExponential(1).replace('e-', 'e-'));

/** A vertical list of the five recipe cards, lit by beat. */
function recipeList(s: Scene, rect: Rect, appear: (i: number) => number, lit: (i: number) => number): void {
  const [x, y, w, h] = rect;
  const gap = s.u * 1.8;
  const ch = Math.min((h - gap * 4) / 5, s.u * 15);
  const top = y + (h - (ch * 5 + gap * 4)) / 2;
  RECIPE.forEach((r, i) => {
    const a = appear(i);
    if (a <= 0) return;
    card(s, x + (1 - a) * s.u * 4, top + i * (ch + gap), w, ch, r.head, r.note, r.k, lit(i), a);
  });
}

// ---------------------------------------------------------------- intro

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tA = 1 - s.ease('old', 0.6);
    s.alpha(tA, () => {
      s.text('Optimizers at scale', w / 2, h * 0.44, { size: fit(s, 'Optimizers at scale', w * 0.86, 10, { font: 'display', weight: 600 }), font: 'display', weight: 600 });
      s.text('AdamW to Muon', w / 2, h * 0.57, { size: 5, italic: true, color: s.c('--ink-2') });
    });
    const oA = s.ease('old', 0.7, 0.3);
    if (oA <= 0) return;
    const cur = current(s, ['old', 'new', 'adamw', 'sched', 'clip', 'bf16', 'muon', 'plan']);
    const r16: Rect = s.tall ? [w * 0.06, h * 0.11, w * 0.88, h * 0.16] : [w * 0.05, h * 0.3, w * 0.32, h * 0.36];
    const r26: Rect = s.tall ? [w * 0.06, h * 0.3, w * 0.88, h * 0.68] : [w * 0.44, h * 0.15, w * 0.52, h * 0.8];
    s.alpha(oA, () => {
      const [x, y, cw] = r16;
      s.text('2016', x, y + u * 2, { size: 4.6, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-2') });
      const chh = Math.min(u * 14, r16[3] - u * 6);
      card(s, x, y + u * 6, cw, chh, 'Adam + step decay', 'the whole recipe', 'gold', cur === 'old' ? 1 : 0.2);
    });
    const nA = s.ease('new', 0.6);
    s.alpha(nA, () => s.text('2026', r26[0], r26[1] + u * 2, { size: 4.6, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-2') }));
    recipeList(
      s,
      [r26[0], r26[1] + u * 6, r26[2], r26[3] - u * 6],
      (i) => s.ease(RECIPE[i]!.beat, 0.6),
      (i) => (cur === RECIPE[i]!.beat || (cur === 'plan' && i === 4) ? 1 : 0.15),
    );
  },
};

// ---------------------------------------------------------------- AdamW

const ROWS = [
  { name: 'tiny gradients', g: 0.003 },
  { name: 'medium', g: 0.3 },
  { name: 'large', g: 30 },
];

const adamw: SceneDef = {
  marks: {
    sgd: { tex: String.raw`\symW \leftarrow \symW - \symlr\,\nabla L - \symlr\symlam\,\symW`, x: 0.5, y: 0.8, size: 5 },
    l2: { tex: String.raw`\symG = \nabla L + \symlam\symW,\quad \text{step} = \hat\symM / \sqrt{\hat\symv}`, x: 0.5, y: 0.8, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Phase A: Adam's normalized step, then the decay term divided by sqrt(v).
    const tA = 1 - s.ease('demo', 0.6);
    const cur = current(s, ['recap', 'm', 'v', 'step', 'l2', 'sgd', 'problem', 'big']);
    if (tA > 0) {
      s.alpha(tA, () => {
        const x0 = w * 0.06;
        const tw = w * 0.88;
        const top = h * (s.tall ? 0.17 : 0.2);
        const showDecay = s.ease('problem', 0.6);
        const cols = [
          { head: 'm', sub: 'smoothed g', k: 'gold' as K, beat: 'm' },
          { head: '√v', sub: 'typical size', k: 'orange' as K, beat: 'v' },
          { head: 'm / √v', sub: 'Adam step', k: 'slate' as K, beat: 'step' },
          { head: 'λw / √v', sub: 'λw = 0.5', k: 'green' as K, beat: 'problem' },
        ];
        const nameW = tw * 0.26;
        const cw = (tw - nameW) / 4;
        const rh = Math.min(u * 15, h * (s.tall ? 0.15 : 0.12));
        cols.forEach((c, j) => {
          const a = j === 3 ? showDecay : s.ease(c.beat, 0.5);
          s.alpha(a, () => {
            const cx = x0 + nameW + j * cw + cw / 2;
            s.text(c.head, cx, top, { size: fit(s, c.head, cw * 0.9, 5, { font: 'mono', weight: 650 }), font: 'mono', weight: 650, color: s.c(c.k) });
            s.text(c.sub, cx, top + u * 5, { size: fit(s, c.sub, cw * 0.98, 3.3, { italic: true }), italic: true, color: s.c('--ink-3') });
          });
        });
        ROWS.forEach((r, i) => {
          const y = top + u * 9 + i * (rh + u * 1.5);
          s.alpha(s.ease('recap', 0.5, 0.4 + i * 0.25), () =>
            s.text(r.name, x0 + nameW - u * 2, y + rh / 2, { size: fit(s, r.name, nameW - u * 3, 4), align: 'right', color: s.c('--ink-2') }),
          );
          const vals = [fmt(r.g, 3), fmt(r.g, 3), '1', fmt(0.5 / r.g, 2)];
          vals.forEach((v, j) => {
            const a = j === 3 ? showDecay * s.ease('problem', 0.5, 0.6 + i * 0.4) : s.ease(cols[j]!.beat, 0.5, 0.3 + i * 0.2);
            const k: K = j === 3 ? (i === 1 ? 'green' : 'red') : cols[j]!.k;
            const on = (j === 2 && cur === 'step') || (j === 3 && cur === 'big') ? 1 : 0.25;
            s.alpha(a, () => s.cell(x0 + nameW + j * cw + u * 0.8, y, cw - u * 1.6, rh, v, k, { on, size: Math.min(4.6, (cw / u) * 0.22) }));
          });
        });
        const ny = top + u * 9 + 3 * (rh + u * 1.5) + u * 3;
        s.alpha(s.ease('step', 0.5, 1.5) * (1 - s.ease('l2', 0.4)), () =>
          s.text('every parameter takes a step of about the same size', w / 2, ny, { size: fit(s, 'every parameter takes a step of about the same size', w * 0.88, 3.8, { italic: true }), italic: true, color: s.c('--ink-2') }),
        );
        s.alpha(s.ease('big', 0.5, 0.8), () => {
          const t = 'tiny gradients: decay amplified · large: decay nearly gone';
          s.text(t, w / 2, ny, { size: fit(s, t, w * 0.9, 3.8, { italic: true }), italic: true, color: s.c('red') });
        });
        const my = (ny + u * 9) / h;
        s.show('sgd', tA * s.win('sgd', 'problem', 0.5), { y: Math.min(0.9, my) });
        s.show('l2', tA * s.win('problem', 'big', 0.5), { y: Math.min(0.9, my) });
        s.alpha(s.win('l2', 'sgd', 0.4), () => {
          const t = 'L2: add λw to the gradient';
          s.text(t, w / 2, my * h, { size: fit(s, t, w * 0.9, 4.2, { font: 'mono', weight: 600 }), font: 'mono', weight: 600, color: s.c('green') });
        });
      });
    }
    // Phase B: five weights under both rules.
    const bA = s.ease('demo', 0.6, 0.3);
    if (bA <= 0) return;
    const rL2: Rect = s.tall ? [w * 0.06, h * 0.13, w * 0.88, h * 0.34] : [w * 0.04, h * 0.17, w * 0.44, h * 0.64];
    const rAW: Rect = s.tall ? [w * 0.06, h * 0.53, w * 0.88, h * 0.34] : [w * 0.52, h * 0.17, w * 0.44, h * 0.64];
    const panel = (rect: Rect, tr: number[][], n: number, title: string, a: number, ref: boolean) => {
      const F = new Frame(s, rect, [-10, 306, -0.12, 1.18]);
      s.alpha(a, () => {
        F.panel();
        F.hline(0, s.c('--grid'), 0.2);
        F.hline(1, s.c('--grid'), 0.2);
        s.text('1', F.X(-10) + u * 1.5, F.Y(1) - u * 2, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
        s.text('0', F.X(-10) + u * 1.5, F.Y(0) - u * 2, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
        const m = Math.max(1, Math.round(n));
        const xs = Array.from({ length: m + 1 }, (_, i) => i);
        if (ref) F.poly(xs, xs.map((t) => (1 - 0.005) ** t), s.c('--ink'), 0.35, [1.2, 1.2]);
        for (let i = tr.length - 1; i >= 0; i--) F.poly(xs, tr[i]!.slice(0, m + 1), s.c(DEC_COLORS[i]!), 0.75 - i * 0.07);
        s.text(title, rect[0] + rect[2] - u * 2.5, rect[1] + u * 4, { size: 4.2, font: 'display', weight: 620, align: 'right', halo: true });
        if (ref) s.text(`step ${m}`, rect[0] + rect[2] - u * 2.5, rect[1] + rect[3] - u * 3, { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
      });
    };
    panel(rL2, DEC_L2, 300 * smooth(s.prog('demo') * 1.15), 'Adam + L2', bA, false);
    panel(rAW, DEC_AW, 300 * smooth(s.prog('aw') * 1.15), 'AdamW', s.ease('aw', 0.6), true);
    // legend
    s.alpha(bA, () => {
      const ly = s.tall ? h * 0.93 : h * 0.89;
      const lab = 'gradient size:';
      const parts = [lab, ...DEC_LABELS];
      const sz = 3.2;
      const widths = parts.map((p) => s.measure(p, { size: sz, font: p === lab ? 'serif' : 'mono' }) + u * 3);
      let x = (w - widths.reduce((a, b) => a + b, 0)) / 2;
      parts.forEach((p, i) => {
        s.text(p, x, ly, { size: sz, font: i === 0 ? 'serif' : 'mono', weight: i ? 650 : 450, align: 'left', italic: i === 0, color: i === 0 ? s.c('--ink-2') : s.c(DEC_COLORS[i - 1]!) });
        x += widths[i]!;
      });
    });
    s.alpha(s.ease('same', 0.6, 0.5), () => {
      const [x, y, ww] = rAW;
      s.text('all five on one curve', x + ww / 2, y + u * 11, { size: 3.6, italic: true, color: s.c('--ink'), halo: true });
    });
  },
};

// ---------------------------------------------------------------- schedules

const schedules: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const rT: Rect = [w * 0.06, h * 0.14, w * 0.88, h * (s.tall ? 0.33 : 0.32)];
    const rB: Rect = [w * 0.06, h * (s.tall ? 0.51 : 0.5), w * 0.88, h * (s.tall ? 0.44 : 0.45)];
    const FT = new Frame(s, rT, [-80, 1020, -0.1, 1.3]);
    const FB = new Frame(s, rB, [-80, 1020, -3.25, 0.75]);
    FT.panel();
    FB.panel();
    s.text('learning rate', rT[0] + rT[2] - u * 2.5, rT[1] + u * 3.6, { size: 3.4, align: 'right', color: s.c('slate'), weight: 600 });
    s.text('loss (log scale)', rB[0] + rB[2] - u * 2.5, rB[1] + u * 3.6, { size: 3.4, align: 'right', color: s.c('red'), weight: 600 });
    for (const [v, lab] of [[0, '0'], [1, 'peak']] as const) {
      FT.hline(v, s.c('--grid'), 0.2);
      s.text(lab, rT[0] + u * 1.5, FT.Y(v) - u * 2.2, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
    }
    for (const v of [-3, -2, -1, 0]) {
      FB.hline(v, s.c('--grid'), 0.2);
      s.text(`1e${v}`, rB[0] + u * 1.5, FB.Y(v) - u * 2.2, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
    }
    const xs = Array.from({ length: SCH.T + 1 }, (_, i) => i);
    const cur = current(s, ['warm', 'why', 'blow', 'ramp', 'floor', 'cos', 'catch', 'wsd', 'drop', 'branch']);
    // warmup ramp
    const wA = s.ease('warm', 0.6) * (1 - s.ease('floor', 0.6));
    s.alpha(wA, () => {
      const n = Math.round(lerp(0, 60, smooth(s.prog('warm'))));
      FT.poly(xs.slice(0, n), LRS.cosine.slice(0, n), s.c('slate'), cur === 'ramp' ? 1 : 0.7);
      if (s.since('ramp') > 0) {
        FT.poly(xs.slice(0, 50), LRS.cosine.slice(0, 50), s.c('--accent'), 1.1);
        s.text('warmup', FT.X(60) + u * 1.5, FT.Y(0.55), { size: 3.6, align: 'left', italic: true, color: s.c('--accent') });
      }
    });
    s.alpha(s.win('why', 'floor', 0.5), () => {
      const lines = cur === 'blow' || cur === 'ramp' ? ['a full-size step here', 'can spike or diverge'] : ['step 0: large, fast-changing gradients,', "Adam's v from a few samples"];
      lines.forEach((l, i) => s.text(l, rB[0] + rB[2] / 2, rB[1] + rB[3] * (0.42 + i * 0.16), { size: fit(s, l, rB[2] * 0.9, 3.8, { italic: true }), italic: true, color: s.c(cur === 'blow' ? 'red' : '--ink-2') }));
    });
    const show: Record<SchedKind, number> = { constant: s.ease('floor', 0.6), cosine: s.ease('cos', 0.6), wsd: s.ease('wsd', 0.6) };
    const reveal: Record<SchedKind, number> = { constant: smooth(s.prog('floor') * 1.2), cosine: smooth(s.prog('cos') * 1.2), wsd: smooth(s.prog('wsd') * 1.2) };
    const focus = cur === 'floor' ? 'constant' : cur === 'cos' || cur === 'catch' ? 'cosine' : cur === 'wsd' || cur === 'drop' || cur === 'branch' ? 'wsd' : null;
    for (const k of KINDS) {
      const a = show[k];
      if (a <= 0) continue;
      const n = Math.round(SCH.T * reveal[k]);
      const strong = focus === k || focus === null;
      s.alpha(a * (strong ? 1 : 0.45), () => {
        FT.poly(xs.slice(0, n), LRS[k].slice(0, n), s.c(KCOL[k]), strong ? 0.85 : 0.5);
        FB.poly(xs.slice(0, n + 1), LOSSES[k].slice(0, n + 1), s.c(KCOL[k]), strong ? 0.85 : 0.5);
      });
    }
    // legend, top right of the loss panel, below its title
    const legA = show.constant;
    s.alpha(legA, () => {
      let x = rB[0] + rB[2] - u * 2.5;
      const y = rB[1] + u * 9;
      for (const k of [...KINDS].reverse()) {
        if (show[k] <= 0) continue;
        const lab = k === 'wsd' ? 'WSD' : k;
        s.alpha(show[k], () => s.text(lab, x, y, { size: 3.3, align: 'right', weight: 650, color: s.c(KCOL[k]), halo: true }));
        x -= s.measure(lab, { size: 3.3, weight: 650 }) + u * 3;
      }
    });
    s.alpha(s.win('floor', 'cos', 0.5), () =>
      s.text('noise floor', FB.X(980), FB.Y(LOSSES.constant[980]!) - u * 3, { size: 3.4, align: 'right', italic: true, color: s.c('slate'), halo: true }),
    );
    s.alpha(s.win('catch', 'wsd', 0.5), () => {
      FT.vline(1000, s.c('--ink'), 0.3, [1, 1]);
      s.text('T, fixed in advance', FT.X(985), FT.Y(0.62), { size: 3.4, align: 'right', italic: true, halo: true });
    });
    s.alpha(s.ease('drop', 0.6), () => {
      const c = s.ctx;
      c.fillStyle = s.tint('purple', 0.1);
      for (const F of [FT, FB]) c.fillRect(F.X(800), F.rect[1], F.X(1000) - F.X(800), F.rect[3]);
      s.text('cooldown', FT.X(905), FT.Y(0.27), { size: 3.2, italic: true, color: s.c('purple'), halo: true });
    });
    s.alpha(s.ease('branch', 0.6), () => {
      for (const b of BRANCHES) {
        const bx = Array.from({ length: b.T - b.start + 1 }, (_, i) => b.start + i);
        FT.poly(bx.slice(0, -1), b.lrs.slice(b.start), s.c('purple'), 0.5, [1.2, 1]);
        FB.poly(bx, b.loss.slice(b.start), s.c('purple'), 0.5, [1.2, 1]);
        FT.dot(b.start, 1, 0.9, s.c('purple'));
      }
      s.text('branch anywhere', FT.X(470), FT.Y(0.83), { size: 3.2, italic: true, color: s.c('purple'), halo: true });
    });
  },
};

// ---------------------------------------------------------------- clipping

const clipping: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const rBars: Rect = s.tall ? [w * 0.06, h * 0.13, w * 0.88, h * 0.24] : [w * 0.04, h * 0.2, w * 0.44, h * 0.56];
    const rPlane: Rect = s.tall ? [w * 0.06, h * 0.41, w * 0.88, h * 0.55] : [w * 0.52, h * 0.13, w * 0.44, h * 0.83];
    const FB = new Frame(s, rBars, [-8, 202, -0.25, NMAX * 1.12]);
    FB.panel();
    const cur = current(s, ['spikes', 'cause', 'damage', 'norm', 'scale', 'dir', 'val', 'rare']);
    const n = Math.round(200 * clamp01(s.span('spikes', 'damage') * 1.05));
    const thr = s.ease('scale', 0.6) * (1 - s.ease('dir', 0.5)) + s.ease('rare', 0.6);
    const bw = Math.max(1, (FB.X(1) - FB.X(0)) * 0.7);
    for (let i = 0; i < n; i++) {
      const v = NORMS[i]!;
      const kept = thr > 0 ? Math.min(v, lerp(v, 1, thr)) : v;
      const x = FB.X(i + 0.5) - bw / 2;
      const isSpike = i === SPIKE && s.since('damage') > 0;
      s.ctx.fillStyle = s.tint('teal', isSpike ? 1 : 0.6);
      s.ctx.fillRect(x, FB.Y(kept), bw, FB.Y(0) - FB.Y(kept));
      if (v > kept + 1e-6) {
        s.ctx.fillStyle = s.tint('red', 0.45 * thr);
        s.ctx.fillRect(x, FB.Y(v), bw, FB.Y(kept) - FB.Y(v));
      }
    }
    if (thr > 0) s.alpha(thr, () => FB.hline(1, s.c('red'), 0.3, [1.2, 1]));
    s.alpha(1 - s.ease('rare', 0.6, 0.5), () => s.text('global gradient norm, per step', rBars[0] + u * 2, rBars[1] + u * 3.4, { size: 3.1, align: 'left', color: s.c('--ink-2'), halo: true }));
    s.alpha(s.ease('damage', 0.5), () => {
      const x = FB.X(SPIKE + 0.5);
      const y = FB.Y(NORMS[SPIKE]!) - u * 1.2;
      s.arrow(x + u * 6, y - u * 4, x + u * 0.8, y - u * 0.6, s.c('--ink'), 0.4, 2);
    });
    s.alpha(s.ease('rare', 0.6, 0.5), () => {
      const t = `${Math.round(CLIPPED_SHARE * 100)}% of steps clipped`;
      s.text(t, rBars[0] + u * 2, rBars[1] + u * 3.4, { size: 3.3, align: 'left', weight: 600, color: s.c('red'), halo: true });
    });
    // the plane
    const pA = s.ease('norm', 0.6);
    if (pA <= 0) {
      s.alpha(s.ease('damage', 0.5, 0.4), () => {
        const [x, y, ww, hh] = rPlane;
        const l1 = 'SGD: one step throws the weights far';
        const l2 = 'Adam: m and v inflated for many steps';
        s.text(l1, x + ww / 2, y + hh * 0.4, { size: fit(s, l1, ww * 0.95, 3.8, { italic: true }), italic: true, color: s.c('--ink-2') });
        s.text(l2, x + ww / 2, y + hh * 0.55, { size: fit(s, l2, ww * 0.95, 3.8, { italic: true }), italic: true, color: s.c('--ink-2') });
      });
      return;
    }
    const F = new Frame(s, rPlane, [-1.3, 4.1, -1.3, 3.5], true);
    s.alpha(pA, () => {
      F.panel();
      F.axes();
      const [ga, gb] = STREAM[SPIKE]!;
      const nrm = Math.hypot(ga, gb);
      const sc = 1 / nrm;
      const cA = s.ease('scale', 0.6);
      const shrink = s.ease('scale', 1.4, 1.2);
      const ctx = s.ctx;
      if (cA > 0)
        s.alpha(cA, () => {
          ctx.beginPath();
          ctx.arc(F.X(0), F.Y(0), F.kx, 0, Math.PI * 2);
          ctx.strokeStyle = s.c('red');
          ctx.lineWidth = 0.35 * u;
          ctx.setLineDash([u, u]);
          ctx.stroke();
          ctx.setLineDash([]);
          s.text('c = 1', F.X(0), F.Y(-1) + u * 3.4, { size: 3.2, color: s.c('red'), halo: true });
        });
      const vA = s.ease('val', 0.6);
      const noteX = s.tall ? rPlane[0] + rPlane[2] - u * 2 : rPlane[0] + rPlane[2] / 2;
      const noteY = s.tall ? rPlane[1] + u * 3.6 : rPlane[1] + rPlane[3] - u * 5;
      const va = Math.max(-1, Math.min(1, ga)), vb = Math.max(-1, Math.min(1, gb));
      if (vA > 0)
        s.alpha(vA, () => {
          ctx.strokeStyle = s.c('slate');
          ctx.lineWidth = 0.3 * u;
          ctx.setLineDash([u, u]);
          ctx.strokeRect(F.X(-1), F.Y(1), F.kx * 2, F.kx * 2);
          ctx.setLineDash([]);
          F.arrow(0, 0, va, vb, s.c('slate'), 0.6);
          const t = `per value: bends ${bendOf([ga, gb], 1).toFixed(0)}°`;
          s.text(t, noteX, noteY, { size: fit(s, t, rPlane[2] * (s.tall ? 0.6 : 0.9), 3.6, { weight: 600 }), align: s.tall ? 'right' : 'center', color: s.c('slate'), weight: 600, halo: true });
        });
      F.arrow(0, 0, ga, gb, s.tint('teal', cA > 0 ? 0.35 : 1), 0.7);
      s.text(`‖g‖ = ${nrm.toFixed(2)}`, F.X(ga) - u * 1, F.Y(gb) - u * 3, { size: 3.4, align: 'right', font: 'mono', weight: 600, color: s.c('teal'), halo: true });
      if (shrink > 0) {
        const f = lerp(1, sc, shrink);
        F.arrow(0, 0, ga * f, gb * f, s.c('teal'), 0.85);
        s.alpha(clamp01(shrink * 2 - 1), () =>
          s.text(`× ${sc.toFixed(2)}`, F.X(ga * sc) + u * 1, F.Y(gb * sc) + u * 4.5, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('teal'), halo: true }),
        );
      }
      s.alpha(s.ease('dir', 0.6, 0.6) * (1 - vA), () => s.text('same direction, shorter', noteX, noteY, { size: fit(s, 'same direction, shorter', rPlane[2] * (s.tall ? 0.6 : 0.9), 3.6, { italic: true }), italic: true, align: s.tall ? 'right' : 'center', color: s.c('teal'), halo: true }));
      s.text('layer A', rPlane[0] + rPlane[2] - u * 2, F.Y(0) + u * 3, { size: 2.9, align: 'right', color: s.c('--ink-3') });
      s.text('layer B', F.X(0) + u * 1.5, rPlane[1] + u * 3, { size: 2.9, align: 'left', color: s.c('--ink-3') });
    });
    void cur;
  },
};

// ---------------------------------------------------------------- mixed precision

const FORMATS = [
  { name: 'fp32', e: 8, m: 23, note: 'range 3.4e38, about 7 digits', beat: 'bits' },
  { name: 'fp16', e: 5, m: 10, note: 'max 65,504, about 3 digits', beat: 'fp16' },
  { name: 'bf16', e: 8, m: 7, note: 'range 3.4e38, 2 to 3 digits', beat: 'bf16' },
];

const precision: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cur = current(s, ['why', 'bits', 'fp16', 'bf16', 'under', 'hist', 'scale', 'unscale', 'bf16fix', 'gap', 'master']);
    // Phase A: the bit layouts.
    const aA = 1 - s.ease('under', 0.6);
    if (aA > 0)
      s.alpha(aA, () => {
        const x0 = w * 0.06;
        const cw = (w * 0.88) / 32;
        const sh = Math.min(u * 6, cw * 2);
        FORMATS.forEach((f, r) => {
          const y = h * 0.24 + r * h * 0.22;
          const a = r === 2 ? s.ease('bf16', 0.6) : s.ease('why', 0.6, r * 0.8);
          const lit = cur === f.beat || (cur === 'why' && r < 2) || cur === 'bits' ? 1 : 0.35;
          s.alpha(a * (0.4 + 0.6 * lit), () => {
            s.text(f.name, x0, y - sh / 2 - u * 3.2, { size: 4.2, font: 'mono', weight: 650, align: 'left' });
            const bits = 1 + f.e + f.m;
            for (let b = 0; b < bits; b++) {
              const k: K = b === 0 ? 'slate' : b <= f.e ? 'gold' : 'teal';
              s.rrect(x0 + b * cw + 0.5, y - sh / 2, cw - 1, sh, 0.5, { fill: s.tint(k, 0.55), stroke: s.tint(k, 0.9), lw: 0.15 });
            }
            s.alpha(s.ease('bits', 0.5), () =>
              s.text(f.note, x0, y + sh / 2 + u * 3.6, { size: fit(s, f.note, w * 0.88, 3.4, { italic: true }), italic: true, align: 'left', color: s.c('--ink-2') }),
            );
          });
        });
        s.alpha(s.ease('bits', 0.5), () => {
          const parts: [string, K][] = [['sign', 'slate'], ['exponent: range', 'gold'], ['mantissa: precision', 'teal']];
          const sz = 3.4;
          const ws = parts.map(([t]) => s.measure(t, { size: sz, weight: 650 }) + u * 7);
          let x = (w - ws.reduce((p2, q) => p2 + q, 0)) / 2;
          const ly = h * 0.9;
          parts.forEach(([t, k], i) => {
            s.rrect(x, ly - u * 1.6, u * 3.2, u * 3.2, 0.6, { fill: s.tint(k, 0.55), stroke: s.tint(k, 0.9), lw: 0.15 });
            s.text(t, x + u * 4.4, ly, { size: sz, weight: 650, align: 'left', color: s.c(k) });
            x += ws[i]!;
          });
        });
        s.alpha(s.win('why', 'bits', 0.5), () => {
          const t = '16 bits: half the memory, much faster matrix math';
          s.text(t, w / 2, h * 0.9, { size: fit(s, t, w * 0.9, 3.8, { italic: true }), italic: true, color: s.c('--ink-2') });
        });
      });
    // Phase B: the gradient histogram and loss scaling.
    const bA = s.ease('under', 0.6, 0.3) * (1 - s.ease('gap', 0.6));
    if (bA > 0)
      s.alpha(bA, () => {
        const rH: Rect = [w * 0.06, h * 0.14, w * 0.88, h * (s.tall ? 0.56 : 0.6)];
        const F = new Frame(s, rH, [HB0, HB1, -0.2, 1.14]);
        F.panel();
        const toBf = s.ease('bf16fix', 0.8);
        let k = 0;
        if (s.since('scale') > 0) k = lerp(0, 24, s.ease('scale', 2.6, 1));
        if (s.since('unscale') > 0) k = 24 + 6 * clamp01(s.prog('unscale') / 0.25) * (1 - clamp01((s.prog('unscale') - 0.8) / 0.2));
        if (s.since('bf16fix') > 0) k = lerp(24, 0, toBf);
        const ki = Math.max(0, Math.min(32, Math.round(k)));
        const ctx = s.ctx;
        const zones: [number, number, K, string][] = [
          [HB0, -25, 'red', 'zero'],
          [-25, -14, 'gold', 'subnormal'],
          [-14, 16, 'green', 'normal'],
          [16, HB1, 'red', 'inf'],
        ];
        s.alpha(1 - toBf, () =>
          zones.forEach(([a, b, kk, lab]) => {
            ctx.fillStyle = s.tint(kk, kk === 'green' ? 0.08 : 0.16);
            ctx.fillRect(F.X(a), F.Y(1.14), F.X(b) - F.X(a), F.Y(0) - F.Y(1.14));
            s.text(lab, F.X((a + b) / 2), F.Y(1.07), { size: 3, color: s.c('--ink-2') });
          }),
        );
        s.alpha(toBf, () => {
          ctx.fillStyle = s.tint('green', 0.08);
          ctx.fillRect(F.X(HB0), F.Y(1.14), F.X(HB1) - F.X(HB0), F.Y(0) - F.Y(1.14));
          s.text('bf16: every value in the normal range', F.X((HB0 + HB1) / 2), F.Y(1.07), { size: 3.2, color: s.c('--ink-2'), weight: 600 });
        });
        const reveal = s.ease('hist', 1.2);
        for (let i = 0; i < HIST.length; i++) {
          const x = HB0 + i + k;
          const hh = (HIST[i]! / HMAX) * 0.9 * reveal;
          if (hh <= 0) continue;
          const mid = x + 0.5;
          const kk: K = toBf > 0.5 ? 'teal' : mid < -25 || mid > 16 ? 'red' : mid < -14 ? 'gold' : 'teal';
          ctx.fillStyle = s.tint(kk, 0.85);
          ctx.fillRect(F.X(x) + 0.5, F.Y(hh), Math.max(1, F.X(x + 1) - F.X(x) - 1), F.Y(0) - F.Y(hh));
        }
        F.hline(0, s.c('--axis'), 0.25);
        for (const t of [-40, -24, -14, 0, 16]) {
          s.text('2', F.X(t) - u * 0.9, F.Y(0) + u * 3.6, { size: 3, font: 'mono', color: s.c('--ink-3') });
          s.text(String(t), F.X(t) + u * 0.4, F.Y(0) + u * 2.6, { size: 2.3, font: 'mono', align: 'left', color: s.c('--ink-3') });
        }
        const fate = toBf > 0.5 ? { zero: 0, sub: 0, inf: 0 } : FATES[ki]!;
        const ry = rH[1] + rH[3] + u * 6;
        const items = [
          `scale 2^${ki}`,
          `zero ${Math.round(fate.zero * 100)}%`,
          `subnormal ${Math.round(fate.sub * 100)}%`,
          fate.inf > 0 ? 'overflow: skip' : 'no overflow',
        ];
        const ks: K[] = ['slate', 'red', 'gold', fate.inf > 0 ? 'red' : 'teal'];
        if (s.tall) {
          items.forEach((t, i) => pill(s, t, w * (i % 2 ? 0.7 : 0.3), ry + Math.floor(i / 2) * u * 8, ks[i]!, 3.2));
        } else {
          items.forEach((t, i) => pill(s, t, w * (0.16 + i * 0.23), ry, ks[i]!, 3.2));
        }
      });
    // Phase C: the lost update, then master weights.
    const cA = s.ease('gap', 0.6, 0.3);
    if (cA <= 0) return;
    s.alpha(cA, () => {
      const rN: Rect = [w * 0.06, h * 0.14, w * 0.88, h * 0.3];
      const F = new Frame(s, rN, [0.9865, 1.0255, -1, 1]);
      F.panel();
      F.hline(0, s.c('--axis'), 0.3);
      const reps: number[] = [];
      for (let v = 1 - 3 * 2 ** -8; v < 1; v += 2 ** -8) reps.push(v);
      for (let v = 1; v <= 1.024; v += 2 ** -7) reps.push(v);
      reps.forEach((v) => {
        s.line(F.X(v), F.Y(-0.18), F.X(v), F.Y(0.18), s.c('--ink-2'), 0.3);
        F.dot(v, 0, v === 1 ? 1.4 : 0.8, v === 1 ? s.c('blue') : s.c('--ink-3'));
      });
      s.text('1', F.X(1), F.Y(-0.5), { size: 3.4, font: 'mono', weight: 650, color: s.c('blue') });
      s.text('1.0078', F.X(1 + 2 ** -7), F.Y(-0.5), { size: 3, font: 'mono', color: s.c('--ink-3') });
      s.text('bf16 numbers near 1', rN[0] + rN[2] - u * 2, rN[1] + rN[3] - u * 3, { size: 3.1, align: 'right', color: s.c('--ink-2') });
      const up = s.ease('gap', 0.8, 2.4);
      s.alpha(up, () => {
        s.arrow(F.X(1), F.Y(0.55), F.X(1 + 0.0001) + u * 1.6, F.Y(0.55), s.c('teal'), 0.4, 1.4);
        const t = '1 + 0.0001 rounds back to 1';
        s.text(t, F.X(1) + u * 3, F.Y(0.55), { size: fit(s, t, F.X(1.0255) - F.X(1) - u * 4, 3.4, { font: 'mono', weight: 600 }), font: 'mono', weight: 600, align: 'left', color: s.c('teal'), halo: true });
      });
      // master-weight loop
      const mA = s.ease('master', 0.6);
      s.alpha(mA, () => {
        const boxes = [
          { t: 'fp32 master W, m, v', k: 'blue' as K },
          { t: 'cast to bf16', k: 'orange' as K },
          { t: 'forward + backward', k: 'orange' as K },
          { t: 'update in fp32', k: 'blue' as K },
        ];
        const y0 = h * 0.52;
        const bw = w * 0.4, bh = h * 0.13;
        const pos: [number, number][] = [
          [w * 0.06, y0],
          [w * 0.54, y0],
          [w * 0.54, y0 + bh + h * 0.08],
          [w * 0.06, y0 + bh + h * 0.08],
        ];
        boxes.forEach((b, i) => card(s, pos[i]![0], pos[i]![1], bw, bh, b.t, '', b.k, 0.3, s.ease('master', 0.5, i * 0.5)));
        s.arrow(pos[0]![0] + bw + u, y0 + bh / 2, pos[1]![0] - u, y0 + bh / 2, s.c('--ink-3'), 0.4, 2);
        s.arrow(pos[1]![0] + bw / 2, y0 + bh + u, pos[2]![0] + bw / 2, pos[2]![1] - u, s.c('--ink-3'), 0.4, 2);
        s.arrow(pos[2]![0] - u, pos[2]![1] + bh / 2, pos[3]![0] + bw + u, pos[3]![1] + bh / 2, s.c('--ink-3'), 0.4, 2);
        s.arrow(pos[3]![0] + bw / 2, pos[3]![1] - u, pos[0]![0] + bw / 2, y0 + bh + u, s.c('--ink-3'), 0.4, 2);
      });
    });
  },
};

// ---------------------------------------------------------------- the matrix picture

const BETA = (25 * Math.PI) / 180;
const ALPHA = (35 * Math.PI) / 180;
const SIG: [number, number] = [1.7, 0.55];
const R2 = (t: number): number[][] => [
  [Math.cos(t), -Math.sin(t)],
  [Math.sin(t), Math.cos(t)],
];
const mul2 = (A: number[][], B: number[][]): number[][] => [
  [A[0]![0]! * B[0]![0]! + A[0]![1]! * B[1]![0]!, A[0]![0]! * B[0]![1]! + A[0]![1]! * B[1]![1]!],
  [A[1]![0]! * B[0]![0]! + A[1]![1]! * B[1]![0]!, A[1]![0]! * B[0]![1]! + A[1]![1]! * B[1]![1]!],
];
const app2 = (A: number[][], v: [number, number]): [number, number] => [A[0]![0]! * v[0] + A[0]![1]! * v[1], A[1]![0]! * v[0] + A[1]![1]! * v[1]];
/** Rotate by Vᵀ, stretch by Σ, rotate by U, as p goes 0 -> 3. */
function svdMorph(p: number, sig: [number, number] = SIG): number[][] {
  const a = clamp01(p), b = clamp01(p - 1), c = clamp01(p - 2);
  const S = [
    [1 + (sig[0] - 1) * b, 0],
    [0, 1 + (sig[1] - 1) * b],
  ];
  return mul2(R2(ALPHA * c), mul2(S, R2(-BETA * a)));
}

const matrix: SceneDef = {
  marks: {
    usv: { tex: String.raw`\symW = U\,\Sigma\,V^\top`, x: 0.5, y: 0.9, size: 5.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const cur = current(s, ['list', 'map', 'svd', 'circle', 'sv', 'outer', 'low', 'drown', 'idea']);
    // Phase A: list versus map.
    const aA = 1 - s.ease('svd', 0.6);
    if (aA > 0)
      s.alpha(aA, () => {
        const gr: Rect = s.tall ? [w * 0.1, h * 0.16, w * 0.8, h * 0.32] : [w * 0.06, h * 0.22, w * 0.4, h * 0.56];
        const n = 4;
        const cs = Math.min(gr[2] / n, gr[3] / n) * 0.82;
        const gx = gr[0] + (gr[2] - cs * n) / 2;
        const gy = gr[1] + (gr[3] - cs * n) / 2 + u * 2;
        const r = new Rng(3);
        s.text('Adam: entry by entry', gr[0] + gr[2] / 2, gy - u * 4, { size: 3.6, italic: true, color: s.c('--ink-2') });
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            const sz = 0.25 + 0.75 * r.next();
            s.cell(gx + j * cs, gy + i * cs, cs, cs, '', 'blue', { on: 0.1 });
            s.circle(gx + j * cs + cs / 2, gy + i * cs + cs / 2, cs * 0.36 * sz, { fill: s.tint('orange', 0.55) });
          }
        const mA = s.ease('map', 0.6);
        s.alpha(mA, () => {
          const mr: Rect = s.tall ? [w * 0.06, h * 0.6, w * 0.88, h * 0.32] : [w * 0.52, h * 0.22, w * 0.44, h * 0.56];
          const cy = mr[1] + mr[3] / 2;
          const ch = Math.min(mr[3] / 4.2, u * 8);
          const colX = (x: number, k: K, lab: string) => {
            for (let i = 0; i < 3; i++) s.cell(x, cy - 1.5 * ch + i * ch, ch, ch, '', k, { on: 0.3 });
            s.text(lab, x + ch / 2, cy - 1.5 * ch - u * 3, { size: 4, italic: true, weight: 650, color: s.c(k) });
          };
          const bwid = mr[2] * 0.32;
          const x1 = mr[0] + mr[2] * 0.08;
          const bx = mr[0] + (mr[2] - bwid) / 2;
          const x2 = mr[0] + mr[2] * 0.92 - ch;
          colX(x1, 'orange', 'x');
          s.rrect(bx, cy - ch * 1.6, bwid, ch * 3.2, 2, { fill: s.tint('blue', 0.12), stroke: s.c('blue'), lw: 0.5 });
          s.text('W', bx + bwid / 2, cy, { size: 7, italic: true, weight: 650, color: s.c('blue') });
          colX(x2, 'purple', 'y');
          s.arrow(x1 + ch + u, cy, bx - u, cy, s.c('--ink-3'), 0.4, 2);
          s.arrow(bx + bwid + u, cy, x2 - u, cy, s.c('--ink-3'), 0.4, 2);
          s.text('a linear map: vectors in, vectors out', mr[0] + mr[2] / 2, mr[1] + mr[3] - u * 1, { size: fit(s, 'a linear map: vectors in, vectors out', mr[2], 3.6, { italic: true }), italic: true, color: s.c('--ink-2') });
        });
      });
    // Phase B: rotate, stretch, rotate.
    const bA = s.ease('svd', 0.6, 0.3) * (1 - s.ease('outer', 0.6));
    if (bA > 0)
      s.alpha(bA, () => {
        const pr: Rect = s.tall ? [w * 0.08, h * 0.13, w * 0.84, h * 0.68] : [w * 0.2, h * 0.13, w * 0.6, h * 0.72];
        const F = new Frame(s, pr, [-2.05, 2.05, -2.05, 2.05], true);
        F.axes(0.6);
        const p = 3 * clamp01(s.prog('svd') * 1.1);
        const M = svdMorph(p);
        F.ellipse([[1, 0], [0, 1]], s.tint('--ink-3', 0.5), 0.3, [1, 1]);
        F.ellipse(M, s.c('blue'), 0.8);
        const v1 = app2(M, [Math.cos(BETA), Math.sin(BETA)]);
        const v2 = app2(M, [-Math.sin(BETA), Math.cos(BETA)]);
        F.arrow(0, 0, v1[0], v1[1], s.c('red'), 0.6);
        F.arrow(0, 0, v2[0], v2[1], s.c('orange'), 0.6);
        const stage = p < 1 ? 'rotate (Vᵀ)' : p < 2 ? 'stretch (Σ)' : 'rotate (U)';
        s.alpha(s.win('svd', 'circle', 0.4), () => s.text(stage, pr[0] + pr[2] / 2, pr[1] + u * 3, { size: 3.8, italic: true, color: s.c('--ink-2'), halo: true }));
        s.alpha(s.ease('sv', 0.5), () => {
          s.text('σ₁', F.X(v1[0] * 1.12), F.Y(v1[1] * 1.12), { size: 4.4, italic: true, weight: 650, color: s.c('red'), halo: true });
          s.text('σ₂', F.X(v2[0] * 1.3), F.Y(v2[1] * 1.3), { size: 4.4, italic: true, weight: 650, color: s.c('orange'), halo: true });
        });
        s.show('usv', bA * s.ease('svd', 0.6, 0.5), { y: s.tall ? 0.88 : 0.92 });
      });
    // Phase C: the gradient is lopsided; Muon's idea.
    const cA = s.ease('outer', 0.6, 0.3);
    if (cA <= 0) return;
    s.alpha(cA, () => {
      const br: Rect = s.tall ? [w * 0.06, h * 0.13, w * 0.88, h * 0.38] : [w * 0.04, h * 0.18, w * 0.46, h * 0.72];
      const er: Rect = s.tall ? [w * 0.06, h * 0.55, w * 0.88, h * 0.41] : [w * 0.54, h * 0.13, w * 0.42, h * 0.83];
      const idea = s.ease('idea', 1.6, 0.6);
      const FB = new Frame(s, br, [-0.6, 8.2, -0.12, 1.25]);
      FB.panel();
      FB.hline(1, s.c('--grid'), 0.25);
      const sv = NS_SPECTRUM.map((v) => v / 10);
      const bw = (FB.X(1) - FB.X(0)) * 0.66;
      const grow = s.ease('low', 1.4);
      sv.forEach((v, i) => {
        const hh = lerp(v, 1, idea) * grow;
        const x = FB.X(i + 0.5) - bw / 2;
        s.ctx.fillStyle = s.tint(idea > 0.5 ? 'purple' : 'red', 0.75);
        s.ctx.fillRect(x, FB.Y(hh), bw, FB.Y(0) - FB.Y(hh));
      });
      const lab = idea > 0.5 ? 'every stretch set to 1' : 'singular values of a typical update';
      s.text(lab, br[0] + br[2] / 2, br[1] + u * 3.6, { size: fit(s, lab, br[2] * 0.9, 3.4), color: s.c('--ink-2'), halo: true });
      s.alpha(s.ease('outer', 0.6) * (1 - s.ease('low', 0.5)), () => {
        const t = 'G = Σ (output change) × (input)ᵀ';
        s.text(t, br[0] + br[2] / 2, br[1] + br[3] / 2, { size: fit(s, t, br[2] * 0.9, 3.8, { font: 'mono', weight: 600 }), font: 'mono', weight: 600, color: s.c('teal') });
      });
      const eA = s.ease('drown', 0.6);
      s.alpha(eA, () => {
        const F = new Frame(s, er, [-1.9, 1.9, -1.9, 1.9], true);
        F.axes(0.5);
        const sig: [number, number] = [lerp(1.6, 1.1, idea), lerp(0.09, 1.1, idea)];
        const M = mul2(R2(ALPHA), mul2([[sig[0], 0], [0, sig[1]]], R2(-BETA)));
        F.ellipse(M, s.c(idea > 0.5 ? 'purple' : 'red'), 0.8);
        const u1 = app2(R2(ALPHA), [sig[0], 0]);
        const u2 = app2(R2(ALPHA), [0, sig[1]]);
        F.arrow(0, 0, u1[0], u1[1], s.c('red'), 0.55);
        F.arrow(0, 0, u2[0], u2[1], s.c('orange'), 0.55);
        const t = idea > 0.5 ? 'same directions, equal steps' : 'one direction takes nearly all';
        s.text(t, er[0] + er[2] / 2, er[1] + er[3] - u * 2.5, { size: fit(s, t, er[2] * 0.95, 3.6, { italic: true }), italic: true, color: s.c(idea > 0.5 ? 'purple' : 'red'), halo: true });
      });
    });
    void cur;
  },
};

// ---------------------------------------------------------------- Muon

const NAME_PARTS: [string, boolean][] = [
  ['M', true],
  ['oment', false],
  ['U', true],
  ['m ', false],
  ['O', true],
  ['rthogonalized by ', false],
  ['N', true],
  ['ewton-Schulz', false],
];

const BLOCKS: { t: string; muon: boolean; note?: string }[] = [
  { t: 'output layer', muon: false, note: 'empirically' },
  { t: 'MLP: W₁, W₂', muon: true },
  { t: 'norm gains, biases', muon: false, note: 'vectors' },
  { t: 'attention: Q, K, V, O', muon: true },
  { t: 'norm gains, biases', muon: false },
  { t: 'token embedding', muon: false, note: 'a lookup table' },
];

const muon: SceneDef = {
  marks: {
    orth: { tex: String.raw`\symM = U\Sigma V^\top \;\longrightarrow\; \symO = UV^\top`, x: 0.5, y: 0.9, size: 5.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    // the name
    s.alpha(1 - s.ease('mom', 0.6), () => {
      s.text('Muon', w / 2, h * 0.38, { size: 12, font: 'display', weight: 650, color: s.c('purple') });
      const full = NAME_PARTS.map((p) => p[0]).join('');
      const sz = fit(s, full, w * 0.88, 4.8, { font: 'serif' });
      const total = s.measure(full, { size: sz });
      let x = (w - total) / 2;
      s.alpha(s.ease('name', 0.6, 2.2), () => {
        for (const [t, hi] of NAME_PARTS) {
          s.text(t, x, h * 0.55, { size: sz, align: 'left', weight: hi ? 750 : 450, color: hi ? s.c('purple') : s.c('--ink-2') });
          x += s.measure(t, { size: sz, weight: hi ? 750 : 450 });
        }
      });
    });
    // M -> O
    const aA = s.ease('mom', 0.6) * (1 - s.ease('where', 0.6));
    if (aA > 0)
      s.alpha(aA, () => {
        const er: Rect = s.tall ? [w * 0.06, h * 0.13, w * 0.42, h * 0.56] : [w * 0.06, h * 0.13, w * 0.4, h * 0.62];
        const br: Rect = s.tall ? [w * 0.52, h * 0.17, w * 0.42, h * 0.46] : [w * 0.52, h * 0.17, w * 0.42, h * 0.52];
        const o = s.ease('orth', 1.6, 1.2);
        const F = new Frame(s, er, [-1.8, 1.8, -1.8, 1.8], true);
        F.axes(0.5);
        const sig: [number, number] = [lerp(1.6, 1.15, o), lerp(0.25, 1.15, o)];
        const M = mul2(R2(ALPHA), mul2([[sig[0], 0], [0, sig[1]]], R2(-BETA)));
        F.ellipse(M, s.c(o > 0.5 ? 'purple' : 'gold'), 0.8);
        const u1 = app2(R2(ALPHA), [sig[0], 0]);
        const u2 = app2(R2(ALPHA), [0, sig[1]]);
        F.arrow(0, 0, u1[0], u1[1], s.c('red'), 0.55);
        F.arrow(0, 0, u2[0], u2[1], s.c('orange'), 0.55);
        s.text(o > 0.5 ? 'O' : 'M', er[0] + u * 3, er[1] + u * 5, { size: 6, italic: true, weight: 650, align: 'left', color: s.c(o > 0.5 ? 'purple' : 'gold') });
        const FB = new Frame(s, br, [-0.4, 8.2, -0.1, 1.2]);
        FB.panel();
        FB.hline(1, s.c('--grid'), 0.25);
        const bw = (FB.X(1) - FB.X(0)) * 0.64;
        NS_SPECTRUM.forEach((v, i) => {
          const hh = lerp(v / 10, 1, o);
          s.ctx.fillStyle = s.tint(o > 0.5 ? 'purple' : 'gold', 0.8);
          s.ctx.fillRect(FB.X(i + 0.5) - bw / 2, FB.Y(hh), bw, FB.Y(0) - FB.Y(hh));
        });
        s.text('singular values', br[0] + br[2] / 2, br[1] + br[3] + u * 3.5, { size: 3.2, color: s.c('--ink-2') });
        s.show('orth', aA * s.ease('orth', 0.6), { y: s.tall ? 0.86 : 0.91 });
        s.alpha(s.ease('equal', 0.6) * (1 - s.ease('step', 0.5)), () => {
          const t = 'every direction moves the same amount';
          s.text(t, w / 2, h * (s.tall ? 0.78 : 0.82), { size: fit(s, t, w * 0.9, 3.8, { italic: true }), italic: true, color: s.c('purple') });
        });
        s.alpha(s.ease('step', 0.6), () => {
          const t = 'step: lr × √max(1, rows/cols) × O';
          s.text(t, w / 2, h * (s.tall ? 0.78 : 0.82), { size: fit(s, t, w * 0.9, 3.8, { font: 'mono', weight: 600 }), font: 'mono', weight: 600, color: s.c('slate') });
        });
      });
    // where it applies
    const wA = s.ease('where', 0.6, 0.3);
    if (wA <= 0) return;
    s.alpha(wA, () => {
      const cur = current(s, ['where', 'adamw', 'why']);
      const bx = s.tall ? w * 0.13 : w * 0.12;
      const bwid = s.tall ? w * 0.81 : w * 0.5;
      const top = h * 0.14;
      const bot = s.tall ? h * 0.85 : h * 0.94;
      const gap = u * 1.5;
      const bh = (bot - top - gap * 5) / 6;
      const why = s.ease('why', 0.5);
      BLOCKS.forEach((b, i) => {
        const y = top + i * (bh + gap);
        const k: K = b.muon ? 'purple' : 'orange';
        const on = (cur === 'where' && b.muon) || (cur !== 'where' && !b.muon) ? 1 : 0.15;
        s.rrect(bx, y, bwid, bh, 1.8, { fill: s.tint(k, 0.07 + 0.18 * on), stroke: s.tint(k, 0.4 + 0.6 * on), lw: 0.3 + 0.3 * on });
        const pad = u * 2.4;
        const hs = fit(s, b.t, bwid * (s.tall ? 0.62 : 0.9), Math.min(4.2, (bh / u) * 0.45), { font: 'display', weight: 620 });
        s.text(b.t, bx + pad, y + bh / 2, { size: hs, font: 'display', weight: 620, align: 'left', color: s.c(k) });
        if (b.note)
          s.alpha(why, () => {
            if (s.tall) s.text(b.note!, bx + bwid - pad, y + bh / 2, { size: fit(s, b.note!, bwid * 0.36, 3.3, { italic: true }), italic: true, align: 'right', color: s.c('--ink-2') });
            else s.text(b.note!, bx + bwid + u * 3, y + bh / 2, { size: fit(s, b.note!, w - bx - bwid - u * 6, 3.6, { italic: true }), italic: true, align: 'left', color: s.c('--ink-2') });
          });
      });
      const y1 = top + 1 * (bh + gap), y2 = top + 5 * (bh + gap) - gap;
      s.line(bx - u * 1.8, y1, bx - u * 1.8, y2, s.c('--ink-3'), 0.35);
      s.text('×N', bx - u * 2.6, (y1 + y2) / 2, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      const ly = s.tall ? h * 0.92 : h * 0.06 + u * 2;
      const lx = s.tall ? w / 2 : bx + bwid / 2;
      s.text('Muon', lx - u * 4, ly, { size: 3.6, weight: 650, color: s.c('purple'), align: 'right' });
      s.text('AdamW', lx + u * 4, ly, { size: 3.6, weight: 650, color: s.c('orange'), align: 'left' });
    });
  },
};

// ---------------------------------------------------------------- Newton-Schulz

const ns: SceneDef = {
  marks: {
    key: { tex: String.raw`XX^\top X = U\Sigma V^\top\, V\Sigma U^\top\, U\Sigma V^\top = U\Sigma^3V^\top`, x: 0.5, y: 0.34, size: 4.6 },
    poly: { tex: String.raw`\sym{sig}{\sigma} \;\leftarrow\; a\,\sym{sig}{\sigma} + b\,\sym{sig}{\sigma}^3 + c\,\sym{sig}{\sigma}^5`, x: 0.5, y: 0.54, size: 5.6 },
    norm: { tex: String.raw`X = \symG / \lVert \symG \rVert_F \;\Rightarrow\; \text{every } \sym{sig}{\sigma_i} \le 1`, x: 0.5, y: 0.74, size: 4.8 },
  },
  draw(s) {
    const { w, h, u } = s;
    // SVD versus Newton-Schulz
    const aA = 1 - s.ease('key', 0.6);
    if (aA > 0)
      s.alpha(aA, () => {
        const cards = [
          { head: 'SVD', lines: ['exact U Vᵀ', 'sequential, branchy', 'wants fp32', 'slow on a GPU'], k: 'red' as K, beat: 'svd' },
          { head: 'Newton-Schulz', lines: ['approximate U Vᵀ', '15 matrix multiplies', 'runs in bf16', 'full GPU speed'], k: 'purple' as K, beat: 'mm' },
        ];
        cards.forEach((c, i) => {
          const a = s.ease(c.beat, 0.6);
          const r: Rect = s.tall ? [w * 0.1, h * (0.15 + i * 0.42), w * 0.8, h * 0.36] : [w * (0.08 + i * 0.44), h * 0.22, w * 0.4, h * 0.56];
          s.alpha(a, () => {
            s.rrect(r[0], r[1], r[2], r[3], 2.2, { fill: s.tint(c.k, 0.07), stroke: s.tint(c.k, 0.6), lw: 0.35 });
            s.text(c.head, r[0] + r[2] / 2, r[1] + r[3] * 0.17, { size: 5.4, font: 'display', weight: 640, color: s.c(c.k) });
            c.lines.forEach((l, j) => s.text(l, r[0] + r[2] / 2, r[1] + r[3] * (0.38 + j * 0.16), { size: fit(s, l, r[2] * 0.9, 3.8), color: s.c('--ink-2') }));
          });
        });
      });
    const mA = s.ease('key', 0.6) * (1 - s.ease('s0', 0.6));
    s.show('key', mA, { y: s.tall ? 0.3 : 0.3 });
    s.show('poly', mA * s.ease('poly', 0.6), { y: 0.52 });
    s.show('norm', mA * s.ease('norm', 0.6), { y: 0.74 });
    // the live iteration
    const cA = s.ease('s0', 0.6, 0.3);
    if (cA <= 0) return;
    let k = 0;
    if (s.since('s1') > 0) k = s.ease('s1', 1.2, 0.8);
    if (s.since('s3') > 0) k = 1 + 3 * smooth(s.prog('s3'));
    if (s.since('s5') > 0) k = 4 + s.ease('s5', 1);
    const k0 = Math.floor(k), fr = k - k0;
    const sv = NS_SV[k0]!.map((v, i) => lerp(v, NS_SV[Math.min(6, k0 + 1)]![i]!, fr));
    s.alpha(cA, () => {
      const rB: Rect = s.tall ? [w * 0.06, h * 0.13, w * 0.88, h * 0.4] : [w * 0.04, h * 0.15, w * 0.45, h * 0.78];
      const rC: Rect = s.tall ? [w * 0.06, h * 0.57, w * 0.88, h * 0.39] : [w * 0.52, h * 0.15, w * 0.44, h * 0.78];
      const FB = new Frame(s, rB, [-0.9, 8.15, -0.2, 1.45]);
      FB.panel();
      const band = s.ease('band', 0.6);
      if (band > 0) {
        s.ctx.fillStyle = s.tint('purple', 0.12 * band);
        s.ctx.fillRect(FB.X(-0.9), FB.Y(1.2), FB.X(8.15) - FB.X(-0.9), FB.Y(0.68) - FB.Y(1.2));
      }
      FB.hline(1, s.c('--ink'), 0.25, [1, 1]);
      FB.hline(0, s.c('--axis'), 0.25);
      s.text('1', FB.X(-0.9) + u * 1.5, FB.Y(1) - u * 2, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
      const bw = (FB.X(1) - FB.X(0)) * 0.66;
      sv.forEach((v, i) => {
        const hh = Math.min(v, 1.4);
        s.ctx.fillStyle = s.tint('red', 0.75);
        s.ctx.fillRect(FB.X(i + 0.5) - bw / 2, FB.Y(hh), bw, FB.Y(0) - FB.Y(hh));
        const lab = v < 0.0095 ? v.toFixed(3) : v.toFixed(2);
        if (!s.tall) s.text(lab, FB.X(i + 0.5), FB.Y(hh) - u * 2, { size: Math.min(2.9, (bw / u) * 0.36), font: 'mono', color: s.c('--ink'), halo: true });
      });
      const kr = Math.round(k);
      s.text(`after ${kr} step${kr === 1 ? '' : 's'}`, rB[0] + rB[2] - u * 2, rB[1] + u * 3.4, { size: 3.3, align: 'right', weight: 600, halo: true });
      if (s.tall) {
        const t = `σ from ${Math.min(...sv).toFixed(Math.min(...sv) < 0.01 ? 3 : 2)} to ${Math.max(...sv).toFixed(2)}`;
        s.text(t, rB[0] + u * 2, rB[1] + u * 3.4, { size: 3.3, align: 'left', font: 'mono', weight: 600, color: s.c('red'), halo: true });
      }
      // the polynomial, composed k times, on a log axis
      const FC = new Frame(s, rC, [-3.45, 0.1, -0.2, 1.4]);
      FC.panel();
      FC.hline(1, s.c('--ink'), 0.25, [1, 1]);
      FC.hline(0, s.c('--axis'), 0.25);
      const xs = Array.from({ length: 181 }, (_, i) => -3.3 + (3.4 * i) / 180);
      const comp = (lx: number, kk: number) => {
        let v = 10 ** lx;
        const kf = Math.floor(kk);
        for (let q = 0; q < kf; q++) v = nsPoly(v);
        const nxt = nsPoly(v);
        return lerp(v, nxt, kk - kf);
      };
      FC.poly(xs, xs.map((lx) => 10 ** lx), s.tint('--ink-3', 0.6), 0.3, [1, 1]);
      FC.poly(xs, xs.map((lx) => comp(lx, k)), s.c('red'), 0.7);
      NS_SV[0]!.forEach((v) => FC.dot(Math.log10(v), Math.min(1.38, comp(Math.log10(v), k)), 0.9, s.c('red')));
      for (const t of [-3, -2, -1, 0]) s.text(t === 0 ? '1' : `0.${'0'.repeat(-t - 1)}1`, FC.X(t), FC.Y(-0.2) - u * 2, { size: 2.7, font: 'mono', color: s.c('--ink-3') });
      s.text('output vs. starting σ', rC[0] + rC[2] - u * 2, rC[1] + u * 3.4, { size: 3.1, align: 'right', color: s.c('--ink-2'), halo: true });
    });
    s.alpha(s.ease('cost', 0.6), () => {
      const bwid = Math.min(w * 0.86, u * 92);
      const bx = (w - bwid) / 2;
      const by = s.tall ? h * 0.44 : h * 0.4;
      s.rrect(bx, by, bwid, u * 20, 2.4, { fill: s.c('--card'), stroke: s.c('slate'), lw: 0.4 });
      const t1 = 'extra compute ≈ 5 m / B';
      const t2 = 'GPT-2 small: 5 × 768 / 524,288 ≈ 0.7%';
      s.text(t1, w / 2, by + u * 7, { size: fit(s, t1, bwid * 0.9, 4.6, { font: 'mono', weight: 650 }), font: 'mono', weight: 650, color: s.c('slate') });
      s.text(t2, w / 2, by + u * 14, { size: fit(s, t2, bwid * 0.92, 3.4, { font: 'mono' }), font: 'mono', color: s.c('--ink-2') });
    });
  },
};

// ---------------------------------------------------------------- steepest descent

const steepest: SceneDef = {
  marks: {
    nat: { tex: String.raw`\lVert \Delta\symW\, x \rVert \;\le\; \lVert \Delta\symW \rVert_2\, \lVert x \rVert`, x: 0.78, y: 0.5, size: 4.8 },
    sham: { tex: String.raw`L^{-1/4}\,\symG\,R^{-1/4} \;\to\; UV^\top`, x: 0.78, y: 0.5, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const cur = current(s, ['choice', 'frob', 'inf', 'spec', 'picture', 'corner', 'natural', 'family']);
    const pr: Rect = s.tall ? [w * 0.06, h * 0.13, w * 0.88, h * 0.6] : [w * 0.04, h * 0.13, w * 0.52, h * 0.83];
    const ir: Rect = s.tall ? [w * 0.06, h * 0.76, w * 0.88, h * 0.2] : [w * 0.6, h * 0.18, w * 0.37, h * 0.7];
    const F = new Frame(s, pr, [-1.3, 2.35, -1.3, 1.8], true);
    F.panel();
    F.axes(0.7);
    const lop = s.ease('corner', 2, 0.8);
    const S: [number, number] = [lerp(2, 2.2, lop), lerp(0.5, 0.25, lop)];
    const GS = 0.72;
    const n = Math.hypot(S[0], S[1]);
    const ux = S[0] / n, uy = S[1] / n;
    const ctx = s.ctx;
    const fA = s.ease('frob', 0.6);
    const sA = s.ease('spec', 0.6);
    if (sA > 0)
      s.alpha(sA, () => {
        ctx.fillStyle = s.tint('purple', 0.08);
        ctx.fillRect(F.X(-1), F.Y(1), F.kx * 2, F.kx * 2);
        ctx.strokeStyle = s.c('purple');
        ctx.lineWidth = 0.45 * u;
        ctx.strokeRect(F.X(-1), F.Y(1), F.kx * 2, F.kx * 2);
      });
    if (fA > 0)
      s.alpha(fA, () => {
        ctx.beginPath();
        ctx.arc(F.X(0), F.Y(0), F.kx, 0, Math.PI * 2);
        ctx.fillStyle = s.tint('teal', 0.1);
        ctx.fill();
        ctx.strokeStyle = s.c('teal');
        ctx.lineWidth = 0.45 * u;
        ctx.stroke();
      });
    const lvl = s.ease('corner', 0.6);
    if (lvl > 0)
      s.alpha(lvl, () => {
        for (const [val, k] of [[1, 'teal'], [ux + uy, 'purple']] as const) {
          const px = ux * val, py = uy * val;
          F.poly([px - uy * 4, px + uy * 4], [py + ux * 4, py - ux * 4], s.c(k), 0.3, [1, 0.8]);
        }
      });
    F.arrow(0, 0, S[0] * GS, S[1] * GS, s.c('red'), 0.75);
    s.text('G', F.X(S[0] * GS) + u * 1.5, F.Y(S[1] * GS) + u * 1.5, { size: 4.4, italic: true, weight: 650, align: 'left', color: s.c('red'), halo: true });
    s.alpha(fA, () => {
      F.dot(ux, uy, 1.3, s.c('teal'));
      s.text('SGD', F.X(ux) - u * 1.6, F.Y(uy) + u * 3.6, { size: 3.6, weight: 650, align: 'right', color: s.c('teal'), halo: true });
    });
    s.alpha(sA, () => {
      F.dot(1, 1, 1.3, s.c('purple'));
      s.text('Muon', F.X(1) + u * 1.5, F.Y(1) - u * 2.2, { size: 3.6, weight: 650, align: 'left', color: s.c('purple'), halo: true });
    });
    s.alpha(s.ease('picture', 0.6), () => {
      s.text('d₁: strongest direction →', pr[0] + pr[2] - u * 2, pr[1] + pr[3] - u * 3, { size: 3.2, align: 'right', color: s.c('--ink-3'), halo: true });
      s.text('d₂: weaker', F.X(0) + u * 1.5, pr[1] + u * 3.2, { size: 3.2, align: 'left', color: s.c('--ink-3'), halo: true });
    });
    // the side notes
    const note = (lines: string[], k: K, a: number) =>
      s.alpha(a, () => {
        const lh = u * 5.6;
        const y0 = ir[1] + ir[3] / 2 - ((lines.length - 1) * lh) / 2;
        lines.forEach((l, i) => s.text(l, ir[0] + ir[2] / 2, y0 + i * lh, { size: fit(s, l, ir[2] * 0.95, i ? 3.5 : 4.2, i ? {} : { weight: 650 }), weight: i ? 450 : 650, color: i ? s.c('--ink-2') : s.c(k) }));
      });
    const only = (b: string) => (cur === b ? s.ease(b, 0.5) : 0);
    note(['a step of what size?', 'size is a choice of norm'], '--ink', cur === 'choice' ? s.ease('choice', 0.5) : 0);
    note(['all entries together ≤ η', 'best step ∝ G: SGD'], 'teal', only('frob'));
    note(['largest entry ≤ η', 'best step = sign(G): Adam-like'], 'orange', only('inf'));
    note(['largest singular value ≤ η', 'best step = U Vᵀ: Muon'], 'purple', only('spec') + only('picture'));
    note(['the disc favors direction 1', 'the corner: full step in both'], 'purple', only('corner'));
    s.show('nat', s.win('natural', 'family', 0.5), s.tall ? { x: 0.5, y: 0.86 } : { x: 0.78, y: 0.5 });
    s.show('sham', s.ease('family', 0.6), s.tall ? { x: 0.5, y: 0.9 } : { x: 0.78, y: 0.56 });
    s.alpha(s.ease('family', 0.6), () => {
      const t = 'Shampoo, one step, no memory';
      s.text(t, s.tall ? w / 2 : ir[0] + ir[2] / 2, s.tall ? h * 0.8 : h * 0.44, { size: fit(s, t, ir[2], 3.6, { italic: true }), italic: true, color: s.c('--ink-2') });
    });
    if (cur === 'inf')
      s.alpha(s.ease('inf', 0.5, 0.4), () => {
        const signs = [1, -1, 1, 1, 1, -1, -1, 1, -1];
        const cs = Math.min(u * 7, ir[3] * 0.22);
        const gx = ir[0] + ir[2] / 2 - cs * 1.5;
        const gy = s.tall ? ir[1] - cs * 3.3 : ir[1] + ir[3] / 2 + u * 8;
        if (!s.tall) signs.forEach((v, i) => s.cell(gx + (i % 3) * cs, gy + Math.floor(i / 3) * cs, cs, cs, v > 0 ? '+1' : '-1', 'orange', { on: 0.3, size: 3 }));
      });
  },
};

// ---------------------------------------------------------------- the race

const race: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cur = current(s, ['setup', 'turn', 'ellipse', 'sgd', 'adam', 'muon', 'zero', 'caveat']);
    const pr: Rect = s.tall ? [w * 0.06, h * 0.13, w * 0.88, h * 0.52] : [w * 0.04, h * 0.13, w * 0.5, h * 0.83];
    const lr: Rect = s.tall ? [w * 0.06, h * 0.68, w * 0.88, h * 0.21] : [w * 0.58, h * 0.16, w * 0.38, h * 0.5];
    const F = new Frame(s, pr, [-1.75, 1.75, -1.45, 1.45], true);
    F.panel();
    F.axes(0.5);
    // the inputs
    const iA = 1 - s.ease('ellipse', 0.6);
    if (iA > 0)
      s.alpha(iA, () => {
        const turn = s.ease('turn', 1.2);
        const th = lerp(0, Math.PI / 4, turn);
        const c = Math.cos(th - Math.PI / 4), sn = Math.sin(th - Math.PI / 4);
        for (const [x, y] of CLOUD) F.dot(c * x - sn * y, sn * x + c * y, 0.45, s.tint('orange', 0.7));
        const d1: [number, number] = [Math.cos(th), Math.sin(th)];
        const d2: [number, number] = [-Math.sin(th), Math.cos(th)];
        F.arrow(0, 0, d1[0] * 1.3, d1[1] * 1.3, s.c('--ink-2'), 0.5);
        F.arrow(0, 0, d2[0] * 0.75, d2[1] * 0.75, s.c('red'), 0.55);
        s.text('inputs x', pr[0] + u * 2.5, pr[1] + u * 3.6, { size: 3.4, align: 'left', weight: 600, color: s.c('--ink-2') });
        s.text('gray: common direction', pr[0] + u * 2.5, pr[1] + pr[3] - u * 8, { size: 3.3, align: 'left', color: s.c('--ink-2'), halo: true });
        s.text('red: rare, 1/1000 the variance', pr[0] + u * 2.5, pr[1] + pr[3] - u * 3.5, { size: 3.3, align: 'left', color: s.c('red'), halo: true });
      });
    // the race
    const oA = s.ease('ellipse', 0.6, 0.3);
    if (oA <= 0) return;
    const zero = s.since('zero') > 0;
    const runs = zero ? R0 : R45;
    const su = zero ? SU0 : SU45;
    const t = zero ? Math.round(RACE_T * smooth(clamp01(s.prog('zero') * 1.3))) : Math.round(RACE_T * clamp01(s.span('sgd', 'zero') * 1.12));
    const focus: RaceOpt | null = cur === 'sgd' ? 'sgd' : cur === 'adam' ? 'adam' : cur === 'muon' ? 'muon' : null;
    s.alpha(oA, () => {
      F.ellipse(su.Wstar, s.c('--ink'), 0.4, [1.2, 1]);
      const rd: [number, number] = [su.R[0]![1]!, su.R[1]![1]!];
      const tgt = app2(su.Wstar, rd);
      F.arrow(0, 0, tgt[0], tgt[1], s.tint('--ink', 0.55), 0.4);
      for (const o of RACE_OPTS) {
        const W = runs[o].Ws[Math.min(t, runs[o].Ws.length - 1)]!;
        const a = focus === null || focus === o ? 1 : 0.3;
        s.alpha(a, () => {
          F.ellipse(W, s.c(RACE_COLOR[o]), focus === o ? 0.85 : 0.6);
          const v = app2(W, rd);
          F.arrow(0, 0, v[0], v[1], s.c(RACE_COLOR[o]), 0.55);
        });
      }
      s.text(zero ? 'rotation 0°' : 'rotation 45°', pr[0] + u * 2.5, pr[1] + u * 3.4, { size: 3.2, align: 'left', weight: 600, color: s.c('--ink-2'), halo: true });
      s.text(`step ${t}`, pr[0] + pr[2] - u * 2.5, pr[1] + u * 3.4, { size: 3.2, align: 'right', font: 'mono', color: s.c('--ink-3') });
      // loss curves
      const FL = new Frame(s, lr, [-25, RACE_T + 3, -8.3, 0.7]);
      FL.panel();
      for (const v of [-8, -4, 0]) {
        FL.hline(v, s.c('--grid'), 0.2);
        s.text(`1e${v}`, lr[0] + u * 1.2, FL.Y(v) - u * 1.8, { size: 2.6, font: 'mono', align: 'left', color: s.c('--ink-3') });
      }
      for (const o of RACE_OPTS) {
        const L = runs[o].losses.slice(0, t + 1).map((v) => Math.log10(Math.max(v, 1e-12)));
        const a = focus === null || focus === o ? 1 : 0.3;
        s.alpha(a, () => FL.poly(L.map((_, i) => i), L, s.c(RACE_COLOR[o]), 0.4));
      }
      s.text('loss', lr[0] + lr[2] - u * 2, lr[1] + u * 3.2, { size: 3, align: 'right', color: s.c('--ink-2'), halo: true });
      // legend under the loss panel
      const ly = lr[1] + lr[3] + u * (s.tall ? 3.4 : 5);
      const parts = RACE_OPTS.map((o) => `${RLABEL[o]} ${sci(runs[o].losses[Math.min(t, runs[o].losses.length - 1)]!)}`);
      const sz = s.tall ? 3.2 : 3.2;
      const widths = parts.map((p) => s.measure(p, { size: sz, font: 'mono', weight: 600 }) + u * 3);
      let x = lr[0] + (lr[2] - widths.reduce((a2, b) => a2 + b, 0)) / 2;
      RACE_OPTS.forEach((o, i) => {
        if (s.tall) {
          s.text(parts[i]!, x, ly, { size: sz, font: 'mono', weight: 600, align: 'left', color: s.c(RACE_COLOR[o]) });
          x += widths[i]!;
        } else s.text(parts[i]!, lr[0] + u * 1, lr[1] + lr[3] + u * (5 + i * 5.5), { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c(RACE_COLOR[o]) });
      });
    });
    s.alpha(s.ease('caveat', 0.6), () => {
      const t2 = 'a toy that shows the mechanism, not a benchmark';
      const y = s.tall ? pr[1] + pr[3] - u * 3 : pr[1] + pr[3] - u * 3;
      s.text(t2, pr[0] + pr[2] / 2, y, { size: fit(s, t2, pr[2] * 0.92, 3.4, { italic: true }), italic: true, color: s.c('--ink'), halo: true });
    });
  },
};

// ---------------------------------------------------------------- record

const TIMELINE: { head: string; note: string; beat: string; k: Color }[] = [
  { head: '2024 · NanoGPT speedrun', note: 'GPT-2 small to loss 3.28 on 8 H100s', beat: 'speed', k: 'slate' },
  { head: 'Oct 2024 · Muon enters', note: 'record: about 45 min to a few, many changes', beat: 'fell', k: 'purple' },
  { head: '2025 · Moonshot AI', note: '+ weight decay, + AdamW-sized updates', beat: 'scale', k: 'blue' },
  { head: 'Moonlight', note: '~2× compute efficiency; 5.7T tokens', beat: 'moonlight', k: 'blue' },
  { head: 'Kimi K2', note: '1 trillion parameters, a Muon variant', beat: 'k2', k: 'blue' },
];

const RELATIVES: { head: string; note: string; beat: string; k: Color }[] = [
  { head: 'Shampoo (2018)', note: 'statistics on both sides of G', beat: 'rel', k: 'teal' },
  { head: 'SOAP (2024)', note: "Adam in Shampoo's basis", beat: 'rel', k: 'teal' },
  { head: 'muP (2021, 2022)', note: 'hyperparameters that transfer across widths', beat: 'mup', k: 'gold' },
];

const record: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cur = current(s, ['speed', 'fell', 'scale', 'fixes', 'moonlight', 'k2', 'rel', 'mup']);
    const aA = 1 - s.ease('rel', 0.6);
    const list = (items: typeof TIMELINE, rect: Rect, a: number, lit: (i: number) => number, delay: (i: number) => number) => {
      const [x, y, cw, hh] = rect;
      const gap = u * 1.8;
      const ch = Math.min((hh - gap * (items.length - 1)) / items.length, u * 15);
      const top = y + (hh - (ch * items.length + gap * (items.length - 1))) / 2;
      items.forEach((it, i) => {
        const ia = s.ease(it.beat, 0.6, delay(i)) * a;
        card(s, x + (1 - Math.min(1, ia)) * u * 4, top + i * (ch + gap), cw, ch, it.head, it.note, it.k, lit(i), ia);
      });
    };
    if (aA > 0)
      list(
        TIMELINE,
        s.tall ? [w * 0.06, h * 0.13, w * 0.88, h * 0.83] : [w * 0.18, h * 0.13, w * 0.64, h * 0.83],
        aA,
        (i) => (cur === TIMELINE[i]!.beat || (cur === 'fixes' && i === 2) ? 1 : 0.2),
        () => 0,
      );
    if (aA < 1)
      list(
        RELATIVES,
        s.tall ? [w * 0.06, h * 0.2, w * 0.88, h * 0.6] : [w * 0.18, h * 0.2, w * 0.64, h * 0.62],
        1 - aA,
        (i) => (cur === RELATIVES[i]!.beat ? 1 : 0.2),
        (i) => (i === 1 ? 1.6 : 0),
      );
  },
};

// ---------------------------------------------------------------- outro

const outro: SceneDef = {
  draw(s) {
    const { w, h } = s;
    const cur = current(s, ['recap', 'adamw', 'sched', 'clip', 'bf16', 'muon', 'next', 'bye']);
    const lA = 1 - s.ease('next', 0.6);
    if (lA > 0)
      s.alpha(lA, () =>
        recipeList(
          s,
          s.tall ? [w * 0.06, h * 0.13, w * 0.88, h * 0.83] : [w * 0.18, h * 0.13, w * 0.64, h * 0.83],
          (i) => s.ease('recap', 0.5, 0.3 + i * 0.25),
          (i) => (cur === RECIPE[i]!.beat ? 1 : 0.15),
        ),
      );
    const nA = s.ease('next', 0.7, 0.4);
    s.alpha(nA, () => {
      const t = 'next: the interactive chapter';
      s.text(t, w / 2, h * 0.42, { size: fit(s, t, w * 0.9, 6.4, { font: 'display', weight: 600 }), font: 'display', weight: 600 });
      const t2 = 'seven figures, a live Newton-Schulz, the matrix race';
      s.text(t2, w / 2, h * 0.54, { size: fit(s, t2, w * 0.9, 3.8, { italic: true }), italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('bye', 0.6), () => s.text('see you there', w / 2, h * 0.68, { size: 4.6, font: 'display', italic: true, color: s.c('--accent') }));
    });
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  adamw,
  schedules,
  clipping,
  precision,
  matrix,
  muon,
  ns,
  steepest,
  race,
  record,
  outro,
};
