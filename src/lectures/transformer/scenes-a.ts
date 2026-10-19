import { clamp01, lerp, type Scene, type SceneDef } from '../../lecture/scene';
import { type K, KT, TR, WORDS, area, box, fitSize, chip, colLabels, dotsAt, grid, heat, matName, pill, rowLabels, short, softmax, spread } from './kit';

/* ------------------------------------------------------------------ intro */

const PLAN: [string, K][] = [
  ['queries, keys, values', 'teal'],
  ['÷ √dₖ', 'slate'],
  ['many heads', 'purple'],
  ['causal mask', 'red'],
  ['positions', 'red'],
  ['residual + norm', 'orange'],
  ['12 d²', 'blue'],
];

/** The whole model as a stack: tokens, embedding, blocks, unembedding. `lit` picks a part to highlight. */
export function stack(s: Scene, r: [number, number, number, number], o: { blocks: number; appear: (i: number) => number; lit?: (part: 'embed' | 'block' | 'out') => number; inner?: number; mask?: number }): void {
  const [x, y, w, h] = r;
  const { u } = s;
  const n = o.blocks;
  const rowH = h / (n + 3.2);
  const bh = rowH * 0.74;
  const xs = spread(6, x, x + w);
  const tokY = y + h - rowH * 0.45;
  const lit = o.lit ?? (() => 0);
  s.alpha(o.appear(-1), () => WORDS.forEach((wd, i) => chip(s, wd, xs[i]!, tokY, 'orange', { size: Math.min(3.4, (w / 6 / u) * 0.3), maxW: w / 6 - u })));
  const ey = y + h - rowH * 1.55;
  s.alpha(o.appear(-1), () => box(s, x, ey, w, bh, 'embed + positions', 'orange', { on: lit('embed') }));
  for (let i = 0; i < n; i++) {
    const by = ey - (i + 1) * rowH;
    s.alpha(o.appear(i), () => {
      const on = lit('block');
      if ((o.inner ?? 0) > 0.01) {
        const half = (w - u * 2) / 2;
        s.alpha(1, () => {
          box(s, x, by, half, bh, '', 'purple', { on });
          box(s, x + half + u * 2, by, half, bh, '', 'blue', { on });
          s.alpha(o.inner ?? 0, () => {
            s.text(o.mask ? 'masked attention' : 'attention', x + half / 2, by + bh / 2 + u * 0.2, { font: 'ui', size: Math.min(3.2, (half / u) * 0.11), weight: 600 });
            s.text('MLP', x + half + u * 2 + half / 2, by + bh / 2 + u * 0.2, { font: 'ui', size: 3.2, weight: 600 });
          });
          s.alpha(1 - (o.inner ?? 0), () => s.text(`block ${i + 1}`, x + w / 2, by + bh / 2 + u * 0.2, { font: 'ui', size: 3.2, weight: 600, color: s.c('--ink-2') }));
        });
      } else box(s, x, by, w, bh, `block ${i + 1}`, 'blue', { on });
    });
  }
  const oy = ey - (n + 1) * rowH;
  s.alpha(o.appear(n), () => box(s, x, oy, w, bh, 'scores for the next word', 'purple', { on: lit('out') }));
  for (let i = 0; i <= n; i++) {
    const a = o.appear(i);
    const yb = ey - i * rowH;
    s.alpha(a, () => s.arrow(x + w / 2, yb - u * 0.2, x + w / 2, yb - (rowH - bh) + u * 0.3, s.tint('--ink-3', 0.8), 0.3, 1.6));
  }
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tA = s.win('hello', 'block');
    s.alpha(tA, () => {
      s.text('The Transformer', w / 2, h * 0.44, { size: 11, font: 'display', weight: 600 });
      s.alpha(s.ease('paper', 0.8), () => {
        s.text('Attention Is All You Need', w / 2, h * 0.58, { size: 5, italic: true, color: s.c('--ink-2') });
        s.text('Vaswani et al., 2017', w / 2, h * 0.67, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
      });
    });
    const kA = s.win('block', 'plan');
    if (kA > 0) {
      const [ax, ay, aw, ah] = area(s, 0.14);
      const sw = Math.min(aw * 0.6, u * 70);
      const sx = ax + (aw * 0.62 - sw) / 2;
      const recipe = s.prog('recipe');
      const recOn = s.since('recipe') >= 0 && s.since('inside') < 0;
      const lit = (part: 'embed' | 'block' | 'out') =>
        recOn ? (part === 'embed' ? +(recipe < 0.4) : part === 'block' ? +(recipe >= 0.4 && recipe < 0.7) : +(recipe >= 0.7)) : 0;
      s.alpha(kA, () =>
        stack(s, [sx, ay, sw, ah], {
          blocks: 4,
          appear: (i) => (i < 0 ? s.ease('block', 0.5) : s.ease('block', 0.5, 0.5 + 0.35 * i)),
          lit,
          inner: s.ease('inside', 0.6),
        }),
      );
      // Models built from the block.
      const names: [string, string, K][] = [
        ['BERT', '2018', 'teal'],
        ['GPT', '2018', 'purple'],
        ['ViT', '2020', 'green'],
        ['chat models', 'today', 'orange'],
      ];
      const px = ax + aw * 0.62 + u * 3;
      const pw = ax + aw - px;
      names.forEach(([nm, yr, k], i) => {
        const a = kA * s.ease('everywhere', 0.5, 0.45 * i);
        const py = ay + ah * (0.22 + 0.17 * i);
        s.alpha(a, () => {
          s.text(nm, px + pw / 2, py, { font: 'display', size: Math.min(5, (pw / u) * 0.2), weight: 600, color: s.c(k) });
          s.text(yr, px + pw / 2, py + u * 4.6, { font: 'mono', size: 3, color: s.c('--ink-3') });
        });
      });
    }
    const pA = s.ease('plan', 0.6);
    if (pA > 0) {
      const [ax, ay, aw, ah] = area(s, 0.16);
      const cols = s.tall ? 2 : 4;
      const rows = Math.ceil(PLAN.length / cols);
      const gap = u * 2.5;
      const tw = (aw - gap * (cols - 1)) / cols;
      const th = Math.min(u * 13, (ah * 0.62 - gap * (rows - 1)) / rows);
      const oy = ay + (s.tall ? 0 : ah * 0.08);
      const scan = s.prog('plan');
      const whyA = s.ease('why', 0.6);
      PLAN.forEach(([label, k], i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = ax + col * (tw + gap);
        const y = oy + row * (th + gap);
        const on = s.since('why') < 0 && Math.floor(scan * PLAN.length * 0.999) === i ? 1 : 0;
        s.alpha(pA * s.ease('plan', 0.5, 0.15 * i) * (1 - 0.6 * whyA), () => box(s, x, y, tw, th, label, k, { on, size: 3.8 }));
      });
      s.alpha(whyA, () => s.text('why no recurrence?', w / 2, ay + ah * 0.86, { font: 'display', size: 6.5, weight: 600, color: s.c('--ink') }));
    }
  },
};

