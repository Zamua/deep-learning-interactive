import { icon } from '../core/controls';
import { onDispose } from '../core/dom';
import type { LectureLog } from './progress';
import { Clock } from './clock';
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

/** Plays, pauses and seeks the lecture, and keeps its place and heard time saved. */
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

  let started = false;
  let ended = false;
  let raf = 0;
  /** Where playback stopped by a pause, until a seek moves it; play resumes from just before it. */
  let pausedAt: number | null = null;
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

  function setPlayingUi(playing: boolean): void {
    root.classList.toggle('playing', playing);
    root.classList.toggle('paused', !playing && started);
    const ic = icon(playing ? 'pauseFill' : 'playFill');
    for (const b of o.buttons) {
      b.innerHTML = ic;
      b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }
    o.state(playing);
  }

  async function play(): Promise<void> {
    started = true;
    root.classList.add('started');
    if (ended) {
      ended = false;
      root.classList.remove('ended');
      clock.seek(0);
    }
    if (pausedAt !== null) {
      const p = resumePoint(scenes, pausedAt);
      if (p < clock.time() - 0.01) clock.seek(p);
    }
    pausedAt = null;
    try {
      await clock.play();
    } catch (e) {
      // AbortError: a pause landed before playback began.
      if (['NotAllowedError', 'AbortError'].includes((e as DOMException).name)) return;
      clock.goSilent();
      notice.textContent = `The narration could not play here, so the ${o.noun} is running with captions only.`;
      await clock.play();
    }
    if (clock.silent) onPlaying();
  }

  function onPlaying(): void {
    setPlayingUi(true);
    void wake(true);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function pause(): void {
    clock.pause();
    if (clock.silent) onPaused();
  }

  function onPaused(): void {
    pausedAt = clock.time();
    setPlayingUi(false);
    void wake(false);
    savePos();
    sync();
  }

  function onEnded(): void {
    pausedAt = null;
    o.ended();
    ended = true;
    root.classList.add('ended');
    setPlayingUi(false);
    void wake(false);
    log.save(duration);
    sync();
  }

  function toggle(): void {
    if (clock.paused) void play();
    else pause();
  }

  function seek(t: number): void {
    pausedAt = null;
    heardFrom = null;
    if (ended) {
      ended = false;
      root.classList.remove('ended');
    }
    clock.seek(t);
    sync();
    if (!started) {
      started = true;
      root.classList.add('started');
      setPlayingUi(false);
    }
  }

  function savePos(): void {
    // Before the first play the clock sits at 0 behind the poster; saving it would erase the resume point.
    if (!started) return;
    savedAt = performance.now();
    log.save(clock.time());
  }

  if (audio) {
    audio.addEventListener('playing', () => {
      root.classList.remove('waiting');
      onPlaying();
    });
    audio.addEventListener('pause', () => {
      if (!audio.ended) onPaused();
    });
    audio.addEventListener('waiting', () => root.classList.add('waiting'));
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', () => {
      if (clock.silent) return;
      const wasPlaying = !audio.paused || root.classList.contains('waiting');
      clock.goSilent();
      root.classList.remove('waiting');
      notice.textContent = navigator.onLine
        ? `The narration failed to load, so the ${o.noun} is running with captions only.`
        : `You're offline, and narration is saved only once played, so the ${o.noun} is running with captions only.`;
      if (wasPlaying) {
        void clock.play();
        onPlaying();
      }
    });
    audio.addEventListener('seeked', () => sync());
    // Keeps heard time and the saved place current while the screen is off and frames stop.
    audio.addEventListener('timeupdate', () => hearTo(clock.time()));
  }
  // A silent clock has no 'ended' event: with no narration, or once the narration failed to load.
  const check = window.setInterval(() => {
    if (clock.silent && !clock.paused && clock.time() >= duration) {
      clock.pause();
      onEnded();
    }
  }, 250);
  onDispose(() => window.clearInterval(check));

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

  setPlayingUi(false);

  return {
    clock,
    play,
    pause,
    toggle,
    seek,
    seekBy: (dt) => seek(clock.time() + dt),
    jump: (d) => seek(jumpTarget(scenes, clock.time(), d)),
    playFrom(t, resume) {
      clock.seek(t);
      if (resume) pausedAt = t;
      void play();
    },
    live: () => started && !ended,
  };
}
