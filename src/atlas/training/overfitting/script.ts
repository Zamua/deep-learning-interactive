import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-overfitting',
  title: 'Overfitting',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'fit',
      title: 'Fitting too well',
      codeTitle: 'fit.py',
      code: `
        # guess: the curve's height at x  #@model
        miss = guess - answer             #@miss
        L = np.mean(miss ** 2)            #@L
        w = w - lr * grad                 #@train
        L_new = np.mean(new_miss ** 2)    #@new
      `,
      beats: [
        { id: 'dots', say: 'Learning from examples is meant to pay off on new ones. Here are eight examples. Each pairs an input, how far across, with the right answer for it, how high.', code: 'miss' },
        { id: 'model', say: 'A model is a function that turns an input into a guess at its answer. Here, its guesses trace this curve.', code: 'model' },
        { id: 'weights', say: 'Its adjustable numbers, the entries of w, are called its weights. Change them, and the curve changes shape.', code: 'train' },
        { id: 'miss', say: 'The gap between a dot and the curve is how wrong the model is on that example. Squaring it makes a miss above count the same as one below.', code: 'miss' },
        { id: 'loss', say: 'Average the squared misses, and you have the loss, L: the function built from examples that gradient descent lowers.', code: 'L' },
        { id: 'train', say: 'Lowering the loss, step after step, is called training. The curve bends toward the dots, and the misses shrink.', code: 'train' },
        { id: 'pattern', say: 'Now it follows the pattern the dots share. What it still misses is each example\'s own quirk: random scatter that new examples will not repeat.', code: 'miss' },
        { id: 'wiggle', say: 'Keep training, and it does not stop there. The curve bends through every dot, quirks and all, until the loss on these eight is zero.', code: ['L', 'train'] },
        { id: 'new', say: 'Now bring in new examples, from the same source but never trained on. The wiggly curve misses them badly, far worse than the plain one did.', code: 'new' },
        { id: 'name', say: 'That is overfitting: fitting the training examples so closely that the model learns their quirks, and does worse on new ones. Their own loss cannot show it: it says zero.', code: ['L', 'new'] },
      ],
    },
    {
      id: 'curves',
      title: 'Train down, validation up',
      codeTitle: 'train.py',
      code: `
        for epoch in range(16):            #@fit
            train_one_epoch(model, train)  #@fit
            L_train = loss(model, train)   #@both
            L_val = loss(model, val)       #@both
        # L_train keeps falling            #@gap
        # L_val turns and climbs           #@gap
      `,
      beats: [
        { id: 'hold', say: 'So before training, hold some examples back, to stand in for new ones.', code: 'fit' },
        { id: 'val', say: 'They are called validation examples, because they validate the model: they check it on data it never trained on.', code: 'both' },
        { id: 'both', say: 'After every epoch, measure the loss twice: averaged over the training examples, and over the validation examples.', code: 'both' },
        { id: 'early', say: 'At first they fall together: the model is learning the pattern, which holds for every example.', code: 'both' },
        { id: 'gap', say: 'Then they part. The training loss keeps falling, but the validation loss turns and climbs: the model has started fitting quirks.', code: 'gap' },
        { id: 'blind', say: 'That widening gap is overfitting, made visible. The training loss alone would never show it.', code: 'gap' },
      ],
    },
    {
      id: 'splits',
      title: 'Three splits',
      codeTitle: 'split.py',
      code: `
        idx = np.random.permutation(50000)   #@data
        train = idx[:40000]      # 80%       #@train
        val = idx[40000:45000]   # 10%       #@val
        test = idx[45000:]       # 10%       #@test
        n_val = 0.1 * (50000 - 5000) # 4500  #@rest
      `,
      beats: [
        { id: 'data', say: 'In practice, shuffle the data and split it three ways. Here are fifty thousand examples.', code: 'data' },
        { id: 'train', say: 'Most of them, say eighty percent, or forty thousand, are the training split. Every gradient comes from these.', code: 'train' },
        { id: 'val', say: 'Ten percent, five thousand, are the validation split. Every choice is made on them: when to stop, which learning rate, which batch size.', code: 'val' },
        { id: 'test', say: 'Choosing on them tunes the model to them a little, so the last ten percent, the test split, stays untouched until the end: it is used once, for the number you report.', code: 'test' },
        { id: 'rest', say: 'Sometimes the test split comes out first, and validation takes a share of the rest: ten percent of the remaining forty five thousand is four thousand five hundred.', code: 'rest' },
      ],
    },
    {
      id: 'stop',
      title: 'When to stop',
      codeTitle: 'stop.py',
      code: `
        checkpoints[epoch] = w.copy()       #@save
        best = epochs[np.argmin(L_vals)]  # 8  #@min
        w = checkpoints[best]               #@keep
        # start 2.3; a good model: 0.4      #@good
        # 1.9 and 2.0: underfitting         #@under
        # 0.1 and 1.3: overfitting          #@over
        # 0.4 and 0.5: fits well            #@fine
      `,
      beats: [
        { id: 'save', say: 'Every two epochs, save a copy of the weights, called a checkpoint, and note both losses.', code: 'save' },
        { id: 'min', say: 'The validation loss is lowest at epoch eight, at {1.07|one point oh seven}. After that it climbs, while the training loss keeps falling to the end.', code: 'min' },
        { id: 'keep', say: 'So keep the checkpoint from epoch eight, not the last one. That is early stopping: stop where the validation loss bottoms out.', code: 'keep' },
        { id: 'good', say: 'The final losses also diagnose a model. Say the loss started at {2.3|two point three}, and a good model on this data reaches about {0.4|zero point four}.', code: 'good' },
        { id: 'ask', say: 'Ask two things. Did the training loss get down near that? And is the validation loss close behind it?', code: 'good' },
        { id: 'under', say: 'Here both stall near two: close together, but far above a good model. It has not even fit its training examples. That is underfitting, the opposite failure.', code: 'under' },
        { id: 'over', say: 'Here training ends at {0.1|zero point one}, but validation at {1.3|one point three}. It fits its own examples and not new ones: a big gap, overfitting.', code: 'over' },
        { id: 'fine', say: 'And here, {0.4|zero point four} and {0.5|zero point five}: near a good model, and close together. That is the goal: about as good on new examples as on the ones it trained on.', code: 'fine' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
