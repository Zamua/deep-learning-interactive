/**
 * A procedurally drawn street scene with exact ground truth: boxes, a per-pixel class map and
 * per-pixel instance ids. The detection chapter's figures all share it, so every box, mask and
 * score refers to the same five objects.
 */

export const SCENE_W = 480;
export const SCENE_H = 320;

/** Corner form: x1, y1, x2, y2 in scene pixels (y down, like an image). */
export type Box = [number, number, number, number];

export const SCENE_CLASSES = ['background', 'car', 'person', 'dog', 'cat'] as const;

/** Palette key per class index (background has none). */
export const CLASS_COLOR = ['slate', 'red', 'blue', 'orange', 'purple'] as const;

export interface SceneObject {
  cls: number;
  name: string;
  box: Box;
}

export const OBJECTS: SceneObject[] = [
  { cls: 1, name: 'car', box: [24, 176, 196, 266] },
  { cls: 2, name: 'person', box: [214, 112, 256, 270] },
  { cls: 2, name: 'person', box: [262, 178, 290, 270] },
  { cls: 3, name: 'dog', box: [304, 206, 400, 270] },
  { cls: 4, name: 'cat', box: [414, 196, 462, 268] },
];

export function iou(a: Box, b: Box): number {
  const iw = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const ih = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = iw * ih;
  const ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return ua > 0 ? inter / ua : 0;
}

type Ctx = CanvasRenderingContext2D;

function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  c.fill();
}

function poly(c: Ctx, pts: number[]): void {
  c.beginPath();
  c.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i]!, pts[i + 1]!);
  c.closePath();
  c.fill();
}

