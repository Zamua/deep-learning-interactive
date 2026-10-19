import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { type K, at, card, check, cifar, cross, current, dashed, pic, pill } from './kit';

/** Largest size (up to `size`) at which `text` fits in `maxW`. */
export function fit(s: Scene, text: string, maxW: number, size: number, o: { font?: 'display' | 'serif' | 'mono' | 'ui'; weight?: number } = {}): number {
  const wd = s.measure(text, { size, font: o.font, weight: o.weight });
  return wd <= maxW ? size : size * (maxW / wd);
}

// ---------------------------------------------------------------- intro

const TOPICS: { name: string; k: K }[] = [
  { name: 'data augmentation', k: 'orange' },
  { name: 'transfer learning', k: 'teal' },
  { name: 'convolutions', k: 'blue' },
  { name: 'hardware, software', k: 'purple' },
];

/** A tiny picture for each of the four questions. */
export function topicIcon(s: Scene, k: number, cx: number, cy: number, on: number): void {
  const { u } = s;
  const d = cifar(s);
  if (k === 0) {
    const z = u * 11.5;
    const g = u * 2;
    pic(s, d?.cat, cx - z * 1.5 - g, cy - z / 2, z);
    pic(s, d?.cat, cx - z / 2, cy - z / 2, z, { flip: -1 });
    pic(s, d?.cat, cx + z / 2 + g, cy - z / 2, z, { src: [6, 3, 20, 20] });
  } else if (k === 1) {
    const bw = u * 4.4;
    const g = u * 1.4;
    const x0 = cx - (6 * bw + 5 * g) / 2;
    for (let i = 0; i < 6; i++) {
      const bh = u * (13 - i * 1.1);
      const kk: K = i === 5 ? 'orange' : 'slate';
      s.rrect(x0 + i * (bw + g), cy - bh / 2, bw, bh, 0.8, { fill: s.tint(kk, 0.2 + 0.15 * on), stroke: s.tint(kk, 0.8), lw: 0.3 });
    }
  } else if (k === 2) {
    const c = u * 2.4;
    const gx = cx - c * 6.4;
    const gy = cy - c * 2.5;
    const pos = Math.floor(s.t * 1.6) % 9;
    const pi = Math.floor(pos / 3);
    const pj = pos % 3;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) s.rrect(gx + j * c, gy + i * c, c * 0.9, c * 0.9, 0.3, { fill: s.tint('orange', 0.12 + (i >= pi && i < pi + 3 && j >= pj && j < pj + 3 ? 0.3 : 0)) });
    s.rrect(gx + pj * c - u * 0.3, gy + pi * c - u * 0.3, c * 3, c * 3, 0.5, { stroke: s.c('blue'), lw: 0.45 });
    s.arrow(gx + c * 5.4, cy, gx + c * 7.6, cy, s.c('--ink-3'), 0.35, 1.6);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s.rrect(gx + c * 8.3 + j * c, cy - c * 1.5 + i * c, c * 0.9, c * 0.9, 0.3, { fill: s.tint('purple', i * 3 + j === pos ? 0.6 : 0.18) });
  } else {
    const cw = u * 16;
    const chh = u * 12;
    const x0 = cx - u * 17;
    s.rrect(x0, cy - chh / 2, cw, chh, 1.2, { fill: s.tint('purple', 0.12), stroke: s.tint('purple', 0.7), lw: 0.3 });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
      const lit = (Math.floor(s.t * 3) + i * 7 + j * 3) % 5 === 0 ? 0.55 : 0.22;
      s.rrect(x0 + u * 1.6 + j * u * 2.2, cy - chh / 2 + u * 1.6 + i * u * 2.2, u * 1.6, u * 1.6, 0.2, { fill: s.tint('purple', lit) });
    }
    for (let p = 0; p < 5; p++) {
      s.line(x0 + u * 2 + p * u * 3, cy + chh / 2, x0 + u * 2 + p * u * 3, cy + chh / 2 + u * 1.4, s.tint('purple', 0.6), 0.35);
      s.line(x0 + u * 2 + p * u * 3, cy - chh / 2, x0 + u * 2 + p * u * 3, cy - chh / 2 - u * 1.4, s.tint('purple', 0.6), 0.35);
    }
    const nodes: [number, number][] = [
      [cx + u * 5, cy - u * 3.5],
      [cx + u * 5, cy + u * 3.5],
      [cx + u * 12, cy],
      [cx + u * 18, cy],
    ];
    s.arrow(nodes[0]![0], nodes[0]![1], nodes[2]![0] - u * 1.6, nodes[2]![1] - u * 0.6, s.c('--ink-3'), 0.3, 1.2);
    s.arrow(nodes[1]![0], nodes[1]![1], nodes[2]![0] - u * 1.6, nodes[2]![1] + u * 0.6, s.c('--ink-3'), 0.3, 1.2);
    s.arrow(nodes[2]![0], nodes[2]![1], nodes[3]![0] - u * 1.6, nodes[3]![1], s.c('--ink-3'), 0.3, 1.2);
    nodes.forEach(([x, y], i) => s.circle(x, y, u * 1.5, { fill: s.c('--card'), stroke: s.c(i === 3 ? 'red' : 'purple'), lw: 0.4 }));
  }
}

