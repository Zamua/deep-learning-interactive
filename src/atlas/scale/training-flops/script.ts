import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-training-flops',
  title: 'Training compute: 6ND',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Krizhevsky, Sutskever & Hinton', year: 2012, title: 'ImageNet classification with deep convolutional neural networks', url: 'https://papers.nips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html', scene: 'cost' },
    { who: 'Kaplan et al.', year: 2020, title: 'Scaling Laws for Neural Language Models', url: 'https://arxiv.org/abs/2001.08361', scene: 'backward' },
  ],
  scenes: [
    {
      id: 'cost',
      title: 'How long will it take?',
      codeTitle: 'cost.py',
      code: `
        # training runs on GPUs           #@gpu
        gpus, days = 2, 5.5   # AlexNet   #@alex
        flops = ...    # count these      #@flop
        rate = ...     # FLOPs per second #@rate
        seconds = flops / rate            #@plan
      `,
      beats: [
        { id: 'ask', say: 'Before training a model, you want to know how long the run will take. An hour, or a month? It pays to work out the bill first.', code: 'plan' },
        { id: 'gpu', say: 'Training runs on GPUs, short for graphics processing units: chips first built to draw graphics, which do thousands of multiplications at once.', code: 'gpu' },
        { id: 'alex', say: 'In 2012, the authors of AlexNet wrote that its size was limited by their GPUs\' memory, and by the training time they were willing to tolerate: between five and six days, on two GPUs.', code: 'alex' },
        { id: 'flop', say: 'Floating point is how a computer stores a decimal, like {3.14|three point one four}. One multiply or one add of two such numbers is one floating point operation: a FLOP.', code: 'flop' },
        { id: 'plan', say: 'A GPU\'s speed is counted in FLOPs per second. Divide the FLOPs a run needs by that speed, and out comes the time. So count the FLOPs.', code: ['rate', 'plan'] },
      ],
    },
    {
      id: 'forward',
      title: 'Two FLOPs per weight, forward',
      codeTitle: 'flops.py',
      code: `
        W = np.array([[1, 0, 2, -1],   #@W
                      [3, 1, 0, 2],    #@W
                      [0, -2, 1, 1]])  #@W
        x = np.array([2, 1, 3, 1])     #@x
        z = W @ x        # [7, 9, 2]   #@z
        # per weight: one *, one +     #@two
        # 12 weights: 24 FLOPs         #@model
      `,
      beats: [
        { id: 'layer', say: 'Count one layer. W holds twelve weights, and x is the vector for one token passing through.', code: ['W', 'x'] },
        { id: 'mult', say: 'Each weight multiplies one entry of x, and the product joins a running sum. Row one: three times two, plus one times one, plus zero times three, plus two times one: nine.', code: 'z' },
        { id: 'mark', say: 'Tally what each weight cost: one multiply, and one add into the sum. Two FLOPs per weight, for every token.', code: 'two' },
        { id: 'n', say: 'Write N for the number of parameters, a different N from the count of blocks before. Here N is twelve, so one token costs twenty four FLOPs: two N.', code: 'model' },
      ],
    },
    {
      id: 'backward',
      title: 'Four more on the way back',
      codeTitle: 'flops.py',
      code: `
        z = W @ x              # 2 per weight  #@fwd
        dx = W.T @ dz          # 2 per weight  #@dx
        dW += np.outer(dz, x)  # 2 per weight  #@dW
        # 6 per parameter per token           #@six
        flops = 6 * n_params * n_tokens       #@nd
      `,
      beats: [
        { id: 'back', say: 'Training then runs backprop through the same layer, and backprop needs two more products, each as big as the forward one.', code: ['dx', 'dW'] },
        { id: 'dx', say: '{Wᵀ dz|W transpose, d z} passes the gradient back to x, for the layer below. It uses every weight once more, in a multiply and an add: two more FLOPs.', code: 'dx' },
        { id: 'dW', say: 'Then each weight gets its own gradient. The weight in row i, column j gets {dz|d z} entry i, times x entry j: one multiply.', code: 'dW' },
        { id: 'acc', say: 'Training reads many tokens, and each token\'s product is added into the weight\'s running gradient: one add.', code: 'dW' },
        { id: 'six', say: 'Two forward and four backward: six FLOPs per parameter, for every token.', code: 'six' },
        { id: 'kaplan', say: 'Jared Kaplan and colleagues estimated training this way in 2020: the backward pass costs about twice the forward, so about six FLOPs per parameter per token, leaving out smaller costs.', code: 'six' },
        { id: 'd', say: 'Write D for the number of tokens the model trains on, counting repeats.', code: 'nd' },
        { id: 'c', say: 'Every parameter works on every token, so the run costs six, times N, times D: six N D FLOPs. Call it C, the training compute.', code: 'nd' },
      ],
    },
    {
      id: 'run',
      title: 'Pricing a run',
      codeTitle: 'run.py',
      code: `
        n_params = 3e9                   #@N
        n_tokens = 4e10                  #@D
        flops = 6 * n_params * n_tokens  #@C
        # 72e19 = 7.2e20                 #@shift
        rate = 100 * 2e14   # 2e16       #@rate
        seconds = flops / rate  # 3.6e4  #@time
        hours = seconds / 3600  # 10     #@hours
        forward = 2 * n_params  # 6e9    #@fwd
      `,
      beats: [
        { id: 'model', say: 'Now a real run: a model of three billion parameters, trained on forty billion tokens.', code: ['N', 'D'] },
        { id: 'lead', say: 'Multiply the leading numbers: six times three times four is seventy two.', code: 'C' },
        { id: 'pow', say: 'Multiplying powers of ten adds them: ten to the nine, times ten to the ten, is ten to the nineteen. So {72 × 10¹⁹|seventy two times ten to the nineteen} FLOPs.', code: 'C' },
        { id: 'shift', say: 'Seventy two is {7.2|seven point two} times ten, so move the decimal point one place, and the power grows by one: {7.2 × 10²⁰|seven point two times ten to the twenty}.', code: 'shift' },
        { id: 'same', say: 'Only the product of N and D matters. Twice the parameters on half the tokens would cost exactly the same.', code: 'C' },
        { id: 'rate', say: 'Say one GPU sustains {2 × 10¹⁴|two times ten to the fourteen} FLOPs per second. A hundred of them together do {2 × 10¹⁶|two times ten to the sixteen}.', code: 'rate' },
        { id: 'div', say: 'Divide the leading numbers: {7.2|seven point two} over two is {3.6|three point six}.', code: 'time' },
        { id: 'sub', say: 'Dividing powers of ten subtracts them: twenty minus sixteen is four. So {3.6 × 10⁴|three point six times ten to the four} seconds: thirty six thousand.', code: 'time' },
        { id: 'hours', say: 'An hour is {3,600|three thousand six hundred} seconds, so the run takes ten hours.', code: 'hours' },
        { id: 'fwd', say: 'Once it is trained, each token it reads takes the forward pass alone: two N, six billion FLOPs, a third of what training on it cost.', code: 'fwd' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
