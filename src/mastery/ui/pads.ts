// Answer input built for the answer's kind: an on-screen keypad for typed answers (so the phone
// keyboard never opens), tappable options for choices, and tap-in-order for orderings.
import type { Rng } from '../../core/rand';
import { icon } from '../../core/controls';
import { h, onDispose } from '../../core/dom';
import type { Response } from '../domain/grade';
import type { Answer } from '../domain/types';

export interface Pad {
  /** Shown in the problem, under the prompt. */
  display: HTMLElement;
  /** Pinned to the bottom of the screen; empty for choices and orderings. */
  keys: HTMLElement;
  /** The response so far, or null while there is nothing to check. */
  value(): Response | null;
  onInput(fn: () => void): void;
  /** Stops taking input once the answer is checked, marking the right option where there are options. */
  lock(): void;
}

type Key = string | [label: string, insert: string, span?: number];
const BACK = '⌫';
const LAYOUTS: Record<'number' | 'shape' | 'vector', Key[][]> = {
  number: [['7', '8', '9', BACK], ['4', '5', '6', '/'], ['1', '2', '3', ['−', '-']], [['0', '0', 3], '.']],
  shape: [['7', '8', '9', BACK], ['4', '5', '6', [',', ', ']], ['1', '2', '3', '0']],
  vector: [['7', '8', '9', BACK], ['4', '5', '6', [',', ', ']], ['1', '2', '3', ['−', '-']], [['0', '0', 3], '.']],
};
const exprLayout = (vars: string[]): Key[][] => [
  [vars[0] ?? 'x', '(', ')', '^', BACK],
  ['7', '8', '9', ['÷', '/'], ['eˣ', 'e^(']],
  ['4', '5', '6', ['×', '*'], ['ln', 'ln(']],
  ['1', '2', '3', ['−', '-'], ['√', 'sqrt(']],
  ['0', '.', '+', ...vars.slice(1, 3)],
];

export function makePad(answer: Answer, rng: Rng, renderMd: (s: string) => string, onSubmit: () => void): Pad {
  switch (answer.kind) {
    case 'choice':
      return choicePad(answer.options, answer.correct, rng, renderMd);
    case 'order':
      return orderPad(answer.items, rng, renderMd);
    case 'expr':
      return keyPad('expr', exprLayout(answer.vars), onSubmit);
    default:
      return keyPad(answer.kind, LAYOUTS[answer.kind], onSubmit);
  }
}

function keyPad(kind: Answer['kind'], rows: Key[][], onSubmit: () => void): Pad {
  let text = '';
  let locked = false;
  const listeners: (() => void)[] = [];
  const shown = h('span', { class: 'at-ans-text' });
  const [open, close] = kind === 'shape' ? ['(', ')'] : kind === 'vector' ? ['[', ']'] : ['', ''];
  const display = h('div', { class: `at-ans at-ans-${kind}` }, open ? h('span', { class: 'at-ans-br' }, open) : '', shown, h('span', { class: 'at-caret' }), close ? h('span', { class: 'at-ans-br' }, close) : '');
  const cols = Math.max(...rows.map((r) => r.reduce((a, k) => a + (Array.isArray(k) ? (k[2] ?? 1) : 1), 0)));
  const keys = h('div', { class: 'at-keys', style: `--cols:${cols}` });
  const set = (t: string) => {
    if (locked) return;
    text = t;
    shown.textContent = text;
    listeners.forEach((f) => f());
  };
  const press = (insert: string) => set(insert === BACK ? text.slice(0, -1) : text + insert);
  for (const row of rows) {
    for (const k of row) {
      const [label, insert, span] = Array.isArray(k) ? k : [k, k, 1];
      const b = h('button', { type: 'button', class: `at-key${label === BACK || /[^\d.]/.test(label) ? ' fn' : ''}`, style: span && span > 1 ? `grid-column:span ${span}` : '' });
      if (label === BACK) {
        b.innerHTML = icon('backspace');
        b.setAttribute('aria-label', 'Delete');
      } else b.textContent = label;
      b.addEventListener('click', () => press(insert));
      keys.append(b);
    }
  }
  // A physical keyboard types the same characters.
  const allowed = kind === 'expr' ? /^[\d.+\-*/^()a-z ,]$/i : kind === 'shape' ? /^[\d, x]$/ : kind === 'vector' ? /^[\d.\-, ]$/ : /^[\d.\-/e]$/;
  const onKey = (e: KeyboardEvent) => {
    if (locked || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      press(BACK);
    } else if (allowed.test(e.key)) {
      e.preventDefault();
      press(e.key);
    }
  };
  window.addEventListener('keydown', onKey);
  onDispose(() => window.removeEventListener('keydown', onKey));
  return {
    display,
    keys,
    value: () => (text.trim() ? text : null),
    onInput: (fn) => listeners.push(fn),
    lock: () => {
      locked = true;
      display.classList.add('locked');
      keys.classList.add('locked');
    },
  };
}

