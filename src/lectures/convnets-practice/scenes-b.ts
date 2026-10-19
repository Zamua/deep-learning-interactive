import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { type K, LAYERS, type St, at, card, cifar, cross, current, lock, pic, pill, strip } from './kit';
import { fit } from './scenes-a';

const hash = (a: number, b: number): number => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Block geometry of `strip` for layer i, to anchor labels. */
function blockX(s: Scene, sx: number, sw: number, i: number): [number, number] {
  const gap = s.u * 1.4;
  const bw = (sw - gap * 7) / 8;
  return [sx + i * (bw + gap), bw];
}

/** A small oriented-edge (or color blob) patch, like a first-layer filter. */
function edge(s: Scene, x: number, y: number, size: number, ang: number, blob = false): void {
  const n = 7;
  const cs = size / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const px = (j - 3) / 3;
      const py = (i - 3) / 3;
      let col: string;
      if (blob) {
        const r = Math.exp(-(px * px + py * py) * 1.6);
        col = `rgb(${Math.round(90 + 150 * r)},${Math.round(170 - 110 * r)},${Math.round(90 + 120 * r)})`;
      } else {
        const v = Math.cos((px * Math.cos(ang) + py * Math.sin(ang)) * 3.2) * Math.exp(-(px * px + py * py) * 0.6);
        const g = Math.round(128 + 120 * v);
        col = `rgb(${g},${g},${g})`;
      }
      s.ctx.fillStyle = col;
      s.ctx.fillRect(x + j * cs, y + i * cs, cs + 0.5, cs + 0.5);
    }
  s.rrect(x, y, size, size, 0.3, { stroke: s.c('--rule'), lw: 0.25 });
}

// ---------------------------------------------------------------- transfer

