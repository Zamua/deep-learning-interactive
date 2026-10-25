// When a reminder is due: once a day at the learner's chosen local time, skipped on days they
// already practiced or were already reminded. Pure; times are epoch ms.

export interface Reminder {
  /** Local time of day, "HH:MM". */
  time: string;
  /** IANA time zone, e.g. "America/New_York". */
  tz: string;
  /** Latest practice, as reported by the page. */
  lastActive: number;
  /** Latest reminder sent. */
  lastSent: number;
}

const DAY = 86_400_000;

function parts(t: number, tz: string): Record<string, number> {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return Object.fromEntries(f.formatToParts(t).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
}

/** The calendar day at `t` in `tz`, as "YYYY-MM-DD". */
export function localDay(t: number, tz: string): string {
  const p = parts(t, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** How far `tz` is ahead of UTC at instant `t`. */
function offset(t: number, tz: string): number {
  const p = parts(t, tz);
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) - Math.floor(t / 1000) * 1000;
}

/** The instant that reads `hhmm` on `day` in `tz`. */
export function zonedTime(day: string, hhmm: string, tz: string): number {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  let t = wall - offset(wall, tz);
  // Near a daylight saving change the first guess can land an hour off; one more pass settles it.
  t = wall - offset(t, tz);
  return t;
}

export function validTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The next reminder after `now`. */
export function nextFire(r: Reminder, now: number): number {
  for (let k = 0; k < 3; k++) {
    const day = localDay(now + k * DAY, r.tz);
    const at = zonedTime(day, r.time, r.tz);
    if (at <= now) continue;
    if (r.lastActive && localDay(r.lastActive, r.tz) === day) continue;
    if (r.lastSent && localDay(r.lastSent, r.tz) === day) continue;
    return at;
  }
  return zonedTime(localDay(now + 3 * DAY, r.tz), r.time, r.tz);
}
