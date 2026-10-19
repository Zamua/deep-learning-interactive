import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { CORPUS } from '../../lib/rnn-corpus';
import { HELLO, HELLO_IN, HELLO_TG, HELLO_V, VOC, softmaxT } from './data';
import { Frame, area, bars, bend, glyph, monoBlock, monoCols, node, pill } from './kit';
import { CURVE, MILESTONES, PRETRAINED, SCORES, TEMP_SAMPLES } from './samples';

// ---------------------------------------------------------------- hello

const hello: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // The task, in one word.
    s.alpha(s.win('model', 'tiny'), () => {
      s.text('hello', w / 2, h * 0.42, { size: 14, font: 'mono', weight: 600 });
      const p = s.prog('model');
      const k = Math.min(4, Math.floor(p * 6));
      for (let i = 0; i < 5; i++) {
        const x = w / 2 + (i - 2) * u * 8.4;
        if (i === k) s.rrect(x - u * 4, h * 0.42 - u * 8, u * 8, u * 16, 1, { stroke: s.c('--accent'), lw: 0.5 });
      }
      s.text('read the characters so far, predict the next one', w / 2, h * 0.66, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(s.win('tiny', 'onehot'), () => {
      s.text('vocabulary', w / 2, h * 0.22, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
      HELLO_V.forEach((ch, i) => pill(s, ch, w / 2 + (i - 1.5) * u * 11, h * 0.32, 'orange', { font: 'mono', size: 5, on: 0 }));
      s.text('one training word: hello', w / 2, h * 0.46, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
    const gA = s.ease('tiny', 0.7);
    if (gA <= 0) return;
    const mix = s.ease('trained', 1.4, 0.4);
    const val = (a: number, b: number) => lerp(a, b, mix);
    const R = HELLO.random;
    const Tr = HELLO.trained;
    const gut = Math.min(w * 0.16, u * 18);
    const colW = (w - gut - u * 3) / 4;
    const cx = (c: number) => gut + colW * (c + 0.5);
    const cw = Math.min(colW * 0.76, u * 24);
    const yTgt = h * 0.075;
    const yLoss = h * 0.15;
    const pTop = h * 0.205;
    const pRow = h * 0.052;
    const hTop = h * 0.47;
    const hRow = h * 0.064;
    const xTop = h * 0.71;
    const xRow = h * 0.046;
    const yIn = h * 0.945;
    const reveal = (id: string, c: number) => clamp01(s.prog(id) * 5 - c);
    const trapOn = s.win('trap', 'step') + s.win('trained', undefined) * smooth((s.since('trained') - 2) * 2);
    const colA = (c: number) => (trapOn > 0 && c < 2 ? 1 - 0.65 * trapOn : 1);
    s.alpha(gA, () => {
      // gutter labels
      const gl = (t: string, y: number, k: Parameters<Scene['c']>[0], size = 3) => s.text(t, u * 2, y, { size, font: 'mono', color: s.c(k), align: 'left' });
      s.alpha(s.ease('targets', 0.5), () => gl('next', yTgt, 'gold'));
      const total = val(R.total, Tr.total);
      s.alpha(s.ease('loss', 0.5), () => {
        const tA = s.ease('sum', 0.6, 0.8);
        s.alpha(1 - tA, () => gl('loss', yLoss, 'red'));
        s.alpha(tA, () => s.text(`Σ ${total.toFixed(2)}`, u * 2, yLoss, { size: 3.6, font: 'mono', weight: 700, color: s.c('red'), align: 'left' }));
      });
      const letters = (top: number, row: number, a: number) =>
        s.alpha(a, () => HELLO_V.forEach((ch, k) => s.text(ch, gut - u * 1.5, top + row * (k + 0.5), { size: 3.2, font: 'mono', color: s.c('--ink-2'), align: 'right' })));
      s.alpha(s.ease('scores', 0.5), () => s.text('p', u * 3, pTop + pRow * 2, { size: 5, font: 'serif', italic: true, weight: 600, color: s.c('teal') }));
      letters(pTop, pRow, s.ease('scores', 0.5));
      s.alpha(s.ease('trap', 0.6, 2), () => s.text('h', u * 3, hTop + hRow * 1.5, { size: 5, font: 'serif', italic: true, weight: 600, color: s.c('green') }));
      s.alpha(s.ease('onehot', 0.5), () => s.text('x', u * 3, xTop + xRow * 2, { size: 5, font: 'serif', italic: true, weight: 600, color: s.c('orange') }));
      letters(xTop, xRow, s.ease('onehot', 0.5));
      gl('in', yIn, '--ink-3');
      for (let c = 0; c < 4; c++) {
        const x = cx(c);
        s.alpha(colA(c), () => {
          // input letter and one-hot
          s.text(HELLO_V[HELLO_IN[c]!]!, x, yIn, { size: 4.6, font: 'serif', italic: true, weight: 600, color: s.c('orange') });
          s.alpha(reveal('onehot', c), () => {
            for (let k = 0; k < 4; k++) {
              const one = HELLO_IN[c] === k;
              s.rrect(x - cw / 2, xTop + k * xRow + xRow * 0.08, cw, xRow * 0.84, 0.6, { fill: s.tint('orange', one ? 0.55 : 0.05), stroke: s.tint('orange', one ? 1 : 0.35), lw: 0.25 });
              if (one) s.text('1', x, xTop + (k + 0.5) * xRow + u * 0.15, { size: 3, font: 'mono', weight: 650 });
            }
          });
          // target letter and its loss
          s.alpha(reveal('targets', c), () => s.text(HELLO_V[HELLO_TG[c]!]!, x, yTgt, { size: 4.6, font: 'serif', italic: true, weight: 700, color: s.c('gold') }));
          const loss = val(R.losses[c]!, Tr.losses[c]!);
          s.alpha(reveal('loss', c), () => s.text(loss.toFixed(2), x, yLoss, { size: 3.3, font: 'mono', weight: 600, color: s.c('red') }));
          // hidden state: empty slots, then values
          const hv = reveal('step', c);
          for (let k = 0; k < 3; k++) {
            const y = hTop + k * hRow;
            const v = val(R.hs[c]![k]!, Tr.hs[c]![k]!);
            s.alpha(s.ease('trap', 0.6, 2) * (1 - hv), () => {
              s.ctx.setLineDash([u * 0.8, u * 0.6]);
              s.rrect(x - cw / 2, y + hRow * 0.08, cw, hRow * 0.84, 0.8, { stroke: s.tint('green', 0.6), lw: 0.25 });
              s.ctx.setLineDash([]);
            });
            s.alpha(hv, () => {
              const m = Math.min(1, Math.abs(v));
              s.rrect(x - cw / 2, y + hRow * 0.08, cw, hRow * 0.84, 0.8, { fill: v >= 0 ? s.tint('green', 0.08 + 0.5 * m) : s.tint('slate', 0.08 + 0.4 * m), stroke: s.tint('green', 0.7), lw: 0.25 });
              s.text(v.toFixed(2), x, y + hRow / 2 + u * 0.15, { size: 3.1, font: 'mono' });
            });
          }
          // arrows: x -> h, h -> p, h -> next h
          const hOn = s.since('step') >= 0 && s.since('scores') < 0 && Math.floor(s.prog('step') * 5) === c;
          s.alpha(s.ease('step', 0.4), () => {
            s.arrow(x, xTop - u * 0.6, x, hTop + hRow * 3 + u * 0.4, hOn ? s.c('--accent') : s.tint('orange', 0.6), hOn ? 0.5 : 0.3, 2);
            if (c > 0) s.arrow(cx(c - 1) + cw / 2 + u * 0.4, hTop + hRow * 1.5, x - cw / 2 - u * 0.4, hTop + hRow * 1.5, hOn ? s.c('--accent') : s.tint('green', 0.6), hOn ? 0.5 : 0.3, 2);
          });
          s.alpha(s.ease('scores', 0.4), () => s.arrow(x, hTop - u * 0.4, x, pTop + pRow * 4 + u * 0.6, s.tint('purple', 0.6), 0.3, 2));
          // scores (signed, centered), then probabilities (from the left)
          const sv = reveal('scores', c * 0.5);
          const toP = smooth((s.prog('scores') - 0.5) / 0.25);
          s.alpha(sv, () => {
            const ys = R.ys[c]!.map((v, k) => val(v, Tr.ys[c]![k]!));
            const ps = R.ps[c]!.map((v, k) => val(v, Tr.ps[c]![k]!));
            const ymax = Math.max(3, ...ys.map(Math.abs));
            for (let k = 0; k < 4; k++) {
              const y = pTop + k * pRow;
              s.rrect(x - cw / 2, y + pRow * 0.08, cw, pRow * 0.84, 0.6, { fill: s.tint('teal', 0.04), stroke: s.tint('--ink-3', 0.3), lw: 0.2 });
              const sc = (ys[k]! / ymax) * (cw / 2);
              const x0 = lerp(sc >= 0 ? x : x + sc, x - cw / 2, toP);
              const len = lerp(Math.abs(sc), ps[k]! * cw, toP);
              const isT = HELLO_TG[c] === k;
              const tOn = isT ? s.ease('loss', 0.5) : 0;
              s.rrect(x0, y + pRow * 0.18, Math.max(u * 0.3, len), pRow * 0.64, 0.4, { fill: toP > 0.5 ? s.tint('teal', 0.35 + 0.5 * ps[k]!) : s.tint('purple', 0.55) });
              if (tOn > 0) s.alpha(tOn, () => s.rrect(x - cw / 2, y + pRow * 0.04, cw, pRow * 0.92, 0.6, { stroke: s.c('gold'), lw: 0.55 }));
            }
            if (toP < 0.5) s.line(x, pTop, x, pTop + pRow * 4, s.tint('--ink-3', 0.5 * (1 - toP * 2)), 0.2);
          });
          // the l -> l and l -> o trap
          if (c >= 2 && trapOn > 0)
            s.alpha(trapOn, () => s.rrect(x - colW * 0.46, yTgt - u * 3.5, colW * 0.92, yIn - yTgt + u * 7, 2, { stroke: s.c('--accent'), lw: 0.45 }));
        });
      }
    });
    s.slot('loss', s.since('loss') >= 0 ? val(R.total, Tr.total).toFixed(2) : '…');
  },
};

// ---------------------------------------------------------------- sampling

const CTX = 'First Citizen:\n';
const P1 = softmaxT(SCORES[CTX]!, 1);
const TOP6 = P1.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 6);
const PICK = VOC.ix.get('W')!;
const THE_ORDER = softmaxT(SCORES['the ']!, 1).map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 7).map(([, i]) => i);

/** Temperature over the scene: 1, down to 0.5, up to 2, back to 1. */
function tempAt(s: Scene): number {
  if (s.since('same') >= 0) return lerp(2, 1, s.ease('same', 1, 0.2));
  if (s.since('high') >= 0) return lerp(0.5, 2, s.ease('high', 1.4, 0.3));
  if (s.since('low') >= 0) return lerp(1, 0.5, s.ease('low', 1.2, 0.3));
  return 1;
}

const sampling: SceneDef = {
  marks: {
    soft: { tex: String.raw`\symp_k = \frac{e^{\,\symy_k/\symT}}{\sum_j e^{\,\symy_j/\symT}}`, x: 0.3, y: 0.18, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const [ax, , aw] = area(s, 0.1, 5);
    const loopA = 1 - s.ease('repeat', 0.6);
    const pickAt = 0.55;
    const picked = s.since('draw') >= 0 && s.prog('draw') > pickAt;
    // The text so far: the context, then what the model writes.
    const textA = 1 - s.ease('why', 0.5);
    s.alpha(textA, () => {
      const size = 3.8;
      const cols = monoCols(s, aw, size);
      const fed = s.since('feed') >= 0 ? clamp01(s.prog('feed') * 3 - 0.6) : 0;
      let out = CTX;
      let n = CTX.length * s.ease('gen', 1.2);
      if (fed > 0.99) {
        out = CTX + PRETRAINED;
        n = CTX.length + 1;
      }
      if (s.since('repeat') >= 0) n = CTX.length + 1 + (PRETRAINED.length - 1) * clamp01(s.since('repeat') / Math.max(1, s.end('repeat') - s.at('repeat') + 1.5));
      const y0 = lerp(h * 0.1, h * 0.12, 1 - loopA);
      s.alpha(1, () => {
        monoBlock(s, out.slice(0, CTX.length), ax, y0, { size, cols, lines: 2, color: s.c('--ink-3') });
        // the written part continues on the context's last line
        const lines = Math.max(1, Math.round(lerp(2, 11, 1 - loopA)));
        if (n > CTX.length) monoBlock(s, ' '.repeat(0) + out.slice(CTX.length, Math.round(n)), ax, y0 + 1.45 * size * u, { size, cols, lines, cursor: s.since('repeat') >= 0 });
      });
    });
    // The sampling loop: x -> h -> probabilities -> pick -> back into x.
    if (loopA > 0) {
      s.alpha(loopA, () => {
        const cy = h * 0.6;
        const ns = Math.min(u * 11, h * 0.12);
        const xX = w * 0.11;
        const hX = w * 0.29;
        const fedX = s.since('feed') >= 0 && s.prog('feed') > 0.45;
        node(s, xX, cy, ns, '', 'orange', { on: s.win('gen', 'probs') });
        s.text(fedX ? 'W' : glyph('\n'), xX, cy, { size: 5.2, font: 'mono', weight: 650, color: s.c('orange') });
        s.text('x', xX, cy + ns / 2 + u * 3.2, { size: 3.6, font: 'serif', italic: true, color: s.c('orange') });
        s.arrow(xX + ns / 2 + u, cy, hX - ns / 2 - u, cy, s.c('orange'), 0.45);
        node(s, hX, cy, ns, 'h', 'green', { on: s.win('gen', 'probs') });
        const bx = w * 0.42;
        const bw = w * 0.95 - bx;
        const rowH = Math.min(h * 0.07, u * 8);
        const by = cy - rowH * 3;
        s.arrow(hX + ns / 2 + u, cy, bx - u, cy, s.c('green'), 0.45);
        const grow = s.ease('probs', 1.2, 0.3);
        // a quick roll through the bars before landing on the sampled one
        let lit = -1;
        if (s.since('draw') >= 0 && !picked) lit = [0, 3, 1, 5, 2, 4, 0, 1, 3, 2][Math.floor(s.since('draw') * 7) % 10]!;
        const pickRow = TOP6.findIndex(([, i]) => i === PICK);
        s.alpha(s.ease('probs', 0.5), () =>
          bars(
            s,
            bx,
            by,
            bw,
            rowH,
            TOP6.map(([p, i], r) => ({ label: glyph(VOC.chars[i]!), p: p * grow, on: r === lit || (picked && r === pickRow) ? 1 : 0 })),
            'teal',
            { size: 3.6, max: 0.5 },
          ),
        );
        s.alpha(grow, () => s.text('next character', bx + bw / 2, by - u * 4, { size: 3.3, font: 'mono', color: s.c('--ink-3') }));
        s.alpha(s.ease('draw', 0.4, (s.end('draw') - s.at('draw')) * pickAt), () => s.text('sampled: W, not the favorite B', bx + bw / 2, by + rowH * 6 + u * 4, { size: 3.3, italic: true, color: s.c('--ink-2') }));
        // feed it back in
        s.alpha(s.ease('feed', 0.6), () => {
          bend(s, bx + u * 6, by + rowH * (pickRow + 0.5), w * 0.24, h * 0.95, xX + ns * 0.1, cy + ns / 2 + u * 5.5, s.c('--accent'), 0.45, [1.2, 1]);
          s.text('feed it back', w * 0.27, h * 0.86, { size: 3.3, font: 'mono', color: s.c('--accent'), halo: true });
        });
      });
    }
    // Why not argmax.
    s.alpha(s.win('why', 'temp'), () => {
      const rowH = Math.min(h * 0.075, u * 8);
      const bx = w * 0.18;
      const by = h * 0.3;
      bars(s, bx, by, w * 0.64, rowH, TOP6.map(([p, i], r) => ({ label: glyph(VOC.chars[i]!), p, on: r === 0 ? 1 : 0 })), 'teal', { size: 3.6, max: 0.5 });
      s.text('always the top bar:', w / 2, h * 0.14, { size: 4, italic: true, color: s.c('--ink-2') });
      s.text('the same text, every time', w / 2, h * 0.21, { size: 4, italic: true, color: s.c('--ink-2') });
    });
    // Temperature.
    const tA = s.ease('temp', 0.6);
    if (tA > 0) {
      const T = tempAt(s);
      s.slot('T', T.toFixed(2));
      s.alpha(tA, () => {
        s.show('soft', tA);
        pill(s, `T = ${T.toFixed(2)}`, w * 0.78, h * 0.17, 'slate', { font: 'mono', size: 4.2 });
        const pT = softmaxT(SCORES['the ']!, T);
        const rowH = Math.min(h * 0.058, u * 6.4);
        const by = h * 0.31;
        s.text('after "the "', w * 0.12, by - u * 2.5, { size: 3.2, font: 'mono', color: s.c('--ink-3'), align: 'left' });
        bars(s, w * 0.12, by, w * 0.8, rowH, THE_ORDER.map((i) => ({ label: glyph(VOC.chars[i]!), p: pT[i]! })), 'teal', { size: 3.4, max: 0.55 });
        // the sample that goes with the current setting
        const regimes: [string, number][] = [
          ['temp', 1],
          ['low', 0],
          ['high', 2],
          ['same', 1],
        ];
        const size = 3.4;
        const [ax2, , aw2] = area(s, 0, 7);
        regimes.forEach(([id, k], i) => {
          const next = regimes[i + 1]?.[0];
          const a = s.ease(id, 0.6, id === 'temp' ? 0 : 1) * (next ? 1 - s.ease(next, 0.4, 1) : 1);
          if (a <= 0) return;
          s.alpha(a, () => {
            const [Tk, text] = TEMP_SAMPLES[k]!;
            s.text(`a sample at T = ${Tk}`, ax2, h * 0.75, { size: 3.1, font: 'mono', color: s.c('--ink-3'), align: 'left' });
            monoBlock(s, text, ax2, h * 0.78, { size, cols: monoCols(s, aw2, size), lines: 3, inline: true, head: true });
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- bptt

const BP_IN = ['h', 'e', 'l', 'l'];

const bptt: SceneDef = {
  marks: {
    bp: {
      tex: String.raw`\frac{\partial \symL}{\partial \symh_t} = \underbrace{\symWhy^{\!\top}\,\frac{\partial \symL}{\partial \symy_t}}_{\text{own output}} + \underbrace{\symWhh^{\!\top}\Big[\big(1-\symh_{t+1}^2\big)\odot\frac{\partial \symL}{\partial \symh_{t+1}}\Big]}_{\text{next step}}`,
      x: 0.5,
      y: 0.88,
      size: 3.8,
    },
  },
  draw(s) {
    const { w, h, u } = s;
    const chainA = 1 - s.ease('truncate', 0.6);
    if (chainA > 0) {
      s.alpha(chainA, () => {
        const xs = [0.2, 0.4, 0.6, 0.8].map((f) => w * f);
        const yL = h * 0.13;
        const yy = h * 0.3;
        const yh = h * 0.5;
        const yx = h * 0.7;
        const ns = Math.min(u * 10, h * 0.1);
        const fwd = s.since('fwd') >= 0 ? s.prog('fwd') * 4.4 : 0;
        const bwd = s.since('bwd') >= 0 ? s.prog('bwd') * 4.4 : 0;
        const focus = s.win('two', 'acc');
        const dimA = (c: number) => (c === 1 || c === 2 ? 1 : 1 - 0.65 * focus);
        const lowerA = 1 - focus;
        for (let c = 0; c < 4; c++) {
          const x = xs[c]!;
          const f = clamp01(fwd - c);
          const b = clamp01(bwd - (3 - c));
          s.alpha(dimA(c), () => {
            node(s, x, yx, ns, 'x', 'orange', { on: f > 0 && f < 1 ? 1 : 0 });
            s.alpha(lowerA, () => s.text(BP_IN[c]!, x, yx + ns / 2 + u * 3.4, { size: 3.6, font: 'serif', italic: true, color: s.c('orange') }));
            s.arrow(x, yx - ns / 2 - u * 0.5, x, yh + ns / 2 + u * 0.5, f > 0 ? s.c('green') : s.tint('--ink-3', 0.6), 0.4);
            node(s, x, yh, ns, 'h', 'green', { on: c === 1 ? focus : f > 0 && f < 1 ? 1 : 0 });
            s.arrow(x, yh - ns / 2 - u * 0.5, x, yy + ns / 2 + u * 0.5, f > 0 ? s.c('green') : s.tint('--ink-3', 0.6), 0.4);
            node(s, x, yy, ns, 'y', 'purple');
            s.line(x, yy - ns / 2 - u * 0.5, x, yL + u * 2.6, f > 0.6 ? s.c('red') : s.tint('--ink-3', 0.5), 0.3);
            s.circle(x, yL, u * 2.4, { fill: s.tint('red', f > 0.6 ? 0.25 : 0.06), stroke: s.tint('red', f > 0.6 ? 1 : 0.4), lw: 0.3 });
            s.text('L', x, yL + u * 0.2, { size: 3, font: 'serif', italic: true, color: s.c('red') });
            if (c < 3) s.arrow(x + ns / 2 + u * 0.5, yh - u * 1.2, xs[c + 1]! - ns / 2 - u * 0.5, yh - u * 1.2, fwd - c > 1 ? s.c('green') : s.tint('--ink-3', 0.6), 0.4);
            // backward: down from each loss, and right to left along the chain
            s.alpha(b, () => {
              s.arrow(x + u * 2.2, yL + u * 2.6, x + u * 2.2, yy - ns / 2 - u * 0.4, s.c('teal'), 0.4, 2);
              s.arrow(x + u * 2.2, yy + ns / 2 + u * 0.4, x + u * 2.2, yh - ns / 2 - u * 0.4, s.c('teal'), 0.4 + 0.4 * (c === 1 ? s.win('own', 'next') : 0), 2);
              if (c < 3) s.arrow(xs[c + 1]! - ns / 2 - u * 0.5, yh + u * 1.6, x + ns / 2 + u * 0.5, yh + u * 1.6, s.c('teal'), 0.4 + 0.4 * (c === 1 ? s.win('next', 'acc') : 0), 2);
            });
          });
        }
        s.alpha(s.ease('fwd', 0.6, 0.6) * (1 - focus), () => s.text('L = L₀ + L₁ + L₂ + L₃', w / 2, h * 0.045, { size: 3.4, font: 'mono', color: s.c('red') }));
        // the two paths into one hidden state
        s.alpha(focus, () => {
          const x = xs[1]!;
          s.circle(x, yh, ns * 0.95, { stroke: s.c('--accent'), lw: 0.45 });
          s.alpha(s.win('own', 'acc'), () => s.text('own output', x - u * 2.5, (yy + yh) / 2, { size: 3.2, font: 'mono', color: s.c('teal'), align: 'right', halo: true }));
          s.alpha(s.win('next', 'acc'), () => s.text('next step', (x + xs[2]!) / 2, yh + ns / 2 + u * 3.6, { size: 3.2, font: 'mono', color: s.c('teal'), halo: true }));
          s.show('bp', focus * s.ease('two', 0.6, 1.5));
        });
        // shared weights collect gradients from every step
        const acc = s.win('acc', 'truncate');
        s.alpha(acc, () => {
          for (let c = 0; c < 3; c++) {
            const mx = (xs[c]! + xs[c + 1]!) / 2;
            s.alpha(1 - s.ease('remember', 0.4), () => pill(s, `dWhh${'₁₂₃'[c]}`, mx, yh + u * 6.5, 'teal', { size: 3, font: 'mono', on: s.ease('acc', 0.4, 0.5 + 0.4 * c) * (1 - s.ease('acc', 0.4, 0.9 + 0.4 * c)) }));
          }
          s.alpha(1 - s.ease('remember', 0.4), () => pill(s, 'dWhh = dWhh₁ + dWhh₂ + dWhh₃', w / 2, h * 0.9, 'teal', { font: 'mono', size: 3.2 }));
          // every step back: times Whh.T
          s.alpha(s.ease('remember', 0.6), () => {
            const k = Math.floor(Math.max(0, s.since('remember')) * 2.5) % 3;
            for (let c = 0; c < 3; c++) {
              const mx = (xs[c]! + xs[c + 1]!) / 2;
              pill(s, '× Whh.T', mx, yh + u * 6.5, 'blue', { size: 3, font: 'mono', on: 2 - c === k ? 1 : 0 });
            }
            s.text('the same matrix, every step back', w / 2, h * 0.88, { size: 3.6, italic: true, color: s.c('--ink-2') });
          });
        });
      });
    }
    // Truncated: chunks of text, memory carried, gradient stopped.
    const tA = s.ease('truncate', 0.6);
    if (tA > 0) {
      s.alpha(tA, () => {
        const L = 8;
        const rows = 3;
        const txt = CORPUS.slice(0, L * rows);
        const [ax, , aw] = area(s, 0, 6);
        const colW = aw / L;
        const rowY = [0.22, 0.5, 0.78].map((f) => h * f);
        const r = Math.min(colW * 0.22, u * 2.6);
        const p = s.since('carry') >= 0 ? 1 : s.prog('truncate');
        const k = Math.min(rows - 1, Math.floor(p * 3));
        const ph = p * 3 - k;
        for (let row = 0; row < rows; row++) {
          const cy = rowY[row]!;
          const hy = cy - h * 0.085;
          const active = row === k && s.since('carry') < 0;
          const seen = row <= k || s.since('carry') >= 0;
          if (active) s.rrect(ax - u, hy - r - u * 2, aw + 2 * u, cy - hy + r + u * 6.5, 2, { fill: s.tint('--accent', 0.06), stroke: s.tint('--accent', 0.5), lw: 0.3 });
          for (let c = 0; c < L; c++) {
            const x = ax + colW * (c + 0.5);
            s.cell(x - colW * 0.38, cy - u * 3, colW * 0.76, u * 6, glyph(txt[row * L + c]!), 'orange', { on: active ? 0.4 : 0, size: 3.4 });
            s.circle(x, hy, r, { fill: s.tint('green', seen ? 0.35 : 0.06), stroke: s.tint('green', seen ? 0.9 : 0.35), lw: 0.25 });
            s.line(x, cy - u * 3.4, x, hy + r + u * 0.4, s.tint('orange', 0.5), 0.25);
            if (c < L - 1) {
              const nx = x + colW;
              s.arrow(x + r + u * 0.4, hy - u * 0.6, nx - r - u * 0.4, hy - u * 0.6, active && ph < 0.5 ? s.c('green') : s.tint('green', seen ? 0.6 : 0.25), 0.3, 1.6);
              if (active && ph >= 0.5) s.arrow(nx - r - u * 0.4, hy + u * 1, x + r + u * 0.4, hy + u * 1, s.c('teal'), 0.35, 1.6);
            }
          }
          // memory crosses into the next chunk
          if (row < rows - 1) {
            const on = s.since('carry') >= 0 ? 1 : 0;
            const xa = ax + colW * (L - 0.5);
            const xb = ax + colW * 0.5;
            const yb = rowY[row + 1]! - h * 0.085;
            const yg = (cy + u * 3.5 + yb - r) / 2 + u * 1.5;
            s.ctx.setLineDash([u, u * 0.8]);
            s.ctx.beginPath();
            s.ctx.moveTo(xa + r, hy);
            s.ctx.arcTo(ax + aw + u * 0.6, hy, ax + aw + u * 0.6, yg, u * 2);
            s.ctx.arcTo(ax + aw + u * 0.6, yg, ax - u * 0.6, yg, u * 2);
            s.ctx.arcTo(ax - u * 0.6, yg, ax - u * 0.6, yb, u * 2);
            s.ctx.arcTo(ax - u * 0.6, yb, xb, yb, u * 2);
            s.ctx.lineTo(xb - r - u * 0.6, yb);
            s.ctx.strokeStyle = on ? s.c('green') : s.tint('green', 0.4);
            s.ctx.lineWidth = u * (on ? 0.4 : 0.25);
            s.ctx.stroke();
            s.ctx.setLineDash([]);
            // the gradient stops at the chunk's start
            s.alpha(s.ease('carry', 0.5, 2.5), () => {
              const bx = xb - r - u * 2.2;
              const by = yb;
              s.line(bx - u * 1.2, by - u * 1.2, bx + u * 1.2, by + u * 1.2, s.c('red'), 0.5);
              s.line(bx + u * 1.2, by - u * 1.2, bx - u * 1.2, by + u * 1.2, s.c('red'), 0.5);
            });
          }
        }
        s.alpha(s.ease('carry', 0.5, 0.6) * (1 - s.ease('price', 0.4)), () => s.text('memory carries on; the gradient stops', w / 2, h * 0.955, { size: 3.4, italic: true, color: s.c('--ink-2') }));
        s.alpha(s.ease('price', 0.5, 0.3), () => s.text('no learning signal across chunks', w / 2, h * 0.955, { size: 3.4, italic: true, color: s.c('red') }));
        s.alpha(s.ease('price', 0.6), () => {
          const x0 = ax + colW * 2.5;
          const x1 = ax + colW * 5.5;
          const y0 = rowY[0]! + u * 3.5;
          const y1 = rowY[2]! - h * 0.085 - r;
          bend(s, x1, y1, (x0 + x1) / 2 + aw * 0.25, (y0 + y1) / 2, x0, y0 + u * 0.5, s.c('red'), 0.45, [1, 0.8]);
        });
      });
    }
  },
};

// ---------------------------------------------------------------- min-char-rnn

const MS_BEATS = ['i0', 'i100', 'i1000', 'i3000'] as const;
const MS_N = [0, 100, 1000, 3000];

const minchar: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const aA = 1 - s.ease('run', 0.6);
    if (aA > 0) {
      s.alpha(aA, () => {
        // the file
        const fx = w * 0.06;
        const fy = h * 0.14;
        const fw = w * 0.36;
        const fh = h * 0.72;
        s.rrect(fx, fy, fw, fh, 2, { fill: s.tint('--ink-3', 0.05), stroke: s.c('--rule'), lw: 0.3 });
        s.text('min-char-rnn.py', fx + fw / 2, fy + u * 4.5, { size: 3.4, font: 'mono', weight: 650 });
        const lines = 22;
        for (let i = 0; i < lines; i++) {
          const y = fy + u * 10 + (i * (fh - u * 16)) / lines;
          const ind = [0, 1, 1, 0, 0, 1, 2, 2, 1, 0, 1, 1, 2, 2, 2, 1, 0, 1, 2, 2, 1, 0][i]! * u * 2.5;
          const len = (0.35 + 0.5 * Math.abs(Math.sin(i * 2.7))) * (fw - u * 8 - ind);
          s.line(fx + u * 4 + ind, y, fx + u * 4 + ind + len, y, s.tint('--ink-3', 0.35), 0.5);
        }
        s.text('112 lines, NumPy only', fx + fw / 2, fy + fh + u * 4, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        const rx = w * 0.5;
        const rw = w * 0.45;
        // the parameters
        s.alpha(s.win('parts', 'loop'), () => {
          const mats: [string, number, number, string][] = [
            ['Wxh', 64, 52, '64 × 52'],
            ['Whh', 64, 64, '64 × 64'],
            ['Why', 52, 64, '52 × 64'],
          ];
          const k = Math.min(rw * 0.4, h * 0.18) / 64;
          mats.forEach(([name, r, c, dims], i) => {
            const y = h * (0.2 + 0.25 * i);
            const mw = c * k;
            const mh = r * k;
            s.rrect(rx, y, mw, mh, 0.6, { fill: s.tint('blue', 0.14), stroke: s.c('blue'), lw: 0.3 });
            s.text(name, rx + mw + u * 3, y + mh * 0.38, { size: 3.6, font: 'mono', weight: 650, color: s.c('blue'), align: 'left' });
            s.text(dims, rx + mw + u * 3, y + mh * 0.38 + u * 4.5, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'left' });
          });
          s.text('52 characters, 64 hidden units', rx + rw / 2, h * 0.93, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
        });
        // the loop
        s.alpha(s.ease('loop', 0.6), () => {
          const steps: [string, string][] = [
            ['next 25 chars', 'loop'],
            ['loss: forward, backward', 'loop'],
            ['clip to ±5', 'clip'],
            ['Adagrad update', 'clip'],
          ];
          const bh = h * 0.12;
          const gap = h * 0.06;
          const y0 = h * 0.14;
          steps.forEach(([t, id], i) => {
            const y = y0 + i * (bh + gap);
            const on = id === 'loop' ? s.win('loop', 'clip') : s.ease('clip', 0.5, i === 3 ? 1.5 : 0);
            s.rrect(rx, y, rw, bh, 1.6, { fill: s.tint('slate', 0.06 + 0.12 * on), stroke: on > 0.05 ? s.c('--accent') : s.tint('slate', 0.5), lw: 0.3 + 0.25 * on });
            s.text(t, rx + rw / 2, y + bh / 2, { size: Math.min(3.4, (rw / u) * 0.075), font: 'mono', weight: 600 });
            if (i < 3) s.arrow(rx + rw / 2, y + bh + u * 0.5, rx + rw / 2, y + bh + gap - u * 0.5, s.c('--ink-3'), 0.35, 1.8);
          });
          const yb = y0 + 3 * (bh + gap) + bh / 2;
          bend(s, rx + rw + u * 0.6, yb, rx + rw + u * 6, (y0 + yb) / 2, rx + rw + u * 0.6, y0 + bh / 2, s.tint('--ink-3', 0.8), 0.35, [1, 0.8], 1.8);
        });
      });
    }
    // Training, live: the loss curve and the samples along the way.
    const bA = s.ease('run', 0.6);
    if (bA > 0) {
      s.alpha(bA, () => {
        const fr = new Frame(s, [w * 0.13, h * 0.08, w * 0.8, h * 0.3], [0, 3000, 40, 105]);
        fr.axes(1, 1000, 20);
        for (const v of [60, 100]) s.text(String(v), fr.X(0) - u, fr.Y(v), { size: 2.9, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        for (const v of [1000, 2000, 3000]) s.text(v.toLocaleString(), fr.X(v), fr.Y(40) + u * 3, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
        s.line(fr.X(0), fr.Y(98.8), fr.X(3000), fr.Y(98.8), s.tint('--ink-3', 0.6), 0.25, [1, 1]);
        s.text('guessing', fr.X(3000), fr.Y(98.8) - u * 2.5, { size: 2.9, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        // reveal the curve up to the current milestone
        let upto = 0;
        let mi = -1;
        MS_BEATS.forEach((id, i) => {
          if (s.since(id) >= 0) {
            mi = i;
            upto = lerp(i ? MS_N[i - 1]! : 0, MS_N[i]!, s.ease(id, 1.6, 0.2));
          }
        });
        if (s.since('long') >= 0) upto = 3000;
        const n = Math.max(1, Math.round(upto / 50) + 1);
        fr.path(CURVE.slice(0, n).map((_, i) => i * 50), CURVE.slice(0, n), s.c('red'), 0.6);
        if (upto > 0) s.circle(fr.X(upto), fr.Y(CURVE[Math.min(CURVE.length - 1, Math.round(upto / 50))]!), u * 1, { fill: s.c('red') });
        s.text('smooth_loss', fr.X(3000) - u, fr.Y(70), { size: 3, font: 'mono', color: s.c('red'), align: 'right' });
        s.slot('n', Math.round(upto));
        // the sample box
        const [bx, , bw] = area(s, 0, 5);
        const by = h * 0.5;
        s.rrect(bx, by, bw, h * 0.46, 1.6, { fill: s.tint('--ink-3', 0.04), stroke: s.c('--rule'), lw: 0.3 });
        const size = 3.3;
        const cols = monoCols(s, bw - u * 6, size);
        const show = (label: string, text: string, a: number, typed: number) =>
          s.alpha(a, () => {
            s.text(label, bx + u * 3, by + u * 4, { size: 3, font: 'mono', color: s.c('--accent'), align: 'left' });
            monoBlock(s, text, bx + u * 3, by + u * 8, { size, cols, lines: 7, n: text.length * typed });
          });
        if (mi < 0 && s.since('long') < 0) s.text('samples appear as it trains', bx + bw / 2, by + h * 0.23, { size: 3.4, italic: true, color: s.c('--ink-3') });
        MS_BEATS.forEach((id, i) => {
          const next = MS_BEATS[i + 1] ?? 'long';
          const a = s.ease(id, 0.4) * (1 - s.ease(next, 0.4));
          if (a <= 0) return;
          const m = MILESTONES.find((q) => q.n === MS_N[i])!;
          show(`iteration ${m.n.toLocaleString()} · loss ${m.loss}`, m.text, a, s.ease(id, 2.2, 0.3));
        });
        show('iteration 30,000 (a longer run)', PRETRAINED, s.ease('long', 0.4), s.ease('long', 2.6, 0.3));
      });
    }
  },
};

export const scenesB: Record<string, SceneDef> = { hello, sampling, bptt, minchar };
