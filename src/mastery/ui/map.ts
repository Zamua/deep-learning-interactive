// The Atlas front page, and the whole map as a graph or a list.
import { domainOf, DOMAINS, hasExplainer } from '../../atlas/index';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { streak, type Status } from '../domain/model';
import type { Learner } from '../learner';
import { disableReminders, enableReminders, loadPrefs, pushSupport, sendTest, syncReminders } from '../push';
import { exportSnapshot, importSnapshot } from '../store';
import { atlasRoot, dots, plural, whenDue } from './common';
import { graphView } from './graph-view';

/** The Atlas front page: today's concept, the short path around it, and a way into the whole map. */
export function renderHome(main: HTMLElement, learner: Learner): void {
  const root = atlasRoot('at-map');
  main.append(root);
  const graph = learner.graph;
  const d = learner.today();
  const title = (id: string) => graph.get(id)!.title;
  root.append(h('div', { class: 'home-kicker at-kicker-teal' }, 'Atlas'), h('h1', { class: 'home-title', html: 'AI by <em>mastery</em>.' }));

  const c = d.concept ? graph.get(d.concept) : undefined;
  const lead = (kicker: string, t: string, sub: string, go: HTMLElement, alt?: HTMLElement) =>
    h('div', { class: 'lead at-lead' }, h('div', { class: 'lead-k' }, kicker), h('div', { class: 'lead-t' }, t), h('div', { class: 'lead-s' }, sub), h('div', { class: 'lead-actions' }, go, alt ?? ''));
  const goBtn = (label: string, href = '#/atlas/learn') => h('a', { class: 'lead-go', href, html: `${icon('playFill')} ${label}` });
  const altBtn = (label: string, href: string, ic: string) => h('a', { class: 'lead-alt', href, html: `${icon(ic)} ${label}` });
  const opens = d.opens?.length ? ` · then ${d.opens.map(title).join(', ')} opens` : '';
  if (d.kind === 'start') root.append(lead('Start here', c!.title, 'The first concept: a short explainer, then practice.', goBtn('Start'), altBtn('Placement test', '#/atlas/place', 'compass')));
  else if (d.kind === 'learning') root.append(lead('In progress', c!.title, `${d.streak} of ${d.need} right in a row${opens}`, goBtn('Practice')));
  else if (d.kind === 'new') root.append(lead('Up next', c!.title, `${c!.blurb}`, goBtn('Start'), hasExplainerLink(c!.id)));
  else if (d.kind === 'review') root.append(lead('Review', `${plural(d.due, 'concept')} due`, 'Mastered concepts come back before they fade.', goBtn('Review')));
  else root.append(lead('All caught up', 'Nothing is due', d.nextReview ? `Next review ${whenDue(d.nextReview)}.` : 'Everything here is mastered.', altBtn('See the map', '#/atlas/graph', 'graph')));
  if (d.due && d.kind !== 'review') root.append(h('p', { class: 'at-small at-due' }, `${plural(d.due, 'review')} due, mixed into your practice.`));

  // The path: the last two mastered, where you are, and what opens next.
  const done = graph.order.filter((x) => learner.record(x.id).mastered).map((x) => x.id).sort((p, q) => learner.record(p).last - learner.record(q).last).slice(-2);
  const now = d.kind === 'learning' || d.kind === 'new' || d.kind === 'start' ? d.concept : undefined;
  const next = now ? [...(d.opens ?? []), ...graph.dependents.get(now)!.filter((x) => !(d.opens ?? []).includes(x))].slice(0, 2) : [];
  if (done.length || now) {
    const step = (id: string, cls: string, sub: string) => h('a', { class: `at-step-p ${cls}`, href: `#/atlas/${id}` }, h('span', { class: 'at-step-t' }, title(id)), h('small', {}, sub));
    root.append(h('div', { class: 'home-lbl' }, 'Your path'), h('div', { class: 'at-path' },
      ...done.map((id) => step(id, 'done', learner.record(id).review ? `mastered · review ${whenDue(learner.record(id).review!.due)}` : 'mastered')),
      ...(now ? [step(now, 'now', d.kind === 'learning' ? `in progress · ${d.streak} of ${d.need}` : 'next to learn')] : []),
      ...next.map((id, i) => step(id, 'lock', i === 0 ? `opens after ${title(now!)}` : 'then this'))));
  }
  const st = [...learner.statuses().values()];
  const mastered = st.filter((x) => x === 'mastered' || x === 'due' || x === 'slipping').length;
  root.append(h('a', { class: 'at-maplink', href: '#/atlas/graph', html: `${icon('graph')} <span>The whole map</span><small>${mastered} of ${st.length} mastered</small>${icon('arrowRight')}` }));
  const rem = reminders(learner);
  if (rem) root.append(rem);
}

