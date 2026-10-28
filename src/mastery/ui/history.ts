// What the learner did lately: explainers watched and concepts practiced, on any of their devices. The home shows
// the last few explainers; #/atlas/history lists everything by day.
import { domainOf } from '../../atlas/index';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { DONE, lectureHistory } from '../../core/progress';
import { DAY } from '../domain/model';
import type { Learner } from '../learner';
import { atlasRoot } from './common';

interface Seen {
  id: string;
  /** Latest activity of either kind, epoch ms. */
  t: number;
  watched?: { t: number; pos: number; dur: number; heard: number };
  practiced?: number;
}

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** Concepts with an explainer played or a problem answered, latest first. */
function history(learner: Learner): Seen[] {
  const out = new Map<string, Seen>();
  for (const w of lectureHistory()) {
    const id = w.id.replace(/^atlas-/, '');
    if (!w.id.startsWith('atlas-') || !learner.graph.get(id)) continue;
    out.set(id, { id, t: w.t, watched: w });
  }
  for (const [id, r] of Object.entries(learner.records)) {
    if (!r.attempts || !r.last || !learner.graph.get(id)) continue;
    const e = out.get(id);
    if (e) {
      e.practiced = r.last;
      e.t = Math.max(e.t, r.last);
    } else out.set(id, { id, t: r.last, practiced: r.last });
  }
  return [...out.values()].sort((a, b) => b.t - a.t);
}

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago", then the date. */
export function ago(t: number, now = Date.now()): string {
  const min = Math.floor((now - t) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60 && new Date(t).toDateString() === new Date(now).toDateString()) return `${Math.floor(min / 60)} h ago`;
  const days = dayIndex(now) - dayIndex(t);
  if (days <= 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Local calendar days since the epoch, so "yesterday" follows the clock on the wall. */
const dayIndex = (t: number) => {
  const d = new Date(t);
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(1970, 0, 1).getTime()) / DAY);
};

/** Where an explainer stands: watched, or where it stopped. */
function where(w: NonNullable<Seen['watched']>): string {
  if (w.heard >= DONE) return 'watched';
  return w.pos > 0 ? `stopped at ${mmss(w.pos)} of ${mmss(w.dur)}` : w.heard < 0.02 ? 'opened' : `${Math.round(w.heard * 100)}% heard`;
}

function row(learner: Learner, e: Seen, when: string): HTMLElement {
  const c = learner.graph.get(e.id)!;
  const done = !!e.watched && e.watched.heard >= DONE;
  const what = [e.watched ? where(e.watched) : '', e.practiced ? 'practiced' : ''].filter(Boolean).join(' · ');
  return h('a', { class: 'at-row', href: e.watched ? `#/atlas/${e.id}/watch` : `#/atlas/${e.id}` },
    h('span', { class: `at-row-box ${!e.watched ? 'learn' : done ? 'done' : 'new'}`, html: icon(!e.watched ? 'bolt' : done ? 'reset' : 'playFill') }),
    h('span', { class: 'at-row-t' }, c.title, h('small', { style: `--dom:var(--c-${domainOf(c).color})` }, what)),
    h('span', { class: 'at-row-r' }, when));
}

/** The home's last few explainers, with a way to the whole history; nothing before the first one is played. */
export function recentSection(learner: Learner): HTMLElement[] {
  const seen = history(learner).filter((e) => e.watched).slice(0, 3);
  if (!seen.length) return [];
  return [
    h('div', { class: 'at-tracks-h' },
      h('div', { class: 'home-lbl' }, 'Recently watched'),
      h('a', { class: 'at-track-add', href: '#/atlas/history' }, 'See all')),
    ...seen.map((e) => row(learner, e, ago(e.watched!.t))),
  ];
}

/** Everything watched or practiced, grouped by day. */
export function renderHistory(main: HTMLElement, learner: Learner): void {
  const root = atlasRoot('at-map');
  main.append(root);
  const all = history(learner);
  root.append(
    h('a', { class: 'at-back', href: '#/atlas', html: `${icon('arrowLeft')} Atlas` }),
    h('h1', { class: 'home-title' }, 'History'),
    h('p', { class: 'at-small' }, all.length ? 'Explainers you played and concepts you practiced, on any of your devices. Tap one to go back to it.' : 'Nothing yet: explainers you play and concepts you practice show up here.'));
  const today = dayIndex(Date.now());
  const group = (e: Seen) => {
    const d = today - dayIndex(e.t);
    return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? 'This week' : 'Earlier';
  };
  const time = (e: Seen, g: string) =>
    g === 'Today' || g === 'Yesterday' ? new Date(e.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : g === 'This week' ? new Date(e.t).toLocaleDateString([], { weekday: 'short' })
    : new Date(e.t).toLocaleDateString([], { month: 'short', day: 'numeric' });
  let current = '';
  for (const e of all) {
    const g = group(e);
    if (g !== current) root.append(h('h2', { class: 'at-h2' }, (current = g)));
    root.append(row(learner, e, time(e, g)));
  }
}
