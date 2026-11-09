// Explore's two drawings of a course: Chapters (regions in tour order, the tour as a line through them) and Map (the
// complete graph as one drawing). Both zoom semantically over one geometry: tiles, then short titles, then full cards.
import { icon } from '../../../core/controls';
import { escapeHtml as esc } from '../../../core/dom';
import { streak, type Status } from '../../domain/model';
import type { Learner } from '../../learner';
import { roman } from '../common';
import { openConceptSheet } from '../concept-sheet';
import { leadGoal, nextStep, tour } from '../next-step';
import { pinSymbol, symbolOf } from './glyphs';
import { CARD, centerOn, edgePath, fitView, geoOf, hitNode, layoutChapters, layoutMap, lodOf, nearestRegion, regionAt, regionView, shortLines, type Geometry, type Lod, type Region, type View } from './layout';
import { Stage } from './stage';

export type GraphKind = 'chapters' | 'map';

export interface GraphHandle {
  /** Flies to where the learner is. */
  locate(): void;
  /** Flies to a concept and opens its sheet. */
  show(id: string): void;
  /** Dims everything but these, or nothing. */
  light(ids: readonly string[] | null): void;
}

/** The two drawings, per course: geometry never changes with progress, so each is worked out once. */
const geometries = new Map<string, Geometry>();
/** Where the learner left each drawing, kept across a run and back. */
const left = new Map<string, View>();

const DONE: ReadonlySet<Status> = new Set<Status>(['mastered', 'due', 'slipping']);

const SYMBOLS = ['check', 'clock', 'lock', 'reset'].map((g) => symbolOf(icon(g), `ex-${g}`)).join('') + pinSymbol;

/** The concept the learner is on: a review block comes first on the line, but the place on the map is what follows it. */
function placeOf(learner: Learner): string | undefined {
  const step = nextStep(learner);
  if ('concept' in step) return step.concept;
  if (step.kind !== 'review') return undefined;
  const line = tour(learner);
  return line.find((c) => learner.status(c.id) === 'learning')?.id ?? leadGoal(learner)?.next ?? line.find((c) => learner.status(c.id) === 'new')?.id;
}

