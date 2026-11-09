import { bank } from '../../../bank';
import { int, pick, type Rng } from '../../../../core/rand';
import type { Generator } from '../../../../mastery/domain/types';

const NAMES = ['greeting', 'motd', 'banner', 'note', 'welcome', 'title'];
const TEXTS = ['hello', 'good day', 'welcome back', 'hi there', 'ready', 'all done'];

interface Build {
  name: string;
  compiler: string;
}

const PACKAGES = ['openssl-3.4', 'openssl-1.1', 'zlib-1.3', 'curl-8.11', 'sqlite-3.47', 'bash-5.2', 'libffi-3.4', 'ncurses-6.5'];
const COMPILERS = ['gcc-13', 'gcc-14', 'clang-18'];

const showBuild = (b: Build) => `{ name = "${b.name}"; compiler = "${b.compiler}"; }`;

/** Builds with some repeated exactly and some differing only in compiler. */
function builds(rng: Rng, count: number): { list: Build[]; names: string[]; paths: number } {
  for (;;) {
    const names = rng.shuffle([...PACKAGES]).slice(0, 2);
    const compilers = rng.shuffle([...COMPILERS]).slice(0, 2);
    const list = Array.from({ length: count }, () => ({ name: pick(rng, names), compiler: pick(rng, compilers) }));
    const paths = new Set(list.map(showBuild)).size;
    const distinctNames = new Set(list.map((b) => b.name)).size;
    if (paths < count && paths > distinctNames) return { list, names, paths };
  }
}

