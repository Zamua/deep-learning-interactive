import { type Scene, type SceneDef, lerp } from '../../lecture/scene';
import { CAP_E, CAP_T, capChoices, dispatch } from '../../lib/moe-figs2';
import { type K, box, current, ekey, loadBars, logCurve, note, pill, runs, snapAt, toyPanel } from './kit';

/** Panel on the left, a column of readouts on the right: works for both stage shapes. */
function sideGeo(s: Scene) {
  const { w, h, u } = s;
  const S = Math.min(h - 10 * u, w * 0.54);
  const px = 4 * u;
  const py = (h - S) / 2;
  const rx = px + S + 6 * u;
  return { S, px, py, rx, rw: w - rx - 4 * u };
}

// ---------------------------------------------------------------- collapse

const collapse: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Part 1: why imbalance hurts.
    const hwA = s.win('free', 'feeds');
    s.alpha(hwA, () => {
      s.text('4 GPUs, one expert each', w / 2, h * 0.12, { size: 3.8, font: 'ui', weight: 650, color: s.c('--ink-2') });
      const load = [0.5, 0.2, 0.18, 0.12];
      const gw = Math.min(22 * u, (w - 14 * u) / 4);
      const x0 = w / 2 - 2 * gw - 1.5 * u;
      const grow = s.ease('hardware', 1);
      for (let g = 0; g < 4; g++) {
        const x = x0 + g * (gw + u);
        box(s, x, h * 0.2, gw, 9 * u, `GPU ${g}`, ekey(g), { on: 0.2, size: 3.2, font: 'ui' });
        const bh = h * 0.42 * load[g]! * 2 * grow;
        s.rrect(x + gw * 0.25, h * 0.75 - bh, gw * 0.5, bh, 0.8, { fill: s.tint(ekey(g), 0.75) });
        s.text(`${Math.round(load[g]! * 100)}%`, x + gw / 2, h * 0.75 + 4 * u, { font: 'mono', size: 3.3, weight: 650, color: s.c(ekey(g)) });
      }
      s.alpha(s.ease('pace', 0.6), () => {
        const yb = h * 0.75 - h * 0.42;
        s.line(x0, yb, x0 + 4 * gw + 3 * u, yb, s.c('red'), 0.35, [1, 0.8]);
        note(s, 'the layer waits for the busiest GPU', h * 0.88, 1, 'red', 3.8);
      });
    });
    const fbA = s.win('feeds', 'toy');
    s.alpha(fbA, () => {
      const cx = w / 2;
      const cy = h * 0.48;
      const R = Math.min(w * 0.3, h * 0.3);
      const items: [string, K][] = [
        ['more tokens', 'blue'],
        ['more gradient', 'teal'],
        ['a better expert', 'green'],
        ['router prefers it', 'gold'],
      ];
      const ang = (i: number) => -Math.PI / 2 + (i * Math.PI) / 2;
      const al = (i: number) => s.ease(i < 3 ? 'feeds' : 'more', 0.5, i < 3 ? i * 0.9 : 0.2);
      items.forEach(([t, k], i) => {
        s.alpha(al(i), () => pill(s, t, cx + Math.cos(ang(i)) * R, cy + Math.sin(ang(i)) * R * 0.85, k, { size: 3.4 }));
        // The arrow into the next pill appears with that pill.
        s.alpha(al((i + 1) % 4) * al(i), () => {
          const a0 = ang(i) + 0.42;
          const a1 = ang(i + 1) - 0.42;
          s.arrow(cx + Math.cos(a0) * R * 0.75, cy + Math.sin(a0) * R * 0.65, cx + Math.cos(a1) * R * 0.75, cy + Math.sin(a1) * R * 0.65, s.c('--ink-3'), 0.4, 1.8);
        });
      });
    });
    // Part 2: the toy run.
    const tA = s.ease('toy', 0.7);
    if (tA > 0) {
      const G = sideGeo(s);
      const run = runs().none;
      const t = s.since('run') < 0 ? 0 : s.prog('run');
      const sn = snapAt(run, t, 400);
      s.slot('step', sn.step);
      s.slot('load', sn.load.join('/'));
      s.alpha(tA, () => {
        toyPanel(s, G.px, G.py, G.S, sn, { creases: s.ease('task', 0.6) });
        s.text(`step ${sn.step}`, G.px + 2.5 * u, G.py + 4 * u, { font: 'mono', size: 3.2, align: 'left', color: s.c('--ink-2'), halo: true });
        s.text('tokens per expert', G.rx, G.py + 3 * u, { size: 3.3, font: 'ui', weight: 650, align: 'left', color: s.c('--ink-2') });
        loadBars(s, G.rx, G.py + 7 * u, G.rw, G.S * 0.45, sn.load);
        const ty = G.py + G.S * 0.45 + 16 * u;
        s.text(`task loss ${sn.task.toFixed(3)}`, G.rx, ty, { font: 'mono', size: 3.3, weight: 650, align: 'left', color: s.c('red') });
        s.alpha(s.ease('collapse', 0.5), () => {
          s.text('3 experts idle', G.rx, ty + 8 * u, { size: 3.4, font: 'ui', weight: 650, align: 'left', color: s.c('red') });
          s.text('expert collapse', G.rx, ty + 15 * u, { size: 3.4, font: 'ui', weight: 650, align: 'left', color: s.c('red') });
        });
        s.alpha(s.ease('shazeer', 0.5), () => s.text('Shazeer et al., 2017', G.rx, ty + 22 * u, { size: 3.2, italic: true, align: 'left', color: s.c('--ink-2') }));
      });
    }
  },
};

