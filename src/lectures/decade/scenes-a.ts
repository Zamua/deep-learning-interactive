import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { LANES, MILESTONES, laneOf } from '../../lib/decade-timeline';
import { type K, PIC, box, photo, pill, pillWidth, tokens } from './kit';

/** Pills laid out in centered rows no wider than `maxW`; returns the height used. */
export function flowPills(s: Scene, items: { text: string; k: K; on?: number; dashed?: boolean }[], cx: number, y: number, maxW: number, size = 3.2): number {
  const gap = s.u * 1.4;
  const rows: { text: string; k: K; on?: number; dashed?: boolean; w: number }[][] = [[]];
  let used = 0;
  for (const it of items) {
    const pw = pillWidth(s, it.text, size);
    if (used > 0 && used + gap + pw > maxW) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1]!.push({ ...it, w: pw });
    used += (used > 0 ? gap : 0) + pw;
  }
  const rh = s.u * size * 2.3;
  rows.forEach((row, ri) => {
    const tw = row.reduce((a, r) => a + r.w, 0) + gap * (row.length - 1);
    let x = cx - tw / 2;
    for (const r of row) {
      pill(s, r.text, x, y + ri * rh, r.k, { size, align: 'left', on: r.on, dashed: r.dashed });
      x += r.w + gap;
    }
  });
  return rows.length * rh;
}

// ---------------------------------------------------------------- intro

const SHIFTS: { beat: string; title: string; sub: string; k: K }[] = [
  { beat: 'arch', title: 'one architecture', sub: 'attention, for text, images and more', k: 'blue' },
  { beat: 'scale', title: 'scale', sub: 'pretrained on trillions of tokens', k: 'orange' },
  { beat: 'feedback', title: 'feedback', sub: 'people, then programs, grade answers', k: 'green' },
];
const KEPT = ['backprop', 'Adam', 'softmax', 'residuals', 'normalization'];

