import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { type K, type Rect, PHOTOS, aeMini, area, box, fit, ganMini, juggler, mosaic, pill, pix, slab } from './kit';

// ---------------------------------------------------------------- intro

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'time'), () => {
      fit(s, 'Video and unsupervised learning', w / 2, h * 0.44, w * 0.86, { size: 8, font: 'display', weight: 600 });
      s.text('the last lecture of the 2016 course', w / 2, h * 0.56, { size: 4.2, italic: true, color: s.c('--ink-2') });
    });
    // Direction 1: a film strip of a juggler.
    const tA = s.win('time', 'ae');
    if (tA > 0) {
      s.alpha(tA, () => {
        const n = 6;
        const gap = u * 1.4;
        const fw = Math.min((w * 0.9 - gap * (n - 1)) / n, h * 0.2);
        const fh = fw * 0.78;
        const x0 = (w - n * fw - (n - 1) * gap) / 2;
        const lift = s.ease('labels', 0.8);
        const y0 = lerp(h * 0.42, h * 0.24, lift);
        s.text('1 · time', x0, y0 - h * 0.08, { size: 4.6, font: 'display', weight: 600, align: 'left' });
        s.rrect(x0 - gap, y0 - u * 3, n * fw + (n + 1) * gap, fh + u * 6, 1, { fill: s.tint('--ink', 0.75) });
        for (let i = 0; i < n * 2 + 2; i++) {
          const hx = x0 - gap + u * 1.2 + (i * (n * fw + (n - 1) * gap)) / (n * 2 + 1);
          s.rrect(hx, y0 - u * 2.2, u * 1.4, u * 1.4, 0.3, { fill: s.c('--card') });
          s.rrect(hx, y0 + fh + u * 0.8, u * 1.4, u * 1.4, 0.3, { fill: s.c('--card') });
        }
        const head = Math.floor(s.since('time') * 2.5) % n;
        for (let k = 0; k < n; k++) {
          juggler(s, x0 + k * (fw + gap), y0, fw, fh, k, n);
          if (k === head) s.rrect(x0 + k * (fw + gap) - u * 0.4, y0 - u * 0.4, fw + u * 0.8, fh + u * 0.8, 1, { stroke: s.c('orange'), lw: 0.7 });
        }
        s.arrow(x0, y0 + fh + u * 6.5, x0 + n * fw + (n - 1) * gap, y0 + fh + u * 6.5, s.c('--ink-3'), 0.4, 2.2);
        s.text('frames, in time', x0 + (n * fw + (n - 1) * gap) / 2, y0 + fh + u * 9.6, { size: 3.3, font: 'ui', color: s.c('--ink-3'), halo: true });
      });
    }
    // Direction 2: photos whose labels go away.
    const lA = s.win('labels', 'ae');
    if (lA > 0) {
      s.alpha(lA, () => {
        const n = 6;
        const gap = u * 2;
        const tw = Math.min((w * 0.9 - gap * (n - 1)) / n, h * 0.13);
        const x0 = (w - n * tw - (n - 1) * gap) / 2;
        const y0 = h * 0.62;
        s.text('2 · no labels', x0, h * 0.555, { size: 4.6, font: 'display', weight: 600, align: 'left' });
        const names = ['cat', 'dog', 'car', 'ship', 'bird', 'frog'];
        const strike = s.ease('labels', 0.5, 2.2);
        const gone = s.ease('free', 0.6);
        const more = s.ease('free', 0.8, 0.4);
        for (let k = 0; k < n; k++) {
          const x = x0 + k * (tw + gap);
          mosaic(s, x, y0, tw, 6, PHOTOS[k]!);
          s.alpha((1 - gone) * s.ease('labels', 0.4, 0.15 * k), () => {
            const py = y0 + tw + u * 3.4;
            const pw = pill(s, names[k]!, x + tw / 2, py, 'gold', { size: 2.8 });
            if (strike > 0) s.line(x + tw / 2 - pw / 2, py, x + tw / 2 - pw / 2 + pw * strike, py, s.c('red'), 0.45);
          });
          s.alpha(more, () => mosaic(s, x, y0 + tw + gap - (1 - more) * u * 3, tw, 6, PHOTOS[k + 6]!));
        }
        s.alpha(more, () => s.text('unlabeled: nearly free', w / 2, y0 + 2 * tw + gap + u * 4.5, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      });
    }
    // Three ideas.
    const cA = s.ease('ae', 0.6);
    if (cA > 0) {
      const tall = s.tall;
      const names = ['autoencoder', 'variational autoencoder', 'generative adversarial net'];
      const short = ['autoencoder', 'VAE', 'GAN'];
      const beats = ['ae', 'vae', 'gan'];
      const cur = s.since('gan') >= 0 ? 2 : s.since('vae') >= 0 ? 1 : 0;
      for (let i = 0; i < 3; i++) {
        const a = s.ease(beats[i]!, 0.6);
        if (a <= 0) continue;
        let r: Rect;
        if (tall) {
          const ch = h * 0.25;
          r = [w * 0.06, h * 0.15 + i * (ch + u * 2.5), w * 0.88, ch];
        } else {
          const cw = (w * 0.9 - u * 6) / 3;
          r = [w * 0.05 + i * (cw + u * 3), h * 0.3, cw, h * 0.42];
        }
        const [x, y, rw, rh] = r;
        const on = i === cur ? 1 : 0.35;
        s.alpha(a, () => {
          s.rrect(x, y + (1 - a) * u * 3, rw, rh, 2.4, { fill: s.tint('--ink', 0.03 + 0.03 * on), stroke: s.tint('--ink', 0.12 + 0.3 * on), lw: 0.35 });
          s.alpha(0.55 + 0.45 * on, () => {
            fit(s, tall ? names[i]! : short[i]!, x + rw / 2, y + u * 5, rw * 0.9, { size: 4.2, font: 'display', weight: 600 });
            const inner: Rect = [x + rw * 0.1, y + u * 9, rw * 0.8, rh - u * 12];
            if (i < 2) aeMini(s, inner, i === 1);
            else ganMini(s, inner);
          });
        });
      }
    }
  },
};

// ---------------------------------------------------------------- fusion

