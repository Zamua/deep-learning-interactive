import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after, cite, verdict } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { Frame } from '../../networks/draw';
import { note } from '../draw';

const QUESTION = 'When does the library open on Sundays?';
const Q = [0.6, 0.8];
const PASSAGES: { text: string; short: string; v: number[]; score: number }[] = [
  { text: 'Sunday hours: noon to 5 pm.', short: 'Sunday hours', v: [0.8, 0.6], score: 0.96 },
  { text: 'Weekday hours: 9 am to 8 pm.', short: 'weekday hours', v: [1, 0], score: 0.6 },
  { text: 'Parking is free after 6 pm.', short: 'parking', v: [0.8, -0.6], score: 0 },
];
const vt = (v: number[]) => `[${v.map((x) => String(x).replace('-', '−')).join(', ')}]`;

/** A line of text in a soft box, left-aligned at x, `w` px wide. */
function line(s: Scene, x: number, y: number, w: number, text: string, k: Ink, o: { on?: number; size?: number } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y - 3.4 * s.u, w, 6.8 * s.u, 1.2, { fill: s.tint(k, 0.1 + 0.18 * on), stroke: s.tint(k, 0.45 + 0.5 * on), lw: 0.3 });
  s.text(text, x + 2 * s.u, y + 0.2 * s.u, { size: o.size ?? 3, font: 'mono', weight: 600, align: 'left', color: s.c(k) });
}

/** A right-angle mark at the origin between directions a and b, `q` plane units long. */
function square(s: Scene, P: (x: number, y: number) => [number, number], a: number[], b: number[], q: number) {
  const ua = a.map((v) => (v / Math.hypot(...a)) * q);
  const ub = b.map((v) => (v / Math.hypot(...b)) * q);
  s.line(...P(ua[0]!, ua[1]!), ...P(ua[0]! + ub[0]!, ua[1]! + ub[1]!), s.c('--ink-2'), 0.3);
  s.line(...P(ub[0]!, ub[1]!), ...P(ua[0]! + ub[0]!, ua[1]! + ub[1]!), s.c('--ink-2'), 0.3);
}

/** An arc of the circle of radius `r` around the origin, from angle a0 to a1 (radians). */
function arc(s: Scene, ox: number, oy: number, r: number, a0: number, a1: number, k: Ink, a: number, dash = true) {
  s.alpha(a, () => {
    const c = s.ctx;
    c.beginPath();
    c.arc(ox, oy, r, -a1, -a0);
    c.strokeStyle = s.tint(k, 0.7);
    c.lineWidth = 0.3 * s.u;
    c.setLineDash(dash ? [s.u, s.u] : []);
    c.stroke();
    c.setLineDash([]);
  });
}

const stale: SceneDef = {
  draw(s) {
    const u = s.u;
    const w = Math.min(s.w - 12 * u, 96 * u);
    const x = s.w / 2 - w / 2;
    line(s, x, s.h * 0.1, w, QUESTION, 'orange');
    s.alpha(s.ease('ask', 0.6, 2), () => {
      s.text('the model alone:', x, s.h * 0.24, { size: 3, align: 'left', color: s.c('--ink-3') });
      s.text('At 10 am.', x + 30 * u, s.h * 0.24, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
      verdict(s, false, 'out of date', x + 54 * u, s.h * 0.24, 3.2);
    });
    const ctx = after(s, 'context', 0.3);
    s.alpha(ctx, () => {
      s.text('with the facts in the prompt:', x, s.h * 0.37, { size: 3, align: 'left', color: s.c('--ink-3') });
      line(s, x, s.h * 0.46, w, PASSAGES[0]!.text, 'blue');
      line(s, x, s.h * 0.55, w, `Q: ${QUESTION}`, 'orange');
      s.alpha(after(s, 'context', 0.72), () => {
        s.text('A: At noon.', x + 2 * u, s.h * 0.64, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
        verdict(s, true, 'no weight changed', x + 30 * u, s.h * 0.64, 3.2);
      });
    });
    s.alpha(s.ease('which', 0.6), () => {
      const cols = 22;
      const pitch = (w - 2 * u) / cols;
      const y0 = s.h * 0.75;
      const pick = new Set([5, 30, 51]);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const on = pick.has(i) ? after(s, 'which', 0.68) : 0;
          s.rrect(x + 1 * u + c * pitch, y0 + r * 4.4 * u, pitch - 0.8 * u, 3.4 * u, 0.5, { fill: s.tint(on > 0.5 ? 'gold' : 'blue', 0.15 + 0.4 * on), stroke: s.tint(on > 0.5 ? 'gold' : 'blue', 0.4 + 0.5 * on), lw: 0.2 });
        }
      }
      note(s, 'thousands of passages: retrieval fetches a few', s.w / 2, y0 + 17 * u, '--ink-2', 3);
    });
  },
};

