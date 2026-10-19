import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { evalIndex, shapeStr } from '../../lib/numpy-index';
import { type K, PHOTO, check, cross, flash, frame, ghost, grid, photo, pill, rgb } from './kit';

// ---------------------------------------------------------------- shared data

/** Integer data whose column means are whole numbers, so centering stays readable. */
const XN = 5;
const XD = 8;
const XV: number[][] = (() => {
  const r = new Rng(11);
  const cols = Array.from({ length: XD }, () => {
    const c = Array.from({ length: XN - 1 }, () => r.int(10));
    const sum = c.reduce((a, b) => a + b, 0);
    let last = r.int(10);
    while ((sum + last) % XN) last = (last + 1) % 10;
    return [...c, last];
  });
  return Array.from({ length: XN }, (_, i) => cols.map((c) => c[i]!));
})();
const XMEAN = Array.from({ length: XD }, (_, j) => XV.reduce((a, row) => a + row[j]!, 0) / XN);

const SCORES = [
  [1.2, -0.4, 3.1, 0.5],
  [2.8, 1.0, -1.3, 0.2],
  [0.3, 0.9, 1.4, 2.6],
  [-0.7, 3.3, 0.8, 1.1],
  [1.9, 0.1, 0.6, -0.5],
];
const CLASSES = ['cat', 'dog', 'ship', 'frog'];
const Y = [2, 0, 3, 1, 0];

/** The practice grid a = np.arange(24).reshape(4, 6). */
const AV = (r: number, c: number): number => r * 6 + c;
const A24 = Array.from({ length: 4 }, (_, i) => Array.from({ length: 6 }, (_, j) => AV(i, j)));

/** Seconds into the scene at which a fraction `f` of beat `id` has been spoken. */
const at = (s: Scene, id: string, f = 0): number => lerp(s.at(id), s.end(id), f);

/** The scene beat currently playing, from a list in script order. */
function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

// ---------------------------------------------------------------- intro

/** The scores figure: a 5 x 4 grid, the labels y, and the correct-class column. */
function scoresLayout(s: Scene) {
  const { w, h, u } = s;
  const cw = Math.min(u * 11, (w - u * 16) / 6.4);
  const ch = cw * 0.74;
  const total = 4 * cw + u * 3 + cw * 0.8 + u * 5 + cw * 1.1;
  const gx = (w - total) / 2 + u * 3;
  const gy = h * 0.24;
  const yx = gx + 4 * cw + u * 3;
  const cx = yx + cw * 0.8 + u * 5;
  return { cw, ch, gx, gy, yx, cx };
}

interface ScoresOpts {
  /** Rows whose correct cell is lit, 0..5 (fractional for the one being picked). */
  picked?: number;
  yA?: number;
  rowsA?: number;
  /** Correct scores copied out, 0..5. */
  corr?: number;
  /** The row being paired right now, for the arrow. */
  active?: number;
  zero?: number;
  wrong?: number;
}

function drawScores(s: Scene, o: ScoresOpts): void {
  const { u } = s;
  const { cw, ch, gx, gy, yx, cx } = scoresLayout(s);
  const picked = o.picked ?? 0;
  const wrong = o.wrong ?? 0;
  const zero = o.zero ?? 0;
  CLASSES.forEach((nm, j) => s.text(nm, gx + j * cw + cw / 2, gy - u * 6.6, { size: 3.4, font: 'ui', weight: 600, color: s.c('--ink-2') }));
  for (let j = 0; j < 4; j++) s.text(String(j), gx + j * cw + cw / 2, gy - u * 2.6, { font: 'mono', size: 3, color: s.c('--ink-3') });
  const rowsA = o.rowsA ?? 0;
  for (let i = 0; i < 5; i++) {
    s.alpha(1 - rowsA, () => s.text(String(i), gx - u * 2.4, gy + i * ch + ch / 2, { font: 'mono', size: 3, color: s.c('--ink-3') }));
    s.alpha(rowsA, () => s.cell(gx - u * 1.6 - cw * 0.62, gy + i * ch, cw * 0.62, ch, String(i), 'slate', { on: o.active === i ? 1 : 0.2, size: 3.6 }));
  }
  s.alpha(rowsA, () => s.text('rows', gx - u * 1.6 - cw * 0.31, gy - u * 2.6, { font: 'mono', size: 3, weight: 600, color: s.c('slate') }));
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 4; j++) {
      const isPick = Y[i] === j;
      const lit = isPick ? clamp01(picked - i) : 0;
      const z = isPick && zero > 0.5;
      const k: K = wrong > 0.5 ? 'red' : lit > 0 ? 'gold' : 'purple';
      const dim = picked > 0 && !isPick && wrong < 0.5 ? 0.45 : 1;
      s.alpha(dim, () => s.cell(gx + j * cw, gy + i * ch, cw, ch, z ? '0' : fmt(SCORES[i]![j]!, 2), k, { on: wrong > 0.5 ? 0.6 : lit, size: 3.6 }));
      if (isPick && zero > 0) flash(s, gx + j * cw, gy + i * ch, cw, ch, zero * 1.4, 'green');
    }
  // labels
  const yA = (o.yA ?? 0) * (1 - wrong);
  s.alpha(yA, () => {
    s.text('y', yx + cw * 0.4, gy - u * 2.8, { size: 4.4, italic: true, weight: 650, color: s.c('gold') });
    for (let i = 0; i < 5; i++) s.cell(yx, gy + i * ch, cw * 0.8, ch, String(Y[i]), 'gold', { on: o.active === i ? 1 : 0.15, size: 3.6 });
  });
  const corr = (o.corr ?? 0) * (1 - wrong);
  if (corr > 0) {
    s.text('correct', cx + cw * 0.55, gy - u * 2.8, { size: 3.2, font: 'mono', weight: 600, color: s.c('purple') });
    for (let i = 0; i < 5; i++) {
      const a = clamp01(corr - i);
      if (a <= 0) continue;
      s.alpha(a, () => {
        s.arrow(yx + cw * 0.8 + u * 0.6, gy + i * ch + ch / 2, cx - u * 0.6, gy + i * ch + ch / 2, s.tint('--ink-3', 0.8), 0.3, 1.6);
        s.cell(cx, gy + i * ch, cw * 1.1, ch, fmt(SCORES[i]![Y[i]!]!, 2), 'purple', { on: 0.5, size: 3.6 });
      });
    }
  }
  if (wrong > 0) {
    const rc = Math.min(cw * 0.62, (s.w - yx - u * 4) / 5);
    s.alpha(wrong, () => {
      Y.forEach((c, j) => s.text(String(c), yx + j * rc + rc / 2, gy - u * 2.8, { font: 'mono', size: 3, weight: 600, color: s.c('gold') }));
      const roomy = rc >= u * 8;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) s.cell(yx + j * rc, gy + i * ch, rc, ch, roomy ? fmt(SCORES[i]![Y[j]!]!, 2) : '', 'red', { on: 0.3, size: 3.2 });
    });
  }
}

