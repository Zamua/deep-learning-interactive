import { CLASS_COLORS } from '../../core/plot';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { GRID, type Img, NPATCH, PATCH, drawImg, imgCanvas, maskFromOrder, naiveFill } from '../../lib/contrastive-aug';
import { type ShapeImage, drawShape, makeSet } from '../../lib/contrastive-clip';
import { makeToy } from '../../lib/contrastive-toy';
import { CLIP_ZS, CLIP_ZS_S, CLIP_ZS_TAU, DINO_RUNS } from './data';
import { type K, area, box, check, cifar, cross, drawPhoto, pill, photo } from './kit';

// ---------------------------------------------------------------- zero-shot

let GRID24: ShapeImage[] | null = null;
const grid24 = () => (GRID24 ??= makeSet(1, 78));
const PROMPTS = ['a circle', 'a square', 'a triangle'];
const SEL = 9;

const zeroshot: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s);
    const tall = s.tall;
    const imgs = grid24();
    // Prompts.
    const pa = s.ease('prompts', 0.5);
    const px = tall ? ax + aw * 0.2 : ax + aw * 0.13;
    const py0 = tall ? ay + ah * 0.08 : ay + ah * 0.18;
    s.alpha(s.win('free', 'prompts'), () => s.text('a classifier with no training', w / 2, ay + ah * 0.4, { size: 5, font: 'display', weight: 600 }));
    s.alpha(pa, () => {
      PROMPTS.forEach((p, c) => {
        const y = py0 + c * u * 8;
        pill(s, `"${p}"`, px, y, CLASS_COLORS[c]!, { size: 3.4, font: 'mono' });
      });
    });
    // Text encoder -> weight rows.
    const ea = s.ease('embed', 0.6);
    s.alpha(ea, () => {
      const bx = tall ? ax + aw * 0.58 : ax + aw * 0.36;
      const by = py0 + u * 8;
      const bw = Math.min(aw * 0.22, u * 24);
      box(s, bx, by, bw, u * 10, 'text encoder', 'blue', { size: 3.2 });
      s.arrow(px + u * 13, by, bx - bw / 2 - u, by, s.c('--ink-3'), 0.35, 1.6);
      // Three weight rows t_c.
      const rx = bx + bw / 2 + u * 4;
      const cw = Math.min(u * 4, (ax + aw - rx - u * 6) / 6);
      PROMPTS.forEach((_, c) => {
        for (let q = 0; q < 5; q++) s.cell(rx + q * cw, by - u * 7 + c * u * 5, cw, u * 4.2, '', 'green', { on: 0.15 + 0.6 * (((c + 1) * (q + 2) * 7) % 10) / 10 });
        s.circle(rx - u * 2, by - u * 4.9 + c * u * 5, u * 0.9, { fill: s.c(CLASS_COLORS[c]!) });
      });
      s.text('t, one row per class: the weights', rx + cw * 2.5, by + u * 10, { size: 2.9, font: 'ui', color: s.c('green') });
    });
    // The images and their predictions.
    const ia = s.ease('image', 0.6);
    s.alpha(ia, () => {
      const cols = 8;
      const gy = tall ? ay + ah * 0.42 : ay + ah * 0.5;
      const gap = u * 1.2;
      const size = Math.min((aw * (tall ? 1 : 0.62) - gap * (cols - 1)) / cols, u * 9);
      const gx = tall ? ax + (aw - (size * cols + gap * (cols - 1))) / 2 : ax;
      imgs.forEach((im, i) => {
        const x = gx + (i % cols) * (size + gap);
        const y = gy + Math.floor(i / cols) * (size + gap);
        const a = clamp01(s.since('image') * 6 - i * 0.12);
        s.alpha(a, () => {
          drawShape(s.ctx, im, x, y, size);
          s.rrect(x - 1, y - 1, size + 2, size + 2, 0.5, { stroke: s.c(CLASS_COLORS[CLIP_ZS[i]!]!), lw: i === SEL ? 0.8 : 0.45 });
          const ok = CLIP_ZS[i] === im.shape;
          if (ok) check(s, x + size - u * 0.6, y + u * 0.6, u * 1.2);
          else cross(s, x + size - u * 0.6, y + u * 0.6, u * 1.2);
        });
      });
    });
    s.alpha(s.win('image', 'zero'), () => {
      const cols = 8;
      const gy = tall ? ay + ah * 0.42 : ay + ah * 0.5;
      const gap = u * 1.2;
      const size = Math.min((aw * (tall ? 1 : 0.62) - gap * (cols - 1)) / cols, u * 9);
      // Bars for one image.
      const S = PROMPTS.map((_, c) => CLIP_ZS_S[SEL * 3 + c]! / CLIP_ZS_TAU);
      const mx = Math.max(...S);
      const e = S.map((v) => Math.exp(v - mx));
      const z = e.reduce((a, b) => a + b, 0);
      const bx = tall ? ax + aw * 0.3 : ax + aw * 0.66 + u * 11;
      const by = tall ? gy + 3 * (size + gap) + u * 5 : gy;
      const bmax = tall ? aw * 0.5 : Math.max(u * 6, ax + aw - bx - u * 24);
      drawShape(s.ctx, imgs[SEL]!, bx - u * 11, by, u * 9);
      PROMPTS.forEach((p, c) => {
        const y = by + c * u * 5 + u * 0.5;
        const v = e[c]! / z;
        s.rrect(bx, y, Math.max(u * 0.4, v * bmax), u * 3.6, 0.6, { fill: s.tint(CLASS_COLORS[c]!, 0.75) });
        s.text(`${p} ${Math.round(v * 100)}%`, bx + Math.max(u * 0.4, v * bmax) + u * 1.5, y + u * 1.9, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-2') });
      });
    });
    const acc = CLIP_ZS.filter((p, i) => p === imgs[i]!.shape).length / imgs.length;
    s.alpha(s.win('zero', 'result'), () => {
      pill(s, '0 labeled examples per class', w / 2, ay + ah * 0.97 - u * 9, 'green', { size: 3.4 });
      pill(s, `toy zero-shot accuracy ${Math.round(acc * 100)}%  (chance 33%)`, w / 2, ay + ah * 0.97 - u * 2, 'gold', { size: 3.2, font: 'mono' });
    });
    s.alpha(s.win('result', 'wording'), () => pill(s, 'ImageNet, zero-shot: 76.2%, like a supervised ResNet-50', w / 2, ay + ah * 0.97 - u * 2, 'gold', { size: 3.2 }));
    s.alpha(s.win('wording', 'uses'), () => {
      pill(s, '"a photo of a {label}."  +1.3', w / 2, ay + ah * 0.97 - u * 9, 'green', { size: 3.2, font: 'mono' });
      pill(s, 'average of 80 templates  +3.5 more', w / 2, ay + ah * 0.97 - u * 2, 'green', { size: 3.2, font: 'mono' });
    });
    s.alpha(s.ease('uses', 0.6), () => {
      pill(s, 'Stable Diffusion: CLIP text encoder', w / 2, ay + ah * 0.97 - u * 9, 'blue', { size: 3.2 });
      pill(s, 'vision-language models: CLIP image encoder', w / 2, ay + ah * 0.97 - u * 2, 'blue', { size: 3.2 });
    });
  },
};

