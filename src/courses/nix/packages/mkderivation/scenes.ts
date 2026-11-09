import { caption } from '../../../../lecture/draw';
import type { Ink, Scene, SceneDef } from '../../../../lecture/scene';
import { pathBox, reference } from '../../draw';

/** What a bare builder has to be handed, as a grid of store paths. */
const TOOLS = ['gcc', 'gnumake', 'binutils', 'coreutils', 'gnutar', 'gzip', 'gnused', 'gnugrep', 'gawk'];
const STEPS = ['tar xf $src', 'cd hello-2.12', './configure --prefix=$out', 'make', 'make install'];

const bare: SceneDef = {
  draw(s) {
    s.alpha(s.ease('ask', 0.5), () => pathBox(s, s.w / 2, s.h * 0.08, 'hello-2.12', 'blue', 1));
    TOOLS.forEach((t, i) => {
      const x = s.w * [0.2, 0.5, 0.8][i % 3]!;
      const y = s.h * (0.21 + 0.115 * Math.floor(i / 3));
      s.alpha(s.ease('tools', 0.4, i * 0.3), () => pathBox(s, x, y, t, 'gold', 1));
    });
    STEPS.forEach((t, i) => {
      s.alpha(s.ease('steps', 0.4, i * 0.5), () => caption(s, t, s.h * (0.56 + 0.07 * i), '--ink', 3.4));
    });
    s.alpha(s.ease('again', 0.6), () => caption(s, 'every package repeats all of this', s.h * 0.93, 'red', 3.6));
  },
};

const wrap: SceneDef = {
  draw(s) {
    const u = s.u;
    const w = Math.min(s.w * 0.9, 100 * u);
    const x = (s.w - w) / 2;
    const top = s.h * 0.08;
    const h = s.h * 0.42;
    const small = { size: 3.2, font: 'mono', color: s.c('--ink-2') } as const;
    s.alpha(s.ease('stdenv', 0.5), () => {
      s.rrect(x, top, w, h, 1.5, { fill: s.tint('blue', 0.07), stroke: s.tint('blue', 0.6), lw: 0.4 });
      s.text('gcc  make  coreutils  sed  grep  awk', s.w / 2, top + 11 * u, small);
      s.text('+ a script that knows the steps', s.w / 2, top + 18 * u, small);
    });
    const label = (t: string, a: number) => s.alpha(a, () => s.text(t, x + 3 * u, top + 4.5 * u, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('blue') }));
    label('stdenv', s.ease('stdenv', 0.5) * (1 - s.ease('call', 0.4)));
    label('stdenv.mkDerivation', s.ease('call', 0.5));
    // What comes back is still a derivation: drawn inside the frame.
    s.alpha(s.ease('call', 0.5, 0.6), () => {
      const ih = 11 * u;
      const iw = Math.min(w - 16 * u, 70 * u);
      const iy = top + h - ih - 3 * u;
      s.rrect(s.w / 2 - iw / 2, iy, iw, ih, 1.2, { fill: s.tint('gold', 0.15), stroke: s.tint('gold', 0.8), lw: 0.35 });
      s.text('derivation', s.w / 2, iy + ih / 2, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink') });
    });
    const nameY = s.h * 0.62;
    s.alpha(s.win('name', 'src', 0.4), () => pathBox(s, s.w / 2, nameY, 'hello-2.12', 'gold', 1));
    s.alpha(s.ease('src', 0.5, 0.3) * (1 - s.ease('native', 0.4)), () => {
      pathBox(s, s.w / 2, nameY, 'hello-2.12.tar.gz', 'gold', 1);
      caption(s, 'fetched, and the hash checked', nameY + 9 * u, '--ink-2', 3.2);
    });
    const inY = s.h * 0.66;
    const col = [s.w * 0.27, s.w * 0.73];
    s.alpha(s.ease('native', 0.5, 0.5), () => {
      pathBox(s, col[0]!, inY, 'pkg-config', 'green', 1);
      s.text('runs during the build', col[0]!, inY + 9 * u, small);
      s.text('goes on PATH', col[0]!, inY + 15 * u, small);
    });
    s.alpha(s.ease('link', 0.5), () => {
      pathBox(s, col[1]!, inY, 'zlib', 'purple', 1);
      s.text('linked into the result', col[1]!, inY + 9 * u, small);
      s.text('the compiler finds it', col[1]!, inY + 15 * u, small);
    });
  },
};

/** Each phase with the default work it does. */
const PHASES: [string, string][] = [
  ['unpack', 'tar xf $src, then cd in'],
  ['patch', 'apply each patch'],
  ['configure', './configure --prefix=$out'],
  ['build', 'make'],
  ['check', 'make check, if asked'],
  ['install', 'make install'],
  ['fixup', 'strip, fix interpreters'],
];

