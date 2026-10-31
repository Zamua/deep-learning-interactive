import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { cite } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { note } from '../../language-models/draw';

type Row = { who: string; k: Ink; toks: string[] };

/** The exchange, token by token: the prompt, the model's call, the program's result, the model's answer. */
const ROWS: Row[] = [
  { who: 'prompt · 7 tokens', k: 'orange', toks: ['What', 'is', 'the', 'weather', 'in', 'Paris', '?'] },
  { who: 'model · 6 tokens', k: 'gold', toks: ['<call>', 'weather', '("', 'Paris', '")', '</call>'] },
  { who: 'program · 5 tokens', k: 'teal', toks: ['<result>', '18°C', ',', 'sunny', '</result>'] },
  { who: 'model', k: 'gold', toks: ['It', 'is', '18°C', 'and', 'sunny', '.'] },
];
const STEP = ['', '1. model writes the call', '4. program pastes the result', '5. model writes on'];

/** Token chips left-aligned from x0; returns their centers and the right edge. */
function tokens(s: Scene, x0: number, y: number, toks: string[], k: Ink, o: { size: number; h: number; show?: (i: number) => number; on?: (i: number) => number }): { xs: number[]; right: number } {
  const xs: number[] = [];
  let x = x0;
  toks.forEach((t, i) => {
    const w = Math.max(5.5 * s.u, 2.2 * s.u + s.measure(t, { size: o.size, font: 'mono' }));
    xs.push(x + w / 2);
    s.alpha(o.show?.(i) ?? 1, () => {
      s.cell(x, y - (o.h * s.u) / 2, w, o.h * s.u, '', k, { on: o.on?.(i) ?? 0 });
      s.text(t, x + w / 2, y + 0.2 * s.u, { size: o.size, font: 'mono', weight: 600, color: s.c(k) });
    });
    x += w + 1 * s.u;
  });
  return { xs, right: x - 1 * s.u };
}

/** Width of a row of token chips, in px. */
const rowWidth = (s: Scene, toks: string[], size: number) => toks.reduce((t, x) => t + Math.max(5.5 * s.u, 2.2 * s.u + s.measure(x, { size, font: 'mono' })) + s.u, -s.u);

/** Rows above the program on a phone; rows beside it otherwise, the pair centered. */
function layout(s: Scene) {
  if (s.tall) {
    const ys = [10, 24, 38, 52].map((v) => v * s.u);
    return { size: 2.6, h: 6, x0: 5 * s.u, ys, box: { x: 12 * s.u, y: s.h - 31 * s.u, w: 76 * s.u, h: 26 * s.u } };
  }
  const size = s.w / s.u >= 150 ? 2.9 : 2.6;
  const rows = Math.max(...ROWS.map((r) => rowWidth(s, r.toks, size)));
  const bw = Math.min(50 * s.u, s.w - rows - 18 * s.u);
  const x0 = Math.max(4 * s.u, (s.w - rows - 8 * s.u - bw) / 2);
  return { size, h: size > 2.7 ? 6.6 : 6.2, x0, ys: [0.17, 0.37, 0.57, 0.77].map((f) => f * s.h), box: { x: x0 + rows + 8 * s.u, y: s.h * 0.27, w: bw, h: s.h * 0.46 } };
}

/** A label that turns into another at beat `to`. */
function swap(s: Scene, a: string, b: string, to: string, x: number, y: number, k: Ink, size: number): void {
  const t = b ? s.ease(to, 0.6) : 0;
  const o = { size, font: 'mono', weight: 600, align: 'left', color: s.c(k) } as const;
  s.alpha(1 - t, () => s.text(a, x, y, o));
  s.alpha(t, () => s.text(b, x, y, o));
}

const write: SceneDef = {
  draw(s) {
    exchange(s, true);
  },
};

const run: SceneDef = {
  draw(s) {
    exchange(s, false);
  },
};

