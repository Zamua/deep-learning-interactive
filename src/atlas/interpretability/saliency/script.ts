import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-saliency',
  title: 'Saliency maps',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Simonyan, Vedaldi & Zisserman', year: 2013, title: 'Deep Inside Convolutional Networks: Visualising Image Classification Models and Saliency Maps', url: 'https://arxiv.org/abs/1312.6034', scene: 'linear' },
  ],
  scenes: [
    {
      id: 'ask',
      title: 'Which pixels mattered?',
      codeTitle: 'nudge.py',
      code: `
        x = np.array([3, 1, 2, 1])  # pixels #@x
        s = W @ x     # [2, 0, 1]: class 0   #@s
        for j in range(4):    # each pixel   #@loop
            x[j] += 1         # brighten     #@loop
            (W @ x)[0] - s[0] # moved        #@loop
            x[j] -= 1         # put back     #@loop
        # moved: [1, -3, 0, 2]               #@g
      `,
      beats: [
        { id: 'ask', say: 'A classifier looks at an image and answers class zero. But which parts of the image made it say so?', code: 's' },
        { id: 'pixels', say: 'This image has just four pixels, the dots an image is made of. Their brightnesses make the input, x: three, one, two and one.', code: 'x' },
        { id: 'nudge', say: 'To find out, brighten a single pixel by one unit, and watch class zero\'s score, {s₀|s zero}. Pixel zero: {s₀|s zero} rises by one.', code: 'loop' },
        { id: 'jump', say: 'Pixel one: it falls by three, all the way down to minus one.', code: 'loop' },
        { id: 'still', say: 'Pixel two: it does not move at all. Pixel three: it rises by two.', code: 'loop' },
        { id: 'grad', say: 'How fast {s₀|s zero} moves per unit of brightness, pixel by pixel, is its gradient with respect to x, {∂s₀/∂x|partial s zero, partial x}.', code: 'g' },
        { id: 'name', say: 'Paint how far each nudge moved the score onto its pixel: that is a saliency map. Salient means standing out: these pixels stand out to the classifier.', code: 'g' },
      ],
    },
    {
      id: 'linear',
      title: 'Why those numbers',
      codeTitle: 'linear.py',
      code: `
        x = np.array([3, 1, 2, 1])
        W = np.array([[ 1, -3,  0,  2],  #@W
                      [ 0,  2, -1,  0],  #@W
                      [-1,  0,  3, -2]]) #@W
        s = W @ x     # [2, 0, 1]          #@s
        # s[0]: each pixel times its weight #@row
        g = W[0]      # ds0/dx: row 0      #@g
      `,
      beats: [
        { id: 'open', say: 'Why those numbers? The classifier is linear: W has one row of weights per class, and the scores, s, are W times x.', code: ['W', 's'] },
        { id: 'row', say: 'Class zero\'s score is row zero dotted with x. Raise pixel one by a unit, and only its own term moves, by its weight: the minus three the nudge found.', code: 'row' },
        { id: 'grad', say: 'So the gradient of {s₀|s zero} is just row zero. The pixel values drop out, so the map is the same for any image.', code: 'g' },
        { id: 'bias', say: 'A bias drops out too: no pixel appears in it.', code: 'g' },
        { id: 'history', say: 'That is where Karen Simonyan, Andrea Vedaldi and Andrew Zisserman, at Oxford, began in 2013: for a linear score, the size of each weight says how much its pixel matters.', code: 'g' },
      ],
    },
    {
      id: 'map',
      title: 'Size, not sign',
      codeTitle: 'map.py',
      code: `
        g = np.array([1, -3, 0, 2])  # ds0/dx #@g
        sal = abs(g)       # [1, 3, 0, 2]     #@sal
        sal.argmax()       # pixel 1          #@top
        W[0] * x           # [3, -3, 0, 2]    #@adds
        abs(W[2])          # class 2's map    #@other
      `,
      beats: [
        { id: 'sign', say: 'The sign of each partial says which way the score moves; its size, how fast. Minus three is as fast as plus three, just downward.', code: 'g' },
        { id: 'abs', say: 'So the map keeps each size and drops the sign: the absolute value, {\\|∂s₀/∂x\\||written between two bars}. One, three, zero, two.', code: 'sal' },
        { id: 'show', say: 'Pixel one glows brightest: it is the map\'s argmax, the position of its largest entry. Pixel two, with weight zero, stays dark.', code: 'top' },
        { id: 'adds', say: 'Pixel zero is the brightest, and adds the most to the score right now. But the map asks how fast the score moves, not what a pixel adds.', code: 'adds' },
        { id: 'other', say: 'Each class has its own map, from its own row. Class two\'s row, minus one, zero, three, minus two, lights up pixel two instead.', code: 'other' },
      ],
    },
    {
      id: 'deeper',
      title: 'Through a deeper model',
      codeTitle: 'deeper.py',
      code: `
        x0, x1 = 2, 1                       #@x
        q = 2 * x0 - x1         # 3         #@q
        r = max(0, q)           # 3         #@r
        s = 3 * r               # 9         #@s
        dr = 3 * 1.0            # 3         #@mul
        dq = dr if q > 0 else 0 # 3         #@max
        dx0 = 2 * dq            # 6         #@dx0
        dx1 = -1 * dq           # -3        #@dx1
        sal = [abs(dx0), abs(dx1)]  # [6, 3] #@sal
      `,
      beats: [
        { id: 'deep', say: 'A deeper model\'s score is no weighted sum, so there is no row to read. But a nudge still moves it at some rate, and Simonyan\'s team used just that: near one image, the gradient plays the part of the weights.', code: 'x' },
        { id: 'graph', say: 'Here is a small one. Pixel zero is doubled, pixel one is multiplied by minus one, and an add makes q.', code: 'q' },
        { id: 'max', say: 'A max gate keeps q or zero, whichever is larger, and a multiply by three makes the score, s.', code: ['r', 's'] },
        { id: 'fwd', say: 'Forward, on the image two, one: q is three, the max keeps it, and s is nine.', code: ['x', 'q', 'r', 's'] },
        { id: 'back', say: 'Now walk back from s, starting at one. The multiply by three hands back three.', code: 'mul' },
        { id: 'route', say: 'The max routes all of it on, since q beat zero, and the add copies it to both inputs.', code: 'max' },
        { id: 'px0', say: 'Pixel zero was doubled, so it gets two times three: six.', code: 'dx0' },
        { id: 'px1', say: 'Pixel one was multiplied by minus one, so it gets minus three. Saliency: six and three.', code: ['dx1', 'sal'] },
        { id: 'once', say: 'One walk back found both. A whole map takes a single backward pass, which is why Simonyan\'s team called it extremely quick.', code: 'sal' },
        { id: 'depends', say: 'Unlike the linear case, this map depends on the image. On the image one, three, q is minus one, the max routes nothing back, and both saliencies are zero.', code: 'max' },
        { id: 'paths', say: 'And if a pixel reaches the score along two paths, its gradients from the two of them add.', code: 'sal' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
