import { fmt } from '../../core/code';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { G, type Pic, WORDS, affine, attend, attendWord, pictures, sourceOf, warp } from './data';
import { FEATS, type K, attnMask, block, cellBox, cellLabels, cellRect, curve, featBars, fit, gridLines, loading, picture, pill, scoreMask, steps, vec } from './kit';

/** Image on the left, a panel on the right, centered as a group. */
export function split(s: Scene, frac = 0.42, maxS = 60) {
  const { w, h, u } = s;
  const S = Math.min(maxS * u, w * frac, h - 30 * u);
  const pw = Math.min(w - S - 16 * u, 64 * u);
  const x0 = (w - (S + 6 * u + pw)) / 2;
  return { S, ix: x0, iy: (h - S) / 2 + 3 * u, px: x0 + S + 6 * u, pw };
}

/** The horse, or a gray stand-in while it loads. */
function horse(s: Scene): Pic | null {
  return pictures(s)?.horse ?? null;
}

// ---------------------------------------------------------------- intro

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const P = pictures(s);
    const tA = s.win('hello', 'once');
    s.alpha(tA, () => {
      const S = 30 * u;
      if (P) picture(s, 'horse', P.horse.rgb, w / 2 - S / 2, h * 0.16, S);
      else loading(s, w / 2 - S / 2, h * 0.16, S);
      fit(s, 'Attention and spatial transformers', w / 2, h * 0.62, w - 12 * u, { size: 7.4, font: 'display', weight: 600 });
      fit(s, 'letting a network choose where to look', w / 2, h * 0.74, w - 16 * u, { size: 4.2, italic: true, color: s.c('--ink-2') });
    });

    // Look once: image, ConvNet, one vector, an RNN writing from memory.
    const oA = s.win('once', 'better');
    s.alpha(oA, () => {
      const x0 = (w - 108 * u) / 2;
      const cy = h * 0.52;
      const S = 26 * u;
      const ix = x0 + 2 * u;
      if (P) picture(s, 'horse', P.horse.rgb, ix, cy - S / 2, S);
      else loading(s, ix, cy - S / 2, S);
      const fx0 = ix + S + 2 * u;
      const fx1 = fx0 + 13 * u;
      s.alpha(s.ease('once', 0.6, 0.4), () => {
        const c = s.ctx;
        c.beginPath();
        c.moveTo(fx0, cy - S / 2);
        c.lineTo(fx1, cy - 9 * u);
        c.lineTo(fx1, cy + 9 * u);
        c.lineTo(fx0, cy + S / 2);
        c.closePath();
        c.fillStyle = s.tint('slate', 0.14);
        c.fill();
        c.strokeStyle = s.tint('slate', 0.6);
        c.lineWidth = 0.3 * u;
        c.stroke();
        s.text('ConvNet', (fx0 + fx1) / 2, cy, { size: 2.8, font: 'ui', weight: 600, color: s.c('slate') });
      });
      const vx = fx1 + 2.5 * u;
      const pulse = s.since('dig') > 0 && s.since('better') < 0 ? 0.5 + 0.5 * Math.sin(s.since('dig') * 6) : 0;
      s.alpha(s.ease('once', 0.6, 0.9), () => {
        vec(s, vx, cy - 9 * u, 4 * u, 3 * u, 6, 'orange', pulse);
        s.text('one vector', vx + 2 * u, cy + 13 * u, { size: 2.9, color: s.c('orange'), weight: 600 });
      });
      const words = ['horse', 'grass', 'sky'];
      const bx = (k: number) => vx + 12 * u + k * 17 * u;
      const ra = s.ease('squeeze', 0.6, 0.6);
      s.alpha(ra, () => {
        words.forEach((wd, k) => {
          const a = s.ease('squeeze', 0.5, 1 + k * 0.5);
          s.alpha(a, () => {
            block(s, bx(k), cy - 5 * u, 11 * u, 10 * u, 'h', 'green', { size: 3.6 });
            if (k) s.arrow(bx(k - 1) + 11 * u, cy, bx(k) - 0.4 * u, cy, s.c('green'), 0.4, 2);
            s.arrow(bx(k) + 5.5 * u, cy - 5 * u, bx(k) + 5.5 * u, cy - 11 * u, s.tint('--ink-3', 0.8), 0.35, 2);
            s.text(wd, bx(k) + 5.5 * u, cy - 14 * u, { size: 3.6, font: 'serif', italic: true });
          });
        });
        s.arrow(vx + 4 * u, cy, bx(0) - 0.4 * u, cy, s.c('orange'), 0.45, 2.2);
      });
      // every word dug out of the same vector
      const dA = s.win('dig', 'better');
      s.alpha(dA, () => {
        words.forEach((_, k) => {
          if (k === 0) return;
          const p = clamp01(s.since('dig') * 1.4 - k * 0.5);
          if (p <= 0) return;
          curve(s, vx + 4 * u, cy + 6 * u, bx(k) + 5.5 * u, cy + 5 * u, -6 * u * p, s.tint('orange', 0.8 * p), 0.4);
        });
        s.text('every word, from the same summary', w / 2, cy + 22 * u, { size: 3.3, italic: true, color: s.c('--ink-2') });
      });
    });

    // Look again: a different place for every word; then the two families.
    const lA = s.ease('better', 0.7);
    if (lA > 0 && P) {
      const pic = P.horse;
      const two = s.ease('soft', 0.8);
      const S1 = Math.min(56 * u, h - 34 * u);
      const S2 = Math.min(44 * u, w * 0.4);
      const S = lerp(S1, S2, two);
      const gap = Math.max(8 * u, (w - 2 * S2) / 3);
      const ix = lerp(w / 2 - S1 / 2, gap, two);
      const iy = lerp(h * 0.14, h * 0.2, two);
      const words: [string, keyof typeof WORDS][] = [
        ['horse', 'object'],
        ['grass', 'grass'],
        ['sky', 'sky'],
      ];
      const p = s.prog('better');
      const k = Math.min(2, Math.floor(p * 3.2));
      const word = s.since('soft') >= 0 ? 'sky' : words[k]![1];
      const A = attendWord(pic, 'horse', word as keyof typeof WORDS, 2);
      s.alpha(lA, () => {
        picture(s, 'horse', pic.rgb, ix, iy, S);
        attnMask(s, A.alpha, ix, iy, S, 1, 0.7);
        gridLines(s, ix, iy, S, 0.6);
        // the word being written
        s.alpha(1 - two, () => {
          words.forEach(([wd], j) => {
            const x = w / 2 + (j - 1) * 18 * u;
            pill(s, wd, x, iy + S + 7 * u, j === k ? 'teal' : '--ink-3', { size: 3.4, on: j === k ? 1 : 0, font: 'serif' });
          });
        });
        s.alpha(two, () => {
          s.text('soft attention', ix + S / 2, iy + S + 6 * u, { size: 4, font: 'display', weight: 600, color: s.c('teal') });
          s.text('everywhere, with weights', ix + S / 2, iy + S + 11 * u, { size: 3.2, italic: true, color: s.c('--ink-2') });
        });
      });
      // the spatial transformer: a warped read box and its straightened output
      const tA = s.ease('stn', 0.7);
      s.alpha(tA, () => {
        const jx = w - gap - S2;
        const theta = affine(0.55, lerp(0, 18, s.ease('stn', 1.4, 0.4)), -0.28, -0.12, 0);
        const plane = P.plane;
        picture(s, 'plane', plane.rgb, jx, iy, S2);
        const P4 = [sourceOf(theta, 0, 0, 2), sourceOf(theta, 0, 1, 2), sourceOf(theta, 1, 1, 2), sourceOf(theta, 1, 0, 2)];
        const c = s.ctx;
        c.beginPath();
        P4.forEach(([x, y], q) => (q ? c.lineTo(jx + ((x + 1) / 2) * S2, iy + ((y + 1) / 2) * S2) : c.moveTo(jx + ((x + 1) / 2) * S2, iy + ((y + 1) / 2) * S2)));
        c.closePath();
        c.strokeStyle = s.c('--accent');
        c.lineWidth = 0.6 * u;
        c.stroke();
        const oS = S2 * 0.36;
        const ox = jx + S2 - oS - 1.2 * u;
        const oy = iy + S2 - oS - 1.2 * u;
        s.rrect(ox - 0.6 * u, oy - 0.6 * u, oS + 1.2 * u, oS + 1.2 * u, 1, { fill: s.c('--card'), stroke: s.c('--accent'), lw: 0.5 });
        picture(s, 'stn-intro', warp(plane.rgb, theta), ox, oy, oS);
        s.text('spatial transformer', jx + S2 / 2, iy + S2 + 6 * u, { size: 4, font: 'display', weight: 600, color: s.c('blue') });
        s.text('crop, zoom, straighten', jx + S2 / 2, iy + S2 + 11 * u, { size: 3.2, italic: true, color: s.c('--ink-2') });
      });
      const sA = s.ease('secret', 0.7);
      s.alpha(sA, () => {
        const y = Math.min(h - 7 * u, iy + S2 + 19 * u);
        fit(s, 'where to look is a smooth function, so backprop can learn it', w / 2, y, w - 10 * u, { size: 3.6, font: 'serif', weight: 600, color: s.c('--accent') });
      });
    } else if (lA > 0) loading(s, w / 2 - 25 * u, h * 0.2, 50 * u);
  },
};

