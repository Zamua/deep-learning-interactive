import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, lerp } from '../../lecture/scene';
import { R_W, routeOne } from '../../lib/moe-figs';
import { SHAPE_7B, human, moeParams } from '../../lib/moe-math';
import { type K, box, current, ekey, note, pill, title } from './kit';

const SUBN = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number): string => String(n).split('').map((c) => SUBN[Number(c)]!).join('');

// ---------------------------------------------------------------- intro

/** Two experts per token for the six tokens of the opening picture. */
const PAIRS = [
  [1, 4],
  [0, 6],
  [3, 5],
  [2, 7],
  [5, 1],
  [6, 2],
];

function introLayout(s: Scene) {
  const { w, h, u } = s;
  const W0 = Math.min(w - 12 * u, 110 * u);
  const ax = (w - W0) / 2;
  const cs = Math.min(7 * u, W0 / 10);
  const tokX = (i: number) => w / 2 + (i - 2.5) * cs * 1.6;
  return { W0, ax, cs, tokY: h * 0.12, rY: h * 0.32, rH: 7 * u, eY: h * 0.48, eH: h * 0.18, tokX };
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    title(s, 'Mixture of experts', 'more parameters, the same cost per token', s.win('hello', 'dense'));
    const dA = s.win('dense', 'plan');
    if (dA > 0) {
      const L = introLayout(s);
      const split = s.ease('copies', 1);
      const rA = s.ease('router', 0.6);
      const catchA = s.ease('catch', 0.7);
      const ew = L.W0 / 8;
      // Which token is being routed right now: cycle through them.
      const tok = rA > 0 ? Math.floor(Math.max(0, s.since('router')) / 1.3) % 6 : -1;
      s.alpha(dA, () => {
        for (let i = 0; i < 6; i++) {
          const x = L.tokX(i);
          const on = catchA > 0.5 || tok === i || rA === 0 ? 1 : 0.25;
          s.cell(x - L.cs / 2, L.tokY - L.cs / 2, L.cs, L.cs, '', 'orange', { on });
        }
        s.text('tokens', L.ax, L.tokY, { size: 3.4, align: 'left', font: 'ui', color: s.c('orange'), weight: 600 });
        // The FFN: one box, then eight experts.
        s.alpha(1 - split, () => box(s, L.ax, L.eY, L.W0, L.eH, 'FFN', 'purple', { on: 0.25, size: 5 }));
        s.alpha(split, () => {
          for (let e = 0; e < 8; e++) {
            let on = 0.1;
            if (catchA > 0.5) on = e === 0 ? 1 : 0.02;
            else if (tok >= 0 && PAIRS[tok]!.includes(e)) on = 1;
            box(s, L.ax + e * ew + u * 0.5, L.eY, ew - u, L.eH, String(e), ekey(e), { on, size: 3.6 });
          }
        });
        // Dense: every token to the whole block.
        s.alpha(1 - rA, () => {
          for (let i = 0; i < 6; i++) s.line(L.tokX(i), L.tokY + L.cs / 2 + u, L.ax + L.W0 * ((i + 0.5) / 6), L.eY - u, s.tint('purple', 0.4), 0.3);
        });
        // The router, and the token's two picks.
        s.alpha(rA, () => {
          s.rrect(L.ax, L.rY - L.rH / 2, L.W0, L.rH, 1.4, { fill: s.tint('gold', 0.18), stroke: s.c('gold'), lw: 0.35 });
          s.text('router', L.ax + u * 2, L.rY + u * 0.2, { size: 3.4, align: 'left', font: 'ui', weight: 650, color: s.c('gold') });
          const draw = (i: number, e: number, k: K) => {
            s.line(L.tokX(i), L.tokY + L.cs / 2 + u, L.tokX(i), L.rY - L.rH / 2, s.tint(k, 0.7), 0.35);
            s.arrow(L.tokX(i), L.rY + L.rH / 2, L.ax + (e + 0.5) * ew, L.eY - u * 0.8, s.tint(k, 0.8), 0.35, 1.8);
          };
          if (catchA > 0.5) for (let i = 0; i < 6; i++) s.alpha(catchA, () => draw(i, 0, 'red'));
          else if (tok >= 0) for (const e of PAIRS[tok]!) draw(tok, e, 'orange');
        });
        const ty = L.eY + L.eH + u * 9;
        const cur = current(s, ['dense', 'price', 'ffn', 'copies', 'router', 'active', 'mixtral', 'catch']);
        const msg: Record<string, string> = {
          dense: 'every weight works on every token',
          price: '2x the parameters means 2x the cost per token',
          ffn: 'two thirds of each block is the FFN',
          copies: 'E experts: copies of the FFN, each with its own weights',
          router: 'a router picks k of them for each token',
          active: '8x the parameters; 2 of the 8 run per token',
          catch: 'left alone, everything goes to a favorite',
        };
        if (cur && msg[cur]) note(s, msg[cur]!, ty, s.ease(cur, 0.5), cur === 'catch' ? 'red' : '--ink-2');
        // Attention versus FFN shares of one block.
        const fA = s.win('ffn', 'copies');
        s.alpha(fA, () => {
          const a3 = L.W0 / 3;
          s.rrect(L.ax, L.rY - L.rH / 2, a3 - u * 0.5, L.rH, 1.2, { fill: s.tint('blue', 0.25), stroke: s.c('blue'), lw: 0.3 });
          s.rrect(L.ax + a3 + u * 0.5, L.rY - L.rH / 2, L.W0 - a3 - u * 0.5, L.rH, 1.2, { fill: s.tint('purple', 0.25), stroke: s.c('purple'), lw: 0.3 });
          s.text('attention 4d²', L.ax + a3 / 2, L.rY + u * 0.2, { size: 3.3, font: 'mono', weight: 600, color: s.c('blue') });
          s.text('FFN 8d²', L.ax + a3 + (L.W0 - a3) / 2, L.rY + u * 0.2, { size: 3.3, font: 'mono', weight: 600, color: s.c('purple') });
        });
        s.alpha(s.win('mixtral', 'catch'), () => {
          pill(s, 'Mixtral 8x7B: 47B stored', w / 2, ty - u * 1, 'purple', { size: 3.4 });
          pill(s, '13B run per token', w / 2, ty + u * 7, 'orange', { size: 3.4 });
        });
      });
    }
    const pA = s.ease('plan', 0.8);
    s.alpha(pA, () => {
      const items: [string, K][] = [
        ['the layer and its router', 'blue'],
        ['total versus active parameters', 'purple'],
        ['balance: a loss', 'red'],
        ['fixed buffers', 'gold'],
        ['smarter experts', 'teal'],
        ['bias terms', 'green'],
        ['experts across many GPUs', 'slate'],
      ];
      const gap = Math.min(10 * u, (h * 0.8) / items.length);
      const y0 = h / 2 - (gap * (items.length - 1)) / 2;
      items.forEach(([t, k], i) => s.alpha(s.ease('plan', 0.5, 0.25 + i * 0.6), () => pill(s, t, w / 2, y0 + i * gap, k, { size: 3.6 })));
    });
  },
};

