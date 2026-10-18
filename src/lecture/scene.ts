import type { CodePanel } from '../core/code';
import { MONO } from '../lib/math-kit-draw';
import { type Plot, color, withAlpha } from '../core/plot';
import type { Color } from '../core/symbols';

/** A KaTeX (or plain text) overlay on the stage, positioned as fractions of its width and height. */
export interface Mark {
  tex?: string;
  text?: string;
  x: number;
  y: number;
  /** Font size in stage units (1u = 1% of the stage's shorter side). Default 6. */
  size?: number;
  align?: 'left' | 'center' | 'right';
}

export interface SceneDef {
  marks?: Record<string, Mark>;
  /** Draws the scene at `s.t`. Pure in time: called for every frame, seek and resize. */
  draw(s: Scene): void;
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const FONTS = {
  display: "'Fraunces Variable', Georgia, serif",
  serif: "'Source Serif 4 Variable', Georgia, serif",
  mono: MONO,
  ui: 'system-ui, -apple-system, sans-serif',
};

export interface TextOpts {
  /** In stage units. Default 5. */
  size?: number;
  color?: string;
  font?: keyof typeof FONTS;
  weight?: number;
  italic?: boolean;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  /** Paper-colored outline so text stays legible over lines. */
  halo?: boolean;
}

/**
 * What a scene's draw function sees: its own clock, beat-anchored easing, the stage canvas and
 * a small drawing kit sized in stage units, so one layout serves a phone and a desktop.
 */
export class Scene {
  t = 0;
  /** Entrance fade, applied by the player to the canvas and marks. */
  fade = 1;
  readonly wanted = new Map<string, { a: number; x?: number; y?: number }>();

  constructor(
    readonly p: Plot,
    readonly code: CodePanel,
    private readonly beats: Map<string, [number, number]>,
  ) {}

  get ctx(): CanvasRenderingContext2D {
    return this.p.ctx;
  }
  get w(): number {
    return this.p.w;
  }
  get h(): number {
    return this.p.h;
  }
  /** 1% of the stage's shorter side, in CSS px. */
  get u(): number {
    return Math.min(this.p.w, this.p.h) / 100;
  }
  /** Portrait-ish stage: lay things out top-to-bottom instead of side by side. */
  get tall(): boolean {
    return this.p.h > this.p.w * 0.86;
  }

  private beat(id: string): [number, number] {
    const b = this.beats.get(id);
    if (!b) throw new Error(`no beat "${id}" in this scene`);
    return b;
  }
  at(id: string): number {
    return this.beat(id)[0];
  }
  end(id: string): number {
    return this.beat(id)[1];
  }
  since(id: string): number {
    return this.t - this.at(id);
  }
  /** Eased 0 -> 1 over `dur` seconds, starting `delay` seconds into beat `id`. */
  ease(id: string, dur = 0.7, delay = 0): number {
    return smooth((this.t - this.at(id) - delay) / dur);
  }
  /** Linear 0 -> 1 across beat `id`'s spoken duration. */
  prog(id: string): number {
    const [a, b] = this.beat(id);
    return clamp01((this.t - a) / Math.max(0.01, b - a));
  }
  /** Linear 0 -> 1 from the start of beat `a` to the start of beat `b`. */
  span(a: string, b: string): number {
    return clamp01((this.t - this.at(a)) / Math.max(0.01, this.at(b) - this.at(a)));
  }
  /** Fades in at beat `from` and out at beat `until`. */
  win(from: string, until?: string, dur = 0.6): number {
    return this.ease(from, dur) * (until ? 1 - this.ease(until, dur) : 1);
  }
  /** Shows overlay mark `name` at opacity `a` this frame, optionally moved (fractions of the stage). */
  show(name: string, a: number, pos?: { x?: number; y?: number }): void {
    if (a > 0.003) this.wanted.set(name, { a: Math.min(1, a), ...pos });
  }
  /** Rewrites a `{{slot}}` in the listing without the change flash (it updates every frame). */
  slot(name: string, v: string | number): void {
    this.code.set(name, v, false);
  }

