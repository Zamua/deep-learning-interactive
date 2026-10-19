"""Tiny ViT on CIFAR-10, exactly ViT eqs 1-4 at small size. Exports fp16 weights for the browser.

usage: python -I train_vit.py <cifar-10-batches-bin dir> <out prefix> <pos 0|1> <epochs>
"""
import json, math, sys, time
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

root, out, use_pos, epochs = sys.argv[1], sys.argv[2], sys.argv[3] == '1', int(sys.argv[4])
torch.manual_seed(10)
np.random.seed(10)
dev = 'mps' if torch.backends.mps.is_available() else 'cpu'


def load(names):
    raw = np.concatenate([np.fromfile(f'{root}/{n}', dtype=np.uint8) for n in names]).reshape(-1, 3073)
    return raw[:, 1:].reshape(-1, 3, 32, 32), raw[:, 0].astype(np.int64)


Xtr, ytr = load([f'data_batch_{i}.bin' for i in range(1, 6)])
Xte, yte = load(['test_batch.bin'])
mean = (Xtr.reshape(-1, 3, 1024) / 255.0).mean((0, 2))
std = (Xtr.reshape(-1, 3, 1024) / 255.0).std((0, 2))


def prep(X):
    x = torch.tensor(X, dtype=torch.float32) / 255.0
    return (x - torch.tensor(mean, dtype=torch.float32).view(1, 3, 1, 1)) / torch.tensor(std, dtype=torch.float32).view(1, 3, 1, 1)


Xtr_t, ytr_t = prep(Xtr).to(dev), torch.tensor(ytr).to(dev)
Xte_t, yte_t = prep(Xte).to(dev), torch.tensor(yte).to(dev)

P, D, L, H, M = 4, 64, 6, 4, 256
G = 32 // P
N = G * G


class Block(nn.Module):
    def __init__(s):
        super().__init__()
        s.ln1 = nn.LayerNorm(D, eps=1e-6)
        s.qkv = nn.Linear(D, 3 * D)
        s.proj = nn.Linear(D, D)
        s.ln2 = nn.LayerNorm(D, eps=1e-6)
        s.fc1 = nn.Linear(D, M)
        s.fc2 = nn.Linear(M, D)

    def forward(s, z):
        B, T, _ = z.shape
        dk = D // H
        q, k, v = s.qkv(s.ln1(z)).view(B, T, 3, H, dk).permute(2, 0, 3, 1, 4)
        A = (q @ k.transpose(-1, -2) / math.sqrt(dk)).softmax(-1)
        z = z + s.proj((A @ v).transpose(1, 2).reshape(B, T, D))
        return z + s.fc2(F.gelu(s.fc1(s.ln2(z)), approximate='tanh'))


class ViT(nn.Module):
    def __init__(s):
        super().__init__()
        s.E = nn.Linear(P * P * 3, D, bias=False)
        s.cls = nn.Parameter(torch.zeros(1, 1, D))
        s.pos = nn.Parameter(torch.randn(1, N + 1, D) * 0.02) if use_pos else None
        s.blocks = nn.ModuleList([Block() for _ in range(L)])
        s.ln = nn.LayerNorm(D, eps=1e-6)
        s.head = nn.Linear(D, 10)

    def forward(s, x):
        B = x.shape[0]
        # (B, 3, 32, 32) -> (B, N, P*P*3), each patch flattened row, column, channel
        xp = x.view(B, 3, G, P, G, P).permute(0, 2, 4, 3, 5, 1).reshape(B, N, P * P * 3)
        z = torch.cat([s.cls.expand(B, 1, D), s.E(xp)], 1)
        if s.pos is not None:
            z = z + s.pos
        for b in s.blocks:
            z = b(z)
        return s.head(s.ln(z[:, 0]))


def augment(x):
    B = x.shape[0]
    flip = torch.where(torch.rand(B, device=x.device) < 0.5, -1.0, 1.0)
    sh = torch.randint(-4, 5, (B, 2), device=x.device).float() * (2 / 32)
    theta = torch.zeros(B, 2, 3, device=x.device)
    theta[:, 0, 0] = flip
    theta[:, 1, 1] = 1
    theta[:, :, 2] = sh
    grid = F.affine_grid(theta, list(x.shape), align_corners=False)
    return F.grid_sample(x, grid, mode='nearest', padding_mode='reflection', align_corners=False)


