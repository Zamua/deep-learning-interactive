import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../../linear-algebra/draw';
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

/** A bracket under [a, b] at y with a label below it. */
function under(s: Scene, a: number, b: number, y: number, label: string): void {
  const col = s.c('--ink-3');
  s.line(a, y - 1.2 * s.u, a, y, col, 0.3);
  s.line(a, y, b, y, col, 0.3);
  s.line(b, y, b, y - 1.2 * s.u, col, 0.3);
  txt(s, label, (a + b) / 2, y + 2.8 * s.u, '--ink-3', { size: 2.7, weight: 500 });
}

// ---- scene 1: what each scheme caches per token

const cache: SceneDef = {
  draw(s) {
    const per = s.tall ? 1.25 : 1.3;
    const x0 = s.w / 2 - (64 * per * s.u) / 2;
    const own = s.ease('own', 0.6);
    s.alpha(s.ease('mha', 0.6), () => {
      txt(s, 'multi-head: h = 4 heads, each 8 wide', x0, s.h * 0.1, '--ink-2', { align: 'left', size: 3.2 });
      run(s, x0, s.h * 0.18, kv(['0', '1', '2', '3'], 0.3 * own), per);
    });
    s.alpha(s.ease('mha', 0.6, 2.5), () => txt(s, '2 × 4 × 8 = 64 numbers per token', s.w / 2, s.h * 0.27, 'teal', { size: 3.6, weight: 650 }));
    s.alpha(s.ease('gqa', 0.6), () => {
      const y = s.h * 0.43;
      txt(s, 'grouped-query: g = 2', x0, s.h * 0.35, '--ink-2', { align: 'left', size: 3.2 });
      const mid = run(s, x0, y, kv(['']), per);
      const end = run(s, mid, y, kv(['']), per);
      under(s, x0 + 0.3 * s.u, mid - 0.3 * s.u, y + 5 * s.u, 'heads 0, 1');
      under(s, mid + 0.3 * s.u, end - 0.3 * s.u, y + 5 * s.u, 'heads 2, 3');
      txt(s, 'each pair shared', end + 3 * s.u, y, '--ink-3', { align: 'left', size: 2.9, weight: 500 });
    });
    s.alpha(s.ease('gqa', 0.6, 2), () => txt(s, '2 × 2 × 8 = 32 numbers per token', s.w / 2, s.h * 0.58, 'teal', { size: 3.6, weight: 650 }));
    s.alpha(own, () => {
      txt(s, 'latent attention: smaller still,', s.w / 2, s.h * 0.72, 'green', { size: 3.6, weight: 650, font: 'serif' });
      txt(s, 'and every head keeps its own key and value', s.w / 2, s.h * 0.8, '--ink-2', { size: 3.4, weight: 500, font: 'serif' });
    });
  },
};

// ---- scene 2: down to a latent, up to every head's key and value