/** A 3 x 4 tile of a few lines of mono text under a heading, for the opening. */
function tile(s: Scene, x: number, y: number, w: number, h: number, head: string, foot: string, k: K, body: (cx: number, top: number) => void): void {
  const { u } = s;
  s.rrect(x, y, w, h, 2.5, { fill: s.tint(k, 0.06), stroke: s.tint(k, 0.55), lw: 0.35 });
  s.text(head, x + w / 2, y + u * 6, { size: 5.4, font: 'display', weight: 600, color: s.c(k) });
  body(x + w / 2, y + u * 11.5);
  s.text(foot, x + w / 2, y + h - u * 4.4, { size: 3.4, italic: true, color: s.c('--ink-2') });
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Title, then the two halves of the chapter.
    const tA = s.win('hello', 'loops');
    s.alpha(tA, () => {
      const lift = s.ease('python', 0.9);
      const ty = lerp(h * 0.44, h * 0.17, lift);
      s.text('Python and NumPy', w / 2, ty, { size: lerp(10, 7.5, lift), font: 'display', weight: 600 });
      s.alpha(1 - lift, () => s.text('the language of every assignment', w / 2, ty + u * 10, { size: 4.6, italic: true, color: s.c('--ink-2') }));
      const tw = Math.min(w * 0.42, u * 52);
      const th = u * 56;
      const gap = u * 5;
      const y0 = h * 0.3;
      s.alpha(s.ease('python', 0.6, 0.5), () =>
        tile(s, w / 2 - tw - gap / 2, y0, tw, th, 'Python', 'the easy part', 'slate', (cx, top) => {
          const lines = ['x = 3', 'nums = [3, 1, 4]', 'for n in nums:', "    print(n)"];
          const lx = cx - s.measure('nums = [3, 1, 4]', { font: 'mono', size: 3.4 }) / 2;
          lines.forEach((l, i) => s.text(l, lx, top + u * 4 + i * u * 6.2, { font: 'mono', size: 3.4, align: 'left', color: s.c('--ink') }));
        }),
      );
      s.alpha(s.ease('numpy', 0.6), () =>
        tile(s, w / 2 + gap / 2, y0, tw, th, 'NumPy', 'arrays of numbers', 'orange', (cx, top) => {
          const cw = Math.min(u * 9, (tw - u * 6) / 4);
          const ch = cw * 0.8;
          grid(s, cx - 2 * cw, top + u * 1.5, cw, ch, XV.slice(0, 3).map((r) => r.slice(0, 4)), 'orange', { size: 3.4 });
        }),
      );
    });
    // Loops versus whole arrays, on one grid.
    const gA = s.win('loops', 'goal');
    if (gA > 0) {
      const cw = Math.min(u * 10, (w - u * 24) / XD);
      const ch = cw * 0.82;
      const gx = (w - XD * cw) / 2 + u * 2;
      const gy = h * 0.22;
      const lt = Math.min(s.since('loops'), s.at('whole') - s.at('loops')) - 0.5;
      const visited = lt < 0 ? 0 : Math.min(XN * XD, Math.floor(lt * 3.4) + 1);
      const all = s.ease('whole', 0.5, 0.6);
      s.alpha(gA, () => {
        s.text('X', gx - u * 6, gy + (XN * ch) / 2, { size: 6, italic: true, weight: 650, color: s.c('orange') });
        s.text('N rows, D columns', gx + (XD * cw) / 2, gy - u * 4, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
        for (let i = 0; i < XN; i++)
          for (let j = 0; j < XD; j++) {
            const k = i * XD + j;
            const done = k < visited || all > 0;
            const v = done ? XV[i]![j]! - XMEAN[j]! : XV[i]![j]!;
            const cur = k === visited - 1 && all === 0;
            const on = cur ? 1 : all > 0 ? Math.sin(all * Math.PI) : 0;
            s.cell(gx + j * cw, gy + i * ch, cw, ch, String(v), done ? 'teal' : 'orange', { on, size: 3.6 });
          }
        const ly = gy + XN * ch + u * 9;
        s.alpha(1 - all, () => {
          s.text(`Python steps: ${visited}`, w / 2, ly, { size: 4.4, font: 'mono', weight: 600 });
          s.text('one number at a time', w / 2, ly + u * 7, { size: 3.8, italic: true, color: s.c('--ink-2') });
        });
        s.alpha(all, () => {
          s.text('X -= X.mean(axis=0)', w / 2, ly, { size: 4.4, font: 'mono', weight: 600, color: s.c('teal') });
          s.text('one line: every number at once', w / 2, ly + u * 7, { size: 3.8, italic: true, color: s.c('teal') });
        });
      });
    }
    // The goal line, and its shapes.
    const pA = s.ease('goal', 0.7);
    if (pA > 0) {
      const p = s.since('goal') - 1;
      s.alpha(pA, () => {
        drawScores(s, { picked: clamp01(p / 3) * 5, yA: 1, corr: clamp01((p - 0.6) / 3) * 5 });
        const { gy, ch } = scoresLayout(s);
        const ly = gy + 5 * ch + u * 8;
        s.alpha(1 - s.ease('shape', 0.5), () => s.text('correct = scores[np.arange(N), y]', w / 2, ly, { size: 3.8, font: 'mono', weight: 600 }));
        s.alpha(s.ease('shape', 0.6), () => {
          const xs = [w * 0.2, w * 0.47, w * 0.77];
          pill(s, 'scores (5, 4)', xs[0]!, ly, 'purple', { size: 3.4 });
          pill(s, 'y (5,)', xs[1]!, ly, 'gold', { size: 3.4 });
          pill(s, 'correct (5,)', xs[2]!, ly, 'purple', { size: 3.4 });
          s.text('predict every shape before you print it', w / 2, ly + u * 9, { size: 3.8, italic: true, color: s.c('--ink-2') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- python

const NUMS = [3, 1, 4, 1, 5, 9];

const python: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Values and operators.
    const oA = s.win('x', 'indent');
    s.alpha(oA, () => {
      const ty = lerp(h * 0.42, h * 0.22, s.ease('div', 0.8));
      const tagW = u * 10;
      const bx = w / 2 + u * 6;
      s.rrect(w / 2 - u * 18, ty - u * 4.5, tagW, u * 9, 4.5, { fill: s.tint('slate', 0.12), stroke: s.c('slate'), lw: 0.4 });
      s.text('x', w / 2 - u * 13, ty + u * 0.3, { size: 5.4, font: 'mono', weight: 650, color: s.c('slate') });
      s.arrow(w / 2 - u * 7, ty, bx - u * 1.5, ty, s.c('--ink-3'), 0.4, 2.4);
      s.cell(bx, ty - u * 5, u * 11, u * 10, '3', 'purple', { on: 0.4, size: 5 });
      s.alpha(s.ease('x', 0.6, 3.2), () => s.text('int: Python works it out', bx + u * 5.5, ty + u * 9.5, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      const cards: [string, string, string, string, number][] = [
        ['7 / 2', '3.5', 'always a float', 'div', 0.4],
        ['7 // 2', '3', 'rounds down', 'div', 0.62],
        ['2 ** 10', '1024', 'power', 'pow', 0.1],
        ['7 % 3', '1', 'remainder', 'pow', 0.55],
      ];
      const cw = Math.min(u * 50, (w - u * 14) / 2);
      const chh = u * 19;
      cards.forEach(([ex, res, note, beat, f], i) => {
        const a = s.since(beat) >= 0 ? smooth((s.t - at(s, beat, f)) / 0.5) : 0;
        const x = w / 2 - cw - u * 2 + (i % 2) * (cw + u * 4);
        const y = h * 0.42 + Math.floor(i / 2) * (chh + u * 4);
        s.alpha(a, () => {
          s.rrect(x, y, cw, chh, 2.2, { fill: s.tint('slate', 0.06), stroke: s.tint('slate', 0.45), lw: 0.3 });
          s.text(`${ex}  →  ${res}`, x + cw / 2, y + chh * 0.4, { size: 4.8, font: 'mono', weight: 600 });
          s.text(note, x + cw / 2, y + chh * 0.74, { size: 3.4, italic: true, color: s.c('--ink-2') });
        });
      });
    });
    // Indentation is the block.
    const iA = s.win('indent', 'list');
    s.alpha(iA, () => {
      const lx = w * 0.1;
      const rx = w * 0.56;
      const y0 = h * 0.36;
      const sz = 4;
      const lh = u * 7;
      s.alpha(0.55, () => {
        ['if (x > 2) {', "  print('big');", '}'].forEach((l, i) => s.text(l, lx, y0 + i * lh, { size: sz, font: 'mono', align: 'left', color: s.c('--ink-3') }));
      });
      s.alpha(s.ease('indent', 0.5, 1), () => {
        const sw = s.measure("  print('big');", { font: 'mono', size: sz });
        s.line(lx - u, y0 + lh, lx + sw + u, y0 + lh, s.c('red'), 0.6);
        s.text('other languages', lx + sw / 2, y0 - u * 9, { size: 3.4, italic: true, color: s.c('--ink-3') });
      });
      s.alpha(s.ease('indent', 0.6, 1.6), () => {
        s.text('Python', rx + u * 14, y0 - u * 9, { size: 3.4, italic: true, color: s.c('purple') });
        const ind = s.measure('    ', { font: 'mono', size: sz });
        const bw = s.measure("print('big')", { font: 'mono', size: sz });
        s.rrect(rx + ind - u, y0 + lh * 0.45, bw + 2 * u, lh * 1.1, 1.2, { fill: s.tint('purple', 0.12) });
        s.text('if x > 2:', rx, y0, { size: sz, font: 'mono', align: 'left' });
        s.text("    print('big')", rx, y0 + lh, { size: sz, font: 'mono', align: 'left' });
        s.text('the block', rx + ind + bw / 2, y0 + lh * 2.6, { size: 3.4, italic: true, color: s.c('purple') });
        const cxp = rx + s.measure('if x > 2', { font: 'mono', size: sz }) + s.measure(':', { font: 'mono', size: sz }) / 2;
        s.circle(cxp, y0 + u * 0.2, u * 1.7, { stroke: s.c('--accent'), lw: 0.35 });
      });
    });
    // Lists, indices and slices.
    const lA = s.ease('list', 0.6);
    if (lA > 0) {
      const cw = Math.min(u * 13, (w - u * 20) / 6);
      const ch = cw * 0.8;
      const lx = (w - 6 * cw) / 2;
      const ly = h * 0.34;
      const beat = current(s, ['list', 'neg', 'slice', 'open', 'step', 'comp'])!;
      let sel: number[] = [];
      let res: number[] = [];
      let label = '';
      if (beat === 'neg') {
        sel = [5];
        res = [9];
        label = 'nums[-1]';
      } else if (beat === 'slice') {
        sel = s.ease('slice', 0.5, 3.4) > 0 ? [1, 2, 3] : [];
        res = [1, 4, 1];
        label = 'nums[1:4]';
      } else if (beat === 'open') {
        const second = s.prog('open') > 0.5;
        sel = second ? [3, 4, 5] : [0, 1];
        res = sel.map((i) => NUMS[i]!);
        label = second ? 'nums[3:]' : 'nums[:2]';
      } else if (beat === 'step') {
        sel = [0, 2, 4];
        res = [3, 4, 5];
        label = 'nums[::2]';
      } else if (beat === 'comp') {
        sel = [0, 2, 4, 5];
        res = [9, 16, 25, 81];
        label = 'sq';
      } else if (s.since('list') > 3.4) {
        sel = [0];
        res = [3];
        label = 'nums[0]';
      }
      const t0 = beat === 'open' && s.prog('open') > 0.5 ? at(s, 'open', 0.5) : s.at(beat);
      const rA = smooth((s.t - t0 - (beat === 'slice' ? 3.8 : beat === 'list' ? 3.6 : 0.6)) / 0.6);
      s.alpha(lA, () => {
        s.text('nums', lx - u * 3, ly + ch / 2, { size: 4.2, font: 'mono', weight: 600, align: 'right', color: s.c('slate') });
        NUMS.forEach((v, i) => {
          const on = sel.includes(i) ? 1 : 0;
          const dim = beat === 'comp' && !on ? 0.4 : 1;
          s.alpha(dim, () => s.cell(lx + i * cw, ly, cw, ch, String(v), on ? 'purple' : 'slate', { on, size: 4.4 }));
        });
        // Index labels: at cell centers, then sliding to the fence posts.
        const post = s.since('slice') >= 0 && s.since('open') < 0 ? s.ease('slice', 0.9, 1.4) : 0;
        for (let i = 0; i <= 6; i++) {
          const x = lerp(lx + i * cw + cw / 2, lx + i * cw, post);
          if (i === 6 && post < 0.5) continue;
          const hot = post > 0.5 && (i === 1 || i === 4);
          s.alpha(i === 6 ? post : 1, () => s.text(String(i), x, ly - u * 3, { size: 3.4, font: 'mono', weight: hot ? 700 : 500, color: hot ? s.c('purple') : s.c('--ink-3') }));
          if (post > 0) s.alpha(post * (hot ? 1 : 0.5), () => s.line(x, ly - u * 1, x, ly + ch + u * 1, hot ? s.c('purple') : s.c('--ink-3'), hot ? 0.55 : 0.3));
        }
        s.alpha(s.ease('neg', 0.5) * (1 - s.ease('slice', 0.4)), () => {
          for (let i = 0; i < 6; i++) s.text(String(i - 6), lx + i * cw + cw / 2, ly + ch + u * 3.4, { size: 3.4, font: 'mono', color: s.c('purple') });
        });
        // The result.
        if (res.length) {
          const rcw = Math.min(cw, u * 11);
          const rx = (w - res.length * rcw) / 2 + u * 4;
          const ry = h * 0.66;
          s.alpha(rA, () => {
            s.text(label === 'sq' ? 'sq' : label, rx - u * 3, ry + (rcw * 0.8) / 2, { size: 4, font: 'mono', weight: 600, align: 'right', color: s.c('purple') });
            res.forEach((v, i) => s.cell(rx + i * rcw, ry + (1 - rA) * -u * 6, rcw, rcw * 0.8, String(v), 'purple', { on: 0.3, size: 4.2 }));
          });
          if (beat === 'comp') s.alpha(rA, () => s.text('n ** 2, only where n > 2', w / 2, ry + rcw + u * 5, { size: 3.6, italic: true, color: s.c('--ink-2') }));
          if (beat === 'slice') s.alpha(rA, () => s.text('between posts 1 and 4: three items', w / 2, ry + rcw + u * 5, { size: 3.6, italic: true, color: s.c('--ink-2') }));
          if (beat === 'list') s.alpha(rA, () => s.text('counting starts at 0', w / 2, ry + rcw + u * 5, { size: 3.6, italic: true, color: s.c('--ink-2') }));
        }
      });
    }
  },
};

// ---------------------------------------------------------------- python2

const python2: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tagCol = (x: number, y: number, label: string, k: K, align: 'left' | 'center' = 'center') => pill(s, label, x, y, k, { size: 4, align });
    // Tuples and unpacking.
    s.alpha(s.win('tuple', 'dict'), () => {
      const cw = u * 12;
      const ty = h * 0.3;
      const tx = w / 2 - cw;
      s.text('(', tx - u * 4, ty + cw * 0.38, { size: 13, font: 'mono', weight: 300, color: s.c('slate') });
      s.text(')', tx + 2 * cw + u * 4, ty + cw * 0.38, { size: 13, font: 'mono', weight: 300, color: s.c('slate') });
      s.cell(tx, ty, cw, cw * 0.8, '3', 'slate', { size: 5 });
      s.cell(tx + cw, ty, cw, cw * 0.8, '4', 'slate', { size: 5 });
      tagCol(tx - u * 9, ty - u * 7, 'point', 'slate');
      // padlock: frozen
      const lx = tx + 2 * cw + u * 11;
      const ly = ty + u * 3;
      s.rrect(lx - u * 2.6, ly, u * 5.2, u * 4.2, 0.8, { fill: s.c('gold') });
      s.ctx.beginPath();
      s.ctx.arc(lx, ly, u * 1.8, Math.PI, 0);
      s.ctx.strokeStyle = s.c('gold');
      s.ctx.lineWidth = u * 0.7;
      s.ctx.stroke();
      s.text('cannot change', lx, ly + u * 8.5, { size: 3.2, italic: true, color: s.c('gold') });
      const un = s.ease('tuple', 0.7, 4.2);
      s.alpha(un, () => {
        [0, 1].forEach((i) => {
          const sx = tx + i * cw + cw / 2;
          const ex = w / 2 + (i - 0.5) * u * 30;
          s.arrow(sx, ty + cw * 0.8 + u, lerp(sx, ex, un), lerp(ty + cw, h * 0.66, un) - u * 4, s.c('--ink-3'), 0.4, 2.2);
          tagCol(ex, h * 0.68, i === 0 ? 'px = 3' : 'py = 4', 'purple');
        });
      });
    });
    // Dictionaries.
    s.alpha(s.win('dict', 'def'), () => {
      const res = s.ease('results', 0.6);
      const rows: [string, string][] = res > 0.5
        ? [
            ['(1e-7, 2.5e4)', '(0.38, 0.37)'],
            ['(1e-7, 5e4)', '(0.36, 0.36)'],
            ['(5e-7, 2.5e4)', '(0.33, 0.32)'],
          ]
        : [
            ["'cat'", '3'],
            ["'dog'", '5'],
          ];
      const kw = res > 0.5 ? u * 34 : u * 18;
      const vw = res > 0.5 ? u * 32 : u * 14;
      const gap = u * 12;
      const x0 = (w - kw - vw - gap) / 2;
      const y0 = h * 0.32;
      const rh = u * 10;
      const head = res > 0.5 ? ['key: (lr, reg)', 'value: (train, val)'] : ['key', 'value'];
      s.alpha(res > 0.5 ? smooth((res - 0.5) * 2) : 1 - smooth(res * 2), () => {
        s.text(head[0]!, x0 + kw / 2, y0 - u * 4.5, { size: 3.4, italic: true, color: s.c('--ink-2') });
        s.text(head[1]!, x0 + kw + gap + vw / 2, y0 - u * 4.5, { size: 3.4, italic: true, color: s.c('--ink-2') });
        rows.forEach(([k, v], i) => {
          const y = y0 + i * (rh + u * 2);
          const hot = res < 0.5 && i === 0 && s.since('dict') > 2.2;
          s.cell(x0, y, kw, rh, k, 'gold', { on: hot ? 1 : 0.2, size: 3.6 });
          s.arrow(x0 + kw + u * 2, y + rh / 2, x0 + kw + gap - u * 2, y + rh / 2, s.c('--ink-3'), 0.4, 2.2);
          s.cell(x0 + kw + gap, y, vw, rh, v, 'purple', { on: hot ? 1 : 0.2, size: 3.6 });
        });
        if (res < 0.5) s.alpha(s.ease('dict', 0.5, 2.2), () => s.text("counts['cat']  →  3", w / 2, y0 + 3 * rh + u * 6, { size: 4.2, font: 'mono', weight: 600 }));
        else s.text('results[(lr, reg)] = (train, val)', w / 2, y0 + 4 * (rh + u * 2), { size: 3.6, font: 'mono', color: s.c('--ink-2') });
      });
    });
    // A function with a default and a keyword argument.
    s.alpha(s.win('def', 'cls'), () => {
      const cy = h * 0.46;
      const mw = Math.min(u * 34, w * 0.3);
      const mh = u * 22;
      const mx = w / 2 - mw / 2 + u * 4;
      s.rrect(mx, cy - mh / 2, mw, mh, 3, { fill: s.tint('purple', 0.08), stroke: s.c('purple'), lw: 0.5 });
      s.text('relu', mx + mw / 2, cy, { size: 6, font: 'mono', weight: 650, color: s.c('purple') });
      const kwp = s.ease('kw', 0.6, 1.6);
      const ix = mx - u * 5;
      pill(s, kwp > 0.5 ? 'v = -2.0' : 'v', ix, cy - u * 6, 'orange', { size: 3.8, align: 'right' });
      s.alpha(1 - kwp, () => pill(s, 'leak = 0.0', ix, cy + u * 6, 'slate', { size: 3.8, align: 'right' }));
      s.alpha(kwp, () => pill(s, 'leak = 0.1', ix, cy + u * 6, 'gold', { size: 3.8, align: 'right' }));
      s.alpha(s.ease('def', 0.5, 2.5) * (1 - kwp), () => s.text('a default', ix - u * 10, cy + u * 13, { size: 3.4, italic: true, color: s.c('slate') }));
      s.alpha(kwp, () => s.text('passed by name', ix - u * 10, cy + u * 13, { size: 3.4, italic: true, color: s.c('gold') }));
      const out = s.ease('kw', 0.6, 4.2);
      s.alpha(out, () => {
        s.arrow(mx + mw + u, cy, mx + mw + u * 7, cy, s.c('--ink-3'), 0.4, 2.2);
        pill(s, '-0.2', mx + mw + u * 8, cy, 'purple', { size: 4.4, align: 'left' });
      });
      s.text('def relu(v, leak=0.0)', w / 2, h * 0.82, { size: 3.8, font: 'mono', color: s.c('--ink-2') });
    });
    // A class: data plus methods, reached through self.
    s.alpha(s.win('cls', 'alias'), () => {
      const cw = Math.min(u * 62, w * 0.62);
      const chh = u * 36;
      const cx = (w - cw) / 2 + u * 6;
      const cy = h * 0.24;
      s.rrect(cx, cy, cw, chh, 2.5, { fill: s.tint('blue', 0.05), stroke: s.c('blue'), lw: 0.45 });
      s.rrect(cx, cy, cw, u * 9, 2.5, { fill: s.tint('blue', 0.14) });
      s.text('clf: a NearestNeighbor', cx + cw / 2, cy + u * 4.6, { size: 3.8, font: 'mono', weight: 600, color: s.c('blue') });
      const fill = s.ease('new', 0.9, 2.6);
      s.text('self.X_train', cx + u * 4, cy + u * 17, { size: 3.6, font: 'mono', align: 'left' });
      const sx = cx + cw - u * 22;
      s.rrect(sx, cy + u * 12, u * 18, u * 10, 1.2, { fill: s.tint('orange', 0.06), stroke: s.tint('orange', 0.5), lw: 0.3 });
      s.alpha(1 - fill, () => s.text('None', sx + u * 9, cy + u * 17.2, { size: 3.4, font: 'mono', color: s.c('--ink-3') }));
      s.text('train(self, X, y)', cx + u * 4, cy + u * 29, { size: 3.6, font: 'mono', align: 'left', color: s.c('--ink-2') });
      // self points back at the object
      s.alpha(s.ease('cls', 0.6, 2.4), () => {
        pill(s, 'self', cx - u * 3, cy + chh + u * 7, 'blue', { size: 3.6, align: 'center' });
        s.arrow(cx - u * 3, cy + chh + u * 3.6, cx + u * 2, cy + chh - u * 1, s.c('blue'), 0.4, 2.2);
        s.text('the object itself', cx + u * 4, cy + chh + u * 7, { size: 3.4, italic: true, color: s.c('--ink-2'), align: 'left' });
      });
      // data flows into the slot
      s.alpha(s.ease('new', 0.5, 1.4), () => {
        const dx = lerp(cx + cw / 2 - u * 9, sx + u * 2, fill);
        const dy = lerp(cy + chh + u * 14, cy + u * 13.5, fill);
        const g = u * 3.6;
        for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) s.rrect(dx + j * g, dy + i * g, g - 1, g - 1, 0.5, { fill: s.tint('orange', 0.55) });
        s.alpha(1 - fill, () => s.text('X_train', dx + g * 2, dy + g * 2 + u * 4, { size: 3.4, font: 'mono', color: s.c('orange') }));
      });
      s.alpha(s.ease('new', 0.5), () => s.text('clf = NearestNeighbor()', cx + cw / 2, cy - u * 5, { size: 3.6, font: 'mono', color: s.c('--ink-2') }));
    });
    // Two names, one list.
    const alA = s.ease('alias', 0.6);
    s.alpha(alA, () => {
      const cw = Math.min(u * 11, (w - u * 24) / 6);
      const ch = cw * 0.8;
      const lx = (w - 6 * cw) / 2;
      const ly = h * 0.5;
      const ch99 = s.ease('same', 0.4, 1.6);
      NUMS.forEach((v, i) => s.cell(lx + i * cw, ly, cw, ch, i === 0 && ch99 > 0.5 ? '99' : String(v), 'slate', { on: i === 0 ? ch99 : 0, size: 4.2 }));
      flash(s, lx, ly, cw, ch, s.ease('same', 0.8, 1.4));
      const t1 = { x: w * 0.25, y: h * 0.24 };
      const t2 = { x: w * 0.72, y: h * 0.24 };
      pill(s, 'nums', t1.x, t1.y, 'slate', { size: 4 });
      s.arrow(t1.x, t1.y + u * 4, lx + cw * 1.5, ly - u * 1.5, s.c('slate'), 0.45, 2.4);
      const second = s.ease('alias', 0.6, 2.2);
      s.alpha(second, () => {
        pill(s, 'alias', t2.x, t2.y, 'purple', { size: 4 });
        s.arrow(t2.x, t2.y + u * 4, lx + cw * 4.5, ly - u * 1.5, s.c('purple'), 0.45, 2.4);
      });
      s.alpha(s.ease('alias', 0.6, 3.6), () => {
        s.text('alias = nums', w / 2, ly + ch + u * 9, { size: 4.2, font: 'mono', weight: 600 });
        s.text('no copy: one list, two names', w / 2, ly + ch + u * 16, { size: 3.6, italic: true, color: s.c('--ink-2') });
      });
      s.alpha(ch99, () => s.text('alias[0] = 99  →  nums[0] is 99', w / 2, h * 0.12 + u * 2, { size: 3.8, font: 'mono', weight: 600, color: s.c('--accent') }));
    });
  },
};

// ---------------------------------------------------------------- arrays

const MAKERS: [string, string, (string | number)[][]][] = [
  ['np.zeros((2, 3))', 'all 0.0', [[0, 0, 0], [0, 0, 0]]],
  ['np.full((2, 2), 7)', 'all 7', [[7, 7], [7, 7]]],
  ['np.eye(3)', 'the identity', [[1, 0, 0], [0, 1, 0], [0, 0, 1]]],
  ['np.arange(5)', 'like range()', [[0, 1, 2, 3, 4]]],
  ['np.linspace(0, 1, 5)', 'evenly spaced', [['0', '.25', '.5', '.75', '1']]],
  ['np.random.randn(2, 3)', 'bell-curve samples', [['0.5', '-1.1', '0.3'], ['1.6', '-0.2', '-0.7']]],
];

/** Where each list item's object lives: slot order shuffled so the pointers cross. */
const SCATTER = [3, 0, 5, 1, 4, 2];

const arrays: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const memVals = ['0.5', '1.2', '3.0', '0.8', '2.2', '1.7', '0.4', '2.9'];
    // One block of memory.
    const mA = s.win('what', 'v');
    s.alpha(mA, () => {
      const cw = Math.min(u * 11, (w - u * 16) / 8);
      const ch = cw * 0.72;
      const mx = (w - 8 * cw) / 2;
      const my = h * 0.74;
      const fly = s.ease('what', 1.6, 2.2);
      const gx = (w - 4 * cw) / 2;
      const gy = h * 0.24;
      s.alpha(1 - s.ease('fast', 0.5), () => {
        s.text('an array: one dtype, float64', w / 2, gy - u * 5, { size: 3.6, italic: true, color: s.c('--ink-2') });
      });
      memVals.forEach((v, k) => {
        const p = smooth(fly * 1.5 - k * 0.06);
        const x = lerp(gx + (k % 4) * cw, mx + k * cw, p);
        const y = lerp(gy + Math.floor(k / 4) * ch, my, p);
        s.alpha(s.since('fast') >= 0 ? 1 : 1, () => s.cell(x, y, cw, ch, v, 'blue', { size: 3.6 }));
      });
      s.alpha(fly, () => {
        s.line(mx, my + ch + u * 2.5, mx + 8 * cw, my + ch + u * 2.5, s.c('blue'), 0.4);
        s.text('one block of memory, side by side', w / 2, my + ch + u * 6.5, { size: 3.6, italic: true, color: s.c('blue') });
      });
      // The fast sweep of compiled code.
      const sw = s.since('fast') - 5.5;
      if (sw > 0) {
        const p = (sw * 1.6) % 1.3;
        if (p < 1) s.rrect(mx + p * 7 * cw, my - u * 0.6, cw, ch + u * 1.2, 1.4, { stroke: s.c('teal'), lw: 0.7 });
        s.alpha(smooth(sw / 0.5), () => s.text('one tight loop in compiled C', w / 2, my - u * 5, { size: 3.8, font: 'mono', weight: 600, color: s.c('teal') }));
      }
      // A Python list: pointers to scattered objects.
      s.alpha(s.ease('fast', 0.6, 1.4), () => {
        const pw = u * 6;
        const px = w / 2 - 3 * pw;
        const py = h * 0.16;
        s.text('a Python list', px - u * 3, py + pw * 0.4, { size: 3.4, italic: true, align: 'right', color: s.c('--ink-2') });
        SCATTER.forEach((slot, i) => {
          s.rrect(px + i * pw, py, pw - u * 0.4, pw * 0.8, 0.8, { fill: s.tint('slate', 0.14), stroke: s.c('slate'), lw: 0.3 });
          s.circle(px + i * pw + pw / 2, py + pw * 0.4, u * 0.7, { fill: s.c('slate') });
          const ox = w * (0.12 + 0.152 * slot);
          const oy = h * (slot % 2 ? 0.47 : 0.33);
          const label = ['3', "'cat'", '2.5', 'None', '[1, 2]', 'True'][i]!;
          const bw = s.measure(label, { font: 'mono', size: 3.2 }) + u * 3;
          s.arrow(px + i * pw + pw / 2, py + pw * 0.8, ox, oy - u * 3.4, s.tint('slate', 0.6), 0.25, 1.6);
          s.rrect(ox - bw / 2, oy - u * 3, bw, u * 6, 1.2, { fill: s.tint('orange', 0.08), stroke: s.tint('orange', 0.6), lw: 0.3 });
          s.text(label, ox, oy + u * 0.2, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
        });
      });
    });
    // Shape, ndim, dtype.
    const props = (x: number, y: number, rows: [string, string, number][]) =>
      rows.forEach(([k, v, a], i) =>
        s.alpha(a, () => {
          s.text(k, x, y + i * u * 7.5, { size: 3.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
          s.text(v, x + u * 3, y + i * u * 7.5, { size: 4.2, font: 'mono', weight: 650, align: 'left', color: s.c('blue') });
        }),
      );
    s.alpha(s.win('v', 'M'), () => {
      const cw = u * 11;
      const vx = s.tall ? w / 2 - 1.5 * cw : w * 0.28 - 1.5 * cw;
      const vy = s.tall ? h * 0.24 : h * 0.42;
      s.text('v', vx - u * 4, vy + cw * 0.4, { size: 5, italic: true, weight: 650, color: s.c('blue') });
      grid(s, vx, vy, cw, cw * 0.8, [[1, 2, 3]], 'blue', { size: 4.4 });
      s.alpha(s.ease('v', 0.6, 3.5), () => {
        s.line(vx, vy + cw + u * 1.5, vx + 3 * cw, vy + cw + u * 1.5, s.c('teal'), 0.4);
        s.text('axis 0: length 3', vx + 1.5 * cw, vy + cw + u * 5, { size: 3.4, font: 'mono', color: s.c('teal') });
      });
      const px = s.tall ? w / 2 : w * 0.66;
      const py = s.tall ? h * 0.6 : h * 0.36;
      props(px, py, [
        ['shape', '(3,)', s.ease('v', 0.5, 2.4)],
        ['ndim', '1', s.ease('ndim', 0.5, 0.2)],
        ['dtype', 'int64', s.ease('ndim', 0.5, 3)],
      ]);
    });
    s.alpha(s.win('M', 'dtypes'), () => {
      const cw = u * 11;
      const mx = s.tall ? w / 2 - 1.5 * cw + u * 3 : w * 0.3 - 1.5 * cw;
      const my = s.tall ? h * 0.22 : h * 0.34;
      grid(s, mx, my, cw, cw * 0.8, [['1.', '2.', '3.'], ['4.', '5.', '6.']], 'blue', { size: 4.2 });
      s.alpha(s.ease('M', 0.6, 2.4), () => {
        s.arrow(mx - u * 3.5, my, mx - u * 3.5, my + 1.6 * cw, s.c('teal'), 0.45, 2.2);
        s.text('axis 0', mx - u * 5, my + 0.8 * cw, { size: 3.4, font: 'mono', align: 'right', color: s.c('teal') });
        s.arrow(mx, my - u * 3, mx + 3 * cw, my - u * 3, s.c('orange'), 0.45, 2.2);
        s.text('axis 1', mx + 1.5 * cw, my - u * 6, { size: 3.4, font: 'mono', color: s.c('orange') });
      });
      const px = s.tall ? w / 2 : w * 0.68;
      const py = s.tall ? h * 0.6 : h * 0.36;
      props(px, py, [
        ['shape', '(2, 3)', s.ease('Minfo', 0.5, 0.2)],
        ['ndim', '2', s.ease('Minfo', 0.5, 1.8)],
        ['dtype', 'float64', s.ease('Minfo', 0.5, 3)],
      ]);
    });
    // The dtypes that matter.
    s.alpha(s.win('dtypes', 'make'), () => {
      const chips: [string, string, string, number][] = [
        ['float64', '3.14', 'decimals', 0.5],
        ['int64', '42', 'whole numbers', 0.5],
        ['uint8', '0 to 255', 'raw pixels', 1],
        ['bool', 'True', 'True / False', 1],
      ];
      const cw = Math.min(u * 50, (w - u * 14) / 2);
      const chh = u * 20;
      chips.forEach(([name, ex, what, a], i) => {
        const x = w / 2 - cw - u * 2 + (i % 2) * (cw + u * 4);
        const y = h * 0.3 + Math.floor(i / 2) * (chh + u * 5);
        const e = s.ease('dtypes', 0.5, i * 0.5) * a;
        s.alpha(e, () => {
          s.rrect(x, y, cw, chh, 2.2, { fill: s.tint('blue', 0.06), stroke: s.tint('blue', 0.5), lw: 0.3 });
          s.text(name, x + u * 4, y + chh * 0.36, { size: 5, font: 'mono', weight: 650, align: 'left', color: s.c('blue') });
          s.text(ex, x + cw - u * 4, y + chh * 0.36, { size: 4, font: 'mono', align: 'right' });
          s.text(what, x + u * 4, y + chh * 0.74, { size: 3.4, italic: true, align: 'left', color: s.c('--ink-2') });
        });
      });
    });
    // Arrays NumPy builds for you.
    s.alpha(s.win('make', 'comma'), () => {
      const n = MAKERS.length;
      const p = s.prog('make');
      const idx = Math.min(n - 1, Math.floor(p * n * 1.04));
      const [ex, what, vals] = MAKERS[idx]!;
      s.slot('make', ex);
      const local = p * n * 1.04 - idx;
      const a = smooth(local / 0.18) * (idx === n - 1 ? 1 : 1 - smooth((local - 0.85) / 0.15));
      s.alpha(a, () => {
        s.text(ex, w / 2, h * 0.26, { size: 5, font: 'mono', weight: 650, color: s.c('blue') });
        s.text(what, w / 2, h * 0.34, { size: 3.8, italic: true, color: s.c('--ink-2') });
        const cols = vals[0]!.length;
        const cw = Math.min(u * 12, (w - u * 20) / cols);
        const ch = cw * 0.8;
        const gx = (w - cols * cw) / 2;
        const gy = h * 0.44;
        grid(s, gx, gy, cw, ch, vals, (i, j) => (idx === 2 && i === j ? 'purple' : 'blue'), { size: 4, on: (i, j) => (idx === 2 && i === j ? 0.6 : 0) });
      });
      // a strip of all six, filling in as they appear
      ['zeros', 'full', 'eye', 'arange', 'linspace', 'randn'].forEach((nm, i) => {
        const x = w / 2 + (i - 2.5) * Math.min(u * 18, w / 6.2);
        s.alpha(i <= idx ? (i === idx ? 1 : 0.5) : 0.18, () => s.text(nm, x, h * 0.88, { size: 3.2, font: 'mono', weight: i === idx ? 700 : 500, color: s.c(i === idx ? 'blue' : '--ink-3') }));
      });
    });
    // (3,) versus (3, 1) versus (1, 3).
    const cA = s.ease('comma', 0.6);
    s.alpha(cA, () => {
      const cw = Math.min(u * 9, w * 0.08);
      const two = s.ease('col', 0.8, 0.3);
      const slots = [lerp(w * 0.5, w * 0.18, two), w * 0.5, w * 0.8];
      const y0 = h * 0.3;
      // flat
      const fx = slots[0]! - 1.5 * cw;
      grid(s, fx, y0 + cw, cw, cw * 0.8, [[1, 2, 3]], 'blue', { size: 3.8, on: () => 1 - two * 0.7 });
      pill(s, '(3,)', slots[0]!, y0 + cw * 2.8, 'blue', { size: 4 });
      s.text('flat: 1-D', slots[0]!, y0 + cw * 4.2, { size: 3.4, italic: true, color: s.c('--ink-2') });
      s.text('[1, 2, 3]', slots[0]!, y0 + cw * 5.4, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      s.alpha(two, () => {
        const cx = slots[1]! - cw / 2;
        grid(s, cx, y0 - cw * 0.2, cw, cw * 0.8, [[1], [2], [3]], 'orange', { size: 3.8 });
        frame(s, cx, y0 - cw * 0.2, cw, cw * 2.4, 'orange', 0.4);
        pill(s, '(3, 1)', slots[1]!, y0 + cw * 2.8, 'orange', { size: 4 });
        s.text('a column: 2-D', slots[1]!, y0 + cw * 4.2, { size: 3.4, italic: true, color: s.c('--ink-2') });
        s.text('[[1], [2], [3]]', slots[1]!, y0 + cw * 5.4, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        const rx = slots[2]! - 1.5 * cw;
        grid(s, rx, y0 + cw, cw, cw * 0.8, [[1, 2, 3]], 'purple', { size: 3.8 });
        frame(s, rx, y0 + cw, cw * 3, cw * 0.8, 'purple', 0.4);
        pill(s, '(1, 3)', slots[2]!, y0 + cw * 2.8, 'purple', { size: 4 });
        s.text('a row: 2-D', slots[2]!, y0 + cw * 4.2, { size: 3.4, italic: true, color: s.c('--ink-2') });
        s.text('[[1, 2, 3]]', slots[2]!, y0 + cw * 5.4, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      });
      s.alpha(s.ease('col', 0.6, 4), () => s.text('three different shapes, three different arrays', w / 2, h * 0.88, { size: 3.8, italic: true, color: s.c('--accent') }));
    });
  },
};

// ---------------------------------------------------------------- indexing

function aLayout(s: Scene) {
  const { w, h, u } = s;
  const cw = Math.min(u * 10, (w - u * 20) / 6);
  const ch = cw * 0.8;
  const gx = (w - 6 * cw) / 2 + u * 1.5;
  const gy = h * 0.18;
  return { cw, ch, gx, gy };
}

/** The practice grid, with lit cells and per-cell labels. */
function drawA(s: Scene, o: { lit?: (i: number, j: number) => number; k?: K; dimOthers?: boolean; label?: (i: number, j: number) => string; hotRows?: number[]; hotCols?: number[]; appear?: (k: number) => number } = {}): void {
  const { u } = s;
  const { cw, ch, gx, gy } = aLayout(s);
  for (let j = 0; j < 6; j++) {
    const hot = o.hotCols?.includes(j);
    s.text(String(j), gx + j * cw + cw / 2, gy - u * 2.6, { font: 'mono', size: 3, weight: hot ? 700 : 500, color: s.c(hot ? 'purple' : '--ink-3') });
  }
  for (let i = 0; i < 4; i++) {
    const hot = o.hotRows?.includes(i);
    s.text(String(i), gx - u * 2.4, gy + i * ch + ch / 2, { font: 'mono', size: 3, weight: hot ? 700 : 500, color: s.c(hot ? 'purple' : '--ink-3') });
  }
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 6; j++) {
      const a = o.appear ? o.appear(i * 6 + j) : 1;
      if (a <= 0) continue;
      const lit = o.lit ? o.lit(i, j) : 0;
      const dim = o.dimOthers && lit < 0.5 ? 0.42 : 1;
      s.alpha(a * dim, () => s.cell(gx + j * cw, gy + i * ch, cw, ch, o.label ? o.label(i, j) : String(AV(i, j)), lit > 0.5 ? (o.k ?? 'purple') : 'slate', { on: lit, size: 3.6 }));
    }
  s.text('a', gx - u * 7, gy + 2 * ch, { size: 5.4, italic: true, weight: 650, color: s.c('slate') });
}

/** Lays out a result of `shape` centered at (cx, top); returns each value's cell rect. */
function resultRects(shape: number[], n: number, cx: number, top: number, rc: number): [number, number, number, number][] {
  const rows = shape.length === 2 ? shape[0]! : 1;
  const cols = shape.length === 2 ? shape[1]! : shape.length === 1 ? shape[0]! : 1;
  const rh = rc * 0.8;
  const x0 = cx - (cols * rc) / 2;
  return Array.from({ length: n }, (_, k) => [x0 + (k % cols) * rc, top + Math.floor(k / cols) * rh, rc, rh]);
}

const IDX_STEPS: { beat: string; f: number; expr: string }[] = [
  { beat: 'one', f: 0.45, expr: 'a[1, 3]' },
  { beat: 'row', f: 0, expr: 'a[2]' },
  { beat: 'col', f: 0, expr: 'a[:, 0]' },
  { beat: 'block', f: 0, expr: 'a[1:3, 2:5]' },
  { beat: 'step', f: 0, expr: 'a[::2, ::3]' },
  { beat: 'step', f: 0.58, expr: 'a[-1]' },
  { beat: 'view', f: 0, expr: 'a[1:3, 2:5]' },
];

const indexing: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const { cw, ch, gx, gy } = aLayout(s);
    const below = gy + 4 * ch;
    // Which expression is on, and since when.
    let step: (typeof IDX_STEPS)[number] | null = null;
    let t0 = 0;
    for (const st of IDX_STEPS) {
      const t = at(s, st.beat, st.f);
      if (s.t >= t) {
        step = st;
        t0 = t;
      }
    }
    const inDrop = s.since('drop') >= 0 && s.since('block') < 0;
    const res = step ? evalIndex(step.expr, 4, 6, AV) : null;
    const ok = res && res.ok ? res : null;
    const sel = new Set(ok ? ok.cells.map(([r, c]) => `${r},${c}`) : []);
    const fly = smooth((s.t - t0 - 0.5) / 0.9);
    const wrote = s.ease('write', 0.6, 1);
    const label = (i: number, j: number) => (wrote > 0.5 && i === 1 && j === 2 ? '99' : String(AV(i, j)));
    const hotRows = ok ? [...new Set(ok.cells.map(([r]) => r))] : [];
    const hotCols = ok ? [...new Set(ok.cells.map(([, c]) => c))] : [];
    // The pour: 0 to 23, row by row.
    const pour = (k: number) => smooth((s.since('grid') - 0.6 - k * 0.09) / 0.3);
    drawA(s, {
      lit: (i, j) => (sel.has(`${i},${j}`) ? 1 : 0),
      dimOthers: !!ok,
      label,
      hotRows: step?.beat === 'one' ? hotRows : [],
      hotCols: step?.beat === 'one' ? hotCols : [],
      appear: s.since('one') < 0 ? pour : undefined,
    });
    s.alpha(s.win('grid', 'one'), () => s.text('np.arange(24).reshape(4, 6)', w / 2, below + u * 9, { size: 4.2, font: 'mono', weight: 600, color: s.c('slate') }));
    if (!ok || !step) return;
    const ey = below + u * 7;
    const isView = s.since('view') >= 0;
    const exprTxt = isView ? 's = a[1:3, 2:5]' : step.expr;
    if (!inDrop) s.alpha(smooth((s.t - t0) / 0.4), () => s.text(exprTxt, w / 2, ey, { size: 4.6, font: 'mono', weight: 650, color: s.c('purple') }));
    const rc = Math.min(u * 8, (w - u * 16) / Math.max(6, ok.cells.length));
    const top = ey + u * 5;
    // Values fly from the grid down into the result.
    const drawFlying = (cells: [number, number][], rects: [number, number, number, number][], p: number) =>
      cells.forEach(([r, c], k) => {
        const [tx, ty, tw, th] = rects[k]!;
        const x = lerp(gx + c * cw, tx, p);
        const y = lerp(gy + r * ch, ty, p);
        s.cell(x, y, lerp(cw, tw, p), lerp(ch, th, p), label(r, c), 'purple', { on: 0.4, size: lerp(3.6, 3.4, p) });
      });
    if (inDrop) {
      // Integer drops the axis, slice keeps it.
      const lx = w * 0.3;
      const rx = w * 0.72;
      const flat = resultRects([4], 4, lx, top, rc);
      drawFlying(ok.cells, flat, 1);
      s.text('a[:, 0]', lx, ey, { size: 4.2, font: 'mono', weight: 650, color: s.c('purple') });
      pill(s, '(4,)', lx, top + rc * 0.8 + u * 5, 'purple', { size: 3.6 });
      s.text('integer: axis removed', lx, top + rc * 0.8 + u * 12, { size: 3.4, italic: true, color: s.c('--ink-2') });
      const kp = s.ease('drop', 0.6, 3.4);
      s.alpha(kp, () => {
        const cr = rc * 0.8;
        ok.cells.forEach(([r, c], k) => s.cell(rx - rc / 2, top + k * cr, rc, cr, label(r, c), 'teal', { on: 0.4, size: 3.4 }));
        s.text('a[:, 0:1]', rx, ey, { size: 4.2, font: 'mono', weight: 650, color: s.c('teal') });
        pill(s, '(4, 1)', rx + rc / 2 + u * 3, top + 2 * cr, 'teal', { size: 3.6, align: 'left' });
        s.text('slice: axis kept', rx, top + 4 * cr + u * 4, { size: 3.4, italic: true, color: s.c('--ink-2') });
      });
      return;
    }
    if (isView) {
      // s is a window onto a.
      const bx = gx + 2 * cw;
      const by = gy + ch;
      s.alpha(s.ease('view', 0.6, 0.6), () => frame(s, bx, by, 3 * cw, 2 * ch, 'purple', 0.8));
      const rects = resultRects([2, 3], 6, w / 2, top, rc * 1.15);
      const p = s.ease('view', 1, 1.6);
      s.alpha(p, () => {
        const [x0, y0] = rects[0]!;
        const [x1, y1, rw, rh] = rects[5]!;
        s.line(bx, by + 2 * ch + u * 0.6, x0, y0 - u * 0.6, s.tint('purple', 0.45), 0.25, [0.8, 0.8]);
        s.line(bx + 3 * cw, by + 2 * ch + u * 0.6, x1 + rw, y0 - u * 0.6, s.tint('purple', 0.45), 0.25, [0.8, 0.8]);
        ok.cells.forEach(([r, c2], k) => {
          const [x, y, cw2, ch2] = rects[k]!;
          s.cell(x, y, cw2, ch2, label(r, c2), 'purple', { on: r === 1 && c2 === 2 ? wrote : 0.3, size: 3.6 });
        });
        s.text('a view: the same memory, no copy', w / 2, y1 + rh + u * 6, { size: 3.6, italic: true, color: s.c('--ink-2') });
      });
      if (wrote > 0) {
        flash(s, gx + 2 * cw, gy + ch, cw, ch, s.ease('write', 1, 1));
        const [x, y, cw2, ch2] = rects[0]!;
        flash(s, x, y, cw2, ch2, s.ease('write', 1, 1));
        s.alpha(wrote, () => s.text('s[0, 0] = 99  changes a[1, 2]', w / 2, h * 0.08 + u * 1, { size: 3.8, font: 'mono', weight: 600, color: s.c('--accent') }));
      }
      return;
    }
    const rects = resultRects(ok.shape, ok.cells.length, w / 2, top, rc);
    drawFlying(ok.cells, rects, fly);
    const last = rects[rects.length - 1]!;
    const sy = last[1] + last[3] + u * 5;
    s.alpha(smooth((s.t - t0 - 1.2) / 0.5), () => {
      pill(s, `shape ${shapeStr(ok.shape)}`, w / 2, sy, 'purple', { size: 3.6 });
    });
    if (step.beat === 'col') {
      // Not a column: the result comes back flat.
      const nf = s.ease('flat', 0.6, 2.2);
      s.alpha(nf, () => {
        const gx2 = w / 2 + rc * 2 + u * 10;
        for (let k = 0; k < 4; k++) ghost(s, gx2, top - u * 4 + k * rc * 0.75, rc * 0.9, rc * 0.75, '', 'red');
        cross(s, gx2 + rc * 0.45, top - u * 4 + rc * 1.5, u * 2.4);
        s.text('not (4, 1)', gx2 + rc * 0.45, top - u * 4 + rc * 3 + u * 4, { size: 3.4, font: 'mono', color: s.c('red') });
      });
    }
    if (step.beat === 'one') s.alpha(fly, () => s.text('a single number', w / 2, sy + u * 7, { size: 3.4, italic: true, color: s.c('--ink-2') }));
  },
};

// ---------------------------------------------------------------- picking

const HIDDEN = (() => {
  const r = new Rng(9);
  return Array.from({ length: 3 }, () => Array.from({ length: 6 }, () => Math.round(r.uniform(-2, 2) * 10) / 10));
})();
const YPRED = [2, 0, 1, 1, 0, 3, 2, 2];
const YTRUE = [2, 0, 3, 1, 0, 3, 2, 1];

const picking: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const { cw: acw, ch: ach, gx: agx, gy: agy } = aLayout(s);
    const below = agy + 4 * ach;
    // A teaser: one array of rows, one of columns, paired up.
    s.alpha(s.win('ints', 'setup'), () => {
      const res = evalIndex('a[[0, 3], [1, 4]]', 4, 6, AV);
      const sel = new Set(res.ok ? res.cells.map(([r, c]) => `${r},${c}`) : []);
      const p = s.ease('ints', 0.6, 1.5);
      drawA(s, { lit: (i, j) => (sel.has(`${i},${j}`) ? p : 0), dimOthers: p > 0.5 });
      s.text('a[[0, 3], [1, 4]]', w / 2, below + u * 7, { size: 4.6, font: 'mono', weight: 650, color: s.c('purple') });
      s.alpha(s.ease('ints', 0.6, 2.2), () => {
        s.text('pairs (0, 1) and (3, 4)', w / 2, below + u * 15, { size: 3.8, font: 'mono', color: s.c('--ink-2') });
        s.text('→  [1, 22]', w / 2, below + u * 23, { size: 4.2, font: 'mono', weight: 650, color: s.c('purple') });
      });
    });
    // Scores and the correct class of each row.
    const sA = s.win('setup', 'mask');
    if (sA > 0) {
      const beat = current(s, ['setup', 'rows', 'pick', 'one', 'wrong', 'write']);
      const pp = s.since('pick') >= 0 ? clamp01(s.prog('pick') * 1.15) * 5 : 0;
      const active = beat === 'pick' ? Math.min(4, Math.floor(pp)) : beat === 'rows' ? Math.floor((s.since('rows') * 1.4) % 5) : undefined;
      const wrong = s.win('wrong', 'write', 0.5);
      const setupPick = s.since('setup') >= 0 && s.since('rows') < 0 ? clamp01((s.since('setup') - 5.5) / 2.5) * 5 : 0;
      const picked = s.since('pick') >= 0 ? (beat === 'write' || beat === 'one' || beat === 'wrong' ? 5 : pp) : s.since('rows') >= 0 ? 0 : setupPick;
      s.alpha(sA, () => {
        drawScores(s, {
          picked,
          yA: s.ease('setup', 0.6, 3.4),
          rowsA: s.ease('rows', 0.6),
          corr: s.since('pick') >= 0 ? (beat === 'pick' ? pp : 5) : 0,
          active,
          wrong,
          zero: s.ease('write', 0.6, 1.4),
        });
        const { gy, ch } = scoresLayout(s);
        const ly = gy + 5 * ch + u * 8;
        s.alpha(s.win('pick', 'wrong') , () => {
          const pairs = Y.map((c, i) => `(${i}, ${c})`);
          const shown = beat === 'pick' ? Math.ceil(pp) : 5;
          s.text(pairs.slice(0, shown).join('  '), w / 2, ly, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
          s.alpha(s.ease('one', 0.5), () => pill(s, 'correct: shape (5,), no loop', w / 2, ly + u * 9, 'purple', { size: 3.6 }));
        });
        s.alpha(wrong, () => {
          s.text('scores[:, y]', w / 2, ly, { size: 4.2, font: 'mono', weight: 650, color: s.c('red') });
          pill(s, 'shape (5, 5): every row at every label', w / 2, ly + u * 9, 'red', { size: 3.4 });
        });
        s.alpha(s.ease('write', 0.6, 0.6), () => s.text('margins[rows, y] = 0', w / 2, ly, { size: 4.2, font: 'mono', weight: 650, color: s.c('green') }));
      });
    }
    // Boolean masks.
    const mA = s.win('mask', 'relu');
    if (mA > 0) {
      const beat = current(s, ['mask', 'sel', 'and'])!;
      const cond = beat === 'and' ? (v: number) => v > 3 && v < 10 : (v: number) => v > 15;
      const asBool = beat === 'mask' && s.since('mask') > 2.6;
      const lit = (i: number, j: number) => (cond(AV(i, j)) ? (beat === 'mask' ? s.ease('mask', 0.5, 2.6) : 1) : 0);
      s.alpha(mA, () => {
        drawA(s, { lit, k: 'red', dimOthers: s.since('mask') > 2.6, label: (i, j) => (asBool ? (cond(AV(i, j)) ? 'T' : 'F') : String(AV(i, j))) });
        const ey = below + u * 7;
        const expr = beat === 'mask' ? 'mask = a > 15' : beat === 'sel' ? 'a[mask]' : 'a[(a > 3) & (a < 10)]';
        s.text(expr, w / 2, ey, { size: 4.6, font: 'mono', weight: 650, color: s.c('red') });
        if (beat === 'mask') s.alpha(s.ease('mask', 0.5, 3.2), () => pill(s, 'bool, shape (4, 6)', w / 2, ey + u * 9, 'red', { size: 3.6 }));
        if (beat !== 'mask') {
          const cells: [number, number][] = [];
          for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) if (cond(AV(i, j))) cells.push([i, j]);
          const rc = Math.min(u * 9, (w - u * 16) / cells.length);
          const rects = resultRects([cells.length], cells.length, w / 2, ey + u * 5, rc);
          const p = s.ease(beat, 0.9, 0.6);
          cells.forEach(([r, c], k) => {
            const [tx, ty, tw, th] = rects[k]!;
            s.cell(lerp(agx + c * acw, tx, p), lerp(agy + r * ach, ty, p), lerp(acw, tw, p), lerp(ach, th, p), String(AV(r, c)), 'red', { on: 0.4, size: 3.4 });
          });
          s.alpha(s.ease(beat, 0.5, 1.6), () => pill(s, `a flat copy, shape (${cells.length},)`, w / 2, ey + u * 18, 'red', { size: 3.4 }));
          if (beat === 'and')
            s.alpha(s.ease('and', 0.5, 4), () => {
              cross(s, w / 2 - u * 21, ey + u * 26, u * 2);
              s.text('a > 3 and a < 10: an error', w / 2 - u * 17, ey + u * 26, { size: 3.4, font: 'mono', align: 'left', color: s.c('red') });
            });
        }
      });
    }
    // Assigning through a mask: a ReLU.
    s.alpha(s.win('relu', 'acc'), () => {
      const cw = Math.min(u * 11, (w - u * 20) / 6);
      const ch = cw * 0.8;
      const gx = (w - 6 * cw) / 2 + u * 3;
      const gy = h * 0.22;
      const done = s.ease('relu', 0.6, 3);
      s.text('hidden', gx - u * 3, gy + ch * 1.5, { size: 3.8, font: 'mono', weight: 600, align: 'right', color: s.c('slate') });
      HIDDEN.forEach((row, i) =>
        row.forEach((v, j) => {
          const neg = v < 0;
          s.cell(gx + j * cw, gy + i * ch, cw, ch, neg && done > 0.5 ? '0' : fmt(v, 2), neg ? 'red' : 'slate', { on: neg ? 1 - done : 0, size: 3.6 });
          if (neg) flash(s, gx + j * cw, gy + i * ch, cw, ch, done * 1.3, 'green');
        }),
      );
      s.text('hidden[hidden < 0] = 0', w / 2, gy + 3 * ch + u * 9, { size: 4.4, font: 'mono', weight: 650, color: s.c('red') });
      s.alpha(done, () => s.text('a ReLU, in place, in one line', w / 2, gy + 3 * ch + u * 17, { size: 3.6, italic: true, color: s.c('--ink-2') }));
    });
    // Accuracy is the mean of a boolean array.
    s.alpha(s.ease('acc', 0.6), () => {
      const n = YPRED.length;
      const cw = Math.min(u * 10, (w - u * 30) / n);
      const ch = cw * 0.85;
      const gx = (w - n * cw) / 2 + u * 7;
      const gy = h * 0.24;
      const eq = s.ease('acc', 0.6, 1.8);
      const rowsY = [gy, gy + ch + u * 2, gy + 2 * ch + u * 7];
      s.text('y_pred', gx - u * 3, rowsY[0]! + ch / 2, { size: 3.6, font: 'mono', align: 'right', color: s.c('purple') });
      s.text('y', gx - u * 3, rowsY[1]! + ch / 2, { size: 3.8, font: 'mono', weight: 650, align: 'right', color: s.c('gold') });
      for (let i = 0; i < n; i++) {
        s.cell(gx + i * cw, rowsY[0]!, cw, ch, String(YPRED[i]), 'purple', { size: 3.6 });
        s.cell(gx + i * cw, rowsY[1]!, cw, ch, String(YTRUE[i]), 'gold', { size: 3.6 });
        const same = YPRED[i] === YTRUE[i];
        s.alpha(eq, () => s.cell(gx + i * cw, rowsY[2]!, cw, ch, same ? 'T' : 'F', same ? 'green' : 'red', { on: same ? 0.5 : 0.3, size: 3.6 }));
      }
      s.alpha(eq, () => s.text('==', gx - u * 3, rowsY[2]! + ch / 2, { size: 3.8, font: 'mono', weight: 650, align: 'right', color: s.c('--ink-2') }));
      s.alpha(s.ease('acc', 0.6, 3.6), () => {
        s.text('np.mean(y_pred == y)  →  0.75', w / 2, rowsY[2]! + ch + u * 10, { size: 4.2, font: 'mono', weight: 650, color: s.c('green') });
        s.text('6 of 8 True: the accuracy', w / 2, rowsY[2]! + ch + u * 17, { size: 3.6, italic: true, color: s.c('--ink-2') });
      });
    });
  },
};

// ---------------------------------------------------------------- math

const A2 = [
  [1, 2],
  [3, 4],
];
const A3 = [
  [1, 5, 2, 0],
  [4, 3, 6, 1],
  [2, 7, 1, 3],
];

const math: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cw = Math.min(u * 10, (w - u * 30) / 7);
    const ch = cw * 0.8;
    /** Three 2 x 2 grids in a row: a op b = c. */
    const trio = (y: number, op: string, c: (string | number)[][], o: { lit?: (i: number, j: number) => number; litB?: (i: number, j: number) => number; litC?: (i: number, j: number) => number; cA?: number; ck?: K; left?: string } = {}) => {
      const gap = u * 9;
      const x0 = (w - (6 * cw + 2 * gap)) / 2 + u * 2;
      const ab = [x0, x0 + 2 * cw + gap, x0 + 4 * cw + 2 * gap];
      grid(s, ab[0]!, y, cw, ch, A2, 'blue', { on: o.lit, size: 4 });
      s.text(op, ab[0]! + 2 * cw + gap / 2, y + ch, { size: 5, font: 'mono', weight: 600, color: s.c('--ink-2') });
      grid(s, ab[1]!, y, cw, ch, A2, 'blue', { on: o.litB ?? o.lit, size: 4 });
      s.text('=', ab[1]! + 2 * cw + gap / 2, y + ch, { size: 5, font: 'mono', color: s.c('--ink-2') });
      s.alpha(o.cA ?? 1, () => grid(s, ab[2]!, y, cw, ch, c, o.ck ?? 'purple', { on: o.litC, size: 4 }));
      s.text('A', ab[0]! + cw, y - u * 3, { size: 4, italic: true, weight: 650, color: s.c('blue') });
      s.text('A', ab[1]! + cw, y - u * 3, { size: 4, italic: true, weight: 650, color: s.c('blue') });
      if (o.left) s.text(o.left, ab[2]! + cw, y + 2 * ch + u * 4, { size: 3.6, font: 'mono', weight: 600, color: s.c(o.ck ?? 'purple') });
    };
    // Entry by entry.
    s.alpha(s.win('elem', 'mat'), () => {
      const y = h * 0.2;
      const plus = s.since('mul') < 0 && s.prog('elem') < 0.45;
      const cyc = Math.floor(s.since('elem') * 1.6) % 4;
      const pos = (i: number, j: number) => (s.since('mul') < 0 && i * 2 + j === cyc ? 1 : 0);
      const mulOrder = Math.floor(s.prog('mul') * 5.5) - 1;
      const litC = (i: number, j: number) => (s.since('mul') >= 0 && s.since('ufunc') < 0 ? (i * 2 + j === mulOrder ? 1 : 0.2) : pos(i, j));
      trio(y, plus ? '+' : '*', A2.map((r) => r.map((v) => (plus ? 2 * v : v * v))), { lit: pos, litC, left: plus ? 'A + A' : 'A * A' });
      s.alpha(s.ease('elem', 0.5, 1.2), () => s.text('matching entries pair up', w / 2, y + 2 * ch + u * 11, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      s.alpha(s.ease('ufunc', 0.6), () => {
        const y2 = h * 0.6;
        const x0 = w / 2 - 3 * cw - u * 4;
        grid(s, x0, y2, cw, ch, A2, 'blue', { size: 4 });
        s.text('np.sqrt', w / 2, y2 + ch - u * 3, { size: 3.8, font: 'mono', weight: 600, color: s.c('teal') });
        s.arrow(x0 + 2 * cw + u * 2, y2 + ch + u, w / 2 + cw + u * 2, y2 + ch + u, s.c('teal'), 0.45, 2.2);
        const sq = A2.map((r) => r.map((v) => fmt(Math.sqrt(v), 3)));
        grid(s, w / 2 + cw + u * 4, y2, cw * 1.1, ch, sq, 'teal', { size: 3.6, a: (i, j) => smooth((s.since('ufunc') - 1.2 - (i * 2 + j) * 0.3) / 0.4) });
        s.text('every entry at once', w / 2, y2 + 2 * ch + u * 6, { size: 3.6, italic: true, color: s.c('--ink-2') });
      });
    });
    // The matrix product.
    s.alpha(s.win('mat', 'relu'), () => {
      const y = h * 0.2;
      const P = [
        [7, 10],
        [15, 22],
      ];
      const first = s.since('bug') < 0;
      const lit = (i: number) => (first && i === 0 ? 1 : 0);
      trio(y, '@', P, {
        lit: (i) => lit(i),
        litB: (_, j) => (first && j === 0 ? 1 : 0),
        litC: (i, j) => (first && i === 0 && j === 0 ? 1 : 0.2),
        cA: s.ease('mat', 0.6, 2.6),
        ck: 'teal',
        left: 'A @ A',
      });
      s.alpha(s.ease('mat', 0.6, 5) * (1 - s.ease('bug', 0.5)), () => {
        s.text('row 0 · column 0', w / 2, y + 2 * ch + u * 11, { size: 3.6, italic: true, color: s.c('--ink-2') });
        s.text('1·1 + 2·3 = 7', w / 2, y + 2 * ch + u * 19, { size: 4.6, font: 'mono', weight: 650, color: s.c('teal') });
      });
      s.alpha(s.ease('bug', 0.6), () => {
        const y2 = h * 0.62;
        const lx = w / 2 - 2 * cw - u * 8;
        const rx = w / 2 + u * 8;
        grid(s, lx, y2, cw, ch, [[1, 4], [9, 16]], 'purple', { size: 4 });
        grid(s, rx, y2, cw, ch, P, 'teal', { size: 4 });
        s.text('≠', w / 2, y2 + ch, { size: 6, font: 'mono', color: s.c('red') });
        s.text('A * A', lx + cw, y2 + 2 * ch + u * 4, { size: 3.6, font: 'mono', weight: 600, color: s.c('purple') });
        s.text('A @ A', rx + cw, y2 + 2 * ch + u * 4, { size: 3.6, font: 'mono', weight: 600, color: s.c('teal') });
        s.text('both legal, different answers', w / 2, y2 + 2 * ch + u * 11, { size: 3.6, italic: true, color: s.c('red') });
      });
    });
    // The ReLU backward pass: the star with a mask.
    s.alpha(s.win('relu', 'reduce'), () => {
      const xs = [-1.5, 2.0, -0.3, 0.8];
      const dout = [0.4, -0.2, 0.9, 0.5];
      const rows: [string, string[], K, number][] = [
        ['x', xs.map((v) => fmt(v, 2)), 'orange', 0.4],
        ['x > 0', xs.map((v) => (v > 0 ? 'True' : 'False')), 'red', 1.8],
        ['dout', dout.map((v) => fmt(v, 2)), 'teal', 3.2],
        ['dx', dout.map((v, i) => (xs[i]! > 0 ? fmt(v, 2) : '0')), 'teal', 5],
      ];
      const rcw = Math.min(u * 13, (w - u * 34) / 4);
      const rch = u * 8.5;
      const gx = (w - 4 * rcw) / 2 + u * 9;
      rows.forEach(([lab, vals, k, d], r) => {
        const y = h * 0.16 + r * (rch + u * 3.2) + (r === 3 ? u * 4 : 0);
        s.alpha(s.ease('relu', 0.5, d), () => {
          s.text(lab, gx - u * 3, y + rch / 2, { size: 3.8, font: 'mono', weight: 650, align: 'right', color: s.c(k) });
          vals.forEach((v, i) => s.cell(gx + i * rcw, y, rcw, rch, v, k, { on: r === 3 && xs[i]! > 0 ? 0.5 : 0, size: 3.4 }));
        });
      });
      s.alpha(s.ease('relu', 0.5, 5), () => s.text('dx = dout * (x > 0)', w / 2, h * 0.84, { size: 4.2, font: 'mono', weight: 650, color: s.c('teal') }));
    });
    // Reductions: the axis you name disappears.
    const rA = s.ease('reduce', 0.6);
    if (rA > 0) {
      const rcw = Math.min(u * 10, (w - u * 30) / 5.7);
      const gx = (w - 5.7 * rcw) / 2;
      const gy = h * 0.16;
      const beat = current(s, ['reduce', 'ax0', 'ax1', 'rule', 'keep', 'argmax'])!;
      const mode = beat === 'reduce' ? 'all' : beat === 'ax0' ? 'ax0' : 'ax1';
      const t0 = beat === 'reduce' ? at(s, 'reduce', 0.55) : beat === 'ax0' || beat === 'ax1' ? s.at(beat) + 0.6 : -1e9;
      const fly = clamp01((s.t - t0) / 1);
      const e = smooth(fly);
      const argmax = beat === 'argmax';
      const winners = A3.map((r) => r.indexOf(Math.max(...r)));
      const target = (i: number, j: number): [number, number] => (mode === 'all' ? [gx + 4.7 * rcw, gy + 3.7 * rcw] : mode === 'ax0' ? [gx + j * rcw, gy + 3.7 * rcw] : [gx + 4.7 * rcw, gy + i * rcw]);
      s.alpha(rA, () => {
        s.text('A', gx - u * 5, gy + 1.5 * rcw, { size: 5, italic: true, weight: 650, color: s.c('blue') });
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 4; j++) {
            const win = argmax && winners[i] === j;
            s.cell(gx + j * rcw, gy + i * rcw, rcw, rcw, String(A3[i]![j]), win ? 'gold' : 'blue', { on: win ? 1 : 0, size: 4 });
          }
        // values in flight
        if (fly > 0 && fly < 1)
          for (let i = 0; i < 3; i++)
            for (let j = 0; j < 4; j++) {
              const [tx, ty] = target(i, j);
              s.alpha(1 - e * 0.6, () => s.cell(lerp(gx + j * rcw, tx, e), lerp(gy + i * rcw, ty, e), rcw, rcw, String(A3[i]![j]), 'blue', { on: 0.5, size: 4 }));
            }
        // arrows showing the collapse direction
        const ink = s.tint('--ink-3', 0.8);
        if (mode === 'ax0') for (let j = 0; j < 4; j++) s.arrow(gx + j * rcw + rcw / 2, gy + 3 * rcw + u, gx + j * rcw + rcw / 2, gy + 3.62 * rcw, ink, 0.35, 1.8);
        if (mode === 'ax1') for (let i = 0; i < 3; i++) s.arrow(gx + 4 * rcw + u, gy + i * rcw + rcw / 2, gx + 4.62 * rcw, gy + i * rcw + rcw / 2, ink, 0.35, 1.8);
        if (mode === 'all') s.arrow(gx + 4 * rcw + u, gy + 3 * rcw + u, gx + 4.62 * rcw, gy + 3.62 * rcw, ink, 0.35, 1.8);
        // results
        if (fly >= 1 || t0 < 0) {
          const keep = beat === 'keep';
          if (mode === 'all') s.cell(gx + 4.7 * rcw, gy + 3.7 * rcw, rcw, rcw, '35', 'purple', { on: 0.6, size: 4.2 });
          if (mode === 'ax0') [7, 15, 9, 4].forEach((v, j) => s.cell(gx + j * rcw, gy + 3.7 * rcw, rcw, rcw, String(v), 'purple', { on: 0.4, size: 4.2 }));
          if (mode === 'ax1') {
            const vals = argmax ? winners : [8, 14, 13];
            vals.forEach((v, i) => s.cell(gx + 4.7 * rcw, gy + i * rcw, rcw, rcw, String(v), argmax ? 'gold' : 'purple', { on: 0.4, size: 4.2 }));
            if (keep) frame(s, gx + 4.7 * rcw, gy, rcw, 3 * rcw, 'purple', 0.7);
          }
          if (mode !== 'all' && !keep) {
            const c = s.ctx;
            c.save();
            c.setLineDash([u * 0.8, u * 0.7]);
            if (mode === 'ax0') s.rrect(gx - u * 0.6, gy + 3.7 * rcw - u * 0.6, 4 * rcw + u * 1.2, rcw + u * 1.2, 1.6, { stroke: s.tint('purple', 0.6), lw: 0.3 });
            else s.rrect(gx + 4.7 * rcw - u * 0.6, gy - u * 0.6, rcw + u * 1.2, 3 * rcw + u * 1.2, 1.6, { stroke: s.tint('purple', 0.6), lw: 0.3 });
            c.restore();
          }
        }
        // captions
        const cy = h * 0.86;
        const cap = beat === 'reduce' ? 'A.sum()  →  35, shape ()' : beat === 'ax0' ? 'A.sum(axis=0)  →  shape (4,)' : beat === 'keep' ? 'keepdims=True  →  shape (3, 1)' : beat === 'argmax' ? 'A.argmax(axis=1)  →  [1 2 1]' : 'A.sum(axis=1)  →  shape (3,)';
        s.alpha(s.since(beat) > 0.3 ? 1 : 0, () => s.text(cap, w / 2, cy, { size: 4.2, font: 'mono', weight: 650, color: s.c(argmax ? 'gold' : 'purple') }));
        s.alpha(s.win('rule', 'keep'), () => {
          const ry = gy + 3 * rcw + u * 9;
          s.text('the axis you name disappears', w / 2, ry, { size: 4.4, font: 'display', weight: 600, color: s.c('--accent') });
          const t1 = '(3, 4)  →  (3,)';
          s.text(t1, w / 2, ry + u * 8, { size: 4.2, font: 'mono', weight: 600 });
          const x4 = w / 2 - s.measure(t1, { font: 'mono', size: 4.2, weight: 600 }) / 2 + s.measure('(3, ', { font: 'mono', size: 4.2, weight: 600 });
          const w4 = s.measure('4', { font: 'mono', size: 4.2, weight: 600 });
          s.line(x4 - u * 0.4, ry + u * 8, x4 + w4 + u * 0.4, ry + u * 8, s.c('red'), 0.5);
        });
        s.alpha(s.ease('argmax', 0.5, 2), () => s.text('the winning column of each row', gx + 2.85 * rcw, gy + 3 * rcw + u * 7, { size: 3.6, italic: true, color: s.c('gold') }));
      });
    }
  },
};

// ---------------------------------------------------------------- broadcasting

const broadcasting: SceneDef = {
  marks: {
    bias: { tex: String.raw`\symscores_{ij} = (\symX\symW)_{ij} + \symb_j`, x: 0.5, y: 0.12, size: 5.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    const cw = Math.min(u * 9, (w - u * 22) / 9.4);
    const ax = (w - (8 * cw + 1.4 * cw)) / 2;
    const bx = ax + 4 * cw + 1.4 * cw;
    const y0 = h * 0.16;
    const cx = (w - 4 * cw) / 2;
    const cy = y0 + 3 * cw + u * 10;
    /** Operand B laid out in A's footprint, real cells solid and stretched ones dashed. */
    const stretchB = (x: number, vals: number[][], k: K, e: number, rows = 3, cols = 4) => {
      const rr = vals.length;
      const cc = vals[0]!.length;
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++) {
          if (i < rr && j < cc) continue;
          const si = i < rr ? i : 0;
          const sj = j < cc ? j : 0;
          if (e <= 0) continue;
          s.alpha(0.35 + 0.65 * e, () => ghost(s, x + (sj + (j - sj) * e) * cw, y0 + (si + (i - si) * e) * cw, cw, cw, String(vals[si]![sj]), k, 3.4));
        }
      grid(s, x, y0, cw, cw, vals, k, { on: () => 0.4, size: 3.6 });
    };
    // A row added to every row.
    s.alpha(s.win('q', 'r1'), () => {
      const A = Array.from({ length: 3 }, (_, i) => Array.from({ length: 4 }, (_, j) => i * 4 + j));
      const B = [[10, 20, 30, 40]];
      grid(s, ax, y0, cw, cw, A, 'blue', { size: 3.6 });
      const st = s.ease('stretch', 1.2, 0.6);
      stretchB(bx, B, 'orange', st);
      s.text(s.since('ex') >= 0 ? '+' : '+ ?', ax + 4.7 * cw, y0 + 1.5 * cw, { size: 5, font: 'mono', color: s.c('--ink-2') });
      pill(s, 'A (3, 4)', ax + 2 * cw, y0 + 3 * cw + u * 4, 'blue', { size: 3.4 });
      pill(s, 'B (4,)', bx + 2 * cw, y0 + 3 * cw + u * 4, 'orange', { size: 3.4 });
      s.alpha(s.ease('ex', 0.6, 1), () => {
        grid(s, cx, cy, cw, cw, A.map((r) => r.map((v, j) => v + B[0]![j]!)), 'purple', { on: () => 0.3, size: 3.6 });
        s.text('=', cx - u * 5, cy + 1.5 * cw, { size: 5, font: 'mono', color: s.c('--ink-2') });
        pill(s, 'C (3, 4)', cx + 2 * cw, cy + 3 * cw + u * 4, 'purple', { size: 3.4 });
      });
      s.alpha(st, () => {
        const tx = cx + 4 * cw + u * 4;
        s.text('stretched,', tx, cy + cw, { size: 3.4, italic: true, align: 'left', color: s.c('orange') });
        s.text('never copied', tx, cy + cw + u * 5, { size: 3.4, italic: true, align: 'left', color: s.c('orange') });
      });
    });
    // The rules, on the shapes.
    s.alpha(s.win('r1', 'outer'), () => {
      const dw = Math.min(u * 26, (w - u * 30) / 2);
      const dh = u * 9;
      const lx = (w - 2 * dw) / 2 + u * 7;
      const rows: [string, (string | null)[], K][] = [
        ['A', ['3', '4'], 'blue'],
        ['B', [null, '4'], 'orange'],
      ];
      const ry = [h * 0.2, h * 0.34];
      const pad = s.ease('r1', 0.8, 3.2);
      rows.forEach(([lab, dims, k], r) => {
        s.text(lab, lx - u * 4, ry[r]! + dh / 2, { size: 4.6, italic: true, weight: 650, color: s.c(k), align: 'right' });
        dims.forEach((d, j) => {
          const x = lx + j * dw + u;
          if (d) s.cell(x, ry[r]!, dw - 2 * u, dh, d, k, { on: 0.3, size: 4.4 });
          else if (pad > 0) s.alpha(pad, () => ghost(s, x - (1 - pad) * u * 8, ry[r]!, dw - 2 * u, dh, '1', k, 4.4));
        });
      });
      s.alpha(s.ease('r1', 0.5, 0.8), () => s.text('line up from the right', lx + dw * 2 + u * 2, ry[0]! - u * 5, { size: 3.4, italic: true, align: 'right', color: s.c('--ink-2') }));
      s.alpha(pad, () => s.text('pad with 1', lx + dw / 2, ry[1]! + dh + u * 4.5, { size: 3.4, italic: true, color: s.c('orange') }));
      const c1 = s.ease('r2', 0.5, 1.4);
      const c0 = s.ease('r2', 0.5, 3.4);
      const nx = lx + u * 2;
      s.alpha(c1, () => {
        check(s, nx, h * 0.53, u * 1.9);
        s.text('last axis: 4 and 4 are equal', nx + u * 3.5, h * 0.53, { size: 3.6, align: 'left', color: s.c('green') });
      });
      s.alpha(c0, () => {
        check(s, nx, h * 0.61, u * 1.9);
        s.text('first axis: the 1 stretches to 3', nx + u * 3.5, h * 0.61, { size: 3.6, align: 'left', color: s.c('green') });
      });
      s.alpha(s.ease('r2', 0.6, 4.6), () => {
        const y = h * 0.72;
        s.text('C', lx - u * 4, y + dh / 2, { size: 4.6, italic: true, weight: 650, color: s.c('purple'), align: 'right' });
        ['3', '4'].forEach((d, j) => s.cell(lx + j * dw + u, y, dw - 2 * u, dh, d, 'purple', { on: 0.5, size: 4.4 }));
      });
    });
    // Both stretch: a multiplication table.
    s.alpha(s.win('outer', 'bad'), () => {
      const col = [[1], [2], [3]];
      const row = [[1, 2, 3, 4]];
      const e = s.ease('outer', 1.2, 1.6);
      stretchB(ax, col, 'orange', e);
      s.text('×', ax + 4.7 * cw, y0 + 1.5 * cw, { size: 5, font: 'mono', color: s.c('--ink-2') });
      stretchB(bx, row, 'blue', e);
      pill(s, 'col (3, 1)', ax + 2 * cw, y0 + 3 * cw + u * 4, 'orange', { size: 3.4 });
      pill(s, 'row (1, 4)', bx + 2 * cw, y0 + 3 * cw + u * 4, 'blue', { size: 3.4 });
      s.alpha(s.ease('outer', 0.6, 3), () => {
        grid(s, cx, cy, cw, cw, col.map((r) => row[0]!.map((v) => v * r[0]!)), 'purple', { on: () => 0.3, size: 3.6 });
        s.text('=', cx - u * 5, cy + 1.5 * cw, { size: 5, font: 'mono', color: s.c('--ink-2') });
        pill(s, 'table (3, 4)', cx + 2 * cw, cy + 3 * cw + u * 4, 'purple', { size: 3.4 });
      });
    });
    // Incompatible shapes.
    s.alpha(s.win('bad', 'bias'), () => {
      const A = Array.from({ length: 3 }, (_, i) => Array.from({ length: 4 }, (_, j) => i * 4 + j));
      grid(s, ax, y0, cw, cw, A, 'blue', { size: 3.6 });
      s.text('+', ax + 4.7 * cw, y0 + 1.5 * cw, { size: 5, font: 'mono', color: s.c('--ink-2') });
      grid(s, bx + cw, y0, cw, cw, [[1, 2, 3]], 'red', { on: () => 0.4, size: 3.6 });
      pill(s, 'A (3, 4)', ax + 2 * cw, y0 + 3 * cw + u * 4, 'blue', { size: 3.4 });
      pill(s, '(3,)', bx + 2.5 * cw, y0 + cw + u * 4, 'red', { size: 3.4 });
      const e = s.ease('bad', 0.6, 2.6);
      s.alpha(e, () => {
        const bw = Math.min(w - u * 12, u * 80);
        const by = cy - u * 2;
        const c = s.ctx;
        c.save();
        c.setLineDash([u, u * 0.8]);
        s.rrect((w - bw) / 2, by, bw, u * 22, 2, { fill: s.tint('red', 0.07), stroke: s.c('red'), lw: 0.35 });
        c.restore();
        s.text('(3, 4)', w / 2 + u * 6, by + u * 6, { size: 4.2, font: 'mono', weight: 600, align: 'right', color: s.c('blue') });
        s.text('   (3,)', w / 2 + u * 6, by + u * 12, { size: 4.2, font: 'mono', weight: 600, align: 'right', color: s.c('red') });
        s.text('4 vs 3: neither is 1', w / 2, by + u * 18, { size: 3.6, italic: true, color: s.c('red') });
        cross(s, w / 2 + u * 14, by + u * 9, u * 2.4);
      });
    });
    // The course's idioms, as shapes.
    const iA = s.ease('bias', 0.6);
    if (iA > 0) {
      const beat = current(s, ['bias', 'center', 'norm'])!;
      const bw = Math.min(u * 42, w * 0.36);
      const bh = u * 30;
      const lx = w / 2 - bw - u * 5;
      const rx = w / 2 + u * 5;
      const by = h * 0.3;
      const e = s.ease(beat, 1.2, 1.4);
      const specs: Record<string, { big: K; bigLab: string; bigShape: string; op: string; small: K; smallLab: string; smallShape: string; col: boolean }> = {
        bias: { big: 'purple', bigLab: 'X.dot(W)', bigShape: '(N, C)', op: '+', small: 'green', smallLab: 'b', smallShape: '(C,)', col: false },
        center: { big: 'orange', bigLab: 'X', bigShape: '(N, D)', op: '−', small: 'orange', smallLab: 'X.mean(axis=0)', smallShape: '(D,)', col: false },
        norm: { big: 'purple', bigLab: 'probs', bigShape: '(N, C)', op: '÷', small: 'purple', smallLab: 'sums', smallShape: '(N, 1)', col: true },
      };
      const sp = specs[beat]!;
      const sa = s.since(beat) < 0.6 ? smooth(s.since(beat) / 0.6) : 1;
      s.show('bias', iA * s.win('bias', 'center'));
      s.alpha(iA * sa, () => {
        s.rrect(lx, by, bw, bh, 1.6, { fill: s.tint(sp.big, 0.14), stroke: s.c(sp.big), lw: 0.45 });
        s.text(sp.bigLab, lx + bw / 2, by + bh / 2 - u * 2.5, { size: 4.2, font: 'mono', weight: 650, color: s.c(sp.big) });
        s.text(sp.bigShape, lx + bw / 2, by + bh / 2 + u * 3.5, { size: 3.8, font: 'mono', color: s.c('--ink-2') });
        s.text(sp.op, w / 2, by + bh / 2, { size: 6, font: 'mono', color: s.c('--ink-2') });
        const k = sp.small;
        const n = 5;
        if (sp.col) {
          const sw = bw / 6;
          for (let j = 1; j < n + 1; j++) s.alpha(e, () => ghost(s, rx + lerp(0, j, e) * sw, by, sw, bh, '', k));
          s.rrect(rx, by, sw, bh, 1.2, { fill: s.tint(k, 0.3), stroke: s.c(k), lw: 0.45 });
        } else {
          const sh = bh / n;
          for (let i = 1; i < n; i++) s.alpha(e, () => ghost(s, rx, by + lerp(0, i, e) * sh, bw, sh, '', k));
          s.rrect(rx, by, bw, sh, 1.2, { fill: s.tint(k, 0.3), stroke: s.c(k), lw: 0.45 });
        }
        s.text(sp.smallLab, rx + bw / 2, by + bh + u * 5.5, { size: 3.8, font: 'mono', weight: 650, color: s.c(k) });
        pill(s, sp.smallShape, rx + bw / 2, by + bh + u * 12, k, { size: 3.6 });
        pill(s, sp.bigShape, lx + bw / 2, by + bh + u * 12, sp.big, { size: 3.6 });
        s.alpha(e, () => s.text(sp.col ? 'stretched across each row' : 'stretched down all N rows', w / 2, h * 0.92, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      });
    }
  },
};

// ---------------------------------------------------------------- distances

const TEST_PTS: [number, number][] = [
  [2.2, 3.6],
  [5.4, 1.4],
  [8.2, 3.2],
];
const TRAIN_PTS: [number, number][] = [
  [1.0, 1.2],
  [3.6, 2.2],
  [6.0, 4.2],
  [7.4, 0.8],
  [9.4, 2.0],
];
const DIST = TEST_PTS.map(([a, b]) => TRAIN_PTS.map(([c, d]) => Math.hypot(a - c, b - d)));

const distances: SceneDef = {
  marks: {
    sq: { tex: String.raw`(x - t)^2 = x^2 - 2\,x\,t + t^2`, x: 0.5, y: 0.34, size: 6.6 },
    vec: { tex: String.raw`\symdists^{\,2} = \|\sym{X}{x}\|^2 - 2\,\sym{X}{x} \cdot \sym{X}{t} + \|\sym{X}{t}\|^2`, x: 0.5, y: 0.6, size: 5.8 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Every test point to every training point, and the table it fills.
    const pA = s.win('task', 'square');
    s.alpha(pA, () => {
      const pw = Math.min(w * 0.8, u * 92);
      const px = (w - pw) / 2;
      const py = h * 0.13;
      const ph = h * 0.36;
      const X = (x: number) => px + (x / 10) * pw;
      const Yp = (y: number) => py + ph - (y / 5) * ph;
      const lines = s.since('task') - 1.5;
      TEST_PTS.forEach(([a, b], i) =>
        TRAIN_PTS.forEach(([c, d], j) => {
          const k = i * 5 + j;
          const la = clamp01(lines * 3.2 - k * 0.6);
          if (la > 0) s.line(X(a), Yp(b), lerp(X(a), X(c), la), lerp(Yp(b), Yp(d), la), s.tint('teal', 0.5), 0.3);
        }),
      );
      TRAIN_PTS.forEach(([c, d]) => s.circle(X(c), Yp(d), u * 1.6, { fill: s.c('--card'), stroke: s.c('orange'), lw: 0.5 }));
      TEST_PTS.forEach(([a, b]) => s.circle(X(a), Yp(b), u * 1.7, { fill: s.c('orange') }));
      s.text('test (filled), training (rings)', w / 2, py + ph + u * 4, { size: 3.4, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('table', 0.6), () => {
        const tcw = Math.min(u * 11, (w - u * 30) / 5);
        const tch = tcw * 0.7;
        const tx = (w - 5 * tcw) / 2 + u * 4;
        const ty = h * 0.64;
        const lo = Math.min(...DIST.flat());
        const hi = Math.max(...DIST.flat());
        s.text('train j', tx + 2.5 * tcw, ty - u * 3, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        s.text('test i', tx - u * 2.5, ty + 1.5 * tch, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-3') });
        DIST.forEach((row, i) =>
          row.forEach((d, j) => {
            const t = (d - lo) / (hi - lo);
            s.rrect(tx + j * tcw + u * 0.3, ty + i * tch + u * 0.3, tcw - u * 0.6, tch - u * 0.6, 1, { fill: s.tint('teal', 0.12 + 0.55 * t) });
            s.text(d.toFixed(1), tx + j * tcw + tcw / 2, ty + i * tch + tch / 2 + u * 0.2, { size: 3.2, font: 'mono', halo: true });
          }),
        );
        pill(s, 'dists (N, M)', tx + 2.5 * tcw, ty + 3 * tch + u * 6, 'teal', { size: 3.4 });
      });
    });
    // School algebra, then its vector form.
    s.show('sq', s.win('square', 'x2'));
    const vecA = s.ease('vec', 0.6);
    const up = s.ease('x2', 0.8);
    s.show('vec', vecA * (1 - s.ease('clip', 0.5)), { y: lerp(0.6, 0.12, up) });
    s.alpha(s.win('square', 'vec') , () => s.text('multiply it out to check', w / 2, h * 0.5, { size: 3.6, italic: true, color: s.c('--ink-2') }));
    // Three blocks that broadcast into one table.
    const bA = s.win('x2', 'clip');
    if (bA > 0) {
      const c = Math.min(u * 6.5, (w - u * 30) / 11);
      const by = h * 0.36;
      const colX = (w - (11 * c + u * 21)) / 2;
      const crossX = colX + c + u * 13;
      const rowX = crossX + 5 * c + u * 8;
      const g = s.ease('glue', 1.4, 1);
      const tx = w / 2 - 2.5 * c;
      const ty = h * 0.42;
      s.alpha(bA, () => {
        const xA = s.ease('x2', 0.6, 0.6);
        const tA = s.ease('t2', 0.6, 0.2);
        const cA = s.ease('cross', 0.6, 0.2);
        // x2: a column, stretched across in the glue step
        s.alpha(xA * (1 - g * 0.15), () => {
          const x = lerp(colX, tx, g);
          const y = lerp(by, ty, g);
          for (let j = 1; j < 5; j++) if (g > 0) s.alpha(g, () => { for (let i = 0; i < 3; i++) ghost(s, x + j * c * g, y + i * c, c, c, '', 'orange'); });
          for (let i = 0; i < 3; i++) s.cell(x, y + i * c, c, c, '', 'orange', { on: 0.5 });
          s.alpha(1 - g, () => {
            pill(s, '(N, 1)', x + c / 2, y + 3 * c + u * 5, 'orange', { size: 3.2 });
            s.text('x2', x + c / 2, y - u * 3, { size: 3.6, font: 'mono', weight: 650, color: s.c('orange') });
          });
        });
        s.alpha(xA * (1 - g), () => s.text('−', colX + c + u * 3.5, by + 1.5 * c, { size: 5, font: 'mono', color: s.c('--ink-2') }));
        s.alpha(cA * (1 - g), () => s.text('2·', crossX - u * 3.5, by + 1.5 * c, { size: 4, font: 'mono', color: s.c('--ink-2') }));
        s.alpha(cA, () => {
          const x = lerp(crossX, tx, g);
          const y = lerp(by, ty, g);
          for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) s.alpha(1 - g * 0.6, () => s.cell(x + j * c, y + i * c, c, c, '', 'blue', { on: 0.3 }));
          s.alpha(1 - g, () => {
            pill(s, '(N, M)', x + 2.5 * c, y + 3 * c + u * 5, 'blue', { size: 3.2 });
            s.text('cross', x + 2.5 * c, y - u * 3, { size: 3.6, font: 'mono', weight: 650, color: s.c('blue') });
          });
        });
        s.alpha(tA * (1 - g), () => s.text('+', crossX + 5 * c + u * 4, by + 1.5 * c, { size: 5, font: 'mono', color: s.c('--ink-2') }));
        s.alpha(tA, () => {
          const x = lerp(rowX, tx, g);
          const y = lerp(by + c, ty, g);
          if (g > 0) s.alpha(g, () => { for (let i = 1; i < 3; i++) for (let j = 0; j < 5; j++) ghost(s, x + j * c, y + i * c * g, c, c, '', 'slate'); });
          for (let j = 0; j < 5; j++) s.cell(x + j * c, y, c, c, '', 'slate', { on: 0.5 });
          s.alpha(1 - g, () => {
            pill(s, '(M,)', x + 2.5 * c, y + c + u * 5, 'slate', { size: 3.2 });
            s.text('t2', x + 2.5 * c, y - u * 3, { size: 3.6, font: 'mono', weight: 650, color: s.c('slate') });
          });
        });
        // the merged table
        const m = s.ease('glue', 0.8, 3.2);
        s.alpha(m, () => {
          for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) s.cell(tx + j * c, ty + i * c, c, c, '', 'teal', { on: 0.7 });
          pill(s, 'd2 (N, M)', tx + 2.5 * c, ty + 3 * c + u * 6, 'teal', { size: 3.6 });
          s.text('every pair, no loops', w / 2, ty + 3 * c + u * 14, { size: 3.6, italic: true, color: s.c('--ink-2') });
        });
      });
    }
    // Clip at zero, then take the square root.
    s.alpha(s.ease('clip', 0.6), () => {
      const rows: [string, string[], K][] = [
        ['d2', ['4.0', '-1e-9', '2.25'], 'slate'],
        ['np.maximum(d2, 0)', ['4.0', '0', '2.25'], 'slate'],
        ['dists', ['2.0', '0', '1.5'], 'teal'],
      ];
      const rcw = Math.min(u * 13, w * 0.12);
      const rch = u * 8;
      const gx = s.tall ? w / 2 - 1.5 * rcw : w / 2 - rcw;
      rows.forEach(([lab, vals, k], r) => {
        const y = h * 0.28 + r * (rch + u * 9);
        s.alpha(s.ease('clip', 0.5, 1 + r * 1.6), () => {
          if (s.tall) s.text(lab, w / 2, y - u * 3.2, { size: 3.4, font: 'mono', weight: 650, color: s.c(k) });
          else s.text(lab, gx - u * 3, y + rch / 2, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c(k) });
          vals.forEach((v, i) => s.cell(gx + i * rcw, y, rcw, rch, v, i === 1 && r === 0 ? 'red' : k, { on: i === 1 ? 0.7 : 0.2, size: 3.4 }));
        });
      });
    });
  },
};

// ---------------------------------------------------------------- reshape

const reshape: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: the same six numbers, read three ways.
    const rA = s.win('reshape', 'img');
    if (rA > 0) {
      const cw = Math.min(u * 9, (w - u * 40) / 7);
      const vx = (w - 6 * cw) / 2;
      const vy = h * 0.16;
      const gap = Math.min(u * 14, (w - 7 * cw) / 4);
      const mx = (w - (7 * cw + 2 * gap)) / 2;
      const rx = mx + 3 * cw + gap;
      const tx = rx + 2 * cw + gap;
      const gy = h * 0.42;
      const ch = cw * 0.85;
      const pour = s.ease('reshape', 1.4, 2);
      const rd = s.ease('minus', 1.2, 2.2);
      const tp = s.ease('T', 1.2, 1.4);
      s.alpha(rA, () => {
        s.text('v', vx - u * 4, vy + ch / 2, { size: 4.6, italic: true, weight: 650, color: s.c('blue') });
        for (let k = 0; k < 6; k++) {
          const lit = s.since('order') >= 0 && s.since('minus') < 0 && Math.floor((s.since('order') * 1.4) % 7) === k;
          s.cell(vx + k * cw, vy, cw, ch, String(k), 'blue', { on: lit ? 1 : 0, size: 3.8 });
        }
        // M = v.reshape(2, 3)
        s.alpha(s.ease('reshape', 0.4, 1.8), () => {
          s.text('reshape(2, 3)', mx + 1.5 * cw, gy - u * 4.5, { size: 3.2, font: 'mono', weight: 600, color: s.c('purple') });
        });
        for (let k = 0; k < 6; k++) {
          const p = smooth(pour * 1.6 - k * 0.12);
          if (p <= 0) continue;
          const lit = s.since('order') >= 0 && s.since('minus') < 0 && Math.floor((s.since('order') * 1.4) % 7) === k;
          s.cell(lerp(vx + k * cw, mx + (k % 3) * cw, p), lerp(vy, gy + Math.floor(k / 3) * ch, p), cw, ch, String(k), 'purple', { on: lit ? 1 : 0.2, size: 3.8 });
        }
        s.alpha(pour, () => pill(s, '(2, 3)', mx + 1.5 * cw, gy + 3 * ch + u * 3, 'purple', { size: 3.4 }));
        // reading order
        s.alpha(s.win('order', 'minus'), () => {
          for (let r = 0; r < 2; r++) s.arrow(mx + cw * 0.15, gy + ch * (r + 0.84), mx + cw * 2.85, gy + ch * (r + 0.84), s.tint('--accent', 0.75), 0.3, 1.6);
          s.text('row-major: like reading a book', w / 2, h * 0.84, { size: 3.6, italic: true, color: s.c('--accent') });
        });
        // reshape(3, -1)
        s.alpha(s.ease('minus', 0.4, 1), () => s.text('reshape(3, -1)', rx + cw, gy - u * 4.5, { size: 3.2, font: 'mono', weight: 600, color: s.c('teal') }));
        for (let k = 0; k < 6; k++) {
          const p = smooth(rd * 1.6 - k * 0.12);
          if (p <= 0) continue;
          s.cell(lerp(mx + (k % 3) * cw, rx + (k % 2) * cw, p), lerp(gy + Math.floor(k / 3) * ch, gy + Math.floor(k / 2) * ch, p), cw, ch, String(k), 'teal', { on: 0.2, size: 3.8 });
        }
        s.alpha(rd, () => pill(s, '(3, 2)', rx + cw, gy + 3 * ch + u * 3, 'teal', { size: 3.4 }));
        s.alpha(s.ease('minus', 0.5, 4.5) * (1 - s.ease('T', 0.4)), () => s.text('6 numbers, 3 rows: -1 becomes 2', w / 2, h * 0.84, { size: 3.6, italic: true, color: s.c('teal') }));
        // M.T
        s.alpha(s.ease('T', 0.4, 0.4), () => s.text('M.T', tx + cw, gy - u * 4.5, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange') }));
        for (let k = 0; k < 6; k++) {
          const p = smooth(tp * 1.6 - k * 0.12);
          if (p <= 0) continue;
          const i = Math.floor(k / 3);
          const j = k % 3;
          s.cell(lerp(mx + j * cw, tx + i * cw, p), lerp(gy + i * ch, gy + j * ch, p), cw, ch, String(k), 'orange', { on: 0.2, size: 3.8 });
        }
        s.alpha(tp, () => {
          pill(s, '(3, 2)', tx + cw, gy + 3 * ch + u * 3, 'orange', { size: 3.4 });
          s.text('same shape, different order: rows became columns', w / 2, h * 0.84, { size: 3.6, italic: true, color: s.c('orange') });
        });
      });
    }
    // Phase 2: an image, flattened two ways.
    const iA = s.win('img', 'same');
    if (iA > 0) {
      const size = Math.min(u * 30, h * 0.3);
      const ix = s.tall ? w * 0.1 : w * 0.16;
      const iy = h * 0.12;
      const r = 2;
      const c = 1;
      const pxv = PHOTO[r]![c]!;
      const ps = size / 4;
      s.alpha(iA, () => {
        photo(s, ix, iy, size);
        const tx = ix + size + u * 6;
        s.text('img', tx, iy + u * 3, { size: 4.2, font: 'mono', weight: 650, align: 'left' });
        s.text('(32, 32, 3)', tx + s.measure('img ', { size: 4.2, font: 'mono', weight: 650 }), iy + u * 3, { size: 3.6, font: 'mono', align: 'left', color: s.c('--ink-2') });
        s.text('height, width, channels', tx, iy + u * 9, { size: 3.4, italic: true, align: 'left', color: s.c('--ink-2') });
        s.text('drawn here as 4 × 4', tx, iy + u * 14.5, { size: 3.2, italic: true, align: 'left', color: s.c('--ink-3') });
        const pA = s.ease('px', 0.6, 0.6);
        s.alpha(pA, () => {
          s.rrect(ix + c * ps - u * 0.5, iy + r * ps - u * 0.5, ps + u, ps + u, 0.6, { stroke: s.c('--ink'), lw: 0.6 });
          const names = ['red', 'green', 'blue'];
          const cols = ['#e5484d', '#30a46c', '#3e63dd'];
          names.forEach((nm, ch) => {
            const y = iy + u * 21 + ch * u * 5;
            const bw = u * 22 * (pxv[ch]! / 255);
            s.rrect(tx, y - u * 1.6, u * 22, u * 3.2, 0.6, { fill: s.tint('--ink-3', 0.12) });
            s.rrect(tx, y - u * 1.6, bw, u * 3.2, 0.6, { fill: cols[ch]! });
            s.text(`${nm} ${pxv[ch]}`, tx + u * 24, y, { size: 3.2, font: 'mono', align: 'left' });
          });
        });
        // the flat vectors
        const n = 48;
        const per = 24;
        const cs = Math.min(u * 4, (w - u * 12) / per);
        const sx = (w - per * cs) / 2;
        const strip = (y: number, order: 'hwc' | 'chw', ring: number[], a: number) =>
          s.alpha(a, () => {
            for (let k = 0; k < n; k++) {
              let ch: number;
              let q: number;
              if (order === 'chw') {
                ch = Math.floor(k / 16);
                q = k % 16;
              } else {
                ch = k % 3;
                q = Math.floor(k / 3);
              }
              const v = PHOTO[Math.floor(q / 4)]![q % 4]![ch]!;
              const col: [number, number, number] = [0, 0, 0];
              col[ch] = v;
              s.ctx.fillStyle = rgb(col);
              const x = sx + (k % per) * cs;
              const yy = y + Math.floor(k / per) * cs;
              s.ctx.fillRect(x + 0.5, yy + 0.5, cs - 1, cs - 1);
            }
            ring.forEach((k) => {
              const x = sx + (k % per) * cs;
              const yy = y + Math.floor(k / per) * cs;
              s.rrect(x - u * 0.5, yy - u * 0.5, cs + u, cs + u, 0.5, { stroke: s.c('--ink'), lw: 0.5 });
            });
          });
        const kH = (r * 4 + c) * 3;
        const kC = r * 4 + c;
        const hy = h * 0.56;
        const cy2 = h * 0.76;
        const hA = s.ease('flat', 0.6, 1.4);
        strip(hy, 'hwc', s.since('hwc') >= 0 ? [kH, kH + 1, kH + 2] : [], hA);
        s.alpha(hA, () => s.text('HWC: r g b, r g b, ...', sx, hy - u * 3, { size: 3.4, font: 'mono', weight: 600, align: 'left' }));
        s.alpha(s.ease('hwc', 0.5, 1.4), () => s.text('one pixel: side by side', sx + per * cs, hy - u * 3, { size: 3.2, italic: true, align: 'right', color: s.c('--ink-2') }));
        const cA = s.ease('chw', 0.6, 1.4);
        strip(cy2, 'chw', s.ease('chw', 0.5, 4) > 0 ? [kC, kC + 16, kC + 32] : [], cA);
        s.alpha(cA, () => {
          s.text('CHW: all reds, greens, blues', sx, cy2 - u * 3, { size: 3.4, font: 'mono', weight: 600, align: 'left' });
          s.text('one pixel: 1024 apart in CIFAR', w / 2, cy2 + 2 * cs + u * 5, { size: 3.2, italic: true, color: s.c('--ink-2') });
        });
      });
    }
    // Phase 3: a batch of images becomes a matrix.
    const bA = s.ease('same', 0.6);
    if (bA > 0) {
      s.alpha(bA, () => {
        const n = 4;
        const isz = u * 10;
        const x0 = w * 0.08;
        const sx = x0 + isz + u * 8;
        const sw = w * 0.92 - sx;
        const y0 = h * 0.18;
        const gap = u * 4;
        for (let i = 0; i < n; i++) {
          const y = y0 + i * (isz + gap);
          const shifted = PHOTO.map((row) => row.map((px) => [(px[0] + i * 45) % 256, (px[1] + i * 25) % 256, (px[2] + i * 60) % 256] as [number, number, number]));
          photo(s, x0, y, isz, shifted);
          const p = s.ease('same', 0.8, 4 + i * 0.3);
          s.arrow(x0 + isz + u, y + isz / 2, x0 + isz + u * 6, y + isz / 2, s.c('--ink-3'), 0.35, 1.6);
          const cells = 48;
          const cwid = sw / cells;
          for (let k = 0; k < cells * p; k++) {
            const ch = k % 3;
            const q = Math.floor(k / 3);
            const col: [number, number, number] = [0, 0, 0];
            col[ch] = shifted[Math.floor(q / 4)]![q % 4]![ch]!;
            s.ctx.fillStyle = rgb(col);
            s.ctx.fillRect(sx + k * cwid, y + isz * 0.2, cwid + 0.3, isz * 0.6);
          }
        }
        s.text('X = X_train.reshape(N, -1)', w / 2, y0 + n * (isz + gap) + u * 5, { size: 4.2, font: 'mono', weight: 650, color: s.c('orange') });
        pill(s, '(N, 3072): one image per row', w / 2, y0 + n * (isz + gap) + u * 13, 'orange', { size: 3.4 });
      });
    }
  },
};

// ---------------------------------------------------------------- vectorize

const vectorize: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // A loop pays overhead every step; one call does not.
    const lA = s.win('speed', 'two');
    s.alpha(lA, () => {
      const n = 24;
      const cs = Math.min(u * 4, (w - u * 16) / n);
      const sx = (w - n * cs) / 2;
      const sy = h * 0.16;
      const cur = Math.floor(Math.max(0, s.since('speed') - 0.6) * 4) % n;
      for (let k = 0; k < n; k++) s.rrect(sx + k * cs + 1, sy, cs - 2, cs, 0.5, { fill: s.tint('slate', k === cur && s.since('loop') < 0 ? 0.7 : 0.18) });
      s.alpha(1 - s.ease('loop', 0.5), () => s.text('each step: check types, look up +, box the result', w / 2, sy + cs + u * 6, { size: 3.4, italic: true, color: s.c('--ink-2') }));
      const bx = w * 0.28;
      const bw = w * 0.62;
      const y1 = h * 0.42;
      const y2 = h * 0.58;
      const g1 = s.ease('loop', 2.2, 0.6);
      s.alpha(s.ease('loop', 0.5), () => {
        s.text('Python loop', bx - u * 3, y1, { size: 3.6, font: 'mono', weight: 600, align: 'right', color: s.c('red') });
        s.rrect(bx, y1 - u * 3, bw * g1, u * 6, 1, { fill: s.tint('red', 0.55) });
        s.alpha(g1, () => s.text('≈ 50 ms', bx + bw * g1 - u * 2, y1 + u * 0.2, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: '#fff' }));
      });
      const g2 = s.ease('np', 0.5, 1);
      s.alpha(g2, () => {
        s.text('np.sum', bx - u * 3, y2, { size: 3.6, font: 'mono', weight: 600, align: 'right', color: s.c('teal') });
        s.rrect(bx, y2 - u * 3, Math.max(u * 0.8, bw * 0.003), u * 6, 0.4, { fill: s.c('teal') });
        s.text('≈ 0.15 ms', bx + u * 3, y2, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('teal') });
      });
      s.alpha(s.ease('np', 0.6, 3.6), () => s.text('over 300 × faster', w / 2, h * 0.76, { size: 6, font: 'display', weight: 600, color: s.c('teal') }));
      s.alpha(s.ease('rule', 0.6), () => {
        s.rrect(0, h * 0.68, w, h * 0.32, 0, { fill: s.c('--card') });
        s.text('keep the loops out of Python', w / 2, h * 0.82, { size: 6, font: 'display', weight: 600, color: s.c('--accent') });
      });
    });
    // Three ways to fill the distance table.
    const dA = s.win('two', 'how');
    if (dA > 0) {
      const N = 6;
      const M = 16;
      const cs = Math.min(u * 5, (w - u * 20) / M);
      const gx = (w - M * cs) / 2;
      const gy = h * 0.2;
      const rng = new Rng(3);
      const vals = Array.from({ length: N * M }, () => rng.uniform(0.15, 0.9));
      const beat = current(s, ['two', 'one', 'zero', 'sizes', 'why'])!;
      const live = beat === 'two' || beat === 'one' || beat === 'zero';
      let filled = N * M;
      let steps = beat === 'two' ? 0 : beat === 'one' ? 0 : 1;
      if (beat === 'two') {
        steps = Math.max(0, Math.floor((s.since('two') - 0.8) * 9));
        filled = Math.min(N * M, steps);
      } else if (beat === 'one') {
        steps = Math.min(N, Math.max(0, Math.floor((s.since('one') - 0.4) * 2.4)));
        filled = steps * M;
      } else if (beat === 'zero') {
        steps = s.since('zero') > 0.8 ? 1 : 0;
        filled = steps * N * M;
      }
      s.slot('steps', live ? steps : 1);
      s.alpha(dA, () => {
        const titles: Record<string, string> = { two: 'two loops: one step per cell', one: 'one loop: one step per row', zero: 'no loops: one step' };
        if (live) s.text(titles[beat]!, w / 2, gy - u * 5, { size: 3.8, font: 'mono', weight: 650 });
        for (let k = 0; k < N * M; k++) {
          const i = Math.floor(k / M);
          const j = k % M;
          const on = k < filled;
          s.rrect(gx + j * cs + 1, gy + i * cs + 1, cs - 2, cs - 2, 0.4, { fill: on ? s.tint('teal', 0.15 + 0.7 * vals[k]!) : s.tint('--ink-3', 0.08) });
        }
        if (live) s.text(`Python steps: ${steps}`, w / 2, gy + N * cs + u * 6, { size: 4.2, font: 'mono', weight: 650, color: s.c('teal') });
        // the measured table
        const tA = s.ease('sizes', 0.6);
        s.alpha(tA, () => {
          const rows: [string, string, string, number][] = [
            ['two loops', '2,500,000', '6 s', 6],
            ['one loop', '500', '5 s', 5],
            ['no loops', '1', '0.04 s', 0.04],
          ];
          const ty = gy + N * cs + u * 8;
          const c1 = w * 0.08;
          const c2 = w * 0.47;
          const c3 = w * 0.54;
          const bw = w * 0.3;
          s.text('steps', c2, ty, { size: 3.2, italic: true, align: 'right', color: s.c('--ink-3') });
          s.text('time', c3, ty, { size: 3.2, italic: true, align: 'left', color: s.c('--ink-3') });
          rows.forEach(([nm, st, tm, sec], r) => {
            const y = ty + u * 7 + r * u * 8;
            const hot = beat === 'why' && r === 1;
            s.alpha(s.ease('sizes', 0.5, 0.6 + r * 1.6), () => {
              s.text(nm, c1, y, { size: 3.6, font: 'mono', weight: 600, align: 'left', color: hot ? s.c('red') : s.c('--ink') });
              s.text(st, c2, y, { size: 3.6, font: 'mono', align: 'right' });
              s.rrect(c3, y - u * 2.2, Math.max(u * 0.6, (bw * sec) / 6), u * 4.4, 0.6, { fill: s.tint(r === 2 ? 'teal' : 'red', 0.55) });
              s.text(tm, c3 + Math.max(u * 0.6, (bw * sec) / 6) + u * 2, y, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink-2') });
            });
          });
          s.alpha(s.ease('why', 0.6, 0.8), () => s.text('each step builds a (5000, 3072) temporary', w / 2, ty + u * 33, { size: 3.6, italic: true, color: s.c('red') }));
        });
      });
    }
    // Think in shapes; check against the loop.
    const hA = s.ease('how', 0.6);
    s.alpha(hA, () => {
      s.text('think in shapes, not indices', w / 2, h * 0.14, { size: 5.2, font: 'display', weight: 600 });
      const y = h * 0.28;
      s.alpha(s.ease('how', 0.5, 2.4), () => {
        pill(s, 'X (N, D)', w * 0.22, y, 'orange', { size: 4 });
        pill(s, 'Xtr (M, D)', w * 0.22, y + u * 11, 'orange', { size: 4 });
        s.arrow(w * 0.4, y + u * 5.5, w * 0.56, y + u * 5.5, s.c('--ink-3'), 0.5, 2.6);
        pill(s, 'dists (N, M)', w * 0.76, y + u * 5.5, 'teal', { size: 4 });
      });
      const ops: [string, string][] = [
        ['X.dot(Xtr.T)', 'a matrix product: every row with every row'],
        ['(X ** 2).sum(axis=1)', 'a reduction: collapse an axis'],
        ['x2 - 2 * cross + t2', 'broadcasting: stretch along an axis'],
      ];
      ops.forEach(([code, what], i) =>
        s.alpha(s.ease('how', 0.5, 4.4 + i * 1.1), () => {
          const oy = h * 0.53 + i * u * 11;
          s.text(code, w * 0.1, oy, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('purple') });
          s.text(what, w * 0.1, oy + u * 4.6, { size: 3.4, italic: true, align: 'left', color: s.c('--ink-2') });
        }),
      );
    });
    s.alpha(s.ease('check', 0.6), () => {
      s.rrect(0, h * 0.44, w, h * 0.56, 0, { fill: s.c('--card') });
      s.text('np.allclose(dists, dists_loop)', w / 2, h * 0.62, { size: 4.4, font: 'mono', weight: 650 });
      check(s, w / 2 - u * 8, h * 0.76, u * 2.6);
      s.text('True', w / 2 - u * 4, h * 0.76, { size: 4.6, font: 'mono', weight: 650, align: 'left', color: s.c('green') });
    });
  },
};

// ---------------------------------------------------------------- pitfalls

const pitfalls: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const heads = ['views', 'dtypes', 'shapes'];
    const sec = s.since('flat') >= 0 ? 2 : s.since('int') >= 0 ? 1 : 0;
    // The three pitfalls as a running header.
    const big = 1 - s.ease('view', 0.8);
    heads.forEach((nm, i) => {
      const cwid = lerp(Math.min(u * 32, w * 0.28), Math.min(u * 26, w * 0.27), 1 - big);
      const x = w / 2 + (i - 1) * (cwid + u * 3);
      const y = lerp(h * 0.45, h * 0.12, 1 - big);
      const on = i === sec ? 1 : 0.25;
      s.alpha(s.ease('three', 0.5, 0.8 + i * 0.4), () => {
        s.rrect(x - cwid / 2, y - u * 5, cwid, u * 10, 2, { fill: s.tint('red', 0.05 + 0.12 * on), stroke: s.tint('red', 0.3 + 0.6 * on), lw: 0.35 });
        s.text(`${i + 1}  ${nm}`, x, y + u * 0.3, { size: 4.2, font: 'display', weight: 600, color: on > 0.5 ? s.c('red') : s.c('--ink-3') });
      });
    });
    // 1. Views.
    s.alpha(s.win('view', 'int'), () => {
      const cw = Math.min(u * 11, (w - u * 24) / 6);
      const ch = cw * 0.8;
      const ax = (w - 6 * cw) / 2;
      const ay = h * 0.3;
      const wr = s.ease('view', 0.5, 2.6);
      const val = (k: number) => (k === 1 && wr > 0.5 ? '99' : String(k));
      s.text('a', ax - u * 4, ay + ch / 2, { size: 4.6, italic: true, weight: 650, color: s.c('slate') });
      for (let k = 0; k < 6; k++) s.cell(ax + k * cw, ay, cw, ch, val(k), 'slate', { on: k === 1 ? wr : 0, size: 4 });
      frame(s, ax + cw, ay, 3 * cw, ch, 'purple', 0.6);
      const sy = ay + ch + u * 9;
      s.text('s', ax + cw - u * 4, sy + ch / 2, { size: 4.6, italic: true, weight: 650, color: s.c('purple') });
      for (let k = 1; k < 4; k++) s.cell(ax + k * cw, sy, cw, ch, val(k), 'purple', { on: k === 1 ? wr : 0.2, size: 4 });
      s.line(ax + cw, ay + ch + u, ax + cw, sy - u, s.tint('purple', 0.5), 0.3, [0.8, 0.8]);
      s.line(ax + 4 * cw, ay + ch + u, ax + 4 * cw, sy - u, s.tint('purple', 0.5), 0.3, [0.8, 0.8]);
      flash(s, ax + cw, ay, cw, ch, s.ease('view', 1, 2.6));
      s.alpha(wr, () => s.text('s[0] = 99 wrote into a', ax + 2.5 * cw, sy + ch + u * 4.5, { size: 3.4, font: 'mono', color: s.c('--accent') }));
      s.alpha(s.ease('copy', 0.6, 0.6), () => {
        const cy = sy + ch + u * 11;
        s.text('c', ax + cw - u * 4, cy + ch / 2, { size: 4.6, italic: true, weight: 650, color: s.c('teal') });
        for (let k = 1; k < 4; k++) s.cell(ax + k * cw, cy, cw, ch, val(k), 'teal', { on: 0.2, size: 4 });
        s.text('.copy(): its own memory', ax + 2.5 * cw, cy + ch + u * 4.5, { size: 3.4, font: 'mono', color: s.c('teal') });
      });
    });
    // 2a. Integers truncate.
    s.alpha(s.win('int', 'u8'), () => {
      const cw = u * 13;
      const ch = cw * 0.75;
      const zx = (w - 3 * cw) / 2;
      const zy = h * 0.5;
      const drop = s.ease('int', 1, 3);
      s.text('z', zx - u * 4, zy + ch / 2, { size: 4.6, italic: true, weight: 650, color: s.c('blue') });
      for (let k = 0; k < 3; k++) s.cell(zx + k * cw, zy, cw, ch, '0', 'blue', { size: 4.2 });
      s.text('dtype int64', zx + 1.5 * cw, zy + ch + u * 5, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      s.alpha(1 - smooth((drop - 0.8) / 0.2), () => pill(s, '0.9', zx + cw / 2, lerp(h * 0.3, zy + ch / 2, drop), 'orange', { size: 4.2 }));
      s.alpha(smooth((drop - 0.85) / 0.15), () => {
        flash(s, zx, zy, cw, ch, s.ease('int', 1, 4));
        s.text('0.9 stored as 0, silently', w / 2, h * 0.32, { size: 4, font: 'mono', weight: 650, color: s.c('red') });
      });
    });
    // 2b. uint8 wraps around like an odometer.
    s.alpha(s.win('u8', 'flat'), () => {
      const R = Math.min(u * 20, w * 0.18);
      const ox = s.tall ? w * 0.3 : w * 0.3;
      const oy = h * 0.55;
      const c = s.ctx;
      c.beginPath();
      c.arc(ox, oy, R, 0, Math.PI * 2);
      c.fillStyle = s.tint('slate', 0.06);
      c.fill();
      c.strokeStyle = s.c('slate');
      c.lineWidth = u * 0.4;
      c.stroke();
      const ang = (v: number) => -Math.PI / 2 + (v / 256) * Math.PI * 2;
      [0, 64, 128, 192].forEach((t) => {
        const a = ang(t);
        s.line(ox + Math.cos(a) * R * 0.86, oy + Math.sin(a) * R * 0.86, ox + Math.cos(a) * R, oy + Math.sin(a) * R, s.c('slate'), 0.35);
        s.text(t === 0 ? '0 / 256' : String(t), ox + Math.cos(a) * (R + u * 5), oy + Math.sin(a) * (R + u * 4), { size: 3, font: 'mono', color: s.c('--ink-3') });
      });
      const add = s.ease('u8', 2.2, 4);
      const v = 200 + 200 * add;
      const a = ang(v % 256);
      // the swept arc
      if (add > 0) {
        c.beginPath();
        c.arc(ox, oy, R * 0.7, ang(200), ang(v), false);
        c.strokeStyle = s.tint('red', 0.55);
        c.lineWidth = u * 1.2;
        c.stroke();
      }
      s.line(ox, oy, ox + Math.cos(a) * R * 0.82, oy + Math.sin(a) * R * 0.82, s.c('red'), 0.7);
      s.circle(ox, oy, u * 1.2, { fill: s.c('red') });
      s.text(String(Math.round(v) % 256), ox, oy - R * 0.36, { size: 4.6, font: 'mono', weight: 650, color: s.c('red'), halo: true });
      const tx = ox + R + u * 12;
      s.text('uint8: 0 to 255', tx, h * 0.3, { size: 3.8, font: 'mono', weight: 650, align: 'left' });
      s.alpha(s.ease('u8', 0.5, 4), () => s.text('200 + 200', tx, h * 0.42, { size: 4, font: 'mono', align: 'left' }));
      s.alpha(add, () => s.text('= 400 - 256 = 144', tx, h * 0.5, { size: 4, font: 'mono', weight: 650, align: 'left', color: s.c('red') }));
      s.alpha(s.ease('fix', 0.6, 0.6), () => {
        s.text('float64: 400.', tx, h * 0.66, { size: 4, font: 'mono', weight: 650, align: 'left', color: s.c('green') });
        check(s, tx - u * 4, h * 0.66, u * 2);
        s.text('convert first', tx, h * 0.73, { size: 3.4, italic: true, align: 'left', color: s.c('--ink-2') });
      });
    });
    // 3. (3,) meets (3, 1).
    s.alpha(s.ease('flat', 0.6), () => {
      const cw = Math.min(u * 10, w * 0.09);
      const vx = w * 0.12;
      const vy = h * 0.32;
      s.text('v', vx - u * 3, vy + cw * 0.4, { size: 4.4, italic: true, weight: 650, color: s.c('blue'), align: 'right' });
      grid(s, vx, vy, cw, cw * 0.8, [[1, 2, 3]], 'blue', { size: 3.8 });
      pill(s, '(3,)', vx + 1.5 * cw, vy + cw * 0.8 + u * 5, 'blue', { size: 3.4 });
      s.alpha(s.ease('flat', 0.5, 5), () => s.text('v.T: still (3,)', vx + 1.5 * cw, vy + cw * 0.8 + u * 12, { size: 3.4, font: 'mono', color: s.c('--ink-2') }));
      const cx = vx + 3 * cw + u * 11;
      s.alpha(s.ease('flat', 0.5, 2.6), () => {
        grid(s, cx, vy - cw * 0.6, cw, cw * 0.8, [[1], [2], [3]], 'orange', { size: 3.8 });
        pill(s, '(3, 1)', cx + cw / 2, vy + cw * 1.8 + u * 5, 'orange', { size: 3.4 });
      });
      const tA = s.ease('trap', 0.8, 1);
      s.alpha(tA, () => s.text('+', vx + 3 * cw + u * 5.5, vy + cw * 0.4, { size: 5, font: 'mono', color: s.c('--ink-2') }));
      s.alpha(tA, () => {
        const tx = cx + cw + u * 11;
        const tw = Math.min(cw, (w - tx - u * 6) / 3);
        s.text('=', cx + cw + u * 5.5, vy + cw * 0.4, { size: 5, font: 'mono', color: s.c('--ink-2') });
        grid(s, tx, vy - cw * 0.6, tw, cw * 0.8, [[2, 3, 4], [3, 4, 5], [4, 5, 6]], 'red', { size: 3.6, on: () => 0.4 });
        pill(s, '(3, 3)!', tx + 1.5 * tw, vy + cw * 1.8 + u * 5, 'red', { size: 3.4 });
        s.text('expected (3,), got a table, no error', w / 2, h * 0.7, { size: 3.8, italic: true, color: s.c('red') });
      });
      s.alpha(s.ease('assert', 0.6), () => {
        s.text('assert scores.shape == (N, C)', w / 2, h * 0.82, { size: 4.2, font: 'mono', weight: 650, color: s.c('green') });
        s.text('print shapes, assert shapes', w / 2, h * 0.89, { size: 3.4, italic: true, color: s.c('--ink-2') });
      });
    });
  },
};

// ---------------------------------------------------------------- outro

const GALLERY = (() => {
  const r = new Rng(21);
  return Array.from({ length: 10 }, () => {
    const sky: [number, number, number] = [r.int(120) + 100, r.int(100) + 120, r.int(60) + 190];
    const ground: [number, number, number] = [r.int(80) + 60, r.int(90) + 100, r.int(70) + 40];
    const thing: [number, number, number] = [r.int(200) + 50, r.int(160) + 30, r.int(160) + 30];
    const cx = r.int(3) + 1;
    return Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => (Math.abs(j - cx) + Math.abs(i - 2.5) < 1.8 ? thing : i >= 3 ? ground : sky)));
  });
})();
const LOSS = (() => {
  const r = new Rng(4);
  return Array.from({ length: 60 }, (_, i) => 2.3 * Math.exp(-i / 14) + 0.25 + r.uniform(-0.08, 0.08));
})();

