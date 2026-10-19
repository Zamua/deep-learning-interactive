import type { Page } from '../core/page';
import { fmt } from '../core/code';
import { h } from '../core/dom';
import { color, withAlpha } from '../core/plot';
import {
  type BPE, bytesOf, decode, encode, encodeTrace, getStats, merge, pairOf, pyBytes, show, topPair, train, utf8Len, visible,
} from './tokenization-bpe';
import { CORPUS, HELDOUT, TINY } from './tokenization-corpus';
import { box, chip, flow, head, presets, pyStr, textInput, tokenColor } from './tokenization-ui';

let SPLIT: BPE | null = null;
let RAW: BPE | null = null;
/** The chapter's tokenizer: byte-level BPE with the GPT-2 split, trained on the lighthouse text. */
export const bpeSplit = (): BPE => (SPLIT ??= train(CORPUS, 400, true));
export const bpeRaw = (): BPE => (RAW ??= train(CORPUS, 400, false));

const clip = (s: string, n = 40): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const tokChips = (ids: number[], bpe: BPE, on?: (id: number, i: number) => boolean, sub = true): HTMLElement[] =>
  ids.map((id, i) => chip(show(bpe.vocab[id]!), { k: tokenColor(id), sub: sub ? id : undefined, on: on?.(id, i) }));

/* ------------------------------------------------------------------ */
/* Fig: one sentence, three tokenizers                                  */
/* ------------------------------------------------------------------ */

const WORD_RE = /[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]/gu;