/** The exchange as both scenes draw it: `first` is the scene where the model writes the call. */
function exchange(s: Scene, first: boolean): void {
  const L = layout(s);
  const lab = L.size - 0.2;
  const shown = (id: string, d = 0.6, delay = 0) => (first ? s.ease(id, d, delay) : 1);
  const top = (r: number) => L.ys[r]! - (L.h / 2 + 2.6) * s.u;
  const tag = (t: string, x: number, y: number, k: Ink) => s.text(t, x, y, { size: lab, font: 'mono', weight: 600, align: 'left', color: s.c(k) });

  tokens(s, L.x0, L.ys[0]!, ROWS[0]!.toks, 'orange', { size: L.size, h: L.h, show: (i) => shown('ask', 0.3, 0.15 * i) });
  s.alpha(shown('prompt', 0.5, 0.3), () => tag(ROWS[0]!.who, L.x0, top(0), 'orange'));
  if (first) s.alpha(s.ease('ask', 0.6, 4) * (1 - s.ease('call', 0.5)), () => note(s, 'weights fixed in training: no forecast', L.x0, L.ys[1]!, '--ink-3', 3, 'left'));

  // The call, written by the model; its end marker is what the program watches for.
  const on = (i: number) => (first ? (i === 0 || i === 5 ? 0.7 * s.ease('markers', 0.6) : 0) : i === 5 ? s.win('spot', 'paste') : 0);
  const r1 = tokens(s, L.x0, L.ys[1]!, ROWS[1]!.toks, 'gold', { size: L.size, h: L.h, show: (i) => shown('call', 0.3, 0.3 + 0.35 * i), on });
  if (first) {
    s.alpha(s.ease('call', 0.5) * (1 - s.ease('markers', 0.5)), () => tag('model', L.x0, top(1), 'gold'));
    s.alpha(s.ease('markers', 0.5), () => tag(ROWS[1]!.who, L.x0, top(1), 'gold'));
  } else swap(s, ROWS[1]!.who, STEP[1]!, 'steps', L.x0, top(1), 'gold', lab);

  // The program, with its tool.
  const B = L.box;
  s.alpha(shown('tool', 0.6), () => {
    s.rrect(B.x, B.y, B.w, B.h, 1.6, { fill: s.tint('teal', 0.08), stroke: s.tint('teal', 0.7), lw: 0.35 });
    const tx = B.x + 3 * s.u;
    const pitch = s.tall ? 5.4 * s.u : B.h / 6;
    const o = { size: L.size - 0.1, font: 'mono', weight: 600, align: 'left' } as const;
    s.text('program', tx, B.y + pitch * 0.85, { ...o, size: L.size + 0.2, weight: 700, color: s.c('teal') });
    s.text('tool: weather(city)', tx, B.y + pitch * 1.95, { ...o, color: s.c('--ink-2') });
    if (first) return;
    s.alpha(s.ease('spot', 0.6, 1.2), () => swap(s, 'saw </call>: stop', '2. saw </call>: stop', 'steps', tx, B.y + pitch * 3, 'gold', o.size));
    s.alpha(s.ease('run', 0.6, 0.3), () => {
      if (s.tall) swap(s, 'weather("Paris") → 18°C, sunny', '3. weather("Paris") → 18°C, sunny', 'steps', tx, B.y + pitch * 4.05, 'teal', o.size);
      else {
        swap(s, 'weather("Paris")', '3. weather("Paris")', 'steps', tx, B.y + pitch * 4.05, 'teal', o.size);
        s.text('→ 18°C, sunny', tx + 3 * s.u, B.y + pitch * 5.05, { ...o, color: s.c('teal') });
      }
    });
  });
  if (first) return;

  // Out to the program, then back with the result.
  const ink = s.c('--ink-3');
  const rx = s.w - 6 * s.u;
  s.alpha(s.win('spot', 'paste'), () => {
    if (s.tall) {
      s.line(r1.right + 2 * s.u, L.ys[1]!, rx, L.ys[1]!, ink, 0.35);
      s.arrow(rx, L.ys[1]!, rx, B.y - 1 * s.u, ink, 0.35, 2);
    } else s.arrow(r1.right + 2 * s.u, L.ys[1]!, B.x - 1.5 * s.u, B.y + B.h * 0.45, ink, 0.35, 2);
  });
  const lit = (i: number, a: number, b: number) => (i === a || i === b ? s.win('attend', 'steps') : 0);
  const r2 = tokens(s, L.x0, L.ys[2]!, ROWS[2]!.toks, 'teal', { size: L.size, h: L.h, show: (i) => s.ease('paste', 0.3, 0.6 + 0.25 * i), on: (i) => lit(i, 1, 3) });
  s.alpha(s.ease('paste', 0.5, 0.6), () => swap(s, ROWS[2]!.who, STEP[2]!, 'steps', L.x0, top(2), 'teal', lab));
  s.alpha(s.win('paste', 'resume'), () => {
    if (s.tall) {
      s.line(rx, B.y - 1 * s.u, rx, L.ys[2]!, ink, 0.35);
      s.arrow(rx, L.ys[2]!, r2.right + 2 * s.u, L.ys[2]!, ink, 0.35, 2);
    } else s.arrow(B.x - 1.5 * s.u, B.y + B.h * 0.75, r2.right + 2 * s.u, L.ys[2]!, ink, 0.35, 2);
  });

  // The answer, written with the result in view.
  const r3 = tokens(s, L.x0, L.ys[3]!, ROWS[3]!.toks, 'gold', { size: L.size, h: L.h, show: (i) => s.ease('resume', 0.3, 1 + 0.35 * i), on: (i) => lit(i, 2, 4) });
  s.alpha(s.ease('resume', 0.5, 0.8), () => swap(s, ROWS[3]!.who, STEP[3]!, 'steps', L.x0, top(3), 'gold', lab));
  s.alpha(s.win('attend', 'steps'), () => {
    for (const [a, b] of [[2, 1], [4, 3]] as const) {
      const x0 = r3.xs[a]!;
      const x1 = r2.xs[b]!;
      const y0 = L.ys[3]! - (L.h / 2) * s.u;
      const y1 = L.ys[2]! + (L.h / 2) * s.u;
      const c = s.ctx;
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo((x0 + x1) / 2 + 3 * s.u, (y0 + y1) / 2, x1, y1);
      c.strokeStyle = s.tint('gold', 0.85);
      c.lineWidth = 0.35 * s.u;
      c.stroke();
    }
    note(s, 'attention reads the result; no weight changes', L.x0, L.ys[3]! + (L.h / 2 + 4) * s.u, 'gold', 3, 'left');
  });
}

