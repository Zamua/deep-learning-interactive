import { CodePanel, fmt } from './code';
import * as C from './controls';
import { h, visibleLoop } from './dom';
import { md, setMacros, tex } from './math';
import { Plot, type PlotOptions, hidpiCanvas } from './plot';
import { codeIndex, linkSymbols, symbolMacros, type SymListener, type SymbolMap } from './symbols';

export interface MathOptions {
  /** Short name shown above the equation, e.g. "Softmax loss". */
  label?: string;
  /** The display equation (TeX). Use `\sym{key}{tex}` or `\sym<key>` to color-link symbols. */
  tex: string;
  /** The same computation in Python/NumPy, so every equation has code beside it. */
  code: string;
  codeTitle?: string;
  /** Piece-by-piece reading: [TeX fragment, plain-English meaning (markdown)]. */
  terms?: [string, string][];
  /** "In plain words" paragraph(s), markdown. */
  explain?: string;
}

export interface FigureOptions {
  title: string;
  /** Markdown under the figure: what it shows and what to try. */
  caption?: string;
  /** Python the figure is a picture of. Lines tagged `#@label` can be lit; `{{slot}}` values are live. */
  code: string;
  codeTitle?: string;
  /** 'side' (default): viz and code side by side. 'stack': code under a full-width viz. */
  layout?: 'side' | 'stack';
  setup: (f: Fig) => void;
}

/** What a figure's `setup` gets: its panes, its code listing and control builders bound to it. */
export interface Fig {
  el: HTMLElement;
  viz: HTMLElement;
  controls: HTMLElement;
  code: CodePanel;
  page: Page;
  plot(opts?: PlotOptions): Plot;
  canvas(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): { canvas: HTMLCanvasElement; redraw(): void };
  /** Adds a slider; `slot` mirrors its value into that `{{slot}}` of the code listing. */
  slider(o: Parameters<typeof C.slider>[0] & { slot?: string }): C.Slider;
  button(label: string, onClick: () => void, opts?: { icon?: string; primary?: boolean }): HTMLButtonElement;
  segmented<T extends string>(o: Parameters<typeof C.segmented<T>>[0] & { slot?: string }): ReturnType<typeof C.segmented<T>>;
  toggle(o: Parameters<typeof C.toggle>[0]): ReturnType<typeof C.toggle>;
  readout(label: string, opts?: { sym?: string }): ReturnType<typeof C.readout>;
  stepper(o: Parameters<typeof C.stepper>[0]): ReturnType<typeof C.stepper>;
  /** rAF loop that pauses while the figure is off screen. Return false from `frame` to stop. */
  loop(frame: (dt: number, t: number) => void | boolean): { start(): void; stop(): void; running(): boolean };
  /** A status line under the viz (markdown). */
  status(text: string): void;
  onSym(fn: SymListener): void;
}

export class Page {
  readonly root: HTMLElement;
  readonly syms: SymbolMap;
  readonly symIdx: Map<string, string>;
  readonly toc: { id: string; title: string }[] = [];
  private figN = 0;
  private eqN = 0;
  private link: { on(fn: SymListener): void };

  constructor(root: HTMLElement, readonly id: string, readonly num: string, syms: SymbolMap) {
    this.root = root;
    this.syms = syms;
    this.symIdx = codeIndex(syms);
    setMacros(symbolMacros(syms));
    this.link = linkSymbols(root, syms);
  }

  md(src: string): string {
    return md(src, this.symIdx);
  }

  /** Inline TeX -> HTML string, for building labels by hand. */
  tex(src: string, display = false): string {
    return tex(src, display);
  }

  append(...nodes: Node[]): void {
    this.root.append(...nodes);
  }

  prose(src: string): void {
    this.root.append(h('div', { class: 'prose', html: this.md(src) }));
  }

  h2(title: string, id?: string): void {
    const slug = id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    this.toc.push({ id: slug, title });
    this.root.append(h('h2', { id: slug, class: 'sec' }, h('a', { href: `#/${this.id}/${slug}`, class: 'sec-anchor', 'aria-hidden': 'true' }, '§'), title));
  }

  /** A boxed aside. `idea` = key takeaway, `math` = math help for non-experts. */
  callout(kind: 'idea' | 'intuition' | 'warning' | 'aside' | 'math' | 'history', src: string, title?: string): void {
    const icons = { idea: 'lightbulb', intuition: 'eye', warning: 'warning', aside: 'info', math: 'math', history: 'book' } as const;
    const names = { idea: 'Key idea', intuition: 'Intuition', warning: 'Watch out', aside: 'Aside', math: 'Math help', history: 'Context' } as const;
    this.root.append(
      h('aside', { class: `callout callout-${kind}` },
        h('div', { class: 'callout-head', html: `${C.icon(icons[kind])}<span>${title ?? names[kind]}</span>` }),
        h('div', { class: 'callout-body prose', html: this.md(src) })),
    );
  }

