import { CHAPTERS, COURSES, type CourseMeta, hasChapter } from './chapters/index';
import { CodePanel } from './core/code';
import { icon } from './core/controls';
import { CIFAR_CLASSES, cifarImage, loadCifar } from './core/data';
import { h, onDispose } from './core/dom';
import { Page } from './core/page';
import { color, withAlpha } from './core/plot';
import { hasLecture } from './lectures/index';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

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
function attentionArt(page: Page): HTMLElement {
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

function howto(page: Page): HTMLElement {
  const sec = h('section', { class: 'howto' });
  const card = (ic: string, title: string, body: string) => h('div', { class: 'howto-card' }, h('h3', { html: `${icon(ic)}${title}` }), h('div', { class: 'prose', html: page.md(body) }));
  sec.append(
    card('play', 'Watch, explore, practice', 'Every chapter opens with a narrated lecture you can simply watch. Then the interactive chapter: figures to drag, with their code beside them. Then something to build.'),
    card('code', 'Every picture has its code', 'Figures sit next to the Python they illustrate. Drag a slider and the numbers in the code change with it; step through an algorithm and the line that is running lights up.'),
    card('eye', 'Colors are names', 'Every symbol has a color that follows it from equation to code to prose. Hover or tap a colored symbol anywhere and every other place it appears lights up.'),
  );
  return sec;
}

function partsGrid(root: HTMLElement, course: CourseMeta, seen: Set<string>): void {
  course.parts.forEach((part, pi) => {
    const sec = h('section', { class: 'part' },
      h('div', { class: 'part-head' }, h('span', { class: 'part-num' }, ROMAN[pi]!), h('h2', { class: 'part-title' }, part)));
    const grid = h('div', { class: 'cards' });
    for (const c of CHAPTERS.filter((x) => x.course === course.id && x.part === part)) {
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
}

function cs231nIntro(root: HTMLElement): Page {
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
        h('div', { class: 'hero-kicker' }, 'CS231n · Stanford · Winter 2016'),
        h('h1', { class: 'hero-title', html: 'Teaching machines <em>to see</em>, one line of code at a time.' }),
        h('p', { class: 'hero-lede' }, 'An interactive companion to Convolutional Neural Networks for Visual Recognition, the course Andrej Karpathy, Justin Johnson and Fei-Fei Li taught at Stanford. Every idea comes with a picture you can poke, and every picture comes with the code that drew it.'),
        h('div', { class: 'hero-actions' },
          h('a', { class: 'btn btn-primary', href: '#/welcome', html: `Start the course ${icon('arrowRight')}` }),
          h('a', { class: 'btn', href: '#/math-kit', html: `${icon('math')} Math survival kit` }),
          h('a', { class: 'btn', href: `#/${first.id}`, html: `${icon('image')} Jump to images` }))),
      heroArt(page)),
  );
  root.append(howto(page));
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
  return page;
}

function dl26Intro(root: HTMLElement): Page {
  const page = new Page(root, 'home', '0', {
    Q: { color: 'blue', name: 'Q: the queries, what each word is looking for' },
    K: { color: 'orange', name: 'K: the keys, what each word offers to be found by' },
    V: { color: 'green', name: 'V: the values, what each word hands over when found' },
    A: { color: 'purple', name: 'A: the attention weights, one row per word, each row summing to 1' },
  });
  root.append(
    h('section', { class: 'hero' },
      h('div', {},
        h('div', { class: 'hero-kicker' }, 'DL26 · The continuation · 2017 to 2026'),
        h('h1', { class: 'hero-title', html: 'A decade later: <em>attention</em>, scale and feedback.' }),
        h('p', { class: 'hero-lede' }, 'CS231n ended in 2016, just before deep learning changed shape. This course picks up there: transformers, tokens and pretraining, scaling laws, modern optimizers like Muon, diffusion, and the post-training methods (RLHF, PPO, DPO, RLVR, GRPO) that turn a text predictor into a reasoning model. Same format: every idea is a picture you can poke, beside the code that computes it.'),
        h('div', { class: 'hero-actions' },
          h('a', { class: 'btn btn-primary', href: '#/decade', html: `Start the course ${icon('arrowRight')}` }),
          h('a', { class: 'btn', href: '#/transformer', html: `${icon('brain')} The Transformer` }),
          h('a', { class: 'btn', href: '#/cs231n', html: `${icon('book')} Need the basics? CS231n` }))),
      attentionArt(page)),
  );
  root.append(howto(page));
  page.prose('The whole decade turns on one equation. Every word of a sentence asks a question ($\\symQ$), every word advertises what it is about ($\\symK$), and every word gets back a blend of the others ($\\symV$), weighted by how well question and advertisement match ($\\symA$).');
  page.math({
    label: 'Attention',
    tex: String.raw`\symA = \operatorname{softmax}\!\left(\frac{\symQ \symK^{\top}}{\sqrt{d}}\right), \qquad \text{out} = \symA \symV`,
    code: `
      scores = Q @ K.T / np.sqrt(d)   # how well each query matches each key
      A = softmax(scores, axis=1)     # each row: positive weights summing to 1
      out = A @ V                     # each word: a weighted blend of values
    `,
    codeTitle: 'attention.py',
    terms: [
      [String.raw`\symQ \symK^{\top}`, 'every query dotted with every key: a table of match scores, one row per word'],
      [String.raw`\sqrt{d}`, 'a fixed divisor that keeps the scores from growing with the vector length d'],
      [String.raw`\operatorname{softmax}`, 'turns each row of scores into positive weights that add up to 1'],
      [String.raw`\symA \symV`, 'each word collects the values of the words it attends to, in those proportions'],
    ],
    explain: 'A soft dictionary lookup. Instead of fetching exactly one entry, every word fetches a little of everything, mostly from the entries whose keys match its query. Chapter 2 builds this up from scratch; the rest of the course is about making it big, fast, and useful.',
  });
  return page;
}

const FOOT: Record<string, string> = {
  cs231n: 'An unofficial, independent study companion. CS231n was created at Stanford by Fei-Fei Li, Andrej Karpathy and Justin Johnson; the [original course notes](https://cs231n.github.io/) remain the canonical reference. Figures here are original re-implementations, and the images are a small sample of [CIFAR-10](https://www.cs.toronto.edu/~kriz/cifar.html) (Krizhevsky, 2009).',
  dl26: 'An independent course that continues CS231n. Each chapter links the papers it follows; the figures are original re-implementations at toy scale, small enough to run in your browser.',
};

/** A course's front page: its introduction, then every chapter grouped by part. */
export function renderCourse(main: HTMLElement, course: CourseMeta, seen: Set<string>): void {
  const root = h('div', { class: 'home', 'data-page': `course-${course.id}` });
  main.append(root);
  const page = course.id === 'cs231n' ? cs231nIntro(root) : dl26Intro(root);
  partsGrid(root, course, seen);
  root.append(h('footer', { class: 'home-foot', html: page.md(FOOT[course.id] ?? '') }));
}

/** The site's front page: the courses. */
export function renderIndex(main: HTMLElement): void {
  const root = h('div', { class: 'home', 'data-page': 'index' });
  main.append(root);
  const page = new Page(root, 'index', '0', {});
  root.append(h('section', { class: 'hero hero-index' },
    h('div', {},
      h('div', { class: 'hero-kicker' }, 'Interactive courses'),
      h('h1', { class: 'hero-title', html: 'Deep learning, <em>one line of code</em> at a time.' }),
      h('p', { class: 'hero-lede' }, 'Two courses, ten years apart. The first is Stanford\'s CS231n as taught in 2016: how machines learned to see. The second picks up where it ends: transformers, scale, and models trained by feedback. Each chapter is a narrated lecture, an interactive explainer, and something to build.'))));
  const grid = h('div', { class: 'courses' });
  for (const k of COURSES) {
    const chapters = CHAPTERS.filter((c) => c.course === k.id && !c.num.startsWith('A'));
    const lectures = chapters.filter((c) => hasLecture(c.id)).length;
    const stats = [`${chapters.length} chapters`, lectures ? `${lectures} lectures` : ''].filter(Boolean).join(' · ');
    grid.append(h('a', { class: 'course-card', href: `#/${k.id}` },
      h('div', { class: 'course-top' }, h('span', { class: 'course-code' }, k.code), h('span', { class: 'course-era' }, k.era)),
      h('div', { class: 'course-title' }, k.title),
      h('div', { class: 'course-blurb' }, k.blurb),
      h('div', { class: 'course-foot' }, h('span', {}, stats), h('span', { class: 'course-go', html: `Open ${icon('arrowRight')}` }))));
  }
  root.append(grid, howto(page));
  root.append(h('footer', { class: 'home-foot', html: page.md('An independent study companion. CS231n was created at Stanford by Fei-Fei Li, Andrej Karpathy and Justin Johnson; DL26 is this site\'s own continuation.') }));
}
