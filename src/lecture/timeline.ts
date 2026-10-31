import { type Beat, GAP, type LectureScript, type Timing, shownText, spokenText, timingMatches } from './types';

export interface TBeat {
  id: string;
  start: number;
  end: number;
  code?: Beat['code'];
  caps: { at: number; text: string }[];
  /** Silences inside the line, [from, to]: where its phrases break. */
  pauses: [number, number][];
}

export interface TScene {
  id: string;
  title: string;
  start: number;
  end: number;
  beats: TBeat[];
}

/** Resuming backs up to where the interrupted phrase began, RESUME_LEAD s early, at most RESUME_MAX s. */
const RESUME_LEAD = 0.1;
const RESUME_MAX = 6;

/** Splits a caption into pieces of at most ~`max` characters at sentence, then clause, boundaries. */
function captionChunks(text: string, max = 92): string[] {
  const pieces = text.split(/(?<=[.?!:])\s+/).flatMap((s) => (s.length <= max ? [s] : s.split(/(?<=,)\s+/)));
  const out: string[] = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    if (last !== undefined && last.length + p.length + 1 <= max && !/[.?!:]$/.test(last)) out[out.length - 1] = `${last} ${p}`;
    else if (last !== undefined && last.length + p.length + 1 <= max * 0.6) out[out.length - 1] = `${last} ${p}`;
    else out.push(p);
  }
  return out;
}

/**
 * Lays the script out in time. Uses the synthesized timing when it holds exactly the script's
 * beats, each with its text unchanged; otherwise estimates from text length (and the player runs
 * silent), so an edited script stays watchable before its narration is rebuilt.
 */
export function layout(script: LectureScript, timing: Timing | null): { scenes: TScene[]; duration: number; exact: boolean } {
  const exact = timingMatches(script, timing);
  let t = 0;
  const scenes = script.scenes.map((s) => {
    const start = exact ? timing!.scenes[s.id]![0] : t;
    t = start + GAP.sceneLead;
    const beats = s.beats.map((b, i): TBeat => {
      let bs: number;
      let be: number;
      if (exact) [bs, be] = timing!.beats[`${s.id}/${b.id}`]!;
      else {
        bs = t;
        be = t + spokenText(b.say).length / 14.5;
        t = be + (i === s.beats.length - 1 ? GAP.sceneTail : GAP.beat) + (b.pause ?? 0);
      }
      const shown = shownText(b.say);
      const chunks = captionChunks(shown);
      let acc = 0;
      const caps = chunks.map((text) => {
        const at = bs + (be - bs) * (acc / shown.length);
        acc += text.length + 1;
        return { at, text };
      });
      const pauses = exact ? (timing!.beats[`${s.id}/${b.id}`]![3] ?? []) : [];
      return { id: b.id, start: bs, end: be, code: b.code, caps, pauses };
    });
    const end = exact ? timing!.scenes[s.id]![1] : t;
    t = end;
    return { id: s.id, title: s.title, start, end, beats };
  });
  return { scenes, duration: exact ? timing!.duration : t, exact };
}

export function sceneIndexAt(scenes: TScene[], t: number): number {
  let i = 0;
  while (i < scenes.length - 1 && t >= scenes[i + 1]!.start) i++;
  return i;
}

/**
 * Where play picks up after a pause at `t`: the start of the phrase it interrupted, so a word cut
 * in half is heard whole. A pause in a silence resumes in place.
 */
export function resumePoint(scenes: TScene[], t: number): number {
  let b: TBeat | null = null;
  for (const x of scenes[sceneIndexAt(scenes, t)]!.beats) if (t >= x.start) b = x;
  if (!b || t >= b.end) return t;
  let from = b.start;
  for (const [a, z] of b.pauses) {
    if (t < a) break;
    if (t < z) return t;
    from = z;
  }
  return Math.max(from - RESUME_LEAD, t - RESUME_MAX);
}

/** Where a jump of `d` sections from `t` lands. "Previous" first rewinds to the start of the current section, like a music player. */
export function jumpTarget(scenes: TScene[], t: number, d: 1 | -1): number {
  const i = sceneIndexAt(scenes, t);
  const target = d < 0 && t - scenes[i]!.start > 3 ? i : Math.max(0, Math.min(scenes.length - 1, i + d));
  return scenes[target]!.start + 0.01;
}