// ---------------------------------------------------------------- bottleneck

const EN = ['the', 'black', 'cat', 'is', 'sleeping'];
const FR = ['le', 'chat', 'noir', 'dort'];

const bottleneck: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const P = pictures(s);
    // Phase 1: encoder, one summary vector, decoder.
    const dA = s.win('trans', 'worse');
    s.alpha(dA, () => {
      const cx = w / 2;
      const eY = 30 * u;
      const many = s.ease('size', 1.2, 0.3);
      const n = Math.round(lerp(5, 50, many));
      const span = lerp(80 * u, Math.min(w - 10 * u, 104 * u), many);
      const bw = span / n;
      const x0 = cx - span / 2;
      s.text('English in', x0, eY - 11 * u, { size: 3, align: 'left', color: s.c('--ink-3') });
      const eA = s.ease('enc', 0.5);
      for (let i = 0; i < n; i++) {
        const a = n === 5 ? s.ease('enc', 0.4, 0.3 * i) : 1;
        s.alpha(a * eA + (1 - eA) * 0.25, () => {
          s.rrect(x0 + i * bw + bw * 0.12, eY, bw * 0.76, 8 * u, Math.min(1.5, bw / u / 4), { fill: s.tint('slate', 0.14), stroke: s.tint('slate', 0.6), lw: 0.25 });
          if (n === 5) {
            s.text(EN[i]!, x0 + i * bw + bw / 2, eY - 4 * u, { size: 3.3, font: 'serif', italic: true });
            if (i) s.arrow(x0 + i * bw - bw * 0.12, eY + 4 * u, x0 + i * bw + bw * 0.12, eY + 4 * u, s.c('slate'), 0.3, 1.6);
          }
        });
      }
      s.alpha(many, () => s.text('fifty words', cx, eY - 4 * u, { size: 3.3, italic: true, color: s.c('--ink-2') }));
      const sY = 50 * u;
      const vw = 30 * u;
      const hA = s.ease('hand', 0.6);
      s.alpha(hA, () => {
        s.arrow(x0 + span - bw / 2, eY + 8.5 * u, cx + vw / 2 - 2 * u, sY - 1.2 * u, s.c('slate'), 0.4, 2);
        for (let k = 0; k < 6; k++) s.rrect(cx - vw / 2 + k * 5 * u, sY, 4.6 * u, 4.6 * u, 0.6, { fill: s.tint('orange', 0.35), stroke: s.c('orange'), lw: 0.3 });
        const pulse = s.since('size') > 0 ? 0.5 + 0.5 * Math.sin(s.since('size') * 5) : 0;
        s.alpha(s.ease('size', 0.5, 0.8), () => s.rrect(cx - vw / 2 - 1.2 * u, sY - 1.2 * u, vw + 2 * u, 7 * u, 1.4, { stroke: s.tint('red', 0.5 + 0.5 * pulse), lw: 0.6 }));
        s.text(s.since('size') > 0.8 ? 'same size' : 'one fixed-size vector', cx + vw / 2 + 2.5 * u, sY + 2.3 * u, { size: 3, align: 'left', color: s.c(s.since('size') > 0.8 ? 'red' : 'orange'), weight: 600 });
        const dY = 66 * u;
        const dw = 13 * u;
        const dx0 = cx - (4 * dw + 3 * 3 * u) / 2;
        s.arrow(cx - vw / 2 + 2 * u, sY + 5 * u, dx0 + dw / 2, dY - 0.8 * u, s.c('orange'), 0.4, 2);
        FR.forEach((wd, k) => {
          const a = s.ease('hand', 0.4, 0.6 + 0.3 * k);
          s.alpha(a, () => {
            const x = dx0 + k * (dw + 3 * u);
            block(s, x, dY, dw, 8 * u, '', 'green');
            if (k) s.arrow(x - 3 * u, dY + 4 * u, x - 0.3 * u, dY + 4 * u, s.c('green'), 0.3, 1.6);
            s.text(wd, x + dw / 2, dY + 13 * u, { size: 3.3, font: 'serif', italic: true });
          });
        });
        s.text('French out', dx0, dY + 19 * u, { size: 3, align: 'left', color: s.c('--ink-3') });
      });
    });

    // Phase 2: quality falls with length (a sketch).
    const cA = s.win('worse', 'image');
    s.alpha(cA, () => {
      const L = 16 * u;
      const R = w - 8 * u;
      const T = 20 * u;
      const B = h - 18 * u;
      const X = (n: number) => L + ((R - L) * n) / 60;
      const Y = (q: number) => B - ((B - T) * q) / 30;
      s.line(L, B, R, B, s.c('--axis'), 0.35);
      s.line(L, B, L, T, s.c('--axis'), 0.35);
      for (let n = 10; n <= 60; n += 10) s.text(String(n), X(n), B + 3.5 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      s.text('sentence length (words)', (L + R) / 2, B + 8.5 * u, { size: 3, color: s.c('--ink-2') });
      s.text('quality', L + 1.5 * u, T - 3 * u, { size: 3, align: 'left', color: s.c('--ink-2') });
      s.text('(a sketch)', R, T - 3 * u, { size: 2.8, align: 'right', italic: true, color: s.c('--ink-3') });
      const red = (n: number) => 25 - 17 * smooth((n - 12) / 45);
      const teal = (n: number) => 26.5 - 2.2 * smooth((n - 20) / 40);
      const draw = (f: (n: number) => number, col: string, p: number) => {
        const c = s.ctx;
        c.beginPath();
        for (let n = 2; n <= 2 + 58 * p; n += 0.5) (n === 2 ? c.moveTo(X(n), Y(f(n))) : c.lineTo(X(n), Y(f(n))));
        c.strokeStyle = col;
        c.lineWidth = 0.7 * u;
        c.stroke();
      };
      draw(red, s.c('red'), s.ease('worse', 1.6, 0.2));
      s.alpha(s.ease('worse', 0.5, 1.6), () => s.text('one vector', X(60), Y(red(60)) - 3.5 * u, { size: 3.2, align: 'right', color: s.c('red'), weight: 600, halo: true }));
      const kp = s.ease('keep', 1.6, 0.2);
      if (kp > 0) draw(teal, s.c('teal'), kp);
      s.alpha(s.ease('keep', 0.5, 1.6), () => s.text('keep every state', X(60), Y(teal(60)) - 3.5 * u, { size: 3.2, align: 'right', color: s.c('teal'), weight: 600, halo: true }));
    });

    // Phase 3: a set of vectors, for a sentence and for an image.
    const kA = s.win('image', 'phone');
    s.alpha(kA, () => {
      const cx = w / 2;
      const sp = Math.min(19 * u, (w - 14 * u) / 5);
      const x0 = cx - (sp * 5) / 2;
      const wY = 20 * u;
      // the weights the decoder puts on each word (writing "chat")
      const wts = [0.05, 0.12, 0.78, 0.03, 0.02];
      const pk = s.ease('pick', 0.8);
      EN.forEach((wd, j) => {
        const x = x0 + j * sp + sp / 2;
        s.text(wd, x, wY, { size: 3.2, font: 'serif', italic: true });
        vec(s, x - 2 * u, wY + 3.5 * u, 4 * u, 2.6 * u, 4, 'orange', pk * wts[j]!);
      });
      s.text('one v per word', cx, wY - 6 * u, { size: 3, color: s.c('orange'), weight: 600 });
      // the image as a grid of v's
      const S = Math.min(36 * u, h - 52 * u);
      const ix = cx - S - 6 * u;
      const iy = h - S - 9 * u;
      if (P) {
        picture(s, 'horse', P.horse.rgb, ix, iy, S);
        if (pk > 0) attnMask(s, attendWord(P.horse, 'horse', 'object', 2).alpha, ix, iy, S, pk, 0.7);
        gridLines(s, ix, iy, S, 0.8);
      } else loading(s, ix, iy, S);
      s.text('one v per cell', ix + S / 2, iy + S + 4.5 * u, { size: 3, color: s.c('orange'), weight: 600 });
      // the decoder picks
      s.alpha(pk, () => {
        const bx = cx + 6 * u;
        const by = iy + S / 2 - 5 * u;
        block(s, bx, by, 24 * u, 10 * u, 'decoder', 'green', { size: 3.4 });
        EN.forEach((_, j) => {
          const x = x0 + j * sp + sp / 2;
          s.line(bx + 12 * u, by, x, wY + 14 * u, s.tint('teal', 0.25 + 0.75 * wts[j]!), 0.2 + 1.4 * wts[j]!);
        });
        s.arrow(bx, by + 5 * u, ix + S + 1 * u, by + 5 * u, s.c('teal'), 0.5, 2);
        s.text('what do I need now?', bx + 12 * u, by + 15 * u, { size: 3, italic: true, color: s.c('--ink-2') });
      });
    });

    // Phase 4: the glance.
    const gA = s.ease('phone', 0.7);
    s.alpha(gA, () => {
      if (!P) return loading(s, w / 2 - 25 * u, 14 * u, 50 * u);
      const S = Math.min(56 * u, h - 32 * u);
      const ix = w / 2 - S / 2;
      const iy = 13 * u;
      picture(s, 'horse', P.horse.rgb, ix, iy, S);
      const seq: [string, keyof typeof WORDS][] = [
        ['the horse', 'object'],
        ['the grass', 'grass'],
        ['the sky', 'sky'],
      ];
      const g = s.since('glance') >= 0 ? s.prog('glance') : -1;
      const k = g < 0 ? -1 : Math.min(2, Math.floor(g * 3.6));
      if (k < 0) {
        // eyes closed: talking from memory
        s.ctx.fillStyle = 'rgba(0,0,0,0.72)';
        s.ctx.fillRect(ix, iy, S, S);
        s.text('from memory?', ix + S / 2, iy + S / 2, { size: 4.2, italic: true, color: '#ffffff' });
      } else attnMask(s, attendWord(P.horse, 'horse', seq[k]![1], 2).alpha, ix, iy, S, 1, 0.8);
      gridLines(s, ix, iy, S, 0.4);
      seq.forEach(([t], j) => {
        const x = w / 2 + (j - 1) * 24 * u;
        s.alpha(k < 0 ? 0.35 : 1, () => pill(s, t, x, iy + S + 7 * u, j === k ? 'teal' : '--ink-3', { size: 3.4, on: j === k ? 1 : 0, font: 'serif' }));
      });
    });
  },
};