const transfer: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = cifar(s);
    const cx = w / 2;
    const sw = Math.min(w - u * 12, u * 128);
    const sx = (w - sw) / 2;
    const sy = u * 42;
    const sh = u * 20;
    const ft = s.ease('finetune', 0.6);
    const fz = s.ease('freeze', 0.6);
    const st: St[] = LAYERS.map((_, i) => (i === 7 ? (ft > 0.5 ? 'new' : 'plain') : ft > 0.5 ? (fz > 0.5 && i < 3 ? 'frozen' : 'ft') : 'plain'));
    const gone = s.ease('extract', 0.8, 0.5) * (1 - ft);
    // random weights, until ImageNet trains them
    const rnd = 1 - s.ease('myth', 0.8, 1.2);
    s.alpha(rnd, () => {
      for (let i = 0; i < 8; i++) {
        const [bx, bw] = blockX(s, sx, sw, i);
        const cs = bw / 5;
        for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) {
          const v = hash(i * 12 + r * 4 + q, 9) * 2 - 1;
          s.rrect(bx + cs * (0.5 + q), sy + sh * 0.5 - cs * 1.5 + r * cs, cs * 0.85, cs * 0.85, 0.2, { fill: s.tint(v > 0 ? 'blue' : 'red', 0.12 + 0.3 * Math.abs(v)) });
        }
      }
      s.text('a ConvNet from random weights?', cx, sy + sh + u * 8, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
    strip(s, sx, sy, sw, sh, st, { a: (i) => (i === 7 ? 1 - 0.75 * gone : 1), lift: (i) => (i === 7 ? gone * u * 7 : 0) });
    s.alpha(s.win('extract', 'finetune'), () => s.text('way 1: a fixed feature extractor', cx, u * 12, { size: fit(s, 'way 1: a fixed feature extractor', w - u * 10, 4.6, { font: 'display', weight: 600 }), font: 'display', weight: 600, color: s.c('purple') }));
    s.alpha(s.win('finetune', 'zoo'), () => s.text('way 2: fine-tuning', cx, u * 12, { size: 4.6, font: 'display', weight: 600, color: s.c('teal') }));
    s.alpha(s.win('scratch', 'myth'), () => s.text('do not start from scratch', cx, u * 18, { size: 5.4, font: 'display', weight: 600 }));
    // ImageNet trains it.
    const iA = s.win('myth', 'extract');
    s.alpha(iA, () => {
      const tz = Math.min(u * 8.6, (sw - u * 9.6) / 9);
      const g = u * 1.2;
      const gx = cx - (9 * tz + 8 * g) / 2;
      for (let k = 0; k < 18; k++) {
        const a = clamp01((s.t - at(s, 'myth', 0.1 + k * 0.02)) * 3);
        s.alpha(a, () => pic(s, d?.thumbs[k], gx + (k % 9) * (tz + g), u * 13 + Math.floor(k / 9) * (tz + g), tz));
      }
      s.text('ImageNet: 1.2 million images, 1,000 classes', cx, u * 7, { size: fit(s, 'ImageNet: 1.2 million images, 1,000 classes', sw, 3.6, { weight: 600 }), weight: 600, color: s.c('--ink-2') });
      s.alpha(s.ease('myth', 0.6, 1.6), () => s.arrow(cx, u * 13 + 2 * tz + g + u * 1.5, cx, sy - u * 1.5, s.c('--ink-3'), 0.45, 2));
    });
    s.alpha(s.win('two', 'extract'), () => {
      s.text('pretrained AlexNet: download it', cx, sy + sh + u * 6, { size: 3.6, color: s.c('--ink-2') });
      const y = sy + sh + u * 17;
      pill(s, '1. fixed feature extractor', cx - u * 2, y, 'purple', { size: 3.3, align: 'right' });
      pill(s, '2. fine-tuning', cx + u * 2, y, 'teal', { size: 3.3, align: 'left' });
    });
    // Way one: CNN codes and a linear classifier.
    const xA = s.win('extract', 'finetune');
    s.alpha(xA, () => {
      const [fx, fw] = blockX(s, sx, sw, 7);
      s.alpha(s.ease('extract', 0.5, 1), () => {
        cross(s, fx + fw / 2, sy + sh / 2 - u * 7, u * 2.6);
        s.text('the 1,000 ImageNet scores', fx + fw, sy - u * 11, { size: 3.3, align: 'right', color: s.c('red') });
      });
      const cA = s.ease('codes', 0.6);
      s.alpha(cA, () => {
        const n = 16;
        const rw = Math.min(sw * 0.56, u * 70);
        const rx = sx;
        const ry = sy + sh + u * 10;
        const cw = rw / n;
        const [f7x, f7w] = blockX(s, sx, sw, 6);
        s.arrow(f7x + f7w / 2, sy + sh * 0.86 + u * 0.5, rx + rw * 0.8, ry - u * 0.6, s.c('purple'), 0.4, 1.8);
        for (let i = 0; i < n; i++) {
          const v = hash(i, 4);
          const zero = v < 0.35;
          s.rrect(rx + i * cw, ry, cw * 0.88, u * 5, 0.4, { fill: zero ? s.c('--card') : s.tint('purple', 0.2 + 0.7 * v), stroke: s.tint('purple', 0.6), lw: 0.25 });
        }
        s.text('codes: 4,096 numbers, ReLU so ≥ 0', rx, ry + u * 9.5, { size: 3.2, align: 'left', font: 'mono', color: s.c('purple') });
        const lA = clamp01((s.t - at(s, 'codes', 0.62)) / 0.6);
        s.alpha(lA, () => {
          const bx = rx + rw + u * 6;
          const bw = sx + sw - bx;
          s.arrow(rx + rw + u * 0.8, ry + u * 2.5, bx - u * 0.8, ry + u * 2.5, s.c('orange'), 0.45, 1.8);
          s.rrect(bx, ry - u * 2, bw, u * 9, 1.6, { fill: s.tint('orange', 0.12), stroke: s.c('orange'), lw: 0.4 });
          s.text('linear classifier', bx + bw / 2, ry + u * 2.6, { size: fit(s, 'linear classifier', bw - u * 2, 3.3, { weight: 600 }), weight: 600, color: s.c('orange') });
        });
      });
      s.alpha(s.ease('strong', 0.6), () => pill(s, '"an astounding baseline" (Razavian et al., 2014)', cx, h - u * 8, 'green', { size: fit(s, '"an astounding baseline" (Razavian et al., 2014)', sw - u * 6, 3.3, { font: 'ui', weight: 600 }) }));
    });
    // Way two: fine-tuning, with frozen early layers.
    const fA = s.win('finetune', 'zoo');
    s.alpha(fA, () => {
      const [fx, fw] = blockX(s, sx, sw, 7);
      s.text('new head', fx + fw, sy - u * 4, { size: 3.3, align: 'right', weight: 600, color: s.c('orange') });
      const from = lerp(0, 3, fz);
      const [ax0] = blockX(s, sx, sw, Math.round(from));
      const ay = sy + sh + u * 5;
      s.arrow(fx + fw / 2, ay, ax0 + u * 1, ay, s.c('teal'), 0.5, 2);
      s.text('keep training: backprop', (fx + fw / 2 + ax0) / 2, ay + u * 4.6, { size: 3.2, color: s.c('teal'), weight: 600 });
      s.alpha(fz, () => {
        for (let i = 0; i < 3; i++) {
          const [bx, bw] = blockX(s, sx, sw, i);
          lock(s, bx + bw / 2, sy - u * 4, u * 1.6, s.c('slate'));
        }
        const [b0] = blockX(s, sx, sw, 0);
        const [b2, bw2] = blockX(s, sx, sw, 2);
        s.text('frozen', (b0 + b2 + bw2) / 2, sy + sh + u * 5.2, { size: 3.2, weight: 600, color: s.c('slate') });
        const pz = Math.min(u * 7, (b2 + bw2 - b0 - u * 3) / 4);
        [0, Math.PI / 4, Math.PI / 2, -1].forEach((ang, i) => edge(s, b0 + i * (pz + u * 1), sy + sh + u * 15, pz, ang, ang < 0));
        s.text('generic: edges, color blobs', b0, sy + sh + u * 15 + pz + u * 5, { size: 3.2, align: 'left', color: s.c('--ink-2') });
      });
      s.alpha(s.ease('specific', 0.6), () => {
        const [b5] = blockX(s, sx, sw, 5);
        const pz = Math.min(u * 7, (sx + sw - b5 - u * 2) / 3);
        d?.dogs.forEach((cv, i) => pic(s, cv, sx + sw - (3 - i) * (pz + u * 1) + u * 1, sy + sh + u * 15, pz));
        s.text('specific: dog breeds', sx + sw, sy + sh + u * 15 + pz + u * 5, { size: 3.2, align: 'right', color: s.c('--ink-2') });
      });
    });
    // Shared weights.
    s.alpha(s.ease('zoo', 0.6), () => {
      const names = ['AlexNet', 'VGG', 'GoogLeNet', 'ResNet'];
      const g = u * 3;
      const cw = (sw - 3 * g) / 4;
      s.text('Model Zoo: trained weights, shared', cx, u * 8, { size: 4, font: 'display', weight: 600 });
      names.forEach((nm, i) => {
        const a = s.ease('zoo', 0.4, 0.8 + i * 0.35);
        s.alpha(a, () => {
          card(s, sx + i * (cw + g), u * 15, cw, u * 13, 'slate', 0.5);
          s.text(nm, sx + i * (cw + g) + cw / 2, u * 21.5, { size: fit(s, nm, cw - u * 2, 3.6, { weight: 600 }), weight: 600 });
        });
      });
    });
  },
};

// ---------------------------------------------------------------- strategy

interface Plan {
  st: St[];
  name: string;
  names?: string[];
}
const PLANS: Record<string, Plan> = {
  c1: { st: ['frozen', 'frozen', 'frozen', 'frozen', 'frozen', 'frozen', 'frozen', 'new'], name: 'linear classifier on fc7 codes' },
  c2: { st: ['frozen', 'frozen', 'frozen', 'frozen', 'ft', 'ft', 'ft', 'new'], name: 'fine-tune the top few layers' },
  c3: { st: ['frozen', 'frozen', 'frozen', 'frozen', 'cut', 'cut', 'cut', 'new'], name: 'linear classifier on conv4 features', names: [...LAYERS.slice(0, 7), 'clf'] },
  c4: { st: ['ft', 'ft', 'ft', 'ft', 'ft', 'ft', 'ft', 'new'], name: 'fine-tune all the layers' },
};
const CORNER: Record<string, [number, number]> = { c1: [0.25, 0.75], c2: [0.75, 0.75], c3: [0.25, 0.25], c4: [0.75, 0.25] };
const QTEXT: Record<string, string[]> = {
  c1: ['linear classifier', 'on top-layer codes'],
  c2: ['fine-tune the', 'top few layers'],
  c3: ['linear classifiers', 'on earlier layers'],
  c4: ['fine-tune many', 'or all layers'],
};
const LR = ['0', '0', 'η/100', 'η/100', 'η/100', 'η/10', 'η/10', 'η'];
const LRST: St[] = ['frozen', 'frozen', 'ft', 'ft', 'ft', 'ft', 'ft', 'new'];
const LRV = [0, 0, 0.01, 0.01, 0.01, 0.1, 0.1, 1];

