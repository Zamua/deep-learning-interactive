// A practice session: the scheduler picks each problem, the learner answers on a pad, and the
// feedback shows the worked solution. Also the shared problem screen the placement test uses.
import { domainOf, hasExplainer, loadGenerators } from '../../atlas/index';
import { CodePanel } from '../../core/code';
import { icon } from '../../core/controls';
import { h, onDispose } from '../../core/dom';
import { lectureState } from '../../core/progress';
import { Rng } from '../../core/rand';
import { grade, type Response, type Verdict } from '../domain/grade';
import { recoveryStreak, streak, type ConceptRecord } from '../domain/model';
import type { Pick } from '../domain/scheduler';
import type { Answer, Concept, Generator, Problem } from '../domain/types';
import type { Learner } from '../learner';
import { atlasRoot, dots, pickLink, plural, render } from './common';
import { explainerId } from './concept';
import { celebrate } from './celebrate';
import { wireLookup } from './lookup';
import { makePad } from './pads';
import { syncReminders } from '../push';

/** Problems per session: about fifteen minutes. */
export const SESSION_LENGTH = 20;

/** The full-screen frame a session or placement runs in: a header with progress, a scrolling body, a dock for keys. */
export function runFrame(main: HTMLElement, cls: string): { root: HTMLElement; body: HTMLElement; dock: HTMLElement; setProgress(done: number, total: number, label: string): void } {
  document.body.classList.add('at-on');
  onDispose(() => document.body.classList.remove('at-on'));
  const root = atlasRoot(`at-run ${cls}`, 'atlas', false);
  const fill = h('i', {});
  const label = h('span', { class: 'at-run-n' });
  const lookup = h('button', { type: 'button', class: 'at-run-lk', 'aria-label': 'Symbols in this problem', 'aria-expanded': 'false', html: icon('book') });
  root.append(h('header', { class: 'at-run-top' },
    h('a', { class: 'at-run-x', href: '#/atlas', 'aria-label': 'End the session', html: icon('close') }),
    h('div', { class: 'at-run-bar' }, fill),
    label,
    lookup));
  const body = h('div', { class: 'at-run-body' });
  const dock = h('div', { class: 'at-run-dock' });
  root.append(body, dock);
  main.append(root);
  wireLookup(root, body, lookup);
  return {
    root,
    body,
    dock,
    setProgress: (done, total, text) => {
      fill.style.width = `${Math.min(100, (done / total) * 100)}%`;
      label.textContent = text;
    },
  };
}

export interface Asked {
  verdict: Verdict;
  response: Response;
  seconds: number;
  /** The learner opened a worked example first. */
  help: boolean;
}

/**
 * Shows a problem and resolves with the learner's checked answer. Unreadable input is
 * explained in place and never resolves. Time spent with the page hidden does not count.
 */
