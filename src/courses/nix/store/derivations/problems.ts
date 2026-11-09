import { bank } from '../../../bank';
import { int, pick, type Rng } from '../../../../core/rand';
import type { Generator } from '../../../../mastery/domain/types';

const OUTPUTS = ['report', 'banner', 'motd', 'notes', 'summary', 'index', 'legal', 'stamp', 'changelog', 'manifest'];
const WORDS = ['ready', 'done', 'built', 'fresh', 'final', 'stable'];
const NAMES = ['curl', 'git', 'python', 'sqlite', 'openssl', 'zlib', 'bash', 'ncurses', 'libffi', 'glibc'];

type Inputs = Map<string, string[]>;

const recipe = (name: string, word: string) => `derivation {
  name = "${name}";
  system = builtins.currentSystem;
  builder = "/bin/sh";
  args = [ "-c" "echo ${word} > $out" ];
}`;

/** Recipes that may each use only later ones, so a build order always exists. */
function recipes(rng: Rng, n: number): { names: string[]; inputs: Inputs } {
  const names = rng.shuffle([...NAMES]).slice(0, n);
  const inputs: Inputs = new Map(names.map((name, i) => {
    const later = names.slice(i + 1);
    const count = later.length ? Math.min(later.length, int(rng, i === 0 ? 2 : 0, 2)) : 0;
    return [name, rng.shuffle([...later]).slice(0, count)];
  }));
  return { names, inputs };
}

function needed(inputs: Inputs, top: string): Set<string> {
  const seen = new Set([top]);
  for (const id of seen) for (const r of inputs.get(id)!) seen.add(r);
  return seen;
}

const listing = (inputs: Inputs) => `inputs = {\n${[...inputs].map(([k, v]) => `  ${k} = [ ${v.map((x) => `"${x}"`).join(' ')}${v.length ? ' ' : ''}];`).join('\n')}\n};`;

