import type { ChapterDef } from './index';
import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { Plot, color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { type CircuitSpec, describe, drawCircuit, evaluate, f2, reveal, revealAll, sigmoid, stepCount } from '../lib/backprop-circuit';
import { BACKPROP_SYMBOLS } from '../lib/backprop-symbols';

/** Gradient (teal) and local-gradient (gold) fractions for TeX. */
const G = (num: string, den: string) => String.raw`\sym{g}{\frac{\partial ${num}}{\partial ${den}}}`;
const LG = (num: string, den: string) => String.raw`\sym{loc}{\frac{\partial ${num}}{\partial ${den}}}`;
const X = (s: string) => String.raw`\sym{x}{${s}}`;

/** A stepped circuit figure: canvas + transport + status, all driven by one CircuitSpec. */
function circuitWalk(
  f: Fig,
  spec: CircuitSpec,
  inputs: Record<string, number>,
  opts: {
    w: number;
    h: number;
    labels: string[];
    slots?: (ev: ReturnType<typeof evaluate>, step: number) => Record<string, string | number>;
    group?: { ids: string[]; label: string };
    forkTotals?: boolean;
    forkLabels?: boolean;
    interval?: number;
  },
) {
  let ins = { ...inputs };
  let ev = evaluate(spec, ins);
  let cur = 0;
  const cv = f.canvas(opts.w, opts.h, (ctx, w, h) => {
    const rv = reveal(spec, cur);
    const g = opts.group;
    const lit = !!g && rv.phase === 'backward' && g.ids.some((id) => rv.active.includes(id));
    drawCircuit(ctx, w, h, spec, ev, rv, { group: g ? { ...g, lit } : undefined, forkTotals: opts.forkTotals, forkLabels: opts.forkLabels });
  });
  cv.canvas.classList.add('scroll-ok');
  const sync = () => {
    f.code.highlight(opts.labels[cur] ?? null);
    if (opts.slots) f.code.setMany(opts.slots(ev, cur));
    f.status(describe(spec, ev, cur));
    cv.redraw();
  };
  const st = f.stepper({
    steps: stepCount(spec),
    interval: opts.interval ?? 1100,
    label: (k) => `step ${k + 1} / ${stepCount(spec)}`,
    onStep: (k) => {
      cur = k;
      sync();
    },
  });
  return {
    set(next: Record<string, number>) {
      ins = { ...ins, ...next };
      ev = evaluate(spec, ins);
      sync();
    },
    get ev() {
      return ev;
    },
    get step() {
      return cur;
    },
    stepper: st,
    redraw: () => cv.redraw(),
  };
}

const chapter: ChapterDef = {
  symbols: BACKPROP_SYMBOLS,

  render(p) {
    p.prose(`
The last chapter trained a classifier by walking downhill on the loss, and walking downhill needs the **gradient**: for every weight, which direction makes the loss go up, and how steeply. We met two ways to get it. The *numerical* gradient nudges each weight in turn and measures the change, which is simple but slow (one extra loss evaluation per weight, and a network has millions) and only approximate. The *analytic* gradient is a formula from calculus, which is exact and fast but has to be derived by hand, and doing that for a whole network is hopeless.

**Backpropagation** is the way out. It computes exact analytic gradients for arbitrarily complicated functions by breaking them into tiny pieces whose derivatives are trivial, and chaining those pieces together with one rule from calculus. Every deep learning library does exactly this. It is also the point where many people get lost, so this chapter builds it up from circuits with three numbers in them, with real values flowing forward and gradients flowing backward, one step at a time.`);

    p.h2('The problem', 'problem');
    p.prose(`
Stated plainly: we have some function $f(\\symx)$ of a list of inputs $\\symx$, and we want $\\symg(\\symx)$, the gradient of $f$ at that particular $\\symx$. That is, one number per input, saying how sensitive $f$ is to that input right there.

In a neural network, $f$ is the **loss**, and its inputs are the training data *and* the weights $\\symW$ (and biases). The data is given and fixed; the weights are what we get to change. So in practice we mostly want the gradient with respect to the weights, to perform the parameter update. The gradient with respect to the data is still useful sometimes, for example to visualize what a network has learned (Chapter 12), and backprop hands it to us for free.`);

    p.h2('Simple expressions and what a derivative means', 'simple');
    p.prose(`
Start with the smallest possible example: $f(x, y) = x\\,y$. Suppose $x = 4$ and $y = -3$, so $f = -12$. Now ask: if I nudge $x$ up by a tiny amount, what happens to $f$? Since $f$ is $x$ times $-3$, every bit added to $x$ removes three times as much from $f$. That ratio, *change in output per unit change in one input*, is the derivative.`);
    p.math({
      label: 'The derivative: output change per unit of input change',
      tex: String.raw`\frac{df}{d${X('x')}} = \lim_{\symh \to 0} \frac{f(${X('x')} + \symh) - f(${X('x')})}{\symh}`,
      code: `
        def slope(f, x, h=1e-5):
            return (f(x + h) - f(x)) / h

        slope(lambda x: x * -3.0, 4.0)    # -3.0000
      `,
      codeTitle: 'derivative.py',
      terms: [
        [String.raw`f(${X('x')} + \symh) - f(${X('x')})`, 'how far the output moved when the input was nudged by $h$'],
        [String.raw`\frac{\cdots}{\symh}`, 'divide by the size of the nudge: change *per unit* of input'],
        [String.raw`\lim_{\symh\to 0}`, 'make the nudge smaller and smaller; the ratio settles on one exact number, the slope of $f$ at that point'],
      ],
      explain: `A derivative is a **sensitivity**: if $df/dx = -3$, then nudging $x$ up by a small amount moves $f$ *down* by three times that amount. With several inputs we ask the same question of one input at a time while the others stay frozen. That is a **partial derivative**, written with a curly $\\partial$ instead of $d$: $\\partial f / \\partial x$ just means "the slope along $x$, with $y$ held fixed." The **gradient** $\\symg$ is simply the list of all the partial derivatives: $\\symg = [\\partial f/\\partial x,\\; \\partial f/\\partial y]$.`,
    });
    p.prose(`
Three tiny functions will be enough to build everything else. For each, the partial derivatives can be worked out in your head, and you should be able to see *why* they are what they are.`);
    p.math({
      label: 'Three gates and their derivatives',
      tex: String.raw`\begin{aligned}
        f &= ${X('x')}\,${X('y')} &\;\Rightarrow\;& ${G('f', 'x')} = ${X('y')} \\[2pt]
        f &= ${X('x')} + ${X('y')} && ${G('f', 'x')} = 1 \\[2pt]
        f &= \max(${X('x')}, ${X('y')}) && ${G('f', 'x')} = \mathbb{1}(${X('x')} \ge ${X('y')})
      \end{aligned}`,
      code: `
        x, y = 4.0, -3.0
        # multiply: f = x * y
        dfdx, dfdy = y, x                  # -3.0, 4.0
        # add: f = x + y
        dfdx, dfdy = 1.0, 1.0
        # max: f = max(x, y)
        dfdx = 1.0 if x >= y else 0.0      # 1.0
        dfdy = 1.0 if y >= x else 0.0      # 0.0
      `,
      codeTitle: 'simple_gates.py',
      terms: [
        [String.raw`${G('f', 'x')} = ${X('y')}`, 'for a product, the slope along $x$ is the *other* input. At $x=4, y=-3$: raising $x$ a little lowers $f$ three times as much'],
        [String.raw`= 1`, 'for a sum, whatever you add to $x$ shows up one-for-one in $f$, no matter what the values are'],
        [String.raw`\mathbb{1}(${X('x')} \ge ${X('y')})`, 'the *indicator*: 1 if the condition is true, 0 if not. A max only feels its larger input; the smaller one could wiggle a little and nothing would change'],
      ],
      explain: 'The derivatives with respect to $y$ are the same with $x$ and $y$ swapped: for $xy$ it is $x$, for $x + y$ it is 1, for the max it is $\\mathbb{1}(y \\ge x)$. Read each derivative as an answer to "if I push on this input, how hard does the output push back?" For $xy$ the answer depends on the other input; for $x + y$ it is always exactly 1; for $\\max$ it is all-or-nothing. (Right at a tie $x = y$ the max has a kink and no true slope; any value between 0 and 1 is a valid *subgradient*, and code just picks one.)',
    });

    p.figure({
      title: 'Nudge one input, watch the output',
      codeTitle: 'sensitivity.py',
      code: `
        def f(x, y):
            return {{expr:x * y}}

        x, y = {{x:4}}, {{y:-3}}
        h = {{h:1}}                        # a nudge to {{wrt:x}}

        out = f(x, y)                     # {{out}}
        nudged = f({{call:x + h, y}})      # {{nud}}
        slope = (nudged - out) / h        # {{slope}}       #@num
        # calculus: df/d{{wrt}} = {{ana_expr:y}} = {{ana}}   #@ana
      `,
      setup(f) {
        type Gt = 'mul' | 'add' | 'max';
        let gate: Gt = 'mul';
        let wrt: 'x' | 'y' = 'x';
        let x = 4;
        let y = -3;
        let h = 1;
        const F = (a: number, b: number) => (gate === 'mul' ? a * b : gate === 'add' ? a + b : Math.max(a, b));
        const slice = (t: number) => (wrt === 'x' ? F(t, y) : F(x, t));
        const ana = () => {
          if (gate === 'add') return 1;
          if (gate === 'mul') return wrt === 'x' ? y : x;
          return wrt === 'x' ? (x >= y ? 1 : 0) : y >= x ? 1 : 0;
        };
        const t0 = () => (wrt === 'x' ? x : y);
        const pl = f.plot({
          aspect: 1.2,
          square: false,
          domain: [-6, 6, -20, 20],
          draw: (pp) => {
            let lo = Infinity, hi = -Infinity;
            for (let t = -6; t <= 6; t += 0.25) {
              lo = Math.min(lo, slice(t));
              hi = Math.max(hi, slice(t));
            }
            lo = Math.min(lo, -3);
            hi = Math.max(hi, 3);
            const pad = (hi - lo) * 0.12;
            pp.setDomain(-6, 6, lo - pad, hi + pad);
            const [, , y0, y1] = pp.view();
            const gstep = (y1 - y0) > 40 ? 10 : (y1 - y0) > 16 ? 5 : 2;
            pp.ctx.save();
            pp.axes({ grid: 1 });
            pp.ctx.restore();
            for (let v = Math.ceil(y0 / gstep) * gstep; v <= y1 - (y1 - y0) * 0.14; v += gstep) if (v !== 0) pp.text(String(v), -5.9, v + (y1 - y0) * 0.01, { size: 11, mono: true, color: color('--ink-3') });
            for (let v = -4; v <= 4; v += 2) if (v !== 0) pp.text(String(v), v, y0 + (y1 - y0) * 0.02, { size: 11, mono: true, align: 'center', color: color('--ink-3') });
            pp.fn(slice, color('purple'), 2.5);
            const a = t0();
            const fa = slice(a);
            const s = ana();
            pp.path([a - 3, a + 3], [fa - 3 * s, fa + 3 * s], withAlpha(color('teal'), 0.9), 2, [6, 5]);
            const fb = slice(a + h);
            pp.path([a, a + h], [fa, fa], color('slate'), 2);
            pp.path([a + h, a + h], [fa, fb], color('purple'), 2);
            pp.dot(a + h, fb, 4, color('purple'));
            pp.dot(a, fa, 6, color('orange'), color('--paper'));
            pp.text(`h`, a + h / 2, fa + (fb >= fa ? -1 : 1) * (y1 - y0) * 0.04, { align: 'center', size: 12, color: color('slate'), mono: true });
            const lab = gate === 'mul' ? 'f = x · y' : gate === 'add' ? 'f = x + y' : 'f = max(x, y)';
            pp.text(lab, -5.8, y1 - (y1 - y0) * 0.06, { size: 13, bold: true, color: color('purple') });
            pp.text(`horizontal axis: ${wrt}   (${wrt === 'x' ? 'y' : 'x'} held at ${fmt(wrt === 'x' ? y : x)})`, 5.85, y1 - (y1 - y0) * 0.06, { size: 11, align: 'right', color: color('--ink-3') });
            pp.text('dashed: slope from calculus', 5.85, y1 - (y1 - y0) * 0.12, { size: 11, align: 'right', color: color('teal') });
          },
        });
        const outRo = f.readout('f');
        const numRo = f.readout('measured slope');
        const anaRo = f.readout('calculus', { sym: 'g' });
        const xs = f.slider({ label: 'x', sym: 'x', min: -5, max: 5, step: 0.5, value: x, slot: 'x', onInput: (v) => { x = v; update(); } });
        const ys = f.slider({ label: 'y', sym: 'x', min: -5, max: 5, step: 0.5, value: y, slot: 'y', onInput: (v) => { y = v; update(); } });
        f.slider({ label: 'nudge h', sym: 'h', min: 0.05, max: 2, step: 0.05, value: h, slot: 'h', onInput: (v) => { h = v; update(); } });
        f.segmented({
          label: 'gate',
          options: [
            { value: 'mul', label: 'x · y' },
            { value: 'add', label: 'x + y' },
            { value: 'max', label: 'max' },
          ],
          value: 'mul',
          onChange: (v) => { gate = v as Gt; update(); },
        });
        f.segmented({
          label: 'nudge',
          options: [
            { value: 'x', label: 'x' },
            { value: 'y', label: 'y' },
          ],
          value: 'x',
          onChange: (v) => { wrt = v as 'x' | 'y'; update(); },
        });
        let drag = false;
        const setT = (e: PointerEvent) => {
          const [t] = pl.pointer(e);
          const v = Math.round(Math.max(-5, Math.min(5, t)) * 2) / 2;
          if (wrt === 'x') xs.set(v); else ys.set(v);
        };
        pl.canvas.addEventListener('pointerdown', (e) => { drag = true; pl.canvas.setPointerCapture(e.pointerId); setT(e); });
        pl.canvas.addEventListener('pointermove', (e) => drag && setT(e));
        pl.canvas.addEventListener('pointerup', () => (drag = false));
        function update() {
          const out = F(x, y);
          const nud = wrt === 'x' ? F(x + h, y) : F(x, y + h);
          const slope = (nud - out) / h;
          const anaExpr = gate === 'add' ? '1' : gate === 'mul' ? (wrt === 'x' ? 'y' : 'x') : wrt === 'x' ? '(1 if x >= y else 0)' : '(1 if y >= x else 0)';
          f.code.setMany({
            expr: gate === 'mul' ? 'x * y' : gate === 'add' ? 'x + y' : 'max(x, y)',
            wrt,
            call: wrt === 'x' ? 'x + h, y' : 'x, y + h',
            out: fmt(out, 4),
            nud: fmt(nud, 4),
            slope: fmt(slope, 4),
            ana_expr: anaExpr,
            ana: fmt(ana(), 4),
          });
          outRo.set(fmt(out, 4));
          numRo.set(fmt(slope, 4));
          anaRo.set(fmt(ana(), 4));
          f.code.highlight(Math.abs(slope - ana()) < 1e-9 ? ['num', 'ana'] : 'num');
          pl.redraw();
        }
        update();
      },
      caption: `The purple curve is $f$ along one input with the other held fixed: a *slice* through the function. The orange dot is the current point; the gray step is the nudge $h$, and the purple riser is how much $f$ moved. Their ratio is the measured slope, and the dashed teal line has the slope calculus predicts. For $x \\cdot y$ the slice along $x$ is a straight line whose slope is $y$: drag $y$ and watch it tilt. For $\\max$, slide $x$ below $y$ and the slope drops to 0. Try a big nudge across the kink of the max: the measured slope stops matching, which is why the derivative is defined with $h$ shrinking to zero.`,
    });

    p.h2('Compound expressions and the chain rule', 'chain-rule');
    p.prose(`
Real functions are built from many simple pieces. Take $f(x, y, z) = (x + y)\\,z$. You could multiply it out and differentiate, but that trick does not scale. Instead, give the inner piece a name, $q = x + y$, so that $f = q\\,z$. Each piece is now one of our simple gates, and we already know their derivatives:

- from $f = q\\,z$: $\\partial f/\\partial q = z$ and $\\partial f/\\partial z = q$,
- from $q = x + y$: $\\partial q/\\partial x = 1$ and $\\partial q/\\partial y = 1$.

But we do not care about the gradient on $q$ for its own sake; we want $\\partial f/\\partial x$. The **chain rule** says how to combine the pieces: multiply them.`);
    p.math({
      label: 'The chain rule',
      tex: String.raw`${G('f', 'x')} \;=\; ${G('f', 'q')}\;\cdot\;${LG('q', 'x')}`,
      code: `
        x, y, z = -2.0, 5.0, -4.0
        q = x + y              # 3
        f = q * z              # -12
        dq = z                 # df/dq = z = -4
        dx = 1.0 * dq          # df/dx = (dq/dx) * (df/dq) = -4
      `,
      codeTitle: 'chain_rule.py',
      terms: [
        [G('f', 'q'), 'how strongly $f$ responds to $q$. Since $f = qz$, this is $z = -4$'],
        [LG('q', 'x'), 'how strongly $q$ responds to $x$. Since $q = x + y$, this is $1$'],
        [G('f', 'x'), 'their product: $x$ moves $q$ one-for-one, and $q$ moves $f$ at $-4$ per unit, so $x$ moves $f$ at $-4$ per unit'],
      ],
      explain: 'Rates multiply along a chain, like gears. If gear A turns gear B three times per revolution and B turns C twice per revolution, A turns C six times per revolution. Here $x$ drives $q$ at rate 1 and $q$ drives $f$ at rate $-4$, so $x$ drives $f$ at $1 \\times (-4) = -4$. In code we stop writing `dfdx` and just write `dx`: it always means "the gradient of the final output $f$ with respect to `x`".',
    });
    p.callout('math', `In Calculus 1 the chain rule looked like $\\big(g(h(x))\\big)' = g'(h(x))\\,h'(x)$: the derivative of the outside, evaluated at the inside, times the derivative of the inside. It is the same rule. Backpropagation is nothing more than applying it over and over, starting from the output and working back toward the inputs, with actual numbers plugged in at every step instead of formulas.`, 'Math help: the chain rule you once learned');

    p.prose(`
Here is the whole computation as a **circuit**: inputs on the left, one node per gate, values flowing to the right. The forward pass computes values from left to right. The backward pass then starts at the output with gradient 1 (nudging $f$ by 1 moves $f$ by 1) and runs right to left, turning each gate's incoming gradient into gradients on its inputs.`);
    p.figure({
      title: 'Forward, then backward, through (x + y) z',
      codeTitle: 'circuit.py',
      code: `
        x, y, z = {{x:-2}}, {{y:5}}, {{z:-4}}         #@in

        # forward pass
        q = x + y        # q = {{q}}                #@f1
        f = q * z        # f = {{f}}                #@f2

        # backward pass, in reverse order
        df = 1.0         # df/df                    #@b0
        dq = z * df      # {{dq}}                   #@b1
        dz = q * df      # {{dz}}                   #@b1
        dx = 1.0 * dq    # {{dx}}                   #@b2
        dy = 1.0 * dq    # {{dy}}                   #@b2
      `,
      setup(f) {
        const spec: CircuitSpec = {
          inputs: [
            { id: 'x', at: [0, 0.1] },
            { id: 'y', at: [0, 1.25] },
            { id: 'z', at: [0, 2.35] },
          ],
          ops: [
            { id: 'q', op: 'add', ins: ['x', 'y'], at: [1, 0.68], name: 'q', t: [0.4, 0.4] },
            { id: 'f', op: 'mul', ins: ['q', 'z'], at: [2, 1.5], t: [0.45, 0.45] },
          ],
          size: [2.65, 2.35],
          outName: 'f',
        };
        const show = (ev: ReturnType<typeof evaluate>, k: number) => ({
          q: k >= 1 ? f2(ev.val.q!) : '…',
          f: k >= 2 ? f2(ev.val.f!) : '…',
          dq: k >= 4 ? f2(ev.grad.q!) : '…',
          dz: k >= 4 ? f2(ev.grad.z!) : '…',
          dx: k >= 5 ? f2(ev.grad.x!) : '…',
          dy: k >= 5 ? f2(ev.grad.y!) : '…',
        });
        const walk = circuitWalk(f, spec, { x: -2, y: 5, z: -4 }, { w: 640, h: 400, labels: ['in', 'f1', 'f2', 'b0', 'b1', 'b2'], slots: show });
        const chk = f.readout('nudge check: f(x + 0.001) − f, ÷ 0.001');
        const vals = { x: -2, y: 5, z: -4 };
        const check = () => {
          const F = (a: number, b: number, c: number) => (a + b) * c;
          const e = 1e-3;
          chk.set(f2((F(vals.x + e, vals.y, vals.z) - F(vals.x, vals.y, vals.z)) / e));
        };
        for (const k of ['x', 'y', 'z'] as const) {
          f.slider({
            label: k,
            sym: 'x',
            min: -5,
            max: 5,
            step: 0.5,
            value: vals[k],
            slot: k,
            onInput: (v) => {
              vals[k] = v;
              walk.set({ [k]: v });
              check();
            },
          });
        }
        check();
      },
      caption: `Values are written above each wire in dark ink, gradients below in teal. Step through: the two forward steps fill in $q$ and $f$; then the backward pass seeds the output with 1, the multiply gate hands $z$'s value to $q$ and $q$'s value to $z$, and the add gate passes its gradient to both of its inputs unchanged. The final gradient is $[\\partial f/\\partial x, \\partial f/\\partial y, \\partial f/\\partial z] = [-4, -4, 3]$. Change the inputs with the sliders and check the readout: nudging $x$ by 0.001 really does move $f$ by about \`dx\` times 0.001.`,
    });

    p.h2('Backprop is a local process', 'local');
    p.prose(`
Look at the circuit from the point of view of a single gate. During the forward pass, a gate receives some inputs and computes two things, using nothing but those inputs: its **output**, and its **local gradients**, how its output would change with each input. It does not need to know anything about the rest of the circuit, how big it is, or what it is for.

Then the forward pass ends, and the backward pass eventually reaches the gate with one number: the gradient of the *final* output with respect to *this gate's* output. That is the **upstream gradient**. The chain rule tells the gate exactly what to do with it: multiply it into each of its local gradients, and pass the results on to its inputs.`);
    p.math({
      label: 'What every gate does on the way back',
      tex: String.raw`\underbrace{${G('f', 'x')}}_{\text{downstream}} \;=\; \underbrace{${G('f', 'q')}}_{\text{upstream}} \times \underbrace{${LG('q', 'x')}}_{\text{local}}`,
      code: `
        class MultiplyGate:
            def forward(self, x, y):
                self.x, self.y = x, y      # cache the inputs
                return x * y
            def backward(self, dout):      # dout: upstream gradient
                dx = self.y * dout         # local gradient y, times upstream
                dy = self.x * dout         # local gradient x, times upstream
                return dx, dy
      `,
      codeTitle: 'gate.py',
      terms: [
        [G('f', 'q'), 'the **upstream** gradient: how the final output responds to this gate\'s output $q$. It arrives from the right during the backward pass'],
        [LG('q', 'x'), 'the **local** gradient: how this gate\'s output responds to its input $x$. The gate computes this on its own, from its own inputs'],
        [G('f', 'x'), 'the **downstream** gradient that the gate sends back to its input $x$, where it becomes the upstream gradient of whatever produced $x$'],
      ],
      explain: 'This is the entire algorithm. A gate stores what it needs during `forward` (here, its two inputs), and `backward` turns one upstream number into one number per input. Chain gates together, call `forward` on each in order, then `backward` on each in reverse order, and every input in the circuit ends up holding its gradient.',
    });
    p.callout('intuition', `It helps to pretend the circuit *wants* its output to be higher, and that gradients are how gates tell each other what they want. In the circuit above, the add gate saw inputs $-2$ and $5$ and produced $3$. Its local gradients are $+1$ and $+1$. During the backward pass it learns that its own output's gradient is $-4$: the circuit wants the add gate's output to go *down*, with a force of 4. So the add gate multiplies $-4$ into its local gradients and tells both of its inputs to go down with force 4. If $x$ and $y$ obeyed, $q$ would fall, $q \\cdot z$ would rise (because $z$ is negative), and the circuit would get what it wanted. Backpropagation is gates **communicating** through gradient signals: should my output increase or decrease, and how strongly.`, 'Gates talking to each other');
    p.prose(`
The same split shows up in every deep learning library. Torch calls the pieces *modules* and Caffe calls them *layers*, but each one is a little object with a \`forward\` that caches what it needs and a \`backward\` that applies upstream-times-local. A whole network is then just a list of them in order:`);
    p.code(`
      def forward(graph, inputs):
          for gate in graph.topological_order():   # inputs before outputs
              gate.forward()                       # sees only its own inputs
          return graph.output                      # the loss

      def backward(graph):
          graph.output.grad = 1.0
          for gate in reversed(graph.topological_order()):
              gate.backward()                      # upstream * local, to inputs
    `, { title: 'graph.py' });
    p.prose(`Assignment 2 is built exactly this way: every layer is a pair of functions such as \`affine_forward(x, w, b)\`, which returns the output plus a \`cache\`, and \`affine_backward(dout, cache)\`, which returns the gradients on \`x\`, \`w\` and \`b\`.`);

    p.h2('Modularity: the sigmoid neuron', 'sigmoid');
    p.prose(`
Any function whose derivative we can write down can serve as a gate, and we are free to group several gates into one when that is convenient. Here is a more realistic circuit: a two-input **neuron** with a *sigmoid* activation, the building block of the next chapter.`);
    p.math({
      label: 'A sigmoid neuron with two inputs',
      tex: String.raw`f(\symW, ${X('x')}) = \frac{1}{1 + e^{-(\sym{W}{w_0}${X('x_0')} + \sym{W}{w_1}${X('x_1')} + \sym{W}{w_2})}}`,
      code: `
        W = [2.0, -3.0, -3.0]      # two weights, then a bias
        x = [-1.0, -2.0]
        dot = W[0]*x[0] + W[1]*x[1] + W[2]     # 1.0
        f = 1.0 / (1.0 + math.exp(-dot))       # 0.73
      `,
      codeTitle: 'neuron.py',
      terms: [
        [String.raw`\sym{W}{w_0}${X('x_0')} + \sym{W}{w_1}${X('x_1')} + \sym{W}{w_2}`, 'a weighted sum of the inputs plus a bias, exactly the score of a linear classifier'],
        [String.raw`e^{-(\cdots)}`, '$e$ (about 2.718) raised to minus that sum: huge for very negative sums, near 0 for very positive ones'],
        [String.raw`\frac{1}{1 + \cdots}`, 'squashes everything into the range 0 to 1'],
      ],
      explain: 'The neuron computes a linear score and squashes it to a number between 0 and 1. With weights $[2, -3, -3]$ and inputs $[-1, -2]$, the sum is $-2 + 6 - 3 = 1$ and the output is $1/(1 + e^{-1}) \\approx 0.73$. Which way should each weight move to push that output up? That is a backprop question.',
    });
    p.prose(`
Broken into the smallest gates, this expression needs only two new kinds besides add and multiply, plus two "constant" versions of the old ones. Their local gradients are standard calculus facts:`);
    p.math({
      label: 'Four more gates and their local gradients',
      tex: String.raw`\begin{aligned}
        f(x) &= \tfrac{1}{x} &\;\to\;& ${LG('f', 'x')} = -\tfrac{1}{x^2} \\[3pt]
        f_c(x) &= c + x && ${LG('f', 'x')} = 1 \\[3pt]
        f(x) &= e^x && ${LG('f', 'x')} = e^x \\[3pt]
        f_a(x) &= a\,x && ${LG('f', 'x')} = a
      \end{aligned}`,
      code: `
        # name: (forward, local gradient)
        gates = {
            'inv':  (lambda x: 1.0 / x,   lambda x: -1.0 / x**2),
            'addc': (lambda x: c + x,     lambda x: 1.0),
            'exp':  (lambda x: np.exp(x), lambda x: np.exp(x)),
            'mulc': (lambda x: a * x,     lambda x: a),
        }
      `,
      codeTitle: 'more_gates.py',
      terms: [
        [String.raw`-\tfrac{1}{x^2}`, '$1/x$ shrinks as $x$ grows, so its slope is negative, and steepest for small $x$'],
        [String.raw`c + x`, 'adding a constant $c$ shifts the output but does not change how it responds to $x$'],
        [String.raw`e^x`, 'the exponential is its own derivative: its slope at any point equals its height there'],
        [String.raw`a\,x`, 'scaling by a constant $a$ scales every change by $a$'],
      ],
      explain: 'Nothing here needs to be memorized for the rest of the course. The point is that each gate is tiny, and its local gradient is a one-line formula in terms of its own input (or output). Backprop does the rest.',
    });

    p.figure({
      title: 'Backprop through a sigmoid neuron, gate by gate',
      layout: 'stack',
      codeTitle: 'neuron_staged.py',
      code: `
        w0, x0, w1, x1, w2 = {{w0:2}}, {{x0:-1}}, {{w1:-3}}, {{x1:-2}}, {{w2:-3}}   #@in
        # forward: one gate per line
        p0 = w0 * x0             # {{p0}}           #@f1
        p1 = w1 * x1             # {{p1}}           #@f2
        s = p0 + p1              # {{s}}            #@f3
        dot = s + w2             # {{dot}}          #@f4
        neg = -1.0 * dot         # {{neg}}          #@f5
        ex = np.exp(neg)         # {{ex}}           #@f6
        den = 1.0 + ex           # {{den}}          #@f7
        f = 1.0 / den            # {{f}}            #@f8
        # backward: the same gates, in reverse
        df = 1.0                                    #@b0
        dden = (-1.0 / den**2) * df    # {{dden}}   #@b8
        dex = 1.0 * dden               # {{dex}}    #@b7
        dneg = ex * dex                # {{dneg}}   #@b6
        ddot = -1.0 * dneg             # {{ddot}}   #@b5
        ds, dw2 = 1.0 * ddot, 1.0 * ddot            #@b4
        dp0, dp1 = 1.0 * ds, 1.0 * ds               #@b3
        dw1, dx1 = x1 * dp1, w1 * dp1               #@b2
        dw0, dx0 = x0 * dp0, w0 * dp0               #@b1
        # dw = [{{dw0}}, {{dw1}}, {{dw2}}]
        # dx = [{{dx0}}, {{dx1}}]
      `,
      setup(f) {
        const narrow = f.viz.clientWidth < 600;
        const ins = { w0: 2, x0: -1, w1: -3, x1: -2, w2: -3 };
        const wide: CircuitSpec = {
          inputs: [
            { id: 'w0', label: 'w₀', at: [0, 0] },
            { id: 'x0', label: 'x₀', at: [0, 0.85] },
            { id: 'w1', label: 'w₁', at: [0, 1.9] },
            { id: 'x1', label: 'x₁', at: [0, 2.75] },
            { id: 'w2', label: 'w₂', at: [0, 3.6] },
          ],
          ops: [
            { id: 'p0', op: 'mul', ins: ['w0', 'x0'], at: [1, 0.42] },
            { id: 'p1', op: 'mul', ins: ['w1', 'x1'], at: [1, 2.32] },
            { id: 's', op: 'add', ins: ['p0', 'p1'], at: [2, 1.37] },
            { id: 'dot', op: 'add', ins: ['s', 'w2'], at: [3, 2.1], t: [0.5, 0.72] },
            { id: 'neg', op: 'mulc', c: -1, ins: ['dot'], at: [4, 2.1] },
            { id: 'ex', op: 'exp', ins: ['neg'], at: [5, 2.1] },
            { id: 'den', op: 'addc', c: 1, ins: ['ex'], at: [6, 2.1] },
            { id: 'f', op: 'inv', ins: ['den'], at: [7, 2.1] },
          ],
          size: [7.7, 3.6],
          outName: 'f',
        };
        const nar: CircuitSpec = {
          ...wide,
          inputs: wide.inputs.map((i, k) => ({ ...i, at: [0, [0, 0.85, 1.75, 2.6, 3.45][k]!] as [number, number] })),
          ops: [
            { id: 'p0', op: 'mul', ins: ['w0', 'x0'], at: [1.05, 0.42] },
            { id: 'p1', op: 'mul', ins: ['w1', 'x1'], at: [1.05, 2.17] },
            { id: 's', op: 'add', ins: ['p0', 'p1'], at: [2.05, 1.3] },
            { id: 'dot', op: 'add', ins: ['s', 'w2'], at: [3, 2.0] },
            { id: 'neg', op: 'mulc', c: -1, ins: ['dot'], at: [0.45, 4.55] },
            { id: 'ex', op: 'exp', ins: ['neg'], at: [1.3, 4.55] },
            { id: 'den', op: 'addc', c: 1, ins: ['ex'], at: [2.15, 4.55] },
            { id: 'f', op: 'inv', ins: ['den'], at: [3, 4.55] },
          ],
          size: [3.55, 4.75],
          labels: 'node',
        };
        const spec = narrow ? nar : wide;
        const slots = (ev: ReturnType<typeof evaluate>, k: number) => {
          const v = (id: string, at: number) => (k >= at ? f2(ev.val[id]!) : '…');
          const g = (id: string, at: number) => (k >= at ? f2(ev.grad[id]!) : '…');
          return {
            p0: v('p0', 1), p1: v('p1', 2), s: v('s', 3), dot: v('dot', 4), neg: v('neg', 5), ex: v('ex', 6), den: v('den', 7), f: v('f', 8),
            dden: g('den', 10), dex: g('ex', 11), dneg: g('neg', 12), ddot: g('dot', 13),
            dw2: g('w2', 14), dw1: g('w1', 16), dw0: g('w0', 17), dx1: g('x1', 16), dx0: g('x0', 17),
          };
        };
        const walk = circuitWalk(f, spec, ins, {
          w: narrow ? 400 : 1000,
          h: narrow ? 560 : 330,
          labels: ['in', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'b0', 'b8', 'b7', 'b6', 'b5', 'b4', 'b3', 'b2', 'b1'],
          slots,
          group: { ids: ['neg', 'ex', 'den', 'f'], label: 'together: one σ gate' },
          interval: 1000,
        });
        const rng = new Rng(17);
        f.button('New random inputs', () => {
          const r1 = () => Math.round(rng.uniform(-3, 3) * 10) / 10 || 0.5;
          const next = { w0: r1(), x0: r1(), w1: r1(), x1: r1(), w2: r1() };
          f.code.setMany(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, String(v)])));
          walk.set(next);
        }, { icon: 'shuffle' });
      },
      caption: `Each circle is one gate from the lists above, and the wires carry values (ink, above) and gradients (teal, below). Step all the way through. Going backward, the $1/x$ gate turns the gradient into $-0.53$, the $+1$ gate passes it through unchanged, the $\\exp$ gate multiplies by its output $0.37$, and the $\\times(-1)$ gate flips the sign. When the gradient leaves the dashed box it has been multiplied by $0.197$ in total. Then the add gates hand $0.20$ to every term, and each multiply gate swaps its inputs: the gradient on $w_0$ is $x_0 \\times 0.20$, and the gradient on $x_0$ is $w_0 \\times 0.20$. Try **New random inputs** and check a few gradients by hand.`,
    });
    p.prose(`
Look at what the four gates in the dashed box did. Together they compute the **sigmoid function** $\\sigma(z) = 1/(1 + e^{-z})$, and the sigmoid has a derivative that is unusually pleasant to write down:`);
    p.math({
      label: 'The sigmoid and its local gradient',
      tex: String.raw`\begin{aligned} \sigma(z) &= \frac{1}{1 + e^{-z}} \\[3pt] ${LG('\\sigma', 'z')} &= \frac{e^{-z}}{(1 + e^{-z})^2} = \big(1 - \sigma(z)\big)\,\sigma(z) \end{aligned}`,
      code: `
        f = 1.0 / (1.0 + np.exp(-z))   # forward: keep f around
        dz = (1 - f) * f * df          # backward reuses the output
      `,
      codeTitle: 'sigmoid_gate.py',
      terms: [
        [String.raw`\frac{e^{-z}}{(1 + e^{-z})^2}`, 'what you get by grinding through the derivative with the quotient and chain rules'],
        [String.raw`(1 - \sigma)\,\sigma`, 'the same thing rewritten using the output itself: one subtraction and one multiplication'],
      ],
      explain: 'The local gradient depends only on the gate\'s *output*, which we already computed in the forward pass. At $z = 1$: $\\sigma = 0.73$, so the local gradient is $0.73 \\times 0.27 = 0.197$, exactly the factor the four small gates produced between them. So we can replace those four gates with one **sigmoid gate** whose backward step is a single line. Grouping gates like this is common practice whenever a group has a simple derivative.',
    });
    p.code(`
      W = [2.0, -3.0, -3.0]
      x = [-1.0, -2.0]

      # forward pass
      dot = W[0]*x[0] + W[1]*x[1] + W[2]
      f = 1.0 / (1.0 + math.exp(-dot))          # sigmoid: 0.73

      # backward pass
      ddot = (1 - f) * f                        # through the sigmoid: 0.197
      dx = [W[0] * ddot, W[1] * ddot]           # [0.39, -0.59]
      dW = [x[0] * ddot, x[1] * ddot, 1.0 * ddot]   # [-0.20, -0.39, 0.20]
    `, { title: 'neuron_grouped.py' });
    p.callout('aside', `Notice the habit this code is built on: split the forward pass into **stages** whose derivatives are easy (here, \`dot\` and then \`f\`), and keep the intermediate values. The backward pass then walks the same stages in reverse, one short line each. This is the single most useful practical tip for writing backward passes, and the next section leans on it heavily.`, 'Staged backprop');

    p.h2('Staged computation in practice', 'staged');
    p.prose(`
Here is a function made up purely for practice. Nobody would want to differentiate it by hand:`);
    p.math({
      label: 'A deliberately awkward function',
      tex: String.raw`f(${X('x')}, ${X('y')}) = \frac{${X('x')} + \sigma(${X('y')})}{\sigma(${X('x')}) + (${X('x')} + ${X('y')})^2}`,
      code: `
        def sigmoid(z):
            return 1.0 / (1.0 + np.exp(-z))

        f = (x + sigmoid(y)) / (sigmoid(x) + (x + y)**2)
      `,
      codeTitle: 'awkward.py',
      terms: [
        [String.raw`${X('x')} + \sigma(${X('y')})`, 'the numerator: $x$ plus the sigmoid of $y$'],
        [String.raw`\sigma(${X('x')}) + (${X('x')} + ${X('y')})^2`, 'the denominator: the sigmoid of $x$ plus the square of $x + y$'],
      ],
      explain: 'Writing out $\\partial f/\\partial x$ symbolically would take the quotient rule, the chain rule twice, and a page of algebra. But we never need the *formula* for the gradient, only its *value* at our particular $x$ and $y$. Staged backprop gets that value mechanically: break the forward pass into stages with simple local gradients, then walk them backward.',
    });
    p.figure({
      title: 'Staged forward and backward passes, line by line',
      layout: 'stack',
      codeTitle: 'staged.py',
      code: `
        x, y = {{x:3}}, {{y:-4}}                                   #@in

        # forward pass: stages, keeping every intermediate
        sigy = 1.0 / (1 + np.exp(-y))     # sigmoid of y          #@f1
        num = x + sigy                    # numerator             #@f2
        sigx = 1.0 / (1 + np.exp(-x))     # sigmoid of x          #@f3
        xpy = x + y                                               #@f4
        xpysqr = xpy**2                                           #@f5
        den = sigx + xpysqr               # denominator           #@f6
        invden = 1.0 / den                                        #@f7
        f = num * invden                  # {{f}}                 #@f8

        # backward pass: the same stages, in reverse
        df = 1.0                                                  #@b0
        dnum = invden * df                                        #@b8
        dinvden = num * df                                        #@b8
        dden = (-1.0 / den**2) * dinvden                          #@b7
        dsigx = 1.0 * dden                                        #@b6
        dxpysqr = 1.0 * dden                                      #@b6
        dxpy = (2 * xpy) * dxpysqr                                #@b5
        dx = 1.0 * dxpy                                           #@b4
        dy = 1.0 * dxpy                                           #@b4
        dx += ((1 - sigx) * sigx) * dsigx    # += : x is reused  #@b3
        dx += 1.0 * dnum                                          #@b2
        dsigy = 1.0 * dnum                                        #@b2
        dy += ((1 - sigy) * sigy) * dsigy                         #@b1
        # so far: dx = {{dx}}   dy = {{dy}}
      `,
      setup(f) {
        const narrow = f.viz.clientWidth < 600;
        const spec: CircuitSpec = {
          inputs: [
            { id: 'x', at: [0, 1.0] },
            { id: 'y', at: [0, 2.75] },
          ],
          ops: [
            { id: 'sigy', op: 'sig', ins: ['y'], at: [1, 3.6], name: 'sigy' },
            { id: 'num', op: 'add', ins: ['x', 'sigy'], at: [2.1, 4.35], name: 'num', t: [0.66, 0.5] },
            { id: 'sigx', op: 'sig', ins: ['x'], at: [1, 0.0], name: 'sigx' },
            { id: 'xpy', op: 'add', ins: ['x', 'y'], at: [1, 1.75], name: 'xpy', t: [0.55, 0.55] },
            { id: 'xpysqr', op: 'sq', ins: ['xpy'], at: [2, 1.75], name: 'xpysqr' },
            { id: 'den', op: 'add', ins: ['sigx', 'xpysqr'], at: [3, 0.85], name: 'den' },
            { id: 'invden', op: 'inv', ins: ['den'], at: [4, 0.85], name: 'invden' },
            { id: 'f', op: 'mul', ins: ['num', 'invden'], at: [5, 2.4], name: 'f' },
          ],
          size: [5.5, 4.35],
          labels: 'node',
        };
        const xy = { x: 3, y: -4 };
        const F = (a: number, b: number) => (a + sigmoid(b)) / (sigmoid(a) + (a + b) ** 2);
        const partial = (ev: ReturnType<typeof evaluate>, k: number, src: string) => {
          const rv = reveal(spec, k);
          let s = 0;
          let any = false;
          for (const o of spec.ops) o.ins.forEach((i, j) => {
            if (i === src && rv.edges.has(`${o.id}:${j}`)) {
              s += ev.edge[`${o.id}:${j}`]!;
              any = true;
            }
          });
          return any ? fmt(s, 4) : '…';
        };
        const walk = circuitWalk(f, spec, xy, {
          w: narrow ? 400 : 1000,
          h: narrow ? 470 : 420,
          forkLabels: !narrow,
          labels: ['in', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'b0', 'b8', 'b7', 'b6', 'b5', 'b4', 'b3', 'b2', 'b1'],
          slots: (ev, k) => ({ f: k >= 8 ? fmt(ev.val.f!, 4) : '…', dx: partial(ev, k, 'x'), dy: partial(ev, k, 'y') }),
          interval: 1000,
        });
        const bp = f.readout('backprop [dx, dy]', { sym: 'g' });
        const nm = f.readout('numerical');
        const check = () => {
          const e = 1e-5;
          const g = walk.ev.grad;
          bp.set(`[${fmt(g.x!, 5)}, ${fmt(g.y!, 5)}]`);
          nm.set(`[${fmt((F(xy.x + e, xy.y) - F(xy.x - e, xy.y)) / (2 * e), 5)}, ${fmt((F(xy.x, xy.y + e) - F(xy.x, xy.y - e)) / (2 * e), 5)}]`);
        };
        f.slider({ label: 'x', sym: 'x', min: -4, max: 4, step: 0.5, value: 3, slot: 'x', onInput: (v) => { xy.x = v; walk.set({ x: v }); check(); } });
        f.slider({ label: 'y', sym: 'x', min: -4, max: 4, step: 0.5, value: -4, slot: 'y', onInput: (v) => { xy.y = v; walk.set({ y: v }); check(); } });
        check();
      },
      caption: `Each gate is one line of the forward pass, labeled with its variable name; under it are its value (ink) and, once the backward pass reaches it, its gradient (teal). Step through and watch the listing: each backward line is the gradient arriving from the right, times one easy local gradient. Now watch $x$. It feeds three different stages (\`sigx\`, \`xpy\` and \`num\`), so its gradient arrives in three pieces, one per teal number on its three wires, and they **add up**: the running total under $x$ goes $1.58 \\to 1.55 \\to 2.06$. The readouts confirm the final answer against a numerical gradient.`,
    });
    p.prose(`
Two habits make this kind of code correct.

**Cache the forward pass.** The backward lines need \`xpy\`, \`sigx\`, \`den\` and friends. Keep every intermediate variable around after the forward pass (in a real layer, in its \`cache\`) instead of recomputing it.

**Gradients add up at forks.** When a variable is used in several places, its gradient is the *sum* of the gradients flowing back along each use. This is the multivariable chain rule:`);
    p.math({
      label: 'Gradients add where a variable is reused',
      tex: String.raw`${G('f', 'x')} = \sum_{k} ${G('f', 'q_k')}\;${LG('q_k', 'x')}`,
      code: `
        dx = 0.0
        dx += dxpy * 1.0                      # through xpy = x + y
        dx += dsigx * (1 - sigx) * sigx       # through sigx = sigmoid(x)
        dx += dnum * 1.0                      # through num = x + sigy
      `,
      codeTitle: 'fork.py',
      terms: [
        [String.raw`q_k`, 'each stage that uses $x$ directly; here \`xpy\`, \`sigx\` and \`num\`'],
        [String.raw`\sum_k`, 'add up over all of those stages ($\\Sigma$ means "sum over")'],
        [String.raw`${G('f', 'q_k')}\,${LG('q_k', 'x')}`, 'the gradient that flows back to $x$ along path $k$: upstream times local, as always'],
      ],
      explain: 'Nudge $x$ and the nudge travels down every path at once; the total effect on $f$ is the sum of the effects along each path. That is why the backward code says `dx += ...` for a reused variable, and why gradient arrays start at zero. Writing `=` where you meant `+=` silently throws away a path, and it is one of the most common backprop bugs.',
    });

    p.h2('Patterns in the backward flow', 'patterns');
    p.prose(`
After a few circuits, the three most common gates turn out to have very recognizable personalities on the way back:

- The **add gate distributes**. Its local gradients are all 1, so it hands its upstream gradient, unchanged, to every input. The input values do not matter at all.
- The **max gate routes**. It sends the whole upstream gradient to whichever input was largest in the forward pass, and exactly zero to the others.
- The **multiply gate swaps and scales**. Each input receives the *other* input's value times the upstream gradient.`);
    p.figure({
      title: 'Gate personalities: distribute, route, swap',
      codeTitle: 'gate_patterns.py',
      code: `
        x, y = {{x:3}}, {{y:-4}}
        dout = {{dout:2}}         # upstream gradient, from the right

        # add gate: distributes
        out = x + y                              #@add
        dx, dy = 1.0 * dout, 1.0 * dout          #@add
        # multiply gate: swaps the inputs, then scales
        out = x * y                              #@mul
        dx, dy = y * dout, x * dout              #@mul
        # max gate: routes to the larger input
        out = max(x, y)                          #@max
        dx = dout if x >= y else 0.0             #@max
        dy = dout if y > x else 0.0              #@max

        # out = {{out}}   dx = {{dx}}   dy = {{dy}}
      `,
      setup(f) {
        let op: 'add' | 'mul' | 'max' = 'add';
        const st = { x: 3, y: -4, dout: 2 };
        const mk = (): CircuitSpec => ({
          inputs: [
            { id: 'x', at: [0, 0.1] },
            { id: 'y', at: [0, 1.6] },
          ],
          ops: [{ id: 'out', op, ins: ['x', 'y'], at: [1, 0.85] }],
          size: [1.55, 1.7],
          outName: 'out',
        });
        let spec = mk();
        let ev = evaluate(spec, st, st.dout);
        const cv = f.canvas(640, 360, (ctx, w, h) => drawCircuit(ctx, w, h, spec, ev, revealAll(spec), { thickByGrad: true }));
        cv.canvas.classList.add('scroll-ok');
        const update = () => {
          spec = mk();
          ev = evaluate(spec, st, st.dout);
          f.code.setMany({ out: f2(ev.val.out!), dx: f2(ev.grad.x!), dy: f2(ev.grad.y!) });
          f.code.highlight(op);
          const msg = op === 'add'
            ? `Add: both inputs get the upstream gradient as is, whatever their values.`
            : op === 'mul'
              ? `Multiply: \`x\` gets \`y\` × upstream = ${f2(ev.grad.x!)}, and \`y\` gets \`x\` × upstream = ${f2(ev.grad.y!)}.${Math.abs(st.x) !== Math.abs(st.y) ? ' The *smaller* input receives the *bigger* gradient.' : ''}`
              : `Max: the larger input (${st.x >= st.y ? '`x`' : '`y`'}) gets the whole upstream gradient; the other gets 0.`;
          f.status(msg);
          cv.redraw();
        };
        f.segmented({
          label: 'gate',
          options: [
            { value: 'add', label: 'add' },
            { value: 'mul', label: 'multiply' },
            { value: 'max', label: 'max' },
          ],
          value: 'add',
          onChange: (v) => { op = v as typeof op; update(); },
        });
        f.slider({ label: 'x', sym: 'x', min: -5, max: 5, step: 0.5, value: 3, slot: 'x', onInput: (v) => { st.x = v; update(); } });
        f.slider({ label: 'y', sym: 'x', min: -5, max: 5, step: 0.5, value: -4, slot: 'y', onInput: (v) => { st.y = v; update(); } });
        f.slider({ label: 'upstream', sym: 'g', min: -3, max: 3, step: 0.5, value: 2, slot: 'dout', onInput: (v) => { st.dout = v; update(); } });
        update();
      },
      caption: `One gate, with its upstream gradient set by the slider. Wire thickness shows how big each gradient is. With **add**, move \`x\` and \`y\` anywhere: the gradients never change. With **max**, drag \`y\` past \`x\` and the whole gradient jumps from one wire to the other. With **multiply**, set \`x\` to 0.5 and \`y\` to 5: the small input gets the big gradient, and vice versa. That last effect matters in practice, as explained below.`,
    });
    p.prose(`
Here are all three personalities in one circuit, $f = 2\\,\\big(x y + \\max(z, w)\\big)$, with $x = 3$, $y = -4$, $z = 2$, $w = -1$. Before stepping through it, try predicting each input's gradient from the three rules alone.`);
    p.figure({
      title: 'All three patterns in one circuit',
      codeTitle: 'patterns_circuit.py',
      code: `
        x, y, z, w = 3.0, -4.0, 2.0, -1.0           #@in
        # forward
        m = x * y               # {{m}}             #@f1
        n = max(z, w)           # {{n}}             #@f2
        s = m + n               # {{s}}             #@f3
        f = 2.0 * s             # {{f}}             #@f4
        # backward
        df = 1.0                                    #@b0
        ds = 2.0 * df                  # {{ds}}     #@b4
        dm, dn = 1.0 * ds, 1.0 * ds    # distribute #@b3
        dz = dn if z >= w else 0.0     # route      #@b2
        dw = dn if w > z else 0.0      # route      #@b2
        dx, dy = y * dm, x * dm        # swap       #@b1
        # dx = {{dx}}  dy = {{dy}}
        # dz = {{dz}}  dw = {{dw}}
      `,
      setup(f) {
        const spec: CircuitSpec = {
          inputs: [
            { id: 'x', at: [0, 0] },
            { id: 'y', at: [0, 0.95] },
            { id: 'z', at: [0, 2.05] },
            { id: 'w', at: [0, 3.0] },
          ],
          ops: [
            { id: 'm', op: 'mul', ins: ['x', 'y'], at: [1, 0.48], name: 'm' },
            { id: 'n', op: 'max', ins: ['z', 'w'], at: [1, 2.52], name: 'n' },
            { id: 's', op: 'add', ins: ['m', 'n'], at: [2, 1.5], name: 's' },
            { id: 'f', op: 'mulc', c: 2, ins: ['s'], at: [3, 1.5] },
          ],
          size: [3.6, 3.0],
          outName: 'f',
        };
        circuitWalk(f, spec, { x: 3, y: -4, z: 2, w: -1 }, {
          w: 640,
          h: 480,
          labels: ['in', 'f1', 'f2', 'f3', 'f4', 'b0', 'b4', 'b3', 'b2', 'b1'],
          slots: (ev, k) => {
            const v = (id: string, at: number) => (k >= at ? f2(ev.val[id]!) : '…');
            const g = (id: string, at: number) => (k >= at ? f2(ev.grad[id]!) : '…');
            return { m: v('m', 1), n: v('n', 2), s: v('s', 3), f: v('f', 4), ds: g('s', 6), dx: g('x', 9), dy: g('y', 9), dz: g('z', 8), dw: g('w', 8) };
          },
        });
      },
      caption: `The multiply-by-2 gate doubles the gradient to 2. The add gate gives 2 to both of its inputs. The max gate routes all of its 2 to $z$, because $z = 2$ beat $w = -1$, so $w$ gets exactly zero: nudging $w$ a little would not change anything. Finally the multiply gate swaps: $x$ gets $y \\times 2 = -8$ and $y$ gets $x \\times 2 = 6$.`,
    });
    p.prose(`
### Why the scale of your inputs matters

The multiply gate's habit of swapping has an unintuitive consequence. If one input is tiny and the other is huge, the tiny one gets a huge gradient and the huge one gets a tiny gradient. Now remember that a linear classifier multiplies weights by data. The gradient on the weights is therefore scaled by the data:`);
    p.math({
      label: 'Weight gradients carry the scale of the data',
      tex: String.raw`s = \sum_i \sym{W}{w_i}\,${X('x_i')} \quad\Longrightarrow\quad ${G('s', 'w_i')} = ${X('x_i')}`,
      code: `
        s = np.dot(w, x)
        dw = x * ds        # each weight's gradient is its input, scaled
        # multiply every x by 1000 and dw is 1000 times larger
      `,
      codeTitle: 'scale.py',
      terms: [
        [String.raw`${G('s', 'w_i')}`, 'how the score responds to weight $i$'],
        [String.raw`= ${X('x_i')}`, 'the multiply gate swaps: the weight\'s gradient is the input it was multiplied with'],
      ],
      explain: 'If you multiplied every training example by 1000 during preprocessing, every weight gradient would grow 1000 times, and you would need a learning rate 1000 times smaller to take the same steps. This is one concrete reason preprocessing (centering and scaling the data, Chapter 8) matters: the size of the inputs leaks straight into the size of the gradients.',
    });

    p.h2('Gradients for vectorized operations', 'vectorized');
    p.prose(`
Everything so far used single numbers, but networks work with whole matrices at once. Nothing new is needed: the same rules apply element by element. The only extra care goes into **shapes** and **transposes**. The most important case by far is the matrix multiply.`);
    p.math({
      label: 'Gradients of a matrix multiply',
      tex: String.raw`\begin{aligned} D &= \symW ${X('X')} \\[3pt] ${G('f', '\\symW')} &= ${G('f', 'D')}\,${X('X')}^{\top} \\[3pt] ${G('f', 'X')} &= \symW^{\top}\,${G('f', 'D')} \end{aligned}`,
      code: `
        W = np.random.randn(5, 10)
        X = np.random.randn(10, 3)
        D = W.dot(X)                      # (5, 3)

        dD = np.random.randn(*D.shape)    # pretend upstream gradient
        dW = dD.dot(X.T)                  # (5, 3) x (3, 10) -> (5, 10)
        dX = W.T.dot(dD)                  # (10, 5) x (5, 3) -> (10, 3)
      `,
      codeTitle: 'matmul_grad.py',
      terms: [
        [G('f', 'D'), 'the upstream gradient: one number per entry of $D$, so it has exactly the shape of $D$'],
        [String.raw`${X('X')}^{\top}`, 'the *transpose* of $X$: its rows become columns. In NumPy, `X.T`'],
        [G('f', '\\symW'), 'the gradient on the weights. It must have the same shape as $W$, since there is one gradient per weight'],
      ],
      explain: 'Why this formula? Weight $W_{ij}$ is used in every entry of row $i$ of $D$, multiplied by $X_{jk}$ in column $k$. So by the multiply rule and the fork rule, $\\partial f/\\partial W_{ij} = \\sum_k (\\partial f/\\partial D_{ik})\\,X_{jk}$: row $i$ of `dD` dotted with row $j$ of `X`, which is exactly entry $(i, j)$ of `dD.dot(X.T)`. You do not need to rederive this each time. **Dimension analysis** recovers it: the gradient on `W` must have the shape of `W`, it must be built from `dD` and `X`, and there is only one way to multiply those two so the shapes come out right.',
    });
    p.figure({
      title: 'Only one arrangement fits: dimension analysis',
      codeTitle: 'shapes.py',
      code: `
        W = np.random.randn({{n:5}}, {{d:10}})
        X = np.random.randn({{d:10}}, {{m:3}})
        D = W.dot(X)                         # ({{n}}, {{m}})
        dD = np.random.randn(*D.shape)       # from above

        dW = dD.dot(X.T)     # ({{n}},{{m}}) x ({{m}},{{d}}) -> ({{n}},{{d}})  #@dW
        dX = W.T.dot(dD)     # ({{d}},{{n}}) x ({{n}},{{m}}) -> ({{d}},{{m}})  #@dX

        # numeric check of dW. This f has gradient dD on D:
        f = lambda W: np.sum(W.dot(X) * dD)                    #@chk
        h = 1e-5
        num_dW = np.zeros_like(W)
        for i, j in np.ndindex(*W.shape):                      #@chk
            Wp, Wm = W.copy(), W.copy()
            Wp[i, j] += h
            Wm[i, j] -= h
            num_dW[i, j] = (f(Wp) - f(Wm)) / (2 * h)            #@chk
        print(np.abs(num_dW - dW).max())    # {{err}}          #@chk
      `,
      setup(f) {
        const dims = { n: 5, d: 10, m: 3 };
        let target: 'dW' | 'dX' = 'dW';
        type Sh = [number, number];
        const shapeOf = (nm: string): Sh => {
          const { n, d, m } = dims;
          return ({ W: [n, d], 'W.T': [d, n], X: [d, m], 'X.T': [m, d], dD: [n, m], 'dD.T': [m, n] } as Record<string, Sh>)[nm]!;
        };
        const cands = () =>
          target === 'dW'
            ? [['dD', 'X'], ['dD', 'X.T'], ['X', 'dD'], ['X.T', 'dD']]
            : [['W', 'dD'], ['W.T', 'dD'], ['dD', 'W'], ['dD.T', 'W']];
        const narrowShapes = f.viz.clientWidth < 420;
        const cv = f.canvas(narrowShapes ? 400 : 640, narrowShapes ? 430 : 520, (ctx, w, h) => {
          const mono = (sz: number, wt = 500) => `${wt} ${sz}px 'JetBrains Mono Variable', ui-monospace, monospace`;
          const { n, d, m } = dims;
          const mats: [string, Sh, string][] = [
            ['W', [n, d], color('blue')],
            ['X', [d, m], color('orange')],
            ['D', [n, m], color('purple')],
            ['dD', [n, m], color('teal')],
          ];
          const maxDim = 10;
          const cell = Math.min((w - 70) / (2 * maxDim + 2 * m + 6) * 1.0, 13, (h * 0.46) / maxDim);
          let x0 = 12;
          const top = 30;
          ctx.textBaseline = 'alphabetic';
          mats.forEach(([nm, [r, c], col], i) => {
            const ww = c * cell;
            const hh = r * cell;
            ctx.fillStyle = withAlpha(col, 0.18);
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.5;
            ctx.fillRect(x0, top, ww, hh);
            ctx.strokeRect(x0, top, ww, hh);
            ctx.strokeStyle = withAlpha(col, 0.25);
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let a = 1; a < c; a++) { ctx.moveTo(x0 + a * cell, top); ctx.lineTo(x0 + a * cell, top + hh); }
            for (let a = 1; a < r; a++) { ctx.moveTo(x0, top + a * cell); ctx.lineTo(x0 + ww, top + a * cell); }
            ctx.stroke();
            ctx.fillStyle = col;
            ctx.font = mono(12, 650);
            ctx.textAlign = 'left';
            ctx.fillText(nm, x0, top - 16);
            ctx.fillStyle = color('--ink-3');
            ctx.font = mono(11);
            ctx.fillText(`(${r},${c})`, x0, top - 4);
            const gap = i === 0 ? 22 : i === 1 ? 26 : 22;
            if (i < 2) {
              ctx.fillStyle = color('--ink-2');
              ctx.font = mono(14);
              ctx.textAlign = 'center';
              ctx.fillText(i === 0 ? '·' : '=', x0 + ww + gap / 2, top + Math.min(hh, 8 * cell) / 2 + 5);
            }
            x0 += ww + gap;
          });
          // candidates
          const ty = top + maxDim * cell + 30;
          ctx.textAlign = 'left';
          ctx.font = mono(12, 600);
          ctx.fillStyle = color('--ink');
          const want = target === 'dW' ? shapeOf('W') : shapeOf('X');
          ctx.fillText(`${target} must have the shape of ${target === 'dW' ? 'W' : 'X'}: (${want[0]},${want[1]})`, 12, ty);
          const rowH = 38;
          let fits = 0;
          cands().forEach(([a, b], i) => {
            const A = shapeOf(a!), B = shapeOf(b!);
            const inner = A[1] === B[0];
            const out: Sh = [A[0], B[1]];
            const ok = inner && out[0] === want[0] && out[1] === want[1];
            if (ok) fits++;
            const y0 = ty + 10 + i * (rowH + 5);
            const col = ok ? color('green') : color('red');
            ctx.fillStyle = withAlpha(col, ok ? 0.13 : 0.06);
            ctx.fillRect(8, y0, w - 16, rowH);
            ctx.textAlign = 'left';
            ctx.font = mono(13, 600);
            ctx.fillStyle = color('--ink');
            ctx.fillText(`${a}.dot(${b})`, 16, y0 + 16);
            ctx.font = mono(11);
            ctx.fillStyle = color('--ink-2');
            const shp = `(${A[0]},${A[1]})·(${B[0]},${B[1]})  `;
            ctx.fillText(shp, 16, y0 + 31);
            ctx.fillStyle = col;
            ctx.fillText(!inner ? `inner sizes ${A[1]} ≠ ${B[0]}` : ok ? `→ (${out[0]},${out[1]}) fits` : `→ (${out[0]},${out[1]}) wrong shape`, 16 + ctx.measureText(shp).width, y0 + 31);
            ctx.font = mono(15, 700);
            ctx.textAlign = 'right';
            ctx.fillText(ok ? '✓' : '✗', w - 16, y0 + 24);
          });
          f.status(fits === 1 ? `Exactly one product has the right shape, so it must be the gradient.` : `${fits} products fit these shapes: with repeated sizes, shapes alone cannot tell them apart. Use sizes that are all different when you work things out.`);
        });
        cv.canvas.classList.add('scroll-ok');
        const err = f.readout('max |numeric − dW|');
        const runCheck = () => {
          const r = new Rng(dims.n * 100 + dims.d * 10 + dims.m);
          const { n, d, m } = dims;
          const W = Array.from({ length: n * d }, () => r.randn());
          const Xm = Array.from({ length: d * m }, () => r.randn());
          const dD = Array.from({ length: n * m }, () => r.randn());
          const fW = (Wv: number[]) => {
            let s = 0;
            for (let i = 0; i < n; i++) for (let k = 0; k < m; k++) {
              let v = 0;
              for (let j = 0; j < d; j++) v += Wv[i * d + j]! * Xm[j * m + k]!;
              s += v * dD[i * m + k]!;
            }
            return s;
          };
          let worst = 0;
          const e = 1e-5;
          for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) {
            let an = 0;
            for (let k = 0; k < m; k++) an += dD[i * m + k]! * Xm[j * m + k]!;
            const Wp = W.slice(), Wm = W.slice();
            Wp[i * d + j]! += e;
            Wm[i * d + j]! -= e;
            const nu = (fW(Wp) - fW(Wm)) / (2 * e);
            worst = Math.max(worst, Math.abs(nu - an));
          }
          const s = worst.toExponential(1);
          err.set(s);
          f.code.set('err', s);
        };
        const sync = () => {
          f.code.highlight(target, 'alt');
          runCheck();
          cv.redraw();
        };
        f.segmented({
          label: 'solve for',
          options: [
            { value: 'dW', label: 'dW' },
            { value: 'dX', label: 'dX' },
          ],
          value: 'dW',
          onChange: (v) => { target = v as 'dW' | 'dX'; sync(); },
        });
        for (const [k, lab] of [['n', 'rows of W'], ['d', 'inner size'], ['m', 'columns of X']] as const) {
          f.slider({ label: lab, min: 1, max: 10, step: 1, value: dims[k], slot: k, onInput: (v) => { dims[k] = v; sync(); } });
        }
        sync();
      },
      caption: `The blocks are drawn to scale: one square per number. Below them are the four ways to combine the upstream gradient with the other factor, and only one produces a matrix shaped like the thing whose gradient we want. Switch between **dW** and **dX**. Then set two sizes equal (say 5, 5, 3) and watch a second wrong candidate start to "fit": that is why the advice is to work through tiny explicit examples with *different* sizes, write out a few entries by hand, and check against a numerical gradient like the one at the bottom of the listing (its result is the readout).`,
    });
    p.callout('aside', `For element-wise operations, the general machinery would talk about a **Jacobian**: the matrix of every output's derivative with respect to every input. Applying $\\max(0, x)$ to a 4096-dimensional vector has a 4096 × 4096 Jacobian, and on a batch of 100 vectors it would be 409,600 × 409,600. Nobody ever builds it. For an element-wise operation it is diagonal (output $i$ depends only on input $i$), so backprop just multiplies element by element: for $\\max(0, x)$, the upstream gradient passes where $x > 0$ and becomes zero elsewhere.`, 'What about Jacobians?');
    p.prose(`
This is exactly the skill Assignment 1 asks for: the vectorized SVM, Softmax and two-layer network all need a backward pass written with matrix operations, checked against a numerical gradient. Chapter 10 does that same two-layer network from start to finish, live.`);

    p.h2('Summary', 'summary');
    p.table(
      ['Gate', 'Forward', 'Backward (upstream `dout`)', 'Personality'],
      [
        ['add', '`x + y`', '`dx = dout`, `dy = dout`', 'distributes'],
        ['multiply', '`x * y`', '`dx = y * dout`, `dy = x * dout`', 'swaps and scales'],
        ['max', '`max(x, y)`', 'all of `dout` to the larger input, 0 to the other', 'routes'],
        ['sigmoid', '`f = 1 / (1 + exp(-z))`', '`dz = (1 - f) * f * dout`', 'shrinks (by at most 0.25)'],
        ['reuse (fork)', 'one value used twice', 'the gradients from both uses add: `+=`', 'accumulates'],
        ['matrix multiply', '`D = W.dot(X)`', '`dW = dD.dot(X.T)`, `dX = W.T.dot(dD)`', 'check by shapes'],
      ],
    );
    p.callout('idea', `Backpropagation computes the gradient of a complicated function by recursively applying the chain rule. Write the forward pass as a chain of simple **stages** and cache their values. Then walk backward from the output, seeded with gradient 1: every gate multiplies the **upstream** gradient by its own **local** gradient and passes the result to its inputs, and gradients **add up** wherever a value was used more than once. Add distributes, max routes, multiply swaps. For matrices, the gradient always has the shape of the variable, which pins down where the transposes go.`, 'Takeaways');
  },
};

export default chapter;
