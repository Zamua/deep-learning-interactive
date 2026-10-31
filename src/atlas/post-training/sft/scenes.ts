import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cite, rowLabel } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { chips, row, type Row, rowWidth } from '../draw';

const USER = ['<user>', 'capital', 'of', 'peru', '?'];
const ASST = ['<asst>', 'lima', '.', '<end>'];
const TOK = [...USER, ...ASST];
/** The probability the model gives each token, predicting it from the ones before; the first has nothing before it. */
const P = [NaN, 0.1, 0.4, 0.05, 0.6, 0.9, 0.5, 0.8, 0.9];
const NLL = P.map((p) => (Number.isNaN(p) ? NaN : Math.round(-Math.log(p) * 100) / 100));
const MASK = TOK.map((_, i) => (i > USER.length ? 1 : 0));
const GRADED = NLL.filter((_, i) => MASK[i]);
const SUM = GRADED.reduce((a, b) => a + b, 0);

const isMarker = (t: string) => t.startsWith('<');
const ink = (i: number): Ink => (isMarker(TOK[i]!) ? 'slate' : i < USER.length ? 'orange' : 'green');
const M: Ink = 'slate';

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.3) {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });
}

// ---- the problem: a pretrained model continues its prompt

const PROMPT = ['capital', 'of', 'peru', '?'];
const CONT = ['capital', 'of', 'chile', '?', '…'];
const ANS = ['lima', '.'];

const ask: SceneDef = {
  draw(s) {
    const u = s.u;
    const x0 = s.w / 2 - Math.max(rowWidth(s, PROMPT), rowWidth(s, CONT)) / 2;
    const yP = s.h * 0.13;
    const by = s.h * 0.33;
    const yC = s.h * 0.55;
    const yA = yC + 17 * u;
    const lab = { size: 2.9, align: 'left' as const, color: s.c('--ink-3') };
    // The prompt goes in at the top.
    const pr = s.ease('prompt', 0.8, 1);
    s.alpha(pr, () => {
      s.text('the prompt', x0, yP - 6.5 * u, { ...lab, color: s.c('orange') });
      chips(s, PROMPT, row(s, PROMPT, x0), yP, () => 'orange');
      s.arrow(s.w / 2, yP + 4.5 * u, s.w / 2, by - 7 * u, s.c('--ink-3'), 0.35, 2);
    });
    // The model, there from the first beat.
    s.rrect(s.w / 2 - 26 * u, by - 6 * u, 52 * u, 12 * u, 2, { fill: s.tint('purple', 0.12), stroke: s.tint('purple', 0.7), lw: 0.35 });
    s.text('pretrained model', s.w / 2, by - 1.6 * u, { size: 3.6, font: 'mono', weight: 600, color: s.c('purple') });
    s.text('continues the text it is given', s.w / 2, by + 2.8 * u, { size: 2.8, color: s.c('--ink-3') });
    // What it writes, and what an assistant would write.
    const qz = s.ease('quiz', 0.8, 0.8);
    s.alpha(qz, () => {
      s.arrow(s.w / 2, by + 6.5 * u, s.w / 2, yC - 11 * u, s.c('--ink-3'), 0.35, 2);
      s.text('it carries on the quiz list  ✗', x0, yC - 6.5 * u, { ...lab, color: s.c('red') });
      chips(s, CONT, row(s, CONT, x0), yC, () => 'red', { a: (i) => clamp01(qz * 6 - i) });
    });
    s.alpha(s.ease('assistant', 0.8, 1.6), () => {
      s.text('an assistant answers  ✓', x0, yA - 6.5 * u, { ...lab, color: s.c('green') });
      chips(s, ANS, row(s, ANS, x0), yA, () => 'green', { on: () => 0.4 });
    });
    const cy = s.h * 0.93;
    s.alpha(s.win('pretrained', 'prompt'), () => caption(s, 'trained on text: predict the next token', cy));
    s.alpha(s.win('assistant', 'ouyang'), () => caption(s, 'continuing text is not answering', cy));
    s.alpha(s.win('ouyang', 'tune'), () => caption(s, '~13,000 prompts, each with a written reply', cy, 'green'));
    s.alpha(s.win('tune', 'name'), () => caption(s, 'fine-tune GPT-3 on those replies', cy, 'purple'));
    s.alpha(s.ease('name', 0.6), () => {
      s.text('SFT: supervised fine-tuning', s.w / 2, s.h * 0.82, { size: 3.8, font: 'mono', weight: 650, color: s.c('--ink') });
      rich(s, [['supervised', 'green'], [': right answers given, like labels', '--ink-2']], s.w / 2, s.h * 0.82 + 6 * u, { size: 3 });
      rich(s, [['fine-tuning', 'purple'], [': keep training from pretrained', '--ink-2']], s.w / 2, s.h * 0.82 + 10.5 * u, { size: 3 });
    });
    cite(s, 'InstructGPT · Ouyang et al., 2022', s.ease('ouyang', 0.6));
  },
};

