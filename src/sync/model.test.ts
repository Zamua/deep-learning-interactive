import { describe, expect, it } from 'vitest';
import { Local, canon, codeFromRoom, makeRng, memoryStorage, type Kind } from 'hearthsync';
import { device, fakeWorld } from 'hearthsync/testing';
import { emptyRecord, type ConceptRecord, type Mastered, type Unmastered } from '../mastery/domain/model';
import {
  LAST_KEY, MODEL, PREFS_KEY, READING_KEY, TRACKS_KEY, conceptFrom, concepts, lastSeen, laterConcept, lecture, lectureEntries, lectureKey, masteryKey, model, orBits, paceOf, putConcepts, putLast, putLecture, putPace,
  putReading, putTrack, readEntry, trackList, type Rec,
} from './model';

const rec = (over: Partial<Unmastered> = {}): Unmastered => ({ ...emptyRecord(), ...over });
const mastered = (last: number): Mastered => ({ ...rec({ attempts: 4, correct: 4, recent: [{ ok: true, t: 3 }], last }), mastered: true, slipping: false, review: { due: last + 86_400_000, interval: 1, ease: 2.5, passed: 0 } });
const fresh = () => new Local(memoryStorage(), model(() => []), { now: () => Date.UTC(2026, 9, 26) });

/** Random records of each kind, from a few ids and stamps so merges collide. */
function randomRec(key: string, rng: () => number): Rec {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
  const ids = ['a', 'b', 'c'];
  const t = () => pick([1, 5, 9, 9]);
  if (key.startsWith('mastery/'))
    return { c: Object.fromEntries(ids.filter(() => rng() < 0.7).map((id) => [id, { t: t(), r: rng() < 0.5 ? mastered(t()) : rec({ attempts: pick([1, 2]), last: t() }) }])) };
  if (key.startsWith('lectures/'))
    return { l: Object.fromEntries(ids.filter(() => rng() < 0.7).map((id) => [id, { pos: { val: { at: pick([0, 12]), dur: pick([60, 90]) }, t: t() }, heard: { [pick(['60', '90'])]: pick(['AQ==', 'Ag==', 'BAE=']) } }])) };
  if (key === TRACKS_KEY) return { on: Object.fromEntries(ids.filter(() => rng() < 0.7).map((id) => [id, { val: pick([0, 3, 7]), t: t() }])) };
  if (key === PREFS_KEY) return rng() < 0.2 ? {} : { pace: { val: pick(['deep', 'broad'] as const), t: t() } };
  if (key === READING_KEY) return { ch: Object.fromEntries(ids.filter(() => rng() < 0.7).map((id) => [id, { max: pick([0.2, 0.5]), at: { val: pick(['x', 'y']), t: t() } }])) };
  return { at: { val: rng() < 0.3 ? null : { kind: 'chapter', id: pick(ids), t: t() }, t: t() } };
}

