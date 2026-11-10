import { describe, expect, it } from 'vitest';
import { bezier, pileOf, SHEAR, shortWay, sizes, thickness } from './pile';

describe('the shelf', () => {
  it('stops a book growing with the page past 520px', () => {
    expect(sizes(402).u).toBe(402);
    expect(sizes(1400)).toEqual(sizes(520));
  });

  it('makes a longer course a thicker book, within bounds', () => {
    expect(thickness(0)).toBe(0.058);
    expect(thickness(85)).toBe(0.069);
    expect(thickness(170)).toBe(0.08);
    expect(thickness(5000)).toBe(0.08);
  });

  it('rests each book on the one below, with a strip of that cover showing', () => {
    const thick = [0.08, 0.06, 0.07];
    const pile = pileOf(thick, 402, 874);
    const { u, w, h } = sizes(402);
    // The top book shows its whole cover; the others are reached across by the book above.
    expect(pile.map((b) => b.covered > 0)).toEqual([false, true, true]);
    pile.forEach((book, i) => {
      // A picture runs from the far edge of the cover to the foot of the spine.
      expect(book.bottom - book.top).toBeGreaterThanOrEqual(w * SHEAR + thick[i]! * h);
      const below = pile[i + 1];
      if (!below) return;
      // The next picture starts above this one's foot: no gap between books.
      expect(below.top).toBeLessThan(book.bottom);
      // In the scene, this book's underside sits on the lower book's cover.
      const underside = book.y + (thick[i]! * h) / 2;
      const lowerCover = below.y - (thick[i + 1]! * h) / 2;
      expect(underside).toBeCloseTo(lowerCover, 6);
      // And it is set back by half a unit.
      expect(below.z - book.z).toBeCloseTo(0.5 * u, 6);
    });
  });

  it('eases like the CSS curve it names', () => {
    const ease = bezier(0.32, 0.72, 0.12, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeGreaterThan(0.8);
    const linear = bezier(0.25, 0.25, 0.75, 0.75);
    expect(linear(0.3)).toBeCloseTo(0.3, 3);
  });

  it('turns back the short way', () => {
    expect(shortWay(0)).toBe(0);
    expect(shortWay(190)).toBe(-170);
    expect(shortWay(-200)).toBe(160);
    expect(shortWay(725)).toBe(5);
  });
});
