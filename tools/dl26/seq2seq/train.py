# Trains the chapter's toy translators (English-like -> French-like) and exports their weights.
# Models: two fixed-vector encoder-decoders (H=32, H=64) and two attention models
# (Bahdanau additive score, and a "general" dot-product score), all GRU-based.
import json, math, random, struct, sys, time
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

torch.set_num_threads(8)
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
STEPS = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None

NOUNS = [('cat', 'chat'), ('dog', 'chien'), ('wolf', 'loup'), ('fish', 'poisson'), ('horse', 'cheval'), ('rabbit', 'lapin'), ('fox', 'renard'), ('pig', 'cochon'), ('duck', 'canard'), ('tiger', 'tigre')]
COLORS = [('black', 'noir'), ('white', 'blanc'), ('red', 'rouge'), ('green', 'vert'), ('gray', 'gris'), ('brown', 'brun')]
VERBS = [('sees', 'voit'), ('chases', 'chasse'), ('eats', 'mange'), ('likes', 'aime'), ('follows', 'suit')]
DETS = [('the', 'le'), ('a', 'un')]

SRC = ['<pad>'] + [d for d, _ in DETS] + [n for n, _ in NOUNS] + [c for c, _ in COLORS] + [v for v, _ in VERBS] + ['and']
TGT = ['<pad>', '<bos>', '<eos>'] + [d for _, d in DETS] + [n for _, n in NOUNS] + [c for _, c in COLORS] + [v for _, v in VERBS] + ['et']
SI = {w: i for i, w in enumerate(SRC)}
TI = {w: i for i, w in enumerate(TGT)}
MINL, MAXL = 5, 40


def np_pair(rng, pc=0.5):
    d = rng.choice(DETS); n = rng.choice(NOUNS)
    if rng.random() < pc:
        c = rng.choice(COLORS)
        return [d[0], c[0], n[0]], [d[1], n[1], c[1]]
    return [d[0], n[0]], [d[1], n[1]]


def sentence(rng, k, pc=0.5):
    s, t = np_pair(rng, pc)
    v = rng.choice(VERBS)
    s, t = s + [v[0]], t + [v[1]]
    for i in range(k):
        if i:
            s.append('and'); t.append('et')
        a, b = np_pair(rng, pc)
        s += a; t += b
    return s, t


def make_buckets(n, seed):
    rng = random.Random(seed)
    B = {L: [] for L in range(MINL, MAXL + 1)}
    while sum(len(v) for v in B.values()) < n:
        s, t = sentence(rng, rng.randint(1, 10), rng.random())
        if MINL <= len(s) <= MAXL and len(B[len(s)]) < n // (MAXL - MINL + 1) + 1:
            B[len(s)].append((s, t))
    return B


class EncDec(nn.Module):
    """Fixed-vector encoder-decoder: the encoder's last state is the only link (fed to every decoder step)."""

    def __init__(self, H, E=16):
        super().__init__()
        self.H = H
        self.semb = nn.Embedding(len(SRC), E)
        self.temb = nn.Embedding(len(TGT), E)
        self.enc = nn.GRU(E, H, batch_first=True)
        self.dec = nn.GRUCell(E + H, H)
        self.out = nn.Linear(2 * H, len(TGT))

    def encode(self, x):
        _, h = self.enc(self.semb(x))
        return h[0]

    def forward(self, x, y_in):
        c = self.encode(x)
        s = c
        logits = []
        for t in range(y_in.shape[1]):
            s = self.dec(torch.cat([self.temb(y_in[:, t]), c], 1), s)
            logits.append(self.out(torch.cat([s, c], 1)))
        return torch.stack(logits, 1)


