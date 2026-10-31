import { icon } from '../core/controls';
import { h, onDispose } from '../core/dom';
import type { Prefs, PrefsRef } from './prefs';
import { clamp01 } from './scene';
import { BOOST, type Boost, type Speed } from './speed';

/** Holding the picture HOLD_MS boosts it; sliding LOCK_PX down while holding keeps it there. */
export const HOLD_MS = 350;
export const LOCK_PX = 56;
/** A press that moves further than this before HOLD_MS never becomes a hold. */
export const SLOP_PX = 12;
/** Double tapping the left or right side skips SKIP_S; taps within RUN_MS of a skip keep skipping. */
export const SKIP_S = 10;
export const DOUBLE_MS = 300;
export const RUN_MS = 700;

export type Side = -1 | 1;
type Timer = ReturnType<typeof setTimeout>;

/** What the picture's gestures read and do. */
export interface GestureHost {
  /** Playback has begun and not reached the end. */
  live(): boolean;
  paused(): boolean;
  toggle(): void;
  /** The `n`th skip of a run toward `side`. */
  skip(side: Side, n: number): void;
  /** The run of skips toward `side` is over. */
  skipEnd(side: Side): void;
  boost(): Boost;
  setBoost(b: Boost): void;
  /** A press became a hold; the pointer is its until release. */
  capture(pointer: number): void;
  /** A hold began over a locked boost: releasing it unlocks. */
  unlocking(): void;
  /** How far a boosting hold has slid toward locking, 0 to 1. */
  slide(k: number): void;
  /** The slide reached, or left, the point where releasing locks. */
  armed(on: boolean): void;
  pressEnd(): void;
  /** A boosting hold was released, locking it or not. */
  released(locked: boolean): void;
}

type Down = Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY' | 'isPrimary' | 'button'>;
type Move = Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>;
type Up = Pick<PointerEvent, 'pointerId' | 'type'>;

/**
 * Taps and holds on the picture. A tap in the middle toggles playback; a tap on either side waits
 * DOUBLE_MS for a second tap, which skips, before it toggles. A hold boosts to BOOST× until release.
 */
export function stageGestures(host: GestureHost) {
  let pendingTap: { side: Side; timer: Timer } | null = null;
  let run: { side: Side; n: number; timer?: Timer } | null = null;
  let press: { id: number; x: number; y: number; timer: Timer; active: boolean; armed: boolean } | null = null;
  // A hold's release still fires a click on most engines; it must not also toggle playback.
  let swallowClick = false;

  function skip(side: Side): void {
    if (run?.side !== side) {
      if (run) {
        clearTimeout(run.timer);
        host.skipEnd(run.side);
      }
      run = { side, n: 0 };
    }
    const r = run;
    r.n++;
    host.skip(side, r.n);
    clearTimeout(r.timer);
    r.timer = setTimeout(() => {
      host.skipEnd(side);
      run = null;
    }, RUN_MS);
  }

  function endPress(): void {
    if (!press) return;
    clearTimeout(press.timer);
    press = null;
    host.pressEnd();
  }

  return {
    /** A click at `fx`, the fraction of the way across the picture. */
    click(fx: number): void {
      if (swallowClick) {
        swallowClick = false;
        return;
      }
      if (!host.live()) return;
      const side = fx < 0.35 ? -1 : fx > 0.65 ? 1 : 0;
      if (side && run) return skip(side);
      if (pendingTap) {
        clearTimeout(pendingTap.timer);
        const first = pendingTap.side;
        pendingTap = null;
        if (side === first) return skip(first);
        host.toggle();
      }
      if (!side) return host.toggle();
      pendingTap = {
        side,
        timer: setTimeout(() => {
          pendingTap = null;
          // A tap followed by a hold is a hold, not a pause.
          if (!press) host.toggle();
        }, DOUBLE_MS),
      };
    },

    down(e: Down): void {
      swallowClick = false;
      if (!e.isPrimary || e.button !== 0 || !host.live() || host.paused() || press) return;
      const id = e.pointerId;
      press = {
        id,
        x: e.clientX,
        y: e.clientY,
        active: false,
        armed: false,
        timer: setTimeout(() => {
          if (!press || host.paused()) return;
          press.active = true;
          swallowClick = true;
          host.capture(id);
          if (host.boost() === 'locked') host.unlocking();
          else host.setBoost('hold');
        }, HOLD_MS),
      };
    },

    move(e: Move): void {
      if (!press || e.pointerId !== press.id) return;
      const dy = e.clientY - press.y;
      if (!press.active) {
        if (Math.hypot(e.clientX - press.x, dy) > SLOP_PX) endPress();
        return;
      }
      if (host.boost() !== 'hold') return;
      const k = clamp01(dy / LOCK_PX);
      host.slide(k);
      if ((k >= 1) !== press.armed) {
        press.armed = k >= 1;
        host.armed(press.armed);
      }
    },

    up(e: Up): void {
      if (!press || e.pointerId !== press.id) return;
      const { active, armed } = press;
      endPress();
      if (!active) return;
      const held = host.boost() === 'hold';
      const lock = held && armed && e.type === 'pointerup';
      host.setBoost(lock ? 'locked' : 'off');
      if (held) host.released(lock);
    },

    pressing: (): boolean => press !== null,

    dispose(): void {
      endPress();
      if (pendingTap) clearTimeout(pendingTap.timer);
      if (run) clearTimeout(run.timer);
    },
  };
}

