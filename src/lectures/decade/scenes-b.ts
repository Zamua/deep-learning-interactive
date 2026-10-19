import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { MODELS } from '../../lib/decade-models';
import { type K, box, check, cross, logFrame, pill, tokens } from './kit';
import { flowPills } from './scenes-a';

// ---------------------------------------------------------------- model sizes, shared by two scenes

const SIZE_TICKS: [number, string][] = [
  [7, '10M'],
  [8, '100M'],
  [9, '1B'],
  [10, '10B'],
  [11, '100B'],
  [12, '1T'],
];

/** Published sizes on a log axis; `upTo` dots shown (fractional fades the last in), `hi` names to label. */
function sizeChart(s: Scene, x: number, y: number, w: number, h: number, show: (i: number) => number, labels: Set<string>, a = 1): void {
  const { u } = s;
  const { X, Y } = logFrame(s, x, y, w, h, 2011.6, 2025.4, 7, 12.5, SIZE_TICKS, [2012, 2016, 2020, 2024], a);
  s.alpha(a, () => {
    const pts = MODELS.map((m, i) => ({ m, i, v: show(i), x: X(m.t), y: Y(m.active ?? m.N) })).filter((d) => d.v > 0);
    const boxes: [number, number, number, number][] = [];
    for (const d of pts) {
      boxes.push([d.x - u * 1.6, d.y - u * 1.6, d.x + u * 1.6, d.y + u * 1.6]);
      if (d.m.active) boxes.push([d.x - u * 1.6, Y(d.m.N) - u * 1.6, d.x + u * 1.6, Y(d.m.N) + u * 1.6]);
    }
    for (const d of pts)
      s.alpha(d.v, () => {
        if (d.m.active) {
          s.line(d.x, d.y, d.x, Y(d.m.N), s.tint('teal', 0.6), 0.25, [0.8, 0.8]);
          s.circle(d.x, Y(d.m.N), u * 1.2, { stroke: s.c('teal'), lw: 0.35 });
        }
        s.circle(d.x, d.y, u * 1.25, { fill: s.c(d.m.conv ? 'slate' : 'teal') });
      });
    for (const d of pts) {
      if (!labels.has(d.m.name)) continue;
      const tw = s.measure(d.m.name, { size: 3, font: 'ui', weight: 600 });
      const th = u * 3.4;
      const cands: [number, number, 'left' | 'right' | 'center'][] = [
        [d.x + u * 2.4, d.y, 'left'],
        [d.x - u * 2.4, d.y, 'right'],
        [d.x, d.y - u * 4, 'center'],
        [d.x, d.y + u * 4, 'center'],
        [d.x - u * 1.5, d.y - u * 4, 'right'],
        [d.x + u * 1.5, d.y + u * 4, 'left'],
      ];
      for (const [cx, cy, al] of cands) {
        const x0 = al === 'left' ? cx : al === 'right' ? cx - tw : cx - tw / 2;
        const bx: [number, number, number, number] = [x0 - u * 0.4, cy - th / 2, x0 + tw + u * 0.4, cy + th / 2];
        if (bx[0] < x + u * 9 || bx[2] > x + w - u) continue;
        if (boxes.some((q) => q[0] < bx[2] && q[2] > bx[0] && q[1] < bx[3] && q[3] > bx[1])) continue;
        boxes.push(bx);
        s.alpha(d.v, () => s.text(d.m.name, cx, cy, { size: 3, font: 'ui', weight: 600, align: al, color: s.c('--ink-2'), halo: true }));
        break;
      }
    }
  });
}

// ---------------------------------------------------------------- text labels itself

const SENT = ['the', 'cat', 'sat', 'on', 'the', 'mat'];
const GUESS: [string, number][] = [
  ['on', 0.55],
  ['down', 0.2],
  ['by', 0.1],
  ['still', 0.1],
  ['the', 0.05],
];
const LABELED: [string, string][] = [
  ['#8fc3ea', 'ship'],
  ['#e0a96d', 'cat'],
  ['#6fb26a', 'frog'],
  ['#c9553d', 'car'],
  ['#b9a27a', 'dog'],
  ['#9db6d8', 'plane'],
];