// ---------------------------------------------------------------- auxloss

const SKEW = [0.55, 0.25, 0.15, 0.05];
const EVEN = [0.25, 0.25, 0.25, 0.25];
const ONE = [1, 0, 0, 0];

const auxloss: SceneDef = {
  marks: {
    loss: { tex: String.raw`\symL = \symE \sum_{i} \symf_i\,\symP_i`, x: 0.5, y: 0.09, size: 5.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // The loads drift: skewed, then even, then collapsed, then skewed again.
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => lerp(v, b[i]!, t));
    let F = SKEW;
    if (s.since('one') >= 0) F = mix(SKEW, EVEN, s.ease('one', 1));
    if (s.since('E') >= 0) F = mix(EVEN, ONE, s.ease('E', 1));
    if (s.since('grad') >= 0) F = mix(ONE, SKEW, s.ease('grad', 1));
    const P = F;
    const L = 4 * F.reduce((a, v, i) => a + v * P[i]!, 0);
    s.show('loss', s.ease('loss', 0.6));
    s.alpha(s.win('fix', 'f'), () => {
      s.text('one more term in the loss:', w / 2, h * 0.44, { size: 4.4, font: 'display', weight: 600 });
      note(s, 'lowest when every expert gets an even share', h * 0.44 + 9 * u, 1, '--ink-2', 4);
    });
    // Gauge.
    const gA = s.ease('loss', 0.6, 0.3);
    const gx0 = 8 * u;
    const gx1 = w - 8 * u;
    const gy = h * 0.22;
    const sx = (v: number) => gx0 + ((gx1 - gx0) * v) / 4;
    s.alpha(gA, () => {
      s.rrect(gx0, gy - 1.2 * u, gx1 - gx0, 2.4 * u, 1.2, { fill: s.tint('--ink-3', 0.18) });
      s.rrect(gx0, gy - 1.2 * u, Math.max(2.4 * u, sx(L) - gx0), 2.4 * u, 1.2, { fill: s.tint('red', 0.8) });
      for (const [v, t] of [[1, '1: balanced'], [4, '4: all on one']] as const) {
        s.line(sx(v), gy - 2.4 * u, sx(v), gy + 2.4 * u, s.c('--ink-2'), 0.3);
        s.text(t, sx(v), gy + 5 * u, { size: 3, font: 'ui', align: v === 4 ? 'right' : 'center', color: s.c('--ink-3') });
      }
      s.text(`= ${L.toFixed(2)}`, gx0, gy - 4.5 * u, { font: 'mono', size: 3.6, weight: 700, align: 'left', color: s.c('red') });
    });
    // Bars: f (teal) and P (purple) for four experts.
    const fA = s.ease('f', 0.6);
    const pA = s.ease('P', 0.6);
    const top = h * 0.44;
    const base = h * 0.84;
    const bh = base - top;
    const cw = (w - 12 * u) / 4;
    for (let e = 0; e < 4; e++) {
      const cx = 6 * u + (e + 0.5) * cw;
      const bw = Math.min(9 * u, cw * 0.3);
      s.alpha(fA, () => {
        const hh = F[e]! * bh;
        s.rrect(cx - bw - 0.5 * u, base - hh, bw, Math.max(hh, 0.4), 0.6, { fill: s.tint('teal', 0.75) });
        s.text(F[e]!.toFixed(2).replace(/^0/, ''), cx - bw / 2 - 0.5 * u, base - hh - 2.4 * u, { font: 'mono', size: 3, weight: 600, color: s.c('teal'), halo: true });
        s.text('f', cx - bw / 2 - 0.5 * u, base + 3 * u, { size: 3.6, italic: true, weight: 650, color: s.c('teal') });
      });
      s.alpha(pA, () => {
        const hh = P[e]! * bh;
        s.rrect(cx + 0.5 * u, base - hh, bw, Math.max(hh, 0.4), 0.6, { fill: s.tint('purple', 0.6) });
        s.text('P', cx + bw / 2 + 0.5 * u, base + 3 * u, { size: 3.6, italic: true, weight: 650, color: s.c('purple') });
        const push = s.ease('push', 0.6);
        const len = F[e]! * 4 * 5 * u * push;
        if (len > u) s.arrow(cx + bw / 2 + 0.5 * u, base - hh - len - 3 * u, cx + bw / 2 + 0.5 * u, base - hh - 0.8 * u, s.c('red'), 0.5, 1.6);
      });
      s.alpha(Math.max(fA, pA), () => s.text(`expert ${e}`, cx, base + 8 * u, { size: 3.2, font: 'ui', weight: 650, color: s.c(ekey(e)) }));
    }
    s.alpha(fA, () => s.line(6 * u, base, w - 6 * u, base, s.c('--axis'), 0.25));
    // One short label at a time, under the gauge.
    const msgs: [string, string, K][] = [
      ['f', 'f: share of tokens sent', 'teal'],
      ['P', 'P: mean router probability', 'purple'],
      ['grad', 'f is a count: no gradient', 'teal'],
      ['P2', 'P is smooth: the loss moves P', 'purple'],
      ['push', 'gradient on P is E·f: busiest pushed hardest', 'red'],
      ['alpha', 'loss = task + α · aux,  α ≈ 0.01', 'slate'],
    ];
    const cur = current(s, ['f', 'P', 'loss', 'grad', 'P2', 'push', 'alpha']);
    const m = msgs.find((x) => x[0] === cur);
    if (m) s.alpha(s.ease(m[0], 0.5), () => pill(s, m[1], w / 2, h * 0.355, m[2], { size: Math.min(3.4, (w / u) * 0.03) }));
  },
};

