import type { SceneDef } from '../../../lecture/scene';
import { after } from '../draw';
import { ROW, besideX, bowlLayout, fill, legendLine, result, rings, termRow } from './art';

const P = [1, 1] as const;
const G = [2, 4] as const;
const SCALE = 0.25;

const partials: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(u, v) = u^2 + 2v^2`, x: 0.5, y: 0.5, size: 4.6, align: 'left' },
    fu: { tex: String.raw`\symf(u, v) = \underbrace{u^2}_{2u} + \underbrace{2v^2}_{0}`, x: 0.5, y: 0.5, size: 4.6, align: 'left' },
    fv: { tex: String.raw`\symf(u, v) = \underbrace{u^2}_{0} + \underbrace{2v^2}_{4v}`, x: 0.5, y: 0.5, size: 4.6, align: 'left' },
  },
  draw(s) {
    const { F, legend: L, fy } = bowlLayout(s);
    rings(s, F, 3, s.ease('two', 0.6, 1.5));
    F.dot(P[0], P[1], 'purple', 1.3);
    // f, then f with what each term gives in u, then in v.
    const tu = s.ease('terms', 0.6, 0.4);
    const tv = s.ease('dv', 0.6, 0.4);
    const at = { x: L.x / s.w, y: fy / s.h };
    s.show('f', s.ease('two', 0.6) * (1 - tu), at);
    s.show('fu', tu * (1 - tv), at);
    s.show('fv', tv, at);
    s.alpha(s.ease('du', 0.6), () => {
      F.seg(-2.3, 1, 2.3, 1, 'gold', 0.3, [1, 1]);
      F.arrow(P[0], P[1], P[0] + G[0] * SCALE, P[1], 'gold', 0.6);
    });
    legendLine(s, L, 0, '∂f/∂u = 2u = 2', 'gold', after(s, 'terms', 0.6));
    s.alpha(s.ease('dv', 0.6), () => {
      F.seg(1, -1.6, 1, 2.3, 'teal', 0.3, [1, 1]);
      F.arrow(P[0], P[1], P[0], P[1] + G[1] * SCALE, 'teal', 0.6);
    });
    legendLine(s, L, 1, '∂f/∂v = 4v = 4', 'teal', after(s, 'dv', 0.6));
  },
};

const mixed: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(u, v) = u^2 + 3uv \quad \text{at } (1, 2)`, x: 0.5, y: 0.1, size: 4.6 },
  },
  draw(s) {
    // u² + 3uv: hold v, then hold u.
    s.show('f', s.ease('mix', 0.6));
    const tv = s.ease('pv', 0.6);
    termRow(s, 2, 0, 'purple', s.ease('mix', 0.6, 0.8), 'f =', ['u²', '3uv']);
    termRow(s, 2, 1, 'purple', s.ease('held', 0.6), 'v = 2', ['u²', '6u'], [0, s.win('held', 'pu')], { label: 'u = 1', cells: ['1', '3v'], t: tv, k: 'purple' });
    termRow(s, 2, 2, 'gold', s.ease('pu', 0.6), '∂f/∂u', ['2u', '3v'], [0, s.win('pu', 'pv')], { label: '∂f/∂v', cells: ['0', '3u'], t: tv, k: 'teal' });
    const nx = besideX(s, 2);
    const ny = s.h * ROW[1]!;
    const note = { size: 3, font: 'mono', weight: 600, align: 'left', halo: true } as const;
    s.alpha(s.ease('held', 0.6, 1.4) * (1 - tv), () => s.text('slope 6 = 3v', nx, ny, { ...note, color: s.c('gold') }));
    s.alpha(after(s, 'pv', 0.45), () => s.text('slope 3 = 3u', nx, ny, { ...note, color: s.c('teal') }));
    result(s, '∂f/∂u = 2u + 3v = 2 + 6 = 8', 0, 'gold', after(s, 'pu', 0.6));
    result(s, '∂f/∂v = 3u = 3', 1, 'teal', after(s, 'pv', 0.75));
  },
};

const worked: SceneDef = {
  marks: {
    p: { tex: String.raw`\symf(u, v) = u^2 v + 2v^2 + 3u \quad \text{at } (2, 1)`, x: 0.5, y: 0.1, size: 4.6 },
  },
  draw(s) {
    s.show('p', s.ease('p', 0.6));
    const u = [0.1, 0.55, 0.7].map((f) => after(s, 'du', f));
    const v = [0.1, 0.5, 0.65].map((f) => after(s, 'dv', f));
    termRow(s, 3, 0, 'purple', s.ease('p', 0.6, 0.8), 'f =', ['u²v', '2v²', '3u']);
    termRow(s, 3, 1, 'gold', s.ease('du', 0.5), '∂f/∂u', [fill(u[0]!, '2uv'), fill(u[1]!, '0'), fill(u[2]!, '3')]);
    termRow(s, 3, 2, 'teal', s.ease('q', 0.5), '∂f/∂v', [fill(v[0]!, 'u²'), fill(v[1]!, '4v'), fill(v[2]!, '0')]);
    // The note on u²v changes with the input that moves.
    const sw = s.ease('dv', 0.5);
    result(s, 'u²v is v · u²: gives v · 2u', 0, '--ink-2', after(s, 'du', 0.1) * (1 - sw));
    result(s, 'u²v is u² · v: gives u²', 0, '--ink-2', after(s, 'dv', 0.1));
    result(s, '∂f/∂u = 2uv + 3 = 4 + 3 = 7', 1, 'gold', after(s, 'du', 0.72));
    result(s, '∂f/∂v = u² + 4v = 4 + 4 = 8', 2, 'teal', after(s, 'dv', 0.8));
  },
};

export const scenes: Record<string, SceneDef> = { partials, mixed, worked };
