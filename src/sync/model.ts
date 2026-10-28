// The learner's progress as account records: mastery, lecture and explainer playback, how far each chapter was read,
// and what was open last. Each merges as a CRDT, so devices converge whatever order their edits arrive in. Pure: the
// store and the network are hearthsync's.
import { UNTIMED, canon, hash, importRecords, isObj, isStamp, lww, lwwOpt, putRecord, regFrom, type Fold, type Kind, type LocalStore, type Model, type Reg, type Stamp } from 'hearthsync';
import type { Attempt, ConceptRecord, Review } from '../mastery/domain/model';
import type { Pace } from '../mastery/domain/scheduler';

/** A concept's record and the stamp of its last edit. */
export interface ConceptEntry { t: Stamp; r: ConceptRecord }
export interface MasteryBucket { c: Readonly<Record<string, ConceptEntry>> }

/** Where to resume, and the narration length its heard flags were laid out for. */
export interface Place { at: number; dur: number }
/** A lecture's resume point, and per narration length a base64 bitset of the stretches heard. */
export interface LectureEntry { pos: Reg<Place>; heard: Readonly<Record<string, string>> }
export interface LectureBucket { l: Readonly<Record<string, LectureEntry>> }

/** Furthest share of a chapter on screen, and the section last scrolled past. */
export interface ReadEntry { max: number; at: Reg<string> }
export interface Reading { ch: Readonly<Record<string, ReadEntry>> }

export interface Seen { kind: 'lecture' | 'chapter'; id: string; t: number }
export interface LastSeen { at: Reg<Seen | null> }

/** The learner's choices that follow them across devices. */
export interface Prefs { pace?: Reg<Pace> }

/** Atlas tracks by target concept: when each was added, 0 once removed. */
export interface Tracks { on: Readonly<Record<string, Reg<number>>> }

export type Rec = MasteryBucket | LectureBucket | Reading | LastSeen | Prefs | Tracks;

/** Records spread over a few keys, so an upload carries a slice of them and a room stays far under its key cap. */
const MASTERY_KEYS = 8;
const LECTURE_KEYS = 4;
export const READING_KEY = 'reading';
export const LAST_KEY = 'last';
export const PREFS_KEY = 'prefs';
export const TRACKS_KEY = 'tracks';

/** FNV-1a: a stable slot for an id, whatever build or device computes it. */
function slot(id: string, n: number): number {
  let x = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) x = Math.imul(x ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return x % n;
}
export const masteryKey = (id: string): string => `mastery/${slot(id, MASTERY_KEYS)}`;
export const lectureKey = (id: string): string => `lectures/${slot(id, LECTURE_KEYS)}`;

const ID = /^[a-z0-9][a-z0-9._/-]{0,79}$/;
const DUR = /^\d{1,6}(\.\d{1,6})?$/;
/** Bounds what a room can make a device hold; no real record comes near these. */
const MAX_ENTRIES = 512;
const MAX_RECENT = 50;
const MAX_DURS = 16;
const MAX_BITS = 8192;

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const sorted = <V>(o: Readonly<Record<string, V>>): Record<string, V> => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]!]));

function mergeMap<V>(a: Readonly<Record<string, V>>, b: Readonly<Record<string, V>>, f: (x: V, y: V) => V): Record<string, V> {
  const out: Record<string, V> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Object.hasOwn(out, k) ? f(out[k]!, v) : v;
  return sorted(out);
}

/** The well formed entries of a map read from untrusted JSON, each repaired by `f`. */
function mapFrom<V>(raw: unknown, key: RegExp, f: (v: unknown) => V | null): Record<string, V> {
  if (!isObj(raw)) return {};
  const out: Record<string, V> = {};
  for (const [k, v] of Object.entries(raw).slice(0, MAX_ENTRIES)) {
    const r = key.test(k) ? f(v) : null;
    if (r !== null) out[k] = r;
  }
  return sorted(out);
}

