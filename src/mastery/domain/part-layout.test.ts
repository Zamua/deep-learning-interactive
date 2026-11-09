import { describe, expect, it } from 'vitest';
import { layoutPart, wrapTitle } from './part-layout';

describe('layoutPart', () => {
  it('puts every node below what it builds on', () => {
    const nodes = [{ id: 'c', prereqs: ['b', 'a'] }, { id: 'a', prereqs: [] }, { id: 'b', prereqs: ['a'] }, { id: 'd', prereqs: ['outside', 'c'] }];
    const row = Object.fromEntries(layoutPart(nodes).map((p) => [p.id, p.row]));
    expect(row).toEqual({ a: 0, b: 1, c: 2, d: 3 });
  });

  it('spills a full row onto the next without breaking the order', () => {
    const nodes = [{ id: 'r', prereqs: [] }, ...['a', 'b', 'c', 'd'].map((id) => ({ id, prereqs: ['r'] })), { id: 'z', prereqs: ['a', 'd'] }];
    const placed = layoutPart(nodes);
    const row = Object.fromEntries(placed.map((p) => [p.id, p.row]));
    expect(row.r).toBe(0);
    expect(new Set(['a', 'b', 'c', 'd'].map((k) => row[k]))).toEqual(new Set([1, 2]));
    expect(row.z).toBe(3);
    expect(placed.filter((p) => p.row === 1)).toHaveLength(3);
  });

  it('centers a lone node', () => {
    expect(layoutPart([{ id: 'a', prereqs: [] }])[0]).toEqual({ id: 'a', row: 0, x: 0.5 });
  });
});

describe('wrapTitle', () => {
  it('breaks at words, and keeps the last line whole once out of lines', () => {
    expect(wrapTitle('Scaled dot-product attention', 17)).toEqual(['Scaled', 'dot-product', 'attention']);
    expect(wrapTitle('Short', 17)).toEqual(['Short']);
    expect(wrapTitle('one two three four', 3, 2)).toEqual(['one', 'two three four']);
  });
});
