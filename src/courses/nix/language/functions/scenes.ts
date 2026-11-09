import { after, caption, verdict } from '../../../../lecture/draw';
import type { Ink, Scene, SceneDef } from '../../../../lecture/scene';
import { pathBox, reference } from '../../draw';

const ROW = 8.2;
const TEXT = { size: 3.4, font: 'mono' } as const;
const BIG = { size: 5, font: 'mono', weight: 600 } as const;

interface Row {
  key: string;
  value: string;
  /** Lights the row, 0 to 1. */
  on?: number;
  k?: Ink;
  /** What the value showed before `mix` reached 1. */
  was?: string;
  mix?: number;
}

const height = (rows: number, u: number) => (rows * ROW + 2) * u;

/** A set as rows of name and value, returning the height of each row's center. */
function card(s: Scene, cx: number, top: number, w: number, rows: Row[]): number[] {
  const u = s.u;
  const left = cx - w / 2;
  s.rrect(left, top, w, height(rows.length, u), 1.2, { fill: s.tint('--ink-3', 0.06), stroke: s.tint('--ink-3', 0.5), lw: 0.35 });
  return rows.map((r, i) => {
    const y = top + u + ROW * u * (i + 0.5);
    const on = r.on ?? 0;
    if (on > 0) s.rrect(left + u, y - ROW * u * 0.42, w - 2 * u, ROW * u * 0.84, 0.9, { fill: s.tint(r.k ?? 'gold', 0.28 * on) });
    s.text(r.key, left + 3 * u, y, { ...TEXT, weight: 600, align: 'left', color: s.c('blue') });
    const right = left + w - 3.4 * u;
    const mix = r.was === undefined ? 1 : (r.mix ?? 0);
    s.alpha(mix, () => s.text(r.value, right, y, { ...TEXT, align: 'right', color: s.c('--ink') }));
    if (r.was !== undefined) s.alpha(1 - mix, () => s.text(r.was!, right, y, { ...TEXT, align: 'right', color: s.c('--ink') }));
    return y;
  });
}

/** A function as one large box centered on (cx, y). Returns its width. */
function machine(s: Scene, cx: number, y: number, label: string, on: number): number {
  const u = s.u;
  const w = s.measure(label, BIG) + 10 * u;
  const h = 16 * u;
  s.rrect(cx - w / 2, y - h / 2, w, h, 1.5, { fill: s.tint('blue', 0.08 + 0.2 * on), stroke: s.tint('blue', 0.5 + 0.5 * on), lw: 0.4 });
  s.text(label, cx, y, { ...BIG, color: s.c('--ink') });
  return w;
}

/** The outline of an empty slot, centered on (cx, y). */
function slot(s: Scene, cx: number, y: number, w: number, h: number, k: Ink) {
  const col = s.c(k);
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = y - h / 2;
  const y1 = y + h / 2;
  for (const [a, b, c, d] of [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]] as const) s.line(a, b, c, d, col, 0.4, [1.2, 1]);
}

const hole: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    s.alpha(1 - s.ease('syntax', 0.5), () => {
      const w = Math.min(s.w - 30 * u, 64 * u);
      const top = 10 * u;
      const bottom = top + height(2, u);
      const gap = s.ease('hole', 0.6);
      const ys = card(s, cx, top, w, [
        { key: 'name', value: '"hello"' },
        { key: 'zlib', value: '', was: '"zlib-1.3"', mix: gap, on: 1 - gap },
      ]);
      s.alpha(gap, () => slot(s, cx + w / 2 - 15.4 * u, ys[1]!, 24 * u, 6 * u, 'gold'));
      s.alpha(after(s, 'fixed', 0.5) * (1 - gap), () => {
        const top2 = bottom + 12 * u;
        card(s, cx, top2, w, [
          { key: 'name', value: '"hello"' },
          { key: 'zlib', value: '"zlib-1.2"', on: 1 },
        ]);
        caption(s, 'a whole copy, to change one line', top2 + height(2, u) + 8 * u);
      });
      s.alpha(gap, () => caption(s, 'a hole, to fill in later', bottom + 13 * u, 'gold', 3.8));
    });
    s.alpha(s.ease('syntax', 0.5), () => {
      const y = 38 * u;
      const label = 'x: x + 1';
      const called = s.ease('call', 0.5);
      const w = machine(s, cx, y, label, called);
      const char = s.measure('x', BIG);
      const start = cx - s.measure(label, BIG) / 2;
      const labelY = y + 15 * u;
      const part = (x: number, text: string) => {
        s.line(x, y + 9 * u, x, labelY - 2.6 * u, s.tint('--ink-3', 0.8), 0.35);
        s.text(text, x, labelY, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
      };
      part(start + char * 0.5, 'argument');
      part(start + char * 5.5, 'body');
      const lx = s.w * 0.18;
      const rx = s.w * 0.82;
      s.alpha(called, () => {
        const half = pathBox(s, lx, y, '41', 'gold', 1) / 2;
        s.arrow(lx + half + u, y, cx - w / 2 - u, y, s.c('gold'), 0.5, 2.4);
      });
      s.alpha(s.win('call', 'value', 0.4), () => caption(s, 'x is 41, so the body is 41 + 1', 72 * u, '--ink-2', 3.6));
      s.alpha(s.ease('value', 0.5), () => {
        const half = pathBox(s, rx, y, '42', 'green', 1) / 2;
        s.arrow(cx + w / 2 + u, y, rx - half - u, y, s.c('green'), 0.5, 2.4);
        caption(s, '(x: x + 1) 41  is  42', 72 * u, 'green', 3.6);
      });
    });
  },
};

