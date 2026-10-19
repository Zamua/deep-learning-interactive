import { CIFAR_CLASSES } from '../../core/data';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { type Stage, argmax, softmax } from '../../lib/visualizing-net';
import { assets, filterCanvas, once, stageMaps, testImg, traceOf, gradCanvas, mapCanvas, type Assets } from './data';
import { type K, type Rect, area, bars, cap, fit, loading, pic, pill, ring } from './kit';

// ---------------------------------------------------------------- the toolbox tiles

export const TOOLS: [string, string, K][] = [
  ['activations', 'each layer\'s response', 'green'],
  ['filters', 'layer one\'s patterns', 'blue'],
  ['top images', 'what excites a unit', 'purple'],
  ['t-SNE', 'which images look alike', 'purple'],
  ['occlusion', 'which regions matter', 'orange'],
  ['saliency', 'which pixels matter', 'teal'],
  ['class images', 'a class, drawn', 'teal'],
  ['inversion', 'what a code keeps', 'green'],
  ['DeepDream', 'more of what it sees', 'gold'],
  ['style', 'texture, not layout', 'gold'],
  ['adversarial', 'how fragile it is', 'red'],
];

/**
 * The eleven tools as tiles. With `thumb`, each tile shows a small picture over its name;
 * without, its name over the question it answers.
 */
export function toolTiles(s: Scene, rect: Rect, appear: (i: number) => number, lit: (i: number) => number, thumb?: (i: number, x: number, y: number, size: number) => void, done?: (i: number) => number): void {
  const [rx, ry, rw, rh] = rect;
  const cols = rw > rh * 1.25 ? 4 : 3;
  const rows = Math.ceil(TOOLS.length / cols);
  const gap = s.u * 2;
  const tw = (rw - gap * (cols - 1)) / cols;
  const th = Math.min((rh - gap * (rows - 1)) / rows, tw * (thumb ? 0.95 : 0.6));
  const oy = ry + (rh - (th * rows + gap * (rows - 1))) / 2;
  const last = TOOLS.length - (rows - 1) * cols;
  TOOLS.forEach(([name, sub, k], i) => {
    const a = appear(i);
    if (a <= 0) return;
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inLast = r === rows - 1;
    const x = rx + c * (tw + gap) + (inLast ? ((cols - last) * (tw + gap)) / 2 : 0);
    const y = oy + r * (th + gap) + (1 - a) * s.u * 3;
    const on = lit(i);
    s.alpha(a, () => {
      s.rrect(x, y, tw, th, 2, { fill: s.tint(k, 0.06 + 0.16 * on), stroke: s.tint(k, 0.35 + 0.6 * on), lw: 0.3 + 0.3 * on });
      const fs = fit(s, name, tw * 0.86, 4.4, 'display', 600);
      if (thumb) {
        const ps = Math.min(th * 0.62, tw * 0.7);
        thumb(i, x + (tw - ps) / 2, y + th * 0.08, ps);
        s.text(name, x + tw / 2, y + th * 0.85, { size: Math.min(fs, 3.8), font: 'display', weight: 600 });
      } else {
        s.text(name, x + tw / 2, y + th * 0.38, { size: fs, font: 'display', weight: 600 });
        s.text(sub, x + tw / 2, y + th * 0.7, { size: fit(s, sub, tw * 0.88, 3.2, 'ui'), font: 'ui', color: s.c(k) });
      }
      if (done) {
        s.alpha(done(i), () => {
          const cx = x + tw - s.u * 2.8;
          const cy = y + s.u * 2.8;
          s.circle(cx, cy, s.u * 1.8, { fill: s.c('green') });
          s.line(cx - s.u * 0.85, cy, cx - s.u * 0.2, cy + s.u * 0.65, '#fff', 0.42);
          s.line(cx - s.u * 0.2, cy + s.u * 0.65, cx + s.u * 0.95, cy - s.u * 0.65, '#fff', 0.42);
        });
      }
    });
  });
}

// ---------------------------------------------------------------- intro

/** The test image the opening scenes share: a gray cat the network gets right. */
export const CAT = (a: Assets): number => a.gallery[3]!;

