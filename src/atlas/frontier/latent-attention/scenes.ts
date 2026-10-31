import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { sub } from '../../transformers/draw';

const H = 4;
const DH = 8;
const DC = 16;

interface Part {
  n: number;
  label: string;
  k: Ink;
  on?: number;
}

/** Cached numbers as a run of chips, one per part, `per` stage units per number, starting at x0. Returns the right edge. */
function run(s: Scene, x0: number, y: number, parts: Part[], per: number, o: { h?: number; size?: number } = {}): number {
  const h = (o.h ?? 6.5) * s.u;
  let x = x0;
  for (const p of parts) {
    const w = p.n * per * s.u;
    s.cell(x + 0.25 * s.u, y - h / 2, w - 0.5 * s.u, h, w > 5 * s.u ? p.label : '', p.k, { on: p.on ?? 0, size: o.size ?? 2.8 });
    x += w;
  }
  return x;
}

const kv = (heads: string[], on = 0): Part[] => heads.flatMap((n) => [
  { n: DH, label: `k${n}`, k: 'purple' as Ink, on },
  { n: DH, label: `v${n}`, k: 'gold' as Ink, on },
]);

const txt = (s: Scene, t: string, x: number, y: number, k: Ink = '--ink-2', o: { size?: number; align?: CanvasTextAlign; weight?: number; font?: 'mono' | 'serif' } = {}) =>
  s.text(t, x, y, { size: o.size ?? 3.3, font: o.font ?? 'mono', weight: o.weight ?? 600, align: o.align ?? 'center', color: s.c(k), halo: true });

const Y = (s: Scene, f: number) => f * s.h;

/** A filled quadrilateral: a funnel from the segment [a0, a1] at y0 to [b0, b1] at y1. */
function funnel(s: Scene, a0: number, a1: number, y0: number, b0: number, b1: number, y1: number, k: Ink, on: number) {
  const c = s.ctx;
  c.beginPath();
  c.moveTo(a0, y0);
  c.lineTo(a1, y0);
  c.lineTo(b1, y1);
  c.lineTo(b0, y1);
  c.closePath();
  c.fillStyle = s.tint(k, 0.08 + 0.2 * on);
  c.fill();
  c.strokeStyle = s.tint(k, 0.45 + 0.5 * on);
  c.lineWidth = (0.3 + 0.15 * on) * s.u;
  c.stroke();
}

// ---- scene 1: the cache grows with every token; sharing shrinks it

const WORDS = ['the', 'cat', 'sat', 'on', 'the', 'mat', 'and'];
/** Rows of key-value blocks per token, in head rows: multi-head, multi-query, grouped with g = 2. */
const ROWS = [[0, 1, 2, 3], [1.5], [0.5, 2.5]];
/** Which block row head r reads, per scheme. */
const READS = [(r: number) => r, () => 1.5, (r: number) => (r < 2 ? 0.5 : 2.5)];

