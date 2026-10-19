import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { CAPTION, LSTM_SEQ, LSTM_STORE, LSTM_VALS, STEPS, VANISH, catImage } from './data';
import { type K, Frame, area, bars, bend, fitSize, glyph, node, pill, pillWidth } from './kit';
import { INSIDE } from './samples';

/** Characters in cells shaded by a per-character value in [-1, 1], wrapped to fit `w`. */
function shadedText(s: Scene, text: string, vals: number[], x: number, y: number, w: number, o: { pos?: K; neg?: K; a?: number; size?: number } = {}): number {
  const u = s.u;
  const cw = Math.max(u * 4.2, Math.min(u * 6.5, w / 16));
  const cols = Math.floor(w / cw);
  const ch = cw * 1.25;
  let col = 0;
  let row = 0;
  [...text].forEach((c, i) => {
    if (col >= cols) {
      col = 0;
      row++;
    }
    const v = vals[i] ?? 0;
    const m = clamp01(Math.abs(v));
    const xx = x + col * cw;
    const yy = y + row * ch;
    s.rrect(xx + cw * 0.04, yy, cw * 0.92, ch * 0.9, 0.5, { fill: v >= 0 ? s.tint(o.pos ?? 'green', 0.06 + 0.6 * m) : s.tint(o.neg ?? 'purple', 0.06 + 0.5 * m) });
    s.text(glyph(c), xx + cw / 2, yy + ch * 0.47, { size: o.size ?? Math.min(3.6, (cw / u) * 0.62), font: 'mono', weight: 550 });
    col++;
    if (c === '\n') {
      col = 0;
      row++;
    }
  });
  return (row + 1) * ch;
}

function cat(s: Scene, x: number, y: number, size: number): void {
  const img = catImage(s);
  if (img) {
    const c = s.ctx;
    c.save();
    c.imageSmoothingEnabled = false;
    c.drawImage(img, x, y, size, size);
    c.restore();
    s.rrect(x, y, size, size, 0.6, { stroke: s.c('--rule'), lw: 0.3 });
  } else s.rrect(x, y, size, size, 0.6, { fill: s.tint('--ink-3', 0.15) });
}

// ---------------------------------------------------------------- learns

const CARDS: [string, string, string, Color][] = [
  ['Shakespeare', '4.4 MB', 'speaker names, archaic speeches', 'purple'],
  ['Wikipedia', '100 MB', 'headings, links, invented URLs', 'blue'],
  ['LaTeX book', 'algebraic geometry', 'proofs that nearly compile', 'teal'],
  ['Linux kernel', '474 MB of C', 'balanced braces, comments', 'orange'],
];

/** Sketch values: on from an opening quote to the closing one. */
function quoteVals(t: string): number[] {
  let on = false;
  return [...t].map((c) => {
    if (c === '"') {
      on = !on;
      return 0.9;
    }
    return on ? 0.85 : -0.15;
  });
}

/** Sketch values: rising along each line, reset at every newline. */
function lineVals(t: string): number[] {
  let k = 0;
  return [...t].map((c) => {
    const v = -0.8 + k * 0.09;
    k = c === '\n' ? 0 : k + 1;
    return v;
  });
}

const QUOTE = 'He cried "Speak, speak!" and they did.';
const LINES = 'You are all\nresolved rather\nto die than to\nfamish?';

