import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, columns, rowLabel } from '../../draw';
import { type Ink, mini, rich, sub, vrow, vtext } from '../draw';

const X = [2, 1];
const MAPS: { sub: string; M: number[][]; k: Ink; name: string; beat: string }[] = [
  { sub: 'Q', M: [[1, 1], [0, 1]], k: 'teal', name: 'query', beat: 'query' },
  { sub: 'K', M: [[1, 0], [1, -1]], k: 'purple', name: 'key', beat: 'key' },
  { sub: 'V', M: [[0, 1], [2, 0]], k: 'gold', name: 'value', beat: 'value' },
];
const mv = (M: number[][], x: number[]) => M.map((r) => r.reduce((a, w, j) => a + w * x[j]!, 0));

const three: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const u = s.u;
    const top = s.h * 0.12;
    const tok = s.ease('split', 0.6);
    s.alpha(1 - tok, () => {
      rowLabel(s, 'h', cx - 10 * u, top, 'gold', 4);
      vrow(s, cx, top, X.map(String), 'gold');
    });
    s.alpha(tok, () => {
      rowLabel(s, 'x', cx - 10 * u, top, 'orange', 4);
      vrow(s, cx, top, X.map(String), 'orange', { on: [s.win('split', 'query'), s.win('split', 'query')] });
    });
    s.alpha(s.ease('two', 0.6, 0.8) * (1 - s.ease('split', 0.5)), () => {
      s.text('one encoder state, two jobs:', cx, s.h * 0.36, { size: 3.6, color: s.c('--ink-2') });
      s.text('scored against the decoder\'s state', cx, s.h * 0.5, { size: 3.4, font: 'mono', color: s.c('purple') });
      s.text('averaged into the context', cx, s.h * 0.62, { size: 3.4, font: 'mono', color: s.c('gold') });
    });
    const shape = s.ease('shape', 0.6);
    MAPS.forEach((m, r) => {
      const y = s.h * (0.36 + r * 0.22);
      const a = s.ease('split', 0.6, 0.4 + 0.5 * r) * (r === 0 ? 1 : 1 - shape);
      s.alpha(a, () => {
        const box = mini(s, cx - 21 * u, y, m.M.map((row) => row.map(String)), 'blue', { on: () => s.win(m.beat, r < 2 ? MAPS[r + 1]!.beat : 'shape') });
        sub(s, 'W', m.sub, box.l - 2 * u, y, { k: 'blue', align: 'right', size: 3.8 });
        rich(s, [['x', 'orange'], [' =', '--ink-3']], cx - 4 * u, y, { size: 3.6, weight: 600 });
        const out = s.ease(m.beat, 0.6, 0.8);
        s.alpha(out, () => vrow(s, cx + 12 * u, y, mv(m.M, X).map(String), m.k, { on: [s.win(m.beat, r < 2 ? MAPS[r + 1]!.beat : 'shape'), s.win(m.beat, r < 2 ? MAPS[r + 1]!.beat : 'shape')] }));
        s.alpha(out, () => s.text(m.name, cx + 23 * u, y, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c(m.k) }));
      });
    });
    s.alpha(shape, () => {
      const o = { size: 3.3, align: 'left' as const };
      const lx = cx - 38 * u;
      rich(s, [['rows: ', '--ink-3'], ['one per entry of ', '--ink-2'], ['q', 'teal'], ['   (dₖ)', '--ink-3']], lx, s.h * 0.56, o);
      rich(s, [['columns: ', '--ink-3'], ['one per entry of ', '--ink-2'], ['x', 'orange'], ['   (d)', '--ink-3']], lx, s.h * 0.66, o);
      s.alpha(s.ease('shape', 0.6, 2.5), () => {
        const y = s.h * 0.82;
        rich(s, [['d = 512, dₖ = 64', '--ink-2'], ['  →  ', '--ink-3']], cx - 6 * u, y, { size: 3.6, weight: 600, align: 'right' });
        const w = sub(s, 'W', 'Q', cx - 6 * u, y, { k: 'blue', align: 'left', size: 3.6 });
        s.text(': (64, 512)', cx - 6 * u + w, y, { size: 3.6, font: 'mono', weight: 600, align: 'left' });
      });
    });
  },
};

