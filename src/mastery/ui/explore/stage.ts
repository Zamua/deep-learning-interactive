// A fixed box the learner looks through: drag to pan, pinch or wheel to zoom, a tap to choose. The drawing never sets the
// box's size, so nothing outside the box can move.
import { onDispose } from '../../../core/dom';
import { clampView, zoomAround, zoomLimits, type Box, type Geometry, type View } from './layout';

export interface StageHooks {
  change(v: View): void;
  /** A tap at a point in the box. */
  tap(x: number, y: number): void;
}

/** Further than this, in screen pixels, and a press is a drag. */
const TAP_TRAVEL = 8;
const TAP_MS = 500;
/** A flick slower than this, in pixels per millisecond, stops where the finger left it. */
const COAST_MIN = 0.12;
const COAST_END = 0.02;
const COAST_DECAY = 320;
const COAST_HELD = 70;

const stillness = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Stage {
  view: View;
  private bottom = 0;
  private readonly pts = new Map<number, { x: number; y: number }>();
  private moved = 0;
  private pressed = 0;
  private tapped = false;
  private pinched = false;
  private pinch: { d: number; x: number; y: number } | null = null;
  private trail: { t: number; x: number; y: number }[] = [];
  private motion = 0;
  private due = 0;

  constructor(private readonly box: HTMLElement, private readonly geo: Pick<Geometry, 'W' | 'H'>, initial: View, private readonly hooks: StageHooks) {
    this.view = clampView(initial, geo, this.size());
    box.addEventListener('pointerdown', this.down);
    box.addEventListener('pointermove', this.move);
    box.addEventListener('pointerup', this.up);
    box.addEventListener('pointercancel', this.cancel);
    box.addEventListener('click', this.click);
    box.addEventListener('wheel', this.wheel, { passive: false });
    const ro = new ResizeObserver(() => this.reclamp());
    ro.observe(box);
    onDispose(() => {
      ro.disconnect();
      this.halt();
      if (this.due) cancelAnimationFrame(this.due);
      box.removeEventListener('pointerdown', this.down);
      box.removeEventListener('pointermove', this.move);
      box.removeEventListener('pointerup', this.up);
      box.removeEventListener('pointercancel', this.cancel);
      box.removeEventListener('click', this.click);
      box.removeEventListener('wheel', this.wheel);
    });
  }

  size(): Box {
    return { w: this.box.clientWidth, h: this.box.clientHeight };
  }

  /** How much of the box's bottom a sheet covers, which the drawing may be pulled clear of. */
  cover(bottom: number): void {
    this.bottom = bottom;
    this.reclamp();
  }

  /** Shows `target` at once, or over `ms`. */
  flyTo(target: View, ms = 320): void {
    this.halt();
    const box = this.size();
    const to = clampView(target, this.geo, box, this.bottom);
    if (!ms || stillness()) return this.set(to);
    const from = this.view;
    const at = (v: View) => ({ x: (box.w / 2 - v.tx) / v.z, y: (box.h / 2 - v.ty) / v.z });
    const a = at(from);
    const b = at(to);
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - (1 - t) ** 3;
      const z = Math.exp(Math.log(from.z) + (Math.log(to.z) - Math.log(from.z)) * e);
      const x = a.x + (b.x - a.x) * e;
      const y = a.y + (b.y - a.y) * e;
      this.set({ z, tx: box.w / 2 - x * z, ty: box.h / 2 - y * z }, false);
      this.motion = t < 1 ? requestAnimationFrame(frame) : 0;
    };
    this.motion = requestAnimationFrame(frame);
  }

  private set(v: View, clamp = true): void {
    this.view = clamp ? clampView(v, this.geo, this.size(), this.bottom) : v;
    this.hooks.change(this.view);
  }

  /** Draws on the next frame, however many moves arrive before it. */
  private soon(v: View): void {
    this.view = clampView(v, this.geo, this.size(), this.bottom);
    if (this.due) return;
    this.due = requestAnimationFrame(() => {
      this.due = 0;
      this.hooks.change(this.view);
    });
  }

  private halt(): void {
    if (this.motion) cancelAnimationFrame(this.motion);
    this.motion = 0;
  }

  private reclamp(): void {
    this.set(this.view);
  }

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.box.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private readonly down = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.box.setPointerCapture(e.pointerId);
    this.halt();
    this.pts.set(e.pointerId, this.local(e));
    if (this.pts.size === 1) {
      this.moved = 0;
      this.pressed = e.timeStamp;
      this.pinched = false;
      this.trail = [];
    } else {
      this.pinched = true;
      this.pinch = this.spread();
    }
  };

  /** Where two fingers are, and how far apart. */
  private spread(): { d: number; x: number; y: number } {
    const [a, b] = [...this.pts.values()] as [{ x: number; y: number }, { x: number; y: number }];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private readonly move = (e: PointerEvent): void => {
    const was = this.pts.get(e.pointerId);
    if (!was) return;
    const p = this.local(e);
    this.pts.set(e.pointerId, p);
    this.moved += Math.abs(p.x - was.x) + Math.abs(p.y - was.y);
    if (this.pts.size === 1) {
      if (this.moved < TAP_TRAVEL) return;
      this.trail.push({ t: e.timeStamp, x: p.x, y: p.y });
      if (this.trail.length > 6) this.trail.shift();
      this.soon({ ...this.view, tx: this.view.tx + p.x - was.x, ty: this.view.ty + p.y - was.y });
      return;
    }
    const now = this.spread();
    if (this.pinch) {
      const v = zoomAround(this.view, now.d / this.pinch.d, now.x, now.y, zoomLimits(this.geo, this.size()));
      this.soon({ ...v, tx: v.tx + now.x - this.pinch.x, ty: v.ty + now.y - this.pinch.y });
    }
    this.pinch = now;
  };

  private readonly up = (e: PointerEvent): void => {
    if (!this.pts.delete(e.pointerId)) return;
    this.pinch = null;
    if (this.pts.size) return;
    this.tapped = !this.pinched && this.moved < TAP_TRAVEL && e.timeStamp - this.pressed < TAP_MS;
    if (!this.tapped && !this.pinched) this.coast(e.timeStamp);
  };

  // A tap answers the click, not the finger lifting: a sheet opened on the lift would be under that same click and close.
  private readonly click = (e: MouseEvent): void => {
    if (!this.tapped) return;
    this.tapped = false;
    const p = this.local(e);
    this.hooks.tap(p.x, p.y);
  };

  private readonly cancel = (e: PointerEvent): void => {
    this.pts.delete(e.pointerId);
    this.pinch = null;
  };

  private readonly wheel = (e: WheelEvent): void => {
    e.preventDefault();
    const p = this.local(e);
    this.soon(zoomAround(this.view, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)), p.x, p.y, zoomLimits(this.geo, this.size())));
  };

  /** Lets a flick carry on and slow down. */
  private coast(released: number): void {
    if (stillness() || this.trail.length < 2) return;
    const last = this.trail[this.trail.length - 1]!;
    // A finger that stopped before it lifted threw nothing.
    if (released - last.t > COAST_HELD) return;
    const first = this.trail.find((s) => last.t - s.t < 100) ?? this.trail[0]!;
    const span = last.t - first.t;
    if (span <= 0) return;
    let vx = (last.x - first.x) / span;
    let vy = (last.y - first.y) / span;
    if (Math.hypot(vx, vy) < COAST_MIN) return;
    let then = performance.now();
    const frame = (now: number) => {
      const dt = now - then;
      then = now;
      const decay = Math.exp(-dt / COAST_DECAY);
      vx *= decay;
      vy *= decay;
      this.set({ ...this.view, tx: this.view.tx + vx * dt, ty: this.view.ty + vy * dt });
      this.motion = Math.hypot(vx, vy) > COAST_END ? requestAnimationFrame(frame) : 0;
    };
    this.motion = requestAnimationFrame(frame);
  }
}