/** The few-shot prompt as lines, in the colors of in-context learning. */
const SHOT: [string, Ink][] = [
  ['Q: What is the weather in Rome?', 'blue'],
  ['<call>weather("Rome")</call>', 'blue'],
  ['<result>22°C, cloudy</result>', 'blue'],
  ['A: It is 22°C and cloudy.', 'blue'],
  ['Q: What is the weather in Paris?', 'orange'],
];

function line(s: Scene, x: number, y: number, text: string, k: Ink, w: number, size: number): void {
  s.rrect(x, y - 3.3 * s.u, w, 6.6 * s.u, 1.2, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.55), lw: 0.3 });
  s.text(text, x + 2.4 * s.u, y + 0.2 * s.u, { size, font: 'mono', weight: 600, align: 'left', color: s.c(k) });
}

/** Transcripts with calls, through gradient steps, into the weights. */
function training(s: Scene, label: string): void {
  const tall = s.tall;
  const cy = s.h - (tall ? 20 : 18) * s.u;
  const cx = s.w / 2 - (tall ? 30 : 34) * s.u;
  for (let i = 2; i >= 0; i--) {
    const ox = cx + i * 2.2 * s.u - 9 * s.u;
    const oy = cy + i * 2 * s.u - 9 * s.u;
    s.rrect(ox, oy, 18 * s.u, 14 * s.u, 1, { fill: s.c('--card'), stroke: s.tint('blue', 0.7), lw: 0.3 });
    for (let j = 0; j < 4; j++) s.rrect(ox + 2 * s.u, oy + (2.4 + j * 2.6) * s.u, (j === 1 || j === 2 ? 11 : 14) * s.u, 1.2 * s.u, 0.4, { fill: s.tint(j === 2 ? 'teal' : j === 1 ? 'gold' : 'blue', 0.6) });
  }
  s.text(label, cx + 2 * s.u, cy + 11 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c('blue') });
  const gx = s.w / 2 + (tall ? 30 : 34) * s.u;
  s.arrow(cx + 17 * s.u, cy, gx - 10 * s.u, cy, s.c('--ink-3'), 0.4, 2.2);
  s.text('gradient steps', (cx + 17 * s.u + gx - 10 * s.u) / 2, cy - 3.6 * s.u, { size: 2.7, font: 'mono', color: s.c('--ink-2'), halo: true });
  const c = 2.6 * s.u;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 6; j++) {
      const v = Math.sin(i * 2.3 + j * 1.9) * 0.5 + 0.5;
      s.rrect(gx - 3 * c + j * c + 0.25 * s.u, cy - 2 * c + i * c + 0.25 * s.u, c - 0.5 * s.u, c - 0.5 * s.u, 0.4, { fill: s.tint('blue', 0.15 + 0.6 * v) });
    }
  s.text('format in the weights', gx, cy + 9 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c('blue') });
}

