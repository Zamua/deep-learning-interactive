import '../styles/lecture.css';
import { icon } from '../core/controls';
import { h, onDispose } from '../core/dom';
import { setMacros } from '../core/math';
import { linkSymbols, symbolMacros, type SymbolMap } from '../core/symbols';
import { mountGestures } from './gestures';
import type { Glossary } from './glossary';
import { mountKeys } from './keys';
import { mountLookup, type Note } from './lookup';
import { mediaActions, mediaPlaying, mediaScene } from './media-session';
import { mountPlayback } from './playback';
import { mountPoster } from './poster';
import { LectureLog } from './progress';
import { openPrefs } from './prefs';
import type { SceneDef } from './scene';
import { mountScrub } from './scrub';
import { mountSections } from './sections';
import { mountSpeed } from './speed';
import { mountTheater } from './theater';
import { layout, sceneIndexAt } from './timeline';
import { type LectureScript, type Timing, shownText } from './types';

export interface LectureDef {
  script: LectureScript;
  timing: Timing | null;
  scenes: Record<string, SceneDef>;
  symbols: SymbolMap;
  /** URL of the narration track. */
  audio: string;
  /** Notes on the calls in this lecture's code, beyond the shared library ones. */
  glossary?: Glossary;
}

/** Where a lecture sits: its back link, its labels, and where the end card leads. */
export interface LectureFrame {
  back: string;
  /** Above the scene title, e.g. "Calculus · Explainer". */
  kicker: string;
  /** The poster's line before the running time, e.g. ["Calculus", "Explainer"]. */
  poster: string[];
  /** Media session artist. */
  artist: string;
  /** What to call it in messages: "lecture" or "explainer". */
  noun: string;
  end: { kicker: string; title: string; action: string; href: string };
  /** The notation in a scene's marks and captions, for the lookup sheet. */
  notes?(marks: HTMLElement[], said: string): Note[];
}

const mmss = (t: number): string => {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: position just isn't kept */
    }
  },
  remove(k: string): void {
    try {
      localStorage.removeItem(k);
    } catch {
      /* private mode: nothing was kept */
    }
  },
};

