// The settings menu behind the top bar's gear: the color theme, syncing progress, how Atlas picks new concepts,
// Atlas's daily reminder, and what is saved for offline use.
import { GRAPH } from './atlas/index';
import { icon } from './core/controls';
import { h } from './core/dom';
import { Learner } from './mastery/learner';
import { paceSwitch } from './mastery/ui/pace';
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
  const opts: [Theme, string][] = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
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

/** The gear button; it opens the menu as a dropdown beneath itself. */
export function settingsButton(): HTMLElement {
  const btn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Settings', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', html: icon('gear') });
  let close: (() => void) | null = null;
  btn.addEventListener('click', () => {
    if (close) close();
    else close = open(btn, () => (close = null));
  });
  return btn;
}

/** The sync status as one row leading to the account page; it follows the status while the menu is open. */
function syncRow(): { el: HTMLElement; stop: () => void } | null {
  const sync = syncEngine();
  if (!sync) return null;
  const el = h('a', { class: 'set-sync', href: '#/account' });
  const draw = () => {
    const line = statusLine(sync.status);
    el.className = `set-sync ${line.tone}`;
    el.innerHTML = `<span class="set-sync-i">${icon(line.icon)}</span><span class="set-sync-t"><b></b><small>Your code and other devices</small></span>${icon('caret-right')}`;
    el.querySelector('b')!.textContent = line.title;
  };
  draw();
  return { el, stop: sync.on('status', draw) };
}

/** What is saved for offline use, filled in once the service worker answers. */
function offlineRow(): HTMLElement | null {
  if (!offlineSupported()) return null;
  const el = h('div', { class: 'set-sync set-static wait' });
  const draw = (tone: string, glyph: string, title: string, note: string) => {
    el.className = `set-sync set-static ${tone}`;
    el.innerHTML = `<span class="set-sync-i">${icon(glyph)}</span><span class="set-sync-t"><b></b><small></small></span>`;
    el.querySelector('b')!.textContent = title;
    el.querySelector('small')!.textContent = note;
  };
  draw('wait', 'download-simple', 'Saving Atlas for offline', 'Practice will work with no connection');
  void offlineStatus().then((s) => {
    if (!s) return;
    const note = `Narration is saved as you play it: ${s.audio} of ${s.total}`;
    if (s.ready) draw('ok', 'airplane', 'Works offline', note);
    else draw('wait', 'download-simple', 'Saving Atlas for offline', note);
  });
  return el;
}

function open(btn: HTMLElement, closed: () => void): () => void {
  const catcher = h('div', { class: 'set-catch' });
  const reminders = remindersPanel(new Learner(GRAPH));
  const sync = syncRow();
  const offline = offlineRow();
  const menu = h('div', { class: 'set-menu', role: 'dialog', 'aria-label': 'Settings' },
    h('div', { class: 'set-sec' }, 'Appearance'),
    themeSwitch(),
    ...(sync ? [h('div', { class: 'set-sec' }, 'Sync'), sync.el] : []),
    h('div', { class: 'set-sec' }, 'New concepts'),
    paceSwitch(),
    ...(reminders ? [h('div', { class: 'set-sec' }, 'Daily reminder'), reminders] : []),
    ...(offline ? [h('div', { class: 'set-sec' }, 'Offline'), offline] : []));
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
