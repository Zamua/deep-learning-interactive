import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { type Box, OBJECTS, SCENE_H, SCENE_W } from '../../lib/detection-scene';
import { ANCHOR_STRIDE, AT, AT_ANCHORS, BEST_NINE, BEST_ONE, BEST_PROPOSAL, FH, FW, PROPOSALS, YOLO7, centerCell, fmap, roiPool } from './data';
import { type Rect, View, block, boxChip, cells, check, chip, clsK, corners, cue, cxcywh, fit, lerpBox, stage, trapezoid, stacked } from './kit';

// ---------------------------------------------------------------- R-CNN

const ASK: [Box, string, 'red' | 'slate' | 'orange'][] = [
  [[30, 170, 200, 264], 'car?', 'red'],
  [[120, 26, 230, 112], 'background?', 'slate'],
  [[300, 200, 402, 272], 'dog?', 'orange'],
];
const MERGE: Box[] = [
  [372, 206, 400, 232],
  [362, 206, 400, 252],
  [318, 208, 400, 262],
  [304, 206, 400, 270],
];
const ROWS: [Box, string, number][] = [
  [[20, 166, 206, 270], 'car 0.91', 1],
  [[204, 104, 266, 276], 'person 0.88', 2],
  [[296, 196, 408, 276], 'dog 0.86', 3],
];
const P_DOG = corners(340, 232, 80, 72);
const [PX, PY, PW, PH] = cxcywh(P_DOG);
const [GX, GY, GW, GH] = cxcywh(OBJECTS[3]!.box);
const T = [(GX - PX) / PW, (GY - PY) / PH, Math.log(GW / PW), Math.log(GH / PH)];

