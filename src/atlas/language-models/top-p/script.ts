import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-top-p',
  title: 'Top-k and top-p sampling',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Holtzman, Buys, Du, Forbes & Choi', year: 2019, title: 'The curious case of neural text degeneration', url: 'https://arxiv.org/abs/1904.09751', scene: 'tail' },
    { who: 'Fan, Lewis & Dauphin', year: 2018, title: 'Hierarchical neural story generation', url: 'https://arxiv.org/abs/1805.04833', scene: 'topk' },
  ],
  scenes: [
    {
      id: 'tail',
      title: 'The long tail',
      codeTitle: 'tail.py',
      code: `
        text = ['I', 'fed', 'my']          #@text
        VOCAB = ['cat', 'dog', 'fish',     #@dist
                 'sofa', 'ran', 'blue']    #@dist
        probs = np.array([.40, .25, .15,   #@dist
                          .10, .06, .04])  #@dist
        probs[3:].sum()  # .20: the tail   #@tail
        i = np.random.choice(6, p=probs)   #@dart
        text.append(VOCAB[i])  # 'sofa'    #@dart
      `,
      beats: [
        { id: 'dist', say: 'Back to “I fed my”, and the model\'s probabilities for the next token, most likely first: cat, dog and fish, then sofa, ran and blue, which make no sense here.', code: ['text', 'dist'] },
        { id: 'tail', say: 'Sorted like this, the bars trail off into a long, thin end, called the tail. Each token in it is unlikely, but together they add up: {0.2|zero point two} here.', code: 'tail' },
        { id: 'dart', say: 'Lay the bars end to end and throw darts, as sampling does, and one throw in five lands in the tail: I fed my sofa.', code: 'dart' },
        { id: 'stuck', say: 'And the mistake stays. The model reads “I fed my sofa” as the text so far, and builds every later word on it.', code: ['text', 'dart'] },
        { id: 'holtzman', say: 'In 2019, Ari Holtzman and colleagues, who found greedy text bland, found sampled text incoherent: almost unrelated to what came before.', code: 'dart' },
        { id: 'blame', say: 'They blamed the unreliable tail: in a real model, tens of thousands of unlikely tokens that together get far too many picks.', code: 'tail' },
      ],
    },
    {
      id: 'topk',
      title: 'Keep the top k',
      codeTitle: 'top_k.py',
      code: `
        k = 3                              #@k
        keep = np.argsort(-probs)[:k]      #@k
        kept = probs[keep]  # .40 .25 .15  #@kept
        kept.sum()          # 0.80         #@kept
        q = kept / kept.sum()              #@renorm
        # q: .50 .31 .19, sum 1            #@renorm
        i = keep[np.random.choice(k, p=q)] #@pick
      `,
      beats: [
        { id: 'cut', say: 'So cut the tail off before sampling. The simplest cut keeps a fixed number, k, of the most likely tokens, and drops the rest.', code: 'k' },
        { id: 'fan', say: 'In 2018, Angela Fan, Mike Lewis and Yann Dauphin wrote stories this way, picking each word from only the ten most likely. It is called top-k sampling.', code: 'k' },
        { id: 'kept', say: 'Here, with k of three, cat, dog and fish stay. But together they hold only {0.8|zero point eight} of the probability, not one.', code: 'kept' },
        { id: 'renorm', say: 'So divide each by {0.8|zero point eight}. Cat\'s {0.4|zero point four} becomes one half.', code: 'renorm' },
        { id: 'name', say: 'Dog and fish become {0.31|zero point three one} and {0.19|zero point one nine}, and the three add up to one again. That rescaling is called renormalizing, and sampling picks among them.', code: ['renorm', 'pick'] },
      ],
    },
    {
      id: 'nucleus',
      title: 'Top-p: keep what it takes',
      codeTitle: 'top_p.py',
      code: `
        # once upon a: keeps {{na:?}}           #@sure
        # my favorite color is: keeps {{nb:?}}  #@flat
        order = np.argsort(-probs)        #@p
        top_p = 0.8                       #@p
        cum = np.cumsum(probs[order])     #@add
        # .40 .65 .80 .90 .96 1.0         #@add
        n = (cum < top_p).sum() + 1  # 3  #@reach
        keep = order[:n]  # renormalize   #@reach
      `,
      beats: [
        { id: 'context', say: 'But how many tokens make sense depends on the text so far, called the context. After “Once upon a”, the model is sure: time holds {0.85|zero point eight five}.', code: 'sure' },
        { id: 'flat', say: 'After “My favorite color is”, it is unsure: the probability spreads over many colors.', code: 'flat' },
        { id: 'fixed', say: 'No fixed k suits both. A k of three keeps two junk tokens after once upon a, and cuts good colors after the other.', code: ['sure', 'flat'] },
        { id: 'topp', say: 'So Holtzman\'s team, in their 2019 paper, proposed keeping the fewest most likely tokens whose probabilities add up to at least p, a number such as {0.8|zero point eight}. This is top-p sampling.', code: 'p' },
        { id: 'add', say: 'On “I fed my”, add from the top: cat alone is {0.4|zero point four}, and with dog, {0.65|zero point six five}.', code: 'add' },
        { id: 'reach', say: 'With fish, the total reaches {0.8|zero point eight}, and exactly p counts. So top-p keeps three, and renormalizes them as top-k did.', code: 'reach' },
        { id: 'adapt', say: 'After once upon a, time alone passes p: top-p keeps one token. After my favorite color is, five. The kept set grows and shrinks with how sure the model is.', code: ['sure', 'flat'] },
        { id: 'nucleus', say: 'They called that set the nucleus: a small core that holds most of the probability, as an atom\'s nucleus holds most of its mass. Top-p is also called nucleus sampling.', code: 'reach' },
      ],
    },
    {
      id: 'ends',
      title: 'Both dials, all the way',
      codeTitle: 'limits.py',
      code: `
        # k = 1, or a tiny top_p:          #@one
        #   keeps only the top token       #@one
        #   renormalized: 1.0, greedy      #@one
        # k = V, or top_p = 1:             #@all
        #   keeps all: plain sampling      #@all
        kept / kept.sum()  # x 1.25 each   #@order
      `,
      beats: [
        { id: 'one', say: 'Turn either dial all the way down. With k of one, or a tiny p, only the top token is kept. Renormalized, it gets probability one: greedy decoding.', code: 'one' },
        { id: 'all', say: 'Turn them all the way up: k equal to V, the vocabulary size, or a p of one, which only the whole vocabulary reaches. Nothing is cut: plain sampling again.', code: 'all' },
        { id: 'order', say: 'Neither dial ever flattens the bars, as a high temperature does. They only cut, and what survives keeps its order and its proportions.', code: 'order' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
