import { fmt } from '../../core/code';
import { CLASS_COLORS } from '../../core/plot';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { SIDE } from '../../lib/contrastive-aug';
import { type K, area, box, cifar, drawPhoto, heat, lock, onCircle, photo, pill, unitCircle, views } from './kit';

// ---------------------------------------------------------------- intro

const MILESTONES: { name: string; t: number; k: K; note: string }[] = [
  { name: 'InfoNCE', t: 2018.5, k: 'teal', note: 'CPC' },
  { name: 'MoCo', t: 2019.85, k: 'blue', note: 'queue' },
  { name: 'SimCLR', t: 2020.1, k: 'purple', note: 'views' },
  { name: 'CLIP', t: 2021.1, k: 'green', note: 'text' },
  { name: 'DINO', t: 2021.3, k: 'gold', note: 'teacher' },
  { name: 'MAE', t: 2021.85, k: 'orange', note: 'masking' },
];

const TOPICS: [string, K][] = [
  ['two views', 'orange'],
  ['InfoNCE', 'teal'],
  ['collapse', 'red'],
  ['SimCLR', 'purple'],
  ['MoCo', 'blue'],
  ['CLIP', 'green'],
  ['MAE', 'orange'],
  ['DINO', 'gold'],
];

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const [ax, ay, aw, ah] = area(s);
    s.alpha(s.win('hello', 'labels'), () => {
      s.text('Self-supervised learning', w / 2, h * 0.42, { size: Math.min(9, (aw / u) * 0.085), font: 'display', weight: 600 });
      s.text('and CLIP', w / 2, h * 0.53, { size: Math.min(9, (aw / u) * 0.085), font: 'display', weight: 600, color: s.c('green') });
      s.text('learning without labels', w / 2, h * 0.64, { size: 4.4, italic: true, color: s.c('--ink-2') });
    });
    // Labeled photos, then what a label leaves out.
    const lab = s.win('labels', 'changed');
    if (lab > 0) {
      const cs = cifar(s);
      const n = 4;
      const gap = u * 3;
      const size = Math.min((aw - gap * (n - 1)) / n, ah * 0.32);
      const x0 = ax + (aw - size * n - gap * (n - 1)) / 2;
      const y0 = s.tall ? ay + ah * 0.08 : ay + ah * 0.04;
      const names = ['cat', 'car', 'horse', 'ship'];
      const cls = [3, 1, 7, 8];
      s.alpha(lab, () => {
        for (let i = 0; i < n; i++) {
          const x = x0 + i * (size + gap);
          const a = s.ease('labels', 0.5, 0.25 * i);
          s.alpha(a, () => {
            if (cs) drawPhoto(s, photo(cs, cls[i]!), x, y0, size);
            pill(s, names[i]!, x + size / 2, y0 + size + u * 4, 'gold', { size: 3.4 });
          });
        }
        const th = s.ease('thin', 0.6) * (1 - s.ease('before', 0.5));
        s.alpha(th, () => {
          const qs = ['pose?', 'texture?', 'light?'];
          qs.forEach((q, i) => s.text(q, w / 2 + (i - 1) * Math.min(size * 1.2, u * 22), y0 + size + u * 11, { size: 3.4, italic: true, color: s.c('--ink-3') }));
          s.text('one word per image', w / 2, y0 + size + u * 18, { size: 3.8, font: 'ui', weight: 600, color: s.c('--ink-2') });
        });
        // CS231n's answer: rebuild the pixels.
        const bf = s.ease('before', 0.6);
        s.alpha(bf, () => {
          const cy = y0 + size + u * 17 + (s.tall ? ah * 0.12 : ah * 0.08);
          const bw = Math.min(aw * 0.16, u * 18);
          const bh = u * 9;
          const cx0 = w / 2 - bw * 1.6;
          s.text('x', cx0 - bw * 0.9, cy, { size: 5, italic: true, weight: 600, color: s.c('orange') });
          s.arrow(cx0 - bw * 0.7, cy, cx0 - bw / 2 - u, cy, s.c('--ink-3'), 0.35, 1.6);
          box(s, cx0, cy, bw, bh, 'encoder', '--ink-2', { size: 3.2 });
          s.arrow(cx0 + bw / 2 + u, cy, w / 2 - u * 3, cy, s.c('--ink-3'), 0.35, 1.6);
          s.text('z', w / 2, cy, { size: 5, italic: true, weight: 600, color: s.c('purple') });
          s.arrow(w / 2 + u * 3, cy, w / 2 + bw * 1.6 - bw / 2 - u, cy, s.c('--ink-3'), 0.35, 1.6);
          box(s, w / 2 + bw * 1.6, cy, bw, bh, 'decoder', '--ink-2', { size: 3.2 });
          s.arrow(w / 2 + bw * 2.1 + u, cy, w / 2 + bw * 2.5, cy, s.c('--ink-3'), 0.35, 1.6);
          s.text('x̂', w / 2 + bw * 2.62, cy, { size: 5, italic: true, weight: 600, color: s.c('orange') });
          s.text('CS231n: autoencoders, VAEs, GANs rebuild pixels', w / 2, cy + bh / 2 + u * 5, { size: 3.3, font: 'ui', color: s.c('--ink-3') });
        });
      });
    }
    // Timeline of the methods.
    const tl = s.win('changed', 'plan');
    if (tl > 0) {
      s.alpha(tl, () => {
        const y = ay + ah * 0.5;
        const X = (t: number) => ax + aw * 0.06 + ((t - 2018) / 4) * aw * 0.88;
        s.line(X(2018), y, X(2022), y, s.c('--axis'), 0.4);
        for (let yr = 2018; yr <= 2022; yr++) {
          s.line(X(yr), y - u, X(yr), y + u, s.c('--axis'), 0.4);
          s.text(String(yr), X(yr), y + u * 4.5, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        }
        MILESTONES.forEach((m, i) => {
          const a = s.ease('changed', 0.5, 0.45 * i);
          const up = i % 2 === 0;
          const yy = y + (up ? -1 : 1) * (u * 13 + (i >= 3 ? u * 6 * ((i - 3) % 2) : 0));
          const on = m.name === 'CLIP' ? s.ease('clip', 0.5) : 0;
          s.alpha(a, () => {
            s.line(X(m.t), y, X(m.t), yy + (up ? u * 3 : -u * 3), s.tint(m.k, 0.6), 0.3);
            s.circle(X(m.t), y, u * 1.1, { fill: s.c(m.k) });
            pill(s, m.name, X(m.t), yy, m.k, { size: 3.4 + on * 0.8, fill: 0.13 + on * 0.25 });
          });
        });
        s.alpha(s.ease('clip', 0.6), () => pill(s, '400 million image-text pairs', w / 2, ay + ah * 0.9, 'green', { size: 3.6 }));
      });
    }
    // The plan: topic tiles.
    const pl = s.win('plan');
    if (pl > 0) {
      s.alpha(pl, () => {
        const cols = s.tall ? 2 : 4;
        const rows = Math.ceil(TOPICS.length / cols);
        const gap = u * 2.5;
        const tw = (aw - gap * (cols - 1)) / cols;
        const th = Math.min((ah * 0.62 - gap * (rows - 1)) / rows, u * 13);
        const y0 = ay + ah * 0.05;
        TOPICS.forEach(([name, k], i) => {
          const x = ax + (i % cols) * (tw + gap);
          const y = y0 + Math.floor(i / cols) * (th + gap);
          const lit = i < 3 ? s.ease('plan', 0.4, 0.4 * i) : s.ease('plan2', 0.4, 0.45 * (i - 3));
          s.alpha(0.35 + 0.65 * lit, () => {
            s.rrect(x, y, tw, th, 2, { fill: s.tint(k, 0.05 + 0.12 * lit), stroke: s.tint(k, 0.3 + 0.6 * lit), lw: 0.35 });
            s.text(name, x + tw / 2, y + th / 2, { size: Math.min(4.6, (th / u) * 0.4), font: 'display', weight: 600, color: s.c(lit > 0.5 ? k : '--ink-2') });
          });
        });
        const gy = y0 + rows * (th + gap) + u * 7;
        s.alpha(s.ease('grade', 0.6), () => {
          pill(s, 'how do we grade features with no labels?', w / 2, Math.min(gy, ay + ah - u * 4), 'gold', { size: 3.6 });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- probe

const probe: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s);
    const cs = cifar(s);
    // The task comes from the data.
    s.alpha(s.win('self', 'rot'), () => {
      s.text('the data supplies the answers', w / 2, ay + ah * 0.25, { size: 5.2, font: 'display', weight: 600 });
      const words = ['the', 'cat', 'sat', 'on', 'the', 'mat'];
      const fs = 4.4;
      const ws = words.map((t) => s.measure(t, { font: 'mono', size: fs }) + u * 3.5);
      const total = ws.reduce((a, b) => a + b, 0);
      let x = w / 2 - total / 2;
      const y = ay + ah * 0.55;
      const reveal = s.ease('lm', 0.6, 0.9);
      words.forEach((t, i) => {
        const last = i === words.length - 1;
        const k: K = last ? 'gold' : '--ink-2';
        s.rrect(x + u * 0.5, y - u * 4, ws[i]! - u, u * 8, 1.4, { fill: s.tint(k, last ? 0.1 + 0.15 * reveal : 0.07), stroke: s.tint(k, 0.5) , lw: 0.3 });
        s.text(last ? (reveal > 0.5 ? t : '?') : t, x + ws[i]! / 2, y + u * 0.3, { font: 'mono', size: fs, color: s.c(last ? 'gold' : '--ink') });
        x += ws[i]!;
      });
      s.alpha(s.ease('lm', 0.6), () => s.text('predict the next word: the text is its own label', w / 2, y + u * 10, { size: 3.4, italic: true, color: s.c('--ink-2') }));
    });
    // Rotation puzzle.
    s.alpha(s.win('rot', 'point'), () => {
      const n = 4;
      const gap = u * 4;
      const size = Math.min((aw - gap * (n - 1)) / n, ah * 0.42);
      const x0 = ax + (aw - size * n - gap * (n - 1)) / 2;
      const y0 = ay + ah * 0.22;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * (size + gap);
        const a = s.ease('rot', 0.5, 0.35 * i);
        s.alpha(a, () => {
          if (cs) {
            const c = s.ctx;
            c.save();
            c.translate(x + size / 2, y0 + size / 2);
            c.rotate((i * Math.PI) / 2);
            drawPhoto(s, photo(cs, 7, 2), -size / 2, -size / 2, size);
            c.restore();
          }
          s.text(`${i * 90}°`, x + size / 2, y0 + size + u * 5, { size: 3.6, font: 'mono', color: s.c('--ink-2') });
        });
        if (i === 0) s.alpha(s.ease('why', 0.5), () => s.rrect(x - u, y0 - u, size + 2 * u, size + 2 * u, 1.5, { stroke: s.c('green'), lw: 0.7 }));
      }
      s.text('which way is up?', w / 2, y0 - u * 6, { size: 4.2, font: 'display', weight: 600 });
      s.alpha(s.ease('why', 0.5), () => s.text('needs skies, legs and wheels', w / 2, y0 + size + u * 13, { size: 3.6, italic: true, color: s.c('--ink-2') }));
    });
    // The linear probe.
    const pa = s.win('point');
    if (pa > 0) {
      s.alpha(pa, () => {
        const cy = ay + ah * (s.tall ? 0.42 : 0.45);
        const size = Math.min(aw * 0.15, ah * 0.3);
        const xImg = ax + u * 1;
        if (cs) drawPhoto(s, photo(cs, 3, 1), xImg, cy - size / 2, size, 'orange', 0.5);
        const bw = Math.min(aw * 0.16, u * 22);
        const bh = Math.min(ah * 0.3, u * 20);
        const fx = xImg + size + u * 4 + bw / 2;
        s.arrow(xImg + size + u, cy, fx - bw / 2 - u, cy, s.c('--ink-3'), 0.35, 1.6);
        const frozen = s.ease('probe', 0.6);
        box(s, fx, cy, bw, bh, 'f', 'blue', { italic: true, size: 7, on: 0.6 });
        s.alpha(frozen, () => lock(s, fx + bw / 2 - u * 2.6, cy - bh / 2 + u * 2.6, u * 3, 'blue'));
        s.alpha(frozen, () => s.text('frozen', fx, cy + bh / 2 + u * 4, { size: 3.2, font: 'ui', color: s.c('blue') }));
        // Feature column.
        const fxc = fx + bw / 2 + u * 6;
        const nf = 6;
        const ch = Math.min(bh / nf, u * 4);
        s.arrow(fx + bw / 2 + u, cy, fxc - u, cy, s.c('--ink-3'), 0.35, 1.6);
        for (let i = 0; i < nf; i++) s.cell(fxc, cy - (nf * ch) / 2 + i * ch, ch * 1.4, ch, '', 'purple', { on: 0.2 + 0.6 * ((i * 37) % 10) / 10 });
        s.text('features', fxc + ch * 0.7, cy + (nf * ch) / 2 + u * 4, { size: 3.2, font: 'ui', color: s.c('purple') });
        // W, b.
        const trainA = s.ease('probe', 0.6, 0.8);
        const wx = fxc + ch * 1.4 + u * 5 + bw * 0.35;
        s.arrow(fxc + ch * 1.4 + u, cy, wx - bw * 0.35 - u, cy, s.c('--ink-3'), 0.35, 1.6);
        s.alpha(0.3 + 0.7 * trainA, () => box(s, wx, cy, bw * 0.7, bh * 0.6, 'W, b', 'slate', { size: 4.2, on: 0.4 + 0.6 * s.ease('meaning', 0.5) }));
        s.alpha(trainA, () => s.text('trained', wx, cy + bh * 0.3 + u * 4, { size: 3.2, font: 'ui', color: s.c('slate') }));
        // Class scores.
        const sx = wx + bw * 0.35 + u * 4;
        const bars = [0.2, 0.75, 0.3, 0.15];
        const names = ['dog', 'cat', 'car', 'ship'];
        const bwid = Math.min((ax + aw - sx - u * 2) * 0.9, u * 22);
        s.alpha(trainA, () => {
          s.arrow(wx + bw * 0.35 + u, cy, sx - u, cy, s.c('--ink-3'), 0.35, 1.6);
          bars.forEach((v, i) => {
            const y = cy - u * 9 + i * u * 5;
            s.rrect(sx, y, Math.max(2, v * bwid), u * 3.6, 0.6, { fill: s.tint(i === 1 ? 'gold' : '--ink-3', i === 1 ? 0.8 : 0.35) });
            s.text(names[i]!, sx + Math.max(2, v * bwid) + u, y + u * 1.8, { size: 3, font: 'ui', align: 'left', color: s.c('--ink-2') });
          });
        });
        s.alpha(s.ease('acc', 0.6), () => {
          pill(s, 'test accuracy of the probe = the grade', w / 2, ay + ah * 0.86, 'gold', { size: 3.6 });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- views

const viewsScene: SceneDef = {
  marks: {
    cos: { tex: String.raw`\symz_1 \cdot \symz_2 = \cos\theta`, x: 0.5, y: 0.2, size: 5.5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const [ax, ay, aw, ah] = area(s);
    const cs = cifar(s);
    const part1 = s.win('idea', 'norm');
    if (part1 > 0 && cs) {
      const cat = photo(cs, 3, 4);
      const vc = views(cat, 'cat', 5);
      s.alpha(part1, () => {
        const tall = s.tall;
        // Images: the original and its two views.
        const size = tall ? Math.min(aw * 0.27, ah * 0.25) : Math.min(aw * 0.17, ah * 0.36);
        const ox = tall ? ax + aw * 0.06 : ax;
        const oy = tall ? ay + size * 0.4 : ay + ah * 0.25;
        drawPhoto(s, cat, ox, oy, size);
        s.text('x', ox + size / 2, oy + size + u * 4, { size: 4.2, italic: true, weight: 600, color: s.c('orange') });
        const cropA = s.ease('crop', 0.6);
        s.alpha(cropA, () => {
          vc.crop.forEach(([bx, by, bw, bh], q) => {
            const k = size / SIDE;
            s.ctx.save();
            s.ctx.setLineDash(q ? [u, u * 0.7] : []);
            s.rrect(ox + bx * k, oy + by * k, bw * k, bh * k, 0.3, { stroke: s.c(q ? 'teal' : 'orange'), lw: 0.5 });
            s.ctx.restore();
          });
        });
        const vx = ox + size + (tall ? aw * 0.12 : u * 9);
        const colA = s.ease('color', 0.7);
        const vs = size * 0.85;
        for (let q = 0; q < 2; q++) {
          const y = oy + size / 2 + (q ? u * 1.5 : -vs - u * 1.5);
          const a = s.ease('idea', 0.5, 0.4 + 0.4 * q);
          s.alpha(a, () => {
            s.arrow(ox + size + u, oy + size / 2, vx - u, y + vs / 2, s.c('--ink-3'), 0.3, 1.4);
            drawPhoto(s, cropA > 0.5 ? (colA > 0.5 ? vc.colored[q]! : vc.plain[q]!) : cat, vx, y, vs, 'gold', 0.4);
            s.text(q ? 'x2' : 'x1', vx + vs + u * 2, y + vs / 2, { size: 3.6, font: 'mono', weight: 600, align: 'left', color: s.c('orange') });
          });
        }
        // The embedding circle: pull the pair together, push the car away.
        const ra = s.win('rule', 'teacher');
        if (ra > 0) {
          s.alpha(ra, () => {
            const R = tall ? Math.min(aw * 0.22, ah * 0.2) : Math.min(aw * 0.17, ah * 0.3);
            const cx = tall ? w / 2 : ax + aw * 0.78;
            const cy = tall ? ay + ah * 0.72 : ay + ah * 0.48;
            unitCircle(s, cx, cy, R);
            const t = s.ease('rule', 1.4, 0.6);
            const c1 = lerp(0.6, 1.0, t);
            const c2 = lerp(1.9, 1.15, t);
            const car1 = lerp(1.6, 3.9, t);
            const car2 = lerp(2.4, 4.3, t);
            const p1 = onCircle(s, cx, cy, R, c1, 'purple');
            const p2 = onCircle(s, cx, cy, R, c2, 'purple', { ring: true });
            onCircle(s, cx, cy, R, car1, 'slate');
            onCircle(s, cx, cy, R, car2, 'slate', { ring: true });
            const lab = (t: string, a: number, k: K) => s.text(t, cx + (R + u * 6) * Math.cos(a), cy - (R + u * 5) * Math.sin(a), { size: 3.2, font: 'ui', weight: 600, color: s.c(k), halo: true });
            lab('cat', (c1 + c2) / 2, 'purple');
            lab('car', (car1 + car2) / 2, 'slate');
            void p1;
            void p2;
            s.alpha(s.ease('nolabel', 0.5), () => {
              const mx = cx + R * 0.45 * Math.cos(1.08), my = cy - R * 0.45 * Math.sin(1.08);
              s.text('pull together', mx, my, { size: 3, font: 'ui', color: s.c('green'), halo: true });
              const nx = cx + R * 0.35 * Math.cos(2.6), ny = cy - R * 0.35 * Math.sin(2.6);
              s.text('push apart', nx, ny + u * 6, { size: 3, font: 'ui', color: s.c('red'), halo: true });
            });
          });
        }
        s.alpha(s.win('teacher', 'norm'), () => pill(s, 'augmentations decide what to ignore', w / 2, tall ? ay + ah * 0.72 : ay + ah * 0.85, 'orange', { size: 3.6 }));
      });
    }
    // Part 2: unit vectors and the cosine.
    const p2 = s.win('norm');
    if (p2 > 0) {
      s.alpha(p2, () => {
        const R = Math.min(aw * 0.3, ah * 0.32);
        const cx = w / 2;
        const cy = ay + ah * 0.6;
        unitCircle(s, cx, cy, R);
        // The angle opens during "cos" from 20 to 180 degrees, then settles.
        const sweep = s.ease('cos', 4, 1.2);
        const back = s.ease('sphere', 1.2);
        const th = lerp(lerp(0.35, Math.PI, sweep), 0.6, back);
        const a1 = 0.5;
        const a2 = a1 + th;
        s.arrow(cx, cy, cx + R * Math.cos(a1), cy - R * Math.sin(a1), s.c('purple'), 0.6, 2.4);
        s.arrow(cx, cy, cx + R * Math.cos(a2), cy - R * Math.sin(a2), s.c('purple'), 0.6, 2.4);
        s.text('z1', cx + (R + u * 5) * Math.cos(a1), cy - (R + u * 5) * Math.sin(a1), { size: 3.6, font: 'mono', weight: 600, color: s.c('purple'), halo: true });
        s.text('z2', cx + (R + u * 5) * Math.cos(a2), cy - (R + u * 5) * Math.sin(a2), { size: 3.6, font: 'mono', weight: 600, color: s.c('purple'), halo: true });
        const c = s.ctx;
        c.beginPath();
        c.arc(cx, cy, R * 0.25, -a2, -a1);
        c.strokeStyle = s.c('--ink-2');
        c.lineWidth = u * 0.3;
        c.stroke();
        s.text('length 1', cx + R * 0.55 * Math.cos(a1) + u * 2, cy - R * 0.55 * Math.sin(a1) + u * 4, { size: 3, font: 'ui', color: s.c('--ink-3'), halo: true });
        s.show('cos', s.ease('cos', 0.5) * (1 - back));
        s.alpha(s.ease('cos', 0.5), () => s.text(`cos θ = ${fmt(Math.cos(th), 2)}`, cx, cy + R + u * 7, { size: 4, font: 'mono', weight: 600, color: s.c('--ink') }));
        s.alpha(back, () => s.text('on a sphere, similarity is an angle', w / 2, ay + ah * 0.08, { size: 3.8, font: 'ui', weight: 600, color: s.c('--ink-2') }));
      });
    }
    void h;
  },
};

// ---------------------------------------------------------------- InfoNCE

const NB = 5;
const TAU = 0.2;
const A1 = [0.3, 1.5, 2.7, 3.9, 5.1];
const A2 = [0.55, 1.2, 3.0, 4.4, 4.85];
const SIM: number[] = [];
const PROB: number[] = [];
for (let i = 0; i < NB; i++) {
  const row = A2.map((b) => Math.cos(A1[i]! - b) / TAU);
  const mx = Math.max(...row);
  const e = row.map((v) => Math.exp(v - mx));
  const z = e.reduce((a, b) => a + b, 0);
  SIM.push(...row);
  PROB.push(...e.map((v) => v / z));
}
const LOSS_ROWS = Array.from({ length: NB }, (_, i) => -Math.log(PROB[i * NB + i]!));

const infonce: SceneDef = {
  marks: {
    eq: { tex: String.raw`\symL = -\frac{1}{N}\sum_{i} \log \frac{e^{\symS_{ii}}}{\sum_{j} e^{\symS_{ij}}}`, x: 0.5, y: 0.17, size: 5.4 },
  },
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s);
    const showEq = s.ease('name', 0.6);
    const top = ay + ah * 0.2;
    const lossCol = s.ease('ce', 0.6);
    const cell = Math.min((aw - u * 34) / (NB + 1.6), (ay + ah - top - u * 22) / NB);
    const mw = cell * NB;
    const mx = ax + (aw - mw - u * 14 - cell * 1.3) / 2 + u * 14;
    const my = top + u * 6;
    s.show('eq', showEq);
    // Labels.
    for (let i = 0; i < NB; i++) {
      const k = CLASS_COLORS[i]!;
      s.alpha(s.ease('table', 0.4, 0.2 * i), () => s.text(`z1[${i}]`, mx - u * 2, my + i * cell + cell / 2, { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c(k) }));
      s.alpha(s.ease('table', 0.4, 1 + 0.2 * i), () => s.text(`z2[${i}]`, mx + i * cell + cell / 2, my - u * 3, { size: cell < u * 11 ? 2.6 : 3.2, font: 'mono', weight: 600, color: s.c(k) }));
    }
    const fillT = s.span('S', 'right');
    const toP = s.ease('softmax', 0.9);
    const uniform = s.ease('logN', 0.8);
    const hi = s.since('weights') >= 0 && s.since('pull') < 0 ? 2 : -1;
    const val = (i: number, j: number) => lerp(lerp(SIM[i * NB + j]! * TAU, PROB[i * NB + j]!, toP), 1 / NB, uniform);
    const vals = Array.from({ length: NB * NB }, (_, q) => val(Math.floor(q / NB), q % NB));
    heat(s, mx, my, cell, vals, NB, NB, {
      k: 'teal',
      norm: (v) => (toP > 0.5 ? v : (v + 1) / 2),
      label: (v) => (toP > 0.5 ? `${Math.round(v * 100)}` : fmt(v / TAU, 1)),
      a: (i, j) => clamp01(fillT * (NB * NB + 4) - (i * NB + j)),
      diag: s.ease('right', 0.5),
      hiRow: hi,
      size: Math.min(3.2, (cell / u) * 0.3),
    });
    s.alpha(s.ease('S', 0.5) * (1 - toP), () => s.text('S = z1 · z2 / τ', mx + mw / 2, my + mw + u * 5, { size: 3.4, font: 'mono', color: s.c('teal') }));
    s.alpha(toP * (1 - uniform) * (1 - s.win('weights', 'pull')), () => s.text('P = softmax of each row, in %', mx + mw / 2, my + mw + u * 5, { size: 3.4, font: 'mono', color: s.c('teal') }));
    // The loss column.
    s.alpha(lossCol, () => {
      const lx = mx + mw + u * 3;
      s.text('−log P', lx + cell * 0.6, my - u * 3, { size: 3, font: 'mono', weight: 600, color: s.c('red') });
      for (let i = 0; i < NB; i++) {
        const v = lerp(LOSS_ROWS[i]!, Math.log(NB), uniform);
        s.cell(lx, my + i * cell + cell * 0.12, cell * 1.2, cell * 0.76, fmt(v, 2), 'red', { on: 0.2, size: Math.min(3, (cell / u) * 0.28) });
      }
      const mean = lerp(LOSS_ROWS.reduce((a, b) => a + b, 0) / NB, Math.log(NB), uniform);
      s.text(uniform > 0.5 ? `loss = log 5 = ${fmt(mean, 3)}` : `loss = mean = ${fmt(mean, 3)}`, w / 2, my + mw + u * 11, { size: 3.6, font: 'mono', weight: 600, color: s.c('red') });
    });
    // Pull and push.
    s.alpha(s.win('pull', 'logN'), () => {
      const i = 2;
      const cxp = mx + i * cell + cell / 2;
      const cyp = my + i * cell + cell / 2;
      s.circle(cxp, cyp, cell * 0.42, { stroke: s.c('green'), lw: 0.6 });
      for (const j of [0, 1, 3, 4]) s.circle(mx + j * cell + cell / 2, cyp, cell * 0.36, { stroke: s.tint('red', 0.8), lw: 0.4 });
      s.text('pull', cxp, cyp - cell * 0.62, { size: 3, font: 'ui', weight: 600, color: s.c('green'), halo: true });
      s.text('push', mx + 4 * cell + cell / 2, cyp - cell * 0.62, { size: 3, font: 'ui', weight: 600, color: s.c('red'), halo: true });
    });
    s.alpha(s.win('weights', 'pull'), () => pill(s, 'each row: a classifier with weights z2', mx + mw / 2, my + mw + u * 5, 'purple', { size: 3.2 }));
  },
};

// ---------------------------------------------------------------- temperature

const COS = [0.75, 0.7, 0.5, 0.3, 0.1, -0.1, -0.4, -0.8];

function tauAt(s: Scene): number {
  const lg = (v: number) => Math.log(v);
  let t = lg(0.5);
  if (s.since('large') >= 0) t = lerp(lg(0.5), lg(2), s.ease('large', 1.2));
  if (s.since('lower') >= 0) t = lerp(lg(2), lg(0.05), smooth(s.prog('lower')));
  if (s.since('values') >= 0) t = lerp(lg(0.05), lg(0.07), s.ease('values', 0.8));
  return Math.exp(t);
}

const temperature: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s);
    // Part 1: the range problem.
    s.alpha(s.win('narrow', 'grad'), () => {
      const y1 = ay + ah * 0.32;
      const y2 = ay + ah * 0.66;
      const L = aw * 0.8;
      const x0 = w / 2 - L / 2;
      const scale = s.ease('small', 1.2);
      const half = lerp(0.1, 0.5, 1) * L;
      s.text('cosines', w / 2, y1 - u * 9, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
      s.line(w / 2 - half * 0.2, y1, w / 2 + half * 0.2, y1, s.c('purple'), 0.8);
      s.text('−1', w / 2 - half * 0.2, y1 + u * 5, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      s.text('1', w / 2 + half * 0.2, y1 + u * 5, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      s.alpha(scale, () => {
        s.text('divided by τ = 0.1', w / 2, y2 - u * 9, { size: 3.6, font: 'mono', color: s.c('slate') });
        s.line(x0, y2, x0 + L, y2, s.c('teal'), 0.8);
        s.text('−10', x0, y2 + u * 5, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        s.text('10', x0 + L, y2 + u * 5, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        s.arrow(w / 2 - half * 0.2, y1 + u * 2, x0 + u, y2 - u * 2, s.tint('--ink-3', 0.6), 0.25, 1.4);
        s.arrow(w / 2 + half * 0.2, y1 + u * 2, x0 + L - u, y2 - u * 2, s.tint('--ink-3', 0.6), 0.25, 1.4);
      });
    });
    // Part 2: one row's softmax as tau moves.
    const p2 = s.win('grad');
    if (s.since('grad') < 0) s.slot('tau', s.since('small') >= 0 ? '0.1' : '1.0');
    if (p2 > 0) {
      const tau = tauAt(s);
      if (s.since('grad') >= 0) s.slot('tau', fmt(tau, 2));
      const sc = COS.map((c) => c / tau);
      const mx = Math.max(...sc);
      const e = sc.map((v) => Math.exp(v - mx));
      const z = e.reduce((a, b) => a + b, 0);
      const P = e.map((v) => v / z);
      s.alpha(p2, () => {
        const n = COS.length;
        const base = ay + ah * 0.78;
        const top = ay + ah * 0.22;
        const bw = aw / n;
        const pushA = s.ease('push', 0.6);
        P.forEach((p, j) => {
          const x = ax + j * bw + bw * 0.18;
          const hgt = p * (base - top);
          const k: K = j === 0 ? 'gold' : pushA > 0.5 ? 'red' : 'teal';
          s.rrect(x, base - hgt, bw * 0.64, Math.max(1, hgt), 0.6, { fill: s.tint(k, 0.75) });
          s.text(`${Math.round(p * 100)}%`, x + bw * 0.32, base - hgt - u * 3, { size: 2.9, font: 'mono', color: s.c('--ink-2') });
          s.text(fmt(COS[j]!, 2), x + bw * 0.32, base + u * 4, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
        });
        s.line(ax, base, ax + aw, base, s.c('--axis'), 0.3);
        s.text('cosine with the anchor', w / 2, base + u * 9, { size: 3.2, font: 'ui', color: s.c('--ink-3') });
        s.text('partner', ax + bw * 0.5, base - P[0]! * (base - top) - u * 7.5, { size: 3, font: 'ui', weight: 600, color: s.c('gold'), halo: true });
        s.text(`τ = ${fmt(tau, 2)}`, ax + aw - u, top - u * 6, { size: 4.2, font: 'mono', weight: 600, align: 'right', color: s.c('slate') });
        s.alpha(s.ease('grad', 0.6) * (1 - pushA), () => s.text('gradient = P − one-hot', w / 2, ay + ah * 0.08, { size: 3.8, font: 'mono', color: s.c('--ink-2') }));
        s.alpha(pushA, () => {
          const neg = P.slice(1);
          const tot = neg.reduce((a, b) => a + b, 0);
          s.text(`hardest negative's share of the push: ${Math.round((100 * neg[0]!) / tot)}%`, w / 2, ay + ah * 0.08, { size: 3.6, font: 'mono', weight: 600, color: s.c('red') });
        });
      });
    }
  },
};

export const scenesA: Record<string, SceneDef> = { intro, probe, views: viewsScene, infonce, temperature };
