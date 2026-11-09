// Where every concept sits in Explore's two drawings of a course, and the arithmetic of looking at them. Geometry comes
// only from the graph, never from progress, so it is known before any record is read and nothing moves when state lands.
import { wrapTitle } from '../../domain/part-layout';

export interface GeoConcept {
  id: string;
  title: string;
  domain: string;
  prereqs: readonly string[];
}

/** A course as the drawings need it: chapters in tour order, concepts in graph order. */
export interface GeoCourse {
  chapters: readonly { id: string; title: string }[];
  concepts: readonly GeoConcept[];
}

/** What a course offers to be read as one. */
export const geoOf = (course: { domains: readonly { id: string; title: string }[]; graph: { order: readonly GeoConcept[] } }): GeoCourse => ({
  chapters: course.domains.filter((d) => course.graph.order.some((c) => c.domain === d.id)),
  concepts: course.graph.order,
});

export const CARD = { w: 138, h: 58 };

export interface Spot {
  id: string;
  x: number;
  y: number;
  title: string;
  lines: string[];
  chapter: string;
}

export interface Edge {
  a: string;
  b: string;
  /** Crosses from one chapter to another. */
  cross: boolean;
}

export interface Region {
  id: string;
  title: string;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  gridRow: number;
  concepts: string[];
}

export interface Geometry {
  W: number;
  H: number;
  nodes: Readonly<Record<string, Spot>>;
  edges: readonly Edge[];
  /** Chapters as regions; none on the map of the whole graph. */
  regions: readonly Region[];
  /** The tour as a line through the regions, one segment per step from chapter to chapter. */
  spine: readonly string[];
}

export interface Box {
  w: number;
  h: number;
}

export interface View {
  z: number;
  tx: number;
  ty: number;
}

/** The shape a course is laid out to fit best: a phone's map, in portrait. */
const TARGET: Box = { w: 386, h: 700 };

// ---- chapters ----

const CH = { gx: 12, gy: 30, pad: 16, head: 124, gap: 34, perRow: 3, maxWrap: 3200, wrapStep: 40 };
/** A course bigger than this keeps its regions wide enough to name at the smallest scale. */
const CROWDED = 40;
const MIN_REGION = 400;

interface Draft {
  id: string;
  title: string;
  index: number;
  concepts: string[];
  rows: string[][];
  fx: Map<string, number>;
  naturalW: number;
  naturalH: number;
}

function draftRegion(id: string, title: string, index: number, concepts: readonly GeoConcept[], minW: number): Draft {
  const inside = new Set(concepts.map((c) => c.id));
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const within = (c: GeoConcept) => c.prereqs.filter((p) => inside.has(p));
  const depth = new Map<string, number>();
  const depthOf = (c: GeoConcept): number => {
    let d = depth.get(c.id);
    if (d === undefined) depth.set(c.id, (d = Math.max(-1, ...within(c).map((p) => depthOf(byId.get(p)!))) + 1));
    return d;
  };
  const levels: GeoConcept[][] = [];
  for (const c of concepts) (levels[depthOf(c)] ??= []).push(c);
  const fx = new Map<string, number>();
  const rows: string[][] = [];
  for (const level of levels) {
    if (!level) continue;
    const near = (c: GeoConcept) => {
      const xs = within(c).map((p) => fx.get(p)!);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0.5;
    };
    const sorted = [...level].sort((a, b) => near(a) - near(b));
    for (let i = 0; i < sorted.length; i += CH.perRow) {
      const chunk = sorted.slice(i, i + CH.perRow);
      chunk.forEach((c, k) => fx.set(c.id, (k + 0.5) / chunk.length));
      rows.push(chunk.map((c) => c.id));
    }
  }
  const cols = Math.max(...rows.map((r) => r.length));
  return {
    id, title, index, rows, fx,
    concepts: concepts.map((c) => c.id),
    naturalW: Math.max(minW, cols * CARD.w + (cols - 1) * CH.gx + 2 * CH.pad),
    naturalH: rows.length * CARD.h + (rows.length - 1) * CH.gy + CH.head + CH.pad,
  };
}

