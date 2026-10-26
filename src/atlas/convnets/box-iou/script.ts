import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-box-iou',
  title: 'Boxes and IoU',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'boxes',
      title: 'A box is two corners',
      codeTitle: 'boxes.py',
      code: `
        truth = (1, 1, 5, 4)   # x1, y1, x2, y2   #@box
        def area(box):                            #@area
            x1, y1, x2, y2 = box                  #@area
            return (x2 - x1) * (y2 - y1)          #@area
        area(truth)        # 4 * 3 = 12           #@twelve
        guess = (2, 2, 6, 5)                      #@guess
        area(guess)        # 12                   #@guess
      `,
      beats: [
        { id: 'box', say: 'To say where an object is, not just what it is, draw a box around it.', code: 'box' },
        { id: 'corners', say: 'Four numbers pin it down: the top-left corner, {x₁|x one} and {y₁|y one}, and the bottom-right corner, {x₂|x two} and {y₂|y two}. As in an image, y counts down from the top.', code: 'box' },
        { id: 'area', say: 'Its width is {x₂|x two} minus {x₁|x one}, four, and its height {y₂|y two} minus {y₁|y one}, three: an area of twelve.', code: ['area', 'twelve'] },
        { id: 'guess', say: 'A network guesses a box of its own, from two, two to six, five. Also twelve. How well do they agree?', code: 'guess' },
      ],
    },
    {
      id: 'overlap',
      title: 'Intersection over union',
      codeTitle: 'iou.py',
      code: `
        left   = max(1, 2)       # 2              #@x
        right  = min(5, 6)       # 5              #@x
        top    = max(1, 2)       # 2              #@y
        bottom = min(4, 5)       # 4              #@y
        width  = max(0, right - left)    # 3      #@w
        height = max(0, bottom - top)    # 2      #@h
        inter  = width * height  # 6              #@inter
        union  = 12 + 12 - inter # 18             #@union
        iou    = inter / union   # 0.33           #@iou
      `,
      beats: [
        { id: 'inter', say: 'First, their overlap, the intersection. Its left edge is the larger left, {max(1, 2)|the max of one and two}: two. Its right edge is the smaller right, {min(5, 6)|the min of five and six}: five. So it is three wide.', code: ['x', 'w'] },
        { id: 'tall', say: 'Its top is the larger top, two, and its bottom the smaller bottom, four: two tall. The intersection is three times two, six.', code: ['y', 'h', 'inter'] },
        { id: 'apart', say: 'If the boxes miss each other, right minus left comes out negative: no overlap, so the intersection is zero.', code: 'w' },
        { id: 'both', say: 'Boxes can miss on both sides. Take one from {(1, 1)|one, one} to {(4, 3)|four, three}, and one from {(6, 4)|six, four} to {(9, 6)|nine, six}. Right minus left is four minus six, minus two. Bottom minus top is three minus four, minus one.', code: ['x', 'y'] },
        { id: 'clamp', say: 'Multiplied, the two negatives would give two, an overlap that is not there. So each side is clamped at zero first: {max(0, −2)|the max of zero and minus two} is zero, and zero times zero is zero.', code: ['w', 'h', 'inter'] },
        { id: 'union', say: 'The union is everything either box covers: twelve plus twelve, minus the six they share, so the overlap is not counted twice. Eighteen.', code: 'union' },
        { id: 'iou', say: 'Intersection over union, IoU: six over eighteen, about {0.33|zero point three three}.', code: 'iou' },
        { id: 'range', say: 'Identical boxes score one, and boxes that do not touch score zero. A guess often counts as a hit at a half or more.', code: 'iou' },
      ],
    },
    {
      id: 'inside',
      title: 'One box inside another',
      codeTitle: 'iou_inside.py',
      code: `
        a = (1, 1, 7, 5)   # 6 * 4 = 24             #@ask
        b = (2, 2, 5, 4)   # 3 * 2 = 6              #@ask
        width  = min(7, 5) - max(1, 2)   # 3        #@edges
        height = min(5, 4) - max(1, 2)   # 2        #@edges
        inter  = 3 * 2                   # 6        #@edges
        union  = 24 + 6 - 6              # 24       #@union
        iou    = 6 / 24                  # 0.25     #@answer
      `,
      beats: [
        { id: 'ask', say: 'Box A is {(1, 1, 7, 5)|one, one, seven, five}: six by four, twenty four. Box B is {(2, 2, 5, 4)|two, two, five, four}: three by two, six. Their IoU?', code: 'ask' },
        { id: 'edges', say: 'The overlap runs from the larger left, two, to the smaller right, five, and from top two to bottom four: three by two, six. That is all of B, which lies inside A, so the union is twenty four plus six minus six: twenty four.', code: ['edges', 'union'] },
        { id: 'answer', say: 'IoU: six over twenty four, {0.25|zero point two five}. Not a hit, though B is wholly inside A.', code: 'answer' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
