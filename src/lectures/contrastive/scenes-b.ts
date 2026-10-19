import { fmt } from '../../core/code';
import { CLASS_COLORS } from '../../core/plot';
import { type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { drawShape } from '../../lib/contrastive-clip';
import { MOCO_N, MOCO_Q, MOCO_T, THETA_Q, emaPath } from '../../lib/contrastive-moco';
import { makeToy } from '../../lib/contrastive-toy';
import { CLIP_SNAPS, TOY_NCE, TOY_POS, type ToySnap } from './data';
import { type K, SHORT, area, box, cifar, clipPairs, cross, drawPhoto, heat, lerpAngle, pill, photo, unitCircle, views } from './kit';

// ---------------------------------------------------------------- collapse

const TOY = makeToy();
const SHOW_CLASS = [0, 0, 1, 1, 2, 2, 3, 3];

/** A snapshot at fractional index f of a run, angles interpolated along the shorter arc. */
function snapAt(run: ToySnap[], f: number): { items: number[]; v1: number[]; v2: number[]; probe: number; step: number } {
  const i = Math.max(0, Math.min(run.length - 1, Math.floor(f)));
  const j = Math.min(run.length - 1, i + 1);
  const t = clamp01(f - i);
  const A = run[i]!, B = run[j]!;
  const mix = (a: number[], b: number[]) => a.map((v, q) => lerpAngle(v, b[q]!, t));
  return { items: mix(A.items, B.items), v1: mix(A.v1, B.v1), v2: mix(A.v2, B.v2), probe: lerp(A.probe, B.probe, t), step: Math.round(lerp(A.step, B.step, t)) };
}

const POS300 = TOY_POS.findIndex((q) => q.step === 300);

const collapse: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s);
    // Cartoon: everything slides to one point.
    s.alpha(s.win('why', 'toy'), () => {
      const R = Math.min(aw * 0.3, ah * 0.32);
      const cx = w / 2;
      const cy = ay + ah * 0.45;
      unitCircle(s, cx, cy, R);
      const t = s.ease('trivial', 2.2, 0.4);
      for (let i = 0; i < 12; i++) {
        const a0 = (i / 12) * Math.PI * 2 + 0.2;
        const a = lerpAngle(a0, 1.1, t);
        const k = CLASS_COLORS[i % 4]!;
        const x = cx + R * Math.cos(a), y = cy - R * Math.sin(a);
        s.circle(x, y, u * 1.5, { fill: s.tint(k, 0.85) });
      }
      s.alpha(s.ease('trivial', 0.6, 2), () => s.text('every pair matches: loss at its minimum', w / 2, cy + R + u * 8, { size: 3.6, font: 'ui', color: s.c('--ink-2') }));
      s.alpha(s.ease('name', 0.6), () => s.text('collapse', w / 2, ay + ah * 0.06, { size: 7, font: 'display', weight: 600, color: s.c('red') }));
    });
    // The real toy runs.
    const ta = s.win('toy');
    if (ta <= 0) return;
    let snap: ReturnType<typeof snapAt>;
    let mode = 'infonce';
    if (s.since('pos') >= 0) {
      mode = 'positives';
      snap = s.since('fall') >= 0 ? snapAt(TOY_POS, POS300 + s.prog('fall') * (TOY_POS.length - 1 - POS300)) : snapAt(TOY_POS, s.prog('pos') * POS300);
    } else if (s.since('train') >= 0) snap = snapAt(TOY_NCE, s.prog('train') * (TOY_NCE.length - 1));
    else snap = snapAt(TOY_NCE, 0);
    s.slot('mode', `"${mode}"`);
    s.slot('step', snap.step);
    s.slot('probe', `${Math.round(snap.probe * 100)}%`);
    s.alpha(ta, () => {
      const tall = s.tall;
      const R = tall ? Math.min(aw * 0.24, ah * 0.2) : Math.min(aw * 0.2, ah * 0.33);
      const cx = tall ? ax + aw * 0.3 : ax + aw * 0.26;
      const cy = tall ? ay + ah * 0.3 : ay + ah * 0.48;
      unitCircle(s, cx, cy, R);
      snap.items.forEach((a, i) => {
        const k = CLASS_COLORS[TOY.y[i]!]!;
        s.circle(cx + R * Math.cos(a), cy - R * Math.sin(a), u * 0.9, { fill: s.tint(k, 0.6) });
      });
      snap.v1.forEach((a, b) => {
        const k = CLASS_COLORS[SHOW_CLASS[b]!]!;
        const r1 = R * 1.14, r2 = R * 1.27;
        s.circle(cx + r1 * Math.cos(a), cy - r1 * Math.sin(a), u * 1.2, { fill: s.c(k) });
        const a2 = snap.v2[b]!;
        s.circle(cx + r2 * Math.cos(a2), cy - r2 * Math.sin(a2), u * 1.2, { fill: s.c('--card'), stroke: s.c(k), lw: 0.4 });
      });
      // Batch matrix of the 8 displayed pairs.
      const B = 8;
      const P: number[] = [];
      for (let i = 0; i < B; i++) {
        const row = snap.v2.map((b) => Math.cos(snap.v1[i]! - b) / 0.2);
        const mx = Math.max(...row);
        const e = row.map((v) => Math.exp(v - mx));
        const z = e.reduce((a, b) => a + b, 0);
        P.push(...e.map((v) => v / z));
      }
      const mxs = tall ? ax + aw * 0.62 : ax + aw * 0.56;
      const cell = tall ? Math.min((ax + aw - mxs) / B, (ah * 0.42) / B) : Math.min((ax + aw - mxs) / B, (ah * 0.66) / B);
      const my = tall ? cy - (cell * B) / 2 : cy - (cell * B) / 2;
      heat(s, mxs, my, cell, P, B, B, { k: 'teal' });
      s.text('batch: softmax(S)', mxs + (cell * B) / 2, my - u * 3, { size: 3, font: 'ui', color: s.c('--ink-3') });
      // Probe readout.
      const py = tall ? ay + ah * 0.62 : ay + ah * 0.9;
      s.alpha(tall ? 1 : s.ease('init', 0.5), () => pill(s, `linear probe ${Math.round(snap.probe * 100)}%  (chance 25%)`, w / 2, py, snap.probe > 0.6 ? 'gold' : 'red', { size: 3.4, font: 'mono' }));
      s.text(mode === 'infonce' ? 'InfoNCE' : 'positives only', w / 2, tall ? py + u * 7 : ay + ah * 0.02, { size: 3.6, font: 'mono', weight: 600, color: s.c(mode === 'infonce' ? 'teal' : 'red') });
      // Content and style.
      s.alpha(s.win('toy', 'init'), () => {
        const yy = tall ? ay + ah * 0.82 : ay + ah * 0.84;
        {
          const cw = Math.min(aw / 9, u * 8);
          const x0 = w / 2 - cw * 3;
          for (let q = 0; q < 6; q++) {
            const k: K = q < 2 ? 'orange' : 'slate';
            const jitter = q >= 2 ? Math.sin(s.t * 3 + q * 1.7) : 0;
            s.cell(x0 + q * cw, yy, cw, cw * 0.8, q < 2 ? 'c' : fmt(jitter, 1), k, { on: q < 2 ? 0.5 : 0.2, size: 2.8 });
          }
          s.text('content kept, style redrawn', w / 2, yy + cw + u * 3, { size: 3, font: 'ui', color: s.c('--ink-3') });
        }
      });
      s.alpha(s.win('forces', 'pos'), () => {
        s.text('alignment + uniformity', mxs + (cell * B) / 2, my + cell * B + u * 4, { size: 3.2, font: 'ui', weight: 600, color: s.c('teal'), halo: true });
      });
    });
  },
};

