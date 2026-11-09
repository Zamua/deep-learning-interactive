import { bank } from '../../../bank';
import { int, type Rng } from '../../../../core/rand';
import type { Generator } from '../../../../mastery/domain/types';

const NAMES = ['curl', 'git', 'python', 'sqlite', 'openssl', 'zlib', 'bash', 'ncurses', 'libffi', 'glibc'];

type Refs = Map<string, string[]>;

/** A small reference graph: each path may point only at later ones, so it can never loop. */
function graph(rng: Rng, n: number): { names: string[]; refs: Refs } {
  const names = rng.shuffle([...NAMES]).slice(0, n);
  const refs: Refs = new Map(names.map((name, i) => {
    const later = names.slice(i + 1);
    const count = later.length ? Math.min(later.length, int(rng, 0, 2)) : 0;
    return [name, rng.shuffle([...later]).slice(0, count)];
  }));
  return { names, refs };
}

function closureOf(refs: Refs, start: string): Set<string> {
  const seen = new Set([start]);
  for (const id of seen) for (const r of refs.get(id)!) seen.add(r);
  return seen;
}

const liveFrom = (refs: Refs, roots: string[]) => new Set(roots.flatMap((r) => [...closureOf(refs, r)]));
const quoted = (xs: string[]) => xs.map((x) => `\`${x}\``).join(' and ');
const listing = (refs: Refs) => `refs = {\n${[...refs].map(([k, v]) => `  ${k} = [ ${v.map((x) => `"${x}"`).join(' ')}${v.length ? ' ' : ''}];`).join('\n')}\n};`;