function wrapRows(regions: readonly Draft[], target: number): Draft[][] {
  const rows: Draft[][] = [];
  let cur: Draft[] = [];
  let w = 0;
  for (const r of regions) {
    const need = (cur.length ? CH.gap : 0) + r.naturalW;
    if (cur.length && w + need > target) {
      rows.push(cur);
      cur = [];
      w = 0;
    }
    w += (cur.length ? CH.gap : 0) + r.naturalW;
    cur.push(r);
  }
  if (cur.length) rows.push(cur);
  return rows;
}

const rowWidth = (row: readonly Draft[]) => row.reduce((a, r) => a + r.naturalW, 0) + (row.length - 1) * CH.gap;
const rowsHeight = (rows: readonly (readonly Draft[])[]) => rows.reduce((a, row) => a + Math.max(...row.map((r) => r.naturalH)), 0) + (rows.length - 1) * (CH.gap + 8);

/** Each chapter a region, in tour order, snaking across a page sized to fit a phone. */
export function layoutChapters(course: GeoCourse, view: Box = TARGET): Geometry {
  const minW = course.concepts.length > CROWDED ? MIN_REGION : 0;
  const drafts = course.chapters.map((ch, i) => draftRegion(ch.id, ch.title, i, course.concepts.filter((c) => c.domain === ch.id), minW));
  let best: { z: number; rows: Draft[][]; W: number; H: number } | null = null;
  for (let t = Math.max(...drafts.map((r) => r.naturalW)); t <= CH.maxWrap; t += CH.wrapStep) {
    const rows = wrapRows(drafts, t);
    const W = Math.max(...rows.map(rowWidth));
    const H = rowsHeight(rows);
    const z = Math.min(view.w / W, view.h / H);
    if (!best || z > best.z + 1e-6) best = { z, rows, W, H };
  }
  const { rows, W, H } = best!;
  const nodes: Record<string, Spot> = {};
  const regions: Region[] = [];
  const titled = new Map(course.concepts.map((c) => [c.id, c]));
  let y = 0;
  rows.forEach((row, gridRow) => {
    // A chapter alone on a row keeps its width, under where the tour left the row before.
    const alone = row.length === 1 && rows.length > 1;
    const stretch = alone ? 0 : (W - rowWidth(row)) / row.reduce((a, r) => a + r.naturalW, 0);
    const rowH = Math.max(...row.map((r) => r.naturalH));
    // A row runs the other way from the last, so the tour never crosses the page to carry on.
    const across = gridRow % 2 ? [...row].reverse() : row;
    let x = alone && gridRow % 2 ? W - row[0]!.naturalW : 0;
    for (const d of across) {
      const w = d.naturalW * (1 + stretch);
      regions[d.index] = { id: d.id, title: d.title, index: d.index, x, y, w, h: rowH, gridRow, concepts: d.concepts };
      const innerW = w - 2 * CH.pad;
      d.rows.forEach((ids, k) => {
        const cy = y + CH.head + k * (CARD.h + CH.gy);
        for (const id of ids) {
          const c = titled.get(id)!;
          nodes[id] = { id, x: x + CH.pad + innerW * d.fx.get(id)! - CARD.w / 2, y: cy, title: c.title, lines: wrapTitle(c.title, 18), chapter: c.domain };
        }
      });
      x += w + CH.gap;
    }
    y += rowH + CH.gap + 8;
  });
  const chapterOf = new Map(course.concepts.map((c) => [c.id, c.domain]));
  const edges = course.concepts.flatMap((c) => c.prereqs.map((a) => ({ a, b: c.id, cross: chapterOf.get(a) !== c.domain })));
  return { W, H, nodes, edges, regions, spine: spineOf(regions) };
}

