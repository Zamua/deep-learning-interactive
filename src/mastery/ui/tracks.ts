// Tracks: a target concept and the way to it. The home lists them, the map picks a target (#/atlas/new-track) or
// shows one (#/atlas/track/<id>/map), and a track's page (#/atlas/track/<id>) lists what is left.
import { domainOf, explainerSeconds, hasExplainer } from '../../atlas/index';
import { icon } from '../../core/controls';
import { h } from '../../core/dom';
import { lectureState, watched } from '../../lecture/progress';
import { streak } from '../domain/model';
import type { Track } from '../domain/tracks';
import type { Learner } from '../learner';
import { atlasRoot, plural } from './common';
import { explainerId } from './concept';
import { graphView, lightTrack } from './graph-view';
import { routes } from '../../routes';

const heard = (id: string): number => lectureState(explainerId(id))?.heard ?? 0;

/** A track as it stands, with the explainers' unheard minutes in its estimate. */
export const trackOf = (learner: Learner, target: string): Track => learner.track(target, (id) => explainerSeconds(id) * (1 - Math.min(1, heard(id))));

/** "2 h 50 min", to the nearest five minutes. */
export function duration(seconds: number): string {
  const m = Math.max(5, Math.round(seconds / 300) * 5);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

/** The track's next concept: its explainer when not yet watched, else its practice, keeping the track along. */
export function continueHref(learner: Learner, t: Track): string {
  const id = t.next!;
  const watch = hasExplainer(id) && !learner.record(id).attempts && !watched(explainerId(id));
  return watch ? routes.watch(id, t.target) : routes.learn(id, t.target);
}

const color = (learner: Learner, id: string) => `var(--c-${domainOf(learner.graph.get(id)!).color})`;

function bar(t: Track): HTMLElement {
  const fill = h('i');
  fill.style.width = `${(t.mastered / t.ids.length) * 100}%`;
  return h('div', { class: 'at-track-bar', role: 'progressbar', 'aria-valuenow': String(t.mastered), 'aria-valuemax': String(t.ids.length) }, fill);
}

/** The home's tracks: a card for each one under way, then a line naming the finished ones. */
export function tracksSection(learner: Learner): HTMLElement[] {
  const all = learner.trackTargets.map((id) => trackOf(learner, id));
  const going = all.filter((t) => t.next);
  const done = all.filter((t) => !t.next);
  const title = (id: string) => learner.graph.get(id)!.title;
  const card = (t: Track) => {
    const next = h('div', { class: 'at-track-next' }, 'Next: ', h('b', {}, title(t.next!)), ` · about ${duration(t.seconds)} to go`);
    return h('div', { class: 'at-track', style: `--dom:${color(learner, t.target)}` },
      h('a', { class: 'at-track-head', href: routes.track(t.target) },
        h('span', { class: 'at-track-ic', html: icon('target') }),
        h('b', {}, title(t.target)),
        h('span', { class: 'at-track-n' }, `${t.mastered} of ${t.ids.length}`)),
      bar(t),
      next,
      h('a', { class: 'at-track-go', href: continueHref(learner, t), html: `${icon('playFill')} Continue` }));
  };
  const out = [h('div', { class: 'at-tracks-h' },
    h('div', { class: 'home-lbl' }, 'Your tracks'),
    h('a', { class: 'at-track-add', href: routes.newTrack(), html: `${icon('plus')} New track` })),
    ...going.map(card)];
  if (done.length) {
    const line = h('p', { class: 'at-track-fin', html: `${icon('check-circle')} <span>${done.length === 1 ? 'Finished' : `${done.length} finished`}: </span>` });
    done.forEach((t, i) => line.lastElementChild!.append(i ? ', ' : '', h('a', { href: routes.track(t.target) }, title(t.target))));
    out.push(line);
  }
  return out;
}

/** One track: how far along it is, what is mastered, and each concept left in order, with Continue. */
export function renderTrack(main: HTMLElement, learner: Learner, target: string): void {
  const graph = learner.graph;
  const t = trackOf(learner, target);
  const st = learner.statuses();
  const title = (id: string) => graph.get(id)!.title;
  const root = atlasRoot('at-map at-trk');
  root.style.setProperty('--dom', color(learner, target));
  main.append(root);
  const following = learner.trackTargets.includes(target);

  root.append(
    h('a', { class: 'at-back', href: routes.home, html: `${icon('arrowLeft')} Atlas` }),
    h('div', { class: 'at-kicker at-kicker-dom at-trk-k', html: `${icon('target')} ${t.next ? 'Track' : 'Track complete'}` }),
    h('h1', { class: 'home-title' }, title(target)),
    h('p', { class: 'at-small' }, t.next ? `${t.mastered} of ${t.ids.length} mastered · about ${duration(t.seconds)} to go` : `All ${t.ids.length} concepts mastered.`),
    bar(t));

  const row = (id: string, cls: string, sub: string, mark = '') =>
    h('a', { class: `at-tl-row ${cls}`, href: routes.concept(id), style: `--dom:${color(learner, id)}` },
      h('span', { class: 'at-tl-dot', html: mark }),
      h('span', { class: 'at-tl-t' }, title(id), h('small', {}, sub)));
  const masteredIds = t.ids.filter((id) => learner.record(id).mastered);
  if (masteredIds.length) {
    const list = h('div', { class: 'at-tl at-trk-mastered' }, ...masteredIds.map((id) => row(id, 'done', st.get(id) === 'due' || st.get(id) === 'slipping' ? 'mastered · review due' : 'mastered', icon('check'))));
    const names = masteredIds.slice(-3).reverse().map(title).join(', ');
    const fold = h('button', { type: 'button', class: 'at-trk-fold', 'aria-expanded': String(!t.next), html: `${icon('check-circle')}<span></span>${icon('caret-right')}` });
    fold.querySelector('span')!.textContent = t.next ? `${masteredIds.length} mastered on the way: ${names}${masteredIds.length > 3 ? '…' : ''}` : `${masteredIds.length} mastered`;
    list.hidden = !!t.next;
    fold.addEventListener('click', () => {
      list.hidden = !list.hidden;
      fold.setAttribute('aria-expanded', String(!list.hidden));
    });
    root.append(fold, list);
  }

  const left = t.ids.filter((id) => !learner.record(id).mastered);
  if (left.length) {
    root.append(h('div', { class: 'at-tl' }, ...left.map((id) => {
      const s = st.get(id)!;
      const rec = learner.record(id);
      const need = graph.get(id)!.mastery.streak;
      const progress = s === 'learning' ? `in progress · ${streak(rec)} of ${need} in a row` : '';
      const sub = id === t.next ? `Next up${progress ? ` · ${progress}` : ''}` : progress || (s === 'new' ? 'Ready to start' : `Needs ${graph.get(id)!.prereqs.filter((p) => !learner.record(p).mastered).map(title).join(', ')}`);
      return row(id, `${s === 'locked' ? 'lock' : 'open'}${id === t.next ? ' now' : ''}`, sub, s === 'locked' ? icon('lock') : '');
    })));
  }

  if (following) {
    const drop = h('button', { type: 'button', class: 'at-trk-drop' }, 'Remove this track');
    drop.addEventListener('click', () => {
      if (!window.confirm(`Remove the ${title(target)} track? Your mastery stays.`)) return;
      learner.follow(target, false);
      location.hash = routes.home;
    });
    root.append(drop);
  } else {
    const add = h('button', { type: 'button', class: 'at-trk-drop' }, 'Add this track to your home');
    add.addEventListener('click', () => {
      learner.follow(target);
      location.hash = routes.home;
    });
    root.append(add);
  }

  root.append(h('div', { class: 'at-trk-dock' },
    h('a', { class: 'at-trk-map', href: routes.trackMap(target), html: `${icon('graph')} Map` }),
    t.next
      ? h('a', { class: 'at-trk-go', href: continueHref(learner, t), html: `${icon('playFill')} <span></span>` })
      : h('a', { class: 'at-trk-go', href: routes.home, html: `${icon('arrowLeft')} <span>Atlas</span>` })));
  if (t.next) root.querySelector('.at-trk-go span')!.textContent = `Continue: ${title(t.next)}`;
}

/**
 * The map with a track lit. `pick`: tapping a concept lights everything it needs, and a sheet offers it as a new
 * track. `view`: one track lit, its concepts tappable as on the map.
 */
export function renderTrackMap(main: HTMLElement, learner: Learner, mode: 'pick' | 'view', target?: string): void {
  const graph = learner.graph;
  const root = atlasRoot(`at-map at-trk-pick${mode === 'pick' ? ' picking' : ''}`);
  main.append(root);
  const title = (id: string) => graph.get(id)!.title;
  const sheet = h('div', { class: 'at-trk-sheet', hidden: true });
  const map = graphView(learner, mode === 'pick' ? { onTap: (id) => choose(id) } : {});
  const back = mode === 'view' && target ? routes.track(target) : routes.home;
  const head = h('p', { class: 'at-small' });
  root.append(
    h('a', { class: 'at-back', href: back, html: `${icon('arrowLeft')} ${mode === 'view' ? 'Track' : 'Atlas'}` }),
    h('h1', { class: 'home-title' }, mode === 'pick' ? 'New track' : title(target!)),
    head,
    map,
    sheet);

  const light = (id: string) => {
    const t = trackOf(learner, id);
    lightTrack(map, { ids: new Set(t.ids), target: id });
    return t;
  };
  const choose = (id: string) => {
    const t = light(id);
    const c = graph.get(id)!;
    const followed = learner.trackTargets.includes(id);
    sheet.hidden = false;
    sheet.innerHTML = '';
    sheet.style.setProperty('--dom', color(learner, id));
    const info = t.next
      ? `${plural(t.ids.length, 'concept')} on the way${t.mastered ? `, ${t.mastered} already mastered` : ''}. About ${duration(t.seconds)} to go.`
      : `You have mastered all ${t.ids.length} already.`;
    const again = h('button', { type: 'button', class: 'at-trk-again' }, 'Pick another');
    again.addEventListener('click', () => {
      sheet.hidden = true;
      lightTrack(map, null);
    });
    const go = followed
      ? h('a', { class: 'at-trk-create', href: routes.track(id) }, 'Open track')
      : h('button', { type: 'button', class: 'at-trk-create', disabled: !t.next }, 'Create track');
    if (!followed) go.addEventListener('click', () => {
      learner.follow(id);
      location.hash = routes.track(id);
    });
    sheet.append(
      h('div', { class: 'at-trk-sk', html: `${icon('target')} Target` }),
      h('div', { class: 'at-trk-st' }, c.title),
      h('div', { class: 'at-trk-si' }, info),
      h('div', { class: 'at-trk-sa' }, again, go));
  };

  if (mode === 'pick') head.textContent = 'Tap where you want to get to. Everything it needs lights up.';
  else {
    const t = light(target!);
    head.textContent = `${t.mastered} of ${t.ids.length} mastered. Tap a concept to open it.`;
  }
  const at = target ?? null;
  if (at) {
    if (mode === 'pick') choose(at);
    // The map lays itself out a frame after it is in the page.
    requestAnimationFrame(() => requestAnimationFrame(() => map.querySelector(`.at-node[data-id="${at}"]`)?.scrollIntoView({ block: 'center' })));
  }
}
