import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-overfitting',
  title: 'Overfitting',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'splits',
      title: 'Three splits',
      codeTitle: 'split.py',
      code: `
        idx = np.random.permutation(50000)   #@data
        train = idx[:40000]      # 80%       #@train
        val = idx[40000:45000]   # 10%       #@val
        test = idx[45000:]       # 10%       #@test
      `,
      beats: [
        { id: 'data', say: 'Before training, shuffle the data and split it three ways. Here are fifty thousand examples.', code: 'data' },
        { id: 'train', say: 'Most of them, say eighty percent, or forty thousand, are the training split. Every gradient comes from these.', code: 'train' },
        { id: 'val', say: 'Ten percent, five thousand, are the validation split. They make the choices: when to stop, which learning rate, which batch size.', code: 'val' },
        { id: 'test', say: 'The last ten percent is the test split. It is used once, at the very end, to report how the model does on data it has never seen.', code: 'test' },
      ],
    },
    {
      id: 'curves',
      title: 'Train down, validation up',
      codeTitle: 'train.py',
      code: `
        per_example = [0.2, 1.5, 0.4]       #@loss
        L = np.mean(per_example)   # 0.7    #@avg
        for epoch in range(16):
            train_one_epoch(model, train)   #@fit
            L_train = loss(model, train)    #@both
            L_val = loss(model, val)        #@both
        # L_train keeps falling             #@gap
        # L_val bottoms out, then climbs    #@gap
      `,
      beats: [
        { id: 'loss', say: 'Training lowers a function called the loss, L. Each example adds a number for how wrong the model is on it: zero when it is exactly right, bigger the more wrong it is.', code: 'loss' },
        { id: 'avg', say: 'The loss is the average of those numbers. Three examples at {0.2|zero point two}, {1.5|one point five} and {0.4|zero point four} give a loss of {0.7|zero point seven}. Lower is better.', code: 'avg' },
        { id: 'both', say: 'Train, and after every epoch measure the loss on both splits: averaged over the training examples, and over the validation examples.', code: ['fit', 'both'] },
        { id: 'early', say: 'At first they fall together. The model is learning patterns that hold for every example.', code: 'both' },
        { id: 'gap', say: 'Then they part. The training loss keeps falling, but the validation loss turns and climbs.', code: 'gap' },
        { id: 'memo', say: 'That is overfitting. The model is memorizing its training examples, quirks and all, and getting worse on everything else.', code: 'gap' },
        { id: 'blind', say: 'The training loss alone can never show it, because it only measures examples the model has already fit.', code: 'both' },
      ],
    },
    {
      id: 'stop',
      title: 'When to stop',
      codeTitle: 'stop.py',
      code: `
        # epoch: 2, 4, 6, 8, 10, 12          #@table
        best = np.argmin(val_losses)   # 8   #@min
        model = checkpoints[best]            #@keep
        # start 2.3; a good model: about 0.4 #@good
        # 1.9 and 2.0: underfitting          #@under
        # 0.1 and 1.3: overfitting           #@over
        # 0.4 and 0.5: fits well             #@fine
      `,
      beats: [
        { id: 'table', say: 'Here are the numbers, every two epochs.', code: 'table' },
        { id: 'min', say: 'The validation loss bottoms out at epoch eight, at {1.07|one point oh seven}, while the training loss keeps falling.', code: 'min' },
        { id: 'keep', say: 'So keep the weights from epoch eight. Past it, more training only makes the model worse on new data. This is early stopping.', code: 'keep' },
        { id: 'good', say: 'Now judge a finished model by its numbers. Say training started at a loss of {2.3|two point three}, and a good model on this data reaches about {0.4|zero point four}.', code: 'good' },
        { id: 'under', say: 'Training ends at {1.9|one point nine} and validation at two: both far above {0.4|zero point four}, and close together. The model has not even fit its training data. That is underfitting, the opposite failure.', code: 'under' },
        { id: 'over', say: 'Training at {0.1|zero point one}, but validation at {1.3|one point three}: the model fits its own examples and not new ones. That gap is overfitting.', code: 'over' },
        { id: 'fine', say: '{0.4|Zero point four} and {0.5|zero point five}: near what a good model reaches, and close together. That is the goal: the model does about as well on new examples as on the ones it trained on.', code: 'fine' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
