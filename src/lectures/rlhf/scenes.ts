import { fmt } from '../../core/code';
import { rgbOf } from '../../core/plot';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import * as T from '../../lib/rlhf-toy';
import { type K, type Rect, Frame, area, card, check, cross, current, pill, wrapText } from './kit';

// ---------------------------------------------------------------- shared data, computed once

const SFT_CLOUD: T.Pt[] = (() => {
  const r = new Rng(31);
  return Array.from({ length: 70 }, () => T.sampleAnswer(r));
})();

const RM_PAIRS = T.samplePairs(100, 7);
const RM_HELD = T.samplePairs(2000, 99);
const RM_CEILING = T.tasteAccuracy(RM_HELD);
const RM_TRAJ: { w: T.Pt; acc: number }[] = (() => {
  const rm = new T.LinearRM();
  rm.w = [-0.6, 0.1];
  const out = [{ w: [...rm.w] as T.Pt, acc: rm.accuracy(RM_HELD) }];
  for (let i = 0; i < 200; i++) {
    rm.step(RM_PAIRS, 0.05);
    out.push({ w: [...rm.w] as T.Pt, acc: rm.accuracy(RM_HELD) });
  }
  return out;
})();

const RUNS_1 = T.banditRuns(1, null);
const RUNS_20 = T.banditRuns(20, null);
const RUNS_CLIP = T.banditRuns(20, 0.2);
const wrongRun = (r: T.BanditRun): boolean => r.probs.indexOf(Math.max(...r.probs)) !== 0;

const GAE_ROS = T.rollouts(1500, 5);
const GAE_SHOW = GAE_ROS[3]!;
const GAE_TOK = 2;
const GAE_K = 0.6;
const GAE_GRID = Array.from({ length: 21 }, (_, i) => {
  const st = T.gaeStats(GAE_ROS, GAE_TOK, i / 20, GAE_K);
  return { lam: i / 20, gap: st.gap, spread: st.spread, good: st.good.slice(0, 60), bad: st.bad.slice(0, 60) };
});

const OPT_RM = T.trainedRM();
function optRun(beta: number): { m: T.Pt; kl: number; proxy: number; gold: number }[] {
  const pol = new T.GaussPolicy(OPT_RM, beta, 3);
  const g0 = pol.gold;
  const out = [{ m: [0, 0] as T.Pt, kl: 0, proxy: 0, gold: 0 }];
  for (let i = 0; i < 600; i++) {
    pol.step();
    out.push({ m: [...pol.m] as T.Pt, kl: pol.kl, proxy: pol.proxy, gold: pol.gold - g0 });
    if (T.unstd(pol.m)[0] > 7.6) break;
  }
  return out;
}
const OPT_WEAK = optRun(0.05);
const OPT_STRONG = optRun(0.3).slice(0, 400);
const OPT_E: T.Pt[] = (() => {
  const r = new Rng(8);
  return Array.from({ length: 36 }, () => [r.randn(), r.randn()] as T.Pt);
})();

// ---------------------------------------------------------------- small helpers

/** Answer card used in the intro and the comparison scene. */
function answer(s: Scene, x: number, y: number, w: number, tag: string, text: string, k: K, on = 0, inset = 0): number {
  return card(s, x, y, w, k, tag, text, { on, size: 3.3, inset });
}

/** A row of token cells; returns the cell centers. */
function tokenRow(s: Scene, x: number, y: number, w: number, toks: string[], col: (i: number) => K, on: (i: number) => number, size = 3.2): number[] {
  const gap = s.u * 0.8;
  const cw = (w - gap * (toks.length - 1)) / toks.length;
  const ch = s.u * 7;
  return toks.map((t, i) => {
    const cx = x + i * (cw + gap);
    s.cell(cx, y, cw, ch, '', col(i), { on: on(i) });
    s.text(t, cx + cw / 2, y + ch / 2 + s.u * 0.2, { size, font: 'mono', weight: 550 });
    return cx + cw / 2;
  });
}

/** Lines of the 16 bandit runs on a chart, drawn up to batch `upto`. */
function runsChart(s: Scene, fr: Frame, runs: T.BanditRun[], upto: number, a: number, o: { colorWrong?: boolean; mean?: boolean } = {}): void {
  const n = Math.max(1, Math.min(T.BANDIT.iters, Math.floor(upto)));
  s.alpha(a, () => fr.clip(() => {
    for (const r of runs) {
      const bad = o.colorWrong && wrongRun(r);
      fr.path(Array.from({ length: n + 1 }, (_, i) => i), r.J.slice(0, n + 1), bad ? s.tint('red', 0.8) : s.tint('blue', 0.3), bad ? 0.5 : 0.35);
    }
    if (o.mean !== false) {
      const mean = runs[0]!.J.map((_, i) => runs.reduce((acc, r) => acc + r.J[i]!, 0) / runs.length);
      fr.path(Array.from({ length: n + 1 }, (_, i) => i), mean.slice(0, n + 1), s.c('blue'), 0.9);
    }
  }));
}

function runsAxes(s: Scene, fr: Frame, a: number): void {
  s.alpha(a, () => {
    for (const v of [0, 0.5, 1, 1.5]) {
      s.line(fr.X(0), fr.Y(v), fr.X(30), fr.Y(v), s.c('--grid'), 0.2);
      s.text(String(v), fr.X(0) - s.u * 1.2, fr.Y(v), { size: 3.1, font: 'mono', align: 'right', color: s.c('--ink-3') });
    }
    s.line(fr.X(0), fr.Y(1.5), fr.X(30), fr.Y(1.5), s.c('gold'), 0.35, [1.4, 1]);
    s.text('best answer', fr.X(30), fr.Y(1.5) - s.u * 2.4, { size: 3.1, align: 'right', font: 'ui', weight: 600, color: s.c('gold') });
    for (const x of [0, 10, 20, 30]) s.text(String(x), fr.X(x), fr.Y(-0.3) + s.u * 2.6, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
    s.text('batches', fr.X(30), fr.Y(-0.3) - s.u * 2.4, { size: 3.2, font: 'ui', align: 'right', color: s.c('--ink-2') });
    s.text('expected reward', fr.X(0), fr.Y(1.75), { size: 3.2, font: 'ui', align: 'left', color: s.c('--ink-2') });
  });
}

/** The toy answer space: length on x, quality on y. */
function toyFrame(s: Scene, r: Rect, dom: [number, number, number, number]): Frame {
  return new Frame(s, r, dom);
}

function toyAxes(s: Scene, fr: Frame, a: number, ticks: number[]): void {
  s.alpha(a, () => {
    fr.border();
    for (const l of ticks) s.text(String(l * 100), fr.X(l), fr.rect[1] + fr.rect[3] + s.u * 2.8, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
    s.text('length (tokens)', fr.rect[0] + fr.rect[2], fr.rect[1] + fr.rect[3] + s.u * 6.4, { size: 3.2, font: 'ui', align: 'right', color: s.c('--ink-2') });
    s.text('quality', fr.rect[0] + s.u * 1.2, fr.rect[1] + s.u * 2.6, { size: 3.2, font: 'ui', align: 'left', color: s.c('--ink-2'), halo: true });
  });
}

let shadeCv: HTMLCanvasElement | null = null;

/** Shades the frame by a function's value: a coarse image, smoothly scaled up. */
function shade(s: Scene, fr: Frame, f: (l: number, q: number) => number, k: K, a: number, nx = 44, ny = 30): void {
  if (a <= 0.003) return;
  const [rx, ry, rw, rh] = fr.rect;
  const [cr, cg, cb] = rgbOf(s.c(k));
  shadeCv ??= document.createElement('canvas');
  shadeCv.width = nx;
  shadeCv.height = ny;
  const g = shadeCv.getContext('2d')!;
  const img = g.createImageData(nx, ny);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const l = (rx + ((i + 0.5) * rw) / nx - fr.ox) / fr.kx;
      const q = (fr.oy - (ry + ((j + 0.5) * rh) / ny)) / fr.ky;
      const v = clamp01(f(l, q));
      const o = (j * nx + i) * 4;
      img.data[o] = cr;
      img.data[o + 1] = cg;
      img.data[o + 2] = cb;
      img.data[o + 3] = Math.round(255 * a * (0.05 + 0.4 * v * v));
    }
  g.putImageData(img, 0, 0);
  const c = s.ctx;
  c.save();
  c.imageSmoothingEnabled = true;
  c.drawImage(shadeCv, rx, ry, rw, rh);
  c.restore();
}

/** Gold straight contours of a linear reward model with weights w (standardized features). */
function rmContours(s: Scene, fr: Frame, w: T.Pt, a: number, cs: number[]): void {
  if (Math.abs(w[1]) < 1e-4) return;
  s.alpha(a, () => {
    for (const c of cs) fr.fn((l) => T.SFT.q + (T.SFT.sq * (c - (w[0] * (l - T.SFT.l)) / T.SFT.sl)) / w[1], s.tint('gold', c === 0 ? 1 : 0.75), c === 0 ? 0.55 : 0.35);
  });
}

function tasteContours(s: Scene, fr: Frame, a: number, cs: number[]): void {
  s.alpha(a, () => {
    for (const c of cs) fr.fn((l) => (c - 2.5 * l + 0.5 * l * l) / 10, s.tint('green', 0.9), 0.4, undefined, undefined, [1.4, 1]);
  });
}

// ---------------------------------------------------------------- 1. intro

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'mimic'), () => {
      s.text('RLHF and PPO', w / 2, h * 0.42, { size: 11, font: 'display', weight: 600 });
      s.text('reinforcement learning from human feedback', w / 2, h * 0.42 + u * 11, { size: 4.2, italic: true, color: s.c('--ink-2') });
    });
    // A prompt, what a base model does with it, and what a fine-tuned one does.
    const bw = Math.min(w - u * 12, u * 100);
    const x0 = (w - bw) / 2;
    s.alpha(s.win('mimic', 'judge'), () => {
      const py = h * 0.13;
      s.rrect(x0 + bw * 0.12, py, bw * 0.88, u * 9, 4.5, { fill: s.tint('slate', 0.14), stroke: s.tint('slate', 0.5), lw: 0.3 });
      s.text('Explain the moon landing to a 6 year old', x0 + bw * 0.56, py + u * 4.7, { size: 3.6, font: 'ui', weight: 600 });
      s.text('you', x0 + bw * 0.12 - u * 2, py + u * 4.7, { size: 3.2, font: 'ui', align: 'right', color: s.c('--ink-3') });
      s.alpha(s.ease('moon', 0.6, 0.6), () =>
        answer(s, x0, h * 0.3, bw * 0.92, 'pretrained model', 'Explain the theory of gravity to a 6 year old. Explain evolution to a 6 year old. Explain...', 'slate'),
      );
      s.alpha(s.ease('sft', 0.6), () => {
        const y = h * 0.3 + u * 22;
        answer(s, x0, y, bw * 0.92, 'fine-tuned on written demonstrations', 'Long ago, people rode a giant rocket to the moon, and two of them walked on it!', 'orange', 0.4);
        s.alpha(s.ease('sft', 0.5, 3.2), () => pill(s, 'slow to write', x0 + bw * 0.92, y + u * 22, 'red', { align: 'right', font: 'ui' }));
        s.alpha(s.ease('sft', 0.5, 5), () => pill(s, 'only shows what to do', x0, y + u * 22, 'red', { align: 'left', font: 'ui' }));
      });
    });
    // People judge better than they write.
    const jA = s.win('judge', 'recipe');
    s.alpha(jA, () => {
      const top = h * 0.16;
      const texts = ['Apollo 11 landed on the Moon on 20 July 1969, using a lunar module.', 'Long ago, people rode a giant rocket to the moon, and two of them walked on it!'];
      const pick = s.ease('judge', 0.5, 4.2);
      if (s.tall) {
        texts.forEach((t, i) => {
          const y = top + i * u * 26;
          const hh = answer(s, x0, y, bw, `answer ${'AB'[i]}`, t, i === 1 ? 'green' : 'slate', i === 1 ? pick : 0, 8);
          if (i === 1) s.alpha(pick, () => check(s, x0 + bw - u * 4.5, y + hh / 2, u * 3));
        });
      } else {
        const cw = (bw - u * 4) / 2;
        texts.forEach((t, i) => {
          const x = x0 + i * (cw + u * 4);
          const hh = answer(s, x, top + u * 6, cw, `answer ${'AB'[i]}`, t, i === 1 ? 'green' : 'slate', i === 1 ? pick : 0);
          if (i === 1) s.alpha(pick, () => check(s, x + cw - u * 4, top + u * 6 + hh + u * 5, u * 3));
        });
      }
      s.alpha(s.ease('judge', 0.6, 5), () => s.text('judging is easier than writing', w / 2, h * 0.8, { size: 4.4, font: 'display', italic: true, color: s.c('--ink-2') }));
    });
    // The recipe in three moves, then the plan.
    const rA = s.ease('recipe', 0.6);
    if (rA > 0) {
      const steps: [string, string, K][] = [
        ['compare', 'people pick the better answer', 'slate'],
        ['reward model', 'learns to predict their picks', 'gold'],
        ['RL with PPO', 'trains the model against it', 'blue'],
      ];
      const lit = current(s, ['recipe', 'ppo', 'plan']);
      const prog = s.prog('recipe');
      const fade = 1 - s.ease('plan', 0.6, 0.2) * 0.65;
      s.alpha(rA * fade, () => {
        if (s.tall) {
          const bh = u * 15;
          steps.forEach(([t, sub, k], i) => {
            const y = h * 0.14 + i * (bh + u * 6);
            const on = lit === 'recipe' ? (prog * 3 >= i ? 1 : 0.3) : lit === 'ppo' ? (i === 2 ? 1 : 0.3) : 0.4;
            s.alpha(lit === 'recipe' ? smooth((prog * 3 - i) * 3 + 0.3) : 1, () => {
              card(s, w * 0.12, y, w * 0.76, k, t, sub, { on, size: 3.8, h: bh });
              if (i < 2) s.arrow(w / 2, y + bh + u * 0.6, w / 2, y + bh + u * 5.4, s.c('--ink-3'), 0.4, 2);
            });
          });
        } else {
          const bwid = (w - u * 30) / 3;
          steps.forEach(([t, sub, k], i) => {
            const x = u * 8 + i * (bwid + u * 7);
            const y = h * 0.3;
            const on = lit === 'recipe' ? (prog * 3 >= i ? 1 : 0.3) : lit === 'ppo' ? (i === 2 ? 1 : 0.3) : 0.4;
            s.alpha(lit === 'recipe' ? smooth((prog * 3 - i) * 3 + 0.3) : 1, () => {
              card(s, x, y, bwid, k, t, sub, { on, size: 3.8, h: u * 17 });
              if (i < 2) s.arrow(x + bwid + u * 0.8, y + u * 8.5, x + bwid + u * 6.2, y + u * 8.5, s.c('--ink-3'), 0.4, 2);
            });
          });
        }
      });
      const pA = s.ease('plan', 0.6, 0.2);
      if (pA > 0) {
        const items: [string, K][] = [
          ['reward model', 'gold'],
          ['ratio ρ', 'purple'],
          ['clipping', 'slate'],
          ['value head, GAE', 'teal'],
          ['KL penalty', 'red'],
          ['reward hacking', 'red'],
        ];
        const p = s.prog('plan');
        const cols = s.tall ? 2 : 3;
        const cw = (w - u * 16) / cols;
        s.alpha(pA, () => {
          s.rrect(u * 5, h * 0.52, w - u * 10, h * 0.42, 2, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.3 });
          items.forEach(([t, k], i) => {
            const x = u * 8 + (i % cols) * cw + cw / 2;
            const y = h * 0.6 + Math.floor(i / cols) * u * 10;
            s.alpha(smooth((p * 1.6 * items.length - i) * 0.9), () => pill(s, t, x, y, k, { size: 3.5, font: 'ui' }));
          });
        });
      }
    }
  },
};

