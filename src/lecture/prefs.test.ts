import { describe, expect, it } from 'vitest';
import { type PrefStore, openPrefs } from './prefs';

const KEY = 'atlas.lecture.prefs';
const OLD = 'cs231n.lec.prefs';

/** Storage in a map; `full` makes every write fail silently, as the player's store does. */
function storage(init: Record<string, string> = {}, full = false): PrefStore & { m: Map<string, string> } {
  const m = new Map(Object.entries(init));
  return {
    m,
    get: (k) => m.get(k) ?? null,
    set: (k, v) => void (full || m.set(k, v)),
    remove: (k) => void m.delete(k),
  };
}

describe('lecture prefs', () => {
  it('read back what was kept', () => {
    const st = storage();
    openPrefs(st).keep({ rate: 1.5, cc: false });
    openPrefs(st).keep({ holds: 2 });
    expect(openPrefs(st).now).toEqual({ rate: 1.5, cc: false, holds: 2 });
    expect([...st.m.keys()]).toEqual([KEY]);
  });

  it('keep only well-typed fields, and read anything unparseable as none', () => {
    expect(openPrefs(storage({ [KEY]: '{"rate":"2","cc":1,"locked":true,"holds":3,"x":1}' })).now).toEqual({ locked: true, holds: 3 });
    for (const raw of ['', '{', 'null', '7', '"on"']) expect(openPrefs(storage({ [KEY]: raw })).now).toEqual({});
  });

  it('move over from the old key once, leaving it behind', () => {
    const st = storage({ [OLD]: '{"rate":1.25,"cc":false}' });
    expect(openPrefs(st).now).toEqual({ rate: 1.25, cc: false });
    expect(Object.fromEntries(st.m)).toEqual({ [KEY]: '{"rate":1.25,"cc":false}' });
  });

  it('ignore the old key once the new one exists', () => {
    const st = storage({ [KEY]: '{"rate":2}', [OLD]: '{"rate":0.75}' });
    expect(openPrefs(st).now).toEqual({ rate: 2 });
    expect(st.m.get(OLD)).toBe('{"rate":0.75}');
  });

  it('keep the old key when the move cannot be written', () => {
    const st = storage({ [OLD]: '{"cc":false}' }, true);
    expect(openPrefs(st).now).toEqual({ cc: false });
    expect(st.m.get(OLD)).toBe('{"cc":false}');
  });
});
