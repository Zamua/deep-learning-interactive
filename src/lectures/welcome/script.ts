import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'welcome',
  title: 'How this course works',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'What CS231n is',
      codeTitle: 'cs231n.py',
      code: `
        course = 'CS231n'                   #@course
        title = ('Convolutional Neural '    #@course
                 'Networks for Visual '     #@course
                 'Recognition')             #@course
        term = 'Stanford, Winter 2016'      #@term
        staff = ['Fei-Fei Li',              #@staff
                 'Andrej Karpathy',         #@staff
                 'Justin Johnson']          #@staff

        # one problem: what is in the photo?   #@task
        scores = model(img)   # 10 numbers     #@task
        guess = np.argmax(scores)              #@guess
        # all of it from scratch, in NumPy     #@numpy
      `,
      beats: [
        { id: 'hello', say: 'Welcome to {CS231n|C S two thirty one N}: Convolutional Neural Networks for Visual Recognition.', code: 'course' },
        { id: 'famous', say: 'First taught at Stanford in {2015|twenty fifteen}, it became one of the most influential courses in machine learning.', code: 'course' },
        { id: 'term', say: 'This companion follows the winter {2016|twenty sixteen} run, taught by {Fei-Fei Li|Fay-Fay Lee}, {Andrej Karpathy|Andrey Kar-pah-thee} and Justin Johnson.', code: ['term', 'staff'] },
        { id: 'roles', say: '{Karpathy|Kar-pah-thee} wrote most of the notes, Johnson wrote the assignments, and the two gave most of the lectures.', code: 'staff' },
        { id: 'task', say: 'The course is about one problem above all: image classification. Look at a photo, and say what is in it.', code: 'task' },
        { id: 'guess', say: 'A model turns the photo into ten scores, one per class, and guesses the class that scores highest.', code: ['task', 'guess'] },
        { id: 'scratch', say: 'You build all of it from scratch, in plain {NumPy|num pie}, before moving on to finding objects and captioning photos.', code: 'numpy' },
        { id: 'site', say: 'This unofficial companion follows the same ideas in the same order, but every picture is one you can poke.' },
      ],
    },
    {
      id: 'history',
      title: 'Old ideas, new fuel',
      codeTitle: 'ilsvrc.py',
      code: `
        # ImageNet top-5 error, in percent
        entries = [
            (2010, 'NEC-UIUC',  28.2),   #@e0
            (2011, 'XRCE',      25.8),   #@e1
            (2012, 'AlexNet',   16.4),   #@e2
            (2013, 'ZFNet',     11.7),   #@e3
            (2014, 'VGG',        7.3),   #@e4
            (2014, 'GoogLeNet',  6.7),   #@e5
            (2015, 'ResNet',     3.6),   #@e6
        ]
        human = 5.1   # one trained person   #@human
        errors = [err for _, _, err in entries]  #@errors
        plt.barh(range(7), errors)               #@bars
        plt.axvline(human, ls='--')              #@human
      `,
      beats: [
        { id: 'eyes', say: 'Lecture one starts far back, {540|five hundred and forty} million years ago, when the first eyes may have set off an explosion of animal life.' },
        { id: 'cat', say: 'In {1959|nineteen fifty nine}, Hubel and Wiesel found cells in a cat\'s brain that fire for an edge at one angle.' },
        { id: 'blueprint', say: 'Simple detectors feeding more complex ones: the blueprint of a ConvNet.' },
        { id: 'features', say: 'For decades after, people designed image features by hand, and a simple classifier made the call.' },
        { id: 'imagenet', say: 'Then, in {2009|two thousand nine}, came ImageNet: over fourteen million labeled photos, from {Fei-Fei Li|Fay-Fay Lee}\'s group.', code: 1 },
        { id: 'contest', say: 'Its yearly contest gives a model five guesses per photo, and scores how often all five miss: the top-5 error.', code: 'errors' },
        { id: 'early', say: 'Hand-designed pipelines won the first two years, with errors over twenty five percent.', code: ['e0', 'e1', 'bars'] },
        { id: 'alexnet', say: 'In {2012|twenty twelve}, a ConvNet called {AlexNet|Alex net} cut the error to sixteen percent.', code: 'e2' },
        { id: 'deeper', say: 'Every winner after that was a ConvNet, each deeper than the last.', code: ['e3', 'e4', 'e5'] },
        { id: 'resnet', say: 'By {2015|twenty fifteen}, {ResNet|res net} was at {3.6|three point six} percent, below one trained human\'s {5.1|five point one}.', code: ['e6', 'human'] },
        { id: 'fuel', say: 'The ideas were old. What changed was the fuel: big labeled datasets, fast graphics cards, and a few training tricks.' },
        { id: 'wave', say: '{CS231n|C S two thirty one N} was born in the middle of that wave, to teach these methods.' },
      ],
    },
    {
      id: 'goal',
      title: 'What you will build',
      codeTitle: 'by_the_end.py',
      code: `
        # Assignment 1: classifiers by hand    #@a1
        knn = KNearestNeighbor()               #@knn
        svm = LinearSVM()                      #@lin
        net = TwoLayerNet(3072, 50, 10)        #@net
        loss, grads = net.loss(X, y)           #@net

        # Assignment 2: layers that stack      #@a2
        out, cache = affine_forward(x, w, b)   #@layer
        dx, dw, db = affine_backward(dout,     #@layer
                                     cache)    #@layer
        model = ThreeLayerConvNet()            #@conv

        # Assignment 3: words and gradients    #@a3
        model = CaptioningRNN(word_to_idx)     #@rnn
      `,
      beats: [
        { id: 'end', say: 'By the end, you will have built an image classifier from the ground up, and understood every line.' },
        { id: 'cifar', say: 'Most of the work uses {CIFAR-10|see-far ten}: tiny photos, thirty two pixels square, in ten classes.' },
        { id: 'knn', say: 'You start with the simplest idea: label a photo by finding the most similar one you have already seen.', code: 'knn' },
        { id: 'lin', say: 'Then a linear classifier: one matrix multiply that scores every class at once.', code: 'lin' },
        { id: 'net', say: 'Then a neural network, trained with backpropagation: the chain rule, run backward through every layer.', code: 'net' },
        { id: 'conv', say: 'Next, you split it into layers, each with a forward and a backward pass, and stack them into a ConvNet.', code: ['layer', 'conv'] },
        { id: 'rnn', say: 'Last come networks that caption photos, and tools for looking inside a trained network.', code: 'rnn' },
        { id: 'three', say: 'Those are the three {2016|twenty sixteen} assignments, and each one builds on the last.', code: ['a1', 'a2', 'a3'] },
      ],
    },
    {
      id: 'layers',
      title: 'Watch, explore, practice',
      codeTitle: 'chapter.py',
      code: `
        for chapter in course:                 #@loop
            # 1. sit back: voice, pictures, code   #@watch
            watch(chapter.lecture)             #@watch
            # 2. drag, step and poke every figure  #@explore
            explore(chapter.page)              #@explore
            # 3. write the code yourself       #@practice
            practice(chapter.assignment)       #@practice
      `,
      beats: [
        { id: 'three', say: 'Every chapter comes in three layers, and you can use as many as you like.', code: 'loop' },
        { id: 'watch', say: 'The first is a narrated lecture like this one: the voice carries the ideas, and the pictures and code move with it.', code: 'watch' },
        { id: 'lunch', say: 'It is made to be watched hands-off. Tap the picture to pause, and hold it for double speed.', code: 'watch' },
        { id: 'explore', say: 'The second is the chapter itself, where every figure is live: drag it or step it, and the code follows along.', code: 'explore' },
        { id: 'practice', say: 'The third is practice: the {2016|twenty sixteen} assignment that goes with the chapter, where you write the code yourself.', code: 'practice' },
        { id: 'teach', say: 'Watching builds the intuition, exploring makes it solid, and writing the code is what really teaches.', code: 'loop' },
      ],
    },
    {
      id: 'figures',
      title: 'Code beside every figure',
      codeTitle: 'brighten.py',
      code: `
        img = np.array(smiley, dtype=float)  #@load
        gain = {{gain:1.5}}   # the slider            #@gain
        img = img * gain            # brighten  #@scale
        img = np.clip(img, 0, 255)  # cap it    #@clip
        mean = img.mean()           # {{mean:130.8}}  #@mean
      `,
      beats: [
        { id: 'promise', say: 'Now, how to read the site. The promise: no picture ever appears without the code that computes it.' },
        { id: 'beside', say: 'On a wide screen the code sits beside the figure; on a phone, right underneath, like here.' },
        { id: 'real', say: 'It is real code, in the style of the assignments: {NumPy|num pie} arrays, short lines, names that match the math.', code: 'load' },
        { id: 'pixels', say: 'Take a tiny example: brightening an eight by eight picture. Each number is a pixel, from zero, black, to {255|two fifty five}, white.', code: 'load' },
        { id: 'lit', say: 'When a figure steps through an algorithm, the running line lights up. This one multiplies every pixel by the gain.', code: 'scale' },
        { id: 'live', say: 'Drag a slider, and its number in the code moves too. Push the gain past two, and some pixels overflow.', code: 'gain' },
        { id: 'clip', say: 'The next line lights up and cuts them back to {255|two fifty five}.', code: 'clip' },
        { id: 'mean', say: 'Even the comment on the last line keeps up. The picture and the code always describe the same computation.', code: 'mean' },
      ],
    },
    {
      id: 'colors',
      title: 'Colors link math and code',
      codeTitle: 'top5_error.py',
      code: `
        # scores: (N, 1000) class scores        #@shapes
        # y: (N,) the correct labels            #@shapes
        top5 = np.argsort(-scores, axis=1)[:, :5]  #@top5
        hit = (top5 == y[:, None]).any(axis=1)  #@hit
        err = 1.0 - hit.mean()   # missed       #@err
      `,
      beats: [
        { id: 'color', say: 'The quantities that matter each get a color, and that color means the same thing everywhere.' },
        { id: 'eq', say: 'Here is the top-5 error as an equation: the scores in purple, the correct label in gold, the error in red.', code: 'shapes' },
        { id: 'code', say: 'The code wears the same colors: scores, y and err, line by line.', code: ['top5', 'hit', 'err'] },
        { id: 'tap', say: 'In a chapter, hover or tap a colored symbol, and every appearance of it lights up.', code: 'err' },
        { id: 'habit', say: 'The colors follow one habit across the course: weights are blue, inputs orange, biases green, and scores purple.' },
        { id: 'habit2', say: 'Losses are red, gradients teal, labels gold, and hand-set knobs, like that gain, are slate.' },
        { id: 'cards', say: 'Display equations come in a card: the equation, piece by piece, the same thing in code, and plain words.' },
        { id: 'skip', say: 'If your eyes glaze over, skip straight to the plain words, then come back.' },
      ],
    },
    {
      id: 'map',
      title: 'The map',
      codeTitle: 'map.py',
      code: `
        parts = {
            'Start here': [0, 1, 2],              #@start
            'Neural networks': range(3, 11),      #@nn
            'Convolutional networks':             #@conv
                range(11, 15),                    #@conv
            'Beyond still images': [15, 16, 17],  #@beyond
            'Assignments': ['A1', 'A2', 'A3'],    #@asg
        }
        here = parts['Start here'][0]   # 0       #@here
      `,
      beats: [
        { id: 'five', say: 'Last, the map. The course has five parts.' },
        { id: 'start', say: 'Start here is this page plus two toolkits, the math survival kit and Python with {NumPy|num pie}, to come back to whenever you need.', code: 'start' },
        { id: 'nn', say: 'Neural networks is the core, best read in order: from the simplest classifier to backpropagation.', code: 'nn' },
        { id: 'conv', say: 'Convolutional networks covers networks built for images: how they work, what they learn, and how they find objects.', code: 'conv' },
        { id: 'beyond', say: 'Beyond still images adds sequences, attention, video, and learning without labels.', code: 'beyond' },
        { id: 'asg', say: 'And the assignment pages describe each {2016|twenty sixteen} assignment, linked to the chapters that teach it.', code: 'asg' },
        { id: 'recap', say: 'That is the course: one problem, from first principles, with code beside every picture.' },
        { id: 'next', say: 'Next, open the interactive chapter and poke the ImageNet chart and the brightening demo yourself. Then try the math survival kit.', code: 'here' },
        { id: 'bye', say: 'See you there.', pause: 0.6 },
      ],
    },
  ],
};
