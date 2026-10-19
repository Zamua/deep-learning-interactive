import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'nn-learning',
  title: 'Training: updates, monitoring, tuning',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Tending the experiment',
      codeTitle: 'training_run.py',
      code: `
        model = TwoLayerNet(D, H, C)  # Ch 7, 8   #@have
        grad_check(model)             # check     #@check
        sanity_check(model)           # check     #@check

        for epoch in range(num_epochs):           #@loop
            loss, grads = model.loss(X, y)  # Ch 6  #@have,loop
            adam_update(model, grads)  # update   #@update
            log(loss, train_acc, val_acc)  # watch  #@watch
            learning_rate *= 0.95      # decay    #@decay

        best = random_search(space)   # search    #@search
        probs = np.mean(P, axis=0)    # ensemble  #@ens
      `,
      beats: [

        { id: 'hello', say: 'Welcome to training, the part of deep learning that takes most of the actual time.' },
        { id: 'have', say: 'You already have the ingredients: an architecture, prepared data, a starting point for the weights, a loss, and backprop for its gradient.', code: 'have' },
        { id: 'tend', say: 'But a training run is less like running a program, and more like tending an experiment.', code: 'loop' },
        { id: 'check', say: 'Before it starts, you check the gradients, and the untrained network.', code: 'check' },
        { id: 'watch', say: 'While it runs, you watch the curves, for a bad learning rate or for overfitting.', code: 'watch' },
        { id: 'update', say: 'You pick a smarter update rule, and you lower the learning rate as you go.', code: ['update', 'decay'] },
        { id: 'search', say: 'You search for good settings of the knobs. And at the end, you average several models.', code: ['search', 'ens'] },
        { id: 'go', say: 'Let us take them in order, starting where the bugs hide: the gradient.' },
      ],
    },
    {
      id: 'gradcheck',
      title: 'Checking the gradient',
      codeTitle: 'gradient_check.py',
      code: `
        def num_grad(f, x, h=1e-5):
            grad = np.zeros_like(x)
            for ix in np.ndindex(x.shape):        #@loop
                old = x[ix]                       #@loop
                x[ix] = old + h                   #@plus
                fxph = f(x)          # f(x + h)   #@plus
                x[ix] = old - h                   #@minus
                fxmh = f(x)          # f(x - h)   #@minus
                x[ix] = old          # restore    #@restore
                grad[ix] = (fxph - fxmh) / (2 * h)  #@slope
            return grad

        # one-sided, less accurate:               #@one
        # (f(x + h) - f(x)) / h                   #@one
      `,
      beats: [

        { id: 'bug', say: 'Backprop code is easy to get subtly wrong: a missing transpose, a lost factor of two, a flipped sign.' },
        { id: 'hide', say: 'And a buggy gradient often still lowers the loss a little, so the bug can hide for a long time.' },
        { id: 'defense', say: 'The defense is a gradient check: compute the gradient a second, slow but nearly foolproof way, and compare.' },
        { id: 'nudge', say: 'That second way is the definition of the derivative: nudge one parameter, and see how much the loss moves.', code: 'loop' },
        { id: 'both', say: 'Nudge it up by a tiny step h, and evaluate the loss. Nudge it down by h, and evaluate again.', code: ['plus', 'minus'] },
        { id: 'rise', say: 'Rise over run is the slope of the line through those two points. As h shrinks, the line hugs the curve, and its slope becomes the derivative.', code: 'slope' },
        { id: 'one', say: 'Why nudge both ways? Because the one-sided version is off by an amount proportional to h.', code: 'one' },
        { id: 'bend', say: 'Near any point, a smooth curve bends like a parabola. Stepping both ways, that bend cancels out.', code: 'slope' },
        { id: 'table', say: 'Shrink h a hundredfold, and the one-sided error shrinks a hundredfold. The centered one shrinks ten thousandfold: it goes like h squared.', code: ['slope', 'one'] },
        { id: 'cost', say: 'It costs two loss evaluations per parameter: far too slow for training, but fine for a check.', code: ['plus', 'minus', 'restore'] },
      ],
    },
    {
      id: 'relerr',
      title: 'Relative error, and three traps',
      codeTitle: 'rel_error.py',
      code: `
        num = num_grad(f, x)                    #@num
        ana = analytic_grad(x)    # backprop    #@ana
        top = np.abs(ana - num)                 #@top
        bottom = np.maximum(np.abs(ana),        #@bot
                            np.abs(num))        #@bot
        rel = top / bottom                      #@rel
        print(rel.max())          # worst entry #@max

        x = x.astype(np.float64)  # precision   #@f64
        h = 1e-5                  # sweet spot  #@h
        X_few, y_few = X[:3], y[:3]  # few kinks #@few
        loss, _ = model.loss(X_few, y_few,      #@reg
                             reg=0.0)           #@reg
      `,
      beats: [

        { id: 'two', say: 'Now we have two gradients, numerical and analytic. How do we compare them?', code: ['num', 'ana'] },
        { id: 'plain', say: 'Not by their plain difference. A gap of {10⁻⁴|ten to the minus four} is a one percent disagreement between gradients near a hundredth, and nothing at all between gradients in the thousands.', code: 'top' },
        { id: 'rel', say: 'So divide by the larger of the two: that is the relative error. Then report the worst entry.', code: ['bot', 'rel', 'max'] },
        { id: 'thumbs', say: 'Rules of thumb: above {10⁻²|ten to the minus two}, the gradient is probably wrong, and down to {10⁻⁴|ten to the minus four}, uncomfortable. Below {10⁻⁷|ten to the minus seven}, be happy.', code: 'max' },
        { id: 'thumbs2', say: 'In between is fine for functions with kinks, like {ReLU|ray-loo}, but too high for smooth ones.', code: 'max' },
        { id: 'precision', say: 'Three traps make a correct gradient look wrong. First, precision: in single precision, a correct check can be off by a percent. Use double.', code: 'f64' },
        { id: 'hstep', say: 'Second, the step h. Too large, and the line is a poor stand-in for the curve. Too small, and subtracting two nearly equal numbers wipes out their digits.', code: 'h' },
        { id: 'sweet', say: 'In double precision, the sweet spot is around {10⁻⁶|ten to the minus six} to {10⁻⁵|ten to the minus five}.', code: 'h' },
        { id: 'kink', say: 'Third, kinks. {ReLU|Ray-loo}, hinges and max pooling have corners where the slope jumps. If the two nudges straddle one, the check fails, though backprop is right.' },
        { id: 'habits', say: 'So check on two or three examples, with regularization and dropout off. Train briefly first, and test a few entries of every parameter array.', code: ['few', 'reg'] },
      ],
    },
    {
      id: 'sanity',
      title: 'Sanity checks before learning',
      codeTitle: 'sanity.py',
      code: `
        loss, _ = model.loss(X, y, reg=0.0)     #@init
        print(loss)          # softmax: ~2.302  #@init
        print(-np.log(1.0 / 10))   # 2.302585   #@ln
        # SVM, delta = 1: (10 - 1) * 1 = 9      #@svm

        loss_big, _ = model.loss(X, y, reg=1e3) #@reg2
        # loss_big > loss, or reg is not used   #@reg2

        model.reg = {{reg:0.0}}         # no reg     #@tiny
        X_t, y_t = X[:20], y[:20]   # 20 only   #@tiny
        for it in range({{it:0}}):                     #@fit
            loss, grads = model.loss(X_t, y_t)  #@fit
            adam_update(model, grads)           #@fit
        # loss {{loss:1.099}}, train acc {{acc:45%}}  #@res
      `,
      beats: [

        { id: 'three', say: 'Before a long run, three quick sanity checks, each one catching a whole family of bugs.' },
        { id: 'uniform', say: 'One: is the starting loss right? With small random weights, all scores are near zero, so every class gets the same probability: one in ten, for {CIFAR-10|see-far ten}.', code: 'init' },
        { id: 'ln', say: 'The softmax loss is minus the log of that, so it should start near {2.302|two point three oh two}. For the SVM, nine wrong classes each miss the margin by one: nine.', code: ['ln', 'svm'] },
        { id: 'off', say: 'If you see {0.5|zero point five}, or forty, something is off, often weights that start too large.', code: 'init' },
        { id: 'reg', say: 'Two: turn the regularization way up. The loss should rise. If not, the penalty never reached the loss.', code: 'reg2' },
        { id: 'tiny', say: 'Three, the most telling: take twenty examples, turn regularization off, and train.', code: 'tiny' },
        { id: 'memo', say: 'A working network easily memorizes twenty points: the loss falls to nearly zero, and training accuracy hits a hundred percent.', code: ['fit', 'res'] },
        { id: 'stall', say: 'With even a little regularization, it can no longer memorize them.', code: ['tiny', 'res'] },
        { id: 'converse', say: 'Passing this check proves little, but failing it proves a bug. Do not move on until it passes.' },
      ],
    },
    {
      id: 'losscurve',
      title: 'Reading the loss curve',
      codeTitle: 'train_lr.py',
      code: `
        learning_rate = {{lr:0.5}}   # {{name:good}}  #@lr
        B = {{B:32}}                    # batch size  #@B
        for epoch in range(40):                  #@epoch
            for it in range(N // B):             #@epoch
                idx = np.random.choice(N, B)     #@batch
                Xb, yb = X[idx], y[idx]          #@batch
                loss, grads = model.loss(Xb, yb) #@loss
                for k, W in model.params.items():  #@upd
                    W -= learning_rate * grads[k]  #@upd
            log(epoch, full_loss(model))         #@log
      `,
      beats: [

        { id: 'watch', say: 'Once the checks pass, train, and watch. Plot against epochs, full passes over the training set, so the axis means the same whatever the batch size.', code: 'epoch' },
        { id: 'four', say: 'Here are four copies of one network on the spiral data, differing only in their learning rate.', code: ['lr', 'log'] },
        { id: 'low', say: 'A low rate improves slowly, almost in a straight line.', code: 'lr' },
        { id: 'good', say: 'A good rate drops quickly, and keeps improving.', code: 'lr' },
        { id: 'high', say: 'A high rate drops fast, then stalls at a worse level, bouncing: every step overshoots the narrow parts of the landscape.', code: ['lr', 'upd'] },
        { id: 'vhigh', say: 'A very high rate makes the loss climb, often to infinity, or to not a number.', code: 'lr' },
        { id: 'wiggle', say: 'The wiggle from batch to batch reflects the batch size: tiny batches are noisy, and the full dataset is smooth.', code: ['B', 'batch'] },
        { id: 'plateau', say: 'A long plateau, then a sudden drop, usually means a bad initialization.' },
        { id: 'logscale', say: 'Some people plot the loss on a log scale, where roughly exponential progress looks closer to a straight line.', code: 'log' },
      ],
    },
    {
      id: 'gap',
      title: 'Train versus validation',
      codeTitle: 'monitor.py',
      code: `
        def acc(X, y):                             #@acc
            return np.mean(model.predict(X) == y)  #@acc

        tr, va = acc(X_tr, y_tr), acc(X_va, y_va)  #@trva
        print(tr - va)      # the gap: {{gap:0}} pts    #@gap

        W, dW = model.params['W1'], grads['W1']    #@ratio
        update = -learning_rate * dW               #@ratio
        u_norm = np.linalg.norm(update)            #@ratio
        w_norm = np.linalg.norm(W)                 #@ratio
        print(u_norm / w_norm)   # want ~1e-3      #@want

        plt.hist(hidden.ravel(), bins=50)          #@hist
        show_images(W.T.reshape(-1, 32, 32, 3))    #@filt
      `,
      beats: [

        { id: 'second', say: 'The second plot is accuracy, on the training set and on a validation set, every epoch or so.', code: ['acc', 'trva'] },
        { id: 'task', say: 'This network separates two classes along a wavy border, from sixty training points, one in ten of them mislabeled.' },
        { id: 'over', say: 'Training accuracy reaches a hundred percent, as the regions contort around every point. Validation stalls near seventy six.', code: 'trva' },
        { id: 'gapmeans', say: 'That gap is overfitting: the network memorized, instead of learning the pattern.', code: 'gap' },
        { id: 'fix', say: 'Cure it with more regularization, or more data. Here a stronger penalty smooths the regions, and validation rises to eighty five.', code: 'gap' },
        { id: 'lin', say: 'A linear model shows the opposite: no gap, but both stuck near seventy eight. It lacks capacity, so make it bigger.', code: ['trva', 'gap'] },
        { id: 'ratio', say: 'Also track each update\'s size relative to the weights it changes. It should be near a thousandth. In our runs, the low rate sat ten times below that, and the high ones ten times above.', code: ['ratio', 'want'] },
        { id: 'hist', say: 'Histograms of each layer\'s activations reveal a bad initialization. With {tanh|tan h}, you want a spread from minus one to one, not a spike at zero, or piles at the ends.', code: 'hist' },
        { id: 'filt', say: 'And for images, view the first layer\'s weights as pictures: noisy speckles are a warning, smooth and varied filters a good sign.', code: 'filt' },
      ],
    },
    {
      id: 'momentum',
      title: 'SGD, momentum and Nesterov',
      codeTitle: 'sgd_momentum.py',
      code: `
        # vanilla update
        w += -learning_rate * dw                 #@sgd

        # momentum: v is a velocity, from 0      #@v
        v = mu * v - learning_rate * dw          #@v
        w += v                                   #@w

        # Nesterov: gradient at the look-ahead   #@ahead
        w_ahead = w + mu * v                     #@ahead
        v = mu * v - learning_rate * dw_ahead    #@nv
        w += v                                   #@nw
      `,
      beats: [

        { id: 'what', say: 'Backprop gives the gradient. The update rule decides what to do with it.' },
        { id: 'sgd', say: 'Vanilla gradient descent steps straight down the slope: the weights, minus the learning rate times the gradient.', code: 'sgd' },
        { id: 'zig', say: 'In a long, narrow valley, a very common shape, the slope points mostly across the valley, not along it. So it zigzags between the walls, and creeps along the floor.', code: 'sgd' },
        { id: 'ball', say: 'Momentum borrows from physics: the parameters are a ball rolling on the landscape. The gradient is a force that changes its velocity, and the velocity moves it.', code: ['v', 'w'] },
        { id: 'cancel', say: 'Pushes from the two walls alternate and cancel, while the steady push along the floor adds up, so the ball gains speed where it matters.', code: ['v', 'w'] },
        { id: 'mu', say: 'Mu acts like friction, shrinking the old velocity every step. A common choice is {0.9|zero point nine}, which lets the steps grow up to ten times larger.', code: 'v' },
        { id: 'overshoot', say: 'But a rolling ball also overshoots, and has to swing back.', code: 'w' },
        { id: 'nesterov', say: 'Nesterov\'s twist: momentum alone will carry the ball by mu times v anyway, so measure the gradient there, at the look-ahead point.', code: ['ahead', 'nv'] },
        { id: 'ahead', say: 'If the ball is about to overshoot, that gradient already says so, and it brakes in time. It consistently works a little better.', code: ['nv', 'nw'] },
      ],
    },
    {
      id: 'adaptive',
      title: 'A step size for every parameter',
      codeTitle: 'adaptive.py',
      code: `
        # Adagrad: a running sum of squares      #@ada
        cache += dw ** 2                         #@ada
        # RMSprop: a moving average instead      #@rms
        cache = (decay * cache                   #@rms
                 + (1 - decay) * dw ** 2)        #@rms
        # both: divide by the typical size       #@div
        w -= lr * dw / (np.sqrt(cache) + eps)    #@div

        # Adam: momentum and RMSprop together
        m = beta1 * m + (1 - beta1) * dw         #@m
        v = beta2 * v + (1 - beta2) * dw ** 2    #@v
        mt = m / (1 - beta1 ** t)   # bias       #@bias
        vt = v / (1 - beta2 ** t)   # correction #@bias
        w -= lr * mt / (np.sqrt(vt) + eps)       #@step
      `,
      beats: [

        { id: 'one', say: 'So far, every parameter shares one learning rate. Adaptive methods give each parameter its own step size, from the history of its gradients.' },
        { id: 'ada', say: 'Adagrad keeps a running sum of each parameter\'s squared gradients, the cache, and divides every step by its square root.', code: ['ada', 'div'] },
        { id: 'norm', say: 'That normalizes each gradient by its typical size, so every parameter moves by roughly the learning rate, steep or shallow.', code: 'div' },
        { id: 'valley', say: 'In the valley, the steep direction is tamed, and the shallow one sped up: no more zigzag.', code: 'div' },
        { id: 'decay', say: 'The catch: the sum only grows, so the steps keep shrinking, and learning stops too early.', code: 'ada' },
        { id: 'rms', say: 'RMSprop, from a lecture slide by Geoff Hinton, swaps the sum for a moving average, so the step size can adapt up as well as down.', code: 'rms' },
        { id: 'adam', say: 'Adam combines both ideas: a moving average of the gradient, like momentum, divided by the root of a moving average of its square, like RMSprop.', code: ['m', 'v', 'step'] },
        { id: 'bias', say: 'Both averages start at zero, so early on they are too small. Dividing by one minus beta to the t corrects that.', code: 'bias' },
        { id: 'defaults', say: 'With betas of {0.9|zero point nine} and {0.999|zero point nine nine nine}, Adam is the usual default.', code: ['m', 'v'] },
        { id: 'saddle', say: 'Adaptive steps shine on a saddle, a ridge falling away on both sides. Everyone starts just off its top, where the sideways gradient is tiny.' },
        { id: 'escape', say: 'SGD and momentum barely move. Adagrad, RMSprop and Adam divide that tiny gradient by its own size, and escape quickly.', code: ['div', 'step'] },
      ],
    },
    {
      id: 'anneal',
      title: 'Annealing the learning rate',
      codeTitle: 'schedules.py',
      code: `
        lr0, k = 0.15, 0.005
        constant = lambda t: lr0                 #@const
        step = lambda t: lr0 * 0.5 ** (t // 150) #@step
        expo = lambda t: lr0 * np.exp(-k * t)    #@exp
        inv_t = lambda t: lr0 / (1 + k * t)      #@inv

        for t in range(800):                     #@loop
            noise = 1.5 * np.random.randn(2)     #@noise
            dw = grad(w) + noise  # mini-batch   #@noise
            w -= schedule(t) * dw                #@upd
        # t = {{t:0}}                              #@loop
      `,
      beats: [

        { id: 'bounce', say: 'With a constant learning rate, noisy mini-batch gradients keep kicking the parameters out of the narrow bottom.', code: ['const', 'noise'] },
        { id: 'floor', say: 'So the loss flattens out at a noise floor.', code: ['const', 'upd'] },
        { id: 'lower', say: 'The fix: lower the learning rate as training goes on, so the parameters can settle.', code: 'upd' },
        { id: 'step', say: 'Step decay halves it every so often: here, every hundred and fifty steps.', code: 'step' },
        { id: 'exp', say: 'Exponential decay shrinks it by the same factor every step.', code: 'exp' },
        { id: 'inv', say: 'One over t decay shrinks it fast at first, then ever more slowly.', code: 'inv' },
        { id: 'settle', say: 'Each decaying schedule keeps settling, long after the constant rate has stalled.', code: 'upd' },
        { id: 'timing', say: 'But decay too fast, and the system cools before it reaches the bottom.', code: 'exp' },
        { id: 'practice', say: 'Step decay is the most common. A good habit: halve the rate whenever the validation error stops improving.', code: 'step' },
      ],
    },
    {
      id: 'newton',
      title: 'Second-order methods',
      codeTitle: 'newton.py',
      code: `
        H = hessian(loss_fn, w)    # D x D        #@H
        # solve(H, dw) computes inv(H).dot(dw)    #@solve
        w = w - np.linalg.solve(H, dw)            #@step
        # note: no learning rate anywhere         #@nolr

        # D = 1,000,000 parameters:               #@mem
        # H has 10**12 entries: 3,725 GB          #@mem

        # in practice: Adam, or SGD + Nesterov,   #@rec
        # with a decaying learning rate           #@rec
      `,
      beats: [

        { id: 'first', say: 'All of these are first-order methods: they use only the slope. Second-order methods also use the curvature, how fast the slope itself changes.' },
        { id: 'hess', say: 'In many dimensions, that is the Hessian, the grid of all second derivatives.', code: 'H' },
        { id: 'fit', say: 'Newton\'s method fits a bowl at the current point, and jumps to its bottom. On the long valley, it arrives in one step, with no learning rate at all.', code: ['solve', 'step', 'nolr'] },
        { id: 'size', say: 'So why not use it? A million parameters means a Hessian of a million squared entries: {3,725|three thousand seven hundred and twenty five} gigabytes.', code: 'mem' },
        { id: 'saddle', say: 'And Newton is drawn to any flat point. On the saddle, it walks straight to the top of the ridge, and stays.', code: 'step' },
        { id: 'lbfgs', say: 'L-BFGS approximates the Hessian from recent gradients, but it needs the full training set at once: mini-batch noise breaks it.' },
        { id: 'rec', say: 'So use Adam by default, try SGD with Nesterov momentum, and either way, decay the learning rate.', code: 'rec' },
      ],
    },
    {
      id: 'search',
      title: 'Hyperparameter search',
      codeTitle: 'search.py',
      code: `
        from numpy.random import uniform
        for trial in range(100):
            lr = 10 ** uniform({{lo:-6}}, {{hi:1}})          #@log
            reg = 10 ** uniform(-5, 5)           #@log
            dropout = uniform(0, 1)              #@lin
            model = train(lr, reg, dropout,      #@train
                          epochs={{ep:1}})            #@train
            val = evaluate(model, X_val, y_val)  #@val
            checkpoint(model, val)  # to disk    #@save

        # grid: 9 trials, only 3 distinct lr    #@grid
        # random: 9 trials, 9 distinct lr       #@rand
      `,
      beats: [

        { id: 'knobs', say: 'Some knobs training cannot set: above all, the learning rate, its decay, and the regularization strength.' },
        { id: 'val', say: 'Tune them on one decent validation set, and automate it: workers sample settings, train, and save each result to disk.', code: ['train', 'val', 'save'] },
        { id: 'log', say: 'Search on a log scale. Adding {0.01|zero point zero one} to a rate of {0.001|zero point zero zero one} changes everything. Adding it to ten changes nothing.', code: 'log' },
        { id: 'exp', say: 'So sample the exponent uniformly. Knobs like dropout stay linear.', code: ['log', 'lin'] },
        { id: 'grid', say: 'And prefer random search to a grid, because usually only a few knobs really matter.', code: ['grid', 'rand'] },
        { id: 'waste', say: 'A three by three grid tests just three learning rates, three times each, and here, none is near the peak.', code: 'grid' },
        { id: 'random', say: 'Nine random trials test nine different rates, far more likely to hit the narrow good region.', code: 'rand' },
        { id: 'border', say: 'Watch the borders: if the best result sits at an edge of the range, widen it.', code: 'log' },
        { id: 'coarse', say: 'Go from coarse to fine: wide ranges and one epoch per trial first, then narrower ranges, and about five epochs.', code: ['log', 'train'] },
        { id: 'fine', say: 'Then a fine search with many epochs. Bayesian methods pick trials more cleverly, but a well ranged random search is hard to beat.', code: ['log', 'train'] },
      ],
    },
    {
      id: 'ensembles',
      title: 'Ensembles',
      codeTitle: 'ensemble.py',
      code: `
        P = [m.probs(X_test) for m in models]   #@P
        avg = np.mean(P, axis=0)                #@avg
        pred = np.argmax(avg, axis=1)           #@pred

        # members: copies with new random       #@members
        # inits, the top models of the search,  #@members
        # or checkpoints of one long run        #@members

        # a running average of the weights:     #@run
        w_test = 0.995 * w_test + 0.005 * w     #@run
        # evaluate with w_test, not w           #@eval
      `,
      beats: [

        { id: 'trick', say: 'One last trick buys a few extra percent: train several models, and average their predictions.', code: ['P', 'avg', 'pred'] },
        { id: 'why', say: 'Each model makes its own mistakes, and averaged, they partly cancel. The more the models differ, the bigger the gain.', code: 'avg' },
        { id: 'members', say: 'Members can be copies with new random starts, the top models of your search, or snapshots of one long run.', code: 'members' },
        { id: 'avgw', say: 'Cheapest of all: a running average of the weights, used at test time. It almost always buys a percent or two.', code: 'run' },
        { id: 'bowl', say: 'Late in training, the weights jitter around the bottom of a bowl, and their average sits closer to it than any snapshot.', code: ['run', 'eval'] },
        { id: 'cost', say: 'The catch is the cost at test time, but an ensemble can be distilled back into one model, trained to match its probabilities.' },
      ],
    },
    {
      id: 'closing',
      title: 'The training checklist',
      codeTitle: 'checklist.py',
      code: `
        # 1. gradient check: float64, few points  #@c1
        # 2. sanity: loss at chance, overfit 20   #@c2
        # 3. watch: loss curve, train vs val      #@c3
        # 4. update: Adam, or SGD + Nesterov      #@c4
        # 5. decay the learning rate              #@c5
        # 6. random search: log scale, coarse     #@c6
        #    to fine                              #@c6
        # 7. ensemble, or average the weights     #@c7
      `,
      beats: [

        { id: 'recap', say: 'That is the whole training checklist.' },
        { id: 'c1', say: 'Check gradients numerically, in double precision, on a few examples.', code: 'c1' },
        { id: 'c2', say: 'Check the starting loss, and memorize a tiny subset.', code: 'c2' },
        { id: 'c3', say: 'Watch the loss curve, and the gap between training and validation.', code: 'c3' },
        { id: 'c4', say: 'Update with Adam or Nesterov momentum, and decay the rate.', code: ['c4', 'c5'] },
        { id: 'c6', say: 'Search at random, on log scales, coarse to fine. And ensemble at the end.', code: ['c6', 'c7'] },
        { id: 'next', say: 'Now open the interactive chapter, where every picture here is yours to drive: race the update rules, and break a gradient check on purpose.' },
        { id: 'bye', say: 'Happy training.', pause: 0.6 },
      ],
    },
  ],
};
