import { fmt } from '../../core/code';
import { rgbOf } from '../../core/plot';
import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { ALIGN_DOT, ALIGN_EX, CURVES, ENC_EX, FAIL_EX } from '../../lib/seq2seq-data';
import { field } from '../../lib/seq2seq-draw';

type K = Color | `--${string}`;

/* ------------------------------------------------------------------ kit */

/** Largest text size (in u, at most `max`) at which `str` fits in `maxW` px. */
function fit(s: Scene, str: string, maxW: number, max: number, font: 'mono' | 'ui' | 'serif' | 'display' = 'ui', weight?: number): number {
  const w1 = s.measure(str, { size: 1, font, weight });
  return Math.min(max, maxW / Math.max(1e-6, w1));
}

function chipW(s: Scene, label: string, size: number): number {
  return s.measure(label, { font: 'mono', size, weight: 600 }) + s.u * size * 1.0;
}

/** A word in a rounded, tinted box centered at (cx, cy). */
function chip(s: Scene, label: string, cx: number, cy: number, k: K, o: { size?: number; on?: number; maxW?: number; ink?: K } = {}): void {
  let size = o.size ?? 3.6;
  if (o.maxW) size = Math.min(size, fit(s, label, o.maxW - s.u * size, size, 'mono', 600));
  const w = chipW(s, label, size);
  const hh = s.u * size * 1.75;
  const on = o.on ?? 0;
  s.rrect(cx - w / 2, cy - hh / 2, w, hh, size * 0.45, { fill: s.tint(k, 0.12 + 0.22 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.25 + 0.3 * on });
  s.text(label, cx, cy + s.u * 0.15, { font: 'mono', size, weight: 600, color: s.c(o.ink ?? '--ink') });
}

/** A vector as a grid of cells: tinted `k` for positive values, slate for negative. */
function heat(s: Scene, vals: number[], x: number, y: number, cols: number, cs: number, k: K, scale = 0.7): void {
  const rows = Math.ceil(vals.length / cols);
  vals.forEach((v0, i) => {
    const v = Math.max(-1, Math.min(1, v0 / scale));
    s.ctx.fillStyle = s.tint(v >= 0 ? k : 'slate', 0.06 + 0.84 * Math.abs(v));
    s.ctx.fillRect(x + (i % cols) * cs, y + Math.floor(i / cols) * cs, cs - 0.6, cs - 0.6);
  });
  s.rrect(x - s.u * 0.3, y - s.u * 0.3, cols * cs + s.u * 0.6, rows * cs + s.u * 0.6, 0.6, { stroke: s.tint(k, 0.6), lw: 0.22 });
}

/** A dashed empty box: a state not computed yet. */
function ghost(s: Scene, x: number, y: number, w: number, h: number, k: K = '--ink-3'): void {
  s.ctx.save();
  s.ctx.setLineDash([s.u * 0.8, s.u * 0.7]);
  s.rrect(x, y, w, h, 0.8, { stroke: s.tint(k, 0.5), lw: 0.2 });
  s.ctx.restore();
}

/** A quadratic curve from (x0, y0) to (x1, y1), bowed by `bend` px, drawn up to fraction `p`. */
function curve(s: Scene, x0: number, y0: number, x1: number, y1: number, bend: number, col: string, width = 0.5, p = 1, dash?: number[]): void {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const L = Math.hypot(x1 - x0, y1 - y0) || 1;
  const cx = mx - ((y1 - y0) / L) * bend, cy = my + ((x1 - x0) / L) * bend;
  const c = s.ctx;
  c.beginPath();
  const n = 30;
  for (let i = 0; i <= n * p; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    if (i) c.lineTo(x, y);
    else c.moveTo(x, y);
  }
  c.strokeStyle = col;
  c.lineWidth = width * s.u;
  c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
  c.stroke();
  c.setLineDash([]);
}

/** Words laid out left to right, wrapping at `maxW`; `style(i)` picks each word's color. Returns the height used. */
function words(s: Scene, ws: string[], x: number, y: number, maxW: number, size: number, style: (i: number) => K, lineH = 1.5): number {
  const sp = s.measure(' ', { font: 'mono', size });
  let cx = x, cy = y;
  ws.forEach((wd, i) => {
    const ww = s.measure(wd, { font: 'mono', size, weight: 500 });
    if (cx > x && cx + ww > x + maxW) {
      cx = x;
      cy += s.u * size * lineH;
    }
    const k = style(i);
    s.text(wd, cx, cy, { font: 'mono', size, weight: k === 'red' ? 700 : 500, align: 'left', color: s.c(k) });
    if (k === 'red') s.line(cx, cy + s.u * size * 0.62, cx + ww, cy + s.u * size * 0.62, s.c('red'), 0.25);
    cx += ww + sp;
  });
  return cy - y + s.u * size * lineH;
}

/** A probability as a percent, never rounded up to 100. */
const pctS = (p: number): string => (p >= 0.9995 ? '>99.9%' : `${(Math.floor(p * 1000) / 10).toFixed(1)}%`);

const softmax = (v: number[]): number[] => {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / t);
};

const EN = ['the', 'black', 'cat', 'sees', 'a', 'dog'];
const FR = ['le', 'chat', 'noir', 'voit', 'un', 'chien'];
/** Source index of each French word above. */
const ALIGN = [0, 2, 1, 3, 4, 5];

/* ------------------------------------------------------------------ 1. intro */

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'y2014'), () => {
      s.text('DL26 · CHAPTER 1', w / 2, h * 0.33, { size: 3.2, font: 'ui', weight: 650, color: s.c('--accent') });
      const t = 'From recurrence to attention';
      s.text(t, w / 2, h * 0.46, { size: fit(s, t, w * 0.88, 9, 'display', 600), font: 'display', weight: 600 });
      s.text('the idea every later chapter is built on', w / 2, h * 0.58, { size: fit(s, 'the idea every later chapter is built on', w * 0.85, 4.2, 'serif'), italic: true, color: s.c('--ink-2') });
    });

    // The 2014 picture: read, squeeze, write; then attention's shortcut.
    const dA = s.win('y2014', 'big');
    if (dA > 0)
      s.alpha(dA, () => {
        const size = Math.min(3.8, fit(s, 'black', (w * 0.86) / 6 - u * 4, 3.8, 'mono', 600));
        const cx = (i: number) => w * 0.1 + ((w * 0.8) / 5) * i;
        const yEn = h * 0.24, yEnc = h * 0.39, yC = h * 0.52, yDec = h * 0.65, yFr = h * 0.8;
        const pipe = s.ease('two', 0.6) * (1 - 0.7 * s.ease('patch', 0.6));
        s.alpha(pipe, () => {
          EN.forEach((_, i) => s.line(cx(i), yEn + u * 3.4, w / 2, yEnc - u * 3, s.tint('--ink-3', 0.6), 0.25));
          FR.forEach((_, i) => s.line(w / 2, yDec + u * 3, cx(i), yFr - u * 3.4, s.tint('--ink-3', 0.6), 0.25));
          s.rrect(w / 2 - u * 16, yEnc - u * 3, u * 32, u * 6, 3, { fill: s.tint('green', 0.14), stroke: s.c('green'), lw: 0.35 });
          s.text('encoder RNN', w / 2, yEnc + u * 0.2, { size: 3.4, font: 'ui', weight: 600, color: s.c('green') });
          s.rrect(w / 2 - u * 16, yDec - u * 3, u * 32, u * 6, 3, { fill: s.tint('blue', 0.14), stroke: s.c('blue'), lw: 0.35 });
          s.text('decoder RNN', w / 2, yDec + u * 0.2, { size: 3.4, font: 'ui', weight: 600, color: s.c('blue') });
          s.arrow(w / 2, yEnc + u * 3, w / 2, yC - u * 2.6, s.c('gold'), 0.45);
          s.arrow(w / 2, yC + u * 2.6, w / 2, yDec - u * 3, s.c('gold'), 0.45);
          s.rrect(w / 2 - u * 2.2, yC - u * 2.2, u * 4.4, u * 4.4, 0.8, { fill: s.tint('gold', 0.55), stroke: s.c('gold'), lw: 0.35 });
          s.text('c', w / 2 + u * 4.2, yC, { size: 4.2, italic: true, weight: 700, color: s.c('gold'), align: 'left' });
          const cr = s.ease('crack', 0.6) * (1 - s.ease('patch', 0.5));
          if (cr > 0)
            s.alpha(cr, () => {
              const pulse = 1 + 0.15 * Math.sin(s.since('crack') * 5);
              s.circle(w / 2, yC, u * 4.6 * pulse, { stroke: s.c('red'), lw: 0.5 });
              s.text('one vector', w / 2 - u * 7, yC, { size: 3.4, font: 'ui', weight: 600, color: s.c('red'), align: 'right' });
            });
        });
        EN.forEach((wd, i) => s.alpha(s.ease('y2014', 0.5, 0.1 * i), () => chip(s, wd, cx(i), yEn, 'orange', { size })));
        FR.forEach((wd, i) => s.alpha(s.ease('y2014', 0.5, 2 + 0.12 * i), () => chip(s, wd, cx(i), yFr, 'slate', { size })));
        const pa = s.ease('patch', 0.5);
        if (pa > 0)
          FR.forEach((_, t) => {
            const j = ALIGN[t]!;
            curve(s, cx(t), yFr - u * 3.4, cx(j), yEn + u * 3.4, (j - t) * u * 3, s.tint('teal', 0.85), 0.55, clamp01(s.prog('patch') * 1.6 - t * 0.1));
          });
      });

    // What came of it.
    const bA = s.win('big', 'toy');
    if (bA > 0)
      s.alpha(bA, () => {
        const items: [string, string, K][] = [['attention', '2014', 'teal'], ['the Transformer', '2017', 'blue'], ['large language models', 'since', 'purple']];
        items.forEach(([a, b, k], i) => {
          const ap = s.ease('big', 0.5, 0.5 + i * 0.7);
          const bw = s.tall ? w * 0.7 : w * 0.27;
          const bh = u * 12;
          const x = s.tall ? w / 2 - bw / 2 : w * 0.06 + i * (w * 0.32);
          const y = s.tall ? h * 0.2 + i * (bh + u * 6) : h * 0.45 - bh / 2;
          s.alpha(ap, () => {
            s.rrect(x, y, bw, bh, 2, { fill: s.tint(k, 0.12), stroke: s.c(k), lw: 0.4 });
            s.text(a, x + bw / 2, y + bh * 0.4, { size: fit(s, a, bw * 0.9, 4.2, 'ui', 650), font: 'ui', weight: 650, color: s.c(k) });
            s.text(b, x + bw / 2, y + bh * 0.72, { size: 3, font: 'mono', color: s.c('--ink-2') });
            if (i < 2) {
              if (s.tall) s.arrow(w / 2, y + bh + u, w / 2, y + bh + u * 5, s.c('--ink-3'), 0.4);
              else s.arrow(x + bw + u, y + bh / 2, x + w * 0.32 - u, y + bh / 2, s.c('--ink-3'), 0.4);
            }
          });
        });
      });

    // The four translators trained for the chapter.
    const tA = s.win('toy', 'french');
    if (tA > 0)
      s.alpha(tA, () => {
        const cards: [string, string, K][] = [
          ['fixed vector, 32', '15k parameters', 'orange'],
          ['fixed vector, 64', '48k parameters', 'purple'],
          ['attention, additive', '15k parameters', 'teal'],
          ['attention, dot product', '15k parameters', 'teal'],
        ];
        const cw = w * 0.42, ch = h * 0.2;
        cards.forEach(([a, b, k], i) => {
          const x = w / 2 + (i % 2 ? u : -u - cw);
          const y = h * 0.28 + Math.floor(i / 2) * (ch + u * 4);
          s.alpha(s.ease('toy', 0.5, 0.5 + 0.4 * i), () => {
            s.rrect(x, y, cw, ch, 2, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.8), lw: 0.35 });
            s.text(a, x + cw / 2, y + ch * 0.4, { size: fit(s, a, cw * 0.88, 3.8, 'ui', 650), font: 'ui', weight: 650, color: s.c(k) });
            s.text(b, x + cw / 2, y + ch * 0.68, { size: 3, font: 'mono', color: s.c('--ink-2') });
          });
        });
        s.text('GRU networks, trained for this chapter', w / 2, h * 0.2, { size: fit(s, 'GRU networks, trained for this chapter', w * 0.85, 3.6, 'serif'), italic: true, color: s.c('--ink-2') });
      });

    // Colors move after their nouns.
    const fA = s.win('french', 'plan');
    if (fA > 0)
      s.alpha(fA, () => {
        const en = ['the', 'black', 'cat'], fr = ['le', 'chat', 'noir'];
        const al = [0, 2, 1];
        const gap = Math.min(w * 0.26, u * 26);
        const x = (i: number) => w / 2 + (i - 1) * gap;
        const y0 = h * 0.36, y1 = h * 0.68;
        fr.forEach((_, t) => {
          const j = al[t]!;
          const k: K = t === 0 ? '--ink-3' : 'teal';
          s.line(x(j), y0 + u * 4, x(t), y1 - u * 4, s.tint(k, 0.9), t === 0 ? 0.3 : 0.6);
        });
        en.forEach((wd, i) => chip(s, wd, x(i), y0, 'orange', { size: 5, on: i > 0 ? s.ease('french', 0.5, 2) : 0 }));
        fr.forEach((wd, i) => chip(s, wd, x(i), y1, 'slate', { size: 5, on: i > 0 ? s.ease('french', 0.5, 2) : 0 }));
        s.text('English', x(0) - gap * 0.75, y0, { size: 3, font: 'ui', color: s.c('--ink-3'), align: 'right' });
        s.text('French', x(0) - gap * 0.75, y1, { size: 3, font: 'ui', color: s.c('--ink-3'), align: 'right' });
      });

    // The plan.
    const pA = s.ease('plan', 0.6);
    if (pA > 0)
      s.alpha(pA, () => {
        const items = ['the encoder and the decoder', 'the bottleneck', 'attention: look back', 'a soft lookup: q, k, v'];
        const ks: K[] = ['green', 'red', 'teal', 'blue'];
        const lh = Math.min(h * 0.15, u * 14);
        const y0 = h * 0.53 - (lh * 3) / 2;
        const size = Math.min(4.6, ...items.map((it) => fit(s, it, w * 0.66, 4.6, 'ui', 600)));
        items.forEach((it, i) => {
          const on = s.prog('plan') * 4.4 - 0.4 > i ? 1 : 0.35;
          const y = y0 + i * lh;
          s.alpha(on, () => {
            s.circle(w * 0.17, y, u * 3.2, { fill: s.tint(ks[i]!, 0.18), stroke: s.c(ks[i]!), lw: 0.35 });
            s.text(String(i + 1), w * 0.17, y + u * 0.2, { size: 3.6, font: 'mono', weight: 700, color: s.c(ks[i]!) });
            s.text(it, w * 0.17 + u * 6, y, { size, font: 'ui', weight: 600, align: 'left' });
          });
        });
      });
  },
};