/** The daily reminder switch, when this browser can receive push. */
function reminders(learner: Learner): HTMLElement | null {
  const support = pushSupport();
  if (support === 'no') return null;
  const box = h('div', { class: 'at-remind' }, h('div', { class: 'home-lbl' }, 'Daily reminder'));
  if (support === 'install') {
    box.append(h('p', { class: 'at-small' }, 'Reminders work once Atlas is on your home screen: tap Share, then Add to Home Screen, and open it from there.'));
    return box;
  }
  let prefs = loadPrefs();
  const time = h('input', { type: 'time', class: 'at-time', value: prefs.time, 'aria-label': 'Reminder time' });
  const toggle = h('button', { type: 'button', class: 'at-switch', role: 'switch' });
  const status = h('p', { class: 'at-small at-remind-s' });
  const test = h('button', { type: 'button', class: 'at-stuck at-remind-test' }, 'Send a test');
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
  box.append(h('div', { class: 'at-remind-row' }, time, toggle), status, test);
  return box;
}

function hasExplainerLink(id: string): HTMLElement | undefined {
  return hasExplainer(id) ? h('a', { class: 'lead-alt', href: `#/atlas/${id}/watch`, html: `${icon('playFill')} Explainer` }) : undefined;
}

/** Every concept, as a graph or as a list grouped by what to do with it. */
export function renderMap(main: HTMLElement, learner: Learner, view: 'list' | 'graph'): void {
  const root = atlasRoot('at-map');
  main.append(root);
  const graph = learner.graph;
  const st = learner.statuses();
  const ids = (...want: Status[]) => graph.order.filter((c) => want.includes(st.get(c.id)!)).map((c) => c.id);
  const count = (...want: Status[]) => ids(...want).length;

  root.append(
    h('a', { class: 'at-back', href: '#/atlas', html: `${icon('arrowLeft')} Atlas` }),
    h('h1', { class: 'home-title' }, 'The map'),
    h('p', { class: 'at-small' }, `${count('mastered', 'due', 'slipping')} of ${graph.order.length} mastered`));
  root.append(h('nav', { class: 'at-tabs', 'aria-label': 'View' },
    h('a', { href: '#/atlas/graph', class: view === 'graph' ? 'on' : '', html: `${icon('graph')} Graph` }),
    h('a', { href: '#/atlas/list', class: view === 'list' ? 'on' : '', html: `${icon('rows')} List` })));

  if (view === 'graph') {
    root.append(h('div', { class: 'at-legend' }, ...DOMAINS.map((d) => h('span', {}, h('i', { style: `background:var(--c-${d.color})` }), d.title))));
    root.append(graphView(learner));
    return;
  }

  const row = (id: string, box: string, boxCls: string, right: HTMLElement | string) => {
    const c = graph.get(id)!;
    return h('a', { class: 'at-row', href: `#/atlas/${id}` },
      h('span', { class: `at-row-box ${boxCls}`, html: box }),
      h('span', { class: 'at-row-t' }, c.title, h('small', { style: `--dom:var(--c-${domainOf(c).color})` }, domainOf(c).title)),
      h('span', { class: 'at-row-r' }, right));
  };
  const section = (title: string, rows: HTMLElement[]) => (rows.length ? [h('h2', { class: 'at-h2' }, title), ...rows] : []);
  const rec = (id: string) => learner.record(id);
  const bar = (id: string) => graph.get(id)!.mastery.streak;
  const needs = (id: string) => graph.get(id)!.prereqs.filter((p) => !rec(p).mastered).map((p) => graph.get(p)!.title);

  root.append(
    ...section('Due for review', ids('slipping', 'due').map((id) =>
      st.get(id) === 'slipping' ? row(id, icon('reset'), 'slip', `${streak(rec(id))} of ${Math.ceil(bar(id) / 2)} to recover`) : row(id, icon('clock'), 'due', 'due today'))),
    ...section('Learning', ids('learning').map((id) => row(id, icon('bolt'), 'learn', h('span', {}, dots(streak(rec(id)), bar(id)), h('br'), `${streak(rec(id))} of ${bar(id)} in a row`)))),
    ...section('Ready to learn', ids('new').map((id) => row(id, icon('playFill'), 'new', 'explainer, then practice'))),
    ...section('Locked', ids('locked').map((id) => row(id, icon('lock'), 'lock', `needs ${needs(id).join(', ')}`))),
    ...section(`Mastered · ${count('mastered')}`, ids('mastered').map((id) => row(id, icon('check'), 'done', `review ${whenDue(rec(id).review!.due)}`))),
  );
  root.append(progressFile());
}

/** Progress lives in this browser; a file carries it to another one. */
function progressFile(): HTMLElement {
  const save = h('button', { type: 'button', class: 'btn' }, 'Save progress to a file');
  save.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportSnapshot())], { type: 'application/json' }));
    const a = h('a', { href: url, download: `atlas-progress-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  const load = h('button', { type: 'button', class: 'btn' }, 'Load progress from a file');
  const msg = h('span', { class: 'at-small' });
  load.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      importSnapshot(await f.text());
      location.reload();
    } catch (e) {
      msg.textContent = (e as Error).message;
    }
  });
  return h('div', { class: 'at-file' },
    h('h2', { class: 'at-h2' }, 'Your progress'),
    h('p', { class: 'at-small' }, 'Kept in this browser only. Save it to a file to move it to another device; loading a file replaces what is here.'),
    h('div', { class: 'at-actions' }, save, load, input), msg);
}
