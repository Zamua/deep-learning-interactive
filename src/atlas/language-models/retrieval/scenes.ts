import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { verdict } from '../../draw';
import { note, rich, type Ink } from '../draw';

const QUESTION = 'When does the library open on Sundays?';
const Q = [0.6, 0.8];
const PASSAGES: { text: string; v: number[]; score: number }[] = [
  { text: 'Sunday hours: noon to 5 pm.', v: [0.8, 0.6], score: 0.96 },
  { text: 'Weekday hours: 9 am to 8 pm.', v: [1, 0], score: 0.6 },
  { text: 'Parking is free after 6 pm.', v: [0.8, -0.6], score: 0 },
];
const vt = (v: number[]) => `[${v.map((x) => String(x).replace('-', '−')).join(', ')}]`;

/** A line of text in a soft box, left-aligned at x, `w` px wide. */
function line(s: Scene, x: number, y: number, w: number, text: string, k: Ink, o: { on?: number; size?: number } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y - 3.4 * s.u, w, 6.8 * s.u, 1.2, { fill: s.tint(k, 0.1 + 0.18 * on), stroke: s.tint(k, 0.45 + 0.5 * on), lw: 0.3 });
  s.text(text, x + 2 * s.u, y + 0.2 * s.u, { size: o.size ?? 3, font: 'mono', weight: 600, align: 'left', color: s.c(k) });
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
    const ctx = s.ease('context', 0.6);
    s.alpha(ctx, () => {
      s.text('with the facts in the prompt:', x, s.h * 0.37, { size: 3, align: 'left', color: s.c('--ink-3') });
      line(s, x, s.h * 0.46, w, PASSAGES[0]!.text, 'blue');
      line(s, x, s.h * 0.55, w, `Q: ${QUESTION}`, 'orange');
      s.alpha(s.ease('context', 0.6, 1.8), () => {
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
          const on = pick.has(i) ? s.ease('which', 0.6, 2.5) : 0;
          s.rrect(x + 1 * u + c * pitch, y0 + r * 4.4 * u, pitch - 0.8 * u, 3.4 * u, 0.5, { fill: s.tint(on > 0.5 ? 'gold' : 'blue', 0.15 + 0.4 * on), stroke: s.tint(on > 0.5 ? 'gold' : 'blue', 0.4 + 0.5 * on), lw: 0.2 });
        }
      }
      note(s, 'thousands of passages: retrieval picks a few', s.w / 2, y0 + 17 * u, '--ink-2', 3);
    });
  },
};

