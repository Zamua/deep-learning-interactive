import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { type K, box, chip, chipH, current, fitSize, flowLayout, textNL, wsub } from './kit';

// ---------------------------------------------------------------- shared

type Role = 'system' | 'user' | 'assistant';
const CONVO: { role: Role; text: string }[] = [
  { role: 'system', text: 'You are a helpful assistant.' },
  { role: 'user', text: 'What is the capital of France?' },
  { role: 'assistant', text: 'Paris.' },
  { role: 'user', text: 'And of Italy?' },
  { role: 'assistant', text: 'Rome, on the Tiber.' },
];
const ROLE_K: Record<Role, K> = { system: 'slate', user: 'blue', assistant: 'green' };

interface Tok {
  s: string;
  sp: boolean;
  msg: number;
  part: 'head' | 'body' | 'end' | 'sep';
}

const pieces = (s: string): string[] => s.match(/\n+|\s?[A-Za-z]+|\s?\d|\s?[^\sA-Za-z\d]/g) ?? [];
const show = (s: string): string => s.replace(/\n/g, '↵').trimStart();

/** The conversation through the ChatML template, as in the chapter's figure. */
function chatml(n = CONVO.length): Tok[] {
  const out: Tok[] = [];
  CONVO.slice(0, n).forEach((m, i) => {
    out.push({ s: '<|im_start|>', sp: true, msg: i, part: 'head' });
    pieces(`${m.role}\n`).forEach((p) => out.push({ s: p, sp: false, msg: i, part: 'head' }));
    pieces(m.text).forEach((p) => out.push({ s: p, sp: false, msg: i, part: 'body' }));
    out.push({ s: '<|im_end|>', sp: true, msg: i, part: 'end' });
    out.push({ s: '\n', sp: false, msg: i, part: 'sep' });
  });
  return out;
}
const TOKS = chatml();
const MASK = TOKS.map((t) => (CONVO[t.msg]!.role === 'assistant' && (t.part === 'body' || t.part === 'end') ? 1 : 0));

/** Word chips for a sentence, with an optional color per chip. */
function sentence(s: Scene, words: string[], x: number, y: number, maxW: number, size: number, k: (i: number) => K, o: { n?: number; on?: (i: number) => number; sp?: (i: number) => boolean } = {}): number {
  const L = flowLayout(s, words, x, y, maxW, size);
  const n = o.n ?? words.length;
  words.forEach((wd, i) => {
    if (i >= n) return;
    const p = L.pos[i]!;
    chip(s, p.x, p.y, wd, k(i), { size, on: o.on?.(i) ?? 0, sp: o.sp?.(i) ?? wd.startsWith('<') });
  });
  return L.height;
}

// ---------------------------------------------------------------- intro