function spineOf(regions: readonly Region[]): string[] {
  return regions.slice(0, -1).map((a, i) => {
    const b = regions[i + 1]!;
    if (a.gridRow === b.gridRow) {
      const y0 = a.y + 34;
      const ltr = b.x > a.x;
      return `M${ltr ? a.x + a.w : a.x} ${y0} L${ltr ? b.x : b.x + b.w} ${y0}`;
    }
    const x0 = a.x + a.w / 2;
    const y0 = a.y + a.h;
    const x1 = b.x + b.w / 2;
    const my = (y0 + b.y) / 2;
    return `M${x0} ${y0} C${x0} ${my} ${x1} ${my} ${x1} ${b.y}`;
  });
}

// ---- the whole graph ----

const MAP = { gx: 14, gy: 46, passes: 6, minPerRow: 4, maxPerRow: 16 };

/** Positions in order that sit closest to `want` while staying `step` apart: pools adjacent violators of the spacing. */
export function packRow(want: readonly number[], step: number): number[] {
  const blocks: { sum: number; n: number }[] = [];
  want.forEach((w, i) => {
    blocks.push({ sum: w - i * step, n: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1]!;
      const a = blocks[blocks.length - 2]!;
      if (a.sum / a.n <= b.sum / b.n) break;
      a.sum += b.sum;
      a.n += b.n;
      blocks.pop();
    }
  });
  const out: number[] = [];
  for (const b of blocks) for (let k = 0; k < b.n; k++) out.push(b.sum / b.n + out.length * step);
  return out;
}

/** Concepts by depth, each layer sorted by where its neighbors sit, so edges cross less. */
function orderedLayers(course: GeoCourse): { layers: string[][]; prereqs: Map<string, readonly string[]>; dependents: Map<string, string[]> } {
  const prereqs = new Map(course.concepts.map((c) => [c.id, c.prereqs]));
  const dependents = new Map<string, string[]>(course.concepts.map((c) => [c.id, []]));
  for (const c of course.concepts) for (const p of c.prereqs) dependents.get(p)!.push(c.id);
  const depth = new Map<string, number>();
  const depthOf = (id: string): number => {
    let d = depth.get(id);
    if (d === undefined) depth.set(id, (d = Math.max(-1, ...prereqs.get(id)!.map(depthOf)) + 1));
    return d;
  };
  const layers: string[][] = [];
  for (const c of course.concepts) (layers[depthOf(c.id)] ??= []).push(c.id);
  const rank = new Map<string, number>();
  const note = () => layers.forEach((l) => l.forEach((id, i) => rank.set(id, (i + 0.5) / l.length)));
  note();
  const sweep = (l: string[], next: (id: string) => readonly string[]) => {
    const at = (id: string) => {
      const ns = next(id);
      return ns.length ? ns.reduce((a, n) => a + rank.get(n)!, 0) / ns.length : rank.get(id)!;
    };
    const keyed = new Map(l.map((id) => [id, at(id)]));
    l.sort((a, b) => keyed.get(a)! - keyed.get(b)!);
    l.forEach((id, i) => rank.set(id, (i + 0.5) / l.length));
  };
  for (let pass = 0; pass < MAP.passes; pass++) {
    for (const l of layers.slice(1)) sweep(l, (id) => prereqs.get(id)!);
    for (const l of [...layers].reverse().slice(1)) sweep(l, (id) => dependents.get(id)!);
  }
  for (const l of layers.slice(1)) sweep(l, (id) => prereqs.get(id)!);
  return { layers, prereqs, dependents };
}

