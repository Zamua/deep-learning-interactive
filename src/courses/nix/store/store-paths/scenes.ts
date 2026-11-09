import { verdict } from '../../../../lecture/draw';
import type { SceneDef } from '../../../../lecture/scene';
import { pathBox, reference, storePath } from '../../draw';

const clash: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const top = s.h * 0.16;
    const slot = s.h * 0.58;
    const apps = [
      { name: 'app-one', x: s.w * 0.27, needs: 'openssl-3.4', k: 'blue' },
      { name: 'app-two', x: s.w * 0.73, needs: 'openssl-1.1', k: 'green' },
    ] as const;
    apps.forEach((a) => {
      pathBox(s, a.x, top, a.name, a.k, 1);
      s.text(`needs ${a.needs}`, a.x, top - 8 * u, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
    });
    const shared = s.ease('shared', 0.6);
    const over = s.ease('overwrite', 0.6);
    const panelW = Math.min(s.w * 0.62, 72 * u);
    s.alpha(shared, () => {
      s.rrect(cx - panelW / 2, slot - 12 * u, panelW, 24 * u, 1.5, { fill: s.tint('--ink-3', 0.06), stroke: s.tint('--ink-3', 0.55), lw: 0.35 });
      s.text('/usr/lib', cx - panelW / 2 + 3 * u, slot - 8.5 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
      apps.forEach((a) => reference(s, a.x, top, cx, slot, a.name === 'app-one' && over > 0.5 ? 'red' : '--ink-3'));
    });
    // The one place for OpenSSL: the new version pushes the old one out.
    s.alpha(shared * (1 - over), () => pathBox(s, cx, slot, 'openssl-3.4', 'blue', 1));
    s.alpha(over, () => pathBox(s, cx, slot, 'openssl-1.1', 'green', 1));
    s.alpha(s.ease('want', 0.6), () => s.text('one place, one version', cx, slot + 17 * u, { size: 3.6, italic: true, color: s.c('--ink-2'), halo: true }));
    const vy = slot + 25 * u;
    s.alpha(s.ease('overwrite', 0.5, 1.4), () => {
      verdict(s, false, 'app-one breaks', s.w * 0.12, vy, 3.3);
      verdict(s, true, 'app-two works', s.w * 0.58, vy, 3.3);
    });
  },
};

const HASH = '5akl8zsmda0yrr63v4khwgskih2g2hsh';

const folder: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const size = s.tall ? 2.7 : 3.3;
    const y = s.h * 0.24;
    const read = s.ease('read', 0.6);
    s.alpha(0.4 + 0.6 * read, () => storePath(s, cx, y, HASH, 'greeting', 'gold', size));
    // The path's three parts, underlined and named.
    const o = { size, font: 'mono', weight: 600 } as const;
    const parts: [string, string, 'gold' | '--ink-3' | '--ink'][] = [['/nix/store/', 'the store', '--ink-3'], [HASH, 'the hash', 'gold'], ['-greeting', 'the name', '--ink']];
    let x = cx - parts.reduce((a, [t]) => a + s.measure(t, o), 0) / 2;
    for (const [t, label, k] of parts) {
      const w = s.measure(t, o);
      const mid = x + w / 2;
      s.alpha(read, () => {
        s.line(x, y + 3.6 * u, x + w, y + 3.6 * u, s.c(k), 0.4);
        s.text(label, mid, y + 8 * u, { size: 3.2, color: s.c('--ink-2') });
      });
      x += w;
    }
    const lower = s.h * 0.5;
    const panelW = Math.min(s.w * 0.86, 88 * u);
    const px = (s.w - panelW) / 2;
    // Below the path: folders in the store, then the alphabet, then read-only.
    s.alpha(s.win('own', 'hash'), () => {
      s.rrect(px, lower, panelW, 34 * u, 1.5, { stroke: s.tint('--ink-3', 0.5), lw: 0.35 });
      s.text('/nix/store', px + 2 * u, lower - 3.2 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
      ['q3f…-openssl-3.4', 'c8k…-zlib-1.3', '5ak…-greeting'].forEach((label, i) => pathBox(s, cx, lower + 7.5 * u + i * 9.5 * u, label, i === 2 ? 'gold' : 'blue', i === 2 ? 1 : 0.3));
    });
    s.alpha(s.win('hash', 'ro'), () => {
      const letters = '0123456789abcdefghijklmnopqrstuvwxyz';
      const pitch = Math.min((s.w - 12 * u) / letters.length, 2.6 * u);
      const ax = cx - (pitch * (letters.length - 1)) / 2;
      const ay = lower + 10 * u;
      [...letters].forEach((c, i) => {
        const off = 'eout'.includes(c);
        const x = ax + i * pitch;
        s.text(c, x, ay, { size: 3.2, font: 'mono', weight: off ? 700 : 500, color: s.c(off ? 'red' : '--ink-2') });
        if (off) s.line(x - 1.1 * u, ay + 1.3 * u, x + 1.1 * u, ay - 1.3 * u, s.c('red'), 0.4);
      });
      s.text('32 characters from this alphabet', cx, ay + 9 * u, { size: 3.4, color: s.c('--ink-2') });
    });
    s.alpha(s.ease('ro', 0.6), () => {
      s.text('-r--r--r--', cx, lower + 10 * u, { size: 6, font: 'mono', weight: 700, color: s.c('blue') });
      verdict(s, false, 'cannot be edited in place', cx - 22 * u, lower + 22 * u, 3.4);
    });
  },
};

