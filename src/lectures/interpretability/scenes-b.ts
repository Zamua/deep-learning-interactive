import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { SAE_D, SAE_N, SAE_NAMES, TOY_N, TRUE_DIRS } from '../../lib/interpretability-toys';
import { FEAT, type K, area, box, fitSize, neuronSamples, overlapsOf, pill, pillRows, poly, probeCurves, saeRun, toyModel, toyRun } from './kit';

/* ------------------------------------------------------------------ probes */

const SCATTER: [number, number, number][] = (() => {
  const r = new Rng(12);
  return Array.from({ length: 40 }, (_, i) => {
    const c = i % 2;
    return [r.randn() * 0.38 + (c ? 0.9 : -0.9), r.randn() * 0.5 + (c ? -0.35 : 0.35), c];
  });
})();

const probes: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    // A probe: frozen activations in, a property out.
    const pA = s.win('cheap', 'prev');
    s.alpha(pA, () => {
      const parts: [string, K][] = [
        ['frozen model', 'slate'],
        ['activations x₁', 'orange'],
        ['probe: one matrix', 'teal'],
        ['previous letter?', 'gold'],
      ];
      const tall = s.tall;
      const bw = tall ? aw * 0.7 : (aw - u * 15) / 4;
      const bh = tall ? u * 8 : u * 11;
      parts.forEach(([lab, k], i) => {
        const x = tall ? ax + (aw - bw) / 2 : ax + i * (bw + u * 5);
        const y = tall ? ay + u * 1 + i * (bh + u * 4.5) : ay + ah * 0.2;
        const a = i === 0 ? s.ease('cheap', 0.5, 1.5) : s.ease('probe', 0.5, 0.9 * (i - 1));
        s.alpha(a, () => {
          box(s, x, y, bw, bh, lab, k, { size: 3.6, on: i === 2 && s.since('linear') >= 0 ? 1 : 0 });
          if (i > 0) {
            if (tall) s.arrow(x + bw / 2, y - u * 4, x + bw / 2, y - u * 0.6, s.tint('--ink-3', 0.8), 0.3, 1.6);
            else s.arrow(x - u * 5, y + bh / 2, x - u * 0.6, y + bh / 2, s.tint('--ink-3', 0.8), 0.3, 1.6);
          }
        });
      });
      // A linear readout.
      s.alpha(s.ease('linear', 0.6), () => {
        const top = ay + u * 1 + 4 * (u * 8 + u * 4.5) + u * 2;
        const size = tall ? Math.min(aw * 0.5, ay + ah - top - u * 2) : Math.min(aw * 0.36, ah * 0.42);
        const cx = w / 2;
        const cy = tall ? top + size / 2 : ay + ah * 0.72;
        const sc = size / 4.4;
        s.rrect(cx - size / 2, cy - size / 2, size, size, 1.2, { fill: s.tint('--paper-2', 1), stroke: s.c('--rule'), lw: 0.25 });
        SCATTER.forEach(([x, y, c]) => s.circle(cx + x * sc, cy - y * sc, u * 0.9, { fill: s.c(c ? 'gold' : 'slate') }));
        s.line(cx - 0.6 * sc, cy + 1.9 * sc, cx + 0.6 * sc, cy - 1.9 * sc, s.c('teal'), 0.5);
        s.text('a straight cut', cx + size / 2 + u * 2, cy, { font: 'ui', size: 3.2, weight: 600, align: 'left', color: s.c('teal') });
      });
    });
    // Accuracy of three probes.
    const bA = s.win('prev', 'lrh');
    if (bA > 0) {
      const H = probeCurves();
      const acc = H.map((h) => h[h.length - 1]!);
      const bw = aw / 5;
      const base = ay + ah * 0.82;
      const top = ay + ah * 0.12;
      s.alpha(bA, () => {
        s.line(ax, base, ax + aw, base, s.c('--axis'), 0.3);
        const ch = base - (base - top) * 0.05;
        s.line(ax, ch, ax + aw, ch, s.tint('red', 0.7), 0.25, [1, 1]);
        s.text('chance', ax, ch - u * 2, { font: 'ui', size: 3, align: 'left', color: s.c('red') });
        const labels: [string, string][] = [['x₀', 'embedding'], ['x₁', '+ head 0'], ['x₂', '+ head 1']];
        labels.forEach(([sym, sub], l) => {
          const grow = l === 0 ? s.ease('prev', 1.2, 2) : s.ease('x1', 1.2, 0.8 + 0.6 * (l - 1));
          const x = ax + bw * (0.8 + 1.4 * l);
          const hh = (base - top) * acc[l]! * grow;
          s.rrect(x, base - Math.max(u * 0.4, hh), bw, Math.max(u * 0.4, hh), 0.8, { fill: s.tint('orange', 0.35 + 0.25 * l) });
          s.text(sym, x + bw / 2, base + u * 4, { font: 'ui', italic: true, size: 4.2, weight: 700, color: s.c('orange') });
          s.text(sub, x + bw / 2, base + u * 8.5, { font: 'ui', size: fitSize(s, sub, bw * 1.3, 3), color: s.c('--ink-3') });
          if (grow > 0.05) s.text(`${Math.round(acc[l]! * 100 * grow)}%`, x + bw / 2, base - hh - u * 2.6, { font: 'mono', size: 3.4, weight: 700, color: s.c('--ink') });
        });
        s.text('decoding the previous letter', w / 2, top - u * 4, { font: 'ui', size: fitSize(s, 'decoding the previous letter', aw, 3.8), weight: 600, color: s.c('gold') });
      });
    }
    // Directions.
    const dA = s.win('lrh', 'caveat');
    s.alpha(dA, () => {
      s.text('concepts as directions', w / 2, ay + u * 3, { font: 'display', size: fitSize(s, 'concepts as directions', aw, 5.4, 'display'), weight: 600, color: s.c('--accent') });
      const wa = s.ease('words', 0.6);
      const oa = s.ease('othello', 0.6);
      const half = s.tall ? aw : aw / 2 - u * 2;
      s.alpha(wa, () => {
        const ox = ax + u * 6;
        const oy = s.tall ? ay + ah * 0.38 : ay + ah * 0.62;
        const sc = Math.min(half * 0.45, ah * 0.22);
        const pts: [string, number, number][] = [['man', 0, 0], ['woman', 0.95, 0.35], ['king', 0.25, 0.85], ['queen', 1.2, 1.2]];
        s.arrow(ox + pts[0]![1] * sc, oy - pts[0]![2] * sc, ox + pts[1]![1] * sc, oy - pts[1]![2] * sc, s.c('teal'), 0.5, 2);
        s.arrow(ox + pts[2]![1] * sc, oy - pts[2]![2] * sc, ox + pts[3]![1] * sc, oy - pts[3]![2] * sc, s.c('teal'), 0.5, 2);
        pts.forEach(([nm, x, y]) => {
          s.circle(ox + x * sc, oy - y * sc, u * 0.9, { fill: s.c('--ink-2') });
          s.text(nm, ox + x * sc + u * 1.6, oy - y * sc + u * 2.8, { font: 'ui', size: 3.2, weight: 600, align: 'left', color: s.c('--ink-2') });
        });
      });
      s.alpha(oa, () => {
        const n = 8;
        const size = Math.min(s.tall ? aw * 0.42 : half * 0.7, ah * (s.tall ? 0.36 : 0.55));
        const bx = s.tall ? ax + aw - size - u * 2 : ax + half + u * 4 + (half - size) / 2;
        const by = s.tall ? ay + ah - size - u * 6 : ay + ah * 0.22;
        const cs = size / n;
        const r = new Rng(3);
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            s.rrect(bx + j * cs, by + i * cs, cs, cs, 0, { fill: s.tint('green', 0.18), stroke: s.tint('green', 0.4), lw: 0.15 });
            const v = r.next();
            if (v < 0.55) s.circle(bx + j * cs + cs / 2, by + i * cs + cs / 2, cs * 0.36, { fill: v < 0.3 ? s.c('orange') : s.c('blue') });
          }
        s.text('Othello: mine · theirs', bx + size / 2, by + size + u * 4, { font: 'ui', size: fitSize(s, 'Othello: mine · theirs', size * 1.3, 3.4), weight: 600, color: s.c('--ink-2') });
      });
    });
    // Present is not used.
    const cA = s.ease('caveat', 0.6);
    s.alpha(cA, () => {
      s.text('present ≠ used', w / 2, ay + ah * 0.18, { font: 'display', size: 7, weight: 600, color: s.c('red') });
      s.alpha(s.ease('patch', 0.6), () => {
        const y0 = ay + ah * 0.38;
        const bw = Math.min(aw * 0.28, u * 26);
        const rows: [string, K][] = [['input A', 'orange'], ['input B', 'blue']];
        rows.forEach(([lab, k], i) => {
          const y = y0 + i * u * 20;
          s.text(lab, ax + u * 2, y + u * 4, { font: 'ui', size: 3.4, weight: 600, align: 'left', color: s.c(k) });
          box(s, ax + aw * 0.3, y, bw, u * 8, 'activation', k, { size: 3.2 });
          box(s, ax + aw - bw, y, bw, u * 8, i === 0 ? 'output changes?' : 'output', i === 0 ? 'red' : k, { size: 3.2, on: i === 0 ? s.ease('patch', 0.6, 2.5) : 0 });
          s.arrow(ax + aw * 0.3 + bw + u, y + u * 4, ax + aw - bw - u, y + u * 4, s.tint('--ink-3', 0.8), 0.3, 1.6);
        });
        s.alpha(s.ease('patch', 0.6, 1.2), () => s.arrow(ax + aw * 0.3 + bw / 2, y0 + u * 20, ax + aw * 0.3 + bw / 2, y0 + u * 8.5, s.c('red'), 0.6, 2.2));
        s.alpha(s.ease('patch', 0.6, 1.2), () => s.text('swap in', ax + aw * 0.3 + bw / 2 + u * 2, y0 + u * 14, { font: 'ui', size: 3.2, weight: 700, align: 'left', color: s.c('red'), halo: true }));
      });
    });
  },
};

