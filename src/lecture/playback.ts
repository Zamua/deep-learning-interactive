import { icon } from '../core/controls';
import { onDispose } from '../core/dom';
import type { LectureLog } from './progress';
import { Clock } from './clock';
import { type Effect, initial, next, type PlayEvent, type PlayState, type Silence, wantsPlay } from './playback-state';
import { type TScene, jumpTarget, resumePoint } from './timeline';

export interface Playback {
  clock: Clock;
  play(): Promise<void>;
  pause(): void;
  toggle(): void;
  seek(t: number): void;
  seekBy(dt: number): void;
  /** Jumps a section forward or back. */
  jump(d: 1 | -1): void;
  /** Plays from `t`; `resume` picks up as after a pause there. */
  playFrom(t: number, resume: boolean): void;
  /** Playback has begun and not reached the end. */
  live(): boolean;
}

export interface PlaybackOptions {
  /** The narration track; null plays silently, on a wall clock. */
  src: string | null;
  scenes: TScene[];
  duration: number;
  log: LectureLog;
  /** Carries the play state as classes. */
  root: HTMLElement;
  /** The buttons that show play or pause. */
  buttons: HTMLElement[];
  notice: HTMLElement;
  /** What to call the lecture in messages. */
  noun: string;
  /** Shows the lecture at time `T`. */
  frame(T: number): void;
  /** Shows the play state outside the page, in the system's media controls. */
  state(playing: boolean): void;
  /** Playback reached the end. */
  ended(): void;
}

/** Keeps the screen on while playing, where the browser allows it. */
function screenWake(): (on: boolean) => Promise<void> {
  let lock: WakeLockSentinel | null = null;
  return async (on) => {
    try {
      if (on && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => (lock = null));
      } else if (!on && lock) {
        await lock.release();
        lock = null;
      }
    } catch {
      /* no wake lock: the screen may dim, playback continues */
    }
  };
}

const SILENCE: Record<Silence, (noun: string) => string> = {
  'cannot-play': (noun) => `The narration could not play here, so the ${noun} is running with captions only.`,
  failed: (noun) => `The narration failed to load, so the ${noun} is running with captions only.`,
  offline: (noun) => `You're offline, so the ${noun} is running with captions only.`,
};

const refusal = (e: unknown): 'blocked' | 'aborted' | 'failed' => {
  const name = (e as DOMException | undefined)?.name;
  // AbortError: a pause landed before playback began.
  return name === 'NotAllowedError' ? 'blocked' : name === 'AbortError' ? 'aborted' : 'failed';
};

/**
 * Plays, pauses and seeks the lecture, and keeps its place and heard time saved. The play state and its moves are
 * playback-state.ts; this shell sends it events, performs the effects it returns and shows the state on `root`.
 */
