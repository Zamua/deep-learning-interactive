import { fmt } from '../core/code';
import type { Page } from '../core/page';
import { type Plot, color, withAlpha } from '../core/plot';
import { type BarSet, MONO, UI, answerChart, halo, legend } from './dpo-draw';
import { DpoRun, KEYS, LOG_REF, N_PAIRS, PAIRS, PI_REF, R_TRUE, gapRun, kl, logSigmoid, objective, piStar, sigmoid, softmax } from './dpo-toy';

const f2 = (v: number) => fmt(v, 2);
const f3 = (v: number) => fmt(v, 3);
/** Python-ish float for code slots: always shows a decimal point. */
const pyf = (v: number, d = 3): string => {
  const s = fmt(v, d);
  return /[.e]/.test(s) || !Number.isFinite(v) ? s : `${s}.0`;
};
const logBeta = (r: number) => 10 ** r;

/** Pointer on a 4-bar chart -> answer index. */
const pickBar = (pl: Plot, e: PointerEvent) => Math.max(0, Math.min(3, Math.floor(pl.pointer(e)[0])));

/** Sets pi[i] = v and rescales the other three so the bars still sum to 1. */
function setShare(pi: number[], i: number, v: number): void {
  const vi = Math.max(0.004, Math.min(0.985, v));
  const rest = pi.reduce((a, p, k) => (k === i ? a : a + p), 0);
  for (let k = 0; k < pi.length; k++) pi[k] = k === i ? vi : rest > 0 ? (pi[k]! * (1 - vi)) / rest : (1 - vi) / 3;
}

// ---------------------------------------------------------------- Fig 1

export function figObjective(p: Page): void {
  p.figure({
    title: 'The best policy on a KL leash',
    codeTitle: 'kl_objective.py',
    code: `
      r = np.array([1.6, 0.9, -0.8, -1.4])     # A..D
      pi_ref = np.array([0.15, 0.45, 0.25, 0.15])
      pi = np.array([{{p0}}, {{p1}}, {{p2}}, {{p3}}])  # drag
      beta = {{beta:1}}

      reward = (pi * r).sum()                # {{er}}  #@obj
      kl = (pi * np.log(pi / pi_ref)).sum()  # {{kl}}  #@obj
      J = reward - beta * kl                 # {{J}}   #@obj

      pi_star = pi_ref * np.exp(r / beta)             #@star
      Z = pi_star.sum()                      # {{Z}}   #@star
      pi_star = pi_star / Z                           #@star
      # pi_star = [{{s0}}, {{s1}}, {{s2}}, {{s3}}]     #@star

      best = beta * np.log(Z)                # {{best}} #@best
      gap = beta * (pi * np.log(pi / pi_star)).sum()  #@best
      # best - J = gap = {{gap}}                      #@best
    `,
    setup(f) {
      const pi = [...PI_REF];
      let beta = 1;
      let showStar = true;
      const pl = f.plot({
        aspect: 1.45,
        square: false,
        draw: (pp) => {
          const st = piStar(beta).p;
          const sets: BarSet[] = [
            { vals: PI_REF, col: 'orange', kind: 'line', name: 'π_ref' },
            { vals: pi, col: 'blue', kind: 'fill', name: 'π (drag)' },
          ];
          if (showStar) sets.push({ vals: st, col: 'blue', kind: 'dash', name: 'π*' });
          answerChart(pp, sets, { values: 1, hot: drag });
        },
      });
      const erRo = f.readout('expected reward', { sym: 'r' });
      const klRo = f.readout('KL(π ‖ π_ref)');
      const jRo = f.readout('J');
      const bestRo = f.readout('best: β log Z');
      const sync = () => {
        const o = objective(pi, beta);
        const { p: st, Z } = piStar(beta);
        const best = beta * Math.log(Z);
        const gap = beta * kl(pi, st);
        f.code.setMany({
          p0: f2(pi[0]!), p1: f2(pi[1]!), p2: f2(pi[2]!), p3: f2(pi[3]!),
          er: f3(o.er), kl: f3(o.kl), J: f3(o.J), Z: f3(Z),
          s0: f2(st[0]!), s1: f2(st[1]!), s2: f2(st[2]!), s3: f2(st[3]!),
          best: f3(best), gap: f3(gap),
        });
        erRo.set(f3(o.er));
        klRo.set(f3(o.kl));
        jRo.set(f3(o.J));
        bestRo.set(f3(best));
        f.status(gap < 5e-4 ? `**J = ${f3(o.J)}: the maximum.** This is $\\sympistar$, and no other drag can beat it.` : `J = ${f3(o.J)}, short of the best ${f3(best)} by exactly $\\symbeta \\cdot \\mathrm{KL}(\\sympi \\,\\|\\, \\sympistar)$ = ${f3(gap)}.`);
        pl.redraw();
      };
      let drag = -1;
      pl.canvas.addEventListener('pointerdown', (e) => {
        drag = pickBar(pl, e);
        pl.canvas.setPointerCapture(e.pointerId);
        move(e);
      });
      const move = (e: PointerEvent) => {
        if (drag < 0) return;
        setShare(pi, drag, pl.pointer(e)[1]);
        f.code.highlight('obj');
        sync();
      };
      pl.canvas.addEventListener('pointermove', move);
      const up = () => {
        drag = -1;
        pl.redraw();
      };
      pl.canvas.addEventListener('pointerup', up);
      pl.canvas.addEventListener('pointercancel', up);
      f.slider({
        label: 'β',
        sym: 'beta',
        min: -1,
        max: Math.log10(5),
        step: 0.01,
        value: 0,
        map: logBeta,
        format: f2,
        slot: 'beta',
        onInput: (v) => {
          beta = v;
          f.code.highlight('star');
          sync();
        },
      });
      f.toggle({ label: 'show π*', value: true, onChange: (v) => { showStar = v; pl.redraw(); } });
      f.button('Jump to π*', () => {
        const st = piStar(beta).p;
        st.forEach((v, i) => (pi[i] = v));
        f.code.highlight('best');
        sync();
      }, { primary: true });
      f.button('Reset to π_ref', () => {
        PI_REF.forEach((v, i) => (pi[i] = v));
        f.code.highlight(null);
        sync();
      });
      sync();
    },
    caption: `One prompt, four answers. The orange bars are the reference model $\\sympiref$; the blue bars are a policy $\\sympi$ you control. **Drag a blue bar** up or down (the other three rescale so the total stays 1) and try to make $J$, expected reward minus $\\symbeta$ times the KL, as large as you can. You cannot beat the dashed outline $\\sympistar$, and the status line says exactly how far short you are. Then move $\\symbeta$: a small $\\symbeta$ (a loose leash) lets $\\sympistar$ pile onto the best answer A, a large one keeps it close to $\\sympiref$, which prefers the rambling B.`,
  });
}

