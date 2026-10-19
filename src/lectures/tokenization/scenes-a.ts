import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { HELD_BYTES, HELD_LENS, BPE_SPLIT, EXCERPT, KMAX, TABLE, TINY_STATES, enc, tinyLabel, tokLabel } from './data';
import { encode } from '../../lib/tokenization-bpe';
import { type K, block, chip, chipH, current, flowLayout, hbar, pill, strip, tokK } from './kit';

// ---------------------------------------------------------------- intro

const PROMPT = 'the keeper lit the';
const PROMPT_IDS = enc(PROMPT);
const CANDS: [string, number][] = [['␣lamp', 0.92], ['␣light', 0.55], ['␣wind', 0.4], ['␣log', 0.28]];
const rowOf = (id: number): number[] => TABLE[id % TABLE.length]!.slice(0, 4);

/** The whole model as one picture: text, tokens, vectors, transformer, scores. Shared with the outro. */
export function pipeline(s: Scene, o: { text: number; chips: number; x: number; tf: number; hh: number; logits: number; next: number; dim?: number; top?: number; logLabel?: string }): void {
  const { w, h, u } = s;
  const top = o.top ?? 0;
  const span = h - top;
  const yText = top + span * 0.07;
  const yChip = top + span * 0.15;
  const yX = top + span * 0.37;
  const yTf = top + span * 0.46;
  const tfH = span * 0.12;
  const yH = top + span * 0.65;
  const yLog = top + span * 0.74;
  const size = s.tall ? 3.9 : 3.4;
  const { pos } = flowLayout(s, PROMPT_IDS.map(tokLabel), w / 2, yChip, w - 8 * u, size, PROMPT_IDS.map(String), 1.8);
  const dim = o.dim ?? 0;
  s.alpha(o.text, () => s.text(`“${PROMPT}”`, w / 2, yText, { size: 4.6, italic: true, color: s.c('--ink') }));
  // tokens, with ids underneath
  PROMPT_IDS.forEach((id, i) => {
    const a = clamp01(o.chips * PROMPT_IDS.length - i);
    const p = pos[i]!;
    s.alpha(a, () => chip(s, p.x, p.y, tokLabel(id), tokK(id), { size, sub: String(id), subK: 'gold' }));
  });
  s.alpha(1 - dim, () => {
    // embedding rows
    const sw = Math.min(14 * u, ...pos.map((p) => p.w));
    PROMPT_IDS.forEach((id, i) => {
      const p = pos[i]!;
      const cx = p.x + p.w / 2;
      const a = clamp01(o.x * PROMPT_IDS.length - i);
      s.alpha(a, () => {
        s.arrow(cx, yChip + chipH(s, size, true) + u * 0.6, cx, yX - u * 0.8, s.tint('--ink-3', 0.8), 0.3, 1.6);
        strip(s, cx - sw / 2, yX, sw / 4, 3.6 * u, rowOf(id), 'orange');
      });
    });
    s.alpha(o.x, () => s.text('x', 4 * u, yX + 1.8 * u, { size: 4.6, italic: true, weight: 650, align: 'left', color: s.c('orange') }));
    // transformer
    s.alpha(o.tf, () => block(s, 6 * u, yTf, w - 12 * u, tfH, 'transformer', 'slate', s.tall ? 4.2 : 4.4, 'vectors in, vectors out'));
    PROMPT_IDS.forEach((id, i) => {
      const p = pos[i]!;
      const cx = p.x + p.w / 2;
      const a = clamp01(o.hh * PROMPT_IDS.length - i);
      s.alpha(a, () => {
        s.arrow(cx, yTf + tfH + u * 0.5, cx, yH - u * 0.6, s.tint('--ink-3', 0.8), 0.3, 1.6);
        strip(s, cx - sw / 2, yH, sw / 4, 3.6 * u, rowOf(id + 5).map((v) => -v), 'green', i === PROMPT_IDS.length - 1 ? 1 : 0.55);
      });
    });
    s.alpha(o.hh, () => s.text('h', 4 * u, yH + 1.8 * u, { size: 4.6, italic: true, weight: 650, align: 'left', color: s.c('green') }));
    // scores for the last position
    s.alpha(o.logits, () => {
      const last = pos[pos.length - 1]!;
      const lx = last.x + last.w / 2;
      const bx = s.tall ? w * 0.34 : w * 0.38;
      const rowH = (h - yLog - 5 * u) / 4.4;
      s.arrow(lx, yH + 4.2 * u, lx, yLog + 0.4 * u, s.tint('--ink-3', 0.8), 0.3, 1.6);
      s.text(o.logLabel ?? 'logits = h @ U: a score per token', bx - 18 * u, yLog + 1.8 * u, { font: 'mono', size: 3.3, align: 'left', color: s.c('purple') });
      CANDS.forEach(([lab, v], i) => hbar(s, bx - 18 * u, yLog + 4.6 * u + i * rowH, 18 * u, (w - bx) * 0.55, v, lab, '', 'purple', { size: 3.4, on: i === 0 ? o.next : 0 }));
    });
  });
  // the chosen token joins the text
  s.alpha(o.next * (1 - dim), () => {
    const tw = s.measure(`“${PROMPT}”`, { size: 4.4, italic: true });
    pill(s, '␣lamp', w / 2 + tw / 2 + 2 * u, yText, 'purple', 3.6, 'left');
  });
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'vectors'), () => {
      s.text('Tokens and embeddings', w / 2, h * 0.36, { size: s.tall ? 8 : 8.5, font: 'display', weight: 600 });
      s.text('the two ends of a language model', w / 2, h * 0.36 + 9 * u, { size: 4.4, italic: true, color: s.c('--ink-2') });
    });
    const odd = s.ease('odd', 0.8);
    pipeline(s, {
      text: s.ease('vectors', 0.6),
      chips: s.ease('tok', 1.6, 1.4),
      x: s.ease('emb', 1.2, 0.5),
      tf: s.ease('vectors', 0.7, 1.2),
      hh: s.ease('tf', 1.2, 0.8),
      logits: s.ease('unemb', 0.8, 0.6),
      next: s.ease('next', 0.7, 0.8),
      dim: odd,
    });
    // the tokenizer, singled out
    s.alpha(odd, () => {
      const y0 = h * 0.025;
      const y1 = h * 0.33;
      s.ctx.save();
      s.ctx.setLineDash([u * 1.2, u * 0.9]);
      s.rrect(3 * u, y0, w - 6 * u, y1 - y0, 2.5, { stroke: s.c('gold'), lw: 0.45 });
      s.ctx.restore();
      s.text('the tokenizer: built by counting,', w / 2, y1 + 6 * u, { size: 4, font: 'ui', weight: 600, color: s.c('gold') });
      s.text('then frozen', w / 2, y1 + 11.5 * u, { size: 4, font: 'ui', weight: 600, color: s.c('gold') });
      s.text('no gradient ever reaches it', w / 2, y1 + 18 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(s.ease('leak', 0.7, 1.5), () => {
      const tags = ['context length', 'cost per token', 'numbers', 'spelling', 'other languages'];
      const y = h * 0.66;
      const per = s.tall ? 2 : 3;
      tags.forEach((t, i) => {
        const row = Math.floor(i / per);
        const inRow = Math.min(per, tags.length - row * per);
        const col = i % per;
        const x = w / 2 + (col - (inRow - 1) / 2) * (s.tall ? 42 : 40) * u;
        s.alpha(clamp01((s.since('leak') - 1.5) * 2 - i * 0.4), () => pill(s, t, x, y + row * 8.5 * u, 'gold', 3.6));
      });
    });
  },
};

// ---------------------------------------------------------------- units

const U_TEXT = 'The lighthouses were rewritten by machines.';
const U_CHARS = Array.from(U_TEXT);
const U_WORDS = U_TEXT.match(/[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]/gu) ?? [];
const U_KNOWN = new Set(['The', 'were', 'by', '.']);
const U_IDS = enc(U_TEXT);

const units: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const beat = current(s, ['first', 'chars', 'long', 'square', 'words', 'explode', 'unk', 'sub', 'pieces', 'dial', 'costs']);
    const size = s.tall ? 3.4 : 3.2;
    const wsize = s.tall ? 3.6 : 3.4;
    const maxW = w - 8 * u;
    let y = h * 0.05;
    s.alpha(1 - s.ease('chars', 0.5), () => {
      s.text(`“${U_TEXT}”`, w / 2, h * 0.42, { size: s.tall ? 4 : 4.6, italic: true });
      s.text('characters · words · subwords', w / 2, h * 0.42 + 8 * u, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
    });
    const label = (t: string, stats: string, a: number) =>
      s.alpha(a, () => {
        s.text(t, 4 * u, y, { size: 3.6, font: 'ui', weight: 650, align: 'left' });
        s.text(stats, w - 4 * u, y, { size: 3.4, font: 'mono', align: 'right', color: s.c('--ink-2') });
      });
    // characters
    const aC = s.ease('chars', 0.6);
    label('characters', `n = ${U_CHARS.length} · V = 48`, aC);
    const lc = flowLayout(s, U_CHARS.map((c) => (c === ' ' ? '␣' : c)), w / 2, y + 3.8 * u, maxW, size, false, 0.6);
    const longOn = beat === 'long' ? Math.sin(clamp01(s.since('long') / 2.5) * Math.PI) : 0;
    s.alpha(aC, () => lc.pos.forEach((p, i) => s.alpha(clamp01(s.since('chars') * 25 - i), () => chip(s, p.x, p.y, U_CHARS[i] === ' ' ? '␣' : U_CHARS[i]!, '--ink-3', { size, on: longOn }))));
    y += 3.8 * u + lc.height + 5 * u;
    // words
    const aW = s.ease('words', 0.6);
    label('words', `n = ${U_WORDS.length} · 3 unknown`, aW);
    const unk = s.since('unk') >= 0 ? 1 : 0;
    const lw = flowLayout(s, U_WORDS.map((t) => (U_KNOWN.has(t) || !unk ? t : '<unk>')), w / 2, y + 3.8 * u, maxW, wsize, false, 0.9);
    s.alpha(aW, () =>
      lw.pos.forEach((p, i) => {
        const known = U_KNOWN.has(U_WORDS[i]!);
        chip(s, p.x, p.y, known || !unk ? U_WORDS[i]! : '<unk>', 'blue', { size: wsize, bad: !known && unk > 0, on: !known && beat === 'unk' ? 1 : 0 });
      }),
    );
    y += 3.8 * u + lw.height + 5 * u;
    // subwords
    const aS = s.ease('sub', 0.6);
    label('subwords (BPE)', `n = ${U_IDS.length} · none unknown`, aS);
    const ls = flowLayout(s, U_IDS.map(tokLabel), w / 2, y + 3.8 * u, maxW, wsize, false, 0.7);
    s.alpha(aS, () => ls.pos.forEach((p, i) => chip(s, p.x, p.y, tokLabel(U_IDS[i]!), tokK(U_IDS[i]!), { size: wsize, on: beat === 'pieces' && i <= 2 && i >= 1 ? 1 : 0 })));
    y += 3.8 * u + ls.height + 6 * u;
    const by = Math.max(y, h * 0.6);
    // attention pairs
    s.alpha(s.win('square', 'words'), () => {
      s.text('attention compares every pair: n²', w / 2, by + 2 * u, { size: 3.8, font: 'ui', color: s.c('--ink-2') });
      s.text('43 × 43 = 1,849 pairs', w / 2, by + 9 * u, { size: 4.2, font: 'mono', weight: 650, color: s.c('red') });
    });
    // one word, many entries
    s.alpha(s.win('explode', 'unk'), () => {
      const forms = ['run', 'runs', 'running', 'runner'];
      const lf = flowLayout(s, forms, w / 2, by, maxW, 3.8, false, 2.5);
      lf.pos.forEach((p, i) => chip(s, p.x, p.y, forms[i]!, 'blue', { size: 3.8 }));
      s.text('four unrelated vocabulary entries', w / 2, by + lf.height + 5 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(s.win('pieces', 'dial'), () => s.text('lighthouses = ␣lighthouse + s', w / 2, by + 3 * u, { size: 4, font: 'mono', weight: 600, color: s.c('--ink') }));
    // the dial
    s.alpha(s.ease('dial', 0.7), () => {
      const x0 = 10 * u, x1 = w - 10 * u, dy = by + 6 * u;
      s.line(x0, dy, x1, dy, s.c('--ink-3'), 0.5);
      s.arrow(x1 - 2 * u, dy, x1 + 2 * u, dy, s.c('--ink-3'), 0.5, 2);
      s.arrow(x0 + 2 * u, dy, x0 - 2 * u, dy, s.c('--ink-3'), 0.5, 2);
      const marks: [string, number, K][] = [['characters', 0.08, '--ink-3'], ['subwords', 0.5, 'purple'], ['words', 0.92, 'blue']];
      for (const [t, f, k] of marks) {
        const x = lerp(x0, x1, f);
        s.circle(x, dy, 1.4 * u, { fill: s.c(k) });
        s.text(t, x, dy - 4 * u, { size: 3.5, font: 'ui', weight: 600, color: s.c(k), align: f < 0.2 ? 'left' : f > 0.8 ? 'right' : 'center' });
      }
      s.text('small V, long n', x0 - 4 * u, dy + 5.5 * u, { size: 3.4, font: 'ui', align: 'left', color: s.c('--ink-2') });
      s.text('big V, short n', x1 + 4 * u, dy + 5.5 * u, { size: 3.4, font: 'ui', align: 'right', color: s.c('--ink-2') });
      s.alpha(s.ease('costs', 0.6, 0.3), () => s.text('costs compute, context', x0 - 4 * u, dy + 11 * u, { size: 3.4, italic: true, align: 'left', color: s.c('red') }));
      s.alpha(s.ease('costs', 0.6, 3.2), () => s.text('costs parameters, data', x1 + 4 * u, dy + 11 * u, { size: 3.4, italic: true, align: 'right', color: s.c('red') }));
    });
  },
};

// ---------------------------------------------------------------- bpe by hand

/** Which state of the toy merge run is on screen: m merges done, and whether we are counting for the next. */
function bpeStage(s: Scene): { m: number; counting: boolean; flash: number } {
  const beat = current(s, ['name', 'history', 'one', 'start', 'count', 'glue', 'th', 'the', 'on', 'cross', 'end', 'greedy']);
  const p = beat ? s.prog(beat) : 0;
  switch (beat) {
    case 'start':
      return { m: 0, counting: false, flash: 0 };
    case 'count':
      return { m: 0, counting: true, flash: 0 };
    case 'glue':
      return { m: 1, counting: false, flash: s.ease('glue', 0.6) };
    case 'th':
      return p < 0.45 ? { m: 1, counting: true, flash: 0 } : { m: 2, counting: false, flash: smooth((p - 0.45) * 5) };
    case 'the':
      return p < 0.45 ? { m: 2, counting: true, flash: 0 } : { m: 3, counting: false, flash: smooth((p - 0.45) * 5) };
    case 'on':
      return { m: 3, counting: false, flash: 1 };
    case 'cross': {
      const m = 3 + Math.min(3, Math.floor(p * 3.6 + 0.3));
      return { m, counting: false, flash: 1 };
    }
    case 'end':
      return { m: 6 + Math.min(2, Math.floor(p * 2.6 + 0.3)), counting: false, flash: 1 };
    case 'greedy':
      return { m: 8, counting: false, flash: 1 };
    default:
      return { m: -1, counting: false, flash: 0 };
  }
}

const bpe: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const st = bpeStage(s);
    // title card before the toy text starts
    s.alpha(1 - s.ease('start', 0.6), () => {
      s.text('byte-pair encoding', w / 2, h * 0.3, { size: 7.5, font: 'display', weight: 600 });
      s.alpha(s.ease('history', 0.6), () => {
        const items: [string, string][] = [['1994', 'a compression trick'], ['2015', 'subwords for translation'], ['2019', 'GPT-2: on raw bytes']];
        items.forEach(([yr, t], i) =>
          s.alpha(clamp01((s.since('history') - i * 2) * 1.5), () => {
            const y = h * 0.45 + i * 7.5 * u;
            s.text(yr, w / 2 - 4 * u, y, { size: 4, font: 'mono', weight: 650, align: 'right', color: s.c('purple') });
            s.text(t, w / 2, y, { size: 3.8, align: 'left' });
          }),
        );
      });
      s.alpha(s.ease('one', 0.6), () => {
        const y = h * 0.8;
        ['count pairs', 'merge the top one', 'repeat'].forEach((t, i) => {
          const x = w / 2 + (i - 1) * (s.tall ? 33 : 40) * u;
          s.alpha(clamp01((s.since('one') - 1 - i * 1.6) * 1.5), () => pill(s, t, x, y, i === 1 ? 'purple' : '--ink-2', 3.4));
        });
      });
    });
    if (st.m < 0) return;
    const state = TINY_STATES[st.m]!;
    const size = s.tall ? 4 : 3.4;
    const left = 4 * u;
    const areaW = s.tall ? w - 8 * u : w * 0.6;
    const cx = left + areaW / 2;
    const y0 = h * 0.05;
    s.alpha(s.ease('start', 0.6), () => {
      s.text(st.m === 0 ? 'the text as bytes' : `after ${st.m} merge${st.m > 1 ? 's' : ''}`, left, y0, { size: 3.6, font: 'ui', weight: 650, align: 'left' });
      s.text(`${state.ids.length} tokens`, left + areaW, y0, { size: 3.4, font: 'mono', align: 'right', color: s.c('--ink-2') });
      const lay = flowLayout(s, state.ids.map(tinyLabel), cx, y0 + 4 * u, areaW, size, state.ids.map(String), 0.7);
      // occurrences of the winning pair, while counting
      const ring = new Set<number>();
      if (st.counting && state.best) {
        for (let i = 0; i + 1 < state.ids.length; i++) if (state.ids[i] === state.best[0] && state.ids[i + 1] === state.best[1]) {
          ring.add(i).add(i + 1);
          i++;
        }
      }
      const fresh = 255 + st.m;
      state.ids.forEach((id, i) => {
        const p = lay.pos[i]!;
        const on = ring.has(i) ? 1 : id === fresh && st.m > 0 ? Math.max(0.25, Math.sin(clamp01(st.flash) * Math.PI)) : 0;
        chip(s, p.x, p.y, tinyLabel(id), tokK(id), { size, sub: String(id), on });
      });
      // pair counts
      const py = s.tall ? y0 + 4 * u + lay.height + 6 * u : y0 + 2 * u;
      const px = s.tall ? 4 * u : w * 0.67;
      const pw = s.tall ? w * 0.52 : w - px - 4 * u;
      s.text('pair counts', px, py, { size: 3.6, font: 'ui', weight: 650, align: 'left' });
      const mx = state.sorted[0]?.[2] ?? 1;
      const top5 = state.sorted.slice(0, 5);
      const lw5 = Math.max(17 * u, ...top5.map(([a, b]) => s.measure(`${tinyLabel(a)} ${tinyLabel(b)}`, { font: 'mono', size: 3.5 }) + 2 * u));
      top5.forEach(([a, b, n], r) => {
        const win = r === 0 && st.counting;
        hbar(s, px, py + 4.2 * u + r * 5.4 * u, lw5, pw - lw5 - 8 * u, n / mx, `${tinyLabel(a)} ${tinyLabel(b)}`, String(n), win ? 'red' : '--ink-3', { size: 3.5, on: win ? 1 : 0 });
      });
      // vocabulary so far
      const vx = s.tall ? w * 0.58 : w * 0.67;
      const vy = s.tall ? py : py + 36 * u;
      const vw = s.tall ? w - vx - 4 * u : w - vx - 4 * u;
      s.text(`V = 256 + ${st.m}`, vx, vy, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('slate') });
      const made = Array.from({ length: st.m }, (_, j) => 256 + j);
      const lv = flowLayout(s, made.map(tinyLabel), vx + vw / 2, vy + 4.4 * u, vw, 3.4, false, 0.8);
      made.forEach((id, j) => chip(s, lv.pos[j]!.x, lv.pos[j]!.y, tinyLabel(id), tokK(id), { size: 3.4, on: j === 5 && s.since('cross') >= 0 && s.since('end') < 0 ? 1 : 0 }));
    });
    s.alpha(s.ease('greedy', 0.6, 0.5), () => {
      const y = h * 0.9;
      s.rrect(w * 0.08, y - 5 * u, w * 0.84, 10 * u, 2, { fill: s.c('--card') });
      s.text('no gradients, no loss: just counting', w / 2, y, { size: 4, italic: true, color: s.c('purple') });
    });
    const k = st.counting ? st.m : Math.max(0, st.m - 1);
    const shown = TINY_STATES[k]!;
    s.slot('k', st.m === 0 && !st.counting ? 0 : k);
    s.slot('pair', st.m === 0 && !st.counting ? '…' : shown.best ? `(${shown.best[0]}, ${shown.best[1]})` : '…');
    s.slot('n', state.ids.length);
  },
};

