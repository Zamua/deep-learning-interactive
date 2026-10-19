import { type Scene, type SceneDef } from '../../lecture/scene';
import { mean, std } from '../../lib/transformer-model';
import { type K, BLOCK, WORDS, area, box, pill, rowLabels, signedFill } from './kit';
import { stack } from './scenes-a';

/* ------------------------------------------------------------------ the block */

const NODES: [string, K][] = [
  ['input x', 'orange'],
  ['multi-head attention', 'purple'],
  ['+ add', '--ink-3'],
  ['layer norm', 'teal'],
  ['feed-forward, 4d wide', 'blue'],
  ['+ add', '--ink-3'],
  ['layer norm', 'teal'],
];

/** When each diagram node appears. */
const NODE_BEAT = ['two', 'two', 'residual', 'ln', 'mlp', 'residual', 'ln'];

const block: SceneDef = {
  marks: {
    post: { tex: String.raw`x \leftarrow \operatorname{LN}(x + f(x))`, x: 0.5, y: 0.42, size: 4.8 },
    pre: { tex: String.raw`x \leftarrow x + f(\operatorname{LN}(x))`, x: 0.5, y: 0.66, size: 4.8 },
  },
  draw(s) {
    const { w, h, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.13);
    const tall = s.tall;
    const stackA = s.ease('stack', 0.7);
    const preA = s.ease('prenorm', 0.6);
    const mainA = 1 - stackA;
    // Which stage of the block's numbers to show.
    let stage = 0;
    if (s.since('two') >= 0) stage = 1;
    if (s.since('mlp') >= 0) stage = 4;
    if (s.since('residual') >= 0) stage = 2;
    if (s.since('ln') >= 0) stage = 3;
    if (s.since('batch') >= 0) stage = 3;
    if (s.since('shape') >= 0) stage = 7;
    const litNode = (i: number) => {
      if (s.since('shape') >= 0) return i === 0 || i === 6 ? 1 : 0;
      if (s.since('ln') >= 0) return i === 3 || i === 6 ? 1 : 0;
      if (s.since('residual') >= 0) return i === 2 || i === 5 ? 1 : 0;
      if (s.since('mlp') >= 0) return i === 4 ? 1 : 0;
      return i === 1 ? 1 : 0;
    };
    s.alpha(mainA, () => {
      // Diagram, input at the bottom as in the paper.
      const dr: [number, number, number, number] = tall ? [ax, ay, aw * 0.45, ah] : [ax, ay, aw * 0.44, ah];
      const [dx, dy, dw, dh] = dr;
      const nh = Math.min(u * 7, dh / 11);
      const gapN = (dh - 7 * nh - u * 4) / 6;
      const nw = dw - u * 9;
      const nx = dx + u * 8;
      const ny = (i: number) => dy + dh - u * 2 - (i + 1) * nh - i * gapN;
      const cx = nx + nw / 2;
      const base = s.ease('two', 0.5);
      NODES.forEach(([label, k], i) => {
        const a = base * (0.28 + 0.72 * s.ease(NODE_BEAT[i]!, 0.5, i === 1 ? 0.6 : 0));
        s.alpha(a, () => {
          if (i > 0) s.arrow(cx, ny(i - 1) - u * 0.2, cx, ny(i) + nh + u * 0.3, s.tint('--ink-3', 0.8), 0.3, 1.5);
          const small = label === '+ add';
          const bw = small ? Math.min(nw, u * 18) : nw;
          box(s, cx - bw / 2, ny(i), bw, nh, label, k, { on: litNode(i), size: Math.min(3.1, (nw / u) * 0.1) });
        });
      });
      // Residual paths.
      const resA = s.ease('residual', 0.6);
      const resOn = s.since('residual') >= 0 && s.since('ln') < 0 ? 1 : s.win('resnet', 'ln');
      s.alpha(resA, () => {
        for (const [a, b] of [[0, 2], [3, 5]] as const) {
          const xr = nx - u * 4;
          const y0 = ny(a) + nh * 0.3;
          const y1 = ny(b) + nh / 2;
          const col = resOn > 0.5 ? s.c('orange') : s.tint('--ink-3', 0.7);
          s.line(nx, y0, xr, y0, col, resOn > 0.5 ? 0.55 : 0.3);
          s.line(xr, y0, xr, y1, col, resOn > 0.5 ? 0.55 : 0.3);
          s.arrow(xr, y1, cx - Math.min(nw, u * 18) / 2 - u * 0.3, y1, col, resOn > 0.5 ? 0.55 : 0.3, 1.5);
        }
      });
      // The numbers at the current stage.
      const M = BLOCK[stage]!.M;
      const cols = M[0]!.length;
      const hx = tall ? ax + aw * 0.47 : ax + aw * 0.5;
      const hw = tall ? aw * 0.53 : aw * 0.5;
      const lab = u * 7;
      const statW = s.since('ln') >= 0 ? u * 15 : 0;
      const cw = Math.min(u * 6, (hw - lab - statW) / cols);
      const ch = Math.min(u * 6, cw * (cols > 8 ? 2.6 : 1));
      const gx = hx + lab;
      const gy = ay + (ah - 6 * ch) / 2;
      const range = Math.max(1, ...M.flat().map(Math.abs));
      const gA = s.ease('two', 0.6);
      s.alpha(gA * (1 - s.ease('batch', 0.5)) + s.ease('shape', 0.5) * 0, () => {
        rowLabels(s, WORDS, gx - u * 1.2, gy, ch, { size: 2.8 });
        M.forEach((row, i) =>
          row.forEach((v, j) => {
            s.ctx.fillStyle = signedFill(s, v, range);
            s.ctx.fillRect(gx + j * cw + 0.5, gy + i * ch + 0.5, cw - 1, ch - 1);
          }),
        );
        const titles = ['x', 'attention output', 'x + attention', 'layer norm', 'MLP hidden: 4x wide', 'MLP output', 'x + MLP', 'block output'];
        s.text(titles[stage]!, gx + (cols * cw) / 2, gy - u * 3.5, { font: 'ui', size: 3.2, weight: 650, color: s.c('--ink') });
        s.text(`(6, ${cols})`, gx + (cols * cw) / 2, gy + 6 * ch + u * 3, { font: 'mono', size: 2.9, color: s.c('--ink-3') });
        if (statW > 0) {
          const lit = s.since('lnrows') >= 0;
          const c1 = gx + cols * cw + u * 3.6;
          const c2 = c1 + u * 7;
          const col = lit ? s.c('teal') : s.c('--ink-3');
          s.text('μ', c1, gy - u * 1.6, { font: 'serif', italic: true, size: 3, color: col });
          s.text('σ', c2, gy - u * 1.6, { font: 'serif', italic: true, size: 3, color: col });
          M.forEach((row, i) => {
            const y = gy + i * ch + ch / 2 + u * 0.2;
            const o = { font: 'mono' as const, size: 2.9, weight: lit ? 650 : 400, color: col };
            s.text((Math.abs(mean(row)) < 0.05 ? 0 : mean(row)).toFixed(1), c1, y, o);
            s.text(std(row).toFixed(1), c2, y, o);
          });
        }
      });
      // Batch norm versus layer norm: which numbers get averaged.
      const bnA = s.win('batch', 'shape');
      s.alpha(bnA, () => {
        const g = Math.min(u * 4.5, (hw - u * 6) / 13);
        const yy = ay + ah * 0.28;
        const pairs: [string, boolean][] = [['batch norm', true], ['layer norm', false]];
        pairs.forEach(([nm, vert], k) => {
          const x0 = hx + k * (6 * g + u * 5);
          s.text(nm, x0 + 3 * g, yy - u * 4, { font: 'ui', size: 3, weight: 650, color: s.c(vert ? 'slate' : 'teal') });
          for (let i = 0; i < 6; i++)
            for (let j = 0; j < 6; j++) {
              const on = vert ? j === 2 : i === 2;
              s.rrect(x0 + j * g + 0.5, yy + i * g + 0.5, g - 1, g - 1, 0.4, { fill: on ? s.tint(vert ? 'slate' : 'teal', 0.6) : s.tint('--ink-3', 0.1) });
            }
          s.text(vert ? 'down a column' : 'along a row', x0 + 3 * g, yy + 6 * g + u * 3.5, { font: 'ui', size: 2.8, color: s.c('--ink-2') });
          s.text(vert ? '(across examples)' : '(across features)', x0 + 3 * g, yy + 6 * g + u * 7.5, { font: 'ui', size: 2.8, color: s.c('--ink-3') });
        });
      });
      s.alpha(s.ease('shape', 0.5), () => {
        pill(s, '(T, d) in', cx, ny(0) + nh + u * 3.4, 'orange', { size: 2.9 });
        pill(s, '(T, d) out', cx, ny(6) - u * 3.2, 'orange', { size: 2.9 });
      });
    });
    // Stacking blocks, then the pre-norm footnote.
    s.alpha(stackA * (1 - preA), () => {
      const n = s.prog('stack') > 0.45 ? 96 : 6;
      const show = Math.min(n, 12);
      const bw = Math.min(aw * 0.5, u * 60);
      const bx = w / 2 - bw / 2;
      const bh = Math.min(u * 4, (ah - u * 10) / show - u * 0.8);
      for (let i = 0; i < show; i++) {
        const y = ay + ah - u * 4 - (i + 1) * (bh + u * 0.8);
        s.rrect(bx, y, bw, bh, 0.8, { fill: s.tint('blue', 0.18), stroke: s.tint('blue', 0.6), lw: 0.25 });
      }
      s.text(n === 6 ? '× 6: the 2017 paper' : '× 96: GPT-3 (12 drawn)', w / 2, ay + u * 3, { font: 'ui', size: 3.8, weight: 650, color: s.c('blue') });
    });
    s.alpha(preA, () => {
      s.text('post-norm (2017)', w / 2, h * 0.32, { font: 'ui', size: 3.4, weight: 650, color: s.c('--ink-2') });
      s.text('pre-norm (GPT-2 and after)', w / 2, h * 0.56, { font: 'ui', size: 3.4, weight: 650, color: s.c('teal') });
    });
    s.show('post', preA, { y: 0.41 });
    s.show('pre', preA, { y: 0.65 });
  },
};

