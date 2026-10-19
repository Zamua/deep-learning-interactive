import torch, numpy as np, base64, json, math
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../..')
r = torch.load('final.pt')
cfg = r['cfg']; ms = r['metrics']; cks = r['ckpts']
steps = [m['step'] for m in ms]
CK = [0, 100, 200, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 1000, 1200, 1500, 2000, 3000, 4000]
ORDER = ['E', 'P', 'Wq', 'Wk', 'Wv', 'Wo', 'U']
def flat(sd):
    return np.concatenate([sd[k].numpy().astype(np.float32).ravel() for k in ORDER])
blob = np.concatenate([flat(cks[steps.index(s)]) for s in CK])
blob.tofile(os.path.join(ROOT, 'public/data/interpretability-induction.bin'))
per = flat(cks[-1]).size
print('params per ckpt', per, 'bytes', blob.nbytes)
cur = [m for m in ms if (m['step'] <= 1500 and m['step'] % 10 == 0) or m['step'] % 50 == 0]
curves = {k: [round(m[k], 3) for m in cur] for k in ('rep', 'first', 'ind', 'prev')}
curves['step'] = [m['step'] for m in cur]
b64 = lambda s: base64.b64encode(flat(cks[steps.index(s)]).tobytes()).decode()
ts = f"""// Generated: the induction model's training curves and two of its checkpoints (see interpretability-model.ts).

/** Training steps of the checkpoints packed in public/data/interpretability-induction.bin. */
export const CKPT_STEPS = {json.dumps(CK)};

/** Eval metrics during training, on 256 sequences of 12 random letters repeated once. */
export const CURVES = {json.dumps(curves)};

/** float32 weights at step 300 (before the phase change) and at the end, base64. */
export const EARLY_STEP = 300;
export const EARLY_B64 = '{b64(300)}';
export const FINAL_B64 = '{b64(4000)}';
"""
open(os.path.join(ROOT, 'src/lib/interpretability-induction-data.ts'), 'w').write(ts)
# test vector
sd = cks[-1]
ids = torch.tensor([[3,7,1,15,9,0,12,4,18,6,11,2]*2])
x = sd['E'][ids] + sd['P'][:24]
mask = torch.triu(torch.ones(24,24,dtype=torch.bool),1)
for l in range(2):
    q=x@sd['Wq'][l]; k=x@sd['Wk'][l]; v=x@sd['Wv'][l]
    a=(q@k.transpose(1,2)/4).masked_fill(mask,float('-inf')).softmax(-1)
    x=x+(a@v)@sd['Wo'][l]
lg = (x@sd['U'])[0]
json.dump({'ids': ids[0].tolist(), 'logits': lg.tolist()}, open('testvec.json','w'))
print('ok', len(curves['step']))
