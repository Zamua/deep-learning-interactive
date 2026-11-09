import { bank } from '../../../bank';
import { int, pick, type Rng } from '../../../../core/rand';
import type { Generator } from '../../../../mastery/domain/types';

const NAMES = ['base', 'step', 'size', 'total', 'extra', 'count', 'width', 'depth', 'limit', 'offset'];

type Option = [text: string, why: string | null];
interface Case {
  prompt: string;
  code: string;
  options: Option[];
  solution: string[];
}

const BOOM = '`error: boom`';
const LOOP = '`error: infinite recursion encountered`';

/** One short program, what it evaluates to, and what the wrong answers would mean. */
function lazyCase(rng: Rng): Case {
  const [a, b] = rng.shuffle([...NAMES]) as [string, string];
  const [n, m, p] = rng.shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) as [number, number, number];
  const v = (x: number) => `\`${x}\``;
  const cases: (() => Case)[] = [
    () => ({
      prompt: `This \`let\` ends in \`${b}\`. What does it evaluate to?`,
      code: `let ${a} = throw "boom"; ${b} = ${n}; in ${b}`,
      options: [
        [v(n), null],
        [BOOM, `Nothing asks for \`${a}\`, so its \`throw\` never runs.`],
        ['`null`', `\`${b}\` is bound to a number, and that is what comes back.`],
      ],
      solution: [`The body needs only \`${b}\`.`, `\`${a}\` is never asked for, so its \`throw\` never runs.`],
    }),
    () => ({
      prompt: `This \`let\` ends in \`${a} + ${b}\`. What does it evaluate to?`,
      code: `let ${a} = throw "boom"; ${b} = ${n}; in ${a} + ${b}`,
      options: [
        [BOOM, null],
        [v(n), `\`+\` needs both of its sides, so \`${a}\` has to be worked out.`],
        [LOOP, 'Nothing here depends on itself. It is the `throw` that stops evaluation.'],
      ],
      solution: [`To add, Nix needs the value of \`${a}\`.`, 'Working it out runs the `throw`.'],
    }),
    () => ({
      prompt: `What does selecting \`${b}\` from this set give?`,
      code: `{ ${a} = throw "boom"; ${b} = ${n}; }.${b}`,
      options: [
        [v(n), null],
        [BOOM, 'A `throw` in another value does nothing until that value is needed.'],
        [`\`{ ${b} = ${n}; }\``, 'Selection gives the value alone.'],
      ],
      solution: [`Selecting \`${b}\` works out only \`${b}\`.`, `\`${a}\` stays unevaluated.`],
    }),
    () => ({
      prompt: `What does selecting \`${a}\` from this set give?`,
      code: `{ ${a} = throw "boom"; ${b} = ${n}; }.${a}`,
      options: [
        [BOOM, null],
        [v(n), `That is the value of \`${b}\`. Here you asked for \`${a}\`.`],
        ['`null`', 'A `throw` has no value. When it runs, evaluation stops.'],
      ],
      solution: [`Selecting \`${a}\` needs its value.`, 'That is when the `throw` runs.'],
    }),
    () => {
      const sorted = [a, b].sort();
      return {
        prompt: `One value in this set is a \`throw\`, under \`${a}\`. What does \`builtins.attrNames\` return?`,
        code: `builtins.attrNames { ${a} = throw "boom"; ${b} = ${n}; }`,
        options: [
          [`\`[ "${sorted[0]!}" "${sorted[1]!}" ]\``, null],
          [BOOM, '`attrNames` reads only the names, so the values are never worked out.'],
          [`\`[ "${b}" ]\``, `\`${a}\` is still a name in the set, whatever its value would be.`],
        ],
        solution: ['`builtins.attrNames` reads the names and leaves the values alone.', 'The `throw` never runs.'],
      };
    },
    () => {
      const length = int(rng, 2, 5);
      const at = rng.int(length);
      const items = Array.from({ length }, (_, i) => (i === at ? '(throw "boom")' : String(i + 1)));
      return {
        prompt: `Element ${at} of a list of ${length} elements, counting from 0, is a \`throw\`. What does \`builtins.length\` return?`,
        code: `builtins.length [ ${items.join(' ')} ]`,
        options: [
          [v(length), null],
          [BOOM, 'The length does not depend on what the elements are, so none is worked out.'],
          [v(length - 1), 'The `throw` is still an element. It counts.'],
        ],
        solution: ['A list knows how many elements it has.', 'None of them is evaluated to count them.'],
      };
    },
    () => ({
      prompt: `This \`let\` ends in \`${m}\`, and \`${a}\` depends on itself. What does it evaluate to?`,
      code: `let ${a} = ${a} + 1; in ${m}`,
      options: [
        [v(m), null],
        [LOOP, `Nothing asks for \`${a}\`, so its loop never starts.`],
        [v(m + 1), `The body is \`${m}\` alone, and \`${a}\` plays no part.`],
      ],
      solution: [`The body is ${m}, and it does not mention \`${a}\`.`, 'A definition that is never needed is never worked out.'],
    }),
    () => ({
      prompt: `This \`let\` ends in \`${a}\`, and \`${a} = ${b} + ${p}\`. What does it evaluate to?`,
      code: `let ${a} = ${b} + ${p}; ${b} = ${a} + ${p}; in ${a}`,
      options: [
        [LOOP, null],
        [v(2 * p), `A name with no value yet does not count as zero. \`${a}\` needs \`${b}\`, and \`${b}\` needs \`${a}\`.`],
        [BOOM, 'There is no `throw` here.'],
      ],
      solution: [`\`${a}\` needs \`${b}\`, and \`${b}\` needs \`${a}\`.`, 'Each value truly needs itself, so Nix stops.'],
    }),
    () => ({
      prompt: `The body of this function is \`${n}\`, and it never reads \`x\`. What does this call return?`,
      code: `(x: ${n}) (throw "boom")`,
      options: [
        [v(n), null],
        [BOOM, 'An argument is not worked out until the body needs it, and this body never does.'],
        ['A function waiting for `x`', '`x` was given. The call is complete.'],
      ],
      solution: ['An argument waits, as a binding does.', 'The body never reads `x`, so the `throw` never runs.'],
    }),
  ];
  return pick(rng, cases)();
}

