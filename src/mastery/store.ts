// The learner's mastery data: one record per concept, kept in the synced progress store, and an answer log kept on
// this device.
import { editProgress, progressStore } from '../sync/cloud';
import { concepts, paceOf, putConcepts, putPace, putTrack, trackList } from '../sync/model';
import type { Course } from '../courses/course';
import type { ConceptRecord } from './domain/model';
import type { Pace } from './domain/scheduler';
import { isLogRow, snapshotFrom, type LogRow, type Snapshot } from './snapshot';
import { getJson, setJson } from '../core/storage';

/** Log rows kept per course; older ones are dropped first. */
const LOG_CAP = 5000;


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

/** A course's answer log on this device, under its `logKey`. */
export function loadLog(key: string): LogRow[] {
  const v = getJson(key);
  return Array.isArray(v) ? v.filter(isLogRow) : [];
}

export function appendLog(key: string, row: LogRow): void {
  setJson(key, [...loadLog(key), row].slice(-LOG_CAP));
}

/** The courses a progress file covers: where each one's answers are kept, and which concepts are its own. */
type LogOwner = Pick<Course, 'logKey' | 'owns'>;

export function exportSnapshot(courses: readonly LogOwner[]): Snapshot {
  return { version: 1, records: loadRecords(), log: courses.flatMap((c) => loadLog(c.logKey)).sort((a, b) => a[0] - b[0]) };
}

/** Adds a progress file's records as this device's latest edits, and takes its log; throws on anything that is not one. */
export function importSnapshot(text: string, courses: readonly LogOwner[]): void {
  const s = snapshotFrom(text);
  saveRecords(s.records);
  for (const c of courses) setJson(c.logKey, s.log.filter((row) => c.owns(row[1])).slice(-LOG_CAP));
}