/* ------------------------------------------------------------------ 2. encoder and decoder */

const encdec: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const S = ENC_EX.src.length;
    const T = ENC_EX.dec.length;
    const L = w * 0.09, R = w * 0.97;
    const colW = (R - L) / T;
    const cx = (i: number) => L + colW * (i + 0.5);
    const cs = Math.min((colW * 0.55) / 4, (h * 0.15) / 8);
    const gw = 4 * cs, gh = 8 * cs;
    const yX = h * 0.2, yH = yX + u * 4.5, yC = yH + gh + u * 5, yS = yC + gh + u * 6, yY = yS + gh + u * 4.6;
    const size = Math.min(3.4, fit(s, 'chien', colW - u * 4.2, 3.4, 'mono', 600));
    const ink3 = s.tint('--ink-3', 0.7);
    const lit = s.c('--accent');

    // Row labels, until the decoder needs the room.
    s.alpha(1 - s.ease('dec', 0.5), () => {
      ([['x', yX, 'orange'], ['h', yH + gh / 2, 'green'], ['s', yS + gh / 2, 'blue'], ['y', yY, 'slate']] as [string, number, K][]).forEach(([t, y, k]) =>
        s.text(t, L * 0.45, y, { size: 4.6, italic: true, weight: 700, color: s.c(k) }));
    });

    // Encoder: one state per word, revealed across the reading beats.
    const pe = s.span('enc', 'last') * S;
    const nEnc = s.since('enc') < 0 ? 0 : Math.min(S, Math.ceil(pe + 1e-6));
    const gone = 1 - 0.72 * s.ease('only', 0.8);
    s.alpha(gone, () => {
      for (let j = 0; j < S; j++) {
        const on = j === nEnc - 1 && s.since('last') < 0 ? 1 : 0;
        chip(s, ENC_EX.src[j]!, cx(j), yX, 'orange', { size, on });
        const x0 = cx(j) - gw / 2;
        if (j < nEnc) {
          const a = clamp01(pe - j + 0.6);
          s.alpha(a, () => {
            s.arrow(cx(j), yX + u * 3.2, cx(j), yH - u * 0.8, on ? lit : ink3, on ? 0.45 : 0.25, 1.6);
            heat(s, ENC_EX.enc[j]!, x0, yH, 4, cs, 'green');
            if (j > 0) s.arrow(cx(j - 1) + gw / 2 + u * 0.6, yH + gh / 2, x0 - u * 0.8, yH + gh / 2, on ? lit : ink3, on ? 0.45 : 0.25, 1.6);
            if (on) s.rrect(x0 - u, yH - u, gw + 2 * u, gh + 2 * u, 1, { stroke: lit, lw: 0.45 });
          });
        } else ghost(s, x0, yH, gw, gh);
      }
    });

    // The context: the last encoder state, the decoder's whole view of the source.
    const ccx = cx(S - 1);
    const cA = s.ease('last', 0.6);
    if (cA > 0)
      s.alpha(cA, () => {
        s.arrow(ccx, yH + gh + u * 0.8, ccx, yC - u * 0.8, s.c('gold'), 0.4, 1.6);
        heat(s, ENC_EX.c, ccx - gw / 2, yC, 4, cs, 'gold');
        const pulse = s.since('only') >= 0 && s.since('dec') < 0 ? 0.5 + 0.5 * Math.sin(s.since('only') * 4) : 0;
        s.rrect(ccx - gw / 2 - u, yC - u, gw + 2 * u, gh + 2 * u, 1, { stroke: s.c('gold'), lw: 0.45 + 0.3 * pulse });
        s.text('c', ccx - gw / 2 - u * 2.5, yC + gh * 0.35, { size: 4.6, italic: true, weight: 700, color: s.c('gold'), align: 'right' });
        s.text(s.tall ? '32 numbers' : '32 numbers: all the decoder gets', ccx - gw / 2 - u * 2.5, yC + gh * 0.7, { size: 3, font: 'ui', color: s.c('--ink-2'), align: 'right' });
      });

    // Decoder: one state and one word per step.
    s.alpha(0.5 * (1 - s.ease('dec', 0.4)), () => {
      for (let t = 0; t < T; t++) ghost(s, cx(t) - gw / 2, yS, gw, gh);
    });
    const dA = s.ease('dec', 0.6);
    if (dA > 0)
      s.alpha(dA, () => {
        const t0 = s.at('write');
        const t1 = s.end('stop');
        const pd = clamp01((s.t - t0) / Math.max(0.01, t1 - t0)) * T;
        const nDec = s.t < t0 ? 0 : Math.min(T, Math.ceil(pd + 1e-6));
        if (nDec === 0) chip(s, '<bos>', cx(0), yY, 'slate', { size: size * 0.9 });
        for (let t = 0; t < T; t++) {
          const x0 = cx(t) - gw / 2;
          if (t >= nDec) {
            ghost(s, x0, yS, gw, gh);
            continue;
          }
          const on = t === nDec - 1 ? 1 : 0;
          s.alpha(clamp01(pd - t + 0.6), () => {
            s.line(ccx, yC + gh + u, cx(t), yS - u, s.tint('gold', on ? 0.9 : 0.4), on ? 0.35 : 0.2, [1, 0.8]);
            heat(s, ENC_EX.dec[t]!, x0, yS, 4, cs, 'blue');
            if (t > 0) s.arrow(cx(t - 1) + gw / 2 + u * 0.6, yS + gh / 2, x0 - u * 0.8, yS + gh / 2, on ? lit : ink3, on ? 0.45 : 0.25, 1.6);
            if (on) s.rrect(x0 - u, yS - u, gw + 2 * u, gh + 2 * u, 1, { stroke: lit, lw: 0.45 });
            s.arrow(cx(t), yS + gh + u * 0.6, cx(t), yY - u * 3, on ? lit : ink3, on ? 0.45 : 0.25, 1.6);
            const wd = ENC_EX.words[t] ?? '<eos>';
            chip(s, wd, cx(t), yY, 'slate', { size, on });
            s.alpha(s.ease('softmax', 0.5), () => s.text(pctS(ENC_EX.probs[t]!), cx(t), yY + u * 4.4, { size: 2.6, font: 'mono', color: s.c('--ink-3') }));
            // the word just written goes back in as the next input
            if (t < nDec - 1 && t < T - 1)
              s.alpha(s.ease('feed', 0.6), () => curve(s, cx(t) + u * 2.5, yY - u * 2.6, cx(t + 1) - gw / 2, yS + gh * 0.85, -u * 3, s.tint('slate', 0.7), 0.25, 1, [0.9, 0.7]));
          });
        }
      });
  },
};

/* ------------------------------------------------------------------ 3. one word at a time */

const OUT7 = [...ENC_EX.words, '<eos>'];
const PROD = ENC_EX.probs.reduce((a, b) => a * b, 1);

