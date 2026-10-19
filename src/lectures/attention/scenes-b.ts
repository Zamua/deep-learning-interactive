import { fmt } from '../../core/code';
import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { G, type Word, attendWord, filterBank, glimpse, hardPicks, pictures } from './data';
import { type K, attnMask, block, cellBox, curve, featBars, fit, gridLines, loading, picture, pill, tag } from './kit';
import { split } from './scenes-a';

// ---------------------------------------------------------------- the whole loop

const loop: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const P = pictures(s);
    const pic = P?.horse ?? null;
    // Phase 1: one time step.
    const dA = s.win('put', 'maps');
    s.alpha(dA, () => {
      const x0 = (w - 106 * u) / 2;
      const X = (v: number) => x0 + v * u;
      const Y = (v: number) => (v + 8) * u;
      const lit = (from: string, until?: string) => s.win(from, until, 0.4);
      const S = 30 * u;
      if (pic) {
        picture(s, 'horse', pic.rgb, X(0), Y(28), S);
        if (s.since('att') >= 0) attnMask(s, attendWord(pic, 'horse', 'object', 2).alpha, X(0), Y(28), S, s.ease('att', 0.6, 0.6), 0.75);
        gridLines(s, X(0), Y(28), S, 0.7);
      } else loading(s, X(0), Y(28), S);
      s.text('feats', X(15), Y(62), { size: 3.2, weight: 600, color: s.c('orange') });
      block(s, X(36), Y(36), 22 * u, 14 * u, 'attend', 'teal', { on: lit('att', 'rnn'), size: 3.6, sub: '3 steps' });
      s.arrow(X(31), Y(43), X(35.6), Y(43), s.c('orange'), 0.45, 2);
      s.alpha(s.ease('att', 0.5, 0.8), () => {
        pill(s, 'z', X(64), Y(43), 'gold', { size: 3.8, on: lit('att', 'rnn'), font: 'serif' });
        s.arrow(X(58.4), Y(43), X(61.2), Y(43), s.c('teal'), 0.4, 1.8);
        s.arrow(X(66.8), Y(43), X(69.6), Y(43), s.c('gold'), 0.4, 1.8);
      });
      block(s, X(70), Y(36), 22 * u, 14 * u, 'LSTM', 'green', { on: lit('rnn', 'two'), size: 3.8 });
      s.alpha(s.ease('rnn', 0.5), () => {
        pill(s, 'a', X(81), Y(62), '--ink-2', { size: 3.4, font: 'serif', on: lit('rnn', 'two') });
        s.text('previous word', X(81), Y(68.5), { size: 2.8, color: s.c('--ink-3') });
        s.arrow(X(81), Y(59), X(81), Y(50.6), s.c('--ink-3'), 0.4, 1.8);
      });
      // the distribution over words
      s.alpha(s.ease('two', 0.5), () => {
        const dist: [string, number][] = [
          ['horse', 0.62],
          ['dog', 0.16],
          ['field', 0.12],
          ['cat', 0.05],
        ];
        const bx = X(76);
        const bw = 24 * u;
        s.arrow(X(81), Y(35.6), X(81), Y(31.4), s.c('green'), 0.4, 1.8);
        dist.forEach(([wd, p], k) => {
          const y = Y(11 + k * 5);
          s.text(wd, bx - 1 * u, y, { size: 2.9, align: 'right', font: 'serif', italic: true, color: s.c(k === 0 ? '--ink' : '--ink-3') });
          s.rrect(bx, y - 1.6 * u, bw * p * s.ease('two', 0.8, 0.3), 3.2 * u, 0.4, { fill: s.tint('purple', k === 0 ? 0.7 : 0.35) });
        });
        s.alpha(s.ease('two', 0.5, 1.4), () => pill(s, 'horse', X(98), Y(11), 'purple', { size: 3, font: 'serif', on: 1 }));
      });
      // h loops back
      s.alpha(s.ease('init', 0.5), () => {
        const on = lit('back');
        const col = s.tint('green', 0.5 + 0.5 * on);
        curve(s, X(72), Y(50.4), X(52), Y(50.4), -11 * u, col, 0.45 + 0.2 * on);
        s.text('h', X(62), Y(62), { size: 4, italic: true, weight: 600, color: s.c('green') });
        s.alpha(s.ease('back', 0.5), () => s.text('next step', X(62), Y(67.5), { size: 2.8, color: s.c('green') }));
      });
      s.alpha(s.ease('init', 0.5), () => s.text('one time step', X(0), Y(16), { size: 3.4, align: 'left', font: 'display', weight: 600, color: s.c('--ink-2') }));
    });

    // Phase 2: attention maps over a caption.
    const mA = s.ease('maps', 0.7);
    s.alpha(mA, () => {
      if (!pic) return loading(s, w / 2 - 20 * u, 24 * u, 40 * u);
      const words: [string, Word, number][] = [
        ['a', 'object', 0.25],
        ['horse', 'object', 2],
        ['on', 'object', 0.25],
        [s.since('mistakes') >= 0 ? 'water' : 'grass', s.since('mistakes') >= 0 ? 'water' : 'grass', 2],
      ];
      const n = words.length;
      const cols = s.tall ? 2 : 4;
      const gap = s.tall ? 8 * u : 3 * u;
      const F = s.tall ? Math.min(28 * u, (h - 46 * u) / 2) : Math.min(27 * u, (w - 10 * u - gap * (n - 1)) / n);
      const rowH = F + 9 * u;
      const x0 = (w - (cols * F + (cols - 1) * gap)) / 2;
      const y0 = s.tall ? 11 * u : (h - F - 18 * u) / 2;
      const yEnd = y0 + (n / cols) * rowH;
      const cur = s.since('horse') < 0 ? -1 : s.prog('horse') < 0.5 ? 1 : 3;
      words.forEach(([wd, q, beta], k) => {
        const a = s.ease('maps', 0.5, 0.4 + 0.45 * k);
        const x = x0 + (k % cols) * (F + gap);
        const y = y0 + Math.floor(k / cols) * rowH;
        s.alpha(a, () => {
          picture(s, 'horse', pic.rgb, x, y, F);
          attnMask(s, attendWord(pic, 'horse', q, beta).alpha, x, y, F, 1, 0.8);
          const on = k === cur || (s.since('mistakes') >= 0 && k === 3);
          if (on) s.rrect(x - 0.6 * u, y - 0.6 * u, F + 1.2 * u, F + 1.2 * u, 1, { stroke: s.c(s.since('mistakes') >= 0 ? 'red' : 'teal'), lw: 0.6 });
          const wrong = s.since('mistakes') >= 0 && k === 3;
          s.text(wd, x + F / 2, y + F + 4.5 * u, { size: 3.8, font: 'serif', italic: true, weight: on ? 600 : 450, color: s.c(wrong ? 'red' : on ? 'teal' : '--ink') });
        });
      });
      const ty = Math.min(h - 4 * u, yEnd + (s.tall ? 4 * u : 3 * u));
      s.alpha(s.win('nobody', 'mistakes'), () => fit(s, 'no region was ever labeled', w / 2, ty, w - 10 * u, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      s.alpha(s.ease('mistakes', 0.6, 0.6), () => fit(s, 'wrong word? it was looking at the sky', w / 2, ty, w - 10 * u, { size: 3.6, italic: true, color: s.c('red') }));
    });
  },
};