export const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const lift = s.ease('where', 0.9);
    const ty = lerp(h * 0.42, u * 8, lift);
    s.text('A Decade Later', w / 2, ty, { size: lerp(10, 6, lift), font: 'display', weight: 600 });
    s.alpha(1 - lift, () => s.text('deep learning, 2016 to 2026', w / 2, ty + u * 9, { size: 4, italic: true, color: s.c('--ink-2') }));

    const tall = s.tall;
    const pad = u * 5;
    const gap = u * 4;
    const top = u * 15;
    const barH = u * 8;
    const pw = tall ? w - 2 * pad : (w - 2 * pad - gap) / 2;
    const ph = tall ? (h - top - gap - barH - u * 2) / 2 : h - top - barH - u * 6;
    const L = { x: pad, y: top };
    const R = tall ? { x: pad, y: top + ph + gap } : { x: pad + pw + gap, y: top };

    // 2016: a model per task.
    s.alpha(s.ease('where', 0.6, 0.4), () => {
      s.rrect(L.x, L.y, pw, ph, 2.4, { fill: s.tint('slate', 0.06), stroke: s.tint('slate', 0.4), lw: 0.3 });
      s.text('2016', L.x + u * 3, L.y + u * 5, { size: 5, font: 'display', weight: 600, align: 'left', color: s.c('--ink-2') });
      s.text('one model per task', L.x + pw - u * 3, L.y + u * 5, { size: 3.2, italic: true, align: 'right', color: s.c('--ink-2') });
      const rowA = s.ease('old', 0.6);
      const rowB = s.ease('old', 0.6, 1.2);
      const ar = s.c('--ink-3');
      if (pw / u >= 70) {
        // Wide panel: input, model and output in a row.
        const sz = Math.min(ph * 0.26, u * 13);
        const y1 = L.y + ph * 0.3;
        const y2 = L.y + ph * 0.66;
        const inW = Math.max(sz, s.measure('the cat sat', { font: 'mono', size: 3.3 }));
        const outW = s.measure('“house”', { font: 'mono', size: 3.4 });
        const bw = Math.min(pw * 0.3, u * 24);
        const bx = Math.max(L.x + pw * 0.5 - bw / 2, L.x + u * 4 + inW + u * 6);
        const outX = L.x + pw - u * 3;
        const arrowEnd = outX - outW - u * 1.5;
        const row = (y: number, inEnd: number, name: string, out: string) => {
          s.arrow(inEnd + u, y, bx - u * 1.2, y, ar, 0.35, 2);
          box(s, bx, y - u * 4.5, bw, u * 9, name, 'slate', { on: 0.4 });
          s.arrow(bx + bw + u * 1.2, y, arrowEnd, y, ar, 0.35, 2);
          s.text(out, outX, y, { size: 3.4, font: 'mono', align: 'right' });
        };
        s.alpha(rowA, () => {
          photo(s, L.x + u * 4, y1, sz, PIC);
          row(y1 + sz / 2, L.x + u * 4 + sz, 'ConvNet', '“house”');
        });
        s.alpha(rowB, () => {
          s.text('the cat sat', L.x + u * 4, y2 + sz / 2, { size: 3.3, font: 'mono', align: 'left' });
          row(y2 + sz / 2, L.x + u * 4 + s.measure('the cat sat', { font: 'mono', size: 3.3 }), 'LSTM', '“on”');
        });
      } else {
        // Narrow panel: two columns, top to bottom.
        const sz = Math.min(u * 12, ph * 0.2);
        const inY = L.y + u * 10 + sz / 2;
        const boxY = L.y + ph * 0.55;
        const outY = L.y + ph - u * 6;
        const bw = Math.min(pw * 0.4, u * 22);
        const col = (cx: number, a: number, input: () => void, name: string, out: string) =>
          s.alpha(a, () => {
            input();
            s.arrow(cx, inY + sz / 2 + u, cx, boxY - u * 5.5, ar, 0.35, 2);
            box(s, cx - bw / 2, boxY - u * 4.5, bw, u * 9, name, 'slate', { on: 0.4 });
            s.arrow(cx, boxY + u * 5.5, cx, outY - u * 3, ar, 0.35, 2);
            s.text(out, cx, outY, { size: 3.4, font: 'mono' });
          });
        const c1 = L.x + pw * 0.27;
        const c2 = L.x + pw * 0.73;
        col(c1, rowA, () => photo(s, c1 - sz / 2, inY - sz / 2, sz, PIC), 'ConvNet', '“house”');
        col(c2, rowB, () => s.text('the cat sat', c2, inY, { size: 3.3, font: 'mono' }), 'LSTM', '“on”');
      }
    });

    // 2026: three shifts.
    s.alpha(s.ease('since', 0.6), () => {
      s.rrect(R.x, R.y, pw, ph, 2.4, { fill: s.tint('--accent', 0.04), stroke: s.tint('--accent', 0.35), lw: 0.3 });
      s.text('2026', R.x + u * 3, R.y + u * 5, { size: 5, font: 'display', weight: 600, align: 'left', color: s.c('--ink-2') });
      s.text('three shifts', R.x + pw - u * 3, R.y + u * 5, { size: 3.2, italic: true, align: 'right', color: s.c('--ink-2') });
      const cTop = R.y + u * 10;
      const cg = u * 2;
      const chh = (ph - u * 12 - 2 * cg) / 3;
      SHIFTS.forEach((sh, i) => {
        const a = s.ease(sh.beat, 0.6);
        const live = s.since(sh.beat) >= 0 && (i === 2 || s.since(SHIFTS[i + 1]!.beat) < 0) && s.since('same') < 0;
        s.alpha(a, () => {
          const y = cTop + i * (chh + cg);
          s.rrect(R.x + u * 3, y, pw - u * 6, chh, 1.8, { fill: s.tint(sh.k, live ? 0.22 : 0.1), stroke: s.tint(sh.k, live ? 1 : 0.55), lw: live ? 0.5 : 0.3 });
          const two = chh > u * 10;
          s.text(`${i + 1}. ${sh.title}`, R.x + u * 6, y + (two ? chh * 0.36 : chh / 2), { size: 3.8, weight: 650, font: 'ui', align: 'left', color: s.c(sh.k) });
          if (two) s.text(sh.sub, R.x + u * 6, y + chh * 0.7, { size: 3.1, italic: true, align: 'left', color: s.c('--ink-2') });
        });
      });
    });

    // Underneath: what carried over.
    const by = tall ? R.y + ph + u * 5 : h - u * 7;
    s.alpha(s.ease('same', 0.7), () => {
      flowPills(s, KEPT.map((t) => ({ text: t, k: 'blue' as K, on: 0.3 })), w / 2, by, w - u * 6, 2.9);
    });
  },
};

