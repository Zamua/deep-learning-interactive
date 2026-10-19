import { fmt } from '../../core/code';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { type Box, OBJECTS, SCENE_CLASSES, iou, sceneMasks } from '../../lib/detection-scene';
import { BY_SCORE, CANDIDATES, NMS_03, NMS_05, NMS_065, type NmsStep } from './data';
import { type Rect, View, after, boxChip, cells, check, chip, clsK, cue, fit, labelImage, lerpBox, pill, sceneCrop, stage, trapezoid, stacked } from './kit';

// ---------------------------------------------------------------- intro

const TASKS = ['classify', 'localize', 'detect', 'semantic', 'instance'];
const TASK_BEATS = ['cls', 'loc', 'det', 'sem', 'inst'];
const OUTPUTS = ['1 label', '1 label + 4 numbers', '5 × (label, score, 4 numbers)', '153,600 labels, one per pixel', '5 masks + 5 labels'];
const DET_SCORES = [0.98, 0.95, 0.9, 0.93, 0.86];
const INST_COLORS = ['red', 'blue', 'teal', 'orange', 'purple'] as const;

function semImage(s: Scene): HTMLCanvasElement {
  const m = sceneMasks(2);
  return labelImage('cls', m.cls, m.w, m.h, [null, ...[1, 2, 3, 4].map((c) => s.c(clsK(c)))]);
}
function instImage(s: Scene): HTMLCanvasElement {
  const m = sceneMasks(2);
  return labelImage('inst', m.inst, m.w, m.h, [null, ...INST_COLORS.map((k) => s.c(k))]);
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'sofar'), () => {
      s.text('Localization, detection', w / 2, h * 0.4, { size: 7.4, font: 'display', weight: 600 });
      s.text('and segmentation', w / 2, h * 0.4 + u * 9.5, { size: 7.4, font: 'display', weight: 600 });
      s.text('from what to where', w / 2, h * 0.4 + u * 19, { size: 4.4, italic: true, color: s.c('--ink-2') });
    });

    // Two classifier answers: one label each.
    const soA = s.win('sofar', 'messy');
    if (soA > 0) {
      const th = Math.min(h * 0.42, u * 38);
      const crops: [Box, string, number, string][] = [
        [[10, 158, 210, 278], 'car', 1, 'car'],
        [[402, 184, 474, 278], 'cat', 4, 'cat'],
      ];
      const ws = crops.map(([b]) => (th * (b[2] - b[0])) / (b[3] - b[1]));
      const gap = u * 10;
      let x = (w - ws[0]! - ws[1]! - gap) / 2;
      crops.forEach(([b, name, cls, word], i) => {
        const a = soA * after(s, cue(s, 'intro', 'sofar', word, 1) - 0.4, 0.5);
        const y = h * 0.44 - th / 2;
        s.alpha(a, () => {
          sceneCrop(s, b, [x, y, ws[i]!, th]);
          s.rrect(x, y, ws[i]!, th, 1, { stroke: s.c('--rule'), lw: 0.3 });
          chip(s, `this is a ${name}`, x + ws[i]! / 2, y + th + u * 3, s.c(clsK(cls)), { size: 3.4, align: 'center' });
        });
        x += ws[i]! + gap;
      });
    }

    const vA = s.ease('messy', 0.6);
    if (vA <= 0) return;
    const tall = stacked(s);
    const r = tall ? fit(u * 4, h * 0.1, w - u * 8, h * 0.62) : fit(u * 4, h * 0.1, w * 0.68, h * 0.74);
    const v = View.in(s, r);
    v.paint(vA);

    // The objects, named one by one.
    const objA = vA * (1 - s.ease('cls', 0.5));
    if (objA > 0) {
      const words = ['car', 'people', 'people', 'dog', 'cat'];
      const placed: Rect[] = [];
      OBJECTS.forEach((o, i) => {
        const a = objA * after(s, cue(s, 'intro', 'messy', words[i]!) - 0.2, 0.4);
        s.alpha(a, () => {
          v.box(o.box, s.c(clsK(o.cls)), 0.55);
          boxChip(v, o.box, o.name, s.c(clsK(o.cls)), placed, 2.8);
        });
      });
      s.alpha(s.win('where', 'ladder') * objA, () => {
        const y = tall ? r[1] + r[3] + u * 9 : r[1] + r[3] + u * 7;
        s.text('where is each one?', r[0] + r[2] / 2, y, { size: 5, font: 'display', italic: true, color: s.c('--accent') });
      });
    }

    // The ladder of tasks.
    const lA = s.ease('ladder', 0.5);
    if (lA > 0) {
      const cur = stage(s, TASK_BEATS);
      TASKS.forEach((name, i) => {
        const a = lA * s.ease('ladder', 0.4, 0.25 * i);
        const on = cur === i ? 1 : 0;
        s.alpha(a, () => {
          let x: number;
          let y: number;
          if (tall) {
            const cw = (w - u * 8) / 5;
            x = u * 4 + cw * (i + 0.5);
            y = r[1] + r[3] + u * 7;
          } else {
            x = r[0] + r[2] + (w - r[0] - r[2]) / 2;
            y = r[1] + r[3] * (0.9 - 0.2 * i);
          }
          const k = on ? '--accent' : '--ink-3';
          pill(s, name, x, y, k, { size: tall ? 2.9 : 3.4, fill: on ? 0.18 : 0.05 });
          if (!tall && i < 4) s.alpha(0.5, () => s.line(x, y - r[3] * 0.045, x, y - r[3] * 0.155, s.c('--rule'), 0.3));
        });
      });
      if (cur >= 0) {
        const oy = tall ? r[1] + r[3] + u * 16 : r[1] + r[3] + u * 6;
        TASK_BEATS.forEach((b, i) => {
          const a = s.win(b, TASK_BEATS[i + 1], 0.4);
          s.alpha(a, () => s.text(`output: ${OUTPUTS[i]}`, r[0] + r[2] / 2, oy, { size: 3.4, font: 'mono', color: s.c('--ink-2') }));
        });
      }
    }

    // Each task's answer drawn on the scene.
    const tA = (i: number) => s.win(TASK_BEATS[i]!, TASK_BEATS[i + 1], 0.45);
    s.alpha(tA(0), () => chip(s, 'label: car', r[0] + u * 2, r[1] + u * 2, s.c('red'), { size: 3.6 }));
    s.alpha(tA(1), () => {
      const o = OBJECTS[0]!;
      v.box(o.box, s.c('red'), 0.6);
      boxChip(v, o.box, 'car', s.c('red'), [], 3);
    });
    s.alpha(tA(2), () => {
      const placed: Rect[] = [];
      OBJECTS.forEach((o) => v.box(o.box, s.c(clsK(o.cls)), 0.55));
      OBJECTS.forEach((o, i) => boxChip(v, o.box, `${o.name} ${DET_SCORES[i]}`, s.c(clsK(o.cls)), placed, 2.6));
    });
    const semA = tA(3);
    if (semA > 0) v.overlay(semImage(s), semA * 0.62);
    const instA = tA(4);
    if (instA > 0) v.overlay(instImage(s), instA * 0.62);
  },
};

