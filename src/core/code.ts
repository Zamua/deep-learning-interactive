import { escapeHtml, h } from './dom';

const KEYWORDS = new Set(
  'and as assert break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield'.split(' '),
);
const BUILTINS = new Set('print range len int float str list dict tuple zip enumerate min max sum abs self super isinstance sorted reversed map'.split(' '));

/** Sentinel bracketing a live slot index inside source text, outside any real character range. */
const LIVE_OPEN = '';
const LIVE_CLOSE = '';

export function dedent(src: string): string {
  const lines = src.replace(/\t/g, '    ').split('\n');
  while (lines.length && !lines[0]!.trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1]!.trim()) lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(indent)).join('\n');
}

interface Parsed {
  lines: string[];
  labels: Map<string, number[]>;
  slots: { name: string; init: string }[];
}

/** Strips `#@label` line tags and turns `{{name}}` / `{{name:init}}` into live-slot sentinels. */
function parse(src: string): Parsed {
  const labels = new Map<string, number[]>();
  const slots: Parsed['slots'] = [];
  const lines = dedent(src)
    .split('\n')
    .map((line, i) => {
      const m = line.match(/\s*#@([\w-]+(?:,[\w-]+)*)\s*$/);
      if (m) {
        for (const lab of m[1]!.split(',')) labels.set(lab, [...(labels.get(lab) ?? []), i + 1]);
        line = line.slice(0, m.index);
      }
      return line.replace(/\{\{(\w+)(?::([^}]*))?\}\}/g, (_, name: string, init?: string) => {
        slots.push({ name, init: init ?? '…' });
        return `${LIVE_OPEN}${slots.length - 1}${LIVE_CLOSE}`;
      });
    });
  return { lines, labels, slots };
}

type TokState = { inTriple: string | null };