// ---------------------------------------------------------------- SimCLR

const simclr: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s);
    const cs = cifar(s);
    const tall = s.tall;
    const chainY = tall ? ay + ah * 0.2 : ay + ah * 0.26;
    // The chain: views -> f -> h -> g -> z.
    const n = 5;
    const step = aw / n;
    const X = (i: number) => ax + step * (i + 0.5);
    const bh = Math.min(ah * 0.2, u * 13);
    const keep = s.ease('keep', 0.6);
    s.alpha(s.win('who', 'views'), () => {
      s.text('SimCLR', w / 2, ay + ah * 0.4, { size: 9, font: 'display', weight: 600, color: s.c('purple') });
      s.text('Chen, Kornblith, Norouzi and Hinton, 2020', w / 2, ay + ah * 0.52, { size: 3.6, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(s.ease('views', 0.5), () => {
      if (cs) {
        const v = views(photo(cs, 3, 4), 'cat', 5);
        const sz = Math.min(step * 0.42, bh * 0.75);
        drawPhoto(s, v.colored[0]!, X(0) - sz - u * 0.5, chainY - sz / 2, sz, 'gold', 0.4);
        drawPhoto(s, v.colored[1]!, X(0) + u * 0.5, chainY - sz / 2, sz, 'gold', 0.4);
      }
      s.text('2N views', X(0), chainY + bh / 2 + u * 4, { size: 3.2, font: 'mono', color: s.c('orange') });
    });
    const fa = s.ease('f', 0.5);
    s.alpha(fa, () => {
      s.arrow(X(0) + step * 0.42, chainY, X(1) - step * 0.3, chainY, s.c('--ink-3'), 0.35, 1.6);
      box(s, X(1), chainY, step * 0.55, bh, 'f', 'blue', { italic: true, size: 6 });
      s.arrow(X(1) + step * 0.3, chainY, X(2) - step * 0.2, chainY, s.c('--ink-3'), 0.35, 1.6);
      s.rrect(X(2) - step * 0.17, chainY - bh / 2, step * 0.34, bh, 1, { fill: s.tint('purple', 0.1 + 0.3 * keep), stroke: s.tint(keep > 0.5 ? 'green' : 'purple', 0.8), lw: 0.35 + 0.4 * keep });
      s.text('h', X(2), chainY - u * 1.5, { size: 5, italic: true, weight: 600, color: s.c('purple') });
      s.text('2048', X(2), chainY + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-2') });
    });
    const ga = s.ease('g', 0.5);
    s.alpha(ga * (1 - 0.6 * keep), () => {
      s.arrow(X(2) + step * 0.2, chainY, X(3) - step * 0.27, chainY, s.c('--ink-3'), 0.35, 1.6);
      box(s, X(3), chainY, step * 0.5, bh * 0.8, 'g', 'blue', { italic: true, size: 5.5 });
      s.arrow(X(3) + step * 0.27, chainY, X(4) - step * 0.16, chainY, s.c('--ink-3'), 0.35, 1.6);
      s.rrect(X(4) - step * 0.13, chainY - bh * 0.35, step * 0.26, bh * 0.7, 1, { fill: s.tint('purple', 0.15), stroke: s.tint('purple', 0.8), lw: 0.35 });
      s.text('z', X(4), chainY - u * 1.2, { size: 5, italic: true, weight: 600, color: s.c('purple') });
      s.text('128', X(4), chainY + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-2') });
    });
    s.alpha(keep, () => cross(s, X(3), chainY - bh * 0.55, u * 2.2));
    s.alpha(s.win('keep', 'aug'), () => {
      s.text('keep h', X(2), chainY - bh / 2 - u * 4, { size: 3.4, font: 'ui', weight: 650, color: s.c('green') });
      s.text('+10 points over z', X(2), chainY + bh / 2 + u * 4, { size: 3, font: 'ui', color: s.c('green') });
    });
    // The 2N x 2N matrix: no self-similarity, partner N away.
    const N = 3;
    const M = 2 * N;
    const ma = s.ease('S', 0.6);
    s.alpha(ma * (1 - s.ease('batch', 0.5)), () => {
      const cell = Math.min(tall ? (ah * 0.45) / M : (ah * 0.5) / M, aw * 0.08);
      const mx = w / 2 - (cell * M) / 2;
      const my = tall ? ay + ah * 0.46 : ay + ah * 0.46;
      for (let i = 0; i < M; i++)
        for (let j = 0; j < M; j++) {
          const self = i === j;
          const partner = j === (i + N) % M;
          const x = mx + j * cell, y = my + i * cell;
          if (self) {
            s.ctx.fillStyle = s.c('--ink-3');
            s.ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
          } else {
            s.ctx.fillStyle = s.tint(partner ? 'gold' : 'teal', partner ? 0.75 : 0.14);
            s.ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
          }
        }
      for (let i = 0; i < M; i++) {
        const k = CLASS_COLORS[i % N]!;
        s.circle(mx - u * 2.5, my + i * cell + cell / 2, u * 0.9, { fill: s.c(k) });
        s.circle(mx + i * cell + cell / 2, my - u * 2.5, u * 0.9, { fill: s.c(k) });
      }
      s.text('gray: itself (removed)   gold: its partner', w / 2, my + M * cell + u * 4.5, { size: 3, font: 'ui', color: s.c('--ink-2') });
    });
    s.alpha(s.win('aug', 'batch'), () => {
      const y = chainY - bh / 2 - u * 5;
      pill(s, 'random crop', w / 2 - u * 14, y, 'orange', { size: 3.4 });
      pill(s, 'color distortion', w / 2 + u * 14, y, 'orange', { size: 3.4 });
    });
    s.alpha(s.ease('batch', 0.6), () => {
      const y = ay + ah * 0.62;
      s.text('4,096 images per batch', w / 2, y, { size: 5, font: 'display', weight: 600, color: s.c('orange') });
      s.text('8,190 negatives for every positive pair', w / 2, y + u * 8, { size: 3.8, font: 'ui', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('result', 0.6), () => pill(s, '76.5% linear probe, ImageNet: as good as supervised', w / 2, ay + ah * 0.88, 'gold', { size: 3.4 }));
  },
};

// ---------------------------------------------------------------- MoCo

const PATH99 = emaPath(0.99);
const PATH0 = emaPath(0);

const moco: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s);
    const fast = s.since('catch') >= 0 && s.since('two') < 0 ? 1 : s.since('fail') >= 0 ? 1 : 0;
    const path = fast ? PATH0 : PATH99;
    s.slot('m', fast ? '0' : '0.99');
    const t = Math.max(0, Math.min(MOCO_T - 1, Math.floor(16 + Math.max(0, s.since('queue')) * 1.1)));
    // Queue.
    const qy = ay + ah * 0.06;
    const slots = MOCO_Q;
    const gap = u * 0.8;
    const sw = Math.min((aw - u * 16 - gap * (slots - 1)) / slots, u * 6);
    const qx = ax + u * 16;
    const qa = s.ease('queue', 0.6);
    s.ctx.save();
    s.ctx.globalAlpha *= qa;
    s.text('queue', ax, qy + sw / 2, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
    const frac = (Math.max(0, s.since('queue')) * 1.1) % 1;
    const slide = s.since('queue') >= 0 ? clamp01(frac * 3) : 1;
    for (let q = 0; q < slots; q++) {
      const age = Math.floor(q / MOCO_N);
      const tt = t - age;
      const x = qx + q * (sw + gap) - (1 - slide) * (sw + gap) * MOCO_N * 0;
      if (tt < 0) {
        s.rrect(x, qy, sw, sw, 0.8, { stroke: s.tint('--ink', 0.2), lw: 0.25 });
        continue;
      }
      const mis = Math.min(1, Math.abs(path[tt]! - path[t]!) / 0.12);
      s.alpha(age === 0 ? slide : 1, () => {
        s.rrect(x, qy, sw, sw, 0.8, { fill: s.tint('blue', 0.7) });
        s.rrect(x, qy, sw, sw, 0.8, { fill: s.tint('red', 0.9 * mis) });
      });
    }
    s.text('newest', qx + sw * 2, qy + sw + u * 3.5, { size: 2.8, font: 'ui', color: s.c('--ink-3') });
    s.text('oldest', qx + (sw + gap) * (slots - 2), qy + sw + u * 3.5, { size: 2.8, font: 'ui', color: s.c('--ink-3') });
    s.ctx.restore();
    s.alpha(s.win('many', 'catch'), () => pill(s, 'real queue: 65,536 keys; batch: 256', w / 2, qy + sw + u * 11, 'blue', { size: 3.4 }));
    s.alpha(s.win('catch', 'two'), () => pill(s, 'red: keys from an older encoder', w / 2, qy + sw + u * 11, 'red', { size: 3.4 }));
    s.alpha(s.win('cost', 'queue'), () => {
      s.text('SimCLR: negatives = batch', w / 2, ay + ah * 0.42, { size: 4.6, font: 'display', weight: 600 });
      s.text('a batch of 4,096 needs a lot of hardware', w / 2, ay + ah * 0.52, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
    });
    // Two encoders.
    const ea = s.ease('two', 0.6);
    const by = ay + ah * 0.42;
    const bw = Math.min(aw * 0.26, u * 26);
    const bh = u * 11;
    s.alpha(ea, () => {
      const x1 = w / 2 - bw * 0.85;
      const x2 = w / 2 + bw * 0.85;
      box(s, x1, by, bw, bh, 'f_q', 'blue', { size: 4.4, sub: 'trained', on: 0.7 });
      box(s, x2, by, bw, bh, 'f_k', 'blue', { size: 4.4, sub: 'no gradient', on: 0.3 });
      s.arrow(x1, by - bh / 2 - u * 7, x1, by - bh / 2 - u, s.c('teal'), 0.5, 2);
      s.text('backprop', x1 - u * 2, by - bh / 2 - u * 8.5, { size: 3, font: 'ui', align: 'right', color: s.c('teal') });
      s.alpha(s.ease('ema', 0.6), () => {
        s.arrow(x1 + bw / 2 + u, by, x2 - bw / 2 - u, by, s.c('slate'), 0.5, 2);
        s.text(fast ? 'copy (m = 0)' : 'moving average, m', w / 2, by - bh / 2 - u * 4, { size: 3, font: 'ui', weight: 600, color: s.c('slate'), halo: true });
      });
    });
    // One weight over training.
    const pa = s.ease('ema', 0.6);
    s.alpha(pa, () => {
      const px = ax + u * 2;
      const pw = aw - u * 4;
      const py = ay + ah * 0.6;
      const ph = ah * 0.34;
      const lo = Math.min(...THETA_Q) - 0.1;
      const hi = Math.max(...THETA_Q) + 0.1;
      const X = (i: number) => px + (i / (MOCO_T - 1)) * pw;
      const Y = (v: number) => py + ph - ((v - lo) / (hi - lo)) * ph;
      s.rrect(px, py, pw, ph, 1, { stroke: s.c('--rule'), lw: 0.25 });
      const win0 = Math.max(0, t - MOCO_Q / MOCO_N + 1);
      s.ctx.fillStyle = s.tint('purple', 0.1);
      s.ctx.fillRect(X(win0), py, X(t) - X(win0) + 1, ph);
      const c = s.ctx;
      const line = (vals: number[], col: string, lw: number) => {
        c.beginPath();
        for (let i = 0; i <= t; i++) (i ? c.lineTo(X(i), Y(vals[i]!)) : c.moveTo(X(i), Y(vals[i]!)));
        c.strokeStyle = col;
        c.lineWidth = lw * u;
        c.stroke();
      };
      line(THETA_Q, s.tint('blue', 0.45), 0.3);
      line(path, s.c('blue'), 0.7);
      s.text('thin: f_q, one weight', px, py - u * 3, { size: 2.8, font: 'mono', align: 'left', color: s.tint('blue', 0.8) });
      s.text(fast ? 'thick: f_k = f_q' : 'thick: f_k', px + pw, py - u * 3, { size: 2.8, font: 'mono', weight: 600, align: 'right', color: s.c('blue') });
      s.text(`toy: m = ${fast ? 0 : 0.99}`, px + pw - u * 2, py + ph - u * 3, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
  },
};

// ---------------------------------------------------------------- CLIP

const PAIR_TEXT = ['my cat asleep on the sofa', 'red car parked outside', 'sailboat on a calm lake'];

function clipSnap(f: number): { P: number[]; step: number; tau: number } {
  const i = Math.max(0, Math.min(CLIP_SNAPS.length - 1, Math.floor(f)));
  const j = Math.min(CLIP_SNAPS.length - 1, i + 1);
  const t = clamp01(f - i);
  const A = CLIP_SNAPS[i]!, B = CLIP_SNAPS[j]!;
  return { P: A.P.map((v, q) => lerp(v, B.P[q]!, t) / 100), step: Math.round(lerp(A.step, B.step, t)), tau: lerp(A.tau, B.tau, t) };
}

const clip: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s);
    const cs = cifar(s);
    // Example web pairs.
    s.alpha(s.win('pairs', 'towers'), () => {
      const n = 3;
      const size = Math.min(ah * 0.2, aw * 0.2);
      const y0 = ay + ah * 0.08;
      for (let i = 0; i < n; i++) {
        const y = y0 + i * (size + u * 4);
        const a = s.ease('pairs', 0.5, 0.5 + 0.4 * i);
        s.alpha(a, () => {
          if (cs) drawPhoto(s, photo(cs, [3, 1, 8][i]!, 6), ax + aw * 0.12, y, size);
          s.text(`“${PAIR_TEXT[i]}”`, ax + aw * 0.12 + size + u * 4, y + size / 2, { size: 3.6, italic: true, align: 'left', color: s.c('green') });
        });
      }
      s.text('for example: an image and the text next to it', w / 2, y0 + n * (size + u * 4) + u * 2, { size: 3, font: 'ui', color: s.c('--ink-3') });
      s.alpha(s.ease('data', 0.6), () => s.text('400,000,000 pairs', w / 2, ay + ah * 0.93, { size: 5.6, font: 'display', weight: 600, color: s.c('green') }));
    });
    // Two towers into one space.
    s.alpha(s.win('towers', 'matrix'), () => {
      const tall = s.tall;
      const bw = Math.min(aw * 0.3, u * 30);
      const bh = u * 11;
      const x1 = ax + aw * 0.22;
      const x2 = ax + aw * 0.78;
      const by = ay + ah * 0.22;
      box(s, x1, by, bw, bh, 'image encoder', 'blue', { size: 3.4, sub: 'ResNet or ViT' });
      box(s, x2, by, bw, bh, 'text encoder', 'blue', { size: 3.4, sub: 'transformer' });
      const sa = s.ease('shared', 0.6);
      const R = Math.min(aw * 0.2, ah * (tall ? 0.22 : 0.25));
      const cx = w / 2;
      const cy = ay + ah * 0.66;
      s.alpha(sa, () => {
        unitCircle(s, cx, cy, R);
        s.arrow(x1, by + bh / 2 + u, cx - R * 0.5, cy - R * 0.9, s.c('purple'), 0.4, 1.8);
        s.arrow(x2, by + bh / 2 + u, cx + R * 0.5, cy - R * 0.9, s.c('green'), 0.4, 1.8);
        const angs = [0.5, 2.2, 3.9];
        angs.forEach((a, i) => {
          const zx = cx + R * Math.cos(a), zy = cy - R * Math.sin(a);
          const tx = cx + R * Math.cos(a + 0.18), ty = cy - R * Math.sin(a + 0.18);
          s.circle(zx, zy, u * 1.4, { fill: s.c('purple') });
          s.circle(tx, ty, u * 1.4, { fill: s.c('--card'), stroke: s.c('green'), lw: 0.5 });
          if (i === 0) {
            s.text('z', zx + u * 3.5, zy + u * 1.5, { size: 3.6, italic: true, weight: 600, color: s.c('purple'), halo: true });
            s.text('t', tx + u * 1, ty - u * 3.5, { size: 3.6, italic: true, weight: 600, color: s.c('green'), halo: true });
          }
        });
        s.text('one shared space', cx, cy + R + u * 6, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
      });
    });
    // The toy matrix.
    const ma = s.win('matrix', 'why');
    if (ma > 0) {
      const progress = s.since('toy') < 0 ? CLIP_SNAPS.length - 1 : Math.min(CLIP_SNAPS.length - 1, s.span('toy', 'tau') * (CLIP_SNAPS.length - 1));
      const snap = clipSnap(progress);
      const imgs = clipPairs();
      s.alpha(ma, () => {
        const n = 6;
        const head = u * 13;
        const cell = Math.min((aw - u * 12) / (n + 0.4), (ah - head - u * 20) / n);
        const mx = w / 2 - (cell * n) / 2 + u * 4;
        const my = ay + head + u * 2;
        imgs.forEach((im, i) => {
          const ts = Math.min(cell * 0.82, u * 10);
          drawShape(s.ctx, im, mx - ts - u * 2, my + i * cell + (cell - ts) / 2, ts);
          const words = im.caption.split(' ').slice(1);
          words.forEach((wd, q) => s.text(cell < u * 12 ? (SHORT[wd] ?? wd) : wd, mx + i * cell + cell / 2, ay + u * 1 + q * u * 3.8, { size: 2.8, font: 'mono', weight: q === 1 ? 600 : 450, color: s.c(q === 1 ? 'green' : '--ink-2') }));
        });
        heat(s, mx, my, cell, snap.P, n, n, { k: 'teal', label: (v) => `${Math.round(v * 100)}`, size: Math.min(3, (cell / u) * 0.3) });
        const rowA = s.win('matrix', 'sym');
        const colA = s.win('sym', 'toy');
        s.alpha(rowA, () => s.rrect(mx - 1, my - 1, cell * n + 2, cell + 2, 0.6, { stroke: s.c('purple'), lw: 0.7 }));
        s.alpha(colA, () => s.rrect(mx - 1, my - 1, cell + 2, cell * n + 2, 0.6, { stroke: s.c('green'), lw: 0.7 }));
        s.alpha(s.ease('toy', 0.5), () => s.text(`toy step ${snap.step}`, w / 2, my + n * cell + u * 5, { size: 3.4, font: 'mono', color: s.c('--ink-2') }));
        s.alpha(s.ease('tau', 0.5), () => pill(s, `learned τ: 0.07 → ${fmt(snap.tau, 3)}   real batch: 32,768`, w / 2, my + n * cell + u * 11, 'slate', { size: 3.2, font: 'mono' }));
      });
    }
    // Why matching: relative efficiency.
    s.alpha(s.ease('why', 0.6), () => {
      const rows: [string, number, K][] = [
        ['predict the caption, word by word', 1, '--ink-3'],
        ['predict a bag of its words', 3, 'blue'],
        ['match image and caption', 12, 'green'],
      ];
      const y0 = ay + ah * 0.3;
      const bwMax = aw * 0.55;
      s.text('how fast zero-shot accuracy rises (CLIP paper)', w / 2, y0 - u * 8, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
      rows.forEach(([name, v, k], i) => {
        const y = y0 + i * u * 14;
        s.text(name, ax + u * 2, y, { size: 3.3, font: 'ui', align: 'left', color: s.c('--ink') });
        s.rrect(ax + u * 2, y + u * 3, Math.max(u, (v / 12) * bwMax), u * 4.5, 0.8, { fill: s.tint(k, 0.7) });
        s.text(`${v}×`, ax + u * 4 + Math.max(u, (v / 12) * bwMax), y + u * 5.3, { size: 3.3, font: 'mono', weight: 600, align: 'left', color: s.c(k) });
      });
    });
  },
};

export const scenesB: Record<string, SceneDef> = { collapse, simclr, moco, clip };