// ---------------------------------------------------------------- Fig 2

const PAIR_OPTS: [number, number][] = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3]];

export function figInvert(p: Page): void {
  p.figure({
    title: 'The reward hidden in a policy',
    codeTitle: 'implicit_reward.py',
    code: `
      r = np.array([1.6, 0.9, -0.8, -1.4]) + {{c:0}}
      beta = {{beta:1}}
      pi_star = pi_ref * np.exp(r / beta)             #@star
      Z = pi_star.sum()                      # {{Z}}   #@star
      pi_star = pi_star / Z                           #@star
      # pi_star = [{{s0}}, {{s1}}, {{s2}}, {{s3}}]     #@star

      r_hat = beta * np.log(pi_star / pi_ref)  # purple #@hat
      r_hat + beta * np.log(Z)   # == r (+{{blz}})     #@back

      y_w, y_l = {{yw:0}}, {{yl:1}}               # {{pair}}
      sigmoid(r[y_w] - r[y_l])               # {{pr}}  #@bt
      sigmoid(r_hat[y_w] - r_hat[y_l])       # {{ph}}  #@bt
    `,
    setup(f) {
      let beta = 1;
      let c = 0;
      let pair = 1;
      const pl = f.plot({
        aspect: 1.35,
        square: false,
        draw: (pp) => {
          const r = R_TRUE.map((v) => v + c);
          const { p: st, Z } = piStar(beta, r);
          const blz = beta * Math.log(Z);
          const rh = st.map((v, i) => beta * Math.log(v / PI_REF[i]!));
          const lo = Math.min(-4, ...rh, ...r) - 0.3;
          const hi = Math.max(4, ...rh, ...r) + 0.3;
          const topPx = 30;
          const botPx = 34;
          const per = (hi - lo) / Math.max(40, pp.h - topPx - botPx);
          pp.setDomain(0, 4, lo - botPx * per, hi + topPx * per);
          const ctx = pp.ctx;
          ctx.strokeStyle = color('--grid');
          ctx.lineWidth = 1;
          for (let g = Math.ceil(lo); g <= hi; g++) {
            ctx.beginPath();
            ctx.moveTo(0, Math.round(pp.sy(g)) + 0.5);
            ctx.lineTo(pp.w, Math.round(pp.sy(g)) + 0.5);
            ctx.stroke();
            if (g % 2 === 0) halo(pp, String(g), 3, pp.sy(g), { size: 10.5, mono: true, col: color('--ink-3') });
          }
          ctx.strokeStyle = color('--axis');
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, pp.sy(0));
          ctx.lineTo(pp.w, pp.sy(0));
          ctx.stroke();
          const [pw, plo] = PAIR_OPTS[pair]!;
          const bw = 0.27;
          for (let i = 0; i < 4; i++) {
            const inPair = i === pw || i === plo;
            const xr = i + 0.5 - bw * 0.55;
            const xh = i + 0.5 + bw * 0.55;
            const bar = (xc: number, v: number, col: string, a: number) => {
              const x0 = pp.sx(xc - bw / 2);
              const x1 = pp.sx(xc + bw / 2);
              ctx.fillStyle = withAlpha(col, a);
              ctx.fillRect(x0, Math.min(pp.sy(0), pp.sy(v)), x1 - x0, Math.abs(pp.sy(v) - pp.sy(0)));
              ctx.strokeStyle = col;
              ctx.lineWidth = inPair ? 2 : 1;
              ctx.strokeRect(x0, Math.min(pp.sy(0), pp.sy(v)), x1 - x0, Math.abs(pp.sy(v) - pp.sy(0)));
            };
            bar(xr, r[i]!, color('gold'), inPair ? 0.75 : 0.4);
            bar(xh, rh[i]!, color('purple'), inPair ? 0.75 : 0.4);
            // r_hat + beta log Z, drawn on top of the purple bar, lands on the gold bar's top.
            const x0 = pp.sx(xh - bw / 2);
            const x1 = pp.sx(xh + bw / 2);
            ctx.save();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = color('slate');
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x0 + 2, Math.min(pp.sy(rh[i]!), pp.sy(r[i]!)), x1 - x0 - 4, Math.abs(pp.sy(r[i]!) - pp.sy(rh[i]!)));
            ctx.restore();
            ctx.fillStyle = color('--ink');
            ctx.font = `700 13px ${UI}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const by = pp.sy(lo) + 6;
            ctx.fillText(KEYS[i]!, pp.sx(i + 0.5), by);
            if (inPair) {
              ctx.fillStyle = color(i === pw ? 'green' : 'red');
              ctx.font = `600 11px ${UI}`;
              ctx.fillText(i === pw ? 'y_w' : 'y_l', pp.sx(i + 0.5), by + 15);
            }
          }
          legend(pp, [
            { name: 'r', col: 'gold', kind: 'fill' },
            { name: 'r̂ = β log(π*/π_ref)', col: 'purple', kind: 'fill' },
            { name: `+ β log Z = ${f2(blz)}`, col: 'slate', kind: 'dash' },
          ]);
        },
      });
      pl.canvas.classList.add('scroll-ok');
      const prRo = f.readout('P from r', { sym: 'r' });
      const phRo = f.readout('P from r̂', { sym: 'm' });
      const sync = () => {
        const r = R_TRUE.map((v) => v + c);
        const { p: st, Z } = piStar(beta, r);
        const rh = st.map((v, i) => beta * Math.log(v / PI_REF[i]!));
        const [w, l] = PAIR_OPTS[pair]!;
        const pr = sigmoid(r[w]! - r[l]!);
        const ph = sigmoid(rh[w]! - rh[l]!);
        f.code.setMany({
          Z: f3(Z), blz: f3(beta * Math.log(Z)),
          s0: f2(st[0]!), s1: f2(st[1]!), s2: f2(st[2]!), s3: f2(st[3]!),
          yw: w, yl: l, pair: `${KEYS[w]} vs ${KEYS[l]}`, pr: f3(pr), ph: f3(ph),
        });
        prRo.set(f3(pr));
        phRo.set(f3(ph));
        pl.redraw();
      };
      const cS = f.slider({
        label: 'add c to every reward',
        sym: 'r',
        min: -2,
        max: 2,
        step: 0.1,
        value: 0,
        slot: 'c',
        format: (v) => (v >= 0 ? `${pyf(v, 2)}` : pyf(v, 2)),
        onInput: (v) => {
          c = v;
          f.code.highlight(['star', 'back']);
          sync();
        },
      });
      cS.el.style.flexBasis = '100%';
      const bS = f.slider({
        label: 'β',
        sym: 'beta',
        min: -1,
        max: Math.log10(5),
        step: 0.01,
        value: 0,
        map: logBeta,
        format: f2,
        slot: 'beta',
        onInput: (v) => {
          beta = v;
          f.code.highlight(['hat', 'back']);
          sync();
        },
      });
      bS.el.style.flexBasis = '100%';
      f.segmented({
        label: 'pair',
        options: PAIR_OPTS.map(([w, l], k) => ({ value: String(k), label: `${KEYS[w]} vs ${KEYS[l]}` })),
        value: '1',
        onChange: (v) => {
          pair = Number(v);
          f.code.highlight('bt');
          sync();
        },
      });
      sync();
    },
    caption: `Gold bars are the rewards; purple bars are the *implicit* rewards $\\symbeta \\log(\\sympistar / \\sympiref)$ read off the optimal policy. Each purple bar falls short of its gold bar by the same amount, $\\symbeta \\log \\symZ$ (the dashed slate boxes), so the purple bars are the gold ones slid down together. Slide **c** to add a constant to every reward: the gold bars move, but $\\sympistar$ and the purple bars do not budge, because $e^{c/\\symbeta}$ multiplies every answer equally and divides back out in $\\symZ$. Pick a pair: the Bradley-Terry probability computed from $\\symr$ and from $\\hat r$ is the same number, because only differences enter it.`,
  });
}

// ---------------------------------------------------------------- Fig 3

export function figLoss(p: Page): void {
  p.figure({
    title: 'The DPO loss and its gradient weight',
    codeTitle: 'dpo_loss.py',
    code: `
      def dpo_loss(logp_w, logp_l, ref_w, ref_l,
                   beta):
          h = ((logp_w - ref_w)            #@h
               - (logp_l - ref_l))         #@h
          margin = beta * h                #@m
          loss = -log_sigmoid(margin)      #@loss
          weight = sigmoid(-margin)        #@w
          return loss, weight

      # h = {{h:0}}, beta = {{beta:0.5}}
      # margin = {{m:0}}   P(y_w wins) = {{p:0.5}}
      # loss = {{loss:0.693}}   weight = {{w:0.5}}
    `,
    setup(f) {
      let beta = 0.5;
      let h = 0;
      const H = 12;
      const pl = f.plot({
        aspect: 1.45,
        square: false,
        domain: [-H, H, -0.5, 3.4],
        draw: (pp) => {
          const ctx = pp.ctx;
          const per = 3.05 / Math.max(40, pp.h - 30 - 38);
          pp.setDomain(-H, H, -38 * per, 3.05 + 30 * per);
          ctx.strokeStyle = color('--grid');
          ctx.lineWidth = 1;
          for (let x = -H; x <= H; x += 4) {
            ctx.beginPath();
            ctx.moveTo(Math.round(pp.sx(x)) + 0.5, pp.sy(3.05));
            ctx.lineTo(Math.round(pp.sx(x)) + 0.5, pp.sy(0));
            ctx.stroke();
          }
          for (let y = 0.5; y <= 3; y += 0.5) {
            ctx.beginPath();
            ctx.moveTo(0, Math.round(pp.sy(y)) + 0.5);
            ctx.lineTo(pp.w, Math.round(pp.sy(y)) + 0.5);
            ctx.stroke();
          }
          ctx.strokeStyle = color('--axis');
          ctx.beginPath();
          ctx.moveTo(0, pp.sy(0));
          ctx.lineTo(pp.w, pp.sy(0));
          ctx.moveTo(pp.sx(0), pp.sy(3.05));
          ctx.lineTo(pp.sx(0), pp.sy(0));
          ctx.stroke();
          for (let x = -H + 4; x < H; x += 4) halo(pp, String(x), pp.sx(x), pp.sy(0) + 9, { size: 10.5, mono: true, align: 'center', col: color('--ink-3') });
          for (const y of [1, 2, 3]) halo(pp, String(y), 3, pp.sy(y), { size: 10.5, mono: true, col: color('--ink-3') });
          halo(pp, 'log-ratio gap h  →', pp.w - 6, pp.sy(0) + 26, { size: 11, align: 'right', col: color('--ink-3') });
          halo(pp, '← rejected favored', 6, pp.sy(0) + 26, { size: 11, col: color('--ink-3') });
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 26, pp.w, pp.h);
          ctx.clip();
          pp.fn((x) => -logSigmoid(beta * x), color('--ink'), 2.5);
          pp.fn((x) => sigmoid(-beta * x), color('teal'), 2.5);
          ctx.restore();
          pp.path([-H, 0], [Math.LN2, Math.LN2], withAlpha(color('--ink-3'), 0.9), 1.2, [4, 3]);
          // the marker
          const L = -logSigmoid(beta * h);
          const W = sigmoid(-beta * h);
          pp.path([h, h], [0, 3.05], color('purple'), 1.5, [5, 4]);
          if (pp.sy(L) > 30) pp.dot(h, L, 6, color('--ink'), color('--card'));
          pp.dot(h, W, 6, color('teal'), color('--card'));
          legend(pp, [
            { name: 'loss −log σ(βh)', col: '--ink', kind: 'curve' },
            { name: 'weight σ(−βh)', col: 'teal', kind: 'curve' },
          ]);
        },
      });
      const mRo = f.readout('margin m = βh', { sym: 'm' });
      const lRo = f.readout('loss');
      const wRo = f.readout('weight');
      const pRo = f.readout('P(y_w wins)');
      const sync = () => {
        const m = beta * h;
        const L = -logSigmoid(m);
        const W = sigmoid(-m);
        f.code.setMany({ h: f2(h), m: f2(m), p: f3(sigmoid(m)), loss: f3(L), w: f3(W) });
        mRo.set(f2(m));
        lRo.set(f3(L));
        wRo.set(f3(W));
        pRo.set(f3(sigmoid(m)));
        pl.redraw();
      };
      let dragging = false;
      const setH = (e: PointerEvent) => {
        h = Math.round(Math.max(-H, Math.min(H, pl.pointer(e)[0])) * 10) / 10;
        f.code.highlight(['h', 'm', 'loss', 'w']);
        sync();
      };
      pl.canvas.addEventListener('pointerdown', (e) => {
        dragging = true;
        pl.canvas.setPointerCapture(e.pointerId);
        setH(e);
      });
      pl.canvas.addEventListener('pointermove', (e) => dragging && setH(e));
      pl.canvas.addEventListener('pointerup', () => (dragging = false));
      f.slider({
        label: 'β',
        sym: 'beta',
        min: Math.log10(0.05),
        max: Math.log10(2),
        step: 0.01,
        value: Math.log10(0.5),
        map: logBeta,
        format: f2,
        slot: 'beta',
        onInput: (v) => {
          beta = v;
          f.code.highlight(['m', 'loss']);
          sync();
        },
      });
      sync();
    },
    caption: `The horizontal axis is the log-ratio gap $h$: how much more the policy has raised the chosen answer (relative to $\\sympiref$) than the rejected one. The implicit reward margin is $\\symm = \\symbeta h$. **Drag** across the plot. At $h = 0$, where every run starts because $\\sympi = \\sympiref$, the loss is $\\log 2 \\approx 0.693$ (dashed) and the weight is one half. To the right the pair is already ranked correctly, the loss flattens and the weight fades; to the left the loss climbs in a straight line and the weight approaches 1. Now shrink $\\symbeta$: both curves stretch sideways, so the same loss needs a much larger change in log-probabilities.`,
  });
}

// ---------------------------------------------------------------- Fig 4

const BATCH: [number, number][] = [[0, 1], [1, 2], [0, 2], [1, 3], [2, 3], [1, 0]];

export function figPush(p: Page): void {
  p.figure({
    title: 'Where one DPO step pushes',
    codeTitle: 'dpo_step.py',
    code: `
      batch = [(A, B), (B, C), (A, C),
               (B, D), (C, D), (B, A)]   # (y_w, y_l)
      y_w, y_l = np.array(batch).T
      beta, lr = 1.0, 0.5

      logp = theta - logsumexp(theta)                 #@m
      h = ((logp[y_w] - logp_ref[y_w])                #@m
           - (logp[y_l] - logp_ref[y_l]))             #@m
      margin = beta * h                               #@m
      weight = {{wexpr:sigmoid(-margin)}}             #@w
      push = np.zeros(4)      # one per answer logit  #@push
      np.add.at(push, y_w, +beta * weight)            #@push
      np.add.at(push, y_l, -beta * weight)            #@push
      # push = [{{g0}}, {{g1}}, {{g2}}, {{g3}}]        #@push
      theta = theta + lr * push     # step {{t:0}}    #@step
    `,
    setup(f) {
      const theta = [...LOG_REF];
      let naive = false;
      let t = 0;
      const beta = 1;
      const calc = () => {
        const pi = softmax(theta);
        const lp = pi.map(Math.log);
        const rows = BATCH.map(([w, l]) => {
          const m = beta * (lp[w]! - LOG_REF[w]! - (lp[l]! - LOG_REF[l]!));
          const mr = Math.abs(m) < 1e-9 ? 0 : m;
          return { w, l, m: mr, wt: naive ? 0.5 : sigmoid(-mr) };
        });
        const push = [0, 0, 0, 0];
        for (const r of rows) {
          push[r.w]! += beta * r.wt;
          push[r.l]! -= beta * r.wt;
        }
        return { pi, rows, push };
      };
      let st = calc();
      const pl = f.plot({
        aspect: 1.7,
        square: false,
        draw: (pp) => {
          const { x } = answerChart(pp, [
            { vals: PI_REF, col: 'orange', kind: 'line', name: 'π_ref' },
            { vals: st.pi, col: 'blue', kind: 'fill', name: 'π (drag)' },
          ], { hot: drag, extra: [{ name: 'push on its logit', col: 'teal', kind: 'curve' }] });
          for (let i = 0; i < 4; i++) {
            const g = st.push[i]!;
            const xc = x(i, 1);
            const top = st.pi[i]! + 0.03;
            const len = Math.max(0, Math.min(0.32, Math.abs(g) * 0.3, 1.02 - top));
            if (Math.abs(g) >= 0.01 && len > 0.02) {
              if (g > 0) pp.arrow(xc, top, xc, top + len, color('teal'), 2.5);
              else pp.arrow(xc, top + len, xc, top, color('teal'), 2.5);
            }
            const lab = Math.abs(g) < 0.005 ? '0' : (g > 0 ? '+' : '') + f2(g);
            const ly = pp.sy(top + len) - 9;
            if (ly > 34) halo(pp, lab, pp.sx(xc), ly, { size: 11, bold: true, mono: true, align: 'center', col: color('teal') });
            else halo(pp, lab, pp.sx(xc) - 6, pp.sy(st.pi[i]!) + 14, { size: 11, bold: true, mono: true, align: 'right', col: color('teal') });
          }
        },
      });
      const rowsCv = f.canvas(640, 270, (ctx, w, h) => {
        const rh = h / 7;
        const fs = Math.max(11, Math.min(14, rh * 0.42));
        const c0 = w * 0.03;
        const cM = w * 0.2;
        const cMw = w * 0.4;
        const cW = w * 0.66;
        const cWw = w * 0.28;
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${fs * 0.9}px ${UI}`;
        ctx.fillStyle = color('--ink-3');
        ctx.textAlign = 'left';
        ctx.fillText('pair', c0, rh * 0.5);
        ctx.textAlign = 'center';
        ctx.fillStyle = color('purple');
        ctx.fillText('margin m', cM + cMw / 2, rh * 0.5);
        ctx.fillStyle = color('teal');
        ctx.fillText(naive ? 'weight (naive ½)' : 'weight σ(−m)', cW + cWw / 2, rh * 0.5);
        st.rows.forEach((r, k) => {
          const y = rh * (k + 1.5);
          ctx.textAlign = 'left';
          ctx.font = `700 ${fs}px ${UI}`;
          ctx.fillStyle = color('green');
          ctx.fillText(KEYS[r.w]!, c0, y);
          const ww = ctx.measureText(KEYS[r.w]!).width;
          ctx.fillStyle = color('--ink-3');
          ctx.font = `${fs}px ${UI}`;
          ctx.fillText(' ≻ ', c0 + ww, y);
          const w2 = ctx.measureText(' ≻ ').width;
          ctx.font = `700 ${fs}px ${UI}`;
          ctx.fillStyle = color('red');
          ctx.fillText(KEYS[r.l]!, c0 + ww + w2, y);
          if (k === 5) {
            ctx.font = `${fs * 0.82}px ${UI}`;
            ctx.fillStyle = color('--ink-3');
            ctx.fillText(' noisy', c0 + ww + w2 + ctx.measureText('A').width + 2, y);
          }
          // margin, centered, range +-4
          const mid = cM + cMw / 2;
          ctx.fillStyle = withAlpha(color('--ink-3'), 0.12);
          ctx.fillRect(cM, y - rh * 0.3, cMw, rh * 0.6);
          ctx.fillStyle = color('--axis');
          ctx.fillRect(mid - 0.5, y - rh * 0.36, 1, rh * 0.72);
          const mm = Math.max(-4, Math.min(4, r.m));
          ctx.fillStyle = withAlpha(color('purple'), 0.75);
          ctx.fillRect(Math.min(mid, mid + (mm / 4) * (cMw / 2)), y - rh * 0.22, Math.abs((mm / 4) * (cMw / 2)), rh * 0.44);
          ctx.fillStyle = color('--ink');
          ctx.font = `500 ${fs * 0.85}px ${MONO}`;
          ctx.textAlign = mm >= 0 ? 'right' : 'left';
          ctx.fillText(fmt(r.m, 2), mm >= 0 ? mid - 4 : mid + 4, y);
          // weight
          ctx.fillStyle = withAlpha(color('teal'), 0.12);
          ctx.fillRect(cW, y - rh * 0.3, cWw, rh * 0.6);
          ctx.fillStyle = withAlpha(color('teal'), 0.8);
          ctx.fillRect(cW, y - rh * 0.22, cWw * r.wt, rh * 0.44);
          ctx.fillStyle = color('--ink');
          ctx.textAlign = 'right';
          ctx.fillText(fmt(r.wt, 2), cW + cWw - 3, y);
        });
      });
      rowsCv.canvas.classList.add('scroll-ok');
      const sync = () => {
        st = calc();
        f.code.setMany({ g0: f2(st.push[0]!), g1: f2(st.push[1]!), g2: f2(st.push[2]!), g3: f2(st.push[3]!), t });
        pl.redraw();
        rowsCv.redraw();
      };
      let drag = -1;
      pl.canvas.addEventListener('pointerdown', (e) => {
        drag = pickBar(pl, e);
        pl.canvas.setPointerCapture(e.pointerId);
        move(e);
      });
      const move = (e: PointerEvent) => {
        if (drag < 0) return;
        const pi = softmax(theta);
        setShare(pi, drag, pl.pointer(e)[1]);
        pi.forEach((v, i) => (theta[i] = Math.log(v)));
        f.code.highlight(['m', 'w']);
        sync();
      };
      pl.canvas.addEventListener('pointermove', move);
      const up = () => {
        drag = -1;
        pl.redraw();
      };
      pl.canvas.addEventListener('pointerup', up);
      pl.canvas.addEventListener('pointercancel', up);
      f.button('Step', () => {
        for (let i = 0; i < 4; i++) theta[i]! += 0.5 * st.push[i]!;
        t++;
        f.code.highlight('step');
        sync();
      }, { primary: true });
      f.button('Reset', () => {
        LOG_REF.forEach((v, i) => (theta[i] = v));
        t = 0;
        f.code.highlight(null);
        sync();
      });
      f.toggle({
        label: 'naive: weight ½ always',
        value: false,
        onChange: (v) => {
          naive = v;
          f.code.set('wexpr', v ? '0.5 * np.ones(6)' : 'sigmoid(-margin)');
          f.code.highlight('w');
          sync();
        },
      });
      sync();
    },
    caption: `A mini-batch of six pairs for our prompt; the last one is a noisy label that contradicts the first. Teal arrows show the push each answer's logit gets from one step: $+\\symbeta$ times the weight for every pair it wins, minus that for every pair it loses. At the start ($\\sympi = \\sympiref$) every margin is 0 and every pair weighs one half. **Press Step** several times: pairs the policy already ranks correctly fade toward weight 0 and stop pulling, while the two contradicting A and B pairs stay near one half and hold each other in check (whichever answer pulls ahead, the other pair's weight grows and pulls it back). You can also **drag** a blue bar to see how the weights react. Then switch on the naive version, which pushes every pair equally forever: B wins the most pairs here, so it keeps climbing without end.`,
  });
}