function placeRows(rows: readonly string[][], prereqs: Map<string, readonly string[]>, dependents: Map<string, string[]>): Map<string, number> {
  const step = CARD.w + MAP.gx;
  const x = new Map<string, number>();
  rows.forEach((row) => row.forEach((id, i) => x.set(id, (i - (row.length - 1) / 2) * step)));
  const settle = (row: string[], next: (id: string) => readonly string[], resort: boolean) => {
    const want = new Map(row.map((id) => {
      const ns = next(id);
      return [id, ns.length ? ns.reduce((a, n) => a + x.get(n)!, 0) / ns.length : x.get(id)!] as const;
    }));
    const ordered = resort ? [...row].sort((a, b) => want.get(a)! - want.get(b)!) : row;
    packRow(ordered.map((id) => want.get(id)!), step).forEach((v, i) => x.set(ordered[i]!, v));
    if (resort) row.splice(0, row.length, ...ordered);
  };
  const working = rows.map((r) => [...r]);
  for (let pass = 0; pass < MAP.passes; pass++) {
    const resort = pass < 3;
    for (const r of working.slice(1)) settle(r, (id) => prereqs.get(id)!, resort);
    for (const r of [...working].reverse().slice(1)) settle(r, (id) => dependents.get(id)!, resort);
  }
  for (const r of working.slice(1)) settle(r, (id) => prereqs.get(id)!, false);
  return x;
}

/** The complete graph as one drawing: a row for every depth, prerequisites above, wrapped only as far as fits a phone. */
export function layoutMap(course: GeoCourse, view: Box = TARGET): Geometry {
  const { layers, prereqs, dependents } = orderedLayers(course);
  const present = layers.filter(Boolean);
  const widest = Math.max(...present.map((l) => l.length));
  let best: { z: number; rows: string[][]; x: Map<string, number>; W: number; H: number; min: number } | null = null;
  for (let perRow = Math.min(MAP.minPerRow, widest); perRow <= Math.min(MAP.maxPerRow, widest); perRow++) {
    const rows = present.flatMap((l) => Array.from({ length: Math.ceil(l.length / perRow) }, (_, i) => l.slice(i * perRow, (i + 1) * perRow)));
    const x = placeRows(rows, prereqs, dependents);
    const xs = [...x.values()];
    const min = Math.min(...xs);
    const W = Math.max(...xs) - min + CARD.w;
    const H = rows.length * (CARD.h + MAP.gy) - MAP.gy;
    const z = Math.min(view.w / W, view.h / H);
    if (!best || z >= best.z - 1e-6) best = { z, rows, x, W, H, min };
  }
  const { rows, x, W, H, min } = best!;
  const titled = new Map(course.concepts.map((c) => [c.id, c]));
  const nodes: Record<string, Spot> = {};
  rows.forEach((row, k) => {
    for (const id of row) {
      const c = titled.get(id)!;
      nodes[id] = { id, x: x.get(id)! - min, y: k * (CARD.h + MAP.gy), title: c.title, lines: wrapTitle(c.title, 18), chapter: c.domain };
    }
  });
  const edges = course.concepts.flatMap((c) => c.prereqs.map((a) => ({ a, b: c.id, cross: false })));
  return { W, H, nodes, edges, regions: [], spine: [] };
}

// ---- looking at it ----

const MARGIN = 10;
/** Past this, a course as small as Nix would only be blown up. */
const MOST_FIT = 1.05;
const MOST_ZOOM = 1.4;
/** How far past its edge a drawing may be pulled. */
const SLACK = 48;

export type Lod = 0 | 1 | 2;

/** Tiles when zoomed out, short titles between, full cards up close. Positions are the same at all three. */
export const lodOf = (z: number): Lod => (z < 0.4 ? 0 : z < 0.62 ? 1 : 2);

export function fitView(g: Pick<Geometry, 'W' | 'H'>, box: Box): View {
  const z = Math.max(0.02, Math.min((box.w - 2 * MARGIN) / g.W, (box.h - 2 * MARGIN) / g.H, MOST_FIT));
  return { z, tx: (box.w - g.W * z) / 2, ty: (box.h - g.H * z) / 2 };
}

export const zoomLimits = (g: Pick<Geometry, 'W' | 'H'>, box: Box): [number, number] => {
  const fit = fitView(g, box).z;
  return [fit * 0.9, Math.max(MOST_ZOOM, fit)];
};