type Span = [number, number];
/** The four ways to fuse time (Karpathy et al. 2014): frames used, and each layer's temporal spans. */
const FUSION: Record<string, { name: string; frames: number[]; rows: Span[][]; note: string }> = {
  single: { name: 'single frame', frames: [7], rows: [[[7, 7]], [[7, 7]], [[7, 7]], [[7, 7]]], note: 'one frame: time is never mixed' },
  late: { name: 'late fusion', frames: [0, 15], rows: [[[0, 0], [15, 15]], [[0, 0], [15, 15]], [[0, 0], [15, 15]], [[0, 15]]], note: '2 frames, 15 apart, merged at the FC layer' },
  early: { name: 'early fusion', frames: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], rows: [[[3, 12]], [[3, 12]], [[3, 12]], [[3, 12]]], note: '10 frames, merged at the first layer' },
  slow: {
    name: 'slow fusion',
    frames: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    rows: [[[3, 6], [5, 8], [7, 10], [9, 12]], [[3, 8], [7, 12]], [[3, 12]], [[3, 12]]],
    note: '10 frames, merged a little at each layer',
  },
};

function fusionDiagram(s: Scene, r: Rect, kind: string, a: number): void {
  if (a <= 0.003) return;
  const spec = FUSION[kind]!;
  const [rx, ry, rw, rh] = r;
  const u = s.u;
  const left = rx + u * 12;
  const cw = (rx + rw - left) / 16;
  const fh = cw * 0.75;
  const fy = ry + rh - fh - u * 5;
  const band = (fy - ry - u * 2) / 4;
  const rowH = Math.min(u * 7, band * 0.72);
  const rowY = (k: number) => fy - u * 2 - (k + 1) * band + (band - rowH) / 2;
  const xOf = (t: number) => left + t * cw + cw / 2;
  const used = new Set(spec.frames);
  s.alpha(a, () => {
    for (let t = 0; t < 16; t++) {
      const on = used.has(t);
      const x0 = left + t * cw + cw * 0.08;
      const sz = cw * 0.84;
      s.rrect(x0, fy, sz, fh, 0.6, { fill: on ? s.tint('orange', 0.28) : s.tint('--ink', 0.05), stroke: on ? s.c('orange') : s.tint('--ink', 0.2), lw: on ? 0.45 : 0.25 });
      s.circle(x0 + sz * (0.15 + 0.7 * (t / 15)), fy + fh * 0.5, Math.max(1.2, sz * 0.09), { fill: on ? s.c('--ink') : s.tint('--ink', 0.3) });
    }
    s.text('frames (time →)', left, fy + fh + u * 3.4, { size: 3.1, font: 'ui', color: s.c('--ink-3'), align: 'left' });
    const names = ['conv1', 'conv2', 'conv3', 'fc'];
    let below: Span[] = spec.frames.map((t) => [t, t]);
    spec.rows.forEach((row, k) => {
      const y = rowY(k);
      s.text(names[k]!, rx, y + rowH / 2, { size: 3.1, font: 'mono', color: s.c('--ink-2'), align: 'left' });
      const overlap = row.some((sp, q) => q > 0 && sp[0] <= row[q - 1]![1]);
      row.forEach(([a0, b0], q) => {
        const x0 = left + a0 * cw + cw * 0.12;
        const x1 = left + (b0 + 1) * cw - cw * 0.12;
        const bh = overlap ? rowH * 0.46 : rowH;
        const by = overlap && q % 2 ? y + rowH * 0.54 : y;
        for (const [ba, bb] of below) {
          if (ba >= a0 && bb <= b0) {
            const lx = (xOf(ba) + xOf(bb)) / 2;
            s.line(lx, by + bh, lx, k === 0 ? fy : rowY(k - 1) + rowH, s.tint('teal', 0.5), 0.25);
          }
        }
        const k2: K = k === 3 ? 'purple' : 'teal';
        s.rrect(x0, by, x1 - x0, bh, 1, { fill: s.tint(k2, 0.2), stroke: s.c(k2), lw: 0.4 });
        if (!overlap && x1 - x0 > u * 12) s.text(`${b0 - a0 + 1} frame${b0 > a0 ? 's' : ''}`, (x0 + x1) / 2, by + bh / 2 + u * 0.2, { size: 2.9, font: 'ui', color: s.c('--ink-2') });
      });
      below = row;
    });
  });
}

/** Points tracked through a video, for the dense-trajectories picture. */
const TRACKS = (() => {
  const r = new Rng(11);
  return Array.from({ length: 46 }, (_, i) => {
    const mover = i < 22;
    return {
      x: mover ? r.uniform(0.4, 0.6) : r.uniform(0.04, 0.96),
      y: mover ? r.uniform(0.3, 0.9) : r.uniform(0.08, 0.92),
      vx: mover ? 0.05 : 0,
      wob: r.uniform(0, 6.28),
      amp: mover ? r.uniform(0.01, 0.04) : 0.004,
    };
  });
})();

function sport(s: Scene, kind: number, x: number, y: number, sz: number): void {
  const u = s.u;
  if (kind === 0) {
    s.rrect(x, y, sz, sz * 0.7, 1, { fill: 'rgb(90,160,215)', stroke: s.c('--rule'), lw: 0.3 });
    for (let i = 1; i < 5; i++) s.line(x + u, y + (sz * 0.7 * i) / 5, x + sz - u, y + (sz * 0.7 * i) / 5, 'rgba(255,255,255,0.8)', 0.3, [1, 0.8]);
  } else if (kind === 1) {
    s.rrect(x, y, sz, sz * 0.7, 1, { fill: 'rgb(70,70,90)', stroke: s.c('--rule'), lw: 0.3 });
    s.rrect(x + sz * 0.14, y + sz * 0.1, sz * 0.72, sz * 0.5, 0.4, { fill: 'rgb(225,215,195)' });
    for (let i = 0; i < 3; i++) s.rrect(x + sz * 0.12, y + sz * (0.14 + 0.13 * i), sz * 0.76, sz * 0.025, 0.2, { fill: 'rgb(200,50,50)' });
  } else {
    s.rrect(x, y, sz, sz * 0.7, 1, { fill: 'rgb(80,150,80)', stroke: s.c('--rule'), lw: 0.3 });
    s.rrect(x + sz * 0.06, y + sz * 0.06, sz * 0.88, sz * 0.58, 0.3, { stroke: 'rgba(255,255,255,0.85)', lw: 0.3 });
    s.line(x + sz / 2, y + sz * 0.06, x + sz / 2, y + sz * 0.64, 'rgba(255,255,255,0.85)', 0.3);
    s.circle(x + sz / 2, y + sz * 0.35, sz * 0.1, { stroke: 'rgba(255,255,255,0.85)', lw: 0.3 });
  }
}