const learns: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cA = 1 - s.ease('watch', 0.6);
    if (cA > 0) {
      s.alpha(cA, () => {
        s.text('char-rnn: stacked LSTMs, hundreds of units', w / 2, h * 0.1, { size: 3.6, italic: true, color: s.c('--ink-2') });
        const [rx, ry, rw, rh] = area(s, 0.17, 5);
        const gap = u * 3;
        const tw = (rw - gap) / 2;
        const th = (rh - gap) / 2;
        const wikiHalf = s.ease('wiki', 0.5, (s.end('wiki') - s.at('wiki')) * 0.5);
        const lit = [s.win('shakes', 'wiki'), s.win('wiki', 'linux') * (1 - wikiHalf), wikiHalf * (1 - s.ease('linux', 0.5)), s.win('linux', 'watch')];
        const desc = [s.ease('shakes', 0.5), s.ease('wiki', 0.5), wikiHalf, s.ease('linux', 0.5)];
        CARDS.forEach(([t1, t2, t3, k], i) => {
          const x = rx + (i % 2) * (tw + gap);
          const y = ry + Math.floor(i / 2) * (th + gap);
          const on = lit[i]!;
          s.alpha(s.ease('scale', 0.5, 0.3 + i * 0.25), () => {
            s.rrect(x, y, tw, th, 2.2, { fill: s.tint(k, 0.06 + 0.2 * on), stroke: s.tint(k, 0.35 + 0.65 * on), lw: 0.3 + 0.3 * on });
            const fs = Math.min(4.6, (tw / u) * 0.1);
            s.text(t1, x + tw / 2, y + th * 0.28, { size: fs, font: 'display', weight: 600 });
            s.text(t2, x + tw / 2, y + th * 0.5, { size: fs * 0.72, font: 'mono', color: s.c(k) });
            s.alpha(desc[i]!, () => s.text(t3, x + tw / 2, y + th * 0.74, { size: Math.min(3.3, (tw / u) * 0.068), italic: true, color: s.c('--ink-2') }));
          });
        });
      });
    }
    const tA = s.ease('watch', 0.6);
    if (tA > 0) {
      s.alpha(tA, () => {
        const [rx, , rw] = area(s, 0, 6);
        const label = (t: string, y: number) => s.text(t, rx, y, { size: 3.2, font: 'mono', color: s.c('--ink-3'), align: 'left' });
        const phase = (id: string, next?: string) => s.ease(id, 0.5) * (next ? 1 - s.ease(next, 0.4) : 1);
        s.alpha(phase('watch', 'quote'), () => {
          label('one cell of our small model, as it reads:', h * 0.2);
          shadedText(s, INSIDE.text, INSIDE.other, rx, h * 0.26, rw);
          s.text('a jumble', w / 2, h * 0.86, { size: 3.8, italic: true, color: s.c('--ink-2') });
        });
        s.alpha(phase('quote', 'more'), () => {
          label('sketch: a quote cell', h * 0.25);
          shadedText(s, QUOTE, quoteVals(QUOTE), rx, h * 0.31, rw, { pos: 'blue', neg: 'slate' });
          s.text('on inside the quotes, off outside', w / 2, h * 0.75, { size: 3.8, italic: true, color: s.c('--ink-2') });
        });
        s.alpha(phase('more', 'ours'), () => {
          label('sketch: a line-length cell', h * 0.12);
          const used = shadedText(s, LINES, lineVals(LINES), rx, h * 0.18, rw, { pos: 'gold', neg: 'slate' });
          const cy = h * 0.18 + used + u * 7;
          label('sketch: an if-condition cell', cy - u * 4);
          const code = 'if (x > 0) y++;';
          const vals = [...code].map((_, i) => (i >= 3 && i <= 9 ? 0.85 : -0.15));
          shadedText(s, code, vals, rx, cy + u * 1.5, rw, { pos: 'teal', neg: 'slate' });
        });
        s.alpha(phase('ours'), () => {
          label('unit 28 of our small model (r = 0.57 with spaces):', h * 0.2);
          shadedText(s, INSIDE.text, INSIDE.space, rx, h * 0.26, rw);
          s.text('green: positive · purple: negative', w / 2, h * 0.86, { size: 3.3, font: 'mono', color: s.c('--ink-3') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- captioning

const captioning: SceneDef = {
  marks: {
    cap: { tex: String.raw`\symh_t = \tanh\big(\symWhh\,\symh_{t-1} + \symWxh\,\symx_t + W_{ih}\,v\big)`, x: 0.5, y: 0.45, size: 4.3 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Top row: image -> ConvNet -> v -> RNN.
    const topA = 1 - s.ease('coco', 0.6) + s.ease('glance', 0.6);
    const ty = h * 0.2;
    const isz = Math.min(h * 0.24, w * 0.18);
    const ix = w * 0.05;
    const cnnX = ix + isz + w * 0.06;
    const cnnW = Math.min(w * 0.2, u * 24);
    const vX = cnnX + cnnW + w * 0.1;
    const rX = Math.min(w * 0.82, vX + w * 0.2);
    s.alpha(clamp01(topA), () => {
      cat(s, ix, ty - isz / 2, isz);
      const cnnOn = s.win('cnn', 'v');
      s.arrow(ix + isz + u, ty, cnnX - u, ty, s.c('--ink-3'), 0.4);
      s.rrect(cnnX, ty - isz * 0.35, cnnW, isz * 0.7, 1.6, { fill: s.tint('blue', 0.1 + 0.15 * cnnOn), stroke: cnnOn > 0.05 ? s.c('--accent') : s.c('blue'), lw: 0.35 + 0.3 * cnnOn });
      s.text('ConvNet', cnnX + cnnW / 2, ty, { size: Math.min(3.8, (cnnW / u) * 0.18), weight: 650, color: s.c('blue') });
      // its last layer, cut off
      s.alpha(s.win('cnn', 'v', 0.4), () => {
        const lx = cnnX + cnnW + u * 2;
        for (let i = 0; i < 6; i++) s.rrect(lx + i * u * 1.6, ty + isz * 0.3 - u * (2 + 3 * Math.abs(Math.sin(i * 1.9))), u * 1.1, u * (2 + 3 * Math.abs(Math.sin(i * 1.9))), 0.2, { fill: s.tint('purple', 0.6) });
        s.text('1000 scores', lx + u * 4.5, ty + isz * 0.3 + u * 3.5, { size: 3, font: 'mono', color: s.c('--ink-3') });
        const cut = s.ease('cnn', 0.5, (s.end('cnn') - s.at('cnn')) * 0.75);
        s.alpha(cut, () => {
          s.line(lx - u, ty - isz * 0.1, lx + u * 10, ty + isz * 0.45, s.c('red'), 0.5);
          s.line(lx + u * 10, ty - isz * 0.1, lx - u, ty + isz * 0.45, s.c('red'), 0.5);
        });
      });
      // the feature vector v
      const vA = s.ease('v', 0.6, 0.5);
      s.alpha(vA, () => {
        s.arrow(cnnX + cnnW + u, ty - isz * 0.25, vX - u * 3, ty - isz * 0.25, s.c('--ink-3'), 0.4);
        for (let i = 0; i < 10; i++) {
          const v = Math.abs(Math.sin(i * 2.1 + 0.4));
          s.rrect(vX - u * 2.2, ty - isz * 0.42 + i * u * 1.6, u * 4.4, u * 1.3, 0.2, { fill: s.tint('slate', 0.15 + 0.6 * v) });
        }
        s.text('v', vX, ty - isz * 0.42 - u * 3, { size: 4.4, font: 'serif', italic: true, weight: 600 });
        s.text('4096', vX, ty - isz * 0.42 + u * 18.5, { size: 3, font: 'mono', color: s.c('--ink-3') });
      });
      s.alpha(s.ease('halves', 0.6), () => {
        node(s, rX, ty, Math.min(u * 11, isz * 0.6), 'h', 'green');
        s.text('RNN', rX, ty + isz * 0.3 + u * 3.5, { size: 3.3, weight: 650, color: s.c('green') });
        s.alpha(1 - s.ease('v', 0.5), () => s.arrow(cnnX + cnnW + u, ty, rX - u * 7, ty, s.tint('--ink-3', 0.6), 0.4));
        s.alpha(s.ease('v', 0.5, 1), () => s.arrow(vX + u * 3, ty - isz * 0.1, rX - u * 6.5, ty, s.c('slate'), 0.45));
      });
      s.alpha(s.win('halves', 'cnn'), () => {
        s.text('image → vector', (ix + cnnX + cnnW) / 2, ty + isz / 2 + u * 5, { size: 3.4, italic: true, color: s.c('blue') });
        s.text('vector → sentence', rX - u * 2, ty + isz / 2 + u * 5, { size: 3.4, italic: true, color: s.c('green') });
      });
    });
    // The recurrence with the image term, and the words.
    const chainA = s.ease('cond', 0.6) * (1 - s.ease('coco', 0.6));
    if (chainA > 0) {
      s.alpha(chainA, () => {
        s.show('cap', chainA * (1 - s.ease('start', 0.5)));
        const hA = 1 - s.ease('start', 0.5);
        const n = 4;
        const xs = Array.from({ length: n }, (_, i) => w * (0.14 + 0.24 * i));
        const yh = h * 0.68;
        const ns = Math.min(u * 9, h * 0.09);
        const a3 = s.ease('cond', 0.6, (s.end('cond') - s.at('cond')) * 0.6);
        xs.forEach((x, i) => {
          node(s, x, yh, ns, 'h', 'green', { a: hA });
          if (i) s.alpha(hA, () => s.arrow(xs[i - 1]! + ns / 2 + u * 0.5, yh, x - ns / 2 - u * 0.5, yh, s.c('green'), 0.35));
          // v into every step, or (Assignment 3) into the first one only
          const vA = i === 0 ? 1 : 1 - a3;
          s.alpha(vA * (1 - s.ease('start', 0.5)), () => {
            s.line(x - ns * 0.25, yh - ns / 2 - u * 0.4, x - ns * 0.25, h * 0.54, s.tint('slate', 0.8), 0.3, [0.8, 0.6]);
            s.text('v', x - ns * 0.25 - u * 1.8, h * 0.56, { size: 3.2, font: 'serif', italic: true, color: s.c('slate'), align: 'right' });
          });
        });
        s.alpha(a3 * (1 - s.ease('start', 0.5)), () => s.text('Assignment 3: v sets the first h', w / 2, h * 0.88, { size: 3.4, italic: true, color: s.c('--ink-2') }));
        // the sampling loop over words
        const sA = s.ease('start', 0.6);
        if (sA > 0) {
          s.alpha(sA, () => {
            const p = s.since('sample') >= 0 ? clamp01(s.prog('sample') * 1.1) : 0;
            const k = s.since('sample') >= 0 ? Math.min(CAPTION.length - 1, Math.floor(p * CAPTION.length)) : 0;
            const done = s.since('sample') >= 0 ? k + (p * CAPTION.length - k > 0.55 ? 1 : 0) : 0;
            // words written so far, as chips
            const words = ['<START>', ...CAPTION.slice(0, done).map((c) => c.pick)];
            let x = w * 0.06;
            let y = h * 0.44;
            words.forEach((wd, i) => {
              const pw = pillWidth(s, wd, 3.4);
              if (x + pw > w * 0.95) {
                x = w * 0.06;
                y += u * 6.5;
              }
              const tok = wd.startsWith('<');
              pill(s, wd, x, y, tok ? 'slate' : 'purple', { size: 3.4, align: 'left', on: i === words.length - 1 && i > 0 ? 1 : 0 });
              x += pw + u * 1.2;
            });
            // next-word probabilities at this step
            const st = CAPTION[Math.min(k, CAPTION.length - 1)]!;
            const rows = st.dist.slice(0, 3).map(([wd, pr]) => ({ label: wd, p: pr, on: wd === st.pick && done > k ? 1 : 0 }));
            const rowH = Math.min(h * 0.075, u * 7);
            bars(s, w * 0.06, h * 0.64, w * 0.88, rowH, rows, 'purple', { size: 3.3, labelW: u * 20 });
            s.text(`next word, after "${st.input}"`, w * 0.06, h * 0.6, { size: 3.1, font: 'mono', color: s.c('--ink-3'), align: 'left' });
            s.alpha(s.ease('sample', 0.5), () => s.text('toy probabilities, not a trained net', w * 0.94, h * 0.955, { size: 3, italic: true, color: s.c('--ink-3'), align: 'right' }));
          });
        }
      });
    }
    // COCO, results and failures.
    const cA = s.win('coco', 'glance');
    if (cA > 0) {
      s.alpha(cA, () => {
        s.alpha(s.win('coco', 'good'), () => {
          const sz = Math.min(h * 0.32, w * 0.3);
          const x = w * 0.08;
          const y = h * 0.3;
          cat(s, x, y, sz);
          for (let i = 0; i < 5; i++) {
            const ly = y + sz * (0.1 + 0.2 * i);
            s.text(`caption ${i + 1}`, x + sz + u * 4, ly, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'left' });
            s.line(x + sz + u * 20, ly, x + sz + u * 20 + (w - x - sz - u * 26) * (0.6 + 0.35 * Math.abs(Math.sin(i * 1.7))), ly, s.tint('--ink-3', 0.35), 0.6);
          }
          s.text('Microsoft COCO', w / 2, h * 0.13, { size: 5.4, font: 'display', weight: 600 });
          s.text('~120,000 images · ~5 human captions each', w / 2, h * 0.21, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
        });
        s.alpha(s.ease('good', 0.6), () => {
          const y1 = h * 0.36;
          const y2 = h * 0.66;
          s.text('often startlingly good', w / 2, y1 - u * 7, { size: 3.6, italic: true, color: s.c('--ink-2') });
          pill(s, 'a surfer riding a wave', w / 2, y1, 'green', { size: 4 });
          s.alpha(s.ease('good', 0.6, (s.end('good') - s.at('good')) * 0.45), () => {
            s.text('and confidently wrong', w / 2, y2 - u * 7, { size: 3.6, italic: true, color: s.c('--ink-2') });
            const t = 'a man throwing a frisbee in a park';
            const pw = pill(s, t, w / 2, y2, 'red', { size: 3.6 });
            const pre = s.measure('a man throwing a ', { size: 3.6, font: 'ui', weight: 600 });
            const fw = s.measure('frisbee', { size: 3.6, font: 'ui', weight: 600 });
            const x0 = w / 2 - pw / 2 + s.u * 3.6 * 0.475 + pre;
            s.line(x0, y2, x0 + fw, y2, s.c('red'), 0.45);
            s.text('no frisbee in the photo', w / 2, y2 + u * 7, { size: 3.2, font: 'mono', color: s.c('red') });
          });
        });
      });
    }
    // One glance, then attention.
    s.alpha(s.ease('glance', 0.6), () => {
      s.text('one look at the image, through one vector', w / 2, h * 0.55, { size: 3.8, italic: true, color: s.c('--ink-2') });
      pill(s, 'next chapter: attention, a fresh look for every word', w / 2, h * 0.72, 'teal', { size: 3.2 });
    });
  },
};

// ---------------------------------------------------------------- vanishing

const vanishing: SceneDef = {
  marks: {
    prod: { tex: String.raw`\frac{\partial \symL}{\partial \symh_{t-k}} = \big(\symWhh^{\!\top} D_{t-k+1}\big)\cdots\big(\symWhh^{\!\top} D_t\big)\,\frac{\partial \symL}{\partial \symh_t}`, x: 0.5, y: 0.82, size: 4 },
  },
  draw(s) {
    const { w, h, u } = s;
    // A gradient packet travelling back along the chain, shrinking.
    const chA = 1 - s.ease('numbers', 0.6);
    if (chA > 0) {
      s.alpha(chA, () => {
        const n = 7;
        const xs = Array.from({ length: n }, (_, i) => w * (0.08 + (0.84 * i) / (n - 1)));
        const y = h * 0.5;
        const ns = Math.min(u * 9, w * 0.09);
        xs.forEach((x, i) => {
          node(s, x, y, ns, 'h', 'green');
          if (i) s.arrow(xs[i - 1]! + ns / 2 + u * 0.4, y, x - ns / 2 - u * 0.4, y, s.tint('green', 0.6), 0.3);
        });
        s.alpha(s.win('principle', 'loop'), () => {
          bend(s, xs[n - 1]!, y - ns / 2 - u, w / 2, y - h * 0.3, xs[0]!, y - ns / 2 - u, s.c('--accent'), 0.4, [1, 0.8]);
          s.text('needed many steps later', w / 2, y - h * 0.19, { size: 3.4, font: 'mono', color: s.c('--accent'), halo: true });
        });
        s.alpha(s.ease('loop', 0.5), () => {
          const p = clamp01(s.prog('loop') * 1.2);
          const pos = (n - 1) * (1 - p);
          const k = Math.floor(n - 1 - pos);
          for (let i = 0; i < n - 1; i++) {
            const mx = (xs[i]! + xs[i + 1]!) / 2;
            s.text('×', mx, y + u * 5.5, { size: 3.4, font: 'mono', color: s.c('blue') });
          }
          s.text('× tanh′ × Whh.T, at every step back', w / 2, y + u * 11, { size: 3.2, font: 'mono', color: s.c('blue') });
          const gx = lerp(xs[0]!, xs[n - 1]!, pos / (n - 1));
          const r = u * 3.2 * Math.pow(0.72, k);
          s.circle(gx, y - ns * 0.95, Math.max(u * 0.4, r), { fill: s.c('teal') });
          s.text('gradient', gx, y - ns * 0.95 - u * 5, { size: 3, font: 'mono', color: s.c('teal') });
        });
        s.show('prod', chA * s.ease('loop', 0.6, 1.5));
      });
    }
    // Plain numbers, then matrices, on a log scale.
    const pA = s.ease('numbers', 0.6) * (1 - s.ease('clip', 0.6)) + s.ease('arch', 0.6);
    if (pA > 0) {
      s.alpha(clamp01(pA), () => {
        const fr = new Frame(s, [w * 0.15, h * 0.1, w * 0.78, h * 0.76], [0, STEPS, -8, 4.5]);
        fr.axes(1, 10, 4);
        for (const e of [-8, -4, 0, 4]) s.text(e === 0 ? '1' : `10^${e}`, fr.X(0) - u, fr.Y(e), { size: 2.9, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        s.text('steps back →', fr.X(STEPS), fr.Y(-8) + u * 3.4, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        const ks = Array.from({ length: STEPS + 1 }, (_, k) => k);
        const lab = (t: string, x: number, y: number, k: K, align: CanvasTextAlign = 'right') => s.text(t, x, y, { size: 3.2, font: 'mono', color: s.c(k), align, halo: true });
        // plain numbers
        const nA = s.win('numbers', 'sigma');
        s.alpha(nA, () => {
          const g = s.ease('numbers', 2, 0.3);
          const g2 = s.ease('numbers', 2, (s.end('numbers') - s.at('numbers')) * 0.5);
          const k1 = Math.round(STEPS * g);
          const k2 = Math.round(STEPS * g2);
          fr.path(ks.slice(0, k1 + 1), ks.slice(0, k1 + 1).map((k) => k * Math.log10(1.1)), s.c('red'), 0.6);
          if (g > 0.02) lab(`1.1^${k1} = ${Math.pow(1.1, k1).toFixed(k1 > 30 ? 0 : 2)}`, fr.X(k1) - u, fr.Y(k1 * Math.log10(1.1)) - u * 3.5, 'red');
          fr.path(ks.slice(0, k2 + 1), ks.slice(0, k2 + 1).map((k) => k * Math.log10(0.9)), s.c('teal'), 0.6);
          if (g2 > 0.02) lab(`0.9^${k2} = ${Math.pow(0.9, k2).toFixed(3)}`, fr.X(k2) - u, fr.Y(k2 * Math.log10(0.9)) + u * 4, 'teal');
        });
        // gradient norms through Whh = sigma x a rotation
        const mA = s.ease('sigma', 0.6);
        s.alpha(mA, () => {
          s.text('|gradient| through Whh = σ × a rotation', fr.X(STEPS / 2), fr.Y(4.5) - u * 2.5, { size: 3, font: 'mono', color: s.c('--ink-3') });
          const grow = (id: string) => ks.slice(0, 1 + Math.round(STEPS * s.ease(id, 1.6, 0.4)));
          const k10 = grow('sigma');
          fr.path(k10, k10.map((k) => VANISH.lin10[k]!), s.c('slate'), 0.5, [1.2, 1]);
          s.alpha(s.ease('sigma', 0.5, 1.6), () => lab('σ = 1', fr.X(STEPS), fr.Y(0) - u * 3, 'slate'));
          const k12 = grow('explode');
          fr.path(k12, k12.map((k) => VANISH.lin12[k]!), s.c('red'), 0.6);
          s.alpha(s.ease('explode', 0.5, 1.6), () => lab('σ = 1.2: explodes', fr.X(STEPS) - u * 2, fr.Y(VANISH.lin12[STEPS]!) + u * 0.5, 'red'));
          const k09 = grow('vanish');
          fr.path(k09, k09.map((k) => VANISH.lin09[k]!), s.c('teal'), 0.5, [1.2, 1]);
          s.alpha(s.ease('vanish', 0.5, 1.6), () => lab('σ = 0.9', fr.X(STEPS), fr.Y(VANISH.lin09[STEPS]!) - u * 3, 'teal'));
          const kt = ks.slice(0, 1 + Math.round(STEPS * s.ease('vanish', 1.6, 2.2)));
          fr.path(kt, kt.map((k) => VANISH.tanh09[k]!), s.c('teal'), 0.7);
          s.alpha(s.ease('vanish', 0.5, 3.6), () => lab('σ = 0.9, with tanh: vanishes', fr.X(STEPS) - u * 2, fr.Y(VANISH.tanh09[STEPS]!) - u * 3.5, 'teal'));
        });
        s.alpha(s.ease('arch', 0.6, 0.6), () => pill(s, 'need: no matrix multiply', fr.X(1), fr.Y(3.3), 'gold', { size: 3.4, align: 'left' }));
      });
    }
    // Clipping.
    const cA = s.win('clip', 'arch');
    if (cA > 0) {
      s.alpha(cA, () => {
        const p = s.prog('clip');
        const cx = w * 0.3;
        const cy = h * 0.55;
        const R = Math.min(w * 0.18, h * 0.24);
        s.ctx.setLineDash([u, u * 0.8]);
        s.circle(cx, cy, R, { stroke: s.tint('--ink-3', 0.7), lw: 0.3 });
        s.ctx.setLineDash([]);
        s.text('size 5', cx, cy + R + u * 4, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        const ang = -0.6;
        const L = lerp(R * 2.4, R, smooth((p - 0.15) / 0.3));
        s.alpha(1 - smooth((p - 0.15) / 0.3) * 0.6, () => s.arrow(cx, cy, cx + Math.cos(ang) * R * 2.4, cy + Math.sin(ang) * R * 2.4, s.tint('red', 0.5), 0.4));
        s.arrow(cx, cy, cx + Math.cos(ang) * L, cy + Math.sin(ang) * L, s.c('teal'), 0.6);
        s.text('scaled down, same direction', cx, h * 0.13, { size: 3.4, italic: true, color: s.c('--ink-2') });
        // element-wise clipping, as in the script
        s.alpha(smooth((p - 0.6) * 5), () => {
          const bx = w * 0.62;
          const bw = w * 0.32;
          const vals = [2, -7, 4, 9, -3, -6];
          const by = h * 0.25;
          const rh = h * 0.09;
          const k = bw / 2 / 9;
          const mid = bx + bw / 2;
          s.text('each entry clipped to ±5', mid, h * 0.13, { size: 3.4, italic: true, color: s.c('--ink-2') });
          vals.forEach((v, i) => {
            const c = Math.max(-5, Math.min(5, v));
            const y = by + i * rh;
            s.rrect(Math.min(mid, mid + v * k), y + rh * 0.2, Math.abs(v) * k, rh * 0.6, 0.3, { fill: s.tint('red', 0.18) });
            s.rrect(Math.min(mid, mid + c * k), y + rh * 0.2, Math.abs(c) * k, rh * 0.6, 0.3, { fill: s.tint('teal', 0.7) });
          });
          for (const e of [-5, 5]) s.line(mid + e * k, by, mid + e * k, by + rh * vals.length, s.c('--ink-3'), 0.25, [0.8, 0.6]);
          s.line(mid, by, mid, by + rh * vals.length, s.c('--axis'), 0.25);
        });
      });
    }
  },
};

// ---------------------------------------------------------------- lstm

interface CellLayout {
  yc: number;
  xf: number;
  xp: number;
  yig: number;
  xo: number;
  yth: number;
  yom: number;
  gy: number;
  gh: number;
  gw: number;
  gx: Record<'f' | 'i' | 'g' | 'o', number>;
  busY: number;
}

function cellLayout(s: Scene, top: number, bottom: number): CellLayout {
  const { w } = s;
  const H = bottom - top;
  return {
    yc: top + H * 0.08,
    xf: w * 0.3,
    xp: w * 0.52,
    yig: top + H * 0.3,
    xo: w * 0.86,
    yth: top + H * 0.28,
    yom: top + H * 0.46,
    gy: top + H * 0.56,
    gh: H * 0.26,
    gw: Math.min(w * 0.12, s.u * 13),
    gx: { f: w * 0.3, i: w * 0.45, g: w * 0.6, o: w * 0.75 },
    busY: top + H * 0.97,
  };
}

/** The LSTM cell at one step: cell line, gates as bars, the output path. */
function drawCell(s: Scene, L: CellLayout, st: { i: number; f: number; o: number; g: number; c: number; h: number; cp: number }, on: { cell: number; gates: Record<string, number>; out: number; bus: number }, showC: number, showH: number): void {
  const { w, u } = s;
  const ink3 = s.c('--ink-3');
  const acc = s.c('--accent');
  const wire = (pts: [number, number][], a: number) => {
    const c = s.ctx;
    c.beginPath();
    pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = a > 0.05 ? acc : s.tint('--ink-3', 0.8);
    c.lineWidth = u * (0.3 + 0.25 * a);
    c.stroke();
  };
  const op = (x: number, y: number, sym: string, a: number) => {
    s.circle(x, y, u * 2.6, { fill: s.c('--card'), stroke: a > 0.05 ? acc : ink3, lw: 0.3 + 0.3 * a });
    s.text(sym, x, y + u * 0.2, { size: 3.8, weight: 600, color: a > 0.05 ? acc : s.c('--ink-2') });
  };
  // cell line
  s.line(w * 0.1, L.yc, w * 0.9, L.yc, s.tint('gold', 0.65 + 0.35 * on.cell), 1 + 0.5 * on.cell);
  s.text('c', w * 0.05, L.yc - u * 3, { size: 4.4, font: 'serif', italic: true, weight: 600, color: s.c('gold') });
  s.text(st.cp.toFixed(2), w * 0.05, L.yc + u * 3.2, { size: 3, font: 'mono' });
  s.text('c', w * 0.95, L.yc - u * 3, { size: 4.4, font: 'serif', italic: true, weight: 600, color: s.c('gold') });
  s.alpha(showC, () => s.text(st.c.toFixed(2), w * 0.95, L.yc + u * 3.2, { size: 3, font: 'mono', weight: 650 }));
  // writes into the cell
  wire([[L.gx.f, L.gy], [L.xf, L.yc + u * 2.6]], on.cell);
  wire([[L.gx.i, L.gy], [L.gx.i, L.yig], [L.xp - u * 2.6, L.yig]], on.cell);
  wire([[L.gx.g, L.gy], [L.gx.g, L.yig], [L.xp + u * 2.6, L.yig]], on.cell);
  wire([[L.xp, L.yig - u * 2.6], [L.xp, L.yc + u * 2.6]], on.cell);
  // output path
  wire([[L.xo, L.yc], [L.xo, L.yth - u * 2.4]], on.out);
  wire([[L.xo, L.yth + u * 2.4], [L.xo, L.yom - u * 2.6]], on.out);
  wire([[L.gx.o, L.gy], [L.gx.o, L.yom], [L.xo - u * 2.6, L.yom]], on.out);
  s.rrect(L.xo - u * 4.4, L.yth - u * 2.4, u * 8.8, u * 4.8, 1, { fill: s.c('--card'), stroke: on.out > 0.05 ? acc : ink3, lw: 0.3 });
  s.text('tanh', L.xo, L.yth + u * 0.2, { size: 2.8, font: 'mono', color: s.c('--ink-2') });
  op(L.xf, L.yc, '×', on.cell);
  op(L.xp, L.yc, '+', on.cell);
  op(L.xp, L.yig, '×', on.cell);
  op(L.xo, L.yom, '×', on.out);
  s.arrow(L.xo + u * 2.6, L.yom, w * 0.95, L.yom, on.out > 0.05 ? acc : s.c('green'), 0.4);
  s.text('h', w * 0.95, L.yom - u * 3.6, { size: 4.4, font: 'serif', italic: true, weight: 600, color: s.c('green'), align: 'right' });
  s.alpha(showH, () => s.text(st.h.toFixed(2), w * 0.95, L.yom + u * 3.6, { size: 3, font: 'mono', weight: 650, align: 'right' }));
  // gates
  (['f', 'i', 'g', 'o'] as const).forEach((k) => {
    const v = st[k];
    const x0 = L.gx[k] - L.gw / 2;
    const a = on.gates[k] ?? 0;
    s.rrect(x0, L.gy, L.gw, L.gh, 1.2, { fill: s.c('--card'), stroke: a > 0.05 ? acc : s.tint('--ink-3', 0.9), lw: 0.3 + 0.3 * a });
    const inner = L.gh - u * 1.6;
    if (k === 'g') {
      const mid = L.gy + L.gh / 2;
      const bh = (Math.abs(v) * inner) / 2;
      s.rrect(x0 + u * 0.8, v >= 0 ? mid - bh : mid, L.gw - u * 1.6, Math.max(1, bh), 0.4, { fill: s.tint('orange', 0.5) });
    } else s.rrect(x0 + u * 0.8, L.gy + u * 0.8 + inner * (1 - v), L.gw - u * 1.6, Math.max(1, inner * v), 0.4, { fill: s.tint('teal', 0.45) });
    s.text(k, L.gx[k], L.gy + L.gh * 0.3, { size: 4, font: 'serif', italic: true, weight: 700, halo: true });
    s.text(v.toFixed(2), L.gx[k], L.gy + L.gh * 0.72, { size: 3, font: 'mono', weight: 600, halo: true });
  });
  // the input bus
  wire([[w * 0.22, L.busY], [L.gx.o, L.busY]], on.bus);
  (['f', 'i', 'g', 'o'] as const).forEach((k) => wire([[L.gx[k], L.busY], [L.gx[k], L.gy + L.gh]], on.bus));
  s.text('h, x', w * 0.2, L.busY, { size: 3.2, font: 'mono', color: s.c('--ink-2'), align: 'right' });
}

const lstm: SceneDef = {
  marks: {
    gates: { tex: String.raw`(i,\, f,\, o,\, g) = W\begin{bmatrix}\symh_{t-1}\\ \symx_t\end{bmatrix} + b`, x: 0.5, y: 0.88, size: 4 },
    cell: { tex: String.raw`\symc_t = f\odot\symc_{t-1} + i\odot g`, x: 0.5, y: 0.88, size: 4.6 },
    hid: { tex: String.raw`\symh_t = o\odot\tanh(\symc_t)`, x: 0.5, y: 0.88, size: 4.6 },
    hw: { tex: String.raw`\frac{\partial \symL}{\partial \symc_{t-1}} = f\odot\frac{\partial \symL}{\partial \symc_t}`, x: 0.5, y: 0.13, size: 4.4 },
    gru: { tex: String.raw`\symh_t = (1-z)\odot\symh_{t-1} + z\odot\tilde h`, x: 0.5, y: 0.36, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const aA = 1 - s.ease('highway', 0.6);
    if (aA > 0) {
      s.alpha(aA, () => {
        const strip = s.ease('store', 0.6);
        const L = cellLayout(s, h * 0.1, lerp(h * 0.78, h * 0.55, strip));
        let t = 0;
        if (s.since('hold') >= 0) t = 1 + Math.min(6, Math.floor(s.prog('hold') * 7));
        const st = LSTM_SEQ[t]!;
        const w01 = (a: string, b: string) => s.win(a, b, 0.4);
        const gatesOn = w01('gates', 'g');
        drawCell(
          s,
          L,
          st,
          {
            cell: Math.max(w01('two', 'gates'), w01('update', 'reveal')),
            gates: { i: Math.max(gatesOn, w01('store', 'highway')), f: Math.max(gatesOn, w01('store', 'highway')), o: gatesOn, g: Math.max(w01('one', 'g') * 0, w01('g', 'update')) },
            out: Math.max(w01('two', 'gates') * 0.6, w01('reveal', 'store')),
            bus: w01('one', 'g'),
          },
          s.since('update') >= 0 ? s.ease('update', 0.6, 1.5) : 0,
          s.since('reveal') >= 0 ? s.ease('reveal', 0.6, 1) : 0,
        );
        s.alpha(w01('two', 'gates'), () => {
          s.text('cell state: private', (L.xp + L.xo) / 2, L.yc - u * 3.4, { size: 3, font: 'mono', color: s.c('gold') });
          s.text('shown', w * 0.95, L.yom + u * 3.6, { size: 3, font: 'mono', color: s.c('green'), align: 'right' });
        });
        s.show('gates', aA * w01('one', 'g') * (1 - strip));
        s.show('cell', aA * w01('update', 'reveal'));
        s.show('hid', aA * w01('reveal', 'store'));
        // the store / hold example
        s.alpha(strip, () => {
          const n = LSTM_VALS.length;
          const [ax, , aw] = area(s, 0, 4);
          const cw = aw / n;
          const sy = h * 0.6;
          const sh = h * 0.11;
          for (let k = 0; k < n; k++) {
            const x = ax + k * cw;
            const now = k === t;
            s.rrect(x + u * 0.4, sy, cw - u * 0.8, sh, 1, { fill: now ? s.tint('--accent', 0.1) : undefined, stroke: now ? s.c('--accent') : s.tint('--ink-3', 0.4), lw: now ? 0.45 : 0.25 });
            s.text((LSTM_VALS[k]! > 0 ? '+' : '') + LSTM_VALS[k]!.toFixed(1), x + cw / 2, sy + sh * 0.3, { size: 3, font: 'mono', weight: 600, color: s.c('orange') });
            const on = LSTM_STORE[k] === 1;
            s.rrect(x + u * 1, sy + sh * 0.55, cw - u * 2, sh * 0.34, 3, { fill: on ? s.tint('purple', 0.7) : s.tint('--ink-3', 0.1) });
            s.text('store', x + cw / 2, sy + sh * 0.72, { size: 2.6, font: 'ui', weight: on ? 650 : 450, color: on ? '#fff' : s.c('--ink-3') });
          }
          // c over time
          const ty0 = sy + sh + u * 2;
          const ty1 = h - u * 3;
          const yOf = (v: number) => ty0 + ((1 - v) / 2) * (ty1 - ty0);
          s.line(ax, yOf(0), ax + aw, yOf(0), s.tint('--ink-3', 0.4), 0.2, [0.8, 0.6]);
          const c = s.ctx;
          c.beginPath();
          for (let k = 0; k <= t; k++) {
            const x = ax + (k + 0.5) * cw;
            if (k) c.lineTo(x, yOf(LSTM_SEQ[k]!.c));
            else c.moveTo(x, yOf(LSTM_SEQ[k]!.c));
          }
          c.strokeStyle = s.c('gold');
          c.lineWidth = u * 0.5;
          c.stroke();
          for (let k = 0; k <= t; k++) s.circle(ax + (k + 0.5) * cw, yOf(LSTM_SEQ[k]!.c), u * (k === t ? 1.1 : 0.7), { fill: s.c('gold') });
          s.text('c over time', ax + aw, ty0 + u * 1.5, { size: 2.8, font: 'mono', color: s.c('gold'), align: 'right' });
        });
      });
    }
    // The highway: gradient along the cell vs through a vanilla chain.
    const hA = s.ease('highway', 0.6) * (1 - s.ease('gru', 0.6));
    if (hA > 0) {
      s.alpha(hA, () => {
        s.show('hw', hA);
        const n = 5;
        const xs = Array.from({ length: n }, (_, i) => w * (0.12 + (0.76 * i) / (n - 1)));
        const yc = h * 0.38;
        const yv = h * 0.72;
        const p = clamp01(s.since('highway') / 3);
        s.text('LSTM cell: × f each step back', w / 2, yc - u * 8, { size: 3.3, font: 'mono', color: s.c('gold') });
        s.line(xs[0]! - u * 6, yc, xs[n - 1]! + u * 6, yc, s.c('gold'), 1.1);
        xs.forEach((x) => {
          s.circle(x, yc, u * 2.6, { fill: s.c('--card'), stroke: s.c('--ink-3'), lw: 0.3 });
          s.text('×f', x, yc + u * 0.2, { size: 2.8, font: 'mono', weight: 600, color: s.c('--ink-2') });
        });
        s.text('vanilla: × Whh.T × tanh′ each step back', w / 2, yv - u * 8, { size: 3.3, font: 'mono', color: s.c('blue') });
        const ns = Math.min(u * 8, w * 0.08);
        xs.forEach((x, i) => {
          node(s, x, yv, ns, 'h', 'green');
          if (i) s.arrow(xs[i - 1]! + ns / 2 + u * 0.4, yv, x - ns / 2 - u * 0.4, yv, s.tint('green', 0.6), 0.3);
        });
        // gradients flowing right to left: steady on the cell, shrinking in the chain
        const pos = (n - 1) * (1 - p);
        const gx = lerp(xs[0]!, xs[n - 1]!, pos / (n - 1));
        const k = Math.floor(n - 1 - pos);
        s.line(gx, yc + u * 4.2, xs[n - 1]!, yc + u * 4.2, s.c('teal'), 1.1);
        s.circle(gx, yc + u * 4.2, u * 1.4, { fill: s.c('teal') });
        const c = s.ctx;
        c.beginPath();
        for (let i = 0; i <= 40; i++) {
          const x = lerp(gx, xs[n - 1]!, i / 40);
          const kk = (xs[n - 1]! - x) / (xs[1]! - xs[0]!);
          const th = u * 1.6 * Math.pow(0.45, kk);
          if (i === 0) c.moveTo(x, yv + ns * 0.9 - th);
          else c.lineTo(x, yv + ns * 0.9 - th);
        }
        for (let i = 40; i >= 0; i--) {
          const x = lerp(gx, xs[n - 1]!, i / 40);
          const kk = (xs[n - 1]! - x) / (xs[1]! - xs[0]!);
          c.lineTo(x, yv + ns * 0.9 + u * 1.6 * Math.pow(0.45, kk));
        }
        c.fillStyle = s.c('teal');
        c.fill();
        s.alpha(s.ease('highway', 0.5, 3) * (k >= 0 ? 1 : 0), () => s.text('steady', xs[0]!, yc + u * 8.5, { size: 3, font: 'mono', color: s.c('teal'), align: 'left' }));
        s.alpha(s.ease('highway', 0.5, 3), () => s.text('fades', xs[0]!, yv + ns * 0.9 + u * 4.5, { size: 3, font: 'mono', color: s.c('teal'), align: 'left' }));
        s.alpha(s.ease('nomat', 0.6, 2.5), () => pill(s, 'an additive highway, like ResNet', w / 2, h * 0.92, 'gold', { size: 3.4 }));
      });
    }
    // GRU and the verdict.
    s.alpha(s.ease('gru', 0.6), () => {
      s.show('gru', s.ease('gru', 0.6));
      s.text('GRU: two gates, one state', w / 2, h * 0.18, { size: 4.4, font: 'display', weight: 600 });
      s.text('update gate z blends old and new', w / 2, h * 0.52, { size: 3.4, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('gru', 0.6, (s.end('gru') - s.at('gru')) * 0.45), () => {
        pill(s, 'LSTM', w * 0.38, h * 0.74, 'gold', { size: 4.2 });
        pill(s, 'GRU', w * 0.62, h * 0.74, 'teal', { size: 4.2 });
        s.text('thousands of variants: nothing clearly better', w / 2, h * 0.87, { size: 3.3, italic: true, color: s.c('--ink-2') });
      });
    });
  },
};

// ---------------------------------------------------------------- outro

const RECAP: [string, string, Color, string][] = [
  ['a loop with memory', 'h = f(h, x)', 'green', 'loop'],
  ['sample, feed back', 'it writes', 'purple', 'gen'],
  ['backprop through time', 'chunks, h carried', 'teal', 'bptt'],
  ['clip, and the LSTM', 'explode / forget', 'gold', 'forget'],
  ['ConvNet + RNN', 'captions', 'orange', 'cap'],
  ['next: attention', 'a fresh look per word', 'blue', 'next'],
];

const outro: SceneDef = {
  draw(s) {
    const { u } = s;
    const [rx, ry, rw, rh] = area(s, 0.08, 5);
    const cols = s.tall ? 2 : 3;
    const rows = Math.ceil(RECAP.length / cols);
    const gap = u * 2.6;
    const tw = (rw - gap * (cols - 1)) / cols;
    const th = Math.min((rh - gap * (rows - 1)) / rows, tw * 0.7);
    const oy = ry + (rh - th * rows - gap * (rows - 1)) / 2;
    const ids = RECAP.map((r) => r[3]);
    RECAP.forEach(([t1, t2, k, id], i) => {
      const x = rx + (i % cols) * (tw + gap);
      const y = oy + Math.floor(i / cols) * (th + gap);
      const next = ids[i + 1];
      const on = s.ease(id, 0.5) * (next ? 1 - s.ease(next, 0.5) : 1);
      const seen = s.since(id) >= 0 ? 1 : 0;
      s.alpha(s.ease('loop', 0.5, i * 0.12), () => {
        s.rrect(x, y, tw, th, 2.2, { fill: s.tint(k, 0.05 + 0.08 * seen + 0.15 * on), stroke: s.tint(k, 0.35 + 0.65 * on), lw: 0.3 + 0.3 * on });
        const fs = fitSize(s, t1, tw * 0.88, Math.min(4.6, (tw / u) * 0.1));
        s.text(t1, x + tw / 2, y + th * 0.42, { size: fs, font: 'display', weight: 560 });
        s.text(t2, x + tw / 2, y + th * 0.68, { size: Math.min(4.6, (tw / u) * 0.1) * 0.74, font: 'mono', color: s.c(k) });
      });
    });
  },
};

export const scenesC: Record<string, SceneDef> = { learns, captioning, vanishing, lstm, outro };
