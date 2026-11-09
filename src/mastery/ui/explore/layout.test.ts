import { describe, expect, it } from 'vitest';
import { courseById } from '../../../courses/index';
import { CARD, centerOn, clampView, fitView, geoOf, hitNode, layoutChapters, layoutMap, lodOf, packRow, shortLines, zoomAround, type Geometry } from './layout';

const box = { w: 402, h: 700 };
const books = [courseById('dl')!, courseById('nix')!].map((c) => ({ name: c.title, course: c, geo: geoOf(c) }));

const overlap = (g: Geometry) => {
  const list = Object.values(g.nodes);
  return list.filter((a, i) => list.slice(i + 1).some((b) => Math.abs(a.x - b.x) < CARD.w && Math.abs(a.y - b.y) < CARD.h));
};

describe.each(books)('$name', ({ course, geo }) => {
  const chapters = layoutChapters(geo);
  const map = layoutMap(geo);

  it('places every concept once, in both drawings', () => {
    for (const g of [chapters, map]) {
      expect(Object.keys(g.nodes).sort()).toEqual(course.graph.order.map((c) => c.id).sort());
      expect(g.edges.length).toBe(course.graph.order.reduce((a, c) => a + c.prereqs.length, 0));
    }
  });

  it('never lets two cards touch', () => {
    expect(overlap(chapters)).toEqual([]);
    expect(overlap(map)).toEqual([]);
  });

  it('holds each chapter inside its region, regions apart and in tour order', () => {
    expect(chapters.regions.map((r) => r.id)).toEqual(geo.chapters.map((c) => c.id));
    for (const r of chapters.regions) {
      for (const id of r.concepts) {
        const n = chapters.nodes[id]!;
        expect(n.x).toBeGreaterThanOrEqual(r.x);
        expect(n.y).toBeGreaterThanOrEqual(r.y);
        expect(n.x + CARD.w).toBeLessThanOrEqual(r.x + r.w);
        expect(n.y + CARD.h).toBeLessThanOrEqual(r.y + r.h);
      }
    }
    for (const a of chapters.regions) {
      for (const b of chapters.regions) {
        if (a !== b) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
      }
    }
    expect(chapters.spine.length).toBe(chapters.regions.length - 1);
  });

  it('draws every prerequisite above what needs it on the map', () => {
    for (const e of map.edges) expect(map.nodes[e.a]!.y).toBeLessThan(map.nodes[e.b]!.y);
    expect(map.regions).toEqual([]);
  });

  it('keeps the drawing inside its own bounds', () => {
    for (const g of [chapters, map]) {
      for (const n of Object.values(g.nodes)) {
        expect(n.x).toBeGreaterThanOrEqual(-1e-6);
        expect(n.y).toBeGreaterThanOrEqual(-1e-6);
        expect(n.x + CARD.w).toBeLessThanOrEqual(g.W + 1e-6);
        expect(n.y + CARD.h).toBeLessThanOrEqual(g.H + 1e-6);
      }
    }
  });

  it('fits the whole of either drawing inside a phone box', () => {
    for (const g of [chapters, map]) {
      const v = fitView(g, box);
      expect(g.W * v.z).toBeLessThanOrEqual(box.w);
      expect(g.H * v.z).toBeLessThanOrEqual(box.h);
    }
  });

  it('is the same every time', () => {
    expect(layoutChapters(geo)).toEqual(chapters);
    expect(layoutMap(geo)).toEqual(map);
  });
});

describe('the map of the largest course on a phone', () => {
  const dl = books[0]!.geo;
  const map = layoutMap(dl);

  it('fits on one screen at a scale a tile can still be seen at', () => {
    const v = fitView(map, box);
    expect(map.H * v.z).toBeLessThanOrEqual(700);
    expect(CARD.w * v.z).toBeGreaterThan(20);
  });

  it('wraps a layer only as far as it must', () => {
    const rows = new Set(Object.values(map.nodes).map((n) => n.y));
    const depths = new Map<string, number>();
    const byId = new Map(dl.concepts.map((c) => [c.id, c]));
    const d = (id: string): number => depths.get(id) ?? (depths.set(id, Math.max(-1, ...byId.get(id)!.prereqs.map(d)) + 1), depths.get(id)!);
    dl.concepts.forEach((c) => d(c.id));
    expect(rows.size).toBeLessThanOrEqual(Math.max(...depths.values()) + 1 + 6);
  });
});

