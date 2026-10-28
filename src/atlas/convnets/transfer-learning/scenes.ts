import { Rng } from '../../../core/rand';
import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { after, Frame } from '../../networks/draw';
import type { Ink } from '../draw';

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.4, weight = 500) {
  s.text(text, s.w / 2, y, { size, font: 'mono', weight, color: s.c(k), halo: true });
}

// ---- photos: a flower on sky and grass, or a chest X-ray

const FLOWERS: [string, string, string][] = [
  ['tulip', '#e0474c', '#f2c94c'],
  ['rose', '#c2185b', '#7b1030'],
  ['daisy', '#f7f7f2', '#f2b705'],
  ['iris', '#7e57c2', '#f2c94c'],
  ['poppy', '#f4511e', '#3e2723'],
  ['lily', '#f8bbd0', '#f9a825'],
  ['aster', '#9575cd', '#ffca28'],
  ['orchid', '#ce93d8', '#8e24aa'],
  ['lotus', '#f48fb1', '#fff176'],
  ['peony', '#ec407a', '#fce4ec'],
];

/** Runs `fn` clipped to a rounded square, then outlines it. */
function tile(s: Scene, l: number, t: number, side: number, fn: () => void) {
  const c = s.ctx;
  c.save();
  c.beginPath();
  c.roundRect(l, t, side, side, 0.8 * s.u);
  c.clip();
  fn();
  c.restore();
  s.rrect(l, t, side, side, 0.8, { stroke: s.tint('--ink-3', 0.6), lw: 0.25 });
}

/** A photo of flower `f`, `side` px wide, centered on (cx, cy). */
function photo(s: Scene, cx: number, cy: number, side: number, f: number) {
  const [, petal, center] = FLOWERS[f % FLOWERS.length]!;
  const l = cx - side / 2;
  const t = cy - side / 2;
  tile(s, l, t, side, () => {
    const c = s.ctx;
    c.fillStyle = '#cfe6f5';
    c.fillRect(l, t, side, side);
    c.fillStyle = '#8fc48c';
    c.fillRect(l, t + side * 0.74, side, side * 0.26);
    const fy = cy - side * 0.1;
    const r = side * 0.2;
    s.line(cx, fy, cx, t + side * 0.9, '#3f7d3a', side * 0.045 / s.u);
    const n = 5 + (f % 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + f;
      s.circle(cx + Math.cos(a) * r * 0.62, fy + Math.sin(a) * r * 0.62, r * 0.5, { fill: petal });
    }
    s.circle(cx, fy, r * 0.38, { fill: center });
  });
}

/** A chest X-ray: ribs curving away from a spine, light on dark. */
function xray(s: Scene, cx: number, cy: number, side: number) {
  const l = cx - side / 2;
  const t = cy - side / 2;
  tile(s, l, t, side, () => {
    const c = s.ctx;
    c.fillStyle = '#1d2228';
    c.fillRect(l, t, side, side);
    c.strokeStyle = '#c9d1d9';
    c.lineWidth = side * 0.035;
    c.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const y = t + side * (0.22 + 0.13 * k);
      for (const d of [-1, 1]) {
        c.beginPath();
        c.moveTo(cx + d * side * 0.05, y);
        c.quadraticCurveTo(cx + d * side * 0.36, y - side * 0.08, cx + d * side * 0.4, y + side * 0.08);
        c.stroke();
      }
    }
    s.line(cx, t + side * 0.1, cx, t + side * 0.92, '#e6ebef', side * 0.05 / s.u);
  });
}

// ---- the network, drawn from the image at the bottom up to the last layer at the top

const LABELS = ['conv 1', 'conv 2', 'conv 3', 'fc: 1,000 classes'];

interface Stack {
  cx: number;
  bw: number;
  bh: number;
  /** Centers of conv 1, conv 2, conv 3 and the last layer, bottom to top. */
  ys: number[];
  /** The input photo's center and side. */
  inY: number;
  side: number;
  featY: number;
  /** Where the panel to the right of the stack starts. */
  right: number;
}

