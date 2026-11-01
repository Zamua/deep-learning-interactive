import type { Color } from '../../../core/symbols';
import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { curves } from '../draw';
import { NIAH, NIAH_LENGTHS } from '../niah';

const Y = (s: Scene, f: number) => f * s.h;
const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.2, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });

const INKS: Color[] = ['blue', 'orange', 'green', 'purple', 'red', 'teal', 'gold', 'slate'];

// ---- scene 1: a fixed state holds d_k pairs apart; the cache holds every one

const SLOTS = 8;

const limit: SceneDef = {
  draw(s) {
    const u = s.u;
    s.alpha(1 - s.ease('drop', 0.5), () => mono(s, 'Gated DeltaNet: one state, any length', s.w / 2, Y(s, 0.07), 'purple', 3.2));
    // Key directions as slots: the first pairs each get one, the rest have to share.
    const pitch = (s.tall ? 8.6 : 9.5) * u;
    const x0 = s.w / 2 - ((SLOTS - 1) / 2) * pitch;
    const ys = Y(s, 0.2);
    const cw = 6.6 * u;
    const ch = 5.4 * u;
    s.alpha(s.ease('fixed', 0.6), () => {
      for (let i = 0; i < SLOTS; i++) s.rrect(x0 + i * pitch - cw / 2 - 0.6 * u, ys - ch / 2 - 0.6 * u, cw + 1.2 * u, ch + 1.2 * u, 1, { stroke: s.tint('--ink-3', 0.6), lw: 0.25 });
      for (let i = 0; i < SLOTS; i++) {
        s.alpha(after(s, 'cap', 0.2 + 0.06 * i, 0.3), () => s.rrect(x0 + i * pitch - cw / 2, ys - ch / 2, cw, ch, 0.8, { fill: s.tint(INKS[i]!, 0.5), stroke: s.c(INKS[i]!), lw: 0.25 }));
      }
      // More pairs than slots: each lands on a taken slot, and the colors blur together.
      for (let j = 0; j < 12; j++) {
        const i = (j * 5 + 3) % SLOTS;
        s.alpha(0.45 * after(s, 'share', 0.1 + 0.05 * j, 0.3), () => s.rrect(x0 + i * pitch - cw / 2 + 0.8 * u, ys - ch / 2 - 0.8 * u, cw, ch, 0.8, { fill: s.tint(INKS[(j + 3) % SLOTS]!, 0.5) }));
      }
    });
    const yc = Y(s, 0.3);
    s.alpha(s.win('cap', 'share'), () => mono(s, 'keys of dₖ numbers: dₖ directions at right angles', s.w / 2, yc, '--ink-2', 2.9, 'center', 500));
    s.alpha(s.ease('share', 0.5), () => mono(s, 'more pairs than directions: they share, and reads blend', s.w / 2, yc, 'red', 2.9, 'center', 600));
    // Gated DeltaNet's needle result on real essays.
    s.alpha(s.ease('drop', 0.6), () => {
      const cw2 = 50 * u;
      const bx = s.w / 2 - cw2 / 2 + 3 * u;
      const by = Y(s, 0.42);
      const bh = (s.tall ? 18 : 20) * u;
      curves(s, bx, by, cw2, bh, NIAH_LENGTHS, [{ vals: NIAH.essay.gated, k: 'purple' }], { title: 'Gated DeltaNet: needles found in essays', reveal: 1 + 3 * after(s, 'drop', 0.1, 1.6) });
      s.alpha(after(s, 'drop', 0.6), () => mono(s, '29.6%', bx + cw2 * 0.94 + 2.4 * u, by + bh * (1 - 0.296), 'red', 2.8, 'left', 650));
    });
    // The cache: every token's key and value, so a query can reach any of them.
    const yk = Y(s, 0.8);
    s.alpha(s.ease('cache', 0.6), () => {
      const n = s.tall ? 16 : 22;
      const p = 4 * u;
      const c0 = s.w / 2 - ((n - 1) / 2) * p;
      for (let i = 0; i < n; i++) {
        s.rrect(c0 + i * p - 1.6 * u, yk - 3.4 * u, 3.2 * u, 3 * u, 0.5, { fill: s.tint('purple', 0.35), stroke: s.tint('purple', 0.7), lw: 0.2 });
        s.rrect(c0 + i * p - 1.6 * u, yk + 0.4 * u, 3.2 * u, 3 * u, 0.5, { fill: s.tint('gold', 0.35), stroke: s.tint('gold', 0.7), lw: 0.2 });
      }
      s.alpha(after(s, 'cache', 0.4, 0.5), () => {
        const qx = c0 + (n - 1) * p;
        s.line(qx, yk - 4.2 * u, c0 + 2 * p, yk - 4.2 * u, s.c('teal'), 0.35);
        s.arrow(c0 + 2 * p, yk - 4.2 * u, c0 + 2 * p, yk - 3.6 * u, s.c('teal'), 0.35, 1.2);
      });
      mono(s, 'softmax cache: every key and value kept', s.w / 2, yk + 7.5 * u, 'purple', 2.9, 'center', 500);
    });
    s.alpha(s.ease('gap', 0.6), () => mono(s, 'finding facts: recurrent < transformer < mixed', s.w / 2, Y(s, 0.93), 'teal', 3.1));
    cite(s, 'Yang, Kautz & Hatamizadeh, 2024', s.win('drop', 'cache') + s.ease('gap', 0.6));
  },
};

