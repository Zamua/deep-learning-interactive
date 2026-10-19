import { type Scene, type SceneDef, lerp, smooth } from '../../lecture/scene';
import { advantages } from '../../lib/grpo-toy';
import { COMPLETIONS, type CheckerId, check } from '../../lib/grpo-verify';
import { AFTER, ALL_RIGHT, ALL_WRONG, BASE_ROWS, BEFORE, GROUP, HIST, PROB, TRAINED_ROWS } from './data';
import { Frame, type K, advK, badge, card, chips, current, fit, fitText, pill, strike } from './kit';

const sgn = (v: number, d = 2): string => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`;

// ---------------------------------------------------------------- intro

const ROADMAP = ['verifiers', 'how they get gamed', 'PPO, recapped', 'GRPO, term by term', 'the missing critic', 'a toy, trained live', 'R1-Zero and R1', 'failures and fixes'];

/** A tiny three-layer network, the picture of a learned reward model. */
function netIcon(s: Scene, cx: number, cy: number, size: number, k: K): void {
  const cols = [3, 4, 1];
  const pts = cols.map((n, i) => Array.from({ length: n }, (_, j) => [cx + (i - 1) * size * 0.42, cy + (j - (n - 1) / 2) * size * 0.24] as [number, number]));
  for (let i = 0; i < 2; i++) for (const a of pts[i]!) for (const b of pts[i + 1]!) s.line(a[0], a[1], b[0], b[1], s.tint(k, 0.35), 0.18);
  for (const col of pts) for (const [x, y] of col) s.circle(x, y, size * 0.06, { fill: s.c(k) });
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'recap'), () => {
      const t1 = 'RL from verifiable rewards';
      const sz = fit(s, t1, w - 12 * u, 8.5, { font: 'display', weight: 600 });
      s.text(t1, w / 2, h * 0.36, { size: sz, font: 'display', weight: 600 });
      s.text('and GRPO', w / 2, h * 0.36 + sz * 1.3 * u, { size: sz, font: 'display', weight: 600, color: s.c('teal') });
      s.text('rewards a program can check', w / 2, h * 0.7, { size: 4.4, italic: true, color: s.c('--ink-2') });
    });
    const cA = s.win('recap', 'plan');
    if (cA > 0)
      s.alpha(cA, () => {
        const gap = 3 * u;
        const cw = Math.min(46 * u, (w - 10 * u - 2 * gap) / 3);
        const ch = 42 * u;
        const x0 = (w - 3 * cw - 2 * gap) / 2;
        const y0 = 15 * u;
        const head = (x: number, t: string, k: K) => fitText(s, t, x + cw / 2, y0 + 6 * u, cw - 3 * u, { size: 4.8, font: 'ui', weight: 700, color: s.c(k) });
        const foot = (x: number, a: string, b: string) => {
          fitText(s, a, x + cw / 2, y0 + ch - 9 * u, cw - 3 * u, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
          fitText(s, b, x + cw / 2, y0 + ch - 4.5 * u, cw - 3 * u, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        };
        // RLHF
        s.alpha(s.ease('recap', 0.6), () => {
          const x = x0;
          s.rrect(x, y0, cw, ch, 2.5, { fill: s.tint('blue', 0.06), stroke: s.tint('blue', 0.5), lw: 0.3 });
          head(x, 'RLHF', 'blue');
          netIcon(s, x + cw / 2, y0 + 20 * u, Math.min(cw * 0.8, 22 * u), 'blue');
          foot(x, 'reward model', 'learned from people');
          s.alpha(s.ease('guess', 0.5), () => {
            s.circle(x + cw - 6 * u, y0 + 11 * u, 3.6 * u, { fill: s.c('red') });
            s.text('?', x + cw - 6 * u, y0 + 11.3 * u, { size: 5, font: 'ui', weight: 800, color: '#ffffff' });
          });
        });
        // DPO
        s.alpha(s.ease('recap', 0.6, 2.6), () => {
          const x = x0 + cw + gap;
          s.rrect(x, y0, cw, ch, 2.5, { fill: s.tint('slate', 0.06), stroke: s.tint('slate', 0.5), lw: 0.3 });
          head(x, 'DPO', 'slate');
          const bw = Math.min(cw * 0.3, 11 * u);
          const cy = y0 + 20 * u;
          s.rrect(x + cw / 2 - bw - 3 * u, cy - 6 * u, bw, 12 * u, 1.2, { fill: s.tint('green', 0.18), stroke: s.c('green'), lw: 0.3 });
          s.rrect(x + cw / 2 + 3 * u, cy - 6 * u, bw, 12 * u, 1.2, { fill: s.tint('red', 0.12), stroke: s.c('red'), lw: 0.3 });
          s.text('≻', x + cw / 2, cy, { size: 5, font: 'ui', color: s.c('--ink-2') });
          foot(x, 'preference pairs', 'no RL loop');
          s.alpha(s.ease('guess', 0.5), () => {
            s.circle(x + cw - 6 * u, y0 + 11 * u, 3.6 * u, { fill: s.c('red') });
            s.text('?', x + cw - 6 * u, y0 + 11.3 * u, { size: 5, font: 'ui', weight: 800, color: '#ffffff' });
          });
        });
        // the checker
        s.alpha(s.ease('check', 0.6), () => {
          const x = x0 + 2 * (cw + gap);
          const on = s.ease('rlvr', 0.5);
          s.rrect(x, y0, cw, ch, 2.5, { fill: s.tint('teal', 0.06 + 0.08 * on), stroke: s.tint('teal', 0.5 + 0.4 * on), lw: 0.3 + 0.2 * on });
          s.alpha(1 - on, () => head(x, 'a checker', 'teal'));
          s.alpha(on, () => head(x, 'RLVR', 'teal'));
          fitText(s, '722 == 722', x + cw / 2, y0 + 17 * u, cw - 4 * u, { size: 4.2, font: 'mono', weight: 600 });
          badge(s, x + cw / 2, y0 + 25 * u, 3.2 * u, true);
          foot(x, 'a program checks', 'the final answer');
        });
        s.alpha(s.win('guess', 'check'), () => s.text('a learned guess has blind spots', w / 2, y0 + ch + 7 * u, { size: 4, italic: true, color: s.c('red') }));
        s.alpha(s.ease('check', 0.6), () => fitText(s, 'math answers, unit tests: no guessing needed', w / 2, y0 + ch + 7 * u, w - 8 * u, { size: 4, italic: true, color: s.c('teal') }));
        s.alpha(s.ease('grpo', 0.6), () => {
          const by = y0 + ch + 15 * u;
          const bw = Math.min(w - 10 * u, 110 * u);
          s.rrect((w - bw) / 2, by, bw, 12 * u, 2.5, { fill: s.tint('teal', 0.1), stroke: s.c('teal'), lw: 0.35 });
          fitText(s, '+ GRPO: PPO without the critic', w / 2, by + 6 * u, bw - 6 * u, { size: 4.6, font: 'ui', weight: 650, color: s.c('teal') });
        });
      });
    const pA = s.ease('plan', 0.6);
    if (pA > 0)
      s.alpha(pA, () => {
        const cols = w / u > 150 ? 4 : 2;
        const rows = ROADMAP.length / cols;
        const gap = 2.5 * u;
        const tw = (w - 10 * u - (cols - 1) * gap) / cols;
        const th = Math.min(16 * u, (80 * u - (rows - 1) * gap) / rows);
        const y0 = 14 * u + (80 * u - rows * th - (rows - 1) * gap) / 2;
        const lit = (i: number) => (i <= Math.floor(s.prog('plan') * 8.6) ? 1 : 0);
        ROADMAP.forEach((name, i) => {
          const col = cols === 2 ? Math.floor(i / rows) : i % cols;
          const row = cols === 2 ? i % rows : Math.floor(i / cols);
          const x = 5 * u + col * (tw + gap);
          const y = y0 + row * (th + gap);
          const on = lit(i);
          s.rrect(x, y, tw, th, 2, { fill: s.tint('teal', 0.05 + 0.15 * on), stroke: s.tint('teal', 0.3 + 0.6 * on), lw: 0.3 });
          s.text(String(i + 1), x + 4 * u, y + th / 2, { size: 4, font: 'mono', weight: 700, color: s.c('teal') });
          fitText(s, name, x + 8 * u, y + th / 2, tw - 10 * u, { size: 4, font: 'ui', weight: 550, align: 'left' });
        });
      });
  },
};

// ---------------------------------------------------------------- verifier

const verifier: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const A1 = s.win('q', 'rm');
    if (A1 > 0)
      s.alpha(A1, () => {
        s.text('437 + 285 = ?', w / 2, 14 * u, { size: 5.2, font: 'mono', weight: 650, color: s.c('orange') });
        const bw = Math.min(96 * u, w - 10 * u);
        const bx = (w - bw) / 2;
        const by = 21 * u;
        const lines = ['7 + 5 = 12: write 2, carry 1', '3 + 8 + 1 = 12: write 2, carry 1', '4 + 2 + 1 = 7'];
        const wrongA = s.since('wrong') >= 0 && s.since('binary') < 0;
        const second = wrongA && s.prog('wrong') >= 0.5;
        const last = second ? ['so the sum is 722.', ''] : wrongA ? ['so the sum is ', '\\boxed{712}'] : ['so the sum is ', '\\boxed{722}'];
        const size = fit(s, lines[1]!, bw - 8 * u, 3.6, { font: 'mono' });
        const oA = s.ease('out', 0.5);
        s.alpha(oA, () => {
          s.rrect(bx, by, bw, 27 * u, 2, { fill: s.tint('purple', 0.05), stroke: s.tint('purple', 0.5), lw: 0.3 });
          s.text('o', bx + 3 * u, by - 2.6 * u, { size: 4, italic: true, weight: 650, color: s.c('purple') });
          const shown = Math.floor(s.prog('out') * 4.99);
          lines.forEach((l, i) => {
            if (i < shown) s.text(l, bx + 4 * u, by + 5 * u + i * 5.6 * u, { size, font: 'mono', align: 'left', color: s.c('--ink-2') });
          });
          if (shown >= 4 || s.since('extract') >= 0) {
            const ly = by + 5 * u + 3 * 5.6 * u;
            s.text(last[0]!, bx + 4 * u, ly, { size, font: 'mono', align: 'left' });
            if (last[1]) {
              const px = bx + 4 * u + s.measure(last[0]!, { size, font: 'mono' });
              const bwx = s.measure(last[1], { size, font: 'mono', weight: 650 });
              const hl = s.ease('extract', 0.5);
              s.alpha(hl, () => s.rrect(px - u, ly - 2.8 * u, bwx + 2 * u, 5.6 * u, 1, { fill: s.tint('gold', 0.25), stroke: s.c('gold'), lw: 0.3 }));
              s.text(last[1], px, ly, { size, font: 'mono', weight: 650, align: 'left' });
            }
          }
        });
        // extract, compare, reward
        const ey = 57 * u;
        s.alpha(s.ease('extract', 0.6, 0.8), () => {
          const val = second ? 'None' : wrongA ? '712' : '722';
          s.text('extract(o)  →', w / 2 - 2 * u, ey, { size: 4, font: 'mono', align: 'right', color: s.c('--ink-2') });
          pill(s, val, w / 2 + 2 * u, ey, second ? 'red' : 'gold', { size: 4, align: 'left', font: 'mono' });
        });
        s.alpha(s.ease('compare', 0.6, 1), () => {
          const ok = !wrongA;
          const cy = 69 * u;
          const msg = second ? 'no box: wrong format' : wrongA ? '712 ≠ 722' : '722 == answer[q]';
          s.text(msg, w / 2 - 2 * u, cy, { size: 4, font: 'mono', align: 'right', color: second ? s.c('red') : s.c('--ink') });
          badge(s, w / 2 + 4.5 * u, cy, 3 * u, ok);
          s.text(`r = ${ok ? 1 : 0}`, w / 2 + 9.5 * u, cy, { size: 4.4, font: 'mono', weight: 700, align: 'left', color: s.c('gold') });
        });
        s.alpha(s.ease('binary', 0.6), () => {
          const xs = [w / 2 - 22 * u, w / 2, w / 2 + 22 * u];
          ['binary', 'cheap', 'exact'].forEach((t, i) => s.alpha(s.ease('binary', 0.5, 0.5 * i), () => pill(s, t, xs[i]!, 81 * u, 'teal', { size: 4 })));
          s.alpha(s.ease('binary', 0.6, 2.4), () => fitText(s, 'it grades the answer, never the reasoning', w / 2, 91 * u, w - 10 * u, { size: 3.8, italic: true, color: s.c('--ink-2') }));
        });
      });
    const A2 = s.ease('rm', 0.7);
    if (A2 > 0)
      s.alpha(A2, () => {
        const pw = Math.min(70 * u, (w - 14 * u) / 2);
        const lx = w / 2 - pw - 2 * u;
        const rx = w / 2 + 2 * u;
        const py = 14 * u;
        const ph = 58 * u;
        s.rrect(lx, py, pw, ph, 2.5, { fill: s.tint('blue', 0.05), stroke: s.tint('blue', 0.5), lw: 0.3 });
        fitText(s, 'reward model', lx + pw / 2, py + 6 * u, pw - 4 * u, { size: 4.4, font: 'ui', weight: 700, color: s.c('blue') });
        fitText(s, '722!! 722!! trust me ✓✓', lx + pw / 2, py + 15 * u, pw - 6 * u, { size: 3.6, font: 'mono', color: s.c('purple') });
        s.arrow(lx + pw / 2, py + 19 * u, lx + pw / 2, py + 24 * u, s.c('--ink-3'), 0.4, 2);
        netIcon(s, lx + pw / 2, py + 33 * u, Math.min(pw * 0.7, 20 * u), 'blue');
        // a gauge pinned near the top of its range
        const gx = lx + pw / 2;
        const gy = py + 51 * u;
        const gr = Math.min(pw * 0.3, 10 * u);
        s.ctx.beginPath();
        s.ctx.arc(gx, gy, gr, Math.PI, 0);
        s.ctx.strokeStyle = s.tint('blue', 0.5);
        s.ctx.lineWidth = 0.8 * u;
        s.ctx.stroke();
        const ang = Math.PI + Math.PI * lerp(0.2, 0.93, s.ease('rm', 1.2, 1.5));
        s.line(gx, gy, gx + Math.cos(ang) * gr * 0.9, gy + Math.sin(ang) * gr * 0.9, s.c('red'), 0.6);
        s.text('score', gx, gy + 3.5 * u, { size: 3.2, font: 'ui', color: s.c('--ink-3') });
        s.alpha(s.ease('fool', 0.5), () => {
          s.ctx.save();
          s.ctx.translate(lx + pw / 2, 79 * u);
          s.ctx.rotate(-0.06);
          pill(s, 'reward hacking', 0, 0, 'red', { size: 4.2, fill: 0.2 });
          s.ctx.restore();
        });
        s.alpha(s.ease('robust', 0.6), () => {
          s.rrect(rx, py, pw, ph, 2.5, { fill: s.tint('teal', 0.06), stroke: s.tint('teal', 0.6), lw: 0.35 });
          fitText(s, 'checker', rx + pw / 2, py + 6 * u, pw - 4 * u, { size: 4.4, font: 'ui', weight: 700, color: s.c('teal') });
          fitText(s, 'extract(o) == 722', rx + pw / 2, py + 20 * u, pw - 6 * u, { size: 3.8, font: 'mono', weight: 600 });
          badge(s, rx + 9 * u, py + 33 * u, 2.6 * u, true);
          fitText(s, 'right answer: 1', rx + 14 * u, py + 33 * u, pw - 16 * u, { size: 3.6, font: 'ui', align: 'left' });
          badge(s, rx + 9 * u, py + 42 * u, 2.6 * u, false);
          fitText(s, 'anything else: 0', rx + 14 * u, py + 42 * u, pw - 16 * u, { size: 3.6, font: 'ui', align: 'left' });
          fitText(s, 'no blind spot to find', rx + pw / 2, py + 51 * u, pw - 4 * u, { size: 3.6, italic: true, color: s.c('teal') });
        });
        s.alpha(s.ease('name', 0.6), () => {
          fitText(s, 'RLVR: named in Tülu 3 (AI2, 2024)', w / 2, 88 * u, w - 10 * u, { size: 3.8, font: 'ui', weight: 600 });
          fitText(s, 'DeepSeek-R1: "rule-based rewards"', w / 2, 94 * u, w - 10 * u, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
        });
      });
  },
};

// ---------------------------------------------------------------- gaming

const MODE_LABEL: Record<CheckerId, string> = { strict: 'strict: one box', string: 'last box', anybox: 'any box', anynum: 'any number' };

const gaming: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('still', 'six'), () => {
      fitText(s, 'the policy optimizes', w / 2, h * 0.4, w - 10 * u, { size: 6, font: 'display', weight: 600 });
      fitText(s, 'what the checker checks', w / 2, h * 0.4 + 9 * u, w - 10 * u, { size: 6, font: 'display', weight: 600, color: s.c('red') });
    });
    const rA = s.win('six', 'partial');
    if (rA > 0)
      s.alpha(rA, () => {
        const beat = current(s, ['six', 'anybox', 'anynum', 'strict']);
        const mode: CheckerId | null = beat === 'anybox' ? 'anybox' : beat === 'anynum' ? 'anynum' : beat === 'strict' ? 'strict' : null;
        const mA = mode ? s.ease(beat!, 0.5, 0.4) : 0;
        const y0 = 21 * u;
        const rh = 10.6 * u;
        s.text('human', 8.5 * u, 15.5 * u, { size: 3.2, font: 'ui', color: s.c('--ink-3') });
        if (mode) s.alpha(mA, () => s.text(`checker: ${MODE_LABEL[mode]}`, w - 5 * u, 15.5 * u, { size: 3.4, font: 'ui', weight: 650, align: 'right', color: s.c('teal') }));
        let ex = 0;
        COMPLETIONS.forEach((c, i) => {
          const y = y0 + i * rh;
          const a = s.ease('six', 0.4, 0.35 * i);
          s.alpha(a, () => {
            const g = mode ? check(mode, c.text) : null;
            const exploit = g !== null && g.reward === 1 && c.deserves === 0;
            const missed = g !== null && g.reward === 0 && c.deserves === 1;
            if (exploit) ex++;
            const k: K = exploit ? 'red' : missed ? 'gold' : '--ink-3';
            const hot = (exploit || missed ? 1 : 0) * mA;
            s.rrect(3.5 * u, y, w - 7 * u, rh - 1.8 * u, 1.5, { fill: s.tint(k, 0.04 + 0.12 * hot), stroke: s.tint(k, 0.3 + 0.6 * hot), lw: 0.25 + 0.2 * hot });
            s.alpha(0.75, () => badge(s, 8.5 * u, y + (rh - 1.8 * u) / 2, 2.2 * u, c.deserves === 1));
            fitText(s, c.text, 13 * u, y + (rh - 1.8 * u) / 2, w - 30 * u, { size: 3.6, font: 'mono', align: 'left' });
            if (g) s.alpha(mA, () => badge(s, w - 9 * u, y + (rh - 1.8 * u) / 2, 2.6 * u, g.reward === 1));
          });
        });
        if (mode) s.alpha(mA, () => fitText(s, ex ? `exploits rewarded: ${ex}` : 'no exploit rewarded; no box fails the format rule', w / 2, 89 * u, w - 8 * u, { size: 3.8, font: 'ui', weight: 650, color: ex ? s.c('red') : s.c('teal') }));
      });
    const tA = s.win('partial', 'answer');
    if (tA > 0)
      s.alpha(tA, () => {
        const bw = Math.min(90 * u, w - 10 * u);
        const bx = (w - bw) / 2;
        s.rrect(bx, 16 * u, bw, 18 * u, 2, { fill: s.tint('slate', 0.06), stroke: s.tint('slate', 0.5), lw: 0.3 });
        const cheat = s.ease('cheat', 0.6);
        s.text('def square(x):', bx + 4 * u, 21.5 * u, { size: 3.8, font: 'mono', align: 'left' });
        s.alpha(1 - cheat, () => s.text('    return x * x', bx + 4 * u, 28.5 * u, { size: 3.8, font: 'mono', align: 'left' }));
        s.alpha(cheat, () => fitText(s, '    return {2: 4, 3: 9, 5: 25}[x]', bx + 4 * u, 28.5 * u, bw - 8 * u, { size: 3.8, font: 'mono', align: 'left', color: s.c('red') }));
        ['square(2) == 4', 'square(3) == 9', 'square(5) == 25'].forEach((t, i) => {
          const y = 42 * u + i * 8 * u;
          s.alpha(s.ease('partial', 0.4, 1 + 0.5 * i), () => {
            s.text(`assert ${t}`, bx + 4 * u, y, { size: 3.6, font: 'mono', align: 'left', color: s.c('--ink-2') });
            badge(s, bx + bw - 6 * u, y, 2.3 * u, true);
          });
        });
        s.alpha(s.ease('partial', 0.5, 2.8), () => s.text('3 / 3 tests pass:  r = 1', w / 2, 70 * u, { size: 4.2, font: 'mono', weight: 650, color: s.c('gold') }));
        s.alpha(s.ease('cheat', 0.5, 0.8), () => {
          s.text('square(4)  →  KeyError', w / 2, 80 * u, { size: 4, font: 'mono', color: s.c('red') });
          fitText(s, 'memorized the tests, still full reward', w / 2, 88 * u, w - 10 * u, { size: 3.6, italic: true, color: s.c('red') });
        });
      });
    const aA = s.ease('answer', 0.6);
    if (aA > 0)
      s.alpha(aA, () => {
        const bw = Math.min(90 * u, w - 10 * u);
        const bx = (w - bw) / 2;
        s.text('437 + 285 = ?', w / 2, 18 * u, { size: 4.6, font: 'mono', weight: 650, color: s.c('orange') });
        s.rrect(bx, 24 * u, bw, 16 * u, 2, { fill: s.tint('purple', 0.05), stroke: s.tint('purple', 0.5), lw: 0.3 });
        fitText(s, 'roughly 700, plus a bit.', bx + 4 * u, 29 * u, bw - 8 * u, { size: 3.6, font: 'mono', align: 'left', color: s.c('--ink-2') });
        fitText(s, "I'll guess \\boxed{722}", bx + 4 * u, 35 * u, bw - 8 * u, { size: 3.6, font: 'mono', align: 'left' });
        badge(s, w / 2 - 12 * u, 49 * u, 3 * u, true);
        s.text('r = 1', w / 2 - 6 * u, 49 * u, { size: 4.4, font: 'mono', weight: 700, align: 'left', color: s.c('gold') });
        fitText(s, 'a lucky guess earns full credit', w / 2, 58 * u, w - 10 * u, { size: 3.8, italic: true, color: s.c('gold') });
        s.alpha(s.ease('lesson', 0.6), () => {
          const lw = Math.min(100 * u, w - 10 * u);
          s.rrect((w - lw) / 2, 70 * u, lw, 14 * u, 2.5, { fill: s.tint('teal', 0.1), stroke: s.c('teal'), lw: 0.35 });
          fitText(s, 'test the checker like any other code', w / 2, 77 * u, lw - 6 * u, { size: 4.4, font: 'ui', weight: 650, color: s.c('teal') });
        });
      });
  },
};

// ---------------------------------------------------------------- ppo

const ppo: SceneDef = {
  draw(s) {
    const { w, u } = s;
    // next-token probabilities, before and after a policy-gradient step (a schematic)
    const bA = s.win('policy', 'adv');
    if (bA > 0)
      s.alpha(bA, () => {
        s.text('437 + 285 =', w / 2, 15 * u, { size: 4.6, font: 'mono', weight: 650, color: s.c('orange') });
        const toks = ['722', '712', '622', '7'];
        const p0 = [0.34, 0.3, 0.21, 0.15];
        const p1 = [0.62, 0.17, 0.12, 0.09];
        const t = s.ease('pg', 1.4, 1.2);
        const bw = Math.min(14 * u, (w - 20 * u) / 6);
        const span = Math.min(w - 16 * u, 90 * u);
        const base = 72 * u;
        toks.forEach((tk, i) => {
          const x = w / 2 - span / 2 + (i + 0.5) * (span / 4);
          const p = lerp(p0[i]!, p1[i]!, t);
          const hh = p * 70 * u;
          s.rrect(x - bw / 2, base - hh, bw, hh, 1, { fill: s.tint('blue', i === 0 ? 0.6 : 0.3), stroke: s.c('blue'), lw: 0.3 });
          s.text(tk, x, base + 4 * u, { size: 4, font: 'mono', weight: 600, color: s.c('purple') });
          s.text(p.toFixed(2), x, base - hh - 3 * u, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
        });
        s.line(w / 2 - span / 2, base, w / 2 + span / 2, base, s.c('--axis'), 0.3);
        s.text('π_θ(next token), a schematic', w / 2, 88 * u, { size: 3.4, font: 'ui', color: s.c('--ink-3') });
        s.alpha(s.ease('pg', 0.5, 1.2), () => s.text('reward 1 → more likely', w / 2 - span / 2 + span * 0.3, 30 * u, { size: 3.6, font: 'ui', weight: 600, align: 'left', color: s.c('teal') }));
      });
    // advantages around a baseline
    const aA = s.win('adv', 'reuse');
    if (aA > 0)
      s.alpha(aA, () => {
        const fr = new Frame(s, 10 * u, 22 * u, w - 20 * u, 50 * u, [-0.5, 5.5, -0.15, 1.15]);
        const r = [1, 0, 0, 1, 0, 0];
        const b = 1 / 3;
        fr.hline(b, s.c('--ink-3'), 0.35, [1.5, 1]);
        s.text('baseline', fr.X(5.5), fr.Y(b) - 2.6 * u, { size: 3.3, font: 'ui', align: 'right', color: s.c('--ink-3') });
        r.forEach((v, i) => {
          const a = s.ease('adv', 0.5, 0.8 + 0.25 * i);
          s.alpha(a, () => {
            s.arrow(fr.X(i), fr.Y(b), fr.X(i), fr.Y(v) + (v ? 2.4 * u : -2.4 * u), s.c(v ? 'teal' : 'red'), 0.55, 2.2);
            badge(s, fr.X(i), fr.Y(v), 2.2 * u, v === 1);
          });
        });
        s.text('Â = r − baseline', w / 2, 84 * u, { size: 4.4, font: 'mono', weight: 650, color: s.c('teal') });
      });
    // the clipped objective
    const cA = s.win('reuse', 'critic');
    if (cA > 0)
      s.alpha(cA, () => {
        const eps = 0.2;
        const fr = new Frame(s, 10 * u, 18 * u, w - 16 * u, 64 * u, [0, 2.2, -1.5, 1.7]);
        fr.box();
        s.ctx.fillStyle = s.tint('slate', 0.12);
        s.ctx.fillRect(fr.X(1 - eps), fr.y, fr.X(1 + eps) - fr.X(1 - eps), fr.h);
        fr.hline(0, s.c('--axis'), 0.3);
        for (const v of [0.5, 1, 1.5, 2]) s.text(String(v), fr.X(v), fr.Y(0) + 3 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        s.text('1−ε', fr.X(1 - eps), fr.y + 3 * u, { size: 3.2, font: 'mono', color: s.c('slate') });
        s.text('1+ε', fr.X(1 + eps), fr.y + 3 * u, { size: 3.2, font: 'mono', color: s.c('slate') });
        s.text('ratio ρ', fr.X(2.15), fr.Y(0) - 3 * u, { size: 3.4, font: 'ui', align: 'right', color: s.c('red') });
        const obj = (x: number, A: number) => Math.min(x * A, Math.max(1 - eps, Math.min(1 + eps, x)) * A);
        const cp = s.ease('clip', 1.6);
        s.alpha(cp, () => fr.fn((x) => x, s.tint('--ink-3', 0.8), 0.35, 0, 2.2, [1.2, 1]));
        fr.fn((x) => obj(x, 1), s.c('teal'), 0.75, 0, 2.2 * cp);
        s.alpha(s.ease('flat', 0.8), () => {
          fr.fn((x) => obj(x, -1), s.tint('red', 0.75), 0.6, 0, 2.2);
          s.text('Â < 0', fr.X(0.35), fr.Y(-0.8) - 3.5 * u, { size: 3.4, font: 'ui', weight: 600, color: s.c('red') });
        });
        s.alpha(cp, () => s.text('Â > 0', fr.X(0.3), fr.Y(0.3) - 4 * u, { size: 3.4, font: 'ui', weight: 600, color: s.c('teal') }));
        let rho = 1;
        if (s.since('ratio') >= 0) rho = lerp(1, 1.3, s.ease('ratio', 1.2, 0.8));
        if (s.since('clip') >= 0) rho = lerp(1.3, 1.75, s.ease('clip', 1.4, 2.2));
        s.alpha(s.ease('reuse', 0.5, 2), () => {
          const y = obj(rho, 1);
          s.line(fr.X(rho), fr.Y(0), fr.X(rho), fr.Y(y), s.tint('red', 0.6), 0.3, [0.8, 0.8]);
          s.circle(fr.X(rho), fr.Y(y), 1.6 * u, { fill: s.c('red'), stroke: s.c('--card'), lw: 0.4 });
          s.text(`ρ = ${rho.toFixed(2)}`, fr.X(rho), fr.Y(0) + 7.5 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') });
        });
        s.alpha(s.ease('flat', 0.6, 0.4), () => s.text('flat: slope 0', fr.X(1.7), fr.Y(1.2) + 4.5 * u, { size: 3.6, font: 'ui', weight: 600, color: s.c('teal') }));
        s.alpha(s.ease('safe', 0.6), () => fitText(s, 'one batch stays inside 1 ± ε', w / 2, 90 * u, w - 10 * u, { size: 4, italic: true, color: s.c('slate') }));
      });
    // four models
    const mA = s.ease('critic', 0.6);
    if (mA > 0)
      s.alpha(mA, () => {
        const items: [string, string, K][] = [
          ['policy π_θ', 'trained', 'blue'],
          ['critic V', 'trained', 'orange'],
          ['reference', 'frozen', 'green'],
          ['reward model', 'frozen', 'gold'],
        ];
        const cols = s.tall ? 2 : 4;
        const gap = 3 * u;
        const cw = (w - 10 * u - (cols - 1) * gap) / cols;
        const ch = 18 * u;
        const y0 = s.tall ? 18 * u : 28 * u;
        items.forEach(([t, sub, k], i) => {
          const x = 5 * u + (i % cols) * (cw + gap);
          const y = y0 + Math.floor(i / cols) * (ch + gap);
          const a = i === 1 ? 1 : lerp(0.3, 1, s.ease('four', 0.5, 0.4 * (i > 1 ? i - 1 : i)));
          s.alpha(a, () => {
            card(s, x, y, cw, ch, k, t, sub, { on: i === 1 && s.since('four') < 0 ? 1 : 0.3, size: 4.4 });
            if (i === 1) strike(s, x, y, cw, ch, s.ease('heavy', 0.6, 2.5));
          });
        });
        const ty = s.tall ? y0 + 2 * ch + gap + 10 * u : y0 + ch + 14 * u;
        s.alpha(s.win('critic', 'four'), () => fitText(s, 'predicts, at every token, the reward still to come', w / 2, ty, w - 10 * u, { size: 3.8, italic: true, color: s.c('orange') }));
        s.alpha(s.win('four', 'heavy'), () => fitText(s, 'two trained, two frozen', w / 2, ty, w - 10 * u, { size: 3.8, italic: true, color: s.c('--ink-2') }));
        s.alpha(s.ease('heavy', 0.6, 2.5), () => fitText(s, 'GRPO throws the critic away', w / 2, ty, w - 10 * u, { size: 4.2, font: 'ui', weight: 650, color: s.c('red') }));
      });
  },
};

// ---------------------------------------------------------------- group

const GA = advantages(GROUP.map((g) => g.reward), true);

const group: SceneDef = {
  draw(s) {
    const { w, u } = s;
    s.alpha(s.win('idea', 'sample'), () => {
      fitText(s, 'Group Relative', w / 2, 24 * u, w - 10 * u, { size: 7, font: 'display', weight: 600 });
      fitText(s, 'Policy Optimization', w / 2, 34 * u, w - 10 * u, { size: 7, font: 'display', weight: 600 });
      s.text('Shao et al., DeepSeekMath, 2024', w / 2, 43 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('sentence', 0.6), () => {
        const cw = Math.min(56 * u, (w - 14 * u) / 2);
        const lx = w / 2 - cw - 2 * u;
        const rx = w / 2 + 2 * u;
        card(s, lx, 54 * u, cw, 22 * u, 'orange', 'train a critic', 'to guess the pass rate', { size: 4.2 });
        strike(s, lx, 54 * u, cw, 22 * u, s.ease('sentence', 0.5, 1.5));
        s.alpha(s.ease('sentence', 0.5, 2.6), () => card(s, rx, 54 * u, cw, 22 * u, 'teal', 'sample G answers', 'and look', { on: 1, size: 4.2 }));
      });
    });
    const mA = s.win('sample', 'hard');
    if (mA > 0)
      s.alpha(mA, () => {
        const narrow = s.tall;
        s.text(`q:  ${PROB.a} + ${PROB.b} = ?`, 5 * u, 13 * u, { size: 4.2, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
        const y0 = 23 * u;
        const rh = 8.6 * u;
        const cw = narrow ? 4.4 * u : 5.2 * u;
        const ch = 6.6 * u;
        const rX = w - 21 * u;
        const aX = w - 4 * u;
        const vA = s.ease('verify', 0.5);
        const advA = s.ease('adv', 0.6, 1.5);
        const tintA = s.ease('broadcast', 0.9);
        s.alpha(vA, () => s.text('r', rX, y0 - 2.6 * u, { size: 4, italic: true, weight: 650, color: s.c('gold') }));
        s.alpha(advA, () => s.text('Â', aX - 5 * u, y0 - 2.6 * u, { size: 4, italic: true, weight: 650, color: s.c('teal') }));
        GROUP.forEach((ro, i) => {
          const y = y0 + i * rh;
          const a = s.ease('sample', 0.35, 0.3 * i);
          s.alpha(a, () => {
            const hi = s.since('values') >= 0 && s.since('sum') < 0 ? (ro.reward ? smooth((s.prog('values') - 0.05) * 5) : smooth((s.prog('values') - 0.5) * 5)) : 0;
            if (hi > 0) s.alpha(hi, () => s.rrect(2 * u, y - 0.6 * u, w - 4 * u, ch + 1.2 * u, 1.5, { fill: s.tint(ro.reward ? 'teal' : 'red', 0.1) }));
            chips(s, ro, 9.5 * u, y, cw, ch, { tint: GA[i]!, tintA: tintA });
            s.alpha(s.ease('verify', 0.4, 0.25 * i), () => {
              badge(s, 5 * u, y + ch / 2, 2 * u, ro.reward === 1);
              s.text(String(ro.reward), rX, y + ch / 2, { size: 3.8, font: 'mono', weight: 650, color: s.c('gold') });
            });
            s.alpha(advA, () => s.text(sgn(GA[i]!), aX, y + ch / 2, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c(advK(GA[i]!)) }));
          });
        });
        // token legend, then the group's stats in the same corner
        s.alpha(s.win('tokens', 'mean'), () => {
          let x = w - 4 * u;
          ([['answer', 'purple'], ['check', 'orange'], ['work', 'blue']] as [string, K][]).forEach(([t, k]) => {
            x -= pill(s, t, x, 13 * u, k, { size: 3.2, align: 'right' }) + 1.2 * u;
          });
        });
        s.alpha(s.ease('mean', 0.5), () => {
          s.text('mean 0.25   std 0.43', w - 4 * u, 13 * u, { size: 3.6, font: 'mono', weight: 600, align: 'right', color: s.c('gold') });
        });
        s.alpha(s.ease('sum', 0.5), () => s.text('sum of Â = 0', aX, y0 + 8 * rh + 1.5 * u, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('teal') }));
        s.alpha(s.ease('broadcast', 0.6, 0.6), () => s.text('every token gets its row\'s Â', 9.5 * u, y0 + 8 * rh + 1.5 * u, { size: 3.6, italic: true, align: 'left', color: s.c('teal') }));
        s.slot('r', vA > 0.5 ? GROUP.map((g) => g.reward).join(', ') : '…');
      });
    const hA = s.ease('hard', 0.6);
    if (hA > 0)
      s.alpha(hA, () => {
        const cw = Math.min(64 * u, (w - 14 * u) / 2);
        const lx = w / 2 - cw - 2 * u;
        const rx = w / 2 + 2 * u;
        const box = (x: number, title: string, k: number, A: number, delay: number) =>
          s.alpha(s.ease('hard', 0.5, delay), () => {
            s.rrect(x, 16 * u, cw, 50 * u, 2.5, { fill: s.tint('teal', 0.05), stroke: s.tint('teal', 0.45), lw: 0.3 });
            fitText(s, title, x + cw / 2, 22 * u, cw - 4 * u, { size: 4.2, font: 'ui', weight: 650 });
            const r = Math.min(2.6 * u, (cw - 6 * u) / 9.5);
            for (let j = 0; j < 8; j++) {
              const col = j % 4;
              const row = Math.floor(j / 4);
              badge(s, x + cw / 2 + (col - 1.5) * r * 2.7, 32 * u + row * r * 2.7, r, j < k);
            }
            s.text(`right one: Â = ${sgn(A)}`, x + cw / 2, 50 * u, { size: fit(s, `right one: Â = ${sgn(A)}`, cw - 4 * u, 4, { font: 'mono', weight: 650 }), font: 'mono', weight: 650, color: s.c('teal') });
            fitText(s, k === 1 ? 'a rare success: big push' : 'expected: small push', x + cw / 2, 58 * u, cw - 4 * u, { size: 3.4, italic: true, color: s.c('--ink-2') });
          });
        box(lx, 'hard: 1 of 8 right', 1, 0.875 / Math.sqrt(0.875 * 0.125), 0);
        box(rx, 'easy: 7 of 8 right', 7, 0.125 / Math.sqrt(0.875 * 0.125), 2.2);
        s.alpha(s.ease('cost', 0.6), () => {
          fitText(s, 'the price: G samples per question', w / 2, 76 * u, w - 10 * u, { size: 4.4, font: 'ui', weight: 650 });
          fitText(s, 'and reasoning needs many samples anyway', w / 2, 84 * u, w - 10 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
        });
      });
  },
};

// ---------------------------------------------------------------- objective

const ROWS: [string, string, string][] = [
  ['group', String.raw`\displaystyle \frac{1}{G}\sum_{i=1}^{G}`, 'average over the G outputs'],
  ['tokens', String.raw`\displaystyle \frac{1}{|\symo_i|}\sum_{t=1}^{|\symo_i|}`, "average over output i's tokens"],
  ['ratio', String.raw`\symrho_{i,t} = \dfrac{\sympi}{\pi_{\text{old}}}`, 'now, over when sampled'],
  ['adv', String.raw`\symA_{i,t} = \symA_i`, 'same Â for every token'],
  ['clip', String.raw`\min(\symrho\symA,\ c\,\symA)`, "PPO's clip, unchanged"],
  ['kl', String.raw`-\,\symbeta\,\mathbb{D}_{i,t}`, 'KL penalty toward π_ref'],
];
const rowY = (i: number) => 0.17 + i * 0.128;

const objective: SceneDef = {
  marks: {
    full: { tex: String.raw`\begin{aligned}\mathcal{J}(\theta) &= \mathbb{E}\Big[\tfrac{1}{G}\textstyle\sum_{i}\tfrac{1}{|\symo_i|}\sum_{t}\ell_{i,t}\Big]\\ \ell_{i,t} &= \min(\symrho_{i,t}\symA_{i,t},\ c_{i,t}\symA_{i,t}) - \symbeta\,\mathbb{D}_{i,t}\\ c_{i,t} &= \operatorname{clip}(\symrho_{i,t},\,1-\symeps,\,1+\symeps)\end{aligned}`, x: 0.5, y: 0.45, size: 5.4 },
    ...Object.fromEntries(ROWS.map(([k, tex], i) => [`m${k}`, { tex, x: 0.05, y: rowY(i), size: 4, align: 'left' as const }])),
    kx: { tex: String.raw`x = \dfrac{\sympiref(o_t)}{\sympi(o_t)}`, x: 0.5, y: 0.2, size: 4.4 },
    kf: { tex: String.raw`\mathbb{D} = x - \log x - 1`, x: 0.5, y: 0.2, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const whole = s.win('whole', 'group');
    s.show('full', Math.max(whole, s.ease('code', 0.6)));
    s.alpha(whole, () => fitText(s, "PPO's objective, with two swaps", w / 2, 82 * u, w - 10 * u, { size: 4, italic: true, color: s.c('--ink-2') }));
    s.alpha(s.ease('code', 0.6, 0.5), () => fitText(s, 'about ten lines of NumPy', w / 2, 82 * u, w - 10 * u, { size: 4, italic: true, color: s.c('teal') }));
    // the rows, read one at a time
    const rowsA = s.win('group', 'inloss');
    if (rowsA > 0) {
      const beat = current(s, ROWS.map((r) => r[0]));
      ROWS.forEach(([k, , words], i) => {
        const a = s.ease(k, 0.5) * rowsA;
        const on = beat === k ? 1 : 0;
        s.show(`m${k}`, a);
        const y = rowY(i) * h;
        s.alpha(a, () => {
          if (on) s.rrect(2.5 * u, y - 6.2 * u, w - 5 * u, 12.4 * u, 1.5, { fill: s.tint('teal', 0.08), stroke: s.tint('teal', 0.4), lw: 0.25 });
          const tx = s.tall ? w * 0.48 : w * 0.42;
          fitText(s, words, tx, y, w - tx - 4 * u, { size: 3.6, font: 'ui', align: 'left', color: on ? s.c('--ink') : s.c('--ink-2') });
        });
      });
    }
    // where the KL penalty lives
    const fA = s.win('inloss', 'estimator');
    if (fA > 0)
      s.alpha(fA, () => {
        const rowFlow = (y: number, label: string, items: [string, K][], k: K) => {
          s.text(label, 5 * u, y, { size: 4.2, font: 'ui', weight: 700, align: 'left', color: s.c(k) });
          const x0 = 22 * u;
          const avail = w - x0 - 5 * u;
          const bw = (avail - (items.length - 1) * 5 * u) / items.length;
          items.forEach(([t, kk], i) => {
            const x = x0 + i * (bw + 5 * u);
            card(s, x, y - 6 * u, bw, 12 * u, kk, t, '', { size: 3.6 });
            if (i < items.length - 1) s.arrow(x + bw + 0.6 * u, y, x + bw + 4.4 * u, y, s.c('--ink-3'), 0.35, 1.6);
          });
        };
        rowFlow(32 * u, 'PPO', [['r − β·KL', 'gold'], ['critic V', 'orange'], ['Â', 'teal']], 'slate');
        s.alpha(s.ease('inloss', 0.6, 3), () => {
          rowFlow(58 * u, 'GRPO', [['r', 'gold'], ['group', 'teal'], ['Â', 'teal']], 'teal');
          fitText(s, 'and the loss subtracts β·D directly', w / 2, 76 * u, w - 10 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
        });
      });
    // the KL estimator
    const kA = s.win('estimator', 'code');
    if (kA > 0) {
      s.show('kx', kA * (1 - s.ease('curve', 0.5)));
      s.show('kf', kA * s.ease('curve', 0.5));
      s.alpha(kA, () => {
        const fr = new Frame(s, 12 * u, 32 * u, w - 20 * u, 52 * u, [0, 3.2, -0.15, 1.3]);
        fr.box();
        fr.hline(0, s.c('--axis'), 0.3);
        fr.vline(1, s.tint('--ink-3', 0.5), 0.25, [0.8, 0.8]);
        for (const v of [1, 2, 3]) s.text(String(v), fr.X(v), fr.Y(0) + 3 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        s.text('x', fr.X(3.1), fr.Y(0) - 3 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
        const p = s.ease('curve', 2.2, 0.4);
        if (p > 0) fr.fn((x) => x - Math.log(x) - 1, s.c('green'), 0.7, 0.13, 0.13 + 3.05 * p);
        s.alpha(s.ease('curve', 0.6, 2.2), () => {
          s.circle(fr.X(1), fr.Y(0), 1.4 * u, { fill: s.c('green') });
          s.line(fr.X(1), fr.Y(0) - 1.6 * u, fr.X(1.25), fr.Y(1.0) + 2 * u, s.tint('green', 0.6), 0.25);
          s.text('0 at x = 1: the models agree', fr.X(1.25), fr.Y(1.0), { size: 3.4, font: 'ui', align: 'left', color: s.c('green'), halo: true });
        });
        s.alpha(s.ease('unbiased', 0.6), () => fitText(s, 'its average is the true KL; never negative', w / 2, 91 * u, w - 10 * u, { size: 3.8, italic: true, color: s.c('--ink-2') }));
      });
    }
  },
};

// ---------------------------------------------------------------- memory

const BYTES: [string, number, K][] = [
  ['weights', 2, 'blue'],
  ['grads', 2, 'teal'],
  ['fp32 copy', 4, 'slate'],
  ['Adam m', 4, 'orange'],
  ['Adam v', 4, 'gold'],
];

const memory: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const bA = s.win('bytes', 'ppo');
    if (bA > 0)
      s.alpha(bA, () => {
        const x0 = 6 * u;
        const bw = w - 12 * u;
        const per = bw / 16;
        s.text('trained model: 16 bytes per parameter', w / 2, 20 * u, { size: fit(s, 'trained model: 16 bytes per parameter', w - 10 * u, 4.4, { font: 'ui', weight: 650 }), font: 'ui', weight: 650 });
        let x = x0;
        BYTES.forEach(([name, b, k], i) => {
          const a = s.since('split') < 0 ? s.ease('bytes', 0.6, 0.6) : s.ease('split', 0.4, 1.2 * i);
          s.alpha(a, () => {
            s.rrect(x + 0.2 * u, 27 * u, b * per - 0.4 * u, 10 * u, 1, { fill: s.tint(k, 0.7) });
            s.text(String(b), x + (b * per) / 2, 32 * u, { size: 3.8, font: 'mono', weight: 700, color: '#ffffff' });
            const ly = i % 2 === 0 ? 42 * u : 47.5 * u;
            s.alpha(s.ease('split', 0.4, 1.2 * i), () => fitText(s, name, x + (b * per) / 2, ly, b * per * 1.8, { size: 3.4, font: 'ui', color: s.c(k) }));
          });
          x += b * per;
        });
        s.alpha(s.ease('frozen', 0.6), () => {
          s.text('frozen model: 2 bytes per parameter', w / 2, 62 * u, { size: fit(s, 'frozen model: 2 bytes per parameter', w - 10 * u, 4.4, { font: 'ui', weight: 650 }), font: 'ui', weight: 650 });
          s.rrect(x0 + 0.2 * u, 68 * u, 2 * per - 0.4 * u, 10 * u, 1, { fill: s.tint('blue', 0.7) });
          s.text('2', x0 + per, 73 * u, { size: 3.8, font: 'mono', weight: 700, color: '#ffffff' });
          s.text('bf16 weights, inference only', x0 + 2 * per + 3 * u, 73 * u, { size: 3.4, font: 'ui', align: 'left', color: s.c('--ink-2') });
        });
      });
    const rA = s.ease('ppo', 0.6);
    if (rA > 0)
      s.alpha(rA * (1 - 0.6 * s.ease('compute', 0.6)), () => {
        const N = 7;
        const parts: [string, number, K][] = [
          ['policy', 16 * N, 'blue'],
          ['critic', 16 * N, 'orange'],
          ['ref', 2 * N, 'green'],
          ['reward', 2 * N, 'gold'],
        ];
        const rows: [string, boolean[], string][] = [
          ['PPO', [true, true, true, true], 'ppo'],
          ['GRPO', [true, false, true, true], 'grpo'],
          ['GRPO + verifier', [true, false, true, false], 'rlvr'],
        ];
        const x0 = 6 * u;
        const scale = (w - 12 * u) / 252;
        rows.forEach(([name, has, beat], i) => {
          const y = 16 * u + i * 21 * u;
          s.alpha(s.ease(beat, 0.6), () => {
            const tot = parts.reduce((a, p, j) => a + (has[j] ? p[1] : 0), 0);
            s.text(`${name}: ${tot} GB`, x0, y, { size: 4, font: 'ui', weight: 650, align: 'left' });
            let x = x0;
            parts.forEach(([, gb, k], j) => {
              const ww = gb * scale;
              if (has[j]) s.rrect(x + 0.15 * u, y + 3 * u, ww - 0.3 * u, 8 * u, 1, { fill: s.tint(k, 0.72) });
              else {
                s.ctx.setLineDash([u, 0.8 * u]);
                s.rrect(x + 0.15 * u, y + 3 * u, ww - 0.3 * u, 8 * u, 1, { stroke: s.tint(k, 0.6), lw: 0.25 });
                s.ctx.setLineDash([]);
              }
              x += ww;
            });
          });
        });
        // legend
        const ly = 80 * u;
        const lw = (w - 12 * u) / 4;
        parts.forEach(([nm, , k], j) => {
          s.rrect(x0 + j * lw, ly - 1.5 * u, 3 * u, 3 * u, 0.6, { fill: s.tint(k, 0.75) });
          fitText(s, nm, x0 + j * lw + 4.5 * u, ly, lw - 5 * u, { size: 3.4, font: 'ui', align: 'left', color: s.c('--ink-2') });
        });
        s.alpha(s.ease('grpo', 0.5, 1.5), () => s.text('−112 GB', x0 + 112 * scale + 56 * scale, 16 * u + 21 * u + 7 * u, { size: 3.6, font: 'mono', weight: 700, color: s.c('red') }));
      });
    s.alpha(s.ease('compute', 0.6), () => {
      const bw = Math.min(110 * u, w - 10 * u);
      s.rrect((w - bw) / 2, 86 * u, bw, 10 * u, 2, { fill: s.tint('teal', 0.12), stroke: s.c('teal'), lw: 0.3 });
      s.alpha(1 - s.ease('compute', 0.5, 3), () => fitText(s, 'also gone: the critic\'s forward and backward passes', w / 2, 91 * u, bw - 4 * u, { size: 3.6, font: 'ui', weight: 600, color: s.c('teal') }));
      s.alpha(s.ease('compute', 0.5, 3), () => fitText(s, 'freed for generating: long answers, many per prompt', w / 2, 91 * u, bw - 4 * u, { size: 3.6, font: 'ui', weight: 600, color: s.c('teal') }));
    });
  },
};

// ---------------------------------------------------------------- toy

const toy: SceneDef = {
  draw(s) {
    const { w, u } = s;
    // the world: a column sum and three tokens
    const wA = s.win('world', 'base');
    if (wA > 0)
      s.alpha(wA, () => {
        const ax = s.tall ? 22 * u : w * 0.24;
        const sz = 6;
        ['  437', '+ 285'].forEach((l, i) => s.text(l, ax, 22 * u + i * 8 * u, { size: sz, font: 'mono', weight: 600 }));
        s.line(ax - 10 * u, 33 * u, ax + 10 * u, 33 * u, s.c('--ink-2'), 0.4);
        s.alpha(s.ease('world', 0.5, 2.5), () => s.text('  722', ax, 39 * u, { size: sz, font: 'mono', weight: 600, color: s.c('purple') }));
        s.text('1 to 4 digits', ax, 48 * u, { size: 3.4, italic: true, color: s.c('--ink-3') });
        const lx = s.tall ? 44 * u : w * 0.48;
        const items: [string, string, K][] = [
          ['2', 'work: add the next column', 'blue'],
          ['✓', 'check: re-add what is done', 'orange'],
          ['722', 'answer: write it and stop', 'purple'],
        ];
        items.forEach(([lab, txt, k], i) => {
          const y = 17 * u + i * 10 * u;
          s.alpha(s.ease('vocab', 0.5, 0.9 * i), () => {
            const cw = i === 2 ? 11 * u : 6 * u;
            s.rrect(lx, y, cw, 7 * u, 1, { fill: s.tint(k, 0.14), stroke: s.tint(k, 0.85), lw: 0.3 });
            s.text(lab, lx + cw / 2, y + 3.6 * u, { size: 3.8, font: 'mono', weight: 650, color: i === 1 ? s.c('orange') : s.c('--ink') });
            fitText(s, txt, lx + 13 * u, y + 3.6 * u, w - lx - 16 * u, { size: 3.6, font: 'ui', align: 'left' });
          });
        });
        // a slip, caught by a check
        s.alpha(s.ease('slips', 0.6), () => {
          const y = 62 * u;
          const cw = 6.5 * u;
          const x0 = w / 2 - 22 * u;
          const fixed = s.ease('slips', 0.6, 3.2);
          const seq: [string, K][] = [['2', 'blue'], [fixed > 0.5 ? '2' : '3', 'blue'], ['✓', 'orange'], ['7', 'blue'], ['722', 'purple']];
          let x = x0;
          seq.forEach(([lab, k], i) => {
            const ww = i === 4 ? 12 * u : cw;
            s.rrect(x + 0.3 * u, y, ww - 0.6 * u, 7.5 * u, 1, { fill: s.tint(k, 0.14), stroke: i === 1 ? s.c(fixed > 0.5 ? 'green' : 'red') : s.tint(k, 0.85), lw: i === 1 ? 0.55 : 0.3 });
            s.text(lab, x + ww / 2, y + 3.9 * u, { size: 3.8, font: 'mono', weight: 650, color: i === 2 ? s.c('orange') : s.c('--ink') });
            x += ww;
          });
          s.alpha(1 - fixed, () => s.text('slip (15%)', x0 + cw * 1.5, y + 11 * u, { size: 3.4, font: 'ui', color: s.c('red') }));
          s.alpha(fixed, () => s.text('fixed by the check (70%)', x0 + cw * 1.5, y + 11 * u, { size: 3.4, font: 'ui', align: 'left', color: s.c('green') }));
          s.alpha(s.ease('slips', 0.6, 5), () => fitText(s, 'columns never worked out are guessed', w / 2, 86 * u, w - 10 * u, { size: 3.6, italic: true, color: s.c('--ink-2') }));
        });
      });
    // the base model's outputs
    s.alpha(s.win('base', 'train'), () => {
      s.text('the base model', w / 2, 16 * u, { size: 4.4, font: 'ui', weight: 650 });
      BASE_ROWS.forEach((ro, i) => {
        const y = 24 * u + i * 11 * u;
        badge(s, 10 * u, y + 3.75 * u, 2.4 * u, ro.reward === 1);
        chips(s, ro, 15 * u, y, 6 * u, 7.5 * u);
      });
      s.text(`right about ${Math.round(BEFORE.acc * 10) * 10}% of the time`, w / 2, 76 * u, { size: 4, italic: true, color: s.c('--ink-2') });
    });
    // training curves
    const cA = s.win('train', 'why');
    if (cA > 0)
      s.alpha(cA, () => {
        const fr = new Frame(s, 9 * u, 15 * u, w - 15 * u, 56 * u, [0, 400, 0, 1]);
        fr.box();
        for (const v of [0.25, 0.5, 0.75]) fr.hline(v, s.tint('--ink-3', 0.2), 0.2);
        for (const v of [100, 200, 300]) s.text(String(v), fr.X(v), fr.y + fr.h + 3 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('step', fr.X(400), fr.y + fr.h + 3 * u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
        const n = Math.max(1, Math.round(399 * Math.min(1, Math.max(0, (s.t - s.at('train')) / (s.end('len') - s.at('train') - 0.3)))));
        const xs = Array.from({ length: n + 1 }, (_, i) => i);
        fr.path(xs, xs.map((i) => HIST.acc[i]!), s.c('gold'), 0.75);
        s.alpha(s.ease('len', 0.6), () => fr.path(xs, xs.map((i) => HIST.len[i]! / 12), s.c('purple'), 0.65));
        s.text('accuracy', fr.x + 2 * u, fr.y + 4 * u, { size: 3.4, font: 'ui', weight: 650, align: 'left', color: s.c('gold') });
        s.alpha(s.ease('len', 0.6), () => s.text('length (0 to 12 tokens)', fr.x + 2 * u, fr.y + 9 * u, { size: 3.4, font: 'ui', weight: 650, align: 'left', color: s.c('purple') }));
        const acc = HIST.acc[n]!;
        const len = HIST.len[n]!;
        s.text(`accuracy ${Math.round(acc * 100)}%`, w * 0.3, 82 * u, { size: 4.2, font: 'mono', weight: 650, color: s.c('gold') });
        s.alpha(s.ease('len', 0.6), () => s.text(`length ${len.toFixed(1)}`, w * 0.72, 82 * u, { size: 4.2, font: 'mono', weight: 650, color: s.c('purple') }));
        s.slot('step', n + 1);
        s.slot('acc', `${Math.round(acc * 100)}%`);
        s.slot('len', len.toFixed(1));
      });
    // what the extra tokens are
    const kA = s.win('why', 'r1');
    if (kA > 0)
      s.alpha(kA, () => {
        const parts: [keyof typeof BEFORE, string, K][] = [
          ['answer', 'answer', 'purple'],
          ['work', 'work', 'blue'],
          ['check', 'check', 'orange'],
          ['filler', 'filler', 'slate'],
        ];
        const beat = current(s, ['why', 'filler', 'checks']);
        const focus = beat === 'filler' ? 'filler' : beat === 'checks' ? 'check' : null;
        const x0 = 22 * u;
        const scale = (w - x0 - 6 * u) / 6;
        const rowsC: [string, typeof BEFORE][] = [['before', BEFORE], ['after', AFTER]];
        s.text('tokens per output, by kind', w / 2, 16 * u, { size: 4, font: 'ui', weight: 650 });
        rowsC.forEach(([nm, c], i) => {
          const y = 26 * u + i * 20 * u;
          const tot = c.work + c.filler + c.check + c.answer;
          s.text(nm, 5 * u, y + 5 * u, { size: 3.8, font: 'ui', weight: 650, align: 'left' });
          s.text(`${tot.toFixed(1)} tokens`, x0 + tot * scale, y + 14 * u, { size: 3.4, font: 'mono', align: 'right', color: s.c('--ink-2') });
          let x = x0;
          parts.forEach(([key, , k]) => {
            const v = c[key] as number;
            const ww = v * scale;
            const dim = focus && focus !== key ? 0.3 : 1;
            s.alpha(dim, () => s.rrect(x + 0.15 * u, y, ww - 0.3 * u, 10 * u, 1, { fill: s.tint(k, 0.72) }));
            if (ww > 7 * u) s.alpha(dim, () => s.text(v.toFixed(1), x + ww / 2, y + 5 * u, { size: 3.4, font: 'mono', weight: 700, color: '#ffffff' }));
            x += ww;
          });
        });
        const lw = (w - 10 * u) / 4;
        parts.forEach(([, nm, k], j) => {
          s.rrect(5 * u + j * lw, 70 * u, 3 * u, 3 * u, 0.6, { fill: s.tint(k, 0.75) });
          s.text(nm, 5 * u + j * lw + 4.5 * u, 71.5 * u, { size: 3.4, font: 'ui', align: 'left', color: s.c('--ink-2') });
        });
        s.alpha(s.win('filler', 'checks'), () => fitText(s, 'filler: work after the last column, never penalized', w / 2, 84 * u, w - 10 * u, { size: 3.6, italic: true, color: s.c('slate') }));
        s.alpha(s.ease('checks', 0.6), () => fitText(s, `checks: ${BEFORE.check.toFixed(2)} → ${AFTER.check.toFixed(2)} per output`, w / 2, 84 * u, w - 10 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('orange') }));
      });
    s.alpha(s.ease('r1', 0.6), () => {
      s.text('after 400 steps', w / 2, 16 * u, { size: 4.4, font: 'ui', weight: 650 });
      TRAINED_ROWS.forEach((ro, i) => {
        const y = 24 * u + i * 11 * u;
        badge(s, 8 * u, y + 3.75 * u, 2.4 * u, ro.reward === 1);
        chips(s, ro, 13 * u, y, 6 * u, 7.5 * u);
      });
      fitText(s, 'longer · more checking · more accurate', w / 2, 78 * u, w - 10 * u, { size: 4, font: 'ui', weight: 650, color: s.c('teal') });
    });
  },
};

// ---------------------------------------------------------------- r1zero

const r1zero: SceneDef = {
  draw(s) {
    const { w, u } = s;
    s.alpha(s.win('jan', 'template'), () => {
      fitText(s, 'DeepSeek-R1, January 2025', w / 2, 16 * u, w - 10 * u, { size: 5, font: 'display', weight: 600 });
      const steps: [string, K][] = [['DeepSeek-V3-Base', 'slate'], ['GRPO + rule rewards', 'teal'], ['R1-Zero', 'purple']];
      const a = s.ease('nosft', 0.6);
      steps.forEach(([t, k], i) => {
        s.alpha(i === 0 ? s.ease('jan', 0.6, 1) : s.ease('nosft', 0.5, 0.9 * i), () => {
          if (s.tall) {
            const bw = Math.min(70 * u, w - 20 * u);
            const y = 27 * u + i * 20 * u;
            card(s, (w - bw) / 2, y, bw, 12 * u, k, t, '', { on: i === 2 ? 1 : 0.3, size: 4.4 });
            if (i > 0) s.arrow(w / 2, y - 7.5 * u, w / 2, y - 1 * u, s.c('--ink-3'), 0.4, 1.8);
          } else {
            const bw = (w - 26 * u) / 3;
            const x = 5 * u + i * (bw + 8 * u);
            card(s, x, 40 * u, bw, 16 * u, k, t, '', { on: i === 2 ? 1 : 0.3, size: 4.4 });
            if (i > 0) s.arrow(x - 7 * u, 48 * u, x - 1 * u, 48 * u, s.c('--ink-3'), 0.4, 1.8);
          }
        });
      });
      s.alpha(a, () => {
        if (s.tall) pill(s, 'no SFT', w / 2 + 22 * u, 43 * u, 'red', { size: 3.4 });
        else pill(s, 'no SFT', 5 * u + (w - 26 * u) / 3 + 4 * u, 64 * u, 'red', { size: 3.4 });
      });
    });
    const tA = s.win('template', 'aime');
    if (tA > 0)
      s.alpha(tA, () => {
        const bw = Math.min(100 * u, w - 10 * u);
        const bx = (w - bw) / 2;
        s.rrect(bx, 16 * u, bw, 30 * u, 2, { fill: s.tint('slate', 0.05), stroke: s.tint('slate', 0.5), lw: 0.3 });
        fitText(s, 'template:', bx + 4 * u, 21.5 * u, bw - 8 * u, { size: 3.4, font: 'ui', align: 'left', color: s.c('--ink-3') });
        fitText(s, '... first think, then answer.', bx + 4 * u, 28 * u, bw - 8 * u, { size: 3.6, font: 'mono', align: 'left' });
        fitText(s, '<think> reasoning </think>', bx + 4 * u, 34.5 * u, bw - 8 * u, { size: 3.6, font: 'mono', align: 'left', color: s.c('purple') });
        fitText(s, '<answer> answer </answer>', bx + 4 * u, 41 * u, bw - 8 * u, { size: 3.6, font: 'mono', align: 'left', color: s.c('purple') });
        s.alpha(s.ease('rewards', 0.6), () => {
          const y = 58 * u;
          const cw = Math.min(48 * u, (w - 14 * u) / 2);
          card(s, w / 2 - cw - 2 * u, y, cw, 14 * u, 'gold', 'accuracy', 'checker / test cases', { on: 0.6, size: 4 });
          card(s, w / 2 + 2 * u, y, cw, 14 * u, 'gold', 'format', '<think> tags present', { on: 0.6, size: 4 });
          s.alpha(s.ease('rewards', 0.5, 3.5), () => {
            const rw = Math.min(56 * u, w - 20 * u);
            card(s, (w - rw) / 2, 78 * u, rw, 11 * u, 'blue', 'reward model', '', { size: 3.8 });
            strike(s, (w - rw) / 2, 78 * u, rw, 11 * u, 1);
          });
        });
      });
    const aA = s.win('aime', 'long');
    if (aA > 0)
      s.alpha(aA, () => {
        const bars: [string, number, string][] = [['start', 15.6, 'aime'], ['after RL', 71.0, 'aime'], ['vote of 64', 86.7, 'vote']];
        const fr = new Frame(s, 12 * u, 18 * u, w - 20 * u, 56 * u, [0, 3, 0, 100]);
        fr.hline(0, s.c('--axis'), 0.3);
        for (const v of [25, 50, 75, 100]) {
          fr.hline(v, s.tint('--ink-3', 0.18), 0.2);
          s.text(`${v}%`, fr.x - 1.5 * u, fr.Y(v), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
        }
        bars.forEach(([name, v, beat], i) => {
          const g = s.ease(beat, 1, i === 1 ? 2.2 : 0.6);
          const x = fr.X(i + 0.5);
          const bw = Math.min(16 * u, fr.w / 5);
          s.alpha(Math.min(1, g * 3), () => {
            s.rrect(x - bw / 2, fr.Y(v * g), bw, fr.Y(0) - fr.Y(v * g), 1, { fill: s.tint(i === 2 ? 'teal' : 'gold', 0.7) });
            s.text(`${(v * g).toFixed(1)}%`, x, fr.Y(v * g) - 3 * u, { size: 3.6, font: 'mono', weight: 650 });
            s.text(name, x, fr.Y(0) + 3.5 * u, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
          });
        });
        fitText(s, 'AIME 2024, as reported in the DeepSeek-R1 paper', w / 2, 88 * u, w - 10 * u, { size: 3.4, italic: true, color: s.c('--ink-3') });
      });
    s.alpha(s.win('long', 'aha'), () => {
      const docs: [string, number][] = [['early', 2], ['middle', 5], ['late', 10]];
      const dw = Math.min(22 * u, (w - 30 * u) / 3);
      docs.forEach(([nm, n], i) => {
        const x = w / 2 + (i - 1) * (dw + 8 * u) - dw / 2;
        s.alpha(s.ease('long', 0.5, 0.9 * i), () => {
          const hh = 6 * u + n * 5.5 * u;
          const y = 76 * u - hh;
          s.rrect(x, y, dw, hh, 1.2, { fill: s.tint('purple', 0.06), stroke: s.tint('purple', 0.5), lw: 0.3 });
          for (let j = 0; j < n; j++) s.line(x + 2.5 * u, y + 4 * u + j * 5.5 * u, x + dw - 2.5 * u - ((j * 37) % 5) * u, y + 4 * u + j * 5.5 * u, s.tint('--ink-3', 0.5), 0.6);
          s.text(nm, x + dw / 2, 80.5 * u, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        });
      });
      fitText(s, 'answers grow from hundreds to thousands of tokens', w / 2, 89 * u, w - 10 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
      fitText(s, '(schematic)', w / 2, 16 * u, w - 10 * u, { size: 3.2, italic: true, color: s.c('--ink-3') });
    });
    const hA = s.ease('aha', 0.6);
    if (hA > 0)
      s.alpha(hA, () => {
        const bw = Math.min(104 * u, w - 10 * u);
        const bx = (w - bw) / 2;
        s.rrect(bx, 18 * u, bw, 34 * u, 3, { fill: s.tint('orange', 0.08), stroke: s.c('orange'), lw: 0.4 });
        const c = s.ctx;
        c.beginPath();
        c.moveTo(bx + 12 * u, 52 * u);
        c.lineTo(bx + 16 * u, 58 * u);
        c.lineTo(bx + 20 * u, 52 * u);
        c.fillStyle = s.tint('orange', 0.08);
        c.fill();
        fitText(s, '"Wait, wait. Wait. That\'s an aha', w / 2, 29 * u, bw - 8 * u, { size: 5, italic: true });
        fitText(s, 'moment I can flag here."', w / 2, 38 * u, bw - 8 * u, { size: 5, italic: true });
        s.text('an R1-Zero checkpoint, quoted in the paper', w / 2, 46.5 * u, { size: fit(s, 'an R1-Zero checkpoint, quoted in the paper', bw - 8 * u, 3.2, { font: 'ui' }), font: 'ui', color: s.c('--ink-3') });
        s.alpha(s.ease('aha', 0.6, 4), () => fitText(s, 'then it re-checks its own work', w / 2, 66 * u, w - 10 * u, { size: 4, font: 'ui', weight: 600, color: s.c('orange') }));
        s.alpha(s.ease('flaws', 0.6), () => {
          pill(s, 'hard to read', w / 2 - 3 * u, 80 * u, 'red', { size: 3.8, align: 'right' });
          pill(s, 'mixes languages', w / 2 + 3 * u, 80 * u, 'red', { size: 3.8, align: 'left' });
        });
      });
  },
};

// ---------------------------------------------------------------- r1

const STAGES: [string, string, string, K, string?][] = [
  ['base', 'DeepSeek-V3-Base', 'pretrained only', 'slate'],
  ['cold', '1  cold start', 'SFT: thousands of long CoTs', 'blue'],
  ['rl1', '2  reasoning RL', 'GRPO: rules + one language', 'blue'],
  ['rs', '3  rejection sampling', '~600k right + ~200k general', 'blue'],
  ['sft', '3  SFT the base again', '~800k samples, 2 epochs', 'blue'],
  ['rl2', '4  RL for all prompts', 'rules + reward models', 'blue', 'R1'],
  ['distill', 'distillation', 'SFT Qwen, Llama: 1.5B to 70B', 'teal', 'R1-Distill'],
];

const r1: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const beats = ['stages', 'cold', 'rl1', 'rs', 'sft', 'rl2', 'distill'];
    const at = current(s, [...beats, 'strong', 'vsrl', 'lesson']);
    const litIdx = at === 'stages' ? 0 : at === 'strong' ? 6 : beats.indexOf(at ?? 'stages');
    const fade = 1 - s.ease('vsrl', 0.6);
    s.alpha(fade, () => {
      const bh = 10 * u;
      const gap = 1.9 * u;
      const bx = 5 * u;
      const bw = s.tall ? w - 36 * u : Math.min(w * 0.55, 90 * u);
      const ox = bx + bw + 4 * u;
      const ow = s.tall ? w - ox - 4 * u : 26 * u;
      STAGES.forEach(([beat, title, sub, k, out], i) => {
        const y = 13 * u + i * (bh + gap);
        const reached = i === 0 || s.since(beat) >= 0;
        const on = i === litIdx && at !== 'vsrl' && at !== 'lesson' ? 1 : 0;
        s.alpha(reached ? 1 : 0.3, () => {
          card(s, bx, y, bw, bh, k, title, sub, { on, size: 4.2 });
          if (i > 0) s.arrow(bx + 6 * u, y - gap + 0.3 * u, bx + 6 * u, y - 0.3 * u, s.c('--ink-3'), 0.3, 1.2);
          if (out) {
            s.line(bx + bw + 0.5 * u, y + bh / 2, ox - 0.5 * u, y + bh / 2, s.c('--ink-3'), 0.3);
            s.rrect(ox, y + 1.5 * u, ow, bh - 3 * u, 3, { fill: s.tint(k, reached ? 0.8 : 0.15) });
            fitText(s, out, ox + ow / 2, y + bh / 2, ow - 2 * u, { size: 3.8, font: 'ui', weight: 700, color: reached ? '#ffffff' : s.c(k) });
          }
        });
      });
      s.alpha(s.ease('sft', 0.5), () => {
        const y = 13 * u + 4 * (bh + gap) + bh / 2;
        fitText(s, 'starts from', ox, y - 2.2 * u, ow, { size: 3.4, italic: true, align: 'left', color: s.c('slate') });
        fitText(s, 'the base again', ox, y + 2.2 * u, ow, { size: 3.4, italic: true, align: 'left', color: s.c('slate') });
      });
    });
    const vA = s.ease('vsrl', 0.6);
    if (vA > 0)
      s.alpha(vA, () => {
        const cw = Math.min(56 * u, (w - 16 * u) / 2);
        const y = 24 * u;
        card(s, w / 2 - cw - 3 * u, y, cw, 22 * u, 'orange', 'RL directly', 'on a 32B base', { size: 4.2 });
        card(s, w / 2 + 3 * u, y, cw, 22 * u, 'teal', 'R1 distilled', 'into a 32B model', { on: 1, size: 4.2 });
        s.text('<', w / 2, y + 11 * u, { size: 7, font: 'ui', weight: 700, color: s.c('--ink-2') });
        fitText(s, 'distillation wins, by a wide margin', w / 2, 56 * u, w - 10 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
        s.alpha(s.ease('lesson', 0.6), () => {
          const bw = Math.min(110 * u, w - 10 * u);
          s.rrect((w - bw) / 2, 66 * u, bw, 20 * u, 2.5, { fill: s.tint('teal', 0.1), stroke: s.c('teal'), lw: 0.35 });
          fitText(s, 'discover reasoning with RL, at scale;', w / 2, 72.5 * u, bw - 6 * u, { size: 4, font: 'ui', weight: 650, color: s.c('teal') });
          fitText(s, 'hand it down with plain fine-tuning', w / 2, 79.5 * u, bw - 6 * u, { size: 4, font: 'ui', weight: 650, color: s.c('teal') });
        });
      });
  },
};

// ---------------------------------------------------------------- biases

const LA = [1, 1, -1, -1];
const LL = [3, 10, 2, 11];

function miniGroup(s: Scene, rows: typeof ALL_RIGHT, x: number, y: number, w: number, title: string): void {
  const u = s.u;
  fitText(s, title, x + w / 2, y, w - 2 * u, { size: 3.6, font: 'ui', weight: 650 });
  rows.forEach((ro, i) => {
    const ry = y + 4.5 * u + i * 6.8 * u;
    badge(s, x + 2.5 * u, ry + 2.8 * u, 1.9 * u, ro.reward === 1);
    chips(s, ro, x + 5.5 * u, ry, 4.4 * u, 5.6 * u, { tint: 0, size: 3.2 });
    s.text('0.00', x + w - u, ry + 2.8 * u, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('--ink-3') });
  });
}

const biases: SceneDef = {
  draw(s) {
    const { w, u } = s;
    s.alpha(s.win('edges', 'zero'), () => {
      const items: [string, K][] = [['no-signal groups', 'slate'], ['length bias', 'purple'], ['difficulty bias', 'gold'], ['entropy collapse', 'red']];
      const cw = (w - 13 * u) / 2;
      items.forEach(([t, k], i) => {
        const x = 5 * u + (i % 2) * (cw + 3 * u);
        const y = 24 * u + Math.floor(i / 2) * 24 * u;
        s.alpha(s.ease('edges', 0.5, 2 + 0.5 * i), () => card(s, x, y, cw, 18 * u, k, `${i + 1}  ${t}`, '', { on: 0.5, size: 4.4 }));
      });
    });
    const zA = s.win('zero', 'len');
    if (zA > 0)
      s.alpha(zA, () => {
        const gw = (w - 13 * u) / 2;
        s.alpha(s.ease('zero', 0.5), () => miniGroup(s, ALL_RIGHT, 5 * u, 14 * u, gw, 'all right: 7 + 5'));
        s.alpha(s.ease('zero', 0.5, 1.5), () => miniGroup(s, ALL_WRONG, 8 * u + gw, 14 * u, gw, 'all wrong: 4371 + 2856'));
        s.alpha(s.win('worse', 'dyn'), () => {
          const fr = new Frame(s, 12 * u, 80 * u, w - 20 * u, 15 * u, [0, 399, 0, 0.55]);
          fr.box();
          const xs = HIST.zeroVar.map((_, i) => i);
          fr.path(xs, HIST.zeroVar, s.c('slate'), 0.6);
          fitText(s, 'share of no-signal groups over the toy run', w / 2, 76.5 * u, w - 10 * u, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        });
        s.alpha(s.ease('dyn', 0.6), () => {
          const n = 10;
          const sq = Math.min(6 * u, (w - 20 * u) / (n * 1.5));
          const x0 = w / 2 - (n * sq * 1.5) / 2;
          const drop = s.ease('dyn', 0.8, 2.5);
          for (let i = 0; i < n; i++) {
            const dead = i % 3 === 1;
            const x = x0 + i * sq * 1.5;
            const y = 84 * u + (dead ? drop * 6 * u : 0);
            s.alpha(dead ? 1 - drop : 1, () => s.rrect(x, y, sq, sq, 0.8, { fill: s.tint(dead ? 'slate' : 'teal', dead ? 0.35 : 0.7) }));
          }
          fitText(s, 'dynamic sampling: drop no-signal groups, refill', w / 2, 78 * u, w - 10 * u, { size: 3.6, font: 'ui', weight: 650, color: s.c('teal') });
        });
      });
    const lA = s.win('len', 'std');
    if (lA > 0)
      s.alpha(lA, () => {
        const dr = s.ease('drgrpo', 1.2, 2.5);
        const head = dr < 0.5 ? 'GRPO: per-token weight Â / |o|' : 'Dr. GRPO: per-token weight Â / 12';
        fitText(s, head, w / 2, 16 * u, w - 10 * u, { size: 4.2, font: 'ui', weight: 650, color: dr < 0.5 ? s.c('--ink') : s.c('teal') });
        const left = 11 * u;
        const right = 17 * u;
        const cw = (w - left - right) / 12;
        const beat = current(s, ['len', 'right', 'wrong', 'drgrpo']);
        for (let i = 0; i < 4; i++) {
          const y = 24 * u + i * 13 * u;
          const wv = lerp(LA[i]! / LL[i]!, LA[i]! / 12, dr);
          const focus = beat === 'right' ? i < 2 : beat === 'wrong' ? i >= 2 : true;
          s.alpha(focus ? 1 : 0.3, () => {
            badge(s, 6 * u, y + 4 * u, 2.2 * u, LA[i]! > 0);
            const a = Math.min(1, Math.abs(wv) / 0.5);
            for (let t = 0; t < 12; t++) {
              const x = left + t * cw;
              if (t < LL[i]!) s.rrect(x + 0.2 * u, y, cw - 0.4 * u, 8 * u, 0.8, { fill: s.tint(advK(LA[i]!), 0.1 + 0.8 * a), stroke: s.tint(advK(LA[i]!), 0.9), lw: 0.2 });
              else s.rrect(x + 0.2 * u, y, cw - 0.4 * u, 8 * u, 0.8, { stroke: s.tint('--ink-3', 0.3), lw: 0.15 });
            }
            s.text(sgn(wv, 3), w - 3 * u, y + 4 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c(advK(LA[i]!)) });
          });
        }
        const msg = beat === 'right' ? 'short and right: a bigger push per token' : beat === 'wrong' ? 'long and wrong: a smaller penalty per token' : beat === 'drgrpo' && dr > 0.5 ? 'one constant: length no longer matters' : '';
        if (msg) fitText(s, msg, w / 2, 82 * u, w - 10 * u, { size: 3.8, italic: true, color: s.c(beat === 'drgrpo' ? 'teal' : beat === 'wrong' ? 'red' : 'teal') });
      });
    const dA = s.ease('std', 0.6);
    if (dA > 0)
      s.alpha(dA, () => {
        const fr = new Frame(s, 10 * u, 22 * u, w - 16 * u, 58 * u, [0, 1, 0, 1.4]);
        fr.box();
        fr.hline(0, s.c('--axis'), 0.3);
        const fs = (p: number) => Math.sqrt(p * (1 - p)) / 0.5;
        const fr2 = (p: number) => (p * (1 - p)) / 0.25;
        const drop = s.ease('drfix', 0.8, 1.5);
        s.alpha(1 - 0.75 * drop, () => fr.fn(fs, s.c('teal'), 0.7, 0, 1));
        s.alpha(s.ease('weight', 0.6, 2), () => fr.fn(fr2, s.c('slate'), 0.7, 0, 1, [1.2, 0.9]));
        s.text('pull of one question vs its pass rate', w / 2, 15 * u, { size: fit(s, 'pull of one question vs its pass rate', w - 10 * u, 4, { font: 'ui', weight: 650 }), font: 'ui', weight: 650 });
        s.text('0', fr.X(0), fr.Y(0) + 3 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('1/2', fr.X(0.5), fr.Y(0) + 3 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('1', fr.X(1), fr.Y(0) + 3 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('÷ std (GRPO)', fr.x + 2 * u, fr.y + 4 * u, { size: 3.4, font: 'ui', weight: 650, align: 'left', color: s.c('teal') });
        s.alpha(s.ease('weight', 0.6, 2), () => s.text('no ÷ std (Dr. GRPO)', fr.x + 2 * u, fr.y + 9 * u, { size: 3.4, font: 'ui', weight: 650, align: 'left', color: s.c('slate') }));
        s.alpha(s.ease('weight', 0.6), () => {
          const p = 7 / 8;
          fr.vline(p, s.tint('--ink-3', 0.5), 0.2, [0.8, 0.8]);
          s.circle(fr.X(p), fr.Y(fs(p)), 1.4 * u, { fill: s.c('teal') });
          s.text('66%', fr.X(p) + 2.5 * u, fr.Y(fs(p)) - 2 * u, { size: 3.6, font: 'mono', weight: 700, align: 'left', color: s.c('teal'), halo: true });
          s.alpha(s.ease('weight', 0.6, 2), () => {
            s.circle(fr.X(p), fr.Y(fr2(p)), 1.4 * u, { fill: s.c('slate') });
            s.text('44%', fr.X(p) - 2.5 * u, fr.Y(fr2(p)) + 1 * u, { size: 3.6, font: 'mono', weight: 700, align: 'right', color: s.c('slate'), halo: true });
          });
          s.text('7 of 8', fr.X(p), fr.Y(0) - 3 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        });
        s.alpha(drop, () => fitText(s, 'drop the ÷ std: an honest policy gradient', w / 2, 88 * u, w - 10 * u, { size: 3.8, italic: true, color: s.c('slate') }));
      });
  },
};

// ---------------------------------------------------------------- entropy

const entropy: SceneDef = {
  draw(s) {
    const { w, u } = s;
    s.alpha(s.win('entropy', 'same'), () => {
      const fr = new Frame(s, 12 * u, 22 * u, w - 20 * u, 50 * u, [0, 399, 0.3, 1]);
      fr.box();
      const n = Math.max(1, Math.round(399 * s.ease('entropy', 3, 3)));
      const xs = Array.from({ length: n + 1 }, (_, i) => i);
      fr.path(xs, xs.map((i) => HIST.entropy[i]!), s.c('red'), 0.7);
      fitText(s, 'policy entropy during the toy run (nats)', w / 2, 16 * u, w - 10 * u, { size: 3.8, font: 'ui', weight: 650 });
      s.text(HIST.entropy[0]!.toFixed(2), fr.x + 2 * u, fr.Y(HIST.entropy[0]!) - 3 * u, { size: 3.4, font: 'mono', align: 'left', color: s.c('red') });
      s.alpha(n > 390 ? 1 : 0, () => s.text(HIST.entropy[399]!.toFixed(2), fr.X(399) - 2 * u, fr.Y(HIST.entropy[399]!) - 3 * u, { size: 3.4, font: 'mono', align: 'right', color: s.c('red') }));
      s.text('step', fr.X(399), fr.y + fr.h + 3 * u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
    s.alpha(s.win('same', 'blame'), () => {
      const gw = Math.min(64 * u, w - 10 * u);
      miniGroup(s, ALL_RIGHT, (w - gw) / 2, 16 * u, gw, 'a confident policy: eight near-copies');
      fitText(s, 'same rewards, Â = 0: nothing to learn', w / 2, 82 * u, w - 10 * u, { size: 3.8, italic: true, color: s.c('red') });
    });
    const hA = s.win('blame', 'dapo');
    if (hA > 0)
      s.alpha(hA, () => {
        const fr = new Frame(s, 12 * u, 20 * u, w - 18 * u, 60 * u, [-3, 0, -0.25, 0.33]);
        fr.box();
        fr.hline(0, s.c('--axis'), 0.3);
        for (const e of [-3, -2, -1, 0]) s.text(e === 0 ? '1' : `0.${'0'.repeat(-e - 1)}1`, fr.X(e), fr.y + fr.h + 3 * u, { size: 3, font: 'mono', align: e === -3 ? 'left' : e === 0 ? 'right' : 'center', color: s.c('--ink-3') });
        const hi = lerp(0.2, 0.28, s.ease('higher', 1.4, 1));
        const up = (lp: number, e: number) => Math.min(1, 10 ** lp * (1 + e)) - 10 ** lp;
        s.alpha(s.ease('blame', 0.6, 0.5), () => {
          fr.fn((lp) => up(lp, 0.2), s.c('slate'), 0.5, -3, 0, [1.2, 0.9]);
          fr.fn((lp) => -0.2 * 10 ** lp, s.c('red'), 0.6, -3, 0);
          s.text('can add', fr.x + 2 * u, fr.Y(0.25), { size: 3.4, font: 'ui', weight: 650, align: 'left', color: s.since('higher') >= 0 ? s.c('teal') : s.c('slate') });
          s.text('can remove', fr.x + 2 * u, fr.Y(-0.17), { size: 3.4, font: 'ui', weight: 650, align: 'left', color: s.c('red') });
        });
        s.alpha(s.ease('higher', 0.6), () => {
          fr.fn((lp) => up(lp, hi), s.c('teal'), 0.75, -3, 0);
          s.text(`ε_high = ${hi.toFixed(2)}`, fr.X(-2.2), fr.Y(0.14), { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('teal') });
        });
        fitText(s, 'probability one batch can move a token, by its old probability', w / 2, 15 * u, w - 8 * u, { size: 3.6, font: 'ui', weight: 650 });
        const mark = (p: number, beat: string, label: string, lx: number, ly: number) =>
          s.alpha(s.ease(beat, 0.6), () => {
            const lp = Math.log10(p);
            const yv = up(lp, 0.2);
            s.line(fr.X(lp), fr.Y(yv), fr.X(lx), fr.Y(ly) + 2 * u, s.tint('orange', 0.6), 0.25);
            s.circle(fr.X(lp), fr.Y(yv), 1.4 * u, { fill: s.c('orange') });
            s.text(label, fr.X(lx), fr.Y(ly), { size: 3.6, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
          });
        mark(0.9, 'likely', '0.9 → 1.0', -0.6, 0.27);
        mark(0.01, 'rare', '0.01 → 0.012', -2, 0.07);
      });
    const dA = s.ease('dapo', 0.6);
    if (dA > 0)
      s.alpha(dA, () => {
        const items: [string, string][] = [['clip-higher', 'ε_high = 0.28'], ['dynamic sampling', 'drop no-signal groups'], ['token-level loss', 'average over all tokens'], ['overlong shaping', 'answers cut off at the limit']];
        const cw = (w - 13 * u) / 2;
        items.forEach(([t, sub], i) => {
          const x = 5 * u + (i % 2) * (cw + 3 * u);
          const y = 14 * u + Math.floor(i / 2) * 20 * u;
          s.alpha(s.ease('dapo', 0.5, 0.5 + 1.6 * i), () => card(s, x, y, cw, 16 * u, 'teal', t, sub, { on: 0.6, size: 4 }));
        });
        s.alpha(s.ease('nokl', 0.6), () => pill(s, 'and no KL penalty', w / 2, 60 * u, 'red', { size: 4 }));
        s.alpha(s.ease('result', 0.6), () => {
          fitText(s, '≈ 50 on AIME 2024 from a 32B base,', w / 2, 74 * u, w - 10 * u, { size: 4, font: 'ui', weight: 650 });
          fitText(s, 'in half the steps (DAPO paper, 2025)', w / 2, 81 * u, w - 10 * u, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
        });
      });
  },
};

// ---------------------------------------------------------------- outro

const SUMMARY: [string, string, string, K][] = [
  ['rlvr', 'RLVR', 'a program checks the answer', 'gold'],
  ['grpo', 'GRPO', 'group mean as the baseline, no critic', 'teal'],
  ['mem', 'memory', 'about half of PPO', 'blue'],
  ['r1', 'R1', 'long reasoning emerges; distill it', 'purple'],
  ['fail', 'watch for', 'no signal, length and difficulty bias, collapse', 'red'],
];

const outro: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const out = s.ease('next', 0.7);
    s.alpha(1 - out, () => {
      const bh = 13 * u;
      const gap = 3 * u;
      const bw = Math.min(120 * u, w - 10 * u);
      const bx = (w - bw) / 2;
      const beat = current(s, SUMMARY.map((x) => x[0]));
      SUMMARY.forEach(([id, t, sub, k], i) => {
        const y = 15 * u + i * (bh + gap);
        s.alpha(s.ease(id, 0.5), () => {
          const on = beat === id ? 1 : 0.25;
          s.rrect(bx, y, bw, bh, 2, { fill: s.tint(k, 0.05 + 0.13 * on), stroke: s.tint(k, 0.35 + 0.6 * on), lw: 0.3 });
          s.text(t, bx + 4 * u, y + bh / 2, { size: 4.2, font: 'ui', weight: 700, align: 'left', color: s.c(k) });
          fitText(s, sub, bx + 26 * u, y + bh / 2, bw - 30 * u, { size: 3.8, font: 'ui', align: 'left' });
        });
      });
    });
    s.alpha(out, () => {
      fitText(s, 'next: reasoning at test time', w / 2, 40 * u, w - 10 * u, { size: 6.4, font: 'display', weight: 600 });
      fitText(s, 'think longer, sample more, verify', w / 2, 52 * u, w - 10 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  verifier,
  gaming,
  ppo,
  group,
  objective,
  memory,
  toy,
  r1zero,
  r1,
  biases,
  entropy,
  outro,
};