const latent: SceneDef = {
  marks: {
    cx: { tex: String.raw`\sym{latent}{c} = \sym{Wdkv}{W_{DKV}}\,\symx`, x: 0.5, y: 0.76, size: 4.6 },
    shape: { tex: String.raw`\sym{Wdkv}{W_{DKV}}\!:\ (\sym{dc}{d_c},\ \sym{d}{d}) = (16,\ \sym{d}{d})`, x: 0.5, y: 0.76, size: 4.6 },
    store: { tex: String.raw`\text{cached per token: } \sym{latent}{c}\text{, } 16 \text{ numbers}`, x: 0.5, y: 0.76, size: 4.4 },
    up: { tex: String.raw`\sym{k}{k} = \sym{Wuk}{W_{UK}}[i]\;\sym{latent}{c},\quad \sym{Wuk}{W_{UK}}[i]\!:\ (\sym{dhead}{d_{\text{head}}},\ \sym{dc}{d_c}) = (8,\ 16)`, x: 0.5, y: 0.76, size: 4 },
    all: { tex: String.raw`\sym{Wuk}{W_{UK}}\!:\ (\sym{heads}{h}\,\sym{dhead}{d_{\text{head}}},\ \sym{dc}{d_c}) = (32,\ 16)`, x: 0.5, y: 0.76, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const yx = s.h * 0.08;
    const yW = s.h * 0.18;
    const yc = s.h * 0.29;
    const yk = s.h * 0.48;
    const yv = s.h * 0.55;
    const pitch = s.tall ? 22.5 : 26;
    const hx = Array.from({ length: H }, (_, i) => cx + (i - (H - 1) / 2) * pitch * u);
    const cell = 2.3;
    const out = s.ease('count', 0.6);
    // x, then the down-projection
    s.cell(cx - 30 * u, yx - 3.2 * u, 60 * u, 6.4 * u, 'x: d numbers', 'orange', { size: 3 });
    s.arrow(cx, yx + 3.6 * u, cx, yW - 4 * u, s.c('--ink-3'), 0.35, 2);
    s.rrect(cx - 10 * u, yW - 3.6 * u, 20 * u, 7.2 * u, 1.4, { fill: s.tint('blue', 0.14), stroke: s.tint('blue', 0.8), lw: 0.35 });
    sub(s, 'W', 'DKV', cx, yW, { size: 3.6, k: 'blue' });
    s.alpha(s.ease('latent', 0.6, 2.5), () => txt(s, '(16, d)', cx + 12 * u, yW, 'blue', { align: 'left', size: 3 }));
    // c, the latent
    const lat = s.ease('latent', 0.6);
    s.alpha(lat, () => {
      s.arrow(cx, yW + 3.8 * u, cx, yc - 4 * u, s.c('--ink-3'), 0.35, 2);
      const x0 = cx - (DC * cell * u) / 2;
      run(s, x0, yc, Array.from({ length: DC }, () => ({ n: 1, label: '', k: 'green' as Ink, on: 0.5 * s.ease('store', 0.6) })), cell, { h: 5.5 });
      txt(s, 'c', x0 - 2.4 * u, yc, 'green', { align: 'right', size: 4, weight: 700 });
      s.alpha(s.ease('latent', 0.6, 1.4), () => sub(s, 'd', 'c', x0 + DC * cell * u + 2.4 * u, yc, { size: 3.2, k: 'green', align: 'left' }));
      s.alpha(s.ease('latent', 0.6, 1.4), () => txt(s, '= 16', x0 + DC * cell * u + 7.6 * u, yc, 'green', { size: 3.2, align: 'left' }));
    });
    // the cache: only c
    s.alpha(s.ease('store', 0.6), () => {
      const l = cx - (DC * cell * u) / 2 - 6.5 * u;
      const r = cx + (DC * cell * u) / 2 + 16.5 * u;
      const c = s.ctx;
      c.save();
      c.setLineDash([1 * u, 0.8 * u]);
      s.rrect(l, yc - 5 * u, r - l, 10 * u, 1.6, { stroke: s.tint('teal', 0.9), lw: 0.35 });
      c.restore();
      txt(s, 'cache', l, yc - 6.6 * u, 'teal', { align: 'left', size: 2.8 });
    });
    // every head rebuilds its key and value from c
    s.alpha(s.ease('up', 0.6), () => {
      hx.forEach((x, i) => {
        const hot = i === 0 ? 1 - s.ease('own', 0.6) : s.ease('own', 0.6);
        s.arrow(cx, yc + 3.4 * u, x, yk - 4.2 * u, s.tint('--ink-3', 0.6 + 0.4 * hot), 0.3, 1.8);
        const kx = x - (DH * 2.1 * u) / 2;
        run(s, kx, yk, [{ n: DH, label: `k${i}`, k: 'purple', on: 0.15 + 0.5 * hot }], 2.1, { h: 5.4, size: 2.7 });
        run(s, kx, yv, [{ n: DH, label: `v${i}`, k: 'gold', on: 0.15 + 0.5 * hot }], 2.1, { h: 5.4, size: 2.7 });
        txt(s, `head ${i}`, x, yv + 6 * u, '--ink-3', { size: 2.7, weight: 500 });
      });
      s.alpha(1 - s.ease('own', 0.5), () => {
        const lx = (cx + hx[0]!) / 2 - 4 * u;
        sub(s, 'W', 'UK', lx, (yc + yk) / 2 - 0.6 * u, { size: 2.9, k: 'blue', align: 'right', halo: true });
      });
    });
    // what the cache holds per token: 64, 32, 16
    s.show('cx', s.win('down', 'latent') * (1 - out));
    s.show('shape', s.win('latent', 'store') * (1 - out));
    s.show('store', s.win('store', 'up') * (1 - out));
    s.show('up', s.win('up', 'own') * (1 - out));
    s.show('all', s.ease('own', 0.6) * (1 - out));
    s.alpha(out, () => {
      const per = s.tall ? 0.75 : 0.8;
      const x0 = cx - 18 * u;
      const rows: [string, Part[], string][] = [
        ['multi-head', kv(['0', '1', '2', '3']), '64'],
        ['grouped', kv(['', '']), '32'],
        ['latent', [{ n: DC, label: 'c', k: 'green', on: 0.6 }], '16'],
      ];
      rows.forEach(([name, parts, n], r) => {
        const y = s.h * (0.72 + r * 0.075);
        s.alpha(s.ease('count', 0.5, 1.2 + 0.9 * r), () => {
          txt(s, name, x0 - 2 * u, y, r === 2 ? 'green' : '--ink-2', { align: 'right', size: 3 });
          const end = run(s, x0, y, parts.map((p) => ({ ...p, label: '' })), per, { h: 4.6 });
          txt(s, n, end + 2 * u, y, r === 2 ? 'green' : '--ink-2', { align: 'left', size: 3.2, weight: 650 });
        });
      });
    });
  },
};

// ---- scene 3: DeepSeek-V2's numbers

const real: SceneDef = {
  draw(s) {
    const u = s.u;
    const full = (s.tall ? 84 : 110) * u;
    const x0 = s.w / 2 - full / 2;
    const bar = (y: number, n: number, k: Ink, a = 1) => s.rrect(x0, y - 2.8 * u, Math.max(0.6 * u, (n / 32768) * full * a), 5.6 * u, 1, { fill: s.tint(k, 0.3), stroke: s.tint(k, 0.9), lw: 0.3 });
    s.alpha(s.ease('big', 0.6), () => {
      txt(s, 'multi-head: 2 × 128 × 128', x0, s.h * 0.12, '--ink-2', { align: 'left', size: 3.3 });
      bar(s.h * 0.2, 32768, 'purple', s.ease('big', 1.2, 0.8));
      s.alpha(s.ease('big', 0.6, 2.4), () => txt(s, '32,768 numbers', s.w / 2, s.h * 0.2, '--ink', { size: 3.4, weight: 650 }));
    });
    s.alpha(s.ease('small', 0.6), () => {
      txt(s, 'latent: 512 + 64', x0, s.h * 0.34, 'green', { align: 'left', size: 3.3 });
      bar(s.h * 0.42, 576, 'green');
      txt(s, '576', x0 + 4 * u, s.h * 0.42, 'green', { align: 'left', size: 3.2, weight: 650 });
    });
    // The latent bar is too thin to read, so it is shown again, magnified.
    s.alpha(s.ease('small', 0.6, 1.6), () => {
      const z = (s.tall ? 70 : 90) * u;
      const y = s.h * 0.6;
      const w512 = (512 / 576) * z;
      const zx = s.w / 2 - z / 2;
      txt(s, 'magnified', zx, s.h * 0.52, '--ink-3', { align: 'left', size: 2.8, weight: 500 });
      s.cell(zx, y - 3.2 * u, w512 - 0.4 * u, 6.4 * u, 'c: 512', 'green', { on: 0.4, size: 3 });
      s.cell(zx + w512 + 0.4 * u, y - 3.2 * u, z - w512 - 0.4 * u, 6.4 * u, '', 'slate', { on: 0.4 });
      txt(s, 'position key: 64, shared', zx + z, y + 6.4 * u, 'slate', { align: 'right', size: 2.9 });
    });
    s.alpha(s.ease('ratio', 0.6), () => txt(s, '32,768 / 576 ≈ 57 times smaller', s.w / 2, s.h * 0.82, 'teal', { size: 3.8, weight: 650 }));
  },
};

// ---- scene 4: the worked problem

const tryIt: SceneDef = {
  draw(s) {
    const u = s.u;
    const sz = s.tall ? 3.3 : 3.6;
    const cx = s.w / 2;
    s.alpha(s.ease('p', 0.6), () => txt(s, 'h = 16,  d_head = 64,  d_c = 256', cx, s.h * 0.1, '--ink-2', { size: sz }));
    s.alpha(s.ease('p', 0.6, 2.5), () => txt(s, 'numbers cached per token?', cx, s.h * 0.18, '--ink-3', { size: sz * 0.92, weight: 500 }));
    const full = (s.tall ? 80 : 100) * u;
    const x0 = cx - full / 2;
    const bar = (y: number, n: number, k: Ink) => s.rrect(x0, y - 2.6 * u, (n / 2048) * full, 5.2 * u, 1, { fill: s.tint(k, 0.3), stroke: s.tint(k, 0.9), lw: 0.3 });
    s.alpha(s.ease('mha', 0.6), () => {
      txt(s, 'multi-head: 2 × 16 × 64 = 2,048', x0, s.h * 0.3, '--ink-2', { align: 'left', size: sz });
      bar(s.h * 0.37, 2048, 'purple');
    });
    s.alpha(s.ease('lat', 0.6), () => {
      txt(s, 'latent: only c, 256', x0, s.h * 0.48, 'green', { align: 'left', size: sz });
      bar(s.h * 0.55, 256, 'green');
    });
    s.alpha(s.ease('lat', 0.6, 2), () => txt(s, '2,048 / 256 = 8 times smaller', cx, s.h * 0.66, 'teal', { size: sz * 1.05, weight: 650 }));
    s.alpha(s.ease('shape', 0.6), () => {
      const w = sub(s, 'W', 'UK', 0, -100, { size: sz });
      const t = "[i]: one head's part, (64, 256)";
      const tw = s.measure(t, { size: sz, font: 'mono', weight: 600 });
      const left = cx - (w + tw) / 2;
      sub(s, 'W', 'UK', left, s.h * 0.8, { size: sz, k: 'blue', align: 'left' });
      txt(s, t, left + w, s.h * 0.8, 'blue', { align: 'left', size: sz });
      txt(s, '64 numbers made from 256', cx, s.h * 0.88, '--ink-3', { size: sz * 0.9, weight: 500 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { cache, latent, real, try: tryIt };