/* ------------------------------------------------------------------ why */

const why: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    const xs = spread(6, ax, ax + aw);
    const tokY = ay + ah * 0.62;
    const hY = ay + ah * 0.3;
    const cs = Math.min(3.6, (aw / 6 / u) * 0.3);
    const rnnA = 1 - s.ease('attn', 0.7);
    const t = s.span('rnn', 'far');
    const cur = Math.min(5, Math.floor(t * 6.2));
    // The RNN chain.
    s.alpha(rnnA, () => {
      xs.forEach((x, i) => {
        const done = s.since('far') >= 0 || i <= cur;
        s.arrow(x, tokY - u * 3.5, x, hY + u * 4.6, s.tint('--ink-3', done ? 0.8 : 0.3), 0.3, 1.5);
        if (i < 5) s.arrow(x + u * 4.6, hY, xs[i + 1]! - u * 4.6, hY, s.tint('--ink-3', done && i < cur ? 0.8 : 0.3), 0.3, 1.5);
        const isCur = s.since('far') < 0 && i === cur;
        s.circle(x, hY, u * 4, { fill: s.tint('blue', isCur ? 0.45 : done ? 0.18 : 0.06), stroke: s.tint('blue', isCur ? 1 : 0.5), lw: isCur ? 0.6 : 0.3 });
        s.text(`h${i + 1}`, x, hY + u * 0.3, { font: 'mono', size: 3.2, color: s.c('--ink') });
      });
      s.alpha(s.win('rnn', 'far') * (s.since('rnn') > 0.3 ? 1 : 0), () =>
        s.text(`step ${cur + 1} of 6: one at a time`, w / 2, ay + ah * 0.08, { font: 'ui', size: 3.6, weight: 600, color: s.c('blue') }),
      );
      // The long path from the first word to the last.
      const farA = s.win('far', 'attn');
      s.alpha(farA, () => {
        const p = s.prog('far');
        const k = Math.min(5, Math.floor(p * 6));
        for (let i = 0; i < k; i++) s.line(xs[i]! + u * 4, hY, xs[i + 1]! - u * 4, hY, s.c('red'), 0.7);
        s.text(`${Math.max(1, k)} of 5 hops`, w / 2, ay + ah * 0.08, { font: 'ui', size: 3.6, weight: 600, color: s.c('red') });
      });
    });
    // All pairs at once.
    const atA = s.ease('attn', 0.7) * (1 - 0.65 * s.ease('cost', 0.6));
    s.alpha(atA, () => {
      const top = ay + ah * 0.18;
      for (let i = 0; i < 6; i++)
        for (let j = i + 1; j < 6; j++) {
          const first = i === 0 && j === 5;
          const pulse = s.since('parallel') >= 0 && s.since('cost') < 0 ? 0.5 + 0.5 * Math.sin(s.t * 5) : 0.6;
          const midX = (xs[i]! + xs[j]!) / 2;
          const rise = (j - i) * ah * 0.075;
          const c = s.ctx;
          c.beginPath();
          c.moveTo(xs[i]!, tokY - u * 3.4);
          c.quadraticCurveTo(midX, tokY - u * 3.4 - rise * 2, xs[j]!, tokY - u * 3.4);
          c.strokeStyle = first ? s.c('green') : s.tint('purple', 0.25 + 0.4 * pulse);
          c.lineWidth = (first ? 0.7 : 0.3) * u;
          c.stroke();
        }
      s.alpha(s.win('attn', 'parallel'), () => s.text('first to last: 1 step', w / 2, top - u * 2, { font: 'ui', size: 3.6, weight: 600, color: s.c('green') }));
      s.alpha(s.win('parallel', 'cost'), () => s.text('every position at once', w / 2, top - u * 2, { font: 'ui', size: 3.6, weight: 600, color: s.c('purple') }));
    });
    WORDS.forEach((wd, i) => chip(s, wd, xs[i]!, tokY, 'orange', { size: cs, maxW: aw / 6 - u }));
    // GPU cores: one busy at a time, then all.
    const gA = s.win('wait', 'far') + s.win('parallel', 'cost');
    s.alpha(Math.min(1, gA), () => {
      const n = 16;
      const gw = Math.min(aw, u * 80);
      const gx = (w - gw) / 2;
      const gy = ay + ah * 0.86;
      const cw = gw / n;
      const par = s.since('parallel') >= 0;
      for (let i = 0; i < n; i++) {
        const busy = par || i === cur % n;
        s.rrect(gx + i * cw + u * 0.3, gy, cw - u * 0.6, u * 5, 0.8, { fill: s.tint(busy ? 'green' : '--ink-3', busy ? 0.6 : 0.12) });
      }
      s.text(par ? 'GPU: all cores busy' : 'GPU: one core busy, the rest wait', w / 2, gy + u * 9, { font: 'ui', size: 3.2, color: s.c('--ink-2') });
    });
    // The cost: T x T scores.
    const cA = s.ease('cost', 0.6);
    if (cA > 0) {
      const big = s.ease('cost', 0.6, (s.end('cost') - s.at('cost')) * 0.55);
      const T = big > 0.5 ? 12 : 6;
      const gy = tokY + u * 6;
      const side = Math.min(ay + ah - gy, aw * 0.4);
      const cs2 = side / T;
      const gx = w / 2 - side / 2;
      s.alpha(cA, () => {
        for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) s.rrect(gx + j * cs2 + 0.5, gy + i * cs2 + 0.5, cs2 - 1, cs2 - 1, 0.3, { fill: s.tint('purple', 0.35) });
        s.text(`T = ${T}: ${T * T} scores`, gx + side + u * 3, gy + side / 2, { font: 'mono', size: 3.4, weight: 600, align: 'left', color: s.c('purple') });
      });
    }
  },
};

