import { equivalent } from './expr';
import type { Answer, Problem } from './types';

/** What the learner submitted: typed text, or the index (indices) of the option(s) chosen. */
export type Response = string | number | number[];

export interface Verdict {
  ok: boolean;
  /** The response could not be read; shown instead of counting it as an answer. */
  unreadable?: string;
  /** Why a wrong answer is probably wrong, when a trap or a choice explains it. */
  why?: string;
}

/** Reads `0.24`, `-1.5`, `.5`, `1/3`, `2e-3`, with typographic minus signs. */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(/[−–]/g, '-').replace(/,/g, '');
  const num = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
  if (num.test(t)) return Number(t);
  const frac = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*\/\s*([+-]?(?:\d+\.?\d*|\.\d+))$/.exec(t);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  return null;
}

/** Reads `(10, 3072)`, `10x3072`, `10 × 3072` or `[10, 3072]`. */
export function parseShape(s: string): number[] | null {
  const t = s.trim().replace(/^[([]\s*|\s*[)\]]$/g, '');
  if (!t) return [];
  const parts = t.split(/\s*[,x×]\s*|\s+/i).filter((p) => p !== '');
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  return parts.map(Number);
}

/** Reads `[0.71, 0.26, 0.04]` or the same without brackets; entries as in `parseNumber`. */
export function parseVector(s: string): number[] | null {
  const t = s.trim().replace(/^\[\s*|\s*\]$/g, '');
  const parts = t.split(/\s*[,;]\s*|\s+/).filter((p) => p !== '');
  const xs = parts.map(parseNumber);
  return xs.length && xs.every((x) => x !== null) ? (xs as number[]) : null;
}

/** Whether `x` is `want` to `places` decimals (exact when `places` is unset). */
export function closeTo(x: number, want: number, places?: number): boolean {
  if (places === undefined) return Math.abs(x - want) <= 1e-9 * Math.max(1, Math.abs(want));
  return Math.abs(x - want) <= 0.5 * 10 ** -places * (1 + 1e-9) + 1e-12;
}

export function grade(p: Problem, r: Response): Verdict {
  const a: Answer = p.answer;
  switch (a.kind) {
    case 'number': {
      const x = typeof r === 'string' ? parseNumber(r) : null;
      if (x === null) return { ok: false, unreadable: 'Enter a number, like 0.25, -3 or 1/4.' };
      if (closeTo(x, a.value, a.places)) return { ok: true };
      return caught(p, (t) => typeof t === 'number' && closeTo(x, t, a.places));
    }
    case 'shape': {
      const s = typeof r === 'string' ? parseShape(r) : null;
      if (!s) return { ok: false, unreadable: 'Enter a shape, like (10, 3072).' };
      const same = (t: number[]) => s.length === t.length && s.every((d, i) => d === t[i]);
      return same(a.value) ? { ok: true } : caught(p, (t) => Array.isArray(t) && same(t));
    }
    case 'vector': {
      const v = typeof r === 'string' ? parseVector(r) : null;
      if (!v) return { ok: false, unreadable: 'Enter numbers separated by commas, like [0.5, 0.25].' };
      const same = (t: number[]) => v.length === t.length && v.every((x, i) => closeTo(x, t[i]!, a.places));
      return same(a.value) ? { ok: true } : caught(p, (t) => Array.isArray(t) && same(t));
    }
    case 'choice': {
      if (typeof r !== 'number') return { ok: false, unreadable: 'Pick one option.' };
      const why = a.why?.[r];
      return r === a.correct ? { ok: true } : why ? { ok: false, why } : { ok: false };
    }
    case 'order': {
      if (!Array.isArray(r) || r.length !== a.items.length) return { ok: false, unreadable: 'Put every item in order.' };
      return { ok: r.every((x, i) => x === i) };
    }
    case 'expr': {
      if (typeof r !== 'string' || !r.trim()) return { ok: false, unreadable: 'Enter an expression.' };
      try {
        return { ok: equivalent(a.value, r, a.vars) };
      } catch (e) {
        return { ok: false, unreadable: `Could not read that: ${(e as Error).message}.` };
      }
    }
  }
}

/** A wrong answer, explained by the first trap it matches. */
function caught(p: Problem, matches: (value: number | number[]) => boolean): Verdict {
  const trap = p.traps?.find((t) => matches(t.value));
  return trap ? { ok: false, why: trap.why } : { ok: false };
}

/** The response that `grade` accepts for a problem: what the self-check and tests submit. */
export function expectedResponse(a: Answer): Response {
  switch (a.kind) {
    case 'number':
      return String(a.value);
    case 'shape':
      return `(${a.value.join(', ')})`;
    case 'vector':
      return `[${a.value.join(', ')}]`;
    case 'choice':
      return a.correct;
    case 'order':
      return a.items.map((_, i) => i);
    case 'expr':
      return a.value;
  }
}