const TAKEAWAYS: [string, string, string][] = [
  ['shapes', 'predict them', 'recap1'],
  ['indexing', 'ints drop axes', 'recap1'],
  ['views', 'share memory', 'recap1'],
  ['* and @', 'entry vs matrix', 'recap2'],
  ['axis=k', 'k disappears', 'recap2'],
  ['broadcast', 'stretch the 1s', 'recap2'],
];

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Four matplotlib panels.
    const pA = s.win('plt', 'recap1');
    s.alpha(pA, () => {
      const gap = u * 4;
      const pw = (w - u * 10 - gap) / 2;
      const ph = (h - u * 20 - gap) / 2;
      const x0 = u * 5;
      const y0 = u * 14;
      const now = current(s, ['plt', 'plot', 'loss', 'img']);
      const panel = (i: number, title: string, beat: string, body: (x: number, y: number, pw: number, ph: number) => void) => {
        const x = x0 + (i % 2) * (pw + gap);
        const y = y0 + Math.floor(i / 2) * (ph + gap);
        const hot = now === beat && (beat !== 'img' || i === 2 || s.since('img') > 4.5);
        const a = now === 'plt' ? s.ease('plt', 0.6, 0.6 + i * 0.5) : hot ? 1 : 0.4;
        s.rrect(x, y, pw, ph, 1.6, { fill: s.tint('slate', 0.03), stroke: hot ? s.c('--accent') : s.c('--rule'), lw: hot ? 0.45 : 0.3 });
        s.text(title, x + u * 2.5, y + u * 4, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: hot ? s.c('--accent') : s.c('--ink-2') });
        s.alpha(a, () => body(x + u * 3, y + u * 7, pw - u * 6, ph - u * 9.5));
      };
      panel(0, 'plt.plot(xs, ...)', 'plot', (x, y, bw, bh) => {
        const X = (v: number) => x + ((v + 3) / 6) * bw;
        const Yv = (v: number) => y + bh - ((v + 1.2) / 4.4) * bh;
        s.line(x, Yv(0), x + bw, Yv(0), s.c('--axis'), 0.25);
        s.line(X(0), y, X(0), y + bh, s.c('--axis'), 0.25);
        const c = s.ctx;
        const curve = (f: (v: number) => number, col: string) => {
          c.beginPath();
          for (let k = 0; k <= 60; k++) {
            const v = -3 + (6 * k) / 60;
            if (k) c.lineTo(X(v), Yv(f(v)));
            else c.moveTo(X(v), Yv(f(v)));
          }
          c.strokeStyle = col;
          c.lineWidth = u * 0.6;
          c.stroke();
        };
        curve((v) => Math.max(0, v), s.c('blue'));
        curve(Math.tanh, s.c('orange'));
        s.text('ReLU', X(1.5), Yv(2.4), { size: 3, font: 'mono', color: s.c('blue'), halo: true });
        s.text('tanh', X(-2), Yv(-0.5), { size: 3, font: 'mono', color: s.c('orange'), halo: true });
      });
      panel(1, 'plt.plot(loss_history)', 'loss', (x, y, bw, bh) => {
        const c = s.ctx;
        const p = s.since('loss') >= 0 ? s.ease('loss', 2, 0.6) : 1;
        c.beginPath();
        const n = Math.max(2, Math.floor(LOSS.length * p));
        for (let k = 0; k < n; k++) {
          const px = x + (k / (LOSS.length - 1)) * bw;
          const py = y + bh - (LOSS[k]! / 2.7) * bh;
          if (k) c.lineTo(px, py);
          else c.moveTo(px, py);
        }
        c.strokeStyle = s.c('red');
        c.lineWidth = u * 0.5;
        c.stroke();
        s.line(x, y + bh, x + bw, y + bh, s.c('--axis'), 0.25);
      });
      panel(2, 'plt.imshow(img)', 'img', (x, y, bw, bh) => {
        const sz = Math.min(bw, bh);
        photo(s, x + (bw - sz) / 2, y, sz);
      });
      panel(3, 'plt.subplot(2, 5, i + 1)', 'img', (x, y, bw, bh) => {
        const g = u * 1;
        const sz = Math.min((bw - 4 * g) / 5, (bh - g) / 2);
        const ox = x + (bw - (5 * sz + 4 * g)) / 2;
        GALLERY.forEach((img, i) => photo(s, ox + (i % 5) * (sz + g), y + Math.floor(i / 5) * (sz + g) + (bh - 2 * sz - g) / 2, sz, img));
      });
    });
    // The takeaways.
    const tA = s.ease('recap1', 0.6);
    if (tA > 0) {
      const dim = 1 - s.ease('next', 0.6, 0.3);
      s.alpha(tA * dim, () => {
        const cols = 3;
        const gap = u * 3;
        const tw = (w - u * 10 - gap * (cols - 1)) / cols;
        const th = Math.min(u * 18, tw * 0.55);
        const y0 = h * 0.2;
        TAKEAWAYS.forEach(([name, sub, beat], i) => {
          const a = s.ease(beat, 0.5, (i % 3) * 1.6 + 0.4);
          const x = u * 5 + (i % cols) * (tw + gap);
          const y = y0 + Math.floor(i / cols) * (th + gap);
          const on = s.since(beat) >= 0 && current(s, ['recap1', 'recap2', 'recap3']) === beat ? 1 : 0.3;
          s.alpha(a, () => {
            s.rrect(x, y, tw, th, 2.2, { fill: s.tint('purple', 0.05 + 0.12 * on), stroke: s.tint('purple', 0.35 + 0.5 * on), lw: 0.35 });
            s.text(name, x + tw / 2, y + th * 0.38, { size: Math.min(4.8, (tw / u) * 0.13), font: 'display', weight: 600 });
            s.text(sub, x + tw / 2, y + th * 0.7, { size: Math.min(3.4, (tw / u) * 0.085), font: 'mono', color: s.c('purple') });
          });
        });
        s.alpha(s.ease('recap3', 0.6, 0.3), () => {
          const y = y0 + 2 * (th + gap) + u * 4;
          s.rrect(u * 5, y, w - u * 10, th * 0.8, 2.2, { fill: s.tint('teal', 0.12), stroke: s.c('teal'), lw: 0.4 });
          s.text('vectorize, then check with np.allclose', w / 2, y + th * 0.4, { size: Math.min(3.8, (w / u) * 0.032), font: 'mono', weight: 600, color: s.c('teal') });
        });
      });
      const nA = s.ease('next', 0.7, 0.4);
      s.alpha(nA, () => {
        s.text('next: the interactive chapter', w / 2, h * 0.42, { size: 6.4, font: 'display', weight: 600 });
        s.text('every idea, as a figure you can poke, with its code beside it', w / 2, h * 0.54, { size: 3.6, italic: true, color: s.c('--ink-2') });
        s.alpha(s.ease('bye', 0.6), () => s.text('see you there', w / 2, h * 0.68, { size: 4.6, font: 'display', italic: true, color: s.c('--accent') }));
      });
    }
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  python,
  python2,
  arrays,
  indexing,
  picking,
  math,
  broadcasting,
  distances,
  reshape,
  vectorize,
  pitfalls,
  outro,
};
