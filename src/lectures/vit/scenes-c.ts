import type { Color } from '../../core/symbols';
import { type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { traceOf } from '../../lib/vit-figs';
import { CLSI, MAIN, data } from './data';
import { type K, block, current, grid, pill, pix, veil } from './kit';
import { loading } from './scenes-a';

const HEAD_K: Color[] = ['blue', 'orange', 'green', 'red'];

// ---------------------------------------------------------------- attention distance

const distance: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = data(s);
    if (!d) return loading(s);
    const m = d.a.vit;
    const tall = s.tall;
    // one query patch and where one head sends it
    const qA = s.win('measure', 'chart');
    if (qA > 0) {
      s.alpha(qA, () => {
        const S = Math.min(h * 0.62, w * 0.5);
        const x = tall ? (w - S) / 2 : 8 * u, y = 8 * u;
        const tr = traceOf(d.a, m, MAIN);
        const T = m.N + 1, q = 27, l = 0, hd = 0;
        const row = tr.A[l]!.subarray((hd * T + q + 1) * T + 1, (hd * T + q + 1) * T + T);
        veil(s, d.img(MAIN), row, m.G, x, y, S);
        const cs = S / 8;
        const qx = x + (q % 8 + 0.5) * cs, qy = y + (Math.floor(q / 8) + 0.5) * cs;
        s.alpha(s.ease('how', 0.6), () => {
          const top = Array.from(row).map((v, j) => [v, j] as const).sort((a, b) => b[0] - a[0]).slice(0, 5);
          top.forEach(([v, j]) => {
            if (j === q) return;
            s.arrow(qx, qy, x + (j % 8 + 0.5) * cs, y + (Math.floor(j / 8) + 0.5) * cs, s.tint('orange', 0.5 + v), 0.35, 1.6);
          });
        });
        s.rrect(x + (q % 8) * cs, y + Math.floor(q / 8) * cs, cs, cs, 0.2, { stroke: s.c('orange'), lw: 0.6 });
        s.text('layer 1, head 1, one query patch', x + S / 2, y - 3.5 * u, { size: 3.2, font: 'ui', weight: 600, color: s.c('blue') });
        let ds = 0, ws = 0;
        for (let j = 0; j < m.N; j++) {
          ds += row[j]! * m.dist(q, j);
          ws += row[j]!;
        }
        const tx = tall ? w / 2 : x + S + 8 * u;
        const ty = tall ? y + S + 7 * u : y + S * 0.35;
        const al = tall ? 'center' : 'left';
        s.alpha(s.ease('how', 0.5, 0.8), () => {
          s.text('Σ weight × distance', tx, ty, { size: 3.8, font: 'mono', weight: 600, align: al, color: s.c('--ink') });
          s.text(`= ${(ds / ws).toFixed(1)} px`, tx, ty + 6.5 * u, { size: 3.6, font: 'mono', align: al, color: s.c('blue') });
          s.text('for this patch', tx, ty + 12 * u, { size: 3.3, font: 'ui', align: al, color: s.c('--ink-2') });
        });
        s.alpha(s.ease('rf', 0.5), () => s.text('a receptive field, learned', tx, ty + 19 * u, { size: 3.6, italic: true, align: al, color: s.c('--ink-2') }));
      });
    }
    // the chart over all heads and layers
    const cA = s.ease('chart', 0.6) * (1 - s.ease('paper', 0.6));
    if (cA > 0) {
      s.alpha(cA, () => {
        const cx = 14 * u, cy = 10 * u;
        const cw = w - cx - 6 * u, ch = h - cy - 16 * u;
        const ymax = 20;
        const X = (l: number) => cx + ((l + 0.5) / m.L) * cw;
        const Y = (v: number) => cy + ch * (1 - v / ymax);
        for (let v = 0; v <= ymax; v += 4) {
          s.line(cx, Y(v), cx + cw, Y(v), s.c('--grid'), 0.15);
          s.text(`${v}`, cx - 2 * u, Y(v), { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
        }
        s.text('px', cx - 2 * u, cy - 3 * u, { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
        for (let l = 0; l < m.L; l++) s.text(`${l + 1}`, X(l), cy + ch + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('layer', cx + cw, cy + ch + 9.5 * u, { size: 3, font: 'ui', align: 'right', color: s.c('--ink-3') });
        s.line(cx, Y(d.dist.uniform), cx + cw, Y(d.dist.uniform), s.c('--ink-3'), 0.25, [1.2, 1]);
        const n = d.dist.n;
        if (n) {
          const means: number[] = [];
          for (let l = 0; l < m.L; l++) {
            const a = s.ease('chart', 0.4, 0.5 + 0.35 * l);
            let mu = 0;
            for (let hd = 0; hd < m.H; hd++) {
              const v = d.dist.sum[l * m.H + hd]! / n;
              mu += v / m.H;
              s.alpha(a, () => s.circle(X(l) + (hd - 1.5) * 2.6 * u, Y(v), 1.3 * u, { fill: s.c(HEAD_K[hd]!) }));
            }
            means.push(mu);
          }
          s.alpha(s.ease('ours', 0.6), () => {
            for (let l = 1; l < m.L; l++) s.line(X(l - 1), Y(means[l - 1]!), X(l), Y(means[l]!), s.c('--ink'), 0.4);
          });
        }
        HEAD_K.forEach((k, hd) => {
          const lx = cx + 2 * u + hd * 15 * u;
          s.circle(lx, cy + 1 * u, 1.1 * u, { fill: s.c(k) });
          s.text(`head ${hd + 1}`, lx + 2 * u, cy + 1.2 * u, { size: 2.9, font: 'ui', align: 'left', color: s.c('--ink-2') });
        });
        {
          const lx = cx + 2 * u + 4 * 15 * u;
          s.line(lx - 1.2 * u, cy + 1 * u, lx + 2 * u, cy + 1 * u, s.c('--ink-3'), 0.25, [1, 0.8]);
          s.text('even spread', lx + 3 * u, cy + 1.2 * u, { size: 2.9, font: 'ui', align: 'left', color: s.c('--ink-2') });
        }
        s.text(`tiny ViT, averaged over ${n} test images`, cx, cy + ch + 9.5 * u, { size: 2.9, font: 'ui', align: 'left', color: s.c('--ink-3') });
      });
    }
    // what the paper found
    s.alpha(s.ease('paper', 0.6), () => {
      s.text('ViT-L/16 (the paper):', w / 2, h * 0.24, { size: 4, font: 'ui', weight: 600 });
      const lines: [string, K][] = [['low layers: some heads local, some global', 'blue'], ['attention distance grows with depth', 'purple']];
      lines.forEach(([t, k], i) => s.text(t, w / 2, h * 0.24 + (8 + 6.5 * i) * u, { size: 3.6, font: 'ui', color: s.c(k) }));
      s.alpha(s.ease('learned', 0.6), () => pill(s, 'local heads: learned, not built in', w / 2, h * 0.58, 'green', 3.6, 'center', 'ui'));
      s.alpha(s.ease('hybrid', 0.6), () => {
        s.text('with a ResNet in front (hybrid):', w / 2, h * 0.72, { size: 3.6, font: 'ui', weight: 600 });
        s.text('fewer local heads', w / 2, h * 0.72 + 6.5 * u, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
      });
    });
  },
};

// ---------------------------------------------------------------- data

const DATASETS: [string, number, string, K, string][] = [
  ['ImageNet', 1.3e6, '1.3 M images', 'blue', 'ResNets ahead'],
  ['ImageNet-21k', 14e6, '14 M images', 'slate', 'roughly level'],
  ['JFT-300M', 303e6, '303 M images', 'purple', 'ViT ahead'],
];

const dataScene: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    // head start or ceiling
    s.alpha(s.win('head', 'exp'), () => {
      const cw = tall ? w - 12 * u : (w - 18 * u) / 2;
      const boxes: [string, string, string, K][] = [['strong bias', 'a head start: less data needed', 'a ceiling, if the assumption is off', 'blue'], ['weak bias', 'needs more data', 'more to gain from it', 'purple']];
      boxes.forEach(([t, a, b, k], i) => {
        const x = tall ? 6 * u : 6 * u + i * (cw + 6 * u);
        const y = tall ? 8 * u + i * 34 * u : h * 0.28;
        const ap = i === 0 ? s.ease('head', 0.5) : s.ease('ceiling', 0.5, 0.8);
        s.alpha(ap, () => {
          s.rrect(x, y, cw, 28 * u, 2, { fill: s.tint(k, 0.07), stroke: s.tint(k, 0.6), lw: 0.3 });
          s.text(t, x + cw / 2, y + 7 * u, { size: 4.4, font: 'display', weight: 600, color: s.c(k) });
          s.text(a, x + cw / 2, y + 15 * u, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
          s.alpha(i === 0 ? s.ease('ceiling', 0.5) : 1, () => s.text(b, x + cw / 2, y + 21.5 * u, { size: 3.4, font: 'ui', color: s.c('--ink-2') }));
        });
      });
    });
    // the experiment
    const eA = s.win('exp', 'lesson');
    if (eA > 0) {
      s.alpha(eA, () => {
        s.text('pretrain on…, then test on ImageNet', w / 2, 7 * u, { size: 3.8, font: 'ui', weight: 600 });
        const lx = tall ? 6 * u : 10 * u;
        const bx = tall ? 6 * u : w * 0.33;
        const bwMax = tall ? w * 0.45 : w * 0.22;
        const rowH = tall ? 22 * u : 17 * u;
        const keys = ['in1k', 'in21k', 'jft'];
        DATASETS.forEach(([name, n, size, k, verdict], i) => {
          const y = 16 * u + i * rowH;
          const on = s.ease(keys[i]!, 0.5);
          s.alpha(0.3 + 0.7 * on, () => s.text(name, lx, y + 2 * u, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c(k) }));
          s.alpha(on, () => {
            const by = tall ? y + 6 * u : y;
            const frac = (Math.log10(n) - 5) / (Math.log10(3.03e8) - 5);
            s.rrect(bx, by, Math.max(u, bwMax * frac), 4 * u, 0.6, { fill: s.tint(k, 0.5) });
            s.text(size, bx + bwMax * frac + 2 * u, by + 2 * u, { size: 3.1, font: 'mono', align: 'left', color: s.c('--ink-2') });
            const vx = tall ? w - 6 * u : w - 6 * u;
            const vy = tall ? by + 2 * u : y + 2 * u;
            pill(s, verdict, vx, vy, i === 0 ? 'blue' : i === 2 ? 'purple' : 'slate', 3.3, 'right', 'ui');
          });
        });
        s.alpha(s.ease('in1k', 0.6, 1.5) * (1 - s.ease('in21k', 0.4)), () => s.text('ViT-Large below ViT-Base', w / 2, 16 * u + 3 * rowH + 2 * u, { size: 3.4, italic: true, color: s.c('--ink-2') }));
        s.alpha(s.ease('top', 0.6), () => pill(s, 'ViT-H/14 + JFT-300M: 88.55% ImageNet top-1', w / 2, 16 * u + 3 * rowH + 4 * u, 'purple', 3.4, 'center', 'ui'));
        s.text('Dosovitskiy et al., 2020 (qualitative)', w / 2, h - 5 * u, { size: 2.9, italic: true, color: s.c('--ink-3') });
      });
    }
    s.alpha(s.ease('lesson', 0.6), () => {
      s.text('bias helps when data is scarce;', w / 2, h * 0.42, { size: 5, font: 'display', weight: 600 });
      s.text('with enough data, learn it directly', w / 2, h * 0.42 + 8 * u, { size: 5, font: 'display', weight: 600, color: s.c('purple') });
    });
  },
};

// ---------------------------------------------------------------- DeiT

const deit: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = data(s);
    const tall = s.tall;
    const beat = current(s, ['problem', 'deit', 'recipe', 'aug', 'biasdata', 'reg', 'token', 'loss', 'teacher', 'result']);
    s.alpha(s.win('problem', 'recipe'), () => {
      s.text('300 million labeled images?', w / 2, h * 0.36, { size: 5.5, font: 'display', weight: 600 });
      s.alpha(s.ease('deit', 0.6), () => {
        s.text('DeiT (Facebook AI, December 2020)', w / 2, h * 0.36 + 11 * u, { size: 4, font: 'ui', weight: 600, color: s.c('teal') });
        s.text('ImageNet only · one 8-GPU machine · under 3 days', w / 2, h * 0.36 + 18 * u, { size: 3.5, font: 'mono', color: s.c('--ink-2') });
      });
    });
    const pA = s.ease('recipe', 0.6);
    if (pA > 0) {
      s.alpha(pA, () => {
        // 1. augmentation
        const S = tall ? 15 * u : 13 * u;
        const ay = 6 * u;
        const aug = s.ease('aug', 0.6);
        const up = tall ? s.ease('token', 0.8) : 0;
        s.alpha(1 - up, () => s.alpha(0.35 + 0.65 * aug, () => s.text('1. augmentation', 6 * u, ay + 2 * u, { size: 3.6, font: 'ui', weight: 650, align: 'left', color: s.c('orange') })));
        s.alpha(aug * (1 - up), () => {
          if (d) {
            const src = d.img(MAIN);
            const x0 = 6 * u, y0 = ay + 6 * u;
            pix(s, src, x0, y0, S, S);
            const c = s.ctx;
            c.save();
            c.translate(x0 + 1.4 * S + S, y0);
            c.scale(-1, 1);
            pix(s, src, 0, 0, S, S, 4, 4, 26, 26);
            c.restore();
            pix(s, src, x0 + 2.8 * S, y0, S, S);
            s.alpha(0.45, () => pix(s, d.img(MAIN + 1), x0 + 2.8 * S, y0, S, S));
            s.rrect(x0 + 4.2 * S, y0, S, S, 0.3, { fill: s.c('--paper') });
            pix(s, src, x0 + 4.2 * S, y0, S, S);
            s.rrect(x0 + 4.2 * S + S * 0.3, y0 + S * 0.25, S * 0.45, S * 0.4, 0.2, { fill: s.c('--ink-3') });
            const labs = ['original', 'crop + flip', 'mixup', 'erasing'];
            labs.forEach((t, i) => s.text(t, x0 + i * 1.4 * S + S / 2, y0 + S + 3.5 * u, { size: 2.8, font: 'ui', color: s.c('--ink-3') }));
          }
          s.alpha(s.ease('biasdata', 0.5), () => s.text('= inductive bias, delivered through data', tall ? w / 2 : w * 0.72, tall ? ay + S + 15 * u : ay + 2 * u, { size: 3.3, italic: true, color: s.c('orange') }));
        });
        // 2. regularization
        const ry = tall ? ay + S + 22 * u : ay + S + 16 * u;
        const reg = s.ease('reg', 0.5);
        s.alpha((1 - up) * (0.35 + 0.65 * reg), () => s.text('2. regularization and long training', 6 * u, ry, { size: 3.6, font: 'ui', weight: 650, align: 'left', color: s.c('slate') }));
        s.alpha((1 - up) * reg, () => s.text('stochastic depth, label smoothing, 300 epochs', 6 * u, ry + 5.5 * u, { size: 3.2, font: 'ui', align: 'left', color: s.c('--ink-2') }));
        // 3. distillation token
        const dy = lerp(ry + 13 * u, 8 * u, up);
        s.alpha(0.35 + 0.65 * s.ease('token', 0.5), () => s.text('3. distillation through attention', 6 * u, dy, { size: 3.6, font: 'ui', weight: 650, align: 'left', color: s.c('teal') }));
        s.alpha(s.ease('token', 0.5), () => {
          const ty = dy + 9 * u;
          const toks: [string, K][] = [['cls', 'gold'], ['dist', 'teal'], ['p1', 'green'], ['p2', 'green'], ['…', '--ink-3'], ['pN', 'green']];
          const tw = Math.min(11 * u, (w * (tall ? 0.9 : 0.55)) / toks.length - u);
          toks.forEach(([t, k], i) => {
            const x = 6 * u + i * (tw + u);
            s.rrect(x, ty, tw, 6 * u, 1, { fill: s.tint(k, 0.15), stroke: s.tint(k, 0.7), lw: 0.3 });
            s.text(t, x + tw / 2, ty + 3.1 * u, { size: 3, font: 'mono', weight: 600, color: s.c(k) });
          });
          block(s, 6 * u, ty + 9 * u, 6 * (tw + u) - u, 8 * u, 'ViT encoder', 'purple', 3.4);
          const ly = ty + 23 * u;
          s.alpha(s.ease('loss', 0.5), () => {
            const x1 = 6 * u + tw / 2, x2 = 6 * u + tw * 1.5 + u;
            s.arrow(x1, ty + 17.5 * u, x1, ly - 2 * u, s.c('gold'), 0.35, 1.5);
            s.arrow(x2, ty + 17.5 * u, x2 + 8 * u, ly - 2 * u, s.c('teal'), 0.35, 1.5);
            s.text('½ CE( · , true label y)', x1 - 1 * u, ly + 1.5 * u, { size: 3, font: 'mono', align: 'left', color: s.c('gold') });
            s.text('½ CE( · , teacher\'s top guess)', x2 + 3 * u, ly + 7.5 * u, { size: 3, font: 'mono', align: 'left', color: s.c('teal') });
          });
          s.alpha(s.ease('teacher', 0.5), () => {
            const bx = tall ? w - 30 * u : w * 0.68, by = tall ? ty + 9 * u : ty;
            block(s, bx, by, 24 * u, 12 * u, 'ConvNet', 'blue', 3.6, 'teacher');
            s.text('passes on its bias', bx + 12 * u, by + 17 * u, { size: 3.1, italic: true, color: s.c('blue') });
          });
        });
        s.alpha(s.ease('result', 0.5), () => pill(s, 'competitive with ConvNets of similar speed', w / 2, h - 5 * u, 'teal', 3.4, 'center', 'ui'));
        void beat;
      });
    }
  },
};

// ---------------------------------------------------------------- Swin

const swin: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const beat = current(s, ['other', 'hybrid', 'swin', 'windows', 'cost', 'shift', 'merge', 'pyramid', 'convnext', 'lesson']);
    s.alpha(s.win('other', 'windows'), () => {
      s.text('put image structure back', w / 2, h * 0.3, { size: 5.5, font: 'display', weight: 600 });
      s.alpha(s.ease('hybrid', 0.6), () => {
        const y = h * 0.48;
        block(s, w * 0.12, y, w * 0.3, 11 * u, 'ResNet stages', 'blue', 3.4);
        s.arrow(w * 0.44, y + 5.5 * u, w * 0.54, y + 5.5 * u, s.c('--ink-3'), 0.4, 1.8);
        block(s, w * 0.56, y, w * 0.32, 11 * u, 'transformer', 'purple', 3.4);
        s.text('hybrid: one token per feature-map cell', w / 2, y + 17 * u, { size: 3.3, italic: true, color: s.c('--ink-2') });
      });
      s.alpha(s.ease('swin', 0.6), () => pill(s, 'Swin Transformer (Microsoft Research Asia, 2021)', w / 2, h * 0.84, 'teal', 3.5, 'center', 'ui'));
    });
    const gA = s.win('windows', 'convnext');
    if (gA > 0) {
      s.alpha(gA, () => {
        const S = tall ? Math.min(w - 14 * u, h * 0.6) : Math.min(h - 22 * u, w * 0.48);
        const gx = tall ? (w - S) / 2 : 7 * u, gy = 9 * u;
        const merged = s.ease('merge', 0.9);
        const shifted = s.since('shift') >= 0 && s.since('merge') < 0;
        const G = merged > 0.5 ? 7 : 14;
        const cs = S / G;
        const q = { r: 4, c: 8 };
        const reg = (v: number) => (v < 3 ? 0 : v < 10 ? 1 : 2);
        const can = (r: number, c: number) => (G === 7 ? true : shifted ? reg(r) === reg(q.r) && reg(c) === reg(q.c) : Math.floor(r / 7) === Math.floor(q.r / 7) && Math.floor(c / 7) === Math.floor(q.c / 7));
        for (let r = 0; r < G; r++)
          for (let c = 0; c < G; c++) {
            const self = G === 7 ? r === Math.floor(q.r / 2) && c === Math.floor(q.c / 2) : r === q.r && c === q.c;
            s.ctx.fillStyle = self ? s.c('orange') : can(r, c) ? s.tint('purple', 0.42) : s.tint('--ink-3', 0.12);
            s.ctx.fillRect(gx + c * cs + 0.12 * u, gy + r * cs + 0.12 * u, cs - 0.24 * u, cs - 0.24 * u);
          }
        const pyr = s.ease('pyramid', 0.7);
        if (pyr > 0) {
          s.ctx.fillStyle = s.c('--card');
          s.ctx.fillRect(gx - 2 * u, gy - 7 * u, S + 4 * u, S + 9 * u);
          s.alpha(pyr, () => {
            const stages: [number, string][] = [[56, '1/4'], [28, '1/8'], [14, '1/16'], [7, '1/32']];
            let y = gy + S;
            stages.forEach(([n, f], i) => {
              const side = (S * 0.48) / 2 ** i;
              y -= side + 1.5 * u;
              const x = gx + S * 0.3 - side / 2;
              s.rrect(x, y, side, side, 0.4, { fill: s.tint('orange', 0.15 + 0.12 * i), stroke: s.c('orange'), lw: 0.3 });
              grid(s, x, y, side, Math.min(n, 8), s.tint('orange', 0.5), 0.12);
              s.text(`${n} × ${n} tokens, ${f}`, gx + S * 0.6, y + side / 2, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
            });
          });
        }
        const bounds = G === 7 ? [0, 14] : shifted ? [0, 3, 10, 14] : [0, 7, 14];
        s.alpha(1 - pyr, () => {
          for (const b of bounds) {
            const v = (b / 14) * S;
            s.line(gx + v, gy, gx + v, gy + S, s.c('--ink'), 0.45);
            s.line(gx, gy + v, gx + S, gy + v, s.c('--ink'), 0.45);
          }
        });
        const lab = pyr > 0.5 ? 'Swin-T at 224 × 224: four stages' : G === 7 ? 'merged: 7 × 7 tokens, one window' : shifted ? 'next block: windows shifted by 3' : '14 × 14 patches, 7 × 7 windows';
        s.text(lab, gx + S / 2, gy - 3.5 * u, { size: 3.3, font: 'ui', weight: 600, color: s.c('--ink') });
        // side notes
        const nx = tall ? w / 2 : gx + S + 8 * u;
        const ny = tall ? gy + S + 7 * u : gy + 6 * u;
        const al = tall ? 'center' : 'left';
        const notes: [string, string, K][] = [];
        if (beat === 'windows') notes.push(['attend only inside', 'your own window', 'purple']);
        if (beat === 'cost') notes.push(['global: N² pairs', 'windows: N · M² pairs', 'teal']);
        if (beat === 'shift') notes.push(['tokens near a border', 'now share a window', 'purple']);
        if (beat === 'merge') notes.push(['2 × 2 tokens → 1', 'same windows, 4× the image', 'orange']);
        notes.forEach(([a, b, k]) => {
          s.text(a, nx, ny, { size: 3.6, font: 'ui', weight: 600, align: al, color: s.c(k) });
          s.text(b, nx, ny + 6.5 * u, { size: 3.6, font: 'ui', weight: 600, align: al, color: s.c(k) });
        });
        s.alpha(s.win('cost', 'shift'), () => {
          if (tall) return;
          const y = ny + 20 * u;
          const rows: [string, string, K][] = [['224 px, 4 px patches:', '', '--ink-2'], ['global', '9.8 million pairs', 'red'], ['windows', '154 thousand', 'teal']];
          rows.forEach(([a, b, k], i) => {
            s.text(a, nx, y + i * 6 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c(k) });
            if (b) s.text(b, nx + 18 * u, y + i * 6 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c(k) });
          });
        });
      });
    }
    s.alpha(s.ease('convnext', 0.6), () => {
      s.text('ConvNeXt (2022)', w / 2, h * 0.3, { size: 5.5, font: 'display', weight: 600, color: s.c('blue') });
      s.text('a ResNet with transformer-era choices: 4 × 4 patchify stem,', w / 2, h * 0.3 + 9 * u, { size: 3.3, font: 'ui', color: s.c('--ink-2') });
      s.text('7 × 7 depthwise filters, layer norm, GELU: matches Swin', w / 2, h * 0.3 + 15 * u, { size: 3.3, font: 'ui', color: s.c('--ink-2') });
      s.alpha(s.ease('lesson', 0.6), () => pill(s, 'much of the gap: recipes and details, not attention', w / 2, h * 0.68, 'purple', 3.4, 'center', 'ui'));
    });
  },
};