/* ------------------------------------------------------------------ queries, keys, values */

const ROLE: [string, string, K][] = [
  ['query', 'what am I looking for?', 'teal'],
  ['key', 'what do I contain?', 'green'],
  ['value', 'what do I hand over?', 'gold'],
];

const qkv: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.13);
    // Opening: the six tokens.
    const tokA = s.win('tokens', 'rows');
    s.alpha(tokA, () => {
      const xs = spread(6, ax, ax + aw);
      WORDS.forEach((wd, i) => s.alpha(s.ease('tokens', 0.4, 0.15 * i), () => chip(s, wd, xs[i]!, h * 0.48, 'orange', { size: 4.2, maxW: aw / 6 - u })));
    });
    const mA = s.ease('rows', 0.6);
    if (mA <= 0) return;
    // Layout: labels, X (4 cols), then Q, K, V (2 cols each).
    const lab = u * 10;
    const gapX = u * 12;
    const gap = u * 3;
    const cw = Math.min(u * 11, (aw - lab - gapX - 2 * gap) / 10);
    const ch = Math.min(cw * 0.72, (ah * 0.62) / 6);
    const total = lab + 4 * cw + gapX + 6 * cw + 2 * gap;
    const centered = ax + (aw - lab - 4 * cw) / 2 + lab;
    const x0 = lerp(centered, ax + (aw - total) / 2 + lab, s.ease('query', 0.8));
    const y0 = ay + u * 12;
    const qx = x0 + 4 * cw + gapX;
    const mx = [qx, qx + 2 * cw + gap, qx + 4 * cw + 2 * gap];
    const why = s.win('why3', 'shapes');
    const satLit = (i: number) => (i === 2 ? why : 0);
    s.alpha(mA, () => {
      rowLabels(s, WORDS, x0 - u * 2, y0, ch, { size: 3.2, lit: why > 0.5 ? 2 : undefined });
      grid(s, x0, y0, cw, ch, TR.X, 'orange', { on: (i) => satLit(i), size: Math.min(3.2, (cw / u) * 0.33) });
      matName(s, 'X', '', '(6, 4)', x0 + 2 * cw, y0 - u * 4.5, 'orange');
    });
    const mats = [TR.Q, TR.K, TR.V];
    const subs = ['Q', 'K', 'V'];
    const beatsAt = ['query', 'key', 'value'];
    const fill = [s.ease('matrices', 0.4), s.ease('same', 0.4), s.ease('same', 0.4, 0.8)];
    mats.forEach((M, k) => {
      const [nm, , col] = ROLE[k]!;
      const x = mx[k]!;
      const show = s.ease(beatsAt[k]!, 0.5);
      if (show <= 0) return;
      s.alpha(show, () => {
        // An empty frame until the matrix multiply fills it.
        s.rrect(x - u * 0.5, y0 - u * 0.5, 2 * cw + u, 6 * ch + u, 1.4, { stroke: s.tint(col, 0.6 - 0.4 * fill[k]!), lw: 0.3 });
        matName(s, subs[k]!, '', '', x + cw, y0 - u * 4.5, col);
        s.text(nm, x + cw, y0 + 6 * ch + u * 4, { font: 'ui', size: 3, weight: 600, color: s.c(col) });
        grid(s, x, y0, cw, ch, M, col, { a: (i) => fill[k]! * clamp01(fill[k]! * 8 - i), on: (i) => satLit(i), size: Math.min(3.2, (cw / u) * 0.33) });
      });
    });
    // The arrows from X with their weight matrices.
    const arrA = s.ease('matrices', 0.5);
    s.alpha(arrA, () => {
      const ax0 = x0 + 4 * cw + u * 1.2;
      const ax1 = qx - u * 1.2;
      s.arrow(ax0, y0 + 3 * ch, ax1, y0 + 3 * ch, s.c('blue'), 0.45, 2.2);
      const lbl = s.since('same') >= 0 ? '× W' : '× Wq';
      s.text(lbl, (ax0 + ax1) / 2, y0 + 3 * ch - u * 2.6, { font: 'mono', size: Math.min(3, fitSize(s, lbl, ax1 - ax0, 3, 'mono')), weight: 600, color: s.c('blue') });
    });
    // The role question for the current beat, at the bottom.
    const qy = Math.min(h - u * 7, y0 + 6 * ch + u * 13);
    ROLE.forEach(([nm, q, col], k) => {
      const a = s.win(beatsAt[k]!, k < 2 ? beatsAt[k + 1]! : 'matrices');
      s.alpha(a, () => s.text(`${nm}: ${q}`, w / 2, qy, { font: 'serif', size: 5, italic: true, color: s.c(col) }));
    });
    s.alpha(why, () => {
      s.text('sat looks for: a subject', w / 2, qy - u * 0.5, { font: 'serif', size: 4.2, italic: true, color: s.c('teal') });
      s.text('sat offers: an action, past tense', w / 2, qy + u * 5.5, { font: 'serif', size: 4.2, italic: true, color: s.c('green') });
    });
    s.alpha(s.ease('shapes', 0.6), () => {
      const y = qy + u * 1;
      const parts: [string, K][] = [['(6, 4)', 'orange'], ['@', '--ink-3'], ['(4, 2)', 'blue'], ['=', '--ink-3'], ['(6, 2)', 'teal']];
      const ws = parts.map(([t]) => (t.length > 1 ? s.measure(t, { font: 'mono', size: 3.6, weight: 600 }) + u * 4.4 : u * 4));
      let x = w / 2 - ws.reduce((a, b) => a + b, 0) / 2;
      parts.forEach(([t, k], i) => {
        if (t.length > 1) pill(s, t, x, y, k, { size: 3.6, align: 'left' });
        else s.text(t, x + ws[i]! / 2, y, { font: 'mono', size: 4, color: s.c(k) });
        x += ws[i]!;
      });
    });
  },
};

