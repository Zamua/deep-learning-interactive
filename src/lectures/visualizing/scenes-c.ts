import { CIFAR_CLASSES } from '../../core/data';
import { fmt } from '../../core/code';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { type Stage, gram } from '../../lib/visualizing-net';
import { inferno } from '../../lib/visualizing-ui';
import { CLASS_VIZ, INVERT, type Assets, type Run, assets, classViz, dream, fgsm, filterCanvas, fooling, frameAt, heatCanvas, inversion, linearStats, mapCanvas, occlusion, once, sampleImg, saliency, stageMaps, testImg, texture, toCanvas } from './data';
import { type K, TAB10, area, bars, cap, fit, loading, pic, pill, ring } from './kit';
import { CAT, toolTiles } from './scenes-a';

/** A run's picture at `step` with a caption; a placeholder while the run has not got there. */
function runPic(s: Scene, r: Run | null, step: number, x: number, y: number, size: number, frame?: string): number {
  if (!r || !r.frames.length) {
    pic(s, null, x, y, size);
    return 0;
  }
  const f = frameAt(r, step);
  pic(s, f.c, x, y, size, size, frame ?? s.c('--rule'));
  return f.step;
}

// ---------------------------------------------------------------- class visualization

const classViz_: SceneDef = {
  marks: {
    obj: { tex: String.raw`\symx^{*} = \arg\max_{\symx}\ \symS_c(\symx) - \symlam \lVert \symx \rVert_2^2`, x: 0.5, y: 0.89, size: 4.8 },
  },
  draw(s) {
    const { w, h, u } = s;
    const a = assets(s);
    if (!a) return loading(s);
    const deer = classViz(s, 4);
    const [rx, ry, rw, rh] = area(s, 0.13, 0.05);
    // The question, turned around.
    s.alpha(s.win('turn', 'which'), () => {
      const fs = fit(s, 'saliency: an image in, a map out', w * 0.8, 4.6, 'ui', 600);
      pill(s, 'saliency: an image in, a map out', w / 2, h * 0.4, 'teal', { size: fs, font: 'ui' });
      s.alpha(s.ease('turn', 0.6, 1.2), () => pill(s, 'now: a class in, an image out', w / 2, h * 0.56, 'purple', { size: fs, font: 'ui' }));
    });
    const stripA = s.ease('strip', 0.7);
    const mainA = s.ease('which', 0.6) * (1 - stripA);
    const step = s.since('strip') >= 0 ? 300 : s.since('watch') >= 0 ? 100 + 200 * clamp01(s.prog('watch') * 1.15) : s.since('ascent') >= 0 ? 100 * s.span('ascent', 'watch') : 0;
    if (deer && deer.frames.length) {
      const f = frameAt(deer, step);
      s.slot('t', f.step);
      s.slot('prob', fmt(f.v, 3));
    }
    if (mainA > 0 && deer && deer.frames.length) {
      const S = Math.min(rw * 0.44, rh * 0.62);
      const ix = rx;
      const iy = ry + u * 4;
      const f = frameAt(deer, step);
      s.alpha(mainA, () => {
        runPic(s, deer, step, ix, iy, S);
        cap(s, `deer, step ${f.step}`, ix + S / 2, iy + S + u * 3.6, { weight: 650, color: s.c('--ink') });
        s.alpha(1 - s.ease('ascent', 0.5), () => s.text('?', ix + S / 2, iy + S / 2, { size: 12, font: 'display', weight: 600, color: s.c('purple'), halo: true }));
        // p(deer) against steps.
        const px = ix + S + u * 10;
        const pw = rx + rw - px - u * 2;
        const ph = S * 0.8;
        const py = iy + S * 0.1;
        s.alpha(s.ease('ascent', 0.6, 1), () => {
          s.line(px, py + ph, px + pw, py + ph, s.c('--axis'), 0.35);
          s.line(px, py, px, py + ph, s.c('--axis'), 0.35);
          s.text('1', px - u * 1.5, py, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'right' });
          s.text('0', px - u * 1.5, py + ph, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'right' });
          s.text('300', px + pw, py + ph + u * 3.4, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'right' });
          s.text('step', px + pw / 2, py + ph + u * 3.4, { size: 3, font: 'ui', color: s.c('--ink-3') });
          s.text('p(deer)', px + u * 2, py - u * 3, { size: 3.3, font: 'mono', weight: 600, color: s.c('purple'), align: 'left' });
          const ctx = s.ctx;
          ctx.beginPath();
          for (let k = 0; k <= f.k; k++) {
            const X = px + (k * deer.every * pw) / 300;
            const Y = py + ph * (1 - deer.vals[k]!);
            if (k) ctx.lineTo(X, Y);
            else ctx.moveTo(X, Y);
          }
          ctx.strokeStyle = s.c('purple');
          ctx.lineWidth = 0.6 * u;
          ctx.stroke();
          s.circle(px + (f.step * pw) / 300, py + ph * (1 - f.v), u * 1.1, { fill: s.c('purple') });
        });
        // The three tricks.
        const tA = s.win('tricks', 'watch');
        if (tA > 0) {
          const p = s.prog('tricks');
          const items: [string, number][] = [
            ['blur every 10 steps', 0.25],
            ['jitter by up to 2 px', 0.45],
            ['clip to valid colors', 0.8],
          ];
          s.alpha(tA, () =>
            items.forEach(([t, at], i) => {
              const y = iy + S + u * (11 + 6.5 * i);
              s.alpha(s.ease('tricks', 0.4, at * (s.end('tricks') - s.at('tricks')) - 0.3), () => pill(s, t, w / 2, y, 'slate', { size: 3.3, font: 'ui', on: p > at && (i === 2 || p < items[i + 1]![1]) ? 1 : 0 }));
            }),
          );
        }
      });
      s.show('obj', mainA * s.win('which', 'tricks') * s.ease('ascent', 0.6));
    }
    // Four finished pictures.
    if (stripA > 0) {
      const gap = u * 3;
      const S = Math.min((rw - 3 * gap) / 4, rh * 0.62);
      const x0 = rx + (rw - (4 * S + 3 * gap)) / 2;
      const y0 = ry + (rh - S) / 2 - u * 3;
      s.alpha(stripA, () =>
        CLASS_VIZ.forEach((c, i) => {
          const r = classViz(s, c);
          const ia = s.ease('strip', 0.5, i * 0.35);
          s.alpha(ia, () => {
            runPic(s, r, 300, x0 + i * (S + gap), y0, S);
            cap(s, CIFAR_CLASSES[c]!, x0 + i * (S + gap) + S / 2, y0 + S + u * 4, { size: 3.8, weight: 650, color: s.c('--ink') });
          });
        }),
      );
    }
  },
};

