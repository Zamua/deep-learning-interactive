import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { bytesOf, utf8Len } from '../../lib/tokenization-bpe';
import { BPE_SPLIT, ENC_TEXT, ENC_TRACE, enc, tokLabel } from './data';
import { type K, chip, chipW, flowLayout, hbar, tokK } from './kit';

// ---------------------------------------------------------------- encode and decode

/** Trace step on screen, advancing through the beats. */
function encStep(s: Scene): number {
  const last = ENC_TRACE.length - 1;
  const seg: [string, number, number][] = [['oldest', 0, 5], ['why', 5, 11], ['watch', 11, last]];
  let k = 0;
  for (const [b, a, z] of seg) if (s.since(b) >= 0) k = Math.round(lerp(a, z, clamp01(s.prog(b) * 1.15)));
  return k;
}

const encodeScene: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // what training leaves behind
    s.alpha(s.win('two', 'replay'), () => {
      const x0 = s.tall ? 4 * u : w * 0.06;
      const x1 = s.tall ? 4 * u : w * 0.54;
      const y0 = h * 0.08;
      const y1 = s.tall ? h * 0.52 : h * 0.08;
      s.text(`merges, in learned order (${BPE_SPLIT.merges.length})`, x0, y0, { size: 3.6, font: 'ui', weight: 650, align: 'left' });
      for (let r = 0; r < 5; r++) {
        const [a, b] = BPE_SPLIT.merges[r]!;
        s.text(`#${r}  ${tokLabel(a)} + ${tokLabel(b)} → ${tokLabel(256 + r)}`, x0 + 2 * u, y0 + (6 + r * 5.4) * u, { size: 3.6, font: 'mono', align: 'left' });
      }
      s.text('⋮', x0 + 8 * u, y0 + 33 * u, { size: 3.6, color: s.c('--ink-3') });
      s.alpha(s.ease('two', 0.6, 3.5), () => {
        s.text('vocab: the bytes behind every id', x1, y1, { size: 3.6, font: 'ui', weight: 650, align: 'left' });
        [116, 256, 258, 337, 366].forEach((id, r) => s.text(`${id} → ${tokLabel(id)}`, x1 + 2 * u, y1 + (6 + r * 5.4) * u, { size: 3.6, font: 'mono', align: 'left', color: s.c(r === 0 ? '--ink-2' : '--ink') }));
      });
    });
    // encoding, one merge at a time
    const aEnc = s.win('replay', 'decode');
    const k = encStep(s);
    const st = ENC_TRACE[k]!;
    const ids = st.chunks.flat();
    const size = s.tall ? 4 : 3.6;
    s.alpha(aEnc, () => {
      s.text(`“${ENC_TEXT}”`, w / 2, h * 0.08, { size: 4.6, italic: true });
      const head = st.rank < 0 ? 'start: the raw bytes' : `merge #${st.rank}: ${tokLabel(BPE_SPLIT.merges[st.rank]![0])} + ${tokLabel(BPE_SPLIT.merges[st.rank]![1])} → ${tokLabel(256 + st.rank)}`;
      s.text(head, w / 2, h * 0.18, { size: 3.9, font: 'mono', weight: 600, color: s.c(st.rank < 0 ? '--ink-2' : 'purple') });
      const lay = flowLayout(s, ids.map(tokLabel), w / 2, h * 0.26, w - 8 * u, size, ids.map(String), 1);
      ids.forEach((id, i) => chip(s, lay.pos[i]!.x, lay.pos[i]!.y, tokLabel(id), tokK(id), { size, sub: String(id), subK: 'gold', on: st.rank >= 0 && id === 256 + st.rank ? 1 : 0 }));
      s.text(`${ids.length} tokens`, w / 2, h * 0.26 + lay.height + 6 * u, { size: 3.8, font: 'mono', color: s.c('--ink-2') });
      s.alpha(s.ease('stop', 0.6), () => s.text('no learned pair left: done', w / 2, h * 0.26 + lay.height + 13 * u, { size: 4, italic: true, color: s.c('green') }));
    });
    // decoding
    s.alpha(s.win('decode', 'space'), () => {
      const fin = ENC_TRACE[ENC_TRACE.length - 1]!.chunks.flat();
      const y0 = h * 0.14;
      s.text('ids', 4 * u, y0, { size: 3.4, font: 'ui', weight: 650, align: 'left', color: s.c('gold') });
      const li = flowLayout(s, fin.map(String), w / 2, y0 + 4 * u, w - 8 * u, 3.6, false, 1.4);
      fin.forEach((id, i) => chip(s, li.pos[i]!.x, li.pos[i]!.y, String(id), 'gold', { size: 3.6 }));
      const y1 = y0 + 4 * u + li.height + 10 * u;
      s.arrow(w / 2, y1 - 8 * u, w / 2, y1 - 3 * u, s.c('--ink-3'), 0.4, 2);
      s.alpha(s.ease('decode', 0.6, 2.2), () => {
        s.text('look up the bytes', 4 * u, y1, { size: 3.4, font: 'ui', weight: 650, align: 'left' });
        const lb = flowLayout(s, fin.map(tokLabel), w / 2, y1 + 4 * u, w - 8 * u, 3.6, false, 1.4);
        fin.forEach((id, i) => chip(s, lb.pos[i]!.x, lb.pos[i]!.y, tokLabel(id), tokK(id), { size: 3.6 }));
        const y2 = y1 + 4 * u + lb.height + 10 * u;
        s.arrow(w / 2, y2 - 8 * u, w / 2, y2 - 3 * u, s.c('--ink-3'), 0.4, 2);
        s.alpha(s.ease('decode', 0.6, 4.4), () => {
          s.text('join, read as UTF-8', 4 * u, y2, { size: 3.4, font: 'ui', weight: 650, align: 'left' });
          s.text(`“${ENC_TEXT}”`, w / 2, y2 + 8 * u, { size: 4.4, italic: true, color: s.c('green') });
        });
      });
    });
    // the space matters
    s.alpha(s.win('space', 'special'), () => {
      const rows: [string, string][] = [[' lighthouse', 'with the space'], ['lighthouse', 'without it']];
      rows.forEach(([txt, note], r) => {
        const y = h * (0.18 + r * 0.32);
        const ids2 = enc(txt);
        s.text(`${note}: ${ids2.length} token${ids2.length > 1 ? 's' : ''}`, w / 2, y, { size: 3.6, font: 'ui', weight: 600, color: s.c(r ? 'red' : 'green') });
        const lay = flowLayout(s, ids2.map(tokLabel), w / 2, y + 5 * u, w - 8 * u, 4, ids2.map(String), 1.4);
        ids2.forEach((id, i) => chip(s, lay.pos[i]!.x, lay.pos[i]!.y, tokLabel(id), tokK(id), { size: 4, sub: String(id), subK: 'gold' }));
      });
    });
    // special tokens
    s.alpha(s.win('special', 'gpt2'), () => {
      const parts: [string, K][] = [['…ships␣passed.', 'blue'], ['<\u200a|endoftext|\u200a>', 'red'], ['The␣Mary␣Ellen…', 'purple']];
      const size2 = s.tall ? 3.8 : 4;
      const lay = flowLayout(s, parts.map((p) => p[0]), w / 2, h * 0.36, w - 8 * u, size2, ['one document', 'id 50256', 'the next'], 2);
      parts.forEach(([t, k2], i) => chip(s, lay.pos[i]!.x, lay.pos[i]!.y, t, k2, { size: size2, sub: i === 1 ? 'id 50256' : i === 0 ? 'one document' : 'the next', on: i === 1 ? 1 : 0, subK: i === 1 ? 'red' : '--ink-3' }));
      s.text('no merge makes it; code inserts it by id', w / 2, h * 0.36 + lay.height + 10 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(s.ease('gpt2', 0.6), () => {
      const y = h * 0.42;
      const parts: [string, string, K][] = [['256', 'bytes', '--ink-2'], ['50,000', 'merges', 'purple'], ['1', 'special', 'red']];
      const gap = s.tall ? 33 * u : 36 * u;
      parts.forEach(([n, lab, k2], i) => {
        const x = w / 2 + (i - 1) * gap;
        s.text(n, x, y, { size: s.tall ? 5.6 : 7, font: 'mono', weight: 650, color: s.c(k2) });
        s.text(lab, x, y + 7 * u, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
        if (i < 2) s.text('+', x + gap / 2, y, { size: 5, font: 'mono', color: s.c('--ink-3') });
      });
      s.text('= 50,257 tokens in GPT-2', w / 2, y + 18 * u, { size: s.tall ? 5 : 5.6, font: 'mono', weight: 650 });
    });
  },
};

// ---------------------------------------------------------------- bytes

const GLYPHS = ['a', 'é', 'κ', 'ж', '你', 'ب', 'अ', '🌊', '∑', 'ñ', 'ß', 'あ', '한', '€', 'ω', 'ש'];
const LEN_K: K[] = ['--ink-3', 'blue', 'green', 'orange', 'purple'];

/** One line of characters, each with its UTF-8 bytes in hex underneath. */
function charRow(s: Scene, text: string, cx: number, y: number, size: number): number {
  const { u } = s;
  const chars = Array.from(text);
  const bw = size * 0.62 * 2 * u + size * 0.5 * u;
  const colW = chars.map((ch) => Math.max(bytesOf(ch).length * (bw + 0.5 * u), 6 * u));
  const gap = 1.6 * u;
  const tot = colW.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  let x = cx - tot / 2;
  chars.forEach((ch, i) => {
    const cw = colW[i]!;
    const bs = bytesOf(ch);
    const k = LEN_K[utf8Len(ch.codePointAt(0)!)]!;
    s.text(ch === ' ' ? '␣' : ch, x + cw / 2, y, { size: size * 1.5, font: 'serif', color: s.c('--ink') });
    const bx0 = x + cw / 2 - (bs.length * (bw + 0.5 * u) - 0.5 * u) / 2;
    bs.forEach((b, j) => {
      const bx = bx0 + j * (bw + 0.5 * u);
      s.rrect(bx, y + size * 1.3 * u, bw, size * 1.5 * u, 0.6, { fill: s.tint(k, 0.16), stroke: s.tint(k, 0.6), lw: 0.2 });
      s.text(b.toString(16).toUpperCase().padStart(2, '0'), bx + bw / 2, y + size * 2.05 * u, { size: size * 0.82, font: 'mono', color: s.c('--ink') });
    });
    x += cw + gap;
  });
  return tot;
}

const bytesScene: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // a hundred and fifty thousand characters
    s.alpha(s.win('problem', 'bytes'), () => {
      s.text('Unicode: over 150,000 characters', w / 2, h * 0.16, { size: s.tall ? 4.6 : 5.4, font: 'display', weight: 600 });
      GLYPHS.forEach((g, i) => {
        const cols = s.tall ? 4 : 8;
        const col = i % cols, row = Math.floor(i / cols);
        const x = w / 2 + (col - (cols - 1) / 2) * (s.tall ? 20 : 15) * u;
        const y = h * 0.36 + row * (s.tall ? 14 : 16) * u;
        s.alpha(clamp01((s.since('problem') - 0.5) * 3 - i * 0.25), () => s.text(g, x, y, { size: 7, font: 'serif' }));
      });
    });
    // 256 byte values
    s.alpha(s.win('bytes', 'ascii'), () => {
      s.text('UTF-8: every character is 1 to 4 bytes', w / 2, h * 0.08, { size: 3.8, font: 'ui', weight: 600 });
      s.alpha(s.ease('bytes', 0.6, 1.5) * (1 - s.ease('base', 0.4)), () => charRow(s, 'aé你🌊', w / 2, h * 0.4, 4.4));
      s.alpha(s.ease('base', 0.6), () => {
        const cell = Math.min((w - 12 * u) / 16, (h * 0.66) / 16);
        const gx = w / 2 - 8 * cell;
        const gy = h * 0.16;
        for (let b = 0; b < 256; b++) {
          const k: K = b < 128 ? 'blue' : 'slate';
          const r = Math.floor(b / 16), c = b % 16;
          s.alpha(clamp01((s.since('base') - 0.3) * 6 - r * 0.4), () => s.rrect(gx + c * cell + cell * 0.08, gy + r * cell + cell * 0.08, cell * 0.84, cell * 0.84, 0.4, { fill: s.tint(k, b < 128 ? 0.35 : 0.18) }));
        }
        const ly = gy + 16 * cell + 4 * u;
        s.text('256 byte values: the base vocabulary', w / 2, ly, { size: 3.4, font: 'ui', weight: 600 });
        s.text('0 to 127: ASCII · 128 to 255: parts of longer characters', w / 2, ly + 5 * u, { size: 3, font: 'ui', color: s.c('--ink-2') });
      });
    });
    // how many bytes each script takes
    const aRows = s.win('ascii', 'cost');
    s.alpha(aRows, () => {
      const size = s.tall ? 3.6 : 3.6;
      const rows: [string, string, number][] = s.tall
        ? [['night', 'ascii', 0], ['café', 'two', 1], ['καλη', 'two', 2], ['你好 🌊', 'three', 3]]
        : [['night', 'ascii', 0], ['café καλη', 'two', 1], ['你好 🌊', 'three', 2]];
      rows.forEach(([t, b, r]) => {
        const y = s.tall ? h * (0.07 + r * 0.215) : h * (0.1 + r * 0.29);
        s.alpha(s.ease(b, 0.6), () => charRow(s, t, w / 2, y + 2 * u, size));
      });
      s.alpha(s.ease('ascii', 0.6, 1), () => {
        const ly = h * 0.94;
        [1, 2, 3, 4].forEach((n, i) => s.text(`${n} byte${n > 1 ? 's' : ''}`, w / 2 + (i - 1.5) * (s.tall ? 24 : 22) * u, ly, { size: 3.5, font: 'ui', weight: 650, color: s.c(LEN_K[n]!) }));
      });
    });
    // what our English tokenizer does with them
    s.alpha(s.win('cost', 'unfair'), () => {
      const rows: [string, string][] = [['the night light', 'English'], ['καλημέρα', 'Greek: good morning']];
      rows.forEach(([t, lab], r) => {
        const y = h * (0.1 + r * 0.36);
        s.alpha(r === 0 ? 1 : s.ease('greek', 0.6), () => {
          const ids = enc(t);
          s.text(`${lab}: ${Array.from(t).length} characters → ${ids.length} tokens`, w / 2, y, { size: 3.6, font: 'ui', weight: 600, color: s.c(r ? 'red' : 'green') });
          const lay = flowLayout(s, ids.map(tokLabel), w / 2, y + 5 * u, w - 8 * u, 3.8, false, 0.9);
          ids.forEach((id, i) => chip(s, lay.pos[i]!.x, lay.pos[i]!.y, tokLabel(id), tokK(id), { size: 3.8 }));
        });
      });
    });
    s.alpha(s.ease('unfair', 0.6), () => {
      const y = h * 0.2;
      s.text('tokens per character, our tokenizer', w / 2, y, { size: 3.8, font: 'ui', weight: 600 });
      const lw = 22 * u;
      const mw = w - lw - 26 * u;
      hbar(s, 6 * u, y + 7 * u, lw, mw, 0.27 / 2, 'English', '0.27', 'green', { size: 3.8 });
      hbar(s, 6 * u, y + 16 * u, lw, mw, 1, 'Greek', '2.0', 'red', { size: 3.8 });
      s.alpha(s.ease('fix', 0.6), () => {
        s.text('the fix: balanced training text,', w / 2, h * 0.66, { size: 3.8, italic: true, color: s.c('purple') });
        s.text('bigger vocabularies', w / 2, h * 0.66 + 6 * u, { size: 3.8, italic: true, color: s.c('purple') });
      });
    });
  },
};

