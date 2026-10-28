import { Rng } from '../../../core/rand';
import type { Scene, SceneDef } from '../../../lecture/scene';
import { chip, ghost, note, rich, spread, type Ink } from '../draw';

const TOK = ['the', 'cat', 'sat', 'on', 'a', 'mat'];
const K = 2;
/** 30 of 200 positions, picked at random as a masker would. */
const HID = new Set(new Rng(7).shuffle(Array.from({ length: 200 }, (_, i) => i)).slice(0, 30));

/** An arc above the row from token j to token K. */
function arc(s: Scene, xs: number[], y: number, j: number, k: Ink, a: number, dash?: number[]): void {
  s.alpha(a, () => {
    const c = s.ctx;
    const x0 = xs[j]!;
    const x1 = xs[K]!;
    const top = y - (5 + 2.2 * Math.abs(j - K)) * s.u;
    c.beginPath();
    c.moveTo(x0, y);
    c.quadraticCurveTo((x0 + x1) / 2, top, x1, y);
    c.strokeStyle = s.c(k);
    c.lineWidth = 0.45 * s.u;
    c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
    c.stroke();
    c.setLineDash([]);
  });
}

/** A small loop above token K: a position reading itself. */
function selfLoop(s: Scene, x: number, y: number, k: Ink, a: number): void {
  s.alpha(a, () => {
    const c = s.ctx;
    const r = 2.6 * s.u;
    c.beginPath();
    c.arc(x, y - r, r, Math.PI * 0.62, Math.PI * 2.38);
    c.strokeStyle = s.c(k);
    c.lineWidth = 0.5 * s.u;
    c.stroke();
  });
}

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

const blank: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = spread(s, 6, s.tall ? 17 : 18);
    const y = s.h * 0.4;
    const top = y - 3.5 * u;
    const ty = s.h * 0.62;
    const causal = s.win('causal', 'peek');
    const peek = s.win('peek', 'mask');
    const m = s.ease('mask', 0.6, 1.2);
    // The slot: a blank, then the real token, then the mask token.
    TOK.forEach((t, i) => {
      if (i === K) {
        s.alpha(1 - s.ease('peek', 0.5), () => ghost(s, xs[i]!, y, '?', '--ink-3', 12, 7));
        s.alpha(peek * (1 - m), () => chip(s, xs[i]!, y, t, 'orange', { w: 12, h: 7, size: 3.2, on: 1 }));
        s.alpha(m, () => chip(s, xs[i]!, y, '[MASK]', 'slate', { w: 13, h: 7, size: 2.6, on: 1 }));
      } else {
        const dim = i > K ? causal : 0;
        s.alpha(1 - 0.65 * dim, () => chip(s, xs[i]!, y, t, 'orange', { w: 12, h: 7, size: 3.2 }));
      }
    });
    // Arcs into the slot: both sides, then the left only, then both again.
    const all = s.ease('blank', 0.6, 2.5) * (1 - s.ease('causal', 0.5)) + s.ease('peek', 0.6, 1);
    [0, 1].forEach((j) => arc(s, xs, top, j, 'green', all + causal));
    [3, 4, 5].forEach((j) => {
      arc(s, xs, top, j, 'green', all);
      arc(s, xs, top, j, 'red', causal * 0.85, [1.2, 1]);
    });
    // The answer below: the reader's guess, the copy, then the target.
    s.alpha(s.win('blank', 'causal') * s.ease('blank', 0.6, 4.5), () => {
      chip(s, xs[K]!, ty, 'sat', 'gold', { w: 12, h: 7, size: 3.2, on: 1 });
      s.text('you: sat', xs[K]! + 8 * u, ty, { size: 3, font: 'mono', align: 'left', color: s.c('gold') });
    });
    s.alpha(peek * s.ease('peek', 0.6, 3), () => {
      selfLoop(s, xs[K]!, top - 0.5 * u, 'red', 1);
      s.arrow(xs[K]!, y + 4.5 * u, xs[K]!, ty - 4.5 * u, s.c('red'), 0.4, 1.8);
      chip(s, xs[K]!, ty, 'sat', 'gold', { w: 12, h: 7, size: 3.2, on: 1 });
      s.text('copied', xs[K]! + 8 * u, ty, { size: 3, font: 'mono', align: 'left', color: s.c('red') });
    });
    s.alpha(s.ease('recover', 0.6), () => {
      s.arrow(xs[K]!, y + 4.5 * u, xs[K]!, ty - 4.5 * u, s.c('--ink-3'), 0.35, 1.8);
      chip(s, xs[K]!, ty, 'sat', 'gold', { w: 12, h: 7, size: 3.2, on: 1 });
      s.text('target', xs[K]! + 8 * u, ty, { size: 3, font: 'mono', align: 'left', color: s.c('gold') });
    });
    const ny = s.h * 0.8;
    s.alpha(s.win('blank', 'causal'), () => note(s, 'a blank: the words on both sides tell you', s.w / 2, ny, 'green', 3.2));
    s.alpha(causal, () => {
      note(s, 'causal (GPT): only the tokens before it', s.w / 2, ny, 'gold', 3.2);
      note(s, 'on a mat: hidden by the causal mask', s.w / 2, ny + 7 * u, 'red', 3);
    });
    s.alpha(peek, () => note(s, 'no causal mask: the answer is in the input', s.w / 2, ny, 'red', 3.2));
    s.alpha(s.win('mask', 'recover'), () => {
      note(s, '[MASK]: a word goes here', s.w / 2, ny, 'slate', 3.2);
      note(s, 'both sides visible, the answer hidden', s.w / 2, ny + 7 * u, 'green', 3);
    });
    s.alpha(s.ease('recover', 0.6), () => note(s, 'masked language model: recover what was hidden', s.w / 2, ny, '--ink-2', 3.1));
  },
};

