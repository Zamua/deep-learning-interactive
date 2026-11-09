#!/usr/bin/env node
// The mechanical steps of /make-course:
//   node tools/course/course.mjs check <outline.json>      whether an outline makes a valid course
//   node tools/course/course.mjs scaffold <outline.json>   write its folders; never overwrites a file
//   node tools/course/course.mjs status <course>           what each concept still lacks
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { graphIssues } from '../../src/mastery/domain/graph.ts';

const root = resolve(import.meta.dirname, '../..');
const courses = join(root, 'src/courses');
/** A concept page is worth little alone, and a map stops being readable long before this many. */
const SIZE = { min: 4, max: 120 };
/** The darkest of the shelf's covers carry light text at this luminance or below. */
const MAX_COVER_LUMINANCE = 0.1;

const ID = /^[a-z0-9][a-z0-9-]*$/;

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Everything wrong with an outline, as sentences. */
function outlineIssues(o) {
  const out = [];
  if (!ID.test(o.id ?? '')) out.push(`course id "${o.id}" is not lowercase kebab case`);
  if (o.idPrefix !== `${o.id}.`) out.push(`idPrefix must be "${o.id}."`);
  for (const k of ['title', 'blurb']) if (!o[k]?.trim()) out.push(`no ${k}`);
  if (!/^#[0-9a-f]{6}$/i.test(o.cover ?? '')) out.push('cover must be #rrggbb');
  else if (luminance(o.cover) > MAX_COVER_LUMINANCE) out.push(`cover ${o.cover} is too light for the paper text on it (luminance ${luminance(o.cover).toFixed(3)}, at most ${MAX_COVER_LUMINANCE})`);
  const domains = new Set(o.domains.map((d) => d.id));
  if (domains.size !== o.domains.length) out.push('repeated domain id');
  for (const d of o.domains) if (!ID.test(d.id) || !d.title?.trim()) out.push(`domain ${d.id}: needs a kebab-case id and a title`);
  const { concepts } = o;
  if (concepts.length < SIZE.min || concepts.length > SIZE.max) out.push(`${concepts.length} concepts, outside ${SIZE.min} to ${SIZE.max}`);
  for (const c of concepts) {
    if (!ID.test(c.id)) out.push(`concept "${c.id}" is not lowercase kebab case (a dot would read as a course prefix)`);
    if (!domains.has(c.domain)) out.push(`${c.id}: unknown domain ${c.domain}`);
    if (!c.title?.trim() || !c.blurb?.trim()) out.push(`${c.id}: needs a title and a blurb`);
  }
  for (const d of domains) if (!concepts.some((c) => c.domain === d)) out.push(`domain ${d} has no concepts`);
  // The chapters in order are the book's tour, so a concept may only build on its own chapter or an earlier one.
  const place = new Map(o.domains.map((d, i) => [d.id, i]));
  const home = new Map(concepts.map((c) => [c.id, c.domain]));
  for (const c of concepts) for (const p of c.prereqs) if (place.get(home.get(p)) > place.get(c.domain)) out.push(`${c.id} needs ${p}, from a later domain`);
  const issues = graphIssues(concepts);
  out.push(...issues);
  if (!issues.length && concepts.length) {
    // One piece: every concept shares a chain with the first, so the map is one course and not two side by side.
    const near = new Map(concepts.map((c) => [c.id, new Set(c.prereqs)]));
    for (const c of concepts) for (const p of c.prereqs) near.get(p).add(c.id);
    const seen = new Set([concepts[0].id]);
    for (const id of seen) for (const n of near.get(id)) seen.add(n);
    const apart = concepts.filter((c) => !seen.has(c.id)).map((c) => c.id);
    if (apart.length) out.push(`not connected to ${concepts[0].id}: ${apart.join(', ')}`);
  }
  return out;
}

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const lit = (v) => JSON.stringify(v).replaceAll("'", "\\'").replace(/^"|"$/g, "'").replaceAll('\\"', '"');
const list = (xs) => `[${xs.map(lit).join(', ')}]`;

function courseFile(o) {
  return `import type { CourseDef } from '../course';

export const course: CourseDef = {
  title: ${lit(o.title)},
  blurb: ${lit(o.blurb)},
  cover: ${lit(o.cover)},
  idPrefix: ${lit(o.idPrefix)},
  domains: [
${o.domains.map((d) => `    { id: ${lit(d.id)}, title: ${lit(d.title)} },`).join('\n')}
  ],
};
`;
}

function metaFile(c) {
  return `import type { ConceptMeta } from '../../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: ${lit(c.id)},
  title: ${lit(c.title)},
  blurb: ${lit(c.blurb)},
  prereqs: ${list(c.prereqs)},
  mastery: { streak: 4, seconds: 60 },
};
`;
}

const EXPLAINER = `import type { LectureDef } from '../../../../lecture/player';
import type { Timing } from '../../../../lecture/types';
import { scenes } from './scenes';
import { script } from './script';

// Written by tools/lecture/build.mjs; until the first build the explainer plays silently on estimated timing.
const audio = Object.values(import.meta.glob<string>('./narration.m4a', { query: '?url', import: 'default', eager: true }))[0] ?? '';
const timing = (Object.values(import.meta.glob('./timing.json', { import: 'default', eager: true }))[0] ?? null) as Timing | null;

const explainer: LectureDef = { script, timing, scenes, symbols: {}, audio };
export default explainer;
`;

/** Writes a file unless it is there: a scaffold run twice, or after authoring began, loses nothing. */
function write(path, text) {
  if (existsSync(path)) return 0;
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text);
  return 1;
}

function scaffold(o) {
  const dir = join(courses, o.id);
  let made = write(join(dir, 'course.ts'), courseFile(o));
  for (const c of o.concepts) {
    const at = join(dir, c.domain, c.id);
    made += write(join(at, 'meta.ts'), metaFile(c)) + write(join(at, 'explainer.ts'), EXPLAINER);
  }
  console.log(`${made} files written under src/courses/${o.id}`);
}

const PARTS = ['problems.ts', 'script.ts', 'scenes.ts', 'timing.json', 'narration.m4a'];

function status(id) {
  const dir = join(courses, id);
  if (!existsSync(join(dir, 'course.ts'))) throw new Error(`no course at src/courses/${id}`);
  const subdirs = (d) => readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const rows = subdirs(dir).flatMap((domain) => subdirs(join(dir, domain)).filter((c) => existsSync(join(dir, domain, c, 'meta.ts'))).map((c) => ({
    concept: `${domain}/${c}`,
    missing: PARTS.filter((p) => !existsSync(join(dir, domain, c, p))),
  })));
  for (const r of rows) console.log(`${r.missing.length ? 'todo' : 'done'}  ${r.concept}${r.missing.length ? `  (no ${r.missing.join(', ')})` : ''}`);
  const left = rows.filter((r) => r.missing.length).length;
  console.log(`${rows.length - left} of ${rows.length} concepts complete`);
  return left;
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'status' && arg) process.exit(status(arg) ? 1 : 0);
if ((cmd === 'check' || cmd === 'scaffold') && arg) {
  const o = read(arg);
  const issues = outlineIssues(o);
  for (const i of issues) console.error(`- ${i}`);
  if (issues.length) process.exit(1);
  if (cmd === 'scaffold') scaffold(o);
  else console.log(`ok: ${o.concepts.length} concepts in ${o.domains.length} domains`);
  process.exit(0);
}
console.error('usage: node tools/course/course.mjs check|scaffold <outline.json> | status <course>');
process.exit(2);