export const pretrain: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    // Labels cost people's time.
    s.alpha(s.win('labels', 'free'), () => {
      const cols = 3;
      const ts = Math.min(u * 18, (w - u * 20) / 3.6);
      const gx = w / 2 - (cols * ts + (cols - 1) * u * 6) / 2;
      LABELED.forEach(([c, lab], i) => {
        const x = gx + (i % cols) * (ts + u * 6);
        const y = u * 10 + Math.floor(i / cols) * (ts + u * 12);
        s.rrect(x, y, ts, ts, 1, { fill: c, stroke: s.c('--rule'), lw: 0.25 });
        s.alpha(s.ease('labels', 0.4, 0.4 + i * 0.25), () => pill(s, lab, x + ts / 2, y + ts + u * 4.5, 'gold', { size: 3.1, on: 0.4 }));
      });
      s.text('a person labels every example', w / 2, u * 10 + 2 * (ts + u * 12) + u * 3, { size: 3.6, italic: true, color: s.c('--ink-2') });
    });

    // Every next token is a free label.
    const tokA = s.win('free', 'gpt2');
    s.alpha(tokA, () => {
      const cw = Math.min(u * 13, (w - u * 14) / 6.4);
      const ch = u * 7;
      const ty = u * 14;
      const every = s.ease('every', 0.8);
      const tk = tokens(s, SENT, w / 2, ty, cw, ch, 'orange', (i) => (i === 3 ? 1 - every : 0));
      const cx = (i: number) => tk.x0 + i * tk.cw + cw / 2;
      for (let i = 0; i < 5; i++) {
        const a = i === 2 ? 1 : every;
        s.alpha(a, () => {
          const x0 = cx(i);
          const x1 = cx(i + 1);
          s.ctx.beginPath();
          s.ctx.moveTo(x0, ty + ch + u * 0.8);
          s.ctx.quadraticCurveTo((x0 + x1) / 2, ty + ch + u * 7, x1, ty + ch + u * 1.2);
          s.ctx.strokeStyle = s.c('gold');
          s.ctx.lineWidth = u * 0.4;
          s.ctx.stroke();
          s.circle(x1, ty + ch + u * 1.2, u * 0.8, { fill: s.c('gold') });
        });
      }
      s.text(every > 0.5 ? 'every position predicts the next token' : 'the label is the next token', w / 2, ty - u * 5, { size: 3.6, italic: true, color: s.c('gold') });
      // One position's guesses and its loss.
      s.alpha(s.ease('loss', 0.6), () => {
        const bx = w / 2 - Math.min(w - u * 16, u * 80) / 2;
        const bw = Math.min(w - u * 16, u * 80);
        const y0 = ty + ch + u * 15;
        s.text('after “the cat sat”, a model guesses:', bx, y0, { size: 3.3, align: 'left', color: s.c('--ink-2') });
        GUESS.forEach(([wd, pv], j) => {
          const y = y0 + u * 6 + j * u * 6.4;
          const right = j === 0;
          s.text(wd, bx + u * 10, y, { font: 'mono', size: 3.3, weight: 600, align: 'right', color: s.c(right ? 'gold' : '--ink') });
          const barW = (bw - u * 24) * pv;
          s.rrect(bx + u * 12, y - u * 2, Math.max(u * 0.6, barW), u * 4, 1, { fill: s.tint('green', right ? 0.85 : 0.45) });
          s.text(pv.toFixed(2), bx + u * 13.5 + barW, y + u * 0.2, { font: 'mono', size: 3, align: 'left' });
        });
        s.text('loss = −log 0.55 ≈ 0.6', bx, y0 + u * 6 + 5 * u * 6.4 + u * 2, { font: 'mono', size: 3.4, weight: 650, align: 'left', color: s.c('red') });
      });
    });

    // Growth: published sizes, and in-context learning.
    s.alpha(s.ease('gpt2', 0.6), () => {
      const cw = tall ? w - u * 8 : w * 0.6;
      const chh = tall ? h * 0.5 : h - u * 16;
      const cx0 = u * 4;
      const cy0 = u * 8;
      s.text('parameters, published', cx0 + u * 9, cy0 - u * 3, { size: 3.1, font: 'ui', weight: 600, align: 'left', color: s.c('teal') });
      const order = ['AlexNet', 'ResNet-152', 'Transformer', 'BERT-large', 'GPT-2', 'T5', 'GPT-3'];
      sizeChart(
        s,
        cx0,
        cy0,
        cw,
        chh,
        (i) => {
          const nm = MODELS[i]!.name;
          const k = order.indexOf(nm);
          if (k < 0) return 0;
          if (k < 4) return s.ease('gpt2', 0.5, 0.2 + k * 0.2);
          if (k < 6) return s.ease('gpt2', 0.5, 1.4 + (k - 4) * 0.5);
          return s.ease('gpt3', 0.6, 0.3);
        },
        new Set(['AlexNet', 'GPT-2', 'GPT-3', 'BERT-large']),
      );
      // A few-shot prompt.
      s.alpha(s.ease('gpt3', 0.6, 2.2), () => {
        const px = tall ? u * 8 : w * 0.64;
        const py = tall ? cy0 + chh + u * 5 : h * 0.3;
        const pw = tall ? w - u * 16 : w * 0.32;
        const lines = ['cat → chat', 'dog → chien', 'house →'];
        s.rrect(px, py, pw, u * 25, 1.6, { fill: s.c('--paper'), stroke: s.c('--rule'), lw: 0.25 });
        s.text('the prompt', px + u * 2.5, py + u * 4, { size: 3, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-3') });
        lines.forEach((l, i) => s.text(l, px + u * 3, py + u * 10 + i * u * 5.5, { font: 'mono', size: 3.4, align: 'left' }));
        const ans = s.ease('icl', 0.5, 0.2);
        s.alpha(ans, () => {
          const lw = s.measure('house →', { font: 'mono', size: 3.4 });
          s.text('maison', px + u * 4.5 + lw, py + u * 21, { font: 'mono', size: 3.4, weight: 700, align: 'left', color: s.c('green') });
        });
        s.alpha(s.ease('icl', 0.6, 0.8), () => s.text('no gradient step', px + pw / 2, py + u * 30, { size: 3.4, italic: true, color: s.c('green') }));
      });
    });
  },
};

