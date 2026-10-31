// A progress file: the learner's records and answer log, saved outside the account and loaded back.
import { isObj } from 'hearthsync';
import { conceptFrom } from '../sync/model';
import type { ConceptRecord } from './domain/model';

/** One answer: epoch ms, concept, generator, correct, milliseconds, and 1 if assisted. */
export type LogRow = [t: number, concept: string, generator: string, ok: 0 | 1, ms: number, help?: 1];

export interface Snapshot {
  version: 1;
  records: Record<string, ConceptRecord>;
  log: LogRow[];
}

const NOT_A_FILE = 'This is not an Atlas progress file.';

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const isLogRow = (v: unknown): v is LogRow =>
  Array.isArray(v) && (v.length === 5 || (v.length === 6 && v[5] === 1)) && num(v[0]) && typeof v[1] === 'string' && typeof v[2] === 'string' && (v[3] === 0 || v[3] === 1) && num(v[4]);

/** The records that read as concept records; the rest are dropped. */
function recordsFrom(v: unknown): Record<string, ConceptRecord> {
  const out: Record<string, ConceptRecord> = {};
  if (!isObj(v)) return out;
  for (const [id, raw] of Object.entries(v)) {
    const r = conceptFrom(raw);
    if (r) out[id] = r;
  }
  return out;
}

/** Reads a progress file's text; throws an error fit to show the learner when it is not one. */
export function snapshotFrom(text: string): Snapshot {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error(NOT_A_FILE);
  }
  if (!isObj(v) || v.version !== 1 || !isObj(v.records) || !Array.isArray(v.log)) throw new Error(NOT_A_FILE);
  return { version: 1, records: recordsFrom(v.records), log: v.log.filter(isLogRow) };
}
