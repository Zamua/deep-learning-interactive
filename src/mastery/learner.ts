// The learner's side of the course: their records, what each concept's status is, and how an
// answer changes them. Persists through the store, which other devices of the account sync into.
import type { ConceptGraph } from './domain/graph';
import { applyAnswer, emptyRecord, placeMastered, recoveryStreak, status, streak, type ConceptRecord, type Status } from './domain/model';
import { inheritSplits, isUnlocked, newChoices, pickNext, statuses, type NewChoices, type Pick } from './domain/scheduler';

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
  /** For `review`: what to learn once the reviews are done. */
  after?: string;
  /** For `learning`: the concept slipped on a review and is being won back. */
  slipping?: boolean;
  /** When the next review falls due, for `done`. */
  nextReview?: number;
  /** Epoch ms of the latest answer; 0 before any. */
  t: number;
}
import { appendLog, loadPace, loadRecords, saveRecords, type LogRow } from './store';

export class Learner {
  constructor(readonly graph: ConceptGraph, private readonly clock: () => number = Date.now) {
    const loaded = loadRecords();
    const next = inheritSplits(graph, loaded, clock());
    if (next !== loaded) saveRecords(Object.fromEntries(Object.entries(next).filter(([id, r]) => loaded[id] !== r)));
  }

  /** As the store holds them now, so records another device synced in show up. */
  get records(): Record<string, ConceptRecord> {
    return loadRecords();
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

  next(last?: string, session: { focus?: string; reviewed?: ReadonlySet<string> } = {}): Pick | null {
    return pickNext({ graph: this.graph, records: this.records, now: this.clock(), last, pace: loadPace(), ...session });
  }

  /** The ways to go on to something new, and every concept open to start. */
  choices(): NewChoices {
    return newChoices(this.graph, this.records, this.clock());
  }

  /** The concept to learn next, leaving reviews aside: what a mastery leads on to. */
  nextToLearn(last?: string): string | undefined {
    return pickNext({ graph: this.graph, records: this.records, now: this.clock(), last, pace: loadPace(), learnOnly: true })?.concept;
  }

  answer(id: string, generator: string, a: { ok: boolean; seconds: number; help?: boolean }): ConceptRecord {
    const now = this.clock();
    const rec = applyAnswer(this.record(id), this.graph.get(id)!.mastery, a, now);
    saveRecords({ [id]: rec });
    const row: LogRow = [now, id, generator, a.ok ? 1 : 0, Math.round(a.seconds * 1000)];
    if (a.help) row.push(1);
    appendLog(row);
    return rec;
  }

  today(): Today {
    const st = this.statuses();
    const due = [...st.values()].filter((s) => s === 'due' || s === 'slipping').length;
    const t = Math.max(0, ...Object.values(this.records).map((r) => r.last));
    const pick = pickNext({ graph: this.graph, records: this.records, now: this.clock(), pace: loadPace() });
    if (!pick) {
      const next = Math.min(...Object.values(this.records).map((r) => r.review?.due ?? Infinity));
      return { kind: 'done', due, t, nextReview: Number.isFinite(next) ? next : undefined };
    }
    const c = this.graph.get(pick.concept)!;
    const opens = this.graph.dependents.get(c.id)!.filter((d) => this.graph.get(d)!.prereqs.every((p) => p === c.id || this.record(p).mastered));
    if (pick.reason === 'review') return { kind: 'review', concept: c.id, due, after: this.nextToLearn(), t };
    const learning = pick.reason === 'learning' || pick.reason === 'slipping' || pick.reason === 'refresh';
    return {
      kind: learning ? 'learning' : t ? 'new' : 'start',
      concept: c.id,
      streak: streak(this.record(c.id)),
      need: pick.reason === 'slipping' ? recoveryStreak(c.mastery) : c.mastery.streak,
      opens,
      due,
      ...(pick.reason === 'slipping' ? { slipping: true } : {}),
      t,
    };
  }

  /** Placement: marks concepts mastered, with an early review to confirm it. */
  place(ids: readonly string[]): void {
    const now = this.clock();
    saveRecords(Object.fromEntries(ids.map((id) => [id, placeMastered(this.record(id), now)] as const).filter(([id, r]) => r !== this.records[id])));
  }
}
