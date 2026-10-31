import { describe, expect, it } from 'vitest';
import type { SyncStatus } from 'hearthsync';
import { statusLine } from './status';

const st = (over: Partial<SyncStatus>): SyncStatus => ({
  state: 'saved', problem: null, code: 'ABCD', tag: null, items: {}, unsaved: 0, savedAt: null, newer: false, retryAt: null, gone: [], ...over,
});

describe('the sync status line', () => {
  it('names the state a learner can act on', () => {
    expect(statusLine(st({ code: null })).title).toBe('Nothing to back up yet');
    expect(statusLine(st({ code: null, state: 'syncing', unsaved: 2 })).title).toBe('Backing up…');
    expect(statusLine(st({ code: null, state: 'offline', unsaved: 2 })).title).toBe('Not backed up yet');
    expect(statusLine(st({ state: 'offline', unsaved: 1 })).text).toMatch(/when you reconnect/);
    expect(statusLine(st({ state: 'error', problem: 'failing' })).tone).toBe('bad');
    expect(statusLine(st({ problem: 'lost' })).title).toBe('Account not found');
    expect(statusLine(st({ newer: true })).title).toBe('Update to keep syncing');
    expect(statusLine(st({ savedAt: 1_000 }), 1_000 + 5 * 60_000)).toMatchObject({ tone: 'ok', text: 'Last synced 5 min ago.' });
  });

  it('has a label of at most two words for every state, and never says only "Offline"', () => {
    const all = [{ code: null }, { code: null, state: 'syncing' as const, unsaved: 2 }, { code: null, state: 'offline' as const }, { code: null, problem: 'rate' as const }, { state: 'offline' as const }, { state: 'error' as const }, { unsaved: 1 }, {}, { problem: 'lost' as const }, { problem: 'full' as const }, { newer: true }];
    for (const over of all) {
      const short = statusLine(st(over)).short;
      expect(short.split(' ').length).toBeLessThanOrEqual(2);
      expect(short).not.toBe('Offline');
    }
  });
});