// Mastery.

function attemptFrom(x: unknown): Attempt | null {
  if (!isObj(x) || typeof x.ok !== 'boolean' || !num(x.t) || x.t < 0 || (x.help !== undefined && typeof x.help !== 'boolean')) return null;
  return { ok: x.ok, t: x.t, ...(x.help ? { help: true } : {}) };
}

function reviewFrom(x: unknown): Review | null {
  if (!isObj(x) || !num(x.due) || !num(x.interval) || !num(x.ease) || !num(x.passed)) return null;
  return { due: x.due, interval: x.interval, ease: x.ease, passed: x.passed };
}

export function conceptFrom(x: unknown): ConceptRecord | null {
  if (!isObj(x) || !num(x.attempts) || !num(x.correct) || !Array.isArray(x.recent) || typeof x.mastered !== 'boolean' || typeof x.slipping !== 'boolean' || !num(x.last)) return null;
  const recent = x.recent.slice(-MAX_RECENT).map(attemptFrom);
  const review = x.review === null ? null : reviewFrom(x.review);
  if (recent.some((a) => a === null) || (x.review !== null && review === null)) return null;
  return { attempts: x.attempts, correct: x.correct, recent: recent as Attempt[], mastered: x.mastered, slipping: x.slipping, review, last: x.last };
}

const entryFrom = (x: unknown): ConceptEntry | null => {
  if (!isObj(x) || !isStamp(x.t)) return null;
  const r = conceptFrom(x.r);
  return r && { t: x.t, r };
};

/** A mastered record never loses to one that is not, so a concept never locks again; otherwise the later edit wins. */
export function laterConcept(a: ConceptEntry, b: ConceptEntry): ConceptEntry {
  if (a.r.mastered !== b.r.mastered) return a.r.mastered ? a : b;
  if (a.t !== b.t) return a.t > b.t ? a : b;
  return canon(a.r) >= canon(b.r) ? a : b;
}

const mastery: Kind<Rec> = {
  from: (raw) => (isObj(raw) ? { c: mapFrom(raw.c, ID, entryFrom) } : null),
  merge: (a, b) => ({ c: mergeMap((a as MasteryBucket).c, (b as MasteryBucket).c, laterConcept) }),
  stamp: (r) => Math.max(0, ...Object.values((r as MasteryBucket).c).map((e) => e.t)),
};

// Lectures and explainers.

const bytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const b64 = (b: Uint8Array): string => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};

/** Stretches heard on either device. */
export function orBits(a: string, b: string): string {
  if (a === b) return a;
  const x = bytes(a), y = bytes(b), out = new Uint8Array(Math.max(x.length, y.length));
  for (let i = 0; i < out.length; i++) out[i] = (x[i] ?? 0) | (y[i] ?? 0);
  return b64(out);
}

const bitsFrom = (x: unknown): string | null => {
  if (typeof x !== 'string' || x.length > MAX_BITS) return null;
  try {
    return b64(bytes(x));
  } catch {
    return null;
  }
};

const placeFrom = (x: unknown): Place | null => (isObj(x) && num(x.at) && x.at >= 0 && num(x.dur) && x.dur >= 0 ? { at: x.at, dur: x.dur } : null);

const lectureFrom = (x: unknown): LectureEntry | null => {
  if (!isObj(x) || !isObj(x.pos) || !isStamp(x.pos.t)) return null;
  const val = placeFrom(x.pos.val);
  if (!val) return null;
  return { pos: { val, t: x.pos.t }, heard: Object.fromEntries(Object.entries(mapFrom(x.heard, DUR, bitsFrom)).slice(0, MAX_DURS)) };
};

const mergeLecture = (a: LectureEntry, b: LectureEntry): LectureEntry => ({ pos: lww(a.pos, b.pos), heard: mergeMap(a.heard, b.heard, orBits) });