function geom(s: Scene): Stack {
  const u = s.u;
  const cx = s.w * (s.tall ? 0.31 : 0.33);
  const bw = 36 * u;
  return { cx, bw, bh: 7.5 * u, ys: [0.66, 0.54, 0.42, 0.18].map((f) => s.h * f), inY: s.h * 0.81, side: 11 * u, featY: s.h * 0.3, right: cx + bw / 2 + 6 * u };
}

function block(s: Scene, G: Stack, y: number, label: string, k: Ink, on = 0, dx = 0) {
  s.rrect(G.cx - G.bw / 2 + dx, y - G.bh / 2, G.bw, G.bh, 1.2, { fill: s.tint(k, 0.12 + 0.22 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.35 + 0.2 * on });
  s.text(label, G.cx + dx, y, { size: 3.1, font: 'mono', weight: 600, color: s.c(k === 'slate' ? '--ink-2' : k) });
}

/** A padlock left of a block; `open` lifts the shackle. */
function lock(s: Scene, G: Stack, y: number, open = 0) {
  const u = s.u;
  const x = G.cx - G.bw / 2 - 4.2 * u;
  const k = open > 0.5 ? 'green' : 'slate';
  const c = s.ctx;
  c.beginPath();
  c.arc(x + open * 1.2 * u, y - 0.6 * u - open * 1.1 * u, 1.15 * u, Math.PI, Math.PI * 2);
  c.strokeStyle = s.c(k);
  c.lineWidth = 0.5 * u;
  c.stroke();
  s.rrect(x - 1.7 * u, y - 0.7 * u, 3.4 * u, 2.8 * u, 0.5, { fill: s.c(k) });
}

/** The arrows between the photo, the conv layers, the features and the last layer. */
function wires(s: Scene, G: Stack, feat: number) {
  const u = s.u;
  const k = s.c('--ink-3');
  s.arrow(G.cx, G.inY - G.side / 2 - 0.6 * u, G.cx, G.ys[0]! + G.bh / 2 + 0.6 * u, k, 0.3, 1.6);
  for (let i = 1; i < 3; i++) s.arrow(G.cx, G.ys[i - 1]! - G.bh / 2 - 0.6 * u, G.cx, G.ys[i]! + G.bh / 2 + 0.6 * u, k, 0.3, 1.6);
  const top = G.ys[2]! - G.bh / 2 - 0.6 * u;
  const end = G.ys[3]! + G.bh / 2 + 0.6 * u;
  if (feat < 0.01) s.arrow(G.cx, top, G.cx, end, k, 0.3, 1.6);
  else {
    s.alpha(1 - feat, () => s.arrow(G.cx, top, G.cx, end, k, 0.3, 1.6));
    s.alpha(feat, () => {
      s.arrow(G.cx, top, G.cx, G.featY + 2.4 * u, k, 0.3, 1.6);
      s.arrow(G.cx, G.featY - 2.4 * u, G.cx, end, k, 0.3, 1.6);
      features(s, G);
    });
  }
}

/** The 512 numbers the conv layers hand to the last layer, a few of them drawn. */
function features(s: Scene, G: Stack) {
  const u = s.u;
  const n = 9;
  const cw = 2.8 * u;
  const x0 = G.cx - ((n - 1) / 2) * 3.4 * u;
  for (let i = 0; i < n; i++) {
    if (i === 4) {
      s.text('…', x0 + i * 3.4 * u, G.featY, { size: 3, font: 'mono', color: s.c('orange') });
      continue;
    }
    s.rrect(x0 + i * 3.4 * u - cw / 2, G.featY - 1.6 * u, cw, 3.2 * u, 0.5, { fill: s.tint('orange', 0.25), stroke: s.c('orange'), lw: 0.25 });
  }
  s.text('512 features', G.right, G.featY, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('orange'), halo: true });
}

