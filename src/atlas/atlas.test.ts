import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rand';
import { md, setMacros } from '../core/math';
import { codeIndex, symbolMacros } from '../core/symbols';
import { closeTo, expectedResponse, grade } from '../mastery/domain/grade';
import { parse } from '../mastery/domain/expr';
import type { Problem } from '../mastery/domain/types';
import { CONCEPTS, folderIssues, GRAPH, hasExplainer, loadGenerators } from './index';
import { ATLAS_SYMBOLS } from './symbols';

const SEEDS = 40;
/** ATLAS_STRICT=1 also fails concepts that have no explainer or no problems yet. */
const STRICT = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.ATLAS_STRICT;
const LEVELS = [0, 0.25, 0.5, 0.75, 1];

setMacros(symbolMacros(ATLAS_SYMBOLS));
const idx = codeIndex(ATLAS_SYMBOLS);
const renders = (src: string) => !md(src, idx).includes('tex-error');

/** Everything a generated problem must satisfy, as a list of what is wrong with it. */
function problemIssues(p: Problem): string[] {
  const out: string[] = [];
  const a = p.answer;
  if (!p.prompt.trim()) out.push('empty prompt');
  if (!p.solution.length) out.push('no solution');
  if (!renders(p.prompt)) out.push(`prompt does not render: ${p.prompt}`);
  for (const s of p.solution) if (!renders(s)) out.push(`solution step does not render: ${s}`);
  if (!grade(p, expectedResponse(a)).ok) out.push(`its own answer fails: ${JSON.stringify(a)}`);
  if (a.kind === 'number' || a.kind === 'vector') {
    const xs = a.kind === 'number' ? [a.value] : a.value;
    if (!xs.every(Number.isFinite)) out.push('answer is not finite');
  }
  if (a.kind === 'number') for (const t of p.traps ?? []) if (closeTo(t.value, a.value, a.places)) out.push(`trap ${t.value} equals the answer`);
  if (a.kind === 'choice') {
    if (new Set(a.options).size !== a.options.length) out.push('repeated option');
    if (!(a.correct >= 0 && a.correct < a.options.length)) out.push('correct option out of range');
    if (a.why && a.why.length !== a.options.length) out.push('why does not match the options');
    for (const o of a.options) if (!renders(o)) out.push(`option does not render: ${o}`);
  }
  if (a.kind === 'expr') parse(a.value, a.vars);
  return out;
}

describe('the Atlas course', () => {
  it('has a folder per concept, named by its id, in a known domain', () => {
    expect(folderIssues()).toEqual([]);
  });

  it('forms a valid graph', () => {
    expect(GRAPH.order.length).toBe(CONCEPTS.length);
  });

  for (const c of CONCEPTS) {
    describe(c.id, () => {
      it.skipIf(!hasExplainer(c.id) && !STRICT)('has an explainer', () => {
        expect(hasExplainer(c.id)).toBe(true);
      });

      it('generates sound, varied problems', async () => {
        const gens = await loadGenerators(c.id);
        if (!gens.length && !STRICT) return;
        expect(gens.length).toBeGreaterThan(0);
        expect(new Set(gens.map((g) => g.id)).size).toBe(gens.length);
        for (const g of gens) {
          const prompts = new Set<string>();
          for (let seed = 1; seed <= SEEDS; seed++) {
            for (const d of LEVELS) {
              const p = g.make(new Rng(seed), d);
              expect(problemIssues(p), `${c.id}/${g.id} seed ${seed} difficulty ${d}`).toEqual([]);
              expect(JSON.stringify(g.make(new Rng(seed), d)), 'same seed, same problem').toBe(JSON.stringify(p));
              prompts.add(p.prompt);
            }
          }
          expect(prompts.size, `${c.id}/${g.id} varies`).toBeGreaterThanOrEqual(8);
        }
      });
    });
  }
});
