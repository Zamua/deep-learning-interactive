// Routes under #/atlas: the map, its graph view, a session, the placement test, what to learn next, tracks, a concept
// and its explainer. A session or an explainer may carry the target of the track it follows as its last part.
import '../../styles/atlas.css';
import { domainOf, GRAPH, loadExplainer } from '../../atlas/index';
import { h } from '../../core/dom';
import { Learner } from '../learner';
import { renderConcept } from './concept';
import { notationIn } from './lookup';
import { renderHome, renderMap } from './map';
import { renderNext } from './next';
import { renderPlacement } from './placement';
import { renderSession } from './session';
import { renderTrack, renderTrackMap } from './tracks';

export async function renderAtlas(main: HTMLElement, parts: string[], current: () => boolean): Promise<void> {
  const learner = new Learner(GRAPH);
  const [a = '', b = '', third = ''] = parts;
  const track = GRAPH.get(third) ? third : undefined;
  if (!a) return renderHome(main, learner);
  if (a === 'graph' || a === 'list') return renderMap(main, learner, a);
  if (a === 'learn') return renderSession(main, learner, b || undefined, track);
  if (a === 'new-track') return renderTrackMap(main, learner, 'pick', GRAPH.get(b) ? b : undefined);
  if (a === 'track') {
    if (!GRAPH.get(b)) return location.replace('#/atlas');
    return third === 'map' ? renderTrackMap(main, learner, 'view', b) : renderTrack(main, learner, b);
  }
  if (a === 'place') return renderPlacement(main, learner);
  if (a === 'next') return renderNext(main, learner);
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
  const locked = learner.status(a) === 'locked';
  const missing = c.prereqs.filter((p) => !learner.record(p).mastered).map((p) => GRAPH.get(p)!.title).join(' and ');
  mountLecture(main, def, {
    back: `#/atlas/${a}`,
    kicker: `${domainOf(c).title} · Explainer`,
    poster: [domainOf(c).title, 'Explainer'],
    artist: `Atlas: ${c.title}`,
    noun: 'explainer',
    notes: (marks, said) => notationIn(a, marks, said),
    // A locked concept cannot be practiced yet, so its explainer ends on what to master first.
    end: locked
      ? { kicker: 'Not yet', title: `Master ${missing} first`, action: track ? 'See the track' : 'See the map', href: track ? `#/atlas/track/${track}` : '#/atlas' }
      : { kicker: 'Your turn', title: 'Ready to practice?', action: 'Start practice', href: `#/atlas/learn/${a}${track ? `/${track}` : ''}` },
  });
}