// ---------------------------------------------------------------- balance

const balance: SceneDef = {
  draw(s) {
    const { u } = s;
    const G = sideGeo(s);
    const run = runs().aux;
    const t = s.span('borders', 'faces');
    const sn = snapAt(run, t, 600);
    s.slot('step', sn.step);
    s.slot('task', sn.task.toFixed(4));
    toyPanel(s, G.px, G.py, G.S, sn, { creases: s.ease('faces', 0.6) });
    s.text(`step ${sn.step}`, G.px + 2.5 * u, G.py + 4 * u, { font: 'mono', size: 3.2, align: 'left', color: s.c('--ink-2'), halo: true });
    s.alpha(s.ease('resume', 0.6), () => pill(s, 'α = 0.1', G.px + G.S - 2 * u, G.py + 4.5 * u, 'red', { size: 3.2, align: 'right' }));
    s.text('tokens per expert', G.rx, G.py + 3 * u, { size: 3.3, font: 'ui', weight: 650, align: 'left', color: s.c('--ink-2') });
    loadBars(s, G.rx, G.py + 7 * u, G.rw, G.S * 0.36, sn.load);
    const cy = G.py + G.S * 0.36 + 18 * u;
    s.text(`task loss ${sn.task.toFixed(3)}`, G.rx, cy - 4 * u, { font: 'mono', size: 3.2, weight: 650, align: 'left', color: s.c('red') });
    const upto = Math.round(600 / 10);
    logCurve(s, G.rx, cy, G.rw, G.S * 0.3, run.slice(0, upto + 1).map((x) => x.task), t);
    const ny = cy + G.S * 0.3 + 7 * u;
    const msgs: [string, string, K][] = [
      ['better', '20x lower', 'green'],
      ['weak', 'α = 0.001: stuck', 'red'],
      ['zloss', 'z-loss (ST-MoE)', 'slate'],
      ['precision', 'router in fp32', 'slate'],
    ];
    const cur = current(s, msgs.map((m) => m[0]));
    const m = msgs.find((x) => x[0] === cur);
    if (m) s.alpha(s.ease(m[0], 0.5), () => pill(s, m[1], G.rx, ny, m[2], { size: 3.2, align: 'left' }));
  },
};

// ---------------------------------------------------------------- capacity

interface CapState {
  skew: number;
  cf: number;
}

function capState(s: Scene): CapState {
  const cur = current(s, ['fluct', 'tradeoff', 'skew']);
  if (cur === 'fluct') return { skew: 0, cf: 1 };
  if (cur === 'tradeoff') return { skew: 0, cf: 2 };
  if (cur === 'skew') return { skew: 1, cf: 1.25 };
  return { skew: 0.35, cf: 1.25 };
}