/** Learning the format from a few examples in the prompt, or from transcripts in training. */
function fewShot(s: Scene): void {
  const tall = s.tall;
  const w = (tall ? 70 : 72) * s.u;
  const x = tall ? 6 * s.u : s.w / 2 - w / 2 - 14 * s.u;
  const pitch = 8.4 * s.u;
  const y0 = tall ? 10 * s.u : s.h * 0.11;
  const size = tall ? 2.7 : 2.9;
  s.alpha(1 - 0.55 * s.ease('train', 0.6), () => {
    SHOT.forEach(([t, k], i) => s.alpha(i < 4 ? s.ease('shots', 0.5, 0.5 + 0.5 * i) : s.ease('new', 0.5), () => line(s, x, y0 + i * pitch, t, k, w, size)));
    s.alpha(s.ease('new', 0.5, 1.6), () => line(s, x, y0 + 5 * pitch, '<call>weather("Paris")</call>', 'gold', w, size));
    if (!tall) {
      const tag = (txt: string, y: number, k: Ink, a: number) => s.alpha(a, () => s.text(txt, x + w + 3 * s.u, y, { size: 2.8, font: 'mono', align: 'left', color: s.c(k) }));
      tag('solved example', y0 + 1.5 * pitch, 'blue', s.ease('shots', 0.6, 2.5));
      tag('new question', y0 + 4 * pitch, 'orange', s.ease('new', 0.6, 0.4));
      tag('model writes', y0 + 5 * pitch, 'gold', s.ease('new', 0.6, 1.8));
    } else {
      const bx = x + w + 1.6 * s.u;
      s.alpha(s.ease('shots', 0.6, 2.5), () => {
        s.line(bx, y0 - 3 * s.u, bx, y0 + 3 * pitch + 3 * s.u, s.tint('blue', 0.8), 0.35);
        s.text('example', bx + 1.2 * s.u, y0 + 1.5 * pitch, { size: 2.4, font: 'mono', align: 'left', color: s.c('blue') });
      });
    }
  });
  s.alpha(s.ease('train', 0.6, 0.3), () => training(s, 'transcripts?'));
}

