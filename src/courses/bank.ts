// Hand-written questions as a generator, for what a program cannot compute: a concept's facts and judgment calls.
import type { Lang } from '../core/highlight';
import type { Generator } from '../mastery/domain/types';

export interface BankQuestion {
  /** Markdown dialect. A literal dollar sign is written `\\$`. */
  q: string;
  /** An optional listing shown with the question. */
  code?: string;
  /** The right answer first; each learner sees them shuffled. */
  options: string[];
  /** What picking each wrong option usually means, in the order of the options after the first. */
  why?: string[];
  solution: string[];
}

/** A generator that draws one of `questions` and shuffles its options. `lang` is the language of their listings. */
export function bank(id: string, questions: readonly BankQuestion[], lang?: Lang): Generator {
  return {
    id,
    make(rng) {
      const q = questions[rng.int(questions.length)]!;
      const order = rng.shuffle(q.options.map((_, i) => i));
      return {
        prompt: q.q,
        ...(q.code ? { code: q.code, lang } : {}),
        answer: {
          kind: 'choice',
          options: order.map((i) => q.options[i]!),
          correct: order.indexOf(0),
          ...(q.why ? { why: order.map((i) => (i === 0 ? null : q.why![i - 1] ?? null)) } : {}),
        },
        solution: q.solution,
      };
    },
  };
}