/** A tag in the panel right of the stack, level with a block. */
function tag(s: Scene, G: Stack, y: number, text: string, k: Ink, a: number) {
  s.alpha(a, () => s.text(text, G.right, y, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c(k), halo: true }));
}

// ---- scene 1: the task, too little data for a network from scratch, and ImageNet

const lossTrain = (e: number) => 0.1 + 2.1 * Math.exp(-e / 2.5);
const lossVal = (e: number) => lossTrain(e) + 0.12 * e;

/** A wall of small photos at module scope: one hue and lightness per tile. */
const WALL = (() => {
  const rng = new Rng(7);
  return Array.from({ length: 1200 }, () => `hsl(${Math.round(rng.uniform(0, 360))}, ${Math.round(rng.uniform(25, 55))}%, ${Math.round(rng.uniform(45, 72))}%)`);
})();

const problem: SceneDef = {
  draw(s) {
    const u = s.u;
    const wall = s.ease('imagenet', 0.9);
    // Ten labeled photos, one per kind of flower.
    s.alpha(1 - wall, () => {
      const pitch = Math.min(17, (s.w / u - 12) / 5) * u;
      const side = pitch * 0.74;
      FLOWERS.forEach(([name], f) => {
        const x = s.w / 2 + ((f % 5) - 2) * pitch;
        const y = s.h * (f < 5 ? 0.2 : 0.42);
        s.alpha(s.ease('task', 0.5, 0.2 + 0.12 * f), () => {
          photo(s, x, y, side, f);
          s.alpha(after(s, 'task', 0.45), () => s.text(name, x, y + side / 2 + 3 * u, { size: 2.9, font: 'mono', weight: 600, color: s.c('gold') }));
        });
      });
      s.alpha(s.win('task', 'many') * after(s, 'task', 0.55), () => caption(s, 'label: the right answer, written by a person', s.h * 0.62, 'gold', 3.2));
      // From scratch: the training loss falls, the validation loss turns and climbs.
      s.alpha(s.ease('many', 0.6, 0.8), () => {
        const w = Math.min(72 * u, s.w * 0.7);
        const F = new Frame(s, s.w / 2 - w / 2, s.h * 0.6, s.w / 2 + w / 2, s.h * 0.85, [0, 10], [0, 2.4]);
        s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.3);
        s.line(F.l, F.t, F.l, F.b, s.c('--axis'), 0.3);
        const grow = 10 * s.prog('many');
        F.fn(lossTrain, 'blue', 0.6, 0, Math.max(0.01, grow));
        F.fn(lossVal, 'red', 0.6, 0, Math.max(0.01, grow));
        const lab = { size: 3, font: 'mono', weight: 650, align: 'right', halo: true } as const;
        s.alpha(after(s, 'many', 0.75), () => {
          s.text('validation', F.r, F.Y(lossVal(10)) - 3 * u, { ...lab, color: s.c('red') });
          s.text('training', F.r, F.Y(lossTrain(10)) - 3 * u, { ...lab, color: s.c('blue') });
        });
        s.text('loss', F.l - 1.5 * u, F.t + 1 * u, { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
        s.text('epochs →', F.r, F.b + 3 * u, { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
        caption(s, 'millions of weights, a few hundred photos', s.h * 0.93, '--ink-2', 3.2);
      });
    });
    // ImageNet: a wall of photos, too many to draw.
    s.alpha(wall, () => {
      const l = 5 * u;
      const r = s.w - 5 * u;
      const t = s.h * 0.11;
      const b = s.h * 0.66;
      const cell = 3.6 * u;
      const cols = Math.floor((r - l) / cell);
      const rows = Math.floor((b - t) / cell);
      const x0 = (s.w - cols * cell) / 2;
      const shown = Math.min(1, s.prog('imagenet') * 1.6);
      s.alpha(1 - 0.75 * s.ease('pretrained', 0.6), () => {
        for (let i = 0; i < rows; i++)
          for (let j = 0; j < cols; j++) {
            const k = i * cols + j;
            if (k / (rows * cols) > shown) continue;
            s.ctx.fillStyle = WALL[k % WALL.length]!;
            s.ctx.fillRect(x0 + j * cell + 0.25 * u, t + i * cell + 0.25 * u, cell - 0.5 * u, cell - 0.5 * u);
          }
      });
      caption(s, 'ImageNet\'s contest: about 1.2 million', s.h * 0.75, '--ink', 3.4, 600);
      caption(s, 'labeled photos, in 1,000 classes', s.h * 0.81, '--ink', 3.4, 600);
      s.alpha(s.ease('pretrained', 0.6, 0.3), () => {
        const cy = (t + b) / 2;
        const w = s.measure('trained before, on another task', { size: 2.9, font: 'mono' }) + 8 * u;
        s.rrect(s.w / 2 - w / 2, cy - 7 * u, w, 14 * u, 1.6, { fill: s.c('--card'), stroke: s.c('blue'), lw: 0.45 });
        s.text('a pretrained network', s.w / 2, cy - 2.2 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('blue') });
        s.text('trained before, on another task', s.w / 2, cy + 2.8 * u, { size: 2.9, font: 'mono', color: s.c('--ink-2') });
      });
      s.alpha(after(s, 'pretrained', 0.6), () => caption(s, 'help with ten kinds of flower?', s.h * 0.92, 'gold', 3.4, 650));
    });
    cite(s, 'ImageNet · Jia Deng, Fei-Fei Li et al., 2009', s.win('imagenet', 'pretrained'));
  },
};

// ---- scene 2: what each layer of a trained ConvNet responds to

/** Edge patches at four angles, then two blobs of color. */
function edges(s: Scene, x: number, y: number, g: number, i: number) {
  const l = x;
  const t = y - g / 2;
  if (i < 4) {
    const a = (i * Math.PI) / 4;
    tile(s, l, t, g, () => {
      const c = s.ctx;
      c.fillStyle = '#e8e8e8';
      c.fillRect(l, t, g, g);
      c.fillStyle = '#4a4a4a';
      c.beginPath();
      const cx = l + g / 2;
      const cy = y;
      const dx = Math.cos(a) * g;
      const dy = Math.sin(a) * g;
      c.moveTo(cx - dx, cy - dy);
      c.lineTo(cx + dx, cy + dy);
      c.lineTo(cx + dx - dy, cy + dy + dx);
      c.lineTo(cx - dx - dy, cy - dy + dx);
      c.closePath();
      c.fill();
    });
  } else {
    tile(s, l, t, g, () => {
      const c = s.ctx;
      c.fillStyle = '#e8e8e8';
      c.fillRect(l, t, g, g);
      const grad = c.createRadialGradient(l + g / 2, y, 0, l + g / 2, y, g * 0.5);
      grad.addColorStop(0, i === 4 ? '#e53935' : '#1e88e5');
      grad.addColorStop(1, 'rgba(232,232,232,0)');
      c.fillStyle = grad;
      c.fillRect(l, t, g, g);
    });
  }
}

/** Stripes, checks, dots and waves. */
function textures(s: Scene, x: number, y: number, g: number, i: number) {
  const l = x;
  const t = y - g / 2;
  tile(s, l, t, g, () => {
    const c = s.ctx;
    c.fillStyle = '#ece6d8';
    c.fillRect(l, t, g, g);
    c.fillStyle = '#6d5a3a';
    c.strokeStyle = '#6d5a3a';
    c.lineWidth = g * 0.09;
    if (i === 0) for (let k = -2; k < 4; k++) s.line(l + k * g * 0.3, t + g, l + k * g * 0.3 + g, t, '#6d5a3a', (g * 0.09) / s.u);
    if (i === 1) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if ((a + b) % 2) c.fillRect(l + (a * g) / 4, t + (b * g) / 4, g / 4, g / 4);
    if (i === 2) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s.circle(l + g * (0.2 + 0.3 * a), t + g * (0.2 + 0.3 * b), g * 0.08, { fill: '#6d5a3a' });
    if (i === 3)
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        for (let q = 0; q <= 20; q++) {
          const px = l + (q / 20) * g;
          const py = t + g * (0.22 + 0.28 * k) + Math.sin((q / 20) * Math.PI * 3) * g * 0.08;
          if (q) c.lineTo(px, py);
          else c.moveTo(px, py);
        }
        c.stroke();
      }
  });
}

/** A petal, an eye, a wheel and a bird's leg. */
function parts(s: Scene, x: number, y: number, g: number, i: number) {
  const l = x;
  const t = y - g / 2;
  tile(s, l, t, g, () => {
    const c = s.ctx;
    c.fillStyle = '#eef0f2';
    c.fillRect(l, t, g, g);
    const cx = l + g / 2;
    if (i === 0) {
      c.fillStyle = '#ec407a';
      c.beginPath();
      c.ellipse(cx, y, g * 0.18, g * 0.38, 0.5, 0, Math.PI * 2);
      c.fill();
    }
    if (i === 1) {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.ellipse(cx, y, g * 0.4, g * 0.24, 0, 0, Math.PI * 2);
      c.fill();
      s.circle(cx, y, g * 0.16, { fill: '#5d4037' });
      s.circle(cx, y, g * 0.07, { fill: '#111111' });
    }
    if (i === 2) {
      s.circle(cx, y, g * 0.36, { stroke: '#333333', lw: (g * 0.08) / s.u });
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        s.line(cx, y, cx + Math.cos(a) * g * 0.33, y + Math.sin(a) * g * 0.33, '#555555', (g * 0.04) / s.u);
      }
    }
    if (i === 3) {
      const k = '#8d6e63';
      const w = (g * 0.07) / s.u;
      s.line(cx, t + g * 0.12, cx, y + g * 0.22, k, w);
      for (const dx of [-0.24, 0, 0.24]) s.line(cx, y + g * 0.22, cx + dx * g, y + g * 0.4, k, w);
    }
  });
}

