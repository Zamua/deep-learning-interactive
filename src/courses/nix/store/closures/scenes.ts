import { verdict } from '../../../../lecture/draw';
import type { Ink, Scene, SceneDef } from '../../../../lecture/scene';
import { pathBox, reference, storePath } from '../../draw';

/** Where each path of the example sits, as fractions of the stage. */
const AT = {
  curl: [0.5, 0.13],
  libssh2: [0.27, 0.37],
  zlib: [0.75, 0.37],
  openssl: [0.43, 0.61],
  glibc: [0.54, 0.84],
} as const;
type Name = keyof typeof AT;
const LABELS: Record<Name, string> = { curl: 'curl-8.11', libssh2: 'libssh2-1.11', zlib: 'zlib-1.3', openssl: 'openssl-3.4', glibc: 'glibc-2.40' };
/** Each path's references. */
const REFS: [Name, Name][] = [['curl', 'libssh2'], ['curl', 'zlib'], ['curl', 'openssl'], ['libssh2', 'openssl'], ['zlib', 'glibc'], ['openssl', 'glibc']];
/** The order a walk from curl first reaches each path. */
const WALK: Name[] = ['curl', 'libssh2', 'openssl', 'glibc', 'zlib'];

const xy = (s: Scene, n: Name): [number, number] => [AT[n][0] * s.w, AT[n][1] * s.h];

function box(s: Scene, n: Name, k: Ink, on = 0) {
  const [x, y] = xy(s, n);
  pathBox(s, x, y, LABELS[n], k, on);
}

function arrow(s: Scene, a: Name, b: Name, k: Ink = '--ink-3', width = 0.45) {
  const [x0, y0] = xy(s, a);
  const [x1, y1] = xy(s, b);
  reference(s, x0, y0, x1, y1, k, width);
}

const needs: SceneDef = {
  draw(s) {
    s.alpha(s.ease('ask', 0.5), () => box(s, 'curl', 'blue', 1));
    s.alpha(s.win('ask', 'refs') * s.ease('lean', 0.6), () => {
      s.text('needs what, to run?', s.w / 2, s.h * 0.5, { size: 4, italic: true, color: s.c('--ink-2'), halo: true });
    });
    (['openssl', 'zlib', 'libssh2'] as const).forEach((n, i) => {
      const a = s.ease('list', 0.5, i * 1.1);
      s.alpha(a, () => {
        arrow(s, 'curl', n, 'gold');
        box(s, n, 'gold', 1);
      });
    });
    s.alpha(s.ease('refs', 0.5) * (1 - s.ease('list', 0.5)), () => {
      s.text('references: recorded for every store path', s.w / 2, s.h * 0.5, { size: 3.6, font: 'mono', color: s.c('--ink-2'), halo: true });
    });
  },
};

/** The binary as lines of bytes, one of them holding a store path. */
const BYTES = ['7f 45 4c 46 02 01 01 00', '00 03 00 3e 00 01 00 00', '', 'c3 0f 1f 44 00 00 48 89', '', 'e5 41 57 41 56 41 55 41'];

