import { caption, verdict } from '../../../../lecture/draw';
import type { Ink, Scene, SceneDef } from '../../../../lecture/scene';
import { pathBox, reference } from '../../draw';

const ROW = 8.2;
const TEXT = { size: 3.4, font: 'mono' } as const;

interface Row {
  key: string;
  value: string;
  /** Lights the row, 0 to 1. */
  on?: number;
  k?: Ink;
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
    s.text(r.value, left + w - 3.4 * u, y, { ...TEXT, align: 'right', color: s.c('--ink') });
    return y;
  });
}

/** A bent arrow from the side of one row to the side of another, `reach` being signed: left of `x` if negative. */
function elbow(s: Scene, x: number, y0: number, y1: number, reach: number, k: Ink) {
  const col = s.c(k);
  s.line(x, y0, x + reach, y0, col, 0.5);
  s.line(x + reach, y0, x + reach, y1, col, 0.5);
  s.arrow(x + reach, y1, x, y1, col, 0.5, 2.2);
}

/** The package collection as a field of small cells. `lit(row, col)` lights one, in `k`. */
function grid(s: Scene, lit: (row: number, col: number) => number, k: Ink) {
  const u = s.u;
  const pitch = 8.4 * u;
  const size = 7 * u;
  const cols = Math.floor((s.w - 10 * u) / pitch);
  const x0 = (s.w - cols * pitch + pitch - size) / 2;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < cols; c++) {
      const on = lit(r, c);
      s.rrect(x0 + c * pitch, 10 * u + r * pitch, size, size, 0.8, { fill: s.tint(on > 0.01 ? k : '--ink-3', 0.12 + 0.45 * on), stroke: s.tint(on > 0.01 ? k : '--ink-3', 0.3 + 0.7 * on), lw: 0.25 });
    }
  }
}

const GRID_CAPTION = 84;

const big: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const asked = s.ease('ask', 0.5);
    s.alpha(1 - s.ease('let', 0.5), () => {
      grid(s, (r, c) => (r === 3 && c === 5 ? asked : 0), 'gold');
      caption(s, 'one expression, a whole collection', GRID_CAPTION * u, '--ink-2', 3.6);
      s.alpha(asked, () => caption(s, 'ask for one', (GRID_CAPTION + 8) * u, 'gold', 3.6));
    });
    s.alpha(s.ease('let', 0.5), () => {
      const y = 28 * u;
      const body = 60 * u;
      const lx = s.w * 0.28;
      const rx = s.w * 0.72;
      const order = s.ease('order', 0.5);
      const value = s.ease('value', 0.5);
      const wb = pathBox(s, lx, y, 'b = a + 1', 'blue', order);
      const wa = pathBox(s, rx, y, 'a = 1', 'blue', order);
      reference(s, lx, y, cx - 5 * u, body, '--ink-3');
      reference(s, rx, y, cx + 5 * u, body, '--ink-3');
      pathBox(s, cx, body, 'a + b', 'gold', value);
      s.alpha(order, () => {
        s.arrow(lx + wb / 2 + u, y, rx - wa / 2 - u, y, s.c('gold'), 0.6, 2.6);
        s.text('uses', cx, y - 4 * u, { size: 3.2, font: 'mono', color: s.c('gold'), halo: true });
      });
      s.alpha(s.win('let', 'order', 0.4), () => caption(s, 'names for the expression after in', 13 * u, '--ink-2', 3.6));
      s.alpha(s.win('order', 'value', 0.4), () => caption(s, 'b uses a, written after it', 13 * u, 'gold', 3.6));
      s.alpha(value, () => {
        caption(s, 'definitions, not steps', 13 * u, '--ink-2', 3.6);
        caption(s, '3', 80 * u, 'green', 6);
      });
    });
  },
};

/** A value that has not been worked out, centered on (x, y); `open` shows it going off. */
function sealed(s: Scene, x: number, y: number, w: number, h: number, label: string, open = 0) {
  s.rrect(x - w / 2, y - h / 2, w, h, 1.2, { fill: s.tint('red', 0.1 + 0.3 * open), stroke: s.tint('red', 0.5 + 0.5 * open), lw: 0.35 + 0.2 * open });
  s.text(label, x, y, { ...TEXT, weight: 600, color: s.c(open > 0.5 ? 'red' : '--ink') });
}