/* ------------------------------------------------------------------ superposition */

function arrows2d(s: Scene, cx: number, cy: number, r: number, cols: [number, number][], o: { lit?: number; label?: string; below?: boolean } = {}): void {
  const { u } = s;
  s.circle(cx, cy, r, { stroke: s.tint('--ink-3', 0.5), lw: 0.2 });
  s.line(cx - r * 1.15, cy, cx + r * 1.15, cy, s.tint('--axis', 0.8), 0.2);
  s.line(cx, cy - r * 1.15, cx, cy + r * 1.15, s.tint('--axis', 0.8), 0.2);
  cols.forEach(([a, b], i) => {
    const n = Math.hypot(a, b);
    if (n < 0.02) return;
    const k = FEAT[i]!;
    s.arrow(cx, cy, cx + a * r, cy - b * r, s.c(k), i === o.lit ? 0.75 : 0.55, 2.4);
    if (n > 0.2) s.text(String(i + 1), cx + a * r * (1 + 0.18 / n), cy - b * r * (1 + 0.18 / n), { font: 'ui', size: 3.6, weight: 700, color: s.c(k), halo: true });
  });
  if (o.label) s.text(o.label, cx, o.below ? cy + r * 1.15 + u * 3 : cy - r * 1.15 - u * 2.5, { font: 'mono', size: 3.2, weight: 600, color: s.c('--ink-2'), halo: true });
}

