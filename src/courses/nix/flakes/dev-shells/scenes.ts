import { caption, verdict } from '../../../../lecture/draw';
import type { Ink, Scene, SceneDef } from '../../../../lecture/scene';
import { pathBox, reference } from '../../draw';

/** One machine's tools and whether the project builds there. */
const MACHINES = [
  { name: 'laptop', tools: 'go 1.21  node 20', ok: true },
  { name: 'teammate', tools: 'go 1.23  node 22', ok: true },
  { name: 'server', tools: 'go 1.22  node 18', ok: false },
];

const onboard: SceneDef = {
  draw(s) {
    MACHINES.forEach((m, i) => {
      const y = s.h * (0.2 + 0.2 * i);
      const arrive = i === 2 ? s.ease('break', 0.5) : s.ease('join', 0.5, i * 1.2);
      const told = i === 2 ? s.ease('break', 0.5, 0.8) : s.ease('mine', 0.5, i * 1.2);
      s.alpha(arrive, () => pathBox(s, s.w * 0.2, y, m.name, m.ok ? 'blue' : 'red', 1));
      s.alpha(told, () => {
        s.text(m.tools, s.w * 0.4, y, { size: 3.3, font: 'mono', align: 'left', color: s.c('--ink') });
        verdict(s, m.ok, m.ok ? 'builds' : 'fails', s.w * 0.78, y, 3.4);
      });
    });
    s.alpha(s.win('global', 'want', 0.4), () => caption(s, 'installed by hand, machine by machine', s.h * 0.82, 'gold', 3.4));
    s.alpha(s.ease('want', 0.5, 0.2), () => caption(s, 'the project should name its tools', s.h * 0.82, 'green', 3.6));
  },
};

const mkshell: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const gap = 30 * s.u;
    const top = s.h * 0.18;
    const mid = s.h * 0.44;
    const low = s.h * 0.7;
    ['devShells', 'x86_64-linux', 'default'].forEach((n, i) => {
      const x = cx + (i - 1) * gap;
      s.alpha(s.ease('shell', 0.5, i * 0.7), () => {
        pathBox(s, x, top, n, 'green', 1);
        if (i) s.text('.', x - gap / 2, top, { size: 4.4, font: 'mono', weight: 700, color: s.c('--ink-2') });
      });
    });
    s.alpha(s.ease('mk', 0.5), () => {
      reference(s, cx, top, cx, mid, 'green');
      pathBox(s, cx, mid, 'pkgs.mkShell', 'blue', 1);
    });
    ([['go', 0.32], ['nodejs', 0.68]] as const).forEach(([n, f], i) => {
      s.alpha(s.ease('pkgs', 0.5, i * 0.7), () => {
        reference(s, cx, mid, s.w * f, low, 'blue');
        pathBox(s, s.w * f, low, n, 'gold', 1);
      });
    });
    s.alpha(s.ease('hook', 0.5), () => caption(s, 'shellHook: runs at each entry', s.h * 0.88, 'gold', 3.4));
  },
};