// ---- the conversation as one row of tokens, with a loss bar over each

interface Seq {
  r: Row;
  xs: number[];
  ys: number[];
  ws: number[];
  /** Tallest bar, in stage units. */
  bar: number;
  /** Below the lowest mask cell. */
  bottom: number;
  x0: number;
}

/** One row when it fits, else the question on one row and the reply under it, like a chat. */
function seq(s: Scene): Seq {
  const u = s.u;
  const one = rowWidth(s, TOK) <= s.w - 16 * u;
  if (one) {
    const x0 = s.w / 2 - rowWidth(s, TOK) / 2;
    const r = row(s, TOK, x0);
    const y = s.h * 0.4;
    return { r, xs: r.xs, ys: TOK.map(() => y), ws: r.ws, bar: 17, bottom: y + 12 * u, x0 };
  }
  const x0 = s.w / 2 - Math.max(rowWidth(s, USER), rowWidth(s, ASST)) / 2;
  const ru = row(s, USER, x0);
  const ra = row(s, ASST, x0);
  const y1 = s.h * 0.28;
  const y2 = y1 + 38 * u;
  return { r: ru, xs: [...ru.xs, ...ra.xs], ys: [...USER.map(() => y1), ...ASST.map(() => y2)], ws: [...ru.ws, ...ra.ws], bar: 16, bottom: y2 + 12 * u, x0 };
}

const MAXL = 3;

/** Each token's loss as a bar standing over its chip; `a(i)` fades a bar, `hi(i)` lights it, `zoom` stretches the scale. */
function lossBars(s: Scene, L: Seq, grow: number, a: (i: number) => number, hi: (i: number) => number = () => 0, zoom = 1, vis: (i: number) => number = () => 1) {
  const u = s.u;
  TOK.forEach((_, i) => {
    const v = NLL[i]!;
    if (Number.isNaN(v) || grow <= 0) return;
    const x = L.xs[i]!;
    const base = L.ys[i]! - 5 * u;
    const w = Math.min(L.ws[i]! - 1.5 * u, 7 * u);
    const hh = Math.max(0.5 * u, Math.min(1, (v * zoom) / MAXL) * L.bar * u * grow);
    const k = a(i);
    const h = hi(i);
    // A switched-off bar keeps a faint outline where it stood.
    s.alpha(vis(i), () => {
      s.rrect(x - w / 2, base - hh, w, hh, 0.6, { fill: s.tint('red', (0.3 + 0.3 * h) * k), stroke: s.tint('red', 0.25 + 0.6 * k), lw: 0.3 });
      s.alpha(k * clamp01((grow - 0.6) / 0.4), () => s.text(v.toFixed(2), x, base - hh - 2.6 * u, { size: 2.7, font: 'mono', weight: 600, color: s.c('red'), halo: true }));
    });
  });
}

function tokens(s: Scene, L: Seq, o: { a?: (i: number) => number; on?: (i: number) => number } = {}) {
  const h = 7 * s.u;
  TOK.forEach((t, i) => s.alpha(o.a?.(i) ?? 1, () => s.cell(L.xs[i]! - L.ws[i]! / 2, L.ys[i]! - h / 2, L.ws[i]!, h, t, ink(i), { on: o.on?.(i) ?? 0, size: 3.2 })));
}

/** The y for captions under the tokens, in the space left at the bottom. */
const capY = (s: Scene, L: Seq, k: number) => L.bottom + (4 + k * 6) * s.u;