function blackBox(s: Scene, a: Assets | null): void {
  const { w, h, u } = s;
  const tall = s.tall;
  const L = tall ? Math.min(w * 0.3, h * 0.3) : Math.min(w * 0.22, h * 0.34);
  const cy = tall ? h * 0.32 : h * 0.52;
  const px = tall ? w * 0.12 : w * 0.05;
  const bx = tall ? w * 0.68 : w * 0.42;
  const bw = L * 1.15;
  const bh = L;
  pic(s, a ? testImg(a, CAT(a)) : null, px, cy - L / 2, L);
  cap(s, 'a photo', px + L / 2, cy + L / 2 + u * 3.6);
  s.arrow(px + L + u * 1.5, cy, bx - bw / 2 - u * 1.5, cy, s.c('--ink-3'), 0.45, 2.4);
  s.rrect(bx - bw / 2, cy - bh / 2, bw, bh, 2.5, { fill: s.tint('slate', 0.16), stroke: s.c('slate'), lw: 0.5 });
  s.text('ConvNet', bx, cy - bh / 2 - u * 3, { size: 3.8, font: 'display', weight: 600, color: s.c('slate') });
  const wA = s.ease('how', 0.8);
  s.alpha((1 - wA) * s.ease('cat', 0.5, 0.4), () => s.text('?', bx, cy + u * 0.8, { size: 12, font: 'display', weight: 600, color: s.c('slate') }));
  if (a && wA > 0) {
    // A window onto the real weights: the fully connected layer, blue positive, red negative.
    const W = a.net.fcW;
    const n = 14;
    const m = 11;
    const cw = (bw - u * 3) / n;
    const ch = (bh - u * 3) / m;
    s.alpha(wA, () => {
      for (let i = 0; i < m; i++)
        for (let j = 0; j < n; j++) {
          const v = W[(i * 97 + j * 61) % W.length]! * 18;
          const shown = clamp01(s.prog('how') * 1.6 * (n * m) - (i * n + j) * 0.9 + n * m * 0.4);
          if (shown <= 0) continue;
          s.ctx.fillStyle = s.tint(v > 0 ? 'blue' : 'red', Math.min(0.85, 0.15 + Math.abs(v)) * shown);
          s.ctx.fillRect(bx - bw / 2 + u * 1.5 + j * cw + 0.5, cy - bh / 2 + u * 1.5 + i * ch + 0.5, cw - 1, ch - 1);
        }
    });
    s.alpha(s.ease('how', 0.6, 1.2), () => cap(s, '35,754 numbers', bx, cy + bh / 2 + u * 3.6, { font: 'mono', color: s.c('blue') }));
  }
  const bX = tall ? w * 0.14 : w * 0.6;
  const bW = tall ? w * 0.74 : w * 0.95 - bX;
  const bH = tall ? h * 0.38 : Math.min(L * 1.55, h * 0.56);
  const bY = tall ? h * 0.57 : cy - bH / 2;
  if (tall) s.arrow(bx, cy + bh / 2 + u * 7, bx, bY - u * 0.5, s.c('--ink-3'), 0.45, 2.4);
  else s.arrow(bx + bw / 2 + u * 1.5, cy, bX - u * 1, cy, s.c('--ink-3'), 0.45, 2.4);
  if (a) {
    const p = softmax(traceOf(a, CAT(a)).scores);
    const g = s.ease('cat', 0.9, 0.6);
    const pr = Array.from(p, (v) => v * g);
    bars(s, pr, bX, bY, bW, bH, { mark: g > 0.6 ? argmax(p) : undefined });
  } else loading(s, bX + bW / 2, bY + bH / 2);
}

const REASONS: [string, string, string, K][] = [
  ['debugging', 'does it key on the', 'wrong evidence?', 'red'],
  ['trust', 'does it use sensible', 'parts of the image?', 'blue'],
  ['science', 'what did it discover', 'on its own?', 'green'],
];

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const a = assets(s);
    s.alpha(s.win('hello', 'cat'), () => {
      s.text('Looking inside', w / 2, h * 0.44, { size: 10, font: 'display', weight: 600 });
      s.text('understanding and visualizing ConvNets', w / 2, h * 0.57, { size: fit(s, 'understanding and visualizing ConvNets', w * 0.86, 4.6, 'serif'), italic: true, color: s.c('--ink-2') });
    });
    const bA = s.win('cat', 'toolbox');
    if (bA > 0) s.alpha(bA, () => blackBox(s, a));
    // The toolbox, and why anyone wanted one.
    const hA = s.win('toolbox', 'tools');
    s.alpha(hA, () => {
      const lift = s.ease('why', 0.7);
      s.text('a toolbox for looking inside', w / 2, lerp(h * 0.44, h * 0.19, lift), { size: fit(s, 'a toolbox for looking inside', w * 0.88, lerp(7, 5.6, lift), 'display', 600), font: 'display', weight: 600 });
      s.alpha(1 - lift, () => s.text('2013 to 2015', w / 2, h * 0.56, { size: 4.4, italic: true, color: s.c('--ink-2') }));
      const p = s.prog('why');
      const on = [p >= 0 && s.since('why') >= 0, p > 0.58, p > 0.68];
      const tall = s.tall;
      const cw = tall ? w * 0.8 : (w * 0.9 - u * 4) / 3;
      const chh = tall ? h * 0.19 : h * 0.42;
      REASONS.forEach(([name, l1, l2, k], i) => {
        if (!on[i]) return;
        const x = tall ? (w - cw) / 2 : w * 0.05 + i * (cw + u * 2);
        const y = tall ? h * 0.3 + i * (chh + u * 2.2) : h * 0.36;
        const ap = s.ease('why', 0.5, i === 0 ? 0 : (i === 1 ? 0.58 : 0.68) * (s.end('why') - s.at('why')));
        s.alpha(ap, () => {
          s.rrect(x, y, cw, chh, 2.2, { fill: s.tint(k, 0.08), stroke: s.tint(k, 0.6) });
          if (tall) {
            s.text(name, x + u * 4, y + chh * 0.5, { size: 5, font: 'display', weight: 600, color: s.c(k), align: 'left' });
            const tx = x + cw * 0.45;
            s.text(l1, tx, y + chh * 0.36, { size: fit(s, l1, cw * 0.52, 3.5, 'ui'), font: 'ui', align: 'left' });
            s.text(l2, tx, y + chh * 0.66, { size: fit(s, l1, cw * 0.52, 3.5, 'ui'), font: 'ui', align: 'left' });
          } else {
            s.text(name, x + cw / 2, y + chh * 0.3, { size: fit(s, name, cw * 0.85, 5.4, 'display', 600), font: 'display', weight: 600, color: s.c(k) });
            s.text(l1, x + cw / 2, y + chh * 0.58, { size: fit(s, l1, cw * 0.88, 3.6, 'ui'), font: 'ui' });
            s.text(l2, x + cw / 2, y + chh * 0.73, { size: fit(s, l1, cw * 0.88, 3.6, 'ui'), font: 'ui' });
          }
        });
      });
    });
    const tA = s.ease('tools', 0.5);
    if (tA > 0) {
      const dim = 1 - 0.7 * s.ease('clue', 0.6);
      s.alpha(dim, () =>
        toolTiles(
          s,
          area(s, 0.1, 0.05),
          (i) => s.ease('tools', 0.5, 0.1 * i),
          (i) => (Math.floor(s.prog('tools') * TOOLS.length * 1.05) === i && s.since('clue') < 0 ? 1 : 0),
        ),
      );
      const cA = s.ease('clue', 0.7, 0.5);
      s.alpha(cA, () => {
        const t1 = 'a clue,';
        const t2 = 'not an explanation';
        const fs = fit(s, t2, w * 0.8, 8, 'display', 600);
        const bw = s.measure(t2, { size: fs, font: 'display', weight: 600 }) + u * 10;
        s.rrect(w / 2 - bw / 2, h * 0.5 - fs * u * 1.6, bw, fs * u * 3.2, 3, { fill: s.c('--card'), stroke: s.c('--accent'), lw: 0.5 });
        s.text(t1, w / 2, h * 0.5 - fs * u * 0.6, { size: fs, font: 'display', weight: 600, color: s.c('--accent') });
        s.text(t2, w / 2, h * 0.5 + fs * u * 0.7, { size: fs, font: 'display', weight: 600 });
      });
    }
  },
};