/** A passage as rows of word bars, every fifth word a blank: [x, width] per word, in stage units from the left. */
const PAGE: [number, number][][] = (() => {
  const rng = new Rng(3);
  return Array.from({ length: 6 }, () => {
    const row: [number, number][] = [];
    let x = 0;
    while (true) {
      const w = 3 + rng.next() * 6;
      if (x + w > 44) break;
      row.push([x, w]);
      x += w + 1.6;
    }
    return row;
  });
})();

function page(s: Scene, l: number, t: number, blanks: number, filled: number): void {
  const u = s.u;
  let n = 0;
  PAGE.forEach((row, r) => {
    row.forEach(([x, w]) => {
      const y = t + r * 6 * u;
      const isBlank = n++ % 5 === 3;
      if (!isBlank) {
        s.rrect(l + x * u, y, w * u, 2.6 * u, 1, { fill: s.tint('--ink-3', 0.35) });
        return;
      }
      s.alpha(1 - blanks, () => s.rrect(l + x * u, y, w * u, 2.6 * u, 1, { fill: s.tint('--ink-3', 0.35) }));
      s.alpha(blanks, () => {
        const c = s.ctx;
        c.save();
        c.setLineDash([0.8 * u, 0.6 * u]);
        s.rrect(l + x * u, y - 0.4 * u, w * u, 3.4 * u, 1, { stroke: s.c('gold'), lw: 0.3 });
        c.restore();
      });
      s.alpha(filled, () => s.rrect(l + x * u + 0.6 * u, y + 0.3 * u, (w - 1.2) * u, 2 * u, 0.8, { fill: s.tint('green', 0.7) }));
    });
  });
}

/** A circle with a gap, which the eye closes. */
function gapCircle(s: Scene, x: number, y: number, r: number, close: number): void {
  const c = s.ctx;
  c.beginPath();
  c.arc(x, y, r, -Math.PI * 0.3, Math.PI * 1.55);
  c.strokeStyle = s.c('--ink-2');
  c.lineWidth = 0.7 * s.u;
  c.stroke();
  s.alpha(close, () => {
    c.save();
    c.setLineDash([0.8 * s.u, 0.8 * s.u]);
    c.beginPath();
    c.arc(x, y, r, Math.PI * 1.55, Math.PI * 1.7);
    c.strokeStyle = s.c('green');
    c.lineWidth = 0.7 * s.u;
    c.stroke();
    c.restore();
  });
}

const ACRO: [string, string][] = [['B', 'idirectional'], ['E', 'ncoder'], ['R', 'epresentations from'], ['T', 'ransformers']];

