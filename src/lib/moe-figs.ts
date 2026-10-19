import type { Fig, Page } from '../core/page';
import { fmt } from '../core/code';
import { CLASS_COLORS, color, rgbOf, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { SHAPE_22B, SHAPE_7B, human, moeParams, touched } from './moe-math';
import { type Balance, TOY_CENTER, TOY_DOMAIN, TOY_STEPS, ToyMoE, toyData } from './moe-toy';

/* ------------------------------------------------------------------ */
/* shared drawing helpers                                               */
/* ------------------------------------------------------------------ */

export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
export const UI = 'system-ui, -apple-system, sans-serif';

/** Expert e's color: the palette in class order, so expert 0 is blue in every figure. */
export const ek = (e: number): string => color(CLASS_COLORS[e % CLASS_COLORS.length]!);

export interface TxtOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  weight?: number;
  mono?: boolean;
  italic?: boolean;
  /** Paper-colored outline, for text over bars or lines. */
  halo?: boolean;
}

export function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: TxtOpts = {}): void {
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 500} ${o.size ?? 12}px ${o.mono ? MONO : UI}`;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.base ?? 'alphabetic';
  if (o.halo) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = color('--paper');
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = o.color ?? color('--ink-2');
  ctx.fillText(s, x, y);
}

const CSS = '@media (max-width: 560px) { canvas.moe-ph { aspect-ratio: var(--ph) !important; } }';

/** Injects the chapter's few style rules once per page. */
export function installCss(root: HTMLElement): void {
  if (root.querySelector('style[data-moe]')) return;
  const st = document.createElement('style');
  st.dataset.moe = '1';
  st.textContent = CSS;
  root.prepend(st);
}

/** On a phone, give a canvas a taller aspect than on a desktop so its text keeps room. */
export function phoneAspect(c: HTMLCanvasElement, w: number, h: number): void {
  c.classList.add('moe-ph');
  c.style.setProperty('--ph', `${w} / ${h}`);
}

export function rbox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 1): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function dashLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, lw = 1.2, dash = [5, 4]): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const sub = (n: number): string => String(n).split('').map((c) => SUB[Number(c)]!).join('');

function softmax(z: number[]): number[] {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

/* ------------------------------------------------------------------ */
/* Fig: one token through the router                                    */
/* ------------------------------------------------------------------ */

const R_E = 8;
export const R_W: [number, number][] = (() => {
  const r = new Rng(9);
  return Array.from({ length: R_E }, (_, e) => {
    const a = (e / R_E) * Math.PI * 2 + 0.3 + 0.22 * r.randn();
    const len = 1.6 + 0.8 * r.next();
    return [len * Math.cos(a), len * Math.sin(a)] as [number, number];
  });
})();

export interface Routed {
  logits: number[];
  probs: number[];
  top: number[];
  gates: number[];
}

/** Softmax, top-k and (optionally) renormalized gates for the fixed 8-expert router. */
export function routeOne(x: [number, number], k: number, renorm: boolean): Routed {
  const logits = R_W.map(([a, b]) => a * x[0] + b * x[1]);
  const probs = softmax(logits);
  const top = probs.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]).slice(0, k).map((t) => t[1]);
  let gates = top.map((i) => probs[i]!);
  if (renorm) {
    const s = gates.reduce((a, b) => a + b, 0);
    gates = gates.map((g) => g / s);
  }
  return { logits, probs, top, gates };
}

export function figRouter(p: Page): void {
  p.figure({
    title: 'One token through the router',
    codeTitle: 'route_one.py',
    code: `
      W_r = np.random.randn(2, 8)  # d x E, learned
      x = np.array([{{x0}}, {{x1}}])  # one token
      logits = x @ W_r          # (8,) per expert  #@logits
      probs = np.exp(logits - logits.max())        #@softmax
      probs /= probs.sum()      # softmax          #@softmax
      k = {{k:2}}
      top = np.argsort(probs)[::-1][:k]  # {{top}}  #@topk
      gates = probs[top]                           #@gates
      if {{renorm:True}}:                          #@renorm
          gates = gates / gates.sum()  # sum to 1  #@renorm
      y = sum(g * experts[i](x)                    #@combine
              for g, i in zip(gates, top))         #@combine
      # gates = {{gates}}
    `,
    setup(f) {
      let x: [number, number] = [0.95, 0.55];
      let k = 2;
      let renorm = true;
      let R = routeOne(x, k, renorm);
      const regionRgb = () => Array.from({ length: R_E }, (_, e) => rgbOf(ek(e)));
      const pl = f.plot({
        aspect: 1.3,
        domain: [-1.65, 1.65, -1.3, 1.3],
        draw: (pp) => {
          const cols = regionRgb();
          pp.field((a, b) => {
            let best = 0;
            let bv = -Infinity;
            R_W.forEach(([u, v], e) => {
              const z = u * a + v * b;
              if (z > bv) {
                bv = z;
                best = e;
              }
            });
            const [r, g, bb] = cols[best]!;
            return [r, g, bb, 30];
          }, 6);
          pp.axes({ grid: 0.5 });
          const chosen = new Set(R.top);
          R_W.forEach(([u, v], e) => {
            const on = chosen.has(e);
            pp.arrow(0, 0, u * 0.5, v * 0.5, on ? ek(e) : withAlpha(ek(e), 0.5), on ? 3 : 1.6);
          });
          pp.arrow(0, 0, x[0], x[1], color('orange'), 2.6);
          pp.dot(x[0], x[1], 6.5, color('orange'), color('--paper'));
          R_W.forEach(([u, v], e) => {
            const on = chosen.has(e);
            const L = Math.hypot(u, v) * 0.5 + 0.13;
            const a = Math.atan2(v, u);
            const X = pp.sx(Math.cos(a) * L);
            const Y = pp.sy(Math.sin(a) * L);
            txt(pp.ctx, String(e), X, Y, { align: 'center', base: 'middle', size: on ? 13 : 12, weight: on ? 700 : 500, mono: true, color: ek(e), halo: true });
          });
          pp.text('x', x[0] + 0.1, x[1] + 0.08, { size: 15, bold: true, color: color('orange') });
        },
      });
      const bars = f.canvas(640, 240, (ctx, w, h) => {
        const left = 26;
        const colW = (w - left - 4) / R_E;
        const top = 22;
        const bottom = h - 64;
        const bh = bottom - top;
        txt(ctx, 'router probability p', left, 13, { size: 11.5, color: color('purple'), weight: 600 });
        const gx = left + Math.min(w * 0.52, 190);
        txt(ctx, 'gate g (chosen)', gx, 13, { size: 11.5, color: color('gold'), weight: 600 });
        dashLine(ctx, left, bottom + 0.5, w - 2, bottom + 0.5, color('--axis'), 1, []);
        for (let e = 0; e < R_E; e++) {
          const cx = left + colW * (e + 0.5);
          const bw = Math.min(16, colW * 0.32);
          const ti = R.top.indexOf(e);
          const on = ti >= 0;
          const ph = R.probs[e]! * bh;
          rbox(ctx, cx - bw - 1, bottom - ph, bw, ph, 2, withAlpha(color('purple'), on ? 0.75 : 0.3));
          if (on) {
            const gh = R.gates[ti]! * bh;
            rbox(ctx, cx + 1, bottom - gh, bw, gh, 2, withAlpha(color('gold'), 0.8), color('gold'), 1);
          }
          txt(ctx, String(e), cx, bottom + 15, { size: 12, mono: true, align: 'center', weight: on ? 700 : 500, color: ek(e) });
          txt(ctx, R.probs[e]!.toFixed(2).replace(/^0/, ''), cx, bottom + 34, { size: 11, mono: true, align: 'center', color: on ? color('--ink') : color('--ink-3') });
          if (on) txt(ctx, R.gates[ti]!.toFixed(2).replace(/^0/, ''), cx, bottom + 53, { size: 11, mono: true, align: 'center', weight: 700, color: color('--ink') });
        }
        txt(ctx, 'p', 4, bottom + 34, { size: 12, mono: true, weight: 700, color: color('purple') });
        txt(ctx, 'g', 4, bottom + 53, { size: 12, mono: true, weight: 700, color: color('gold') });
      });
      phoneAspect(bars.canvas, 340, 190);
      bars.canvas.classList.add('scroll-ok');
      const update = () => {
        R = routeOne(x, k, renorm);
        f.code.setMany({
          x0: fmt(x[0], 2),
          x1: fmt(x[1], 2),
          top: `[${R.top.join(', ')}]`,
          gates: `[${R.gates.map((g) => g.toFixed(2)).join(', ')}]`,
        });
        const terms = R.top.map((e, i) => `${R.gates[i]!.toFixed(2)} · FFN${sub(e)}(x)`).join(' + ');
        const sum = R.gates.reduce((a, b) => a + b, 0);
        f.status(`**y** = ${terms}  ·  gates add up to ${sum.toFixed(2)}`);
        pl.redraw();
        bars.redraw();
      };
      let drag = false;
      const move = (e: PointerEvent) => {
        if (!drag) return;
        let [a, b] = pl.pointer(e);
        const r = Math.hypot(a, b);
        if (r > 1.5) {
          a *= 1.5 / r;
          b *= 1.5 / r;
        }
        x = [a, b];
        f.code.highlight(['logits', 'softmax']);
        update();
      };
      pl.canvas.addEventListener('pointerdown', (e) => {
        drag = true;
        pl.canvas.setPointerCapture(e.pointerId);
        move(e);
      });
      pl.canvas.addEventListener('pointermove', move);
      pl.canvas.addEventListener('pointerup', () => (drag = false));
      f.segmented({
        label: 'top-k',
        options: [
          { value: '1', label: 'k = 1' },
          { value: '2', label: 'k = 2' },
          { value: '4', label: 'k = 4' },
        ],
        value: '2',
        slot: 'k',
        onChange: (v) => {
          k = Number(v);
          f.code.highlight('topk');
          update();
        },
      });
      f.toggle({
        label: 'renormalize the gates',
        value: true,
        onChange: (v) => {
          renorm = v;
          f.code.set('renorm', v ? 'True' : 'False');
          f.code.highlight('renorm');
          update();
        },
      });
      update();
    },
    caption: `The router is a linear layer: one column of $\\symWr$ per expert, drawn as eight arrows. Each expert's logit is the dot product of its arrow with the token $\\symx$ (orange), and the background shows which expert scores highest where. **Drag the token.** The bars show the softmax probabilities $\\symp$ and, for the $\\symk$ experts kept, their gates $\\symg$. With renormalization on, the kept gates are rescaled to add up to 1; switch it off and they keep their raw probabilities, which add up to less. Move the token far from the center and the softmax sharpens: one expert takes nearly all the weight.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: total versus active parameters                                  */