// ---- scene 2: the layer stack, twelve groups of three Gated DeltaNet layers and one attention layer

const LAYERS = 48;

const mix: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2 - (s.tall ? 27 : 34) * u;
    const bw = 22 * u;
    const pitch = 1.4 * u;
    const group = 0.6 * u;
    const top = Y(s, 0.11);
    const lit = s.ease('count', 0.5);
    const shown = (i: number) => after(s, 'idea', 0.05 + (0.5 * i) / LAYERS, 0.3);
    for (let i = 0; i < LAYERS; i++) {
      const attn = i % 4 === 3;
      const y = top + i * pitch + Math.floor(i / 4) * group;
      s.alpha(shown(i), () => {
        const k: Ink = attn ? 'blue' : 'purple';
        s.rrect(cx - bw / 2, y, bw, pitch * 0.72, 0.3, { fill: s.tint(k, attn ? 0.6 + 0.4 * lit : 0.22 * (1 - 0.4 * lit)), stroke: s.tint(k, attn ? 0.9 : 0.35), lw: 0.15 });
      });
    }
    const tx = cx + bw / 2 + 6 * u;
    const line = (t: string, y: number, k: Ink, w = 500, size = 2.8) => mono(s, t, tx, y, k, size, 'left', w);
    s.alpha(s.ease('idea', 0.6), () => {
      const y = Y(s, 0.16);
      s.rrect(tx, y - 1.4 * u, 4 * u, 2.8 * u, 0.4, { fill: s.tint('purple', 0.35), stroke: s.c('purple'), lw: 0.2 });
      mono(s, 'Gated DeltaNet: a fixed state', tx + 6 * u, y, 'purple', 2.8, 'left', 600);
      s.rrect(tx, y + 5.6 * u, 4 * u, 2.8 * u, 0.4, { fill: s.tint('blue', 0.5), stroke: s.c('blue'), lw: 0.2 });
      mono(s, 'attention: a KV cache', tx + 6 * u, y + 7 * u, 'blue', 2.8, 'left', 600);
    });
    const y2 = Y(s, 0.4);
    s.alpha(s.win('yang', 'qwen'), () => {
      line('DeltaNet with just 2', y2, '--ink');
      line('attention layers beat', y2 + 4.6 * u, '--ink');
      line('a transformer its size', y2 + 9.2 * u, '--ink');
    });
    cite(s, 'Yang et al., 2024', s.win('yang', 'qwen'));
    s.alpha(s.ease('qwen', 0.6), () => {
      line('Qwen3-Next: 48 layers,', y2, '--ink', 600);
      line('12 groups of 3 Gated', y2 + 4.6 * u, '--ink');
      line('DeltaNet and 1 attention', y2 + 9.2 * u, '--ink');
    });
    cite(s, 'Qwen Team, 2025', s.ease('qwen', 0.6));
    const y3 = Y(s, 0.64);
    s.alpha(s.ease('why', 0.6), () => {
      line('linear: fast, weak at recall', y3, 'purple', 600);
      line('attention: recalls, but', y3 + 4.6 * u, 'blue', 600);
      line('slow and costly to run', y3 + 9.2 * u, 'blue', 600);
    });
    s.alpha(lit, () => line('12 of 48 keep a cache', Y(s, 0.86), 'blue', 650, 3.3));
  },
};

