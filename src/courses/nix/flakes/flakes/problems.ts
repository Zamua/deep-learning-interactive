import { bank } from '../../../bank';
import { int, pick, type Rng } from '../../../../core/rand';
import type { Generator } from '../../../../mastery/domain/types';

const SYSTEMS = ['x86_64-linux', 'aarch64-linux', 'x86_64-darwin', 'aarch64-darwin'];
const OUTPUTS = ['default', 'hello', 'server', 'cli', 'docs', 'worker', 'api', 'tools'];

type Step = 'upstream' | 'build' | 'update' | 'commit' | 'restore';

function freshRev(rng: Rng, used: Set<string>): string {
  for (;;) {
    const rev = Array.from({ length: 7 }, () => '0123456789abcdef'[rng.int(16)]).join('');
    if (!used.has(rev)) {
      used.add(rev);
      return rev;
    }
  }
}

const LINE: Record<Exclude<Step, 'upstream'>, string> = {
  build: '$ nix build .#default',
  update: '$ nix flake update',
  commit: '$ git commit -am "update nixpkgs"',
  restore: '$ git restore flake.lock',
};

/** A session against a moving branch. Replays until it has at least two branch moves and an update worth tracing. */
function session(rng: Rng, d: number) {
  const pool: Step[] = d < 0.5 ? ['upstream', 'build', 'update'] : ['upstream', 'build', 'update', 'commit', 'restore'];
  const length = d < 0.5 ? int(rng, 4, 5) : int(rng, 6, 8);
  for (;;) {
    const used = new Set<string>();
    const start = freshRev(rng, used);
    let head = start;
    let locked = start;
    let committed = start;
    const lines: string[] = [];
    const pins = [start];
    const steps: Step[] = [];
    for (let i = 0; i < length; i++) {
      const step = pick(rng, pool.filter((e) => (e === 'update' ? locked !== head : e === 'commit' || e === 'restore' ? locked !== committed : true)));
      steps.push(step);
      if (step === 'upstream') {
        head = freshRev(rng, used);
        lines.push(`# nixos-unstable moves to ${head}`);
        continue;
      }
      lines.push(LINE[step]);
      if (step === 'update') locked = head;
      if (step === 'commit') committed = locked;
      if (step === 'restore') locked = committed;
      if ((step === 'update' || step === 'restore') && pins[pins.length - 1] !== locked) pins.push(locked);
    }
    const count = (e: Step) => steps.filter((x) => x === e).length;
    if (count('upstream') < 2 || count('update') < 1) continue;
    if (d >= 0.5 && count('commit') + count('restore') < 1) continue;
    lines.push(LINE.build);
    return { start, head, locked, revs: [...used], pins, code: lines.join('\n') };
  }
}