const LEFT = 'Pittsburgh is also known as';
const RIGHT = 'the Steel City.';
/** Toolformer's two proposed calls for that sentence, each with what the tool gave back. */
const CANDS: { q: string; r: string; beat: string; delay: number; keep: boolean }[] = [
  { q: 'QA("What other name is Pittsburgh known by?")', r: 'Steel City', beat: 'text', delay: 4.5, keep: true },
  { q: 'QA("Which country is Pittsburgh in?")', r: 'United States', beat: 'other', delay: 0.3, keep: false },
];
/** Loss on "the Steel City" with no call, and with each call's result: drawn lengths, not measured values. */
const LOSS: { label: string; len: number; k: Ink; delay: number }[] = [
  { label: 'no call', len: 30, k: 'slate', delay: 0.6 },
  { label: '+ Steel City', len: 11, k: 'teal', delay: 4.7 },
  { label: '+ United States', len: 31, k: 'red', delay: 10.3 },
];
const VERDICT = [9.2, 12.2];

/** Largest text size up to `max` at which `text` fits in `room` px. */
function fit(s: Scene, text: string, room: number, max: number): number {
  const w = s.measure(text, { size: max, font: 'mono' });
  return w <= room ? max : (max * room) / w;
}

/** Toolformer: calls proposed through ordinary text, kept only where the result lowers the loss. */
function toolformer(s: Scene): void {
  const tall = s.tall;
  const m = 5 * s.u;
  const tune = s.ease('tune', 0.8);
  const room = s.w - 2 * m;
  const call = { font: 'mono', weight: 600, align: 'left' } as const;

  // The sentence, with a slot where a call could go; the kept call fills it at the end.
  const chip = '[QA → Steel City]';
  const ss = fit(s, `${LEFT} ${chip} ${RIGHT}`, room - 4 * s.u, 2.8);
  const so = { ...call, size: ss };
  const slotW = 6 * s.u + tune * (s.measure(chip, so) + 1.6 * s.u - 6 * s.u);
  const lw = s.measure(LEFT, so);
  const sx = Math.max(m, (s.w - (lw + slotW + s.measure(RIGHT, so) + 2 * s.u)) / 2);
  const sy = 14 * s.u;
  s.text(LEFT, sx, sy, { ...so, color: s.c('--ink') });
  const gx = sx + lw + s.u;
  s.alpha(1 - tune, () => {
    s.ctx.save();
    s.ctx.setLineDash([0.8 * s.u, 0.7 * s.u]);
    s.rrect(gx, sy - 2.6 * s.u, slotW, 5.2 * s.u, 0.8, { stroke: s.tint('gold', 0.8), lw: 0.3 });
    s.ctx.restore();
  });
  s.alpha(tune, () => {
    s.rrect(gx, sy - 2.6 * s.u, slotW, 5.2 * s.u, 0.8, { fill: s.tint('gold', 0.15), stroke: s.tint('gold', 0.8), lw: 0.3 });
    s.text(chip, gx + 0.8 * s.u, sy + 0.1 * s.u, { ...so, color: s.c('gold') });
  });
  s.text(RIGHT, gx + slotW + s.u, sy, { ...so, color: s.c('--ink') });

  // More ordinary text, with calls proposed all through it.
  s.alpha(s.win('schick', 'text') * s.ease('schick', 0.6, 4.8), () => {
    const bw = Math.min(room, 90 * s.u);
    const x = (s.w - bw) / 2;
    [0.55, 0.25, 0.7].forEach((f, i) => {
      const y = (30 + 8 * i) * s.u;
      s.rrect(x, y - 0.8 * s.u, bw * f - 1.5 * s.u, 1.6 * s.u, 0.6, { fill: s.tint('slate', 0.35) });
      s.ctx.save();
      s.ctx.setLineDash([0.8 * s.u, 0.7 * s.u]);
      s.rrect(x + bw * f, y - 2.2 * s.u, 6 * s.u, 4.4 * s.u, 0.8, { stroke: s.tint('gold', 0.8), lw: 0.3 });
      s.ctx.restore();
      s.rrect(x + bw * f + 7.5 * s.u, y - 0.8 * s.u, bw * (1 - f) - 7.5 * s.u, 1.6 * s.u, 0.6, { fill: s.tint('slate', 0.35) });
    });
    s.text('ordinary text, calls proposed', s.w / 2, 56 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-2') });
  });

  // The proposed calls and their results, then whether each is kept. A phone puts the result on a line of its own.
  const verdictW = (tall ? 8 : 12) * s.u;
  const lines = CANDS.map((c) => (tall ? c.q : `${c.q} → ${c.r}`));
  const cs = Math.min(...lines.map((l) => fit(s, l, room - (tall ? 0 : verdictW), 2.8)));
  const co = { ...call, size: cs };
  const block = Math.max(...lines.map((l) => s.measure(l, co))) + (tall ? 0 : verdictW);
  const x0 = Math.max(m, (s.w - block) / 2);
  CANDS.forEach((c, i) => {
    const y = (tall ? 24 + 13 * i : 27 + 8 * i) * s.u;
    const dim = c.keep ? 1 : 1 - 0.6 * tune;
    s.alpha(s.ease(c.beat, 0.6, c.delay) * dim, () => {
      if (tall) {
        s.text(c.q, x0, y, { ...co, color: s.c('gold') });
        rich(s, [['→ ', '--ink-3'], [c.r, 'teal']], x0 + 3 * s.u, y + 5.5 * s.u, co);
      } else rich(s, [[c.q, 'gold'], [' → ', '--ink-3'], [c.r, 'teal']], x0, y, co);
      s.alpha(s.ease('keep', 0.5, VERDICT[i]!), () => {
        const vy = tall ? y + 5.5 * s.u : y;
        s.text(c.keep ? 'keep' : 'drop', x0 + block, vy, { ...co, size: cs + 0.1, weight: 700, align: 'right', color: s.c(c.keep ? 'teal' : 'red') });
      });
    });
  });

  // Loss on the words after the call: lower with a helpful result.
  const ly = (tall ? 52 : 46) * s.u;
  const unit = (tall ? 1.3 : 1.4) * s.u;
  const lab = 2.6;
  const labW = Math.max(...LOSS.map((l) => s.measure(l.label, { size: lab, font: 'mono' })));
  const bx = s.w / 2 - (labW + 2 * s.u + 31 * unit) / 2 + labW + 2 * s.u;
  s.alpha(s.ease('keep', 0.6, 0.3) * (1 - (tall ? 1 : 0.6) * tune), () => {
    s.text('loss on “the Steel City”', s.w / 2, ly, { size: 2.8, font: 'mono', weight: 600, color: s.c('--ink-2') });
    LOSS.forEach((l, i) => {
      const y = ly + (6 + 5.4 * i) * s.u;
      s.alpha(s.ease('keep', 0.5, l.delay), () => {
        s.text(l.label, bx - 2 * s.u, y, { size: lab, font: 'mono', align: 'right', color: s.c(l.k === 'slate' ? '--ink-2' : l.k) });
        s.rrect(bx, y - 1.6 * s.u, l.len * unit * s.ease('keep', 0.8, l.delay), 3.2 * s.u, 0.6, { fill: s.tint(l.k, 0.45), stroke: s.tint(l.k, 0.9), lw: 0.25 });
      });
    });
  });

  s.alpha(s.ease('tune', 0.6, 0.6), () => training(s, 'text + kept calls'));
}

const learn: SceneDef = {
  draw(s) {
    const turn = s.ease('schick', 0.6);
    s.alpha(1 - turn, () => fewShot(s));
    s.alpha(turn, () => toolformer(s));
    cite(s, 'Toolformer · Schick et al., 2023', turn);
  },
};

/** A context as a bar of segments, `unit` px per token, centered on cx; `lit` dims the others. */
function bar(s: Scene, cx: number, y: number, segs: { n: number; k: Ink; name: string; a?: number; lit?: number }[], unit: number): void {
  const total = segs.reduce((t, g) => t + g.n, 0);
  let x = cx - (total * unit) / 2;
  const h = 7 * s.u;
  for (const g of segs) {
    const w = g.n * unit;
    s.alpha(g.a ?? 1, () => {
      const on = g.lit ?? 1;
      s.rrect(x + 0.2 * s.u, y - h / 2, w - 0.4 * s.u, h, 0.8, { fill: s.tint(g.k, 0.12 + 0.3 * on), stroke: s.tint(g.k, 0.35 + 0.6 * on), lw: 0.3 });
      s.text(String(g.n), x + w / 2, y + 0.2 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c(g.k) });
      s.text(g.name, x + w / 2, y + h / 2 + 2.8 * s.u, { size: 2.5, font: 'mono', color: s.tint(g.k, 0.5 + 0.5 * on) });
    });
    x += w;
  }
}

