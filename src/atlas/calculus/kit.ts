// Generator helpers for the calculus concepts: polynomials as terms, written as TeX or as answers.

/** One term `c x^n` (n = 0 is a constant). */
export interface Term {
  c: number;
  n: number;
}

/** Joins signed pieces into `a + b - c`, the first keeping its own sign. */
export function joinSigned(parts: { neg: boolean; body: string }[]): string {
  if (!parts.length) return '0';
  return parts.map((p, i) => (i === 0 ? (p.neg ? '-' : '') + p.body : `${p.neg ? ' - ' : ' + '}${p.body}`)).join('');
}

function termBody(t: Term, x: string, pow: (n: number) => string): string {
  const a = Math.abs(t.c);
  if (t.n === 0) return String(a);
  const xs = t.n === 1 ? x : `${x}${pow(t.n)}`;
  return a === 1 ? xs : `${a}${xs}`;
}

/** TeX: `4\symx^{3} - 3\symx^{2} + 5`. */
export function polyTex(ts: Term[], x = '\\symx'): string {
  return joinSigned(ts.filter((t) => t.c !== 0).map((t) => ({ neg: t.c < 0, body: termBody(t, x, (n) => `^{${n}}`) })));
}

/** The expression parser's form: `4x^3 - 3x^2 + 5`. */
export function polyExpr(ts: Term[], x = 'x'): string {
  return joinSigned(ts.filter((t) => t.c !== 0).map((t) => ({ neg: t.c < 0, body: termBody(t, x, (n) => `^${n}`) })));
}

/** The power rule, term by term; constants drop out. */
export const dPoly = (ts: Term[]): Term[] => ts.filter((t) => t.n > 0).map((t) => ({ c: t.c * t.n, n: t.n - 1 }));

export const evalPoly = (ts: Term[], x: number): number => ts.reduce((a, t) => a + t.c * x ** t.n, 0);

/** `+ 3` or `- 3`, for a term after the first. */
export const signed = (v: number | string): string => {
  const s = String(v);
  return s.startsWith('-') ? `- ${s.slice(1)}` : `+ ${s}`;
};

/** `(-2)` for negatives, so products read clearly. */
export const paren = (v: number | string): string => (String(v).startsWith('-') ? `(${v})` : String(v));

/** Traps that are finite and that the grader can tell from the answer and from each other (first kept). */
export function cleanTraps(traps: { value: number; why: string }[], answer: number, places = 6): { value: number; why: string }[] {
  const near = (a: number, b: number) => Math.abs(a - b) <= 10 ** -places;
  const kept: { value: number; why: string }[] = [];
  for (const t of traps) if (Number.isFinite(t.value) && !near(t.value, answer) && !kept.some((k) => near(k.value, t.value))) kept.push(t);
  return kept;
}