// ---------------------------------------------------------------- Fig 5

export function figRun(p: Page): void {
  const counts = PAIRS.map((row, w) => row.map((c, l) => ({ w, l, c })).filter((x) => x.c > 0)).flat();
  p.figure({
    title: 'A toy policy over four answers, trained with DPO',
    codeTitle: 'train_dpo.py',
    code: `
      pairs = load_pairs()     # 1,000 fixed (y_w, y_l)
      y_w, y_l = pairs.T
      theta = np.log(pi_ref)   # start at the reference
      beta, lr = {{beta:0.5}}, 0.05

      for step in range(400):              # {{step:0}}
          logp = theta - logsumexp(theta)             #@fwd
          margin = beta * ((logp[y_w] - logp_ref[y_w])  #@fwd
                    - (logp[y_l] - logp_ref[y_l]))    #@fwd
          loss = -log_sigmoid(margin).mean()  # {{loss:0.693}}  #@loss
          weight = sigmoid(-margin)                   #@grad
          grad = np.zeros(4)                          #@grad
          np.add.at(grad, y_w, -beta * weight)        #@grad
          np.add.at(grad, y_l, +beta * weight)        #@grad
          theta = adam(theta, grad / len(pairs), lr)  #@step
      # not one answer is sampled in this loop
    `,
    setup(f) {
      let run = new DpoRun(0.5);
      const MAX = 400;
      const pl = f.plot({
        aspect: 1.5,
        square: false,
        draw: (pp) => {
          answerChart(pp, [
            { vals: PI_REF, col: 'orange', kind: 'line', name: 'π_ref' },
            { vals: run.pi, col: 'blue', kind: 'fill', name: 'π_θ' },
            { vals: piStar(run.beta).p, col: 'blue', kind: 'dash', name: 'π* (RLHF optimum)' },
          ], { values: 1 });
        },
      });
      pl.canvas.classList.add('scroll-ok');
      const curve = f.plot({
        height: 120,
        square: false,
        draw: (pp) => {
          const L = run.losses;
          pp.setDomain(-MAX * 0.02, MAX * 1.02, 0.34, 0.84);
          const ctx = pp.ctx;
          ctx.strokeStyle = color('--grid');
          ctx.lineWidth = 1;
          for (const y of [0.4, 0.5, 0.6, 0.7, 0.8]) {
            ctx.beginPath();
            ctx.moveTo(0, Math.round(pp.sy(y)) + 0.5);
            ctx.lineTo(pp.w, Math.round(pp.sy(y)) + 0.5);
            ctx.stroke();
            halo(pp, y.toFixed(1), 3, pp.sy(y), { size: 10.5, mono: true, col: color('--ink-3') });
          }
          pp.path([0, MAX], [Math.LN2, Math.LN2], withAlpha(color('--ink-3'), 0.8), 1, [3, 3]);
          if (L.length > 1) pp.path(L.map((_, i) => i), L, color('--ink'), 2);
          halo(pp, 'loss over 400 steps (dashed: log 2)', pp.w - 6, 11, { size: 11, align: 'right', col: color('--ink-2') });
        },
      });
      curve.canvas.classList.add('scroll-ok');
      const stepRo = f.readout('step');
      const lossRo = f.readout('loss');
      const accRo = f.readout('reward accuracy');
      const klRo = f.readout('KL(π_θ ‖ π*)');
      const sampRo = f.readout('answers sampled');
      const sync = () => {
        f.code.setMany({ step: run.t, loss: f3(run.loss) });
        stepRo.set(run.t);
        lossRo.set(f3(run.loss));
        accRo.set(`${Math.round(run.acc * 100)}%`);
        klRo.set(fmt(kl(run.pi, piStar(run.beta).p), 2));
        sampRo.set(0);
        pl.redraw();
        curve.redraw();
      };
      let k = 0;
      const loop = f.loop(() => {
        for (let s = 0; s < 3 && run.t < MAX; s++) run.step();
        f.code.highlight(['fwd', 'loss', 'grad', 'step'][k++ % 4]!);
        sync();
        if (run.t >= MAX) {
          stop();
          f.status(`Done. $\\sympi$ sits on the dashed $\\sympistar$, the policy RLHF would aim for, and the loss has settled near ${f3(run.loss)}, not 0: the labels are noisy, so even the true reward ranks only about ${Math.round(run.acc * 100)}% of the pairs the way the labelers did.`);
          return false;
        }
      });
      const stop = () => {
        loop.stop();
        btn.textContent = 'Train';
        f.code.highlight(null);
      };
      const btn = f.button('Train', () => {
        if (loop.running()) stop();
        else {
          if (run.t >= MAX) run = new DpoRun(run.beta);
          loop.start();
          btn.textContent = 'Pause';
          f.status('');
        }
      }, { primary: true });
      f.button('Reset', () => {
        stop();
        run = new DpoRun(run.beta);
        f.status('');
        sync();
      });
      f.slider({
        label: 'β',
        sym: 'beta',
        min: -1,
        max: Math.log10(3),
        step: 0.01,
        value: Math.log10(0.5),
        map: logBeta,
        format: f2,
        slot: 'beta',
        onInput: (v) => {
          stop();
          run = new DpoRun(v);
          f.status('');
          sync();
        },
      });
      const top = [...counts].sort((a, b) => b.c - a.c).slice(0, 4);
      f.status(`The data: ${N_PAIRS.toLocaleString()} pairs sampled once from $\\sympiref$ and labeled by a noisy Bradley-Terry labeler, for example ${top.map((x) => `${KEYS[x.w]} ≻ ${KEYS[x.l]} (${x.c})`).join(', ')}. Press **Train**.`);
      sync();
    },
    caption: `Training starts with $\\sympi = \\sympiref$ and only ever reads the fixed list of pairs: no reward model is trained and no answer is generated. The dashed outline is $\\sympistar$, the optimum of the KL-regularized RLHF objective for this $\\symbeta$, computed from the true rewards that the DPO loop never sees. Train and watch the blue bars land on it (up to the noise of a finite dataset). Move $\\symbeta$ and train again: small $\\symbeta$ lets the policy move far from $\\sympiref$ toward the best answer A; large $\\symbeta$ keeps it near $\\sympiref$. Reward accuracy, the share of pairs where the implicit reward agrees with the label, stops well short of 100% because the labels themselves are noisy.`,
  });
}