// ---------------------------------------------------------------- localization

const GT: Box = [24, 176, 196, 266];
const PRED: Box = [22, 172, 204, 257];
const xywh = (b: Box) => [b[0], b[1], b[2] - b[0], b[3] - b[1]];
const PV = xywh(PRED);
const GV = xywh(GT);
const ERR = PV.map((p, i) => p - GV[i]!);

const localize: SceneDef = {
  marks: {
    l2: { tex: String.raw`\symL_{\text{box}} = \lVert \symbp - \symbg \rVert^2`, x: 0.5, y: 0.5, size: 4.6 },
    multi: { tex: String.raw`\symL = \symL_{\text{cls}} + \lambda\, \symL_{\text{box}}`, x: 0.5, y: 0.74, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const tall = stacked(s);

    // Phase A: one box, its four numbers, and the L2 loss.
    const aA = s.win('one', 'head');
    if (aA > 0) {
      const r = tall ? fit(u * 4, h * 0.1, w - u * 8, h * 0.52) : fit(u * 4, h * 0.09, w - u * 8, h * 0.5);
      const v = View.in(s, r, [0, 116, 240]);
      s.alpha(aA, () => {
        v.paint(1);
        const pA = s.ease('four', 0.5);
        const gA = s.ease('truth', 0.5);
        v.clip(() => {
          s.alpha(gA, () => v.box(GT, s.c('gold'), 0.55, [1.6, 1.1]));
          s.alpha(pA, () => v.box(PRED, s.c('purple'), 0.6));
        });
        // x, y, w, h on the predicted box.
        const dA = pA * (1 - s.ease('truth', 0.5));
        s.alpha(dA, () => {
          const [bx, by, bw, bh] = v.rect(PRED);
          const ink = s.c('purple');
          s.text('x', bx - u * 2, by + bh * 0.5, { size: 3.6, italic: true, weight: 650, color: ink, halo: true });
          s.text('y', bx + bw * 0.5, by - u * 2.2, { size: 3.6, italic: true, weight: 650, color: ink, halo: true });
          s.arrow(bx + bw * 0.3, by + bh + u * 2.2, bx + bw, by + bh + u * 2.2, ink, 0.35, 1.6);
          s.arrow(bx + bw * 0.3, by + bh + u * 2.2, bx, by + bh + u * 2.2, ink, 0.35, 1.6);
          s.text('w', bx + bw * 0.3, by + bh + u * 4.6, { size: 3.4, italic: true, weight: 650, color: ink, halo: true });
          s.arrow(bx + bw - u * 2.4, by + bh * 0.5, bx + bw - u * 2.4, by, ink, 0.35, 1.6);
          s.arrow(bx + bw - u * 2.4, by + bh * 0.5, bx + bw - u * 2.4, by + bh, ink, 0.35, 1.6);
          s.text('h', bx + bw - u * 4.4, by + bh * 0.5, { size: 3.4, italic: true, weight: 650, color: ink, halo: true });
        });
        s.alpha(gA, () => {
          const [gx, gy, gw] = v.rect(GT);
          s.text('b*', gx + gw - u * 4, gy - u * 2.4, { size: 3.8, italic: true, weight: 650, color: s.c('gold'), halo: true });
          const [px, py] = v.rect(PRED);
          s.text('b̂', px + u * 3, py - u * 2.4, { size: 3.8, italic: true, weight: 650, color: s.c('purple'), halo: true });
        });

        // The numbers.
        const cw = u * 9.5;
        const ch = u * 5.6;
        const lab = u * 10;
        const tw = lab + 4 * cw + 3 * u * 0.8;
        const x0 = (w - tw - u * 14) / 2 + lab;
        const y0 = r[1] + r[3] + u * 3;
        const rows: [string, string[], string, string][] = [
          ['b̂', PV.map(String), 'purple', 'regress'],
          ['b*', GV.map(String), 'gold', 'truth'],
          ['err', ERR.map(String), 'teal', 'err'],
          ['err²', ERR.map((e) => String(e * e)), 'red', 'square'],
        ];
        rows.forEach(([name, vals, k, beat], ri) => {
          const y = y0 + ri * (ch + u * 1.1);
          const stagger = beat === 'err' || beat === 'square';
          const ra = s.ease(beat, 0.4);
          s.alpha(ra, () => s.text(name, x0 - u * 2, y + ch / 2, { size: 3.6, italic: name.length < 3, font: name.length < 3 ? 'serif' : 'mono', weight: 600, align: 'right', color: s.c(k as 'gold') }));
          cells(s, x0, y, cw, ch, vals, k as 'gold', {
            gap: u * 0.8,
            size: 3.3,
            a: (i) => (stagger ? s.ease(beat, 0.35, 0.45 + i * 0.55) : ra),
            on: (i) => (stagger && s.since(beat) < 0.45 + i * 0.55 + 0.6 && s.since(beat) > 0.45 + i * 0.55 ? 1 : 0),
          });
        });
        const sA = s.ease('sum', 0.5, 0.3);
        s.alpha(sA, () => {
          const y = y0 + 3 * (ch + u * 1.1) + ch / 2;
          pill(s, 'sum = 145', x0 + 4 * cw + 3 * u * 0.8 + u * 2, y, 'red', { size: 3.4, align: 'left' });
        });
        if (!tall) s.show('l2', aA * s.ease('sum', 0.6, 1.2), { x: 0.5, y: (y0 + 4 * (ch + u * 1.1) + u * 5) / h });
      });
    }

    // Phase B: one body, two heads, two losses.
    const bA = s.ease('head', 0.6);
    if (bA <= 0) return;
    s.alpha(bA, () => {
      const U = u * Math.min(1.25, (w / u - 10) / 96);
      const x0 = (w - U * 96) / 2;
      const cy = h * 0.34;
      const iw = U * 20;
      const iv = new View(s, x0, cy - iw / 1.5 / 2, iw);
      iv.paint(1);
      s.rrect(iv.x, iv.y, iv.w, iv.h, 1.2, { stroke: s.c('orange'), lw: 0.45 });
      s.text('img', iv.x + iv.w / 2, iv.y + iv.h + U * 3, { size: 3, font: 'mono', color: s.c('orange') });
      const tx = x0 + iw + U * 4;
      s.arrow(x0 + iw + U * 0.6, cy, tx - U * 0.6, cy, s.c('--ink-3'), 0.35, 1.6);
      trapezoid(s, tx, cy - U * 13, U * 22, U * 26, 'slate', 0.4, 'ConvNet', 3.3);
      s.text('pretrained', tx + U * 10, cy + U * 4.5, { size: 2.7, font: 'mono', color: s.c('--ink-3') });
      const hx = tx + U * 27;
      const headW = U * 15;
      const heads: [number, string, 'blue' | 'purple', string][] = [
        [cy - U * 11, 'scores', 'blue', 'what?'],
        [cy + U * 11, 'box', 'purple', 'where?'],
      ];
      const both = s.ease('both', 0.5);
      heads.forEach(([y, name, k, q], i) => {
        s.arrow(tx + U * 22.6, cy, hx - U * 0.6, y, s.c('--ink-3'), 0.35, 1.6);
        s.rrect(hx, y - U * 3.6, headW, U * 7.2, 1.4, { fill: s.tint(k, 0.12), stroke: s.c(k), lw: 0.4 });
        s.text(name, hx + headW / 2, y + U * 0.2, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
        s.alpha(both, () => s.text(q, hx + headW / 2, y + (i === 0 ? -U * 6.4 : U * 6.6), { size: 3.5, font: 'display', italic: true, color: s.c('--ink-2') }));
      });
      // Outputs of each head.
      const ox = hx + headW + U * 3;
      [0.25, 0.9, 0.35, 0.15, 0.5].forEach((b, i) => {
        const bh = U * 7 * b * s.ease('both', 0.5, 0.2 + 0.08 * i);
        s.rrect(ox + i * U * 3, cy - U * 7.6 - bh, U * 2.2, bh, 0.3, { fill: s.c(i === 1 ? 'blue' : '--ink-3') });
      });
      const spec = s.ease('specific', 0.6, 1.2);
      const rowsN = Math.round(lerp(1, 5, spec));
      for (let rI = 0; rI < rowsN; rI++) {
        const ra = rI === 0 ? s.ease('both', 0.5, 0.5) : clamp01(spec * 5 - rI);
        const kk = rI === 0 ? 'purple' : clsK(rI);
        s.alpha(ra, () => cells(s, ox, cy + U * 8 + rI * U * 3.9 - (rowsN > 1 ? U * 4.5 : 0) - U * 3, U * 3.6, U * 3.2, ['', '', '', ''], spec > 0.5 && rI > 0 ? kk : 'purple', { gap: U * 0.5 }));
      }
      s.alpha(s.ease('specific', 0.5, 0.3), () => {
        const lbl = spec > 0.5 ? 'class-specific: C × 4' : 'class-agnostic: 4';
        s.text(lbl, ox + U * 8, cy + U * 25, { size: 3, font: 'mono', color: s.c('--ink-2') });
      });
      // The two losses.
      const mA = s.ease('multi', 0.6);
      s.show('multi', bA * mA * (1 - s.ease('specific', 0.5)), { y: (cy + U * 32) / h });
      const lamA = s.win('lam', 'specific');
      s.alpha(lamA, () => {
        const y = cy + U * 44;
        const x1 = w / 2 - U * 28;
        const x2 = w / 2 + U * 28;
        s.line(x1, y, x2, y, s.c('--rule'), 0.6);
        const p = smooth(s.prog('lam') * 1.2);
        const kx = lerp(x1 + U * 4, x2 - U * 4, p);
        s.circle(kx, y, U * 1.6, { fill: s.c('slate') });
        s.text('λ', kx, y - U * 3.6, { size: 3.6, italic: true, weight: 650, color: s.c('slate') });
        s.text('sloppy boxes', x1, y + U * 4, { size: 3, align: 'left', color: s.c('--ink-2'), font: 'mono' });
        s.text('worse classes', x2, y + U * 4, { size: 3, align: 'right', color: s.c('--ink-2'), font: 'mono' });
      });
    });
  },
};

// ---------------------------------------------------------------- IoU

const DOG = OBJECTS[3]!.box;
const B0: Box = [290, 196, 380, 262];
const FAR: Box = [392, 154, 472, 198];
const NOV: Box = [296, 152, 386, 204];
const SHIFT: Box = [DOG[0] + 24, DOG[1], DOG[2] + 24, DOG[3]];
const BIG: Box = [250, 160, 460, 305];
const boxArea = (b: Box) => (b[2] - b[0]) * (b[3] - b[1]);

/** The purple box at scene time t. */
function iouBox(s: Scene): Box {
  let b = B0;
  const go = (to: Box, t0: number, dur: number) => {
    const p = after(s, t0, dur);
    if (p > 0) b = lerpBox(b, to, p);
  };
  go(DOG, cue(s, 'iou', 'want', 'perfect') - 0.3, 0.7);
  go(FAR, cue(s, 'iou', 'want', 'zero') - 0.2, 0.7);
  go(B0, cue(s, 'iou', 'want', 'fair') - 0.1, 0.8);
  go(NOV, s.at('clamp') + 0.2, 0.9);
  go(B0, s.at('union'), 0.8);
  go(DOG, s.at('shift'), 0.8);
  go(SHIFT, cue(s, 'iou', 'shift', 'quarter') - 0.2, 1.0);
  go(BIG, s.at('big'), 1.2);
  go(B0, s.at('tau'), 1.0);
  return b;
}

const iouScene: SceneDef = {
  marks: {
    def: { tex: String.raw`\operatorname{IoU}(\symbp, \symbg) = \frac{I}{U}`, x: 0.5, y: 0.5, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const tall = stacked(s);
    const r = tall ? fit(u * 4, h * 0.1, w - u * 8, h * 0.6) : fit(u * 4, h * 0.1, w * 0.62, h * 0.84);
    const v = View.in(s, r, [232, 150, 248]);
    v.paint(1);
    const b = iouBox(s);
    const ix1 = Math.max(b[0], DOG[0]);
    const iy1 = Math.max(b[1], DOG[1]);
    const ix2 = Math.min(b[2], DOG[2]);
    const iy2 = Math.min(b[3], DOG[3]);
    const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
    const union = boxArea(b) + boxArea(DOG) - inter;
    const val = inter / union;
    s.slot('iou', fmt(val, 2));

    v.clip(() => {
      const uA = s.ease('union', 0.5) * (1 - s.ease('shift', 0.5) * 0.4);
      s.alpha(uA, () => {
        v.fill(b, s.tint('gold', 0.26));
        v.fill(DOG, s.tint('gold', 0.26));
      });
      const iA = s.ease('inter', 0.5);
      if (inter > 0) s.alpha(iA, () => v.fill([ix1, iy1, ix2, iy2], s.tint('teal', 0.55)));
      v.box(DOG, s.c('gold'), 0.55, [1.6, 1.1]);
      v.box(b, s.c('purple'), 0.6);
    });
    const [px, py] = v.rect(b);
    const [gx, gy, gw, gh] = v.rect(DOG);
    s.text('b*', gx + gw + u * 2.6, gy + gh - u * 2, { size: 3.8, italic: true, weight: 650, color: s.c('gold'), halo: true });
    if (py > v.y + u * 3) s.text('b̂', px + u * 2.5, py - u * 2.4, { size: 3.8, italic: true, weight: 650, color: s.c('purple'), halo: true });

    // The edges of the intersection.
    const eA = s.win('edges', 'clamp');
    s.alpha(eA, () => {
      const c = s.c('teal');
      s.line(v.X(ix1), v.y, v.X(ix1), v.y + v.h, c, 0.35, [1, 0.8]);
      s.line(v.X(ix2), v.y, v.X(ix2), v.y + v.h, c, 0.35, [1, 0.8]);
      s.text('max of lefts', v.X(ix1) - u, v.y + u * 3.5, { size: 2.8, font: 'mono', align: 'right', color: c, halo: true });
      s.text('min of rights', v.X(ix2) + u, v.y + u * 3.5, { size: 2.8, font: 'mono', align: 'left', color: c, halo: true });
    });
    const cA = s.win('clamp', 'union');
    s.alpha(cA * after(s, s.at('clamp') + 0.9, 0.4), () => {
      const c = s.c('red');
      s.line(v.x, v.Y(iy1), v.x + v.w, v.Y(iy1), c, 0.35, [1, 0.8]);
      s.line(v.x, v.Y(iy2), v.x + v.w, v.Y(iy2), c, 0.35, [1, 0.8]);
      s.text('edges crossed: height 0', v.x + v.w - u * 2, v.Y(iy2) + u * 5, { size: 2.9, font: 'mono', align: 'right', color: c, halo: true });
    });

    // Readout.
    const rx = tall ? w / 2 : r[0] + r[2] + (w - r[0] - r[2]) / 2;
    const ry = tall ? r[1] + r[3] + u * 6.5 : r[1] + r[3] * 0.32;
    const defA = s.win('name', 'inter');
    s.show('def', defA, { x: rx / w, y: (tall ? ry + u * 4 : ry + u * 6) / h });
    const nA = s.ease('inter', 0.5);
    s.alpha(nA, () => {
      if (tall) {
        const iA = s.ease('union', 0.4);
        s.text(`I = ${Math.round(inter).toLocaleString('en-US')}`, rx - u * 16 * iA, ry, { size: 3.6, font: 'mono', color: s.c('teal'), weight: 600 });
        s.alpha(iA, () => s.text(`U = ${Math.round(union).toLocaleString('en-US')}`, rx + u * 16, ry, { size: 3.6, font: 'mono', color: s.c('gold'), weight: 600 }));
        s.alpha(s.ease('ratio', 0.4), () => s.text(`IoU = ${val.toFixed(2)}`, rx, ry + u * 9, { size: 5.4, font: 'mono', weight: 650 }));
      } else {
        s.text(`I = ${Math.round(inter).toLocaleString('en-US')}`, rx, ry, { size: 3.8, font: 'mono', color: s.c('teal'), weight: 600 });
        s.alpha(s.ease('union', 0.4), () => s.text(`U = ${Math.round(union).toLocaleString('en-US')}`, rx, ry + u * 7, { size: 3.8, font: 'mono', color: s.c('gold'), weight: 600 }));
        s.alpha(s.ease('ratio', 0.4), () => s.text(`IoU = ${val.toFixed(2)}`, rx, ry + u * 17, { size: 5.2, font: 'mono', weight: 650 }));
      }
    });
    // Before the formula: just the score.
    s.alpha(s.win('want', 'name'), () => s.text(`IoU = ${val.toFixed(2)}`, rx, tall ? ry + u * 4 : ry + u * 6, { size: 5.2, font: 'mono', weight: 650 }));
    const tA = s.ease('tau', 0.5, 1.2);
    s.alpha(tA, () => {
      const y = tall ? ry + u * 17 : ry + u * 28;
      const hit = val >= 0.5;
      const pw = pill(s, hit ? '≥ τ = 0.5: a hit' : '< τ = 0.5: a miss', rx + u * 2.5, y, hit ? 'green' : 'red', { size: 3.2 });
      if (hit) check(s, rx + u * 2.5 - pw / 2 - u * 3.8, y, u * 2.2);
    });
  },
};

// ---------------------------------------------------------------- sliding windows

const WIN = 96;
const STEP = 32;
const NX = Math.floor((480 - WIN) / STEP) + 1;
const NY = Math.floor((320 - WIN) / STEP) + 1;
const WINDOWS: Box[] = [];
for (let yi = 0; yi < NY; yi++) for (let xi = 0; xi < NX; xi++) WINDOWS.push([xi * STEP, yi * STEP, xi * STEP + WIN, yi * STEP + WIN]);
const GOOD = WINDOWS.map((b) => OBJECTS.some((o) => iou(b, o.box) >= 0.5));
const runsFor = (sizes: number[], st: number) => sizes.reduce((a, win) => a + (Math.floor((320 - win) / st) + 1) * (Math.floor((480 - win) / st) + 1), 0);
const RUNS_32 = runsFor([64, 96, 128], 32);
const RUNS_8 = runsFor([64, 96, 128], 8);

/** One square grid of cells with a highlighted square region. */
function fgrid(s: Scene, x: number, y: number, n: number, cs: number, k: 'orange' | 'teal' | 'blue', reg: [number, number, number] | null, regB?: [number, number, number] | null): void {
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      const inR = (rg: [number, number, number] | null | undefined) => !!rg && a >= rg[0] && a < rg[0] + rg[2] && b >= rg[1] && b < rg[1] + rg[2];
      const r1 = inR(reg);
      const r2 = inR(regB);
      s.ctx.fillStyle = r1 && r2 ? s.tint(k, 0.85) : r1 || r2 ? s.tint(k, 0.5) : s.tint('--ink', 0.11);
      s.ctx.fillRect(x + b * cs + 0.5, y + a * cs + 0.5, cs - 1, cs - 1);
    }
  for (const rg of [reg, regB]) if (rg) s.rrect(x + rg[1] * cs, y + rg[0] * cs, rg[2] * cs, rg[2] * cs, 0.3, { stroke: s.c(k), lw: 0.4 });
}

const sliding: SceneDef = {
  marks: {
    size: { tex: String.raw`N_{\text{out}} = \frac{N_{\text{in}} - F}{S} + 1`, x: 0.5, y: 0.2, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const tall = stacked(s);
    const aA = s.win('one', 'trick');
    if (aA > 0) {
      const r = tall ? fit(u * 4, h * 0.1, w - u * 8, h * 0.6) : fit(u * 4, h * 0.1, w * 0.64, h * 0.84);
      const v = View.in(s, r);
      s.alpha(aA, () => {
        v.paint(1);
        const p = s.span('one', 'cost');
        const n = Math.min(WINDOWS.length, Math.floor(p * WINDOWS.length) + 1);
        const goodA = s.ease('each', 0.5);
        v.clip(() => {
          for (let i = 0; i < n - 1; i++) {
            if (GOOD[i] && goodA > 0) s.alpha(goodA, () => v.box(WINDOWS[i]!, s.c('green'), 0.5));
            else s.alpha(0.18, () => v.box(WINDOWS[i]!, s.c('teal'), 0.2));
          }
          if (s.since('cost') < 0) v.box(WINDOWS[n - 1]!, s.c('teal'), 0.7);
        });
        const eight = s.t >= cue(s, 'sliding', 'count', 'eight') - 0.3;
        s.slot('runs', s.since('count') < 0 ? n : eight ? RUNS_8 : RUNS_32);
        s.slot('st', eight ? 8 : 32);
        const rx = tall ? w / 2 : r[0] + r[2] + (w - r[0] - r[2]) / 2;
        const ry = tall ? r[1] + r[3] + u * 6 : r[1] + r[3] * 0.25;
        const runsTxt = s.since('count') >= 0 ? '' : `runs: ${n}`;
        if (runsTxt) s.text(runsTxt, rx, ry, { size: 4, font: 'mono', weight: 600, color: s.c('teal') });
        s.alpha(s.win('cost', 'count'), () => {
          if (tall) s.text('each run: one full ConvNet pass', rx, ry + u * 7, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
          else ['each run:', 'one full', 'ConvNet pass'].forEach((t, i) => s.text(t, rx, ry + u * (8 + 5 * i), { size: 3.2, font: 'mono', color: s.c('--ink-2') }));
        });
        const kA = s.ease('count', 0.5);
        s.alpha(kA, () => {
          const lines: [string, string, number][] = tall
            ? [
                [`3 sizes, stride 32: ${RUNS_32} runs`, 'teal', 0],
                [`stride 8: ${RUNS_8.toLocaleString('en-US')} runs`, 'red', cue(s, 'sliding', 'count', 'eight') - s.at('count')],
              ]
            : [
                ['3 sizes, stride 32:', '--ink-2', 0],
                [`${RUNS_32} runs`, 'teal', 0],
                ['stride 8:', '--ink-2', cue(s, 'sliding', 'count', 'eight') - s.at('count')],
                [`${RUNS_8.toLocaleString('en-US')} runs`, 'red', cue(s, 'sliding', 'count', 'eight') - s.at('count')],
              ];
          lines.forEach(([t, k, d], i) => s.alpha(s.ease('count', 0.5, d), () => s.text(t, rx, ry + i * u * (tall ? 7 : 6.5), { size: tall ? 3.6 : 3.4, font: 'mono', weight: 600, color: s.c(k as 'teal') })));
        });
      });
    }

    // Phase B: a fully connected layer is a convolution; then any size in, a grid of scores out.
    const fA = s.win('trick', 'any');
    s.alpha(fA, () => {
      const cs = u * 4.4;
      const gx = w / 2 - cs * 2.5 - u * 16;
      const gy = h * 0.5 - cs * 2.5;
      fgrid(s, gx, gy, 5, cs, 'orange', [0, 0, 5]);
      const ox = w / 2 + u * 18;
      const oy = h * 0.5;
      for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) s.line(gx + (b + 0.5) * cs, gy + (a + 0.5) * cs, ox - u * 2.4, oy, s.tint('blue', 0.25), 0.2);
      s.circle(ox, oy, u * 2.4, { fill: s.tint('blue', 0.3), stroke: s.c('blue'), lw: 0.4 });
      s.text('fully connected:', w / 2, gy - u * 10, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      s.text('every input → one output', w / 2, gy - u * 5, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      s.alpha(s.ease('trick', 0.5, 2), () => s.text('= one 5×5 filter, one position', w / 2, gy + 5 * cs + u * 7, { size: 3.6, font: 'mono', weight: 600, color: s.c('blue') }));
    });
    const gA = s.ease('any', 0.6);
    if (gA <= 0) return;
    const growing = s.since('grow') >= 0;
    const N = growing ? 16 : 14;
    const n1 = N - 4;
    const n2 = n1 / 2;
    const M = n2 - 4;
    s.slot('n0', N);
    s.slot('n1', n1);
    s.slot('n2', n2);
    s.slot('n3', M);
    s.show('size', gA * s.ease('formula', 0.6), { y: 0.2 });
    s.alpha(gA, () => {
      const sizes = [N, n1, n2, M];
      const gapC = 3.5;
      const total = sizes.reduce((a, b) => a + b, 0) + gapC * 3;
      const cs = Math.min((w - u * 10) / total, (h * 0.4) / 16);
      let x = (w - total * cs) / 2;
      const cyy = h * 0.56;
      // The output cell being followed, and its windows in every layer.
      let oi = 0;
      let oj = 0;
      let second: [number, number] | null = null;
      if (growing) {
        const k = Math.floor(Math.max(0, s.since('grow') - 1.2) / 1.1) % 4;
        oi = Math.floor(k / 2);
        oj = k % 2;
      }
      if (s.since('share') >= 0) {
        oi = 0;
        oj = 0;
        second = [0, 1];
      }
      const regs = (i: number, j: number): [number, number, number][] => [
        [2 * i, 2 * j, 14],
        [2 * i, 2 * j, 10],
        [i, j, 5],
        [i, j, 1],
      ];
      const ra = regs(oi, oj);
      const rb = second ? regs(second[0], second[1]) : null;
      const names = ['input', 'conv 5×5', 'pool 2×2', 'scores'];
      const ks = ['orange', 'teal', 'teal', 'blue'] as const;
      sizes.forEach((n, li) => {
        const top = cyy - (n * cs) / 2;
        const showR = s.since('train') >= 0;
        fgrid(s, x, top, n, cs, ks[li], showR ? ra[li]! : null, rb ? rb[li] : null);
        s.text(names[li]!, x + (n * cs) / 2, cyy + (16 * cs) / 2 + u * 4, { size: 3.1, font: 'ui', color: s.c('--ink-2') });
        s.text(`${n}×${n}`, x + (n * cs) / 2, cyy + (16 * cs) / 2 + u * 8.4, { size: 3.1, font: 'mono', weight: 600, color: s.c(ks[li]) });
        x += (n + gapC) * cs;
      });
      s.alpha(s.ease('share', 0.5, 0.6), () => s.text('two windows, mostly shared work', w / 2, cyy - (16 * cs) / 2 - u * 4, { size: 3.2, font: 'mono', color: s.c('orange'), weight: 600 }));
    });
  },
};

// ---------------------------------------------------------------- NMS

interface NmsView {
  keep: Set<number>;
  removed: Set<number>;
  just: [number, number][];
  cur: number;
}

/** The NMS state to draw at scene time t. */
function nmsAt(s: Scene): NmsView | null {
  if (s.since('keep') < 0) return null;
  const st = (steps: NmsStep[], k: number, drop: boolean): NmsView => {
    const a = steps[k]!;
    const prev = k > 0 ? steps[k - 1]! : null;
    return {
      keep: new Set(a.keep),
      removed: new Set(drop ? a.removed : (prev?.removed ?? [])),
      just: drop ? a.just : [],
      cur: a.cur,
    };
  };
  if (s.since('drop') < 0) return st(NMS_05, 0, false);
  if (s.since('repeat') < 0) return st(NMS_05, 0, s.since('drop') > 1.4);
  if (s.since('class') < 0) {
    const p = s.prog('repeat') * 1.15;
    const rounds = NMS_05.length - 1;
    const f = clamp01(p) * rounds;
    const k = Math.min(rounds, 1 + Math.floor(f));
    return st(NMS_05, k, f - Math.floor(f) > 0.5 || k === rounds);
  }
  if (s.since('tau') >= 0) {
    const steps = s.prog('tau') < 0.5 ? NMS_065 : NMS_03;
    return { ...st(steps, steps.length - 1, true), cur: -1, just: [] };
  }
  return { ...st(NMS_05, NMS_05.length - 1, true), cur: -1, just: [] };
}

const nms: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tall = stacked(s);
    const r = tall ? fit(u * 4, h * 0.1, w - u * 8, h * 0.6) : fit(u * 4, h * 0.09, w - u * 8, h * 0.66);
    const v = View.in(s, r);
    v.paint(1);
    const state = nmsAt(s);
    const placed: Rect[] = [];
    const final = s.since('result') >= 0;
    const visible = (i: number): number => {
      if (s.since('raw') < 0) {
        const di = [10, 11, 12, 13].indexOf(i);
        return di < 0 ? 0 : s.ease('many', 0.4, 1.2 + di * 0.7);
      }
      const order = BY_SCORE.indexOf(i);
      return i >= 10 && i <= 13 ? 1 : s.ease('raw', 0.4, 0.15 * ((order * 7) % 18));
    };
    v.clip(() => {
      CANDIDATES.forEach(([cls, sc, b], i) => {
        const a = visible(i);
        if (a <= 0) return;
        if (state && (state.keep.has(i) || state.removed.has(i) || state.just.some(([j]) => j === i))) return;
        s.alpha(a * (0.3 + 0.7 * sc), () => v.box(b, s.c(clsK(cls)), 0.32));
      });
      if (state) {
        state.just.forEach(([j]) => v.box(CANDIDATES[j]![2], s.c('red'), 0.5, [1.2, 0.9]));
        state.keep.forEach((i) => {
          const [cls, , b] = CANDIDATES[i]!;
          v.box(b, s.c(clsK(cls)), i === state.cur ? 0.95 : 0.55);
        });
      }
    });
    if (state) {
      if (state.cur >= 0) {
        const [cls, sc, b] = CANDIDATES[state.cur]!;
        boxChip(v, b, `${SCENE_CLASSES[cls]} ${sc.toFixed(2)}`, s.c(clsK(cls)), placed, 2.7);
      }
      state.just.forEach(([j, val]) => boxChip(v, CANDIDATES[j]![2], `IoU ${val.toFixed(2)}`, s.c('red'), placed, 2.5));
      if (final || s.since('tau') >= 0) {
        state.keep.forEach((i) => {
          const [cls, sc, b] = CANDIDATES[i]!;
          boxChip(v, b, `${SCENE_CLASSES[cls]} ${sc.toFixed(2)}`, s.c(clsK(cls)), placed, 2.5);
        });
      }
    }
    // Same class only: the stray cat box inside the dog's box survives the dog.
    const clA = s.win('class', 'result');
    s.alpha(clA, () => {
      const cat = CANDIDATES[17]![2];
      const dog = CANDIDATES[10]![2];
      v.box(cat, s.c('purple'), 0.8);
      v.box(dog, s.c('orange'), 0.8);
      chip(s, 'dog never removes cat', v.X(dog[0]), v.Y(dog[1]) - u * 9, s.c('--ink-2'), { size: 2.8 });
    });
    // Leftovers worth naming.
    const resA = s.win('result', 'tau');
    s.alpha(resA * s.ease('result', 0.5, 2), () => {
      for (const i of [3, 16, 17]) {
        const b = CANDIDATES[i]![2];
        v.clip(() => v.box([b[0] - 3, b[1] - 3, b[2] + 3, b[3] + 3], s.c('--ink'), 0.3, [0.8, 0.8]));
      }
    });

    // Scores, best first: the order NMS visits them.
    const bA = s.ease('sort', 0.5);
    if (bA > 0) {
      const bx = r[0];
      const bw = r[2];
      const top = r[1] + r[3] + u * 4;
      const bh = Math.min(u * 13, h - top - u * 5);
      const step = bw / BY_SCORE.length;
      s.alpha(bA, () => {
        BY_SCORE.forEach((i, k) => {
          const [cls, sc] = CANDIDATES[i]!;
          const kept = state?.keep.has(i) ?? false;
          const gone = state?.removed.has(i) || state?.just.some(([j]) => j === i);
          const isCur = state?.cur === i;
          const hh = bh * sc;
          const a = s.ease('sort', 0.3, 0.05 * k);
          s.alpha(a * (gone ? 0.22 : 1), () => {
            s.rrect(bx + k * step + step * 0.15, top + bh - hh, step * 0.7, hh, 0.4, { fill: s.tint(clsK(cls), kept ? 0.85 : 0.35), stroke: isCur ? s.c('--ink') : undefined, lw: 0.4 });
          });
          if (gone) s.line(bx + k * step + step * 0.1, top + bh - hh, bx + k * step + step * 0.9, top + bh, s.tint('red', 0.7), 0.3);
        });
      });
      s.slot('nk', state?.keep.size ?? 0);
      s.slot('nr', state?.removed.size ?? 0);
    }
    const tA = s.ease('tau', 0.4);
    if (tA > 0) {
      const tau = s.prog('tau') < 0.5 ? 0.65 : 0.3;
      s.slot('tau', tau);
      s.alpha(tA, () => {
        pill(s, `τ = ${tau}`, r[0] + r[2] - u * 2, r[1] + u * 4, 'slate', { size: 3.4, align: 'right', fill: 0.18 });
        const high = tau > 0.5;
        chip(s, high ? 'too high: a duplicate survives' : 'too low: close neighbors at risk', r[0] + u * 2, r[1] + u * 2, s.c(high ? 'red' : 'slate'), { size: 2.8 });
        if (high) v.clip(() => v.box(CANDIDATES[9]![2], s.c('--ink'), 0.5, [1, 0.8]));
      });
    } else s.slot('tau', 0.5);
  },
};

export { intro, localize, iouScene, sliding, nms };