// ---------------------------------------------------------------- layer

const X_TOK: [number, number] = [0.95, 0.55];
const ROUTED = routeOne(X_TOK, 2, true);

function layerGeo(s: Scene) {
  const { w, h, u } = s;
  const mx = 6 * u;
  const cw = (w - 2 * mx) / 8;
  return {
    mx,
    cw,
    cx: (e: number) => mx + (e + 0.5) * cw,
    xY: h * 0.07,
    rY: h * 0.18,
    zY: h * 0.29,
    base: h * 0.5,
    top: h * 0.34,
    eY: h * 0.53,
    eH: Math.min(h * 0.09, 9 * u),
    gY: h * 0.53 + Math.min(h * 0.09, 9 * u) + 3.4 * u,
    sY: h * 0.78,
    oY: h * 0.92,
  };
}

const layer: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const G = layerGeo(s);
    const R = ROUTED;
    const lowA = 1 - s.ease('every', 0.6);
    // The token x.
    const xA = s.ease('token', 0.6);
    s.alpha(xA, () => {
      const cw = 9 * u;
      const vals = ['0.95', '0.55'];
      for (let i = 0; i < 2; i++) s.cell(w / 2 - cw + i * cw, G.xY - 3 * u, cw, 6 * u, vals[i]!, 'orange', { on: 0.4, size: 3.1 });
      s.text('x', w / 2 - cw - u * 3.5, G.xY, { size: 5, italic: true, weight: 650, color: s.c('orange') });
    });
    // Router W_r and the logits.
    const rA = s.ease('logits', 0.6);
    s.alpha(rA, () => {
      const bw = Math.min(w * 0.36, 40 * u);
      s.arrow(w / 2, G.xY + 3.4 * u, w / 2, G.rY - 3.4 * u, s.c('--ink-3'), 0.35, 1.6);
      s.rrect(w / 2 - bw / 2, G.rY - 3.2 * u, bw, 6.4 * u, 1.4, { fill: s.tint('blue', 0.14), stroke: s.c('blue'), lw: 0.35 });
      s.text('x @ W_r', w / 2, G.rY + 0.2 * u, { font: 'mono', size: 3.6, weight: 650, color: s.c('blue') });
      for (let e = 0; e < 8; e++) {
        const a = s.ease('logits', 0.4, 0.8 + e * 0.12);
        s.alpha(a, () => s.text(R.logits[e]!.toFixed(1), G.cx(e), G.zY, { font: 'mono', size: 3.1, color: s.c('--ink-2') }));
      }
      s.text('logits', G.mx, G.zY - 4.2 * u, { size: 3.1, font: 'ui', align: 'left', color: s.c('--ink-3') });
    });
    // Probabilities, then top-k.
    const pA = s.ease('softmax', 0.8);
    const kA = s.ease('topk', 0.6);
    const top = new Set(R.top);
    s.alpha(pA, () => {
      const bh = G.base - G.top;
      for (let e = 0; e < 8; e++) {
        const hh = (R.probs[e]! / 0.45) * bh * pA;
        const chosen = top.has(e);
        const dim = chosen ? 1 : 1 - 0.7 * kA;
        s.alpha(dim, () => s.rrect(G.cx(e) - G.cw * 0.22, G.base - hh, G.cw * 0.44, Math.max(hh, 0.4), 0.6, { fill: s.tint('purple', 0.75) }));
        if (chosen && kA > 0) s.alpha(kA, () => s.rrect(G.cx(e) - G.cw * 0.3, G.base - hh - u, G.cw * 0.6, hh + u * 1.6, 1, { stroke: s.c('gold'), lw: 0.5 }));
      }
      s.line(G.mx, G.base, w - G.mx, G.base, s.c('--axis'), 0.25);
      s.text('p', G.mx - 2.5 * u, (G.top + G.base) / 2, { size: 4.4, italic: true, weight: 650, color: s.c('purple') });
    });
    // Gates, in a row under the chosen experts.
    const gA = s.ease('gates', 0.6);
    s.alpha(gA * lowA, () => {
      s.text('g', G.mx - 2.5 * u, G.gY, { size: 4.4, italic: true, weight: 650, color: s.c('gold') });
      R.top.forEach((e, i) => s.text(R.gates[i]!.toFixed(2), G.cx(e), G.gY, { font: 'mono', size: 3.2, weight: 700, color: s.c('gold') }));
    });
    // The experts.
    const eA = s.ease('topk', 0.6);
    s.alpha(Math.max(pA, eA) * lowA, () => {
      const runA = s.ease('run', 0.6);
      for (let e = 0; e < 8; e++) {
        const chosen = top.has(e);
        const on = chosen ? runA : 0.05;
        s.alpha(chosen ? 1 : 1 - 0.6 * kA, () => box(s, G.cx(e) - G.cw * 0.42, G.eY, G.cw * 0.84, G.eH, chosen && runA > 0.5 ? `FFN${sub(e)}` : String(e), ekey(e), { on, size: 3.2 }));
      }
    });
    // Weighted sum and the residual.
    const sA = s.ease('sum', 0.6) * lowA;
    s.alpha(sA, () => {
      s.circle(w / 2, G.sY, 3.6 * u, { fill: s.tint('gold', 0.15), stroke: s.c('gold'), lw: 0.4 });
      s.text('Σ', w / 2, G.sY + 0.3 * u, { size: 4.6, weight: 650, color: s.c('gold') });
      R.top.forEach((e) => s.arrow(G.cx(e), G.gY + 2.5 * u, w / 2 + (G.cx(e) - w / 2) * 0.12, G.sY - 4 * u, s.tint(ekey(e), 0.9), 0.4, 1.8));
      const terms = R.top.map((e, i) => `${R.gates[i]!.toFixed(2)}·FFN${sub(e)}(x)`).join(' + ');
      s.alpha(1 - s.ease('residual', 0.5), () => s.text(`y = ${terms}`, w / 2, G.oY, { font: 'mono', size: Math.min(3.6, (w / u) * 0.034), weight: 600 }));
    });
    s.alpha(s.win('residual', 'cost') * lowA, () => s.text('x  ←  x + y', w / 2, G.oY, { font: 'mono', size: 4, weight: 650, color: s.c('orange') }));
    s.alpha(s.win('cost', 'every'), () => note(s, 'compute grows with k, not with E', G.oY, 1, 'teal', 4));
    // GShard versus Mixtral: which layers are MoE.
    const vA = s.ease('every', 0.7);
    s.alpha(vA, () => {
      const rows: [string, (i: number) => boolean][] = [
        ['GShard', (i) => i % 2 === 1],
        ['Mixtral', () => true],
      ];
      const n = 8;
      const lw = Math.min(9 * u, (w - 30 * u) / n);
      rows.forEach(([nm, moe], r) => {
        const y = G.sY - 4 * u + r * 10 * u;
        s.text(nm, 4 * u + 20 * u, y + 3 * u, { size: 3.6, font: 'ui', weight: 650, align: 'right' });
        for (let i = 0; i < n; i++) {
          const x = 27 * u + i * (lw + u);
          box(s, x, y, lw, 6 * u, moe(i) ? 'MoE' : 'FFN', moe(i) ? 'purple' : 'slate', { on: moe(i) ? 0.6 : 0.1, size: 2.8 });
        }
      });
    });
  },
};

