import { describe, expect, it } from 'vitest';
import { next, start, type LinkEvent, type LinkStep } from './link-steps';

const peek = { theirs: { n: 3, last: 9 }, mine: 1 };
function run(...events: LinkEvent[]): { s: LinkStep; fx: string[] } {
  let s = start;
  const fx: string[] = [];
  for (const e of events) {
    const [n, out] = next(s, e);
    s = n;
    fx.push(...out.map((f) => f.do));
  }
  return { s, fx };
}

describe('linking by code', () => {
  it('looks the code up, asks, links and clears the field', () => {
    const { s, fx } = run({ type: 'submit', text: 'A' }, { type: 'peeked', text: 'A', same: false, peek }, { type: 'link' }, { type: 'linked', text: 'A', mastered: 4, pending: false });
    expect(s).toEqual({ kind: 'linked', mastered: 4, pending: false });
    expect(fx).toEqual(['look', 'link', 'clear']);
  });

  it('holds edits and second submits while a lookup or a link is out', () => {
    const looking = run({ type: 'submit', text: 'A' }, { type: 'edit', text: 'B' }, { type: 'submit', text: 'B' });
    expect(looking).toEqual({ s: { kind: 'looking', text: 'A' }, fx: ['look'] });
    const linking = run({ type: 'submit', text: 'A' }, { type: 'peeked', text: 'A', same: false, peek }, { type: 'link' }, { type: 'edit', text: 'B' });
    expect(linking.s.kind).toBe('linking');
  });

  it('ignores an answer about any code but the one in flight', () => {
    const asked = run({ type: 'submit', text: 'A' }, { type: 'peeked', text: 'A', same: false, peek }, { type: 'cancel' }, { type: 'submit', text: 'B' });
    expect(next(asked.s, { type: 'peeked', text: 'A', same: false, peek })[0]).toEqual({ kind: 'looking', text: 'B' });
    expect(next(asked.s, { type: 'linked', text: 'A', mastered: 1, pending: false })).toEqual([asked.s, []]);
  });

  it('keeps the question open after a failed link, and shows a failed lookup', () => {
    const { s } = run({ type: 'submit', text: 'A' }, { type: 'peeked', text: 'A', same: false, peek }, { type: 'link' }, { type: 'failed', text: 'A', message: 'offline' });
    expect(s).toEqual({ kind: 'confirm', text: 'A', peek, error: 'offline' });
    expect(run({ type: 'submit', text: 'A' }, { type: 'failed', text: 'A', message: 'no such code' }).s).toEqual({ kind: 'failed', message: 'no such code' });
  });

  it('says so when the code is this device own', () => {
    expect(run({ type: 'submit', text: 'A' }, { type: 'peeked', text: 'A', same: true, peek }).s).toEqual({ kind: 'same' });
  });
});
