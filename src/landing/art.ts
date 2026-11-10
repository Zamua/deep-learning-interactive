// The gilt binding, drawn in a book's own units (a cover is 600 by 895) and scaled to whatever canvas asks for it:
// as maps for the lit scene (`paintMaps`), or as finished pictures for the shelf that has no WebGL (`paintFace`).
export const CW = 600;
export const CH = 895;
const PAPER = '#f1e9d8';

const pen = (c: HTMLCanvasElement, settings?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D => c.getContext('2d', settings)!;
const hex = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** A colour part of the way from `a` to `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, '0')).join('');
}

export interface BookFace {
  id: string;
  title: string;
  /** The cloth's colour, as `#rrggbb`. */
  cover: string;
}

/** The faces the titles are set in, as CSS font families. */
export interface Fonts {
  display: string;
  body: string;
}

type Ink = string | CanvasGradient;
type Pt = [number, number];
/** A course's device: drawn about (cx, cy) within radius r, in `ink`, on `ground`, with a few parts picked out in `lit`. */
type Device = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number, ink: Ink, ground: Ink, lit: Ink) => void;

/** Gold foil: a metal that catches light in a band, never one flat colour. */
function foil(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const f = g.createLinearGradient(x0, y0, x1, y1);
  ([[0, '#b98a35'], [0.22, '#e6c170'], [0.42, '#fff0b5'], [0.55, '#dcb25a'], [0.78, '#b07f2c'], [1, '#e2bd6c']] as [number, string][]).forEach(([at, c]) => f.addColorStop(at, c));
  return f;
}

/** Cloth: a fine weave of light and dark threads, drawn in canvas pixels so it never blurs. */
function cloth(g: CanvasRenderingContext2D, strength = 1): void {
  const { width, height } = g.canvas;
  const t = document.createElement('canvas');
  t.width = t.height = 64;
  const c = pen(t);
  let s = 9;
  const rand = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const thread = (x + y) % 2 ? 0.05 : 0;
      const v = rand();
      c.fillStyle = v < 0.5 ? `rgba(0,0,0,${(thread + v * 0.12) * strength})` : `rgba(255,255,255,${(v - 0.5) * 0.09 * strength})`;
      c.fillRect(x, y, 1, 1);
    }
  }
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = g.createPattern(t, 'repeat')!;
  g.fillRect(0, 0, width, height);
  g.restore();
}

/**
 * Presses what `draw` paints into the cloth. The light comes from `light` (in the face's own units), so the wall of
 * the hollow on that side falls in shade and the far wall catches it, with the foil lying in the bottom.
 */
function stamp(g: CanvasRenderingContext2D, draw: (g: CanvasRenderingContext2D) => void, light: [number, number] = [-1, -1], depth = 1.5): void {
  const { width, height } = g.canvas;
  const m = g.getTransform();
  const sheet = () => Object.assign(document.createElement('canvas'), { width, height });
  const foilLayer = sheet();
  const fg = pen(foilLayer);
  fg.setTransform(m);
  draw(fg);
  const lip = (color: string) => {
    const t = sheet();
    const c = pen(t);
    c.drawImage(foilLayer, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, width, height);
    return t;
  };
  // The same push in canvas pixels, never less than one, whatever way the face is turned or squeezed.
  const px = (v: number) => (v === 0 ? 0 : Math.sign(v) * Math.max(1, Math.abs(v)));
  const ox = px((m.a * light[0] + m.c * light[1]) * depth);
  const oy = px((m.b * light[0] + m.d * light[1]) * depth);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(lip('rgba(0,0,0,.62)'), ox, oy);
  g.drawImage(lip('rgba(255,255,255,.34)'), -ox, -oy);
  g.drawImage(foilLayer, 0, 0);
  g.restore();
}

/** A panel pressed blind into the board: shade under its lit edges, light on the far ones. */
function sunk(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, deep = 0.1): void {
  g.fillStyle = `rgba(0,0,0,${deep})`;
  g.fillRect(x, y, w, h);
  const edge = (x0: number, y0: number, x1: number, y1: number, from: string, rx: number, ry: number, rw: number, rh: number) => {
    const e = g.createLinearGradient(x0, y0, x1, y1);
    e.addColorStop(0, from);
    e.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = e;
    g.fillRect(rx, ry, rw, rh);
  };
  edge(0, y, 0, y + 16, 'rgba(0,0,0,.3)', x, y, w, 16);
  edge(x, 0, x + 16, 0, 'rgba(0,0,0,.26)', x, y, 16, h);
  edge(0, y + h, 0, y + h - 9, 'rgba(255,255,255,.13)', x, y + h - 9, w, 9);
  edge(x + w, 0, x + w - 9, 0, 'rgba(255,255,255,.1)', x + w - 9, y, 9, h);
}

