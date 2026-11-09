// When reviews fall due, day by day: what the Review page says is coming.
import { dayIndex } from '../../core/format';

export interface ReviewDay {
  /** The first due time that day, epoch ms. */
  t: number;
  /** Days from today: 0 for later today. */
  days: number;
  n: number;
}

/** The next `limit` days with reviews still ahead of `now`, soonest first, and how many fall on each. */
export function comingUp(dues: readonly number[], now: number, limit = 3): ReviewDay[] {
  const today = dayIndex(now);
  const byDay = new Map<number, ReviewDay>();
  for (const t of [...dues].filter((d) => d > now).sort((a, b) => a - b)) {
    const days = dayIndex(t) - today;
    const day = byDay.get(days);
    if (day) day.n++;
    else byDay.set(days, { t, days, n: 1 });
  }
  return [...byDay.values()].slice(0, limit);
}
