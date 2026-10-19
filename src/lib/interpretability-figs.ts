// Figures on the trained induction model: logit lens, circuits, the induction head, the phase change.
import { fmt } from '../core/code';
import type { Page } from '../core/page';
import { color, withAlpha } from '../core/plot';
import { CKPT_STEPS, CURVES } from './interpretability-induction-data';
import {
  HALF,
  LETTERS,
  type Mat,
  type Trace,
  V,
  type Weights,
  finalWeights,
  forward,
  lens,
  loadCheckpoints,
  makeSequence,
  ovTokens,
  qkComposed,
  qkPositions,
  softmaxVec,
} from './interpretability-model';
import { arrow, cellPos, curve, drawStrip, fitHeight, heat, line, measure, num, rbox, signed, stripHit, stripLayout, text } from './interpretability-draw';

const pct = (p: number): string => `${Math.round(p * 100)}%`;
const argmax = (v: ArrayLike<number>): number => {
  let b = 0;
  for (let i = 1; i < v.length; i++) if (v[i]! > v[b]!) b = i;
  return b;
};
const H0 = 'teal';
const H1 = 'purple';

/* ------------------------------------------------------------------ */
/* Fig: the logit lens                                                  */
/* ------------------------------------------------------------------ */

export function figLens(p: Page): void {
  p.figure({
    title: 'Reading the residual stream with the unembedding',
    codeTitle: 'logit_lens.py',
    code: `
      ids = letters + letters    # 24 letters  #@seq
      x0 = E[ids] + P[:24]       # embed       #@x0
      x1 = x0 + head(0, x0)      # + head 0    #@x1
      x2 = x1 + head(1, x1)      # + head 1    #@x2
      logits = x2 @ W_U          # the output  #@x2

      i = {{i:17}}   # at {{tok:F}}; next is {{nxt:Q}}
      for x in (x0, x1, x2):     # logit lens  #@lens
          p = softmax(x[i] @ W_U)              #@lens
      # p[{{nxt2:Q}}]: {{p0}}, {{p1}}, {{p2}}
    `,
    setup(f) {
      const w = finalWeights();
      let seed = 4;
      let repeat = true;
      let sel = 17;
      let ids: number[] = [];
      let tr: Trace | null = null;
      let strip = stripLayout(640, 24, HALF);
      const STAGES: { name: string; sub: string; k: 'orange' }[] = [
        { name: 'x₀', sub: 'embedding', k: 'orange' },
        { name: 'x₁', sub: '+ head 0', k: 'orange' },
        { name: 'x₂', sub: '+ head 1 (the output)', k: 'orange' },
      ];
      const cv = f.canvas(640, 420, (ctx, W, Hh) => {
        if (!tr) return;
        strip = stripLayout(W, 22, HALF);
        strip.gap = 24;
        const barH = 34;
        const rowH = 18 + barH + 16 + 10;
        const top2 = strip.y0 + 2 * strip.ch + strip.gap + 18;
        const need = top2 + 3 * rowH + (W < 470 ? 50 : 34);
        if (fitHeight(cv.canvas, W, Hh, need)) return;
        text(ctx, 'tap a letter: what the stream says comes next', 4, 9, { size: 11, align: 'left', color: color('--ink-3') });
        text(ctx, repeat ? 'the same letters again' : 'fresh random letters', strip.x0, strip.y0 + strip.ch + strip.gap / 2 + 1, { size: 10.5, align: 'left', color: color('--ink-3') });
        const nxt = sel + 1 < ids.length ? sel + 1 : -1;
        drawStrip(ctx, strip, ids, (i) => ({ a: i === sel ? 0.55 : i === nxt ? 0.3 : 0.05, ring: i === sel ? color('teal') : i === nxt ? color('gold') : undefined, k: i === nxt ? 'gold' : 'orange' }));
        const target = nxt >= 0 ? ids[nxt]! : -1;
        const parts: number[] = [];
        [tr.x0, tr.x1, tr.x2].forEach((x, s) => {
          const lg = lens(w, x, sel);
          if (target >= 0) parts.push(s === 0 ? lg[target]! : lg[target]! - parts.reduce((a, b) => a + b, 0));
          const pr = softmaxVec(lg);
          const y = top2 + s * rowH;
          const st = STAGES[s]!;
          text(ctx, st.name, 4, y + 8, { font: 'sans', italic: true, weight: 700, size: 14, align: 'left', color: color('orange') });
          text(ctx, st.sub, 26, y + 8, { size: 11.5, align: 'left', color: color('--ink-2') });
          const best = argmax(pr);
          const msg = target >= 0 ? `top ${LETTERS[best]} ${pct(pr[best]!)} · ${LETTERS[target]} ${pct(pr[target]!)}` : `top ${LETTERS[best]} ${pct(pr[best]!)}`;
          text(ctx, msg, W - 4, y + 8, { font: 'mono', size: 11, align: 'right', color: color('--ink-2') });
          const bw = (W - 8) / V;
          const by = y + 18;
          for (let t = 0; t < V; t++) {
            const bx = 4 + t * bw;
            const hh = Math.max(1, barH * pr[t]!);
            const k = t === target ? 'gold' : 'teal';
            rbox(ctx, bx + bw * 0.15, by + barH - hh, bw * 0.7, hh, 2, withAlpha(color(k), t === target ? 0.85 : 0.55), null);
            text(ctx, LETTERS[t]!, bx + bw / 2, by + barH + 8, { font: 'mono', size: 11, weight: t === target ? 700 : 400, color: t === target ? color('gold') : color('--ink-3') });
          }
          line(ctx, 4, by + barH + 0.5, W - 4, by + barH + 0.5, color('--axis'));
        });
        if (target >= 0) {
          const y = top2 + 3 * rowH + 10;
          const tot = parts.reduce((a, b) => a + b, 0);
          const segs = [`logit of ${LETTERS[target]} =`, `${num(parts[0]!, 1)} (embed)`, `${parts[1]! < 0 ? '−' : '+'} ${num(Math.abs(parts[1]!), 1)} (head 0)`, `${parts[2]! < 0 ? '−' : '+'} ${num(Math.abs(parts[2]!), 1)} (head 1)`, `= ${num(tot, 1)}`];
          const size = W < 440 ? 10.5 : 11.5;
          const width = (ss: string[]) => ss.reduce((a, s) => a + measure(ctx, s, { font: 'mono', size }) + 7, -7);
          const lines = width(segs) <= W - 8 ? [segs.map((s, k) => [s, k] as const)] : [segs.slice(0, 3).map((s, k) => [s, k] as const), segs.slice(3).map((s, k) => [s, k + 3] as const)];
          lines.forEach((ln, r) => {
            let x = Math.max(4, (W - width(ln.map((q) => q[0]))) / 2);
            ln.forEach(([s, k]) => {
              text(ctx, s, x, y + r * 16, { font: 'mono', size, align: 'left', weight: k === 3 ? 700 : 400, color: k === 3 ? color(H1) : color('--ink-2') });
              x += measure(ctx, s, { font: 'mono', size }) + 7;
            });
          });
          text(ctx, 'the output is the sum of what each part wrote', W / 2, y + 16 * lines.length + 2, { size: 10.5, italic: true, color: color('--ink-3') });
        }
      });
      cv.canvas.classList.add('scroll-ok');
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const i = stripHit(strip, ids.length, e.clientX - r.left, e.clientY - r.top);
        if (i >= 0 && i < ids.length - 1) {
          sel = i;
          f.code.highlight('lens');
          sync();
        }
      });
      const sync = () => {
        const nxt = ids[sel + 1]!;
        const pr = [tr!.x0, tr!.x1, tr!.x2].map((x) => softmaxVec(lens(w, x, sel))[nxt]!);
        f.code.setMany({ i: sel, tok: LETTERS[ids[sel]!]!, nxt: LETTERS[nxt]!, nxt2: LETTERS[nxt]!, p0: pr[0]!.toFixed(2), p1: pr[1]!.toFixed(2), p2: pr[2]!.toFixed(2) });
        cv.redraw();
      };
      const run = () => {
        ids = makeSequence(seed, repeat);
        tr = forward(w, ids);
        sync();
      };
      f.button('New letters', () => {
        seed++;
        f.code.highlight('seq');
        run();
      }, { primary: true, icon: 'shuffle' });
      f.segmented({
        label: 'second row',
        options: [
          { value: 'repeat', label: 'repeat' },
          { value: 'random', label: 'random' },
        ],
        value: 'repeat',
        onChange: (v) => {
          repeat = v === 'repeat';
          run();
        },
      });
      run();
    },
    caption: `The top two rows are the input: 12 random letters, then the same 12 again, laid out so each repeat sits under its first copy. **Tap a letter** (teal) to read the residual stream at that position; the gold letter is what actually comes next. Each bar chart decodes one partial sum of the stream with the unembedding $\\symU$: after the embedding alone, after head 0 has added its output, and after head 1, which is the model's real prediction. In the second row the answer jumps from about 5% (a blind guess among 20 letters) to near certainty only at the last step: head 1 wrote it. Head 0's write does not decode to anything useful; it is a message for head 1, not for the output. The bottom line splits the answer's logit into the three pieces that add up to it. Switch the second row to **random** and the model has nothing to copy.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: QK and OV circuits                                              */
/* ------------------------------------------------------------------ */

type CircuitMode = 'qk0' | 'qk1' | 'ov1';

export function figCircuits(p: Page): void {
  p.figure({
    title: 'Reading the circuits straight from the weights',
    codeTitle: 'circuits.py',
    code: `
      W_QK0 = Wq[0] @ Wk[0].T    # (32, 32)
      W_OV0 = Wv[0] @ Wo[0]
      W_QK1 = Wq[1] @ Wk[1].T
      W_OV1 = Wv[1] @ Wo[1]

      # head 0, positions only: where i looks
      pos = softmax(P @ W_QK0 @ P.T / 4)   #@qk0
      # head 1: query letter a against a key
      # whose previous letter, written by
      # head 0, is b
      tok = E @ W_QK1 @ (E @ W_OV0).T / 4  #@qk1
      # head 1: attend to letter a, logits move
      ov = E @ W_OV1 @ W_U                 #@ov1
      # {{mode:head 1 OV}}: row {{row:F}}, max at {{col:F}}
    `,
    setup(f) {
      const w = finalWeights();
      const M: Record<CircuitMode, Mat> = { qk0: qkPositions(w, 24), qk1: qkComposed(w), ov1: ovTokens(w, 1) };
      const INFO: Record<CircuitMode, { title: string; rows: string; cols: string; name: string }> = {
        qk0: { title: 'head 0, QK on positions: attention from position i to j', rows: 'query position i', cols: 'key position j', name: 'head 0 QK' },
        qk1: { title: 'head 1, QK through head 0: score of query a, key after b', rows: 'query letter a', cols: 'previous letter b at the key', name: 'head 1 QK' },
        ov1: { title: 'head 1, OV: attending to letter a raises the logit of', rows: 'attended letter a', cols: 'logit of letter', name: 'head 1 OV' },
      };
      let mode: CircuitMode = 'ov1';
      let sel = 5;
      let geo = { x: 0, y: 0, cs: 1, n: 1 };
      const cv = f.canvas(640, 470, (ctx, W, Hh) => {
        const m = M[mode];
        const n = m.r;
        const lab = 26;
        const cs = Math.max(8, Math.min(19, (W - lab - 30) / n));
        const gx = Math.max(lab + 20, (W - n * cs) / 2 + 8);
        const gy = 58;
        const need = gy + n * cs + 40;
        if (fitHeight(cv.canvas, W, Hh, need)) return;
        geo = { x: gx, y: gy, cs, n };
        const info = INFO[mode];
        text(ctx, info.title, W / 2, 10, { size: W < 440 ? 11 : 12, weight: 600, color: color('--ink') });
        text(ctx, `${info.cols} →`, gx, gy - 24, { size: 10.5, align: 'left', color: color('--ink-3') });
        ctx.save();
        ctx.translate(gx - lab - 10, gy + (n * cs) / 2);
        ctx.rotate(-Math.PI / 2);
        text(ctx, `← ${info.rows}`, 0, 0, { size: 10.5, color: color('--ink-3') });
        ctx.restore();
        const lbl = (i: number) => (mode === 'qk0' ? String(i) : LETTERS[i]!);
        const every = mode === 'qk0' ? 4 : 1;
        for (let j = 0; j < n; j += every) text(ctx, lbl(j), gx + j * cs + cs / 2, gy - 9, { font: 'mono', size: 10.5, color: color('--ink-3') });
        for (let i = 0; i < n; i += every) text(ctx, lbl(i), gx - 5, gy + i * cs + cs / 2, { font: 'mono', size: 10.5, align: 'right', weight: i === sel ? 700 : 400, color: i === sel ? color('--ink') : color('--ink-3') });
        if (mode === 'qk0') {
          heat(ctx, gx, gy, cs, m, (v) => withAlpha(color(H0), 0.04 + 0.9 * v), true);
        } else {
          let range = 0;
          for (const v of m.a) range = Math.max(range, Math.abs(v));
          heat(ctx, gx, gy, cs, m, (v) => signed(v, range * 0.8, mode === 'qk1' ? 'blue' : 'gold'));
        }
        rbox(ctx, gx - 1, gy + sel * cs - 1, n * cs + 2, cs + 2, 3, null, color('--ink'), 1.6);
        const rowv = Array.from({ length: mode === 'qk0' ? sel + 1 : n }, (_, j) => m.a[sel * n + j]!);
        const best = argmax(rowv);
        rbox(ctx, gx + best * cs - 1, gy + sel * cs - 1, cs + 2, cs + 2, 3, null, color('red'), 2);
        const avg = rowv.reduce((a, b) => a + b, 0) / rowv.length;
        const msg =
          mode === 'qk0'
            ? `position ${sel} puts ${pct(rowv[best]!)} on position ${best}${best === sel - 1 ? ', the one before it' : ''}`
            : mode === 'qk1'
              ? `query ${LETTERS[sel]}: score ${num(rowv[best]!, 1)} for keys after ${LETTERS[best]} (row average ${num(avg, 1)})`
              : `attending to ${LETTERS[sel]} adds ${num(rowv[best]!, 1)} to the logit of ${LETTERS[best]} (row average ${num(avg, 1)})`;
        text(ctx, msg, W / 2, gy + n * cs + 18, { size: W < 440 ? 10.5 : 11.5, color: color('--ink-2') });
        f.code.setMany({ mode: info.name, row: lbl(sel), col: lbl(best) });
      });
      cv.canvas.classList.add('scroll-ok');
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const i = Math.floor((e.clientY - r.top - geo.y) / geo.cs);
        if (i >= 0 && i < geo.n) {
          sel = i;
          cv.redraw();
        }
      });
      f.segmented({
        label: 'circuit',
        options: [
          { value: 'qk0', label: 'head 0 · QK' },
          { value: 'qk1', label: 'head 1 · QK' },
          { value: 'ov1', label: 'head 1 · OV' },
        ],
        value: 'ov1',
        onChange: (v) => {
          mode = v as CircuitMode;
          sel = mode === 'qk0' ? 9 : 5;
          f.code.highlight(mode);
          cv.redraw();
        },
      });
      f.code.highlight('ov1');
    },
    caption: `Three products of weight matrices, computed from the trained model with no input at all. **Head 0 · QK** keeps only the position part of head 0's queries and keys: every row puts nearly all its weight one step to the left of the diagonal, so head 0 is a *previous-token head*. **Head 1 · QK** asks how strongly a query letter $a$ matches a key position whose previous letter was $b$, reading the key through what head 0 wrote there: the bright diagonal says "look for the place right after an earlier copy of me." **Head 1 · OV** asks what head 1 writes when it attends to letter $a$: a bright diagonal, so it raises the logit of the very letter it looked at. It *copies*. Tap a row to read it.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: the induction head at work                                      */
/* ------------------------------------------------------------------ */

function attnGrid(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, A: Mat, k: 'teal' | 'purple', sel = -1): void {
  heat(ctx, x, y, cs, A, (v) => withAlpha(color(k), 0.03 + 0.92 * Math.min(1, v)), true);
  if (sel >= 0) rbox(ctx, x - 1, y + sel * cs - 1, (sel + 1) * cs + 2, cs + 2, 2, null, color('--ink'), 1.4);
  ctx.strokeStyle = withAlpha(color('--ink-3'), 0.6);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x, y + HALF * cs);
  ctx.lineTo(x + HALF * cs, y + HALF * cs);
  ctx.moveTo(x + HALF * cs, y + HALF * cs);
  ctx.lineTo(x + HALF * cs, y + A.r * cs);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function figInduction(p: Page): void {
  p.figure({
    title: 'An induction head on repeated random letters',
    codeTitle: 'induction.py',
    code: `
      ids = letters + letters   # 12 random, twice  #@seq
      A0, A1 = model.attention(ids)  # (24, 24)   #@seq
      i = {{i:17}}             # the query: {{tok:F}}
      j = A1[i].argmax()      # head 1 reads {{j:6}}: {{jt:Q}}  #@ind
      A0[j].argmax()          # {{j0:5}}: head 0 saw {{j0t:F}}  #@prev
      p = softmax(logits[i])  # {{pred:Q}}: {{pp:0.97}}     #@pred
      rep = range(12, 24)     # the repeat           #@score
      score = np.mean([A1[i, i - 11] for i in rep])  #@score
      # induction score here: {{score}}
    `,
    setup(f) {
      const w = finalWeights();
      let seed = 4;
      let repeat = true;
      let sel = 17;
      let head: 0 | 1 = 1;
      let ids: number[] = [];
      let tr: Trace | null = null;
      let strip = stripLayout(640, 30, HALF);
      let grid = { x: 0, y: 0, cs: 1 };
      const cv = f.canvas(640, 560, (ctx, W, Hh) => {
        if (!tr) return;
        strip = stripLayout(W, 30, HALF);
        strip.gap = 34;
        const sTop = strip.y0 + 2 * strip.ch + strip.gap + 34;
        const cs = Math.max(8, Math.min(16, (W - 60) / ids.length));
        const gx = (W - ids.length * cs) / 2 + 10;
        const gy = sTop + 28;
        grid = { x: gx, y: gy, cs };
        const need = gy + ids.length * cs + 16;
        if (fitHeight(cv.canvas, W, Hh, need)) return;
        const A1 = tr.A[1]!;
        const A0 = tr.A[0]!;
        const j = argmax(A1.a.subarray(sel * A1.c, sel * A1.c + sel + 1));
        const nxt = sel + 1 < ids.length ? sel + 1 : -1;
        // Head 1's attention from the query, as lines to every key.
        const q = cellPos(strip, sel);
        for (let k = 0; k <= sel; k++) {
          const a = A1.a[sel * A1.c + k]!;
          if (a < 0.03 || k === sel) continue;
          const c = cellPos(strip, k);
          const sameRow = (k < HALF) === (sel < HALF);
          if (sameRow) curve(ctx, q.cx, q.y, c.cx, c.y, (c.cx - q.cx) * 0.35, withAlpha(color(H1), 0.15 + 0.85 * a), 1 + 5 * a);
          else line(ctx, q.cx, q.y, c.cx, c.y + strip.ch, withAlpha(color(H1), 0.15 + 0.85 * a), 1 + 5 * a);
        }
        // Head 0 at that key: which letter it read.
        if (j > 0) {
          const kc = cellPos(strip, j);
          const pc = cellPos(strip, argmax(A0.a.subarray(j * A0.c, j * A0.c + j + 1)));
          if (kc.y === pc.y) {
            curve(ctx, kc.cx, kc.y - 1, pc.cx + 3, pc.y - 1, (kc.cx - pc.cx) * 0.55, color(H0), 2, 6);
            text(ctx, 'head 0', (kc.cx + pc.cx) / 2 + strip.cw * 0.9, kc.y - 9, { size: 10.5, weight: 600, align: 'left', color: color(H0), halo: true });
          }
        }
        drawStrip(ctx, strip, ids, (i) => ({ a: i === sel ? 0.55 : i === j ? 0.45 : 0.05, ring: i === sel ? color('--ink') : i === j ? color(H1) : undefined, k: i === j ? 'purple' : 'orange' }));
        text(ctx, 'tap a letter: the query', 4, 9, { size: 11, align: 'left', color: color('--ink-3') });
        text(ctx, repeat ? 'the same letters again' : 'fresh random letters', strip.x0, strip.y0 + strip.ch + strip.gap / 2 + 4, { size: 10.5, align: 'left', color: color('--ink-3') });
        const pr = softmaxVec(tr.logits.a.subarray(sel * V, sel * V + V));
        const best = argmax(pr);
        const ok = nxt >= 0 && ids[nxt] === best;
        const ly = strip.y0 + 2 * strip.ch + strip.gap + 14;
        text(ctx, `after ${LETTERS[ids[sel]!]}: predicts ${LETTERS[best]} (${pct(pr[best]!)})${nxt >= 0 ? (ok ? ', right' : `, the answer is ${LETTERS[ids[nxt]!]}`) : ''}`, W / 2, ly, { size: 12, weight: 600, color: ok ? color('green') : color('--ink-2') });
        // The attention grid of one head.
        const A = tr.A[head]!;
        text(ctx, head === 1 ? 'head 1: rows look at the letter after an earlier copy' : 'head 0: rows look at the letter just before', W / 2, gy - 14, { size: 11, color: color(head === 1 ? H1 : H0), weight: 600 });
        attnGrid(ctx, gx, gy, cs, A, head === 1 ? 'purple' : 'teal', sel);
        for (let r = 0; r < ids.length; r += 1) text(ctx, LETTERS[ids[r]!]!, gx - 5, gy + r * cs + cs / 2, { font: 'mono', size: cs < 11 ? 9.5 : 10.5, align: 'right', weight: r === sel ? 700 : 400, color: r === sel ? color('--ink') : color('--ink-3') });
      });
      cv.canvas.classList.add('scroll-ok');
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        let i = stripHit(strip, ids.length, px, py);
        if (i < 0 && px >= grid.x - 30 && py >= grid.y) {
          const k = Math.floor((py - grid.y) / grid.cs);
          if (k >= 0 && k < ids.length) i = k;
        }
        if (i >= 1) {
          sel = i;
          f.code.highlight(['ind', 'prev', 'pred']);
          sync();
        }
      });
      const sync = () => {
        const A1 = tr!.A[1]!;
        const A0 = tr!.A[0]!;
        const j = argmax(A1.a.subarray(sel * A1.c, sel * A1.c + sel + 1));
        const j0 = argmax(A0.a.subarray(j * A0.c, j * A0.c + j + 1));
        const pr = softmaxVec(tr!.logits.a.subarray(sel * V, sel * V + V));
        const best = argmax(pr);
        let sc = 0;
        for (let i = HALF; i < ids.length; i++) sc += A1.a[i * A1.c + i - HALF + 1]!;
        f.code.setMany({ i: sel, tok: LETTERS[ids[sel]!]!, j, jt: LETTERS[ids[j]!]!, j0, j0t: LETTERS[ids[j0]!]!, pred: LETTERS[best]!, pp: fmt(pr[best]!, 2), score: fmt(sc / HALF, 2) });
        cv.redraw();
      };
      const run = () => {
        ids = makeSequence(seed, repeat);
        tr = forward(w, ids);
        sync();
      };
      f.button('New letters', () => {
        seed++;
        f.code.highlight(['seq', 'score']);
        run();
      }, { primary: true, icon: 'shuffle' });
      f.segmented({
        label: 'second row',
        options: [
          { value: 'repeat', label: 'repeat' },
          { value: 'random', label: 'random' },
        ],
        value: 'repeat',
        onChange: (v) => {
          repeat = v === 'repeat';
          f.code.highlight('score');
          run();
        },
      });
      f.segmented({
        label: 'grid',
        options: [
          { value: '0', label: 'head 0' },
          { value: '1', label: 'head 1' },
        ],
        value: '1',
        onChange: (v) => {
          head = v === '1' ? 1 : 0;
          cv.redraw();
        },
      });
      run();
    },
    caption: `**Tap a letter in the second row.** Purple lines are head 1's attention from that letter (the query): nearly all of it lands on the letter *after* the earlier copy of the query, which is exactly the letter that comes next. The teal arrow shows why that position was findable: head 0, at that position, attended to the letter before it, so the position carries "my previous letter was F." The grid below shows a whole attention matrix at once, a row per query; the dashed lines split the two halves. Head 1's grid has the signature of an induction head: a stripe in the lower-left block, one step right of where the repeat started. Switch the grid to head 0 for its stripe just below the diagonal. With a **random** second row there is nothing to match, and head 1 falls back on scattered guesses.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: the phase change                                                */
/* ------------------------------------------------------------------ */

const sx = (s: number): number => Math.sqrt(s);

export function figPhase(p: Page): void {
  p.figure({
    title: 'The phase change: a head forms, and the loss falls off a cliff',
    codeTitle: 'train.py',
    code: `
      for step in range(4000):                   #@train
          ids = periodic_letters(64, 32)         #@train
          loss = xent(model(ids), ids[:, 1:])    #@train
          loss.backward(); opt.step()  # Adam    #@train
          if step not in checkpoints:
              continue
          A0, A1 = model.attention(eval_ids)     #@eval
          prev = A0[i, i - 1].mean()   # {{prev}}  #@scores
          ind = A1[i, i - 11].mean()   # {{ind}}  #@scores
          rep = nll[12:].mean()        # {{rep}}  #@loss
          first = nll[:11].mean()      # {{first}}  #@loss
      # checkpoint: step {{step:4000}}
    `,
    setup(f) {
      let k = CKPT_STEPS.length - 1;
      let ck: Weights[] | null = null;
      const ids = makeSequence(9);
      const xmax = sx(4000);
      const curveAt = (step: number) => {
        const idx = CURVES.step.indexOf(step);
        return { rep: CURVES.rep[idx]!, first: CURVES.first[idx]!, ind: CURVES.ind[idx]!, prev: CURVES.prev[idx]! };
      };
      const ticks = [0, 250, 500, 1000, 2000, 4000];
      const xs = CURVES.step.map(sx);
      const marker = (pl: { sx(x: number): number; ctx: CanvasRenderingContext2D; h: number }) => {
        const x = pl.sx(sx(CKPT_STEPS[k]!));
        line(pl.ctx, x, 4, x, pl.h - 18, withAlpha(color('--ink'), 0.5), 1.2, [4, 3]);
      };
      const lossPlot = f.plot({
        aspect: 2.6,
        square: false,
        domain: [-5, xmax + 1.5, -0.75, 4.3],
        draw: (pl) => {
          pl.axes({ grid: 0 });
          for (const v of [1, 2, 3, 4]) pl.text(String(v), -0.4, v, { size: 10.5, mono: true, align: 'right', base: 'middle', color: color('--ink-3') });
          for (const t of ticks) pl.text(String(t), sx(t), -0.45, { size: 10.5, mono: true, align: t === 4000 ? 'right' : 'center', base: 'middle', color: color('--ink-3') });
          pl.path([0, xmax], [Math.log(V), Math.log(V)], withAlpha(color('--ink-3'), 0.7), 1, [2, 4]);
          pl.text('blind guess, ln 20', xmax, Math.log(V) - 0.5, { size: 10.5, align: 'right', color: color('--ink-3') });
          pl.path(xs, CURVES.first, withAlpha(color('red'), 0.55), 1.8, [6, 4]);
          pl.path(xs, CURVES.rep, color('red'), 2.4);
          marker(pl);
          pl.text('loss on the first 12 (dashed) and on the repeat', 1, 4.05, { size: 11, align: 'left', color: color('red') });
        },
      });
      const scorePlot = f.plot({
        aspect: 2.9,
        square: false,
        domain: [-5, xmax + 1.5, -0.2, 1.08],
        draw: (pl) => {
          pl.axes({ grid: 0 });
          for (const v of [0.5, 1]) pl.text(String(v), -0.4, v, { size: 10.5, mono: true, align: 'right', base: 'middle', color: color('--ink-3') });
          for (const t of ticks) pl.text(String(t), sx(t), -0.12, { size: 10.5, mono: true, align: t === 4000 ? 'right' : 'center', base: 'middle', color: color('--ink-3') });
          pl.path(xs, CURVES.prev, color(H0), 2.2);
          pl.path(xs, CURVES.ind, color(H1), 2.4);
          marker(pl);
          pl.text('induction score (head 1)', 1, 1.0, { size: 11, align: 'left', color: color(H1) });
          pl.text('previous-token score (head 0)', 1, 0.86, { size: 11, align: 'left', color: color(H0) });
          pl.text('step (square-root scale)', xmax, 0.1, { size: 10.5, align: 'right', color: color('--ink-3') });
        },
      });
      const grids = f.canvas(640, 260, (ctx, W, Hh) => {
        const gap = 22;
        const cs = Math.max(5, Math.min(10, (W - gap - 8) / (2 * ids.length)));
        const gw = cs * ids.length;
        const need = 24 + gw + 8;
        if (fitHeight(grids.canvas, W, Hh, need)) return;
        const x0 = (W - 2 * gw - gap) / 2;
        if (!ck) {
          text(ctx, 'loading the checkpoints…', W / 2, need / 2, { size: 12, color: color('--ink-3') });
          return;
        }
        const tr = forward(ck[k]!, ids);
        let pv = 0;
        for (let i = 1; i < ids.length; i++) pv += tr.A[0]!.a[i * ids.length + i - 1]!;
        let iv = 0;
        for (let i = HALF; i < ids.length; i++) iv += tr.A[1]!.a[i * ids.length + i - HALF + 1]!;
        [0, 1].forEach((h) => {
          const gx = x0 + h * (gw + gap);
          text(ctx, h === 0 ? `head 0 · prev ${num(pv / (ids.length - 1))}` : `head 1 · induction ${num(iv / HALF)}`, gx + gw / 2, 10, { size: 11, weight: 600, color: color(h === 0 ? H0 : H1) });
          attnGrid(ctx, gx, 24, cs, tr.A[h]!, h === 0 ? 'teal' : 'purple');
        });
      });
      grids.canvas.classList.add('scroll-ok');
      const rd = [lossPlot, scorePlot];
      const pick = (e: PointerEvent, pl: typeof lossPlot) => {
        const [x] = pl.pointer(e);
        let best = 0;
        CKPT_STEPS.forEach((s, i) => Math.abs(sx(s) - x) < Math.abs(sx(CKPT_STEPS[best]!) - x) && (best = i));
        stepper.go(best);
      };
      rd.forEach((pl) => {
        pl.canvas.classList.add('scroll-ok');
        pl.canvas.addEventListener('pointerdown', (e) => pick(e, pl));
      });
      const stepper = f.stepper({
        steps: CKPT_STEPS.length,
        interval: 650,
        label: (i) => `step ${CKPT_STEPS[i]}`,
        onStep: (i) => {
          k = i;
          const c = curveAt(CKPT_STEPS[i]!);
          f.code.setMany({ step: CKPT_STEPS[i]!, prev: fmt(c.prev, 2), ind: fmt(c.ind, 2), rep: fmt(c.rep, 2), first: fmt(c.first, 2) });
          f.code.highlight(['eval', 'scores', 'loss']);
          rd.forEach((pl) => pl.redraw());
          grids.redraw();
        },
      });
      queueMicrotask(() => stepper.go(CKPT_STEPS.length - 1));
      loadCheckpoints()
        .then((c) => {
          ck = c;
          grids.redraw();
        })
        .catch((e) => f.status(`Could not load the checkpoints: ${(e as Error).message}`));
    },
    caption: `The same model during training, measured on 256 sequences of 12 random letters repeated once. **Top**: the loss on the repeat (solid) creeps down slowly for about 500 steps (the model learns that letters it has already seen are likelier), then falls from about 2.6 to under 1 within a few hundred steps. **Middle**: in the same window head 1's induction score jumps from near 0 to about 0.75, while head 0 keeps sharpening into a previous-token head over a longer stretch. **Bottom**: both heads' attention on one sequence, recomputed from the checkpoint you pick. Press play, or tap a plot to jump. Notice the dashed curve: once the model expects repeats, its loss on the first 12 letters gets *worse* than a blind guess, because it now bets on letters it has seen. (The x axis is stretched toward the start, a square-root scale, so the early steps get room.)`,
  });
}
