import { describe, expect, it } from 'vitest';
import { comingUp } from './coming-up';

const DAY = 86_400_000;
const now = new Date(2026, 10, 9, 12).getTime();

describe('comingUp', () => {
  it('counts the reviews on each of the next days that have any', () => {
    expect(comingUp([now + 2 * DAY, now + DAY, now + DAY + 1000, now + 5 * DAY, now + 9 * DAY], now)).toEqual([
      { t: now + DAY, days: 1, n: 2 },
      { t: now + 2 * DAY, days: 2, n: 1 },
      { t: now + 5 * DAY, days: 5, n: 1 },
    ]);
  });

  it('leaves out what is already due and keeps what falls later today', () => {
    expect(comingUp([now - 1000, now, now + 3_600_000], now)).toEqual([{ t: now + 3_600_000, days: 0, n: 1 }]);
  });
});
