import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after } from '../../backprop/draw';
import { ball } from '../../optimization/draw';
import { axes, curve, type Frame, frame, type Ink, rich } from '../draw';

const sig = (z: number) => 1 / (1 + Math.exp(-z));
const nls = (z: number) => -Math.log(sig(z));
const EA = Math.exp(2);
const EB = Math.exp(1);

/** A paper's authors and year, top right, while `a` is on. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A rounded card `w` by `h` units centered on (x, y), with a small title near its top; `on` lights its border. */
function card(s: Scene, x: number, y: number, w: number, h: number, title: string, k: Ink, on = 0): void {
  const u = s.u;
  s.rrect(x - (w * u) / 2, y - (h * u) / 2, w * u, h * u, 1.6, { fill: s.tint(k, 0.08 + 0.06 * on), stroke: s.tint(k, 0.4 + 0.6 * on), lw: 0.3 + 0.3 * on });
  if (title) s.text(title, x, y - (h * u) / 2 + 3.4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
}

/** A small filled tag centered on (x, y). */
function tag(s: Scene, x: number, y: number, text: string, k: Ink, size = 2.7): void {
  const w = s.measure(text, { size, font: 'mono', weight: 650 }) + 3 * s.u;
  s.rrect(x - w / 2, y - 2.4 * s.u, w, 4.8 * s.u, 2.4, { fill: s.c('--card'), stroke: s.c(k), lw: 0.35 });
  s.text(text, x, y + 0.15 * s.u, { size, font: 'mono', weight: 650, color: s.c(k) });
}

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.4): void {
  s.text(text, s.w / 2, y, { size, font: 'mono', weight: 600, color: s.c(k), halo: true });
}

// ---- the problem: a prompt, two answers, a labeler's pick, and the reward model's scores

const ANS: [string, string[]][] = [
  ['answer a', ['Air scatters blue light', 'more than red.']],
  ['answer b', ['It reflects the', 'ocean.']],
];

const pick: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const xs = [cx - 27 * u, cx + 27 * u];
    // The prompt both answers reply to.
    const pr = s.ease('prompt', 0.6);
    s.alpha(pr, () => {
      const q = 'Why is the sky blue?';
      const qw = s.measure(q, { size: 3.6 }) + 8 * u;
      s.rrect(cx - qw / 2, 9 * u, qw, 9 * u, 1.6, { fill: s.tint('blue', 0.08), stroke: s.tint('blue', 0.6), lw: 0.35 });
      s.text(q, cx, 13.6 * u, { size: 3.6, color: s.c('--ink') });
      s.text('prompt', cx - qw / 2 - 1.6 * u, 13.6 * u, { size: 2.8, font: 'mono', weight: 650, align: 'right', color: s.c('blue') });
    });
    // The two answers.
    const picked = s.ease('labeler', 0.6, 1.2);
    ANS.forEach(([title, lines], i) => {
      const x = xs[i]!;
      const on = i === 0 ? picked : 0;
      s.alpha(1 - on, () => card(s, x, 35 * u, 48, 17, title, 'slate'));
      s.alpha(on, () => card(s, x, 35 * u, 48, 17, title, 'green', 1));
      lines.forEach((t, j) => s.text(t, x, (36.4 + j * 4.6) * u, { size: 3.2, color: s.c('--ink') }));
    });
    s.alpha(picked, () => tag(s, xs[0]! + 14 * u, 26.5 * u, 'picked', 'green'));
    s.alpha(s.win('hard', 'prompt'), () => {
      const one = 1 - after(s, 'hard', 0.5);
      s.alpha(one, () => caption(s, 'grade each from 1 to 10?', 56 * u, '--ink-3'));
      s.alpha(1 - one, () => caption(s, 'or just: which is better?', 56 * u, '--ink'));
    });
    s.alpha(s.win('labeler', 'want'), () => caption(s, 'a labeler labels the pair with its winner', 56 * u, 'green', 3.2));
    // The reward model reads each answer (with the prompt) and gives it a score.
    const arrows = s.ease('want', 0.7);
    const lit = s.ease('model', 0.6);
    const sc = s.ease('reward', 0.6, 2.4);
    xs.forEach((x, i) => {
      s.alpha(arrows, () => {
        s.line(x, 44.5 * u, x, 50.5 * u, s.tint('--ink-2', 0.7), 0.35);
        s.arrow(x, 56.5 * u, x, 63.5 * u, s.tint('--ink-2', 0.7), 0.35, 2.2);
        s.cell(x - 5 * u, 50.5 * u, 10 * u, 6 * u, 'rm', 'purple', { on: lit, size: 3.2 });
      });
      s.alpha(sc, () => s.text(`r = ${i === 0 ? 2 : 1}`, x, 68.5 * u, { size: 4, font: 'mono', weight: 650, color: s.c('gold') }));
    });
    s.alpha(s.win('model', 'reward'), () => caption(s, 'rm: reward model, a stand-in for the labelers', 88 * u, 'purple', 3.2));
    s.alpha(s.win('reward', 'ask'), () => caption(s, 'reward: higher for a better answer', 88 * u, 'gold', 3.2));
    s.alpha(s.ease('ask', 0.6), () => rich(s, [['gap 1', 'gold'], ['  →  chance a is picked?', '--ink-2']], cx, 88 * u, { size: 3.4, weight: 600 }));
  },
};

