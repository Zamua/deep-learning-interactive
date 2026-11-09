// The site's pages (shelf, review, path, settings) and a course's: its front page, the map and list, a session, the
// placement test, what to learn next, tracks, history, a concept and its explainer. A session or an explainer may carry
// the target of the track it follows as its last part.
import '../../styles/atlas.css';
import '../../styles/library.css';
import { courseById } from '../../courses/index';
import { h } from '../../core/dom';
import { Learner } from '../learner';
import { renderExplore } from './explore/index';
import { notationIn } from './lookup';
import { renderPlacement } from './placement';
import { renderSession } from './session';
import { renderSettings } from './settings';
import { replaceRoute } from '../../core/back';
import type { CourseRoute, SitePage } from '../../routes';

export const renderSite = (main: HTMLElement, _page: SitePage): void => renderSettings(main);

export async function renderAtlas(main: HTMLElement, r: CourseRoute, current: () => boolean): Promise<void> {
  const course = courseById(r.course)!;
  const { graph, routes } = course;
  const learner = new Learner(course);
  const known = (id?: string) => (id && graph.get(id) ? id : undefined);
  switch (r.page) {
    // The shell draws these two itself, without loading this module.
    case 'home':
    case 'concept':
      return;
    case 'explore':
      return renderExplore(main, learner, r.view);
    case 'learn':
      return renderSession(main, learner, known(r.concept), known(r.track));
    case 'place':
      return renderPlacement(main, learner);
    // Addresses of pages that became part of Explore or the home.
    case 'graph':
      return replaceRoute(routes.explore('chapters'));
    case 'list':
      return replaceRoute(routes.explore('list'));
    case 'history':
      return replaceRoute(routes.explore('history'));
    case 'next':
      return replaceRoute(routes.home);
    case 'track':
    case 'new-track':
      return replaceRoute(routes.explore('goals'));
  }
  const a = r.concept;
  const c = graph.get(a);
  if (!c) return replaceRoute(routes.home);
  const track = known(r.track);

  const pending = course.loadExplainer(a);
  if (!pending) return replaceRoute(routes.learn(a));
  const [def, { mountLecture }] = await Promise.all([pending, import('../../lecture/player')]);
  if (!current()) return;
  const locked = learner.status(a) === 'locked';
  const missing = c.prereqs.filter((p) => !learner.record(p).mastered).map((p) => graph.get(p)!.title).join(' and ');
  mountLecture(main, def, {
    back: routes.home,
    kicker: `${course.domainOf(c).title} · Explainer`,
    poster: [course.domainOf(c).title, 'Explainer'],
    artist: `${course.title}: ${c.title}`,
    noun: 'explainer',
    notes: (marks, said) => notationIn(course, a, marks, said),
    // A locked concept cannot be practiced yet, so its explainer ends on what to master first.
    end: locked
      ? { kicker: 'Not yet', title: `Master ${missing} first`, action: 'Back', href: routes.home }
      : { kicker: 'Your turn', title: 'Ready to practice?', action: 'Start practice', href: routes.learn(a, track) },
  });
}