const superposition: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    // d dimensions, d right angles; nearly perpendicular in high d.
    const nA = s.win('count', 'toy');
    s.alpha(nA, () => {
      const histOn = s.ease('nearly', 0.6);
      const r = Math.min(aw, ah) * 0.26;
      const cx = s.tall ? w / 2 : lerp(w / 2, ax + aw * 0.2, histOn);
      const rr = s.tall ? lerp(r, r * 0.4, histOn) : lerp(r, r * 0.8, histOn);
      const cy = s.tall ? lerp(ay + ah * 0.45, ay + rr + u * 6, histOn) : ay + ah * 0.45;
      arrows2d(s, cx, cy, rr, [[1, 0], [0, 1]], { label: 'd = 2: two right angles', below: true });
      s.alpha(s.ease('exact', 0.6) * (1 - histOn), () => s.text('a model needs far more than d', w / 2, ay + ah - u * 3, { font: 'ui', size: fitSize(s, 'a model needs far more than d', aw, 4), weight: 600, color: s.c('--ink-2') }));
      if (histOn > 0) {
        const hx = s.tall ? ax : ax + aw * 0.42;
        const hw = s.tall ? aw : aw * 0.58;
        const hy = s.tall ? cy + rr * 1.15 + u * 12 : ay + u * 6;
        const hh = s.tall ? ay + ah - hy - u * 10 : ah * 0.72;
        const ds = [3, 30, 300];
        const rowH = hh / 3;
        s.alpha(histOn, () => {
          ds.forEach((d, i) => {
            const ov = overlapsOf(d);
            const bins = new Array<number>(20).fill(0);
            ov.forEach((v) => bins[Math.min(19, Math.floor(v * 20))]!++);
            const mx = Math.max(...bins);
            const y = hy + i * rowH;
            const bw = (hw - u * 14) / 20;
            const x0 = hx + u * 14;
            s.text(`d = ${d}`, hx, y + rowH * 0.5, { font: 'mono', size: 3.2, weight: 600, align: 'left', color: s.c('--ink-2') });
            bins.forEach((b, j) => {
              const bh = (b / mx) * (rowH - u * 5);
              s.rrect(x0 + j * bw + 0.5, y + rowH - u * 3 - bh, bw - 1, bh, 0.3, { fill: s.tint('green', 0.65) });
            });
            s.line(x0, y + rowH - u * 3, x0 + 20 * bw, y + rowH - u * 3, s.c('--axis'), 0.2);
          });
          const x0 = hx + u * 14;
          const bw = (hw - u * 14) / 20;
          s.text('0', x0, hy + hh + u * 0.5, { font: 'mono', size: 2.8, color: s.c('--ink-3') });
          s.text('1', x0 + 20 * bw, hy + hh + u * 0.5, { font: 'mono', size: 2.8, color: s.c('--ink-3') });
          s.text('overlap |cos| of random directions', x0 + 10 * bw, hy - u * 2.5, { font: 'ui', size: fitSize(s, 'overlap |cos| of random directions', hw - u * 14, 3.2), weight: 600, color: s.c('green') });
        });
        s.alpha(s.ease('cost', 0.6, 2.5), () => pill(s, 'the price: interference', s.tall ? w / 2 : ax + aw * 0.2, ay + ah - u * 3, 'red', { size: 3.4 }));
      }
    });
    // The toy model.
    const tA = s.win('toy', 'dense');
    s.alpha(tA, () => {
      const cells: [string, number, K][] = [['f', 5, 'green'], ['x', 2, 'orange'], ['f̂', 5, 'green']];
      const cs = Math.min(u * 8, ah / 9);
      const colX = [ax + aw * 0.15, ax + aw * 0.5, ax + aw * 0.85];
      cells.forEach(([lab, n, k], c) => {
        const x = colX[c]! - cs / 2;
        const y0 = ay + ah * 0.45 - (n * cs) / 2;
        s.alpha(s.ease('toy', 0.5, 0.6 * c), () => {
          for (let i = 0; i < n; i++) s.rrect(x, y0 + i * cs, cs, cs * 0.9, 1, { fill: s.tint(n === 5 ? FEAT[i]! : k, 0.25), stroke: s.tint(n === 5 ? FEAT[i]! : k, 0.7), lw: 0.25 });
          s.text(lab, colX[c]!, y0 - u * 4, { font: 'serif', italic: true, size: 5, weight: 650, color: s.c(k) });
          s.text(`${n} numbers`, colX[c]!, y0 + n * cs + u * 3, { font: 'mono', size: 2.8, color: s.c('--ink-3') });
        });
      });
      s.alpha(s.ease('toy', 0.5, 1.4), () => {
        s.arrow(colX[0]! + cs, ay + ah * 0.45, colX[1]! - cs, ay + ah * 0.45, s.c('blue'), 0.45, 2);
        s.text('W', (colX[0]! + colX[1]!) / 2, ay + ah * 0.45 - u * 4, { font: 'serif', italic: true, size: 4.6, weight: 650, color: s.c('blue') });
      });
      s.alpha(s.ease('decode', 0.5), () => {
        s.arrow(colX[1]! + cs, ay + ah * 0.45, colX[2]! - cs, ay + ah * 0.45, s.c('blue'), 0.45, 2);
        s.text('ReLU(Wᵀx + b)', (colX[1]! + colX[2]!) / 2, ay + ah * 0.45 - u * 4, { font: 'mono', size: fitSize(s, 'ReLU(Wᵀx + b)', aw * 0.3, 3.4, 'mono'), weight: 600, color: s.c('blue') });
        s.text('feature 1 matters most', w / 2, ay + ah * 0.86, { font: 'ui', size: 3.6, weight: 600, color: s.c('--ink-2') });
      });
    });
    // Training runs, dense then sparse.
    const rA = s.win('dense', 'one');
    if (rA > 0) {
      const which = s.since('between') >= 0 ? 0.8 : s.since('sparse') >= 0 ? 0.95 : 0;
      const run = toyRun(which);
      const prog = which === 0 ? s.ease('dense', 3.5, 0.3) : which === 0.95 ? (s.since('pentagon') >= 0 ? s.ease('pentagon', 3.5) : 0) : 1;
      const snap = run[Math.round(prog * (run.length - 1))]!;
      const r = Math.min(aw, ah) * 0.32;
      const label = which === 0 ? 'dense: S = 0' : which === 0.95 ? 'sparse: S = 0.95' : 'S = 0.8';
      s.alpha(rA, () => arrows2d(s, w / 2, ay + ah * 0.45, r, snap, { label }));
      s.alpha(rA * s.ease('dense', 0.5, 2.5) * (which === 0 ? 1 : 0), () => s.text('two kept, at right angles', w / 2, ay + ah - u * 1, { font: 'ui', size: 3.6, weight: 600, color: s.c('--ink-2') }));
      s.alpha(rA * (which === 0.95 ? s.ease('pentagon', 0.5, 2.2) : 0), () => s.text('all five: a pentagon', w / 2, ay + ah - u * 1, { font: 'ui', size: 3.6, weight: 600, color: s.c('--ink-2') }));
      s.alpha(rA * (which === 0.8 ? 1 : 0), () => s.text('four: two opposite pairs', w / 2, ay + ah - u * 1, { font: 'ui', size: 3.6, weight: 600, color: s.c('--ink-2') }));
    }
    // One feature in, signal and leak out.
    const oA = s.ease('one', 0.6);
    if (oA > 0) {
      const m = toyModel(0.95);
      const G = m.gram();
      const two = s.ease('rare', 0.6);
      const fin = [1, two, 0, 0, 0];
      const out = m.reconstruct(fin);
      const pre = Array.from({ length: TOY_N }, (_, k) => G[k]![0]! + two * G[k]![1]! + m.b[k]!);
      const r = Math.min(aw * 0.25, ah * 0.2);
      const cols = Array.from({ length: TOY_N }, (_, i) => m.col(i));
      s.alpha(oA, () => {
        arrows2d(s, s.tall ? w / 2 : ax + aw * 0.2, s.tall ? ay + r + u * 3 : ay + ah * 0.45, r, cols, { lit: 0 });
        const bx = s.tall ? ax : ax + aw * 0.42;
        const bwAll = s.tall ? aw : aw * 0.58;
        const by = s.tall ? ay + 2 * r + u * 14 : ay + ah * 0.18;
        const bh = s.tall ? ay + ah - by - u * 10 : ah * 0.68;
        const mid = by + bh * 0.74;
        const sc = bh * 0.44;
        const bw = bwAll / TOY_N;
        s.line(bx, mid, bx + bwAll, mid, s.c('--axis'), 0.25);
        const cut = s.ease('relu', 0.6);
        for (let k = 0; k < TOY_N; k++) {
          const x = bx + k * bw + bw * 0.2;
          const ww = bw * 0.6;
          const pv = Math.max(-0.5, Math.min(1.6, pre[k]!));
          s.ctx.save();
          s.ctx.setLineDash([u * 0.8, u * 0.6]);
          s.rrect(x, Math.min(mid, mid - pv * sc), ww, Math.max(u * 0.3, Math.abs(pv) * sc), 0.4, { stroke: s.tint(FEAT[k]!, 0.9), lw: 0.3 });
          s.ctx.restore();
          const ov = lerp(Math.max(0, pv), Math.min(1.6, out[k]!), cut);
          if (ov > 0.003) s.rrect(x, mid - ov * sc, ww, ov * sc, 0.4, { fill: s.tint(FEAT[k]!, 0.75) });
          s.text(String(k + 1), x + ww / 2, mid + u * 3.5, { font: 'mono', size: 3.2, weight: 700, color: s.c(FEAT[k]!) });
        }
        s.line(bx, mid - sc, bx + bwAll, mid - sc, s.tint('--ink-3', 0.7), 0.2, [0.8, 0.8]);
        s.text('1', bx - u * 1.2, mid - sc, { font: 'mono', size: 2.8, align: 'right', color: s.c('--ink-3') });
        if (two > 0.5) s.text('overshoot', bx + bw * 2, mid - Math.min(1.6, out[1]!) * sc + u * 3, { font: 'ui', size: 3, weight: 700, align: 'left', color: s.c('red'), halo: true });
        const t = two > 0.5 ? 'features 1 and 2 on at once' : 'feature 1 alone, at 1';
        s.text(t, bx + bwAll / 2, by - u * 2, { font: 'ui', size: fitSize(s, t, bwAll, 3.6), weight: 600, color: s.c('--ink-2') });
        s.alpha(cut, () => s.text('dashed: before the ReLU · filled: after', bx + bwAll / 2, by + bh + u * 4, { font: 'ui', size: fitSize(s, 'dashed: before the ReLU · filled: after', bwAll, 3), color: s.c('--ink-3') }));
      });
    }
  },
};