// ---------------------------------------------------------------- scaling laws and compute

export const laws: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    // A power law is a straight line on log axes (schematic).
    s.alpha(s.win('kaplan', 'six'), () => {
      const side = Math.min(w - u * 16, h - u * 20, u * 90);
      const x0 = w / 2 - side / 2 + u * 3;
      const y0 = u * 8;
      s.line(x0, y0, x0, y0 + side, s.c('--axis'), 0.3);
      s.line(x0, y0 + side, x0 + side, y0 + side, s.c('--axis'), 0.3);
      s.text('compute (log scale)', x0 + side / 2, y0 + side + u * 4, { size: 3.1, color: s.c('--ink-3') });
      s.ctx.save();
      s.ctx.translate(x0 - u * 3, y0 + side / 2);
      s.ctx.rotate(-Math.PI / 2);
      s.text('loss (log scale)', 0, 0, { size: 3.1, color: s.c('--ink-3') });
      s.ctx.restore();
      const P = (f: number) => [x0 + side * (0.08 + 0.84 * f), y0 + side * (0.12 + 0.72 * f)] as const;
      const fit = s.ease('law', 1.4);
      const [ax, ay] = P(0);
      const [bx, by] = P(0.55 * fit);
      s.line(ax, ay, bx, by, s.c('red'), 0.5);
      for (let i = 0; i < 6; i++) {
        const f = i * 0.1;
        const [px, py] = P(f);
        s.alpha(s.ease('law', 0.4, 0.2 + i * 0.25), () => s.circle(px, py, u * 1.1, { fill: s.c('slate') }));
      }
      s.alpha(s.ease('law', 0.6, 1.4), () => s.text('small runs', P(0.25)[0] + u * 4, P(0.25)[1] - u * 4, { size: 3.2, align: 'left', color: s.c('slate'), halo: true }));
      const ext = s.ease('plan', 1.4, 0.4);
      if (ext > 0) {
        const [cx, cy] = P(0.55 + 0.37 * ext);
        s.line(P(0.55)[0], P(0.55)[1], cx, cy, s.c('red'), 0.4, [1.2, 1]);
        s.alpha(s.ease('plan', 0.5, 1.6), () => {
          const [sx, sy] = P(0.92);
          s.circle(sx, sy, u * 1.8, { fill: s.c('--accent') });
          s.text('a big run, predicted', sx - u * 3, sy - u * 4, { size: 3.3, align: 'right', weight: 600, color: s.c('--accent'), halo: true });
        });
      }
      s.text('schematic', x0 + side - u, y0 + u * 2, { size: 2.9, italic: true, align: 'right', color: s.c('--ink-3') });
    });

    // The budget: 6ND.
    s.alpha(s.win('six', 'chin'), () => {
      const y = h * 0.34;
      const parts: [string, K][] = [
        ['C ≈ 6 ', '--ink'],
        ['N', 'teal'],
        [' ', '--ink'],
        ['D', 'gold'],
      ];
      const size = 9;
      const tw = parts.reduce((a, [t]) => a + s.measure(t, { font: 'serif', size, italic: true, weight: 600 }), 0);
      let x = w / 2 - tw / 2;
      for (const [t, k] of parts) {
        s.text(t, x, y, { font: 'serif', size, italic: true, weight: 600, align: 'left', color: s.c(k) });
        x += s.measure(t, { font: 'serif', size, italic: true, weight: 600 });
      }
      s.text('operations = 6 × parameters × training tokens', w / 2, y + u * 10, { size: 3.4, color: s.c('--ink-2') });
      s.text('about 2 forward and 4 backward, per parameter per token', w / 2, y + u * 16, { size: 3.1, italic: true, color: s.c('--ink-3') });
      s.alpha(s.ease('gpt3', 0.6), () => {
        s.text('GPT-3: 6 × 175e9 × 300e9', w / 2, y + u * 28, { font: 'mono', size: 3.8, weight: 600 });
        s.text('≈ 3.15 × 10²³', w / 2, y + u * 35, { font: 'mono', size: 4.6, weight: 700, color: s.c('--accent') });
      });
    });

    // Tokens per parameter.
    s.alpha(s.win('chin', 'sizes'), () => {
      const bw = Math.min(w - u * 20, u * 90);
      const bx = w / 2 - bw / 2;
      const y0 = h * 0.28;
      s.text('training tokens per parameter', w / 2, y0 - u * 8, { size: 4, font: 'display', weight: 600 });
      const max = 24;
      const rows: [string, number, K][] = [
        ['GPT-3 (2020)', 300 / 175, 'red'],
        ['Chinchilla (2022)', 1400 / 70, 'green'],
      ];
      rows.forEach(([nm, v, k], i) => {
        const y = y0 + u * 4 + i * u * 16;
        const grow = s.ease('chin', 1, 0.3 + i * 0.4);
        s.text(nm, bx, y - u * 4, { size: 3.4, font: 'ui', weight: 600, align: 'left' });
        s.rrect(bx, y - u * 1, bw, u * 5, 1, { fill: s.tint('slate', 0.08), stroke: s.tint('slate', 0.3), lw: 0.2 });
        s.rrect(bx, y - u * 1, Math.max(u * 0.6, (bw * v * grow) / max), u * 5, 1, { fill: s.tint(i === 0 ? 'orange' : k, 0.75) });
        s.text(v.toFixed(1), bx + (bw * v * grow) / max + u * 1.6, y + u * 1.6, { font: 'mono', size: 3.3, weight: 600, align: 'left' });
      });
      s.alpha(s.ease('under', 0.6), () => {
        s.text('under-trained', bx + (bw * 1.7) / max + u * 12, y0 + u * 5.6, { size: 3.4, italic: true, weight: 600, align: 'left', color: s.c('red') });
      });
      s.text('Chinchilla: about 20 is compute-optimal', w / 2, y0 + u * 36, { size: 3.3, italic: true, color: s.c('--ink-2') });
    });

    // All the published sizes.
    s.alpha(s.ease('sizes', 0.7), () => {
      const cw = Math.min(w - u * 8, u * 150);
      const ch = tall ? h * 0.62 : h - u * 18;
      const x = w / 2 - cw / 2;
      s.text('parameters of landmark models, as published', x + u * 9, u * 6, { size: 3.1, font: 'ui', weight: 600, align: 'left', color: s.c('teal') });
      sizeChart(s, x, u * 10, cw, ch, (i) => s.ease('sizes', 0.4, 0.2 + i * 0.12), new Set(['AlexNet', 'Transformer', 'GPT-2', 'GPT-3', 'Chinchilla', 'Llama 3.1', 'DeepSeek-V3']));
    });
  },
};

