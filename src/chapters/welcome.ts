import type { ChapterDef } from './index';
import { CHAPTERS, COURSES } from './index';
import { color, withAlpha } from '../core/plot';
import { WELCOME_SYMBOLS } from '../lib/welcome-symbols';

const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
const UI = 'system-ui, sans-serif';

/** ILSVRC classification results, top-5 error in percent (VGG placed second in 2014). */
const ILSVRC = [
  { year: 2010, name: 'NEC-UIUC', err: 28.2, deep: false, note: 'Hand-designed features (dense HOG and LBP descriptors), encoded and pooled over a spatial pyramid, then a linear SVM. The best of the pre-deep-learning recipe.' },
  { year: 2011, name: 'XRCE', err: 25.8, deep: false, note: 'Fisher-vector encodings of local descriptors with linear classifiers. Still hand-designed features, and only a small improvement.' },
  { year: 2012, name: 'AlexNet', err: 16.4, deep: true, note: 'Krizhevsky, Sutskever and Hinton: an 8-layer ConvNet trained on two GPUs. Error fell by ten points in one year. (Their entry that also used extra pretraining data scored 15.3%.)' },
  { year: 2013, name: 'ZFNet', err: 11.7, deep: true, note: 'Zeiler and Fergus: AlexNet with better-tuned filter sizes and strides, found partly by visualizing what each layer had learned. The winning entry ran under Clarifai.' },
  { year: 2014, name: 'VGG', err: 7.3, deep: true, note: 'Simonyan and Zisserman: 16 to 19 layers built from small 3 × 3 convolutions. Second place in classification, and a favorite for years after because it is so simple.' },
  { year: 2014, name: 'GoogLeNet', err: 6.7, deep: true, note: 'Szegedy et al.: 22 layers made of "Inception" modules, with far fewer parameters than AlexNet. The 2014 winner.' },
  { year: 2015, name: 'ResNet', err: 3.6, deep: true, note: 'He et al. (Microsoft Research Asia): 152 layers, trainable because each block adds its output to a shortcut copy of its input. Below the human estimate.' },
];
const HUMAN = 5.1;

const PART_INTRO: Record<string, string> = {
  'Start here': 'Orientation and the toolkit. Chapters 1 and 2 are references as much as chapters: skim them now, and come back whenever a later page leans on a sum, a slope or a NumPy trick.',
  'Neural networks': 'The core of the course (Lectures 2 to 6), best read in order, because each chapter builds on the last. It goes from the simplest possible classifier to a neural network trained with backpropagation, and ends with a complete worked example. Assignment 1 and the first half of Assignment 2 live here.',
  'Convolutional networks': 'Networks built for images: how convolution and pooling work, what trained networks have learned, how they are used in practice, and how they find and outline objects. Assignment 2 ends with a ConvNet; Assignment 3 looks inside one.',
  'Beyond still images': 'Sequences, attention, video and learning without labels. The recurrent-network chapter is the basis of the image captioning questions in Assignment 3.',
  Assignments: 'What each 2016 assignment asked for, question by question, with links back to the chapters that teach each piece.',
};