// ---------------------------------------------------------------- the decade at a glance

const YRS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const YBEAT = (y: number) => `y${String(y).slice(2)}`;
const laneIdx = (id: string) => LANES.findIndex((l) => l.id === id);
const BY_YEAR = YRS.map((y) => MILESTONES.filter((m) => m.year === y).sort((a, b) => laneIdx(a.lane) - laneIdx(b.lane)));
const MAIN = new Set(['attn', 'scale', 'post']);

export const decade: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const pad = u * 5;
    const threads = s.ease('threads', 0.7);
    // Legend.
    const lh = flowPills(
      s,
      LANES.map((l) => ({ text: l.label, k: l.color, on: threads * (MAIN.has(l.id) ? 1 : 0) })),
      w / 2,
      u * 6,
      w - 2 * pad,
      3,
    );
    const top = u * 6 + lh;
    const colW = (w - 2 * pad) / YRS.length;
    const maxStack = Math.max(...BY_YEAR.map((a) => a.length));
    const r = Math.min(u * 2.1, colW * 0.2);
    const step = 2 * r + u * 0.9;
    const axisY = top + maxStack * step + u * 2;
    const ids = YRS.map(YBEAT);
    let cur = -1;
    ids.forEach((id, k) => {
      if (s.since(id) >= 0) cur = k;
    });
    if (s.since('threads') >= 0) cur = -1;
    const base = s.ease('start', 0.8);
    s.alpha(base, () => {
      s.line(pad, axisY, w - pad, axisY, s.c('--axis'), 0.25);
      YRS.forEach((y, k) => {
        const cx = pad + (k + 0.5) * colW;
        const on = k === cur;
        if (on) s.rrect(cx - colW / 2 + u * 0.3, top - u * 2, colW - u * 0.6, axisY - top + u * 8, 1.6, { fill: s.tint('--accent', 0.12), stroke: s.tint('--accent', 0.5), lw: 0.25 });
        const lit = s.ease(ids[k]!, 0.5);
        s.text(colW < u * 11 ? `’${String(y).slice(2)}` : String(y), cx, axisY + u * 3.4, { font: 'mono', size: 3, weight: on ? 700 : 500, color: s.c(on ? '--ink' : '--ink-3') });
        BY_YEAR[k]!.forEach((m, j) => {
          const cy = axisY - u * 1.4 - r - j * step;
          const dim = threads > 0 && !MAIN.has(m.lane) ? 1 - 0.7 * threads : 1;
          s.alpha((0.22 + 0.78 * lit) * dim, () => s.circle(cx, cy, on ? r * 1.15 : r, { fill: s.c(laneOf(m.lane).color) }));
        });
      });
    });
    // The current year's milestones.
    if (cur >= 0) {
      const id = ids[cur]!;
      const a = s.ease(id, 0.5) * (cur === ids.length - 1 ? 1 - threads : 1 - s.ease(ids[cur + 1] ?? 'threads', 0.3));
      s.alpha(a, () => {
        const y0 = axisY + u * 10;
        s.text(String(YRS[cur]), w / 2, y0, { size: 5.4, font: 'display', weight: 600 });
        flowPills(
          s,
          BY_YEAR[cur]!.map((m) => ({ text: m.short, k: laneOf(m.lane).color, on: 0.5 })),
          w / 2,
          y0 + u * 8,
          w - 2 * pad,
          3.3,
        );
      });
    }
    s.alpha(threads, () => {
      const y0 = axisY + u * 11;
      s.text('three threads', w / 2, y0, { size: 5, font: 'display', weight: 600 });
      flowPills(
        s,
        [
          { text: 'attention', k: 'blue', on: 1 },
          { text: 'scale', k: 'orange', on: 1 },
          { text: 'feedback', k: 'green', on: 1 },
        ],
        w / 2,
        y0 + u * 8,
        w - 2 * pad,
        3.8,
      );
    });
  },
};

