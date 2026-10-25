import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../draw';

const ROWS = ['conv: edges, colors', 'conv: textures', 'conv: parts', 'fc: 1,000 classes'];

type Tag = { text: string; k: Ink; a: number };

/** The pretrained network as a column of blocks, with an optional tag beside each. */
function stack(s: Scene, o: { last: number; tags: (i: number) => Tag[]; hi?: (i: number) => number; rowsA?: (i: number) => number }) {
  const cx = s.w * (s.tall ? 0.4 : 0.42);
  const bw = (s.tall ? 46 : 52) * s.u;
  const bh = 8.5 * s.u;
  const y0 = s.h * 0.14;
  const pitch = s.h * 0.15;
  const ys = ROWS.map((_, i) => y0 + i * pitch);
  s.text('input image', cx, y0 - 8.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
  ROWS.forEach((name, i) => {
    s.alpha(o.rowsA?.(i) ?? 1, () => {
      const y = ys[i]!;
      if (i > 0) s.arrow(cx, ys[i - 1]! + bh / 2 + 0.5 * s.u, cx, y - bh / 2 - 0.5 * s.u, s.c('--ink-3'), 0.3, 1.6);
      const last = i === ROWS.length - 1;
      const k: Ink = last ? 'purple' : 'blue';
      const hi = o.hi?.(i) ?? 0;
      s.rrect(cx - bw / 2, y - bh / 2, bw, bh, 1.2, { fill: s.tint(last && o.last > 0.5 ? 'green' : k, 0.14 + 0.2 * hi), stroke: s.tint(last && o.last > 0.5 ? 'green' : k, 0.6 + 0.4 * hi), lw: 0.35 });
      const label = (t: string, a: number, c: Ink) => s.alpha(a, () => s.text(t, cx, y, { size: 3.2, font: 'mono', weight: 600, color: s.c(c) }));
      if (last) {
        label(name, 1 - o.last, 'purple');
        label('fc: 10 classes, new', o.last, 'green');
      } else label(name, 1, '--ink');
      for (const t of o.tags(i)) s.alpha(t.a, () => s.text(t.text, cx + bw / 2 + 3 * s.u, y, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c(t.k) }));
    });
  });
  return { cx, ys, bw, bh };
}

const reuse: SceneDef = {
  draw(s) {
    const swap = s.ease('swap', 0.8, 1.6);
    const frozen = s.ease('swap', 0.6, 0.4);
    stack(s, {
      last: swap,
      rowsA: (i) => s.ease('pretrained', 0.5, 0.4 + i * 0.4),
      hi: (i) => (i < 3 ? s.win('layers', 'swap') * (i === Math.min(2, Math.floor(s.since('layers') / 2.2)) ? 1 : 0) : 0),
      tags: (i) => (i < 3 ? [{ text: 'fixed', k: 'slate', a: frozen }] : [{ text: 'trained', k: 'green', a: swap }]),
    });
    s.alpha(s.ease('pretrained', 0.6, 1), () => s.text('trained on ImageNet: 1.2 million photos', s.w / 2, s.h * 0.8, { size: 3.2, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('count', 0.6, 0.4), () => s.text('512 × 10 + 10 = 5,130 trained', s.w / 2, s.h * 0.88, { size: 3.6, font: 'mono', weight: 650, color: s.c('green') }));
  },
};

const howmuch: SceneDef = {
  draw(s) {
    const more = s.ease('more', 0.6, 0.6);
    const diff = s.ease('different', 0.6);
    stack(s, {
      last: 1,
      hi: (i) => (i === 0 ? diff : 0),
      tags: (i) => {
        if (i === 3) return [{ text: 'trained', k: 'green', a: 1 }];
        return [
          ...(i === 2 ? [{ text: 'old classes', k: 'purple' as Ink, a: diff }] : []),
          { text: 'fixed', k: 'slate', a: (1 - more) * (1 - diff) },
          { text: 'fine-tuned', k: 'green', a: more * (1 - diff) },
          ...(i === 0 ? [{ text: 'carries over', k: 'green' as Ink, a: diff }] : []),
        ];
      },
    });
    s.alpha(s.win('small', 'more'), () => s.text('a few hundred images: last layer only', s.w / 2, s.h * 0.82, { size: 3.3, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.win('more', 'different'), () => s.text('tens of thousands: fine-tune all', s.w / 2, s.h * 0.82, { size: 3.3, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.win('lr', 'different'), () => s.text('learning rate η: 10× smaller', s.w / 2, s.h * 0.89, { size: 3.3, font: 'mono', weight: 600, color: s.c('slate') }));
    s.alpha(diff, () => s.text('X-rays: edges are everywhere', s.w / 2, s.h * 0.85, { size: 3.3, font: 'mono', color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { reuse, howmuch };
