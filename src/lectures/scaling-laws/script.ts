import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'scaling-laws',
  title: 'Scaling laws and compute',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'A line you can extend',
      codeTitle: 'the_question.py',
      code: `
        C = 5.8e23          # FLOPs you can afford  #@C
        N = choose_size(C)  # parameters?           #@N
        D = C / (6 * N)     # training tokens?      #@D
        L = predict(N, D)   # before training       #@L
      `,
      beats: [
        { id: 'hello', say: 'This lecture is about scale, and about one surprisingly simple pattern.' },
        { id: 'y2016', say: 'In 2016, making a network bigger was a gamble: nobody could say in advance how much better it would get.' },
        { id: 'y2020', say: 'By 2020 that had changed. Train language models of different sizes, plot their loss on the right axes, and the points fall on a straight line.' },
        { id: 'extend', say: 'And a straight line can be extended. You could predict how good a model would be before paying to train it.' },
        { id: 'question', say: 'That turned scale into a research question. If you can afford a fixed amount of compute, how big should the model be, and how many tokens should it read?', code: 'C' },
        { id: 'symbols', say: 'We will call the number of parameters N, the number of training tokens D, and the training compute C.', code: ['N', 'D'] },
        { id: 'loss', say: 'The loss is next-token cross-entropy, in nats. Lower is better.', code: 'L' },
        { id: 'plan', say: 'We will build the answer in steps: power laws, fitting, counting compute, and two papers that answered very differently.' },
        { id: 'go', say: 'Start with the shape of the curve itself.' },
      ],
    },
    {
      id: 'power',
      title: 'Power laws on log axes',
      codeTitle: 'log_axes.py',
      code: `
        x = np.linspace(1, 1000, 1000)
        y = 10 * x ** -0.5       # a power law  #@pow
        plt.plot(x, y)                          #@plot
        plt.xscale('log')                       #@log
        plt.yscale('log')                       #@log
        # log y = log 10 - 0.5 * log x          #@slope
      `,
      beats: [
        { id: 'def', say: 'A power law says y equals a, times x to the power minus k. Read x as model size, y as the loss, and k as a small positive number.', code: 'pow' },
        { id: 'prop', say: 'Its defining property: multiply x by ten, and y gets multiplied by the same factor, wherever you start.', code: 'pow' },
        { id: 'ex', say: 'With k equal to one half, every ten times more x leaves about a third of the y, from ten to a hundred, and from a hundred to a thousand.' },
        { id: 'plain', say: 'On ordinary axes that is hard to see. The curve drops fast, then crawls along a long, flat looking tail.', code: 'plot' },
        { id: 'log', say: 'So switch both axes to a log scale, where every step is a power of ten.', code: 'log' },
        { id: 'straight', say: 'Now the curve is a straight line.', code: 'log' },
        { id: 'why', say: 'Taking logs turns the power into a multiplication: log y equals log a, minus k times log x. That is the equation of a straight line.', code: 'slope' },
        { id: 'slope', say: 'And its slope is minus k. The exponent is literally the steepness of the line on log-log axes.', code: 'slope' },
        { id: 'expo', say: 'Compare an exponential decay. It loses a fixed fraction per fixed step, not per fixed ratio, so on these axes it falls off a cliff.' },
      ],
    },
    {
      id: 'fit',
      title: 'Fitting, and the floor',
      codeTitle: 'extrapolate.py',
      code: `
        N = np.logspace(6, 9, 10)   # 10 runs  #@runs
        L = run_experiments(N)                 #@runs
        u, v = np.log10(N), np.log10(L)        #@logs
        m, c = np.polyfit(u, v, 1)  # a line   #@fit
        pred = 10**c * 1e11**m                 #@pred
        # honest form: L = E + a * N**-k       #@floor
      `,
      beats: [
        { id: 'runs', say: 'Real experiments give noisy points. Here are ten small training runs, from a million to a billion parameters: synthetic, made up for this lecture.', code: 'runs' },
        { id: 'logs', say: 'Take the logarithm of each size and each loss.', code: 'logs' },
        { id: 'fit', say: 'Then fit a straight line by least squares, which makes the squared misses as small as possible. Its slope is the exponent.', code: 'fit' },
        { id: 'good', say: 'The line fits beautifully. So extend it a hundred times further, to a hundred billion parameters.', code: 'pred' },
        { id: 'miss', say: 'And the prediction is badly wrong. The true loss is much higher than the line says.', code: 'pred' },
        { id: 'floor', say: 'The reason is a floor. Language is partly unpredictable, so even a perfect model still pays some loss. Call that floor E.', code: 'floor' },
        { id: 'form', say: 'The honest law is a power law sitting on a floor: E, plus a times N to the minus k.', code: 'floor' },
        { id: 'narrow', say: 'Over a narrow range the floor is invisible. Extrapolate far, and the straight line dives right through it.' },
        { id: 'refit', say: 'Fit the floor as well, and the curve bends. Now the prediction lands near the truth.', code: 'floor' },
        { id: 'gpt4', say: 'This is how big runs are planned. The GPT-4 report describes predicting its final loss from runs using up to ten thousand times less compute.' },
      ],
    },
    {
      id: 'kaplan',
      title: "Kaplan's three laws",
      codeTitle: 'kaplan.py',
      code: `
        # Kaplan et al. (2020), approximate
        alpha_N = 0.076    # parameters    #@N
        alpha_D = 0.095    # data          #@D
        alpha_C = 0.050    # compute       #@C
        2 ** -alpha_N      # 0.949         #@half
        L = L_ND(N, D)     # both at once  #@ND
      `,
      beats: [
        { id: 'paper', say: 'In January 2020, Jared Kaplan and colleagues at OpenAI trained many transformer language models, up to one and a half billion parameters.' },
        { id: 'three', say: 'They found three straight lines: loss against parameters, against data, and against compute. Each held while the other two were not the bottleneck.' },
        { id: 'n', say: 'For parameters, the exponent was about {0.076|zero point zero seven six}.', code: 'N' },
        { id: 'd', say: 'For data, about {0.095|zero point zero nine five}. And for compute, spent well, about {0.05|zero point zero five}.', code: ['D', 'C'] },
        { id: 'small', say: 'Those are small numbers. Doubling the parameters cuts the loss by only about five percent; ten times, by about sixteen.', code: 'half' },
        { id: 'shape', say: 'Three more findings. Shape barely mattered: at a fixed parameter count, depth versus width hardly changed the loss.' },
        { id: 'sample', say: 'Bigger models were more sample efficient: they reached a given loss after fewer tokens.' },
        { id: 'together', say: 'And parameters and data have to grow together.', code: 'ND' },
        { id: 'bend', say: 'Fix the dataset and keep growing the model: the loss follows the line for a while, then bends flat. Data has become the bottleneck.', code: 'ND' },
        { id: 'slide', say: 'Give it more data, and the bend moves out to bigger models.', code: 'ND' },
      ],
    },
    {
      id: 'flops',
      title: 'Counting compute: 6ND',
      codeTitle: 'six_nd.py',
      code: `
        y = x @ W         # forward    #@fwd
        dx = dy @ W.T     # backward   #@bx
        dW = x.T @ dy     # backward   #@bw
        C = 6 * N * D                  #@C
        # GPT-3: 6 * 175e9 * 300e9     #@gpt
        #      = 3.15e23 FLOPs         #@gpt
      `,
      beats: [
        { id: 'flop', say: 'To use the compute law, we count compute in FLOPs: one multiply, or one add. Nearly all of it is matrix multiplies against the weights.' },
        { id: 'fwd', say: 'In the forward pass, each weight multiplies one incoming number and adds the product into a sum. That is two FLOPs, per weight, per token.', code: 'fwd' },
        { id: 'bx', say: "Backpropagation needs two more products of the same size. One sends the gradient back to the layer's input: two more FLOPs.", code: 'bx' },
        { id: 'bw', say: 'The other computes the gradient of the weights themselves: two more.', code: 'bw' },
        { id: 'six', say: 'Six FLOPs per parameter, per token. So training costs about six, times N, times D.', code: 'C' },
        { id: 'infer', say: 'Running a trained model is forward only: about two N per token. That number comes back at the end.' },
        { id: 'gpt', say: 'GPT-3 had {175 billion|one hundred seventy five billion} parameters and trained on {300 billion|three hundred billion} tokens. Six times those is about {3 × 10²³|three times ten to the twenty three} FLOPs.', code: 'gpt' },
        { id: 'days', say: 'At four hundred trillion FLOPs per second, that is about nine thousand GPU days, or nine days on a thousand GPUs.', code: 'gpt' },
        { id: 'same', say: 'A curious fact: four famous models, {GPT-3|G P T three}, Gopher, Chinchilla, and {Llama 3 8B|Llama three with eight billion parameters}, all used similar compute, within a factor of two and a half.' },
        { id: 'split', say: 'They just split it very differently between parameters and tokens. That split is what the rest of this lecture is about.' },
      ],
    },
    {
      id: 'frontier',
      title: 'The compute frontier',
      codeTitle: 'frontier.py',
      code: `
        for N in sizes:                  #@loop
            D = np.logspace(8, 13)       #@loop
            C = 6 * N * D                #@cost
            L = loss(N, D)               #@loss
            curves.append((C, L))
        front = np.min(curves, axis=0)   #@front
      `,
      beats: [
        { id: 'one', say: 'Pick one model size and train it on more and more tokens. Each token costs six N FLOPs and lowers the loss, quickly at first, then slowly.', code: ['loop', 'cost', 'loss'] },
        { id: 'flat', say: "Eventually the model's own size is the bottleneck, and its curve goes flat.", code: 'loss' },
        { id: 'many', say: 'Now do that for many sizes, and plot every curve against compute.', code: 'loop' },
        { id: 'cross', say: 'Small models are cheap per token, so they win at small budgets. Big models win at big budgets.' },
        { id: 'env', say: 'The lower edge of the whole family is the best loss any model can reach at each budget. That edge is the compute frontier.', code: 'front' },
        { id: 'straight', say: "Subtract the floor, and the frontier is a straight line on log-log axes. That is Kaplan's law for compute.", code: 'front' },
        { id: 'move', say: 'As the budget grows, the winning size moves to the right.' },
        { id: 'kaplan', say: 'Kaplan measured how fast. The best model size grew as compute to the power {0.73|zero point seven three}, and the data only as the power {0.27|zero point two seven}.' },
        { id: 'tenx', say: 'Ten times more compute: a model about five times bigger, trained on fewer than twice as many tokens.' },
        { id: 'race', say: 'The field followed. GPT-3 put {175 billion|one hundred seventy five billion} parameters on {300 billion|three hundred billion} tokens. Gopher put {280B|two hundred eighty billion} on the same tokens.' },
        { id: 'params', say: 'Megatron-Turing went to {530 billion|five hundred thirty billion}, on even fewer. The race was for parameters; the tokens barely moved.' },
      ],
    },
    {
      id: 'chinchilla',
      title: "Chinchilla's loss formula",
      codeTitle: 'chinchilla_fit.py',
      code: `
        E, A, B = 1.69, 406.4, 410.7     #@consts
        alpha, beta = 0.34, 0.28         #@consts
        def loss(N, D):                  #@def
            return (E                    #@E
                    + A / N**alpha       #@Nterm
                    + B / D**beta)       #@Dterm
      `,
      beats: [
        { id: 'paper', say: 'In 2022, Jordan Hoffmann and colleagues at DeepMind asked the budget question again, more carefully.' },
        { id: 'runs', say: 'They trained over four hundred models, from seventy million to over sixteen billion parameters, on five to five hundred billion tokens.' },
        { id: 'sched', say: 'And they gave every run a learning rate schedule matched to its own length. That detail will matter.' },
        { id: 'three', say: 'They estimated the best split three independent ways. All three agreed with each other, and disagreed with Kaplan.' },
        { id: 'formula', say: 'The third way fits one formula for the loss in terms of both N and D.', code: 'def' },
        { id: 'e', say: 'First, a floor, E: the uncertainty left in text itself, which even a perfect model pays.', code: 'E' },
        { id: 'a', say: 'Plus a penalty for having only N parameters: A over N to the alpha. It shrinks as the model grows.', code: 'Nterm' },
        { id: 'b', say: 'Plus a penalty for having seen only D tokens: B over D to the beta. It shrinks with more data.', code: 'Dterm' },
        { id: 'exps', say: 'Their fit put alpha and beta both near {0.3|zero point three}.', code: 'consts' },
        { id: 'neither', say: 'Each penalty falls by a fixed fraction for every ten times more of its resource, and neither reaches zero. A fixed budget means buying some of each.' },
        { id: 'approx', say: 'Treat the constants as approximate; a later replication re-estimated them. The pictures use round illustrative numbers of the same form.' },
      ],
    },
    {
      id: 'budget',
      title: 'Splitting one budget',
      codeTitle: 'isoflop.py',
      code: `
        C = 5.8e23                       #@C
        N = np.logspace(7, 13, 600)      #@line
        D = C / (6 * N)    # spend it    #@line
        L = loss(N, D)                   #@L
        i = np.argmin(L)                 #@min
        N[i], D[i]   # 70B, 1.4T         #@min
      `,
      beats: [
        { id: 'plane', say: 'Draw a map. Model size runs across, tokens run up, and both axes are logarithmic.' },
        { id: 'contours', say: 'The loss formula draws contours on this map: lines of equal loss, like height lines on a hiking map. Lower loss is up and to the right.', code: 'L' },
        { id: 'line', say: 'Now fix a budget. Every way to spend it all satisfies C equals six N D, and on these axes that is a straight line, sloping down.', code: ['C', 'line'] },
        { id: 'walk', say: 'Walk along the line. Far left, the model is tiny and starved for capacity. Far right, it is huge and starved for data.', code: 'line' },
        { id: 'valley', say: 'Plot the loss as you walk, and you get a valley.', code: 'L' },
        { id: 'touch', say: 'The bottom of the valley is where the budget line just touches the lowest contour it can reach.', code: 'min' },
        { id: 'answer', say: "For Chinchilla's budget, about {6 × 10²³|six times ten to the twenty three} FLOPs, the bottom is near seventy billion parameters and {1.4 trillion|one point four trillion} tokens.", code: 'min' },
        { id: 'gpt3', say: "GPT-3's split, under two tokens per parameter, sits up the right slope of the same valley: a worse loss for the same money." },
        { id: 'grow', say: 'Now increase the budget. The line slides outward, and the best point slides with it.', code: 'C' },
        { id: 'diag', say: 'And it slides along a straight diagonal: about twenty tokens for every parameter, at every budget.' },
      ],
    },
    {
      id: 'twenty',
      title: 'Twenty tokens per parameter',
      codeTitle: 'optimum.py',
      code: `
        a = beta / (alpha + beta)    # size  #@a
        b = alpha / (alpha + beta)   # data  #@b
        N_opt = G * (C / 6) ** a             #@N
        D_opt = (C / 6) / N_opt              #@D
        # alpha == beta: a = b = 0.5         #@half
      `,
      beats: [
        { id: 'why', say: 'Why a fixed ratio? Do the calculus at the bottom of the valley, and the best size grows as compute to the power beta, over alpha plus beta.', code: ['a', 'N'] },
        { id: 'data', say: 'The tokens get the rest: alpha over alpha plus beta. The two shares add up to one.', code: ['b', 'D'] },
        { id: 'equal', say: 'When the two penalties shrink at the same rate, both shares are one half.', code: 'half' },
        { id: 'tenx', say: 'Then ten times more compute buys about three times more parameters and three times more tokens.' },
        { id: 'kaplan', say: "Chinchilla's three methods put the size exponent between {0.46|zero point four six} and one half. Kaplan had {0.73|zero point seven three}." },
        { id: 'under', say: 'By this measure, the giant models of 2020 and 2021 were badly undertrained: too many parameters, too few tokens.' },
        { id: 'test', say: 'DeepMind tested it directly. Chinchilla: seventy billion parameters, trained on {1.4 trillion|one point four trillion} tokens, with about the same compute as Gopher.' },
        { id: 'gopher', say: 'Gopher had four times the parameters, and under a quarter of the data. Same area, different shape.' },
        { id: 'won', say: 'Chinchilla beat Gopher on the large majority of tasks, and at a quarter of the size, it was much cheaper to run.' },
        { id: 'whyk', say: 'Why did Kaplan differ? The Chinchilla paper pointed mainly at the learning rate schedule.' },
        { id: 'sched', say: 'Kaplan used one schedule length no matter when a run would stop, so short runs were measured before their learning rate came down. That made short training look worse.' },
        { id: 'lesson', say: 'The lesson: a scaling law is a fact about a training recipe. Change a careless detail, and the law tilts.' },
      ],
    },
    {
      id: 'beyond',
      title: 'Training past the optimum',
      codeTitle: 'lifetime.py',
      code: `
        train = 6 * N * D       # once      #@train
        serve = 2 * N * D_inf   # forever   #@serve
        total = train + serve               #@total
        best = np.argmin(total)             #@best
        # Llama 3 8B: 15T tokens, 1,900/param #@llama
      `,
      beats: [
        { id: 'once', say: 'Chinchilla answers one question exactly: the cheapest way to train a model to a given loss.' },
        { id: 'used', say: 'But a model is trained once and then used, often by many people, for a long time.' },
        { id: 'serve', say: 'Every token it processes costs about two N FLOPs. A smaller model is cheaper for every one of them, and faster too.', code: 'serve' },
        { id: 'trade', say: 'And a smaller model can still reach the same loss by reading more tokens, because the data penalty keeps shrinking.' },
        { id: 'curve', say: 'So hold the loss fixed and slide toward smaller models. Training compute rises, because each one needs more tokens.', code: 'train' },
        { id: 'serveline', say: 'Serving compute falls in proportion to size.', code: 'serve' },
        { id: 'best', say: 'The best size balances the two.', code: ['total', 'best'] },
        { id: 'more', say: 'Now let it serve more and more tokens. The best size moves left, and its tokens per parameter climb into the hundreds, then thousands.', code: 'best' },
        { id: 'llama', say: "That is what happened. Meta's first LLaMA trained a seven billion parameter model on a trillion tokens." },
        { id: 'llama3', say: 'Llama 3 trained an eight billion parameter model on over fifteen trillion tokens, about seventy five times the Chinchilla optimal amount, and it kept improving.', code: 'llama' },
        { id: 'least', say: 'Chinchilla optimal became the least data a serious model is trained on, not the target.', code: 'llama' },
      ],
    },
    {
      id: 'limits',
      title: 'What the laws do not say',
      codeTitle: 'caveats.py',
      code: `
        p = 0.9                 # per token  #@p
        score = p ** 20         # all right  #@exact
        # p 0.5 -> 1e-6, p 0.95 -> 0.36      #@jump
        epochs = 4   # repeats still fine    #@data
      `,
      beats: [
        { id: 'one', say: 'A scaling law predicts one number, the average loss, for one recipe. A few caveats keep it in its place.' },
        { id: 'ability', say: 'First, loss is not ability. The loss falls smoothly, but a specific skill can seem to appear suddenly.', code: 'p' },
        { id: 'exact', say: 'Suppose each token of a twenty token answer is right with probability p, and the answer counts only if all are right: the score is p to the twentieth.', code: 'exact' },
        { id: 'jump', say: 'As p climbs smoothly from one half to {0.95|zero point nine five}, the score leaps from one in a million to about a third.', code: 'jump' },
        { id: 'emerge', say: 'Jumps like this were called emergent abilities. Many of them turn smooth when measured with a continuous score.' },
        { id: 'data', say: 'Second, data is finite. Repeating data for up to about four epochs is nearly as good as fresh, and then the returns fall away.', code: 'data' },
        { id: 'recipe', say: 'Third, the constants belong to a recipe. Better data, architecture, or optimizer moves the whole line down.' },
        { id: 'other', say: 'And training is not the only axis: spending more compute at inference, by thinking longer, has its own curve, later in the course.' },
      ],
    },
    {
      id: 'outro',
      title: 'Recap',
      codeTitle: 'recap.py',
      code: `
        log_L = log_a - k * log_N   # a line  #@line
        C = 6 * N * D                         #@six
        D_opt / N_opt    # about 20           #@twenty
        # used a lot? smaller, longer         #@longer
      `,
      beats: [
        { id: 'line', say: "Let's recap. On log-log axes a power law is a straight line, and its slope is the exponent. Fit it on the logs, and remember the floor.", code: 'line' },
        { id: 'laws', say: 'Loss falls as a power law in parameters, data and compute, as long as none of them is the bottleneck.' },
        { id: 'six', say: 'Training costs about six N D FLOPs. Running the model costs about two N per token.', code: 'six' },
        { id: 'twenty', say: 'For a fixed budget, grow the model and the data together: about twenty tokens per parameter.', code: 'twenty' },
        { id: 'longer', say: 'And if the model will be used a lot, make it smaller, and train it much longer.', code: 'longer' },
        { id: 'next', say: 'In the interactive chapter you can fit these lines yourself, slide a compute budget, and size a model for its users.' },
        { id: 'bye', say: 'See you there.' },
      ],
    },
  ],
};
