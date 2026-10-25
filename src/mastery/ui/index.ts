// Routes under #/atlas: the map, its graph view, a session, the placement test, a concept and its explainer.
import '../../styles/atlas.css';
import { domainOf, GRAPH, loadExplainer } from '../../atlas/index';
import { h } from '../../core/dom';
import { Learner } from '../learner';
import { renderConcept } from './concept';
import { renderMap } from './map';
import { renderPlacement } from './placement';
import { renderSession } from './session';

export async function renderAtlas(main: HTMLElement, parts: string[], current: () => boolean): Promise<void> {
  const learner = new Learner(GRAPH);
  const [a = '', b = ''] = parts;
  if (!a) return renderMap(main, learner, 'list');
  if (a === 'graph') return renderMap(main, learner, 'graph');
  if (a === 'learn') return renderSession(main, learner, b || undefined);
  if (a === 'place') return renderPlacement(main, learner);
  const c = GRAPH.get(a);
  if (!c) {
    location.replace('#/atlas');
    return;
  }
  if (b !== 'watch') return renderConcept(main, learner, a);

  const pending = loadExplainer(a);
  if (!pending) {
    location.replace(`#/atlas/${a}`);
    return;
  }
  main.append(h('div', { class: 'loading' }, 'Loading the explainer…'));
  const [def, { mountLecture }] = await Promise.all([pending, import('../../lecture/player')]);
  if (!current()) return;
  main.innerHTML = '';
  mountLecture(main, def, {
    back: `#/atlas/${a}`,
    kicker: `${domainOf(c).title} · Explainer`,
    poster: [domainOf(c).title, 'Explainer'],
    artist: `Atlas: ${c.title}`,
    noun: 'explainer',
    end: { kicker: 'That was the explainer', title: 'Now try it yourself', action: `Practice ${c.title.toLowerCase()}`, href: `#/atlas/learn/${a}` },
  });
}