/* ------------------------------------------------------------------ polysemantic */

const polysemantic: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    const hA = s.win('neurons', 'setup');
    s.alpha(hA, () => {
      const n = 8;
      const r = Math.min(u * 4.5, aw / (n * 2.6));
      const y = ay + ah * 0.2;
      for (let i = 0; i < n; i++) {
        const x = ax + (aw / n) * (i + 0.5);
        const clean = i === 1 || i === 5;
        const kind = s.since('some') >= 0 ? (clean ? 'green' : 'slate') : 'blue';
        s.circle(x, y, r, { fill: s.tint(kind as K, 0.2), stroke: s.c(kind as K), lw: 0.35 });
      }
      s.alpha(s.win('neurons', 'some'), () => s.text('the hope: one neuron, one concept', w / 2, y + r + u * 7, { font: 'ui', size: fitSize(s, 'the hope: one neuron, one concept', aw, 4), weight: 600, color: s.c('blue') }));
      s.alpha(s.win('some', 'inception'), () => s.text('some clean (green), many mixed', w / 2, y + r + u * 7, { font: 'ui', size: fitSize(s, 'some clean (green), many mixed', aw, 4), weight: 600, color: s.c('--ink-2') }));
      s.alpha(s.ease('inception', 0.6), () => {
        const y2 = y + r + u * 9;
        s.text('one neuron in InceptionV1 fires for', w / 2, y2, { font: 'ui', size: fitSize(s, 'one neuron in InceptionV1 fires for', aw, 3.6), weight: 600, color: s.c('--ink-2') });
        const items: [string, K][] = [['cat faces', 'purple'], ['fronts of cars', 'purple'], ['cat legs', 'purple']];
        pillRows(s, items, ax, y2 + u * 8, aw, { size: 3.8, center: true, a: (i) => s.ease('inception', 0.5, 1.2 + 0.9 * i) });
        s.text('Olah et al., 2020', w / 2, y2 + u * 26, { font: 'mono', size: 3, color: s.c('--ink-3') });
      });
      s.alpha(s.ease('poly', 0.6), () => s.text('polysemantic', w / 2, ay + ah * 0.9, { font: 'display', size: 7, weight: 600, color: s.c('--accent') }));
    });
    const gA = s.ease('setup', 0.6);
    if (gA <= 0) return;
    const set = neuronSamples();
    const sel = 3;
    const side = !s.tall && aw > ah * 1.15;
    const gridW = side ? aw * 0.56 : aw;
    const lab = u * 12;
    const cw = (gridW - lab) / SAE_N;
    const ch = side ? Math.min(cw * 0.95, u * 5.5) : Math.min(cw * 0.8, u * 4);
    const gx = ax + lab;
    const gy = ay + u * 3;
    const fillA = s.ease('grid', 0.8);
    const pick = s.ease('one', 0.6);
    s.alpha(gA, () => {
      for (let n = 0; n < SAE_D; n++) {
        s.text(`neuron ${n}`, gx - u * 1.2, gy + n * ch + ch / 2 + u * 0.2, { font: 'mono', size: Math.min(2.8, (ch / u) * 0.6), align: 'right', weight: n === sel && pick > 0 ? 700 : 400, color: n === sel && pick > 0 ? s.c('--ink') : s.c('--ink-3') });
        for (let k = 0; k < SAE_N; k++) {
          const v = TRUE_DIRS[k]![n]! * fillA;
          s.rrect(gx + k * cw + 0.6, gy + n * ch + 0.6, cw - 1.2, ch - 1.2, 0.4, { fill: s.tint(v >= 0 ? 'orange' : 'slate', 0.06 + 0.8 * Math.min(1, Math.abs(v) / 0.75)) });
        }
      }
      s.text('16 features →', gx, gy + SAE_D * ch + u * 3.2, { font: 'ui', size: 3, align: 'left', color: s.c('--ink-3') });
      s.alpha(s.ease('nothing', 0.6), () => pill(s, '16 features, 8 neurons', gx + SAE_N * cw, gy + SAE_D * ch + u * 3.4, 'red', { size: 3.2, align: 'right' }));
      if (pick > 0) s.alpha(pick, () => s.rrect(gx - u * 0.4, gy + sel * ch - u * 0.4, SAE_N * cw + u * 0.8, ch + u * 0.8, 0.8, { stroke: s.c('--ink'), lw: 0.45 }));
    });
    if (pick > 0) {
      const top = [...set.keys()].sort((a, b) => set[b]!.x[sel]! - set[a]!.x[sel]!).slice(0, 6);
      const lx0 = side ? ax + gridW + u * 4 : ax;
      const ly = side ? gy + u * 1 : gy + SAE_D * ch + u * 9;
      const perCol = side ? 6 : 3;
      const rowH = Math.min(u * 8, (ay + ah - ly - u * 4) / perCol);
      s.text(`neuron ${sel}: strongest inputs`, lx0, ly, { font: 'ui', size: 3.2, weight: 600, align: 'left', color: s.c('--ink-2') });
      top.forEach((i, r0) => {
        const smp = set[i]!;
        const r = r0 % perCol;
        const lx = lx0 + Math.floor(r0 / perCol) * (aw / 2);
        const y = ly + u * 4 + r * rowH + rowH / 2;
        s.alpha(s.ease('one', 0.4, 0.7 + 0.35 * r), () => {
          s.text(smp.x[sel]!.toFixed(2), lx, y, { font: 'mono', size: 3, align: 'left', color: s.c('orange') });
          const items: [string, K][] = [...smp.f.keys()].filter((k) => smp.f[k]! > 0 && TRUE_DIRS[k]![sel]! > 0.2).map((k) => [SAE_NAMES[k]!, 'green']);
          let x = lx + u * 10;
          items.forEach(([t, k]) => {
            x += pill(s, t, x, y, k, { size: Math.min(3.2, (rowH / u) * 0.45), align: 'left', fill: s.since('mix') >= 0 ? 0.22 : 0.12 }) + u * 1.2;
          });
        });
      });
    }
  },
};