const line = (g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void => {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
};
const diamond = (g: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r * 0.7, y);
  g.lineTo(x, y + r);
  g.lineTo(x - r * 0.7, y);
  g.closePath();
  g.fill();
};

/** The site's mark: an A drawn with a second A inside it. */
function mark(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.lineJoin = 'round';
  g.lineWidth = s * 0.075;
  g.beginPath();
  g.moveTo(x - s * 0.42, y + s * 0.5);
  g.lineTo(x, y - s * 0.5);
  g.lineTo(x + s * 0.42, y + s * 0.5);
  g.moveTo(x - s * 0.24, y + s * 0.5);
  g.lineTo(x, y - s * 0.12);
  g.lineTo(x + s * 0.24, y + s * 0.5);
  g.moveTo(x - s * 0.21, y + s * 0.16);
  g.lineTo(x + s * 0.21, y + s * 0.16);
  g.stroke();
}

// ---------- each course's device: the one picture that stands for it ----------

/** Deep Learning: a network drawn as an astrolabe, rings of units wired to the next ring in. */
const rosette: Device = (g, cx, cy, r, ink, ground, lit) => {
  const rings = [[6, 0.3], [12, 0.6], [18, 0.9]];
  const at = (n: number, rr: number, k: number, turn: number): Pt => {
    const a = (k / n) * Math.PI * 2 - Math.PI / 2 + turn;
    return [cx + Math.cos(a) * r * rr, cy + Math.sin(a) * r * rr];
  };
  const pts = rings.map(([n, rr], i) => Array.from({ length: n }, (_, k) => at(n, rr, k, i % 2 ? Math.PI / n : 0)));
  g.strokeStyle = ink;
  g.lineWidth = r * 0.008;
  g.globalAlpha = 0.8;
  for (const p of pts[0]) line(g, cx, cy, p[0], p[1]);
  for (let i = 0; i < 2; i++) {
    for (const p of pts[i]) {
      const near = [...pts[i + 1]].sort((a, b) => Math.hypot(a[0] - p[0], a[1] - p[1]) - Math.hypot(b[0] - p[0], b[1] - p[1])).slice(0, 3);
      for (const q of near) line(g, p[0], p[1], q[0], q[1]);
    }
  }
  g.globalAlpha = 1;
  g.lineWidth = r * 0.012;
  for (const [, rr] of rings) {
    g.globalAlpha = 0.45;
    g.beginPath();
    g.arc(cx, cy, r * rr, 0, 7);
    g.stroke();
  }
  g.globalAlpha = 1;
  // The rim, graduated like an instrument.
  g.lineWidth = r * 0.016;
  for (const rr of [1.04, 1.16]) {
    g.beginPath();
    g.arc(cx, cy, r * rr, 0, 7);
    g.stroke();
  }
  g.lineWidth = r * 0.008;
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    const inner = k % 6 ? 1.09 : 1.06;
    line(g, cx + Math.cos(a) * r * inner, cy + Math.sin(a) * r * inner, cx + Math.cos(a) * r * 1.14, cy + Math.sin(a) * r * 1.14);
  }
  const unit = (p: Pt, size: number, on: boolean) => {
    g.fillStyle = on ? lit : ground;
    g.lineWidth = r * 0.014;
    g.beginPath();
    g.arc(p[0], p[1], size, 0, 7);
    g.fill();
    g.stroke();
  };
  pts.forEach((ring, i) => ring.forEach((p, k) => unit(p, r * (0.05 - i * 0.008), (k * 7 + i * 3) % 5 === 0)));
  unit([cx, cy], r * 0.07, true);
}