export function mountPlayback(o: PlaybackOptions): Playback {
  const { scenes, duration, log, root, notice } = o;
  let audio: HTMLAudioElement | null = null;
  if (o.src !== null) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.src = o.src;
  }
  const clock = new Clock(audio, duration);
  if (!audio && import.meta.env.DEV) notice.textContent = 'Narration is out of date: run node tools/lecture/build.mjs. Playing silently.';
  const wake = screenWake();

  let state: PlayState = initial(audio ? 'narrated' : 'captions');
  let raf = 0;
  // Heard time: only playback that ran on from the previous tick counts, never a seek's jump.
  let heardFrom: number | null = null;
  let savedAt = 0;

  function sync(): void {
    const T = clock.time();
    o.frame(T);
    hearTo(T);
  }

  function hearTo(T: number): void {
    if (heardFrom !== null && T >= heardFrom && T - heardFrom < 4) log.hear(heardFrom, T);
    heardFrom = clock.paused ? null : T;
    if (!clock.paused && performance.now() - savedAt > 3000) savePos();
  }

  function loop(): void {
    sync();
    if (!clock.paused) raf = requestAnimationFrame(loop);
  }

  function savePos(): void {
    // Before the first play the clock sits at 0 behind the poster; saving it would erase the resume point.
    if (state.phase.kind === 'poster') return;
    savedAt = performance.now();
    log.save(clock.time());
  }

  function render(prev: PlayState | null): void {
    const kind = state.phase.kind;
    const playing = wantsPlay(state.phase);
    root.classList.toggle('started', kind !== 'poster');
    root.classList.toggle('playing', playing);
    root.classList.toggle('paused', !playing && kind !== 'poster');
    root.classList.toggle('waiting', kind === 'buffering');
    root.classList.toggle('ended', kind === 'ended');
    if (prev && wantsPlay(prev.phase) === playing) return;
    const ic = icon(playing ? 'pauseFill' : 'playFill');
    for (const b of o.buttons) {
      b.innerHTML = ic;
      b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }
    o.state(playing);
  }

  function perform(fx: Effect): void {
    switch (fx.do) {
      case 'seek':
        heardFrom = null;
        clock.seek(fx.t);
        return;
      case 'resume': {
        const p = resumePoint(scenes, fx.at);
        if (p < clock.time() - 0.01) clock.seek(p);
        return;
      }
      case 'play':
        clock.play().catch((e: unknown) => send({ type: 'play-refused', why: refusal(e) }));
        return;
      case 'pause':
        clock.pause();
        return;
      case 'silence':
        clock.goSilent();
        notice.textContent = SILENCE[fx.why](o.noun);
        return;
      case 'wake':
        void wake(fx.on);
        return;
      case 'frames':
        cancelAnimationFrame(raf);
        if (wantsPlay(state.phase) && !clock.paused) raf = requestAnimationFrame(loop);
        else sync();
        return;
      case 'save':
        savePos();
        return;
      case 'finish':
        o.ended();
        log.save(duration);
        return;
      default:
        return absurd(fx);
    }
  }

  function send(e: PlayEvent): void {
    const prev = state;
    const [s, effects] = next(state, e);
    state = s;
    for (const fx of effects) perform(fx);
    if (state !== prev) render(prev);
  }

  if (audio) {
    // Media events arrive a task late: one whose moment has already passed (a pause the viewer undid, say) is dropped.
    audio.addEventListener('playing', () => !audio.paused && send({ type: 'media-playing' }));
    audio.addEventListener('pause', () => audio.paused && !audio.ended && send({ type: 'media-paused', t: clock.time() }));
    audio.addEventListener('waiting', () => !audio.paused && send({ type: 'media-waiting' }));
    audio.addEventListener('ended', () => send({ type: 'media-ended' }));
    audio.addEventListener('error', () => send({ type: 'media-error', online: navigator.onLine }));
    audio.addEventListener('seeked', () => sync());
    // Keeps heard time and the saved place current while the screen is off and frames stop.
    audio.addEventListener('timeupdate', () => hearTo(clock.time()));
  }
  // A silent clock has no 'ended' event: with no narration, or once the narration failed to load.
  const tick = window.setInterval(() => send({ type: 'tick', t: clock.time(), duration }), 250);
  onDispose(() => window.clearInterval(tick));

  const onVis = () => {
    if (document.visibilityState === 'visible' && !clock.paused) void wake(true);
    if (document.visibilityState === 'hidden') savePos();
  };
  document.addEventListener('visibilitychange', onVis);
  const saver = window.setInterval(() => !clock.paused && savePos(), 5000);
  const onHide = () => savePos();
  window.addEventListener('pagehide', onHide);
  onDispose(() => {
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', onHide);
    window.clearInterval(saver);
    cancelAnimationFrame(raf);
    if (!clock.paused) savePos();
    clock.pause();
    if (audio) {
      audio.removeAttribute('src');
      audio.load();
    }
    void wake(false);
  });

  render(null);

  const play = async (): Promise<void> => send({ type: 'play' });
  const pause = (): void => send({ type: 'pause', t: clock.time() });
  const seek = (t: number): void => send({ type: 'seek', t });
  return {
    clock,
    play,
    pause,
    toggle: () => (wantsPlay(state.phase) ? pause() : void play()),
    seek,
    seekBy: (dt) => seek(clock.time() + dt),
    jump: (d) => seek(jumpTarget(scenes, clock.time(), d)),
    playFrom: (t, resume) => send({ type: 'play', from: { t, resume } }),
    live: () => state.phase.kind !== 'poster' && state.phase.kind !== 'ended',
  };
}

function absurd(fx: never): never {
  throw new Error(`unknown effect ${JSON.stringify(fx)}`);
}
