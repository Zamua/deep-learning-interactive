import { describe, expect, it } from 'vitest';
import { hashOf, seeded } from './art';
import { standing, thickness } from './landing';

describe('the shelf', () => {
  it('stands a book in the same place wherever it lay', () => {
    expect(standing(402, 0)).toBe('translate3d(14.1px,349.7px,0px) scale(.35) rotateZ(-5deg) rotateY(24deg) rotateX(12deg)');
    expect(standing(402, 600)).toContain('translate3d(14.1px,-250.3px,0px)');
  });

  it('stops growing with the screen past 520px', () => {
    expect(standing(1400, 0)).toBe(standing(520, 0));
  });

  it('makes a longer course a thicker book, within bounds', () => {
    expect(thickness(0)).toBe(0.058);
    expect(thickness(85)).toBe(0.069);
    expect(thickness(170)).toBe(0.08);
    expect(thickness(5000)).toBe(0.08);
  });

  it('draws the same cover for a book every time', () => {
    const a = seeded(hashOf('nix'));
    const b = seeded(hashOf('nix'));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hashOf('nix')).not.toBe(hashOf('dl'));
    const r = seeded(hashOf('dl'));
    for (let i = 0; i < 50; i++) expect(r()).toBeGreaterThanOrEqual(0);
  });
});
