// Finding concepts by what the learner types. Pure: the map page draws the hits.
import type { ConceptGraph } from './graph';

/**
 * Lower case, accents dropped, hyphens as spaces and runs of space as one, so "Café", "cafe" and "CAFE" read alike.
 * `at[i]` is where the folded text's `i`th character came from in `s`.
 */
function folded(s: string): { text: string; at: number[] } {
  let text = '';
  const at: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let ch = s[i]!.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    if (/[-_\s]/.test(ch)) ch = ' ';
    if (ch === ' ' && (text === '' || text.endsWith(' '))) continue;
    for (const c of ch) {
      text += c;
      at.push(i);
    }
  }
  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    at.pop();
  }
  return { text, at };
}

export const fold = (s: string): string => folded(s).text;

/** Where a concept matched, best first: its title's start, a title word's start, anywhere in the title, then the rest. */
export type Reason = 'title-start' | 'title-word' | 'title' | 'name' | 'blurb' | 'builds-on' | 'words';
const RANK: Record<Reason, number> = { 'title-start': 0, 'title-word': 1, title: 2, name: 3, blurb: 4, 'builds-on': 5, words: 6 };

export interface Hit {
  id: string;
  reason: Reason;
  /** Where the query sits in the title, for highlighting, when it matched there. */
  span?: [number, number];
}

/**
 * Concepts matching `query`, best first; ties keep the graph's order, foundations first. A concept's id counts as a
 * second name (`swiglu` finds "Gated MLPs"), and a query of several words matches when every word appears somewhere.
 */
export function searchConcepts(graph: ConceptGraph, query: string, limit = 12): Hit[] {
  const q = fold(query);
  if (!q) return [];
  const words = q.split(' ');
  const hits: Hit[] = [];
  for (const c of graph.order) {
    const t = folded(c.title);
    const title = t.text;
    const at = title.indexOf(q);
    const name = fold(c.id);
    const blurb = fold(c.blurb);
    const pre = c.prereqs.map((p) => fold(graph.get(p)?.title ?? ''));
    let reason: Reason | null = null;
    if (at === 0) reason = 'title-start';
    else if (at > 0) reason = title[at - 1] === ' ' ? 'title-word' : 'title';
    else if (name.includes(q)) reason = 'name';
    else if (blurb.includes(q)) reason = 'blurb';
    else if (pre.some((p) => p.includes(q))) reason = 'builds-on';
    else if (words.length > 1 && words.every((w) => [title, name, blurb, ...pre].some((f) => f.includes(w)))) reason = 'words';
    if (!reason) continue;
    hits.push(at >= 0 ? { id: c.id, reason, span: [t.at[at]!, t.at[at + q.length - 1]! + 1] } : { id: c.id, reason });
  }
  return hits.sort((a, b) => RANK[a.reason] - RANK[b.reason]).slice(0, limit);
}