// ---------------------------------------------------------------- learning from people

export const rlhf: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // A predictor, not an assistant.
    s.alpha(s.win('predictor', 'sft'), () => {
      const bw = Math.min(w - u * 14, u * 100);
      const bx = w / 2 - bw / 2;
      const y = h * 0.3;
      s.rrect(bx, y - u * 6, bw, u * 34, 1.8, { fill: s.c('--paper'), stroke: s.c('--rule'), lw: 0.25 });
      s.text('Q: What is the capital of France?', bx + u * 3, y, { font: 'mono', size: 3.3, weight: 600, align: 'left' });
      const more = ['Q: What is the capital of Spain?', 'Q: What is the capital of Italy?', 'Q: What is the capital of'];
      more.forEach((l, i) => s.alpha(s.ease('predictor', 0.4, 1.2 + i * 0.7), () => s.text(l, bx + u * 3, y + u * 7 + i * u * 6.5, { font: 'mono', size: 3.3, align: 'left', color: s.c('--ink-3') })));
      s.text('a pretrained model continues the text', w / 2, y + u * 36, { size: 3.4, italic: true, color: s.c('--ink-2') });
    });

    // The three steps.
    const stepsA = s.ease('sft', 0.6);
    s.alpha(stepsA, () => {
      const bw = Math.min(w - u * 12, u * 110);
      const bx = w / 2 - bw / 2;
      const bh = Math.min(u * 17, (h - u * 40) / 3);
      const gap = u * 4;
      const y0 = u * 6;
      const dpo = s.ease('dpo', 0.8);
      const step = (i: number, beat: string, title: string, k: K) => {
        const y = y0 + i * (bh + gap);
        const live = s.since(beat) >= 0 ? 1 : 0;
        const dim = i > 0 ? 1 - 0.65 * dpo : 1;
        s.alpha(s.ease(beat, 0.5) * dim, () => {
          s.rrect(bx, y, bw, bh, 1.8, { fill: s.tint(k, 0.08 + 0.1 * live), stroke: s.tint(k, 0.7), lw: 0.3 });
          s.text(`${i + 1}. ${title}`, bx + u * 3, y + u * 4.4, { size: 3.4, font: 'ui', weight: 650, align: 'left', color: s.c(k) });
          if (i > 0) s.arrow(w / 2, y - gap + u * 0.6, w / 2, y - u * 0.6, s.c('--ink-3'), 0.3, 1.6);
        });
        return y;
      };
      // 1. Demonstrations.
      const y1 = step(0, 'sft', 'fine-tune on written answers', 'blue');
      s.alpha(s.ease('sft', 0.5, 0.4), () => s.text('Q: capital of France?   A: Paris.', bx + u * 3, y1 + bh * 0.68, { font: 'mono', size: 3.1, align: 'left' }));
      // 2. Comparisons and a reward model.
      const y2 = step(1, 'judge', 'learn what people prefer', 'gold');
      s.alpha(s.ease('judge', 0.5, 0.3) * (1 - 0.65 * dpo), () => {
        const cw = Math.min(u * 26, bw * 0.3);
        const cy = y2 + bh * 0.66;
        ['answer A', 'answer B'].forEach((t, j) => {
          const cx = bx + u * 3 + j * (cw + u * 4);
          s.rrect(cx, cy - u * 3, cw, u * 6, 1, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.2 });
          s.text(t, cx + cw / 2, cy + u * 0.2, { size: 3, font: 'ui' });
          if (j === 1) s.alpha(s.ease('judge', 0.4, 1.6), () => check(s, cx + cw + u * 1.8, cy, u * 1.7));
          s.alpha(s.ease('rm', 0.5, 0.3), () => s.text(j === 0 ? 'r = 0.2' : 'r = 0.9', bx + bw - u * 3, cy + (j - 0.5) * u * 5, { font: 'mono', size: 3.1, weight: 600, align: 'right', color: s.c('gold') }));
        });
        s.alpha(s.ease('rm', 0.5), () => s.text('reward model', bx + bw - u * 3, y2 + u * 4.4, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2') }));
      });
      // 3. RL with PPO, on a leash.
      const y3 = step(2, 'ppo', 'RL with PPO', 'green');
      s.alpha(s.ease('ppo', 0.5, 0.3) * (1 - 0.65 * dpo), () => {
        const cy = y3 + bh * 0.66;
        const labs = ['sample', 'score', 'update'];
        const cw = Math.min(u * 20, (bw - u * 18) / 3);
        labs.forEach((t, j) => {
          const cx = bx + u * 3 + j * (cw + u * 5);
          const on = Math.floor(s.since('ppo') * 1.2) % 3 === j ? 1 : 0;
          box(s, cx, cy - u * 3, cw, u * 6, t, 'green', { on: on * 0.8, size: 3 });
          if (j < 2) s.arrow(cx + cw + u * 0.6, cy, cx + cw + u * 4.4, cy, s.c('--ink-3'), 0.3, 1.4);
        });
        s.alpha(s.ease('kl', 0.5), () => s.text('+ a KL leash to the start', bx + bw - u * 3, y3 + u * 4.4, { size: 3.1, italic: true, align: 'right', color: s.c('red') }));
      });
      // DPO skips steps 2 and 3.
      s.alpha(dpo, () => {
        const xr = bx + bw + u * 2.5;
        const ya = y2 + bh * 0.3;
        const yb = y3 + bh;
        if (xr < w - u * 2) {
          s.line(xr - u * 2, ya, xr, ya, s.c('purple'), 0.5);
          s.line(xr, ya, xr, yb, s.c('purple'), 0.5);
        }
        const y = y3 + bh + u * 6;
        pill(s, 'DPO (2023): one loss on the pairs', w / 2, y, 'purple', { size: 3.4, on: 0.5 });
      });
      const py = y0 + 3 * (bh + gap) + u * 3;
      s.alpha(s.win('instruct', 'dpo'), () => {
        const hgt = flowPills(s, [{ text: 'InstructGPT, 2022: 1.3B preferred to 175B', k: 'gold', on: 0.4 }], w / 2, py, w - u * 8, 3.2);
        s.alpha(s.ease('chatgpt', 0.5), () => flowPills(s, [{ text: 'ChatGPT, November 2022', k: 'green', on: 0.5 }], w / 2, py + hgt + u * 1, w - u * 8, 3.2));
      });
    });
  },
};