// ---------------------------------------------------------------- MAE

const ORDER: number[] = (() => {
  const r = new Rng(13);
  const noise = Array.from({ length: NPATCH }, () => r.next());
  return Array.from({ length: NPATCH }, (_, i) => i).sort((a, b) => noise[a]! - noise[b]!);
})();
let fills: { q25: Img; q75: Img } | null = null;

function drawMasked(s: Scene, img: Img, x: number, y: number, size: number, keep: Set<number>, hiddenA: number, outline = 0): void {
  drawImg(s.ctx, img, x, y, size);
  const ps = size / GRID;
  for (let k = 0; k < NPATCH; k++) {
    if (keep.has(k)) continue;
    const px = x + (k % GRID) * ps;
    const py = y + Math.floor(k / GRID) * ps;
    s.ctx.fillStyle = s.tint('--paper-2', hiddenA);
    s.ctx.fillRect(px, py, ps + 0.5, ps + 0.5);
    if (outline > 0) s.alpha(outline, () => s.rrect(px + 1, py + 1, ps - 2, ps - 2, 0.2, { stroke: s.c('red'), lw: 0.25 }));
  }
  s.rrect(x, y, size, size, 0.4, { stroke: s.c('--rule'), lw: 0.3 });
}

const mae: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s);
    const cs = cifar(s);
    if (!cs) return;
    const img = photo(cs, 2, 5);
    const tall = s.tall;
    // Masking: patches disappear one by one through the "mae" beat.
    const hidden = Math.round(lerp(0, 48, s.ease('mae', 2.4, 0.8)));
    const keep = new Set(ORDER.slice(0, NPATCH - hidden));
    const main = s.win('back', 'why');
    s.alpha(main, () => {
      const size = tall ? Math.min(aw * 0.42, ah * 0.36) : Math.min(aw * 0.28, ah * 0.5);
      const x = tall ? ax + aw * 0.04 : ax + aw * 0.02;
      const y = tall ? ay + ah * 0.04 : ay + ah * 0.18;
      drawMasked(s, img, x, y, size, keep, 0.96, s.ease('loss', 0.5));
      s.text(`${NPATCH - hidden} of ${NPATCH} patches visible`, x + size / 2, y + size + u * 4, { size: 3.2, font: 'mono', color: s.c(hidden ? 'orange' : '--ink-2') });
      // Encoder on the visible tokens only.
      const ea = s.ease('enc', 0.6);
      const rx = tall ? ax : x + size + u * 8;
      const ry = tall ? y + size + u * 12 : y + u * 2;
      const tw = tall ? (aw - u * 2) / 16 : Math.min((ax + aw - rx) / 16, u * 3.6);
      s.alpha(ea, () => {
        const src = imgCanvas(img);
        ORDER.slice(0, 16).forEach((k, i) => {
          const sx = (k % GRID) * PATCH, sy = Math.floor(k / GRID) * PATCH;
          s.ctx.save();
          s.ctx.imageSmoothingEnabled = false;
          s.ctx.drawImage(src, sx, sy, PATCH, PATCH, rx + i * tw, ry, tw - 1, tw - 1);
          s.ctx.restore();
          s.rrect(rx + i * tw, ry, tw - 1, tw - 1, 0.2, { stroke: s.c('orange'), lw: 0.25 });
        });
        box(s, rx + (16 * tw) / 2, ry + tw + u * 8, s.measure('ViT encoder: 16 tokens', { font: 'ui', size: 3.2, weight: 650 }) + u * 5, u * 8, 'ViT encoder: 16 tokens', 'blue', { size: 3.2 });
      });
      // Decoder: encoded tokens plus mask tokens.
      const da = s.ease('dec', 0.6);
      const dy = ry + tw + u * 18;
      const dw = tall ? (aw - u * 2) / 64 : Math.min((ax + aw - rx) / 64, u * 1);
      s.alpha(da, () => {
        for (let i = 0; i < 64; i++) {
          const vis = keep.has(i);
          s.ctx.fillStyle = vis ? s.tint('orange', 0.7) : s.tint('--ink-3', 0.45);
          s.ctx.fillRect(rx + i * dw, dy, Math.max(1, dw - 0.5), u * 4);
        }
        s.text('16 encoded + 48 mask tokens', rx + (64 * dw) / 2, dy + u * 7.5, { size: 3, font: 'ui', color: s.c('--ink-2') });
        box(s, rx + (64 * dw) / 2, dy + u * 15, s.measure('small decoder: predict pixels', { font: 'ui', size: 3, weight: 650 }) + u * 5, u * 8, 'small decoder: predict pixels', 'blue', { size: 3, on: 0.3 });
      });
      s.alpha(s.ease('loss', 0.5), () => s.text('loss: hidden patches only', x + size / 2, y + size + u * 9, { size: 3.2, font: 'ui', weight: 600, color: s.c('red') }));
    });
    // Why 75%: BERT 15% vs MAE 75%.
    s.alpha(s.win('why', 'naive'), () => {
      const y = ay + ah * 0.4;
      s.text('BERT hides 15% of words', w / 2, y - u * 6, { size: 4.2, font: 'display', weight: 600, color: s.c('--ink-2') });
      s.text('MAE hides 75% of patches', w / 2, y + u * 6, { size: 4.2, font: 'display', weight: 600, color: s.c('orange') });
      s.text('a patch looks like its neighbors', w / 2, y + u * 16, { size: 3.4, italic: true, color: s.c('--ink-2') });
    });
    // Naive fills at 25% and 75% hidden.
    const na = s.win('naive', 'cheap');
    if (na > 0) {
      if (!fills) {
        const k25 = maskFromOrder(ORDER, 0.25).keep;
        const k75 = maskFromOrder(ORDER, 0.75).keep;
        fills = { q25: naiveFill(img, k25), q75: naiveFill(img, k75) };
      }
      const f = fills;
      s.alpha(na, () => {
        const size = tall ? Math.min(aw * 0.3, ah * 0.34) : Math.min(aw * 0.2, ah * 0.36);
        const gap = u * 3;
        const x0 = w / 2 - (size * 3 + gap * 2) / 2;
        const rows: [string, number, Img, number][] = [
          ['25% hidden', 0.25, f.q25, s.ease('naive', 0.5)],
          ['75% hidden', 0.75, f.q75, s.ease('hard', 0.5)],
        ];
        rows.forEach(([lab, ratio, fill, a], r) => {
          const y = ay + ah * 0.08 + r * (size + u * 12);
          s.alpha(a, () => {
            const kp = new Set(maskFromOrder(ORDER, ratio).keep);
            drawPhoto(s, img, x0, y, size);
            drawMasked(s, img, x0 + size + gap, y, size, kp, 0.96);
            drawPhoto(s, fill, x0 + 2 * (size + gap), y, size);
            s.text(lab, x0 + size * 1.5 + gap, y + size + u * 4, { size: 3.2, font: 'mono', color: s.c('orange') });
            s.text('naive fill', x0 + size * 2.5 + 2 * gap, y + size + u * 4, { size: 3.2, font: 'ui', color: s.c('--ink-2') });
          });
        });
      });
    }
    // Cheaper encoder, then the result.
    s.alpha(s.win('cheap', 'result'), () => {
      const y = ay + ah * 0.35;
      const bw = aw * 0.7;
      s.text('tokens through the big encoder', w / 2, y - u * 8, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
      s.rrect(w / 2 - bw / 2, y, bw, u * 5, 0.8, { fill: s.tint('--ink-3', 0.35) });
      s.text('64: a plain ViT', w / 2 - bw / 2 + u * 2, y + u * 2.6, { size: 3, font: 'mono', align: 'left', color: s.c('--ink') });
      s.rrect(w / 2 - bw / 2, y + u * 8, bw / 4, u * 5, 0.8, { fill: s.tint('orange', 0.75) });
      s.text('16: MAE', w / 2 - bw / 2 + bw / 4 + u * 2, y + u * 10.6, { size: 3, font: 'mono', align: 'left', color: s.c('orange') });
      s.text('about 3× faster training', w / 2, y + u * 22, { size: 4, font: 'display', weight: 600 });
    });
    s.alpha(s.ease('result', 0.6), () => {
      const y = ay + ah * 0.45;
      pill(s, 'weaker under a linear probe', w / 2, y - u * 6, '--ink-3', { size: 3.4 });
      pill(s, '87.8% on ImageNet after fine-tuning (ViT-Huge)', w / 2, y + u * 4, 'gold', { size: 3.4 });
    });
  },
};