export const generators: Generator[] = [
  {
    id: 'distinct-paths',
    make(rng, d) {
      const { list, names, paths } = builds(rng, d < 0.5 ? 5 : 7);
      const distinctNames = new Set(list.map((b) => b.name)).size;
      const seen = [...new Set(list.map(showBuild))];
      return {
        prompt: `Each line lists everything that went into one build of \`${names[0]}\` or \`${names[1]}\`. How many different store paths do these ${list.length} builds produce?`,
        code: `[\n${list.map((b) => `  ${showBuild(b)}`).join('\n')}\n]`,
        lang: 'nix',
        answer: { kind: 'number', value: paths },
        traps: [
          { value: list.length, why: 'That counts builds. Two builds with identical inputs land on the same store path, so a repeat makes nothing new.' },
          { value: distinctNames, why: 'That counts names. The compiler went in too, so a different compiler gives a different hash and a different path.' },
        ],
        solution: [
          'The path is named by what went in, so count the distinct combinations of inputs.',
          `The distinct builds are ${seen.map((b) => `\`${b}\``).join(', ')}.`,
          `That is ${paths} store paths.`,
        ],
      };
    },
  },
  {
    id: 'same-path',
    make(rng) {
      const name = pick(rng, NAMES);
      const text = pick(rng, TEXTS);
      const otherName = pick(rng, NAMES.filter((n) => n !== name));
      const cut = int(rng, 1, text.length - 1);
      const right = `builtins.toFile "${name}" ("${text.slice(0, cut)}" + "${text.slice(cut)}")`;
      const wrong: [string, string][] = [
        [`builtins.toFile "${otherName}" "${text}"`, 'The name goes into the hash as well as the text, so a different name means a different path.'],
        [`builtins.toFile "${name}" "${text}\\n"`, 'A newline is one more character of content, and any change to the content changes the hash.'],
        [`builtins.toFile "${name}" "${text.charAt(0).toUpperCase()}${text.slice(1)}"`, 'A capital letter is different content, so the hash is different.'],
      ];
      const order = rng.shuffle([right, ...wrong.map(([t]) => t)]);
      return {
        prompt: `Which expression evaluates to the same store path as \`builtins.toFile "${name}" "${text}"\`?`,
        answer: {
          kind: 'choice',
          options: order.map((t) => `\`${t}\``),
          correct: order.indexOf(right),
          why: order.map((t) => wrong.find(([w]) => w === t)?.[1] ?? null),
        },
        solution: [
          'The path comes from the name and the contents, not from how the expression is written.',
          `\`"${text.slice(0, cut)}" + "${text.slice(cut)}"\` is the same text as \`"${text}"\`, and the name is the same, so the path is the same.`,
        ],
      };
    },
  },
  bank('facts', [
    {
      q: 'Why can two versions of one library be on the same machine under Nix?',
      options: ['Each is a separate folder, named by what went into it', 'Nix renames the old one when the new one arrives', 'Both go into one shared folder like `/usr/lib`', 'The newer one is stored as a patch on the older one'],
      why: ['Nothing is renamed. Each path keeps its name for as long as it exists.', 'A shared folder has one place per library, which is the problem store paths avoid.', 'Each version is a complete folder of its own.'],
      solution: ['Different inputs give different hashes.', 'So each version has its own folder, and neither touches the other.'],
    },
    {
      q: 'What decides the hash part of a store path?',
      options: ['What went into the path', 'The time it was written', 'The machine it was written on', 'A counter that goes up with each new path'],
      why: ['Nix leaves the clock out of it. The same inputs an hour later give the same path.', 'Two machines with the same inputs get the same path.', 'A counter would give the same inputs a new path each time, and that would defeat the point.'],
      solution: ['Nix computes the hash from the inputs.', 'Same inputs, same hash, on any machine, at any time.'],
    },
    {
      q: 'The store already holds the path for a given set of inputs, and you ask for those same inputs again. What does Nix do?',
      options: ['Uses the path that is there and does no work', 'Builds again and writes a second path', 'Replaces the old copy with a fresh one', 'Stops with an error, because the path exists'],
      why: ['The same inputs name the same path, so there would be nothing different to write.', 'Store paths are never replaced.', 'Finding the path there is the good case: the work is already done.'],
      solution: ['The path is named by its inputs.', 'If it exists, it already holds the result, so Nix skips the work.'],
    },
    {
      q: 'Which of these could be the hash in a store path?',
      options: ['`5akl8zsmda0yrr63v4khwgskih2g2hsh`', '`5ekl8zsmda0yrr63v4khwgskih2g2hsh`', '`5akl8zsmda0yrr63v4khwgskih2g2h`', '`5AKL8ZSMDA0YRR63V4KHWGSKIH2G2HSH`'],
      why: ['Nix\'s alphabet leaves out `e`, `o`, `u` and `t`, and this one has an `e`.', 'This has 30 characters. The hash is always 32.', 'The alphabet is lower case digits and letters.'],
      solution: ['The hash is 32 characters long.', 'It uses digits and lower case letters, without `e`, `o`, `u` or `t`.'],
    },
    {
      q: 'You want a changed copy of a file that is already in the store. How does it end up in the store?',
      options: ['As a new store path with a different hash', 'By editing the existing path in place', 'As the same path with a suffix added', 'It cannot be done once a path exists'],
      why: ['Store paths are read-only once written.', 'A changed file has different contents, and so a different hash, not a suffix.', 'Nothing stops you. The change goes into a new path.'],
      solution: ['The store is read-only, so the old path stays as it is.', 'The new contents hash differently and land at a new path.'],
    },
    {
      q: 'What does `"\\${./config.toml}"` evaluate to?',
      options: ['A store path holding a copy of the file', 'The text inside the file', 'The file\'s path on your disk', 'An error, because a path cannot be put in a string'],
      why: ['Evaluating it does not read the file\'s text into the string. It gives a path.', 'The local path is copied in, and the result is the path in the store.', 'Inserting a path into a string is exactly how to copy a file into the store.'],
      solution: ['A local path inserted into a string is copied into the store.', 'The string becomes the new store path.'],
    },
    {
      q: 'Where does `builtins.toFile "note" "hi"` put its result?',
      options: ['A file named `<hash>-note` in `/nix/store`', 'A file named `note` in the current folder', 'A file at `/nix/store/note` with no hash', 'Nowhere, it only returns the text'],
      why: ['Results go to the store, not to the current folder.', 'Every store path has a hash before its name.', 'It writes the text to a file and returns that file\'s store path.'],
      solution: ['`builtins.toFile` writes its text into the store.', 'The result is a store path: a hash, a dash, and the name.'],
    },
    {
      q: 'Why does a program in the store keep working when you install something new?',
      options: ['The new thing goes in a new folder, and existing paths never change', 'Nix restarts the program after each install', 'Nix copies a private version of each library into every program', 'Programs in the store only use libraries from `/usr/lib`'],
      why: ['Restarting would not help if the program\'s library had been replaced. It is not replaced.', 'Each library is one folder, used by whoever points at it.', 'Programs in the store point at store paths.'],
      solution: ['Existing paths are read-only and never change.', 'So installing something only adds new folders.'],
    },
    {
      q: 'Why can Nix fetch a path from a shared cache instead of building it?',
      options: ['The hash says what went in, so a cached copy with that name is the same thing', 'The cache compiles it again on demand', 'Nix trusts whatever has the same version number', 'The name part of the path is unique across all machines'],
      why: ['The cache only serves paths that already exist.', 'A version number alone says nothing about the other inputs. The hash covers them all.', 'Many paths share a name. The hash is what tells them apart.'],
      solution: ['A store path is named by its inputs.', 'A cached path with the same hash came from the same inputs, so Nix can use it in place of a build.'],
    },
  ], 'shell'),
];
