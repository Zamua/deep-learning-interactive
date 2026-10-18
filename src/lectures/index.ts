import type { LectureDef } from '../lecture/player';

const modules = import.meta.glob<{ default: LectureDef }>('./*/index.ts');

export function hasLecture(id: string): boolean {
  return `./${id}/index.ts` in modules;
}

export function loadLecture(id: string): Promise<LectureDef> | null {
  const m = modules[`./${id}/index.ts`];
  return m ? m().then((x) => x.default) : null;
}
