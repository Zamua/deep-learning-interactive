# Combines the trained .pt files into one manifest + weight blob for the browser.
import sys
import torch
args = sys.argv[1:]
sys.argv = ['x']
exec(open(__file__.replace('export_all.py', 'train.py')).read().split("if __name__")[0])
dirs, out = args[:-1], args[-1]
specs = {'encdec32': lambda: EncDec(32), 'encdec64': lambda: EncDec(64), 'attn': lambda: Attn(32, score='additive'), 'attndot': lambda: Attn(32, score='general')}
models = {}
for name, mk in specs.items():
    for d in dirs:
        try:
            m = mk()
            m.load_state_dict(torch.load(f'{d}/{name}.pt'))
            models[name] = m
            break
        except FileNotFoundError:
            pass
print('models', list(models))
export(models, out)