describe('the progress records', () => {
  for (const key of ['mastery/0', 'lectures/0', READING_KEY, LAST_KEY, PREFS_KEY, TRACKS_KEY]) {
    it(`${key} merges commutatively, associatively and idempotently`, () => {
      const kind = MODEL.kind(key) as Kind<Rec>;
      const rng = makeRng(7).next;
      for (let i = 0; i < 300; i++) {
        const [a, b, c] = [randomRec(key, rng), randomRec(key, rng), randomRec(key, rng)];
        expect(canon(kind.merge(a, b))).toBe(canon(kind.merge(b, a)));
        expect(canon(kind.merge(kind.merge(a, b), c))).toBe(canon(kind.merge(a, kind.merge(b, c))));
        expect(canon(kind.merge(a, a))).toBe(canon(a));
      }
    });

    it(`${key} reads back what it writes, and refuses junk`, () => {
      const kind = MODEL.kind(key) as Kind<Rec>;
      const r = randomRec(key, makeRng(3).next);
      expect(canon(kind.from(JSON.parse(JSON.stringify({ v: 1, ...r })), key))).toBe(canon(r));
      expect(kind.from('junk', key)).toBeNull();
    });
  }

  it('a mastered record beats a later one that is not, so a concept never locks again', () => {
    const won = { t: 10, r: mastered(10) };
    const later = { t: 20, r: rec({ attempts: 3, last: 20 }) };
    expect(laterConcept(won, later)).toBe(won);
    expect(laterConcept(later, won)).toBe(won);
    const review = { t: 30, r: { ...mastered(30), slipping: true } };
    expect(laterConcept(won, review)).toBe(review);
  });

  it('tracks keep the order they were added in, and a removal or re-add on any device is the latest word', () => {
    const l = fresh();
    l.edit((s, now) => putTrack(s, now, 'transformer-block', true));
    l.edit((s, now) => putTrack(s, now + 1, 'gan', true));
    l.edit((s, now) => putTrack(s, now + 2, 'transformer-block', true));
    expect(trackList(l.store)).toEqual(['transformer-block', 'gan']);
    l.edit((s, now) => putTrack(s, now, 'transformer-block', false));
    expect(trackList(l.store)).toEqual(['gan']);
    l.edit((s, now) => putTrack(s, now + 5, 'transformer-block', true));
    expect(trackList(l.store)).toEqual(['gan', 'transformer-block']);
  });

  it('heard stretches combine', () => {
    expect(orBits('AQ==', 'Ag==')).toBe('Aw==');
    expect(orBits('AQ==', 'AAI=')).toBe('AQI=');
  });

  it('concepts are written to their slot and read back as one map, the same object until one changes', () => {
    const l = fresh();
    l.edit((s, now) => putConcepts(s, now, { 'dot-product': mastered(5), vectors: rec({ attempts: 1 }) }));
    const view = concepts(l.store);
    expect(Object.keys(view).sort()).toEqual(['dot-product', 'vectors']);
    expect(concepts(l.store)).toBe(view);
    expect(Object.keys(l.store.records)).toContain(masteryKey('dot-product'));
    l.edit((s, now) => putConcepts(s, now, { vectors: rec({ attempts: 2 }) }));
    expect(concepts(l.store)).not.toBe(view);
    expect(concepts(l.store).vectors!.attempts).toBe(2);
  });

  it('a lecture keeps its place and every stretch heard; a chapter only ever reads further', () => {
    const l = fresh();
    l.edit((s, now) => putLecture(s, now, 'atlas-slope', 30, 140, 'AQ=='));
    l.edit((s, now) => putLecture(s, now, 'atlas-slope', 50, 140, 'Ag=='));
    expect(lecture(l.store, 'atlas-slope')).toMatchObject({ pos: { val: { at: 50, dur: 140 } }, heard: { 140: 'Aw==' } });
    l.edit((s, now) => putLecture(s, now, 'atlas-softmax', 10, 120, 'AQ=='));
    expect(Object.keys(lectureEntries(l.store)).sort()).toEqual(['atlas-slope', 'atlas-softmax']);
    l.edit((s, now) => putReading(s, now, 'backprop', 0.6, 'chain'));
    l.edit((s, now) => putReading(s, now, 'backprop', 0.2, 'intro'));
    expect(readEntry(l.store, 'backprop')).toMatchObject({ max: 0.6, at: { val: 'intro' } });
    l.edit((s, now) => putLast(s, now, { kind: 'chapter', id: 'backprop', t: 1 }));
    expect(lastSeen(l.store)).toEqual({ kind: 'chapter', id: 'backprop', t: 1 });
    expect(paceOf(l.store)).toBe('deep');
    l.edit((s, now) => putPace(s, now, 'broad'));
    expect(paceOf(l.store)).toBe('broad');
  });
});

describe('conceptFrom', () => {
  it('reads flags that cannot occur together as the mastery they imply', () => {
    const r = rec({ attempts: 3, last: 50 });
    const review = { due: 99, interval: 1, ease: 2.5, passed: 0 };
    expect(conceptFrom(r)).toEqual(r);
    expect(conceptFrom(mastered(50))).toEqual(mastered(50));
    expect(conceptFrom({ ...r, review })).toEqual({ ...r, mastered: true, slipping: false, review });
    expect(conceptFrom({ ...r, slipping: true, review })).toEqual({ ...r, mastered: true, slipping: true, review });
    expect(conceptFrom({ ...r, mastered: true })).toEqual({ ...r, mastered: true, slipping: false, review: { due: 50 + 86_400_000, interval: 1, ease: 2.5, passed: 0 } });
  });
});

