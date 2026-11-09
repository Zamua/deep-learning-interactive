import { bank } from '../../../bank';
import { int, type Rng } from '../../../../core/rand';
import type { Generator, Problem } from '../../../../mastery/domain/types';

const KEYS = ['port', 'jobs', 'level', 'depth', 'limit', 'retries', 'workers', 'timeout', 'size', 'count'];
const NESTS = ['meta', 'env', 'args', 'opts', 'deps', 'conf', 'vars', 'flags', 'attrs', 'hooks'];
const INNER = ['a', 'b', 'c', 'd', 'e', 'f'];

type Pair = [string, number];

const setOf = (pairs: Pair[]) => `{ ${pairs.map(([k, v]) => `${k} = ${v};`).join(' ')} }`;
const numbers = (rng: Rng) => rng.shuffle(Array.from({ length: 40 }, (_, i) => i + 1));

/** A chain of `//` where one name may appear on several sides. */
function flatMerge(rng: Rng, d: number): Problem {
  const count = d < 0.5 ? 2 : 3;
  const [target, ...others] = rng.shuffle([...KEYS]) as [string, ...string[]];
  const values = numbers(rng);
  const holders = [0, ...Array.from({ length: count - 1 }, (_, i) => i + 1).filter(() => rng.int(4) > 0)];
  let next = 0;
  const sets = Array.from({ length: count }, (_, i) => {
    const pairs = rng.shuffle([...others]).slice(0, int(rng, 1, 2)).map((k): Pair => [k, values[next++]!]);
    if (holders.includes(i)) pairs.splice(int(rng, 0, pairs.length), 0, [target, values[next++]!]);
    return pairs;
  });
  const held = holders.map((i) => sets[i]!.find(([k]) => k === target)![1]);
  const answer = held[held.length - 1]!;
  return {
    prompt: `What is the value of \`${target}\` in the result?`,
    code: sets.map(setOf).join('\n// '),
    lang: 'nix',
    answer: { kind: 'number', value: answer },
    traps: held.slice(0, -1).map((value) => ({ value, why: `\`${target}\` is ${value} in an earlier set, but a set further right replaces it.` })),
    solution: [
      `\`//\` lays each set over the ones to its left, so the rightmost \`${target}\` wins.`,
      held.length > 1 ? `\`${target}\` last appears with the value ${answer}.` : `\`${target}\` appears in only one set, so it comes through unchanged as ${answer}.`,
    ],
  };
}

/** A `//` where the question is whether the inner sets combine. */
function nestedMerge(rng: Rng): Problem {
  const nest = NESTS[rng.int(NESTS.length)]!;
  const names = rng.shuffle([...INNER]);
  const values = numbers(rng);
  const leftCount = int(rng, 2, 4);
  const rightCount = int(rng, 1, 2);
  const keys = rng.shuffle([...KEYS]);
  const filler = (i: number) => `${keys[i]!} = ${values[20 + i]!};`;
  const inner = (from: number, n: number) => setOf(names.slice(from, from + n).map((k, i): Pair => [k, values[from + i]!]));
  const hasRight = rng.int(4) > 0;
  const answer = hasRight ? rightCount : leftCount;
  const left = `{ ${nest} = ${inner(0, leftCount)}; ${filler(0)} }`;
  const right = hasRight ? `{ ${nest} = ${inner(leftCount - 1, rightCount)}; }` : `{ ${filler(1)} }`;
  const union = leftCount + rightCount - 1;
  const traps = hasRight
    ? [
        { value: union, why: 'That combines the two inner sets. `//` merges only the top level, so the right side replaces the inner set whole.' },
        { value: leftCount, why: `The right side has \`${nest}\` too, and the right side wins.` },
      ]
    : [{ value: 0, why: `The right side has no \`${nest}\`, so the left side's comes through unchanged.` }];
  return {
    prompt: `How many names does \`${nest}\` have in the result?`,
    code: `${left}\n// ${right}`,
    lang: 'nix',
    answer: { kind: 'number', value: answer },
    traps: traps.filter((t, i) => t.value !== answer && traps.findIndex((o) => o.value === t.value) === i),
    solution: hasRight
      ? [`\`${nest}\` is one top-level name, and it is on both sides.`, `The right side's value replaces the left side's whole, so the result has its ${answer}.`]
      : [`Only the left side has \`${nest}\`.`, `A name on one side comes through unchanged, with its ${answer} names.`],
  };
}

type Option = [text: string, why: string | null];