/** A tiny attention pattern: a full square, or its lower triangle. */
function tinyPattern(s: Scene, cx: number, cy: number, causal: boolean, k: Ink): void {
  const c = 3.2 * s.u;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const ok = !causal || j <= i;
      s.rrect(cx + (j - 2) * c + 0.3 * s.u, cy + (i - 2) * c + 0.3 * s.u, c - 0.6 * s.u, c - 0.6 * s.u, 0.4, { fill: s.tint(ok ? k : 'slate', ok ? 0.55 : 0.1) });
    }
  }
}

const bert: SceneDef = {
  draw(s) {
    const u = s.u;
    // The cloze test: a passage with blanks, and a circle with a gap.
    const intro = 1 - s.ease('bert', 0.6);
    s.alpha(intro, () => {
      const pl = s.w * 0.28 - 22 * u;
      page(s, Math.max(5 * u, pl), s.h * 0.22, s.ease('cloze', 0.8, 1.5), after(s, 'cloze', 0.55));
      s.alpha(s.ease('closure', 0.6), () => gapCircle(s, Math.min(s.w - 18 * u, s.w * 0.78), s.h * 0.36, 11 * u, after(s, 'closure', 0.55)));
    });
    s.alpha(s.win('cloze', 'closure'), () => note(s, 'how many blanks can readers fill?', s.w / 2, s.h * 0.8, '--ink-2', 3.2));
    s.alpha(s.win('closure', 'bert'), () => note(s, 'cloze, from closure: the eye fills the gap', s.w / 2, s.h * 0.8, 'green', 3.2));
    cite(s, 'Wilson L. Taylor, 1953', s.win('cloze', 'bert'));
    // BERT: 20 tokens, 3 hidden at random.
    s.alpha(s.win('bert', 'name'), () => {
      const c = s.tall ? 7.6 : 7;
      const x0 = s.w / 2 - 5 * c * u;
      const y0 = s.h * 0.28;
      for (let i = 0; i < 20; i++) {
        const hid = i === 3 || i === 11 || i === 16;
        const x = x0 + (i % 10) * c * u;
        const y = y0 + Math.floor(i / 10) * c * u;
        const h = hid ? s.ease('bert', 0.5, 4 + 0.4 * (i % 3)) : 0;
        s.rrect(x + 0.4 * u, y + 0.4 * u, (c - 0.8) * u, (c - 0.8) * u, 0.8, { fill: s.tint(h > 0.5 ? 'gold' : 'orange', h > 0.5 ? 0.85 : 0.25) });
      }
      note(s, '3 of 20: 15%, hidden at random', s.w / 2, y0 + 2 * c * u + 6 * u, 'gold', 3.2);
      note(s, 'BERT: hide them, then recover them', s.w / 2, s.h * 0.8, '--ink-2', 3.2);
    });
    cite(s, 'Devlin, Chang, Lee & Toutanova, 2018', s.win('bert', 'enc'));
    // The name, letter by letter.
    const nm = s.ease('name', 0.6);
    s.alpha(nm, () => {
      const size = s.tall ? 3.6 : 3.8;
      const left = s.w / 2 - 19 * u;
      ACRO.forEach(([head, tail], i) => {
        const hi = i === 0 ? s.win('name', 'enc') : i === 1 ? s.ease('enc', 0.6) : 0;
        const y = s.h * 0.14 + i * 6 * u;
        rich(s, [[head, hi > 0.5 ? 'green' : 'gold'], [tail, hi > 0.5 ? '--ink' : '--ink-3']], left, y, { size, weight: 650, align: 'left' });
      });
    });
    s.alpha(s.win('name', 'enc'), () => note(s, 'bidirectional: reads left and right', s.w / 2, s.h * 0.8, 'green', 3.2));
    // The two halves of the Transformer.
    s.alpha(s.ease('enc', 0.6, 1), () => {
      const y = s.h * 0.6;
      const dx = s.tall ? 22 : 26;
      [false, true].forEach((causal, i) => {
        const x = s.w / 2 + (i ? dx : -dx) * u;
        s.rrect(x - 13 * u, y - 13 * u, 26 * u, 26 * u, 1.6, { fill: s.tint(causal ? 'gold' : 'green', 0.08), stroke: s.tint(causal ? 'gold' : 'green', 0.6), lw: 0.35 });
        s.text(causal ? 'decoder' : 'encoder', x, y - 9 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c(causal ? 'gold' : 'green') });
        tinyPattern(s, x, y + 3 * u, causal, causal ? 'gold' : 'green');
        s.text(causal ? 'GPT' : 'BERT', x, y + 17 * u, { size: 3.4, font: 'mono', weight: 700, color: s.c(causal ? 'gold' : 'green') });
      });
      note(s, 'the 2017 Transformer, in two halves', s.w / 2, s.h * 0.93, '--ink-2', 3);
    });
    cite(s, 'Vaswani et al., 2017', s.ease('enc', 0.6, 1));
  },
};

