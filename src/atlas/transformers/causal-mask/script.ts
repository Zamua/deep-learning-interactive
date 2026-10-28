import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-causal-mask',
  title: 'Causal masking',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser & Polosukhin', year: 2017, title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', scene: 'grid' },
  ],
  scenes: [
    {
      id: 'peek',
      title: 'No peeking ahead',
      codeTitle: 'mask.py',
      code: `
        toks = ['cats', 'like',        #@tok
                'fresh', 'fish']       #@tok
        # token i predicts token i + 1 #@next
        e = Q @ K.T / np.sqrt(d_k)     #@all
        # row i scores every token j   #@all
        # j > i: tokens still ahead    #@ahead
      `,
      beats: [
        { id: 'predict', say: 'A language model learns from text by predicting every next token. Trained on “cats like fresh fish”, cats should predict “like”, “like” should predict “fresh”, and “fresh”, “fish”.', code: ['tok', 'next'] },
        { id: 'all', say: 'Self-attention trains all those predictions at once: every token reads every token, in one pass, with no waiting.', code: 'all' },
        { id: 'cheat', say: 'But then cats can read “like”, the very token it must predict, and simply copy it. It learns nothing about language.', code: 'ahead' },
        { id: 'generate', say: 'And copying fails where it counts: generating, writing new text one token at a time and feeding each back in, as the decoder did. There, the next token does not exist yet.', code: 'next' },
        { id: 'cut', say: 'So hide every arc that points ahead, the way tape masks off a wall before painting: that is a mask. Each token reads itself and the tokens before it, never one after.', code: 'ahead' },
        { id: 'causal', say: 'That is why the mask is called causal: a cause comes before its effect. Engineers call a filter causal for the same reason, when its output uses only past and present input.', code: 'ahead' },
      ],
    },
    {
      id: 'grid',
      title: 'The arcs, as a grid',
      codeTitle: 'mask.py',
      code: `
        e = Q @ K.T / np.sqrt(d_k)  # (4, 4) #@e
        mask = np.tril(np.ones((4, 4)))      #@mask
        e[mask == 0] = -np.inf               #@hide
        softmax(e, axis=1)  # rows add to 1  #@soft
      `,
      beats: [
        { id: 'fold', say: 'Self-attention\'s scores already form a grid. Row i holds the query of token i, reading, and column j the key of token j, being read. Every arc is one cell.', code: 'e' },
        { id: 'upper', say: 'The arcs that point ahead are the cells where j is greater than i: the triangle above the diagonal.', code: 'e' },
        { id: 'tril', say: 'The cells to keep form the lower triangle, the diagonal included. {np.tril|NumPy\'s tril} builds it: tril, for triangle, lower.', code: 'mask' },
        { id: 'inf', say: 'Before the softmax, every hidden score becomes {−∞|minus infinity}. Ashish Vaswani and colleagues did exactly this in 2017, in Attention Is All You Need, so that no position could read one after it.', code: 'hide' },
        { id: 'zero', say: 'Why not zero? A score of zero still gets e to the zero, which is one: a real share. e to the {−∞|minus infinity} is zero: no share at all.', code: ['hide', 'soft'] },
      ],
    },
    {
      id: 'renorm',
      title: 'Softmax over what is left',
      codeTitle: 'mask.py',
      code: `
        e[1]           # [2, 0, 3, 1]: like  #@row
        e[1, 2:] = -np.inf  # fresh, fish    #@hide
        softmax(e[1])  # [0.88 0.12 0 0]     #@w
        # zeroed after: 0.24 + 0.03 = 0.27   #@wrong
      `,
      beats: [
        { id: 'row', say: 'Take row one: “like”. Its scores are two, zero, three and one, but the last two belong to fresh and fish, which come after it.', code: 'row' },
        { id: 'hide', say: 'Both become {−∞|minus infinity}, so they get no weight.', code: 'hide' },
        { id: 'weights', say: 'Softmax shares everything among what is left. e squared, about {7.39|seven point three nine}, out of {8.39|eight point three nine}, gives cats {0.88|zero point eight eight}.', code: 'w' },
        { id: 'sum', say: '“Like” itself gets the other {0.12|zero point one two}, and the weights still add up to one.', code: 'w' },
        { id: 'wrong', say: 'So mask first, then softmax. Zero the late weights after the softmax instead, and the two left add up to only {0.27|zero point two seven}.', code: 'wrong' },
      ],
    },
    {
      id: 'count',
      title: 'Kept and hidden',
      codeTitle: 'count.py',
      code: `
        mask.sum()    # 10 = 1 + 2 + 3 + 4   #@kept
        # (1 + 4) + (2 + 3) = 5 + 5          #@pairs
        # T(T + 1) / 2 = 4 * 5 / 2 = 10      #@formula
        16 - mask.sum()   # 6: hidden        #@hidden
        # T(T - 1) / 2 = 4 * 3 / 2 = 6       #@general
      `,
      beats: [
        { id: 'rows', say: 'How many scores survive? Token i keeps itself and every token before it: i plus one. Row zero keeps one, and the last row keeps all T, here four.', code: 'kept' },
        { id: 'add', say: 'One plus two plus three plus four: ten of the sixteen.', code: 'kept' },
        { id: 'pairs', say: 'For any T, pair the rows from the ends: one with four, two with three. Each pair adds up to T plus one, and there are T over two pairs.', code: 'pairs' },
        { id: 'formula', say: 'So the mask keeps {T(T + 1) / 2|T times T plus one, over two}: four times five, over two, is ten.', code: 'formula' },
        { id: 'hidden', say: 'The hidden ones fill the triangle above the diagonal: sixteen minus ten, six.', code: 'hidden' },
        { id: 'general', say: 'In general, that is {T²|T squared} minus the kept, which comes to {T(T − 1) / 2|T times T minus one, over two}. Not quite half: the diagonal is kept.', code: 'general' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