export const generators: Generator[] = [
  {
    id: 'merge',
    make(rng, d) {
      return d >= 0.5 && rng.int(2) === 0 ? nestedMerge(rng) : flatMerge(rng, d);
    },
  },
  {
    id: 'select',
    make(rng, d) {
      const [k, other, gone, inner, innerGone] = rng.shuffle([...KEYS]) as [string, string, string, string, string];
      const [topValue, otherValue, innerValue, fallback] = numbers(rng) as [number, number, number, number];
      const deep = d >= 0.5 && rng.int(2) === 0;
      const path = deep ? `meta.${inner}` : k;
      const value = deep ? innerValue : topValue;
      const missing = deep ? `meta.${innerGone}` : gone;
      const leaf = deep ? innerGone : gone;
      const code = `{ ${k} = ${topValue}; ${other} = ${otherValue}; meta = { ${inner} = ${innerValue}; }; }`;
      const val = `\`${value}\``;
      const def = `\`${fallback}\``;
      const err = `\`error: attribute '${leaf}' missing\``;
      const errHit = `\`error: attribute '${deep ? inner : k}' missing\``;
      const cases: { expr: string; options: Option[]; solution: string[] }[] = [
        {
          expr: `s.${path}`,
          options: [
            [val, null],
            ['`true`', 'A dot gives back the value. It is `?` that answers true or false.'],
            [errHit, 'That name is in the set, so selection finds it.'],
          ],
          solution: [`\`${path}\` is in the set, so selection returns its value, ${value}.`],
        },
        {
          expr: `s.${missing}`,
          options: [
            [err, null],
            ['`null`', 'A missing name is not `null`. Selecting it stops evaluation.'],
            ['`false`', 'It is `?` that answers false. A dot on a missing name is an error.'],
          ],
          solution: [`\`${leaf}\` is not there, and nothing gives a fallback.`, 'So selection stops with an error.'],
        },
        {
          expr: `s.${path} or ${fallback}`,
          options: [
            [val, null],
            [def, `\`or\` is used only when the name is missing, and \`${path}\` is there.`],
            ['`true`', '`or` does not ask a question. It gives the value or the fallback.'],
          ],
          solution: [`\`${path}\` is in the set, so its value is used.`, 'The fallback after `or` is ignored.'],
        },
        {
          expr: `s.${missing} or ${fallback}`,
          options: [
            [def, null],
            [err, '`or` catches the missing name, so there is no error.'],
            ['`false`', '`or` does not answer yes or no. It gives the fallback.'],
          ],
          solution: [`\`${leaf}\` is missing, so \`or\` supplies what comes after it: ${fallback}.`],
        },
        {
          expr: `s ? ${path}`,
          options: [
            ['`true`', null],
            [val, '`?` only asks whether the name is there. It does not give the value.'],
            ['`false`', `\`${path}\` is in the set.`],
          ],
          solution: [`\`${path}\` is in the set, so \`?\` answers true.`],
        },
        {
          expr: `s ? ${missing}`,
          options: [
            ['`false`', null],
            [err, '`?` never fails on a missing name. It answers false.'],
            ['`null`', '`?` always answers true or false.'],
          ],
          solution: [`\`${leaf}\` is not there, so \`?\` answers false, with no error.`],
        },
      ];
      const { expr, options, solution } = cases[rng.int(cases.length)]!;
      const order = rng.shuffle([...options]);
      return {
        prompt: `Call this set \`s\`. What does \`${expr}\` evaluate to?`,
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
  bank('facts', [
    {
      q: 'Why does Nix describe packages in a language, and not in a data file with fixed fields?',
      options: ['A package\'s facts are connected, so one value often has to be worked out from another', 'A language makes the built programs run faster', 'A data file could not hold names and versions', 'Packages are written in the Nix language'],
      why: ['The language describes a build. It has no effect on the speed of what is built.', 'Names and versions are easy to store. The trouble is the connections between them.', 'The programs are written in C, Python and so on. Nix only describes how to build them.'],
      solution: ['A file name repeats a version, and one package needs another.', 'Fixed text cannot express that, so the facts are computed by a small language.'],
    },
    {
      q: 'Which of these is a valid attribute set?',
      options: ['`{ a = 1; b = 2; }`', '`{ a = 1; b = 2 }`', '`{ a = 1, b = 2 }`', '`{ a: 1; b: 2; }`'],
      why: ['A semicolon ends every binding, the last one too.', 'Bindings end with semicolons, and a comma here is a syntax error.', 'A binding is written with `=`.'],
      solution: ['Each binding is a name, `=`, a value and a semicolon.', 'That includes the last one.'],
    },
    {
      q: 'What is `{ a.b = 1; a.c = 2; }` when written out in full?',
      options: ['`{ a = { b = 1; c = 2; }; }`', '`{ a = { c = 2; }; }`', '`{ "a.b" = 1; "a.c" = 2; }`', 'A syntax error, because `a` is written twice'],
      why: ['Both dotted names go into one inner set, so neither is lost.', 'A dot on the left means nesting. It is not part of a longer name.', 'Dotted names with the same start are gathered into one set.'],
      solution: ['A dotted name on the left is shorthand for nesting.', 'Both bindings land in the same inner set `a`.'],
    },
    {
      q: 'What does `{ a.b = 1; } // { a.c = 2; }` evaluate to?',
      options: ['`{ a = { c = 2; }; }`', '`{ a = { b = 1; c = 2; }; }`', '`{ a = { b = 1; }; }`', 'An error, because `a` is on both sides'],
      why: ['`//` merges only the top level, and it does not look inside `a`.', 'A name on both sides takes the right side\'s value.', 'A name on both sides is the normal case for `//`.'],
      solution: ['At the top level, each side has one name: `a`.', 'The right side\'s `a` replaces the left side\'s whole.'],
    },
    {
      q: 'In `x // y`, a name is on both sides. Which value ends up in the result?',
      options: ['The one from `y`', 'The one from `x`', 'Both of them, in a list', 'Neither: Nix stops with an error'],
      why: ['`//` lays the right set over the left, so the left value is covered.', 'A name holds one value, and `//` does not collect them.', 'A shared name is what `//` is for, and it is not an error.'],
      solution: ['`//` starts from the left set and lays the right one over it.', 'So for a shared name, the right side wins.'],
    },
    {
      q: 'Why does `{ x = 1; y = x + 1; }` fail with an undefined variable error?',
      options: ['In a plain set, a binding cannot see the others', '`x` has to be written after `y`', '`+` does not work on numbers', '`y` needs a fallback with `or`'],
      why: ['Order is not the issue. In a plain set, `x` is not visible from anywhere.', 'Adding numbers is fine. It is the name `x` that is not defined.', '`or` is for selecting a missing attribute. It does not make `x` visible.'],
      solution: ['The names of a plain set are not in scope inside it.', 'Writing `rec` in front makes every binding visible to the others.'],
    },
    {
      q: 'What does `rec { name = "hello"; meta = { inherit name; }; }.meta.name` evaluate to?',
      options: ['`"hello"`', '`"name"`', '`{ name = "hello"; }`', '`error: undefined variable \'name\'`'],
      why: ['`inherit name;` takes the value of `name`, not the word.', 'The last dot selects `name` out of `meta`, which gives its value.', '`rec` makes `name` visible to every binding, including the inner set.'],
      solution: ['`inherit name;` inside `meta` means `name = name;`, with the value taken from around it.', 'So `meta.name` is `"hello"`.'],
    },
    {
      q: 'What does `builtins.attrNames { zip = 1; curl = 2; bash = 3; }` evaluate to?',
      options: ['`[ "bash" "curl" "zip" ]`', '`[ "zip" "curl" "bash" ]`', '`[ 1 2 3 ]`', '`[ 3 2 1 ]`'],
      why: ['A set has no order of its own, so the order you wrote is not kept.', '`attrNames` gives the names and leaves the values alone.', 'Those are values, and `attrNames` gives names.'],
      solution: ['`builtins.attrNames` returns the names.', 'They come back sorted, whatever order they were written in.'],
    },
    {
      q: 'What does the line `inherit version;` do inside a set?',
      options: ['It binds `version` to the value `version` has around the set', 'It binds `version` to the string `"version"`', 'It makes `version` visible to the other bindings', 'It removes `version` from the set'],
      why: ['It takes the value of that name, not the word.', 'Visibility between bindings is what `rec` is for.', 'It adds a binding. Nothing is removed.'],
      solution: ['`inherit version;` is short for `version = version;`.', 'The value on the right comes from the scope around the set.'],
    },
    {
      q: 'What does the `?` operator do when the name is not in the set?',
      options: ['It answers `false`', 'It stops with `attribute missing`', 'It answers `null`', 'It adds the name to the set'],
      why: ['Only selection with `.` can fail on a missing name.', '`?` always answers true or false.', 'Nothing changes a set: every operation gives a new value.'],
      solution: ['`?` asks whether a name is in a set.', 'If it is not, the answer is `false`.'],
    },
  ], 'nix'),
];
