/** The player's settings on this device. */
export interface Prefs {
  rate?: number;
  cc?: boolean;
  /** The viewer has locked a boost. */
  locked?: boolean;
  /** Boosting holds counted toward the slide-to-lock hint. */
  holds?: number;
}

/** Where the prefs are kept: a store whose writes may fail without saying so. */
export interface PrefStore {
  get(k: string): string | null;
  set(k: string, v: string): void;
  remove(k: string): void;
}

/** The prefs as read at mount, kept current; `keep` applies a change and stores them. */
export interface PrefsRef {
  readonly now: Readonly<Prefs>;
  keep(patch: Partial<Prefs>): void;
}

/** Outside the legacy prefixes `src/sync/model.ts` folds in, so a write here runs no fold. */
const KEY = 'atlas.lecture.prefs';
/** The key older builds wrote. */
const OLD_KEY = 'cs231n.lec.prefs';

function parse(raw: string | null): Prefs {
  let v: unknown;
  try {
    v = JSON.parse(raw ?? '{}');
  } catch {
    return {};
  }
  if (typeof v !== 'object' || v === null) return {};
  const o = v as Record<string, unknown>;
  const p: Prefs = {};
  if (typeof o.rate === 'number') p.rate = o.rate;
  if (typeof o.cc === 'boolean') p.cc = o.cc;
  if (typeof o.locked === 'boolean') p.locked = o.locked;
  if (typeof o.holds === 'number') p.holds = o.holds;
  return p;
}

/** Reads the prefs, moving them from the old key the first time. */
export function openPrefs(st: PrefStore): PrefsRef {
  let raw = st.get(KEY);
  if (raw === null) {
    raw = st.get(OLD_KEY);
    if (raw !== null) {
      st.set(KEY, raw);
      // A write that failed (storage full) keeps the old key, to move on a later visit.
      if (st.get(KEY) === raw) st.remove(OLD_KEY);
    }
  }
  const now = parse(raw);
  return {
    now,
    keep(patch) {
      Object.assign(now, patch);
      st.set(KEY, JSON.stringify(now));
    },
  };
}
