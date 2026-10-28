import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-iou',
  title: 'Non-max suppression',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Canny', year: 1986, title: 'A computational approach to edge detection', url: 'https://doi.org/10.1109/TPAMI.1986.4767851', scene: 'many' },
    { who: 'Girshick, Donahue, Darrell & Malik', year: 2014, title: 'Rich feature hierarchies for accurate object detection and semantic segmentation', url: 'https://arxiv.org/abs/1311.2524', scene: 'chain' },
  ],
  scenes: [
    {
      id: 'many',
      title: 'Many boxes, one object',
      codeTitle: 'boxes.py',
      code: `
        # a box: its corners, and a score    #@box
        boxes = ["A", "B", "C", "D"]         #@box
        # score: A 0.9 B 0.7 C 0.8 D 0.6     #@conf
        iou("A", "B")   # 36 / 62 = 0.58     #@iou
        # keep the max, suppress the rest    #@name
        # edges: keep only the peak          #@edge
      `,
      beats: [
        { id: 'many', say: 'A detector is a network that looks at an image and draws a box around each object it finds. It rarely draws just one per object: here, two objects come back with four boxes.', code: 'box' },
        { id: 'conf', say: 'Each box comes with a confidence: the detector\'s score for how sure it is that the box holds an object. Here they run from zero to one, and higher means surer.', code: 'conf' },
        { id: 'want', say: 'One object should get one box. So keep the most confident box, A, and treat a box that overlaps it heavily as the same object, found twice.', code: 'conf' },
        { id: 'iou', say: 'Heavily means a high IoU, intersection over union. A and B share thirty six squares of the sixty two they cover: {0.58|zero point five eight}.', code: 'iou' },
        { id: 'name', say: 'The box with the maximum confidence stays, and the overlapping boxes that are not the maximum are suppressed. That is the name: non-maximum suppression.', code: 'name' },
        { id: 'canny', say: 'Finding edges needs the same thing. An edge filter answers on the edge and on the pixels beside it. In 1986, John Canny asked for only one response to a single edge, marking it only at the peak.', code: 'edge' },
      ],
    },
    {
      id: 'nms',
      title: 'Keep the best, drop its copies',
      codeTitle: 'nms.py',
      code: `
        boxes.sort(key=score, reverse=True)  #@sort
        # A C B D                            #@sort
        keep = []
        while boxes:                         #@loop
            best = boxes.pop(0)              #@keep
            keep.append(best)                #@keep
            boxes = [o for o in boxes        #@drop
                     if iou(best, o) <= 0.5] #@drop,thresh
        keep         # [A, C]                #@done
      `,
      beats: [
        { id: 'sort', say: 'Non-max suppression runs in rounds. First, sort the boxes by confidence, highest first: A, C, B, D.', code: 'sort' },
        { id: 'keep', say: 'Keep the top box, A, and drop every box whose IoU with it is above a threshold, here a half. B, at {0.58|zero point five eight}, is dropped.', code: ['keep', 'drop'] },
        { id: 'stay', say: 'C does not touch A, so their IoU is zero, and C stays.', code: 'drop' },
        { id: 'repeat', say: 'Repeat with what is left. C is now the most confident, so it is kept, and D, at {0.63|zero point six three} with C, is dropped.', code: ['loop', 'keep', 'drop'] },
        { id: 'done', say: 'Nothing is left to check: two boxes, one per object.', code: 'done' },
        { id: 'thresh', say: 'The threshold sets what counts as a copy. Raise it to {0.6|zero point six}, and B\'s {0.58|zero point five eight} is no longer above it, so B stays. A higher threshold drops fewer boxes.', code: 'thresh' },
      ],
    },
    {
      id: 'chain',
      title: 'Only kept boxes count',
      codeTitle: 'chain.py',
      code: `
        # ious[r][c]: row r, column c        #@table
        order = ["C", "B", "A"]  # by score  #@sort
        keep = ["C"]                         #@keepC
        ious["C"]["B"]  # 0.6 > 0.5: drop B  #@keepC
        ious["B"]["A"]  # 0.53, but B is out #@ghost
        ious["C"]["A"]  # 0.25: keep A       #@keepA
        keep            # ["C", "A"]         #@keepA
        # only a kept box drops another      #@rule
      `,
      beats: [
        { id: 'row', say: 'One case needs care. Here three boxes overlap in a row: C is the most confident, then B, then A.', code: 'sort' },
        { id: 'dropB', say: 'C is kept first. B overlaps it at {0.6|zero point six}, above a half, so B is dropped.', code: 'keepC' },
        { id: 'ghost', say: 'Now A. It overlaps B at {0.53|zero point five three}, also above a half. But B is already gone, and a dropped box drops nothing.', code: 'ghost' },
        { id: 'keepA', say: 'Only kept boxes count. Against C, the one kept box, A\'s IoU is {0.25|zero point two five}, so A stays: C and A survive.', code: 'keepA' },
        { id: 'why', say: 'B was ruled a copy of C and thrown out. A is not a copy of anything still kept, so nothing removes it.', code: 'rule' },
        { id: 'rcnn', say: 'In 2014, the {R-CNN|R C N N} detector of Ross Girshick and colleagues put the rule this way: reject a box whose IoU with a higher scoring selected box is larger than the threshold. Selected means kept.', code: 'rule' },
        { id: 'table', say: 'Practice gives the overlaps as a table, rows and columns in letter order. Row B, column C holds the IoU of B and C: {0.6|zero point six}.', code: 'table' },
        { id: 'first', say: 'So start with the row of the most confident box: here row C, not row A.', code: ['table', 'keepC'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
