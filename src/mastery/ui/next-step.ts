// The one answer to "what next", which every page reads: reviews first, then the concept under way, then the next
// concept along the chapters or, when a goal is set, along the goal.
import { watched } from '../../lecture/progress';
import type { Concept } from '../domain/types';
import { trackConcepts } from '../domain/tracks';
import type { Learner } from '../learner';

export const explainerId = (concept: string) => `atlas-${concept}`;

export type Step =
  | { kind: 'review'; due: number; then?: string }
  | { kind: 'start' | 'resume' | 'win-back' | 'next'; concept: string; streak: number; need: number; goal?: string }
  | { kind: 'done'; nextReview?: number };

/** The chapters in order, each in graph order: the line a book teaches along. */
export function tour(learner: Learner): Concept[] {
  const { course, graph } = learner;
  return course.domains.flatMap((d) => graph.order.filter((c) => c.domain === d.id));
}

/** The goal the book leads with: the first one set that still has something to learn. */
export function leadGoal(learner: Learner): { target: string; next: string } | null {
  for (const target of learner.trackTargets) {
    const next = trackConcepts(learner.graph, target).find((id) => {
      const s = learner.status(id);
      return s === 'new' || s === 'learning';
    });
    if (next) return { target, next };
  }
  return null;
}

/** The next concept to begin: along the lead goal when there is one, else the first open one on the tour. */
function nextOpen(learner: Learner): { concept: string; goal?: string } | null {
  const goal = leadGoal(learner);
  if (goal) return { concept: goal.next, goal: goal.target };
  const open = tour(learner).find((c) => learner.status(c.id) === 'new');
  return open ? { concept: open.id } : null;
}

export function nextStep(learner: Learner): Step {
  const today = learner.today();
  if (today.kind === 'review') return { kind: 'review', due: today.due, then: afterReviews(learner, today.after) };
  if (today.kind === 'learning') return { kind: today.slipping ? 'win-back' : 'resume', concept: today.concept, streak: today.streak, need: today.need };
  const open = nextOpen(learner);
  if (!open) return today.kind === 'done' ? { kind: 'done', nextReview: today.nextReview } : { kind: 'done' };
  const need = learner.graph.get(open.concept)!.mastery.streak;
  return { kind: today.kind === 'start' ? 'start' : 'next', concept: open.concept, streak: 0, need, goal: open.goal };
}

/** The concept the reviews lead back to: the one under way, else the next to begin. */
function afterReviews(learner: Learner, after?: string): string | undefined {
  return after && learner.status(after) === 'learning' ? after : nextOpen(learner)?.concept;
}

/** Where one concept's step begins: its explainer the first time, then practice. */
export function stepHref(learner: Learner, id: string): string {
  const pages = learner.course.routes;
  const fresh = !learner.record(id).attempts && !learner.record(id).mastered && !watched(explainerId(id));
  return learner.course.hasExplainer(id) && fresh ? pages.watch(id) : pages.learn(id);
}