/* ------------------------------------------------------------------ families */

const SRC = WORDS;
const TGT = ['<s>', 'le', 'chat', "s'est", 'assis'];

/** A 0/1 mask grid with query labels on the left. */
function maskGrid(s: Scene, x: number, y: number, cs: number, rows: readonly string[], cols: number, allow: (i: number, j: number) => boolean, title: string, k: K, on: number): void {
  s.text(title, x + (cols * cs) / 2, y - u3(s), { font: 'ui', size: 3, weight: 650, color: s.c(k) });
  rowLabels(s, rows, x - s.u, y, cs, { size: Math.min(2.7, (cs / s.u) * 0.5) });
  for (let i = 0; i < rows.length; i++)
    for (let j = 0; j < cols; j++) {
      const ok = allow(i, j);
      s.rrect(x + j * cs + 0.5, y + i * cs + 0.5, cs - 1, cs - 1, 0.5, { fill: ok ? s.tint('purple', 0.25 + 0.3 * on) : s.tint('--ink-3', 0.07) });
    }
  if (on > 0) s.alpha(on, () => s.rrect(x - s.u * 0.5, y - s.u * 0.5, cols * cs + s.u, rows.length * cs + s.u, 1, { stroke: s.c(k), lw: 0.45 }));
}
const u3 = (s: Scene) => s.u * 3;