const chain: SceneDef = {
  marks: {
    rule: { tex: String.raw`p(\symy \mid \symx) = \prod_{t} p\big(\symy_t \mid \symy_{<t},\, \symx\big)`, x: 0.5, y: 0.22, size: 5.6 },
    loss: { tex: String.raw`\mathcal{L} = -\sum_{t} \log p\big(\symy_t \mid \symy_{<t},\, \symx\big)`, x: 0.5, y: 0.22, size: 5.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const n = OUT7.length;
    const colW = (w * 0.9) / n;
    const cx = (i: number) => w * 0.05 + colW * (i + 0.5);
    const size = Math.min(3.4, fit(s, '<eos>', colW - u * 4, 3.4, 'mono', 600));

    // Chain rule, then the log loss, over the same row of words.
    const aA = s.win('chain', 'tf');
    s.show('rule', aA * (1 - s.ease('log', 0.5)));
    s.show('loss', s.win('log', 'tf'));
    if (aA > 0)
      s.alpha(aA, () => {
        const y = h * 0.44;
        s.alpha(s.win('name', 'log'), () => s.text('the chain rule of probability', w / 2, h * 0.32, { size: 3.6, font: 'ui', weight: 600, color: s.c('--accent') }));
        const shown = s.since('chain2') < 0 ? 0 : clamp01(s.prog('chain2') * 1.2) * n;
        for (let t = 0; t < n; t++) {
          const a = clamp01(shown - t);
          if (a <= 0) continue;
          s.alpha(a, () => {
            chip(s, OUT7[t]!, cx(t), y, 'slate', { size });
            if (t > 0 && s.since('probs') < 0) curve(s, cx(t - 1), y - u * 3.6, cx(t), y - u * 3.6, -u * 3, s.tint('--ink-3', 0.6), 0.25);
          });
          // probabilities, multiplied
          s.alpha(s.ease('probs', 0.5, 0.25 * t) * (1 - s.ease('log', 0.4)), () => {
            s.text(pctS(ENC_EX.probs[t]!), cx(t), y + u * 6.5, { size: Math.min(2.7, fit(s, '>99.9%', colW * 0.86, 2.7, 'mono')), font: 'mono', color: s.c('teal') });
            if (t > 0) s.text('×', cx(t) - colW / 2, y + u * 6.5, { size: 3, font: 'mono', color: s.c('--ink-3') });
          });
          // and their negative logs, added
          s.alpha(s.ease('log', 0.5, 0.2 * t), () => {
            s.text((-Math.log(ENC_EX.probs[t]!)).toFixed(4), cx(t), y + u * 6.5, { size: Math.min(2.7, fit(s, '0.0000', colW * 0.86, 2.7, 'mono')), font: 'mono', color: s.c('red') });
            if (t > 0) s.text('+', cx(t) - colW / 2, y + u * 6.5, { size: 3, font: 'mono', color: s.c('--ink-3') });
          });
        }
        s.alpha(s.ease('probs', 0.6, 2.4) * (1 - s.ease('log', 0.4)), () => {
          s.text(`p(whole translation) = ${PROD.toFixed(3)}`, w / 2, h * 0.68, { size: fit(s, 'p(whole translation) = 0.990', w * 0.8, 4.4, 'mono', 600), font: 'mono', weight: 600, color: s.c('teal') });
          s.text('every word above 99%, the product still about 99%', w / 2, h * 0.77, { size: fit(s, 'every word above 99%, the product still about 99%', w * 0.85, 3.2, 'ui'), font: 'ui', color: s.c('--ink-2') });
        });
        s.alpha(s.ease('log', 0.6, 2) , () => {
          s.text(`loss = ${(-Math.log(PROD)).toFixed(4)}`, w / 2, h * 0.68, { size: 4.4, font: 'mono', weight: 600, color: s.c('red') });
          s.alpha(s.ease('loss', 0.5), () => s.text('cross-entropy, once per word, added up', w / 2, h * 0.77, { size: fit(s, 'cross-entropy, once per word, added up', w * 0.85, 3.4, 'ui'), font: 'ui', color: s.c('--ink-2') }));
        });
      });

    // Teacher forcing: training feeds the reference word, not the model's guess.
    const tfA = s.win('tf', 'back');
    if (tfA > 0)
      s.alpha(tfA, () => {
        const m = 4;
        const bw = Math.min(w * 0.17, u * 17);
        const gx = (i: number) => w * 0.5 + (i - (m - 1) / 2) * (bw + u * 5);
        const rows: [number, string, string[], string[], boolean][] = [
          [h * 0.3, 'training: fed the reference', ['<bos>', 'le', 'chat', 'noir'], ['le', 'chat', 'noir', 'voit'], false],
          [h * 0.7, 'without it: one mistake spreads', ['<bos>', 'le', 'loup', 'gris'], ['le', 'loup', 'gris', 'et'], true],
        ];
        rows.forEach(([y, lab, ins, outs, bad], r) => {
          const ra = r === 0 ? 1 : s.ease('why', 0.6);
          s.alpha(ra, () => {
            s.text(lab, w / 2, y - u * 11, { size: fit(s, lab, w * 0.9, 3.6, 'ui', 600), font: 'ui', weight: 600, color: s.c(bad ? 'red' : 'gold') });
            for (let i = 0; i < m; i++) {
              const x = gx(i);
              s.rrect(x - bw / 2, y, bw, u * 6, 1.2, { fill: s.tint('blue', 0.12), stroke: s.tint('blue', 0.7), lw: 0.3 });
              s.text('s', x, y + u * 3.2, { size: 3.4, italic: true, weight: 700, color: s.c('blue') });
              if (i > 0) s.arrow(gx(i - 1) + bw / 2 + u * 0.5, y + u * 3, x - bw / 2 - u * 0.5, y + u * 3, s.tint('--ink-3', 0.7), 0.3, 1.4);
              const wrongOut = bad && i >= 1;
              const wrongIn = bad && i >= 2;
              chip(s, outs[i]!, x, y - u * 4, wrongOut ? 'red' : 'slate', { size: 3.2, maxW: bw + u * 4 });
              chip(s, ins[i]!, x, y + u * 10.5, wrongIn ? 'red' : r === 0 ? 'gold' : 'slate', { size: 3.2, maxW: bw + u * 4 });
              s.arrow(x, y + u * 7.6, x, y + u * 6.3, s.tint('--ink-3', 0.7), 0.25, 1.2);
              if (bad && i >= 1 && i < m - 1) curve(s, x + u * 3, y - u * 4, gx(i + 1) - u * 3, y + u * 10.5, -u * 3, s.tint('red', 0.7), 0.3, 1, [0.8, 0.6]);
            }
          });
        });
      });

    // Backprop: one loss trains both networks.
    const bA = s.win('back', 'greedy');
    if (bA > 0)
      s.alpha(bA, () => {
        const y = h * 0.5;
        const xs = s.tall ? [0.08, 0.2, 0.32, 0.47, 0.62, 0.74, 0.86] : [0.12, 0.22, 0.32, 0.46, 0.6, 0.7, 0.8];
        const kinds: [string, K][] = [['h', 'green'], ['h', 'green'], ['h', 'green'], ['c', 'gold'], ['s', 'blue'], ['s', 'blue'], ['s', 'blue']];
        const bs = Math.min(w * 0.08, u * 9);
        kinds.forEach(([t, k], i) => {
          const x = w * xs[i]!;
          s.rrect(x - bs / 2, y - bs / 2, bs, bs, 1.2, { fill: s.tint(k, 0.16), stroke: s.c(k), lw: 0.35 });
          s.text(t, x, y + u * 0.3, { size: 4, italic: true, weight: 700, color: s.c(k) });
          if (i > 0) s.arrow(w * xs[i - 1]! + bs / 2 + u * 0.4, y - u * 1.2, x - bs / 2 - u * 0.4, y - u * 1.2, s.tint('--ink-3', 0.7), 0.3, 1.4);
        });
        const lx = s.tall ? w * 0.94 : w * 0.9;
        s.text('loss', lx, y - u * 1.2, { size: 3.6, font: 'ui', weight: 650, color: s.c('red') });
        s.arrow(w * xs[6]! + bs / 2 + u * 0.4, y - u * 1.2, lx - u * 4.2, y - u * 1.2, s.tint('--ink-3', 0.7), 0.3, 1.4);
        // gradients flowing back, as dashes moving leftward
        const c = s.ctx;
        c.save();
        c.setLineDash([u * 1.4, u * 1.2]);
        c.lineDashOffset = s.t * u * 6;
        c.strokeStyle = s.c('teal');
        c.lineWidth = u * 0.5;
        c.beginPath();
        c.moveTo(lx - u * 2, y + u * 2.5 + bs / 2);
        c.lineTo(w * xs[0]! - bs / 2, y + u * 2.5 + bs / 2);
        c.stroke();
        c.restore();
        s.arrow(w * xs[0]! - bs / 2 + u * 2, y + u * 2.5 + bs / 2, w * xs[0]! - bs / 2 - u * 0.5, y + u * 2.5 + bs / 2, s.c('teal'), 0.5, 2);
        s.text('gradients: decoder, then c, then encoder', w / 2, y + bs / 2 + u * 8, { size: fit(s, 'gradients: decoder, then c, then encoder', w * 0.85, 3.4, 'ui'), font: 'ui', color: s.c('teal') });
        s.text('encoder', (w * xs[0]! + w * xs[2]!) / 2, y - bs / 2 - u * 4, { size: 3, font: 'ui', color: s.c('green') });
        s.text('decoder', (w * xs[4]! + w * xs[6]!) / 2, y - bs / 2 - u * 4, { size: 3, font: 'ui', color: s.c('blue') });
      });

    // Greedy versus beam search: a schematic tree.
    const gA = s.ease('greedy', 0.6);
    if (gA > 0)
      s.alpha(gA, () => {
        const lv = [[0], [0, 1], [0, 1, 2, 3], [0, 1, 2, 3, 4, 5, 6, 7]];
        const X = (d: number, i: number) => w * 0.5 + (i - (lv[d]!.length - 1) / 2) * ((w * 0.84) / lv[d]!.length);
        const Y = (d: number) => h * 0.22 + d * h * 0.17;
        const beam = new Set(['1:0', '1:1', '2:1', '2:2', '3:2', '3:5']);
        const greedy = new Set(['1:0', '2:0', '3:0']);
        for (let d = 1; d < 4; d++)
          lv[d]!.forEach((i) => {
            const pi = Math.floor(i / 2);
            const k = `${d}:${i}`;
            const g = greedy.has(k), b = beam.has(k) && s.prog('greedy') > 0.45;
            s.line(X(d - 1, pi), Y(d - 1), X(d, i), Y(d), g ? s.c('slate') : b ? s.c('teal') : s.tint('--ink-3', 0.35), g || b ? 0.5 : 0.2);
          });
        lv.forEach((row, d) => row.forEach((i) => s.circle(X(d, i), Y(d), u * 1.4, { fill: s.c(greedy.has(`${d}:${i}`) || d === 0 ? 'slate' : beam.has(`${d}:${i}`) && s.prog('greedy') > 0.45 ? 'teal' : '--rule') })));
        s.text('greedy: one path', w * 0.06, h * 0.86, { size: 3.4, font: 'ui', weight: 600, color: s.c('slate'), align: 'left' });
        s.alpha(clamp01((s.prog('greedy') - 0.45) * 4), () => s.text('beam: keep the best few', w * 0.94, h * 0.86, { size: 3.4, font: 'ui', weight: 600, color: s.c('teal'), align: 'right' }));
      });
  },
};

/* ------------------------------------------------------------------ 4. the bottleneck */

const SHORT = ['the', 'cat', 'sees', 'a', 'dog'];

/** Steps between reading a source word and writing its translation, in normal and reversed reading order. */
const DIST = FR.map((_, t) => {
  const j = ALIGN[t]! + 1;
  return { normal: 6 + (t + 1) - j, reversed: t + 1 + j - 1 };
});

const bottleneck: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const aA = s.win('crack', 'cho');
    if (aA > 0)
      s.alpha(aA, () => {
        const blocks: [string[], number, string][] = [
          [SHORT, h * 0.2, '5 words'],
          [FAIL_EX.src, h * 0.5, `${FAIL_EX.src.length} words`],
        ];
        const textW = w * 0.62;
        const cs = Math.min(u * 2, h * 0.025);
        blocks.forEach(([ws, y0, lab], b) => {
          const size = 3;
          const fade = (i: number) => (b === 1 ? 1 - 0.75 * s.ease('overwrite', 0.8) * (1 - i / (ws.length - 1)) : 1);
          let cx = w * 0.05, cy = y0;
          const sp = s.measure(' ', { font: 'mono', size });
          ws.forEach((wd, i) => {
            const ww = s.measure(wd, { font: 'mono', size, weight: 500 });
            if (cx > w * 0.05 && cx + ww > w * 0.05 + textW) {
              cx = w * 0.05;
              cy += s.u * size * 1.6;
            }
            s.alpha(fade(i), () => s.text(wd, cx, cy, { font: 'mono', size, weight: 500, align: 'left', color: s.c('orange') }));
            cx += ww + sp;
          });
          s.text(lab, w * 0.05, y0 - u * 4.5, { size: 3, font: 'ui', weight: 600, color: s.c('--ink-3'), align: 'left' });
          // the same 32 cells, whatever the length
          const gx = w * 0.05 + textW + u * 8, gy = (y0 + cy) / 2 - 4 * cs;
          s.arrow(w * 0.05 + textW + u * 1, (y0 + cy) / 2, gx - u * 1.2, (y0 + cy) / 2, s.c('gold'), 0.4, 1.8);
          for (let i = 0; i < 32; i++) s.rrect(gx + (i % 4) * cs, gy + Math.floor(i / 4) * cs, cs - 0.8, cs - 0.8, 0.2, { fill: s.tint('gold', 0.3), stroke: s.tint('gold', 0.8), lw: 0.1 });
          s.text('32', gx + 2 * cs, gy + 8 * cs + u * 3, { size: 3, font: 'mono', weight: 600, color: s.c('gold') });
        });
        s.alpha(s.ease('overwrite', 0.6, 1), () => s.text('early words: squeezed the most', w * 0.05, h * 0.86, { size: fit(s, 'early words: squeezed the most', w * 0.7, 3.4, 'ui'), font: 'ui', weight: 600, color: s.c('red'), align: 'left' }));
      });

    // Two 2014 papers.
    const pA = s.win('cho', 'reverse');
    if (pA > 0)
      s.alpha(pA, () => {
        const cards: [string, string, string, string][] = [
          ['cho', 'Cho, van Merriënboer, Bahdanau, Bengio (2014)', 'quality falls steadily with sentence length', 'red'],
          ['sutskever', 'Sutskever, Vinyals and Le (2014)', '4 layers of 1,000 LSTM units: held up better', 'blue'],
        ];
        cards.forEach(([beat, a, b, k], i) => {
          const y = h * 0.3 + i * h * 0.3;
          s.alpha(s.ease(beat, 0.6), () => {
            s.rrect(w * 0.06, y - h * 0.1, w * 0.88, h * 0.2, 2, { fill: s.tint(k as K, 0.08), stroke: s.tint(k as K, 0.6), lw: 0.3 });
            s.text(a, w / 2, y - h * 0.03, { size: fit(s, a, w * 0.8, 3.6, 'ui', 650), font: 'ui', weight: 650, color: s.c(k as K) });
            s.text(b, w / 2, y + h * 0.045, { size: fit(s, b, w * 0.8, 3.4, 'serif'), italic: true, color: s.c('--ink-2') });
          });
        });
      });

    // Reversing the source: distances from each source word to its translation.
    const rA = s.ease('reverse', 0.6);
    if (rA > 0)
      s.alpha(rA, () => {
        const rev = s.ease('reverse', 1.2, 2.2);
        const order = rev > 0.5 ? [...EN].reverse() : EN;
        s.text('reading order', w * 0.06, h * 0.17, { size: 3, font: 'ui', color: s.c('--ink-3'), align: 'left' });
        const rowW = w * 0.88;
        order.forEach((wd, i) => chip(s, wd, w * 0.06 + (rowW / 6) * (i + 0.5), h * 0.24, 'orange', { size: Math.min(3.4, fit(s, 'black', rowW / 6 - u * 4, 3.4, 'mono', 600)) }));
        const base = h * 0.8, top = h * 0.44;
        const maxD = 11;
        const colW = rowW / 6;
        s.line(w * 0.06, base, w * 0.94, base, s.c('--axis'), 0.3);
        FR.forEach((wd, t) => {
          const x = w * 0.06 + colW * (t + 0.5);
          const d = lerp(DIST[t]!.normal, DIST[t]!.reversed, smooth(rev));
          const bh = ((base - top) * d) / maxD;
          const long = s.since('moved') >= 0 && t === 5;
          s.rrect(x - colW * 0.28, base - bh, colW * 0.56, bh, 0.8, { fill: s.tint(long ? 'red' : rev > 0.5 ? 'orange' : 'slate', 0.55) });
          s.text(String(Math.round(d)), x, base - bh - u * 2.5, { size: 3, font: 'mono', weight: 600, color: s.c(long ? 'red' : '--ink-2') });
          chip(s, wd, x, base + u * 4, 'slate', { size: Math.min(3.2, fit(s, 'chien', colW - u * 4, 3.2, 'mono', 600)) });
        });
        const lab = rev > 0.5 ? 'steps from source word to its translation: average still 6' : 'steps from source word to its translation: about 6 each';
        s.text(lab, w / 2, h * 0.32, { size: fit(s, lab, w * 0.9, 3.2, 'ui'), font: 'ui', color: s.c('--ink-2') });
      });
  },
};

