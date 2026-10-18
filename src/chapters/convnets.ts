import type { ChapterDef } from './index';
import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { CIFAR_CLASSES, type CifarSet, cifarImage, loadCifar } from '../core/data';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { blit, bytes, cell, count, drawGray, frame, grayOf, mono, txt } from '../lib/convnets-draw';

/** Pointer position in CSS px relative to a canvas. */
function local(e: PointerEvent, c: HTMLCanvasElement): [number, number] {
  const r = c.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

/** First training image of each listed class, for figures that show "a car", "a ship", ... */
function picks(set: CifarSet, classes: number[]): number[] {
  return classes.map((c) => {
    for (let i = 0; i < set.n; i++) if (set.labels[i] === c) return i;
    return 0;
  });
}

// ---------------------------------------------------------------------------------------
// Fig: a 3x3 filter on a real grayscale CIFAR image

function figKernel(f: Fig): void {
  const PRESETS: Record<string, { k: number[]; div: number }> = {
    vedge: { k: [-1, 0, 1, -2, 0, 2, -1, 0, 1], div: 1 },
    hedge: { k: [-1, -2, -1, 0, 0, 0, 1, 2, 1], div: 1 },
    blur: { k: [1, 2, 1, 2, 4, 2, 1, 2, 1], div: 16 },
    sharpen: { k: [0, -1, 0, -1, 5, -1, 0, -1, 0], div: 1 },
    emboss: { k: [-2, -1, 0, -1, 1, 1, 0, 1, 2], div: 1 },
  };
  let kw = [...PRESETS.vedge.k];
  let div = 1;
  let sel = 4;
  let ci = 16;
  let cj = 13;
  let relu = false;
  let set: CifarSet | null = null;
  let list: number[] = [];
  let pick = 0;
  let img: Float64Array = new Float64Array(1024);
  const A = new Float64Array(1024);
  let cw = 0;
  let ch = 0;
  const at = (r: number, c: number) => (r < 0 || c < 0 || r > 31 || c > 31 ? 0 : img[r * 32 + c]);
  const conv = () => {
    for (let i = 0; i < 32; i++)
      for (let j = 0; j < 32; j++) {
        let s = 0;
        for (let u = 0; u < 3; u++) for (let v = 0; v < 3; v++) s += at(i + u - 1, j + v - 1) * kw[u * 3 + v];
        s /= div;
        A[i * 32 + j] = relu ? Math.max(0, s) : s;
      }
  };
  const geo = (w: number, h: number) => {
    const gap = Math.max(16, w * 0.04);
    const s = Math.min((w - gap - 8) / 2, h * 0.55);
    const xIn = (w - (2 * s + gap)) / 2;
    const xOut = xIn + s + gap;
    const yImg = 22;
    const yK = yImg + s + 34;
    const c = Math.min(w / 10.4, (h - yK - 22) / 3);
    const rowW = 3 * c + 0.9 * c + 3 * c + 0.9 * c + 2.3 * c;
    const xP = (w - rowW) / 2;
    const xW = xP + 3.9 * c;
    const xV = xW + 3.9 * c;
    return { s, xIn, xOut, yImg, yK, c, xP, xW, xV, ps: s / 32 };
  };
  const cv = f.canvas(640, 600, (ctx, w, h) => {
    cw = w;
    ch = h;
    const g = geo(w, h);
    const cls = set ? CIFAR_CLASSES[set.labels[list[pick]]] : '';
    txt(ctx, `input X${cls ? `: a ${cls}` : ''}`, g.xIn, g.yImg - 7, { size: 12, ink: color('orange') });
    txt(ctx, `output A${relu ? ' (after ReLU)' : ''}`, g.xOut, g.yImg - 7, { size: 12, ink: color('purple') });
    // the zero-padding ring
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = color('--rule');
    ctx.lineWidth = 1;
    ctx.strokeRect(g.xIn - g.ps, g.yImg - g.ps, g.s + 2 * g.ps, g.s + 2 * g.ps);
    ctx.setLineDash([]);
    if (set) drawGray(ctx, img, 32, g.xIn, g.yImg, g.s, (v) => v);
    else {
      ctx.fillStyle = color('--paper-2');
      ctx.fillRect(g.xIn, g.yImg, g.s, g.s);
      txt(ctx, 'loading…', g.xIn + g.s / 2, g.yImg + g.s / 2, { align: 'center', size: 12 });
    }
    let mx = 1e-9;
    let neg = false;
    for (let k = 0; k < 1024; k++) {
      mx = Math.max(mx, Math.abs(A[k]));
      if (A[k] < -1e-9) neg = true;
    }
    drawGray(ctx, A, 32, g.xOut, g.yImg, g.s, neg ? (v) => 0.5 + (0.5 * v) / mx : (v) => v / mx);
    // receptive field and the output pixel it feeds
    frame(ctx, g.xIn + (cj - 1) * g.ps, g.yImg + (ci - 1) * g.ps, 3 * g.ps, 3 * g.ps, color('orange'), 2.5);
    frame(ctx, g.xOut + cj * g.ps - 1, g.yImg + ci * g.ps - 1, g.ps + 2, g.ps + 2, color('purple'), 2.5);
    ctx.strokeStyle = withAlpha(color('purple'), 0.5);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(g.xIn + (cj + 2) * g.ps, g.yImg + (ci + 0.5) * g.ps);
    ctx.lineTo(g.xOut + cj * g.ps - 2, g.yImg + (ci + 0.5) * g.ps);
    ctx.stroke();
    ctx.setLineDash([]);
    // patch (*) W = A[i, j]
    const c = g.c;
    const lab = (s: string, x: number, col: string) => txt(ctx, s, x, g.yK - 8, { size: 12, ink: col, align: 'center' });
    lab('patch of X', g.xP + 1.5 * c, color('orange'));
    lab(`W${div !== 1 ? ` (÷ ${div})` : ''}`, g.xW + 1.5 * c, color('blue'));
    lab(`A[${ci}, ${cj}]`, g.xV + 1.15 * c, color('purple'));
    const fs = Math.max(11, Math.min(14, c * 0.32));
    for (let u = 0; u < 3; u++)
      for (let v = 0; v < 3; v++) {
        const pv = at(ci + u - 1, cj + v - 1);
        const pad = ci + u - 1 < 0 || cj + v - 1 < 0 || ci + u - 1 > 31 || cj + v - 1 > 31;
        cell(ctx, g.xP + v * c, g.yK + u * c, c, c, { fill: withAlpha(color('orange'), pad ? 0.03 : 0.1), stroke: withAlpha(color('orange'), 0.5), text: pad ? '0' : c < 36 ? pv.toFixed(2).replace(/^0/, '') : pv.toFixed(2), size: fs, ink: pad ? color('--ink-3') : color('--ink') });
        const on = u * 3 + v === sel;
        cell(ctx, g.xW + v * c, g.yK + u * c, c, c, { fill: withAlpha(color('blue'), on ? 0.32 : 0.1), stroke: on ? color('blue') : withAlpha(color('blue'), 0.5), lw: on ? 2.5 : 1, text: String(kw[u * 3 + v]), size: fs });
      }
    ctx.fillStyle = color('--ink-2');
    ctx.font = mono(Math.max(13, c * 0.42), 400);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⊙', g.xP + 3.45 * c, g.yK + 1.5 * c);
    ctx.fillText('=', g.xW + 3.45 * c, g.yK + 1.5 * c);
    cell(ctx, g.xV, g.yK + c, 2.3 * c, c, { fill: withAlpha(color('purple'), 0.2), stroke: color('purple'), lw: 2, text: fmt(A[ci * 32 + cj], 3), size: fs });
    txt(ctx, 'tap a W cell to edit it', g.xW + 1.5 * c, g.yK + 3 * c + 2, { size: 11, ink: color('--ink-3'), align: 'center', base: 'top' });
  });
  const sync = (hl = true) => {
    conv();
    const v: Record<string, string | number> = { i: ci, j: cj, a: fmt(A[ci * 32 + cj], 3), scale: div === 1 ? '' : ` / ${div}`, relu: relu ? 'True' : 'False' };
    kw.forEach((k, n) => (v[`w${n}`] = k));
    if (set) v.idx = list[pick];
    f.code.setMany(v);
    if (hl) f.code.highlight(relu ? ['sum', 'relu'] : 'sum');
    const terms: string[] = [];
    for (let u = 0; u < 3; u++) for (let w = 0; w < 3; w++) terms.push(`${at(ci + u - 1, cj + w - 1).toFixed(2)}×${kw[u * 3 + w] < 0 ? `(${kw[u * 3 + w]})` : kw[u * 3 + w]}`);
    const raw = A[ci * 32 + cj];
    f.status(`\`A[${ci}, ${cj}] = (${terms.join(' + ')})${div !== 1 ? ` / ${div}` : ''}${relu ? ', then ReLU,' : ''} = ${fmt(raw, 3)}\``);
    cv.redraw();
  };
  const hit = (e: PointerEvent, select: boolean) => {
    const [x, y] = local(e, cv.canvas);
    const g = geo(cw, ch);
    for (const x0 of [g.xIn, g.xOut]) {
      if (x >= x0 && x < x0 + g.s && y >= g.yImg && y < g.yImg + g.s) {
        cj = Math.min(31, Math.floor((x - x0) / g.ps));
        ci = Math.min(31, Math.floor((y - g.yImg) / g.ps));
        sync();
        return;
      }
    }
    if (select && x >= g.xW && x < g.xW + 3 * g.c && y >= g.yK && y < g.yK + 3 * g.c) {
      sel = Math.floor((y - g.yK) / g.c) * 3 + Math.floor((x - g.xW) / g.c);
      wSlider.set(kw[sel], false);
      cv.redraw();
    }
  };
  let down = false;
  cv.canvas.addEventListener('pointerdown', (e) => {
    down = true;
    cv.canvas.setPointerCapture(e.pointerId);
    hit(e, true);
  });
  cv.canvas.addEventListener('pointermove', (e) => {
    if (down || e.pointerType === 'mouse') hit(e, false);
  });
  cv.canvas.addEventListener('pointerup', () => (down = false));
  const preset = f.segmented({
    label: 'filter',
    options: [
      { value: 'vedge', label: 'vertical edges' },
      { value: 'hedge', label: 'horizontal edges' },
      { value: 'blur', label: 'blur' },
      { value: 'sharpen', label: 'sharpen' },
      { value: 'emboss', label: 'emboss' },
      { value: 'custom', label: 'custom' },
    ],
    value: 'vedge',
    onChange: (v) => {
      if (v === 'custom') return;
      kw = [...PRESETS[v].k];
      div = PRESETS[v].div;
      wSlider.set(kw[sel], false);
      sync();
    },
  });
  const wSlider = f.slider({
    label: 'selected weight',
    sym: 'W',
    min: -4,
    max: 8,
    step: 1,
    value: kw[sel],
    format: (v) => String(Math.round(v)),
    onInput: (v) => {
      kw[sel] = Math.round(v);
      preset.set('custom', false);
      sync();
    },
  });
  f.toggle({
    label: 'ReLU',
    value: false,
    onChange: (v) => {
      relu = v;
      sync();
    },
  });
  f.button('Next image', () => {
    if (!set) return;
    pick = (pick + 1) % list.length;
    img = grayOf(set, list[pick]);
    sync(false);
  });
  sync(false);
  loadCifar()
    .then(({ train }) => {
      set = train;
      list = picks(train, [1, 8, 7, 0, 9, 3, 4, 6]);
      img = grayOf(train, list[0]);
      sync(false);
    })
    .catch((e) => f.status(`Could not load CIFAR-10: ${(e as Error).message}`));
}

// ---------------------------------------------------------------------------------------
// Fig: the 3-D convolution demo (5x5x3 input, P = 1, two 3x3x3 filters, S = 2)

function figVolume(f: Fig): void {
  const rng = new Rng(231);
  const V: number[][][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => [rng.int(3), rng.int(3), rng.int(3)]));
  const Wf: number[][][][] = [0, 1].map(() => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => [rng.int(3) - 1, rng.int(3) - 1, rng.int(3) - 1])));
  const bias = [1, 0];
  const S = 2;
  const X = (r: number, c: number, d: number) => (r < 1 || c < 1 || r > 5 || c > 5 ? 0 : V[r - 1][c - 1][d]);
  const out: number[][][] = [0, 1, 2].map(() => [0, 1, 2].map(() => [0, 0]));
  const slices = (k: number, i: number, j: number) =>
    [0, 1, 2].map((d) => {
      let s = 0;
      for (let u = 0; u < 3; u++) for (let v = 0; v < 3; v++) s += Wf[k][u][v][d] * X(i * S + u, j * S + v, d);
      return s;
    });
  for (let k = 0; k < 2; k++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out[i][j][k] = slices(k, i, j).reduce((a, b) => a + b, 0) + bias[k];
  const steps: [number, number, number][] = [];
  for (let k = 0; k < 2; k++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) steps.push([k, i, j]);
  let cur = 0;
  const paren = (v: number) => (v < 0 ? `(${v})` : String(v));
  const cv = f.canvas(640, 600, (ctx, w, h) => {
    const [k, i, j] = steps[cur];
    const c = Math.min((w - 8) / 23, (h - 96) / 16.6);
    const gap = 0.8 * c;
    const sw = 7 * c;
    const x0 = (w - (3 * sw + 2 * gap)) / 2;
    const yA = 20;
    const fc = 1.7 * c;
    const yB = yA + sw + 24;
    const yC = yB + 3 * fc + 6;
    const yD = yC + 30;
    const sums = slices(k, i, j);
    for (let d = 0; d < 3; d++) {
      const sx = x0 + d * (sw + gap);
      txt(ctx, `X[:,:,${d}]`, sx + sw / 2, yA - 6, { size: 11, ink: color('orange'), align: 'center', font: 'mono' });
      for (let r = 0; r < 7; r++)
        for (let q = 0; q < 7; q++) {
          const pad = r < 1 || q < 1 || r > 5 || q > 5;
          const inWin = r >= i * S && r < i * S + 3 && q >= j * S && q < j * S + 3;
          cell(ctx, sx + q * c, yA + r * c, c, c, {
            fill: inWin ? withAlpha(color('orange'), 0.3) : pad ? color('--paper-2') : withAlpha(color('orange'), 0.08),
            stroke: withAlpha(color('orange'), pad ? 0.2 : 0.4),
            text: String(X(r, q, d)),
            ink: pad ? color('--ink-3') : color('--ink'),
            size: 11,
            radius: 2,
          });
        }
      frame(ctx, sx + j * S * c, yA + i * S * c, 3 * c, 3 * c, color('orange'), 2);
      const fx = sx + (sw - 3 * fc) / 2;
      txt(ctx, `W[${k}][:,:,${d}]`, sx + sw / 2, yB - 6, { size: 11, ink: color('blue'), align: 'center', font: 'mono' });
      for (let u = 0; u < 3; u++)
        for (let v = 0; v < 3; v++) {
          const wv = Wf[k][u][v][d];
          cell(ctx, fx + v * fc, yB + u * fc, fc, fc, { fill: withAlpha(color('blue'), 0.1), stroke: withAlpha(color('blue'), 0.5), radius: 3 });
          txt(ctx, String(wv), fx + (v + 0.5) * fc, yB + (u + 0.3) * fc, { size: 11, ink: color('blue'), align: 'center', base: 'middle', font: 'mono', bold: true });
          txt(ctx, `×${X(i * S + u, j * S + v, d)}`, fx + (v + 0.5) * fc, yB + (u + 0.74) * fc, { size: 11, ink: color('orange'), align: 'center', base: 'middle', font: 'mono' });
        }
      txt(ctx, `${w < 420 ? 'Σ' : 'slice sum'} = ${sums[d]}`, sx + sw / 2, yC + 12, { size: 12, align: 'center', font: 'mono', ink: color('--ink') });
    }
    // output volume
    const oc = Math.min(1.5 * c, (h - yD - 6) / 3.4);
    const ox = x0;
    for (let kk = 0; kk < 2; kk++) {
      const gx = ox + kk * (3 * oc + Math.max(oc * 0.8, 14));
      txt(ctx, `A[:,:,${kk}]`, gx + 1.5 * oc, yD + 4, { size: 11, ink: color('purple'), align: 'center', font: 'mono' });
      for (let r = 0; r < 3; r++)
        for (let q = 0; q < 3; q++) {
          const idx = kk * 9 + r * 3 + q;
          const done = idx <= cur;
          const on = idx === cur;
          cell(ctx, gx + q * oc, yD + 10 + r * oc, oc, oc, { fill: withAlpha(color('purple'), on ? 0.35 : done ? 0.12 : 0.03), stroke: on ? color('purple') : withAlpha(color('purple'), 0.4), lw: on ? 2.5 : 1, text: done ? String(out[r][q][kk]) : '', size: 12 });
        }
    }
    const ex = ox + 6 * oc + Math.max(oc * 0.8, 14) + oc * 0.8;
    const ew = w - ex - 4;
    const lines = [`A[${i}, ${j}, ${k}]`, `= ${sums.map(paren).join(' + ')}`, `  + b[${k}] (${bias[k]})`, `= ${out[i][j][k]}`];
    const fsz = Math.max(11, Math.min(13, ew / 15));
    lines.forEach((s, n) => txt(ctx, s, ex, yD + 18 + n * (fsz + 6), { size: fsz, font: 'mono', ink: n === 3 ? color('purple') : color('--ink'), bold: n === 3 }));
  });
  cv.canvas.classList.add('scroll-ok');
  f.stepper({
    steps: steps.length,
    interval: 1300,
    label: (n) => `output ${n + 1} / ${steps.length}`,
    onStep: (n) => {
      cur = n;
      const [k, i, j] = steps[n];
      f.code.setMany({ k, i, j, a: out[i][j][k] });
      f.code.highlight(['patch', 'sum']);
      cv.redraw();
    },
  });
}

