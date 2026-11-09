// Settings: one line each for the color theme, how Atlas picks new concepts, the daily reminder, sync (leading to the
// account page) and the source code, and a footnote on offline use.
import { icon, settingRow } from '../../core/controls';
import { h, onDispose } from '../../core/dom';
import { offlineStatus, offlineSupported, type OfflineStatus } from '../../offline/register';
import { routes } from '../../routes';
import { syncEngine } from '../../sync/cloud';
import { statusLine } from '../../sync/status';
import { savedTheme, setTheme, type Theme } from '../../theme';
import { paceRow } from './pace';
import { reminderBook, remindersPanel } from './reminders';

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

const SOURCE = 'https://github.com/Zamua/deep-learning-interactive';

/** The source code; it opens outside the app, so an installed Atlas keeps its place. */
function sourceRow(): HTMLElement {
  return h('a', { class: 'set-item set-link', href: SOURCE, target: '_blank', rel: 'noopener' },
    h('span', { class: 'set-item-i', html: icon('github-logo') }),
    h('span', { class: 'set-item-l' }, 'Source code'),
    h('span', { class: 'set-item-r' }, 'GitHub'),
    h('span', { class: 'set-go', html: icon('arrow-square-out') }));
}

/** How often the note on offline use looks again while the app is saving. */
const OFFLINE_POLL_MS = 3_000;

/** A footnote on offline use: how far saving has got, once the service worker answers. Saving never holds anything up. */
function offlineNote(): HTMLElement | null {
  if (!offlineSupported()) return null;
  const el = h('div', { class: 'set-foot' });
  const draw = (st: OfflineStatus | null) => {
    el.className = `set-foot${st?.ready ? ' ok' : ''}`;
    el.innerHTML = icon(st?.ready ? 'airplane' : 'download-simple');
    el.append(st?.ready ? 'Works offline' : st?.filesTotal ? `Saving for offline: ${st.files} of ${st.filesTotal}` : 'Saving for offline…');
  };
  draw(null);
  const look = () => void offlineStatus().then((st) => {
    draw(st);
    if (st?.ready) window.clearInterval(poll);
  });
  const poll = window.setInterval(look, OFFLINE_POLL_MS);
  onDispose(() => window.clearInterval(poll));
  look();
  return el;
}

export function renderSettings(main: HTMLElement): void {
  const reminders = remindersPanel(reminderBook());
  const sync = syncRow();
  const offline = offlineNote();
  main.append(h('div', { class: 'lib lib-settings' },
    h('div', { class: 'lib-brand' }, 'Atlas'),
    h('h1', {}, 'Settings'),
    h('div', { class: 'set-list lib-card' }, settingRow('circle-half', 'Theme', themeSwitch()), paceRow(), ...(reminders ? [reminders] : []), ...(sync ? [sync] : []), sourceRow()),
    ...(offline ? [offline] : [])));
}