const families: SceneDef = {
  draw(s) {
    const { u } = s;
    const [ax, ay, aw, ah] = area(s, 0.13);
    const tall = s.tall;
    // Two stacks for translation.
    const lab = u * 8;
    const cs = Math.min(tall ? u * 4.8 : u * 6, (aw * (tall ? 0.46 : 0.42) - lab) / 6, (ah - u * 37) / 10);
    const encA = s.ease('enc', 0.5);
    const decA = s.ease('dec', 0.5);
    const crossA = s.ease('cross', 0.5);
    const bert = s.win('bert', 'gpt');
    const gpt = s.win('gpt', 'today');
    const today = s.ease('today', 0.5);
    // Blocks: encoder left, decoder right.
    const bw = aw * 0.42;
    const ex = ax + aw * 0.04;
    const dxx = ax + aw * 0.54;
    const by = ay + u * 3;
    const bh = u * 9;
    s.alpha(s.ease('orig', 0.6), () => {
      box(s, ex, by, bw, bh, 'encoder', 'teal', { on: Math.max(encA * (1 - decA), bert), size: 3.6 });
      box(s, dxx, by, bw, bh, 'decoder', 'purple', { on: Math.max(decA * (1 - crossA), gpt, today), size: 3.6 });
      s.alpha(1 - Math.max(bert, gpt, today), () => {
        s.text('reads the source', ex + bw / 2, by + bh + u * 4, { font: 'ui', size: 3, color: s.c('--ink-2') });
        s.text('writes the output', dxx + bw / 2, by + bh + u * 4, { font: 'ui', size: 3, color: s.c('--ink-2') });
      });
      s.alpha(crossA, () => {
        s.arrow(ex + bw + u * 0.5, by + bh / 2, dxx - u * 0.5, by + bh / 2, s.c('green'), 0.5, 2);
        s.text('K, V', (ex + bw + dxx) / 2, by + bh / 2 - u * 2.6, { font: 'mono', size: 2.8, weight: 600, color: s.c('green') });
      });
      s.alpha(bert, () => s.text('BERT (2018): encoder only', ex + bw / 2, by + bh + u * 4, { font: 'ui', size: 3.2, weight: 650, color: s.c('teal') }));
      s.alpha(gpt, () => s.text('GPT (2018): decoder only', dxx + bw / 2, by + bh + u * 4, { font: 'ui', size: 3.2, weight: 650, color: s.c('purple') }));
    });
    // Mask grids.
    const gy = by + bh + u * 13;
    const encX = ex + lab;
    s.alpha(encA * (1 - 0.6 * gpt), () => maskGrid(s, encX, gy, cs, SRC, 6, () => true, 'self: all see all', 'teal', bert));
    const decX = tall ? dxx + lab * 0.6 : dxx + lab;
    s.alpha(decA * (1 - 0.6 * bert), () => maskGrid(s, decX, gy, cs, TGT, 5, (i, j) => j <= i, 'masked self', 'purple', gpt));
    s.alpha(crossA * (1 - 0.6 * Math.max(bert, gpt)), () => {
      const cy = gy + 5 * cs + u * 9;
      maskGrid(s, decX, cy, cs, TGT, 6, () => true, 'cross: Q target, K V source', 'green', 0);
    });
    s.alpha(today, () => s.text("today's LLMs: decoder only", dxx + bw / 2, by + bh + u * 4, { font: 'ui', size: 3.2, weight: 650, color: s.c('purple') }));
  },
};

