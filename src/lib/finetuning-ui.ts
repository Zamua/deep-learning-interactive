import { h } from '../core/dom';

const CSS = `
.ft-box{background:var(--paper);border:1px solid var(--rule);border-radius:10px;padding:10px 10px 11px}
.ft-rows{display:flex;flex-direction:column;gap:9px}
.ft-flow{display:flex;flex-wrap:wrap;gap:5px 3px;align-items:flex-start}
.ft-chip{--k:var(--ink-3);display:inline-flex;flex-direction:column;align-items:center;min-width:12px;padding:3px 4px 2px;border-radius:6px;
  background:color-mix(in srgb,var(--k) 9%,var(--card));border:1px solid color-mix(in srgb,var(--k) 35%,transparent);
  font:500 12.5px/1.15 var(--font-mono);color:var(--ink-2);white-space:pre;max-width:100%;font-variant-ligatures:none;box-sizing:border-box;cursor:default;
  transition:background .25s,border-color .25s,opacity .25s}
.ft-chip i{font-style:normal;font-size:10.5px;line-height:1;color:var(--ink-3);margin-top:2px}
.ft-chip.sp{border-style:dashed;color:var(--c-purple);font-size:11px}
.ft-chip.on{--k:var(--c-gold);background:color-mix(in srgb,var(--c-gold) 24%,var(--card));border-color:var(--c-gold);color:var(--ink)}
.ft-chip.on.sp{border-style:solid}
.ft-chip.on i{color:var(--c-gold);font-weight:700}
.ft-chip.sel{box-shadow:0 0 0 2px var(--accent)}
.ft-chip.dim{opacity:.55}
.ft-chip.bad{--k:var(--c-red);color:var(--c-red)}
.ft-chip.good{--k:var(--c-green);color:var(--ink)}
.ft-tag{font:600 11px/1.2 var(--font-ui);color:var(--ink-3);text-transform:uppercase;letter-spacing:.04em;margin:0 0 3px}
.ft-note{font:450 12.5px/1.45 var(--font-ui);color:var(--ink-2);margin-top:8px}
.ft-note code{font:500 12px var(--font-mono)}
.ft-gen{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:start;margin-bottom:10px}
.ft-gen .lab{font:600 11.5px/1.9 var(--font-ui);color:var(--ink-3);white-space:nowrap}
.ft-gen .sep{grid-column:1/-1;border-top:1px solid var(--rule);margin:3px 0}
`;

/** Injects the chapter's chip styles once per page. */
export function installCss(root: HTMLElement): void {
  if (root.querySelector('style[data-ft]')) return;
  const st = document.createElement('style');
  st.dataset.ft = '1';
  st.textContent = CSS;
  root.prepend(st);
}

export interface ChipOpts {
  sub?: string;
  on?: boolean;
  sp?: boolean;
  dim?: boolean;
  bad?: boolean;
  good?: boolean;
  title?: string;
}

export function chip(text: string, o: ChipOpts = {}): HTMLElement {
  const cls = ['ft-chip', o.on && 'on', o.sp && 'sp', o.dim && 'dim', o.bad && 'bad', o.good && 'good'].filter(Boolean).join(' ');
  const el = h('span', { class: cls, title: o.title });
  el.append(text || ' ');
  if (o.sub !== undefined) el.append(h('i', {}, o.sub));
  return el;
}

export function flow(chips: HTMLElement[]): HTMLElement {
  return h('div', { class: 'ft-flow' }, ...chips);
}
