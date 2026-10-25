// The mastery course's vocabulary: concepts, problems and answers.
import type { Rng } from '../../core/rand';

/** The bar a concept must clear: the last `streak` answers all correct, averaging at most `seconds`. */
export interface MasteryBar {
  streak: number;
  seconds: number;
}

/** What a concept's `meta.ts` holds. */
export interface ConceptMeta {
  /** Unique across the course, kebab case: `dot-product`. */
  id: string;
  title: string;
  /** One line for the map and the concept page. */
  blurb: string;
  prereqs: string[];
  mastery: MasteryBar;
  /** Chapters of the other courses that go deeper. */
  deeper?: { chapter: string; section?: string }[];
}

/** A concept as the course sees it: its meta plus the domain folder it lives in. */
export interface Concept extends ConceptMeta {
  domain: string;
}

export type Answer =
  | { kind: 'number'; value: number; places?: number }
  | { kind: 'shape'; value: number[] }
  | { kind: 'vector'; value: number[]; places?: number }
  /** `why[i]` says what picking wrong option i usually means; shown after a miss. */
  | { kind: 'choice'; options: string[]; correct: number; why?: (string | null)[] }
  | { kind: 'expr'; value: string; vars: string[] }
  | { kind: 'order'; items: string[] };

export interface Problem {
  /** Markdown dialect with KaTeX and color-linked symbols, as in chapters. */
  prompt: string;
  /** An optional listing shown with the prompt, CodePanel syntax. */
  code?: string;
  answer: Answer;
  /** The worked solution, one step per entry. */
  solution: string[];
  /**
   * Likely mistakes for number, shape and vector answers: a wrong response equal to `value`
   * (a number, or the shape or vector as an array) gets `why` as its explanation.
   */
  traps?: { value: number | number[]; why: string }[];
}

export interface Generator {
  /** Stable within its concept; logged with every attempt. */
  id: string;
  /** `difficulty` is in [0, 1]: 0 for a first attempt, 1 for a fluent learner. */
  make(rng: Rng, difficulty: number): Problem;
}
