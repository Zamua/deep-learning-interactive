import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { GROUP, NV, WORDS } from '../../lib/tokenization-embed';
import { HVEC, TABLE, TOY, enc, toyE, tokLabel } from './data';
import { type K, chip, chipW, current, flowLayout, hbar, pill, squareFrame, tokK } from './kit';
import { pipeline } from './scenes-a';

const GROUP_K: K[] = ['gold', 'orange', 'blue', 'purple', 'red'];
const NAME = WORDS.map((w) => (w === '.' ? '"."' : w));

/** A grid of cells tinted by value; `on(i)` lights a row, `dim(i)` fades one. */
function grid(s: Scene, x: number, y: number, cw: number, ch: number, vals: number[][], k: K, o: { on?: (i: number, j: number) => number; dim?: (i: number) => number; a?: number } = {}): void {
  s.alpha(o.a ?? 1, () => {
    vals.forEach((row, i) => {
      const dm = o.dim ? o.dim(i) : 1;
      s.alpha(dm, () =>
        row.forEach((v, j) => {
          const on = o.on ? o.on(i, j) : 0;
          s.rrect(x + j * cw + cw * 0.06, y + i * ch + ch * 0.06, cw * 0.88, ch * 0.88, 0.5, { fill: s.tint(k, 0.1 + 0.6 * Math.abs(v)), stroke: on > 0 ? s.tint('--accent', on) : undefined, lw: 0.35 });
        }),
      );
    });
  });
}

/** The 2-D toy model's embedding rows (dots) with merged labels, in a square frame. */
function toyPlot(s: Scene, rect: [number, number, number, number], E: Float64Array, o: { ring?: number[]; sel?: number; outs?: number; hot?: number[]; arrow?: number } = {}): ReturnType<typeof squareFrame> {
  const { u } = s;
  let R = 1.5;
  for (let i = 0; i < E.length; i++) R = Math.max(R, Math.abs(E[i]!));
  if (o.outs) for (let j = 0; j < NV; j++) R = Math.max(R, ...TOY.out(j).map(Math.abs));
  const F = squareFrame(rect, R * 1.15);
  const [rx, ry, rw, rh] = rect;
  s.rrect(rx, ry, rw, rh, 2, { fill: s.c('--paper'), stroke: s.c('--rule'), lw: 0.25 });
  s.line(F.X(-R * 1.15), F.Y(0), F.X(R * 1.15), F.Y(0), s.c('--axis'), 0.2);
  s.line(F.X(0), F.Y(-R * 1.15), F.X(0), F.Y(R * 1.15), s.c('--axis'), 0.2);
  // output vectors
  const outLabels: [number, number, string][] = [];
  if (o.outs) {
    s.alpha(o.outs, () => {
      for (let j = 0; j < NV; j++) {
        const [a, b] = TOY.out(j);
        const X = F.X(a), Y = F.Y(b);
        const hot = o.hot?.includes(j) ?? false;
        const c = s.ctx;
        c.beginPath();
        const d = 1.6 * u;
        c.moveTo(X, Y - d);
        c.lineTo(X + d, Y);
        c.lineTo(X, Y + d);
        c.lineTo(X - d, Y);
        c.closePath();
        c.strokeStyle = s.tint('teal', hot ? 1 : 0.45);
        c.lineWidth = (hot ? 0.5 : 0.3) * u;
        c.stroke();
        if (hot) outLabels.push([X, Y, NAME[j]!]);
      }
    });
  }
  if (o.arrow && o.sel !== undefined) {
    const [h0, h1] = TOY.hidden(o.sel);
    const L = Math.hypot(h0, h1);
    const m = Math.min(1, (R * 1.05) / L);
    s.alpha(o.arrow, () => {
      s.arrow(F.X(0), F.Y(0), F.X(h0 * m), F.Y(h1 * m), s.c('green'), 0.55, 2.4);
      s.text('h', F.X(h0 * m) + (h0 >= 0 ? 2 : -2) * u, F.Y(h1 * m) - 2 * u, { size: 4, italic: true, weight: 650, color: s.c('green'), halo: true });
    });
  }
  // dots, then merged labels
  const cl: { X: number; Y: number; ws: number[] }[] = [];
  for (let t = 0; t < NV; t++) {
    const X = F.X(E[2 * t]!), Y = F.Y(E[2 * t + 1]!);
    const hit = cl.find((q) => Math.hypot(q.X - X, q.Y - Y) < 2.6 * u);
    if (hit) hit.ws.push(t);
    else cl.push({ X, Y, ws: [t] });
    const ring = o.ring?.includes(t) || o.sel === t;
    s.circle(X, Y, (ring ? 1.6 : 1.25) * u, { fill: s.c(GROUP_K[GROUP[t]!]!), stroke: ring ? s.c('--ink') : s.c('--paper'), lw: ring ? 0.45 : 0.25 });
  }
  const fsz = s.tall ? 3.3 : 3;
  const taken: [number, number, number, number][] = cl.map((q) => [q.X - 1.5 * u, q.Y - 1.5 * u, q.X + 1.5 * u, q.Y + 1.5 * u]);
  const place = (X: number, Y: number, lab: string, k: K) => {
    const tw = s.measure(lab, { size: fsz, font: 'ui', weight: 650 });
    const hh = fsz * 0.55 * u;
    const spots: [number, number][] = [[2.2 * u, -2.6 * u], [2.2 * u, 2.8 * u], [-2.2 * u - tw, -2.6 * u], [-2.2 * u - tw, 2.8 * u], [-tw / 2, -4.4 * u], [-tw / 2, 4.6 * u], [3 * u, 0], [-3 * u - tw, 0]];
    let pick = spots[0]!;
    for (const sp of spots) {
      const r: [number, number, number, number] = [X + sp[0], Y + sp[1] - hh, X + sp[0] + tw, Y + sp[1] + hh];
      const inside = r[0] > rx + u && r[2] < rx + rw - u && r[1] > ry + u && r[3] < ry + rh - u;
      if (inside && !taken.some((t) => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1])) {
        pick = sp;
        break;
      }
    }
    taken.push([X + pick[0], Y + pick[1] - hh, X + pick[0] + tw, Y + pick[1] + hh]);
    s.text(lab, X + pick[0], Y + pick[1], { size: fsz, font: 'ui', weight: 650, align: 'left', color: s.c(k), halo: true });
  };
  for (const q of cl) place(q.X, q.Y, q.ws.map((t) => NAME[t]).join(', '), GROUP_K[GROUP[q.ws[0]!]!]!);
  for (const [X, Y, lab] of outLabels) place(X, Y, lab, 'teal');
  return F;
}