export const generators: Generator[] = [
  {
    id: 'lazy-result',
    make(rng) {
      const { prompt, code, options, solution } = lazyCase(rng);
      const order = rng.shuffle([...options]);
      return {
        prompt,
        code,
        lang: 'nix',
        answer: {
          kind: 'choice',
          options: order.map(([text]) => text),
          correct: order.findIndex(([, why]) => why === null),
          why: order.map(([, why]) => why),
        },
        solution,
      };
    },
  },
  {
    id: 'forced-count',
    make(rng, d) {
      const n = d < 0.5 ? 5 : 7;
      for (;;) {
        const names = rng.shuffle([...NAMES]).slice(0, n);
        // A name only uses later ones, so the bindings can never loop.
        const uses = new Map(names.map((name, i) => {
          const later = names.slice(i + 1);
          const count = later.length ? Math.min(later.length, int(rng, i === 0 ? 1 : 0, 2)) : 0;
          return [name, rng.shuffle([...later]).slice(0, count)] as const;
        }));
        const target = names[0]!;
        const seen = new Set([target]);
        for (const name of seen) for (const u of uses.get(name)!) seen.add(u);
        if (seen.size < 2 || seen.size === n) continue;
        const direct = uses.get(target)!.length;
        const body = (name: string) => {
          const used = uses.get(name)!;
          if (used.length) return used.join(' + ');
          return !seen.has(name) && rng.int(2) === 0 ? 'throw "boom"' : String(int(rng, 1, 9));
        };
        const lines = rng.shuffle(names.map((name) => `  ${name} = ${body(name)};`));
        const traps = [
          { value: n, why: 'That counts every binding. Nix works out only what the result needs.' },
          { value: seen.size - 1, why: `\`${target}\` itself is worked out too.` },
          { value: direct + 1, why: 'A binding that is needed needs its own dependencies, so keep following them.' },
        ];
        return {
          prompt: `This \`let\` ends in \`${target}\`. How many of its bindings does Nix evaluate, counting \`${target}\` itself?`,
          code: `let\n${lines.join('\n')}\nin ${target}`,
          lang: 'nix',
          answer: { kind: 'number', value: seen.size },
          traps: traps.filter((t, i) => t.value !== seen.size && traps.findIndex((o) => o.value === t.value) === i),
          solution: [
            `Start at \`${target}\` and follow the names each needed binding uses.`,
            `That reaches ${[...seen].map((x) => `\`${x}\``).join(', ')}.`,
            `So ${seen.size} of the ${n} bindings are evaluated, and the others never run.`,
          ],
        };
      }
    },
  },
  bank('facts', [
    {
      q: 'What does `let x = throw "boom"; in 1` evaluate to?',
      options: ['`1`', '`error: boom`', '`null`', '`throw`'],
      why: ['A binding is not worked out until something needs it, and nothing needs `x`.', 'The body is `1`, and that is the result.', '`throw` is a function here, and it is never called.'],
      solution: ['The body is `1`.', '`x` is never needed, so its `throw` never runs.'],
    },
    {
      q: 'When does a `throw` inside a set stop evaluation?',
      options: ['When that value is needed', 'When the set is written', 'When any attribute of the set is selected', 'When `builtins.attrNames` is called on the set'],
      why: ['Writing a set only records how to compute each value.', 'Selecting another attribute leaves it alone.', '`attrNames` reads only the names.'],
      solution: ['Values in a set wait, as bindings do.', 'A `throw` fires only when something needs that value.'],
    },
    {
      q: 'Why can the bindings of a `let` be written in any order?',
      options: ['They are definitions, worked out only when needed', 'Nix sorts them by name first', 'Nix runs them top to bottom, twice', 'Only numbers can be reordered'],
      why: ['No sorting happens, and the order written does not matter.', 'Nothing runs top to bottom: a binding is computed on demand.', 'Any value works the same way.'],
      solution: ['A binding says how to compute a value.', 'Nix computes it when something asks, by which time every name in the `let` exists.'],
    },
    {
      q: 'What does `let x = x + 1; in x` do?',
      options: ['Stops with `infinite recursion encountered`', 'Evaluates to `1`', 'Evaluates to `0`', 'Never finishes'],
      why: ['`x` has no starting value, and a name does not count as zero.', 'Nothing makes `x` zero.', 'Nix notices that the value needs itself, and it stops with an error.'],
      solution: ['To get `x`, Nix has to get `x` first.', 'It detects that and stops with an error.'],
    },
    {
      q: 'What does `let x = x + 1; in 5` evaluate to?',
      options: ['`5`', '`error: infinite recursion encountered`', '`6`', '`1`'],
      why: ['The loop exists only if something asks for `x`, and the body does not.', 'The body is `5`, and `x` plays no part.', 'The body is `5`, and `x` is never worked out.'],
      solution: ['The body does not mention `x`.', 'A definition nothing needs is never worked out.'],
    },
    {
      q: 'What does `let a = { y = 1; z = a.y + 1; }; in a.z` evaluate to?',
      options: ['`2`', '`error: infinite recursion encountered`', '`error: undefined variable \'a\'`', '`1`'],
      why: ['`z` needs `y`, and `y` does not need `z`. No value needs itself.', 'The name `a` is in scope in its own definition.', 'That is `y`. The body selects `z`.'],
      solution: ['`z` reads `a.y`, which is 1.', 'So `z` is 2. Mentioning its own set is fine, since `y` does not depend on `z`.'],
    },
    {
      q: 'What is a thunk?',
      options: ['A record of how to compute a value, kept until the value is needed', 'A value that has been cached on disk', 'A function with no arguments, written by the user', 'A kind of error thrown by `throw`'],
      why: ['A thunk lives in memory for one evaluation, and it has nothing to do with disk.', 'Nix creates thunks itself, for every binding.', 'A `throw` is the expression inside. The thunk just delays it.'],
      solution: ['A binding holds how to compute its value.', 'That promise is a thunk, and it runs only if something needs the value.'],
    },
    {
      q: 'You ask a huge package set for one package. What does Nix evaluate?',
      options: ['That package and what it needs', 'Every package in the set', 'Only the name of the package', 'Every package whose name comes before it'],
      why: ['Each package is a value that waits until something needs it.', 'To give you the package, Nix has to work out what it needs as well.', 'Order plays no part. Nix follows what is needed.'],
      solution: ['Each package in the set is a value that waits.', 'Asking for one forces that one and whatever it depends on.'],
    },
    {
      q: 'What does `rec { a = b; b = a; }.a` do?',
      options: ['Stops with `infinite recursion encountered`', 'Evaluates to `null`', 'Evaluates to `{ a = b; b = a; }`', 'Stops with `undefined variable`'],
      why: ['Neither name has a value to give, and there is no default of `null`.', 'Selecting `a` asks for its value, not its definition.', '`rec` makes both names visible.'],
      solution: ['`a` needs `b`, and `b` needs `a`.', 'So the value truly needs itself.'],
    },
    {
      q: 'What does `builtins.length [ 1 (throw "boom") 3 ]` evaluate to?',
      options: ['`3`', '`error: boom`', '`2`', '`4`'],
      why: ['The elements are not worked out to count them.', 'The `throw` is still an element.', 'The parentheses make `(throw "boom")` one element.'],
      solution: ['A list knows how many elements it has.', 'Counting them does not evaluate any of them.'],
    },
  ], 'nix'),
];