/* ------------------------------------------------------------------ 5. the cliff */

const CURVE_STYLE: [keyof typeof CURVES, string, Color, string][] = [
  ['encdec32', 'fixed vector, 32', 'orange', 'c32'],
  ['encdec64', 'fixed vector, 64', 'purple', 'c64'],
  ['attn', 'attention, 32', 'teal', 'attn'],
];

const cliff: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const plotA = 1 - 0.9 * s.win('fail', 'real');
    const px0 = w * 0.14, px1 = w * 0.95, py0 = h * 0.2, py1 = h * 0.82;
    const X = (L: number) => px0 + ((L - 4) / 37) * (px1 - px0);
    const Y = (a: number) => py1 - a * (py1 - py0);
    s.alpha(plotA, () => {
      for (let v = 0; v <= 1; v += 0.25) {
        s.line(px0, Y(v), px1, Y(v), s.c(v === 0 ? '--axis' : '--grid'), 0.25);
        s.text(`${v * 100}%`, px0 - u * 1.5, Y(v), { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
      }
      for (let L = 5; L <= 40; L += 5) s.text(String(L), X(L), py1 + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      s.text('sentence length (words)', (px0 + px1) / 2, py1 + u * 7, { size: 3, font: 'ui', color: s.c('--ink-2') });
      s.text('translated perfectly', px0, py0 - u * 4, { size: 3, font: 'ui', color: s.c('--ink-2'), align: 'left' });
      // the test sweeping through the lengths
      const sw = s.prog('toy');
      if (s.since('toy') >= 0 && s.since('c32') < 0) {
        const L = 5 + sw * 35;
        s.line(X(L), py0, X(L), py1, s.tint('--accent', 0.7), 0.3, [1, 0.8]);
      }
      CURVE_STYLE.forEach(([key, lab, k, beat], m) => {
        const p = clamp01((s.t - s.at(beat)) / 3);
        if (p <= 0) return;
        const ys = CURVES[key] as number[];
        const n = Math.max(1, Math.floor(p * ys.length));
        const c = s.ctx;
        c.beginPath();
        for (let i = 0; i < n; i++) {
          const x = X(CURVES.lengths[i]!), y = Y(ys[i]!) + (m - 1) * u * 0.5;
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
        const glow = key === 'attn' && s.since('why') >= 0 ? 0.3 + 0.2 * Math.sin(s.since('why') * 4) : 0;
        c.strokeStyle = s.c(k);
        c.lineWidth = u * (0.6 + glow);
        c.lineJoin = 'round';
        c.stroke();
        // legend entry
        const lx = px0 + u * 3, ly = Y(0.5) + m * u * 5;
        s.rrect(lx - u * 1.5, Y(0.5) - u * 3, u * 36, u * 16, 1.2, { fill: s.tint('--card', 0.05) });
        s.line(lx, ly, lx + u * 4, ly, s.c(k), 0.7);
        s.text(lab, lx + u * 5.5, ly, { size: 3, font: 'ui', align: 'left', color: s.c('--ink-2') });
      });
    });

    // One failure, word by word.
    const fA = s.win('fail', 'real');
    if (fA > 0)
      s.alpha(fA, () => {
        s.rrect(w * 0.03, h * 0.13, w * 0.94, h * 0.8, 2, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.2 });
        const x = w * 0.06, maxW = w * 0.88;
        const size = s.tall ? 3 : 3.2;
        let y = h * 0.2;
        s.text(`English, ${FAIL_EX.src.length} words`, x, y, { size: 3, font: 'ui', weight: 650, color: s.c('orange'), align: 'left' });
        y += u * 4.5;
        y += words(s, FAIL_EX.src, x, y, maxW, size, () => '--ink') + u * 2;
        s.text('reference', x, y, { size: 3, font: 'ui', weight: 650, color: s.c('slate'), align: 'left' });
        y += u * 4.5;
        y += words(s, FAIL_EX.ref, x, y, maxW, size, () => '--ink') + u * 2;
        s.text('fixed vector, 32', x, y, { size: 3, font: 'ui', weight: 650, color: s.c('orange'), align: 'left' });
        y += u * 4.5;
        words(s, FAIL_EX.out, x, y, maxW, size, (i) => (FAIL_EX.out[i] === FAIL_EX.ref[i] ? '--ink' : 'red'));
      });
    s.alpha(s.ease('real', 0.6), () => {
      const t = 'Bahdanau et al. (2014): the same shape on real French';
      s.text(t, w / 2, h * 0.93, { size: fit(s, t, w * 0.9, 3.2, 'serif'), italic: true, color: s.c('--ink-2') });
    });
  },
};

/* ------------------------------------------------------------------ 6. Bahdanau attention */

const ROW = 1; // the decoder step that writes "chat"

const attention: SceneDef = {
  marks: {
    score: { tex: String.raw`\syme_{tj} = v_a^{\top}\tanh\big(W_a \syms + U_a \symh_j\big)`, x: 0.5, y: 0.6, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const S = ALIGN_EX.src.length;
    const colW = (w * 0.9) / S;
    const cx = (j: number) => w * 0.05 + colW * (j + 0.5);
    const size = Math.min(3.4, fit(s, 'black', colW - u * 4, 3.4, 'mono', 600));
    const yW = h * 0.18, yH = h * 0.27;
    const hb = Math.min(colW * 0.5, u * 6);
    const e = ALIGN_EX.scores[ROW]!;
    const al = ALIGN_EX.alpha[ROW]!;
    const eMax = Math.max(...e);
    const yE0 = h * 0.47, eH = h * 0.12;
    const yA0 = h * 0.58, aH = h * 0.12;
    const sx = s.tall ? w * 0.74 : w * 0.78, sy = h * 0.88;
    const cxx = s.tall ? w * 0.26 : w * 0.22;

    // Encoder: words and states, all kept.
    const keep = s.ease('keep', 0.6);
    for (let j = 0; j < S; j++) {
      chip(s, ALIGN_EX.src[j]!, cx(j), yW, 'orange', { size, on: j === 2 && s.since('chat') >= 0 ? 1 : 0 });
      const lit = j === S - 1 ? 1 : keep;
      s.rrect(cx(j) - hb / 2, yH, hb, hb, 0.8, { fill: s.tint('green', 0.08 + 0.3 * lit), stroke: s.tint('green', 0.3 + 0.7 * lit), lw: 0.3 });
      s.text(`h${j + 1}`, cx(j), yH + hb / 2 + u * 0.2, { size: Math.min(3, hb / u * 0.42), font: 'mono', weight: 600, color: s.tint('green', 0.4 + 0.6 * lit) });
    }
    // Bidirectional reading: arrows both ways under the states.
    s.alpha(s.win('bidir', 'score'), () => {
      for (let j = 0; j < S - 1; j++) {
        s.arrow(cx(j) + hb / 2 + u * 0.3, yH + hb + u * 2, cx(j + 1) - hb / 2 - u * 0.3, yH + hb + u * 2, s.tint('green', 0.8), 0.25, 1.3);
        s.arrow(cx(j + 1) - hb / 2 - u * 0.3, yH + hb + u * 4.5, cx(j) + hb / 2 + u * 0.3, yH + hb + u * 4.5, s.tint('green', 0.8), 0.25, 1.3);
      }
      s.text('read both ways: each h knows its neighbors', w / 2, yH + hb + u * 9, { size: fit(s, 'read both ways: each h knows its neighbors', w * 0.88, 3.2, 'ui'), font: 'ui', color: s.c('green') });
    });
    // Before 'keep': only the last state goes on, as the plain encoder-decoder did.
    s.alpha(s.win('idea', 'keep'), () => {
      s.arrow(cx(S - 1), yH + hb + u, cx(S - 1), yH + hb + u * 7, s.c('gold'), 0.4, 1.6);
      s.text('before: only the last state', cx(S - 1), yH + hb + u * 10, { size: 3, font: 'ui', color: s.c('gold'), align: 'right' });
    });

    // The decoder state, about to write "chat".
    const dA = s.ease('three', 0.5);
    s.alpha(dA, () => {
      const bw = u * 10;
      s.rrect(sx - bw / 2, sy - u * 4, bw, u * 8, 1.5, { fill: s.tint('blue', 0.16), stroke: s.c('blue'), lw: 0.4 });
      s.text('s', sx, sy + u * 0.3, { size: 4.4, italic: true, weight: 700, color: s.c('blue') });
      const nxt = s.since('step') >= 0 ? 'wrote: chat' : 'next: chat';
      s.text(nxt, sx, sy - u * 6.4, { size: 3, font: 'mono', color: s.c('--ink-2') });
    });

    // 1. Scores.
    const eA = s.ease('score', 0.5) * (1 - 0.8 * s.win('net', 'soft'));
    if (eA > 0)
      s.alpha(eA, () => {
        const grow = clamp01(s.since('score') / 2);
        s.alpha(1 - s.ease('soft', 0.5), () => {
          for (let j = 0; j < S; j++) s.line(sx, sy - u * 4, cx(j), yE0 + u * 3, s.tint('purple', 0.25), 0.2);
        });
        s.line(w * 0.05, yE0, w * 0.95, yE0, s.c('--axis'), 0.25);
        s.text('e', w * 0.03, yE0 - eH / 2, { size: 4, italic: true, weight: 700, color: s.c('purple') });
        for (let j = 0; j < S; j++) {
          const bh = (Math.max(0, e[j]!) / eMax) * eH * grow;
          s.rrect(cx(j) - colW * 0.22, yE0 - bh, colW * 0.44, Math.max(1, bh), 0.4, { fill: s.tint('purple', j === 2 && s.since('chat') >= 0 ? 0.9 : 0.6) });
          if (s.since('chat') >= 0) s.text(fmt(e[j]!, 2), cx(j), yE0 + u * 2.6, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
        }
      });
    s.show('score', s.win('net', 'soft'));

    // 2. Softmax weights.
    const aA = s.ease('soft', 0.5);
    if (aA > 0)
      s.alpha(aA, () => {
        const grow = clamp01(s.since('soft') / 1.6);
        s.line(w * 0.05, yA0 + aH, w * 0.95, yA0 + aH, s.c('--axis'), 0.25);
        s.text('α', w * 0.03, yA0 + aH / 2, { size: 4, italic: true, weight: 700, color: s.c('teal') });
        for (let j = 0; j < S; j++) {
          const bh = al[j]! * aH * grow;
          s.rrect(cx(j) - colW * 0.22, yA0 + aH - bh, colW * 0.44, Math.max(1, bh), 0.4, { fill: s.tint('teal', 0.8) });
          if (al[j]! > 0.05) s.text(`${Math.round(al[j]! * 100)}%`, cx(j), yA0 + aH - bh - u * 2.2, { size: 2.8, font: 'mono', weight: 600, color: s.c('teal') });
        }
      });

    // 3. Weighted sum: the context for this step.
    const cA = s.ease('sum', 0.5);
    if (cA > 0)
      s.alpha(cA, () => {
        const bw = u * 10;
        for (let j = 0; j < S; j++) {
          const a = al[j]!;
          if (a < 0.002) {
            s.line(cx(j), yA0 + aH + u, cxx, sy - u * 4, s.tint('teal', 0.15), 0.12);
            continue;
          }
          s.line(cx(j), yA0 + aH + u, cxx, sy - u * 4, s.tint('teal', 0.3 + 0.7 * a), 0.15 + 1.1 * a);
        }
        s.rrect(cxx - bw / 2, sy - u * 4, bw, u * 8, 1.5, { fill: s.tint('gold', 0.3), stroke: s.c('gold'), lw: 0.4 });
        s.text('cₜ', cxx, sy + u * 0.3, { size: 4.4, italic: true, weight: 700, color: s.c('gold') });
        s.alpha(s.ease('chat2', 0.5), () => s.text('≈ h3, the state for "cat"', cxx + bw / 2 + u * 2, sy, { size: 3, font: 'ui', color: s.c('gold'), align: 'left' }));
      });
    // The decoder step: c_t goes in.
    s.alpha(s.ease('step', 0.5), () => s.arrow(cxx + u * 5.5, sy + u * 2.5, sx - u * 5.5, sy + u * 2.5, s.c('gold'), 0.45, 1.8));
    s.alpha(s.ease('price', 0.5), () => {
      const t = `one score per English word, for every word written`;
      s.text(t, w / 2, h * 0.96, { size: fit(s, t, w * 0.9, 3.2, 'serif'), italic: true, color: s.c('--ink-2') });
    });
  },
};

/* ------------------------------------------------------------------ 7. the alignment matrix */

/** Draws an alignment matrix; returns its layout. `rows(t)` gives each row's reveal 0..1. */
function matrix(s: Scene, x0: number, y0: number, maxW: number, maxH: number, src: string[], outs: string[], alpha: number[][], rows: (t: number) => number, size: number) {
  const { u } = s;
  const labW = Math.max(...outs.map((o) => s.measure(o, { font: 'mono', size, weight: 600 }))) + u * 2;
  const srcW = Math.max(...src.map((o) => s.measure(o, { font: 'mono', size, weight: 500 })));
  const cell = Math.min((maxW - labW - srcW * 0.5) / src.length, (maxH - srcW * 0.75) / outs.length);
  const top = y0 + srcW * 0.75;
  const left = x0 + labW + Math.max(0, (maxW - labW - srcW * 0.5 - cell * src.length) / 2);
  src.forEach((wd, j) => {
    s.ctx.save();
    s.ctx.translate(left + (j + 0.5) * cell + u * 0.6, top - u * 1.2);
    s.ctx.rotate(-Math.PI / 4);
    s.text(wd, 0, 0, { font: 'mono', size, align: 'left', color: s.c('orange') });
    s.ctx.restore();
  });
  outs.forEach((o, t) => {
    const r = rows(t);
    s.text(o, left - u * 1.2, top + (t + 0.5) * cell, { font: 'mono', size, weight: 600, align: 'right', color: s.c(t === outs.length - 1 ? '--ink-3' : 'slate') });
    for (let j = 0; j < src.length; j++) {
      const a = alpha[t]![j]! * r;
      s.ctx.fillStyle = s.tint('teal', 0.04 + 0.9 * Math.pow(a, 0.75));
      s.ctx.fillRect(left + j * cell + 0.5, top + t * cell + 0.5, cell - 1, cell - 1);
      if (cell > u * 6 && a > 0.05) s.text(String(Math.round(a * 100)), left + (j + 0.5) * cell, top + (t + 0.5) * cell, { font: 'mono', size: Math.min(2.8, cell / u * 0.36), weight: 600, color: s.c(a > 0.5 ? '--paper' : '--ink-2') });
    }
  });
  s.rrect(left, top, cell * src.length, cell * outs.length, 0.3, { stroke: s.c('--rule'), lw: 0.2 });
  return { left, top, cell };
}

const OUT_A = [...ALIGN_EX.words, '<end>'];

const alignment: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const mA = 1 - 0.95 * s.win('paper', 'end');
    const dot = s.ease('dot', 0.6);
    s.alpha(mA, () => {
      const T = OUT_A.length;
      const reveal = (t: number) => {
        if (s.since('rows') < 0) return 0;
        const pb = s.since('build') < 0 ? 0 : clamp01(s.prog('build') * 1.1) * 4;
        if (t < 4) return clamp01(pb - t + (s.since('build') >= 0 ? 0.3 : 0));
        return clamp01((s.t - s.at('cross') - (t - 4) * 0.25) / 0.4);
      };
      const mw = dot > 0 ? lerp(w * 0.9, w * 0.48, dot) : w * 0.9;
      const x0 = dot > 0 ? lerp(w * 0.05, w * 0.02, dot) : w * 0.05;
      const size = s.tall ? 3 : 3.2;
      const lay = matrix(s, x0, h * 0.15, mw, h * 0.8, ALIGN_EX.src, OUT_A, ALIGN_EX.alpha, reveal, size * (dot > 0 ? lerp(1, 0.85, dot) : 1));
      // the crosses where colors move after their nouns
      const cr = s.win('cross', 'paper');
      if (cr > 0)
        s.alpha(cr, () => {
          const box = (r0: number, c0: number) => s.rrect(lay.left + c0 * lay.cell - u * 0.4, lay.top + r0 * lay.cell - u * 0.4, 2 * lay.cell + u * 0.8, 2 * lay.cell + u * 0.8, 1, { stroke: s.c('--accent'), lw: 0.5 });
          box(1, 1);
          box(5, 5);
        });
      s.alpha(s.win('end', 'dot'), () => s.rrect(lay.left - u * 0.4, lay.top + (T - 1) * lay.cell - u * 0.4, ALIGN_EX.src.length * lay.cell + u * 0.8, lay.cell + u * 0.8, 1, { stroke: s.c('--accent'), lw: 0.5 }));
      s.alpha(s.ease('nobody', 0.6) * (1 - s.ease('paper', 0.4)), () => {
        const t = 'learned, never labeled';
        s.text(t, w / 2, h * 0.97, { size: fit(s, t, w * 0.9, 3.4, 'serif'), italic: true, color: s.c('--ink-2') });
      });
      if (dot > 0) {
        s.alpha(dot, () => {
          const lay2 = matrix(s, w * 0.52, h * 0.15, w * 0.46, h * 0.8, ALIGN_EX.src, [...ALIGN_DOT.words, '<end>'], ALIGN_DOT.alpha, () => 1, size * 0.85);
          s.text('additive', lay.left + (lay.cell * ALIGN_EX.src.length) / 2, h * 0.97, { size: 3.2, font: 'ui', weight: 650, color: s.c('purple') });
          s.text('dot product', lay2.left + (lay2.cell * ALIGN_EX.src.length) / 2, h * 0.97, { size: 3.2, font: 'ui', weight: 650, color: s.c('purple') });
        });
      }
    });

    // The paper's best-known example, as a sketch of its alignment.
    const pA = s.win('paper', 'end');
    if (pA > 0)
      s.alpha(pA, () => {
        const t = 'Bahdanau et al., real English to French';
        s.text(t, w / 2, h * 0.2, { size: fit(s, t, w * 0.9, 3.6, 'ui', 650), font: 'ui', weight: 650, color: s.c('--ink-2') });
        const en = ['European', 'Economic', 'Area'];
        const fr = ['zone', 'économique', 'européenne'];
        const al = [2, 1, 0];
        const sz = Math.min(4, fit(s, 'européenne', w * 0.28 - u * 4, 4, 'mono', 600));
        const X = (i: number) => w * (0.2 + 0.3 * i);
        const y0 = h * 0.4, y1 = h * 0.74;
        s.alpha(s.ease('eea', 0.5), () => {
          fr.forEach((_, t) => s.line(X(al[t]!), y0 + u * 4, X(t), y1 - u * 4, s.c('teal'), 0.6));
          en.forEach((wd, i) => chip(s, wd, X(i), y0, 'orange', { size: sz }));
          fr.forEach((wd, i) => chip(s, wd, X(i), y1, 'slate', { size: sz }));
          s.text('the attention runs backwards across the phrase', w / 2, h * 0.88, { size: fit(s, 'the attention runs backwards across the phrase', w * 0.9, 3.2, 'serif'), italic: true, color: s.c('--ink-2') });
        });
      });
  },
};

/* ------------------------------------------------------------------ 8. a soft dictionary lookup */

const KEYS: [number, number][] = [[1.6, 0.4], [-0.3, 1.55], [-1.45, -0.55], [0.55, -1.45], [0.3, 0.15]];
const KCOL: Color[] = ['red', 'gold', 'blue', 'green', 'purple'];
const fieldCache = new Map<string, HTMLCanvasElement>();

/** The lookup's answer for a query anywhere in the plane, cached per size, sharpness and theme. */
function lookupField(s: Scene, px: number, py: number, size: number, beta: number, hard: boolean): void {
  const cols = KCOL.map((k) => rgbOf(s.c(k)));
  const key = `${Math.round(size)}|${beta.toFixed(2)}|${hard}|${cols.join()}`;
  let cv = fieldCache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    const n = Math.max(8, Math.round(size / 4));
    cv.width = cv.height = n;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(n, n);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = -2.3 + ((i + 0.5) / n) * 4.6, y = 2.3 - ((j + 0.5) / n) * 4.6;
        const e = KEYS.map(([a, b]) => a * x + b * y);
        let wts: number[];
        if (hard) {
          let best = 0;
          e.forEach((v, k) => v > e[best]! && (best = k));
          wts = e.map((_, k) => (k === best ? 1 : 0));
        } else wts = softmax(e.map((v) => beta * v));
        const o = (j * n + i) * 4;
        for (let ch = 0; ch < 3; ch++) img.data[o + ch] = wts.reduce((acc, a, k) => acc + a * cols[k]![ch]!, 0);
        img.data[o + 3] = 130;
      }
    g.putImageData(img, 0, 0);
    if (fieldCache.size > 60) fieldCache.clear();
    fieldCache.set(key, cv);
  }
  s.ctx.save();
  s.ctx.imageSmoothingEnabled = true;
  s.ctx.drawImage(cv, px, py, size, size);
  s.ctx.restore();
}