model = ViT().to(dev)
nparams = sum(p.numel() for p in model.parameters())
print('params', nparams, flush=True)
decay = [p for n, p in model.named_parameters() if p.ndim >= 2 and 'pos' not in n and 'cls' not in n]
other = [p for n, p in model.named_parameters() if not (p.ndim >= 2 and 'pos' not in n and 'cls' not in n)]
opt = torch.optim.AdamW([{'params': decay, 'weight_decay': 0.05}, {'params': other, 'weight_decay': 0.0}], lr=1e-3, betas=(0.9, 0.999))
bs = 128
steps_per = len(Xtr) // bs
total = epochs * steps_per
warm = 3 * steps_per


def lr_at(t):
    if t < warm:
        return 1e-3 * (t + 1) / warm
    return 1e-3 * 0.5 * (1 + math.cos(math.pi * (t - warm) / max(1, total - warm)))


@torch.no_grad()
def evaluate():
    model.eval()
    correct = 0
    for i in range(0, len(Xte_t), 500):
        correct += (model(Xte_t[i:i + 500]).argmax(1) == yte_t[i:i + 500]).sum().item()
    model.train()
    return correct / len(Xte_t)


t0 = time.time()
step = 0
for ep in range(epochs):
    perm = torch.randperm(len(Xtr_t), device=dev)
    tot = 0.0
    for i in range(steps_per):
        idx = perm[i * bs:(i + 1) * bs]
        for g in opt.param_groups:
            g['lr'] = lr_at(step)
        loss = F.cross_entropy(model(augment(Xtr_t[idx])), ytr_t[idx], label_smoothing=0.1)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        tot += loss.item()
        step += 1
    acc = evaluate() if (ep % 5 == 4 or ep == epochs - 1) else -1
    print(f'epoch {ep + 1} loss {tot / steps_per:.4f} test {acc:.4f} {time.time() - t0:.0f}s', flush=True)

acc = evaluate()
model = model.cpu().eval()
tensors, chunks, off = [], [], 0


def add(name, t):
    global off
    a = t.detach().numpy().astype(np.float16).ravel()
    tensors.append({'name': name, 'shape': list(t.shape), 'offset': off})
    chunks.append(a.tobytes())
    off += a.nbytes


add('E', model.E.weight)
add('cls', model.cls.view(D))
if model.pos is not None:
    add('pos', model.pos.view(N + 1, D))
for i, b in enumerate(model.blocks):
    for n in ['ln1.weight', 'ln1.bias', 'qkv.weight', 'qkv.bias', 'proj.weight', 'proj.bias', 'ln2.weight', 'ln2.bias', 'fc1.weight', 'fc1.bias', 'fc2.weight', 'fc2.bias']:
        mod, attr = n.split('.')
        add(f'b{i}.{mod}.{attr[0]}', getattr(getattr(b, mod), attr))
add('ln.w', model.ln.weight)
add('ln.b', model.ln.bias)
add('head.w', model.head.weight)
add('head.b', model.head.bias)

# reference logits for checking the browser forward pass (fp16 weights, fp32 math)
with torch.no_grad():
    for p_ in model.parameters():
        p_.copy_(p_.half().float())
    ref = model(prep(Xte[:4])).numpy().tolist()
    acc16 = (model(prep(Xte)).argmax(1).numpy() == yte).mean()

open(f'{out}.bin', 'wb').write(b''.join(chunks))
json.dump({
    'P': P, 'D': D, 'L': L, 'H': H, 'M': M, 'pos': use_pos, 'params': nparams,
    'mean': [round(float(v), 6) for v in mean], 'std': [round(float(v), 6) for v in std],
    'testAcc': round(float(acc16), 4), 'epochs': epochs, 'tensors': tensors,
}, open(f'{out}.json', 'w'))
json.dump({'ref': ref, 'acc32': acc}, open(f'{out}.ref.json', 'w'))
print('done', acc, acc16, off, 'bytes', flush=True)
