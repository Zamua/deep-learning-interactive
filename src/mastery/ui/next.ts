// What to learn next (#/atlas/next): the next step along the chain in progress, a start in another area, or any
// concept open now, and how Atlas chooses when the learner leaves it to Atlas.
import { domainOf, DOMAINS, hasExplainer } from '../../atlas/index';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { DAY } from '../domain/model';
import type { Learner } from '../learner';
import { atlasRoot, plural } from './common';
import { paceSwitch } from './pace';
import { routes } from '../../routes';

/** Starting a concept opens its explainer first, when it has one. */
export const startHref = (id: string): string => (hasExplainer(id) ? routes.watch(id) : routes.learn(id));

export function renderNext(main: HTMLElement, learner: Learner): void {
  const root = atlasRoot('at-map at-pick');
  main.append(root);
  const graph = learner.graph;
  const { deeper, different, open } = learner.choices();
  const title = (id: string) => graph.get(id)!.title;
  root.append(
    h('a', { class: 'at-back', href: routes.home, html: `${icon('arrowLeft')} Atlas` }),
    h('h1', { class: 'home-title' }, 'What next?'),
    h('p', { class: 'at-small' }, open.length ? `${plural(open.length, 'concept')} open to start. Each begins with its explainer.` : 'Nothing new is open yet.'));

  const recs = learner.records;
  const inProgress = graph.order.find((c) => learner.status(c.id) === 'learning' && recs[c.id]!.last === Math.max(...graph.order.filter((x) => learner.status(x.id) === 'learning').map((x) => recs[x.id]!.last)));
  if (inProgress) root.append(h('p', { class: 'at-pick-now', html: `${icon('bolt')} <span>You are partway through <a href="${routes.learn(inProgress.id)}"></a>. Starting another leaves it waiting.</span>` }));
  root.querySelector('.at-pick-now a')?.append(inProgress!.title);

  const latest = graph.order.filter((c) => recs[c.id]?.mastered).sort((a, b) => recs[b.id]!.last - recs[a.id]!.last)[0];
  const lastIn = (domain: string) => Math.max(0, ...graph.order.filter((c) => c.domain === domain && recs[c.id]?.attempts).map((c) => recs[c.id]!.last));
  const card = (kicker: string, id: string, why: string) => {
    const c = graph.get(id)!;
    return h('a', { class: 'at-pick-card', href: startHref(id), style: `--dom:var(--c-${domainOf(c).color})` },
      h('span', { class: 'at-pick-k' }, kicker),
      h('span', { class: 'at-pick-t' }, c.title),
      h('span', { class: 'at-pick-b' }, c.blurb),
      h('span', { class: 'at-pick-w' }, why),
      h('span', { class: 'at-pick-go', html: `${icon(hasExplainer(id) ? 'playFill' : 'arrowRight')} ${hasExplainer(id) ? 'Watch the explainer' : 'Start'}` }));
  };
  const cards: HTMLElement[] = [];
  if (deeper) {
    const builds = latest && graph.get(deeper)!.prereqs.includes(latest.id);
    cards.push(card('Go deeper', deeper, builds ? `Builds on ${latest!.title}, which you mastered last.` : `More ${domainOf(graph.get(deeper)!).title}.`));
  }
  if (different) {
    const d = domainOf(graph.get(different)!);
    const t = lastIn(d.id);
    const days = Math.floor((Date.now() - t) / DAY);
    cards.push(card('Something different', different, !t ? `A fresh area: ${d.title}.` : `${d.title}, last practiced ${days < 1 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}.`));
  }
  if (cards.length) root.append(h('div', { class: 'at-pick-cards' }, ...cards));

  if (open.length > cards.length) {
    root.append(h('h2', { class: 'at-h2' }, `Everything open · ${open.length}`));
    for (const d of DOMAINS) {
      const mine = open.filter((id) => graph.get(id)!.domain === d.id);
      if (!mine.length) continue;
      root.append(h('div', { class: 'at-pick-dom', style: `--dom:var(--c-${d.color})` }, d.title), ...mine.map((id) =>
        h('a', { class: 'at-row', href: startHref(id) },
          h('span', { class: 'at-row-box new', html: icon('playFill') }),
          h('span', { class: 'at-row-t' }, title(id)),
          h('span', { class: 'at-row-r' }, graph.get(id)!.prereqs.length ? `after ${graph.get(id)!.prereqs.map(title).join(', ')}` : 'a starting point'))));
    }
  }

  root.append(h('h2', { class: 'at-h2' }, 'When Atlas picks for you'), h('div', { class: 'at-pick-pace' }, paceSwitch()));
}
