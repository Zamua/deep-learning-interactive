import { bank } from '../../../bank';
import { int, pick, type Rng } from '../../../../core/rand';
import type { Generator } from '../../../../mastery/domain/types';

const NAMES = ['curl', 'git', 'python', 'sqlite', 'openssl', 'zlib', 'bash', 'ncurses', 'libffi', 'glibc'];

type Refs = Map<string, string[]>;

/** A small reference graph: each path may point only at later ones, so it can never loop. */
function graph(rng: Rng, n: number): { names: string[]; refs: Refs } {
  const names = rng.shuffle([...NAMES]).slice(0, n);
  const refs: Refs = new Map(names.map((name, i) => {
    const later = names.slice(i + 1);
    const count = later.length ? Math.min(later.length, int(rng, i === 0 ? 2 : 1, 2)) : 0;
    return [name, rng.shuffle([...later]).slice(0, count)];
  }));
  return { names, refs };
}

function closureOf(refs: Refs, start: string): Set<string> {
  const seen = new Set([start]);
  for (const id of seen) for (const r of refs.get(id)!) seen.add(r);
  return seen;
}

/** The arrows from `from` to `to`, as `a -> b -> c`. */
function route(refs: Refs, from: string, to: string): string {
  const back = new Map<string, string>();
  const seen = new Set([from]);
  for (const id of seen) {
    for (const r of refs.get(id)!) {
      if (!seen.has(r)) back.set(r, id);
      seen.add(r);
    }
  }
  const out = [to];
  while (out[0] !== from) out.unshift(back.get(out[0]!)!);
  return out.join(' -> ');
}

/** How many times a walk that never remembers where it has been would count paths from here. */
function treeSize(refs: Refs, id: string): number {
  return 1 + refs.get(id)!.reduce((a, r) => a + treeSize(refs, r), 0);
}

const listing = (refs: Refs) => `refs = {\n${[...refs].map(([k, v]) => `  ${k} = [ ${v.map((x) => `"${x}"`).join(' ')}${v.length ? ' ' : ''}];`).join('\n')}\n};`;