// ---------------------------------------------------------------- network

interface Node {
  name: string;
  st: Stage | 'input' | 'scores';
  shape: string;
  res: number;
}

const NODES: Node[] = [
  { name: 'input', st: 'input', shape: '3×32×32', res: 32 },
  { name: 'conv1', st: 'relu1', shape: '16×32×32', res: 32 },
  { name: 'pool1', st: 'pool1', shape: '16×16×16', res: 16 },
  { name: 'conv2', st: 'relu2', shape: '32×16×16', res: 16 },
  { name: 'pool2', st: 'pool2', shape: '32×8×8', res: 8 },
  { name: 'conv3', st: 'relu3', shape: '64×8×8', res: 8 },
  { name: 'pool3', st: 'pool3', shape: '64×4×4', res: 4 },
  { name: 'scores', st: 'scores', shape: '10', res: 0 },
];

/** The three most active maps of a stage for an image, as canvases. */
function deck(a: Assets, img: number, st: Stage): HTMLCanvasElement[] {
  return once(`deck-${img}-${st}`, () => {
    const F = a.net.stage(traceOf(a, img), st);
    const [C, H] = a.net.shape(st);
    const sums = Array.from({ length: C }, (_, k) => {
      let t = 0;
      for (let i = k * H * H; i < (k + 1) * H * H; i++) t += F[i]!;
      return [t, k] as [number, number];
    }).sort((p, q) => q[0] - p[0]);
    const maps = stageMaps(a, img, st);
    return sums.slice(0, 3).map(([, k]) => maps[k]!);
  });
}

function netLayout(s: Scene) {
  const [rx, , rw] = area(s, 0.12, 0.04);
  const colW = rw / 4;
  const S = Math.min(colW * 0.6, s.h * 0.19);
  const ys = [s.h * 0.33, s.h * 0.73];
  const pos = NODES.map((_, i) => [rx + colW * (i % 4) + colW / 2, ys[Math.floor(i / 4)]!] as [number, number]);
  const size = (n: Node) => (n.res === 0 ? S : S * Math.max(0.45, Math.sqrt(n.res / 32)));
  return { S, pos, size, colW };
}