// ---- texts as arrows: the question and three passages, then why each is scaled to length 1

const XR: [number, number] = [-0.35, 2.2];
const YR: [number, number] = [-0.8, 1.12];

const arrows: SceneDef = {
  draw(s) {
    const u = s.u;
    const ratio = (XR[1] - XR[0]) / (YR[1] - YR[0]);
    const ww = Math.min(s.w - 16 * u, s.h * 0.64 * ratio);
    const l = s.w / 2 - ww / 2;
    const F = new Frame(s, l, 5 * u, l + ww, 5 * u + ww / ratio, XR, YR);
    const P = (x: number, y: number): [number, number] => [F.X(x), F.Y(y)];
    const R = F.X(1) - F.X(0);
    F.axes();

    // The circle of length 1, drawn in once lengths are fixed.
    const circ = after(s, 'unit', 0.2, 1.2);
    arc(s, F.X(0), F.Y(0), R, -0.9, -0.9 + 2.1 * circ, '--ink-3', 1);

    // Passage 1 stretches to twice its length, then shrinks back onto the circle.
    const stretch = after(s, 'long', 0.38, 1) * (1 - after(s, 'unit', 0.25, 1));
    const dimForSize = 1 - 0.7 * s.win('size', 'cos');
    const tag = { size: 3, font: 'mono', weight: 600, halo: true } as const;
    const tagAt: [number, number][] = [[0.9, 0.6], [1.05, -0.14], [0.9, -0.62]];
    PASSAGES.forEach((p, i) => {
      const a = s.ease('embed', 0.6, 1.6 + 0.5 * i);
      const len = i === 1 ? 1 + stretch : 1;
      const on = i === 1 ? s.win('long', 'unit') : 0;
      s.alpha(a * dimForSize, () => {
        s.arrow(...P(0, 0), ...P(p.v[0]! * len, p.v[1]! * len), s.tint('blue', 0.6 + 0.4 * on), 0.6 + 0.2 * on, 2.6);
        s.text(`${i} · ${p.short}`, ...P(...tagAt[i]!), { ...tag, align: 'left', color: s.c('blue') });
      });
    });
    s.alpha(s.ease('embed', 0.6, 1), () => {
      s.arrow(...P(0, 0), ...P(Q[0]!, Q[1]!), s.c('orange'), 0.75, 3);
      s.text('question', ...P(0.2, 1.0), { ...tag, size: 3.2, color: s.c('orange') });
    });

    // Pythagoras under the question's arrow.
    s.alpha(s.win('size', 'cos'), () => {
      F.seg(0, 0, Q[0]!, 0, 'orange', 0.35, [1, 0.8]);
      F.seg(Q[0]!, 0, Q[0]!, Q[1]!, 'orange', 0.35, [1, 0.8]);
      const n = { size: 3, font: 'mono', weight: 650, color: s.c('orange'), halo: true } as const;
      s.text('0.6', ...P(0.3, -0.09), n);
      s.text('0.8', ...P(0.72, 0.3), n);
      s.text('1', ...P(0.22, 0.5), n);
    });

    // The angle between the question and passage 0, and the right angle to passage 2.
    s.alpha(s.ease('cos', 0.6, 0.8), () => {
      const t0 = Math.atan2(PASSAGES[0]!.v[1]!, PASSAGES[0]!.v[0]!);
      const t1 = Math.atan2(Q[1]!, Q[0]!);
      arc(s, F.X(0), F.Y(0), R * 0.32, t0, t1, 'teal', 1, false);
      square(s, P, Q, PASSAGES[2]!.v, 0.14);
    });

    // Captions under the plane.
    const cx = s.w / 2;
    const y0 = F.b + 6 * u;
    const cap = (text: string, y: number, k: Ink = '--ink-2', size = 3.4) => s.text(text, cx, y, { size, font: 'mono', color: s.c(k), halo: true });
    s.alpha(s.win('embed', 'ahead') * after(s, 'embed', 0.55), () => cap('same subject, same direction', y0));
    s.alpha(s.win('ahead', 'dot'), () => cap('every passage embedded once, ahead of time', y0, '--ink-2', 3.1));
    s.alpha(s.win('dot', 'long'), () => cap('score = how much two arrows agree', y0));
    s.alpha(s.win('long', 'unit') * after(s, 'long', 0.5), () => cap('twice as long: twice the score', y0, 'red'));
    s.alpha(s.win('unit', 'size') * after(s, 'unit', 0.3), () => cap('every arrow scaled to length 1', y0));
    s.alpha(s.win('size', 'cos'), () => rich(s, [['0.6² + 0.8² = 0.36 + 0.64 = ', '--ink-2'], ['1', 'orange']], cx, y0, { size: 3.4, weight: 600 }));
    s.alpha(s.ease('cos', 0.6), () => cap('length 1: dot product = cos(angle)', y0));
    s.alpha(after(s, 'cos', 0.4), () => cap('same way: 1 · right angle: 0', y0 + 6.5 * u, '--ink-2', 3.2));
    s.alpha(after(s, 'cos', 0.8), () => cap('cosine similarity', y0 + 13 * u, 'teal', 3.6));
  },
};