// ---- a chance from strengths: Zermelo's chess players, then two answers

const chance: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const xs = [cx - 21 * u, cx + 21 * u];
    const cy = 18 * u;
    const ans = s.ease('exp', 0.8);
    const str = s.ease('zermelo', 0.6, 2.5);
    // Two players, then two answers, in the same places.
    s.alpha(1 - ans, () =>
      xs.forEach((x, i) => {
        card(s, x, cy, 34, 13, `player ${i + 1}`, 'slate', s.win('share', 'exp') * (i === 0 ? 1 : 0));
        s.alpha(str, () => s.text(`strength ${i === 0 ? 3 : 1}`, x, cy + 2 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('--ink') }));
      }),
    );
    s.alpha(ans, () =>
      xs.forEach((x, i) => {
        card(s, x, cy, 34, 13, `answer ${i === 0 ? 'a' : 'b'}`, 'slate', s.ease('total', 0.6) * (i === 0 ? 1 : 0));
        const e = i === 0 ? 1 : s.ease('eb', 0.6);
        rich(s, [[`r = ${i === 0 ? 2 : 1}`, 'gold'], ...(e > 0.5 ? ([[`  e${i === 0 ? '²' : '¹'} ≈ ${(i === 0 ? EA : EB).toFixed(2)}`, '--ink']] as [string, Ink][]) : [])], x, cy + 2 * u, { size: 3.2, weight: 650 });
      }),
    );
    // The two strengths stacked into one bar, at a fixed scale; the first one's share is its chance.
    const k = (84 * u) / (EA + EB);
    const by = 46 * u;
    const bh = 9 * u;
    const eb = s.ease('eb', 0.8);
    const fa = lerp(3, EA, s.ease('exp', 1, 0.6));
    const fb = lerp(1, EB, eb);
    const x0 = cx - 42 * u;
    const split = x0 + k * fa;
    const bA = 1 - ans * (1 - eb);
    s.alpha(s.ease('share', 0.7), () => {
      s.rrect(x0, by - bh / 2, split - x0, bh, 1, { fill: s.tint('teal', 0.25), stroke: s.c('teal'), lw: 0.35 });
      s.text(ans < 0.5 ? '3' : fa.toFixed(2), (x0 + split) / 2, by + 0.2 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('teal') });
      s.alpha(bA, () => {
        s.rrect(split, by - bh / 2, k * fb, bh, 1, { fill: s.tint('slate', 0.18), stroke: s.c('slate'), lw: 0.35 });
        s.text(ans < 0.5 ? '1' : fb.toFixed(2), split + (k * fb) / 2, by + 0.2 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('--ink-2') });
      });
    });
    // The whole bar is the total, over the bar.
    s.alpha(s.ease('total', 0.6), () => {
      const x1 = split + k * fb;
      const ty = by - bh / 2 - 3 * u;
      s.line(x0, ty + 1.2 * u, x0, ty, s.c('--ink-3'), 0.3);
      s.line(x0, ty, x1, ty, s.c('--ink-3'), 0.3);
      s.line(x1, ty, x1, ty + 1.2 * u, s.c('--ink-3'), 0.3);
      s.text('total 10.11', (x0 + x1) / 2, ty - 2.4 * u, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2'), halo: true });
    });
    s.alpha(after(s, 'share', 0.55) * (1 - ans), () => rich(s, [['3 / (3 + 1) = ', '--ink-2'], ['0.75', 'teal'], [': player 1 wins', '--ink-3']], cx, 60 * u, { size: 3.4, weight: 600 }));
    s.alpha(after(s, 'total', 0.3), () => rich(s, [['7.39 / 10.11 ≈ ', '--ink-2'], ['0.73', 'teal'], [': a is picked', '--ink-3']], cx, 60 * u, { size: 3.4, weight: 600 }));
    s.alpha(s.win('chess', 'share'), () => caption(s, 'who beat whom  →  how strong is each?', 88 * u));
    s.alpha(s.win('bt', 'exp'), () => caption(s, 'chance = its share of the strengths', 88 * u, 'teal'));
    s.alpha(s.win('exp', 'total'), () => caption(s, 'strength = e to the score, as in softmax', 88 * u));
    s.alpha(after(s, 'total', 0.6), () => caption(s, 'softmax over two answers', 88 * u, 'teal'));
    cite(s, 'Ernst Zermelo, 1929', s.win('zermelo', 'bt'));
    cite(s, 'Bradley & Terry, 1952', s.win('bt', 'exp'));
  },
};