// ---------------------------------------------------------------------------------------
// Fig: output-size calculator

function figSize(f: Fig): void {
  const NV: number[] = [];
  for (let n = 3; n <= 40; n++) NV.push(n);
  NV.push(48, 56, 64, 96, 128, 224, 227);
  let N = 7;
  let F = 3;
  let S = 1;
  let P = 0;
  const cv = f.canvas(640, 340, (ctx, w, h) => {
    const tot = N + 2 * P;
    const room = N - F + 2 * P;
    const ok = room >= 0 && room % S === 0;
    const nout = room >= 0 ? Math.floor(room / S) + 1 : 0;
    const u = Math.min(30, (w - 16) / Math.max(tot, F));
    const x0 = (w - tot * u) / 2;
    const rowY = 24;
    const rh = Math.min(26, Math.max(10, u));
    txt(ctx, `input: N = ${N}${P ? `, plus P = ${P} zero${P > 1 ? 's' : ''} on each side` : ''}`, 6, rowY - 8, { size: 12, ink: color('orange') });
    for (let q = 0; q < tot; q++) {
      const pad = q < P || q >= P + N;
      if (u >= 5)
        cell(ctx, x0 + q * u, rowY, u, rh, {
          fill: pad ? color('--paper-2') : withAlpha(color('orange'), 0.14),
          stroke: pad ? color('--rule') : withAlpha(color('orange'), 0.55),
          dash: pad ? [3, 2] : undefined,
          text: u >= 15 && pad ? '0' : '',
          ink: color('--ink-3'),
          size: 11,
          radius: Math.min(4, u / 4),
        });
      else {
        ctx.fillStyle = pad ? color('--rule') : withAlpha(color('orange'), 0.5);
        ctx.fillRect(x0 + q * u, rowY, Math.max(1, u - 0.5), rh);
      }
    }
    const levels = Math.max(1, Math.min(6, Math.ceil(F / S)));
    const y1 = rowY + rh + 10;
    const yForm = h - 36;
    const outH = Math.min(24, Math.max(12, u));
    const lh = Math.max(5, Math.min(14, (yForm - y1 - outH - 26) / levels));
    const bar = (start: number, len: number, lvl: number, col: string, dash?: number[]) => {
      const y = y1 + lvl * lh;
      ctx.beginPath();
      ctx.roundRect(x0 + start * u + 1, y, Math.max(2, len * u - 2), Math.max(3, lh - 3), 3);
      ctx.fillStyle = withAlpha(col, 0.22);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2;
      ctx.setLineDash(dash ?? []);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    for (let k = 0; k < nout; k++) bar(k * S, F, k % levels, color('slate'));
    if (!ok) {
      const start = room >= 0 ? nout * S : 0;
      bar(start, F, nout % levels, color('red'), [4, 3]);
    }
    const yOut = y1 + levels * lh + 12;
    if (nout > 0) {
      txt(ctx, `output: ${nout} position${nout > 1 ? 's' : ''}${ok ? '' : ' that fit, plus a leftover'}`, 6, yOut - 3, { size: 12, ink: color('purple') });
      for (let k = 0; k < nout; k++) {
        const cx = x0 + (k * S + F / 2) * u;
        const ow = Math.max(2, Math.min(u, S * u) * 0.86);
        if (ow >= 5) cell(ctx, cx - ow / 2, yOut + 4, ow, outH, { fill: withAlpha(color('purple'), 0.2), stroke: color('purple'), text: ow >= 16 ? String(k) : '', size: 11, radius: Math.min(4, ow / 4) });
        else {
          ctx.fillStyle = color('purple');
          ctx.fillRect(cx - ow / 2, yOut + 4, ow, outH);
        }
      }
    }
    const num = `(${N} − ${F} + 2·${P}) / ${S} + 1`;
    const val = room < 0 ? 'filter wider than the padded input' : ok ? `= ${nout}` : `= ${fmt(room / S + 1, 3)}, not a whole number`;
    txt(ctx, '(N − F + 2P) / S + 1', 6, yForm + 6, { size: 12, font: 'mono', ink: color('--ink-2') });
    txt(ctx, `${num} ${val}`, 6, yForm + 26, { size: Math.max(11, Math.min(13, w / 42)), font: 'mono', ink: ok ? color('--ink') : color('red'), bold: true });
  });
  cv.canvas.classList.add('scroll-ok');
  const sync = () => {
    const room = N - F + 2 * P;
    const ok = room >= 0 && room % S === 0;
    f.code.setMany({ room, nout: ok ? Math.floor(room / S) + 1 : '✗' });
    f.code.highlight(ok ? ['room', 'out'] : ['check', 'bad']);
    cv.redraw();
  };
  const nS = f.slider({ label: 'input N', sym: 'N', min: 0, max: NV.length - 1, step: 1, value: NV.indexOf(7), map: (r) => NV[Math.round(r)], format: (v) => String(v), slot: 'N', onInput: (v) => { N = v; sync(); } });
  const fS = f.slider({ label: 'filter F', sym: 'F', min: 1, max: 11, step: 1, value: 3, slot: 'F', onInput: (v) => { F = v; sync(); } });
  const sS = f.slider({ label: 'stride S', sym: 'S', min: 1, max: 6, step: 1, value: 1, slot: 'S', onInput: (v) => { S = v; sync(); } });
  const pS = f.slider({ label: 'pad P', sym: 'P', min: 0, max: 5, step: 1, value: 0, slot: 'P', onInput: (v) => { P = v; sync(); } });
  const preset = (n: number, ff: number, s: number, p: number) => () => {
    N = n;
    F = ff;
    S = s;
    P = p;
    nS.set(NV.indexOf(n), false);
    fS.set(ff, false);
    sS.set(s, false);
    pS.set(p, false);
    f.code.setMany({ N: n, F: ff, S: s, P: p });
    sync();
  };
  f.button('7, 3, stride 1', preset(7, 3, 1, 0));
  f.button('stride 2', preset(7, 3, 2, 0));
  f.button('stride 3', preset(7, 3, 3, 0));
  f.button('same padding', preset(9, 5, 1, 2));
  f.button('AlexNet conv1', preset(227, 11, 4, 0));
  sync();
}

// ---------------------------------------------------------------------------------------
// Fig: max pooling, forward and backward

function figPool(f: Fig): void {
  let X = [
    [1, 1, 2, 4],
    [5, 6, 7, 8],
    [3, 2, 1, 0],
    [1, 2, 3, 4],
  ];
  let dA = [
    [1.5, -0.4],
    [0.8, 2],
  ];
  let op: 'max' | 'mean' = 'max';
  let cur = 0;
  let seed = 3;
  const TINT = ['blue', 'orange', 'green', 'red'] as const;
  const win = (i: number, j: number) => [X[2 * i][2 * j], X[2 * i][2 * j + 1], X[2 * i + 1][2 * j], X[2 * i + 1][2 * j + 1]];
  const arg = (i: number, j: number) => {
    const v = win(i, j);
    let b = 0;
    for (let q = 1; q < 4; q++) if (v[q] > v[b]) b = q;
    return [2 * i + (b >> 1), 2 * j + (b & 1)];
  };
  const fwd = (i: number, j: number) => {
    const v = win(i, j);
    return op === 'max' ? Math.max(...v) : v.reduce((a, b) => a + b, 0) / 4;
  };
  const cv = f.canvas(640, 600, (ctx, w, h) => {
    const back = cur >= 4;
    const wi = cur % 4;
    const c = Math.min(44, w / 8.8, (h - 80) / 8);
    const x0 = Math.max(6, (w - 8.4 * c) / 2);
    const xR = x0 + 4 * c + 2.4 * c;
    const yF = 22;
    const yB = yF + 4 * c + 44;
    const tint = (i: number, j: number) => color(TINT[i * 2 + j]);
    txt(ctx, 'forward: X → A', x0, yF - 8, { size: 12, ink: color('--ink-2'), bold: true });
    txt(ctx, 'backward: dX ← dA', x0, yB - 8, { size: 12, ink: color('--ink-2'), bold: true });
    for (let r = 0; r < 4; r++)
      for (let q = 0; q < 4; q++) {
        const i = r >> 1, j = q >> 1;
        const n = i * 2 + j;
        const seen = back || n <= wi;
        const isMax = op === 'max' && seen && arg(i, j)[0] === r && arg(i, j)[1] === q;
        cell(ctx, x0 + q * c, yF + r * c, c, c, { fill: withAlpha(tint(i, j), !back && n === wi ? 0.32 : 0.1), stroke: isMax ? tint(i, j) : withAlpha(tint(i, j), 0.4), lw: isMax ? 3 : 1, text: String(X[r][q]), bold: isMax, size: Math.max(11, Math.min(15, c * 0.4)) });
        // backward grid
        let g = '';
        let hot = false;
        if (back && n <= wi) {
          if (op === 'max') {
            const [ar, aq] = arg(i, j);
            hot = ar === r && aq === q;
            g = hot ? fmt(dA[i][j], 2) : '0';
          } else {
            hot = true;
            g = fmt(dA[i][j] / 4, 2);
          }
        }
        cell(ctx, x0 + q * c, yB + r * c, c, c, { fill: withAlpha(tint(i, j), back && n === wi ? (hot ? 0.36 : 0.12) : 0.05), stroke: withAlpha(tint(i, j), hot ? 0.9 : 0.3), lw: hot ? 2 : 1, text: g, ink: hot ? color('--ink') : color('--ink-3'), size: Math.max(11, Math.min(14, c * 0.36)) });
      }
    frame(ctx, x0 + (wi & 1) * 2 * c, (back ? yB : yF) + (wi >> 1) * 2 * c, 2 * c, 2 * c, tint(wi >> 1, wi & 1), 2.5);
    const arrowY = (y: number) => {
      ctx.strokeStyle = color('--ink-3');
      ctx.fillStyle = color('--ink-3');
      ctx.lineWidth = 1.5;
      const ax0 = x0 + 4 * c + 0.4 * c, ax1 = xR - 0.4 * c;
      ctx.beginPath();
      ctx.moveTo(ax0, y);
      ctx.lineTo(ax1, y);
      ctx.stroke();
      const dir = y === yF + 2 * c ? 1 : -1;
      const tip = dir > 0 ? ax1 : ax0;
      ctx.beginPath();
      ctx.moveTo(tip, y);
      ctx.lineTo(tip - dir * 8, y - 5);
      ctx.lineTo(tip - dir * 8, y + 5);
      ctx.closePath();
      ctx.fill();
      txt(ctx, dir > 0 ? (op === 'max' ? 'max' : 'mean') : 'route', (ax0 + ax1) / 2, y - 8, { size: 11, align: 'center', ink: color('--ink-3') });
    };
    arrowY(yF + 2 * c);
    arrowY(yB + 2 * c);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const n = i * 2 + j;
        const done = back || n <= wi;
        cell(ctx, xR + j * c, yF + c + i * c, c, c, { fill: withAlpha(tint(i, j), !back && n === wi ? 0.36 : done ? 0.16 : 0.03), stroke: tint(i, j), lw: !back && n === wi ? 2.5 : 1, text: done ? fmt(fwd(i, j), 3) : '', size: Math.max(11, Math.min(15, c * 0.38)) });
        cell(ctx, xR + j * c, yB + c + i * c, c, c, { fill: withAlpha(tint(i, j), back && n === wi ? 0.36 : 0.12), stroke: tint(i, j), lw: back && n === wi ? 2.5 : 1, text: fmt(dA[i][j], 2), size: Math.max(11, Math.min(14, c * 0.36)) });
      }
    txt(ctx, 'A', xR + c, yF + c - 6, { size: 13, ink: color('purple'), align: 'center', font: 'serif', italic: true, bold: true });
    txt(ctx, 'dA', xR + c, yB + c - 6, { size: 13, ink: color('--ink-2'), align: 'center', font: 'serif', italic: true });
    if (back && op === 'max') {
      const i = wi >> 1, j = wi & 1;
      const [ar, aq] = arg(i, j);
      ctx.strokeStyle = tint(i, j);
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      const sx = xR + (j + 0.5) * c, sy = yB + c + (i + 0.5) * c;
      const tx = x0 + (aq + 0.5) * c, ty = yB + (ar + 0.5) * c;
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + tx) / 2, Math.min(sy, ty) - c * 0.9, tx + c * 0.3, ty - c * 0.3);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
  cv.canvas.classList.add('scroll-ok');
  const describe = () => {
    const wi = cur % 4;
    const i = wi >> 1, j = wi & 1;
    const v = win(i, j);
    if (cur < 4) {
      if (op === 'max') {
        const [ar, aq] = arg(i, j);
        return `Window (${i}, ${j}) holds [${v.join(', ')}]. Its max, ${Math.max(...v)}, sits at X[${ar}, ${aq}]; that position is saved as the *switch*.`;
      }
      return `Window (${i}, ${j}) holds [${v.join(', ')}]. Its mean is ${fmt(fwd(i, j), 3)}.`;
    }
    if (op === 'max') {
      const [ar, aq] = arg(i, j);
      return `dA[${i}, ${j}] = ${fmt(dA[i][j], 2)} flows only to X[${ar}, ${aq}], the input that won. The other three inputs get 0: nudging them would not change the max.`;
    }
    return `dA[${i}, ${j}] = ${fmt(dA[i][j], 2)} is split evenly: each of the four inputs moved the mean by 1/4 of its own change, so each gets ${fmt(dA[i][j] / 4, 2)}.`;
  };
  const sync = () => {
    f.code.setMany({ r0: X[0].join(', '), r1: X[1].join(', '), r2: X[2].join(', '), r3: X[3].join(', '), g0: dA[0].join(', '), g1: dA[1].join(', '), op });
    if (cur < 4) f.code.highlight(['win', 'fwd']);
    else f.code.highlight(op === 'max' ? ['sw', 'bmax'] : 'bavg');
    f.status(describe());
    cv.redraw();
  };
  const st = f.stepper({
    steps: 8,
    interval: 1400,
    label: (n) => (n < 4 ? `forward ${n + 1} / 4` : `backward ${n - 3} / 4`),
    onStep: (n) => {
      cur = n;
      sync();
    },
  });
  f.segmented({
    label: 'pooling',
    options: [
      { value: 'max', label: 'max' },
      { value: 'mean', label: 'average' },
    ],
    value: 'max',
    onChange: (v) => {
      op = v as 'max' | 'mean';
      sync();
    },
  });
  f.button('New numbers', () => {
    const r = new Rng(seed++);
    X = [0, 1, 2, 3].map(() => [0, 1, 2, 3].map(() => r.int(10)));
    dA = [0, 1].map(() => [0, 1].map(() => Math.round(r.uniform(-2, 2) * 10) / 10));
    st.go(0);
  });
}

// ---------------------------------------------------------------------------------------
// Fig: FC layers as CONV layers, sliding over a bigger image

function figSlide(f: Fig): void {
  let size = 384;
  let si = 2;
  let sj = 3;
  let set: CifarSet | null = null;
  let cw = 0;
  let ch = 0;
  const n = () => size / 32 - 6;
  const geo = (w: number, h: number) => {
    const L = Math.min(h - 30, w * 0.54);
    const xR = L + 24;
    const gw = w - xR - 6;
    const cs = Math.min(26, gw / Math.max(n(), 4), (h - 120) / Math.max(n(), 4));
    return { L, xR, cs, y0: 22 };
  };
  const cv = f.canvas(640, 400, (ctx, w, h) => {
    cw = w;
    ch = h;
    const g = geo(w, h);
    const k = g.L / size;
    txt(ctx, `image: ${size} × ${size}`, 0, g.y0 - 8, { size: 12, ink: color('orange') });
    if (set) blit(ctx, cifarImage(set, picks(set, [7])[0]), 0, g.y0, g.L, g.L, true);
    else {
      ctx.fillStyle = color('--paper-2');
      ctx.fillRect(0, g.y0, g.L, g.L);
    }
    ctx.fillStyle = withAlpha(color('--paper'), 0.35);
    ctx.fillRect(0, g.y0, g.L, g.L);
    const m = n();
    ctx.strokeStyle = withAlpha(color('--ink'), 0.18);
    ctx.lineWidth = 1;
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) ctx.strokeRect(j * 32 * k + 0.5, g.y0 + i * 32 * k + 0.5, 224 * k - 1, 224 * k - 1);
    frame(ctx, sj * 32 * k, g.y0 + si * 32 * k, 224 * k, 224 * k, color('purple'), 2.5, 0.12);
    txt(ctx, '224 × 224 crop', sj * 32 * k + 5, g.y0 + si * 32 * k + 15, { size: 11, ink: color('purple'), bold: true });
    // score grid
    txt(ctx, `scores: ${m} × ${m} × 1000`, g.xR, g.y0 - 8, { size: 12, ink: color('purple') });
    for (let i = 0; i < m; i++)
      for (let j = 0; j < m; j++) {
        const on = i === si && j === sj;
        cell(ctx, g.xR + j * g.cs, g.y0 + i * g.cs, g.cs, g.cs, { fill: withAlpha(color('purple'), on ? 0.45 : 0.12), stroke: on ? color('purple') : withAlpha(color('purple'), 0.4), lw: on ? 2.5 : 1, radius: 3 });
      }
    txt(ctx, `crop (${si}, ${sj})`, g.xR, g.y0 + m * g.cs + 18, { size: 11, ink: color('--ink-3') });
  });
  const roCrops = f.readout('crops covered');
  const roWork = f.readout('CONV work, one pass vs crops');
  const sync = () => {
    const m = n();
    si = Math.min(si, m - 1);
    sj = Math.min(sj, m - 1);
    f.code.setMany({ feat: size / 32, n: m, i: si, j: sj, y0: 32 * si, x0: 32 * sj });
    roCrops.set(`${m} × ${m} = ${m * m}`);
    roWork.set(m === 1 ? 'the same' : `about ${fmt((m * m * 224 * 224) / (size * size), 2)}× less`);
    cv.redraw();
  };
  cv.canvas.classList.add('scroll-ok');
  cv.canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = local(e, cv.canvas);
    const g = geo(cw, ch);
    const m = n();
    if (x >= g.xR && y >= g.y0 && x < g.xR + m * g.cs && y < g.y0 + m * g.cs) {
      sj = Math.floor((x - g.xR) / g.cs);
      si = Math.floor((y - g.y0) / g.cs);
    } else if (x < g.L && y >= g.y0 && y < g.y0 + g.L) {
      const k = g.L / size;
      sj = Math.max(0, Math.min(m - 1, Math.round((x / k - 112) / 32)));
      si = Math.max(0, Math.min(m - 1, Math.round(((y - g.y0) / k - 112) / 32)));
    } else return;
    f.code.highlight('same');
    sync();
  });
  f.slider({
    label: 'input size',
    min: 224,
    max: 512,
    step: 32,
    value: 384,
    format: (v) => `${v} px`,
    slot: 'size',
    onInput: (v) => {
      size = v;
      f.code.highlight(['feat', 'fc6', 'fc78', 'scores']);
      sync();
    },
  });
  f.code.set('size', 384);
  sync();
  loadCifar()
    .then(({ train }) => {
      set = train;
      cv.redraw();
    })
    .catch(() => {});
}