const sequence: SceneDef = {
  draw(s) {
    const L = seq(s);
    const u = s.u;
    const show = s.ease('write', 1.4, 0.3);
    const mk = s.win('markers', 'predict');
    const bad = s.ease('problem', 0.6);
    tokens(s, L, { a: (i) => clamp01(show * 10 - i), on: (i) => (isMarker(TOK[i]!) ? mk : 0) });
    // Which part is which, under the chips, until the probabilities take that place.
    s.alpha(s.win('markers', 'predict'), () => {
      const lab = { size: 2.8, align: 'left' as const } as const;
      s.text('the question', L.xs[1]! - L.ws[1]! / 2, L.ys[1]! + 7 * u, { ...lab, color: s.c('orange') });
      s.text('the reply', L.xs[6]! - L.ws[6]! / 2, L.ys[6]! + 7 * u, { ...lab, color: s.c('green') });
    });
    // Each token's probability, predicted from the ones before it.
    s.alpha(s.ease('predict', 0.8, 0.5), () => {
      TOK.forEach((_, i) => {
        const p = P[i]!;
        s.text(Number.isNaN(p) ? '·' : p.toFixed(2), L.xs[i]!, L.ys[i]! + 7 * u, { size: 2.7, font: 'mono', color: s.c('teal') });
      });
      rowLabel(s, 'p', L.x0 - 2.5 * u, L.ys[USER.length]! + 7 * u, 'teal', 3.2);
    });
    const grow = s.ease('bars', 1.2, 0.8);
    lossBars(s, L, grow, () => 1, (i) => (i < USER.length ? bad : 0));
    s.alpha(s.ease('write', 0.6, 1.5) * (1 - s.ease('markers', 0.5)), () => caption(s, 'one sequence: 9 tokens', capY(s, L, 0)));
    s.alpha(s.win('markers', 'predict'), () => caption(s, 'markers come from a fixed template', capY(s, L, 0), 'slate'));
    s.alpha(s.win('bars', 'problem'), () => caption(s, 'bar: −ln p, the loss at that token', capY(s, L, 0), 'red'));
    s.alpha(bad, () => {
      caption(s, 'graded too: it would learn', capY(s, L, 0), 'red');
      caption(s, 'to write the questions', capY(s, L, 0) + 4.6 * u, 'red');
    });
  },
};