const cache: SceneDef = {
  draw(s) {
    const u = s.u;
    const pitch = (s.tall ? 11.5 : 13) * u;
    const span = (WORDS.length - 1) * pitch;
    const x0 = s.w / 2 - (span - 16 * u) / 2;
    const y0 = Y(s, 0.12);
    const rowH = 7 * u;
    const cw = 4.4 * u;
    const ch = 4.6 * u;
    const ry = (r: number) => y0 + r * rowH;
    const q = s.ease('mqa', 0.9, 1.2);
    const g = s.ease('gqa', 0.9, 1.2);
    const mode = [1 - q, q * (1 - g), g];
    const grown = (i: number) => after(s, 'grow', 0.05 + 0.07 * i, 0.4);
    // Head labels, wired to the block each head reads in the first token's column.
    s.alpha(s.ease('grow', 0.6), () => {
      for (let r = 0; r < H; r++) {
        const lx = x0 - cw - 5 * u;
        txt(s, `head ${r}`, lx, ry(r), '--ink-2', { size: 3, align: 'right', weight: 500 });
        mode.forEach((m, k) => s.alpha(m, () => s.line(lx + 0.8 * u, ry(r), x0 - cw - 0.6 * u, ry(READS[k]!(r)), s.tint('--ink-3', 0.8), 0.3)));
      }
    });
    WORDS.forEach((w, i) => {
      const x = x0 + i * pitch;
      s.alpha(grown(i), () => {
        mode.forEach((m, k) => s.alpha(m, () => ROWS[k]!.forEach((r) => {
          const hot = i === WORDS.length - 1 ? s.win('mha', 'mqa') : 0;
          s.cell(x - cw, ry(r) - ch / 2, cw - 0.3 * u, ch, 'k', 'purple', { on: 0.2 + 0.6 * hot, size: 2.6 });
          s.cell(x + 0.3 * u, ry(r) - ch / 2, cw - 0.3 * u, ch, 'v', 'gold', { on: 0.2 + 0.6 * hot, size: 2.6 });
        })));
        txt(s, w, x, ry(3) + 6.4 * u, 'orange', { size: 3, weight: 500 });
      });
    });
    const r1 = Y(s, 0.53);
    const r2 = Y(s, 0.6);
    s.alpha(after(s, 'mha', 0.55) * (1 - s.ease('mqa', 0.5)), () => txt(s, '2 × 4 × 8 = 64 numbers per token', s.w / 2, r1, 'teal', { size: 3.5, weight: 650 }));
    s.alpha(s.win('mqa', 'gqa'), () => {
      txt(s, 'multi-query: 2 × 8 = 16', s.w / 2, r1, 'teal', { size: 3.5, weight: 650 });
      txt(s, 'every head shares one key and value', s.w / 2, r2, '--ink-3', { size: 3, weight: 500 });
    });
    s.alpha(s.ease('gqa', 0.6), () => {
      txt(s, 'grouped-query, g = 2: 2 × 2 × 8 = 32', s.w / 2, r1, 'teal', { size: 3.5, weight: 650 });
      txt(s, 'each pair of heads shares one', s.w / 2, r2, '--ink-3', { size: 3, weight: 500 });
    });
    s.alpha(s.ease('ask', 0.6), () => {
      txt(s, 'smaller still, with every head', s.w / 2, Y(s, 0.72), '--ink', { size: 3.8, weight: 600, font: 'serif' });
      txt(s, 'keeping its own key and value?', s.w / 2, Y(s, 0.79), '--ink', { size: 3.8, weight: 600, font: 'serif' });
    });
    s.alpha(s.ease('mla', 0.6, 0.5), () => txt(s, 'multi-head latent attention', s.w / 2, Y(s, 0.9), 'green', { size: 4.2, weight: 650, font: 'serif' }));
    cite(s, 'Shazeer, 2019', s.win('mqa', 'gqa'));
    cite(s, 'Ainslie et al., 2023', s.win('gqa', 'ask'));
    cite(s, 'DeepSeek-AI, 2024', s.ease('mla', 0.6));
  },
};

// ---- scene 2: down through a narrow waist, the latent, then up to every head's key and value