const capacity: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const st = capState(s);
    const choice = capChoices(st.skew);
    const D = dispatch(choice, st.cf);
    s.slot('cf', st.cf.toFixed(2));
    s.slot('C', D.C);
    s.slot('dropped', D.dropped);
    s.alpha(s.win('shapes', 'buffer'), () => note(s, 'fixed shapes, known before the batch arrives', h * 0.5, 1, '--ink-2', 4));
    // How many tokens have claimed their slot so far.
    const shown = s.since('line') < 0 ? 0 : s.since('full') < 0 ? Math.floor(s.prog('line') * CAP_T + 0.5) : CAP_T;
    const nShown = s.since('fluct') >= 0 ? CAP_T : shown;
    const bA = s.ease('buffer', 0.6);
    s.alpha(bA, () => {
      // The batch.
      const tw = Math.min(5 * u, (w - 10 * u) / CAP_T);
      const tx0 = (w - tw * CAP_T) / 2;
      const ty = h * 0.1;
      s.text('tokens, in arrival order', w / 2, ty - 3.5 * u, { size: 3.2, font: 'ui', weight: 650, color: s.c('--ink-2') });
      const dropA = s.ease('full', 0.5);
      choice.forEach((e, t) => {
        const placed = t < nShown;
        const dropped = D.slot[t] === 0 && placed;
        s.rrect(tx0 + t * tw + 0.15 * u, ty, tw - 0.3 * u, tw - 0.3 * u, 0.6, { fill: s.tint(ekey(e), placed && !dropped ? 0.2 : 0.8), stroke: dropped ? s.tint('red', dropA) : undefined, lw: 0.35 });
      });
      // Buffers.
      const lab = 18 * u;
      const maxC = Math.ceil((2 * CAP_T) / CAP_E);
      const sw = Math.min(6 * u, (w - lab - 26 * u) / maxC);
      const rh = Math.min(10 * u, h * 0.12);
      const by = h * 0.25;
      const count = new Array<number>(CAP_E).fill(0);
      for (let t = 0; t < nShown; t++) count[choice[t]!]!++;
      for (let e = 0; e < CAP_E; e++) {
        const y = by + e * rh * 1.15;
        s.text(`expert ${e}`, 4 * u, y + rh / 2, { size: 3.2, font: 'ui', weight: 650, align: 'left', color: s.c(ekey(e)) });
        for (let c = 0; c < D.C; c++) {
          const x = lab + c * sw;
          if (c < Math.min(count[e]!, D.C)) s.rrect(x + 0.2 * u, y, sw - 0.4 * u, rh, 0.6, { fill: s.tint(ekey(e), 0.8) });
          else {
            s.ctx.setLineDash([0.8 * u, 0.6 * u]);
            s.rrect(x + 0.3 * u, y + 0.1 * u, sw - 0.6 * u, rh - 0.2 * u, 0.6, { stroke: s.tint('--ink-3', 0.7), lw: 0.2 });
            s.ctx.setLineDash([]);
          }
        }
        const over = count[e]! - D.C;
        if (over > 0) s.alpha(dropA, () => s.text(`+${over} dropped`, lab + D.C * sw + 2 * u, y + rh / 2, { size: 3.3, font: 'ui', weight: 700, align: 'left', color: s.c('red') }));
      }
      const capX = lab + D.C * sw;
      s.line(capX, by - u, capX, by + CAP_E * rh * 1.15, s.c('red'), 0.3, [0.8, 0.6]);
      s.text(`C = ${D.C}`, capX, by - 3 * u, { font: 'mono', size: 3.2, weight: 700, color: s.c('red') });
      // The bottom line: settings and the count.
      const ly = by + CAP_E * rh * 1.15 + 8 * u;
      const empty = D.C * CAP_E - Math.min(nShown, CAP_T) + (nShown >= CAP_T ? D.dropped : 0);
      s.alpha(s.ease('factor', 0.5), () =>
        s.text(`capacity factor ${st.cf.toFixed(2)}   ·   dropped ${nShown >= CAP_T ? D.dropped : 0}   ·   empty ${Math.max(0, empty)}`, w / 2, ly, { font: 'mono', size: Math.min(3.3, (w / u) * 0.03), weight: 600 }),
      );
      const msgs: [string, string, K][] = [
        ['residual', 'dropped: skip the experts, ride the residual', 'red'],
        ['fluct', 'fair odds, factor 1.0: still overflows', 'gold'],
        ['tradeoff', 'factor 2.0: no drops, many empty slots', 'slate'],
        ['skew', 'skewed router: drops anyway', 'red'],
        ['dropless', 'dropless: MegaBlocks, DeepSeek-V3', 'green'],
      ];
      const cur = current(s, msgs.map((m) => m[0]));
      const m = msgs.find((x) => x[0] === cur);
      if (m) s.alpha(s.ease(m[0], 0.5), () => pill(s, m[1], w / 2, ly + 9 * u, m[2], { size: Math.min(3.3, (w / u) * 0.03) }));
    });
  },
};

export const scenesB: Record<string, SceneDef> = { collapse, auxloss, balance, capacity };