export function figThreeWays(p: Page): void {
  p.figure({
    title: 'One sentence, three ways to cut it',
    codeTitle: 'three_tokenizers.py',
    code: `
      text = {{text:"..."}}

      chars = [c if c in char_vocab else "<unk>"
               for c in text]                        #@chars
      words = re.findall(r"\\w+|[^\\w\\s]", text)      #@words
      words = [w if w in word_vocab else "<unk>"
               for w in words]                       #@words
      ids = bpe.encode(text)  # byte-level BPE       #@bpe

      # characters: n = {{nc}}, V = {{vc}}
      # words:      n = {{nw}}, V = {{vw}}, unknown {{nu}}
      # subwords:   n = {{ns}}, V = {{vs}}
    `,
    setup(f) {
      const bpe = bpeSplit();
      const charSet = new Set(Array.from(CORPUS));
      const wordSet = new Set(CORPUS.match(WORD_RE) ?? []);
      const vc = charSet.size + 1;
      const vw = wordSet.size + 1;
      const vs = 256 + bpe.merges.length;
      const PRE = [
        { label: 'familiar words', text: 'The keeper wrote the wind and the weather in the log.' },
        { label: 'new words', text: 'The lighthouses were rewritten by machines.' },
        { label: 'accents', text: 'A naïve keeper drank café crème.' },
      ];
      const rows = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
      const note = h('div', { class: 'tz-note' });
      f.viz.append(box(rows), note);
      let text = PRE[1]!.text;
      const render = () => {
        const chars = Array.from(text);
        const words = text.match(WORD_RE) ?? [];
        const ids = encode(text, bpe);
        const unkC = chars.filter((c) => !charSet.has(c)).length;
        const unkW = words.filter((w) => !wordSet.has(w)).length;
        rows.replaceChildren(
          h('div', {}, head('characters', `n = ${chars.length} · V = ${vc}${unkC ? ` · ${unkC} unknown` : ''}`),
            flow(chars.map((c) => (charSet.has(c) ? chip(visible(c)) : chip('<unk>', { bad: true }))))),
          h('div', {}, head('words', `n = ${words.length} · V = ${vw} · ${unkW} unknown`),
            flow(words.map((w) => (wordSet.has(w) ? chip(w, { k: 'var(--c-blue)' }) : chip('<unk>', { bad: true, title: w }))))),
          h('div', {}, head('subwords (BPE)', `n = ${ids.length} · V = ${vs} · none unknown`), flow(tokChips(ids, bpe, undefined, false))),
        );
        const sq = (n: number) => (n * n).toLocaleString('en-US');
        note.innerHTML = p.md(`Attention compares every token with every other: $n^2$ = **${sq(chars.length)}** pairs for characters, **${sq(words.length)}** for words, **${sq(ids.length)}** for subwords.`);
        f.code.setMany({ text: pyStr(clip(text, 38)), nc: chars.length, vc, nw: words.length, vw, nu: unkW, ns: ids.length, vs });
        pre.mark(text);
      };
      const pre = presets(PRE, (t) => {
        text = t;
        inp.input.value = t;
        render();
      });
      const inp = textInput(text, 'text', (v) => {
        text = v;
        render();
      });
      f.controls.append(pre.el, inp.el);
      render();
    },
    caption: `The same sentence cut into characters, words, and the subwords of a small byte-level BPE trained on a one-page story (below). Characters need few vocabulary entries but make long sequences; words make short sequences but need a big vocabulary and still meet words they have never seen, which collapse to \`<unk>\`. Subwords spell new words out of known pieces: try **new words**, where *lighthouses* becomes *␣lighthouse* plus *s*. Then try **accents**, or type anything: even emoji get through, as raw bytes.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: BPE by hand                                                     */
/* ------------------------------------------------------------------ */

export function figByHand(p: Page): void {
  type St = { ids: number[]; sorted: [number, number][]; best: [number, number] | null; cnt: number };
  const vocab: Uint8Array[] = Array.from({ length: 256 }, (_, i) => Uint8Array.of(i));
  const states: St[] = [];
  let ids = bytesOf(TINY);
  for (let k = 0; ; k++) {
    const stats = getStats([ids]);
    const top = topPair(stats);
    const sorted = [...stats.entries()].map((e, i) => [e, i] as const).sort((a, b) => b[0][1] - a[0][1] || a[1] - b[1]).map((x) => x[0]);
    if (!top || top[1] < 2) {
      states.push({ ids, sorted, best: null, cnt: 0 });
      break;
    }
    const [a, b] = pairOf(top[0]);
    states.push({ ids, sorted, best: [a, b], cnt: top[1] });
    const v = new Uint8Array(vocab[a]!.length + vocab[b]!.length);
    v.set(vocab[a]!);
    v.set(vocab[b]!, vocab[a]!.length);
    vocab.push(v);
    ids = merge(ids, a, b, 256 + k);
  }
  const M = states.length - 1;
  const nm = (id: number) => show(vocab[id]!);

  p.figure({
    title: 'Byte-pair encoding by hand: count, merge, repeat',
    codeTitle: 'bpe_train.py',
    code: `
      text = "${TINY}"
      ids = list(text.encode("utf-8"))   # ${bytesOf(TINY).length} bytes   #@init

      def get_stats(ids, counts=None):
          counts = {} if counts is None else counts
          for pair in zip(ids, ids[1:]):                #@count
              counts[pair] = counts.get(pair, 0) + 1    #@count
          return counts

      def merge(ids, pair, idx):
          out, i = [], 0
          while i < len(ids):
              if tuple(ids[i:i+2]) == pair:             #@glue
                  out.append(idx); i += 2               #@glue
              else:
                  out.append(ids[i]); i += 1
          return out

      merges = {}
      for k in range(${M}):
          stats = get_stats(ids)                        #@stats
          pair = max(stats, key=stats.get)              #@best
          ids = merge(ids, pair, 256 + k)               #@merge
          merges[pair] = 256 + k                        #@merge
      # k = {{kk:0}}: pair {{pair:…}} seen {{cnt:…}} times
      # len(ids) = {{n:${bytesOf(TINY).length}}}
    `,
    setup(f) {
      const chips = h('div');
      const bars = h('div', { class: 'tz-bars' });
      const learned = h('div', { class: 'tz-flow' });
      const note = h('div', { class: 'tz-note' });
      const side = h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px' },
        h('div', {}, head('pair counts'), bars), h('div', {}, head('vocabulary', '256 bytes +'), learned));
      f.viz.append(box(chips), side, note);
      f.stepper({
        steps: 1 + 2 * M,
        interval: 1300,
        label: (s) => (s === 0 ? 'the raw bytes' : `merge ${Math.ceil(s / 2)} of ${M}: ${s % 2 ? 'count' : 'glue'}`),
        onStep(s) {
          const k = s === 0 ? -1 : Math.ceil(s / 2) - 1;
          const counting = s % 2 === 1;
          const st = states[counting ? k : k + 1]!;
          const cur = states[Math.max(0, k)]!;
          const fire = new Set<number>();
          if (counting && cur.best) {
            const [a, b] = cur.best;
            for (let i = 0; i + 1 < st.ids.length; i++) if (st.ids[i] === a && st.ids[i + 1] === b) {
              fire.add(i).add(i + 1);
              i++;
            }
          }
          chips.replaceChildren(
            head(s === 0 ? 'text as bytes' : counting ? `most frequent pair: ${nm(cur.best![0])} + ${nm(cur.best![1])}` : `glued into token ${256 + k}`, `${st.ids.length} tokens`),
            flow(st.ids.map((id, i) => chip(nm(id), { k: tokenColor(id), sub: id, on: counting ? fire.has(i) : !counting && s > 0 && id === 256 + k }))),
          );
          const show5 = (s === 0 ? states[0]! : cur).sorted.slice(0, 5);
          const mx = show5[0]?.[1] ?? 1;
          bars.replaceChildren(...show5.flatMap(([pk, n], r) => {
            const [a, b] = pairOf(pk);
            const win = s > 0 && r === 0;
            return [
              h('span', { class: win ? 'on' : '' }, `${nm(a)} + ${nm(b)}`),
              h('span', { class: 'tz-bar', style: `width:${(100 * n) / mx}%;--k:${win ? 'var(--accent)' : 'var(--ink-3)'}` }),
              h('span', { class: win ? 'on' : '' }, String(n)),
            ];
          }));
          const made = s === 0 ? 0 : counting ? k : k + 1;
          learned.replaceChildren(...(made ? Array.from({ length: made }, (_, j) => chip(nm(256 + j), { k: tokenColor(256 + j), sub: 256 + j, on: !counting && j === k })) : [h('span', { class: 'tz-note' }, 'nothing learned yet')]));
          note.innerHTML = p.md(s === 0
            ? `Every character of this text is one byte (UTF-8 for plain English), so we start with ${st.ids.length} tokens and a vocabulary of the 256 byte values.`
            : counting
              ? `Count every adjacent pair. The winner, **${nm(cur.best![0])} + ${nm(cur.best![1])}**, appears ${cur.cnt} times (ties go to the pair seen first).`
              : `Every occurrence becomes the new token **${256 + k}** = \`${nm(256 + k)}\`. The text shrinks by ${states[k]!.ids.length - st.ids.length} tokens and the vocabulary grows by one, to ${257 + k}.`);
          f.code.highlight(s === 0 ? 'init' : counting ? ['stats', 'best', 'count'] : ['merge', 'glue']);
          f.code.setMany({ kk: Math.max(0, k), pair: cur.best && s > 0 ? `(${cur.best[0]}, ${cur.best[1]})` : '…', cnt: s > 0 ? cur.cnt : '…', n: st.ids.length });
        },
      });
    },
    caption: `Step through ${M} merges on a 35-byte text. Each merge needs two passes over the data: count every adjacent pair, then rewrite the text with the winner glued together. Watch what the merges find: *at* first (it occurs five times), then *th*, then *the*. Notice too that merges happily cross spaces and commas: \`at,␣\` becomes a single token. Real tokenizers forbid that, as we will see.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: the merge slider on a page of text                              */
/* ------------------------------------------------------------------ */

const EXCERPT = CORPUS.slice(0, CORPUS.indexOf('passed.') + 7);

export function figSlider(p: Page): void {
  p.figure({
    title: 'Train BPE on a page: vocabulary grows, text shrinks',
    codeTitle: 'bpe_page.py',
    code: `
      text = open("keeper.txt").read()      # ${bytesOf(CORPUS).length.toLocaleString('en-US')} bytes
      if {{split:True}}:
          chunks = re.findall(GPT2_SPLIT, text)        #@split
      else:
          chunks = [text]                              #@split
      ids = [list(c.encode("utf-8")) for c in chunks]

      for k in range({{k:40}}):
          stats = {}
          for c in ids:
              get_stats(c, stats)    # add up counts   #@train
          pair = max(stats, key=stats.get)             #@train
          ids = [merge(c, pair, 256 + k) for c in ids] #@train

      V = 256 + {{k2:40}}                  # {{V}}
      n = sum(len(c) for c in ids)         # {{n}} tokens
      print(${bytesOf(CORPUS).length} / n)   # bytes per token: {{r}}
    `,
    setup(f) {
      const models = { split: bpeSplit(), raw: bpeRaw() };
      const heldBytes = bytesOf(HELDOUT).length;
      const held = {
        split: Array.from({ length: models.split.merges.length + 1 }, (_, k) => encode(HELDOUT, models.split, k).length),
        raw: Array.from({ length: models.raw.merges.length + 1 }, (_, k) => encode(HELDOUT, models.raw, k).length),
      };
      const KMAX = Math.max(models.split.merges.length, models.raw.merges.length);
      let split = true;
      let k = 40;
      const cur = () => (split ? models.split : models.raw);
      const pl = f.plot({
        aspect: 1.9,
        square: false,
        domain: [-KMAX * 0.12, KMAX * 1.04, -0.13, 1.06],
        draw: (pp) => {
          const b = cur();
          const hk = split ? held.split : held.raw;
          const c = pp.ctx;
          const x0 = pp.sx(0), x1 = pp.sx(KMAX), y0 = pp.sy(0), y1 = pp.sy(1);
          c.strokeStyle = color('--grid');
          c.lineWidth = 1;
          for (let v = 0.25; v <= 1.001; v += 0.25) {
            c.beginPath();
            c.moveTo(x0, pp.sy(v));
            c.lineTo(x1, pp.sy(v));
            c.stroke();
            pp.text(v.toFixed(2), -KMAX * 0.015, v, { align: 'right', base: 'middle', size: 11, mono: true, color: color('--ink-3') });
          }
          c.strokeStyle = color('--axis');
          c.beginPath();
          c.moveTo(x0, y1);
          c.lineTo(x0, y0);
          c.lineTo(x1, y0);
          c.stroke();
          for (let v = 0; v <= KMAX; v += 50) pp.text(String(v), v, -0.03, { align: 'center', base: 'top', size: 11, mono: true, color: color('--ink-3') });
          pp.text('merges learned', KMAX, 0.05, { align: 'right', size: 11, color: color('--ink-3') });
          const xs = b.lens.map((_, i) => i);
          pp.path(hk.map((_, i) => i), hk.map((n) => n / heldBytes), color('purple'), 2, [5, 4]);
          pp.path(xs, b.lens.map((n) => n / b.bytes), color('blue'), 2.2);
          const kk = Math.min(k, b.merges.length);
          pp.path([kk, kk], [0, 1.02], withAlpha(color('--accent'), 0.6), 1.5, [3, 3]);
          pp.dot(kk, b.lens[kk]! / b.bytes, 4.5, color('blue'));
          pp.dot(kk, hk[kk]! / heldBytes, 4.5, color('purple'));
          const lx = KMAX * 0.98;
          pp.text('tokens per byte: training text', lx, 0.94, { align: 'right', size: 12, color: color('blue'), bold: true });
          pp.text('new text, same style', lx, 0.84, { align: 'right', size: 12, color: color('purple'), bold: true });
        },
      });
      const excerpt = h('div');
      const recent = h('div');
      f.viz.append(box(excerpt), recent);
      const roV = f.readout('vocabulary V', { sym: 'V' });
      const roN = f.readout('tokens n');
      const roR = f.readout('bytes per token');
      const roH = f.readout('on new text');
      f.slider({
        label: 'merges k',
        min: 0,
        max: KMAX,
        step: 1,
        value: k,
        slot: 'k',
        onInput: (v) => {
          k = Math.round(v);
          update();
        },
      });
      f.toggle({
        label: 'split into words first (GPT-2)',
        value: true,
        onChange: (v) => {
          split = v;
          f.code.set('split', v ? 'True' : 'False');
          update();
        },
      });
      function update() {
        const b = cur();
        const kk = Math.min(k, b.merges.length);
        const n = b.lens[kk]!;
        const hk = (split ? held.split : held.raw)[kk]!;
        const ids = encode(EXCERPT, b, kk);
        excerpt.replaceChildren(head('the first sentence', `${ids.length} tokens for ${bytesOf(EXCERPT).length} bytes`), flow(tokChips(ids, b, (id) => kk > 0 && id === 255 + kk, false)));
        const last = Array.from({ length: Math.min(8, kk) }, (_, j) => kk - 1 - j);
        recent.replaceChildren(head('latest merges', kk < k ? `no pair occurs twice after ${b.merges.length}` : ''), flow(last.length ? last.map((j) => chip(clip(show(b.vocab[256 + j]!), 22), { k: tokenColor(256 + j), sub: `#${j}` })) : [h('span', { class: 'tz-note' }, 'none yet: every token is a byte')]));
        roV.set(256 + kk);
        roN.set(n);
        roR.set(fmt(b.bytes / n, 3));
        roH.set(fmt(heldBytes / hk, 3));
        f.code.setMany({ k2: kk, V: 256 + kk, n, r: fmt(b.bytes / n, 3) });
        f.code.highlight(kk > 0 ? 'train' : 'split');
        pl.redraw();
      }
      f.code.set('split', 'True');
      update();
    },
    caption: `BPE trained on the 1,575-byte lighthouse story that the next figures also use. Drag **merges k**: the blue curve is the training text's length in tokens per byte, the dashed purple curve is a paragraph of *new* text in the same style. Early merges are the commonest pairs (*he*, *␣t*, *␣the*); soon whole words appear with their leading space. Then switch off **split into words first**: merges may now cross word boundaries, the training text compresses *better*, and the new text compresses *worse*. Those extra merges memorize phrases instead of learning words.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: encode and decode                                               */
/* ------------------------------------------------------------------ */

export function figEncode(p: Page): void {
  p.figure({
    title: 'Encoding replays the merges in order; decoding joins bytes',
    codeTitle: 'bpe_encode.py',
    code: `
      def encode_chunk(ids):
          while len(ids) >= 2:
              stats = get_stats(ids)
              rank = lambda p: merges.get(p, inf)
              pair = min(stats, key=rank)      # oldest rule  #@pick
              if pair not in merges:
                  break                        # none left    #@done
              ids = merge(ids, pair, merges[pair])            #@apply
          return ids

      def encode(text):
          ids = []
          for chunk in re.findall(GPT2_SPLIT, text):         #@split
              ids += encode_chunk(list(chunk.encode()))      #@split
          return ids

      def decode(ids):
          data = b"".join(vocab[i] for i in ids)             #@join
          return data.decode("utf-8", errors="replace")      #@join

      # {{what:…}}
      # tokens: {{n:…}}   decode(encode(text)) == text: {{ok:…}}
    `,
    setup(f) {
      const bpe = bpeSplit();
      const PRE = [
        { label: 'keeper', text: 'the keeper wrote it down' },
        { label: 'plural', text: ' lighthouses' },
        { label: 'no space', text: 'lighthouses' },
        { label: 'emoji', text: 'lamp lit 💡' },
      ];
      let text = PRE[0]!.text;
      let trace = encodeTrace(text, bpe);
      const view = h('div');
      const out = h('div', { class: 'tz-note' });
      f.viz.append(box(view), out);
      const step = (s: number) => {
        const st = trace[s]!;
        const ids = st.chunks.flat();
        const last = s === trace.length - 1;
        const [a, b] = st.rank >= 0 ? bpe.merges[st.rank]! : [0, 0];
        view.replaceChildren(
          head(st.rank < 0 ? 'raw bytes, chunk by chunk' : `merge #${st.rank}: ${show(bpe.vocab[a]!)} + ${show(bpe.vocab[b]!)} → ${show(bpe.vocab[256 + st.rank]!)}`, `${ids.length} tokens`),
          flow(st.chunks.flatMap((c, ci) => [
            ...c.map((id) => chip(show(bpe.vocab[id]!), { k: tokenColor(id), sub: id, on: st.rank >= 0 && id === 256 + st.rank })),
            ...(ci < st.chunks.length - 1 ? [h('span', { style: 'width:6px' })] : []),
          ])),
        );
        const dec = decode(ids, bpe);
        out.innerHTML = p.md(last
          ? `**ids** \`[${ids.join(', ')}]\`<br>**decoded** \`${visible(dec)}\` ${dec === text ? '✓ the same text' : '✗'}`
          : `${st.rank < 0 ? 'The text is split into chunks, then each chunk into bytes.' : `Merge #${st.rank} is the earliest-learned merge that still applies; it fires ${st.hits === 1 ? 'once' : `${st.hits} times`}.`} Step on to apply the next one.`);
        f.code.highlight(st.rank < 0 ? 'split' : last ? ['done', 'join'] : ['pick', 'apply']);
        f.code.setMany({
          what: st.rank < 0 ? 'start: the raw bytes' : `merge #${st.rank}: ${pyBytes(bpe.vocab[a]!)} + ${pyBytes(bpe.vocab[b]!)}`,
          n: ids.length,
          ok: last ? (dec === text ? 'True' : 'False') : '…',
        });
      };
      const stepper = f.stepper({ steps: trace.length, interval: 900, label: (s) => `step ${s + 1} / ${trace.length}`, onStep: step });
      const load = (t: string) => {
        text = t;
        trace = encodeTrace(text || ' ', bpe);
        stepper.setSteps(trace.length);
        stepper.go(trace.length - 1);
        pre.mark(t);
      };
      const pre = presets(PRE, (t) => {
        inp.input.value = t;
        load(t);
      });
      const inp = textInput(text, 'text', load);
      f.controls.append(pre.el, inp.el);
      queueMicrotask(() => load(text));
    },
    caption: `Type anything, or pick a preset, and step through the encoding. Each step applies the lowest-numbered merge that occurs anywhere, so the merges replay in the order training learned them. Compare **plural** with **no space**: the story always had a space before *lighthouse*, so \`␣lighthouse\` is one token but \`lighthouse\` without the space has to be built from small pieces. With **emoji**, the four bytes of 💡 never merged, so they stay raw byte tokens (shown in hex) and still decode back exactly.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: characters, code points, bytes                                 */
/* ------------------------------------------------------------------ */

const LEN_COLORS = ['', 'blue', 'green', 'orange', 'purple'];

export function figBytes(p: Page): void {
  p.figure({
    title: 'Characters are not bytes',
    codeTitle: 'utf8.py',
    code: `
      text = {{text:"..."}}
      for ch in text:
          b = list(ch.encode("utf-8"))
          print(ch, f"U+{ord(ch):04X}", b)   #@each

      len(text)                   # characters: {{nc}}   #@count
      len(text.encode("utf-8"))   # bytes:      {{nb}}   #@count
      len(encode(text))           # our tokens: {{nt}}   #@count
    `,
    setup(f) {
      const bpe = bpeSplit();
      const PRE = [
        { label: 'English', text: 'the night light' },
        { label: 'French', text: 'café crème' },
        { label: 'Greek', text: 'καλημέρα' },
        { label: 'Russian', text: 'привет' },
        { label: 'Chinese', text: '你好，世界' },
        { label: 'emoji', text: '🌊🚢💡' },
      ];
      let text = PRE[0]!.text;
      const cols = h('div', { class: 'tz-cols' });
      const toks = h('div');
      const legend = h('div', { class: 'tz-note' });
      f.viz.append(box(head('each character and its UTF-8 bytes'), cols), box(toks), legend);
      legend.innerHTML = [1, 2, 3, 4].map((n) => `<span style="color:var(--c-${LEN_COLORS[n]});font-weight:600">${n} byte${n > 1 ? 's' : ''}</span>`).join(' · ');
      const render = () => {
        const chars = Array.from(text);
        cols.replaceChildren(...chars.map((ch) => {
          const cp = ch.codePointAt(0)!;
          const bs = bytesOf(ch);
          return h('div', { class: 'tz-col' },
            h('span', { class: 'tz-glyph' }, ch === ' ' ? '␣' : ch),
            h('span', { class: 'tz-cp' }, `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`),
            h('span', { class: 'tz-bytes' }, ...bs.map((b) => {
              const e = h('span', { class: 'tz-byte' }, b.toString(16).toUpperCase().padStart(2, '0'));
              e.style.setProperty('--k', `var(--c-${LEN_COLORS[utf8Len(cp)]})`);
              return e;
            })));
        }));
        const ids = encode(text, bpe);
        const nb = bytesOf(text).length;
        toks.replaceChildren(head('tokens from our English-trained BPE', `${ids.length} tokens · ${fmt(ids.length / Math.max(1, chars.length), 2)} per character`), flow(tokChips(ids, bpe, undefined, false)));
        f.code.setMany({ text: pyStr(clip(text, 30)), nc: chars.length, nb, nt: ids.length });
        f.code.highlight(['each', 'count']);
        pre.mark(text);
      };
      const pre = presets(PRE, (t) => {
        text = t;
        inp.input.value = t;
        render();
      });
      const inp = textInput(text, 'text', (v) => {
        text = v;
        render();
      });
      f.controls.append(pre.el, inp.el);
      render();
    },
    caption: `Each character is shown with its Unicode code point and the bytes UTF-8 writes for it, in hex. English letters take one byte each, so for English, bytes and characters coincide. Accented Latin letters, Greek and Cyrillic take two; Chinese takes three; most emoji take four. Below, the same text through our BPE, which was trained only on English: English words compress, but Greek and Russian stay one token per *byte*, two per letter, because no merge ever covered them.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: three ways to cut a number                                      */