// ---------------------------------------------------------------- rewards a program can check

const GROUP = ['722', '712', '722', '622', '722', '732'];
const THINK = ['437 + 285: hundreds first', '400 + 200 = 600', '37 + 85 = 122', '600 + 122 = 722', 'check: 722 − 285 = 437', 'answer: 722'];

export const rlvr: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    // Over-optimizing a learned reward (schematic).
    s.alpha(s.win('hack', 'check'), () => {
      const cw = Math.min(w - u * 16, u * 110);
      const chh = Math.min(h * 0.55, u * 60);
      const x0 = w / 2 - cw / 2;
      const y0 = h * 0.18;
      s.line(x0, y0 + chh, x0 + cw, y0 + chh, s.c('--axis'), 0.3);
      s.line(x0, y0, x0, y0 + chh, s.c('--axis'), 0.3);
      s.text('optimization against the reward model', x0 + cw / 2, y0 + chh + u * 4.5, { size: 3.1, color: s.c('--ink-3') });
      const pr = s.prog('hack');
      const n = 60;
      const curve = (f: (x: number) => number, col: string, dash?: number[]) => {
        s.ctx.beginPath();
        for (let i = 0; i <= n * pr; i++) {
          const xx = i / n;
          const X = x0 + xx * cw;
          const Y = y0 + chh * (1 - f(xx));
          if (i) s.ctx.lineTo(X, Y);
          else s.ctx.moveTo(X, Y);
        }
        s.ctx.strokeStyle = col;
        s.ctx.lineWidth = u * 0.5;
        s.ctx.setLineDash(dash ? dash.map((d) => d * u) : []);
        s.ctx.stroke();
        s.ctx.setLineDash([]);
      };
      curve((x) => 0.1 + 0.8 * (1 - Math.exp(-2.6 * x)), s.c('gold'), [1.4, 1]);
      curve((x) => 0.1 + 0.95 * x * Math.exp(-2.2 * x) * 2.2, s.c('green'));
      s.alpha(clamp01(pr * 3), () => {
        s.text('reward model’s score', x0 + cw - u, y0 + chh * 0.12, { size: 3.2, weight: 600, align: 'right', color: s.c('gold'), halo: true });
        s.text('real quality', x0 + cw - u, y0 + chh * 0.78, { size: 3.2, weight: 600, align: 'right', color: s.c('green'), halo: true });
      });
      s.text('schematic', x0 + u * 2, y0 + u * 2, { size: 2.9, italic: true, align: 'left', color: s.c('--ink-3') });
    });

    // A checker, a group, and group-relative advantages.
    s.alpha(s.win('check', 'o1'), () => {
      s.text('437 + 285 = ?', w / 2, u * 8, { size: 5.4, font: 'mono', weight: 650 });
      s.alpha(s.ease('check', 0.6), () => {
        const t = 'reward = 1 if answer == 722 else 0';
        const tw = s.measure(t, { font: 'mono', size: 3.2 }) + u * 5;
        s.rrect(w / 2 - tw / 2, u * 13, tw, u * 7, 1.2, { fill: s.tint('teal', 0.1), stroke: s.tint('teal', 0.7), lw: 0.3 });
        s.text(t, w / 2, u * 16.7, { font: 'mono', size: 3.2, weight: 600, color: s.c('teal') });
      });
      const ga = s.ease('grpo', 0.6);
      const adv = s.ease('adv', 0.8);
      const cols = tall ? 3 : 6;
      const cw = Math.min(u * 20, (w - u * 10 - (cols - 1) * u * 2.5) / cols);
      const gx = w / 2 - (cols * cw + (cols - 1) * u * 2.5) / 2;
      const rowH = u * 30;
      GROUP.forEach((g, i) => {
        const r = g === '722' ? 1 : 0;
        const x = gx + (i % cols) * (cw + u * 2.5);
        const y = u * 27 + Math.floor(i / cols) * rowH;
        s.alpha(s.ease('grpo', 0.4, 0.4 + i * 0.2), () => {
          s.rrect(x, y, cw, u * 9, 1.2, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.25 });
          s.text(g, x + cw / 2, y + u * 4.7, { font: 'mono', size: 3.8, weight: 650 });
          if (r) check(s, x + cw - u * 1.2, y + u * 1.2, u * 1.6);
          else cross(s, x + cw - u * 1.2, y + u * 1.2, u * 1.6);
          s.text(`r = ${r}`, x + cw / 2, y + u * 12.5, { font: 'mono', size: 3, color: s.c('--ink-2') });
          s.alpha(adv, () => {
            const A = r ? 1 : -1;
            const mid = y + u * 20;
            const bh = u * 5 * A;
            s.line(x + u, mid, x + cw - u, mid, s.c('--axis'), 0.2);
            s.rrect(x + cw * 0.3, Math.min(mid, mid - bh), cw * 0.4, Math.abs(bh), 0.6, { fill: s.tint(A > 0 ? 'green' : 'red', 0.75) });
            s.text(A > 0 ? 'A = +1' : 'A = −1', x + cw / 2, A > 0 ? mid + u * 2.8 : mid - u * 2.8, { font: 'mono', size: 2.9, weight: 600 });
          });
        });
      });
      s.alpha(adv, () => s.text('group mean 0.5: A = (r − mean) / std', w / 2, u * 27 + (6 / cols) * rowH + u * 2, { size: 3.2, italic: true, color: s.c('--ink-2') }));
      void ga;
    });

    // Reasoning grows.
    s.alpha(s.win('o1', 'grad'), () => {
      const bw = Math.min(w - u * 14, u * 90);
      const bx = w / 2 - bw / 2;
      const y0 = u * 10;
      const prog = clamp01((s.t - s.at('o1')) / Math.max(0.01, s.end('r1') - s.at('o1')));
      const n = Math.min(THINK.length, Math.floor(prog * (THINK.length + 0.5)) + 1);
      s.text('thinking before answering', bx, y0, { size: 3.4, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
      s.rrect(bx, y0 + u * 4, bw, u * 8 + THINK.length * u * 6, 1.6, { fill: s.c('--paper'), stroke: s.c('--rule'), lw: 0.25 });
      THINK.slice(0, n).forEach((l, i) => {
        const last = i === THINK.length - 1;
        s.text(l, bx + u * 4, y0 + u * 10 + i * u * 6, { font: 'mono', size: 3.3, weight: last ? 700 : 500, align: 'left', color: s.c(last ? 'green' : '--ink-2') });
      });
      const py = y0 + u * 16 + THINK.length * u * 6;
      s.alpha(s.ease('o1', 0.5, 1), () => pill(s, 'o1, September 2024', w / 2 - u * 2, py, 'green', { size: 3.3, align: 'right', on: 0.4 }));
      s.alpha(s.ease('r1', 0.5, 0.6), () => pill(s, 'DeepSeek-R1, January 2025', w / 2 + u * 2, py, 'green', { size: 3.3, align: 'left', on: 0.4 }));
    });

    // The update under it all.
    s.alpha(s.ease('grad', 0.7), () => {
      const y = h * 0.42;
      const parts: [string, K][] = [
        ['s', 'purple'],
        [' ← ', '--ink'],
        ['s', 'purple'],
        [' + η (r − b)(eᵢ − ', '--ink'],
        ['p', 'green'],
        [')', '--ink'],
      ];
      const size = 6.4;
      const tw = parts.reduce((a, [t]) => a + s.measure(t, { font: 'serif', size, italic: true }), 0);
      let x = w / 2 - tw / 2;
      for (const [t, k] of parts) {
        s.text(t, x, y, { font: 'serif', size, italic: true, align: 'left', color: s.c(k) });
        x += s.measure(t, { font: 'serif', size, italic: true });
      }
      s.text('the softmax gradient, weighted by the reward', w / 2, y + u * 10, { size: 3.5, italic: true, color: s.c('--ink-2') });
    });
  },
};