// ---------------------------------------------------------------- Fig 6

export function figCertain(p: Page): void {
  p.figure({
    title: 'When every label agrees: DPO keeps pushing, IPO stops',
    codeTitle: 'dpo_vs_ipo.py',
    code: `
      q = {{q:1}}          # share of labels: A beats B
      beta = {{beta:0.2}}  # IPO calls it tau
      # equal pi_ref, so h = log pi(A) - log pi(B)

      def dpo(h):       # loss averaged over the labels
          return -(q * log_sigmoid(beta * h)
                   + (1 - q) * log_sigmoid(-beta * h))  #@dpo

      def ipo(h):
          c = 1 / (2 * beta)       # {{c}}: target per label
          return q * (h - c)**2 + (1 - q) * (h + c)**2  #@ipo

      # after {{t:0}} Adam steps on h:
      # DPO  h = {{hd}}  best {{dstar}}  pi(B) = {{pbd}}
      # IPO  h = {{hi}}  best {{istar}}  pi(B) = {{pbi}}
    `,
    setup(f) {
      let q = 1;
      let beta = 0.2;
      const T = 600;
      let dpo = gapRun('dpo', q, beta, T);
      let ipo = gapRun('ipo', q, beta, T);
      let shown = 0;
      const dStar = () => (q >= 0.999 ? Infinity : Math.log(q / (1 - q)) / beta);
      const iStar = () => (2 * q - 1) / (2 * beta);
      const pl = f.plot({
        aspect: 1.5,
        square: false,
        draw: (pp) => {
          const n = Math.max(1, Math.floor(shown));
          let ymax = Math.max(4, iStar() * 1.15, ...Array.from(dpo.subarray(0, n + 1)).map((v) => v * 1.1));
          const ds = dStar();
          if (Number.isFinite(ds)) ymax = Math.max(ymax, Math.min(ds * 1.1, 60));
          const per = ymax / Math.max(40, pp.h - 58);
          pp.setDomain(-T * 0.02, T * 1.04, -26 * per, ymax + 32 * per);
          const ctx = pp.ctx;
          const stepY = ymax > 30 ? 10 : ymax > 12 ? 5 : ymax > 6 ? 2 : 1;
          ctx.strokeStyle = color('--grid');
          ctx.lineWidth = 1;
          for (let y = stepY; y <= ymax; y += stepY) {
            ctx.beginPath();
            ctx.moveTo(0, Math.round(pp.sy(y)) + 0.5);
            ctx.lineTo(pp.w, Math.round(pp.sy(y)) + 0.5);
            ctx.stroke();
            halo(pp, String(y), 3, pp.sy(y), { size: 10.5, mono: true, col: color('--ink-3') });
          }
          ctx.strokeStyle = color('--axis');
          ctx.beginPath();
          ctx.moveTo(0, pp.sy(0));
          ctx.lineTo(pp.w, pp.sy(0));
          ctx.stroke();
          for (const x of [0, 200, 400]) halo(pp, String(x), pp.sx(x), pp.sy(0) + 13, { size: 10.5, mono: true, align: x ? 'center' : 'left', col: color('--ink-3') });
          halo(pp, '600 steps', pp.w - 4, pp.sy(0) + 13, { size: 10.5, mono: true, align: 'right', col: color('--ink-3') });
          const is = iStar();
          pp.path([0, T], [is, is], withAlpha(color('teal'), 0.9), 1.3, [5, 4]);
          if (Number.isFinite(ds) && ds < ymax) pp.path([0, T], [ds, ds], withAlpha(color('purple'), 0.9), 1.3, [5, 4]);
          const xs = Array.from({ length: n + 1 }, (_, i) => i);
          pp.path(xs, Array.from(ipo.subarray(0, n + 1)), color('teal'), 2.5);
          pp.path(xs, Array.from(dpo.subarray(0, n + 1)), color('purple'), 2.5);
          halo(pp, `IPO optimum ${f2(is)}`, pp.sx(T * 0.98), pp.sy(is) + 12, { size: 11, bold: true, align: 'right', col: color('teal') });
          if (Number.isFinite(ds) && ds < ymax) halo(pp, `DPO optimum ${f2(ds)}`, pp.sx(T * 0.98), pp.sy(ds) - 11, { size: 11, bold: true, align: 'right', col: color('purple') });
          else halo(pp, 'DPO: no finite optimum', pp.sx(T * 0.98), pp.sy(ymax) - 2, { size: 11, bold: true, align: 'right', col: color('purple') });
          legend(pp, [
            { name: 'DPO gap h', col: 'purple', kind: 'curve' },
            { name: 'IPO gap h', col: 'teal', kind: 'curve' },
          ]);
        },
      });
      pl.canvas.classList.add('scroll-ok');
      const pdRo = f.readout('π(B), DPO');
      const piRo = f.readout('π(B), IPO');
      const sync = () => {
        const n = Math.floor(shown);
        const hd = dpo[n]!;
        const hi = ipo[n]!;
        const ds = dStar();
        f.code.setMany({
          c: f2(1 / (2 * beta)), t: n, hd: f2(hd), hi: f2(hi),
          dstar: Number.isFinite(ds) ? f2(ds) : 'inf', istar: f2(iStar()),
          pbd: fmt(sigmoid(-hd), 2), pbi: fmt(sigmoid(-hi), 2),
        });
        pdRo.set(fmt(sigmoid(-hd), 2));
        piRo.set(fmt(sigmoid(-hi), 2));
        pl.redraw();
      };
      const recompute = () => {
        dpo = gapRun('dpo', q, beta, T);
        ipo = gapRun('ipo', q, beta, T);
        sync();
      };
      const loop = f.loop((dt) => {
        shown = Math.min(T, shown + dt * 200);
        f.code.highlight(['dpo', 'ipo']);
        sync();
        if (shown >= T) {
          loop.stop();
          btn.textContent = 'Train';
          f.code.highlight(null);
          return false;
        }
      });
      const btn = f.button('Train', () => {
        if (loop.running()) {
          loop.stop();
          btn.textContent = 'Train';
          return;
        }
        if (shown >= T) shown = 0;
        loop.start();
        btn.textContent = 'Pause';
      }, { primary: true });
      const qS = f.slider({
        label: 'share preferring A',
        min: 0.55,
        max: 1,
        step: 0.01,
        value: 1,
        slot: 'q',
        format: f2,
        onInput: (v) => {
          q = v;
          recompute();
        },
      });
      qS.el.style.flexBasis = '100%';
      const b6 = f.slider({
        label: 'β',
        sym: 'beta',
        min: -1,
        max: 0,
        step: 0.01,
        value: Math.log10(0.2),
        map: logBeta,
        format: f2,
        slot: 'beta',
        onInput: (v) => {
          beta = v;
          recompute();
        },
      });
      b6.el.style.flexBasis = '100%';
      shown = T;
      sync();
    },
    caption: `One prompt, two answers with equal reference probability, and a share $q$ of labels saying A beats B. Both losses train $h$, the log-ratio gap, with Adam. With $q$ = 1 every label agrees, the DPO loss keeps shrinking as $h$ grows, so it keeps pushing: $\\sympi(B)$ races toward 0 no matter what $\\symbeta$ says, and the KL leash is ignored. IPO's squared loss aims for a fixed gap of $1/(2\\symbeta)$ and stops there. Press **Train** to watch the runs, then lower $q$: once some labels disagree, DPO has a finite optimum too, at $\\log(q / (1-q)) / \\symbeta$, which still climbs steeply as $q$ approaches 1, while IPO's optimum $(2q - 1)/(2\\symbeta)$ never exceeds $1/(2\\symbeta)$.`,
  });
}