// ---------------------------------------------------------------- DINO

const TOY = makeToy();
const LOGITS = [1.0, 0.55, 0.85, 0.2, 0.4, 0.65];
const CENTER = [0.7, 0.45, 0.6, 0.35, 0.4, 0.5];
const softmax = (v: number[], T: number) => {
  const mx = Math.max(...v.map((x) => x / T));
  const e = v.map((x) => Math.exp(x / T - mx));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / z);
};

function bars(s: Scene, x: number, y: number, w: number, h: number, p: number[], label: string, k: K): void {
  const bw = w / p.length;
  p.forEach((v, i) => s.rrect(x + i * bw + bw * 0.15, y + h - v * h, bw * 0.7, Math.max(1, v * h), 0.4, { fill: s.tint(CLASS_COLORS[i]!, 0.8) }));
  s.line(x, y + h, x + w, y + h, s.c('--axis'), 0.25);
  s.text(label, x + w / 2, y + h + s.u * 3.5, { size: 2.9, font: 'mono', color: s.c(k) });
}

function plane(s: Scene, x: number, y: number, size: number, run: number, label: string, on: number): void {
  const d = DINO_RUNS[run]![1]!;
  s.rrect(x, y, size, size, 1, { fill: s.tint('--paper', 0.6), stroke: s.tint(on > 0.5 ? '--ink' : '--rule', 0.8), lw: 0.25 + 0.4 * on });
  const X = (v: number) => x + ((v + 1.25) / 2.5) * size;
  const Y = (v: number) => y + size - ((v + 1.2) / 2.4) * size;
  for (let i = 0; i < TOY.n; i++) {
    const a = 0.15 + 0.85 * clamp01((d.conf[i]! - 1 / 6) / (5 / 6));
    s.circle(X(TOY.X[i * 6]!), Y(TOY.X[i * 6 + 1]!), Math.max(1.2, size * 0.014), { fill: s.tint(CLASS_COLORS[d.arg[i]!]!, a) });
  }
  s.text(label, x + size / 2, y + size + s.u * 4, { size: 3, font: 'ui', weight: on > 0.5 ? 650 : 450, color: s.c(on > 0.5 ? '--ink' : '--ink-3') });
}

