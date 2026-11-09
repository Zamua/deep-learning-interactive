import { after, caption, verdict } from '../../../../lecture/draw';
import type { Ink, Scene, SceneDef } from '../../../../lecture/scene';

const ROW = 8.2;
const TEXT = { size: 3.4, font: 'mono' } as const;

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
    if (r.was !== undefined) s.alpha(1 - mix, () => s.text(r.was!, right, y, { ...TEXT, align: 'right', color: s.c('--ink-3') }));
    return y;
  });
}

/** A line of mono text with its result, for "this expression gives that". */
function result(s: Scene, expr: string, out: string, y: number, k: Ink = 'gold') {
  caption(s, expr, y, k, 4.2);
  caption(s, out, y + 9 * s.u, '--ink', 4.2);
}

const facts: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const w = Math.min(s.w - 30 * u, 72 * u);
    const top = 10 * u;
    const bottom = top + height(3, u);
    const known = s.ease('facts', 0.6);
    const linked = s.win('compute', 'set', 0.4);
    const selected = s.ease('dot', 0.5);
    const ys = card(s, cx, top, w, [
      { key: 'name', value: '"hello"', was: '?', mix: known },
      { key: 'version', value: '"2.12"', was: '?', mix: known, on: Math.max(linked, selected) },
      { key: 'src', value: '"hello-2.12.tar.gz"', was: '?', mix: known, on: linked },
    ]);
    s.alpha(s.ease('set', 0.6), () => {
      const o = { size: 24, font: 'mono', weight: 300, color: s.c('--ink-3') } as const;
      s.text('{', cx - w / 2 - 7 * u, (top + bottom) / 2, o);
      s.text('}', cx + w / 2 + 7 * u, (top + bottom) / 2, o);
    });
    s.alpha(s.ease('semi', 0.5), () => {
      for (const y of ys) s.text(';', cx + w / 2 - 1.9 * u, y, { ...TEXT, weight: 700, color: s.c('gold') });
    });
    s.alpha(linked, () => {
      caption(s, 'one version, written twice', bottom + 10 * u);
      s.alpha(after(s, 'compute', 0.28), () => caption(s, 'other packages will need this one', bottom + 18 * u));
      s.alpha(after(s, 'compute', 0.6), () => caption(s, 'fixed text cannot say that', bottom + 26 * u, 'gold'));
    });
    s.alpha(s.win('set', 'semi'), () => caption(s, 'an attribute set: names bound to values', bottom + 14 * u, '--ink', 3.6));
    s.alpha(s.win('semi', 'dot'), () => {
      caption(s, '{ version = "2.12" }', bottom + 12 * u, '--ink', 4);
      verdict(s, false, 'no last semicolon: syntax error', cx - 26 * u, bottom + 22 * u, 3.4);
    });
    s.alpha(selected, () => result(s, '.version', '"2.12"', bottom + 14 * u));
  },
};

const reach: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const w = Math.min(s.w - 30 * u, 62 * u);
    const top = 6 * u;
    const walkOuter = s.ease('walk', 0.4) * (1 - s.ease('miss', 0.4));
    const walkInner = s.ease('walk', 0.4, 1.4) * (1 - s.ease('miss', 0.4));
    card(s, cx, top, w, [
      { key: 'name', value: '"hello"' },
      { key: 'meta', value: '{ … }', on: walkOuter },
    ]);
    const y0 = top + height(2, u);
    const innerTop = y0 + 11 * u;
    s.arrow(cx, y0 + 0.8 * u, cx, innerTop - 0.8 * u, s.c(walkInner > 0.5 ? 'gold' : '--ink-3'), 0.5, 2.4);
    card(s, cx, innerTop, w * 0.82, [{ key: 'license', value: '"gpl3"', on: walkInner }]);
    const y = innerTop + height(1, u) + 11 * u;
    s.alpha(s.win('nest', 'sugar'), () => caption(s, 'a value can be another set', y, '--ink-2', 3.6));
    s.alpha(s.win('sugar', 'walk'), () => result(s, 'meta.license = "gpl3";', 'meta = { license = "gpl3"; };', y, 'gold'));
    s.alpha(s.win('walk', 'miss'), () => result(s, '.meta.license', '"gpl3"', y));
    s.alpha(s.win('miss', 'or'), () => {
      caption(s, '.version', y, 'gold', 4.2);
      verdict(s, false, "attribute 'version' missing", cx - 25 * u, y + 9 * u, 3.6);
    });
    s.alpha(s.win('or', 'has'), () => result(s, '.version or "1.0"', '"1.0"', y));
    s.alpha(s.ease('has', 0.6), () => result(s, '? version', 'false', y));
  },
};

/** Two sets with `//` between them, and what they merge into. Returns the height just below the result. */
function sides(s: Scene, left: Row[], right: Row[], out: Row[], rightIn: number, outIn: number): number {
  const u = s.u;
  const cx = s.w / 2;
  const w = Math.min((s.w - 18 * u) / 2, 52 * u);
  const lx = cx - w / 2 - 5 * u;
  const rx = cx + w / 2 + 5 * u;
  const top = 8 * u;
  const y1 = top + height(Math.max(left.length, right.length), u);
  const outTop = y1 + 16 * u;
  card(s, lx, top, w, left);
  s.alpha(rightIn, () => {
    card(s, rx, top, w, right);
    s.text('//', cx, (top + y1) / 2, { size: 4.2, font: 'mono', weight: 700, color: s.c('--ink-2') });
  });
  s.alpha(outIn, () => {
    s.arrow(lx, y1 + u, cx - w / 4, outTop - u, s.c('--ink-3'), 0.45, 2.4);
    s.arrow(rx, y1 + u, cx + w / 4, outTop - u, s.c('--ink-3'), 0.45, 2.4);
    card(s, cx, outTop, w, out);
  });
  return outTop + height(out.length, u);
}

