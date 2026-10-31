import { icon } from '../core/controls';
import { h } from '../core/dom';
import type { LectureFrame } from './player';
import type { Playback } from './playback';
import { mmss } from '../core/format';

/** The card over the picture before the first play, offering to resume, and the one at the end. */
export function mountPoster(o: {
  title: string;
  frame: LectureFrame;
  duration: number;
  /** Where the viewer stopped last time; 0 for nowhere. */
  saved: number;
  /** Share of the lecture heard so far. */
  heard: number;
  pb: Pick<Playback, 'play' | 'playFrom'>;
}): HTMLElement[] {
  const { frame, duration, saved, heard, pb } = o;
  const posterPlay = h('button', { class: 'lec-poster-play', type: 'button', html: `${icon('playFill')}<span>${saved ? 'Start over' : `Play the ${frame.noun}`}</span>` });
  const poster = h('div', { class: 'lec-poster' },
    h('div', { class: 'lec-poster-kicker' }, [...frame.poster, duration < 90 ? `${Math.round(duration)} s` : `${Math.round(duration / 60)} min`, heard >= 0.02 ? `${Math.round(heard * 100)}% heard` : ''].filter(Boolean).join(' · ')),
    h('h1', { class: 'lec-poster-title' }, o.title),
    h('div', { class: 'lec-poster-actions' }, posterPlay));
  posterPlay.addEventListener('click', (e) => {
    e.stopPropagation();
    if (saved) pb.playFrom(0, false);
    else void pb.play();
  });
  if (saved > 0 && saved < duration) {
    const resume = h('button', { class: 'lec-poster-play lec-resume', type: 'button', html: `${icon('playFill')}<span>Resume at ${mmss(saved)}</span>` });
    resume.addEventListener('click', (e) => {
      e.stopPropagation();
      pb.playFrom(saved, true);
    });
    poster.querySelector('.lec-poster-actions')!.prepend(resume);
  }
  const replay = h('button', { class: 'btn', type: 'button', html: `${icon('reset')} Watch again` });
  replay.addEventListener('click', (e) => {
    e.stopPropagation();
    void pb.play();
  });
  const endcard = h('div', { class: 'lec-end' },
    h('div', { class: 'lec-poster-kicker' }, frame.end.kicker),
    h('h2', { class: 'lec-end-title' }, frame.end.title),
    h('div', { class: 'lec-poster-actions' },
      h('a', { class: 'btn btn-primary', href: frame.end.href, html: `${frame.end.action} ${icon('arrowRight')}` }),
      replay));
  return [poster, endcard];
}
