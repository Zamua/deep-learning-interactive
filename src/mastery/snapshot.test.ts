import { describe, expect, it } from 'vitest';
import { emptyRecord } from './domain/model';
import { snapshotFrom } from './snapshot';

const rec = { ...emptyRecord(), attempts: 1, correct: 1, recent: [{ ok: true, t: 4 }], last: 5 };

describe('snapshotFrom', () => {
  it('reads a saved file back, dropping unreadable records and log rows', () => {
    const text = JSON.stringify({ version: 1, records: { a: rec, b: { attempts: 'x' } }, log: [[5, 'a', 'g', 1, 4000], [6, 'a', 'g', 0, 900, 1], ['bad'], null] });
    const s = snapshotFrom(text);
    expect(Object.keys(s.records)).toEqual(['a']);
    expect(s.log).toEqual([[5, 'a', 'g', 1, 4000], [6, 'a', 'g', 0, 900, 1]]);
  });

  it('throws the same readable error for anything that is not a progress file', () => {
    for (const text of ['null', '5', '"x"', '[]', '{}', '{"version":2,"records":{},"log":[]}', '{"version":1,"records":null,"log":[]}', '{"version":1,"records":{}}', 'not json', '']) {
      expect(() => snapshotFrom(text)).toThrowError('This is not an Atlas progress file.');
    }
  });
});
