import type { Page } from '../core/page';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { comb, commas } from './moe-math';
import { dashLine, ek, phoneAspect, rbox, txt } from './moe-figs';

/* ------------------------------------------------------------------ */
/* capacity: fixed-size buffers and dropped tokens                      */
/* ------------------------------------------------------------------ */

export const CAP_T = 32;
export const CAP_E = 4;
const CAP_U: number[] = (() => {
  const r = new Rng(21);
  return Array.from({ length: CAP_T }, () => r.next());
})();

/** Top-1 choices for the capacity demo: skew 0 is uniform routing, skew 1 favors expert 0 heavily. */
export function capChoices(skew: number): number[] {
  const q = Array.from({ length: CAP_E }, (_, e) => Math.exp(-2.4 * skew * e));
  const s = q.reduce((a, b) => a + b, 0);
  return CAP_U.map((u) => {
    let acc = 0;
    for (let e = 0; e < CAP_E; e++) {
      acc += q[e]! / s;
      if (u < acc) return e;
    }
    return CAP_E - 1;
  });
}

export interface Dispatch {
  C: number;
  /** Slot of each token in its expert's buffer (1-based), or 0 if dropped. */
  slot: number[];
  load: number[];
  dropped: number;
  wasted: number;
}

/** The cumsum dispatch: each token's place in line at its expert, kept if it fits within C. */
export function dispatch(choice: number[], cf: number, E = CAP_E): Dispatch {
  const T = choice.length;
  const C = Math.ceil((cf * T) / E);
  const count = new Array<number>(E).fill(0);
  const slot = choice.map((e) => {
    count[e]!++;
    return count[e]! <= C ? count[e]! : 0;
  });
  const kept = slot.filter((s) => s > 0).length;
  return { C, slot, load: count, dropped: T - kept, wasted: E * C - kept };
}

