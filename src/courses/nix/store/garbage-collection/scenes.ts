import { verdict } from '../../../../lecture/draw';
import type { Ink, Scene, SceneDef } from '../../../../lecture/scene';
import { pathBox, reference } from '../../draw';

/** Where each path of the example sits, as fractions of the stage. */
const AT = {
  curl: [0.2, 0.3],
  git: [0.5, 0.3],
  oldCurl: [0.8, 0.3],
  openssl: [0.2, 0.55],
  zlib: [0.5, 0.55],
  oldSsl: [0.8, 0.55],
  glibc: [0.5, 0.82],
} as const;
type Name = keyof typeof AT;
const NAMES = Object.keys(AT) as Name[];
const LABELS: Record<Name, string> = { curl: 'curl-8.11', git: 'git-2.47', oldCurl: 'curl-8.10', openssl: 'openssl-3.4', zlib: 'zlib-1.3', oldSsl: 'openssl-3.3', glibc: 'glibc-2.40' };
/** Each path's references. */
const REFS: [Name, Name][] = [['curl', 'openssl'], ['curl', 'zlib'], ['git', 'openssl'], ['git', 'zlib'], ['oldCurl', 'oldSsl'], ['oldCurl', 'zlib'], ['openssl', 'glibc'], ['zlib', 'glibc'], ['oldSsl', 'glibc']];
/** The order a walk from the two roots first reaches each path. */
const WALK: Name[] = ['curl', 'git', 'openssl', 'zlib', 'glibc'];
const GARBAGE: Name[] = ['oldCurl', 'oldSsl'];

const xy = (s: Scene, n: Name): [number, number] => [AT[n][0] * s.w, AT[n][1] * s.h];

function arrow(s: Scene, a: Name, b: Name, k: Ink = '--ink-3', width = 0.45) {
  const [x0, y0] = xy(s, a);
  const [x1, y1] = xy(s, b);
  reference(s, x0, y0, x1, y1, k, width);
}

function box(s: Scene, n: Name, k: Ink, on = 0) {
  const [x, y] = xy(s, n);
  pathBox(s, x, y, LABELS[n], k, on);
}

/** A root's tag above a path in the top row, with an arrow down to it. */
function rootTag(s: Scene, n: Name, label: string, k: Ink = 'gold') {
  const u = s.u;
  const [x, y] = xy(s, n);
  const tagY = s.h * 0.1;
  const o = { size: 3.2, font: 'mono', weight: 600 } as const;
  const w = s.measure(label, o) + 4 * u;
  s.arrow(x, tagY + 3.4 * u, x, y - 4.6 * u, s.c(k), 0.45, 2.4);
  s.rrect(x - w / 2, tagY - 3 * u, w, 6 * u, 1.2, { fill: s.tint(k, 0.18), stroke: s.tint(k, 0.8), lw: 0.35 });
  s.text(label, x, tagY, { ...o, color: s.c(k) });
}

/** The paths that pile up in the store: nine from the start, three more on the upgrade. */
const PILE = ['curl-8.9', 'git-2.45', 'zlib-1.2', 'curl-8.10', 'git-2.46', 'zlib-1.3', 'openssl-3.3', 'python-3.12', 'glibc-2.39', 'curl-8.11', 'git-2.47', 'python-3.13'];
const FIRST = 9;

const grows: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const upgraded = s.ease('upgrade', 0.6);
    PILE.forEach((label, i) => {
      const x = s.w * (0.2 + 0.3 * (i % 3));
      const y = s.h * 0.12 + Math.floor(i / 3) * 10 * u;
      const a = i < FIRST ? Math.min(1, s.prog('grow') * FIRST - i + 1) : s.ease('upgrade', 0.5, (i - FIRST) * 0.5);
      s.alpha(Math.max(0, a), () => pathBox(s, x, y, label, i < FIRST ? '--ink-3' : 'blue', i < FIRST ? 0.4 * (1 - upgraded) : 1));
    });
    s.alpha(s.ease('count', 0.6), () => s.text('6318 store paths', cx, s.h * 0.62, { size: 5, font: 'mono', weight: 700, color: s.c('blue') }));
    s.alpha(s.ease('danger', 0.6), () => s.text('which of these can go?', cx, s.h * 0.8, { size: 4, italic: true, color: s.c('red') }));
  },
};

