// The learner's side of the course: their records, what each concept's status is, and how an
// answer changes them. Persists through the store.
import type { ConceptGraph } from './domain/graph';
import { applyAnswer, emptyRecord, placeMastered, recoveryStreak, status, streak, type ConceptRecord, type Status } from './domain/model';
import { isUnlocked, pickNext, statuses, type Pick } from './domain/scheduler';

/** What the learner would do next, for a page to lead with. */
export interface Today {
  /** `start`: nothing done yet. `done`: nothing to learn and nothing due. */
  kind: 'start' | 'learning' | 'new' | 'review' | 'done';
  concept?: string;
  /** Right in a row so far, and how many the concept needs. */
  streak?: number;
  need?: number;
  /** Concepts that open once this one is mastered. */
  opens?: string[];
  /** Reviews due now. */
  due: number;
  /** When the next review falls due, for `done`. */
  nextReview?: number;
  /** Epoch ms of the latest answer; 0 before any. */
  t: number;
}
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

  today(): Today {
    const st = this.statuses();
    const due = [...st.values()].filter((s) => s === 'due' || s === 'slipping').length;
    const t = Math.max(0, ...Object.values(this.records).map((r) => r.last));
    // Never a random review here: the page leads with the concept in progress, or the next one.
    const pick = pickNext({ graph: this.graph, records: this.records, now: this.clock(), rand: () => 1 });
    if (!pick) {
      const next = Math.min(...Object.values(this.records).map((r) => r.review?.due ?? Infinity));
      return { kind: 'done', due, t, nextReview: Number.isFinite(next) ? next : undefined };
    }
    const c = this.graph.get(pick.concept)!;
    const opens = this.graph.dependents.get(c.id)!.filter((d) => this.graph.get(d)!.prereqs.every((p) => p === c.id || this.record(p).mastered));
    if (pick.reason === 'review') return { kind: 'review', concept: c.id, due, t };
    const learning = pick.reason === 'learning' || pick.reason === 'slipping';
    return {
      kind: learning ? 'learning' : t ? 'new' : 'start',
      concept: c.id,
      streak: streak(this.record(c.id)),
      need: pick.reason === 'slipping' ? recoveryStreak(c.mastery) : c.mastery.streak,
      opens,
      due,
      t,
    };
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