const strategy: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const cx = w / 2;
    const qw = Math.min(w - u * 18, u * 118);
    const qx = (w - qw) / 2 + u * 3;
    const qy = u * 9;
    const qh = u * 44;
    const corners = ['c1', 'c2', 'c3', 'c4'];
    const cur = current(s, corners);
    const qA = s.win('two', 'noisy');
    s.alpha(qA, () => {
      const bx = qx + qw / 2;
      const by = qy + qh / 2;
      corners.forEach((id) => {
        const [fx, fy] = CORNER[id]!;
        const x = fx < 0.5 ? qx : bx;
        const y = fy > 0.5 ? qy : by;
        const on = cur === id ? s.ease(id, 0.5) : 0;
        const seen = s.since(id) >= 0;
        s.rrect(x, y, qw / 2, qh / 2, 0, { fill: on > 0 ? s.tint('--accent', 0.04 + 0.1 * on) : s.tint('--ink', 0.025) });
        if (seen) {
          const lines = QTEXT[id]!;
          lines.forEach((ln, i) => s.text(ln, x + qw / 4, y + qh / 4 + (i - 0.5) * u * 4.6, { size: fit(s, ln, qw / 2 - u * 4, 3.3), weight: on > 0.5 ? 650 : 450, color: s.c(on > 0.5 ? '--ink' : '--ink-3') }));
        }
      });
      s.rrect(qx, qy, qw, qh, 0, { stroke: s.c('--rule'), lw: 0.3 });
      s.line(bx, qy, bx, qy + qh, s.c('--ink-3'), 0.3, [1.2, 1]);
      s.line(qx, by, qx + qw, by, s.c('--ink-3'), 0.3, [1.2, 1]);
      const c = s.ctx;
      for (const [txt, yy] of [
        ['similar', qy + qh / 4],
        ['different', qy + (3 * qh) / 4],
      ] as [string, number][]) {
        c.save();
        c.translate(qx - u * 3, yy);
        c.rotate(-Math.PI / 2);
        s.text(txt, 0, 0, { size: 3.2, color: s.c('--ink-2'), weight: 600 });
        c.restore();
      }
      s.text('little data', qx + qw / 4, qy + qh + u * 4, { size: 3.2, color: s.c('--ink-2'), weight: 600 });
      s.text('lots of data', qx + (3 * qw) / 4, qy + qh + u * 4, { size: 3.2, color: s.c('--ink-2'), weight: 600 });
      s.text('10K', bx, qy + qh + u * 4, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      // the dataset's dot
      if (cur) {
        const i = corners.indexOf(cur);
        const prev = i > 0 ? CORNER[corners[i - 1]!]! : CORNER[cur]!;
        const e = s.ease(cur, 0.8);
        const fx = lerp(prev[0], CORNER[cur]![0], e);
        const fy = lerp(prev[1], CORNER[cur]![1], e);
        const px = qx + fx * qw + u * 9 * (fx < 0.5 ? -1 : 1) * 0;
        const py = qy + (1 - fy) * qh - u * 7.5;
        s.circle(px, py, u * 2, { fill: s.c('orange'), stroke: s.c('--card'), lw: 0.5 });
      }
      // layer plan
      const plan = cur ? PLANS[cur]! : null;
      const sw = Math.min(w - u * 12, u * 118);
      const sx = (w - sw) / 2;
      const sy = u * 71;
      if (plan) {
        s.alpha(s.ease('c1', 0.5), () => {
          s.text(`AlexNet: ${plan.name}`, sx, sy - u * 4, { size: fit(s, `AlexNet: ${plan.name}`, sw, 3.4, { weight: 600 }), align: 'left', weight: 600 });
          strip(s, sx, sy, sw, u * 12, plan.st, { names: plan.names, size: 2.7 });
          s.text('slate: frozen   teal: fine-tuned   orange: new   dashed: cut', sx, sy + u * 17, { size: fit(s, 'slate: frozen   teal: fine-tuned   orange: new   dashed: cut', sw, 2.9), align: 'left', color: s.c('--ink-3') });
        });
      }
      s.alpha(s.win('two', 'c1'), () => s.text('how much data? how similar to ImageNet?', cx, u * 78, { size: 3.8, italic: true, color: s.c('--ink-2') }));
    });
    // Learning rate per layer.
    const rA = s.win('noisy', 'norm');
    s.alpha(rA, () => {
      const sw = Math.min(w - u * 12, u * 118);
      const sx = (w - sw) / 2;
      const sy = u * 30;
      const sh = u * 18;
      s.text('fine-tuning: one learning rate per layer', cx, u * 9, { size: fit(s, 'fine-tuning: one learning rate per layer', w - u * 10, 4.6, { font: 'display', weight: 600 }), font: 'display', weight: 600 });
      strip(s, sx, sy, sw, sh, LRST, { size: 2.8 });
      // gradients: the fresh head is loud
      const step = Math.floor(s.t / 0.4);
      for (let i = 0; i < 8; i++) {
        const [bx, bw] = blockX(s, sx, sw, i);
        const g = i === 7 ? 0.55 + 0.45 * hash(step, i) : 0.12 + 0.08 * hash(step, i);
        const len = u * 11 * g;
        s.alpha(1 - s.ease('rates', 0.5) * 0.6, () => s.arrow(bx + bw / 2, sy - u * 2, bx + bw / 2 + (hash(step, i + 9) - 0.5) * u * 3, sy - u * 2 - len, s.c(i === 7 ? 'red' : '--ink-3'), 0.4, 1.4));
      }
      s.alpha(1 - s.ease('rates', 0.5), () => {
        s.text('a random head: big, noisy gradients', sx + sw, u * 17, { size: 3.2, align: 'right', color: s.c('red') });
        const [b0] = blockX(s, sx, sw, 0);
        const [b7, bw7] = blockX(s, sx, sw, 7);
        s.text('pretrained: already good', b0, sy + sh + u * 6, { size: 3.3, align: 'left', weight: 600, color: s.c('slate') });
        s.text('fresh, random', b7 + bw7, sy + sh + u * 6, { size: 3.3, align: 'right', weight: 600, color: s.c('orange') });
      });
      const lrA = s.ease('rates', 0.6);
      s.alpha(lrA, () => {
        for (let i = 0; i < 8; i++) {
          const [bx, bw] = blockX(s, sx, sw, i);
          const a = clamp01((s.t - at(s, 'rates', 0.12 + (7 - i) * 0.08)) * 3);
          s.alpha(a, () => {
            s.text(LR[i]!, bx + bw / 2, sy + sh + u * 5, { size: fit(s, LR[i]!, bw, 3.4, { font: 'mono', weight: 600 }), font: 'mono', weight: 600, color: s.c(LRST[i] === 'new' ? 'orange' : LRST[i] === 'ft' ? 'teal' : 'slate') });
            const bh = LRV[i] ? u * (3 + 3.2 * (Math.log10(LRV[i]!) + 2)) : 0;
            s.rrect(bx + bw * 0.2, sy + sh + u * 25 - bh, bw * 0.6, Math.max(bh, u * 0.3), 0.3, { fill: s.tint(LRST[i] === 'new' ? 'orange' : LRST[i] === 'ft' ? 'teal' : 'slate', 0.55) });
          });
        }
        s.line(sx, sy + sh + u * 25, sx + sw, sy + sh + u * 25, s.tint('--ink', 0.3), 0.25);
        s.text('step size, log scale', sx, sy + sh + u * 29, { size: 3, align: 'left', color: s.c('--ink-3') });
      });
      s.alpha(s.ease('caffe', 0.6), () => {
        const tx = sx + sw;
        s.text('Caffe: param { lr_mult: 0 }', tx, sy + sh + u * 29, { size: 3.1, font: 'mono', align: 'right', weight: 600, color: s.c('slate') });
      });
    });
    // The norm, and the advice.
    s.alpha(s.ease('norm', 0.6), () => {
      const cw = Math.min(u * 50, (w - u * 14) / 2);
      const g = u * 4;
      const x0 = cx - cw - g / 2;
      const y0 = u * 12;
      const items: [string, string][] = [
        ['object detection', 'Faster R-CNN (ch. 14)'],
        ['image captioning', 'with word vectors (ch. 15)'],
      ];
      items.forEach(([t1, t2], i) => {
        const x = x0 + i * (cw + g);
        card(s, x, y0, cw, u * 30, 'slate', 0.4);
        s.text(t1, x + cw / 2, y0 + u * 6, { size: fit(s, t1, cw - u * 3, 4, { font: 'display', weight: 600 }), font: 'display', weight: 600 });
        s.text(t2, x + cw / 2, y0 + u * 12, { size: fit(s, t2, cw - u * 3, 3.1), color: s.c('--ink-2') });
        const bw = (cw - u * 10) / 6;
        for (let k = 0; k < 6; k++) s.rrect(x + u * 5 + k * bw, y0 + u * 17, bw * 0.8, u * 7, 0.5, { fill: s.tint(k < 5 ? 'slate' : 'orange', 0.3), stroke: s.tint(k < 5 ? 'slate' : 'orange', 0.7), lw: 0.25 });
        s.text('an ImageNet ConvNet inside', x + cw / 2, y0 + u * 27.5, { size: 2.9, italic: true, color: s.c('--ink-3') });
      });
      const aA = s.ease('advice', 0.6);
      s.alpha(aA, () => {
        const steps = [
          ['a big, similar', 'dataset'],
          ['train a big', 'ConvNet on it'],
          ['transfer', 'to yours'],
        ];
        const bw = Math.min(u * 34, (w - u * 20) / 3);
        const gg = (w - u * 8 - 3 * bw) / 2;
        const yy = u * 56;
        steps.forEach((t, i) => {
          const a = s.ease('advice', 0.4, 0.6 + i * 0.9);
          s.alpha(a, () => {
            const x = u * 4 + i * (bw + gg);
            card(s, x, yy, bw, u * 16, i === 2 ? 'orange' : 'teal', 0.6);
            t.forEach((ln, j) => s.text(ln, x + bw / 2, yy + u * (5.6 + j * 5), { size: fit(s, 'ConvNet on it', bw - u * 3, 3.5, { weight: 600 }), weight: 600 }));
            if (i > 0) s.arrow(x - gg + u * 0.8, yy + u * 8, x - u * 0.8, yy + u * 8, s.c('--ink-3'), 0.4, 1.8);
          });
        });
        s.text('fewer than about a million images? transfer.', cx, u * 83, { size: 3.6, italic: true, color: s.c('--ink-2') });
      });
    });
  },
};

