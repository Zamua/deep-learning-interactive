import { describe, expect, it } from 'vitest';
import { ago, mmss } from './format';

describe('mmss', () => {
  it('prints whole seconds as m:ss, never negative', () => {
    expect([0, 9.9, 61, 754, -3].map(mmss)).toEqual(['0:00', '0:09', '1:01', '12:34', '0:00']);
  });
});

describe('ago', () => {
  it('ages by the wall clock: minutes, hours today, then days, then the date', () => {
    const noon = new Date(2026, 9, 31, 12, 0).getTime();
    const day = (n: number, h = 12) => new Date(2026, 9, 31 - n, h, 0).getTime();
    expect(ago(noon - 30_000, noon)).toBe('just now');
    expect(ago(noon - 12 * 60_000, noon)).toBe('12 min ago');
    expect(ago(day(0, 9), noon)).toBe('3 h ago');
    expect(ago(day(1, 23), new Date(2026, 9, 31, 1, 0).getTime())).toBe('yesterday');
    expect(ago(day(4), noon)).toBe('4 days ago');
    expect(ago(day(10), noon)).toBe(new Date(day(10)).toLocaleDateString([], { month: 'short', day: 'numeric' }));
  });
});
