import { describe, expect, it } from 'vitest';
import { initial, next, type Effect, type Mode, type PlayEvent, type PlayState } from './playback-state';

/** Feeds events in order; returns the final state and every effect asked for. */
function run(mode: Mode, ...events: PlayEvent[]): { s: PlayState; fx: Effect[] } {
  let s = initial(mode);
  const fx: Effect[] = [];
  for (const e of events) {
    const [n, out] = next(s, e);
    s = n;
    fx.push(...out);
  }
  return { s, fx };
}
const did = (fx: Effect[]) => fx.map((f) => f.do);

describe('narrated playback', () => {
  it('starts on play and plays once the audio says so', () => {
    expect(run('narrated', { type: 'play' }).s.phase.kind).toBe('starting');
    const { s, fx } = run('narrated', { type: 'play' }, { type: 'media-playing' });
    expect(s.phase.kind).toBe('playing');
    expect(did(fx)).toEqual(['play', 'wake', 'frames']);
  });

  it('stops buffering when paused while the audio waits for data', () => {
    const { s, fx } = run('narrated', { type: 'play' }, { type: 'media-playing' }, { type: 'media-waiting' }, { type: 'pause', t: 30 }, { type: 'media-paused', t: 30 });
    expect(s.phase).toEqual({ kind: 'paused', at: 30 });
    expect(did(fx).slice(-4)).toEqual(['pause', 'wake', 'save', 'frames']);
  });

  it('ignores the audio waiting while paused, and the pause event of its own pause', () => {
    const paused = run('narrated', { type: 'play' }, { type: 'media-playing' }, { type: 'pause', t: 12 });
    const [s, fx] = next(paused.s, { type: 'media-waiting' });
    expect(s).toBe(paused.s);
    expect(next(s, { type: 'media-paused', t: 12 })).toEqual([s, []]);
    expect(fx).toEqual([]);
  });

  it('pauses when the system pauses the audio, and resumes where that pause stopped', () => {
    const { s } = run('narrated', { type: 'play' }, { type: 'media-playing' }, { type: 'media-paused', t: 40 });
    expect(s.phase).toEqual({ kind: 'paused', at: 40 });
    expect(next(s, { type: 'play' })[1]).toEqual([{ do: 'resume', at: 40 }, { do: 'play' }]);
  });

  it('forgets the pause point once a seek moves on, so play starts at the seek', () => {
    const { s, fx } = run('narrated', { type: 'play' }, { type: 'media-playing' }, { type: 'pause', t: 40 }, { type: 'seek', t: 90 }, { type: 'play' });
    expect(s.phase.kind).toBe('starting');
    expect(did(fx)).not.toContain('resume');
  });

  it('plays again from the start after the end, and a seek leaves the end card', () => {
    const ended = run('narrated', { type: 'play' }, { type: 'media-playing' }, { type: 'media-ended' });
    expect(ended.s.phase.kind).toBe('ended');
    expect(did(ended.fx)).toContain('finish');
    expect(next(ended.s, { type: 'play' })[1][0]).toEqual({ do: 'seek', t: 0 });
    expect(next(ended.s, { type: 'seek', t: 5 })[0].phase).toEqual({ kind: 'paused', at: null });
  });

  it('switches to captions when the narration fails, playing on if it was', () => {
    const { s, fx } = run('narrated', { type: 'play' }, { type: 'media-playing' }, { type: 'media-error', online: false });
    expect(s).toEqual({ mode: 'captions', phase: { kind: 'playing' } });
    expect(fx.slice(3)).toEqual([{ do: 'silence', why: 'offline' }, { do: 'play' }, { do: 'wake', on: true }, { do: 'frames' }]);
    expect(run('narrated', { type: 'media-error', online: true }).s).toEqual({ mode: 'captions', phase: { kind: 'poster' } });
  });

  it('pauses when the browser blocks playing until a tap; a pause before it began changes nothing more', () => {
    expect(run('narrated', { type: 'play' }, { type: 'play-refused', why: 'blocked' }).s.phase).toEqual({ kind: 'paused', at: null });
    const { s } = run('narrated', { type: 'play' }, { type: 'pause', t: 0 }, { type: 'play-refused', why: 'aborted' });
    expect(s.phase).toEqual({ kind: 'paused', at: 0 });
  });

  it('plays from a saved place as after a pause there', () => {
    const [s, fx] = next(initial('narrated'), { type: 'play', from: { t: 75, resume: true } });
    expect(s.phase.kind).toBe('starting');
    expect(fx).toEqual([{ do: 'seek', t: 75 }, { do: 'resume', at: 75 }, { do: 'play' }]);
  });
});

describe('captions-only playback', () => {
  it('plays at once and ends on the clock, as no audio will say so', () => {
    const { s, fx } = run('captions', { type: 'play' }, { type: 'tick', t: 50, duration: 60 });
    expect(s.phase.kind).toBe('playing');
    expect(did(fx)).toEqual(['play', 'wake', 'frames']);
    const end = next(s, { type: 'tick', t: 60, duration: 60 });
    expect(end[0].phase.kind).toBe('ended');
    expect(did(end[1])).toEqual(['pause', 'finish', 'wake', 'frames']);
  });

  it('ignores the audio element entirely', () => {
    const playing = run('captions', { type: 'play' }).s;
    for (const e of [{ type: 'media-waiting' }, { type: 'media-paused', t: 3 }, { type: 'media-ended' }, { type: 'media-error', online: true }] as PlayEvent[]) {
      expect(next(playing, e)).toEqual([playing, []]);
    }
  });
});
