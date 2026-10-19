import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'unsupervised',
  title: 'Video and unsupervised learning',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Two directions',
      codeTitle: 'lecture_14.py',
      code: `
        # direction 1: time                  #@video
        clip = video[t:t + 16]               #@video
        clip.shape   # (16, 3, H, W)         #@video

        # direction 2: no labels             #@data
        X = photos           # and no y      #@data
        z = encode(X)        # autoencoder   #@ae
        x_new = decode(z)    # VAE           #@vae
        x_fake = G(z)        # GAN           #@gan
      `,
      beats: [
        { id: 'hello', say: 'Welcome to the last lecture of the 2016 course. It points in two directions at once.' },
        { id: 'time', say: 'The first is time. A video is a stack of images, so the question becomes where a ConvNet should mix different moments.', code: 'video' },
        { id: 'labels', say: 'The second is learning without labels. Every network so far needed people to label thousands of examples.', code: 'data' },
        { id: 'free', say: 'But unlabeled photos and videos are nearly free. Can we learn from them alone?', code: 'data' },
        { id: 'ae', say: 'You will meet three ideas. Autoencoders squeeze their input into a small code, then rebuild it.', code: 'ae' },
        { id: 'vae', say: 'Variational autoencoders make that code something you can sample, to generate new data.', code: 'vae' },
        { id: 'gan', say: 'And generative adversarial networks pit a generator against a critic.', code: 'gan', pause: 0.3 },
      ],
    },
    {
      id: 'fusion',
      title: 'Where to fuse time',
      codeTitle: 'fusion.py',
      code: `
        clip = video[t:t+10]  # (10, 3, H, W)  #@clip
        # single frame: an ordinary ConvNet
        s = cnn(video[t + 5])                #@single
        # late: two frames, 15 apart
        f1 = tower(video[t])   # same weights  #@late
        f2 = tower(video[t + 15])            #@late
        s = fc(np.concatenate([f1, f2]))     #@late
        # early: 10 frames as 30 channels
        h = clip.reshape(30, H, W)           #@early
        s = cnn(h)   # conv1: 11 x 11 x 30   #@early
        # slow: 3-D convs, a little at a time
        h = conv3d(clip, t=4, stride_t=2)    #@slow
        h = conv3d(h, t=2, stride_t=2)       #@slow
        h = conv3d(h, t=2, stride_t=2)       #@slow
        s = fc(h)                            #@slow
      `,
      beats: [
        { id: 'array', say: 'A color video clip is a four dimensional array: T frames, each an image of {3 × H × W|three by H by W} numbers.', code: 'clip' },
        { id: 'task', say: 'The classic task is action recognition: given a clip, say what is happening, like juggling.', code: 'clip' },
        { id: 'data', say: 'Benchmarks included {UCF-101|U C F one oh one}, thirteen thousand clips of a hundred and one actions, and {Sports-1M|Sports one M}, a million YouTube sports videos.' },
        { id: 'before', say: 'Before ConvNets, the best systems tracked many points through the video, and described the motion around each track: dense trajectories.' },
        { id: 'where', say: 'Can a ConvNet learn such features instead? And where in the network should the frames meet?' },
        { id: 'single', say: 'Karpathy and colleagues compared four answers. Single frame: an ordinary ConvNet on one frame, blind to time.', code: 'single' },
        { id: 'late', say: 'Late fusion runs the same network on two frames fifteen apart, and compares them only at the top.', code: 'late' },
        { id: 'early', say: 'Early fusion stacks ten frames as thirty input channels, so the first filters see them all, but only once.', code: 'early' },
        { id: 'slow', say: 'Slow fusion uses 3-D convolutions that merge a few neighboring moments at each layer.', code: 'slow' },
        { id: 'result', say: 'The result was humbling: single frame was already strong, and slow fusion won by only a point or two.', code: ['single', 'slow'] },
        { id: 'why', say: 'Much of a sport shows in one frame: a pool, a ring, a pitch. Still, slow fusion\'s building block deserves a closer look.', pause: 0.3 },
      ],
    },
    {
      id: 'conv3d',
      title: '3-D convolution',
      codeTitle: 'conv3d.py',
      code: `
        x = video        # (8, 10, 10): T, H, W   #@x
        wt = np.array([{{wt:-1, 1}}])   # time    #@w
        t = len(wt)      # depth: {{t:2}}          #@w
        w = np.ones((t, 3, 3)) / 9            #@w
        w *= wt[:, None, None]                #@w
        T_out = 8 - t + 1   # {{To:7}} frames      #@out
        y = np.zeros((T_out, 8, 8))           #@out
        for k in range(T_out):    # time      #@k
            for i in range(8):    # rows      #@ij
                for j in range(8):  # cols    #@ij
                    b = x[k:k+t, i:i+3, j:j+3]    #@sum
                    y[k, i, j] = np.sum(w * b)    #@sum
        # y[{{k:0}}] reads frames {{f0:0}} to {{f1:1}}     #@k
      `,
      beats: [
        { id: 'recall', say: 'A 2-D convolution slides a small filter over the rows and columns of an image, multiplying and adding at every spot.', code: ['ij', 'sum'] },
        { id: 'block', say: 'A 3-D convolution also slides along time. The filter is a little block: a few frames deep, and three by three in space.', code: 'w' },
        { id: 'sum', say: 'Each output is the filter times the video block under it, summed: the 2-D loop, plus one loop for time.', code: ['k', 'ij', 'sum'] },
        { id: 'square', say: 'Here is a tiny video: a bright square that moves one pixel right on every frame.', code: 'x' },
        { id: 'diff', say: 'Give the filter a weight of minus one on one frame and plus one on the next. It measures how much each pixel brightened.', code: 'w' },
        { id: 'edges', say: 'Slide it through time. The output glows orange at the square\'s leading edge, and blue at its trailing edge. The filter sees motion.', code: ['k', 'sum'] },
        { id: 'depth1', say: 'Make the filter one frame deep, and there is nothing to compare: the output is just a blurred copy, blind to motion.', code: 'w' },
        { id: 'shrink', say: 'The output also has eight minus t plus one frames: deeper filters shorten a clip, as wider ones shrink an image.', code: 'out' },
        { id: 'c3d', say: '{C3D|C 3 D}, in 2015, took this all the way: a deep, {VGG|V G G} style network built only from {3 × 3 × 3|three by three by three} convolutions.' },
        { id: 'features', say: 'Its features, fed to a linear classifier, worked well across many video tasks.', pause: 0.3 },
      ],
    },
    {
      id: 'streams',
      title: 'Motion and memory',
      codeTitle: 'two_stream.py',
      code: `
        # appearance: one RGB frame            #@spatial
        s1 = spatial_net(clip[5])              #@spatial
        # motion: optical flow, 2 numbers/pixel  #@flow
        flow = optical_flow(clip)  # (10,2,H,W)  #@flow
        stack = flow.reshape(20, H, W)         #@temporal
        s2 = temporal_net(stack)               #@temporal
        s = (s1 + s2) / 2   # average scores   #@avg

        # long range: an LSTM over time        #@lstm
        feats = [cnn(f) for f in video]        #@feats
        h, c = np.zeros(512), np.zeros(512)    #@lstm
        for f_t in feats:                      #@lstm
            h, c = lstm_step(f_t, h, c)        #@lstm
        s = W_out.dot(h)    # one label        #@out

        # recurrent conv: h is a feature map   #@rconv
        h = conv_gru_step(x_t, h)  # (C, H, W)  #@rconv
      `,
      beats: [
        { id: 'route', say: 'Simonyan and Zisserman took another route: instead of hoping a network learns motion, feed it motion.' },
        { id: 'flow', say: 'Optical flow says how far each pixel moved between two frames: two numbers per pixel, a horizontal and a vertical step.', code: 'flow' },
        { id: 'spatial', say: 'Their network has two streams. The spatial stream, an ordinary ConvNet on one color frame, sees appearance.', code: 'spatial' },
        { id: 'temporal', say: 'The temporal stream sees motion: the flow of ten frames, stacked as twenty channels.', code: ['flow', 'temporal'] },
        { id: 'avg', say: 'At the end, their class scores are averaged.', code: 'avg' },
        { id: 'surprise', say: 'Surprisingly, motion alone beat appearance. Together they reached about eighty eight percent on {UCF-101|U C F one oh one}, edging out the best hand designed features.' },
        { id: 'short', say: 'Still, a 3-D ConvNet or a flow stack covers well under a second, and many events last much longer.' },
        { id: 'lstm', say: 'So run a ConvNet on every frame, and feed the feature vectors, in order, into an {LSTM|L S T M}.', code: ['feats', 'lstm'] },
        { id: 'carry', say: 'Its memory spans the whole video, and its final state gives one label for all of it.', code: ['lstm', 'out'] },
        { id: 'rconv', say: 'Ballas and colleagues went further: a {GRU|G R U} whose matrix multiplies are convolutions, so the memory is itself a feature map.', code: 'rconv' },
        { id: 'mix', say: 'In practice, the best systems combined these ideas.', pause: 0.3 },
      ],
    },
    {
      id: 'unlabeled',
      title: 'Learning without labels',
      codeTitle: 'labels.py',
      code: `
        # supervised: data comes in pairs      #@sup
        X, y = images, labels                  #@sup
        f = fit(X, y)       # learn x -> y     #@sup
        # the slow part: a person wrote each y   #@cost

        # unsupervised: just the data          #@un
        X = images          # no y at all      #@un
        z = encode(X)       # learn features   #@feat
        x_new = sample(model_of(X))  # generate  #@gen
      `,
      beats: [
        { id: 'sofar', say: 'So far, everything has been supervised: data x comes with labels y, and we learn to map one to the other.', code: 'sup' },
        { id: 'cost', say: 'Labels are the expensive part. Someone looked at every one of ImageNet\'s million training images.', code: 'cost' },
        { id: 'unsup', say: 'Unsupervised learning gets only the data, and looks for structure in it.', code: 'un' },
        { id: 'kinds', say: 'Clusters, a few directions that explain most of the variation, useful features, or how probable each point is.' },
        { id: 'feat', say: 'The 2016 lecture focused on two kinds. First, learning features: a compact code for each input, useful later.', code: 'feat' },
        { id: 'gen', say: 'Second, generative models: learn the data\'s distribution well enough to make new samples.', code: 'gen', pause: 0.3 },
      ],
    },
    {
      id: 'autoencoder',
      title: 'Autoencoders',
      codeTitle: 'autoencoder.py',
      code: `
        X = data        # (150, 2), no labels  #@X

        def encode(X):  # 2 numbers -> 1       #@enc
            return {{enc:X.dot(W_e) + b_e}}    #@enc
        def decode(z):  # 1 number -> 2        #@dec
            return {{dec:z.dot(W_d) + b_d}}    #@dec

        for step in range(2000):
            z = encode(X)       # (150, 1)     #@z
            x_hat = decode(z)   # (150, 2)     #@xhat
            d = X - x_hat                      #@loss
            loss = np.mean(np.sum(d**2, 1))    #@loss
            backprop_and_adam(loss)            #@upd
        # step {{step:0}}, loss {{loss:…}}

        feats = encode(X_new)   # no decoder   #@keep
        # 2006-2010: pretrain layer by layer   #@greedy
        noise = np.random.randn(*X.shape)      #@noise
        x_hat = decode(encode(X + 0.3 * noise))  #@noise
      `,
      beats: [
        { id: 'idea', say: 'An autoencoder is a network trained to reproduce its own input, through a bottleneck.' },
        { id: 'enc', say: 'An encoder squeezes the input x into a small code z.', code: 'enc' },
        { id: 'dec', say: 'A decoder expands z back into a reconstruction, x hat. The code is too small to copy x, so it must capture what matters most.', code: 'dec' },
        { id: 'loss', say: 'The loss is the squared difference between input and output. No labels needed: the input is its own target.', code: 'loss' },
        { id: 'toy', say: 'Here is the smallest version: points on an arc, each squeezed through a single number.', code: ['X', 'z'] },
        { id: 'curve', say: 'The purple curve is all the decoder can make as z sweeps its range. Gray lines join each point to its reconstruction.', code: 'xhat' },
        { id: 'linear', say: 'A linear encoder and decoder can only make a straight line.', code: ['enc', 'dec'] },
        { id: 'pca', say: 'Training finds the best line, the first principal component, just as {PCA|P C A} would. On an arc, most points end up far from home.', code: ['loss', 'upd'] },
        { id: 'nonlin', say: 'Now give both a hidden layer of sixteen {tanh|tan h} units, and train again.', code: ['enc', 'dec'] },
        { id: 'bend', say: 'The curve bends along the arc, and the loss falls from {0.26|zero point two six} to {0.003|zero point zero zero three}.', code: ['loss', 'upd'] },
        { id: 'keep', say: 'Afterward, the decoder is usually dropped. The encoder is a feature extractor learned without labels, ready to feed a classifier or start a supervised network.', code: 'keep' },
        { id: 'history', say: 'From about 2006 to 2010, this was how deep networks were trained at all: one layer at a time, each learning to rebuild the layer below.', code: 'greedy' },
        { id: 'fell', say: 'With {ReLUs|ray-loos}, good initialization and batch norm, networks train from random weights, so this had faded by 2016.' },
        { id: 'noise', say: 'A denoising autoencoder corrupts the input and rebuilds the clean version, so the code must capture structure rather than memorize.', code: 'noise' },
        { id: 'gaps', say: 'But a plain autoencoder cannot generate well. Its codes leave gaps, and a random code may decode to garbage.', pause: 0.3 },
      ],
    },
    {
      id: 'vae',
      title: 'A code you can sample',
      codeTitle: 'vae_encoder.py',
      code: `
        # the story of how data is made        #@story
        z = np.random.randn(d)   # the prior   #@prior
        x = decode(z)                          #@prior

        # the encoder outputs a distribution   #@enc
        h = np.tanh(x.dot(W1) + b1)            #@enc
        mu = h.dot(W_mu) + b_mu       # center  #@mu
        logvar = h.dot(W_lv) + b_lv            #@lv
        sigma = np.exp(0.5 * logvar)  # spread  #@lv

        # sampling, reparameterized            #@eps
        eps = np.random.randn(*mu.shape)       #@eps
        z = mu + sigma * eps                   #@z
        # here: mu = {{mu:1.2}}, sigma = {{sigma:0.6}}   #@z
        # dz/dmu = 1, dz/dsigma = eps          #@grad
      `,
      beats: [
        { id: 'vae', say: 'A variational autoencoder, from Kingma and Welling in 2014, turns this into a true generative model.' },
        { id: 'story', say: 'Its story of how data is made: pick a code z at random from a standard bell curve, centered at zero with a spread of one. That bell is the prior.', code: ['story', 'prior'] },
        { id: 'decode', say: 'Then decode it into a data point.', code: 'prior' },
        { id: 'easy', say: 'If that story produces realistic data, generating is easy: sample, then decode.', code: 'prior' },
        { id: 'encoder', say: 'Training also needs the reverse: from a data point to the codes that could have made it. That is the encoder\'s job.', code: 'enc' },
        { id: 'dist', say: 'It outputs a whole distribution: a mean, mu, and a spread, sigma, for each code number.', code: ['mu', 'lv'] },
        { id: 'give', say: 'Not code {0.7|zero point seven}, but a code around {0.7|zero point seven}, give or take {0.1|zero point one}.', code: 'mu' },
        { id: 'logvar', say: 'It predicts the log of sigma squared, since a network output can be any number, but a spread must be positive.', code: 'lv' },
        { id: 'coin', say: 'Training samples a code from that bell. But you cannot backpropagate through a coin flip.' },
        { id: 'trick', say: 'The reparameterization trick: draw plain noise, epsilon, from the standard bell, stretch it by sigma, then shift it by mu.', code: ['eps', 'z'] },
        { id: 'grads', say: 'Same bell, but now z is a smooth function of mu and sigma: nudge either, and every sample slides along. Gradients flow.', code: ['z', 'grad'], pause: 0.3 },
      ],
    },
    {
      id: 'kl',
      title: 'The KL penalty',
      codeTitle: 'kl.py',
      code: `
        def kl_to_prior(mu, sigma):            #@def
            v = sigma**2                       #@def
            kl = mu**2 + v - 1 - np.log(v)     #@kl
            return 0.5 * np.sum(kl)            #@kl
        # kl_to_prior({{mu:1.2}}, {{sigma:0.6}}) = {{kl:0.91}}   #@val

        # the VAE loss, for one x              #@elbo
        mu, sigma = encoder(x)                 #@elbo
        eps = np.random.randn(*mu.shape)       #@elbo
        z = mu + sigma * eps                   #@elbo
        rec = np.sum((x - decoder(z))**2)      #@rec
        rec /= 2 * noise_var                   #@rec
        loss = rec + kl_to_prior(mu, sigma)    #@loss
      `,
      beats: [
        { id: 'loose', say: 'One more ingredient keeps the codes organized. Left alone, the encoder would shrink every sigma, and scatter the centers.' },
        { id: 'gaps', say: 'Then random codes from the prior would land in empty gaps again.' },
        { id: 'kl', say: 'So the loss also charges each encoder bell for differing from the prior, using the Kullback Leibler divergence, or {KL|K L}.', code: 'def' },
        { id: 'kldef', say: 'It measures how different two distributions are. It is never negative, and zero only when they match.', code: 'val' },
        { id: 'closed', say: 'For two bells it has a short formula: half of mu squared, plus sigma squared, minus one, minus the log of sigma squared.', code: 'kl' },
        { id: 'mu', say: 'The mu squared term charges for a center away from zero.', code: ['kl', 'val'] },
        { id: 'sigma', say: 'The rest charges for a spread other than one. It grows whether sigma shrinks or grows.', code: ['kl', 'val'] },
        { id: 'fill', say: 'So every bell is pulled toward the prior. Codes overlap and fill it with no gaps, and a random code decodes to something sensible.' },
        { id: 'elbo', say: 'Together, the {VAE|V A E} maximizes a lower bound on how probable it finds the data: the evidence lower bound.', code: 'elbo' },
        { id: 'terms', say: 'Flip the sign, and the loss is a reconstruction error plus the {KL|K L} penalty.', code: ['rec', 'loss'] },
        { id: 'balance', say: 'One term wants precise codes, the other wants codes that look like the prior. Their balance trades sharpness for organization.', code: 'loss', pause: 0.3 },
      ],
    },
    {
      id: 'vae-live',
      title: 'A tiny VAE',
      codeTitle: 'vae.py',
      code: `
        for step in range(3000):
            x = X[np.random.choice(300, 64)]   #@batch
            mu, logvar = encoder(x)            #@enc
            sigma = np.exp(0.5 * logvar)       #@enc
            eps = np.random.randn(64, 1)       #@z
            z = mu + sigma * eps               #@z
            x_hat = decoder(z)    # (64, 2)    #@dec
            rec = 50 * np.sum((x - x_hat)**2)  #@loss
            kl = mu**2 + sigma**2 - 1 - logvar #@loss
            kl = 0.5 * np.sum(kl)              #@loss
            backprop_and_adam((rec + kl) / 64) #@upd
        # step {{step:0}}  rec {{rec:…}}  kl {{kl:…}}

        x_new = decoder(np.random.randn(200, 1))   #@gen
      `,
      beats: [
        { id: 'setup', say: 'Here is a tiny {VAE|V A E} on three hundred points along an arc, with a one number code.', code: 'batch' },
        { id: 'curve', say: 'The purple curve is the decoder\'s output across z, drawn darker where the prior is more likely.', code: 'dec' },
        { id: 'train', say: 'Each step encodes a batch, samples codes with the trick, decodes, and adds the two loss terms.', code: ['enc', 'z', 'dec', 'loss'] },
        { id: 'along', say: 'Within a couple of thousand steps, the curve lies along the arc.', code: 'upd' },
        { id: 'gen', say: 'Now generate: decode two hundred codes drawn from the standard bell. The blue points are brand new data.', code: 'gen' },
        { id: 'cover', say: 'They cover the arc end to end, because the {KL|K L} term made the codes fill the prior.', code: 'gen' },
        { id: 'blur', say: 'But they hug its middle and miss its thickness. Squared error rewards averaging plausible answers, which is why {VAE|V A E} images look blurry.', code: 'loss' },
        { id: 'faces', say: 'Real {VAEs|V A Es} of the time made blurry but recognizable faces, and walking through z morphed one face smoothly into another.', pause: 0.3 },
      ],
    },
    {
      id: 'gan',
      title: 'A generator and a critic',
      codeTitle: 'gan.py',
      code: `
        z = np.random.randn(64, d)    # noise  #@z
        x_fake = G(z)                          #@G
        x_real = sample_data(64)               #@real
        p = D(x_real)   # P(real), in (0, 1)   #@D

        v_real = np.mean(np.log(D(x_real)))    #@v1
        v_fake = np.mean(np.log(1 - D(x_fake)))  #@v2
        value = v_real + v_fake                #@v
        # D steps to raise value, G to lower it  #@v

        # what G minimizes in practice         #@ns
        loss_G = -np.mean(np.log(D(x_fake)))   #@ns
      `,
      beats: [
        { id: 'game', say: 'Generative adversarial networks, from Goodfellow and colleagues in 2014, skip probabilities altogether. Two networks play a game.' },
        { id: 'G', say: 'A generator, G, turns random noise z into a sample, trying to make it look real.', code: ['z', 'G'] },
        { id: 'D', say: 'A discriminator, D, outputs the probability that a sample is real.', code: ['real', 'D'] },
        { id: 'clf', say: 'D trains as an ordinary classifier, with real samples labeled one and fakes zero. G trains to make D wrong.' },
        { id: 'through', say: 'G never needs a formula for the data\'s probability. It learns only from how D reacts, by backpropagating through D.' },
        { id: 'v1', say: 'Both goals fit in one number, the value. Its first term, the average of log D on real data, is high when D calls real data real...', code: 'v1' },
        { id: 'v2', say: 'and its second is high when D calls the fakes fake.', code: 'v2' },
        { id: 'minmax', say: 'D pushes the value up. G pushes it down.', code: 'v' },
        { id: 'end', say: 'With unlimited capacity, the game ends with G matching the data, and D stuck at one half.' },
        { id: 'flat', say: 'One practical fix matters. Early on, D easily rejects G\'s fakes, and the log of one minus D is nearly flat there: almost no gradient.', code: 'v2' },
        { id: 'ns', say: 'So G maximizes the log of D of G of z instead. Same goal, but a strong gradient exactly when G is bad.', code: 'ns' },
        { id: 'slopes', say: 'At {0.05|zero point zero five}, the old slope is about minus one. The new one is minus twenty.', code: 'ns', pause: 0.3 },
      ],
    },
    {
      id: 'gan-live',
      title: 'A GAN on two bumps',
      codeTitle: 'gan_1d.py',
      code: `
        for step in range(4000):
            x_real = sample_data(64)           #@d
            x_fake = G(np.random.randn(64, 1)) #@d
            loss_D = -np.mean(np.log(D(x_real))  #@d
                     + np.log(1 - D(x_fake)))  #@d
            adam_step(D, loss_D)   # G frozen  #@dupd
            x_fake = G(np.random.randn(64, 1)) #@g
            loss_G = -np.mean(np.log(D(x_fake)))  #@g
            adam_step(G, loss_G)   # D frozen  #@gupd
        # step {{step:0}}  loss_D {{ld:…}}  loss_G {{lg:…}}
      `,
      beats: [
        { id: 'setup', say: 'Here it is on the smallest problem: real data are single numbers, drawn from two bumps.', code: 'd' },
        { id: 'nets', say: 'G maps one random number to one sample. D maps one number to a probability.', code: ['d', 'g'] },
        { id: 'alt', say: 'Training alternates: a step on D with G frozen, then a step on G with D frozen.', code: ['dupd', 'gupd'] },
        { id: 'dmove', say: 'D, in gold, rises where fakes are too few, and dips where they pile up.', code: ['d', 'dupd'] },
        { id: 'gmove', say: 'G then shifts its samples toward what D likes.', code: ['g', 'gupd'] },
        { id: 'jump', say: 'Below is G itself. To turn one bell into two bumps, it must learn a steep jump in the middle.', code: 'g' },
        { id: 'done', say: 'After four thousand rounds, the samples sit on both bumps, and D hovers near one half.' },
        { id: 'reseed', say: 'But runs differ. Here is the same code, from another random seed.' },
        { id: 'collapse', say: 'The generator collapses onto one bump, since those samples fool D for now. This is mode collapse.', code: 'g' },
        { id: 'recover', say: 'This run recovers. Others oscillate, or settle on bumps of the wrong size.' },
        { id: 'hard', say: 'With two networks chasing each other, neither loss says much about quality. In 2016, people coped with careful rules and by watching samples.', pause: 0.3 },
      ],
    },
    {
      id: 'dcgan',
      title: 'DCGAN and latent arithmetic',
      codeTitle: 'dcgan.py',
      code: `
        z = np.random.uniform(-1, 1, 100)      #@z
        h = relu(bn(fc(z).reshape(1024, 4, 4)))  #@G
        h = relu(bn(conv_t(h)))  # (512, 8, 8)   #@G
        h = relu(bn(conv_t(h)))  # (256, 16, 16)  #@G
        h = relu(bn(conv_t(h)))  # (128, 32, 32)  #@G
        img = np.tanh(conv_t(h))  # (3, 64, 64)   #@out
        # D: strided convs, leaky ReLU, no pool  #@D

        z_new = (z_smiling_woman               #@arith
                 - z_neutral_woman             #@arith
                 + z_neutral_man)              #@arith
        img = G(z_new)   # a smiling man       #@men
      `,
      beats: [
        { id: 'fragile', say: 'Early image GANs were small and fragile. {DCGAN|D C GAN}, by Radford and colleagues in 2015, found rules that made them train reliably.' },
        { id: 'rules', say: 'No pooling: strided convolutions in D, transpose convolutions to upsample in G. Batch norm in both, and no fully connected hidden layers.', code: ['G', 'D'] },
        { id: 'acts', say: '{ReLU|Ray-loo} in G with {tanh|tan h} at the output, and leaky {ReLU|ray-loo} in D.', code: ['G', 'out', 'D'] },
        { id: 'results', say: 'It made convincing sixty four by sixty four bedrooms and faces.', code: 'out' },
        { id: 'walk', say: 'Its latent space acted like a coordinate system: walk between two codes, and a TV slowly turns into a window.', code: 'z' },
        { id: 'arith', say: 'Even arithmetic worked: average codes for smiling women, minus neutral women, plus neutral men...', code: 'arith' },
        { id: 'men', say: 'decodes to smiling men.', code: 'men' },
        { id: 'glasses', say: 'Man with glasses, minus man, plus woman, gives a woman with glasses.' },
        { id: 'hybrids', say: 'Others followed: {LAPGAN|lap GAN} built images coarse to fine, and hybrids put a GAN critic on a {VAE|V A E} to sharpen it.', pause: 0.3 },
      ],
    },
    {
      id: 'outro',
      title: 'Recap',
      codeTitle: 'recap.py',
      code: `
        h = conv3d(clip, t=3)    # time        #@video
        s2 = temporal_net(flow)  # motion      #@video
        z = encode(x)            # compress    #@ae
        z = mu + sigma * eps     # sample      #@vae
        loss = rec + kl          # VAE loss    #@vae
        loss_G = -np.log(D(G(z)))   # fool D   #@gan
      `,
      beats: [
        { id: 'video', say: 'To recap: video asks where to mix time. Fusion, 3-D convolutions, optical flow, or a recurrent net on top.', code: 'video' },
        { id: 'ae', say: 'Autoencoders learn without labels, by compressing and rebuilding.', code: 'ae' },
        { id: 'vae', say: '{VAEs|V A Es} sample their code with the reparameterization trick, and a {KL|K L} penalty lets random codes decode to new data.', code: 'vae' },
        { id: 'gan', say: 'GANs pit a generator against a critic: sharp samples, unstable training.', code: 'gan' },
        { id: 'next', say: 'All three learn from the data itself, with no labels at all. That is where much of the field went next.' },
        { id: 'dl26', say: 'The {DL26|D L twenty six} course carries the story on from here, with contrastive learning and diffusion models.', pause: 0.6 },
      ],
    },
  ],
};