// ---------------------------------------------------------------- router

function routerGeo(s: Scene) {
  const { w, h, u } = s;
  if (s.tall) {
    const S = Math.min(h * 0.52, w * 0.62);
    return { px: (w - S) / 2, py: 3 * u, S, bx: 6 * u, by: 3 * u + S + 5 * u, bw: w - 12 * u, bh: h - S - 12 * u };
  }
  const S = Math.min(h * 0.8, w * 0.48);
  return { px: 5 * u, py: (h - S) / 2, S, bx: 5 * u + S + 7 * u, by: h * 0.16, bw: w - S - 17 * u, bh: h * 0.62 };
}

let regionCv: HTMLCanvasElement | null = null;
let regionKey = '';
function regions(s: Scene): HTMLCanvasElement {
  const cols = Array.from({ length: 8 }, (_, e) => s.c(ekey(e)));
  const key = cols.join();
  if (regionCv && key === regionKey) return regionCv;
  const N = 80;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d')!;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = -1.65 + ((i + 0.5) / N) * 3.3;
      const y = 1.65 - ((j + 0.5) / N) * 3.3;
      let best = 0;
      let bv = -Infinity;
      R_W.forEach(([a, b], e) => {
        if (a * x + b * y > bv) {
          bv = a * x + b * y;
          best = e;
        }
      });
      ctx.fillStyle = cols[best]!;
      ctx.fillRect(i, j, 1, 1);
    }
  regionCv = cv;
  regionKey = key;
  return cv;
}

