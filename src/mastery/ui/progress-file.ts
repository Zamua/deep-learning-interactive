// Atlas progress as a file: saved outside the account, and loaded back.
import { h } from '../../core/dom';
import { COURSES } from '../../courses/index';
import { exportSnapshot, importSnapshot } from '../store';

/** Atlas progress saved to a file, or added from one. */
export function progressFile(): HTMLElement {
  const save = h('button', { type: 'button', class: 'btn' }, 'Save progress to a file');
  save.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportSnapshot(COURSES))], { type: 'application/json' }));
    const a = h('a', { href: url, download: `atlas-progress-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true }) as HTMLInputElement;
  const load = h('button', { type: 'button', class: 'btn' }, 'Load progress from a file');
  const msg = h('p', { class: 'ac-hint' });
  load.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      importSnapshot(await f.text(), COURSES);
      msg.className = 'ac-hint ok';
      msg.textContent = 'Loaded.';
    } catch (e) {
      msg.className = 'ac-hint bad';
      msg.textContent = (e as Error).message;
    }
  });
  return h('div', {},
    h('p', { class: 'ac-note' }, 'Loading a file writes its concepts over what is here.'),
    h('div', { class: 'ac-actions' }, save, load, input), msg);
}
