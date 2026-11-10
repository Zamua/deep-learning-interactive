// Narration saved ahead of time: the explainers the learner is about to reach have sound with no connection. The
// service worker does the saving (src/offline/sw.js); this side only says which tracks, soonest first.
import { COURSES } from '../courses';
import { Learner } from '../mastery/learner';
import { offlineSupported } from './register';
import WIRE from './wire.json';

/** Concepts saved ahead on each track followed. */
const PER_TRACK = 3;

/** The narration of the explainers that come next, soonest first, the courses taking turns. */
export function upcomingNarration(): string[] {
  const rows = COURSES.map((course) => new Learner(course).upcoming(PER_TRACK).map((id) => course.narration(id)).filter(Boolean));
  const out: string[] = [];
  for (let i = 0; rows.some((r) => i < r.length); i++) for (const r of rows) if (r[i]) out.push(new URL(r[i]!, location.href).href);
  return [...new Set(out)];
}

/**
 * Asks the worker to hold the upcoming narration, once there is a worker in charge: on a first visit that is after the
 * page has drawn. The worker waits for the app itself to be saved, and for a connection.
 */
export function saveAhead(): void {
  if (!offlineSupported() || !navigator.onLine) return;
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
  void navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ type: WIRE.ahead, urls: upcomingNarration() })).catch(() => {});
}
