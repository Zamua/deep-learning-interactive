// The learner's mastery data: one record per concept, kept in the synced progress store, and an answer log kept on
// this device.
import { editProgress, progressStore } from '../sync/cloud';
import { concepts, paceOf, putConcepts, putPace, putTrack, trackList } from '../sync/model';
import type { ConceptRecord } from './domain/model';
import type { Pace } from './domain/scheduler';
import { isLogRow, snapshotFrom, type LogRow, type Snapshot } from './snapshot';

const LOG_KEY = 'atlas.log';
/** Log rows kept; older ones are dropped first. */
const LOG_CAP = 5000;

const read = (k: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null') as unknown;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown): void => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode or full: the log lives for this page only */
  }
};

/** Every concept's record; the same object until one changes. */
export function loadRecords(): Record<string, ConceptRecord> {
  return concepts(progressStore().store);
}

/** Saves these concepts' records; the others are left as they are. */
export function saveRecords(records: Record<string, ConceptRecord>): void {
  if (Object.keys(records).length) editProgress((s, now) => putConcepts(s, now, records));
}

/** How new concepts are chosen, as the learner set it on any of their devices. */
export const loadPace = (): Pace => paceOf(progressStore().store);

export function savePace(pace: Pace): void {
  if (pace !== loadPace()) editProgress((s, now) => putPace(s, now, pace));
}

/** Targets of the tracks the learner follows, on any of their devices, oldest first. */
export const loadTracks = (): string[] => trackList(progressStore().store);

export function saveTrack(target: string, follow: boolean): void {
  if (follow !== loadTracks().includes(target)) editProgress((s, now) => putTrack(s, now, target, follow));
}

export function loadLog(): LogRow[] {
  const v = read(LOG_KEY);
  return Array.isArray(v) ? v.filter(isLogRow) : [];
}

export function appendLog(row: LogRow): void {
  write(LOG_KEY, [...loadLog(), row].slice(-LOG_CAP));
}

export function exportSnapshot(): Snapshot {
  return { version: 1, records: loadRecords(), log: loadLog() };
}

/** Adds a progress file's records as this device's latest edits, and takes its log; throws on anything that is not one. */
export function importSnapshot(text: string): void {
  const s = snapshotFrom(text);
  saveRecords(s.records);
  write(LOG_KEY, s.log.slice(-LOG_CAP));
}
