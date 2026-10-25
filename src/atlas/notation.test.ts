import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rand';
import { shownText } from '../lecture/types';
import type { LectureScript } from '../lecture/types';
import { CONCEPTS, GRAPH, loadGenerators } from './index';
import { NOTATION } from './notation';

const scripts = import.meta.glob<LectureScript>('./*/*/script.ts', { eager: true, import: 'script' });
const scenes = import.meta.glob<string>('./*/*/scenes.ts', { eager: true, query: '?raw', import: 'default' });
const byConcept = <T>(files: Record<string, T>) => new Map(Object.entries(files).map(([p, v]) => [p.split('/')[2]!, v]));
const narration = new Map([...byConcept(scripts)].map(([id, s]) => [id, s.scenes.flatMap((sc) => sc.beats.map((b) => shownText(b.say))).join('\n')]));
/** The string literals of a scene file: the text and TeX it draws, without the code around them. */
const literals = (src: string) => (src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? []).join('\n');
const stage = new Map([...byConcept(scenes)].map(([id, src]) => [id, literals(src)]));

/** Every concept a learner meets before this one. */
function chain(id: string, seen = new Set<string>()): Set<string> {
  for (const p of GRAPH.get(id)!.prereqs) if (!seen.has(p)) chain(p, seen.add(p));
  return seen;
}

async function practiceText(id: string): Promise<string> {
  const out: string[] = [];
  for (const g of await loadGenerators(id)) {
    for (let seed = 1; seed <= 8; seed++) {
      for (const d of [0, 0.5, 1]) {
        const p = g.make(new Rng(seed), d);
        const a = p.answer;
        out.push(p.prompt, ...p.solution, ...(p.traps ?? []).map((t) => t.why));
        if (a.kind === 'choice') out.push(...a.options, ...(a.why ?? []).filter((w): w is string => !!w));
      }
    }
  }
  return out.join('\n');
}

describe('Atlas notation', () => {
  it('is explained in narration before any concept uses it', async () => {
    const missing: string[] = [];
    for (const c of CONCEPTS) {
      const words = [await practiceText(c.id), narration.get(c.id) ?? ''].join('\n');
      const marks = stage.get(c.id) ?? '';
      const known = [c.id, ...chain(c.id)].map((id) => narration.get(id) ?? '').join('\n');
      for (const [key, n] of Object.entries(NOTATION)) {
        const used = n.tex.test(words) || n.shown.test(words) || n.tex.test(marks) || (!n.word && n.shown.test(marks));
        if (used && !n.shown.test(known)) missing.push(`${c.id} uses ${key}`);
      }
    }
    expect(missing.join('\n')).toBe('');
  }, 120_000);

  it('names, for each mark, the concepts that first explain it', () => {
    const roots: Record<string, string[]> = {};
    for (const [key, n] of Object.entries(NOTATION)) {
      const says = (id: string) => n.shown.test(narration.get(id) ?? '');
      roots[key] = GRAPH.order.filter((c) => says(c.id) && ![...chain(c.id)].some(says)).map((c) => c.id);
    }
    expect(Object.fromEntries(Object.entries(NOTATION).map(([k, n]) => [k, n.from]))).toEqual(roots);
  });
});
