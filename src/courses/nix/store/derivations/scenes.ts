import { verdict } from '../../../../lecture/draw';
import type { Ink, Scene, SceneDef } from '../../../../lecture/scene';
import { pathBox, reference, storePath } from '../../draw';

const recipe: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const w = Math.min(s.w * 0.86, 92 * u);
    const x = (s.w - w) / 2;
    const top = s.h * 0.08;
    const pathY = s.h * 0.78;
    const rows: [string, string, string, Ink][] = [
      ['name', '"hello"', 'name', 'gold'],
      ['system', 'this machine', 'system', 'blue'],
      ['builder', '/bin/sh', 'builder', 'green'],
      ['args', '-c "echo hi > $out"', 'builder', 'green'],
    ];
    const h = 11 * u + rows.length * 9 * u;
    s.alpha(s.ease('recipe', 0.6), () => {
      s.rrect(x, top, w, h, 1.5, { fill: s.tint('--ink-3', 0.06), stroke: s.tint('--ink-3', 0.55), lw: 0.35 });
      s.text('derivation', x + 4 * u, top + 5.5 * u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('--ink') });
    });
    rows.forEach(([key, value, beat, k], i) => {
      const y = top + 13 * u + i * 9 * u;
      s.alpha(s.ease(beat, 0.5, beat === 'builder' ? i * 0.15 : 0), () => {
        s.text(key, x + 4 * u, y, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink-2') });
        s.text(value, x + 22 * u, y, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c(k) });
      });
    });
    s.alpha(s.ease('name', 0.5), () => s.arrow(cx, top + h + 1.5 * u, cx, pathY - 5 * u, s.c('--ink-3'), 0.45, 2.4));
    s.alpha(s.win('problem', 'recipe'), () => s.text('every input, written down first', cx, s.h * 0.42, { size: 3.8, italic: true, color: s.c('--ink-2'), halo: true }));
    storePath(s, cx, pathY, '????', 'hello');
  },
};

/** A box with a dashed outline: a path with a name and nothing in it yet. */
function dashedBox(s: Scene, x: number, y: number, label: string, k: Ink) {
  const o = { size: 3.4, font: 'mono', weight: 600 } as const;
  const u = s.u;
  const w = s.measure(label, o) + 5 * u;
  const h = 8 * u;
  const [l, r, t, b] = [x - w / 2, x + w / 2, y - h / 2, y + h / 2];
  const dash = [1.2, 1];
  s.line(l, t, r, t, s.c(k), 0.35, dash);
  s.line(r, t, r, b, s.c(k), 0.35, dash);
  s.line(r, b, l, b, s.c(k), 0.35, dash);
  s.line(l, b, l, t, s.c(k), 0.35, dash);
  s.text(label, x, y, { ...o, color: s.c('--ink') });
}

const stages: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const [y0, y1, y2] = [s.h * 0.14, s.h * 0.45, s.h * 0.76];
    const side = cx + 4 * u;
    pathBox(s, cx, y0, 'hello.nix', '--ink-3', 0.4);
    s.alpha(s.ease('eval', 0.6), () => {
      reference(s, cx, y0, cx, y1, '--ink-3');
      s.text('instantiate', side, (y0 + y1) / 2, { size: 3.4, font: 'mono', align: 'left', color: s.c('blue'), halo: true });
      pathBox(s, cx, y1, 'myp…-hello.drv', 'blue', 1);
    });
    const built = s.ease('realise', 0.7);
    s.alpha(s.ease('know', 0.6) * (1 - built), () => dashedBox(s, cx, y2, 'k6l…-hello', 'gold'));
    s.alpha(s.win('none', 'realise'), () => verdict(s, false, 'nothing there yet', cx - 15 * u, y2 + 9 * u, 3.3));
    s.alpha(s.ease('realise', 0.6), () => {
      reference(s, cx, y1, cx, y2, 'green');
      s.text('realise', side, (y1 + y2) / 2, { size: 3.4, font: 'mono', align: 'left', color: s.c('green'), halo: true });
    });
    s.alpha(built, () => {
      pathBox(s, cx, y2, 'k6l…-hello', 'green', 1);
      verdict(s, true, 'path filled in', cx - 13 * u, y2 + 9 * u, 3.3);
    });
  },
};