const fusion: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // The clip as a deck of frames, then the datasets.
    const aA = s.win('array', 'before');
    if (aA > 0) {
      s.alpha(aA, () => {
        const n = 8;
        const fw = Math.min(w * 0.4, h * 0.42 / 0.72, w * 0.62 - u * 24);
        const fh = fw * 0.72;
        const ox = u * 3;
        const oy = u * 2.1;
        const bx = w * 0.07;
        const by = h * 0.17 + (n - 1) * oy;
        const show = s.ease('array', 1.2);
        for (let k = n - 1; k >= 0; k--) {
          const a = clamp01(show * n - (n - 1 - k));
          juggler(s, bx + k * ox, by - k * oy, fw, fh, k, n, a);
        }
        s.alpha(s.ease('array', 0.6, 1.4), () => {
          s.arrow(bx + fw + u * 1.5, by + fh + u * 0.5, bx + fw + (n - 1) * ox + u * 3.5, by + fh - (n - 1) * oy - u * 0.8, s.c('--ink-2'), 0.4, 2);
          s.text('T', bx + fw + (n - 1) * ox * 0.5 + u * 4.5, by + fh - (n - 1) * oy * 0.5 + u * 1.5, { size: 3.8, font: 'mono', weight: 600, halo: true });
          s.text('W', bx + fw / 2, by + fh + u * 3.4, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink-2') });
          s.text('H', bx - u * 2.6, by + fh / 2, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink-2') });
          pill(s, '(T, 3, H, W)', bx + fw / 2 + ((n - 1) * ox) / 2, h * 0.12, 'orange', { size: 3.4 });
        });
        const tk = s.ease('task', 0.6, 0.8);
        s.alpha(tk, () => {
          const lx = bx + fw + (n - 1) * ox + u * 7;
          const ly = by + fh * 0.2 - ((n - 1) * oy) / 2;
          s.arrow(lx - u * 2, ly, lx + u * 4, ly, s.c('--ink-3'), 0.45, 2);
          pill(s, 'juggling', lx + u * 5, ly, 'gold', { size: 3.4, align: 'left' });
        });
        const dA = s.ease('data', 0.6);
        s.alpha(dA, () => {
          const cy = h * 0.71 + u * 2;
          const cw = (w * 0.86 - u * 4) / 2;
          const chh = Math.min(h * 0.2, u * 20);
          const sets: [string, string, string][] = [
            ['UCF-101', '13,000 clips', '101 actions'],
            ['Sports-1M', '1,000,000 videos', '487 sports'],
          ];
          sets.forEach(([name, a1, a2], i) => {
            const x = w * 0.07 + i * (cw + u * 4);
            const a = s.ease('data', 0.5, i * 1.6);
            s.alpha(a, () => {
              s.rrect(x, cy, cw, chh, 2, { fill: s.tint('slate', 0.08), stroke: s.tint('slate', 0.6) });
              fit(s, name, x + cw / 2, cy + chh * 0.27, cw * 0.9, { size: 4.4, font: 'mono', weight: 700 });
              fit(s, a1, x + cw / 2, cy + chh * 0.57, cw * 0.9, { size: 3.3, font: 'ui', color: s.c('--ink-2') });
              fit(s, a2, x + cw / 2, cy + chh * 0.8, cw * 0.9, { size: 3.3, font: 'ui', color: s.c('--ink-2') });
            });
          });
        });
      });
    }
    // Dense trajectories.
    const bA = s.win('before', 'single');
    if (bA > 0) {
      s.alpha(bA, () => {
        const fw = Math.min(w * 0.84, (h * 0.56) / 0.62);
        const fh = fw * 0.62;
        const fx = (w - fw) / 2;
        const fy = h * 0.2;
        s.rrect(fx, fy, fw, fh, 1.5, { fill: s.tint('--ink', 0.03), stroke: s.tint('--ink', 0.25), lw: 0.35 });
        const now = s.since('before') * 4;
        const c = s.ctx;
        c.save();
        c.beginPath();
        c.rect(fx, fy, fw, fh);
        c.clip();
        for (const p of TRACKS) {
          const pos = (t: number) => {
            const xx = p.x + (p.vx ? 0.22 * Math.sin(t * 0.32 + p.wob * 0.15) : 0);
            return [fx + fw * xx, fy + fh * (p.y + p.amp * Math.sin(t * 1.3 + p.wob))] as const;
          };
          const L = 10;
          c.beginPath();
          for (let q = 0; q <= L; q++) {
            const t = Math.max(0, now - (L - q) * 0.35);
            const [px, py] = pos(t);
            if (q) c.lineTo(px, py);
            else c.moveTo(px, py);
          }
          c.strokeStyle = s.tint('teal', p.vx ? 0.75 : 0.35);
          c.lineWidth = 0.35 * u;
          c.stroke();
          const [hx, hy] = pos(now);
          s.circle(hx, hy, u * 0.8, { fill: s.c(p.vx ? 'teal' : 'slate') });
        }
        c.restore();
        s.text('dense trajectories', w / 2, fy - u * 3.5, { size: 4.2, font: 'display', weight: 600 });
        s.text('track points, describe the motion around each track', w / 2, fy + fh + u * 4, { size: 3.3, font: 'ui', color: s.c('--ink-3') });
        s.alpha(s.ease('where', 0.6, 1.2), () => fit(s, 'where should the frames meet?', w / 2, fy + fh + u * 11, w * 0.9, { size: 4.6, font: 'display', italic: true, color: s.c('--accent') }));
      });
    }
    // The four fusion diagrams.
    const fA = s.ease('single', 0.6);
    if (fA > 0) {
      const order = ['single', 'late', 'early', 'slow'];
      let ci = 0;
      for (let i = 1; i < 4; i++) if (s.since(order[i]!) >= 0) ci = i;
      const sw = ci > 0 ? s.ease(order[ci]!, 0.6) : 1;
      const dim = 1 - s.ease('why', 0.6);
      const r = area(s, 0.24);
      fusionDiagram(s, r, order[ci]!, fA * sw * dim);
      if (ci > 0) fusionDiagram(s, r, order[ci - 1]!, fA * (1 - sw) * dim);
      const titleA = fA * (1 - s.ease('result', 0.5));
      s.alpha(titleA, () => {
        const spec = FUSION[order[ci]!]!;
        s.alpha(sw, () => {
          s.text(spec.name, w / 2, h * 0.1, { size: 5, font: 'display', weight: 600 });
          fit(s, spec.note, w / 2, h * 0.17, w * 0.9, { size: 3.5, font: 'ui', color: s.c('--ink-2') });
        });
      });
      s.alpha(s.win('result', 'why'), () => {
        fit(s, 'single frame: already strong', w / 2, h * 0.09, w * 0.9, { size: 3.9, font: 'ui', weight: 600, color: s.c('--ink-2') });
        fit(s, 'slow fusion: best, by a point or two', w / 2, h * 0.16, w * 0.9, { size: 3.9, font: 'ui', weight: 650, color: s.c('purple') });
      });
      const wA = s.ease('why', 0.6);
      s.alpha(wA, () => {
        const sz = Math.min(w * 0.26, h * 0.32);
        const gap = (w - 3 * sz) / 4;
        const names = ['a pool', 'a ring', 'a pitch'];
        for (let i = 0; i < 3; i++) {
          const a = s.ease('why', 0.5, 0.9 + i * 0.5);
          s.alpha(a, () => {
            const x = gap + i * (sz + gap);
            sport(s, i, x, h * 0.32, sz);
            s.text(names[i]!, x + sz / 2, h * 0.32 + sz * 0.7 + u * 4, { size: 3.8, italic: true, color: s.c('--ink-2') });
          });
        }
        s.alpha(s.ease('why', 0.6, 3), () => fit(s, 'one frame often tells the sport', w / 2, h * 0.32 + sz * 0.7 + u * 13, w * 0.9, { size: 4.2, font: 'display', weight: 600 }));
      });
    }
  },
};


