import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-iou',
  title: 'Non-max suppression',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'nms',
      title: 'Non-max suppression',
      codeTitle: 'nms.py',
      code: `
        iou(A, B)    # 36 / 62 = 0.58     #@recall
        boxes.sort(key=score, reverse=True)  #@sort
        # A C B D                            #@sort
        keep = []
        while boxes:                                    #@loop
            best = boxes.pop(0)                         #@keep
            keep.append(best)                           #@keep
            boxes = [o for o in boxes                   #@drop
                     if iou(best, o) <= 0.5]            #@drop,thresh
        keep         # [A, C]             #@done
      `,
      beats: [
        { id: 'many', say: 'A detector, a network that finds and boxes objects, often fires several boxes on one object, each with a confidence score.' },
        { id: 'recall', say: 'How much two boxes overlap is their IoU, intersection over union. A and B share thirty six units of the sixty two they cover: {0.58|zero point five eight}.', code: 'recall' },
        { id: 'sort', say: 'Non-max suppression keeps one box per object. First, sort the boxes by confidence.', code: 'sort' },
        { id: 'keep', say: 'Keep the top box, A, and drop every box whose IoU with it is above a threshold, here a half. B overlaps A at {0.58|zero point five eight}: a duplicate, gone.', code: ['keep', 'drop'] },
        { id: 'stay', say: 'C does not touch A, so it stays. Repeat with what is left: C is now the best, so it is kept, and D, at {0.63|zero point six three} with C, is dropped.', code: ['loop', 'keep', 'drop'] },
        { id: 'done', say: 'Nothing is left: two boxes, one per object.', code: 'done' },
        { id: 'thresh', say: 'The threshold sets what counts as a duplicate. At {0.6|zero point six}, B\'s {0.58|zero point five eight} would not be above it, and B would stay: a higher threshold drops fewer boxes.', code: 'thresh' },
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
