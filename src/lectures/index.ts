import type { Glossary } from '../lecture/glossary';
import type { LectureDef } from '../lecture/player';

const modules = import.meta.glob<{ default: LectureDef }>('./*/index.ts');
const glossaries = import.meta.glob<{ glossary: Glossary }>('./*/glossary.ts');

export function hasLecture(id: string): boolean {
  return `./${id}/index.ts` in modules;
}

export function loadLecture(id: string): Promise<LectureDef> | null {
  const m = modules[`./${id}/index.ts`];
  const g = glossaries[`./${id}/glossary.ts`];
  return m ? Promise.all([m(), g?.()]).then(([x, y]) => ({ ...x.default, glossary: y?.glossary ?? {} })) : null;
}
