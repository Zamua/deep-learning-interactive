import { type Ink, lerp, type Scene, type SceneDef } from '../../../lecture/scene';
import { cite, verdict } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { note } from '../draw';

/** The model's weights: a 4 by 8 grid of shades centered on (cx, cy), `c` px per cell; `wob` stirs them. */
function weights(s: Scene, cx: number, cy: number, c: number, wob = 0, phase = 0) {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) {
    const v = Math.sin(i * 3.1 + j * 1.7) * 0.5 + 0.5;
    const d = wob * 0.35 * Math.sin(phase * 9 + i * 2.3 + j * 0.9);
    const f = Math.min(0.85, Math.max(0.08, 0.15 + 0.6 * v + d));
    s.rrect(cx - 4 * c + j * c + 0.3 * s.u, cy - 2 * c + i * c + 0.3 * s.u, c - 0.6 * s.u, c - 0.6 * s.u, 0.5, { fill: s.tint('blue', f) });
  }
}

/** A line of the prompt in a soft box, left-aligned at x. */
function line(s: Scene, x: number, y: number, text: string, k: Ink, w: number): void {
  s.rrect(x, y - 3.6 * s.u, w, 7.2 * s.u, 1.2, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.55), lw: 0.3 });
  s.text(text, x + 2.4 * s.u, y + 0.2 * s.u, { size: 3.3, font: 'mono', weight: 600, align: 'left', color: s.c(k) });
}

const PAIRS = ['dog → chien', 'cat → chat', 'cow → vache', 'bread → pain'];