/** Nix: a tree whose every leaf is a built thing, standing on the row of the store. */
const grove: Device = (g, cx, cy, r, ink, ground, lit) => {
  g.strokeStyle = ink;
  g.lineCap = 'round';
  const leaves: [number, number, number][] = [];
  const grow = (x: number, y: number, angle: number, len: number, depth: number): void => {
    const x1 = x + Math.cos(angle) * len;
    const y1 = y + Math.sin(angle) * len;
    g.lineWidth = r * (0.03 - depth * 0.0045);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(angle) * len * 0.5 + Math.sin(angle) * len * 0.12 * (depth % 2 ? 1 : -1), y + Math.sin(angle) * len * 0.5, x1, y1);
    g.stroke();
    if (depth === 4) {
      leaves.push([x1, y1, depth]);
      return;
    }
    const spread = 0.5 - depth * 0.04;
    grow(x1, y1, angle - spread, len * 0.74, depth + 1);
    grow(x1, y1, angle + spread, len * 0.74, depth + 1);
    if (depth === 1 || depth === 2) leaves.push([x1, y1, depth]);
  };
  const foot = cy + r * 0.78;
  grow(cx, foot, -Math.PI / 2, r * 0.62, 0);
  const square = (x: number, y: number, s: number, on: boolean) => {
    g.fillStyle = on ? lit : ground;
    g.lineWidth = r * 0.014;
    g.beginPath();
    g.rect(x - s / 2, y - s / 2, s, s);
    g.fill();
    g.stroke();
  };
  leaves.forEach(([x, y, d], k) => square(x, y, r * (d === 4 ? 0.075 : 0.06), k % 4 === 1));
  // The store: one row, every square in its place.
  g.lineWidth = r * 0.014;
  line(g, cx - r * 0.95, foot, cx + r * 0.95, foot);
  for (let k = -5; k <= 5; k++) square(cx + k * r * 0.17, foot + r * 0.14, r * 0.09, k === 2 || k === -4);
  line(g, cx - r * 0.95, foot + r * 0.28, cx + r * 0.95, foot + r * 0.28);
}

/** Any other course, until it has a device of its own: a compass of contours. */
const compass: Device = (g, cx, cy, r, ink, ground, lit) => {
  g.strokeStyle = ink;
  for (let k = 1; k <= 7; k++) {
    g.lineWidth = r * (k === 7 ? 0.016 : 0.009);
    g.beginPath();
    for (let t = 0; t <= 96; t++) {
      const a = (t / 96) * Math.PI * 2;
      const rr = (r * k) / 7 * (1 + (k < 7 ? 0.07 * Math.sin(4 * a + k) + 0.04 * Math.sin(7 * a - k) : 0));
      if (t) g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
    g.stroke();
  }
  g.fillStyle = lit;
  diamond(g, cx, cy, r * 0.09);
  g.fillStyle = ground;
}

const DEVICES: Record<string, Device> = { dl: rosette, nix: grove };
const device = (id: string): Device => DEVICES[id] ?? compass;

function fitText(g: CanvasRenderingContext2D, text: string, font: string, size: number, max: number): number {
  let px = size;
  do g.font = font.replace('%', String(px));
  while (g.measureText(text).width > max && (px -= 1) > 8);
  return px;
}

function centred(g: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

/** Corner pieces for a ruled frame: three quarter arcs and a stud. */
function corner(g: CanvasRenderingContext2D, x: number, y: number, sx: number, sy: number): void {
  for (const rr of [20, 31, 42]) {
    g.beginPath();
    g.arc(x, y, rr, sx > 0 ? (sy > 0 ? 0 : -Math.PI / 2) : sy > 0 ? Math.PI / 2 : Math.PI, sx > 0 ? (sy > 0 ? Math.PI / 2 : 0) : sy > 0 ? Math.PI : Math.PI * 1.5);
    g.stroke();
  }
  diamond(g, x + sx * 62, y + sy * 62, 6);
}

// ---------- the gilt binding's stamping, drawn in whatever ink is asked for ----------

/** Where the raised bands cross the spine, along its length. */
const BANDS = [-1, 1].flatMap((side) => [0, 1, 2, 3].map((k) => CH / 2 + side * (128 + k * 186)));

function giltCover(g: CanvasRenderingContext2D, book: BookFace, f: Fonts, ink: Ink, ground: Ink): void {
  g.strokeStyle = g.fillStyle = ink;
  g.lineWidth = 3.4;
  g.strokeRect(30, 30, CW - 60, CH - 60);
  g.lineWidth = 1.5;
  g.strokeRect(41, 41, CW - 82, CH - 82);
  g.lineWidth = 1.6;
  for (const [x, sx] of [[41, 1], [CW - 41, -1]]) for (const [y, sy] of [[41, 1], [CH - 41, -1]]) corner(g, x, y, sx, sy);
  fitText(g, book.title, `600 %px ${f.display}`, 52, 400);
  centred(g, book.title, CW / 2, 168);
  g.lineWidth = 1.6;
  line(g, CW / 2 - 92, 216, CW / 2 - 16, 216);
  line(g, CW / 2 + 16, 216, CW / 2 + 92, 216);
  diamond(g, CW / 2, 216, 7);
  device(book.id)(g, CW / 2, 498, 168, ink, ground, ink);
  g.strokeStyle = ink;
  mark(g, CW / 2, 800, 44);
}

function giltSpine(g: CanvasRenderingContext2D, book: BookFace, f: Fonts, t: number, ink: Ink): void {
  g.strokeStyle = g.fillStyle = ink;
  g.lineWidth = 1.5;
  line(g, 0, t * 0.09, CH, t * 0.09);
  line(g, 0, t * 0.91, CH, t * 0.91);
  for (const x of BANDS) {
    g.fillRect(x - 12.5, t * 0.09, 1.6, t * 0.82);
    g.fillRect(x + 11, t * 0.09, 1.6, t * 0.82);
  }
  g.lineWidth = 1.1;
  g.strokeRect(CH / 2 - 106, t * 0.17 + 5, 212, t * 0.66 - 10);
  fitText(g, book.title, `600 %px ${f.display}`, t * 0.3, 176);
  centred(g, book.title, CH / 2, t * 0.51);
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) diamond(g, CH / 2 + side * (221 + k * 186), t / 2, 6);
}

// ---------- the three bindings ----------

const COVERS = {
  /** Gilt: full cloth, everything stamped in gold inside a double rule. */
  gilt(g: CanvasRenderingContext2D, book: BookFace, f: Fonts): void {
    sunk(g, 41, 41, CW - 82, CH - 82, 0.07);
    // The boss the device sits in: a shallow dish.
    const dish = g.createRadialGradient(CW / 2 - 50, 448, 20, CW / 2, 498, 215);
    dish.addColorStop(0, 'rgba(0,0,0,.2)');
    dish.addColorStop(0.8, 'rgba(0,0,0,.08)');
    dish.addColorStop(1, 'rgba(255,255,255,.07)');
    g.fillStyle = dish;
    g.beginPath();
    g.arc(CW / 2, 498, 206, 0, 7);
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,.34)';
    g.beginPath();
    g.arc(CW / 2, 498, 206, Math.PI * 0.85, Math.PI * 1.65);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.16)';
    g.beginPath();
    g.arc(CW / 2, 498, 206, -Math.PI * 0.15, Math.PI * 0.65);
    g.stroke();
    stamp(g, (g) => giltCover(g, book, f, foil(g, 0, 0, CW, CH), book.cover));
  },
};

