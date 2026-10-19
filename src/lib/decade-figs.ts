import type { Page } from '../core/page';
import { CHAPTERS } from '../chapters/index';
import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import type { Color } from '../core/symbols';
import { arrow, chip, chipWidth, fitHeight, line, measure, rbox, softmax, text } from './decade-draw';
import { MODELS } from './decade-models';
import { LANES, type Lane, MILESTONES, YEARS, YEAR_SUMMARY, laneOf } from './decade-timeline';

const chNum = (id: string): string => CHAPTERS.find((c) => c.id === id)?.num ?? '?';

/* ------------------------------------------------------------------ */
/* Fig: the timeline                                                   */
/* ------------------------------------------------------------------ */

const LANE_CODE: Record<Lane, string> = { attn: 'attention', scale: 'scale', see: 'images', post: 'feedback', serve: 'serving' };

function timelineCode(): string {
  const rows = MILESTONES.map((m, i) => {
    const lane = `'${LANE_CODE[m.lane]}',`.padEnd(12);
    const body = `    (${m.year}, ${lane} '${m.short}'),${m.now ? ' # today' : ''}`;
    return `${body.padEnd(46)}#@y${m.year},i${i}`;
  });
  return [
    `# (year, thread, milestone): ${MILESTONES.length} of them`,
    'decade = [',
    ...rows,
    ']',
    'year = {{year:2017}}',
    'for when, thread, name in decade:    #@loop',
    '    if when == year:                 #@loop',
    '        print(thread, name)          #@loop',
  ].join('\n');
}