const curry: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const y = 22 * u;
    const [x0, x1, x2] = [s.w * 0.18, s.w * 0.52, s.w * 0.85] as const;
    s.alpha(1 - s.ease('nest', 0.5), () => {
      const half = pathBox(s, cx, y, 'f', 'blue', 1) / 2;
      s.arrow(cx - 30 * u, y, cx - half - u, y, s.c('--ink-3'), 0.5, 2.4);
      s.arrow(cx + half + u, y, cx + 30 * u, y, s.c('--ink-3'), 0.5, 2.4);
      s.text('one argument', cx - 30 * u, y + 7 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
      s.text('one value', cx + 30 * u, y + 7 * u, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-2') });
    });
    const partial = s.ease('partial', 0.5);
    const space = s.ease('space', 0.5);
    const edge = (x: number, w: number) => x + w / 2;
    /** One step of the chain, from the box ending at `from` to the box starting at `to`. */
    const step = (from: number, to: number, arg: string) => {
      s.arrow(from + u, y, to - u, y, s.c('gold'), 0.5, 2.4);
      s.text(arg, (from + to) / 2, y - 4 * u, { size: 3.8, font: 'mono', weight: 700, color: s.c('gold'), halo: true });
    };
    s.alpha(s.ease('nest', 0.5), () => {
      const w0 = pathBox(s, x0, y, 'a: b: a + b', 'blue', s.win('nest', 'partial', 0.4));
      s.alpha(partial, () => {
        const w1 = pathBox(s, x1, y, 'b: 2 + b', 'gold', 1 - space);
        step(edge(x0, w0), x1 - w1 / 2, '2');
        s.alpha(space, () => {
          const w2 = pathBox(s, x2, y, '5', 'green', 1);
          step(edge(x1, w1), x2 - w2 / 2, '3');
        });
      });
    });
    const ty = y + 14 * u;
    s.alpha(s.win('nest', 'partial', 0.4), () => caption(s, 'a function that returns a function', ty, '--ink-2', 3.6));
    s.alpha(s.win('partial', 'space', 0.4), () => caption(s, 'add 2: still waiting for b', ty, 'gold', 3.6));
    s.alpha(s.win('space', 'map', 0.4), () => caption(s, 'add 2 3  is  (add 2) 3', ty, 'green', 3.6));
    s.alpha(s.ease('map', 0.5), () => {
      const my = 66 * u;
      const c = 9 * u;
      const pitch = 10.5 * u;
      const half = pathBox(s, cx, my, 'add 10', 'blue', 1) / 2;
      [1, 2, 3].forEach((v, i) => {
        const on = s.ease('map', 0.4, 2.4 + 1.2 * i);
        s.cell(cx - 49 * u + i * pitch, my - c / 2, c, c, String(v), 'blue', { size: 3.4, on });
        s.alpha(on, () => s.cell(cx + 40 * u - (2 - i) * pitch, my - c / 2, c, c, String(v + 10), 'green', { size: 3.4, on: 1 }));
      });
      s.arrow(cx - 49 * u + 2 * pitch + c + u, my, cx - half - u, my, s.c('--ink-3'), 0.5, 2.4);
      s.arrow(cx + half + u, my, cx + 40 * u - 2 * pitch - u, my, s.c('--ink-3'), 0.5, 2.4);
      caption(s, 'map (add 10) [ 1 2 3 ]', my - 12 * u, '--ink', 3.8);
      caption(s, 'a list: values in square brackets', my + 13 * u, '--ink-2', 3.4);
    });
  },
};