// ---------------------------------------------------------------- stack

/** A volume as an oblique box: front face (x, y, fw, fh), receding `dep` up and to the right. */
function cuboid(s: Scene, x: number, y: number, fw: number, fh: number, dep: number, k: K, a = 1): void {
  const dx = dep * 0.7;
  const dy = -dep * 0.5;
  const c = s.ctx;
  const face = (pts: [number, number][], alpha: number) => {
    c.beginPath();
    pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.closePath();
    c.fillStyle = s.tint(k, alpha * a);
    c.fill();
    c.strokeStyle = s.tint(k, 0.8 * a);
    c.lineWidth = s.u * 0.3;
    c.stroke();
  };
  face([[x, y], [x + dx, y + dy], [x + fw + dx, y + dy], [x + fw, y]], 0.3);
  face([[x + fw, y], [x + fw + dx, y + dy], [x + fw + dx, y + fh + dy], [x + fw, y + fh]], 0.22);
  face([[x, y], [x + fw, y], [x + fw, y + fh], [x, y + fh]], 0.14);
}

/** A row of cells, centered at cx; returns the left edge. */
function cellRow(s: Scene, cx: number, y: number, n: number, cs: number, k: K, on: (i: number) => number): number {
  const x0 = cx - (n * cs) / 2;
  for (let i = 0; i < n; i++) s.cell(x0 + i * cs + s.u * 0.25, y, cs - s.u * 0.5, cs * 0.8, '', k, { on: on(i) });
  return x0;
}

