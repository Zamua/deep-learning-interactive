// Saving whole courses' narration for offline use, from the settings menu. The service worker does the downloading
// (src/offline/sw.js) and keeps going while any page is open; this side asks, checks there is room first, and nudges
// the worker when a download was cut short (a closed app, a worker the browser stopped, a lost connection).
import { courseNarration } from './catalog';
import { offlineStatus, offlineSupported, type OfflineStatus } from './register';
import { saveAhead } from './ahead';
import WIRE from './wire.json';

const post = (msg: object) => navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ ...msg, courses: courseNarration() }));

/** Room left for this site, in bytes, or Infinity when the browser does not say. */
async function room(): Promise<number> {
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  return est?.quota ? est.quota - (est.usage ?? 0) : Infinity;
}

/** Starts saving the narration of `ids`; returns the bytes missing when there is not room for it, else 0. */
export async function saveCourses(ids: string[], st: OfflineStatus): Promise<number> {
  const need = ids.reduce((n, id) => n + (st.courses[id] ? st.courses[id].bytes - st.courses[id].heldBytes : 0), 0);
  const free = await room();
  if (need > free) return need - free;
  void navigator.storage?.persist?.().catch(() => false);
  await post({ type: WIRE.save, ids });
  return 0;
}

export const stopSaving = (ids: string[]) => post({ type: WIRE.stop, ids });

export const dropCourses = (ids: string[]) => post({ type: WIRE.drop, ids });

/** Calls `fn` whenever the worker says what is saved changed; returns the unsubscribe. */
export function onSavedChange(fn: () => void): () => void {
  if (!offlineSupported()) return () => {};
  const on = (m: MessageEvent) => {
    if ((m.data as { type?: string })?.type === WIRE.progress) fn();
  };
  navigator.serviceWorker.addEventListener('message', on);
  return () => navigator.serviceWorker.removeEventListener('message', on);
}

/** Whether a kept course is still missing narration and nothing is saving it, with room to save it. */
const stalled = (st: OfflineStatus | null) => !!st && !st.saving && st.problem !== 'full' && Object.values(st.courses ?? {}).some((c) => c.kept && c.held < c.tracks);

/** Keeps saved courses whole: on return to the app, and twice a minute while one is incomplete and nothing saves it. */
export function keepCoursesSaved(): void {
  if (!offlineSupported()) return;
  const nudge = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) void offlineStatus().then((st) => stalled(st) && saveAhead());
  };
  document.addEventListener('visibilitychange', nudge);
  window.setInterval(nudge, 30_000);
}
