import type { Page } from '../core/page';
import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import type { Color } from '../core/symbols';
import { ENTROPY, GROUP, GROUPS, NV, Q, TinyLM, WORDS } from './tokenization-embed';

const GROUP_COLORS: Color[] = ['gold', 'orange', 'blue', 'purple', 'red'];
const NAME = WORDS.map((w) => (w === '.' ? '"."' : w));

/* ------------------------------------------------------------------ */
/* Fig: a 2-D embedding space, trained live                             */
/* ------------------------------------------------------------------ */

export function figEmbedSpace(p: Page): void {
  p.figure({
    title: 'A 2-D embedding space, trained live',
    codeTitle: 'tiny_lm.py',
    code: `
      V, d = ${NV}, 2
      E = 0.5 * np.random.randn(V, d)  # embedding   #@init
      W = np.eye(d)    # stands in for a transformer
      U = 0.5 * np.random.randn(d, V)  # {{unote:unembedding}}  #@init
      b = np.zeros(V)

      for step in range(900):
          x = E[ids]           # (n, d)   #@embed
          h = x @ W            # (n, d)   #@block
          logits = h @ {{U:U}} + b   # (n, V)   #@unembed
          loss = xent(logits, next_ids)   #@loss
          # backprop, then Adam on all    #@update
      # step {{step:0}}  loss {{loss:…}}  best {{best}}
    `,
    setup(f) {
      let tied = false;
      let seed = 3;
      let lm = new TinyLM(tied, seed);
      let sel = WORDS.indexOf('cat');
      let R = 3;
      let showU = false;
      let lossNow = lm.loss();
      const want = () => {
        let m = 1.5;
        for (let t = 0; t < NV; t++) {
          m = Math.max(m, Math.abs(lm.E[2 * t]!), Math.abs(lm.E[2 * t + 1]!));
          if (!tied) {
            const [u0, u1] = lm.out(t);
            m = Math.max(m, Math.abs(u0), Math.abs(u1));
          }
        }
        return m * 1.18;
      };
      R = want();
      const pl = f.plot({
        aspect: 1.15,
        domain: [-R, R, -R, R],
        draw: (pp) => {
          pp.setDomain(-R, R, -R, R);
          pp.axes({ grid: R > 6 ? 2 : 1 });
          const c = pp.ctx;
          // output vectors
          const probs = lm.probs(sel);
          const top = probs.map((v, j) => [v, j] as const).sort((a, b) => b[0] - a[0]).slice(0, 3).map((x) => x[1]);
          const uLabels: [number, number, string, boolean][] = [];
          if (!tied) {
            for (let j = 0; j < NV; j++) {
              const [u0, u1] = lm.out(j);
              const X = pp.sx(u0), Y = pp.sy(u1);
              const hot = top.includes(j) && probs[j]! > 0.08;
              const a = showU || hot ? 0.95 : 0.35;
              c.strokeStyle = withAlpha(color('teal'), a);
              c.lineWidth = hot ? 2 : 1.3;
              c.beginPath();
              c.moveTo(X, Y - 5);
              c.lineTo(X + 5, Y);
              c.lineTo(X, Y + 5);
              c.lineTo(X - 5, Y);
              c.closePath();
              c.stroke();
              if (hot || showU) uLabels.push([X, Y, NAME[j]!, hot]);
            }
          }
          // h for the selected word
          // h can be much longer than the vectors around it; only its direction is drawn to scale beyond the frame
          let [h0, h1] = lm.hidden(sel);
          const hl = Math.hypot(h0, h1);
          if (hl > R * 0.9) {
            h0 *= (R * 0.9) / hl;
            h1 *= (R * 0.9) / hl;
          }
          pp.arrow(0, 0, h0, h1, color('green'), 2.4);
          pp.text('h', h0 + (h0 >= 0 ? R * 0.03 : -R * 0.03), h1 + R * 0.03, { size: 14, bold: true, color: color('green'), align: h0 >= 0 ? 'left' : 'right' });
          // embedding rows, with labels merged where points sit on top of each other
          type Cl = { X: number; Y: number; words: number[] };
          const cls: Cl[] = [];
          for (let t = 0; t < NV; t++) {
            const X = pp.sx(lm.E[2 * t]!), Y = pp.sy(lm.E[2 * t + 1]!);
            const hit = cls.find((q) => Math.hypot(q.X - X, q.Y - Y) < 20);
            if (hit) hit.words.push(t);
            else cls.push({ X, Y, words: [t] });
          }
          for (let t = 0; t < NV; t++) {
            const X = pp.sx(lm.E[2 * t]!), Y = pp.sy(lm.E[2 * t + 1]!);
            c.beginPath();
            c.arc(X, Y, t === sel ? 6.5 : 5, 0, Math.PI * 2);
            c.fillStyle = color(GROUP_COLORS[GROUP[t]!]!);
            c.fill();
            c.lineWidth = t === sel ? 2.5 : 1.2;
            c.strokeStyle = t === sel ? color('--ink') : color('--paper');
            c.stroke();
          }
          c.font = '600 12px system-ui, sans-serif';
          c.textAlign = 'left';
          c.textBaseline = 'middle';
          // place each label at the first of eight spots around its dot that hits nothing placed so far
          const taken: [number, number, number, number][] = cls.map((q) => [q.X - 6, q.Y - 6, q.X + 6, q.Y + 6]);
          const clash = (r: [number, number, number, number]) => r[0] < 2 || r[2] > pp.w - 2 || r[1] < 2 || r[3] > pp.h - 2 || taken.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]);
          for (const q of cls) {
            const label = q.words.map((t) => NAME[t]).join(', ');
            const wdt = c.measureText(label).width;
            const spots: [number, number][] = [[9, -9], [9, 9], [-9 - wdt, -9], [-9 - wdt, 9], [-wdt / 2, -16], [-wdt / 2, 16], [12, 0], [-12 - wdt, 0]];
            let pick = spots[0]!;
            for (const sp of spots) {
              const r: [number, number, number, number] = [q.X + sp[0], q.Y + sp[1] - 7, q.X + sp[0] + wdt, q.Y + sp[1] + 7];
              if (!clash(r)) {
                pick = sp;
                break;
              }
            }
            const tx = Math.min(pp.w - wdt - 2, Math.max(2, q.X + pick[0]));
            const ty = Math.min(pp.h - 9, Math.max(9, q.Y + pick[1]));
            taken.push([tx, ty - 7, tx + wdt, ty + 7]);
            c.lineWidth = 3;
            c.strokeStyle = color('--paper');
            c.strokeText(label, tx, ty);
            c.fillStyle = color(GROUP_COLORS[GROUP[q.words[0]!]!]!);
            c.fillText(label, tx, ty);
          }
          c.font = '500 11px system-ui, sans-serif';
          for (const [X, Y, label, hot] of uLabels) {
            const wdt = c.measureText(label).width;
            const spots: [number, number][] = [[8, 9], [8, -9], [-8 - wdt, 9], [-8 - wdt, -9], [-wdt / 2, 15], [-wdt / 2, -15]];
            const sp = spots.find((o) => !clash([X + o[0], Y + o[1] - 6, X + o[0] + wdt, Y + o[1] + 6]));
            if (!sp && !hot) continue;
            const [ox, oy] = sp ?? spots[0]!;
            taken.push([X + ox, Y + oy - 6, X + ox + wdt, Y + oy + 6]);
            c.lineWidth = 3;
            c.strokeStyle = color('--paper');
            c.strokeText(label, X + ox, Y + oy);
            c.fillStyle = color('teal');
            c.fillText(label, X + ox, Y + oy);
          }
        },
      });
      pl.canvas.classList.add('scroll-ok');
      const bars = f.canvas(640, 200, (c, w, hh) => {
        const probs = lm.probs(sel);
        const order = probs.map((v, j) => [v, j] as const).sort((a, b) => b[0] - a[0]).slice(0, 5);
        c.font = '600 12.5px system-ui, sans-serif';
        c.fillStyle = color('--ink-2');
        c.textAlign = 'left';
        c.textBaseline = 'top';
        c.fillText(`after “${WORDS[sel]}”: next-word probabilities (tick: true value)`, 4, 4);
        const top = 26;
        const rowH = (hh - top - 4) / 5;
        const lw = 62;
        const bw = w - lw - 60;
        order.forEach(([v, j], r) => {
          const y = top + r * rowH;
          c.font = "500 12.5px 'JetBrains Mono Variable', ui-monospace, monospace";
          c.fillStyle = color('--ink');
          c.textAlign = 'right';
          c.textBaseline = 'middle';
          c.fillText(WORDS[j]!, lw - 8, y + rowH / 2);
          c.fillStyle = withAlpha(color('purple'), 0.3 + 0.55 * v);
          c.fillRect(lw, y + rowH * 0.18, Math.max(2, bw * v), rowH * 0.64);
          const q = Q[sel]![j]!;
          c.fillStyle = color('--ink');
          c.fillRect(lw + bw * q - 1, y + rowH * 0.08, 2, rowH * 0.84);
          c.textAlign = 'left';
          c.fillStyle = color('--ink-2');
          c.fillText(`${(v * 100).toFixed(0)}%`, lw + Math.max(2, bw * v) + 6, y + rowH / 2);
        });
      });
      bars.canvas.classList.add('scroll-ok');
      const stepRo = f.readout('step');
      const lossRo = f.readout('loss');
      const sync = () => {
        stepRo.set(lm.steps);
        lossRo.set(fmt(lossNow, 3));
        f.code.setMany({ step: lm.steps, loss: fmt(lossNow, 3), best: fmt(ENTROPY, 3), U: tied ? 'E.T' : 'U', unote: tied ? 'unused' : 'unembedding' });
        pl.redraw();
        bars.redraw();
      };
      let phase = 0;
      const loop = f.loop(() => {
        for (let i = 0; i < 2; i++) lossNow = lm.step(0.02);
        lossNow = lm.loss();
        R += (want() - R) * 0.08;
        f.code.highlight((['embed', 'block', 'unembed', 'loss', 'update'] as const)[Math.floor(phase++ / 3) % 5]);
        sync();
        if (lm.steps >= 900) {
          stop();
          f.status(`Done: 900 steps, loss ${fmt(lossNow, 3)} against a best possible ${fmt(ENTROPY, 3)}. Tap any word to see where its \`h\` points.`);
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
          if (lm.steps >= 900) restart(seed);
          loop.start();
          btn.textContent = 'Pause';
          f.status('');
        }
      }, { primary: true });
      const restart = (s: number) => {
        seed = s;
        lm = new TinyLM(tied, seed);
        lossNow = lm.loss();
        R = want();
        sync();
      };
      f.button('New start', () => {
        stop();
        restart(seed + 1);
        f.status('A fresh random table. Press **Train**.');
      });
      f.toggle({
        label: 'tie U to E',
        value: false,
        onChange: (v) => {
          tied = v;
          stop();
          restart(seed);
          f.status(v ? 'Tied: each word has one vector, used both to read it and to predict it. Press **Train**.' : 'Untied: teal diamonds are the output vectors, the columns of `U`. Press **Train**.');
        },
      });
      f.toggle({
        label: 'label every output vector',
        value: false,
        onChange: (v) => {
          showU = v;
          pl.redraw();
        },
      });
      pl.canvas.addEventListener('pointerdown', (e) => {
        const r = pl.canvas.getBoundingClientRect();
        const px = e.clientX - r.left, py = e.clientY - r.top;
        let best = -1;
        let bd = 44;
        for (let t = 0; t < NV; t++) {
          const dd = Math.hypot(pl.sx(lm.E[2 * t]!) - px, pl.sy(lm.E[2 * t + 1]!) - py);
          if (dd < bd) {
            bd = dd;
            best = t;
          }
        }
        if (best >= 0) {
          sel = best;
          sync();
        }
      });
      f.onSym((k) => {
        showU = k === 'U';
        pl.redraw();
      });
      f.status('The table starts as random noise. Press **Train**, then tap any word.');
      sync();
    },
    caption: `A language with ${NV} words and one grammar rule: *determiner, maybe an adjective, noun, verb, full stop*, where cats and dogs run or sleep, birds fly or sleep, and fish swim. Each dot is a row of $\\symE$; colors mark ${GROUPS.map((g, i) => `<span style="color:var(--c-${GROUP_COLORS[i]})">${g}s</span>`).join(', ').replace('full stops', 'the full stop')}, but the model is never told them. Press **Train**: words that are followed by the same things slide together (*the* and *a*, the three adjectives, *cat* and *dog*), while *bird* and *fish* stay apart because different verbs follow them. The green arrow is $\\symh$ for the tapped word, and the bars are its next-word probabilities. Now tie $\\symU$ to $\\symE$ and train again: the verbs, which all look alike as inputs, spread apart, because as outputs they must be told apart.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: where the parameters live                                       */
/* ------------------------------------------------------------------ */

const human = (n: number): string => (n >= 1e9 ? `${fmt(n / 1e9, 3)}B` : n >= 1e6 ? `${fmt(n / 1e6, 3)}M` : n >= 1e3 ? `${fmt(n / 1e3, 3)}K` : String(n));

export function figParams(p: Page): void {
  p.figure({
    title: 'How much of a model is vocabulary?',
    codeTitle: 'vocab_params.py',
    code: `
      V, d, L = {{V:50257}}, {{d:768}}, {{L:12}}
      tied = {{tied:True}}

      embed = V * d                    #@E
      unembed = 0 if tied else V * d   #@U
      blocks = L * 12 * d * d          #@blocks
      total = embed + unembed + blocks
      share = (embed + unembed) / total
      # E {{pe}}, U {{pu}}, blocks {{pb}}
      # total {{pt}}, share {{share}}

      # multiply-adds per token:
      # unembedding d * V = {{cu}}
      # blocks about {{cb}}
    `,
    setup(f) {
      let V = 50257, d = 768, L = 12, tied = true;
      const cv = f.canvas(640, 250, (c, w, hh) => {
        const pe = V * d, pu = tied ? 0 : V * d, pb = L * 12 * d * d;
        const tot = pe + pu + pb;
        const x0 = 8, bw = w - 16;
        const bar = (y: number, title: string, segs: [number, Color | '--ink-3', string][], total: number) => {
          c.font = '600 12.5px system-ui, sans-serif';
          c.fillStyle = color('--ink-2');
          c.textAlign = 'left';
          c.textBaseline = 'bottom';
          c.fillText(title, x0, y - 6);
          let x = x0;
          const bh = Math.min(34, hh * 0.15);
          for (const [v, k, lab] of segs) {
            const sw = (bw * v) / total;
            if (sw <= 0) continue;
            c.fillStyle = withAlpha(color(k), k === '--ink-3' ? 0.3 : 0.55);
            c.fillRect(x, y, sw, bh);
            c.strokeStyle = color('--card');
            c.lineWidth = 1.5;
            c.strokeRect(x, y, sw, bh);
            c.font = "600 12px 'JetBrains Mono Variable', ui-monospace, monospace";
            const tw = c.measureText(lab).width;
            c.textBaseline = 'middle';
            if (tw + 10 < sw) {
              c.fillStyle = color('--ink');
              c.textAlign = 'center';
              c.fillText(lab, x + sw / 2, y + bh / 2);
            }
            x += sw;
          }
          // labels too long for their segment go underneath
          c.textBaseline = 'top';
          c.textAlign = 'left';
          let lx = x0;
          for (const [v, k, lab] of segs) {
            const sw = (bw * v) / total;
            c.font = "600 12px 'JetBrains Mono Variable', ui-monospace, monospace";
            if (sw > 0 && c.measureText(lab).width + 10 >= sw) {
              c.fillStyle = color(k === '--ink-3' ? '--ink-2' : k);
              c.fillText(lab, lx, y + bh + 4);
              lx += c.measureText(lab).width + 14;
            }
          }
        };
        bar(30, `parameters: ${human(tot)}, vocabulary ${((100 * (pe + pu)) / tot).toFixed(1)}%`, [
          [pe, 'blue', `E ${human(pe)}`],
          [pu, 'teal', `U ${human(pu)}`],
          [pb, '--ink-3', `blocks ${human(pb)}`],
        ], tot);
        const cu = d * V, cb = 12 * L * d * d;
        bar(hh * 0.58, `compute per token: unembedding ${((100 * cu) / (cu + cb)).toFixed(1)}%`, [
          [cu, 'teal', `unembed ${human(cu)}`],
          [cb, '--ink-3', `blocks ${human(cb)}`],
        ], cu + cb);
      });
      cv.canvas.classList.add('scroll-ok');
      const update = () => {
        const pe = V * d, pu = tied ? 0 : V * d, pb = L * 12 * d * d;
        const tot = pe + pu + pb;
        f.code.setMany({
          V, d, L, tied: tied ? 'True' : 'False',
          pe: human(pe), pu: human(pu), pb: human(pb), pt: human(tot), share: fmt((pe + pu) / tot, 3),
          cu: human(d * V), cb: human(12 * L * d * d),
        });
        f.code.highlight(tied ? ['E', 'blocks'] : ['E', 'U', 'blocks']);
        cv.redraw();
      };
      const sV = f.slider({ label: 'vocabulary V', sym: 'V', min: 3, max: Math.log10(262144), value: Math.log10(V), map: (r) => Math.round(10 ** r), format: (v) => v.toLocaleString('en-US'), onInput: (v) => { V = v; update(); } });
      const sD = f.slider({ label: 'width d', sym: 'd', min: 64, max: 8192, step: 64, value: d, onInput: (v) => { d = v; update(); } });
      const sL = f.slider({ label: 'layers L', min: 1, max: 96, step: 1, value: L, onInput: (v) => { L = v; update(); } });
      const tg = f.toggle({ label: 'tie U to E', value: tied, onChange: (v) => { tied = v; update(); } });
      const PRE: Record<string, [number, number, number, boolean]> = {
        small: [50257, 768, 12, true],
        xl: [50257, 1600, 48, true],
        big: [32000, 4096, 32, false],
        tiny: [128000, 2048, 16, true],
      };
      f.segmented({
        label: 'shapes',
        options: [
          { value: 'small', label: 'GPT-2 small' },
          { value: 'xl', label: 'GPT-2 XL' },
          { value: 'big', label: '7B, V 32K' },
          { value: 'tiny', label: '1B, V 128K' },
        ],
        value: 'small',
        onChange: (k) => {
          const [v, dd, l, t] = PRE[k]!;
          V = v;
          d = dd;
          L = l;
          tied = t;
          sV.set(Math.log10(v), false);
          sD.set(dd, false);
          sL.set(l, false);
          tg.set(t, false);
          update();
        },
      });
      update();
    },
    caption: `Parameters of the two vocabulary tables against the transformer blocks (about $12\\symd^2$ per block, from [the Transformer chapter](#/transformer)); position embeddings, biases and norms are left out, a few percent at most. **GPT-2 small** is the real thing: 124 million parameters, almost a third of them in its one tied table. In **GPT-2 XL** the same table is about 5%. The **7B** shape (LLaMA's: 32 layers, width 4,096, 32,000 tokens, untied) spends only 4% on vocabulary, while a **1B** model with a 128K vocabulary spends a quarter. The lower bar is compute: the embedding is a free lookup, but the unembedding is a real $\\symd \\times \\symV$ multiply at every position.`,
  });
}