const SPINES = {
  gilt(g: CanvasRenderingContext2D, book: BookFace, f: Fonts, t: number): void {
    // Raised bands across the back: a ridge of shade and light.
    const bands = BANDS;
    for (const x of bands) {
      const ridge = g.createLinearGradient(x - 8, 0, x + 8, 0);
      ridge.addColorStop(0, 'rgba(0,0,0,.42)');
      ridge.addColorStop(0.42, 'rgba(255,255,255,.2)');
      ridge.addColorStop(1, 'rgba(0,0,0,.46)');
      g.fillStyle = ridge;
      g.fillRect(x - 8, 0, 16, t);
    }
    // The lettering piece: a darker label let into the cloth between two bands.
    g.fillStyle = mix(book.cover, '#0c0a07', 0.36);
    g.fillRect(CH / 2 - 112, t * 0.17, 224, t * 0.66);
    sunk(g, CH / 2 - 112, t * 0.17, 224, t * 0.66, 0.05);
    stamp(g, (g) => giltSpine(g, book, f, t, foil(g, CH / 2 - 160, 0, CH / 2 + 160, t)), [-0.25, -1], 1.3);
  },
};


/**
 * Draws one face of `book`. A cover is drawn twice: `flat` for the book lying down, where the screen shows it squeezed
 * to a strip (so the canvas is a strip too, long and sharp), and `up` for the book standing.
 * `px` is the canvas size in device pixels; `thick` is the spine's thickness in book units.
 */