// ---------------------------------------------------------------- what carried over

interface Part {
  label: string;
  old: boolean;
  beat?: string;
}
const PARTS: Record<string, Part> = {
  init: { label: 'init: small random weights', old: true, beat: 'norm' },
  tok: { label: 'text → token ids', old: false, beat: 'new' },
  embed: { label: 'embedding', old: true },
  pos: { label: 'positions', old: false, beat: 'new' },
  norm1: { label: 'norm', old: true, beat: 'norm' },
  attn: { label: 'attention', old: false, beat: 'new' },
  res1: { label: '+ residual', old: true, beat: 'res' },
  norm2: { label: 'norm', old: true, beat: 'norm' },
  mlp: { label: 'MLP', old: true },
  res2: { label: '+ residual', old: true, beat: 'res' },
  unembed: { label: 'unembedding: scores', old: true, beat: 'loss' },
  loss: { label: 'softmax + cross-entropy', old: true, beat: 'loss' },
  back: { label: 'backprop', old: true, beat: 'back' },
  opt: { label: 'AdamW step', old: true, beat: 'adam' },
};
const ROWS: string[][] = [['init'], ['tok'], ['embed', 'pos'], ['norm1', 'attn', 'res1'], ['norm2', 'mlp', 'res2'], ['unembed'], ['loss'], ['back'], ['opt']];
const BEATS = ['back', 'adam', 'loss', 'res', 'norm', 'new'];