// ---------------------------------------------------------------- soft vs hard

const hard: SceneDef = {
  marks: {
    hard: { tex: String.raw`i \sim \operatorname{Categorical}(\symalpha),\quad \symz = \symv_i`, x: 0.5, y: 0.9, size: 4.2 },
  },
  draw(s) {
    const { h, u } = s;
    const pic = pictures(s)?.horse ?? null;
    const { S, ix, iy, px, pw } = split(s);
    if (!pic) return loading(s, ix, iy, S);
    const A = attendWord(pic, 'horse', 'grass', 2);
    const picks = hardPicks(pic);
    picture(s, 'horse', pic.rgb, ix, iy, S);
    attnMask(s, A.alpha, ix, iy, S, 1, 0.75);
    gridLines(s, ix, iy, S, 0.5);

    // How many picks are on screen.
    let n = 0;
    if (s.since('picks') >= 0) n = Math.max(1, Math.round(lerp(1, picks.length, Math.pow(s.span('picks', 'cost'), 1.6))));
    else if (s.since('die') >= 0) n = 1 + Math.min(3, Math.floor(s.since('die') / 1.2));
    else if (s.since('literal') >= 0 && s.since('literal') > 1.2) n = 1;
    if (s.since('nograd') >= 0 && s.since('picks') < 0) n = Math.min(n, 4);
    s.slot('n', n);
    const shown = picks.slice(0, n);
    const cs = S / G;
    shown.slice(-200).forEach((p, k, arr) => {
      const last = k === arr.length - 1;
      const x = ix + ((p.i % G) + 0.5 + p.jx) * cs;
      const y = iy + (Math.floor(p.i / G) + 0.5 + p.jy) * cs;
      s.circle(x, y, (last && n < 6 ? 1.4 : 0.8) * u, { fill: last && n < 6 ? s.c('--accent') : '#ffffff', stroke: '#000000', lw: 0.15 });
    });
    const lastPick = shown[shown.length - 1];
    if (lastPick && n < 6) cellBox(s, lastPick.i, ix, iy, S, '--accent', 1, 0.6);
    s.alpha(s.ease('cost', 0.6), () => {
      const p = s.prog('cost');
      for (let i = 0; i < 64; i++) cellBox(s, i, ix, iy, S, 'gold', clamp01(p * 70 - i) * 0.9, 0.3);
      s.text('reads all 64 cells, every step', ix + S / 2, iy + S + 5 * u, { size: 3, color: s.c('gold'), weight: 600 });
    });
    s.alpha(1 - s.ease('cost', 0.5), () => s.text(n > 0 ? `${n} pick${n > 1 ? 's' : ''}` : 'attention for "grass"', ix + S / 2, iy + S + 5 * u, { size: 3.1, color: s.c('--ink-2'), font: n > 0 ? 'mono' : 'serif' }));

    const rowH = Math.min(6.4 * u, S / 7);
    const by = iy + 7 * u;
    // Panel 1: one pick's features.
    const p1 = s.win('literal', 'nograd');
    s.alpha(p1, () => {
      const f = lastPick ? pic.feats[lastPick.i]! : null;
      s.text('z_hard = feats[i]', px + pw / 2, by - 5 * u, { size: 3, font: 'mono', weight: 600, color: s.c('--accent') });
      featBars(s, px, by, pw, rowH, { filled: f, fillK: '--accent', size: 2.9, labelW: 12 * u, fillA: 0.6 });
      s.alpha(s.ease('die', 0.5), () => s.text('a 64-sided die, loaded by alpha', px + pw / 2, by + 5 * rowH + 4 * u, { size: 2.9, italic: true, color: s.c('--ink-2') }));
    });
    s.show('hard', s.win('die', 'nograd'), { x: 0.5, y: Math.min(0.93, (iy + S + 11 * u) / h) });

    // Panel 2: no slope, just jumps.
    const p2 = s.win('nograd', 'rl');
    s.alpha(p2, () => {
      const L = px + 3 * u;
      const R = px + pw - 2 * u;
      const T = iy + 6 * u;
      const B = iy + S - 8 * u;
      s.line(L, B, R, B, s.c('--axis'), 0.3);
      s.line(L, B, L, T, s.c('--axis'), 0.3);
      s.text('nudge a weight', (L + R) / 2, B + 4 * u, { size: 2.9, color: s.c('--ink-2') });
      s.text('which cell', L + 1 * u, T - 2.5 * u, { size: 2.9, align: 'left', color: s.c('--ink-2') });
      const segs: [number, number, number][] = [
        [0, 0.42, 0.3],
        [0.42, 0.78, 0.72],
        [0.78, 1, 0.45],
      ];
      const reveal = s.ease('nograd', 1.4, 0.4);
      segs.forEach(([a, b, y], k) => {
        const xa = lerp(L, R, a);
        const xb = lerp(L, R, b);
        const yy = lerp(B, T, y);
        s.alpha(k === 0 ? reveal : s.ease('jump', 0.5, 0.3 * k), () => {
          s.line(xa + (k ? 1 * u : 0), yy, xb - 1 * u, yy, s.c('teal'), 0.7);
          if (k) s.circle(xa + 1 * u, yy, 0.8 * u, { fill: s.c('teal') });
        });
      });
      s.alpha(s.ease('nograd', 0.6, 1.2), () => s.text('flat: slope 0', lerp(L, R, 0.21), lerp(B, T, 0.3) - 3.5 * u, { size: 2.9, color: s.c('teal'), halo: true }));
      s.alpha(s.ease('jump', 0.6, 0.8), () => s.text('then a jump', lerp(L, R, 0.6), lerp(B, T, 0.72) - 3.5 * u, { size: 2.9, color: s.c('red'), halo: true }));
    });

    // Panel 3: REINFORCE, as a loop.
    const p3 = s.win('rl', 'picks');
    s.alpha(p3, () => {
      const bw = Math.min(pw - 4 * u, 40 * u);
      const bx = px + (pw - bw) / 2;
      const items: [string, K][] = [
        ['sample a location', '--accent'],
        ['caption: good?', 'purple'],
        ['make that pick more likely', 'teal'],
      ];
      items.forEach(([t, k], j) => {
        const y = iy + 4 * u + j * 15 * u;
        s.alpha(s.ease('reinf', 0.5, j * 0.9) + (j === 0 ? s.ease('rl', 0.5) : 0), () => {
          s.rrect(bx, y, bw, 9 * u, 1.6, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.7), lw: 0.3 });
          fit(s, t, bx + bw / 2, y + 4.5 * u, bw - 3 * u, { size: 3, font: 'ui', weight: 600, color: s.c(k) });
          if (j) s.arrow(bx + bw / 2, y - 5.8 * u, bx + bw / 2, y - 0.4 * u, s.c('--ink-3'), 0.35, 1.8);
        });
      });
      s.alpha(s.ease('reinf', 0.5, 2.8), () => {
        curve(s, bx + bw + 0.5 * u, iy + 34.5 * u, bx + bw + 0.5 * u, iy + 8.5 * u, 6 * u, s.tint('--ink-3', 0.8), 0.35);
        s.text('noisy', px + pw / 2, iy + 52 * u, { size: 3, italic: true, color: s.c('red') });
      });
      s.alpha(s.ease('rl', 0.5), () => s.text('REINFORCE', px + pw / 2, iy - 3 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    });

    // Panel 4: the average of many picks closes in on z_soft.
    const p4 = s.ease('picks', 0.6);
    s.alpha(p4, () => {
      const mean = [0, 1, 2, 3, 4].map((d) => shown.reduce((a, p) => a + pic.feats[p.i]![d]!, 0) / Math.max(1, shown.length));
      s.text('gold: z_soft', px, by - 5 * u, { size: 2.9, align: 'left', color: s.c('gold'), weight: 600 });
      s.text('teal: mean of picks', px + pw, by - 5 * u, { size: 2.9, align: 'right', color: s.c('teal'), weight: 600 });
      featBars(s, px, by, pw, rowH, { filled: A.z, fillK: 'gold', marks: mean, markK: 'teal', size: 2.9, labelW: 12 * u });
    });
  },
};

