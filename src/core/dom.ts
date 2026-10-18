type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;

/** Build an element: attrs starting with "on" become listeners, `class`/`style` are set verbatim. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'html') {
      el.innerHTML = String(v);
    } else {
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function cssVar(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/** Disposers registered while a page renders; the router runs them on navigation. */
const disposers: (() => void)[] = [];

export function onDispose(fn: () => void): void {
  disposers.push(fn);
}

export function disposeAll(): void {
  while (disposers.length) {
    try {
      disposers.pop()!();
    } catch (e) {
      console.error(e);
    }
  }
}

/** requestAnimationFrame loop that only runs while `el` is on screen; returns a stop function. */
export function visibleLoop(el: Element, frame: (dt: number, t: number) => void | boolean): { start(): void; stop(): void; running(): boolean } {
  let raf = 0;
  let visible = false;
  let wanted = false;
  let last = 0;
  const tick = (t: number) => {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (frame(dt, t / 1000) === false) {
      wanted = false;
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  const sync = () => {
    if (wanted && visible && !raf) {
      last = 0;
      raf = requestAnimationFrame(tick);
    } else if ((!wanted || !visible) && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    sync();
  });
  io.observe(el);
  onDispose(() => {
    wanted = false;
    sync();
    io.disconnect();
  });
  return {
    start() {
      wanted = true;
      sync();
    },
    stop() {
      wanted = false;
      sync();
    },
    running: () => wanted,
  };
}