/* ------------------------------------------------------------------ scores, softmax, blend */

const scores: SceneDef = {
  marks: {
    total: { tex: String.raw`\operatorname{softmax}\!\left(\frac{\symQ\,\symK^{\!\top}}{\sqrt{\symdk}}\right)\symV`, x: 0.5, y: 0.9, size: 5.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.13);
    const lab = u * 9;
    const sat = 2;
    // Phase A: Q on the left, K transposed on top, S in the middle.
    const aA = 1 - s.ease('mix', 0.6);
    if (aA > 0) {
      const cw = Math.min(u * 11, (aw - lab - u * 3) / 8, (ah - u * 16) / 8.6);
      const ch = cw * 0.78;
      const total = lab + 2 * cw + u * 3 + 6 * cw;
      const qx = ax + (aw - total) / 2 + lab;
      const sx = qx + 2 * cw + u * 3;
      const ky = ay + u * 7;
      const sy = ky + 2 * ch + u * 4;
      const fsz = Math.min(3.1, (cw / u) * 0.3);
      const cmp = s.prog('compare');
      const grd = s.prog('grid');
      const toA = clamp01((s.since('softmax') - 0.4) / 2.4);
      // Which S cells exist so far.
      const sA = (i: number, j: number) => (i === sat ? clamp01(cmp * 7 - j) : clamp01(grd * 7 - (i < sat ? i : i - 1)));
      s.alpha(aA, () => {
        rowLabels(s, WORDS, qx - u * 2, sy, ch, { size: 3, lit: sat });
        grid(s, qx, sy, cw, ch, TR.Q, 'teal', { on: (i) => (i === sat ? 1 : 0), size: fsz });
        matName(s, 'Q', '', '', qx + cw, sy - u * 3.5, 'teal', 4.2);
        colLabels(s, WORDS, sx, ky - u * 2.5, cw, { size: 2.9 });
        grid(s, sx, ky, cw, ch, KT, 'green', { size: fsz });
        matName(s, 'K', '', '', sx - u * 4.5, ky + ch, 'green', 4.2);
        s.text('ᵀ', sx - u * 2.6, ky + ch - u * 1.6, { font: 'serif', size: 3.4, italic: true, color: s.c('green') });
        // Scores, turning into weights row by row.
        for (let i = 0; i < 6; i++)
          for (let j = 0; j < 6; j++) {
            const a = sA(i, j);
            if (a <= 0) continue;
            const conv = clamp01(toA * 7 - i);
            const v = TR.A[i]![j]!;
            const x = sx + j * cw;
            const y = sy + i * ch;
            s.alpha(a * (1 - conv), () => s.cell(x, y, cw, ch, short(TR.S[i]![j]!), 'purple', { on: i === sat ? 0.6 : 0, size: fsz }));
            s.alpha(a * conv, () => {
              s.rrect(x + 1, y + 1, cw - 2, ch - 2, 1, { fill: s.tint('purple', 0.05 + 0.85 * v), stroke: s.tint('purple', 0.35), lw: 0.2 });
              s.text(short(v), x + cw / 2, y + ch / 2 + u * 0.2, { font: 'mono', size: fsz, color: v > 0.55 ? '#fff' : s.c('--ink') });
            });
          }
        const nm = s.since('softmax') >= 0 ? 'A' : 'S';
        s.text(nm, sx + 6 * cw + u * 3.5, sy - u * 2.5, { font: 'serif', size: 4.6, italic: true, weight: 650, color: s.c('purple') });
        s.alpha(s.ease('onemm', 0.5) * (1 - s.ease('softmax', 0.5)), () => s.text('Q Kᵀ / √dₖ', sx + 3 * cw, sy + 6 * ch + u * 5, { font: 'mono', size: 3.6, weight: 600, color: s.c('purple') }));
        s.alpha(s.ease('softmax', 0.5), () => s.text('softmax, row by row', sx + 3 * cw, sy + 6 * ch + u * 5, { font: 'ui', size: 3.6, weight: 600, color: s.c('purple') }));
        // Row sums.
        s.alpha(s.ease('weights', 0.5), () => {
          for (let i = 0; i < 6; i++) s.text('= 1', sx + 6 * cw + u * 1.2, sy + i * ch + ch / 2 + u * 0.2, { font: 'mono', size: 2.9, align: 'left', color: s.c('--ink-3') });
        });
        // The sat row, and its biggest weight.
        const satA = s.ease('compare', 0.4) * (1 - s.ease('grid', 0.4)) + s.ease('sat', 0.4);
        s.alpha(Math.min(1, satA), () => s.rrect(sx - u * 0.5, sy + sat * ch - u * 0.3, 6 * cw + u, ch + u * 0.6, 1.4, { stroke: s.c('teal'), lw: 0.5 }));
        s.alpha(s.ease('sat', 0.5), () => {
          const pulse = 0.5 + 0.5 * Math.sin(s.since('sat') * 6);
          s.rrect(sx + cw - u * 0.4, sy + sat * ch - u * 0.4, cw + u * 0.8, ch + u * 0.8, 1.4, { stroke: s.tint('gold', 0.6 + 0.4 * pulse), lw: 0.7 });
        });
      });
    }
    // Phase B: A times V.
    const bA = s.ease('mix', 0.6);
    if (bA > 0) {
      const cw = Math.min(u * 10.5, (aw - lab - u * 12) / 10, (ah - u * 24) / 6);
      const ch = cw;
      const total = lab + 6 * cw + u * 6 + 2 * cw + u * 6 + 2 * cw;
      const x0 = ax + (aw - total) / 2 + lab;
      const vx = x0 + 6 * cw + u * 6;
      const ox = vx + 2 * cw + u * 6;
      const y0 = ay + u * 9;
      const fsz = Math.min(3.1, (cw / u) * 0.3);
      const allOut = s.ease('mm', 0.6);
      const same = s.ease('same', 0.5) * (1 - s.ease('total', 0.5));
      s.alpha(bA, () => {
        rowLabels(s, WORDS, x0 - u * 2, y0, ch, { size: 3, lit: allOut < 0.5 ? sat : undefined });
        colLabels(s, WORDS, x0, y0 - u * 2.5, cw, { size: 2.8 });
        heat(s, x0, y0, cw, TR.A.map((r) => r), { numbers: true, sel: allOut < 0.5 ? sat : undefined });
        matName(s, 'A', '', '', x0 + 3 * cw, y0 - u * 7, 'purple', 4.4);
        s.text('·', vx - u * 3, y0 + 3 * ch, { font: 'mono', size: 5, color: s.c('--ink-3') });
        // Rows of V tinted by how much sat takes from each.
        const wts = TR.A[sat]!;
        TR.V.forEach((_, i) => s.alpha((1 - allOut) * 0.9, () => s.rrect(vx - u * 0.6, y0 + i * ch, 2 * cw + u * 1.2, ch, 1, { fill: s.tint('purple', 0.08 + 0.55 * wts[i]!) })));
        grid(s, vx, y0, cw, ch, TR.V, 'gold', { size: fsz });
        matName(s, 'V', '', '', vx + cw, y0 - u * 7, 'gold', 4.4);
        s.text('=', ox - u * 3, y0 + 3 * ch, { font: 'mono', size: 4.4, color: s.c('--ink-3') });
        grid(s, ox, y0, cw, ch, TR.out, 'orange', { a: (i) => (i === sat ? s.ease('mix', 0.5, 1.2) : allOut), on: (i) => (i === sat && allOut < 0.5 ? 1 : 0), size: fsz });
        s.text('out', ox + cw, y0 - u * 7, { font: 'serif', size: 4.4, italic: true, weight: 650, color: s.c('orange') });
        // The two identical rows for "the".
        s.alpha(same, () => {
          for (const i of [0, 4]) {
            s.rrect(x0 - lab, y0 + i * ch - u * 0.3, ox + 2 * cw - x0 + lab + u, ch + u * 0.6, 1.4, { stroke: s.c('red'), lw: 0.5 });
          }
          s.text('identical rows', w / 2, y0 + 6 * ch + u * 5, { font: 'ui', size: 3.6, weight: 600, color: s.c('red') });
        });
      });
      s.show('total', s.ease('total', 0.6), { y: Math.min(0.92, (y0 + 6 * ch + u * 9) / h) });
    }
  },
};

