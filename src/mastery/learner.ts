// The learner's side of the course: their records, what each concept's status is, and how an
// answer changes them. Persists through the store.
import type { ConceptGraph } from './domain/graph';
import { applyAnswer, emptyRecord, placeMastered, status, type ConceptRecord, type Status } from './domain/model';
import { isUnlocked, pickNext, statuses, type Pick } from './domain/scheduler';
import { appendLog, loadRecords, saveRecords, type LogRow } from './store';

export class Learner {
  records: Record<string, ConceptRecord>;

  constructor(readonly graph: ConceptGraph, private readonly clock: () => number = Date.now) {
    this.records = loadRecords();
  }

  status(id: string): Status {
    return status(this.records[id], isUnlocked(this.graph, this.records, id), this.clock());
  }

  statuses(): Map<string, Status> {
    return statuses(this.graph, this.records, this.clock());
  }

  record(id: string): ConceptRecord {
    return this.records[id] ?? emptyRecord();
  }

  next(last?: string): Pick | null {
    return pickNext({ graph: this.graph, records: this.records, now: this.clock(), last, rand: Math.random });
  }

  answer(id: string, generator: string, a: { ok: boolean; seconds: number; help?: boolean }): ConceptRecord {
    const now = this.clock();
    const rec = applyAnswer(this.record(id), this.graph.get(id)!.mastery, a, now);
    this.records = { ...this.records, [id]: rec };
    saveRecords(this.records);
    const row: LogRow = [now, id, generator, a.ok ? 1 : 0, Math.round(a.seconds * 1000)];
    if (a.help) row.push(1);
    appendLog(row);
    return rec;
  }

  /** Placement: marks concepts mastered, with an early review to confirm it. */
  place(ids: readonly string[]): void {
    const now = this.clock();
    const next = { ...this.records };
    for (const id of ids) next[id] = placeMastered(next[id] ?? emptyRecord(), now);
    this.records = next;
    saveRecords(this.records);
  }
}
