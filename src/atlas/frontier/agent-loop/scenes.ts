import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { cite } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { note } from '../../language-models/draw';

/** The transcript of the worked task: the prompt, two calls with their results, the answer. */
const LINES: { t: string; k: Ink; beat: string; delay: number }[] = [
  { t: 'What is the weather in the capital of Peru?', k: 'orange', beat: 'need', delay: 0.2 },
  { t: '<call>search("capital of Peru")</call>', k: 'gold', beat: 'first', delay: 0.6 },
  { t: '<result>Lima</result>', k: 'teal', beat: 'first', delay: 3.6 },
  { t: '<call>weather("Lima")</call>', k: 'gold', beat: 'second', delay: 1 },
  { t: '<result>19°C, cloudy</result>', k: 'teal', beat: 'second', delay: 4.2 },
  { t: 'It is 19°C and cloudy in Lima.', k: 'gold', beat: 'answer', delay: 0.6 },
];
const TURNS: [string, number, number][] = [
  ['first', 1, 2],
  ['second', 3, 4],
  ['answer', 5, 5],
];

function box(s: Scene, x: number, y: number, w: number, h: number, label: string, k: Ink, on: number, size: number): void {
  s.rrect(x - w / 2, y - h / 2, w, h, 1.4, { fill: s.tint(k, 0.1 + 0.2 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.35 + 0.2 * on });
  s.text(label, x, y + 0.2 * s.u, { size, font: 'mono', weight: 650, color: s.c(k) });
}

const loop: SceneDef = {
  draw(s) {
    const tall = s.tall;
    const size = tall ? 2.6 : 2.7;
    const lh = (tall ? 5.8 : 6.2) * s.u;
    const pitch = (tall ? 7.2 : 7.6) * s.u;
    const widest = Math.max(...LINES.map((l) => s.measure(l.t, { size, font: 'mono' })));
    const lw = widest + 4.4 * s.u;
    const lx = s.w / 2 - lw / 2 + 5 * s.u;
    const y0 = 12 * s.u;
    const shown = LINES.map((l) => s.ease(l.beat, 0.5, l.delay));
    LINES.forEach((l, i) =>
      s.alpha(shown[i]!, () => {
        const y = y0 + i * pitch;
        s.rrect(lx, y - lh / 2, lw, lh, 1, { fill: s.tint(l.k, 0.12), stroke: s.tint(l.k, 0.55), lw: 0.3 });
        s.text(l.t, lx + 2.2 * s.u, y + 0.2 * s.u, { size, font: 'mono', weight: 600, align: 'left', color: s.c(l.k) });
      }),
    );
    // Turn brackets on the left.
    TURNS.forEach(([beat, a, b], n) =>
      s.alpha(s.ease(beat, 0.5, n === 2 ? 1.2 : 4.4), () => {
        const x = lx - 1.6 * s.u;
        const ya = y0 + a * pitch - lh / 2;
        const yb = y0 + b * pitch + lh / 2;
        s.line(x, ya, x, yb, s.tint('blue', 0.8), 0.35);
        s.text(`turn ${n + 1}`, x - 1.2 * s.u, (ya + yb) / 2, { size: size - 0.2, font: 'mono', weight: 600, align: 'right', color: s.c('blue') });
      }),
    );

    // The loop: the model writes, the program runs any call and appends the result.
    const dx = s.w / 2 - (tall ? 6 : 8) * s.u;
    const my = y0 + 6 * pitch + 6 * s.u;
    const py = my + 18 * s.u;
    const bw = (tall ? 24 : 22) * s.u;
    const bh = (tall ? 8 : 7.5) * s.u;
    const hl = (beat: string, from: number, to?: number) => s.ease(beat, 0.4, from) * (to === undefined ? 1 : 1 - s.ease(beat, 0.4, to));
    const callOn = hl('first', 0.6, 3.6) + hl('second', 1, 4.2);
    const resOn = hl('first', 3.6) * (1 - s.ease('second', 0.4)) + hl('second', 4.2) * (1 - s.ease('answer', 0.4));
    const outOn = hl('answer', 0.6) * (1 - s.ease('limit', 0.5));
    const trace = s.ease('react', 0.6, 6);
    s.alpha(s.ease('need', 0.6, 2.5) * (1 - trace), () => {
      box(s, dx, my, bw, bh, 'model', 'blue', Math.max(callOn, outOn), size + 0.2);
      box(s, dx, py, bw, bh, 'program', 'teal', resOn, size + 0.2);
      const a = (on: number) => s.tint('--ink-3', 0.5 + 0.5 * on);
      const ax = 5 * s.u;
      s.arrow(dx + ax, my + bh / 2 + 0.8 * s.u, dx + ax, py - bh / 2 - 0.8 * s.u, on2(s, callOn, 'gold'), 0.35 + 0.25 * callOn, 2);
      s.text('call', dx + ax + 1.6 * s.u, (my + py) / 2, { size, font: 'mono', weight: 600, align: 'left', color: s.tint('gold', 0.55 + 0.45 * callOn) });
      s.arrow(dx - ax, py - bh / 2 - 0.8 * s.u, dx - ax, my + bh / 2 + 0.8 * s.u, on2(s, resOn, 'teal'), 0.35 + 0.25 * resOn, 2);
      s.text('result', dx - ax - 1.6 * s.u, (my + py) / 2, { size, font: 'mono', weight: 600, align: 'right', color: s.tint('teal', 0.55 + 0.45 * resOn) });
      s.arrow(dx + bw / 2 + 0.8 * s.u, my, dx + bw / 2 + 9 * s.u, my, outOn > 0.01 ? s.c('gold') : a(0), 0.35 + 0.25 * outOn, 2);
      s.text('no call: stop', dx + bw / 2 + 10.4 * s.u, my, { size, font: 'mono', weight: 600, align: 'left', color: s.tint('gold', 0.55 + 0.45 * outOn) });
    });
    s.alpha(s.ease('limit', 0.6, 0.4) * (1 - trace), () => {
      s.text('at most 10 turns', dx + bw / 2 + 2 * s.u, py, { size, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
    });
    const ny = py + (tall ? 11 : 9) * s.u;
    s.alpha(s.win('agent', 'react'), () => note(s, 'a model run in this loop: an agent (Latin agēns, doing)', s.w / 2, ny, 'blue', 3.1));

    // The same loop in ReAct's own format: a thought, an action, and what came back.
    s.alpha(trace, () => {
      const tw = Math.max(...REACT.map(([t]) => s.measure(t, { size, font: 'mono' })));
      const tx = s.w / 2 - tw / 2;
      const ty = (my + py) / 2 - 7 * s.u;
      REACT.forEach(([t, k], i) => s.alpha(s.ease('react', 0.5, 8.2 + 1.6 * i), () => s.text(t, tx, ty + i * 7 * s.u, { size, font: 'mono', weight: 600, align: 'left', color: s.c(k) })));
    });
    s.alpha(s.ease('hotpot', 0.6, 1), () => note(s, 'questions needing 2+ Wikipedia passages: 7 steps', s.w / 2, ny, '--ink-2', 3));
    cite(s, 'ReAct · Yao et al., 2022', s.ease('react', 0.6));
  },
};

/** One turn of the worked task as ReAct wrote its turns. */
const REACT: [string, Ink][] = [
  ['Thought 1: find the capital, then its weather', 'purple'],
  ['Action 1: Search[capital of Peru]', 'gold'],
  ['Observation 1: Lima', 'teal'],
];

/** An arrow's color: `k` when lit, dim ink otherwise. */
const on2 = (s: Scene, on: number, k: Ink) => (on > 0.05 ? s.tint(k, 0.5 + 0.5 * on) : s.tint('--ink-3', 0.6));

type Seg = { n: number; k: Ink; read: number };

/** One context as a bar, `unit` px per token, from x; cached segments are faint and dashed. */
function bar(s: Scene, x: number, y: number, segs: Seg[], unit: number, h: number, size: number): number {
  for (const g of segs) {
    const w = g.n * unit;
    const xx = x + 0.15 * s.u;
    const ww = w - 0.3 * s.u;
    s.alpha(1 - g.read, () => {
      s.rrect(xx, y - h / 2, ww, h, 0.6, { fill: s.tint(g.k, 0.06) });
      s.ctx.save();
      s.ctx.setLineDash([0.8 * s.u, 0.7 * s.u]);
      s.rrect(xx, y - h / 2, ww, h, 0.6, { stroke: s.tint(g.k, 0.45), lw: 0.25 });
      s.ctx.restore();
    });
    s.alpha(g.read, () => s.rrect(xx, y - h / 2, ww, h, 0.6, { fill: s.tint(g.k, 0.4), stroke: s.tint(g.k, 0.9), lw: 0.3 }));
    s.text(String(g.n), x + w / 2, y + 0.2 * s.u, { size, font: 'mono', weight: 650, color: s.tint(g.k, 0.45 + 0.55 * g.read) });
    x += w;
  }
  return x;
}

const unitOf = (s: Scene) => (s.tall ? 1.2 : 1.1) * s.u;

const grow: SceneDef = {
  draw(s) {
    const unit = unitOf(s);
    const x0 = s.w / 2 - 38 * unit;
    const size = s.tall ? 2.7 : 3;
    const h = 6.4 * s.u;
    const rows: { label: string; segs: Seg[]; total: number; a: number }[] = [
      { label: 'prompt', segs: [{ n: 30, k: 'orange', read: 1 }], total: 30, a: s.ease('p', 0.6) },
      { label: 'after turn 1', segs: [{ n: 30, k: 'orange', read: 1 }, { n: 5, k: 'gold', read: 1 }, { n: 15, k: 'teal', read: 1 }], total: 50, a: s.ease('t1', 0.6, 0.3) },
      { label: 'after turn 2', segs: [{ n: 30, k: 'orange', read: 1 }, { n: 5, k: 'gold', read: 1 }, { n: 15, k: 'teal', read: 1 }, { n: 5, k: 'gold', read: 1 }, { n: 15, k: 'teal', read: 1 }], total: 70, a: s.ease('t2', 0.6, 0.3) },
    ];
    rows.forEach((r, i) => {
      const y = s.h * (0.17 + 0.19 * i);
      s.alpha(r.a, () => {
        s.text(r.label, x0, y - h / 2 - 2.6 * s.u, { size: size - 0.3, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
        const end = bar(s, x0, y, r.segs, unit, h, size);
        s.text(`= ${r.total}`, end + 2 * s.u, y, { size, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-2') });
      });
    });
    s.alpha(s.ease('p', 0.6, 3.5), () => {
      const y = s.h * 0.79;
      const legend: [string, Ink][] = [['prompt', 'orange'], ['call', 'gold'], ['result', 'teal']];
      legend.forEach(([t, k], i) => {
        const x = s.w / 2 + (i - 1) * 20 * s.u;
        s.alpha(i === 0 ? 1 : s.ease('t1', 0.6), () => {
          s.rrect(x - 8 * s.u, y - 1.6 * s.u, 3.2 * s.u, 3.2 * s.u, 0.5, { fill: s.tint(k, 0.4), stroke: s.c(k), lw: 0.25 });
          s.text(t, x - 3.6 * s.u, y, { size: 2.7, font: 'mono', align: 'left', color: s.c(k) });
        });
      });
    });
    s.alpha(s.ease('gen', 0.6, 0.4), () => rich(s, [['after turn t: ', '--ink-2'], ['30', 'orange'], [' + ', '--ink-3'], ['20', 'gold'], [' × t', '--ink-2']], s.w / 2, s.h * 0.68, { size: s.tall ? 3.4 : 3.6, weight: 650 }));
  },
};

/** Each turn's prefill as a bar: the prompt, then every call and result before that turn. */
function turns(s: Scene, P: number, c: number, r: number, st: { rows: number[]; prev: number; call: number; plain: number[]; kept: number }): void {
  const unit = unitOf(s);
  const x0 = s.w / 2 - 38 * unit;
  const size = s.tall ? 2.7 : 3;
  const h = 6.4 * s.u;
  for (let t = 0; t < 3; t++) {
    const y = s.h * (0.13 + 0.15 * t);
    const segs: Seg[] = [{ n: P, k: 'orange', read: t === 0 ? 1 : 1 - st.prev }];
    for (let j = 1; j <= t; j++) {
      const last = j === t;
      segs.push({ n: c, k: 'gold', read: last ? 1 - st.call : 1 - st.prev });
      segs.push({ n: r, k: 'teal', read: last ? 1 : 1 - st.prev });
    }
    s.alpha(st.rows[t]!, () => {
      s.text(`turn ${t + 1} prefill`, x0, y - h / 2 - 2.6 * s.u, { size: size - 0.3, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
      const end = bar(s, x0, y, segs, unit, h, size);
      const o = { size, font: 'mono', weight: 650, align: 'left' } as const;
      s.alpha(st.plain[t]!, () => s.text(`${P + t * (c + r)}`, end + 2 * s.u, y, { ...o, color: s.c('--ink-2') }));
      s.alpha(st.kept, () => s.text(`${t === 0 ? P : r}`, end + 2 * s.u, y, { ...o, color: s.c(t === 0 ? 'orange' : 'teal') }));
    });
  }
}

const reread: SceneDef = {
  draw(s) {
    const gone = 1 - s.ease('same', 0.5, 2);
    turns(s, 30, 5, 15, {
      rows: [s.ease('prefill', 0.6), s.ease('plain', 0.6, 2.3), s.ease('plain', 0.6, 4.8)],
      prev: s.ease('same', 0.8, 2),
      call: s.ease('keep', 0.8, 1.5),
      plain: PLAIN.map((d) => s.ease('plain', 0.5, d) * gone),
      kept: s.ease('keep', 0.5, 6),
    });
    const sz = s.tall ? 3.4 : 3.6;
    s.alpha(s.win('prefill', 'fresh'), () => note(s, 'read the whole context, then write', s.w / 2, s.h * 0.58, '--ink-3', 3));
    s.alpha(s.win('fresh', 'same'), () => note(s, 'a fresh generate: empty cache, read it all', s.w / 2, s.h * 0.58, '--ink-3', 3));
    s.alpha(s.ease('sum', 0.6), () => {
      rich(s, [['30', 'orange'], [' + 50 + 70 = ', '--ink-2'], ['150', '--ink']], s.w / 2, s.h * 0.69, { size: sz, weight: 650 });
      s.alpha(1 - s.ease('cache', 0.6, 2.5), () => note(s, 'no cache: every turn reads it all', s.w / 2, s.h * 0.75, '--ink-3', 2.9));
    });
    s.alpha(s.win('same', 'keep'), () => note(s, 'earlier tokens: same keys and values, kept', s.w / 2, s.h * 0.58, '--ink-2', 3));
    s.alpha(s.win('keep', 'name'), () => note(s, 'calls: cached as the model wrote them', s.w / 2, s.h * 0.58, 'gold', 3));
    s.alpha(s.ease('name', 0.6, 1.7), () => note(s, 'prefix: the start every turn shares', s.w / 2, s.h * 0.58, '--ink-2', 3));
    s.alpha(s.ease('cache', 0.6), () => rich(s, [['30', 'orange'], [' + ', '--ink-2'], ['15', 'teal'], [' + ', '--ink-2'], ['15', 'teal'], [' = ', '--ink-2'], ['60', '--ink']], s.w / 2, s.h * 0.81, { size: sz, weight: 650 }));
    s.alpha(s.ease('name', 0.6), () => note(s, 'prefix caching: only new tokens', s.w / 2, s.h * 0.87, 'teal', 2.9));
    s.alpha(s.ease('same', 0.6, 2.5), () => legend(s, s.h * 0.95));
    cite(s, 'SGLang · Zheng et al., 2023', s.ease('sglang', 0.6));
  },
};

/** Seconds into the 'plain' beat at which each turn's no-cache read is said. */
const PLAIN = [1, 3.6, 7.8];

/** Which bars are read this turn and which come from the cache. */
function legend(s: Scene, y: number): void {
  const x = s.w / 2;
  s.rrect(x - 26 * s.u, y - 1.6 * s.u, 3.2 * s.u, 3.2 * s.u, 0.5, { fill: s.tint('slate', 0.4), stroke: s.c('slate'), lw: 0.25 });
  s.text('read this turn', x - 21.6 * s.u, y, { size: 2.6, font: 'mono', align: 'left', color: s.c('--ink-2') });
  s.ctx.save();
  s.ctx.setLineDash([0.8 * s.u, 0.7 * s.u]);
  s.rrect(x + 6 * s.u, y - 1.6 * s.u, 3.2 * s.u, 3.2 * s.u, 0.5, { stroke: s.tint('slate', 0.6), lw: 0.25 });
  s.ctx.restore();
  s.text('cached', x + 10.4 * s.u, y, { size: 2.6, font: 'mono', align: 'left', color: s.c('--ink-3') });
}

const tryIt: SceneDef = {
  draw(s) {
    const a2 = s.ease('a2', 0.8, 0.4);
    turns(s, 40, 5, 10, {
      rows: [s.ease('p1', 0.5, 0.5), s.ease('p1', 0.5, 2.5), s.ease('p1', 0.5, 4.5)],
      prev: a2,
      call: a2,
      plain: [0, 1, 2].map(() => s.ease('a1', 0.5, 0.5) * (1 - a2)),
      kept: s.ease('a2', 0.5, 1.5),
    });
    const sz = s.tall ? 3.4 : 3.6;
    s.alpha(s.ease('p1', 0.6, 6) * (1 - s.ease('a1', 0.4)), () => s.text('no cache: total = ?', s.w / 2, s.h * 0.62, { size: sz, font: 'mono', weight: 650, color: s.c('--ink-2') }));
    s.alpha(s.ease('a1', 0.6, 2), () => rich(s, [['40', 'orange'], [' + 55 + 70 = ', '--ink-2'], ['165', '--ink']], s.w / 2, s.h * 0.62, { size: sz, weight: 650 }));
    s.alpha(s.ease('a1', 0.6, 3), () => note(s, 'no cache', s.w / 2, s.h * 0.68, '--ink-3', 2.9));
    s.alpha(s.ease('a2', 0.6, 2), () => {
      rich(s, [['40', 'orange'], [' + ', '--ink-2'], ['10', 'teal'], [' + ', '--ink-2'], ['10', 'teal'], [' = ', '--ink-2'], ['60', '--ink']], s.w / 2, s.h * 0.78, { size: sz, weight: 650 });
      note(s, 'cached prefix', s.w / 2, s.h * 0.84, 'teal', 2.9);
    });
    s.alpha(s.ease('a2', 0.6, 1), () => legend(s, s.h * 0.94));
  },
};

export const scenes: Record<string, SceneDef> = { loop, grow, reread, try: tryIt };