const latent: SceneDef = {
  marks: {
    cx: { tex: String.raw`\sym{latent}{c} = \sym{Wdkv}{W_{DKV}}\,\symx`, x: 0.5, y: 0.74, size: 4.8 },
    store: { tex: String.raw`\text{cached per token: } \sym{latent}{c}\text{, } \sym{dc}{d_c} = 16 \text{ numbers}`, x: 0.5, y: 0.74, size: 4.4 },
    up: { tex: String.raw`\sym{k}{k}_i = \sym{Wuk}{W_{UK}}[i]\;\sym{latent}{c}`, x: 0.5, y: 0.74, size: 4.8 },
    uv: { tex: String.raw`\sym{v}{v}_i = \sym{Wuv}{W_{UV}}[i]\;\sym{latent}{c}`, x: 0.5, y: 0.74, size: 4.8 },
  },
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const yx = Y(s, 0.07);
    const yc = Y(s, 0.27);
    const yk = Y(s, 0.47);
    const yv = Y(s, 0.54);
    const cell = 2.3;
    const cwid = DC * cell * u;
    const xw = 56 * u;
    const pitch = s.tall ? 24 : 27;
    const hx = Array.from({ length: H }, (_, i) => cx + (i - (H - 1) / 2) * pitch * u);
    const kw = DH * 2.1 * u;
    const out = s.ease('count', 0.6);
    const grow = (f: number) => after(s, 'idea', f, 0.6);
    const down = s.win('down', 'dc');
    const own = s.ease('own', 0.6);
    // x, then the funnel down to c
    s.alpha(grow(0), () => s.cell(cx - xw / 2, yx - 3 * u, xw, 6 * u, 'x: d numbers', 'orange', { size: 3 }));
    s.alpha(grow(0.15), () => {
      funnel(s, cx - xw / 2, cx + xw / 2, yx + 3.6 * u, cx - cwid / 2, cx + cwid / 2, yc - 3.6 * u, 'blue', down);
      sub(s, 'W', 'DKV', cx, (yx + yc) / 2, { size: 3.4, k: 'blue', halo: true });
      s.alpha(down, () => txt(s, 'down: d → 16', cx, (yx + yc) / 2 + 4.4 * u, 'blue', { size: 2.8, weight: 500 }));
    });
    // c, the latent, in the cache
    const lit = s.win('latent', 'down');
    s.alpha(grow(0.3), () => {
      const x0 = cx - cwid / 2;
      run(s, x0, yc, Array.from({ length: DC }, () => ({ n: 1, label: '', k: 'green' as Ink, on: 0.25 + 0.6 * lit })), cell, { h: 5.5 });
      txt(s, 'c', x0 - 2.4 * u, yc, 'green', { align: 'right', size: 4, weight: 700 });
      s.alpha(s.ease('latent', 0.6, 0.6) * (1 - s.ease('dc', 0.5)), () => txt(s, 'latent: hidden', x0 + cwid + 2.4 * u, yc, 'green', { size: 2.9, align: 'left', weight: 500 }));
      s.alpha(s.ease('dc', 0.6, 0.3), () => {
        const w = sub(s, 'd', 'c', x0 + cwid + 2.4 * u, yc, { size: 3, k: 'green', align: 'left', halo: true });
        txt(s, '= 16', x0 + cwid + 3.2 * u + w, yc, 'green', { size: 3, align: 'left' });
      });
    });
    s.alpha(s.ease('dc', 0.6), () => {
      const l = cx - cwid / 2 - 6 * u;
      const r = cx + cwid / 2 + 15 * u;
      const c = s.ctx;
      c.save();
      c.setLineDash([1 * u, 0.8 * u]);
      s.rrect(l, yc - 4.6 * u, r - l, 9.2 * u, 1.6, { stroke: s.tint('teal', 0.9), lw: 0.4 });
      c.restore();
      txt(s, 'cache', l, yc - 6.4 * u, 'teal', { align: 'left', size: 2.8 });
    });
    // every head rebuilds its key and value from c
    s.alpha(grow(0.5), () => {
      hx.forEach((x, i) => {
        const keyOn = i === 0 ? Math.max(s.win('up', 'own'), own) : own;
        const valOn = i === 0 ? Math.max(s.win('uv', 'own'), own) : own;
        const fanOn = i === 0 ? Math.max(s.win('up', 'own'), own) : own;
        funnel(s, cx - 3 * u + i * 2 * u, cx - 1 * u + i * 2 * u, yc + 3.4 * u, x - kw / 2, x + kw / 2, yk - 3.2 * u, 'blue', 0.6 * fanOn);
        run(s, x - kw / 2, yk, [{ n: DH, label: `k${i}`, k: 'purple', on: 0.15 + 0.6 * keyOn }], 2.1, { h: 5.4, size: 2.7 });
        run(s, x - kw / 2, yv, [{ n: DH, label: `v${i}`, k: 'gold', on: 0.15 + 0.6 * valOn }], 2.1, { h: 5.4, size: 2.7 });
        txt(s, `head ${i}`, x, yv + 6 * u, '--ink-3', { size: 2.7, weight: 500 });
      });
    });
    s.show('cx', s.win('down', 'dc') * (1 - out));
    s.show('store', s.win('dc', 'up') * (1 - out));
    s.show('up', s.win('up', 'uv') * (1 - out));
    s.show('uv', s.win('uv', 'own') * (1 - out));
    s.alpha(own * (1 - out), () => txt(s, 'every head: its own key and value', cx, Y(s, 0.74), '--ink-2', { size: 3.4, font: 'serif' }));
    // per token, per layer: 64, 32, 16 shared, 16 own
    s.alpha(out, () => {
      const per = 0.75;
      const x0 = cx - 16 * u;
      const rows: [string, Part[], string, string][] = [
        ['multi-head', kv(['0', '1', '2', '3']), '64', ''],
        ['grouped', kv(['', '']), '32', ''],
        ['multi-query', kv(['']), '16', 'shared'],
        ['latent', [{ n: DC, label: 'c', k: 'green', on: 0.6 }], '16', 'each head its own'],
      ];
      rows.forEach(([name, parts, n, note], r) => {
        const y = Y(s, 0.68 + r * 0.075);
        const k: Ink = r === 3 ? 'green' : '--ink-2';
        s.alpha(after(s, 'count', 0.25 + 0.12 * r), () => {
          txt(s, name, x0 - 2 * u, y, k, { align: 'right', size: 2.9 });
          const end = run(s, x0, y, parts.map((p) => ({ ...p, label: '' })), per, { h: 4.4 });
          txt(s, n, end + 1.6 * u, y, k, { align: 'left', size: 3.1, weight: 650 });
          if (note) txt(s, note, end + 7 * u, y, r === 3 ? 'green' : '--ink-3', { align: 'left', size: 2.7, weight: 500 });
        });
      });
    });
  },
};

