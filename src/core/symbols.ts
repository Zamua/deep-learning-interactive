import { onDispose } from './dom';

export const PALETTE = ['blue', 'orange', 'green', 'purple', 'red', 'teal', 'gold', 'slate'] as const;
export type Color = (typeof PALETTE)[number];

export interface SymbolDef {
  color: Color;
  /** Plain-English name shown when the symbol is hovered or tapped, e.g. "weights". */
  name: string;
  /** A sentence or two more, for the lecture's lookup card. */
  about?: string;
  /** TeX used by the `\sym<key>` shorthand. Defaults to the key. */
  tex?: string;
  /** Code identifiers that are this symbol. Defaults to [key]. */
  code?: string[];
}

export type SymbolMap = Record<string, SymbolDef>;

/** A symbol's name without its "W: " lead. */
export const plainName = (name: string): string => name.replace(/^[^:]{1,14}:\s*/, '');

const KEY = /^[A-Za-z][A-Za-z0-9]*$/;

/** KaTeX macros for a symbol map: `\sym{key}{tex}` plus a `\sym<key>` shorthand per symbol. */
export function symbolMacros(syms: SymbolMap): Record<string, string> {
  const m: Record<string, string> = { '\\sym': '\\htmlClass{sym sym-#1}{#2}' };
  for (const [k, d] of Object.entries(syms)) {
    m[`\\sym${k}`] = `\\htmlClass{sym sym-${k}}{${d.tex ?? k}}`;
  }
  return m;
}

/** identifier -> symbol key, for the code highlighter. */
export function codeIndex(syms: SymbolMap): Map<string, string> {
  const idx = new Map<string, string>();
  for (const [k, d] of Object.entries(syms)) for (const id of d.code ?? [k]) idx.set(id, k);
  return idx;
}

export function symbolCss(scope: string, syms: SymbolMap): string {
  return Object.entries(syms)
    .map(([k, d]) => `${scope} .sym-${k}{--sym:var(--c-${d.color});color:var(--sym)}`)
    .join('\n');
}

export type SymListener = (key: string | null) => void;

/**
 * Wires symbol linking inside `root`: hovering (or tapping) any `.sym-K` element lights up
 * every other `.sym-K` in the page and shows the symbol's name. `scoped` may name a different
 * definition for the element hovered, where one part of the page gives a key its own meaning.
 */
export function linkSymbols(root: HTMLElement, syms: SymbolMap, scoped?: (key: string, el: Element) => SymbolDef | undefined): { on(fn: SymListener): void } {
  for (const k of Object.keys(syms)) if (!KEY.test(k)) throw new Error(`bad symbol key ${k}`);
  const style = document.createElement('style');
  style.textContent = symbolCss(`[data-page="${root.dataset.page}"]`, syms);
  root.prepend(style);

  const tip = document.createElement('div');
  tip.className = 'sym-tip';
  document.body.append(tip);
  const listeners: SymListener[] = [];
  let lit: string | null = null;
  let pinned = false;

  const keyOf = (el: Element | null): [string, Element] | null => {
    const s = el?.closest('.sym');
    if (!s || !root.contains(s)) return null;
    for (const c of s.classList) if (c.startsWith('sym-') && c !== 'sym-lit') return [c.slice(4), s];
    return null;
  };
  const light = (key: string | null, anchor?: Element) => {
    if (key === lit) return;
    if (lit) root.querySelectorAll(`.sym-${lit}`).forEach((e) => e.classList.remove('sym-lit'));
    lit = key && syms[key] ? key : null;
    if (lit) {
      root.querySelectorAll(`.sym-${lit}`).forEach((e) => e.classList.add('sym-lit'));
      const d = scoped?.(lit, anchor!) ?? syms[lit]!;
      tip.innerHTML = `<span class="sym-tip-dot" style="background:var(--c-${d.color})"></span>${d.name}`;
      const r = anchor!.getBoundingClientRect();
      tip.style.left = `${Math.max(8, Math.min(window.innerWidth - 220, r.left))}px`;
      tip.style.top = `${r.top - 34 < 8 ? r.bottom + 6 : r.top - 34}px`;
      tip.classList.add('on');
    } else {
      tip.classList.remove('on');
    }
    for (const f of listeners) f(lit);
  };

  const over = (e: PointerEvent) => {
    if (pinned || e.pointerType === 'touch') return;
    const k = keyOf(e.target as Element);
    light(k ? k[0] : null, k?.[1]);
  };
  const click = (e: MouseEvent) => {
    const k = keyOf(e.target as Element);
    if (k) {
      pinned = !(pinned && lit === k[0]);
      light(pinned ? k[0] : null, k[1]);
    } else if (pinned) {
      pinned = false;
      light(null);
    }
  };
  const scroll = () => {
    if (lit) {
      pinned = false;
      light(null);
    }
  };
  root.addEventListener('pointerover', over);
  root.addEventListener('click', click);
  window.addEventListener('scroll', scroll, { passive: true });
  onDispose(() => {
    root.removeEventListener('pointerover', over);
    root.removeEventListener('click', click);
    window.removeEventListener('scroll', scroll);
    tip.remove();
  });
  return { on: (fn) => listeners.push(fn) };
}