// ---------------------------------------------------------------- translation

const EN = ['the', 'black', 'cat', 'is', 'sleeping'];
const FR = ['le', 'chat', 'noir', 'dort'];
const ALIGN = [
  [0.86, 0.04, 0.06, 0.02, 0.02],
  [0.04, 0.12, 0.79, 0.03, 0.02],
  [0.03, 0.83, 0.1, 0.02, 0.02],
  [0.02, 0.02, 0.06, 0.38, 0.52],
];
/** Scores for the "chat" row: the log of its weights, shifted. */
const CHAT_SCORES = ALIGN[1]!.map((a) => Math.log(a) + 2);

const translation: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const gA = s.win('inspired', 'speech');
    s.alpha(gA, () => {
      const cs = Math.min(13 * u, (w - 34 * u) / 5, (h - 44 * u) / 4);
      const gx = (w - 5 * cs) / 2 + 7 * u;
      const gy = 30 * u;
      s.text('English in', gx + 2.5 * cs, gy - 15 * u, { size: 3, color: s.c('--ink-3') });
      EN.forEach((wd, j) => {
        const x = gx + j * cs + cs / 2;
        s.text(wd, x, gy - 9 * u, { size: Math.min(3.2, (cs / u) * 0.24), font: 'serif', italic: true });
        s.alpha(s.ease('bahdanau', 0.5, 0.15 * j), () => s.rrect(x - 3.5 * u, gy - 5 * u, 7 * u, 2.6 * u, 0.6, { fill: s.tint('orange', 0.35), stroke: s.c('orange'), lw: 0.25 }));
      });
      s.alpha(s.ease('bahdanau', 0.5, 0.9), () => s.text('v', gx - 2.5 * u, gy - 3.7 * u, { size: 3.4, italic: true, weight: 600, color: s.c('orange'), align: 'right' }));
      const rowsOn = (r: number) => {
        if (s.since('grid') >= 0) return s.ease('grid', 0.5, r * 0.45);
        if (r === 1) return s.ease('same', 0.5);
        return 0;
      };
      FR.forEach((wd, r) => {
        const y = gy + r * cs + cs / 2;
        s.alpha(r === 1 || s.since('grid') >= 0 ? 1 : 0.35, () => s.text(wd, gx - 3 * u, y, { size: 3.3, font: 'serif', italic: true, align: 'right' }));
      });
      s.text('French out', gx - 3 * u, gy + 4 * cs + 5 * u, { size: 3, align: 'right', color: s.c('--ink-3') });
      for (let r = 0; r < 4; r++)
        for (let j = 0; j < 5; j++) {
          const x = gx + j * cs;
          const y = gy + r * cs;
          s.rrect(x + 0.3 * u, y + 0.3 * u, cs - 0.6 * u, cs - 0.6 * u, 0.6, { stroke: s.tint('--ink-3', 0.35), lw: 0.2 });
          const on = rowsOn(r);
          if (on <= 0) continue;
          const toW = r === 1 && s.since('grid') < 0 ? s.ease('soft', 0.7) : 1;
          s.alpha(on, () => {
            if (toW < 1) {
              const sc = CHAT_SCORES[j]!;
              s.alpha(1 - toW, () => {
                s.rrect(x + 0.3 * u, y + 0.3 * u, cs - 0.6 * u, cs - 0.6 * u, 0.6, { fill: s.tint('purple', clamp01((sc + 2) / 4) * 0.6) });
                s.text(sc.toFixed(1), x + cs / 2, y + cs / 2, { size: Math.min(2.9, (cs / u) * 0.22), font: 'mono', weight: 600, color: s.c('purple'), halo: true });
              });
            }
            s.alpha(toW, () => {
              const a = ALIGN[r]![j]!;
              s.rrect(x + 0.3 * u, y + 0.3 * u, cs - 0.6 * u, cs - 0.6 * u, 0.6, { fill: s.tint('teal', 0.08 + 0.85 * a) });
              if (a >= 0.1) s.text(a.toFixed(2).replace(/^0/, ''), x + cs / 2, y + cs / 2, { size: Math.min(2.9, (cs / u) * 0.22), font: 'mono', weight: 600, color: s.c('--ink'), halo: true });
            });
          });
        }
      // the context for "chat"
      s.alpha(s.win('soft', 'grid'), () => {
        s.arrow(gx + 5 * cs + 1 * u, gy + 1.5 * cs, gx + 5 * cs + 4.5 * u, gy + 1.5 * cs, s.c('teal'), 0.4, 1.8);
        pill(s, 'z', gx + 5 * cs + 7.5 * u, gy + 1.5 * cs, 'gold', { size: 3.6, font: 'serif', on: 1 });
      });
      s.alpha(s.win('same', 'soft'), () => s.text('scores', gx + 5 * cs + 2 * u, gy + 1.5 * cs, { size: 3, align: 'left', color: s.c('purple'), weight: 600 }));
      // the diagonal, and where it bends
      s.alpha(s.win('diag', 'speech'), () => s.line(gx + 0.2 * cs, gy + 0.2 * cs, gx + 4.8 * cs, gy + 3.8 * cs, s.tint('--ink-3', 0.7), 0.35, [1, 0.8]));
      s.alpha(s.win('swap', 'speech'), () => {
        s.rrect(gx + 2 * cs, gy + cs, cs, cs, 0.8, { stroke: s.c('teal'), lw: 0.7 });
        s.rrect(gx + cs, gy + 2 * cs, cs, cs, 0.8, { stroke: s.c('teal'), lw: 0.7 });
        s.text('crossed', gx + 5 * cs + 2 * u, gy + 2 * cs, { size: 3, align: 'left', color: s.c('teal'), weight: 600 });
      });
      s.alpha(s.win('split', 'speech'), () => {
        s.rrect(gx + 3 * cs, gy + 3 * cs, 2 * cs, cs, 0.8, { stroke: s.c('--accent'), lw: 0.7 });
        s.text('split', gx + 5 * cs + 2 * u, gy + 3.5 * cs, { size: 3, align: 'left', color: s.c('--accent'), weight: 600 });
      });
    });

    // Speech and video.
    const sA = s.ease('speech', 0.7);
    s.alpha(sA, () => {
      const L = 8 * u;
      const R = w - 8 * u;
      const y1 = h * 0.34;
      const y2 = h * 0.7;
      const p = s.prog('speech');
      // waveform with a moving attention window
      s.text('speech: attend over audio frames', L, y1 - 13 * u, { size: 3.2, align: 'left', color: s.c('--ink-2'), weight: 600 });
      const n = 90;
      for (let k = 0; k < n; k++) {
        const x = lerp(L, R, k / (n - 1));
        const amp = (0.25 + 0.75 * Math.abs(Math.sin(k * 0.21) * Math.sin(k * 0.047 + 1))) * 8 * u;
        s.line(x, y1 - amp, x, y1 + amp, s.tint('slate', 0.55), 0.35);
      }
      const cx = lerp(L + 10 * u, R - 10 * u, clamp01(p * 1.15));
      for (let k = 0; k < n; k++) {
        const x = lerp(L, R, k / (n - 1));
        const wgt = Math.exp(-((x - cx) ** 2) / (2 * (5 * u) ** 2));
        if (wgt > 0.05) s.rrect(x - 0.5 * u, y1 + 10 * u - 6 * u * wgt, 1 * u, 6 * u * wgt, 0.2, { fill: s.tint('teal', 0.8) });
      }
      s.rrect(cx - 9 * u, y1 - 10 * u, 18 * u, 20 * u, 1.2, { stroke: s.c('teal'), lw: 0.5 });
      s.alpha(s.ease('speech', 0.6, 2.4), () => {
        s.text('video: attend over frames in time', L, y2 - 13 * u, { size: 3.2, align: 'left', color: s.c('--ink-2'), weight: 600 });
        const m = 7;
        const fw = (R - L - (m - 1) * 2 * u) / m;
        const fh = Math.min(fw * 0.7, 14 * u);
        const P = pictures(s);
        const on = Math.min(m - 1, Math.floor(clamp01((p - 0.45) * 2) * m));
        for (let k = 0; k < m; k++) {
          const x = L + k * (fw + 2 * u);
          s.rrect(x, y2 - fh / 2, fw, fh, 0.8, { fill: s.tint('slate', 0.15), stroke: s.tint('slate', 0.5), lw: 0.25 });
          if (P) {
            const ctx = s.ctx;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y2 - fh / 2, fw, fh);
            ctx.clip();
            const sz = fw;
            picture(s, 'horse', P.horse.rgb, x - k * 0.6 * u, y2 - sz / 2, sz, { frame: false });
            ctx.restore();
          }
          const wgt = Math.exp(-((k - on) ** 2) / 1.2);
          s.alpha(1 - wgt * 0.9, () => s.rrect(x, y2 - fh / 2, fw, fh, 0.8, { fill: s.tint('--card', 0.6) }));
          if (k === on) s.rrect(x - 0.5 * u, y2 - fh / 2 - 0.5 * u, fw + 1 * u, fh + 1 * u, 1, { stroke: s.c('teal'), lw: 0.55 });
        }
      });
    });
  },
};