// ---- scene 3: the memory bill, before and after doubling the context

const GB = (layers: number, tokens: number) => (2 * layers * tokens * 4000 * 2) / 1e9;

const memory: SceneDef = {
  draw(s) {
    const u = s.u;
    mono(s, '48 layers, d = 4,000, 2 bytes per number', s.w / 2, Y(s, 0.07), '--ink-2', 3, 'center', 500);
    const T = Math.round(lerp(100_000, 200_000, after(s, 'grow', 0.2, 1.4)));
    s.alpha(s.ease('full', 0.6), () => mono(s, `${T.toLocaleString('en-US')} tokens`, s.w / 2, Y(s, 0.14), 'orange', 3.3, 'center', 650));
    const x0 = s.w / 2 - 42 * u;
    const scale = (42 * u) / GB(48, 100_000);
    const bar = (y: number, gb: number, k: Ink, label: string) => {
      mono(s, label, x0, y - 4.6 * s.u, k, 3, 'left', 600);
      s.rrect(x0, y - 2 * u, Math.max(gb * scale, 0.6 * u), 4 * u, 0.8, { fill: s.tint(k, 0.4), stroke: s.c(k), lw: 0.3 });
    };
    s.alpha(s.ease('full', 0.6, 0.4), () => bar(Y(s, 0.3), GB(48, T), 'blue', `transformer, 48 caches: ${Math.round(GB(48, T))} GB`));
    s.alpha(s.ease('hybrid', 0.6), () => bar(Y(s, 0.48), GB(12, T), 'blue', `hybrid, 12 caches: ${Math.round(GB(12, T))} GB`));
    s.alpha(s.ease('state', 0.6), () => bar(Y(s, 0.66), 0.036, 'purple', 'hybrid, 36 states: 36 MB'));
    const yc = Y(s, 0.84);
    s.alpha(s.win('formula', 'hybrid'), () => mono(s, '2 × 48 × 100,000 × 4,000 × 2 bytes', s.w / 2, yc, '--ink-2', 3.1));
    s.alpha(s.win('hybrid', 'state'), () => mono(s, 'a quarter of the layers: a quarter of the cache', s.w / 2, yc, 'blue', 3));
    s.alpha(s.win('state', 'grow'), () => mono(s, 'a megabyte each, at any length', s.w / 2, yc, 'purple', 3));
    s.alpha(s.win('grow', 'trade'), () => mono(s, 'twice the tokens: caches twice, states the same', s.w / 2, yc, 'orange', 3));
    s.alpha(s.ease('trade', 0.6), () => {
      mono(s, 'fewer attention layers: a smaller cache,', s.w / 2, yc, '--ink-2', 3, 'center', 500);
      mono(s, 'and more of the recall left to fixed states', s.w / 2, yc + 4.8 * u, '--ink-2', 3, 'center', 500);
    });
  },
};

export const scenes: Record<string, SceneDef> = { limit, mix, memory };
