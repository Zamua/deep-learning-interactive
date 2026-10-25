// The placement test. A fast right answer marks a concept and everything it builds on as known;
// a miss marks it and everything built on it as not yet known.
import { domainOf, loadGenerators } from '../../atlas/index';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { Rng } from '../../core/rand';
import { ancestors, descendants, nextProbe } from '../domain/placement';
import type { Learner } from '../learner';
import { plural } from './common';
import { ask, runFrame } from './session';

/** Questions at most; the graph is usually settled sooner. */
const MAX_QUESTIONS = 14;
const DIFFICULTY = 0.6;

export function renderPlacement(main: HTMLElement, learner: Learner): void {
  const g = learner.graph;
  const frame = runFrame(main, 'at-place-run');
  const rng = new Rng((Date.now() ^ (Math.random() * 2 ** 32)) >>> 0);
  const known = new Map<string, boolean>();
  let asked = 0;
  frame.setProgress(0, 1, 'Placement');

  const start = () => {
    frame.body.innerHTML = '';
    frame.dock.innerHTML = '';
    frame.body.append(h('div', { class: 'at-intro' },
      h('div', { class: 'at-kicker' }, 'Placement test'),
      h('h1', { class: 'at-title' }, 'Find your starting point'),
      h('p', { class: 'at-lede' }, `Up to ${MAX_QUESTIONS} questions from across the course, each picked from how you did on the last. Answer what you can; a miss just means that concept is where you start.`),
      h('p', { class: 'at-small' }, 'Concepts it places come back for review tomorrow, so a lucky guess gets checked.')));
    const go = h('button', { type: 'button', class: 'at-check' }, 'Begin');
    go.addEventListener('click', () => void loop());
    frame.dock.append(go);
  };

  const loop = async () => {
    for (;;) {
      const id = asked < MAX_QUESTIONS ? nextProbe(g, known) : null;
      if (!id) return finish();
      const c = g.get(id)!;
      const gens = await loadGenerators(id);
      if (!gens.length) {
        known.set(id, false);
        continue;
      }
      const gen = gens[rng.int(gens.length)]!;
      const problem = gen.make(rng, DIFFICULTY);
      const tag = h('div', { class: 'at-tag', style: `--dom:var(--c-${domainOf(c).color})` }, h('b', {}, c.title), h('span', {}, `question ${asked + 1}`));
      const got = await ask(frame, { concept: id, problem, rng, tag });
      asked++;
      const pass = got.verdict.ok && got.seconds <= 2 * c.mastery.seconds;
      for (const x of pass ? ancestors(g, id) : descendants(g, id)) if (!known.has(x)) known.set(x, pass);
      const settled = known.size / g.order.length;
      frame.setProgress(settled, 1, `${Math.round(settled * 100)}% placed`);
    }
  };

  const finish = () => {
    const placed = [...known].filter(([, ok]) => ok).map(([id]) => id);
    learner.place(placed);
    const frontier = g.order.filter((c) => learner.status(c.id) === 'new').map((c) => c.title);
    frame.setProgress(1, 1, 'Placed');
    frame.body.innerHTML = '';
    frame.dock.innerHTML = '';
    frame.body.append(h('div', { class: 'at-done' },
      h('div', { class: 'at-kicker' }, 'Placement done'),
      h('h1', { class: 'at-title' }, placed.length ? `${plural(placed.length, 'concept')} placed` : 'Starting from the beginning'),
      h('p', { class: 'at-lede' }, frontier.length ? `Ready to learn next: ${frontier.slice(0, 4).join(', ')}${frontier.length > 4 ? ', and more' : ''}.` : 'Everything is placed.')));
    frame.dock.append(h('a', { class: 'at-ghost', href: '#/atlas' }, 'See the map'), h('a', { class: 'at-check', href: '#/atlas/learn', html: `${icon('playFill')} Start learning` }));
  };

  start();
}