export function figCapacity(p: Page): void {
  p.figure({
    title: 'Expert capacity and dropped tokens',
    codeTitle: 'dispatch.py',
    code: `
      T, E = 32, 4
      C = int(np.ceil({{cf:1.25}} * T / E))  # {{C}}  #@cap
      choice = probs.argmax(axis=1)   # top-1  #@route
      onehot = np.eye(E)[choice]      # (T, E) #@route
      pos = np.cumsum(onehot, axis=0) * onehot  #@pos
      keep = (pos > 0) & (pos <= C)   # fits?  #@keep
      dropped = T - keep.sum()     # {{dropped}}  #@drop
      wasted = E * C - keep.sum()  # {{wasted}}   #@waste
    `,
    setup(f) {
      let cf = 1.25;
      let skew = 0.35;
      let D = dispatch(capChoices(skew), cf);
      let choice = capChoices(skew);
      const cv = f.canvas(640, 280, (ctx, w, h) => {
        // The batch, in arrival order.
        txt(ctx, `${CAP_T} tokens in arrival order`, 4, 14, { size: 12, weight: 600, color: color('--ink-2') });
        const tw = Math.min(18, (w - 8) / CAP_T);
        const ty = 22;
        choice.forEach((e, t) => {
          const x = 4 + t * tw;
          const kept = D.slot[t]! > 0;
          rbox(ctx, x + 1, ty, tw - 2, tw - 2, 2.5, kept ? withAlpha(ek(e), 0.8) : withAlpha(ek(e), 0.15), kept ? undefined : color('red'), 1.5);
          if (!kept) {
            ctx.strokeStyle = color('red');
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(x + 3, ty + 2);
            ctx.lineTo(x + tw - 3, ty + tw - 4);
            ctx.stroke();
          }
        });
        // One buffer row per expert, C slots each.
        const top = ty + tw + 34;
        txt(ctx, `expert buffers, C = ${D.C} slots each`, 4, top - 12, { size: 12, weight: 600, color: color('--ink-2') });
        const lab = 64;
        const maxC = Math.ceil((2 * CAP_T) / CAP_E);
        const sw = Math.min(24, (w - lab - 78) / maxC);
        const rh = Math.min(42, (h - top - 4) / CAP_E);
        for (let e = 0; e < CAP_E; e++) {
          const y = top + e * rh;
          txt(ctx, `expert ${e}`, 4, y + rh / 2 + 1, { size: 12, weight: 600, base: 'middle', color: ek(e) });
          for (let c = 0; c < D.C; c++) {
            const x = lab + c * sw;
            if (c < Math.min(D.load[e]!, D.C)) rbox(ctx, x + 1, y + 2, sw - 2, rh - 6, 3, withAlpha(ek(e), 0.8));
            else {
              ctx.setLineDash([3, 3]);
              rbox(ctx, x + 1.5, y + 2.5, sw - 3, rh - 7, 3, undefined, withAlpha(color('--ink-3'), 0.8), 1);
              ctx.setLineDash([]);
            }
          }
          const over = D.load[e]! - D.C;
          if (over > 0) txt(ctx, `+${over} dropped`, lab + D.C * sw + 7, y + rh / 2 + 1, { size: 12, weight: 700, base: 'middle', color: color('red') });
        }
        dashLine(ctx, lab + D.C * sw + 1.5, top - 2, lab + D.C * sw + 1.5, top + CAP_E * rh - 2, color('red'), 1.4, [4, 3]);
      });
      phoneAspect(cv.canvas, 340, 240);
      cv.canvas.classList.add('scroll-ok');
      const dropRo = f.readout('dropped');
      const wasteRo = f.readout('empty slots');
      const update = () => {
        choice = capChoices(skew);
        D = dispatch(choice, cf);
        f.code.setMany({ C: D.C, dropped: D.dropped, wasted: D.wasted });
        dropRo.set(`${D.dropped} of ${CAP_T} (${Math.round((100 * D.dropped) / CAP_T)}%)`);
        wasteRo.set(`${D.wasted} of ${CAP_E * D.C}`);
        cv.redraw();
      };
      f.slider({
        label: 'capacity factor',
        min: 0.5,
        max: 2,
        step: 0.05,
        value: 1.25,
        slot: 'cf',
        format: (v) => v.toFixed(2),
        onInput: (v) => {
          cf = v;
          f.code.highlight(['cap', 'keep']);
          update();
        },
      });
      f.slider({
        label: 'router skew',
        min: 0,
        max: 1,
        step: 0.01,
        value: 0.35,
        format: (v) => v.toFixed(2),
        onInput: (v) => {
          skew = v;
          f.code.highlight(['route', 'pos']);
          update();
        },
      });
      update();
    },
    caption: `Each expert gets a buffer of $C$ slots, set before the batch is seen. Tokens claim slots in arrival order (that is what the running count \`pos\` computes), and a token whose expert is full is **dropped**: it skips the expert layer and passes through the residual connection unchanged (red outline). Set the skew to 0: even with perfectly fair odds, random fluctuations overfill some buffer at a capacity factor of 1.0. Raise the factor and the drops vanish, but empty slots (dashed) are computation and memory reserved for nothing. Raise the skew and no reasonable factor saves you: that is why the router has to be balanced first.`,
  });
}

/* ------------------------------------------------------------------ */
/* fine-grained and shared experts                                      */
/* ------------------------------------------------------------------ */