  c(k: Color | `--${string}`): string {
    return color(k);
  }
  tint(k: Color | `--${string}`, a: number): string {
    return withAlpha(color(k), a);
  }
  /** Runs `fn` with the canvas alpha multiplied by `a`. */
  alpha(a: number, fn: () => void): void {
    if (a <= 0.003) return;
    const c = this.ctx;
    const prev = c.globalAlpha;
    c.globalAlpha = prev * Math.min(1, a);
    fn();
    c.globalAlpha = prev;
  }

  text(s: string, x: number, y: number, o: TextOpts = {}): void {
    const c = this.ctx;
    const px = (o.size ?? 5) * this.u;
    c.font = `${o.italic ? 'italic ' : ''}${o.weight ?? (o.font === 'mono' ? 500 : 450)} ${px}px ${FONTS[o.font ?? 'serif']}`;
    c.textAlign = o.align ?? 'center';
    c.textBaseline = o.base ?? 'middle';
    if (o.halo) {
      c.lineJoin = 'round';
      c.lineWidth = Math.max(3, px * 0.28);
      c.strokeStyle = color('--card');
      c.strokeText(s, x, y);
    }
    c.fillStyle = o.color ?? color('--ink');
    c.fillText(s, x, y);
  }
  measure(s: string, o: TextOpts = {}): number {
    const c = this.ctx;
    c.font = `${o.italic ? 'italic ' : ''}${o.weight ?? (o.font === 'mono' ? 500 : 450)} ${(o.size ?? 5) * this.u}px ${FONTS[o.font ?? 'serif']}`;
    return c.measureText(s).width;
  }
  line(x0: number, y0: number, x1: number, y1: number, col: string, width = 0.5, dash?: number[]): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.strokeStyle = col;
    c.lineWidth = width * this.u;
    c.lineCap = 'round';
    c.setLineDash(dash ? dash.map((d) => d * this.u) : []);
    c.stroke();
    c.setLineDash([]);
  }
  arrow(x0: number, y0: number, x1: number, y1: number, col: string, width = 0.7, head = 3): void {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.5) return;
    const hd = Math.min(head * this.u, len * 0.45);
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    this.line(x0, y0, x1 - ux * hd * 0.6, y1 - uy * hd * 0.6, col, width);
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x1 - ux * hd - uy * hd * 0.5, y1 - uy * hd + ux * hd * 0.5);
    c.lineTo(x1 - ux * hd + uy * hd * 0.5, y1 - uy * hd - ux * hd * 0.5);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  }
  rrect(x: number, y: number, w: number, h: number, r: number, o: { fill?: string; stroke?: string; lw?: number } = {}): void {
    const c = this.ctx;
    c.beginPath();
    c.roundRect(x, y, w, h, Math.min(r * this.u, w / 2, h / 2));
    if (o.fill) {
      c.fillStyle = o.fill;
      c.fill();
    }
    if (o.stroke) {
      c.strokeStyle = o.stroke;
      c.lineWidth = (o.lw ?? 0.4) * this.u;
      c.stroke();
    }
  }
  circle(x: number, y: number, r: number, o: { fill?: string; stroke?: string; lw?: number } = {}): void {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (o.fill) {
      c.fillStyle = o.fill;
      c.fill();
    }
    if (o.stroke) {
      c.strokeStyle = o.stroke;
      c.lineWidth = (o.lw ?? 0.4) * this.u;
      c.stroke();
    }
  }
  /** A number in a rounded cell, the lecture's way of drawing an array entry. */
  cell(x: number, y: number, w: number, h: number, label: string, k: Color | `--${string}`, o: { on?: number; size?: number } = {}): void {
    const on = o.on ?? 0;
    this.rrect(x, y, w, h, 1.2, { fill: this.tint(k, 0.1 + 0.22 * on), stroke: this.tint(k, 0.45 + 0.55 * on), lw: 0.3 + 0.25 * on });
    if (label) this.text(label, x + w / 2, y + h / 2 + this.u * 0.2, { font: 'mono', size: o.size ?? Math.min(h / this.u, w / this.u) * 0.42 });
  }
}
