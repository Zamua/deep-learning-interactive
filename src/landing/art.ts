// The picture on a book's cover, drawn once to a small canvas: the compositor then moves it like any image.
const PAPER = '#f1e9d8';
const ACCENTS = ['#f0b35a', '#9fd0ff', '#ffd9a0', '#f3c6ff', '#ffe08a', '#ffc2a8'];

export interface CoverBook {
  id: string;
  title: string;
  cover: string;
}

type Art = (g: CanvasRenderingContext2D, w: number, h: number, rand: () => number, ink: string, accent: string, cover: string) => void;

/** A small seeded generator, so a book's cover is the same on every visit. */
export function seeded(seed: number): () => number {
  let s = Math.imul(seed + 1, 2654435761) >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909);
    return (s >>> 0) / 4294967296;
  };
}

/** A stable number from a book's id. */
export const hashOf = (id: string): number => [...id].reduce((n, ch) => (Math.imul(n, 31) + ch.charCodeAt(0)) >>> 0, 7);

const net: Art = (g, w, h, rand, ink, accent, cover) => {
  const layers = [3, 5, 6, 5, 3];
  const points = layers.map((n, i) => Array.from({ length: n }, (_, j): [number, number] => [w * (0.14 + (0.72 * (j + 0.5)) / n), h * (0.13 + (0.6 * i) / (layers.length - 1))]));
  g.lineWidth = 1.1;
  for (let i = 0; i < points.length - 1; i++) {
    for (const p of points[i]!) {
      for (const q of points[i + 1]!) {
        g.globalAlpha = 0.16 + 0.5 * rand() * rand();
        g.strokeStyle = rand() < 0.12 ? accent : ink;
        g.beginPath();
        g.moveTo(...p);
        g.lineTo(...q);
        g.stroke();
      }
    }
  }
  g.globalAlpha = 1;
  for (const p of points.flat()) {
    g.fillStyle = cover;
    g.strokeStyle = ink;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(p[0], p[1], 11, 0, 7);
    g.fill();
    g.stroke();
    if (rand() < 0.3) {
      g.fillStyle = accent;
      g.beginPath();
      g.arc(p[0], p[1], 5, 0, 7);
      g.fill();
    }
  }
};

const tree: Art = (g, w, h, rand, ink, accent, cover) => {
  g.lineWidth = 1.6;
  const box = (x: number, y: number, size: number, lit: boolean) => {
    g.fillStyle = lit ? accent : cover;
    g.strokeStyle = lit ? accent : ink;
    g.beginPath();
    g.rect(x - size / 2, y - size / 2, size, size);
    g.fill();
    g.stroke();
  };
  const branch = (x: number, y: number, spread: number, depth: number) => {
    if (depth < 4) {
      const n = depth < 2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const nx = x + (i - (n - 1) / 2) * spread;
        const ny = y + h * 0.15;
        g.strokeStyle = ink;
        g.globalAlpha = 0.7;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + h * 0.06);
        g.lineTo(nx, y + h * 0.06);
        g.lineTo(nx, ny);
        g.stroke();
        g.globalAlpha = 1;
        branch(nx, ny, (spread / n) * 0.94, depth + 1);
      }
    }
    box(x, y, 26 - depth * 4, rand() < 0.16);
  };
  branch(w / 2, h * 0.14, w * 0.3, 0);
};

