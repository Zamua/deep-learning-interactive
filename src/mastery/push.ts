// Daily reminders through Web Push. The sender only learns this browser's push subscription, a
// time of day and when the learner last practiced; the notification's words are written here
// and saved for the service worker, so progress stays on the device.
import type { Learner } from './learner';

const PUSH_URL = import.meta.env.VITE_PUSH_URL as string | undefined;
const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const PREFS = 'atlas.reminders';
/** Activity is reported at most this often, and whenever the day changes. */
const SYNC_EVERY = 30 * 60_000;

export interface ReminderPrefs {
  on: boolean;
  /** "HH:MM", local. */
  time: string;
  /** Epoch ms of the next reminder, as the sender last said. */
  next?: number;
  /** When activity was last reported. */
  synced?: number;
}

export function loadPrefs(): ReminderPrefs {
  try {
    return { on: false, time: '19:00', ...(JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Partial<ReminderPrefs>) };
  } catch {
    return { on: false, time: '19:00' };
  }
}

function savePrefs(p: ReminderPrefs): void {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p));
  } catch {
    /* private mode: the switch just won't stick */
  }
}

/** `ok`: can subscribe. `install`: iOS Safari, which offers push only to an app on the home screen. `no`: unsupported or not configured. */
export function pushSupport(): 'ok' | 'install' | 'no' {
  if (!PUSH_URL || !VAPID_KEY) return 'no';
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok';
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'install' : 'no';
}

const b64uDecode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

async function api(method: string, path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${PUSH_URL}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(out.error ?? `the reminder service answered ${res.status}`));
  return out;
}

const lastActive = (learner: Learner) => Math.max(0, ...Object.values(learner.records).map((r) => r.last));

async function register(learner: Learner, sub: PushSubscription, time: string): Promise<number> {
  const r = await api('PUT', '/subscription', { subscription: sub.toJSON(), time, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, lastActive: lastActive(learner) });
  return Number(r.next);
}

/**
 * Turns reminders on. Call it straight from a tap: iOS grants notification permission only in
 * response to one, so the permission prompt comes before anything is awaited.
 */
export async function enableReminders(learner: Learner, time: string): Promise<ReminderPrefs> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are turned off for this app in Settings.');
  const reg = await navigator.serviceWorker.register('./sw.js');
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uDecode(VAPID_KEY!) }));
  await saveSummary(learner);
  const next = await register(learner, sub, time);
  const p = { on: true, time, next, synced: Date.now() };
  savePrefs(p);
  return p;
}

export async function disableReminders(): Promise<ReminderPrefs> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api('DELETE', '/subscription', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => false);
  }
  const p = { ...loadPrefs(), on: false, next: undefined };
  savePrefs(p);
  return p;
}

export async function sendTest(): Promise<void> {
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (!sub) {
    savePrefs({ ...loadPrefs(), on: false, next: undefined });
    throw new Error('This browser dropped its reminder subscription. Turn reminders on again.');
  }
  await api('POST', '/test', { endpoint: sub.endpoint });
}

/**
 * Keeps the reminder in step with practice: saves the words the next notification will use,
 * and tells the sender about today's practice so it can skip today's reminder.
 */
export async function syncReminders(learner: Learner): Promise<void> {
  if (pushSupport() !== 'ok') return;
  await saveSummary(learner);
  const p = loadPrefs();
  if (!p.on) return;
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (!sub) {
    savePrefs({ ...p, on: false, next: undefined });
    return;
  }
  const newDay = p.synced !== undefined && new Date(p.synced).toDateString() !== new Date().toDateString();
  if (!newDay && p.synced && Date.now() - p.synced < SYNC_EVERY) return;
  const next = await register(learner, sub, p.time);
  savePrefs({ ...p, next, synced: Date.now() });
}

/** What the next reminder will say, written from this device's progress. */
export function summary(learner: Learner): { title: string; body: string } {
  const d = learner.today();
  const t = (id: string) => learner.graph.get(id)!.title;
  const due = d.due ? ` ${d.due} ${d.due === 1 ? 'review' : 'reviews'} due.` : '';
  // With tracks, what is new comes from the oldest one still under way, as on the home page.
  const track = learner.trackTargets.map((id) => learner.track(id, () => 0)).find((x) => x.next);
  if (track && d.kind !== 'review' && !d.slipping) return { title: 'Atlas', body: `Next on your ${t(track.target)} track: ${t(track.next!)}.${due}` };
  switch (d.kind) {
    case 'start':
      return { title: 'Atlas', body: `Your first concept, ${t(d.concept!)}, takes a few minutes.` };
    case 'learning':
      return { title: t(d.concept!), body: `${d.streak} of ${d.need} right in a row so far.${due} A few problems keep it going.` };
    case 'new':
      return { title: 'Atlas', body: `Next up: ${t(d.concept!)}.${due}` };
    case 'review':
      return { title: 'Atlas', body: `${d.due} ${d.due === 1 ? 'concept is' : 'concepts are'} due for review.` };
    case 'done':
      return { title: 'Atlas', body: 'All caught up. A quick review keeps it that way.' };
  }
}

function saveSummary(learner: Learner): Promise<void> {
  const value = summary(learner);
  return new Promise((resolve) => {
    const open = indexedDB.open('atlas', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => resolve();
    open.onsuccess = () => {
      const tx = open.result.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, 'summary');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
  });
}