// ---------------------------------------------------------------------------------------
// Fig: receptive field growth across stacked layers

function figReceptive(f: Fig): void {
  let L = 3;
  let F = 3;
  let S = 1;
  let shown = 3;
  const rf = (layers: number) => {
    let r = 1;
    let jump = 1;
    for (let l = 0; l < layers; l++) {
      r += (F - 1) * jump;
      jump *= S;
    }
    return r;
  };
  const cv = f.canvas(640, 420, (ctx, w, h) => {
    const r = rf(L);
    const half = Math.floor(r / 2) + Math.max(2, S ** (L - 1));
    const labW = 54;
    const u = (w - labW - 8) / (2 * half + 1);
    const cx = labW + (w - labW - 8) / 2;
    const rh = Math.min(64, (h - 34) / (L + 1));
    const yRow = (l: number) => h - 22 - (l + 0.5) * rh;
    // which neurons of each layer feed the top neuron
    const lit: Set<number>[] = [];
    lit[L] = new Set([0]);
    for (let l = L; l > 0; l--) {
      const nx = new Set<number>();
      for (const m of lit[l]) for (let t = 0; t < F; t++) nx.add(m * S + t - (F - 1) / 2);
      lit[l - 1] = nx;
    }
    const depthShown = (l: number) => l >= L - shown;
    for (let l = 0; l <= L; l++) {
      const jump = S ** l;
      const y = yRow(l);
      txt(ctx, l === 0 ? 'input' : `layer ${l}`, 4, y + 4, { size: 11, ink: l === 0 ? color('orange') : color('--ink-2') });
      const span = Math.floor(half / jump);
      const bw = Math.max(2, Math.min(jump * u * 0.82, 30));
      const bh = Math.min(rh * 0.42, 18);
      for (let m = -span; m <= span; m++) {
        const x = cx + m * jump * u;
        const on = lit[l].has(m) && depthShown(l);
        const col = l === 0 ? color('orange') : l === L ? color('purple') : color('blue');
        ctx.beginPath();
        ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, Math.min(3, bw / 3));
        ctx.fillStyle = on ? withAlpha(col, 0.55) : withAlpha(col, 0.07);
        ctx.fill();
        ctx.strokeStyle = on ? col : withAlpha(col, 0.25);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (l > 0 && depthShown(l - 1)) {
        ctx.strokeStyle = withAlpha(color('--ink'), 0.22);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (const m of lit[l]) for (let t = 0; t < F; t++) {
          const mc = m * S + t - (F - 1) / 2;
          ctx.moveTo(cx + m * jump * u, y + bh / 2);
          ctx.lineTo(cx + mc * (jump / S) * u, yRow(l - 1) - bh / 2);
        }
        ctx.stroke();
      }
      if (depthShown(l) && l < L) {
        const seen = lit[l].size;
        txt(ctx, `${seen} wide`, w - 4, y - bh / 2 - 3, { size: 11, align: 'right', ink: color('--ink-3') });
      }
    }
    txt(ctx, `one neuron in layer ${L} sees ${r} × ${r} input pixels`, labW, h - 4, { size: 12, ink: color('--ink'), bold: true });
  });
  cv.canvas.classList.add('scroll-ok');
  const st = f.stepper({
    steps: L + 1,
    interval: 900,
    label: (k) => (k === 0 ? 'the top neuron' : `${k} layer${k > 1 ? 's' : ''} down`),
    onStep: (k) => {
      shown = k;
      let r = 1;
      let jump = 1;
      for (let l = 0; l < k; l++) {
        r += (F - 1) * jump;
        jump *= S;
      }
      f.code.set('r', r);
      f.code.highlight(k === 0 ? null : ['grow', 'jump']);
      cv.redraw();
    },
  });
  const rf1 = f.readout('receptive field');
  const pr = f.readout('weights, stacked vs one filter');
  const sync = () => {
    const r = rf(L);
    rf1.set(`${r} × ${r}`);
    pr.set(S === 1 ? `${L * F * F} C² vs ${r * r} C²` : 'n/a with stride');
    f.code.setMany({ L, stack: L * F * F, single: S === 1 ? r * r : 'n/a' });
    st.setSteps(L + 1);
    st.go(L);
  };
  f.slider({ label: 'layers', min: 1, max: 5, step: 1, value: 3, slot: 'L', onInput: (v) => { L = v; sync(); } });
  f.segmented({ label: 'filter size', options: [{ value: '3', label: '3 × 3' }, { value: '5', label: '5 × 5' }], value: '3', slot: 'F', onChange: (v) => { F = Number(v); sync(); } });
  f.segmented({ label: 'stride', options: [{ value: '1', label: '1' }, { value: '2', label: '2' }], value: '1', slot: 'S', onChange: (v) => { S = Number(v); sync(); } });
  sync();
  // the stepper rewinds to step 0 in a microtask; start with the whole cone shown instead
  queueMicrotask(() => st.go(L));
}