const contour: Art = (g, w, h, rand, ink, accent) => {
  g.lineWidth = 1.5;
  const phase = [rand() * 7, rand() * 7, rand() * 7];
  for (let k = 14; k > 0; k--) {
    g.strokeStyle = k === 5 ? accent : ink;
    g.globalAlpha = 0.9;
    g.beginPath();
    for (let t = 0; t <= 64; t++) {
      const a = (t / 64) * Math.PI * 2;
      const r = k * w * 0.031 * (1 + 0.16 * Math.sin(3 * a + phase[0]!) + 0.1 * Math.sin(5 * a + phase[1]! + k * 0.2) + 0.05 * Math.sin(2 * a + phase[2]!));
      const x = w * 0.5 + Math.cos(a) * r;
      const y = h * 0.4 + Math.sin(a) * r * 1.25;
      if (t) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.closePath();
    g.stroke();
  }
};

const waves: Art = (g, w, h, rand, ink, accent) => {
  g.lineWidth = 1.6;
  for (let i = 0; i < 30; i++) {
    const y = h * (0.09 + 0.022 * i);
    const amp = 5 + i * 1.1;
    const phase = rand() * 2;
    g.strokeStyle = i === 17 ? accent : ink;
    g.globalAlpha = 0.85;
    g.beginPath();
    for (let x = w * 0.08; x <= w * 0.92; x += 6) {
      const yy = y + Math.sin(x * 0.022 + phase + i * 0.35) * amp * Math.sin(((x - w * 0.08) / (w * 0.84)) * Math.PI);
      if (x > w * 0.08) g.lineTo(x, yy);
      else g.moveTo(x, yy);
    }
    g.stroke();
  }
};

const grid: Art = (g, w, h, rand, ink, accent) => {
  const n = 9;
  const s = (w * 0.8) / n;
  const x0 = w * 0.1;
  const y0 = h * 0.1;
  g.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 13; j++) {
      const v = rand();
      g.globalAlpha = v < 0.2 ? 1 : 0.5;
      g.strokeStyle = ink;
      g.beginPath();
      g.rect(x0 + i * s, y0 + j * s, s, s);
      if (v < 0.2) {
        g.fillStyle = v < 0.08 ? accent : ink;
        g.fill();
      }
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.strokeStyle = accent;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x0, y0 + 11 * s);
  g.lineTo(x0 + 7 * s, y0 + 2 * s);
  g.stroke();
};

/** The courses with a picture of their own; any other gets one of the rest, always the same one. */
const OWN: Record<string, Art> = { dl: net, nix: tree };
const REST: Art[] = [contour, waves, grid];

function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && g.measureText(next).width > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  return [...lines, line];
}

/** Draws a book's front cover: its picture, its title low on the left, the site's mark in a tab at the top. */
export function paintCover(canvas: HTMLCanvasElement, book: CoverBook): void {
  const w = (canvas.width = 480);
  const h = (canvas.height = 716);
  const g = canvas.getContext('2d');
  if (!g) return;
  const seed = hashOf(book.id);
  g.fillStyle = book.cover;
  g.fillRect(0, 0, w, h);
  g.save();
  (OWN[book.id] ?? REST[seed % REST.length]!)(g, w, h, seeded(seed), PAPER, ACCENTS[seed % ACCENTS.length]!, book.cover);
  g.restore();
  // The hinge by the spine, and the cover falling into shade away from it.
  const shade = g.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, 'rgba(0,0,0,.3)');
  shade.addColorStop(0.035, 'rgba(0,0,0,.05)');
  shade.addColorStop(0.05, 'rgba(255,255,255,.07)');
  shade.addColorStop(0.08, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,.14)');
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
  g.fillStyle = PAPER;
  g.fillRect(w - 74, 0, 40, 58);
  g.strokeStyle = book.cover;
  g.lineWidth = 2.4;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(w - 66, 44);
  g.lineTo(w - 54, 14);
  g.lineTo(w - 42, 44);
  g.moveTo(w - 60.5, 34);
  g.lineTo(w - 47.5, 34);
  g.stroke();
  g.fillStyle = PAPER;
  g.font = "600 24px 'Fraunces Variable', Georgia, serif";
  let y = h - 86;
  for (const line of wrap(g, book.title, w * 0.5)) {
    g.fillText(line, 44, y);
    y += 29;
  }
  g.fillRect(44, y - 12, 22, 2);
  g.font = "italic 400 17px 'Source Serif 4 Variable', Georgia, serif";
  g.globalAlpha = 0.86;
  g.fillText('Atlas', 44, y + 14);
  g.globalAlpha = 1;
}
