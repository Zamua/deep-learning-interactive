import { CHAPTERS, PARTS, hasChapter } from './chapters/index';
import { CodePanel } from './core/code';
import { icon } from './core/controls';
import { CIFAR_CLASSES, cifarImage, loadCifar } from './core/data';
import { h } from './core/dom';
import { Page } from './core/page';
import { hasLecture } from './lectures/index';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** The hero: one real CIFAR-10 image as a pixel grid, with the code that reads the pixel under the pointer. */
function heroArt(page: Page): HTMLElement {
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

export function renderHome(main: HTMLElement, seen: Set<string>): void {
  const root = h('div', { class: 'home', 'data-page': 'home' });
  main.append(root);
  const page = new Page(root, 'home', '0', {
    W: { color: 'blue', name: 'W: the weights, one row per class' },
    x: { color: 'orange', name: 'x: the image, stretched into one long column of numbers' },
    b: { color: 'green', name: 'b: the biases, one number per class' },
    s: { color: 'purple', name: 's: the scores, one per class', code: ['scores'] },
  });

  const first = CHAPTERS.find((c) => c.id === 'image-classification')!;
  root.append(
    h('section', { class: 'hero' },
      h('div', {},
        h('div', { class: 'hero-kicker' }, 'Stanford CS231n · Winter 2016'),
        h('h1', { class: 'hero-title', html: 'Teaching machines <em>to see</em>, one line of code at a time.' }),
        h('p', { class: 'hero-lede' }, 'An interactive companion to Convolutional Neural Networks for Visual Recognition, the course Andrej Karpathy, Justin Johnson and Fei-Fei Li taught at Stanford. Every idea comes with a picture you can poke, and every picture comes with the code that drew it.'),
        h('div', { class: 'hero-actions' },
          h('a', { class: 'btn btn-primary', href: '#/welcome', html: `Start the course ${icon('arrowRight')}` }),
          h('a', { class: 'btn', href: '#/math-kit', html: `${icon('math')} Math survival kit` }),
          h('a', { class: 'btn', href: `#/${first.id}`, html: `${icon('image')} Jump to images` }))),
      heroArt(page)),
  );

  const howto = h('section', { class: 'howto' });
  const card = (ic: string, title: string, body: string) => h('div', { class: 'howto-card' }, h('h3', { html: `${icon(ic)}${title}` }), h('div', { class: 'prose', html: page.md(body) }));
  howto.append(
    card('code', 'Every picture has its code', 'Figures sit next to the Python they illustrate. Drag a slider and the numbers in the code change with it; step through an algorithm and the line that is running lights up.'),
    card('eye', 'Colors are names', 'Every symbol has a color that follows it from equation to code to prose. Hover or tap a colored symbol anywhere and every other place it appears lights up.'),
    card('math', 'Math, gently', 'Every equation is read out piece by piece, in plain words, with the NumPy that computes it right beside it. If you last saw calculus years ago, the survival kit has your back.'),
  );
  root.append(howto);

  page.prose('Here is the idea in miniature. This is the first real equation of the course: how a linear classifier scores an image. Try hovering $\\symW$, $\\symx$ or $\\symb$.');
  page.math({
    label: 'Scoring an image',
    tex: String.raw`\syms = \symW \symx + \symb`,
    code: `
      x = img.reshape(3072)    # the image as one long column of 3072 numbers
      scores = W.dot(x) + b    # W: (10, 3072), b: (10,)  ->  scores: (10,)
      scores.argmax()          # the class with the highest score wins
    `,
    codeTitle: 'score.py',
    terms: [
      [String.raw`\symx`, 'the image, every pixel value lined up in one column (3072 of them)'],
      [String.raw`\symW`, 'a grid of numbers with one row per class (10 rows); learning means finding good values here'],
      [String.raw`\symW\symx`, 'each row of `W` multiplied with the image and summed: one number per class'],
      [String.raw`\symb`, 'a per-class nudge, added at the end'],
      [String.raw`\syms`, 'ten scores, one per class; the biggest one is the guess'],
    ],
    explain: 'Multiply the image by a grid of learned numbers, add a little offset, and read off ten numbers. A high number means "this looks like my class." Chapter 4 builds this from scratch and trains it on real images while you watch.',
  });

  PARTS.forEach((part, pi) => {
    const sec = h('section', { class: 'part' },
      h('div', { class: 'part-head' }, h('span', { class: 'part-num' }, ROMAN[pi]!), h('h2', { class: 'part-title' }, part)));
    const grid = h('div', { class: 'cards' });
    for (const c of CHAPTERS.filter((x) => x.part === part)) {
      const top = h('div', { class: 'card-top' }, h('span', { class: 'card-num' }, c.num.startsWith('A') ? c.num : `Chapter ${c.num}`), h('span', {}, c.lectures ?? ''));
      if (hasLecture(c.id)) top.append(h('span', { class: 'card-lec', html: `${icon('playFill')} lecture` }));
      if (seen.has(c.id)) top.append(h('span', { class: 'card-seen', html: `${icon('check')} read` }));
      grid.append(h('a', { class: `card${hasChapter(c.id) ? '' : ' soon'}`, href: `#/${c.id}` }, top,
        h('div', { class: 'card-title' }, c.title.replace(/^Assignment \d: /, '')),
        h('div', { class: 'card-blurb' }, c.blurb)));
    }
    sec.append(grid);
    root.append(sec);
  });

  root.append(h('footer', { class: 'home-foot', html: page.md('An unofficial, independent study companion. CS231n was created at Stanford by Fei-Fei Li, Andrej Karpathy and Justin Johnson; the [original course notes](https://cs231n.github.io/) remain the canonical reference. Figures here are original re-implementations, and the images are a small sample of [CIFAR-10](https://www.cs.toronto.edu/~kriz/cifar.html) (Krizhevsky, 2009).') }));
}
