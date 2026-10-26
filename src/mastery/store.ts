// The learner's mastery data: one record per concept, kept in the synced progress store, and an answer log kept on
// this device.
import { editProgress, progressStore } from '../sync/cloud';
import { conceptFrom, concepts, putConcepts } from '../sync/model';
import type { ConceptRecord } from './domain/model';

const LOG_KEY = 'atlas.log';
/** Log rows kept; older ones are dropped first. */
const LOG_CAP = 5000;

/** One answer: epoch ms, concept, generator, correct, milliseconds, and 1 if assisted. */
export type LogRow = [t: number, concept: string, generator: string, ok: 0 | 1, ms: number, help?: 1];

export interface Snapshot {
  version: 1;
  records: Record<string, ConceptRecord>;
  log: LogRow[];
}

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

function cleanRecords(v: unknown): Record<string, ConceptRecord> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, ConceptRecord> = {};
  for (const [id, raw] of Object.entries(v)) {
    const r = conceptFrom(raw);
    if (r) out[id] = r;
  }
  return out;
}

/** Every concept's record; the same object until one changes. */
export function loadRecords(): Record<string, ConceptRecord> {
  return concepts(progressStore().store);
}

/** Saves these concepts' records; the others are left as they are. */
export function saveRecords(records: Record<string, ConceptRecord>): void {
  if (Object.keys(records).length) editProgress((s, now) => putConcepts(s, now, records));
}

export function loadLog(): LogRow[] {
  const v = read(LOG_KEY);
  return Array.isArray(v) ? (v as LogRow[]) : [];
}

export function appendLog(row: LogRow): void {
  write(LOG_KEY, [...loadLog(), row].slice(-LOG_CAP));
}

export function exportSnapshot(): Snapshot {
  return { version: 1, records: loadRecords(), log: loadLog() };
}

/** Adds a snapshot's records as this device's latest edits, and takes its log; throws on anything that is not one. */
export function importSnapshot(json: string): void {
  const s = JSON.parse(json) as Partial<Snapshot>;
  if (s.version !== 1 || !s.records || !Array.isArray(s.log)) throw new Error('not an Atlas progress file');
  saveRecords(cleanRecords(s.records));
  write(LOG_KEY, s.log.slice(-LOG_CAP));
}