// ---- the share is the sigmoid of the gap, and only the gap matters

const R = String.raw`\sym{r}{r}`;

const gap: SceneDef = {
  marks: {
    div: { tex: String.raw`\dfrac{e^{${R}_a}}{e^{${R}_a} + e^{${R}_b}} = \dfrac{1}{1 + e^{${R}_b} / e^{${R}_a}}`, x: 0.5, y: 0.34, size: 4.2 },
    minus: { tex: String.raw`e^{${R}_b} / e^{${R}_a} = e^{1 - 2} = e^{-1} \approx 0.37`, x: 0.5, y: 0.48, size: 4.2 },
    sig: { tex: String.raw`\dfrac{1}{1 + e^{-(${R}_a - ${R}_b)}} = \sigma(${R}_a - ${R}_b)`, x: 0.5, y: 0.34, size: 4.2 },
  },
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    // The scores on a line; adding ten slides both along it.
    const sh = 10 * s.ease('shift', 1.6, 0.6);
    const L = frame(cx - 38 * u, 0, cx + 46 * u, 0, [0, 14], [0, 1]);
    const ly = 15 * u;
    s.arrow(L.l, ly, L.r + 2 * u, ly, s.c('--axis'), 0.3, 2);
    for (const t of [0, 5, 10]) s.line(L.X(t), ly - 1 * u, L.X(t), ly + 1 * u, s.c('--axis'), 0.3);
    s.text('score', L.l - 2 * u, ly, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    const xa = L.X(2 + sh);
    const xb = L.X(1 + sh);
    ball(s, xb, ly, 'gold', 1.4);
    ball(s, xa, ly, 'gold', 1.4);
    const v = (x: number) => String(Math.round(x * 10) / 10);
    s.text(`b = ${v(1 + sh)}`, xb + 1 * u, ly - 4.2 * u, { size: 3.1, font: 'mono', weight: 650, align: 'right', color: s.c('gold') });
    s.text(`a = ${v(2 + sh)}`, xa - 1 * u, ly - 4.2 * u, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
    // The gap, bracketed under the pair.
    const gy = ly + 3 * u;
    s.line(xb, gy - 1 * u, xb, gy, s.c('green'), 0.3);
    s.line(xb, gy, xa, gy, s.c('green'), 0.3);
    s.line(xa, gy, xa, gy - 1 * u, s.c('green'), 0.3);
    s.text('gap 1', (xa + xb) / 2, gy + 3.2 * u, { size: 3, font: 'mono', weight: 650, color: s.c('green') });
    // The share bar from before: dividing both strengths by a's leaves every share as it was.
    const d = s.ease('div', 0.8, 2.2);
    const m = s.ease('minus', 0.8, 1.2);
    s.alpha(s.ease('div', 0.6) * (1 - s.ease('sig', 0.5)), () => {
      const bw = 84 * u;
      const x0 = cx - bw / 2;
      const split = x0 + bw * sig(1);
      const by = s.h * 0.64;
      const bh = 9 * u;
      s.rrect(x0, by - bh / 2, split - x0, bh, 1, { fill: s.tint('teal', 0.25), stroke: s.c('teal'), lw: 0.35 });
      s.rrect(split, by - bh / 2, x0 + bw - split, bh, 1, { fill: s.tint('slate', 0.18), stroke: s.c('slate'), lw: 0.35 });
      const lab = (t0: string, t1: string, f: number, x: number, k: Ink) => {
        s.alpha(1 - 2 * f, () => s.text(t0, x, by + 0.2 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c(k) }));
        s.alpha(2 * f - 1, () => s.text(t1, x, by + 0.2 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c(k) }));
      };
      lab('7.39', '1', d, (x0 + split) / 2, 'teal');
      lab('2.72', '0.37', m, (split + x0 + bw) / 2, '--ink-2');
      s.alpha(m, () => rich(s, [['1 / (1 + 0.37) ≈ ', '--ink-2'], ['0.73', 'teal'], [': same share', '--ink-3']], cx, by + 9 * u, { size: 3.3, weight: 600 }));
    });
    // The algebra: the share, divided through, is the sigmoid of the gap.
    s.show('div', s.ease('div', 0.6) * (1 - s.ease('sig', 0.5)));
    s.show('minus', s.win('minus', 'sig'));
    s.show('sig', s.ease('sig', 0.6, 0.4));
    // The sigmoid of the gap.
    const F = frame(cx - 34 * u, s.h * 0.5, cx + 34 * u, s.h * 0.82, [-4, 4], [0, 1]);
    const pl = s.ease('sig', 0.9, 1.2);
    s.alpha(pl, () => {
      axes(s, F, 'r_a − r_b', 'σ', { x: 'gold', y: 'teal' });
      s.line(F.X(0), F.b, F.X(0), F.t, s.tint('--axis', 0.6), 0.25, [1, 1]);
      curve(s, F, sig, -4, 4, 'teal', { upto: pl });
    });
    const dot = (z: number, label: string, a: number, below = false) =>
      s.alpha(a, () => {
        const p = sig(z);
        s.line(F.X(z), F.b, F.X(z), F.Y(p), s.tint('gold', 0.7), 0.3, [1, 0.8]);
        ball(s, F.X(z), F.Y(p), 'teal', 1.6);
        s.text(label, F.X(z) + (below ? -2.5 : 2.5) * u, F.Y(p) + (below ? -3.2 : 3.4) * u, { size: 3.1, font: 'mono', weight: 650, align: below ? 'right' : 'left', color: s.c('teal'), halo: true });
      });
    dot(1, 'a: 0.73', s.ease('sig', 0.6, 2.6));
    dot(-1, 'b: 0.27', s.ease('b', 0.6, 1));
    s.alpha(s.win('shift', 'zero') * s.ease('shift', 0.6, 2.2), () => caption(s, 'σ(12 − 11) = σ(1) ≈ 0.73', s.h * 0.94, 'teal'));
    s.alpha(s.ease('zero', 0.6), () => caption(s, 'only the gap matters', s.h * 0.94, 'green'));
  },
};