function introGeo(s: Scene, k: number): [number, number, number, number] {
  const { w, u } = s;
  const tw = Math.min(u * 56, (w - u * 14) / 2);
  const th = u * 31;
  const gap = u * 4;
  const x0 = w / 2 - tw - gap / 2;
  const y0 = u * 25;
  return [x0 + (k % 2) * (tw + gap), y0 + Math.floor(k / 2) * (th + gap), tw, th];
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const lift = s.ease('four', 0.9);
    const ty = lerp(h * 0.42, u * 12, lift);
    s.text('ConvNets in practice', w / 2, ty, { size: fit(s, 'ConvNets in practice', w - u * 10, lerp(9.5, 6.4, lift), { font: 'display', weight: 600 }), font: 'display', weight: 600 });
    s.alpha(s.ease('hello', 0.8, 0.4) * (1 - s.ease('before', 0.5)), () => s.text('making a ConvNet work on a real problem', w / 2, ty + u * 10, { size: 4, italic: true, color: s.c('--ink-2') }));
    s.alpha(s.win('before', 'four'), () => {
      s.text('chapter 11: what a ConvNet is', w / 2, h * 0.6, { size: 4.4, color: s.c('--ink-2') });
      s.text('chapter 13: making one work', w / 2, h * 0.6 + u * 7.5, { size: 4.4, weight: 650, color: s.c('--accent') });
      s.text('a real problem, a real budget', w / 2, h * 0.6 + u * 15, { size: 3.6, italic: true, color: s.c('--ink-3') });
    });
    const tA = s.ease('four', 0.7, 0.4);
    if (tA <= 0) return;
    const qs = ['q1', 'q2', 'q3', 'q4', 'go'];
    TOPICS.forEach((T, k) => {
      const [x, y, tw, th] = introGeo(s, k);
      let on = s.ease(qs[k]!, 0.5) * (1 - 0.45 * s.ease(qs[k + 1]!, 0.5));
      if (k === 0) on += 0.45 * s.ease('go', 0.5);
      s.alpha(tA * (0.4 + 0.6 * clamp01(on + (s.since(qs[k]!) >= 0 ? 0.3 : 0))), () => {
        card(s, x, y, tw, th, T.k, on);
        s.circle(x + u * 5.4, y + u * 5.8, u * 3, { fill: s.tint(T.k, 0.15 + 0.75 * on), stroke: s.c(T.k), lw: 0.3 });
        s.text(String(k + 1), x + u * 5.4, y + u * 6, { size: 3.5, font: 'ui', weight: 700, color: on > 0.5 ? '#fff' : s.c(T.k) });
        s.text(T.name, x + u * 10.4, y + u * 6, { size: fit(s, T.name, tw - u * 12, 3.9, { font: 'display', weight: 600 }), font: 'display', weight: 600, align: 'left', color: s.c(T.k) });
        topicIcon(s, k, x + tw / 2, y + th * 0.62, on);
      });
    });
  },
};

// ---------------------------------------------------------------- augment

/** One random training view of the cat: flip, zoom window and a small rotation. */
interface View {
  flip: boolean;
  z: number;
  ox: number;
  oy: number;
  rot: number;
}
const VIEWS: View[] = (() => {
  const r = new Rng(12);
  return Array.from({ length: 24 }, () => {
    const z = 32 / (1 + 0.35 * r.next());
    return { flip: r.next() < 0.5, z, ox: r.next() * (32 - z), oy: r.next() * (32 - z), rot: r.uniform(-0.18, 0.18) };
  });
})();

function view(s: Scene, cv: HTMLCanvasElement | undefined, v: View, x: number, y: number, size: number): void {
  pic(s, cv, x, y, size, { flip: v.flip ? -1 : 1, rot: v.rot, src: [v.ox, v.oy, v.z, v.z] });
}

/** Crop samples for the ResNet recipe: L in [256, 480], and the 224 window's corner as fractions. */
const CROPS = (() => {
  const r = new Rng(5);
  return Array.from({ length: 30 }, () => ({ L: 256 + r.int(225), fx: r.next(), fy: r.next() }));
})();

/** The four corners and the center of a 32 x 32 image, as 28 x 28 windows. */
const TEN: [number, number][] = [
  [0, 0],
  [4, 0],
  [0, 4],
  [4, 4],
  [2, 2],
];

