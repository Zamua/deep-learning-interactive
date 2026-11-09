// A sheet over the page. It opens and closes without touching the address, so closing it leaves you exactly where you were.
import { icon } from '../../core/controls';
import { h, onDispose } from '../../core/dom';

/** Shows `content` in a sheet; returns what closes it. It also closes on the scrim, Escape, and leaving the page. */
export function openSheet(label: string, ...content: (HTMLElement | string)[]): () => void {
  const x = h('button', { type: 'button', class: 'lib-icon sh-x', 'aria-label': 'Close', html: icon('close') });
  const sheet = h('div', { class: 'sh', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, h('div', { class: 'sh-grip' }), x, ...content);
  const scrim = h('div', { class: 'scrim' });
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    document.removeEventListener('keydown', onKey);
    document.documentElement.classList.remove('sh-on');
    scrim.remove();
    sheet.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  x.addEventListener('click', close);
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.documentElement.classList.add('sh-on');
  document.body.append(scrim, sheet);
  onDispose(close);
  return close;
}