// ---------------------------------------------------------------- recurrence to attention

const WORDS = ['the', 'cat', 'sat', 'on', 'the', 'mat'];

export const attention: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cw = Math.min(u * 13, (w - u * 14) / 6.4);
    const ch = u * 7;
    const ty = u * 26;
    const rnnA = s.win('rnn', 'paper');
    const attA = s.ease('paper', 0.6);
    const tk = tokens(s, WORDS, w / 2, ty, cw, ch, 'orange', (i) => {
      if (rnnA > 0.5 && s.since('paper') < 0) {
        const k = Math.floor(s.since('rnn') * 1.3) % 8;
        return k === i ? 1 : 0;
      }
      return 0;
    });
    const cx = (i: number) => tk.x0 + i * tk.cw + cw / 2;

    // The recurrent network: one step at a time.
    s.alpha(rnnA, () => {
      const hy = ty + ch + u * 12;
      const hr = Math.min(u * 3.6, cw * 0.32);
      const k = Math.floor(s.since('rnn') * 1.3) % 8;
      for (let i = 0; i < 6; i++) {
        const done = i <= k;
        s.arrow(cx(i), ty + ch + u * 1, cx(i), hy - hr - u * 0.6, s.tint('--ink-3', 0.7), 0.3, 1.6);
        if (i < 5) s.arrow(cx(i) + hr + u * 0.4, hy, cx(i + 1) - hr - u * 0.6, hy, s.tint('teal', done ? 0.9 : 0.3), 0.35, 1.8);
        s.circle(cx(i), hy, hr, { fill: s.tint('teal', done ? 0.35 : 0.06), stroke: s.tint('teal', i === k ? 1 : 0.5), lw: i === k ? 0.55 : 0.3 });
        s.text(`h${i + 1}`, cx(i), hy + u * 0.2, { font: 'mono', size: 2.9, weight: 600 });
      }
      s.alpha(s.win('slow', 'far'), () => s.text(`step ${Math.min(6, k + 1)} waits for step ${Math.max(0, k)}`, w / 2, hy + hr + u * 7, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      s.alpha(s.ease('far', 0.6), () => {
        const yA = hy + hr + u * 2;
        s.ctx.beginPath();
        s.ctx.moveTo(cx(0), yA);
        s.ctx.quadraticCurveTo((cx(0) + cx(5)) / 2, yA + u * 10, cx(5), yA);
        s.ctx.strokeStyle = s.c('red');
        s.ctx.lineWidth = u * 0.45;
        s.ctx.stroke();
        s.text('5 steps from the first word to the last', w / 2, yA + u * 10, { size: 3.4, color: s.c('red'), halo: true });
      });
    });

    // Attention: every token to every token, all at once.
    s.alpha(attA, () => {
      s.text('Attention Is All You Need', w / 2, u * 7, { size: 4.8, font: 'display', italic: true, weight: 600 });
      s.text('Vaswani et al., Google, 2017', w / 2, u * 12.5, { size: 3.1, color: s.c('--ink-2') });
      const g = s.ease('all', 1.2);
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 6; j++) {
          if (i === j) continue;
          const x0 = cx(i);
          const x1 = cx(j);
          const hgt = Math.abs(j - i) * u * 1.4 + u * 1.2;
          s.ctx.beginPath();
          s.ctx.moveTo(x0, ty - u * 0.5);
          s.ctx.quadraticCurveTo((x0 + x1) / 2, ty - u * 0.5 - hgt * 2 * g, x1, ty - u * 0.5);
          s.ctx.strokeStyle = s.tint('purple', 0.22 * g);
          s.ctx.lineWidth = u * 0.3;
          s.ctx.stroke();
        }
      s.alpha(s.ease('all', 0.6), () => s.text('all pairs, one matrix multiply', w / 2, ty + ch + u * 5, { size: 3.4, italic: true, color: s.c('purple') }));
      // The block.
      s.alpha(s.ease('block', 0.7), () => {
        const bw = Math.min(w - u * 16, u * 70);
        const bx = w / 2 - bw / 2;
        const by = ty + ch + u * 9;
        const rowH = Math.min(u * 7.4, (h - by - u * 20) / 4 - u * 1.4);
        const rows: [string, K][] = [
          ['norm, then attention', 'purple'],
          ['+ residual', 'blue'],
          ['norm, then MLP', 'blue'],
          ['+ residual', 'blue'],
        ];
        const bh = rows.length * (rowH + u * 1.4) + u * 8;
        s.ctx.save();
        s.ctx.setLineDash([u * 1, u * 0.8]);
        s.rrect(bx, by, bw, bh, 2.2, { stroke: s.tint('--ink-3', 0.8), lw: 0.3 });
        s.ctx.restore();
        s.text('Transformer block, × N', bx + u * 2.5, by + u * 4, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
        rows.forEach(([lab, k], i) => box(s, bx + u * 3, by + u * 7.5 + i * (rowH + u * 1.4), bw - u * 6, rowH, lab, k, { on: 0.3 }));
      });
      const fy = h - u * 5.5;
      s.alpha(s.win('faster', 'spread'), () => flowPills(s, [{ text: 'trains faster', k: 'green', on: 0.4 }, { text: 'translates better', k: 'green', on: 0.4 }], w / 2, fy, w - u * 10, 3.4));
      s.alpha(s.ease('spread', 0.6), () =>
        flowPills(
          s,
          [
            { text: '2018: GPT and BERT, on text', k: 'blue', on: 0.4 },
            { text: '2020: ViT, on images', k: 'teal', on: 0.4 },
          ],
          w / 2,
          fy,
          w - u * 10,
          3.4,
        ),
      );
    });
  },
};

