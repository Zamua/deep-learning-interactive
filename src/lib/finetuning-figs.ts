import type { Page } from '../core/page';
import { fmt } from '../core/code';
import { h } from '../core/dom';
import { type Plot, color, rgbOf, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { type Mat, type SVD, frob, lowRank, noise, picture, svd, updateLike } from './finetuning-linalg';
import { type Example, ToyLM, VOCAB, chatDocs, examples, ids, webDocs } from './finetuning-toylm';
import { chip, flow } from './finetuning-ui';

/* ------------------------------------------------------------------ */
/* Fig: a conversation through a chat template, with its loss mask      */
/* ------------------------------------------------------------------ */

type Role = 'system' | 'user' | 'assistant';
const CONVO: { role: Role; text: string }[] = [
  { role: 'system', text: 'You are a helpful assistant.' },
  { role: 'user', text: 'What is the capital of France?' },
  { role: 'assistant', text: 'Paris.' },
  { role: 'user', text: 'And of Italy?' },
  { role: 'assistant', text: 'Rome, on the Tiber.' },
];

type Part = 'bos' | 'head' | 'body' | 'end' | 'sep';
interface Tok {
  s: string;
  sp: boolean;
  msg: number;
  part: Part;
}

/** Word-sized pieces with their leading space, the way a GPT-style pre-split cuts text. */
const pieces = (s: string): string[] => s.match(/\n+|\s?[A-Za-z]+|\s?\d|\s?[^\sA-Za-z\d]/g) ?? [];

function render(tpl: 'chatml' | 'llama3'): Tok[] {
  const out: Tok[] = [];
  const text = (s: string, msg: number, part: Part) => pieces(s).forEach((p) => out.push({ s: p, sp: false, msg, part }));
  const sp = (s: string, msg: number, part: Part) => out.push({ s, sp: true, msg, part });
  if (tpl === 'llama3') sp('<|begin_of_text|>', 0, 'bos');
  CONVO.forEach((m, i) => {
    if (tpl === 'chatml') {
      sp('<|im_start|>', i, 'head');
      text(`${m.role}\n`, i, 'head');
      text(m.text, i, 'body');
      sp('<|im_end|>', i, 'end');
      text('\n', i, 'sep');
    } else {
      sp('<|start_header_id|>', i, 'head');
      text(m.role, i, 'head');
      sp('<|end_header_id|>', i, 'head');
      text('\n\n', i, 'head');
      text(m.text, i, 'body');
      sp('<|eot_id|>', i, 'end');
    }
  });
  return out;
}

const show = (s: string): string => s.replace(/\n/g, '↵').trimStart() || '␣';

export function figTemplate(p: Page): void {
  p.figure({
    title: 'A conversation as one token sequence, and which tokens carry loss',
    codeTitle: 'sft_example.py',
    code: `
      ids, mask = [], []
      for msg in messages:
          head, body = render(msg, {{tpl:"chatml"}}, end={{eob:True}})  #@render
          keep = {{keep:msg.role == "assistant"}}      #@keep
          ids += head + body
          mask += [{{hm:0}}] * len(head) + [keep] * len(body)  #@mask
      labels = np.where(mask, ids, -100)           #@labels

      logits = model(ids)                          # (n, V)  #@loss
      loss = F.cross_entropy(logits[:-1], labels[1:],
                             ignore_index=-100)   #@loss
      # {{nl:…}} of {{nt:…}} tokens carry loss
    `,
    setup(f) {
      let tpl: 'chatml' | 'llama3' = 'chatml';
      let policy: 'asst' | 'last' | 'all' = 'asst';
      let endIn = true;
      let sel = -1;
      const rows = h('div', { class: 'ft-rows' });
      const note = h('div', { class: 'ft-note' });
      f.viz.append(h('div', { class: 'ft-box' }, rows), note);
      const lastAsst = CONVO.map((m) => m.role).lastIndexOf('assistant');
      const maskOf = (t: Tok, i: number): number => {
        if (i === 0) return 0;
        if (policy === 'all') return 1;
        const role = CONVO[t.msg]!.role;
        const keepMsg = policy === 'asst' ? role === 'assistant' : t.msg === lastAsst;
        if (!keepMsg) return 0;
        if (t.part === 'body') return 1;
        if (t.part === 'end') return endIn ? 1 : 0;
        return 0;
      };
      const draw = () => {
        const toks = render(tpl);
        const m = toks.map(maskOf);
        const groups: HTMLElement[][] = CONVO.map(() => []);
        toks.forEach((t, i) => {
          const c = chip(show(t.s), { sp: t.sp, on: !!m[i], sub: String(m[i]), dim: !m[i] && t.part !== 'body' });
          if (i === sel) c.classList.add('sel');
          c.addEventListener('click', () => {
            sel = i;
            draw();
          });
          groups[t.msg]!.push(c);
        });
        rows.replaceChildren(...groups.map((g, i) => h('div', {}, h('div', { class: 'ft-tag' }, CONVO[i]!.role), flow(g))));
        const nl = m.reduce((a, b) => a + b, 0);
        f.code.setMany({ nl, nt: toks.length });
        if (sel >= 0 && sel < toks.length) {
          const t = toks[sel]!;
          const what = sel === 0 ? 'It is the first token, so nothing predicts it.' : m[sel] ? `Its mask is 1: the model is graded on predicting it from the ${sel} tokens before it.` : `Its mask is 0: the model reads it, but its prediction is never graded.`;
          note.innerHTML = p.md(`Token ${sel + 1}, \`${show(t.s)}\`, ${t.sp ? 'a special token' : 'text'} in the ${CONVO[t.msg]!.role} message. ${what}`);
          f.code.highlight(m[sel] ? ['mask', 'labels'] : 'mask');
        } else {
          note.innerHTML = p.md(`**${nl}** of ${toks.length} tokens carry loss (${Math.round((100 * nl) / toks.length)}%). Tap any token to see why.`);
        }
      };
      f.segmented({
        label: 'template',
        options: [
          { value: 'chatml', label: 'ChatML' },
          { value: 'llama3', label: 'Llama 3' },
        ],
        value: 'chatml',
        onChange: (v) => {
          tpl = v;
          f.code.set('tpl', `"${v}"`);
          sel = -1;
          draw();
        },
      });
      f.segmented({
        label: 'loss on',
        options: [
          { value: 'asst', label: 'replies' },
          { value: 'last', label: 'last reply' },
          { value: 'all', label: 'everything' },
        ],
        value: 'asst',
        onChange: (v) => {
          policy = v;
          f.code.setMany({ keep: v === 'asst' ? 'msg.role == "assistant"' : v === 'last' ? 'msg is messages[-1]' : '1', hm: v === 'all' ? 1 : 0 });
          f.code.highlight(['keep', 'mask']);
          draw();
        },
      });
      f.toggle({
        label: 'end token in the reply',
        value: true,
        onChange: (v) => {
          endIn = v;
          f.code.set('eob', v ? 'True' : 'False');
          f.code.highlight('render');
          draw();
        },
      });
      f.code.set('tpl', '"chatml"');
      draw();
    },
    caption: `A two-turn conversation rendered with two real templates. Dashed chips are **special tokens**; the number under each chip is its mask $\\symm_t$, and gold chips are the ones the loss grades. (Text is cut into word-sized pieces for display; a real tokenizer would cut a few words further.) Switch **loss on** to *everything* and the model is also trained to write the system prompt and the user's questions. Turn off **end token in the reply** and the model is never graded on \`<|im_end|>\`: it learns to answer but not to stop.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: a tiny base model fine-tuned into an assistant                 */
/* ------------------------------------------------------------------ */

const PROMPTS = [
  'what is the capital of france ?',
  'q : what is the capital of france ? a :',
  '<user> what is the capital of japan ? <bot>',
  '<user> where is egypt ? <bot>',
];
const PRE_STEPS = 1200;
const SFT_STEPS = 400;

let BASE: ToyLM | null = null;

export function figToySFT(p: Page): void {
  p.figure({
    title: 'Fine-tuning a tiny base model into an assistant',
    codeTitle: 'sft_toy.py',
    code: `
      base = pretrain(web_pages)       # 1,200 steps   #@pre
      model = copy(base)
      for step in range(400):                          #@loop
          batch = sample(demos, 16)    # chat template #@sft
          if {{replay:False}}:
              batch += sample(web_pages, 16)  # replay #@replay
          loss = masked_xent(model, batch)             #@loss
          adam_step(model, loss, lr={{lr:0.01}})       #@step
      # step {{step:0}}  demos {{dl:…}}  web {{wl:…}}

      model.generate("<user> where is egypt ? <bot>")  #@gen
    `,
    setup(f) {
      const web = webDocs(600, 3);
      const wex = examples(web, true);
      const heldAll = examples(webDocs(150, 99), true);
      const held = new Rng(4).shuffle(heldAll.slice()).slice(0, 700);
      const cex = examples(chatDocs(5));
      let base = BASE;
      const model = new ToyLM(7);
      let preStep = base ? PRE_STEPS : 0;
      const preRng = new Rng(1);
      let rng = new Rng(2);
      let step = 0;
      let lr = 0.01;
      let replay = false;
      let curve: [number, number, number][] = [];
      let ghost: [number, number, number][] = [];
      if (base) model.load(base);

      const gen = h('div', { class: 'ft-gen' });
      f.viz.append(h('div', { class: 'ft-box' }, gen));
      const LABELS = ['plain question', 'FAQ page', 'chat', 'chat'];
      const outChips = (out: number[], fine: boolean) =>
        flow(out.map((id) => chip(VOCAB[id]!, { sp: id < 4, good: fine && VOCAB[id] === '<end>' })));
      const drawGen = () => {
        const kids: HTMLElement[] = [];
        PROMPTS.forEach((pr, i) => {
          if (i) kids.push(h('div', { class: 'sep' }));
          kids.push(h('div', { class: 'lab' }, LABELS[i]!), flow(pr.split(' ').map((w) => chip(w, { sp: w.startsWith('<'), dim: true }))));
          if (!base) return;
          kids.push(h('div', { class: 'lab' }, 'base →'), outChips(base.generate(ids(pr)), false));
          if (step > 0) kids.push(h('div', { class: 'lab' }, `step ${step} →`), outChips(model.generate(ids(pr)), true));
        });
        gen.replaceChildren(...kids);
      };

      const pl = f.plot({
        height: 170,
        square: false,
        domain: [0, SFT_STEPS, 0, 3.2],
        draw: (pp: Plot) => drawCurves(pp),
      });
      function drawCurves(pp: Plot) {
        const c = pp.ctx;
        c.strokeStyle = color('--grid');
        c.lineWidth = 1;
        c.beginPath();
        for (const v of [1, 2, 3]) {
          c.moveTo(0, Math.round(pp.sy(v)) + 0.5);
          c.lineTo(pp.w, Math.round(pp.sy(v)) + 0.5);
        }
        for (const v of [100, 200, 300]) {
          c.moveTo(Math.round(pp.sx(v)) + 0.5, 0);
          c.lineTo(Math.round(pp.sx(v)) + 0.5, pp.h);
        }
        c.stroke();
        c.font = "10.5px 'JetBrains Mono Variable', monospace";
        c.fillStyle = color('--ink-3');
        c.textAlign = 'left';
        for (const v of [1, 2, 3]) c.fillText(String(v), 4, pp.sy(v) + 12);
        c.textAlign = 'right';
        for (const v of [100, 200, 300, 400]) c.fillText(String(v), pp.sx(v) - 3, pp.h - 4);
        const line = (pts: [number, number, number][], j: 1 | 2, col: string, dash?: number[], w = 2) => {
          if (pts.length > 1) pp.path(pts.map((q) => q[0]), pts.map((q) => Math.min(3.15, q[j])), col, w, dash);
        };
        line(ghost, 1, withAlpha(color('red'), 0.45), [4, 4], 1.5);
        line(ghost, 2, withAlpha(color('purple'), 0.45), [4, 4], 1.5);
        line(curve, 1, color('red'));
        line(curve, 2, color('purple'));
        c.font = '600 11.5px system-ui, sans-serif';
        c.textAlign = 'right';
        c.fillStyle = color('red');
        c.fillText('loss on demonstrations', pp.w - 8, 16);
        c.fillStyle = color('purple');
        c.fillText('loss on held-out web text', pp.w - 8, 31);
        if (ghost.length) {
          c.fillStyle = color('--ink-3');
          c.font = '11px system-ui, sans-serif';
          c.fillText('dashed: previous run', pp.w - 8, 46);
        }
      }
      const dlRo = f.readout('demo loss', { sym: 'L' });
      const wlRo = f.readout('web loss');

      const evalNow = () => {
        const dl = model.loss(cex);
        const wl = model.loss(held);
        curve.push([step, dl, wl]);
        dlRo.set(fmt(dl, 3));
        wlRo.set(fmt(wl, 3));
        f.code.setMany({ step, dl: fmt(dl, 3), wl: fmt(wl, 3) });
      };

      const pre = f.loop(() => {
        if (base) return false;
        for (let k = 0; k < 50 && preStep < PRE_STEPS; k++, preStep++) {
          const b: Example[] = [];
          for (let i = 0; i < 32; i++) b.push(wex[preRng.int(wex.length)]!);
          model.step(b, preStep < 800 ? 0.01 : 0.003);
        }
        f.code.highlight('pre');
        f.status(`Pretraining the base model on 600 web pages: step ${preStep} of ${PRE_STEPS}…`);
        if (preStep >= PRE_STEPS) {
          base = BASE = model.clone();
          model.load(base);
          ready();
          return false;
        }
      });
      const ready = () => {
        step = 0;
        curve = [];
        evalNow();
        f.code.highlight(null);
        f.status('Base model ready. Press **Fine-tune**.');
        drawGen();
        pl.redraw();
      };

      let phase = 0;
      const sft = f.loop(() => {
        if (!base) return;
        for (let k = 0; k < 2 && step < SFT_STEPS; k++) {
          const b: Example[] = [];
          for (let i = 0; i < 16; i++) b.push(cex[rng.int(cex.length)]!);
          if (replay) for (let i = 0; i < 16; i++) b.push(wex[rng.int(wex.length)]!);
          model.step(b, lr);
          step++;
        }
        if (step % 4 === 0 || step >= SFT_STEPS) evalNow();
        f.code.highlight(['sft', replay ? 'replay' : 'sft', 'loss', 'step'][phase++ % 4]!);
        if (step % 8 === 0 || step >= SFT_STEPS) drawGen();
        pl.redraw();
        if (step >= SFT_STEPS) {
          stop();
          f.status(`Done: ${SFT_STEPS} steps. Press **Reset** to try another learning rate, or replay.`);
          return false;
        }
      });
      const stop = () => {
        sft.stop();
        btn.textContent = 'Fine-tune';
        f.code.highlight('gen');
        drawGen();
      };
      const btn = f.button('Fine-tune', () => {
        if (!base) return;
        if (sft.running()) stop();
        else if (step < SFT_STEPS) {
          sft.start();
          btn.textContent = 'Pause';
          f.status('');
        }
      }, { primary: true });
      f.button('Reset', () => {
        if (!base) return;
        stop();
        if (curve.length > 2) ghost = curve;
        model.load(base);
        rng = new Rng(2);
        ready();
      });
      f.slider({
        label: 'learning rate',
        min: -3,
        max: -1.5,
        step: 0.05,
        value: -2,
        map: (v) => 10 ** v,
        format: (v) => fmt(v, 2),
        slot: 'lr',
        onInput: (v) => (lr = v),
      });
      f.toggle({
        label: 'replay: mix web text into every batch',
        value: false,
        onChange: (v) => {
          replay = v;
          f.code.set('replay', v ? 'True' : 'False');
          f.code.highlight('replay');
        },
      });
      drawGen();
      if (base) ready();
      else pre.start();
    },
    caption: `A language model with 3,807 weights (four tokens of context, a 40-word vocabulary) is first pretrained on 600 made-up web pages: lists of facts, quiz pages that list questions, a few FAQ pages. Then it is fine-tuned on 16 demonstrations in a chat template, with loss only on the answers. The rows show greedy completions of four prompts by the frozen base model and by the model being fine-tuned. Press **Fine-tune** and watch both chat prompts learn to answer and stop. Then look at the plain question and the FAQ page, and at the purple curve: the model is forgetting web text. Reset, turn on **replay** (half of each batch is web text) and run again; or lower the learning rate.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: the best rank-r approximation of a matrix                       */
/* ------------------------------------------------------------------ */

type MatKind = 'update' | 'picture' | 'noise';
const MATS: Partial<Record<MatKind, { M: Mat; d: SVD }>> = {};
const getMat = (k: MatKind) => {
  if (!MATS[k]) {
    const M = k === 'update' ? updateLike() : k === 'picture' ? picture() : noise();
    MATS[k] = { M, d: svd(M) };
  }
  return MATS[k]!;
};

/** Paints a matrix as an image: grayscale for a picture, two-color diverging for signed values. */
function heat(ctx: CanvasRenderingContext2D, a: Float64Array, n: number, m: number, x: number, y: number, size: number, gray: boolean, scale: number) {
  const img = new ImageData(m, n);
  const pos = rgbOf(color('teal')), neg = rgbOf(color('purple')), mid = rgbOf(color('--card'));
  for (let i = 0; i < n * m; i++) {
    const v = a[i]!;
    let c: number[];
    if (gray) {
      const g = Math.max(0, Math.min(1, v)) * 255;
      c = [g, g, g];
    } else {
      const t = Math.max(-1, Math.min(1, v / scale));
      const k = t >= 0 ? pos : neg;
      const u = Math.abs(t) ** 0.8;
      c = [0, 1, 2].map((j) => mid[j]! + (k[j]! - mid[j]!) * u);
    }
    img.data[i * 4] = c[0]!;
    img.data[i * 4 + 1] = c[1]!;
    img.data[i * 4 + 2] = c[2]!;
    img.data[i * 4 + 3] = 255;
  }
  const tmp = document.createElement('canvas');
  tmp.width = m;
  tmp.height = n;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, x, y, size, (size * n) / m);
  ctx.strokeStyle = color('--rule');
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, (size * n) / m - 1);
}

export function figLowRank(p: Page): void {
  p.figure({
    title: 'The best rank-r approximation, with a rank slider',
    codeTitle: 'low_rank.py',
    code: `
      M = {{mat:update_like(48, 48)}}  # (n, m)
      U, s, Vt = np.linalg.svd(M)      #@svd
      r = {{r:4}}
      B = U[:, :r] * s[:r]   # (n, r)  #@BA
      A = Vt[:r, :]          # (r, m)  #@BA
      M_r = B @ A            # rank r  #@approx
      norm = np.linalg.norm
      err = norm(M - M_r) / norm(M)    #@err
      stored = B.size + A.size         #@cost
      # err = {{err:…}}
      # stored {{stored:…}} of {{full:…}}
    `,
    setup(f) {
      let kind: MatKind = 'update';
      let r = 4;
      const cv = f.canvas(640, 470, (ctx, w, hh) => {
        const { M, d } = getMat(kind);
        const gray = kind === 'picture';
        const approx = lowRank(d, M.n, M.m, r);
        const sc = Math.max(...Array.from(M.a, Math.abs)) * (kind === 'noise' ? 0.7 : 0.6);
        const gap = Math.max(14, w * 0.05);
        const size = Math.min((w - gap) / 2, hh * 0.56);
        const x0 = (w - 2 * size - gap) / 2;
        const top = 24;
        ctx.font = '600 12.5px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = color('--ink-2');
        ctx.fillText(kind === 'picture' ? 'the picture M' : 'M', x0 + size / 2, top - 8);
        ctx.fillStyle = color('green');
        ctx.fillText(`rank ${r}: B @ A`, x0 + size * 1.5 + gap, top - 8);
        heat(ctx, M.a, M.n, M.m, x0, top, size, gray, sc);
        heat(ctx, approx, M.n, M.m, x0 + size + gap, top, size, gray, sc);
        // singular values
        const sy0 = top + size + 34;
        const sh = hh - sy0 - 22;
        const k = d.k;
        const bw = (w - 30) / k;
        const smax = d.s[0]!;
        const ly = (v: number) => sy0 + sh * (Math.log10(Math.max(v / smax, 1e-3)) / -3);
        ctx.strokeStyle = color('--grid');
        ctx.lineWidth = 1;
        for (const e of [1, 0.1, 0.01, 0.001]) {
          ctx.beginPath();
          ctx.moveTo(24, Math.round(ly(e * smax)) + 0.5);
          ctx.lineTo(w - 4, Math.round(ly(e * smax)) + 0.5);
          ctx.stroke();
        }
        for (let i = 0; i < k; i++) {
          const v = d.s[i]!;
          const yy = ly(v);
          ctx.fillStyle = i < r ? color('green') : withAlpha(color('--ink-3'), 0.4);
          ctx.fillRect(26 + i * bw + bw * 0.12, yy, Math.max(1, bw * 0.76), sy0 + sh - yy);
        }
        const cx = 26 + r * bw;
        ctx.strokeStyle = color('green');
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, sy0 - 4);
        ctx.lineTo(cx, sy0 + sh);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillStyle = color('--ink-3');
        ctx.textAlign = 'left';
        ctx.fillText('singular values σ₁ ≥ σ₂ ≥ …  (log scale)', 26, sy0 - 8);
        ctx.font = "10.5px 'JetBrains Mono Variable', monospace";
        ctx.textAlign = 'right';
        ctx.fillText('1', 21, ly(smax) + 4);
        ctx.fillText('.01', 21, ly(smax * 0.01) + 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = color('green');
        ctx.fillText(`kept: ${r}`, Math.min(cx + 4, w - 60), sy0 + sh + 14);
      });
      const errRo = f.readout('error');
      const costRo = f.readout('numbers stored');
      const update = () => {
        const { M, d } = getMat(kind);
        const approx = lowRank(d, M.n, M.m, r);
        const diff = approx.map((v, i) => v - M.a[i]!);
        const err = frob(diff) / frob(M.a);
        const stored = r * (M.n + M.m);
        const full = M.n * M.m;
        f.code.setMany({ err: fmt(err, 3), stored, full });
        errRo.set(`${(100 * err).toFixed(1)}%`);
        costRo.set(`${stored.toLocaleString('en-US')} of ${full.toLocaleString('en-US')} (${Math.round((100 * stored) / full)}%)`);
        cv.redraw();
      };
      const sl = f.slider({
        label: 'rank r',
        sym: 'r',
        min: 1,
        max: 48,
        step: 1,
        value: 4,
        slot: 'r',
        format: (v) => String(Math.round(v)),
        onInput: (v) => {
          r = Math.round(v);
          f.code.highlight(['BA', 'approx']);
          update();
        },
      });
      f.segmented({
        label: 'matrix',
        options: [
          { value: 'update', label: 'update-like' },
          { value: 'picture', label: 'a picture' },
          { value: 'noise', label: 'random' },
        ],
        value: 'update',
        onChange: (v) => {
          kind = v;
          const { M } = getMat(kind);
          sl.input.max = String(Math.min(M.n, M.m));
          if (r > Math.min(M.n, M.m)) sl.set(Math.min(M.n, M.m), false);
          r = Math.round(sl.value);
          f.code.set('mat', v === 'update' ? 'update_like(48, 48)' : v === 'picture' ? 'picture(64, 64)' : 'np.random.randn(48, 48)');
          f.code.highlight('svd');
          update();
        },
      });
      update();
    },
    caption: `**Left**: a matrix $M$. **Right**: its best rank-$\\symr$ approximation $\\symB\\symA$, built from the first $\\symr$ singular values (green bars, below). The *update-like* matrix was built from six directions of falling strength plus a little noise, the shape that fine-tuning updates turn out to have: by rank 4 or 5 the error is small, while storing $\\symB$ and $\\symA$ takes a fraction of the numbers. *A picture* is low rank too (flat regions and straight edges), so it sharpens quickly. *Random* noise has no structure: its singular values are all about the same size and every rank you drop costs as much as the last one.`,
  });
}