/* ------------------------------------------------------------------ sae */

const LIT_F = [3, 11];

const sae: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    const dA = s.win('invert', 'toy');
    s.alpha(dA, () => {
      const cs = Math.min(u * 5, (ah * 0.52) / SAE_N);
      const cols: [string, number, K, number][] = [
        ['x', SAE_D, 'orange', ax + aw * 0.14],
        ['f', SAE_N, 'green', ax + aw * 0.5],
        ['x̂', SAE_D, 'orange', ax + aw * 0.86],
      ];
      const mid = ay + ah * 0.4;
      const r = new Rng(4);
      const xv = Array.from({ length: SAE_D }, () => r.randn() * 0.5);
      const push = s.ease('push', 1.5);
      cols.forEach(([lab, n, k, cx], c) => {
        const appear = c === 0 ? s.ease('invert', 0.5) : c === 1 ? s.ease('dict', 0.6) : s.ease('dec', 0.6);
        const hot = (c === 1 && s.since('l1') >= 0 && s.since('norm') < 0) || (c === 2 && s.since('recon') >= 0 && s.since('l1') < 0);
        s.alpha(appear, () => {
          const y0 = mid - (n * cs) / 2;
          for (let i = 0; i < n; i++) {
            let a = 0.15;
            if (c === 1) {
              const small = (i * 7) % 5 === 1 ? 0.25 : 0;
              a = LIT_F.includes(i) ? 0.85 : small * (1 - push);
            } else a = 0.2 + 0.6 * Math.abs(xv[i]!);
            s.rrect(cx - cs * 0.45, y0 + i * cs, cs * 0.9, cs * 0.88, 0.6, { fill: s.tint(k, a), stroke: s.tint(k, hot ? 0.95 : 0.45), lw: hot ? 0.45 : 0.2 });
          }
          s.text(lab, cx, y0 - u * 4, { font: 'serif', italic: true, size: 5, weight: 650, color: s.c(k) });
          s.text(c === 1 ? `${n} features, few on` : `${n} numbers`, cx, y0 + n * cs + u * 3.4, { font: 'mono', size: fitSize(s, `${n} features, few on`, aw * 0.3, 2.8, 'mono'), color: s.c('--ink-3') });
        });
      });
      const enc = s.ease('enc', 0.6);
      const dec = s.ease('dec', 0.6);
      s.alpha(enc, () => {
        s.arrow(cols[0]![3] + cs, mid, cols[1]![3] - cs, mid, s.c('blue'), 0.45, 2);
        s.text('encode', (cols[0]![3] + cols[1]![3]) / 2, mid - u * 3.5, { font: 'ui', size: 3.2, weight: 600, color: s.c('blue') });
      });
      s.alpha(dec, () => {
        s.arrow(cols[1]![3] + cs, mid, cols[2]![3] - cs, mid, s.c('blue'), 0.45, 2);
        s.text('W_dec', (cols[1]![3] + cols[2]![3]) / 2, mid - u * 3.5, { font: 'mono', size: 3.2, weight: 600, color: s.c('blue') });
      });
      const lines: [string, string, K][] = [
        ['recon', '‖x − x̂‖²', 'orange'],
        ['l1', '+ λ · Σ f', 'green'],
        ['norm', 'columns of W_dec: length 1', 'blue'],
      ];
      lines.forEach(([beat, t, k], i) => {
        s.alpha(s.ease(beat, 0.6), () => s.text(t, w / 2, ay + ah - u * (11 - 5 * i), { font: 'mono', size: fitSize(s, t, aw, 3.8, 'mono'), weight: 600, color: s.c(k) }));
      });
    });
    // A trained SAE against the truth.
    const tA = s.ease('toy', 0.6);
    if (tA <= 0) return;
    const trade = s.ease('tradeoff', 0.6);
    const run = saeRun(0.2);
    const prog = s.span('toy', 'tradeoff');
    const M = run.snaps[Math.min(run.snaps.length - 1, Math.round(prog * 1.4 * (run.snaps.length - 1)))]!;
    const drawMatch = (Mx: number[][], x: number, y: number, size: number) => {
      const best = Mx.map((r) => r.indexOf(Math.max(...r)));
      const order = [...Mx.keys()].sort((a, b) => best[a]! - best[b]! || Mx[b]![best[b]!]! - Mx[a]![best[a]!]!);
      const cs = size / SAE_N;
      order.forEach((j, r) => {
        for (let k = 0; k < SAE_N; k++) {
          s.ctx.fillStyle = s.tint('green', 0.04 + 0.9 * Mx[j]![k]! ** 2);
          s.ctx.fillRect(x + k * cs + 0.4, y + (r * size) / Mx.length + 0.4, cs - 0.8, size / Mx.length - 0.8);
        }
      });
    };
    s.alpha(tA * (1 - trade), () => {
      const size = Math.min(aw * 0.8, ah - u * 14);
      const x = ax + (aw - size) / 2;
      const y = ay + u * 6;
      drawMatch(M, x, y, size);
      s.text('true features →', x, y - u * 2.5, { font: 'ui', size: 3, align: 'left', color: s.c('--ink-3') });
      s.ctx.save();
      s.ctx.translate(x - u * 2.5, y + size / 2);
      s.ctx.rotate(-Math.PI / 2);
      s.text('learned features', 0, 0, { font: 'ui', size: 3, color: s.c('--ink-3') });
      s.ctx.restore();
      s.alpha(s.ease('diag', 0.6), () => pill(s, `λ = 0.2: ${run.rec} of 16 recovered`, w / 2, y + size + u * 5, 'green', { size: 3.4 }));
    });
    if (trade > 0) {
      const lams = [0.01, 0.2, 1];
      const gap = u * 3;
      const size = Math.min((aw - 2 * gap) / 3, ah - u * 24);
      const x0 = ax + (aw - 3 * size - 2 * gap) / 2;
      const y = ay + u * 8;
      s.alpha(trade, () =>
        lams.forEach((lam, i) => {
          const r = saeRun(lam);
          const x = x0 + i * (size + gap);
          s.alpha(s.ease('tradeoff', 0.5, i === 1 ? 0 : i === 0 ? 0.8 : 3.4), () => {
            drawMatch(r.snaps[r.snaps.length - 1]!, x, y, size);
            s.text(`λ = ${lam}`, x + size / 2, y - u * 3, { font: 'mono', size: 3.4, weight: 700, color: s.c('slate') });
            s.text(`${(r.fvu * 100).toFixed(1)}% unexplained`, x + size / 2, y + size + u * 4, { font: 'mono', size: fitSize(s, '53.9% unexplained', size, 3.2, 'mono'), color: s.c('orange') });
            s.text(`${r.rec} of 16 found`, x + size / 2, y + size + u * 8.5, { font: 'mono', size: fitSize(s, '15 of 16 found', size, 3.2, 'mono'), color: s.c('green') });
          });
        }),
      );
    }
  },
};

