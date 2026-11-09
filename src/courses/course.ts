// What a course is to the site: its description in `<course>/course.ts`, and the same with its concepts found and graphed.
import type { Color } from '../core/symbols';
import type { LectureDef } from '../lecture/player';
import type { ConceptGraph } from '../mastery/domain/graph';
import type { Concept, Generator } from '../mastery/domain/types';
import type { CoursePages } from '../routes';

export interface Domain {
  id: string;
  title: string;
  /** Marks its concepts on the map. */
  color?: Color;
}

/** What a course's `course.ts` exports as `course`. */
export interface CourseDef {
  title: string;
  /** One line under the title on the course's cover. */
  blurb: string;
  /** The cover's color, as `#rrggbb`. Light paper text sits on it, so it must be dark. */
  cover: string;
  /**
   * Put before every concept id of this course, in the synced records and the addresses, so courses never share a
   * record: `nix.` makes `derivation` the id `nix.derivation`. A concept's `meta.ts` writes the short id, and so do its
   * prereqs. Empty only for the first course, whose ids were in learners' accounts before there were courses.
   */
  idPrefix: string;
  /** In map order; a concept folder's domain must be one of these. */
  domains: Domain[];
}

export interface Course extends CourseDef {
  /** The course's folder name. */
  id: string;
  concepts: Concept[];
  graph: ConceptGraph;
  routes: CoursePages;
  /** Where this device keeps the course's answer log; a course's answers never push out another's. */
  logKey: string;
  /** Whether a record with this concept id belongs to this course, whether or not the concept still exists. */
  owns(conceptId: string): boolean;
  domainOf(c: Concept): Domain;
  loadGenerators(id: string): Promise<Generator[]>;
  hasExplainer(id: string): boolean;
  /** An explainer's narration in seconds, 0 before its first build. */
  explainerSeconds(id: string): number;
  loadExplainer(id: string): Promise<LectureDef> | null;
}

/** Mathematical notation a course names, so a card can say what a mark means. */
export interface Notation {
  /** A use in TeX: prompts, solutions, marks on the stage. */
  tex: RegExp;
  /** The mark as a caption writes it, in Unicode. */
  shown: RegExp;
  /** `shown` is a plain word, which a scene's code may also spell (a beat id, a key). */
  word?: boolean;
  name: string;
  about: string;
  /** TeX for the lookup card. */
  glyph: string;
  /** The concepts whose narration first explains it, each on a chain no other one is on. */
  from: string[];
}
