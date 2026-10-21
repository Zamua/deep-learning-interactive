import '../styles/lecture.css';
import type { ChapterMeta } from '../chapters/index';
import { CodePanel } from '../core/code';
import { icon } from '../core/controls';
import { h, onDispose } from '../core/dom';
import { DONE, LectureLog } from '../core/progress';
import { setMacros, tex } from '../core/math';
import { Plot } from '../core/plot';
import { codeIndex, linkSymbols, symbolMacros, type SymbolMap } from '../core/symbols';
import type { Glossary } from './glossary';
import { mountLookup } from './lookup';
import { Scene, type SceneDef, clamp01 } from './scene';
import { type Beat, GAP, type LectureScript, type Timing, shownText, spokenText } from './types';

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

interface TBeat {
  id: string;
  start: number;
  end: number;
  code?: Beat['code'];
  caps: { at: number; text: string }[];
  /** Silences inside the line, [from, to]: where its phrases break. */
  pauses: [number, number][];
}

interface TScene {
  id: string;
  title: string;
  start: number;
  end: number;
  beats: TBeat[];
}

/** Splits a caption into pieces of at most ~`max` characters at sentence, then clause, boundaries. */
function captionChunks(text: string, max = 92): string[] {
  const pieces = text.split(/(?<=[.?!:])\s+/).flatMap((s) => (s.length <= max ? [s] : s.split(/(?<=,)\s+/)));
  const out: string[] = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    if (last !== undefined && last.length + p.length + 1 <= max && !/[.?!:]$/.test(last)) out[out.length - 1] = `${last} ${p}`;
    else if (last !== undefined && last.length + p.length + 1 <= max * 0.6) out[out.length - 1] = `${last} ${p}`;
    else out.push(p);
  }
  return out;
}

/**
 * Lays the script out in time. Uses the synthesized timing when every beat's text still matches
 * it; otherwise estimates from text length (and the player runs silent), so an edited script
 * stays watchable before its narration is rebuilt.
 */
function layout(script: LectureScript, timing: Timing | null): { scenes: TScene[]; duration: number; exact: boolean } {
  const exact = !!timing && script.scenes.every((s) => s.beats.every((b) => timing.beats[`${s.id}/${b.id}`]?.[2] === spokenText(b.say)));
  let t = 0;
  const scenes = script.scenes.map((s) => {
    const start = exact ? timing!.scenes[s.id]![0] : t;
    t = start + GAP.sceneLead;
    const beats = s.beats.map((b, i): TBeat => {
      let bs: number;
      let be: number;
      if (exact) [bs, be] = timing!.beats[`${s.id}/${b.id}`]!;
      else {
        bs = t;
        be = t + spokenText(b.say).length / 14.5;
        t = be + (i === s.beats.length - 1 ? GAP.sceneTail : GAP.beat) + (b.pause ?? 0);
      }
      const shown = shownText(b.say);
      const chunks = captionChunks(shown);
      let acc = 0;
      const caps = chunks.map((text) => {
        const at = bs + (be - bs) * (acc / shown.length);
        acc += text.length + 1;
        return { at, text };
      });
      const pauses = exact ? (timing!.beats[`${s.id}/${b.id}`]![3] ?? []) : [];
      return { id: b.id, start: bs, end: be, code: b.code, caps, pauses };
    });
    const end = exact ? timing!.scenes[s.id]![1] : t;
    t = end;
    return { id: s.id, title: s.title, start, end, beats };
  });
  return { scenes, duration: exact ? timing!.duration : t, exact };
}

/** The lecture's clock: the narration track when there is one, a wall clock otherwise. */
class Clock {
  private silentBase = 0;
  private silentAt: number | null = null;
  private lastCt = -1;
  private lastAt = 0;
  rate = 1;
  silent: boolean;

  constructor(
    readonly audio: HTMLAudioElement | null,
    private readonly duration: number,
  ) {
    this.silent = !audio;
  }

  get paused(): boolean {
    return this.silent ? this.silentAt === null : this.audio!.paused;
  }

