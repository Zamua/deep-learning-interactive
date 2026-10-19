/** Four answer checkers for "437 + 285", from strict to exploitable, and six completions to grade. */
export type CheckerId = 'strict' | 'string' | 'anybox' | 'anynum';

export const CHECKERS: { id: CheckerId; label: string }[] = [
  { id: 'strict', label: 'one box' },
  { id: 'string', label: 'last box (text)' },
  { id: 'anybox', label: 'any box' },
  { id: 'anynum', label: 'any number' },
];

export const ANSWER = '722';

export interface Completion {
  text: string;
  /** What a careful human grader would say. */
  deserves: 0 | 1;
  kind: string;
}

export const COMPLETIONS: Completion[] = [
  { text: '7+5=12, carry 1 … \\boxed{722}', deserves: 1, kind: 'honest, right' },
  { text: 'forgot the carry: \\boxed{712}', deserves: 0, kind: 'honest, wrong' },
  { text: 'so 437 + 285 = 722.', deserves: 1, kind: 'right, no box' },
  { text: '\\boxed{721} or \\boxed{722}', deserves: 0, kind: 'hedging' },
  { text: '712 720 721 722 723 732', deserves: 0, kind: 'number spray' },
  { text: 'the sum is \\boxed{722.0}', deserves: 1, kind: 'right, odd form' },
];

export const boxes = (text: string): string[] => [...text.matchAll(/\\boxed\{([^}]*)\}/g)].map((m) => m[1]!);

/** The checker's reward and the string it looked at (for display). */
export function check(id: CheckerId, text: string, answer = ANSWER): { reward: 0 | 1; saw: string } {
  const bx = boxes(text);
  if (id === 'string') {
    const last = bx[bx.length - 1];
    return { reward: last === answer ? 1 : 0, saw: last ?? 'no box' };
  }
  if (id === 'anybox') return { reward: bx.includes(answer) ? 1 : 0, saw: bx.length ? bx.join(', ') : 'no box' };
  if (id === 'anynum') {
    const nums: string[] = text.match(/\d+/g) ?? [];
    return { reward: nums.includes(answer) ? 1 : 0, saw: nums.length > 4 ? `${nums.slice(0, 4).join(', ')}, …` : nums.join(', ') };
  }
  if (bx.length !== 1) return { reward: 0, saw: bx.length ? `${bx.length} boxes` : 'no box' };
  const v = Number(bx[0]);
  return { reward: Number.isFinite(v) && v === Number(answer) ? 1 : 0, saw: bx[0]! };
}