/** One bar per class, too many to show: a few, then an ellipsis. */
function scoreBars(s: Scene, x: number, y: number, g: number, w: number) {
  const n = 9;
  const hs = [0.3, 0.8, 0.45, 0.2, 0.6, 0.35, 0.9, 0.25, 0.5];
  const bw = (w - 6 * s.u) / n;
  for (let i = 0; i < n; i++) {
    const hh = hs[i]! * g;
    s.rrect(x + i * bw, y + g / 2 - hh, bw * 0.7, hh, 0.3, { fill: s.tint('purple', 0.5), stroke: s.c('purple'), lw: 0.2 });
  }
  s.text('…', x + n * bw + 2 * s.u, y + g * 0.3, { size: 3, font: 'mono', color: s.c('purple') });
}

const layers: SceneDef = {
  draw(s) {
    const u = s.u;
    const G = geom(s);
    const g = Math.min(6.5 * u, (s.w - 12 * u - G.right - 3 * 1.6 * u) / 4);
    const pitch = g + 1.6 * u;
    const lit = [s.win('l1', 'mid'), s.win('mid', 'last') * after(s, 'mid', 0.45) * (1 - after(s, 'mid', 0.72)), s.win('mid', 'last') * after(s, 'mid', 0.72), s.win('last', 'yosinski')];
    const asis = s.ease('asis', 0.6);
    photo(s, G.cx, G.inY, G.side, 0);
    wires(s, G, s.ease('last', 0.6));
    for (let i = 0; i < 4; i++) {
      const last = i === 3;
      block(s, G, G.ys[i]!, LABELS[i]!, last ? (asis > 0.5 ? 'red' : 'purple') : 'blue', Math.max(lit[i]!, last ? asis : 0));
    }
    // What each layer responds to, beside it, once the voice reaches it.
    const show = [s.ease('l1', 0.6, 1.2), after(s, 'mid', 0.45), after(s, 'mid', 0.72), s.ease('last', 0.6, 0.6)];
    s.alpha(show[0]!, () => {
      // Four edges and two color blobs, a little smaller to fit six.
      const gg = Math.min(g, (s.w - 12 * u - G.right - 5 * 1.2 * u) / 6);
      for (let i = 0; i < 6; i++) edges(s, G.right + i * (gg + 1.2 * u), G.ys[0]!, gg, i);
    });
    s.alpha(show[1]!, () => [0, 1, 2, 3].forEach((i) => textures(s, G.right + i * pitch, G.ys[1]!, g, i)));
    s.alpha(show[2]!, () => [0, 1, 2, 3].forEach((i) => parts(s, G.right + i * pitch, G.ys[2]!, g, i)));
    s.alpha(show[3]! * (1 - asis), () => scoreBars(s, G.right, G.ys[3]!, g, 4 * pitch));
    // General at the bottom, specific at the top.
    s.alpha(s.ease('yosinski', 0.6, 3), () => {
      const x = s.w - 6 * u;
      const y0 = G.ys[0]!;
      const y1 = G.ys[3]!;
      const steps = 24;
      for (let i = 0; i < steps; i++) {
        const f = i / steps;
        const k = f < 0.5 ? 'green' : 'purple';
        s.line(x, lerp(y0, y1, f), x, lerp(y0, y1, f + 1 / steps), s.tint(k, 0.35 + 0.5 * Math.abs(f - 0.5) * 2), 0.8);
      }
      s.arrow(x, lerp(y0, y1, 0.95), x, y1 - 1 * u, s.c('purple'), 0.8, 2);
      const lab = { size: 3.1, font: 'mono', weight: 650, align: 'right', halo: true } as const;
      s.text('general', s.w - 4 * u, y0 + G.bh / 2 + 3.5 * u, { ...lab, color: s.c('green') });
      s.text('specific', s.w - 4 * u, y1 - G.bh / 2 - 3 * u, { ...lab, color: s.c('purple') });
    });
    s.alpha(asis, () => tag(s, G, G.ys[3]!, 'not your 10', 'red', 1));
    cite(s, 'Zeiler & Fergus, 2013', s.win('mid', 'last'));
    cite(s, 'Yosinski, Clune, Bengio & Lipson, 2014', s.win('yosinski', 'asis'));
    const cy = s.h * 0.94;
    s.alpha(s.win('l1', 'mid'), () => caption(s, 'layer 1: edges and color blobs', cy, 'blue'));
    s.alpha(s.win('mid', 'last'), () => caption(s, 'then textures, then parts', cy, 'blue'));
    s.alpha(s.win('last', 'yosinski') * (1 - after(s, 'last', 0.3)), () => caption(s, 'last: a linear classifier', cy, 'purple'));
    s.alpha(s.win('last', 'yosinski') * after(s, 'last', 0.3), () => caption(s, 'features: numbers describing the image', cy, 'orange'));
    s.alpha(s.win('yosinski', 'asis'), () => caption(s, 'early layers: in nearly every photo', cy, 'green'));
    s.alpha(asis, () => caption(s, 'it scores ImageNet\'s 1,000 classes', cy, 'red'));
  },
};

