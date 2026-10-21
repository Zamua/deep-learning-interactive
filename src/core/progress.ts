// Per-device progress in localStorage: where each lecture stands and which parts of it were heard,
// how far each chapter was read, and what the viewer did last.

/** Seconds of narration per heard flag. */
const BUCKET = 2;
/** Share of a lecture heard, or of a chapter scrolled past, that counts as finished. */
export const DONE = 0.9;

const get = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: progress just isn't kept */
  }
};
const parse = <T>(s: string | null): Partial<T> => {
  try {
    const v = JSON.parse(s ?? '{}') as unknown;
    return v && typeof v === 'object' ? (v as Partial<T>) : {};
  } catch {
    return {};
  }
};

interface LectureRec {
  /** Where to resume, seconds; 0 at the very start or end. */
  pos: number;
  /** Narration length the flags were laid out for. */
  dur: number;
  /** Base64 bitset, one bit per BUCKET seconds heard. */
  heard: string;
}

interface ReadRec {
  /** Furthest share of the chapter that has been on screen, 0..1. */
  max: number;
  /** The section heading last scrolled past, for resuming. */
  at: string;
}

export interface Last {
  kind: 'lecture' | 'chapter';
  id: string;
  /** Epoch ms. */
  t: number;
}

const lecKey = (id: string) => `cs231n.lec.${id}`;
const readKey = (id: string) => `cs231n.read.${id}`;

/** A lecture's saved place and heard time, for the player to update as it plays. */
export class LectureLog {
  pos: number;
  private bits: Uint8Array;

  constructor(readonly id: string, readonly dur: number) {
    const raw = get(lecKey(id));
    // Older builds stored the bare position.
    const rec = raw && /^[\d.]+$/.test(raw) ? { pos: Number(raw) } : parse<LectureRec>(raw);
    this.pos = rec.pos ?? 0;
    this.bits = new Uint8Array(Math.ceil(dur / BUCKET / 8));
    if (rec.heard && rec.dur === dur) {
      const b = atob(rec.heard);
      for (let i = 0; i < Math.min(b.length, this.bits.length); i++) this.bits[i] = b.charCodeAt(i);
    }
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
    set(lecKey(this.id), JSON.stringify({ pos: this.pos, dur: this.dur, heard: btoa(s) } satisfies LectureRec));
    touch('lecture', this.id);
  }
}

/** What the lists show for a lecture: its resume point and how much of it was heard. */
export function lectureState(id: string): { pos: number; heard: number } | null {
  const raw = get(lecKey(id));
  if (!raw) return null;
  if (/^[\d.]+$/.test(raw)) return { pos: Number(raw), heard: 0 };
  const r = parse<LectureRec>(raw);
  if (!r.dur) return { pos: r.pos ?? 0, heard: 0 };
  return { pos: r.pos ?? 0, heard: new LectureLog(id, r.dur).heardIn() };
}

export function readState(id: string): ReadRec {
  const r = parse<ReadRec>(get(readKey(id)));
  return { max: r.max ?? 0, at: r.at ?? '' };
}

/** Records how far a chapter has been read: `max` only grows, `at` follows the viewer. */
export function saveRead(id: string, frac: number, at: string): void {
  const r = readState(id);
  set(readKey(id), JSON.stringify({ max: Math.max(r.max, Math.round(frac * 100) / 100), at } satisfies ReadRec));
  touch('chapter', id);
}

function touch(kind: Last['kind'], id: string): void {
  set('cs231n.last', JSON.stringify({ kind, id, t: Date.now() } satisfies Last));
}

export function last(): Last | null {
  const r = parse<Last>(get('cs231n.last'));
  return r.kind && r.id ? { kind: r.kind, id: r.id, t: r.t ?? 0 } : null;
}