const mask: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = \frac{\sum_t \sym{m}{m}_t\,(-\ln \symp_t)}{\sum_t \sym{m}{m}_t}`, x: 0.5, y: 0.87, size: 6 },
  },
  draw(s) {
    const L = seq(s);
    const u = s.u;
    const off = s.ease('off', 1);
    const ctx = s.win('context', 'lima');
    const end = s.win('end', 'off');
    const mkr = s.win('markers', 'end');
    tokens(s, L, { on: (i) => (i < USER.length ? ctx * 0.6 : 0) + (i === TOK.length - 1 ? end : 0) + (isMarker(TOK[i]!) ? mkr : 0) });
    const lima = s.win('lima', 'rest');
    // Once only the reply's bars are left, the scale stretches so they can be read.
    const zoom = s.ease('lima', 1.2);
    lossBars(s, L, 1, (i) => (MASK[i] ? 1 : 1 - off * 0.9), (i) => (MASK[i] ? Math.max(i === 6 ? lima : 0, s.win('rest', 'why')) : 0), 1 + 2 * zoom, (i) => (MASK[i] ? 1 : 1 - zoom));
    // The mask, one cell per token.
    const mA = s.ease('mask', 0.8, 0.4);
    const cw = 6.5 * u;
    s.alpha(mA, () => {
      TOK.forEach((_, i) => {
        const on = MASK[i] ? 0.6 : isMarker(TOK[i]!) ? mkr : 0;
        s.cell(L.xs[i]! - cw / 2, L.ys[i]! + 5.3 * u, cw, 6.2 * u, String(MASK[i]), M, { on: i === TOK.length - 1 ? Math.max(on, end) : on, size: 3 });
      });
      rowLabel(s, 'm', L.x0 - 2.5 * u, L.ys[USER.length]! + 8.4 * u, M, 3.4);
    });
    const y0 = capY(s, L, 0);
    s.alpha(s.win('mask', 'markers') * after(s, 'mask', 0.5), () => caption(s, '1: the assistant wrote it · 0: not', y0, M));
    s.alpha(mkr, () => caption(s, 'markers: 0, the template wrote them', y0, M));
    s.alpha(end, () => caption(s, '<end>: 1, so it learns to stop', y0, 'green'));
    s.alpha(s.win('off', 'context'), () => caption(s, 'loss × mask: the question\'s bars switch off', y0, 'red'));
    s.alpha(ctx, () => caption(s, 'still read as input, just not graded', y0, 'orange'));
    s.alpha(lima, () => caption(s, 'lima: p = 0.5, −ln 0.5 ≈ 0.69', y0, 'red'));
    s.alpha(s.win('rest', 'mean'), () => caption(s, '0.69 + 0.22 + 0.11 = 1.02', y0, 'red'));
    s.alpha(s.win('mean', 'formula'), () => rich(s, [['L', 'red'], [` = ${SUM.toFixed(2)} / 3 ≈ ${(SUM / 3).toFixed(2)}`, '--ink-2']], s.w / 2, y0, { size: 3.6, weight: 600 }));
    s.alpha(s.win('why', 'formula'), () => caption(s, 'the average over reply tokens only', y0 + 6 * u, '--ink-3', 3.1));
    s.show('f', s.ease('formula', 0.6, 0.8));
  },
};

// ---- longer conversations: every reply graded, every other turn context

const TURNS: { role: string; n: number; m: number; k: Ink; side: 'mid' | 'left' | 'right' }[] = [
  { role: 'system prompt', n: 24, m: 0, k: 'purple', side: 'mid' },
  { role: 'user', n: 12, m: 0, k: 'orange', side: 'right' },
  { role: 'reply', n: 20, m: 1, k: 'green', side: 'left' },
  { role: 'user', n: 8, m: 0, k: 'orange', side: 'right' },
  { role: 'reply', n: 10, m: 1, k: 'green', side: 'left' },
];

const longer: SceneDef = {
  draw(s) {
    const u = s.u;
    const colW = Math.min(s.w - 14 * u, 104 * u);
    const cl = s.w / 2 - colW / 2;
    const cr = s.w / 2 + colW / 2;
    const bh = 8.5 * u;
    const gap = 4 * u;
    const y0 = s.h * 0.1;
    const count = s.ease('count', 0.6);
    TURNS.forEach((t, i) => {
      const a = i === 0 ? s.ease('system', 0.6, 0.4) : s.ease('turns', 0.5, 0.6 + 0.9 * (i - 1));
      const y = y0 + i * (bh + gap);
      const text = `${t.role} · ${t.n} tokens`;
      const bw = s.measure(text, { size: 3, font: 'mono' }) + 8 * u;
      const bx = t.side === 'mid' ? s.w / 2 - bw / 2 - 8 * u : t.side === 'left' ? cl : cr - bw;
      const on = t.m ? count : 0;
      s.alpha(a, () => {
        s.rrect(bx, y, bw, bh, 3, { fill: s.tint(t.k, 0.12 + 0.2 * on), stroke: s.tint(t.k, 0.6 + 0.4 * on), lw: 0.35 + 0.2 * on });
        s.text(text, bx + bw / 2, y + bh / 2 + 0.2 * u, { size: 3, font: 'mono', color: s.c(t.k) });
        // The mask badge, on the open side of the bubble.
        const mx = t.side === 'right' ? bx - 9 * u : bx + bw + 9 * u;
        s.cell(mx - 6.5 * u, y + 1 * u, 13 * u, bh - 2 * u, `m = ${t.m}`, M, { on: t.m ? 0.5 + 0.5 * count : 0, size: 2.8 });
      });
    });
    const yb = y0 + TURNS.length * (bh + gap) + 4 * u;
    s.alpha(s.win('system', 'turns'), () => caption(s, 'instructions, before the first question: context', yb, 'purple', 3.1));
    s.alpha(s.win('turns', 'count'), () => caption(s, 'every reply graded, each with its <end>', yb, 'green', 3.1));
    s.alpha(count, () => {
      rich(s, [['20 + 10 = 30', 'green'], [' of 74 tokens carry loss', '--ink-2']], s.w / 2, yb, { size: 3.3, weight: 600 });
    });
    s.alpha(s.ease('lr', 0.6), () => caption(s, 'small learning rate: keep what pretraining taught', yb + 7 * u, '--ink-3', 3));
  },
};

export const scenes: Record<string, SceneDef> = { ask, sequence, mask, longer };