/* ------------------------------------------------------------------ twelve d squared */

const params: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.13);
    const tall = s.tall;
    // Matrices drawn to scale with d as one unit.
    const unit = Math.min((aw - u * 16) / 9.5, (ah * (tall ? 0.42 : 0.55)) / 4.6);
    const attnOn = s.since('attn') >= 0 ? (s.since('mlp') < 0 || s.since('twelve') >= 0 ? 1 : 0.35) : 0;
    const mlpOn = s.since('mlp') >= 0 ? 1 : 0;
    const showA = s.ease('count', 0.6);
    const topY = ay + u * 7;
    const x0 = ax + (aw - (4 * unit + 3 * u * 2 + u * 5 + 4 * unit + u * 3 + unit)) / 2;
    const fade = 1 - s.ease('gpt2', 0.6);
    s.alpha(showA * fade, () => {
      ['Q', 'K', 'V', 'O'].forEach((nm, i) => {
        const x = x0 + i * (unit + u * 2);
        s.rrect(x, topY, unit, unit, 0.8, { fill: s.tint('purple', 0.1 + 0.35 * attnOn), stroke: s.tint('purple', 0.4 + 0.5 * attnOn), lw: 0.3 });
        s.text(`W${nm}`, x + unit / 2, topY + unit / 2 + u * 0.3, { font: 'mono', size: 3.2, weight: 600, color: s.c('--ink') });
      });
      const mx = x0 + 4 * unit + 3 * u * 2 + u * 5;
      s.rrect(mx, topY, 4 * unit, unit, 0.8, { fill: s.tint('blue', 0.1 + 0.35 * mlpOn), stroke: s.tint('blue', 0.4 + 0.5 * mlpOn), lw: 0.3 });
      s.text('W1: d × 4d', mx + 2 * unit, topY + unit / 2 + u * 0.3, { font: 'mono', size: 3.2, weight: 600, color: s.c('--ink') });
      const m2x = mx + 4 * unit + u * 3;
      s.rrect(m2x, topY, unit, 4 * unit, 0.8, { fill: s.tint('blue', 0.1 + 0.35 * mlpOn), stroke: s.tint('blue', 0.4 + 0.5 * mlpOn), lw: 0.3 });
      s.text('W2', m2x + unit / 2, topY + 2 * unit, { font: 'mono', size: 3.2, weight: 600, color: s.c('--ink') });
      s.alpha(s.ease('attn', 0.5), () => s.text('4 d²', x0 + 2 * unit + u * 3, topY + unit + u * 5, { font: 'mono', size: 4.6, weight: 650, color: s.c('purple') }));
      s.alpha(s.ease('mlp', 0.5), () => s.text('8 d²', mx + 2 * unit, topY + unit + u * 5, { font: 'mono', size: 4.6, weight: 650, color: s.c('blue') }));
      // One block as a bar: a third attention, two thirds MLP.
      s.alpha(s.ease('twelve', 0.5), () => {
        const by = topY + 4 * unit + u * 8;
        const bw = aw * 0.8;
        const bx = w / 2 - bw / 2;
        s.rrect(bx, by, bw / 3 - u * 0.5, u * 7, 1, { fill: s.tint('purple', 0.35) });
        s.rrect(bx + bw / 3, by, (2 * bw) / 3, u * 7, 1, { fill: s.tint('blue', 0.35) });
        s.text('attention ⅓', bx + bw / 6, by + u * 3.7, { font: 'ui', size: 3, weight: 600 });
        s.text('MLP ⅔', bx + bw * (2 / 3), by + u * 3.7, { font: 'ui', size: 3, weight: 600 });
        s.text('12 d² per block', w / 2, by + u * 13, { font: 'mono', size: 4.8, weight: 650, color: s.c('--ink') });
      });
    });
    // The arithmetic for two real models.
    const gA = s.ease('gpt2', 0.6) * (1 - s.ease('square', 0.6));
    s.alpha(gA, () => {
      const lines: [string, K, string][] = [
        ['GPT-2 small', '--ink', 'gpt2'],
        ['12 × 12 × 768² ≈ 85M', 'blue', 'gpt2'],
        ['+ 50,257 × 768 ≈ 39M', 'orange', 'gpt2'],
        ['= 124M', 'purple', 'gpt2'],
        ['GPT-3', '--ink', 'gpt3'],
        ['12 × 96 × 12,288² ≈ 174B', 'blue', 'gpt3'],
      ];
      lines.forEach(([t, k, b], i) => {
        const y = ay + ah * (0.08 + 0.135 * i);
        s.alpha(s.ease(b, 0.4, b === 'gpt2' ? 0.9 * i : 0.9 * (i - 4)), () => s.text(t, w / 2, y, { font: i === 0 || i === 4 ? 'ui' : 'mono', size: i === 0 || i === 4 ? 4.2 : 3.9, weight: 650, color: s.c(k) }));
      });
    });
    // Width doubles: four times the parameters. Depth doubles: twice.
    const qA = s.ease('square', 0.6) * (1 - s.ease('compute', 0.6));
    s.alpha(qA, () => {
      const sz = Math.min(aw * 0.18, ah * 0.28);
      const y = ay + ah * 0.3;
      const xs = [w * 0.28, w * 0.72];
      // Width: a d x d square becomes 2d x 2d.
      s.rrect(xs[0]! - sz / 2, y, sz / 2, sz / 2, 0.5, { fill: s.tint('blue', 0.45) });
      for (let k = 0; k < 4; k++) s.rrect(xs[0]! - sz / 2 + (k % 2) * (sz / 2), y + sz * 0.62 + Math.floor(k / 2) * (sz / 2), sz / 2 - 1, sz / 2 - 1, 0.5, { fill: s.tint('blue', 0.3), stroke: s.tint('blue', 0.6), lw: 0.2 });
      s.text('2 × width: 4 × params', xs[0]!, y + sz * 1.75, { font: 'ui', size: 3.2, weight: 650, color: s.c('blue') });
      // Depth: one block becomes two.
      s.rrect(xs[1]! - sz / 2, y, sz, sz * 0.22, 0.5, { fill: s.tint('teal', 0.45) });
      for (let k = 0; k < 2; k++) s.rrect(xs[1]! - sz / 2, y + sz * 0.62 + k * sz * 0.28, sz, sz * 0.22, 0.5, { fill: s.tint('teal', 0.3), stroke: s.tint('teal', 0.6), lw: 0.2 });
      s.text('2 × depth: 2 × params', xs[1]!, y + sz * 1.75, { font: 'ui', size: 3.2, weight: 650, color: s.c('teal') });
    });
    // The T x T scores: no parameters, quadratic cost.
    const cA = s.ease('compute', 0.6);
    s.alpha(cA, () => {
      const T = 8;
      const side = Math.min(ah * 0.45, aw * 0.5);
      const g = side / T;
      const gx = w / 2 - side / 2;
      const gy = ay + ah * 0.12;
      for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) s.rrect(gx + j * g + 0.5, gy + i * g + 0.5, g - 1, g - 1, 0.3, { fill: s.tint('purple', 0.35) });
      s.text('T × T scores: 0 parameters', w / 2, gy + side + u * 6, { font: 'ui', size: 3.6, weight: 650, color: s.c('purple') });
      s.text('cost grows with T²', w / 2, gy + side + u * 12, { font: 'mono', size: 3.4, color: s.c('--ink-2') });
    });
  },
};

