import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'detection',
  title: 'Localization, detection and segmentation',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Where, not just what',
      codeTitle: 'outputs.py',
      code: `
        img = load('scene.png')   # (320, 480, 3)   #@img
        # what is it?
        label = 'car'                               #@cls
        # what, and where?
        label, box = 'car', (24, 176, 172, 90)      #@loc
        # every object
        dets = [('car', 0.98, box1),                #@det
                ('person', 0.95, box2), ...]        #@det
        # a class for every pixel
        mask = np.zeros((320, 480), int)            #@sem
        # a mask for every object
        instances = [('person', m1), ...]           #@inst
      `,
      beats: [
        { id: 'hello', say: 'Welcome to localization, detection and segmentation.' },
        { id: 'sofar', say: 'Every network so far has given one answer per image. This is a car. This is a cat.' },
        { id: 'messy', say: 'Real pictures are messier. This street holds a car, two people, a dog and a cat.', code: 'img' },
        { id: 'where', say: 'And usually we want to know where each one is, not just that it is in there somewhere.' },
        { id: 'ladder', say: 'So this chapter climbs a ladder of harder tasks, each built from pieces you already have.' },
        { id: 'cls', say: 'Classification gives one label for the whole image.', code: 'cls' },
        { id: 'loc', say: 'Localization adds a box around that one object: four more numbers.', code: 'loc' },
        { id: 'det', say: 'Detection finds a box and a label for every object, so the length of the answer changes from picture to picture.', code: 'det' },
        { id: 'sem', say: 'Semantic segmentation labels every pixel. But two people standing together are just person pixels.', code: 'sem' },
        { id: 'inst', say: 'Instance segmentation gives each object its own mask, so the two people are finally told apart.', code: 'inst' },
      ],
    },
    {
      id: 'localize',
      title: 'Localization is regression',
      codeTitle: 'localize.py',
      code: `
        box = np.array([22., 172., 182., 85.])  #@box
        gt  = np.array([24., 176., 172., 90.])  #@gt
        err = box - gt     # [-2, -4, 10, -5]   #@err
        loss = np.sum(err ** 2)    # 145        #@l2

        scores, box = net(img)    # two heads   #@heads
        l_cls = softmax_loss(scores, y)         #@cls
        l_box = np.sum((box - gt) ** 2)         #@lbox
        loss = l_cls + lam * l_box              #@total
      `,
      beats: [
        { id: 'one', say: 'Start with the gentlest step: one object we care about, and we want to find it.' },
        { id: 'four', say: 'A box is four numbers: the left edge x, the top edge y, a width and a height.', code: 'box' },
        { id: 'regress', say: 'Predicting real numbers is called regression. The last layer simply outputs four numbers instead of class scores.', code: 'box' },
        { id: 'truth', say: 'To train it, compare with the true box, b star, drawn by a person. The prediction is b hat.', code: 'gt' },
        { id: 'err', say: 'Subtract, coordinate by coordinate: minus two, minus four, ten, minus five.', code: 'err' },
        { id: 'square', say: 'Square each error, so misses in either direction count, and big misses count a lot.', code: 'l2' },
        { id: 'sum', say: 'Add them up: {145|a hundred and forty five}. A perfect box scores zero. This is the L2 loss.', code: 'l2' },
        { id: 'head', say: 'In practice, take a {ConvNet|conv net} trained to classify, and bolt on a second small head.', code: 'heads' },
        { id: 'both', say: 'One body, two heads. One answers what, with class scores. The other answers where, with four numbers.', code: 'heads' },
        { id: 'multi', say: 'Training adds the two losses: the softmax loss for the class, plus lambda times the box loss.', code: ['cls', 'lbox', 'total'] },
        { id: 'lam', say: 'Lambda balances them. Too small, and boxes are sloppy. Too large, and classification suffers.', code: 'total' },
        { id: 'specific', say: 'The head can predict one box for any class, or one box per class, so cats and buses each learn their own shape.' },
      ],
    },
    {
      id: 'iou',
      title: 'Measuring overlap: IoU',
      codeTitle: 'iou.py',
      code: `
        def iou(a, b):     # (x1, y1, x2, y2)
            ix1 = max(a[0], b[0])                #@inter
            iy1 = max(a[1], b[1])                #@inter
            ix2 = min(a[2], b[2])                #@inter
            iy2 = min(a[3], b[3])                #@inter
            iw = max(0, ix2 - ix1)               #@clamp
            ih = max(0, iy2 - iy1)               #@clamp
            inter = iw * ih                      #@clamp
            area_a = (a[2]-a[0]) * (a[3]-a[1])   #@union
            area_b = (b[2]-b[0]) * (b[3]-b[1])   #@union
            union = area_a + area_b - inter      #@union
            return inter / union                 #@ratio

        iou(box, gt)    # {{iou:0.54}}              #@call
      `,
      beats: [
        { id: 'how', say: 'Once a network outputs boxes, we need to grade them. How good is this purple box?' },
        { id: 'want', say: 'We want one number: one for a perfect match, zero for no contact, and fair to boxes of every size.' },
        { id: 'name', say: 'The standard answer is intersection over union, or {IoU|eye oh you}.', code: 'ratio' },
        { id: 'inter', say: 'The intersection is the region inside both boxes, and it is itself a box.', code: 'inter' },
        { id: 'edges', say: 'Its left edge is the larger of the two left edges, and its right edge is the smaller of the two right edges.', code: 'inter' },
        { id: 'clamp', say: 'If the edges cross, there is no overlap, and that side is clamped to zero.', code: 'clamp' },
        { id: 'union', say: 'The union is everything inside either box: both areas, minus the intersection, which was counted twice.', code: 'union' },
        { id: 'ratio', say: 'Shared area over total area. That is {IoU|eye oh you}.', code: 'ratio' },
        { id: 'shift', say: 'Slide a perfect box over by a quarter of its width, and {IoU|eye oh you} falls to {0.6|zero point six}.', code: 'call' },
        { id: 'big', say: 'Make the box huge: it still covers the dog, but the union balloons, and the score collapses.', code: 'call' },
        { id: 'tau', say: 'The usual rule: a detection is correct when its {IoU|eye oh you} with a true box is at least one half. We call that threshold tau.', code: 'call' },
      ],
    },
    {
      id: 'sliding',
      title: 'Sliding windows, for free',
      codeTitle: 'sliding.py',
      code: `
        runs = 0
        for win in [64, 96, 128]:                #@scale
            for y in range(0, H-win+1, {{st:32}}):    #@pos
                for x in range(0, W-win+1, {{st:32}}):  #@pos
                    crop = img[y:y+win, x:x+win] #@crop
                    scores = convnet(crop)       #@run
                    runs += 1    # {{runs:0}}         #@run

        def out_size(n, F, S=1):                 #@size
            return (n - F) // S + 1              #@size

        n = out_size({{n0:14}}, 5)   # conv  {{n1:10}}      #@net
        n = out_size(n, 2, 2)  # pool  {{n2:5}}      #@net
        n = out_size(n, 5)     # FC    {{n3:1}}      #@net
      `,
      beats: [
        { id: 'one', say: 'To find objects anywhere, the obvious idea is to slide a window over the image, and ask the network about every crop.', code: ['pos', 'crop'] },
        { id: 'each', say: 'A system called Overfeat did this, merging the good boxes at the end, and won ImageNet localization in 2013.', code: 'run' },
        { id: 'cost', say: 'The catch is cost. Every window is a full {ConvNet|conv net} forward pass.', code: 'run' },
        { id: 'count', say: 'Three sizes at a stride of thirty two is over three hundred passes. At a stride of eight, over four thousand, for one small image.', code: ['scale', 'pos'] },
        { id: 'trick', say: 'The trick: a fully connected layer is just a convolution whose filter covers its whole input.' },
        { id: 'any', say: 'Rewrite every one, and the network is all convolutions, so it accepts an image of any size.' },
        { id: 'formula', say: 'Each layer\'s output size is input minus filter size, over the stride, plus one.', code: 'size' },
        { id: 'train', say: 'Built for fourteen by fourteen crops, our tiny network shrinks to ten, then five, then one cell of scores.', code: 'net' },
        { id: 'grow', say: 'Hand it sixteen by sixteen, and every layer keeps going, ending at two by two: four windows, scored at once.', code: 'net' },
        { id: 'share', say: 'Neighboring windows share most of their work, so this costs barely more than one pass.' },
      ],
    },
    {
      id: 'nms',
      title: 'Non-maximum suppression',
      codeTitle: 'nms.py',
      code: `
        def nms(boxes, scores, thresh={{tau:0.5}}):
            # boxes of one class
            order = list(np.argsort(-scores))    #@sort
            keep = []
            while order:                         #@loop
                i = order.pop(0)                 #@pick
                keep.append(i)                   #@pick
                rest = np.array(order, int)      #@iou
                ious = iou(boxes[i], boxes[rest])  #@iou
                order = list(rest[ious <= thresh]) #@drop
            return keep
        # kept {{nk:0}}, removed {{nr:0}}
      `,
      beats: [
        { id: 'many', say: 'A detector that looks at many windows fires many times on one object: they all see the dog, so they all say dog.' },
        { id: 'raw', say: 'Here are eighteen raw detections, as a detector might emit them.' },
        { id: 'sort', say: 'Non-maximum suppression cleans this up. First, sort the boxes by score.', code: 'sort' },
        { id: 'keep', say: 'Keep the best one: the car, at {0.97|zero point nine seven}.', code: 'pick' },
        { id: 'drop', say: 'Then delete every box that overlaps it by more than a threshold tau, measured with {IoU|eye oh you}.', code: ['iou', 'drop'] },
        { id: 'repeat', say: 'Repeat with the best of what is left, until nothing is left.', code: ['loop', 'pick', 'drop'] },
        { id: 'class', say: 'Only boxes of the same class compete, so a small cat box inside the dog\'s box survives.' },
        { id: 'result', say: 'Eighteen in, eight out: one per object, a weak duplicate on the car, and two strays that a score cutoff would remove.' },
        { id: 'tau', say: 'Tau is a tradeoff. Too high, and duplicates slip through. Too low, and you may delete a real object standing right beside another.' },
      ],
    },
    {
      id: 'rcnn',
      title: 'Region proposals and R-CNN',
      codeTitle: 'rcnn.py',
      code: `
        P = selective_search(img)  # ~2000       #@ss
        for p in P:                              #@loop
            crop = warp(img, p, (227, 227))      #@warp
            f = convnet(crop)    # features      #@cnn
            scores = svms(f)     # per class     #@svm
            t = regressor(f)     # box nudge     #@reg

        def deltas(P, gt):       # (cx, cy, w, h)  #@delta
            t_x = (gt[0] - P[0]) / P[2]          #@txy
            t_y = (gt[1] - P[1]) / P[3]          #@txy
            t_w = np.log(gt[2] / P[2])           #@twh
            t_h = np.log(gt[3] / P[3])           #@twh
            return np.array([t_x, t_y, t_w, t_h])  #@delta
      `,
      beats: [
        { id: 'vary', say: 'Why not regress boxes for detection too? Because the number of objects varies: one cat here, forty people there.' },
        { id: 'clf', say: 'So treat detection as classification: look at many regions, and ask of each, which class is this, or is it background?' },
        { id: 'props', say: 'Trying every position and shape is hopeless, so region proposals pick likely spots, using color, texture and edges.', code: 'ss' },
        { id: 'ss', say: 'Selective Search keeps merging similar neighboring patches, emitting a box at each merge: about two thousand, in a couple of seconds.', code: 'ss' },
        { id: 'recall', say: 'Proposals need not be precise, just high recall: nearly every object covered by at least one.' },
        { id: 'rcnn', say: '{R-CNN|R C N N} warps each proposal to the network\'s input size...', code: ['loop', 'warp'] },
        { id: 'feat', say: 'runs the {ConvNet|conv net}, scores the crop with a linear classifier per class, and refines its box with a regressor.', code: ['cnn', 'svm', 'reg'] },
        { id: 'deltas', say: 'That regressor predicts corrections to the proposal, called t, not raw pixel coordinates.', code: 'delta' },
        { id: 'txy', say: 'Move the center by t x proposal widths and t y proposal heights, so one regressor serves small and large boxes alike.', code: 'txy' },
        { id: 'twh', say: 'Stretch the width by a log ratio: zero keeps it, twice as wide is plus {0.69|zero point six nine}, and the width can never go negative.', code: 'twh' },
        { id: 'slow', say: 'A big jump in accuracy, but slow: two thousand {ConvNet|conv net} passes, about a minute per image.' },
      ],
    },
    {
      id: 'fast',
      title: 'Fast R-CNN: RoI pooling',
      codeTitle: 'roi_pool.py',
      code: `
        fmap = convnet(img)   # once per image   #@once
        roi = P // 40         # onto the map     #@proj
        out = roi_pool(fmap, roi)    # (2, 2)    #@call

        def roi_pool(fmap, roi, H=2, W=2):       #@def
            x1, y1, x2, y2 = roi                 #@def
            r = fmap[y1:y2, x1:x2]   # region    #@def
            out = np.zeros((H, W))               #@def
            rows = np.array_split(r, H, 0)       #@split
            for i, band in enumerate(rows):      #@split
                cols = np.array_split(band, W, 1)  #@split
                for j, b in enumerate(cols):     #@max
                    out[i, j] = b.max()          #@max
            return out     # always (H, W)       #@out
      `,
      beats: [
        { id: 'waste', say: 'Most of that work is wasted: overlapping proposals redo the same convolutions.' },
        { id: 'once', say: 'Fast {R-CNN|R C N N} swaps the order. Run the convolutional layers once, on the whole image.', code: 'once' },
        { id: 'proj', say: 'Then cut each proposal out of the feature map: divide by the stride, here forty pixels per cell.', code: 'proj' },
        { id: 'sizes', say: 'But regions come in all sizes, and the layers after them need a fixed size input.' },
        { id: 'roi', say: 'Region of interest pooling splits the region into a fixed grid, here two by two...', code: ['def', 'split'] },
        { id: 'max', say: 'and keep the largest value in each cell, exactly like max pooling.', code: 'max' },
        { id: 'any', say: 'Large region or small, the output is always two by two.', code: 'out' },
        { id: 'e2e', say: 'Gradients flow through a max, so the whole network trains end to end: one loss for the class, one for the box.' },
        { id: 'smooth', say: 'The box loss is smooth L1: a parabola near zero, a straight line beyond, so wild misses cannot dominate.' },
        { id: 'fast', say: 'Training fell from eighty four hours to under ten. Testing, from forty seven seconds per image to a third of a second.' },
        { id: 'bottle', say: 'Now the slowest part was the proposals themselves: two seconds per image.' },
      ],
    },
    {
      id: 'faster',
      title: 'Faster R-CNN: anchors',
      codeTitle: 'anchors.py',
      code: `
        stride = 32              # 10 x 15 cells
        sizes, ratios = [48, 96, 192], [.5, 1, 2]  #@sizes
        anchors = []
        for i, j in np.ndindex(10, 15):          #@grid
            cx = (j + 0.5) * stride              #@center
            cy = (i + 0.5) * stride              #@center
            for s in sizes:                      #@shape
                for r in ratios:     # r = w / h #@shape
                    w = s * np.sqrt(r)           #@shape
                    h = s / np.sqrt(r)           #@shape
                    anchors.append((cx, cy, w, h))  #@shape
        # k = 9: 2k scores, 4k offsets t         #@k
        best = iou(anchors, gt).max(0)           #@label
        # > 0.7 object, < 0.3 background         #@label
      `,
      beats: [
        { id: 'rpn', say: 'Faster {R-CNN|R C N N} lets the network propose its own regions.' },
        { id: 'slide', say: 'A small region proposal network slides a three by three convolution over the shared feature map.', code: 'grid' },
        { id: 'anchor', say: 'At every position it considers k reference boxes, called anchors, centered on that spot.', code: 'center' },
        { id: 'shapes', say: 'Three sizes times three aspect ratios: k is nine.', code: ['sizes', 'shape'] },
        { id: 'obj', say: 'For each anchor it predicts an objectness score, and four offsets t, the same corrections as before.', code: 'k' },
        { id: 'labels', say: 'In training, an anchor with {IoU|eye oh you} above {0.7|zero point seven} on a true box is a positive, below {0.3|zero point three} on all of them a negative, and the rest are ignored.', code: 'label' },
        { id: 'fit', say: 'No single square fits a long car, a tall person and a small cat. Nine shapes fit every object better.', code: 'sizes' },
        { id: 'best', say: 'Still, nothing here clears {0.7|zero point seven}, so each object\'s best anchor counts as positive too. The offsets do the fine work.', code: 'label' },
        { id: 'pipe', say: 'The top boxes, after suppression, feed a Fast {R-CNN|R C N N} head on the same features: one network, four losses.' },
        { id: 'speed', say: 'About a fifth of a second per image, at the same accuracy.' },
      ],
    },
    {
      id: 'yolo',
      title: 'One look: YOLO and SSD',
      codeTitle: 'yolo.py',
      code: `
        S, B, C = 7, 2, 20  # grid, boxes, classes  #@sbc
        out = yolo_net(img)    # (7, 7, 30)      #@out
        dets = []
        for row, col in np.ndindex(S, S):        #@cell
            cell = out[row, col]   # 30 numbers  #@cell
            p_cls = cell[B*5:]     # (C,)        #@cls
            for k in range(B):                   #@box
                v = cell[k*5 : k*5+5]            #@box
                tx, ty, w, h, conf = v           #@box
                scores = conf * p_cls            #@score
                if scores.max() > 0.2:           #@score
                    dets.append((scores, v[:4])) #@score
        dets = nms(dets)                         #@nms
      `,
      beats: [
        { id: 'two', say: 'Faster {R-CNN|R C N N} still has two stages. {YOLO|yo-low}, You Only Look Once, does it all in one pass.' },
        { id: 'grid', say: 'It cuts the image into an S by S grid: seven by seven.', code: 'sbc' },
        { id: 'resp', say: 'The cell that holds an object\'s center is responsible for detecting it.', code: 'cell' },
        { id: 'boxes', say: 'Each cell predicts two boxes of five numbers: a center, a width and height, and a confidence that it holds an object and fits it.', code: 'box' },
        { id: 'classes', say: 'Each cell also predicts one set of class probabilities, shared by its boxes.', code: 'cls' },
        { id: 'tensor', say: 'So the whole output is one block: seven by seven by thirty, for twenty classes.', code: 'out' },
        { id: 'score', say: 'A box\'s class score is its confidence times the class probability. Then threshold, and suppress.', code: ['score', 'nms'] },
        { id: 'fast', say: 'It ran at forty five frames per second, several times faster than Faster {R-CNN|R C N N}, though less accurate.' },
        { id: 'weak', say: 'Its weak spot is small objects in groups. On a three by three grid, the dog and cat share one cell, and one class guess.' },
        { id: 'ssd', say: '{SSD|S S D} keeps the single pass, but predicts from several feature maps, so the finer maps catch small objects.' },
      ],
    },
    {
      id: 'map',
      title: 'Grading a detector: mAP',
      codeTitle: 'average_precision.py',
      code: `
        # ten detections of one class, best first
        tp = np.array([1,1,0,1,1,0,1,0,0,1])     #@tp
        n_gt = 7               # true boxes      #@tp
        tp_cum = np.cumsum(tp)                   #@cum
        fp_cum = np.cumsum(1 - tp)               #@cum
        precision = tp_cum / (tp_cum + fp_cum)   #@prec
        recall = tp_cum / n_gt                   #@rec

        p = np.maximum.accumulate(               #@env
                precision[::-1])[::-1]           #@env
        r = np.concatenate([[0], recall])        #@ap
        ap = np.sum(np.diff(r) * p)  # {{ap:0.70}}   #@ap
        mAP = np.mean(ap_per_class)              #@map
      `,
      beats: [
        { id: 'grade', say: 'How do we grade a whole detector? There is no fixed list of answers.' },
        { id: 'rank', say: 'Collect every detection on the test set, sort by score, and walk down the list.' },
        { id: 'tp', say: 'A detection is a true positive if it overlaps an unclaimed true box of its class with {IoU|eye oh you} of at least one half. Otherwise it is false.', code: 'tp' },
        { id: 'cum', say: 'Keep running totals of both as you walk. That is cumsum.', code: 'cum' },
        { id: 'prec', say: 'Precision asks: of the boxes we reported, what fraction were right?', code: 'prec' },
        { id: 'rec', say: 'Recall asks: of the objects that exist, what fraction did we find?', code: 'rec' },
        { id: 'trade', say: 'Walk further and recall rises, but more junk gets in, so precision tends to fall.' },
        { id: 'env', say: 'Smooth the curve into a staircase that never rises as recall grows.', code: 'env' },
        { id: 'ap', say: 'The area under it is the average precision: one for a perfect detector, {0.7|zero point seven} for this one.', code: 'ap' },
        { id: 'mean', say: 'Average over every class for mean average precision, {mAP|em ay pee}: the headline number for detectors.', code: 'map' },
        { id: 'coco', say: 'COCO also averages over stricter {IoU|eye oh you} cutoffs, rewarding tighter boxes.' },
      ],
    },
    {
      id: 'segment',
      title: 'Semantic segmentation',
      codeTitle: 'fcn.py',
      code: `
        scores = net(img)          # (C, H, W)   #@net
        s = scores - scores.max(0)               #@soft
        logp = s - np.log(np.exp(s).sum(0))      #@soft
        rows, cols = np.indices(labels.shape)    #@pick
        loss = -logp[labels, rows, cols].mean()  #@pick

        f3, f4, f5 = backbone(img)   # 8, 16, 32  #@back
        s = score5(f5)             # (C, 10, 15) #@s32
        s = up(s, 2) + score4(f4)  # (C, 20, 30) #@s16
        s = up(s, 2) + score3(f3)  # (C, 40, 60) #@s8
        s = up(s, {{up:32}})          # full size   #@up
        labels = s.argmax(0)       # per pixel   #@arg
      `,
      beats: [
        { id: 'pixel', say: 'Now the answer is a label for every pixel, and the training data is a label map the size of the image.' },
        { id: 'loss', say: 'And the loss is one you know: the softmax loss, at every pixel, averaged.', code: ['net', 'soft', 'pick'] },
        { id: 'how', say: 'The hard part is a network whose output is a full resolution map.' },
        { id: 'slow', say: 'Classifying a patch around every pixel works, but it is absurdly slow.' },
        { id: 'down', say: 'The design that won: downsample cheaply, then upsample back to full size, inside the network.' },
        { id: 'fcn', say: 'Fully convolutional networks made an ImageNet classifier all convolutions, and added learnable upsampling at the end.', code: ['back', 'up', 'arg'] },
        { id: 'blob', say: 'But its last map has stride thirty two. Upsampled from there, the two people melt into one blob, and the cat loses its ears.', code: ['s32', 'up'] },
        { id: 'skip', say: 'The fix is skip connections: add in scores from earlier, finer layers, at stride sixteen...', code: 's16' },
        { id: 'eight', say: 'and stride eight. Each skip halves the cell size and recovers detail.', code: 's8' },
        { id: 'what', say: 'Deep layers know what. Shallow layers know where. Together, they paint a sharp map.', code: 'arg' },
      ],
    },
    {
      id: 'upsample',
      title: 'Growing a map: upsampling',
      codeTitle: 'upsample.py',
      code: `
        x.repeat(2, 0).repeat(2, 1)   # nearest   #@near
        # bed of nails: a corner, zeros elsewhere  #@nails
        # max unpooling: back where the max was      #@max

        w = np.array([1., 2., 1.])    # filter   #@w
        x = np.array([3., 5.])        # a, b     #@x
        out = np.zeros(5)                        #@stamp
        for i in range(2):                       #@loop
            out[2*i : 2*i+3] += x[i] * w         #@stamp
        # out = [3, 6, 8, 10, 5]                 #@res

        M = np.array([[1, 2, 1, 0, 0],   # conv  #@M
                      [0, 0, 1, 2, 1]])          #@M
        np.allclose(M.T.dot(x), out)     # True  #@T
      `,
      beats: [
        { id: 'grow', say: 'How does a network make a feature map bigger? Two families of layers do it.' },
        { id: 'near', say: 'Unpooling learns nothing. Nearest neighbor copies each value into a two by two block.', code: 'near' },
        { id: 'nails', say: 'Bed of nails puts each value in one corner, with zeros everywhere else.', code: 'nails' },
        { id: 'max', say: 'Max unpooling puts each value back where the max sat during pooling.', code: 'max' },
        { id: 'tconv', say: 'The learnable option is the transpose convolution. A normal convolution reads a window to write one output.' },
        { id: 'rev', say: 'This does the reverse: it reads one input, scales the whole filter by it, and writes that block out.', code: ['w', 'x', 'stamp'] },
        { id: 'stamp', say: 'Input three stamps three, six, three. Step two places, and input five stamps five, ten, five.', code: ['loop', 'stamp'] },
        { id: 'add', say: 'Where stamps overlap, they add: the middle gets three plus five. The output is three, six, eight, ten, five.', code: 'res' },
        { id: 'names', say: 'It is often called deconvolution, which misleads: it does not undo a convolution.' },
        { id: 'why', say: 'Transpose is exact. A stride two convolution is a matrix multiply, and this layer multiplies by its transpose, taking two numbers back up to five.', code: ['M', 'T'] },
        { id: 'learn', say: 'It restores the shape, not the numbers, and its filter is learned like any other weights.' },
        { id: 'checker', say: 'In two dimensions the stamps overlap unevenly, which is why generated images can show faint checkerboards.' },
      ],
    },
    {
      id: 'outro',
      title: 'Instances, and the whole ladder',
      codeTitle: 'recap.py',
      code: `
        dets = faster_rcnn(img)      # boxes     #@det
        for box in dets:                         #@loop
            roi = roi_align(fmap, box)           #@roi
            mask = mask_head(roi)   # per pixel  #@mask

        box = net(img)              # where      #@r1
        iou(box, gt) >= thresh      # a hit      #@r2
        keep = nms(boxes, scores)   # no dupes   #@r2
        t = deltas(anchors, gt)     # nudges     #@r3
        s = up(s, 2) + skip         # detail     #@r4
      `,
      beats: [
        { id: 'inst', say: 'The top rung, instance segmentation, combines the two: find each object, then label its pixels.' },
        { id: 'era', say: 'In 2016 that meant {R-CNN|R C N N} with a mask step bolted on.' },
        { id: 'mask', say: 'A year later, Mask {R-CNN|R C N N} made it standard: Faster {R-CNN|R C N N}, plus a small head that paints a mask inside every box.', code: ['det', 'loop', 'roi', 'mask'] },
        { id: 'recap', say: 'So, the ladder. Localization is regression: four more numbers beside the class.', code: 'r1' },
        { id: 'grade', say: '{IoU|eye oh you} grades a box, suppression removes duplicates, and {mAP|em ay pee} grades a detector.', code: 'r2' },
        { id: 'det', say: 'Detection got practical with proposals, fast with shared convolutions, and faster with anchors. {YOLO|yo-low} and {SSD|S S D} do it in one look.', code: 'r3' },
        { id: 'seg', say: 'And segmentation is classification at every pixel: down, then up, with skips for detail.', code: 'r4' },
        { id: 'next', say: 'Next, open the interactive chapter: drag boxes, step through suppression, and train a tiny detector, with the code beside every figure.' },
        { id: 'bye', say: 'See you there.', pause: 0.6 },
      ],
    },
  ],
};