const merge: SceneDef = {
  draw(s) {
    const u = s.u;
    const wins = s.ease('wins', 0.5);
    s.alpha(1 - s.ease('top', 0.5), () => {
      const y = sides(
        s,
        [{ key: 'name', value: '"hello"' }, { key: 'version', value: '"2.12"', on: wins, k: 'red' }],
        [{ key: 'version', value: '"2.13"', on: wins }, { key: 'dev', value: 'true' }],
        [{ key: 'dev', value: 'true' }, { key: 'name', value: '"hello"' }, { key: 'version', value: '"2.13"', on: wins }],
        s.ease('update', 0.5),
        after(s, 'update', 0.4),
      );
      s.alpha(wins, () => caption(s, 'on both sides: the right one wins', y + 7 * u, 'gold', 3.6));
    });
    const lost = s.ease('gone', 0.5);
    s.alpha(s.win('top', 'names', 0.5), () => {
      const y = sides(
        s,
        [{ key: 'meta', value: '{ tag lic }', on: 1 - lost }],
        [{ key: 'meta', value: '{ tag }', on: 1 - lost }],
        [{ key: 'meta', value: '{ tag }', on: 1 }],
        1,
        1,
      );
      caption(s, 'meta is one name, replaced whole', y + 8 * u, '--ink-2', 3.6);
      s.alpha(lost, () => caption(s, 'lic is gone', y + 17 * u, 'red', 4));
    });
    s.alpha(s.ease('names', 0.5), () => {
      const cw = Math.min(34 * u, (s.w - 20 * u) / 2);
      const ch = 11 * u;
      const slot = (i: number) => (s.w - 2 * cw - 8 * u) / 2 + i * (cw + 8 * u);
      const sorted = s.ease('names', 0.6, 1);
      caption(s, 'as you wrote them', 15 * u);
      ['version', 'name'].forEach((n, i) => s.cell(slot(i), 21 * u, cw, ch, n, 'blue', { size: 3.8 }));
      s.alpha(sorted, () => {
        ['name', 'version'].forEach((n, i) => {
          const from = slot(1 - i) + cw / 2;
          s.arrow(from, 33.5 * u, slot(i) + cw / 2, 58.5 * u, s.c('--ink-3'), 0.45, 2.4);
          s.cell(slot(i), 60 * u, cw, ch, n, 'gold', { on: 1, size: 3.8 });
        });
        caption(s, 'builtins.attrNames: sorted', 78 * u, 'gold', 3.6);
      });
    });
  },
};

/** A bent arrow from the side of one row to the side of another, `reach` being signed: left of `x` if negative. */
function elbow(s: Scene, x: number, y0: number, y1: number, reach: number, k: Ink) {
  const col = s.c(k);
  s.line(x, y0, x + reach, y0, col, 0.5);
  s.line(x + reach, y0, x + reach, y1, col, 0.5);
  s.arrow(x + reach, y1, x, y1, col, 0.5, 2.2);
}

const share: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const w = Math.min(s.w - 26 * u, 84 * u);
    const top = 15 * u;
    const bottom = top + height(3, u);
    const twice = s.win('repeat', 'plain', 0.4);
    const typed = s.ease('plain', 0.5);
    const inherit = s.ease('inherit', 0.5);
    const done = s.ease('out', 0.6);
    const ys = card(s, cx, top, w, [
      { key: 'version', value: '"2.12"', on: twice },
      { key: 'src', value: '"hello-" + version + ".tar.gz"', was: '"hello-2.12.tar.gz"', mix: typed * (1 - done), on: twice },
      { key: 'meta', value: done > 0.5 ? '{ version = "2.12"; }' : '{ inherit version; }', was: '{ … }', mix: Math.max(inherit, done) },
    ]);
    const y1 = ys[0]!;
    const y2 = ys[1]!;
    const y3 = ys[2]!;
    const left = cx - w / 2;
    const fixed = s.ease('rec', 0.5);
    s.alpha(s.win('plain', 'out', 0.4), () => elbow(s, left - 0.8 * u, y1, y2, -5 * u, fixed > 0.5 ? 'green' : 'red'));
    s.alpha(inherit * (1 - done), () => elbow(s, left + w + 0.8 * u, y1, y3, 5 * u, 'gold'));
    s.alpha(fixed, () => s.text('rec', left, top - 4.2 * u, { size: 4.6, font: 'mono', weight: 700, align: 'left', color: s.c('gold') }));
    const y = bottom + 12 * u;
    s.alpha(twice, () => caption(s, 'change one, remember the other', y, '--ink-2', 3.6));
    s.alpha(s.win('plain', 'rec', 0.4), () => verdict(s, false, "undefined variable 'version'", cx - 25 * u, y, 3.6));
    s.alpha(s.win('rec', 'inherit', 0.4), () => verdict(s, true, 'every binding sees every other', cx - 26 * u, y, 3.6));
    s.alpha(s.win('inherit', 'out', 0.4), () => caption(s, 'inherit version;  means  version = version;', y, 'gold', 3.3));
    s.alpha(done, () => caption(s, 'the version, written in one place', y, 'green', 3.6));
  },
};

export const scenes: Record<string, SceneDef> = { facts, reach, merge, share };