const DESIGNS: [string, number, number][] = [
  ['one 7×7', 49, 1],
  ['three 3×3', 27, 3],
  ['one 3×3', 9, 1],
  ['1×3 then 3×1', 6, 2],
  ['bottleneck', 3.25, 3],
];

const stack: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const cx = w / 2;
    // A volume and its filter.
    const vA = s.win('recall', 'seven');
    s.alpha(vA, () => {
      s.text('same region, less work', cx, u * 9, { size: 5, font: 'display', weight: 600 });
      const fw = u * 30;
      const fh = u * 30;
      const dep = u * 18;
      const x0 = Math.max(u * 6, cx - u * 52);
      const y0 = u * 34;
      const tx = x0 + fw + dep * 0.7 + u * 6;
      cuboid(s, x0, y0, fw, fh, dep, 'orange');
      s.text('H × H × C', x0 + fw / 2, y0 + fh + u * 5, { size: 3.6, font: 'mono', weight: 600, color: s.c('orange') });
      const sA = s.ease('setup', 0.6, 0.6);
      s.alpha(sA, () => {
        const p = (s.since('setup') * 0.25) % 1;
        const fx = x0 + u * 2 + (fw - u * 11) * (0.5 - 0.5 * Math.cos(p * Math.PI * 2));
        const fy = y0 + u * 2 + (fh - u * 11) * (0.5 - 0.5 * Math.cos(p * Math.PI * 4));
        cuboid(s, fx, fy, u * 8, u * 8, dep, 'blue');
        s.text('7 × 7 × C filter', tx, y0 - u * 6, { size: 3.4, font: 'mono', weight: 600, color: s.c('blue'), align: 'left' });
        s.text('C filters, stride 1', tx, y0 + u * 1, { size: 3.2, color: s.c('--ink-2'), align: 'left' });
        s.text('same padding', tx, y0 + u * 6, { size: 3.2, color: s.c('--ink-2'), align: 'left' });
      });
      s.alpha(s.ease('cost', 0.6), () => {
        s.text('per output number:', tx, y0 + u * 16, { size: 3.2, color: s.c('--ink-2'), align: 'left' });
        s.text('1 multiply-add', tx, y0 + u * 21, { size: 3.4, font: 'mono', weight: 600, align: 'left' });
        s.text('per filter weight', tx, y0 + u * 26, { size: 3.4, font: 'mono', weight: 600, align: 'left' });
        s.text('outputs: H · H · C', tx, y0 + u * 33, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('purple') });
      });
    });
    // Receptive fields: one 7x7 against three 3x3.
    const rA = s.win('seven', 'why');
    s.alpha(rA, () => {
      const pw = Math.min(u * 54, (w - u * 12) / 2);
      const lx = cx - pw / 2 - u * 3;
      const rx = cx + pw / 2 + u * 3;
      const cs = Math.min(u * 6.4, pw / 7.6);
      const yIn = u * 60;
      s.text('one 7×7 layer', lx, u * 9, { size: 4.2, font: 'display', weight: 600 });
      const yOut = u * 22;
      const inL = cellRow(s, lx, yIn, 7, cs, 'orange', () => 0.6);
      cellRow(s, lx, yOut, 1, cs, 'purple', () => 1);
      for (let i = 0; i < 7; i++) s.line(lx, yOut + cs * 0.8, inL + i * cs + cs / 2, yIn, s.tint('blue', 0.5), 0.3);
      s.text('1 ReLU', lx, yOut - u * 3.5, { size: 3, font: 'mono', color: s.c('--ink-3') });
      const tA = s.ease('three', 0.6);
      s.alpha(tA, () => {
        s.text('three 3×3 layers', rx, u * 9, { size: 4.2, font: 'display', weight: 600 });
        const ys = [yIn, u * 47.5, u * 35, yOut];
        const ns = [7, 5, 3, 1];
        const lefts = ns.map((n, r) => cellRow(s, rx, ys[r]!, n, cs, r === 0 ? 'orange' : 'purple', () => (r === 3 ? 1 : 0.35)));
        for (let r = 1; r < 4; r++)
          for (let i = 0; i < ns[r]!; i++)
            for (let j = 0; j < 3; j++) s.line(lefts[r]! + i * cs + cs / 2, ys[r]! + cs * 0.8, lefts[r - 1]! + (i + j) * cs + cs / 2, ys[r - 1]!, s.tint('blue', 0.35), 0.22);
        s.text('3 ReLUs', rx, yOut - u * 3.5, { size: 3, font: 'mono', color: s.c('--ink-3') });
      });
      // costs
      const by = u * 75;
      const bmax = pw * 0.9;
      s.alpha(s.ease('seven', 0.6, 1.2), () => {
        s.text('49 · H²C²', lx, by, { size: 4, font: 'mono', weight: 650, color: s.c('blue') });
        s.rrect(lx - bmax / 2, by + u * 4, bmax, u * 3.4, 0.6, { fill: s.tint('blue', 0.5) });
      });
      s.alpha(s.ease('three', 0.6, 1.6), () => {
        s.text('27 · H²C²', rx, by, { size: 4, font: 'mono', weight: 650, color: s.c('blue') });
        s.rrect(rx - bmax / 2, by + u * 4, (bmax * 27) / 49, u * 3.4, 0.6, { fill: s.tint('blue', 0.5) });
      });
      s.alpha(s.ease('good', 0.6), () => pill(s, 'GOOD: less compute, more nonlinearity', cx, u * 91, 'green', { size: fit(s, 'GOOD: less compute, more nonlinearity', w - u * 14, 3.4, { font: 'ui', weight: 600 }) }));
    });
    // The bottleneck sandwich.
    const bA = s.win('why', 'factor');
    s.alpha(bA, () => {
      s.text('the 1×1 bottleneck', cx, u * 9, { size: 5, font: 'display', weight: 600 });
      const full = Math.min(u * 13, w * 0.1);
      const half = full / 2;
      const fh = u * 28;
      const dep = u * 8;
      const dx = dep * 0.7;
      const ws = [full, half, half, full];
      const solid = ws.reduce((a, b) => a + b, 0) + 4 * dx;
      const ar = Math.min(u * 18, (w - u * 10 - solid) / 3);
      let x = cx - (solid + 3 * ar) / 2;
      const y0 = u * 34;
      const labs = ['C', 'C/2', 'C/2', 'C'];
      const ids = ['why', 'squeeze', 'middle', 'expand'];
      const ops = ['1×1', '3×3', '1×1'];
      const costs = ['0.5 C²', '2.25 C²', '0.5 C²'];
      ws.forEach((wd, i) => {
        const a = i === 0 ? 1 : s.ease(ids[i]!, 0.6, 0.3);
        const xi = x;
        s.alpha(a, () => {
          if (i > 0) {
            const ax = xi - ar;
            s.arrow(ax + u * 1, y0 + fh / 2, xi - u * 1.2, y0 + fh / 2, s.c('blue'), 0.45, 1.8);
            s.text(ops[i - 1]!, ax + ar / 2, y0 + fh / 2 - u * 4, { size: 3.4, font: 'mono', weight: 650, color: s.c('blue') });
            s.text(costs[i - 1]!, ax + ar / 2, y0 + fh / 2 + u * 5, { size: fit(s, costs[i - 1]!, ar - u, 3, { font: 'mono' }), font: 'mono', color: s.c('--ink-2') });
          }
          cuboid(s, xi, y0, wd, fh, dep, 'orange');
          s.text(labs[i]!, xi + wd / 2, y0 + fh + u * 5, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange') });
        });
        x += wd + dx + ar;
      });
      s.alpha(1 - s.ease('squeeze', 0.5), () => s.text('a 1×1 conv mixes channels, pixel by pixel', cx, u * 22, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      s.alpha(s.ease('expand', 0.6, 1.2), () => {
        s.text('3.25 C²  vs  9 C² for one 3×3', cx, u * 84, { size: 4, font: 'mono', weight: 650, color: s.c('blue') });
        s.text('a third of the weights, and three ReLUs', cx, u * 91, { size: 3.4, italic: true, color: s.c('--ink-2') });
      });
    });
    // 1x3 then 3x1.
    const fA = s.win('factor', 'bars');
    s.alpha(fA, () => {
      s.text('1×3, then 3×1', cx, u * 9, { size: 5, font: 'display', weight: 600 });
      const cs = u * 8;
      const gx = cx - u * 34;
      const gy = u * 22;
      const p = s.prog('factor');
      const row = Math.min(2, Math.floor(p * 6));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s.cell(gx + j * cs, gy + i * cs, cs * 0.92, cs * 0.92, '', 'orange', { on: p < 0.5 && i === row ? 1 : 0.2 });
      if (p < 0.5) s.rrect(gx - u * 0.6, gy + row * cs - u * 0.6, 3 * cs, cs * 0.92 + u * 1.2, 0.6, { stroke: s.c('blue'), lw: 0.5 });
      s.text('1×3', gx + 1.5 * cs, gy + 3 * cs + u * 5, { size: 3.4, font: 'mono', weight: 650, color: s.c('blue') });
      const mx = cx - u * 4;
      s.arrow(gx + 3 * cs + u * 2, gy + 1.5 * cs, mx - u * 2, gy + 1.5 * cs, s.c('--ink-3'), 0.4, 1.8);
      for (let i = 0; i < 3; i++) s.cell(mx, gy + i * cs, cs * 0.92, cs * 0.92, '', 'purple', { on: p < 0.5 ? (i <= row ? 0.6 : 0) : 0.9 });
      s.alpha(clamp01((p - 0.45) * 6), () => {
        s.rrect(mx - u * 0.6, gy - u * 0.6, cs * 0.92 + u * 1.2, 3 * cs, 0.6, { stroke: s.c('blue'), lw: 0.5 });
        s.text('3×1', mx + cs / 2, gy + 3 * cs + u * 5, { size: 3.4, font: 'mono', weight: 650, color: s.c('blue') });
        s.arrow(mx + cs + u * 2, gy + 1.5 * cs, mx + cs + u * 12, gy + 1.5 * cs, s.c('--ink-3'), 0.4, 1.8);
        s.cell(mx + cs + u * 14, gy + cs, cs * 0.92, cs * 0.92, '', 'purple', { on: 1 });
        s.text('sees all 3×3', mx + cs + u * 18, gy + 3 * cs + u * 5, { size: 3.2, color: s.c('--ink-2') });
      });
      s.alpha(clamp01((p - 0.35) * 5), () => s.text('3 + 3 = 6 C²   vs   9 C²', cx, u * 66, { size: 4, font: 'mono', weight: 650, color: s.c('blue') }));
      s.alpha(clamp01((p - 0.65) * 5), () => {
        s.text('N × N:  2N  vs  N²', cx, u * 76, { size: 3.8, font: 'mono', weight: 600 });
        s.text('N = 3: 6 vs 9      N = 7: 14 vs 49', cx, u * 84, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
      });
    });
    // Five designs.
    s.alpha(s.ease('bars', 0.6), () => {
      s.text('five ways to cover a region', cx, u * 9, { size: 5, font: 'display', weight: 600 });
      const labW = Math.min(u * 30, w * 0.27);
      const x0 = Math.max(u * 5, cx - u * 62);
      const bx = x0 + labW;
      const bmax = Math.min(w - u * 5, cx + u * 62) - bx - u * 16;
      const rowH = u * 14;
      DESIGNS.forEach(([nm, c2, relu], i) => {
        const a = clamp01((s.t - at(s, 'bars', 0.05 + i * 0.1)) * 3);
        const y = u * 20 + i * rowH;
        s.alpha(a, () => {
          s.text(nm, x0, y + u * 2.5, { size: fit(s, nm, labW - u * 2, 3.5, { weight: 600 }), weight: 600, align: 'left' });
          s.text(`${relu} ReLU${relu > 1 ? 's' : ''}`, x0, y + u * 7.5, { size: 3, align: 'left', color: s.c('--ink-3') });
          const len = (bmax * c2) / 49 * smooth(a);
          s.rrect(bx, y, Math.max(len, u * 0.5), u * 6.5, 0.6, { fill: s.tint('blue', 0.5) });
          s.text(`${c2} C²`, bx + len + u * 2, y + u * 3.4, { size: 3.4, font: 'mono', weight: 600, align: 'left' });
        });
      });
    });
  },
};

// ---------------------------------------------------------------- im2col

const IR = new Rng(17);
const XG = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => IR.int(5)));
const WF = [0, 1].map(() => Array.from({ length: 9 }, () => IR.int(3) - 1));
const POS: [number, number][] = Array.from({ length: 9 }, (_, m) => [Math.floor(m / 3), m % 3]);
const COL = (m: number): number[] => {
  const [i, j] = POS[m]!;
  const out: number[] = [];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) out.push(XG[i + a]![j + b]!);
  return out;
};
const RES = WF.map((wr) => POS.map((_, m) => COL(m).reduce((acc, x, r) => acc + x * wr[r]!, 0)));