// ---------------------------------------------------------------- embeddings

const E_ROWS: (number | null)[] = [0, 1, 2, null, 336, 337, 338, null, 426];
const SENT = enc('the keeper wrote it down');
const T_ROW = 5;

const embed: SceneDef = {
  marks: {
    onehot: { tex: String.raw`\symx = \symE[\symt] = \mathrm{onehot}(\symt)^{\top}\symE`, x: 0.5, y: 0.9, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const beat = current(s, ['ints', 'table', 'row', 'onehot', 'picks', 'linear', 'sparse', 'learn', 'toy', 'clusters', 'apart', 'meaning', 'position']);
    // ids
    s.alpha(s.win('ints', 'table'), () => {
      s.text('a list of token ids', w / 2, h * 0.24, { size: 4.2, font: 'ui', weight: 600, color: s.c('--ink-2') });
      const lay = flowLayout(s, SENT.map(String), w / 2, h * 0.33, w - 8 * u, 4.4, false, 2);
      SENT.forEach((id, i) => chip(s, lay.pos[i]!.x, lay.pos[i]!.y, String(id), 'gold', { size: 4.4 }));
      s.alpha(s.ease('ints', 0.6, 3.5), () => s.text('1000 is not “more” than 999', w / 2, h * 0.58, { size: 4, italic: true, color: s.c('red') }));
    });
    // the table
    const aT = s.win('table', 'learn');
    if (aT > 0) {
      const cw = Math.min(5.6 * u, (s.tall ? w * 0.52 : w * 0.34) / 8);
      const ch = Math.min(cw * 0.9, (h * 0.6) / 9);
      const lab = s.tall ? 3.3 : 3;
      const gx = w / 2 - 4 * cw + 3 * u;
      const gy = h * 0.1;
      const ohA = s.ease('onehot', 0.6) * (1 - s.ease('linear', 0.6));
      const picks = s.since('picks') >= 0 && s.since('linear') < 0 ? s.ease('picks', 0.8) : 0;
      const pull = s.since('row') >= 0 ? s.ease('row', 0.9, 0.6) : 0;
      s.alpha(aT, () => {
        s.text('E', gx + 4 * cw, gy - 3 * u, { size: 5, italic: true, weight: 650, color: s.c('blue') });
        s.alpha(1 - pull, () => s.text(`V = 427 rows · d = 8 columns`, gx + 4 * cw, gy + 2 * u + 9 * ch + 4 * u, { size: lab, font: 'mono', color: s.c('--ink-2') }));
        E_ROWS.forEach((id, i) => {
          const y = gy + 2 * u + i * ch;
          if (id === null) {
            s.text('⋮', gx + 4 * cw, y + ch / 2, { size: 3.6, color: s.c('--ink-3') });
            return;
          }
          const isT = i === T_ROW;
          s.text(String(id), gx - 1.5 * u, y + ch / 2, { size: lab, font: 'mono', align: 'right', color: s.c(isT && pull > 0 ? 'gold' : '--ink-3') });
          grid(s, gx, y, cw, ch, [TABLE[i]!], 'blue', { on: () => (isT ? pull : 0), dim: () => (isT ? 1 : 1 - 0.75 * picks) });
          // the one-hot entry for this row
          s.alpha(ohA, () => {
            const ox = gx - 12.5 * u;
            s.rrect(ox, y + ch * 0.08, ch * 0.84, ch * 0.84, 0.4, { fill: s.tint(isT ? 'gold' : '--ink-3', isT ? 0.4 : 0.08), stroke: s.tint(isT ? 'gold' : '--ink-3', 0.6), lw: 0.2 });
            s.text(isT ? '1' : '0', ox + ch * 0.42, y + ch / 2, { size: lab, font: 'mono', weight: isT ? 700 : 400, color: s.c(isT ? 'gold' : '--ink-3') });
            if (!isT) s.alpha(picks, () => s.text('×0', gx + 8 * cw + 1.5 * u, y + ch / 2, { size: lab, font: 'mono', align: 'left', color: s.c('--ink-3') }));
          });
        });
        s.alpha(ohA, () => s.text('onehot', gx - 12.5 * u + ch * 0.42, gy - 1.5 * u, { size: lab, font: 'mono', color: s.c('gold') }));
        // pulled-out row x
        s.alpha(pull, () => {
          const y = gy + 2 * u + T_ROW * ch;
          const tx = gx;
          const ty = gy + 2 * u + 9 * ch + 3 * u;
          const xx = lerp(gx, tx, smooth(pull));
          const yy = lerp(y, ty, smooth(pull));
          grid(s, xx, yy, cw, ch, [TABLE[T_ROW]!], 'orange');
          s.text(`x = E[337]  (${tokLabel(337)})`, xx + 4 * cw, yy + ch + 3.4 * u, { size: lab + 0.2, font: 'mono', weight: 600, color: s.c('orange') });
        });
        // gradients only for rows in the batch
        s.alpha(s.win('sparse', 'learn'), () => {
          E_ROWS.forEach((id, i) => {
            if (id === null) return;
            const y = gy + 2 * u + i * ch + ch / 2;
            const used = i === T_ROW || i === 1;
            const x0 = gx + 8 * cw + 1.5 * u;
            if (used) s.arrow(x0 + 8 * u, y, x0 + 1 * u, y, s.c('teal'), 0.45, 1.8);
            s.text(used ? 'dE' : '0', x0 + 9 * u, y, { size: lab, font: 'mono', align: 'left', color: s.c(used ? 'teal' : '--ink-3') });
          });
        });
        s.alpha(s.win('linear', 'sparse'), () => s.text('a linear layer with one-hot input', w / 2, h * 0.93, { size: 3.8, italic: true, color: s.c('purple') }));
      });
      s.show('onehot', s.win('onehot', 'linear'), { y: s.tall ? 0.92 : 0.9 });
    }
    // the 2-D toy model
    const aP = s.win('learn', 'position');
    if (aP > 0) {
      const rect: [number, number, number, number] = s.tall ? [5 * u, h * 0.11, w - 10 * u, h * 0.76] : [w * 0.2, h * 0.1, w * 0.6, h * 0.78];
      const p = s.since('clusters') >= 0 ? smooth(s.prog('clusters') * 1.1) : 0;
      s.alpha(aP, () => {
        s.alpha(1 - s.ease('toy', 0.5), () => s.text('nobody tells the rows anything but the loss', w / 2, h * 0.4, { size: 4, italic: true, color: s.c('--ink-2') }));
        s.alpha(s.ease('toy', 0.6), () => {
          toyPlot(s, rect, toyE(p), { ring: beat === 'apart' ? [7, 8] : [] });
          s.text(p < 0.05 ? 'a random table' : p < 0.99 ? 'training…' : 'trained', w / 2, h * 0.06, { size: 3.8, font: 'ui', weight: 600, color: s.c('--ink-2') });
        });
        s.alpha(s.ease('meaning', 0.6), () => s.text('d = 2 here; GPT-2 small uses 768', w / 2, h * 0.94, { size: 3.8, italic: true, color: s.c('purple') }));
      });
    }
    // position: same row everywhere
    s.alpha(s.ease('position', 0.7), () => {
      const cw = 4.4 * u;
      const gx = w / 2 - 4 * cw;
      const gy = h * 0.52;
      grid(s, gx, gy, cw, cw * 0.9, [TABLE[3]!], 'orange');
      s.text('E[258]', w / 2, gy + cw * 0.9 + 4 * u, { size: 3.6, font: 'mono', color: s.c('orange') });
      const xs = [w * 0.25, w * 0.75];
      ['position 3', 'position 300'].forEach((lab, i) => {
        const lw = chipW(s, tokLabel(258), 4, lab);
        chip(s, xs[i]! - lw / 2, h * 0.2, tokLabel(258), tokK(258), { size: 4, sub: lab });
        s.arrow(xs[i]!, h * 0.2 + 13 * u, lerp(xs[i]!, w / 2, 0.75), gy - 2 * u, s.c('--ink-3'), 0.4, 2);
      });
      s.text('order is added separately, on top', w / 2, h * 0.86, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
  },
};

// ---------------------------------------------------------------- unembedding

const CAT = WORDS.indexOf('cat');
const U_VALS: number[][] = Array.from({ length: 8 }, (_, i) => Array.from({ length: 14 }, (_, j) => TABLE[(i * 5 + j) % 12]![(j + i) % 8]! * 0.9));
const Z_VALS: number[] = Array.from({ length: 14 }, (_, j) => U_VALS.reduce((a, row, i) => a + row[j]! * HVEC[i]!, 0));

const unembed: SceneDef = {
  marks: {
    z: { tex: String.raw`\symz = \symh\,\symU`, x: 0.5, y: 0.08, size: 6 },
    soft: { tex: String.raw`p_j = \frac{e^{\symz_j}}{\sum_k e^{\symz_k}}`, x: 0.5, y: 0.1, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const beat = current(s, ['top', 'scores', 'matmul', 'column', 'points', 'softmax', 'classifier', 'gpt2', 'steer', 'cost']);
    const aM = s.win('top', 'points');
    if (aM > 0) {
      const cols = 14;
      const cw = Math.min(5 * u, (w - 26 * u) / cols);
      const ch = Math.min(cw, h * 0.045);
      const ux = w / 2 - (cols * cw) / 2 + 4 * u;
      const uy = h * 0.22;
      const hx = ux - 9 * u;
      const colJ = 4;
      s.alpha(aM, () => {
        // h as a column, row i of U beside entry i
        HVEC.forEach((v, i) => s.rrect(hx, uy + i * ch + ch * 0.06, ch * 0.88, ch * 0.88, 0.5, { fill: s.tint('green', 0.12 + 0.6 * Math.abs(v)), stroke: s.tint('green', 0.6), lw: 0.2 }));
        s.text('h', hx + ch * 0.44, uy - 3 * u, { size: 4.4, italic: true, weight: 650, color: s.c('green') });
        s.alpha(s.ease('scores', 0.6), () => {
          grid(s, ux, uy, cw, ch, U_VALS, 'teal', { on: (_, j) => (beat === 'column' && j === colJ ? 1 : 0) });
          s.text('U', ux + (cols * cw) / 2, uy - 3 * u, { size: 4.4, italic: true, weight: 650, color: s.c('teal') });
          s.text('d rows', ux + cols * cw + 1.2 * u, uy + 4 * ch, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-3') });
          s.text('V columns, one per token', ux + (cols * cw) / 2, uy + 8 * ch + 3.4 * u, { size: 3.3, font: 'mono', color: s.c('--ink-3') });
        });
        // the logits, one bar under each column
        s.alpha(s.ease('matmul', 0.6, 1), () => {
          const by = uy + 8 * ch + 14 * u;
          const mx = Math.max(...Z_VALS.map(Math.abs));
          s.text('z', hx + ch * 0.44, by, { size: 4.4, italic: true, weight: 650, color: s.c('purple') });
          s.line(ux, by, ux + cols * cw, by, s.c('--axis'), 0.25);
          Z_VALS.forEach((v, j) => {
            const bh = (v / mx) * 12 * u;
            const on = beat === 'column' && j === colJ;
            s.rrect(ux + j * cw + cw * 0.15, Math.min(by, by - bh), cw * 0.7, Math.abs(bh), 0.4, { fill: s.tint('purple', on ? 0.85 : 0.45) });
          });
          s.alpha(s.win('column', 'points'), () => s.text('z_j = h · (column j of U)', w / 2, by + 17 * u, { size: 3.8, font: 'mono', weight: 600, color: s.c('purple') }));
        });
        s.show('z', s.win('matmul', 'points'));
      });
    }
    // the toy model: h points at what comes next
    const aT = s.win('points', 'classifier');
    if (aT > 0) {
      const rect: [number, number, number, number] = s.tall ? [5 * u, h * 0.04, w - 10 * u, h * 0.62] : [4 * u, h * 0.08, w * 0.52, h * 0.84];
      const probs = TOY.probs(CAT);
      const order = probs.map((v, j) => [v, j] as const).sort((a, b) => b[0] - a[0]).slice(0, 4);
      s.alpha(aT, () => {
        toyPlot(s, rect, TOY.E, { sel: CAT, outs: 1, hot: [WORDS.indexOf('runs'), WORDS.indexOf('sleeps')], arrow: 1 });
        s.text('after “cat”', rect[0] + 2 * u, rect[1] + 3.5 * u, { size: 3.6, font: 'ui', weight: 650, align: 'left', color: s.c('--ink-2'), halo: true });
        s.alpha(s.ease('softmax', 0.6), () => {
          const bx = s.tall ? 6 * u : w * 0.6;
          const by = s.tall ? h * 0.7 : h * 0.3;
          const bw = s.tall ? w - 12 * u : w * 0.36;
          s.text('probabilities after softmax', bx, by, { size: 3.6, font: 'ui', weight: 650, align: 'left' });
          order.slice(0, 3).forEach(([v, j], r) => hbar(s, bx, by + 4 * u + r * 5.6 * u, 18 * u, bw - 32 * u, v, NAME[j]!, `${Math.round(v * 100)}%`, 'purple', { size: 3.5, on: r < 2 ? 1 : 0 }));
        });
        if (!s.tall) s.show('soft', s.win('softmax', 'classifier'), { x: 0.78, y: 0.14 });
      });
    }
    // an old friend
    s.alpha(s.win('classifier', 'steer'), () => {
      const y = h * 0.3;
      s.text('CS231n, chapter 4', w * 0.27, y, { size: 3.4, font: 'ui', weight: 650, color: s.c('--ink-2') });
      s.text('s = W x', w * 0.27, y + 9 * u, { size: 5.4, font: 'mono', weight: 600 });
      s.text('10 classes', w * 0.27, y + 17 * u, { size: 3.4, italic: true, color: s.c('--ink-2') });
      s.text('a language model', w * 0.73, y, { size: 3.4, font: 'ui', weight: 650, color: s.c('--ink-2') });
      s.text('z = h U', w * 0.73, y + 9 * u, { size: 5.4, font: 'mono', weight: 600, color: s.c('purple') });
      s.text('V classes', w * 0.73, y + 17 * u, { size: 3.4, italic: true, color: s.c('--ink-2') });
      s.text('≈', w / 2, y + 9 * u, { size: 6, color: s.c('--ink-3') });
      s.alpha(s.ease('gpt2', 0.6), () => {
        s.text('GPT-2: 50,257 classes', w / 2, y + 34 * u, { size: s.tall ? 5 : 5.6, font: 'mono', weight: 650, color: s.c('purple') });
      });
    });
    // steering h
    s.alpha(s.ease('steer', 0.6), () => {
      const rect: [number, number, number, number] = s.tall ? [5 * u, h * 0.04, w - 10 * u, h * 0.66] : [w * 0.2, h * 0.05, w * 0.6, h * 0.68];
      const words = ['cat', 'big', 'fish'];
      const sel = WORDS.indexOf(words[Math.min(2, Math.floor(clamp01(s.prog('steer') * 1.2) * 3))]! as (typeof WORDS)[number]);
      const probs = TOY.probs(sel);
      const hot = probs.map((v, j) => [v, j] as const).filter(([v]) => v > 0.15).map(([, j]) => j);
      s.alpha(1 - s.ease('cost', 0.5), () => {
        toyPlot(s, rect, TOY.E, { sel, outs: 1, hot, arrow: 1 });
        s.text(`after “${WORDS[sel]}”`, rect[0] + 2 * u, rect[1] + 3.5 * u, { size: 3.6, font: 'ui', weight: 650, align: 'left', color: s.c('--ink-2'), halo: true });
      });
      s.alpha(s.ease('cost', 0.6), () => {
        // one position's logits, drawn as a long row of thin bars
        const n = 90;
        const bx = 6 * u, bw = (w - 12 * u) / n, by = h * 0.45;
        for (let j = 0; j < n; j++) {
          const v = Math.abs(Math.sin(j * 2.3) * Math.cos(j * 0.7));
          s.alpha(clamp01((s.since('cost') - 0.3) * 4 - j / 30), () => s.rrect(bx + j * bw + bw * 0.15, by - v * 14 * u, bw * 0.7, v * 14 * u + 0.3 * u, 0.1, { fill: s.tint('purple', 0.55) }));
        }
        s.text('one score for every token, at every position', w / 2, by + 3.5 * u, { size: 3.3, font: 'ui', color: s.c('purple') });
        const y = h * 0.7;
        s.text('d × V multiply-adds per position', w / 2, y, { size: 3.9, font: 'mono', weight: 600 });
        s.text('GPT-2 small: 768 × 50,257 ≈ 38.6M', w / 2, y + 7 * u, { size: 3.6, font: 'mono', color: s.c('--ink-2') });
      });
    });
  },
};

// ---------------------------------------------------------------- weight tying

const SHARE: [string, number][] = [['GPT-2 small', 0.312], ['GPT-2 XL', 0.052], ['7B, V 32K', 0.039], ['1B, V 128K', 0.246]];
const VOCABS: [string, string, number][] = [['BERT', '2018', 30522], ['GPT-2', '2019', 50257], ['LLaMA 2', '2023', 32000], ['GPT-4', '2023', 100000], ['LLaMA 3', '2024', 128000], ['GPT-4o', '2024', 200000]];

const tying: SceneDef = {
  marks: {
    tie: { tex: String.raw`\symU = \symE^{\top}`, x: 0.5, y: 0.1, size: 6.4 },
    score: { tex: String.raw`\symz_j = \symh \cdot \symE_j`, x: 0.5, y: 0.86, size: 5.6 },
    cost: { tex: String.raw`\underbrace{\symV\symd}_{\text{one table}} \quad \text{vs} \quad \underbrace{12\,\symd^2}_{\text{one block}}`, x: 0.5, y: 0.12, size: 6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // E and U side by side, then tied
    const aG = s.win('side', 'saves');
    if (aG > 0) {
      const rows = 9;
      const cell = Math.min(4.4 * u, (h * 0.55) / rows);
      const ex = w / 2 - (5 * cell + 12 * u + rows * cell) / 2;
      const ey = h * 0.22;
      const tie = s.ease('tie', 1.2, 0.4);
      const vals = TABLE.slice(0, rows).map((r) => r.slice(0, 5));
      s.alpha(aG, () => {
        grid(s, ex, ey, cell, cell, vals, 'blue');
        s.text('E', ex + 2.5 * cell, ey - 4 * u, { size: 5, italic: true, weight: 650, color: s.c('blue') });
        s.text('a row per token', ex + 2.5 * cell, ey + rows * cell + 4 * u, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        const ux = ex + 5 * cell + 12 * u;
        const uy = ey + 1.5 * cell;
        const uvals = Array.from({ length: 5 }, (_, i) => Array.from({ length: rows }, (_, j) => lerp(TABLE[(j + 4) % 12]![(i + 3) % 8]!, vals[j]![i]!, tie)));
        grid(s, ux, uy, cell, cell, uvals, tie > 0.5 ? 'blue' : 'teal');
        s.text(tie > 0.5 ? 'Eᵀ' : 'U', ux + (rows * cell) / 2, uy - 4 * u, { size: 5, italic: true, weight: 650, color: s.c(tie > 0.5 ? 'blue' : 'teal') });
        s.text('a column per token', ux + (rows * cell) / 2, uy + 5 * cell + 4 * u, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        s.alpha(s.win('who', 'score'), () => {
          const y = h * 0.86;
          pill(s, 'Transformer, 2017', w * 0.3, y, 'slate', 3.5);
          pill(s, 'GPT-2, 2019', w * 0.72, y, 'slate', 3.5);
        });
      });
      s.show('tie', s.win('tie', 'saves'));
      s.show('score', s.win('score', 'saves'));
    }
    // parameters saved
    s.alpha(s.win('saves', 'rare'), () => {
      const y = h * 0.3;
      const bw = w - 12 * u;
      const tot = 38.6 + 84.9;
      const ew = (bw * 38.6) / tot;
      s.text('GPT-2 small, tied: 124M parameters', w / 2, y - 7 * u, { size: 3.8, font: 'ui', weight: 650 });
      s.rrect(6 * u, y, ew, 9 * u, 0.6, { fill: s.tint('blue', 0.5) });
      s.rrect(6 * u + ew, y, bw - ew, 9 * u, 0.6, { fill: s.tint('--ink-3', 0.25) });
      s.text('E 38.6M', 6 * u + ew / 2, y + 4.7 * u, { size: 3.5, font: 'mono', weight: 650 });
      s.text('blocks 84.9M', 6 * u + ew + (bw - ew) / 2, y + 4.7 * u, { size: 3.5, font: 'mono', weight: 650 });
      s.alpha(s.ease('saves', 0.6, 2), () => {
        const yy = y + 16 * u;
        s.ctx.save();
        s.ctx.setLineDash([u, u]);
        s.rrect(6 * u, yy, ew, 9 * u, 0.6, { stroke: s.tint('teal', 0.8), lw: 0.3 });
        s.ctx.restore();
        s.text('U 38.6M: not needed', 6 * u + ew + 3 * u, yy + 4.7 * u, { size: 3.5, font: 'mono', weight: 600, align: 'left', color: s.c('teal') });
        s.line(6 * u, yy + 9 * u, 6 * u + ew, yy, s.tint('red', 0.7), 0.35);
      });
    });
    // gradients: sparse in, dense out
    s.alpha(s.win('rare', 'cost'), () => {
      const n = 10;
      const cell = Math.min(5 * u, (w * 0.36) / n);
      const panels: [string, number, K, (i: number) => boolean][] = [
        ['input rows: only tokens in the batch', 0, 'blue', (i) => i === 2 || i === 7],
        ['output vectors: every position', 1, 'teal', () => true],
      ];
      panels.forEach(([lab, r, k, has]) => {
        const y = h * (0.16 + r * 0.36);
        s.alpha(r === 0 ? 1 : s.ease('rare', 0.6, 3.5), () => {
          s.text(lab, w / 2, y, { size: 3.7, font: 'ui', weight: 600 });
          const x0 = w / 2 - (n * cell) / 2;
          for (let i = 0; i < n; i++) {
            const g = has(i);
            s.rrect(x0 + i * cell + 0.3 * u, y + 4 * u, cell - 0.6 * u, cell * 1.4, 0.6, { fill: s.tint(k, g ? 0.45 : 0.08), stroke: s.tint(k, 0.5), lw: 0.2 });
            if (g) s.arrow(x0 + i * cell + cell / 2, y + 4 * u + cell * 1.4 + 6 * u, x0 + i * cell + cell / 2, y + 4.5 * u + cell * 1.4, s.c('teal'), 0.35, 1.5);
          }
        });
      });
      s.alpha(s.ease('share', 0.6), () => s.text('tied: rare tokens learn from both', w / 2, h * 0.9, { size: 3.8, italic: true, color: s.c('purple') }));
    });
    // one vector, two jobs
    s.alpha(s.win('cost', 'scale'), () => {
      const cw = 5 * u;
      const gx = w / 2 - 4 * cw;
      const gy = h * 0.42;
      grid(s, gx, gy, cw, cw, [TABLE[6]!], 'blue');
      s.text('E[t]', w / 2, gy - 4 * u, { size: 4, font: 'mono', weight: 600, color: s.c('blue') });
      s.text('what the token is', w * 0.27, gy + cw + 9 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
      s.text('when it comes next', w * 0.73, gy + cw + 9 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
      s.arrow(w * 0.27, gy + cw + 5 * u, w / 2 - 3 * u, gy + cw + 1 * u, s.c('--ink-3'), 0.35, 1.8);
      s.arrow(w * 0.73, gy + cw + 5 * u, w / 2 + 3 * u, gy + cw + 1 * u, s.c('--ink-3'), 0.35, 1.8);
    });
    // how big is the vocabulary share
    s.show('cost', s.win('scale', 'vocab'), { y: lerp(0.42, 0.11, s.ease('xl', 0.8)) });
    s.alpha(s.win('xl', 'vocab'), () => {
      const y = h * 0.3;
      s.text('vocabulary share of parameters', w / 2, y, { size: 3.7, font: 'ui', weight: 650 });
      SHARE.forEach(([lab, f], r) => hbar(s, 4 * u, y + 5 * u + r * 7.5 * u, 27 * u, w - 47 * u, f / 0.35, lab, `${Math.round(f * 100)}%`, f > 0.2 ? 'blue' : '--ink-3', { size: 3.4 }));
    });
    s.alpha(s.ease('vocab', 0.6), () => {
      const y = h * 0.12;
      s.text('vocabulary sizes over time', w / 2, y, { size: 3.7, font: 'ui', weight: 650 });
      VOCABS.forEach(([name, yr, v], r) => hbar(s, 4 * u, y + 5 * u + r * 7 * u, 30 * u, w - 52 * u, v / 200000, `${name} ${yr}`, v >= 100000 ? `~${Math.round(v / 1000)}K` : v.toLocaleString('en-US'), 'slate', { size: 3.3, a: clamp01((s.since('vocab') - 0.4) * 3 - r * 0.5) }));
    });
  },
};

// ---------------------------------------------------------------- outro

const outro: SceneDef = {
  draw(s) {
    const { w, h } = s;
    const top = 0;
    s.alpha(1 - s.ease('next', 0.6), () => pipeline(s, { text: 1, chips: 1, x: s.ease('emb', 0.6), tf: s.ease('emb', 0.6, 0.6), hh: s.ease('unemb', 0.6), logits: s.ease('unemb', 0.6, 0.6), next: s.ease('unemb', 0.6, 1.2), dim: 0, top, logLabel: 'logits = h @ E.T (tied)' }));
    const notes: [string, string, number][] = [
      ['tok', 'BPE: count pairs, merge the top one', 0.36],
      ['bytes', 'start from 256 bytes: nothing unknown', 0.44],
      ['quirks', 'spaces, numbers, spelling, languages', 0.52],
    ];
    s.alpha(1 - s.ease('emb', 0.5), () =>
      notes.forEach(([b, t, f]) => s.alpha(s.ease(b, 0.6), () => s.text(t, w / 2, h * f, { size: 3.8, italic: true, color: s.c('gold'), halo: true }))),
    );
    s.alpha(s.ease('next', 0.6), () => {
      s.rrect(w * 0.08, h * 0.3, w * 0.84, h * 0.4, 3, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.3 });
      s.text('next: training on next tokens', w / 2, h * 0.42, { size: s.tall ? 4.4 : 5, font: 'display', weight: 600 });
      s.alpha(s.ease('chapter', 0.6), () => {
        s.text('now open the chapter:', w / 2, h * 0.5, { size: 3.8, italic: true, color: s.c('--ink-2') });
        s.text('train BPE, encode anything,', w / 2, h * 0.57, { size: 3.8, font: 'ui', color: s.c('purple') });
        s.text('watch an embedding space form', w / 2, h * 0.63, { size: 3.8, font: 'ui', color: s.c('purple') });
      });
    });
  },
};

export const scenesC: Record<string, SceneDef> = { embed, unembed, tying, outro };
