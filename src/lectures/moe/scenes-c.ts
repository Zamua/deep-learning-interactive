import { Rng } from '../../core/rand';
import { type Scene, type SceneDef } from '../../lecture/scene';
import { A2A_BAL, A2A_G, A2A_PER, A2A_SKEW, a2aLayout } from '../../lib/moe-figs2';
import { comb, commas } from '../../lib/moe-math';
import { type K, current, ekey, loadBars, note, pill, runs, snapAt, toyPanel } from './kit';

// ---------------------------------------------------------------- deepseek

/** Lit routed experts for one token at split factor m with Ks shared experts. */
function picks(m: number, Ks: number): Set<number> {
  const routed = 16 * m - Ks;
  const ids = new Rng(5 + m * 7 + Ks).shuffle(Array.from({ length: routed }, (_, i) => i + Ks));
  return new Set(ids.slice(0, 2 * m - Ks));
}

const deepseek: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('what', 'big'), () => {
      s.text('DeepSeekMoE', w / 2, h * 0.42, { size: 8, font: 'display', weight: 600 });
      s.text('Dai et al., 2024', w / 2, h * 0.42 + 9 * u, { size: 4, italic: true, color: s.c('--ink-2') });
    });
    const gA = s.ease('big', 0.6);
    if (gA <= 0) return;
    const m = s.since('split') >= 0 && s.ease('split', 0.8) > 0.5 ? 4 : 1;
    const Ks = s.since('shared') >= 0 ? 1 : 0;
    const lit = picks(m, Ks);
    const gx = 5 * u;
    const gw = w - 10 * u;
    const gy = h * 0.1;
    const gh = h * 0.42;
    const cw = gw / 16;
    const rh = gh / m;
    s.alpha(gA, () => {
      for (let col = 0; col < 16; col++)
        for (let r = 0; r < m; r++) {
          const id = col * m + r;
          const shared = id < Ks;
          const on = shared || lit.has(id);
          const k: K = shared ? 'gold' : 'purple';
          s.rrect(gx + col * cw + 0.3 * u, gy + r * rh + 0.3 * u, cw - 0.6 * u, rh - 0.6 * u, Math.min(1, rh / s.u / 4), { fill: s.tint(k, on ? 0.8 : 0.1), stroke: s.tint(k, on ? 1 : 0.4), lw: 0.2 });
        }
      const ty = gy + gh + 7 * u;
      const lines: Record<string, [string, K]> = {
        big: ['16 experts, top-2: each one covers a lot', 'purple'],
        split: ['64 experts, each a quarter as wide: top-8', 'purple'],
        same: ['same parameters, same compute per token', 'teal'],
        special: ['narrow specialists, combined per token', 'teal'],
        shared: ['1 shared expert (gold): every token, no routing', 'gold'],
        why: ['7 routed + 1 shared: still 8 active', 'gold'],
      };
      const cur = current(s, ['big', 'split', 'same', 'combos', 'special', 'shared', 'why', 'v3']);
      const ln = cur ? lines[cur] : undefined;
      if (ln) note(s, ln[0], ty, s.ease(cur!, 0.5), ln[1], 3.8);
      // The counts of possible teams.
      const cy = ty + 11 * u;
      s.alpha(s.win('combos', 'shared'), () => {
        s.text(`C(16, 2) = ${commas(comb(16, 2))}`, w / 2, cy, { font: 'mono', size: 4, weight: 650, color: s.c('--ink-2') });
        s.alpha(s.ease('billions', 0.6), () => s.text(`C(64, 8) = ${commas(comb(64, 8))}`, w / 2, cy + 8 * u, { font: 'mono', size: Math.min(4.4, (w / u) * 0.042), weight: 700, color: s.c('purple') }));
      });
      s.alpha(s.ease('v3', 0.6), () => {
        pill(s, 'DeepSeek-V3: 1 shared + 256 routed, 8 per token', w / 2, cy, 'gold', { size: Math.min(3.4, (w / u) * 0.03) });
        pill(s, '671B total  ·  37B active', w / 2, cy + 9 * u, 'purple', { size: 3.4 });
      });
    });
  },
};