/** Keeps the drawing on screen: centered along an axis it fits, else no further than a small slack past either edge. `bottom` is covered by a sheet. */
export function clampView(v: View, g: Pick<Geometry, 'W' | 'H'>, box: Box, bottom = 0): View {
  const axis = (t: number, size: number, room: number, extra: number) => {
    if (size <= room) return Math.min((room - size) / 2 + extra, Math.max((room - size) / 2 - extra, t));
    return Math.min(SLACK, Math.max(room - size - SLACK - extra, t));
  };
  return { z: v.z, tx: axis(v.tx, g.W * v.z, box.w, 0), ty: axis(v.ty, g.H * v.z, box.h, bottom) };
}

/** `v` scaled by `k` about the screen point (`cx`, `cy`), within the limits. */
export function zoomAround(v: View, k: number, cx: number, cy: number, [lo, hi]: readonly [number, number]): View {
  const z = Math.max(lo, Math.min(hi, v.z * k));
  const f = z / v.z;
  return { z, tx: cx - (cx - v.tx) * f, ty: cy - (cy - v.ty) * f };
}

/** The view that puts a concept at the fraction `fy` of the box's height. */
export function centerOn(g: Pick<Geometry, 'nodes'>, id: string, box: Box, z: number, fy: number): View {
  const n = g.nodes[id]!;
  return { z, tx: box.w / 2 - (n.x + CARD.w / 2) * z, ty: box.h * fy - (n.y + CARD.h / 2) * z };
}

export function regionView(r: Region, box: Box): View {
  const z = Math.min(MOST_ZOOM, (box.w - 24) / r.w, (box.h - 24) / r.h);
  return { z, tx: box.w / 2 - (r.x + r.w / 2) * z, ty: box.h / 2 - (r.y + r.h / 2) * z };
}

export const regionAt = (g: Pick<Geometry, 'regions'>, x: number, y: number): Region | undefined =>
  g.regions.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);

/** The nearest region to a point, for naming where the screen's center is. */
export function nearestRegion(g: Pick<Geometry, 'regions'>, x: number, y: number): Region | undefined {
  let best: Region | undefined;
  let far = Infinity;
  for (const r of g.regions) {
    const d = Math.max(r.x - x, 0, x - r.x - r.w) + Math.max(r.y - y, 0, y - r.y - r.h);
    if (d < far) {
      far = d;
      best = r;
    }
  }
  return best;
}

/** The concept at a point of the drawing, within `reach` of its card; the closest when several are. */
export function hitNode(g: Pick<Geometry, 'nodes'>, x: number, y: number, reach: number): string | null {
  let best: string | null = null;
  let far = Infinity;
  for (const n of Object.values(g.nodes)) {
    const dx = Math.max(n.x - x, 0, x - n.x - CARD.w);
    const dy = Math.max(n.y - y, 0, y - n.y - CARD.h);
    if (dx > reach || dy > reach) continue;
    const d = Math.hypot(x - n.x - CARD.w / 2, y - n.y - CARD.h / 2);
    if (d < far) {
      far = d;
      best = n.id;
    }
  }
  return best;
}

export function edgePath(g: Pick<Geometry, 'nodes'>, e: Edge): string {
  const a = g.nodes[e.a]!;
  const b = g.nodes[e.b]!;
  const x1 = a.x + CARD.w / 2;
  const y1 = a.y + CARD.h;
  const x2 = b.x + CARD.w / 2;
  const y2 = b.y;
  if (y2 >= y1) {
    const m = (y1 + y2) / 2;
    return `M${x1} ${y1} C${x1} ${m} ${x2} ${m} ${x2} ${y2}`;
  }
  // A prerequisite drawn below what needs it, from a later row of the snake.
  const d = Math.max(40, Math.abs(x2 - x1) * 0.3);
  return `M${x1} ${y1} C${x1} ${y1 + d} ${x2} ${y2 - d} ${x2} ${y2}`;
}

/** A title in at most two short lines, for a tile at the middle zoom. */
export function shortLines(title: string): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of title.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 11 && line) {
      if (out.length === 1) return [out[0]!, `${line}…`];
      out.push(line);
      line = word;
    } else line = next;
  }
  out.push(line);
  return out;
}
