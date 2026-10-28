// Where each explainer stands and which parts of it were heard, kept in the synced progress store.
import { editProgress, progressStore } from '../sync/cloud';
import { lecture, lectureEntries, putLecture } from '../sync/model';

/** Seconds of narration per heard flag. */
const BUCKET = 2;
/** Share of a stretch heard that counts as finished. */
export const DONE = 0.9;

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
    editProgress((st, now) => putLecture(st, now, this.id, this.pos, this.dur, bits));
  }
}

/** What the lists show for a lecture: its resume point and how much of it was heard. */
export function lectureState(id: string): { pos: number; heard: number } | null {
  const e = lecture(progressStore().store, id);
  if (!e) return null;
  const { at, dur } = e.pos.val;
  return { pos: at, heard: dur ? new LectureLog(id, dur).heardIn() : 0 };
}

/** Stamps below this predate edit times: they came from storage that kept none. */
const TIMED = 1e12;

/** Every lecture played, latest first: when it was last played, where it stopped, its length and the share heard. */
export function lectureHistory(): { id: string; t: number; pos: number; dur: number; heard: number }[] {
  return Object.entries(lectureEntries(progressStore().store))
    .filter(([, e]) => e.pos.t > TIMED && e.pos.val.dur > 0)
    .map(([id, e]) => ({ id, t: e.pos.t, pos: e.pos.val.at, dur: e.pos.val.dur, heard: new LectureLog(id, e.pos.val.dur).heardIn() }))
    .sort((a, b) => b.t - a.t);
}
