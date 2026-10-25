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
import { atlasRoot, dots, plural, render } from './common';
import { explainerId } from './concept';
import { makePad } from './pads';

/** Problems per session: about fifteen minutes. */
export const SESSION_LENGTH = 20;

/** The full-screen frame a session or placement runs in: a header with progress, a scrolling body, a dock for keys. */
export function runFrame(main: HTMLElement, cls: string): { root: HTMLElement; body: HTMLElement; dock: HTMLElement; setProgress(done: number, total: number, label: string): void } {
  document.body.classList.add('at-on');
  onDispose(() => document.body.classList.remove('at-on'));
  const root = atlasRoot(`at-run ${cls}`);
  const fill = h('i', {});
  const label = h('span', { class: 'at-run-n' });
  root.append(h('header', { class: 'at-run-top' },
    h('a', { class: 'at-run-x', href: '#/atlas', 'aria-label': 'End the session', html: icon('close') }),
    h('div', { class: 'at-run-bar' }, fill),
    label));
  const body = h('div', { class: 'at-run-body' });
  const dock = h('div', { class: 'at-run-dock' });
  root.append(body, dock);
  main.append(root);
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
export function ask(frame: { body: HTMLElement; dock: HTMLElement }, opts: { problem: Problem; tag: HTMLElement; rng: Rng; worked?: () => Problem; target?: number; note?: string }): Promise<Asked> {
  const { problem: p, rng } = opts;
  frame.body.innerHTML = '';
  frame.dock.innerHTML = '';
  frame.body.scrollTop = 0;
  return new Promise((resolve) => {
    const check = h('button', { type: 'button', class: 'at-check', disabled: true }, 'Check');
    const pad = makePad(p.answer, rng, render, () => submit());
    const msg = h('div', { class: 'at-msg', role: 'status' });
    const hint = h('div', { class: 'at-hint' },
      opts.target ? h('span', { html: `${icon('clock')} target ${opts.target} s` }) : h('span', {}),
      h('span', {}, formatHint(p.answer)));
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
    });
    if (opts.note) frame.body.append(h('div', { class: 'at-transition' }, opts.note));
    frame.body.append(opts.tag, h('div', { class: 'at-prompt', html: render(p.prompt) }));
    if (p.code) frame.body.append(new CodePanel(p.code, { bare: true }).el);
    frame.body.append(pad.display, msg, hint, workedBox);
    if (stuck) frame.body.append(stuck);
    frame.dock.append(pad.keys, check);
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

function formatHint(a: Answer): string {
  switch (a.kind) {
    case 'number':
      return 'fractions like 3/4 work too';
    case 'shape':
      return 'one number per dimension';
    case 'vector':
      return 'entries separated by commas';
    case 'expr':
      return 'write 2x for 2 times x';
    default:
      return '';
  }
}

export function solutionList(steps: string[]): HTMLElement {
  return h('ol', { class: 'at-steps' }, ...steps.map((s) => h('li', { html: render(s) })));
}

/** The right answer, written the way the learner would have entered it. */
export function answerText(a: Answer): string {
  const num = (x: number, places?: number) => (places === undefined ? String(x) : x.toFixed(places));
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
function feedback(frame: { body: HTMLElement; dock: HTMLElement }, c: Concept, p: Problem, got: Asked, before: ConceptRecord, after: ConceptRecord, graph: Learner['graph']): Promise<void> {
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
    const unlocked = graph.dependents.get(c.id)!.filter((d) => graph.get(d)!.prereqs.every((pid) => pid === c.id || after.mastered));
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

export function renderSession(main: HTMLElement, learner: Learner, focus?: string): void {
  const frame = runFrame(main, 'at-session-run');
  const rng = new Rng((Date.now() ^ (Math.random() * 2 ** 32)) >>> 0);
  const gens = new Map<string, Generator[]>();
  const introduced = new Set<string>();
  const results: { id: string; ok: boolean }[] = [];
  const masteredNow: string[] = [];
  let last: string | undefined;
  frame.setProgress(0, SESSION_LENGTH, `0 of ${SESSION_LENGTH}`);

  const firstPick = (): Pick | null => {
    if (!focus || !learner.graph.get(focus) || learner.status(focus) === 'locked') return null;
    const rec = learner.record(focus);
    const s = learner.status(focus);
    return { concept: focus, reason: s === 'slipping' ? 'slipping' : s === 'due' || s === 'mastered' ? 'review' : rec.attempts ? 'learning' : 'new', difficulty: rec.attempts ? Math.min(1, streak(rec) / learner.graph.get(focus)!.mastery.streak) : 0 };
  };

  const loop = async () => {
    for (;;) {
      if (results.length >= SESSION_LENGTH) return summary();
      const pick = (results.length === 0 ? firstPick() : null) ?? learner.next(last);
      if (!pick) return caughtUp();
      const c = learner.graph.get(pick.concept)!;
      // A watched explainer is the introduction; otherwise offer it first.
      const fresh = pick.reason === 'new' && !introduced.has(c.id);
      if (fresh && (lectureState(explainerId(c.id))?.heard ?? 0) < 0.5) {
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
        problem,
        rng,
        tag,
        note: fresh && introduced.has(c.id) ? undefined : transition(pick, last),
        target: c.mastery.seconds,
        worked: () => gen.make(new Rng(rng.int(2 ** 31)), pick.difficulty),
      });
      const after = learner.answer(c.id, gen.id, { ok: got.verdict.ok, seconds: got.seconds, help: got.help });
      if (after.mastered && !before.mastered) masteredNow.push(c.id);
      tag.replaceWith(problemTag(c, pick, after));
      results.push({ id: c.id, ok: got.verdict.ok });
      last = c.id;
      frame.setProgress(results.length, SESSION_LENGTH, `${results.length} of ${SESSION_LENGTH}`);
      await feedback(frame, c, problem, got, before, after, learner.graph);
    }
  };

  const title = (id: string) => learner.graph.get(id)!.title;
  const names = (ids: string[]) => ids.map(title).join(ids.length > 2 ? ', ' : ' and ');

  /** Why this problem's concept follows the previous one, when it changes. */
  const transition = (pick: Pick, prev?: string): string | undefined => {
    if (pick.concept === prev) return undefined;
    const t = title(pick.concept);
    switch (pick.reason) {
      case 'review':
        return `A quick review of ${t}, mastered earlier, so it stays fresh.`;
      case 'slipping':
        return `${t} slipped on a review. A few right in a row bring it back.`;
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

  const intro = (c: Concept, pick: Pick): Promise<void> =>
    new Promise((resolve) => {
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
        example.replaceWith(h('div', { class: 'at-worked' }, h('div', { class: 'at-prompt at-prompt-sm', html: render(w.prompt) }), solutionList(w.solution)));
      });
      frame.body.append(h('div', { class: 'at-intro', style: `--dom:var(--c-${domainOf(c).color})` },
        h('div', { class: 'at-kicker at-kicker-dom' }, `New concept · ${domainOf(c).title}`),
        h('h1', { class: 'at-title at-title-c' }, c.title),
        h('p', { class: 'at-lede' }, c.blurb),
        h('p', { class: 'at-why' }, whyNew(c.id, last)),
        h('p', { class: 'at-small' }, `You will practice it until ${c.mastery.streak} in a row are right, about ${c.mastery.seconds} s each. Then the next concept opens.`),
        example));
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
      masteredNow.length ? h('p', { class: 'at-lede', html: `Mastered: <b>${masteredNow.map((id) => learner.graph.get(id)!.title).join(', ')}</b>.` }) : h('p', { class: 'at-lede' }, 'No new mastery this time; the streaks carry over to the next session.')));
    const again = h('button', { type: 'button', class: 'at-ghost' }, 'Keep going');
    again.addEventListener('click', () => {
      results.length = 0;
      masteredNow.length = 0;
      frame.setProgress(0, SESSION_LENGTH, `0 of ${SESSION_LENGTH}`);
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
