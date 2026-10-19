/*
 * In-context learning as inference. A toy pretraining corpus mixes four kinds of list
 * ("cat => cats", "cat => chat", ...). The loss-minimizing next-token predictor for that
 * mixture is the Bayesian one below: it infers from the prompt which kind of list it is in.
 */

export const ANIMALS = ['cat', 'dog', 'cow', 'bird', 'duck'];

export interface Task {
  id: string;
  label: string;
  /** How common this kind of list is in the toy pretraining data. */
  prior: number;
  answers: string[];
}

export const TASKS: Task[] = [
  { id: 'plural', label: 'plural', prior: 0.4, answers: ['cats', 'dogs', 'cows', 'birds', 'ducks'] },
  { id: 'french', label: 'French', prior: 0.3, answers: ['chat', 'chien', 'vache', 'oiseau', 'canard'] },
  { id: 'sound', label: 'sound', prior: 0.2, answers: ['meow', 'woof', 'moo', 'tweet', 'quack'] },
  { id: 'baby', label: 'baby', prior: 0.1, answers: ['kitten', 'puppy', 'calf', 'chick', 'duckling'] },
];

export const ANSWERS: string[] = TASKS.flatMap((t) => t.answers);

/** Chance that a line in the toy data has a random answer instead of the list's rule. */
export const EPS = 0.1;

export function pLine(task: Task, x: number, y: string): number {
  return (1 - EPS) * (task.answers[x] === y ? 1 : 0) + EPS / ANSWERS.length;
}

export interface Prediction {
  posterior: number[];
  /** Probability of every answer for the query, in ANSWERS order. */
  answer: number[];
}

/** Posterior over tasks after the example lines, and the predicted answer for animal `query`. */
export function predict(examples: [number, string][], query: number): Prediction {
  const post = TASKS.map((t) => t.prior);
  for (const [x, y] of examples) TASKS.forEach((t, i) => (post[i]! *= pLine(t, x, y)));
  const z = post.reduce((a, b) => a + b, 0);
  const posterior = post.map((v) => v / z);
  const answer = ANSWERS.map((y) => TASKS.reduce((s, t, i) => s + posterior[i]! * pLine(t, query, y), 0));
  return { posterior, answer };
}