const phases: SceneDef = {
  draw(s) {
    const rowY = (i: number) => s.h * (0.075 + 0.122 * i);
    const chipX = s.w * 0.24;
    const textX = s.w * 0.44;
    const swept = s.prog('order') * PHASES.length;
    const row = (t: string, y: number, col: string) => s.text(t, textX, y, { size: 3.2, font: 'mono', align: 'left', color: col });
    PHASES.forEach(([name, does], i) => {
      const seen = Math.min(1, Math.max(0, swept - i));
      const yours = i === 5 ? s.ease('over', 0.6) : 0;
      const hot = ([2, 3, 5].includes(i) ? s.win('dance', 'fixup') : 0) + (i === 6 ? s.win('fixup', 'over') : 0);
      const k: Ink = yours > 0.5 ? 'orange' : hot > 0.5 ? 'gold' : 'blue';
      const y = rowY(i);
      s.alpha(s.ease('order', 0.4), () => pathBox(s, chipX, y, name, k, Math.max(seen, hot)));
      s.alpha(seen * (1 - yours), () => row(does, y, s.c(hot > 0.5 ? '--ink' : '--ink-2')));
      s.alpha(yours, () => row('your mkdir and cp', y, s.c('orange')));
    });
    s.alpha(s.win('out', 'fixup'), () => caption(s, 'make install writes under $out', s.h * 0.93, 'gold', 3.4));
    s.alpha(s.ease('mk', 0.5), () => caption(s, '$out = /nix/store/…-hello-2.12', s.h * 0.93, 'orange', 3.4));
  },
};

/** The piece of nixpkgs on stage, as fractions of the stage. */
const AT = {
  hello: [0.28, 0.25],
  blender: [0.72, 0.25],
  stdenv: [0.2, 0.52],
  fetchurl: [0.52, 0.52],
  ffmpeg: [0.82, 0.52],
  gcc: [0.2, 0.78],
} as const;
type Name = keyof typeof AT;
/** What asking for hello forces. */
const FORCED: Name[] = ['hello', 'stdenv', 'fetchurl', 'gcc'];

const xy = (s: Scene, n: Name): [number, number] => [AT[n][0] * s.w, AT[n][1] * s.h];

function arrow(s: Scene, a: Name, b: Name, k: Ink, a0: number) {
  const [x0, y0] = xy(s, a);
  const [x1, y1] = xy(s, b);
  s.alpha(a0, () => reference(s, x0, y0, x1, y1, k));
}

const callpackage: SceneDef = {
  draw(s) {
    const u = s.u;
    const lazy = s.ease('lazy', 0.6);
    const called = s.ease('call', 0.6);
    const named = s.ease('fn', 0.5);
    const frame = s.ease('set', 0.6);
    s.alpha(frame, () => {
      s.rrect(s.w * 0.05, s.h * 0.13, s.w * 0.9, s.h * 0.74, 1.5, { stroke: s.tint('--ink-3', 0.55), lw: 0.35 });
      s.text('nixpkgs', s.w * 0.05 + 3 * u, s.h * 0.17, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
    });
    const argK: Ink = called > 0.5 ? 'blue' : '--ink-3';
    arrow(s, 'hello', 'stdenv', argK, named);
    arrow(s, 'hello', 'fetchurl', argK, named);
    const knot = s.ease('knot', 0.5);
    arrow(s, 'stdenv', 'gcc', lazy > 0.5 ? 'blue' : '--ink-3', knot);
    arrow(s, 'blender', 'fetchurl', '--ink-3', knot * (1 - 0.5 * lazy));
    arrow(s, 'blender', 'ffmpeg', '--ink-3', knot * (1 - 0.5 * lazy));
    for (const n of Object.keys(AT) as Name[]) {
      const inArgs = n === 'hello' || n === 'stdenv' || n === 'fetchurl';
      const forced = FORCED.includes(n);
      const base = inArgs ? named : frame;
      const k: Ink = forced && (lazy > 0.5 || n === 'hello' || (inArgs && called > 0.5)) ? 'blue' : '--ink-3';
      const on = n === 'hello' ? 1 : inArgs ? Math.max(called, lazy) : forced ? lazy : 0;
      const [x, y] = xy(s, n);
      s.alpha(base * (forced ? 1 : 1 - 0.55 * lazy), () => pathBox(s, x, y, n, k, on));
    }
    s.alpha(named * (1 - frame), () => s.text('{ stdenv, fetchurl }:', xy(s, 'hello')[0], s.h * 0.1, { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true }));
    s.alpha(s.win('over', 'knot', 0.4), () => caption(s, '{ } holds your own choices', s.h * 0.94, 'gold', 3.4));
    s.alpha(s.ease('knot', 0.5, 0.4) * (1 - s.ease('lazy', 0.4)), () => caption(s, 'the set refers to itself', s.h * 0.94, 'gold', 3.4));
    s.alpha(s.ease('lazy', 0.5, 0.4), () => caption(s, 'asked for hello: the rest waits', s.h * 0.94, 'blue', 3.4));
  },
};

export const scenes: Record<string, SceneDef> = { bare, wrap, phases, callpackage };
