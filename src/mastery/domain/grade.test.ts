import { describe, expect, it } from 'vitest';
import { closeTo, expectedResponse, grade, parseNumber, parseShape, parseVector } from './grade';
import type { Answer, Problem } from './types';

const P = (answer: Answer, traps?: Problem['traps']): Problem => ({ prompt: '', answer, solution: [], traps });

describe('parsing', () => {
  it('reads numbers in the forms people type', () => {
    expect(['0.24', '-1.5', '.5', '1/4', '2e-3', '−3', ' 7 ', '1,000'].map(parseNumber)).toEqual([0.24, -1.5, 0.5, 0.25, 0.002, -3, 7, 1000]);
    expect(['', 'abc', '1/0', '1..2', '--1'].map(parseNumber)).toEqual([null, null, null, null, null]);
  });

  it('reads commas only as thousands separators, never as a decimal comma', () => {
    expect(['3,072', '-1,000,000', '12,345.5'].map(parseNumber)).toEqual([3072, -1000000, 12345.5]);
    expect(['0,5', '1,5', '12,34', '1,0000', ',5', '1,'].map(parseNumber)).toEqual([null, null, null, null, null, null]);
    expect(grade(P({ kind: 'number', value: 0.5 }), '0,5')).toEqual({ ok: false, unreadable: 'Use a point for decimals, like 0.5.' });
  });

  it('reads shapes with any separator', () => {
    expect(['(10, 3072)', '10x3072', '10 × 3072', '[10,3072]', '(5,)'].map(parseShape)).toEqual([[10, 3072], [10, 3072], [10, 3072], [10, 3072], [5]]);
    expect(parseShape('(10, -1)')).toBeNull();
  });

  it('reads vectors with or without brackets', () => {
    expect(parseVector('[0.71, 0.26, 0.04]')).toEqual([0.71, 0.26, 0.04]);
    expect(parseVector('1 2 3')).toEqual([1, 2, 3]);
    expect(parseVector('[1, x]')).toBeNull();
  });
});

describe('closeTo', () => {
  it('accepts anything that rounds to the expected places', () => {
    expect(closeTo(0.71, 0.70538, 2)).toBe(true);
    expect(closeTo(0.705, 0.70538, 2)).toBe(true);
    expect(closeTo(0.7, 0.70538, 2)).toBe(false);
    expect(closeTo(3, 3)).toBe(true);
    expect(closeTo(3.001, 3)).toBe(false);
  });
});

describe('grade', () => {
  it('grades numbers and explains a known trap', () => {
    const p = P({ kind: 'number', value: 0.70538, places: 2 }, [{ value: 1, why: 'no exponential' }]);
    expect(grade(p, '0.71')).toEqual({ ok: true });
    expect(grade(p, '1.00')).toEqual({ ok: false, why: 'no exponential' });
    expect(grade(p, '0.5')).toEqual({ ok: false });
    expect(grade(p, 'seven').unreadable).toBeTruthy();
  });

  it('grades shapes exactly and explains a transposed one', () => {
    const p = P({ kind: 'shape', value: [10, 3072] }, [{ value: [3072, 10], why: 'transposed' }]);
    expect(grade(p, '10x3072').ok).toBe(true);
    expect(grade(p, '(3072, 10)')).toEqual({ ok: false, why: 'transposed' });
    expect(grade(p, '(10)')).toEqual({ ok: false });
  });

  it('grades vectors entrywise and explains a known wrong vector', () => {
    const p = P({ kind: 'vector', value: [0.705, 0.259, 0.035], places: 2 }, [{ value: [2, 1, -1], why: 'still the scores' }]);
    expect(grade(p, '[0.71, 0.26, 0.04]').ok).toBe(true);
    expect(grade(p, '[0.71, 0.26]')).toEqual({ ok: false });
    expect(grade(p, '[2, 1, -1]')).toEqual({ ok: false, why: 'still the scores' });
  });

  it('grades choices and says what a wrong pick means', () => {
    const p = P({ kind: 'choice', options: ['a', 'b', 'c'], correct: 1, why: ['forgot the bias', null, null] });
    expect(grade(p, 1)).toEqual({ ok: true });
    expect(grade(p, 0)).toEqual({ ok: false, why: 'forgot the bias' });
    expect(grade(p, 2)).toEqual({ ok: false });
  });

  it('grades orderings by the original indices', () => {
    const p = P({ kind: 'order', items: ['forward', 'loss', 'backward', 'step'] });
    expect(grade(p, [0, 1, 2, 3]).ok).toBe(true);
    expect(grade(p, [0, 2, 1, 3]).ok).toBe(false);
  });

  it('grades expressions by equivalence and reports unreadable input', () => {
    const p = P({ kind: 'expr', value: '2x e^(x^2)', vars: ['x'] });
    expect(grade(p, '2 x exp(x^2)').ok).toBe(true);
    expect(grade(p, 'e^(x^2)').ok).toBe(false);
    expect(grade(p, '2x e^(').unreadable).toMatch(/Could not read/);
  });

  it('accepts its own expected response for every kind', () => {
    const answers: Answer[] = [
      { kind: 'number', value: -0.125, places: 3 },
      { kind: 'shape', value: [4, 3, 32, 32] },
      { kind: 'vector', value: [1.5, -2] },
      { kind: 'choice', options: ['x', 'y'], correct: 1 },
      { kind: 'order', items: ['a', 'b'] },
      { kind: 'expr', value: '3x^2', vars: ['x'] },
    ];
    for (const a of answers) expect(grade(P(a), expectedResponse(a)).ok).toBe(true);
  });
});