// ---- the loss: cross-entropy on the labeler's pick

/** The loss against the gap, between `top` and `bottom` (fractions of the stage height). */
const lossFrame = (s: Scene, top: number, bottom: number): Frame => frame(s.w / 2 - 34 * s.u, s.h * top, s.w / 2 + 34 * s.u, s.h * bottom, [-3, 3], [0, 3.2]);

const loss: SceneDef = {
  marks: {
    p: { tex: String.raw`p = \sigma(${R}_w - ${R}_l)`, x: 0.5, y: 0.29, size: 4.4 },
    f: { tex: String.raw`\symL = -\ln \sigma(${R}_w - ${R}_l)`, x: 0.5, y: 0.29, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const xs = [cx - 17 * u, cx + 17 * u];
    const y = 11 * u;
    const fl = s.ease('flip', 0.6);
    xs.forEach((x, i) => {
      card(s, x, y, 26, 12, `answer ${i === 0 ? 'a' : 'b'}`, 'green', i === 0 ? 1 - fl : fl);
      s.text(`r = ${i === 0 ? '2.0' : '1.0'}`, x, y + 2.2 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('gold') });
    });
    // Which score is the winner's and which the loser's: a, then b had it been picked.
    const lab = (x: number, text: string, k: Ink, a: number) => s.alpha(a, () => s.text(text, x, y + 9.5 * u, { size: 3, font: 'mono', weight: 650, color: s.c(k) }));
    lab(xs[0]!, 'picked: r_w', 'green', s.ease('w', 0.6, 2) * (1 - fl));
    lab(xs[1]!, 'r_l', '--ink-3', s.ease('l', 0.6) * (1 - fl));
    lab(xs[1]!, 'picked: r_w', 'green', fl);
    lab(xs[0]!, 'r_l', '--ink-3', fl);
    s.show('p', s.win('l', 'ce'));
    s.show('f', s.ease('ce', 0.6, 0.4));
    // The loss against the gap: near zero when the pick scores well above, steep when ranked wrong.
    const F = lossFrame(s, 0.38, 0.8);
    const cv = s.ease('ce', 1.2, 2.5);
    s.alpha(Math.min(1, cv * 3), () => axes(s, F, 'r_w − r_l', 'loss', { x: 'gold', y: 'red' }));
    curve(s, F, nls, -2.6, 3, 'red', { upto: cv });
    const dot = (z: number, label: string, a: number) =>
      s.alpha(a, () => {
        ball(s, F.X(z), F.Y(nls(z)), 'red', 1.5);
        s.text(label, F.X(z) + 2.5 * u, F.Y(nls(z)) - 3 * u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
      });
    dot(1, 'a picked: 0.31', s.ease('a', 0.6, 2.5));
    dot(-1, 'b picked: 1.31', s.ease('flip', 0.6, 2));
    // A pair sliding from well ranked to badly ranked.
    s.alpha(s.win('curve', 'turn'), () => {
      const z = lerp(2.6, -2.4, after(s, 'curve', 0.35, 4));
      ball(s, F.X(z), F.Y(nls(z)), 'gold', 1.3);
    });
    s.alpha(s.ease('curve', 0.6, 1.5), () => rich(s, [['ranked right: ', '--ink-3'], ['≈ 0', 'green'], ['   wrong: ', '--ink-3'], ['steep', 'red']], cx, s.h * 0.92, { size: 3.3, weight: 600 }));
  },
};

export const scenes: Record<string, SceneDef> = { pick, chance, gap, loss };