// ---- scene 3: freeze the conv layers, swap the last one, count what is trained

const swap: SceneDef = {
  draw(s) {
    const u = s.u;
    const G = geom(s);
    const two = s.win('two', 'razavian');
    s.alpha(1 - 0.85 * two, () => {
      photo(s, G.cx, G.inY, G.side, 0);
      wires(s, G, 1);
      const fz = [0, 1, 2].map((i) => s.ease('freeze', 0.5, 2.2 + 0.4 * i));
      for (let i = 0; i < 3; i++) {
        block(s, G, G.ys[i]!, LABELS[i]!, fz[i]! > 0.5 ? 'slate' : 'blue');
        s.alpha(fz[i]!, () => lock(s, G, G.ys[i]!));
      }
      // The old last layer slides out to the right; the new one drops in from above.
      const out = s.ease('swap', 0.9, 0.5);
      const inn = s.ease('swap', 0.9, 1.4);
      s.alpha(1 - out, () => block(s, G, G.ys[3]!, LABELS[3]!, 'purple', 0, out * 30 * u));
      s.alpha(inn, () => block(s, G, G.ys[3]! - (1 - inn) * 10 * u, 'fc: 10 flowers', 'green', s.win('count', 'fit')));
      tag(s, G, G.ys[1]!, 'frozen', 'slate', s.ease('freeze', 0.6, 3.4));
      tag(s, G, G.ys[1]! + 4.5 * u, 'no gradient', '--ink-3', s.ease('freeze', 0.6, 3.4));
      tag(s, G, G.ys[3]!, '5,130: trained', 'green', s.ease('count', 0.6, 1.5));
    });
    // Two new layers, counted one at a time.
    s.alpha(two, () => {
      const w = Math.min(64 * u, s.w - 10 * u);
      const cy = s.h * 0.45;
      s.rrect(s.w / 2 - w / 2, cy - 15 * u, w, 30 * u, 1.6, { fill: s.c('--card'), stroke: s.c('green'), lw: 0.45 });
      const lines: [string, Ink][] = [
        ['two new layers: 512 → 128 → 10', 'green'],
        ['512 × 128 + 128 = 65,664', '--ink'],
        ['128 × 10 + 10 = 1,290', '--ink'],
        ['together: 66,954 trained', 'green'],
      ];
      lines.forEach(([t, k], i) => s.alpha(after(s, 'two', 0.1 + 0.15 * i), () => s.text(t, s.w / 2, cy - 9.5 * u + i * 6.3 * u, { size: 3.2, font: 'mono', weight: i % 3 ? 500 : 650, color: s.c(k) })));
    });
    cite(s, 'Razavian, Azizpour, Sullivan & Carlsson, 2014', s.win('razavian', 'name'));
    const cy = s.h * 0.94;
    s.alpha(s.win('freeze', 'swap'), () => caption(s, 'requires_grad = False: it never moves', cy, 'slate'));
    s.alpha(s.win('swap', 'count'), () => caption(s, 'a new last layer: 512 in, 10 out', cy, 'green'));
    s.alpha(s.win('count', 'fit'), () => caption(s, '512 × 10 + 10 = 5,130 trained', cy, 'green', 3.6, 650));
    s.alpha(s.win('fit', 'two'), () => caption(s, 'thousands, not millions', cy, 'green'));
    s.alpha(s.win('razavian', 'name'), () => caption(s, 'fixed network + linear classifier', cy, '--ink-2'));
    s.alpha(s.ease('name', 0.6), () => caption(s, 'transfer learning: reuse what was learned', cy, 'blue', 3.4, 650));
  },
};