export const generators: Generator[] = [
  {
    id: 'survivors',
    make(rng, d) {
      const n = d < 0.5 ? 6 : 8;
      const rootCount = d < 0.5 ? 1 : 2;
      for (;;) {
        const { refs, names } = graph(rng, n);
        const roots = rng.shuffle([...names]).slice(0, rootCount);
        const live = liveFrom(refs, roots);
        if (live.size === n || live.size === rootCount) continue;
        const first = closureOf(refs, roots[0]!).size;
        const traps = [
          { value: rootCount, why: 'That counts only the roots. Everything a root reaches is live too.' },
          { value: n, why: 'That is every path listed. A path that no root reaches is garbage.' },
          { value: n - live.size, why: 'That is how many are deleted. The question asks how many stay.' },
          ...(rootCount > 1 ? [{ value: first, why: `That is the closure of \`${roots[0]}\` alone. What the other root reaches is live as well.` }] : []),
        ];
        return {
          prompt: `\`refs\` gives each store path's direct references. The only GC ${rootCount === 1 ? 'root points' : 'roots point'} at ${quoted(roots)}. How many of these ${n} paths survive a garbage collection?`,
          code: listing(refs),
          lang: 'nix',
          answer: { kind: 'number', value: live.size },
          traps: traps.filter((t, i) => t.value !== live.size && traps.findIndex((o) => o.value === t.value) === i),
          solution: [
            'Live is the closure of the roots, so walk from each root.',
            `The walk reaches ${quoted([...live])}.`,
            `So ${live.size} paths survive, and the other ${n - live.size} are garbage.`,
          ],
        };
      }
    },
  },
  {
    id: 'after-unroot',
    make(rng, d) {
      const n = d < 0.5 ? 6 : 8;
      for (;;) {
        const { refs, names } = graph(rng, n);
        const [gone, kept] = rng.shuffle([...names]).slice(0, 2) as [string, string];
        const before = liveFrom(refs, [gone, kept]);
        const after = closureOf(refs, kept);
        const freed = [...before].filter((x) => !after.has(x));
        const reach = closureOf(refs, gone).size;
        if (freed.length === 0 || freed.length === reach) continue;
        const traps = [
          { value: reach, why: `That is the whole closure of \`${gone}\`. Some of it is still reached by \`${kept}\`, and that part stays.` },
          { value: 1, why: `That counts only \`${gone}\`. What only it reached has lost its way to a root as well.` },
          { value: after.size, why: 'That is how many stay. The question asks how many go.' },
        ];
        return {
          prompt: `\`refs\` gives each store path's direct references. The GC roots point at \`${gone}\` and \`${kept}\`, and you remove the root on \`${gone}\`. How many paths does the next garbage collection delete that it would have kept before?`,
          code: listing(refs),
          lang: 'nix',
          answer: { kind: 'number', value: freed.length },
          traps: traps.filter((t, i) => t.value !== freed.length && traps.findIndex((o) => o.value === t.value) === i),
          solution: [
            `Before, live was the closure of both roots: ${before.size} paths.`,
            `After, live is the closure of \`${kept}\` alone: ${quoted([...after])}.`,
            `The difference is ${freed.length}: ${quoted(freed)}.`,
          ],
        };
      }
    },
  },
  bank('facts', [
    {
      q: 'What does a garbage collection keep?',
      options: ['Every path reachable from a GC root', 'Every path used in the last month', 'Only the GC roots themselves', 'The newest version of each package'],
      why: ['Nix does not go by age. Only what the roots reach counts.', 'A root\'s references have to stay too, or the root would break.', 'Version numbers play no part. An old version that a root reaches stays.'],
      solution: ['Live is the closure of the roots.', 'Everything in it is kept, and the rest can go.'],
    },
    {
      q: 'Why can a live path never point at a deleted one?',
      options: ['Live is made of closures, so whatever a live path references is live too', 'Nix runs each program to check it first', 'Deleted paths stay in a trash folder for a while', 'Store paths do not reference each other'],
      why: ['Nix never runs anything to decide. It only follows recorded references.', 'There is no trash. A deleted path is gone.', 'They do, and following those references is how live is found.'],
      solution: ['A closure is complete: nothing inside it points outside it.', 'Live is a union of closures, so nothing live points at garbage.'],
    },
    {
      q: 'You delete a `result` link, then collect. What happens to the path it pointed at?',
      options: ['It is deleted, unless another root still reaches it', 'It is always deleted', 'It stays, because it was built on this machine', 'Nix puts the link back'],
      why: ['Another root may reach it, and then it is live.', 'Where a path was built does not make it live.', 'Nix leaves your links alone. Removing one is how you give up that root.'],
      solution: ['The link was one root.', 'Without it the path is garbage only if no other root reaches it.'],
    },
    {
      q: 'What does `nix-store --query --roots` tell you about a path?',
      options: ['Which GC roots are keeping it alive', 'Which paths it references', 'Which paths would be deleted next', 'Which user built it'],
      why: ['That is what `--references` is for. `--roots` looks the other way, up to the roots.', 'It answers for this one path, and says nothing about the others.', 'Nix keeps no owner to report. The answer is a list of roots.'],
      solution: ['It lists each root whose closure contains the path.', 'An empty answer means nothing is holding it.'],
    },
    {
      q: 'You upgraded curl a week ago, and the old curl is still in the store. Which explains that?',
      options: ['An old generation may still reach it, or nothing has collected it yet', 'Nix never deletes anything', 'The new curl needs the old one', 'Upgrading only renames the folder'],
      why: ['Garbage collection does delete paths, once no root reaches them.', 'The new version does not depend on the old one.', 'Store paths are never renamed. The new version has a new folder.'],
      solution: ['Nothing leaves the store until a collection runs.', 'And a collection keeps it while any generation still reaches it.'],
    },
    {
      q: 'What does `nix-collect-garbage -d` do that `nix-store --gc` does not?',
      options: ['Deletes old profile generations first, which removes roots', 'Deletes live paths as well', 'Deletes every `result` link on the machine', 'Empties the store and starts again'],
      why: ['Neither command deletes live paths.', 'It works on profile generations, not your `result` links.', 'Your current generation and everything it reaches stay.'],
      solution: ['Each generation is a root.', 'Deleting old generations frees whatever only they reached.'],
    },
    {
      q: 'Why is every generation of a profile a GC root?',
      options: ['So you can go back to it, which needs everything it lists to exist', 'Because it is the newest thing in the store', 'Because generations are stored outside the store', 'To stop you from deleting them'],
      why: ['Older generations are roots as well, and they are not new.', 'A generation\'s programs live in the store like anything else. That is why they need protecting.', 'You can delete them, and that is what `-d` does.'],
      solution: ['A generation is only useful if its programs still exist.', 'Making it a root keeps them, along with everything they need.'],
    },
    {
      q: 'Two roots reach the same `zlib`. You remove one of the roots and collect. What happens to `zlib`?',
      options: ['It stays, because the other root still reaches it', 'It is deleted along with the removed root', 'It stays for one more collection, then goes', 'Nix makes a second copy first'],
      why: ['One root is enough to keep a path live.', 'Nix keeps no such countdown. Each collection decides afresh from the roots.', 'A path exists once in the store, however many others use it.'],
      solution: ['A path is live if any root reaches it.', 'The other root still does.'],
    },
    {
      q: 'Which of these is NOT a GC root?',
      options: ['A store path that no link points at', 'A `result` link from a build', 'A generation of your profile', 'A link under `/nix/var/nix/gcroots`'],
      why: ['A `result` link is a root. That is why it keeps a build alive.', 'Every generation is a root, which is what lets you go back to it.', 'That folder is where roots are registered.'],
      solution: ['A root is a link that Nix knows about, from outside the store.', 'A path with no link pointing at it is only live if some root reaches it.'],
    },
  ], 'shell'),
];