/** `flat` paints every part in one color (for masks); otherwise the object gets its own colors. */
function drawCar(c: Ctx, [x1, y1, x2, y2]: Box, flat: string | null): void {
  const w = x2 - x1, h = y2 - y1;
  const r = h * 0.16;
  const col = (s: string) => (c.fillStyle = flat ?? s);
  col('#c8443a');
  poly(c, [x1 + 0.17 * w, y1 + 0.42 * h, x1 + 0.3 * w, y1, x1 + 0.68 * w, y1, x1 + 0.85 * w, y1 + 0.42 * h]);
  rrect(c, x1, y1 + 0.38 * h, w, h * 0.5 - r * 0.2, h * 0.12);
  if (!flat) {
    col('#cfe6f2');
    poly(c, [x1 + 0.22 * w, y1 + 0.4 * h, x1 + 0.32 * w, y1 + 0.07 * h, x1 + 0.48 * w, y1 + 0.07 * h, x1 + 0.48 * w, y1 + 0.4 * h]);
    poly(c, [x1 + 0.52 * w, y1 + 0.4 * h, x1 + 0.52 * w, y1 + 0.07 * h, x1 + 0.66 * w, y1 + 0.07 * h, x1 + 0.79 * w, y1 + 0.4 * h]);
    col('#a3342c');
    c.fillRect(x1 + 0.5 * w - 0.6, y1 + 0.46 * h, 1.4, h * 0.3);
    col('#f6d36b');
    rrect(c, x2 - 0.05 * w, y1 + 0.47 * h, 0.05 * w, 0.09 * h, 2);
    col('#7c1f1a');
    rrect(c, x1, y1 + 0.47 * h, 0.03 * w, 0.09 * h, 2);
  }
  for (const fx of [0.22, 0.78]) {
    col('#26282e');
    c.beginPath();
    c.arc(x1 + fx * w, y2 - r, r, 0, Math.PI * 2);
    c.fill();
    if (!flat) {
      col('#a4a9b1');
      c.beginPath();
      c.arc(x1 + fx * w, y2 - r, r * 0.45, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function drawPerson(c: Ctx, [x1, y1, x2, y2]: Box, flat: string | null, shirt: string): void {
  const w = x2 - x1, h = y2 - y1;
  const cx = (x1 + x2) / 2;
  const r = Math.min(w * 0.28, h * 0.085);
  const col = (s: string) => (c.fillStyle = flat ?? s);
  const hip = y1 + 0.58 * h;
  col('#323848');
  rrect(c, cx - 0.3 * w, hip - 2, 0.26 * w, y2 - hip + 2, 3);
  rrect(c, cx + 0.04 * w, hip - 2, 0.26 * w, y2 - hip + 2, 3);
  col('#e3b48d');
  rrect(c, x1, y1 + 2.4 * r, 0.17 * w, hip - y1 - 2.4 * r - 0.02 * h, 4);
  rrect(c, x2 - 0.17 * w, y1 + 2.4 * r, 0.17 * w, hip - y1 - 2.4 * r - 0.02 * h, 4);
  col(shirt);
  rrect(c, cx - 0.36 * w, y1 + 2.1 * r, 0.72 * w, hip - y1 - 2.1 * r, 6);
  rrect(c, x1, y1 + 2.15 * r, 0.2 * w, (hip - y1) * 0.32, 4);
  rrect(c, x2 - 0.2 * w, y1 + 2.15 * r, 0.2 * w, (hip - y1) * 0.32, 4);
  col('#e3b48d');
  c.beginPath();
  c.arc(cx, y1 + r, r, 0, Math.PI * 2);
  c.fill();
  if (!flat) {
    col('#3a2a20');
    c.beginPath();
    c.arc(cx, y1 + r, r, Math.PI * 1.02, Math.PI * 1.98);
    c.fill();
  }
}

function drawDog(c: Ctx, [x1, y1, x2, y2]: Box, flat: string | null): void {
  const w = x2 - x1, h = y2 - y1;
  const col = (s: string) => (c.fillStyle = flat ?? s);
  c.strokeStyle = flat ?? '#8a5a32';
  c.lineWidth = 0.07 * h;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x1 + 0.18 * w, y1 + 0.42 * h);
  c.quadraticCurveTo(x1 + 0.04 * w, y1 + 0.36 * h, x1 + 0.03 * w, y1 + 0.1 * h);
  c.stroke();
  col('#8a5a32');
  for (const fx of [0.22, 0.33, 0.6, 0.71]) rrect(c, x1 + fx * w, y1 + 0.5 * h, 0.075 * w, y2 - y1 - 0.5 * h, 3);
  col('#a26c3e');
  ellipse(c, x1 + 0.47 * w, y1 + 0.47 * h, 0.33 * w, 0.21 * h);
  poly(c, [x1 + 0.66 * w, y1 + 0.32 * h, x1 + 0.78 * w, y1 + 0.18 * h, x1 + 0.86 * w, y1 + 0.36 * h, x1 + 0.74 * w, y1 + 0.58 * h]);
  c.beginPath();
  c.arc(x2 - 0.15 * w, y1 + 0.225 * h, 0.15 * w, 0, Math.PI * 2);
  c.fill();
  ellipse(c, x2 - 0.065 * w, y1 + 0.33 * h, 0.065 * w, 0.08 * h);
  if (!flat) {
    col('#5e3c20');
    ellipse(c, x2 - 0.25 * w, y1 + 0.27 * h, 0.05 * w, 0.14 * h, 0.35);
    col('#1d1d1f');
    ellipse(c, x2 - 0.012 * w, y1 + 0.31 * h, 0.018 * w, 0.025 * h);
    c.beginPath();
    c.arc(x2 - 0.12 * w, y1 + 0.18 * h, 1.6, 0, Math.PI * 2);
    c.fill();
  }
}

function drawCat(c: Ctx, [x1, y1, x2, y2]: Box, flat: string | null): void {
  const w = x2 - x1, h = y2 - y1;
  const col = (s: string) => (c.fillStyle = flat ?? s);
  c.strokeStyle = flat ?? '#6c6e76';
  c.lineWidth = 0.1 * w;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x1 + 0.72 * w, y1 + 0.93 * h);
  c.quadraticCurveTo(x2 - 0.02 * w, y1 + 0.9 * h, x2 - 0.05 * w, y1 + 0.55 * h);
  c.stroke();
  col('#7d7f87');
  ellipse(c, x1 + 0.45 * w, y1 + 0.69 * h, 0.43 * w, 0.31 * h);
  c.beginPath();
  c.arc(x1 + 0.43 * w, y1 + 0.31 * h, 0.27 * w, 0, Math.PI * 2);
  c.fill();
  poly(c, [x1 + 0.2 * w, y1 + 0.26 * h, x1 + 0.22 * w, y1, x1 + 0.41 * w, y1 + 0.13 * h]);
  poly(c, [x1 + 0.46 * w, y1 + 0.13 * h, x1 + 0.64 * w, y1, x1 + 0.67 * w, y1 + 0.26 * h]);
  if (!flat) {
    col('#a9e07a');
    for (const fx of [0.34, 0.53]) {
      c.beginPath();
      c.arc(x1 + fx * w, y1 + 0.3 * h, 1.9, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function drawObject(c: Ctx, k: number, flat: string | null): void {
  const o = OBJECTS[k]!;
  if (o.name === 'car') drawCar(c, o.box, flat);
  else if (o.name === 'person') drawPerson(c, o.box, flat, k === 1 ? '#3f6fb5' : '#e08f3c');
  else if (o.name === 'dog') drawDog(c, o.box, flat);
  else drawCat(c, o.box, flat);
}

function drawBackground(c: Ctx): void {
  const sky = c.createLinearGradient(0, 0, 0, 210);
  sky.addColorStop(0, '#b9d8ee');
  sky.addColorStop(1, '#e6f1f7');
  c.fillStyle = sky;
  c.fillRect(0, 0, SCENE_W, 212);
  c.fillStyle = '#f4d77a';
  c.beginPath();
  c.arc(78, 52, 20, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [x, y, s] of [[170, 48, 1], [330, 34, 1.3], [430, 70, 0.8]] as const) {
    ellipse(c, x, y, 26 * s, 9 * s);
    ellipse(c, x + 14 * s, y - 6 * s, 16 * s, 9 * s);
    ellipse(c, x - 12 * s, y - 4 * s, 13 * s, 8 * s);
  }
  c.fillStyle = '#b4cfa0';
  c.beginPath();
  c.moveTo(0, 212);
  c.quadraticCurveTo(120, 160, 250, 205);
  c.quadraticCurveTo(360, 170, 480, 200);
  c.lineTo(480, 212);
  c.fill();
  const grass = c.createLinearGradient(0, 205, 0, 320);
  grass.addColorStop(0, '#9fc883');
  grass.addColorStop(1, '#7fae66');
  c.fillStyle = grass;
  c.fillRect(0, 208, SCENE_W, SCENE_H - 208);
  c.fillStyle = '#c9b48f';
  c.beginPath();
  c.moveTo(0, 262);
  c.lineTo(480, 258);
  c.lineTo(480, 284);
  c.lineTo(0, 290);
  c.fill();
  // background tree (not an object class)
  c.fillStyle = '#7b5a3c';
  c.fillRect(352, 130, 10, 84);
  c.fillStyle = '#5f9450';
  ellipse(c, 357, 112, 34, 38);
  ellipse(c, 336, 132, 22, 20);
  ellipse(c, 380, 128, 22, 22);
}

const cache = new Map<number, HTMLCanvasElement>();

/** The scene as a bitmap `px` device pixels wide (cached). */
export function sceneBitmap(px: number): HTMLCanvasElement {
  px = Math.max(48, Math.round(px));
  let cv = cache.get(px);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = px;
  cv.height = Math.round((px * SCENE_H) / SCENE_W);
  const c = cv.getContext('2d')!;
  c.scale(px / SCENE_W, px / SCENE_W);
  drawBackground(c);
  for (let k = 0; k < OBJECTS.length; k++) drawObject(c, k, null);
  if (cache.size > 6) cache.clear();
  cache.set(px, cv);
  return cv;
}

/** Draws the scene into a CSS-px rectangle starting at (x, y), `w` CSS px wide. */
export function drawScene(c: Ctx, x: number, y: number, w: number, alpha = 1): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.save();
  c.globalAlpha = alpha;
  c.imageSmoothingEnabled = true;
  c.drawImage(sceneBitmap(w * dpr), x, y, w, (w * SCENE_H) / SCENE_W);
  c.restore();
}

export interface SceneMasks {
  w: number;
  h: number;
  /** Class index per pixel (0 = background). */
  cls: Uint8Array;
  /** Object index + 1 per pixel (0 = background). */
  inst: Uint8Array;
}

const maskCache = new Map<number, SceneMasks>();

/** Ground-truth class and instance maps, downsampled by `down` (e.g. 2 gives 240 x 160). */
export function sceneMasks(down = 2): SceneMasks {
  const hit = maskCache.get(down);
  if (hit) return hit;
  const w = Math.round(SCENE_W / down);
  const h = Math.round(SCENE_H / down);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  const cls = new Uint8Array(w * h);
  const inst = new Uint8Array(w * h);
  OBJECTS.forEach((o, k) => {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    c.scale(1 / down, 1 / down);
    drawObject(c, k, '#000');
    const d = c.getImageData(0, 0, w, h).data;
    for (let i = 0; i < w * h; i++) {
      if (d[i * 4 + 3]! > 127) {
        cls[i] = o.cls;
        inst[i] = k + 1;
      }
    }
  });
  const m = { w, h, cls, inst };
  maskCache.set(down, m);
  return m;
}

/** Fits the 3:2 scene into a canvas of CSS size w x h: returns offset and scale (CSS px per scene px). */
export function fitScene(w: number, h: number, pad = 0): { ox: number; oy: number; k: number } {
  const k = Math.min((w - 2 * pad) / SCENE_W, (h - 2 * pad) / SCENE_H);
  return { ox: (w - SCENE_W * k) / 2, oy: (h - SCENE_H * k) / 2, k };
}
