// How Atlas picks a new concept when the learner leaves it to Atlas: deep or broad. Synced with the account.
import { settingRow } from '../../core/controls';
import { h } from '../../core/dom';
import type { Pace } from '../domain/scheduler';
import { loadPace, savePace } from '../store';

const PACE: Record<Pace, { label: string; text: string }> = {
  deep: { label: 'Go deep', text: 'Follow one chain to its end: what you just mastered opens the next step.' },
  broad: { label: 'Go broad', text: 'Rotate areas: the next concept comes from the area you have left longest.' },
};

/** The two buttons; `onPick` runs after a choice is saved. */
function paceButtons(onPick: () => void): HTMLElement {
  const seg = h('div', { class: 'set-seg two', role: 'group', 'aria-label': 'How new concepts are chosen' });
  const draw = () => {
    for (const b of seg.children) b.setAttribute('aria-pressed', String(b.getAttribute('data-p') === loadPace()));
  };
  for (const p of ['deep', 'broad'] as const) {
    const b = h('button', { type: 'button', 'data-p': p }, PACE[p].label);
    b.addEventListener('click', () => {
      savePace(p);
      draw();
      onPick();
    });
    seg.append(b);
  }
  draw();
  return seg;
}

/** The deep or broad switch, with a line on what the choice does. */
export function paceSwitch(): HTMLElement {
  const note = h('p', { class: 'set-note' });
  const show = () => (note.textContent = PACE[loadPace()].text);
  const seg = paceButtons(show);
  show();
  return h('div', {}, seg, note);
}

/** The settings menu's row; what the choice does shows only once it is changed. */
export function paceRow(): HTMLElement {
  const note = h('p', { class: 'set-note' });
  const seg = paceButtons(() => (note.textContent = PACE[loadPace()].text));
  return h('div', {}, settingRow('graph', 'New', seg), note);
}
