import type { LectureScript } from '../../../lecture/types';

const code = `
  def out_size(width, F, S=1, P=0):         #@def
      return (width - F + 2 * P) / S + 1    #@def
  out_size(7, 3)              # 5.0         #@count
  out_size(7, 3, P=1)         # 7.0, same   #@pad
  out_size(7, 5, P=2)         # 7.0, same   #@five
  out_size(7, 3, S=2, P=1)    # 4.0         #@stride
  out_size(8, 3, S=2)         # 3.5         #@fit
  math.floor(out_size(8, 3, S=2))   # 3     #@drop
`;

export const script: LectureScript = {
  id: 'atlas-conv-output-size',
  title: 'Conv output size',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'count',
      title: 'Count the positions',
      codeTitle: 'out_size.py',
      code,
      beats: [
        { id: 'row', say: 'An input of width W, here seven, and a filter of size F, here three. How many places can the filter sit?', code: 'count' },
        { id: 'slide', say: 'It starts at the left edge and steps one entry at a time, until its right end reaches the last entry.', code: 'count' },
        { id: 'count', say: 'That makes five positions, so five outputs: the width, minus the filter size, plus one, {W − F + 1|W minus F, plus one}. The plus one counts the very first position.', code: ['def', 'count'] },
      ],
    },
    {
      id: 'pad',
      title: 'Padding',
      codeTitle: 'out_size.py',
      code,
      beats: [
        { id: 'pad', say: 'Padding, P, adds a border of zeros on each side. With P equal to one, the input becomes nine wide.', code: 'pad' },
        { id: 'slide', say: 'Now the filter fits in seven places: seven, minus three, plus two for the padding, plus one. The output is seven wide, the same as the input.', code: 'pad' },
        { id: 'lose', say: 'That is no accident. A filter three wide loses two positions: seven in, five out. Padding adds {2P|two P}, here two, which gives exactly those two back.', code: 'pad' },
        { id: 'five', say: 'A filter five wide loses four, so it needs {2P|two P} equal to four: P equal to two.', code: 'five' },
        { id: 'same', say: 'In general a filter loses {F − 1|F minus one} positions, so with stride one, P equal to {F − 1|F minus one}, over two, keeps the size. That is the usual choice.', code: ['def', 'pad', 'five'] },
      ],
    },
    {
      id: 'stride',
      title: 'Stride',
      codeTitle: 'out_size.py',
      code,
      beats: [
        { id: 'jump', say: 'The stride, S, is how far the filter jumps each time. With a stride of two it lands on every other position: four of them.', code: 'stride' },
        { id: 'formula', say: 'So divide by the stride before adding the one. W minus F plus two P, over S, plus one. Here, seven minus three plus two is six, over two is three, plus one: four.', code: ['def', 'stride'] },
        { id: 'fit', say: 'The division does not always come out whole. Eight wide, with a filter of three and a stride of two: eight minus three is five, over two is two and a half, plus one is three and a half.', code: 'fit' },
        { id: 'drop', say: 'Half a position means the last jump would hang over the edge, where there is no input. So that position is dropped: libraries such as PyTorch round the size down, here to three. A setting fits exactly when the division is whole, and nothing is dropped.', code: 'drop' },
      ],
    },
    {
      id: 'try',
      title: 'Try two',
      codeTitle: 'try.py',
      code: `
        out_size(8, 3, S=2, P=1)     # 4.5   #@p1
        math.floor(4.5)              # 4     #@a1
        # 10 - 5 + 2*P + 1 == 8, P = ?       #@p2
        out_size(10, 5, P=1)         # 8.0   #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one: eight wide, a filter of three, stride two and padding one. How wide is the output?', code: 'p1' },
        { id: 'a1', say: 'Eight minus three plus two is seven. Over two is three and a half, plus one: four and a half. A fifth position would hang over the edge, so round down: four.', code: ['p1', 'a1'] },
        { id: 'p2', say: 'Now backwards: ten wide, a filter of five, stride one. What padding makes the output eight wide?', code: 'p2' },
        { id: 'a2', say: 'With stride one the output is W minus F, plus two P, plus one. So ten minus five, plus two P, plus one, is eight: six plus two P is eight. Two P is two, and P is one.', code: ['p2', 'a2'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
