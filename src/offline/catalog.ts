// Which narration belongs to which course, as the service worker needs it to save a course's narration: it knows the
// build's files, not the courses.
import { COURSES } from '../courses';

let made: Record<string, string[]> | null = null;

/** Every course's narration addresses, by course id. */
export function courseNarration(): Record<string, string[]> {
  made ??= Object.fromEntries(COURSES.map((c) => [c.id, c.concepts.map((x) => c.narration(x.id)).filter(Boolean).map((u) => new URL(u, location.href).href)]));
  return made;
}