  time(): number {
    if (this.silent) {
      const t = this.silentAt === null ? this.silentBase : this.silentBase + ((performance.now() - this.silentAt) / 1000) * this.rate;
      return Math.min(t, this.duration);
    }
    const a = this.audio!;
    const ct = a.currentTime;
    const now = performance.now();
    if (a.paused || a.readyState < 3 || ct !== this.lastCt) {
      this.lastCt = ct;
      this.lastAt = now;
      return ct;
    }
    // currentTime advances in coarse steps on some engines; extrapolate between them.
    return ct + Math.min(0.25, (now - this.lastAt) / 1000) * a.playbackRate;
  }

  async play(): Promise<void> {
    if (this.silent) {
      if (this.silentAt === null) {
        if (this.silentBase >= this.duration) this.silentBase = 0;
        this.silentAt = performance.now();
      }
      return;
    }
    await this.audio!.play();
  }

  pause(): void {
    if (this.silent) {
      this.silentBase = this.time();
      this.silentAt = null;
    } else this.audio!.pause();
  }

  seek(t: number): void {
    const v = Math.max(0, Math.min(this.duration, t));
    if (this.silent) {
      this.silentBase = v;
      if (this.silentAt !== null) this.silentAt = performance.now();
    } else this.audio!.currentTime = v;
  }

  setRate(r: number): void {
    if (this.silent) {
      this.silentBase = this.time();
      if (this.silentAt !== null) this.silentAt = performance.now();
    } else this.audio!.playbackRate = r;
    this.rate = r;
  }

  /** Drops the track (it failed to load) and carries on from the same moment, captions only. */
  goSilent(): void {
    if (this.silent) return;
    const t = this.audio!.currentTime;
    const playing = !this.audio!.paused;
    this.audio!.pause();
    this.silent = true;
    this.silentBase = t;
    this.silentAt = playing ? performance.now() : null;
  }
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
/** Holding the picture plays at BOOST×; sliding LOCK_PX down while holding keeps it there. */
const BOOST = 2;
const HOLD_MS = 350;
const LOCK_PX = 56;
/** Double tapping the left or right side skips SKIP_S; taps within RUN_MS of a skip keep skipping. */
const SKIP_S = 10;
const DOUBLE_MS = 300;
const RUN_MS = 700;
/** Resuming backs up to where the interrupted phrase began, RESUME_LEAD s early, at most RESUME_MAX s. */
const RESUME_LEAD = 0.1;
const RESUME_MAX = 6;

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
};

