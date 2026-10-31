import { type Ink, lerp, type Scene, type SceneDef } from '../../../lecture/scene';
import { after } from '../../draw';
import { Frame, inset, note } from '../draw';
type Dom = [number, number, number, number];

const f = (x: number) => x * x;

/** The wide view of x², the same window the slope explainer uses. */
const WIDE: Dom = [-1.5, 2.7, -0.9, 6.4];
const ZOOM = 80;

/**
 * The window `t` of the way from the wide view to an 80x close-up of (1, 1). Both axes shrink by
 * the same factor, so the tangent keeps its tilt, while the point drifts to the centre.
 */
function zoomDom(t: number): Dom {
  const k = ZOOM ** -t;
  const axis = (lo: number, hi: number) => {
    const c0 = (lo + hi) / 2;
    const h0 = (hi - lo) / 2;
    const h = h0 * k;
    const c = 1 - ((1 - c0) / h0) * (1 - t) * h;
    return [c - h, c + h] as const;
  };
  return [...axis(WIDE[0], WIDE[1]), ...axis(WIDE[2], WIDE[3])];
}

const frame = (s: Scene, dom: Dom) => new Frame(s, inset(s, 0.07, 0.07, 0.07), dom);

/** Who introduced an idea, and when: small, at the bottom right, where the curve never reaches. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, s.h - 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

const lab = (s: Scene, k: Ink, align: CanvasTextAlign = 'center', size = 3.4) =>
  ({ size, font: 'mono', weight: 600, align, color: s.c(k), halo: true }) as const;

/** x², with its tangent at x = 1 dashed on top so both show where they coincide. */
function curve(s: Scene, F: Frame) {
  F.fn(f, 'purple', 0.8);
  F.fn((x) => 1 + 2 * (x - 1), 'teal', 0.5, F.dom[0], F.dom[1], [2, 1.5]);
  F.dot(1, 1, 'purple', 1.3);
}

/** A run of `dx` from (1, 1) and the tangent's rise over it, labelled. */
function step(s: Scene, F: Frame, dx: number, run: string, rise: string, aRun: number, aRise: number) {
  const side = dx > 0 ? 1 : -1;
  s.alpha(aRun, () => {
    F.seg(1, 1, 1 + dx, 1, '--ink-2', 0.45, [1.2, 1]);
    s.text(run, F.X(1 + dx / 2), F.Y(1) + side * 3.8 * s.u, lab(s, '--ink-2'));
  });
  s.alpha(aRise, () => {
    F.arrow(1 + dx, 1, 1 + dx, 1 + 2 * dx, 'gold', 0.55, 2.2);
    s.text(rise, F.X(1 + dx) + side * 2 * s.u, F.Y(1 + dx), lab(s, 'gold', dx > 0 ? 'left' : 'right'));
  });
}

// ---- zoom in until the curve is its tangent, then read the slope as a rate