export function mountGraph(box: HTMLElement, learner: Learner, kind: GraphKind): GraphHandle {
  const { course, graph } = learner;
  const memo = `${course.id}/${kind}`;
  let found = geometries.get(memo);
  if (!found) geometries.set(memo, (found = kind === 'chapters' ? layoutChapters(geoOf(course)) : layoutMap(geoOf(course))));
  const geo: Geometry = found;
  const st = learner.statuses();
  const statusOf = (id: string): Status => st.get(id) ?? 'locked';
  const here = placeOf(learner);
  const hereRegion = here ? geo.nodes[here]!.chapter : undefined;
  const isDone = (id: string) => DONE.has(statusOf(id));

  let selected: string | null = null;
  let picked: ReadonlySet<string> | null = null;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ex-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${kind === 'chapters' ? 'Chapters' : 'Map'} of ${course.title}: ${learner.masteredCount()} of ${graph.order.length} concepts mastered. The List view has the same concepts as text.`);
  svg.innerHTML = `<defs>${SYMBOLS}</defs><g class="ex-world"></g><g class="ex-over"></g>`;
  const world = svg.querySelector('.ex-world')!;
  const over = svg.querySelector('.ex-over')!;
  const pill = document.createElement('div');
  pill.className = 'ex-pill';
  pill.hidden = true;
  box.append(svg, pill);

  const size = { w: box.clientWidth, h: box.clientHeight };
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `10.8px ${getComputedStyle(box).getPropertyValue('--font-display')}`;

  /** A selected concept, all it builds on and what it unlocks; else what a search found. */
  const litSet = (): ReadonlySet<string> | null => {
    if (!selected) return picked;
    const ids = graph.ancestors(selected);
    for (const d of graph.dependents.get(selected) ?? []) ids.add(d);
    return ids;
  };

  const lineOf = (e: { a: string; b: string }, anc: ReadonlySet<string> | null): boolean =>
    !!anc && !!selected && ((anc.has(e.a) && anc.has(e.b)) || e.a === selected);

  const regionFrame = (r: Region, L: Lod): string => {
    const done = r.concepts.filter(isDone).length;
    let out = `<rect class="ex-rg${r.id === hereRegion ? ' cur' : ''}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${L === 2 ? 16 : 14}"/>`;
    const px = r.x + 16;
    const n = roman(r.index + 1);
    if (L === 2) {
      out += `<text class="ex-r-k" x="${px}" y="${r.y + 28}">CHAPTER ${n}</text><text class="ex-r-t" x="${px}" y="${r.y + 58}">${esc(r.title)}</text><text class="ex-r-s" x="${px}" y="${r.y + 82}">${done} of ${r.concepts.length} mastered</text>`;
    } else if (L === 1) out += `<text class="ex-r-t" x="${px}" y="${r.y + 50}">${n}  ${esc(r.title)}</text>`;
    return out;
  };

  const mark = (id: string, s: Status): string => {
    const cx = CARD.w / 2;
    const y = CARD.h - 12;
    const glyph = (name: string, g: number, dx = 0) => `<use class="ex-gl" href="#ex-${name}" x="${cx - g / 2 + dx}" y="${y - g + 3}" width="${g}" height="${g}"/>`;
    const word = (t: string, dx = 0) => `<text class="ex-mk" x="${cx + dx}" y="${y + 1}">${t}</text>`;
    switch (s) {
      case 'mastered':
        return glyph('check', 12);
      case 'locked':
        return glyph('lock', 11);
      case 'due':
        return glyph('clock', 11, -19) + word('review', 8);
      case 'slipping':
        return glyph('reset', 11, -22) + word('slipping', 8);
      case 'new':
        return word('open');
      case 'learning': {
        const need = graph.get(id)!.mastery.streak;
        const have = Math.min(need, streak(learner.record(id)));
        const x0 = cx - ((need - 1) * 7) / 2;
        return Array.from({ length: need }, (_, i) => `<circle class="ex-dot${i < have ? ' on' : ''}" cx="${x0 + i * 7}" cy="${y - 2}" r="2.2"/>`).join('');
      }
    }
  };

  function drawWorld(L: Lod): void {
    const lit = litSet();
    const dim = (id: string) => (lit && !lit.has(id) ? ' dim' : '');
    const anc = selected ? litSet() : null;
    let s = '';
    for (const r of geo.regions) s += regionFrame(r, L);
    if (geo.spine.length) {
      const reached = hereRegion ? geo.regions.findIndex((r) => r.id === hereRegion) : geo.regions.length;
      geo.spine.forEach((d, i) => (s += `<path class="ex-sp${i < reached ? '' : ' ahead'}" d="${d}"/>`));
    }
    const stubs = new Map<string, number>();
    for (const e of geo.edges) {
      const on = lineOf(e, anc);
      if (e.cross && L >= 1 && !on) {
        // Near a card, an edge from another chapter is a short stem: the full line is only drawn once it is asked for.
        const b = geo.nodes[e.b]!;
        const i = (stubs.get(e.b) ?? -1) + 1;
        stubs.set(e.b, i);
        const x = b.x + CARD.w / 2 + (i % 2 ? 1 : -1) * Math.ceil(i / 2 + 1) * 12;
        s += `<path class="ex-e stub${lit ? ' dim' : ''}" d="M${x} ${b.y} L${x} ${b.y - 16}"/><circle class="ex-stub${lit ? ' dim' : ''}" cx="${x}" cy="${b.y - 19}" r="2.8"/>`;
        continue;
      }
      s += `<path class="ex-e ${e.cross ? 'cr' : 'in'}${L}${on ? ' on' : selected ? ' dim' : ''}" d="${edgePath(geo, e)}"/>`;
    }
    for (const n of Object.values(geo.nodes)) {
      const state = statusOf(n.id);
      if (L < 2) {
        s += `<rect class="ex-tl st-${state}${dim(n.id)}" x="${n.x}" y="${n.y}" width="${CARD.w}" height="${CARD.h}" rx="11"/>`;
        if (L === 0) {
          if (state === 'learning') s += `<rect class="ex-tl-h" x="${n.x}" y="${n.y}" width="${CARD.w / 2}" height="${CARD.h}" rx="11"/>`;
          if (state === 'due') s += `<circle class="ex-tl-m" cx="${n.x + CARD.w / 2}" cy="${n.y + CARD.h / 2}" r="12"/>`;
          if (state === 'slipping') s += `<rect class="ex-tl-m" x="${n.x + 28}" y="${n.y + CARD.h / 2 - 5}" width="${CARD.w - 56}" height="10" rx="5"/>`;
        } else {
          if (state === 'learning') s += `<rect class="ex-tl-h" x="${n.x + 12}" y="${n.y + CARD.h - 9}" width="${(CARD.w - 24) / 2}" height="4" rx="2"/>`;
          const short = shortLines(n.title);
          const cls = DONE.has(state) ? ' on' : state === 'locked' ? ' off' : '';
          short.forEach((t, i) => (s += `<text class="ex-tl-t${cls}" x="${n.x + CARD.w / 2}" y="${n.y + (short.length === 1 ? 36 : 25 + i * 21)}">${esc(t)}</text>`));
        }
        continue;
      }
      const lines = n.lines;
      const y0 = (CARD.h - 14 - lines.length * 15.5) / 2 + 11;
      s += `<g class="ex-nd st-${state}${n.id === here ? ' cur' : ''}${n.id === selected ? ' sel' : ''}${dim(n.id)}" transform="translate(${n.x} ${n.y})">`
        + (n.id === here ? `<rect class="ex-glow" x="-5" y="-5" width="${CARD.w + 10}" height="${CARD.h + 10}" rx="15"/>` : '')
        + `<rect class="ex-card" width="${CARD.w}" height="${CARD.h}" rx="11"/>`
        + lines.map((t, i) => `<text x="${CARD.w / 2}" y="${y0 + i * 15.5}">${esc(t)}</text>`).join('')
        + mark(n.id, state) + '</g>';
    }
    world.innerHTML = s;
  }

  function titleLines(text: string, width: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure.measureText(next).width > width && lines.length < 1) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
    return lines;
  }

  function drawOver(v: View, L: Lod): void {
    let s = '';
    if (L === 0) {
      for (const r of geo.regions) {
        const x = r.x * v.z + v.tx + 6;
        const y = r.y * v.z + v.ty + 11;
        titleLines(`${roman(r.index + 1)}  ${r.title}`, r.w * v.z - 11).forEach((t, i) => (s += `<text class="ex-o-t" x="${x}" y="${y + i * 11}">${esc(t)}</text>`));
      }
    }
    if (here) {
      const n = geo.nodes[here]!;
      const x = n.x * v.z + v.tx;
      const y = n.y * v.z + v.ty;
      const w = CARD.w * v.z;
      const h = CARD.h * v.z;
      if (L < 2) {
        s += `<rect class="ex-ring" x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="5"/>`
          + `<circle class="ex-pin-bg" cx="${x + w / 2}" cy="${y - 14}" r="9.5"/>`
          + `<use class="ex-pin" href="#ex-pin" x="${x + w / 2 - 11}" y="${y - 25}" width="22" height="22"/>`;
      } else if (!selected) {
        const lx = x + w / 2 - 41;
        const ly = y - 30;
        s += `<g class="ex-here"><rect x="${lx}" y="${ly}" width="82" height="21" rx="10.5"/><text x="${lx + 41}" y="${ly + 14.5}">You are here</text></g>`;
      }
    }
    over.innerHTML = s;
  }

  function name(v: View, L: Lod): void {
    if (L < 2 || geo.regions.length < 5 || selected) {
      pill.hidden = true;
      return;
    }
    const r = nearestRegion(geo, (size.w / 2 - v.tx) / v.z, (size.h / 2 - v.ty) / v.z);
    if (!r) return;
    pill.textContent = `${roman(r.index + 1)}  ·  ${r.title}`;
    pill.hidden = false;
  }

  let drawn: Lod | -1 = -1;
  function paint(v: View, force = false): void {
    size.w = box.clientWidth;
    size.h = box.clientHeight;
    left.set(memo, v);
    world.setAttribute('transform', `translate(${v.tx} ${v.ty}) scale(${v.z})`);
    const L = lodOf(v.z);
    if (force || L !== drawn) {
      drawWorld(L);
      drawn = L;
    }
    drawOver(v, L);
    name(v, L);
  }

  const select = (id: string): void => {
    selected = id;
    paint(stage.view, true);
    openConceptSheet(learner, id, {
      onChip: select,
      onClose: () => {
        selected = null;
        stage.cover(0);
        paint(stage.view, true);
      },
    });
    const sheet = document.querySelector<HTMLElement>('.sh');
    const covered = sheet ? Math.max(0, box.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top) : 0;
    stage.cover(covered);
    const b = stage.size();
    stage.flyTo(centerOn(geo, id, b, Math.max(stage.view.z, 0.85), Math.max(0.2, (b.h - covered) / 2 / b.h)));
  };

  const stage = new Stage(box, geo, left.get(memo) ?? fitView(geo, size), {
    change: (v) => paint(v),
    tap: (x, y) => {
      const v = stage.view;
      const wx = (x - v.tx) / v.z;
      const wy = (y - v.ty) / v.z;
      if (lodOf(v.z) === 0) {
        const r = regionAt(geo, wx, wy);
        if (r) stage.flyTo(regionView(r, stage.size()));
        else if (kind === 'map') stage.flyTo({ z: 0.75, tx: size.w / 2 - wx * 0.75, ty: size.h / 2 - wy * 0.75 });
        return;
      }
      const id = hitNode(geo, wx, wy, 14 / v.z);
      if (id) select(id);
    },
  });
  paint(stage.view, true);

  return {
    locate: () => {
      if (here) stage.flyTo(centerOn(geo, here, stage.size(), Math.max(stage.view.z, 0.9), 0.42));
    },
    show: select,
    light: (ids) => {
      picked = ids ? new Set(ids) : null;
      paint(stage.view, true);
    },
  };
}

/** The mastery key shown under both drawings. */
export const LEGEND: [string, string][] = [['done', 'Mastered'], ['due', 'Due'], ['slip', 'Slipping'], ['learn', 'Learning'], ['open', 'Open'], ['lock', 'Locked']];