/* ------------------------------------------------------------------ */

export function figParams(p: Page): void {
  p.figure({
    title: 'Total versus active parameters',
    codeTitle: 'count_params.py',
    code: `
      d, d_ff, d_kv, L, V = {{shape:4096, 14336, 1024, 32, 32000}}
      E, k = {{E:8}}, {{k:2}}  # experts, used per token
      embed = 2 * V * d        # in and out tables
      attn = 2*d*d + 2*d*d_kv  # grouped-query
      expert = 3 * d * d_ff    # one SwiGLU    #@expert
      router = d * E                           #@router
      total = embed + L * (attn + router       #@total
                           + E * expert)       #@total
      active = embed + L * (attn + router      #@active
                            + k * expert)      #@active
      # total {{total}}, active {{active}}
      memory = 2 * total    # bf16: {{mem}}    #@mem
      flops = 2 * active    # {{flops}}/token  #@flops
    `,
    setup(f) {
      let shape = SHAPE_7B;
      let E = 8;
      let k = 2;
      const order = new Rng(3).shuffle(Array.from({ length: 64 }, (_, i) => i));
      const cv = f.canvas(640, 290, (ctx, w) => {
        const c = moeParams(shape, E, k);
        // One layer: attention, router, then E experts with k lit for one token.
        const lit = new Set(order.filter((i) => i < E).slice(0, k));
        txt(ctx, `one layer: E = ${E}, k = ${k}`, 4, 14, { size: 12, color: color('--ink-2'), weight: 600 });
        const top = 24;
        const dh = 54;
        const aw = Math.min(74, w * 0.2);
        rbox(ctx, 4, top, aw, dh, 6, withAlpha(color('blue'), 0.18), color('blue'));
        txt(ctx, 'attention', 4 + aw / 2, top + dh / 2 + 4, { size: 11, align: 'center', color: color('blue'), weight: 600 });
        const rx = 4 + aw + 6;
        rbox(ctx, rx, top, 10, dh, 3, withAlpha(color('gold'), 0.3), color('gold'));
        const gx0 = rx + 16;
        const perRow = Math.min(E, 16);
        const rows = Math.ceil(E / perRow);
        const cell = Math.min(34, (w - gx0 - 2) / perRow);
        const ch = dh / rows;
        for (let i = 0; i < E; i++) {
          const cx = gx0 + (i % perRow) * cell;
          const cy = top + Math.floor(i / perRow) * ch;
          const on = lit.has(i);
          rbox(ctx, cx + 1, cy + 1, cell - 2, ch - 2, Math.min(3, ch / 4), withAlpha(color('purple'), on ? 0.75 : 0.12), withAlpha(color('purple'), on ? 1 : 0.45));
        }
        // Total and active, stacked by part, on one scale.
        const segs = (o: typeof c.parts) => [
          { v: o.embed, k: color('slate'), n: 'embeddings' },
          { v: o.attn, k: color('blue'), n: 'attention' },
          { v: o.router, k: color('gold'), n: 'router' },
          { v: o.experts, k: color('purple'), n: 'experts' },
        ];
        const bx = 52;
        const scale = (w - bx - 6) / Math.max(c.total, 1);
        const bar = (y: number, label: string, o: typeof c.parts, val: number) => {
          txt(ctx, label, 4, y + 17, { size: 12, weight: 600, color: color('--ink') });
          let x0 = bx;
          for (const sg of segs(o)) {
            const ww = sg.v * scale;
            if (ww > 0.3) {
              ctx.fillStyle = withAlpha(sg.k, 0.75);
              ctx.fillRect(x0, y, ww, 25);
            }
            x0 += ww;
          }
          const lab = human(val);
          const inside = x0 - bx > 70;
          txt(ctx, lab, inside ? x0 - 6 : x0 + 6, y + 17.5, { size: 13, mono: true, weight: 700, align: inside ? 'right' : 'left', color: inside ? '#ffffff' : color('--ink') });
        };
        bar(top + dh + 18, 'total', c.parts, c.total);
        bar(top + dh + 52, 'active', c.activeParts, c.active);
        // Legend, wrapping on narrow canvases.
        let lx = 4;
        let ly = top + dh + 108;
        ctx.font = `500 11.5px ${UI}`;
        for (const sg of segs(c.parts)) {
          const iw = 15 + ctx.measureText(sg.n).width + 14;
          if (lx + iw > w && lx > 4) {
            lx = 4;
            ly += 20;
          }
          ctx.fillStyle = withAlpha(sg.k, 0.75);
          ctx.fillRect(lx, ly - 9, 11, 11);
          txt(ctx, sg.n, lx + 15, ly, { size: 11.5, color: color('--ink-2') });
          lx += iw;
        }
      });
      phoneAspect(cv.canvas, 340, 222);
      cv.canvas.classList.add('scroll-ok');
      const update = () => {
        if (k > E) {
          k = E;
          kS.set(k, false);
        }
        const c = moeParams(shape, E, k);
        f.code.setMany({
          shape: `${shape.d}, ${shape.dff}, ${shape.dkv}, ${shape.layers}, ${shape.vocab}`,
          E,
          k,
          total: human(c.total),
          active: human(c.active),
          mem: `${fmt((2 * c.total) / 1e9, 3)} GB`,
          flops: human(2 * c.active),
        });
        memRo.set(`${fmt((2 * c.total) / 1e9, 3)} GB`);
        flopRo.set(human(2 * c.active));
        ratioRo.set(`${(c.total / c.active).toFixed(1)}x`);
        readRo.set(`${fmt(touched(E, k, 1), 3)} of ${E}`);
        batchRo.set(`${fmt(touched(E, k, 16), 3)} of ${E}`);
        cv.redraw();
      };
      f.segmented({
        label: 'base model shape',
        options: [
          { value: '7', label: 'Mistral 7B' },
          { value: '22', label: '22B shape' },
        ],
        value: '7',
        onChange: (v) => {
          shape = v === '7' ? SHAPE_7B : SHAPE_22B;
          update();
        },
      });
      f.slider({
        label: 'experts E',
        sym: 'E',
        min: 0,
        max: 6,
        step: 1,
        value: 3,
        map: (r) => 2 ** r,
        format: (v) => String(v),
        onInput: (v) => {
          E = v;
          f.code.highlight(['total', 'mem']);
          update();
        },
      });
      const kS = f.slider({
        label: 'active k',
        sym: 'k',
        min: 1,
        max: 8,
        step: 1,
        value: 2,
        onInput: (v) => {
          k = Math.min(v, E);
          if (k !== v) kS.set(k, false);
          f.code.highlight(['active', 'flops']);
          update();
        },
      });
      const memRo = f.readout('memory, bf16');
      const flopRo = f.readout('FLOPs per token');
      const ratioRo = f.readout('total / active');
      const readRo = f.readout('experts read by 1 token');
      const batchRo = f.readout('by 16 tokens');
      update();
    },
    caption: `Start at Mixtral 8x7B: $\\symE = 8$ experts per layer, $\\symk = 2$ used per token. All 46.7 billion parameters must sit in memory, but each token runs through only 12.9 billion of them, so it costs about as much compute as a 13B dense model. Set $\\symE = 1$ and you get Mistral 7B, the dense model with the same shape (7.24B). Slide $\\symE$ up and the total grows with it while the active count does not move: that is the whole trick. Then raise $\\symk$ and watch compute catch up. The last line is a warning for serving: one token reads only $\\symk$ experts per layer, but a batch of 16 tokens already touches nearly all of them. The **22B shape** button switches to Mixtral 8x22B's dimensions (141B total, 39B active at 8 and 2).`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: the balancing loss on draggable loads                           */
/* ------------------------------------------------------------------ */

export function figAuxBars(p: Page): void {
  p.figure({
    title: 'The balancing loss, by hand',
    codeTitle: 'aux_loss.py',
    code: `
      E = 4
      f = np.array([{{f}}])  # token shares
      P = np.array([{{P}}])  # mean probs
      aux_loss = E * np.sum(f * P)   # {{L}}  #@loss
      # balanced: E * E * (1/E) * (1/E) = 1  #@uniform
      grad_P = E * f   # d aux_loss / d P    #@grad
    `,
    setup(f) {
      const E = 4;
      let F = [0.55, 0.25, 0.15, 0.05];
      let P = [...F];
      let linked = true;
      const loss = () => E * F.reduce((a, v, i) => a + v * P[i]!, 0);
      const renorm = (arr: number[], i: number, v: number) => {
        v = Math.max(0, Math.min(1, v));
        const rest = arr.reduce((a, x, j) => a + (j === i ? 0 : x), 0);
        return arr.map((x, j) => (j === i ? v : rest > 1e-9 ? (x * (1 - v)) / rest : (1 - v) / (E - 1)));
      };
      const geo = (w: number, h: number) => {
        const top = 64;
        const bottom = h - 40;
        const left = 8;
        const colW = (w - left * 2) / E;
        return { top, bottom, left, colW, bh: bottom - top };
      };
      const cv = f.canvas(640, 300, (ctx, w, h) => {
        const g = geo(w, h);
        // Gauge from 0 to E.
        const L = loss();
        const gx0 = 8;
        const gx1 = w - 8;
        const gy = 22;
        const sx = (v: number) => gx0 + ((gx1 - gx0) * v) / E;
        rbox(ctx, gx0, gy - 5, gx1 - gx0, 10, 5, withAlpha(color('--ink-3'), 0.18));
        rbox(ctx, gx0, gy - 5, Math.max(10, sx(L) - gx0), 10, 5, withAlpha(color('red'), 0.75));
        for (const [v, lab] of [[1, 'balanced'], [E, 'all on one']] as const) {
          dashLine(ctx, sx(v), gy - 9, sx(v), gy + 9, color('--ink-2'), 1.2, []);
          txt(ctx, `${v}: ${lab}`, v === E ? sx(v) : sx(v) + 4, gy + 23, { size: 11, align: v === E ? 'right' : 'left', color: color('--ink-3') });
        }
        txt(ctx, `aux loss = ${L.toFixed(2)}`, gx0, gy - 10, { size: 12.5, mono: true, weight: 700, color: color('red') });
        dashLine(ctx, g.left, g.bottom + 0.5, w - g.left, g.bottom + 0.5, color('--axis'), 1, []);
        dashLine(ctx, g.left, g.bottom - g.bh / E, w - g.left, g.bottom - g.bh / E, withAlpha(color('--ink-3'), 0.7), 1, [4, 4]);
        for (let e = 0; e < E; e++) {
          const cx = g.left + g.colW * (e + 0.5);
          const bw = Math.min(34, g.colW * 0.3);
          const fh = F[e]! * g.bh;
          const ph = P[e]! * g.bh;
          rbox(ctx, cx - bw - 2, g.bottom - fh, bw, fh, 3, withAlpha(color('teal'), 0.7), color('teal'));
          rbox(ctx, cx + 2, g.bottom - ph, bw, ph, 3, withAlpha(color('purple'), 0.55), color('purple'));
          txt(ctx, F[e]!.toFixed(2).replace(/^0/, ''), cx - bw / 2 - 2, g.bottom - fh - 5, { size: 11, mono: true, align: 'center', color: color('teal') });
          // Gradient on P: a downward arrow whose length is E * f_i.
          const len = Math.min(g.bh * 0.35, F[e]! * E * 16);
          const ax = cx + 2 + bw / 2;
          const ay = g.bottom - ph - 4;
          if (len > 3) {
            ctx.strokeStyle = color('red');
            ctx.fillStyle = color('red');
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ax, ay - len);
            ctx.lineTo(ax, ay - 4);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax - 4, ay - 6);
            ctx.lineTo(ax + 4, ay - 6);
            ctx.closePath();
            ctx.fill();
          }
          txt(ctx, `expert ${e}`, cx, g.bottom + 16, { size: 11.5, align: 'center', weight: 600, color: ek(e) });
          txt(ctx, 'f      P', cx, g.bottom + 31, { size: 11, mono: true, align: 'center', color: color('--ink-3') });
        }
        txt(ctx, '1/E', w - g.left, g.bottom - g.bh / E - 4, { size: 11, mono: true, align: 'right', color: color('--ink-3') });
      });
      phoneAspect(cv.canvas, 340, 280);
      let drag: { e: number; which: 'f' | 'P' } | null = null;
      const set = (ev: PointerEvent) => {
        if (!drag) return;
        const r = cv.canvas.getBoundingClientRect();
        const g = geo(r.width, r.height);
        const v = (g.bottom - (ev.clientY - r.top)) / g.bh;
        if (drag.which === 'f' || linked) F = renorm(F, drag.e, v);
        if (drag.which === 'P' || linked) P = linked ? [...F] : renorm(P, drag.e, v);
        f.code.highlight(drag.which === 'P' && !linked ? 'grad' : 'loss');
        update();
      };
      cv.canvas.addEventListener('pointerdown', (ev) => {
        const r = cv.canvas.getBoundingClientRect();
        const g = geo(r.width, r.height);
        const px = ev.clientX - r.left - g.left;
        const e = Math.max(0, Math.min(E - 1, Math.floor(px / g.colW)));
        const within = px - e * g.colW;
        drag = { e, which: within < g.colW / 2 ? 'f' : 'P' };
        cv.canvas.setPointerCapture(ev.pointerId);
        set(ev);
      });
      cv.canvas.addEventListener('pointermove', set);
      cv.canvas.addEventListener('pointerup', () => (drag = null));
      const lossRo = f.readout('aux loss', { sym: 'L' });
      const update = () => {
        const L = loss();
        lossRo.set(L.toFixed(3));
        f.code.setMany({ f: F.map((v) => v.toFixed(2)).join(', '), P: P.map((v) => v.toFixed(2)).join(', '), L: L.toFixed(3) });
        cv.redraw();
      };
      const preset = (vals: number[]) => {
        F = [...vals];
        P = [...vals];
        f.code.highlight(vals[0] === 0.25 ? 'uniform' : 'loss');
        update();
      };
      f.button('Balanced', () => preset([0.25, 0.25, 0.25, 0.25]));
      f.button('Skewed', () => preset([0.55, 0.25, 0.15, 0.05]));
      f.button('Collapsed', () => preset([1, 0, 0, 0]));
      f.toggle({
        label: 'P follows f',
        value: true,
        onChange: (v) => {
          linked = v;
          if (v) P = [...F];
          update();
        },
      });
      update();
    },
    caption: `Teal bars are the token shares $\\symf_i$, purple bars the average router probabilities $\\symP_i$, for four experts. **Drag a bar** (left half of a column for $\\symf$, right half for $\\symP$); the others rescale so each set still adds up to 1. The red gauge is the loss. With **P follows f** on (a router that gives probability where it sends tokens), the loss is exactly 1 when the load is balanced and climbs to $\\symE = 4$ when every token goes to one expert. Turn it off and drag the purple bars alone: the red arrows are the gradient on each $\\symP_i$, proportional to that expert's share $\\symf_i$, so the busiest expert's probability is pushed down hardest.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: train a router, watch collapse and balance                      */
/* ------------------------------------------------------------------ */

const SEEDS = [4, 2, 5, 6, 7, 8];

export function figTrainer(p: Page): void {
  p.figure({
    title: 'Train a router: collapse, then balance',
    codeTitle: 'train_router.py',
    code: `
      alpha, gamma = {{alpha:0}}, {{gamma:0}}  # balancing
      for step in range(2000):    # step {{step:0}}
          probs = (X @ W_r + b_r).softmax(-1)   #@route
          choice = (probs + bias).argmax(-1)    #@route
          gate = probs[range(N), choice]
          out = (X * w[choice]).sum(-1) + c[choice]  #@expert
          y = gate * out          # Switch-style     #@expert
          task = ((y - t) ** 2).mean()   # {{task}}  #@task
          f = choice.bincount(minlength=E) / N       #@aux
          P = probs.mean(0)                          #@aux
          aux_loss = E * (f * P).sum()   # {{aux}}   #@aux
          loss = task + alpha * aux_loss             #@loss
          loss.backward(); opt.step(); opt.zero_grad()  #@update
          bias += gamma * (1 / E - f).sign()  # no grad  #@bias
    `,
    setup(f) {
      const data = toyData();
      let mode: Balance = 'none';
      let seedI = 0;
      const net = new ToyMoE(data, { mode, seed: SEEDS[0], alpha: 0.1, gamma: 0.005 });
      const E = net.E;
      const pr = new Float64Array(E);
      const pl = f.plot({
        aspect: 1.15,
        domain: TOY_DOMAIN,
        draw: (pp) => {
          const cols = Array.from({ length: E }, (_, e) => rgbOf(ek(e)));
          pp.field((a, b) => {
            const e = net.route(a, b, pr);
            const [r, g, bb] = cols[e]!;
            return [r, g, bb, 38];
          }, 6);
          const [c0, c1] = TOY_CENTER;
          pp.path([c0 - 1.15, c0 + 1.15], [c1, c1], withAlpha(color('--ink-3'), 0.6), 1, [4, 4]);
          pp.path([c0, c0], [c1 - 1.15, c1 + 1.15], withAlpha(color('--ink-3'), 0.6), 1, [4, 4]);
          for (let n = 0; n < data.n; n++) pp.dot(data.X[2 * n]!, data.X[2 * n + 1]!, 3.6, ek(net.assign[n]!), withAlpha(color('--paper'), 0.85));
          pp.text(`step ${net.steps}`, TOY_DOMAIN[0] + 0.05, TOY_DOMAIN[3] - 0.12, { size: 12, mono: true, color: color('--ink-2') });
        },
      });
      const panel = f.canvas(640, 190, (ctx, w, h) => {
        // Left: load per expert with the uniform line and a capacity of 1.25x.
        const lw = w * 0.46;
        const top = 22;
        const bottom = h - 26;
        const bh = bottom - top;
        const n = data.n;
        const scale = (v: number) => (v / n) * bh;
        txt(ctx, 'tokens per expert', 2, 13, { size: 11.5, weight: 600, color: color('--ink-2') });
        const colW = (lw - 62) / E;
        const C = Math.ceil((1.25 * n) / E);
        for (let e = 0; e < E; e++) {
          const cx = 4 + colW * (e + 0.5);
          const bw = colW * 0.6;
          const v = net.load[e]!;
          const hgt = scale(v);
          rbox(ctx, cx - bw / 2, bottom - hgt, bw, hgt, 3, withAlpha(ek(e), 0.75));
          if (v > C) {
            const over = scale(v) - scale(C);
            ctx.fillStyle = withAlpha(color('red'), 0.55);
            ctx.fillRect(cx - bw / 2, bottom - hgt, bw, over);
          }
          txt(ctx, String(v), cx, bottom + 15, { size: 11, mono: true, align: 'center', color: ek(e), weight: 600 });
        }
        dashLine(ctx, 2, bottom - scale(n / E), lw - 4, bottom - scale(n / E), color('--ink-2'), 1, [4, 3]);
        dashLine(ctx, 2, bottom - scale(C), lw - 4, bottom - scale(C), color('red'), 1, [2, 3]);
        txt(ctx, 'N/E', lw - 4, bottom - scale(n / E) + 12, { size: 11, mono: true, align: 'right', color: color('--ink-2'), halo: true });
        txt(ctx, 'cap 1.25', lw - 4, bottom - scale(C) - 4, { size: 11, align: 'right', color: color('red'), halo: true });
        // Right: task loss on a log scale.
        const x0 = lw + 18;
        const x1 = w - 4;
        txt(ctx, 'task loss (log scale)', x0, 13, { size: 11.5, weight: 600, color: color('--ink-2') });
        const lo = Math.log10(0.001);
        const hi = Math.log10(1);
        const sy = (v: number) => bottom - ((Math.log10(Math.max(v, 1e-3)) - lo) / (hi - lo)) * bh;
        const maxS = Math.max(TOY_STEPS, net.hist.length);
        const sxx = (i: number) => x0 + ((x1 - x0) * i) / maxS;
        ctx.strokeStyle = color('--grid');
        ctx.lineWidth = 1;
        for (const v of [1, 0.1, 0.01, 0.001]) {
          ctx.beginPath();
          ctx.moveTo(x0, sy(v));
          ctx.lineTo(x1, sy(v));
          ctx.stroke();
          txt(ctx, String(v), x1, sy(v) - 3, { size: 11, mono: true, align: 'right', color: color('--ink-3'), halo: true });
        }
        if (net.hist.length > 1) {
          ctx.beginPath();
          net.hist.forEach((hh, i) => (i ? ctx.lineTo(sxx(i), sy(hh.task)) : ctx.moveTo(sxx(i), sy(hh.task))));
          ctx.strokeStyle = color('red');
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        txt(ctx, 'steps', x0, bottom + 15, { size: 11, color: color('--ink-3') });
      });
      phoneAspect(panel.canvas, 340, 200);
      panel.canvas.classList.add('scroll-ok');
      pl.canvas.classList.add('scroll-ok');
      const taskRo = f.readout('task loss');
      const auxRo = f.readout('aux loss', { sym: 'L' });
      const dropRo = f.readout('dropped at capacity 1.25');
      const sync = () => {
        net.measure();
        taskRo.set(net.task.toFixed(4));
        auxRo.set(net.aux.toFixed(2));
        dropRo.set(`${Math.round(net.dropped(1.25) * 100)}%`);
        f.code.setMany({
          step: net.steps,
          task: net.task.toFixed(4),
          aux: net.aux.toFixed(2),
          alpha: mode === 'aux' ? fmt(net.alpha, 2) : '0',
          gamma: mode === 'bias' ? fmt(net.gamma, 2) : '0',
        });
        pl.redraw();
        panel.redraw();
      };
      let phase = 0;
      const loop = f.loop(() => {
        for (let i = 0; i < 8; i++) net.step();
        const lines = mode === 'aux' ? ['route', 'expert', 'task', 'aux', 'loss', 'update'] : mode === 'bias' ? ['route', 'expert', 'task', 'update', 'bias'] : ['route', 'expert', 'task', 'update'];
        f.code.highlight(lines[phase++ % lines.length]!);
        sync();
        if (net.steps >= TOY_STEPS) {
          stop();
          f.status(statusText());
          return false;
        }
      });
      const statusText = () => {
        const mx = Math.max(...net.load) / data.n;
        if (mx > 0.9) return `Collapsed: one expert takes ${Math.round(mx * 100)}% of the tokens and the other experts never train. Switch on a balancing method and press **Train** again.`;
        return `Every expert has a share near a quarter, and the task loss is far lower than one expert can reach alone. Press **Reset** for a different starting point.`;
      };
      const stop = () => {
        loop.stop();
        btn.textContent = 'Train';
        f.code.highlight(null);
      };
      const btn = f.button('Train', () => {
        if (loop.running()) {
          stop();
          return;
        }
        if (net.steps >= TOY_STEPS) {
          net.hist = [];
          net.steps = 0;
        }
        f.status('');
        loop.start();
        btn.textContent = 'Pause';
      }, { primary: true });
      f.button('Reset', () => {
        stop();
        seedI = (seedI + 1) % SEEDS.length;
        net.reset(SEEDS[seedI]!);
        f.status('');
        sync();
      });
      f.segmented({
        label: 'balancing',
        options: [
          { value: 'none', label: 'none' },
          { value: 'aux', label: 'aux loss' },
          { value: 'bias', label: 'bias terms' },
        ],
        value: 'none',
        onChange: (v) => {
          mode = v as Balance;
          net.mode = mode;
          aS.el.style.display = mode === 'aux' ? '' : 'none';
          gS.el.style.display = mode === 'bias' ? '' : 'none';
          sync();
        },
      });
      const aS = f.slider({
        label: 'α',
        min: -3,
        max: -0.5,
        step: 0.05,
        value: -1,
        map: (r) => 10 ** r,
        format: (v) => fmt(v, 2),
        onInput: (v) => {
          net.alpha = v;
          sync();
        },
      });
      const gS = f.slider({
        label: 'γ',
        min: 0.001,
        max: 0.02,
        step: 0.001,
        value: 0.005,
        format: (v) => fmt(v, 2),
        onInput: (v) => {
          net.gamma = v;
          sync();
        },
      });
      aS.el.style.display = 'none';
      gS.el.style.display = 'none';
      sync();
      f.status('Press **Train** with balancing set to *none* first.');
    },
    caption: `A small mixture of experts that really trains. Each of the 240 dots is a token (two numbers) carrying a target $|u_1| + |u_2|$, where $u$ is its offset from the center of the cloud: a square funnel with four flat faces, split by the dashed lines. Four linear experts and a linear top-1 router learn together. Dot color is the expert a token goes to; the shading is the router's decision regions. The tokens share an offset, as real token vectors share common directions, so at the start one expert wins most of them. **Train with no balancing**: the favored expert gets all the gradient, gets better, and takes the rest. That is expert collapse; the load bars show three idle experts, and with a capacity factor of 1.25 (explained below) over two thirds of the tokens would be dropped. Then pick **aux loss** and train on from where you are: the borders move, every expert gets about a quarter, and the task loss falls by a factor of about twenty, because now four experts can fit the four faces. Try $\\alpha$ = 0.001: too weak to pull the router out. The **bias terms** setting is DeepSeek-V3's loss-free method, explained further down.`,
  });
}
