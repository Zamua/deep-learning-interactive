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
        for epoch in range(16):
            train_one_epoch(model, train)   #@fit
            L_train = loss(model, train)    #@both
            L_val = loss(model, val)        #@both
        # L_train keeps falling             #@gap
        # L_val bottoms out, then climbs    #@gap
      `,
      beats: [
        { id: 'both', say: 'Train, and after every epoch measure the loss on both splits.', code: ['fit', 'both'] },
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
        # both high and close: underfitting  #@under
        # both low and close: fits well      #@fine
      `,
      beats: [
        { id: 'table', say: 'Here are the numbers, every two epochs.', code: 'table' },
        { id: 'min', say: 'The validation loss bottoms out at epoch eight, at {1.07|one point oh seven}, while the training loss keeps falling.', code: 'min' },
        { id: 'keep', say: 'So keep the weights from epoch eight. Past it, more training only makes the model worse on new data. This is early stopping.', code: 'keep' },
        { id: 'under', say: 'The opposite failure is underfitting: both losses stay high, and close together, because the model has not even fit its training data.', code: 'under' },
        { id: 'fine', say: 'Low and close together is the goal: the model does about as well on new examples as on the ones it trained on.', code: 'fine' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