export function paintFace(canvas: HTMLCanvasElement, book: BookFace, face: 'up' | 'spine', px: [number, number], fonts: Fonts, thick = 60): void {
  const [w, h] = px.map(Math.round);
  canvas.width = w;
  canvas.height = h;
  const g = pen(canvas);
  g.fillStyle = book.cover;
  g.fillRect(0, 0, w, h);
  cloth(g, face === 'spine' ? 0.8 : 1);
  if (face === 'spine') {
    // Along the spine is down the canvas; the cover's edge is on the right.
    g.setTransform(0, h / CH, -w / thick, 0, w, 0);
    SPINES.gilt(g, book, fonts, thick);
    // Round the back: shade at both edges, light along the middle.
    const round = g.createLinearGradient(0, 0, 0, thick);
    ([[0, 'rgba(0,0,0,.26)'], [0.2, 'rgba(0,0,0,.03)'], [0.5, 'rgba(255,255,255,.08)'], [0.82, 'rgba(0,0,0,.1)'], [1, 'rgba(0,0,0,.38)']] as [number, string][]).forEach(([at, c]) => round.addColorStop(at, c));
    g.fillStyle = round;
    g.fillRect(0, 0, CH, thick);
    return;
  }
  g.setTransform(w / CW, 0, 0, h / CH, 0, 0);
  COVERS.gilt(g, book, fonts);
  // The joint: the cloth dips into a groove beside the spine, then the board falls into shade away from it.
  const joint = g.createLinearGradient(0, 0, CW, 0);
  ([[0, 'rgba(0,0,0,.34)'], [0.026, 'rgba(0,0,0,.04)'], [0.038, 'rgba(255,255,255,.13)'], [0.05, 'rgba(0,0,0,0)'], [0.058, 'rgba(0,0,0,.4)'], [0.07, 'rgba(0,0,0,.12)'], [0.082, 'rgba(255,255,255,.12)'], [0.1, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.12)']] as [number, string][]).forEach(([at, c]) => joint.addColorStop(at, c));
  g.fillStyle = joint;
  g.fillRect(0, 0, CW, CH);
  if (face === 'up') {
    // One band of light across the standing cover.
    const sheen = g.createLinearGradient(0, CH * 0.1, CW, CH * 0.7);
    ([[0.3, 'rgba(255,255,255,0)'], [0.46, 'rgba(255,255,255,.07)'], [0.6, 'rgba(255,255,255,0)']] as [number, string][]).forEach(([at, c]) => sheen.addColorStop(at, c));
    g.fillStyle = sheen;
    g.fillRect(0, 0, CW, CH);
  }
}

// ---------- maps for the lit books: what a face is made of, for a renderer that lights it ----------

/** A panel let into the height map (drawn on its untouched surface): `deep` lower inside, walls `wall` wide, mitred. */
function recess(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, deep: number, wall: number): void {
  const top = 'rgb(150,150,150)';
  const v = Math.round(150 * (1 - deep));
  const floor = `rgb(${v},${v},${v})`;
  g.save();
  // Each wall is drawn right across; keeping the darker of what meets gives the corners their mitre.
  g.globalCompositeOperation = 'darken';
  const side = (x0: number, y0: number, x1: number, y1: number) => shade(g, x0, y0, x1, y1, [[0, top], [1, floor]], [x, y, w, h]);
  side(0, y, 0, y + wall);
  side(0, y + h, 0, y + h - wall);
  side(x, 0, x + wall, 0);
  side(x + w, 0, x + w - wall, 0);
  g.restore();
}

function shade(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][], rect: [number, number, number, number]): void {
  const grad = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([at, c]) => grad.addColorStop(at, c));
  g.fillStyle = grad;
  g.fillRect(...rect);
};

/**
 * A face of the gilt binding as two maps of `px` device pixels: `albedo`, the cloth's colour, and `relief`, whose red
 * is where foil lies and whose green is height (0.59 is the cloth's surface; stamping sits below it, bands above).
 */