/* ------------------------------------------------------------------ scale */

function bridge(s: Scene, x: number, y: number, w: number, h: number): void {
  const c = s.c('red');
  const deck = y + h * 0.72;
  const t1 = x + w * 0.25;
  const t2 = x + w * 0.75;
  s.line(x, deck, x + w, deck, c, 0.8);
  for (const tx of [t1, t2]) {
    s.line(tx - w * 0.015, y, tx - w * 0.015, y + h, c, 0.7);
    s.line(tx + w * 0.015, y, tx + w * 0.015, y + h, c, 0.7);
    s.line(tx - w * 0.015, y + h * 0.15, tx + w * 0.015, y + h * 0.15, c, 0.5);
    s.line(tx - w * 0.015, y + h * 0.42, tx + w * 0.015, y + h * 0.42, c, 0.5);
  }
  const cable = (xa: number, xb: number, sag: number) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      xs.push(lerp(xa, xb, t));
      ys.push(y + h * 0.04 + sag * 4 * t * (1 - t));
    }
    poly(s, xs, ys, c, 0.35);
    return { xs, ys };
  };
  const mid = cable(t1, t2, h * 0.62);
  for (let i = 3; i < 30; i += 3) s.line(mid.xs[i]!, mid.ys[i]!, mid.xs[i]!, deck, s.tint('red', 0.6), 0.15);
  poly(s, [x, t1], [deck - h * 0.05, y + h * 0.04], c, 0.35);
  poly(s, [t2, x + w], [y + h * 0.04, deck - h * 0.05], c, 0.35);
  s.line(x, deck + h * 0.1, x + w, deck + h * 0.1, s.tint('blue', 0.35), 0.3, [1.5, 1.2]);
}

