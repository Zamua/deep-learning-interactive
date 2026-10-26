import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-iou',
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
        { id: 'inter', say: 'First, their overlap, the intersection. Its left edge is the larger left, {max(1, 2)|the max of one and two}, which is two. Its right edge is the smaller right, {min(5, 6)|the min of five and six}, which is five. So it is three wide.', code: ['x', 'w'] },
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
      id: 'nms',
      title: 'Non-max suppression',
      codeTitle: 'nms.py',
      code: `
        boxes.sort(key=score, reverse=True)  # A C B D  #@sort
        keep = []
        while boxes:                                    #@loop
            best = boxes.pop(0)                         #@keep
            keep.append(best)                           #@keep
            boxes = [o for o in boxes                   #@drop
                     if iou(best, o) <= 0.5]            #@drop
        keep                                 # [A, C]   #@done
      `,
      beats: [
        { id: 'many', say: 'A detector, a network that finds and boxes objects, often fires several boxes on one object, each with a confidence score.' },
        { id: 'sort', say: 'Non-max suppression keeps one box per object. First, sort the boxes by confidence.', code: 'sort' },
        { id: 'keep', say: 'Keep the top box, A, and drop every box whose IoU with it is above a threshold, here a half. B overlaps A at {0.58|zero point five eight}: a duplicate, gone.', code: ['keep', 'drop'] },
        { id: 'stay', say: 'C does not touch A, so it stays. Repeat with what is left: C is now the best, so it is kept, and D, at {0.63|zero point six three} with C, is dropped.', code: ['loop', 'keep', 'drop'] },
        { id: 'done', say: 'Nothing is left: two boxes, one per object.', code: 'done' },
      ],
    },
    {
      id: 'table',
      title: 'From a table of IoUs',
      codeTitle: 'nms_table.py',
      code: `
        conf = dict(A=0.6, B=0.9, C=0.7, D=0.8)  #@conf
        order = ["B", "D", "C", "A"]             #@order
        keep = ["B"]   # D: 0.61 > 0.5, drop D   #@first
        # C: 0.32 with kept B, keep C            #@chain
        # A: 0.69 with kept C, drop A            #@last
        keep           # ["B", "C"]              #@last
      `,
      beats: [
        { id: 'grid', say: 'The same steps work from a table. Four boxes, with confidences: A {0.6|zero point six}, B {0.9|zero point nine}, C {0.7|zero point seven}, D {0.8|zero point eight}. Row A, column C holds the IoU of A and C: {0.69|zero point six nine}.', code: 'conf' },
        { id: 'order', say: 'Sort by confidence: B, D, C, A.', code: 'order' },
        { id: 'first', say: 'Keep B, and read its row. D is at {0.61|zero point six one}, above a half: dropped. C and A are below.', code: 'first' },
        { id: 'chain', say: 'Next, C. It overlaps D at {0.56|zero point five six}, but D was dropped, and a dropped box drops nothing. Only kept boxes count: with B, C is at {0.32|zero point three two}, so C is kept.', code: 'chain' },
        { id: 'last', say: 'Last, A. With C, now kept, it is at {0.69|zero point six nine}: dropped. B and C survive.', code: 'last' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