export function ask(frame: { body: HTMLElement; dock: HTMLElement }, opts: { concept: string; problem: Problem; tag: HTMLElement; rng: Rng; worked?: () => Problem; target?: number; note?: string }): Promise<Asked> {
  const { problem: p, rng } = opts;
  frame.body.dataset.concept = opts.concept;
  frame.body.innerHTML = '';
  frame.dock.innerHTML = '';
  frame.body.scrollTop = 0;
  return new Promise((resolve) => {
    const check = h('button', { type: 'button', class: 'at-check', disabled: true }, 'Check');
    const pad = makePad(p.answer, rng, render, () => submit());
    const msg = h('div', { class: 'at-msg', role: 'status' });
    const hint = h('div', { class: 'at-hint' },
      opts.target ? h('span', { html: `${icon('clock')} target ${opts.target} s` }) : h('span', {}));
    let help = false;
    const stuck = opts.worked ? h('button', { type: 'button', class: 'at-stuck' }, 'Stuck? Show a worked example') : null;
    const workedBox = h('div', { class: 'at-worked' });
    stuck?.addEventListener('click', () => {
      help = true;
      const w = opts.worked!();
      workedBox.innerHTML = '';
      workedBox.append(
        h('div', { class: 'at-worked-k' }, 'A similar one, worked out. This answer will not count toward your streak.'),
        h('div', { class: 'at-prompt at-prompt-sm', html: render(w.prompt) }),
        solutionList(w.solution));
      stuck.remove();
      fitMath(workedBox);
      // On a phone the keypad covers the lower half, where the steps land.
      workedBox.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
    if (opts.note) frame.body.append(h('div', { class: 'at-transition' }, opts.note));
    frame.body.append(opts.tag, h('div', { class: 'at-prompt', html: render(p.prompt) }));
    if (p.code) frame.body.append(new CodePanel(p.code, { bare: true }).el);
    frame.body.append(pad.display, msg, hint, workedBox);
    if (stuck) frame.body.append(stuck);
    frame.dock.append(pad.keys, check);
    fitMath(frame.body);
    pad.onInput(() => {
      check.disabled = pad.value() === null;
      msg.textContent = '';
    });

    let hiddenFor = 0;
    let hiddenAt = 0;
    const vis = () => {
      if (document.hidden) hiddenAt = performance.now();
      else if (hiddenAt) hiddenFor += performance.now() - hiddenAt;
    };
    document.addEventListener('visibilitychange', vis);
    onDispose(() => document.removeEventListener('visibilitychange', vis));
    const started = performance.now();

    let done = false;
    const submit = () => {
      const r = pad.value();
      if (done || r === null) return;
      const verdict = grade(p, r);
      if (verdict.unreadable) {
        msg.textContent = verdict.unreadable;
        return;
      }
      done = true;
      document.removeEventListener('visibilitychange', vis);
      pad.lock();
      stuck?.remove();
      resolve({ verdict, response: r, seconds: (performance.now() - started - hiddenFor) / 1000, help });
    };
    check.addEventListener('click', submit);
  });
}

/** Shrinks display math wider than the screen to fit, down to a floor; past that it scrolls. */
export function fitMath(root: HTMLElement): void {
  requestAnimationFrame(() => {
    for (const d of root.querySelectorAll<HTMLElement>('.katex-display')) {
      const k = d.querySelector<HTMLElement>(':scope > .katex');
      if (!k || k.dataset.fit) continue;
      k.dataset.fit = '1';
      const over = k.scrollWidth / Math.max(1, d.clientWidth);
      if (over > 1) k.style.fontSize = `${Math.max(0.62, 0.98 / over).toFixed(3)}em`;
    }
  });
}

export function solutionList(steps: string[]): HTMLElement {
  return h('ol', { class: 'at-steps' }, ...steps.map((s) => h('li', { html: render(s) })));
}

/** The right answer, written the way the learner would have entered it. */
export function answerText(a: Answer): string {
  // A whole-number answer reads as one, even where the problem allows decimals.
  const num = (x: number, places?: number) => (places === undefined || Number.isInteger(x) ? String(x) : x.toFixed(places));
  switch (a.kind) {
    case 'number':
      return num(a.value, a.places);
    case 'shape':
      return `(${a.value.join(', ')})`;
    case 'vector':
      return `[${a.value.map((x) => num(x, a.places)).join(', ')}]`;
    case 'choice':
      return a.options[a.correct]!;
    case 'order':
      return a.items.map((x, i) => `${i + 1}. ${x}`).join('\n');
    case 'expr':
      return a.value;
  }
}

function responseText(a: Answer, r: Response): string {
  if (a.kind === 'choice' && typeof r === 'number') return a.options[r] ?? '';
  if (a.kind === 'order' && Array.isArray(r)) return r.map((i, k) => `${k + 1}. ${a.items[i]}`).join('\n');
  return String(r);
}

/** After an answer: right or wrong, why, the worked solution, and what changed. Resolves on Next. */
function feedback(frame: { root: HTMLElement; body: HTMLElement; dock: HTMLElement }, c: Concept, p: Problem, got: Asked, before: ConceptRecord, after: ConceptRecord, learner: Learner): Promise<void> {
  const graph = learner.graph;
  const { verdict } = got;
  const a = p.answer;
  const inline = a.kind !== 'choice' && a.kind !== 'order';
  const box = h('div', { class: `at-verdict ${verdict.ok ? 'ok' : 'no'}` },
    h('div', { class: 'at-verdict-h', html: verdict.ok ? `${icon('check-circle')} Correct${got.help ? ', with help' : ''} <small>${Math.round(got.seconds)} s</small>` : `${icon('x-circle')} Not quite` }));
  if (!verdict.ok) {
    box.append(inline
      ? h('div', { class: 'at-yours' }, h('span', { class: 'bad' }, responseText(a, got.response)), h('span', { class: 'good' }, answerText(a)))
      : h('div', { class: 'at-right', html: `The answer: ${render(answerText(a))}` }));
    if (verdict.why) box.append(h('p', { class: 'at-why', html: render(verdict.why) }));
  }
  const news: HTMLElement[] = [];
  if (after.mastered && !before.mastered) {
    const unlocked = graph.dependents.get(c.id)!.filter((d) => graph.get(d)!.prereqs.every((pid) => pid === c.id || learner.record(pid).mastered));
    void celebrate(frame.root, learner, c.id, unlocked, unlocked[0] ?? learner.nextToLearn(c.id));
    news.push(h('div', { class: 'at-news', html: `${icon('sparkle')} <b>${c.title} mastered.</b> ${unlocked.length ? `Unlocks ${unlocked.map((d) => graph.get(d)!.title).join(', ')}.` : 'It will come back for review tomorrow.'}` }));
  } else if (before.slipping && !after.slipping) {
    news.push(h('div', { class: 'at-news', html: `${icon('sparkle')} <b>${c.title} is back to mastered.</b>` }));
  } else if (after.slipping && !before.slipping) {
    news.push(h('div', { class: 'at-news warn', html: `${icon('reset')} ${c.title} needs ${recoveryStreak(c.mastery)} right in a row to count as mastered again.` }));
  }
  const steps = solutionList(p.solution);
  let solution: HTMLElement = steps;
  if (verdict.ok) {
    const more = h('button', { type: 'button', class: 'at-stuck' }, 'See the worked solution');
    more.addEventListener('click', () => more.replaceWith(steps));
    solution = more;
  }
  frame.dock.innerHTML = '';
  frame.body.append(box, ...news, solution);
  fitMath(frame.body);
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return new Promise((resolve) => {
    const next = h('button', { type: 'button', class: 'at-check' }, 'Next');
    if (!verdict.ok && hasExplainer(c.id)) frame.dock.append(h('a', { class: 'at-ghost', href: `#/atlas/${c.id}/watch`, html: `${icon('reset')} Rewatch the explainer` }));
    frame.dock.append(next);
    const go = () => {
      window.removeEventListener('keydown', onKey);
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        go();
      }
    };
    // The Enter that checked the answer must not also skip its feedback.
    setTimeout(() => window.addEventListener('keydown', onKey), 300);
    onDispose(() => window.removeEventListener('keydown', onKey));
    next.addEventListener('click', go);
    next.focus({ preventScroll: true });
  });
}

/** The tag above a problem: the concept, its domain color, and the streak toward the bar. */
function problemTag(c: Concept, pick: Pick, rec: ConceptRecord): HTMLElement {
  const n = pick.reason === 'slipping' ? recoveryStreak(c.mastery) : c.mastery.streak;
  const right =
    pick.reason === 'review' ? h('span', { html: `${icon('clock')} review` })
    : pick.reason === 'refresh' ? h('span', { html: `${icon('reset')} refresher` })
    : h('span', {}, dots(Math.min(streak(rec), n), n), ` ${Math.min(streak(rec), n)} of ${n} in a row`);
  return h('div', { class: 'at-tag', style: `--dom:var(--c-${domainOf(c).color})` }, h('b', {}, c.title), right);
}

/** How a concept's review went this session. `due`: not reached yet; `slipped`: missed, being won back. */
type ReviewState = 'due' | 'passed' | 'helped' | 'slipped' | 'recovered';

export function renderSession(main: HTMLElement, learner: Learner, focus?: string): void {
  const frame = runFrame(main, 'at-session-run');
  const rng = new Rng((Date.now() ^ (Math.random() * 2 ** 32)) >>> 0);
  const gens = new Map<string, Generator[]>();
  const introduced = new Set<string>();
  const results: { id: string; ok: boolean }[] = [];
  const masteredNow: string[] = [];
  /** Concepts reviewed this session, and how; it opens with every concept due (or slipped) at the time. */
  const reviews = new Map<string, ReviewState>();
  let inReviews = false;
  /** The review block's opening note was shown. */
  let announced = false;
  let opened = false;
  let last: string | undefined;
  const showProgress = () => {
    if (!inReviews) return frame.setProgress(results.length, SESSION_LENGTH, `${results.length} of ${SESSION_LENGTH}`);
    const n = reviews.size;
    const done = [...reviews.values()].filter((v) => v !== 'due' && v !== 'slipped').length;
    frame.setProgress(done, n, `Review ${Math.min(n, done + 1)} of ${n}`);
  };
  showProgress();

  const firstPick = (): Pick | null => {
    if (!focus || !learner.graph.get(focus) || learner.status(focus) === 'locked') return null;
    const rec = learner.record(focus);
    const s = learner.status(focus);
    return { concept: focus, reason: s === 'slipping' ? 'slipping' : s === 'due' || s === 'mastered' ? 'review' : rec.attempts ? 'learning' : 'new', difficulty: rec.attempts ? Math.min(1, streak(rec) / learner.graph.get(focus)!.mastery.streak) : 0 };
  };

  const openReviews = () => {
    inReviews = true;
    announced = false;
    for (const [id, st] of learner.statuses()) {
      if ((st === 'due' || st === 'slipping') && !reviews.has(id)) reviews.set(id, st === 'due' ? 'due' : 'slipped');
    }
  };

  const loop = async () => {
    for (;;) {
      if (results.length >= SESSION_LENGTH) return summary();
      const pick = (opened ? null : firstPick()) ?? learner.next(last, { focus, reviewed: new Set([...reviews].filter(([, v]) => v !== 'due').map(([id]) => id)) });
      opened = true;
      const reviewing = !!pick && (pick.reason === 'review' || pick.reason === 'slipping');
      // Reviews run as one block; leaving it is a stop of its own, never a silent slide into new material.
      if (reviewing && !inReviews) openReviews();
      if (!reviewing && inReviews) {
        inReviews = false;
        showProgress();
        if (!(await reviewsDone(pick))) return;
      }
      if (!pick) return caughtUp();
      if (reviewing && !reviews.has(pick.concept)) reviews.set(pick.concept, pick.reason === 'review' ? 'due' : 'slipped');
      showProgress();
      const c = learner.graph.get(pick.concept)!;
      // A watched explainer is the introduction; otherwise offer it first.
      // The intro is skipped for a watched explainer, and when the session opened on this concept from its page or its explainer.
      const fresh = pick.reason === 'new' && !introduced.has(c.id);
      if (fresh && c.id !== focus && (lectureState(explainerId(c.id))?.heard ?? 0) < 0.5) {
        introduced.add(c.id);
        await intro(c, pick);
      }
      let list = gens.get(c.id);
      if (!list) gens.set(c.id, (list = await loadGenerators(c.id)));
      if (!list.length) {
        frame.body.innerHTML = '';
        frame.body.append(h('p', { class: 'at-lede' }, `${c.title} has no problems yet.`));
        return;
      }
      const gen = list[rng.int(list.length)]!;
      const problem = gen.make(rng, pick.difficulty);
      const before = learner.record(c.id);
      const tag = problemTag(c, pick, before);
      const got = await ask(frame, {
        concept: c.id,
        problem,
        rng,
        tag,
        note: fresh && introduced.has(c.id) ? undefined : transition(pick, last),
        target: c.mastery.seconds,
        worked: () => gen.make(new Rng(rng.int(2 ** 31)), pick.difficulty),
      });
      const after = learner.answer(c.id, gen.id, { ok: got.verdict.ok, seconds: got.seconds, help: got.help });
      void syncReminders(learner);
      if (after.mastered && !before.mastered) masteredNow.push(c.id);
      if (pick.reason === 'review') reviews.set(c.id, got.help ? 'helped' : after.slipping ? 'slipped' : 'passed');
      else if (pick.reason === 'slipping' && !after.slipping) reviews.set(c.id, 'recovered');
      tag.replaceWith(problemTag(c, pick, after));
      results.push({ id: c.id, ok: got.verdict.ok });
      last = c.id;
      showProgress();
      await feedback(frame, c, problem, got, before, after, learner);
    }
  };

  const title = (id: string) => learner.graph.get(id)!.title;
  const names = (ids: string[]) => ids.map(title).join(ids.length > 2 ? ', ' : ' and ');

  /** Why this problem's concept follows the previous one, when it changes. */
  const transition = (pick: Pick, prev?: string): string | undefined => {
    if (pick.concept === prev) return undefined;
    const t = title(pick.concept);
    switch (pick.reason) {
      case 'review': {
        if (announced) return undefined;
        announced = true;
        const n = [...reviews.values()].filter((v) => v === 'due').length;
        return `${plural(n, 'concept')} ${n === 1 ? 'is' : 'are'} due for review: one problem each, foundations first. A miss brings a few more on that concept to win it back.`;
      }
      case 'slipping': {
        const more = !announced && [...reviews.values()].some((v) => v === 'due');
        announced = true;
        return `${t} slipped on a review. ${recoveryStreak(learner.graph.get(pick.concept)!.mastery)} right in a row win it back${more ? ', then the reviews' : ''}.`;
      }
      case 'refresh':
        return `${title(pick.for!)} builds on ${t}. One on ${t} first, then back to ${title(pick.for!)}.`;
      case 'learning':
        return prev ? `Back to ${t}.` : undefined;
      case 'new':
        return `New concept: ${t}. ${whyNew(pick.concept, prev)}`;
    }
  };

  /** Where a new concept sits: what it builds on, or that it is a starting point. */
  const whyNew = (id: string, prev?: string): string => {
    const pre = learner.graph.get(id)!.prereqs;
    if (!pre.length) return 'It is a starting point: nothing comes before it.';
    return `It builds on ${names(pre)}${prev && pre.includes(prev) && learner.record(prev).mastered ? `, which you just mastered` : ''}.`;
  };

  /** Each reviewed concept and how its review went. */
  const reviewList = (): HTMLElement => {
    const row = (id: string, st: ReviewState) => {
      const [ic, cls, text] =
        st === 'passed' ? ['check-circle', 'ok', 'kept']
        : st === 'recovered' ? ['reset', 'ok', 'missed, then won back']
        : st === 'helped' ? ['clock', 'wait', 'done with help: it comes back next session']
        : st === 'slipped' ? ['reset', 'bad', `slipping: ${recoveryStreak(learner.graph.get(id)!.mastery)} right in a row win it back`]
        : ['clock', 'wait', 'not reached: still due'];
      return h('li', { class: cls, html: `${icon(ic)}<span><b></b> <small>${text}</small></span>` });
    };
    const ul = h('ul', { class: 'at-reviews' });
    for (const [id, st] of reviews) {
      const li = row(id, st);
      li.querySelector('b')!.textContent = title(id);
      ul.append(li);
    }
    return ul;
  };

  const kept = () => [...reviews.values()].filter((v) => v === 'passed' || v === 'recovered').length;

  /**
   * The stop between the reviews and what comes next. Resolves true to go on in this session; a new concept leads to its
   * explainer instead, and with nothing left the session ends here.
   */
  const reviewsDone = (next: Pick | null): Promise<boolean> =>
    new Promise((resolve) => {
      frame.body.innerHTML = '';
      frame.dock.innerHTML = '';
      const c = next ? learner.graph.get(next.concept)! : null;
      const rec = c ? learner.record(c.id) : null;
      const what = !c ? 'Nothing new to learn right now. Come back tomorrow for the next reviews.'
        : next!.reason === 'new' ? `Next: ${c.title}, a new concept. ${whyNew(c.id)}`
        : `Next: back to ${c.title}, ${streak(rec!)} of ${c.mastery.streak} right in a row so far.`;
      frame.body.append(h('div', { class: 'at-done' },
        h('div', { class: 'at-kicker' }, 'Reviews done'),
        h('h1', { class: 'at-title' }, `${kept()} of ${reviews.size} kept`),
        reviewList(),
        h('p', { class: 'at-lede at-next' }, what),
        next?.reason === 'new' && learner.choices().open.length > 1 ? pickLink('Or choose something else') : ''));
      if (!c) {
        frame.dock.append(h('a', { class: 'at-check', href: '#/atlas' }, 'Back to the map'));
        resolve(false);
        return;
      }
      const go = (label: string, cls = 'at-check') => {
        const b = h('button', { type: 'button', class: cls }, label);
        b.addEventListener('click', () => resolve(true));
        return b;
      };
      if (next!.reason === 'new') introduced.add(c.id);
      if (next!.reason === 'new' && hasExplainer(c.id) && (lectureState(explainerId(c.id))?.heard ?? 0) < 0.5) {
        frame.dock.append(go('Practice it now', 'at-ghost'), h('a', { class: 'at-check', href: `#/atlas/${c.id}/watch`, html: `${icon('playFill')} Watch the explainer` }));
      } else {
        frame.dock.append(h('a', { class: 'at-ghost', href: '#/atlas' }, 'Back to the map'), go(`Continue: ${c.title}`));
      }
    });

  const intro = (c: Concept, pick: Pick): Promise<void> =>
    new Promise((resolve) => {
      frame.body.dataset.concept = c.id;
      frame.body.innerHTML = '';
      frame.dock.innerHTML = '';
      const start = h('button', { type: 'button', class: hasExplainer(c.id) ? 'at-ghost' : 'at-check' }, 'Start practicing');
      start.addEventListener('click', () => resolve());
      const example = h('button', { type: 'button', class: 'at-stuck' }, 'Show a worked example first');
      example.addEventListener('click', async () => {
        const list = gens.get(c.id) ?? (await loadGenerators(c.id));
        gens.set(c.id, list);
        const g = list[0];
        if (!g) return;
        const w = g.make(new Rng(rng.int(2 ** 31)), pick.difficulty);
        const box = h('div', { class: 'at-worked' }, h('div', { class: 'at-prompt at-prompt-sm', html: render(w.prompt) }), solutionList(w.solution));
        example.replaceWith(box);
        fitMath(box);
      });
      frame.body.append(h('div', { class: 'at-intro', style: `--dom:var(--c-${domainOf(c).color})` },
        h('div', { class: 'at-kicker at-kicker-dom' }, `New concept · ${domainOf(c).title}`),
        h('h1', { class: 'at-title at-title-c' }, c.title),
        h('p', { class: 'at-lede' }, c.blurb),
        h('p', { class: 'at-why' }, whyNew(c.id, last)),
        h('p', { class: 'at-small' }, `You will practice it until ${c.mastery.streak} in a row are right, about ${c.mastery.seconds} s each. Then the next concept opens.`),
        example,
        learner.choices().open.length > 1 ? pickLink('Not this one? Choose another') : ''));
      if (hasExplainer(c.id)) frame.dock.append(h('a', { class: 'at-check', href: `#/atlas/${c.id}/watch`, html: `${icon('playFill')} Watch the explainer` }));
      frame.dock.append(start);
    });

  const summary = () => {
    const right = results.filter((r) => r.ok).length;
    frame.body.innerHTML = '';
    frame.dock.innerHTML = '';
    frame.body.append(h('div', { class: 'at-done' },
      h('div', { class: 'at-kicker' }, 'Session done'),
      h('h1', { class: 'at-title' }, `${right} of ${results.length} right`),
      masteredNow.length ? h('p', { class: 'at-lede', html: `Mastered: <b>${masteredNow.map((id) => learner.graph.get(id)!.title).join(', ')}</b>.` }) : h('p', { class: 'at-lede' }, 'No new mastery this time; the streaks carry over to the next session.'),
      reviews.size ? h('p', { class: 'at-small' }, `Reviews: ${kept()} of ${reviews.size} kept.`) : ''));
    const again = h('button', { type: 'button', class: 'at-ghost' }, 'Keep going');
    again.addEventListener('click', () => {
      results.length = 0;
      masteredNow.length = 0;
      showProgress();
      void loop();
    });
    frame.dock.append(again, h('a', { class: 'at-check', href: '#/atlas' }, 'Back to the map'));
  };

  const caughtUp = () => {
    frame.body.innerHTML = '';
    frame.dock.innerHTML = '';
    frame.body.append(h('div', { class: 'at-done' },
      h('div', { class: 'at-kicker' }, results.length ? 'Nothing left for now' : 'All caught up'),
      h('h1', { class: 'at-title' }, results.length ? plural(results.length, 'problem') + ' done' : 'Nothing is due'),
      h('p', { class: 'at-lede' }, 'Every concept you can reach is mastered and none is due for review. Come back tomorrow.')));
    frame.dock.append(h('a', { class: 'at-check', href: '#/atlas' }, 'Back to the map'));
  };

  void loop();
}