// ---------------------------------------------------------------- inversion

const FROG = (a: Assets): number => a.gallery[6]!;
const LNAME: Record<string, string> = { relu1: 'conv1', relu2: 'conv2', relu3: 'conv3', pool3: 'pool3' };

const inversion_: SceneDef = {
  marks: {
    obj: { tex: String.raw`\symx^{*} = \arg\min_{\symx} \frac{\lVert \symF(\symx) - \symF_0 \rVert^2}{\lVert \symF_0 \rVert^2} + \symlam R(\symx)`, x: 0.5, y: 0.88, size: 4.6 },
  },
  draw(s) {
    const { w, u } = s;
    const a = assets(s);
    if (!a) return loading(s);
    const [rx, ry, rw, rh] = area(s, 0.13, 0.05);
    const p2 = s.ease('conv1', 0.6);
    // Phase 1: one layer, converging.
    const p1 = 1 - p2;
    if (p1 > 0) {
      const r = inversion(s, 'relu2');
      const gap = u * 6;
      const S = Math.min((rw - gap) / 2, rh * 0.58);
      const x0 = rx + (rw - (2 * S + gap)) / 2;
      const y0 = ry + u * 3;
      const step = s.since('search') < 0 ? 0 : 200 * smooth(s.span('search', 'conv1'));
      s.slot('layer', 'conv2');
      s.alpha(p1, () => {
        pic(s, testImg(a, FROG(a)), x0, y0, S);
        cap(s, 'original x0', x0 + S / 2, y0 + S + u * 3.6, { color: s.c('orange') });
        s.alpha(s.ease('remember', 0.6, 1.2), () => {
          s.arrow(x0 + S + u, y0 + S / 2, x0 + S + gap - u, y0 + S / 2, s.c('--ink-3'), 0.4, 2);
          cap(s, 'its conv2 code: F0', x0 + S / 2, y0 + S + u * 7.6, { font: 'mono', size: 3.1, color: s.c('green') });
        });
        s.alpha(s.ease('search', 0.6), () => {
          const st = runPic(s, r, step, x0 + S + gap, y0, S);
          const f = r && r.frames.length ? frameAt(r, step) : null;
          cap(s, `rebuilt, step ${st}`, x0 + 1.5 * S + gap, y0 + S + u * 3.6, { weight: 650, color: s.c('--ink') });
          if (f && s.since('descend') >= 0) cap(s, `mismatch ${f.v.toFixed(3)}`, x0 + 1.5 * S + gap, y0 + S + u * 7.6, { font: 'mono', size: 3.1, color: s.c('red') });
        });
      });
      s.show('obj', p1 * s.ease('descend', 0.6));
    }
    // Phase 2: every layer, side by side.
    if (p2 > 0) {
      const gap = u * 3;
      const S = Math.min((rw - 2 * gap) / 3, (rh - 2 * u * 8 - gap - u * 9) / 2);
      const top = ry + (rh - (2 * S + 2 * u * 8 + gap + u * 9)) / 2 + u * 2;
      const cells: [number, number][] = [0, 1, 2, 3, 4].map((i) => (i < 3 ? [rx + (rw - (3 * S + 2 * gap)) / 2 + i * (S + gap), top] : [rx + (rw - (2 * S + gap)) / 2 + (i - 3) * (S + gap), top + S + u * 8 + gap]));
      const when: (string | null)[] = [null, 'conv1', 'conv2', 'deep', 'deep'];
      const latest = s.since('deep') >= 0 ? 'pool3' : s.since('conv2') >= 0 ? 'conv2' : 'conv1';
      s.slot('layer', latest);
      s.alpha(p2, () => {
        const [ox, oy] = cells[0]!;
        pic(s, testImg(a, FROG(a)), ox, oy, S);
        cap(s, 'original', ox + S / 2, oy + S + u * 3.6, { color: s.c('orange'), weight: 650 });
        INVERT.forEach((l: Stage, i) => {
          const b = when[i + 1]!;
          const delay = i === 3 ? 0.8 : 0;
          const ia = s.ease(b, 0.5, delay);
          if (ia <= 0) return;
          const [x, y] = cells[i + 1]!;
          const st = 200 * smooth((s.since(b) - delay) / 2.6);
          s.alpha(ia, () => {
            runPic(s, inversion(s, l), st, x, y, S);
            cap(s, `from ${LNAME[l]}`, x + S / 2, y + S + u * 3.6, { weight: 650, color: s.c('green') });
          });
        });
        s.alpha(s.ease('invariance', 0.6), () => {
          const t = 'deeper codes keep the layout, drop the details';
          cap(s, t, w / 2, top + 2 * S + 2 * u * 8 + gap + u * 3, { size: fit(s, t, rw, 3.8, 'ui'), weight: 650, color: s.c('--accent') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- DeepDream and style

/** The pair of frog conv1 maps that fire together most, and their product. */
function gramPair(a: Assets): { i: number; j: number; prod: HTMLCanvasElement; G: Float32Array; gcan: HTMLCanvasElement } {
  return once('grampair', () => {
    const F = a.net.stage(a.net.forward(a.net.input(a.test.pixels, FROG(a))), 'relu1');
    const G = gram(F, 16, 1024);
    let bi = 0;
    let bj = 1;
    for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) if (G[i * 16 + j]! > G[bi * 16 + bj]!) [bi, bj] = [i, j];
    const P = new Float32Array(1024);
    let hi = 0;
    for (let k = 0; k < 1024; k++) {
      P[k] = F[bi * 1024 + k]! * F[bj * 1024 + k]!;
      hi = Math.max(hi, P[k]!);
    }
    let gh = 0;
    for (const v of G) gh = Math.max(gh, v);
    const img = new ImageData(16, 16);
    for (let q = 0; q < 256; q++) {
      const c = inferno(Math.sqrt(Math.max(0, G[q]!) / gh));
      img.data[q * 4] = c[0];
      img.data[q * 4 + 1] = c[1];
      img.data[q * 4 + 2] = c[2];
      img.data[q * 4 + 3] = 255;
    }
    return { i: bi, j: bj, prod: mapCanvas(P, 0, 32, hi), G, gcan: toCanvas(img) };
  });
}

const dreamStyle: SceneDef = {
  marks: {
    G: { tex: String.raw`\symG_{ij} = \frac{1}{M}\sum_{k=1}^{M} \symF_{ik}\,\symF_{jk}`, x: 0.5, y: 0.88, size: 4.8 },
    L: { tex: String.raw`\mathcal{L} = \alpha \lVert \symF(\symx) - \symF(\symx_c) \rVert^2 + \beta \textstyle\sum_l \lVert \symG_l(\symx) - \symG_l(\symx_s) \rVert^2`, x: 0.5, y: 0.8, size: 4.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    const a = assets(s);
    if (!a) return loading(s);
    const [rx, ry, rw, rh] = area(s, 0.13, 0.05);
    // DeepDream.
    const dA = s.win('dream', 'style');
    if (dA > 0) {
      const r = dream(s);
      const gap = u * 6;
      const S = Math.min((rw - gap) / 2, rh * 0.66);
      const x0 = rx + (rw - (2 * S + gap)) / 2;
      const y0 = ry + (rh - S) / 2 - u * 4;
      const step = s.since('amplify') < 0 ? 0 : 60 * clamp01(s.span('amplify', 'style') * 1.1);
      s.alpha(dA, () => {
        const ox = lerp(rx + (rw - S) / 2, x0, s.ease('amplify', 0.8));
        pic(s, testImg(a, a.gallery[16]!), ox, y0, S);
        cap(s, 'original', ox + S / 2, y0 + S + u * 3.6);
        s.alpha(s.ease('amplify', 0.6), () => {
          const st = runPic(s, r, step, x0 + S + gap, y0, S);
          cap(s, `dreaming on conv3, step ${st}`, x0 + 1.5 * S + gap, y0 + S + u * 3.6, { weight: 650, color: s.c('gold'), size: fit(s, 'dreaming on conv3, step 60', S, 3.3, 'ui', 650) });
          s.alpha(s.ease('amplify', 0.6, 0.5 * (s.end('amplify') - s.at('amplify'))), () => pill(s, 'inject dF = F', x0 + 1.5 * S + gap, y0 - u * 4, 'green', { size: 3.2 }));
        });
      });
    }
    // Content and style.
    const cA = s.win('style', 'gram');
    if (cA > 0) {
      const tall = s.tall;
      const cw = tall ? rw : (rw - u * 4) / 2;
      const chh = tall ? (rh - u * 4) / 2 : rh * 0.7;
      const inv = inversion(s, 'relu3');
      const gp = gramPair(a);
      s.alpha(cA, () => {
        const card = (i: number, title: string, l1: string, l2: string, k: K, draw: (x: number, y: number, size: number) => void, at: number) => {
          const x = tall ? rx : rx + i * (cw + u * 4);
          const y = tall ? ry + i * (chh + u * 4) : ry + (rh - chh) / 2;
          const ia = s.ease('style', 0.6, at * (s.end('style') - s.at('style')));
          s.alpha(ia, () => {
            s.rrect(x, y, cw, chh, 2, { fill: s.tint(k, 0.07), stroke: s.tint(k, 0.55) });
            const ps = Math.min(chh * 0.62, cw * 0.42);
            const px = tall ? x + u * 4 : x + (cw - ps) / 2;
            const py = tall ? y + (chh - ps) / 2 : y + u * 12;
            draw(px, py, ps);
            const tx = tall ? px + ps + u * 4 : x + cw / 2;
            const al: CanvasTextAlign = tall ? 'left' : 'center';
            const ty = tall ? y + chh * 0.32 : py - u * 5;
            const tw = tall ? x + cw - tx - u * 2 : cw * 0.9;
            s.text(title, tx, ty, { size: 5, font: 'display', weight: 600, color: s.c(k), align: al });
            const by = tall ? y + chh * 0.58 : py + ps + u * 6;
            s.text(l1, tx, by, { size: fit(s, l1, tw, 3.4, 'ui'), font: 'ui', align: al });
            s.text(l2, tx, by + u * 5, { size: fit(s, l2, tw, 3.4, 'ui'), font: 'ui', align: al, color: s.c('--ink-3') });
          });
        };
        card(0, 'content', 'a deep layer\'s feature maps', 'what is where', 'green', (x, y, z) => runPic(s, inv, 200, x, y, z), 0.55);
        card(1, 'style', 'Gram matrices', 'which features fire together', 'gold', (x, y, z) => pic(s, gp.gcan, x, y, z), 0.8);
      });
    }
    // The Gram matrix: two maps, multiplied, summed.
    const gA = s.win('gram', 'texture');
    if (gA > 0) {
      const gp = gramPair(a);
      const maps = stageMaps(a, FROG(a), 'relu1');
      const S = Math.min((rw - u * 22) / 4, rh * 0.42);
      const y0 = ry + u * 6;
      const xs = [0, 1, 2, 3].map((i) => rx + (rw - (4 * S + u * 22)) / 2 + i * (S + u * 7.3));
      const p = s.prog('gram');
      s.alpha(gA, () => {
        pic(s, maps[gp.i], xs[0]!, y0, S);
        cap(s, `F[${gp.i}]`, xs[0]! + S / 2, y0 + S + u * 3.4, { font: 'mono', color: s.c('green') });
        s.text('×', (xs[0]! + S + xs[1]!) / 2, y0 + S / 2, { size: 6, color: s.c('--ink-2') });
        pic(s, maps[gp.j], xs[1]!, y0, S);
        cap(s, `F[${gp.j}]`, xs[1]! + S / 2, y0 + S + u * 3.4, { font: 'mono', color: s.c('green') });
        s.alpha(clamp01((p - 0.35) * 5), () => {
          s.text('=', (xs[1]! + S + xs[2]!) / 2, y0 + S / 2, { size: 6, color: s.c('--ink-2') });
          pic(s, gp.prod, xs[2]!, y0, S);
          cap(s, 'position by position', xs[2]! + S / 2, y0 + S + u * 3.4, { size: fit(s, 'position by position', S + u * 6, 3.1, 'ui') });
        });
        s.alpha(clamp01((p - 0.7) * 5), () => {
          s.text('Σ', (xs[2]! + S + xs[3]!) / 2, y0 + S / 2, { size: 5.5, color: s.c('--ink-2') });
          pic(s, gp.gcan, xs[3]!, y0, S);
          const c = S / 16;
          ring(s, xs[3]! + gp.j * c, y0 + gp.i * c, c, c, s.c('--accent'), 0.45);
          cap(s, `G: 16×16`, xs[3]! + S / 2, y0 + S + u * 3.4, { font: 'mono', color: s.c('gold') });
        });
        s.alpha(s.ease('where', 0.6), () => {
          const t = 'big where two features fire together; the sum forgets where';
          cap(s, t, w / 2, y0 + S + u * 11, { size: fit(s, t, rw, 3.5, 'ui'), weight: 600, color: s.c('gold') });
        });
      });
      s.show('G', gA * s.ease('gram', 0.6, 0.5));
    }
    // Texture synthesis.
    const tA = s.win('texture', 'transfer');
    if (tA > 0) {
      const r = texture(s);
      const gap = u * 4;
      const S = Math.min((rw - 3 * gap) / 4, rh * 0.62);
      const x0 = rx + (rw - (4 * S + 3 * gap)) / 2;
      const y0 = ry + (rh - S) / 2 - u * 2;
      const step = 300 * smooth(clamp01(s.span('texture', 'transfer') * 1.15));
      s.alpha(tA, () => {
        pic(s, testImg(a, FROG(a)), x0, y0, S);
        cap(s, 'source', x0 + S / 2, y0 + S + u * 3.6);
        if (r) pic(s, r.src, x0 + S + gap, y0, S);
        cap(s, 'its Gram', x0 + 1.5 * S + gap, y0 + S + u * 3.6, { color: s.c('gold') });
        const st = runPic(s, r, step, x0 + 2 * (S + gap), y0, S);
        cap(s, `from noise, step ${st}`, x0 + 2.5 * S + 2 * gap, y0 + S + u * 3.6, { size: fit(s, 'from noise, step 300', S + gap, 3.3, 'ui'), weight: 650, color: s.c('--ink') });
        if (r && r.grams.length) pic(s, r.grams[frameAt(r, step).k], x0 + 3 * (S + gap), y0, S);
        cap(s, 'its Gram', x0 + 3.5 * S + 3 * gap, y0 + S + u * 3.6, { color: s.c('gold') });
        s.alpha(s.ease('texture', 0.6, 0.55 * (s.end('texture') - s.at('texture'))), () => {
          const t = 'same colors and textures, scrambled: the frog is gone';
          cap(s, t, w / 2, y0 - u * 5, { size: fit(s, t, rw, 3.5, 'ui'), weight: 600, color: s.c('--accent') });
        });
      });
    }
    // Style transfer.
    const xA = s.ease('transfer', 0.6);
    if (xA > 0) {
      s.alpha(xA, () => {
        const items: [string, string, K][] = [
          ['content term', 'keeps the photo\'s layout', 'green'],
          ['style terms', 'borrow an artwork\'s textures', 'gold'],
        ];
        items.forEach(([t1, t2, k], i) => {
          const y = h * (0.3 + 0.18 * i);
          s.alpha(s.ease('transfer', 0.5, 0.8 + i * 1.6), () => {
            pill(s, t1, w * 0.5 - u * 2, y, k, { size: 3.6, font: 'ui', align: 'right' });
            s.text(t2, w * 0.5 + u * 2, y, { size: fit(s, t2, w * 0.42, 3.6, 'ui'), font: 'ui', align: 'left' });
          });
        });
      });
      s.show('L', xA);
    }
  },
};

// ---------------------------------------------------------------- fooling

const fool: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const a = assets(s);
    const f = fooling(s);
    s.alpha(s.win('now', 'find'), () => {
      s.text('fooling the network', w / 2, h * 0.46, { size: fit(s, 'fooling the network', w * 0.8, 8, 'display', 600), font: 'display', weight: 600, color: s.c('red') });
    });
    if (!a || !f) return s.since('find') >= 0 ? loading(s) : undefined;
    const [rx, ry, rw, rh] = area(s, 0.13, 0.05);
    const gap = u * 4;
    const S = Math.min((rw - 2 * gap) / 3, rh * 0.34);
    const x0 = rx + (rw - (3 * S + 2 * gap)) / 2;
    const y0 = ry + u * 7;
    const n = f.frames.length - 1;
    const k = s.since('step') < 0 ? 0 : s.since('done') >= 0 ? n : Math.round(n * clamp01(s.span('step', 'done') * 1.1));
    const kk = Math.min(k, n);
    s.slot('t', kk);
    s.slot('linf', fmt(f.linf[kk]!, 3));
    const pA = s.ease('find', 0.6);
    s.alpha(pA, () => {
      pic(s, testImg(a, f.img), x0, y0, S);
      cap(s, 'original', x0 + S / 2, y0 + S + u * 3.4);
      s.alpha(s.ease('step', 0.5), () => {
        pic(s, f.diffs[kk], x0 + S + gap, y0, S);
        cap(s, kk ? `difference × ${Math.round(f.mag[kk]!)}` : 'difference', x0 + 1.5 * S + gap, y0 + S + u * 3.4, { size: fit(s, 'difference × 39', S + gap * 0.8, 3.3, 'ui') });
        pic(s, f.frames[kk], x0 + 2 * (S + gap), y0, S);
        cap(s, 'adversarial', x0 + 2.5 * S + 2 * gap, y0 + S + u * 3.4);
      });
      const by = y0 + S + u * 9;
      const bh = ry + rh - by;
      const bw = Math.min(rw, u * 90);
      const tg = s.since('try') >= 0 ? f.target : undefined;
      bars(s, f.probs[kk]!, w / 2 - bw / 2, by, bw, bh, { mark: a.test.labels[f.img]!, mark2: tg });
    });
    s.alpha(s.ease('try', 0.5, 1.2) * (1 - s.ease('done', 0.4)), () => pill(s, 'target: plane', w / 2, ry + u * 1.5, 'red', { size: 3.3, font: 'ui' }));
    s.alpha(s.win('done', 'transfer', 0.5) * s.ease('done', 0.6, 0.4), () => {
      const t = f.finished ? `${n} steps, max change ${f.linf[n]!.toFixed(2)} of 255` : `step ${n}…`;
      pill(s, t, w / 2, ry + u * 1.5, 'red', { size: fit(s, t, rw * 0.8, 3.2, 'mono') });
    });
    s.alpha(s.win('transfer', 'reverse', 0.5), () => pill(s, 'often fools other networks too', w / 2, ry + u * 1.5, 'red', { size: 3.3, font: 'ui' }));
    s.alpha(s.ease('reverse', 0.5, 0.5), () => pill(s, 'and noise can pass for an object', w / 2, ry + u * 1.5, 'red', { size: 3.3, font: 'ui' }));
  },
};

// ---------------------------------------------------------------- too linear

const NS = [10, 3072, 150528];

/** n on screen: growing through 'grows', then stepping 10, 3,072, 150,528 through 'big'. */
function nAt(s: Scene): number {
  if (s.since('big') >= 0) return NS[Math.min(2, Math.floor(s.prog('big') * 3.3))]!;
  if (s.since('grows') >= 0) return Math.round(10 * 10 ** (smooth(clamp01(s.prog('grows') * 1.2)) * Math.log10(307.2)));
  return 10;
}

const linear: SceneDef = {
  marks: {
    lin: { tex: String.raw`\symW^{\top}\big(\symx + \symeps\,\mathrm{sign}(\symW)\big) = \symW^{\top}\symx + \symeps \lVert \symW \rVert_1`, x: 0.5, y: 0.925, size: 4.4 },
    fgsm: { tex: String.raw`\symx_{\text{adv}} = \symx + \symeps\, \mathrm{sign}\big(\nabla_{\!\symx} L(\symx, y)\big)`, x: 0.5, y: 0.9, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const [rx, ry, rw, rh] = area(s, 0.13, 0.06);
    // The two guesses.
    s.alpha(s.win('guess', 'setup'), () => {
      const g1 = 'too nonlinear?';
      s.text(g1, w / 2, h * 0.4, { size: 7, font: 'display', weight: 600, color: s.c('--ink-3') });
      const cross = s.ease('opposite', 0.5);
      if (cross > 0) {
        const tw = s.measure(g1, { size: 7, font: 'display', weight: 600 });
        s.line(w / 2 - tw / 2, h * 0.4, w / 2 - tw / 2 + tw * cross, h * 0.4, s.c('red'), 0.6);
      }
      s.alpha(s.ease('opposite', 0.6, 0.8), () => s.text('too linear', w / 2, h * 0.56, { size: 8, font: 'display', weight: 600, color: s.c('red') }));
    });
    // The ruler and the score.
    const n = nAt(s);
    const L = linearStats(n);
    s.slot('n', n);
    s.slot('shift', fmt(L.shift, 3));
    const dA = s.win('setup', 'fgsm');
    if (dA > 0) {
      s.alpha(dA, () => {
        const ty = ry + u * 4;
        s.text('one input, on the 0 to 255 pixel scale', rx, ty, { size: fit(s, 'one input, on the 0 to 255 pixel scale', rw, 3.4, 'ui'), font: 'ui', weight: 600, align: 'left' });
        const ly = ty + u * 8;
        s.line(rx, ly, rx + rw, ly, s.c('--axis'), 0.35);
        for (let v = 0; v <= 255; v += 51) {
          const x = rx + (rw * v) / 255;
          s.line(x, ly - u, x, ly + u, s.c('--axis'), 0.3);
          s.text(String(v), x, ly + u * 3.6, { size: 2.9, font: 'mono', color: s.c('--ink-3'), align: v === 0 ? 'left' : v === 255 ? 'right' : 'center' });
        }
        const xv = rx + rw * 0.5;
        const band = Math.max(2, (rw * 2) / 255);
        s.alpha(s.ease('tiny', 0.5), () => {
          s.rrect(xv, ly - u * 2, band, u * 4, 0.2, { fill: s.tint('red', 0.6) });
          cap(s, 'ε = 2 levels', xv + band + u * 2, ly - u * 3.2, { align: 'left', size: 3.1, color: s.c('red'), weight: 650 });
        });
        s.circle(xv, ly, u * 1.2, { fill: s.c('orange') });
        // The score, the spread of ordinary scores, and the shift.
        const top = ly + u * 12;
        s.text('the score W·x', rx, top, { size: 3.4, font: 'ui', weight: 600, align: 'left' });
        pill(s, `n = ${n.toLocaleString('en-US')}`, rx + rw, top, 'slate', { size: 3.2, align: 'right' });
        const base = ry + rh - u * 13;
        const peak = base - top - u * 8;
        const half = Math.max(4 * L.sd, Math.abs(L.s0 - L.mu) + L.shift + L.sd);
        const sx = (v: number) => rx + ((v - L.mu + half) / (2 * half)) * rw;
        const ctx = s.ctx;
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
          const v = L.mu - half + (2 * half * i) / 160;
          const y = base - peak * Math.exp(-((v - L.mu) ** 2) / (2 * L.sd * L.sd));
          if (i) ctx.lineTo(sx(v), y);
          else ctx.moveTo(sx(v), y);
        }
        ctx.lineTo(rx + rw, base);
        ctx.lineTo(rx, base);
        ctx.closePath();
        ctx.fillStyle = s.tint('--ink-3', 0.18);
        ctx.fill();
        s.line(rx, base, rx + rw, base, s.c('--axis'), 0.35);
        cap(s, 'spread over ordinary inputs', sx(L.mu), base + u * 3.6, { size: 3, color: s.c('--ink-3') });
        const ya = base - peak * 0.55;
        const shA = s.ease('adds', 0.6, 0.5);
        if (shA > 0) {
          const x1 = lerp(sx(L.s0), sx(L.s0 + L.shift), shA);
          if (x1 - sx(L.s0) > u * 2.2) s.arrow(sx(L.s0), ya, x1, ya, s.c('red'), 0.7, 2.6);
          s.circle(x1, ya, u * 1.2, { fill: s.c('red') });
        }
        s.circle(sx(L.s0), ya, u * 1.2, { fill: s.c('orange') });
        s.alpha(shA, () => {
          const ratio = L.shift / L.sd;
          pill(s, `shift = ${ratio.toFixed(ratio < 1 ? 2 : 1)} spreads`, (rx + rx + rw) / 2, top + u * 6, 'red', { size: 3.3 });
        });
      });
      s.show('lin', dA * s.ease('adds', 0.6) * (1 - s.ease('grows', 0.4)));
    }
    // FGSM on the real network.
    const fA = s.win('fgsm', 'matters');
    if (fA > 0) {
      const a = assets(s);
      const g = fgsm(s);
      const fo = fooling(s);
      if (!a || !g || !fo) return loading(s);
      s.alpha(fA * (1 - s.ease('panda', 0.5)), () => {
        const S = Math.min(rw * 0.3, rh * 0.42);
        const y0 = ry + u * 4;
        pic(s, testImg(a, fo.img), rx, y0, S);
        cap(s, 'x: a deer', rx + S / 2, y0 + S + u * 3.6);
        const tx = rx + S + u * 6;
        s.text('one FGSM step of size ε:', tx, y0 + u * 3, { size: fit(s, 'one FGSM step of size ε:', rx + rw - tx, 3.5, 'ui'), font: 'ui', weight: 600, align: 'left' });
        g.eps.forEach((e, i) => {
          const y = y0 + u * (10 + 6.5 * i);
          const flipped = g.preds[i] !== a.test.labels[fo.img];
          s.alpha(s.ease('fgsm', 0.4, 1 + i * 0.6), () => {
            s.text(`ε = ${e}/255`, tx, y, { size: 3.3, font: 'mono', align: 'left' });
            s.text(`${CIFAR_CLASSES[g.preds[i]!]} ${Math.round(g.conf[i]! * 100)}%`, tx + u * 20, y, { size: 3.3, font: 'mono', weight: 650, color: s.c(flipped ? 'red' : '--ink-2'), align: 'left' });
          });
        });
      });
      s.show('fgsm', fA * (1 - s.ease('panda', 0.5)));
      s.alpha(s.ease('panda', 0.6), () => {
        const items: [string, K][] = [
          ['panda, 58%', 'slate'],
          ['+ 0.007 × sign(∇)', 'red'],
          ['= gibbon, 99%', 'red'],
        ];
        items.forEach(([t, k], i) => {
          const fs = fit(s, '+ 0.007 × sign(∇)', s.tall ? rw : rw / 3.3, 4, 'mono');
          const x = s.tall ? w / 2 : rx + rw * (0.17 + 0.33 * i);
          const y = s.tall ? h * (0.32 + 0.14 * i) : h * 0.45;
          s.alpha(s.ease('panda', 0.5, 0.4 + i * 0.7), () => pill(s, t, x, y, k, { size: fs }));
        });
        cap(s, 'GoogLeNet, Goodfellow et al. 2014', w / 2, h * (s.tall ? 0.8 : 0.62), { size: 3, italic: true });
      });
    }
    // Why it matters.
    const mA = s.ease('matters', 0.6);
    if (mA > 0) {
      const lines: [string, K][] = [
        ['whoever controls the input can attack', 'red'],
        ['linear classifiers fall the same way', 'blue'],
        ['adversarial training helps, not cures', 'green'],
      ];
      s.alpha(mA, () =>
        lines.forEach(([t, k], i) => {
          const y = h * (0.3 + 0.17 * i);
          s.alpha(s.ease('matters', 0.5, i * 0.33 * (s.end('matters') - s.at('matters'))), () => {
            s.rrect(rx, y - u * 5, rw, u * 10, 2, { fill: s.tint(k, 0.08), stroke: s.tint(k, 0.5) });
            s.text(t, w / 2, y, { size: fit(s, t, rw * 0.9, 4, 'ui', 600), font: 'ui', weight: 600, color: s.c(k) });
          });
        }),
      );
    }
  },
};

// ---------------------------------------------------------------- closing

function thumb(s: Scene, a: Assets, i: number, x: number, y: number, z: number): void {
  const quad = (cs: (HTMLCanvasElement | undefined)[]) => {
    const h2 = z / 2;
    cs.slice(0, 4).forEach((c, k) => pic(s, c, x + (k % 2) * h2, y + Math.floor(k / 2) * h2, h2, h2, null));
    s.rrect(x, y, z, z, 0.4, { stroke: s.c('--rule'), lw: 0.2 });
  };
  const last = (r: Run | null) => (r && r.frames.length ? r.frames[r.frames.length - 1] : undefined);
  switch (i) {
    case 0:
      return quad(stageMaps(a, CAT(a), 'relu1').slice(2, 6));
    case 1:
      return quad([0, 2, 10, 13].map((k) => once(`snap-5-${k}`, () => filterCanvas(a.net.snapshots[5]!.W, k * 147, 7))));
    case 2:
      return quad(a.an.units.pool3![20]!.slice(0, 4).map(([j]) => sampleImg(a, j)));
    case 3: {
      s.rrect(x, y, z, z, 0.4, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.2 });
      for (let j = 0; j < 1000; j += 3) {
        const [px, py] = a.an.tsne.codes[j]!;
        s.ctx.fillStyle = TAB10[a.an.labels[j]!]!;
        s.ctx.fillRect(x + z / 2 + px * z * 0.45 - 1, y + z / 2 - py * z * 0.45 - 1, 2, 2);
      }
      return;
    }
    case 4: {
      const o = occlusion(s);
      return pic(s, o && o.pos >= 256 ? heatCanvas(o, 256).c : undefined, x, y, z);
    }
    case 5:
      return pic(s, saliency(s)?.maps.get('grad-5')?.sal, x, y, z);
    case 6:
      return pic(s, last(classViz(s, 4)), x, y, z);
    case 7:
      return pic(s, last(inversion(s, 'relu2')), x, y, z);
    case 8:
      return pic(s, last(dream(s)), x, y, z);
    case 9:
      return pic(s, last(texture(s)), x, y, z);
    default: {
      const f = fooling(s);
      return pic(s, f ? f.diffs[f.diffs.length - 1] : undefined, x, y, z);
    }
  }
}

/** Which tiles each recap beat names, in beat order. */
const GROUPS: [string, number[]][] = [
  ['health', [0, 1]],
  ['meaning', [2, 3]],
  ['where', [4, 5]],
  ['draw', [6, 7, 8, 9]],
  ['fool', [10]],
];

const closing: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const a = assets(s);
    const nA = s.ease('next', 0.7, 0.3);
    const group = (i: number): number => GROUPS.findIndex(([, ids]) => ids.includes(i));
    const lit = (i: number): number => {
      const g = group(i);
      const next = GROUPS[g + 1]?.[0] ?? 'clue';
      return s.since(GROUPS[g]![0]) >= 0 && s.since(next) < 0 ? 1 : 0;
    };
    const done = (i: number): number => s.ease(GROUPS[group(i)]![0], 0.5, 0.3);
    s.alpha(1 - nA, () =>
      toolTiles(
        s,
        area(s, 0.13, 0.04),
        (i) => s.ease('recap', 0.5, 0.08 * i),
        lit,
        a ? (i, x, y, z) => thumb(s, a, i, x, y, z) : undefined,
        done,
      ),
    );
    s.alpha(s.win('clue', 'next'), () => {
      const t = 'each picture: a clue, not an explanation';
      const fs = fit(s, t, w * 0.84, 5, 'display', 600);
      const bw = s.measure(t, { size: fs, font: 'display', weight: 600 }) + u * 8;
      s.rrect(w / 2 - bw / 2, h * 0.5 - fs * u * 1.1, bw, fs * u * 2.2, 2.5, { fill: s.c('--card'), stroke: s.c('--accent'), lw: 0.45 });
      s.text(t, w / 2, h * 0.5, { size: fs, font: 'display', weight: 600, color: s.c('--accent') });
    });
    s.alpha(nA, () => {
      s.text('next: the interactive chapter', w / 2, h * 0.42, { size: fit(s, 'next: the interactive chapter', w * 0.86, 6.4, 'display', 600), font: 'display', weight: 600 });
      const t = 'every figure runs this network live, beside its code';
      s.text(t, w / 2, h * 0.54, { size: fit(s, t, w * 0.86, 3.8, 'serif'), italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('next', 0.6, 0.75 * (s.end('next') - s.at('next'))), () => s.text('see you there', w / 2, h * 0.68, { size: 4.6, font: 'display', italic: true, color: s.c('--accent') }));
    });
  },
};

export const scenesC: Record<string, SceneDef> = { 'class-viz': classViz_, inversion: inversion_, 'dream-style': dreamStyle, fooling: fool, linear, closing };
