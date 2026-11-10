// The shelf's arithmetic, apart from anything that draws: how big a book is, where each lies in the pile, and the
// curves things move along.

/** The camera's slant: how far up the page a thing is drawn for each px it lies deeper. */
export const SHEAR = 0.13;

/** A book at full size (as it lies on the shelf), from the page's width: the unit `u` is that width, held at 520px. */
export function sizes(width: number): { u: number; w: number; h: number } {
  const u = Math.min(width, 520);
  return { u, w: 2.144 * u, h: 3.2 * u };
}

/** A book's thickness as a share of its height: more concepts, a thicker book. */
export const thickness = (concepts: number): number => Number((0.058 + 0.022 * Math.min(1, concepts / 170)).toFixed(4));

/** Where a book lies in the pile. `top` and `bottom` bound its picture on the page; `y` and `z` are its centre in the scene. */
export interface Lying {
  top: number;
  bottom: number;
  y: number;
  z: number;
  /** How far across its cover the book above reaches, 0 to 1. */
  covered: number;
}

/**
 * The pile for books of these thicknesses (each over its height), on a page `width` by `height`. Each book rests on
 * the one below and is set back from it, so a strip of the lower cover shows in front of the upper book's spine.
 */
export function pileOf(thick: number[], width: number, height: number): Lying[] {
  const { u, w, h } = sizes(width);
  const back = 0.5 * u;
  let spine = 0.3 * height + w * SHEAR;
  return thick.map((th, i) => {
    const t = th * h;
    const z = -(thick.length - 1 - i) * back;
    const lying = { top: Math.floor(spine - w * SHEAR), bottom: Math.ceil(spine + t), y: spine - z * SHEAR + t / 2, z: z - w / 2, covered: i ? back / w : 0 };
    spine += t + back * SHEAR;
    return lying;
  });
}

/** A CSS cubic-bezier as a function of time, 0 to 1. */
export function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const at = (a: number, b: number, t: number) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  return (x) => {
    let t = x;
    for (let i = 0; i < 6; i++) {
      const slope = 3 * x1 * (1 - t) * (1 - 3 * t) + 3 * x2 * t * (2 - 3 * t) + 3 * t * t;
      if (Math.abs(slope) < 1e-5) break;
      t -= (at(x1, x2, t) - x) / slope;
    }
    return at(y1, y2, Math.max(0, Math.min(1, t)));
  };
}

/** The same angle, written as the short way round from zero: within -180 to 180 degrees. */
export const shortWay = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;

/** How a standing book faces the reader, in degrees as CSS means them, at this share of its lying size. */
export const STANDING = { scale: 0.35, rz: -5, ry: 24, rx: 12 } as const;