/** The slide-to-lock hint shows for the first few holds, and never again once the viewer has locked. */
const hintDone = (p: Readonly<Prefs>): boolean => !!p.locked || (p.holds ?? 0) >= 3;

/** Wires the gestures to the picture; returns the overlays they show, for the stage. */
export function mountGestures(
  stage: HTMLElement,
  root: HTMLElement,
  player: { live(): boolean; paused(): boolean; toggle(): void; seekBy(dt: number): void },
  speed: Pick<Speed, 'boost' | 'setBoost'>,
  prefs: PrefsRef,
): HTMLElement[] {
  const boostEl = h('div', { class: 'lec-boost', 'aria-hidden': 'true' },
    h('div', { class: 'lec-boost-pill' },
      h('span', { class: 'lec-boost-ff', html: icon('ffFill') }),
      h('span', { class: 'lec-boost-lk', html: icon('lockFill') }),
      h('span', { class: 'lec-boost-ul', html: icon('unlockFill') }),
      h('b', { class: 'lec-boost-rate' }, `${BOOST}×`),
      h('span', { class: 'lec-boost-hint' }, 'Slide down to lock'),
      h('span', { class: 'lec-boost-go' }, 'Release to lock'),
      h('span', { class: 'lec-boost-off' }, 'Release to unlock'),
      h('div', { class: 'lec-boost-bar' })));
  const skipEls = [-1, 1].map((side) => {
    const label = h('span', {});
    const el = h('div', { class: `lec-skip lec-skip-${side < 0 ? 'back' : 'fwd'}`, 'aria-hidden': 'true' },
      h('div', { class: 'lec-skip-in' }, h('span', { class: 'lec-skip-ico', html: icon(side < 0 ? 'rewindFill' : 'ffFill') }), label));
    return { el, label };
  });
  const badge = (side: Side) => skipEls[side < 0 ? 0 : 1]!;
  root.classList.toggle('boost-known', hintDone(prefs.now));

  const g = stageGestures({
    live: player.live,
    paused: player.paused,
    toggle: player.toggle,
    skip(side, n) {
      player.seekBy(side * SKIP_S);
      const k = badge(side);
      k.label.textContent = `${n * SKIP_S} seconds`;
      k.el.classList.remove('pulse');
      void k.el.offsetWidth;
      k.el.classList.add('on', 'pulse');
    },
    skipEnd: (side) => badge(side).el.classList.remove('on'),
    boost: speed.boost,
    setBoost: speed.setBoost,
    capture(pointer) {
      try {
        stage.setPointerCapture(pointer);
      } catch {
        /* pointer already gone */
      }
    },
    unlocking: () => root.classList.add('boost-unlock'),
    slide: (k) => boostEl.style.setProperty('--k', k.toFixed(3)),
    armed(on) {
      root.classList.toggle('boost-armed', on);
      if (on) navigator.vibrate?.(12);
    },
    pressEnd() {
      boostEl.style.setProperty('--k', '0');
      root.classList.remove('boost-armed', 'boost-unlock');
    },
    released(locked) {
      if (hintDone(prefs.now)) return;
      prefs.keep(locked ? { locked: true } : { holds: (prefs.now.holds ?? 0) + 1 });
      root.classList.toggle('boost-known', hintDone(prefs.now));
    },
  });

  stage.addEventListener('click', (e) => {
    const r = stage.getBoundingClientRect();
    g.click((e.clientX - r.left) / r.width);
  });
  stage.addEventListener('pointerdown', g.down);
  stage.addEventListener('pointermove', g.move);
  stage.addEventListener('pointerup', g.up);
  stage.addEventListener('pointercancel', g.up);
  stage.addEventListener('contextmenu', (e) => g.pressing() && e.preventDefault());
  onDispose(g.dispose);
  return [boostEl, ...skipEls.map((k) => k.el)];
}