/** Highlights one line of Python. Identifiers in `symIdx` get the matching `sym-*` class. */
function highlightLine(line: string, st: TokState, symIdx: Map<string, string>, slots: Parsed['slots']): string {
  let out = '';
  let i = 0;
  const span = (cls: string, s: string) => `<span class="${cls}">${escapeHtml(s)}</span>`;
  const slot = (s: string) =>
    s.replace(new RegExp(`${LIVE_OPEN}(\\d+)${LIVE_CLOSE}`, 'g'), (_, n: string) => {
      const sl = slots[Number(n)]!;
      return `<span class="live" data-live="${sl.name}">${escapeHtml(sl.init)}</span>`;
    });
  if (st.inTriple) {
    const end = line.indexOf(st.inTriple);
    if (end < 0) return span('tk-str', line);
    out += span('tk-str', line.slice(0, end + 3));
    i = end + 3;
    st.inTriple = null;
  }
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpMatchArray | null;
    if (rest[0] === LIVE_OPEN) {
      const end = rest.indexOf(LIVE_CLOSE);
      out += slot(rest.slice(0, end + 1));
      i += end + 1;
    } else if (rest[0] === '#') {
      out += slot(span('tk-com', rest));
      break;
    } else if ((m = rest.match(/^[rbfu]?("""|''')/i))) {
      const q = m[1]!;
      const end = rest.indexOf(q, m[0].length);
      if (end < 0) {
        out += span('tk-str', rest);
        st.inTriple = q;
        break;
      }
      out += span('tk-str', rest.slice(0, end + 3));
      i += end + 3;
    } else if ((m = rest.match(/^[rbfu]?(['"])(?:\\.|(?!\1).)*\1?/i))) {
      out += slot(span('tk-str', m[0]));
      i += m[0].length;
    } else if ((m = rest.match(/^(?:\d+\.?\d*(?:e[-+]?\d+)?|\.\d+(?:e[-+]?\d+)?)j?/i))) {
      out += span('tk-num', m[0]);
      i += m[0].length;
    } else if ((m = rest.match(/^[A-Za-z_]\w*/))) {
      const w = m[0];
      const prev = line.slice(0, i).trimEnd();
      const sym = symIdx.get(w);
      if (sym && !prev.endsWith('.')) out += `<span class="sym sym-${sym}">${w}</span>`;
      else if (KEYWORDS.has(w)) out += span('tk-kw', w);
      else if (prev.endsWith('def') || prev.endsWith('class')) out += span('tk-def', w);
      else if (BUILTINS.has(w)) out += span('tk-bi', w);
      else if (line.slice(i + w.length).startsWith('(')) out += span('tk-fn', w);
      else out += escapeHtml(w);
      i += w.length;
    } else if ((m = rest.match(/^[-+*/%=<>!&|^~@:]+/))) {
      out += span('tk-op', m[0]);
      i += m[0].length;
    } else {
      out += escapeHtml(rest[0]!);
      i += 1;
    }
  }
  return out;
}

export interface CodeOptions {
  /** Shown in the panel's tab, e.g. "linear_classifier.py". */
  title?: string;
  symIdx?: Map<string, string>;
  /** Hide line numbers (for one- or two-line snippets). */
  bare?: boolean;
}

/**
 * A read-only Python listing that a figure can drive: `highlight()` lights lines by `#@label`
 * or number, `set()` rewrites a `{{slot}}` so the listing always shows the values the figure uses.
 */
export class CodePanel {
  readonly el: HTMLElement;
  private body: HTMLElement;
  private rows: HTMLElement[] = [];
  private labels: Map<string, number[]>;
  private liveEls = new Map<string, HTMLElement[]>();

  constructor(src: string, opts: CodeOptions = {}) {
    const p = parse(src);
    this.labels = p.labels;
    const st: TokState = { inTriple: null };
    this.body = h('div', { class: 'code-body' });
    p.lines.forEach((line, i) => {
      const row = h('div', { class: 'ln' });
      if (!opts.bare) row.append(h('span', { class: 'ln-no' }, String(i + 1)));
      row.append(h('span', { class: 'ln-src', html: highlightLine(line, st, opts.symIdx ?? new Map(), p.slots) || ' ' }));
      this.rows.push(row);
      this.body.append(row);
    });
    this.el = h('div', { class: `code${opts.bare ? ' code-bare' : ''}` });
    if (opts.title) this.el.append(h('div', { class: 'code-tab' }, h('span', { class: 'code-tab-name' }, opts.title), h('span', { class: 'code-tab-lang' }, 'python')));
    this.el.append(this.body);
    this.body.querySelectorAll<HTMLElement>('.live').forEach((e) => {
      const n = e.dataset.live!;
      this.liveEls.set(n, [...(this.liveEls.get(n) ?? []), e]);
    });
  }

  private resolve(sel: string | number | (string | number)[] | null): number[] {
    if (sel === null) return [];
    const arr = Array.isArray(sel) ? sel : [sel];
    return arr.flatMap((s) => (typeof s === 'number' ? [s] : (this.labels.get(s) ?? [])));
  }

  /** Light the given lines (labels or 1-based numbers); `null` clears. Keeps the first one in view. */
  highlight(sel: string | number | (string | number)[] | null, kind: 'on' | 'alt' = 'on'): void {
    const want = new Set(this.resolve(sel));
    this.rows.forEach((r, i) => r.classList.toggle(kind, want.has(i + 1)));
    const first = Math.min(...want);
    if (Number.isFinite(first)) {
      const row = this.rows[first - 1]!;
      const b = this.body;
      const top = row.offsetTop - b.offsetTop;
      if (top < b.scrollTop || top + row.offsetHeight > b.scrollTop + b.clientHeight) {
        b.scrollTo({ top: Math.max(0, top - b.clientHeight / 3), behavior: 'smooth' });
      }
    }
  }

  /** Rewrite the text of a `{{name}}` slot. Flashes when the text changes, unless `flash` is false. */
  set(name: string, value: string | number, flash = true): void {
    const text = typeof value === 'number' ? fmt(value) : value;
    for (const e of this.liveEls.get(name) ?? []) {
      if (e.textContent === text) continue;
      e.textContent = text;
      if (!flash) continue;
      e.classList.remove('flash');
      void e.offsetWidth;
      e.classList.add('flash');
    }
  }

  setMany(values: Record<string, string | number>): void {
    for (const [k, v] of Object.entries(values)) this.set(k, v);
  }
}

/** Compact number formatting for live code slots. */
export function fmt(v: number, digits = 3): string {
  if (Number.isInteger(v)) return String(v);
  if (v !== 0 && (Math.abs(v) < 1e-3 || Math.abs(v) >= 1e5)) return v.toExponential(1).replace('e+', 'e');
  return String(Number(v.toPrecision(digits)));
}