// ---------------------------------------------------------------- one softmax, two jobs

const WR = [
  [1.6, 0.5],
  [-0.5, 1.5],
  [-1.1, -1.2],
];
const CLS = ['cat', 'dog', 'ship'];
const TOK = ['the', 'cat', 'sat'];
const smax = (v: number[]) => {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / z);
};

export const softmax: SceneDef = {
  draw(s) {
    const { w, h, u, t } = s;
    const size = Math.min(h * 0.66, w * 0.42);
    const px0 = u * 4;
    const py0 = Math.max(u * 9, (h - size) / 2 - u * 2);
    const k = size / 4.6;
    const ox = px0 + size / 2;
    const oy = py0 + size / 2;
    const X = (v: number) => ox + v * k;
    const Y = (v: number) => oy - v * k;
    const att = s.ease('att', 0.8);
    const sq = s.ease('sqrt', 0.8);
    const wig = s.ease('keys', 0.8);
    // Keys depend on the sentence: in the last beat they drift.
    const rows = WR.map((r, j) => {
      const th = wig * 0.35 * Math.sin(t * 1.4 + j * 2.1);
      return [r[0]! * Math.cos(th) - r[1]! * Math.sin(th), r[0]! * Math.sin(th) + r[1]! * Math.cos(th)];
    });
    const ang = 0.4 + t * 0.22;
    const q = [1.25 * Math.cos(ang), 1.25 * Math.sin(ang)];

    s.rrect(px0, py0, size, size, 2, { fill: s.c('--paper'), stroke: s.c('--rule'), lw: 0.25 });
    for (let g = -2; g <= 2; g++) {
      s.line(X(g), py0 + u, X(g), py0 + size - u, s.c(g === 0 ? '--axis' : '--grid'), 0.2);
      s.line(px0 + u, Y(g), px0 + size - u, Y(g), s.c(g === 0 ? '--axis' : '--grid'), 0.2);
    }
    rows.forEach((r, j) => {
      s.arrow(X(0), Y(0), X(r[0]!), Y(r[1]!), s.c('blue'), 0.5, 2.6);
      const len = Math.hypot(r[0]!, r[1]!);
      const lx = X(r[0]! + (r[0]! / len) * 0.36);
      const ly = Y(r[1]! + (r[1]! / len) * 0.3);
      s.alpha(1 - att, () => s.text(CLS[j]!, lx, ly, { size: 3.4, weight: 650, font: 'ui', color: s.c('blue'), halo: true }));
      s.alpha(att, () => s.text(`“${TOK[j]}”`, lx, ly, { size: 3.4, weight: 650, font: 'ui', color: s.c('blue'), halo: true }));
    });
    s.circle(X(q[0]!), Y(q[1]!), u * 1.6, { fill: s.c('orange'), stroke: s.c('--paper'), lw: 0.4 });
    s.alpha(1 - att, () => s.text('x', X(q[0]!) + u * 3, Y(q[1]!) - u * 2.6, { size: 4.6, italic: true, weight: 600, color: s.c('orange'), halo: true }));
    s.alpha(att, () => s.text('q', X(q[0]!) + u * 3, Y(q[1]!) - u * 2.6, { size: 4.6, italic: true, weight: 600, color: s.c('orange'), halo: true }));
    s.alpha(1 - att, () => s.text('rows of W: one per class', px0, py0 - u * 3.4, { size: 3, font: 'ui', weight: 600, align: 'left', color: s.c('blue') }));
    s.alpha(att, () => s.text('rows of K: one per token', px0, py0 - u * 3.4, { size: 3, font: 'ui', weight: 600, align: 'left', color: s.c('blue') }));

    // Scores and softmax.
    const sc = rows.map((r) => r[0]! * q[0]! + r[1]! * q[1]!);
    const scale = lerp(1, 1 / Math.SQRT2, sq);
    const pr = smax(sc.map((v) => v * scale));
    const bx0 = px0 + size + u * 5;
    const bw = w - bx0 - u * 3;
    const by0 = py0;
    s.alpha(s.ease('cls', 0.6), () => {
      s.alpha(1 - att, () => s.text('p = softmax(W x)', bx0, by0, { font: 'mono', size: 3.4, weight: 600, align: 'left', color: s.c('green') }));
      s.alpha(att, () => s.text(sq > 0.5 ? 'a = softmax(K q / √d)' : 'a = softmax(K q)', bx0, by0, { font: 'mono', size: 3.4, weight: 600, align: 'left', color: s.c('green') }));
      const nameW = u * 11;
      const barX = bx0 + nameW;
      const barW = bw - nameW - u * 10;
      pr.forEach((v, j) => {
        const y = by0 + u * 6 + j * u * 7;
        s.alpha(1 - att, () => s.text(CLS[j]!, bx0, y, { size: 3.3, font: 'ui', weight: 600, align: 'left', color: s.c('blue') }));
        s.alpha(att, () => s.text(`“${TOK[j]}”`, bx0, y, { size: 3.3, font: 'ui', weight: 600, align: 'left', color: s.c('blue') }));
        const soft = s.ease('soft', 0.6);
        s.rrect(barX, y - u * 2, barW, u * 4, 1, { fill: s.tint('green', 0.08), stroke: s.tint('green', 0.35), lw: 0.2 });
        s.alpha(soft, () => {
          s.rrect(barX, y - u * 2, Math.max(u * 0.6, barW * v), u * 4, 1, { fill: s.tint('green', 0.75) });
          s.text(`${Math.round(v * 100)}%`, barX + barW + u * 1.5, y + u * 0.2, { font: 'mono', size: 3, align: 'left' });
        });
        s.alpha(1 - soft, () => s.text(`s = ${(sc[j]! * scale).toFixed(2)}`, barX + u * 2, y + u * 0.2, { font: 'mono', size: 3, align: 'left', color: s.c('purple') }));
      });
      // The values, blended by the weights.
      s.alpha(s.ease('out', 0.7), () => {
        const y = by0 + u * 30;
        const vw = Math.min(u * 13, (bw - u * 20) / 3);
        const outX = bx0 + bw - u * 9;
        TOK.forEach((tkn, j) => {
          const vx = bx0 + j * (vw + u * 2.5);
          s.rrect(vx, y - u * 3, vw, u * 6, 1.2, { fill: s.tint('gold', 0.15 + 0.5 * pr[j]!), stroke: s.tint('gold', 0.8), lw: 0.25 });
          s.text(`v ${tkn}`, vx + vw / 2, y + u * 0.2, { font: 'mono', size: 2.9, weight: 600 });
          s.arrow(vx + vw / 2, y + u * 3.4, outX, y + u * 10, s.tint('gold', 0.3 + 0.7 * pr[j]!), 0.15 + 1.1 * pr[j]!, 1.8);
        });
        s.rrect(outX - u * 7, y + u * 10, u * 14, u * 6, 1.2, { fill: s.tint('gold', 0.3), stroke: s.c('gold'), lw: 0.35 });
        s.text('out', outX, y + u * 13.2, { font: 'mono', size: 3.2, weight: 650 });
      });
    });
    s.alpha(s.ease('keys', 0.7), () => {
      s.text('K = X W_K: new keys for every sentence', px0, py0 + size + u * 5, { size: 3.2, italic: true, align: 'left', color: s.c('--ink-2'), halo: true });
    });
  },
};