const scale: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    const mA = s.win('mono', 'scale');
    s.alpha(mA, () => {
      s.text('Towards Monosemanticity', w / 2, ay + u * 5, { font: 'display', size: fitSize(s, 'Towards Monosemanticity', aw, 6.4, 'display'), weight: 600 });
      s.text('Bricken et al., 2023 · a one-layer transformer', w / 2, ay + u * 12, { font: 'mono', size: fitSize(s, 'Bricken et al., 2023 · a one-layer transformer', aw, 3, 'mono'), color: s.c('--ink-3') });
      const items: [string, K][] = [['DNA sequences', 'green'], ['Arabic script', 'green'], ['base64', 'green'], ['Hebrew', 'green']];
      pillRows(s, items, ax, ay + u * 22, aw, { size: 3.8, center: true, a: (i) => s.ease('found', 0.5, 1.5 + 0.7 * i) });
      s.alpha(s.ease('split', 0.6), () => {
        const y = ay + ah * 0.66;
        pill(s, 'one broad feature', w / 2, y, 'blue', { size: 3.6 });
        const xs = [0.2, 0.5, 0.8].map((f) => ax + aw * f);
        xs.forEach((x, i) =>
          s.alpha(s.ease('split', 0.5, 1.2 + 0.4 * i), () => {
            s.arrow(w / 2, y + u * 3.5, x, y + u * 11, s.tint('--ink-3', 0.8), 0.3, 1.6);
            pill(s, `narrower ${i + 1}`, x, y + u * 14, 'blue', { size: 3.2 });
          }),
        );
      });
    });
    const sA = s.win('scale', 'gg');
    s.alpha(sA, () => {
      s.text('≈ 34,000,000', w / 2, ay + ah * 0.3, { font: 'display', size: fitSize(s, '≈ 34,000,000', aw, 11, 'display'), weight: 600, color: s.c('green') });
      s.text('features · Claude 3 Sonnet · 2024', w / 2, ay + ah * 0.3 + u * 10, { font: 'ui', size: fitSize(s, 'features · Claude 3 Sonnet · 2024', aw, 4), weight: 600, color: s.c('--ink-2') });
      s.alpha(s.ease('abstract', 0.6), () => {
        const y = ay + ah * 0.72;
        const items: [string, K][] = [['English', 'slate'], ['French', 'slate'], ['Japanese', 'slate'], ['an image', 'slate']];
        pillRows(s, items, ax, y - u * 8, aw, { size: 3.4, center: true });
        pill(s, 'one feature', w / 2, y + u * 8, 'green', { size: 3.8, fill: 0.25 });
        s.arrow(w / 2, y - u * 1.5, w / 2, y + u * 4.5, s.tint('--ink-3', 0.8), 0.3, 1.6);
      });
    });
    const gA = s.ease('gg', 0.8);
    if (gA > 0)
      s.alpha(gA, () => {
        const bw = Math.min(aw, s.tall ? aw : aw * 0.7);
        const bh = Math.min(bw * 0.38, ah * 0.36);
        const by = ay + u * 4;
        bridge(s, ax + (aw - bw) / 2, by, bw, bh);
        s.text('the Golden Gate Bridge feature', w / 2, by + bh + u * 6, { font: 'ui', size: fitSize(s, 'the Golden Gate Bridge feature', aw, 4), weight: 700, color: s.c('red') });
        // Steering: push the stream along the feature's direction.
        const cA = s.ease('clamp', 0.6);
        s.alpha(cA, () => {
          const oy = by + bh + u * 26;
          const ox = ax + aw * 0.18;
          const L = Math.min(aw * 0.62, u * 60);
          const push = s.ease('clamp', 1.6, 1.2);
          s.arrow(ox, oy, ox + L * 0.35, oy - u * 8, s.c('orange'), 0.5, 2);
          s.text('x', ox + L * 0.17, oy - u * 7, { font: 'serif', italic: true, size: 4.4, weight: 650, color: s.c('orange') });
          s.arrow(ox + L * 0.35, oy - u * 8, ox + L * (0.35 + 0.65 * push), oy - u * 8, s.c('red'), 0.6, 2.2);
          s.text('+ (c − f) · d', ox + L * (0.35 + 0.32 * push), oy - u * 12, { font: 'mono', size: 3.2, weight: 600, color: s.c('red') });
          s.alpha(s.ease('clamp', 0.6, 3.5), () => s.text('every reply drifts to the bridge', w / 2, oy + u * 6, { font: 'ui', size: fitSize(s, 'every reply drifts to the bridge', aw, 3.8), italic: true, color: s.c('--ink-2') }));
        });
        s.alpha(s.win('ggc', 'handle'), () => pill(s, 'Golden Gate Claude · May 2024 · about a day', w / 2, ay + ah - u * 4, 'red', { size: fitSize(s, 'Golden Gate Claude · May 2024 · about a day', aw * 0.9, 3.4) }));
        s.alpha(s.ease('handle', 0.6) * (1 - s.ease('others', 0.6)), () => pill(s, 'a label → a handle on behavior', w / 2, ay + ah - u * 4, 'green', { size: fitSize(s, 'a label → a handle on behavior', aw * 0.9, 3.4) }));
        s.alpha(s.ease('others', 0.6), () => {
          const items: [string, K][] = [['OpenAI · 16M features · GPT-4 · TopK', 'teal'], ['Google DeepMind · Gemma Scope', 'blue']];
          pillRows(s, items, ax, ay + ah - u * 8, aw, { size: 3.2, center: true });
        });
      });
  },
};

/* ------------------------------------------------------------------ limits */