// ---------------------------------------------------------------- bias

function sideGeo(s: Scene) {
  const { w, h, u } = s;
  const S = Math.min(h - 10 * u, w * 0.54);
  const px = 4 * u;
  const py = (h - S) / 2;
  const rx = px + S + 6 * u;
  return { S, px, py, rx, rw: w - rx - 4 * u };
}

const bias: SceneDef = {
  draw(s) {
    const { u } = s;
    const G = sideGeo(s);
    const run = runs().bias;
    const t = s.span('toy', 'safety');
    const sn = snapAt(run, t, 600);
    const tA = s.ease('toy', 0.6);
    toyPanel(s, G.px, G.py, G.S, sn, { useBias: true });
    s.text(`step ${sn.step}`, G.px + 2.5 * u, G.py + 4 * u, { font: 'mono', size: 3.2, align: 'left', color: s.c('--ink-2'), halo: true });
    s.alpha(tA, () => pill(s, 'α = 0', G.px + G.S - 2 * u, G.py + 4.5 * u, 'slate', { size: 3.2, align: 'right' }));
    // The three rules, before the run.
    const rA = 1 - tA;
    s.alpha(rA, () => {
      const rules: [string, string, string, K][] = [
        ['bias', 'choose', 'top-k of s + b', 'green'],
        ['weigh', 'weigh', 'g = s / Σ s', 'gold'],
        ['update', 'update', 'b += γ·sign(c̄ − c)', 'teal'],
      ];
      const sz = Math.min(3.4, (G.rw / u) * 0.09);
      const step = Math.min(15 * u, G.S / 4);
      rules.forEach(([id, a, b, k], i) => {
        const y = G.py + 6 * u + i * step;
        s.alpha(s.ease(id, 0.5), () => {
          s.text(a, G.rx, y, { size: sz, font: 'ui', weight: 650, align: 'left', color: s.c('--ink-2') });
          s.text(b, G.rx, y + 5.5 * u, { size: sz, font: 'mono', weight: 650, align: 'left', color: s.c(k) });
        });
      });
      const py2 = G.py + 6 * u + 3 * step;
      s.alpha(s.ease('price', 0.5), () => {
        s.text('a price on', G.rx, py2, { size: sz, italic: true, align: 'left', color: s.c('--ink-2') });
        s.text('popular experts', G.rx, py2 + 5.5 * u, { size: sz, italic: true, align: 'left', color: s.c('--ink-2') });
      });
      s.alpha(s.win('compromise', 'v3'), () => {
        s.text('aux loss: its gradient', G.rx, G.py + 6 * u, { size: sz, italic: true, align: 'left', color: s.c('red') });
        s.text("mixes with the task's", G.rx, G.py + 11.5 * u, { size: sz, italic: true, align: 'left', color: s.c('red') });
      });
    });
    // The run: biases (signed) and loads.
    s.alpha(tA, () => {
      s.text('bias b per expert', G.rx, G.py + 3 * u, { size: 3.3, font: 'ui', weight: 650, align: 'left', color: s.c('--ink-2') });
      const bh = G.S * 0.2;
      const zy = G.py + 8 * u + bh;
      const cw = G.rw / 4;
      for (let e = 0; e < 4; e++) {
        const v = sn.bias[e]!;
        const hh = Math.max(-1, Math.min(1, v / 0.4)) * bh;
        s.rrect(G.rx + e * cw + cw * 0.2, hh > 0 ? zy - hh : zy, cw * 0.6, Math.max(Math.abs(hh), 0.4), 0.6, { fill: s.tint(ekey(e), 0.7) });
      }
      s.line(G.rx, zy, G.rx + G.rw, zy, s.c('--axis'), 0.25);
      const ly = zy + bh + 8 * u;
      s.text('tokens per expert', G.rx, ly, { size: 3.3, font: 'ui', weight: 650, align: 'left', color: s.c('--ink-2') });
      loadBars(s, G.rx, ly + 3 * u, G.rw, G.S * 0.32, sn.load);
      s.alpha(s.ease('safety', 0.5), () => pill(s, '+ a tiny balance loss', G.px + G.S / 2, G.py + G.S + 4 * u, 'slate', { size: 3.2 }));
    });
  },
};