// ---------------------------------------------------------------- 3-D convolution

const VT = 8;
const VS = 10;
/** The chapter's tiny video: a 3-pixel-tall bright square moving right one pixel per frame. */
const VIDEO: number[][] = Array.from({ length: VT }, (_, k) => {
  const fr = new Array(VS * VS).fill(0.08) as number[];
  for (let i = 3; i < 6; i++) for (let j = 1 + k; j < 4 + k && j < VS; j++) fr[i * VS + j] = 1;
  return fr;
});
const WEIGHTS: Record<number, number[]> = { 1: [1], 2: [-1, 1], 3: [-1, 0, 1], 4: [-0.5, -0.5, 0.5, 0.5] };
/** Valid 3-D convolution of VIDEO with a t x 3 x 3 filter (weights over time, averaged in space). */
const CONV: Record<number, number[][]> = Object.fromEntries(
  [1, 2, 3, 4].map((t) => {
    const wt = WEIGHTS[t]!;
    const res: number[][] = [];
    for (let k = 0; k + t <= VT; k++) {
      const o = new Array(64).fill(0) as number[];
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          let v = 0;
          for (let tau = 0; tau < t; tau++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) v += (wt[tau]! / 9) * VIDEO[k + tau]![(i + a) * VS + j + b]!;
          o[i * 8 + j] = v;
        }
      res.push(o);
    }
    return [t, res];
  }),
);

function vframe(s: Scene, x: number, y: number, size: number, k: number, stroke?: K, lw = 0.3): void {
  pix(s, x, y, size, VS, (i, j) => VIDEO[k]![i * VS + j]!, '--ink', { frame: stroke ?? '--rule', lw, lum: true });
}

function outTile(s: Scene, x: number, y: number, size: number, o: number[], signed: boolean, stroke: K, lw: number): void {
  const cs = size / 8;
  for (let q = 0; q < 64; q++) {
    const v = o[q]!;
    const g = Math.round(lerp(28, 238, clamp01(v)));
    s.ctx.fillStyle = signed ? s.tint(v >= 0 ? 'orange' : 'blue', Math.min(1, Math.abs(v) * 2.2)) : `rgb(${g},${g},${g + 4})`;
    s.ctx.fillRect(x + (q % 8) * cs, y + Math.floor(q / 8) * cs, cs + 0.4, cs + 0.4);
  }
  s.rrect(x, y, size, size, 0.5, { stroke: s.c(stroke), lw });
}