/* ------------------------------------------------------------------ */

const PLACE = ['blue', 'orange', 'green', 'purple', 'teal', 'red', 'gold'];

export function figNumbers(p: Page): void {
  p.figure({
    title: 'Three ways to cut a number',
    codeTitle: 'numbers.py',
    code: `
      text = {{text:"..."}}

      learned = encode(text)                     #@learned
      threes = re.findall(r"\\d{1,3}|\\D+", text)  #@threes
      digits = re.findall(r"\\d|\\D+", text)       #@digits
      # tokens: {{nl}} learned, {{n3}} threes, {{n1}} digits
    `,
    setup(f) {
      const bpe = bpeSplit();
      const PRE = [
        { label: 'a sum', text: '48213 + 7759 = 55972' },
        { label: 'years', text: '1901 1911 1921 2024' },
        { label: 'pi', text: '3.14159' },
      ];
      let text = PRE[0]!.text;
      const rows = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
      const legend = h('div', { class: 'tz-note' });
      f.viz.append(box(rows), legend);
      legend.innerHTML = `digit colors mark place value: ${['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands'].map((n, i) => `<span style="color:var(--c-${PLACE[i]});font-weight:600">${n}</span>`).join(' · ')}`;
      /** Place value of every byte that is a digit, counted from the end of its digit run; -1 otherwise. */
      const places = (bs: number[]): number[] => {
        const out = bs.map(() => -1);
        let run = 0;
        for (let i = bs.length - 1; i >= 0; i--) {
          const dig = bs[i]! >= 48 && bs[i]! <= 57;
          run = dig ? run + 1 : 0;
          out[i] = dig ? run - 1 : -1;
        }
        return out;
      };
      const pieceChip = (bs: number[], pl: number[], from: number): HTMLElement => {
        const el = chip('x');
        el.textContent = '';
        const txt = show(Uint8Array.from(bs));
        if (bs.every((b) => b < 128)) {
          const line = h('span');
          bs.forEach((b, i) => {
            const q = pl[from + i]!;
            const s = h('span', {}, visible(String.fromCharCode(b)));
            if (q >= 0) s.style.color = `var(--c-${PLACE[q % PLACE.length]})`;
            if (q >= 0) s.style.fontWeight = '700';
            line.append(s);
          });
          el.append(line);
        } else el.append(txt);
        return el;
      };
      const row = (name: string, pieces: number[][], pl: number[]) => {
        let o = 0;
        const chips = pieces.map((bs) => {
          const c = pieceChip(bs, pl, o);
          o += bs.length;
          return c;
        });
        return h('div', {}, head(name, `${pieces.length} tokens`), flow(chips));
      };
      const render = () => {
        const bs = bytesOf(text);
        const pl = places(bs);
        const learned = encode(text, bpe).map((id) => Array.from(bpe.vocab[id]!));
        const threes = (text.match(/\d{1,3}|\D+/g) ?? []).map(bytesOf);
        const digits = (text.match(/\d|\D+/g) ?? []).map(bytesOf);
        rows.replaceChildren(
          row('learned merges (our BPE, like GPT-2)', learned, pl),
          row('groups of up to three digits (like GPT-4)', threes, pl),
          row('single digits (like LLaMA 2)', digits, pl),
        );
        f.code.setMany({ text: pyStr(clip(text, 30)), nl: learned.length, n3: threes.length, n1: digits.length });
        pre.mark(text);
      };
      const pre = presets(PRE, (t) => {
        text = t;
        inp.input.value = t;
        render();
      });
      const inp = textInput(text, 'text', (v) => {
        text = v;
        render();
      });
      f.controls.append(pre.el, inp.el);
      render();
    },
    caption: `The same digits under three policies. Colors mark each digit's place value, so you can see whether a token holds the same places from one number to the next. Groups of three, counted from the left, put \`482\` and \`13\` together in 48213 but \`775\` and \`9\` in 7759: the "hundreds" token of one number lines up with nothing in the other, which makes column-by-column arithmetic awkward. Single digits make every place its own token, at the price of longer sequences. Our story's BPE barely merged digits, since the story has few numbers; a web-scale GPT-2 vocabulary merged common ones such as years into single tokens and split the rest wherever its merges happened to fall.`,
  });
}