const im2col: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const c = Math.min((w - u * 8) / 18.8, (h - u * 30) / 11.6);
    const xL = (w - 18.8 * c) / 2;
    const xC = xL + 9.6 * c;
    const yC = u * 11;
    const yR = yC + 9 * c + u * 6;
    const fs = Math.min(4.2, (c / u) * 0.55);
    const ls = 3.2;
    const cost = s.ease('cost', 0.7);
    const main = s.ease('patch', 0.6);
    const fadeX = 1 - s.ease('reshape', 0.6);
    s.alpha(1 - 0.88 * cost, () => {
      // timings of each column filling
      const tCol = (m: number) => (m === 0 ? at(s, 'col', 0.08) : at(s, 'repeat', 0.02 + (m - 1) * 0.055));
      const fly = (m: number) => clamp01((s.t - tCol(m)) / (m === 0 ? 0.9 : 0.3));
      let curM = 0;
      for (let m = 0; m < 9; m++) if (s.t >= tCol(m)) curM = m;
      const building = s.since('wrow') < 0;
      const intro = 1 - main;
      const slide = Math.floor(s.t * 2.2) % 9;
      const [pi, pj] = POS[intro > 0.5 ? slide : curM]!;
      const mid = s.ease('repeat', 0.5, 0) > 0 ? clamp01((s.t - at(s, 'repeat', 0.55)) / 0.5) : 0;
      // X and the two filters
      s.alpha(fadeX, () => {
        s.text('X (5×5)', xL, yC - u * 3, { size: ls, weight: 650, color: s.c('orange'), align: 'left' });
        for (let r = 0; r < 5; r++)
          for (let q = 0; q < 5; q++) {
            const inW = building && r >= pi && r < pi + 3 && q >= pj && q < pj + 3;
            const isMid = r === 2 && q === 2;
            s.cell(xL + q * c, yC + r * c, c * 0.94, c * 0.94, String(XG[r]![q]!), isMid && mid > 0 ? 'gold' : 'orange', { on: inW ? 0.75 : isMid ? mid : 0, size: fs });
          }
        if (building) s.rrect(xL + pj * c - u * 0.5, yC + pi * c - u * 0.5, 3 * c - 0.06 * c + u, 3 * c - 0.06 * c + u, 0.8, { stroke: s.c('orange'), lw: 0.6 });
        const fc = c * 0.9;
        const fx = xL + 5.5 * c;
        for (let k = 0; k < 2; k++) {
          const fy = yC + k * (3 * fc + 1.1 * c) + 0.2 * c;
          const on = s.since('wrow') >= 0 && s.since('mm') < 0 ? 0.7 : 0;
          s.text(`W[${k}]`, fx, fy - u * 1.8, { size: 2.9, font: 'mono', color: s.c('blue'), align: 'left' });
          for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) s.cell(fx + q * fc, fy + r * fc, fc * 0.94, fc * 0.94, String(WF[k]![r * 3 + q]!), 'blue', { on, size: fs * 0.9 });
        }
      });
      // the plain way, before the trick
      s.alpha(intro, () => {
        const rx = xC + 4.5 * c;
        const oc = c * 0.9;
        s.text('the direct way:', rx, yC + u * 1, { size: 3.4, color: s.c('--ink-2') });
        for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) s.cell(rx - 1.5 * oc + q * oc, yC + u * 5 + r * oc, oc * 0.94, oc * 0.94, r * 3 + q <= slide ? String(RES[0]![r * 3 + q]!) : '', 'purple', { on: r * 3 + q === slide ? 1 : 0.2, size: fs });
        s.text('9 positions, one at a time', rx, yC + u * 8 + 3 * oc, { size: 3.2, italic: true, color: s.c('--ink-3') });
        s.alpha(s.ease('blas', 0.6), () => {
          pill(s, 'BLAS (CPU)', rx - u * 1.5, yR + u * 2, 'slate', { size: 3.3, align: 'right' });
          pill(s, 'cuBLAS (GPU)', rx + u * 1.5, yR + u * 2, 'green', { size: 3.3, align: 'left' });
          s.text('matrix multiply: tuned to the last instruction', cx(s), yR + u * 11, { size: fit(s, 'matrix multiply: tuned to the last instruction', w - u * 10, 3.4), color: s.c('--ink-2') });
        });
        s.alpha(s.ease('idea', 0.6), () => s.text('im2col: image → columns → one matmul', cx(s), yR + u * 19, { size: fit(s, 'im2col: image → columns → one matmul', w - u * 10, 3.8, { font: 'mono', weight: 650 }), font: 'mono', weight: 650, color: s.c('--accent') }));
      });
      s.alpha(main, () => {
        s.text('X_col (9×9)', xC, yC - u * 3, { size: ls, weight: 650, color: s.c('orange'), align: 'left', font: 'mono' });
        const mmIdx = s.since('mm') >= 0 ? Math.min(17, Math.floor(s.prog('mm') * 1.25 * 18)) : -1;
        for (let m = 0; m < 9; m++) {
          const f = fly(m);
          const vals = COL(m);
          for (let r = 0; r < 9; r++) {
            const hotCol = mmIdx >= 0 && mmIdx % 9 === m && s.since('reshape') < 0;
            const isMid = vals[r] === XG[2]![2]! && POS[m]![0] + Math.floor(r / 3) === 2 && POS[m]![1] + (r % 3) === 2;
            s.cell(xC + m * c, yC + r * c, c * 0.94, c * 0.94, f >= 1 ? String(vals[r]!) : '', isMid && mid > 0 ? 'gold' : 'orange', { on: f >= 1 ? (building && m === curM ? 0.75 : hotCol ? 0.8 : isMid ? mid : 0.1) : 0, size: fs });
          }
          // values flying from the patch into the column
          if (f > 0 && f < 1) {
            const [i0, j0] = POS[m]!;
            const e = smooth(f);
            for (let r = 0; r < 9; r++) {
              const sx0 = xL + (j0 + (r % 3)) * c + c * 0.47;
              const sy0 = yC + (i0 + Math.floor(r / 3)) * c + c * 0.47;
              const tx = xC + m * c + c * 0.47;
              const ty = yC + r * c + c * 0.47;
              s.text(String(vals[r]!), lerp(sx0, tx, e), lerp(sy0, ty, e), { size: fs, font: 'mono', weight: 650, color: s.c('orange') });
            }
          }
        }
        s.alpha(mid * (1 - s.ease('wrow', 0.4)), () => s.text('the middle pixel: in all nine columns', xC + 4.5 * c, yC + 9 * c + u * 3.2, { size: 3, color: s.c('gold'), weight: 600 }));
      });
      // W_row and the product
      const wA = s.ease('wrow', 0.6);
      s.alpha(wA, () => {
        s.text('W_row (2×9)', xL, yR - u * 2.4, { size: ls, weight: 650, color: s.c('blue'), align: 'left', font: 'mono' });
        const mmIdx = s.since('mm') >= 0 ? Math.min(17, Math.floor(s.prog('mm') * 1.25 * 18)) : -1;
        for (let k = 0; k < 2; k++)
          for (let r = 0; r < 9; r++) {
            const a = clamp01((s.t - at(s, 'wrow', 0.15 + k * 0.3 + r * 0.02)) * 4);
            const hot = mmIdx >= 0 && Math.floor(mmIdx / 9) === k && s.since('reshape') < 0;
            s.alpha(a, () => s.cell(xL + r * c, yR + k * c, c * 0.94, c * 0.94, String(WF[k]![r]!), 'blue', { on: hot ? 0.8 : 0.15, size: fs }));
          }
        s.text('out (2×9)', xC, yR - u * 2.4, { size: ls, weight: 650, color: s.c('purple'), align: 'left', font: 'mono' });
        for (let k = 0; k < 2; k++)
          for (let m = 0; m < 9; m++) {
            const idx = k * 9 + m;
            const done = mmIdx >= idx;
            const rowOn = s.since('reshape') >= 0 ? 0.5 : 0;
            s.cell(xC + m * c, yR + k * c, c * 0.94, c * 0.94, done ? String(RES[k]![m]!) : '', 'purple', { on: done ? (idx === mmIdx && s.since('reshape') < 0 ? 1 : 0.25 + rowOn) : 0, size: fs });
          }
        s.alpha(s.ease('mm', 0.5, 0.4), () => s.text('out = W_row · X_col: every filter against every patch', cx(s), yR + 2 * c + u * 5, { size: fit(s, 'out = W_row · X_col: every filter against every patch', w - u * 8, 3.2, { font: 'mono' }), font: 'mono', color: s.c('purple') }));
      });
      // reshaped back into maps
      const rA = s.ease('reshape', 0.7, 0.3);
      s.alpha(rA, () => {
        for (let k = 0; k < 2; k++) {
          const ox = xL + k * 4.6 * c;
          s.text(`A[${k}]`, ox, yC - u * 3, { size: ls, weight: 650, color: s.c('purple'), align: 'left', font: 'mono' });
          for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) s.cell(ox + q * c * 1.2, yC + u * 1 + r * c * 1.2, c * 1.14, c * 1.14, String(RES[k]![r * 3 + q]!), 'purple', { on: 0.35, size: fs });
        }
        s.text('two 3×3 activation maps', xL, yC + u * 4 + 3.6 * c + u * 2, { size: 3.1, italic: true, color: s.c('--ink-2'), align: 'left' });
      });
    });
    // The memory bill.
    if (cost > 0) {
      s.alpha(cost, () => {
        const cw = Math.min(w - u * 12, u * 104);
        const ch = u * 54;
        const x0 = (w - cw) / 2;
        const y0 = u * 20;
        s.rrect(x0, y0, cw, ch, 2.4, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.4 });
        s.text("AlexNet's first layer", x0 + cw / 2, y0 + u * 7, { size: 4.4, font: 'display', weight: 600 });
        const bmax = cw - u * 12;
        const bx = x0 + u * 6;
        const e = s.ease('cost', 1, 0.8);
        s.text('X: 227 × 227 × 3 = 154,587', bx, y0 + u * 16, { size: fit(s, 'X: 227 × 227 × 3 = 154,587', bmax, 3.3, { font: 'mono' }), font: 'mono', align: 'left', color: s.c('orange') });
        s.rrect(bx, y0 + u * 19, (bmax / 7.1) * e, u * 4, 0.6, { fill: s.tint('orange', 0.55) });
        s.text('X_col: 363 × 3,025 = 1,098,075', bx, y0 + u * 30, { size: fit(s, 'X_col: 363 × 3,025 = 1,098,075', bmax, 3.3, { font: 'mono' }), font: 'mono', align: 'left', color: s.c('orange') });
        s.rrect(bx, y0 + u * 33, bmax * e, u * 4, 0.6, { fill: s.tint('orange', 0.55) });
        s.text('7.1× the memory', bx + bmax, y0 + u * 42, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('--accent') });
        s.alpha(clamp01((s.t - at(s, 'cost', 0.7)) / 0.5), () => s.text('Caffe: im2col, then one cuBLAS call', x0 + cw / 2, y0 + u * 49, { size: fit(s, 'Caffe: im2col, then one cuBLAS call', bmax, 3.3), color: s.c('--ink-2') }));
      });
    }
  },
};

const cx = (s: Scene): number => s.w / 2;

export const scenesB: Record<string, SceneDef> = { transfer, strategy, stack, im2col };