const scan: SceneDef = {
  draw(s) {
    const u = s.u;
    const top = s.h * 0.08;
    const rowH = 7.4 * u;
    const w = Math.min(s.w * 0.86, 92 * u);
    const x = (s.w - w) / 2;
    s.rrect(x, top, w, rowH * BYTES.length + 3 * u, 1.2, { fill: s.tint('--ink-3', 0.06), stroke: s.tint('--ink-3', 0.5), lw: 0.35 });
    s.text('result/bin/curl', x + 2 * u, top - 3.2 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
    const rowY = (i: number) => top + 1.5 * u + rowH * (i + 0.5);
    BYTES.forEach((b, i) => b && s.text(b, s.w / 2, rowY(i), { size: 3.2, font: 'mono', color: s.c('--ink-3') }));
    const hit = s.ease('hit', 0.6);
    const seen = s.ease('scan', 0.4) * (1 - s.ease('hit', 0.3));
    // Both store paths are in the bytes from the start, dim until the scan has found them.
    s.alpha(0.5 + 0.5 * hit, () => {
      storePath(s, s.w / 2, rowY(2), 'q3f…', 'openssl-3.4', hit > 0.5 ? 'gold' : '--ink-3');
      storePath(s, s.w / 2, rowY(4), 'c8k…', 'zlib-1.3', hit > 0.5 ? 'gold' : '--ink-3');
    });
    s.alpha(seen, () => {
      const y = top + 1.5 * u + rowH * BYTES.length * s.prog('scan');
      s.line(x, y, x + w, y, s.c('gold'), 0.6);
    });
    const list = top + rowH * BYTES.length + 12 * u;
    const lx = s.w / 2 - 30 * u;
    s.alpha(s.ease('hash', 0.5), () => s.text('inputs of the build', lx, list, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') }));
    const rows: [string, boolean, string][] = [['openssl', true, 'hit'], ['zlib', true, 'hit'], ['gcc', false, 'miss']];
    rows.forEach(([name, ok, beat], i) => {
      const y = list + (i + 1) * 7.6 * u;
      s.alpha(s.ease('hash', 0.5, 0.3 * i), () => s.text(name, lx, y, { size: 3.6, font: 'mono', weight: 600, align: 'left', color: s.c('--ink') }));
      s.alpha(s.ease(beat, 0.5, ok ? 0.2 * i : 0.6), () => verdict(s, ok, ok ? 'hash found' : 'hash not found', lx + 24 * u, y, 3.4));
    });
  },
};

const closure: SceneDef = {
  draw(s) {
    const walked = s.prog('walk') * (WALK.length + 0.3);
    const lit = (n: Name) => Math.min(1, Math.max(0, walked - WALK.indexOf(n)));
    const inWalk = s.at('walk') <= s.t;
    const shared = s.win('once', 'cmd');
    for (const [a, b] of REFS) {
      const on = inWalk ? Math.min(lit(a), lit(b)) : 0;
      const k: Ink = shared > 0.3 && b === 'glibc' ? 'gold' : on > 0.5 ? 'blue' : '--ink-3';
      s.alpha(a === 'curl' || s.ease('more', 0.6) > 0 ? (a === 'curl' ? 1 : s.ease('more', 0.6)) : 0, () => arrow(s, a, b, k, shared > 0.3 && b === 'glibc' ? 0.7 : 0.45));
    }
    for (const n of Object.keys(AT) as Name[]) {
      const a = n === 'glibc' ? s.ease('more', 0.6) : 1;
      s.alpha(a, () => box(s, n, shared > 0.3 && n === 'glibc' ? 'gold' : 'blue', inWalk ? lit(n) : n === 'curl' ? 1 : 0));
    }
    const count = Math.round(inWalk ? Math.min(WALK.length, walked) : 0);
    s.alpha(s.ease('walk', 0.5), () => s.text(`closure: ${count} ${count === 1 ? 'path' : 'paths'}`, s.w * 0.04, s.h * 0.94, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('blue'), halo: true }));
  },
};

const NAMES = Object.keys(AT) as Name[];

const copy: SceneDef = {
  draw(s) {
    const u = s.u;
    const tall = s.tall;
    const panel = (cx: number, title: string) => {
      const w = (tall ? 42 : 40) * u;
      s.rrect(cx - w / 2, s.h * 0.1, w, s.h * 0.78, 1.5, { stroke: s.tint('--ink-3', 0.55), lw: 0.35 });
      s.text(title, cx, s.h * 0.06, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
    };
    const lx = s.w * 0.26;
    const rx = s.w * 0.74;
    panel(lx, 'this machine');
    panel(rx, 'server');
    const y = (i: number) => s.h * (0.2 + 0.145 * i);
    const k = s.ease('whole', 0.5);
    NAMES.forEach((n, i) => s.alpha(k, () => pathBox(s, lx, y(i), LABELS[n], 'blue', s.win('unit', 'skip'))));
    // The server starts with the C library alone; the others arrive one by one.
    s.alpha(s.ease('skip', 0.5), () => pathBox(s, rx, y(NAMES.indexOf('glibc')), LABELS.glibc, '--ink-3', 0));
    NAMES.filter((n) => n !== 'glibc').forEach((n, j) => {
      const m = s.ease('skip', 0.7, 2.6 + j * 0.8);
      if (m <= 0) return;
      const i = NAMES.indexOf(n);
      s.alpha(m, () => pathBox(s, lx + (rx - lx) * m, y(i), LABELS[n], 'green', 1));
    });
    s.alpha(s.ease('skip', 0.5, 0.8), () => verdict(s, true, 'already here', rx - 12 * u, y(NAMES.indexOf('glibc')) + 7 * u, 3));
  },
};

export const scenes: Record<string, SceneDef> = { needs, scan, closure, copy };