const WORDS = ['cats', 'like', 'fish'];
const KEYS = [[1, 1], [1, -1], [0, 1]];
const VALS = [[2, 0], [0, 2], [1, 1]];
const QUERY = [1, 1];
const E = KEYS.map((k) => k.reduce((a, v, j) => a + v * QUERY[j]!, 0));
const A = (() => {
  const x = E.map(Math.exp);
  const t = x.reduce((a, b) => a + b, 0);
  return x.map((v) => v / t);
})();
const OUT = [0, 1].map((c) => VALS.reduce((a, v, j) => a + A[j]! * v[c]!, 0));
const f2 = (v: number) => v.toFixed(2);

/** One labelled row of per-token cells, each holding a short vector or a number. */
function row(s: Scene, xs: number[], y: number, name: string, labels: string[], k: Ink, w: number, on: number[] = []): void {
  rowLabel(s, name, xs[0]! - (w / 2 + 2.5) * s.u, y, k, 3.8);
  xs.forEach((x, i) => s.cell(x - (w * s.u) / 2, y - 3.5 * s.u, w * s.u, 7 * s.u, labels[i]!, k, { on: on[i] ?? 0, size: 3 }));
}

const match: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 28).map((x) => x + 4 * u);
    const roles = s.ease('roles', 0.6);
    WORDS.forEach((w, j) => s.text(w, xs[j]!, s.h * 0.07, { size: 3.6, font: 'mono', weight: 600, color: s.c(j === 2 ? 'teal' : 'orange') }));
    const lit = s.win('score', 'weights');
    row(s, xs, s.h * 0.17, 'k', KEYS.map((k) => vtext(k)), 'purple', 16, KEYS.map(() => Math.max(lit, s.win('roles', undefined))));
    const mix = s.win('mix', 'roles');
    row(s, xs, s.h * 0.28, 'v', VALS.map((v) => vtext(v)), 'gold', 16, [Math.max(mix, roles), mix * 0.3, mix * 0.5].map((v, j) => (j === 0 ? v : Math.max(v, roles))));
    s.alpha(s.ease('ask', 0.6, 0.6), () => rich(s, [['fish asks with ', '--ink-3'], ['q = [1, 1]', 'teal']], s.w / 2, s.h * 0.39, { size: 3.6, weight: 600 }));
    s.alpha(s.ease('score', 0.6, 1) * (1 - roles), () => row(s, xs, s.h * 0.5, 'q·k', E.map(String), 'slate', 10, E.map(() => s.win('score', 'weights'))));
    s.alpha(s.ease('weights', 0.6) * (1 - roles), () => {
      const base = s.h * 0.8;
      rowLabel(s, 'α', xs[0]! - 8 * u, base - 5 * u, 'green', 3.8);
      bars(s, xs, base, A, 'green', { max: 1, height: 16, w: 9, fmt: f2, grow: s.ease('weights', 1, 0.3), hi: [mix, 0, 0] });
    });
    s.alpha(roles, () => {
      rich(s, [['keys', 'purple'], [' → how much each token counts', '--ink-2']], s.w / 2, s.h * 0.52, { size: 3.4 });
      rich(s, [['values', 'gold'], [' → what each token brings', '--ink-2']], s.w / 2, s.h * 0.62, { size: 3.4 });
      s.alpha(s.ease('roles', 0.6, 3), () => s.text('three learned matrices, shared by every token', s.w / 2, s.h * 0.74, { size: 3.3, color: s.c('blue') }));
    });
    s.alpha(s.ease('mix', 0.6, 0.8), () => rich(s, [['out = Σ αⱼ vⱼ = ', '--ink-2'], [`[${OUT.map(f2).join(', ')}]`, 'teal']], s.w / 2, s.h * 0.91, { size: 3.6, weight: 600 }));
  },
};

export const scenes: Record<string, SceneDef> = { three, match };