export function figFineGrained(p: Page): void {
  p.figure({
    title: 'Fine-grained and shared experts: same compute, more choices',
    codeTitle: 'deepseekmoe.py',
    code: `
      from math import comb
      N, K = 16, 2     # baseline: top-2 of 16
      m, Ks = {{m:4}}, {{Ks:1}}  # split, shared
      n_experts = N * m  # {{n}}, each 1/m wide  #@split
      n_active = K * m   # {{a}}, same compute   #@split
      routed = n_experts - Ks     # {{r}}        #@shared
      k_routed = n_active - Ks    # {{kr}}       #@shared
      comb(routed, k_routed)  # {{combos}}      #@comb
    `,
    setup(f) {
      const N = 16;
      const K = 2;
      let m = 4;
      let Ks = 1;
      let seed = 1;
      let pick = new Set<number>();
      const resample = () => {
        const routed = N * m - Ks;
        const kr = K * m - Ks;
        const ids = new Rng(seed * 31 + m * 7 + Ks).shuffle(Array.from({ length: routed }, (_, i) => i + Ks));
        pick = new Set(ids.slice(0, kr));
      };
      const cv = f.canvas(640, 230, (ctx, w, h) => {
        txt(ctx, `${N} columns = ${N} ordinary experts' worth of weights`, 4, 14, { size: 12, weight: 600, color: color('--ink-2') });
        const top = 24;
        const gh = h - top - 30;
        const cw = (w - 8) / N;
        const rh = gh / m;
        for (let col = 0; col < N; col++)
          for (let r = 0; r < m; r++) {
            const id = col * m + r;
            const x = 4 + col * cw;
            const y = top + r * rh;
            const shared = id < Ks;
            const on = shared || pick.has(id);
            const k = shared ? color('gold') : color('purple');
            rbox(ctx, x + 1.5, y + 1.5, cw - 3, rh - 3, Math.min(4, rh / 4), withAlpha(k, on ? 0.8 : 0.1), withAlpha(k, on ? 1 : 0.4), 1);
          }
        const ly = h - 9;
        rbox(ctx, 4, ly - 10, 12, 12, 3, withAlpha(color('gold'), 0.8));
        txt(ctx, `shared (${Ks})`, 21, ly, { size: 11.5, color: color('--ink-2') });
        const x2 = Math.min(120, w * 0.33);
        rbox(ctx, x2, ly - 10, 12, 12, 3, withAlpha(color('purple'), 0.8));
        txt(ctx, `routed, picked for this token (${K * m - Ks})`, x2 + 17, ly, { size: 11.5, color: color('--ink-2') });
      });
      phoneAspect(cv.canvas, 340, 220);
      cv.canvas.classList.add('scroll-ok');
      const nRo = f.readout('experts');
      const sizeRo = f.readout('each one');
      const combRo = f.readout('ways to pick');
      const update = () => {
        resample();
        const combos = commas(comb(N * m - Ks, K * m - Ks));
        f.code.setMany({ m, Ks, n: N * m, a: K * m, r: N * m - Ks, kr: K * m - Ks, combos });
        nRo.set(`${N * m}, ${K * m} active`);
        sizeRo.set(m === 1 ? 'a full FFN' : `1/${m} of an FFN`);
        combRo.set(combos);
        cv.redraw();
      };
      f.segmented({
        label: 'split into m',
        options: ['1', '2', '4', '8'].map((v) => ({ value: v, label: `m = ${v}` })),
        value: '4',
        onChange: (v) => {
          m = Number(v);
          if (Ks > K * m - 1) Ks = 0;
          ksSeg.set(String(Ks), false);
          f.code.highlight(['split', 'comb']);
          update();
        },
      });
      const ksSeg = f.segmented({
        label: 'shared experts Ks',
        options: ['0', '1', '2'].map((v) => ({ value: v, label: v })),
        value: '1',
        onChange: (v) => {
          Ks = Math.min(Number(v), K * m - 1);
          if (Ks !== Number(v)) ksSeg.set(String(Ks), false);
          f.code.highlight(['shared', 'comb']);
          update();
        },
      });
      f.button('Another token', () => {
        seed++;
        resample();
        cv.redraw();
      });
      update();
    },
    caption: `Every column holds the parameters of one ordinary expert; the split factor $m$ cuts it into $m$ narrower experts. The total area (parameters) and the lit area (compute per token) never change, but the number of ways to choose the active experts explodes: from 120 at $m = 1$ to over four billion at $m = 4$, the example in the DeepSeekMoE paper. More combinations let each token assemble a closer match from specialists. A **shared** expert (gold) is lit for every token; it takes one of the active slots, so compute stays the same, and it absorbs the knowledge every token needs, so the routed experts do not each have to relearn it.`,
  });
}

/* ------------------------------------------------------------------ */
/* expert parallelism: dispatch and combine with all-to-all             */
/* ------------------------------------------------------------------ */