// ---------------------------------------------------------------------------------------
// Fig: VGG-16 memory and parameters, computed

interface VggRow {
  name: string;
  vol: string;
  acts: number;
  params: number;
  kind: 'input' | 'conv' | 'pool' | 'fc';
}

function vggTable(): VggRow[] {
  const cfg: (number | 'M')[] = [64, 64, 'M', 128, 128, 'M', 256, 256, 256, 'M', 512, 512, 512, 'M', 512, 512, 512, 'M'];
  let H = 224;
  let D = 3;
  const rows: VggRow[] = [{ name: 'INPUT', vol: '224×224×3', acts: H * H * D, params: 0, kind: 'input' }];
  for (const v of cfg) {
    if (v === 'M') {
      H /= 2;
      rows.push({ name: 'POOL2', vol: `${H}×${H}×${D}`, acts: H * H * D, params: 0, kind: 'pool' });
    } else {
      rows.push({ name: `CONV3-${v}`, vol: `${H}×${H}×${v}`, acts: H * H * v, params: 9 * D * v, kind: 'conv' });
      D = v;
    }
  }
  for (const [a, b] of [[7 * 7 * 512, 4096], [4096, 4096], [4096, 1000]]) rows.push({ name: `FC-${b}`, vol: `1×1×${b}`, acts: b, params: a * b, kind: 'fc' });
  return rows;
}

function figVgg(f: Fig): void {
  const rows = vggTable();
  const totA = rows.reduce((a, r) => a + r.acts, 0);
  const totP = rows.reduce((a, r) => a + r.params, 0);
  const maxA = Math.max(...rows.map((r) => r.acts));
  const maxP = Math.max(...rows.map((r) => r.params));
  let hover = -1;
  let batch = 64;
  let train = true;
  let mult = 3;
  let cw = 0;
  let ch = 0;
  const geo = (w: number, h: number) => {
    const top = 34;
    const rh = (h - top - 26) / rows.length;
    const nameW = Math.min(76, w * 0.21);
    const colW = (w - nameW - 12) / 2;
    return { top, rh, nameW, colW, xA: nameW + 4, xP: nameW + 8 + colW };
  };
  const cv = f.canvas(640, 700, (ctx, w, h) => {
    cw = w;
    ch = h;
    const g = geo(w, h);
    txt(ctx, 'activations / image', g.xA, 14, { size: 12, ink: color('orange'), bold: true });
    txt(ctx, 'weights', g.xP, 14, { size: 12, ink: color('blue'), bold: true });
    txt(ctx, 'linear scale, each column to its own max', g.xA, 28, { size: 11, ink: color('--ink-3') });
    const fs = Math.max(11, Math.min(12, g.rh * 0.62));
    rows.forEach((r, i) => {
      const y = g.top + i * g.rh;
      if (i === hover) {
        ctx.fillStyle = withAlpha(color('--accent'), 0.12);
        ctx.fillRect(0, y, w, g.rh);
      }
      txt(ctx, r.name, 2, y + g.rh / 2, { size: fs, base: 'middle', font: 'mono', ink: r.kind === 'pool' ? color('--ink-3') : color('--ink') });
      const bar = (x: number, v: number, mx: number, col: string) => {
        const len = Math.max(v > 0 ? 1.5 : 0, (v / mx) * g.colW * 0.66);
        ctx.fillStyle = withAlpha(col, 0.7);
        ctx.fillRect(x, y + g.rh * 0.18, len, g.rh * 0.64);
        if (v > 0) txt(ctx, count(v), x + len + 4, y + g.rh / 2, { size: fs, base: 'middle', font: 'mono', ink: color('--ink-2') });
      };
      bar(g.xA, r.acts, maxA, color('orange'));
      bar(g.xP, r.params, maxP, color('blue'));
    });
    const yT = g.top + rows.length * g.rh + 16;
    ctx.strokeStyle = color('--rule');
    ctx.beginPath();
    ctx.moveTo(0, yT - 13);
    ctx.lineTo(w, yT - 13);
    ctx.stroke();
    txt(ctx, 'TOTAL', 2, yT, { size: 12, font: 'mono', bold: true, ink: color('--ink') });
    txt(ctx, count(totA), g.xA, yT, { size: 12, font: 'mono', bold: true, ink: color('orange') });
    txt(ctx, count(totP), g.xP, yT, { size: 12, font: 'mono', bold: true, ink: color('blue') });
  });
  const roTot = f.readout('memory');
  const sync = () => {
    const values = batch * totA * (train ? 2 : 1) + totP * (train ? mult : 1);
    roTot.set(bytes(values * 4));
    f.code.setMany({ acts: count(totA), params: count(totP), batch, train: train ? 'True' : 'False', mult: train ? mult : 1, gb: bytes(values * 4) });
    cv.redraw();
  };
  const onMove = (e: PointerEvent) => {
    const [, y] = local(e, cv.canvas);
    const g = geo(cw, ch);
    const i = Math.floor((y - g.top) / g.rh);
    if (i < 0 || i >= rows.length) return;
    hover = i;
    const r = rows[i];
    f.code.highlight(r.kind === 'conv' ? ['conv', 'act'] : r.kind === 'pool' ? ['pool', 'act'] : r.kind === 'fc' ? 'fc' : 'init');
    f.status(`\`${r.name}\`: output volume ${r.vol} = ${r.acts.toLocaleString('en-US')} activations, ${r.params.toLocaleString('en-US')} weights${r.kind === 'conv' ? ` (3·3·${Number(rows[i - 1]?.vol.split('×')[2] ?? 3)}·${r.vol.split('×')[2]})` : ''}.`);
    cv.redraw();
  };
  cv.canvas.classList.add('scroll-ok');
  cv.canvas.addEventListener('pointermove', onMove);
  cv.canvas.addEventListener('pointerdown', onMove);
  f.slider({ label: 'batch size', min: 0, max: 8, step: 1, value: 6, map: (r) => 2 ** Math.round(r), format: (v) => String(v), onInput: (v) => { batch = v; sync(); } });
  f.toggle({ label: 'training (keep gradients too)', value: true, onChange: (v) => { train = v; sync(); } });
  f.segmented({
    label: 'update rule',
    options: [
      { value: '2', label: 'SGD' },
      { value: '3', label: 'momentum' },
      { value: '4', label: 'Adam' },
    ],
    value: '3',
    onChange: (v) => {
      mult = Number(v);
      sync();
    },
  });
  f.status('Hover or tap a row to see its volume and where its numbers come from.');
  sync();
}

// ---------------------------------------------------------------------------------------

