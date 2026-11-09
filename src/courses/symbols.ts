// Each course's color-linked symbols and notation, kept out of the first load: only course pages import this.
import type { SymbolMap } from '../core/symbols';
import type { Notation } from './course';

export interface CourseSymbols {
  /** Every symbol of the course, so one keeps its color from concept to concept. */
  all: SymbolMap;
  /** Symbols a concept gives a meaning of its own, by concept id. */
  scoped: Record<string, SymbolMap>;
  notation: Record<string, Notation>;
}

const symbols = import.meta.glob<{ ALL_SYMBOLS: SymbolMap; SCOPED: Record<string, SymbolMap> }>('./*/symbols.ts', { eager: true });
const notations = import.meta.glob<Record<string, Notation>>('./*/notation.ts', { eager: true, import: 'NOTATION' });

/** A course's symbols; a course with no `symbols.ts` or `notation.ts` has none. */
export function symbolsOf(courseId: string): CourseSymbols {
  const s = symbols[`./${courseId}/symbols.ts`];
  return { all: s?.ALL_SYMBOLS ?? {}, scoped: s?.SCOPED ?? {}, notation: notations[`./${courseId}/notation.ts`] ?? {} };
}