const lazy: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    s.alpha(s.win('throw', 'set', 0.4), () => {
      const y = 26 * u;
      s.text('x =', cx - 28 * u, y, { size: 4.2, font: 'mono', weight: 600, align: 'right', color: s.c('blue') });
      sealed(s, cx + 2 * u, y, 42 * u, 13 * u, 'throw "boom"');
      s.alpha(s.win('throw', 'let', 0.4), () => caption(s, 'stops evaluation, when it runs', 48 * u, '--ink-2', 3.6));
      s.alpha(s.ease('let', 0.5), () => {
        s.text('never run', cx + 2 * u, y + 10.5 * u, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
        caption(s, 'in 1', 52 * u, '--ink', 4.2);
        caption(s, '1', 62 * u, 'green', 5.6);
      });
      s.alpha(s.ease('thunk', 0.5), () => caption(s, 'a thunk: how to compute it, if anyone asks', 78 * u, 'gold', 3.5));
    });
    const lastCard = s.win('set', 'len', 0.4);
    s.alpha(lastCard, () => {
      const w = Math.min(s.w - 30 * u, 62 * u);
      const top = 10 * u;
      const selected = s.win('set', 'bang', 0.4);
      const bang = s.win('bang', 'names', 0.4);
      const names = s.ease('names', 0.5);
      card(s, cx, top, w, [
        { key: 'a', value: '1', on: selected, k: 'green' },
        { key: 'b', value: bang > 0.5 ? 'error: boom' : 'throw "boom"', on: Math.max(0.32, bang), k: 'red' },
      ]);
      s.alpha(names, () => s.rrect(cx - w / 2 + 1.4 * u, top + 1.3 * u, 7 * u, 2 * ROW * u - 0.6 * u, 1, { stroke: s.c('gold'), lw: 0.45 }));
      const y = top + height(2, u) + 14 * u;
      s.alpha(selected, () => {
        caption(s, '.a', y, 'gold', 4.2);
        caption(s, '1', y + 10 * u, 'green', 5);
      });
      s.alpha(bang, () => {
        caption(s, '.b', y, 'gold', 4.2);
        verdict(s, false, 'error: boom', cx - 12 * u, y + 10 * u, 4);
      });
      s.alpha(names, () => {
        caption(s, 'builtins.attrNames', y, 'gold', 4);
        caption(s, '[ "a" "b" ]', y + 10 * u, 'green', 4.4);
      });
    });
    s.alpha(s.ease('len', 0.5), () => {
      const cw = 18 * u;
      const ch = 14 * u;
      const gap = 3 * u;
      const y = 28 * u;
      const x0 = cx - (3 * cw + 2 * gap) / 2;
      s.cell(x0, y - ch / 2, cw, ch, '1', 'blue', { size: 4 });
      sealed(s, x0 + cw + gap + cw / 2, y, cw, ch, 'throw');
      s.cell(x0 + 2 * (cw + gap), y - ch / 2, cw, ch, '3', 'blue', { size: 4 });
      caption(s, 'builtins.length', 54 * u, 'gold', 4);
      caption(s, '3', 65 * u, 'green', 5.6);
    });
  },
};