const hash: SceneDef = {
  draw(s) {
    const u = s.u;
    const rows = [
      { input: '"hello"', h: '5ak…', k: 'gold', from: 'from', y: 0.13 },
      { input: '"hello!"', h: 'iad…', k: 'blue', from: 'diff', y: 0.24 },
      { input: '"hello"', h: '5ak…', k: 'gold', from: 'same', y: 0.35 },
    ] as const;
    const inputX = s.w * 0.16;
    const pathX = s.w * 0.7;
    s.alpha(s.ease('from', 0.6), () => {
      s.text('what went in', inputX, s.h * 0.05, { size: 3, font: 'mono', color: s.c('--ink-3') });
      s.text('the path', pathX, s.h * 0.05, { size: 3, font: 'mono', color: s.c('--ink-3') });
    });
    rows.forEach((r) =>
      s.alpha(s.ease(r.from, 0.6), () => {
        const y = s.h * r.y;
        s.text(r.input, inputX, y, { size: 3.4, font: 'mono', weight: 600, color: s.c(r.k) });
        s.arrow(s.w * 0.3, y, s.w * 0.39, y, s.c('--ink-3'), 0.4, 2.2);
        storePath(s, pathX, y, r.h, 'greeting', r.k);
      }),
    );
    s.alpha(s.ease('skip', 0.5), () => verdict(s, true, 'already there: skip, or fetch it', s.w * 0.4, s.h * 0.43, 3.2));
    s.alpha(s.ease('side', 0.7), () => {
      const y0 = s.h * 0.52;
      const appY = s.h * 0.62;
      const libY = s.h * 0.82;
      const panelW = Math.min(s.w * 0.9, 96 * u);
      const px = (s.w - panelW) / 2;
      s.rrect(px, y0, panelW, s.h * 0.4, 1.5, { stroke: s.tint('--ink-3', 0.5), lw: 0.35 });
      s.text('/nix/store', px + 2 * u, y0 + 3.4 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
      ([['app-one', 'q3f…-openssl-3.4', -1, 'blue'], ['app-two', 'm4c…-openssl-1.1', 1, 'green']] as const).forEach(([app, lib, side, k]) => {
        const x = s.w / 2 + side * 23 * u;
        pathBox(s, x, appY, app, k, 1);
        reference(s, x, appY, x, libY, k);
        pathBox(s, x, libY, lib, k, 1);
      });
    });
  },
};

const into: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const srcY = s.h * 0.17;
    const storeY = s.h * 0.68;
    const lx = s.w * 0.27;
    const rx = s.w * 0.73;
    pathBox(s, lx, srcY, 'hello.txt', '--ink-3', 0.4);
    const insert = s.ease('insert', 0.6);
    const panelW = Math.min(s.w * 0.7, 76 * u);
    s.alpha(insert, () => {
      s.rrect(cx - panelW / 2, storeY - 12 * u, panelW, 24 * u, 1.5, { stroke: s.tint('--ink-3', 0.5), lw: 0.35 });
      s.text('/nix/store', cx - panelW / 2 + 2 * u, storeY - 8.5 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
      reference(s, lx, srcY, cx, storeY, 'gold');
      s.text('"${./hello.txt}"', s.w * 0.21, s.h * 0.42, { size: 3.2, font: 'mono', color: s.c('gold'), halo: true });
      pathBox(s, cx, storeY, 'i9p…-hello.txt', 'gold', 1);
    });
    s.alpha(s.ease('where', 0.6), () => {
      pathBox(s, rx, srcY, 'other/hello.txt', '--ink-3', 0.4);
      reference(s, rx, srcY, cx, storeY, 'gold');
      verdict(s, true, 'same contents, same store path', cx - 23 * u, storeY + 18 * u, 3.4);
    });
  },
};

export const scenes: Record<string, SceneDef> = { clash, folder, hash, into };