export const generators: Generator[] = [
  {
    id: 'to-realise',
    make(rng, d) {
      const n = d < 0.5 ? 5 : 7;
      for (;;) {
        const { inputs, names } = recipes(rng, n);
        const top = names[0]!;
        const all = needed(inputs, top);
        const direct = inputs.get(top)!.length;
        const uses = [...all].reduce((a, id) => a + inputs.get(id)!.length, 0) + 1;
        if (all.size === n || all.size === direct + 1) continue;
        const traps = [
          { value: n, why: 'That counts every recipe listed. A recipe that this one does not depend on is never run.' },
          { value: direct + 1, why: 'That stops one level down. Those recipes have inputs of their own, and those must exist first.' },
          { value: uses, why: 'That counts a shared recipe once per use. Each recipe runs once, however many others use its output.' },
        ];
        return {
          prompt: `\`inputs\` gives, for each of these ${n} recipes, the recipes whose output it inserts into a string. The store is empty. How many recipes does Nix run to realise \`${top}\`, counting \`${top}\` itself?`,
          code: listing(inputs),
          lang: 'nix',
          answer: { kind: 'number', value: all.size },
          traps: traps.filter((t, i) => t.value !== all.size && traps.findIndex((o) => o.value === t.value) === i),
          solution: [
            `Start at \`${top}\` and follow every input, noting each recipe once.`,
            `That reaches ${[...all].map((x) => `\`${x}\``).join(', ')}.`,
            `So Nix runs ${all.size} recipes, inputs first.`,
          ],
        };
      }
    },
  },
  {
    id: 'same-output',
    make(rng) {
      const name = pick(rng, OUTPUTS);
      const word = pick(rng, WORDS);
      const otherName = pick(rng, OUTPUTS.filter((n) => n !== name));
      const otherWord = pick(rng, WORDS.filter((w) => w !== word));
      const right = pick(rng, ['Move the `args` line above the `name` line', 'Add a comment line above `args`']);
      const wrong: [string, string][] = rng.shuffle<[string, string]>([
        [`Change the name to \`${otherName}\``, 'The name is an input to the path, so a new name means a new hash.'],
        [`Change \`${word}\` to \`${otherWord}\` in the command`, 'The command is part of the recipe. Change one word and the recipe is a different one.'],
        ['Add `version = "2";` to the set', 'Every attribute goes into the recipe, even one the builder never reads.'],
        ['Swap the two strings in `args`', 'A list has an order, so swapping two entries makes a different recipe.'],
      ]).slice(0, 3);
      const order = rng.shuffle([right, ...wrong.map(([t]) => t)]);
      return {
        prompt: `Here is a derivation named \`${name}\`. Which edit leaves its \`outPath\` unchanged?`,
        code: recipe(name, word),
        lang: 'nix',
        answer: {
          kind: 'choice',
          options: order,
          correct: order.indexOf(right),
          why: order.map((t) => wrong.find(([w]) => w === t)?.[1] ?? null),
        },
        solution: [
          'The output path comes from the contents of the recipe.',
          'The order of names in a set is not part of its contents, and a comment is not part of the value at all, so neither changes the recipe.',
        ],
      };
    },
  },
  bank('facts', [
    {
      q: 'You have evaluated a derivation\'s `drvPath`, and nothing else. What is in the store from it?',
      options: ['The `.drv` file, and no output yet', 'The output path, with the result in it', 'Nothing, because the recipe is only in memory', 'The `.drv` file and an empty output folder'],
      why: ['Evaluating never runs the builder, so there is no result.', 'Evaluating writes the recipe to the store as a `.drv`.', 'The output path does not exist at all until the recipe is realised.'],
      solution: ['Evaluating a derivation instantiates it, which writes the `.drv`.', 'Only realising creates the output.'],
    },
    {
      q: 'How can Nix tell you a derivation\'s output path before anything has been built?',
      options: ['The path is computed from the recipe, which is already complete', 'It runs the build quietly first', 'It reserves the next free name in the store', 'It looks the result up online'],
      why: ['Nothing runs at evaluation. The output path is still empty afterwards.', 'Store paths are named by inputs, not handed out in order.', 'It needs no network. The answer comes from the recipe alone.'],
      solution: ['Every input is written down in the recipe.', 'So the path can be worked out from the recipe, with no build.'],
    },
    {
      q: 'What is a `.drv` file?',
      options: ['A recipe in the store, with every input spelled out', 'The finished result of a build', 'A log of what the builder printed', 'An archive of the source code'],
      why: ['The result goes to the output path. The `.drv` is what describes how to make it.', 'It is written before any builder runs, so there is nothing yet to log.', 'It names its inputs but does not carry them.'],
      solution: ['Instantiating writes the recipe to the store.', 'That file ends in `.drv`.'],
    },
    {
      q: 'What is `\\$out` inside a build?',
      options: ['The store path where the builder must write its result', 'A temporary folder that Nix copies from afterwards', 'An attribute you set in the call to `derivation`', 'The terminal that the builder prints to'],
      why: ['It names the final path itself, not somewhere to copy from.', 'Nix sets it for you. Your recipe only reads it.', 'It is a path in the store, not an output stream.'],
      solution: ['Nix works out the output path from the recipe.', 'It hands that path to the builder as `\\$out`.'],
    },
    {
      q: 'What is the difference between instantiating and realising?',
      options: ['Instantiating writes the recipe, and realising runs it and fills in the output path', 'Instantiating runs the build, and realising copies the result to the store', 'They are two names for one step', 'Instantiating downloads the sources, and realising compiles them'],
      why: ['Instantiating runs no builder. It stops at the `.drv`.', 'They are separate: you can have a `.drv` with no output yet.', 'Instantiating fetches nothing. It writes the recipe.'],
      solution: ['First, evaluation writes the `.drv`.', 'Then realising runs it and fills in the output path.'],
    },
    {
      q: 'A build on Linux tries to read a tool from your home folder, and the recipe does not mention it. What does the build see?',
      options: ['Nothing there, because the sandbox hides it', 'The tool, which Nix adds as an input', 'A copy of your whole home folder', 'The tool, but read-only'],
      why: ['Nix adds nothing on its own. The recipe is the whole list of inputs.', 'A home folder is exactly what the sandbox keeps out.', 'The sandbox does not show it at all, read-only or otherwise.'],
      solution: ['The sandbox shows only what the recipe declares.', 'Your home folder is not declared, so the build cannot see it.'],
    },
    {
      q: 'Why does the sandbox make a store path trustworthy?',
      options: ['The result can only depend on what the recipe names, and the path is named from the recipe', 'It makes builds finish faster', 'It hides the build from other users', 'It stops anyone reading the result afterwards'],
      why: ['Speed is not the point, and a sealed build is not faster.', 'Hiding the build would not say anything about its inputs.', 'Results in the store are readable by everyone.'],
      solution: ['If nothing undeclared can get in, the recipe is the full list of inputs.', 'So a path named from the recipe truly stands for those inputs.'],
    },
    {
      q: 'What does `"\\${drv}"` give you, when `drv` is a derivation?',
      options: ['Its output path, and a hidden record that the string depends on it', 'Its output path, and nothing else', 'Its `.drv` path', 'The text of the recipe'],
      why: ['The string also carries context, which is how the dependency gets recorded.', 'A derivation inserted into a string gives the output path, not the recipe\'s path.', 'The string holds a store path, not the contents of a file.'],
      solution: ['Inserting a derivation gives its output path.', 'The string also remembers the derivation it came from. That memory is its context.'],
    },
    {
      q: 'You paste a store path into a recipe as an ordinary string, instead of inserting the derivation that made it. What is lost?',
      options: ['The recorded dependency, since a plain string has no context', 'Nothing, because the two strings are the same text', 'The hash, which Nix strips from plain strings', 'The ability to evaluate the file'],
      why: ['The text matches, but only the inserted one carries context.', 'Nix does not alter the text of a string.', 'It evaluates fine. The recipe is what ends up missing an input.'],
      solution: ['Context comes only from inserting a value that has it.', 'A string you typed has none, so the new recipe does not record the dependency.'],
    },
    {
      q: 'Which attribute can you leave out of a call to `derivation`?',
      options: ['`args`', '`name`', '`system`', '`builder`'],
      why: ['Nix stops with an error. The store path needs a name to end in.', 'Nix stops with an error. It has to know what kind of machine runs this.', 'Nix stops with an error. Without a builder there is nothing to run.'],
      solution: ['`name`, `system` and `builder` are required.', 'A builder can run with no arguments, so `args` is optional.'],
    },
  ], 'shell'),
];