const Q = 'What is the capital of France ?'.split(' ');
const MORE = 'What is the capital of Spain ? What is the capital of Peru ? What is the'.split(' ');

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const size = s.tall ? 3.4 : 3.2;
    // Title.
    s.alpha(s.win('hello', 'more'), () => {
      const lift = s.ease('base', 0.8);
      s.text('Fine-tuning', w / 2, lerp(h * 0.42, h * 0.3, lift), { size: 11, font: 'display', weight: 600 });
      s.text('from text predictor to assistant', w / 2, lerp(h * 0.42, h * 0.3, lift) + u * 10, { size: 4.6, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('base', 0.6, 0.4), () => {
        const bw = Math.min(w * 0.7, u * 70);
        box(s, w / 2 - bw / 2, h * 0.52, bw, u * 20, 'blue');
        s.text('base model', w / 2, h * 0.52 + u * 7, { size: 5, font: 'display', weight: 600, color: s.c('blue') });
        s.text('trained to continue web text', w / 2, h * 0.52 + u * 14, { size: 3.6, italic: true, color: s.c('--ink-2') });
      });
    });
    // The prompt, the base model's continuation, the fine-tuned answer.
    const cA = s.win('more', 'cost');
    if (cA > 0) {
      s.alpha(cA, () => {
        const x0 = u * 6;
        const mw = w - u * 12;
        let y = h * 0.08;
        s.text('prompt', x0, y, { font: 'ui', size: 3.2, align: 'left', weight: 600, color: s.c('--ink-3') });
        y += u * 3;
        const qh = sentence(s, Q, x0, y, mw, size, () => 'blue');
        y += qh + u * 6;
        s.text('base model', x0, y, { font: 'ui', size: 3.2, align: 'left', weight: 600, color: s.c('--ink-3') });
        y += u * 3;
        const n = Math.round(MORE.length * clamp01(s.prog('more') * 1.15));
        const mh = sentence(s, MORE, x0, y, mw, size, () => '--ink-3', { n });
        const docA = s.ease('doc', 0.6);
        if (docA > 0)
          s.alpha(docA, () => {
            box(s, x0 - u * 2.5, h * 0.08 + u * 1.5, mw + u * 5, y + mh - h * 0.08 + u * 2, 'slate', { fill: 0.02, dash: true });
            s.text('a quiz page, continued', w - u * 4, h * 0.08, { font: 'ui', size: 3.2, align: 'right', italic: true, color: s.c('slate') });
          });
        y += mh + u * 8;
        s.alpha(s.ease('sft', 0.6), () => {
          s.text('after supervised fine-tuning', x0, y, { font: 'ui', size: 3.2, align: 'left', weight: 600, color: s.c('green') });
          const ans = ['Paris', '.', '<end>'];
          const k = Math.round(3 * clamp01((s.t - s.at('answer')) / 1.2));
          sentence(s, ans, x0, y + u * 3, mw, size, (i) => (i === 2 ? 'green' : '--ink-2'), { n: k, on: (i) => (i === 2 ? 1 : 0.3) });
        });
      });
    }
    // Part two: a big frozen matrix and two thin trainable ones.
    const lA = s.ease('cost', 0.7);
    if (lA > 0) {
      s.alpha(lA, () => {
        const S = Math.min(w * 0.4, h * 0.5);
        const cy = h * 0.42;
        const t = Math.max(u * 2.2, S * 0.07);
        const total = S + u * 10 + t + u * 2 + S * 0.8;
        const wx = (w - total) / 2;
        s.rrect(wx, cy - S / 2, S, S, 1.5, { fill: s.tint('blue', 0.22), stroke: s.c('blue'), lw: 0.5 });
        wsub(s, wx + S / 2, cy - u * 2, 9, s.c('blue'));
        s.text('frozen', wx + S / 2, cy + u * 6, { size: 3.6, font: 'ui', color: s.c('blue') });
        s.text('+', wx + S + u * 5, cy, { size: 7, color: s.c('--ink-2') });
        const bx = wx + S + u * 10;
        s.rrect(bx, cy - S / 2, t, S, 0.8, { fill: s.tint('green', 0.4), stroke: s.c('green'), lw: 0.4 });
        s.rrect(bx + t + u * 2, cy - S / 2, S * 0.8, t, 0.8, { fill: s.tint('orange', 0.4), stroke: s.c('orange'), lw: 0.4 });
        s.text('B', bx + t / 2, cy + S / 2 + u * 4, { size: 5.5, italic: true, weight: 600, color: s.c('green') });
        s.text('A', bx + t + u * 2 + S * 0.4, cy - S / 2 + t + u * 4.5, { size: 5.5, italic: true, weight: 600, color: s.c('orange') });
        s.text('LoRA: train only B and A', w / 2, h * 0.84, { size: 4.6, font: 'display', weight: 600 });
        s.alpha(s.ease('next', 0.6), () => s.text('then: rewards instead of examples', w / 2, h * 0.92, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      });
    }
  },
};

// ---------------------------------------------------------------- sft

const DEMOS: [string, string][] = [
  ['Translate to English: merci', 'Thank you.'],
  ['Is 91 a prime number?', 'No: 91 = 7 × 13.'],
  ['Name a primary color.', 'Red.'],
];
const SOURCES: [string, string][] = [
  ['people write them', 'InstructGPT, LIMA'],
  ['datasets as instructions', 'FLAN, T0'],
  ['a stronger model writes', 'Alpaca, R1 distill'],
  ['real conversations', 'Vicuna, OpenAssistant'],
];

const sft: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Demonstration cards.
    s.alpha(s.win('what', 'sources'), () => {
      const cw = Math.min(w - u * 12, u * 110);
      const x0 = (w - cw) / 2;
      const ch = u * 17;
      const gap = u * 4;
      const y0 = h * 0.12;
      DEMOS.forEach(([q, a], i) => {
        const a0 = s.ease('what', 0.5, 0.4 + i * 0.5);
        s.alpha(a0, () => {
          const y = y0 + i * (ch + gap);
          box(s, x0, y, cw, ch, '--ink-3', { fill: 0.04 });
          s.text(q, x0 + u * 3, y + u * 5, { font: 'ui', size: 3.6, align: 'left', color: s.c('--ink-2') });
          const lit = s.ease('loss', 0.6);
          const aw = s.measure(a, { font: 'mono', size: 3.6, weight: 600 }) + u * 3;
          s.rrect(x0 + u * 3 - u * 1.2, y + u * 9, aw, u * 6, 1, { fill: s.tint('gold', 0.12 + 0.25 * lit), stroke: s.tint('gold', 0.4 + 0.6 * lit), lw: 0.3 });
          s.text(a, x0 + u * 3 + u * 0.3, y + u * 12.2, { font: 'mono', size: 3.6, weight: 600, align: 'left' });
          s.alpha(lit, () => s.text('loss here', x0 + cw - u * 3, y + u * 12.2, { font: 'ui', size: 3.2, align: 'right', italic: true, color: s.c('red') }));
        });
      });
      const yb = y0 + 3 * (ch + gap) + u * 2;
      s.alpha(s.ease('what', 0.6), () => {
        s.text('prompt', x0 + u * 3, yb, { font: 'ui', size: 3.2, align: 'left', color: s.c('--ink-3') });
        s.text('ideal answer', x0 + u * 22, yb, { font: 'ui', size: 3.2, align: 'left', color: s.c('gold') });
      });
      s.alpha(s.ease('step', 0.6), () => s.text('same loss as pretraining, new data', w / 2, yb + u * 9, { size: 4.4, font: 'display', weight: 600 }));
    });
    // Where demonstrations come from.
    s.alpha(s.win('sources', 'igpt'), () => {
      const cols = s.tall ? 1 : 2;
      const tw = cols === 2 ? Math.min((w - u * 16) / 2, u * 60) : Math.min(w - u * 12, u * 80);
      const th = s.tall ? u * 15 : u * 20;
      const rowsN = 4 / cols;
      const gy = s.tall ? u * 3 : u * 5;
      const totH = rowsN * th + (rowsN - 1) * gy;
      const y0 = (h - totH) / 2;
      SOURCES.forEach(([t1, t2], i) => {
        const cx = cols === 2 ? w / 2 + (i % 2 ? u * 2 : -tw - u * 2) : (w - tw) / 2;
        const cy = y0 + Math.floor(i / cols) * (th + gy);
        s.alpha(s.ease('sources', 0.5, i * 0.9), () => {
          box(s, cx, cy, tw, th, (['gold', 'slate', 'purple', 'blue'] as K[])[i]!);
          s.text(t1, cx + tw / 2, cy + th * 0.4, { size: 4.2, font: 'display', weight: 600 });
          s.text(t2, cx + tw / 2, cy + th * 0.72, { size: 3.4, italic: true, color: s.c('--ink-2') });
        });
      });
    });
    // InstructGPT: a small fine-tuned model preferred over a much larger base.
    s.alpha(s.win('igpt', 'lima'), () => {
      s.text('InstructGPT, 2022', w / 2, h * 0.12, { size: 6, font: 'display', weight: 600 });
      s.text('about 13,000 prompts with answers written by labelers', w / 2, h * 0.2, { size: 3.6, italic: true, color: s.c('--ink-2') });
      const pA = s.ease('pref', 0.7);
      s.alpha(pA, () => {
        const R = Math.min(w * 0.22, h * 0.26);
        const cy = h * 0.58;
        const bx = w * 0.64, sx = w * 0.26;
        const rs = Math.max(u * 2.6, R * Math.sqrt(1.3 / 175));
        s.circle(bx, cy, R, { fill: s.tint('slate', 0.18), stroke: s.c('slate'), lw: 0.4 });
        s.text('GPT-3', bx, cy - u * 2.5, { size: 5, font: 'display', weight: 600, color: s.c('slate') });
        s.text('175B parameters', bx, cy + u * 4, { size: 3.4, font: 'ui', color: s.c('slate') });
        s.circle(sx, cy, rs, { fill: s.tint('green', 0.4), stroke: s.c('green'), lw: 0.5 });
        s.text('1.3B, fine-tuned', sx, cy + rs + u * 5, { size: 3.6, font: 'ui', weight: 600, color: s.c('green') });
        s.text('preferred', sx, cy - rs - u * 4, { size: 4.4, font: 'display', weight: 600, color: s.c('green') });
        s.text('>', (sx + bx - R) / 2 + u * 2, cy, { size: 7, color: s.c('--ink-2') });
      });
    });
    // LIMA: a thousand examples.
    const lA = s.ease('lima', 0.7);
    if (lA > 0)
      s.alpha(lA, () => {
        s.text('LIMA, 2023: 1,000 examples', w / 2, h * 0.1, { size: 5, font: 'display', weight: 600 });
        const cols = 40, rows = 25;
        const gw = Math.min(w - u * 14, u * 100);
        const cs = gw / cols;
        const gx = (w - gw) / 2, gy = h * 0.18;
        const n = Math.round(1000 * clamp01(s.since('lima') / 2.4));
        const c = s.ctx;
        c.fillStyle = s.c('gold');
        for (let i = 0; i < n; i++) {
          const x = gx + (i % cols) * cs + cs / 2, y = gy + Math.floor(i / cols) * cs + cs / 2;
          c.beginPath();
          c.arc(x, y, cs * 0.32, 0, Math.PI * 2);
          c.fill();
        }
        s.alpha(s.ease('hyp', 0.6), () => {
          const y = gy + rows * cs + u * 8;
          s.text('knowledge  ←  pretraining', w / 2, y, { size: 4.2, font: 'mono', weight: 600, color: s.c('blue') });
          s.text('format  ←  fine-tuning', w / 2, y + u * 8, { size: 4.2, font: 'mono', weight: 600, color: s.c('gold') });
        });
      });
  },
};