const network: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const a = assets(s);
    if (!a) return loading(s);
    const img = CAT(a);
    const { S, pos, size } = netLayout(s);
    const tr = traceOf(a, img);
    const probs = softmax(tr.scores);
    // How lit each node is, by beat.
    const lit = (i: number): number => {
      if (i === 0) return s.win('input', 'blocks');
      if (i % 2 === 1 && i < 7) return s.win('blocks', 'code') * (s.prog('blocks') > [0.68, 0.8, 0.9][(i - 1) / 2]! ? 1 : 0);
      if (i % 2 === 0 && i < 7) return s.win('relu', 'code') * (s.prog('relu') > 0.45 ? 1 : 0) + (i === 6 ? s.win('code', 'fc') : 0);
      return s.win('fc', 'cache');
    };
    const appear = (i: number) => s.ease('one', 0.6, 0.25 * i);
    const d = S * 0.09;
    // Connectors.
    for (let i = 0; i < 7; i++) {
      const a0 = Math.min(appear(i), appear(i + 1));
      if (a0 <= 0) continue;
      const [x0, y0] = pos[i]!;
      const [x1, y1] = pos[i + 1]!;
      const s0 = size(NODES[i]!) / 2 + d * 2 + u;
      const s1 = size(NODES[i + 1]!) / 2 + u * 1.5;
      s.alpha(a0, () => {
        if (y0 === y1) s.arrow(x0 + s0, y0, x1 - s1, y1, s.c('--ink-3'), 0.4, 2);
        else {
          const ym = (y0 + y1) / 2 + u * 2;
          const ctx = s.ctx;
          ctx.beginPath();
          ctx.moveTo(x0, y0 + size(NODES[i]!) / 2 + u * 9);
          ctx.lineTo(x0, ym);
          ctx.lineTo(x1, ym);
          ctx.strokeStyle = s.c('--ink-3');
          ctx.lineWidth = 0.4 * u;
          ctx.stroke();
          s.arrow(x1, ym, x1, y1 - size(NODES[i + 1]!) / 2 - d * 2 - u, s.c('--ink-3'), 0.4, 2);
        }
      });
    }
    // Nodes.
    NODES.forEach((n, i) => {
      const ap = appear(i);
      if (ap <= 0) return;
      const [cx, cy] = pos[i]!;
      const sz = size(n);
      const on = lit(i);
      s.alpha(ap, () => {
        if (n.st === 'input') pic(s, testImg(a, img), cx - sz / 2, cy - sz / 2, sz);
        else if (n.st === 'scores') {
          const bw = sz / 10;
          const best = argmax(probs);
          for (let k = 0; k < 10; k++) {
            const bh = sz * 0.9 * Math.max(0.03, probs[k]!) * s.ease('one', 0.8, 1.9);
            s.rrect(cx - sz / 2 + k * bw + bw * 0.15, cy + sz / 2 - bh, bw * 0.7, bh, 0.3, { fill: s.tint('purple', k === best ? 0.9 : 0.4) });
          }
          s.line(cx - sz / 2, cy + sz / 2, cx + sz / 2, cy + sz / 2, s.c('--axis'), 0.3);
          s.alpha(s.ease('fc', 0.5, 0.6), () => cap(s, CIFAR_CLASSES[best]!, cx, cy - sz / 2 - u * 2.6, { color: s.c('purple'), weight: 650 }));
        } else {
          const cards = deck(a, img, n.st);
          for (let k = 2; k >= 0; k--) pic(s, cards[k], cx - sz / 2 + d * k, cy - sz / 2 - d * k, sz, sz, s.c('--card'));
        }
        if (on > 0) ring(s, cx - sz / 2, cy - sz / 2 - (n.res && n.st !== 'input' ? d * 2 : 0), sz + (n.res && n.st !== 'input' ? d * 2 : 0), sz + (n.res && n.st !== 'input' ? d * 2 : 0), s.tint('--accent', on), 0.55);
        cap(s, n.name, cx, cy + sz / 2 + u * 3.4, { weight: 650, color: on > 0.5 ? s.c('--accent') : s.c('--ink') });
        cap(s, n.shape, cx, cy + sz / 2 + u * 7, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
      });
    });
    // The CNN code, the accuracy.
    const [px3, py3] = pos[6]!;
    s.alpha(s.win('code', 'cache'), () => pill(s, '1,024 numbers', px3, py3 - size(NODES[6]!) / 2 - d * 2 - u * 4.5, 'green', { size: 3.1 }));
    s.alpha(s.win('fc', 'cache'), () => cap(s, '82.3% right on test images', w / 2, h * 0.93, { size: 3.6, color: s.c('purple'), weight: 600 }));
    // The cache: every intermediate result kept.
    s.alpha(s.win('cache', 'bwd'), () => {
      for (let i = 1; i <= 6; i++) {
        const [cx, cy] = pos[i]!;
        const sz = size(NODES[i]!) + d * 2;
        s.rrect(cx - sz / 2 - u, cy - sz / 2 - d * 2 - u, sz + 2 * u, sz + 2 * u, 1.5, { stroke: s.c('gold'), lw: 0.45 });
      }
      cap(s, "cache['conv1'] … cache['pool3']", w / 2, h * 0.93, { size: 3.4, font: 'mono', color: s.c('gold'), weight: 600 });
    });
    // Backward to the image: a teal sweep from the scores to the pixels.
    const bA = s.ease('bwd', 0.4);
    if (bA > 0) {
      const p = clamp01(s.prog('bwd') * 1.35);
      const at = 7 - p * 7;
      s.alpha(bA, () => {
        for (let i = 7; i > 0; i--) {
          const f = clamp01(i - at);
          if (f <= 0) continue;
          const [x0, y0] = pos[i]!;
          const [x1, y1] = pos[i - 1]!;
          const yo = -(S * 0.5 + d * 2 + u * 2.5);
          if (y0 === y1) s.arrow(x0 - size(NODES[i]!) / 2, y0 + yo, lerp(x0 - size(NODES[i]!) / 2, x1 + size(NODES[i - 1]!) / 2, f), y1 + yo, s.c('teal'), 0.55, 2.2);
          else {
            // Up from pool2, along the elbow, and up into conv2: three legs, by length.
            const ym = (y0 + y1) / 2 + u * 2 - u * 1.2;
            const pts: [number, number][] = [
              [x0 - u * 1.2, y0 - size(NODES[i]!) / 2 - d * 2 - u * 1.5],
              [x0 - u * 1.2, ym],
              [x1 - u * 1.2, ym],
              [x1 - u * 1.2, y1 + size(NODES[i - 1]!) / 2 + u * 9],
            ];
            const lens = [0, 1, 2].map((q) => Math.hypot(pts[q + 1]![0] - pts[q]![0], pts[q + 1]![1] - pts[q]![1]));
            let left = f * (lens[0]! + lens[1]! + lens[2]!);
            for (let q = 0; q < 3 && left > 0; q++) {
              const g = Math.min(1, left / lens[q]!);
              const [ax, ay] = pts[q]!;
              const [bx2, by2] = pts[q + 1]!;
              const ex = lerp(ax, bx2, g);
              const ey = lerp(ay, by2, g);
              if (q === 2 || g < 1) s.arrow(ax, ay, ex, ey, s.c('teal'), 0.55, 2.2);
              else s.line(ax, ay, ex, ey, s.c('teal'), 0.55);
              left -= lens[q]!;
            }
          }
        }
        const gA = clamp01((p - 0.92) * 12);
        const [ix, iy] = pos[0]!;
        const sz = size(NODES[0]!);
        s.alpha(gA, () => {
          const gx = ix + sz * 0.18;
          const gy = iy - sz * 0.18;
          pic(s, gradCanvas(a, img), gx - sz / 2, gy - sz / 2, sz, sz, s.c('teal'));
          ring(s, gx - sz / 2, gy - sz / 2, sz, sz, s.c('teal'), 0.5);
          pill(s, 'dx', gx + sz / 2, gy - sz / 2, 'teal', { size: 3.2 });
        });
      });
    }
    s.alpha(s.ease('two', 0.6), () => {
      const t = 'two calls: forward, and backward to the image';
      cap(s, t, w / 2, h * 0.93, { size: fit(s, t, w * 0.9, 3.6, 'ui'), color: s.c('teal'), weight: 600 });
    });
  },
};

