// Drawing helpers for the interpretability explainers.
import type { Scene } from '../../lecture/scene';
import type { Ink } from '../../lecture/scene';

/** An attention arc above a row of tokens, from position x0 to x1, with its head at x1. */
export function arc(s: Scene, x0: number, x1: number, y: number, rise: number, k: Ink, width = 0.45): void {
  const c = s.ctx;
  const mx = (x0 + x1) / 2;
  const top = y - rise * s.u;
  c.beginPath();
  c.moveTo(x0, y);
  c.quadraticCurveTo(mx, top, x1, y);
  c.strokeStyle = s.c(k);
  c.lineWidth = width * s.u;
  c.stroke();
  // The curve's tangent at its end points back toward the control point.
  const dx = x1 - mx;
  const dy = y - top;
  const len = Math.hypot(dx, dy);
  const hd = 2 * s.u;
  const ux = dx / len;
  const uy = dy / len;
  c.beginPath();
  c.moveTo(x1, y);
  c.lineTo(x1 - ux * hd - uy * hd * 0.5, y - uy * hd + ux * hd * 0.5);
  c.lineTo(x1 - ux * hd + uy * hd * 0.5, y - uy * hd - ux * hd * 0.5);
  c.closePath();
  c.fillStyle = s.c(k);
  c.fill();
}

/** A labelled number, `v`, as a short text run: `−0.5` with a true minus sign. */
export const num = (v: number, places?: number): string => (places === undefined ? String(v) : v.toFixed(places)).replace('-', '−');