const build: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const roomW = Math.min(s.w * 0.7, 74 * u);
    const [roomTop, roomH] = [s.h * 0.06, s.h * 0.56];
    const [shY, outY] = [s.h * 0.18, s.h * 0.44];
    const trust = s.ease('trust', 0.6);
    s.alpha(s.ease('sealed', 0.6), () => {
      s.rrect(cx - roomW / 2, roomTop, roomW, roomH, 1.5, { fill: s.tint('--ink-3', 0.05), stroke: s.c(trust > 0.5 ? 'green' : '--ink-3'), lw: 0.5 });
      s.text('sandbox', cx - roomW / 2 + 2.5 * u, roomTop + 4 * u, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
    });
    pathBox(s, cx, shY, '/bin/sh', 'blue', 1);
    reference(s, cx, shY, cx, outY, 'gold');
    s.text('$out', cx + 3 * u, (shY + outY) / 2, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('gold'), halo: true });
    pathBox(s, cx, outY, 'k6l…-hello', 'gold', 1);
    s.alpha(trust, () => s.text('only what the recipe names', cx, s.h * 0.56, { size: 3.4, italic: true, color: s.c('green'), halo: true }));
    const left = cx - 22 * u;
    const row = (i: number) => s.h * 0.69 + i * 7 * u;
    ['no network', 'no home folder', 'no /usr/lib'].forEach((t, i) => s.alpha(s.ease('no', 0.5, i * 0.5), () => verdict(s, false, t, left, row(i), 3.4)));
    s.alpha(s.ease('only', 0.5), () => verdict(s, true, 'declared store paths', left, row(3), 3.4));
  },
};

const string: SceneDef = {
  draw(s) {
    const u = s.u;
    const boxX = s.w * 0.25;
    const textX = s.w * 0.62;
    const [topY, botY] = [s.h * 0.14, s.h * 0.82];
    const record = s.ease('record', 0.6);
    const order = s.ease('order', 0.6);
    pathBox(s, boxX, topY, 'world', 'blue', 1);
    pathBox(s, boxX, botY, 'hello', 'gold', 1);
    s.alpha(record, () => reference(s, boxX, topY, boxX, botY, 'gold', 0.6));
    const code = { size: 3, font: 'mono', weight: 600, halo: true } as const;
    s.alpha(s.ease('need', 0.5), () => s.text('"cat ${import ./hello.nix} > $out"', textX, s.h * 0.32, { ...code, color: s.c('--ink') }));
    s.alpha(s.ease('insert', 0.5), () => {
      s.text('↓', textX, s.h * 0.39, { size: 3.6, color: s.c('--ink-3') });
      s.text('"cat /nix/store/k6l…-hello > $out"', textX, s.h * 0.46, { ...code, color: s.c('--ink') });
    });
    s.alpha(s.ease('context', 0.5), () => {
      const label = 'needs: myp…-hello.drv';
      const w = s.measure(label, { size: 3.2, font: 'mono', weight: 600 }) + 5 * u;
      const y = s.h * 0.58;
      s.rrect(textX - w / 2, y - 4 * u, w, 8 * u, 1.2, { fill: s.tint('gold', 0.18), stroke: s.tint('gold', 0.8), lw: 0.35 });
      s.text(label, textX, y, { size: 3.2, font: 'mono', weight: 600, color: s.c('gold') });
      s.text('string context', textX, y + 7 * u, { size: 3.2, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(order, () => {
      const side = boxX + 12 * u;
      s.text('realised second', side, topY, { size: 3.3, align: 'left', color: s.c('blue') });
      s.text('realised first', side, botY, { size: 3.3, align: 'left', color: s.c('gold') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { recipe, stages, build, string };