const chapter: ChapterDef = {
  symbols: WELCOME_SYMBOLS,

  render(p) {
    p.prose(`
Stanford's **CS231n**, as it was taught in the winter of 2016, is one of the most influential courses in modern machine learning. This page says what the course is, retells the short history of computer vision that it opens with, and maps what follows.`);

    p.h2('What CS231n is', 'cs231n');
    p.prose(`
CS231n, *Convolutional Neural Networks for Visual Recognition*, was first taught at Stanford in Winter 2015. This companion follows the **Winter 2016** run, taught by **Fei-Fei Li**, **Andrej Karpathy** and **Justin Johnson**. Karpathy wrote most of the course notes (still online at [cs231n.github.io](https://cs231n.github.io)), Johnson wrote the assignments and the Python and NumPy tutorial, and the two of them gave most of the lectures.

The course is about one problem above all: **image classification**, looking at a photo and saying what is in it. It builds everything needed to solve that problem from scratch, in plain NumPy, before moving on to related problems such as finding objects, describing images in sentences, and generating images.`);
    p.table(
      ['Component', 'In 2016'],
      [
        ['Lectures', '15 recorded lectures, January 4 to March 2 (the last an invited talk by Jeff Dean)'],
        ['Assignments', 'three, written in Python with NumPy, worth 15% of the grade each'],
        ['Midterm', 'in class on February 10, 15%'],
        ['Final project', '40%: a proposal, a milestone (5%), a final write-up (35%) and a poster session'],
      ],
      { caption: 'The structure of the 2016 course, from its first lecture and syllabus. The official prerequisites were Python, college calculus, linear algebra and some machine learning; this site assumes only the Python.' },
    );
    p.callout('aside', 'This is an **unofficial** companion. It is not affiliated with or endorsed by Stanford or the course staff. The explanations, figures and code here are written fresh; the links to the original notes appear at the top of each chapter, and they are well worth reading alongside.', 'Unofficial');

    p.h2('A short history of seeing', 'history');
    p.prose(`
Lecture 1 begins very far back. About 540 million years ago, in a geologically short window, the number and variety of animal species exploded. The zoologist Andrew Parker has argued that the trigger was the appearance of the first eyes: once animals could see, hunting and hiding became an arms race. Whether or not that is the whole story, vision is old, and a large share of the human brain is devoted to it.

Machines have been trying to see for only about sixty years. Here is the lecture's tour of the highlights, compressed.`);
    p.prose(`
- **1959, Hubel and Wiesel.** Recording from single neurons in a cat's visual cortex, they find **simple cells** that fire for an edge or bar of light at one particular orientation and position, and **complex cells** that care less about the exact position. Simple detectors first, combined into more complex ones: the blueprint for ConvNets.
- **1963, Larry Roberts.** An MIT PhD thesis, *Machine Perception of Three-Dimensional Solids*, recovers simple block shapes from the edges in a photo ("block world"). Often counted as the start of computer vision.
- **1966, MIT.** The **Summer Vision Project** proposes building a large part of a visual system in one summer. Vision turned out to be far harder than it looks; the problem is still open.
- **1970s, David Marr.** His book *Vision* (1982) describes seeing as a ladder of representations: a **primal sketch** of edges, bars and blobs, then a **2½-D sketch** of depth and surfaces as seen from the viewer, then a **3-D model** of the object itself.
- **1973, 1979, Fischler and Elschlager; Brooks and Binford.** **Pictorial structures** (an object as parts held together by springs) and **generalized cylinders** (objects assembled from simple 3-D primitives): recognizing things by their parts.
- **1987, David Lowe.** Recognizing three-dimensional objects by matching lines and edges in a single image.
- **1997, Shi and Malik.** **Normalized cuts**: split an image into coherent regions by cutting a graph of pixels, without knowing what the objects are.
- **1999, David Lowe.** **SIFT** features: distinctive keypoint descriptors that survive changes of scale, rotation and lighting, so the same object can be matched across very different photos.
- **2001, Viola and Jones.** Real-time **face detection** with a boosted cascade of very simple features. Within a few years it was running inside consumer digital cameras.
- **2005, Dalal and Triggs.** **Histograms of oriented gradients** (HOG), designed for finding pedestrians. You compute HOG features yourself in [Assignment 1](#/a1).
- **2006, Lazebnik, Schmid and Ponce.** **Spatial pyramid matching**: histograms of local features pooled over a pyramid of image regions, for recognizing scenes.
- **2008, Felzenszwalb, McAllester and Ramanan.** **Deformable part models**: HOG templates for an object and its parts, with the parts allowed to shift. The strongest detectors before ConvNets.
- **2006 to 2012, Everingham et al..** The **PASCAL** Visual Object Classes challenge: a shared benchmark with 20 categories, which made progress measurable year over year.
- **2009, Deng, Dong, Socher, Li, Li and Fei-Fei.** **ImageNet**: more than 14 million photos labeled into about 22,000 categories, organized by the WordNet hierarchy and labeled with the help of crowd workers.`);
    p.prose(`
Three threads run through that table, and all three meet in this course.

The first is the **brain**. Hubel and Wiesel's picture of vision as a hierarchy (simple, local detectors feeding more complex, more forgiving ones) is almost exactly the shape of a convolutional network. Trained ConvNets even rediscover their result: their first layer fills up with oriented edge detectors, as [chapter 12](#/visualizing) shows.

The second is **features**. From SIFT to HOG to spatial pyramids, the best systems of the 2000s were pipelines: people designed clever ways to turn pixels into descriptive numbers, and a simple learned classifier (often a linear SVM, [chapter 4](#/linear-classification)) made the final call. Most of the engineering went into the features. Deep learning's change was to learn the features too.

The third is **data**. As benchmarks grew from PASCAL's 20 categories to ImageNet's thousands, it became clear that models with many parameters need very many examples, and that a big, public, carefully labeled dataset could focus a whole field.`);

    p.h2('ImageNet and the 2012 turning point', 'imagenet');
    p.prose(`
Starting in 2010, the ImageNet team ran a yearly competition, the **ImageNet Large Scale Visual Recognition Challenge** (ILSVRC). Its classification task uses 1,000 categories and about 1.2 million training images (about 1.43 million counting the validation and test sets). Many of the categories are fine-grained: about 120 of them are breeds of dog.

Each entry gets five guesses per test image. If the correct label is among them, the image counts as right. The headline number is the **top-5 error**: the fraction of test images where all five guesses missed.`);
    p.math({
      label: 'Top-5 error',
      tex: String.raw`\symerr = \frac{1}{N}\sum_{i=1}^{N} \mathbf{1}\!\left[\,\symy_i \notin \operatorname{top5}(\syms_i)\,\right]`,
      code: `
        # scores: (N, 1000) class scores, y: (N,) labels
        # the five best-scoring classes of each image
        top5 = np.argsort(-scores, axis=1)[:, :5]
        # True where the label is one of those five
        hit = (top5 == y[:, None]).any(axis=1)
        err = 1.0 - hit.mean()   # fraction missed
      `,
      codeTitle: 'top5_error.py',
      terms: [
        [String.raw`\syms_i`, 'the 1,000 class scores the model gives test image $i$'],
        [String.raw`\operatorname{top5}(\syms_i)`, 'the five classes with the highest scores: the model\'s five guesses'],
        [String.raw`\symy_i \notin \operatorname{top5}(\syms_i)`, 'the true label $\\symy_i$ is *not in* that set of five (the symbol ∉ reads "is not in")'],
        [String.raw`\mathbf{1}[\,\cdot\,]`, 'an *indicator*: 1 if the statement inside the brackets is true, 0 if it is false. Each image contributes 1 for a miss and 0 for a hit'],
        [String.raw`\frac{1}{N}\sum_{i=1}^{N}`, 'add up over all $N$ test images (Σ means "add up"), then divide by $N$: an average'],
        [String.raw`\symerr`, 'the result: the fraction of images that were missed'],
      ],
      explain: 'Why five guesses? Many photos contain several objects, and each has only one official label, so a model that answers "keyboard" for a photo labeled "desk" is not really wrong. Five guesses soften that. A top-5 error of 16% means that for about one test image in six, the right answer was not among the model\'s five best guesses. The code does the same thing in three moves: sort the scores to find each image\'s five best classes, check whether the label is one of them, and average the misses.',
    });

    p.figure({
      title: 'Top-5 error on ImageNet, year by year',
      codeTitle: 'ilsvrc_plot.py',
      code: `
        import numpy as np
        import matplotlib.pyplot as plt

        # ILSVRC top-5 error, in percent
        entries = [
            (2010, 'NEC-UIUC',  28.2),   #@e0
            (2011, 'XRCE',      25.8),   #@e1
            (2012, 'AlexNet',   16.4),   #@e2
            (2013, 'ZFNet',     11.7),   #@e3
            (2014, 'VGG',        7.3),   #@e4
            (2014, 'GoogLeNet',  6.7),   #@e5
            (2015, 'ResNet',     3.6),   #@e6
        ]
        human = 5.1   # one trained person, 2014   #@human

        rows = np.arange(len(entries))
        errors = [err for _, _, err in entries]
        labels = ['%d %s' % (yr, nm)
                  for yr, nm, _ in entries]
        colors = ['tab:blue' if yr >= 2012 else 'gray'
                  for yr, _, _ in entries]

        plt.barh(rows, errors, color=colors)              #@bars
        plt.yticks(rows, labels)
        plt.gca().invert_yaxis()       # 2010 at the top
        plt.axvline(human, ls='--', color='red')          #@human
        plt.xlabel('top-5 error (%)')
        plt.show()
        # pointing at: {{sel:nothing yet}}
      `,
      setup(f) {
        let sel: number | 'human' | null = null;
        let errLit = false;
        const XMAX = 30;
        const layout = (w: number, h: number) => {
          const left = Math.min(128, w * 0.34);
          const right = 46;
          const top = 26;
          const bottom = 40;
          const rowH = (h - top - bottom) / ILSVRC.length;
          const X = (v: number) => left + (v / XMAX) * (w - left - right);
          return { left, right, top, bottom, rowH, X };
        };
        const chart = f.canvas(640, 440, (ctx, w, h) => {
          const L = layout(w, h);
          const base = h - L.bottom;
          ctx.lineWidth = 1;
          ctx.textBaseline = 'middle';
          for (let v = 0; v <= XMAX; v += 5) {
            const x = Math.round(L.X(v)) + 0.5;
            ctx.strokeStyle = color(v === 0 ? '--axis' : '--grid');
            ctx.beginPath();
            ctx.moveTo(x, L.top - 4);
            ctx.lineTo(x, base);
            ctx.stroke();
            ctx.fillStyle = color('--ink-3');
            ctx.font = `11px ${MONO}`;
            ctx.textAlign = 'center';
            ctx.fillText(String(v), x, base + 11);
          }
          ctx.font = `11px ${UI}`;
          ctx.fillText('top-5 error (%)', L.X(XMAX / 2), base + 28);
          ILSVRC.forEach((e, i) => {
            const on = sel === i;
            const dim = sel !== null && !on;
            const c = color(e.deep ? 'blue' : 'slate');
            const y0 = L.top + i * L.rowH + L.rowH * 0.17;
            const bh = L.rowH * 0.66;
            const x1 = L.X(e.err);
            ctx.fillStyle = withAlpha(c, on ? 0.9 : dim ? 0.3 : 0.62);
            ctx.beginPath();
            ctx.roundRect(L.X(0), y0, x1 - L.X(0), bh, [0, 4, 4, 0]);
            ctx.fill();
            if (on) {
              ctx.strokeStyle = c;
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.lineWidth = 1;
            }
            ctx.textAlign = 'right';
            ctx.fillStyle = color(on ? '--ink' : '--ink-2');
            ctx.font = `${on ? '600 ' : ''}12px ${UI}`;
            ctx.fillText(`${e.year} ${e.name}`, L.left - 8, y0 + bh / 2);
          });
          const hx = Math.round(L.X(HUMAN)) + 0.5;
          const humanOn = sel === 'human';
          ctx.strokeStyle = color('red');
          ctx.lineWidth = humanOn ? 2.5 : 1.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(hx, L.top - 8);
          ctx.lineTo(hx, base);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = color('red');
          ctx.font = `${humanOn ? '600 ' : ''}11px ${UI}`;
          ctx.textAlign = 'left';
          ctx.fillText(`human ${HUMAN}%`, hx + 5, L.top - 12);
          ILSVRC.forEach((e, i) => {
            const on = sel === i;
            const label = `${e.err}%`;
            const ym = L.top + i * L.rowH + L.rowH / 2;
            ctx.font = `${on || errLit ? '600 ' : ''}11px ${MONO}`;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = color('--paper');
            ctx.fillRect(L.X(e.err) + 3, ym - 7, tw + 4, 14);
            ctx.textAlign = 'left';
            ctx.fillStyle = errLit ? color('red') : color(on ? '--ink' : '--ink-3');
            ctx.fillText(label, L.X(e.err) + 5, ym);
          });
        });
        chart.canvas.classList.add('scroll-ok');
        const intro = 'Point at (or tap) a bar to light its line of data in the code, or the red dashed line for the human estimate.';
        f.status(intro);
        const select = (s: number | 'human' | null) => {
          if (s === sel) return;
          sel = s;
          if (s === null) {
            f.code.highlight(null);
            f.code.set('sel', 'nothing yet');
            f.status(intro);
          } else if (s === 'human') {
            f.code.highlight('human');
            f.code.set('sel', `human, ${HUMAN}`);
            f.status(`**Human, ${HUMAN}%.** Andrej Karpathy trained himself on the 1,000 classes and labeled a sample of test images by hand, the same way the models are scored. One careful person, not a law of nature, but a useful yardstick.`);
          } else {
            const e = ILSVRC[s]!;
            f.code.highlight(`e${s}`);
            f.code.set('sel', `${e.name}, ${e.err}`);
            f.status(`**${e.year}, ${e.name}: ${e.err}%.** ${e.note}`);
          }
          chart.redraw();
        };
        const pick = (e: PointerEvent): number | 'human' | null => {
          const r = chart.canvas.getBoundingClientRect();
          const L = layout(r.width, r.height);
          const px = e.clientX - r.left;
          const py = e.clientY - r.top;
          const hx = L.X(HUMAN);
          if (py < L.top - 2 && px > hx - 4 && px < hx + 90) return 'human';
          if (Math.abs(px - hx) < 6 && py < r.height - L.bottom) return 'human';
          const i = Math.floor((py - L.top) / L.rowH);
          return i >= 0 && i < ILSVRC.length ? i : null;
        };
        chart.canvas.addEventListener('pointermove', (e) => {
          if (e.pointerType === 'mouse') select(pick(e));
        });
        chart.canvas.addEventListener('pointerdown', (e) => select(pick(e)));
        chart.canvas.addEventListener('pointerleave', (e) => {
          if (e.pointerType === 'mouse') select(null);
        });
        f.onSym((k) => {
          errLit = k === 'err';
          chart.redraw();
        });
      },
      caption: `Each bar is the best classification result of its year (VGG, second in 2014, is included because it shaped so much later work). Gray bars are pipelines of hand-designed features; blue bars are convolutional networks. **Point at or tap a bar** and its line in \`entries\` lights up; the red dashed line lights the two lines that define and draw it. Then hover \`errors\` in the code: the value labels on the chart turn red, because they are that list.`,
    });

    p.prose(`
In 2010 and 2011 the winners were refined versions of the feature pipeline from the history table: dense hand-designed descriptors, clever encodings, spatial pyramids, and linear classifiers. Progress was a point or two a year.

In 2012 a team from Toronto entered a convolutional network, now called **AlexNet**, and cut the error from about 26% to about 16%. Every winner after that was a ConvNet, and each was deeper than the last: 8 layers in 2012, about 20 in 2014, 152 in 2015. By 2015 the error was below Karpathy's own measured human error of 5.1%. CS231n was created in the middle of this wave, to teach exactly these methods.`);

    p.h2('Why 2012? Old ideas, new fuel', 'why-2012');
    p.prose(`
It is tempting to think something new was invented in 2012. Mostly, it was not. In 1980 Kunihiko Fukushima built the **Neocognitron**, a layered network of simple-cell and complex-cell units directly inspired by Hubel and Wiesel. Starting in 1989, Yann LeCun and colleagues trained convolutional networks with backpropagation, and their **LeNet-5** (1998) read handwritten digits well enough to be used for reading checks. AlexNet has essentially LeNet's shape: convolution, pooling, then fully connected layers.

What changed was the fuel.`);
    p.table(
      ['', 'LeNet-5 (LeCun et al., 1998)', 'AlexNet (Krizhevsky et al., 2012)'],
      [
        ['Task', 'handwritten digits, 10 classes', 'ImageNet photos, 1,000 classes'],
        ['Input', '32 × 32 grayscale', '224 × 224 color'],
        ['Training images', 'about 60,000', 'about 1.2 million'],
        ['Learned numbers (parameters)', 'about 60 thousand', 'about 60 million'],
        ['Hardware', 'CPUs, chips of around 10⁶ transistors', 'two NVIDIA GTX 580 GPUs, chips of around 10⁹ transistors; about a week of training'],
        ['Pixels seen in training', 'around 10⁷', 'around 10¹⁴'],
        ['Nonlinearity and tricks', 'tanh-like squashing units', 'ReLU units, dropout, heavy data augmentation'],
      ],
      { caption: 'The transistor and pixel counts are the orders of magnitude from the 2016 Lecture 1 slides.' },
    );
    p.prose(`
Three things came together. **Data**: ImageNet supplied over a million labeled photos, enough to train tens of millions of parameters without simply memorizing. **Compute**: graphics cards, built to do enormous numbers of multiplications in parallel for video games, turned out to be perfect for the matrix multiplies inside a network. And a handful of **practical tricks** (ReLU units, dropout, careful initialization and data augmentation) made big networks train reliably. You will meet every one of them: ReLU in [chapter 7](#/nn-architecture), dropout and initialization in [chapter 8](#/nn-data-loss), augmentation and GPUs in [chapter 13](#/convnets-practice).`);
    p.callout('history', 'Lecture 1 ends by pointing past classification. Detection, captioning and full scene understanding all build on it. In one experiment by Fei-Fei Li and colleagues, people shown a photo for only half a second could write a rich description of it: who was doing what, and where. Matching that is still a long way off, which is part of what makes the field fun.', 'Beyond one label per image');

    p.h2('The map', 'map');
    p.prose(`
The course has five parts. Read the first part as needed, then the chapters roughly in order; the assignment pages are best read once you have covered the chapters each one draws on (the next section says which).`);
    for (const part of COURSES.find((k) => k.id === 'cs231n')!.parts) {
      const items = CHAPTERS.filter((c) => c.course === 'cs231n' && c.part === part);
      const list = items.map((c) => `- [**${c.num}.** ${c.title}](#/${c.id})${c.lectures ? ` (${c.lectures})` : ''}: ${c.blurb}${c.id === 'welcome' ? ' *You are here.*' : ''}`).join('\n');
      p.prose(`### ${part}\n\n${PART_INTRO[part] ?? ''}\n\n${list}`);
    }

    p.h2('The assignments', 'assignments');
    p.prose(`
The three 2016 assignments are where the course really happens. Each is a set of IPython (now Jupyter) notebooks plus a small Python package called \`cs231n\`. You write the missing functions in the package's files, such as a loss function or a layer's backward pass, and the notebooks check your work (comparing against numerically computed gradients, for example) and then run experiments with it on real data.

They build on each other. In Assignment 1 you write a two-layer network as one big function. In Assignment 2 you take that apart into reusable layers, each with a forward and a backward pass, and snap them together into deep fully connected networks and a ConvNet. Assignment 3 reuses those layers for recurrent networks, and hands you a pretrained ConvNet built from the same pieces to explore with image gradients.`);
    p.table(
      ['Assignment', 'What you build', 'Read first'],
      [
        ['[A1](#/a1), due January 20, 2016', 'kNN, a linear SVM, a Softmax classifier and a two-layer network on CIFAR-10, plus classifiers on HOG and color-histogram features', 'chapters [2](#/numpy) to [7](#/nn-architecture), and [10](#/case-study)'],
        ['[A2](#/a2), due February 5, 2016', 'modular layers, SGD with momentum, RMSProp and Adam, batch normalization, dropout, convolution and pooling layers, and your best ConvNet on CIFAR-10', 'chapters [6](#/backprop), [8](#/nn-data-loss), [9](#/nn-learning), [11](#/convnets) and [13](#/convnets-practice)'],
        ['[A3](#/a3), due February 24, 2016', 'image captioning with RNNs and LSTMs on Microsoft COCO; saliency maps, fooling images, class visualization, feature inversion and DeepDream on TinyImageNet', 'chapters [15](#/rnn) and [12](#/visualizing)'],
      ],
    );

    p.callout('idea', `CS231n teaches image classification with convolutional networks, from first principles, in NumPy. The ideas behind ConvNets are decades old (Hubel and Wiesel, the Neocognitron, LeNet); what made them win in 2012 was data (ImageNet), compute (GPUs) and a few training tricks, and the ImageNet error then fell from about 26% to under 4% in four years. On this site every figure has its code beside it, live values and lit lines tie the two together, colored symbols link math to code, and every equation card ends in plain words.`, 'Takeaways');
  },
};

export default chapter;
