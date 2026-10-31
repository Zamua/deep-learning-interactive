import { icon } from '../core/controls';
import { h } from '../core/dom';
import type { Clock } from './clock';
import type { PrefsRef } from './prefs';

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
/** Holding the picture plays at BOOST×. */
export const BOOST = 2;
/** `hold` lasts while the finger is down; `locked` outlives it until the next hold. */
export type Boost = 'off' | 'hold' | 'locked';

export interface Speed {
  button: HTMLElement;
  boost(): Boost;
  setBoost(b: Boost): void;
  /** One speed up or down, stopping at either end. */
  step(d: 1 | -1): void;
}

/** The playback rate: the chosen speed, or BOOST× while a hold boosts it. */
export function mountSpeed(root: HTMLElement, clock: Pick<Clock, 'setRate'>, prefs: PrefsRef): Speed {
  const button = h('button', { class: 'lec-btn lec-speed', type: 'button', 'aria-label': 'Playback speed' });
  let baseRate = 1;
  let boost: Boost = 'off';

  // A locked boost shows in the speed button, not over the picture; tapping the button unlocks.
  function setBoost(b: Boost): void {
    boost = b;
    clock.setRate(b === 'off' ? baseRate : BOOST);
    root.classList.toggle('boost', b !== 'off');
    root.classList.toggle('boost-locked', b === 'locked');
    button.innerHTML = b === 'locked' ? `${icon('lockFill')}<span>${BOOST}×</span>` : `${baseRate}×`;
    button.setAttribute('aria-label', b === 'locked' ? `Locked at ${BOOST}×, tap to unlock` : 'Playback speed');
  }

  function setRate(r: number): void {
    baseRate = r;
    setBoost('off');
    prefs.keep({ rate: r });
  }

  setRate(SPEEDS.includes(prefs.now.rate ?? 1) ? (prefs.now.rate ?? 1) : 1);
  button.addEventListener('click', () => {
    if (boost === 'locked') setBoost('off');
    else setRate(SPEEDS[(SPEEDS.indexOf(baseRate) + 1) % SPEEDS.length]!);
  });

  return {
    button,
    boost: () => boost,
    setBoost,
    step: (d) => setRate(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, SPEEDS.indexOf(baseRate) + d))]!),
  };
}