// ---------------------------------------------------------------- activations

const FK = 4;

/** Where filter FK matches the cat best, away from the border. */
function bestSpot(a: Assets): [number, number] {
  return once('bestspot', () => {
    const F = a.net.stage(traceOf(a, CAT(a)), 'relu1');
    let bi = 8;
    let bj = 8;
    for (let i = 5; i < 27; i++) for (let j = 5; j < 27; j++) if (F[FK * 1024 + i * 32 + j]! > F[FK * 1024 + bi * 32 + bj]!) [bi, bj] = [i, j];
    return [bi, bj];
  });
}

/** Filter FK's map revealed in raster order up to position `n`, the rest blank. */
function partialMap(a: Assets, n: number): HTMLCanvasElement {
  const q = Math.min(1024, Math.max(0, Math.round(n / 8) * 8));
  return once(`pmap-${q}`, () => {
    const F = a.net.stage(traceOf(a, CAT(a)), 'relu1');
    let hi = 0;
    for (let i = 0; i < 1024; i++) hi = Math.max(hi, F[FK * 1024 + i]!);
    const c = mapCanvas(F, FK * 1024, 32, hi);
    if (q >= 1024) return c;
    const ctx = c.getContext('2d')!;
    const img = ctx.getImageData(0, 0, 32, 32);
    for (let i = q; i < 1024; i++) img.data[i * 4 + 3] = 0;
    ctx.putImageData(img, 0, 0);
    return c;
  });
}

const STATS: [string, Stage, number][] = [
  ['conv1', 'relu1', 0.52],
  ['conv2', 'relu2', 0.59],
  ['conv3', 'relu3', 0.8],
];

/** The layer whose maps are on screen. */
function mapStage(s: Scene): Stage {
  if (s.since('deeper') < 0) return 'relu1';
  return s.prog('deeper') > 0.5 ? 'relu3' : 'relu2';
}

/** The bar of the zeros chart being read out. */
const zeroLit = (s: Scene): number => Math.min(2, Math.floor(s.prog('sparse') * 3.2));