const chapter: ChapterDef = {
  symbols: {
    W: { color: 'blue', name: 'W: the filter weights (each filter is F × F × input depth)', code: ['W', 'W0', 'W1'] },
    X: { color: 'orange', name: 'X: the input volume (width × height × depth)', code: ['X', 'V'] },
    A: { color: 'purple', name: 'A: the output volume, a stack of activation maps', code: ['A'] },
    N: { color: 'gold', name: 'N: the input width (and height)', code: ['N'] },
    F: { color: 'slate', name: 'F: the filter size, F × F pixels', code: ['F'] },
    S: { color: 'slate', name: 'S: the stride, how far the filter jumps each step', code: ['S'] },
    P: { color: 'slate', name: 'P: the zero-padding added on every border', code: ['P'] },
    K: { color: 'teal', name: 'K: the number of filters, which becomes the output depth', code: ['K'] },
  },

  render(p) {
    p.prose(`
Every network so far has read an image the way you would read one long row of a spreadsheet: 3,072 numbers in a line, each wired to every neuron in the next layer. That wiring treats a pixel and its neighbor as no more related than two pixels on opposite corners, and it gets expensive very quickly.

**Convolutional networks** (ConvNets, or CNNs) keep everything you already know: neurons that compute weighted sums, nonlinearities, a loss at the end, backpropagation, the same update rules. They change only the wiring, in two ways that match how images work:

- each neuron looks at a **small patch** of its input instead of the whole thing, and
- the **same weights are reused at every position**, so a detector for, say, a vertical edge works wherever that edge happens to be.

Those two choices shrink the parameter count by orders of magnitude, and they are why ConvNets took over computer vision after 2012. This chapter builds the layers one at a time, works out the arithmetic of their sizes, and then tours the architectures that won the ImageNet challenge.`);

    // -------------------------------------------------------------------------------
    p.h2('Why regular networks do not scale', 'why');
    p.prose(`A CIFAR-10 image is 32 × 32 × 3, so one fully-connected neuron in a first hidden layer needs 3,072 weights. That is fine. But real photos are bigger, and the count grows with every pixel:`);
    p.math({
      label: 'Weights in one fully-connected neuron',
      tex: String.raw`\begin{gathered}\text{weights per neuron} \\ = \underbrace{200}_{\text{width}} \times \underbrace{200}_{\text{height}} \times \underbrace{3}_{\text{colors}} = 120{,}000\end{gathered}`,
      code: `
        x = image.reshape(-1)          # 200*200*3 = 120,000 numbers
        w = 0.01 * np.random.randn(120000)   # one weight per number
        s = w.dot(x)                   # one neuron's output
        # a layer of 1,000 such neurons: 120,000,000 weights
      `,
      terms: [
        [String.raw`200 \times 200`, 'the pixels of a modest 200 by 200 photo'],
        [String.raw`\times 3`, 'three color values (red, green, blue) per pixel'],
        [String.raw`120{,}000`, 'every one of those numbers gets its own weight, in every neuron'],
      ],
      explain: 'A useful layer has hundreds or thousands of neurons, so a first layer like this would hold over a hundred million weights. That is slow to train, needs enormous amounts of data, and invites overfitting. Worse, all those weights are spent learning the same few things (edges, blobs of color) separately at every location.',
    });
    p.prose(`
### Neurons in three dimensions

ConvNets take the hint that their input is an image and arrange their neurons the same way: in a block with a **width**, a **height** and a **depth**. A CIFAR-10 image is a 32 × 32 × 3 volume (depth 3 for red, green and blue). Each layer takes a volume in and hands a new volume to the next layer, and a CIFAR-10 classifier ends with a 1 × 1 × 10 volume: ten class scores.

A word of warning about vocabulary: here *depth* means the third dimension of a volume, the number of channels. It is not the depth of the network (its number of layers). Both meanings are in everyday use, and context tells you which one is meant.`);

    // -------------------------------------------------------------------------------
    p.h2('The layers of a ConvNet', 'layers');
    p.prose(`
A ConvNet is a sequence of layers, and every layer has the same contract: take a 3-D volume, apply a differentiable function (with or without parameters), return a 3-D volume. There are only a handful of kinds:

- **INPUT** holds the raw pixel values.
- **CONV** (convolutional) layers compute dot products between small filters and local patches of their input. They have weights.
- **RELU** applies $\\max(0, x)$ to every number. The size does not change and there are no weights.
- **POOL** shrinks the width and height, usually by keeping maximums. No weights.
- **FC** (fully-connected) layers are the layers of Chapter 7: every neuron sees the whole input volume. They have weights, and the last one produces the class scores.

Here is a minimal CIFAR-10 ConvNet, INPUT → CONV → RELU → POOL → FC, with the size of the volume after each layer:`);
    p.table(
      ['Layer', 'Output volume', 'What it does', 'Weights?'],
      [
        ['INPUT', '32 × 32 × 3', 'the raw image: width 32, height 32, three color channels', 'no'],
        ['CONV, 12 filters', '32 × 32 × 12', 'each output number is one filter dotted with one small patch', 'yes'],
        ['RELU', '32 × 32 × 12', '$\\max(0, x)$ on every number', 'no'],
        ['POOL', '16 × 16 × 12', 'halves width and height, keeps depth', 'no'],
        ['FC', '1 × 1 × 10', 'every neuron sees all 3,072 numbers: ten class scores', 'yes'],
      ],
    );
    p.prose(`Only the CONV and FC layers hold parameters, and gradient descent tunes them so the scores agree with the labels; RELU and POOL are fixed functions. Real networks repeat the CONV → RELU → POOL motif many times; the common patterns come near the end of this chapter.`);

    // -------------------------------------------------------------------------------
    p.h2('The convolutional layer', 'conv-layer');
    p.prose(`
The CONV layer does nearly all of the work, so it deserves a careful look.

### Filters that slide

A CONV layer owns a set of learnable **filters** (also called *kernels*). Each filter is small in width and height but always extends through the **full depth** of its input. On a color image a typical first-layer filter is 5 × 5 × 3: five pixels wide, five tall, all three color channels.

To apply a filter, slide it across the input. At each position, multiply the filter's numbers with the input numbers underneath, element by element, add everything up, and add a bias. That one number says how strongly the patch at that spot matches the filter. Doing this at every position produces a 2-D grid of responses called an **activation map**. A layer with 12 filters produces 12 activation maps, stacked along depth into an output volume of depth 12.

Start with the simplest case: one 3 × 3 filter on a grayscale image, so depth is 1 and each output is the sum of nine products. The filters below were designed by hand; a ConvNet learns its own.`);
    p.figure({
      title: 'One 3 × 3 filter sliding over a real image',
      codeTitle: 'conv_gray.py',
      code: `
        img = gray(X_train[{{idx:0}}])  # 32x32, values 0..1
        W = np.array([[{{w0}}, {{w1}}, {{w2}}],
                      [{{w3}}, {{w4}}, {{w5}}],
                      [{{w6}}, {{w7}}, {{w8}}]]){{scale}}
        X = np.pad(img, 1)   # zero ring: A stays 32x32
        A = np.zeros((32, 32))
        for i in range(32):
            for j in range(32):
                patch = X[i:i+3, j:j+3]      # 3x3 window  #@patch
                A[i, j] = np.sum(patch * W)  # 9 products  #@sum
        if {{relu:False}}:
            A = np.maximum(0, A)                           #@relu
        # A[{{i}}, {{j}}] = {{a}}
      `,
      setup: figKernel,
      caption: `**Hover** (or drag a finger) over either image: the orange square is the 3 × 3 receptive field in the input, the purple square is the one output number it produces, and the line under the figure spells out the nine multiplications. Try each filter. *Vertical edges* lights up where brightness changes from left to right (bright on one side of an edge, dark on the other, gray where nothing changes), *blur* averages neighbors, *sharpen* exaggerates differences. Tap a cell of $\\symW$ and drag the slider to make your own. Switching on **ReLU** keeps only the positive responses, which is what a CONV → RELU pair does.`,
    });
    p.callout('intuition', `During training, the first-layer filters of an image ConvNet come to look a lot like the hand-made ones above: edge detectors at many orientations, and blobs of color. Later layers combine those responses into detectors for textures, then object parts, then whole objects. [Chapter 12](#/visualizing) looks inside trained networks to see this directly.`);
    p.prose(`
### Local connectivity

In the language of neurons: each number in a CONV layer's output is a neuron, and it is connected only to a small region of the input called its **receptive field**. The receptive field's width and height equal the filter size $\\symF$; along depth, the connection is always complete.

Two quick counts:

- Input 32 × 32 × 3, filter size 5: each neuron has 5 × 5 × 3 = **75 weights** (plus 1 bias), instead of 3,072.
- Input 16 × 16 × 20, filter size 3: each neuron has 3 × 3 × 20 = **180 weights**. Small in space, but all 20 channels deep.

The $\\symK$ neurons at one position (one from each activation map) all look at exactly the same patch, each through a different filter. Together they are called a **depth column** (or *fibre*): a $\\symK$-number description of that patch.

Written out in full, one output number is a sum over the filter's width, height and depth:`);
    p.math({
      label: 'One output number of a CONV layer',
      tex: String.raw`\begin{gathered}\symA[i, j, k] = b_k + \sum_{u=0}^{\symF-1}\sum_{v=0}^{\symF-1}\sum_{d=0}^{D-1} \Big( \\ \symW_k[u, v, d] \cdot \symX[i\symS + u,\, j\symS + v,\, d] \Big)\end{gathered}`,
      code: `
        def conv_one(X, W, b, i, j, k, S):
            F = W.shape[1]                   # W has shape (K, F, F, D)
            patch = X[i*S:i*S+F, j*S:j*S+F, :]   # an F x F x D block
            return np.sum(patch * W[k]) + b[k]   # dot product, plus bias
      `,
      terms: [
        [String.raw`\symX`, 'the input volume, already zero-padded'],
        [String.raw`\symW_k`, 'filter number $k$: an $F \\times F \\times D$ block of weights'],
        [String.raw`i\symS + u,\; j\symS + v`, 'output position $(i, j)$ starts at input position $(iS, jS)$; $(u, v)$ walks across the filter from there'],
        [String.raw`\sum_u \sum_v \sum_d`, 'three nested loops: over the filter\'s rows, its columns, and every input channel'],
        [String.raw`b_k`, 'one bias per filter'],
        [String.raw`\symA[i, j, k]`, 'the result: row $i$, column $j$ of activation map $k$'],
      ],
      explain: 'Three Σ signs in a row look intimidating, but they are just three nested loops that visit every weight of the filter once, multiply it by the input number underneath, and add the products up. In code that is a single elementwise multiply of two same-shaped blocks followed by `np.sum`. The stride $S$ only decides where the block starts.',
    });
    p.prose(`
Now the real thing, in three dimensions. The input is a 5 × 5 × 3 volume, padded with one ring of zeros to 7 × 7 × 3. There are two filters of size 3 × 3 × 3 applied with a stride of 2, so the output is 3 × 3 × 2. Each of the 18 outputs takes 27 multiplications: nine per depth slice, three slice totals, plus a bias.`);
    p.figure({
      title: 'A CONV layer in 3-D: 7 × 7 × 3 in, 3 × 3 × 2 out',
      codeTitle: 'conv_volume.py',
      code: `
        # V: 5x5x3 input, W: two 3x3x3 filters
        X = np.pad(V, ((1, 1), (1, 1), (0, 0)))  # 7x7x3
        S = 2
        A = np.zeros((3, 3, 2))    # (5 - 3 + 2)/2 + 1 = 3
        for k, i, j in np.ndindex(2, 3, 3):  # filter, row, col
            patch = X[i*S:i*S+3, j*S:j*S+3, :]         #@patch
            A[i, j, k] = np.sum(patch * W[k]) + b[k]   #@sum
        # k = {{k:0}}, i = {{i:0}}, j = {{j:0}}: A[i, j, k] = {{a}}
      `,
      setup: figVolume,
      caption: `Press play or step. The orange windows mark the same 3 × 3 patch in all three depth slices of $\\symX$; under each slice, the matching slice of the current filter shows its weight (blue) and the input value it multiplies (orange). The three slice sums plus the bias give one number of $\\symA$. Notice that the window jumps two cells at a time (the stride), that the gray border is the zero-padding, and that the second filter revisits exactly the same windows with different weights.`,
    });
    p.callout('aside', `Strictly speaking, a mathematician's *convolution* flips the filter left-to-right and top-to-bottom before sliding it; sliding without flipping is called *cross-correlation*. Deep learning libraries compute cross-correlation and call it convolution anyway. Since the weights are learned, nothing is lost: a network that needs a flipped filter simply learns the flipped numbers.`, 'Convolution or cross-correlation?');

    // -------------------------------------------------------------------------------
    p.h2('Depth, stride and padding', 'arrangement');
    p.prose(`
Three hyperparameters decide the size of a CONV layer's output volume:

- **Depth** $\\symK$: the number of filters. Each looks for something different and contributes one activation map.
- **Stride** $\\symS$: how many pixels the filter jumps between positions. Stride 1 visits every position; stride 2 skips every other one and roughly halves width and height.
- **Zero-padding** $\\symP$: how many rings of zeros go around the input. Padding lets the filter center on border pixels and is the main tool for controlling the output size.

Width and height follow the same rule, so look at one of them. Call the input width $\\symN$. (The course notes call it $W$; we use $N$, as the lecture slides did, so it cannot be confused with the weights.) The number of positions the filter fits is:`);
    p.math({
      label: 'Output size of a CONV layer',
      tex: String.raw`N_{\text{out}} = \frac{\symN - \symF + 2\symP}{\symS} + 1`,
      code: `
        def conv_out(N, F, S, P):
            room = N - F + 2 * P       # how far the filter can slide
            assert room % S == 0, 'positions do not tile the input'
            return room // S + 1

        conv_out(7, 3, 1, 0)       # 5
        conv_out(7, 3, 2, 0)       # 3
        conv_out(227, 11, 4, 0)    # 55
      `,
      terms: [
        [String.raw`\symN + 2\symP`, 'the width after padding: $P$ zeros added on both sides'],
        [String.raw`\symN - \symF + 2\symP`, 'how far the left edge of the filter can travel before it would hang off the right side'],
        [String.raw`\div \symS`, 'how many jumps of size $S$ fit in that distance'],
        [String.raw`+\,1`, 'plus the starting position itself'],
      ],
      explain: 'Picture a 7-wide input and a 3-wide filter. The filter can start at position 0, 1, 2, 3 or 4: it travels $7 - 3 = 4$ steps, so there are $4 + 1 = 5$ positions. With stride 2 it only lands on 0, 2 and 4: $4 / 2 + 1 = 3$. Padding just makes the input wider before you count. If the division does not come out even, the setting is invalid.',
    });
    p.figure({
      title: 'Where the filter lands: the output-size formula, drawn',
      codeTitle: 'conv_size.py',
      code: `
        N, F, S, P = {{N:7}}, {{F:3}}, {{S:1}}, {{P:0}}
        room = N - F + 2 * P   # slide distance: {{room}}  #@room
        if room < 0 or room % S != 0:                #@check
            raise ValueError('filter does not tile')  #@bad
        N_out = room // S + 1  # = {{nout}}            #@out
        starts = [k * S for k in range(N_out)]       #@out
      `,
      setup: figSize,
      caption: `The top row is the input (dashed gray cells are padding); each slate bar below is one placement of the filter, staggered so overlapping placements stay visible; each purple cell is the output neuron that placement produces, drawn under its window's center. Try **stride 3**: the third placement would need cells that do not exist, so the formula gives 2.33 and the setting is rejected. **same padding** keeps the output as wide as the input. **AlexNet conv1** shows the real numbers from the next subsection.`,
    });
    p.prose(`
### Same padding

The most common choice in practice is to pad just enough that the output has the same width as the input. At stride 1 that means:`);
    p.math({
      label: '"Same" padding at stride 1',
      tex: String.raw`\begin{gathered}\symP = \frac{\symF - 1}{2} \\ N_{\text{out}} = \frac{\symN - \symF + (\symF - 1)}{1} + 1 = \symN\end{gathered}`,
      code: `
        F = 5
        P = (F - 1) // 2            # 2
        conv_out(32, F, 1, P)       # 32: same width as the input
        conv_out(32, 3, 1, 1)       # 32: F = 3 needs P = 1
      `,
      terms: [
        [String.raw`\symF - 1`, 'how many pixels a filter of size $F$ would shave off the width'],
        [String.raw`\frac{\symF - 1}{2}`, 'add back half of that on each side'],
      ],
      explain: 'A 3 × 3 filter needs one ring of zeros, a 5 × 5 filter needs two. This only works for odd filter sizes, which is one reason filters are almost always 1, 3, 5 or 7 wide.',
    });
    p.callout('warning', `Some settings simply do not work. With $\\symN = 10$, $\\symF = 3$, $\\symP = 0$ and $\\symS = 2$, the formula gives $(10 - 3 + 0)/2 + 1 = 4.5$: there is no way to place the filter so the positions cover the input evenly. A library will either refuse, or quietly drop the leftover column (or pad unevenly) without telling you. Making these numbers work out is part of designing an architecture.`, 'Invalid settings');
    p.prose(`
### A real example: AlexNet's first layer

The network that won the 2012 ImageNet challenge (Krizhevsky, Sutskever and Hinton) took 227 × 227 × 3 images. Its first CONV layer used $\\symF = 11$, $\\symS = 4$, $\\symP = 0$ and $\\symK = 96$ filters. The formula gives $(227 - 11 + 0)/4 + 1 = 55$, so the output volume is 55 × 55 × 96: 290,400 neurons, each looking at an 11 × 11 × 3 patch, with the 96 neurons of each depth column looking at the same patch through different filters.`);
    p.callout('history', `The AlexNet paper says its inputs were 224 × 224. That cannot be right: $(224 - 11)/4 + 1 = 54.25$ is not a whole number. The course notes guess that three pixels of padding went unmentioned. Whatever happened, the arithmetic only works out for 227, which is the number the course uses.`, '224 or 227?');

    // -------------------------------------------------------------------------------
    p.h2('Parameter sharing', 'sharing');
    p.prose(`
Count AlexNet's first layer the naive way: 290,400 neurons, each with 11 × 11 × 3 = 363 weights and one bias, makes 290,400 × 364 = **105,705,600** parameters. For one layer.

The way out is an assumption that fits images well: if a filter is useful for finding something at one position, it is useful everywhere. A vertical edge is a vertical edge at the top of the photo or at the bottom. So all the neurons of one activation map (one *depth slice*) share a single set of weights, and the layer needs only one filter per slice:`);
    p.math({
      label: 'Parameters of a CONV layer, with sharing',
      tex: String.raw`\begin{aligned}&\underbrace{\symF \cdot \symF \cdot D}_{\text{weights per filter}} \cdot \symK \;+\; \underbrace{\symK}_{\text{biases}} \\ &= 11 \cdot 11 \cdot 3 \cdot 96 + 96 \;=\; 34{,}944\end{aligned}`,
      code: `
        F, D, K = 11, 3, 96
        shared = F * F * D * K + K              # 34,944
        unshared = 55 * 55 * K * (F * F * D + 1)  # 105,705,600
        unshared / shared                       # about 3,025x more
      `,
      terms: [
        [String.raw`\symF \cdot \symF \cdot D`, 'one filter: $F \\times F$ in space, through all $D$ input channels (363 here)'],
        [String.raw`\cdot\,\symK`, 'one filter per output slice'],
        [String.raw`+\,\symK`, 'one bias per filter'],
      ],
      explain: 'The parameter count no longer depends on the size of the image at all: the 55 × 55 positions all reuse the same 96 filters. Sharing cuts this layer by a factor of 3,025, which is exactly the number of positions, 55 × 55.',
    });
    p.prose(`
This is where the name comes from. Computing one depth slice with a shared filter is a *convolution* of the input with that filter, so the layer's output is its input convolved with each of its filters. During backpropagation every neuron in a slice computes a gradient for the shared weights, and those gradients are added together into one update per filter.

### When sharing is the wrong assumption

Sharing assumes the same features matter everywhere. Sometimes they do not. If every input is a face cropped and centered the same way, eyes are always near the top and mouths near the bottom, so it can pay to learn different features in different places. Keeping the small receptive fields but dropping the sharing gives a **locally-connected layer**.

### The NumPy view

Here is the indexing made concrete. Say the input volume is a NumPy array \`V\` of shape (11, 11, 4). The **depth column** at position (x, y) is \`V[x, y, :]\`: all four channels at one spot. With filters of size 5, no padding and stride 2, the output is (11 − 5)/2 + 1 = 4 wide, and every output number is the sum of an elementwise product between a filter and a slice of \`V\`:`);
    p.code(`
      # V has shape (11, 11, 4); filters W0, W1 have shape (5, 5, 4)
      # F = 5, S = 2, P = 0, so A has shape (4, 4, K)

      # activation map 0: slide W0 along x in steps of 2
      A[0, 0, 0] = np.sum(V[:5, :5, :] * W0) + b0
      A[1, 0, 0] = np.sum(V[2:7, :5, :] * W0) + b0
      A[2, 0, 0] = np.sum(V[4:9, :5, :] * W0) + b0
      A[3, 0, 0] = np.sum(V[6:11, :5, :] * W0) + b0
      A[0, 1, 0] = np.sum(V[:5, 2:7, :] * W0) + b0   # and along y

      # activation map 1: the same slices, a different filter
      A[0, 0, 1] = np.sum(V[:5, :5, :] * W1) + b1
      A[1, 0, 1] = np.sum(V[2:7, :5, :] * W1) + b1
    `, { title: 'depth_columns.py' });
    p.prose(`Each step along an activation map moves the slice of \`V\` by the stride, and the second map reuses the same slices with filter \`W1\`. In a real network a ReLU would follow.

### Summary of the CONV layer`);
    p.table(
      ['', 'CONV layer'],
      [
        ['Accepts', 'a volume $\\symN \\times \\symN \\times D$ (width and height may differ; each follows the same rule)'],
        ['Hyperparameters', 'number of filters $\\symK$, filter size $\\symF$, stride $\\symS$, padding $\\symP$'],
        ['Produces', '$N_{\\text{out}} \\times N_{\\text{out}} \\times \\symK$ with $N_{\\text{out}} = (\\symN - \\symF + 2\\symP)/\\symS + 1$'],
        ['Parameters', '$\\symF \\cdot \\symF \\cdot D$ weights per filter: $(\\symF \\cdot \\symF \\cdot D) \\cdot \\symK$ weights and $\\symK$ biases in all'],
        ['Output slice $k$', 'filter $k$ slid over the padded input with stride $\\symS$, plus bias $b_k$'],
        ['Common settings', '$\\symK$ a power of 2 (32, 64, 128, 512); $\\symF = 3, \\symS = 1, \\symP = 1$; $\\symF = 5, \\symS = 1, \\symP = 2$; $\\symF = 1, \\symS = 1, \\symP = 0$'],
      ],
    );

    // -------------------------------------------------------------------------------
    p.h2('More about convolution', 'conv-more');
    p.prose(`
### As one big matrix multiply

The loops above are easy to read and very slow. Real implementations stretch every receptive field into one column of a big matrix (an operation called **im2col**), stretch every filter into one row of another, and compute the whole layer as a single matrix multiply, the most heavily optimized routine in numerical computing. The price is memory: overlapping patches get copied many times. [Chapter 13](#/convnets-practice/computing) builds it step by step.

### The backward pass

The backward pass of a convolution is again a convolution. The gradient for the input is the upstream gradient convolved with the same filters flipped left-to-right and top-to-bottom; the gradient for the weights comes from sliding the upstream gradient over the input. Assignment 2 has you write both with plain loops, then check them against a fast im2col version.

### 1 × 1 convolutions

A 1 × 1 filter sounds pointless until you remember that filters span the full depth. On a 56 × 56 × 64 volume, a 1 × 1 filter is a 64-number dot product at every pixel, and 32 of them turn the volume into 56 × 56 × 32. It mixes channels without looking at neighbors: a cheap way to change depth. The idea comes from the *Network in Network* paper (Lin et al.) and reappears in GoogLeNet and ResNet.

### Dilated convolutions

A recent twist (Fisher Yu and Vladlen Koltun, 2015) spreads a filter's taps apart, leaving gaps between the input cells it reads. In one dimension, with a gap of $g$ cells between taps:`);
    p.math({
      label: 'A dilated filter in one dimension',
      tex: String.raw`\symA[i] = \sum_{u=0}^{\symF-1} \symW[u]\; \symX\big[i + u\,(g + 1)\big]`,
      code: `
        def dilated_1d(X, W, gap):
            F = len(W)
            reach = (F - 1) * (gap + 1) + 1    # input cells covered
            return np.array([sum(W[u] * X[i + u * (gap + 1)]
                                 for u in range(F))
                             for i in range(len(X) - reach + 1)])
        # gap 0: W[0]*X[0] + W[1]*X[1] + W[2]*X[2]
        # gap 1: W[0]*X[0] + W[1]*X[2] + W[2]*X[4]
      `,
      terms: [
        [String.raw`u\,(g + 1)`, 'tap $u$ of the filter reads an input cell $u(g+1)$ to the right: with no gap these are neighbors, with gap 1 every other cell'],
        [String.raw`\symW[u]`, 'still only $F$ weights'],
      ],
      explain: 'A 3-tap filter with gap 1 covers 5 input cells with only 3 weights. Stacking layers whose gaps grow (1, 2, 4, ...) makes the region one neuron can see grow exponentially with depth instead of linearly, which helps when a prediction needs wide context, as in labeling every pixel of an image. Counting conventions vary: the course notes call this "dilation 1", while many libraries would call the same filter dilation 2.',
    });

    // -------------------------------------------------------------------------------
    p.h2('Pooling', 'pooling');
    p.prose(`
Between CONV layers it is common to insert a **pooling layer**. It shrinks the width and height of the volume, which cuts the parameters and computation in later layers and helps control overfitting. It works on each depth slice independently. The usual form is **max pooling** with 2 × 2 windows and stride 2: keep the largest of every four numbers. Width and height halve, depth stays the same, and 75% of the activations are thrown away.`);
    p.math({
      label: 'Max pooling',
      tex: String.raw`\begin{gathered}\symA[i, j, d] = \max_{u,\, v}\; \symX[i\symS + u,\; j\symS + v,\; d] \\ N_{\text{out}} = \frac{\symN - \symF}{\symS} + 1\end{gathered}`,
      code: `
        def max_pool(X, F=2, S=2):
            N, _, D = X.shape
            n = (N - F) // S + 1
            A = np.zeros((n, n, D))
            for i in range(n):
                for j in range(n):
                    A[i, j, :] = X[i*S:i*S+F, j*S:j*S+F, :].max(axis=(0, 1))
            return A
      `,
      terms: [
        [String.raw`\max_{u, v}`, 'the largest value in the $F \\times F$ window that starts at $(iS, jS)$: $u$ and $v$ each run from 0 to $F - 1$'],
        [String.raw`d`, 'the same depth slice in and out: pooling never mixes channels'],
        [String.raw`\frac{\symN - \symF}{\symS} + 1`, 'the CONV size formula with no padding'],
      ],
      explain: 'Max pooling asks, for each little window, "did this feature fire strongly anywhere in here?" and forgets exactly where. A 224 × 224 × 64 volume becomes 112 × 112 × 64. There are no weights to learn: it is a fixed function.',
    });
    p.figure({
      title: 'Max pooling forward, and the gradient routed back',
      codeTitle: 'max_pool.py',
      code: `
        X = np.array([[{{r0}}],
                      [{{r1}}],
                      [{{r2}}],
                      [{{r3}}]])   # one depth slice
        A = np.zeros((2, 2))
        for i in range(2):
            for j in range(2):
                win = X[2*i:2*i+2, 2*j:2*j+2]           #@win
                A[i, j] = win.{{op:max}}()              #@fwd
        # backward: dA arrives from the layer above
        dA = np.array([[{{g0}}], [{{g1}}]])
        dX = np.zeros(X.shape)
        for i in range(2):
            for j in range(2):
                win = X[2*i:2*i+2, 2*j:2*j+2]
                if '{{op}}' == 'max':
                    a, c = divmod(win.argmax(), 2)  # switch #@sw
                    dX[2*i + a, 2*j + c] = dA[i, j]              #@bmax
                else:
                    dX[2*i:2*i+2, 2*j:2*j+2] = dA[i, j] / 4      #@bavg
      `,
      setup: figPool,
      caption: `Step through the four forward windows, then the four backward ones. Going forward, each colored window keeps its largest value (ringed). Going backward, each incoming gradient in $dA$ lands on the cell that won its window, and the other three cells get exactly 0. Switch to **average** pooling to compare: there the gradient is split evenly four ways. Use **New numbers** to try other inputs.`,
    });
    p.prose(`
### Pooling in general

A pooling layer accepts a volume of width $\\symN$ and depth $D$, takes two hyperparameters ($\\symF$ and $\\symS$), and produces width $(\\symN - \\symF)/\\symS + 1$ with the same depth $D$. It has no parameters, and zero-padding is unusual. Only two settings are common: $\\symF = 2, \\symS = 2$, and the *overlapping* $\\symF = 3, \\symS = 2$ that AlexNet used. Larger windows throw away too much.

Max is not the only choice. **Average pooling** takes the mean of each window and was common in older networks; **L2-norm pooling** takes the square root of the sum of squares. Max pooling has generally worked better in practice.

### Backward through a max

Recall from [Chapter 6](#/backprop) that the gradient of $\\max(x, y)$ flows entirely to whichever input was larger: nudging the loser does not change the output at all. So the forward pass records where each maximum came from (these positions are called the **switches**), and the backward pass routes each incoming gradient straight to that one position.

### Getting rid of pooling

Not everyone likes pooling. *Striving for Simplicity: The All Convolutional Net* (Springenberg et al.) drops it entirely and shrinks the volume with an occasional CONV layer of stride 2 instead. Discarding pooling has also proved important for training generative models such as variational autoencoders and GANs ([Chapter 17](#/unsupervised)). In 2016 the course expected future architectures to use very little pooling, if any.`);

    // -------------------------------------------------------------------------------
    p.h2('Normalization and fully-connected layers', 'norm-fc');
    p.prose(`
### Normalization layers

Early ConvNets, AlexNet included, had *local response normalization* layers between some CONV layers, loosely inspired by the way neighboring neurons in the brain inhibit each other. They have fallen out of use: careful experiments showed they contributed little or nothing. (Batch normalization, from [Chapter 8](#/nn-data-loss), is a different idea and very much in use.)

### Fully-connected layers

An FC layer is the layer of an ordinary neural network: every neuron connects to every number in the input volume, and the whole layer is one matrix multiply plus a bias.

### FC layers are CONV layers in disguise

The only differences between FC and CONV neurons are that CONV neurons see a local patch and share their weights. Both compute dot products, so either kind of layer can be rewritten as the other. The useful direction is FC → CONV: an FC layer with $\\symK = 4096$ neurons looking at a 7 × 7 × 512 volume is exactly a CONV layer with $\\symF = 7$, $\\symP = 0$, $\\symS = 1$, $\\symK = 4096$. The filter is as large as its input, so it fits in exactly one position and the output is 1 × 1 × 4096.`);
    p.math({
      label: 'An FC neuron is a filter the size of its input',
      tex: String.raw`\begin{gathered}\underbrace{\symW_k \cdot \operatorname{flat}(\symX)}_{\text{FC neuron } k} \\ = \sum_{u,\,v,\,d} \symW_k[u, v, d]\;\symX[u, v, d] \\ = \underbrace{\symA[0, 0, k]}_{\text{CONV with } \symF = 7}\end{gathered}`,
      code: `
        X = feats                          # (7, 7, 512): the last pool
        W_fc = np.random.randn(4096, 7 * 7 * 512)
        fc = W_fc.dot(X.reshape(-1))       # (4096,): the FC layer
        W = W_fc.reshape(4096, 7, 7, 512)  # the same numbers as filters
        A = np.array([np.sum(X * W[k]) for k in range(4096)])
        np.allclose(fc, A)                 # True
      `,
      terms: [
        [String.raw`\operatorname{flat}(\symX)`, 'the 7 × 7 × 512 volume stretched into one long list of 25,088 numbers'],
        [String.raw`\symW_k \cdot \operatorname{flat}(\symX)`, 'FC neuron $k$: a dot product of its 25,088 weights with that list'],
        [String.raw`\sum_{u,\,v,\,d}`, 'the same products and the same sum, with the weights arranged as a 7 × 7 × 512 filter: $u$ and $v$ run from 0 to 6, $d$ from 0 to 511'],
      ],
      explain: 'Reshaping the weights does not change a single multiplication. The FC layer and the CONV layer compute identical numbers; only the bookkeeping differs. But the CONV version can also be slid over a bigger input, which the FC version cannot.',
    });
    p.prose(`
Why bother? Take an AlexNet-style network: five rounds of 2× downsampling turn a 224 × 224 image into a 7 × 7 × 512 volume (224 / 32 = 7), and three FC layers of sizes 4096, 4096 and 1000 produce the scores. Rewrite the first FC layer as a CONV layer with $\\symF = 7$ and the other two with $\\symF = 1$. For a 224 × 224 input nothing changes. But the network now accepts **bigger** images. Feed it 384 × 384: the CONV part produces a 12 × 12 × 512 volume (384 / 32 = 12), the converted layer fits at (12 − 7)/1 + 1 = 6 positions each way, and out comes a 6 × 6 × 1000 grid of class scores, one for every 224 × 224 crop at a stride of 32 pixels.`);
    p.figure({
      title: 'One pass over a big image = many crops at once',
      codeTitle: 'fc_as_conv.py',
      code: `
        size = {{size:384}}        # image: size x size x 3
        feat = size // 32          # {{feat}}x{{feat}}x512    #@feat
        # FC6 as CONV: 4096 filters, 7x7x512, stride 1
        n = (feat - 7) // 1 + 1    # {{n}}x{{n}}x4096        #@fc6
        # FC7, FC8 as 1x1 CONVs:   {{n}}x{{n}}x1000          #@fc78
        scores = convnet(image)    # ({{n}}, {{n}}, 1000)    #@scores
        # scores[{{i}}, {{j}}] equals the original net
        # run on image[{{y0}}:{{y0}}+224, {{x0}}:{{x0}}+224]    #@same
      `,
      setup: figSlide,
      caption: `Drag the slider to change the input size and watch the score grid grow: 224 gives a single score vector, 384 gives 6 × 6, 512 gives 10 × 10. **Tap** a score cell (or a spot on the image) to see which 224 × 224 crop it describes. The crops overlap heavily, so evaluating them one at a time would recompute the same CONV features over and over; the converted network computes each feature once. The "less work" figure is a rough estimate based on pixel area, which is what the cost of the CONV layers scales with.`,
    });
    p.prose(`
Running the converted network once gives exactly the same numbers as running the original one 36 times, at a fraction of the cost. A common trick at test time is to enlarge the image, get a grid of scores this way, and average them. To evaluate crops at a stride of 16 instead of 32, run the converted network twice, the second time on the image shifted by 16 pixels, and combine the two grids.`);

    // -------------------------------------------------------------------------------
    p.h2('Architectures', 'architectures');
    p.prose(`
### Layer patterns

Most ConvNets follow one pattern: a few CONV → RELU layers, then a POOL, repeated until the image is small, then a few FC layers. Written compactly:

<p class="eq-inline"><code>INPUT → [[CONV → RELU]*n → POOL?]*m → [FC → RELU]*k → FC</code></p>

Here \`*\` means repetition and \`POOL?\` means the pool is optional. Usually 0 ≤ n ≤ 3, m ≥ 0, and 0 ≤ k < 3. Some instances:

- \`INPUT → FC\`: a linear classifier (n = m = k = 0).
- \`INPUT → CONV → RELU → FC\`.
- \`INPUT → [CONV → RELU → POOL]*2 → FC → RELU → FC\`: one CONV between pools.
- \`INPUT → [CONV → RELU → CONV → RELU → POOL]*3 → [FC → RELU]*2 → FC\`: two CONVs before every pool. A good idea for larger, deeper networks, because stacked CONV layers can build richer features before pooling throws information away.

### Prefer stacks of small filters

Stack three 3 × 3 CONV layers with stride 1. A neuron in the first sees 3 × 3 pixels. A neuron in the second sees 3 × 3 neurons of the first, which together reach 5 × 5 pixels. The third reaches 7 × 7. So three small layers see as much of the image as a single 7 × 7 layer, and they win twice: three ReLUs instead of one make the features more expressive, and they need fewer weights. With $C$ channels in and out of every layer:`);
    p.math({
      label: 'Three 3 × 3 layers versus one 7 × 7 layer',
      tex: String.raw`\begin{gathered}\underbrace{3 \times (C \cdot 3 \cdot 3 \cdot C)}_{\text{three 3×3 layers}} = 27\,C^2 \\ \text{versus} \quad \underbrace{C \cdot 7 \cdot 7 \cdot C}_{\text{one 7×7 layer}} = 49\,C^2\end{gathered}`,
      code: `
        C = 64
        three_3x3 = 3 * (C * 3 * 3 * C)   # 110,592 = 27 * C**2
        one_7x7 = C * 7 * 7 * C           # 200,704 = 49 * C**2
        # same 7x7 view of the input, 45% fewer weights,
        # and three nonlinearities instead of one
      `,
      terms: [
        [String.raw`C \cdot 3 \cdot 3 \cdot C`, 'one 3 × 3 layer: $C$ filters, each $3 \\times 3 \\times C$'],
        [String.raw`3 \times`, 'three such layers'],
        [String.raw`C \cdot 7 \cdot 7 \cdot C`, 'one 7 × 7 layer: $C$ filters, each $7 \\times 7 \\times C$'],
        [String.raw`C^2`, 'both grow with the square of the channel count, so compare the numbers in front: 27 against 49'],
      ],
      explain: 'Filter area grows with the square of its width, so one wide filter is expensive. Covering the same region with several narrow layers costs less and inserts a ReLU between each pair. The price is memory: three layers produce three activation volumes that must be kept for the backward pass.',
    });
    p.figure({
      title: 'How far one neuron can see',
      codeTitle: 'receptive_field.py',
      code: `
        layers = [({{F:3}}, {{S:1}})] * {{L:3}}   # (F, S) per layer
        r, jump = 1, 1       # start from one top neuron
        for F, S in layers:
            r += (F - 1) * jump   # F-1 more steps   #@grow
            jump *= S             # step size, px    #@jump
        # receptive field: {{r}} x {{r}} pixels
        stacked = {{L}} * {{F}}**2  # {{stack}} (times C**2)
        single = r**2             # {{single}}, one big filter
      `,
      setup: figReceptive,
      caption: `Each row is a layer seen edge-on (one row of neurons), with the input at the bottom. The stepper follows one top neuron downward: it depends on $\\symF$ neurons of the layer below, each of which depends on $\\symF$ more, and so on. Add layers and watch the field grow by $\\symF - 1$ per layer; switch to **5 × 5** filters, or to **stride 2**, where every layer doubles the step size and the field grows much faster. The readout compares the weights of the stack with a single filter of the same reach.`,
    });
    p.prose(`
### Sizing rules of thumb

- **Input** sizes divisible by 2 many times: 32 (CIFAR-10), 64, 96 (STL-10), 224 (common for ImageNet), 384, 512.
- **CONV** layers with small filters (3 × 3, at most 5 × 5), stride 1, and same padding $\\symP = (\\symF - 1)/2$, so they never change width and height. Bigger filters (7 × 7 or so) usually appear only in the very first layer.
- **POOL** layers do all the downsampling, almost always 2 × 2 max pooling with stride 2 (sometimes 3 × 3 with stride 2).

This division of labor (CONV layers change depth, POOL layers change size) saves a lot of bookkeeping: you never have to check that strides and filter sizes fit. Stride 1 also tends to work better, and padding helps beyond keeping sizes tidy: without it every layer trims the border, and information near the edges gets washed away after a few layers.

Memory sometimes forces a compromise. Three 3 × 3 CONV layers with 64 filters on a 224 × 224 × 3 image produce three 224 × 224 × 64 volumes: about 9.6 million activations, or roughly 74 MB per image once their gradients are counted. So networks usually compromise in the first layer only: ZF Net starts with 7 × 7 filters at stride 2, AlexNet with 11 × 11 at stride 4.

### Don't be a hero

Two notes from 2016. First, the newest networks (Google's Inception family, Microsoft's ResNets) break the simple stack of layers with more intricate wiring. Second, and more practically: for the vast majority of applications you should not design an architecture at all. Take whatever currently works best on ImageNet, download its pretrained weights, and fine-tune it on your data. [Chapter 13](#/convnets-practice/transfer) explains how.`);

    // -------------------------------------------------------------------------------
    p.h2('Case studies', 'case-studies');
    p.prose(`A handful of networks mark the milestones. The error column is the top-5 error on the ImageNet (ILSVRC) classification challenge: the fraction of test images whose correct label is not among the network's five best guesses.`);
    p.table(
      ['Network', 'Year', 'What it showed', 'Top-5 error'],
      [
        ['**LeNet** (LeCun et al.)', '1990s', 'the first successful ConvNets: 5 × 5 convolutions and 2 × 2 subsampling, CONV-POOL-CONV-POOL-CONV-FC; read zip codes and digits', 'n/a'],
        ['**AlexNet** (Krizhevsky, Sutskever, Hinton)', '2012', 'a bigger, deeper LeNet with CONV layers stacked directly on each other, ReLU, dropout, heavy data augmentation; trained on two GPUs; 60M parameters', 'about 16% (runner-up: 26%)'],
        ['**ZF Net** (Zeiler, Fergus)', '2013', 'AlexNet retuned: a 7 × 7 stride-2 first layer instead of 11 × 11 stride 4, and wider middle CONV layers', '14.8%'],
        ['**GoogLeNet** (Szegedy et al.)', '2014', 'the *Inception module*, and average pooling instead of large FC layers at the top: a few million parameters (4M by the notes\' count) against AlexNet\'s 60M', '6.7%'],
        ['**VGGNet** (Simonyan, Zisserman)', '2014 (2nd)', 'depth matters: 16 layers built only from 3 × 3 convolutions and 2 × 2 pooling; about 138M parameters', '7.3%'],
        ['**ResNet** (He et al.)', '2015', '*skip connections* and batch normalization everywhere, 152 layers, no large FC layers at the end', '3.6%'],
      ],
      { caption: 'Error figures as quoted in the 2016 lecture slides and notes.' },
    );
    p.prose(`
### AlexNet, layer by layer

Every size below follows from the output-size formula. (The table is the simplified single-column version shown in lecture; the original split its filters across two GPUs.)`);
    p.table(
      ['Layer', 'Output volume', 'Settings'],
      [
        ['INPUT', '227 × 227 × 3', ''],
        ['CONV1', '55 × 55 × 96', '96 filters, 11 × 11, stride 4, pad 0'],
        ['MAX POOL1', '27 × 27 × 96', '3 × 3, stride 2: (55 − 3)/2 + 1 = 27'],
        ['NORM1', '27 × 27 × 96', 'local response normalization'],
        ['CONV2', '27 × 27 × 256', '256 filters, 5 × 5, stride 1, pad 2'],
        ['MAX POOL2', '13 × 13 × 256', '3 × 3, stride 2'],
        ['NORM2', '13 × 13 × 256', ''],
        ['CONV3, CONV4', '13 × 13 × 384', '384 filters each, 3 × 3, stride 1, pad 1'],
        ['CONV5', '13 × 13 × 256', '256 filters, 3 × 3, stride 1, pad 1'],
        ['MAX POOL3', '6 × 6 × 256', '3 × 3, stride 2'],
        ['FC6, FC7', '4096 each', ''],
        ['FC8', '1000', 'class scores'],
      ],
    );
    p.prose(`
Its training recipe became the template for years: ReLU nonlinearities, dropout of 0.5, batches of 128, SGD with momentum 0.9, a learning rate of $10^{-2}$ divided by 10 by hand whenever validation accuracy stalled, L2 weight decay of $5 \\times 10^{-4}$, and an ensemble of several networks at the end.

### VGGNet

VGG's appeal is its uniformity: every CONV layer is 3 × 3 with stride 1 and padding 1, every pool is 2 × 2 with stride 2, and the whole network is a stack of them. Its downside is cost. It uses a lot of memory and about 138 million parameters, most of them (over 100 million) in the first FC layer. Later work found those FC layers could be removed with no loss in accuracy. The [last section](#/convnets/compute) breaks it down layer by layer.

### GoogLeNet and ResNet

GoogLeNet's Inception module runs several small filters side by side and uses 1 × 1 convolutions to keep the channel counts in check, which is how it gets by with a few million parameters. ResNet adds the input of a block of layers back to its output (a *skip connection*), so each block only has to learn a correction. That made networks of 152 layers trainable. ResNets used batch normalization after every CONV layer and no dropout, took two to three weeks to train on an 8-GPU machine, and still ran faster at test time than VGGNet despite having about 8 times as many layers. As of mid-2016 they were the default choice for using ConvNets in practice.`);

    // -------------------------------------------------------------------------------
    p.h2('Computational considerations', 'compute');
    p.prose(`
The tightest constraint when building a ConvNet is usually memory. In 2016 typical GPUs had 3, 4 or 6 GB and the best had 12 GB. Memory goes to three places:

- **Activations**: every layer's output volume, plus a gradient of the same size during training. They are kept because backpropagation needs them, and most of them live in the early CONV layers, where volumes are biggest. (At test time a careful implementation could keep only the current layer.)
- **Parameters**: the weights, their gradients, and usually a step cache for momentum, Adagrad or RMSProp (Adam keeps two). So the parameter count gets multiplied by about 3 or more.
- **Miscellaneous**: the batch of images itself, augmented copies, and so on.

Here is the full VGG-16 breakdown, computed by code:`);
    p.figure({
      title: 'Where VGG-16 keeps its numbers',
      codeTitle: 'vgg16_memory.py',
      code: `
        cfg = [64, 64, 'M', 128, 128, 'M',
               256, 256, 256, 'M', 512, 512, 512, 'M',
               512, 512, 512, 'M']
        H, D = 224, 3
        acts, params = [H * H * D], [0]   # the input  #@init
        for v in cfg:
            if v == 'M':
                H //= 2              # 2x2 max pool    #@pool
                params.append(0)                       #@pool
            else:
                params.append(3 * 3 * D * v)  # no b   #@conv
                D = v                                  #@conv
            acts.append(H * H * D)                     #@act
        for n_in, n_out in [(7 * 7 * 512, 4096),
                            (4096, 4096), (4096, 1000)]:
            params.append(n_in * n_out)                #@fc
            acts.append(n_out)                         #@fc
        # sum(acts) = {{acts}}, sum(params) = {{params}}

        batch, train = {{batch:64}}, {{train:True}}
        copies = {{mult:3}}   # weights, grads, step cache
        values = (batch * sum(acts) * (2 if train else 1)
                  + sum(params) * copies)
        values * 4 / 1024**3     # GB: {{gb}}            #@gb
      `,
      setup: figVgg,
      caption: `Two bar charts side by side make the chapter's central trade-off visible: the **activations** are almost all in the first few CONV layers (big volumes, few channels), while the **weights** are almost all in the FC layers, the first one alone holding about three quarters of them. Hover a row for details. Then change the batch size and the update rule: the activation term grows with the batch, the parameter term does not, which is why "make the batch smaller" is the standard fix when a network does not fit.`,
    });
    p.math({
      label: 'From counts to gigabytes',
      tex: String.raw`\begin{aligned}\text{values} &= 2 \cdot \text{batch} \cdot \text{acts} + 3 \cdot \text{params} \\ \text{GB} &\approx 4 \times \text{values} \,/\, 1024^3\end{aligned}`,
      code: `
        acts, params = 15_237_608, 138_344_128     # VGG-16, per image
        values = 64 * acts * 2 + params * 3
        values * 4 / 1024**3                       # about 8.8 GB
      `,
      terms: [
        [String.raw`\text{acts}`, 'the activations of one image (15.2 million for VGG-16)'],
        [String.raw`2 \cdot \text{batch} \cdot`, 'every image in the batch has its own activations, and each activation gets a gradient'],
        [String.raw`3 \cdot \text{params}`, 'weights, gradients, and one step cache (momentum); Adam needs one more copy'],
        [String.raw`4 \times`, 'a 32-bit float takes 4 bytes (use 8 for 64-bit doubles)'],
        [String.raw`/\, 1024^3`, 'bytes to kilobytes to megabytes to gigabytes, dividing by 1,024 each time'],
      ],
      explain: 'Count values, multiply by bytes per value, divide down to gigabytes. VGG-16 at a batch of 64 needs about 8.8 GB just for these terms, which is why it was usually trained with smaller batches or split across GPUs. For scale, the 2016 lecture quoted about 3 GB for AlexNet at a batch size of 256.',
    });
    p.callout('aside', `The course notes' VGG table ends with "24M × 4 bytes ≈ 93 MB / image", but adding up the rows of that same table gives about 15.2 million values, or about 58 MB per image (forward pass only). The figure and the card above use the sum of the rows. Either way, the lesson stands: tens of megabytes per image, mostly in the first few layers, before a single gradient is stored.`, 'A note on the 24M figure');

    p.callout('idea', `A ConvNet is a stack of layers that turn one 3-D volume into another. CONV layers slide small, full-depth filters over their input; local connectivity and parameter sharing make them vastly cheaper than FC layers, and $(\\symN - \\symF + 2\\symP)/\\symS + 1$ tells you the size of what comes out. Pooling shrinks width and height and routes gradients back through its switches. FC layers are CONV layers with filters as big as their input, which lets a trained net slide over larger images. Good architectures stack small 3 × 3 filters, pad to keep sizes, pool to downsample, and spend their memory on early activations and their parameters on late FC layers.`, 'Takeaways');
  },
};

export default chapter;