export function figTimeline(p: Page): void {
  const laneIdx = (l: Lane) => LANES.findIndex((x) => x.id === l);
  const byYear = YEARS.map((y) =>
    MILESTONES.map((m, i) => ({ m, i }))
      .filter((o) => o.m.year === y)
      .sort((a, b) => laneIdx(a.m.lane) - laneIdx(b.m.lane)),
  );
  const maxStack = Math.max(...byYear.map((a) => a.length));

  p.figure({
    title: 'The decade, year by year',
    codeTitle: 'decade.py',
    layout: 'stack',
    code: timelineCode(),
    setup(f) {
      let sel = 0;
      let focus = -1;
      let cols: { x0: number; x1: number }[] = [];
      let colBand = [0, 0];
      let chips: { x: number; y: number; w: number; h: number; i: number }[] = [];
      const CH = 12;
      const CHH = 25;
      const PAD = 10;

      /** Rows of chips for year k at width avail. */
      const chipRows = (ctx: CanvasRenderingContext2D, k: number, avail: number) => {
        const rows: { i: number; w: number }[][] = [[]];
        let used = 0;
        for (const { m, i } of byYear[k]!) {
          const cw = chipWidth(ctx, m.short, CH);
          if (used > 0 && used + cw > avail) {
            rows.push([]);
            used = 0;
          }
          rows[rows.length - 1]!.push({ i, w: cw });
          used += cw + 7;
        }
        return rows;
      };

      const cv = f.canvas(720, 380, (ctx, w, h) => {
        // Legend: one chip per thread, wrapped.
        let lx = PAD;
        let ly = 14;
        const legend: { x: number; y: number; l: (typeof LANES)[number] }[] = [];
        for (const l of LANES) {
          const cw = chipWidth(ctx, l.label, 11);
          if (lx > PAD && lx + cw > w - PAD) {
            lx = PAD;
            ly += 26;
          }
          legend.push({ x: lx, y: ly, l });
          lx += cw + 6;
        }
        const dotsTop = ly + 22;
        const colW = (w - 2 * PAD) / YEARS.length;
        const r = Math.max(3.5, Math.min(8, colW * 0.16));
        const step = 2 * r + 3;
        const axisY = dotsTop + maxStack * step + 8;
        const labelY = axisY + 13;
        const detailTop = labelY + 22;
        const rowsMax = Math.max(...YEARS.map((_, k) => chipRows(ctx, k, w - 2 * PAD).length));
        const need = detailTop + 24 + rowsMax * (CHH + 7) + 6;
        if (fitHeight(cv.canvas, w, h, need)) return;

        legend.forEach(({ x, y, l }) => chip(ctx, l.label, x, y, l.color, { size: 11, h: 21 }));

        cols = YEARS.map((_, k) => ({ x0: PAD + k * colW, x1: PAD + (k + 1) * colW }));
        colBand = [dotsTop - 6, labelY + 10];
        const c0 = cols[sel]!;
        rbox(ctx, c0.x0 + 1, dotsTop - 6, colW - 2, labelY + 10 - (dotsTop - 6), 7, withAlpha(color('--accent'), 0.12), withAlpha(color('--accent'), 0.5), 1);

        line(ctx, PAD, axisY + 0.5, w - PAD, axisY + 0.5, color('--axis'), 1);
        YEARS.forEach((y, k) => {
          const cx = PAD + (k + 0.5) * colW;
          const on = k === sel;
          line(ctx, cx, axisY - 2, cx, axisY + 3, color('--axis'), 1);
          const lab = colW < 34 ? `’${String(y).slice(2)}` : String(y);
          if (y === 2026) text(ctx, 'today', cx, axisY - 6 - byYear[k]!.length * step - 6, { size: 11, italic: true, color: color('--ink-3') });
          text(ctx, lab, cx, labelY, { size: 11, font: 'mono', weight: on ? 700 : 500, color: color(on ? '--ink' : '--ink-3') });
          byYear[k]!.forEach(({ m, i }, j) => {
            const cy = axisY - 6 - r - j * step;
            const c = color(laneOf(m.lane).color);
            const rr = on ? r * 1.12 : r;
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            if (m.now) {
              ctx.save();
              ctx.setLineDash([2.5, 2]);
              ctx.fillStyle = withAlpha(c, 0.12);
              ctx.fill();
              ctx.strokeStyle = c;
              ctx.lineWidth = 1.4;
              ctx.stroke();
              ctx.restore();
            } else {
              ctx.fillStyle = withAlpha(c, on ? 0.95 : 0.72);
              ctx.fill();
            }
            if (i === focus) {
              ctx.beginPath();
              ctx.arc(cx, cy, rr + 3, 0, Math.PI * 2);
              ctx.strokeStyle = color('--ink');
              ctx.lineWidth = 1.4;
              ctx.stroke();
            }
          });
        });

        // The chosen year's milestones as chips.
        const y = YEARS[sel]!;
        const n = byYear[sel]!.length;
        text(ctx, String(y), PAD, detailTop, { size: 15, weight: 700, align: 'left', color: color('--ink') });
        const yw = measure(ctx, String(y), { size: 15, weight: 700 });
        text(ctx, y === 2026 ? 'today: the standard recipe' : `${n} milestones: tap one`, PAD + yw + 8, detailTop + 0.5, { size: 12, align: 'left', color: color('--ink-3') });
        chips = [];
        const rows = chipRows(ctx, sel, w - 2 * PAD);
        rows.forEach((row, ri) => {
          let x = PAD;
          const cy = detailTop + 26 + ri * (CHH + 7);
          for (const { i, w: cw } of row) {
            const m = MILESTONES[i]!;
            chip(ctx, m.short, x, cy, laneOf(m.lane).color, { size: CH, h: CHH, hollow: m.now, on: i === focus, ring: i === focus });
            chips.push({ x, y: cy - CHH / 2, w: cw, h: CHH, i });
            x += cw + 7;
          }
        });
      });
      cv.canvas.classList.add('scroll-ok');

      const status = () => {
        const y = YEARS[sel]!;
        const list = byYear[sel]!
          .map(({ m, i }) => {
            const head = i === focus ? `**▸ ${m.short}**` : `**${m.short}**`;
            const who = m.now ? '' : ` (${m.who})`;
            return `- ${head}${who}: ${m.why} [Chapter ${chNum(m.ch)}](#/${m.ch})`;
          })
          .join('\n');
        return `**${y}.** ${YEAR_SUMMARY[y]}\n\n${list}`;
      };
      const sync = () => {
        f.code.set('year', YEARS[sel]!);
        f.code.highlight(`y${YEARS[sel]}`);
        f.code.highlight(focus >= 0 ? `i${focus}` : null, 'alt');
        f.status(status());
        cv.redraw();
      };
      const stepper = f.stepper({
        steps: YEARS.length,
        interval: 2600,
        label: (k) => String(YEARS[k]),
        onStep: (k) => {
          sel = k;
          focus = -1;
          sync();
        },
      });
      cv.canvas.addEventListener('pointerdown', (e) => {
        const rc = cv.canvas.getBoundingClientRect();
        const px = e.clientX - rc.left;
        const py = e.clientY - rc.top;
        const hit = chips.find((c) => px >= c.x - 3 && px <= c.x + c.w + 3 && py >= c.y - 3 && py <= c.y + c.h + 3);
        if (hit) {
          focus = focus === hit.i ? -1 : hit.i;
          sync();
          return;
        }
        if (py >= colBand[0]! && py <= colBand[1]!) {
          const k = cols.findIndex((c) => px >= c.x0 && px < c.x1);
          if (k >= 0) stepper.go(k);
        }
      });
    },
    caption: `Every dot is one milestone, colored by the thread it belongs to; the threads are the parts of this course. **Tap a year** (or step through with the arrows, or press play) to list what appeared and why it mattered, with a link to the chapter that teaches it. **Tap a milestone** to light its line in the code. The stacks grow taller toward the middle of the decade: 2018 and 2019 have two or three milestones each, while 2022 and 2023 each change several threads at once. The dashed rings of 2026 are not events but the present: the standard recipe each part of the course builds.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: one softmax, two jobs                                          */
/* ------------------------------------------------------------------ */

const WR = [
  [1.6, 0.5],
  [-0.5, 1.5],
  [-1.1, -1.2],
];
const VR = [
  [1, 0],
  [0, 1],
  [-1, -1],
];
const CLS = ['cat', 'dog', 'ship'];
const TOK = ['the', 'cat', 'sat'];
const list3 = (v: number[]) => v.map((x) => fmt(x, 2)).join(', ');

export function figSoftmax(p: Page): void {
  p.figure({
    title: 'One softmax, two jobs',
    codeTitle: 'same_softmax.py',
    code: `
      def softmax(s):
          e = np.exp(s - s.max())                  #@soft
          return e / e.sum()                       #@soft

      # 2016: score an image x against each class
      W = np.array([[1.6, 0.5],     # cat          #@W
                    [-0.5, 1.5],    # dog          #@W
                    [-1.1, -1.2]])  # ship         #@W
      x = np.array([{{x0:0.8}}, {{x1:0.5}}])       #@x
      s = W @ x          # [{{s16}}]               #@s16
      p = softmax(s)     # [{{p16}}]               #@p16

      # 2017: score a query q against each token
      K = W   # keys: here the same rows, as tokens  #@K
      V = np.array([[1, 0], [0, 1], [-1, -1]])     #@V
      q = x                                        #@q
      s = K @ q / np.sqrt(2)   # [{{s17}}]         #@s17
      a = softmax(s)           # [{{a17}}]         #@a17
      out = a @ V              # [{{out}}]         #@out
    `,
    setup(f) {
      const x = [0.8, 0.5];
      let mode: '2016' | '2017' = '2016';
      let lit: string | null = null;
      let geo = { cx: 0, cy: 0, k: 1, x0: 0, top: 0, size: 0 };
      let drag = false;
      const calc = () => {
        const s16 = WR.map((w) => w[0]! * x[0]! + w[1]! * x[1]!);
        const p16 = softmax(s16);
        const s17 = s16.map((v) => v / Math.SQRT2);
        const a17 = softmax(s17);
        const out = [0, 1].map((d) => a17.reduce((t, a, j) => t + a * VR[j]![d]!, 0));
        return { s16, p16, s17, a17, out };
      };
      const ROW = 34;
      const cv = f.canvas(560, 540, (ctx, w, h) => {
        const size = Math.min(w - 16, 330);
        const barsTop = 10 + size + 12;
        const need = barsTop + 24 + 3 * ROW + 40;
        if (fitHeight(cv.canvas, w, h, need)) return;
        const x0 = (w - size) / 2;
        const top = 10;
        const k = size / 4.4;
        const cx = x0 + size / 2;
        const cy = top + size / 2;
        geo = { cx, cy, k, x0, top, size };
        const X = (v: number) => cx + v * k;
        const Y = (v: number) => cy - v * k;
        rbox(ctx, x0, top, size, size, 10, color('--paper'), color('--rule'), 1);
        for (let g = -2; g <= 2; g++) {
          line(ctx, X(g), top + 4, X(g), top + size - 4, color(g === 0 ? '--axis' : '--grid'), 1);
          line(ctx, x0 + 4, Y(g), x0 + size - 4, Y(g), color(g === 0 ? '--axis' : '--grid'), 1);
        }
        const att = mode === '2017';
        text(ctx, att ? 'keys K: one row per token' : 'weights W: one row per class', x0 + 10, top + 15, { size: 12, align: 'left', weight: 600, color: color('blue') });
        const { s16, p16, s17, a17, out } = calc();
        const names = att ? TOK : CLS;
        const lw = lit === 'W' ? 3.2 : 2;
        WR.forEach((wv, j) => {
          arrow(ctx, X(0), Y(0), X(wv[0]!), Y(wv[1]!), color('blue'), lw, 9);
          const len = Math.hypot(wv[0]!, wv[1]!);
          const lx = X(wv[0]! + (wv[0]! / len) * 0.32);
          const ly = Y(wv[1]! + (wv[1]! / len) * 0.25);
          text(ctx, att ? `“${names[j]}”` : names[j]!, lx, ly, { size: 13, weight: 600, color: color('blue') });
        });
        const px = X(x[0]!);
        const py = Y(x[1]!);
        line(ctx, X(0), Y(0), px, py, withAlpha(color('orange'), 0.5), 1.4, [4, 3]);
        ctx.beginPath();
        ctx.arc(px, py, lit === 'x' ? 9 : 7.5, 0, Math.PI * 2);
        ctx.fillStyle = color('orange');
        ctx.fill();
        ctx.strokeStyle = color('--paper');
        ctx.lineWidth = 2;
        ctx.stroke();
        text(ctx, att ? 'q' : 'x', px + 13, py - 12, { size: 17, font: 'serif', italic: true, weight: 600, color: color('orange') });
        text(ctx, 'drag me', x0 + size - 10, top + size - 13, { size: 11, align: 'right', color: color('--ink-3') });

        // Scores and the softmax.
        const s = att ? s17 : s16;
        const pr = att ? a17 : p16;
        text(ctx, att ? 'a = softmax(K q / √2)' : 'p = softmax(W x)', 8, barsTop + 6, { size: 12, font: 'mono', weight: 600, align: 'left', color: color('green') });
        const nameW = 46;
        const sW = 74;
        const pctW = 42;
        const bx = 8 + nameW + sW;
        const bw = Math.max(40, w - bx - pctW - 8);
        names.forEach((nm, j) => {
          const yy = barsTop + 24 + j * ROW + ROW / 2;
          text(ctx, att ? `“${nm}”` : nm, 8, yy, { size: 12, weight: 600, align: 'left', color: color('blue') });
          text(ctx, `s = ${fmt(s[j]!, 2)}`, 8 + nameW, yy, { size: 12, font: 'mono', align: 'left', weight: lit === 's' ? 700 : 500, color: color('purple') });
          rbox(ctx, bx, yy - 9, bw, 18, 4, withAlpha(color('green'), 0.08), withAlpha(color('green'), 0.35), 1);
          rbox(ctx, bx, yy - 9, Math.max(2, bw * pr[j]!), 18, 4, withAlpha(color('green'), lit === 'p' ? 0.95 : 0.7), null);
          text(ctx, `${Math.round(pr[j]! * 100)}%`, bx + bw + 6, yy, { size: 12, font: 'mono', align: 'left', color: color('--ink') });
        });
        const fy = barsTop + 24 + 3 * ROW + 16;
        if (att) text(ctx, `out = a @ V = [${list3(out)}]`, 8, fy, { size: 12, font: 'mono', align: 'left', color: color('--ink-2') });
        else {
          const best = p16.indexOf(Math.max(...p16));
          text(ctx, `prediction: ${CLS[best]} (${Math.round(p16[best]! * 100)}%)`, 8, fy, { size: 12, font: 'mono', align: 'left', color: color('--ink-2') });
        }
      });
      const sync = () => {
        const { s16, p16, s17, a17, out } = calc();
        f.code.setMany({ x0: fmt(x[0]!, 2), x1: fmt(x[1]!, 2), s16: list3(s16), p16: list3(p16), s17: list3(s17), a17: list3(a17), out: list3(out) });
        cv.redraw();
      };
      const light = () => {
        f.code.highlight(mode === '2016' ? ['x', 's16', 'p16'] : ['K', 'q', 's17', 'a17', 'out']);
        f.code.highlight('soft', 'alt');
      };
      const move = (e: PointerEvent) => {
        const rc = cv.canvas.getBoundingClientRect();
        const vx = (e.clientX - rc.left - geo.cx) / geo.k;
        const vy = -(e.clientY - rc.top - geo.cy) / geo.k;
        x[0] = Math.max(-2.05, Math.min(2.05, vx));
        x[1] = Math.max(-2.05, Math.min(2.05, vy));
        sync();
      };
      cv.canvas.addEventListener('pointerdown', (e) => {
        const rc = cv.canvas.getBoundingClientRect();
        const py = e.clientY - rc.top;
        const px = e.clientX - rc.left;
        if (py > geo.top + geo.size || px < geo.x0 || px > geo.x0 + geo.size) return;
        drag = true;
        cv.canvas.setPointerCapture(e.pointerId);
        move(e);
      });
      cv.canvas.addEventListener('pointermove', (e) => drag && move(e));
      cv.canvas.addEventListener('pointerup', () => (drag = false));
      cv.canvas.addEventListener('pointercancel', () => (drag = false));
      f.segmented({
        options: [
          { value: '2016', label: '2016: classify' },
          { value: '2017', label: '2017: attend' },
        ],
        value: '2016',
        onChange: (v) => {
          mode = v as '2016' | '2017';
          light();
          sync();
        },
      });
      f.onSym((k) => {
        lit = k;
        cv.redraw();
      });
      light();
      sync();
    },
    caption: `**Drag the orange point.** In 2016 mode it is an image $\\symx$ (squeezed to two numbers), the blue arrows are the rows of a linear classifier's $\\symW$, and the softmax turns the three scores into class probabilities. Switch to **2017** and nothing moves: the same arrows are now the keys of three tokens, the point is a query, and the same softmax (lit in teal in both halves of the code) turns the same dot products into attention weights. Two things differ. Attention divides by $\\sqrt{d}$ (here $\\sqrt 2$), so its weights are a little softer, and the weights are used to *blend values* instead of to name a class. Point the query straight along one arrow and that token takes most of the weight; put it at the origin and every token gets a third.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: model sizes on a log axis                                      */
/* ------------------------------------------------------------------ */

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const pow10 = (e: number) => `10${String(e).split('').map((d) => SUP[d]).join('')}`;
/** 6.0e23 -> "6.0 × 10²³". */
export function sci(v: number): string {
  const e = Math.floor(Math.log10(v));
  return `${(v / 10 ** e).toFixed(1)} × ${pow10(e)}`;
}
/** 6.0e23 -> TeX "6.0 \\times 10^{23}". */
const sciTex = (v: number): string => {
  const e = Math.floor(Math.log10(v));
  return `${(v / 10 ** e).toFixed(1)} \\times 10^{${e}}`;
};
/** 1.5e9 -> "1.5 billion". */
export function human(v: number): string {
  const units: [number, string][] = [
    [1e12, 'trillion'],
    [1e9, 'billion'],
    [1e6, 'million'],
  ];
  for (const [u, nm] of units) if (v >= u) return `${+(v / u).toPrecision(3)} ${nm}`;
  return String(v);
}
const shortN = (v: number) => (v >= 1e12 ? `${+(v / 1e12).toPrecision(3)}T` : v >= 1e9 ? `${+(v / 1e9).toPrecision(3)}B` : `${+(v / 1e6).toPrecision(3)}M`);

/** Which labels win when space is short. */
const LABEL_ORDER = ['DeepSeek-V3', 'GPT-3', 'Chinchilla', 'AlexNet', 'Llama 3.1', 'GPT-2', 'PaLM', 'Transformer', 'BERT-large', 'Gopher', 'LLaMA', 'T5', 'ResNet-152'];

export function figScale(p: Page): void {
  const rows = MODELS.map((m, i) => {
    const N = m.active ?? m.N;
    const yr = Math.floor(m.t);
    const nm = `'${m.name}',`.padEnd(14);
    const n = `${shortN(N).replace('M', 'e6').replace('B', 'e9').replace('T', 'e12')},`.padEnd(6);
    const d = m.D ? `${shortN(m.D).replace('B', 'e9').replace('T', 'e12')}` : 'None';
    const tail = '),';
    return `    (${yr}, ${nm} ${n} ${d}${tail}`.padEnd(52) + `#@m${i}`;
  });
  p.figure({
    title: 'Model sizes, AlexNet to DeepSeek-V3',
    codeTitle: 'sizes.py',
    code: [
      '# (year, name, N, D); N is active for MoE',
      'models = [',
      ...rows,
      ']',
      'for year, name, N, D in models:',
      '    C = 6 * N * D if D else None     # FLOPs     #@C',
      '    plt.scatter(year, {{y:N}})                    #@plot',
      "plt.yscale('{{scale:log}}')                     #@scale",
    ].join('\n'),
    setup(f) {
      type Mode = 'log' | 'lin' | 'compute';
      let mode: Mode = 'log';
      let sel = 6;
      let lit: string | null = null;
      let dots: { x: number; y: number; i: number }[] = [];
      const cv = f.canvas(640, 430, (ctx, w, h) => {
        const need = Math.max(360, Math.min(420, w * 0.66));
        if (fitHeight(cv.canvas, w, h, need)) return;
        const L = 46;
        const R = 10;
        const T = 12;
        const B = 34;
        const t0 = 2011.7;
        const t1 = 2025.4;
        const X = (t: number) => L + ((t - t0) / (t1 - t0)) * (w - L - R);
        const show = MODELS.map((m, i) => ({ m, i })).filter(({ m }) => mode !== 'compute' || m.D);
        const val = (m: (typeof MODELS)[number], total = false) => (mode === 'compute' ? 6 * (m.active ?? m.N) * m.D! : total ? m.N : (m.active ?? m.N));
        let lo: number;
        let hi: number;
        let ticks: { v: number; s: string }[];
        if (mode === 'lin') {
          lo = 0;
          hi = 720e9;
          ticks = [0, 200e9, 400e9, 600e9].map((v) => ({ v, s: v ? `${v / 1e9}B` : '0' }));
        } else if (mode === 'log') {
          lo = 7;
          hi = 12.6;
          ticks = [
            [7, '10M'],
            [8, '100M'],
            [9, '1B'],
            [10, '10B'],
            [11, '100B'],
            [12, '1T'],
          ].map(([v, s]) => ({ v: v as number, s: s as string }));
        } else {
          lo = 22.8;
          hi = 26.1;
          ticks = [23, 24, 25].map((e) => ({ v: e, s: `1e${e}` }));
        }
        const Yv = (v: number) => {
          const u = mode === 'lin' ? v : Math.log10(v);
          return T + (1 - (u - lo) / (hi - lo)) * (h - T - B);
        };
        const Yt = (u: number) => T + (1 - (u - lo) / (hi - lo)) * (h - T - B);
        ticks.forEach(({ v, s }) => {
          const y = Yt(v);
          line(ctx, L, y + 0.5, w - R, y + 0.5, color('--grid'), 1);
          text(ctx, s, L - 6, y, { size: 11, font: 'mono', align: 'right', color: color('--ink-3') });
        });
        for (let yr = 2012; yr <= 2024; yr += 2) text(ctx, String(yr), X(yr + 0.5), h - B + 14, { size: 11, font: 'mono', color: color('--ink-3') });
        line(ctx, L, h - B + 0.5, w - R, h - B + 0.5, color('--axis'), 1);
        const head = mode === 'compute' ? 'training compute C ≈ 6ND (FLOPs)' : 'parameters N';
        text(ctx, head, L + 4, T + 4, { size: 11, align: 'left', weight: 600, color: color(mode === 'compute' ? '--ink-2' : 'teal') });

        dots = [];
        const placed: { x0: number; y0: number; x1: number; y1: number }[] = [{ x0: L, y0: T - 4, x1: L + 8 + measure(ctx, head, { size: 11, weight: 600 }), y1: T + 12 }];
        const pts = show.map(({ m, i }) => ({ m, i, x: X(m.t), y: Yv(val(m)) }));
        // The stored total of a mixture of experts, as a ring above its active dot.
        const moe = MODELS.findIndex((m) => m.active);
        if (mode !== 'compute' && moe >= 0) {
          const m = MODELS[moe]!;
          const xx = X(m.t);
          const ya = Yv(val(m));
          const yt = Yv(m.N);
          line(ctx, xx, ya, xx, yt, withAlpha(color('teal'), 0.6), 1.2, [3, 3]);
          ctx.beginPath();
          ctx.arc(xx, yt, 5.5, 0, Math.PI * 2);
          ctx.strokeStyle = color('teal');
          ctx.lineWidth = 1.6;
          ctx.stroke();
          dots.push({ x: xx, y: yt, i: moe });
          placed.push({ x0: xx - 7, y0: yt - 7, x1: xx + 7, y1: yt + 7 }, { x0: xx - 2, y0: yt, x1: xx + 2, y1: ya });
        }
        for (const d of pts) {
          const c = color(d.m.conv ? 'slate' : mode === 'compute' ? 'purple' : 'teal');
          const on = d.i === sel;
          ctx.beginPath();
          ctx.arc(d.x, d.y, on ? 7 : lit === 'N' && mode !== 'compute' ? 6.5 : 5.5, 0, Math.PI * 2);
          ctx.fillStyle = withAlpha(c, on ? 1 : 0.8);
          ctx.fill();
          if (on) {
            ctx.strokeStyle = color('--ink');
            ctx.lineWidth = 1.6;
            ctx.stroke();
          }
          dots.push({ x: d.x, y: d.y, i: d.i });
          placed.push({ x0: d.x - 7, y0: d.y - 7, x1: d.x + 7, y1: d.y + 7 });
        }
        // Labels, placed greedily; the selected one first, any that collide are dropped.
        const rank = (nm: string) => {
          const k = LABEL_ORDER.indexOf(nm);
          return k < 0 ? 99 : k;
        };
        const order = [...pts].sort((a, b) => (a.i === sel ? -1 : b.i === sel ? 1 : rank(a.m.name) - rank(b.m.name)));
        for (const d of order) {
          const on = d.i === sel;
          const lab = d.m.name;
          const tw = measure(ctx, lab, { size: 11, weight: on ? 700 : 500 });
          const cands = [
            { x: d.x + 9, y: d.y, a: 'left' as const },
            { x: d.x - 9, y: d.y, a: 'right' as const },
            { x: d.x, y: d.y - 14, a: 'center' as const },
            { x: d.x, y: d.y + 14, a: 'center' as const },
            { x: d.x - 4, y: d.y - 16, a: 'right' as const },
            { x: d.x + 4, y: d.y - 16, a: 'left' as const },
            { x: d.x - 4, y: d.y + 16, a: 'right' as const },
            { x: d.x + 4, y: d.y + 16, a: 'left' as const },
            { x: d.x - 8, y: d.y - 22, a: 'right' as const },
            { x: d.x + 8, y: d.y + 22, a: 'left' as const },
          ];
          for (const c of cands) {
            const x0 = c.a === 'left' ? c.x : c.a === 'right' ? c.x - tw : c.x - tw / 2;
            const box = { x0: x0 - 2, y0: c.y - 7, x1: x0 + tw + 2, y1: c.y + 7 };
            if (box.x0 < L + 2 || box.x1 > w - 2 || box.y0 < 1 || box.y1 > h - B - 1) continue;
            if (placed.some((q) => q.x0 < box.x1 && q.x1 > box.x0 && q.y0 < box.y1 && q.y1 > box.y0)) continue;
            placed.push(box);
            text(ctx, lab, c.x, c.y, { size: 11, weight: on ? 700 : 500, align: c.a, color: color(on ? '--ink' : '--ink-2') });
            break;
          }
        }
      });
      const status = () => {
        const m = MODELS[sel]!;
        const parts = [`**${m.name}** (${Math.floor(m.t)}): ${m.active ? `${human(m.N)} parameters stored, ${human(m.active)} active per token` : `${human(m.N)} parameters`}`];
        if (m.D) parts.push(`, trained on ${human(m.D)} tokens (${fmt(m.D / (m.active ?? m.N), 2)} per parameter). Compute $\\approx 6\\symN\\symD = ${sciTex(6 * (m.active ?? m.N) * m.D)}$ FLOPs`);
        return `${parts.join('')}. ${m.note}`;
      };
      const sync = () => {
        f.code.highlight(`m${sel}`);
        f.code.highlight(MODELS[sel]!.D ? 'C' : null, 'alt');
        f.status(status());
        cv.redraw();
      };
      cv.canvas.addEventListener('pointerdown', (e) => {
        const rc = cv.canvas.getBoundingClientRect();
        const px = e.clientX - rc.left;
        const py = e.clientY - rc.top;
        let best = -1;
        let bd = 24;
        for (const d of dots) {
          const dd = Math.hypot(d.x - px, d.y - py);
          if (dd < bd) {
            bd = dd;
            best = d.i;
          }
        }
        if (best >= 0) {
          sel = best;
          sync();
        }
      });
      cv.canvas.classList.add('scroll-ok');
      f.segmented({
        options: [
          { value: 'log', label: 'N, log' },
          { value: 'lin', label: 'N, linear' },
          { value: 'compute', label: '6ND, log' },
        ],
        value: 'log',
        onChange: (v) => {
          mode = v as Mode;
          f.code.set('scale', mode === 'lin' ? 'linear' : 'log');
          f.code.set('y', mode === 'compute' ? 'C' : 'N');
          if (mode === 'compute' && !MODELS[sel]!.D) sel = 6;
          f.code.highlight(['scale', 'plot'], 'alt');
          f.status(status());
          cv.redraw();
        },
      });
      f.onSym((k) => {
        lit = k;
        cv.redraw();
      });
      sync();
    },
    caption: `Published sizes of landmark models: slate for the ConvNets of CS231n's era, teal for transformers. **Tap a dot** for its numbers. On the **log** axis each grid line is ten times the one below, and growth that multiplies looks like a steady climb: about 3,000 times more parameters from AlexNet (2012) to GPT-3 (2020). Switch to **linear** and the whole CS231n era collapses onto the floor. **6ND** plots training compute for the models whose token counts were published: Chinchilla used about the same compute as Gopher with a quarter of the parameters. DeepSeek-V3's ring is its stored total; the filled dot is what one token uses. Sizes come from each model's paper or report; the largest closed models of recent years do not publish theirs.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: learning from a checker, or from a learned guess               */
/* ------------------------------------------------------------------ */

const ANS = ['42', '32', '43', '52, definitely!'];
const LOGIT0 = [0.3, 0.8, 0.2, -0.4];
const RM = [0.6, 0.2, 0.3, 0.8];
const CHECK = [1, 0, 0, 0];
const MAX_STEPS = 300;

export function figFeedback(p: Page): void {
  p.figure({
    title: 'Learning from feedback: a checker or a guess',
    codeTitle: 'reinforce.py',
    code: `
      answers = ['42', '32', '43',
                 '52, definitely!']
      logits = np.array([.3, .8, .2, -.4])  #@init
      check = np.array([1., 0, 0, 0])  # a program  #@check
      rm = np.array([.6, .2, .3, .8])  # a guess  #@rm
      reward = {{src:check}}  #@src

      for step in range({{steps:0}}):
          p = softmax(logits)  #@p
          i = rng.choice(4, p=p)  # {{ans:none yet}}  #@sample
          r = reward[i]  # {{r:not yet}}  #@r
          b = p @ reward  # baseline  #@b
          logits += {{lr:0.5}} * (r - b) * (np.eye(4)[i] - p)  #@step
    `,
    setup(f) {
      let src: 'check' | 'rm' = 'check';
      let lr = 0.5;
      let logits = [...LOGIT0];
      let steps = 0;
      let rng = new Rng(7);
      let acc: number[] = [];
      let expR: number[] = [];
      let last = -1;
      let lastR = 0;
      let lit: string | null = null;
      const rew = () => (src === 'check' ? CHECK : RM);
      const record = () => {
        const pr = softmax(logits);
        acc.push(pr[0]!);
        expR.push(pr.reduce((t, v, j) => t + v * rew()[j]!, 0));
      };
      const reset = () => {
        logits = [...LOGIT0];
        steps = 0;
        rng = new Rng(7);
        acc = [];
        expR = [];
        last = -1;
        record();
      };
      const stepOnce = () => {
        const pr = softmax(logits);
        let u = rng.next();
        let i = 0;
        while (i < 3 && u >= pr[i]!) u -= pr[i++]!;
        const R = rew();
        const r = R[i]!;
        const b = pr.reduce((t, v, j) => t + v * R[j]!, 0);
        logits = logits.map((v, j) => v + lr * (r - b) * ((j === i ? 1 : 0) - pr[j]!));
        steps++;
        last = i;
        lastR = r;
        record();
      };
      reset();
      const ROW = 36;
      const cv = f.canvas(560, 420, (ctx, w, h) => {
        const top = 30;
        const chartTop = top + 4 * ROW + 26;
        const chartH = 120;
        const need = chartTop + chartH + 30;
        if (fitHeight(cv.canvas, w, h, need)) return;
        text(ctx, 'Question: 17 + 25 = ?', 8, 13, { size: 13, weight: 600, align: 'left' });
        text(ctx, src === 'check' ? 'reward: a checker' : 'reward: a learned guess', w - 8, 13, { size: 12, align: 'right', color: color('--ink-3') });
        const pr = softmax(logits);
        const ansW = Math.max(...ANS.map((a) => measure(ctx, a, { size: 12.5, font: 'mono', weight: 600 }))) + 12;
        const tagW = src === 'check' ? 40 : 52;
        const pctW = 42;
        const bx = 8 + ansW + tagW;
        const bw = Math.max(40, w - bx - pctW - 6);
        ANS.forEach((a, j) => {
          const yy = top + j * ROW + ROW / 2;
          if (j === last) rbox(ctx, 2, yy - ROW / 2 + 2, w - 4, ROW - 4, 6, withAlpha(color('--accent'), 0.1), null);
          text(ctx, a, 8, yy, { size: 12.5, font: 'mono', align: 'left', weight: 600, color: color(j === 0 ? 'green' : '--ink') });
          if (src === 'check') {
            const ok = CHECK[j] === 1;
            text(ctx, ok ? '✓ 1' : '✗ 0', 8 + ansW, yy, { size: 12.5, align: 'left', weight: 700, color: color(ok ? 'green' : 'red') });
          } else text(ctx, `rm ${RM[j]!.toFixed(1)}`, 8 + ansW, yy, { size: 12, font: 'mono', align: 'left', color: color('--ink-2') });
          rbox(ctx, bx, yy - 9, bw, 18, 4, withAlpha(color('green'), 0.08), withAlpha(color('green'), 0.35), 1);
          rbox(ctx, bx, yy - 9, Math.max(2, bw * pr[j]!), 18, 4, withAlpha(color('green'), lit === 'p' ? 0.95 : 0.7), null);
          text(ctx, `${Math.round(pr[j]! * 100)}%`, bx + bw + 6, yy, { size: 12, font: 'mono', align: 'left' });
        });
        // Accuracy and expected reward over training.
        const L = 34;
        const X = (k: number) => L + (k / MAX_STEPS) * (w - L - 10);
        const Y = (v: number) => chartTop + (1 - v) * chartH;
        text(ctx, 'P(42), the real accuracy', L, chartTop - 12, { size: 11, weight: 600, align: 'left', color: color('green') });
        const lw2 = measure(ctx, 'P(42), the real accuracy', { size: 11, weight: 600 });
        text(ctx, '- - expected reward', L + lw2 + 14, chartTop - 12, { size: 11, align: 'left', color: color('--ink-2') });
        [0, 0.5, 1].forEach((v) => {
          line(ctx, L, Y(v) + 0.5, w - 10, Y(v) + 0.5, color(v === 0 ? '--axis' : '--grid'), 1);
          text(ctx, String(v), L - 6, Y(v), { size: 11, font: 'mono', align: 'right', color: color('--ink-3') });
        });
        text(ctx, `step ${steps} / ${MAX_STEPS}`, w - 10, chartTop + chartH + 16, { size: 11, font: 'mono', align: 'right', color: color('--ink-3') });
        const curve = (arr: number[], col: string, dash?: number[]) => {
          ctx.beginPath();
          arr.forEach((v, k) => (k ? ctx.lineTo(X(k), Y(v)) : ctx.moveTo(X(k), Y(v))));
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.setLineDash(dash ?? []);
          ctx.stroke();
          ctx.setLineDash([]);
        };
        curve(expR, color('--ink-2'), [5, 4]);
        curve(acc, color('green'));
        const k = acc.length - 1;
        ctx.beginPath();
        ctx.arc(X(k), Y(acc[k]!), 4, 0, Math.PI * 2);
        ctx.fillStyle = color('green');
        ctx.fill();
      });
      const accRo = f.readout('P(correct)', { sym: 'p' });
      const rRo = f.readout('expected reward');
      const sync = () => {
        f.code.setMany({ steps, ans: last >= 0 ? `'${ANS[last]}'` : 'none yet', r: last >= 0 ? `r = ${lastR}` : 'not yet' });
        accRo.set(`${Math.round(acc[acc.length - 1]! * 100)}%`);
        rRo.set(fmt(expR[expR.length - 1]!, 2));
        cv.redraw();
      };
      const run = f.loop(() => {
        for (let k = 0; k < 2 && steps < MAX_STEPS; k++) stepOnce();
        f.code.highlight(['sample', 'r', 'b', 'step']);
        sync();
        if (steps >= MAX_STEPS) {
          f.code.highlight(null);
          return false;
        }
      });
      f.button('Train', () => {
        if (steps >= MAX_STEPS) reset();
        run.start();
      }, { primary: true, icon: 'play' });
      f.button('Reset', () => {
        run.stop();
        reset();
        f.code.highlight('init');
        sync();
      }, { icon: 'reset' });
      f.segmented({
        label: 'reward',
        options: [
          { value: 'check', label: 'checker' },
          { value: 'rm', label: 'reward model' },
        ],
        value: 'check',
        slot: 'src',
        onChange: (v) => {
          run.stop();
          src = v as 'check' | 'rm';
          reset();
          f.code.highlight(src === 'check' ? 'check' : 'rm');
          sync();
        },
      });
      f.slider({ label: 'learning rate', min: 0.1, max: 2, step: 0.1, value: 0.5, slot: 'lr', format: (v) => fmt(v, 2), onInput: (v) => (lr = v) });
      f.onSym((k) => {
        lit = k;
        cv.redraw();
      });
      sync();
    },
    caption: `A pretrained "model" that answers a sum, reduced to four possible answers and a softmax over their scores. Its starting guesses are poor: the wrong *32* is the favorite. **Press Train**: each step samples an answer, scores it, and nudges the logits by the reward minus a baseline (the policy gradient of Eq 0.4). With a **checker**, a program that tests whether the answer is 42, accuracy climbs toward 100%, and the dashed expected reward is the same curve. Now pick **reward model**: a learned score that, like real reward models, has a flaw, here a taste for confident answers. The expected reward rises just as smoothly while the real accuracy falls, because the policy finds the answer the guess overrates. That gap is reward hacking, and closing it is the story of post-training from RLHF to RLVR. (A toy: real RLHF also keeps the policy close to the pretrained model with a KL penalty, which slows this drift.)`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: a 2026 training step, colored by age                           */
/* ------------------------------------------------------------------ */

interface Part {
  label: string;
  old: boolean;
  line: string;
  md: string;
}
const P: Record<string, Part> = {
  init: { label: 'init: small random weights', old: true, line: 'init', md: '**Initialization**, from CS231n: small random weights scaled to each layer\'s width, so signals neither explode nor vanish ([weight initialization](#/nn-data-loss/init)). GPT-2 added one twist: shrink the layers that write into the residual stream by the square root of their number.' },
  tok: { label: 'text → token ids (BPE)', old: false, line: 'tok', md: '**Tokens**, new: text is cut into subword pieces by byte-pair encoding, a counting algorithm rather than a network ([Chapter 3](#/tokenization)). CS231n\'s character model read one character at a time.' },
  embed: { label: 'embedding', old: true, line: 'embed', md: '**The embedding table**, from CS231n: the captioning network of Assignment 3 looked up a learned vector for every word ([recurrent networks](#/rnn)). Same object, now indexed by token id ([Chapter 3](#/tokenization)).' },
  pos: { label: 'positions', old: false, line: 'attn', md: '**Positions**, new: attention ignores word order, so it has to be put back, with sinusoids in 2017 and rotations of the queries and keys (RoPE) today, applied inside attention ([Chapter 2](#/transformer), [Chapter 6](#/modern-transformer)).' },
  norm1: { label: 'norm', old: true, line: 'attn', md: '**Normalization**, from CS231n, turned sideways: batch norm averaged each feature over a batch ([batch normalization](#/nn-data-loss/batchnorm)); layer norm and RMSNorm average each token over its own features, before every sublayer ([Chapter 6](#/modern-transformer)).' },
  attn: { label: 'attention', old: false, line: 'attn', md: '**Attention**, new as the main layer. CS231n met soft attention near the end, letting a captioning RNN look at image regions ([attention](#/attention)); the 2017 Transformer made it the whole network ([Chapter 2](#/transformer)). Inside is the softmax of dot products from Figure 0.2.' },
  res1: { label: '+ residual', old: true, line: 'attn', md: '**Residual connections**, from CS231n: ResNet\'s shortcut, `h = h + f(h)`, gives the gradient a direct path down a deep stack ([ConvNet case studies](#/convnets/case-studies)).' },
  norm2: { label: 'norm', old: true, line: 'mlp', md: '**Normalization** again, before the MLP. Same idea as batch norm, computed per token ([Chapter 6](#/modern-transformer)).' },
  mlp: { label: 'MLP', old: true, line: 'mlp', md: '**The MLP**, from CS231n: a matrix multiply, a nonlinearity, another matrix multiply ([neural networks](#/nn-architecture)), applied to every token on its own. Today\'s version, SwiGLU, adds a gate. About two thirds of a block\'s weights live here.' },
  res2: { label: '+ residual', old: true, line: 'mlp', md: '**Residual connections** again: the block adds its MLP\'s output to its input instead of replacing it ([ConvNet case studies](#/convnets/case-studies)).' },
  unembed: { label: 'unembedding: scores', old: true, line: 'unembed', md: '**The unembedding** is a linear classifier, exactly CS231n\'s ([linear classifiers](#/linear-classification)): one score per vocabulary entry, tens of thousands of classes instead of ten.' },
  loss: { label: 'softmax + cross-entropy', old: true, line: 'loss', md: '**Softmax cross-entropy**, from CS231n ([the Softmax classifier](#/linear-classification/softmax)). Pretraining is this loss at every position of every document, with the next token as the label (Eq 0.2).' },
  back: { label: 'backprop', old: true, line: 'back', md: '**Backpropagation**, from CS231n ([backpropagation](#/backprop)). Frameworks do it for you now, but it is the same chain rule run backward through the same kinds of nodes.' },
  opt: { label: 'AdamW or Muon step', old: true, line: 'step', md: '**The update**, from CS231n: Adam ([parameter updates](#/nn-learning/updates)), now with weight decay decoupled from the gradient (AdamW, 2017), warmup and cosine schedules, gradient clipping, and lately Muon for weight matrices ([Chapter 7](#/optimizers)).' },
};
const LAYOUT: string[][] = [['init'], ['tok'], ['embed', 'pos'], ['norm1', 'attn', 'res1'], ['norm2', 'mlp', 'res2'], ['unembed'], ['loss'], ['back'], ['opt']];

export function figCarried(p: Page): void {
  p.figure({
    title: 'A 2026 training step, colored by age',
    codeTitle: 'train_step.py',
    code: `
      model = GPT(vocab, d, n_layers)  # random  #@init
      opt = AdamW(model.parameters(), lr=3e-4)  #@step
      for ids, targets in loader:  # token ids  #@tok
          h = embed[ids]  # (T, d)  #@embed
          for blk in blocks:  # N blocks
              h = h + blk.attn(blk.norm1(h))  #@attn
              h = h + blk.mlp(blk.norm2(h))  #@mlp
          logits = norm(h) @ unembed  #@unembed
          loss = cross_entropy(logits, targets)  #@loss
          loss.backward()  # backprop  #@back
          opt.step()  #@step
          opt.zero_grad()  #@step
    `,
    setup(f) {
      let sel = 'attn';
      let boxes: { x: number; y: number; w: number; h: number; id: string }[] = [];
      const BH = 30;
      const GAP = 14;
      const cv = f.canvas(520, 560, (ctx, w, h) => {
        const top = 40;
        const FT = 24;
        const FB = 10;
        // Row tops: the two block rows sit inside a frame with room for its label.
        const ys: number[] = [];
        let y = top;
        LAYOUT.forEach((_, ri) => {
          if (ri === 3) y += FT;
          ys.push(y);
          y += BH + (ri === 4 ? FB + GAP : GAP);
        });
        const need = y - GAP + 6;
        if (fitHeight(cv.canvas, w, h, need)) return;
        const lw0 = chip(ctx, 'from CS231n', 8, 16, 'blue', { size: 11, h: 21 });
        chip(ctx, 'new since 2016', 8 + lw0 + 6, 16, 'orange', { size: 11, h: 21 });
        const colW = Math.min(w - 44, 400);
        const x0 = (w - colW) / 2 - 8;
        const fy0 = ys[3]! - FT + 4;
        const fy1 = ys[4]! + BH + FB;
        ctx.save();
        ctx.setLineDash([4, 3]);
        rbox(ctx, x0, fy0, colW, fy1 - fy0, 9, null, color('--ink-3'), 1);
        ctx.restore();
        text(ctx, 'block, repeated N times', x0 + 10, fy0 + 11, { size: 11, font: 'mono', align: 'left', color: color('--ink-2') });
        const ax = x0 + colW / 2;
        for (let ri = 0; ri < LAYOUT.length - 1; ri++) {
          const yb = ys[ri]! + BH + 2;
          const yt = ys[ri + 1]! - 2;
          if (ri === 2) arrow(ctx, ax, yb, ax, fy0 - 1, color('--ink-3'), 1.2, 6);
          else if (ri === 4) arrow(ctx, ax, fy1 + 1, ax, yt, color('--ink-3'), 1.2, 6);
          else arrow(ctx, ax, yb, ax, yt, color('--ink-3'), 1.2, 6);
        }
        boxes = [];
        LAYOUT.forEach((row, ri) => {
          const inBlock = ri === 3 || ri === 4;
          const pad = inBlock ? 10 : 0;
          const rowW = colW - 2 * pad;
          const weights = row.map((id) => (id.startsWith('res') ? 1.15 : id.startsWith('norm') ? 0.85 : id === 'pos' ? 1 : 1.6));
          const tot = weights.reduce((a, b) => a + b, 0);
          const gap = inBlock ? 14 : 8;
          let bx = x0 + pad;
          row.forEach((id, k) => {
            const bw = ((rowW - gap * (row.length - 1)) * weights[k]!) / tot;
            const part = P[id]!;
            const k2: Color = part.old ? 'blue' : 'orange';
            const on = id === sel;
            rbox(ctx, bx, ys[ri]!, bw, BH, 7, withAlpha(color(k2), on ? 0.32 : 0.13), withAlpha(color(k2), on ? 1 : 0.55), on ? 2 : 1);
            const size = measure(ctx, part.label, { size: 12, weight: 600 }) > bw - 8 ? 11 : 12;
            text(ctx, part.label, bx + bw / 2, ys[ri]! + BH / 2 + 0.5, { size, weight: 600, color: color('--ink') });
            boxes.push({ x: bx, y: ys[ri]!, w: bw, h: BH, id });
            if (inBlock && k < row.length - 1) arrow(ctx, bx + bw + 2, ys[ri]! + BH / 2, bx + bw + gap - 2, ys[ri]! + BH / 2, color('--ink-3'), 1.2, 5);
            bx += bw + gap;
          });
        });
        // Backprop runs the same path in reverse.
        const ux = x0 + colW + 12;
        const yBack = ys[7]! + BH / 2;
        line(ctx, x0 + colW + 2, yBack, ux, yBack, withAlpha(color('blue'), 0.6), 1.4);
        arrow(ctx, ux, yBack, ux, ys[2]! + BH / 2, withAlpha(color('blue'), 0.6), 1.4, 7);
        arrow(ctx, ux, ys[2]! + BH / 2, x0 + colW + 3, ys[2]! + BH / 2, withAlpha(color('blue'), 0.6), 1.4, 6);
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        f.code.highlight(P[sel]!.line);
        f.status(P[sel]!.md);
        cv.redraw();
      };
      cv.canvas.addEventListener('pointerdown', (e) => {
        const rc = cv.canvas.getBoundingClientRect();
        const px = e.clientX - rc.left;
        const py = e.clientY - rc.top;
        const hit = boxes.find((b) => px >= b.x && px <= b.x + b.w && py >= b.y - 3 && py <= b.y + b.h + 3);
        if (hit) {
          sel = hit.id;
          sync();
        }
      });
      sync();
    },
    caption: `One step of training a language model today, top to bottom. **Tap any box** to light its line and see where it comes from. Nine of the twelve pieces are things CS231n taught in 2016; the three orange ones (tokens, positions and attention) are what the first part of this course adds. The thin arrow on the right is backpropagation, running the same path in reverse.`,
  });
}
