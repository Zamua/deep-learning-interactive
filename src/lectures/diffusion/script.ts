import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'diffusion',
  title: 'Diffusion models',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Noise in, data out',
      codeTitle: 'diffusion.py',
      code: `
        # train: learn to undo noise          #@train
        xt = mix(x0, eps, t)                  #@train
        loss = mse(eps, model(xt, t))         #@train

        # sample: start from pure noise       #@sample
        x = np.random.randn(500, 2)           #@sample
        for t in range(T, 0, -1):             #@sample
            x = denoise_step(model, x, t)     #@sample
      `,
      beats: [
        { id: 'hello', say: 'Welcome to diffusion models, the idea behind almost every image, video and audio generator built since about {2022|twenty twenty two}.' },
        { id: 'recall', say: 'When the original course ended, the best image generators were GANs: sharp, but famously hard to train.' },
        { id: 'idea', say: 'Diffusion starts from a much humbler observation. Destroying data is easy.' },
        { id: 'destroy', say: 'Take some data, add a little random noise, and do it again and again, until nothing is left but static.' },
        { id: 'undo', say: 'Undoing one small step of that destruction is a plain regression problem. So we train a network to do exactly that.', code: 'train' },
        { id: 'chain', say: 'Then we start from fresh noise and apply the network over and over. Step by step, noise turns into data.', code: 'sample' },
        { id: 'toy', say: 'We will watch all of it happen on a toy: a thousand points in the plane, shaped like two interlocking moons.' },
        { id: 'same', say: 'Each point has two numbers instead of a million pixels, but the algorithm is exactly the one used for images.' },
        { id: 'plan', say: 'The plan: the forward process, the training loss, sampling, the score, guidance, latent diffusion, and finally flow matching.' },
      ],
    },
    {
      id: 'forward',
      title: 'Noise in small steps',
      codeTitle: 'forward_step.py',
      code: `
        T = 100
        beta = np.r_[0,                     #@beta
            np.linspace(1e-3, 0.2, T)]      #@beta

        def forward_step(x, t):             #@step
            eps = np.random.randn(*x.shape) #@eps
            keep = np.sqrt(1 - beta[t])     #@keep
            add = np.sqrt(beta[t])          #@eps
            return keep * x + add * eps     #@mix
        # t = {{t:0}}
      `,
      beats: [
        { id: 'setup', say: 'Let us start with the easy direction: destroying data.' },
        { id: 'schedule', say: 'Pick a number of steps, capital T, here one hundred, and a noise schedule: one small variance, {β_t|beta t}, for every step.', code: 'beta' },
        { id: 'step', say: 'At every step, we do two things to every point.', code: 'step' },
        { id: 'shrink', say: 'First, shrink it slightly toward the origin, by the square root of one minus beta.', code: 'keep' },
        { id: 'add', say: 'Then add a little fresh Gaussian noise with variance beta: a new random draw at every step.', code: ['eps', 'mix'] },
        { id: 'walk', say: 'Follow one point, and it takes a jittery random walk, drifting away from its moon.', code: 'mix' },
        { id: 'why', say: 'Why shrink at all? Because it keeps the total spread constant.' },
        { id: 'var', say: 'If the point has variance one, shrinking leaves one minus beta, and the noise adds back exactly beta. The total stays one.', code: ['keep', 'eps'] },
        { id: 'end', say: 'After enough steps nothing of the original point survives. Every point is just a draw from a standard bell curve, whichever moon it started on.' },
        { id: 'numbers', say: 'The original paper used a thousand steps, with beta rising from {0.0001|one ten thousandth} to {0.02|two hundredths}. Our toy uses a hundred, with the same schedule stretched to fit.', code: 'beta' },
      ],
    },
    {
      id: 'closed',
      title: 'Jump straight to step t',
      codeTitle: 'closed_form.py',
      code: `
        alpha = 1 - beta                    #@alpha
        alpha_bar = np.cumprod(alpha)       #@ab

        eps = np.random.randn(*x0.shape)    #@eps
        a = np.sqrt(alpha_bar[t])           #@a
        b = np.sqrt(1 - alpha_bar[t])       #@b
        xt = a * x0 + b * eps               #@xt
        # t = {{t:0}}   a = {{a:1}}   b = {{b:0}}
      `,
      beats: [
        { id: 'slow', say: 'To train, we will want noisy examples at every step. Simulating seven hundred small steps to reach step seven hundred would be slow.' },
        { id: 'alpha', say: 'So first, a name. {α_t|Alpha t} is one minus beta t: the share of variance a single step keeps.', code: 'alpha' },
        { id: 'abar', say: 'And {ᾱ_t|alpha bar t} is the running product of all the alphas up to step t: the share of the original signal that survives t steps.', code: 'ab' },
        { id: 'merge', say: 'Now the trick. Each step adds independent Gaussian noise, and independent Gaussians merge into a single Gaussian, whose variance is the sum of theirs.' },
        { id: 'closed', say: 'So {x_t|x t} is the square root of alpha bar, times the clean point, plus the square root of one minus alpha bar, times one single draw of noise.', code: ['a', 'b', 'xt'] },
        { id: 'curves', say: 'As t grows, the two weights trade places. The signal weight falls from one toward zero, while the noise weight rises from zero toward one.', code: ['a', 'b'] },
        { id: 'arc', say: 'For one point and one noise draw, the noisy point travels along a curve, from the clean point to the noise. Keep that curve in mind: it comes back at the very end.', code: 'xt' },
        { id: 'same', say: 'One jump gives exactly the same cloud of points as taking all the small steps, and it costs a single multiply and add.' },
        { id: 'warn', say: 'A warning about notation: papers disagree on these letters. Some write alpha for what we call alpha bar, so always check which one is meant.' },
      ],
    },
    {
      id: 'loss',
      title: 'Predict the noise',
      codeTitle: 'loss.py',
      code: `
        x0 = data[i]                     #@x0
        t = np.random.randint(1, T + 1)  #@t
        eps = np.random.randn(2)         #@eps
        a = np.sqrt(alpha_bar[t])        #@xt
        b = np.sqrt(1 - alpha_bar[t])    #@xt
        xt = a * x0 + b * eps            #@xt
        eps_pred = model(xt, t)          #@pred
        loss = np.sum((eps - eps_pred) ** 2)  #@loss
        x0_hat = (xt - b * eps_pred) / a      #@hat
      `,
      beats: [
        { id: 'task', say: 'Now the learning. To undo a step, we need to know which way the data lies.' },
        { id: 'ddpm', say: 'The DDPM paper, by Ho, Jain and Abbeel in {2020|twenty twenty}, made a simple choice: train a network to look at a noisy point and guess the noise that was mixed in.' },
        { id: 'pick', say: 'Making a training example costs nothing. Pick a clean point from the data,', code: 'x0' },
        { id: 't', say: 'pick a random step t, here forty,', code: 't' },
        { id: 'noise', say: 'draw some noise,', code: 'eps' },
        { id: 'mix', say: 'and mix them with the jump formula.', code: 'xt' },
        { id: 'ask', say: 'Then hand the network the noisy point and the step number, and ask for the noise back.', code: 'pred' },
        { id: 'err', say: 'The loss is the squared error between the true noise and the guess. Averaged over a batch, it is a mean squared error, just like linear regression.', code: 'loss' },
        { id: 'none', say: 'No discriminator to fight, as in a GAN. No penalty term to balance, as in a VAE. Just regression.' },
        { id: 'base', say: 'A network that always guesses zero scores exactly one, the variance of the noise. Anything below one means it has found real structure.' },
        { id: 'why', say: 'Why predict the noise rather than the clean point? The two are tied by one equation, so a noise guess is also a guess of the clean point.', code: 'hat' },
        { id: 'scale', say: 'But the noise is a standard Gaussian at every step. Its size never changes, so one network can serve every noise level.' },
        { id: 'resid', say: 'And at low noise, the input is nearly the answer, so the network only reports the small difference, magnified. Ho and colleagues tried the alternatives, and this target gave the best samples.' },
      ],
    },
    {
      id: 'training',
      title: 'Training the toy',
      codeTitle: 'train.py',
      code: `
        params = init_mlp([26, 64, 64, 64, 2])  #@net
        for step in range(3000):            #@loop
            xt, t, eps = make_batch(128)    #@batch
            eps_pred = model(xt, t)         #@pred
            loss = mse(eps, eps_pred)       #@loss
            adam_update(params, loss)       #@upd
        # step {{step:0}}   loss {{loss:…}}
      `,
      beats: [
        { id: 'net', say: 'The network is small: a multilayer perceptron with three hidden layers of sixty four units, about ten thousand weights.', code: 'net' },
        { id: 'inputs', say: 'Its inputs are the noisy point and the step number, each turned into sines and cosines at a few frequencies, so a small network can bend sharply.', code: 'net' },
        { id: 'train', say: 'We train it for three thousand steps, a hundred and twenty eight points per step, with Adam.', code: ['loop', 'batch', 'pred', 'loss', 'upd'] },
        { id: 'curve', say: 'The loss drops fast, from one to about {0.2|zero point two}, and then barely moves.', code: 'loss' },
        { id: 'snap1', say: 'But watch what the network can generate along the way. After thirty steps, its samples are a vague smear.' },
        { id: 'snap2', say: 'After a hundred steps, a rough outline.' },
        { id: 'snap3', say: 'After three hundred, the moons appear, and by three thousand they are crisp.' },
        { id: 'flat', say: 'Quality kept improving long after the loss looked flat. Most of the remaining loss is unavoidable: at high noise, nobody could tell which noise was added.' },
        { id: 'browser', say: 'And the whole run is tiny: ten thousand weights and three thousand steps, done in well under a minute on a laptop.' },
      ],
    },
    {
      id: 'sampling',
      title: 'Walking back from noise',
      codeTitle: 'ddpm_sample.py',
      code: `
        x = np.random.randn(500, 2)       #@init
        for t in range(T, 0, -1):         #@loop
            eps_pred = model(x, t)        #@pred
            s = np.sqrt(1 - alpha_bar[t]) #@mean
            x = x - beta[t] / s * eps_pred  #@mean
            x = x / np.sqrt(alpha[t])     #@shrink
            if t > 1:                     #@noise
                z = np.random.randn(500, 2)   #@noise
                x = x + np.sqrt(beta[t]) * z  #@noise
        # t = {{t:100}}
      `,
      beats: [
        { id: 'start', say: 'Now generation. Start from pure noise: points drawn from a standard bell curve.', code: 'init' },
        { id: 'each', say: 'At each step, from t equals one hundred down to one, ask the network for its noise guess.', code: ['loop', 'pred'] },
        { id: 'remove', say: 'Subtract the small share of that noise which belongs to this one step,', code: 'mean' },
        { id: 'unshrink', say: 'and divide by the square root of alpha t, to undo the step\'s shrink.', code: 'shrink' },
        { id: 'fresh', say: 'Then add back a little fresh noise, with variance beta t, except at the very last step.', code: 'noise' },
        { id: 'watch', say: 'Watch it run. For a long time, not much seems to happen.', code: ['pred', 'mean', 'shrink', 'noise'] },
        { id: 'late', say: 'Then, in the last twenty or so steps, the moons condense out of the fog.', code: ['pred', 'mean', 'shrink', 'noise'] },
        { id: 'mean', say: 'The first part is the network\'s estimate of where the previous point lies on average. The fresh noise then draws a sample around that average.', code: 'mean' },
        { id: 'nonoise', say: 'Is the fresh noise really needed? Let us switch it off and run again.', code: 'noise' },
        { id: 'collapse', say: 'Every point slides to almost the same spot. Averaging, step after step, with nothing to restore the spread, squeezes everything together.' },
      ],
    },
    {
      id: 'ddim',
      title: 'Fewer steps with DDIM',
      codeTitle: 'ddim_sample.py',
      code: `
        ts = np.linspace(T, 0, k + 1).astype(int)  #@grid
        for t, s in zip(ts[:-1], ts[1:]):  #@loop
            eps_pred = model(x, t)         #@pred
            a = np.sqrt(alpha_bar[t])      #@hat
            b = np.sqrt(1 - alpha_bar[t])  #@hat
            x0_hat = (x - b * eps_pred) / a  #@hat
            a = np.sqrt(alpha_bar[s])      #@renoise
            b = np.sqrt(1 - alpha_bar[s])  #@renoise
            x = a * x0_hat + b * eps_pred  #@renoise
        # k = {{k:20}} network calls
      `,
      beats: [
        { id: 'slow', say: 'A hundred network calls for every sample is slow, and the image models of {2020|twenty twenty} used a thousand.' },
        { id: 'ddim', say: 'Later that year, Song, Meng and Ermon found a faster sampler for the very same trained network. It is called DDIM.' },
        { id: 'guess', say: 'At each step, use the noise guess to compute the clean point it implies: {x̂_0|x zero hat}.', code: ['pred', 'hat'] },
        { id: 'renoise', say: 'Then mix that guess with the same predicted noise, at a lower noise level, using the jump formula once more.', code: 'renoise' },
        { id: 'det', say: 'There is no fresh noise anywhere, so the path is deterministic: the same starting noise always gives the same result.' },
        { id: 'skip', say: 'And because nothing is random, it can skip steps. Here are twenty network calls instead of a hundred.', code: ['grid', 'loop'] },
        { id: 'smooth', say: 'The paths become smooth curves, and the result looks about as good as the full hundred.' },
        { id: 'five', say: 'Push it down to five calls, and the moons go blurry: each jump is too long to follow a curved path. Hold on to that thought.', code: 'grid' },
      ],
    },
    {
      id: 'score',
      title: 'Arrows toward the data',
      codeTitle: 'score.py',
      code: `
        def score(x, t):                  #@def
            eps_pred = model(x, t)        #@pred
            s = np.sqrt(1 - alpha_bar[t]) #@scale
            return -eps_pred / s          #@flip
        # t = {{t:80}}
      `,
      beats: [
        { id: 'what', say: 'What has the network actually learned? At every point of the plane, and at every noise level, it outputs a little vector.', code: 'pred' },
        { id: 'flip', say: 'Flip its sign, and it points the way the noisy data gets denser.', code: 'flip' },
        { id: 'far', say: 'At high noise, all the arrows point roughly at the center. With that much noise, the best guess for any point is simply the middle of the data.' },
        { id: 'near', say: 'As the noise level falls, the field sharpens, and the arrows bend toward the nearest moon.' },
        { id: 'name', say: 'Statisticians call this direction the score: the gradient of the log of the probability density. An arrow pointing uphill, toward likely data.', code: 'def' },
        { id: 'equal', say: 'And our noise prediction, flipped and divided by the noise level, is an estimate of exactly that.', code: ['scale', 'flip'] },
        { id: 'history', say: 'Song and Ermon reached diffusion from this side in {2019|twenty nineteen}, by learning scores at many noise levels. Two years later, Song and colleagues showed both views describe one continuous process.' },
        { id: 'follow', say: 'So sampling is just this: follow the arrows, while the noise level slowly drops.' },
      ],
    },
    {
      id: 'guidance',
      title: 'Steering with a label',
      codeTitle: 'guidance.py',
      code: `
        # training: hide the label 1 time in 5
        c = NULL if rand() < 0.2 else label   #@drop

        # sampling: ask twice, then push
        eps_u = model(x, t, NULL)        #@u
        eps_c = model(x, t, c)           #@c
        eps_pred = eps_u + w * (eps_c - eps_u)  #@mix
        # w = {{w:1}}
      `,
      beats: [
        { id: 'ask', say: 'So far the model draws from the whole data set. What if we want something specific: one moon, a class, or a caption?' },
        { id: 'cond', say: 'Give the network the request as an extra input, the condition c. For our toy, which moon to draw.', code: 'c' },
        { id: 'drop', say: 'The trick, called classifier free guidance, by Ho and Salimans, is to also hide the label during training, about one time in five. One network learns both with and without it.', code: 'drop' },
        { id: 'twice', say: 'At sampling time, run the network twice: once with the label and once without.', code: ['u', 'c'] },
        { id: 'push', say: 'The difference between the two answers is a direction: more like this class. Guidance starts from the unlabeled answer and steps w times along that direction.', code: 'mix' },
        { id: 'w0', say: 'With w equal to zero, the label is ignored, and both colors land on both moons.', code: 'mix' },
        { id: 'w1', say: 'At w equals one, plain conditioning, nearly every sample obeys.', code: 'mix' },
        { id: 'w4', say: 'Push w to four, and every sample lands on its own moon. But they pile up on the parts farthest from the other moon, and a few overshoot the data.', code: 'mix' },
        { id: 'trade', say: 'That is the trade of guidance: faithfulness to the condition, bought with diversity. Image models show it as more literal, more saturated pictures. Stable Diffusion\'s default scale is {7.5|seven and a half}.' },
      ],
    },
    {
      id: 'latent',
      title: 'Latents and transformers',
      codeTitle: 'latent_diffusion.py',
      code: `
        z0 = encoder(image)              #@enc
        # (3, 512, 512) -> (4, 64, 64)   #@enc
        zt = mix(z0, eps, t)             #@mix
        loss = mse(eps, model(zt, t, c)) #@mix
        z = sample(model, c)             #@sample
        image = decoder(z)               #@dec

        tokens = patchify(zt, p=2)       #@dit
      `,
      beats: [
        { id: 'cost', say: 'On real images, the network runs over every pixel, at every step. One color image of {512|five hundred and twelve} pixels square is about seven hundred and eighty six thousand numbers.' },
        { id: 'ldm', say: 'Latent diffusion, by Rombach and colleagues, released as Stable Diffusion in {2022|twenty twenty two}, splits the job in two.' },
        { id: 'ae', say: 'First, train an autoencoder. Its encoder shrinks the image eight times on each side, into a sixty four by sixty four grid of four numbers each.', code: 'enc' },
        { id: 'fewer', say: 'That is forty eight times fewer numbers, and the decoder learns to paint the fine texture back.', code: 'dec' },
        { id: 'same', say: 'Then run ordinary diffusion on those latents. Same loss, same samplers, and one decoder call at the very end.', code: ['mix', 'sample', 'dec'] },
        { id: 'text', say: 'For text prompts, a frozen text encoder turns the caption into vectors, and the denoiser reads them through cross attention.', code: 'mix' },
        { id: 'unet', say: 'That denoiser was a U-Net: a convolutional network that shrinks the image and grows it back, with skip connections between matching sizes.' },
        { id: 'dit', say: 'In {2022|twenty twenty two}, Peebles and Xie replaced it with a plain transformer, the diffusion transformer, or {DiT|dit}. Cut the latent into two by two patches, treat each patch as a token, and run transformer blocks.', code: 'dit' },
        { id: 'adaln', say: 'The step number and the class enter through adaptive layer norm, which sets the scale and shift of every layer.' },
        { id: 'scale', say: 'And sample quality improved steadily with compute, just as with language models. Stable Diffusion three and OpenAI\'s video model, Sora, both build on diffusion transformers.' },
      ],
    },
    {
      id: 'flow',
      title: 'Flow matching: straight paths',
      codeTitle: 'flow_matching.py',
      code: `
        t = np.random.rand()             #@t
        xt = (1 - t) * x0 + t * eps      #@line
        target = eps - x0                #@target
        v_pred = model(xt, t)            #@pred
        loss = mse(target, v_pred)       #@pred

        for i in range(k):               #@euler
            v = model(x, 1 - i / k)      #@euler
            x = x - v / k                #@euler
      `,
      beats: [
        { id: 'back', say: 'Remember the curved path from a clean point to its noise? That curve is why DDIM stumbled with few steps.' },
        { id: 'why', say: 'In {2022|twenty twenty two}, three groups independently asked the obvious question: why not a straight line?' },
        { id: 'names', say: 'The idea goes by flow matching, or rectified flow.' },
        { id: 'line', say: 'Let time run from zero to one, and place the point on the straight segment between the clean point and its noise.', code: ['t', 'line'] },
        { id: 'vel', say: 'Along a straight line the velocity never changes: noise minus data. That is the target.', code: 'target' },
        { id: 'train', say: 'Train the network to predict that velocity, with the same squared error as before.', code: 'pred' },
        { id: 'avg', say: 'The network never sees which pair a point came from, so it learns the average direction of all the lines through it. Following that average still carries noise exactly onto data.' },
        { id: 'euler', say: 'To sample, start from noise at time one, and take straight Euler steps back to zero.', code: 'euler' },
        { id: 'four', say: 'With four network calls, flow matching already draws two clean moons, while DDIM with four calls is still scattered.', code: 'euler' },
        { id: 'sd3', say: 'Stable Diffusion three uses exactly this, rectified flow with a transformer. Distillation methods then push generation down to just a few steps.' },
      ],
    },
    {
      id: 'outro',
      title: 'The whole picture',
      codeTitle: 'recap.py',
      code: `
        xt = a * x0 + b * eps          # forward  #@fwd
        loss = mse(eps, model(xt, t))  # train    #@train
        x = ddpm_or_ddim(model)        # sample   #@sample
        score = -eps_pred / b          # arrows   #@score
        e = eps_u + w * (eps_c - eps_u)  # guide  #@cfg
        z = encoder(image)             # latents  #@latent
        x = x - v / k                  # flow     #@flow
      `,
      beats: [
        { id: 'recap', say: 'Let us put it all together.' },
        { id: 'fwd', say: 'The forward process adds noise in small steps, and alpha bar lets us jump to any step at once.', code: 'fwd' },
        { id: 'train', say: 'Training is plain regression: predict the noise.', code: 'train' },
        { id: 'sample', say: 'Sampling walks back from pure noise: with fresh noise in DDPM, or deterministically, and faster, with DDIM.', code: 'sample' },
        { id: 'score', say: 'The network\'s output is a score: arrows pointing toward the data.', code: 'score' },
        { id: 'cfg', say: 'Guidance steers with a label, trading diversity for faithfulness.', code: 'cfg' },
        { id: 'latent', say: 'Latents and transformers make it affordable at the scale of real images and video.', code: 'latent' },
        { id: 'flow', say: 'And flow matching straightens the paths, so that a few steps go a long way.', code: 'flow' },
        { id: 'next', say: 'Next, post-training begins: how a model that only predicts text becomes an assistant, with fine-tuning on conversations and low-rank adapters.', pause: 0.6 },
      ],
    },
  ],
};