/* ------------------------------------------------------------------ scaling */

const scaling: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.13);
    s.alpha(s.win('skipped', 'random'), () => {
      const parts: [string, K][] = [['S = Q Kᵀ ', 'purple'], ['/ √dₖ', 'green']];
      const ws = parts.map(([t]) => s.measure(t, { font: 'mono', size: 6, weight: 600 }));
      let x = w / 2 - (ws[0]! + ws[1]!) / 2;
      parts.forEach(([t, k], i) => {
        s.text(t, x, h * 0.45, { font: 'mono', size: 6, weight: 600, color: s.c(k), align: 'left' });
        x += ws[i]!;
      });
      s.text('why this division?', w / 2, h * 0.6, { font: 'serif', size: 4.6, italic: true, color: s.c('--ink-2') });
    });
    // d_k, stepping through powers of two while the width grows.
    let p = 0;
    if (s.since('watch') >= 0) p = Math.min(6, Math.floor(s.prog('watch') * 7.5));
    if (s.since('softmax') >= 0) p = 6;
    const dk = 2 ** p;
    const scale = lerp(1, 1 / Math.sqrt(dk), s.ease('fix', 1.4, 0.6));
    const { all, row } = dotsAt(p);
    const sd = Math.sqrt(all.reduce((a, v) => a + v * v, 0) / all.length) * scale;
    s.slot('dk', dk);
    s.slot('sd', sd.toFixed(1));
    const tall = s.tall;
    const hr: [number, number, number, number] = tall ? [ax, ay + u * 2, aw, ah * 0.46] : [ax, ay + u * 4, aw * 0.56, ah * 0.7];
    const br: [number, number, number, number] = tall ? [ax, ay + ah * 0.6, aw, ah * 0.4] : [ax + aw * 0.62, ay + u * 4, aw * 0.38, ah * 0.7];
    // Histogram of the scores.
    const [hx, hy, hw, hh] = hr;
    const R = 30;
    const bins = new Array<number>(2 * R).fill(0);
    for (const v0 of all) {
      const v = v0 * scale;
      if (v >= -R && v < R) bins[Math.floor(v + R)]!++;
    }
    const mx = Math.max(...bins);
    const X = (v: number) => hx + ((v + R) / (2 * R)) * hw;
    const base = hy + hh - u * 5;
    s.alpha(s.ease('random', 0.6), () => {
      s.line(hx, base, hx + hw, base, s.c('--axis'), 0.25);
      s.line(X(0), hy + u * 2, X(0), base, s.c('--axis'), 0.2);
      bins.forEach((b, i) => {
        if (!b) return;
        const bh = ((base - hy - u * 6) * b) / mx;
        s.ctx.fillStyle = s.tint('purple', 0.6);
        s.ctx.fillRect(X(i - R) + 0.5, base - bh, X(i - R + 1) - X(i - R) - 1, bh);
      });
      for (const v of [-20, 0, 20]) s.text(String(v), X(v), base + u * 2.8, { font: 'mono', size: 2.8, color: s.c('--ink-3') });
      s.text(`scores at dₖ = ${dk}`, hx, hy + u * 1, { font: 'ui', size: 3.4, weight: 600, align: 'left', color: s.c('--ink') });
      s.text(`std ${sd.toFixed(1)}`, hx + hw, hy + u * 1, { font: 'mono', size: 3.4, weight: 600, align: 'right', color: s.c('purple') });
    });
    // The softmax of one query against eight keys.
    const bA = s.ease('softmax', 0.6);
    if (bA > 0) {
      const [bx, by, bw, bh] = br;
      const a = softmax(row.map((v) => v * scale));
      const top = by + u * 6;
      const bot = by + bh - u * 5;
      const cw = bw / 8;
      s.alpha(bA, () => {
        s.text('softmax over 8 keys', bx, by + u * 1, { font: 'ui', size: 3.4, weight: 600, align: 'left', color: s.c('--ink') });
        s.line(bx, bot, bx + bw, bot, s.c('--axis'), 0.25);
        a.forEach((v, j) => {
          const hh2 = (bot - top) * v;
          s.rrect(bx + j * cw + cw * 0.15, bot - Math.max(u * 0.4, hh2), cw * 0.7, Math.max(u * 0.4, hh2), 0.6, { fill: s.tint('purple', 0.75) });
          s.text(`${Math.round(v * 100)}`, bx + j * cw + cw / 2, Math.max(top, bot - hh2 - u * 2.6), { font: 'mono', size: 2.8, color: s.c('--ink-2') });
        });
        const sig = 1 - a.reduce((t, v) => t + v * v, 0);
        s.alpha(s.ease('gradient', 0.5), () => s.text(`gradient signal ${sig.toFixed(2)}`, bx + bw / 2, bot + u * 3.4, { font: 'mono', size: 3.2, weight: 600, color: s.c(sig < 0.2 ? 'red' : 'green') }));
      });
    }
    s.alpha(s.ease('fix', 0.6), () => pill(s, '÷ √dₖ', tall ? ax + aw / 2 : hx + hw / 2, tall ? ay + ah * 0.53 : hy + hh + u * 6, 'green', { size: 3.8 }));
  },
};

export const scenesA: Record<string, SceneDef> = { intro, why, qkv, scores, scaling };