export function paintMaps(book: BookFace, face: 'up' | 'spine' | 'back', px: [number, number], fonts: Fonts, thick = 60): { albedo: HTMLCanvasElement; relief: HTMLCanvasElement } {
  const [w, h] = px.map(Math.round);
  const sheet = () => {
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
    const g = pen(c, { willReadFrequently: true });
    if (face === 'spine') g.setTransform(0, h / CH, -w / thick, 0, w, 0);
    else g.setTransform(w / CW, 0, 0, h / CH, 0, 0);
    return g;
  };
  const [fw, fh] = face === 'spine' ? [CH, thick] : [CW, CH];
  type Edge = [number, number, number, number, [number, number, number, number]];
  const edges: Edge[] = [[0, 0, 0, 10, [0, 0, CW, 10]], [0, CH, 0, CH - 10, [0, CH - 10, CW, 10]]];
  const albedo = sheet();
  albedo.fillStyle = book.cover;
  albedo.fillRect(0, 0, fw, fh);
  const foilMap = sheet();
  foilMap.fillStyle = '#000';
  foilMap.fillRect(0, 0, fw, fh);
  const height = sheet();
  height.fillStyle = '#969696';
  height.fillRect(0, 0, fw, fh);
  const press = 'rgba(0,0,0,.24)';
  if (face === 'spine') {
    albedo.fillStyle = mix(book.cover, '#0c0a07', 0.38);
    albedo.fillRect(CH / 2 - 112, thick * 0.17, 224, thick * 0.66);
    giltSpine(foilMap, book, fonts, thick, '#fff');
    for (const x of BANDS) shade(height, x - 10, 0, x + 10, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,.62)'], [1, 'rgba(255,255,255,0)']], [x - 10, 0, 20, thick]);
    recess(height, CH / 2 - 112, thick * 0.17, 224, thick * 0.66, 0.14, 3);
    // A square back still has soft corners where the cloth turns onto the boards.
    for (const [y0, y1] of [[0, thick * 0.07], [thick, thick * 0.93]]) shade(height, 0, y0, 0, y1, [[0, 'rgba(0,0,0,.4)'], [1, 'rgba(0,0,0,0)']], [0, Math.min(y0, y1), CH, thick * 0.07]);
    giltSpine(height, book, fonts, thick, press);
  } else if (face === 'back') {
    // The back board: the same frame pressed blind, with only the mark in foil. Its joint is on the right.
    for (const [x0, y0, x1, y1, rect] of [...edges, [0, 0, 10, 0, [0, 0, 10, CH]]] as Edge[]) shade(height, x0, y0, x1, y1, [[0, 'rgba(0,0,0,.34)'], [1, 'rgba(0,0,0,0)']], rect);
    shade(height, CW - 44, 0, CW - 14, 0, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']], [CW - 44, 0, 30, CH]);
    recess(height, 41, 41, CW - 82, CH - 82, 0.13, 5);
    height.strokeStyle = press;
    height.lineWidth = 3.4;
    height.strokeRect(30, 30, CW - 60, CH - 60);
    for (const g of [foilMap, height]) {
      g.strokeStyle = g === foilMap ? '#fff' : press;
      mark(g, CW / 2, CH / 2, 70);
      g.lineWidth = 2.2;
      g.beginPath();
      g.arc(CW / 2, CH / 2, 74, 0, 7);
      g.stroke();
    }
  } else {
    giltCover(foilMap, book, fonts, '#fff', '#000');
    // The boards round over at their edges, and the cloth dips into the joint beside the spine.
    for (const [x0, y0, x1, y1, rect] of [...edges, [CW, 0, CW - 10, 0, [CW - 10, 0, 10, CH]]] as Edge[]) {
      shade(height, x0, y0, x1, y1, [[0, 'rgba(0,0,0,.34)'], [1, 'rgba(0,0,0,0)']], rect);
    }
    shade(height, 14, 0, 44, 0, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']], [14, 0, 30, CH]);
    recess(height, 41, 41, CW - 82, CH - 82, 0.13, 5);
    const dish = height.createRadialGradient(CW / 2, 498, 0, CW / 2, 498, 206);
    ([[0, 'rgba(0,0,0,.2)'], [0.86, 'rgba(0,0,0,.13)'], [0.97, 'rgba(0,0,0,.02)'], [1, 'rgba(0,0,0,0)']] as [number, string][]).forEach(([at, c]) => dish.addColorStop(at, c));
    height.fillStyle = dish;
    height.beginPath();
    height.arc(CW / 2, 498, 206, 0, 7);
    height.fill();
    giltCover(height, book, fonts, press, press);
  }
  // Foil into red, height into green.
  const relief = height.getImageData(0, 0, w, h);
  const mask = foilMap.getImageData(0, 0, w, h).data;
  for (let i = 0; i < mask.length; i += 4) {
    relief.data[i + 1] = relief.data[i];
    relief.data[i] = mask[i];
  }
  height.putImageData(relief, 0, 0);
  return { albedo: albedo.canvas, relief: height.canvas };
}