// ---------------------------------------------------------------- a page

/** How many merges are on screen, sweeping up through the beats. */
function pageK(s: Scene): number {
  const seg: [string, number, number][] = [['early', 0, 12], ['words', 12, 40], ['curve', 40, 100], ['dial', 100, 150], ['end', 150, KMAX]];
  let k = 0;
  for (const [b, a, z] of seg) if (s.since(b) >= 0) k = Math.round(lerp(a, z, smooth(clamp01(s.prog(b) * 1.5))));
  return k;
}

const page: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const k = pageK(s);
    const plot: [number, number, number, number] = s.tall ? [13 * u, 5 * u, w - 18 * u, h * 0.36] : [12 * u, 8 * u, w * 0.48, h * 0.6];
    const [px, py, pw, ph] = plot;
    const X = (kk: number) => px + (pw * kk) / KMAX;
    const Y = (v: number) => py + ph * (1 - v);
    const aPlot = s.ease('story', 0.7);
    s.alpha(1 - aPlot, () => {
      s.text('one page of text', w / 2, h * 0.4, { size: 7, font: 'display', weight: 600 });
      s.text('BPE finds the words on its own', w / 2, h * 0.4 + 9 * u, { size: 4, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(aPlot, () => {
      // axes
      for (let v = 0.25; v <= 1.001; v += 0.25) {
        s.line(px, Y(v), px + pw, Y(v), s.c('--grid'), 0.25);
        s.text(v.toFixed(2), px - 1.5 * u, Y(v), { font: 'mono', size: 3.1, align: 'right', color: s.c('--ink-3') });
      }
      s.line(px, py, px, py + ph, s.c('--axis'), 0.35);
      s.line(px, py + ph, px + pw, py + ph, s.c('--axis'), 0.35);
      for (let kk = 0; kk <= KMAX; kk += 50) s.text(String(kk), X(kk), py + ph + 3.2 * u, { font: 'mono', size: 3.1, color: s.c('--ink-3') });
      s.text('merges learned', px + pw, py + ph - 2.8 * u, { font: 'ui', size: 3.3, align: 'right', color: s.c('--ink-3') });
      s.text('tokens per byte', px + 1.5 * u, py + 0.5 * u, { font: 'ui', size: 3.3, align: 'left', base: 'top', color: s.c('--ink-3'), halo: true });
      // the curves
      const blue = s.ease('curve', 0.6);
      const c = s.ctx;
      const path = (lens: number[], tot: number, upto: number) => {
        c.beginPath();
        for (let i = 0; i <= upto; i++) (i ? c.lineTo : c.moveTo).call(c, X(i), Y(lens[i]! / tot));
      };
      s.alpha(blue, () => {
        path(BPE_SPLIT.lens, BPE_SPLIT.bytes, k);
        c.strokeStyle = s.c('blue');
        c.lineWidth = 0.6 * u;
        c.stroke();
        s.text('training text', X(KMAX * 0.98), Y(0.8), { font: 'ui', size: 3.5, weight: 650, align: 'right', color: s.c('blue'), halo: true });
      });
      const purple = s.ease('new', 0.6);
      s.alpha(purple, () => {
        path(HELD_LENS, HELD_BYTES, Math.round(KMAX * smooth(s.prog('new') * 1.4)));
        c.strokeStyle = s.c('purple');
        c.lineWidth = 0.5 * u;
        c.setLineDash([1.6 * u, 1.1 * u]);
        c.stroke();
        c.setLineDash([]);
        s.text('new text, same style', X(KMAX * 0.98), Y(0.68), { font: 'ui', size: 3.5, weight: 650, align: 'right', color: s.c('purple'), halo: true });
      });
      s.line(X(k), py, X(k), py + ph, s.tint('--accent', 0.6), 0.3, [1, 1]);
      s.alpha(blue, () => s.circle(X(k), Y(BPE_SPLIT.lens[k]! / BPE_SPLIT.bytes), 1.1 * u, { fill: s.c('blue') }));
    });
    // the first words of the story, at k merges
    const cx = s.tall ? w / 2 : w * 0.78;
    const areaW = s.tall ? w - 8 * u : w * 0.4;
    const cy = s.tall ? h * 0.5 : h * 0.1;
    s.alpha(aPlot, () => {
      const ids = encode(EXCERPT, BPE_SPLIT, k);
      s.text(`${ids.length} tokens, V = ${256 + k}`, cx, cy, { font: 'mono', size: 3.6, weight: 600, color: s.c('slate') });
      const size = s.tall ? 3.5 : 3.2;
      const lay = flowLayout(s, ids.map(tokLabel), cx, cy + 4 * u, areaW, size, false, 0.6);
      ids.forEach((id, i) => chip(s, lay.pos[i]!.x, lay.pos[i]!.y, tokLabel(id), tokK(id), { size, on: id === 255 + k && k > 0 ? 1 : 0 }));
      const ny = cy + 4 * u + lay.height + 5 * u;
      // the newest merge, large
      s.alpha(s.ease('early', 0.5) * (1 - s.ease('memorize', 0.5)), () => {
        if (k > 0) {
          s.text(`newest token #${k - 1}`, cx, ny, { font: 'ui', size: 3.5, color: s.c('--ink-2') });
          const lab = tokLabel(255 + k);
          chip(s, cx - (s.measure(lab, { font: 'mono', size: 4.2, weight: 560 }) + 4.2 * 0.84 * u) / 2, ny + 2.5 * u, lab, tokK(255 + k), { size: 4.2, on: 1 });
        }
      });
      s.alpha(s.ease('memorize', 0.6), () => {
        s.text('the last merges', cx, ny, { font: 'ui', size: 3.5, color: s.c('--ink-2') });
        const last = Array.from({ length: 6 }, (_, j) => 256 + KMAX - 6 + j);
        const ll = flowLayout(s, last.map(tokLabel), cx, ny + 2.8 * u, areaW, 3.5, false, 0.8);
        last.forEach((id, j) => chip(s, ll.pos[j]!.x, ll.pos[j]!.y, tokLabel(id), tokK(id), { size: 3.5 }));
      });
    });
    s.alpha(s.win('split', 'scale'), () => s.text('every token stays inside one word', w / 2, h * 0.93, { size: 3.8, italic: true, color: s.c('purple') }));
    s.alpha(s.ease('scale', 0.6), () => s.text('real tokenizers: huge, varied text', w / 2, h * 0.93, { size: 3.8, italic: true, color: s.c('purple') }));
    s.slot('k', k);
    s.slot('V', 256 + k);
    s.slot('n', BPE_SPLIT.lens[k]!);
  },
};

export const scenesA: Record<string, SceneDef> = { intro, units, bpe, page };
