import type { Scene, SceneDef } from '../../../lecture/scene';
import { arc, chip, columns } from '../draw';

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

/** The slot for the next token: a question mark, or the guess once it is made. */
function slot(s: Scene, guess: number): void {
  const { xs, y } = layout(s);
  const x = xs[6]!;
  if (guess < 1) {
    s.alpha(1 - guess, () => {
      const c = s.ctx;
      c.save();
      c.setLineDash([1 * s.u, 0.8 * s.u]);
      s.rrect(x - 5 * s.u, y - 4 * s.u, 10 * s.u, 8 * s.u, 1.2, { stroke: s.c('--ink-3'), lw: 0.3 });
      c.restore();
      s.text('?', x, y + 0.2 * s.u, { size: 3.8, font: 'mono', color: s.c('--ink-3') });
    });
  }
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

const rule: SceneDef = {
  draw(s) {
    const { xs, y } = layout(s);
    const g = s.ease('guess', 0.6);
    row(s, (i) => (i === 0 || i === 1 || i === 5 ? g : 0), (i) => s.ease('seq', 0.4, 0.3 + 0.45 * i));
    s.alpha(s.ease('seq', 0.4, 3), () => slot(s, s.ease('guess', 0.6, 3)));
    s.alpha(g, () => {
      const a = xs[0]! - 5 * s.u;
      const b = xs[1]! + 5 * s.u;
      const yb = y - 7 * s.u;
      s.line(a, yb + 1.2 * s.u, a, yb, s.c('gold'), 0.3);
      s.line(a, yb, b, yb, s.c('gold'), 0.3);
      s.line(b, yb, b, yb + 1.2 * s.u, s.c('gold'), 0.3);
      s.text('seen K D', (a + b) / 2, yb - 3 * s.u, { size: 3.2, font: 'mono', color: s.c('gold') });
      s.text('K again', xs[5]!, yb - 3 * s.u, { size: 3.2, font: 'mono', color: s.c('gold') });
    });
    s.alpha(s.ease('two', 0.6), () => {
      s.text('previous-token head, then induction head', s.w / 2, s.h * 0.2, { size: s.tall ? 3.3 : 3.6, weight: 600, color: s.c('purple') });
    });
  },
};

const prev: SceneDef = {
  draw(s) {
    const { xs, y } = layout(s);
    row(s, () => 0);
    slot(s, 0);
    s.alpha(s.ease('back', 0.6), () => {
      for (let i = 1; i < SEQ.length; i++) s.alpha(s.ease('back', 0.5, 0.4 + 0.3 * i), () => arc(s, xs[i]!, xs[i - 1]! + 1.5 * s.u, y - 4.5 * s.u, 7, 'purple'));
      s.text('each position attends one back', s.w / 2, s.h * 0.24, { size: 3.4, color: s.c('purple') });
    });
    notes(s, (i) => s.ease('write', 0.5, 0.3 * i), s.ease('write', 0.6, 2.5));
  },
};

const match: SceneDef = {
  draw(s) {
    const { xs, y } = layout(s);
    const hit = s.ease('hit', 0.8);
    const copy = s.ease('copy', 0.6);
    row(s, (i) => (i === 5 ? 1 : i === 1 ? hit : 0));
    slot(s, copy);
    notes(s, () => 1, hit);
    s.alpha(s.win('query', 'copy'), () => {
      s.text('query: previous token was K?', s.w / 2, s.h * 0.16, { size: s.tall ? 3.3 : 3.6, font: 'mono', color: s.c('gold') });
    });
    s.alpha(hit, () => arc(s, xs[5]!, xs[1]! + 2 * s.u, y - 4.5 * s.u, 30, 'gold', 0.6));
    s.alpha(s.ease('hit', 0.6, 2.5) * (1 - copy), () => s.text('only position 1 matches', s.w / 2, s.h * 0.24, { size: 3.2, color: s.c('--ink-2') }));
    s.alpha(copy, () => {
      s.arrow(xs[5]! + 5.5 * s.u, y, xs[6]! - 5.5 * s.u, y, s.c('gold'), 0.4, 1.6);
      s.text('copy D: its score goes up', s.w / 2, s.h * 0.16, { size: s.tall ? 3.3 : 3.6, weight: 600, color: s.c('gold') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { rule, prev, match };
