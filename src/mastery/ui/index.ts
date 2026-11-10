// A course's routes: the map, its graph view, a session, the placement test, what to learn next, tracks, history, a concept
// and its explainer. A session or an explainer may carry the target of the track it follows as its last part.
import '../../styles/atlas.css';
import { courseById } from '../../courses/index';
import { h } from '../../core/dom';
import { Learner } from '../learner';
import { renderConcept } from './concept';
import { notationIn } from './lookup';
import { renderHome, renderMap } from './map';
import { renderHistory } from './history';
import { renderNext } from './next';
import { renderPlacement } from './placement';
import { renderSession } from './session';
export { renderTopics } from './topics';
import { renderTrack, renderTrackMap } from './tracks';
import type { CourseRoute } from '../../routes';

export async function renderAtlas(main: HTMLElement, r: CourseRoute, current: () => boolean): Promise<void> {
  const course = courseById(r.course)!;
  const { graph, routes } = course;
  const learner = new Learner(course);
  const known = (id?: string) => (id && graph.get(id) ? id : undefined);
  switch (r.page) {
    case 'home':
      return renderHome(main, learner);
    case 'graph':
    case 'list':
      return renderMap(main, learner, r.page);
    case 'learn':
      return renderSession(main, learner, r.concept, known(r.track));
    case 'new-track':
      return renderTrackMap(main, learner, 'pick', known(r.target));
    case 'track':
      if (!known(r.target)) return location.replace(routes.home);
      return r.map ? renderTrackMap(main, learner, 'view', r.target) : renderTrack(main, learner, r.target);
    case 'place':
      return renderPlacement(main, learner);
    case 'next':
      return renderNext(main, learner);
    case 'history':
      return renderHistory(main, learner);
  }
  const a = r.concept;
  const c = graph.get(a);
  if (!c) {
    location.replace(routes.home);
    return;
  }
  if (r.page === 'concept') return renderConcept(main, learner, a);
  const track = known(r.track);

  const pending = course.loadExplainer(a);
  if (!pending) {
    location.replace(routes.concept(a));
    return;
  }
  main.append(h('div', { class: 'loading' }, 'Loading the explainer…'));
  const [def, { mountLecture }] = await Promise.all([pending, import('../../lecture/player')]);
  if (!current()) return;
  main.innerHTML = '';
  const locked = learner.status(a) === 'locked';
  const missing = c.prereqs.filter((p) => !learner.record(p).mastered).map((p) => graph.get(p)!.title).join(' and ');
  mountLecture(main, def, {
    back: routes.concept(a),
    kicker: `${course.domainOf(c).title} · Explainer`,
    poster: [course.domainOf(c).title, 'Explainer'],
    artist: `Atlas: ${c.title}`,
    noun: 'explainer',
    notes: (marks, said) => notationIn(course, a, marks, said),
    // A locked concept cannot be practiced yet, so its explainer ends on what to master first.
    end: locked
      ? { kicker: 'Not yet', title: `Master ${missing} first`, action: track ? 'See the track' : 'See the map', href: track ? routes.track(track) : routes.home }
      : { kicker: 'Your turn', title: 'Ready to practice?', action: 'Start practice', href: routes.learn(a, track) },
  });
}
