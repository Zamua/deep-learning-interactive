// Pure data and helpers, no imports: tools load glossaries in Node.

/** What a function, method or class that lecture code calls does. */
export interface GlossEntry {
  /** A short phrase, lower case and without a final period, e.g. 'the index of the largest value'. */
  is: string;
  /** One or two sentences more for the lookup card. */
  more?: string;
  /** One line of example code, its result as a trailing comment. */
  eg?: string;
}

/** Keyed by `callKey`: `np.argmax`, `.reshape`, `softmax`. */
export type Glossary = Record<string, GlossEntry>;

/** Module roots whose calls are keyed by their full dotted path, and the library each names. */
export const MODULES: Record<string, string> = {
  np: 'NumPy',
  torch: 'PyTorch',
  F: 'PyTorch',
  nn: 'PyTorch',
  optim: 'PyTorch',
  plt: 'Matplotlib',
  math: 'Python',
  random: 'Python',
  re: 'Python',
};

/**
 * The glossary key of a call to `name`, given the line's text before it: `np.random.randn` for a
 * module function, `.reshape` for a method on any value, `softmax` for a bare name.
 */
export function callKey(before: string, name: string): string {
  if (!/\.\s*$/.test(before)) return name;
  const chain = before.match(/([A-Za-z_][\w.]*)\.\s*$/)?.[1];
  return chain && chain.split('.')[0]! in MODULES ? `${chain}.${name}` : `.${name}`;
}
