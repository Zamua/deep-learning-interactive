"""Train the chapter's two-layer attention-only transformer on periodic random letters.

Writes run.pt with checkpoints every LOG steps and metrics, for export.py to pack.
"""
import math
import sys
import torch

torch.manual_seed(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
torch.set_num_threads(2)

import os
V, T, d, dh = 20, 32, 32, int(os.environ.get('DH', 16))
STEPS = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
LOG = 10
B = int(os.environ.get('BS', 64))
LR = float(sys.argv[3]) if len(sys.argv) > 3 else 1e-3


def batch(n, gen, period=None, length=T):
    P = torch.randint(int(os.environ.get('PMIN', 4)), 17, (n,), generator=gen) if period is None else torch.full((n,), period)
    base = torch.randint(0, V, (n, length), generator=gen)
    idx = torch.arange(length)[None, :] % P[:, None]
    return torch.gather(base, 1, idx)


class Model(torch.nn.Module):
    def __init__(self):
        super().__init__()
        s = 0.1
        self.E = torch.nn.Parameter(torch.randn(V, d) * s)
        self.P = torch.nn.Parameter(torch.randn(T, d) * s)
        self.Wq = torch.nn.Parameter(torch.randn(2, d, dh) / math.sqrt(d))
        self.Wk = torch.nn.Parameter(torch.randn(2, d, dh) / math.sqrt(d))
        self.Wv = torch.nn.Parameter(torch.randn(2, d, dh) / math.sqrt(d))
        self.Wo = torch.nn.Parameter(torch.randn(2, dh, d) / math.sqrt(dh))
        self.U = torch.nn.Parameter(torch.randn(d, V) / math.sqrt(d))

    def forward(self, ids):
        n, L = ids.shape
        x = self.E[ids] + self.P[:L]
        mask = torch.triu(torch.ones(L, L, dtype=torch.bool), 1)
        As = []
        for l in range(2):
            q = x @ self.Wq[l]
            k = x @ self.Wk[l]
            v = x @ self.Wv[l]
            s = q @ k.transpose(1, 2) / math.sqrt(dh)
            s = s.masked_fill(mask, float('-inf'))
            a = s.softmax(-1)
            As.append(a)
            x = x + (a @ v) @ self.Wo[l]
        return x @ self.U, As


m = Model()
opt = torch.optim.AdamW(m.parameters(), lr=LR, betas=(0.9, 0.98), weight_decay=float(os.environ.get('WD', 0)))
gen = torch.Generator().manual_seed(1)
egen = torch.Generator().manual_seed(2)
ev = batch(256, egen, period=12, length=24)
evr = batch(256, egen)

ckpts, metrics = [], []


def evaluate(step, train_loss):
    with torch.no_grad():
        lg, (A0, A1) = m(ev)
        lp = lg.log_softmax(-1)
        nll = -lp[:, :-1].gather(2, ev[:, 1:, None])[..., 0]  # (n, 23): position i predicts i+1
        first = nll[:, :11].mean().item()
        rep = nll[:, 12:].mean().item()
        ind = torch.stack([A1[:, i, i - 11] for i in range(12, 24)], 1).mean().item()
        prev = torch.stack([A0[:, i, i - 1] for i in range(1, 24)], 1).mean().item()
        lg2, _ = m(evr)
        rl = torch.nn.functional.cross_entropy(lg2[:, :-1].reshape(-1, V), evr[:, 1:].reshape(-1)).item()
    metrics.append(dict(step=step, train=train_loss, first=first, rep=rep, ind=ind, prev=prev, evr=rl))
    ckpts.append({k: v.detach().clone() for k, v in m.state_dict().items()})


tl = math.log(V)
for step in range(STEPS + 1):
    if step % LOG == 0:
        evaluate(step, tl)
        if step % 200 == 0:
            mm = metrics[-1]
            print(f"{step:5d} train {mm['train']:.3f} first {mm['first']:.3f} rep {mm['rep']:.3f} ind {mm['ind']:.3f} prev {mm['prev']:.3f}", flush=True)
    if step == STEPS:
        break
    ids = batch(B, gen)
    lg, _ = m(ids)
    loss = torch.nn.functional.cross_entropy(lg[:, :-1].reshape(-1, V), ids[:, 1:].reshape(-1))
    opt.zero_grad()
    loss.backward()
    opt.step()
    tl = 0.9 * tl + 0.1 * loss.item() if step else loss.item()

torch.save(dict(ckpts=ckpts, metrics=metrics, cfg=dict(V=V, T=T, d=d, dh=dh, B=B, LR=LR, STEPS=STEPS, LOG=LOG)), sys.argv[4] if len(sys.argv) > 4 else 'run.pt')
