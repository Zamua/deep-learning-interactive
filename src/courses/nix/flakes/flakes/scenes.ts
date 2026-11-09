import { caption, verdict } from '../../../../lecture/draw';
import type { Ink, Scene, SceneDef } from '../../../../lecture/scene';
import { pathBox, reference, storePath } from '../../draw';

/** A cross or a check centered on the stage. */
function centered(s: Scene, ok: boolean, text: string, y: number): void {
  verdict(s, ok, text, s.w / 2 - (s.measure(text, { size: 3.8 }) + 5.3 * s.u) / 2, y);
}

const drift: SceneDef = {
  draw(s) {
    s.alpha(s.ease('file', 0.5), () => pathBox(s, s.w / 2, s.h * 0.1, 'hello.nix', 'blue', 1));
    s.alpha(s.ease('angle', 0.5), () => caption(s, '<nixpkgs> = whatever this machine has', s.h * 0.2, 'gold', 3.4));
    s.alpha(s.ease('channel', 0.5), () => caption(s, 'laptop: nixpkgs from March', s.h * 0.34, '--ink', 3.4));
    s.alpha(s.ease('two', 0.5), () => storePath(s, s.w / 2, s.h * 0.42, 'k9x…', 'hello-2.12'));
    s.alpha(s.ease('channel', 0.5, 1.2), () => caption(s, 'server: nixpkgs from June', s.h * 0.58, '--ink', 3.4));
    s.alpha(s.ease('two', 0.5, 1.2), () => storePath(s, s.w / 2, s.h * 0.66, 'p2m…', 'hello-2.12.1'));
    s.alpha(s.ease('two', 0.5, 2.4) * (1 - s.ease('want', 0.4)), () => centered(s, false, 'same file, different result', s.h * 0.86));
    s.alpha(s.ease('want', 0.5, 0.3), () => caption(s, 'the file should name its nixpkgs', s.h * 0.86, 'green', 3.6));
  },
};

/** An attribute path as chips joined by dots, centered on the stage. */
function chips(s: Scene, y: number, names: string[], k: Ink, shown: (i: number) => number): void {
  const gap = 30 * s.u;
  names.forEach((n, i) => {
    const x = s.w / 2 + (i - (names.length - 1) / 2) * gap;
    s.alpha(shown(i), () => {
      pathBox(s, x, y, n, k, 1);
      if (i) s.text('.', x - gap / 2, y, { size: 4.4, font: 'mono', weight: 700, color: s.c('--ink-2') });
    });
  });
}

const shape: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const top = s.h * 0.12;
    const mid = s.h * 0.36;
    const low = s.h * 0.62;
    s.alpha(s.ease('file', 0.5) * (1 - s.ease('inputs', 0.4)), () => pathBox(s, cx, top, 'flake.nix', 'blue', 1));
    s.alpha(s.ease('inputs', 0.5), () => pathBox(s, cx, top, 'github:NixOS/nixpkgs/nixos-unstable', 'gold', 1));
    s.alpha(s.ease('outputs', 0.5), () => {
      reference(s, cx, top, cx, mid, 'gold');
      pathBox(s, cx, mid, 'outputs = { self, nixpkgs }:', 'blue', 1);
    });
    s.alpha(s.win('set', 'ret', 0.4), () => caption(s, 'legacyPackages: nixpkgs, one set per system', s.h * 0.5, '--ink-2', 3.2));
    s.alpha(s.ease('ret', 0.5), () => reference(s, cx, mid, cx, low, 'blue'));
    chips(s, low, ['packages', 'x86_64-linux', 'default'], 'green', (i) => s.ease('ret', 0.5, 0.4 + i * 0.7));
    s.alpha(s.ease('known', 0.5), () => pathBox(s, cx, s.h * 0.8, 'nix build .#default', 'gold', 1));
  },
};

