import { CIFAR_CLASSES } from '../../core/data';
import { type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { traceOf } from '../../lib/vit-figs';
import { CLSI, FEW, MAIN, data } from './data';
import { bars, current, grid, heat, pill, pix, veil } from './kit';
import { loading } from './scenes-a';

const top3 = (p: Float32Array): [string, number][] =>
  Array.from(p).map((v, i) => [CIFAR_CLASSES[i]!, v] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 3);

// ---------------------------------------------------------------- class-token attention

const cls: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = data(s);
    if (!d) return loading(s);
    const m = d.a.vit;
    const tall = s.tall;
    const beat = current(s, ['table', 'row0', 'image', 'layers', 'deeper', 'chain', 'object', 'others', 'caution']);
    const T = m.N + 1;
    // the attention table of the last layer, row 0 lit
    const tA = s.win('table', 'image');
    if (tA > 0) {
      s.alpha(tA, () => {
        const S = tall ? Math.min(h * 0.5, w * 0.5) : Math.min(h * 0.62, w * 0.5);
        const x = tall ? 7 * u : w * 0.12, y = tall ? 10 * u : (h - S) / 2 + 3 * u;
        const A = m.meanHeads(traceOf(d.a, m, CLSI), m.L - 1);
        let mx = 0;
        for (let i = 0; i < T * T; i++) mx = Math.max(mx, A[i]!);
        const cs = S / T;
        for (let i = 0; i < T; i++)
          for (let j = 0; j < T; j++) {
            s.ctx.fillStyle = s.tint('purple', clamp01(Math.sqrt(A[i * T + j]! / mx)));
            s.ctx.fillRect(x + j * cs, y + i * cs, cs + 0.3, cs + 0.3);
          }
        s.rrect(x, y, S, S, 0.3, { stroke: s.tint('purple', 0.6), lw: 0.2 });
        s.text('A: 65 × 65, layer 6', x + S / 2, y - 3.5 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('purple') });
        s.alpha(s.ease('row0', 0.5), () => {
          s.rrect(x - 0.6 * u, y - 0.6 * u, S + 1.2 * u, cs + 1.2 * u, 0.3, { stroke: s.c('gold'), lw: 0.5 });
          s.text('row 0: the class token', x + S + 4 * u, y + 1 * u, { size: 3.4, font: 'ui', weight: 600, align: 'left', color: s.c('gold') });
          const map = d.cls(CLSI, m.L - 1, 4);
          const t = Math.min(w - (x + S + 8 * u) - 4 * u, S * 0.7);
          heat(s, map, m.G, x + S + 6 * u, y + 7 * u, t, 'purple');
          s.text('64 weights,', x + S + 6 * u + t / 2, y + 11 * u + t, { size: 3, font: 'ui', color: s.c('--ink-2') });
          s.text('as an 8 × 8 grid', x + S + 6 * u + t / 2, y + 15.5 * u + t, { size: 3, font: 'ui', color: s.c('--ink-2') });
        });
        s.text('each row sums to 1', x + S / 2, y + S + 4.5 * u, { size: 3.2, italic: true, color: s.c('--ink-2') });
      });
    }
    // the main image and the small multiples
    const mA = s.win('image', 'others');
    if (mA > 0) {
      s.alpha(mA, () => {
        // on an upright stage the grid takes over the stage while it is discussed
        const gridOnly = tall ? s.win('layers', 'object', 0.5) : 0;
        const roll = s.ease('object', 0.8);
        const lay = beat === 'layers' ? 0 : m.L - 1;
        const map = d.cls(CLSI, roll > 0.5 ? m.L - 1 : lay, roll > 0.5 ? 5 : 4);
        const [c, p] = d.pred(CLSI);
        const S = tall ? Math.min(w * 0.55, h * 0.6) : Math.min(h * 0.6, w * 0.34);
        const ix = tall ? 6 * u : 6 * u, iy = tall ? 7 * u : 12 * u;
        s.alpha(1 - gridOnly, () => {
          veil(s, d.img(CLSI), map, m.G, ix, iy, S);
          const tx = tall ? ix + S + 5 * u : ix + S / 2;
          const ty = tall ? iy + 5 * u : iy + S + 4 * u;
          const al = tall ? 'left' : 'center';
          s.text(roll > 0.5 ? 'rollout, 6 layers' : `layer ${lay + 1}, mean of heads`, tx, ty, { size: 3.2, font: 'ui', weight: 600, align: al, color: s.c('purple') });
          s.text(`label: ${CIFAR_CLASSES[d.a.test.labels[CLSI]!]}`, tx, ty + 6 * u, { size: 3.2, font: 'mono', align: al, color: s.c('gold') });
          s.text(`guess: ${c} ${Math.round(p * 100)}%`, tx, ty + 11.5 * u, { size: 3.2, font: 'mono', align: al, color: s.c('--ink-2') });
        });
        // grid of layer x head maps
        const gA = s.ease('layers', 0.6) * (tall ? gridOnly : 1);
        s.alpha(gA, () => {
          const cols = 5 + (s.since('chain') >= 0 ? 1 : 0);
          const gx = tall ? 12 * u : ix + S + 14 * u;
          const gy = tall ? 9 * u : iy + 4 * u;
          const t = Math.min((w - gx - 4 * u) / 6 - 1 * u, ((h - gy - 5 * u) / 6) - 1 * u);
          const heads = ['h1', 'h2', 'h3', 'h4', 'mean', 'roll'];
          for (let j = 0; j < cols; j++) s.text(heads[j]!, gx + j * (t + u) + t / 2, gy - 2.5 * u, { size: 3, font: 'ui', color: j === 5 ? s.c('purple') : s.c('--ink-3') });
          for (let l = 0; l < m.L; l++) {
            const lit = beat === 'deeper' ? (l >= 3 ? 1 : 0.35) : 1;
            s.text(`L${l + 1}`, gx - 1.5 * u, gy + l * (t + u) + t / 2, { size: 3, font: 'ui', align: 'right', color: s.c('--ink-3') });
            s.alpha(lit, () => {
              for (let j = 0; j < cols; j++) {
                const a = j === 5 ? s.ease('chain', 0.4, 0.25 * l) : 1;
                s.alpha(a, () => heat(s, d.cls(CLSI, l, j), m.G, gx + j * (t + u), gy + l * (t + u), t, 'purple'));
              }
            });
          }
        });
      });
    }
    // a few more images
    const oA = s.win('others', 'caution');
    if (oA > 0) {
      s.alpha(oA, () => {
        const ids = [CLSI, ...FEW].slice(0, tall ? 4 : 5);
        const per = tall ? 2 : ids.length;
        const S = tall ? Math.min((w - 15 * u) / 2, (h - 30 * u) / 2) : Math.min((w - 10 * u) / ids.length - 4 * u, h * 0.6);
        ids.forEach((i, k) => {
          const col = k % per, row = Math.floor(k / per);
          const x = (w - (per * S + (per - 1) * 5 * u)) / 2 + col * (S + 5 * u);
          const y = (tall ? 4 * u : (h - S) / 2 - 4 * u) + row * (S + 13 * u);
          s.alpha(s.ease('others', 0.5, 0.3 * k), () => {
            veil(s, d.img(i), d.cls(i, m.L - 1, 5), m.G, x, y, S);
            const [c, p] = d.pred(i);
            s.text(`${c} ${Math.round(p * 100)}%`, x + S / 2, y + S + 4 * u, { size: 3.3, font: 'mono', weight: 600, color: c === CIFAR_CLASSES[d.a.test.labels[i]!] ? s.c('green') : s.c('red') });
          });
        });
      });
    }
    s.alpha(s.ease('caution', 0.6), () => {
      s.text('attention maps are evidence,', w / 2, h * 0.42, { size: 5, font: 'display', weight: 600 });
      s.text('not explanations', w / 2, h * 0.42 + 8 * u, { size: 5, font: 'display', weight: 600, color: s.c('purple') });
      s.text('where information was read from, not what was done with it', w / 2, h * 0.42 + 17 * u, { size: 3.3, italic: true, color: s.c('--ink-2') });
    });
  },
};

