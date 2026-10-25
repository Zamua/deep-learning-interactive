import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-adamw',
  title: 'AdamW',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'inside',
      title: 'Decay through the gradient',
      codeTitle: 'adam_l2.py',
      code: `
        g = grad + lam * w   # L2 in the gradient  #@l2
        m = beta1 * m + (1 - beta1) * g            #@adam
        v = beta2 * v + (1 - beta2) * g**2         #@adam
        w -= lr * m_hat / np.sqrt(v_hat)           #@step
        # decay part: lam * w / sqrt(v_hat)        #@part
      `,
      beats: [
        { id: 'recall', say: 'Write the L2 penalty as half of {λ|lambda} times the squared weights, and its gradient is {λ|lambda} times w: a pull toward zero, added to every weight\'s gradient.', code: 'l2' },
        { id: 'adam', say: 'In Adam, that sum goes into the running averages, and the step divides by the square root of v hat.', code: ['adam', 'step'] },
        { id: 'two', say: 'Take two weights, both at one, with {λ|lambda} at {0.1|zero point one}. Weight a has had large gradients: the square root of its v hat is ten. Weight b\'s gradients are tiny: {0.1|zero point one}.' },
        { id: 'divide', say: 'The decay, {0.1|zero point one}, is divided like everything else. For a it shrinks to {0.01|zero point zero one}. For b it grows to one.', code: 'part' },
        { id: 'wrong', say: 'So weight a barely decays, and weight b decays a hundred times harder. How strongly a weight is pulled to zero now depends on its gradients, which is not what {λ|lambda} asked for.', code: 'part' },
      ],
    },
    {
      id: 'outside',
      title: 'AdamW: decay the weights directly',
      codeTitle: 'adamw.py',
      code: `
        m = beta1 * m + (1 - beta1) * grad        #@adam
        v = beta2 * v + (1 - beta2) * grad**2     #@adam
        w -= lr * (m_hat / np.sqrt(v_hat) + lam * w)   #@aw
        # w=2, m_hat=0.3, v_hat=0.09, lam=lr=0.1  #@nums
        # lr * (1 + 0.2) = 0.12, so w = 1.88      #@res
      `,
      beats: [
        { id: 'fix', say: 'AdamW takes the decay out of the gradient. The running averages see only the data\'s gradient.', code: 'adam' },
        { id: 'rule', say: 'Then the decay joins the step after the division: w moves by {η|eta} times the sum of m hat over root v hat, and {λ|lambda} w.', code: 'aw' },
        { id: 'nums', say: 'Say w is two, m hat is {0.3|zero point three}, and v hat is {0.09|zero point zero nine}. Its square root is {0.3|zero point three}, so the Adam part is one.', code: 'nums' },
        { id: 'decay', say: '{λ|Lambda} w is {0.2|zero point two}. Together that is {1.2|one point two}, and times {η|eta}, {0.1|zero point one}, a step of {0.12|zero point one two}. W becomes {1.88|one point eight eight}.', code: 'res' },
        { id: 'same', say: 'Back to weights a and b. Now the decay inside the bracket is {λ|lambda} w for both: {0.1|zero point one} each, whatever their gradients. Every weight loses the same fraction, {η|eta} times {λ|lambda}, each step.', code: 'aw' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
