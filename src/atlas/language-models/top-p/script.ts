import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-top-p',
  title: 'Top-k and top-p sampling',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'tail',
      title: 'Cut off the tail',
      codeTitle: 'top_k.py',
      code: `
        probs = np.array([.40, .25, .15,   #@dist
                          .10, .06, .04])  #@dist
        keep = np.argsort(-probs)[:3]  # k = 3  #@topk
        q = probs[keep]                         #@renorm
        q = q / q.sum()   # / 0.80              #@renorm
        # [0.50, 0.31, 0.19]                    #@renorm
      `,
      beats: [
        { id: 'dist', say: 'Here are a model\'s next-token probabilities, most likely first: the, a, this, my, and two unlikely ones, dog and ran.', code: 'dist' },
        { id: 'risk', say: 'Plain sampling can pick any of them. Each unlikely token is rare, but together the tail adds up, and over a long text the model will pick from it again and again.', code: 'dist' },
        { id: 'topk', say: 'Top-k sampling cuts the tail off: it keeps only the k most likely tokens. With k at three, that is the, a, and this.', code: 'topk' },
        { id: 'renorm', say: 'Those three hold {0.8|zero point eight} of the probability, so divide each by {0.8|zero point eight}: one half, {0.31|zero point three one}, and {0.19|zero point one nine}. They add up to one again, and sampling picks among them.', code: 'renorm' },
      ],
    },
    {
      id: 'nucleus',
      title: 'Top-p: keep what it takes',
      codeTitle: 'top_p.py',
      code: `
        cum = np.cumsum(probs)  # .40 .65 .80 ...  #@topp
        n = (cum < 0.8).sum() + 1     # 3 tokens   #@topp
        # sure: .85 first -> keeps 1 token         #@adapts
        # k = 1: greedy.  p = 1: plain sampling    #@limits
      `,
      beats: [
        { id: 'topp', say: 'Top-p sampling keeps the fewest most likely tokens whose probabilities add up to at least p. With p at {0.8|zero point eight}, add from the top: {0.4|zero point four}, {0.65|zero point six five}, {0.8|zero point eight}. Three tokens reach it.', code: 'topp' },
        { id: 'sure', say: 'Now a context where the model is sure: the top token alone holds {0.85|zero point eight five}. Top-p keeps just that one.', code: 'adapts' },
        { id: 'unsure', say: 'Where it is unsure, the probability is spread out, and reaching {0.8|zero point eight} takes five tokens. A fixed k would keep three both times.', code: 'adapts' },
        { id: 'limits', say: 'At the extremes, k of one, or a tiny p, keeps only the top token: greedy decoding. A p of one keeps every token: plain sampling.', code: 'limits' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
