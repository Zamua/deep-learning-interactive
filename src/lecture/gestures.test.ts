import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOUBLE_MS, HOLD_MS, LOCK_PX, RUN_MS, SKIP_S, SLOP_PX, type Side, stageGestures } from './gestures';
import type { Boost } from './speed';

const LEFT = 0.1;
const MID = 0.5;
const RIGHT = 0.9;

/** A player that holds what the gestures do to it. */
function player(o: { live?: boolean; paused?: boolean; boost?: Boost } = {}) {
  const p = {
    live: o.live ?? true,
    paused: o.paused ?? false,
    t: 100,
    boost: o.boost ?? ('off' as Boost),
    /** The skip badge showing, as [side, count]. */
    badge: null as [Side, number] | null,
    armed: false,
    unlocking: false,
    releases: [] as boolean[],
  };
  const g = stageGestures({
    live: () => p.live,
    paused: () => p.paused,
    toggle: () => (p.paused = !p.paused),
    skip(side, n) {
      p.t += side * SKIP_S;
      p.badge = [side, n];
    },
    skipEnd: (side) => {
      if (p.badge?.[0] === side) p.badge = null;
    },
    boost: () => p.boost,
    setBoost: (b) => (p.boost = b),
    capture: () => {},
    unlocking: () => (p.unlocking = true),
    slide: () => {},
    armed: (on) => (p.armed = on),
    pressEnd() {
      p.armed = false;
      p.unlocking = false;
    },
    released: (locked) => p.releases.push(locked),
  });
  return { p, g };
}

const at = (x: number, y: number) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });
const up = (type = 'pointerup') => ({ pointerId: 1, type });
const wait = (ms: number) => vi.advanceTimersByTime(ms);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('taps on the picture', () => {
  it('toggle playback at once in the middle', () => {
    const { p, g } = player();
    g.click(MID);
    expect(p.paused).toBe(true);
    g.click(MID);
    expect(p.paused).toBe(false);
  });

  it('toggle playback on a side only once no second tap has come', () => {
    const { p, g } = player();
    g.click(LEFT);
    wait(DOUBLE_MS - 1);
    expect(p.paused).toBe(false);
    wait(1);
    expect(p.paused).toBe(true);
  });

  it('skip on a double tap of either side, without toggling', () => {
    const { p, g } = player();
    g.click(RIGHT);
    g.click(RIGHT);
    expect(p.t).toBe(100 + SKIP_S);
    wait(RUN_MS);
    g.click(LEFT);
    g.click(LEFT);
    wait(RUN_MS + DOUBLE_MS);
    expect(p.t).toBe(100);
    expect(p.paused).toBe(false);
  });

  it('keep skipping while each tap comes within RUN_MS of the last skip, counting the run', () => {
    const { p, g } = player();
    g.click(RIGHT);
    g.click(RIGHT);
    wait(RUN_MS - 1);
    g.click(RIGHT);
    wait(RUN_MS - 1);
    g.click(RIGHT);
    expect(p.t).toBe(100 + 3 * SKIP_S);
    expect(p.badge).toEqual([1, 3]);
    wait(RUN_MS);
    expect(p.badge).toBeNull();
    g.click(RIGHT);
    expect(p.t).toBe(100 + 3 * SKIP_S);
  });

  it('switch a run to the other side with one tap, counting afresh', () => {
    const { p, g } = player();
    g.click(RIGHT);
    g.click(RIGHT);
    g.click(RIGHT);
    g.click(LEFT);
    expect(p.t).toBe(100 + SKIP_S);
    expect(p.badge).toEqual([-1, 1]);
  });

  it('toggle at once for a waiting side tap when another tap lands elsewhere', () => {
    const { p, g } = player();
    g.click(LEFT);
    g.click(RIGHT);
    expect(p.paused).toBe(true);
    wait(DOUBLE_MS);
    expect(p.paused).toBe(false);
  });

  it('do nothing before playback starts or after it ends', () => {
    const { p, g } = player({ live: false, paused: true });
    g.click(MID);
    g.click(LEFT);
    wait(DOUBLE_MS);
    expect(p.paused).toBe(true);
  });

  it('never toggle once a hold has begun', () => {
    const { p, g } = player();
    g.click(LEFT);
    wait(DOUBLE_MS / 2);
    g.down(at(100, 100));
    wait(DOUBLE_MS);
    expect(p.paused).toBe(false);
  });
});

describe('holding the picture', () => {
  it('boosts until release, and the release is not a tap', () => {
    const { p, g } = player();
    g.down(at(100, 100));
    wait(HOLD_MS - 1);
    expect(p.boost).toBe('off');
    wait(1);
    expect(p.boost).toBe('hold');
    g.up(up());
    g.click(MID);
    expect(p.boost).toBe('off');
    expect(p.paused).toBe(false);
    expect(p.releases).toEqual([false]);
  });

  it('locks when released after sliding LOCK_PX down', () => {
    const { p, g } = player();
    g.down(at(100, 100));
    wait(HOLD_MS);
    g.move(at(100, 100 + LOCK_PX / 2));
    expect(p.armed).toBe(false);
    g.move(at(100, 100 + LOCK_PX));
    expect(p.armed).toBe(true);
    g.up(up());
    expect(p.boost).toBe('locked');
    expect(p.releases).toEqual([true]);
  });

  it('does not lock after sliding back up, or when the pointer is cancelled', () => {
    for (const end of ['back', 'cancel']) {
      const { p, g } = player();
      g.down(at(100, 100));
      wait(HOLD_MS);
      g.move(at(100, 100 + LOCK_PX));
      if (end === 'back') g.move(at(100, 100 + LOCK_PX - 1));
      g.up(up(end === 'cancel' ? 'pointercancel' : 'pointerup'));
      expect(p.boost).toBe('off');
      expect(p.releases).toEqual([false]);
    }
  });

  it('over a locked boost, unlocks it on release', () => {
    const { p, g } = player({ boost: 'locked' });
    g.down(at(100, 100));
    wait(HOLD_MS);
    expect(p.unlocking).toBe(true);
    expect(p.boost).toBe('locked');
    g.up(up());
    expect(p.boost).toBe('off');
    expect(p.unlocking).toBe(false);
    expect(p.releases).toEqual([]);
  });

  it('is no hold when the press moves first, so its click still taps', () => {
    const { p, g } = player();
    g.down(at(100, 100));
    g.move(at(100 + SLOP_PX + 1, 100));
    wait(HOLD_MS);
    expect(p.boost).toBe('off');
    g.up(up());
    g.click(MID);
    expect(p.paused).toBe(true);
  });

  it('does not start while paused, or before playback starts', () => {
    for (const o of [{ paused: true }, { live: false }]) {
      const { p, g } = player(o);
      g.down(at(100, 100));
      wait(HOLD_MS);
      expect(p.boost).toBe('off');
    }
  });

  it('is cancelled with any waiting tap or run when the page goes', () => {
    const { p, g } = player();
    g.click(LEFT);
    g.down(at(100, 100));
    g.dispose();
    wait(RUN_MS + HOLD_MS);
    expect(p).toMatchObject({ paused: false, boost: 'off' });
    expect(g.pressing()).toBe(false);
  });
});