const rcnn: SceneDef = {
  marks: {
    txy: { tex: String.raw`\sym{t}{t_x} = \frac{\sym{bg}{b^*_x} - \sym{P}{P_x}}{\sym{P}{P_w}}`, x: 0.5, y: 0.5, size: 4.6 },
    twh: { tex: String.raw`\sym{t}{t_w} = \log \frac{\sym{bg}{b^*_w}}{\sym{P}{P_w}}`, x: 0.5, y: 0.5, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const tall = stacked(s);

    // Phase A: why classification, and where proposals come from.
    const aA = s.win('vary', 'rcnn');
    if (aA > 0) {
      const r = tall ? fit(u * 4, h * 0.1, w - u * 8, h * 0.62) : fit(u * 4, h * 0.09, w - u * 8, h * 0.7);
      const v = View.in(s, r);
      const cap = (t: string, a: number, k = '--ink-2') => s.alpha(a, () => s.text(t, w / 2, r[1] + r[3] + u * 6, { size: 3.4, font: 'mono', color: s.c(k as 'teal') }));
      s.alpha(aA, () => {
        v.paint(1);
        const vA = s.win('vary', 'clf');
        s.alpha(vA, () => OBJECTS.forEach((o) => v.box(o.box, s.c(clsK(o.cls)), 0.5)));
        cap('how many outputs? 5 here, 40 elsewhere', vA * s.ease('vary', 0.5, 1));
        const qA = s.win('clf', 'props');
        ASK.forEach(([b, q, k], i) => {
          const a = qA * s.ease('clf', 0.4, 1.6 + i * 0.9);
          s.alpha(a, () => {
            v.box(b, s.c(k), 0.55);
            chip(s, q, v.X(b[0]) + u * 0.6, v.Y(b[1]) + u * 0.6, s.c(k), { size: 2.8 });
          });
        });
        cap('each region: which class, or background?', qA);
        const pA = s.win('props', 'rcnn');
        const recall = s.ease('recall', 0.5);
        v.clip(() =>
          PROPOSALS.forEach((b, i) => {
            const best = BEST_PROPOSAL.some((bp) => bp.i === i);
            const a = pA * s.ease('props', 0.3, 0.6 + i * 0.09) * (best ? 1 : 1 - 0.7 * recall) * (1 - 0.65 * s.win('ss', 'recall'));
            s.alpha(a, () => v.box(b, s.c('green'), best && recall > 0 ? lerp(0.3, 0.7, recall) : 0.3));
          }),
        );
        const mA = s.win('ss', 'recall');
        if (mA > 0) {
          const p = s.prog('ss');
          MERGE.forEach((b, i) => {
            const a = clamp01((p - i * 0.18) * 5);
            const last = clamp01((p - (i + 1) * 0.18) * 5);
            s.alpha(mA * a * (1 - 0.6 * last), () => v.box(b, s.c('green'), lerp(0.9, 0.4, i < MERGE.length - 1 ? last : 0)));
          });
          cap('~2,000 boxes, a couple of seconds on a CPU', mA * s.ease('ss', 0.5, 2), 'green');
        }
        s.alpha(recall * pA, () => {
          OBJECTS.forEach((o, i) => {
            const bp = BEST_PROPOSAL[i]!;
            const b = PROPOSALS[bp.i]!;
            check(s, v.X(b[2]) - u * 1.2, v.Y(b[1]) + u * 1.2, u * 1.7);
          });
          cap('every object covered by some proposal', 1, 'green');
        });
      });
    }

    // Phase B: warp, ConvNet, classify, regress.
    const bA = s.win('rcnn', 'deltas');
    if (bA > 0) {
      s.alpha(bA, () => {
        const gap = u * 4.5;
        const rowH = Math.min(u * 20, (h - u * 26) / 3 - gap);
        const natW = u * 16;
        const conv = u * 15;
        const x0 = (w - (natW + rowH + conv + u * 33)) / 2;
        const y0 = (h - (3 * rowH + 2 * gap) - u * 7) / 2 + u * 2;
        ROWS.forEach(([b, lbl, cls], i) => {
          const a = s.ease('rcnn', 0.5, 0.3 * i);
          const y = y0 + i * (rowH + gap);
          s.alpha(a, () => {
            const bw = b[2] - b[0];
            const bh = b[3] - b[1];
            const nw = Math.min(natW, (rowH * bw) / bh);
            const nh = (nw * bh) / bw;
            const sc = new View(s, 0, 0, 1);
            const nx = x0 + (natW - nw) / 2;
            sc.crop(b, [nx, y + (rowH - nh) / 2, nw, nh]);
            s.rrect(nx, y + (rowH - nh) / 2, nw, nh, 0.6, { stroke: s.c('green'), lw: 0.4 });
            const wx = x0 + natW + u * 4;
            const warp = s.ease('rcnn', 0.8, 1.6 + 0.3 * i);
            const ww = lerp(nw, rowH, warp);
            const wh = lerp(nh, rowH, warp);
            s.arrow(x0 + natW + u * 0.6, y + rowH / 2, wx - u * 0.6, y + rowH / 2, s.c('--ink-3'), 0.3, 1.4);
            sc.crop(b, [wx, y + (rowH - wh) / 2, ww, wh]);
            s.rrect(wx, y + (rowH - wh) / 2, ww, wh, 0.6, { stroke: s.c('--rule'), lw: 0.3 });
            const fa = s.ease('feat', 0.5, 0.25 * i);
            s.alpha(fa, () => {
              const tx = wx + rowH + u * 4;
              s.arrow(wx + rowH + u * 0.6, y + rowH / 2, tx - u * 0.6, y + rowH / 2, s.c('--ink-3'), 0.3, 1.4);
              trapezoid(s, tx, y + rowH * 0.1, conv, rowH * 0.8, 'slate', 0.45, 'ConvNet', 2.8);
              const ox = tx + conv + u * 3;
              s.arrow(tx + conv + u * 0.4, y + rowH / 2, ox, y + rowH / 2, s.c('--ink-3'), 0.3, 1.4);
              chip(s, lbl, ox + u, y + rowH / 2 - u * 5, s.c(clsK(cls)), { size: 2.9 });
              s.alpha(s.ease('feat', 0.5, 2.4 + 0.2 * i), () => chip(s, 'box nudge t', ox + u, y + rowH / 2 + u * 0.6, s.c('teal'), { size: 2.9 }));
            });
          });
        });
        s.alpha(s.ease('rcnn', 0.5, 2.2), () => s.text('× 2,000 proposals per image', w / 2, y0 + 3 * rowH + 2 * gap + u * 5, { size: 3.3, font: 'mono', weight: 600, color: s.c('green') }));
      });
    }

    // Phase C: the regression targets t.
    const cA = s.win('deltas', 'slow');
    if (cA > 0) {
      const r = tall ? fit(u * 4, h * 0.1, w - u * 8, h * 0.5) : fit(u * 4, h * 0.1, w * 0.5, h * 0.82);
      const v = View.in(s, r, [262, 168, 180]);
      const apply = s.ease('twh', 1.2, Math.max(0.5, s.end('twh') - s.at('twh') - 1.6));
      const P = lerpBox(P_DOG, OBJECTS[3]!.box, apply);
      s.alpha(cA, () => {
        v.paint(1);
        v.clip(() => {
          v.box(OBJECTS[3]!.box, s.c('gold'), 0.55, [1.6, 1.1]);
          v.box(P, s.c('green'), 0.65);
        });
        const [cx, cy] = cxcywh(P);
        s.circle(v.X(GX), v.Y(GY), u * 1, { fill: s.c('gold') });
        s.circle(v.X(cx), v.Y(cy), u * 1, { fill: s.c('green') });
        const xyA = s.ease('txy', 0.5) * (1 - apply);
        s.alpha(xyA, () => {
          s.arrow(v.X(PX), v.Y(PY), v.X(GX), v.Y(PY), s.c('teal'), 0.45, 1.8);
          s.arrow(v.X(GX), v.Y(PY), v.X(GX), v.Y(GY), s.c('teal'), 0.45, 1.8);
        });
        const whA = s.ease('twh', 0.5) * (1 - apply);
        s.alpha(whA, () => {
          const y = v.Y(P_DOG[3]) + u * 3;
          s.line(v.X(P_DOG[0]), y, v.X(P_DOG[2]), y, s.c('green'), 0.45);
          s.line(v.X(OBJECTS[3]!.box[0]), y + u * 2.2, v.X(OBJECTS[3]!.box[2]), y + u * 2.2, s.c('gold'), 0.45);
          s.text('P_w', v.X(P_DOG[0]) - u * 1.2, y, { size: 2.6, font: 'mono', align: 'right', color: s.c('green'), halo: true });
          s.text('b*_w', v.X(OBJECTS[3]!.box[2]) + u * 1.2, y + u * 2.2, { size: 2.6, font: 'mono', align: 'left', color: s.c('gold'), halo: true });
        });
        s.text('P', v.X(P[0]) + u * 2, v.Y(P[1]) + u * 3, { size: 3.6, italic: true, weight: 650, color: s.c('green'), halo: true });
        // Panel: the four numbers and the two formulas.
        const px = tall ? w / 2 : r[0] + r[2] + (w - r[0] - r[2]) / 2;
        const py = tall ? r[1] + r[3] + u * 5 : r[1] + r[3] * 0.18;
        const cw = Math.min(u * 10, ((tall ? w : w - r[0] - r[2]) - u * 9) / 4);
        const vals = T.map((t) => (t >= 0 ? '+' : '') + t.toFixed(2));
        const names = ['t_x', 't_y', 't_w', 't_h'];
        const vis = (i: number) => (i < 2 ? s.ease('txy', 0.4, 0.6 + 0.4 * i) : s.ease('twh', 0.4, 0.6 + 0.4 * (i - 2)));
        const pxl = px - (4 * cw + 3 * u) / 2;
        names.forEach((n, i) => s.alpha(vis(i), () => s.text(n, pxl + i * (cw + u) + cw / 2, py - u * 0.6, { size: 2.9, font: 'mono', color: s.c('teal') })));
        cells(s, pxl, py + u * 1.4, cw, u * 5.2, vals, 'teal', { gap: u, size: 3, a: vis });
        const mY = tall ? py + u * 13 : py + u * 18;
        s.show('txy', cA * s.win('txy', 'twh'), { x: px / w, y: mY / h });
        s.show('twh', cA * s.ease('twh', 0.5), { x: px / w, y: (tall ? mY : mY + u * 13) / h });
        if (!tall) s.show('txy', cA * s.ease('twh', 0.01) * (s.since('twh') >= 0 ? 1 : 0), { x: px / w, y: mY / h });
      });
    }

    // Phase D: two thousand passes.
    const dA = s.ease('slow', 0.6);
    if (dA > 0) {
      s.alpha(dA, () => {
        const cols = 50;
        const rows = 40;
        const cs = Math.min((w - u * 16) / cols, (h * 0.55) / rows);
        const gx = (w - cols * cs) / 2;
        const gy = h * 0.16;
        const n = Math.floor(smooth(s.prog('slow') * 1.2) * cols * rows);
        for (let k = 0; k < cols * rows; k++) {
          const i = Math.floor(k / cols);
          const j = k % cols;
          s.ctx.fillStyle = k < n ? s.tint('slate', 0.75) : s.tint('--ink', 0.06);
          s.ctx.fillRect(gx + j * cs + 0.4, gy + i * cs + 0.4, cs - 0.8, cs - 0.8);
        }
        s.text('2,000 ConvNet passes per image', w / 2, gy + rows * cs + u * 6, { size: 3.8, font: 'mono', weight: 600 });
        s.alpha(s.ease('slow', 0.5, 2), () => s.text('about a minute each', w / 2, gy + rows * cs + u * 12, { size: 3.6, font: 'display', italic: true, color: s.c('red') }));
      });
    }
  },
};

// ---------------------------------------------------------------- Fast R-CNN

const STRIDE = 40;
const PROP_CAR: Box = [40, 160, 200, 280];
const PROP_DOG: Box = [300, 200, 400, 280];
const PROP_PPL: Box = [200, 100, 300, 280];
const toCells = (b: Box): Box => b.map((v) => Math.floor(v / STRIDE)) as Box;
const BIN_K = ['blue', 'orange', 'green', 'purple'] as const;

const fast: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = stacked(s);
    const mapA = s.win('waste', 'smooth');
    if (mapA > 0) {
      const outW = tall ? u * 18 : u * 26;
      const r = fit(u * 4, h * 0.11, w - u * 12 - outW, h * 0.66);
      const v = View.in(s, r);
      const cs = r[2] / FW;
      const f = fmap();
      const fA = s.ease('once', 0.6);
      s.alpha(mapA, () => {
        v.paint(1, 0.55 * fA);
        // Overlapping proposals redo the same convolutions.
        const wA = s.win('waste', 'once');
        s.alpha(wA, () => {
          const a: Box = [20, 166, 170, 270];
          const b: Box = [70, 160, 210, 264];
          v.clip(() => {
            v.fill([70, 166, 170, 264], s.tint('red', 0.35));
            v.box(a, s.c('green'), 0.5);
            v.box(b, s.c('green'), 0.5);
          });
          s.text('computed twice', v.X(120), v.Y(166) - u * 3, { size: 3, font: 'mono', weight: 600, color: s.c('red'), halo: true });
        });
        // The feature map: every cell computed once.
        s.alpha(fA, () => {
          for (let a = 0; a < FH; a++)
            for (let b = 0; b < FW; b++) {
              s.rrect(r[0] + b * cs, r[1] + a * cs, cs, cs, 0, { stroke: s.tint('--ink', 0.18), lw: 0.15 });
              s.text(String(f[a * FW + b]), r[0] + (b + 0.5) * cs, r[1] + (a + 0.5) * cs + u * 0.2, { size: Math.min(3.2, (cs / u) * 0.42), font: 'mono', color: s.c('--ink-2') });
            }
        });
        // The proposal, its cells, its bins.
        const roiSeq: [Box, number][] = [[PROP_CAR, 0]];
        if (s.since('sizes') >= 0 && s.since('roi') < 0) roiSeq.push([PROP_DOG, 1]);
        let cur = PROP_CAR;
        if (s.since('any') >= 0) {
          const k = Math.floor(Math.max(0, s.since('any') - 0.2) / 1.3) % 3;
          cur = [PROP_DOG, PROP_PPL, PROP_CAR][k]!;
          roiSeq[0] = [cur, 0];
        }
        const pA = s.ease('proj', 0.5);
        const snap = s.ease('proj', 0.6, 1.4);
        roiSeq.forEach(([pb, i]) => {
          const a = i === 0 ? pA : s.ease('sizes', 0.5, 0.6);
          const cb = toCells(pb);
          s.alpha(a, () => {
            const img: Rect = v.rect(pb);
            const cel: Rect = [r[0] + cb[0] * cs, r[1] + cb[1] * cs, (cb[2] - cb[0]) * cs, (cb[3] - cb[1]) * cs];
            const t = i === 0 ? snap : 1;
            const rr = img.map((q, j) => lerp(q, cel[j]!, t));
            s.rrect(rr[0]!, rr[1]!, rr[2]!, rr[3]!, 0.3, { stroke: s.c('green'), lw: 0.65 });
            if (s.since('sizes') >= 0 && s.since('roi') < 0) {
              const txt = `${cb[2] - cb[0]} × ${cb[3] - cb[1]} cells`;
              chip(s, txt, cel[0], cel[1] - u * 4.6, s.c('green'), { size: 2.6 });
            }
          });
        });
        const binA = s.ease('roi', 0.5);
        const maxA = s.ease('max', 0.5);
        const bins = roiPool(toCells(cur));
        s.alpha(binA, () => {
          bins.forEach((bn, q) => {
            s.rrect(r[0] + bn.xs * cs + u * 0.4, r[1] + bn.ys * cs + u * 0.4, (bn.xe - bn.xs) * cs - u * 0.8, (bn.ye - bn.ys) * cs - u * 0.8, 0.6, { fill: s.tint(BIN_K[q]!, 0.22), stroke: s.tint(BIN_K[q]!, 0.8), lw: 0.3 });
          });
        });
        s.alpha(maxA, () => {
          bins.forEach((bn, q) => s.circle(r[0] + (bn.aj + 0.5) * cs, r[1] + (bn.ai + 0.5) * cs, cs * 0.36, { stroke: s.c(BIN_K[q]!), lw: 0.5 }));
        });
        // The fixed-size output.
        const oc = Math.min(outW / 2.4, u * 9);
        const ox = r[0] + r[2] + u * 4 + (outW - 2 * oc) / 2;
        const oy = r[1] + r[3] / 2 - oc;
        s.alpha(binA, () => {
          s.text('out (2, 2)', ox + oc, oy - u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-2') });
          bins.forEach((bn, q) => {
            const x = ox + (q % 2) * oc;
            const y = oy + Math.floor(q / 2) * oc;
            s.cell(x, y, oc, oc, maxA > 0.5 ? String(bn.v) : '', BIN_K[q]!, { on: maxA, size: 3.4 });
          });
        });
        const eA = s.ease('e2e', 0.5);
        s.alpha(eA, () => {
          const y = oy + 2 * oc + u * 5;
          chip(s, 'class', ox + oc, y, s.c('blue'), { size: 2.7, align: 'center' });
          chip(s, 'box t', ox + oc, y + u * 5.4, s.c('teal'), { size: 2.7, align: 'center' });
        });
        const capY = r[1] + r[3] + u * 6;
        const caps: [string, string, string][] = [
          ['once', 'proj', 'conv features: computed once'],
          ['proj', 'sizes', 'P // 40: image pixels to cells'],
          ['sizes', 'roi', 'different sizes in...'],
          ['roi', 'e2e', '...the same 2 × 2 out'],
          ['e2e', 'smooth', 'one network, end to end'],
        ];
        caps.forEach(([a, b, t]) => s.alpha(s.win(a, b, 0.35), () => s.text(t, r[0] + r[2] / 2, capY, { size: 3.3, font: 'mono', color: s.c('--ink-2') })));
      });
    }

    // Smooth L1 against L2.
    const lA = s.win('smooth', 'fast');
    if (lA > 0) {
      s.alpha(lA, () => {
        const pw = Math.min(w - u * 16, u * 90);
        const ph = Math.min(h * 0.6, pw * 0.62);
        const x0 = (w - pw) / 2;
        const y0 = h * 0.18;
        const X = (e: number) => x0 + ((e + 3) / 6) * pw;
        const Y = (l: number) => y0 + ph - (l / 3) * ph;
        s.line(x0, Y(0), x0 + pw, Y(0), s.c('--axis'), 0.35);
        s.line(X(0), y0, X(0), Y(0), s.c('--axis'), 0.35);
        const curve = (f: (e: number) => number, col: string, lw: number, dash?: number[]) => {
          const c = s.ctx;
          c.save();
          c.beginPath();
          c.rect(x0, y0, pw, ph);
          c.clip();
          c.beginPath();
          for (let i = 0; i <= 120; i++) {
            const e = -3 + (6 * i) / 120;
            if (i) c.lineTo(X(e), Y(f(e)));
            else c.moveTo(X(e), Y(f(e)));
          }
          c.strokeStyle = col;
          c.lineWidth = lw * u;
          c.setLineDash(dash ? dash.map((d) => d * u) : []);
          c.stroke();
          c.restore();
        };
        curve((e) => 0.5 * e * e, s.c('--ink-3'), 0.45, [1.2, 1]);
        const p = s.ease('smooth', 1.4, 0.8);
        curve((e) => (Math.abs(e) < 1 ? 0.5 * e * e : Math.abs(e) - 0.5) * p + 0.5 * e * e * (1 - p), s.c('red'), 0.7);
        s.text('L2: 0.5 e²', X(-1.6), Y(2.6), { size: 3.2, font: 'mono', color: s.c('--ink-3'), halo: true });
        s.alpha(p, () => s.text('smooth L1', X(2.2), Y(1.15), { size: 3.4, font: 'mono', weight: 600, color: s.c('red'), halo: true }));
        s.text('error e', x0 + pw, Y(0) + u * 4, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
        s.alpha(s.ease('smooth', 0.5, 2.2), () => {
          s.text('parabola near 0', X(0), Y(0.62), { size: 2.8, font: 'mono', color: s.c('red'), halo: true });
          s.text('a line beyond', X(-1.95), Y(1.15), { size: 2.8, font: 'mono', align: 'right', color: s.c('red'), halo: true });
        });
      });
    }

    // Speed.
    const sA = s.ease('fast', 0.5);
    if (sA > 0) {
      s.alpha(sA, () => {
        const x0 = w * 0.08 + u * 20;
        const bw = w * 0.84 - u * 22;
        const groups: [string, [string, number, string, string][]][] = [
          ['training', [['R-CNN', 84, '84 h', 'slate'], ['Fast', 9.5, '9.5 h', 'teal']]],
          ['test, per image', [['R-CNN', 47, '47 s', 'slate'], ['Fast', 0.32, '0.32 s', 'teal']]],
        ];
        let y = h * 0.18;
        groups.forEach(([title, bars], gi) => {
          const a = s.ease('fast', 0.5, gi * 2.4);
          s.alpha(a, () => {
            s.text(title, w * 0.08, y, { size: 3.4, align: 'left', font: 'display', weight: 600 });
            bars.forEach(([name, val, lbl, k], bi) => {
              const yy = y + u * 6 + bi * u * 7;
              const max = bars[0]![1];
              const len = Math.max(u * 0.6, (bw * val) / max) * s.ease('fast', 0.8, gi * 2.4 + 0.3);
              s.text(name, x0 - u * 2, yy, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-2') });
              s.rrect(x0, yy - u * 2.2, len, u * 4.4, 0.6, { fill: s.tint(k as 'teal', 0.7) });
              s.text(lbl, x0 + len + u * 1.5, yy, { size: 3, font: 'mono', align: 'left', weight: 600 });
            });
          });
          y += u * 24;
        });
        const bA = s.ease('bottle', 0.5);
        s.alpha(bA, () => {
          const yy = y + u * 2;
          s.text('with proposals', w * 0.08, yy - u * 6, { size: 3.4, align: 'left', font: 'display', weight: 600 });
          const tot = 2.32;
          const len = bw * 0.62;
          const net = (len * 0.32) / tot;
          s.rrect(x0, yy - u * 2.2, net, u * 4.4, 0.4, { fill: s.tint('teal', 0.7) });
          s.rrect(x0 + net, yy - u * 2.2, (len - net) * s.ease('bottle', 0.8, 0.4), u * 4.4, 0.4, { fill: s.tint('red', 0.6) });
          s.text('Fast', x0 - u * 2, yy, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-2') });
          s.text('proposals: 2 s', x0 + len + u * 1.5, yy, { size: 3, font: 'mono', align: 'left', weight: 600, color: s.c('red') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- Faster R-CNN

const LEGEND: [string, 'green' | 'gold' | 'slate'][] = [
  ['> 0.7  object', 'green'],
  ['0.3 to 0.7  ignored', 'gold'],
  ['< 0.3  background', 'slate'],
];

const faster: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = stacked(s);
    const vA = s.win('rpn', 'pipe');
    if (vA > 0) {
      const r = tall ? fit(u * 4, h * 0.1, w - u * 8, h * 0.6) : fit(u * 4, h * 0.09, w * 0.66, h * 0.84);
      const v = View.in(s, r);
      const px = tall ? w / 2 : r[0] + r[2] + (w - r[0] - r[2]) / 2;
      const py = tall ? r[1] + r[3] + u * 6 : r[1] + r[3] * 0.2;
      const pAt = (i: number) => py + i * u * (tall ? 6 : 7.5);
      s.alpha(vA, () => {
        v.paint(1, 0.15);
        const cur = stage(s, ['slide', 'anchor']);
        let si = AT[0];
        let sj = AT[1];
        if (cur === 0) {
          const k = Math.floor(s.prog('slide') * 150 * 0.999);
          si = Math.floor(k / 15);
          sj = k % 15;
        }
        for (let i = 0; i < 10; i++)
          for (let j = 0; j < 15; j++) {
            const on = cur >= 0 && i === si && j === sj;
            s.circle(v.X((j + 0.5) * ANCHOR_STRIDE), v.Y((i + 0.5) * ANCHOR_STRIDE), u * (on ? 1.1 : 0.45), { fill: on ? s.c('purple') : s.tint('--ink', 0.35) });
          }
        const cx = (sj + 0.5) * ANCHOR_STRIDE;
        const cy = (si + 0.5) * ANCHOR_STRIDE;
        s.alpha(s.win('slide', 'shapes'), () => v.box([cx - 48, cy - 48, cx + 48, cy + 48], s.c('purple'), 0.45, [1, 0.8]));
        s.alpha(s.win('slide', 'anchor'), () => s.text('3 × 3 window', px, pAt(0), { size: 3.3, font: 'mono', color: s.c('purple') }));
        s.alpha(s.win('rpn', 'slide'), () => s.text('the network proposes', px, pAt(0), { size: 3.4, font: 'display', italic: true, color: s.c('--ink-2') }));

        // Anchors at one position.
        const aA = s.ease('anchor', 0.5) * (1 - s.ease('fit', 0.5));
        const labelA = s.ease('labels', 0.6);
        s.alpha(aA, () =>
          v.clip(() =>
            AT_ANCHORS.forEach(({ box, v: val }, i) => {
              const single = i === 4;
              const a = single ? 1 : s.ease('shapes', 0.4, 0.3 * i);
              const k = val > 0.7 ? 'green' : val >= 0.3 ? 'gold' : 'slate';
              const col = labelA > 0.5 ? s.c(k) : s.c('green');
              s.alpha(a, () => v.box(box, col, single && labelA < 0.5 ? 0.6 : 0.42, labelA > 0.5 && k === 'slate' ? [0.9, 0.7] : undefined));
            }),
          ),
        );
        s.alpha(s.win('anchor', 'obj'), () => s.text(s.since('shapes') >= 0 ? 'k = 9 anchors' : 'one anchor', px, pAt(0), { size: 3.4, font: 'mono', weight: 600, color: s.c('green') }));
        s.alpha(s.win('obj', 'labels'), () => {
          s.text('per position:', px, pAt(0), { size: 3.2, font: 'mono', color: s.c('--ink-2') });
          s.text('2k = 18 scores', px, pAt(1), { size: 3.4, font: 'mono', weight: 600, color: s.c('blue') });
          s.text('4k = 36 offsets t', px, pAt(2), { size: 3.4, font: 'mono', weight: 600, color: s.c('teal') });
        });
        s.alpha(s.win('labels', 'fit') * labelA, () => {
          const lx = tall ? px - u * 16 : r[0] + r[2] + u * 3;
          LEGEND.forEach(([t, k], i) => {
            const y = pAt(i);
            s.rrect(lx, y - u * 1.4, u * 4, u * 2.8, 0.3, { stroke: s.c(k), lw: 0.45 });
            s.text(t, lx + u * 6, y, { size: 3, font: 'mono', align: 'left', color: s.c(k) });
          });
        });
        // Each object's best anchor: one square, then nine shapes.
        const fA = s.ease('fit', 0.5);
        if (fA > 0) {
          const nine = s.t >= cue(s, 'faster', 'fit', 'Nine') - 0.2;
          const best = nine ? BEST_NINE : BEST_ONE;
          const placed: Rect[] = [];
          s.alpha(fA, () => {
            OBJECTS.forEach((o) => v.box(o.box, s.tint(clsK(o.cls), 0.6), 0.35, [1.2, 0.9]));
            best.forEach(({ box, v: val }, i) => {
              const pos = s.since('best') >= 0;
              v.clip(() => v.box(box, s.c(pos ? 'green' : nine ? 'green' : 'slate'), pos ? 0.7 : 0.5));
              boxChip(v, box, val.toFixed(2), s.c(pos ? 'green' : clsK(OBJECTS[i]!.cls)), placed, 2.5);
            });
            const lbl = nine ? '9 shapes: 0.54 to 0.67' : '1 square: 0.23 to 0.50';
            s.text(s.since('best') >= 0 ? 'best anchor = positive' : lbl, px, pAt(0), { size: 3.2, font: 'mono', weight: 600, color: s.c(nine ? 'green' : 'slate') });
          });
        }
      });
    }

    // One network, four losses.
    const dA = s.win('pipe', 'speed');
    if (dA > 0) {
      s.alpha(dA, () => {
        const bw = Math.min(u * 18, (w - u * 20) / 5);
        const gap = u * 3;
        const total = 5 * bw + 4 * gap;
        const x0 = (w - total) / 2;
        const cy = h * 0.42;
        const bh = u * 12;
        const names: [string, 'orange' | 'slate' | 'green' | 'teal' | 'blue'][] = [
          ['img', 'orange'],
          ['ConvNet', 'slate'],
          ['RPN', 'green'],
          ['RoI pool', 'teal'],
          ['heads', 'blue'],
        ];
        names.forEach(([n, k], i) => {
          const a = s.ease('pipe', 0.4, 0.3 * i);
          const x = x0 + i * (bw + gap);
          s.alpha(a, () => {
            block(s, x, cy - bh / 2, bw, bh, n, k, { size: 3.1 });
            if (i) s.arrow(x - gap + u * 0.5, cy, x - u * 0.5, cy, s.c('--ink-3'), 0.3, 1.3);
          });
        });
        s.alpha(s.ease('pipe', 0.5, 1.6), () => {
          const a = x0 + 1 * (bw + gap) + bw / 2;
          const b = x0 + 3 * (bw + gap) + bw / 2;
          const c = s.ctx;
          c.beginPath();
          c.moveTo(a, cy - bh / 2);
          c.bezierCurveTo(a, cy - bh * 1.8, b, cy - bh * 1.8, b, cy - bh / 2 - u * 0.6);
          c.strokeStyle = s.tint('slate', 0.8);
          c.lineWidth = 0.35 * u;
          c.setLineDash([u, u * 0.8]);
          c.stroke();
          c.setLineDash([]);
          s.text('shared features', (a + b) / 2, cy - bh * 1.55, { size: 2.8, font: 'mono', color: s.c('slate'), halo: true });
        });
        const losses: [number, string][] = [
          [2, 'objectness'],
          [2, 'offsets'],
          [4, 'class'],
          [4, 'box'],
        ];
        losses.forEach(([bi, n], i) => {
          const a = s.ease('pipe', 0.4, 2.6 + 0.4 * i);
          const x = x0 + bi * (bw + gap) + bw / 2;
          const y = cy + bh / 2 + u * 5 + (i % 2) * u * 6;
          s.alpha(a, () => {
            s.circle(x - u * 7, y, u * 1, { fill: s.c('red') });
            s.text(n, x - u * 5.4, y, { size: 3, font: 'mono', align: 'left', color: s.c('red') });
          });
        });
        s.alpha(s.ease('pipe', 0.5, 4.4), () => s.text('one network, four losses', w / 2, cy + bh / 2 + u * 22, { size: 3.6, font: 'display', italic: true, color: s.c('--ink-2') }));
      });
    }

    const sA = s.ease('speed', 0.5);
    if (sA > 0) {
      s.alpha(sA, () => {
        const rows: [string, number, string, 'slate' | 'teal' | 'green'][] = [
          ['R-CNN', 50, '~50 s', 'slate'],
          ['Fast R-CNN', 2, '~2 s', 'teal'],
          ['Faster R-CNN', 0.2, '~0.2 s', 'green'],
        ];
        const x0 = w * 0.08 + u * 24;
        const bw = w * 0.84 - u * 34;
        s.text('test time per image, log scale', w / 2, h * 0.2, { size: 3.4, font: 'display', weight: 600 });
        rows.forEach(([n, t, lbl, k], i) => {
          const y = h * 0.34 + i * u * 11;
          const len = (bw * Math.log10(t / 0.05)) / Math.log10(50 / 0.05);
          const a = s.ease('speed', 0.6, 0.3 * i);
          s.alpha(a, () => {
            s.text(n, x0 - u * 2, y, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-2') });
            s.rrect(x0, y - u * 2.6, len * a, u * 5.2, 0.6, { fill: s.tint(k, 0.7) });
            s.text(lbl, x0 + len * a + u * 1.5, y, { size: 3.2, font: 'mono', align: 'left', weight: 600 });
          });
        });
        s.alpha(s.ease('speed', 0.5, 1.6), () => s.text('same accuracy: 66.9 mAP', w / 2, h * 0.34 + u * 36, { size: 3.4, font: 'mono', color: s.c('green'), weight: 600 }));
      });
    }
  },
};

// ---------------------------------------------------------------- YOLO

const DOG_CELL = centerCell(OBJECTS[3]!.box, 7);

/** Grid lines of an S x S grid over the view, drawn in up to fraction p. */
function gridLines(v: View, S: number, col: string, lw = 0.3, p = 1): void {
  const s = v.s;
  for (let i = 1; i < S; i++) {
    const a = clamp01(p * S - (i - 1) * 0.6);
    if (a <= 0) continue;
    s.line(v.X((SCENE_W * i) / S), v.y, v.X((SCENE_W * i) / S), v.y + v.h * a, col, lw);
    s.line(v.x, v.Y((SCENE_H * i) / S), v.x + v.w * a, v.Y((SCENE_H * i) / S), col, lw);
  }
}

function cellBox(r: number, c: number, S: number): Box {
  return [(c * SCENE_W) / S, (r * SCENE_H) / S, ((c + 1) * SCENE_W) / S, ((r + 1) * SCENE_H) / S];
}

const yolo: SceneDef = {
  marks: {
    score: { tex: String.raw`\sym{s}{s_c} = \text{conf} \cdot \Pr(c \mid \text{object})`, x: 0.5, y: 0.5, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const tall = stacked(s);
    const mainA = 1 - s.ease('ssd', 0.5);
    const r = tall ? fit(u * 4, h * 0.1, w - u * 8, h * 0.6) : fit(u * 4, h * 0.09, w * 0.64, h * 0.84);
    const v = View.in(s, r);
    const px = tall ? w / 2 : r[0] + r[2] + (w - r[0] - r[2]) / 2;
    const py = tall ? r[1] + r[3] + u * 6 : r[1] + r[3] * 0.2;
    s.alpha(mainA, () => {
      v.paint(1, 0.1);
      const weak = s.since('weak') >= 0;
      const S = weak ? 3 : 7;
      const gA = s.ease('grid', 0.4);
      s.alpha(gA, () => gridLines(v, S, s.tint('--ink', 0.55), 0.3, weak ? 1 : s.prog('grid') * 1.4));
      // Responsible cells and object centers.
      const rA = s.win('resp', 'classes');
      OBJECTS.forEach((o) => {
        const [ri, ci] = centerCell(o.box, S);
        const [cx, cy] = cxcywh(o.box);
        s.alpha(rA * s.ease('resp', 0.4, 0.8), () => v.fill(cellBox(ri, ci, S), s.tint(clsK(o.cls), 0.35)));
        s.alpha((rA + (weak ? 1 : 0)) * s.ease('resp', 0.4, 0.4), () => s.circle(v.X(cx), v.Y(cy), u * 1.1, { fill: s.c(clsK(o.cls)), stroke: s.c('--card'), lw: 0.3 }));
      });
      // Every box of every cell, thickness by confidence.
      const bA = s.win('boxes', 'score');
      if (bA > 0) {
        v.clip(() =>
          YOLO7.forEach((cell) =>
            cell.boxes.forEach(({ b, conf }) => {
              const dog = cell.r === DOG_CELL[0] && cell.c === DOG_CELL[1];
              s.alpha(bA * (dog ? 1 : 0.25 + conf * 0.7), () => v.box(b, s.c(dog ? 'purple' : '--ink-3'), dog ? 0.65 : 0.12 + conf * 0.6));
            }),
          ),
        );
        s.alpha(bA, () => v.box(cellBox(DOG_CELL[0], DOG_CELL[1], 7), s.c('purple'), 0.45));
      }
      // The class map.
      const cA = s.win('classes', 'score');
      s.alpha(cA * 0.5, () => YOLO7.forEach((cell) => cell.cls && v.fill(cellBox(cell.r, cell.c, 7), s.tint(clsK(cell.cls), 0.6))));
      // After scores, threshold and NMS.
      const fA = s.win('score', 'weak');
      if (fA > 0) {
        const placed: Rect[] = [];
        s.alpha(fA * s.ease('score', 0.5, 1.4), () => {
          OBJECTS.forEach((o, i) => {
            const b = YOLO7.find((c) => c.r === centerCell(o.box, 7)[0] && c.c === centerCell(o.box, 7)[1])!.boxes[0]!.b;
            v.box(b, s.c(clsK(o.cls)), 0.6);
            boxChip(v, b, `${o.name} ${[0.84, 0.79, 0.72, 0.81, 0.66][i]}`, s.c(clsK(o.cls)), placed, 2.5);
          });
        });
      }
      // A coarse grid: one cell, two animals.
      const wA = s.ease('weak', 0.5, 0.6);
      if (weak) {
        const [ri, ci] = centerCell(OBJECTS[3]!.box, 3);
        s.alpha(wA, () => {
          v.fill(cellBox(ri, ci, 3), s.tint('red', 0.22));
          v.box(cellBox(ri, ci, 3), s.c('red'), 0.6);
          const cb = cellBox(ri, ci, 3);
          chip(s, 'one cell: dog or cat?', v.X(cb[0]) + u, v.Y(cb[1]) - u * 5, s.c('red'), { size: 2.7 });
        });
      }
      // Panel.
      const step = u * (tall ? 6 : 7.5);
      s.alpha(s.win('two', 'grid'), () => s.text('one pass: image in, boxes out', px, py, { size: 3.3, font: 'display', italic: true, color: s.c('--ink-2') }));
      s.alpha(s.win('grid', 'boxes'), () => s.text('S × S = 7 × 7 cells', px, py, { size: 3.4, font: 'mono', weight: 600 }));
      const vecA = s.win('boxes', 'score');
      if (vecA > 0) {
        s.alpha(vecA, () => {
          const n = s.since('classes') >= 0 ? 14 : 10;
          const cw = Math.min(u * 6.4, ((tall ? w - u * 10 : w - r[0] - r[2] - u * 6) / 14) * 0.95);
          const x0 = px - (n * cw) / 2;
          const labels = ['x', 'y', 'w', 'h', 'c', 'x', 'y', 'w', 'h', 'c', 'car', 'per', 'dog', 'cat'];
          const ks = (i: number) => (i < 10 ? (i % 5 === 4 ? 'purple' : 'teal') : clsK(i - 9));
          if (s.since('tensor') < 0) {
            for (let i = 0; i < n; i++) {
              const a = i < 10 ? 1 : s.ease('classes', 0.4, 0.2 * (i - 10));
              s.alpha(a, () => s.cell(x0 + i * cw, py - u * 2.6, cw, u * 5.2, labels[i]!, ks(i), { size: Math.min(2.6, (cw / u) * 0.42) }));
            }
            s.text(s.since('classes') >= 0 ? '2 boxes × 5, + C classes' : '2 boxes × 5 numbers', px, py + step * 0.95, { size: 2.8, font: 'mono', color: s.c('--ink-2') });
          }
        });
      }
      const tA = s.win('tensor', 'score');
      s.alpha(tA, () => {
        const sz = tall ? u * 2.5 : u * 3;
        const d = sz * 3;
        const bx = px - (7 * sz + d) / 2 - (tall ? u * 8 : 0);
        const by = tall ? py + u * 0.5 : py;
        const c = s.ctx;
        const face = (pts: number[]) => {
          c.beginPath();
          c.moveTo(pts[0]!, pts[1]!);
          for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i]!, pts[i + 1]!);
          c.closePath();
          c.fillStyle = s.tint('teal', 0.12);
          c.fill();
          c.strokeStyle = s.tint('teal', 0.8);
          c.lineWidth = 0.3 * u;
          c.stroke();
        };
        const f = 7 * sz;
        face([bx, by, bx + d, by - d * 0.6, bx + d + f, by - d * 0.6, bx + f, by]);
        face([bx + f, by, bx + f + d, by - d * 0.6, bx + f + d, by - d * 0.6 + f, bx + f, by + f]);
        for (let i = 0; i < 7; i++)
          for (let j = 0; j < 7; j++) s.rrect(bx + j * sz, by + i * sz, sz, sz, 0, { fill: s.tint('teal', 0.18), stroke: s.tint('teal', 0.6), lw: 0.15 });
        if (tall) s.text('7 × 7 × 30', bx + f + d + u * 2.5, by + f / 2 - d * 0.3, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('teal') });
        else s.text('7 × 7 × 30', bx + (f + d) / 2, by + f + u * 5, { size: 3.4, font: 'mono', weight: 650, color: s.c('teal') });
      });
      s.show('score', s.win('score', 'fast') * mainA, { x: px / w, y: (tall ? py + u * 2 : py + u * 4) / h });
      const qA = s.win('fast', 'weak');
      s.alpha(qA, () => {
        const rows: [string, string][] = [
          ['YOLO          45 fps', 'green'],
          ['Faster R-CNN   7 fps', 'slate'],
          ['mAP  63.4 vs 73.2', '--ink-2'],
        ];
        rows.forEach(([t, k], i) => s.alpha(s.ease('fast', 0.4, 0.5 * i), () => s.text(t, px, py + i * step * 0.9, { size: 3.2, font: 'mono', weight: 600, color: s.c(k as 'green') })));
      });
      s.alpha(s.ease('weak', 0.5, 1.5), () => s.text('S = 3: one class guess per cell', px, py, { size: 3.2, font: 'mono', color: s.c('red'), weight: 600 }));
    });

    // SSD: predictions from feature maps of several resolutions.
    const dA = s.ease('ssd', 0.6);
    if (dA > 0) {
      s.alpha(dA, () => {
        const grids: [number, string, Box | null][] = [
          [3, 'coarse map', OBJECTS[0]!.box],
          [6, 'middle map', OBJECTS[3]!.box],
          [12, 'fine map', OBJECTS[4]!.box],
        ];
        const gap = u * 3;
        const col = s.w < s.h * 1.15;
        const top = Math.max(h * 0.08, u * 7);
        const vw = col ? Math.min((w - u * 8) * 0.55, (((h - top - u * 4 - 2 * gap) / 3) * 1.5)) : (w - u * 8 - gap * 2) / 3;
        const vh = vw / 1.5;
        grids.forEach(([S, name, b], i) => {
          const a = s.ease('ssd', 0.5, 0.8 + 0.6 * i);
          const vx = col ? u * 4 : u * 4 + i * (vw + gap);
          const vy = col ? top + i * (vh + gap) : h * 0.3;
          const gv = new View(s, vx, vy, vw);
          s.alpha(a, () => {
            gv.paint(1, 0.15);
            gridLines(gv, S, s.tint('--ink', 0.5), 0.2);
            if (b) {
              const o = OBJECTS.find((q) => q.box === b)!;
              const [ri, ci] = centerCell(b, S);
              gv.fill(cellBox(ri, ci, S), s.tint(clsK(o.cls), 0.4));
              gv.box(b, s.c(clsK(o.cls)), 0.5);
            }
            if (col) {
              s.text(name, vx + vw + u * 3, vy + vh / 2 - u * 2.4, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
              s.text(`${S} × ${S} cells`, vx + vw + u * 3, vy + vh / 2 + u * 2.6, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
            } else s.text(`${name}, ${S} × ${S}`, vx + vw / 2, vy + vh + u * 4, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
          });
        });
        s.alpha(s.ease('ssd', 0.5, 2.6), () => {
          const msg = 'fine maps catch small objects';
          if (col) s.text(msg, u * 4 + vw + u * 3, top + 3 * vh + 2 * gap - u * 1, { size: 2.9, font: 'display', italic: true, align: 'left', color: s.c('--ink-2') });
          else s.text(msg, w / 2, h * 0.3 + vh + u * 13, { size: 3.4, font: 'display', italic: true, color: s.c('--ink-2') });
        });
      });
    }
  },
};

export { rcnn, fast, faster, yolo };