// ---------------------------------------------------------------- parallel

const BAL = a2aLayout(A2A_BAL);
const SKW = a2aLayout(A2A_SKEW);

const parallel: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('big', 'ep'), () => note(s, 'hundreds of billions of parameters: more than one GPU holds', h * 0.5, 1, '--ink-2', 4));
    const A = s.ease('ep', 0.6);
    if (A <= 0) return;
    const skew = s.since('skew') >= 0;
    const L = skew ? SKW : BAL;
    const dest = skew ? A2A_SKEW : A2A_BAL;
    const gap = 2.5 * u;
    const gw = (w - 8 * u - 3 * gap) / A2A_G;
    const cell = Math.min(6 * u, (gw - 4 * u) / 3 - 0.8 * u);
    const pitch = cell + 0.8 * u;
    const top = h * 0.06;
    const homeY = top + 12 * u;
    const divY = homeY + 2 * pitch + 3 * u;
    const awayY = divY + 6 * u;
    const boxB = awayY + 4 * pitch + 2 * u;
    const slotXY = (g: number, sl: number, y0: number): [number, number] => [4 * u + g * (gw + gap) + (gw - 3 * pitch + 0.8 * u) / 2 + (sl % 3) * pitch, y0 + Math.floor(sl / 3) * pitch];
    // Where the tokens are: home, travelling out, away, travelling back.
    let out = 0;
    if (skew) out = s.ease('skew', 1.2) * (1 - s.ease('limits', 1));
    else if (s.since('dispatch') >= 0) out = s.ease('dispatch', 1.2) * (1 - s.ease('combine', 1.2));
    const done = !skew && s.since('combine') >= 0 && out < 0.05;
    const computing = !skew && s.since('compute') >= 0 && s.since('combine') < 0;
    s.alpha(A, () => {
      for (let g = 0; g < A2A_G; g++) {
        const x = 4 * u + g * (gw + gap);
        s.rrect(x, top, gw, boxB - top, 1.6, { fill: s.tint('--ink-3', 0.06), stroke: s.tint('--ink-3', 0.5), lw: 0.25 });
        s.text(`GPU ${g}`, x + gw / 2, top + 3.5 * u, { size: 3.3, font: 'ui', weight: 700 });
        s.text(`E${2 * g}`, x + gw / 2 - 1.2 * u, top + 8 * u, { size: 3, font: 'mono', weight: 700, align: 'right', color: s.c(ekey(2 * g)) });
        s.text(`E${2 * g + 1}`, x + gw / 2 + 1.2 * u, top + 8 * u, { size: 3, font: 'mono', weight: 700, align: 'left', color: s.c(ekey(2 * g + 1)) });
        s.line(x + 2 * u, divY, x + gw - 2 * u, divY, s.tint('--ink-3', 0.5), 0.2, [0.8, 0.6]);
        s.text('received', x + gw / 2, divY + 3 * u, { size: 2.9, font: 'ui', color: s.c('--ink-3') });
      }
      const tokA = s.ease('tokens', 0.6);
      s.alpha(tokA, () => {
        for (let g = 0; g < A2A_G; g++)
          for (let j = 0; j < A2A_PER; j++) {
            const [x0, y0] = slotXY(g, j, homeY);
            const [d, sl] = L.away(g, j);
            const [x1, y1] = slotXY(d, sl, awayY);
            const x = x0 + (x1 - x0) * out;
            const y = y0 + (y1 - y0) * out;
            const e = dest[g]![j]!;
            const glow = computing || done ? 0.9 : 0.5;
            s.rrect(x, y, cell, cell, 0.8, { fill: s.tint(ekey(e), glow), stroke: s.c(ekey(e)), lw: computing ? 0.4 : 0.2 });
          }
      });
      // Expert work per GPU.
      const wy = boxB + 7 * u;
      const wA = s.ease('compute', 0.6);
      s.alpha(wA, () => {
        s.text('expert work per GPU', 4 * u, wy, { size: 3.2, font: 'ui', weight: 650, align: 'left', color: s.c('--ink-2') });
        const mx = Math.max(...L.recv);
        for (let g = 0; g < A2A_G; g++) {
          const x = 4 * u + g * (gw + gap);
          const full = gw - 6 * u;
          const bw = (full * L.recv[g]!) / 12;
          s.rrect(x, wy + 3 * u, full, 3.6 * u, 0.8, { fill: s.tint('--ink-3', 0.12) });
          s.rrect(x, wy + 3 * u, Math.max(bw, u), 3.6 * u, 0.8, { fill: s.tint(skew && L.recv[g] === mx ? 'red' : 'teal', 0.75) });
          s.text(String(L.recv[g]), x + Math.max(bw, u) + 1.2 * u, wy + 5 * u, { font: 'mono', size: 3, weight: 650, align: 'left' });
        }
      });
      const ny = wy + 15 * u;
      const msgs: [string, string, K][] = [
        ['tokens', 'router: a destination per token', 'orange'],
        ['dispatch', 'all-to-all: dispatch', 'blue'],
        ['compute', 'experts run locally', 'teal'],
        ['combine', 'all-to-all: combine, then the residual', 'blue'],
        ['traffic', '2 trips × k × d per token, per layer', 'slate'],
        ['skew', 'skewed: GPU 0 gets 12, not 6', 'red'],
        ['wait', 'everyone waits for GPU 0', 'red'],
        ['limits', 'overlap with compute · at most 4 nodes', 'green'],
      ];
      const cur = current(s, msgs.map((m) => m[0]));
      const m = msgs.find((x) => x[0] === cur);
      if (m) s.alpha(s.ease(m[0], 0.5), () => pill(s, m[1], w / 2, Math.min(ny, h - 5 * u), m[2], { size: Math.min(3.3, (w / u) * 0.03) }));
    });
  },
};

