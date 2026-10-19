import { h } from '../core/dom';
import type { Color } from '../core/symbols';

const CSS = `
.tz-flow{display:flex;flex-wrap:wrap;gap:4px 3px;align-items:flex-start}
.tz-chip{--k:var(--ink-3);display:inline-flex;flex-direction:column;align-items:center;min-width:14px;padding:4px 4px 3px;border-radius:6px;
  background:color-mix(in srgb,var(--k) 13%,var(--card));border:1px solid color-mix(in srgb,var(--k) 45%,transparent);
  font:500 13px/1.1 var(--font-mono);color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;box-sizing:border-box;transition:background .25s,border-color .25s}
.tz-chip i{font-style:normal;font-size:11px;line-height:1;color:var(--ink-3);margin-top:3px}
.tz-chip.on{border-color:var(--k);box-shadow:0 0 0 1.5px var(--k);background:color-mix(in srgb,var(--k) 26%,var(--card))}
.tz-chip.dim{opacity:.45}
.tz-chip.bad{--k:var(--c-red);color:var(--c-red)}
.tz-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px 10px;font:600 12.5px/1.35 var(--font-ui);color:var(--ink-2);margin:2px 0 6px}
.tz-head b{font-weight:600;color:var(--ink)}
.tz-head span{font-weight:450;color:var(--ink-3)}
.tz-box{background:var(--paper);border:1px solid var(--rule);border-radius:10px;padding:10px 10px 11px}
.tz-bars{display:grid;grid-template-columns:auto 1fr auto;gap:4px 8px;align-items:center;font:500 12.5px/1.2 var(--font-mono)}
.tz-bar{height:13px;border-radius:4px;background:color-mix(in srgb,var(--k,var(--ink-3)) 40%,transparent);min-width:2px}
.tz-bars .on{color:var(--accent);font-weight:700}
.tz-note{font:450 12.5px/1.45 var(--font-ui);color:var(--ink-2)}
.tz-note code{font:500 12px var(--font-mono)}
.tz-cols{display:flex;flex-wrap:wrap;gap:8px 6px}
.tz-col{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:34px}
.tz-glyph{font:500 22px/1.15 var(--font-body);color:var(--ink)}
.tz-cp{font:500 11px var(--font-mono);color:var(--ink-3)}
.tz-bytes{display:flex;gap:2px}
.tz-byte{font:500 11px/1 var(--font-mono);padding:3px 3px;border-radius:4px;color:var(--ink);
  background:color-mix(in srgb,var(--k) 16%,var(--card));border:1px solid color-mix(in srgb,var(--k) 50%,transparent)}
.tz-input{font:500 16px var(--font-mono);padding:7px 10px;border:1px solid var(--rule);border-radius:9px;background:var(--paper);
  color:var(--ink);width:100%;min-width:0;box-sizing:border-box}
.tz-presets{display:flex;flex-wrap:wrap;gap:6px}
.tz-presets .btn{font-size:12.5px;padding:5px 10px}
.tz-presets .btn[aria-pressed=true]{border-color:var(--accent);color:var(--accent-ink)}
`;

/** Injects the chapter's chip styles once per page. */
export function installCss(root: HTMLElement): void {
  if (root.querySelector('style[data-tz]')) return;
  const st = document.createElement('style');
  st.dataset.tz = '1';
  st.textContent = CSS;
  root.prepend(st);
}

const CYCLE: Color[] = ['blue', 'orange', 'green', 'purple', 'teal', 'gold', 'red'];

/** Learned tokens get a palette color fixed by their id; raw bytes stay neutral. */
export function tokenColor(id: number): string {
  return id < 256 ? 'var(--ink-3)' : `var(--c-${CYCLE[id % CYCLE.length]})`;
}

export function chip(text: string, o: { k?: string; sub?: string | number; on?: boolean; dim?: boolean; bad?: boolean; title?: string } = {}): HTMLElement {
  const el = h('span', { class: `tz-chip${o.on ? ' on' : ''}${o.dim ? ' dim' : ''}${o.bad ? ' bad' : ''}`, title: o.title });
  if (o.k) el.style.setProperty('--k', o.k);
  el.append(text || ' ');
  if (o.sub !== undefined) el.append(h('i', {}, String(o.sub)));
  return el;
}

export function flow(chips: HTMLElement[]): HTMLElement {
  return h('div', { class: 'tz-flow' }, ...chips);
}

/** A header line: bold name on the left, quiet stats on the right. */
export function head(name: string, stats = ''): HTMLElement {
  return h('div', { class: 'tz-head', html: `<b>${name}</b><span>${stats}</span>` });
}

export function box(...kids: (Node | string)[]): HTMLElement {
  return h('div', { class: 'tz-box' }, ...kids);
}

/** A one-line text box; 16px so iOS does not zoom on focus. */
export function textInput(value: string, label: string, onInput: (v: string) => void): { el: HTMLElement; input: HTMLInputElement } {
  const input = h('input', { type: 'text', value, class: 'tz-input', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': label });
  input.setAttribute('autocorrect', 'off');
  input.addEventListener('input', () => onInput(input.value));
  const el = h('label', { class: 'ctl' }, h('span', { class: 'ctl-label' }, label), input);
  Object.assign(el.style, { flex: '1 1 100%', display: 'flex', gap: '8px', alignItems: 'center' });
  return { el, input };
}

/** A row of preset buttons that fill a text box. */
export function presets(items: { label: string; text: string }[], pick: (text: string) => void): { el: HTMLElement; mark(text: string): void } {
  const btns = items.map((it) => {
    const b = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false' }, it.label);
    b.addEventListener('click', () => pick(it.text));
    return b;
  });
  const el = h('div', { class: 'tz-presets' }, ...btns);
  return {
    el,
    mark(text) {
      btns.forEach((b, i) => b.setAttribute('aria-pressed', String(items[i]!.text === text)));
    },
  };
}

/** Python string literal for a code slot. */
export function pyStr(s: string): string {
  const q = s.includes('"') && !s.includes("'") ? "'" : '"';
  return q + s.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), `\\${q}`).replace(/\n/g, '\\n') + q;
}
