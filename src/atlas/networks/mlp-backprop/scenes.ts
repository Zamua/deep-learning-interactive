import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells } from '../../draw';
import { after, caption, type Ink, vcells } from '../draw';

const Z = [2, -1];
const H = [2, 0];
const S = [3, 3];
const DS = [-0.5, 0.5];
const W2 = [[1, -1], [2, 1]];
const DW2 = DS.map((g) => H.map((v) => g * v));
const DH = [0.5, 1];
const DZ = [0.5, 0];
const X = [1, 2];
const DW1 = DZ.map((g) => X.map((v) => g * v));
const str = (v: number) => (Object.is(v, -0) ? '0' : String(v).replace('-', '−'));

const CW = 11;
const head = (s: Scene, t: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'center') => s.text(t, x, y, { size: 3.8, font: 'mono', weight: 650, align, color: s.c(k) });
const rows = (s: Scene) => [s.h * 0.42, s.h * 0.6];
const at = (s: Scene, v: number) => s.w / 2 + v * s.u;

const top: SceneDef = {
  draw(s) {
    const ys = rows(s);
    const yh = s.h * 0.2;
    const gx = [at(s, -14), at(s, 0)];
    const dsx = at(s, -34);
    const sx = at(s, 20);
    const dbx = at(s, 36);
    // h across the top of the grid, one column per hidden unit.
    head(s, 'h', (gx[0]! + gx[1]!) / 2, yh - 9 * s.u, 'gold');
    cells(s, gx, yh, H.map(str), 'gold', { w: CW, on: [0, s.win('entries', 'db2')] });
    // The scores, one row per class.
    head(s, 's', sx, yh, 'purple');
    vcells(s, sx, ys, S.map(str), 'purple', { w: CW });
    const dsA = s.ease('ds', 0.6);
    s.alpha(dsA, () => {
      head(s, 'ds', dsx, yh, 'red');
      vcells(s, dsx, ys, DS.map(str), 'red', { w: CW, on: [s.win('dW2', 'db2'), s.win('dW2', 'db2')] });
    });
    // dW2 = ds h^T: row i is ds_i times h.
    const r0 = s.ease('entries', 0.6);
    const r1 = after(s, 'entries', 0.45, 0.6);
    s.alpha(s.ease('dW2', 0.6), () => {
      s.text('dW₂', (gx[0]! + gx[1]!) / 2, ys[1]! + 10 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') });
      ys.forEach((y, i) => {
        const a = i === 0 ? r0 : r1;
        cells(s, gx, y, DW2[i]!.map((v) => (a > 0.5 ? str(v) : '')), 'red', { w: CW, on: [0, s.win('entries', 'db2') * 0.6] });
      });
      s.text('×', (dsx + gx[0]!) / 2, ys[0]!, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
      s.text('×', (dsx + gx[0]!) / 2, ys[1]!, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('db2', 0.6), () => {
      head(s, 'db₂', dbx, yh, 'red');
      vcells(s, dbx, ys, DS.map(str), 'red', { w: CW, on: [1, 1] });
    });
    const cy = s.h * 0.82;
    s.alpha(s.win('setup', 'ds'), () => caption(s, 'z = [2, −1] → h = [2, 0];  s = [3, 3]', cy));
    s.alpha(s.win('ds', 'dW2'), () => caption(s, 'ds = p − one-hot = [0.5, 0.5] − [1, 0]', cy, 'red', 3.4));
    s.alpha(s.win('dW2', 'entries'), () => caption(s, 'dW₂[i, j] = ds[i] · h[j]', cy, 'red', 3.8));
    s.alpha(r0 * (1 - r1), () => caption(s, 'row 0: −0.5·2 = −1,  −0.5·0 = 0', cy, 'red', 3.6));
    s.alpha(r1 * (1 - s.ease('db2', 0.5)), () => caption(s, 'row 1: 0.5·2 = 1,  0.5·0 = 0', cy, 'red', 3.6));
    s.alpha(s.ease('db2', 0.6), () => caption(s, 'db₂ = ds: the bias adds straight on', cy, 'red', 3.6));
  },
};

const down: SceneDef = {
  draw(s) {
    const ys = rows(s);
    const yh = s.h * 0.2;
    const gx = [at(s, 0), at(s, 16)];
    const dsx = at(s, -22);
    const ydh = s.h * 0.78;
    const u0 = s.win('u0', 'u1');
    const u1 = s.ease('u1', 0.6);
    const lit = [u0, u1];
    head(s, 'ds', dsx, yh, 'red');
    vcells(s, dsx, ys, DS.map(str), 'red', { w: CW, on: [Math.max(u0, u1), Math.max(u0, u1)] });
    head(s, 'W₂', (gx[0]! + gx[1]!) / 2, yh, 'blue');
    // A band down the column of the unit being collected.
    lit.forEach((a, j) => {
      if (a > 0.003) s.rrect(gx[j]! - (CW / 2 + 1.6) * s.u, ys[0]! - 6 * s.u, (CW + 3.2) * s.u, ys[1]! - ys[0]! + 12 * s.u, 1.6, { fill: s.tint('blue', 0.1 * a), stroke: s.tint('blue', 0.7 * a), lw: 0.4 });
    });
    ys.forEach((y, i) => cells(s, gx, y, W2[i]!.map(str), 'blue', { w: CW, on: lit }));
    s.alpha(s.ease('dh', 0.6, 1), () => {
      gx.forEach((x) => s.arrow(x, ys[1]! + 6 * s.u, x, ydh - 6 * s.u, s.c('--ink-3'), 0.35, 2));
      head(s, 'dh', dsx, ydh, 'red');
      cells(s, gx, ydh, DH.map((v, j) => (s.ease(j ? 'u1' : 'u0', 0.6, 1) > 0.5 ? str(v) : '')), 'red', { w: CW, on: lit });
    });
    const cy = s.h * 0.92;
    s.alpha(s.win('dh', 'u0'), () => caption(s, 'dh[j] = column j of W₂ · ds', cy, 'red', 3.6));
    s.alpha(u0, () => caption(s, '1·(−0.5) + 2·0.5 = 0.5', cy, 'red', 3.8));
    s.alpha(u1, () => caption(s, '(−1)·(−0.5) + 1·0.5 = 1', cy, 'red', 3.8));
  },
};

const mask: SceneDef = {
  draw(s) {
    const ys = rows(s);
    const yh = s.h * 0.2;
    const zx = at(s, -40);
    const dhx = at(s, -24);
    const dzx = at(s, -4);
    const gx = [at(s, 18), at(s, 32)];
    const mA = s.ease('mask', 0.6);
    head(s, 'z', zx, yh, '--ink-2');
    ys.forEach((y, i) => s.cell(zx - (CW / 2) * s.u, y - 4.25 * s.u, CW * s.u, 8.5 * s.u, str(Z[i]!), Z[i]! > 0 ? 'green' : 'red', { on: mA }));
    head(s, 'dh', dhx, yh, 'red');
    vcells(s, dhx, ys, DH.map(str), 'red', { w: CW });
    s.alpha(mA, () => {
      ys.forEach((y, i) => {
        s.arrow(dhx + 6.5 * s.u, y, dzx - 6.5 * s.u, y, s.c('--ink-3'), 0.35, 2);
        s.text(Z[i]! > 0 ? '×1' : '×0', (dhx + dzx) / 2, y - 3.5 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c(Z[i]! > 0 ? 'green' : 'red'), halo: true });
      });
    });
    const aA = s.ease('apply', 0.6);
    s.alpha(aA, () => {
      head(s, 'dz', dzx, yh, 'red');
      vcells(s, dzx, ys, DZ.map(str), 'red', { w: CW, on: [0, s.win('apply', 'dW1')] });
    });
    const wA = s.ease('dW1', 0.6);
    s.alpha(wA, () => {
      head(s, 'xᵀ', gx[0]! - 8 * s.u, yh, 'orange', 'right');
      cells(s, gx, yh, X.map(str), 'orange', { w: CW });
      ys.forEach((y, i) => cells(s, gx, y, DW1[i]!.map(str), 'red', { w: CW, on: i === 1 ? [1, 1].map(() => s.ease('dW1', 0.6, 2)) : [0, 0] }));
      s.text('dW₁', (gx[0]! + gx[1]!) / 2, ys[1]! + 10 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') });
    });
    const cy = s.h * 0.84;
    s.alpha(s.win('mask', 'apply'), () => caption(s, 'slope 1 where z > 0, 0 where z < 0', cy, '--ink-2', 3.6));
    s.alpha(s.win('apply', 'dW1'), () => caption(s, 'dz = [0.5, 1] × [1, 0] = [0.5, 0]', cy, 'red', 3.6));
    s.alpha(wA, () => caption(s, 'dW₁ = dz xᵀ: the off unit\'s row is 0', cy, 'red', 3.6));
  },
};

export const scenes: Record<string, SceneDef> = { top, down, mask };
