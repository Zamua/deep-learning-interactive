// Finds explainers on disk: the tools name one `atlas-<full concept id>`, which does not say which folder it is in.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const courses = join(import.meta.dirname, '../../src/courses');
const subdirs = (dir) => readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

/** Every explainer: its id, its folder from the repo root, and the address of its player. */
export function explainers() {
  return subdirs(courses).filter((c) => existsSync(join(courses, c, 'course.ts'))).flatMap((course) => {
    const prefix = readFileSync(join(courses, course, 'course.ts'), 'utf8').match(/idPrefix:\s*'([^']*)'/)[1];
    return subdirs(join(courses, course)).flatMap((domain) => subdirs(join(courses, course, domain))
      .filter((concept) => existsSync(join(courses, course, domain, concept, 'script.ts')))
      .map((concept) => ({
        id: `atlas-${prefix}${concept}`,
        dir: `src/courses/${course}/${domain}/${concept}`,
        // Only the first course has no prefix, and only it lives under #/atlas.
        watch: `${prefix ? `c/${course}` : 'atlas'}/${prefix}${concept}/watch`,
      })));
  });
}

export const findExplainer = (id) => explainers().find((e) => e.id === id);
