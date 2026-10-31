import { beforeAll, describe, expect, it } from 'vitest';
import type { CodePanel } from '../core/code';
import type { Plot } from '../core/plot';
import { Scene, type SceneDef } from '../lecture/scene';
import { timingMatches, type LectureScript, type Timing } from '../lecture/types';
import { CONCEPTS, hasExplainer } from './index';
import { ATLAS_SYMBOLS, SCOPED } from './symbols';

const STRICT = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.ATLAS_STRICT;
const byConcept = <T>(files: Record<string, T>) => new Map(Object.entries(files).map(([p, v]) => [p.split('/')[2]!, v]));
const scripts = byConcept(import.meta.glob<LectureScript>('./*/*/script.ts', { import: 'script', eager: true }));
const sceneDefs = byConcept(import.meta.glob<Record<string, SceneDef>>('./*/*/scenes.ts', { import: 'scenes', eager: true }));
const timings = byConcept(import.meta.glob<Timing>('./*/*/timing.json', { import: 'default', eager: true }));

/** A canvas context that accepts every call and draws nothing. */
const nothing: unknown = new Proxy(() => nothing, {
  get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 4, actualBoundingBoxDescent: 1 }) : nothing),
  set: () => true,
  apply: () => nothing,
});

beforeAll(() => {
  // Scenes read theme colors from CSS; any 6-digit hex will do here.
  Object.assign(globalThis, { document: { documentElement: {} }, getComputedStyle: () => ({ getPropertyValue: () => '#336699' }) });
});

/** Each scene's beats, in seconds from the scene's start: as timed, or one second apiece before a first build. */
function beatsOf(script: LectureScript, timing: Timing | null): Map<string, Map<string, [number, number]>> {
  return new Map(script.scenes.map((sc) => {
    const start = timing?.scenes[sc.id]?.[0] ?? 0;
    return [sc.id, new Map(sc.beats.map((b, i) => {
      const t = timing?.beats[`${sc.id}/${b.id}`];
      return [b.id, t ? [t[0] - start, t[1] - start] : [i, i + 1]];
    }))];
  }));
}

describe('Atlas explainers', () => {
  for (const c of CONCEPTS.filter((c) => hasExplainer(c.id))) {
    describe(c.id, () => {
      const script = scripts.get(c.id)!;
      const defs = sceneDefs.get(c.id)!;
      const timing = timings.get(c.id) ?? null;

      it.skipIf(!STRICT && !timing)('has narration timed from its script as it stands', () => {
        expect(timingMatches(script, timing)).toBe(true);
      });

      it('draws every scene through its whole length, naming only beats it has', () => {
        expect(Object.keys(defs).sort()).toEqual(script.scenes.map((s) => s.id).sort());
        const plot = { ctx: nothing, w: 800, h: 450 } as unknown as Plot;
        const code = nothing as CodePanel;
        const errors = new Set<string>();
        for (const [id, beats] of beatsOf(script, timing)) {
          const end = Math.max(...[...beats.values()].map((b) => b[1])) + 1;
          for (const [w, h] of [[800, 450], [400, 700]]) {
            Object.assign(plot, { w, h });
            const s = new Scene(plot, code, beats);
            for (let i = 0; i <= 40; i++) {
              s.t = -0.5 + ((end + 0.5) * i) / 40;
              try {
                defs[id]!.draw(s);
              } catch (e) {
                errors.add(`${id}: ${(e as Error).message}`);
              }
            }
          }
        }
        expect([...errors]).toEqual([]);
      });
    });
  }

  it('scopes symbols only to concepts that exist, with keys that can be CSS classes and TeX macros', () => {
    const ids = new Set(CONCEPTS.map((c) => c.id));
    const bad = Object.entries(SCOPED).flatMap(([concept, syms]) => [
      ...(ids.has(concept) ? [] : [`${concept} is not a concept`]),
      ...Object.keys(syms).filter((k) => !/^[A-Za-z][A-Za-z0-9]*$/.test(k)).map((k) => `${concept}: bad key ${k}`),
    ]);
    const badCourse = Object.keys(ATLAS_SYMBOLS).filter((k) => !/^[A-Za-z][A-Za-z0-9]*$/.test(k));
    expect([...bad, ...badCourse]).toEqual([]);
  });
});
