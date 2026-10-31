import { CodePanel } from '../core/code';
import { h, onDispose } from '../core/dom';
import { tex } from '../core/math';
import { Plot } from '../core/plot';
import { codeIndex } from '../core/symbols';
import type { LectureDef } from './player';
import { Scene, clamp01 } from './scene';
import { type TBeat, type TScene, sceneIndexAt } from './timeline';

export interface Theater {
  /** Holds the current scene's marks, over the picture. */
  marks: HTMLElement;
  /** Names the scene as it begins. */
  chip: HTMLElement;
  panels: CodePanel[];
  /** Per scene, its marks by key. */
  markEls: Map<string, HTMLElement>[];
  /** The scene on screen; -1 before the first is entered. */
  current(): number;
  /** Shows the lecture at time `T`. */
  show(T: number): void;
  /** Behind the poster: a moment of the first scene with something on screen. */
  pose(): void;
}

/**
 * The picture on `stage` (its canvas goes first), its marks, the code listing in `codeBox` and the
 * caption in `cap`. `entered` hears each scene change.
 */
export function mountTheater(
  def: LectureDef,
  scenes: TScene[],
  { stage, codeBox, cap }: { stage: HTMLElement; codeBox: HTMLElement; cap: HTMLElement },
  entered: (i: number) => void,
): Theater {
  const marks = h('div', { class: 'lec-marks', 'aria-hidden': 'true' });
  const chip = h('div', { class: 'lec-chip', 'aria-hidden': 'true' });
  const symIdx = codeIndex(def.symbols);
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

  const plot = new Plot(stage);
  plot.canvas.classList.add('lec-canvas');
  stage.prepend(plot.canvas);
  // Marks size themselves in stage units, like the canvas drawing does.
  const ro = new ResizeObserver(() => stage.style.setProperty('--u', `${Math.min(stage.clientWidth, stage.clientHeight) / 100}px`));
  ro.observe(stage);
  onDispose(() => ro.disconnect());

  let cur = -1;
  let curBeat: TBeat | null = null;
  let curCap = '';
  let scene: Scene | null = null;

  function enterScene(i: number): void {
    cur = i;
    const s = scenes[i]!;
    const local = new Map<string, [number, number]>(s.beats.map((b) => [b.id, [b.start - s.start, b.end - s.start]]));
    codeBox.replaceChildren(panels[i]!.el);
    marks.replaceChildren(...markEls[i]!.values());
    scene = new Scene(plot, panels[i]!, local);
    curBeat = null;
    chip.innerHTML = `<span>${i + 1}</span>${s.title}`;
    entered(i);
  }

  plot.draw = () => {
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
  };

  return {
    marks,
    chip,
    panels,
    markEls,
    current: () => cur,
    show(T) {
      const i = sceneIndexAt(scenes, T);
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
    },
    pose() {
      enterScene(0);
      const first = scenes[0]!;
      scene!.t = (first.beats[Math.min(3, first.beats.length - 1)]?.end ?? 0) - first.start;
      plot.redraw();
    },
  };
}