const lock: SceneDef = {
  draw(s) {
    const x0 = s.w * 0.12;
    const x1 = s.w * 0.84;
    const y = s.h * 0.27;
    const dotX = (i: number) => x0 + ((x1 - x0) * i) / 7;
    const first = s.ease('first', 0.5);
    s.alpha(first, () => {
      s.text('nixos-unstable', x0, s.h * 0.17, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
      s.line(x0, y, dotX(2 + 5 * s.ease('moves', 2.6)), y, s.tint('--ink-3', 0.7), 0.4);
    });
    for (let i = 0; i < 8; i++) {
      s.alpha(i < 3 ? first : s.ease('moves', 0.4, (i - 3) * 0.5), () => s.circle(dotX(i), y, 1.2 * s.u, { fill: s.c('--ink-3') }));
    }
    const px = dotX(2 + 5 * s.ease('update', 1.2));
    const boxY = s.h * 0.4;
    s.alpha(s.ease('first', 0.5, 0.8), () => {
      s.line(px, y, px, boxY - 4 * s.u, s.c('gold'), 0.5);
      s.circle(px, y, 1.9 * s.u, { fill: s.c('gold') });
      pathBox(s, px, boxY, 'flake.lock', 'gold', 1);
    });
    const noteY = s.h * 0.08;
    s.alpha(s.win('rev', 'hash', 0.4), () => caption(s, 'rev: one exact commit', noteY, 'gold', 3.4));
    s.alpha(s.win('hash', 'commit', 0.4), () => caption(s, 'narHash: what it must contain', noteY, 'gold', 3.4));
    s.alpha(s.win('moves', 'update', 0.4), () => caption(s, 'the branch moves, the pin does not', noteY, '--ink-2', 3.4));
    s.alpha(s.ease('update', 0.5, 0.2), () => caption(s, 'you move the pin, on purpose', noteY, 'gold', 3.4));
    const devY = s.h * 0.72;
    s.alpha(s.ease('commit', 0.5), () => {
      for (const [name, f] of [['laptop', 0.28], ['server', 0.72]] as const) {
        reference(s, px, boxY, s.w * f, devY, 'gold');
        pathBox(s, s.w * f, devY, name, 'blue', 1);
      }
      caption(s, 'same nixpkgs', s.h * 0.86, 'green', 3.6);
    });
  },
};

const pure: SceneDef = {
  draw(s) {
    const u = s.u;
    const x = s.w * 0.06;
    const w = s.w * 0.88;
    const left = s.w * 0.14;
    const frame = (y: number, h: number, label: string) => {
      s.rrect(x, y, w, h, 1.5, { fill: s.tint('--ink-3', 0.05), stroke: s.tint('--ink-3', 0.55), lw: 0.35 });
      s.text(label, x + 3 * u, y + 4.5 * u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
    };
    const row = (ok: boolean, t: string, y: number, a: number) => s.alpha(a, () => verdict(s, ok, t, left, y, 3.4));
    const y0 = s.h * 0.05;
    s.alpha(s.ease('err', 0.5), () => frame(y0, s.h * 0.35, 'what the flake can see'));
    const added = s.ease('build', 0.5);
    row(false, 'flake.nix: not tracked', y0 + 15 * u, s.ease('err', 0.5) * (1 - added));
    row(true, 'flake.nix: tracked', y0 + 15 * u, added);
    row(false, 'notes.txt: not tracked', y0 + 25 * u, s.ease('tracked', 0.5));
    const noteY = s.h * 0.47;
    s.alpha(s.win('why', 'build', 0.4), () => caption(s, 'no stray local files', noteY, 'gold', 3.4));
    s.alpha(s.win('build', 'run', 0.4), () => caption(s, '.#default -> packages.x86_64-linux.default', noteY, 'gold', 3.2));
    s.alpha(s.win('run', 'end', 0.4), () => caption(s, 'github:owner/repo: fetched, built, run', noteY, 'gold', 3.2));
    s.alpha(s.ease('end', 0.5), () => caption(s, 'tracked files + flake.lock = same everywhere', noteY, 'green', 3.2));
    const y1 = s.h * 0.55;
    s.alpha(s.ease('pure', 0.5), () => frame(y1, s.h * 0.37, 'during evaluation'));
    ['<nixpkgs>: error', 'builtins.currentSystem: missing', 'builtins.getEnv "HOME": ""'].forEach((t, i) => {
      row(false, t, y1 + (12 + 8.5 * i) * u, s.ease('pure', 0.4, 0.8 + i * 1.1));
    });
  },
};

export const scenes: Record<string, SceneDef> = { drift, shape, lock, pure };
