import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import { after, bars, cite, columns } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { chip } from '../../sequences/draw';
import { arc } from '../draw';

const SEQ = ['K', 'D', 'R', 'A', 'M', 'K'];

/** Token positions (plus one slot for the next token), the row's height and the notes' height. */
function layout(s: Scene) {
  const xs = columns(s, 7, s.tall ? 14.5 : 15);
  return { xs, y: s.h * 0.6, yn: s.h * 0.6 + 14 * s.u };
}

/** The sequence as chips with their positions, `on` lighting some. */
function row(s: Scene, on: (i: number) => number, shown: (i: number) => number = () => 1): void {
  const { xs, y } = layout(s);
  SEQ.forEach((t, i) => {
    s.alpha(shown(i), () => {
      chip(s, xs[i]!, y, t, 'orange', { w: 10, h: 8, size: 3.8, on: on(i) });
      s.text(String(i), xs[i]!, y + 6.8 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    });
  });
}

/** A dashed empty box with a question mark: nothing known here yet. */
function unknown(s: Scene, x: number, y: number, w: number, h: number, size: number): void {
  const c = s.ctx;
  c.save();
  c.setLineDash([1 * s.u, 0.8 * s.u]);
  s.rrect(x - (w / 2) * s.u, y - (h / 2) * s.u, w * s.u, h * s.u, 1.2, { stroke: s.c('--ink-3'), lw: 0.3 });
  c.restore();
  s.text('?', x, y + 0.2 * s.u, { size, font: 'mono', color: s.c('--ink-3') });
}

/** The slot for the next token: a question mark, or the guess once it is made. */
function slot(s: Scene, guess: number): void {
  const { xs, y } = layout(s);
  const x = xs[6]!;
  if (guess < 1) s.alpha(1 - guess, () => unknown(s, x, y, 10, 8, 3.8));
  s.alpha(guess, () => chip(s, x, y, 'D', 'gold', { w: 10, h: 8, size: 3.8, on: 1 }));
}

/** Under each position, the note a previous-token head writes: the token before it. */
function notes(s: Scene, a: (i: number) => number, hi: number): void {
  const { xs, yn } = layout(s);
  for (let i = 1; i < SEQ.length; i++) {
    s.alpha(a(i), () => chip(s, xs[i]!, yn, `←${SEQ[i - 1]}`, 'green', { w: 10, h: 6.5, size: 3, on: i === 1 ? hi : 0 }));
  }
  s.alpha(a(1), () => s.text('note: the token before', s.w / 2, yn + 7.5 * s.u, { size: 3, color: s.c('green') }));
}

/** A line of text centered high on the stage. */
function headline(s: Scene, text: string, y: number, k: Parameters<Scene['c']>[0], a: number, o: { mono?: boolean; weight?: number } = {}): void {
  s.alpha(a, () => s.text(text, s.w / 2, y, { size: s.tall ? 3.3 : 3.6, font: o.mono ? 'mono' : 'serif', weight: o.weight ?? 500, color: s.c(k), halo: true }));
}

// ---- rule: seen K D, now K; the same rule in real text; the name and who found it

const rule: SceneDef = {
  draw(s) {
    const u = s.u;
    const { xs, y } = layout(s);
    const g = s.ease('guess', 0.6, 2.5);
    row(s, (i) => (i === 0 || i === 1 || i === 5 ? g : 0), (i) => s.ease('seq', 0.4, 0.3 + 0.45 * i));
    s.alpha(s.ease('seq', 0.4, 3), () => slot(s, s.ease('guess', 0.6, 5)));
    s.alpha(g, () => {
      const a = xs[0]! - 5 * u;
      const b = xs[1]! + 5 * u;
      const yb = y - 7 * u;
      s.line(a, yb + 1.2 * u, a, yb, s.c('gold'), 0.3);
      s.line(a, yb, b, yb, s.c('gold'), 0.3);
      s.line(b, yb, b, yb + 1.2 * u, s.c('gold'), 0.3);
      s.text('seen K D', (a + b) / 2, yb - 3 * u, { size: 3.2, font: 'mono', color: s.c('gold') });
      s.text('K again', xs[5]!, yb - 3 * u, { size: 3.2, font: 'mono', color: s.c('gold') });
    });

    // The same rule in real text: a name, then its first half again.
    const y1 = s.h * 0.2;
    const y2 = s.h * 0.28;
    s.alpha(s.win('repeat', 'induction'), () => {
      const size = s.tall ? 3 : 3.3;
      const o = { size, font: 'mono' as const };
      const head = '… Nora Quill waved. Later, Nora ';
      const total = s.measure(head + 'Quill', o);
      const x0 = s.w / 2 - total / 2;
      rich(s, [['… ', '--ink-3'], ['Nora ', 'orange'], ['Quill', 'gold'], [' waved. Later, ', '--ink-3'], ['Nora ', 'orange']], x0, y1, { ...o, align: 'left' });
      const xq = x0 + s.measure(head, o);
      const wq = s.measure('Quill', o);
      const f = after(s, 'repeat', 0.55, 0.5);
      if (f < 1) s.alpha(1 - f, () => unknown(s, xq + wq / 2, y1, wq / u + 2, 5.4, size));
      s.alpha(f, () => s.text('Quill', xq, y1, { ...o, align: 'left', weight: 650, color: s.c('gold') }));
    });
    headline(s, 'nothing but the text says so', y2, '--ink-2', s.win('repeat', 'induction') * after(s, 'repeat', 0.75));

    headline(s, 'induction: a rule guessed from examples', y1, 'purple', s.win('induction', 'history'), { weight: 600 });
    headline(s, 'K → D before, so K → D again', y2, '--ink-2', s.win('induction', 'history') * after(s, 'induction', 0.3), { mono: true });
    headline(s, 'previous-token head, then induction head', y1, 'purple', s.ease('history', 0.6, 1), { weight: 600 });
    headline(s, 'two heads, in different layers', y2, '--ink-2', s.win('history', 'two') * after(s, 'history', 0.7), { mono: true });
    headline(s, 'only in models with 2 or more layers', y2, 'red', s.ease('two', 0.6), { mono: true });
    cite(s, 'Elhage, Olah et al., 2021', s.ease('history', 0.6));
  },
};

// ---- prev: why one head cannot, and the head that writes "my previous token was K"

const prev: SceneDef = {
  draw(s) {
    const u = s.u;
    const { xs, y, yn } = layout(s);
    row(s, (i) => (i === 5 || i === 1 ? s.win('need', 'back') : 0));
    slot(s, 0);
    // The head at the second K needs the D, but nothing marks the D yet.
    s.alpha(s.win('need', 'back'), () => {
      const c = s.ctx;
      c.save();
      c.setLineDash([1.2 * u, 1 * u]);
      arc(s, xs[5]!, xs[1]! + 2 * u, y - 4.5 * u, 30, 'gold', 0.4);
      c.restore();
      s.text('?', (xs[5]! + xs[1]!) / 2, y - 4.5 * u - 18.5 * u, { size: 4, font: 'mono', weight: 700, color: s.c('gold'), halo: true });
    });
    headline(s, 'the head at K must find the D', s.h * 0.16, 'gold', s.win('need', 'blind'));
    s.alpha(s.win('blind', 'write'), () => {
      unknown(s, xs[1]!, yn, 10, 6.5, 3);
      s.text('D\'s stream: just D', xs[1]! - 5 * u, yn + 7.5 * u, { size: 3, align: 'left', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('back', 0.6), () => {
      for (let i = 1; i < SEQ.length; i++) s.alpha(s.ease('back', 0.5, 0.4 + 0.3 * i), () => arc(s, xs[i]!, xs[i - 1]! + 1.5 * u, y - 4.5 * u, 7, 'purple'));
    });
    headline(s, 'each position attends one back', s.h * 0.24, 'purple', s.win('back', 'order'));
    notes(s, (i) => s.ease('write', 0.5, 0.3 * i), s.ease('write', 0.6, 2.5));
    headline(s, 'writes stay: every layer above can read them', s.h * 0.16, 'green', s.ease('order', 0.6));
    headline(s, 'one layer\'s heads all read, then write', s.h * 0.24, '--ink-2', after(s, 'order', 0.45), { mono: true });
  },
};

// ---- match: the induction head finds the D, copies it, and D's score goes up

/** A point along the quadratic curve from p0 through control c to p1. */
const quad = (p0: [number, number], c: [number, number], p1: [number, number], f: number): [number, number] => [
  (1 - f) ** 2 * p0[0] + 2 * (1 - f) * f * c[0] + f ** 2 * p1[0],
  (1 - f) ** 2 * p0[1] + 2 * (1 - f) * f * c[1] + f ** 2 * p1[1],
];

const match: SceneDef = {
  draw(s) {
    const u = s.u;
    const { xs, y } = layout(s);
    const hit = s.ease('hit', 0.8);
    const score = s.ease('score', 0.8, 0.3);
    row(s, (i) => (i === 5 ? 1 : i === 1 ? hit : 0));
    slot(s, after(s, 'score', 0.6));
    notes(s, () => 1, hit);
    headline(s, 'query: previous token was K?', s.h * 0.16, 'gold', s.win('query', 'copy'), { mono: true });
    s.alpha(hit * (1 - 0.6 * score), () => arc(s, xs[5]!, xs[1]! + 2 * u, y - 4.5 * u, 30, 'gold', 0.6));
    headline(s, 'only position 1 matches', s.h * 0.24, '--ink-2', s.ease('hit', 0.6, 2.5) * (1 - s.ease('copy', 0.5)));

    // D's value travels back along the arc into the second K's stream.
    const ya = y - 4.5 * u;
    const p0: [number, number] = [xs[1]! + 2 * u, ya];
    const c: [number, number] = [(xs[1]! + xs[5]!) / 2 + u, ya - 30 * u];
    const p1: [number, number] = [xs[5]!, ya];
    const f = smooth(after(s, 'copy', 0.1, 1.6));
    if (f > 0 && f < 1) {
      const [x, yy] = quad(p0, c, p1, f);
      chip(s, x, yy, 'D', 'gold', { w: 6, h: 5.5, size: 3, on: 1 });
    }
    s.alpha(f >= 1 ? 1 : 0, () => chip(s, xs[5]! + 5.5 * u, y - 7 * u, 'D', 'gold', { w: 5.5, h: 5, size: 2.8, on: 1 }));
    headline(s, 'copy D into the second K\'s stream', s.h * 0.16, 'gold', s.win('copy', 'score'), { weight: 600 });

    // Next-token scores: D's goes up.
    s.alpha(s.ease('score', 0.6), () => {
      const bx = columns(s, 5, 9);
      const base = s.h * 0.3;
      const vals = ['K', 'D', 'R', 'A', 'M'].map((t) => (t === 'D' ? 0.25 + 0.75 * score : 0.25));
      s.alpha(1 - s.ease('olsson', 0.6), () => s.text('next-token scores', s.w / 2, s.h * 0.1, { size: 3, color: s.c('--ink-2'), halo: true }));
      bars(s, bx, base, vals, 'gold', { max: 1, height: 14, w: 6, hi: [0, score, 0, 0, 0] });
      ['K', 'D', 'R', 'A', 'M'].forEach((t, i) => s.text(t, bx[i]!, base + 3.2 * u, { size: 3, font: 'mono', weight: 600, color: s.c(i === 1 ? 'gold' : '--ink-3') }));
    });
    s.arrow(xs[5]! + 5.5 * u, y, xs[6]! - 5.5 * u, y, s.tint('gold', after(s, 'score', 0.5)), 0.4, 1.6);
    const cy = s.h * 0.93;
    s.alpha(s.win('pair', 'olsson'), () => s.text('seen A B, now A: predict B, for any A and B', s.w / 2, cy, { size: 3, font: 'mono', color: s.c('--ink-2'), halo: true }));
    s.alpha(s.ease('olsson', 0.6), () => s.text('forms early in training, with 2+ layers', s.w / 2, cy, { size: 3, font: 'mono', color: s.c('--ink-2'), halo: true }));
    cite(s, 'Olsson, Elhage, Nanda et al., 2022', s.ease('olsson', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { rule, prev, match };
