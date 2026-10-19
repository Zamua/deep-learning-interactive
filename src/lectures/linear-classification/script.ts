import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'linear-classification',
  title: 'Linear classifiers: SVM and Softmax',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'From remembering to learning',
      codeTitle: 'recipe.py',
      code: `
        # chapter 3: keep every training image
        def predict(x):
            d = np.abs(X_train - x).sum(axis=1)   #@knn
            return y_train[np.argmin(d)]          #@knn

        # chapter 4: a score function, W and b   #@score
        scores = W.dot(x) + b                    #@score
        # a loss: how bad are the scores?        #@loss
        loss = loss_fn(scores, y)                #@loss
        # learning: find W, b with a small loss  #@learn
      `,
      beats: [
        { id: 'hello', say: 'Welcome to linear classifiers. This is the chapter where our classifiers stop memorizing, and start to learn.' },
        { id: 'knn', say: 'Last chapter, the nearest neighbor classifier kept every single training image, and compared each new image against all of them.', code: 'knn' },
        { id: 'slow', say: 'That works, but it is slow at test time, and it never really learns anything. It just remembers.', code: 'knn' },
        { id: 'idea', say: 'This chapter introduces the idea that the rest of the course is built on.' },
        { id: 'score', say: 'Instead of remembering the training set, we write down a score function, with a few adjustable numbers inside it. Those numbers are called the parameters.', code: 'score' },
        { id: 'loss', say: 'Next to it, a loss function: a single number that measures how bad the scores are.', code: 'loss' },
        { id: 'learn', say: 'And learning becomes a search: find the parameter values that make the loss small.', code: 'learn' },
        { id: 'start', say: 'The simplest score function of all is one matrix multiply. That is where we start.', code: 'score' },
      ],
    },
    {
      id: 'score',
      title: 'The score function',
      codeTitle: 'linear_score.py',
      code: `
        x = image.reshape(3072)    # (3072,)      #@x
        W = 0.001 * np.random.randn(10, 3072)     #@W
        b = np.zeros(10)           # (10,)        #@b
        scores = W.dot(x) + b      # (10,)        #@scores
        pred = np.argmax(scores)   # best class   #@pred
      `,
      beats: [
        { id: 'img', say: 'Take one image from {CIFAR-10|see-far ten}. It is {32 × 32|thirty two by thirty two} pixels, with a red, a green and a blue value in each.' },
        { id: 'count', say: 'That makes {32 × 32 × 3|thirty two times thirty two times three} values, which is {3,072|three thousand and seventy two} numbers.' },
        { id: 'flat', say: 'Stretch them all out into one long column, and call it x.', code: 'x' },
        { id: 'want', say: 'We want ten numbers back: one score per class, where a high score means, this image looks like my class.' },
        { id: 'W', say: 'A linear classifier gets them with one multiplication. W is a grid of weights: ten rows, one per class, and {3,072|three thousand and seventy two} columns, one per pixel value.', code: 'W' },
        { id: 'mult', say: 'W times x walks along each row, multiplies every weight by its matching pixel value, and adds up the products. Ten rows give ten numbers.', code: 'scores' },
        { id: 'b', say: 'Then we add b: ten biases, one per class, added at the very end.', code: ['b', 'scores'] },
        { id: 'out', say: 'Out comes a column of ten class scores. Right now W is random, so the scores are tiny noise.', code: 'scores' },
        { id: 'params', say: 'The image is given. W and b are the parameters: the numbers we get to choose.', code: ['W', 'b'] },
        { id: 'goal', say: 'Choose them well, and the correct class gets the highest score. Here is the same image after training: ship wins.', code: 'pred' },
        { id: 'fast', say: 'And once they are learned, the training images can be thrown away. Classifying a new image costs just one multiply.', code: 'scores' },
      ],
    },
    {
      id: 'by-hand',
      title: 'One multiplication at a time',
      codeTitle: 'scores_by_hand.py',
      code: `
        x = np.array([56, 231, 24, 2])     #@x
        W = np.array([
            [0.2, -0.5, 0.1, 2.0],    # cat    #@W
            [1.5, 1.3, 2.1, 0.0],     # dog    #@W
            [0.0, 0.25, 0.2, -0.3]])  # ship   #@W
        b = np.array([1.1, 3.2, -1.2])     #@b

        scores = np.zeros(3)
        for c in range(3):                 #@loop
            total = 0.0
            for i in range(4):
                total += W[c, i] * x[i]    #@mul
            scores[c] = total + b[c]       #@bias
        # c = {{c:0}}   total = {{total:0}}

        W.dot(x) + b   # [-96.8, 437.9, 60.75]   #@dot
      `,
      beats: [
        { id: 'toy', say: 'To watch the multiply up close, shrink the image to just four pixels: {56, 231, 24 and 2|fifty six, two hundred and thirty one, twenty four, and two}.', code: 'x' },
        { id: 'three', say: 'And keep three classes: cat, dog and ship. So W has three rows of four weights, and b has three biases.', code: ['W', 'b'] },
        { id: 'cat', say: 'Start with the cat row. {0.2|Zero point two} times {56|fifty six} is {11.2|eleven point two}.', code: 'mul' },
        { id: 'cat2', say: '{−0.5|Minus zero point five} times {231|two hundred and thirty one} is {−115.5|minus a hundred and fifteen point five}. Then plus {2.4|two point four}, and plus four.', code: 'mul' },
        { id: 'catb', say: 'That totals {−97.9|minus ninety seven point nine}. Add the cat bias, {1.1|one point one}, and the cat score is {−96.8|minus ninety six point eight}.', code: 'bias' },
        { id: 'rows', say: 'The other rows work the same way. Dog scores {437.9|four hundred and thirty seven point nine}, and ship scores {60.75|sixty point seven five}.', code: ['loop', 'mul', 'bias'] },
        { id: 'dot', say: 'In NumPy, W dot x, plus b, does all twelve multiplications at once.', code: 'dot' },
        { id: 'wrong', say: 'Now suppose this image really is a cat. Then these weights are bad: dog wins by a mile, and cat comes last.' },
        { id: 'vote', say: 'Read each weight as a vote. A large positive weight says: a bright value here is evidence for my class.', code: 'W' },
        { id: 'neg', say: 'A negative weight says the opposite: a bright value here is evidence against me. The cat row puts minus a half on the brightest pixel, and that is what sinks it.', code: 'W' },
      ],
    },
    {
      id: 'geometry',
      title: 'Lines in space',
      codeTitle: 'linear_2d.py',
      code: `
        # X: (78, 2), one point per row   #@X
        W = np.array([[{{w00}}, {{w01}}],   # blue     #@W0
                      [{{w10}}, {{w11}}],   # orange   #@W
                      [{{w20}}, {{w21}}]])  # green    #@W
        b = np.array([{{b0}}, {{b1}}, {{b2}}])         #@b

        s0 = X.dot(W[0]) + b[0]   # 0 on a line   #@s0
        scores = X.dot(W.T) + b   # (78, 3)       #@scores
        pred = np.argmax(scores, axis=1)          #@pred
      `,
      beats: [
        { id: 'point', say: 'Here is a useful way to picture what W does. Every image is a single point, in a space with {3,072|three thousand and seventy two} directions, one per pixel value.' },
        { id: 'two', say: 'We cannot draw that many directions, but the idea survives perfectly in two. So here are points with just two numbers each, from three classes.', code: 'X' },
        { id: 'zero', say: 'Take the blue class. Its score is exactly zero along a straight line: positive on one side, and negative on the other.', code: 's0' },
        { id: 'arrow', say: 'Its row of W is an arrow, at a right angle to that line, pointing toward the side where the score grows.', code: ['W0', 's0'] },
        { id: 'turn', say: 'Turn the arrow, and the line turns with it.', code: 'W0' },
        { id: 'bias', say: 'The bias does something different. It slides the line back and forth, without turning it.', code: ['b', 's0'] },
        { id: 'all', say: 'Every class gets its own line, and its own arrow.', code: ['W', 'b'] },
        { id: 'argmax', say: 'Each point goes to the class whose score is highest there.', code: ['scores', 'pred'] },
        { id: 'regions', say: 'And that carves the plane into regions, with straight borders between them.', code: 'pred' },
        { id: 'walls', say: 'That is all a linear classifier can ever do: cut space with flat walls. In {3,072|three thousand and seventy two} dimensions the walls are still flat, just harder to picture.' },
      ],
    },
    {
      id: 'templates',
      title: 'Rows of W are templates',
      codeTitle: 'templates.py',
      code: `
        templates = W.reshape(10, 3, 32, 32)   #@reshape

        # how well x lines up with each row
        scores = W.dot(x) + b                  #@score
        pred = np.argmax(scores)               #@pred

        # trained: 1,000 images, 1,500 steps   #@train
        # test accuracy 0.33, chance 0.1       #@acc
      `,
      beats: [
        { id: 'second', say: 'There is a second, more visual way to read W.' },
        { id: 'fold', say: 'Each row holds exactly one weight per pixel value. So it can be folded back into a {32 × 32|thirty two by thirty two} color picture.', code: 'reshape' },
        { id: 'line', say: 'The score for a class then measures how well the image lines up with that picture: big where both are bright together.', code: 'score' },
        { id: 'tpl', say: 'So each row is a template for its class. Classifying an image means checking it against ten templates, and picking the best match.', code: ['score', 'pred'] },
        { id: 'learned', say: 'Here are ten templates, learned from just one thousand real {CIFAR|see-far} images. With so few, they stay blurry, but the gist is there.', code: 'train' },
        { id: 'blue', say: 'Plane and ship turned blue: sky and water.', code: 'train' },
        { id: 'green', say: 'Bird, deer and frog went green and brown, the colors of grass and forest. And car leans red.', code: 'train' },
        { id: 'horse', say: 'One template per class is a real limit, though. A horse facing left and a horse facing right have to share a single picture.' },
        { id: 'match', say: 'Hand it our ship, and the ship template gives the best match.', code: 'pred' },
        { id: 'acc', say: 'On new images, it gets about one in three right: far better than the one in ten you would get by guessing.', code: 'acc' },
      ],
    },
    {
      id: 'bias-trick',
      title: 'The bias trick, and centering',
      codeTitle: 'bias_trick.py',
      code: `
        x1 = np.append(x, 1.0)              #@x1
        # (3073,): the image, then a 1      #@x1
        W1 = np.hstack([W, b[:, None]])     #@W1
        # (10, 3073): b as the last column  #@W1
        s1 = W1.dot(x1)                         #@same
        np.allclose(s1, W.dot(x) + b)  # True   #@same

        # preprocessing: pixels run 0..255   #@raw
        X = X_train.astype(float)            #@raw
        X -= X.mean(axis=0)   # center       #@center
        X /= np.abs(X).max()  # into [-1, 1] #@scale
      `,
      beats: [
        { id: 'clumsy', say: 'Keeping track of W and b separately is a little clumsy. A common trick folds them into one array.' },
        { id: 'one', say: 'Add one extra number to the end of every image, always equal to one.', code: 'x1' },
        { id: 'col', say: 'And glue b onto W, as one extra column.', code: 'W1' },
        { id: 'why', say: 'Now the last weight in each row gets multiplied by that constant one, which is the same as simply adding it.', code: 'W1' },
        { id: 'same', say: 'Same scores, but one parameter array instead of two, and every formula after this gets shorter.', code: 'same' },
        { id: 'raw', say: 'One more habit, before we grade the scores. Raw pixels run from zero to {255|two hundred and fifty five}.', code: 'raw' },
        { id: 'center', say: 'So first, we center the data. Compute the average image over the training set, and subtract it from every image.', code: 'center' },
        { id: 'around', say: 'Now every pixel value is spread around zero: some positive, some negative.', code: 'center' },
        { id: 'scale', say: 'Often each value is also scaled into a range like minus one to one. Chapter eight explains why this matters so much for training.', code: 'scale' },
      ],
    },
    {
      id: 'grading',
      title: 'Grading the scores',
      codeTitle: 'loss.py',
      code: `
        # one image; classes cat, dog, ship
        scores = np.array([3.2, 5.1, -1.7])    #@scores
        y = 0     # the correct class: cat      #@y

        loss = loss_fn(scores, y)   # one number   #@loss
        # training: nudge W, b to shrink it      #@train
        # two classics: SVM and Softmax          #@two
      `,
      beats: [
        { id: 'have', say: 'We have a way to produce scores. Now we need a way to say how good they are.', code: 'scores' },
        { id: 'three', say: 'Here are scores for one image. Cat, {3.2|three point two}. Dog, {5.1|five point one}. Ship, {−1.7|minus one point seven}. And the image really is a cat.', code: ['scores', 'y'] },
        { id: 'fn', say: 'A loss function takes the scores and the correct answer, and returns a single number.', code: 'loss' },
        { id: 'hilo', say: 'High when the scores are bad, and low when they are good.', code: 'loss' },
        { id: 'train', say: 'Training will mean nudging W and b to make that number smaller.', code: 'train' },
        { id: 'two', say: 'The course introduces two classic choices: the SVM and the Softmax. They agree on what a perfect answer looks like, but disagree, interestingly, about everything else.', code: 'two' },
      ],
    },
    {
      id: 'svm',
      title: 'The multiclass SVM loss',
      codeTitle: 'svm_loss.py',
      code: `
        scores = np.array([{{c:3.2}}, 5.1, -1.7])   #@scores
        y, delta = 0, 1.0   # cat; the margin   #@yd

        gap = scores - scores[y] + delta   #@gap
        margins = np.maximum(0, gap)       #@m
        margins[y] = 0    # not its own rival   #@zero
        # margins = [{{m0:0}}, {{m1:2.9}}, {{m2:0}}]   #@mv
        loss = margins.sum()    # {{loss:2.9}}   #@sum
      `,
      beats: [
        { id: 'wants', say: 'First, the multiclass Support Vector Machine loss, or SVM. It wants the correct class to beat every other class by at least a safety margin, called delta. Usually, delta is one.', code: 'yd' },
        { id: 'line', say: 'Picture it on the bars. Draw a line one delta below the correct score.', code: 'yd' },
        { id: 'intrude', say: 'A wrong class that pokes above that line is too close for comfort, and the loss grows by how far it intrudes.', code: 'gap' },
        { id: 'dog', say: 'Dog scores {5.1|five point one}: past cat itself, and well past the line. Its gap is {5.1 − 3.2 + 1|five point one, minus three point two, plus one}, which is {2.9|two point nine}.', code: 'gap' },
        { id: 'ship', say: 'Ship scores {−1.7|minus one point seven}, comfortably below the line. Its gap is negative, so it costs nothing at all.', code: ['gap', 'm'] },
        { id: 'hinge', say: 'That is the job of the max with zero: keep the intrusion if it is positive, and zero otherwise. Flat, then rising. This shape is called a hinge.', code: 'm' },
        { id: 'self', say: 'The correct class does not compete with itself, so its own margin is set to zero.', code: 'zero' },
        { id: 'sum', say: 'Add up what is left, and the loss for this image is {2.9|two point nine}.', code: ['mv', 'sum'] },
        { id: 'formula', say: 'In symbols: sum over every class j except the correct one, the max of zero and {s_j − s_y + Δ|s j, minus s y, plus delta}.', code: ['gap', 'm', 'sum'] },
        { id: 'raise', say: 'Now raise the cat score. As cat pulls ahead, the dog\'s intrusion shrinks, and so does the loss.', code: ['scores', 'sum'] },
        { id: 'happy', say: 'Once every wrong class is below the line, the loss is exactly zero. The SVM is completely satisfied, however close the race actually is.', code: 'sum' },
      ],
    },
    {
      id: 'regularization',
      title: 'Regularization',
      codeTitle: 'regularization.py',
      code: `
        # say W meets every margin: loss 0
        W2 = {{k:1}} * W    # loss(W2) is 0 too   #@scale

        reg_loss = reg * np.sum(W * W)          #@reg
        loss = data_loss + reg_loss             #@full

        x = np.ones(4)                          #@x
        w1 = np.array([1.0, 0.0, 0.0, 0.0])     #@w1
        w2 = np.array([0.25, 0.25, 0.25, 0.25]) #@w2
        w1.dot(x), w2.dot(x)    # (1.0, 1.0)    #@dots
        np.sum(w1**2)    # 1.0                  #@sq
        np.sum(w2**2)    # 0.25                 #@sq
      `,
      beats: [
        { id: 'subtle', say: 'There is a subtle problem with the SVM loss.' },
        { id: 'zero', say: 'Suppose some W gets every training image right, with every margin met. Its loss is exactly zero.' },
        { id: 'double', say: 'Now double W. Every score doubles, so every gap doubles, and the loss is still zero. Ten times W works too.', code: 'scale' },
        { id: 'tie', say: 'The loss alone cannot tell these apart. So we break the tie with a preference for small, spread out weights.' },
        { id: 'l2', say: 'The most common choice is {L2|L two} regularization: square every weight, add them all up, and multiply by a knob called lambda.', code: 'reg' },
        { id: 'full', say: 'The full loss is the average data loss over all the training images, plus this regularization loss.', code: 'full' },
        { id: 'square', say: 'Squaring punishes big weights much more than small ones.', code: 'reg' },
        { id: 'example', say: 'Take an input of four ones. The weights one, zero, zero, zero give a score of one. So do four weights of a quarter each.', code: ['x', 'w1', 'w2', 'dots'] },
        { id: 'pick', say: 'But their squares add up to one, versus a quarter. Regularization prefers the second, which spreads the effort and uses all of the evidence.', code: 'sq' },
        { id: 'knob', say: 'In practice, that also works better on new images. Lambda is a hyperparameter: it trades small weights against fitting the data.', code: 'reg' },
        { id: 'onlyW', say: 'And notice: it is only ever applied to W, never to b.', code: 'reg' },
      ],
    },
    {
      id: 'softmax',
      title: 'Softmax: scores to probabilities',
      codeTitle: 'softmax.py',
      code: `
        scores = np.array([3.2, 5.1, -1.7])
        # cat, dog, ship

        exps = np.exp(scores)          #@exp
        # [24.5, 164.0, 0.18]          #@exp
        probs = exps / exps.sum()      #@norm
        # [0.13, 0.87, 0.001]          #@norm
        probs.sum()    # 1.0           #@sum
      `,
      beats: [
        { id: 'second', say: 'The second classic reads the scores as probabilities.' },
        { id: 'problem', say: 'Scores can be any number, positive or negative. Probabilities must be positive, and they must add up to one.' },
        { id: 'moves', say: 'The softmax function makes that conversion in two moves.' },
        { id: 'exp', say: 'First, exponentiate every score: raise e, about {2.718|two point seven one eight}, to the power of that score.', code: 'exp' },
        { id: 'pos', say: 'That makes everything positive. Ship\'s {−1.7|minus one point seven} becomes {0.18|zero point one eight}.', code: 'exp' },
        { id: 'bigger', say: 'And it makes big scores much bigger, since each extra point of score multiplies by about {2.7|two point seven}. Cat becomes {24.5|twenty four point five}, and dog, {164|a hundred and sixty four}.', code: 'exp' },
        { id: 'divide', say: 'Second, divide each one by the total, so they add up to one.', code: ['norm', 'sum'] },
        { id: 'pie', say: 'Now every class gets a slice of a pie. Cat, thirteen percent. Dog, eighty seven. Ship, almost nothing.', code: 'norm' },
        { id: 'formula', say: 'In symbols: {pₖ is e to the sₖ, divided by the sum of e to the sⱼ|p k is e to the s k, divided by the sum of e to the s j}, over every class j.', code: 'norm' },
        { id: 'sharp', say: 'The slices of higher scores are disproportionately larger. A lead of {1.9|one point nine} in score became a lead of almost seven to one in probability.' },
      ],
    },
    {
      id: 'cross-entropy',
      title: 'Cross-entropy and stability',
      codeTitle: 'softmax_loss.py',
      code: `
        def softmax(scores):
            shifted = scores - np.max(scores)   #@shift
            exps = np.exp(shifted)              #@exp
            return exps / exps.sum()            #@exp

        probs = softmax(scores)                 #@probs
        loss = -np.log(probs[y])                #@loss
        # p = {{p:0.13}}  ->  loss = {{loss:2.04}}   #@val
      `,
      beats: [
        { id: 'look', say: 'The softmax loss looks at one thing only: how much probability landed on the correct answer.', code: ['probs', 'loss'] },
        { id: 'neglog', say: 'It takes the log of that probability, and flips the sign. This is called the cross entropy loss.', code: 'loss' },
        { id: 'ours', say: 'Our cat got {0.13|zero point one three}, so its loss is about {2.04|two point oh four}.', code: ['loss', 'val'] },
        { id: 'certain', say: 'Here is the whole curve. Certain and right, with probability one: the loss is zero.', code: 'val' },
        { id: 'half', say: 'A fifty fifty hedge costs about {0.69|zero point six nine}.', code: 'val' },
        { id: 'tiny', say: 'Only one percent on the right class costs {4.6|four point six}, and the loss grows without limit as that probability heads to zero.', code: 'val' },
        { id: 'never', say: 'Unlike the SVM, it is never fully satisfied. There is always a little more probability to squeeze onto the correct class.', code: 'val' },
        { id: 'explode', say: 'One practical warning. Exponentials explode. {e¹⁰⁰⁰|e to the thousand} is too large for a computer to store, so the division turns into nonsense.', code: 'exp' },
        { id: 'shift', say: 'The fix is free: subtract the largest score from all of them first.', code: 'shift' },
        { id: 'cancel', say: 'Every exponential gets multiplied by the same constant, which cancels in the division. The probabilities do not change, but now the largest exponent is {e⁰|e to the zero}, which is one.', code: ['shift', 'exp'] },
      ],
    },
    {
      id: 'compare',
      title: 'SVM versus Softmax',
      codeTitle: 'compare.py',
      code: `
        scores = np.array([{{c:3.2}}, 5.1, -1.7])   #@scores
        y = 0    # cat

        gap = scores - scores[y] + 1
        m = np.maximum(0, gap)
        m[y] = 0
        svm_loss = m.sum()                  #@svm

        e = np.exp(scores - scores.max())
        probs = e / e.sum()
        softmax_loss = -np.log(probs[y])    #@sm
        # svm {{svm:2.9}}   softmax {{sm:2.04}}   #@val
      `,
      beats: [
        { id: 'same', say: 'So how do the two compare? Give them the same scores, and push the cat score up.', code: 'scores' },
        { id: 'start', say: 'At {3.2|three point two}, cat is losing, and both losses are clearly unhappy.', code: ['svm', 'sm', 'val'] },
        { id: 'svm', say: 'As cat pulls ahead, the SVM loss falls in straight lines. Once the margin is met, it hits zero and stays there. It stops caring.', code: ['svm', 'val'] },
        { id: 'soft', say: 'The softmax loss keeps shrinking too, but it never quite reaches zero. It always wants a little more.', code: ['sm', 'val'] },
        { id: 'read', say: 'They also read the scores differently. To the SVM, scores are raw numbers, and only the margin matters.', code: 'svm' },
        { id: 'prob', say: 'To the softmax, scores are unnormalized log probabilities. So it hands you probabilities, with a grain of salt: how sharp they are depends on lambda.', code: 'sm' },
        { id: 'practice', say: 'In practice, the two perform about the same. Softmax is more common today, because probabilities are handy.' },
      ],
    },
    {
      id: 'recipe',
      title: 'The recipe',
      codeTitle: 'recipe.py',
      code: `
        # 1. a score function with parameters
        scores = W.dot(x) + b                    #@score

        # 2. a loss that grades the scores
        loss = data_loss + reg * np.sum(W * W)   #@loss

        # 3. optimization lowers it: chapter 5
        W -= learning_rate * dW                  #@opt
      `,
      beats: [
        { id: 'shape', say: 'The deeper point of this chapter is the shape of the recipe, which every remaining chapter reuses.' },
        { id: 'one', say: 'One: a score function with parameters. Here, {Wx + b|W x plus b}. Later, a deep network.', code: 'score' },
        { id: 'two', say: 'Two: a loss function that grades the scores. The SVM or the softmax, plus regularization.', code: 'loss' },
        { id: 'three', say: 'Three: an optimization procedure, which adjusts the parameters to lower the loss. That is the next chapter.', code: 'opt' },
        { id: 'recap', say: 'And remember the two readings of W. Each row is a flat wall between classes, and a template picture of its class.' },
        { id: 'next', say: 'Next, open the interactive chapter. Drag the score bars, aim the arrows, and watch ten templates learn from real images, right in your browser.' },
        { id: 'bye', say: 'See you there.', pause: 0.6 },
      ],
    },
  ],
};
