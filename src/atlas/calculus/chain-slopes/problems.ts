import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round, traps } from '../../kit';
import { paren, polyTex } from '../kit';

const D = (top: string, bot: string) => `\\frac{d${top}}{d${bot}}`;
/** The inside `ax + b` as TeX. */
const inner = (a: number, b: number) => ({ tex: polyTex([{ c: a, n: 1 }, { c: b, n: 0 }]) });

export const generators: Generator[] = [
  {
    id: 'local',
    make(rng, d) {
      const pool = d < 0.3 ? [2, 3, 4, 5, 6] : d < 0.65 ? [-3, -2, 2, 3, 4, 5, 0.5] : [-4, -2, -1, 0.5, 1.5, 2, 3, -0.5];
      const three = d >= 0.65;
      const s1 = pick(rng, pool);
      const s2 = pick(rng, pool);
      const s3 = three ? pick(rng, pool) : 1;
      const v = round(s1 * s2 * s3, 4);
      const names = three ? ['u', 'v', 'z'] : ['u', 'z'];
      const links = three
        ? [[D('u', '\\symx'), s1], [D('v', 'u'), s2], [D('z', 'v'), s3]] as const
        : [[D('u', '\\symx'), s1], [D('z', 'u'), s2]] as const;
      const shown = rng.shuffle([...links]);
      const outer = links[links.length - 1]![1];
      const cands = [
        { value: round(s1 + s2 + (three ? s3 : 0), 4), why: 'That adds the local slopes. A nudge is scaled by each link in turn, so the slopes multiply.' },
        { value: outer, why: `That is only the last link's slope. The earlier link${three ? 's scale' : ' scales'} the nudge first.` },
      ];
      if (s1 !== 0 && !three) cands.push({ value: round(s2 / s1, 4), why: 'That divides the slopes. Each link multiplies the nudge it receives, so the slopes multiply.' });
      const mid = round(s3 * s2, 4);
      const work = three
        ? [
            `Walk back from $z$, multiplying the local slopes: $${D('z', '\\symx')} = ${D('z', 'v')} \\cdot ${D('v', 'u')} \\cdot ${D('u', '\\symx')}$.`,
            `Start at the end: $${D('z', 'v')} = ${num(s3)}$.`,
            `Times $${D('v', 'u')}$: $${num(s3)} \\times ${paren(num(s2))} = ${num(mid)}$, which is $${D('z', 'u')}$.`,
            `Times $${D('u', '\\symx')}$: $${num(mid)} \\times ${paren(num(s1))} = ${num(v)}$, which is $${D('z', '\\symx')}$.`,
          ]
        : [
            `Multiply the local slopes along the chain: $${D('z', '\\symx')} = ${D('z', 'u')} \\cdot ${D('u', '\\symx')}$.`,
            `$= ${num(s2)} \\times ${paren(num(s1))} = ${num(v)}$.`,
          ];
      return {
        prompt: `$\\symx$ feeds $${names[0]}$${three ? ', $u$ feeds $v$,' : ','} and $${names[names.length - 2]}$ feeds $z$. At the current point, ${shown.map(([n, s]) => `$${n} = ${num(s)}$`).join(three ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1')}. What is $${D('z', '\\symx')}$?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, cands),
        solution: [
          ...work,
          `A nudge of $0.01$ in $\\symx$ moves $z$ by about $${num(round(v * 0.01, 6))}$: ${num(v)} times as much.`,
        ],
      };
    },
  },
  {
    id: 'steps',
    make(rng, d) {
      const a = int(rng, 2, 4);
      const x = int(rng, d < 0.5 ? 1 : -1, 3);
      const outer = pick(rng, d < 0.5 ? ['sq', 'cube'] : ['sq', 'cube', 'ln']);
      const u = outer === 'ln' ? pick(rng, [2, 4, 5]) : outer === 'cube' ? int(rng, -3, 3) : int(rng, -4, 6);
      const b = u - a * x;
      const ins = inner(a, b);
      const [zTex, dzTex, dzv] = outer === 'sq'
        ? [`(${ins.tex})^{2}`, '2u', 2 * u]
        : outer === 'cube'
          ? [`(${ins.tex})^{3}`, '3u^{2}', 3 * u * u]
          : [`\\ln(${ins.tex})`, '\\tfrac{1}{u}', round(1 / u, 4)];
      const v = round(dzv * a, 4);
      return {
        prompt: `Put the steps in order to find the slope of $z = ${zTex}$ at $\\symx = ${x}$.`,
        answer: {
          kind: 'order',
          items: [
            `Name the inside: $u = ${ins.tex}$`,
            `Evaluate the inside at $\\symx = ${x}$: $u = ${u}$`,
            `Take the outside's slope at that $u$: $${D('z', 'u')} = ${dzTex} = ${num(dzv)}$`,
            `Multiply by the inside's slope $${D('u', '\\symx')} = ${a}$: $${D('z', '\\symx')} = ${num(v)}$`,
          ],
        },
        solution: [
          `The outside's slope depends on where it is taken, and it is taken at the inside's value, so $u$ has to be named and evaluated first.`,
          `With $u = ${u}$, the outside's slope is $${dzTex} = ${num(dzv)}$.`,
          `The chain rule multiplies the local slopes last: $${num(dzv)} \\times ${a} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'which',
    make(rng, d) {
      if (rng.int(2) === 0) {
        const x = int(rng, 0, 4);
        let u = int(rng, -3, 9);
        if (u === x) u += 2;
        return {
          prompt: `$z$ is a function of $u$, and $u$ is a function of $\\symx$. At $\\symx = ${x}$, $u(${x}) = ${u}$. Which product is $${D('z', '\\symx')}$ at $\\symx = ${x}$?`,
          answer: {
            kind: 'choice',
            options: [`$z'(${u}) \\cdot u'(${x})$`, `$z'(${x}) \\cdot u'(${x})$`, `$z'(${u}) + u'(${x})$`, `$z(${u}) \\cdot u'(${x})$`],
            correct: 0,
            why: [
              null,
              `That takes the outside's slope at $${x}$, the value of $\\symx$. The outside sees $u$, so its slope is taken at $u = ${u}$.`,
              'That adds the local slopes. A nudge is scaled by each link in turn, so they multiply.',
              `$z(${u})$ is the outside's value, not its slope. The chain multiplies slopes.`,
            ],
          },
          solution: [
            `The inside's slope is taken where the inside sits, at $\\symx = ${x}$: $u'(${x})$.`,
            `The outside receives $u = ${u}$, so its slope is taken there: $z'(${u})$.`,
            `The chain rule multiplies them: $z'(${u}) \\cdot u'(${x})$.`,
          ],
        };
      }
      const s1 = pick(rng, d < 0.5 ? [2, 3, 4, 5] : [2, 3, 4, -2, -3]);
      const s2 = pick(rng, [2, 3, 4, 5, 6].filter((v) => v !== s1));
      const dx = 0.01;
      const opts = [s1 * s2, s1 + s2, s2, s1].map((v) => round(v * dx, 4));
      return {
        prompt: `$\\symx$ feeds $u$, and $u$ feeds $z$, with local slopes $${D('u', '\\symx')} = ${s1}$ and $${D('z', 'u')} = ${s2}$. If $\\symx$ goes up by $0.01$, about how much does $z$ change?`,
        answer: {
          kind: 'choice',
          options: opts.map((v) => `About $${num(v, 2)}$`),
          correct: 0,
          why: [
            null,
            'That adds the slopes. Each link multiplies the nudge it receives, so the slopes multiply.',
            `That uses only the outside's slope. The inside first turns the $0.01$ into $${num(round(s1 * dx, 4))}$.`,
            `That is how much $u$ changes. $z$ then changes $${s2}$ times as much again.`,
          ],
        },
        solution: [
          `$u$ changes by $${s1} \\times 0.01 = ${num(round(s1 * dx, 4))}$.`,
          `$z$ changes by $${s2}$ times that: $${num(round(s1 * s2 * dx, 4))}$, which is $${D('z', '\\symx')} = ${s1 * s2}$ times the nudge.`,
        ],
      };
    },
  },
];
