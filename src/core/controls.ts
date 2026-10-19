import { h } from './dom';
import { fmt } from './code';

export interface Slider {
  el: HTMLElement;
  input: HTMLInputElement;
  get value(): number;
  set(v: number, fire?: boolean): void;
}

export function slider(opts: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  /** Display text for the current value. */
  format?: (v: number) => string;
  /** Map the raw slider position to a value (e.g. log scale); the slider then runs over min..max of the raw position. */
  map?: (raw: number) => number;
  onInput: (v: number) => void;
  /** Symbol color key to tint the label with, e.g. "W". */
  sym?: string;
}): Slider {
  const map = opts.map ?? ((x: number) => x);
  const input = h('input', { type: 'range', min: opts.min, max: opts.max, step: opts.step ?? 'any', value: opts.value });
  const out = h('output', { class: 'ctl-val' });
  const label = h('span', { class: `ctl-label${opts.sym ? ` sym sym-${opts.sym}` : ''}` }, opts.label);
  const show = () => {
    const v = map(Number(input.value));
    out.textContent = opts.format ? opts.format(v) : fmt(v);
    return v;
  };
  input.addEventListener('input', () => opts.onInput(show()));
  show();
  const el = h('label', { class: 'ctl ctl-slider' }, label, input, out);
  return {
    el,
    input,
    get value() {
      return map(Number(input.value));
    },
    set(v: number, fire = true) {
      input.value = String(v);
      const mv = show();
      if (fire) opts.onInput(mv);
    },
  };
}

export function button(label: string, onClick: () => void, opts: { icon?: string; primary?: boolean } = {}): HTMLButtonElement {
  const b = h('button', { class: `btn${opts.primary ? ' btn-primary' : ''}`, type: 'button' });
  if (opts.icon) b.innerHTML = icon(opts.icon);
  b.append(label);
  b.addEventListener('click', onClick);
  return b;
}

/** A row of mutually exclusive options. */
export function segmented<T extends string>(opts: { label?: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }): { el: HTMLElement; get value(): T; set(v: T, fire?: boolean): void } {
  let cur = opts.value;
  const btns = opts.options.map((o) => {
    const b = h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(o.value === cur) }, o.label);
    b.addEventListener('click', () => api.set(o.value));
    return b;
  });
  const el = h('div', { class: 'ctl ctl-seg' });
  if (opts.label) el.append(h('span', { class: 'ctl-label' }, opts.label));
  el.append(h('div', { class: 'seg', role: 'group' }, ...btns));
  const api = {
    el,
    get value() {
      return cur;
    },
    set(v: T, fire = true) {
      cur = v;
      btns.forEach((b, i) => b.setAttribute('aria-pressed', String(opts.options[i]!.value === v)));
      if (fire) opts.onChange(v);
    },
  };
  return api;
}

export function toggle(opts: { label: string; value: boolean; onChange: (v: boolean) => void }): { el: HTMLElement; get value(): boolean; set(v: boolean, fire?: boolean): void } {
  const input = h('input', { type: 'checkbox' });
  input.checked = opts.value;
  input.addEventListener('change', () => opts.onChange(input.checked));
  const el = h('label', { class: 'ctl ctl-toggle' }, input, h('span', { class: 'toggle-track' }), h('span', { class: 'ctl-label' }, opts.label));
  return {
    el,
    get value() {
      return input.checked;
    },
    set(v: boolean, fire = true) {
      input.checked = v;
      if (fire) opts.onChange(v);
    },
  };
}

/** A labelled value that the figure updates, e.g. "loss 2.31". */
export function readout(label: string, opts: { sym?: string } = {}): { el: HTMLElement; set(v: string | number): void } {
  const val = h('span', { class: 'ro-val' }, '–');
  const el = h('span', { class: 'readout' }, h('span', { class: `ro-label${opts.sym ? ` sym sym-${opts.sym}` : ''}` }, label), val);
  return {
    el,
    set(v) {
      val.textContent = typeof v === 'number' ? fmt(v) : v;
    },
  };
}

/** Step-through transport: prev / play-pause / next / reset over `n` steps. */
export function stepper(opts: { steps: number; onStep: (i: number) => void; interval?: number; label?: (i: number) => string }): { el: HTMLElement; get index(): number; go(i: number): void; setSteps(n: number): void } {
  let i = 0;
  let n = opts.steps;
  let timer = 0;
  const lab = h('span', { class: 'step-label' });
  const go = (k: number) => {
    i = Math.max(0, Math.min(n - 1, k));
    lab.textContent = opts.label ? opts.label(i) : `step ${i + 1} / ${n}`;
    opts.onStep(i);
  };
  const play = h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'play' });
  const setPlaying = (on: boolean) => {
    if (timer) clearInterval(timer);
    timer = 0;
    play.innerHTML = icon(on ? 'pause' : 'play');
    if (on) {
      if (i >= n - 1) go(0);
      timer = window.setInterval(() => {
        if (i >= n - 1) setPlaying(false);
        else go(i + 1);
      }, opts.interval ?? 900);
    }
  };
  play.addEventListener('click', () => setPlaying(!timer));
  const prev = h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'previous step', html: icon('prev') });
  const next = h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'next step', html: icon('next') });
  prev.addEventListener('click', () => {
    setPlaying(false);
    go(i - 1);
  });
  next.addEventListener('click', () => {
    setPlaying(false);
    go(i + 1);
  });
  setPlaying(false);
  const el = h('div', { class: 'ctl ctl-stepper' }, prev, play, next, lab);
  queueMicrotask(() => go(0));
  return {
    el,
    get index() {
      return i;
    },
    go,
    setSteps(k: number) {
      n = k;
      go(Math.min(i, n - 1));
    },
  };
}

const ICON_SVGS = import.meta.glob('../../node_modules/@phosphor-icons/core/assets/light/{play,pause,skip-forward,skip-back,arrow-counter-clockwise,shuffle,list,x,sun,moon,arrow-right,arrow-left,check,lightbulb,warning,function,book-open,clipboard-text,eye,math-operations,graduation-cap,code,brain,image,info,closed-captioning,corners-out,corners-in,rewind}-light.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const FILL_SVGS = import.meta.glob('../../node_modules/@phosphor-icons/core/assets/fill/{play,pause,fast-forward,lock-simple,lock-simple-open,caret-double-down}-fill.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const ALIAS: Record<string, string> = { next: 'skip-forward', prev: 'skip-back', reset: 'arrow-counter-clockwise', menu: 'list', close: 'x', arrowRight: 'arrow-right', arrowLeft: 'arrow-left', book: 'book-open', clipboard: 'clipboard-text', math: 'math-operations', playFill: 'play-fill', pauseFill: 'pause-fill', ffFill: 'fast-forward-fill', lockFill: 'lock-simple-fill', unlockFill: 'lock-simple-open-fill', downFill: 'caret-double-down-fill' };

/** Inline Phosphor Light glyph by name (or alias), sized by CSS `.ico`. */
export function icon(name: string): string {
  const file = ALIAS[name] ?? name;
  const svg = Object.entries(ICON_SVGS).find(([k]) => k.endsWith(`/${file}-light.svg`))?.[1] ?? Object.entries(FILL_SVGS).find(([k]) => k.endsWith(`/${file}.svg`))?.[1];
  return svg ? svg.replace('<svg ', '<svg class="ico" aria-hidden="true" ') : '';
}
