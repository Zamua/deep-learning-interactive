// Every course on the site: each folder here with a `course.ts`, and its concepts, found by glob.
import type { LectureDef } from '../lecture/player';
import { ConceptGraph } from '../mastery/domain/graph';
import type { ConceptMeta, Generator } from '../mastery/domain/types';
import { coursePages, FIRST_COURSE } from '../routes';
import type { Course, CourseDef } from './course';

const defs = import.meta.glob<CourseDef>('./*/course.ts', { eager: true, import: 'course' });
const metas = import.meta.glob<ConceptMeta>('./*/*/*/meta.ts', { eager: true, import: 'meta' });
const problems = import.meta.glob<Generator[]>('./*/*/*/problems.ts', { import: 'generators' });
const explainers = import.meta.glob<LectureDef>('./*/*/*/explainer.ts', { import: 'default' });
const narrations = import.meta.glob<string>('./*/*/*/narration.m4a', { query: '?url', import: 'default', eager: true });
const durations = import.meta.glob<number>('./*/*/*/timing.json', { query: '?duration', import: 'default', eager: true });

const placeOf = (path: string) => {
  const [, course = '', domain = '', name = ''] = path.split('/');
  return { course, domain, name };
};

function build(id: string, def: CourseDef): Course {
  const full = (short: string) => def.idPrefix + short;
  const found = Object.entries(metas)
    .filter(([path]) => placeOf(path).course === id)
    .map(([path, meta]) => ({
      dir: path.slice(0, -'meta.ts'.length),
      concept: {
        ...meta,
        id: full(meta.id),
        prereqs: meta.prereqs.map(full),
        ...(meta.from ? { from: full(meta.from) } : {}),
        domain: placeOf(path).domain,
      },
    }));
  const order = (d: string) => def.domains.findIndex((x) => x.id === d);
  const concepts = found.map((f) => f.concept).sort((a, b) => order(a.domain) - order(b.domain) || a.id.localeCompare(b.id));
  const dirs = new Map(found.map((f) => [f.concept.id, f.dir]));
  const file = (conceptId: string, name: string) => `${dirs.get(conceptId) ?? ''}${name}`;
  return {
    ...def,
    id,
    concepts,
    graph: new ConceptGraph(concepts),
    routes: coursePages(id),
    logKey: def.idPrefix ? `atlas.log.${id}` : 'atlas.log',
    owns: (c) => (def.idPrefix ? c.startsWith(def.idPrefix) : !c.includes('.')),
    domainOf: (c) => def.domains.find((d) => d.id === c.domain)!,
    loadGenerators: (c) => problems[file(c, 'problems.ts')]?.() ?? Promise.resolve([]),
    hasExplainer: (c) => file(c, 'explainer.ts') in explainers,
    explainerSeconds: (c) => durations[file(c, 'timing.json')] ?? 0,
    narration: (c) => narrations[file(c, 'narration.m4a')] ?? '',
    loadExplainer: (c) => explainers[file(c, 'explainer.ts')]?.() ?? null,
  };
}

export const COURSES: readonly Course[] = Object.entries(defs).map(([path, def]) => build(placeOf(path).course, def));

export const courseById = (id: string): Course | undefined => COURSES.find((c) => c.id === id);

/** The course that was once the whole site, and what an address outside any course falls back to. */
export const FIRST: Course = courseById(FIRST_COURSE)!;

/** Folder-level mistakes the graph check cannot see: a meta whose id is not its folder name, or one in no known domain or course. */
export function folderIssues(): string[] {
  return Object.entries(metas).flatMap(([path, meta]) => {
    const at = placeOf(path);
    const course = courseById(at.course);
    return [
      ...(meta.id !== at.name ? [`${path}: id ${meta.id} does not match its folder`] : []),
      ...(meta.id.includes('.') ? [`${path}: id ${meta.id} has a dot, which marks a course prefix`] : []),
      ...(!course ? [`${path}: no course.ts in ${at.course}`] : course.domains.some((d) => d.id === at.domain) ? [] : [`${path}: unknown domain ${at.domain}`]),
    ];
  });
}