const pattern: SceneDef = {
  draw(s) {
    const u = s.u;
    const row = 50 * u;
    const chip = 18 * u;
    const bottom = 76 * u;
    const nameX = s.w * 0.22;
    const verX = s.w * 0.52;
    const dotX = s.w * 0.86;
    const extraX = s.w * 0.78;
    const missing = s.win('missing', 'extra', 0.4);
    const usedDefault = s.win('default', 'missing', 0.4);
    pathBox(s, nameX, row, 'name', missing > 0.5 ? 'red' : 'blue', Math.max(s.win('pattern', 'default', 0.4), missing));
    pathBox(s, verX, row, 'version ? "1.0"', usedDefault > 0.5 ? 'gold' : 'blue', Math.max(s.win('pattern', 'default', 0.4), usedDefault));
    s.alpha(s.win('named', 'pattern', 0.4), () => caption(s, 'one argument: a set of inputs, by name', chip, '--ink-2', 3.6));
    s.alpha(s.win('pattern', 'default', 0.4), () => caption(s, 'each name becomes a variable', chip, 'gold', 3.6));
    const body = (text: string, a: number) => s.alpha(a, () => caption(s, text, row + 12 * u, '--ink-3', 3.4));
    body('name + "-" + version', 1 - s.ease('dots', 0.4));
    body('args.license', s.ease('dots', 0.4));
    const given = (x: number, label: string, into: number | null, k: Ink) => {
      pathBox(s, x, chip, label, k, 1);
      if (into !== null) reference(s, x, chip, into, row, k);
    };
    s.alpha(usedDefault, () => {
      given(nameX, 'name = "hello"', nameX, 'blue');
      caption(s, '"hello-1.0"', bottom, 'green', 4.4);
      caption(s, 'version left out: the default fills it', bottom + 9 * u, 'gold', 3.4);
    });
    s.alpha(missing, () => {
      given(verX, 'version = "2.12"', verX, 'blue');
      verdict(s, false, "required argument 'name' is missing", s.w / 2 - 30 * u, bottom, 3.6);
    });
    s.alpha(s.win('extra', 'dots', 0.4), () => {
      given(nameX, 'name = "hello"', nameX, 'blue');
      given(extraX, 'license = "gpl3"', null, 'red');
      verdict(s, false, "unexpected argument 'license'", s.w / 2 - 26 * u, bottom, 3.6);
    });
    s.alpha(s.ease('dots', 0.5), () => {
      pathBox(s, dotX, row, '...', 'gold', 1);
      given(nameX, 'name = "hello"', nameX, 'blue');
      given(extraX, 'license = "gpl3"', dotX, 'gold');
      const y = row - 9 * u;
      s.line(nameX - 8 * u, y, dotX + 7 * u, y, s.tint('gold', 0.8), 0.4);
      s.text('args@', s.w / 2, y - 3.2 * u, { size: 3.4, font: 'mono', weight: 700, color: s.c('gold'), halo: true });
      caption(s, '"gpl3"', bottom, 'green', 4.4);
    });
  },
};

const deps: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const chipY = 13 * u;
    const boxY = 38 * u;
    const cardTop = 58 * u;
    const lx = s.w * 0.3;
    const rx = s.w * 0.7;
    const fed = s.ease('gcc', 0.5);
    const swap = s.ease('clang', 0.6);
    const whole = s.ease('whole', 0.5);
    s.alpha(1 - fed, () => {
      pathBox(s, lx, chipY, 'cc', '--ink-3');
      pathBox(s, rx, chipY, 'zlib', '--ink-3');
    });
    s.alpha(fed * (1 - swap), () => pathBox(s, lx, chipY, 'cc = "gcc"', 'blue', 1));
    s.alpha(swap, () => pathBox(s, lx, chipY, 'cc = "clang"', 'gold', 1));
    s.alpha(fed, () => pathBox(s, rx, chipY, 'zlib = "zlib"', 'blue', 1));
    const w = machine(s, cx, boxY, 'hello', Math.max(fed, whole));
    reference(s, lx, chipY, cx - w / 4, boxY - 4 * u, '--ink-3');
    reference(s, rx, chipY, cx + w / 4, boxY - 4 * u, '--ink-3');
    s.alpha(fed, () => {
      const cw = Math.min(s.w - 30 * u, 66 * u);
      s.arrow(cx, boxY + 8.8 * u, cx, cardTop - u, s.c('--ink-3'), 0.5, 2.4);
      card(s, cx, cardTop, cw, [
        { key: 'name', value: '"hello"' },
        { key: 'deps', value: '[ "clang" "zlib" ]', was: '[ "gcc" "zlib" ]', mix: swap, on: swap, k: 'gold' },
      ]);
    });
    s.alpha(s.win('shape', 'gcc', 0.4), () => caption(s, 'its arguments are what it depends on', cardTop + 6 * u, '--ink-2', 3.6));
    s.alpha(whole, () => caption(s, 'dependencies in, a build out', cardTop + height(2, u) + 9 * u, 'gold', 3.8));
  },
};

export const scenes: Record<string, SceneDef> = { hole, curry, pattern, deps };