const dino: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s);
    const cs = cifar(s);
    const tall = s.tall;
    // Student and teacher.
    const top = s.win('third', 'nocenter');
    s.alpha(top, () => {
      const by = ay + ah * 0.32;
      const bw = Math.min(aw * 0.26, u * 26);
      const bh = u * 11;
      const xs = w / 2 - bw * 0.95;
      const xt = w / 2 + bw * 0.95;
      const isz = Math.min(u * 13, ah * 0.16);
      if (cs) {
        const im = photo(cs, 5, 2);
        {
          // Teacher: a large crop (the whole image); student: a small one.
          drawPhoto(s, im, xt - isz / 2, ay + ah * 0.03, isz, 'gold', 0.4);
          const sm = isz * 0.62;
          s.ctx.save();
          s.ctx.beginPath();
          s.ctx.rect(xs - sm / 2, ay + ah * 0.03 + (isz - sm) / 2, sm, sm);
          s.ctx.clip();
          drawImg(s.ctx, im, xs - sm / 2 - sm * 0.35, ay + ah * 0.03 + (isz - sm) / 2 - sm * 0.3, sm * 1.7);
          s.ctx.restore();
          s.rrect(xs - sm / 2, ay + ah * 0.03 + (isz - sm) / 2, sm, sm, 0.4, { stroke: s.c('gold'), lw: 0.4 });
        }
        s.alpha(s.ease('crops', 0.5), () => {
          s.text('local crop', xs, ay + ah * 0.03 + isz + u * 3, { size: 2.9, font: 'ui', color: s.c('--ink-2') });
          s.text('global crop', xt, ay + ah * 0.03 + isz + u * 3, { size: 2.9, font: 'ui', color: s.c('--ink-2') });
        });
      }
      box(s, xs, by, bw, bh, 'student', 'blue', { size: 3.6, on: 0.7 });
      box(s, xt, by, bw, bh, 'teacher', 'blue', { size: 3.6, on: 0.35, sub: 'no gradient' });
      s.alpha(s.ease('teacher', 0.6), () => {
        s.arrow(xs + bw / 2 + u, by, xt - bw / 2 - u, by, s.c('slate'), 0.5, 2);
        s.text('moving average', w / 2, by - bh / 2 - u * 4, { size: 2.9, font: 'ui', weight: 600, color: s.c('slate'), halo: true });
      });
      s.alpha(s.ease('outputs', 0.6), () => {
        const yb = by + bh / 2 + u * 5;
        const bwid = bw;
        const hb = ah * 0.14;
        const pt = softmax(LOGITS.map((v, i) => v - CENTER[i]!), 0.04);
        const ps = softmax(LOGITS, 0.1);
        bars(s, xs - bwid / 2, yb, bwid, hb, ps, 'P_s', 'blue');
        bars(s, xt - bwid / 2, yb, bwid, hb, pt, 'P_t', 'blue');
        s.text('match', w / 2, yb + hb / 2, { size: 3.2, font: 'ui', weight: 600, color: s.c('red') });
        s.arrow(xt - bwid / 2 - u, yb + hb / 2 + u * 3, xs + bwid / 2 + u, yb + hb / 2 + u * 3, s.c('red'), 0.4, 1.8);
      });
      // Centering and sharpening, on one teacher output.
      const ca = s.ease('center', 0.6);
      s.alpha(ca, () => {
        const yb = ay + ah * 0.78;
        const bwid = Math.min(aw * 0.27, u * 26);
        const hb = ah * 0.13;
        const gap = (aw - 3 * bwid) / 2;
        bars(s, ax, yb, bwid, hb, softmax(LOGITS, 0.1), 'raw, τ 0.1', '--ink-2');
        bars(s, ax + bwid + gap, yb, bwid, hb, softmax(LOGITS.map((v, i) => v - CENTER[i]!), 0.1), 'centered', 'teal');
        s.alpha(s.ease('sharpen', 0.6), () => bars(s, ax + 2 * (bwid + gap), yb, bwid, hb, softmax(LOGITS.map((v, i) => v - CENTER[i]!), 0.04), 'sharpened, τ 0.04', 'slate'));
      });
    });
    // The three regimes on the toy.
    const ra = s.win('nocenter', 'emerge');
    if (ra > 0) {
      s.alpha(ra, () => {
        const n = 3;
        const gap = u * 3;
        const size = tall ? Math.min((aw - gap * 2) / 3, ah * 0.5) : Math.min((aw - gap * 2) / 3, ah * 0.62);
        const x0 = w / 2 - (size * n + gap * (n - 1)) / 2;
        const y = ay + ah * 0.2;
        const cur = s.since('both') >= 0 ? 0 : s.since('nosharpen') >= 0 ? 2 : 1;
        const labels = ['both tricks', 'no centering', 'no sharpening'];
        [1, 2, 0].forEach((run, q) => {
          const a = run === 1 ? 1 : run === 2 ? s.ease('nosharpen', 0.5) : s.ease('both', 0.5);
          s.alpha(a, () => plane(s, x0 + q * (size + gap), y, size, run, labels[run]!, cur === run ? 1 : 0));
        });
        const msg = cur === 1 ? 'one output wins everywhere' : cur === 2 ? 'every output near uniform' : 'split by the hidden groups';
        s.text(msg, w / 2, y + size + u * 11, { size: 3.6, font: 'ui', weight: 600, color: s.c(cur === 0 ? 'green' : 'red') });
        s.text('toy items at their content numbers, colored by the teacher\'s top output', w / 2, y - u * 5, { size: 2.9, font: 'ui', color: s.c('--ink-3') });
      });
    }
    s.alpha(s.ease('emerge', 0.6), () => {
      const y = ay + ah * 0.42;
      s.text('attention outlines the main object,', w / 2, y - u * 6, { size: 4, font: 'display', weight: 600 });
      s.text('with no segmentation labels', w / 2, y + u * 1, { size: 4, font: 'display', weight: 600 });
      pill(s, '80.1% linear probe on ImageNet (ViT-Base)', w / 2, y + u * 14, 'gold', { size: 3.4 });
    });
  },
};

