import { bank } from '../../../bank';
import { int, pick, type Rng } from '../../../../core/rand';
import type { Generator, Problem } from '../../../../mastery/domain/types';

const NAMES = ['port', 'jobs', 'level', 'depth', 'limit', 'size', 'count', 'width', 'retries', 'offset'];

type Option = [text: string, why: string | null];

/** Three different numbers from 2 to 9. */
function three(rng: Rng): [number, number, number] {
  return rng.shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3) as [number, number, number];
}

type Case = (rng: Rng) => Problem;

const number = (expr: string, value: number, traps: { value: number; why: string }[], solution: string[]): Problem => ({
  prompt: `What does \`${expr}\` evaluate to?`,
  answer: { kind: 'number', value },
  traps: traps.filter((t, i) => t.value !== value && traps.findIndex((o) => o.value === t.value) === i),
  solution,
});

const add: Case = (rng) => {
  const [m, n] = three(rng);
  return number(`(x: x + ${n}) ${m}`, m + n, [{ value: m, why: `${m} is the argument, and the body still adds ${n} to it.` }], [`\`x\` is bound to ${m}.`, `The body gives ${m} + ${n} = ${m + n}.`]);
};

const subtract: Case = (rng) => {
  const [m, n] = three(rng);
  return number(`(a: b: a - b) ${m} ${n}`, m - n, [{ value: n - m, why: 'The first argument goes to `a`, the first name, and the second to `b`.' }], [`The first call binds \`a\` to ${m}, and what comes back takes \`b\`, which is ${n}.`, `So the body is ${m} - ${n} = ${m - n}.`]);
};

const twice: Case = (rng) => {
  const [m, n] = three(rng);
  return number(`(f: f (f ${m})) (x: x + ${n})`, m + 2 * n, [{ value: m + n, why: `\`f\` is applied twice, so ${n} is added twice.` }], [`\`f\` is the function that adds ${n}, and a function is a value like any other.`, `\`f ${m}\` is ${m + n}, and \`f\` of that is ${m + 2 * n}.`]);
};

const tighter: Case = (rng) => {
  const [m, n, k] = three(rng);
  return number(`(x: x * ${k}) ${m} + ${n}`, k * m + n, [{ value: (m + n) * k, why: `Applying a function binds tighter than \`+\`, so the argument is ${m} alone.` }], [`Application comes first: the function is applied to ${m}, giving ${k * m}.`, `Then ${k * m} + ${n} = ${k * m + n}.`]);
};

const defaulted: Case = (rng) => {
  const [m, k] = three(rng);
  return number(`({ a, b ? ${k} }: a * b) { a = ${m}; }`, m * k, [{ value: m, why: `\`b\` was left out, so it takes its default, ${k}.` }], [`The call leaves out \`b\`, so it takes its default, ${k}.`, `The body gives \`${m} * ${k}\` = ${m * k}.`]);
};

const overridden: Case = (rng) => {
  const [m, k, j] = three(rng);
  return number(`({ a, b ? ${k} }: a * b) { a = ${m}; b = ${j}; }`, m * j, [{ value: m * k, why: `The default is used only when \`b\` is left out, and here it was passed as ${j}.` }], [`The call passes \`b\`, so the default ${k} is not used.`, `The body gives \`${m} * ${j}\` = ${m * j}.`]);
};

const mapped: Case = (rng) => {
  const list = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 3);
  const k = int(rng, 2, 5);
  const partial = rng.int(2) === 0;
  const fn = partial ? `((a: b: a + b) ${k})` : `(x: x * ${k})`;
  const value = list.map((v) => (partial ? v + k : v * k));
  return {
    prompt: `What does \`map ${fn} [ ${list.join(' ')} ]\` evaluate to?`,
    answer: { kind: 'vector', value },
    traps: [{ value: list, why: '`map` returns the results of applying the function, and that is a new list.' }],
    solution: [partial ? `Giving \`${k}\` to \`a\` leaves a function that adds ${k}.` : `The function multiplies by ${k}.`, `\`map\` applies it to each element: [${value.join(', ')}].`],
  };
};