/** Builds the full-screen lecture player for `def` into `host`. */
export function mountLecture(host: HTMLElement, def: LectureDef, frame: LectureFrame): void {
  const { scenes, duration, exact } = layout(def.script, def.timing);
  const log = new LectureLog(def.script.id, duration);
  const prefs = openPrefs(store);

  document.body.classList.add('lec-on');
  onDispose(() => document.body.classList.remove('lec-on'));

  const root = h('div', { class: 'lec', 'data-page': `lec-${def.script.id}`, role: 'region', 'aria-label': `Lecture: ${def.script.title}` });
  host.append(root);
  setMacros(symbolMacros(def.symbols));
  linkSymbols(root, def.symbols);

  const sceneTitle = h('div', { class: 'lec-scene-title' });
  const sceneCount = h('div', { class: 'lec-count' });
  const top = h('header', { class: 'lec-top' },
    h('a', { class: 'lec-back', href: frame.back, 'aria-label': 'Back', html: icon('arrowLeft') }),
    h('div', { class: 'lec-titles' },
      h('div', { class: 'lec-kicker' }, frame.kicker),
      sceneTitle),
    sceneCount);
  const stage = h('div', { class: 'lec-stage' });
  const centerBtn = h('button', { class: 'lec-center', type: 'button', 'aria-label': 'Play', html: icon('playFill') });
  const spinner = h('div', { class: 'lec-spinner', 'aria-hidden': 'true' });
  const cap = h('div', { class: 'lec-cap', 'aria-live': 'off' });
  const codeBox = h('div', { class: 'lec-code' });
  const playBtn = h('button', { class: 'lec-btn lec-play', type: 'button', 'aria-label': 'Play', html: icon('playFill') });
  const back10 = h('button', { class: 'lec-btn', type: 'button', 'aria-label': 'Back 10 seconds', html: icon('rewind') });
  const timeEl = h('div', { class: 'lec-time' });
  const ccBtn = h('button', { class: 'lec-btn', type: 'button', 'aria-label': 'Captions', 'aria-pressed': 'true', html: icon('closed-captioning') });
  const lookupBtn = h('button', { class: 'lec-btn', type: 'button', 'aria-label': 'Look up symbols and functions', html: icon('book') });
  const fsBtn = h('button', { class: 'lec-btn lec-fs', type: 'button', 'aria-label': 'Full screen', html: icon('corners-out') });
  const notice = h('div', { class: 'lec-notice' });
  const showTime = (T: number) => (timeEl.textContent = `${mmss(T)} / ${mmss(duration)}`);

  // These callbacks first run after mount, so they may name pieces built further down.
  const theater = mountTheater(def, scenes, { stage, codeBox, cap }, (i) => {
    const s = scenes[i]!;
    sceneTitle.textContent = s.title;
    sceneCount.textContent = `${i + 1} / ${scenes.length}`;
    sections.mark(i);
    mediaScene(s.title, frame.artist);
  });
  const pb = mountPlayback({
    src: exact ? def.audio : null,
    scenes,
    duration,
    log,
    root,
    buttons: [playBtn, centerBtn],
    notice,
    noun: frame.noun,
    frame(T) {
      theater.show(T);
      scrub.show(T);
      showTime(T);
      lookup.tick(T);
    },
    state: mediaPlaying,
    ended: () => speed.setBoost('off'),
  });
  const { clock } = pb;
  const speed = mountSpeed(root, clock, prefs);
  const overlays = mountGestures(stage, root, { live: pb.live, paused: () => clock.paused, toggle: pb.toggle, seekBy: pb.seekBy }, speed, prefs);
  const sections = mountSections({ root, scenes, log, seek: pb.seek, mmss });
  const scrub = mountScrub({ root, scenes, duration, seek: pb.seek, seekBy: pb.seekBy, tip: (t) => `${mmss(t)} · ${scenes[sceneIndexAt(scenes, t)]!.title}` });

  const bar = h('div', { class: 'lec-bar' }, scrub.el,
    h('div', { class: 'lec-row' }, playBtn, back10, timeEl, h('div', { class: 'lec-spacer' }), speed.button, ccBtn, lookupBtn, sections.button, document.fullscreenEnabled ? fsBtn : ''));
  root.append(top, h('div', { class: 'lec-main' }, stage, cap, codeBox), bar, sections.list, notice);
  stage.append(theater.marks, theater.chip, spinner, centerBtn, ...overlays);

  centerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    pb.toggle();
  });
  playBtn.addEventListener('click', pb.toggle);
  back10.addEventListener('click', () => pb.seekBy(-10));

  let ccOn = prefs.now.cc ?? true;
  const setCc = (on: boolean) => {
    ccOn = on;
    root.classList.toggle('no-cc', !on);
    ccBtn.setAttribute('aria-pressed', String(on));
    prefs.keep({ cc: on });
  };
  setCc(ccOn);
  ccBtn.addEventListener('click', () => setCc(!ccOn));

  const lookup = mountLookup({
    root,
    codeBox,
    bar,
    panels: theater.panels,
    marks: theater.markEls.map((m) => [...m.values()]),
    scenes,
    symbols: def.symbols,
    glossary: def.glossary ?? {},
    notes: frame.notes && ((i) => frame.notes!([...theater.markEls[i]!.values()], def.script.scenes[i]!.beats.map((b) => shownText(b.say)).join('\n'))),
    papers: (i) => (def.script.papers ?? []).filter((p) => p.scene === def.script.scenes[i]!.id),
    scene: () => Math.max(0, theater.current()),
    time: () => clock.time(),
    playing: () => !clock.paused,
    play: () => void pb.play(),
    pause: pb.pause,
    seek: pb.seek,
  });
  lookupBtn.addEventListener('click', () => lookup.showScene());

  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.requestFullscreen?.().catch(() => {});
  });
  const onFs = () => (fsBtn.innerHTML = icon(document.fullscreenElement ? 'corners-in' : 'corners-out'));
  document.addEventListener('fullscreenchange', onFs);
  onDispose(() => {
    document.removeEventListener('fullscreenchange', onFs);
    if (document.fullscreenElement) void document.exitFullscreen();
  });

  mountKeys({
    toggle: pb.toggle,
    seekBy: pb.seekBy,
    jump: pb.jump,
    captions: () => setCc(!ccOn),
    speed: speed.step,
    fullscreen: () => fsBtn.click(),
    closeList: () => sections.toggle(false),
  });
  mediaActions(pb);

  stage.append(...mountPoster({ title: def.script.title, frame, duration, saved: log.pos, heard: log.heardIn(), pb, mmss }));
  theater.pose();
  showTime(0);

  (window as unknown as { __lec: unknown }).__lec = {
    seek: pb.seek,
    play: pb.play,
    pause: pb.pause,
    duration,
    time: () => clock.time(),
    rate: () => clock.rate,
    boost: speed.boost,
    lookup: () => scenes.map((s, i) => ({
      scene: s.id,
      terms: lookup.terms(i, true).map((t) => ({ ...t, note: t.kind === 'sym' ? !!def.symbols[t.key]?.about : !!lookup.entry(t) })),
    })),
    scenes: scenes.map((s) => ({ id: s.id, start: s.start, end: s.end, beats: s.beats.map((b) => ({ id: b.id, start: b.start, end: b.end })) })),
  };
}