// ---- scene 4: how much to unfreeze, the learning rate, and images unlike photos

const bowl = (x: number) => 0.5 * x * x;

const howmuch: SceneDef = {
  draw(s) {
    const u = s.u;
    const G = geom(s);
    const lrA = s.win('lr', 'scratch');
    const xr = s.ease('xray', 0.8);
    // The unlocking runs top-down as the photo count grows.
    const grow = after(s, 'more', 0.38, 3);
    s.alpha(1 - lrA, () => {
      s.alpha(1 - xr, () => photo(s, G.cx, G.inY, G.side, 0));
      s.alpha(xr, () => xray(s, G.cx, G.inY, G.side));
      wires(s, G, 1);
      for (let i = 0; i < 3; i++) {
        const open = smooth(grow * 3 - (2 - i)) * (i === 0 ? 1 - xr : 1);
        const k: Ink = i === 0 && xr > 0.5 ? 'blue' : open > 0.5 ? 'green' : 'slate';
        block(s, G, G.ys[i]!, LABELS[i]!, k, i === 0 ? xr : 0);
        lock(s, G, G.ys[i]!, open);
      }
      block(s, G, G.ys[3]!, xr > 0.5 ? 'fc: new classes' : 'fc: 10 flowers', 'green');
      tag(s, G, G.ys[3]!, 'trained', 'green', 1 - after(s, 'more', 0.38));
      tag(s, G, G.ys[1]!, 'fine-tuned', 'green', s.win('tune', 'lr'));
      tag(s, G, G.ys[0]!, 'carries over', 'blue', after(s, 'xray', 0.35));
      tag(s, G, G.ys[2]!, 'retrain', 'green', after(s, 'xray', 0.6));
    });
    // The photo count, under the stack's panel.
    s.alpha(s.win('more', 'tune'), () => {
      const n = lerp(500, 50000, grow);
      const shown = n < 1000 ? '500 photos' : `${(Math.round(n / 1000) * 1000).toLocaleString('en-US')} photos`;
      caption(s, `${shown}: ${grow < 0.5 ? 'the new layer only' : 'unfreeze every layer'}`, s.h * 0.94, grow < 0.5 ? '--ink-2' : 'green');
    });
    // Near the bottom of the loss, big steps overshoot and small ones stay close.
    s.alpha(lrA, () => {
      const w = Math.min(80 * u, s.w - 12 * u);
      const F = new Frame(s, s.w / 2 - w / 2, s.h * 0.14, s.w / 2 + w / 2, s.h * 0.72, [-2.4, 2.4], [-0.15, 2.4]);
      F.fn(bowl, '--ink-3', 0.6);
      s.text('loss', F.X(1.6), F.Y(2.25), { size: 3, font: 'mono', color: s.c('--ink-3') });
      F.dot(0.9, bowl(0.9), 'blue', 1.5);
      s.text('pretrained', F.X(0.9) + 3 * u, F.Y(bowl(0.9)) - 3.5 * u, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('blue'), halo: true });
      const why = s.ease('why', 0.6);
      s.alpha(why * after(s, 'why', 0.1), () => {
        const x1 = -2;
        const k = 'red';
        const c = s.ctx;
        c.beginPath();
        c.moveTo(F.X(0.9), F.Y(bowl(0.9)) - 1.5 * u);
        c.quadraticCurveTo(F.X(-0.5), F.Y(2.1), F.X(x1), F.Y(bowl(x1)) - 1.5 * u);
        c.strokeStyle = s.c(k);
        c.lineWidth = 0.45 * u;
        c.setLineDash([1.2 * u, 0.9 * u]);
        c.stroke();
        c.setLineDash([]);
        F.dot(x1, bowl(x1), k, 1.4);
        s.text('big η: overshoots', F.X(-0.3), F.Y(2.25), { size: 3.1, font: 'mono', weight: 650, color: s.c(k), halo: true });
      });
      s.alpha(why * after(s, 'why', 0.6), () => {
        let x = 0.9;
        for (let i = 0; i < 3; i++) {
          const nx = x * 0.62;
          s.alpha(after(s, 'why', 0.6 + 0.08 * i), () => {
            s.arrow(F.X(x), F.Y(bowl(x)) + 2 * u, F.X(nx) + 0.6 * u, F.Y(bowl(nx)) + 2 * u, s.c('green'), 0.4, 1.4);
            F.dot(nx, bowl(nx), 'green', 1);
          });
          x = nx;
        }
        s.text('small η: stays close', F.X(0.2), F.Y(0) + 6 * u, { size: 3.1, font: 'mono', weight: 650, color: s.c('green'), halo: true });
      });
      caption(s, 'fine-tuning: η = 0.01 / 10 = 0.001', s.h * 0.86, 'slate', 3.4, 650);
    });
    const cy = s.h * 0.94;
    s.alpha(s.win('tune', 'lr'), () => caption(s, 'fine-tune: start close, adjust a little', cy, 'green'));
    s.alpha(s.win('scratch', 'xray'), () => caption(s, 'random start: possible; pretrained: better', cy, '--ink-2', 3.2));
    s.alpha(xr, () => caption(s, 'unlike photos: keep the early layers', cy, 'blue'));
  },
};

export const scenes: Record<string, SceneDef> = { problem, layers, swap, howmuch };