const lectures: Kind<Rec> = {
  from: (raw) => (isObj(raw) ? { l: mapFrom(raw.l, ID, lectureFrom) } : null),
  merge: (a, b) => ({ l: mergeMap((a as LectureBucket).l, (b as LectureBucket).l, mergeLecture) }),
  stamp: (r) => Math.max(0, ...Object.values((r as LectureBucket).l).map((e) => e.pos.t)),
};

// Chapters, and what was open last.

const readFrom = (x: unknown): ReadEntry | null => {
  if (!isObj(x) || !num(x.max) || x.max < 0 || x.max > 1 || !isObj(x.at) || !isStamp(x.at.t) || typeof x.at.val !== 'string' || x.at.val.length > 120) return null;
  return { max: x.max, at: { val: x.at.val, t: x.at.t } };
};

const reading: Kind<Rec> = {
  from: (raw) => (isObj(raw) ? { ch: mapFrom(raw.ch, ID, readFrom) } : null),
  merge: (a, b) => ({ ch: mergeMap((a as Reading).ch, (b as Reading).ch, (x, y) => ({ max: Math.max(x.max, y.max), at: lww(x.at, y.at) })) }),
  stamp: (r) => Math.max(0, ...Object.values((r as Reading).ch).map((e) => e.at.t)),
};

const seenFrom = (x: unknown): Seen | null =>
  isObj(x) && (x.kind === 'lecture' || x.kind === 'chapter') && typeof x.id === 'string' && ID.test(x.id) && num(x.t) ? { kind: x.kind, id: x.id, t: x.t } : null;

const last: Kind<Rec> = {
  from: (raw) => {
    if (!isObj(raw) || !isObj(raw.at) || !isStamp(raw.at.t)) return null;
    const val = raw.at.val === null ? null : seenFrom(raw.at.val);
    return val === null && raw.at.val !== null ? null : { at: { val, t: raw.at.t } };
  },
  merge: (a, b) => ({ at: lww((a as LastSeen).at, (b as LastSeen).at) }),
  stamp: (r) => (r as LastSeen).at.t,
};

const isPace = (x: unknown): x is Pace => x === 'deep' || x === 'broad';

const prefs: Kind<Rec> = {
  from: (raw) => {
    if (!isObj(raw)) return null;
    const pace = regFrom(raw.pace, isPace);
    return pace ? { pace } : {};
  },
  merge: (a, b) => {
    const pace = lwwOpt((a as Prefs).pace, (b as Prefs).pace);
    return pace ? { pace } : {};
  },
  stamp: (r) => (r as Prefs).pace?.t ?? 0,
};

const isAdded = (x: unknown): x is number => num(x) && x >= 0;

const tracks: Kind<Rec> = {
  from: (raw) => (isObj(raw) ? { on: mapFrom(raw.on, ID, (v) => regFrom(v, isAdded)) } : null),
  merge: (a, b) => ({ on: mergeMap((a as Tracks).on, (b as Tracks).on, lww) }),
  stamp: (r) => Math.max(0, ...Object.values((r as Tracks).on).map((e) => e.t)),
};

const MASTERY_KEY = /^mastery\/\d$/;
const LECTURE_KEY = /^lectures\/\d$/;

/** The model without its migration: enough for reading and editing a store. */
export const MODEL: Model<Rec> = {
  prefix: 'progress.v2.',
  salt: 'deep-learning-interactive/public/',
  qrPrefix: 'DLI',
  kind: (key) => (MASTERY_KEY.test(key) ? mastery : LECTURE_KEY.test(key) ? lectures : key === READING_KEY ? reading : key === LAST_KEY ? last : key === PREFS_KEY ? prefs : key === TRACKS_KEY ? tracks : null),
};

export type Store = LocalStore<Rec>;

// Reading and editing the store.

const views = new WeakMap<object, Record<string, ConceptRecord>>();
const NONE: Record<string, ConceptRecord> = Object.freeze({}) as Record<string, ConceptRecord>;

