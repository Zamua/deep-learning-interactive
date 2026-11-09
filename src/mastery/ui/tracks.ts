// What the Goals view says about a goal: how far along it is, and about how long the rest takes.
import { lectureState } from '../../lecture/progress';
import type { Track } from '../domain/tracks';
import type { Learner } from '../learner';
import { explainerId } from './next-step';

const heard = (id: string): number => lectureState(explainerId(id))?.heard ?? 0;

/** A track as it stands, with the explainers' unheard minutes in its estimate. */
export const trackOf = (learner: Learner, target: string): Track => learner.track(target, (id) => learner.course.explainerSeconds(id) * (1 - Math.min(1, heard(id))));

/** "2 h 50 min", to the nearest five minutes. */
export function duration(seconds: number): string {
  const m = Math.max(5, Math.round(seconds / 300) * 5);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}