describe('Nix on a phone', () => {
  it('reads at full detail with no zooming', () => {
    const nix = books[1]!.geo;
    expect(lodOf(fitView(layoutChapters(nix), box).z)).toBe(2);
    expect(lodOf(fitView(layoutMap(nix), box).z)).toBe(2);
  });
});

describe('packRow', () => {
  it('leaves positions already far enough apart alone', () => {
    expect(packRow([0, 200, 500], 150)).toEqual([0, 200, 500]);
  });

  it('pushes crowded ones apart around where they want to be', () => {
    expect(packRow([100, 100], 40)).toEqual([80, 120]);
  });

  it('keeps every gap at least the step', () => {
    const out = packRow([5, 3, 9, 1, 2], 10);
    for (let i = 1; i < out.length; i++) expect(out[i]! - out[i - 1]!).toBeGreaterThanOrEqual(10 - 1e-9);
  });
});

describe('looking at a drawing', () => {
  const g = layoutChapters(books[0]!.geo);

  it('keeps the point under the fingers still while zooming', () => {
    const v = { z: 0.5, tx: 10, ty: -40 };
    const next = zoomAround(v, 1.6, 200, 300, [0.1, 2]);
    const world = (u: typeof v) => [(200 - u.tx) / u.z, (300 - u.ty) / u.z];
    expect(world(next)[0]).toBeCloseTo(world(v)[0]!);
    expect(world(next)[1]).toBeCloseTo(world(v)[1]!);
  });

  it('stops zooming at its limits', () => {
    expect(zoomAround({ z: 1, tx: 0, ty: 0 }, 9, 0, 0, [0.1, 1.4]).z).toBe(1.4);
    expect(zoomAround({ z: 1, tx: 0, ty: 0 }, 0.001, 0, 0, [0.1, 1.4]).z).toBe(0.1);
  });

  it('does not let the drawing be thrown off screen', () => {
    const v = clampView({ z: 1, tx: -1e6, ty: 1e6 }, g, box);
    expect(v.tx + g.W * v.z).toBeGreaterThan(0);
    expect(v.ty).toBeLessThan(box.h);
  });

  it('centers a drawing smaller than the box', () => {
    const small = { W: 100, H: 100 };
    const v = clampView({ z: 1, tx: -500, ty: 900 }, small, box);
    expect(v.tx).toBe(151);
    expect(v.ty).toBe(300);
  });

  it('allows extra travel when a sheet covers the bottom', () => {
    const y = 40000;
    expect(clampView({ z: 1, tx: 0, ty: -y }, g, box, 400).ty).toBeLessThan(clampView({ z: 1, tx: 0, ty: -y }, g, box, 0).ty);
  });

  it('finds the concept under a tap, and nothing in the gaps', () => {
    const n = Object.values(g.nodes)[0]!;
    expect(hitNode(g, n.x + 5, n.y + 5, 0)).toBe(n.id);
    expect(hitNode(g, -500, -500, 12)).toBeNull();
  });

  it('centers on a concept at the height asked for', () => {
    const id = Object.keys(g.nodes)[3]!;
    const v = centerOn(g, id, box, 0.9, 0.3);
    const n = g.nodes[id]!;
    expect((n.y + CARD.h / 2) * v.z + v.ty).toBeCloseTo(box.h * 0.3);
  });

  it('shortens a title to two lines at most', () => {
    expect(shortLines('Variance of a sum').length).toBeLessThanOrEqual(2);
    expect(shortLines('Two-layer forward pass')).toEqual(['Two-layer', 'forward…']);
    expect(shortLines('Dropout')).toEqual(['Dropout']);
  });
});