/** The query's path while the narration says "move the query". */
function queryAt(p: number): [number, number] {
  const a = lerp(-2.6, 0.25, smooth(p));
  const r = lerp(1.6, 1.5, p);
  return [r * Math.cos(a), r * Math.sin(a)];
}

const lookup: SceneDef = {
  marks: {
    attend: { tex: String.raw`\symc = \sum_i \symalpha_i\, \symv_i, \quad \symalpha = \operatorname{softmax}\big(\operatorname{score}(\symq, \symk_i)\big)`, x: 0.5, y: 0.5, size: 4.6 },
    bq: { tex: String.raw`\text{Bahdanau:}\quad \symq = \syms_{t-1},\quad \symk_j = \symv_j = \symh_j`, x: 0.5, y: 0.4, size: 4.6 },
    tq: { tex: String.raw`\text{Transformer:}\quad \symq = W_Q\,x,\ \ \symk = W_K\,x,\ \ \symv = W_V\,x`, x: 0.5, y: 0.6, size: 4.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    s.show('attend', s.win('strip', 'dict'));
    s.alpha(s.win('strip', 'dict'), () => s.text('one attention step, by itself', w / 2, h * 0.32, { size: 3.6, font: 'ui', weight: 600, color: s.c('--ink-2') }));

    // A Python dict, then the same table with graded matches.
    const tA = s.win('dict', 'picture');
    if (tA > 0)
      s.alpha(tA, () => {
        const roles = s.ease('roles', 0.6);
        const graded = s.ease('graded', 0.6);
        const tw = Math.min(w * 0.8, u * 80);
        const x0 = w / 2 - tw / 2;
        const y0 = h * 0.3, rh = u * 9;
        const keyX = x0 + tw * 0.22, valX = x0 + tw * 0.58, barX = x0 + tw * 0.78;
        s.text(roles > 0.5 ? 'keys k' : 'key', keyX, y0 - rh * 0.75, { size: 3.2, font: 'ui', weight: 650, color: s.c(roles > 0.5 ? 'green' : '--ink-3') });
        s.text(roles > 0.5 ? 'values v' : 'value', valX, y0 - rh * 0.75, { size: 3.2, font: 'ui', weight: 650, color: s.c(roles > 0.5 ? 'red' : '--ink-3') });
        const rows: [string, string][] = [['cat', 'chat'], ['dog', 'chien']];
        const sc = [2.0, 0.5];
        const al = softmax(sc);
        rows.forEach(([k, v], i) => {
          const y = y0 + i * rh;
          const hit = i === 0 && graded < 0.5;
          s.rrect(x0, y - rh * 0.42, tw, rh * 0.84, 1.2, { fill: s.tint(hit ? 'blue' : '--ink-3', hit ? 0.14 * s.ease('dict', 0.5, 2) : 0.05) });
          chip(s, `"${k}"`, keyX, y, roles > 0.5 ? 'green' : 'slate', { size: 3.4 });
          s.text('→', (keyX + valX) / 2, y, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
          chip(s, `"${v}"`, valX, y, roles > 0.5 ? 'red' : 'slate', { size: 3.4 });
          s.alpha(graded, () => {
            const bw = tw * 0.16 * al[i]!;
            s.rrect(barX, y - u * 1.6, bw, u * 3.2, 0.4, { fill: s.tint('teal', 0.8) });
            s.text(`${Math.round(al[i]! * 100)}%`, barX + bw + u, y, { size: 3, font: 'mono', weight: 600, color: s.c('teal'), align: 'left' });
          });
        });
        const qy = y0 + 2 * rh + u * 3;
        const q = graded > 0.5 ? '"kitten"' : '"cat"';
        s.text(roles > 0.5 ? 'query q:' : 'look up:', x0, qy, { size: 3.2, font: 'ui', weight: 650, color: s.c(roles > 0.5 ? 'blue' : '--ink-3'), align: 'left' });
        chip(s, q, x0 + tw * 0.38, qy, 'blue', { size: 3.4 });
        const ans = graded > 0.5 ? (s.since('blend') >= 0 ? '0.82 × chat + 0.18 × chien' : 'every key gets a score') : '→ "chat"';
        s.text(ans, w / 2, qy + u * 9, { size: fit(s, ans, w * 0.9, 3.6, 'mono', 600), font: 'mono', weight: 600, color: s.c(graded > 0.5 && s.since('blend') >= 0 ? 'gold' : '--ink-2') });
        s.alpha(graded, () => s.text('(made-up scores 2.0 and 0.5, then a softmax)', w / 2, qy + u * 15, { size: fit(s, '(made-up scores 2.0 and 0.5, then a softmax)', w * 0.9, 2.8, 'ui'), font: 'ui', color: s.c('--ink-3') }));
      });

    // Keys in the plane, colors as values.
    const pA = s.win('picture', 'qkv');
    if (pA > 0)
      s.alpha(pA, () => {
        const size = Math.min(h * 0.78, s.tall ? w * 0.78 : w * 0.56);
        const px = s.tall ? (w - size) / 2 : w * 0.06, py = h * 0.16;
        const X = (x: number) => px + ((x + 2.3) / 4.6) * size;
        const Y = (y: number) => py + ((2.3 - y) / 4.6) * size;
        const hardT = s.win('hard', 'sharp', 0.5);
        const beta = s.since('sharp') >= 0 ? lerp(2, 14, clamp01(s.since('sharp') / 2.5)) : 2;
        s.rrect(px, py, size, size, 1, { fill: s.c('--paper') });
        lookupField(s, px, py, size, beta, false);
        if (hardT > 0) s.alpha(hardT, () => lookupField(s, px, py, size, beta, true));
        s.line(X(-2.3), Y(0), X(2.3), Y(0), s.tint('--axis', 0.6), 0.2);
        s.line(X(0), Y(-2.3), X(0), Y(2.3), s.tint('--axis', 0.6), 0.2);
        const q = s.since('move') < 0 ? queryAt(0) : queryAt(s.prog('move'));
        const e = KEYS.map(([a, b]) => a * q[0] + b * q[1]);
        const soft = softmax(e.map((v) => beta * v));
        let best = 0;
        e.forEach((v, k) => v > e[best]! && (best = k));
        const wts = soft.map((a, k) => lerp(a, k === best ? 1 : 0, hardT));
        KEYS.forEach(([a, b], k) => {
          s.circle(X(a), Y(b), u * (1.8 + 4 * wts[k]!), { stroke: s.tint('teal', 0.3 + 0.7 * wts[k]!), lw: 0.2 + 0.6 * wts[k]! });
          s.circle(X(a), Y(b), u * 1.6, { fill: s.c(KCOL[k]!), stroke: s.c('--paper'), lw: 0.3 });
          s.text(`k${k + 1}`, X(a) + u * 2.4, Y(b) - u * 2.4, { size: 2.8, font: 'mono', weight: 600, align: 'left', halo: true });
        });
        s.arrow(X(0), Y(0), X(q[0]), Y(q[1]), s.c('blue'), 0.45, 2);
        s.circle(X(q[0]), Y(q[1]), u * 1.7, { fill: s.c('blue'), stroke: s.c('--paper'), lw: 0.3 });
        s.text('q', X(q[0]) - u * 2.6, Y(q[1]) - u * 2.4, { size: 3.6, italic: true, weight: 700, color: s.c('blue'), halo: true });
        // the answer: a blended swatch, and the weights
        const cols = KCOL.map((k) => rgbOf(s.c(k)));
        const mix = [0, 1, 2].map((ch) => Math.round(wts.reduce((acc, a, k) => acc + a * cols[k]![ch]!, 0)));
        const sw = u * 12;
        const ax = s.tall ? px + size - sw : px + size + u * 6, ay = s.tall ? py + size + u * 2 : py + u * 2;
        if (!s.tall) {
          s.text(hardT > 0.5 ? 'c_hard' : 'c (blend)', ax + sw / 2, ay - u * 0.5 + sw + u * 4, { size: 3, font: 'mono', color: s.c('gold') });
          s.rrect(ax, ay, sw, sw, 1.5, { fill: `rgb(${mix.join(',')})`, stroke: s.c('--rule'), lw: 0.2 });
          wts.forEach((a, k) => {
            const y = ay + sw + u * 10 + k * u * 5.5;
            s.circle(ax + u * 1.2, y, u * 1.1, { fill: s.c(KCOL[k]!) });
            s.rrect(ax + u * 3.2, y - u * 1.2, Math.max(1, a * u * 20), u * 2.4, 0.4, { fill: s.tint('teal', 0.8) });
            s.text(`${Math.round(a * 100)}%`, ax + u * 4.2 + a * u * 20, y, { size: 2.6, font: 'mono', align: 'left', color: s.c('--ink-2') });
          });
        }
        const lab = hardT > 0.5 ? 'hard: the best key only' : s.since('sharp') >= 0 ? `sharper: β = ${beta.toFixed(0)}` : 'soft: a blend of every value';
        s.text(lab, px + size / 2, py - u * 2.6, { size: fit(s, lab, size, 3.2, 'ui', 600), font: 'ui', weight: 600, color: s.c('--ink-2') });
      });

    s.show('bq', s.ease('qkv', 0.6));
    s.show('tq', s.ease('proj', 0.6));
  },
};

/* ------------------------------------------------------------------ 9. why soft */

const LK = [-2, -1, 0, 1, 2];
const LV = [0.6, 2.6, 1.4, 3.6, 3.0];
const lookup1 = (q: number, beta: number) => {
  const al = softmax(LK.map((k) => -beta * (q - k) ** 2));
  const c = al.reduce((s, a, i) => s + a * LV[i]!, 0);
  const g = al.reduce((s, a, i) => s + a * (LV[i]! - c) * (-2 * beta * (q - LK[i]!)), 0);
  return { c, g };
};
const hard1 = (q: number) => {
  let b = 0;
  LK.forEach((k, i) => Math.abs(q - k) < Math.abs(q - LK[b]!) && (b = i));
  return LV[b]!;
};
const TARGET = 3.2;
/** Gradient descent on the query from q = 0.2, the same update as the chapter's figure. */
const TRAJ = (() => {
  const out = [0.2];
  let q = 0.2;
  for (let i = 0; i < 60; i++) {
    const { c, g } = lookup1(q, 2);
    q -= Math.max(-0.15, Math.min(0.15, 0.1 * (c - TARGET) * g));
    out.push(q);
  }
  return out;
})();

const soft: SceneDef = {
  marks: {
    grad: { tex: String.raw`\frac{\partial \symc}{\partial \syme_i} = \symalpha_i\,\big(\symv_i - \symc\big)`, x: 0.5, y: 0.25, size: 6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const px0 = w * 0.1, px1 = w * 0.95, py0 = h * 0.16, py1 = h * 0.78;
    const X = (q: number) => px0 + ((q + 3) / 6) * (px1 - px0);
    const Y = (v: number) => py1 - ((v + 0.3) / 4.4) * (py1 - py0);
    const fA = 1 - 0.75 * s.win('formula', 'sharp');
    s.alpha(fA, () => {
      for (let v = 0; v <= 4; v++) {
        s.line(px0, Y(v), px1, Y(v), s.c('--grid'), 0.2);
        s.text(String(v), px0 - u * 1.5, Y(v), { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
      }
      s.line(px0, py1 + u * 2, px1, py1 + u * 2, s.c('--axis'), 0.3);
      // keys and their values
      const kA = s.ease('line', 0.5);
      s.alpha(kA, () => {
        LK.forEach((k, i) => {
          s.text(`k=${k}`, X(k), py1 + u * 5.5, { size: 2.8, font: 'mono', color: s.c('green') });
          s.circle(X(k), Y(LV[i]!), u * 1.3, { fill: s.c('red'), stroke: s.c('--paper'), lw: 0.25 });
        });
      });
      // hard: the staircase
      const hA = s.ease('stairs', 0.5);
      if (hA > 0) {
        const c = s.ctx;
        c.save();
        c.beginPath();
        const p = clamp01(s.since('stairs') / 2.2);
        for (let i = 0; i <= 300 * p; i++) {
          const q = -3 + (6 * i) / 300;
          const y = Y(hard1(q));
          if (i) c.lineTo(X(q), y);
          else c.moveTo(X(q), y);
        }
        c.setLineDash([u * 1.2, u * 0.8]);
        c.strokeStyle = s.tint('slate', 0.9 * hA);
        c.lineWidth = u * 0.45;
        c.stroke();
        c.restore();
      }
      s.alpha(s.win('flat', 'ramp'), () => {
        s.line(X(0.55), Y(1.4) - u * 3, X(-0.45), Y(1.4) - u * 3, s.c('red'), 0.3);
        s.text('slope 0', X(0.05), Y(1.4) - u * 6, { size: 3, font: 'mono', weight: 600, color: s.c('red') });
      });
      // soft: the ramp, which sharpens toward the staircase at the end
      const beta = s.since('sharp') >= 0 ? lerp(2, 30, smooth(clamp01(s.since('sharp') / 3))) : 2;
      const rA = s.ease('ramp', 0.5);
      if (rA > 0) {
        const c = s.ctx;
        c.beginPath();
        const p = clamp01(s.since('ramp') / 2);
        for (let i = 0; i <= 300 * p; i++) {
          const q = -3 + (6 * i) / 300;
          const y = Y(lookup1(q, beta).c);
          if (i) c.lineTo(X(q), y);
          else c.moveTo(X(q), y);
        }
        c.strokeStyle = s.tint('teal', rA);
        c.lineWidth = u * 0.65;
        c.stroke();
      }
      // the query, and the two learners
      const descend = s.since('descend') >= 0;
      if (descend) {
        s.line(px0, Y(TARGET), px1, Y(TARGET), s.c('gold'), 0.35, [1.2, 0.8]);
        s.text('target', px1, Y(TARGET) - u * 2, { size: 2.8, font: 'ui', weight: 650, color: s.c('gold'), align: 'right' });
      }
      const p = descend ? clamp01(s.since('descend') / Math.max(1, s.end('descend') - s.at('descend'))) : 0;
      const qs = TRAJ[Math.min(TRAJ.length - 1, Math.floor(p * (TRAJ.length - 1)))]!;
      const qh = 0.2;
      const wob = s.since('stairs') >= 0 && s.since('ramp') < 0 ? 0.35 * Math.sin(s.since('stairs') * 2) : 0;
      const tri = (x: number, k: K, up: boolean) => {
        const c = s.ctx;
        const yb = py1 + u * 2;
        c.beginPath();
        c.moveTo(x, yb + (up ? -u * 0.5 : u * 0.5));
        c.lineTo(x - u * 1.6, yb + (up ? u * 2.6 : -u * 2.6));
        c.lineTo(x + u * 1.6, yb + (up ? u * 2.6 : -u * 2.6));
        c.closePath();
        c.fillStyle = s.c(k);
        c.fill();
      };
      s.alpha(s.ease('line', 0.5, 1), () => {
        if (s.since('stairs') >= 0) {
          s.circle(X(qh + wob), Y(hard1(qh + wob)), u * 1.5, { fill: s.c('slate'), stroke: s.c('--paper'), lw: 0.25 });
          tri(X(qh + wob), 'slate', false);
        }
        if (s.since('ramp') >= 0) {
          const qq = descend ? qs : qh;
          s.line(X(qq), py1 + u * 2, X(qq), Y(lookup1(qq, beta).c), s.tint('blue', 0.6), 0.25, [0.8, 0.6]);
          s.circle(X(qq), Y(lookup1(qq, beta).c), u * 1.5, { fill: s.c('teal'), stroke: s.c('--paper'), lw: 0.25 });
          tri(X(qq), 'blue', true);
        }
      });
      // legend
      s.alpha(s.ease('stairs', 0.5), () => {
        const lx = px0 + u * 7, ly = py0 + u * 1;
        s.line(lx, ly, lx + u * 4, ly, s.c('slate'), 0.45, [1, 0.6]);
        s.text('hard', lx + u * 5.5, ly, { size: 3, font: 'ui', align: 'left', color: s.c('--ink-2') });
        s.alpha(s.ease('ramp', 0.5), () => {
          s.line(lx, ly + u * 4.5, lx + u * 4, ly + u * 4.5, s.c('teal'), 0.6);
          s.text(s.since('sharp') >= 0 ? `soft, β = ${beta.toFixed(0)}` : 'soft', lx + u * 5.5, ly + u * 4.5, { size: 3, font: 'ui', align: 'left', color: s.c('--ink-2') });
        });
      });
    });
    s.show('grad', s.win('formula', 'sharp'));
    s.alpha(s.win('formula', 'sharp'), () => {
      const a = 'pulls c toward vᵢ, in proportion to αᵢ';
      s.text(a, w / 2, h * 0.42, { size: fit(s, a, w * 0.9, 3.6, 'serif'), italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('zero', 0.5), () => {
        const b = 'αᵢ ≈ 0: no gradient.   αᵢ ≈ 1: vᵢ − c ≈ 0.';
        s.text(b, w / 2, h * 0.54, { size: fit(s, b, w * 0.9, 3.4, 'mono', 600), font: 'mono', weight: 600, color: s.c('red') });
      });
    });
  },
};

/* ------------------------------------------------------------------ 10. dot product versus additive */

/** The "bump" additive scorer: pairs of units with W = -U and a bias, peaking on keys near q. */
const BUMP_U: [number, number][] = [0, 1, 2].flatMap((i) => {
  const th = (i * Math.PI) / 3;
  return [[1.6 * Math.cos(th), 1.6 * Math.sin(th)], [-1.6 * Math.cos(th), -1.6 * Math.sin(th)]] as [number, number][];
});
const eAdd = (q: [number, number], x: number, y: number) => BUMP_U.reduce((acc, [a, b]) => acc + Math.tanh(a * (x - q[0]) + b * (y - q[1]) + 1), 0);

const scores: SceneDef = {
  marks: {
    fdot: { tex: String.raw`\text{dot:}\;\; \symq^{\top}\symk`, x: 0.5, y: 0.3, size: 5.2 },
    fgen: { tex: String.raw`\text{general:}\;\; \symq^{\top} W \symk`, x: 0.5, y: 0.47, size: 5.2 },
    fadd: { tex: String.raw`\text{additive:}\;\; v_a^{\top}\tanh(W_a\symq + U_a\symk)`, x: 0.5, y: 0.64, size: 5.2 },
    attn: { tex: String.raw`\operatorname{softmax}\big(\sym{q}{Q}\,\sym{k}{K}^{\top}\big)\,\sym{v}{V}`, x: 0.5, y: 0.22, size: 6.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const fA = s.win('luong', 'plane');
    const lit = (b: string) => (s.since(b) >= 0 ? 1 : 0.35);
    s.show('fadd', fA * (s.since('dot') < 0 ? 1 : 0.4));
    s.show('fdot', fA * lit('dot') * (s.since('general') >= 0 ? 0.4 : 1));
    s.show('fgen', fA * lit('general'));

    // Score landscapes over key space for one query.
    const pA = s.win('plane', 'matmul');
    if (pA > 0)
      s.alpha(pA, () => {
        const gap = u * 4;
        const size = Math.min((w * 0.92 - gap) / 2, h * 0.62);
        const xs = [w / 2 - size - gap / 2, w / 2 + gap / 2];
        const y0 = h * 0.26;
        const ang = 0.5 + 0.35 * Math.sin(s.t * 0.5);
        const qq: [number, number] = [1.1 * Math.cos(ang), 1.1 * Math.sin(ang)];
        const pos = rgbOf(s.c('purple')), neg = rgbOf(s.c('slate'));
        const fns = [(x: number, y: number) => qq[0] * x + qq[1] * y, (x: number, y: number) => eAdd(qq, x, y)];
        fns.forEach((fn, k) => {
          const on = k === 0 ? 1 : s.ease('bump', 0.6);
          s.alpha(on, () => {
            s.rrect(xs[k]!, y0, size, size, 1, { fill: s.c('--paper') });
            field(s.ctx, xs[k]!, y0, size, size, [-2, 2, -2, 2], (x, y) => {
              const e = fn(x, y);
              const v = Math.max(-1, Math.min(1, e / 4));
              const c = v >= 0 ? pos : neg;
              const band = Math.abs(e - Math.round(e)) < 0.06 ? 60 : 0;
              return [c[0], c[1], c[2], Math.min(255, 25 + 200 * Math.abs(v) + band)];
            }, Math.max(3, size / 70));
            const X = (v: number) => xs[k]! + ((v + 2) / 4) * size;
            const Y = (v: number) => y0 + ((2 - v) / 4) * size;
            s.arrow(X(0), Y(0), X(qq[0]), Y(qq[1]), s.c('blue'), 0.45, 2);
            s.text(k === 0 ? 'dot product' : 'additive', xs[k]! + size / 2, y0 - u * 3, { size: 3.4, font: 'ui', weight: 650, color: s.c('--ink-2') });
            s.text(k === 0 ? 'a tilted plane' : 'a bump near q', xs[k]! + size / 2, y0 + size + u * 3.5, { size: 3, font: 'serif', italic: true, color: s.c('--ink-2') });
          });
        });
        s.alpha(s.ease('learned', 0.6), () => {
          const t = 'but q and k are learned, so dot products can mean anything useful';
          s.text(t, w / 2, h * 0.95, { size: fit(s, t, w * 0.92, 3.2, 'serif'), italic: true, color: s.c('--ink-2') });
        });
      });

    // All scores at once: Q K^T, softmax, times V.
    const mA = s.win('matmul', 'size');
    if (mA > 0)
      s.alpha(mA, () => {
        s.show('attn', s.ease('three', 0.6) * mA);
        const T = 4, d = 3, n = 5;
        const cs = Math.min(w / 30, h / 16);
        const y0 = h * 0.42;
        const grid = (x: number, y: number, r: number, c: number, k: K, lab: string, a = 1) =>
          s.alpha(a, () => {
            for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) s.rrect(x + j * cs, y + i * cs, cs - u * 0.4, cs - u * 0.4, 0.3, { fill: s.tint(k, 0.25 + 0.25 * (((i * 7 + j * 3) % 5) / 4)), stroke: s.tint(k, 0.8), lw: 0.12 });
            s.text(lab, x + (c * cs) / 2, y + r * cs + u * 3, { size: 3, font: 'mono', weight: 600, color: s.c(k) });
          });
        const blk = s.since('block') >= 0 ? s.ease('block', 0.5) : 0;
        s.alpha(1 - blk, () => {
          let x = w / 2 - ((d + n + n + n + d) * cs + 4 * cs * 1.2) / 2;
          grid(x, y0, T, d, 'blue', 'Q');
          x += d * cs + cs * 1.2;
          s.text('×', x - cs * 0.6, y0 + (T * cs) / 2, { size: 4, color: s.c('--ink-3') });
          grid(x, y0 - cs * 0.5, d, n, 'green', 'Kᵀ');
          x += n * cs + cs * 1.2;
          s.text('=', x - cs * 0.6, y0 + (T * cs) / 2, { size: 4, color: s.c('--ink-3') });
          grid(x, y0, T, n, 'purple', 'E');
          x += n * cs + cs * 1.2;
          const tA = s.ease('three', 0.6);
          s.alpha(tA, () => s.text('→', x - cs * 0.6, y0 + (T * cs) / 2, { size: 4, color: s.c('--ink-3') }));
          grid(x, y0, T, n, 'teal', 'softmax', tA);
          x += n * cs + cs * 1.2;
          s.alpha(tA, () => s.text('×', x - cs * 0.6, y0 + (T * cs) / 2, { size: 4, color: s.c('--ink-3') }));
          grid(x, y0 - cs * 0.5, n, d, 'red', 'V', tA);
          const t = 'one matrix multiply: every query against every key';
          s.text(t, w / 2, h * 0.86, { size: fit(s, t, w * 0.9, 3.2, 'serif'), italic: true, color: s.c('--ink-2') });
        });
        // the additive score's T x n x A block of tanh inputs
        s.alpha(blk, () => {
          const bw = w * 0.3, bh = h * 0.22, dep = Math.min(w, h) * 0.12;
          const x = w / 2 - bw / 2 - dep / 2, y = h * 0.45;
          for (let i = 6; i >= 0; i--) {
            const o = (dep * i) / 6;
            s.rrect(x + o, y - o, bw, bh, 0.6, { fill: s.tint('purple', 0.12), stroke: s.tint('purple', 0.7), lw: 0.15 });
          }
          s.text('T × n × A tanh inputs', x + (bw + dep) / 2, y + bh + u * 3.5, { size: 3, font: 'mono', weight: 600, color: s.c('purple') });
          const t = 'additive: a big block before a single score exists';
          s.text(t, w / 2, h * 0.86, { size: fit(s, t, w * 0.9, 3.2, 'serif'), italic: true, color: s.c('--ink-2') });
        });
      });

    // The dot product's typical size grows like the square root of the dimension.
    const zA = s.ease('size', 0.6);
    if (zA > 0)
      s.alpha(zA, () => {
        const ds = [16, 64, 256, 1024];
        const base = h * 0.78, top = h * 0.3;
        const bw = Math.min(w * 0.12, u * 12);
        ds.forEach((d, i) => {
          const x = w / 2 + (i - 1.5) * bw * 1.9;
          const v = Math.sqrt(d);
          const bh = ((base - top) * v) / 32 * clamp01((s.since('size') - i * 0.5) / 0.8);
          s.rrect(x - bw / 2, base - bh, bw, bh, 0.6, { fill: s.tint('purple', 0.7) });
          s.text(String(v), x, base - bh - u * 2.4, { size: 3, font: 'mono', weight: 600, color: s.c('purple') });
          s.text(`d = ${d}`, x, base + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-2') });
        });
        const t = 'typical size of q·k for random vectors: √d';
        s.text(t, w / 2, h * 0.2, { size: fit(s, t, w * 0.9, 3.6, 'ui', 600), font: 'ui', weight: 600, color: s.c('--ink-2') });
        s.text('next chapter: divide by √d', w / 2, h * 0.92, { size: 3.4, font: 'serif', italic: true, color: s.c('--accent') });
      });
  },
};

/* ------------------------------------------------------------------ 11. costs */

const costs: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // S x T scores, filling in.
    const gA = s.win('cost', 'path');
    if (gA > 0)
      s.alpha(gA, () => {
        const S = 7, T = 8;
        const cs = Math.min((w * 0.5) / S, (h * 0.55) / T);
        const x0 = w / 2 - (S * cs) / 2, y0 = h * 0.22;
        const p = clamp01(s.since('cost') / 3) * S * T;
        for (let t = 0; t < T; t++)
          for (let j = 0; j < S; j++) {
            const k = t * S + j;
            s.rrect(x0 + j * cs, y0 + t * cs, cs - u * 0.5, cs - u * 0.5, 0.4, { fill: s.tint('purple', k < p ? 0.55 : 0.06) });
          }
        s.text('S English words →', x0, y0 - u * 3, { size: 3, font: 'ui', color: s.c('orange'), align: 'left' });
        s.ctx.save();
        s.ctx.translate(x0 - u * 3, y0);
        s.ctx.rotate(Math.PI / 2);
        s.text('T French words →', 0, 0, { size: 3, font: 'ui', color: s.c('slate'), align: 'left' });
        s.ctx.restore();
        s.text('S × T scores per sentence', w / 2, y0 + T * cs + u * 5, { size: 3.6, font: 'mono', weight: 600, color: s.c('purple') });
      });

    // Paths: through both recurrences, or one step.
    const pA = s.win('path', 'left');
    if (pA > 0)
      s.alpha(pA, () => {
        const n = 5;
        const L = w * 0.08, R = w * 0.92;
        const step = (R - L) / (2 * n);
        const yA = h * 0.3, yB = h * 0.68;
        const bx = u * 3.2;
        ([[yA, 'fixed vector: through every step in between', false], [yB, 'attention: one step', true]] as [number, string, boolean][]).forEach(([y, lab, att]) => {
          s.text(lab, w / 2, y - u * 9, { size: fit(s, lab, w * 0.9, 3.4, 'ui', 600), font: 'ui', weight: 600, color: s.c(att ? 'teal' : 'red') });
          for (let i = 0; i < 2 * n; i++) {
            const x = L + step * (i + 0.5);
            const k: K = i < n ? 'green' : 'blue';
            const onPath = !att && i >= 1 && i <= n + 2;
            s.rrect(x - bx, y - bx, 2 * bx, 2 * bx, 0.8, { fill: s.tint(k, onPath ? 0.4 : 0.12), stroke: s.tint(k, 0.8), lw: 0.25 });
            if (i > 0) s.line(x - step + bx, y, x - bx, y, s.tint(onPath ? 'red' : '--ink-3', onPath ? 0.9 : 0.5), onPath ? 0.5 : 0.25);
          }
          s.text('x₂', L + step * 1.5, y + u * 6.5, { size: 3, font: 'mono', color: s.c('orange') });
          s.text('y₃', L + step * (n + 2.5), y + u * 6.5, { size: 3, font: 'mono', color: s.c('slate') });
          if (att) curve(s, L + step * 1.5, y - bx, L + step * (n + 2.5), y - bx, -u * 7, s.c('teal'), 0.6, clamp01(s.since('path') / 1.2));
        });
      });

    // Still one step at a time.
    const sA = s.win('left', 'self');
    if (sA > 0)
      s.alpha(sA, () => {
        const n = 8;
        const L = w * 0.08, R = w * 0.92;
        const step = (R - L) / n;
        const y = h * 0.3;
        const cur = Math.floor((s.since('left') * 1.6) % n);
        for (let i = 0; i < n; i++) {
          const x = L + step * (i + 0.5);
          const on = i === cur;
          s.rrect(x - u * 3.2, y - u * 3.2, u * 6.4, u * 6.4, 0.8, { fill: s.tint('green', on ? 0.6 : 0.12), stroke: s.c('green'), lw: on ? 0.5 : 0.2 });
          s.text(String(i + 1), x, y + u * 0.2, { size: 3, font: 'mono', weight: 600, color: s.c('--ink') });
          if (i > 0) s.arrow(x - step + u * 3.4, y, x - u * 3.4, y, s.tint('--ink-3', 0.7), 0.25, 1.3);
        }
        s.text('each step waits for the last', w / 2, y - u * 8, { size: 3.4, font: 'ui', weight: 600, color: s.c('--ink-2') });
        // a GPU's cores, nearly all idle
        const g = 12, rows = 4;
        const cs = Math.min((w * 0.7) / g, u * 4);
        const gx = w / 2 - (g * cs) / 2, gy = h * 0.55;
        for (let r = 0; r < rows; r++) for (let c = 0; c < g; c++) s.rrect(gx + c * cs, gy + r * cs, cs - u * 0.5, cs - u * 0.5, 0.3, { fill: s.tint(r === 0 && c === cur ? 'gold' : '--ink-3', r === 0 && c === cur ? 0.9 : 0.15) });
        s.text('a GPU: thousands of cores, one busy', w / 2, gy + rows * cs + u * 4, { size: fit(s, 'a GPU: thousands of cores, one busy', w * 0.9, 3.2, 'serif'), italic: true, color: s.c('--ink-2') });
      });

    // Self-attention: every word to every word, all at once.
    const aA = s.ease('self', 0.6);
    if (aA > 0)
      s.alpha(aA, () => {
        const ws = ['the', 'black', 'cat', 'sees', 'a', 'dog'];
        const L = w * 0.1, R = w * 0.9;
        const step = (R - L) / (ws.length - 1);
        const y = h * 0.5;
        for (let i = 0; i < ws.length; i++)
          for (let j = i + 1; j < ws.length; j++) curve(s, L + step * i, y - u * 3, L + step * j, y - u * 3, -(j - i) * u * 3, s.tint('teal', 0.55), 0.3, clamp01(s.since('self') / 1.2));
        ws.forEach((wd, i) => chip(s, wd, L + step * i, y, 'orange', { size: Math.min(3.6, fit(s, 'black', step - u * 4, 3.6, 'mono', 600)) }));
        s.text('self-attention: every word looks at every word', w / 2, h * 0.68, { size: fit(s, 'self-attention: every word looks at every word', w * 0.9, 3.4, 'ui', 600), font: 'ui', weight: 600, color: s.c('teal') });
        s.alpha(s.ease('drop', 0.6), () => {
          const t = 'no recurrence: the Transformer, next chapter';
          s.text(t, w / 2, h * 0.8, { size: fit(s, t, w * 0.9, 4, 'display', 600), font: 'display', weight: 600, color: s.c('--accent') });
        });
      });
  },
};

/* ------------------------------------------------------------------ 12. recap */

const RECAP: [string, string, K][] = [
  ['encoder → c → decoder', 'read it all, then write', 'green'],
  ['the bottleneck', 'one c: a cliff with length', 'red'],
  ['attention', 'score, softmax, weighted sum', 'teal'],
  ['a soft lookup', 'query, keys, values', 'blue'],
  ['soft is learnable', 'gradient αᵢ(vᵢ − c)', 'gold'],
  ['softmax(QKᵀ)V', 'every score in one matmul', 'purple'],
];

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cols = s.tall ? 2 : 3;
    const rows = Math.ceil(RECAP.length / cols);
    const gap = u * 2.5;
    const tw = (w * 0.92 - gap * (cols - 1)) / cols;
    const th = Math.min((h * 0.66 - gap * (rows - 1)) / rows, tw * 0.55);
    const x0 = w * 0.04, y0 = h * 0.14 + Math.max(0, (h * 0.72 - rows * th - (rows - 1) * gap) / 2);
    const fade = 1 - s.ease('next', 0.6);
    const beats = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
    s.alpha(fade, () =>
      RECAP.forEach(([a, b, k], i) => {
        const ap = s.ease(beats[i]!, 0.5);
        if (ap <= 0) return;
        const x = x0 + (i % cols) * (tw + gap);
        const y = y0 + Math.floor(i / cols) * (th + gap);
        const on = s.since(beats[i]!) >= 0 && (i === beats.length - 1 || s.since(beats[i + 1]!) < 0) ? 1 : 0;
        s.alpha(ap, () => {
          s.rrect(x, y, tw, th, 2, { fill: s.tint(k, 0.08 + 0.14 * on), stroke: s.tint(k, 0.4 + 0.6 * on), lw: 0.3 + 0.2 * on });
          s.text(a, x + tw / 2, y + th * 0.4, { size: fit(s, a, tw * 0.88, 4, 'ui', 650), font: 'ui', weight: 650, color: s.c(k) });
          s.text(b, x + tw / 2, y + th * 0.68, { size: fit(s, b, tw * 0.88, 3, 'serif'), italic: true, color: s.c('--ink-2') });
        });
      }),
    );
    const nA = s.ease('next', 0.7, 0.3);
    s.alpha(nA, () => {
      const t = 'next: the interactive chapter';
      s.text(t, w / 2, h * 0.42, { size: fit(s, t, w * 0.9, 6.4, 'display', 600), font: 'display', weight: 600 });
      const sub = 'four live translators, an alignment matrix, a query to drag';
      s.text(sub, w / 2, h * 0.55, { size: fit(s, sub, w * 0.9, 3.8, 'serif'), italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('bye', 0.6), () => s.text('see you there', w / 2, h * 0.7, { size: 4.6, font: 'display', italic: true, color: s.c('--accent') }));
    });
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  encdec,
  chain,
  bottleneck,
  cliff,
  attention,
  alignment,
  lookup,
  soft,
  scores,
  costs,
  outro,
};
