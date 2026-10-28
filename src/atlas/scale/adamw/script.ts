import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-adamw',
  title: 'AdamW',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Loshchilov & Hutter', year: 2017, title: 'Decoupled Weight Decay Regularization', url: 'https://arxiv.org/abs/1711.05101', scene: 'fix' },
  ],
  scenes: [
    {
      id: 'pull',
      title: 'Weight decay inside Adam',
      codeTitle: 'adam_l2.py',
      code: `
        # L = data_loss + lam/2 * sum(w**2) #@half
        g = grad + lam * w   # L2's pull    #@l2
        m = beta1 * m + (1 - beta1) * g     #@adam
        v = beta2 * v + (1 - beta2) * g**2  #@adam
        w -= lr * m_hat / np.sqrt(v_hat)    #@step
        # a: sqrt(v_hat) = 10               #@two
        # b: sqrt(v_hat) = 0.1              #@two
        # pull: lam * w / sqrt(v_hat)       #@div
        # lr = 0.1:  a 0.001,  b 0.1        #@move
      `,
      beats: [
        { id: 'recall', say: 'L2 regularization pulls every weight toward zero. In plain gradient descent, its part of each step shrinks every weight by the same fraction, which is why it is also called weight decay.', code: 'l2' },
        { id: 'half', say: 'Put a half in front of the penalty, and the two from squaring cancels it: each weight\'s pull, the penalty\'s gradient, is just {λ|lambda} times w.', code: ['half', 'l2'] },
        { id: 'adam', say: 'Now train with Adam. The pull is added to the data\'s gradient, so it flows into m and v, and the step divides by the square root of {v̂|v hat}.', code: ['adam', 'step'] },
        { id: 'two', say: 'Take two weights, a and b, both at one. a has had big gradients, so its {√v̂|root v hat} is ten. b\'s gradients have been tiny, so its {√v̂|root v hat} is {0.1|zero point one}.', code: 'two' },
        { id: 'same', say: 'With {λ|lambda} at {0.1|zero point one}, both feel the same pull, {λ|lambda} w: {0.1|zero point one}.', code: 'l2' },
        { id: 'diva', say: 'But Adam divides the pull along with the rest of the gradient. For a, {0.1|zero point one} over ten: it shrinks to {0.01|zero point zero one}.', code: 'div' },
        { id: 'divb', say: 'For b, {0.1|zero point one} over {0.1|zero point one}: it grows to one, a hundred times a\'s.', code: 'div' },
        { id: 'move', say: 'Times a learning rate of {0.1|zero point one}, the decay alone moves a by {0.001|zero point zero zero one} in a step, and b by {0.1|zero point one}.', code: 'move' },
        { id: 'wrong', say: 'So a barely decays, and b decays a hundred times harder. How hard a weight is pulled to zero now depends on its gradients, not just on {λ|lambda}.', code: 'move' },
      ],
    },
    {
      id: 'fix',
      title: 'Decay the weights directly',
      codeTitle: 'adamw.py',
      code: `
        m = beta1 * m + (1 - beta1) * grad  #@adam
        v = beta2 * v + (1 - beta2) * grad**2  #@adam
        w -= lr * (m_hat / np.sqrt(v_hat)   #@aw
                   + lam * w)               #@aw
        # a and b: lr * lam * w = 0.01      #@same
      `,
      beats: [
        { id: 'paper', say: 'In 2017, Ilya Loshchilov and Frank Hutter pointed this out. Common versions of Adam used L2, often calling it weight decay, but with Adam the two are not the same thing.', code: 'adam' },
        { id: 'out', say: 'Their fix: take the decay out of the gradient. m and v see only the data\'s gradient.', code: 'adam' },
        { id: 'rule', say: 'Then add the decay to the step after the division. w moves by {η|eta} times the sum of {m̂|m hat} over {√v̂|root v hat}, and {λ|lambda} w.', code: 'aw' },
        { id: 'name', say: 'They called it AdamW, for Adam with decoupled weight decay, and in their tests it did markedly better on new data than Adam with L2.', code: 'aw' },
        { id: 'equal', say: 'Back to a and b: the decay now skips the division, so with {η|eta} at {0.1|zero point one}, each one moves {0.01|zero point zero one}, whatever its gradients.', code: 'same' },
        { id: 'fraction', say: 'Every weight loses the same fraction, {η|eta} times {λ|lambda}, each step: the weight decay that L2 gave plain gradient descent.', code: 'same' },
      ],
    },
    {
      id: 'step',
      title: 'One AdamW step',
      codeTitle: 'step.py',
      code: `
        w, m_hat, v_hat = 2.0, 0.3, 0.09    #@nums
        lr, lam = 0.1, 0.1                  #@nums
        0.3 / np.sqrt(0.09)       # 1.0     #@u
        lam * w                   # 0.2     #@decay
        w = 2.0 - lr * (1.0 + 0.2)   # 1.88 #@res
        -0.3 / np.sqrt(0.09)      # -1.0    #@neg
        w = 2.0 - lr * (-1.0 + 0.2)  # 2.08 #@neg
      `,
      beats: [
        { id: 'nums', say: 'Now one full step. w is two, {m̂|m hat} is {0.3|zero point three}, and {v̂|v hat} is {0.09|zero point zero nine}, with {η|eta} and {λ|lambda} both {0.1|zero point one}.', code: 'nums' },
        { id: 'u', say: 'The square root of {0.09|zero point zero nine} is {0.3|zero point three}, so the Adam part, {m̂|m hat} over {√v̂|root v hat}, is one.', code: 'u' },
        { id: 'decay', say: 'The decay, {λ|lambda} w, is {0.2|zero point two}, so the bracket holds {1.2|one point two}.', code: 'decay' },
        { id: 'res', say: 'Times {η|eta}, the step is {0.12|zero point one two}, and w goes from two to {1.88|one point eight eight}.', code: 'res' },
        { id: 'neg', say: 'Now flip the gradient\'s sign: {m̂|m hat} is minus {0.3|zero point three}, so {m̂|m hat} over {√v̂|root v hat} is minus one, and the bracket holds minus {0.8|zero point eight}.', code: 'neg' },
        { id: 'rise', say: 'The step is minus {0.08|zero point zero eight}, and subtracting it raises w to {2.08|two point zero eight}. The data pushes w up, and the decay only holds it back a little.', code: 'neg' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