// ---------------------------------------------------------------- template

const template: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const mw = w - u * 12;
    const x0 = u * 6;
    // Three messages as bubbles.
    const bA = 1 - s.ease('flat', 0.8);
    if (bA > 0)
      s.alpha(bA, () => {
        const msgs = CONVO.slice(0, 3);
        msgs.forEach((m, i) => {
          const a = s.ease('roles', 0.5, i * 0.6);
          s.alpha(a, () => {
            const y = h * 0.14 + i * u * 22;
            const tw = Math.min(mw * 0.8, s.measure(m.text, { font: 'ui', size: 4 }) + u * 8);
            const bx = m.role === 'user' ? x0 + mw - tw : x0;
            box(s, bx, y, tw, u * 14, ROLE_K[m.role], { fill: 0.12 });
            s.text(m.role, bx + u * 3, y + u * 4.2, { font: 'ui', size: 3, weight: 650, align: 'left', color: s.c(ROLE_K[m.role]) });
            s.text(m.text, bx + u * 3, y + u * 9.6, { font: 'ui', size: 4, align: 'left' });
          });
        });
      });
    // The flat token sequence.
    const fA = s.win('flat', 'gen');
    if (fA > 0)
      s.alpha(fA, () => {
        const toks = chatml(3);
        const labels = toks.map((t) => show(t.s));
        const breaks = new Set(toks.map((t, i) => (i > 0 && t.s === '<|im_start|>' ? i : -1)).filter((i) => i >= 0));
        const size = fitSize(s, labels, mw, h * 0.6, 3.6, 2.6, { breaks });
        const L = flowLayout(s, labels, x0, h * 0.14, mw, size, { breaks });
        const cur = current(s, ['flat', 'special', 'chatml']);
        toks.forEach((t, i) => {
          const p = L.pos[i]!;
          const a = clamp01((s.since('flat') - 0.4) * 3 - i * 0.08);
          let on = 0;
          if (t.sp && cur === 'special') on = 1;
          if (cur === 'chatml') on = t.s === '<|im_start|>' ? s.ease('chatml', 0.5, 0.6) * (1 - s.ease('chatml', 0.5, 3.4)) : t.s === '<|im_end|>' ? s.ease('chatml', 0.5, 3.4) : 0;
          s.alpha(a, () => chip(s, p.x, p.y, labels[i]!, t.sp ? 'purple' : ROLE_K[CONVO[t.msg]!.role], { size, sp: t.sp, on }));
        });
        s.alpha(s.ease('special', 0.6), () => s.text('special tokens: one id each, never produced by typed text', w / 2, h * 0.14 + L.height + u * 8, { size: 3.4, italic: true, color: s.c('purple') }));
      });
    // Inference: the generation prompt, then the model writes and stops.
    const gA = s.win('gen', 'same');
    if (gA > 0)
      s.alpha(gA, () => {
        const toks = chatml(2);
        const labels = [...toks.map((t) => show(t.s)), '<|im_start|>', 'assistant', '↵'];
        const ans = ['Paris', '.', '<|im_end|>'];
        const k = s.since('stop') < 0 ? 0 : Math.min(3, Math.floor(s.since('stop') * 1.6) + 1);
        const all = [...labels, ...ans.slice(0, k)];
        const breaks = new Set([toks.findIndex((t, i) => i > 0 && t.s === '<|im_start|>'), labels.length - 3]);
        const size = fitSize(s, [...labels, ...ans], mw, h * 0.6, 3.6, 2.6, { breaks });
        const L = flowLayout(s, all, x0, h * 0.14, mw, size, { breaks });
        all.forEach((lab, i) => {
          const p = L.pos[i]!;
          const isAns = i >= labels.length;
          const isGen = i >= labels.length - 3 && !isAns;
          const sp = lab.startsWith('<|');
          const k2: K = isAns ? 'green' : isGen ? 'gold' : sp ? 'purple' : '--ink-3';
          chip(s, p.x, p.y, lab, k2, { size, sp, on: isGen ? 0.5 : isAns ? 0.7 : 0 });
        });
        const last = L.pos[all.length - 1]!;
        if (k < 3 && Math.floor(s.t * 2) % 2 === 0) s.rrect(last.x + last.w + u, last.y, u * 1.2, chipH(s, size), 0.2, { fill: s.c('--ink') });
        s.text(k === 0 ? 'the server writes this, then the model continues' : k < 3 ? 'the model writes…' : 'end token: generation stops', w / 2, last.y + chipH(s, size) + u * 9, { size: 3.6, italic: true, color: s.c(k === 3 ? 'green' : 'gold') });
      });
    // Same template at training and serving time.
    s.alpha(s.ease('same', 0.7), () => {
      const rows: [string, string[], K][] = [
        ['trained with', ['<|im_start|>', 'assistant', '↵'], 'green'],
        ['served with', ['<|start_header_id|>', 'assistant', '<|end_header_id|>'], 'red'],
      ];
      rows.forEach(([lab, tk, k], i) => {
        const y = h * 0.3 + i * u * 22;
        s.text(lab, x0, y, { font: 'ui', size: 3.4, weight: 600, align: 'left', color: s.c(k) });
        sentence(s, tk, x0, y + u * 3.5, mw, s.tall ? 3 : 3.4, () => 'purple');
      });
      s.text('a pattern the model never saw in training', w / 2, h * 0.3 + u * 50, { size: 3.8, italic: true, color: s.c('red') });
    });
  },
};

