// Times as the pages print them.

const DAY = 86_400_000;

/** Seconds as `m:ss`. */
export const mmss = (t: number): string => {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Local calendar days since the epoch, so "yesterday" follows the clock on the wall. */
export const dayIndex = (t: number): number => {
  const d = new Date(t);
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(1970, 0, 1).getTime()) / DAY);
};

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago", then the date. */
export function ago(t: number, now = Date.now()): string {
  const min = Math.floor((now - t) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60 && dayIndex(t) === dayIndex(now)) return `${Math.floor(min / 60)} h ago`;
  const days = dayIndex(now) - dayIndex(t);
  if (days <= 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
