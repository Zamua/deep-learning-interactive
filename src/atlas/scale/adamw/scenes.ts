import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { rich } from '../modern-draw';

type Ink = Color | `--${string}`;

const MH = String.raw`\sym{m}{\hat m}`;
const VH = String.raw`\sym{v}{\hat v}`;
const AW = String.raw`\symw \leftarrow \symw - \symeta\Big(${MH} / \sqrt{${VH}} + \symlam\,\symw\Big)`;

/** Eased 0 -> 1 from a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
const after = (s: Scene, id: string, f: number, dur = 0.5) => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.6) {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });
}

// ---- the two weights, a and b, each pulled toward zero by an arrow as long as its pull

/** Stage units of arrow per unit of pull. */
const K = 60;
const rowY = (s: Scene, i: number) => s.h * (i ? 0.62 : 0.4);
const dotX = (s: Scene) => s.w - 14 * s.u;

/** A weight's name, a note on its gradients, and its dot. */
function weight(s: Scene, i: number, note: string, noteA: number, at = true) {
  const y = rowY(s, i);
  s.text(i ? 'b' : 'a', 7 * s.u, y, { size: 4.4, font: 'mono', weight: 700, align: 'left', color: s.c('blue') });
  s.alpha(noteA, () => s.text(note, 7 * s.u, y + 6 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') }));
  s.circle(dotX(s), y, 1.8 * s.u, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
  if (at) s.text('w = 1', dotX(s), y + 5 * s.u, { size: 2.9, font: 'mono', color: s.c('blue') });
}

/** A pull toward zero of size `p`, drawn leftward from the weight, with its value above it. */
function pull(s: Scene, i: number, p: number, k: Ink, label: string, dy = 0, width = 0.6) {
  const y = rowY(s, i) + dy * s.u;
  const x0 = dotX(s) - 2.6 * s.u;
  const len = Math.max(0.6, p * K) * s.u;
  if (len > 2 * s.u) s.arrow(x0, y, x0 - len, y, s.c(k), width, 1.8);
  else s.line(x0, y, x0 - len, y, s.c(k), width + 0.3);
  if (label) s.text(label, x0 - len / 2, y - 3.6 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c(k), halo: true });
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fmt = (v: number) => (v >= 0.0995 ? v.toFixed(v >= 0.995 ? 0 : 1) : v.toFixed(v >= 0.00995 ? 2 : 3));

const pullScene: SceneDef = {
  marks: {
    g: { tex: String.raw`\symg \leftarrow \symg + \symlam\,\symw`, x: 0.5, y: 0.07, size: 4.4 },
    step: { tex: String.raw`\symw \leftarrow \symw - \symeta\,${MH} / \sqrt{${VH}}`, x: 0.5, y: 0.16, size: 4.4 },
  },
  draw(s) {
    const top = s.h * 0.07;
    s.alpha(s.win('half', 'adam'), () => rich(s, [['penalty ', '--ink-3'], ['½ λ Σ w²', 'slate'], ['  →  pull ', '--ink-3'], ['λw', 'slate']], s.w / 2, top, { size: 3.8 }));
    s.show('g', s.ease('adam', 0.6));
    s.show('step', s.ease('adam', 0.6, 1.5));

    s.text('pull toward 0', dotX(s) - 3 * s.u, s.h * 0.27, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
    const notes = s.ease('two', 0.6);
    weight(s, 0, 'big gradients: √v̂ = 10', notes);
    weight(s, 1, 'tiny gradients: √v̂ = 0.1', notes);

    // Plain gradient descent, then Adam's division, then the step size.
    const da = s.ease('diva', 1.2, 1.5);
    const db = s.ease('divb', 1.2, 1);
    const pa = lerp(0.1, 0.01, da);
    const pb = lerp(0.1, 1, db);
    const mv = s.ease('move', 0.6, 1);
    const label = (p: number, d: number) => (mv > 0.5 ? `moves ${fmt(p * 0.1)}` : d > 0 && d < 1 ? '' : fmt(p));
    pull(s, 0, pa, s.since('diva') >= 0 ? 'red' : 'green', label(pa, da));
    pull(s, 1, pb, s.since('divb') >= 0 ? 'red' : 'green', label(pb, db));

    const cy = s.h * 0.86;
    s.alpha(s.win('recall', 'half'), () => caption(s, 'plain gradient descent: the same pull for both', cy, 'green', 3.4));
    s.alpha(s.win('same', 'diva'), () => caption(s, 'λw = 0.1 × 1 = 0.1 for both', cy, 'slate'));
    s.alpha(s.win('diva', 'divb'), () => caption(s, 'a: 0.1 / 10 = 0.01', cy, 'red'));
    s.alpha(s.win('divb', 'move'), () => caption(s, 'b: 0.1 / 0.1 = 1', cy, 'red'));
    s.alpha(s.win('move', 'wrong'), () => caption(s, '× η = 0.1: a moves 0.001, b moves 0.1', cy, 'red', 3.4));
    s.alpha(s.ease('wrong', 0.6), () => caption(s, 'the decay depends on the gradients', cy, 'red'));
    s.alpha(after(s, 'wrong', 0.2), () => {
      s.text('10× too weak', 7 * s.u, rowY(s, 0) + 11 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
      s.text('10× too strong', 7 * s.u, rowY(s, 1) + 11 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
    });
  },
};

const fix: SceneDef = {
  marks: {
    aw: { tex: AW, x: 0.5, y: 0.08, size: 4.4 },
  },
  draw(s) {
    const cx = s.w / 2;
    cite(s, 'Loshchilov & Hutter, 2017', s.win('paper', 'rule'));
    s.show('aw', s.ease('rule', 0.6));

    // L2's pull, struck out of the gradient.
    s.alpha(s.win('paper', 'equal'), () => {
      const y = s.h * 0.3;
      const o = { size: 4.2, weight: 600 } as const;
      rich(s, [['g', 'red'], [' = grad', '--ink-2'], [' + λw', 'slate']], cx, y, o);
      s.alpha(1 - s.ease('out', 0.5), () => caption(s, 'Adam with L2:', y - 7 * s.u, '--ink-3', 3.2));
      s.alpha(s.ease('out', 0.5), () => caption(s, 'AdamW:', y - 7 * s.u, '--ink-3', 3.2));
      const w0 = s.measure('g = grad', { font: 'mono', ...o });
      const w1 = s.measure(' + λw', { font: 'mono', ...o });
      const x0 = cx - (w0 + w1) / 2 + w0 + 1 * s.u;
      const cut = s.ease('out', 0.6, 0.5);
      if (cut > 0.003) s.line(x0, y, x0 + (w1 - 1 * s.u) * cut, y, s.c('red'), 0.5);
      s.alpha(s.ease('out', 0.6, 1.5), () => caption(s, 'm and v see the data\'s gradient only', s.h * 0.42, '--ink-2', 3.4));
      s.alpha(s.ease('rule', 0.6), () => caption(s, 'the decay joins after the division by √v̂', s.h * 0.5, 'slate', 3.4));
      s.alpha(s.ease('name', 0.6), () => caption(s, 'AdamW: Adam with decoupled weight decay', s.h * 0.62, '--ink', 3.4));
    });

    // a and b again: each one's move from the decay alone, in one step.
    s.alpha(s.ease('equal', 0.6), () => {
      s.text('decay\'s move in one step', dotX(s) - 3 * s.u, s.h * 0.27, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      weight(s, 0, 'big gradients', 1, false);
      weight(s, 1, 'tiny gradients', 1, false);
      s.alpha(0.35, () => {
        pull(s, 0, 0.01, 'red', '', 3.2, 0.4);
        pull(s, 1, 1, 'red', '', 3.2, 0.4);
      });
      pull(s, 0, 0.1, 'green', '0.01');
      pull(s, 1, 0.1, 'green', '0.01');
      s.alpha(0.6, () => {
        s.text('L2: 0.001', 7 * s.u, rowY(s, 0) + 11 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('red') });
        s.text('L2: 0.1', 7 * s.u, rowY(s, 1) + 11 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('red') });
      });
    });
    const cy = s.h * 0.86;
    s.alpha(s.win('equal', 'fraction'), () => caption(s, 'η · λw = 0.1 × 0.1 = 0.01 for both', cy, 'green', 3.4));
    s.alpha(s.ease('fraction', 0.6), () => caption(s, 'every weight loses the fraction ηλ per step', cy, 'green', 3.4));
  },
};

const step: SceneDef = {
  marks: {
    aw: { tex: AW, x: 0.5, y: 0.08, size: 4.2 },
  },
  draw(s) {
    const cx = s.w / 2;
    s.show('aw', 1);
    const neg = s.ease('neg', 0.6);
    /** Draws a line in its first form, crossfading to the flipped-gradient form. */
    const swap = (a: number, fn: (n: 0 | 1) => void) => {
      s.alpha(a * (1 - neg), () => fn(0));
      s.alpha(a * neg, () => fn(1));
    };
    const o = { size: 3.6 } as const;
    swap(s.ease('nums', 0.6), (n) => rich(s, [['w', 'blue'], [' = 2   ', '--ink-2'], ['m̂', 'orange'], [[' = 0.3   ', ' = −0.3   '][n]!, n ? '--ink' : '--ink-2'], ['v̂', 'teal'], [' = 0.09', '--ink-2']], cx, s.h * 0.2, o));
    s.alpha(s.ease('nums', 0.6, 2), () => rich(s, [['η', 'slate'], [' = ', '--ink-2'], ['λ', 'slate'], [' = 0.1', '--ink-2']], cx, s.h * 0.27, o));
    swap(s.ease('u', 0.6), (n) => rich(s, [['m̂ / √v̂', 'orange'], [[' = 0.3 / 0.3 = 1', ' = −0.3 / 0.3 = −1'][n]!, '--ink']], cx, s.h * 0.37, o));
    s.alpha(s.ease('decay', 0.6), () => rich(s, [['λw', 'slate'], [' = 0.1 × 2 = 0.2', '--ink']], cx, s.h * 0.45, o));
    swap(s.ease('decay', 0.6, 2.5), (n) => rich(s, [['bracket', '--ink-3'], [[' = 1 + 0.2 = 1.2', ' = −1 + 0.2 = −0.8'][n]!, '--ink']], cx, s.h * 0.53, o));
    const stepLine = (n: 0 | 1) => rich(s, [['step', '--ink-3'], [[' = 0.1 × 1.2 = 0.12', ' = 0.1 × (−0.8) = −0.08'][n]!, '--ink']], cx, s.h * 0.61, o);
    s.alpha(s.ease('res', 0.6) * (1 - neg), () => stepLine(0));
    s.alpha(s.ease('rise', 0.6), () => stepLine(1));

    // w on a number line, moving down then (with the flipped gradient) up.
    s.alpha(s.ease('res', 0.6, 1), () => {
      const y = s.h * 0.77;
      const l = cx - 36 * s.u;
      const X = (v: number) => l + ((v - 1.8) / 0.32) * 72 * s.u;
      s.line(l, y, X(2.12), y, s.c('--axis'), 0.4);
      for (const t of [1.8, 1.9, 2, 2.1]) {
        s.line(X(t), y - 1 * s.u, X(t), y + 1 * s.u, s.c('--axis'), 0.3);
        s.text(t.toFixed(1), X(t), y + 4 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
      }
      s.circle(X(2), y, 1.5 * s.u, { fill: s.tint('blue', 0.35) });
      const to = (v: number, a: number) =>
        s.alpha(a, () => {
          s.arrow(X(2), y - 3.4 * s.u, X(v), y - 3.4 * s.u, s.c('blue'), 0.4, 1.6);
          s.circle(X(v), y, 1.8 * s.u, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
          s.text(v.toFixed(2), X(v), y - 7.4 * s.u, { size: 3.3, font: 'mono', weight: 650, color: s.c('blue'), halo: true });
        });
      to(1.88, 1 - s.ease('rise', 0.5));
      to(2.08, s.ease('rise', 0.6));
    });
    s.alpha(after(s, 'rise', 0.4), () => caption(s, 'data pushes up 0.1, decay pulls back 0.02', s.h * 0.9, '--ink-2', 3.3));
  },
};

export const scenes: Record<string, SceneDef> = { pull: pullScene, fix, step };
