import { onDispose } from '../core/dom';
import type { Playback } from './playback';

export interface KeyActions extends Pick<Playback, 'toggle' | 'seekBy' | 'jump'> {
  captions(): void;
  speed(d: 1 | -1): void;
  fullscreen(): void;
  closeList(): void;
}

/** The player's keyboard shortcuts, until the page is disposed. */
export function mountKeys(a: KeyActions): void {
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ' || k === 'k') {
      e.preventDefault();
      a.toggle();
    } else if (k === 'ArrowRight' || k === 'l') a.seekBy(k === 'l' ? 10 : 5);
    else if (k === 'ArrowLeft' || k === 'j') a.seekBy(-(k === 'j' ? 10 : 5));
    else if (k === ']' || k === 'n') a.jump(1);
    else if (k === '[' || k === 'p') a.jump(-1);
    else if (k === 'c') a.captions();
    else if (k === '>' || k === '.') a.speed(1);
    else if (k === '<' || k === ',') a.speed(-1);
    else if (k === 'f' && document.fullscreenEnabled) a.fullscreen();
    else if (k === 'Escape') a.closeList();
  };
  window.addEventListener('keydown', onKey);
  onDispose(() => window.removeEventListener('keydown', onKey));
}