// ---------------------------------------------------------------- 2. recap

const ANS_A = ['The', ' moon', ' landing', ' was', ' in', ' 1969', '.'];
const ANS_B = ['It', ' was', ' faked', ' in', ' a', ' studio', '.'];

const recap: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const rw = Math.min(w - u * 10, u * 120);
    const rx = (w - rw) / 2;
    // Tokens as actions, a reward at the end, and pushes by advantage.
    const tA = s.win('policy', 'leash');
    s.alpha(tA, () => {
      const y1 = h * 0.2;
      const shown = s.since('adv') >= 0 ? ANS_A.length : Math.min(ANS_A.length, Math.floor(s.since('policy') * 2.2) + 1);
      const centers = tokenRow(s, rx, y1, rw, ANS_A, () => 'blue', (i) => (i === shown - 1 && s.since('adv') < 0 ? 1 : 0.15));
      const tw = rw / ANS_A.length;
      for (let i = shown; i < ANS_A.length; i++) s.rrect(centers[i]! - tw / 2, y1 - u * 0.3, tw + u * 0.4, u * 7.6, 1.2, { fill: s.c('--card') });
      s.alpha(s.since('adv') < 0 && shown < ANS_A.length ? 1 : 0, () => {
        s.text('state: the text so far', rx, y1 - u * 3.4, { size: 3.2, font: 'ui', align: 'left', color: s.c('--ink-2') });
        s.text('action', centers[Math.max(0, shown - 1)]!, y1 + u * 11, { size: 3.2, font: 'ui', color: s.c('blue') });
      });
      const rA = s.ease('policy', 0.6, 5.5);
      s.alpha(rA, () => pill(s, 'reward +1.4', rx + rw, y1 - u * 3.8, 'gold', { align: 'right', size: 3.3 }));
      // advantage pushes
      const aA = s.ease('adv', 0.6, 1);
      s.alpha(aA, () => {
        centers.forEach((cx) => s.arrow(cx, y1 + u * 16, cx, y1 + u * 9, s.c('green'), 0.5, 1.8));
        s.text('advantage +0.9: every token pushed up', rx, y1 + u * 20, { size: 3.3, font: 'ui', align: 'left', color: s.c('green') });
      });
      const bA = s.ease('sign', 0.6, 1.2);
      s.alpha(bA, () => {
        const y2 = h * 0.52;
        const c2 = tokenRow(s, rx, y2, rw, ANS_B, () => 'blue', () => 0.15);
        pill(s, 'reward −2.0', rx + rw, y2 - u * 3.8, 'gold', { align: 'right', size: 3.3 });
        c2.forEach((cx) => s.arrow(cx, y2 + u * 9, cx, y2 + u * 16, s.c('red'), 0.5, 1.8));
        s.text('advantage −2.5: every token pushed down', rx, y2 + u * 20, { size: 3.3, font: 'ui', align: 'left', color: s.c('red') });
      });
      const blA = s.ease('baseline', 0.6, 0.5);
      s.alpha(blA, () => {
        const y3 = h * 0.86;
        const fr = new Frame(s, [rx + rw * 0.1, y3 - u * 3, rw * 0.8, u * 6], [-3, 2.5, 0, 1]);
        s.line(fr.X(-3), y3, fr.X(2.5), y3, s.c('--axis'), 0.3);
        [1.4, -2.0, 0.6, 0.9, -0.3, 1.1].forEach((v) => fr.dot(v, 0.5, 1.3, s.c('gold')));
        const mean = (1.4 - 2.0 + 0.6 + 0.9 - 0.3 + 1.1) / 6;
        s.line(fr.X(mean), y3 - u * 4, fr.X(mean), y3 + u * 4, s.c('--ink'), 0.5);
        s.text('baseline: the average reward', fr.X(mean), y3 - u * 6, { size: 3.2, font: 'ui', color: s.c('--ink-2') });
        s.text('advantage = reward − baseline', fr.X(mean), y3 + u * 7, { size: 3.2, font: 'ui', color: s.c('green') });
      });
    });
    // The KL leash.
    const lA = s.ease('leash', 0.6);
    if (lA > 0) {
      const cx = w * (s.tall ? 0.3 : 0.32);
      const cy = h * 0.55;
      const out = 0.3 + 0.45 * s.ease('kl', 2.4, 0.4) + 0.25 * s.ease('why', 1.5);
      const far = s.tall ? w * 0.42 : w * 0.42;
      const px = cx + far * clamp01(out);
      const py = cy - h * 0.14 * clamp01(out);
      s.alpha(lA, () => {
        // spring
        const c = s.ctx;
        c.beginPath();
        const n = 14;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const x = lerp(cx, px, t);
          const y = lerp(cy, py, t) + (i % 2 ? 1 : -1) * u * 1.6 * (i > 0 && i < n ? 1 : 0);
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
        c.strokeStyle = s.c('red');
        c.lineWidth = u * 0.4;
        c.stroke();
        s.circle(cx, cy, u * 4.5, { fill: s.tint('orange', 0.2), stroke: s.c('orange'), lw: 0.5 });
        s.text('reference', cx, cy + u * 8.5, { size: 3.6, font: 'ui', weight: 600, color: s.c('orange') });
        s.text('frozen', cx, cy + u * 13, { size: 3.2, font: 'ui', color: s.c('--ink-3') });
        s.circle(px, py, u * 4.5, { fill: s.tint('blue', 0.25), stroke: s.c('blue'), lw: 0.5 });
        s.text('policy', px, py - u * 7.5, { size: 3.6, font: 'ui', weight: 600, color: s.c('blue') });
        const kl = 9 * clamp01(out) ** 2;
        s.alpha(s.ease('kl', 0.6), () => {
          pill(s, `KL = ${kl.toFixed(1)}`, (cx + px) / 2, (cy + py) / 2 + u * 7, 'red', { size: 3.4 });
          s.text(`cost: β × KL = ${(0.1 * kl).toFixed(2)}`, w / 2, h * 0.86, { size: 3.8, font: 'mono', weight: 600, color: s.c('red') });
        });
        s.alpha(s.ease('why', 0.6, 1), () =>
          card(s, u * 5, h * 0.14, Math.min(u * 52, w * 0.48), 'red', 'off the leash', '“Great great great answer!!!” scores well, reads badly', { size: 3.3, on: 0.3 }),
        );
      });
    }
  },
};

// ---------------------------------------------------------------- 3. recipe

const RECIPE: { name: string; k: K; chips: string[]; beats: string[] }[] = [
  { name: '1. supervised fine-tuning', k: 'orange', chips: ['prompts', 'labelers write', 'fine-tune: SFT'], beats: ['sft', 'sft', 'sft'] },
  { name: '2. reward model', k: 'gold', chips: ['SFT: A B C D', 'D > C > A = B', 'fit r(x, y)'], beats: ['sample', 'rank', 'rm'] },
  { name: '3. reinforcement learning', k: 'blue', chips: ['policy answers', 'RM score − β·KL', 'PPO update'], beats: ['ppo', 'ppo', 'ppo'] },
];