const score: SceneDef = {
  draw(s) {
    const u = s.u;
    // The plane: a quarter-and-a-bit of the unit circle, the question and the three passages.
    const k = 24 * u;
    const ox = s.w / 2 - 32 * u;
    const oy = s.h * 0.32;
    const P = (x: number, y: number): [number, number] => [ox + x * k, oy - y * k];
    s.line(...P(-0.15, 0), ...P(1.25, 0), s.c('--axis'), 0.3);
    s.line(...P(0, -0.75), ...P(0, 1.0), s.c('--axis'), 0.3);
    const circ = s.ease('size', 1.2);
    s.alpha(circ, () => {
      const c = s.ctx;
      c.beginPath();
      c.arc(ox, oy, k, -Math.PI / 2 * circ, (Math.PI / 4) * circ);
      c.strokeStyle = s.tint('--ink-3', 0.6);
      c.lineWidth = 0.3 * u;
      c.setLineDash([u, u]);
      c.stroke();
      c.setLineDash([]);
    });
    const tip = (v: number[], d: number) => P(v[0]! * (1 + d), v[1]! * (1 + d));
    const sc = s.ease('score', 0.6);
    const rest = s.ease('rest', 0.6);
    s.alpha(s.ease('embed', 0.6), () => {
      PASSAGES.forEach((p, i) => {
        const on = i === 0 ? s.win('score', 'rest') : i > 0 ? s.win('rest', 'top') : 0;
        s.arrow(...P(0, 0), ...P(p.v[0]!, p.v[1]!), s.tint('blue', 0.55 + 0.45 * on), 0.55 + 0.2 * on, 2.6);
        s.text(String(i), ...tip(p.v, 0.16), { size: 3.2, font: 'mono', weight: 650, color: s.c('blue'), halo: true });
      });
      s.arrow(...P(0, 0), ...P(Q[0]!, Q[1]!), s.c('orange'), 0.7, 3);
      s.text('question', ...tip(Q, 0.3), { size: 3, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
    });
    // Right angle between the question and passage 2.
    s.alpha(rest * s.ease('rest', 0.5, 1.5), () => {
      const a = 0.12;
      const u1 = [Q[0]! * a, Q[1]! * a];
      const u2 = [0.8 * a, -0.6 * a];
      s.line(...P(u1[0]!, u1[1]!), ...P(u1[0]! + u2[0]!, u1[1]! + u2[1]!), s.c('--ink-2'), 0.3);
      s.line(...P(u2[0]!, u2[1]!), ...P(u1[0]! + u2[0]!, u1[1]! + u2[1]!), s.c('--ink-2'), 0.3);
    });
    // Beside the plane: what size one means.
    const sx = ox + 1.45 * k;
    s.alpha(s.ease('size', 0.6, 0.6), () => {
      const o = { size: 3, weight: 600, align: 'left' as const };
      rich(s, [['0.6² + 0.8² = 1', 'orange']], sx, oy - 0.62 * k, o);
      rich(s, [['same way: 1', '--ink-2']], sx, oy - 0.62 * k + 6 * u, o);
      rich(s, [['right angle: 0', '--ink-2']], sx, oy - 0.62 * k + 11 * u, o);
      s.alpha(s.ease('size', 0.6, 5), () => rich(s, [['cosine similarity', 'teal']], sx, oy - 0.62 * k + 17 * u, { ...o, size: 3.2 }));
    });
    // The passages, their vectors and their scores.
    const tw = Math.min(s.w - 10 * u, 100 * u);
    const tx = s.w / 2 - tw / 2;
    const y0 = s.h * 0.62;
    const pitch = 9 * u;
    s.alpha(s.ease('embed', 0.6, 1), () => {
      s.text('score', tx + tw - 2 * u, y0 - pitch * 0.85, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
      PASSAGES.forEach((p, i) => {
        const y = y0 + i * pitch;
        const top = s.ease('top', 0.6) * (i < 2 ? 1 : 0);
        line(s, tx, y, tw, `${i}  ${p.text}`, 'blue', { on: top, size: 2.9 });
        s.text(vt(p.v), tx + tw - 13 * u, y + 0.2 * u, { size: 2.8, font: 'mono', weight: 600, align: 'right', color: s.c('--ink-2') });
        const a = i === 0 ? sc : s.ease('rest', 0.6, i === 1 ? 0.3 : 2);
        s.alpha(a, () => s.text(String(p.score), tx + tw - 2 * u, y + 0.2 * u, { size: 3.2, font: 'mono', weight: 700, align: 'right', color: s.c(i === 2 ? '--ink-3' : 'teal') }));
      });
    });
    s.alpha(sc * (1 - rest), () => note(s, '0.6 × 0.8 + 0.8 × 0.6 = 0.48 + 0.48 = 0.96', s.w / 2, y0 + 3 * pitch, 'teal', 3));
    s.alpha(s.ease('top', 0.6, 0.6), () => note(s, 'k = 2: passages 0 and 1 go into the prompt', s.w / 2, y0 + 3 * pitch, 'gold', 3));
  },
};

const prompt: SceneDef = {
  draw(s) {
    const u = s.u;
    const w = Math.min(s.w - 12 * u, 96 * u);
    const x = s.w / 2 - w / 2;
    const pitch = 8.6 * u;
    const y0 = s.h * 0.1;
    const rows: [string, Ink, number][] = [
      [PASSAGES[0]!.text, 'blue', s.ease('build', 0.6)],
      [PASSAGES[1]!.text, 'blue', s.ease('build', 0.6, 0.5)],
      [`Q: ${QUESTION}`, 'orange', 1],
    ];
    const swap = s.ease('update', 0.8, 1.2);
    rows.forEach(([t, k, a], i) => {
      const y = lerp(y0 + 2 * pitch, y0 + i * pitch, i === 2 ? s.ease('build', 0.8) : 1);
      s.alpha(a, () => line(s, x, y, w, i === 0 && swap > 0.5 ? 'Sunday hours: 11 am to 5 pm.' : t, k, { on: i === 0 ? s.win('update', 'cost') : 0 }));
    });
    s.alpha(s.ease('build', 0.6, 1.2) * (1 - s.ease('update', 0.5, 0.6)), () => s.text('A:', x + 2 * u, y0 + 3 * pitch, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('gold') }));
    s.alpha(s.ease('answer', 0.6, 0.8) * (1 - s.ease('update', 0.5, 0.6)), () => {
      s.text('At noon.', x + 9 * u, y0 + 3 * pitch, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
      verdict(s, true, 'read from the context', x + 32 * u, y0 + 3 * pitch, 3);
    });
    s.alpha(s.ease('answer', 0.6, 3) * (1 - s.ease('update', 0.5)), () => note(s, 'the weights are exactly as they were', s.w / 2, y0 + 4.4 * pitch, '--ink-2', 3));
    s.alpha(s.win('update', 'cost'), () => {
      rich(s, [['new hours: ', '--ink-3'], ['embed the new page', 'blue'], [', swap it in', '--ink-3']], s.w / 2, y0 + 5.6 * pitch, { size: 3, weight: 600 });
      note(s, 'no model is retrained', s.w / 2, y0 + 6.6 * pitch, 'green', 3);
    });
    s.alpha(s.ease('cost', 0.6), () => {
      const by = s.h * 0.78;
      const segs: [number, Ink, string][] = [
        [200, 'blue', '200'],
        [200, 'blue', '200'],
        [10, 'orange', '10'],
      ];
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
  },
};

export const scenes: Record<string, SceneDef> = { stale, score, prompt };