// ---------------------------------------------------------------- scores

const scores: SceneDef = {
  marks: {
    e: { tex: String.raw`\syme_i = \symv_i \cdot (W_a\,\symh)`, x: 0.75, y: 0.86, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const pic = horse(s);
    const L = split(s);
    const { S, ix, iy, px, pw } = L;
    const toy = s.ease('toy', 0.7);

    // The real model: a 14 x 14 x 512 feature map.
    const vA = s.win('vgg', 'toy');
    s.alpha(vA, () => {
      if (pic) picture(s, 'horse', pic.rgb, ix, iy, S);
      else loading(s, ix, iy, S);
      const fS = Math.min(pw * 0.62, S * 0.78);
      const fx = px + 2 * u;
      const fy = iy + (S - fS) / 2 + 3 * u;
      s.arrow(ix + S + 1 * u, iy + S / 2, fx - 1 * u, iy + S / 2, s.c('--ink-3'), 0.4, 2);
      for (let d = 3; d >= 0; d--) {
        const o = d * 1.6 * u;
        s.rrect(fx + o, fy - o, fS, fS, 0.4, { fill: s.tint('orange', 0.12 + 0.05 * (3 - d)), stroke: s.tint('orange', 0.6), lw: 0.25 });
      }
      s.alpha(0.5, () => {
        for (let k = 1; k < 14; k++) {
          s.line(fx + (k * fS) / 14, fy, fx + (k * fS) / 14, fy + fS, s.tint('orange', 0.6), 0.12);
          s.line(fx, fy + (k * fS) / 14, fx + fS, fy + (k * fS) / 14, s.tint('orange', 0.6), 0.12);
        }
      });
      s.text('14 × 14 × 512', fx + fS / 2, fy - 7.5 * u, { size: 3.3, font: 'mono', weight: 600, color: s.c('orange') });
      // one location's vector
      const lA = s.ease('L', 0.6);
      s.alpha(lA, () => {
        const cs = fS / 14;
        const cx = fx + 5 * cs;
        const cy = fy + 4 * cs;
        s.rrect(cx, cy, cs, cs, 0.2, { fill: s.c('orange') });
        const vx = Math.min(px + pw - 6 * u, fx + fS + 7 * u);
        const vy = fy;
        for (let k = 0; k < 12; k++) s.rrect(vx, vy + k * (fS / 12), 4 * u, fS / 12 - 0.4 * u, 0.3, { fill: s.tint('orange', 0.2 + 0.5 * ((k * 7) % 5) / 5), stroke: s.tint('orange', 0.7), lw: 0.15 });
        s.line(cx + cs, cy + cs / 2, vx, vy + fS / 2, s.tint('orange', 0.8), 0.3, [0.8, 0.6]);
        s.text('vᵢ', vx + 2 * u, vy + fS + 3.5 * u, { size: 3.6, italic: true, weight: 600, color: s.c('orange') });
        s.text('L = 196 vectors, 512 numbers each', ix + S / 2, iy + S + 5 * u, { size: 3.1, color: s.c('--ink-2') });
      });
    });

    if (toy <= 0) return;
    if (!pic) {
      loading(s, ix, iy, S);
      return;
    }
    // The toy: an 8 x 8 grid with five numbers per cell.
    const sky = attend(pic, WORDS.sky, 1);
    let hi = 0;
    let lo = 0;
    sky.scores.forEach((v, i) => {
      if (v > sky.scores[hi]!) hi = i;
      if (v < sky.scores[lo]!) lo = i;
    });
    const cell = s.since('clash') >= 0 ? lo : hi;
    const mapA = s.ease('map', 0.8);
    s.alpha(toy, () => {
      picture(s, 'horse', pic.rgb, ix, iy, S);
      // the score map fills in, row by row
      if (mapA > 0) {
        const p = s.ease('map', 1.6);
        scoreMask(s, sky.scores, ix, iy, S, 1, (i) => clamp01(p * 9 - Math.floor(i / G)));
        cellLabels(s, sky.scores, ix, iy, S, (v) => fmt(Math.round(v * 10) / 10), clamp01(p * 2 - 1));
      }
      gridLines(s, ix, iy, S, 0.9);
      const cA = s.ease('five', 0.6);
      if (cA > 0) cellBox(s, cell, ix, iy, S, 'teal', cA * (1 - mapA * 0.6), 0.7);
      s.alpha(1 - s.ease('step', 0.6), () => s.text('8 × 8 cells, 5 numbers each', ix + S / 2, iy + S + 5 * u, { size: 3.1, color: s.c('--ink-2') }));
      s.alpha(s.ease('map', 0.6, 1.2), () => s.text('purple: high score   dark: low', ix + S / 2, iy + S + 5 * u, { size: 3.1, color: s.c('purple') }));
    });

    // The table: the cell's features, the query, their products.
    const v = pic.feats[cell]!;
    const q = WORDS.sky;
    const tA = s.ease('five', 0.6);
    s.alpha(tA, () => {
      const rowH = 6.4 * u;
      const ty = iy + 6 * u;
      const cN = px + 13 * u;
      const cV = px + Math.min(23 * u, pw * 0.42);
      const cQ = px + Math.min(34 * u, pw * 0.64);
      const cP = px + Math.min(47 * u, pw * 0.9);
      const qA = s.ease('query', 0.6);
      const pA = s.ease('dot', 0.6, 0.5);
      s.text('vᵢ', cV, ty - 5 * u, { size: 3.6, italic: true, weight: 600, color: s.c('orange') });
      s.alpha(qA, () => s.text('q', cQ, ty - 5 * u, { size: 3.6, italic: true, weight: 600, color: s.c('slate') }));
      s.alpha(pA, () => s.text('product', cP, ty - 5 * u, { size: 3, weight: 600, color: s.c('purple') }));
      let sum = 0;
      FEATS.forEach((nm, d) => {
        const y = ty + d * rowH + rowH / 2;
        s.text(nm, cN, y, { size: 3, align: 'right', color: s.c('--ink-2') });
        s.text(v[d]!.toFixed(1), cV, y, { size: 3.1, font: 'mono', color: s.c('orange') });
        s.alpha(qA, () => s.text(q[d]!.toFixed(1), cQ, y, { size: 3.1, font: 'mono', color: s.c('slate') }));
        const pr = v[d]! * q[d]!;
        sum += pr;
        const rowP = s.ease('dot', 0.4, 0.8 + d * 0.35);
        s.alpha(pA * rowP, () => {
          const on = s.since('match') >= 0 ? 1 : 0;
          if (on) s.rrect(cP - 5 * u, y - rowH * 0.38, 10 * u, rowH * 0.76, 1, { fill: s.tint(pr >= 0 ? 'purple' : 'slate', pr >= 0 ? 0.2 : 0.12) });
          s.text((Math.abs(pr) < 0.05 ? 0 : pr).toFixed(1), cP, y, { size: 3.1, font: 'mono', weight: 600, color: s.c(pr >= 0 ? 'purple' : '--ink-3') });
        });
      });
      const sy = ty + 5 * rowH + 3 * u;
      s.alpha(pA * s.ease('dot', 0.5, 2.6), () => {
        s.line(cV - 4 * u, sy - 1.6 * u, cP + 5 * u, sy - 1.6 * u, s.c('--rule'), 0.3);
        s.text('score', cQ, sy + 2 * u, { size: 3.1, weight: 600, color: s.c('purple') });
        s.text(sum.toFixed(1), cP, sy + 2 * u, { size: 3.6, font: 'mono', weight: 700, color: s.c('purple') });
      });
      s.alpha(qA * (1 - s.ease('dot', 0.5)), () => {
        const wish = 'bright, blue, smooth';
        s.text(`"sky": ${wish}`, px + pw / 2, sy + 2 * u, { size: 3.1, italic: true, color: s.c('slate') });
      });
    });
    s.show('e', s.win('dot', 'clash') + s.ease('nothing', 0.6), { x: (px + pw / 2) / w, y: Math.min(0.92, (iy + S + 6 * u) / h) });
    s.alpha(s.ease('step', 0.6), () => steps(s, w / 2, 7 * u, 0));
    s.slot('q', '1, 0.8, -0.3, -0.5, -1');
  },
};

// ---------------------------------------------------------------- softmax

/** Five sample cells for the softmax strip: the top two, one in the middle, the bottom two. */
function sampleCells(sc: number[]): number[] {
  const order = sc.map((_, i) => i).sort((a, b) => sc[b]! - sc[a]!);
  return [order[0]!, order[1]!, order[20]!, order[50]!, order[63]!];
}

/** Sharpness over the scene: 2, then down to 0.3, then up to 6. */
function betaAt(s: Scene): number {
  if (s.since('low') < 0) return 2;
  if (s.since('high') < 0) return lerp(2, 0.3, s.ease('low', 2.2, 0.4));
  return lerp(0.3, 6, s.ease('high', 2.2, 0.3));
}

const softmax: SceneDef = {
  marks: {
    a: { tex: String.raw`\symalpha_i = \frac{e^{\syme_i}}{\sum_j e^{\syme_j}}`, x: 0.75, y: 0.86, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const pic = horse(s);
    const { S, ix, iy, px, pw } = split(s);
    s.alpha(s.ease('second', 0.5) * (1 - s.ease('map', 0.5)) + s.ease('map', 0.5), () => steps(s, w / 2, 7 * u, s.since('map') >= 0 ? 1 : lerp(0, 1, s.ease('second', 0.8))));
    if (!pic) return loading(s, ix, iy, S);
    const beta = betaAt(s);
    const A = attendWord(pic, 'horse', 'sky', beta);
    const A2 = attendWord(pic, 'horse', 'sky', 2);
    s.slot('beta', fmt(Math.round(beta * 10) / 10));
    s.slot('top', String(Math.round(Math.max(...A.alpha) * 100)));

    // Left: the score map turns into attention.
    const toA = s.ease('norm', 0.9);
    picture(s, 'horse', pic.rgb, ix, iy, S);
    s.alpha(1 - toA, () => scoreMask(s, A2.scores, ix, iy, S));
    s.alpha(toA, () => attnMask(s, A.alpha, ix, iy, S));
    gridLines(s, ix, iy, S, 0.7);
    const mA = s.ease('map', 0.6);
    s.alpha(mA, () => {
      cellLabels(s, A.alpha, ix, iy, S, (a) => (a >= 0.01 ? `${Math.round(a * 100)}` : ''));
      cellBox(s, A.best, ix, iy, S, 'teal', 1, 0.7);
    });
    s.alpha(1 - toA, () => s.text('scores', ix + S / 2, iy + S + 5 * u, { size: 3.2, color: s.c('purple'), weight: 600 }));
    s.alpha(toA * (1 - mA), () => s.text('weights alpha', ix + S / 2, iy + S + 5 * u, { size: 3.2, color: s.c('teal'), weight: 600 }));
    s.alpha(mA, () => s.text('% of the attention per cell', ix + S / 2, iy + S + 5 * u, { size: 3.1, color: s.c('teal') }));

    // Right, part 1: five cells through exp and normalize.
    const stripA = s.win('second', 'sharp');
    s.alpha(stripA, () => {
      const cells = sampleCells(A2.scores);
      const n = cells.length;
      const colW = pw / n;
      const thumb = Math.min(8 * u, colW * 0.7);
      const ty = iy;
      const base0 = iy + 30 * u;
      const top = iy + 13 * u;
      const bot = iy + 44 * u;
      const ex = s.ease('exp', 1.0, 0.4);
      const nm = s.ease('norm', 1.0, 0.4);
      const smax = Math.max(...cells.map((i) => Math.abs(A2.scores[i]!)));
      const emax = Math.max(...cells.map((i) => Math.exp(A2.scores[i]! - A2.scores[cells[0]!]!)));
      const amax = A2.alpha[cells[0]!]!;
      // the baseline slides from the middle (scores can be negative) to the bottom (exp is positive)
      const base = lerp(base0, bot, ex);
      s.line(px, base, px + pw, base, s.c('--axis'), 0.3);
      cells.forEach((ci, j) => {
        const cx = px + colW * j + colW / 2;
        const [sx, sy, sw] = cellRect(ci, 0, 0, 32);
        picture(s, 'horse', pic.rgb, cx - thumb / 2, ty, thumb, { src: [sx, sy, sw, sw] });
        const sc = A2.scores[ci]!;
        const hS = (sc / smax) * (base0 - top);
        const hE = (Math.exp(sc - A2.scores[cells[0]!]!) / emax) * (bot - top);
        const hA = (A2.alpha[ci]! / amax) * (bot - top);
        const hh = lerp(lerp(hS, hE, ex), hA, nm);
        const bw = colW * 0.5;
        const k: K = nm > 0.5 ? 'teal' : 'purple';
        s.rrect(cx - bw / 2, Math.min(base, base - hh), bw, Math.max(0.6, Math.abs(hh)), 0.4, { fill: s.tint(k, 0.65) });
        const ev = Math.exp(sc - A2.scores[cells[0]!]!);
        const al = A2.alpha[ci]!;
        const label = nm > 0.5 ? (al >= 0.01 ? `${Math.round(al * 100)}%` : '~0') : ex > 0.5 ? (ev >= 0.01 ? fmt(Number(ev.toPrecision(2))) : '~0') : sc.toFixed(1);
        const ly = hh >= 0 ? base - hh - 2.6 * u : base - hh + 2.6 * u;
        s.text(label, cx, ly, { size: 2.8, font: 'mono', weight: 600, color: s.c(k), halo: true });
      });
      const cap = nm > 0.5 ? 'alpha: shares of 100%' : ex > 0.5 ? 'exp(score - max)' : 'scores of five cells';
      s.text(cap, px + pw / 2, bot + 5 * u, { size: 3.1, color: s.c(nm > 0.5 ? 'teal' : 'purple'), weight: 600 });
      // all 64 weights as one 100% bar
      s.alpha(s.ease('budget', 0.6), () => {
        const by = bot + 10 * u;
        const order = A2.alpha.map((a, i) => [a, i] as [number, number]).sort((a, b) => b[0] - a[0]);
        let x = px;
        order.forEach(([a], k) => {
          const ww = a * pw * s.ease('budget', 1.4);
          s.rrect(x, by, Math.max(0, ww - 0.3), 4.5 * u, 0.2, { fill: s.tint('teal', k % 2 ? 0.45 : 0.8) });
          x += ww;
        });
        s.rrect(px, by, pw, 4.5 * u, 0.4, { stroke: s.c('teal'), lw: 0.3 });
        s.text('all 64 weights: 100%', px + pw / 2, by + 8.5 * u, { size: 3, color: s.c('teal') });
      });
    });
    s.show('a', s.win('norm', 'sharp'), { x: (px + pw / 2) / w, y: (iy - 7 * u) / h });

    // Right, part 2: the sharpness knob.
    const kA = s.ease('sharp', 0.6);
    s.alpha(kA, () => {
      const y = iy + 14 * u;
      const x0 = px + 2 * u;
      const x1 = px + pw - 2 * u;
      s.text('sharpness', x0, y - 6 * u, { size: 3.2, align: 'left', color: s.c('--ink-2') });
      s.text(`× ${beta.toFixed(1)}`, x1, y - 6 * u, { size: 3.4, align: 'right', font: 'mono', weight: 600, color: s.c('slate') });
      s.line(x0, y, x1, y, s.c('--rule'), 0.6);
      const kx = lerp(x0, x1, (beta - 0.2) / 5.8);
      s.line(x0, y, kx, y, s.c('slate'), 0.6);
      s.circle(kx, y, 1.8 * u, { fill: s.c('slate'), stroke: s.c('--card'), lw: 0.4 });
      s.text('spread', x0, y + 5 * u, { size: 2.8, align: 'left', color: s.c('--ink-3') });
      s.text('peaked', x1, y + 5 * u, { size: 2.8, align: 'right', color: s.c('--ink-3') });
      // sorted weights, to show how peaked
      const order = [...A.alpha].sort((a, b) => b - a).slice(0, 16);
      const hy0 = y + 12 * u;
      const hy1 = iy + S;
      const bw = (pw - 4 * u) / 16;
      order.forEach((a, k) => {
        const hh = Math.min(1, a / 0.6) * (hy1 - hy0);
        s.rrect(x0 + k * bw + bw * 0.12, hy1 - hh, bw * 0.76, Math.max(0.5, hh), 0.3, { fill: s.tint('teal', 0.7) });
      });
      s.line(x0, hy1, x1, hy1, s.c('--axis'), 0.3);
      s.text(`top cell ${Math.round(order[0]! * 100)}%`, x0 + bw * 1.2, Math.max(hy0 - 2 * u, hy1 - Math.min(1, order[0]! / 0.6) * (hy1 - hy0) - 3 * u), { size: 3, align: 'left', font: 'mono', weight: 600, color: s.c('teal'), halo: true });
      s.text('the 16 biggest weights', px + pw / 2, hy1 + 5 * u, { size: 2.9, color: s.c('--ink-3') });
    });
  },
};

// ---------------------------------------------------------------- context

const context: SceneDef = {
  marks: {
    z: { tex: String.raw`\symz = \sum_i \symalpha_i\,\symv_i = \mathbb{E}_{i\sim\symalpha}\big[\symv_i\big]`, x: 0.5, y: 0.9, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const pic = horse(s);
    const { S, ix, iy, px, pw } = split(s);
    s.alpha(s.ease('third', 0.5), () => steps(s, w / 2, 7 * u, 2));
    if (!pic) return loading(s, ix, iy, S);
    const A = attendWord(pic, 'horse', 'sky', 2);
    s.slot('z', A.z.map((v) => fmt(Math.round(v * 10) / 10)).join(', '));
    picture(s, 'horse', pic.rgb, ix, iy, S);
    attnMask(s, A.alpha, ix, iy, S);
    gridLines(s, ix, iy, S, 0.6);

    // The loop: scan the cells, adding alpha[i] * feats[i].
    const sc = s.since('scale') < 0 ? 0 : s.ease('scale', Math.max(1.5, s.end('scale') - s.at('scale') - 0.3), 0.2);
    const upto = Math.floor(sc * 64);
    const zPart = [0, 1, 2, 3, 4].map((d) => {
      let a = 0;
      for (let i = 0; i < upto; i++) a += A.alpha[i]! * pic.feats[i]![d]!;
      return a;
    });
    if (s.since('scale') >= 0 && sc < 1) cellBox(s, Math.min(63, upto), ix, iy, S, 'gold', 1, 0.6);

    const barsA = s.win('third', 'expect') + s.ease('soft', 0.6);
    const rowH = Math.min(6.4 * u, S / 7);
    const by = iy + 7 * u;
    s.alpha(barsA, () => {
      s.text('dashed: the query', px, by - 5 * u, { size: 2.9, align: 'left', color: s.c('slate') });
      s.text('gold: z', px + pw, by - 5 * u, { size: 2.9, align: 'right', color: s.c('gold'), weight: 600 });
      featBars(s, px, by, pw, rowH, { filled: s.since('scale') < 0 ? null : zPart, outline: WORDS.sky, fillK: 'gold', size: 2.9, labelW: 12 * u });
      s.alpha(s.ease('one', 0.6), () => s.text('one vector, five numbers', px + pw / 2, by + 5 * rowH + 4 * u, { size: 3, color: s.c('--ink-2') }));
    });
    s.alpha(s.win('color', 'expect'), () => {
      const y = by + 5 * rowH + 9 * u;
      const sw = 7 * u;
      s.rrect(px + 12 * u, y, sw, sw, 1, { fill: `rgb(${A.color.map((c) => Math.round(c)).join(',')})`, stroke: s.c('--rule'), lw: 0.3 });
      s.text('average color', px + 12 * u + sw + 2 * u, y + sw / 2, { size: 3, align: 'left', color: s.c('--ink-2') });
    });

    // The die: an expectation.
    const dA = s.win('expect', 'soft');
    s.alpha(dA, () => {
      const L = px + 2 * u;
      const R = px + pw - 2 * u;
      const base = iy + S * 0.62;
      const X = (k: number) => lerp(L, R, (k - 0.5) / 6);
      const bh = 14 * u;
      for (let k = 1; k <= 6; k++) {
        const a = s.ease('expect', 0.4, 0.6 + 0.15 * k);
        s.alpha(a, () => {
          s.rrect(X(k) - 2.4 * u, base - bh, 4.8 * u, bh, 0.5, { fill: s.tint('slate', 0.35) });
          s.text(String(k), X(k), base + 3.5 * u, { size: 3.2, font: 'mono', weight: 600 });
        });
      }
      s.line(L - 1 * u, base, R + 1 * u, base, s.c('--axis'), 0.3);
      s.alpha(s.ease('expect', 0.6), () => s.text('each face: 1/6', (L + R) / 2, base - bh - 4 * u, { size: 3, color: s.c('slate') }));
      s.alpha(s.ease('die', 0.6, 1.4), () => {
        const x = X(3.5);
        s.line(x, base - bh - 1 * u, x, base + 1 * u, s.c('gold'), 0.7);
        s.text('E = 3.5', x, base + 9 * u, { size: 3.6, font: 'mono', weight: 700, color: s.c('gold') });
        s.text('no roll is 3.5', x, base + 14 * u, { size: 2.9, italic: true, color: s.c('--ink-3') });
      });
    });
    s.show('z', s.ease('soft', 0.6) * (1 - s.ease('diff', 0.5)), { y: Math.min(0.92, (iy + S + 7 * u) / h) });

    // Differentiable: gradients flow back through all three steps.
    const fA = s.ease('diff', 0.6);
    s.alpha(fA, () => {
      const y = iy + S + 7 * u;
      const names: [string, K][] = [
        ['score  ×, +', 'purple'],
        ['softmax  exp', 'teal'],
        ['average  ×, +', 'gold'],
      ];
      const bw = Math.min(30 * u, (w - 14 * u) / 3 - 4 * u);
      const x0 = w / 2 - (3 * bw + 2 * 5 * u) / 2;
      names.forEach(([t, k], j) => {
        const x = x0 + j * (bw + 5 * u);
        s.rrect(x, y - 3 * u, bw, 6 * u, 1.4, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.7), lw: 0.3 });
        fit(s, t, x + bw / 2, y, bw - 2 * u, { size: 3, font: 'mono', weight: 600, color: s.c(k) });
        if (j) {
          const p = (s.since('diff') * 0.8 + j * 0.3) % 1;
          s.alpha(0.9, () => s.arrow(x - 0.6 * u, y, x - 4.4 * u, y, s.c('red'), 0.4, 1.8));
          s.circle(lerp(x - 0.6 * u, x - 4.4 * u, p), y - 1.6 * u, 0.5 * u, { fill: s.c('red') });
        }
      });
    });
    s.alpha(s.ease('nolabel', 0.6), () => {
      const y = Math.min(h - 4 * u, iy + S + 13 * u);
      fit(s, 'no label ever says where to look', w / 2, y, w - 10 * u, { size: 3.4, italic: true, color: s.c('red') });
    });
  },
};

export const scenesA: Record<string, SceneDef> = { intro, bottleneck, scores, softmax, context };
