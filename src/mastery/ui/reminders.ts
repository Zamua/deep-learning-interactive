// The daily reminder controls, shown in the settings menu.
import { h } from '../../core/dom';
import type { Learner } from '../learner';
import { disableReminders, enableReminders, loadPrefs, pushSupport, sendTest, syncReminders } from '../push';

/** The reminder time and switch, or how to get them on iOS; null when this browser has no push. */
export function remindersPanel(learner: Learner): HTMLElement | null {
  const support = pushSupport();
  if (support === 'no') return null;
  const box = h('div', { class: 'set-remind' });
  if (support === 'install') {
    box.append(h('p', { class: 'set-note' }, 'Reminders work once Atlas is on your home screen: tap Share, then Add to Home Screen, and open it from there.'));
    return box;
  }
  let prefs = loadPrefs();
  const time = h('input', { type: 'time', class: 'set-time', value: prefs.time, 'aria-label': 'Reminder time' });
  const toggle = h('button', { type: 'button', class: 'set-switch', role: 'switch' });
  const status = h('p', { class: 'set-note' });
  const test = h('button', { type: 'button', class: 'set-test' }, 'Send a test');
  const draw = (msg?: string) => {
    toggle.setAttribute('aria-checked', String(prefs.on));
    toggle.textContent = prefs.on ? 'On' : 'Off';
    test.hidden = !prefs.on;
    status.textContent = msg ?? (prefs.on ? `One nudge a day, skipped on days you practice.${prefs.next ? ` Next: ${new Date(prefs.next).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.` : ''}` : 'One nudge a day at this time, skipped on days you practice.');
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
  toggle.addEventListener('click', () => void run(async () => (prefs = prefs.on ? await disableReminders() : await enableReminders(learner, time.value || '19:00'))));
  time.addEventListener('change', () => {
    if (prefs.on) void run(async () => (prefs = await enableReminders(learner, time.value || '19:00')));
    else prefs = { ...prefs, time: time.value };
  });
  test.addEventListener('click', () => void sendTest().then(() => draw('Sent. It should arrive in a few seconds.'), (e: Error) => {
    prefs = loadPrefs();
    draw(e.message);
  }));
  draw();
  // The saved switch can outlive the browser's subscription; the sync finds that out.
  void syncReminders(learner).catch(() => {}).then(() => {
    if (toggle.disabled) return;
    prefs = loadPrefs();
    draw();
  });
  box.append(h('div', { class: 'set-row' }, time, toggle), status, test);
  return box;
}