const limits: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    s.alpha(s.win('micro', 'dark'), () => {
      s.text('a microscope', w / 2, ay + ah * 0.38, { font: 'display', size: 8, weight: 600 });
      s.text('with known distortions', w / 2, ay + ah * 0.38 + u * 10, { font: 'serif', italic: true, size: 5, color: s.c('--ink-2') });
    });
    const dA = s.win('dark', 'basis');
    s.alpha(dA, () => {
      // x = x̂ + error, as a stacked bar.
      const bw = Math.min(aw * 0.18, u * 16);
      const base = ay + ah * 0.7;
      const H = ah * 0.55;
      const x0 = s.tall ? ax + aw * 0.08 : ax + aw * 0.1;
      s.rrect(x0, base - H, bw, H, 0.8, { fill: s.tint('orange', 0.6) });
      s.text('x', x0 + bw / 2, base + u * 4.5, { font: 'serif', italic: true, size: 4.6, weight: 650, color: s.c('orange') });
      s.text('=', x0 + bw * 1.5, base - H / 2, { font: 'mono', size: 5, color: s.c('--ink-2') });
      const x1 = x0 + bw * 2;
      s.rrect(x1, base - H * 0.82, bw, H * 0.82, 0.8, { fill: s.tint('green', 0.6) });
      s.rrect(x1, base - H, bw, H * 0.18, 0.8, { fill: s.tint('--ink', 0.75) });
      s.text('x̂', x1 + bw / 2, base + u * 4.5, { font: 'serif', italic: true, size: 4.6, weight: 650, color: s.c('green') });
      s.text('dark matter', x1 + bw + u * 2, base - H * 0.91, { font: 'ui', size: 3.4, weight: 700, align: 'left', color: s.c('--ink') });
      // Loss with the reconstruction spliced in.
      s.alpha(s.ease('splice', 0.6), () => {
        const lx = s.tall ? ax + aw * 0.6 : ax + aw * 0.62;
        const lb = Math.min(aw * 0.13, u * 12);
        s.rrect(lx, base - H * 0.4, lb, H * 0.4, 0.8, { fill: s.tint('red', 0.45) });
        s.rrect(lx + lb * 1.5, base - H * 0.58, lb, H * 0.58, 0.8, { fill: s.tint('red', 0.8) });
        s.text('loss', lx + lb * 1.25, base - H * 0.75, { font: 'ui', size: 3.4, weight: 700, color: s.c('red') });
        s.text('real', lx + lb / 2, base + u * 4, { font: 'ui', size: fitSize(s, 'real', lb * 1.4, 3), color: s.c('--ink-3') });
        s.text('spliced', lx + lb * 2, base + u * 4, { font: 'ui', size: fitSize(s, 'spliced', lb * 1.4, 3), color: s.c('--ink-3') });
      });
      s.alpha(s.ease('rare', 0.6), () => {
        const items: [string, K][] = [['rare features?', 'slate'], ['not a sparse sum?', 'slate'], ['noise?', 'slate']];
        pillRows(s, items, ax, base + u * 11, aw, { size: 3.4, center: true, a: (i) => s.ease('rare', 0.5, 0.8 * i) });
      });
    });
    const bA = s.win('basis', 'labels');
    s.alpha(bA, () => {
      const sizes = [8, 16, 32];
      const gap = u * 4;
      const cw = (aw - 2 * gap) / 3;
      const top = ay + u * 8;
      const H = ah * 0.62;
      sizes.forEach((m, i) => {
        const x = ax + i * (cw + gap);
        const ch = H / m;
        s.text(`${m} features`, x + cw / 2, top - u * 3.5, { font: 'mono', size: 3.2, weight: 600, color: s.c('--ink-2') });
        for (let j = 0; j < m; j++) s.rrect(x + cw * 0.15, top + j * ch + 0.5, cw * 0.7, ch - 1, 0.4, { fill: s.tint('green', 0.15 + 0.5 * (((j * 37) % 11) / 11)) });
      });
      s.text('same activations, three descriptions', w / 2, top + H + u * 6, { font: 'ui', size: fitSize(s, 'same activations, three descriptions', aw, 3.8), weight: 600, color: s.c('--ink-2') });
      s.alpha(s.ease('split', 0.6), () => s.text('math: one feature, or ten?', w / 2, top + H + u * 12.5, { font: 'display', size: fitSize(s, 'math: one feature, or ten?', aw, 5), weight: 600, color: s.c('--accent') }));
    });
    const lA = s.ease('labels', 0.6);
    s.alpha(lA * (1 - s.ease('next', 0.6)), () => {
      const steps: [string, K][] = [['label from top examples', 'slate'], ['a hypothesis', 'gold'], ['test: steer, patch', 'red'], ['trust', 'green']];
      const bh = u * 9;
      const bw = Math.min(aw * 0.7, u * 62);
      steps.forEach(([t, k], i) => {
        const y = ay + u * 2 + i * (bh + u * 4);
        s.alpha(s.ease('labels', 0.5, 0.9 * i), () => {
          box(s, w / 2 - bw / 2, y, bw, bh, t, k, { size: 3.6 });
          if (i) s.arrow(w / 2, y - u * 3.6, w / 2, y - u * 0.5, s.tint('--ink-3', 0.8), 0.3, 1.4);
        });
      });
      s.alpha(s.ease('probes', 0.6), () => pill(s, 'some tasks: a plain linear probe does as well', w / 2, ay + ah - u * 6, 'teal', { size: fitSize(s, 'some tasks: a plain linear probe does as well', aw * 0.9, 3.4) }));
    });
    const nA = s.ease('next', 0.6);
    s.alpha(nA, () => {
      const layers = 4;
      const per = 4;
      const r = new Rng(8);
      const pos = Array.from({ length: layers }, (_, l) => Array.from({ length: per }, (_, i) => [ax + aw * (0.12 + (0.76 * i) / (per - 1)), ay + ah * (0.8 - (0.62 * l) / (layers - 1))] as const));
      for (let l = 0; l + 1 < layers; l++)
        for (let i = 0; i < per; i++)
          for (let j = 0; j < per; j++) {
            if (r.next() > 0.35) continue;
            const p0 = pos[l]![i]!;
            const p1 = pos[l + 1]![j]!;
            s.alpha(s.ease('next', 0.5, 0.6 * l), () => s.line(p0[0], p0[1], p1[0], p1[1], s.tint('purple', 0.5), 0.35));
          }
      pos.forEach((row, l) => row.forEach(([x, y]) => s.alpha(s.ease('next', 0.5, 0.6 * l), () => s.circle(x, y, u * 2, { fill: s.tint('green', 0.4), stroke: s.c('green'), lw: 0.3 }))));
      s.text('tracing features, layer by layer', w / 2, ay + ah * 0.95, { font: 'ui', size: fitSize(s, 'tracing features, layer by layer', aw, 3.8), weight: 600, color: s.c('--ink-2') });
    });
  },
};

/* ------------------------------------------------------------------ outro */

const RECAP: [string, string, K][] = [
  ['stream', 'a running sum, read early with the lens', 'orange'],
  ['heads', 'QK: where to look · OV: what to move', 'blue'],
  ['ind', 'induction heads: a sudden phase change', 'purple'],
  ['probe', 'probes: present · interventions: used', 'teal'],
  ['sup', 'superposition → polysemantic neurons', 'green'],
  ['sae', 'sparse autoencoders: features to steer', 'gold'],
];

const outro: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    const close = s.ease('close', 0.8);
    s.alpha(s.ease('recap', 0.6), () => {
      const bh = Math.min(u * 10, (ah * 0.9) / RECAP.length - u * 2.4);
      const bw = Math.min(aw, u * 90);
      RECAP.forEach(([beat, t, k], i) => {
        const y = lerp(ay + u * 2 + i * (bh + u * 2.4), ay + u * 1 + i * (bh * 0.55 + u * 1.2), close);
        const on = s.since(beat) >= 0 && (i === RECAP.length - 1 || s.since(RECAP[i + 1]![0]) < 0) && close < 0.5 ? 1 : 0;
        s.alpha((0.3 + 0.7 * s.ease(beat, 0.5)) * (1 - 0.55 * close), () => box(s, w / 2 - bw / 2, y, bw, lerp(bh, bh * 0.55, close), t, k, { on, size: lerp(3.8, 2.6, close) }));
      });
    });
    s.alpha(close, () => {
      const y = ay + ah * 0.7;
      s.text('where a network looks', w / 2, y, { font: 'display', size: fitSize(s, 'what it computes', aw * 0.8, 6, 'display'), weight: 600, color: s.c('teal') });
      s.text('→ what it computes', w / 2, y + u * 9, { font: 'display', size: fitSize(s, 'what it computes', aw * 0.8, 6, 'display'), weight: 600, color: s.c('--accent') });
    });
    void clamp01;
  },
};

export const scenesB: Record<string, SceneDef> = { probes, superposition, polysemantic, sae, scale, limits, outro };