const roots: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const q = s.ease('query', 0.6);
    for (const [a, b] of REFS) arrow(s, a, b, q > 0.5 && b === 'openssl' ? 'gold' : '--ink-3', q > 0.5 && b === 'openssl' ? 0.7 : 0.45);
    for (const n of NAMES) box(s, n, q > 0.5 && n === 'openssl' ? 'gold' : '--ink-3', q > 0.5 && n === 'openssl' ? 1 : 0.3);
    s.alpha(s.win('promise', 'result'), () => s.text('which of these must stay?', cx, s.h * 0.1, { size: 3.8, italic: true, color: s.c('--ink-2'), halo: true }));
    s.alpha(s.ease('result', 0.6), () => rootTag(s, 'curl', 'result'));
    s.alpha(s.ease('profile', 0.6), () => rootTag(s, 'git', 'profile-7'));
    s.alpha(s.ease('gcroots', 0.6), () => s.text('/nix/var/nix/gcroots', cx, s.h * 0.94, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold'), halo: true }));
  },
};

const live: SceneDef = {
  draw(s) {
    const walked = s.prog('walk') * (WALK.length + 0.3);
    const inWalk = s.at('walk') <= s.t;
    const lit = (n: Name) => (inWalk && WALK.includes(n) ? Math.min(1, Math.max(0, walked - WALK.indexOf(n))) : 0);
    const rest = s.ease('rest', 0.6);
    for (const [a, b] of REFS) {
      const on = Math.min(lit(a), lit(b));
      arrow(s, a, b, on > 0.5 ? 'blue' : rest > 0.5 && GARBAGE.includes(a) ? 'red' : '--ink-3');
    }
    for (const n of NAMES) box(s, n, GARBAGE.includes(n) && rest > 0.5 ? 'red' : 'blue', GARBAGE.includes(n) ? rest : lit(n));
    rootTag(s, 'curl', 'result');
    rootTag(s, 'git', 'profile-7');
    const count = Math.round(Math.min(WALK.length, walked));
    const safe = s.ease('safe', 0.6);
    s.alpha(s.ease('walk', 0.5) * (1 - safe), () => s.text(`live: ${count} ${count === 1 ? 'path' : 'paths'}`, s.w * 0.04, s.h * 0.94, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('blue'), halo: true }));
    s.alpha(rest * (1 - safe), () => s.text('garbage: 2', s.w * 0.96, s.h * 0.94, { size: 3.8, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true }));
    s.alpha(safe, () => verdict(s, true, 'nothing live points at garbage', s.w * 0.04 + 2 * s.u, s.h * 0.94, 3.4));
  },
};

const collect: SceneDef = {
  draw(s) {
    const u = s.u;
    const d = s.ease('d', 0.6);
    const gone = s.ease('cost', 0.8);
    const fade = (n: Name) => (GARBAGE.includes(n) ? 1 - gone : 1);
    for (const [a, b] of REFS) s.alpha(Math.min(fade(a), fade(b)), () => arrow(s, a, b));
    for (const n of NAMES) s.alpha(fade(n), () => box(s, n, GARBAGE.includes(n) ? 'gold' : 'blue', GARBAGE.includes(n) ? 0.8 : 0.5));
    rootTag(s, 'curl', 'result');
    rootTag(s, 'git', 'profile-7');
    s.alpha(s.ease('held', 0.6) * (1 - d), () => rootTag(s, 'oldCurl', 'profile-6'));
    const [ox, oy] = xy(s, 'oldSsl');
    s.alpha(s.win('gc', 'd'), () => verdict(s, true, 'still live', ox - 4 * u, oy + 9.5 * u, 3));
    s.alpha(d * (1 - gone), () => {
      const [x] = xy(s, 'oldCurl');
      s.text('profile-6 gone', x, s.h * 0.1, { size: 3.2, font: 'mono', weight: 600, color: s.c('red') });
    });
    s.alpha(gone, () => verdict(s, true, 'space back, no way back', s.w * 0.04 + 2 * s.u, s.h * 0.94, 3.4));
  },
};

export const scenes: Record<string, SceneDef> = { grows, roots, live, collect };