const teach: SceneDef = {
  draw(s) {
    const u = s.u;
    const tall = s.tall;
    const mx = tall ? s.w / 2 : s.w * 0.22;
    const my = tall ? s.h * 0.16 : s.h * 0.42;
    const c = 3.6 * u;
    const lw = 44 * u;
    const px = tall ? s.w / 2 - lw / 2 - 9 * u : s.w * 0.44;
    const y0 = tall ? s.h * 0.44 : s.h * 0.27;
    const pitch = (tall ? 9 : 10) * u;
    const tuneOn = s.win('tune', 'continue');

    // The pretrained model, stirred while fine-tuning shows what a gradient step would do.
    s.alpha(s.ease('pre', 0.7), () => {
      weights(s, mx, my, c, tuneOn, s.prog('tune'));
      s.text('pretrained model', mx, my - 2 * c - 4 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c('blue') });
    });
    s.alpha(s.ease('pre', 0.6, 2.5) * (1 - s.ease('job', 0.5)), () => note(s, 'trained on lots of text', mx, my + 2 * c + 5 * u, '--ink-2', 3));

    // The job, and fine-tuning's answer to it: solved pairs fed in, one gradient step each.
    const jx = tall ? s.w / 2 : px + lw / 2;
    const jy = tall ? s.h * 0.5 : s.h * 0.42;
    s.alpha(s.win('job', 'continue'), () => rich(s, [['English → French', 'orange'], [' ?', '--ink-3']], jx, jy, { size: 3.6, weight: 650 }));
    s.alpha(tuneOn, () => {
      const p = s.prog('tune');
      PAIRS.forEach((t, i) => {
        const f = (p * 1.25 - i * 0.22) / 0.35;
        if (f <= 0 || f >= 1) return;
        // From beside the grid into it, clear of the job's label.
        const x = lerp(tall ? s.w - 16 * u : px - 2 * u, mx, f);
        const y = lerp(tall ? my + 1 * u : jy, my, f);
        s.alpha(Math.min(1, (1 - f) * 3), () => s.text(t, x, y, { size: 3, font: 'mono', weight: 600, color: s.c('blue'), halo: true }));
      });
      note(s, 'fine-tuning: the weights change', mx, my + 2 * c + 5 * u, 'red', 3);
      note(s, 'gradient steps on 1000s of examples', tall ? s.w / 2 : jx, tall ? s.h * 0.62 : s.h * 0.56, '--ink-2', 3);
    });

    // The prompt: an instruction and an input, then two solved examples between them.
    const few = s.ease('few', 0.9, 0.3);
    s.alpha(s.ease('continue', 0.6, 1.5) * (1 - s.ease('prompt', 0.4)), () => {
      s.rrect(px, y0 - 3.6 * u, lw, 7.2 * u, 1.2, { stroke: s.tint('--ink-3', 0.6), lw: 0.3 });
      s.text('▍', px + 2.6 * u, y0 + 0.2 * u, { size: 3.3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      note(s, 'the prompt: the text it is given', px + lw / 2, y0 + 8 * u, '--ink-2', 3);
    });
    const shown = s.ease('prompt', 0.6, 0.3);
    s.alpha(shown, () => line(s, px, y0, 'English to French:', 'slate', lw));
    s.alpha(few, () => {
      line(s, px, y0 + pitch, 'dog => chien', 'blue', lw);
      line(s, px, y0 + 2 * pitch, 'cow => vache', 'blue', lw);
    });
    const yIn = lerp(y0 + pitch, y0 + 3 * pitch, few);
    s.alpha(s.ease('prompt', 0.6, 2.4), () => line(s, px, yIn, 'cheese =>', 'orange', lw));
    s.alpha(s.ease('answer', 0.6, 0.4), () => {
      const ax = px + 2.4 * u + s.measure('cheese => ', { size: 3.3, font: 'mono', weight: 600 });
      s.text('fromage', ax, yIn + 0.2 * u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
    });
    const tag = (txt: string, y: number, k: Ink, a: number) => s.alpha(a, () => s.text(txt, px + lw + 2.4 * u, y, { size: 2.8, font: 'mono', align: 'left', color: s.c(k) }));
    tag('instruction', y0, 'slate', s.ease('prompt', 0.6, 1));
    tag('examples', y0 + 1.5 * pitch, 'blue', few);
    tag('input', yIn, 'orange', s.ease('prompt', 0.6, 3));
    s.alpha(s.ease('answer', 0.6, 3), () => {
      note(s, 'no gradient step: weights unchanged', mx, my + 2 * c + 5 * u, 'green', 3);
      note(s, 'the task, picked up from the prompt', tall ? s.w / 2 : px + lw / 2 + 8 * u, tall ? s.h * 0.86 : s.h * 0.8, 'gold', 3.2);
    });
  },
};

// ---- the context: a box of fixed size, with the prompt's tokens at its start

/** Instruction, two examples, input: token counts and colors. */
const SEG: [number, Ink][] = [
  [5, 'slate'],
  [6, 'blue'],
  [6, 'blue'],
  [3, 'orange'],
];

/** The context box: where it sits and how big one token cell is. */
function ctx(s: Scene, y: number) {
  const W = Math.min((s.tall ? 90 : 124) * s.u, s.w - 12 * s.u);
  const c = (s.tall ? 3.1 : 4) * s.u;
  const x0 = s.w / 2 - W / 2;
  const h = c + 4 * s.u;
  return { x0, x1: x0 + W, y, h, c, t0: x0 + 2 * s.u };
}
type Ctx = ReturnType<typeof ctx>;

function frame(s: Scene, B: Ctx, label: string, hot = 0) {
  s.rrect(B.x0, B.y - B.h / 2, B.x1 - B.x0, B.h, 1.4, { fill: s.tint('--ink-3', 0.04), stroke: s.tint('--ink-2', 0.45 + 0.5 * hot), lw: 0.35 + 0.3 * hot });
  s.text(label, B.x0, B.y - B.h / 2 - 3.2 * s.u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-2') });
}

/** The prompt's tokens as cells from the box's left edge; returns their centers. `keep(g)` fades segment g. */
function tokens(s: Scene, B: Ctx, keep: (g: number) => number = () => 1, segs = SEG): number[] {
  const xs: number[] = [];
  let i = 0;
  segs.forEach(([m, k], g) => {
    for (let j = 0; j < m; j++, i++) {
      const x = B.t0 + i * B.c;
      xs.push(x + B.c / 2);
      s.alpha(keep(g), () => s.rrect(x + 0.25 * s.u, B.y - B.c / 2, B.c - 0.5 * s.u, B.c, 0.6, { fill: s.tint(k, 0.45), stroke: s.tint(k, 0.8), lw: 0.25 }));
    }
  });
  return xs;
}

/** Labels under each part of the prompt. */
function partLabels(s: Scene, B: Ctx, xs: number[], a: number) {
  s.alpha(a, () => {
    const y = B.y + B.h / 2 + 3.4 * s.u;
    const lab = { size: 2.7, font: 'mono', weight: 600 } as const;
    s.text('instruction', (xs[0]! + xs[4]!) / 2, y, { ...lab, color: s.c('slate') });
    s.text('examples', (xs[5]! + xs[16]!) / 2, y, { ...lab, color: s.c('blue') });
    s.text('input', (xs[17]! + xs[19]!) / 2, y, { ...lab, color: s.c('orange') });
  });
}

/** Attention from the last position back over every earlier token. */
function arcs(s: Scene, B: Ctx, xs: number[], a: number) {
  s.alpha(a, () => {
    const last = xs[xs.length - 1]!;
    const g = s.ctx;
    for (let j = 0; j < xs.length - 1; j++) {
      const x0 = xs[j]!;
      const top = B.y - B.h / 2 - (3 + 0.75 * (xs.length - 1 - j)) * s.u;
      g.beginPath();
      g.moveTo(last, B.y - B.c / 2);
      g.quadraticCurveTo((last + x0) / 2, top, x0, B.y - B.c / 2);
      g.strokeStyle = s.tint(j >= 5 && j < 17 ? 'gold' : '--ink-3', j >= 5 && j < 17 ? 0.75 : 0.35);
      g.lineWidth = 0.28 * s.u;
      g.stroke();
    }
  });
}

/** One labelled mini prompt: `k` examples between the instruction and the input. */
function miniPrompt(s: Scene, x: number, y: number, k: number, label: string, hot: boolean) {
  const c = 2.3 * s.u;
  const segs: [number, Ink][] = [[5, 'slate'], ...Array.from({ length: k }, (): [number, Ink] => [6, 'blue']), [3, 'orange']];
  s.text(label, x - 3 * s.u, y, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c(hot ? 'blue' : '--ink-2') });
  let i = 0;
  segs.forEach(([m, kk]) => {
    for (let j = 0; j < m; j++, i++) s.rrect(x + i * c + 0.15 * s.u, y - c / 2, c - 0.3 * s.u, c, 0.4, { fill: s.tint(kk, 0.45) });
  });
}

const context: SceneDef = {
  draw(s) {
    const B = ctx(s, s.h * (s.tall ? 0.36 : 0.38));
    s.alpha(s.ease('context', 0.6), () => frame(s, B, 'context', s.win('limit', 'attend')));
    const xs = tokens(s, B, (g) => s.ease('context', 0.5, 0.4 + 0.5 * g));
    partLabels(s, B, xs, s.ease('context', 0.6, 2.4) * (1 - s.ease('shots', 0.5)));
    s.alpha(s.win('context', 'limit'), () => note(s, 'everything the model reads at once', s.w / 2, s.h * 0.62, '--ink-2', 3.2));
    // The room left in the box, and its fixed end.
    s.alpha(s.win('limit', 'attend'), () => {
      const xr = xs[xs.length - 1]! + B.c;
      s.rrect(xr, B.y - B.c / 2, B.x1 - 2 * s.u - xr, B.c, 0.6, { stroke: s.tint('--ink-3', 0.6), lw: 0.25 });
      s.text('room for more', (xr + B.x1) / 2, B.y + 0.2 * s.u, { size: 2.7, font: 'mono', color: s.c('--ink-3') });
      s.text('fixed limit', B.x1, B.y - B.h / 2 - 3.2 * s.u, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('red') });
      note(s, 'only so many tokens fit', s.w / 2, s.h * 0.62, '--ink-2', 3.2);
    });
    arcs(s, B, xs, s.ease('attend', 0.8, 1.5) * (1 - s.ease('shots', 0.5)));
    s.alpha(s.win('attend', 'name'), () => note(s, 'the last position reads every token before it', s.w / 2, s.h * 0.62, 'gold', 3.1));
    s.alpha(s.win('name', 'brown'), () => {
      note(s, 'in-context learning:', s.w / 2, s.h * 0.6, 'blue', 3.4);
      note(s, 'learned in the context, not in the weights', s.w / 2, s.h * 0.67, '--ink-2', 3.1);
    });
    s.alpha(s.win('brown', 'shots'), () => {
      note(s, 'GPT-3: 175 billion parameters', s.w / 2, s.h * 0.6, '--ink-2', 3.2);
      note(s, 'a few examples, no gradient step', s.w / 2, s.h * 0.67, '--ink-2', 3.1);
    });
    cite(s, 'Brown et al., 2020 · GPT-3', s.ease('brown', 0.6) * (1 - s.ease('shots', 0.6, 3)));
    // Shots: the same prompt with no examples, one, and two.
    const mx = B.x0 + (s.tall ? 22 : 34) * s.u;
    const rows: [number, string][] = [[0, 'zero-shot'], [1, 'one-shot'], [2, 'few-shot']];
    rows.forEach(([k, lab], i) =>
      s.alpha(s.ease('shots', 0.5, 2.2 + 1.3 * i), () => miniPrompt(s, mx, s.h * (0.62 + 0.11 * i), k, lab, k === 2)),
    );
  },
};

// ---- nothing is kept: the weights before and after are equal, and a new prompt starts clean

const frozen: SceneDef = {
  draw(s) {
    const u = s.u;
    const c = 3 * u;
    const gy = s.h * 0.18;
    const dx = 17 * u;
    const copy = s.ease('pass', 0.8, 2.2);
    // The model's weights, and a copy of them slid to the left.
    weights(s, s.w / 2 + dx * copy, gy, c);
    s.text(copy > 0.5 ? 'after' : 'weights', s.w / 2 + dx * copy, gy - 2 * c - 3.6 * u, { size: 3, font: 'mono', weight: 650, color: s.c('blue') });
    s.alpha(copy, () => {
      weights(s, s.w / 2 - dx * copy, gy, c);
      s.text('before', s.w / 2 - dx * copy, gy - 2 * c - 3.6 * u, { size: 3, font: 'mono', weight: 650, color: s.c('--ink-2') });
    });
    const B = ctx(s, s.h * 0.56);
    frame(s, B, 'context');
    const gone = s.ease('gone', 0.8, 2.5);
    // A new prompt: the old tokens fade and only an input remains.
    const xs = tokens(s, B, () => 1 - gone);
    s.alpha(gone, () => tokens(s, B, () => 1, [[3, 'orange']]));
    // The forward pass: the context goes up through the weights and out comes the answer.
    const fwd = s.win('pass', 'same') * s.ease('pass', 0.6, 4.5);
    s.alpha(fwd, () => {
      s.arrow(s.w / 2 + dx, B.y - B.h / 2 - 1.5 * u, s.w / 2 + dx, gy + 2 * c + 2 * u, s.c('--ink-3'), 0.35, 1.8);
      s.text('forward pass', s.w / 2 + dx + 2 * u, (B.y - B.h / 2 + gy + 2 * c) / 2, { size: 2.9, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2'), halo: true });
      s.text('no loss, no gradient', s.w / 2 + dx + 2 * u, (B.y - B.h / 2 + gy + 2 * c) / 2 + 4.2 * u, { size: 2.7, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true });
    });
    s.alpha(s.ease('pass', 0.6, 6) * (1 - gone), () => {
      const x = xs[xs.length - 1]! + B.c * 1.2;
      s.text('fromage', x, B.y + 0.2 * u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
    });
    s.alpha(s.ease('same', 0.6), () => {
      s.text('=', s.w / 2, gy, { size: 5, font: 'mono', weight: 700, color: s.c('green') });
      note(s, 'every weight exactly as it was', s.w / 2, gy + 2 * c + 5 * u, 'green', 3.1);
    });
    s.alpha(s.win('same', 'gone'), () => note(s, 'the examples changed only the context', s.w / 2, s.h * 0.74, '--ink-2', 3.1));
    s.alpha(s.ease('gone', 0.6, 3), () => note(s, 'a new prompt: no trace of the examples', s.w / 2, s.h * 0.74, '--ink-2', 3.1));
  },
};

// ---- room: the prompt's tokens counted, then examples filling a context of 1,024

const LIMIT = 1024;
const PER = 6;
const FIT = Math.floor((LIMIT - 5 - 3) / PER);

const room: SceneDef = {
  draw(s) {
    const u = s.u;
    const B = ctx(s, s.h * (s.tall ? 0.34 : 0.36));
    const zoom = s.ease('limit', 1, 0.4);
    frame(s, B, zoom > 0.5 ? 'context: 1,024 tokens' : 'context', s.win('limit', 'left'));
    // The prompt at token scale, with each part's count above it.
    const xs = tokens(s, B, () => 1 - zoom);
    const cnt = { size: 3.1, font: 'mono', weight: 650 } as const;
    const top = B.y - B.h / 2 - 3.2 * u;
    s.alpha((1 - zoom) * s.ease('parts', 0.5, 1.5), () => {
      s.text('5', (xs[0]! + xs[4]!) / 2, B.y + B.h / 2 + 3.4 * u, { ...cnt, color: s.c('slate') });
      s.text('3', (xs[17]! + xs[19]!) / 2, B.y + B.h / 2 + 3.4 * u, { ...cnt, color: s.c('orange') });
    });
    s.alpha((1 - zoom) * s.ease('each', 0.5, 0.6), () => {
      s.text('6', (xs[5]! + xs[10]!) / 2, B.y + B.h / 2 + 3.4 * u, { ...cnt, color: s.c('blue') });
      s.text('6', (xs[11]! + xs[16]!) / 2, B.y + B.h / 2 + 3.4 * u, { ...cnt, color: s.c('blue') });
    });
    const eq = { size: s.tall ? 3.6 : 3.8, weight: 650 } as const;
    const ey = s.h * 0.56;
    s.alpha(s.win('each', 'total'), () => rich(s, [['2 × 6', 'blue'], [' = 12', '--ink-2']], s.w / 2, ey, eq));
    s.alpha(s.win('total', 'limit'), () => rich(s, [['5', 'slate'], [' + ', '--ink-3'], ['12', 'blue'], [' + ', '--ink-3'], ['3', 'orange'], [' = 20 tokens', '--ink-2']], s.w / 2, ey, eq));

    // Zoomed out: the whole 1,024-token box. The instruction and input are drawn a little wider than
    // to scale so they stay visible; the examples share what is left.
    const inner = B.x1 - B.x0 - 4 * u;
    const wI = Math.max((5 / LIMIT) * inner, 1.6 * u);
    const wQ = Math.max((3 / LIMIT) * inner, 1.2 * u);
    const free = inner - wI - wQ;
    const twoEx = 1 - s.ease('left', 0.6, 0.3);
    const grow = s.ease('fit', 5, 0.6);
    const n = twoEx > 0.01 ? 2 : Math.floor(FIT * grow + 1e-6);
    const wE = ((n * PER) / (LIMIT - 8)) * free;
    const bh = B.c;
    s.alpha(zoom, () => {
      const g0 = B.t0;
      s.rrect(g0, B.y - bh / 2, wI, bh, 0.4, { fill: s.tint('slate', 0.6) });
      if (n > 0) {
        s.rrect(g0 + wI, B.y - bh / 2, wE, bh, 0.4, { fill: s.tint('blue', 0.45) });
        const step = (PER / (LIMIT - 8)) * free;
        if (step > 0.35 * u) for (let i = 1; i < n; i++) s.line(g0 + wI + i * step, B.y - bh / 2, g0 + wI + i * step, B.y + bh / 2, s.tint('--card', 0.7), 0.12);
      }
      s.rrect(g0 + wI + wE, B.y - bh / 2, wQ, bh, 0.4, { fill: s.tint('orange', 0.7) });
    });
    s.alpha(zoom * (1 - s.ease('left', 0.5)), () => note(s, 'the 20 tokens: a sliver of the box', s.w / 2, B.y + B.h / 2 + 4 * u, '--ink-2', 3));
    s.alpha(s.win('limit', 'left') * s.ease('limit', 0.6, 2.5), () => note(s, 'GPT-3: 2,048 tokens', s.w / 2, ey, '--ink-2', 3.2));
    // What is left for examples.
    s.alpha(s.win('left', 'fit'), () => {
      const a = B.t0 + wI + wQ;
      const b = B.x1 - 2 * u;
      const y = B.y + B.h / 2 + 2 * u;
      s.line(a, y, b, y, s.c('blue'), 0.3);
      s.line(a, y - 1 * u, a, y + 1 * u, s.c('blue'), 0.3);
      s.line(b, y - 1 * u, b, y + 1 * u, s.c('blue'), 0.3);
      s.text('free for examples', (a + b) / 2, y + 3.4 * u, { size: 2.9, font: 'mono', weight: 600, color: s.c('blue') });
      rich(s, [['1,024', '--ink-2'], [' − ', '--ink-3'], ['8', 'slate'], [' = ', '--ink-3'], ['1,016', 'blue']], s.w / 2, ey, eq);
    });
    // Fill it, one six-token example at a time.
    s.alpha(s.ease('fit', 0.6, 0.6), () => {
      s.text(`${n} examples`, B.t0 + wI + wE / 2, B.y + B.h / 2 + 3.4 * u, { size: 2.9, font: 'mono', weight: 650, color: s.c('blue'), halo: true });
      rich(s, [['1,016', 'blue'], [' / ', '--ink-3'], ['6', 'blue'], [' ≈ 169.3', '--ink-2']], s.w / 2, ey, eq);
    });
    const vx = s.w / 2 - (s.tall ? 34 : 30) * u;
    s.alpha(s.ease('down', 0.6, 0.8), () => verdict(s, true, `${FIT} × 6 = 1,014: fits`, vx, s.h * 0.67, 3.4));
    s.alpha(s.ease('down', 0.6, 5), () => {
      verdict(s, false, `${FIT + 1} × 6 = 1,020 > 1,016`, vx, s.h * 0.77, 3.4);
      const xr = B.x1 - 2 * u;
      s.rrect(xr - 1.4 * u, B.y - bh / 2 - 1.2 * u, 4.6 * u, bh + 2.4 * u, 0.6, { stroke: s.c('red'), lw: 0.35 });
      s.text(`${FIT + 1}th`, xr + 0.9 * u, top, { size: 2.8, font: 'mono', weight: 650, color: s.c('red') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { teach, context, frozen, room };