const tryIt: SceneDef = {
  draw(s) {
    const unit = (s.tall ? 3 : 4) * s.u;
    const cx = s.w / 2;
    const y1 = s.h * 0.17;
    const wrote = s.ease('wrote', 0.6);
    const dimOther = 1 - 0.65 * wrote;
    bar(
      s,
      cx,
      y1,
      [
        { n: 7, k: 'orange', name: 'prompt', lit: dimOther },
        { n: 6, k: 'gold', name: 'call' },
        { n: 5, k: 'teal', name: 'result', lit: dimOther },
        { n: 6, k: 'gold', name: 'answer', a: wrote },
      ],
      unit,
    );
    const sz = s.tall ? 3.4 : 3.6;
    s.alpha(s.ease('count', 0.6, 1.5), () => rich(s, [['7', 'orange'], [' + ', '--ink-3'], ['6', 'gold'], [' + ', '--ink-3'], ['5', 'teal'], [' = 18', '--ink-2']], cx, y1 + 13 * s.u, { size: sz, weight: 650 }));
    s.alpha(s.ease('count', 0.6, 4), () => note(s, 'in view when the model writes on', cx, y1 + 19 * s.u, '--ink-3', 3));
    s.alpha(s.ease('wrote', 0.6, 1.2), () => {
      rich(s, [['6', 'gold'], [' + ', '--ink-3'], ['6', 'gold'], [' = 12', '--ink-2']], cx, y1 + 27 * s.u, { size: sz, weight: 650 });
      note(s, 'written by the model', cx, y1 + 33 * s.u, 'gold', 3);
    });
    const y2 = s.h * (s.tall ? 0.7 : 0.72);
    s.alpha(s.ease('p1', 0.6), () => {
      bar(
        s,
        cx,
        y2,
        [
          { n: 12, k: 'orange', name: 'prompt' },
          { n: 7, k: 'gold', name: 'call' },
          { n: 4, k: 'teal', name: 'result' },
        ],
        unit,
      );
      s.alpha(1 - s.ease('a1', 0.4), () => s.text('context = ?', cx, y2 - 9 * s.u, { size: sz, font: 'mono', weight: 650, color: s.c('--ink-2') }));
    });
    s.alpha(s.ease('a1', 0.6), () => rich(s, [['12', 'orange'], [' + ', '--ink-3'], ['7', 'gold'], [' + ', '--ink-3'], ['4', 'teal'], [' = 23', '--ink-2']], cx, y2 - 9 * s.u, { size: sz, weight: 650 }));
  },
};

export const scenes: Record<string, SceneDef> = { write, run, learn, try: tryIt };