const recipe: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const order = ['intro', 'sft', 'sample', 'rank', 'rm', 'ppo', 'nohuman'];
    const bA = 1 - s.ease('result', 0.6);
    s.alpha(bA, () => {
      const top = h * 0.13;
      const rowH = (h - top - u * 6) / 3;
      RECIPE.forEach((st, si) => {
        const y = top + si * rowH;
        const stageOn = st.beats.some((b) => s.since(b) >= 0) || si === 0 ? 1 : 0.25;
        const visible = s.since('intro') >= 0 ? smooth((s.since('intro') - si * 0.9) / 0.6) : 0;
        s.alpha(visible * (0.45 + 0.55 * stageOn), () => {
          s.text(st.name, u * 5, y + u * 2.5, { size: 3.6, font: 'ui', weight: 700, align: 'left', color: s.c(st.k) });
          const cw = (w - u * 10 - u * 8 - (si === 2 ? u * 4 : 0)) / 3;
          const ch = Math.min(u * 11, rowH - u * 9);
          st.chips.forEach((c, ci) => {
            const x = u * 5 + ci * (cw + u * 4);
            const cy = y + u * 6;
            const lit = s.since(st.beats[ci]!) >= 0 && (current(s, order) === st.beats[ci] || (si === 2 && current(s, order) === 'nohuman'));
            const on = lit ? 1 : s.since(st.beats[ci]!) >= 0 ? 0.35 : 0.05;
            s.rrect(x, cy, cw, ch, 1.6, { fill: s.tint(st.k, 0.06 + 0.16 * on), stroke: s.tint(st.k, 0.4 + 0.6 * on), lw: 0.3 + 0.3 * on });
            const size = Math.min(3.5, (cw / u) * 0.12);
            s.text(c, x + cw / 2, cy + ch / 2, { size, font: c.includes('>') || c.includes('(') ? 'mono' : 'ui', weight: 600 });
            if (ci < 2) s.arrow(x + cw + u * 0.6, cy + ch / 2, x + cw + u * 3.4, cy + ch / 2, s.c('--ink-3'), 0.35, 1.6);
          });
          if (si === 2) {
            const xr = w - u * 6.5;
            const cy = y + u * 6 + Math.min(u * 11, rowH - u * 9) / 2;
            const x1 = u * 5 + 2 * (cw + u * 4) + cw;
            const loopOn = current(s, order) === 'ppo' || current(s, order) === 'nohuman';
            const col = loopOn ? s.c('blue') : s.c('--ink-3');
            s.line(x1 + u * 0.5, cy, xr, cy, col, 0.35);
            s.line(xr, cy, xr, cy + u * 8.5, col, 0.35);
            s.line(xr, cy + u * 8.5, u * 5 + cw / 2, cy + u * 8.5, col, 0.35);
            s.arrow(u * 5 + cw / 2, cy + u * 8.5, u * 5 + cw / 2, cy + Math.min(u * 11, rowH - u * 9) / 2 + u * 0.6, col, 0.35, 1.6);
            s.text('repeat', (u * 5 + xr) / 2, cy + u * 8.5 - u * 2, { size: 3.1, font: 'ui', color: col });
          }
        });
      });
      s.alpha(s.ease('nohuman', 0.6, 0.5) * (1 - s.ease('result', 0.4)), () => {
        const y = h * 0.13 + 2 * ((h - h * 0.13 - u * 6) / 3);
        pill(s, 'no humans in this stage', w - u * 5, y + u * 2.5, 'red', { align: 'right', font: 'ui', size: 3.3 });
      });
    });
    // 1.3B preferred over 175B.
    const rA = s.ease('result', 0.7, 0.3);
    s.alpha(rA, () => {
      const R = Math.min(w, h) * 0.3;
      const bigR = R;
      const smallR = R * Math.sqrt(1.3 / 175);
      const cyy = h * 0.55;
      const bx = s.tall ? w * 0.62 : w * 0.6;
      const sx = s.tall ? w * 0.2 : w * 0.24;
      s.circle(bx, cyy, bigR, { fill: s.tint('slate', 0.18), stroke: s.c('slate'), lw: 0.4 });
      s.text('GPT-3', bx, cyy - u * 2, { size: 4.6, font: 'display', weight: 600 });
      s.text('175B parameters', bx, cyy + u * 4, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      s.circle(sx, cyy, Math.max(smallR, u * 1.6), { fill: s.tint('blue', 0.4), stroke: s.c('blue'), lw: 0.4 });
      s.text('InstructGPT', sx, cyy - u * 9, { size: 4.2, font: 'display', weight: 600, color: s.c('blue') });
      s.text('1.3B', sx, cyy + u * 7, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      const pk = s.ease('result', 0.5, 4);
      s.alpha(pk, () => {
        check(s, sx, cyy + u * 15, u * 3);
        s.text('preferred by people', sx, cyy + u * 22, { size: 3.4, font: 'ui', weight: 600, color: s.c('green') });
      });
      s.alpha(s.ease('result', 0.6, 7.5), () => s.text('ChatGPT (late 2022): the same methods', w / 2, h * 0.14, { size: 3.6, font: 'ui', italic: true, color: s.c('--ink-2') }));
    });
  },
};

// ---------------------------------------------------------------- 4. comparisons and Bradley-Terry

const RATINGS = [6, 8, 7, 4, 9, 6, 7, 5, 8, 6];

