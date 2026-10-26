import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-causal-mask',
  title: 'Causal masking',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'peek',
      title: 'No looking ahead',
      codeTitle: 'mask.py',
      code: `
        tokens = ['cats', 'like', 'fresh', 'fish']   #@tok
        e = Q @ K.T / np.sqrt(d_k)              # (4, 4)            #@e
        mask = np.tril(np.ones((4, 4)))         # 1 on and below the diagonal  #@mask
        e[mask == 0] = -np.inf                  # hide every later token       #@hide
      `,
      beats: [
        { id: 'predict', say: 'A model that writes text predicts each next token from the ones before it. Trained on cats like fresh fish, position zero should predict like, position one should predict fresh, and so on.', code: 'tok' },
        { id: 'cheat', say: 'Self-attention trains every position at once. But then cats can attend to like, the very token it is meant to predict, and simply copy it.', code: 'e' },
        { id: 'fail', say: 'That trick is useless when generating, where the next token does not exist yet.' },
        { id: 'mask', say: 'So before the softmax, every score whose key comes after its query is set to {−∞|minus infinity}.', code: ['mask', 'hide'] },
        { id: 'grid', say: 'In the grid of scores, that is everything above the diagonal. Each row keeps itself and the past: row zero keeps one entry, and row three keeps all four.', code: 'mask' },
      ],
    },
    {
      id: 'renorm',
      title: 'Softmax over what is left',
      codeTitle: 'mask.py',
      code: `
        e[1]               # [2, 0, 3, 1]: like's scores    #@row
        e[1, 2:] = -np.inf  # fresh and fish come later    #@hide
        softmax(e[1])      # [0.88, 0.12, 0, 0]             #@w
        mask.sum()         # 10 = 1 + 2 + 3 + 4             #@count
        # (1 + 4) + (2 + 3) = 2 pairs of 5 = 4 * 5 / 2      #@pairs
        16 - mask.sum()    # 6 = 4 * 3 / 2: hidden         #@hidden
      `,
      beats: [
        { id: 'row', say: 'Take row one, like. Its scores are two, zero, three and one, but the last two belong to fresh and fish, which come later.', code: 'row' },
        { id: 'hide', say: 'Both become {−∞|minus infinity}, and {e to the −∞|e to the minus infinity} is zero, so they get no weight at all.', code: 'hide' },
        { id: 'weights', say: 'The softmax shares everything among what is left: e squared over e squared plus one is {0.88|zero point eight eight}, and the other gets {0.12|zero point one two}. They still add up to one.', code: 'w' },
        { id: 'count', say: 'How many scores survive? Row zero keeps one, row one keeps two, and so on up to T, here four. One plus two plus three plus four: ten of the sixteen.', code: 'count' },
        { id: 'pairs', say: 'To add them fast, pair the rows from the ends: one plus four is five, and two plus three is five. That is T over two pairs of T plus one: {T(T + 1) / 2|T times T plus one, over two}.', code: 'pairs' },
        { id: 'hidden', say: 'The rest are hidden: sixteen minus ten, six, everything above the diagonal. In general that is {T²|T squared} minus the kept ones, which comes to {T(T − 1) / 2|T times T minus one, over two}.', code: 'hidden' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