/* ------------------------------------------------------------------ recap */

const recap: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.13);
    const nextA = s.ease('next', 0.6);
    const tall = s.tall;
    const lit = (part: 'embed' | 'block' | 'out') => {
      if (s.since('next') >= 0) return 0;
      if (part === 'embed') return s.win('embed', 'attn');
      if (part === 'block') return s.win('attn', 'out');
      return s.ease('out', 0.4);
    };
    const sw = tall ? Math.min(aw * 0.8, u * 72) : Math.min(aw * 0.55, u * 72);
    const sx = tall ? w / 2 - sw / 2 : ax + aw * 0.04;
    const top = tall ? u * 16 : 0;
    s.alpha(1 - 0.75 * nextA, () =>
      stack(s, [sx, ay + top, sw, ah * 0.98 - top], {
        blocks: 3,
        appear: () => s.ease('whole', 0.5),
        lit,
        inner: s.ease('attn', 0.6),
        mask: 1,
      }),
    );
    // Short reminders beside the stack, one per beat.
    const notes: [string, string, K][] = [
      ['attn', 'many heads, masked', 'purple'],
      ['scale', '÷ √dₖ', 'slate'],
      ['mlp', 'residual + layer norm', 'orange'],
    ];
    notes.forEach(([b, t, k], i) => {
      const a = s.ease(b, 0.5) * (1 - nextA);
      // Tall: two rows above the stack. Wide: a column to its right.
      const x = tall ? (i < 2 ? w / 2 + (i ? 1 : -1) * aw * 0.22 : w / 2) : sx + sw + u * 5;
      const y = tall ? ay + u * 2 + (i < 2 ? 0 : u * 7.5) : ay + ah * (0.2 + 0.14 * i);
      s.alpha(a, () => pill(s, t, x, y, k, { size: 3.2, font: 'ui', align: tall ? 'center' : 'left' }));
    });
    s.alpha(nextA, () => {
      const bw = Math.min(aw * 0.9, u * 90);
      const bh = u * 30;
      const bx = w / 2 - bw / 2;
      const by = h / 2 - bh / 2;
      s.rrect(bx, by, bw, bh, 2.5, { fill: s.tint('--card', 0.96), stroke: s.tint('orange', 0.7), lw: 0.4 });
      s.text('one block, stacked', w / 2, by + u * 8, { font: 'display', size: 5.4, weight: 600 });
      s.text('attend, then think, token by token,', w / 2, by + u * 16, { font: 'ui', size: 3.4, color: s.c('--ink-2') });
      s.text('block after block: that is the model', w / 2, by + u * 21.5, { font: 'ui', size: 3.4, color: s.c('--ink-2') });
    });
    s.alpha(s.ease('bye', 0.6), () => s.text('next: tokens and embeddings', w / 2, h - u * 6, { font: 'serif', size: 4.2, italic: true, color: s.c('--ink-2') }));
  },
};

export const scenesC: Record<string, SceneDef> = { block, families, params, recap };
