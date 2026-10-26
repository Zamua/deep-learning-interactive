// This device's copy of the learner's progress, and the engine that keeps it in step with their account. Everything
// reads and writes the local store at once; the network only ever backs it up, in the background.
import { Local, Sync, browserEnv, browserStorage, httpRooms, listen, webLock } from 'hearthsync';
import { model, type Rec, type Store } from './model';

let local: Local<Rec> | null = null;
let engine: Sync<Rec> | null = null;

export function progressStore(): Local<Rec> {
  if (!local) {
    const st = browserStorage();
    local = new Local(st, model(() => st.keys()));
  }
  return local;
}

/** An edit of the progress, written to storage before it returns. */
export const editProgress = (f: (s: Store, now: number) => Store): Store => progressStore().edit(f);

/** Starts syncing with the rooms API on this site's own origin. */
export function startSync(): Sync<Rec> {
  if (!engine) {
    const l = progressStore();
    engine = new Sync(l, httpRooms(location.origin, { serverTime: (at, sent, recv) => l.serverTime(at, sent, recv) }), browserEnv(), webLock('progress.sync'));
    listen(engine, l);
    engine.start();
  }
  return engine;
}

/** The running engine; null before startSync, as in tests. */
export const syncEngine = (): Sync<Rec> | null => engine;