const router: SceneDef = {
  draw(s) {
    const { u } = s;
    const G = routerGeo(s);
    const R = ROUTED;
    const top = new Set(R.top);
    const P = (x: number, y: number): [number, number] => [G.px + ((x + 1.65) / 3.3) * G.S, G.py + ((1.65 - y) / 3.3) * G.S];
    // The plane: arrows, regions, the token.
    s.rrect(G.px, G.py, G.S, G.S, 1.5, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.3 });
    const regA = s.ease('regions', 0.8);
    if (regA > 0) {
      const c = s.ctx;
      c.save();
      c.beginPath();
      c.roundRect(G.px, G.py, G.S, G.S, 1.5 * u);
      c.clip();
      c.globalAlpha *= 0.2 * regA;
      c.imageSmoothingEnabled = true;
      c.drawImage(regions(s), G.px, G.py, G.S, G.S);
      c.restore();
    }
    const [ox, oy] = P(0, 0);
    s.line(G.px, oy, G.px + G.S, oy, s.c('--grid'), 0.2);
    s.line(ox, G.py, ox, G.py + G.S, s.c('--grid'), 0.2);
    const arA = s.ease('arrows', 0.7);
    const tokA = s.ease('probs', 0.6);
    s.alpha(Math.max(arA, 0.35), () =>
      R_W.forEach(([a, b], e) => {
        const [x1, y1] = P(a * 0.5, b * 0.5);
        const chosen = top.has(e) && s.since('topk') > 0;
        s.arrow(ox, oy, x1, y1, chosen ? s.c(ekey(e)) : s.tint(ekey(e), 0.7), chosen ? 0.65 : 0.4, 2);
        const L = Math.hypot(a, b) * 0.5 + 0.16;
        const ang = Math.atan2(b, a);
        const [lx, ly] = P(Math.cos(ang) * L, Math.sin(ang) * L);
        s.text(String(e), lx, ly, { font: 'mono', size: 3.3, weight: 700, color: s.c(ekey(e)), halo: true });
      }),
    );
    s.alpha(tokA, () => {
      const [tx, ty] = P(X_TOK[0], X_TOK[1]);
      s.arrow(ox, oy, tx, ty, s.c('orange'), 0.6, 2.2);
      s.circle(tx, ty, 1.5 * u, { fill: s.c('orange'), stroke: s.c('--paper'), lw: 0.3 });
      s.text('x', tx + 3 * u, ty - 2.4 * u, { size: 4.4, italic: true, weight: 650, color: s.c('orange'), halo: true });
    });
    s.alpha(s.win('classifier', 'arrows'), () => s.text('W_r: one arrow per expert', G.px + G.S / 2, G.py + G.S - 4 * u, { size: 3.3, font: 'mono', weight: 600, color: s.c('blue'), halo: true }));
    // The bars.
    const bA = s.ease('probs', 0.7);
    const kA = s.ease('topk', 0.6);
    const gA = s.ease('renorm', 0.8);
    const sw = current(s, ['switch', 'switch2', 'learn']);
    const k1 = sw === 'switch' || sw === 'switch2';
    const topNow = k1 ? new Set([R.top[0]!]) : top;
    s.alpha(bA, () => {
      const cw = G.bw / 8;
      const lab = 7 * u;
      const base = G.by + G.bh - lab;
      const bh = base - G.by - 7 * u;
      const sc = (v: number) => (v / 0.6) * bh;
      for (let e = 0; e < 8; e++) {
        const cx = G.bx + (e + 0.5) * cw;
        const chosen = topNow.has(e);
        const ph = sc(R.probs[e]!);
        s.alpha(chosen ? 1 : 1 - 0.6 * kA, () => s.rrect(cx - cw * 0.36, base - ph, cw * 0.32, Math.max(ph, 0.4), 0.5, { fill: s.tint('purple', 0.75) }));
        if (chosen) {
          const gi = R.top.indexOf(e);
          let g = lerp(R.probs[e]!, R.gates[gi]!, gA);
          if (sw === 'switch') g = 1;
          if (sw === 'switch2') g = R.probs[e]!;
          const gh = Math.min(sc(g), bh) * kA;
          s.rrect(cx + cw * 0.04, base - gh, cw * 0.32, Math.max(gh, 0.4), 0.5, { fill: s.tint('gold', 0.8), stroke: s.c('gold'), lw: 0.25 });
          s.alpha(kA, () => s.text(g.toFixed(2), cx + cw * 0.2, base - gh - 2.4 * u, { font: 'mono', size: 2.9, weight: 700, color: s.c('gold'), halo: true }));
        }
        s.text(String(e), cx, base + 3 * u, { font: 'mono', size: 3.2, weight: 700, color: s.c(ekey(e)) });
        s.alpha(1 - kA, () => s.text(R.probs[e]!.toFixed(2).replace(/^0/, ''), cx - cw * 0.2, base - ph - 2.2 * u, { font: 'mono', size: 2.8, color: s.c('purple'), halo: true }));
      }
      s.line(G.bx, base, G.bx + G.bw, base, s.c('--axis'), 0.25);
      s.text('p', G.bx, G.by + 2 * u, { size: 4, italic: true, weight: 650, align: 'left', color: s.c('purple') });
      s.alpha(kA, () => s.text('g', G.bx + 4 * u, G.by + 2 * u, { size: 4, italic: true, weight: 650, align: 'left', color: s.c('gold') }));
    });
    // What the bars mean, one line at a time.
    const lineY = s.tall ? G.by - 1.5 * u : G.by + G.bh + 6 * u;
    const msgs: [string, string, K][] = [
      ['topk', 'kept: .37 + .32 = .70', 'purple'],
      ['renorm', 'renormalized: .54 + .46 = 1', 'gold'],
      ['same', '= softmax(logits[top])', 'gold'],
      ['switch', 'top-1, renormalized: g = 1 always', 'red'],
      ['switch2', 'Switch: g = p = .37', 'teal'],
      ['learn', 'learned only through the gates', '--ink-2'],
    ];
    const cur = current(s, msgs.map((m) => m[0]));
    const m = msgs.find((x) => x[0] === cur);
    if (m) {
      const lx = s.tall ? s.w / 2 : G.bx + G.bw / 2;
      s.alpha(s.ease(m[0], 0.5), () => pill(s, m[1], lx, lineY, m[2], { size: 3.3 }));
    }
    s.alpha(s.win('classifier', 'arrows'), () => {
      if (s.tall) note(s, 'a linear classifier: experts instead of classes', G.by + G.bh / 2, 1, '--ink-2', 3.8);
      else {
        s.text('a linear classifier,', G.bx + G.bw / 2, s.h * 0.46, { size: 4, italic: true, color: s.c('--ink-2') });
        s.text('with experts as the classes', G.bx + G.bw / 2, s.h * 0.46 + 6 * u, { size: 4, italic: true, color: s.c('--ink-2') });
      }
    });
  },
};