// ---------------------------------------------------------------- a bag of patches

const set: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = data(s);
    if (!d) return loading(s);
    const tall = s.tall;
    const beat = current(s, ['strange', 'why', 'shuffle', 'bag', 'two', 'scramble', 'same', 'still', 'break']);
    // tokens shuffled in and out
    const tA = s.win('strange', 'two');
    if (tA > 0) {
      s.alpha(tA, () => {
        const n = 6;
        const perm = [3, 0, 5, 1, 4, 2];
        const sh = s.ease('shuffle', 1.2, 0.3);
        const xs = (k: number) => w * 0.22 + (k * w * 0.62) / (n - 1);
        const y0 = h * 0.3, y1 = h * 0.62;
        const colors = ['orange', 'teal', 'blue', 'red', 'green', 'purple'] as const;
        s.circle(w * 0.1, y0, 3.2 * u, { fill: s.tint('gold', 0.3), stroke: s.c('gold'), lw: 0.4 });
        s.circle(w * 0.1, y1, 3.2 * u, { fill: s.tint('gold', 0.3), stroke: s.c('gold'), lw: 0.4 });
        s.text('cls', w * 0.1, y0 - 5.5 * u, { size: 3, font: 'mono', color: s.c('gold') });
        for (let k = 0; k < n; k++) {
          const slot = lerp(k, perm.indexOf(k), sh);
          s.circle(xs(slot), y0, 3.2 * u, { fill: s.tint(colors[k]!, 0.3), stroke: s.c(colors[k]!), lw: 0.4 });
          s.circle(xs(slot), y1, 3.2 * u, { fill: s.tint(colors[k]!, 0.5), stroke: s.c(colors[k]!), lw: 0.4 });
          s.arrow(xs(slot), y0 + 4 * u, xs(slot), y1 - 4 * u, s.tint('--ink-3', 0.6), 0.25, 1.4);
        }
        for (let k = 0; k < n; k++) s.text(String(k + 1), xs(k), y0 - 5.5 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('encoder, no positions', w * 0.53, (y0 + y1) / 2, { size: 3.4, font: 'ui', weight: 600, color: s.c('--ink-2'), halo: true });
        s.alpha(s.ease('why', 0.6) * (1 - s.ease('shuffle', 0.5)), () => s.text('dot products and per-token layers: no slot numbers anywhere', w / 2, h * 0.82, { size: 3.3, italic: true, color: s.c('--ink-2') }));
        s.alpha(s.ease('shuffle', 0.6, 1.2) * (1 - s.ease('bag', 0.5)), () => s.text('outputs shuffle the same way; the class token is unchanged', w / 2, h * 0.82, { size: 3.3, italic: true, color: s.c('--ink-2') }));
        s.alpha(s.ease('bag', 0.6), () => pill(s, 'a set, not a sequence: a bag of patches', w / 2, h * 0.82, 'orange', 3.6, 'center', 'ui'));
      });
    }
    // the two trained models on a shuffled image
    const mA = s.win('two', 'break');
    if (mA > 0) {
      s.alpha(mA, () => {
        const S = tall ? Math.min(w * 0.45, h * 0.4) : Math.min(h * 0.5, w * 0.28);
        const ix = tall ? (w - S) / 2 : 6 * u, iy = tall ? 5 * u : (h - S) / 2 - 4 * u;
        const sh = s.ease('scramble', 1.2, 0.2);
        const src = d.img(MAIN);
        const G = 8, P = 4, cs = S / G;
        const order = d.shuffle.order;
        for (let slot = 0; slot < 64; slot++) {
          const j = order[slot]!;
          const fx = (j % G) * cs, fy = Math.floor(j / G) * cs;
          const tx = (slot % G) * cs, ty = Math.floor(slot / G) * cs;
          pix(s, src, ix + lerp(fx, tx, sh), iy + lerp(fy, ty, sh), cs + 0.4, cs + 0.4, (j % G) * P, Math.floor(j / G) * P, P, P);
        }
        s.text(sh > 0.5 ? 'shuffled' : 'in order', ix + S / 2, iy + S + 4 * u, { size: 3.3, font: 'ui', weight: 600, color: s.c('orange') });
        const shuffled = s.since('scramble') >= 0 ? 1 : 0;
        const bw = tall ? (w - 15 * u) / 2 : (w - ix - S - 18 * u) / 2;
        const bx = tall ? 5 * u : ix + S + 8 * u;
        const by = tall ? iy + S + 14 * u : iy + 4 * u;
        const truth = CIFAR_CLASSES[d.a.test.labels[MAIN]!]!;
        const rows = (p: Float32Array) => top3(p);
        s.text('vit (with E_pos)', bx, by - 4 * u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('purple') });
        const r1 = rows(d.shuffle.vit[shuffled]!);
        bars(s, bx, by, bw, r1, 'purple', 3.1, 0, r1.findIndex((r) => r[0] === truth));
        s.alpha(s.ease('same', 0.5), () => {
          s.text('vit_nopos', bx + bw + 5 * u, by - 4 * u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('teal') });
          const r2 = rows(d.shuffle.nopos[shuffled]!);
          bars(s, bx + bw + 5 * u, by, bw, r2, 'teal', 3.1, 0, r2.findIndex((r) => r[0] === truth));
          let dmax = 0;
          for (let c = 0; c < 10; c++) dmax = Math.max(dmax, Math.abs(d.shuffle.nopos[0][c]! - d.shuffle.nopos[1][c]!));
          s.text(`max change: ${dmax < 5e-5 ? '0.0000' : dmax.toFixed(4)}`, bx + bw + 5 * u, by + 19 * u, { size: 3, font: 'mono', align: 'left', color: s.c('teal') });
        });
        s.alpha(s.ease('still', 0.6), () => pill(s, `vit_nopos: ${Math.round(d.a.nopos.testAcc * 100)}% · vit: ${Math.round(d.a.vit.testAcc * 100)}% on the CIFAR-10 test set`, w / 2, h - 5 * u, 'teal', 3.2, 'center', 'ui'));
        void beat;
      });
    }
    // the same patch in two slots
    s.alpha(s.ease('break', 0.6), () => {
      const src = d.img(MAIN);
      const t = 16 * u;
      const y = h * 0.45;
      for (const [k, x] of [[0, w * 0.3], [1, w * 0.7]] as const) {
        pix(s, src, x - t / 2, y - t - 4 * u, t, t, 12, 12, 4, 4);
        s.text('+', x, y + 1 * u, { size: 4, font: 'mono', weight: 600, color: s.c('--ink-2') });
        s.text(k ? 'E_pos[40]' : 'E_pos[9]', x, y + 7 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('red') });
        s.text('=', x, y + 13 * u, { size: 4, font: 'mono', weight: 600, color: s.c('--ink-2') });
        pill(s, k ? 'token B' : 'token A', x, y + 20 * u, k ? 'blue' : 'green', 3.4);
      }
      s.text('the same patch in two slots becomes two different tokens', w / 2, h * 0.86, { size: 3.4, italic: true, color: s.c('--ink-2') });
    });
  },
};

