// Settings: one line each for the color theme, how Atlas picks new concepts, the daily reminder and sync (leading to the
// account page), and a footnote on offline use.
import { FIRST } from '../../courses/index';
import { icon, settingRow } from '../../core/controls';
import { h, onDispose } from '../../core/dom';
import { offlineStatus, offlineSupported } from '../../offline/register';
import { routes } from '../../routes';
import { syncEngine } from '../../sync/cloud';
import { statusLine } from '../../sync/status';
import { savedTheme, setTheme, type Theme } from '../../theme';
import { Learner } from '../learner';
import { paceRow } from './pace';
import { remindersPanel } from './reminders';

function themeSwitch(): HTMLElement {
  const opts: [Theme, string][] = [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
  const seg = h('div', { class: 'set-seg', role: 'group', 'aria-label': 'Theme' });
  const draw = () => {
    for (const b of seg.children) b.setAttribute('aria-pressed', String(b.getAttribute('data-t') === savedTheme()));
  };
  for (const [t, label] of opts) {
    const b = h('button', { type: 'button', 'data-t': t }, label);
    b.addEventListener('click', () => {
      setTheme(t);
      draw();
    });
    seg.append(b);
  }
  draw();
  return seg;
}

/** The sync status as a line leading to the account page; it follows the status while the page is open. */
function syncRow(): HTMLElement | null {
  const sync = syncEngine();
  if (!sync) return null;
  const el = h('a', { class: 'set-item set-link', href: routes.account });
  const draw = () => {
    const line = statusLine(sync.status);
    el.className = `set-item set-link ${line.tone}`;
    el.innerHTML = `<span class="set-item-i">${icon(line.icon)}</span><span class="set-item-l"></span><span class="set-item-r">Your code</span><span class="set-go">${icon('caret-right')}</span>`;
    el.querySelector('.set-item-l')!.textContent = line.short;
  };
  draw();
  onDispose(sync.on('status', draw));
  return el;
}

/** A footnote on offline use, filled in once the service worker answers. */
function offlineNote(): HTMLElement | null {
  if (!offlineSupported()) return null;
  const el = h('div', { class: 'set-foot' });
  const draw = (ready: boolean) => {
    el.className = `set-foot${ready ? ' ok' : ''}`;
    el.innerHTML = icon(ready ? 'airplane' : 'download-simple');
    el.append(ready ? 'Works offline' : 'Saving for offline…');
  };
  draw(false);
  void offlineStatus().then((st) => draw(!!st?.ready));
  return el;
}

export function renderSettings(main: HTMLElement): void {
  const reminders = remindersPanel(new Learner(FIRST));
  const sync = syncRow();
  const offline = offlineNote();
  main.append(h('div', { class: 'lib lib-settings' },
    h('div', { class: 'lib-brand' }, 'Atlas'),
    h('h1', {}, 'Settings'),
    h('div', { class: 'set-list lib-card' }, settingRow('circle-half', 'Theme', themeSwitch()), paceRow(), ...(reminders ? [reminders] : []), ...(sync ? [sync] : [])),
    ...(offline ? [offline] : [])));
}
