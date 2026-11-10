// The search for a concept: a field that lists the best matches as the learner types. The list lies over the page, and
// nothing under it moves or redraws until a match is chosen.
import { icon } from '../../core/controls';
import { h, onDispose } from '../../core/dom';
import { searchConcepts, type Hit } from '../domain/search';
import type { Learner } from '../learner';
import { STATUS_LABEL } from './common';

export interface MapSearchHost {
  /** The learner chose a concept. */
  pick(id: string): void;
}

/** The title with the matched part marked. */
function titleOf(title: string, hit: Hit): HTMLElement {
  if (!hit.span) return h('span', { class: 'at-search-t' }, title);
  const [a, b] = hit.span;
  return h('span', { class: 'at-search-t' }, title.slice(0, a), h('mark', {}, title.slice(a, b)), title.slice(b));
}

export function mapSearch(learner: Learner, host: MapSearchHost): HTMLElement {
  const graph = learner.graph;
  const input = h('input', {
    type: 'search', class: 'at-search-in', placeholder: 'Find a concept', 'aria-label': 'Find a concept', role: 'combobox',
    'aria-autocomplete': 'list', 'aria-controls': 'at-search-list', 'aria-expanded': 'false',
    autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'search',
  }) as HTMLInputElement;
  const clear = h('button', { type: 'button', class: 'at-search-x', 'aria-label': 'Clear the search', hidden: true, html: icon('close') });
  const list = h('ul', { id: 'at-search-list', class: 'at-search-list', role: 'listbox', 'aria-label': 'Concepts found', hidden: true });
  const none = h('p', { class: 'at-search-none', hidden: true });
  const root = h('div', { class: 'at-search', role: 'search' },
    h('div', { class: 'at-search-field' }, h('span', { class: 'at-search-i', html: icon('magnifying-glass') }), input, clear), list, none);

  let hits: Hit[] = [];
  let active = -1;

  const fit = () => {
    // The list ends above the on-screen keyboard: the visual viewport is what is left of the screen.
    const vv = window.visualViewport;
    list.style.setProperty('--room', `${(vv ? vv.height + vv.offsetTop : innerHeight) - list.getBoundingClientRect().top - 12}px`);
  };
  const open = (on: boolean) => {
    list.hidden = !on || !hits.length;
    none.hidden = !on || !!hits.length || !input.value.trim();
    input.setAttribute('aria-expanded', String(!list.hidden));
    if (!list.hidden) fit();
  };
  const mark = (i: number) => {
    active = i;
    list.querySelectorAll('[role=option]').forEach((el, k) => el.setAttribute('aria-selected', String(k === i)));
    const el = list.children[i];
    if (el) {
      input.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };
  const choose = (id: string) => {
    open(false);
    input.blur();
    host.pick(id);
  };

  const update = () => {
    hits = searchConcepts(graph, input.value);
    clear.hidden = !input.value;
    list.replaceChildren(...hits.map((hit, i) => {
      const c = graph.get(hit.id)!;
      const d = learner.course.domainOf(c);
      const a = h('a', { href: learner.course.routes.concept(c.id), tabindex: '-1' },
        h('span', { class: 'at-search-b' }, titleOf(c.title, hit), h('small', {}, `${d.title} · ${STATUS_LABEL[learner.status(c.id)]}`)));
      a.addEventListener('click', (e) => {
        e.preventDefault();
        choose(c.id);
      });
      return h('li', { id: `at-search-${i}`, role: 'option', 'aria-selected': 'false' }, a);
    }));
    none.textContent = `No concept matches "${input.value.trim()}".`;
    mark(-1);
    open(true);
  };

  // A fast typist's letters are answered together.
  let waiting = 0;
  input.addEventListener('input', () => {
    clear.hidden = !input.value;
    window.clearTimeout(waiting);
    waiting = window.setTimeout(update, 90);
  });
  // Nothing is scrolled to meet the field: Safari brings a focused field into view itself, and a second scroll on top
  // of that one drags the whole page about under the keyboard.
  input.addEventListener('focus', () => {
    if (input.value) open(true);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) open(true);
      const n = hits.length;
      if (n) mark(e.key === 'ArrowDown' ? (active + 1) % n : (active - 1 + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // What is listed may be a keystroke behind.
      window.clearTimeout(waiting);
      update();
      const hit = hits[Math.max(0, active)];
      if (hit) choose(hit.id);
    } else if (e.key === 'Escape') {
      if (!list.hidden) open(false);
      else input.blur();
    }
  });
  clear.addEventListener('click', () => {
    input.value = '';
    update();
    input.focus();
  });
  // A tap anywhere else puts the list away; what was typed stays, and so does the lighting.
  const away = (e: PointerEvent) => {
    if (!root.contains(e.target as Node)) open(false);
  };
  document.addEventListener('pointerdown', away);
  window.visualViewport?.addEventListener('resize', fit);
  onDispose(() => {
    window.clearTimeout(waiting);
    document.removeEventListener('pointerdown', away);
    window.visualViewport?.removeEventListener('resize', fit);
  });
  return root;
}