/** Builds the full-screen lecture player for `def` into `host`. */
export function mountLecture(host: HTMLElement, def: LectureDef, meta: ChapterMeta): void {
  const { scenes, duration, exact } = layout(def.script, def.timing);
  const log = new LectureLog(def.script.id, duration);
  const prefKey = 'cs231n.lec.prefs';
  const prefs = (() => {
    try {
      return JSON.parse(store.get(prefKey) ?? '{}') as { rate?: number; cc?: boolean; locked?: boolean; holds?: number };
    } catch {
      return {};
    }
  })();

  document.body.classList.add('lec-on');
  onDispose(() => document.body.classList.remove('lec-on'));

  const root = h('div', { class: 'lec', 'data-page': `lec-${def.script.id}`, role: 'region', 'aria-label': `Lecture: ${def.script.title}` });
  host.append(root);
  setMacros(symbolMacros(def.symbols));
  linkSymbols(root, def.symbols);
  const symIdx = codeIndex(def.symbols);

  // ---- layout
  const sceneTitle = h('div', { class: 'lec-scene-title' });
  const sceneCount = h('div', { class: 'lec-count' });
  const top = h('header', { class: 'lec-top' },
    h('a', { class: 'lec-back', href: `#/${meta.id}`, 'aria-label': 'Back to the chapter', html: icon('arrowLeft') }),
    h('div', { class: 'lec-titles' },
      h('div', { class: 'lec-kicker' }, `Chapter ${meta.num} · Lecture`),
      sceneTitle),
    sceneCount);

  const stage = h('div', { class: 'lec-stage' });
  const marksEl = h('div', { class: 'lec-marks', 'aria-hidden': 'true' });
  const chip = h('div', { class: 'lec-chip', 'aria-hidden': 'true' });
  const centerBtn = h('button', { class: 'lec-center', type: 'button', 'aria-label': 'Play', html: icon('playFill') });
  const spinner = h('div', { class: 'lec-spinner', 'aria-hidden': 'true' });
  const boostEl = h('div', { class: 'lec-boost', 'aria-hidden': 'true' },
    h('div', { class: 'lec-boost-pill' },
      h('span', { class: 'lec-boost-ff', html: icon('ffFill') }),
      h('span', { class: 'lec-boost-lk', html: icon('lockFill') }),
      h('span', { class: 'lec-boost-ul', html: icon('unlockFill') }),
      h('b', { class: 'lec-boost-rate' }, `${BOOST}×`),
      h('span', { class: 'lec-boost-hint' }, 'Slide down to lock'),
      h('span', { class: 'lec-boost-go' }, 'Release to lock'),
      h('span', { class: 'lec-boost-off' }, 'Release to unlock'),
      h('div', { class: 'lec-boost-bar' })));
  const skipEls = [-1, 1].map((side) => {
    const label = h('span', {});
    const el = h('div', { class: `lec-skip lec-skip-${side < 0 ? 'back' : 'fwd'}`, 'aria-hidden': 'true' },
      h('div', { class: 'lec-skip-in' }, h('span', { class: 'lec-skip-ico', html: icon(side < 0 ? 'rewindFill' : 'ffFill') }), label));
    return { el, label };
  });
  const cap = h('div', { class: 'lec-cap', 'aria-live': 'off' });
  const codeBox = h('div', { class: 'lec-code' });
  const main = h('div', { class: 'lec-main' }, stage, cap, codeBox);

  const fill = h('div', { class: 'lec-fill' });
  const thumb = h('div', { class: 'lec-thumb' });
  const ticks = h('div', { class: 'lec-ticks' });
  const scrubTip = h('div', { class: 'lec-tip' });
  const scrub = h('div', { class: 'lec-scrub', role: 'slider', tabindex: '0', 'aria-label': 'Seek', 'aria-valuemin': '0', 'aria-valuemax': String(Math.round(duration)) },
    h('div', { class: 'lec-track' }, fill, ticks), thumb, scrubTip);
  const playBtn = h('button', { class: 'lec-btn lec-play', type: 'button', 'aria-label': 'Play', html: icon('playFill') });
  const timeEl = h('div', { class: 'lec-time' });
  const speedBtn = h('button', { class: 'lec-btn lec-speed', type: 'button', 'aria-label': 'Playback speed' });
  const ccBtn = h('button', { class: 'lec-btn', type: 'button', 'aria-label': 'Captions', 'aria-pressed': 'true', html: icon('closed-captioning') });
  const lookupBtn = h('button', { class: 'lec-btn', type: 'button', 'aria-label': 'Look up symbols and functions', html: icon('book') });
  const listBtn = h('button', { class: 'lec-btn', type: 'button', 'aria-label': 'Sections', html: icon('list') });
  const fsBtn = h('button', { class: 'lec-btn lec-fs', type: 'button', 'aria-label': 'Full screen', html: icon('corners-out') });
  const back10 = h('button', { class: 'lec-btn', type: 'button', 'aria-label': 'Back 10 seconds', html: icon('rewind') });
  const bar = h('div', { class: 'lec-bar' }, scrub,
    h('div', { class: 'lec-row' }, playBtn, back10, timeEl, h('div', { class: 'lec-spacer' }), speedBtn, ccBtn, lookupBtn, listBtn, document.fullscreenEnabled ? fsBtn : ''));

  const list = h('div', { class: 'lec-list', role: 'dialog', 'aria-label': 'Sections' });
  const listItems = scenes.map((s, i) => {
    const b = h('button', { type: 'button', class: 'lec-li' }, h('span', { class: 'lec-li-n' }, String(i + 1)), h('span', { class: 'lec-li-t' }, s.title), h('span', { class: 'lec-li-done', 'aria-label': 'heard', html: icon('check') }), h('span', { class: 'lec-li-time' }, mmss(s.start)));
    b.addEventListener('click', () => {
      seek(s.start + 0.01);
      toggleList(false);
    });
    list.append(b);
    return b;
  });

  const notice = h('div', { class: 'lec-notice' });
  root.append(top, main, bar, list, notice);
  stage.append(marksEl, chip, spinner, centerBtn, boostEl, ...skipEls.map((k) => k.el));

  for (const s of scenes) {
    const t = h('div', { class: 'lec-tick' });
    t.style.left = `${(s.start / duration) * 100}%`;
    ticks.append(t);
  }

  // ---- per-scene code panels and marks
  const panels = def.script.scenes.map((s) => new CodePanel(s.code, { title: s.codeTitle, symIdx }));
  const markEls = def.script.scenes.map((s) => {
    const m = new Map<string, HTMLElement>();
    for (const [k, mk] of Object.entries(def.scenes[s.id]?.marks ?? {})) {
      const el = h('div', { class: `lec-mark lec-mark-${mk.align ?? 'center'}`, html: mk.tex ? tex(mk.tex) : (mk.text ?? '') });
      el.style.left = `${mk.x * 100}%`;
      el.style.top = `${mk.y * 100}%`;
      el.style.fontSize = `calc(var(--u) * ${mk.size ?? 6})`;
      m.set(k, el);
    }
    return m;
  });

  const plot = new Plot(stage, { square: false, domain: [0, 1, 0, 1] });
  plot.canvas.classList.add('lec-canvas');
  stage.prepend(plot.canvas);
  // Marks size themselves in stage units, like the canvas drawing does.
  const ro = new ResizeObserver(() => stage.style.setProperty('--u', `${Math.min(stage.clientWidth, stage.clientHeight) / 100}px`));
  ro.observe(stage);
  onDispose(() => ro.disconnect());

  // ---- clock
  let audio: HTMLAudioElement | null = null;
  if (exact) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.src = def.audio;
  }
  const clock = new Clock(audio, duration);
  if (!exact && import.meta.env.DEV) notice.textContent = 'Narration is out of date: run node tools/lecture/build.mjs. Playing silently.';

  let cur = -1;
  let curBeat: TBeat | null = null;
  let curCap = '';
  let scene: Scene | null = null;
  let started = false;
  let ended = false;
  let raf = 0;
  let ccOn = prefs.cc ?? true;
  let lookup: ReturnType<typeof mountLookup> | null = null;

  function sceneIndexAt(t: number): number {
    let i = 0;
    while (i < scenes.length - 1 && t >= scenes[i + 1]!.start) i++;
    return i;
  }

  function enterScene(i: number): void {
    cur = i;
    const s = scenes[i]!;
    const local = new Map<string, [number, number]>(s.beats.map((b) => [b.id, [b.start - s.start, b.end - s.start]]));
    codeBox.replaceChildren(panels[i]!.el);
    marksEl.replaceChildren(...markEls[i]!.values());
    scene = new Scene(plot, panels[i]!, local);
    curBeat = null;
    sceneTitle.textContent = s.title;
    sceneCount.textContent = `${i + 1} / ${scenes.length}`;
    chip.innerHTML = `<span>${i + 1}</span>${s.title}`;
    listItems.forEach((b, k) => b.classList.toggle('on', k === i));
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: `${s.title}`, artist: `Chapter ${meta.num}: ${meta.title}`, album: 'cs231n interactive' });
    }
  }

  function draw(): void {
    if (cur < 0 || !scene) return;
    const s = scenes[cur]!;
    const def0 = def.scenes[s.id];
    const st = scene;
    st.wanted.clear();
    st.fade = clamp01((st.t + 0.05) / 0.5);
    const c = plot.ctx;
    c.save();
    c.globalAlpha = st.fade;
    try {
      def0?.draw(st);
    } catch (e) {
      console.error(e);
    }
    c.restore();
    for (const [k, el] of markEls[cur]!) {
      const w = st.wanted.get(k);
      const a = w ? w.a * st.fade : 0;
      el.style.opacity = a.toFixed(3);
      el.style.visibility = a > 0.003 ? 'visible' : 'hidden';
      if (w?.x !== undefined) el.style.left = `${w.x * 100}%`;
      if (w?.y !== undefined) el.style.top = `${w.y * 100}%`;
    }
  }
  plot.draw = draw;

  function sync(): void {
    const T = clock.time();
    const i = sceneIndexAt(T);
    if (i !== cur) enterScene(i);
    const s = scenes[cur]!;
    scene!.t = T - s.start;
    let b: TBeat | null = null;
    for (const x of s.beats) if (T >= x.start - 0.05) b = x;
    if (b !== curBeat) {
      curBeat = b;
      panels[cur]!.highlight(b?.code ?? null);
    }
    let capText = '';
    if (b) for (const c of b.caps) if (T >= c.at - 0.05) capText = c.text;
    if (T < (s.beats[0]?.start ?? 0) - 0.05 && cur > 0) capText = '';
    if (capText !== curCap) {
      curCap = capText;
      cap.textContent = capText;
    }
    chip.classList.toggle('fresh', T - s.start < 3.2);
    plot.redraw();
    // controls
    const f = duration ? T / duration : 0;
    fill.style.transform = `scaleX(${f})`;
    thumb.style.left = `${f * 100}%`;
    timeEl.textContent = `${mmss(T)} / ${mmss(duration)}`;
    scrub.setAttribute('aria-valuenow', String(Math.round(T)));
    lookup?.tick(T);
    hearTo(T);
  }

  // Heard time: only playback that ran on from the previous tick counts, never a seek's jump.
  let heardFrom: number | null = null;
  let savedAt = 0;
  function hearTo(T: number): void {
    if (heardFrom !== null && T >= heardFrom && T - heardFrom < 4) log.hear(heardFrom, T);
    heardFrom = clock.paused ? null : T;
    if (!clock.paused && performance.now() - savedAt > 3000) savePos();
  }

  function loop(): void {
    sync();
    if (!clock.paused) raf = requestAnimationFrame(loop);
  }

  // ---- play state
  let wakeLock: WakeLockSentinel | null = null;
  async function wake(on: boolean): Promise<void> {
    try {
      if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => (wakeLock = null));
      } else if (!on && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch {
      /* no wake lock: the screen may dim, playback continues */
    }
  }

  function setPlayingUi(playing: boolean): void {
    root.classList.toggle('playing', playing);
    root.classList.toggle('paused', !playing && started);
    const ic = icon(playing ? 'pauseFill' : 'playFill');
    playBtn.innerHTML = ic;
    centerBtn.innerHTML = ic;
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    centerBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }

  /** Where playback stopped by a pause, until a seek moves it; play resumes from just before it. */
  let pausedAt: number | null = null;

  /**
   * Where play picks up after a pause at `t`: the start of the phrase it interrupted, so a word cut
   * in half is heard whole. A pause in a silence resumes in place.
   */
  function resumePoint(t: number): number {
    let b: TBeat | null = null;
    for (const x of scenes[sceneIndexAt(t)]!.beats) if (t >= x.start) b = x;
    if (!b || t >= b.end) return t;
    let from = b.start;
    for (const [a, z] of b.pauses) {
      if (t < a) break;
      if (t < z) return t;
      from = z;
    }
    return Math.max(from - RESUME_LEAD, t - RESUME_MAX);
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
      const p = resumePoint(pausedAt);
      if (p < clock.time() - 0.01) clock.seek(p);
    }
    pausedAt = null;
    try {
      await clock.play();
    } catch (e) {
      // AbortError: a pause landed before playback began.
      if (['NotAllowedError', 'AbortError'].includes((e as DOMException).name)) return;
      clock.goSilent();
      notice.textContent = 'The narration could not play here, so the lecture is running with captions only.';
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
    setBoost('off');
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
      notice.textContent = 'The narration failed to load, so the lecture is running with captions only.';
      if (wasPlaying) {
        void clock.play();
        onPlaying();
      }
    });
    audio.addEventListener('seeked', () => sync());
    // Keeps heard time and the saved place current while the screen is off and frames stop.
    audio.addEventListener('timeupdate', () => hearTo(clock.time()));
  } else {
    // A silent clock has no 'ended' event.
    const check = window.setInterval(() => {
      if (!clock.paused && clock.time() >= duration) {
        clock.pause();
        onEnded();
      }
    }, 250);
    onDispose(() => window.clearInterval(check));
  }

  // ---- controls
  centerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });
  // A tap on either side waits DOUBLE_MS for a second tap before it pauses.
  let pendingTap: { side: number; timer: number } | null = null;
  let run: { side: number; n: number; timer: number } | null = null;

  function skip(side: number): void {
    if (run?.side !== side) {
      if (run) {
        window.clearTimeout(run.timer);
        skipEls[run.side < 0 ? 0 : 1]!.el.classList.remove('on');
      }
      run = { side, n: 0, timer: 0 };
    }
    const r = run;
    r.n++;
    seek(clock.time() + side * SKIP_S);
    const k = skipEls[side < 0 ? 0 : 1]!;
    k.label.textContent = `${r.n * SKIP_S} seconds`;
    k.el.classList.remove('pulse');
    void k.el.offsetWidth;
    k.el.classList.add('on', 'pulse');
    window.clearTimeout(r.timer);
    r.timer = window.setTimeout(() => {
      k.el.classList.remove('on');
      run = null;
    }, RUN_MS);
  }

  stage.addEventListener('click', (e) => {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    if (!started || ended) return;
    const r = stage.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const side = fx < 0.35 ? -1 : fx > 0.65 ? 1 : 0;
    if (side && run) return skip(side);
    if (pendingTap) {
      window.clearTimeout(pendingTap.timer);
      const same = pendingTap.side === side;
      pendingTap = null;
      if (same) return skip(side);
      toggle();
    }
    if (!side) return toggle();
    pendingTap = {
      side,
      timer: window.setTimeout(() => {
        pendingTap = null;
        // A tap followed by a hold is a hold, not a pause.
        if (!press) toggle();
      }, DOUBLE_MS),
    };
  });
  onDispose(() => {
    if (pendingTap) window.clearTimeout(pendingTap.timer);
    if (run) window.clearTimeout(run.timer);
  });
  playBtn.addEventListener('click', toggle);
  back10.addEventListener('click', () => seek(clock.time() - 10));

  // Hold for 2x. `hold` lasts while the finger is down; `locked` outlives it until the next hold.
  let baseRate = 1;
  let boost: 'off' | 'hold' | 'locked' = 'off';
  // The slide-to-lock hint shows for the first few holds, and never again once the viewer has locked.
  const hintDone = () => !!prefs.locked || (prefs.holds ?? 0) >= 3;
  root.classList.toggle('boost-known', hintDone());
  let press: { id: number; x: number; y: number; timer: number; active: boolean; armed: boolean } | null = null;
  // A hold's release still fires a click on most engines; it must not also toggle playback.
  let swallowClick = false;

  // A locked boost shows in the speed button, not over the picture; tapping the button unlocks.
  function setBoost(b: typeof boost): void {
    boost = b;
    clock.setRate(b === 'off' ? baseRate : BOOST);
    root.classList.toggle('boost', b !== 'off');
    root.classList.toggle('boost-locked', b === 'locked');
    speedBtn.innerHTML = b === 'locked' ? `${icon('lockFill')}<span>${BOOST}×</span>` : `${baseRate}×`;
    speedBtn.setAttribute('aria-label', b === 'locked' ? `Locked at ${BOOST}×, tap to unlock` : 'Playback speed');
  }

  function endPress(): void {
    if (!press) return;
    window.clearTimeout(press.timer);
    press = null;
    boostEl.style.setProperty('--k', '0');
    root.classList.remove('boost-armed', 'boost-unlock');
  }

  stage.addEventListener('pointerdown', (e) => {
    swallowClick = false;
    if (!e.isPrimary || e.button !== 0 || !started || ended || clock.paused || press) return;
    const id = e.pointerId;
    press = { id, x: e.clientX, y: e.clientY, active: false, armed: false, timer: 0 };
    press.timer = window.setTimeout(() => {
      if (!press || clock.paused) return;
      press.active = true;
      swallowClick = true;
      try {
        stage.setPointerCapture(id);
      } catch {
        /* pointer already gone */
      }
      if (boost === 'locked') root.classList.add('boost-unlock');
      else setBoost('hold');
    }, HOLD_MS);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    const dy = e.clientY - press.y;
    if (!press.active) {
      if (Math.hypot(e.clientX - press.x, dy) > 12) endPress();
      return;
    }
    if (boost !== 'hold') return;
    const k = clamp01(dy / LOCK_PX);
    boostEl.style.setProperty('--k', k.toFixed(3));
    if ((k >= 1) !== press.armed) {
      press.armed = k >= 1;
      root.classList.toggle('boost-armed', press.armed);
      if (press.armed) navigator.vibrate?.(12);
    }
  });
  const release = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    const { active, armed } = press;
    endPress();
    if (!active) return;
    const held = boost === 'hold';
    const lock = held && armed && e.type === 'pointerup';
    setBoost(lock ? 'locked' : 'off');
    if (held && !hintDone()) {
      if (lock) prefs.locked = true;
      else prefs.holds = (prefs.holds ?? 0) + 1;
      store.set(prefKey, JSON.stringify(prefs));
      root.classList.toggle('boost-known', hintDone());
    }
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('contextmenu', (e) => press && e.preventDefault());
  onDispose(endPress);

  const setRate = (r: number) => {
    baseRate = r;
    setBoost('off');
    prefs.rate = r;
    store.set(prefKey, JSON.stringify(prefs));
  };
  setRate(SPEEDS.includes(prefs.rate ?? 1) ? (prefs.rate ?? 1) : 1);
  speedBtn.addEventListener('click', () => {
    if (boost === 'locked') setBoost('off');
    else setRate(SPEEDS[(SPEEDS.indexOf(baseRate) + 1) % SPEEDS.length]!);
  });

  const setCc = (on: boolean) => {
    ccOn = on;
    root.classList.toggle('no-cc', !on);
    ccBtn.setAttribute('aria-pressed', String(on));
    prefs.cc = on;
    store.set(prefKey, JSON.stringify(prefs));
  };
  setCc(ccOn);
  ccBtn.addEventListener('click', () => setCc(!ccOn));

  lookup = mountLookup({
    root,
    codeBox,
    bar,
    panels,
    marks: markEls.map((m) => [...m.values()]),
    scenes,
    symbols: def.symbols,
    glossary: def.glossary ?? {},
    scene: () => Math.max(0, cur),
    time: () => clock.time(),
    playing: () => !clock.paused,
    play: () => void play(),
    pause,
    seek,
  });
  lookupBtn.addEventListener('click', () => lookup!.showScene());

  const toggleList = (on?: boolean) => {
    if (root.classList.toggle('list-open', on)) listItems.forEach((b, i) => b.classList.toggle('done', log.heardIn(scenes[i]!.start, scenes[i]!.end) >= DONE));
  };
  listBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleList();
  });
  const closeList = (e: Event) => {
    if (!list.contains(e.target as Node)) toggleList(false);
  };
  document.addEventListener('click', closeList);
  onDispose(() => document.removeEventListener('click', closeList));

  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.requestFullscreen?.().catch(() => {});
  });
  const onFs = () => (fsBtn.innerHTML = icon(document.fullscreenElement ? 'corners-in' : 'corners-out'));
  document.addEventListener('fullscreenchange', onFs);
  onDispose(() => document.removeEventListener('fullscreenchange', onFs));

  // Scrubbing: drag anywhere on the bar; the tooltip names the section under the pointer.
  const tAt = (e: PointerEvent) => {
    const r = scrub.getBoundingClientRect();
    return clamp01((e.clientX - r.left) / r.width) * duration;
  };
  let dragging = false;
  scrub.addEventListener('pointerdown', (e) => {
    dragging = true;
    scrub.setPointerCapture(e.pointerId);
    root.classList.add('scrubbing');
    seek(tAt(e));
  });
  scrub.addEventListener('pointermove', (e) => {
    const t = tAt(e);
    const s = scenes[sceneIndexAt(t)]!;
    scrubTip.textContent = `${mmss(t)} · ${s.title}`;
    scrubTip.style.left = `${(t / duration) * 100}%`;
    if (dragging) seek(t);
  });
  const endDrag = () => {
    dragging = false;
    root.classList.remove('scrubbing');
  };
  scrub.addEventListener('pointerup', endDrag);
  scrub.addEventListener('pointercancel', endDrag);
  scrub.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      seek(clock.time() + (e.key === 'ArrowRight' ? 5 : -5));
    }
  });

  const jumpScene = (d: number) => {
    const T = clock.time();
    const i = sceneIndexAt(T);
    // "Previous" first rewinds to the start of the current section, like a music player.
    const target = d < 0 && T - scenes[i]!.start > 3 ? i : Math.max(0, Math.min(scenes.length - 1, i + d));
    seek(scenes[target]!.start + 0.01);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ' || k === 'k') {
      e.preventDefault();
      toggle();
    } else if (k === 'ArrowRight' || k === 'l') seek(clock.time() + (k === 'l' ? 10 : 5));
    else if (k === 'ArrowLeft' || k === 'j') seek(clock.time() - (k === 'j' ? 10 : 5));
    else if (k === ']' || k === 'n') jumpScene(1);
    else if (k === '[' || k === 'p') jumpScene(-1);
    else if (k === 'c') setCc(!ccOn);
    else if (k === '>' || k === '.') setRate(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(baseRate) + 1)]!);
    else if (k === '<' || k === ',') setRate(SPEEDS[Math.max(0, SPEEDS.indexOf(baseRate) - 1)]!);
    else if (k === 'f' && document.fullscreenEnabled) fsBtn.click();
    else if (k === 'Escape') toggleList(false);
    else return;
  };
  window.addEventListener('keydown', onKey);
  onDispose(() => window.removeEventListener('keydown', onKey));

  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    const set = (a: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(a, fn);
      } catch {
        /* action not supported here */
      }
    };
    set('play', () => void play());
    set('pause', () => pause());
    set('seekbackward', (d) => seek(clock.time() - (d.seekOffset ?? 10)));
    set('seekforward', (d) => seek(clock.time() + (d.seekOffset ?? 10)));
    set('seekto', (d) => d.seekTime !== undefined && seek(d.seekTime));
    set('previoustrack', () => jumpScene(-1));
    set('nexttrack', () => jumpScene(1));
    onDispose(() => {
      for (const a of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'] as MediaSessionAction[]) set(a, null);
      ms.metadata = null;
    });
  }

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
    if (document.fullscreenElement) void document.exitFullscreen();
  });

  // ---- poster and end card
  const saved = log.pos;
  const heard = log.heardIn();
  const posterPlay = h('button', { class: 'lec-poster-play', type: 'button', html: `${icon('playFill')}<span>${saved ? 'Start over' : 'Play the lecture'}</span>` });
  const poster = h('div', { class: 'lec-poster' },
    h('div', { class: 'lec-poster-kicker' }, [`Chapter ${meta.num}`, 'Lecture', `${Math.round(duration / 60)} min`, heard >= 0.02 ? `${Math.round(heard * 100)}% heard` : ''].filter(Boolean).join(' · ')),
    h('h1', { class: 'lec-poster-title' }, def.script.title),
    h('div', { class: 'lec-poster-actions' }, posterPlay));
  posterPlay.addEventListener('click', (e) => {
    e.stopPropagation();
    if (saved) clock.seek(0);
    void play();
  });
  if (saved > 0 && saved < duration) {
    const resume = h('button', { class: 'lec-poster-play lec-resume', type: 'button', html: `${icon('playFill')}<span>Resume at ${mmss(saved)}</span>` });
    resume.addEventListener('click', (e) => {
      e.stopPropagation();
      clock.seek(saved);
      pausedAt = saved;
      void play();
    });
    poster.querySelector('.lec-poster-actions')!.prepend(resume);
  }
  const replay = h('button', { class: 'btn', type: 'button', html: `${icon('reset')} Watch again` });
  replay.addEventListener('click', (e) => {
    e.stopPropagation();
    void play();
  });
  const endcard = h('div', { class: 'lec-end' },
    h('div', { class: 'lec-poster-kicker' }, 'That was the lecture'),
    h('h2', { class: 'lec-end-title' }, 'Now explore it yourself'),
    h('div', { class: 'lec-poster-actions' },
      h('a', { class: 'btn btn-primary', href: `#/${meta.id}`, html: `Open the chapter ${icon('arrowRight')}` }),
      replay));
  stage.append(poster, endcard);

  setPlayingUi(false);
  // Behind the poster: a moment of the first scene with something on screen.
  enterScene(0);
  const first = scenes[0]!;
  scene!.t = (first.beats[Math.min(3, first.beats.length - 1)]?.end ?? 0) - first.start;
  plot.redraw();
  timeEl.textContent = `0:00 / ${mmss(duration)}`;
  fill.style.transform = 'scaleX(0)';
  thumb.style.left = '0%';

  (window as unknown as { __lec: unknown }).__lec = {
    seek,
    play,
    pause,
    duration,
    time: () => clock.time(),
    rate: () => clock.rate,
    boost: () => boost,
    lookup: () => scenes.map((s, i) => ({
      scene: s.id,
      terms: lookup!.terms(i, true).map((t) => ({ ...t, note: t.kind === 'sym' ? !!def.symbols[t.key]?.about : !!lookup!.entry(t) })),
    })),
    scenes: scenes.map((s) => ({ id: s.id, start: s.start, end: s.end, beats: s.beats.map((b) => ({ id: b.id, start: b.start, end: b.end })) })),
  };
}