// ---- scene 3: the shapes, a row per number made and a column per number read

/** A matrix drawn to scale, `cell` stage units per entry, with its rows and columns labeled. Returns its box. */
function matrix(s: Scene, cx: number, top: number, rows: number, cols: number, cell: number, o: { name: [string, string]; rowsLab: string; colsLab: string; shape: string; band?: (r: number) => number; on?: number }) {
  const u = s.u;
  const w = cols * cell * u;
  const h = rows * cell * u;
  const x = cx - w / 2;
  const on = o.on ?? 0;
  s.rrect(x, top, w, h, 0.6, { fill: s.tint('blue', 0.1 + 0.15 * on), stroke: s.tint('blue', 0.6 + 0.4 * on), lw: 0.3 + 0.15 * on });
  if (o.band) {
    for (let r = 0; r < rows; r++) {
      const b = o.band(r);
      if (b > 0.003) s.rrect(x, top + r * cell * u, w, cell * u, 0, { fill: s.tint('purple', 0.35 * b) });
    }
  }
  for (let r = 1; r < rows; r++) s.line(x, top + r * cell * u, x + w, top + r * cell * u, s.tint('blue', 0.18), 0.15);
  for (let c = 1; c < cols; c++) s.line(x + c * cell * u, top, x + c * cell * u, top + h, s.tint('blue', 0.18), 0.15);
  sub(s, o.name[0], o.name[1], cx, top - 7.4 * u, { size: 3.4, k: 'blue' });
  txt(s, o.colsLab, cx, top - 2.6 * u, '--ink-2', { size: 2.7, weight: 500 });
  txt(s, o.rowsLab, x - 1.6 * u, top + h / 2, '--ink-2', { size: 2.7, weight: 500, align: 'right' });
  txt(s, o.shape, cx, top + h + 3.4 * u, 'blue', { size: 3.2, weight: 650 });
  return { x, top, w, h };
}

const shapes: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const cell = 1.2;
    s.alpha(s.ease('rule', 0.6), () => {
      txt(s, 'a row per number made,', cx, Y(s, 0.05), '--ink', { size: 3.4, font: 'serif', weight: 600 });
      txt(s, 'a column per number read', cx, Y(s, 0.1), '--ink', { size: 3.4, font: 'serif', weight: 600 });
    });
    s.alpha(after(s, 'rule', 0.45, 0.6), () => matrix(s, cx + 6 * u, Y(s, 0.22), DC, 32, cell, { name: ['W', 'DKV'], rowsLab: 'makes 16', colsLab: 'reads d', shape: '(16, d)', on: s.win('down', 'head') }));
    const lx = cx - (s.tall ? 22 : 26) * u;
    const rx = cx + (s.tall ? 24 : 28) * u;
    const top = Y(s, 0.52);
    const all = s.ease('all', 0.6);
    s.alpha(s.ease('head', 0.6), () => matrix(s, lx, top, DH, DC, cell, { name: ['W', 'UK[i]'], rowsLab: 'makes 8', colsLab: 'reads 16', shape: '(8, 16)', on: s.win('head', 'all') }));
    s.alpha(all, () => {
      const box = matrix(s, rx, top, H * DH, DC, cell, { name: ['W', 'UK'], rowsLab: 'makes 32', colsLab: 'reads 16', shape: '(32, 16)', on: 0.6, band: (r) => (Math.floor(r / DH) % 2 === 0 ? 0.5 : 0.2) });
      for (let i = 0; i < H; i++) txt(s, `head ${i}`, box.x + box.w + 1.6 * u, box.top + (i + 0.5) * DH * cell * u, 'purple', { size: 2.6, align: 'left', weight: 500 });
    });
  },
};

