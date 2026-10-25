// The learner's mastery data in localStorage: one record per concept, and an answer log.
import type { ConceptRecord } from './domain/model';

const KEY = { records: 'atlas.records', log: 'atlas.log' };
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
    /* private mode or full: progress lives for this page only */
  }
};

const isRecord = (r: unknown): r is ConceptRecord =>
  !!r && typeof r === 'object' && typeof (r as ConceptRecord).attempts === 'number' && Array.isArray((r as ConceptRecord).recent);

function cleanRecords(v: unknown): Record<string, ConceptRecord> {
  if (!v || typeof v !== 'object') return {};
  return Object.fromEntries(Object.entries(v).filter(([, r]) => isRecord(r))) as Record<string, ConceptRecord>;
}

export function loadRecords(): Record<string, ConceptRecord> {
  return cleanRecords(read(KEY.records));
}

export function saveRecords(records: Record<string, ConceptRecord>): void {
  write(KEY.records, records);
}

export function loadLog(): LogRow[] {
  const v = read(KEY.log);
  return Array.isArray(v) ? (v as LogRow[]) : [];
}

export function appendLog(row: LogRow): void {
  write(KEY.log, [...loadLog(), row].slice(-LOG_CAP));
}

export function exportSnapshot(): Snapshot {
  return { version: 1, records: loadRecords(), log: loadLog() };
}

/** Replaces this device's progress with a snapshot; throws on anything that is not one. */
export function importSnapshot(json: string): void {
  const s = JSON.parse(json) as Partial<Snapshot>;
  if (s.version !== 1 || !s.records || !Array.isArray(s.log)) throw new Error('not an Atlas progress file');
  saveRecords(cleanRecords(s.records));
  write(KEY.log, s.log.slice(-LOG_CAP));
}
