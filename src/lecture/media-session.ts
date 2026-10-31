// The system's media controls: the lock screen, headset buttons and the like.
import { onDispose } from '../core/dom';
import type { Playback } from './playback';

const session = (): MediaSession | null => ('mediaSession' in navigator ? navigator.mediaSession : null);

export function mediaScene(title: string, artist: string): void {
  const ms = session();
  if (ms) ms.metadata = new MediaMetadata({ title, artist, album: 'atlas interactive' });
}

export function mediaPlaying(playing: boolean): void {
  const ms = session();
  if (ms) ms.playbackState = playing ? 'playing' : 'paused';
}

const ACTIONS: MediaSessionAction[] = ['play', 'pause', 'seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'];

/** Hands the system's controls to `pb` until the page is disposed. */
export function mediaActions(pb: Pick<Playback, 'play' | 'pause' | 'seek' | 'seekBy' | 'jump'>): void {
  const ms = session();
  if (!ms) return;
  const set = (a: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
    try {
      ms.setActionHandler(a, fn);
    } catch {
      /* action not supported here */
    }
  };
  set('play', () => void pb.play());
  set('pause', () => pb.pause());
  set('seekbackward', (d) => pb.seekBy(-(d.seekOffset ?? 10)));
  set('seekforward', (d) => pb.seekBy(d.seekOffset ?? 10));
  set('seekto', (d) => d.seekTime !== undefined && pb.seek(d.seekTime));
  set('previoustrack', () => pb.jump(-1));
  set('nexttrack', () => pb.jump(1));
  onDispose(() => {
    for (const a of ACTIONS) set(a, null);
    ms.metadata = null;
  });
}