// ---- the scores: each passage dotted with the question, and the top k kept

const score: SceneDef = {
  draw(s) {
    const u = s.u;
    const k = 24 * u;
    const ox = s.w / 2 - 32 * u;
    const oy = s.h * 0.32;
    const P = (x: number, y: number): [number, number] => [ox + x * k, oy - y * k];
    s.line(...P(-0.15, 0), ...P(1.25, 0), s.c('--axis'), 0.3);
    s.line(...P(0, -0.75), ...P(0, 1.0), s.c('--axis'), 0.3);
    arc(s, ox, oy, k, -0.9, 1.2, '--ink-3', 1);
    const tip = (v: number[], d: number) => P(v[0]! * (1 + d), v[1]! * (1 + d));
    const lit = [s.win('p0', 'rest'), s.win('rest', 'top'), s.win('rest', 'top')];
    PASSAGES.forEach((p, i) => {
      s.arrow(...P(0, 0), ...P(p.v[0]!, p.v[1]!), s.tint('blue', 0.55 + 0.45 * lit[i]!), 0.55 + 0.2 * lit[i]!, 2.6);
      s.text(String(i), ...tip(p.v, 0.16), { size: 3.2, font: 'mono', weight: 650, color: s.c('blue'), halo: true });
    });
    s.arrow(...P(0, 0), ...P(Q[0]!, Q[1]!), s.c('orange'), 0.7, 3);
    s.text('question', ...tip(Q, 0.3), { size: 3, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
    s.alpha(after(s, 'rest', 0.75), () => square(s, P, Q, PASSAGES[2]!.v, 0.12));

    // Beside the plane: the question's vector, then passage 0's score worked out.
    const sx = ox + 1.45 * k;
    const sy = oy - 0.62 * k;
    const o = { size: 3, weight: 600, align: 'left' as const };
    rich(s, [['question ', '--ink-3'], [vt(Q), 'orange']], sx, sy, o);
    s.alpha(s.ease('p0', 0.6, 1), () => rich(s, [['passage 0 ', '--ink-3'], [vt(PASSAGES[0]!.v), 'blue']], sx, sy + 6 * u, o));
    s.alpha(s.ease('score', 0.6, 0.3), () => rich(s, [['0.6×0.8 + 0.8×0.6', '--ink-2']], sx, sy + 13 * u, o));
    s.alpha(after(s, 'score', 0.55), () => rich(s, [['= 0.48 + 0.48 = ', '--ink-2'], ['0.96', 'teal']], sx, sy + 19 * u, o));

    // The passages, their vectors and their scores.
    const tw = Math.min(s.w - 10 * u, 100 * u);
    const tx = s.w / 2 - tw / 2;
    const y0 = s.h * 0.62;
    const pitch = 9 * u;
    s.text('score', tx + tw - 2 * u, y0 - pitch * 0.85, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    PASSAGES.forEach((p, i) => {
      const y = y0 + i * pitch;
      const top = after(s, 'top', 0.55) * (i < 2 ? 1 : 0);
      line(s, tx, y, tw, `${i}  ${p.text}`, 'blue', { on: Math.max(top, i === 0 ? s.win('p0', 'rest') : 0), size: 2.9 });
      s.text(vt(p.v), tx + tw - 13 * u, y + 0.2 * u, { size: 2.8, font: 'mono', weight: 600, align: 'right', color: s.c('--ink-2') });
      const a = i === 0 ? after(s, 'score', 0.8) : after(s, 'rest', i === 1 ? 0.35 : 0.85);
      s.alpha(a, () => s.text(String(p.score), tx + tw - 2 * u, y + 0.2 * u, { size: 3.2, font: 'mono', weight: 700, align: 'right', color: s.c(i === 2 ? '--ink-3' : 'teal') }));
    });
    s.alpha(after(s, 'top', 0.55), () => note(s, 'k = 2: passages 0 and 1 go into the prompt', s.w / 2, y0 + 3 * pitch, 'gold', 3));
  },
};

// ---- into the prompt: the answer, a swapped page, and the room the passages take

const prompt: SceneDef = {
  draw(s) {
    const u = s.u;
    const w = Math.min(s.w - 12 * u, 96 * u);
    const x = s.w / 2 - w / 2;
    const pitch = 8.6 * u;
    const y0 = s.h * 0.14;
    const rows: [string, Ink, number][] = [
      [PASSAGES[0]!.text, 'blue', s.ease('build', 0.6)],
      [PASSAGES[1]!.text, 'blue', s.ease('build', 0.6, 0.5)],
      [`Q: ${QUESTION}`, 'orange', 1],
    ];
    const swap = after(s, 'update', 0.4, 0.8);
    rows.forEach(([t, k, a], i) => {
      const y = lerp(y0 + 2 * pitch, y0 + i * pitch, i === 2 ? s.ease('build', 0.8) : 1);
      s.alpha(a, () => line(s, x, y, w, i === 0 && swap > 0.5 ? 'Sunday hours: 11 am to 5 pm.' : t, k, { on: i === 0 ? s.win('update', 'rag') : 0 }));
    });
    const gone = 1 - s.ease('update', 0.5, 1);
    s.alpha(s.ease('build', 0.6, 1.2) * gone, () => s.text('A:', x + 2 * u, y0 + 3 * pitch, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('gold') }));
    s.alpha(after(s, 'answer', 0.55) * gone, () => {
      s.text('At noon.', x + 9 * u, y0 + 3 * pitch, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
      verdict(s, true, 'read from the context', x + 32 * u, y0 + 3 * pitch, 3);
    });
    s.alpha(after(s, 'answer', 0.8) * gone, () => note(s, 'the weights are exactly as they were', s.w / 2, y0 + 4.4 * pitch, '--ink-2', 3));
    s.alpha(s.win('update', 'rag') * after(s, 'update', 0.3), () => {
      rich(s, [['new hours: ', '--ink-3'], ['embed the new page', 'blue'], [', swap it in', '--ink-3']], s.w / 2, y0 + 4.4 * pitch, { size: 3, weight: 600 });
      note(s, 'no model is retrained', s.w / 2, y0 + 5.4 * pitch, 'green', 3);
    });

    // Lewis and colleagues: the name, then the swap they tried.
    cite(s, 'Patrick Lewis et al., 2020', s.win('rag', 'cost'));
    s.alpha(s.win('rag', 'cost'), () => rich(s, [['retrieval', 'blue'], ['-augmented ', '--ink-2'], ['generation', 'gold']], s.w / 2, y0 + 4.4 * pitch, { size: 3.4, weight: 650 }));
    s.alpha(s.win('swap', 'cost'), () => {
      const cy = y0 + 5.8 * pitch;
      const cw = 30 * u;
      const old = 1 - after(s, 'swap', 0.25, 0.8);
      s.alpha(0.35 + 0.65 * old, () => line(s, s.w / 2 - cw - 3 * u, cy, cw, 'Wikipedia, 2016', 'blue', { size: 2.9 }));
      s.text('→', s.w / 2, cy, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
      s.alpha(after(s, 'swap', 0.25, 0.8), () => line(s, s.w / 2 + 3 * u, cy, cw, 'Wikipedia, 2018', 'blue', { size: 2.9, on: 1 }));
      s.alpha(after(s, 'swap', 0.6), () => note(s, 'same model, new pages: mostly the new leaders', s.w / 2, cy + 7 * u, '--ink-2', 2.9));
    });

    // The room in the context: two passages and the question, then as many as 1,024 tokens hold.
    const by = s.h * 0.66;
    const fit = s.ease('fit', 0.8, 1.5);
    s.alpha(s.ease('cost', 0.6) * (1 - fit), () => {
      const segs: [number, Ink, string][] = [[200, 'blue', '200'], [200, 'blue', '200'], [10, 'orange', '10']];
      const scale = (w - 2 * u) / 410;
      let cx = x + u;
      segs.forEach(([n, k, lab], i) => {
        const sw = n * scale;
        s.rrect(cx, by - 3 * u, sw - 0.6 * u, 6 * u, 0.8, { fill: s.tint(k, 0.3), stroke: s.tint(k, 0.8), lw: 0.3 });
        s.text(lab, i === 2 ? cx + sw + 1.2 * u : cx + sw / 2, by + 0.2 * u, { size: 3, font: 'mono', weight: 650, align: i === 2 ? 'left' : 'center', color: s.c(i === 2 ? 'orange' : '--ink') });
        cx += sw;
      });
      rich(s, [['2 × 200 + 10 = ', '--ink-2'], ['410 tokens', '--ink']], s.w / 2, by + 8 * u, { size: 3.4, weight: 650 });
    });
    s.alpha(fit, () => {
      // The box is 1,024 tokens wide; the sixth passage hangs past its end.
      const scale = (w * 0.82) / 1024;
      const bx = x;
      s.rrect(bx, by - 4.2 * u, 1024 * scale, 8.4 * u, 1, { stroke: s.c('--ink-2'), lw: 0.4 });
      s.text('1,024', bx + 1024 * scale, by - 6.5 * u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
      let cx = bx + u * 0.6;
      for (let i = 0; i < 6; i++) {
        const sw = 200 * scale;
        const spill = i === 5;
        s.alpha(spill ? after(s, 'fit', 0.75) : after(s, 'fit', 0.45 + i * 0.05), () => {
          s.rrect(cx, by - 3 * u, sw - 0.6 * u, 6 * u, 0.8, { fill: s.tint(spill ? 'red' : 'blue', spill ? 0.12 : 0.3), stroke: s.tint(spill ? 'red' : 'blue', 0.8), lw: 0.3 });
          s.text(spill ? '✗' : '200', cx + sw / 2, by + 0.2 * u, { size: 2.8, font: 'mono', weight: 650, color: s.c(spill ? 'red' : '--ink') });
        });
        if (i === 4) {
          // The question sits after the fifth passage.
          s.rrect(cx + sw, by - 3 * u, 10 * scale + 0.6 * u, 6 * u, 0.4, { fill: s.tint('orange', 0.6), stroke: s.tint('orange', 0.9), lw: 0.2 });
          cx += 10 * scale;
        }
        cx += sw;
      }
      rich(s, [['1,024 − 10 = 1,014: ', '--ink-2'], ['5 passages fit', '--ink']], s.w / 2, by + 8 * u, { size: 3.4, weight: 650 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { stale, arrows, score, prompt };