export const generators: Generator[] = [
  {
    id: 'closure-size',
    make(rng, d) {
      const { refs, names } = graph(rng, d < 0.5 ? 5 : 7);
      const start = names[0]!;
      const all = closureOf(refs, start);
      const direct = refs.get(start)!.length;
      const tree = treeSize(refs, start);
      const traps = [
        { value: direct, why: `${direct} is only what \`${start}\` references directly. A closure also takes in what those reference.` },
        { value: all.size - 1, why: 'A closure includes the path you started from.' },
        ...(tree !== all.size ? [{ value: tree, why: 'That counts a shared path once per arrow that reaches it. A path is in the closure once.' }] : []),
      ];
      return {
        prompt: `\`refs\` gives each store path's direct references. How many paths are in the closure of \`${start}\`, counting \`${start}\` itself?`,
        code: listing(refs),
        lang: 'nix',
        answer: { kind: 'number', value: all.size },
        traps: traps.filter((t, i) => t.value !== all.size && traps.findIndex((o) => o.value === t.value) === i),
        solution: [
          `Start at \`${start}\` and follow every reference, keeping a list of paths seen.`,
          `The walk reaches ${[...all].map((x) => `\`${x}\``).join(', ')}.`,
          `That is ${all.size} paths, each counted once.`,
        ],
      };
    },
  },
  {
    id: 'outside-closure',
    make(rng, d) {
      for (;;) {
        const { refs, names } = graph(rng, d < 0.5 ? 6 : 8);
        const start = names[int(rng, 0, 1)]!;
        const all = closureOf(refs, start);
        const outside = names.filter((n) => !all.has(n));
        const inside = rng.shuffle([...all].filter((n) => n !== start));
        if (!outside.length || inside.length < 2) continue;
        const out = pick(rng, outside);
        const shown = inside.slice(0, 3);
        const order = rng.shuffle([out, ...shown]);
        return {
          prompt: `\`refs\` gives each store path's direct references. Which of these is **not** in the closure of \`${start}\`?`,
          code: listing(refs),
          lang: 'nix',
          answer: {
            kind: 'choice',
            options: order.map((n) => `\`${n}\``),
            correct: order.indexOf(out),
            why: order.map((n) => (n === out ? null : `\`${n}\` is reached by \`${route(refs, start, n).replaceAll(' -> ', '` then `')}\`.`)),
          },
          solution: [
            `Follow the references out of \`${start}\`: the walk reaches ${[...all].map((x) => `\`${x}\``).join(', ')}.`,
            `\`${out}\` is not on that list. Nothing in the closure points at it.`,
          ],
        };
      }
    },
  },
  bank('facts', [
    {
      q: 'How does Nix learn a store path\'s runtime references?',
      options: ['It scans the built output for the hashes of the build\'s inputs', 'The package author lists them by hand', 'It runs the program and watches what it opens', 'It asks the operating system\'s package manager'],
      why: ['Nobody writes the list. Nix works it out after the build.', 'Nix never runs the output to find references. It reads the bytes.', 'Nix does not consult another package manager for this.'],
      solution: ['Each input has a hash in its store path.', 'After the build, Nix searches the output for those hashes. A hash it finds is a reference.'],
    },
    {
      q: 'A compiler was an input to a build, but its store path appears nowhere in the output. Is the compiler in the output\'s closure?',
      options: ['No: nothing in the output references it', 'Yes: every input ends up in the closure', 'Only when the output is a binary', 'Only until the next garbage collection'],
      why: ['Inputs are what the build could use. The closure holds only what the result still points at.', 'A binary is scanned like anything else, and the compiler\'s hash is not in it.', 'Membership in a closure comes from references, and it does not change with time.'],
      solution: ['References are found by scanning the output for input hashes.', 'The compiler\'s hash is not in the output, so it is not a reference, and the closure does not include it.'],
    },
    {
      q: 'Which command prints a path\'s whole closure?',
      options: ['`nix-store --query --requisites`', '`nix-store --query --references`', '`nix-store --query --deriver`', '`nix-store --realise`'],
      why: ['`--references` prints only the direct references, one step out.', '`--deriver` names the derivation that built the path.', '`--realise` builds or fetches a path. It does not list anything out.'],
      solution: ['`--references` goes one step out.', '`--requisites` keeps going until there is nowhere new to go, which is the closure.'],
    },
    {
      q: 'Does a store path\'s closure include the path itself?',
      options: ['Yes', 'No, only what it depends on', 'Only if it references itself', 'Only when the path is a program'],
      why: ['The closure is what you need to have the path, and that starts with the path.', 'Whether it points at itself makes no difference.', 'Any store path has a closure, program or not.'],
      solution: ['A closure is the start plus everything reachable from it.', 'So the start is always in it.'],
    },
    {
      q: 'Three paths in a closure all reference the same C library. How many times is the library counted in the closure?',
      options: ['Once', 'Three times', 'Four times', 'Zero times, it is a system library'],
      why: ['A path is one folder in the store, however many arrows reach it.', 'A closure is a set of paths, and a set does not repeat.', 'Nix has no separate system libraries. The C library is a store path like any other.'],
      solution: ['A closure is a set of store paths.', 'One folder, reached three ways, is still one member.'],
    },
    {
      q: 'You run `nix copy` to a server that already holds some of the closure. What gets sent?',
      options: ['Only the paths the server is missing', 'The whole closure, replacing what is there', 'Only the path you named', 'Nothing, unless the server holds none of it'],
      why: ['Store paths are never replaced. A path the server has is left alone.', 'The path alone might not run. Its references go with it.', 'Paths that are there are skipped, and the rest are sent.'],
      solution: ['`nix copy` works on the closure.', 'A store path that is already present is skipped, so only the missing ones travel.'],
    },
    {
      q: 'Which is true of every closure?',
      options: ['If a path is in it, so is everything that path references', 'It contains every input the build used', 'It holds at most one version of each library', 'It lives in its own folder under `/nix/store`'],
      why: ['Inputs that left no hash in the output are not in it.', 'Two versions of a library are two different store paths, and both can be in one closure.', 'A closure is a set of existing store paths, and it has no folder of its own.'],
      solution: ['A closure keeps following references until there are none left to follow.', 'So nothing inside it points outside it.'],
    },
    {
      q: 'Why can a copied closure run on a machine with none of the program\'s libraries installed?',
      options: ['Everything it references came with it, at the same `/nix/store` paths', 'Nix links every program statically when copying', 'The program is rebuilt on arrival', 'Nix translates the paths to wherever the libraries are'],
      why: ['Nix does not change how a program was linked.', 'Copying a closure moves finished store paths, and nothing is built.', 'The paths inside the program stay exactly as they were built.'],
      solution: ['The closure includes every path the program points at.', 'They land at the same absolute paths, so its references still resolve.'],
    },
  ], 'shell'),
];