// ---------------------------------------------------------------- outro

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const items: [string, string, K][] = [
      ['layer', 'a router runs the top k of E experts', 'purple'],
      ['counts', 'total sets memory, active sets compute', 'slate'],
      ['collapse', 'balance: aux loss E · Σ f P, 1 when even', 'red'],
      ['capacity', 'capacity: overflow rides the residual', 'gold'],
      ['deepseek', 'fine-grained, shared experts, bias terms', 'teal'],
      ['a2a', 'expert parallelism: two all-to-alls', 'blue'],
    ];
    const nA = s.ease('idea', 0.7);
    s.alpha(1 - nA, () => {
      const gap = Math.min(11 * u, (h * 0.8) / items.length);
      const y0 = h / 2 - (gap * (items.length - 1)) / 2;
      const sz = Math.min(3.6, (w / u) * 0.032);
      items.forEach(([id, t, k], i) => s.alpha(s.ease(id, 0.6), () => pill(s, t, w / 2, y0 + i * gap, k, { size: sz })));
    });
    s.alpha(nA, () => {
      const big = Math.min(6, (w / u) * 0.056);
      s.text('what a model knows', w / 2, h * 0.34, { size: big, font: 'display', weight: 600, color: s.c('purple') });
      s.text('and what each token costs', w / 2, h * 0.34 + big * 1.6 * u, { size: big, font: 'display', weight: 600, color: s.c('orange') });
      note(s, 'no longer have to grow together', h * 0.34 + big * 3.2 * u, 1, '--ink-2', 4.2);
      s.alpha(s.ease('end', 0.6), () => {
        const y = h * 0.74;
        const sz = Math.min(3.6, (w / u) * 0.03);
        pill(s, 'store a lot', w * 0.22, y, 'purple', { size: sz });
        pill(s, 'run a little', w * 0.5, y, 'orange', { size: sz });
        pill(s, 'keep it even', w * 0.78, y, 'teal', { size: sz });
      });
    });
  },
};

export const scenesC: Record<string, SceneDef> = { deepseek, bias, parallel, outro };
