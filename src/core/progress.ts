// The learner's progress through lectures and chapters: where each lecture stands and which parts of it were heard,
// how far each chapter was read, and what the viewer did last. Kept in the synced progress store.
import { editProgress, progressStore } from '../sync/cloud';
import { lastSeen, lecture, putLast, putLecture, putReading, readEntry, type Seen } from '../sync/model';

/** Seconds of narration per heard flag. */
const BUCKET = 2;
/** Share of a lecture heard, or of a chapter scrolled past, that counts as finished. */
export const DONE = 0.9;

interface ReadRec {
  /** Furthest share of the chapter that has been on screen, 0..1. */
  max: number;
  /** The section heading last scrolled past, for resuming. */
  at: string;
}

export type Last = Seen;

const heardBits = (id: string, dur: number): Uint8Array => {
  const out = new Uint8Array(Math.ceil(dur / BUCKET / 8));
  const b64 = lecture(progressStore().store, id)?.heard[String(dur)];
  if (b64) {
    const b = atob(b64);
    for (let i = 0; i < Math.min(b.length, out.length); i++) out[i] = b.charCodeAt(i);
  }
  return out;
};

/** A lecture's saved place and heard time, for the player to update as it plays. */
export class LectureLog {
  pos: number;
  private bits: Uint8Array;

  constructor(readonly id: string, readonly dur: number) {
    this.pos = lecture(progressStore().store, id)?.pos.val.at ?? 0;
    this.bits = heardBits(id, dur);
  }

  /** Marks [from, to) as heard; a bucket counts once playback reaches half of it. */
  hear(from: number, to: number): void {
    for (let i = Math.round(from / BUCKET); i < Math.round(to / BUCKET); i++) {
      if (i >= 0 && i < this.bits.length * 8) this.bits[i >> 3]! |= 1 << (i & 7);
    }
  }

  /** Share of [from, to) heard; the whole lecture by default. */
  heardIn(from = 0, to = this.dur): number {
    const a = Math.floor(from / BUCKET);
    const z = Math.max(a + 1, Math.ceil(to / BUCKET));
    let n = 0;
    for (let i = a; i < z; i++) if (this.bits[i >> 3]! & (1 << (i & 7))) n++;
    return n / (z - a);
  }

  save(pos: number): void {
    this.pos = pos > 8 && pos < this.dur - 8 ? Math.round(pos * 10) / 10 : 0;
    let s = '';
    for (const b of this.bits) s += String.fromCharCode(b);
    const bits = btoa(s);
    editProgress((st, now) => putLast(putLecture(st, now, this.id, this.pos, this.dur, bits), now, { kind: 'lecture', id: this.id, t: now }));
  }
}

/** What the lists show for a lecture: its resume point and how much of it was heard. */
export function lectureState(id: string): { pos: number; heard: number } | null {
  const e = lecture(progressStore().store, id);
  if (!e) return null;
  const { at, dur } = e.pos.val;
  return { pos: at, heard: dur ? new LectureLog(id, dur).heardIn() : 0 };
}

export function readState(id: string): ReadRec {
  const e = readEntry(progressStore().store, id);
  return { max: e?.max ?? 0, at: e?.at.val ?? '' };
}

/** Records how far a chapter has been read: `max` only grows, `at` follows the viewer. */
export function saveRead(id: string, frac: number, at: string): void {
  const max = Math.round(frac * 100) / 100;
  const held = readState(id);
  const seen = lastSeen(progressStore().store);
  if (held.at === at && held.max >= max && seen?.kind === 'chapter' && seen.id === id) return;
  editProgress((st, now) => putLast(putReading(st, now, id, max, at), now, { kind: 'chapter', id, t: now }));
}

export function last(): Last | null {
  return lastSeen(progressStore().store);
}
