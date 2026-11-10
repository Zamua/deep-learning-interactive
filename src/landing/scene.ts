// The shelf as a lit scene: every book a small mesh (two boards, a rounded back, a block of pages) under real lights,
// with its stamping as a height map, so foil sits in a hollow and catches light as the book turns.
//
// It draws in the page's own coordinates (CSS px, y down, z toward the reader), and only when asked: once per lying
// book, for a picture the page then scrolls by itself, and live only for a book that is open.
import { paintMaps, type BookFace, type Fonts } from './art';

/** A book as the scene needs it: its face, and `th`, its thickness over its height. */
export interface SceneBook extends BookFace {
  th: number;
}

/** Where a book is in a frame, in the page's coordinates. Angles are in degrees, as CSS means them. */
export interface Pose {
  x: number;
  y: number;
  z: number;
  scale: number;
  rz: number;
  ry: number;
  rx: number;
  /** A turn in the hand, on top of the pose, about the screen's own axes. */
  yaw?: number;
  pitch?: number;
  alpha: number;
  /** 1 lying, 0 standing. */
  lie: number;
  /** How far across its cover the book above reaches, 0 to 1. */
  covered?: number;
}

export interface View {
  /** The canvas, in CSS px. */
  width: number;
  height: number;
  /** The page y its top edge is at. */
  top?: number;
  /** The camera's slant: how far up the page a thing is drawn for each px it lies deeper. */
  shear: number;
  /** A book at full size, in px. */
  book: { w: number; h: number };
  /** A colour to draw on, each part 0 to 1, or nothing for see-through. */
  ground?: [number, number, number];
}

export interface Shelf {
  /** Draws the maps again, once the faces their titles are set in have loaded. */
  repaint(): void;
  /** One frame: each book where its pose puts it. Returns the canvas, to copy from before anything else is drawn. */
  draw(view: View, poses: (Pose | undefined)[]): HTMLCanvasElement;
}

type M3 = number[];