describe('progress kept before sync', () => {
  const legacy = () =>
    memoryStorage({
      'atlas.records': JSON.stringify({ 'dot-product': mastered(1_700_000_000_000), vectors: { ...rec({ attempts: 2, last: 1_700_000_100_000 }), recent: [{ ok: true, t: 4.2, help: false }] }, bad: { attempts: 'x' } }),
      'cs231n.lec.backprop': JSON.stringify({ pos: 312.5, dur: 1800, heard: 'Dw==' }),
      'cs231n.lec.knn': '42',
      'cs231n.read.backprop': JSON.stringify({ max: 0.4, at: 'chain' }),
      'cs231n.last': JSON.stringify({ kind: 'chapter', id: 'backprop', t: 1_700_000_200_000 }),
      'atlas.log': '[]',
    });

  it('folds into the store at the first boot, and leaves the old keys alone', () => {
    const st = legacy();
    const before = new Map(st.data);
    const l = new Local(st, model(() => st.keys()));
    expect(l.moved).toBe(true);
    const view = concepts(l.store);
    expect(Object.keys(view).sort()).toEqual(['dot-product', 'vectors']);
    expect(view['dot-product']!.mastered).toBe(true);
    expect(lecture(l.store, 'backprop')).toMatchObject({ pos: { val: { at: 312.5, dur: 1800 } }, heard: { 1800: 'Dw==' } });
    expect(lecture(l.store, 'knn')).toMatchObject({ pos: { val: { at: 42, dur: 0 } }, heard: {} });
    expect(readEntry(l.store, 'backprop')).toMatchObject({ max: 0.4, at: { val: 'chain' } });
    expect(lastSeen(l.store)).toEqual({ kind: 'chapter', id: 'backprop', t: 1_700_000_200_000 });
    for (const [k, v] of before) expect(st.data.get(k)).toBe(v);
  });

  it('is not folded again at the next boot, but an older tab writing the old keys folds in what it wrote', () => {
    const st = legacy();
    const l = new Local(st, model(() => st.keys()));
    l.edit((s, now) => putConcepts(s, now, { vectors: rec({ attempts: 5, last: 1_800_000_000_000 }) }));
    const again = new Local(st, model(() => st.keys()));
    expect(again.moved).toBe(false);
    expect(concepts(again.store).vectors!.attempts).toBe(5);
    st.set('atlas.records', JSON.stringify({ softmax: rec({ attempts: 1, last: 1_900_000_000_000 }) }));
    again.refold();
    expect(Object.keys(concepts(again.store)).sort()).toEqual(['dot-product', 'softmax', 'vectors']);
  });
});

describe('two devices on one account', () => {
  it('a code links the laptop to the phone, and practice on either reaches the other', async () => {
    const { host, clock } = fakeWorld();
    const phone = device(host, clock, MODEL, 'phone');
    phone.local.edit((s, now) => putConcepts(s, now, { 'dot-product': mastered(clock.t) }));
    await phone.sync.sync();
    const code = codeFromRoom(phone.local.store.account!);
    expect(phone.sync.status.code).toBe(code);

    const laptop = device(host, clock, MODEL, 'laptop');
    laptop.local.edit((s, now) => putLecture(s, now, 'atlas-slope', 20, 140, 'AQ=='));
    await laptop.sync.linkCode(code);
    expect(laptop.local.store.account).toBe(phone.local.store.account);
    expect(concepts(laptop.local.store)['dot-product']!.mastered).toBe(true);

    laptop.local.edit((s, now) => putConcepts(s, now, { vectors: rec({ attempts: 1, last: clock.t }) }));
    await laptop.sync.sync();
    await phone.sync.sync({ full: true });
    expect(Object.keys(concepts(phone.local.store)).sort()).toEqual(['dot-product', 'vectors']);
    expect(lecture(phone.local.store, 'atlas-slope')?.heard).toEqual({ 140: 'AQ==' });
    expect(phone.heard.news.flatMap((n) => n.keys)).toEqual(expect.arrayContaining([masteryKey('vectors'), lectureKey('atlas-slope')]));
  });

  it('edits made on both while offline converge', async () => {
    const { host, clock } = fakeWorld();
    const a = device(host, clock, MODEL, 'a');
    a.local.edit((s, now) => putConcepts(s, now, { softmax: rec({ attempts: 1, last: clock.t }) }));
    await a.sync.sync();
    const b = device(host, clock, MODEL, 'b');
    await b.sync.linkCode(codeFromRoom(a.local.store.account!));
    a.down = b.down = true;
    clock.t += 1000;
    a.local.edit((s, now) => putConcepts(s, now, { softmax: mastered(clock.t) }));
    clock.t += 1000;
    b.local.edit((s, now) => putConcepts(s, now, { softmax: rec({ attempts: 9, last: clock.t }), vectors: rec({ attempts: 1 }) }));
    b.local.edit((s, now) => putReading(s, now, 'knn', 0.5, 'intro'));
    a.down = b.down = false;
    for (const d of [a, b, a, b]) await d.sync.sync({ full: true });
    expect(canon(a.local.store.records)).toBe(canon(b.local.store.records));
    expect(concepts(a.local.store).softmax!.mastered).toBe(true);
    expect(readEntry(a.local.store, 'knn')?.max).toBe(0.5);
  });
});