// ---------------------------------------------------------------- outro

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = data(s);
    const tall = s.tall;
    const items: [string, string, K][] = [
      ['recap', 'patches · E · cls · E_pos · encoder', 'orange'],
      ['set', 'no positions: a set', 'red'],
      ['bias', 'learns locality, at a cost in data', 'purple'],
      ['close', 'DeiT: recipe · Swin: windows', 'teal'],
      ['today', 'CLIP, MAE, diffusion: all ViTs', 'blue'],
    ];
    const S = tall ? 0 : Math.min(h * 0.5, w * 0.3);
    if (d && !tall) {
      s.alpha(s.ease('recap', 0.6), () => {
        const x = w - S - 7 * u, y = (h - S) / 2;
        veil(s, d.img(CLSI), d.cls(CLSI, d.a.vit.L - 1, 5), d.a.vit.G, x, y, S);
        grid(s, x, y, S, 8, 'rgba(255,255,255,0.4)', 0.12);
      });
    }
    items.forEach(([id, t, k], i) => {
      const y = h * 0.18 + i * (tall ? 14 : 12.5) * u;
      s.alpha(s.ease(id, 0.6), () => pill(s, t, tall ? w / 2 : 7 * u, y, k, tall ? 3.4 : 3.6, tall ? 'center' : 'left', 'ui'));
    });
    s.alpha(s.ease('end', 0.8), () => s.text('assume less, learn more', tall ? w / 2 : 7 * u, h * 0.18 + 5 * (tall ? 14 : 12.5) * u + 4 * u, { size: 5, font: 'display', weight: 600, align: tall ? 'center' : 'left', color: s.c('purple') }));
    void lerp;
    void clamp01;
  },
};

export const scenesC: Record<string, SceneDef> = { distance, data: dataScene, deit, swin, outro };
