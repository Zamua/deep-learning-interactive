// The daily reminder controls, shown in the settings menu.
import { COURSES } from '../../courses/index';
import { settingRow } from '../../core/controls';
import { h } from '../../core/dom';
import { Learner } from '../learner';
import { disableReminders, enableReminders, loadPrefs, pushSupport, sendTest, syncReminders } from '../push';
import { dueCount } from './common';

/** The book a reminder speaks for: the first with reviews due, else the one practiced last. */
export function reminderBook(): Learner {
  const books = COURSES.map((c) => new Learner(c));
  const last = (b: Learner) => Math.max(0, ...Object.values(b.records).map((r) => r.last));
  return books.find((b) => dueCount(b) > 0) ?? books.reduce((a, b) => (last(b) > last(a) ? b : a));
}

/**
 * The settings menu's reminder row: a time and a switch, or on iOS Safari where to get them. Turning reminders on sends
 * one test push, so the learner sees right away that they arrive. Null when this browser has no push.
 */
export function remindersPanel(learner: Learner): HTMLElement | null {
  const support = pushSupport();
  if (support === 'no') return null;
  if (support === 'install') return settingRow('bell', 'Reminder', h('span', { class: 'set-item-r' }, 'Add to Home Screen first'));
  let prefs = loadPrefs();
  const time = h('input', { type: 'time', class: 'set-time', value: prefs.time, 'aria-label': 'Reminder time' });
  const toggle = h('button', { type: 'button', class: 'set-switch', role: 'switch', 'aria-label': 'Daily reminder' });
  const status = h('p', { class: 'set-note' });
  const draw = (msg = '') => {
    toggle.setAttribute('aria-checked', String(prefs.on));
    status.textContent = msg;
  };
  const run = async (f: () => Promise<unknown>) => {
    toggle.disabled = true;
    try {
      await f();
    } catch (e) {
      draw((e as Error).message);
      return;
    } finally {
      toggle.disabled = false;
    }
    draw();
  };
  toggle.addEventListener('click', () => void run(async () => {
    const turningOn = !prefs.on;
    prefs = turningOn ? await enableReminders(learner, time.value || '19:00') : await disableReminders();
    if (turningOn) void sendTest().catch(() => {});
  }));
  time.addEventListener('change', () => {
    if (prefs.on) void run(async () => (prefs = await enableReminders(learner, time.value || '19:00')));
    else prefs = { ...prefs, time: time.value };
  });
  draw();
  // The saved switch can outlive the browser's subscription; the sync finds that out.
  void syncReminders(learner).catch(() => {}).then(() => {
    if (toggle.disabled) return;
    prefs = loadPrefs();
    draw();
  });
  return h('div', {}, settingRow('bell', 'Reminder', time, toggle), status);
}