// ---- scene 4: DeepSeek-V2's numbers

const real: SceneDef = {
  draw(s) {
    const u = s.u;
    const full = (s.tall ? 84 : 110) * u;
    const x0 = s.w / 2 - full / 2;
    const bar = (y: number, n: number, k: Ink, a = 1) => s.rrect(x0, y - 2.8 * u, Math.max(0.6 * u, (n / 32768) * full * a), 5.6 * u, 1, { fill: s.tint(k, 0.3), stroke: s.tint(k, 0.9), lw: 0.3 });
    s.alpha(s.ease('big', 0.6), () => {
      txt(s, 'multi-head: 2 × 128 × 128', x0, Y(s, 0.12), '--ink-2', { align: 'left', size: 3.3 });
      bar(Y(s, 0.2), 32768, 'purple', s.ease('big', 1.2, 0.8));
      s.alpha(s.ease('big', 0.6, 2.4), () => txt(s, '32,768 numbers', s.w / 2, Y(s, 0.2), '--ink', { size: 3.4, weight: 650 }));
    });
    s.alpha(s.ease('small', 0.6), () => {
      txt(s, 'latent: 512 + 64', x0, Y(s, 0.32), 'green', { align: 'left', size: 3.3 });
      bar(Y(s, 0.4), 576, 'green');
      txt(s, '576', x0 + 4 * u, Y(s, 0.4), 'green', { align: 'left', size: 3.2, weight: 650 });
    });
    // The latent bar is too thin to read, so it is shown again, magnified.
    s.alpha(after(s, 'small', 0.35) * (1 - s.ease('paper', 0.5)), () => {
      const z = (s.tall ? 70 : 90) * u;
      const y = Y(s, 0.58);
      const w512 = (512 / 576) * z;
      const zx = s.w / 2 - z / 2;
      txt(s, 'magnified', zx, Y(s, 0.5), '--ink-3', { align: 'left', size: 2.8, weight: 500 });
      s.cell(zx, y - 3.2 * u, w512 - 0.4 * u, 6.4 * u, 'c: 512', 'green', { on: 0.4, size: 3 });
      s.cell(zx + w512 + 0.4 * u, y - 3.2 * u, z - w512 - 0.4 * u, 6.4 * u, '', 'slate', { on: 0.4 });
      txt(s, 'position key: 64, shared', zx + z, y + 6.4 * u, 'slate', { align: 'right', size: 2.9 });
    });
    s.alpha(s.ease('paper', 0.6, 0.3), () => {
      txt(s, 'cache ≈ grouped-query with 2.25 groups', s.w / 2, Y(s, 0.53), '--ink', { size: 3.4, font: 'serif' });
      txt(s, 'results: better than full multi-head', s.w / 2, Y(s, 0.6), '--ink', { size: 3.4, font: 'serif' });
    });
    s.alpha(s.ease('ratio', 0.6), () => txt(s, '32,768 / 576 ≈ 57 times smaller', s.w / 2, Y(s, 0.78), 'teal', { size: 3.8, weight: 650 }));
    s.alpha(after(s, 'ratio', 0.45), () => txt(s, '× 60 layers for the whole model', s.w / 2, Y(s, 0.86), '--ink-2', { size: 3.2, weight: 500 }));
    cite(s, 'DeepSeek-AI, 2024', s.ease('big', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { cache, latent, shapes, real };