  /** A standalone listing (no figure). */
  code(src: string, opts: { title?: string; bare?: boolean } = {}): CodePanel {
    const panel = new CodePanel(src, { ...opts, symIdx: this.symIdx });
    this.root.append(h('div', { class: 'listing' }, panel.el));
    return panel;
  }

  /** A table whose header and cells are markdown. */
  table(head: string[], rows: string[][], opts: { caption?: string } = {}): void {
    const cell = (s: string, tag: 'td' | 'th') => h(tag, { html: this.md(s).replace(/^<p>|<\/p>$/g, '') });
    const t = h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, ...head.map((c) => cell(c, 'th')))),
      h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((c) => cell(c, 'td'))))));
    const wrap = h('div', { class: 'tbl-wrap' }, t);
    if (opts.caption) wrap.append(h('div', { class: 'tbl-cap', html: this.md(opts.caption) }));
    this.root.append(wrap);
  }

  /** An equation with its NumPy twin side by side, a piece-by-piece reading and a plain-words gloss. */
  math(o: MathOptions): void {
    this.eqN++;
    const panel = new CodePanel(o.code, { title: o.codeTitle, symIdx: this.symIdx });
    const left = h('div', { class: 'eq-math' });
    left.append(h('div', { class: 'eq-head' }, h('span', { class: 'eq-num' }, `Eq ${this.num}.${this.eqN}`), o.label ? h('span', { class: 'eq-label' }, o.label) : ''));
    left.append(h('div', { class: 'eq-display', html: tex(o.tex, true) }));
    if (o.terms?.length) {
      const dl = h('dl', { class: 'eq-terms' });
      for (const [t, m] of o.terms) dl.append(h('dt', { html: tex(t) }), h('dd', { html: this.md(m).replace(/^<p>|<\/p>$/g, '') }));
      left.append(h('div', { class: 'eq-terms-head' }, 'Piece by piece'), dl);
    }
    const right = h('div', { class: 'eq-code' }, h('div', { class: 'eq-code-head' }, 'Same thing in code'), panel.el);
    const box = h('section', { class: 'eq' }, h('div', { class: 'eq-grid' }, left, right));
    if (o.explain) box.append(h('div', { class: 'eq-explain prose', html: `<div class="eq-explain-head">In plain words</div>${this.md(o.explain)}` }));
    this.root.append(box);
  }

  figure(o: FigureOptions): Fig {
    this.figN++;
    const code = new CodePanel(o.code, { title: o.codeTitle, symIdx: this.symIdx });
    const viz = h('div', { class: 'fig-viz' });
    const controls = h('div', { class: 'fig-controls' });
    const statusEl = h('div', { class: 'fig-status' });
    const el = h('figure', { class: `fig fig-${o.layout ?? 'side'}` },
      h('header', { class: 'fig-head' }, h('span', { class: 'fig-num' }, `Fig ${this.num}.${this.figN}`), h('span', { class: 'fig-title' }, o.title)),
      h('div', { class: 'fig-body' },
        h('div', { class: 'fig-left' }, viz, controls, statusEl),
        h('div', { class: 'fig-code' }, code.el)));
    if (o.caption) el.append(h('figcaption', { class: 'fig-cap prose', html: this.md(o.caption) }));
    this.root.append(el);
    const page = this;
    const add = <T extends { el: HTMLElement } | HTMLElement>(c: T): T => {
      controls.append(c instanceof HTMLElement ? c : c.el);
      return c;
    };
    const fig: Fig = {
      el,
      viz,
      controls,
      code,
      page,
      plot: (opts) => new Plot(viz, opts),
      canvas: (w, hh, draw) => hidpiCanvas(viz, w, hh, draw),
      slider(so) {
        const user = so.onInput;
        const fmtv = so.format ?? ((v: number) => fmt(v));
        const s = C.slider({
          ...so,
          onInput: (v) => {
            if (so.slot) code.set(so.slot, fmtv(v));
            user(v);
          },
        });
        if (so.slot) code.set(so.slot, fmtv(s.value));
        return add(s);
      },
      button: (label, onClick, opts) => add(C.button(label, onClick, opts)),
      segmented(so) {
        const user = so.onChange;
        const s = C.segmented({
          ...so,
          onChange: (v) => {
            if (so.slot) code.set(so.slot, v);
            user(v);
          },
        });
        if (so.slot) code.set(so.slot, so.value);
        return add(s);
      },
      toggle: (to) => add(C.toggle(to)),
      readout: (label, opts) => add(C.readout(label, opts)),
      stepper: (so) => add(C.stepper(so)),
      loop: (frame) => visibleLoop(el, frame),
      status(text) {
        statusEl.innerHTML = page.md(text);
      },
      onSym: (fn) => page.onSym(fn),
    };
    try {
      o.setup(fig);
    } catch (e) {
      console.error(`figure "${o.title}" failed`, e);
      viz.append(h('div', { class: 'fig-error' }, `This figure failed to start: ${(e as Error).message}`));
    }
    return fig;
  }

  onSym(fn: SymListener): void {
    this.link.on(fn);
  }
}