/** Every concept's record; the same object until a mastery record changes. */
export const concepts = (s: Store): Record<string, ConceptRecord> => conceptsIn(s.records);

/** Every concept's record among records read from a store or a room. */
export function conceptsIn(records: Readonly<Record<string, Rec>>): Record<string, ConceptRecord> {
  const parts = Object.keys(records).filter((k) => MASTERY_KEY.test(k)).sort().map((k) => records[k] as MasteryBucket);
  if (!parts.length) return NONE;
  const hit = views.get(parts[0]!);
  if (hit && parts.every((p) => views.get(p) === hit)) return hit;
  const out: Record<string, ConceptRecord> = {};
  for (const b of parts) for (const [id, e] of Object.entries(b.c)) out[id] = e.r;
  for (const b of parts) views.set(b, out);
  return out;
}

/** Writes these concepts' records as this device's latest edit of each. */
export function putConcepts(s: Store, now: number, recs: Readonly<Record<string, ConceptRecord>>): Store {
  const byKey = new Map<string, [string, ConceptRecord][]>();
  for (const [id, r] of Object.entries(recs)) byKey.set(masteryKey(id), [...(byKey.get(masteryKey(id)) ?? []), [id, r]]);
  let out = s;
  for (const [key, list] of byKey) {
    out = putRecord(MODEL, out, key, now, (held, t) => {
      const c = { ...((held as MasteryBucket | null)?.c ?? {}) };
      for (const [id, r] of list) c[id] = { t, r };
      return { c: sorted(c) };
    }).store;
  }
  return out;
}

export const lecture = (s: Store, id: string): LectureEntry | undefined => (s.records[lectureKey(id)] as LectureBucket | undefined)?.l[id];

/** A lecture's resume point, and the stretches heard of narration `dur` seconds long (added to those held). */
export function putLecture(s: Store, now: number, id: string, at: number, dur: number, bits: string): Store {
  return putRecord(MODEL, s, lectureKey(id), now, (held, t) => {
    const l = (held as LectureBucket | null)?.l ?? {};
    const had = l[id]?.heard ?? {}, d = String(dur);
    const heard = sorted({ ...had, [d]: had[d] ? orBits(had[d], bits) : bits });
    return { l: sorted({ ...l, [id]: { pos: { val: { at, dur }, t }, heard } }) };
  }).store;
}

export const readEntry = (s: Store, id: string): ReadEntry | undefined => (s.records[READING_KEY] as Reading | undefined)?.ch[id];

/** How far a chapter has been read: `max` only grows, `at` follows the viewer. */
export function putReading(s: Store, now: number, id: string, max: number, at: string): Store {
  return putRecord(MODEL, s, READING_KEY, now, (held, t) => {
    const ch = (held as Reading | null)?.ch ?? {};
    return { ch: sorted({ ...ch, [id]: { max: Math.max(ch[id]?.max ?? 0, max), at: { val: at, t } } }) };
  }).store;
}

export const lastSeen = (s: Store): Seen | null => (s.records[LAST_KEY] as LastSeen | undefined)?.at.val ?? null;

export const putLast = (s: Store, now: number, seen: Seen): Store => putRecord(MODEL, s, LAST_KEY, now, (_, t) => ({ at: { val: seen, t } })).store;

export const paceOf = (s: Store): Pace => (s.records[PREFS_KEY] as Prefs | undefined)?.pace?.val ?? 'deep';

export const putPace = (s: Store, now: number, pace: Pace): Store =>
  putRecord(MODEL, s, PREFS_KEY, now, (held, t) => ({ ...(held as Prefs | null), pace: { val: pace, t } })).store;

/** Targets of the tracks the learner follows, oldest first. */
export function trackList(s: Store): string[] {
  const on = (s.records[TRACKS_KEY] as Tracks | undefined)?.on ?? {};
  return Object.keys(on).filter((id) => on[id]!.val > 0).sort((a, b) => on[a]!.val - on[b]!.val || (a < b ? -1 : 1));
}

