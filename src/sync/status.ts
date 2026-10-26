// What the sync status says, in words: one line for the settings menu and the account page.
import type { SyncStatus } from 'hearthsync';

export interface Line {
  tone: 'ok' | 'wait' | 'off' | 'bad';
  /** A Phosphor icon name. */
  icon: string;
  title: string;
  text: string;
}

export function ago(t: number, now: number): string {
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function statusLine(st: SyncStatus, now = Date.now()): Line {
  if (st.newer) return { tone: 'bad', icon: 'cloud-warning', title: 'Update to keep syncing', text: 'Another device saved progress with a newer version of this site. Reload this page.' };
  if (st.problem === 'lost') return { tone: 'bad', icon: 'cloud-warning', title: 'Account not found', text: 'Your progress is safe on this device. Make a new code to back it up again.' };
  if (st.problem === 'full') return { tone: 'bad', icon: 'cloud-warning', title: 'Server full', text: 'Kept on this device. Saving tries again later.' };
  if (!st.code) {
    if (st.state === 'offline') return { tone: 'off', icon: 'cloud-slash', title: 'Not backed up yet', text: 'Connect once and your progress gets a code.' };
    if (st.problem === 'rate') return { tone: 'wait', icon: 'cloud-arrow-up', title: 'Server busy', text: 'Not backed up yet. Trying again soon.' };
    if (st.unsaved || st.state === 'syncing') return { tone: 'wait', icon: 'cloud-arrow-up', title: 'Backing up…', text: 'Your code comes once your progress is saved.' };
    return { tone: 'off', icon: 'devices', title: 'Nothing to back up yet', text: 'Your code comes with your first answer or explainer.' };
  }
  if (st.state === 'offline') return { tone: 'off', icon: 'cloud-slash', title: 'Offline', text: st.unsaved ? 'Saved on this device. It syncs when you reconnect.' : 'Everything was synced before you went offline.' };
  if (st.state === 'error' || st.problem === 'failing') return { tone: 'bad', icon: 'cloud-warning', title: 'Not syncing', text: 'The server is not answering. Saved on this device; retrying.' };
  if (st.unsaved || st.state === 'syncing') return { tone: 'wait', icon: 'cloud-arrow-up', title: 'Syncing…', text: 'Saved on this device, on its way to your account.' };
  return { tone: 'ok', icon: 'cloud-check', title: 'Synced', text: st.savedAt ? `Last synced ${ago(st.savedAt, now)}.` : 'Your account is up to date.' };
}
