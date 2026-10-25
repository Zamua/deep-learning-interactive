import { describe, expect, it } from 'vitest';
import { localDay, nextFire, validTime, validZone, zonedTime } from './schedule';

const NY = 'America/New_York';
const at = (iso: string) => Date.parse(iso);

describe('zonedTime', () => {
  it('finds the instant for a local time, across zones and daylight saving', () => {
    expect(new Date(zonedTime('2026-10-25', '19:00', NY)).toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect(new Date(zonedTime('2026-12-25', '19:00', NY)).toISOString()).toBe('2026-12-26T00:00:00.000Z');
    expect(new Date(zonedTime('2026-10-25', '09:30', 'Asia/Kolkata')).toISOString()).toBe('2026-10-25T04:00:00.000Z');
    expect(new Date(zonedTime('2026-10-25', '00:15', 'UTC')).toISOString()).toBe('2026-10-25T00:15:00.000Z');
  });

  it('round-trips through localDay', () => {
    expect(localDay(zonedTime('2026-03-08', '07:00', NY), NY)).toBe('2026-03-08');
  });
});

describe('nextFire', () => {
  const r = { time: '19:00', tz: NY, lastActive: 0, lastSent: 0 };

  it('fires later today when the time has not passed', () => {
    expect(nextFire(r, at('2026-10-25T14:00:00Z'))).toBe(at('2026-10-25T23:00:00Z'));
  });

  it('fires tomorrow when today\'s time has passed', () => {
    expect(nextFire(r, at('2026-10-26T00:30:00Z'))).toBe(at('2026-10-26T23:00:00Z'));
  });

  it('skips a day the learner already practiced', () => {
    expect(nextFire({ ...r, lastActive: at('2026-10-25T13:00:00Z') }, at('2026-10-25T14:00:00Z'))).toBe(at('2026-10-26T23:00:00Z'));
  });

  it('never reminds twice on one day', () => {
    expect(nextFire({ ...r, lastSent: at('2026-10-25T23:00:00Z') }, at('2026-10-25T23:00:01Z'))).toBe(at('2026-10-26T23:00:00Z'));
  });

  it('uses the learner\'s calendar day, not UTC\'s', () => {
    // 01:00 UTC on the 26th is still the evening of the 25th in New York: practice then counts for the 25th.
    expect(nextFire({ ...r, lastActive: at('2026-10-26T01:00:00Z') }, at('2026-10-26T02:00:00Z'))).toBe(at('2026-10-26T23:00:00Z'));
  });
});

describe('validation', () => {
  it('accepts only HH:MM and real zones', () => {
    expect(['00:00', '19:30', '23:59'].every(validTime)).toBe(true);
    expect(['24:00', '7:00', '19:60', '', '19:00:00'].some(validTime)).toBe(false);
    expect(validZone(NY)).toBe(true);
    expect(validZone('Mars/Olympus')).toBe(false);
  });
});
