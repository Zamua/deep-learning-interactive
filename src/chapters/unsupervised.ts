import type { ChapterDef } from './index';
import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { TinyNet } from '../lib/unsupervised-net';

const UI = 'system-ui, sans-serif';
const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
const font = (size: number, weight = 500, mono = false) => `${weight} ${size}px ${mono ? MONO : UI}`;

/** Two toy 2-D datasets: an elongated cloud (a line in disguise) and a C-shaped arc. */
function toy2d(kind: 'blob' | 'arc', n: number, seed: number): Float64Array {
  const r = new Rng(seed);
  const X = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    if (kind === 'arc') {
      const t = (0.35 + 1.3 * r.next()) * Math.PI;
      X[2 * i] = 1.1 * Math.cos(t) + 0.05 * r.randn();
      X[2 * i + 1] = 0.95 * Math.sin(t) + 0.05 * r.randn();
    } else {
      const u = 0.9 * r.randn(), v = 0.2 * r.randn();
      const a = Math.PI / 6;
      X[2 * i] = u * Math.cos(a) - v * Math.sin(a);
      X[2 * i + 1] = u * Math.sin(a) + v * Math.cos(a);
    }
  }
  return X;
}

const gauss = (x: number, m: number, s: number) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
const sigm = (v: number) => 1 / (1 + Math.exp(-v));

/** Column (temporal) layout of the fusion diagram: [first frame, last frame] each unit sees. */
type Span = [number, number];
const FUSION: Record<string, { frames: number[]; rows: Span[][]; note: string }> = {
  single: { frames: [7], rows: [[[7, 7]], [[7, 7]], [[7, 7]], [[7, 7]]], note: '1 frame' },
  late: { frames: [0, 15], rows: [[[0, 0], [15, 15]], [[0, 0], [15, 15]], [[0, 0], [15, 15]], [[0, 15]]], note: '2 frames, 15 apart, merged only at the FC layer' },
  early: { frames: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], rows: [[[3, 12]], [[3, 12]], [[3, 12]], [[3, 12]]], note: '10 frames, merged at the very first layer' },
  slow: {
    frames: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    rows: [[[3, 6], [5, 8], [7, 10], [9, 12]], [[3, 8], [7, 12]], [[3, 12]], [[3, 12]]],
    note: '10 frames, merged a little at each layer',
  },
};