const VERT = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec2 aUv; in float aMat;
uniform mat3 uTurn; uniform vec3 uMove; uniform float uScale, uShear; uniform vec2 uView, uOrigin;
out vec3 vPos; out vec3 vNor; out vec2 vUv; out float vMat; out vec3 vLocal;
void main() {
  vec3 p = uTurn * (aPos * uScale) + uMove;
  vPos = p; vNor = uTurn * aNor; vUv = aUv; vMat = aMat; vLocal = aPos;
  // The camera looks down a little from far off: what lies deeper in the page is drawn higher, and nothing shrinks.
  // So a book looks the same wherever it is, and a picture of it taken once stays true as the page scrolls.
  vec2 at = vec2(p.x, p.y + p.z * uShear) - uOrigin;
  gl_Position = vec4(2.0 * at.x / uView.x - 1.0, 1.0 - 2.0 * at.y / uView.y, -p.z / 8000.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 vPos; in vec3 vNor; in vec2 vUv; in float vMat; in vec3 vLocal;
uniform sampler2D uCover, uCoverMap, uSpine, uSpineMap, uGrain, uBackMap;
uniform vec3 uCloth; uniform float uScale, uAlpha, uLie, uDeep, uShear, uCovered;
out vec4 color;

// A height's slope turned into a tilted normal, from screen-space derivatives (no tangents needed).
vec3 bumped(vec3 p, vec3 n, vec2 dh) {
  vec3 sx = dFdx(p), sy = dFdy(p);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * n - grad);
}

// How fast one channel of a map climbs across the screen, read from neighbouring texels so it stays smooth up close.
vec2 climb(sampler2D map, vec2 uv, int channel, float reach) {
  vec2 px = reach / vec2(textureSize(map, 0));
  float du = texture(map, uv + vec2(px.x, 0.0))[channel] - texture(map, uv - vec2(px.x, 0.0))[channel];
  float dv = texture(map, uv + vec2(0.0, px.y))[channel] - texture(map, uv - vec2(0.0, px.y))[channel];
  vec2 perUv = vec2(du, dv) / (2.0 * px);
  return vec2(dot(perUv, dFdx(uv)), dot(perUv, dFdy(uv)));
}

// The room the foil mirrors: a soft window up and to the left, a dimmer one opposite, a floor that falls dark.
float room(vec3 r) {
  float window = smoothstep(0.55, 0.98, dot(r, normalize(vec3(-0.45, -0.72, 0.52))));
  float second = smoothstep(0.7, 1.0, dot(r, normalize(vec3(0.75, -0.2, 0.62)))) * 0.45;
  float sky = 0.22 + 0.3 * clamp(-r.y * 0.5 + 0.5, 0.0, 1.0);
  return sky + window * 1.5 + second;
}

void main() {
  vec3 n = normalize(vNor);
  vec3 toEye = normalize(vec3(0.0, -uShear, 1.0));
  vec3 key = normalize(vec3(-0.5, -0.74, 0.62));
  vec3 fill = normalize(vec3(0.72, 0.05, 0.62));
  vec3 base = uCloth; float foil = 0.0; vec2 slope = vec2(0.0);
  if (vMat > 3.5 && vMat < 4.5) {
    // The standing book's shadow on the page behind it.
    float d = length(vUv - 0.5) * 2.0;
    float dark = 0.5 * (1.0 - smoothstep(0.35, 1.0, d)) * (1.0 - uLie) * uAlpha;
    // Nothing to cast while the book lies: leave no trace, not even in the depth buffer.
    if (dark < 0.004) discard;
    color = vec4(0.0, 0.0, 0.0, dark);
    return;
  }
  if (vMat < 0.5) { base = texture(uCover, vUv).rgb; foil = smoothstep(0.2, 0.62, texture(uCoverMap, vUv, -0.7).r); slope = climb(uCoverMap, vUv, 1, 1.6); }
  else if (vMat < 1.5) { base = texture(uSpine, vUv).rgb; foil = smoothstep(0.2, 0.62, texture(uSpineMap, vUv, -0.7).r); slope = climb(uSpineMap, vUv, 1, 1.6); }
  else if (vMat > 4.5) { foil = smoothstep(0.2, 0.62, texture(uBackMap, vUv, -0.7).r); slope = climb(uBackMap, vUv, 1, 1.6); }
  vec3 lit;
  if (vMat < 2.5 || vMat > 4.5) {
    // Cloth: a weave you can feel under the light, smoothed away where foil is pressed over it.
    vec2 guv = (vLocal.xy + vLocal.zz * vec2(0.6, 0.35)) / 84.0;
    vec3 grain = texture(uGrain, guv).rgb;
    n = bumped(vPos, n, (slope * uDeep + climb(uGrain, guv, 0, 0.75) * 0.8 * (1.0 - foil)) * uScale);
    base *= 0.93 + 0.14 * grain.g;
    float d1 = max(dot(n, key), 0.0), d2 = max(dot(n, fill), 0.0);
    vec3 halfway = normalize(key + toEye);
    float gloss = pow(max(dot(n, halfway), 0.0), 22.0);
    // Cloth scatters at grazing angles: a little rim of sheen.
    float sheen = pow(1.0 - max(dot(n, toEye), 0.0), 3.0);
    vec3 cloth = base * (0.3 + 0.95 * d1 + 0.28 * d2) + vec3(0.09) * gloss + base * sheen * 0.35;
    // Foil: a metal. Its colour is the room, tinted gold.
    float mirror = room(reflect(-toEye, n));
    vec3 gold = vec3(1.0, 0.77, 0.38) * (0.42 + 0.85 * mirror) + vec3(1.0, 0.95, 0.82) * pow(max(dot(n, halfway), 0.0), 70.0) * 1.3;
    lit = mix(cloth, gold, foil);
    // Under another book, a cover darkens toward where that book rests on it.
    if (vMat < 0.5 && uCovered > 0.0) lit *= 1.0 - uLie * 0.72 * smoothstep(uCovered * 0.2, uCovered, vUv.x);
  } else {
    // Pages: cream leaves, darker where the boards stand over them.
    float leaf = texture(uGrain, vec2(vUv.x * 9.0, 0.37)).b;
    float under = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
    vec3 paper = vec3(0.92, 0.87, 0.76) * (0.74 + 0.26 * leaf) * (0.45 + 0.55 * under);
    lit = paper * (0.45 + 0.75 * max(dot(n, key), 0.0) + 0.3 * max(dot(n, fill), 0.0));
  }
  color = vec4(lit * uAlpha, uAlpha);
}`;

// Rotations as CSS means them (y down), so a pose reads the same here and in a stylesheet.
const rad = (deg: number): number => (deg * Math.PI) / 180;
const mul = (a: M3, b: M3): M3 => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!));
const rotZ = (t: number): M3 => [Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t), 0, 0, 0, 1];
const rotY = (t: number): M3 => [Math.cos(t), 0, Math.sin(t), 0, 1, 0, -Math.sin(t), 0, Math.cos(t)];
const rotX = (t: number): M3 => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];

/** A book's mesh in its own space: x across the cover, y down it, z out of it. `w`, `h`, `t` in px at full size. */
function mesh(w: number, h: number, t: number): Float32Array {
  type P3 = [number, number, number];
  const out: number[] = [];
  const quad = (a: P3, b: P3, c: P3, d: P3, n: P3, mat: number, uv: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]) => {
    for (const i of [0, 1, 2, 0, 2, 3]) out.push(...[a, b, c, d][i]!, ...n, ...uv[i]!, mat);
  };
  const X = w / 2, Y = h / 2, Z = t / 2;
  const board = t * 0.055, square = w * 0.012;
  // The shadow goes first: it is drawn apart, since it stays put when the book is turned in the hand.
  quad([-X * 1.3, -Y * 1.1, -Z * 3], [X * 1.75, -Y * 1.1, -Z * 3], [X * 1.75, Y * 1.62, -Z * 3], [-X * 1.3, Y * 1.62, -Z * 3], [0, 0, 1], 4);
  // Boards: the front carries the cover; the back and every edge are plain cloth.
  quad([-X, -Y, Z], [X, -Y, Z], [X, Y, Z], [-X, Y, Z], [0, 0, 1], 0);
  quad([X, -Y, -Z], [-X, -Y, -Z], [-X, Y, -Z], [X, Y, -Z], [0, 0, -1], 5);
  for (const [z0, z1] of [[Z - board, Z], [-Z, -Z + board]] as [number, number][]) {
    quad([-X, Y, z1], [X, Y, z1], [X, Y, z0], [-X, Y, z0], [0, 1, 0], 2);
    quad([-X, -Y, z0], [X, -Y, z0], [X, -Y, z1], [-X, -Y, z1], [0, -1, 0], 2);
    quad([X, -Y, z1], [X, -Y, z0], [X, Y, z0], [X, Y, z1], [1, 0, 0], 2);
  }
  // The turn-ins: the inside of each board where it stands proud of the pages.
  for (const [z, nz] of [[Z - board, -1], [-Z + board, 1]] as [number, number][]) {
    quad([-X, Y - square, z], [X, Y - square, z], [X, Y, z], [-X, Y, z], [0, 0, nz], 2);
    quad([-X, -Y, z], [X, -Y, z], [X, -Y + square, z], [-X, -Y + square, z], [0, 0, nz], 2);
    quad([X - square, -Y, z], [X, -Y, z], [X, Y, z], [X - square, Y, z], [0, 0, nz], 2);
  }
  // The pages, set back from the boards on three sides. u runs through the block, board to board.
  const px = X - square, py = Y - square, pz = Z - board;
  const through: [number, number][] = [[1, 0], [1, 1], [0, 1], [0, 0]];
  quad([-X, py, pz], [px, py, pz], [px, py, -pz], [-X, py, -pz], [0, 1, 0], 3, through);
  quad([-X, -py, pz], [px, -py, pz], [px, -py, -pz], [-X, -py, -pz], [0, -1, 0], 3, through);
  quad([px, -py, pz], [px, py, pz], [px, py, -pz], [px, -py, -pz], [1, 0, 0], 3, through);
  // The back of the book, square: a flat face at right angles to the boards. u runs from the back board to the front.
  quad([-X, -Y, -Z], [-X, -Y, Z], [-X, Y, Z], [-X, Y, -Z], [-1, 0, 0], 1);
  return new Float32Array(out);
}

/** A tile of woven cloth: red is the weave's height, green a thread's colour, blue the page edges' leaves. */
function grainTile(): { size: number; data: Uint8Array } {
  const size = 128, data = new Uint8Array(size * size * 4);
  let seed = 7;
  const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const leaves = Array.from({ length: size }, () => rand());
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const over = (x >> 1) % 2 === (y >> 1) % 2;
      const weave = 0.5 + 0.34 * Math.sin((x + 0.5) * Math.PI / 2) * Math.sin((y + 0.5) * Math.PI / 2) * (over ? 1 : -0.6);
      const i = (y * size + x) * 4;
      data[i] = 255 * Math.min(1, Math.max(0, weave + (rand() - 0.5) * 0.12));
      data[i + 1] = 255 * (over ? 0.78 : 0.5) * (0.85 + 0.15 * rand());
      data[i + 2] = 255 * leaves[x]!;
      data[i + 3] = 255;
    }
  }
  return { size, data };
}

/**
 * Mounts the scene on `canvas` for `books`. Returns null where WebGL2 cannot be had.
 * `maxRatio` caps the device pixels drawn per CSS px.
 */
export function mountShelf(canvas: HTMLCanvasElement, books: SceneBook[], fonts: Fonts, maxRatio = 3): Shelf | null {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  const compile = (type: number, src: string): WebGLShader => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
  } catch (e) {
    return null;
  }
  gl.useProgram(prog);
  const U = Object.fromEntries(['uTurn', 'uMove', 'uScale', 'uShear', 'uOrigin', 'uCovered', 'uView', 'uCloth', 'uAlpha', 'uLie', 'uDeep', 'uCover', 'uCoverMap', 'uSpine', 'uSpineMap', 'uGrain', 'uBackMap'].map((n) => [n, gl.getUniformLocation(prog, n)]));
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const texture = (source: HTMLCanvasElement | { size: number; data: Uint8Array }, repeat = false): WebGLTexture => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if ('data' in source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.size, source.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    for (const side of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, side, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    // Covers lie at a glancing angle: without this they smear.
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t!;
  };
  const grain = texture(grainTile(), true);
  const cap = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
  interface Item {
    book: SceneBook;
    vao: WebGLVertexArrayObject | null;
    buf: WebGLBuffer | null;
    count: number;
    size: string;
    maps: WebGLTexture[];
  }
  const items: Item[] = books.map((b) => ({ book: b, vao: null, buf: null, count: 0, size: '', maps: [] }));
  const paint = () => {
    for (const it of items) {
      it.maps.forEach((t) => gl.deleteTexture(t));
      const cover = paintMaps(it.book, 'up', [1280, 1920], fonts);
      const spine = paintMaps(it.book, 'spine', [256, cap], fonts, it.book.th * 895);
      const back = paintMaps(it.book, 'back', [640, 960], fonts);
      it.maps = [cover.albedo, cover.relief, spine.albedo, spine.relief, back.relief].map((c) => texture(c));
    }
  };
  paint();
  const build = (it: Item, w: number, h: number) => {
    const data = mesh(w, h, it.book.th * h);
    it.vao ??= gl.createVertexArray();
    it.buf ??= gl.createBuffer();
    gl.bindVertexArray(it.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, it.buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    ([['aPos', 3, 0], ['aNor', 3, 12], ['aUv', 2, 24], ['aMat', 1, 32]] as [string, number, number][]).forEach(([name, n, off]) => {
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 36, off);
    });
    it.count = data.length / 9;
    it.size = `${w}x${h}`;
  };
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  ['uCover', 'uCoverMap', 'uSpine', 'uSpineMap', 'uGrain', 'uBackMap'].forEach((n, i) => gl.uniform1i(U[n]!, i));
  const hex = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);

  const turn = (m: M3) => gl.uniformMatrix3fv(U.uTurn!, false, [m[0]!, m[3]!, m[6]!, m[1]!, m[4]!, m[7]!, m[2]!, m[5]!, m[8]!]);
  return {
    repaint: paint,
    draw(view, poses) {
      const ratio = Math.min(devicePixelRatio || 1, maxRatio);
      const pw = Math.round(view.width * ratio), ph = Math.round(view.height * ratio);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      gl.viewport(0, 0, pw, ph);
      const [r, g, b] = view.ground ?? [0, 0, 0];
      gl.clearColor(r, g, b, view.ground ? 1 : 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform2f(U.uView!, view.width, view.height);
      gl.uniform2f(U.uOrigin!, 0, view.top ?? 0);
      gl.uniform1f(U.uShear!, view.shear);
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, grain);
      items.forEach((it, i) => {
        const p = poses[i];
        if (!p || p.alpha <= 0.004) return;
        if (it.size !== `${view.book.w}x${view.book.h}`) build(it, view.book.w, view.book.h);
        gl.bindVertexArray(it.vao);
        it.maps.forEach((t, k) => {
          // Unit 4 is the cloth's grain, shared by every book.
          gl.activeTexture(gl.TEXTURE0 + (k < 4 ? k : k + 1));
          gl.bindTexture(gl.TEXTURE_2D, t);
        });
        gl.uniform3f(U.uMove!, p.x, p.y, p.z);
        gl.uniform1f(U.uScale!, p.scale);
        gl.uniform3fv(U.uCloth!, hex(it.book.cover));
        gl.uniform1f(U.uAlpha!, p.alpha);
        gl.uniform1f(U.uLie!, p.lie);
        gl.uniform1f(U.uCovered!, p.covered ?? 0);
        gl.uniform1f(U.uDeep!, view.book.h * 0.02);
        const rest = mul(mul(rotZ(rad(p.rz)), rotY(rad(p.ry))), rotX(rad(p.rx)));
        // The shadow stays where the book stood, and hides nothing that swings behind it.
        turn(rest);
        gl.depthMask(false);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.depthMask(true);
        // A turn in the hand goes on top of the pose, about the screen's own axes.
        turn(mul(mul(rotY(rad(p.yaw ?? 0)), rotX(rad(p.pitch ?? 0))), rest));
        gl.drawArrays(gl.TRIANGLES, 6, it.count - 6);
      });
      return canvas;
    },
  };
}