// ---------------------------------------------------------------- DRAW

const N = 6;
const HEAD: [number, number] = [7, 7];

/** DRAW's read parameters over the scene: [gX, gY, delta, sigma]. */
function drawParams(s: Scene): [number, number, number, number] {
  let gx = 16;
  let gy = 16;
  let delta = 3;
  let sigma = 1;
  if (s.since('nums') >= 0 && s.since('stride') < 0) {
    const a = s.ease('nums', 1.4, 0.4);
    gx = lerp(16, 11, a);
    gy = lerp(16, 12, a);
  } else if (s.since('stride') >= 0 && s.since('mu') < 0) {
    gx = lerp(11, 16, s.ease('stride', 0.8));
    gy = lerp(12, 16, s.ease('stride', 0.8));
    const p = s.prog('stride');
    delta = lerp(3, 5, clamp01(p * 2.5)) - lerp(0, 2, clamp01((p - 0.5) * 3));
    sigma = 1 + lerp(0, 1.2, clamp01((p - 0.55) * 3));
  } else if (s.since('mu') >= 0 && s.since('move') < 0) {
    sigma = lerp(2.2, 1, s.ease('mu', 0.8));
  } else if (s.since('move') >= 0 && s.since('zoom') < 0) {
    const p = s.prog('move');
    const path: [number, number][] = [
      [16, 16],
      [8, 9],
      [24, 12],
      [22, 24],
      [16, 16],
    ];
    const t = clamp01(p) * (path.length - 1);
    const k = Math.min(path.length - 2, Math.floor(t));
    const f = t - k;
    const e = f * f * (3 - 2 * f);
    gx = lerp(path[k]![0], path[k + 1]![0], e);
    gy = lerp(path[k]![1], path[k + 1]![1], e);
  } else if (s.since('zoom') >= 0 && s.since('smooth') < 0) {
    const p = s.prog('zoom');
    const out = clamp01(p * 3);
    const back = clamp01((p - 0.45) * 3);
    delta = lerp(lerp(3, 5.6, out), 0.9, back);
    sigma = lerp(lerp(1, 2.2, out), 0.6, back);
    gx = lerp(16, HEAD[0], back);
    gy = lerp(16, HEAD[1], back);
  } else if (s.since('smooth') >= 0) {
    const a = s.ease('smooth', 1.2);
    delta = lerp(0.9, 3, a);
    sigma = lerp(0.6, 1, a);
    gx = lerp(HEAD[0], 16, a);
    gy = lerp(HEAD[1], 16, a);
  }
  return [gx, gy, delta, sigma];
}

