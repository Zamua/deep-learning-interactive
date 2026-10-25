import type { LectureScript } from '../../../lecture/types';

const code = `
  def out_size(width, F, S=1, P=0):         #@def
      return (width - F + 2 * P) / S + 1    #@def
  out_size(7, 3)              # 5.0         #@count
  out_size(7, 3, P=1)         # 7.0, same   #@pad
  out_size(7, 3, S=2, P=1)    # 4.0         #@stride
  out_size(8, 3, S=2)         # 3.5: no fit #@fit
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
        { id: 'slide', say: 'Now the filter fits in seven places, and the output is seven wide, the same as the input.', code: 'pad' },
        { id: 'same', say: 'That is the usual choice. With stride one, P equal to F minus one, over two, keeps the size: one for a three by three filter, two for a five by five.', code: ['def', 'pad'] },
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
        { id: 'fit', say: 'The division has to come out whole. Eight wide, with a filter of three and a stride of two, gives three and a half: the last jump hangs over the edge, so that setting does not fit.', code: 'fit' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
