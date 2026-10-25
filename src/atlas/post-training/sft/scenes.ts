import type { Scene, SceneDef } from '../../../lecture/scene';
import { rowLabel } from '../../draw';
import { chips, rich, row, rowWidth, type Ink } from '../draw';

const USER = ['<user>', 'capital', 'of', 'peru', '?'];
const ASST = ['<asst>', 'lima', '.', '<end>'];
/** The probability the model gives each token, predicting it from the ones before. */
const P_USER = [NaN, 0.1, 0.4, 0.05, 0.6];
const P_ASST = [0.9, 0.5, 0.8, 0.9];
const M_ASST = [0, 1, 1, 1];
const NLL = P_ASST.map((p) => Math.round(-Math.log(p) * 100) / 100);
const SUM = NLL.slice(1).reduce((a, b) => a + b, 0);

const isMarker = (t: string) => t.startsWith('<');
const userInk = (i: number): Ink => (isMarker(USER[i]!) ? 'slate' : 'orange');
const asstInk = (i: number): Ink => (i === 0 ? 'slate' : 'green');

/** Both turns as rows of chips, left-aligned like a chat, and the rows under them. */
function layout(s: Scene) {
  const x0 = s.w / 2 - Math.max(rowWidth(s, USER), rowWidth(s, ASST)) / 2 + (s.tall ? 3 : 0) * s.u;
  const yU = s.h * 0.12;
  const yA = yU + 26 * s.u;
  return { x0, yU, yA, ru: row(s, USER, x0), ra: row(s, ASST, x0) };
}

const chat: SceneDef = {
  draw(s) {
    const L = layout(s);
    // The model, there from the first beat.
    const by = s.h * 0.8;
    s.rrect(s.w / 2 - 24 * s.u, by - 6 * s.u, 48 * s.u, 12 * s.u, 2, { fill: s.tint('purple', 0.12), stroke: s.tint('purple', 0.7), lw: 0.35 });
    s.text('pretrained model', s.w / 2, by - 1.6 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c('purple') });
    s.text('predicts the next token', s.w / 2, by + 2.8 * s.u, { size: 2.8, color: s.c('--ink-3') });
    const show = s.ease('chat', 1.2);
    const mk = s.win('markers', 'predict');
    const bad = s.ease('problem', 0.6);
    chips(s, USER, L.ru, L.yU, userInk, { a: (i) => Math.min(1, Math.max(0, show * 5 - i * 0.5)), on: (i) => (isMarker(USER[i]!) ? mk : bad) });
    chips(s, ASST, L.ra, L.yA, asstInk, { a: (i) => Math.min(1, Math.max(0, show * 5 - 2.5 - i * 0.5)), on: (i) => (i === 0 || i === 3 ? mk : 0) });
    s.alpha(s.ease('markers', 0.6, 1), () => {
      s.text('user turn', L.x0, L.yU - 6.5 * s.u, { size: 2.8, align: 'left', color: s.c('orange') });
      s.text('assistant turn', L.x0, L.yA - 6.5 * s.u, { size: 2.8, align: 'left', color: s.c('green') });
    });
    // Each token's probability, predicted from the tokens before it.
    const pr = s.ease('predict', 0.8, 0.4);
    s.alpha(pr, () => {
      P_USER.forEach((p, i) => {
        if (!Number.isNaN(p)) s.text(p.toFixed(2), L.ru.xs[i]!, L.yU + 7 * s.u, { size: 2.8, font: 'mono', color: s.c(isMarker(USER[i]!) ? 'teal' : bad > 0.5 ? 'red' : 'teal') });
      });
      P_ASST.forEach((p, i) => s.text(p.toFixed(2), L.ra.xs[i]!, L.yA + 7 * s.u, { size: 2.8, font: 'mono', color: s.c('teal') }));
      rowLabel(s, 'p', L.x0 - 2.5 * s.u, L.yA + 7 * s.u, 'teal', 3.2);
    });
    s.alpha(pr * (1 - bad), () => s.arrow(s.w / 2, by - 7 * s.u, s.w / 2, L.yA + 11 * s.u, s.tint('purple', 0.6), 0.35, 2));
    s.alpha(bad, () => {
      s.text('graded too: it would learn', s.w / 2, s.h * 0.58, { size: 3.2, color: s.c('red') });
      s.text('to write the questions', s.w / 2, s.h * 0.58 + 4.6 * s.u, { size: 3.2, color: s.c('red') });
    });
  },
};

const mask: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = \frac{\sum_t \sym{m}{m}_t\,(-\ln \symp_t)}{\sum_t \sym{m}{m}_t}`, x: 0.5, y: 0.79, size: 5.6 },
  },
  draw(s) {
    const L = layout(s);
    const end = s.win('end', 'context');
    const ctx = s.win('context', 'nll');
    chips(s, USER, L.ru, L.yU, userInk, { on: () => ctx * 0.6 });
    chips(s, ASST, L.ra, L.yA, asstInk, { on: (i) => (i === 3 ? end : 0) });
    // The mask, one cell per token.
    const mA = s.ease('mask', 0.8, 0.3);
    const cw = 6.5 * s.u;
    const cell = (x: number, y: number, v: number, on: number) => s.cell(x - cw / 2, y - 3.2 * s.u, cw, 6.4 * s.u, String(v), 'gold', { on, size: 3 });
    s.alpha(mA, () => {
      USER.forEach((_, i) => cell(L.ru.xs[i]!, L.yU + 8.5 * s.u, 0, 0));
      ASST.forEach((_, i) => cell(L.ra.xs[i]!, L.yA + 8.5 * s.u, M_ASST[i]!, i === 0 ? 0 : i === 3 ? Math.max(end, 0.5) : 0.5));
      rowLabel(s, 'm', L.x0 - 2.5 * s.u, L.yA + 8.5 * s.u, 'gold', 3.4);
    });
    s.alpha(ctx, () => s.text('read as context, not graded', L.x0, L.yU + 16 * s.u, { size: 3, align: 'left', color: s.c('orange') }));
    // The graded tokens' losses.
    const nl = s.ease('nll', 0.8, 1);
    s.alpha(nl, () => {
      const nw = 9 * s.u;
      for (let i = 1; i < 4; i++) s.cell(L.ra.xs[i]! - nw / 2, L.yA + 13.5 * s.u, nw, 6.4 * s.u, NLL[i]!.toFixed(2), 'red', { on: s.win('mean', undefined), size: 2.9 });
      rowLabel(s, '−ln p', L.ra.xs[1]! - nw / 2 - 1.6 * s.u, L.yA + 16.7 * s.u, 'red', 3);
    });
    s.alpha(s.ease('mean', 0.6), () => {
      rich(s, [['L = ', 'red'], [`(${NLL.slice(1).map((v) => v.toFixed(2)).join(' + ')}) / 3`, '--ink-2'], [` ≈ ${(SUM / 3).toFixed(2)}`, 'red']], s.w / 2, s.h * 0.64, { size: 3.4, weight: 600 });
    });
    s.show('f', s.ease('mean', 0.6, 1.5));
    s.alpha(s.ease('lr', 0.6), () => s.text('small learning rate: keep what pretraining taught', s.w / 2, s.h * 0.93, { size: 3, color: s.c('--ink-3') }));
  },
};

export const scenes: Record<string, SceneDef> = { chat, mask };
