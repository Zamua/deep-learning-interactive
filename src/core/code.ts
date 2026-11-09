import { h } from './dom';
import { highlightLine, LIVE_CLOSE, LIVE_OPEN, type Lang, type Slot, type TokState } from './highlight';

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
  slots: Slot[];
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

export interface CodeOptions {
  /** Shown in the panel's tab, e.g. "linear_classifier.py". */
  title?: string;
  symIdx?: Map<string, string>;
  /** Hide line numbers (for one- or two-line snippets). */
  bare?: boolean;
  /** The listing's language; Python unless a course says otherwise. */
  lang?: Lang;
}

/**
 * A read-only listing that a figure can drive: `highlight()` lights lines by `#@label`
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
    const lang = opts.lang ?? 'python';
    this.body = h('div', { class: 'code-body' });
    p.lines.forEach((line, i) => {
      const row = h('div', { class: 'ln' });
      if (!opts.bare) row.append(h('span', { class: 'ln-no' }, String(i + 1)));
      row.append(h('span', { class: 'ln-src', html: highlightLine[lang](line, st, opts.symIdx ?? new Map(), p.slots) || ' ' }));
      this.rows.push(row);
      this.body.append(row);
    });
    this.el = h('div', { class: `code${opts.bare ? ' code-bare' : ''}` });
    if (opts.title) this.el.append(h('div', { class: 'code-tab' }, h('span', { class: 'code-tab-name' }, opts.title), h('span', { class: 'code-tab-lang' }, lang)));
    this.el.append(this.body);
    this.body.querySelectorAll<HTMLElement>('.live').forEach((e) => {
      const n = e.dataset.live!;
      this.liveEls.set(n, [...(this.liveEls.get(n) ?? []), e]);
    });
  }

  /** The rendered source of each line, in order. */
  get lines(): HTMLElement[] {
    return this.rows.map((r) => r.querySelector<HTMLElement>('.ln-src')!);
  }

  /** 1-based line numbers for labels or numbers. */
  resolve(sel: string | number | (string | number)[] | null): number[] {
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
function fmt(v: number, digits = 3): string {
  if (Number.isInteger(v)) return String(v);
  if (v !== 0 && (Math.abs(v) < 1e-3 || Math.abs(v) >= 1e5)) return v.toExponential(1).replace('e+', 'e');
  return String(Number(v.toPrecision(digits)));
}