/** Adds a track, keeping its place if it is already followed, or removes it. */
export function putTrack(s: Store, now: number, target: string, follow: boolean): Store {
  const had = (s.records[TRACKS_KEY] as Tracks | undefined)?.on[target]?.val ?? 0;
  if (follow === had > 0) return s;
  return putRecord(MODEL, s, TRACKS_KEY, now, (held, t) => ({ on: sorted({ ...(held as Tracks | null)?.on, [target]: { val: follow ? now : 0, t } }) })).store;
}

// What builds before sync kept, one localStorage key per item.

const LEGACY = { records: 'atlas.records', last: 'cs231n.last', lec: 'cs231n.lec.', read: 'cs231n.read.' };
const legacyKey = (k: string): boolean => k === LEGACY.records || k === LEGACY.last || k.startsWith(LEGACY.lec) || k.startsWith(LEGACY.read);

const parse = (s: string | null): unknown => {
  try {
    return s === null ? null : (JSON.parse(s) as unknown);
  } catch {
    return null;
  }
};

/** The records those keys hold, at the stamps they carry: a concept at its last answer, the rest older than any edit. */
function legacyRecords(get: (k: string) => string | null, names: readonly string[]): Record<string, Rec> {
  const out: Record<string, Rec> = {};
  const add = (key: string, r: Rec) => (out[key] = out[key] ? MODEL.kind(key)!.merge(out[key]!, r) : r);
  const recs = parse(get(LEGACY.records));
  if (isObj(recs))
    for (const [id, raw] of Object.entries(recs)) {
      const r = ID.test(id) ? conceptFrom(raw) : null;
      if (r) add(masteryKey(id), { c: { [id]: { t: Math.max(UNTIMED, Math.floor(r.last)), r } } });
    }
  for (const name of names) {
    if (name.startsWith(LEGACY.lec)) {
      const id = name.slice(LEGACY.lec.length), raw = get(name);
      if (!ID.test(id) || raw === null) continue;
      const v = /^[\d.]+$/.test(raw) ? { pos: Number(raw) } : parse(raw);
      if (!isObj(v) || !num(v.pos)) continue;
      const dur = num(v.dur) ? v.dur : 0, bits = dur ? bitsFrom(v.heard) : null;
      add(lectureKey(id), { l: { [id]: { pos: { val: { at: Math.max(0, v.pos), dur }, t: UNTIMED }, heard: bits ? { [String(dur)]: bits } : {} } } });
    } else if (name.startsWith(LEGACY.read)) {
      const id = name.slice(LEGACY.read.length), v = parse(get(name));
      if (!ID.test(id) || !isObj(v) || !num(v.max)) continue;
      add(READING_KEY, { ch: { [id]: { max: Math.min(1, Math.max(0, v.max)), at: { val: typeof v.at === 'string' ? v.at.slice(0, 120) : '', t: UNTIMED } } } });
    }
  }
  const seen = seenFrom(parse(get(LEGACY.last)));
  if (seen) add(LAST_KEY, { at: { val: seen, t: Math.max(UNTIMED, Math.floor(seen.t)) } });
  return out;
}

/** Folds the old keys in at boot, and again whenever an older build's tab writes them. `keys` lists storage. */
export function legacyFold(keys: () => string[]): Fold<Rec> {
  return {
    mark: 'legacy',
    reads: legacyKey,
    fold(s, get, last) {
      const names = keys().filter(legacyKey).sort();
      const mark = hash(names.map((k) => [k, get(k)]));
      if (mark === last) return null;
      return { store: importRecords(MODEL, s, legacyRecords(get, names)), mark };
    },
  };
}

export const model = (keys: () => string[]): Model<Rec> => ({ ...MODEL, folds: [legacyFold(keys)] });
