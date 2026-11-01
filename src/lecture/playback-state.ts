// The lecture's play state, and every move between states. Pure: the shell in playback.ts sends the events (the
// viewer's, the audio element's, the silent clock's tick), performs the effects and renders the state.

/** Where playback stands. `at`: where a pause stopped, so play resumes from just before it; null once a seek moves on. */
export type Phase =
  | { kind: 'poster' }
  | { kind: 'starting' }
  | { kind: 'playing' }
  | { kind: 'buffering' }
  | { kind: 'paused'; at: number | null }
  | { kind: 'ended' };

/** `captions`: no narration, or it failed; a wall clock runs the lecture. One way: narration never comes back. */
export type Mode = 'narrated' | 'captions';

export interface PlayState {
  phase: Phase;
  mode: Mode;
}

/** Why the narration stopped being used. */
export type Silence = 'cannot-play' | 'failed' | 'offline';

export type PlayEvent =
  /** The viewer asks to play; `from` plays from a time, resuming as after a pause there when `resume`. */
  | { type: 'play'; from?: { t: number; resume: boolean } }
  | { type: 'pause'; t: number }
  | { type: 'seek'; t: number }
  /** The clock's play was refused: `blocked` by the browser until a tap, or `aborted` by a pause meanwhile. */
  | { type: 'play-refused'; why: 'blocked' | 'aborted' | 'failed' }
  | { type: 'media-playing' }
  | { type: 'media-paused'; t: number }
  | { type: 'media-waiting' }
  | { type: 'media-ended' }
  | { type: 'media-error'; online: boolean }
  /** The silent clock's poll. */
  | { type: 'tick'; t: number; duration: number };

export type Effect =
  | { do: 'seek'; t: number }
  /** Seek back to the start of the line a pause at `at` interrupted. */
  | { do: 'resume'; at: number }
  | { do: 'play' }
  | { do: 'pause' }
  /** Drop the narration and carry on from the same moment on a wall clock. */
  | { do: 'silence'; why: Silence }
  | { do: 'wake'; on: boolean }
  /** Run frames while playing; draw one otherwise. */
  | { do: 'frames' }
  | { do: 'save' }
  | { do: 'finish' };

export const initial = (mode: Mode): PlayState => ({ phase: { kind: 'poster' }, mode });

/** Playing, or about to: the viewer's next tap pauses. */
export const wantsPlay = (p: Phase): boolean => p.kind === 'starting' || p.kind === 'playing' || p.kind === 'buffering';

const to = (s: PlayState, phase: Phase, ...effects: Effect[]): [PlayState, Effect[]] => [{ ...s, phase }, effects];
const stay = (s: PlayState): [PlayState, Effect[]] => [s, []];
const started: Effect[] = [{ do: 'wake', on: true }, { do: 'frames' }];
const stopped: Effect[] = [{ do: 'wake', on: false }, { do: 'save' }, { do: 'frames' }];

export function next(s: PlayState, e: PlayEvent): [PlayState, Effect[]] {
  const { phase, mode } = s;
  switch (e.type) {
    case 'play': {
      if (wantsPlay(phase) && !e.from) return stay(s);
      const before: Effect[] = e.from ? [{ do: 'seek', t: e.from.t }] : phase.kind === 'ended' ? [{ do: 'seek', t: 0 }] : [];
      const at = e.from ? (e.from.resume ? e.from.t : null) : phase.kind === 'paused' ? phase.at : null;
      const resume: Effect[] = at === null ? [] : [{ do: 'resume', at }];
      // A wall clock starts at once; narration reports when it is actually playing.
      if (mode === 'captions') return to(s, { kind: 'playing' }, ...before, ...resume, { do: 'play' }, ...started);
      return to(s, { kind: 'starting' }, ...before, ...resume, { do: 'play' });
    }
    case 'pause':
      if (!wantsPlay(phase)) return stay(s);
      return to(s, { kind: 'paused', at: e.t }, { do: 'pause' }, ...stopped);
    case 'seek': {
      const kind = phase.kind;
      if (kind === 'poster' || kind === 'ended' || kind === 'paused') return to(s, { kind: 'paused', at: null }, { do: 'seek', t: e.t }, { do: 'frames' });
      return [s, [{ do: 'seek', t: e.t }, { do: 'frames' }]];
    }
    case 'play-refused':
      if (phase.kind !== 'starting') return stay(s);
      if (e.why === 'failed') return [{ mode: 'captions', phase: { kind: 'playing' } }, [{ do: 'silence', why: 'cannot-play' }, { do: 'play' }, ...started]];
      return to(s, { kind: 'paused', at: null });
    case 'media-playing':
      if (mode === 'captions' || phase.kind === 'playing') return stay(s);
      return to(s, { kind: 'playing' }, ...started);
    case 'media-paused':
      // The viewer's own pause has moved on already; this one came from the system (a call, unplugged headphones).
      if (mode === 'captions' || !wantsPlay(phase)) return stay(s);
      return to(s, { kind: 'paused', at: e.t }, ...stopped);
    case 'media-waiting':
      if (mode === 'captions' || (phase.kind !== 'playing' && phase.kind !== 'starting')) return stay(s);
      return to(s, { kind: 'buffering' });
    case 'media-ended':
      if (mode === 'captions') return stay(s);
      return to(s, { kind: 'ended' }, { do: 'finish' }, { do: 'wake', on: false }, { do: 'frames' });
    case 'media-error': {
      if (mode === 'captions') return stay(s);
      const why: Silence = e.online ? 'failed' : 'offline';
      if (wantsPlay(phase)) return [{ mode: 'captions', phase: { kind: 'playing' } }, [{ do: 'silence', why }, { do: 'play' }, ...started]];
      return [{ ...s, mode: 'captions' }, [{ do: 'silence', why }]];
    }
    case 'tick':
      if (mode !== 'captions' || phase.kind !== 'playing' || e.t < e.duration) return stay(s);
      return to(s, { kind: 'ended' }, { do: 'pause' }, { do: 'finish' }, { do: 'wake', on: false }, { do: 'frames' });
    default:
      return absurd(e);
  }
}

function absurd(e: never): never {
  throw new Error(`unknown play event ${JSON.stringify(e)}`);
}
