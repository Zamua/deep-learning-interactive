import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-box-iou',
  title: 'Boxes and IoU',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Jaccard', year: 1901, title: 'Étude comparative de la distribution florale dans une portion des Alpes et du Jura', url: 'https://doi.org/10.5169/seals-266450', scene: 'union' },
    { who: 'Everingham, Van Gool, Williams, Winn & Zisserman', year: 2010, title: 'The PASCAL Visual Object Classes (VOC) Challenge', url: 'https://doi.org/10.1007/s11263-009-0275-4', scene: 'union' },
  ],
  scenes: [
    {
      id: 'boxes',
      title: 'A box is two corners',
      codeTitle: 'boxes.py',
      code: `
        # x: across, y: down, in pixels      #@axes
        truth = (1, 1, 5, 4)                 #@box
        # (x1, y1): the top-left corner      #@tl
        # (x2, y2): the bottom-right corner  #@br
        def area(box):                       #@area
            x1, y1, x2, y2 = box             #@area
            return (x2 - x1) * (y2 - y1)     #@area
        area(truth)   # 4 * 3 = 12           #@twelve
        guess = (2, 2, 6, 5)   # area 12     #@guess
      `,
      beats: [
        { id: 'what', say: 'A classifier says what is in a picture: a cat. To say where, draw the tightest rectangle around it. It is called a bounding box, since it bounds the object on every side.', code: 'box' },
        { id: 'axes', say: 'Measure in pixels, as an image does: x counts across from the left, and y counts down from the top.', code: 'axes' },
        { id: 'tl', say: 'The top-left corner sits at one, one. Call it {x₁|x one}, {y₁|y one}.', code: 'tl' },
        { id: 'br', say: 'The bottom-right corner, {x₂|x two}, {y₂|y two}, sits at five, four. Two corners, four numbers: the whole box.', code: ['br', 'box'] },
        { id: 'width', say: 'Its width is right minus left: five minus one, four.', code: 'area' },
        { id: 'height', say: 'Its height is bottom minus top: four minus one, three.', code: 'area' },
        { id: 'area', say: 'Width times height: twelve squares.', code: 'twelve' },
        { id: 'guess', say: 'A network\'s guess, in blue, also covers twelve squares, but sits one down and one to the right.', code: 'guess' },
        { id: 'ask', say: 'How well do the two agree? The goal is one number: one for a perfect match, and zero for a miss.', code: ['box', 'guess'] },
      ],
    },
    {
      id: 'overlap',
      title: 'The area they share',
      codeTitle: 'overlap.py',
      code: `
        left   = max(1, 2)   # 2             #@x
        right  = min(5, 6)   # 5             #@x
        top    = max(1, 2)   # 2             #@y
        bottom = min(4, 5)   # 4             #@y
        width  = max(0, right - left)  # 3   #@w
        height = max(0, bottom - top)  # 2   #@h
        inter  = width * height        # 6   #@inter
      `,
      beats: [
        { id: 'share', say: 'A first try: the area they share. It is a rectangle too, with edges taken from theirs.', code: 'inter' },
        { id: 'lr', say: 'Its left edge is the larger left, two, and its right edge the smaller right, five: three wide.', code: ['x', 'w'] },
        { id: 'tb', say: 'Its top is the larger top, two, and its bottom the smaller bottom, four: two tall.', code: ['y', 'h'] },
        { id: 'inter', say: 'Three by two: six shared squares. That part is called the intersection, as where two roads intersect: the part in both.', code: 'inter' },
        { id: 'apart', say: 'Slide the guess away, and the edges cross: right minus left is five minus six, minus one. A negative width means no overlap.', code: 'w' },
        { id: 'both', say: 'Miss both across and down, and both sides come out negative.', code: ['x', 'y'] },
        { id: 'clamp', say: 'Multiplied, two negatives make a positive: an overlap that is not there. So each side is clamped at zero first, and the intersection is zero.', code: ['w', 'h', 'inter'] },
      ],
    },
    {
      id: 'union',
      title: 'Over the union',
      codeTitle: 'iou.py',
      code: `
        huge = (0, 0, 10, 6)   # area 60     #@huge
        # shares all 12 of truth             #@huge
        12 / 60                # 0.2         #@fair
        union = 12 + 12 - 6    # 18          #@union
        iou = 6 / union        # 0.33        #@iou
        # same box: 1, apart: 0              #@range
        # a hit: IoU above 0.5              #@hit
      `,
      beats: [
        { id: 'big', say: 'But shared area alone rewards a lazy guess: a box over the whole picture shares all twelve squares of the truth.', code: 'huge' },
        { id: 'fair', say: 'So divide by everything either box covers. The huge box covers sixty squares: twelve over sixty, {0.2|zero point two}.', code: 'fair' },
        { id: 'union', say: 'Everything either box covers is called the union: both boxes joined into one shape, not the rectangle around them.', code: 'union' },
        { id: 'count', say: 'For the first guess, twelve plus twelve counts the shared six twice, so take six off once: eighteen.', code: 'union' },
        { id: 'iou', say: 'Intersection over union, {IoU|I O U} for short: six over eighteen, about {0.33|zero point three three}.', code: 'iou' },
        { id: 'range', say: 'Identical boxes score one, and boxes that do not touch score zero.', code: 'range' },
        { id: 'jaccard', say: 'The ratio is older than computers. In 1901, the Swiss botanist Paul Jaccard compared the plants of the Alps and the Jura this way: the species two places share, over the species found in either.', code: 'iou' },
        { id: 'voc', say: 'For boxes, the yardstick is the Visual Object Classes challenge, a yearly contest described in 2010 by Mark Everingham and colleagues. A guess counted as correct only if its {IoU|I O U} was above a half.', code: 'hit' },
        { id: 'low', say: 'They set that bar low on purpose, since even boxes drawn by people are not exact. The first guess, at {0.33|zero point three three}, falls short.', code: ['hit', 'iou'] },
      ],
    },
    {
      id: 'inside',
      title: 'One box inside another',
      codeTitle: 'inside.py',
      code: `
        box_a = (1, 1, 7, 5)  # 6 * 4 = 24   #@a
        box_b = (2, 2, 5, 4)  # 3 * 2 = 6    #@b
        inter = 6             # all of B     #@inter
        union = 24 + 6 - 6    # 24: all of A #@inter
        iou = 6 / 24          # 0.25         #@answer
        # inside: small area / big area      #@rule
      `,
      beats: [
        { id: 'nest', say: 'A box can lie wholly inside another. Box A is six by four: twenty four squares.', code: 'a' },
        { id: 'small', say: 'Box B, inside it, is three by two: six.', code: 'b' },
        { id: 'inter', say: 'Their overlap is all of B, and the union is just A: B adds nothing outside it.', code: 'inter' },
        { id: 'answer', say: 'So {IoU|I O U} is the small area over the big one: six over twenty four, {0.25|zero point two five}. Not a hit, though B lies inside A.', code: 'answer' },
        { id: 'rule', say: 'The other way round works too: a guess that holds the whole true box, with room to spare, scores the true box\'s area over its own.', code: 'rule' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