const chapter: ChapterDef = {
  symbols: {
    x: { color: 'orange', name: 'x: a data point (an image, a clip, or here often a 2-D point)', code: ['x', 'X', 'x_real'] },
    z: { color: 'purple', name: 'z: the latent code, a few numbers that summarize x', code: ['z'] },
    mu: { color: 'teal', name: 'μ: the mean the encoder predicts for z', tex: '\\mu', code: ['mu'] },
    sig: { color: 'green', name: 'σ: the spread (standard deviation) the encoder predicts for z', tex: '\\sigma', code: ['sigma'] },
    eps: { color: 'slate', name: 'ε: noise drawn from a standard normal distribution', tex: '\\epsilon', code: ['eps'] },
    G: { color: 'blue', name: 'G: the generator, turning noise into a fake sample', code: ['G'] },
    D: { color: 'gold', name: 'D: the discriminator, giving the probability a sample is real', code: ['D'] },
    L: { color: 'red', name: 'L: the loss', code: ['loss', 'loss_D', 'loss_G'] },
  },

  render(p) {
    p.prose(`
This chapter covers the last lecture of the 2016 course, which pointed in two directions at once.

The first is **time**. A video is a stack of images, and everything you know about ConvNets carries over once you decide *where* the network should combine information from different moments.

The second is learning **without labels**. Every network so far needed a human to say "this is a cat" thousands of times. Unlabeled images and videos are nearly free, so a long-standing goal is to learn useful structure from them alone. You will meet three ideas: **autoencoders** (compress, then rebuild), **variational autoencoders** (the same, but with a code you can sample from to *generate* new data) and **generative adversarial networks** (a generator and a critic that train each other).`);

    p.h2('Video: ConvNets over time', 'video');
    p.prose(`
A color video clip is a 4-D array: $T$ frames, each $3 \\times H \\times W$. The classic task is **action recognition**: given a clip, say what is happening ("juggling", "long jump"). Common benchmarks in 2016 were UCF-101 (about 13,000 clips of 101 actions) and Sports-1M (Karpathy et al., 2014: a million YouTube videos of 487 sports).

Before ConvNets, the best systems used hand-designed motion features, such as **dense trajectories** (Wang et al., 2011 and 2013): track many points through the video and describe the appearance and motion around each track. The ConvNet question is the familiar one: can we learn such features instead? The new design question is *where* in the network to mix information from different frames.

Karpathy et al. (2014) compared four answers:`);

    p.figure({
      title: 'Where to fuse time',
      codeTitle: 'fusion.py',
      code: `
        clip = video[t : t + 10]     # (10, 3, H, W)
        # single frame: an ordinary 2-D ConvNet
        s = cnn(video[t + 5])                       #@single
        # late fusion: two frames 15 apart
        f1 = tower(video[t])        # same weights  #@late
        f2 = tower(video[t + 15])                   #@late
        s = fc(np.concatenate([f1, f2]))            #@late
        # early fusion: 10 frames as 30 channels
        h = clip.reshape(30, H, W)                  #@early
        s = cnn(h)   # conv1 filters: 11 x 11 x 30  #@early
        # slow fusion: 3-D convs merge time gradually
        h = conv3d(clip, t=4, stride_t=2)  # 10 -> 4  #@slow
        h = conv3d(h, t=2, stride_t=2)     # 4 -> 2   #@slow
        h = conv3d(h, t=2, stride_t=2)     # 2 -> 1   #@slow
        s = fc(h)                                    #@slow
      `,
      setup(f) {
        let kind = 'single';
        const cv = f.canvas(640, 300, (c, w, h) => {
          const spec = FUSION[kind]!;
          const left = 46;
          const cw = (w - left - 6) / 16;
          const fy = h - cw * 0.9 - 22;
          const rowY = (r: number) => fy - 18 - (r + 1) * ((fy - 26) / 4.3);
          const rowH = Math.min(26, (fy - 26) / 4.3 - 10);
          const xOf = (frame: number) => left + frame * cw + cw / 2;
          const used = new Set(spec.frames);
          for (let t = 0; t < 16; t++) {
            const x0 = left + t * cw + 2;
            const sz = cw - 4;
            c.fillStyle = used.has(t) ? withAlpha(color('orange'), 0.3) : withAlpha(color('--ink'), 0.05);
            c.strokeStyle = used.has(t) ? color('orange') : withAlpha(color('--ink'), 0.2);
            c.lineWidth = used.has(t) ? 1.6 : 1;
            c.beginPath();
            c.roundRect(x0, fy, sz, sz * 0.75, 3);
            c.fill();
            c.stroke();
            c.fillStyle = used.has(t) ? color('--ink') : withAlpha(color('--ink'), 0.3);
            c.beginPath();
            c.arc(x0 + sz * (0.15 + 0.7 * (t / 15)), fy + sz * 0.4, Math.max(1.5, sz * 0.09), 0, Math.PI * 2);
            c.fill();
          }
          c.fillStyle = color('--ink-3');
          c.font = font(11);
          c.textAlign = 'left';
          c.textBaseline = 'alphabetic';
          c.fillText('frames (time →)', left, h - 6);
          const names = ['conv1', 'conv2', 'conv3', 'fc'];
          let below: Span[] = spec.frames.map((t) => [t, t]);
          spec.rows.forEach((row, r) => {
            const y = rowY(r);
            c.fillStyle = color('--ink-2');
            c.font = font(11, 500, true);
            c.textAlign = 'left';
            c.textBaseline = 'middle';
            c.fillText(names[r]!, 2, y + rowH / 2);
            const overlap = row.some((sp, q) => q > 0 && sp[0] <= row[q - 1]![1]);
            row.forEach(([a, b], q) => {
              const x0 = left + a * cw + 3, x1 = left + (b + 1) * cw - 3;
              const bh = overlap ? rowH * 0.46 : rowH;
              const by = overlap && q % 2 ? y + rowH * 0.54 : y;
              c.strokeStyle = withAlpha(color('teal'), 0.5);
              c.lineWidth = 1;
              for (const [ba, bb] of below) {
                if (ba >= a && bb <= b) {
                  c.beginPath();
                  c.moveTo((xOf(ba) + xOf(bb)) / 2, by + bh);
                  c.lineTo((xOf(ba) + xOf(bb)) / 2, r === 0 ? fy : rowY(r - 1));
                  c.stroke();
                }
              }
              const col = r === 3 ? color('purple') : color('teal');
              c.fillStyle = withAlpha(col, 0.22);
              c.strokeStyle = col;
              c.lineWidth = 1.6;
              c.beginPath();
              c.roundRect(x0, by, x1 - x0, bh, 5);
              c.fill();
              c.stroke();
              if (!overlap && x1 - x0 > 40) {
                c.fillStyle = color('--ink-2');
                c.font = font(11, 500);
                c.textAlign = 'center';
                c.fillText(`${b - a + 1} frame${b > a ? 's' : ''}`, (x0 + x1) / 2, y + rowH / 2 + 1);
              }
            });
            below = row;
          });
        });
        cv.canvas.classList.add('scroll-ok');
        const ro = f.readout('the fc layer sees');
        f.segmented({
          options: [
            { value: 'single', label: 'single frame' },
            { value: 'late', label: 'late' },
            { value: 'early', label: 'early' },
            { value: 'slow', label: 'slow' },
          ],
          value: 'single',
          onChange: (v) => {
            kind = v;
            f.code.highlight(v);
            ro.set(FUSION[v]!.note);
            cv.redraw();
          },
        });
        f.code.highlight('single');
        ro.set(FUSION.single!.note);
      },
      caption: `Each block is a layer's units, drawn as wide as the stretch of time they can see; lines show which units feed which. **Single frame** never mixes time at all. **Late fusion** runs the same 2-D ConvNet on two frames 15 apart and only compares them at the fully-connected layer. **Early fusion** stacks 10 frames as 30 input channels, so the very first filters see all of them, but only once. **Slow fusion** uses 3-D convolutions that each look at a few neighboring moments and merge them gradually, the way spatial convolutions grow receptive fields. These are the architectures of Karpathy et al. (2014), with their temporal extents and strides.`,
    });

    p.prose(`
The result was humbling: on Sports-1M the single-frame network was already strong, and slow fusion won by only a point or two. Much of a sport can be recognized from one frame (a pool, a ring, a pitch). Still, mixing time gradually was the best of the options, and it uses a building block worth knowing in detail.

### 3-D convolution

A 2-D convolution slides a small filter over rows and columns. A **3-D convolution** also slides it along time: the filter is a little block, say 3 frames deep, 3 rows tall and 3 columns wide, and each output value is the sum of the filter times the block of video under it.`);
    p.math({
      label: '3-D convolution (one channel in, one out)',
      tex: String.raw`y_{k,i,j} = \sum_{\tau, a, b} w_{\tau,a,b}\; \sym{x}{x_{k+\tau,\, i+a,\, j+b}}`,
      code: `
        def conv3d(x, w):        # x: (T, H, W), w: (t, 3, 3)
            t = w.shape[0]
            T, H, W = x.shape
            y = np.zeros((T - t + 1, H - 2, W - 2))
            for k in range(T - t + 1):        # time
                for i in range(H - 2):        # rows
                    for j in range(W - 2):    # cols
                        block = x[k:k+t, i:i+3, j:j+3]
                        y[k, i, j] = np.sum(w * block)
            return y
      `,
      terms: [
        [String.raw`\sym{x}{x_{k,i,j}}`, 'the video: frame $k$, row $i$, column $j$ (code: `x[k, i, j]`)'],
        [String.raw`w_{\tau,a,b}`, 'the filter: $t$ frames deep and 3 by 3 in space; its weights are learned'],
        [String.raw`\sum_{\tau, a, b}`, 'add up over every position inside the little filter block: $\\tau$ from 0 to $t - 1$ in time, $a$ and $b$ from 0 to 2 in space'],
        [String.raw`y_{k,i,j}`, 'one output value; with a "valid" convolution there are $T - t + 1$ output frames'],
      ],
      explain: 'It is the 2-D convolution of Chapter 11 with one more loop. Real layers also sum over input channels and have many filters, exactly as in 2-D. Because the filter now spans several frames, it can respond to *change over time*: weights of $-1$ on one frame and $+1$ on the next measure how much each pixel brightened, which is a simple motion detector.',
    });

    p.figure({
      title: 'A 3-D filter sliding through time',
      codeTitle: 'conv3d_demo.py',
      code: `
        x = video          # (8, 10, 10): time, rows, cols
        t = {{t:2}}        # filter depth in time
        wt = np.array([{{wt:-1, 1}}])        # weights over time
        w = wt[:, None, None] * np.ones((3, 3)) / 9
        T_out = 8 - t + 1  # {{To:7}} output frames
        out = np.zeros((T_out, 8, 8))
        for k in range(T_out):                      #@time
            for i in range(8):
                for j in range(8):
                    patch = x[k:k+t, i:i+3, j:j+3]  #@sum
                    out[k, i, j] = np.sum(w * patch)  #@sum
        # out[{{k:0}}] reads frames {{f0:0}} to {{f1:1}}
      `,
      setup(f) {
        const T = 8, S = 10;
        let t = 2;
        let kind: 'avg' | 'diff' = 'diff';
        let sel = 0;
        const video: number[][] = [];
        for (let k = 0; k < T; k++) {
          const fr = new Array(S * S).fill(0.08);
          for (let i = 3; i < 6; i++) for (let j = 1 + k; j < 4 + k && j < S; j++) fr[i * S + j] = 1;
          video.push(fr);
        }
        const weights = () => {
          if (kind === 'avg') return new Array(t).fill(1 / t);
          if (t === 1) return [1];
          if (t === 2) return [-1, 1];
          if (t === 3) return [-1, 0, 1];
          return [-0.5, -0.5, 0.5, 0.5];
        };
        const outputs = () => {
          const wt = weights();
          const res: number[][] = [];
          for (let k = 0; k + t <= T; k++) {
            const o = new Array(64).fill(0);
            for (let i = 0; i < 8; i++)
              for (let j = 0; j < 8; j++) {
                let s = 0;
                for (let tau = 0; tau < t; tau++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s += (wt[tau]! / 9) * video[k + tau]![(i + a) * S + j + b]!;
                o[i * 8 + j] = s;
              }
            res.push(o);
          }
          return res;
        };
        const cv = f.canvas(640, 270, (c, w, h) => {
          const gap = 6;
          const tile = Math.min((w - gap * (T - 1)) / T, (h - 76) / 2);
          const left = (w - tile * T - gap * (T - 1)) / 2;
          const y0 = 18, y1 = y0 + tile + 22;
          const px = tile / S;
          c.font = font(11);
          c.fillStyle = color('--ink-3');
          c.textAlign = 'left';
          c.textBaseline = 'alphabetic';
          c.fillText('input frames', left, y0 - 5);
          c.fillText(kind === 'diff' ? 'output (orange = got brighter, blue = got darker)' : 'output (average over time)', left, y1 + tile + 15);
          const ink = color('--ink');
          const orange = color('orange'), blue = color('blue');
          for (let k = 0; k < T; k++) {
            const x0 = left + k * (tile + gap);
            const on = k >= sel && k < sel + t;
            for (let q = 0; q < S * S; q++) {
              c.fillStyle = withAlpha(ink, 0.06 + 0.8 * video[k]![q]!);
              c.fillRect(x0 + (q % S) * px, y0 + Math.floor(q / S) * px, px + 0.3, px + 0.3);
            }
            c.strokeStyle = on ? color('orange') : withAlpha(ink, 0.2);
            c.lineWidth = on ? 2.5 : 1;
            c.strokeRect(x0, y0, tile, tile);
          }
          const outs = outputs();
          const opx = tile / 8;
          outs.forEach((o, k) => {
            const x0 = left + k * (tile + gap);
            for (let q = 0; q < 64; q++) {
              const v = o[q]!;
              c.fillStyle = kind === 'diff' ? withAlpha(v >= 0 ? orange : blue, Math.min(1, Math.abs(v) * 2.2)) : withAlpha(ink, 0.06 + 0.8 * v);
              c.fillRect(x0 + (q % 8) * opx, y1 + Math.floor(q / 8) * opx, opx + 0.3, opx + 0.3);
            }
            c.strokeStyle = k === sel ? color('purple') : withAlpha(ink, 0.2);
            c.lineWidth = k === sel ? 2.5 : 1;
            c.strokeRect(x0, y1, tile, tile);
          });
          const sx = left + sel * (tile + gap);
          c.strokeStyle = color('purple');
          c.lineWidth = 1.5;
          c.setLineDash([4, 3]);
          c.beginPath();
          c.moveTo(sx + tile / 2, y1);
          c.lineTo(sx + tile / 2, y0 + tile + 3);
          c.moveTo(sx + tile / 2, y0 + tile + 3);
          c.lineTo(left + (sel + t - 1) * (tile + gap) + tile / 2, y0 + tile + 3);
          c.stroke();
          c.setLineDash([]);
        });
        cv.canvas.classList.add('scroll-ok');
        const sync = () => {
          f.code.setMany({ t, wt: weights().map((v) => fmt(v, 2)).join(', '), To: T - t + 1, k: sel, f0: sel, f1: sel + t - 1 });
          cv.redraw();
        };
        const st = f.stepper({
          steps: T - t + 1,
          interval: 700,
          label: (k) => `output frame ${k}`,
          onStep: (k) => {
            sel = k;
            f.code.highlight(['time', 'sum']);
            sync();
          },
        });
        f.slider({
          label: 'filter depth t',
          min: 1,
          max: 4,
          step: 1,
          value: 2,
          onInput: (v) => {
            t = v;
            st.setSteps(T - t + 1);
            sync();
          },
        });
        f.segmented({
          label: 'filter',
          options: [
            { value: 'diff', label: 'change detector' },
            { value: 'avg', label: 'average' },
          ],
          value: 'diff',
          onChange: (v) => {
            kind = v;
            sync();
          },
        });
        sync();
      },
      caption: `A bright square moves one pixel to the right per frame. Each output frame is computed from $t$ consecutive input frames (outlined in orange for the selected output). With the **change detector**, the output lights up orange at the square's leading edge (pixels that just turned bright) and blue at its trailing edge: the filter sees motion. Now set the depth $t$ to 1: the filter sees a single frame, has nothing to compare, and the output is just a blurred copy of each frame. That is a 2-D convolution, blind to motion. Also notice the output has $8 - t + 1$ frames: deeper filters shorten the clip, just as wider filters shrink an image.`,
    });

    p.prose(`
3-D convolutions in vision go back to around 2010 (Taylor et al.; Ji et al.). **C3D** (Tran et al., 2015) pushed the idea all the way: a deep network, in the spirit of VGG, built entirely from 3 × 3 × 3 convolutions (and 3-D pooling), run on 16-frame clips of 112 × 112 pixels and trained on Sports-1M. Its features, fed to a simple linear classifier, worked well across many video tasks, much as ImageNet features had for images.

### Two-stream networks: give the ConvNet motion directly

Simonyan and Zisserman (2014) took another route. Instead of hoping the network learns motion from raw pixels, feed it motion: **optical flow**, which estimates for every pixel how far it moved between one frame and the next (two numbers per pixel, a horizontal and a vertical displacement, computed by a classical algorithm). Their network has two streams:

- a **spatial stream**: an ordinary ImageNet-style ConvNet on a single RGB frame (appearance);
- a **temporal stream**: a ConvNet whose input is the optical flow of 10 consecutive frames stacked as 20 channels (motion);

and the class scores of the two are averaged (or combined by an SVM) at the end.

The surprise was that the motion stream alone beat the appearance stream on UCF-101, and the two together reached about 88%, edging out the best hand-designed trajectory features. Motion is a strong cue, and at the time ConvNets were not learning it well by themselves from raw pixels.

### Long-term structure: recurrent networks on top

A 3-D ConvNet sees a few frames, and a flow stack under half a second. Many events are much longer. The fix reaches for Chapter 15: run a ConvNet on every frame (or short clip), and feed the sequence of feature vectors into an **LSTM**, which carries information across the whole video (Baccouche et al., 2011; Donahue et al., 2015; Ng et al., 2015). Ballas et al. (2016) went further with **recurrent convolutional** layers: inside a GRU, every matrix multiply becomes a convolution, so the hidden state is itself a feature map and every layer of the network can remember.`);
    p.code(`
      # ConvNet features per frame, then an LSTM over time
      feats = [cnn(frame) for frame in video]          # each (4096,)
      h, c = np.zeros(512), np.zeros(512)
      for f_t in feats:
          h, c = lstm_step(f_t, h, c)                  # Chapter 15
      scores = W_out.dot(h)                            # one label per video

      # recurrent convolution: the GRU's matrix multiplies become convolutions,
      # so the hidden state h is a (C, H, W) feature map, not a vector
      r = sigmoid(conv(x_t, W_r) + conv(h, U_r))
      u = sigmoid(conv(x_t, W_u) + conv(h, U_u))
      h_new = np.tanh(conv(x_t, W_h) + conv(r * h, U_h))
      h = (1 - u) * h + u * h_new
    `, { title: 'video_rnn.py' });
    p.table(
      ['Approach', 'How time is used', 'Example'],
      [
        ['Single frame', 'not at all; average predictions over frames', 'baseline in Karpathy et al. 2014'],
        ['Late / early / slow fusion', 'combine frames at the FC layer, the first layer, or gradually', 'Karpathy et al. 2014'],
        ['3-D convolution', 'filters span a few frames at every layer', 'C3D, Tran et al. 2015'],
        ['Two-stream', 'a second ConvNet on stacked optical flow', 'Simonyan and Zisserman 2014'],
        ['ConvNet + RNN', 'an LSTM or GRU over per-frame features, for long-range structure', 'Donahue et al. 2015; Ng et al. 2015; Ballas et al. 2016'],
      ],
      { caption: 'Ways to extend ConvNets to video, as surveyed in the 2016 lecture. In practice they were often combined.' },
    );

    p.h2('Learning without labels', 'unsupervised');
    p.prose(`
Everything in this course so far has been **supervised learning**: data $\\symx$ comes with labels $y$, and we learn a function from one to the other. Labels are the expensive part. Somebody had to look at every one of ImageNet's million training images.

**Unsupervised learning** gets only the data, no labels, and tries to find structure in it. "Structure" can mean several things:`);
    p.table(
      ['', 'Supervised', 'Unsupervised'],
      [
        ['Data', '$(\\symx, y)$ pairs', 'just $\\symx$'],
        ['Goal', 'learn a function $\\symx \\to y$', 'learn something about the data itself'],
        ['Examples', 'classification, regression, detection, captioning', 'clustering, dimensionality reduction (PCA), feature learning, density estimation, generating new samples'],
        ['Cost of data', 'labels are slow and expensive', 'raw images and videos are nearly free'],
      ],
    );
    p.prose(`
The 2016 lecture focused on two flavors: **learning features** (a compact code for each input, useful for later tasks) and **generative models** (learn the distribution of the data well enough to produce new samples from it).`);

    p.h2('Autoencoders', 'autoencoders');
    p.prose(`
An **autoencoder** is a network trained to reproduce its own input, through a bottleneck. An **encoder** squeezes the input $\\symx$ into a small code $\\symz$ (fewer numbers than the input), and a **decoder** expands the code back into a reconstruction $\\hat{\\symx}$. Since the code is too small to copy the input verbatim, the only way to rebuild it well is to capture what matters most about the data. No labels needed: the input is its own target.`);
    p.math({
      label: 'Autoencoder',
      tex: String.raw`\begin{aligned} \symz &= f_{\text{enc}}(\symx), \quad \hat{\symx} = f_{\text{dec}}(\symz) \\ \symL &= \lVert \symx - \hat{\symx} \rVert^2 \end{aligned}`,
      code: `
        z = encode(x)        # e.g. 3072 pixels -> 64
        x_hat = decode(z)    # 64 numbers -> 3072
        loss = np.sum((x - x_hat) ** 2)
      `,
      terms: [
        [String.raw`f_{\text{enc}}`, 'the encoder: for images, a ConvNet; for toy data, a small MLP or even a single matrix'],
        [String.raw`\symz`, 'the code (or *latent* vector): smaller than $x$, so it must summarize'],
        [String.raw`f_{\text{dec}}`, 'the decoder: often a mirror image of the encoder, with upsampling (transpose convolutions, Chapter 14) for images'],
        [String.raw`\lVert \symx - \hat{\symx} \rVert^2`, 'the L2 reconstruction error: squared differences, summed over every number'],
      ],
      explain: 'Push the data through a narrow pipe and ask for it back. The loss compares the output to the *input*, so any pile of unlabeled data is a training set. With a purely linear encoder and decoder and an L2 loss, the best possible code is exactly what principal component analysis (PCA) finds; nonlinear layers let the code follow curved structure that PCA cannot.',
    });

    p.figure({
      title: 'Squeezing 2-D points through a 1-number bottleneck',
      codeTitle: 'autoencoder.py',
      code: `
        X = data           # (150, 2) points, no labels

        def encode(X):     # 2 numbers -> 1
            return {{enc:X.dot(W_e) + b_e}}
        def decode(z):     # 1 number -> 2
            return {{dec:z.dot(W_d) + b_d}}

        for step in range(2000):
            z = encode(X)          # (150, 1): the codes  #@enc
            x_hat = decode(z)      # (150, 2)             #@dec
            loss = np.mean(np.sum((X - x_hat)**2, 1))     #@loss
            backprop_and_adam(loss)                       #@upd
        # step {{step:0}}, loss {{loss:…}}
      `,
      setup(f) {
        let data: 'blob' | 'arc' = 'arc';
        let linear = true;
        const N = 150;
        let X = toy2d(data, N, 3);
        let enc: TinyNet, dec: TinyNet;
        let step = 0;
        let loss = NaN;
        const build = () => {
          const r = new Rng(7);
          const rn = () => r.randn();
          enc = linear ? new TinyNet([2, 1], ['linear'], rn) : new TinyNet([2, 16, 1], ['tanh', 'linear'], rn);
          dec = linear ? new TinyNet([1, 2], ['linear'], rn) : new TinyNet([1, 16, 2], ['tanh', 'linear'], rn);
          step = 0;
          loss = NaN;
          f.code.setMany({
            enc: linear ? 'X.dot(W_e) + b_e' : 'np.tanh(X.dot(W1) + b1).dot(W2) + b2',
            dec: linear ? 'z.dot(W_d) + b_d' : 'np.tanh(z.dot(W3) + b3).dot(W4) + b4',
            step: 0,
            loss: '…',
          });
        };
        const trainStep = () => {
          const z = enc.forward(X, N);
          const xh = dec.forward(z, N);
          let l = 0;
          const d = new Float64Array(N * 2);
          for (let i = 0; i < N * 2; i++) {
            const e = xh[i]! - X[i]!;
            l += e * e;
            d[i] = (2 * e) / N;
          }
          enc.backward(dec.backward(d));
          enc.adam(0.01);
          dec.adam(0.01);
          return l / N;
        };
        const pl = f.plot({
          aspect: 1.25,
          domain: [-1.9, 1.9, -1.45, 1.45],
          draw: (pp) => {
            pp.axes({ grid: 0.5 });
            const z = enc.run(X, N);
            const xh = dec.run(z, N);
            let zmin = Infinity, zmax = -Infinity;
            for (let i = 0; i < N; i++) {
              zmin = Math.min(zmin, z[i]!);
              zmax = Math.max(zmax, z[i]!);
            }
            const pad = (zmax - zmin) * 0.08 + 1e-6;
            const M = 120;
            const zs = new Float64Array(M + 1).map((_, i) => zmin - pad + ((zmax - zmin + 2 * pad) * i) / M);
            const curve = dec.run(zs, M + 1);
            const cx: number[] = [], cy: number[] = [];
            for (let i = 0; i <= M; i++) {
              cx.push(curve[2 * i]!);
              cy.push(curve[2 * i + 1]!);
            }
            for (let i = 0; i < N; i++) pp.path([X[2 * i]!, xh[2 * i]!], [X[2 * i + 1]!, xh[2 * i + 1]!], withAlpha(color('--ink'), 0.18), 1);
            pp.path(cx, cy, color('purple'), 2.5);
            for (let i = 0; i < N; i++) pp.dot(X[2 * i]!, X[2 * i + 1]!, 3.2, withAlpha(color('orange'), 0.85));
            for (let i = 0; i < N; i++) pp.dot(xh[2 * i]!, xh[2 * i + 1]!, 2.4, color('purple'));
          },
        });
        const stepRo = f.readout('step');
        const lossRo = f.readout('loss', { sym: 'L' });
        let phase = 0;
        const loop = f.loop(() => {
          for (let k = 0; k < 8; k++) {
            loss = trainStep();
            step++;
          }
          f.code.highlight(['enc', 'dec', 'loss', 'upd'][phase++ % 4]!);
          f.code.setMany({ step, loss: fmt(loss, 3) });
          stepRo.set(step);
          lossRo.set(fmt(loss, 3));
          pl.redraw();
          if (step >= 2000) {
            stop();
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          btn.textContent = 'Train';
          f.code.highlight(null);
        };
        const btn = f.button('Train', () => {
          if (loop.running()) stop();
          else {
            if (step >= 2000) {
              build();
              pl.redraw();
            }
            loop.start();
            btn.textContent = 'Pause';
          }
        }, { primary: true });
        f.segmented({
          label: 'data',
          options: [
            { value: 'arc', label: 'arc' },
            { value: 'blob', label: 'stretched cloud' },
          ],
          value: 'arc',
          onChange: (v) => {
            data = v;
            X = toy2d(data, N, 3);
            stop();
            build();
            stepRo.set(0);
            lossRo.set('–');
            pl.redraw();
          },
        });
        f.segmented({
          label: 'model',
          options: [
            { value: 'lin', label: 'linear' },
            { value: 'mlp', label: 'nonlinear (16 hidden tanh)' },
          ],
          value: 'lin',
          onChange: (v) => {
            linear = v === 'lin';
            stop();
            build();
            stepRo.set(0);
            lossRo.set('–');
            pl.redraw();
          },
        });
        build();
      },
      caption: `Orange points are the data; each is encoded to **one** number $\\symz$ and decoded back to a purple point (gray lines join each point to its reconstruction). The purple curve is everything the decoder can produce: $f_{\\text{dec}}(\\symz)$ as $\\symz$ sweeps its range. Press **Train**. The linear autoencoder can only output a straight line, so it settles on the best line through the data (the first principal component), and on the arc most points end up far from home. Switch to the nonlinear model and train again: the curve bends to follow the arc and the loss drops by about a factor of 50. On the stretched cloud, a straight line is already the right answer.`,
    });

    p.prose(`
### What autoencoders are for

After training, the decoder is usually thrown away. The encoder is a feature extractor trained without a single label: use its code as the input to a small supervised classifier, or use its weights to **initialize** a supervised network and fine-tune it on whatever labels you have. That is most attractive when labeled data is scarce.

Around 2006 to 2010 this was how deep networks were trained at all. **Greedy layer-wise pretraining** (Hinton and Salakhutdinov, 2006, with restricted Boltzmann machines; Bengio et al., 2007, with stacked autoencoders) trained one layer at a time to reconstruct the layer below, stacked the layers, and then fine-tuned the whole thing with labels. With ReLUs, careful initialization (Chapter 8) and later batch normalization, deep networks train well from random weights, and by 2016 this pretraining had mostly fallen out of use.

A useful variant is the **denoising autoencoder** (Vincent et al., 2008): corrupt the input (add noise, drop pixels) and train the network to reconstruct the *clean* version, which forces the code to capture structure rather than memorize.

One thing a plain autoencoder cannot do well is **generate**. Its codes land wherever training happened to put them, with gaps in between; pick a random code and the decoder may produce garbage. The next model fixes that.`);

    p.h2('Variational autoencoders', 'vae');
    p.prose(`
A **variational autoencoder** (VAE; Kingma and Welling, 2014, and independently Rezende et al., 2014) turns the autoencoder into a proper generative model. The story it tells about the data is:

1. pick a code $\\symz$ at random from a simple **prior** distribution, a standard normal $\\mathcal{N}(0, I)$ (a bell curve centered at 0 with spread 1 in every direction);
2. run the decoder on $\\symz$ to get the data point.

If we can train a decoder for which this story produces realistic data, generating new data is trivial: sample $\\symz$, decode. Training needs the reverse direction too, from a data point to the codes that could have produced it, and that is the encoder's new job. Instead of one code, it outputs a whole **distribution** over codes: a mean $\\symmu$ and a spread $\\symsig$ for each code dimension.`);
    p.math({
      label: 'The encoder outputs a distribution',
      tex: String.raw`q(\symz \mid \symx) = \mathcal{N}\big(\symz;\; \symmu(\symx),\; \symsig(\symx)^2\big)`,
      code: `
        h = np.tanh(x.dot(W1) + b1)      # encoder body
        mu = h.dot(W_mu) + b_mu          # (d,) the center
        logvar = h.dot(W_lv) + b_lv      # (d,) log of sigma**2
        sigma = np.exp(0.5 * logvar)     # always positive
      `,
      terms: [
        [String.raw`q(\symz \mid \symx)`, 'read "q of z given x": which codes the encoder thinks could explain this input'],
        [String.raw`\mathcal{N}(\symz;\, \symmu, \symsig^2)`, 'a normal (Gaussian, bell-shaped) distribution over $\\symz$, centered at $\\symmu$ with spread $\\symsig$'],
        [String.raw`\symmu(\symx), \symsig(\symx)`, 'both computed by the encoder network from the input'],
      ],
      explain: 'Instead of "this image has code 0.7", the encoder says "this image has a code around 0.7, give or take 0.1". The network predicts $\\log \\sigma^2$ rather than $\\sigma$ itself because a network output can be any number, positive or negative, while a spread must be positive; exponentiating guarantees that.',
    });

    p.prose(`
Training then samples a code from this distribution and asks the decoder to reconstruct the input from it. That raises a problem: sampling is random, and you cannot backpropagate through a coin flip. The **reparameterization trick** moves the randomness out of the way.`);
    p.math({
      label: 'The reparameterization trick',
      tex: String.raw`\symz = \symmu + \symsig \odot \symeps, \qquad \symeps \sim \mathcal{N}(0, I)`,
      code: `
        eps = np.random.randn(*mu.shape)  # parameter-free
        z = mu + sigma * eps              # a sample of q
        # dz/dmu = 1 and dz/dsigma = eps: ordinary gradients
      `,
      terms: [
        [String.raw`\symeps \sim \mathcal{N}(0, I)`, 'draw plain noise from a standard bell curve ("$\\sim$" means "is sampled from")'],
        [String.raw`\symsig \odot \symeps`, 'stretch the noise by $\\sigma$ (the circle-dot means element by element)'],
        [String.raw`\symmu + \cdots`, 'then shift it to be centered at $\\mu$'],
      ],
      explain: 'Shifting and stretching standard noise gives exactly a sample from $\\mathcal{N}(\\mu, \\sigma^2)$. The difference is bookkeeping, and it is everything: the random part, $\\epsilon$, no longer depends on any parameter, while $z$ is now a simple, differentiable function of $\\mu$ and $\\sigma$. Backpropagation flows from the decoder, through $z$, into $\\mu$ and $\\sigma$, and on into the encoder.',
    });

    p.figure({
      title: 'Reparameterization and the KL penalty',
      codeTitle: 'reparam.py',
      code: `
        mu, sigma = {{mu:1.2}}, {{sigma:0.6}}  # from the encoder
        eps = np.random.randn(12)     # fixed noise        #@eps
        z = mu + sigma * eps          # 12 samples of q    #@z
        kl = mu**2 + sigma**2 - 1 - np.log(sigma**2)  #@kl
        kl = 0.5 * kl                 # {{kl}}             #@kl
        # dz/dmu = 1, dz/dsigma = eps: the samples move
        # smoothly with mu and sigma, so gradients flow
      `,
      setup(f) {
        let mu = 1.2, sigma = 0.6;
        let seed = 5;
        let eps: number[] = [];
        const resample = () => {
          const r = new Rng(seed++);
          eps = Array.from({ length: 12 }, () => r.randn());
        };
        resample();
        const kl = () => 0.5 * (mu * mu + sigma * sigma - 1 - Math.log(sigma * sigma));
        const pl = f.plot({
          aspect: 1.5,
          square: false,
          domain: [-4, 4, -0.62, 1.45],
          draw: (pp) => {
            pp.axes({ grid: 1 });
            const [x0, x1] = pp.view();
            const xs: number[] = [], qs: number[] = [];
            for (let i = 0; i <= 200; i++) {
              const x = x0 + ((x1 - x0) * i) / 200;
              xs.push(x);
              qs.push(Math.min(1.42, gauss(x, mu, sigma)));
            }
            pp.ctx.fillStyle = withAlpha(color('teal'), 0.22);
            pp.ctx.beginPath();
            pp.ctx.moveTo(pp.sx(xs[0]!), pp.sy(0));
            xs.forEach((x, i) => pp.ctx.lineTo(pp.sx(x), pp.sy(qs[i]!)));
            pp.ctx.lineTo(pp.sx(xs[xs.length - 1]!), pp.sy(0));
            pp.ctx.fill();
            pp.path(xs, qs, color('teal'), 2.2);
            pp.fn((x) => gauss(x, 0, 1), withAlpha(color('--ink'), 0.55), 1.8, [6, 4]);
            const zy = -0.2, ey = -0.48;
            pp.path([x0, x1], [zy, zy], withAlpha(color('--ink'), 0.25), 1);
            pp.path([x0, x1], [ey, ey], withAlpha(color('--ink'), 0.25), 1);
            pp.text('z', x0 + 0.08, zy + 0.05, { size: 12, bold: true, color: color('purple') });
            pp.text('ε', x0 + 0.08, ey + 0.05, { size: 12, bold: true, color: color('slate') });
            eps.forEach((e) => {
              const z = mu + sigma * e;
              pp.path([e, z], [ey, zy], withAlpha(color('slate'), 0.35), 1);
              pp.dot(e, ey, 3.5, color('slate'));
              pp.dot(z, zy, 4, color('purple'));
            });
            pp.text('prior N(0, 1)', -3.85, 1.3, { size: 11, color: color('--ink-2') });
            pp.text('q(z | x) = N(μ, σ²)', -3.85, 1.15, { size: 11, color: color('teal') });
          },
        });
        const klRo = f.readout('KL', { sym: 'L' });
        const sync = () => {
          f.code.set('kl', fmt(kl(), 3));
          klRo.set(fmt(kl(), 3));
          pl.redraw();
        };
        f.slider({
          label: 'μ',
          sym: 'mu',
          min: -3,
          max: 3,
          step: 0.05,
          value: 1.2,
          slot: 'mu',
          format: (v) => v.toFixed(2),
          onInput: (v) => {
            mu = v;
            f.code.highlight(['z', 'kl']);
            sync();
          },
        });
        f.slider({
          label: 'σ',
          sym: 'sig',
          min: 0.3,
          max: 2,
          step: 0.02,
          value: 0.6,
          slot: 'sigma',
          format: (v) => v.toFixed(2),
          onInput: (v) => {
            sigma = v;
            f.code.highlight(['z', 'kl']);
            sync();
          },
        });
        f.button('New ε', () => {
          resample();
          f.code.highlight('eps');
          sync();
        });
        sync();
      },
      caption: `The bottom row holds 12 draws of plain noise $\\symeps$ (gray); each line maps one of them to a sample $\\symz = \\symmu + \\symsig\\symeps$ (purple). The teal bell is the encoder's distribution $q(\\symz \\mid \\symx)$, the dashed one the prior. Drag $\\symmu$ and watch every sample slide along with it; drag $\\symsig$ and they spread or bunch together around $\\symmu$. The noise never changes, so each sample is a smooth function of $\\symmu$ and $\\symsig$: that is what lets gradients through. The KL readout is the penalty explained next. It is 0 only when $\\symmu = 0$ and $\\symsig = 1$, where the two bells coincide.`,
    });

    p.prose(`
The second ingredient keeps the codes organized. Left alone, the encoder would shrink every $\\symsig$ toward 0 (making the codes exact, like a plain autoencoder) and scatter the $\\symmu$'s wherever is convenient, and sampling from the prior would land in empty territory again. So the loss also penalizes each $q(\\symz \\mid \\symx)$ for differing from the prior, using the **Kullback-Leibler (KL) divergence**.

KL divergence measures how different one probability distribution is from another. It is never negative, and it is zero only when the two are identical. (It is not a true distance: it is not symmetric.) For two normal distributions it has a short closed form:`);
    p.math({
      label: 'KL divergence of the encoder\'s Gaussian from the prior',
      tex: String.raw`\begin{aligned} &D_{\mathrm{KL}}\big(\mathcal{N}(\symmu, \symsig^2) \,\big\Vert\, \mathcal{N}(0, 1)\big) \\ &\quad = \tfrac{1}{2}\sum_{j}\big(\symmu_j^2 + \symsig_j^2 - 1 - \log \symsig_j^2\big) \end{aligned}`,
      code: `
        def kl_to_prior(mu, logvar):
            # summed over the code dimensions
            kl = mu**2 + np.exp(logvar) - 1 - logvar
            return 0.5 * np.sum(kl)
      `,
      terms: [
        [String.raw`\symmu_j^2`, 'a cost for centering code $j$ away from 0'],
        [String.raw`\symsig_j^2 - 1 - \log\symsig_j^2`, 'a cost for a spread other than 1: it is 0 at $\\sigma = 1$ and grows both when $\\sigma$ shrinks (the $-\\log$ blows up) and when it grows'],
        [String.raw`\sum_j`, 'add up over every dimension of the code'],
      ],
      explain: 'This is the penalty in the figure above. It pulls every input\'s code distribution toward the standard bell curve: centers near 0, spreads near 1. Codes for different inputs therefore overlap and fill the region the prior samples from, with no empty gaps, and a random $z \\sim \\mathcal{N}(0, I)$ decodes to something sensible.',
    });

    p.prose(`
Putting it together: the VAE maximizes a lower bound on the log-probability of the data, called the **evidence lower bound** (ELBO). Deriving it takes a page of algebra with probabilities; the result is easy to read.`);
    p.math({
      label: 'The VAE objective',
      tex: String.raw`\begin{aligned} \log p(\symx) \;\ge\; &\underbrace{\mathbb{E}_{\symz \sim q(\symz \mid \symx)}\big[\log p(\symx \mid \symz)\big]}_{\text{reconstruct well}} \\ &- \underbrace{D_{\mathrm{KL}}\big(q(\symz \mid \symx) \,\Vert\, p(\symz)\big)}_{\text{stay near the prior}} \end{aligned}`,
      code: `
        mu, logvar = encoder(x)
        eps = np.random.randn(*mu.shape)
        z = mu + np.exp(0.5 * logvar) * eps
        x_hat = decoder(z)
        # -log p(x|z) for a Gaussian decoder, up to a constant
        rec = np.sum((x - x_hat)**2) / (2 * noise_var)
        loss = rec + kl_to_prior(mu, logvar)    # minimize
      `,
      terms: [
        [String.raw`\log p(\symx)`, 'how probable the model finds a real data point: what we would like to maximize but cannot compute directly'],
        [String.raw`\ge`, 'the right side is a *lower bound*: pushing it up pushes $\\log p(x)$ up too'],
        [String.raw`\mathbb{E}_{\symz \sim q}[\cdot]`, '"expected value": the average over random codes drawn from the encoder\'s distribution. In practice, one sample per step'],
        [String.raw`\log p(\symx \mid \symz)`, 'how well the decoder rebuilds $x$ from $z$. If the decoder\'s output is a Gaussian around $\\hat{x}$, this is minus a scaled L2 error'],
        [String.raw`D_{\mathrm{KL}}(\ldots)`, 'the KL penalty from above'],
      ],
      explain: 'Flip the sign to get a loss to minimize: **reconstruction error plus KL penalty**. The first term wants codes precise enough to rebuild each input; the second wants all codes to look like samples from $\\mathcal{N}(0, I)$. The balance between them (set by the assumed noise variance in the reconstruction term) decides how sharp versus how well-organized the model is.',
    });

    p.figure({
      title: 'A tiny VAE, trained live, then sampled',
      codeTitle: 'vae.py',
      code: `
        for step in range(3000):
            x = X[np.random.choice(300, 64)]     # (64, 2)
            mu, logvar = encoder(x)     # (64, 1) each   #@enc
            sigma = np.exp(0.5 * logvar)                  #@enc
            eps = np.random.randn(64, 1)                  #@z
            z = mu + sigma * eps                          #@z
            x_hat = decoder(z)          # (64, 2)        #@dec
            rec = 50 * np.sum((x - x_hat)**2) / 64        #@loss
            kl = mu**2 + sigma**2 - 1 - logvar            #@loss
            kl = 0.5 * np.sum(kl) / 64                    #@loss
            backprop_and_adam(rec + kl)                   #@upd
        # step {{step:0}}  rec {{rec:…}}  kl {{kl:…}}

        # generate: decode random codes from the prior
        x_new = decoder(np.random.randn(200, 1))         #@gen
      `,
      setup(f) {
        const N = 300;
        const r0 = new Rng(21);
        const X = new Float64Array(N * 2);
        for (let i = 0; i < N; i++) {
          const t = (0.35 + 1.3 * r0.next()) * Math.PI;
          X[2 * i] = Math.cos(t) + 0.04 * r0.randn();
          X[2 * i + 1] = 0.8 * Math.sin(t) + 0.04 * r0.randn();
        }
        let enc: TinyNet, dec: TinyNet;
        let rng = new Rng(1);
        let step = 0;
        let ema = { rec: NaN, kl: NaN };
        const gr = new Rng(77);
        const gen = new Float64Array(200).map(() => gr.randn());
        let showGen = true;
        const build = (seed: number) => {
          const r = new Rng(seed);
          const rn = () => r.randn();
          enc = new TinyNet([2, 32, 2], ['tanh', 'linear'], rn);
          dec = new TinyNet([1, 32, 32, 2], ['tanh', 'tanh', 'linear'], rn);
          rng = new Rng(seed + 1);
          step = 0;
          ema = { rec: NaN, kl: NaN };
        };
        const trainStep = () => {
          const B = 64;
          const xb = new Float64Array(B * 2);
          for (let i = 0; i < B; i++) {
            const k = rng.int(N);
            xb[2 * i] = X[2 * k]!;
            xb[2 * i + 1] = X[2 * k + 1]!;
          }
          const h = enc.forward(xb, B);
          const eps = new Float64Array(B).map(() => rng.randn());
          const z = new Float64Array(B);
          for (let i = 0; i < B; i++) z[i] = h[2 * i]! + Math.exp(0.5 * h[2 * i + 1]!) * eps[i]!;
          const xh = dec.forward(z, B);
          let rec = 0, kl = 0;
          const dxh = new Float64Array(B * 2);
          for (let i = 0; i < B * 2; i++) {
            const d = xh[i]! - xb[i]!;
            rec += 50 * d * d;
            dxh[i] = (100 * d) / B;
          }
          const dz = dec.backward(dxh);
          const dh = new Float64Array(B * 2);
          for (let i = 0; i < B; i++) {
            const m = h[2 * i]!, lv = h[2 * i + 1]!;
            kl += 0.5 * (m * m + Math.exp(lv) - 1 - lv);
            dh[2 * i] = dz[i]! + m / B;
            dh[2 * i + 1] = dz[i]! * 0.5 * Math.exp(0.5 * lv) * eps[i]! + (0.5 * (Math.exp(lv) - 1)) / B;
          }
          enc.backward(dh);
          enc.adam(3e-3);
          dec.adam(3e-3);
          return { rec: rec / B, kl: kl / B };
        };
        const pl = f.plot({
          aspect: 1.3,
          domain: [-1.6, 1.6, -1.25, 1.25],
          draw: (pp) => {
            pp.axes({ grid: 0.5 });
            for (let i = 0; i < N; i++) pp.dot(X[2 * i]!, X[2 * i + 1]!, 2.6, withAlpha(color('orange'), 0.55));
            const M = 160;
            const zs = new Float64Array(M + 1).map((_, i) => -2.6 + (5.2 * i) / M);
            const cur = dec.run(zs, M + 1);
            const purple = color('purple');
            for (let i = 0; i < M; i++) {
              const a = Math.exp(-0.5 * zs[i]! * zs[i]!);
              pp.path([cur[2 * i]!, cur[2 * i + 2]!], [cur[2 * i + 1]!, cur[2 * i + 3]!], withAlpha(purple, 0.25 + 0.75 * a), 2.5);
            }
            if (showGen) {
              const g = dec.run(gen, 200);
              for (let i = 0; i < 200; i++) pp.dot(g[2 * i]!, g[2 * i + 1]!, 2.6, color('blue'));
            }
          },
        });
        const stepRo = f.readout('step');
        const recRo = f.readout('reconstruction');
        const klRo = f.readout('KL');
        let phase = 0;
        const loop = f.loop(() => {
          for (let k = 0; k < 6; k++) {
            const r = trainStep();
            ema = step === 0 ? r : { rec: 0.95 * ema.rec + 0.05 * r.rec, kl: 0.95 * ema.kl + 0.05 * r.kl };
            step++;
          }
          f.code.highlight(['enc', 'z', 'dec', 'loss', 'upd'][phase++ % 5]!);
          f.code.setMany({ step, rec: fmt(ema.rec, 3), kl: fmt(ema.kl, 3) });
          stepRo.set(step);
          recRo.set(fmt(ema.rec, 3));
          klRo.set(fmt(ema.kl, 3));
          pl.redraw();
          if (step >= 3000) {
            stop();
            f.code.highlight('gen');
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          btn.textContent = 'Train';
          f.code.highlight(null);
        };
        const btn = f.button('Train', () => {
          if (loop.running()) stop();
          else {
            if (step >= 3000) {
              build(Math.floor(Math.random() * 1e6));
              pl.redraw();
            }
            loop.start();
            btn.textContent = 'Pause';
          }
        }, { primary: true });
        f.button('Reset', () => {
          stop();
          build(Math.floor(Math.random() * 1e6));
          f.code.setMany({ step: 0, rec: '…', kl: '…' });
          stepRo.set(0);
          recRo.set('–');
          klRo.set('–');
          pl.redraw();
        });
        f.toggle({
          label: 'show 200 generated samples',
          value: true,
          onChange: (v) => {
            showGen = v;
            f.code.highlight(v ? 'gen' : null);
            pl.redraw();
          },
        });
        build(3);
      },
      caption: `Orange: 300 training points on an arc. The code $\\symz$ is a single number. The purple curve is the decoder's output as $\\symz$ runs from $-2.6$ to $2.6$, drawn darker where the prior puts more probability. Blue: 200 brand-new points made by sampling $\\symz \\sim \\mathcal{N}(0, 1)$ and decoding, which is how a VAE generates. Press **Train**. Within a couple of thousand steps the curve lies along the arc and the blue samples cover it from end to end, because the KL term made the codes fill the prior. The samples hug the middle of the arc rather than reproducing its spread: a small-scale version of why VAE images tend to look blurry.`,
    });

    p.prose(`
On real images, VAEs of 2014 to 2016 produced recognizable but blurry samples (digits, faces), and their latent spaces were smooth: walking in a straight line through $\\symz$ morphs one face into another, changing pose or expression gradually. Blurriness is the price of the L2-style reconstruction term, which rewards hedging between plausible answers by averaging them.`);

    p.h2('Generative adversarial networks', 'gan');
    p.prose(`
**Generative adversarial networks** (GANs; Goodfellow et al., 2014) skip probabilities altogether. Two networks play a game:

- a **generator** $\\symG$ turns random noise $\\symz$ into a sample $\\symG(\\symz)$, trying to make it look real;
- a **discriminator** $\\symD$ looks at a sample and outputs the probability $\\symD(\\symx)$ that it is real rather than generated.

$\\symD$ is trained as an ordinary binary classifier: real samples are labeled 1, generated ones 0. $\\symG$ is trained to make $\\symD$ wrong. Neither network ever needs a formula for the data's probability; $\\symG$ learns only from how $\\symD$ reacts to its output, by backpropagating *through* $\\symD$.`);
    p.math({
      label: 'The GAN minimax game',
      tex: String.raw`\begin{aligned} &\min_{\symG}\,\max_{\symD}\; V(\symD, \symG) \\ V &= \mathbb{E}_{\symx \sim p_{\text{data}}}\big[\log \symD(\symx)\big] \\ &\quad + \mathbb{E}_{\symz \sim p(\symz)}\big[\log\big(1 - \symD(\symG(\symz))\big)\big] \end{aligned}`,
      code: `
        x_real = sample_data(64)
        x_fake = G(np.random.randn(64, d))
        value = (np.mean(np.log(D(x_real)))
                 + np.mean(np.log(1 - D(x_fake))))
        # D takes steps to make value larger,
        # G takes steps to make it smaller
      `,
      terms: [
        [String.raw`\symD(\symx)`, 'the discriminator\'s probability that $x$ is real (a number between 0 and 1, from a sigmoid)'],
        [String.raw`\mathbb{E}_{\symx \sim p_{\text{data}}}[\log \symD(\symx)]`, 'average over real data of $\\log D$: high when $D$ confidently calls real data real'],
        [String.raw`\log(1 - \symD(\symG(\symz)))`, 'high when $D$ confidently calls the fakes fake'],
        [String.raw`V(\symD, \symG)`, 'the "value" of the game: one number that depends on both networks\' weights'],
        [String.raw`\max_{\symD}`, '$D$ adjusts its weights to make $V$ as large as possible: be a good critic'],
        [String.raw`\min_{\symG}`, '$G$ adjusts its weights to make $V$ as small as possible: fool the critic. $G$ only affects the second term'],
      ],
      explain: 'For $D$, this is exactly the (negated) binary cross-entropy loss for "real versus fake", so maximizing it is ordinary classifier training. For $G$, it is the same number with the opposite goal. If both networks were infinitely flexible, the game would end with $G$ producing exactly the data distribution and $D$ answering $\\tfrac{1}{2}$ everywhere, unable to tell the difference.',
    });
    p.prose(`
Training alternates: a step (or $k$ steps) of gradient ascent on $\\symD$ with $\\symG$ frozen, then a step of descent on $\\symG$ with $\\symD$ frozen. One practical change matters a lot. Early in training, $\\symG$'s samples are obviously fake, $\\symD$ rejects them with confidence, and $\\log(1 - \\symD(\\symG(\\symz)))$ is nearly flat there: $\\symG$ gets almost no gradient. So instead of minimizing $\\log(1 - \\symD(\\symG(\\symz)))$, the generator **maximizes $\\log \\symD(\\symG(\\symz))$**. Same goal (fool $\\symD$), same end point, but strong gradients exactly when $\\symG$ is bad.`);

    p.figure({
      title: 'Why the generator maximizes log D(G(z))',
      codeTitle: 'generator_loss.py',
      code: `
        d = {{d:0.05}}                # D(G(z)) for one fake
        # minimax: G minimizes log(1 - d)
        loss_mm = np.log(1 - d)       # {{lmm}}         #@mm
        grad_mm = -1 / (1 - d)        # {{gmm}}         #@mm
        # non-saturating: G minimizes -log(d)
        loss_ns = -np.log(d)          # {{lns}}         #@ns
        grad_ns = -1 / d              # {{gns}}         #@ns
      `,
      setup(f) {
        let d = 0.05;
        const pl = f.plot({
          aspect: 1.5,
          square: false,
          domain: [-0.04, 1.02, -3.4, 3.4],
          draw: (pp) => {
            pp.axes({ grid: 0.25 });
            pp.fn((x) => (x > 0.003 && x < 0.997 ? Math.log(1 - x) : NaN), color('slate'), 2.5);
            pp.fn((x) => (x > 0.03 && x < 0.999 ? -Math.log(x) : NaN), color('blue'), 2.5);
            const tangent = (y0: number, slope: number, col: string) => {
              const dx = 0.12;
              pp.path([d - dx, d + dx], [y0 - slope * dx, y0 + slope * dx], col, 1.5, [5, 3]);
              pp.dot(d, y0, 5, col);
            };
            tangent(Math.log(1 - d), -1 / (1 - d), color('slate'));
            if (d > 0.03) tangent(-Math.log(d), -1 / d, color('blue'));
            pp.text('log(1 − D(G(z)))', 0.06, -2.3, { size: 12, color: color('slate') });
            pp.text('−log D(G(z))', 0.16, 2.6, { size: 12, color: color('blue') });
            pp.text('D(G(z)) →', 0.9, -0.95, { align: 'right', size: 11, color: color('--ink-3') });
            for (const v of [0.5, 1]) pp.text(String(v), v, -0.45, { align: 'center', size: 11, mono: true, color: color('--ink-3') });
          },
        });
        const gmm = f.readout('minimax slope');
        const gns = f.readout('non-saturating slope');
        const sync = () => {
          f.code.setMany({ lmm: fmt(Math.log(1 - d), 3), gmm: fmt(-1 / (1 - d), 3), lns: fmt(-Math.log(d), 3), gns: fmt(-1 / d, 3) });
          gmm.set(fmt(-1 / (1 - d), 3));
          gns.set(fmt(-1 / d, 3));
          pl.redraw();
        };
        f.slider({
          label: 'D(G(z))',
          sym: 'D',
          min: 0.01,
          max: 0.99,
          step: 0.01,
          value: 0.05,
          slot: 'd',
          format: (v) => v.toFixed(2),
          onInput: (v) => {
            d = v;
            f.code.highlight(v < 0.5 ? 'ns' : 'mm');
            sync();
          },
        });
        sync();
      },
      caption: `Horizontal axis: how real the discriminator thinks a fake sample is. Both curves are losses the generator could minimize, and both go down as $\\symD(\\symG(\\symz))$ rises; the dashed lines show their slopes at the slider's value. When the generator is bad ($\\symD(\\symG(\\symz))$ near 0, the default here), the gray minimax curve is almost flat (slope about $-1$) while the blue curve is steep (slope $-1/d$, here $-20$): a much stronger learning signal. Slide toward 1 and the situation reverses, but by then the generator is already doing well.`,
    });

    p.prose(`
Here is the whole procedure on the smallest possible problem: the "data" are single numbers drawn from a two-bump distribution, $\\symG$ maps one random number to one sample, and $\\symD$ maps one number to a probability. Both are small MLPs, trained right here with alternating steps.`);

    p.figure({
      title: 'A GAN learning a two-bump distribution',
      codeTitle: 'gan_1d.py',
      code: `
        for step in range(4000):
            for _ in range({{k:1}}):     # k discriminator steps
                x_real = sample_data(64)                  #@d
                x_fake = G(np.random.randn(64, 1))        #@d
                loss_D = -np.mean(np.log(D(x_real))       #@d
                                  + np.log(1 - D(x_fake)))  #@d
                adam_step(D, loss_D)    # G frozen        #@dupd
            x_fake = G(np.random.randn(64, 1))            #@g
            loss_G = -np.mean(np.log(D(x_fake)))          #@g
            adam_step(G, loss_G)        # D frozen        #@gupd
        # step {{step:0}}  loss_D {{ld:…}}  loss_G {{lg:…}}
      `,
      setup(f) {
        const B = 64;
        let k = 1;
        let G: TinyNet, D: TinyNet;
        let rng = new Rng(1);
        let step = 0;
        let ld = NaN, lg = NaN;
        const real = () => (rng.next() < 0.5 ? -1.6 : 1.6) + 0.35 * rng.randn();
        const pdf = (x: number) => 0.5 * gauss(x, -1.6, 0.35) + 0.5 * gauss(x, 1.6, 0.35);
        const zTest = new Float64Array(3000);
        const zr = new Rng(9);
        for (let i = 0; i < zTest.length; i++) zTest[i] = zr.randn();
        const build = (seed: number) => {
          const r = new Rng(seed);
          const rn = () => r.randn();
          G = new TinyNet([1, 16, 16, 1], ['leaky', 'leaky', 'linear'], rn);
          D = new TinyNet([1, 24, 24, 1], ['leaky', 'leaky', 'linear'], rn);
          rng = new Rng(seed + 100);
          step = 0;
          ld = lg = NaN;
        };
        const dStep = () => {
          const xr = new Float64Array(B).map(real);
          const xf = G.run(new Float64Array(B).map(() => rng.randn()), B);
          const or = D.forward(xr, B);
          let l = 0;
          D.backward(or.map((v) => {
            l -= Math.log(Math.max(1e-9, sigm(v)));
            return (sigm(v) - 1) / B;
          }));
          const of = D.forward(xf, B);
          D.backward(of.map((v) => {
            l -= Math.log(Math.max(1e-9, 1 - sigm(v)));
            return sigm(v) / B;
          }));
          D.adam(2e-3, 0.5);
          return l / B;
        };
        const gStep = () => {
          const xg = G.forward(new Float64Array(B).map(() => rng.randn()), B);
          const og = D.forward(xg, B);
          let l = 0;
          const dx = D.backward(og.map((v) => {
            l -= Math.log(Math.max(1e-9, sigm(v)));
            return (sigm(v) - 1) / B;
          }));
          D.zeroGrad();
          G.backward(dx);
          G.adam(2e-3, 0.5);
          return l / B;
        };
        const NB = 48, LO = -4, HI = 4;
        const pl = f.plot({
          aspect: 1.45,
          square: false,
          domain: [LO, HI, -0.06, 1.08],
          draw: (pp) => {
            pp.axes({ grid: 1 });
            pp.path([LO, HI], [0.5, 0.5], withAlpha(color('gold'), 0.5), 1, [4, 4]);
            const g = G.run(zTest, zTest.length);
            const counts = new Array(NB).fill(0);
            for (const v of g) {
              const b = Math.floor(((v - LO) / (HI - LO)) * NB);
              if (b >= 0 && b < NB) counts[b]++;
            }
            const bw = (HI - LO) / NB;
            pp.ctx.fillStyle = withAlpha(color('blue'), 0.45);
            counts.forEach((cnt, b) => {
              const hgt = cnt / (zTest.length * bw);
              const x0 = pp.sx(LO + b * bw), x1 = pp.sx(LO + (b + 1) * bw);
              pp.ctx.fillRect(x0 + 0.5, pp.sy(Math.min(1.05, hgt)), x1 - x0 - 1, pp.sy(0) - pp.sy(Math.min(1.05, hgt)));
            });
            pp.fn(pdf, color('orange'), 2.5);
            const M = 200;
            const xs = new Float64Array(M + 1).map((_, i) => LO + ((HI - LO) * i) / M);
            const dv = D.run(xs, M + 1);
            pp.path(xs, Array.from(dv, sigm), color('gold'), 2.5);
            pp.text('real data', -3.9, 0.98, { size: 11, color: color('orange') });
            pp.text('G(z) samples', -3.9, 0.88, { size: 11, color: color('blue') });
            pp.text('D(x)', -3.9, 0.78, { size: 11, color: color('gold') });
          },
        });
        const mapPl = f.plot({
          height: 110,
          square: false,
          domain: [-3, 3, -3.5, 3.5],
          draw: (pp) => {
            pp.axes({ grid: 1 });
            pp.fn((zz) => G.run(Float64Array.of(zz), 1)[0]!, color('blue'), 2.2);
            pp.ctx.fillStyle = color('--ink-3');
            pp.ctx.font = font(11);
            pp.ctx.textAlign = 'left';
            pp.ctx.fillText('the generator as a function: x = G(z), z from -3 to 3', 6, 14);
          },
        });
        const stepRo = f.readout('step');
        const ldRo = f.readout('loss_D', { sym: 'L' });
        const lgRo = f.readout('loss_G', { sym: 'L' });
        let phase = 0;
        const loop = f.loop(() => {
          for (let q = 0; q < 6; q++) {
            let l = 0;
            for (let j = 0; j < k; j++) l = dStep();
            const g = gStep();
            ld = Number.isNaN(ld) ? l : 0.95 * ld + 0.05 * l;
            lg = Number.isNaN(lg) ? g : 0.95 * lg + 0.05 * g;
            step++;
          }
          f.code.highlight([['d', 'dupd'], ['g', 'gupd']][phase++ % 2]!);
          f.code.setMany({ step, ld: fmt(ld, 3), lg: fmt(lg, 3) });
          stepRo.set(step);
          ldRo.set(fmt(ld, 3));
          lgRo.set(fmt(lg, 3));
          pl.redraw();
          mapPl.redraw();
          if (step >= 4000) {
            stop();
            f.status('Done: 4,000 rounds. Press **Train** for a fresh run with a new random start.');
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          btn.textContent = 'Train';
          f.code.highlight(null);
        };
        const btn = f.button('Train', () => {
          if (loop.running()) stop();
          else {
            if (step >= 4000) {
              build(Math.floor(Math.random() * 1e6));
              f.status('');
            }
            loop.start();
            btn.textContent = 'Pause';
          }
        }, { primary: true });
        f.button('Reset', () => {
          stop();
          build(Math.floor(Math.random() * 1e6));
          f.code.setMany({ step: 0, ld: '…', lg: '…' });
          stepRo.set(0);
          ldRo.set('–');
          lgRo.set('–');
          f.status('');
          pl.redraw();
          mapPl.redraw();
        });
        f.segmented({
          label: 'D steps per G step',
          options: [
            { value: '1', label: 'k = 1' },
            { value: '3', label: 'k = 3' },
          ],
          value: '1',
          slot: 'k',
          onChange: (v) => {
            k = Number(v);
          },
        });
        build(2);
      },
      caption: `Orange: the real data's distribution, two bumps. Blue bars: a histogram of 3,000 samples from the generator. Gold: the discriminator's opinion $\\symD(\\symx)$ at every $\\symx$ (dashed line at $\\tfrac{1}{2}$). Press **Train** and watch the game. $\\symD$ rises over regions with too little fake data and dips where fakes pile up; $\\symG$ then shifts its samples toward the high-$\\symD$ regions. The lower plot shows $\\symG$ itself: to turn one bell-shaped $\\symz$ into two bumps, it must learn a steep jump in the middle. Runs differ: press **Reset** a few times and you will see bumps of the wrong size, oscillation back and forth, or the generator collapsing onto one bump for a while before recovering. These are, in miniature, the instabilities that make GANs hard to train.`,
    });

    p.prose(`
### DCGAN and arithmetic on faces

Early GANs on images were small and fragile. **DCGAN** (Radford, Metz and Chintala, 2015) found a set of architecture rules that made convolutional GANs train reliably: no pooling (strided convolutions in $\\symD$, transpose convolutions to upsample in $\\symG$), batch normalization in both networks, no fully-connected hidden layers, ReLU in the generator (tanh at the output) and leaky ReLU in the discriminator. It produced convincing 64 × 64 bedrooms and faces, and its latent space behaved like a meaningful coordinate system. Walking between two codes changed a scene smoothly (in one of the paper's examples, a TV gradually turns into a window), and **vector arithmetic** worked: average the $\\symz$ of a few "smiling woman" samples, subtract the average for "neutral woman", add "neutral man", and decoding the result gives smiling men. "Man with glasses" minus "man" plus "woman" gives women with glasses.

Other work of the time built on this: generating images coarse to fine with a pyramid of GANs (LAPGAN, Denton et al., 2015), and hybrids that put a GAN-style discriminator on a VAE to sharpen its blurry outputs (Larsen et al., 2015).`);
    p.callout('warning', `GANs were (and are) notoriously hard to train. The two networks chase each other instead of descending one loss, so training can oscillate instead of converging. The generator can **collapse** onto a few outputs that currently fool $\\symD$, ignoring the rest of the data. And neither loss tells you much about sample quality: a falling $\\symD$ loss may mean $\\symD$ is winning, or that both are stuck. In 2016 this was managed with architecture rules like DCGAN's, careful learning rates (Adam with $\\beta_1 = 0.5$, as in the figure), and a lot of watching samples by eye.`, 'Training instability');

    p.callout('idea', `
- **Video:** treat a clip as a stack of frames and decide where to mix time: late, early or slow fusion, **3-D convolutions** (C3D), a second stream on **optical flow**, or an **RNN** over per-frame ConvNet features for long-range structure.
- **Unsupervised learning** finds structure in unlabeled data, which is plentiful when labels are not.
- An **autoencoder** compresses $\\symx$ to a small code $\\symz$ and rebuilds it with an L2 loss; its encoder can initialize or feed a supervised model.
- A **VAE** makes the code a distribution $\\mathcal{N}(\\symmu, \\symsig^2)$, samples it with the **reparameterization trick** $\\symz = \\symmu + \\symsig\\symeps$, and adds a **KL penalty** toward $\\mathcal{N}(0, I)$ so that decoding random codes generates new data.
- A **GAN** trains a generator against a discriminator in a minimax game, with the generator maximizing $\\log \\symD(\\symG(\\symz))$ for strong early gradients. Sharp samples, unstable training; DCGAN made it work for images and revealed a latent space where arithmetic has meaning.`, 'Takeaways');
  },
};

export default chapter;
