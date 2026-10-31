// The settings menu behind the top bar's gear: one line each for the color theme, how Atlas picks new concepts, the
// daily reminder and sync (leading to the account page), and a footnote on offline use.
import { GRAPH } from './atlas/index';
import { icon, settingRow } from './core/controls';
import { h } from './core/dom';
import { Learner } from './mastery/learner';
import { paceRow } from './mastery/ui/pace';
import { remindersPanel } from './mastery/ui/reminders';
import { offlineStatus, offlineSupported } from './offline/register';
import { syncEngine } from './sync/cloud';
import { statusLine } from './sync/status';

type Theme = 'system' | 'light' | 'dark';
const THEME_KEY = 'cs231n.theme';

function savedTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(t: Theme = savedTheme()): void {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

function setTheme(t: Theme): void {
  try {
    if (t === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    /* private mode: the choice just isn't kept */
  }
  applyTheme(t);
}

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

export function settingsButton(): HTMLElement {
  const btn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Settings', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', html: icon('gear') });
  let close: (() => void) | null = null;
  btn.addEventListener('click', () => {
    if (close) close();
    else close = open(btn, () => (close = null));
  });
  return btn;
}

/** The sync status as a line leading to the account page; it follows the status while the menu is open. */
function syncRow(): { el: HTMLElement; stop: () => void } | null {
  const sync = syncEngine();
  if (!sync) return null;
  const el = h('a', { class: 'set-item set-link', href: '#/account' });
  const draw = () => {
    const line = statusLine(sync.status);
    el.className = `set-item set-link ${line.tone}`;
    el.innerHTML = `<span class="set-item-i">${icon(line.icon)}</span><span class="set-item-l"></span><span class="set-item-r">Your code</span><span class="set-go">${icon('caret-right')}</span>`;
    el.querySelector('.set-item-l')!.textContent = line.short;
  };
  draw();
  return { el, stop: sync.on('status', draw) };
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

function open(btn: HTMLElement, closed: () => void): () => void {
  const catcher = h('div', { class: 'set-catch' });
  const reminders = remindersPanel(new Learner(GRAPH));
  const sync = syncRow();
  const offline = offlineNote();
  const menu = h('div', { class: 'set-menu', role: 'dialog', 'aria-label': 'Settings' },
    h('div', { class: 'set-list' }, settingRow('circle-half', 'Theme', themeSwitch()), paceRow(), ...(reminders ? [reminders] : []), ...(sync ? [sync.el] : [])),
    ...(offline ? [offline] : []));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const close = () => {
    sync?.stop();
    catcher.remove();
    menu.remove();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', close);
    btn.setAttribute('aria-expanded', 'false');
    closed();
  };
  catcher.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', close);
  btn.setAttribute('aria-expanded', 'true');
  const r = btn.getBoundingClientRect();
  menu.style.setProperty('--set-top', `${r.bottom + 8}px`);
  menu.style.setProperty('--set-tip', `${window.innerWidth - r.right + r.width / 2}px`);
  document.body.append(catcher, menu);
  return close;
}
