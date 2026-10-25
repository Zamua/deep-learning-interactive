import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { MH, VH, clean, minus, paren, tenth, traps, whys } from '../modern-kit';

const AW = `\\symw \\leftarrow \\symw - \\symeta\\big(${MH} / \\sqrt{${VH}} + \\symlam\\,\\symw\\big)`;

export const generators: Generator[] = [
  {
    id: 'step',
    make(rng, d) {
      const easy = d < 0.35;
      const w = easy ? int(rng, 1, 5) : d < 0.7 ? pick(rng, [-4, -3, -2, -1, 1, 2, 3, 4, 5]) : tenth(rng, -3, 3);
      const root = easy ? pick(rng, [0.1, 0.2, 0.5, 1]) : pick(rng, [0.1, 0.2, 0.3, 0.5, 2, 3]);
      const k = easy ? pick(rng, [1, 2]) : pick(rng, [1, -1, 2, -2, 0.5, -0.5, 1.5]);
      const eta = easy ? 0.1 : pick(rng, [0.1, 0.01]);
      const lam = easy ? 0.1 : pick(rng, [0.1, 0.05, 0.2]);
      const v = clean(root * root);
      const m = clean(k * root);
      const decay = clean(lam * w);
      const inside = clean(k + decay);
      const step = clean(eta * inside);
      const ans = clean(w - step);
      return {
        prompt: `A weight at $\\symw = ${num(w)}$ has $${MH} = ${num(m)}$ and $${VH} = ${num(v)}$, with $\\symeta = ${num(eta)}$ and $\\symlam = ${num(lam)}$. Where is $\\symw$ after one AdamW step?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: w - eta * k, why: 'That is a plain Adam step: it leaves out the decay $\\symlam\\symw$ inside the bracket.' },
          { value: w - eta * k - decay, why: 'That subtracts the decay $\\symlam\\symw$ without the step size. The decay sits inside the bracket, so it is multiplied by $\\symeta$ too.' },
          { value: w - eta * (m / v + decay), why: `That divides $${MH}$ by $${VH}$ itself. The step divides by its square root.` },
          { value: w - eta * (k - decay), why: 'That subtracts the decay inside the bracket. It is added to the Adam step, so together they pull the weight toward zero.' },
        ]),
        solution: [
          `AdamW steps $${AW}$.`,
          `$\\sqrt{${VH}} = \\sqrt{${num(v)}} = ${num(root)}$, so $${MH} / \\sqrt{${VH}} = ${num(m)} / ${num(root)} = ${num(k)}$.`,
          `The decay: $\\symlam\\symw = ${num(lam)} \\times ${paren(w)} = ${num(decay)}$.`,
          `Inside the bracket: $${num(k)} + ${paren(decay)} = ${num(inside)}$. Times $\\symeta$: $${num(eta)} \\times ${paren(inside)} = ${num(step)}$.`,
          `$\\symw \\leftarrow ${minus(w, step)} = ${num(ans)}$.`,
        ],
      };
    },
  },
  {
    id: 'decay-share',
    make(rng, d) {
      const large = rng.next() < 0.5;
      const root = large ? pick(rng, d < 0.5 ? [2, 5, 10] : [2, 4, 5, 10, 20]) : pick(rng, d < 0.5 ? [0.1, 0.5] : [0.1, 0.2, 0.5, 0.05]);
      const w = d < 0.5 ? pick(rng, [1, 2, 4]) : pick(rng, [0.5, 1, 2, 3, 5]);
      const lam = pick(rng, [0.1, 0.2, 0.5]);
      const eta = d < 0.5 ? 0.01 : pick(rng, [0.01, 0.001]);
      const share = clean(lam * w);
      const ans = clean((eta * share) / root);
      const aw = clean(eta * share);
      return {
        prompt: `Adam with L2 trains a weight at $\\symw = ${num(w)}$ with $\\sqrt{${VH}} = ${num(root)}$, $\\symlam = ${num(lam)}$ and $\\symeta = ${num(eta)}$. How far does the decay alone move it in one step?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: aw, why: 'That is AdamW\'s decay, $\\symeta\\symlam\\symw$. Inside the gradient the decay is also divided by $\\sqrt{\\sym{v}{\\hat v}}$.' },
          { value: (eta * share) / (root * root), why: 'That divides by $\\sym{v}{\\hat v}$ itself. Adam divides by its square root.' },
          { value: share / root, why: 'That leaves out the step size $\\symeta$.' },
        ]),
        solution: [
          `L2 adds $\\symlam\\symw$ to the gradient, so it adds about $\\symlam\\symw = ${num(lam)} \\times ${num(w)} = ${num(share)}$ to $${MH}$.`,
          `Adam divides by $\\sqrt{${VH}} = ${num(root)}$ and multiplies by $\\symeta$: $${num(eta)} \\times ${num(share)} / ${num(root)} = ${num(ans)}$.`,
          large
            ? `AdamW would move it $\\symeta\\symlam\\symw = ${num(aw)}$: ${num(root)} times more. Large gradients weaken decay that goes through the gradient.`
            : `AdamW would move it $\\symeta\\symlam\\symw = ${num(aw)}$: ${num(clean(1 / root))} times less. Tiny gradients amplify decay that goes through the gradient.`,
        ],
      };
    },
  },
  {
    id: 'choose',
    make(rng) {
      const kind = rng.int(3);
      const lam = pick(rng, [0.1, 0.05, 0.2, 0.5]);
      const eta = pick(rng, [0.001, 0.002, 0.01]);
      if (kind === 0) {
        const big = pick(rng, [5, 10, 20, 50]);
        const small = pick(rng, [0.01, 0.02, 0.05, 0.1]);
        const options = [
          '$b$: its decay is divided by a small $\\sqrt{\\sym{v}{\\hat v}}$, so it is amplified',
          '$a$: larger gradients mean its decay counts for more',
          'Both the same: L2 shrinks every weight by $\\symeta\\symlam$ per step',
          'Neither: dividing by $\\sqrt{\\sym{v}{\\hat v}}$ cancels the decay out',
        ];
        const reasons = [
          '',
          `It is the other way around: the decay is divided by $\\sqrt{\\sym{v}{\\hat v}} \\approx ${num(big)}$, so $a$'s decay is weakened.`,
          'That holds for plain gradient descent, and for AdamW. With L2 in Adam, the decay passes through the division by $\\sqrt{\\sym{v}{\\hat v}}$, a different number for each weight.',
          'The division rescales the decay; it does not remove it. A small $\\sqrt{\\sym{v}{\\hat v}}$ even makes it larger.',
        ];
        return {
          prompt: `Adam with L2 trains two weights at $\\symw = 1$, with $\\symlam = ${num(lam)}$. Weight $a$ has $\\sqrt{\\sym{v}{\\hat v}} \\approx ${num(big)}$; weight $b$ has $\\sqrt{\\sym{v}{\\hat v}} \\approx ${num(small)}$. Which one is decayed more strongly per step?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            'Inside the gradient, the decay $\\symlam\\symw$ is divided by $\\sqrt{\\sym{v}{\\hat v}}$ along with everything else.',
            `For $a$ that is $\\symlam / ${num(big)}$; for $b$, $\\symlam / ${num(small)}$: ${num(clean(big / small))} times larger.`,
            'So the weight with tiny gradients is decayed far more, which is not what $\\symlam$ asked for.',
          ],
        };
      }
      if (kind === 1) {
        const options = [
          `AdamW: $\\symw \\leftarrow \\symw - \\symeta\\big(\\sym{m}{\\hat m} / \\sqrt{\\sym{v}{\\hat v}} + \\symlam\\symw\\big)$`,
          `Adam, with $\\symlam\\symw$ added to the gradient`,
          `Adam, with a larger $\\symlam$ in the L2 penalty`,
          'Plain Adam: its per-weight steps already shrink every weight',
        ];
        const reasons = [
          '',
          'There the decay is divided by $\\sqrt{\\sym{v}{\\hat v}}$, so each weight shrinks by a different fraction.',
          'A larger $\\symlam$ still goes through the division by $\\sqrt{\\sym{v}{\\hat v}}$; it scales every decay up but keeps them unequal.',
          'Adam on its own has no decay: its steps follow the gradients, which can push a weight in either direction.',
        ];
        return {
          prompt: `With $\\symeta = ${num(eta)}$ and $\\symlam = ${num(lam)}$, you want every weight to shrink by the same fraction each step, whatever its gradients. Which update does that?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            'AdamW adds $\\symlam\\symw$ after the division by $\\sqrt{\\sym{v}{\\hat v}}$, so the decay part of the step is $\\symeta\\symlam\\symw$ for every weight.',
            `Each step it removes the fraction $\\symeta\\symlam = ${num(clean(eta * lam))}$ of every weight, whatever its gradients.`,
          ],
        };
      }
      const options = [
        'Onto the update directly, after the division by $\\sqrt{\\sym{v}{\\hat v}}$',
        'Into the gradient, before $\\sym{m}{\\hat m}$ and $\\sym{v}{\\hat v}$ are computed',
        'Into $\\sym{v}{\\hat v}$, which makes the denominator larger',
        'Into the loss, as $\\symlam$ times the sum of squared weights',
      ];
      const reasons = [
        '',
        'That is Adam with L2: the decay then passes through the division by $\\sqrt{\\sym{v}{\\hat v}}$.',
        'AdamW leaves $\\sym{v}{\\hat v}$ alone: it only tracks the squared gradients.',
        'A penalty in the loss turns into a gradient, which goes through Adam\'s division: that is L2 again.',
      ];
      return {
        prompt: `In AdamW with $\\symeta = ${num(eta)}$ and $\\symlam = ${num(lam)}$, where does the decay term $\\symlam\\symw$ go?`,
        answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          'AdamW computes $\\sym{m}{\\hat m}$ and $\\sym{v}{\\hat v}$ from the data gradient alone.',
          'Then it adds $\\symlam\\symw$ to the normalized step: $\\symw \\leftarrow \\symw - \\symeta(\\sym{m}{\\hat m} / \\sqrt{\\sym{v}{\\hat v}} + \\symlam\\symw)$, so the decay never meets $\\sqrt{\\sym{v}{\\hat v}}$.',
        ],
      };
    },
  },
];