export const A2A_G = 4;
export const A2A_PER = 6;
/** Destination expert (0..7) of each device's tokens, balanced: every expert receives 3. */
export const A2A_BAL: number[][] = [
  [0, 3, 5, 6, 1, 7],
  [2, 4, 0, 7, 5, 3],
  [1, 6, 2, 4, 7, 0],
  [5, 2, 3, 6, 1, 4],
];
/** Skewed: experts 0 and 1, both on GPU 0, are popular, so GPU 0 receives 12 tokens and the others 4. */
export const A2A_SKEW: number[][] = [
  [0, 1, 0, 6, 2, 4],
  [1, 0, 3, 5, 1, 7],
  [0, 2, 1, 4, 6, 0],
  [1, 7, 0, 3, 5, 1],
];

export interface A2ALayout {
  /** [device, slot] at home for token (g, j). */
  home(g: number, j: number): [number, number];
  /** [device, slot] in the receive area for token (g, j). */
  away(g: number, j: number): [number, number];
  recv: number[];
}

/** Where every token sits before dispatch and after it: receive slots fill in sender order. */
export function a2aLayout(dest: number[][]): A2ALayout {
  const recv = new Array<number>(A2A_G).fill(0);
  const away: [number, number][][] = dest.map(() => []);
  for (let src = 0; src < A2A_G; src++)
    for (let j = 0; j < A2A_PER; j++) {
      const d = Math.floor(dest[src]![j]! / 2);
      away[src]![j] = [d, recv[d]!++];
    }
  return { home: (g, j) => [g, j], away: (g, j) => away[g]![j]!, recv };
}

