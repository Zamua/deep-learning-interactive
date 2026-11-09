import { expect, it } from 'vitest';
import { Rng } from '../core/rand';
import { grade } from '../mastery/domain/grade';
import { bank } from './bank';

const asked = bank('facts', [{ q: 'Pick A', options: ['A', 'B', 'C'], why: ['not B', 'not C'], solution: ['A it is.'] }]);

it('keeps the right answer and each reason with their options, however they are shuffled', () => {
  const places = new Set<number>();
  for (let seed = 1; seed <= 40; seed++) {
    const p = asked.make(new Rng(seed), 0);
    if (p.answer.kind !== 'choice') throw new Error('a bank asks choices');
    const { options, correct, why } = p.answer;
    expect(options[correct]).toBe('A');
    expect(grade(p, correct).ok).toBe(true);
    expect(options.map((o, i) => (o === 'A' ? null : why![i]))).toEqual(options.map((o) => (o === 'A' ? null : `not ${o}`)));
    places.add(correct);
  }
  expect(places.size).toBe(3);
});

it('shows a listing only for a question that has one', () => {
  const p = bank('x', [{ q: 'q', code: 'a = 1;', options: ['a', 'b'], solution: ['s'] }], 'nix').make(new Rng(1), 0);
  expect(p.code).toBe('a = 1;');
  expect(p.lang).toBe('nix');
  expect(asked.make(new Rng(1), 0)).not.toHaveProperty('code');
});