const draw: SceneDef = {
  marks: {
    mu1: { tex: String.raw`\mu_X^i = g_X`, x: 0.7, y: 0.3, size: 3.6, align: 'left' },
    mu2: { tex: String.raw`\quad+\,\big(i - \tfrac{N}{2} - 0.5\big)\,\delta`, x: 0.7, y: 0.4, size: 3.6, align: 'left' },
  },
  draw(s) {
    const { w, h, u } = s;
    const pic = pictures(s)?.horse ?? null;
    const S = Math.min(54 * u, w * 0.5, h - 38 * u);
    const Sg = Math.min(30 * u, w - S - 22 * u);
    const ix = (w - (S + 12 * u + Sg)) / 2;
    const iy = 13 * u;
    if (!pic) return loading(s, ix, iy, S);
    const [gx, gy, delta, sigma] = drawParams(s);
    s.slot('gx', fmt(Math.round(gx * 10) / 10));
    s.slot('gy', fmt(Math.round(gy * 10) / 10));
    s.slot('delta', fmt(Math.round(delta * 10) / 10));
    s.slot('sigma', fmt(Math.round(sigma * 10) / 10));
    picture(s, 'horse', pic.rgb, ix, iy, S);
    const k = S / 32;
    const PX = (v: number) => ix + (v + 0.5) * k;
    const PY = (v: number) => iy + (v + 0.5) * k;

    // A fixed grid can only pick its own cells.
    const gA = s.win('limit', 'draw');
    s.alpha(gA, () => {
      gridLines(s, ix, iy, S, 0.9);
      s.alpha(1 - s.ease('any', 0.5), () => cellBox(s, 2 * G + 1, ix, iy, S, 'teal', 1, 0.7));
      s.text('only these 64 cells', ix + S / 2, iy + S + 5 * u, { size: 3.1, color: s.c('--ink-2') });
    });
    s.alpha(s.win('any', 'draw'), () => {
      const t = s.since('any');
      const bx = 6 + 6 * Math.sin(t * 0.9);
      const by = 4 + 4 * Math.sin(t * 0.7 + 1);
      const bs = 12 + 6 * Math.sin(t * 0.6 + 2);
      const c = s.ctx;
      c.save();
      c.setLineDash([1.2 * u, 0.8 * u]);
      s.rrect(PX(bx), PY(by), bs * k, bs * k, 0.6, { stroke: s.c('--accent'), lw: 0.6 });
      c.restore();
    });

    // The Gaussian grid.
    const fA = s.ease('draw', 0.7);
    s.alpha(fA, () => {
      const lo = (g: number) => g + (1 - N / 2 - 0.5) * delta;
      const hi = (g: number) => g + (N - N / 2 - 0.5) * delta;
      const ctx = s.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ix, iy, S, S);
      ctx.clip();
      ctx.setLineDash([1 * u, 0.8 * u]);
      s.rrect(PX(lo(gx) - sigma), PY(lo(gy) - sigma), (hi(gx) - lo(gx) + 2 * sigma) * k, (hi(gy) - lo(gy) + 2 * sigma) * k, 0.4, { stroke: s.c('--accent'), lw: 0.45 });
      ctx.setLineDash([]);
      for (let i = 1; i <= N; i++)
        for (let j = 1; j <= N; j++) {
          const mx = gx + (i - N / 2 - 0.5) * delta;
          const my = gy + (j - N / 2 - 0.5) * delta;
          s.circle(PX(mx), PY(my), Math.max(1, sigma * k), { stroke: 'rgba(255,255,255,0.6)', lw: 0.2 });
          s.circle(PX(mx), PY(my), 0.75 * u, { fill: s.c('--accent') });
        }
      ctx.restore();
      s.alpha(s.win('nums', 'mu'), () => {
        s.line(PX(gx) - 3 * u, PY(gy), PX(gx) + 3 * u, PY(gy), '#ffffff', 0.45);
        s.line(PX(gx), PY(gy) - 3 * u, PX(gx), PY(gy) + 3 * u, '#ffffff', 0.45);
        tag(s, '(gX, gY)', PX(gx), PY(gy) - 5 * u, 2.9);
      });
    });

    // Under the image: the filter centers along x, then the bell curves.
    const cy0 = iy + S + 3 * u;
    const cH = Math.min(14 * u, h - cy0 - 9 * u);
    const muA = s.ease('mu', 0.6);
    s.alpha(muA * (1 - s.ease('read', 0.6) * 0.3), () => {
      s.line(ix, cy0 + cH, ix + S, cy0 + cH, s.c('--axis'), 0.3);
      for (let i = 1; i <= N; i++) {
        const mx = gx + (i - N / 2 - 0.5) * delta;
        if (mx < -0.5 || mx > 31.5) continue;
        s.line(PX(mx), cy0 + cH - 1.5 * u, PX(mx), cy0 + cH + 1.5 * u, s.c('--accent'), 0.4);
      }
      s.alpha(s.ease('bell', 0.8), () => {
        const F = filterBank(gx, delta, sigma, N);
        const fmax = Math.max(...F.flat());
        const ctx = s.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.rect(ix, cy0, S, cH + 0.5 * u);
        ctx.clip();
        F.forEach((row) => {
          ctx.beginPath();
          for (let a = 0; a <= 31 * 4; a++) {
            const xx = a / 4;
            const v = Math.exp(-((xx - (gx + (F.indexOf(row) + 1 - N / 2 - 0.5) * delta)) ** 2) / (2 * sigma * sigma));
            const norm = row.reduce((p, q) => Math.max(p, q), 0) / fmax;
            const y = cy0 + cH - v * norm * (cH - 1 * u);
            if (a) ctx.lineTo(PX(xx), y);
            else ctx.moveTo(PX(xx), y);
          }
          ctx.strokeStyle = s.tint('--accent', 0.85);
          ctx.lineWidth = 0.35 * u;
          ctx.stroke();
        });
        ctx.restore();
      });
      s.text(s.since('bell') >= 0 ? 'Fx: one bell curve per filter' : 'filter centers along x', ix + S / 2, cy0 + cH + 5 * u, { size: 3, color: s.c('--accent') });
    });
    const muM = s.win('mu', 'bell');
    s.show('mu1', muM, { x: (ix + S + 3 * u) / w, y: (iy + S * 0.3) / h });
    s.show('mu2', muM, { x: (ix + S + 3 * u) / w, y: (iy + S * 0.3 + 8 * u) / h });

    const rA = s.ease('read', 0.7);
    s.alpha(rA, () => {
      const gxp = ix + S + 12 * u;
      const gyp = iy + (S - Sg) / 2;
      s.arrow(ix + S + 2 * u, iy + S / 2, gxp - 2 * u, iy + S / 2, s.c('--ink-3'), 0.45, 2);
      picture(s, 'glimpse', glimpse(pic.rgb, gx, gy, delta, sigma, N), gxp, gyp, Sg, { n: N });
      s.text('6 × 6 glimpse', gxp + Sg / 2, gyp + Sg + 4.5 * u, { size: 3.1, color: s.c('--ink-2') });
    });
    // labels for stride and blur
    s.alpha(s.win('stride', 'mu'), () => {
      const x = ix + S + 6 * u;
      s.text(`delta = ${delta.toFixed(1)}`, x, iy + S * 0.4, { size: 3.3, font: 'mono', weight: 600, align: 'left', color: s.c('--accent') });
      s.text(`sigma = ${sigma.toFixed(1)}`, x, iy + S * 0.4 + 6 * u, { size: 3.3, font: 'mono', weight: 600, align: 'left', color: s.c('--accent') });
    });
    s.alpha(s.ease('smooth', 0.6, 0.8), () => fit(s, 'smooth in gX, gY, delta, sigma: a gradient for every one', w / 2, h - 4.5 * u, w - 10 * u, { size: 3.2, italic: true, color: s.c('teal') }));
  },
};

export const scenesB: Record<string, SceneDef> = { loop, hard, translation, draw };