const conv3d: SceneDef = {
  marks: {
    eq: { tex: String.raw`y_{k,i,j} = \sum_{\tau,a,b} w_{\tau,a,b}\; \sym{x}{x_{k+\tau,\,i+a,\,j+b}}`, x: 0.5, y: 0.7, size: 5.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    // 2-D: a window sliding over one frame.
    const rA = s.win('recall', 'block');
    if (rA > 0) {
      s.alpha(rA, () => {
        const S = Math.min(w * 0.36, h * 0.58);
        const ix = w * 0.08;
        const ox = w * 0.92 - S;
        const iy = h * 0.26;
        const cs = S / VS;
        pix(s, ix, iy, S, VS, (i, j) => VIDEO[3]![i * VS + j]!, '--ink', { lum: true });
        const q = Math.min(63, Math.floor(s.prog('recall') * 64));
        const qi = Math.floor(q / 8);
        const qj = q % 8;
        s.rrect(ix + qj * cs, iy + qi * cs, cs * 3, cs * 3, 0.6, { stroke: s.c('purple'), lw: 0.7 });
        const os = S / 8;
        const blur = CONV[1]![3]!;
        for (let p = 0; p <= q; p++) {
          const g = Math.round(lerp(28, 238, clamp01(blur[p]!)));
          s.ctx.fillStyle = `rgb(${g},${g},${g + 4})`;
          s.ctx.fillRect(ox + (p % 8) * os, iy + Math.floor(p / 8) * os, os + 0.4, os + 0.4);
        }
        s.rrect(ox, iy, S, S, 0.5, { stroke: s.c('--rule'), lw: 0.3 });
        s.rrect(ox + qj * os, iy + qi * os, os, os, 0.3, { stroke: s.c('purple'), lw: 0.6 });
        s.line(ix + (qj + 3) * cs, iy + (qi + 1.5) * cs, ox + qj * os, iy + (qi + 0.5) * os, s.tint('purple', 0.5), 0.3, [1, 0.8]);
        s.text('image (one frame)', ix + S / 2, iy - u * 3.5, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
        s.text('output', ox + S / 2, iy - u * 3.5, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
        s.text('3 × 3 filter: multiply, add', w / 2, iy + S + u * 6, { size: 3.6, font: 'mono', color: s.c('purple') });
      });
    }
    // The frames row.
    const vA = s.win('block', 'c3d');
    if (vA > 0) {
      const gap = u * 1.4;
      const tile = Math.min((w * 0.92 - gap * (VT - 1)) / VT, h * 0.25);
      const left = (w - tile * VT - gap * (VT - 1)) / 2;
      const y0 = h * 0.2;
      const y1 = y0 + tile + u * 15;
      const xOf = (k: number) => left + k * (tile + gap);
      // Which filter, and which output, at this moment.
      let t = 2;
      let sel = 0;
      let showOut = 0;
      if (s.since('block') >= 0 && s.since('square') < 0) sel = Math.min(6, Math.floor(s.prog('block') * 7));
      if (s.since('edges') >= 0) {
        showOut = s.ease('edges', 0.6);
        sel = Math.min(6, Math.floor(s.prog('edges') * 7.2));
      }
      if (s.since('depth1') >= 0) {
        t = 1;
        sel = Math.min(7, Math.floor(s.prog('depth1') * 8.2));
      }
      if (s.since('shrink') >= 0) {
        const p = s.prog('shrink');
        t = 1 + Math.min(3, Math.floor(p * 4));
        sel = 0;
      }
      const wt = WEIGHTS[t]!;
      const outs = CONV[t]!;
      const signed = t > 1;
      s.slot('wt', wt.map((v) => fmt(v, 2)).join(', '));
      s.slot('t', t);
      s.slot('To', VT - t + 1);
      s.slot('k', sel);
      s.slot('f0', sel);
      s.slot('f1', sel + t - 1);
      s.alpha(vA, () => {
        s.text('input frames', left, y0 - u * 3, { size: 3.4, font: 'ui', color: s.c('--ink-3'), align: 'left' });
        for (let k = 0; k < VT; k++) {
          const on = k >= sel && k < sel + t;
          vframe(s, xOf(k), y0, tile, k, on ? 'orange' : '--rule', on ? 0.7 : 0.3);
        }
        // The filter block: a 3 x 3 window on each of its frames.
        const blockA = s.win('block', 'square');
        s.alpha(blockA, () => {
          const cs = tile / VS;
          const wi = 2 + Math.floor(s.prog('block') * 3) % 3;
          for (let k = sel; k < sel + t; k++) s.rrect(xOf(k) + 2 * cs, y0 + wi * cs, cs * 3, cs * 3, 0.4, { stroke: s.c('purple'), lw: 0.6 });
          const pw = s.measure(`filter: ${t} × 3 × 3`, { font: 'mono', size: 3.2, weight: 600 }) + u * 4;
          const px = Math.min(w - u * 4 - pw / 2, Math.max(u * 4 + pw / 2, (xOf(sel) + xOf(sel + t - 1) + tile) / 2));
          pill(s, `filter: ${t} × 3 × 3`, px, y0 + tile + u * 4.5, 'purple', { size: 3.2 });
        });
        // Below the row: the filter as a block, a tiny movie, a worked pixel, or a zoomed output.
        const zTop = y0 + tile + u * 11;
        const zBot = h - u * 5;
        s.alpha(s.win('block', 'sum'), () => {
          const cs = Math.min((zBot - zTop) / 6, w * 0.06);
          const bx = w / 2 - cs * 2.2;
          const by = zTop + cs * 1.4;
          for (let tau = 1; tau >= 0; tau--) {
            const ox = tau * cs * 1.1;
            const oy = -tau * cs * 0.9;
            for (let a = 0; a < 3; a++)
              for (let b = 0; b < 3; b++) {
                s.rrect(bx + ox + b * cs, by + oy + a * cs, cs * 0.94, cs * 0.94, 1.2, { fill: s.c('--card') });
                s.cell(bx + ox + b * cs, by + oy + a * cs, cs * 0.94, cs * 0.94, '', 'purple', { on: tau ? 0.2 : 0.6 });
              }
          }
          s.text('t frames deep', bx + cs * 3 + cs * 1.9, by - cs * 0.9, { size: 3.3, font: 'ui', color: s.c('--ink-2'), align: 'left' });
          s.text('3 × 3 in space', bx + cs * 1.5, by + cs * 3 + u * 3.2, { size: 3.3, font: 'ui', color: s.c('--ink-2') });
        });
        s.alpha(s.win('square', 'diff'), () => {
          const Z = Math.min(zBot - zTop - u * 4, w * 0.3);
          const k = Math.floor(s.since('square') * 3) % VT;
          vframe(s, w / 2 - Z / 2, zTop + u * 4, Z, k, 'orange', 0.6);
          s.text(`frame ${k}`, w / 2 + Z / 2 + u * 2, zTop + u * 4 + Z / 2, { size: 3.4, font: 'mono', color: s.c('--ink-3'), align: 'left' });
        });
        s.alpha(s.win('diff', 'edges'), () => {
          const P = Math.min(u * 11, (zBot - zTop) * 0.4);
          const cy = zTop + (zBot - zTop) * 0.42;
          const x0 = w / 2 - P * 2.4;
          s.rrect(x0, cy - P / 2, P, P, 0.6, { fill: 'rgb(45,45,49)', stroke: s.c('--rule'), lw: 0.3 });
          s.rrect(x0 + P * 1.4, cy - P / 2, P, P, 0.6, { fill: 'rgb(238,238,242)', stroke: s.c('--rule'), lw: 0.3 });
          s.text('0.08', x0 + P / 2, cy + P / 2 + u * 3.2, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
          s.text('1.00', x0 + P * 1.9, cy + P / 2 + u * 3.2, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
          s.text('one pixel, two frames', x0 + P * 1.2, cy - P / 2 - u * 3, { size: 3.3, font: 'ui', color: s.c('--ink-2') });
          s.alpha(s.ease('diff', 0.5, 1.6), () => {
            fit(s, '−1 × 0.08 + 1 × 1.00 = +0.92', x0 + P * 2.6, cy + P / 2 + u * 10, w * 0.9, { size: 4, font: 'mono', weight: 600, color: s.c('orange') });
          });
          s.arrow(x0 + P * 2.6, cy, x0 + P * 3.4, cy, s.c('--ink-3'), 0.4, 2);
          s.text('brighter', x0 + P * 3.6, cy, { size: 3.6, font: 'ui', weight: 600, color: s.c('orange'), align: 'left' });
        });
        s.show('eq', vA * s.win('sum', 'square'));
        // Motion arrow for the moving square.
        s.alpha(s.win('square', 'diff'), () => {
          const ay = y0 + tile + u * 4.5;
          s.arrow(xOf(0) + tile * 0.3, ay, xOf(VT - 1) + tile * 0.7, ay, s.c('orange'), 0.45, 2.2);
          s.text('one pixel right per frame', w / 2, ay + u * 4, { size: 3.4, font: 'ui', color: s.c('--ink-2'), halo: true });
        });
        // Weights under the frames the filter covers.
        const wA = s.ease('diff', 0.5) * (1 - s.ease('c3d', 0.4));
        s.alpha(wA, () => {
          wt.forEach((v, q) => {
            const k: K = v > 0 ? 'orange' : v < 0 ? 'blue' : 'slate';
            pill(s, v > 0 ? `+${fmt(v, 2)}` : fmt(v, 2), xOf(sel + q) + tile / 2, y0 + tile + u * 4.5, k, { size: 3.2 });
          });
        });
        if (showOut > 0) {
          s.alpha(showOut, () => {
            const lab = signed ? 'output frames' : 'output frames: a blurred copy';
            s.text(lab, left, y1 + tile + u * 4, { size: 3.3, font: 'ui', color: s.c('--ink-3'), align: 'left' });
            outs.forEach((o, k) => outTile(s, xOf(k), y1, tile, o, signed, k === sel ? 'purple' : '--rule', k === sel ? 0.7 : 0.3));
            const sx = xOf(sel) + tile / 2;
            s.line(sx, y1, sx, y0 + tile + u * 8, s.c('purple'), 0.35, [1, 0.8]);
            if (signed) {
              const ly = y1 + tile + u * 4;
              const l0 = left + s.measure(lab, { size: 3.3, font: 'ui' }) + u * 4;
              s.circle(l0 + u * 1.2, ly, u * 1.1, { fill: s.c('orange') });
              s.text('got brighter', l0 + u * 3.2, ly, { size: 3.3, font: 'ui', align: 'left', color: s.c('--ink-2') });
              const off = l0 + u * 3.2 + s.measure('got brighter', { size: 3.3, font: 'ui' }) + u * 5;
              s.circle(off, ly, u * 1.1, { fill: s.c('blue') });
              s.text('got darker', off + u * 2, ly, { size: 3.3, font: 'ui', align: 'left', color: s.c('--ink-2') });
            }
            const zt = y1 + tile + u * 9.5;
            s.alpha(1 - s.ease('shrink', 0.4), () => {
              const Z = Math.min(h - zt - u * 4, w * 0.3);
              outTile(s, w / 2 - Z / 2, zt, Z, outs[Math.min(sel, outs.length - 1)]!, signed, 'purple', 0.6);
              s.text(`y[${sel}]`, w / 2 + Z / 2 + u * 2, zt + Z / 2, { size: 3.6, font: 'mono', color: s.c('purple'), align: 'left' });
            });
            s.alpha(s.ease('shrink', 0.5), () => {
              fit(s, `8 − ${t} + 1 = ${VT - t + 1} output frames`, w / 2, zt + u * 6, w * 0.9, { size: 4.2, font: 'mono', weight: 600, color: s.c('purple') });
            });
          });
        }
      });
    }
    // C3D.
    const cA = s.ease('c3d', 0.7);
    if (cA > 0) {
      s.alpha(cA, () => {
        const cy = h * 0.42;
        const n = 8;
        const x0 = w * 0.06;
        const deckW = Math.min(w * 0.13, h * 0.16);
        for (let k = 5; k >= 0; k--) juggler(s, x0 + k * u * 1.2, cy - deckW * 0.36 - k * u * 0.9, deckW, deckW * 0.72, k, 6);
        s.text('16 frames', x0 + deckW / 2, cy + deckW * 0.5 + u * 3, { size: 3.1, font: 'ui', color: s.c('--ink-3') });
        const sx0 = x0 + deckW + u * 9;
        const sx1 = w * 0.8;
        const step = (sx1 - sx0) / n;
        for (let i = 0; i < n; i++) {
          const a = s.ease('c3d', 0.4, 0.8 + i * 0.25);
          const side = lerp(h * 0.2, h * 0.07, i / (n - 1));
          const d = lerp(u * 2, u * 6, i / (n - 1));
          slab(s, sx0 + i * step, cy - side / 2, Math.min(step * 0.45, side * 0.5), side, d, 'teal', a);
        }
        s.arrow(x0 + deckW + u * 2.5, cy, sx0 - u * 1.5, cy, s.c('--ink-3'), 0.4, 2);
        s.alpha(s.ease('c3d', 0.5, 3), () => {
          fit(s, '8 conv layers, every filter 3 × 3 × 3', (sx0 + sx1) / 2, cy + h * 0.17, sx1 - sx0 + u * 6, { size: 3.6, font: 'mono', color: s.c('teal') });
        });
        const fA = s.ease('features', 0.6);
        s.alpha(fA, () => {
          const fx = w * 0.84;
          box(s, fx, cy - h * 0.07, w * 0.12, h * 0.14, 'fc', 'purple');
          s.arrow(sx1 + u, cy, fx - u, cy, s.c('--ink-3'), 0.4, 2);
          s.arrow(fx + w * 0.06, cy + h * 0.08, fx + w * 0.06, h * 0.66, s.c('--ink-3'), 0.4, 2);
          const lw = Math.min(w * 0.6, u * 70);
          box(s, w * 0.94 - lw, h * 0.68, lw, h * 0.1, 'linear classifier', 'slate', { size: 3.6 });
          fit(s, 'action, sport, scene, ...', w * 0.94 - lw / 2, h * 0.86, lw, { size: 3.6, font: 'ui', italic: true, color: s.c('--ink-2') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- two streams and RNNs

const FG = 12;
/** A disc on a 12 x 12 grid at (ci, cj); `flow` frames move it by (di, dj). */
const disc = (ci: number, cj: number) => (i: number, j: number) => ((i - ci) ** 2 + (j - cj) ** 2 < 6.5 ? 1 : 0);
const F0 = disc(6, 4);
const F1 = disc(5, 6);

function flowTile(s: Scene, x: number, y: number, size: number, a: number): void {
  const cs = size / FG;
  s.rrect(x, y, size, size, 0.5, { fill: s.tint('--ink', 0.03), stroke: s.c('--rule'), lw: 0.3 });
  for (let i = 0; i < FG; i += 1)
    for (let j = 0; j < FG; j += 1) {
      const cx = x + (j + 0.5) * cs;
      const cy = y + (i + 0.5) * cs;
      if (F0(i, j)) s.arrow(cx - cs * 0.6, cy + cs * 0.3, cx + cs * 0.6 * a, cy + cs * 0.3 - cs * 0.6 * a, s.c('teal'), 0.25, 1);
      else if ((i + j) % 2 === 0) s.circle(cx, cy, Math.max(0.6, cs * 0.06), { fill: s.tint('--ink', 0.25) });
    }
}

function channel(s: Scene, x: number, y: number, size: number, v: number): void {
  const cs = size / FG;
  for (let i = 0; i < FG; i++)
    for (let j = 0; j < FG; j++) {
      if (!F0(i, j)) continue;
      s.ctx.fillStyle = s.tint(v >= 0 ? 'orange' : 'blue', Math.min(0.9, Math.abs(v) * 0.4));
      s.ctx.fillRect(x + j * cs, y + i * cs, cs + 0.4, cs + 0.4);
    }
  s.rrect(x, y, size, size, 0.5, { stroke: s.c('--rule'), lw: 0.3 });
}

function bars(s: Scene, x: number, y: number, w: number, h: number, vals: number[], k: K, best = -1): void {
  const bw = w / vals.length;
  vals.forEach((v, i) => {
    const bh = h * v;
    s.rrect(x + i * bw + bw * 0.15, y + h - bh, bw * 0.7, bh, 0.3, { fill: i === best ? s.c(k) : s.tint(k, 0.4) });
  });
}

const streams: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Optical flow.
    const oA = s.win('route', 'spatial');
    if (oA > 0) {
      s.alpha(oA, () => {
        const T = Math.min(w * 0.25, h * 0.3);
        const y = h * 0.2;
        const xs = [w * 0.2 - T / 2, w * 0.5 - T / 2, w * 0.8 - T / 2];
        pix(s, xs[0]!, y, T, FG, F0, '--ink');
        pix(s, xs[1]!, y, T, FG, (i, j) => F1(i, j) + 0.25 * F0(i, j), '--ink');
        s.text('frame t', xs[0]! + T / 2, y + T + u * 3.6, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        s.text('frame t + 1', xs[1]! + T / 2, y + T + u * 3.6, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        const fA = s.ease('flow', 0.6);
        s.alpha(1 - fA, () => s.text('?', xs[2]! + T / 2, y + T / 2, { size: 9, font: 'display', color: s.c('--ink-3') }));
        s.alpha(fA, () => {
          flowTile(s, xs[2]!, y, T, s.ease('flow', 1, 0.3));
          s.text('optical flow', xs[2]! + T / 2, y + T + u * 3.6, { size: 3.4, font: 'ui', weight: 600, color: s.c('teal') });
        });
        s.alpha(s.ease('flow', 0.6, 2.6), () => {
          const C = T * 0.82;
          const cy = y + T + u * 12;
          const cx = [w * 0.35 - C / 2, w * 0.65 - C / 2];
          channel(s, cx[0]!, cy, C, 2);
          channel(s, cx[1]!, cy, C, -1);
          s.text('horizontal step', cx[0]! + C / 2, cy + C + u * 3.4, { size: 3.3, font: 'ui', color: s.c('orange') });
          s.text('vertical step', cx[1]! + C / 2, cy + C + u * 3.4, { size: 3.3, font: 'ui', color: s.c('blue') });
          s.text('2 numbers per pixel', w / 2, cy - u * 3.2, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
        });
      });
    }
    // The two-stream network.
    const tA = s.win('spatial', 'short');
    if (tA > 0) {
      const dim = 1 - s.ease('surprise', 0.6);
      s.alpha(tA * dim, () => {
        const lanes = [h * 0.3, h * 0.7];
        const inW = Math.min(w * 0.16, h * 0.2);
        const bx = w * 0.06 + inW + u * 5;
        const bw = w * 0.27;
        const bh = Math.min(h * 0.2, u * 18);
        const sx = bx + bw + u * 5;
        const sw = w * 0.12;
        const sA = s.ease('spatial', 0.6);
        const fA = s.ease('temporal', 0.6);
        const scores = [
          [0.35, 0.8, 0.3, 0.5],
          [0.3, 0.9, 0.45, 0.2],
        ];
        s.alpha(sA, () => {
          const y = lanes[0]!;
          mosaic(s, w * 0.06, y - inW / 2, inW, 6, PHOTOS[1]!);
          s.text('RGB frame', w * 0.06 + inW / 2, y + inW / 2 + u * 3.4, { size: 3.2, font: 'ui', color: s.c('--ink-3') });
          s.arrow(w * 0.06 + inW + u, y, bx - u, y, s.c('--ink-3'), 0.4, 2);
          box(s, bx, y - bh / 2, bw, bh, 'spatial', 'orange', { sub: 'appearance', size: 4 });
          s.arrow(bx + bw + u, y, sx - u, y, s.c('--ink-3'), 0.4, 2);
          bars(s, sx, y - bh / 2, sw, bh, scores[0]!, 'orange', 1);
        });
        s.alpha(fA, () => {
          const y = lanes[1]!;
          for (let k = 4; k >= 0; k--) {
            const x = w * 0.06 + k * u * 1.3;
            const yy = y - inW / 2 - k * u * 1.1 + u * 2;
            s.rrect(x, yy, inW - u * 5, inW - u * 5, 0.5, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.3 });
            channel(s, x, yy, inW - u * 5, k % 2 ? -1 : 2);
          }
          s.text('flow ×10 = 20 ch', w * 0.06 + inW / 2, y + inW / 2 + u * 3.4, { size: 3.2, font: 'ui', color: s.c('--ink-3') });
          s.arrow(w * 0.06 + inW + u, y, bx - u, y, s.c('--ink-3'), 0.4, 2);
          box(s, bx, y - bh / 2, bw, bh, 'temporal', 'teal', { sub: 'motion', size: 4 });
          s.arrow(bx + bw + u, y, sx - u, y, s.c('--ink-3'), 0.4, 2);
          bars(s, sx, y - bh / 2, sw, bh, scores[1]!, 'teal', 1);
        });
        const aA = s.ease('avg', 0.6);
        s.alpha(aA, () => {
          const mx = sx + sw + u * 7;
          const my = (lanes[0]! + lanes[1]!) / 2;
          s.line(sx + sw + u, lanes[0]!, mx - u * 2, my - u * 2, s.c('--ink-3'), 0.4);
          s.line(sx + sw + u, lanes[1]!, mx - u * 2, my + u * 2, s.c('--ink-3'), 0.4);
          s.circle(mx, my, u * 3.2, { fill: s.tint('purple', 0.15), stroke: s.c('purple'), lw: 0.45 });
          s.text('avg', mx, my + u * 0.2, { size: 2.9, font: 'mono', weight: 600, color: s.c('purple') });
          const avg = scores[0]!.map((v, i) => (v + scores[1]![i]!) / 2);
          bars(s, mx - sw / 2, my + u * 5, sw, bh * 0.8, avg, 'purple', 1);
        });
      });
      const qA = s.ease('surprise', 0.6) * tA;
      s.alpha(qA, () => {
        const base = h * 0.82;
        const top = h * 0.24;
        const lo = 0;
        const hi = 100;
        const Y = (v: number) => base - ((v - lo) / (hi - lo)) * (base - top);
        const vals: [string, number, K][] = [
          ['appearance', 73, 'orange'],
          ['motion', 83.7, 'teal'],
          ['both', 88, 'purple'],
        ];
        const bw = Math.min(w * 0.18, u * 22);
        const gap = (w * 0.84 - 3 * bw) / 2;
        vals.forEach(([name, v, k], i) => {
          const a = s.ease('surprise', 0.6, i === 2 ? 3.2 : 0.6 + i * 1.2);
          const x = w * 0.08 + i * (bw + gap);
          s.alpha(a, () => {
            s.rrect(x, Y(lerp(lo, v, a)), bw, base - Y(lerp(lo, v, a)), 0.8, { fill: s.tint(k, 0.55), stroke: s.c(k), lw: 0.35 });
            s.text(name, x + bw / 2, base + u * 3.6, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
          });
        });
        s.alpha(s.ease('surprise', 0.6, 3.6), () => {
          const x2 = w * 0.08 + 2 * (bw + gap);
          s.text('≈ 88%', x2 + bw / 2, Y(88) - u * 3.4, { size: 4, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
          s.line(w * 0.06, Y(87.6), w * 0.94, Y(87.6), s.c('--ink-3'), 0.3, [1, 0.8]);
          s.text('best hand-designed features', w * 0.06, Y(87.6) - u * 2.4, { size: 3.1, font: 'ui', color: s.c('--ink-3'), align: 'left', halo: true });
          s.text('UCF-101 accuracy', w * 0.06, top - u * 6, { size: 3.3, font: 'ui', color: s.c('--ink-3'), align: 'left' });
        });
        s.line(w * 0.06, base, w * 0.94, base, s.c('--axis'), 0.35);
      });
    }
    // Long-range structure.
    const lA = s.win('short', 'mix');
    if (lA > 0) {
      s.alpha(lA, () => {
        const shortA = s.win('short', 'lstm');
        s.alpha(shortA, () => {
          const x0 = w * 0.08;
          const x1 = w * 0.92;
          const y = h * 0.48;
          const X = (sec: number) => lerp(x0, x1, sec / 10);
          s.line(x0, y, x1, y, s.c('--axis'), 0.5);
          for (let sec = 0; sec <= 10; sec += 2) {
            s.line(X(sec), y - u, X(sec), y + u, s.c('--axis'), 0.35);
            s.text(`${sec} s`, X(sec), y + u * 3.6, { size: 3, font: 'mono', color: s.c('--ink-3') });
          }
          s.rrect(X(2), y - u * 9, X(9) - X(2), u * 5, 1, { fill: s.tint('gold', 0.25), stroke: s.c('gold'), lw: 0.35 });
          s.text('the event', (X(2) + X(9)) / 2, y - u * 6.5, { size: 3.3, font: 'ui', weight: 600 });
          s.rrect(X(0.2), y + u * 7, X(0.84) - X(0.2), u * 4, 0.5, { fill: s.tint('teal', 0.35), stroke: s.c('teal'), lw: 0.35 });
          s.text('a flow stack or 3-D conv: under a second', X(0.2), y + u * 15, { size: 3.3, font: 'ui', color: s.c('teal'), align: 'left' });
        });
        const rA = s.ease('lstm', 0.6);
        s.alpha(rA, () => {
          const n = 6;
          const x0 = w * 0.07;
          const pillW = s.measure('long jump', { font: 'mono', size: 3.3, weight: 600 }) + u * 3.2;
          const span = Math.min(w * 0.66, w - x0 - pillW - u * 10 - h * 0.07);
          const step = span / (n - 1);
          const fw = Math.min(step * 0.8, h * 0.13);
          const fy = h * 0.74;
          const cy = h * 0.55;
          const hy = h * 0.32;
          const rconv = s.ease('rconv', 0.7);
          const pulse = s.since('carry') >= 0 ? clamp01(s.prog('carry') * 1.2) * (n + 0.5) : -1;
          for (let k = 0; k < n; k++) {
            const x = x0 + k * step;
            juggler(s, x - fw / 2, fy, fw, fw * 0.72, k, n);
            s.arrow(x, fy - u * 0.8, x, cy + u * 3.2, s.c('--ink-3'), 0.35, 1.6);
            box(s, x - fw * 0.42, cy - u * 3, fw * 0.84, u * 6, 'cnn', 'slate', { size: 2.8 });
            s.arrow(x, cy - u * 3.4, x, hy + u * 4.6, s.c('--ink-3'), 0.35, 1.6);
            const lit = pulse >= 0 && pulse > k ? 1 : 0;
            s.alpha(1 - rconv, () => box(s, x - fw * 0.42, hy - u * 4, fw * 0.84, u * 8, 'h', 'teal', { size: 3.2, fill: 0.12 + 0.3 * lit }));
            s.alpha(rconv, () => slab(s, x - fw * 0.3, hy - u * 3.4, fw * 0.42, u * 6.8, u * 3.2, 'teal'));
            if (k < n - 1) s.arrow(x + fw * 0.45, hy, x + step - fw * 0.45, hy, s.tint('teal', 0.4 + 0.6 * (pulse > k + 0.5 ? 1 : 0)), 0.45, 1.8);
          }
          s.text(rconv > 0.5 ? 'conv GRU: memory h is a (C, H, W) map' : 'LSTM: memory h carries across time', x0 - fw * 0.42, hy - u * 9, { size: 3.4, font: 'mono', color: s.c('teal'), align: 'left' });
          const endX = x0 + span + fw * 0.45;
          s.alpha(s.ease('carry', 0.5, 1.6) * (1 - rconv), () => {
            s.arrow(endX, hy, endX + u * 4, hy, s.c('teal'), 0.45, 1.8);
            pill(s, 'long jump', endX + u * 4.5, hy, 'gold', { size: 3.3, align: 'left' });
          });
        });
      });
    }
    const mA = s.ease('mix', 0.6);
    s.alpha(mA, () => {
      const items: [string, K][] = [
        ['fusion', 'orange'],
        ['3-D conv', 'teal'],
        ['optical flow', 'blue'],
        ['RNN on top', 'purple'],
      ];
      const tall = s.tall;
      const gapX = u * 6;
      const pw = tall ? w * 0.6 : (w * 0.9 - 3 * gapX) / 4;
      items.forEach(([name, k], i) => {
        const a = s.ease('mix', 0.4, 0.2 + i * 0.25);
        const x = tall ? w / 2 - pw / 2 : w * 0.05 + i * (pw + gapX);
        const y = tall ? h * 0.22 + i * h * 0.16 : h * 0.45;
        s.alpha(a, () => {
          s.rrect(x, y - u * 4.5, pw, u * 9, 2, { fill: s.tint(k, 0.12), stroke: s.c(k), lw: 0.4 });
          fit(s, name, x + pw / 2, y, pw * 0.9, { size: 3.8, font: 'mono', weight: 600, color: s.c(k) });
          if (i > 0) s.text('+', tall ? w / 2 : x - gapX / 2, tall ? y - h * 0.08 : y, { size: 4.4, font: 'mono', color: s.c('--ink-3') });
        });
      });
      s.alpha(s.ease('mix', 0.6, 1.2), () => s.text('combined', w / 2, tall ? h * 0.9 : h * 0.66, { size: 4.6, font: 'display', italic: true, color: s.c('--accent') }));
    });
  },
};

export const videoScenes: Record<string, SceneDef> = { intro, fusion, conv3d, streams };
