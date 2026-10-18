"""Pack a class-balanced CIFAR-10 sample into CIFAR's binary record format (label byte + 3072 CHW bytes)."""
import io, sys
import numpy as np
import pyarrow.parquet as pq
from PIL import Image

src, out_dir = sys.argv[1], sys.argv[2]
t = pq.read_table(src).to_pydict()
imgs, labels = t['img'], t['label']
rng = np.random.default_rng(231)
order = rng.permutation(len(labels))
per = {'train': 100, 'test': 20}
taken = {k: {c: [] for c in range(10)} for k in per}
for i in order:
    c = labels[i]
    for k in ('train', 'test'):
        if len(taken[k][c]) < per[k]:
            taken[k][c].append(i)
            break
for k in per:
    idx = [i for c in range(10) for i in taken[k][c]]
    idx = [idx[j] for j in rng.permutation(len(idx))]
    buf = bytearray()
    for i in idx:
        a = np.asarray(Image.open(io.BytesIO(imgs[i]['bytes'])).convert('RGB'), dtype=np.uint8)
        assert a.shape == (32, 32, 3)
        buf.append(labels[i])
        buf += a.transpose(2, 0, 1).tobytes()
    open(f'{out_dir}/cifar-{k}.bin', 'wb').write(buf)
    print(k, len(idx), len(buf))