// ---------------------------------------------------------------- learned positions

const positions: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = data(s);
    if (!d) return loading(s);
    const tall = s.tall;
    const gA = s.win('compare', 'paper');
    const tr = s.ease('trained', 1.2);
    s.alpha(s.ease('random', 0.5) * (1 - s.ease('compare', 0.5)), () => {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const x = w * 0.12 + (i * w * 0.76) / (n - 1);
        const vals = Array.from(d.a.vit.pos.subarray((i + 1) * 64, (i + 1) * 64 + 12));
        let mx = 1e-9;
        for (const v of vals) mx = Math.max(mx, Math.abs(v));
        vals.forEach((v, q) => {
          s.ctx.fillStyle = s.tint('red', 0.15 + 0.7 * Math.abs(v) / mx);
          s.ctx.fillRect(x - 2 * u, h * 0.3 + q * 2.6 * u, 4 * u, 2.4 * u);
        });
        s.text(String(i), x, h * 0.3 - 3 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      }
      s.text('E_pos rows for slots 0 to 7 (first 12 numbers)', w / 2, h * 0.3 - 9 * u, { size: 3.2, font: 'ui', weight: 600, color: s.c('red') });
      s.text('one learned vector per slot, no grid in sight', w / 2, h * 0.75, { size: 3.6, italic: true, color: s.c('--ink-2') });
    });
    if (gA > 0) {
      s.alpha(gA, () => {
        const S = tall ? Math.min(w - 12 * u, h - 22 * u) : Math.min(h - 18 * u, w * 0.55);
        const gx = tall ? (w - S) / 2 : 8 * u, gy = 10 * u;
        const gap = S * 0.012;
        const t = (S - 7 * gap) / 8;
        const showAll = s.ease('grid', 0.6);
        for (let i = 0; i < 64; i++) {
          const x = gx + (i % 8) * (t + gap), y = gy + Math.floor(i / 8) * (t + gap);
          const a = i === 27 ? 1 : showAll * clamp01(s.since('grid') * 8 - (i % 8) - Math.floor(i / 8));
          const big = i === 27 ? 1 - showAll : 0;
          const B = S * 0.55;
          s.alpha(a, () => {
            const S0 = d.sim.init.subarray(i * 64, (i + 1) * 64);
            const S1 = d.sim.tr.subarray(i * 64, (i + 1) * 64);
            const mix = Array.from(S0, (v, k) => lerp(v, S1[k]!, tr));
            heat(s, mix, 8, lerp(x, gx + (S - B) / 2, big), lerp(y, gy + (S - B) / 2, big), lerp(t, B, big), 'red', 1, 'blue');
          });
        }
        s.alpha(1 - showAll, () => s.text('slot 27 against all 64 slots', gx + S / 2, gy + S * 0.775 + 4 * u, { size: 3.3, font: 'ui', color: s.c('--ink-2') }));
        const lab = tr > 0.5 ? 'after training' : 'at initialization';
        s.text(`similarity between slots, ${lab}`, gx + S / 2, gy - 4 * u, { size: 3.4, font: 'ui', weight: 600, color: s.c('red') });
        if (!tall) {
          const bx = gx + S + 8 * u, bw = w - bx - 6 * u;
          const notes = tr > 0.5 ? ['neighbors are similar', 'rows and columns', 'share a signature'] : ['each vector resembles', 'only itself'];
          s.alpha(s.ease('init', 0.5), () => notes.forEach((t2, i) => s.text(t2, bx, h * 0.4 + i * 6.5 * u, { size: 3.6, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') })));
          s.alpha(s.ease('found', 0.6), () => pill(s, 'a 2-D grid, from data', bx, h * 0.62, 'red', Math.min(3.4, bw / u / 7), 'left', 'ui'));
        }
      });
    }
    s.alpha(s.ease('paper', 0.6), () => {
      s.text('2-D or relative position embeddings:', w / 2, h * 0.36, { size: 4, font: 'ui', weight: 600 });
      s.text('no better than learned 1-D ones', w / 2, h * 0.36 + 7 * u, { size: 4, font: 'ui', weight: 600, color: s.c('red') });
      s.alpha(s.ease('resize', 0.6), () => {
        const y = h * 0.62;
        for (const [G, x] of [[8, w * 0.32], [12, w * 0.68]] as const) {
          const S = 26 * u;
          s.rrect(x - S / 2, y, S, S, 0.6, { fill: s.tint('red', 0.08), stroke: s.tint('red', 0.6), lw: 0.3 });
          grid(s, x - S / 2, y, S, G, s.tint('red', 0.45), 0.15);
          s.text(`${G} × ${G}`, x, y + S + 4.5 * u, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
        }
        s.arrow(w * 0.32 + 15 * u, y + 13 * u, w * 0.68 - 15 * u, y + 13 * u, s.c('--ink-3'), 0.4, 2);
        s.text('interpolate', w / 2, y + 9.5 * u, { size: 3.2, italic: true, color: s.c('--ink-2') });
      });
    });
  },
};

// ---------------------------------------------------------------- inductive bias

const bias: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = data(s);
    if (!d) return loading(s);
    const tall = s.tall;
    const src = d.img(MAIN);
    s.alpha(s.win('define', 'local'), () => {
      s.text('inductive bias', w / 2, h * 0.4, { size: 7, font: 'display', weight: 600 });
      s.text('what a model prefers before it sees any data', w / 2, h * 0.4 + 9 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
    // ConvNet: a filter sliding, then a shift that the response follows
    const cA = s.win('local', 'vit');
    if (cA > 0) {
      s.alpha(cA, () => {
        const S = tall ? Math.min((w - 15 * u) / 2, h * 0.5) : Math.min(h * 0.6, w * 0.3);
        const x1 = tall ? 5 * u : w / 2 - S - 5 * u, x2 = x1 + S + 5 * u, y = tall ? 12 * u : (h - S) / 2;
        const shift = Math.round(8 * clamp01(s.span('equi', 'vit') * 1.3));
        const px = s.since('equi') >= 0 ? shift : 0;
        // the image, rolled
        const c = s.ctx;
        c.save();
        c.beginPath();
        c.rect(x1, y, S, S);
        c.clip();
        const off = (px / 32) * S;
        pix(s, src, x1 + off, y, S, S);
        pix(s, src, x1 + off - S, y, S, S);
        c.restore();
        s.text(`image, slid ${px} px`, x1 + S / 2, y - 3 * u, { size: 3.2, font: 'ui', weight: 600, color: s.c('orange') });
        // filter boxes
        const fs = (3 * S) / 32;
        if (s.since('equi') < 0) {
          const p = s.span('local', 'equi');
          const k = Math.floor(p * 25);
          s.rrect(x1 + ((k % 5) / 5) * (S - fs), y + (Math.floor(k / 5) / 5) * (S - fs), fs, fs, 0.3, { stroke: s.c('blue'), lw: 0.6 });
          s.alpha(s.ease('share', 0.5), () => {
            for (let q = 0; q < 4; q++) s.rrect(x1 + S * (0.15 + 0.55 * (q % 2)), y + S * (0.2 + 0.5 * Math.floor(q / 2)), fs, fs, 0.3, { stroke: s.tint('blue', 0.7), lw: 0.4 });
          });
        }
        // conv response
        s.alpha(s.ease('equi', 0.5), () => {
          const e = d.edges(MAIN, px);
          const cs = S / 32;
          for (let q = 0; q < 1024; q++) {
            s.ctx.fillStyle = s.tint('teal', clamp01(Math.abs(e[q]!) / 1.2));
            s.ctx.fillRect(x2 + (q % 32) * cs, y + Math.floor(q / 32) * cs, cs + 0.3, cs + 0.3);
          }
          s.rrect(x2, y, S, S, 0.4, { stroke: s.tint('teal', 0.6), lw: 0.2 });
          s.text('conv response', x2 + S / 2, y - 3 * u, { size: 3.2, font: 'ui', weight: 600, color: s.c('teal') });
        });
        const ty = y + S + 7 * u;
        s.alpha(s.win('local', 'equi'), () => {
          s.text('locality: a 3 × 3 filter sees 3 × 3 pixels', w / 2, ty, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
          s.alpha(s.ease('share', 0.5), () => s.text('weight sharing: the same filter at every position', w / 2, ty + 6 * u, { size: 3.4, font: 'ui', color: s.c('--ink-2') }));
        });
        s.alpha(s.ease('exact', 0.5), () => pill(s, 'conv(shift(x)) = shift(conv(x)), every shift', w / 2, ty + 2 * u, 'teal', 3.4, 'center', 'mono'));
      });
    }
    // ViT: fixed patch grid over a sliding image
    const vA = s.win('vit', 'global');
    if (vA > 0) {
      s.alpha(vA, () => {
        const S = Math.min(h * 0.6, w * 0.5);
        const x = (w - S) / 2, y = 9 * u;
        const px = s.since('four') >= 0 ? 4 : 1;
        const c = s.ctx;
        c.save();
        c.beginPath();
        c.rect(x, y, S, S);
        c.clip();
        const off = (px / 32) * S;
        pix(s, src, x + off, y, S, S);
        pix(s, src, x + off - S, y, S, S);
        c.restore();
        grid(s, x, y, S, 8, 'rgba(255,255,255,0.9)', 0.25);
        s.text(`image slid ${px} px under a fixed 4 px patch grid`, w / 2, y - 3.5 * u, { size: 3.2, font: 'ui', weight: 600, color: s.c('orange') });
        s.text(px === 1 ? 'every patch now holds a new mix of pixels' : 'the old patches, in new slots, with new E_pos', w / 2, y + S + 6 * u, { size: 3.5, font: 'ui', weight: 600, color: px === 1 ? s.c('red') : s.c('purple') });
      });
    }
    // global attention
    s.alpha(s.ease('global', 0.6), () => {
      const S = Math.min(h * 0.55, w * 0.5);
      const x = (w - S) / 2, y = 8 * u;
      pix(s, src, x, y, S, S);
      grid(s, x, y, S, 8, 'rgba(255,255,255,0.6)', 0.15);
      const cs = S / 8;
      const q = 27;
      const qx = x + (q % 8 + 0.5) * cs, qy = y + (Math.floor(q / 8) + 0.5) * cs;
      for (let j = 0; j < 64; j++) {
        if (j === q) continue;
        s.line(qx, qy, x + (j % 8 + 0.5) * cs, y + (Math.floor(j / 8) + 0.5) * cs, s.tint('purple', 0.45), 0.15);
      }
      s.circle(qx, qy, 1.2 * u, { fill: s.c('orange') });
      s.text('layer 1: any patch can attend to any patch', w / 2, y + S + 6 * u, { size: 3.5, font: 'ui', weight: 600, color: s.c('purple') });
      s.alpha(s.ease('learn', 0.6), () => pill(s, 'locality and shifts: learned from data', w / 2, y + S + 14 * u, 'red', 3.4, 'center', 'ui'));
    });
  },
};

export const scenesB: Record<string, SceneDef> = { cls, set, positions, bias };
