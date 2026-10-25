// The two interactive openers of the courses: a CIFAR-10 image as numbers, and an attention pattern.
import { CodePanel } from '../core/code';
import { CIFAR_CLASSES, cifarImage, loadCifar } from '../core/data';
import { h, onDispose } from '../core/dom';
import type { Page } from '../core/page';
import { color, withAlpha } from '../core/plot';

/** The hero: one real CIFAR-10 image as a pixel grid, with the code that reads the pixel under the pointer. */
export function pixelArt(page: Page): HTMLElement {
  const canvas = h('canvas', { width: 32, height: 32, 'aria-label': 'A CIFAR-10 image drawn as a grid of pixels' });
  const code = new CodePanel(
    `
    img = X_train[{{i:0}}]          # one image: shape (32, 32, 3)
    img[{{y:16}}, {{x:16}}]                 # row y, column x
    # -> array([{{r:0}}, {{g:0}}, {{b:0}}])   red, green, blue (0-255)
    `,
    { bare: true, symIdx: page.symIdx },
  );
  const cap = h('div', { class: 'hero-art-cap' }, 'Point at any pixel. It is just three numbers.');
  const wrap = h('div', { class: 'hero-art' }, canvas, h('div', { class: 'listing', style: 'margin:10px 0 0' }, code.el), cap);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ccc';
  ctx.fillRect(0, 0, 32, 32);
  loadCifar()
    .then(({ train }) => {
      const picks = [7, 104, 213, 371, 489, 506, 640, 777, 812, 960];
      let pick = picks[Math.floor(Math.random() * picks.length)]!;
      const show = () => {
        const img = cifarImage(train, pick);
        ctx.putImageData(img, 0, 0);
        code.set('i', pick);
        cap.textContent = `A real CIFAR-10 training image (class: ${CIFAR_CLASSES[train.labels[pick]!]}). Point at any pixel: it is just three numbers. Tap to load another.`;
        read(16, 16);
      };
      const read = (x: number, y: number) => {
        const o = pick * 3072 + y * 32 + x;
        code.setMany({ x, y, r: train.pixels[o]!, g: train.pixels[o + 1024]!, b: train.pixels[o + 2048]! });
        ctx.putImageData(cifarImage(train, pick), 0, 0);
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 0.35;
        ctx.strokeRect(x + 0.18, y + 0.18, 0.64, 0.64);
      };
      canvas.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        const x = Math.min(31, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * 32)));
        const y = Math.min(31, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * 32)));
        read(x, y);
      });
      canvas.addEventListener('click', () => {
        pick = (pick + 97) % train.n;
        show();
      });
      show();
    })
    .catch(() => {
      cap.textContent = 'An image is a grid of numbers: 32 x 32 pixels, three color values each.';
    });
  return wrap;
}

/** Six words and how much each one attends to the words before it (rows sum to 1). */
const ATT_WORDS = ['The', 'cat', 'sat', 'on', 'the', 'mat'];
const ATT = [
  [1, 0, 0, 0, 0, 0],
  [0.38, 0.62, 0, 0, 0, 0],
  [0.06, 0.71, 0.23, 0, 0, 0],
  [0.05, 0.18, 0.52, 0.25, 0, 0],
  [0.22, 0.04, 0.08, 0.41, 0.25, 0],
  [0.04, 0.33, 0.12, 0.21, 0.16, 0.14],
];

/** The DL26 hero: a causal attention pattern, with the four lines of NumPy that compute one. */
export function attentionArt(page: Page): HTMLElement {
  const canvas = h('canvas', { class: 'hero-att', 'aria-label': 'An attention pattern: each word, as a row, spreading its attention over the words before it' });
  const code = new CodePanel(
    `
    scores = Q @ K.T / np.sqrt(d)            #@score
    scores[np.triu_indices(6, k=1)] = -np.inf  #@mask
    A = softmax(scores, axis=1)              #@soft
    A[{{i:2}}]   # "{{w:sat}}" -> {{row:...}}  #@row
    out = A @ V                              #@out
    `,
    { bare: true, symIdx: page.symIdx },
  );
  const cap = h('div', { class: 'hero-art-cap' }, 'Each row is a word deciding where to look. Tap a row.');
  const wrap = h('div', { class: 'hero-art' }, canvas, h('div', { class: 'listing', style: 'margin:10px 0 0' }, code.el), cap);
  let row = 2;
  const draw = () => {
    const css = canvas.clientWidth || 320;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(css * dpr)) {
      canvas.width = Math.round(css * dpr);
      canvas.height = Math.round(css * dpr);
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(canvas.width / 320, 0, 0, canvas.height / 320, 0, 0);
    ctx.clearRect(0, 0, 320, 320);
    const x0 = 62, y0 = 50, c = 40;
    ctx.font = `500 13px ${getComputedStyle(document.body).getPropertyValue('--font-mono') || 'monospace'}`;
    ctx.textBaseline = 'middle';
    for (let j = 0; j < 6; j++) {
      ctx.fillStyle = color('--ink-3');
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(x0 + j * c + c / 2, y0 - 12);
      ctx.fillText(ATT_WORDS[j]!, 0, 0);
      ctx.restore();
    }
    for (let i = 0; i < 6; i++) {
      ctx.textAlign = 'right';
      ctx.fillStyle = i === row ? color('--accent') : color('--ink-2');
      ctx.fillText(ATT_WORDS[i]!, x0 - 10, y0 + i * c + c / 2);
      for (let j = 0; j < 6; j++) {
        const a = ATT[i]![j]!;
        const x = x0 + j * c, y = y0 + i * c;
        ctx.fillStyle = j > i ? withAlpha(color('--ink-3'), 0.07) : withAlpha(color('purple'), 0.08 + 0.9 * a);
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, c - 4, c - 4, 6);
        ctx.fill();
        if (j <= i && i === row) {
          ctx.textAlign = 'center';
          ctx.fillStyle = a > 0.45 ? '#fff' : color('--ink');
          ctx.font = `600 11px ${getComputedStyle(document.body).getPropertyValue('--font-mono') || 'monospace'}`;
          ctx.fillText(a.toFixed(2).replace(/^0/, ''), x + c / 2, y + c / 2);
          ctx.font = `500 13px ${getComputedStyle(document.body).getPropertyValue('--font-mono') || 'monospace'}`;
        }
      }
    }
    ctx.strokeStyle = color('--accent');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x0, y0 + row * c, 6 * c, c, 8);
    ctx.stroke();
    code.setMany({ i: row, w: ATT_WORDS[row]!, row: `[${ATT[row]!.slice(0, row + 1).map((v) => v.toFixed(2)).join(', ')}${row < 5 ? ', 0, ...' : ''}]` });
    code.highlight('row');
  };
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * 320;
    const i = Math.floor((y - 50) / 40);
    if (i >= 0 && i < 6) {
      row = i;
      draw();
    }
  });
  const ro = new ResizeObserver(() => draw());
  ro.observe(canvas);
  onDispose(() => ro.disconnect());
  return wrap;
}