// ---------------------------------------------------------------- mask

const mask: SceneDef = {
  marks: {
    loss: { tex: String.raw`\symL = -\frac{1}{\sum_t \symm_t}\sum_t \symm_t \log p_\theta(y_t \mid y_{<t})`, x: 0.5, y: 0.86, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const mw = w - u * 10;
    const x0 = u * 5;
    const labels = TOKS.map((t) => show(t.s));
    const breaks = s.tall ? new Set<number>() : new Set(TOKS.map((t, i) => (i > 0 && t.s === '<|im_start|>' ? i : -1)).filter((i) => i >= 0));
    const topH = h * (s.tall ? 0.6 : 0.66);
    const badge = s.tall;
    const size = fitSize(s, labels, mw, topH, s.tall ? 3.8 : 4.4, 2.4, { sub: !badge, breaks, gapU: badge ? 1.9 : 0.8 });
    const L = flowLayout(s, labels, x0, h * 0.05, mw, size, { sub: !badge, breaks, gapU: badge ? 1.9 : 0.8 });
    const cur = current(s, ['same', 'not', 'mask', 'end', 'read', 'loss', 'avg', 'count', 'torch']);
    const mA = s.ease('mask', 0.6);
    const target = TOKS.findIndex((t) => t.s === 'Paris');
    TOKS.forEach((t, i) => {
      const p = L.pos[i]!;
      const m = MASK[i]!;
      const role = CONVO[t.msg]!.role;
      let k: K = t.sp ? 'purple' : ROLE_K[role];
      let on = 0;
      if (cur === 'not' && role !== 'assistant') on = 0.6;
      if (mA > 0 && m) {
        k = 'gold';
        on = 0.6 + (cur === 'end' && t.part === 'end' ? 0.4 : 0);
      }
      const dim = cur === 'read' && i > target ? 0.35 : mA > 0 && !m && cur !== 'read' ? 0.65 : 1;
      const sub = mA > 0 ? String(m) : '';
      s.alpha(dim, () => chip(s, p.x, p.y, labels[i]!, k, { size, sp: t.sp, on, sub, badge, subK: m ? 'gold' : '--ink-3' }));
    });
    // Context feeding one prediction.
    if (cur === 'read') {
      const p = L.pos[target]!;
      const a = s.ease('read', 0.5);
      s.alpha(a, () => {
        s.rrect(p.x - u * 0.8, p.y - u * 0.8, p.w + u * 1.6, chipH(s, size, !badge) + u * 1.6, 1.2, { stroke: s.c('--accent'), lw: 0.6 });
        s.text(`predicted from the ${target} tokens before it`, w / 2, h * 0.05 + L.height + u * 6, { size: 3.6, italic: true, color: s.c('--accent') });
      });
    }
    // The loss, then the count.
    const fA = s.ease('loss', 0.6) * (1 - s.ease('torch', 0.5));
    s.show('loss', fA);
    s.alpha(s.ease('count', 0.6) * (1 - s.ease('torch', 0.5)), () => {
      s.text('10 of 50 tokens carry loss', w / 2, h * 0.73, { size: 4.4, font: 'display', weight: 600, color: s.c('gold') });
    });
    s.alpha(s.ease('torch', 0.6), () => {
      textNL(s, 'labels = [-100, -100, …, Paris, ., <|im_end|>, -100, …]', w / 2, h * 0.8, { size: s.tall ? 2.9 : 3.4, font: 'mono', color: s.c('--ink-2') });
      s.text('cross_entropy(…, ignore_index=-100) skips them', w / 2, h * 0.88, { size: 3.4, italic: true, color: s.c('red') });
    });
  },
};

export const scenesA: Record<string, SceneDef> = { intro, sft, template, mask };