const zoom: SceneDef = {
  draw(s) {
    const t = s.ease('zoom', 3, 0.4);
    const F = frame(s, zoomDom(t));
    F.axes();
    curve(s, F);
    const wide = 1 - s.ease('zoom', 0.6, 0.4);
    s.alpha(wide, () => {
      s.text('tangent', F.X(1.75) + 1.5 * s.u, F.Y(2.5) + 4.5 * s.u, lab(s, 'teal', 'left', 3.6));
      s.text('1', F.X(1), F.Y(0) + 3.4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3'), halo: true });
    });
    s.alpha(s.win('ask', 'run'), () => {
      note(s, F, 'f(x) = x²', 0, 'purple', 3.8);
      note(s, F, 'x moves a little: and f?', 1, '--ink-2', 3.6);
    });
    s.alpha(s.win('zoom', 'run') * after(s, 'zoom', 0.1), () => note(s, F, `zoom ×${Math.round(ZOOM ** t)}`, 2, 'gold', 3.6));
    s.alpha(s.win('zoom', 'run') * after(s, 'zoom', 0.6), () => note(s, F, 'almost straight', 3, 'teal', 3.6));

    step(s, F, 0.01, 'run 0.01', 'rise 0.02', s.ease('run', 0.6), s.ease('rise', 0.6));
    s.alpha(s.win('run', 'rate'), () => note(s, F, 'x: 1 to 1.01', 0, '--ink-2', 3.6));
    s.alpha(s.win('rise', 'rate'), () => note(s, F, 'tangent: 2 up per 1 across', 1, 'teal', 3.6));
    s.alpha(s.ease('rate', 0.6), () => note(s, F, 'f′(1) = 2', 0, 'teal', 4.4));
    s.alpha(s.win('rate', 'newton') * after(s, 'rate', 0.4), () => note(s, F, 'a rate: f per unit of x', 1, '--ink-2', 3.6));
    s.alpha(s.win('twice', 'newton'), () => note(s, F, 'f moves about 2× as far', 2, 'teal', 3.6));
    s.alpha(s.ease('newton', 0.6, 1), () => note(s, F, 'fluxion: how fast it grows', 1, '--ink-2', 3.6));
    s.alpha(s.ease('flow', 0.6), () => note(s, F, 'x²: 2x times as fast as x', 2, 'gold', 3.6));
    cite(s, 'Newton, Method of Fluxions, 1671', s.ease('newton', 0.6));
  },
};

// ---- predict the new value, see where the prediction fails, then any slope

/** A curve with f(3) = 7 and f′(3) = 5, for the general case. */
const g = (x: number) => 7 + 5 * (x - 3) + 4 * (x - 3) ** 2;
const G_DOM: Dom = [2.62, 3.38, 4.7, 9.9];

const predict: SceneDef = {
  marks: {
    rule: { tex: String.raw`\Delta \symf \approx \symf'(\symx)\,\Delta \symx`, x: 0.68, y: 0.85, size: 5, align: 'left' },
  },
  draw(s) {
    // Back out to the wide view for the big step, then over to a curve of any shape.
    const out = s.ease('far', 2.2);
    const gen = s.ease('five', 0.8);
    const F = frame(s, zoomDom(1 - out));
    s.alpha(1 - gen, () => {
      F.axes();
      curve(s, F);
      const close = 1 - s.ease('far', 0.5);
      s.alpha(close, () => {
        step(s, F, 0.01, 'run 0.01', 'rise 0.02', 1, 1);
        step(s, F, -0.01, 'run −0.01', 'rise −0.02', s.ease('left', 0.6), s.ease('left', 0.6, 0.6));
      });
      s.alpha(s.win('value', 'left'), () => {
        F.dot(1.01, 1.02, 'gold', 1.1);
        note(s, F, 'f(1.01): 1 + 0.02', 0, 'gold', 3.6);
      });
      s.alpha(s.win('approx', 'left'), () => note(s, F, 'f(1.01) ≈ 1.02', 1, 'gold', 3.8));
      s.alpha(s.win('approx', 'true'), () => note(s, F, '≈ : “is about”', 2, '--ink-2', 3.6));
      s.alpha(s.win('true', 'left'), () => note(s, F, 'true: f(1.01) = 1.0201', 2, 'purple', 3.6));
      s.alpha(s.win('left', 'far'), () => {
        F.dot(0.99, 0.98, 'gold', 1.1);
        note(s, F, 'f(0.99) ≈ 1 − 0.02', 0, 'gold', 3.6);
        note(s, F, '        = 0.98', 1, 'gold', 3.6);
      });

      // A big step: the tangent and the curve part ways.
      const big = after(s, 'far', 0.45) * (1 - gen);
      const told = big * (1 - s.ease('rule', 0.5));
      s.alpha(big, () => {
        F.seg(1, 1, 2, 1, '--ink-3', 0.4, [1.2, 1]);
        F.seg(2, 1, 2, 4, '--ink-3', 0.4, [1.2, 1]);
        F.dot(2, 3, 'teal', 1.2);
        F.dot(2, 4, 'purple', 1.2);
        s.text('3', F.X(2) + 2 * s.u, F.Y(3), lab(s, 'teal', 'left'));
        s.text('4', F.X(2) + 2 * s.u, F.Y(4), lab(s, 'purple', 'left'));
        s.text('1', F.X(1), F.Y(0) + 3.4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3'), halo: true });
        s.text('2', F.X(2), F.Y(0) + 3.4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3'), halo: true });
      });
      s.alpha(told, () => {
        note(s, F, 'tangent: 1 + 2 × 1 = 3', 0, 'teal', 3.6);
        note(s, F, 'curve: f(2) = 4', 1, 'purple', 3.6);
      });
      s.alpha(told * after(s, 'far', 0.75), () => note(s, F, 'a big step: off by 1', 2, 'red', 3.6));
    });
    // The rule sits top left over the wide view, then moves down out of the way of the next curve's notes.
    const corner = { x: F.X(F.dom[0]) / s.w + 0.02, y: (F.Y(F.dom[3]) + 6 * s.u) / s.h };
    s.show('rule', s.ease('rule', 0.7, 1.2), { x: lerp(corner.x, 0.5, gen), y: lerp(corner.y, 0.85, gen) });
    s.alpha(s.win('rule', 'five', 0.6), () => note(s, F, 'Δ: “the change in”', 2, '--ink-2', 3.6));

    // Any f: slope 5 at x = 3, a step of a tenth.
    s.alpha(gen, () => {
      const H = frame(s, G_DOM);
      H.fn(g, 'purple', 0.8);
      H.tangent(3, 7, 5, 'teal', 2.62, 3.38, 0.5);
      H.dot(3, 7, 'purple', 1.3);
      s.text('f', H.X(3.3) - 2 * s.u, H.Y(g(3.3)), lab(s, 'purple', 'right', 4));
      s.text('slope 5', H.X(2.8) + 2 * s.u, H.Y(6), lab(s, 'teal', 'left', 3.4));
      H.seg(3, 7, 3.1, 7, '--ink-2', 0.45, [1.2, 1]);
      s.text('0.1', H.X(3.05), H.Y(7) + 3.8 * s.u, lab(s, '--ink-2'));
      s.alpha(after(s, 'five', 0.45), () => {
        H.arrow(3.1, 7, 3.1, 7.5, 'gold', 0.55, 2.2);
        s.text('≈ 0.5', H.X(3.1) + 2 * s.u, H.Y(7.25), lab(s, 'gold', 'left'));
      });
      note(s, H, 'f′(3) = 5', 0, 'teal', 3.8);
      s.alpha(after(s, 'five', 0.45), () => note(s, H, 'Δf ≈ 5 × 0.1 = 0.5', 1, 'gold', 3.6));
      s.alpha(after(s, 'five', 0.75) * (1 - s.ease('seven', 0.5)), () => note(s, H, 'not 5: that is per unit', 2, '--ink-2', 3.6));
      s.alpha(s.ease('seven', 0.6), () => {
        H.dot(3.1, 7.5, 'gold', 1.1);
        note(s, H, 'f(3) = 7', 2, 'purple', 3.6);
        note(s, H, 'f(3.1) ≈ 7 + 0.5 = 7.5', 3, 'gold', 3.6);
      });
    });
  },
};

// ---- the sign of the slope: which way f goes

const wide = (s: Scene) => frame(s, [-2.3, 2.3, -0.8, 5.4]);

/** Where the tangent's point heads at each beat, in order. */
const PATH: [string, number][] = [['slide', -1.5], ['zero', 0], ['pos', 1.5], ['title', 0], ['height', -1.5], ['up', 1.5], ['table', 1], ['dip', 0]];

const sign: SceneDef = {
  draw(s) {
    const F = wide(s);
    F.axes();
    F.fn(f, 'purple', 0.8);
    let p = -2;
    for (const [b, x] of PATH) p = lerp(p, x, s.ease(b, 1.2, b === 'slide' ? 0.6 : 0));
    const m = 2 * p;
    const k: Ink = m < -0.3 ? 'red' : m > 0.3 ? 'green' : 'teal';
    F.tangent(p, f(p), m, k, p - 0.95, p + 0.95, 0.7);
    F.dot(p, f(p), 'purple');
    const word = m < -0.3 ? 'going down' : m > 0.3 ? 'going up' : 'level';
    const row = (i: number) => F.Y(4.9) + i * 5.6 * s.u;
    const line = (t: string, i: number, c: Ink, w = 500) => s.text(t, s.w / 2, row(i), { size: 3.6, font: 'mono', weight: w, color: s.c(c), halo: true });
    s.alpha(1 - s.ease('leibniz', 0.5), () => s.text(`slope ${m < -0.05 ? '−' : ''}${Math.abs(m).toFixed(1)}: ${word}`, s.w / 2, row(0), { size: 3.9, font: 'mono', weight: 650, color: s.c(k), halo: true }));

    // Leibniz: grow, shrink, neither.
    s.alpha(s.win('leibniz', 'height', 0.5), () => {
      s.alpha(after(s, 'leibniz', 0.25), () => line('heights grow: slope +', 0, 'green', 650));
      s.alpha(after(s, 'leibniz', 0.45), () => line('heights shrink: slope −', 1, 'red', 650));
      s.alpha(after(s, 'leibniz', 0.65), () => line('neither: slope 0, level', 2, 'teal', 650));
    });
    s.alpha(s.win('title', 'height', 0.5), () => line('a lowest point: a minimum', 3, '--ink-2'));
    cite(s, 'Leibniz, Nova Methodus, 1684', s.win('leibniz', 'height'));

    // Height is not direction.
    s.alpha(s.win('height', 'up', 0.5), () => {
      s.alpha(s.ease('height', 0.6, 1), () => {
        F.seg(-1.5, 0, -1.5, 2.25, 'purple', 0.45, [1.2, 1]);
        line('f(−1.5) = 2.25: high up', 0, 'purple');
        line('slope −3: still going down', 1, 'red', 650);
      });
    });
    s.alpha(s.win('down', 'up', 0.5), () => {
      F.arrow(-1.5, f(-1.5), -1.22, f(-1.22), 'green', 0.55, 2.2);
      F.dot(-1.2, f(-1.2), 'green', 1.1);
      line('step right: f falls', 2, '--ink-2');
      line('Δf ≈ −3 × 0.01 = −0.03', 3, 'green', 650);
    });
    s.alpha(s.win('up', 'table', 0.5), () => {
      s.alpha(s.ease('up', 0.6, 1), () => {
        F.arrow(1.5, f(1.5), 1.22, f(1.22), 'green', 0.55, 2.2);
        F.dot(1.2, f(1.2), 'green', 1.1);
      });
      line('slope 3: step left to fall', 0, 'green', 650);
      line('Δf ≈ 3 × (−0.01) = −0.03', 1, '--ink-2');
      s.alpha(after(s, 'up', 0.6), () => line('to raise f: the other way', 2, '--ink-2'));
    });

    // Three nearby values.
    s.alpha(s.win('table', 'dip', 0.5), () => {
      line('f(0.9) = 0.81', 0, '--ink-2');
      line('f(1)   = 1   ', 1, '--ink-2');
      line('f(1.1) = 1.21', 2, '--ink-2');
      line('rising: f′(1) > 0', 3, 'green', 650);
    });
    s.alpha(s.ease('dip', 0.5), () => {
      line('f(−0.1) = 0.01', 0, '--ink-2');
      line('f(0)    = 0   ', 1, '--ink-2');
      line('f(0.1)  = 0.01', 2, '--ink-2');
      line('down, then up: f′(0) = 0', 3, 'teal', 650);
    });
  },
};

export const scenes: Record<string, SceneDef> = { zoom, predict, sign };