// ---------------------------------------------------------------- outro

const CARDS: { id: string; title: string; k: K; note: string }[] = [
  { id: 'con', title: 'contrastive', k: 'teal', note: 'two views, many negatives' },
  { id: 'clip', title: 'CLIP', k: 'green', note: 'images and captions' },
  { id: 'mae', title: 'MAE', k: 'orange', note: 'hide and rebuild' },
  { id: 'dino', title: 'DINO', k: 'gold', note: 'a moving teacher' },
];

function glyph(s: Scene, id: string, cx: number, cy: number, sz: number, k: K): void {
  if (id === 'con') {
    const n = 4;
    const c = sz / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        s.ctx.fillStyle = s.tint(i === j ? 'gold' : k, i === j ? 0.85 : 0.15);
        s.ctx.fillRect(cx - sz / 2 + j * c + 1, cy - sz / 2 + i * c + 1, c - 2, c - 2);
      }
  } else if (id === 'clip') {
    s.rrect(cx - sz / 2, cy - sz * 0.35, sz * 0.4, sz * 0.4, 0.5, { fill: s.tint('purple', 0.5) });
    s.text('"text"', cx + sz * 0.22, cy - sz * 0.15, { size: 2.8, font: 'mono', color: s.c('green') });
    s.line(cx - sz * 0.1, cy + sz * 0.2, cx + sz * 0.22, cy + sz * 0.2, s.c(k), 0.4);
    s.text('match', cx + sz * 0.06, cy + sz * 0.36, { size: 2.6, font: 'ui', color: s.c('--ink-3') });
  } else if (id === 'mae') {
    const n = 4;
    const c = sz / n;
    for (let q = 0; q < n * n; q++) {
      const vis = [1, 6, 11, 12].includes(q);
      s.ctx.fillStyle = vis ? s.tint('orange', 0.75) : s.tint('--ink-3', 0.2);
      s.ctx.fillRect(cx - sz / 2 + (q % n) * c + 1, cy - sz / 2 + Math.floor(q / n) * c + 1, c - 2, c - 2);
    }
  } else {
    s.rrect(cx - sz / 2, cy - sz * 0.2, sz * 0.36, sz * 0.4, 0.6, { fill: s.tint('blue', 0.4) });
    s.rrect(cx + sz * 0.14, cy - sz * 0.2, sz * 0.36, sz * 0.4, 0.6, { fill: s.tint('blue', 0.2), stroke: s.tint('blue', 0.6), lw: 0.3 });
    s.arrow(cx - sz * 0.12, cy, cx + sz * 0.12, cy, s.c('slate'), 0.35, 1.2);
  }
}