export const carried: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const shown = s.ease('step', 0.8);
    const legend = s.ease('step', 0.6, 0.8);
    s.alpha(1 - shown, () => {
      s.text('2016 → 2026', w / 2, h * 0.4, { size: 8, font: 'display', weight: 600 });
      s.text('what is left of CS231n?', w / 2, h * 0.4 + u * 10, { size: 4, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(legend, () => {
      pill(s, 'from CS231n', w / 2 - u * 1.5, u * 5, 'blue', { size: 3, align: 'right', on: 0.3 });
      pill(s, 'new since 2016', w / 2 + u * 1.5, u * 5, 'orange', { size: 3, align: 'left', on: 0.3 });
    });
    const top = u * 11;
    const bh = Math.min(u * 7.5, (h - top - u * 6) / 12.3);
    const gap = bh * 0.36;
    const colW = Math.min(w - u * 22, u * 100);
    const x0 = w / 2 - colW / 2;
    const cur = (() => {
      let c: string | null = null;
      for (const b of BEATS) if (s.since(b) >= 0) c = b;
      return c;
    })();
    s.alpha(shown, () => {
      let y = top;
      const ys: number[] = [];
      ROWS.forEach((_, ri) => {
        if (ri === 3) y += u * 2;
        ys.push(y);
        y += bh + gap + (ri === 4 ? u * 2 : 0);
      });
      s.ctx.save();
      s.ctx.setLineDash([u * 0.8, u * 0.6]);
      s.rrect(x0 - u * 2, ys[3]! - u * 1.6, colW + u * 4, ys[4]! + bh - ys[3]! + u * 3.2, 1.6, { stroke: s.tint('--ink-3', 0.8), lw: 0.25 });
      s.ctx.restore();
      s.text('× N', x0 + colW + u * 3, (ys[3]! + ys[4]! + bh) / 2, { font: 'mono', size: 3, weight: 600, align: 'left', color: s.c('--ink-2') });
      ROWS.forEach((row, ri) => {
        const wts = row.map((id) => (id.startsWith('res') ? 1.2 : id.startsWith('norm') ? 0.8 : id === 'pos' ? 1 : 1.6));
        const tot = wts.reduce((a, b) => a + b, 0);
        const g = u * 1.4;
        let bx = x0;
        row.forEach((id, k) => {
          const bw = ((colW - g * (row.length - 1)) * wts[k]!) / tot;
          const P = PARTS[id]!;
          const on = cur !== null && P.beat === cur ? 1 : 0;
          const dim = cur !== null && !on ? 0.55 : 1;
          s.alpha(dim, () => box(s, bx, ys[ri]!, bw, bh, P.label, P.old ? 'blue' : 'orange', { on, size: Math.min(3.2, (bh / u) * 0.42) }));
          bx += bw + g;
        });
      });
    });
  },
};

// ---------------------------------------------------------------- the map

const MAP: { beat: string; name: string; k: K; ch: number[] }[] = [
  { beat: 'p1', name: 'Attention and transformers', k: 'blue', ch: [1, 2, 3, 4] },
  { beat: 'p2', name: 'Scale', k: 'orange', ch: [5, 6, 7, 8, 9] },
  { beat: 'p3', name: 'Seeing and generating', k: 'teal', ch: [10, 11, 12] },
  { beat: 'p4', name: 'Post-training', k: 'green', ch: [13, 14, 15, 16, 17, 18] },
  { beat: 'p5', name: 'Serving and understanding', k: 'purple', ch: [19, 20] },
];
const ALONE = new Set([3, 7, 8, 12]);

export const map: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = s.tall;
    const end = s.ease('recap', 0.8);
    s.alpha(1 - end, () => {
      s.text('twenty chapters, five parts', w / 2, u * 6, { size: 4.6, font: 'display', weight: 600 });
      const rh = Math.min(u * 15, (h - u * 16) / 5);
      const y0 = u * 13;
      const bw = Math.min(w - u * 10, u * 130);
      const bx = w / 2 - bw / 2;
      const r = Math.min(u * 3, rh * 0.22);
      const sp = r * 2.6;
      const alone = s.ease('alone', 0.6);
      MAP.forEach((P, i) => {
        const a = s.ease('twenty', 0.5, 0.3 + 0.3 * i);
        const lit = s.since(P.beat) >= 0;
        const y = y0 + i * rh;
        s.alpha(a, () => {
          const nameY = tall ? y + rh * 0.25 : y + rh * 0.45;
          s.text(P.name, bx, nameY, { size: 3.6, font: 'display', weight: 600, align: 'left', color: s.c(lit ? P.k : '--ink-2') });
          const cx0 = tall ? bx + r : bx + bw * 0.52;
          const cy = tall ? y + rh * 0.66 : nameY;
          P.ch.forEach((n, j) => {
            const on = lit ? s.ease(P.beat, 0.3, 0.2 + j * 0.15) : 0;
            const cx = cx0 + j * sp;
            s.circle(cx, cy, r, { fill: on > 0.5 ? s.tint(P.k, 0.85) : s.c('--card'), stroke: s.tint(P.k, 0.4 + 0.6 * on), lw: 0.3 });
            s.text(String(n), cx, cy + u * 0.2, { font: 'mono', size: n > 9 ? 2.6 : 2.9, weight: 650, color: on > 0.5 ? '#fff' : s.c(P.k) });
            if (ALONE.has(n) && alone > 0) s.circle(cx, cy, r + u * 1.1, { stroke: s.tint('--accent', alone), lw: 0.45 });
          });
        });
      });
      s.alpha(alone, () => s.text('ringed: needs only CS231n', w / 2, y0 + 5 * rh + u * 1, { size: 3.2, italic: true, color: s.c('--accent') }));
    });
    s.alpha(end, () => {
      const y = h * 0.36;
      flowPills(
        s,
        [
          { text: 'one architecture', k: 'blue', on: 1 },
          { text: 'scale', k: 'orange', on: 1 },
          { text: 'feedback', k: 'green', on: 1 },
        ],
        w / 2,
        y,
        w - u * 10,
        4.2,
      );
      s.text('built on backprop, softmax and gradient descent', w / 2, y + u * 11, { size: 3.6, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('bet', 0.8, 0.3), () => {
        s.text('Attention Is All You Need', w / 2, y + u * 26, { size: 5.6, font: 'display', italic: true, weight: 600 });
        s.text('2017 → 2026', w / 2, y + u * 34, { size: 4, font: 'mono', weight: 600, color: s.c('--accent') });
      });
    });
    void lerp;
  },
};