function choicePad(options: string[], correct: number, rng: Rng, renderMd: (s: string) => string): Pad {
  const order = rng.shuffle(options.map((_, i) => i));
  let picked: number | null = null;
  let locked = false;
  const listeners: (() => void)[] = [];
  const display = h('div', { class: 'at-choices', role: 'radiogroup' });
  for (const i of order) {
    const b = h('button', { type: 'button', class: 'at-choice', role: 'radio', 'aria-checked': 'false', 'data-i': String(i), html: renderMd(options[i]!) });
    b.addEventListener('click', () => {
      if (locked) return;
      picked = i;
      display.querySelectorAll('.at-choice').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      listeners.forEach((f) => f());
    });
    display.append(b);
  }
  return {
    display,
    keys: h('div', {}),
    value: () => picked,
    onInput: (fn) => listeners.push(fn),
    lock: () => {
      locked = true;
      display.classList.add('locked');
      display.querySelector(`[data-i="${correct}"]`)?.classList.add('right');
      if (picked !== null && picked !== correct) display.querySelector(`[data-i="${picked}"]`)?.classList.add('wrong');
    },
  };
}

function orderPad(items: string[], rng: Rng, renderMd: (s: string) => string): Pad {
  const pool = rng.shuffle(items.map((_, i) => i));
  // A shuffle that happens to be the answer would give it away.
  if (pool.every((x, i) => x === i) && pool.length > 1) pool.push(pool.shift()!);
  const placed: number[] = [];
  let locked = false;
  const listeners: (() => void)[] = [];
  const list = h('ol', { class: 'at-order' });
  const left = h('div', { class: 'at-pool' });
  const display = h('div', { class: 'at-ordering' }, h('div', { class: 'at-order-hint' }, 'Tap them in order. Tap a placed one to take it back.'), list, left);
  const draw = () => {
    list.innerHTML = '';
    left.innerHTML = '';
    for (const i of placed) {
      const b = h('button', { type: 'button', class: 'at-step', html: renderMd(items[i]!) });
      b.addEventListener('click', () => {
        if (locked) return;
        placed.splice(placed.indexOf(i), 1);
        draw();
      });
      list.append(h('li', {}, b));
    }
    for (const i of pool.filter((x) => !placed.includes(x))) {
      const b = h('button', { type: 'button', class: 'at-step', html: renderMd(items[i]!) });
      b.addEventListener('click', () => {
        if (locked) return;
        placed.push(i);
        draw();
      });
      left.append(b);
    }
    listeners.forEach((f) => f());
  };
  draw();
  return {
    display,
    keys: h('div', {}),
    value: () => (placed.length === items.length ? [...placed] : null),
    onInput: (fn) => listeners.push(fn),
    lock: () => {
      locked = true;
      display.classList.add('locked');
    },
  };
}