export function figAllToAll(p: Page): void {
  const STAGES = ['route', 'dispatch', 'compute', 'combine', 'residual'];
  p.figure({
    title: 'Expert parallelism: two all-to-alls per layer',
    codeTitle: 'expert_parallel.py',
    code: `
      # every GPU at once; GPU g holds 2g, 2g+1
      probs = (x @ W_r).softmax(-1)  # local x  #@route
      expert = probs.argmax(-1)      # where    #@route
      order = expert.argsort()   # group by GPU #@route
      recv = all_to_all(x[order], counts)       #@dispatch
      out = local_experts(recv)  # 2 per GPU    #@compute
      back = all_to_all(out, counts)            #@combine
      y = torch.empty_like(back)                #@combine
      y[order] = back            # unsort       #@combine
      x = x + gate * y           # residual     #@residual
      # stage: {{stage:route}}
    `,
    setup(f) {
      let dest = A2A_BAL;
      let L = a2aLayout(dest);
      let stage = 0;
      let from = 0;
      let anim = 1;
      const cv = f.canvas(640, 372, (ctx, w) => {
        const gap = 8;
        const gw = (w - 8 - 3 * gap) / A2A_G;
        const cell = Math.min(20, (gw - 12) / 3 - 3);
        const pitch = cell + 3;
        const top = 4;
        const homeY = top + 40;
        const divY = homeY + 2 * pitch + 8;
        const awayY = divY + 18;
        const boxB = awayY + 4 * pitch + 4;
        const slotXY = (g: number, sl: number, y0: number): [number, number] => {
          const x = 4 + g * (gw + gap) + (gw - 3 * pitch + 3) / 2 + (sl % 3) * pitch;
          return [x, y0 + Math.floor(sl / 3) * pitch];
        };
        for (let g = 0; g < A2A_G; g++) {
          const x = 4 + g * (gw + gap);
          rbox(ctx, x, top, gw, boxB - top, 8, withAlpha(color('--ink-3'), 0.06), withAlpha(color('--ink-3'), 0.5), 1);
          txt(ctx, `GPU ${g}`, x + gw / 2, top + 16, { size: 12.5, weight: 700, align: 'center', color: color('--ink') });
          txt(ctx, `E${2 * g}`, x + gw / 2 - 4, top + 32, { size: 11.5, mono: true, weight: 700, align: 'right', color: ek(2 * g) });
          txt(ctx, `E${2 * g + 1}`, x + gw / 2 + 4, top + 32, { size: 11.5, mono: true, weight: 700, align: 'left', color: ek(2 * g + 1) });
          dashLine(ctx, x + 6, divY, x + gw - 6, divY, withAlpha(color('--ink-3'), 0.5), 1, [3, 3]);
          txt(ctx, 'received', x + gw / 2, divY + 13, { size: 11, align: 'center', color: color('--ink-3') });
        }
        // Tokens glide between home and away slots as the stage changes.
        const placeAt = (st: number, g: number, j: number): [number, number] => {
          if (st === 1 || st === 2) {
            const [d, sl] = L.away(g, j);
            return slotXY(d, sl, awayY);
          }
          return slotXY(g, j, homeY);
        };
        const e2 = anim * anim * (3 - 2 * anim);
        for (let g = 0; g < A2A_G; g++)
          for (let j = 0; j < A2A_PER; j++) {
            const [x0, y0] = placeAt(from, g, j);
            const [x1, y1] = placeAt(stage, g, j);
            const x = x0 + (x1 - x0) * e2;
            const y = y0 + (y1 - y0) * e2;
            const e = dest[g]![j]!;
            const done = stage >= 3 || (stage === 2 && anim > 0.5);
            rbox(ctx, x, y, cell, cell, 4, withAlpha(ek(e), done ? 0.9 : 0.5), ek(e), done ? 2 : 1);
            if (stage === 4) txt(ctx, '✓', x + cell / 2, y + cell * 0.72, { size: 11, align: 'center', weight: 700, color: '#ffffff' });
          }
        // Expert work per GPU; the layer waits for the slowest.
        const by = boxB + 18;
        const mx = Math.max(...L.recv);
        txt(ctx, 'expert work per GPU (tokens received)', 4, by, { size: 12, weight: 600, color: color('--ink-2') });
        for (let g = 0; g < A2A_G; g++) {
          const x = 4 + g * (gw + gap);
          const full = gw - 22;
          const bw = Math.max(4, (full * L.recv[g]!) / 12);
          rbox(ctx, x, by + 8, full, 16, 4, withAlpha(color('--ink-3'), 0.12));
          rbox(ctx, x, by + 8, bw, 16, 4, withAlpha(L.recv[g] === mx && mx > 6 ? color('red') : color('teal'), 0.75));
          txt(ctx, String(L.recv[g]), x + bw + 4, by + 21, { size: 11.5, mono: true, weight: 600, color: color('--ink') });
        }
      });
      phoneAspect(cv.canvas, 340, 254);
      cv.canvas.classList.add('scroll-ok');
      const loop = f.loop((dt) => {
        anim = Math.min(1, anim + dt / 0.9);
        cv.redraw();
        if (anim >= 1) return false;
      });
      const go = (k: number) => {
        from = stage;
        stage = k;
        anim = from === k ? 1 : 0;
        f.code.highlight(STAGES[k]!);
        f.code.set('stage', STAGES[k]!);
        loop.start();
        cv.redraw();
      };
      f.stepper({
        steps: STAGES.length,
        interval: 1500,
        label: (i) => `${i + 1} / ${STAGES.length}: ${STAGES[i]}`,
        onStep: (i) => go(i),
      });
      f.segmented({
        label: 'routing',
        options: [
          { value: 'bal', label: 'balanced' },
          { value: 'skew', label: 'skewed' },
        ],
        value: 'bal',
        onChange: (v) => {
          dest = v === 'bal' ? A2A_BAL : A2A_SKEW;
          L = a2aLayout(dest);
          anim = 1;
          note();
          cv.redraw();
        },
      });
      const note = () => {
        const mx = Math.max(...L.recv);
        f.status(`The layer ends when the busiest GPU does: **${mx}** tokens of expert work, against **6** when the load is even.`);
      };
      note();
    },
    caption: `Four GPUs, two experts each, six tokens each. Token color is the expert the router chose. Step through one MoE layer: **dispatch** is an all-to-all, in which every GPU sends a different slice of its tokens to every other GPU; the experts run on what arrived; **combine** is a second all-to-all that sends each result back to the GPU its token came from, where it is scaled by its gate and added to the residual stream. Switch to **skewed** routing: GPU 0, which holds the two popular experts, receives twice its share, and since no GPU can start the next layer until the combine finishes, everyone waits for it.`,
  });
}