export const generators: Generator[] = [
  {
    id: 'apply',
    make(rng, d) {
      return pick(rng, d < 0.5 ? [add, subtract, mapped, defaulted] : [subtract, twice, tighter, defaulted, overridden, mapped])(rng);
    },
  },
  {
    id: 'call',
    make(rng) {
      const [req, opt, extra] = rng.shuffle([...NAMES]) as [string, string, string];
      const [r, o, x] = rng.shuffle([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) as [number, number, number];
      const def = int(rng, 1, 2);
      const lacks = `An error: required argument \`${req}\` is missing`;
      const excess = `An error: unexpected argument \`${extra}\``;
      const waits = `A function waiting for \`${req}\``;
      const n = (v: number) => `\`${v}\``;
      const given = `{ ${req} = ${r}; ${opt} = ${o}; }`;
      const short = `{ ${req} = ${r}; }`;
      const orphan = `{ ${opt} = ${o}; }`;
      const over = `{ ${req} = ${r}; ${extra} = ${x}; }`;
      const cases: { dots: boolean; arg: string; options: Option[]; solution: string[] }[] = [
        {
          dots: false,
          arg: given,
          options: [
            [n(r + o), null],
            [n(r + def), `The default is used only when \`${opt}\` is left out, and here it was passed.`],
            [`An error: unexpected argument \`${opt}\``, `\`${opt}\` is in the pattern, so it is expected.`],
          ],
          solution: [`Both names are passed, so the default for \`${opt}\` is not used.`, `The body gives ${r} + ${o} = ${r + o}.`],
        },
        {
          dots: false,
          arg: short,
          options: [
            [n(r + def), null],
            [`An error: required argument \`${opt}\` is missing`, `\`${opt}\` has a default, so the caller can leave it out.`],
            [n(r), `A name left out does not become zero. \`${opt}\` takes its default, ${def}.`],
          ],
          solution: [`\`${opt}\` is left out, so it takes its default, ${def}.`, `The body gives ${r} + ${def} = ${r + def}.`],
        },
        {
          dots: false,
          arg: orphan,
          options: [
            [lacks, null],
            [n(o), `\`${req}\` has no default, and a missing name does not become zero.`],
            [waits, 'A set pattern takes the whole set as its one argument. Nix does not wait for more.'],
          ],
          solution: [`\`${req}\` is in the pattern with no default.`, 'The call leaves it out, so the call fails.'],
        },
        {
          dots: false,
          arg: over,
          options: [
            [excess, null],
            [n(r + def), `Ignoring extras takes \`...\` in the pattern, and this pattern has none.`],
            [n(r + def + x), `\`${extra}\` is not in the pattern, and the body never adds it.`],
          ],
          solution: [`\`${extra}\` is not in the pattern, and the pattern has no \`...\`.`, 'So the call fails.'],
        },
        {
          dots: true,
          arg: over,
          options: [
            [n(r + def), null],
            [excess, '`...` allows names the pattern does not list.'],
            [n(r + def + x), `\`...\` lets \`${extra}\` through, but the body never uses it.`],
          ],
          solution: [`\`...\` allows the extra name \`${extra}\`, and the body ignores it.`, `\`${opt}\` takes its default, so the body gives ${r} + ${def} = ${r + def}.`],
        },
      ];
      const c = pick(rng, cases);
      const order = rng.shuffle([...c.options]);
      return {
        prompt: `Call this function with \`${c.arg}\`. What happens?`,
        code: `{ ${req}, ${opt} ? ${def}${c.dots ? ', ...' : ''} }: ${req} + ${opt}`,
        lang: 'nix',
        answer: {
          kind: 'choice',
          options: order.map(([text]) => text),
          correct: order.findIndex(([, why]) => why === null),
          why: order.map(([, why]) => why),
        },
        solution: c.solution,
      };
    },
  },
  bank('facts', [
    {
      q: 'How many arguments does a Nix function take?',
      options: ['Exactly one', 'One for each name before a colon, all at once', 'Any number, separated by spaces', 'One or two'],
      why: ['`a: b: a + b` is one function that returns another, and each takes one argument.', 'A space is one application, and writing several means several calls.', 'There is no two-argument form. Two arguments are two functions.'],
      solution: ['A function has exactly one argument.', 'Several arguments are written as a function returning a function, or as one set.'],
    },
    {
      q: 'What kind of value is `(a: b: a + b) 2`?',
      options: ['A function waiting for `b`', 'The number `2`', 'An error, because `b` is missing', 'A function waiting for `a`'],
      why: ['The body has not run, because it still needs `b`.', 'Giving only the first argument is allowed. It is partial application.', '`a` was the first name, so the 2 filled it.'],
      solution: ['The 2 is bound to `a`.', 'What comes back is `b: 2 + b`, a function that still needs its argument.'],
    },
    {
      q: 'How does Nix read `f 1 2`?',
      options: ['`(f 1) 2`', '`f (1 2)`', '`f` called with two arguments at once', '`f` applied to the list `[ 1 2 ]`'],
      why: ['Application groups to the left.', 'A function takes exactly one argument, so this is two calls.', 'A list needs square brackets.'],
      solution: ['Application is a space, and it groups to the left.', 'So `f` gets 1, and what comes back gets 2.'],
    },
    {
      q: 'What does the `?` in the pattern `{ version ? "1.0" }:` do?',
      options: ['It gives `version` a default', 'It tests whether `version` is in the set', 'It makes the function return true or false', 'It allows extra names'],
      why: ['That is `?` between a set and a name, in an ordinary expression. In a pattern it is a default.', 'The body of the function decides what it returns.', 'That is `...`.'],
      solution: ['Inside a set pattern, `? value` gives the name a default.', 'The default is used when the caller leaves that name out.'],
    },
    {
      q: 'What happens with `({ a }: a) { a = 1; b = 2; }`?',
      options: ['An error: unexpected argument `b`', 'It evaluates to `1`', 'It evaluates to `2`', 'It evaluates to `{ a = 1; }`'],
      why: ['Ignoring extras takes `...` in the pattern.', 'The body returns `a`, and there is no reason to pick `b`.', 'The body returns `a`, not a set, and the call fails first.'],
      solution: ['The pattern lists only `a`, with no `...`.', 'Passing `b` is an error.'],
    },
    {
      q: 'What happens with `({ a, b }: a) { a = 1; }`, where the body never uses `b`?',
      options: ['An error: required argument `b` is missing', 'It evaluates to `1`', 'A function waiting for `b`', 'It evaluates to `null`'],
      why: ['The call is checked against the pattern, and whether the body uses `b` makes no difference.', 'The one argument has been given, and Nix does not wait for more.', 'The call fails, so nothing is returned.'],
      solution: ['`b` is in the pattern with no default.', 'The call leaves it out, so the call fails, even though the body never reads it.'],
    },
    {
      q: 'In `args@{ name, ... }: body`, what is `args`?',
      options: ['The whole set that was passed, extras included', 'Only the names listed in the pattern', 'Only the extras', 'A list of the names that were passed'],
      why: ['`args` is the set as passed, so the extras are in it.', 'The listed names are in it too.', '`args` is the set itself, not a list.'],
      solution: ['`args@` binds the name `args` to the whole argument.', 'The pattern still makes `name` a variable, and `args` still has everything.'],
    },
    {
      q: 'What does `(args@{ a ? 1 }: args) { }` evaluate to?',
      options: ['`{ }`', '`{ a = 1; }`', '`1`', 'An error: required argument `a` is missing'],
      why: ['A default fills the variable `a`, not the set `args`.', 'The body returns `args`, the set.', '`a` has a default, so it can be left out.'],
      solution: ['`args` is the set exactly as the caller passed it, and that is empty.', 'The default only gives the variable `a` a value.'],
    },
    {
      q: 'What does `map` do with `(x: x * 2)` and `[ 1 2 3 ]`?',
      options: ['It returns `[ 2 4 6 ]`', 'It returns `[ 1 2 3 ]`', 'It returns `12`', 'It stops with an error, since a function takes one argument'],
      why: ['`map` gives the results, in a new list.', '`map` keeps one element per input and adds nothing up.', '`map` takes the function, and what comes back takes the list: two calls of one argument.'],
      solution: ['`map` applies the function to each element.', 'The result is a new list with the same number of elements.'],
    },
    {
      q: 'Why write a package as a function of its dependencies?',
      options: ['One definition can build against different dependencies without being copied', 'Functions build faster than sets', 'Nix cannot store a package as a set', 'So the package can download its dependencies itself'],
      why: ['A function only says how inputs turn into a build. It does nothing for speed.', 'The result of the function is a set.', 'The arguments are handed in by the caller.'],
      solution: ['The hole in the definition is the list of arguments.', 'Calling it with other dependencies gives another build from the same definition.'],
    },
  ], 'nix'),
];