/** Fraction `f` of the way through beat `id`, eased in over half a second. */
function after(s: Scene, id: string, f: number): number {
  const t = (s.t - s.at(id) - f * (s.end(id) - s.at(id))) / 0.5;
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** A 6 by 6 attention pattern: which positions (columns) each position (row) can see. */
function pattern(s: Scene, cx: number, cy: number, causal: boolean, a: number, label: string): void {
  s.alpha(a, () => {
    const c = (s.tall ? 5.6 : 6) * s.u;
    const x0 = cx - 3 * c;
    const y0 = cy - 3 * c;
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const ok = !causal || j <= i;
        const row = i === K;
        s.rrect(x0 + j * c + 0.4 * s.u, y0 + i * c + 0.4 * s.u, c - 0.8 * s.u, c - 0.8 * s.u, 0.6, { fill: s.tint(ok ? (row ? 'gold' : 'green') : 'slate', ok ? (row ? 0.85 : 0.35) : 0.1) });
      }
    }
    s.text(label, cx, y0 - 4 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('--ink-2') });
    s.text(`row 2: ${causal ? 3 : 6}`, cx, y0 + 6 * c + 4.4 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('gold') });
  });
}

const jobs: SceneDef = {
  draw(s) {
    const u = s.u;
    const grid = 1 - s.ease('attend', 0.6);
    s.alpha(grid, () => {
      const c = s.tall ? 3.8 : 3.6;
      const cols = 20;
      const x0 = s.w / 2 - (cols / 2) * c * u;
      const y0 = s.h * 0.2;
      const all = s.ease('fewer', 0.6, 1);
      for (let i = 0; i < 200; i++) {
        const on = HID.has(i);
        s.rrect(x0 + (i % cols) * c * u, y0 + Math.floor(i / cols) * c * u, c * 0.8 * u, c * 0.8 * u, 0.4, { fill: s.tint(on || all > 0.5 ? 'gold' : 'slate', on ? 0.9 : all > 0.5 ? 0.45 : 0.25) });
      }
      s.alpha(s.win('count', 'fewer'), () => rich(s, [['masked: ', '--ink-3'], ['30', 'gold'], [' of 200 scored', '--ink-2']], s.w / 2, y0 + 10 * c * u + 6 * u, { size: 3.4, weight: 600 }));
      s.alpha(s.ease('fewer', 0.6, 1), () => rich(s, [['causal: ', '--ink-3'], ['all 200', 'gold'], [' scored', '--ink-2']], s.w / 2, y0 + 10 * c * u + 6 * u, { size: 3.4, weight: 600 }));
    });
    const dx = s.tall ? 24 : 30;
    const cy = s.h * 0.36;
    const pat = s.ease('attend', 0.6, 0.6);
    pattern(s, s.w / 2 - dx * u, cy, true, pat, 'causal');
    pattern(s, s.w / 2 + dx * u, cy, false, s.ease('all', 0.6), 'masked');
    s.alpha(s.ease('generate', 0.6), () => rich(s, [['write left to right', '--ink-2'], ['  →  ', '--ink-3'], ['causal (GPT)', 'gold']], s.w / 2, s.h * 0.78, { size: 3.4, weight: 600 }));
    s.alpha(s.ease('fill', 0.6), () => rich(s, [['fill a blank from both sides', '--ink-2'], ['  →  ', '--ink-3'], ['masked (BERT)', 'green']], s.w / 2, s.h * 0.87, { size: 3.4, weight: 600 }));
  },
};

export const scenes: Record<string, SceneDef> = { blank, bert, jobs };