/** A labelled frame. */
function frame(s: Scene, x: number, y: number, w: number, h: number, label: string, k: Ink = '--ink-3'): void {
  s.rrect(x, y, w, h, 1.5, { fill: s.tint(k, 0.05), stroke: s.tint(k, 0.55), lw: 0.35 });
  s.text(label, x + 2.5 * s.u, y + 4.5 * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
}

const enter: SceneDef = {
  draw(s) {
    const u = s.u;
    const left = s.w * 0.04;
    const y = s.h * 0.08;
    const boxY = s.h * 0.72;
    const left2 = s.w * 0.54;
    const panelH = s.h * 0.34;
    const ink = { size: 3.1, font: 'mono', align: 'left' } as const;
    const gone = s.ease('exit', 0.5);
    s.alpha(s.ease('enter', 0.5), () => {
      frame(s, left, y, s.w * 0.48, panelH, 'this shell', 'blue');
      frame(s, s.w * 0.04, s.h * 0.55, s.w * 0.92, s.h * 0.34, '/nix/store');
      pathBox(s, s.w * 0.3, boxY, 'go-1.24.2', 'gold', 1);
      pathBox(s, s.w * 0.7, boxY, 'nodejs-22.11', 'gold', 1);
    });
    const textX = left + 3 * u;
    s.alpha(s.ease('hook', 0.5) * (1 - gone), () => s.text('go and node are ready', textX, y + 13 * u, { ...ink, color: s.c('--ink') }));
    s.alpha(s.ease('where', 0.5) * (1 - gone), () => s.text('PATH: go, node, …', textX, y + 21 * u, { ...ink, color: s.c('gold') }));
    s.alpha(gone, () => s.text('go: not found', textX, y + 17 * u, { ...ink, color: s.c('red') }));
    s.alpha(s.win('nothing', 'exit', 0.4), () => {
      frame(s, left2, y, s.w * 0.42, panelH, 'another terminal');
      s.text('no go here', left2 + 3 * u, y + 17 * u, { ...ink, color: s.c('red') });
    });
    s.alpha(s.ease('where', 0.5) * (1 - gone), () => {
      for (const f of [0.3, 0.7]) s.arrow(s.w * 0.28, y + panelH, s.w * f, boxY - 4.6 * u, s.c('gold'), 0.45, 2.4);
    });
    s.alpha(s.ease('stay', 0.5), () => {
      const t = 'still in the store';
      verdict(s, true, t, s.w / 2 - (s.measure(t, { size: 3.8 }) + 5.3 * u) / 2, s.h * 0.94);
    });
  },
};

const team: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    s.alpha(s.win('one', 'team', 0.4), () => {
      caption(s, 'nix shell', s.h * 0.14, '--ink', 3.6);
      pathBox(s, cx, s.h * 0.26, 'ripgrep', 'gold', 1);
    });
    s.alpha(s.win('diff', 'team', 0.4), () => {
      caption(s, 'nix develop', s.h * 0.46, '--ink', 3.6);
      ['go', 'nodejs', 'gcc', 'gnumake'].forEach((n, i) => pathBox(s, s.w * (0.2 + 0.2 * i), s.h * 0.58, n, i < 2 ? 'gold' : 'teal', 1));
      caption(s, 'the listed tools, plus a build environment', s.h * 0.72, '--ink-2', 3.2);
    });
    s.alpha(s.win('team', 'gc', 0.4), () => {
      pathBox(s, cx, s.h * 0.16, 'flake.lock', 'gold', 1);
      for (const [name, f] of [['laptop', 0.28], ['teammate', 0.72]] as const) {
        reference(s, cx, s.h * 0.16, s.w * f, s.h * 0.48, 'gold');
        pathBox(s, s.w * f, s.h * 0.48, name, 'blue', 1);
        s.text('go-1.24.2', s.w * f, s.h * 0.6, { size: 3.2, font: 'mono', color: s.c('--ink') });
      }
      caption(s, 'same tools, same commit', s.h * 0.84, 'green', 3.6);
    });
    const stage = s.ease('gc', 0.5);
    const swept = s.ease('gc', 0.8, 1.6) * (1 - s.ease('root', 0.6));
    const profile = s.ease('root', 0.5, 0.4);
    const boxY = s.h * 0.38;
    s.alpha(stage, () => {
      frame(s, s.w * 0.06, s.h * 0.12, s.w * 0.88, s.h * 0.48, '/nix/store');
      ([['go-1.24.2', 0.3], ['nodejs-22.11', 0.7]] as const).forEach(([n, f]) => {
        s.alpha(1 - 0.65 * swept, () => pathBox(s, s.w * f, boxY, n, swept > 0.5 ? 'red' : 'gold', 1));
      });
    });
    s.alpha(s.win('gc', 'root', 0.4), () => caption(s, 'nothing keeps them: deleted', s.h * 0.72, 'red', 3.6));
    s.alpha(profile, () => {
      const y = s.h * 0.78;
      pathBox(s, cx, y, './.dev-profile', 'green', 1);
      for (const f of [0.3, 0.7]) s.arrow(cx, y - 4.6 * u, s.w * f, boxY + 4.6 * u, s.c('green'), 0.45, 2.4);
      caption(s, 'a root keeps them', s.h * 0.9, 'green', 3.6);
    });
  },
};

export const scenes: Record<string, SceneDef> = { onboard, mkshell, enter, team };