export const generators: Generator[] = [
  {
    id: 'output-attr',
    make(rng, d) {
      const system = pick(rng, SYSTEMS);
      const name = pick(rng, OUTPUTS);
      const cmd = name === 'default' && rng.int(2) === 0 ? 'nix build' : `nix build .#${name}`;
      const other = pick(rng, SYSTEMS.filter((x) => x !== system));
      const right = `\`packages.${system}.${name}\``;
      const mistakes: [string, string][] = [
        [`\`packages.${name}.${system}\``, 'The system comes first, and the name goes under it.'],
        [`\`${system}.packages.${name}\``, 'The top level is the kind of output, so `packages` comes first.'],
        [`\`packages.${name}\``, 'Packages are per system, so there is a system level in between.'],
        [`\`outputs.${system}.${name}\``, '`outputs` is the function. What it returns has `packages` at the top.'],
        ...(d >= 0.5 ? [[`\`packages.${other}.${name}\``, 'Nix looks under the system of the machine you are on.'] as [string, string]] : []),
      ];
      const wrong = rng.shuffle(mistakes).slice(0, 3);
      const options = rng.shuffle([right, ...wrong.map(([o]) => o)]);
      return {
        prompt: `A flake defines only \`packages\`. On a \`${system}\` machine you run \`${cmd}\` in its folder. Which attribute of its outputs gets built?`,
        answer: {
          kind: 'choice',
          options,
          correct: options.indexOf(right),
          why: options.map((o) => (o === right ? null : wrong.find(([w]) => w === o)![1])),
        },
        solution: [
          'A package sits under `packages`, then the system, then a name.',
          `${cmd === 'nix build' ? 'With no name, `nix build` asks for `default`.' : `The part after \`.#\` is the name, \`${name}\`.`} So it is ${right}.`,
        ],
      };
    },
  },
  {
    id: 'lock-trace',
    make(rng, d) {
      const { start, head, locked, revs, pins, code } = session(rng, d);
      const others = rng.shuffle(revs.filter((r) => r !== locked)).slice(0, 3);
      const options = rng.shuffle([locked, ...others]);
      return {
        prompt: `\`flake.lock\` is committed and pins \`nixpkgs\` at \`${start}\`. After these steps, which revision does the last build use?`,
        code,
        lang: 'shell',
        answer: {
          kind: 'choice',
          options: options.map((r) => `\`${r}\``),
          correct: options.indexOf(locked),
          why: options.map((r) => (r === locked ? null : r === head ? 'That is where the branch is now. A build uses the pin, and a moving branch does not move the pin.' : 'The pin is not there by the last build. Follow it through each line that moves it.')),
        },
        solution: [
          `Only \`nix flake update\`${d >= 0.5 ? ' and restoring `flake.lock` from git' : ''} can move the pin. A new commit on the branch does not.`,
          `The pin goes ${pins.map((p) => `\`${p}\``).join(', then ')}.`,
          `So the last build uses \`${locked}\`.`,
        ],
      };
    },
  },
  bank('facts', [
    {
      q: 'What does `flake.lock` hold for each input?',
      options: ['An exact revision and a hash of its contents', 'A full copy of the input\'s source', 'The store paths of every built package', 'The list of files git tracks'],
      why: ['The source stays in the store. The lock only says which one you mean.', 'A lock pins inputs. Builds are a separate matter.', 'Git keeps that list itself.'],
      solution: ['The lock turns each input into one exact revision and a hash of what it contains.', 'That is all anyone needs to evaluate the same thing.'],
    },
    {
      q: 'Why do you commit `flake.lock` to git?',
      options: ['So everyone who checks out the repository evaluates the same inputs', 'Because git cannot track `flake.nix` without it', 'So that builds run in parallel', 'Because Nix deletes it after each build'],
      why: ['Git tracks `flake.nix` with or without a lockfile.', 'Parallelism has nothing to do with pins.', 'Nix keeps the lockfile, and only rewrites it when inputs change.'],
      solution: ['The pins only help if everybody has them.', 'Committing the file gives every checkout the same inputs.'],
    },
    {
      q: 'What does `nixos-unstable` name in `github:NixOS/nixpkgs/nixos-unstable`?',
      options: ['A branch, which keeps moving', 'One fixed commit', 'A hash of the contents', 'A channel on your machine'],
      why: ['A commit would be a long hexadecimal revision. Pinning to one is the job of the lockfile.', 'Hashes are in `flake.lock`.', 'This URL names a place on GitHub, and it has nothing to do with this machine.'],
      solution: ['It is a branch of the repository, and it gets new commits.', 'That is why the lockfile records one exact commit.'],
    },
    {
      q: 'In a `flake.nix`, what is `outputs`?',
      options: ['A function from the resolved inputs to an attribute set', 'A list of store paths', 'An attribute set written before the inputs are known', 'The URL of the flake\'s build results'],
      why: ['Store paths come much later. `outputs` is Nix code that evaluates.', 'It takes the inputs as arguments, so it runs after they are fetched.', 'A URL says where an input is. `outputs` is code.'],
      solution: ['Nix fetches each input and calls `outputs` with them.', 'What it returns is an attribute set such as `packages.x86_64-linux.default`.'],
    },
    {
      q: 'What happens if `import <nixpkgs> { }` is evaluated inside a flake?',
      options: ['An error: `<nixpkgs>` cannot be looked up in pure evaluation', 'It uses this machine\'s channel', 'It uses the flake\'s `nixpkgs` input', 'It downloads the newest `nixpkgs`'],
      why: ['A channel lives on one machine, which is the exact thing flakes shut out.', 'An angle-bracket lookup never consults the inputs. You use the input by name.', 'Nothing is fetched. The lookup fails.'],
      solution: ['Evaluation of a flake is pure.', 'A name found through this machine\'s search path is not allowed, so the lookup is an error.'],
    },
    {
      q: 'What is `builtins.currentSystem` inside a flake?',
      options: ['Missing: the attribute does not exist there', 'The system of this machine', 'Always `x86_64-linux`', 'An empty string'],
      why: ['That would make the result depend on the machine, so pure evaluation removes it.', 'Nix has no default system. The flake names one itself.', 'An unset environment variable reads as empty, but this attribute is not there at all.'],
      solution: ['Pure evaluation removes what depends on the machine.', 'That is why a flake spells out its systems, as in `packages.x86_64-linux`.'],
    },
    {
      q: 'What does `builtins.getEnv "HOME"` return inside a flake?',
      options: ['An empty string', 'Your home directory', 'An error', '`null`'],
      why: ['That would let the result depend on who runs it.', 'It does not fail. It reads as if the variable were unset.', 'A missing variable reads as an empty string, not `null`.'],
      solution: ['Pure evaluation hides the environment.', 'Every variable reads as if it were unset, so you get `""`.'],
    },
    {
      q: 'A flake in a git repository reads `./data.txt`, which you created but never ran `git add` on. What happens?',
      options: ['An error: the file is not tracked by git', 'It reads the file as usual', 'It reads as an empty string', 'Nix adds the file to git for you'],
      why: ['A flake in a git repository sees only what git tracks.', 'Nix does not pretend the file is empty. It reports it.', 'Nix tells you the command to run, and does not run it.'],
      solution: ['In a git repository a flake only sees tracked files.', 'Nix reports the untracked file and tells you to `git add` it.'],
    },
    {
      q: 'What does `nix flake update` do?',
      options: ['Moves each pin in `flake.lock` to the newest revision', 'Rebuilds every package in the flake', 'Upgrades Nix itself', 'Rewrites the URLs in `flake.nix`'],
      why: ['It changes pins only. Building is a separate step.', 'Nix is untouched. Only the flake\'s lockfile changes.', 'The URLs stay. It is the resolved revisions that change.'],
      solution: ['The URLs say where to look, and the lock says what was found.', '`nix flake update` looks again, and rewrites the lock.'],
    },
    {
      q: 'What does `nix run github:owner/repo` do?',
      options: ['Fetches that flake, builds its default output and runs it', 'Clones the repository for you to edit', 'Adds the program to your profile for good', 'Runs a script in the repository without building anything'],
      why: ['The fetched copy goes to the store, and it is read-only.', 'It runs the program once and changes no profile.', 'The flake\'s output is built first, if it is not already in the store.'],
      solution: ['`nix run` works with any flake reference.', 'It fetches the flake, realises the output and runs its program.'],
    },
    {
      q: 'Two repositories have an identical `flake.nix` but different `flake.lock` files. What can you say?',
      options: ['They can build different things', 'They build the same thing, since `flake.nix` matches', 'Nix refuses to build one of them', 'The newer lockfile wins in both'],
      why: ['`flake.nix` names a branch. The lock says which commit of it.', 'Each lockfile is valid on its own.', 'Each repository uses its own lockfile, whatever its date.'],
      solution: ['`flake.nix` says where inputs are, and the lock says which revision was used.', 'Different pins mean different inputs, so the results can differ.'],
    },
  ], 'nix'),
];