const outro: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s);
    const cols = 2;
    const gap = u * 3;
    const cw = (aw - gap) / cols;
    const chh = Math.min((ah * 0.62 - gap) / 2, u * 30);
    const y0 = ay + ah * 0.03;
    const all = s.ease('thread', 0.6);
    CARDS.forEach((c, i) => {
      const x = ax + (i % cols) * (cw + gap);
      const y = y0 + Math.floor(i / cols) * (chh + gap);
      const on = Math.max(s.win(c.id, CARDS[i + 1]?.id ?? 'probe') , all);
      const a = s.ease(c.id, 0.5);
      s.alpha(Math.max(0.3, a), () => {
        s.rrect(x, y, cw, chh, 2, { fill: s.tint(c.k, 0.05 + 0.12 * on), stroke: s.tint(c.k, 0.3 + 0.6 * on), lw: 0.35 + 0.3 * on });
        const gs = Math.min(chh * 0.5, cw * 0.3);
        glyph(s, c.id, x + gs / 2 + u * 3, y + chh / 2, gs, c.k);
        s.text(c.title, x + gs + u * 6, y + chh * 0.38, { size: Math.min(5, (cw / u) * 0.1), font: 'display', weight: 600, align: 'left', color: s.c(c.k) });
        const room = cw - gs - u * 8;
        const ns = Math.min(3.2, 3.2 * (room / s.measure(c.note, { font: 'ui', size: 3.2 })));
        s.text(c.note, x + gs + u * 6, y + chh * 0.66, { size: ns, font: 'ui', align: 'left', color: s.c('--ink-2') });
      });
    });
    const by = y0 + 2 * (chh + gap) + u * 4;
    s.alpha(s.ease('probe', 0.6), () => pill(s, 'graded by a linear probe on frozen features', w / 2, by, 'gold', { size: 3.4 }));
    s.alpha(s.win('flavors', 'thread'), () => {
      s.text('contrastive, DINO: ready for probes', w / 2, by + u * 9, { size: 3.2, font: 'ui', color: s.c('teal') });
      s.text('MAE: fine-tune, and scale up', w / 2, by + u * 14, { size: 3.2, font: 'ui', color: s.c('orange') });
    });
    s.alpha(s.ease('thread', 0.6), () => s.text('the data supplies its own targets', w / 2, by + u * 11, { size: 4.2, font: 'display', weight: 600 }));
    s.alpha(s.ease('close', 0.6), () => s.text('labels only at the end, and only a few', w / 2, by + u * 18, { size: 3.6, italic: true, color: s.c('--ink-2') }));
  },
};

export const scenesC: Record<string, SceneDef> = { zeroshot, mae, dino, outro };