const activations: SceneDef = {
  marks: {
    F: { tex: String.raw`\symF_k[i,j] = \max\!\big(0,\ \symW_k \cdot \symx_{(i,j)} + b_k\big)`, x: 0.5, y: 0.9, size: 4.6 },
  },
  draw(s) {
    const { w, u } = s;
    const a = assets(s);
    if (!a) return loading(s);
    const img = CAT(a);
    const W1 = a.net.convs[0]!.W;
    // The listing's slots follow whichever layer is on screen.
    const li = s.since('sparse') >= 0 ? zeroLit(s) : ['relu1', 'relu2', 'relu3'].indexOf(mapStage(s));
    const [C0, H0] = a.net.shape(STATS[li]![1]);
    s.slot('layer', STATS[li]![0]);
    s.slot('shape', `(${C0}, ${H0}, ${H0})`);
    s.slot('zeros', STATS[li]![2]);
    const filt = once('filter-k', () => filterCanvas(W1, FK * 147, 7));
    // Phase 1: one filter, sliding.
    const pA = s.win('what', 'maps');
    if (pA > 0) {
      const [rx, ry, rw, rh] = area(s, 0.13, 0.05);
      const P = Math.min((rw - u * 10) / 2.45, rh * 0.62);
      const top = ry + (rh - P) / 2 - u * 3;
      const x0 = rx + (rw - (P * 2.45 + u * 10)) / 2;
      const [bi, bj] = bestSpot(a);
      const sliding = s.since('slide') >= 0;
      const n = sliding ? clamp01(s.prog('slide') * 1.15) * 1024 : 0;
      const pos = sliding ? Math.min(1023, Math.floor(n)) : bi * 32 + bj;
      const pi = Math.floor(pos / 32);
      const pj = pos % 32;
      s.alpha(pA, () => {
        pic(s, testImg(a, img), x0, top, P);
        cap(s, 'x: the image', x0 + P / 2, top + P + u * 3.6, { color: s.c('orange') });
        const k = P / 32;
        s.alpha(s.ease('dot', 0.5), () => {
          s.ctx.save();
          s.ctx.beginPath();
          s.ctx.rect(x0 - 2, top - 2, P + 4, P + 4);
          s.ctx.clip();
          s.ctx.strokeStyle = '#ffffff';
          s.ctx.lineWidth = Math.max(1.5, u * 0.5);
          s.ctx.strokeRect(x0 + (pj - 3) * k, top + (pi - 3) * k, 7 * k, 7 * k);
          s.ctx.strokeStyle = s.c('--ink');
          s.ctx.lineWidth = 1;
          s.ctx.strokeRect(x0 + (pj - 3) * k - 1, top + (pi - 3) * k - 1, 7 * k + 2, 7 * k + 2);
          s.ctx.restore();
        });
        // The filter, and (before sliding) the patch it is compared with.
        const fx = x0 + P + u * 5;
        const fs = P * 0.45;
        const slideA = s.ease('slide', 0.6);
        const fy = lerp(top + (P - fs) / 2 - fs * 0.74 * s.ease('dot', 0.6), top + (P - fs) / 2, slideA);
        s.alpha(s.ease('filter', 0.5), () => {
          pic(s, filt, fx, fy, fs);
          cap(s, `W[${FK}]: 7×7×3`, fx + fs / 2, fy + fs + u * 3.2, { color: s.c('blue'), size: 3.1 });
        });
        s.alpha(s.win('dot', 'slide'), () => {
          const py = top + (P - fs) / 2 + fs * 0.74;
          const crop = once('crop', () => {
            const c = document.createElement('canvas');
            c.width = c.height = 7;
            c.getContext('2d')!.drawImage(testImg(a, img), bj - 3, bi - 3, 7, 7, 0, 0, 7, 7);
            return c;
          });
          pic(s, crop, fx, py, fs);
          cap(s, 'patch', fx + fs / 2, py + fs + u * 3.2, { size: 3.1 });
          const z = traceOf(a, img).z[0]![FK * 1024 + bi * 32 + bj]!;
          const mx = fx + fs + u * 5;
          s.text('Σ', mx + u * 2, top + P / 2, { size: 6, font: 'serif', color: s.c('--ink-2') });
          s.alpha(s.ease('dot', 0.5, 1.6), () => pill(s, `match = ${z.toFixed(2)}`, mx + u * 6, top + P / 2, 'green', { align: 'left', size: 3.3 }));
          s.alpha(s.ease('dot', 0.5, 0.8 * (s.end('dot') - s.at('dot'))), () => cap(s, 'big when bright weights meet bright pixels', w / 2, top + P + u * 9, { size: fit(s, 'big when bright weights meet bright pixels', w * 0.86, 3.4, 'ui'), italic: true, color: s.c('green') }));
        });
        s.alpha(slideA, () => {
          const mx = fx + fs + u * 5;
          s.arrow(fx + fs + u, top + P / 2, mx - u, top + P / 2, s.c('--ink-3'), 0.4, 2);
          pic(s, partialMap(a, n), mx, top, P);
          s.ctx.strokeStyle = s.c('green');
          s.ctx.lineWidth = Math.max(1.5, u * 0.45);
          s.ctx.strokeRect(mx + pj * k, top + pi * k, k, k);
          cap(s, `F[${FK}]: where it matches`, mx + P / 2, top + P + u * 3.6, { color: s.c('green') });
        });
      });
      s.show('F', pA * s.ease('dot', 0.6, 0.8) * (1 - s.ease('maps', 0.4)));
    }
    // Phase 2: every map of a layer.
    const gA = s.win('maps', 'sparse');
    if (gA > 0) {
      const st = mapStage(s);
      const name = st.replace('relu', 'conv');
      const [C, H] = a.net.shape(st);
      const [rx, ry, rw, rh] = area(s, 0.12, 0.05);
      const ps = Math.min(rw * 0.26, rh * 0.5);
      const gx = rx + ps + u * 6;
      const gw = rx + rw - gx;
      const cols = C === 16 ? 4 : 8;
      const rows = C / cols;
      const gap = Math.max(1.5, u * (C === 16 ? 1 : 0.6));
      const cell = Math.min((gw - gap * (cols - 1)) / cols, (rh - u * 8 - gap * (rows - 1)) / rows);
      const gy = ry + (rh - u * 8 - (cell * rows + gap * (rows - 1))) / 2;
      const maps = stageMaps(a, img, st);
      s.alpha(gA, () => {
        pic(s, testImg(a, img), rx, gy, ps);
        cap(s, 'x', rx + ps / 2, gy + ps + u * 3.4, { color: s.c('orange') });
        const mid = lerp(s.at('deeper'), s.end('deeper'), 0.5);
        const swap = st === 'relu1' ? 1 : st === 'relu2' ? s.ease('deeper', 0.5) : smooth((s.t - mid) / 0.5);
        s.alpha(swap, () => {
          for (let k = 0; k < C; k++) {
            const x = gx + (k % cols) * (cell + gap);
            const y = gy + Math.floor(k / cols) * (cell + gap);
            pic(s, maps[k], x, y, cell, cell, null);
          }
          cap(s, `F = cache['${name}']: ${C} maps of ${H}×${H}`, gx + (cols * (cell + gap) - gap) / 2, gy + rows * (cell + gap) + u * 3, { font: 'mono', color: s.c('green'), size: fit(s, `F = cache['${name}']: ${C} maps of ${H}×${H}`, gw, 3.2, 'mono') });
        });
      });
    }
    // Phase 3: how many zeros.
    const zA = s.win('sparse', 'dead');
    if (zA > 0) {
      const [rx, ry, rw, rh] = area(s, 0.14, 0.08);
      const bw = Math.min(rw / 5, u * 22);
      const base = ry + rh * 0.78;
      const top = ry + rh * 0.12;
      const lit = zeroLit(s);
      s.alpha(zA, () => {
        s.text('share of zeros after the ReLU, over the test set', w / 2, ry + u * 1, { size: fit(s, 'share of zeros after the ReLU, over the test set', rw, 3.6, 'ui'), font: 'ui', color: s.c('--ink-2') });
        s.line(rx, base, rx + rw, base, s.c('--axis'), 0.35);
        STATS.forEach(([name, , z], i) => {
          const cx = rx + rw * (0.2 + 0.3 * i);
          const g = s.ease('sparse', 0.7, 0.4 + i * 0.5);
          const bh = (base - top) * z * g;
          s.rrect(cx - bw / 2, base - bh, bw, bh, 0.8, { fill: s.tint('green', i === lit ? 0.75 : 0.35) });
          s.alpha(g, () => s.text(`${Math.round(z * 100)}%`, cx, base - bh - u * 3, { size: 4.4, font: 'mono', weight: 600, color: s.c('green') }));
          s.text(name, cx, base + u * 4, { size: 3.8, font: 'ui', weight: 600 });
        });
      });
    }
    // Phase 4: dead filters, and this network's laziest one.
    const dA = s.ease('dead', 0.6);
    if (dA > 0) {
      const [rx, ry, rw, rh] = area(s, 0.14, 0.06);
      const ts = Math.min(rw * 0.24, rh * 0.42);
      const ever = a.an.stats.relu3!.everOn;
      s.alpha(dA, () => {
        const tx = rx;
        const ty = ry + rh * 0.12;
        s.rrect(tx, ty, ts, ts, 0.6, { fill: '#000000' });
        s.ctx.save();
        s.ctx.setLineDash([u * 1.2, u * 1]);
        s.rrect(tx - u * 0.6, ty - u * 0.6, ts + u * 1.2, ts + u * 1.2, 1, { stroke: s.c('--ink-3'), lw: 0.35 });
        s.ctx.restore();
        cap(s, 'a dead filter:', tx + ts / 2, ty + ts + u * 4, { size: 3.2 });
        cap(s, 'zero for every image', tx + ts / 2, ty + ts + u * 8, { size: 3.2 });
        const bx = rx + ts + u * 14;
        const bw = rx + rw - bx;
        const bh = rh * 0.5;
        const by = ty + bh;
        const cw = bw / ever.length;
        const shown = s.ease('dead', 0.8, 1.2);
        ever.forEach((v, i) => {
          const hh = bh * v * shown;
          s.ctx.fillStyle = s.tint('green', v === Math.min(...ever) ? 0.9 : 0.45);
          s.ctx.fillRect(bx + i * cw + cw * 0.12, by - hh, cw * 0.76, hh);
        });
        s.line(bx, by, bx + bw, by, s.c('--axis'), 0.3);
        s.line(bx, by - bh, bx + bw, by - bh, s.c('--grid'), 0.3, [1, 1]);
        s.text('100%', bx - u, by - bh, { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        s.text('0', bx - u, by, { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        const l1 = 'how often each conv3 filter fires';
        cap(s, l1, bx + bw / 2, by + u * 4.5, { size: fit(s, l1, bw, 3.2, 'ui') });
        s.alpha(s.ease('dead', 0.6, 0.65 * (s.end('dead') - s.at('dead'))), () => {
          const l2 = 'none dead: the laziest fires on 82%';
          cap(s, l2, bx + bw / 2, by + u * 9.5, { size: fit(s, l2, bw, 3.4, 'ui'), color: s.c('green'), weight: 650 });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- filters

const EDGES = [1, 2, 3, 4, 6, 7, 9];
const BLOBS = [0, 10, 11, 13];

/** The snapshot shown at this moment, fractional while crossfading. */
function snapAt(s: Scene): number {
  if (s.since('init') < 0) return 5;
  if (s.since('steps') < 0) return lerp(5, 0, s.ease('init', 0.7));
  if (s.since('epochs') < 0) return lerp(0, 1, s.ease('steps', 0.7));
  if (s.since('edges') < 0) return 1 + 4 * smooth(clamp01(s.prog('epochs') * 1.15));
  return 5;
}

const filters: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const a = assets(s);
    if (!a) return loading(s);
    const snaps = a.net.snapshots;
    const v = snapAt(s);
    const lo = Math.floor(v);
    const hi = Math.min(5, lo + 1);
    const f = v - lo;
    const cur = Math.round(v);
    s.slot('snap', snaps[cur]!.label);
    s.slot('acc', `${Math.round((snaps[cur]!.acc ?? 0) * 100)}%`);
    const tall = s.tall;
    const cols = tall ? 4 : 8;
    const rows = 16 / cols;
    const [rx, ry, rw, rh] = area(s, 0.22, 0.06);
    const gap = u * 1.6;
    const cell = Math.min((rw - gap * (cols - 1)) / cols, (rh - u * 16 - gap * (rows - 1)) / rows);
    const gx = rx + (rw - (cell * cols + gap * (cols - 1))) / 2;
    const gy = ry + (rh - (rows * (cell + gap) + u * 12)) / 2;
    const deeperA = s.ease('deeper', 0.6);
    const edgeA = s.win('edges', 'alex');
    const blobA = s.win('blobs', 'alex');
    // Snapshot and accuracy.
    s.alpha(1 - deeperA, () => {
      const ty = Math.max(h * 0.15, gy - u * 7);
      const gw = cols * (cell + gap) - gap;
      const wide = gw > u * 70;
      const lx = wide ? gx : rx;
      s.text(snaps[cur]!.label === 'initial' ? 'before training' : `after ${snaps[cur]!.label}`, lx, ty, { size: 4.6, font: 'display', weight: 600, align: 'left' });
      pill(s, `${Math.round((snaps[cur]!.acc ?? 0) * 100)}% test accuracy`, wide ? gx + gw : rx + rw, ty, cur === 0 ? 'red' : 'green', { align: 'right', size: 3.2 });
    });
    for (let k = 0; k < 16; k++) {
      const x = gx + (k % cols) * (cell + gap);
      const y = gy + Math.floor(k / cols) * (cell + gap);
      const isE = EDGES.includes(k);
      const isB = BLOBS.includes(k);
      const dim = 1 - 0.75 * Math.max(edgeA * (isE ? 0 : 1) * (blobA > 0 ? 0 : 1), blobA * (isB ? 0 : 1));
      s.alpha(Math.max(0.05, dim) * (1 - deeperA), () => {
        pic(s, once(`snap-${lo}-${k}`, () => filterCanvas(snaps[lo]!.W, k * 147, 7)), x, y, cell);
        if (f > 0.001) s.alpha(f, () => pic(s, once(`snap-${hi}-${k}`, () => filterCanvas(snaps[hi]!.W, k * 147, 7)), x, y, cell));
      });
      if (isE && edgeA > 0) s.alpha(edgeA, () => ring(s, x, y, cell, cell, s.c('blue'), 0.5));
      if (isB && blobA > 0) s.alpha(blobA, () => ring(s, x, y, cell, cell, s.c('orange'), 0.5));
    }
    const ly = gy + rows * (cell + gap) + u * 4;
    // Training timeline.
    s.alpha(s.win('init', 'edges') * (1 - deeperA), () => {
      const tw = rw / 6;
      snaps.forEach((sn, i) => {
        const on = i === cur;
        s.text(sn.label, rx + tw * (i + 0.5), ly + u * 2, { size: fit(s, sn.label, tw * 0.92, 3, 'ui'), font: 'ui', weight: on ? 700 : 450, color: on ? s.c('--accent') : s.c('--ink-3') });
      });
      s.line(rx + tw * 0.5, ly + u * 5.5, rx + tw * 5.5, ly + u * 5.5, s.c('--rule'), 0.35);
      s.circle(rx + tw * (v + 0.5), ly + u * 5.5, u * 1.2, { fill: s.c('--accent') });
    });
    s.alpha(edgeA, () => cap(s, 'oriented edges', w / 2, ly + u * 3, { size: 3.8, color: s.c('blue'), weight: 650 }));
    s.alpha(blobA, () => cap(s, 'color blobs', w / 2, ly + u * 8.5, { size: 3.8, color: s.c('orange'), weight: 650 }));
    s.alpha(s.win('alex', 'deeper'), () => {
      cap(s, 'smooth and structured: trained well', w / 2, ly + u * 3, { size: fit(s, 'smooth and structured: trained well', rw, 3.6, 'ui'), color: s.c('green'), weight: 650 });
      s.alpha(s.ease('alex', 0.5, 0.55 * (s.end('alex') - s.at('alex'))), () => {
        const t = 'noisy: train longer, or regularize more';
        const ns = u * 5;
        const tw = s.measure(t, { size: 3.4, font: 'ui' });
        const x0 = w / 2 - (tw + ns * 3 + u * 4) / 2;
        for (let k = 0; k < 3; k++) pic(s, once(`snap-0-${k}`, () => filterCanvas(snaps[0]!.W, k * 147, 7)), x0 + k * (ns + u * 0.6), ly + u * 6.5, ns);
        s.text(t, x0 + ns * 3 + u * 3.5, ly + u * 9, { size: 3.4, font: 'ui', color: s.c('red'), align: 'left' });
      });
    });
    // A conv2 filter: sixteen 3 x 3 slices, one per conv1 map.
    if (deeperA > 0) {
      const W2 = a.net.convs[1]!.W;
      let m = 0;
      for (let i = 0; i < 144; i++) m = Math.max(m, Math.abs(W2[i]!));
      const cs = Math.min(rw * 0.11, rh * 0.15);
      const g2 = u * 1.4;
      const cols2 = 8;
      const bw = cols2 * cs + (cols2 - 1) * g2;
      const bx = (w - bw) / 2;
      const by = h * 0.3;
      s.alpha(deeperA, () => {
        s.rrect(bx - u * 4, by - u * 9, bw + u * 8, 2 * cs + g2 + u * 22, 2, { fill: s.c('--card'), stroke: s.c('--rule') });
        s.text('one conv2 filter: 3×3, over 16 maps', w / 2, by - u * 4.5, { size: fit(s, 'one conv2 filter: 3×3, over 16 maps', bw, 3.6, 'ui'), font: 'ui', weight: 600 });
        for (let c = 0; c < 16; c++) {
          const x = bx + (c % cols2) * (cs + g2);
          const y = by + Math.floor(c / cols2) * (cs + g2);
          for (let i = 0; i < 9; i++) {
            const val = W2[c * 9 + i]! / m;
            const g = Math.round(128 + 127 * val);
            s.ctx.fillStyle = `rgb(${g},${g},${g})`;
            s.ctx.fillRect(x + (i % 3) * (cs / 3), y + Math.floor(i / 3) * (cs / 3), cs / 3 + 0.5, cs / 3 + 0.5);
          }
        }
        cap(s, 'it weighs feature maps, not pixels', w / 2, by + 2 * cs + g2 + u * 6, { size: fit(s, 'it weighs feature maps, not pixels', bw, 3.4, 'ui'), italic: true });
      });
    }
  },
};

export const scenesA: Record<string, SceneDef> = { intro, network, activations, filters };
