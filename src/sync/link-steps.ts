// Linking this device to an account by its code: the steps, and every move between them. Pure: the account page sends
// the events, runs the effects (the lookups and the link itself) and draws the step.

/** What a code's account holds, next to this device's own progress. */
/** The code in what was pasted: a shared link carries one, and the share sheet's Copy gives the link. Anything else is left as it is. */
export function codeFromPaste(text: string): string {
  const m = /#\/link\/([^?#\s]+)/.exec(text);
  if (!m) return text;
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return m[1]!;
  }
}

export interface Peek {
  /** Concepts mastered there, and its latest practice. */
  theirs: { n: number; last: number };
  /** Concepts mastered on this device. */
  mine: number;
}

export type LinkStep =
  | { kind: 'typing'; text: string }
  | { kind: 'looking'; text: string }
  /** The account was found; the learner decides. `error`: a link that just failed, to try again. */
  | { kind: 'confirm'; text: string; peek: Peek; error?: string }
  | { kind: 'linking'; text: string; peek: Peek }
  | { kind: 'linked'; mastered: number; pending: boolean }
  /** The code is this device's own. */
  | { kind: 'same' }
  | { kind: 'failed'; message: string };

export type LinkEvent =
  | { type: 'edit'; text: string }
  | { type: 'submit'; text: string }
  | { type: 'peeked'; text: string; same: boolean; peek: Peek }
  | { type: 'link' }
  | { type: 'cancel' }
  | { type: 'linked'; text: string; mastered: number; pending: boolean }
  | { type: 'failed'; text: string; message: string };

export type LinkEffect = { do: 'look'; text: string } | { do: 'link'; text: string } | { do: 'clear' };

export const start: LinkStep = { kind: 'typing', text: '' };

/** A lookup or a link is out: the code field and Continue wait for its answer. */
export const busy = (s: LinkStep): boolean => s.kind === 'looking' || s.kind === 'linking';

/** The code a lookup or link in flight was for; an answer about any other is stale. */
const inFlight = (s: LinkStep): string | null => (s.kind === 'looking' || s.kind === 'linking' ? s.text : null);

export function next(s: LinkStep, e: LinkEvent): [LinkStep, LinkEffect[]] {
  switch (e.type) {
    case 'edit':
      return busy(s) ? [s, []] : [{ kind: 'typing', text: e.text }, []];
    case 'submit':
      return busy(s) ? [s, []] : [{ kind: 'looking', text: e.text }, [{ do: 'look', text: e.text }]];
    case 'peeked':
      if (s.kind !== 'looking' || s.text !== e.text) return [s, []];
      return [e.same ? { kind: 'same' } : { kind: 'confirm', text: e.text, peek: e.peek }, []];
    case 'link':
      return s.kind === 'confirm' ? [{ kind: 'linking', text: s.text, peek: s.peek }, [{ do: 'link', text: s.text }]] : [s, []];
    case 'cancel':
      return s.kind === 'confirm' ? [{ kind: 'typing', text: s.text }, []] : [s, []];
    case 'linked':
      if (s.kind !== 'linking' || s.text !== e.text) return [s, []];
      return [{ kind: 'linked', mastered: e.mastered, pending: e.pending }, [{ do: 'clear' }]];
    case 'failed':
      if (inFlight(s) !== e.text) return [s, []];
      // A failed link leaves the question open, to try again; a failed lookup has nothing to show.
      return [s.kind === 'linking' ? { kind: 'confirm', text: s.text, peek: s.peek, error: e.message } : { kind: 'failed', message: e.message }, []];
    default:
      return absurd(e);
  }
}

function absurd(e: never): never {
  throw new Error(`unknown link event ${JSON.stringify(e)}`);
}