const augment: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = cifar(s);
    const cx = w / 2;
    // A dataset small enough to memorize.
    const mA = s.win('few', 'trick');
    s.alpha(mA, () => {
      const tz = Math.min(u * 12, (w - u * 20) / 6.6);
      const g = u * 1.8;
      const gx = cx - (6 * tz + 5 * g) / 2;
      const gy = u * 18;
      for (let k = 0; k < 18; k++) {
        const x = gx + (k % 6) * (tz + g);
        const y = gy + Math.floor(k / 6) * (tz + g);
        pic(s, d?.thumbs[k], x, y, tz);
        const ck = s.ease('few', 0.3, 0.8 + k * 0.17);
        s.alpha(ck, () => check(s, x + tz - u * 1.2, y + u * 1.2, u * 1.9));
      }
      const ly = gy + 3 * (tz + g) + u * 7;
      s.text('a few thousand labeled images', cx, ly, { size: 4.4, weight: 600 });
      s.text('millions of parameters can memorize them all', cx, ly + u * 7.5, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
    // Same label, new pixels.
    const tA = s.win('trick', 'loop');
    s.alpha(tA, () => {
      const z = Math.min(u * 30, (w - u * 22) / 3);
      const g = u * 6;
      const x0 = cx - (3 * z + 2 * g) / 2;
      const y0 = u * 26;
      s.text('same label, new pixels', cx, u * 14, { size: 5, font: 'display', weight: 600 });
      const opts = [{}, { flip: -1 }, { src: [6, 3, 20, 20] as [number, number, number, number] }];
      const names = ['original', 'flipped', 'closer'];
      opts.forEach((o, i) => {
        const a = i === 0 ? 1 : s.ease('trick', 0.5, 1.4 + i * 0.8);
        s.alpha(a, () => {
          pic(s, d?.cat, x0 + i * (z + g), y0, z, o);
          s.text(names[i]!, x0 + i * (z + g) + z / 2, y0 + z + u * 5, { size: 3.6, color: s.c('--ink-2') });
          pill(s, 'cat', x0 + i * (z + g) + z / 2, y0 + z + u * 12, 'gold', { size: 3.4 });
        });
      });
    });
    // The training loop's one extra step.
    const lA = s.win('loop', 'flip');
    s.alpha(lA, () => {
      const z = u * 29;
      const span = z * 2 + u * 26;
      const x0 = cx - span / 2;
      const x1 = x0 + z + u * 26;
      const y0 = u * 15;
      pic(s, d?.cat, x0, y0, z);
      pill(s, 'label: cat', x0 + z / 2, y0 + z + u * 5, 'gold', { size: 3.3 });
      const e = s.since('every') >= 0 ? Math.floor(s.since('every') / 0.85) + 2 : 1;
      const a1 = s.ease('loop', 0.5, 1.6);
      s.alpha(a1, () => {
        s.arrow(x0 + z + u * 2, y0 + z / 2, x1 - u * 2, y0 + z / 2, s.c('orange'), 0.5, 2.2);
        s.text('augment', (x0 + z + x1) / 2, y0 + z / 2 - u * 4, { size: 3.5, font: 'mono', weight: 600, color: s.c('orange') });
        view(s, d?.cat, VIEWS[e % VIEWS.length]!, x1, y0, z);
        s.text(`epoch ${e}`, x1 + z / 2, y0 + z + u * 5, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      });
      const a2 = s.ease('loop', 0.5, 3.6);
      s.alpha(a2, () => {
        const by = y0 + z + u * 15;
        const bw = s.measure('net.loss(img, label)', { font: 'mono', size: 3.6 }) + u * 6;
        s.arrow(x1 + z / 2, y0 + z + u * 8, cx + u * 6, by - u * 0.6, s.c('--ink-3'), 0.35, 1.8);
        s.arrow(x0 + z / 2, y0 + z + u * 8.5, cx - u * 6, by - u * 0.6, s.c('--ink-3'), 0.35, 1.8);
        s.rrect(cx - bw / 2, by, bw, u * 8, 1.6, { fill: s.tint('red', 0.08), stroke: s.tint('red', 0.6), lw: 0.35 });
        s.text('net.loss(img, label)', cx, by + u * 4.2, { size: 3.6, font: 'mono', weight: 600, color: s.c('red') });
      });
      s.alpha(s.ease('every', 0.6, 1.2), () => s.text('new pixels every epoch; the cat stays', cx, h - u * 6, { size: 3.7, italic: true, color: s.c('--ink-2') }));
    });
    // Horizontal flips; vertical ones are rarely safe.
    const fA = s.win('flip', 'crop');
    s.alpha(fA, () => {
      const three = s.ease('updown', 0.8);
      const z = lerp(Math.min(u * 30, (w - u * 40) / 2), Math.min(u * 26, (w - u * 22) / 3), three);
      const g = lerp(u * 30, u * 7, three);
      const n = lerp(2, 3, three);
      const x0 = cx - (n * z + (n - 1) * g) / 2;
      const y0 = u * 18;
      const fl = Math.cos(Math.PI * s.ease('flip', 1.2, 0.9));
      s.text('horizontal flip', cx, u * 8, { size: 4.6, font: 'display', weight: 600 });
      pic(s, d?.cat, x0, y0, z);
      s.text('columns 0 … 31', x0 + z / 2, y0 + z + u * 4.5, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      s.alpha(1 - three, () => s.text('img[:, ::-1]', x0 + z + g / 2, y0 + z / 2 - u * 4.5, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange') }));
      s.arrow(x0 + z + u * 2, y0 + z / 2, x0 + z + g - u * 2, y0 + z / 2, s.c('orange'), 0.45, 2);
      pic(s, d?.cat, x0 + z + g, y0, z, { flip: Math.abs(fl) < 0.02 ? 0.02 : fl });
      s.text('columns 31 … 0', x0 + z + g + z / 2, y0 + z + u * 4.5, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      s.alpha(s.ease('flip', 0.5, 2.2), () => {
        check(s, x0 + z + g + z - u * 1.5, y0 + u * 1.5, u * 2.4);
        pill(s, 'still a cat', x0 + z + g + z / 2, y0 + z + u * 11.5, 'green', { size: 3.3 });
      });
      s.alpha(three, () => {
        const x2 = x0 + 2 * (z + g);
        pic(s, d?.cat, x2, y0, z, { vflip: true });
        cross(s, x2 + z - u * 1.5, y0 + u * 1.5, u * 2.4);
        s.text('upside down', x2 + z / 2, y0 + z + u * 4.5, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        pill(s, 'rarely safe', x2 + z / 2, y0 + z + u * 11.5, 'red', { size: 3.3 });
        s.text('the world has an up and a down', cx, h - u * 7, { size: 3.7, italic: true, color: s.c('--ink-2') });
      });
    });
    // Random scales and crops.
    const cA = s.win('crop', 'test');
    if (cA > 0) {
      const k = Math.max(0, Math.floor(s.since('crop') / 1.6));
      const tk = s.since('crop') - k * 1.6;
      const prev = CROPS[Math.max(0, k - 1) % CROPS.length]!;
      const cur = CROPS[k % CROPS.length]!;
      const e = k === 0 ? 1 : smooth(tk / 0.45);
      const L = lerp(prev.L, cur.L, e);
      const fx = lerp(prev.fx, cur.fx, e);
      const fy = lerp(prev.fy, cur.fy, e);
      s.alpha(cA, () => {
        const big = Math.min(u * 46, w * 0.4);
        const side = (big * L) / 480;
        const win = (big * 224) / 480;
        const x0 = cx - big - u * 8;
        const y0 = u * 22;
        s.text('random scale, random crop', cx, u * 8, { size: 4.6, font: 'display', weight: 600 });
        pic(s, d?.cat, x0, y0, side);
        const small = (big * 256) / 480;
        dashed(s, x0, y0, small, small, s.tint('--ink', 0.35), 0.3);
        dashed(s, x0, y0, big, big, s.tint('--ink', 0.35), 0.3);
        s.text(`L = ${Math.round(L)}`, x0 + side / 2, y0 - u * 4, { size: 3.6, font: 'mono', weight: 600, color: s.c('orange') });
        s.text('shorter side L, from 256 to 480', x0 + big / 2, y0 + big + u * 6, { size: 3.3, color: s.c('--ink-2') });
        const pA = s.ease('patch', 0.6);
        s.alpha(pA, () => {
          const wx = x0 + (side - win) * fx;
          const wy = y0 + (side - win) * fy;
          s.rrect(wx, wy, win, win, 0.4, { stroke: s.c('--accent'), lw: 0.6 });
          s.text('224', wx + win / 2, wy + win + u * 3, { size: 3, font: 'mono', weight: 600, color: s.c('--accent'), halo: true });
          const ox = cx + u * 10;
          const oz = Math.min(u * 32, w * 0.3);
          const oy = y0 + (big - oz) / 2;
          s.arrow(x0 + big + u * 2, oy + oz / 2, ox - u * 2, oy + oz / 2, s.c('--accent'), 0.45, 2);
          const sw = (32 * 224) / L;
          pic(s, d?.cat, ox, oy, oz, { src: [(32 - sw) * fx, (32 - sw) * fy, sw, sw], frame: '--accent' });
          s.text('224 × 224: what the net sees', ox + oz / 2, oy + oz + u * 5, { size: 3.3, color: s.c('--ink-2') });
        });
      });
    }
    // Test time: ten fixed crops, averaged.
    const vA = s.ease('test', 0.6);
    s.alpha(vA, () => {
      const z = u * 30;
      const x0 = cx - z / 2;
      const y0 = u * 8;
      pic(s, d?.cat, x0, y0, z);
      const hot = Math.floor(s.since('test') / 0.7) % 5;
      TEN.forEach(([ox, oy], i) => {
        const on = s.since('ten') >= 0 ? clamp01((s.t - at(s, 'ten', 0.08 + i * 0.07)) * 3) : i === hot ? 1 : 0;
        const col = on > 0.5 ? s.c('--accent') : s.tint('--accent', 0.45);
        dashed(s, x0 + (ox / 32) * z + u * 0.3, y0 + (oy / 32) * z + u * 0.3, (28 / 32) * z - u * 0.6, (28 / 32) * z - u * 0.6, col, on > 0.5 ? 0.5 : 0.3);
      });
      const tz = Math.min(u * 15, (w - u * 18) / 5.6);
      const g = u * 2;
      const gx = cx - (5 * tz + 4 * g) / 2;
      for (let r = 0; r < 2; r++)
        for (let i = 0; i < 5; i++) {
          const a = s.since('ten') >= 0 ? clamp01((s.t - at(s, 'ten', 0.08 + (r * 5 + i) * 0.07)) * 3) : 0;
          const [ox, oy] = TEN[i]!;
          const tx = gx + i * (tz + g);
          const ty = y0 + z + u * 7 + r * (tz + g);
          dashed(s, tx, ty, tz, tz, s.tint('--ink', 0.25), 0.3);
          s.alpha(a, () => pic(s, d?.cat, tx, ty, tz, { flip: r ? -1 : 1, src: [ox, oy, 28, 28] }));
        }
      s.alpha(s.ease('ten', 0.5, 0.8), () => s.text('four corners and the center, then their mirror images', cx, y0 + z + u * 7 + 2 * tz + g + u * 5, { size: fit(s, 'four corners and the center, then their mirror images', w - u * 10, 3.3), color: s.c('--ink-2') }));
      s.alpha(s.ease('ten', 0.6, 1.8), () => s.text('probs = the mean of the ten predictions', cx, h - u * 4.5, { size: fit(s, 'probs = the mean of the ten predictions', w - u * 10, 3.6, { font: 'mono', weight: 600 }), font: 'mono', weight: 600, color: s.c('teal') }));
    });
  },
};

// ---------------------------------------------------------------- color

type V3 = [number, number, number];

/** RGB cube in 3-D: R to the right, G up, B toward the viewer, turned by `th` and tilted. */
function proj(cx: number, cy: number, k: number, th: number) {
  const ph = 0.42;
  return (p: V3): [number, number] => {
    const x = p[0] - 0.5;
    const y = p[1] - 0.5;
    const z = p[2] - 0.5;
    const x1 = x * Math.cos(th) + z * Math.sin(th);
    const z1 = -x * Math.sin(th) + z * Math.cos(th);
    const y2 = y * Math.cos(ph) - z1 * Math.sin(ph);
    return [cx + k * x1, cy - k * y2];
  };
}

const CUBE_EDGES: [V3, V3][] = (() => {
  const out: [V3, V3][] = [];
  const corners: V3[] = [];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) corners.push([a, b, c]);
  for (const p of corners) for (const q of corners) if (p < q && Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) === 1) out.push([p, q]);
  return out;
})();

const color: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const d = cifar(s);
    const cx = w / 2;
    // Contrast.
    s.alpha(s.win('jitter', 'alex'), () => {
      const z = Math.min(u * 28, (w - u * 24) / 3);
      const g = u * 6;
      const x0 = cx - (3 * z + 2 * g) / 2;
      const y0 = u * 22;
      s.text('random contrast', cx, u * 10, { size: 4.8, font: 'display', weight: 600 });
      const cvs = [d?.contrast[0], d?.cat, d?.contrast[1]];
      ['c = 0.6', 'c = 1', 'c = 1.4'].forEach((lab, i) => {
        s.alpha(i === 1 ? 1 : s.ease('jitter', 0.5, 1.4 + (i === 2 ? 0.6 : 0)), () => {
          pic(s, cvs[i], x0 + i * (z + g), y0, z);
          s.text(lab, x0 + i * (z + g) + z / 2, y0 + z + u * 5, { size: 3.6, font: 'mono', weight: 600, color: s.c(i === 1 ? '--ink-2' : 'orange') });
        });
      });
      s.text('(img − m) · c + m', cx, y0 + z + u * 16, { size: 4, font: 'mono', color: s.c('orange') });
    });
    // The RGB cloud and its principal axes.
    const cA = s.win('alex', 'shift');
    if (cA > 0) {
      const k = Math.min(u * 40, w * 0.34);
      const P = proj(cx, u * 50, k, 0.62 + 0.09 * s.t);
      s.alpha(cA, () => {
        s.alpha(1 - s.ease('cloud', 0.5), () => s.text('which way do colors vary?', cx, u * 9, { size: 4.6, font: 'display', weight: 600 }));
        s.alpha(s.ease('cloud', 0.5), () => s.text('every pixel, as a point in RGB', cx, u * 9, { size: 4.6, font: 'display', weight: 600 }));
        for (const [p, q] of CUBE_EDGES) {
          const [x0, y0] = P(p);
          const [x1, y1] = P(q);
          s.line(x0, y0, x1, y1, s.tint('--ink', 0.12), 0.25);
        }
        const axes: [V3, string, K][] = [
          [[1, 0, 0], 'R', 'red'],
          [[0, 1, 0], 'G', 'green'],
          [[0, 0, 1], 'B', 'blue'],
        ];
        const [ox, oy] = P([0, 0, 0]);
        for (const [e, lab, kk] of axes) {
          const [x1, y1] = P(e);
          s.arrow(ox, oy, x1, y1, s.c(kk), 0.45, 1.8);
          const [lx, ly] = P([e[0] * 1.14, e[1] * 1.14, e[2] * 1.14]);
          s.text(lab, lx, ly, { size: 3.8, font: 'ui', weight: 700, color: s.c(kk), halo: true });
        }
        if (d) {
          const n = Math.floor(d.cloud.length * s.ease('cloud', 2.2, 0.5));
          const c = s.ctx;
          const r = u * 0.55;
          for (let q = 0; q < n; q++) {
            const p = d.cloud[q]!;
            const [x, y] = P(p);
            c.fillStyle = `rgb(${Math.round(p[0] * 255)},${Math.round(p[1] * 255)},${Math.round(p[2] * 255)})`;
            c.fillRect(x - r, y - r, 2 * r, 2 * r);
          }
          const eA = s.ease('eig', 0.8, 0.6);
          if (eA > 0) {
            const bright = s.ease('bright', 0.6);
            s.alpha(eA, () => {
              s.alpha(bright, () => {
                const [ax, ay] = P([0, 0, 0]);
                const [bx, by] = P([1, 1, 1]);
                s.line(ax, ay, bx, by, s.tint('--ink', 0.45), 0.35, [1.2, 1]);
              });
              const m = d.mean as V3;
              [0, 1, 2].forEach((i) => {
                const len = 0.62 * (d.evals[i]! / d.evals[0]!) ** 0.3;
                const v: V3 = [d.evecs[0]![i]!, d.evecs[1]![i]!, d.evecs[2]![i]!];
                const tip: V3 = [m[0] + v[0] * len, m[1] + v[1] * len, m[2] + v[2] * len];
                const tail: V3 = [m[0] - v[0] * len, m[1] - v[1] * len, m[2] - v[2] * len];
                const [x0, y0] = P(tail);
                const [x1, y1] = P(tip);
                const kk: K = (['--ink', 'purple', 'teal'] as K[])[i]!;
                const lw = i === 0 ? 0.7 + 0.35 * bright : 0.55;
                s.arrow(x0, y0, x1, y1, s.c(kk), lw, 2.2);
                s.arrow(x1, y1, x0, y0, s.c(kk), lw, 2.2);
                const dl = Math.hypot(x1 - x0, y1 - y0) || 1;
                s.text(`p${'₁₂₃'[i]}`, x1 + ((x1 - x0) / dl) * u * 3.4, y1 + ((y1 - y0) / dl) * u * 3.4, { size: 3.8, font: 'serif', italic: true, weight: 650, color: s.c(kk), halo: true });
              });
              const gap = Math.min(u * 34, (w - u * 10) / 3);
              d.evals.forEach((v, i) => s.text(`λ${'₁₂₃'[i]} = ${fmt(v, 2)}`, cx + (i - 1) * gap, h - u * 4.5, { size: 3.3, font: 'mono', weight: 600, color: s.c((['--ink', 'purple', 'teal'] as K[])[i]!) }));
              s.alpha(bright, () => {
                const v = [0, 1, 2].map((r) => d.evecs[r]![0]!.toFixed(2)).join(', ');
                pill(s, `p₁ ≈ (${v}): brightness`, cx, h - u * 12, '--ink-2', { size: 3.2 });
              });
            });
          }
        }
      });
    }
    // One offset per image.
    s.alpha(s.win('shift', 'creative'), () => {
      s.text('one color offset per image', cx, u * 9, { size: 4.8, font: 'display', weight: 600 });
      const big = u * 25;
      pic(s, d?.cat, cx - big / 2, u * 15, big);
      s.text('original', cx + big / 2 + u * 2.5, u * 15 + big / 2, { size: 3.2, align: 'left', color: s.c('--ink-2') });
      s.alpha(s.ease('shift', 0.5, 1.2), () => {
        s.arrow(cx, u * 15 + big + u * 1.2, cx, u * 47.5, s.c('--ink-3'), 0.4, 1.6);
        s.text('+ evecs · (α · λ)', cx + u * 2.5, u * 44.5, { size: 3, font: 'mono', align: 'left', color: s.c('orange') });
      });
      const z = Math.min(u * 19, (w - u * 20) / 4.6);
      const g = u * 4;
      const x0 = cx - (4 * z + 3 * g) / 2;
      const y0 = u * 50;
      for (let i = 0; i < 4; i++) {
        s.alpha(s.ease('shift', 0.4, 1.8 + i * 0.6), () => {
          const x = x0 + i * (z + g);
          pic(s, d?.pca[i], x, y0, z);
          if (d) {
            const sh = d.shifts[i]!;
            const col = `rgb(${sh.map((v) => Math.round(Math.max(0, Math.min(1, 0.5 + v * 2.2)) * 255)).join(',')})`;
            s.rrect(x + z * 0.15, y0 + z + u * 2, z * 0.7, u * 4, 1, { fill: col, stroke: s.c('--rule'), lw: 0.3 });
          }
        });
      }
      s.alpha(s.ease('shift', 0.5, 4), () => s.text('each swatch: one image\'s offset (exaggerated here)', cx, y0 + z + u * 11, { size: fit(s, "each swatch: one image's offset (exaggerated here)", w - u * 10, 3.2), color: s.c('--ink-2') }));
      s.alpha(s.ease('light', 0.6), () => pill(s, 'same scene, different light: still a cat', cx, h - u * 6, 'green', { size: 3.4 }));
    });
    // Anything that keeps the label, and what does not.
    s.alpha(s.ease('creative', 0.6), () => {
      const z = Math.min(u * 22, (w - u * 22) / 4.4);
      const g = u * 4;
      const x0 = cx - (4 * z + 3 * g) / 2;
      const y0 = u * 13;
      const rock = Math.sin(s.t * 1.7);
      const items: [string, Parameters<typeof pic>[5]][] = [
        ['rotate', { rot: 0.2 * rock }],
        ['stretch', { stretch: 1.18 + 0.12 * rock }],
        ['shear', { shear: 0.28 * rock }],
        ['all three', { rot: -0.15, stretch: 1.15, shear: 0.2, flip: -1 }],
      ];
      items.forEach(([lab, o], i) => {
        s.alpha(s.ease('creative', 0.5, 0.6 + i * 0.6), () => {
          pic(s, d?.cat, x0 + i * (z + g), y0, z, o);
          s.text(lab, x0 + i * (z + g) + z / 2, y0 + z + u * 4.5, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
        });
      });
      const sA = s.ease('six', 0.6);
      s.alpha(sA, () => {
        const yy = y0 + z + u * 26;
        const sat = Math.min(u * 20, w * 0.18);
        const lx = cx - u * 30;
        satellite(s, lx - sat / 2, yy - sat / 2, sat, s.since('six') * 0.9);
        check(s, lx + sat / 2 + u * 1, yy - sat / 2 - u * 1, u * 2.4);
        s.text('satellite photo: any angle', lx, yy + sat / 2 + u * 5, { size: 3.3, color: s.c('--ink-2') });
        const rx = cx + u * 24;
        const ang = Math.PI * s.ease('six', 1.1, 1.6);
        const c = s.ctx;
        c.save();
        c.translate(rx, yy);
        c.rotate(ang);
        s.text('6', 0, u * 0.6, { size: 19, font: 'display', weight: 600, color: s.c(ang > 3 ? 'red' : '--ink') });
        c.restore();
        s.alpha(s.ease('six', 0.5, 2.8), () => {
          cross(s, rx + u * 9, yy - u * 9, u * 2.4);
          s.text('a 6 turned 180° is a 9', rx, yy + sat / 2 + u * 5, { size: 3.3, color: s.c('red') });
        });
      });
    });
  },
};

/** A made-up aerial view (fields, a river, a road), turned by `rot`: no up or down. */
function satellite(s: Scene, x: number, y: number, size: number, rot: number): void {
  const c = s.ctx;
  c.save();
  c.beginPath();
  c.rect(x, y, size, size);
  c.clip();
  c.translate(x + size / 2, y + size / 2);
  c.rotate(rot);
  const n = 6;
  const cs = (size * 1.5) / n;
  const fields = ['#7a9a4a', '#a6b860', '#c9b47a', '#5f8a3e', '#b59a62', '#8fae58'];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      c.fillStyle = fields[Math.floor(hash(i, j) * fields.length)]!;
      c.fillRect(-size * 0.75 + j * cs, -size * 0.75 + i * cs, cs + 0.5, cs + 0.5);
    }
  c.beginPath();
  c.moveTo(-size * 0.8, -size * 0.2);
  c.bezierCurveTo(-size * 0.2, -size * 0.5, size * 0.1, size * 0.4, size * 0.8, size * 0.15);
  c.strokeStyle = '#4f86b8';
  c.lineWidth = size * 0.09;
  c.stroke();
  c.beginPath();
  c.moveTo(-size * 0.2, -size * 0.8);
  c.lineTo(size * 0.3, size * 0.8);
  c.strokeStyle = '#d8d2c4';
  c.lineWidth = size * 0.035;
  c.stroke();
  c.restore();
  s.rrect(x, y, size, size, 0.4, { stroke: s.tint('--ink', 0.25), lw: 0.25 });
}

// ---------------------------------------------------------------- noise

/** Ten views' probabilities for cat, dog, deer; two crops are unlucky. */
const PV = [
  [0.62, 0.25, 0.13],
  [0.55, 0.3, 0.15],
  [0.35, 0.52, 0.13],
  [0.7, 0.18, 0.12],
  [0.58, 0.22, 0.2],
  [0.48, 0.3, 0.22],
  [0.66, 0.2, 0.14],
  [0.3, 0.45, 0.25],
  [0.6, 0.28, 0.12],
  [0.52, 0.26, 0.22],
];
const PAVG = [0, 1, 2].map((c) => PV.reduce((a, v) => a + v[c]!, 0) / PV.length);
const PK: K[] = ['teal', 'slate', 'gold'];
const sub = (n: number): string => [...String(n)].map((ch) => '₀₁₂₃₄₅₆₇₈₉'[Number(ch)]).join('');

/** Stable pseudo-random 0..1 from integers, for noise that changes in steps. */
const hash = (a: number, b: number): number => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function bars(s: Scene, x: number, y: number, bw: number, hMax: number, p: number[], o: { gap?: number; on?: number } = {}): void {
  const g = o.gap ?? s.u * 0.6;
  p.forEach((v, i) => {
    const bh = hMax * v;
    s.rrect(x + i * (bw + g), y + hMax - bh, bw, bh, 0.3, { fill: s.tint(PK[i]!, 0.45 + 0.4 * (o.on ?? 0)) });
  });
  s.line(x - s.u * 0.4, y + hMax, x + 3 * bw + 2 * g + s.u * 0.4, y + hMax, s.tint('--ink', 0.3), 0.25);
}

const noise: SceneDef = {
  marks: {
    eq: { tex: String.raw`\symp(y \mid \symX) \approx \frac{1}{M}\sum_{m=1}^{M} \symp\big(y \mid T_m(\symX)\big)`, x: 0.5, y: 0.14, size: 5.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    const d = cifar(s);
    const cx = w / 2;
    const tableA = s.win('theme', 'eq');
    s.alpha(tableA, () => {
      const head = s.ease('rule', 0.6);
      s.alpha(1 - head, () => {
        s.text('noise in, average out', cx, h * 0.42, { size: 7, font: 'display', weight: 600 });
        s.text('a pattern that runs through the course', cx, h * 0.42 + u * 9, { size: 4, italic: true, color: s.c('--ink-2') });
      });
      const nameW = Math.max(u * 26, w * 0.23);
      const x1 = u * 4 + nameW;
      const colW = (w - x1 - u * 6) / 2;
      const x2 = x1 + colW + u * 2;
      const rowH = u * 17;
      const y0 = u * 20;
      const mv = s.ease('drop', 0.8);
      s.alpha(head, () => {
        const f1 = fit(s, 'training: add noise', colW, 4, { weight: 650 });
        const f2 = fit(s, 'test: average it away', colW, 4, { weight: 650 });
        s.text('training: add noise', lerp(cx, x1 + colW / 2, mv), lerp(h * 0.38, u * 10, mv), { size: lerp(6, f1, mv), weight: 650, color: s.c('orange') });
        s.text('test: average it away', lerp(cx, x2 + colW / 2, mv), lerp(h * 0.38 + u * 12, u * 10, mv), { size: lerp(6, f2, mv), weight: 650, color: s.c('teal') });
        s.alpha(mv, () => s.line(u * 4, u * 15, w - u * 4, u * 15, s.c('--rule'), 0.3));
      });
      const rows = ['drop', 'bn', 'ens', 'aug'];
      const names = ['dropout', 'batch norm', 'ensemble', 'augment'];
      rows.forEach((id, r) => {
        const a = s.ease(id, 0.6);
        if (a <= 0) return;
        const y = y0 + r * rowH;
        const on = current(s, rows) === id ? 1 : 0;
        s.alpha(a, () => {
          if (on) s.rrect(u * 2.5, y - u * 1, w - u * 5, rowH - u * 1.5, 1.6, { fill: s.tint('--accent', 0.06) });
          s.text(names[r]!, u * 5, y + rowH / 2 - u * 1.2, { size: fit(s, names[r]!, nameW - u * 2, 4, { font: 'display', weight: 600 }), font: 'display', weight: 600, align: 'left' });
          const cyR = y + rowH / 2 - u * 1.2;
          const step = Math.floor(s.t / 0.55);
          if (r === 0) {
            for (const [xx, test] of [
              [x1, false],
              [x2, true],
            ] as [number, boolean][]) {
              for (let i = 0; i < 6; i++) {
                const nx = xx + colW * (0.12 + i * 0.152);
                const off = !test && hash(step, i) < 0.4;
                s.circle(nx, cyR, u * 2, { fill: off ? s.c('--card') : s.tint(test ? 'teal' : 'purple', test ? 0.45 : 0.75), stroke: s.tint(test ? 'teal' : 'purple', 0.8), lw: 0.3 });
                if (off) {
                  s.line(nx - u * 1.1, cyR - u * 1.1, nx + u * 1.1, cyR + u * 1.1, s.c('red'), 0.35);
                  s.line(nx - u * 1.1, cyR + u * 1.1, nx + u * 1.1, cyR - u * 1.1, s.c('red'), 0.35);
                }
              }
            }
            s.text('× p', x2 + colW * 0.96, cyR - u * 4.2, { size: 3, font: 'mono', align: 'right', color: s.c('teal') });
          } else if (r === 1) {
            for (const [xx, test] of [
              [x1, false],
              [x2, true],
            ] as [number, boolean][]) {
              const bw = colW * 0.08;
              const hs = [0.25, 0.5, 0.85, 1, 0.8, 0.45, 0.2];
              hs.forEach((v, i) => s.rrect(xx + colW * 0.18 + i * bw * 1.15, cyR + u * 4 - v * u * 8, bw, v * u * 8, 0.2, { fill: s.tint('slate', 0.3) }));
              const mid = xx + colW * 0.18 + 3.5 * bw * 1.15;
              const mx = test ? mid : mid + (hash(step, 7) - 0.5) * colW * 0.3;
              s.line(mx, cyR - u * 5.5, mx, cyR + u * 4.6, s.c(test ? 'teal' : 'red'), 0.5);
              s.text(test ? 'running μ' : 'batch μ', mx, cyR - u * 6.8, { size: 2.8, font: 'mono', color: s.c(test ? 'teal' : 'red'), halo: true });
            }
          } else if (r === 2) {
            for (let n = 0; n < 3; n++) {
              const gx = x1 + colW * (0.06 + n * 0.32);
              const cs = Math.min(u * 2.6, colW * 0.08);
              for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
                const v = hash(n * 9 + i * 3 + j, 3) * 2 - 1;
                s.rrect(gx + j * cs, cyR - cs * 1.5 + i * cs, cs * 0.9, cs * 0.9, 0.2, { fill: s.tint(v > 0 ? 'blue' : 'red', 0.15 + 0.6 * Math.abs(v)) });
              }
            }
            bars(s, x2 + colW * 0.3, cyR - u * 5, Math.min(u * 3.4, colW * 0.12), u * 9.5, PAVG);
            s.text('mean of 3', x2 + colW * 0.84, cyR, { size: 2.8, font: 'mono', color: s.c('teal') });
          } else {
            const z = Math.min(rowH - u * 4.5, colW * 0.36);
            view(s, d?.cat, VIEWS[step % VIEWS.length]!, x1 + colW * 0.3, cyR - z / 2, z);
            const tw = s.measure('→ mean', { font: 'mono', size: 2.8 });
            const tz = Math.min(z * 0.62, (colW * 0.96 - tw - u * 3.4) / 4);
            for (let i = 0; i < 4; i++) {
              const [ox, oy] = TEN[i]!;
              pic(s, d?.cat, x2 + colW * 0.02 + i * (tz + u * 0.8), cyR - tz / 2, tz, { src: [ox, oy, 28, 28] });
            }
            s.text('→ mean', x2 + colW * 0.02 + 4 * (tz + u * 0.8) + u * 0.6, cyR, { size: 2.8, font: 'mono', align: 'left', color: s.c('teal') });
          }
        });
      });
    });
    // M views, averaged.
    const eA = s.ease('eq', 0.6);
    if (eA > 0) {
      s.show('eq', eA);
      s.alpha(eA, () => {
        const gw = Math.min(u * 13, (w - u * 12) / 10.4);
        const bw = gw * 0.24;
        const x0 = cx - (10 * gw) / 2;
        const y0 = u * 30;
        const hM = u * 17;
        const luck = s.ease('cost', 0.6);
        PV.forEach((p, i) => {
          const a = clamp01((s.t - at(s, 'eq', 0.15 + i * 0.05)) * 3);
          s.alpha(a, () => {
            const bad = p[1]! > p[0]!;
            if (bad) s.alpha(luck, () => s.rrect(x0 + i * gw - u * 0.2, y0 - u * 2, gw - u * 0.8, hM + u * 9, 1.2, { stroke: s.c('red'), lw: 0.4 }));
            bars(s, x0 + i * gw + gw * 0.08, y0, bw, hM, p);
            s.text(`T${sub(i + 1)}`, x0 + i * gw + gw * 0.42, y0 + hM + u * 3.5, { size: 2.9, font: 'serif', italic: true, color: s.c('--ink-3') });
          });
        });
        const avgA = s.ease('eq', 0.6, 2.4);
        s.alpha(avgA, () => {
          const abw = u * 8;
          const ag = u * 2.6;
          const gwid = 3 * abw + 2 * ag;
          const ax = cx - u * 4 - gwid;
          const ay = y0 + hM + u * 15;
          const aH = u * 20;
          s.text('↓ the average', ax + gwid / 2, ay - u * 5.5, { size: 3.4, color: s.c('teal'), weight: 650 });
          bars(s, ax, ay, abw, aH, PAVG, { gap: ag, on: 1 });
          ['cat', 'dog', 'deer'].forEach((nm, i) => {
            s.text(nm, ax + i * (abw + ag) + abw / 2, ay + aH + u * 3.6, { size: 3.2, color: s.c(PK[i]!) });
            s.text(fmt(PAVG[i]!, 2), ax + i * (abw + ag) + abw / 2, ay + aH - PAVG[i]! * aH - u * 2.4, { size: 3, font: 'mono', color: s.c('--ink-2'), halo: true });
          });
          const nx = cx + u * 2;
          s.text('the average says cat', nx, ay + u * 4, { size: fit(s, 'the average says cat', w - nx - u * 4, 3.3, { weight: 600 }), align: 'left', weight: 600, color: s.c('teal') });
          s.alpha(luck, () => {
            s.text('2 unlucky crops said dog', nx, ay + u * 11, { size: fit(s, '2 unlucky crops said dog', w - nx - u * 4, 3.2), align: 'left', color: s.c('red') });
            s.text('cost: M = 10 passes', nx, ay + u * 18, { size: fit(s, 'cost: M = 10 passes', w - nx - u * 4, 3.2, { font: 'mono' }), align: 'left', font: 'mono', color: s.c('--ink-2') });
          });
        });
      });
    }
  },
};

export const scenesA: Record<string, SceneDef> = { intro, augment, color, noise };
