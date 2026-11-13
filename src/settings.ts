// The settings menu behind the top bar's gear: one line each for the color theme, how Atlas picks new concepts, the
// daily reminder and sync (leading to the account page), a footnote on offline use, and saving the sound of whole
// courses.
import { icon, settingRow } from './core/controls';
import { h } from './core/dom';
import { paceRow } from './mastery/ui/pace';
import { remindersPanel, reminderBook } from './mastery/ui/reminders';
import { upcomingNarration } from './offline/ahead';
import { offlineStatus, offlineSupported, type OfflineStatus } from './offline/register';
import { dropCourses, onSavedChange, saveCourses, stopSaving } from './offline/save-courses';
import { COURSES } from './courses';
import { syncEngine } from './sync/cloud';
import { statusLine } from './sync/status';
import { routes } from './routes';
import { getItem, setItem } from './core/storage';

type Theme = 'system' | 'light' | 'dark';
const THEME_KEY = 'cs231n.theme';

function savedTheme(): Theme {
  const t = getItem(THEME_KEY);
  return t === 'light' || t === 'dark' ? t : 'system';
}

export function applyTheme(t: Theme = savedTheme()): void {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

function setTheme(t: Theme): void {
  setItem(THEME_KEY, t === 'system' ? null : t);
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
  const el = h('a', { class: 'set-item set-link', href: routes.account });
  const draw = () => {
    const line = statusLine(sync.status);
    el.className = `set-item set-link ${line.tone}`;
    el.innerHTML = `<span class="set-item-i">${icon(line.icon)}</span><span class="set-item-l"></span><span class="set-item-r">Your code</span><span class="set-go">${icon('caret-right')}</span>`;
    el.querySelector('.set-item-l')!.textContent = line.short;
  };
  draw();
  return { el, stop: sync.on('status', draw) };
}

/** How many of the explainers that come next have their sound saved, as the footnote says it. */
export function soundSaved(held: number, of: number): string {
  if (!of) return '';
  const next = of === 1 ? 'the next explainer' : `the next ${of} explainers`;
  if (held >= of) return ` Sound is saved for ${next}.`;
  return held ? ` Sound is saved for ${held} of ${next}.` : ` Sound for ${next} is not saved yet.`;
}

/** A footnote on offline use, filled in once the service worker answers. */
function offlineNote(): HTMLElement | null {
  if (!offlineSupported()) return null;
  const el = h('div', { class: 'set-foot' });
  const want = upcomingNarration();
  const draw = (ready: boolean, sound = '') => {
    el.className = `set-foot${ready ? ' ok' : ''}`;
    el.innerHTML = icon(ready ? 'airplane' : 'download-simple');
    el.append(h('span', {}, ready ? `Works offline.${sound}` : 'Saving for offline…'));
  };
  draw(false);
  // With every course's sound saved, the panel below says so.
  const whole = (st: OfflineStatus) => Object.values(st.courses ?? {}).every((c) => c.held >= c.tracks);
  void offlineStatus(want).then((st) => draw(!!st?.ready, st && !whole(st) ? soundSaved(st.upcoming, want.length) : ''));
  return el;
}

/** Bytes as the size a phone shows. */
export const megabytes = (n: number): string => `${Math.max(1, Math.round(n / (1024 * 1024)))} MB`;

const installed = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
/** Safari itself, not a browser built on it: the one that clears a site's storage after a week without a visit. */
const safari = () => /Safari\//.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS|Android/.test(navigator.userAgent);

/** The sound of every course for offline use: one action for all of it, then a line per course. */
function soundPanel(): { el: HTMLElement; stop: () => void } | null {
  if (!offlineSupported()) return null;
  const el = h('div', { class: 'set-dl' });
  let short = 0;
  const draw = (st: OfflineStatus | null) => {
    el.replaceChildren();
    if (!st?.ready || !st.courses) return;
    const all = COURSES.map((c) => ({ c, s: st.courses[c.id] })).filter((x) => x.s && x.s.tracks > 0);
    if (!all.length) return;
    const done = (x: (typeof all)[number]) => x.s!.held >= x.s!.tracks;
    const going = all.filter((x) => x.s!.kept && !done(x));
    const left = all.reduce((n, x) => n + x.s!.bytes - x.s!.heldBytes, 0);
    const act = (label: string, fn: () => unknown, cls = 'set-dl-btn') => {
      const b = h('button', { type: 'button', class: cls }, label);
      b.addEventListener('click', () => void fn());
      return b;
    };
    const start = async (ids: string[]) => {
      short = await saveCourses(ids, st);
      if (short) refresh();
    };
    if (all.every(done)) el.append(h('div', { class: 'set-dl-head ok', html: `${icon('check-circle')}<span>Sound saved for every explainer</span>` }));
    else if (st.saving && going.length) {
      const of = going.reduce((n, x) => n + x.s!.bytes, 0);
      const got = going.reduce((n, x) => n + x.s!.heldBytes, 0);
      el.append(
        h('div', { class: 'set-dl-head' }, h('span', {}, `Saving sound: ${Math.round(got / (1024 * 1024))} of ${megabytes(of)}`), act('Stop', () => stopSaving(going.map((x) => x.c.id)))),
        h('div', { class: 'set-dl-bar', style: `--done:${of ? got / of : 0}` }),
        h('p', { class: 'set-dl-note' }, 'Keep Atlas open while it saves.'));
    } else {
      const b = h('button', { type: 'button', class: 'set-dl-all', html: `${icon('download-simple')}<span>Save all sound</span><small>${megabytes(left)}</small>` });
      b.addEventListener('click', () => void start(all.filter((x) => !done(x)).map((x) => x.c.id)));
      el.append(b);
    }
    if (short) el.append(h('p', { class: 'set-dl-note bad' }, `Not enough storage: ${megabytes(short)} more is needed.`));
    else if (going.length && st.problem === 'full') el.append(h('p', { class: 'set-dl-note bad' }, 'Storage is full, so saving stopped.'));
    else if (going.length && st.problem === 'offline' && !st.saving) el.append(h('p', { class: 'set-dl-note' }, 'Paused with no connection. Saving goes on when it returns.'));
    const rows = h('div', { class: 'set-dl-rows' });
    for (const x of all) {
      const s = x.s!;
      const sub = done(x) ? `Saved, ${megabytes(s.bytes)}` : s.held ? `${s.held} of ${s.tracks} saved, ${megabytes(s.bytes)}` : `${s.tracks} explainers, ${megabytes(s.bytes)}`;
      const button = s.kept && done(x) ? act('Remove', () => dropCourses([x.c.id]), 'set-dl-btn quiet')
        : s.kept ? act('Stop', () => stopSaving([x.c.id]), 'set-dl-btn quiet')
        : act('Save', () => start([x.c.id]));
      rows.append(h('div', { class: 'set-dl-row' }, h('span', { class: 'set-dl-name' }, x.c.title, h('small', {}, sub)), button));
    }
    el.append(rows);
    if (!installed() && safari() && all.some((x) => x.s!.kept)) el.append(h('p', { class: 'set-dl-note' }, 'Safari clears saved sound after 7 days without a visit. Add Atlas to your Home Screen to keep it.'));
  };
  const refresh = () => void offlineStatus().then(draw);
  refresh();
  return { el, stop: onSavedChange(refresh) };
}

function open(btn: HTMLElement, closed: () => void): () => void {
  const catcher = h('div', { class: 'set-catch' });
  const reminders = remindersPanel(reminderBook());
  const sync = syncRow();
  const offline = offlineNote();
  const sound = soundPanel();
  const menu = h('div', { class: 'set-menu', role: 'dialog', 'aria-label': 'Settings' },
    h('div', { class: 'set-list' }, settingRow('circle-half', 'Theme', themeSwitch()), paceRow(), ...(reminders ? [reminders] : []), ...(sync ? [sync.el] : [])),
    ...(offline ? [offline] : []), ...(sound ? [sound.el] : []));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const close = () => {
    sync?.stop();
    sound?.stop();
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