// ---------------------------------------------------------------- params

const MIX = moeParams(SHAPE_7B, 8, 2);
const BATCH: number[][] = (() => {
  const r = new Rng(12);
  return Array.from({ length: 16 }, () => r.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 2));
})();

const params: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const mx = 6 * u;
    const W0 = w - 2 * mx;
    s.alpha(s.ease('two', 0.6), () => s.text('Mixtral 8x7B', w / 2, h * 0.07, { size: 5.6, font: 'display', weight: 600 }));
    // One layer: attention, router, eight experts.
    const ly = h * 0.14;
    const lh = Math.min(h * 0.11, 11 * u);
    const aw = Math.min(W0 * 0.22, 22 * u);
    const ex0 = mx + aw + 5 * u;
    const ew = (w - mx - ex0) / 8;
    const batchT = s.since('batch') >= 0 ? s.prog('batch') * 16 : 0;
    const lit = new Set<number>();
    if (s.since('batch') >= 0) for (let t = 0; t < Math.min(16, Math.floor(batchT)); t++) for (const e of BATCH[t]!) lit.add(e);
    const curTok = s.since('batch') >= 0 && batchT < 16 ? BATCH[Math.floor(batchT)] : null;
    s.alpha(s.ease('two', 0.6, 0.3), () => {
      box(s, mx, ly, aw, lh, 'attention', 'blue', { on: s.since('shared') >= 0 && s.since('expert') < 0 ? 0.7 : 0.15, size: 3, font: 'ui' });
      s.rrect(mx + aw + 1.5 * u, ly, 2 * u, lh, 0.6, { fill: s.tint('gold', 0.3), stroke: s.c('gold'), lw: 0.25 });
      for (let e = 0; e < 8; e++) {
        let on = 0.08;
        if (s.since('expert') >= 0 && s.since('sum') < 0) on = e === 0 ? 0.8 : 0.08;
        else if (s.since('active') >= 0 && s.since('batch') < 0) on = e === 1 || e === 4 ? 0.85 : 0.08;
        if (s.since('batch') >= 0) on = curTok?.includes(e) ? 1 : lit.has(e) ? 0.5 : 0.06;
        box(s, ex0 + e * ew + 0.4 * u, ly, ew - 0.8 * u, lh, String(e), ekey(e), { on, size: 3.2 });
      }
    });
    // Total and active bars, by part.
    const bx = mx + 14 * u;
    const bw = w - bx - mx;
    const scale = bw / MIX.total;
    const parts = (o: typeof MIX.parts): [number, K][] => [
      [o.embed + o.attn + o.router, 'slate'],
      [o.experts, 'purple'],
    ];
    const bar = (y: number, label: string, o: typeof MIX.parts, grow: number, a: number) =>
      s.alpha(a, () => {
        s.text(label, mx, y + 3.3 * u, { size: 3.6, font: 'ui', weight: 650, align: 'left' });
        let x = bx;
        parts(o).forEach(([v, k], i) => {
          const ww = v * scale * (i === 0 ? 1 : grow);
          s.rrect(x, y, Math.max(ww, 0.5), 6.6 * u, 0.6, { fill: s.tint(k, 0.7) });
          x += ww;
        });
        const val = o.embed + o.attn + o.router + o.experts * grow;
        const inside = x - bx > 26 * u;
        s.text(grow < 0.05 ? `shared ${human(val)}` : human(val), inside ? x - 2 * u : x + 2 * u, y + 3.5 * u, { font: 'mono', size: 3.6, weight: 700, align: inside ? 'right' : 'left', color: inside ? '#ffffff' : s.c('--ink') });
      });
    const y1 = h * 0.33;
    const y2 = h * 0.43;
    // Expert segments hide while the arithmetic is built up, then grow back.
    const grow = s.since('name') < 0 ? 1 : s.ease('sum', 1.2);
    bar(y1, 'total', MIX.parts, grow, s.ease('total', 0.6));
    bar(y2, 'active', MIX.activeParts, grow, s.ease('active', 0.6));
    // The middle band: the naming puzzle, then the arithmetic.
    const my = h * 0.6;
    s.alpha(s.win('name', 'expert'), () => {
      s.text('8 × 7B = 56B ?', w / 2, my, { font: 'mono', size: 5.4, weight: 650, color: s.c('purple') });
      s.alpha(s.ease('shared', 0.5), () => {
        s.line(w / 2 - 22 * u, my, w / 2 + 22 * u, my, s.c('red'), 0.5);
        note(s, 'only the FFNs are copied: shared parts ≈ 1.6B', my + 9 * u, 1, 'slate', 3.6);
      });
    });
    s.alpha(s.win('expert', 'sum'), () => {
      s.text('expert = 3 × 4096 × 14336 = 176M', w / 2, my, { font: 'mono', size: Math.min(4, (w / u) * 0.037), weight: 650, color: s.c('purple') });
      note(s, 'in each of 32 layers', my + 8 * u, 1, '--ink-2', 3.6);
    });
    s.alpha(s.win('sum', 'price'), () => {
      s.text('1.6B + 32 × 8 × 176M = 46.7B', w / 2, my, { font: 'mono', size: Math.min(3.9, (w / u) * 0.036), weight: 650, color: s.c('purple') });
      s.text('1.6B + 32 × 2 × 176M = 12.9B', w / 2, my + 8 * u, { font: 'mono', size: Math.min(3.9, (w / u) * 0.036), weight: 650, color: s.c('orange') });
    });
    s.alpha(s.win('price', 'batch'), () => {
      pill(s, 'memory of a 47B model', w / 2, my - 2 * u, 'purple', { size: 3.5 });
      pill(s, 'compute of a 13B model', w / 2, my + 7 * u, 'orange', { size: 3.5 });
      s.alpha(s.ease('sixnd', 0.5), () => pill(s, 'C ≈ 6ND, with N = active', w / 2, my + 16 * u, 'teal', { size: 3.5 }));
    });
    // A batch of tokens touches nearly every expert.
    s.alpha(s.ease('batch', 0.5), () => {
      const n = Math.min(16, Math.floor(batchT) + 1);
      const tw = Math.min(5 * u, (w - 12 * u) / 18);
      for (let t = 0; t < 16; t++) {
        const x = w / 2 + (t - 8) * tw * 1.12;
        s.alpha(t < n ? 1 : 0.15, () => s.cell(x, my - 4 * u, tw, tw, '', 'orange', { on: t === n - 1 && batchT < 16 ? 1 : 0.3 }));
      }
      const cnt = s.since('memory') >= 0 ? 8 : lit.size;
      s.text(`tokens: ${Math.min(16, Math.ceil(batchT))}   experts read: ${cnt} of 8`, w / 2, my + 7 * u, { font: 'mono', size: 3.5, weight: 650 });
      s.alpha(s.ease('memory', 0.5), () => note(s, 'all 8 must be in memory, and all 8 are read', my + 16 * u, 1, 'red', 3.7));
    });
  },
};

export const scenesA: Record<string, SceneDef> = { intro, layer, router, params };
