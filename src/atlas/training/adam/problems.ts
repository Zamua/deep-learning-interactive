import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { clean, minus, nonzero, paren, tenth, traps, whys } from '../kit';

const M_RULE = 'm \\leftarrow \\beta_1 m + (1 - \\beta_1)\\,\\symg';
const V_RULE = 'v \\leftarrow \\beta_2 v + (1 - \\beta_2)\\,\\symg^2';
const STEP = '\\symw \\leftarrow \\symw - \\symeta\\,\\hat m / (\\sqrt{\\hat v} + \\epsilon)';

export const generators: Generator[] = [
  {
    id: 'moments',
    make(rng, d) {
      const askM = rng.next() < 0.6;
      const b1 = d < 0.7 ? 0.9 : pick(rng, [0.8, 0.9]);
      const b2 = d < 0.7 ? 0.999 : pick(rng, [0.99, 0.999]);
      const g = d < 0.35 ? int(rng, 1, 5) : d < 0.7 ? nonzero(rng, -5, 5) : tenth(rng, -3, 3);
      const fresh = d < 0.35;
      const m0 = fresh ? 0 : d < 0.7 ? pick(rng, [0.5, 1, -0.5, 2, 0.2]) : tenth(rng, -2, 2);
      const v0 = fresh ? 0 : pick(rng, [0.01, 0.04, 0.1, 0.5, 1]);
      const m = clean(b1 * m0 + (1 - b1) * g);
      const v = clean(b2 * v0 + (1 - b2) * g * g);
      const ans = askM ? m : v;
      const state = fresh ? 'Both moments start at $m = v = 0$.' : askM ? `The first moment is $m = ${num(m0)}$.` : `The second moment is $v = ${num(v0)}$.`;
      return {
        prompt: `Adam keeps $${askM ? M_RULE : V_RULE}$, with $${askM ? `\\beta_1 = ${num(b1)}` : `\\beta_2 = ${num(b2)}`}$. ${state} The new gradient is $\\symg = ${num(g)}$. What is ${askM ? '$m$' : '$v$'} after this update?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, askM
          ? [
              { value: g, why: 'That is the raw gradient. $m$ is a running average, so it moves only part of the way toward $\\symg$.' },
              { value: b1 * g + (1 - b1) * m0, why: 'That swaps the weights: the old average keeps $\\beta_1$, and the new gradient gets $1 - \\beta_1$.' },
              { value: b1 * m0 + g, why: 'That adds the whole gradient. It is scaled by $1 - \\beta_1$ first.' },
            ]
          : [
              { value: b2 * v0 + (1 - b2) * g, why: 'That averages $\\symg$ itself. The second moment averages the squared gradient, $\\symg^2$.' },
              { value: g * g, why: 'That is the raw squared gradient. $v$ is a running average, so it moves only part of the way toward $\\symg^2$.' },
              { value: b2 * g * g + (1 - b2) * v0, why: 'That swaps the weights: the old average keeps $\\beta_2$, and the new $\\symg^2$ gets $1 - \\beta_2$.' },
            ]),
        solution: askM
          ? [
              `$m = ${num(b1)} \\times ${paren(m0)} + ${num(clean(1 - b1))} \\times ${paren(g)}$.`,
              `$= ${num(clean(b1 * m0))} + ${paren(clean((1 - b1) * g))} = ${num(m)}$.`,
              fresh ? 'Starting from 0, $m$ is only a tenth of the gradient: biased toward 0, which the bias correction fixes.' : `It moved ${b1 === 0.9 ? 'a tenth' : 'a fifth'} of the way from $${num(m0)}$ toward the gradient $${num(g)}$.`,
            ]
          : [
              `$\\symg^2 = ${num(clean(g * g))}$.`,
              `$v = ${num(b2)} \\times ${num(v0)} + ${num(clean(1 - b2))} \\times ${num(clean(g * g))} = ${num(clean(b2 * v0))} + ${num(clean((1 - b2) * g * g))} = ${num(v)}$.`,
              fresh ? 'Starting from 0, $v$ is far below $\\symg^2$: biased toward 0, which the bias correction fixes.' : '$v$ tracks how large this parameter\'s gradients usually are, whatever their sign.',
            ],
      };
    },
  },
  {
    id: 'bias-correct',
    make(rng, d) {
      const b1 = 0.9;
      if (d < 0.35 || (d < 0.7 && rng.next() < 0.4)) {
        const askM = rng.next() < 0.6;
        const g = d < 0.35 ? int(rng, 1, 6) : nonzero(rng, -6, 6);
        const m = clean(0.1 * g);
        const v = clean(0.001 * g * g);
        const raw = askM ? m : v;
        const ans = askM ? g : clean(g * g);
        const c = askM ? 0.1 : 0.001;
        return {
          prompt: `After Adam's first step ($t = 1$, from $m = v = 0$, with $\\beta_1 = 0.9$, $\\beta_2 = 0.999$), ${askM ? `$m = ${num(m)}$` : `$v = ${num(v)}$`}. What is the bias-corrected ${askM ? '$\\hat m = m / (1 - \\beta_1^t)$' : '$\\hat v = v / (1 - \\beta_2^t)$'}?`,
          answer: { kind: 'number', value: ans },
          traps: traps(ans, [
            { value: raw, why: 'That is the moment before correction. Divide by $1 - \\beta^t$, which is small early on.' },
            { value: raw / (askM ? 0.9 : 0.999), why: 'That divides by $\\beta^t$. The correction divides by $1 - \\beta^t$.' },
            { value: raw * c, why: 'That multiplies by $1 - \\beta^t$. The correction divides by it, scaling the moment up.' },
          ]),
          solution: [
            `At $t = 1$: $1 - ${askM ? '\\beta_1' : '\\beta_2'} = ${num(c)}$.`,
            `${askM ? '$\\hat m' : '$\\hat v'} = ${num(raw)} / ${num(c)} = ${num(ans)}$.`,
            askM ? `That is exactly the gradient, $${num(g)}$: at the first step the corrected average is the one gradient seen.` : `That is exactly $\\symg^2$: at the first step the corrected average is the one squared gradient seen.`,
          ],
        };
      }
      const g1 = nonzero(rng, -4, 5);
      const g2 = nonzero(rng, -4, 5);
      const m1 = clean(0.1 * g1);
      const m2 = clean(0.9 * m1 + 0.1 * g2);
      const ans = round(m2 / 0.19, 2);
      return {
        prompt: `Adam starts with $m = 0$ and $\\beta_1 = 0.9$. The first two gradients are $${num(g1)}$ and $${num(g2)}$. What is the bias-corrected $\\hat m = m / (1 - \\beta_1^t)$ after the second step? Use $1 - 0.9^2 = 0.19$, and round to two decimals.`,
        answer: { kind: 'number', value: ans, places: 2 },
        traps: traps(ans, [
          { value: m2, why: 'That is $m$ before correction. Divide by $1 - \\beta_1^2 = 0.19$.' },
          { value: round(m2 / 0.1, 2), why: 'That divides by $1 - \\beta_1$, the first step\'s correction. At $t = 2$ it is $1 - \\beta_1^2 = 0.19$.' },
          { value: round((g1 + g2) / 2, 2), why: 'That is the plain mean of the two gradients. The running average weighs the newer one more: $0.1$ against $0.09$.' },
        ].filter((t) => Math.abs(t.value - ans) >= 0.01)),
        solution: [
          `Step 1: $m = 0.1 \\times ${paren(g1)} = ${num(m1)}$.`,
          `Step 2: $m = 0.9 \\times ${paren(m1)} + 0.1 \\times ${paren(g2)} = ${num(m2)}$.`,
          `Correct it: $\\hat m = ${num(m2)} / 0.19 \\approx ${num(ans, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'step',
    make(rng, d) {
      const pairs: [number, number][] = [[0.04, 0.2], [0.25, 0.5], [1, 1], [4, 2], [9, 3], [16, 4], [0.01, 0.1], [0.0004, 0.02]];
      const [vh, root] = pick(rng, pairs);
      const k = d < 0.35 ? pick(rng, [1, 2, 0.5]) : pick(rng, [1, 2, 0.5, -1, -0.5, 1.5, -2]);
      const mh = clean(k * root);
      const eta = pick(rng, [0.001, 0.01, 0.1]);
      const step = clean((eta * mh) / root);
      const askW = d >= 0.35;
      const w = askW ? (d < 0.7 ? int(rng, -2, 3) : tenth(rng, -2, 2)) : 0;
      const ans = askW ? clean(w - step) : step;
      const base = askW ? w : 0;
      const sign = askW ? -1 : 1;
      return {
        prompt: askW
          ? `Adam's update is $${STEP}$. A weight is at $\\symw = ${num(w)}$ with $\\hat m = ${num(mh)}$ and $\\hat v = ${num(vh)}$, and $\\symeta = ${num(eta)}$. Ignoring the tiny $\\epsilon$, where is $\\symw$ after the step?`
          : `Adam's update is $${STEP}$. For one parameter $\\hat m = ${num(mh)}$ and $\\hat v = ${num(vh)}$, and $\\symeta = ${num(eta)}$. Ignoring the tiny $\\epsilon$, how far does the parameter move, $\\symeta\\,\\hat m / \\sqrt{\\hat v}$?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: base + (sign * eta * mh) / vh, why: 'That divides by $\\hat v$ itself. Adam divides by its square root, $\\sqrt{\\hat v}$, the typical size of the gradient.' },
          { value: base + sign * eta * mh, why: 'That leaves out the division by $\\sqrt{\\hat v}$: it is a momentum step, not an Adam step.' },
          ...(askW ? [{ value: w + step, why: 'That steps uphill. The update subtracts the step, as gradient descent does.' }] : []),
        ]),
        solution: [
          `$\\sqrt{\\hat v} = \\sqrt{${num(vh)}} = ${num(root)}$.`,
          `The step: $\\symeta\\,\\hat m / \\sqrt{\\hat v} = ${num(eta)} \\times ${paren(mh)} / ${num(root)} = ${num(step)}$.`,
          ...(askW ? [`$\\symw \\leftarrow ${minus(w, step)} = ${num(ans)}$.`] : []),
          `The ratio $\\hat m / \\sqrt{\\hat v} = ${num(k)}$ is the gradient in units of its own typical size, so the step is $${num(k)}$ times $\\symeta$.`,
        ],
      };
    },
  },
  {
    id: 'scale',
    make(rng) {
      const eta = pick(rng, [0.001, 0.01, 0.0003]);
      if (rng.next() < 0.5) {
        const big = pick(rng, [500, 200, 50, 1000]);
        const small = pick(rng, [0.002, 0.005, 0.01, 0.001]);
        const ratio = clean(big / small);
        const opts = [`Both move about $${num(eta)}$, whatever their gradients`, `$a$ moves ${ratio.toLocaleString('en-US')} times farther than $b$, as in plain gradient descent`, '$b$ moves farther: Adam divides by the gradient', 'Neither moves: $m$ and $v$ start at zero'];
        const reasons = [
          '',
          'Plain gradient descent scales the step with the gradient; Adam divides by $\\sqrt{\\hat v}$, which scales the same way, so the size cancels.',
          'Adam divides by the size of the gradient, but $\\hat m$ carries that same size on top: the ratio is $\\pm 1$ for both.',
          'The bias correction undoes the zero start: at $t = 1$, $\\hat m = \\symg$ and $\\hat v = \\symg^2$.',
        ];
        return {
          prompt: `At Adam's first step, parameter $a$ has gradient $${num(big)}$ and parameter $b$ has gradient $${num(small)}$. With $\\symeta = ${num(eta)}$, how big are their first steps?`,
          answer: { kind: 'choice', options: opts, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            'At $t = 1$ the bias correction gives $\\hat m = \\symg$ and $\\hat v = \\symg^2$.',
            'So the step is $\\symeta\\,\\symg / \\sqrt{\\symg^2} = \\symeta\\,\\symg / |\\symg| = \\pm\\symeta$.',
            `Both move about $${num(eta)}$, whatever the size of their gradients.`,
          ],
        };
      }
      const tiny = pick(rng, [0.001, 0.0001, 0.002, 0.0005]);
      const large = pick(rng, [10, 5, 20, 2]);
      const ratio = clean(large / tiny);
      const opts = ['They move about the same, roughly $\\symeta$ each', `$b$ moves about ${ratio.toLocaleString('en-US')} times farther, as in plain gradient descent`, '$a$ moves much farther: its gradients are tiny', '$a$ barely moves: $\\epsilon$ swamps its tiny $\\hat v$'];
      const reasons = [
        '',
        'That is plain gradient descent, where the step scales with the gradient. Adam divides by $\\sqrt{\\hat v}$, the typical size of each parameter\'s own gradient, which cancels that scale.',
        `Dividing by $\\sqrt{\\hat v}$ cancels the scale, it does not invert it: $\\hat m / \\sqrt{\\hat v}$ is about 1 for both when the sign holds steady.`,
        `$\\epsilon$ is about $10^{-8}$, far below $\\sqrt{\\hat v} \\approx ${num(tiny)}$, so it barely changes the step.`,
      ];
      return {
        prompt: `For many steps, parameter $a$'s gradient has stayed near $${num(tiny)}$ and parameter $b$'s near $${num(large)}$, each with a steady sign. With Adam at $\\symeta = ${num(eta)}$, how do their steps compare?`,
        answer: { kind: 'choice', options: opts, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          `For $a$: $\\hat m \\approx ${num(tiny)}$ and $\\sqrt{\\hat v} \\approx ${num(tiny)}$. For $b$: both about $${num(large)}$.`,
          'So $\\hat m / \\sqrt{\\hat v} \\approx 1$ for each, and each moves about $\\symeta$ per step.',
          'Adam gives every parameter a step sized to its own gradients: one whose gradients are tiny still moves, where plain gradient descent would barely move it.',
        ],
      };
    },
  },
];