const bt: SceneDef = {
  marks: {
    bt: { tex: String.raw`P(y_w \succ y_l) = \sigma\big(\symr(y_w) - \symr(y_l)\big)`, x: 0.5, y: 0.17, size: 4.6 },
    loss: { tex: String.raw`\mathcal{L} = -\log \sigma\big(\symr(y_w) - \symr(y_l)\big)`, x: 0.5, y: 0.17, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const bw = Math.min(w - u * 12, u * 100);
    const x0 = (w - bw) / 2;
    // Ten raters, ten scales.
    s.alpha(s.win('scales', 'pairs'), () => {
      answer(s, x0, h * 0.16, bw, 'one answer', 'Long ago, people rode a giant rocket to the moon...', 'slate');
      s.text('rate it from 1 to 10:', w / 2, h * 0.47, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
      const cols = s.tall ? 5 : 10;
      const cw = bw / cols;
      RATINGS.forEach((r, i) => {
        const a = s.ease('scales', 0.4, 1.5 + i * 0.25);
        const x = x0 + (i % cols) * cw + cw / 2;
        const y = h * 0.58 + Math.floor(i / cols) * u * 12;
        s.alpha(a, () => {
          s.circle(x, y, u * 4, { fill: s.tint('purple', 0.15), stroke: s.c('purple'), lw: 0.3 });
          s.text(String(r), x, y + u * 0.3, { size: 3.8, font: 'mono', weight: 650, color: s.c('purple') });
        });
      });
    });
    // The triple.
    s.alpha(s.win('pairs', 'rankings'), () => {
      const top = h * 0.14;
      s.text('prompt x: Explain the moon landing to a 6 year old', w / 2, top + u * 2, { size: 3.4, font: 'ui', weight: 600, color: s.c('--ink-2') });
      const cw = s.tall ? bw : (bw - u * 4) / 2;
      const ys = s.tall ? [top + u * 7, top + u * 30] : [top + u * 8, top + u * 8];
      const xs = s.tall ? [x0, x0] : [x0, x0 + cw + u * 4];
      const hh0 = answer(s, xs[0]!, ys[0]!, cw, 'chosen  y_w', 'Long ago, people rode a giant rocket to the moon, and two of them walked on it!', 'green', 0.6, 8);
      check(s, xs[0]! + cw - u * 4.5, ys[0]! + hh0 / 2, u * 2.6);
      answer(s, xs[1]!, ys[1]!, cw, 'rejected  y_l', 'Apollo 11 landed on 20 July 1969, using a lunar module.', 'red', 0.2);
      s.alpha(s.ease('pairs', 0.5, 4.5), () => s.text('data: triples (x, y_w, y_l)', w / 2, Math.max(ys[0]!, ys[1]!) + hh0 + u * 9, { size: 4, font: 'mono', weight: 650 }));
    });
    // Nine answers: 36 pairs.
    s.alpha(s.win('rankings', 'noise'), () => {
      const cx = w / 2;
      const cy = h * 0.53;
      const R = Math.min(w, h) * 0.27;
      const pts = Array.from({ length: 9 }, (_, i) => [cx + R * Math.sin((i / 9) * Math.PI * 2), cy - R * Math.cos((i / 9) * Math.PI * 2)] as [number, number]);
      const shown = Math.floor(s.prog('rankings') * 1.3 * 36);
      let k = 0;
      for (let i = 0; i < 9; i++)
        for (let j = i + 1; j < 9; j++) {
          if (k++ < shown) s.line(pts[i]![0], pts[i]![1], pts[j]![0], pts[j]![1], s.tint('purple', 0.5), 0.25);
        }
      pts.forEach(([x, y], i) => {
        s.circle(x, y, u * 3.6, { fill: s.c('--card'), stroke: s.c('purple'), lw: 0.4 });
        s.text(String(i + 1), x, y + u * 0.3, { size: 3.4, font: 'mono', weight: 650 });
      });
      s.text(`${Math.min(36, shown)} pairs`, cx, h * 0.14, { size: 4.4, font: 'mono', weight: 650, color: s.c('purple') });
      s.text('from one ranking of 9 answers', cx, h * 0.14 + u * 6, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
    });
    // Labelers agree about three quarters of the time.
    s.alpha(s.win('noise', 'model'), () => {
      const cy = h * 0.5;
      for (let i = 0; i < 4; i++) {
        const x = w / 2 + (i - 1.5) * u * 16;
        const k: K = i < 3 ? 'green' : 'red';
        s.circle(x, cy - u * 5, u * 3.2, { fill: s.tint(k, 0.3), stroke: s.c(k), lw: 0.4 });
        s.rrect(x - u * 4.5, cy, u * 9, u * 9, 3, { fill: s.tint(k, 0.3), stroke: s.c(k), lw: 0.4 });
        s.text(i < 3 ? 'A' : 'B', x, cy + u * 16, { size: 4, font: 'mono', weight: 650, color: s.c(k) });
      }
      s.text('labelers agree about 3 times in 4', w / 2, h * 0.28, { size: 4.2, font: 'display', weight: 600 });
    });
    // A language model with one number out.
    s.alpha(s.win('model', 'bt'), () => {
      const bx = w * 0.35;
      const by = h * 0.3;
      const bwd = w * 0.3;
      const bh = h * 0.42;
      s.text('prompt + answer', bx + bwd / 2, by + bh + u * 7, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
      s.arrow(bx + bwd / 2, by + bh + u * 4, bx + bwd / 2, by + bh + u * 0.6, s.c('--ink-3'), 0.4, 1.8);
      s.rrect(bx, by, bwd, bh, 2, { fill: s.tint('gold', 0.08), stroke: s.c('gold'), lw: 0.4 });
      for (let i = 0; i < 4; i++) s.rrect(bx + u * 2, by + u * 3 + i * (bh - u * 6) / 4, bwd - u * 4, (bh - u * 6) / 4 - u * 1.5, 1, { fill: s.tint('gold', 0.14) });
      s.text('transformer', bx + bwd / 2, by + bh / 2, { size: 3.6, font: 'ui', weight: 650, halo: true });
      // vocabulary logits, crossed out
      const vx = bx + bwd + u * 6;
      s.alpha(0.5, () => {
        for (let i = 0; i < 8; i++) s.rrect(vx + i * u * 2.2, by + u * 4 + (i % 3) * u * 2, u * 1.6, u * 12 - (i % 3) * u * 2, 0.4, { fill: s.tint('slate', 0.6) });
      });
      s.line(vx - u, by + u * 3, vx + u * 18, by + u * 17, s.c('red'), 0.5);
      s.text('50k logits', vx + u * 8.5, by + u * 21, { size: 3.2, font: 'ui', color: s.c('--ink-3') });
      const sw = s.ease('model', 0.6, 2.5);
      s.alpha(sw, () => {
        s.arrow(bx + bwd / 2, by - u * 0.6, bx + bwd / 2, by - u * 6, s.c('gold'), 0.5, 2);
        s.cell(bx + bwd / 2 - u * 9, by - u * 15, u * 18, u * 8, 'r = 1.7', 'gold', { on: 0.6, size: 3.8 });
        s.text('one number', bx + bwd / 2 + u * 11, by - u * 11, { size: 3.3, font: 'ui', align: 'left', color: s.c('gold') });
      });
    });
    // The sigmoid of the margin, then the loss.
    const pA = s.ease('bt', 0.6);
    if (pA > 0) {
      const [ax, ay, aw, ah] = area(s, 0.27, 6);
      const fr = new Frame(s, [ax + u * 4, ay, aw - u * 4, ah - u * 6], [-6, 6, -0.05, 1.15]);
      const lossOn = s.ease('loss', 0.8);
      const sig = (m: number) => 1 / (1 + Math.exp(-m));
      s.show('bt', pA * (1 - lossOn));
      s.show('loss', lossOn);
      s.alpha(pA, () => {
        s.line(fr.X(-6), fr.Y(0), fr.X(6), fr.Y(0), s.c('--axis'), 0.3);
        s.line(fr.X(0), fr.Y(-0.05), fr.X(0), fr.Y(1.15), s.c('--axis'), 0.3);
        for (const m of [-4, -2, 2, 4]) s.text(String(m), fr.X(m), fr.Y(0) + u * 3, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
        s.text('margin  r(y_w) − r(y_l)', fr.X(6), fr.Y(0) + u * 7, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-2') });
        s.alpha(1 - lossOn, () => {
          s.line(fr.X(-6), fr.Y(1), fr.X(6), fr.Y(1), s.c('--grid'), 0.2, [1, 1]);
          s.text('1', fr.X(0) - u * 1.5, fr.Y(1), { size: 3.1, font: 'mono', align: 'right', color: s.c('--ink-3') });
          fr.fn(sig, s.c('purple'), 0.8, -6, lerp(-6, 6, s.ease('bt', 1.5, 0.5)));
          const zA = s.ease('zero', 0.5);
          s.alpha(zA, () => {
            fr.dot(0, 0.5, 1.5, s.c('purple'));
            s.text('0.5: a coin flip', fr.X(0) + u * 3, fr.Y(0.5) + u * 3, { size: 3.3, font: 'mono', align: 'left', color: s.c('--ink'), halo: true });
          });
          s.alpha(s.ease('two', 0.5), () => {
            fr.dot(2, sig(2), 1.5, s.c('purple'));
            s.text('0.88', fr.X(2) - u * 3, fr.Y(sig(2)) - u * 3, { size: 3.3, font: 'mono', weight: 650, align: 'right', color: s.c('purple'), halo: true });
          });
        });
        s.alpha(lossOn, () => {
          const lf = new Frame(s, fr.rect, [-6, 6, -0.3, 6.6]);
          const L = (m: number) => Math.log1p(Math.exp(-m));
          lf.fn(L, s.c('red'), 0.8);
          s.text('loss', lf.X(-5.5), lf.Y(6.2), { size: 3.4, font: 'ui', weight: 600, align: 'left', color: s.c('red') });
          const gA = s.ease('grad', 0.6);
          s.alpha(gA, () => {
            const tan = (m: number) => {
              const sl = -1 / (1 + Math.exp(m));
              const d = 1.4;
              s.line(lf.X(m - d), lf.Y(L(m) - sl * d), lf.X(m + d), lf.Y(L(m) + sl * d), s.c('teal'), 0.5);
              lf.dot(m, L(m), 1.3, s.c('red'));
            };
            tan(-3.5);
            tan(3);
            s.text('backwards: steep', lf.X(-3.5) + u * 4, lf.Y(L(-3.5)), { size: 3.3, font: 'ui', weight: 600, align: 'left', color: s.c('teal'), halo: true });
            s.text('already right: flat', lf.X(3), lf.Y(L(3)) - u * 5, { size: 3.3, font: 'ui', weight: 600, color: s.c('teal'), halo: true });
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 5. the toy reward model

const rmtoy: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const side = !s.tall;
    const plotRect: Rect = side ? [u * 12, h * 0.13, w * 0.62, h * 0.72] : [u * 12, h * 0.17, w - u * 17, h * 0.62];
    const fr = toyFrame(s, plotRect, [0, 3.6, 0.32, 0.68]);
    const tA = s.ease('toy', 0.6);
    toyAxes(s, fr, tA, [0, 1, 2, 3]);
    s.alpha(tA, () => {
      for (const q of [0.4, 0.5, 0.6]) s.text(q.toFixed(1), fr.X(0) - u * 1.5, fr.Y(q), { size: 3.1, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
    const step = s.since('ceiling') >= 0 ? 200 : s.since('train') >= 0 ? Math.round(200 * s.prog('train')) : 0;
    const st = RM_TRAJ[step]!;
    const rmA = s.ease('linear', 0.7);
    fr.clip(() => {
      shade(s, fr, (l, q) => T.sigmoid((st.w[0] * (l - T.SFT.l)) / T.SFT.sl / 1.6 + (st.w[1] * (q - T.SFT.q)) / T.SFT.sq / 1.6), 'gold', rmA);
      rmContours(s, fr, st.w, rmA, [-4, -3, -2, -1, 0, 1, 2, 3, 4]);
      const tasteA = s.ease('taste', 0.7) * (1 - 0.75 * s.ease('pairs', 0.6)) + 0.75 * s.ease('curve', 0.7) * (1 - 0.2 * s.ease('straight', 0.5));
      tasteContours(s, fr, tasteA, [5, 6, 7, 8, 9]);
      const cloudA = s.ease('cloud', 0.6) * (1 - s.ease('pairs', 0.6));
      s.alpha(cloudA, () => SFT_CLOUD.forEach(([l, q]) => fr.dot(l, q, 0.9, s.tint('orange', 0.85))));
      const pA = s.ease('pairs', 0.6);
      s.alpha(pA, () => {
        RM_PAIRS.slice(0, 40).forEach((p, i) => {
          const a = clamp01(s.prog('pairs') * 3 - i / 40) * (s.since('train') >= 0 ? 1 : 1);
          if (a <= 0) return;
          const ok = (st.w[0] * (T.feats(p.chosen)[0] - T.feats(p.rejected)[0]) + st.w[1] * (T.feats(p.chosen)[1] - T.feats(p.rejected)[1])) > 0;
          s.alpha(a, () => {
            s.line(fr.X(p.chosen[0]), fr.Y(p.chosen[1]), fr.X(p.rejected[0]), fr.Y(p.rejected[1]), s.tint('--ink-3', rmA > 0.5 && !ok ? 0.95 : 0.45), rmA > 0.5 && !ok ? 0.35 : 0.22);
            s.circle(fr.X(p.rejected[0]), fr.Y(p.rejected[1]), u * 0.9, { fill: s.c('--card'), stroke: s.c('--ink'), lw: 0.25 });
            s.circle(fr.X(p.chosen[0]), fr.Y(p.chosen[1]), u * 1, { fill: s.c('--ink') });
          });
        });
      });
      // the linear model's guess beyond the cloud
      s.alpha(s.ease('straight', 0.6, 0.6), () => {
        const [cl, cq] = [T.SFT.l, T.SFT.q];
        s.arrow(fr.X(cl), fr.Y(cq), fr.X(3.3), fr.Y(cq + 0.06), s.c('gold'), 0.7, 2.6);
        s.text('“longer is better”', fr.X(2.6), fr.Y(cq + 0.1), { size: 3.4, font: 'ui', weight: 650, color: s.c('gold'), halo: true });
      });
    });
    // Legend and readouts.
    const lx = side ? plotRect[0] + plotRect[2] + u * 5 : plotRect[0];
    const ly = side ? h * 0.18 : h * 0.07;
    const items: [string, K, number][] = [
      ['SFT answers', 'orange', s.ease('cloud', 0.6) * (1 - s.ease('pairs', 0.6))],
      ['labelers’ taste', 'green', s.ease('taste', 0.6)],
      ['reward model', 'gold', rmA],
    ];
    if (side) {
      items.forEach(([t, k, a], i) => s.alpha(a, () => {
        s.line(lx, ly + i * u * 6, lx + u * 4, ly + i * u * 6, s.c(k), 0.6, k === 'green' ? [1.2, 0.8] : undefined);
        s.text(t, lx + u * 5.5, ly + i * u * 6, { size: 3.3, font: 'ui', align: 'left', color: s.c('--ink-2') });
      }));
      s.alpha(rmA, () => {
        s.text('held-out accuracy', lx, h * 0.46, { size: 3.3, font: 'ui', align: 'left', color: s.c('--ink-2') });
        s.text(`${Math.round(st.acc * 100)}%`, lx, h * 0.54, { size: 7, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
        s.text(`step ${step}`, lx, h * 0.61, { size: 3.3, font: 'mono', align: 'left', color: s.c('--ink-3') });
        s.alpha(s.ease('ceiling', 0.6, 1), () => {
          s.text('labelers’ own ceiling', lx, h * 0.69, { size: 3.3, font: 'ui', align: 'left', color: s.c('--ink-2') });
          s.text(`${Math.round(RM_CEILING * 100)}%`, lx, h * 0.76, { size: 5, font: 'mono', weight: 650, align: 'left', color: s.c('green') });
        });
      });
    } else {
      s.alpha(rmA, () => {
        pill(s, `accuracy ${Math.round(st.acc * 100)}%`, lx, plotRect[1] - u * 4.5, 'gold', { align: 'left', size: 3.4 });
        s.alpha(s.ease('ceiling', 0.6, 1), () => pill(s, `ceiling ${Math.round(RM_CEILING * 100)}%`, plotRect[0] + plotRect[2], plotRect[1] - u * 4.5, 'green', { align: 'right', size: 3.4 }));
      });
      s.alpha(s.ease('taste', 0.6) * (1 - rmA), () => pill(s, 'dashed: the labelers’ taste', lx, plotRect[1] - u * 4.5, 'green', { align: 'left', size: 3.3, font: 'ui' }));
    }
    s.slot('step', step);
    s.slot('acc', `${Math.round(st.acc * 100)}%`);
  },
};

// ---------------------------------------------------------------- 6. reusing a batch

const P_OLD = T.softmax(T.LOGITS_INIT);
const P_NEW = T.softmax(T.LOGITS_INIT.map((v, k) => v + [0.85, -0.2, -0.7, -0.1, 0.15][k]!));

function answerBars(s: Scene, r: Rect, pNew: number[], showRatio: number, hi: number): void {
  const [x, y, w, h] = r;
  const u = s.u;
  const cw = w / 5;
  const sc = (h - u * 16) / 0.45;
  const base = y + h - u * 9;
  s.line(x, base, x + w, base, s.c('--axis'), 0.3);
  T.ANSWERS.forEach((name, k) => {
    const cx = x + k * cw + cw / 2;
    const bw = cw * 0.3;
    s.rrect(cx - bw - u * 0.4, base - P_OLD[k]! * sc, bw, P_OLD[k]! * sc, 0.6, { fill: s.tint('slate', 0.25), stroke: s.tint('slate', 0.7), lw: 0.25 });
    s.rrect(cx + u * 0.4, base - pNew[k]! * sc, bw, pNew[k]! * sc, 0.6, { fill: s.tint('blue', k === hi ? 0.75 : 0.45), stroke: s.c('blue'), lw: 0.25 });
    s.text(name, cx, base + u * 3.4, { size: 3.3, font: 'ui', weight: 600 });
    s.alpha(showRatio, () => {
      const rho = pNew[k]! / P_OLD[k]!;
      s.text(`ρ ${rho.toFixed(2)}`, cx, base - Math.max(P_OLD[k]!, pNew[k]!) * sc - u * 3, { size: 3.3, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
    });
  });
  s.rrect(x, y, u * 3, u * 3, 0.6, { fill: s.tint('slate', 0.25), stroke: s.tint('slate', 0.7), lw: 0.25 });
  s.text('old policy (sampled)', x + u * 4.5, y + u * 1.5, { size: 3.2, font: 'ui', align: 'left', color: s.c('--ink-2') });
  const lx = x + w * 0.52;
  s.rrect(lx, y, u * 3, u * 3, 0.6, { fill: s.tint('blue', 0.45), stroke: s.c('blue'), lw: 0.25 });
  s.text('policy now', lx + u * 4.5, y + u * 1.5, { size: 3.2, font: 'ui', align: 'left', color: s.c('--ink-2') });
}

const ratio: SceneDef = {
  marks: {
    rho: { tex: String.raw`\symrho_t = \frac{\sympi(a_t \mid s_t)}{\sym{pi}{\pi_{\theta_\text{old}}}(a_t \mid s_t)}`, x: 0.5, y: 0.19, size: 5.8 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Generation is slow: answers typed out token by token.
    s.alpha(s.win('cost', 'once'), () => {
      const rows = 5;
      const cols = s.tall ? 9 : 14;
      const cw = (w - u * 14) / cols;
      const t = s.since('cost') * 7;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const idx = c * rows + r;
          const a = clamp01(t - idx * 0.35);
          if (a <= 0) continue;
          s.alpha(a, () => s.cell(u * 7 + c * cw, h * 0.22 + r * u * 9, cw - u * 0.8, u * 7, '', 'blue', { on: a < 1 ? 1 : 0.1 }));
        }
      s.text('a batch of answers, sampled one token at a time', w / 2, h * 0.16, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
      s.alpha(s.ease('cost', 0.6, 3), () => pill(s, 'the slow part', w / 2, h * 0.75, 'red', { size: 3.6, font: 'ui' }));
    });
    // REINFORCE: one step, then discard.
    s.alpha(s.win('once', 'stale'), () => {
      const y = h * 0.45;
      const bx = w * 0.1;
      const bwid = w * 0.26;
      s.rrect(bx, y - u * 9, bwid, u * 18, 2, { fill: s.tint('blue', 0.12), stroke: s.c('blue'), lw: 0.4 });
      s.text('batch', bx + bwid / 2, y, { size: 4, font: 'ui', weight: 650, color: s.c('blue') });
      s.arrow(bx + bwid + u * 2, y, w * 0.6, y, s.c('--ink-3'), 0.45, 2.2);
      s.text('1 step', (bx + bwid + u * 2 + w * 0.6) / 2, y - u * 4, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      s.alpha(s.ease('once', 0.5, 1.6), () => {
        cross(s, w * 0.72, y, u * 4);
        s.text('thrown away', w * 0.72, y + u * 9, { size: 3.4, font: 'ui', color: s.c('red') });
      });
      s.alpha(s.ease('once', 0.5, 3.4), () => s.text('several steps instead?', w / 2, h * 0.75, { size: 4.4, font: 'display', italic: true }));
    });
    // Ratios: the batch was sampled from the old policy.
    const bA = s.win('stale', 'limit');
    if (bA > 0) {
      const back = s.ease('first', 0.9, 0.3);
      const fwd = s.ease('stale', 1.2, 1);
      const mix = fwd * (1 - back);
      const pNew = P_OLD.map((p, k) => lerp(p, P_NEW[k]!, mix));
      const r: Rect = [u * 8, h * 0.36, w - u * 16, h * 0.56];
      s.alpha(bA, () => {
        answerBars(s, r, pNew, s.ease('is', 0.6, 1.5), s.since('double') >= 0 && s.since('first') < 0 ? 0 : -1);
        s.alpha(s.ease('double', 0.6, 0.5) * (1 - s.ease('first', 0.4)), () => s.text('story is now twice as likely: it counts twice', w / 2, h * 0.3, { size: 3.6, font: 'ui', weight: 600, color: s.c('purple') }));
        s.alpha(s.ease('first', 0.6, 1), () => s.text('first step: every ρ = 1, plain REINFORCE', w / 2, h * 0.3, { size: 3.6, font: 'ui', weight: 600, color: s.c('purple') }));
      });
      s.show('rho', bA * s.ease('is', 0.6) );
      s.alpha(bA * s.ease('stale', 0.6) * (1 - s.ease('is', 0.5)), () => s.text('after one step, the batch is stale', w / 2, h * 0.2, { size: 4, font: 'display', italic: true }));
    }
    // Sixteen runs.
    const cA = s.ease('limit', 0.6);
    if (cA > 0) {
      const fr = new Frame(s, [u * 14, h * 0.16, w - u * 22, h * (s.tall ? 0.56 : 0.6)], [0, 30, -0.3, 1.75]);
      runsAxes(s, fr, cA);
      s.alpha(cA * (1 - s.ease('runs', 0.5)), () => s.text('12 answers per batch, 30 batches, 16 runs', w / 2, h * 0.5, { size: 3.8, font: 'ui', weight: 600, color: s.c('--ink-2') }));
      const p1 = s.since('runs') >= 0 ? s.prog('runs') * 1.4 * 30 : 0;
      const p20 = s.since('twenty') >= 0 ? s.prog('twenty') * 1.4 * 30 : 0;
      runsChart(s, fr, RUNS_1, p1, s.ease('runs', 0.3) * (1 - 0.75 * s.ease('twenty', 0.6)));
      runsChart(s, fr, RUNS_20, p20, s.ease('twenty', 0.3), { colorWrong: s.since('twenty') >= 0 });
      const ly = h * (s.tall ? 0.84 : 0.86);
      s.alpha(s.ease('runs', 0.4) * (1 - s.ease('twenty', 0.4)), () => pill(s, '1 step per batch', w / 2, ly, 'blue', { size: 3.5, font: 'ui' }));
      s.alpha(s.ease('twenty', 0.4), () => {
        pill(s, '20 steps per batch', w * 0.3, ly, 'blue', { size: 3.5, font: 'ui' });
        s.alpha(s.ease('twenty', 0.5, 4), () => pill(s, `${RUNS_20.filter(wrongRun).length} of 16 stuck`, w * 0.72, ly, 'red', { size: 3.5, font: 'ui' }));
      });
      s.alpha(s.ease('stuck', 0.6), () => {
        const stuck = RUNS_20.filter(wrongRun);
        stuck.forEach((r) => {
          const end = r.J[30]!;
          const name = T.ANSWERS[r.probs.indexOf(Math.max(...r.probs))]!;
          fr.dot(30, end, 1.3, s.c('red'));
          s.text(name, fr.X(29), fr.Y(end) - u * 2.8, { size: 3.2, font: 'ui', weight: 650, align: 'right', color: s.c('red'), halo: true });
        });
      });
    }
    s.slot('K', s.since('twenty') >= 0 ? 20 : 1);
  },
};

// ---------------------------------------------------------------- 7. the clipped surrogate

const clip: SceneDef = {
  marks: {
    clip: { tex: String.raw`\min\!\big(\symrho\,\symA,\;\operatorname{clip}(\symrho,\,1-\symeps,\,1+\symeps)\,\symA\big)`, x: 0.5, y: 0.17, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // TRPO: a trust region.
    s.alpha(s.win('trpo', 'ppo'), () => {
      const cx = w / 2;
      const cy = h * 0.52;
      const R = Math.min(w, h) * 0.24;
      const c = s.ctx;
      c.save();
      c.setLineDash([u * 1.4, u * 1]);
      s.circle(cx, cy, R, { fill: s.tint('slate', 0.08), stroke: s.c('slate'), lw: 0.4 });
      c.restore();
      s.circle(cx, cy, u * 2.2, { fill: s.c('slate') });
      s.text('old policy', cx, cy + u * 5.5, { size: 3.3, font: 'ui', color: s.c('--ink-2') });
      const p = s.ease('trpo', 2.5, 1.5);
      const ang = -0.6;
      const dist = R * 1.5 * p;
      const d = Math.min(dist, R * 0.92);
      const px = cx + Math.cos(ang) * d;
      const py = cy + Math.sin(ang) * d;
      s.alpha(0.35, () => s.arrow(cx, cy, cx + Math.cos(ang) * Math.max(dist, 1), cy + Math.sin(ang) * Math.max(dist, 1), s.c('blue'), 0.4, 2));
      s.circle(px, py, u * 2.2, { fill: s.c('blue') });
      s.text('new', px + u * 4, py, { size: 3.3, font: 'ui', weight: 600, align: 'left', color: s.c('blue') });
      s.text('KL(old, new) ≤ δ', cx, cy - R - u * 4, { size: 3.8, font: 'mono', weight: 600, color: s.c('slate') });
      s.text('TRPO (2015): a trust region', cx, h * 0.14, { size: 4, font: 'display', weight: 600 });
    });
    // The objective as a function of the ratio.
    const pA = s.ease('ppo', 0.6) * (1 - s.ease('back', 0.6));
    if (pA > 0) {
      const A = lerp(1, -1, s.ease('neg', 1.4, 0.4));
      const eps = 0.2;
      const r: Rect = [u * 12, h * 0.28, w - u * 18, h * 0.6];
      const fr = new Frame(s, r, [0, 2.1, -2.3, 2.3]);
      const showU = s.ease('formula', 0.5, 0.4);
      const showC = s.ease('formula', 0.5, 2.6);
      const showM = s.ease('formula', 0.5, 4.8);
      s.show('clip', pA * s.ease('formula', 0.6));
      s.alpha(pA, () => {
        s.alpha(s.ease('eps', 0.6), () => {
          s.ctx.fillStyle = s.tint('slate', 0.14);
          s.ctx.fillRect(fr.X(1 - eps), r[1], fr.X(1 + eps) - fr.X(1 - eps), r[3]);
          s.text('0.8', fr.X(0.8), r[1] + r[3] + u * 3, { size: 3.2, font: 'mono', weight: 650, color: s.c('slate') });
          s.text('1.2', fr.X(1.2), r[1] + r[3] + u * 3, { size: 3.2, font: 'mono', weight: 650, color: s.c('slate') });
        });
        s.line(fr.X(0), fr.Y(0), fr.X(2.1), fr.Y(0), s.c('--axis'), 0.3);
        s.line(fr.X(1), r[1], fr.X(1), r[1] + r[3], s.tint('--ink-3', 0.8), 0.25, [1, 1]);
        for (const x of [0, 0.5, 1.5, 2]) s.text(String(x), fr.X(x), r[1] + r[3] + u * 3, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
        s.text('ratio ρ', fr.X(2.1), fr.Y(0) + (A > 0 ? u * 3.5 : -u * 3.5), { size: 3.3, font: 'ui', italic: true, align: 'right', color: s.c('purple') });
        s.text(`advantage ${A > 0 ? '+' : ''}${A.toFixed(1)}`, r[0], r[1] - u * 2.5, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c(A >= 0 ? 'green' : 'red') });
        s.alpha(showU, () => {
          fr.fn((x) => x * A, s.tint('purple', 0.8), 0.45, 0, 2.1, [1.4, 1.1]);
          const ux = A > 0 ? 1.95 : 0.12;
          s.text('ρ Â', fr.X(ux), fr.Y(ux * A) - u * 3, { size: 3.3, font: 'serif', italic: true, weight: 600, align: A > 0 ? 'right' : 'left', color: s.c('purple'), halo: true });
        });
        s.alpha(showC, () => {
          fr.fn((x) => T.clamp(x, 1 - eps, 1 + eps) * A, s.tint('slate', 0.95), 0.45, 0, 2.1, [0.4, 0.8]);
          const cx = A > 0 ? 0.05 : 2.05;
          s.alpha(1 - s.ease('below', 0.4) * (1 - s.ease('neg', 0.4)), () => s.text('clipped', fr.X(cx), fr.Y(T.clamp(cx, 1 - eps, 1 + eps) * A) - u * 2.8, { size: 3.2, font: 'ui', weight: 600, align: A > 0 ? 'left' : 'right', color: s.c('slate'), halo: true }));
        });
        s.alpha(showM, () => {
          const N = 80;
          for (let i = 0; i < N; i++) {
            const a = (2.1 * i) / N;
            const b = (2.1 * (i + 1)) / N;
            const flat = T.clipSlope((a + b) / 2, A, eps) === 0;
            s.line(fr.X(a), fr.Y(T.clipObj(a, A, eps)), fr.X(b), fr.Y(T.clipObj(b, A, eps)), flat ? s.c('red') : s.c('green'), 0.9);
          }
        });
        // the moving token
        const beat = current(s, ['pos', 'flat', 'below', 'neg', 'negflat', 'negabove', 'pessimism']);
        if (beat) {
          let rho = 1;
          if (beat === 'pos') rho = lerp(0.6, 1.2, smooth(s.prog('pos')));
          else if (beat === 'flat') rho = lerp(1.2, 1.75, smooth(s.prog('flat') * 1.4));
          else if (beat === 'below') rho = 0.5;
          else if (beat === 'neg') rho = 1;
          else if (beat === 'negflat') rho = lerp(1, 0.5, smooth(s.prog('negflat') * 1.3));
          else if (beat === 'negabove') rho = 1.6;
          else rho = 1.6;
          const o = T.clipObj(rho, A, eps);
          const g = T.clipSlope(rho, A, eps);
          const px = fr.X(rho);
          const py = fr.Y(o);
          if (g !== 0) s.arrow(px, py, px + Math.sign(g) * u * 9, py, s.c('green'), 0.6, 2.2);
          s.circle(px, py, u * 1.8, { fill: s.c('--card'), stroke: s.c('purple'), lw: 0.6 });
          const msg = g === 0 ? 'flat: no push' : beat === 'below' ? 'full gradient: pull it back up' : beat === 'negabove' || beat === 'pessimism' ? 'full penalty: push it down' : g > 0 ? 'pushes ρ up' : 'pushes ρ down';
          const below = A < 0 || beat !== 'below';
          s.text(msg, T.clamp(px, r[0] + u * 16, r[0] + r[2] - u * 16), py + (below ? u * 5 : -u * 5), { size: 3.3, font: 'ui', weight: 650, color: g === 0 ? s.c('red') : s.c('green'), halo: true });
        }
        s.alpha(s.ease('pessimism', 0.6, 1.5), () => pill(s, 'pessimistic: never hides a wrong step', w / 2, r[1] + r[3] + u * 9, 'slate', { size: 3.4, font: 'ui' }));
      });
    }
    // Back to the runs, now clipped.
    const bA = s.ease('back', 0.6);
    if (bA > 0) {
      const fr = new Frame(s, [u * 14, h * 0.16, w - u * 22, h * (s.tall ? 0.56 : 0.6)], [0, 30, -0.3, 1.75]);
      runsAxes(s, fr, bA);
      runsChart(s, fr, RUNS_20, 30, bA * 0.18, { mean: false });
      runsChart(s, fr, RUNS_CLIP, s.prog('back') * 1.3 * 30, bA, { colorWrong: true });
      s.alpha(bA, () => {
        const ly = h * (s.tall ? 0.84 : 0.86);
        pill(s, '20 steps per batch, clipped', w * 0.36, ly, 'blue', { size: 3.5, font: 'ui' });
        s.alpha(s.ease('back', 0.5, 3), () => pill(s, `${RUNS_CLIP.filter(wrongRun).length} of 16 stuck`, w * 0.78, ly, 'green', { size: 3.5, font: 'ui' }));
      });
    }
  },
};

// ---------------------------------------------------------------- 8. the value head and GAE

const gae: SceneDef = {
  marks: {
    delta: { tex: String.raw`\delta_t = r_t + \symV(s_{t+1}) - \symV(s_t)`, x: 0.5, y: 0.1, size: 4.4 },
    adv: { tex: String.raw`\symA_t = \textstyle\sum_{l} \symlam^{l}\, \delta_{t+l}`, x: 0.5, y: 0.1, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const N = T.GAE_T;
    const rollA = s.ease('credit', 0.6) * (1 - s.ease('toy', 0.6));
    // which lambda the bars show
    let lam = 0;
    if (s.since('lam1') >= 0) lam = 1;
    if (s.since('gae') >= 0) lam = smooth(s.prog('gae') * 1.2);
    if (s.since('kernel') >= 0) lam = s.prog('kernel') < 0.5 ? 0.3 : 0.95;
    if (s.since('flawed') >= 0) lam = 0;
    if (s.since('one') >= 0) lam = 1;
    if (s.since('between') >= 0) lam = 0.95;
    s.slot('lam', fmt(lam, 2));
    if (rollA > 0) {
      const ro = GAE_SHOW;
      const { values, deltas, adv } = T.gae(ro, lam, 0);
      const left = u * 9;
      const cw = (w - left - u * 9) / N;
      const xc = (t: number) => left + (t + 0.5) * cw;
      const xb = (t: number) => left + t * cw;
      const tokY = h * 0.41;
      const vTop = h * 0.24;
      const vBot = h * 0.37;
      const vy = (v: number) => vBot - ((vBot - vTop) * v) / 8;
      const reveal = s.ease('delta', 0.6);
      s.show('delta', rollA * s.win('delta', 'gae'));
      s.show('adv', rollA * s.ease('gae', 0.6));
      s.alpha(rollA, () => {
        for (let t = 0; t < N; t++) {
          const good = ro.good[t]!;
          const k: K = reveal > 0.5 ? (good ? 'green' : 'slate') : 'slate';
          s.cell(xc(t) - cw * 0.4, tokY, cw * 0.8, u * 6.5, String(t), k, { on: t === GAE_TOK && s.since('kernel') >= 0 ? 1 : good && reveal > 0.5 ? 0.5 : 0.1, size: 3.2 });
          s.alpha(1 - s.ease('value', 0.5), () => s.text('?', xc(t), tokY - u * 3.5, { size: 3.8, font: 'mono', weight: 650, color: s.c('--ink-3') }));
        }
        pill(s, `reward at the end: ${ro.R.toFixed(1)}`, xb(N), vTop - u * 3, 'gold', { align: 'right', size: 3.2, font: 'ui' });
        // value line
        s.alpha(s.ease('value', 0.6), () => {
          const vs = values.slice(0, N);
          for (let t = 0; t < N - 1; t++) s.line(xb(t), vy(vs[t]!), xb(t + 1), vy(vs[t + 1]!), s.c('teal'), 0.5);
          vs.forEach((v, t) => s.circle(xb(t), vy(v), u * 0.9, { fill: s.c('teal') }));
          s.text('V', left - u * 4, vy(5), { size: 4.2, font: 'serif', italic: true, weight: 650, color: s.c('teal') });
          s.text('V: reward still to come', xb(0), vTop + u * 3, { size: 3.2, font: 'ui', align: 'left', color: s.c('teal'), halo: true });
        });
        // bars
        const big = Math.max(1.2, ...deltas.map(Math.abs), ...adv.map(Math.abs));
        const band = (mid: number, half: number, vals: number[], k: K, alpha: (t: number) => number, sym: string, a: number) =>
          s.alpha(a, () => {
            s.line(xb(0), mid, xb(N), mid, s.c('--axis'), 0.25);
            s.text(sym, left - u * 4, mid, { size: 4.2, font: 'serif', italic: true, weight: 650, color: s.c(k) });
            vals.forEach((v, t) => {
              const hh = (v / big) * half;
              s.ctx.fillStyle = s.tint(k, alpha(t));
              s.ctx.fillRect(xc(t) - cw * 0.28, hh >= 0 ? mid - hh : mid, cw * 0.56, Math.max(1, Math.abs(hh)));
            });
          });
        const kernelOn = s.since('kernel') >= 0;
        band(h * 0.63, h * 0.085, deltas, 'teal', (t) => (kernelOn ? (t < GAE_TOK ? 0.12 : 0.15 + 0.85 * Math.pow(lam, t - GAE_TOK)) : 0.8), 'δ', s.ease('delta', 0.6));
        band(h * 0.865, h * 0.085, adv, 'green', (t) => (kernelOn && t !== GAE_TOK ? 0.3 : 0.85), 'Â', s.ease('lam0', 0.6));
        s.alpha(s.ease('lam0', 0.6), () => {
          const tag = s.since('gae') >= 0 || s.since('lam1') < 0 ? `λ = ${lam.toFixed(2)}` : 'λ = 1';
          pill(s, s.since('lam1') < 0 ? 'λ = 0: Â = δ' : tag, w - u * 5, h * 0.75, 'slate', { align: 'right', size: 3.3 });
        });
        s.alpha(s.ease('kernel', 0.5), () => {
          for (let t = GAE_TOK; t < N; t++) {
            const wgt = Math.pow(lam, t - GAE_TOK);
            if (cw < u * 7 && (t - GAE_TOK) % 2 === 1) continue;
            s.text(wgt > 0.995 ? '1' : wgt.toFixed(2).replace(/^0/, ''), xc(t), tokY + u * 9.5, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
          }
        });
      });
    }
    // Many rollouts: good versus bad tokens, with a flawed critic.
    const sA = s.ease('toy', 0.6) * (1 - s.ease('vloss', 0.6));
    if (sA > 0) {
      const gi = Math.round(lam * 20);
      const st = GAE_GRID[gi]!;
      const fr = new Frame(s, [u * 8, h * 0.2, w - u * 16, h * (s.tall ? 0.38 : 0.42)], [-4.5, 4.5, -0.8, 1.9]);
      s.alpha(sA, () => {
        s.text(`token ${GAE_TOK}'s advantage over many rollouts`, w / 2, h * 0.15, { size: 3.5, font: 'ui', weight: 600, color: s.c('--ink-2') });
        for (let x = -4; x <= 4; x += 2) {
          s.line(fr.X(x), fr.Y(-0.5), fr.X(x), fr.Y(1.5), x === 0 ? s.c('--axis') : s.c('--grid'), 0.2);
          s.text(String(x), fr.X(x), fr.Y(-0.75), { size: 3.1, font: 'mono', color: s.c('--ink-3') });
        }
        const strip = (vals: number[], y: number, k: K, name: string) => {
          vals.forEach((v, i) => {
            const jit = (((i * 7919) % 97) / 97 - 0.5) * 0.36;
            fr.dot(T.clamp(v, -4.4, 4.4), y + jit, 0.75, s.tint(k, 0.65), 'transparent');
          });
          const m = vals.reduce((a, b) => a + b, 0) / vals.length;
          s.line(fr.X(m), fr.Y(y - 0.32), fr.X(m), fr.Y(y + 0.32), s.c(k), 0.8);
          s.text(name, fr.X(-4.4), fr.Y(y + 0.42), { size: 3.2, font: 'ui', weight: 650, align: 'left', color: s.c(k), halo: true });
          return m;
        };
        const show = s.ease('flawed', 0.5);
        s.alpha(show, () => {
          strip(st.good, 1, 'green', 'good tokens');
          strip(st.bad, 0, 'slate', 'bad tokens');
          const yb = fr.Y(1.65);
          const a = st.gap;
          s.text(`gap ${a.toFixed(2)}   noise ${st.spread.toFixed(2)}`, w / 2, yb, { size: 3.6, font: 'mono', weight: 650 });
        });
        s.alpha(s.ease('toy', 0.6, 1) * (1 - show), () => {
          s.text('true gap between good and bad: 1', w / 2, fr.Y(0.5), { size: 4, font: 'display', weight: 600, halo: true });
          s.text('and the value head is flawed', w / 2, fr.Y(0.5) + u * 7, { size: 3.6, font: 'ui', italic: true, color: s.c('--ink-2'), halo: true });
        });
        // gap and noise against lambda
        const cr: Rect = [u * 14, h * (s.tall ? 0.7 : 0.72), w - u * 22, h * (s.tall ? 0.2 : 0.18)];
        const cf = new Frame(s, cr, [0, 1, 0, 2]);
        s.alpha(s.ease('between', 0.6), () => {
          s.line(cf.X(0), cf.Y(0), cf.X(1), cf.Y(0), s.c('--axis'), 0.25);
          s.line(cf.X(0), cf.Y(1), cf.X(1), cf.Y(1), s.tint('green', 0.6), 0.25, [1, 1]);
          cf.path(GAE_GRID.map((g) => g.lam), GAE_GRID.map((g) => g.gap), s.c('green'), 0.6);
          cf.path(GAE_GRID.map((g) => g.lam), GAE_GRID.map((g) => g.spread), s.c('slate'), 0.6);
          s.line(cf.X(lam), cr[1], cf.X(lam), cr[1] + cr[3], s.c('--accent'), 0.4);
          s.text('λ = 0', cf.X(0), cr[1] + cr[3] + u * 3, { size: 3.1, font: 'mono', align: 'left', color: s.c('--ink-3') });
          s.text('λ = 1', cf.X(1), cr[1] + cr[3] + u * 3, { size: 3.1, font: 'mono', align: 'right', color: s.c('--ink-3') });
          s.text('gap', cf.X(0.02), cf.Y(1.7), { size: 3.2, font: 'ui', weight: 650, align: 'left', color: s.c('green') });
          s.text('noise', cf.X(0.14), cf.Y(1.7), { size: 3.2, font: 'ui', weight: 650, align: 'left', color: s.c('slate') });
        });
      });
    }
    // The value head learns by regression.
    const vA = s.ease('vloss', 0.6);
    if (vA > 0) {
      const ro = GAE_SHOW;
      const { values, adv } = T.gae(ro, 0.95, GAE_K);
      const v0 = values.slice(0, N);
      const targets = adv.map((a, t) => a + v0[t]!);
      const all = [...v0, ...targets];
      const lo = Math.floor(Math.min(...all) - 0.5);
      const hi = Math.ceil(Math.max(...all) + 0.5);
      const fr = new Frame(s, [u * 14, h * 0.27, w - u * 22, h * 0.5], [-0.5, N - 0.5, lo, hi]);
      const p = s.ease('vloss', 2.5, 1.2);
      const fit = v0.map((v, t) => lerp(v, targets[t]!, p * 0.85));
      const xs = fit.map((_, t) => t);
      s.alpha(vA, () => {
        s.text('value head: regression onto the returns', w / 2, h * 0.14, { size: 3.8, font: 'ui', weight: 600, color: s.c('teal') });
        for (let y = lo; y <= hi; y++) {
          s.line(fr.X(-0.5), fr.Y(y), fr.X(N - 0.5), fr.Y(y), s.c('--grid'), 0.2);
          s.text(String(y), fr.X(-0.5) - u * 1.5, fr.Y(y), { size: 3.1, font: 'mono', align: 'right', color: s.c('--ink-3') });
        }
        fr.path(xs, v0, s.tint('teal', 0.4), 0.4, [1.2, 1]);
        targets.forEach((v, t) => s.line(fr.X(t), fr.Y(fit[t]!), fr.X(t), fr.Y(v), s.tint('red', 0.6), 0.35));
        fr.path(xs, fit, s.c('teal'), 0.6);
        fit.forEach((v, t) => fr.dot(t, v, 0.9, s.c('teal')));
        targets.forEach((v, t) => fr.dot(t, v, 1.2, s.c('gold')));
        const ly = h * 0.21;
        pill(s, 'returns: Â + old V', w * 0.32, ly, 'gold', { size: 3.2, font: 'ui' });
        pill(s, 'V, learning', w * 0.7, ly, 'teal', { size: 3.2, font: 'ui' });
        s.text('red: the squared error being minimized', w / 2, h * 0.85, { size: 3.2, font: 'ui', italic: true, color: s.c('red') });
      });
    }
  },
};

// ---------------------------------------------------------------- 9. the KL penalty

const kl: SceneDef = {
  marks: {
    sum: { tex: String.raw`\log \sympi(y \mid x) = \textstyle\sum_t \log \sympi(a_t \mid s_t)`, x: 0.5, y: 0.15, size: 4.4 },
    rt: { tex: String.raw`r_t = -\symbeta \log \frac{\sympi(a_t \mid s_t)}{\sympiref(a_t \mid s_t)} \;+\; \mathbf{1}[t = T]\, \symr`, x: 0.5, y: 0.15, size: 4.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    const L = T.LINE;
    const n = L.tokens.length;
    const beta = s.since('beta') >= 0 ? lerp(0.1, 0.3, s.ease('beta', 2.5, 1)) : 0.1;
    s.slot('beta', fmt(beta, 2));
    const total = T.tokenRewards(beta).reduce((a, b) => a + b, 0);
    s.slot('total', fmt(total, 3));
    s.show('sum', s.win('chain', 'fold'));
    s.show('rt', s.win('fold', 'sure'));
    // flow the tokens as chips, wrapping lines
    const size = 3.4;
    const pad = u * 1.4;
    const gap = u * 1.2;
    const maxW = w - u * 12;
    const lineH = u * 22;
    const pos: { x: number; y: number; cw: number }[] = [];
    let x = 0;
    let line = 0;
    for (let t = 0; t < n; t++) {
      const cw = s.measure(L.tokens[t]!.replace(/^ /, '␣'), { font: 'mono', size, weight: 550 }) + 2 * pad;
      if (x + cw > maxW && x > 0) {
        line++;
        x = 0;
      }
      pos.push({ x, y: line, cw });
      x += cw + gap;
    }
    const lines = line + 1;
    const y0 = h * 0.27;
    const lineWidth = (li: number) => {
      const ps = pos.filter((p) => p.y === li);
      const last = ps[ps.length - 1]!;
      return last.x + last.cw;
    };
    const chipsA = s.ease('chain', 0.6);
    const ratioA = s.ease('sample', 0.6, 0.6);
    const penA = s.ease('fold', 0.6, 0.6);
    const focus = current(s, ['sure', 'cheap', 'neg']);
    s.alpha(chipsA, () => {
      pos.forEach((p, t) => {
        const ox = (w - lineWidth(p.y)) / 2;
        const cx = ox + p.x;
        const cy = y0 + p.y * lineH;
        const lr = L.logp[t]! - L.logpRef[t]!;
        const hot = focus === 'sure' ? t < 2 : focus === 'cheap' ? t >= 2 && t !== 9 : focus === 'neg' ? t === 9 : false;
        const dim = focus && !hot ? 0.45 : 1;
        s.alpha(dim, () => {
          s.cell(cx, cy, p.cw, u * 7, '', 'blue', { on: hot ? 0.9 : 0.15 });
          s.text(L.tokens[t]!.replace(/^ /, '␣'), cx + p.cw / 2, cy + u * 3.7, { size, font: 'mono', weight: 550 });
          s.alpha(ratioA, () => s.text((lr >= 0 ? '+' : '') + lr.toFixed(1), cx + p.cw / 2, cy + u * 10.5, { size: 3.2, font: 'mono', weight: 600, color: s.c('red') }));
          s.alpha(penA, () => {
            const v = -beta * lr;
            const hh = Math.min(u * 7.5, Math.abs(v) * u * 20);
            s.ctx.fillStyle = s.tint('red', 0.75);
            const bx = cx + p.cw / 2 - u * 1.2;
            if (v < 0) s.ctx.fillRect(bx, cy + u * 13, u * 2.4, Math.max(1, hh));
            else s.ctx.fillRect(bx, cy + u * 13 - Math.max(1, hh), u * 2.4, Math.max(1, hh));
          });
        });
        if (t === n - 1) s.alpha(s.ease('end', 0.6), () => pill(s, `+${L.reward}`, cx + p.cw + u * 2, cy + u * 3.5, 'gold', { align: 'left', size: 3.4 }));
      });
      s.alpha(ratioA * (1 - s.ease('end', 0.5)), () => pill(s, 'red numbers: log ratio, policy over reference', w / 2, y0 + lines * lineH + u * 4, 'red', { size: 3.2, font: 'ui' }));
    });
    // totals
    const tA = s.ease('end', 0.6, 1);
    s.alpha(tA, () => {
      const y = y0 + lines * lineH + u * 4;
      const klSum = L.logp.reduce((a, v, t) => a + v - L.logpRef[t]!, 0);
      s.text(`total = ${L.reward} − ${beta.toFixed(2)} × ${klSum.toFixed(1)} = ${total.toFixed(2)}`, w / 2, y, { size: 4, font: 'mono', weight: 650 });
      // a bar: reward minus penalty
      const bw = Math.min(w - u * 16, u * 90);
      const bx = (w - bw) / 2;
      const sc = bw / 2;
      s.rrect(bx, y + u * 5, L.reward * sc, u * 5, 1, { fill: s.tint('gold', 0.75) });
      const pen = beta * klSum * sc;
      s.rrect(bx + L.reward * sc - pen, y + u * 5, pen, u * 5, 1, { fill: s.tint('red', 0.55) });
      s.alpha(s.ease('end', 0.5, 2), () => s.text('GAE spreads it back over the tokens', w / 2, y + u * 15, { size: 3.3, font: 'ui', italic: true, color: s.c('--ink-2') }));
    });
    s.alpha(s.ease('neg', 0.6, 1), () => s.text('one sample can be negative; the average is the KL ≥ 0', w / 2, h * 0.16, { size: 3.4, font: 'ui', weight: 600, color: s.c('red') }));
  },
};

// ---------------------------------------------------------------- 10. four models in memory

const MODELS: { key: string; name: string; k: K; trained: boolean; out: string }[] = [
  { key: 'policy', name: 'policy', k: 'blue', trained: true, out: 'writes answers' },
  { key: 'ref', name: 'reference', k: 'orange', trained: false, out: 'for the KL' },
  { key: 'rm', name: 'reward model', k: 'gold', trained: false, out: 'scores answers' },
  { key: 'critic', name: 'value model', k: 'teal', trained: true, out: 'value per token' },
];

const models: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const gap = u * 3;
    const cols = (w - u * 10 - gap * 3) / 4 >= u * 34 ? 4 : 2;
    const bw = (w - u * 10 - gap * (cols - 1)) / cols;
    const bh = u * 18;
    const top = h * 0.13;
    const loopBeat = s.since('loop') >= 0 && s.since('preview') < 0;
    const lp = s.prog('loop');
    const hot = loopBeat ? Math.min(3, Math.floor(lp * 5)) : -1;
    MODELS.forEach((m, i) => {
      const a = s.ease(m.key, 0.6);
      const x = u * 5 + (i % cols) * (bw + gap);
      const y = top + Math.floor(i / cols) * (bh + gap);
      const dropped = (s.since('preview') >= 0 && m.key === 'critic' ? s.ease('preview', 0.5, 0.5) : 0) + (s.since('preview') >= 0 && m.key === 'rm' ? s.ease('preview', 0.5, 3.6) : 0);
      s.alpha(a * (1 - 0.6 * clamp01(dropped)), () => {
        s.rrect(x, y, bw, bh, 2, { fill: s.tint(m.k, hot === i ? 0.26 : 0.1), stroke: s.c(m.k), lw: m.trained ? 0.7 : 0.3 });
        if (!m.trained) {
          s.ctx.save();
          s.ctx.setLineDash([u, u * 0.8]);
          s.rrect(x + u, y + u, bw - 2 * u, bh - 2 * u, 1.4, { stroke: s.tint(m.k, 0.6), lw: 0.25 });
          s.ctx.restore();
        }
        s.text(m.name, x + u * 2.5, y + u * 4.5, { size: 3.8, font: 'ui', weight: 700, align: 'left', color: s.c(m.k) });
        s.text(m.trained ? 'trained' : 'frozen', x + u * 2.5, y + u * 9.5, { size: 3.2, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
        s.text(m.out, x + u * 2.5, y + u * 14, { size: 3.2, font: 'ui', align: 'left', color: s.c('--ink-2') });
        const gb = m.trained ? 112 : 14;
        s.alpha(s.ease('total', 0.5), () => s.text(`${gb} GB`, x + bw - u * 2.5, y + u * 4.5, { size: 3.4, font: 'mono', weight: 650, align: 'right' }));
      });
      if (dropped > 0) s.alpha(clamp01(dropped), () => s.line(x + u * 2, y + bh / 2, x + bw - u * 2, y + bh / 2, s.c('red'), 0.6));
    });
    s.alpha(s.win('four', 'policy'), () => {
      MODELS.forEach((m, i) => {
        const x = u * 5 + (i % cols) * (bw + gap);
        const y = top + Math.floor(i / cols) * (bh + gap);
        s.alpha(0.35 * s.ease('four', 0.5, 0.3 + i * 0.3), () => s.rrect(x, y, bw, bh, 2, { fill: s.tint(m.k, 0.06), stroke: s.tint(m.k, 0.6), lw: 0.3 }));
      });
      s.text('one PPO iteration touches four networks', w / 2, h * 0.7, { size: 4, font: 'display', italic: true });
    });
    // bytes and the memory bar
    const mA = s.ease('bytes', 0.6) * (1 - s.ease('loop', 0.6));
    const y0 = top + (4 / cols) * (bh + gap) + u * 4;
    s.alpha(mA, () => {
      s.text('trained (Adam, mixed precision): 16 bytes per parameter', u * 5, y0 + u * 2, { size: 3.3, font: 'ui', align: 'left', color: s.c('--ink-2') });
      s.text('frozen (bf16): 2 bytes per parameter', u * 5, y0 + u * 7.5, { size: 3.3, font: 'ui', align: 'left', color: s.c('--ink-2') });
      const tA = s.ease('total', 0.6, 0.5) * (1 - s.ease('small', 0.5));
      const barW = w - u * 10;
      s.alpha(tA, () => {
        const sc = barW / 300;
        let x = u * 5;
        const by = y0 + u * 13;
        s.text('PPO, 7B everywhere: 252 GB', u * 5, by, { size: 3.4, font: 'ui', weight: 650, align: 'left' });
        MODELS.forEach((m) => {
          const gb = m.trained ? 112 : 14;
          s.rrect(x, by + u * 3, gb * sc - 1, u * 5, 0.6, { fill: s.tint(m.k, m.trained ? 0.7 : 0.4) });
          x += gb * sc;
        });
        s.text('fine-tuning only: 112 GB', u * 5, by + u * 13, { size: 3.4, font: 'ui', weight: 650, align: 'left', color: s.c('--ink-2') });
        s.rrect(u * 5, by + u * 16, 112 * sc - 1, u * 5, 0.6, { fill: s.tint('blue', 0.7) });
      });
      const sA = s.ease('small', 0.6);
      s.alpha(sA, () => {
        const sc = barW / 6500;
        const by = y0 + u * 13;
        const bar = (y: number, label: string, parts: [number, K, boolean][]) => {
          s.text(label, u * 5, y, { size: 3.4, font: 'ui', weight: 650, align: 'left' });
          let x = u * 5;
          for (const [gb, k, tr] of parts) {
            s.rrect(x, y + u * 3, Math.max(1, gb * sc - 1), u * 5, 0.6, { fill: s.tint(k, tr ? 0.7 : 0.4) });
            x += gb * sc;
          }
        };
        bar(by, '175B policy, 175B helpers: 6,300 GB', [[2800, 'blue', true], [2800, 'teal', true], [350, 'orange', false], [350, 'gold', false]]);
        bar(by + u * 13, '175B policy, 6B helpers: 3,258 GB', [[2800, 'blue', true], [96, 'teal', true], [350, 'orange', false], [12, 'gold', false]]);
      });
    });
    // one iteration, as a cycle of steps
    const lA = s.ease('loop', 0.6);
    s.alpha(lA, () => {
      const steps = ['1  generate', '2  score', '3  rewards, GAE', '4  clipped epochs'];
      const y = y0 + u * 4;
      const per = (w - u * 19) / 4 >= u * 30 ? 4 : 2;
      const sw = (w - u * 10 - u * 3 * (per - 1)) / per;
      steps.forEach((t, i) => {
        const x = u * 5 + (i % per) * (sw + u * 3);
        const yy = y + Math.floor(i / per) * u * 12;
        const on = loopBeat ? (Math.min(3, Math.floor(lp * 5)) === i ? 1 : 0.25) : 0.25;
        s.rrect(x, yy, sw, u * 9.5, 1.6, { fill: s.tint('--accent', 0.06 + 0.16 * on), stroke: s.tint('--accent', 0.35 + 0.6 * on), lw: 0.35 });
        s.text(t, x + sw / 2, yy + u * 4.9, { size: 3.3, font: 'ui', weight: 650 });
        if (per === 4 && i < 3) s.arrow(x + sw + u * 0.4, yy + u * 4.75, x + sw + u * 2.6, yy + u * 4.75, s.c('--ink-3'), 0.35, 1.4);
      });
      const py = y + (per === 2 ? u * 31 : u * 19);
      s.alpha(s.ease('preview', 0.6, 0.5), () => {
        pill(s, 'GRPO: no value model', w * 0.28, py, 'teal', { size: 3.4, font: 'ui' });
        s.alpha(s.ease('preview', 0.6, 3.6), () => pill(s, 'DPO: no RM either', w * 0.74, py, 'gold', { size: 3.4, font: 'ui' }));
      });
    });
  },
};

// ---------------------------------------------------------------- 11. reward hacking

const hacking: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const side = !s.tall;
    const wr: Rect = side ? [u * 11, h * 0.14, w * 0.45, h * 0.62] : [u * 11, h * 0.12, w - u * 16, h * 0.42];
    const cx0 = w * 0.45 + u * 24;
    const cr: Rect = side ? [cx0, h * 0.14, w - cx0 - u * 5, h * 0.62] : [u * 14, h * 0.64, w - u * 19, h * 0.27];
    const fr = toyFrame(s, wr, [0, 8, 0.3, 1.2]);
    const wA = s.ease('notlabelers', 0.6);
    // which run is showing, and how far along
    const strongOn = s.since('leash') >= 0;
    const weakP = s.since('run') >= 0 ? clamp01(s.span('run', 'gao') * 1.05) : 0;
    const strongP = strongOn ? clamp01(s.prog('leash') * 1.3) : 0;
    const run = strongOn ? OPT_STRONG : OPT_WEAK;
    const idx = Math.floor((strongOn ? strongP : weakP) * (run.length - 1));
    const cur = run[idx]!;
    const policyA = s.ease('toy', 0.6);
    const fixesA = 1 - 0.8 * s.ease('fixes', 0.6);
    toyAxes(s, fr, wA * fixesA, [0, 2, 4, 6, 8]);
    s.alpha(wA * fixesA, () => {
      fr.clip(() => {
        shade(s, fr, (l, q) => (T.taste(l, q) - 2) / 10, 'green', 1, 40, 24);
        rmContours(s, fr, OPT_RM.w, 1, [-4, 0, 4, 8, 12, 16, 20, 24]);
        const c = s.ctx;
        c.beginPath();
        c.ellipse(fr.X(T.SFT.l), fr.Y(T.SFT.q), fr.X(T.SFT.l + 2 * T.SFT.sl) - fr.X(T.SFT.l), fr.Y(T.SFT.q) - fr.Y(T.SFT.q + 2 * T.SFT.sq), 0, 0, Math.PI * 2);
        c.strokeStyle = s.c('orange');
        c.lineWidth = u * 0.4;
        c.setLineDash([u, u * 0.8]);
        c.stroke();
        c.setLineDash([]);
        s.alpha(s.win('optimizer', 'goodhart'), () => {
          const wn = Math.hypot(OPT_RM.w[0], OPT_RM.w[1]);
          const end = T.unstd([(9 * OPT_RM.w[0]) / wn, (9 * OPT_RM.w[1]) / wn]);
          s.arrow(fr.X(T.SFT.l), fr.Y(T.SFT.q), fr.X(end[0]), fr.Y(end[1]), s.c('gold'), 0.8, 3);
          s.text('what the reward model wants', fr.X((T.SFT.l + end[0]) / 2), fr.Y((T.SFT.q + end[1]) / 2) - u * 4, { size: 3.3, font: 'ui', weight: 650, color: s.c('gold'), halo: true });
        });
        s.alpha(policyA, () => {
          const trail = (rr: typeof run, upto: number, a: number) =>
            s.alpha(a, () => {
              const pts = rr.slice(0, upto + 1).map((p) => T.unstd(p.m));
              fr.path(pts.map((p) => p[0]), pts.map((p) => p[1]), s.c('blue'), 0.55);
            });
          if (strongOn) trail(OPT_WEAK, OPT_WEAK.length - 1, 0.25);
          trail(run, idx, 1);
          for (const e of OPT_E) {
            const [l, q] = T.unstd([cur.m[0] + e[0], cur.m[1] + e[1]]);
            fr.dot(l, q, 0.65, s.tint('blue', 0.6), 'transparent');
          }
          const [ml, mq] = T.unstd(cur.m);
          fr.dot(ml, mq, 1.4, s.c('blue'));
        });
      });
      s.text('SFT', fr.X(T.SFT.l), fr.Y(T.SFT.q - 2 * T.SFT.sq) + u * 3, { size: 3.2, font: 'ui', weight: 650, color: s.c('orange'), halo: true });
    });
    // proxy and true against sqrt(KL)
    const cA = s.ease('toy', 0.6);
    if (cA > 0) {
      const cf = new Frame(s, cr, [0, 10, -9, 15]);
      const curve = (rr: typeof run, upto: number, key: 'proxy' | 'gold', k: K, a: number) =>
        s.alpha(a, () => cf.path(rr.slice(0, upto + 1).map((p) => Math.sqrt(p.kl)), rr.slice(0, upto + 1).map((p) => p[key]), s.c(k), 0.7));
      s.alpha(cA * (1 - 0.8 * s.ease('fixes', 0.6)), () => {
        for (const v of [-5, 0, 5, 10]) {
          s.line(cf.X(0), cf.Y(v), cf.X(10), cf.Y(v), v === 0 ? s.c('--axis') : s.c('--grid'), 0.2);
          s.text((v > 0 ? '+' : '') + v, cf.X(0) - u * 1.2, cf.Y(v), { size: 3.1, font: 'mono', align: 'right', color: s.c('--ink-3') });
        }
        s.text('√KL from SFT', cf.X(10), cf.Y(-9) + u * 3, { size: 3.2, font: 'ui', align: 'right', color: s.c('--ink-2') });
        const hideTrue = 1 - 0.85 * s.ease('hard', 0.8) * (1 - s.ease('fixes', 0.6));
        const weakUpto = strongOn ? OPT_WEAK.length - 1 : Math.floor(weakP * (OPT_WEAK.length - 1));
        curve(OPT_WEAK, weakUpto, 'proxy', 'gold', strongOn ? 0.3 : 1);
        curve(OPT_WEAK, weakUpto, 'gold', 'green', (strongOn ? 0.3 : 1) * hideTrue);
        if (strongOn) {
          curve(OPT_STRONG, idx, 'proxy', 'gold', 1);
          curve(OPT_STRONG, idx, 'gold', 'green', hideTrue);
        }
        s.text('proxy (reward model)', cf.X(0.3), cf.Y(14), { size: 3.2, font: 'ui', weight: 650, align: 'left', color: s.c('gold') });
        s.alpha(hideTrue, () => s.text('true (labelers)', side ? cf.X(0.3) : cf.X(5.6), side ? cf.Y(14) + u * 4.5 : cf.Y(14), { size: 3.2, font: 'ui', weight: 650, align: 'left', color: s.c('green') }));
        s.alpha(s.ease('peak', 0.6, 0.5) * hideTrue, () => {
          const best = OPT_WEAK.reduce((a, b) => (b.gold > a.gold ? b : a));
          s.circle(cf.X(Math.sqrt(best.kl)), cf.Y(best.gold), u * 1.6, { stroke: s.c('green'), lw: 0.45 });
          s.text('peak', cf.X(Math.sqrt(best.kl)), cf.Y(best.gold) - u * 4, { size: 3.2, font: 'ui', weight: 650, color: s.c('green'), halo: true });
        });
        s.alpha(s.ease('hard', 0.6, 0.5) * (1 - s.ease('fixes', 0.6)), () => s.text('all you can see', cf.X(9.5), cf.Y(-6), { size: 3.4, font: 'ui', weight: 650, align: 'right', color: s.c('gold') }));
      });
      s.slot('beta', strongOn ? 0.3 : 0.05);
      s.slot('kl', fmt(cur.kl, 3));
    }
    // Goodhart, the examples, the fixes
    s.alpha(s.win('goodhart', 'examples'), () => {
      const cw = Math.min(w - u * 14, u * 92);
      const gy = side ? h * 0.3 : cr[1] - u * 2;
      s.rrect((w - cw) / 2, gy, cw, u * 26, 2.4, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.35 });
      wrapText(s, '“When a measure becomes a target, it ceases to be a good measure.”', cw - u * 8, 4.4, 'serif').forEach((l, i) =>
        s.text(l, w / 2, gy + u * (7 + i * 6.5), { size: 4.4, italic: true, font: 'serif' }),
      );
      s.text('Goodhart’s law', w / 2, gy + u * 22, { size: 3.3, font: 'ui', weight: 650, color: s.c('--ink-2') });
    });
    s.alpha(s.win('examples', 'toy'), () => {
      const items = ['writes longer', 'agrees with the user', 'sounds confident'];
      const ex = side ? cr[0] + cr[2] / 2 : w / 2;
      items.forEach((t, i) => s.alpha(s.ease('examples', 0.5, 0.6 + i * 1.6), () => pill(s, t, ex, side ? h * (0.3 + i * 0.13) : cr[1] + u * (3 + i * 9), 'red', { size: 3.8, font: 'ui' })));
    });
    const fixesFade = 1 - 0.85 * s.ease('fixes', 0.6);
    const pillAt: [number, number] = side ? [cr[0] + cr[2] / 2, cr[1] + cr[3] + u * 9] : [cr[0] + u, cr[1] + cr[3] - u * 2.5];
    const pillAlign = side ? 'center' : 'left';
    s.alpha(s.ease('gao', 0.6) * (1 - s.ease('leash', 0.5)), () => pill(s, 'Gao, Schulman & Hilton, 2022', pillAt[0], pillAt[1], 'slate', { size: 3.2, font: 'ui', align: pillAlign }));
    s.alpha(s.ease('leash', 0.6) * fixesFade, () => pill(s, 'β = 0.3', pillAt[0], pillAt[1], 'blue', { size: 3.2, align: pillAlign }));
    s.alpha(s.ease('fixes', 0.6), () => {
      const items: [string, K][] = [
        ['keep the KL penalty', 'red'],
        ['judge by human evals', 'slate'],
        ['refresh the reward model', 'gold'],
      ];
      s.rrect(u * 5, h * 0.3, w - u * 10, u * 32, 2.4, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.35 });
      items.forEach(([t, k], i) => s.alpha(s.ease('fixes', 0.5, 0.4 + i * 1.6), () => pill(s, t, w / 2, h * 0.3 + u * (7 + i * 9), k, { size: 3.8, font: 'ui' })));
    });
  },
};

// ---------------------------------------------------------------- 12. takeaways

const TAKE: [string, string, K, string][] = [
  ['reward model', 'Bradley-Terry on pairs', 'gold', 'recap1'],
  ['ratio ρ', 'reuse each batch', 'purple', 'recap2'],
  ['clip', 'small, pessimistic steps', 'slate', 'recap2'],
  ['value head + GAE', 'λ: bias vs variance', 'teal', 'recap3'],
  ['KL per token', 'the leash', 'red', 'recap4'],
  ['a proxy', 'do not over-optimize', 'green', 'recap5'],
];

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cols = s.tall ? 2 : 3;
    const gap = u * 3;
    const tw = (w - u * 10 - gap * (cols - 1)) / cols;
    const th = Math.min(u * 18, tw * 0.5);
    const fadeAll = 1 - s.ease('next', 0.6);
    const cur = current(s, ['recap1', 'recap2', 'recap3', 'recap4', 'recap5']);
    s.alpha(fadeAll, () => {
      TAKE.forEach(([name, sub, k, beat], i) => {
        const a = s.ease(beat, 0.5, beat === 'recap2' && i === 2 ? 3 : 0.2);
        const x = u * 5 + (i % cols) * (tw + gap);
        const y = h * 0.13 + Math.floor(i / cols) * (th + gap);
        const on = cur === beat ? 1 : 0.25;
        s.alpha(a, () => {
          s.rrect(x, y, tw, th, 2, { fill: s.tint(k, 0.06 + 0.14 * on), stroke: s.tint(k, 0.4 + 0.55 * on), lw: 0.35 });
          s.text(name, x + tw / 2, y + th * 0.38, { size: Math.min(4.4, (tw / u) * 0.12), font: 'display', weight: 600 });
          s.text(sub, x + tw / 2, y + th * 0.7, { size: Math.min(3.3, (tw / u) * 0.09), font: 'ui', color: s.c('--ink-2') });
        });
      });
    });
    const nA = s.ease('next', 0.6);
    s.alpha(nA, () => {
      const y = h * 0.4;
      s.text('next', w / 2, y - u * 9, { size: 3.8, font: 'ui', weight: 650, color: s.c('--ink-3') });
      pill(s, 'DPO: no reward model, no sampling', w / 2, y, 'gold', { size: 3.6, font: 'ui' });
      pill(s, 'GRPO: no value head', w / 2, y + u * 10, 'teal', { size: 3.6, font: 'ui' });
    });
  },
};

export const scenes: Record<string, SceneDef> = { intro, recap, recipe, bt, rmtoy, ratio, clip, gae, kl, models, hacking, outro };