// ---------------------------------------------------------------- images become tokens

const CAPS = ['a house', 'a dog', 'the sea'];

export const images: SceneDef = {
  draw(s) {
    const { w, h, u, t } = s;
    const tall = s.tall;
    const imgA = 1 - s.ease('same', 0.6);
    const size = Math.min(tall ? w * 0.42 : h * 0.42, u * 46);
    const ix = w / 2 - size / 2;
    const iy = u * 9;
    // A ConvNet slides small filters; a ViT cuts patches.
    s.alpha(imgA, () => {
      const split = s.ease('vit', 0.8);
      const fly = s.ease('vit', 1.4, 1.2);
      s.alpha(1 - fly * 0.7, () => photo(s, ix, iy, size, PIC, { split }));
      s.alpha(s.win('conv', 'vit'), () => {
        const cs = size / 8;
        const k = Math.floor(s.since('conv') * 1.6) % 36;
        const fx = (k % 6) * cs;
        const fy = Math.floor(k / 6) * cs;
        s.rrect(ix + fx, iy + fy, cs * 3, cs * 3, 0.6, { stroke: s.c('--ink'), lw: 0.55 });
        s.text('a ConvNet: small filters slide over the image', w / 2, iy + size + u * 6, { size: 3.4, italic: true, color: s.c('--ink-2') });
      });
      // Patches fly into a row of tokens.
      const n = 16;
      const tw = Math.min((w - u * 10) / 16.6, u * 7);
      const rowX = w / 2 - (n * tw + (n - 1) * u * 0.5) / 2;
      const rowY = iy + size + u * 12;
      if (split > 0) {
        const cs = size / 4;
        for (let pi = 0; pi < 4; pi++)
          for (let pj = 0; pj < 4; pj++) {
            const idx = pi * 4 + pj;
            const f = clamp01(fly * 1.6 - idx * 0.04);
            const x0 = ix + pj * (cs + split * u * 1.2) - split * u * 1.8;
            const y0 = iy + pi * (cs + split * u * 1.2) - split * u * 1.8;
            const x1 = rowX + idx * (tw + u * 0.5);
            const y1 = rowY;
            const sz = lerp(cs, tw, f);
            if (f <= 0) continue;
            const sub = PIC.slice(pi * 2, pi * 2 + 2).map((r) => r.slice(pj * 2, pj * 2 + 2));
            photo(s, lerp(x0, x1, f), lerp(y0, y1, f), sz, sub);
            if (f > 0.98) s.rrect(x1, y1, tw, tw, 0.5, { stroke: s.tint('teal', 0.9), lw: 0.25 });
          }
        s.alpha(s.ease('vit', 0.6, 2.4), () => s.text('each patch becomes a token', w / 2, rowY + tw + u * 5, { size: 3.4, italic: true, color: s.c('teal') }));
      }
      s.alpha(s.ease('data', 0.6), () =>
        flowPills(s, [{ text: 'must learn what a ConvNet assumes', k: 'slate', on: 0.3 }, { text: 'needs more data', k: 'slate', on: 0.3 }], w / 2, rowY + tw + u * 13, w - u * 10, 3.2),
      );
    });

    // Same block for text and pixels.
    s.alpha(s.win('same', 'clip'), () => {
      const bw = Math.min(w - u * 20, u * 60);
      const by = h * 0.42;
      box(s, w / 2 - bw / 2, by, bw, u * 12, 'transformer', 'blue', { on: 0.5, size: 4.2 });
      const tw = Math.min(u * 6, (w - u * 12) / 18);
      const ry = by - u * 18;
      for (let i = 0; i < 8; i++) {
        const sub = PIC.slice(Math.floor(i / 4) * 2 + 2, Math.floor(i / 4) * 2 + 4).map((r) => r.slice((i % 4) * 2, (i % 4) * 2 + 2));
        photo(s, w / 2 + u * 2 + i * (tw + u * 0.4), ry, tw, sub);
      }
      const words = ['a', 'photo', 'of', 'a', 'house'];
      let x = w / 2 - u * 2;
      for (let i = words.length - 1; i >= 0; i--) {
        const ww = s.measure(words[i]!, { font: 'mono', size: 3 }) + u * 2;
        x -= ww;
        s.rrect(x, ry, ww - u * 0.4, tw, 0.6, { fill: s.tint('orange', 0.15), stroke: s.tint('orange', 0.7), lw: 0.2 });
        s.text(words[i]!, x + (ww - u * 0.4) / 2, ry + tw / 2 + u * 0.2, { font: 'mono', size: 3 });
      }
      s.arrow(w / 2, ry + tw + u * 1.5, w / 2, by - u * 1.2, s.c('--ink-3'), 0.4, 2.2);
      s.text('text tokens and image tokens, one model', w / 2, by + u * 19, { size: 3.4, italic: true, color: s.c('--ink-2') });
    });

    // CLIP: a shared space.
    s.alpha(s.ease('clip', 0.6), () => {
      const side = Math.min(tall ? w - u * 14 : h * 0.72, u * 80);
      const sx = w / 2 - side / 2;
      const sy = tall ? u * 8 : h / 2 - side / 2;
      s.rrect(sx, sy, side, side, 2, { fill: s.c('--paper'), stroke: s.c('--rule'), lw: 0.25 });
      s.text('one shared space', sx + u * 2.5, sy + u * 4, { size: 3.1, weight: 600, font: 'ui', align: 'left', color: s.c('--ink-2') });
      const pull = s.ease('clip', 2.2, 0.8);
      const homes = [
        [0.28, 0.35],
        [0.72, 0.32],
        [0.5, 0.75],
      ];
      const startImg = [
        [0.15, 0.8],
        [0.85, 0.75],
        [0.2, 0.2],
      ];
      const startTxt = [
        [0.7, 0.15],
        [0.1, 0.55],
        [0.66, 0.5],
      ];
      const zero = s.ease('zero', 0.6);
      homes.forEach((hm, j) => {
        const ixp = sx + side * lerp(startImg[j]![0]!, hm[0]! - 0.05, pull);
        const iyp = sy + side * lerp(startImg[j]![1]!, hm[1]! + 0.03, pull);
        const ps = u * 7;
        const txp = lerp(sx + side * startTxt[j]![0]!, ixp + ps / 2 + u * 1.5, pull);
        const typ = lerp(sy + side * startTxt[j]![1]!, iyp, pull);
        if (j === 0) photo(s, ixp - ps / 2, iyp - ps / 2, ps, PIC);
        else s.rrect(ixp - ps / 2, iyp - ps / 2, ps, ps, 0.6, { fill: s.tint(j === 1 ? 'gold' : 'blue', 0.55), stroke: s.c('--rule'), lw: 0.2 });
        if (j === 0 && zero > 0) s.rrect(ixp - ps / 2 - u, iyp - ps / 2 - u, ps + 2 * u, ps + 2 * u, 1, { stroke: s.tint('--accent', zero), lw: 0.45 });
        s.text(CAPS[j]!, txp, typ, { size: 3.3, font: 'mono', weight: 600, align: 'left', color: s.c('orange'), halo: true });
      });
      s.alpha(s.win('zero', 'shared'), () => {
        const y = sy + side + u * 6;
        if (y < h - u * 4) s.text('closest caption: “a house”', w / 2, y, { size: 3.4, italic: true, color: s.c('--accent') });
      });
      void t;
    });
    s.alpha(s.ease('shared', 0.6), () => {
      const y = h - u * 5;
      s.text('one architecture, many kinds of data', w / 2, y, { size: 3.6, weight: 600, font: 'ui', color: s.c('blue'), halo: true });
    });
  },
};