class Attn(nn.Module):
    """Bahdanau-style: bidirectional encoder, decoder attends over every encoder state each step."""

    def __init__(self, H, E=16, A=16, score='additive'):
        super().__init__()
        self.H, self.score = H, score
        self.semb = nn.Embedding(len(SRC), E)
        self.temb = nn.Embedding(len(TGT), E)
        self.enc = nn.GRU(E, H // 2, batch_first=True, bidirectional=True)
        self.init = nn.Linear(H // 2, H)
        if score == 'additive':
            self.Wa = nn.Linear(H, A, bias=False)
            self.Ua = nn.Linear(H, A, bias=True)
            self.va = nn.Linear(A, 1, bias=False)
        else:
            self.Wg = nn.Linear(H, H, bias=False)
        self.dec = nn.GRUCell(E + H, H)
        self.out = nn.Linear(2 * H, len(TGT))

    def encode(self, x):
        hs, hn = self.enc(self.semb(x))
        s0 = torch.tanh(self.init(hn[1]))  # backward state after reading the first word
        return hs, s0

    def scores(self, s, hs):
        if self.score == 'additive':
            return self.va(torch.tanh(self.Wa(s)[:, None, :] + self.Ua(hs)))[..., 0]
        return torch.einsum('bh,bjh->bj', self.Wg(s), hs)

    def forward(self, x, y_in, ret_alpha=False):
        hs, s = self.encode(x)
        logits, alphas = [], []
        for t in range(y_in.shape[1]):
            a = F.softmax(self.scores(s, hs), 1)
            c = torch.einsum('bj,bjh->bh', a, hs)
            s = self.dec(torch.cat([self.temb(y_in[:, t]), c], 1), s)
            logits.append(self.out(torch.cat([s, c], 1)))
            alphas.append(a)
        if ret_alpha:
            return torch.stack(logits, 1), torch.stack(alphas, 1)
        return torch.stack(logits, 1)


def tensors(pairs):
    x = torch.tensor([[SI[w] for w in s] for s, _ in pairs])
    y = torch.tensor([[TI[w] for w in t] + [TI['<eos>']] for _, t in pairs])
    y_in = torch.cat([torch.full((len(pairs), 1), TI['<bos>']), y[:, :-1]], 1)
    return x, y_in, y


@torch.no_grad()
def greedy(m, x, maxlen):
    B = x.shape[0]
    y = torch.full((B,), TI['<bos>'])
    outs = []
    if isinstance(m, EncDec):
        c = m.encode(x); s = c
        for t in range(maxlen):
            s = m.dec(torch.cat([m.temb(y), c], 1), s)
            y = m.out(torch.cat([s, c], 1)).argmax(1)
            outs.append(y)
    else:
        hs, s = m.encode(x)
        for t in range(maxlen):
            a = F.softmax(m.scores(s, hs), 1)
            c = torch.einsum('bj,bjh->bh', a, hs)
            s = m.dec(torch.cat([m.temb(y), c], 1), s)
            y = m.out(torch.cat([s, c], 1)).argmax(1)
            outs.append(y)
    return torch.stack(outs, 1)


def decode_words(row):
    w = []
    for i in row.tolist():
        if i == TI['<eos>']:
            break
        w.append(TGT[i])
    return w


def evaluate(m, buckets, per=40):
    m.eval()
    res = {}
    for L, pairs in buckets.items():
        pairs = pairs[:per]
        x, _, _ = tensors(pairs)
        out = greedy(m, x, L + 3)
        ok = sum(decode_words(out[i]) == pairs[i][1] for i in range(len(pairs)))
        res[L] = ok / len(pairs)
    m.train()
    return res


def train(name, m, buckets, steps, lr=3e-3, bs=64, seed=0):
    torch.manual_seed(seed)
    rng = random.Random(seed + 1)
    opt = torch.optim.Adam(m.parameters(), lr=lr)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=steps, pct_start=0.05)
    Ls = list(buckets.keys())
    t0 = time.time()
    for it in range(steps):
        L = rng.choice(Ls)
        pairs = rng.sample(buckets[L], bs)
        x, y_in, y = tensors(pairs)
        logits = m(x, y_in)
        loss = F.cross_entropy(logits.reshape(-1, len(TGT)), y.reshape(-1))
        opt.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(m.parameters(), 1.0)
        opt.step()
        sched.step()
        if it % 1000 == 0 or it == steps - 1:
            print(f'{name} step {it} loss {loss.item():.4f} {time.time() - t0:.0f}s', flush=True)
    return m


def export(models, path):
    blob = bytearray()
    manifest = {'src': SRC, 'tgt': TGT, 'models': {}}
    for name, m in models.items():
        entry = {'kind': 'encdec' if isinstance(m, EncDec) else 'attn', 'H': m.H, 'tensors': {}}
        if isinstance(m, Attn):
            entry['score'] = m.score
        for k, v in m.state_dict().items():
            a = v.detach().cpu().numpy().astype('<f4')
            entry['tensors'][k] = {'shape': list(a.shape), 'offset': len(blob) // 4}
            blob += a.tobytes()
        manifest['models'][name] = entry
    with open(f'{path}.bin', 'wb') as f:
        f.write(blob)
    with open(f'{path}.json', 'w') as f:
        json.dump(manifest, f, separators=(',', ':'))
    print('wrote', len(blob), 'bytes')


if __name__ == '__main__':
    train_b = make_buckets(120000, 1)
    test_b = make_buckets((MAXL - MINL + 1) * 60, 999)
    specs = {
        'encdec32': lambda: EncDec(32),
        'encdec64': lambda: EncDec(64),
        'attn': lambda: Attn(32, score='additive'),
        'attndot': lambda: Attn(32, score='general'),
    }
    models = {}
    results = {}
    for name, mk in specs.items():
        if ONLY and name not in ONLY:
            continue
        torch.manual_seed(7)
        m = mk()
        print(name, sum(p.numel() for p in m.parameters()), 'params', flush=True)
        train(name, m, train_b, STEPS)
        r = evaluate(m, test_b)
        results[name] = r
        print(name, ' '.join(f'{L}:{r[L]:.2f}' for L in sorted(r)), flush=True)
        models[name] = m
        torch.save(m.state_dict(), f'{OUT}/{name}.pt')
    json.dump(results, open(f'{OUT}/results.json', 'w'))
    export(models, f'{OUT}/seq2seq-models')
