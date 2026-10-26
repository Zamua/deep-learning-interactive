// How Atlas picks a new concept when the learner leaves it to Atlas: deep or broad. Synced with the account.
import { h } from '../../core/dom';
import type { Pace } from '../domain/scheduler';
import { loadPace, savePace } from '../store';

const PACE: Record<Pace, { label: string; text: string }> = {
  deep: { label: 'Go deep', text: 'Follow one chain to its end: what you just mastered opens the next step.' },
  broad: { label: 'Go broad', text: 'Rotate areas: the next concept comes from the area you have left longest.' },
};

/** The deep or broad switch, with a line on what the choice does. */
export function paceSwitch(): HTMLElement {
  const seg = h('div', { class: 'set-seg two', role: 'group', 'aria-label': 'How new concepts are chosen' });
  const note = h('p', { class: 'set-note' });
  const draw = () => {
    const now = loadPace();
    for (const b of seg.children) b.setAttribute('aria-pressed', String(b.getAttribute('data-p') === now));
    note.textContent = PACE[now].text;
  };
  for (const p of ['deep', 'broad'] as const) {
    const b = h('button', { type: 'button', 'data-p': p }, PACE[p].label);
    b.addEventListener('click', () => {
      savePace(p);
      draw();
    });
    seg.append(b);
  }
  draw();
  return h('div', {}, seg, note);
}