// ---------------------------------------------------------------- quirks

const PLACE: K[] = ['blue', 'orange', 'green', 'purple', 'teal'];
const NUM_TEXT = '48213 + 7759';

/** A chip whose digits are colored by place value; returns its width. */
function digitChip(s: Scene, x: number, y: number, piece: string, places: number[], size: number): number {
  const w = chipW(s, piece === ' ' ? '␣' : piece.replace(/ /g, '␣'), size);
  const hh = size * 1.75 * s.u;
  s.rrect(x, y, w, hh, size * 0.32, { fill: s.tint('--ink-3', 0.1), stroke: s.tint('--ink-3', 0.5), lw: 0.22 });
  const cw = s.measure('0', { font: 'mono', size, weight: 650 });
  const lab = piece.replace(/ /g, '␣');
  let cx = x + (w - cw * lab.length) / 2;
  Array.from(lab).forEach((ch, i) => {
    const q = places[i]!;
    s.text(ch, cx + cw / 2, y + hh / 2 + s.u * 0.15, { font: 'mono', size, weight: q >= 0 ? 700 : 500, color: s.c(q >= 0 ? PLACE[q % PLACE.length]! : '--ink-3') });
    cx += cw;
  });
  return w;
}

function numberRows(s: Scene, y0: number, a: number[]): void {
  const { w, u } = s;
  const places: number[] = [];
  let run = 0;
  for (let i = NUM_TEXT.length - 1; i >= 0; i--) {
    const dig = /\d/.test(NUM_TEXT[i]!);
    run = dig ? run + 1 : 0;
    places[i] = dig ? run - 1 : -1;
  }
  const rows: [string, string[]][] = [
    ['learned merges (GPT-2 style)', enc(NUM_TEXT).map((id) => tokLabel(id).replace(/␣/g, ' '))],
    ['chunks of three (GPT-4)', NUM_TEXT.match(/\d{1,3}|\D+/g) ?? []],
    ['single digits (LLaMA 2)', NUM_TEXT.match(/\d|\D+/g) ?? []],
  ];
  const size = s.tall ? 4 : 4;
  rows.forEach(([lab, pieces], r) => {
    s.alpha(a[r] ?? 0, () => {
      const y = y0 + r * 16 * u;
      s.text(`${lab}: ${pieces.length} tokens`, 5 * u, y, { size: 3.5, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
      const ws = pieces.map((p) => chipW(s, p.replace(/ /g, '␣'), size));
      const tot = ws.reduce((x, b) => x + b, 0) + 0.8 * u * (pieces.length - 1);
      let x = w / 2 - tot / 2;
      let off = 0;
      pieces.forEach((p, i) => {
        digitChip(s, x, y + 3 * u, p, places.slice(off, off + p.length), size);
        off += p.length;
        x += ws[i]! + 0.8 * u;
      });
    });
  });
  s.alpha(a[0] ?? 0, () => {
    const names = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands'];
    const y = y0 + 50 * u;
    const per = 3;
    names.forEach((n, i) => {
      const row = Math.floor(i / per), col = i % per;
      const inRow = Math.min(per, names.length - row * per);
      s.text(n, w / 2 + (col - (inRow - 1) / 2) * (s.tall ? 32 : 28) * u, y + row * 5.5 * u, { size: 3.4, font: 'ui', weight: 650, color: s.c(PLACE[i]!) });
    });
  });
}

const quirks: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // the regex split
    s.alpha(s.win('split', 'space'), () => {
      const chunks = ['The', ' keeper', "'s", ' log', ',', ' 1901', '!'];
      const kinds = ['letters', 'letters', 'contraction', 'letters', 'punctuation', 'digits', 'punctuation'];
      const ks: K[] = ['blue', 'blue', 'purple', 'blue', 'orange', 'green', 'orange'];
      s.text('“The keeper\'s log, 1901!”', w / 2, h * 0.14, { size: 4.4, italic: true });
      const size = s.tall ? 4.2 : 4.4;
      const lay = flowLayout(s, chunks.map((c) => c.replace(/ /g, '␣')), w / 2, h * 0.3, w - 8 * u, size, false, 1.8);
      chunks.forEach((c, i) => s.alpha(clamp01((s.since('split') - 1) * 2 - i * 0.35), () => chip(s, lay.pos[i]!.x, lay.pos[i]!.y, c.replace(/ /g, '␣'), ks[i]!, { size })));
      const legend: [string, K][] = [['letters', 'blue'], ['digits', 'green'], ['punctuation', 'orange'], ['contraction', 'purple']];
      const ly = h * 0.3 + lay.height + 8 * u;
      legend.forEach(([t, k2], i) => {
        const col = s.tall ? i % 2 : i;
        const row = s.tall ? Math.floor(i / 2) : 0;
        const x = s.tall ? w / 2 + (col - 0.5) * 36 * u : w / 2 + (i - 1.5) * 30 * u;
        s.alpha(s.ease('split', 0.6, 2), () => s.text(t, x, ly + row * 6 * u, { size: 3.6, font: 'ui', weight: 650, color: s.c(k2) }));
      });
      void kinds;
      s.alpha(s.ease('why', 0.6), () => s.text('merges never cross a chunk boundary', w / 2, h * 0.86, { size: 3.8, italic: true, color: s.c('purple') }));
    });
    // spaces and case
    s.alpha(s.win('space', 'letters'), () => {
      const ins = ['the', ' the', 'The', ' The'];
      const size = 4;
      ins.forEach((t, r) => {
        const y = h * 0.1 + r * (s.tall ? 19 : 18) * u;
        s.alpha(clamp01((s.since('space') - 0.5) * 2 - r * 0.6), () => {
          s.text(`“${t.replace(/ /g, '␣')}”`, s.tall ? w * 0.26 : w * 0.34, y + 3.3 * u, { size: 4.2, font: 'mono', align: 'right', color: s.c('--ink') });
          s.arrow(s.tall ? w * 0.29 : w * 0.37, y + 3 * u, s.tall ? w * 0.38 : w * 0.44, y + 3 * u, s.c('--ink-3'), 0.35, 1.8);
          let x = s.tall ? w * 0.41 : w * 0.47;
          enc(t).forEach((id) => {
            x += chip(s, x, y, tokLabel(id), tokK(id), { size, sub: String(id), subK: 'gold' }) + 1.2 * u;
          });
        });
      });
      s.alpha(s.ease('learn', 0.6), () => s.text('four ids for one word', w / 2, h * 0.92, { size: 3.8, italic: true, color: s.c('purple') }));
    });
    // letters are invisible
    s.alpha(s.win('letters', 'numbers'), () => {
      const word = 'lighthouse';
      const cw = Math.min(8 * u, (w - 12 * u) / word.length);
      const x0 = w / 2 - (cw * word.length) / 2;
      s.text('what you see', w / 2, h * 0.12, { size: 3.8, font: 'ui', weight: 600, color: s.c('--ink-2') });
      Array.from(word).forEach((ch, i) => {
        const isH = ch === 'h';
        s.rrect(x0 + i * cw + 0.3 * u, h * 0.17, cw - 0.6 * u, cw * 1.1, 1, { fill: s.tint(isH ? 'red' : '--ink-3', 0.14), stroke: s.tint(isH ? 'red' : '--ink-3', 0.5), lw: 0.25 });
        s.text(ch, x0 + i * cw + cw / 2, h * 0.17 + cw * 0.58, { size: 4.4, font: 'mono', weight: 600, color: s.c(isH ? 'red' : '--ink') });
      });
      const y2 = h * 0.17 + cw * 1.1 + 12 * u;
      s.arrow(w / 2, y2 - 9 * u, w / 2, y2 - 3 * u, s.c('--ink-3'), 0.4, 2);
      s.text('what the model sees', w / 2, y2, { size: 3.8, font: 'ui', weight: 600, color: s.c('--ink-2') });
      const lab = tokLabel(366);
      const cwid = chipW(s, lab, 4.4);
      chip(s, w / 2 - cwid / 2, y2 + 4 * u, lab, tokK(366), { size: 4.4, sub: 'id 366', subK: 'gold', on: 1 });
      s.alpha(s.ease('straw', 0.6), () => {
        s.text('how many h’s? the letters', w / 2, y2 + 22 * u, { size: 3.8, italic: true, color: s.c('purple') });
        s.text('are not in the input', w / 2, y2 + 28 * u, { size: 3.8, italic: true, color: s.c('purple') });
      });
    });
    // numbers
    const aN = s.win('numbers', 'glitch');
    s.alpha(aN, () => {
      s.text(`“${NUM_TEXT}”`, w / 2, h * 0.08, { size: 4.4, font: 'mono', weight: 600 });
      numberRows(s, h * 0.18, [s.ease('numbers', 0.6), s.ease('threes', 0.6), s.ease('digits', 0.6)]);
      s.alpha(s.win('align', 'digits'), () => {
        s.text('482 · 13 against 775 · 9: places do not line up', w / 2, h * 0.94, { size: s.tall ? 3.4 : 3.8, italic: true, color: s.c('red') });
      });
      s.alpha(s.ease('digits', 0.6, 1.5), () => s.text('consistent places, longer sequences', w / 2, h * 0.94, { size: 3.8, italic: true, color: s.c('green') }));
    });
    // glitch tokens
    s.alpha(s.ease('glitch', 0.6), () => {
      const lab = '␣SolidGoldMagikarp';
      const size = s.tall ? 4 : 4.6;
      const cwid = chipW(s, lab, size);
      const y = h * 0.3;
      chip(s, w / 2 - cwid / 2, y, lab, 'red', { size, sub: 'in the vocabulary', subK: 'red' });
      const sw = Math.min(56 * u, w - 16 * u);
      const cells = 8;
      for (let i = 0; i < cells; i++) s.rrect(w / 2 - sw / 2 + (i * sw) / cells + 0.3 * u, y + 20 * u, sw / cells - 0.6 * u, 5 * u, 0.6, { fill: s.tint('--ink-3', 0.12), stroke: s.tint('--ink-3', 0.4), lw: 0.2 });
      s.text('its embedding: almost never trained', w / 2, y + 31 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('magikarp', 0.6, 1), () => s.text('GPT-3 era models replied with nonsense', w / 2, y + 40 * u, { size: 3.8, italic: true, color: s.c('red') }));
    });
  },
};

export const scenesB: Record<string, SceneDef> = { encode: encodeScene, bytes: bytesScene, quirks };
