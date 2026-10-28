// The Atlas course's content: every concept folder under a domain folder, found by glob.
import type { LectureDef } from '../lecture/player';
import { ConceptGraph } from '../mastery/domain/graph';
import type { Concept, ConceptMeta, Generator } from '../mastery/domain/types';
import type { Color } from '../core/symbols';

/** The course as the index, the top bar and the nav show it. */
export const ATLAS_COURSE = {
  id: 'atlas',
  code: 'Atlas',
  title: 'AI by mastery',
  era: 'A growing map of concepts',
  blurb: 'Built differently: every idea is a small concept with a short voiced explainer and generated problems. Master one and the concepts built on it unlock; mastered ones come back for review before you forget them.',
};

export interface Domain {
  id: string;
  title: string;
  color: Color;
}

/** In map order; a concept folder's domain must be one of these. */
export const DOMAINS: Domain[] = [
  { id: 'linear-algebra', title: 'Linear algebra', color: 'blue' },
  { id: 'calculus', title: 'Calculus', color: 'purple' },
  { id: 'classifiers', title: 'Classifiers', color: 'teal' },
  { id: 'optimization', title: 'Optimization', color: 'gold' },
  { id: 'backprop', title: 'Backpropagation', color: 'red' },
  { id: 'networks', title: 'Neural networks', color: 'green' },
  { id: 'training', title: 'Training', color: 'orange' },
  { id: 'convnets', title: 'ConvNets', color: 'slate' },
  { id: 'sequences', title: 'Sequence models', color: 'teal' },
  { id: 'transformers', title: 'Transformers', color: 'blue' },
  { id: 'language-models', title: 'Language models', color: 'purple' },
  { id: 'scale', title: 'Scale', color: 'gold' },
  { id: 'generative', title: 'Seeing and generating', color: 'green' },
  { id: 'post-training', title: 'Post-training', color: 'red' },
  { id: 'inference', title: 'Reasoning and inference', color: 'orange' },
  { id: 'interpretability', title: 'Interpretability', color: 'slate' },
  { id: 'frontier', title: 'Frontier', color: 'purple' },
];

const metas = import.meta.glob<ConceptMeta>('./*/*/meta.ts', { eager: true, import: 'meta' });
const problems = import.meta.glob<Generator[]>('./*/*/problems.ts', { import: 'generators' });
const explainers = import.meta.glob<LectureDef>('./*/*/explainer.ts', { import: 'default' });
const durations = import.meta.glob<number>('./*/*/timing.json', { query: '?duration', import: 'default', eager: true });

const folder = (path: string) => {
  const [, domain = '', name = ''] = path.split('/');
  return { domain, name };
};
const at = (id: string, file: string) => {
  const c = byId.get(id);
  return c ? `./${c.domain}/${id}/${file}` : '';
};

export const CONCEPTS: Concept[] = Object.entries(metas)
  .map(([path, meta]) => ({ ...meta, domain: folder(path).domain }))
  .sort((a, b) => DOMAINS.findIndex((d) => d.id === a.domain) - DOMAINS.findIndex((d) => d.id === b.domain) || a.id.localeCompare(b.id));
const byId = new Map(CONCEPTS.map((c) => [c.id, c]));

export const GRAPH = new ConceptGraph(CONCEPTS);

export const domainOf = (c: Concept): Domain => DOMAINS.find((d) => d.id === c.domain)!;

export function loadGenerators(id: string): Promise<Generator[]> {
  const load = problems[at(id, 'problems.ts')];
  return load ? load() : Promise.resolve([]);
}

export function hasExplainer(id: string): boolean {
  return at(id, 'explainer.ts') in explainers;
}

/** An explainer's narration in seconds, 0 before its first build. */
export const explainerSeconds = (id: string): number => durations[at(id, 'timing.json')] ?? 0;

export function loadExplainer(id: string): Promise<LectureDef> | null {
  return explainers[at(id, 'explainer.ts')]?.() ?? null;
}

/** Folder-level mistakes the graph check cannot see: a meta whose id is not its folder name, or an unknown domain. */
export function folderIssues(): string[] {
  return Object.entries(metas).flatMap(([path, meta]) => {
    const f = folder(path);
    return [
      ...(meta.id !== f.name ? [`${path}: id ${meta.id} does not match its folder`] : []),
      ...(DOMAINS.some((d) => d.id === f.domain) ? [] : [`${path}: unknown domain ${f.domain}`]),
    ];
  });
}
