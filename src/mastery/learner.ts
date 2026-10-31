// The learner's side of the course: their records, what each concept's status is, and how an
// answer changes them. Persists through the store, which other devices of the account sync into.
import type { ConceptGraph } from './domain/graph';
import { applyAnswer, emptyRecord, placeMastered, recoveryStreak, status, streak, type ConceptRecord, type Status } from './domain/model';
import { inheritSplits, isUnlocked, newChoices, pickConcept, pickNext, statuses, type NewChoices, type Pick } from './domain/scheduler';
import { track, trackConcepts, type Track } from './domain/tracks';
import type { LogRow } from './snapshot';
import { appendLog, loadPace, loadRecords, loadTracks, saveRecords, saveTrack } from './store';

/** What the learner would do next, for a page to lead with. */
export type Today = {
  /** Reviews due now. */
  due: number;
  /** Epoch ms of the latest answer; 0 before any. */
  t: number;
} & (
  | {
      /** `start`: nothing done yet. `new`: the next concept to begin. `learning`: one under way. */
      kind: 'start' | 'new' | 'learning';
      concept: string;
      /** Right in a row so far, and how many the concept needs. */
      streak: number;
      need: number;
      /** Concepts that open once this one is mastered. */
      opens: string[];
      /** It slipped on a review and is being won back. */
      slipping: boolean;
    }
  | {
      kind: 'review';
      concept: string;
      /** What to learn once the reviews are done. */
      after?: string;
    }
  | {
      /** Nothing to learn and nothing due. */
      kind: 'done';
      nextReview?: number;
    }
);

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

  /** `track`: the target of the track a session follows. */
  next(last?: string, session: { focus?: string; reviewed?: ReadonlySet<string>; track?: string } = {}): Pick | null {
    const { track: t, ...rest } = session;
    return pickNext({ graph: this.graph, records: this.records, now: this.clock(), last, pace: loadPace(), ...rest, within: this.within(t) });
  }

  /** The problem for a concept the learner chose; null while it is locked or unknown. */
  pick(id: string): Pick | null {
    return this.graph.get(id) ? pickConcept({ graph: this.graph, records: this.records, now: this.clock() }, id) : null;
  }

  /** The ways to go on to something new, and every concept open to start. */
  choices(): NewChoices {
    return newChoices(this.graph, this.records, this.clock());
  }

  /** The concept to learn next, leaving reviews aside: what a mastery leads on to. */
  nextToLearn(last?: string, track?: string): string | undefined {
    return pickNext({ graph: this.graph, records: this.records, now: this.clock(), last, pace: loadPace(), learnOnly: true, within: this.within(track) })?.concept;
  }

  private within(target?: string): Set<string> | undefined {
    return target && this.graph.get(target) ? new Set(trackConcepts(this.graph, target)) : undefined;
  }

  /** Targets of the tracks followed, oldest first; one whose concept left the course is skipped. */
  get trackTargets(): string[] {
    return loadTracks().filter((id) => this.graph.get(id));
  }

  /** `explainer` gives the seconds of a concept's explainer not yet heard; a concept already practiced needs none. */
  track(target: string, explainer: (id: string) => number): Track {
    return track(this.graph, this.records, this.clock(), target, loadPace(), (id) => (this.record(id).attempts ? 0 : explainer(id)));
  }

  follow(target: string, on = true): void {
    saveTrack(target, on);
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
      slipping: pick.reason === 'slipping',
      due,
      t,
    };
  }

  /** Placement: marks concepts mastered, with an early review to confirm it. */
  place(ids: readonly string[]): void {
    const now = this.clock();
    saveRecords(Object.fromEntries(ids.map((id) => [id, placeMastered(this.record(id), now)] as const).filter(([id, r]) => r !== this.records[id])));
  }
}