const self: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const w = Math.min(s.w - 34 * u, 58 * u);
    const top = 15 * u;
    const y = top + height(2, u) + 14 * u;
    const name = (t: string) => s.text(t, cx - w / 2, top - 4 * u, { size: 4.2, font: 'mono', weight: 700, align: 'left', color: s.c('blue') });
    s.alpha(1 - s.ease('rec', 0.4), () => {
      const works = s.ease('ok', 0.5);
      name('x =');
      const ys = card(s, cx, top, w, [
        { key: 'y', value: '1', on: works, k: 'green' },
        { key: 'z', value: 'x.y + 1', on: works, k: 'gold' },
      ]);
      s.alpha(works, () => elbow(s, cx - w / 2 - 0.8 * u, ys[1]!, ys[0]!, -5 * u, 'gold'));
      s.alpha(1 - works, () => caption(s, 'a binding can mention its own set', y, '--ink-2', 3.6));
      s.alpha(works, () => {
        caption(s, 'x.z', y, 'gold', 4.2);
        caption(s, '2', y + 10 * u, 'green', 5);
      });
    });
    s.alpha(s.win('rec', 'bad', 0.4), () => {
      name('rec');
      const ys = card(s, cx, top, w, [
        { key: 'a', value: 'b + 1', on: 1, k: 'gold' },
        { key: 'b', value: '2', on: 1, k: 'green' },
      ]);
      elbow(s, cx - w / 2 - 0.8 * u, ys[0]!, ys[1]!, -5 * u, 'gold');
      caption(s, '.a', y, 'gold', 4.2);
      caption(s, '3', y + 10 * u, 'green', 5);
    });
    s.alpha(s.ease('bad', 0.4), () => {
      const boxY = 36 * u;
      const label = 'x = x + 1';
      const o = { size: 5, font: 'mono', weight: 600 } as const;
      const bw = s.measure(label, o) + 10 * u;
      const failed = s.ease('err', 0.5);
      const k: Ink = failed > 0.5 ? 'red' : 'gold';
      s.rrect(cx - bw / 2, boxY - 8 * u, bw, 16 * u, 1.5, { fill: s.tint(k, 0.14), stroke: s.tint(k, 0.8), lw: 0.4 });
      s.text(label, cx, boxY, { ...o, color: s.c('--ink') });
      const right = cx + bw / 2 + 0.8 * u;
      const col = s.c(k);
      const over = boxY - 18 * u;
      s.line(right, boxY, right + 9 * u, boxY, col, 0.6);
      s.line(right + 9 * u, boxY, right + 9 * u, over, col, 0.6);
      s.line(right + 9 * u, over, cx + 4 * u, over, col, 0.6);
      s.arrow(cx + 4 * u, over, cx + 4 * u, boxY - 8.8 * u, col, 0.6, 2.6);
      caption(s, 'to get x, Nix has to get x', 58 * u, '--ink-2', 3.8);
      s.alpha(failed, () => verdict(s, false, 'infinite recursion encountered', cx - 28 * u, 70 * u, 3.8));
    });
  },
};

/** The cells a request reaches when the collection is scaled up. */
const REACHED = [[3, 5], [1, 2], [4, 8], [6, 3]] as const;

const pkgs: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    s.alpha(1 - s.ease('scale', 0.5), () => {
      const w = Math.min(s.w - 26 * u, 80 * u);
      const top = 10 * u;
      const asked = s.ease('ask', 0.5);
      const needed = s.ease('ask', 0.5, 2);
      const broken = s.ease('broken', 0.5);
      const ys = card(s, cx, top, w, [
        { key: 'curl', value: '{ deps = [ zlib ]; }', on: asked, k: 'green' },
        { key: 'zlib', value: '{ deps = [ ]; }', on: needed, k: 'green' },
        { key: 'broken', value: 'throw "does not build"', on: 0.3 + 0.5 * broken, k: 'red' },
      ]);
      s.alpha(needed, () => elbow(s, cx - w / 2 - 0.8 * u, ys[0]!, ys[1]!, -5 * u, 'green'));
      const y = top + height(3, u) + 13 * u;
      s.alpha(s.win('mini', 'ask', 0.4), () => caption(s, 'one set: each package can name the others', y, '--ink-2', 3.5));
      s.alpha(s.win('ask', 'broken', 0.4), () => caption(s, 'worked out: curl, then zlib', y, 'green', 3.8));
      s.alpha(broken, () => verdict(s, true, 'broken: nobody asked for it', cx - 25 * u, y, 3.8));
    });
    s.alpha(s.ease('scale', 0.5), () => {
      const reached = (r: number, c: number) => {
        const i = REACHED.findIndex(([a, b]) => a === r && b === c);
        return i < 0 ? 0 : s.ease('scale', 0.5, 1 + 0.9 * i);
      };
      grid(s, reached, 'gold');
      caption(s, 'only what you ask for, and what it needs', GRID_CAPTION * u, 'gold', 3.6);
    });
  },
};

export const scenes: Record<string, SceneDef> = { big, lazy, self, pkgs };
