import { bank } from '../../../bank';
import { int, pick, type Rng } from '../../../../core/rand';
import type { Generator } from '../../../../mastery/domain/types';

const PROJECTS = [['go', 'nodejs'], ['python3', 'poetry'], ['rustc', 'cargo'], ['gcc', 'cmake', 'ninja'], ['ruby', 'bundler'], ['go', 'nodejs', 'postgresql'], ['elixir', 'erlang'], ['zig', 'lldb'], ['deno', 'sqlite'], ['php', 'composer']];
const EXTRAS = ['jq', 'fzf', 'bat', 'htop', 'tree', 'wget'];
const TOOLS = ['ripgrep', 'jq', 'htop', 'fzf', 'tree', 'bat', 'wget', 'sqlite'];

/** A random stretch of shell history: each entry is a nested shell, and the stack is what is still open. */
function history(rng: Rng, d: number, project: string[]) {
  const length = d < 0.5 ? int(rng, 3, 4) : int(rng, 4, 6);
  for (;;) {
    const stack: string[][] = [];
    const lines: string[] = [];
    const entered: string[][] = [];
    let exits = 0;
    for (let i = 0; i < length; i++) {
      const roll = rng.int(stack.length ? 3 : 2);
      if (roll === 2) {
        stack.pop();
        exits++;
        lines.push('$ exit');
      } else {
        const tools = roll === 0 ? project : [pick(rng, EXTRAS)];
        lines.push(roll === 0 ? '$ nix develop' : `$ nix shell nixpkgs#${tools[0]}`);
        stack.push(tools);
        entered.push(tools);
      }
    }
    if (exits >= 1 && stack.length >= 1) return { stack, lines, entered };
  }
}

/** Which command fits which need. Each wrong option is one a learner reaches for. */
function situation(rng: Rng, tool: string) {
  const shell = `\`nix shell nixpkgs#${tool}\``;
  const develop = `\`nix develop nixpkgs#${tool}\``;
  const run = `\`nix run nixpkgs#${tool}\``;
  const build = `\`nix build nixpkgs#${tool}\``;
  return pick(rng, [
    {
      ask: `You want \`${tool}\` on \`PATH\` in a shell for a while, with nothing installed for good.`,
      right: shell,
      wrong: [
        [develop, `That gives you the environment for building \`${tool}\`, not \`${tool}\` itself.`],
        [build, 'That builds a `./result` link, and puts nothing on `PATH`.'],
        [run, 'That runs the program once and comes straight back.'],
      ],
    },
    {
      ask: `You cloned a project with a \`devShells\` output, and its tools include \`${tool}\`. You want the project's toolchain, at its pinned versions.`,
      right: '`nix develop`',
      wrong: [
        [shell, 'That takes one tool from the latest `nixpkgs`, and ignores the project\'s lockfile.'],
        ['`nix build`', 'That builds the project\'s package and leaves you in the same shell.'],
        ['`nix flake update`', 'That moves the project\'s pins. It enters nothing.'],
      ],
    },
    {
      ask: `You want the environment \`${tool}\` itself is built in, so you can run \`configurePhase\` by hand.`,
      right: develop,
      wrong: [
        [shell, `That puts the finished \`${tool}\` on \`PATH\`, and none of the build environment.`],
        [run, 'That runs the finished program.'],
        [build, 'That runs every phase for you, in the sandbox.'],
      ],
    },
    {
      ask: `You want to run \`${tool}\` once, right now, and be back in your own shell when it ends.`,
      right: run,
      wrong: [
        [shell, 'That starts a new shell, and you stay in it until you exit.'],
        [develop, `That enters the environment for building \`${tool}\`.`],
        [build, 'That builds it and runs nothing.'],
      ],
    },
  ]);
}

export const generators: Generator[] = [
  {
    id: 'path-trace',
    make(rng, d) {
      const project = pick(rng, PROJECTS);
      const { stack, lines, entered } = history(rng, d, project);
      const names = (groups: string[][]) => new Set(groups.flat());
      const answer = names(stack).size;
      const named = project.map((t) => `\`${t}\``).join(' and ');
      const traps = [
        { value: names(entered).size, why: 'That is everything you ever entered. Each `exit` leaves a shell, and what it added leaves with it.' },
        { value: stack[stack.length - 1]!.length, why: 'A nested shell keeps the `PATH` of the shell it started in, so the outer tools are still there.' },
        { value: 0, why: 'A shell you have not left still has its tools on `PATH`.' },
      ];
      return {
        prompt: `A project's dev shell provides ${named}. Starting in a plain terminal, you run the commands below. Counting only ${named} and the tools named by \`nix shell\`, how many are on \`PATH\` at the end?`,
        code: lines.join('\n'),
        lang: 'shell',
        answer: { kind: 'number', value: answer },
        traps: traps.filter((t, i) => t.value !== answer && traps.findIndex((o) => o.value === t.value) === i),
        solution: [
          'Each `nix develop` or `nix shell` opens a nested shell that keeps the outer `PATH`, and each `exit` closes the innermost.',
          `The shells still open at the end provide ${[...names(stack)].map((t) => `\`${t}\``).join(', ')}.`,
          `That is ${answer}.`,
        ],
      };
    },
  },
  {
    id: 'which-command',
    make(rng) {
      const tool = pick(rng, TOOLS);
      const { ask, right, wrong } = situation(rng, tool);
      const options = rng.shuffle([right, ...wrong.map(([o]) => o!)]);
      return {
        prompt: `${ask} Which command fits?`,
        answer: {
          kind: 'choice',
          options,
          correct: options.indexOf(right),
          why: options.map((o) => (o === right ? null : wrong.find(([w]) => w === o)![1]!)),
        },
        solution: [
          '`nix shell` puts programs on `PATH`, `nix develop` enters a build environment, `nix run` runs a program once.',
          `So here, ${right}.`,
        ],
      };
    },
  },
  bank('facts', [
    {
      q: 'You `exit` a `nix develop` shell. What happens to its tools?',
      options: ['They leave your environment and stay in the store', 'They are deleted from the store', 'They stay on `PATH` in every terminal', 'They are uninstalled at the next reboot'],
      why: ['Leaving a shell deletes nothing. Only garbage collection removes store paths.', 'They were only ever on the `PATH` of that one shell.', 'They were never installed globally, so there is nothing to uninstall.'],
      solution: ['A dev shell only changes the environment of that one shell.', 'The store paths behind it stay where they are.'],
    },
    {
      q: 'A `nix develop` shell is open in one terminal. Is its Go on `PATH` in another terminal you already had open?',
      options: ['No: only that shell has it', 'Yes: `nix develop` installs it globally', 'Yes, after a few seconds', 'Only if both are in the same folder'],
      why: ['Nothing is installed globally. Only the new shell\'s environment changes.', 'No other terminal is touched, however long you wait.', 'Environments belong to processes, and the folder does not matter.'],
      solution: ['`nix develop` starts a new shell with its own `PATH`.', 'Other terminals keep the environment they already had.'],
    },
    {
      q: 'Two teammates run `nix develop` on the same commit. Why do they get the same Go?',
      options: ['`flake.lock` pins the `nixpkgs` they both evaluate', 'Nix always installs the newest Go', 'They happen to have the same channel', '`mkShell` compiles Go the same way every time'],
      why: ['A flake never takes the newest on its own. It takes the pinned one.', 'A flake does not use this machine\'s channel at all.', 'Which Go you get is settled by the pin, before anything is built.'],
      solution: ['The lockfile is in the repository, so both have the same pins.', 'The same `nixpkgs` gives the same Go.'],
    },
    {
      q: 'A flake has `packages.x86_64-linux.default` and no `devShells`. What does `nix develop` give you there?',
      options: ['The build environment of that package', 'An error, because there is no dev shell', 'An empty shell', 'A shell with the finished package on `PATH`'],
      why: ['It falls back to `packages` when there is no dev shell.', 'It gives you what a build of the package would have.', 'That is what `nix shell` does.'],
      solution: ['`nix develop` looks for `devShells.<system>.default`, then `packages.<system>.default`.', 'Given a package, it gives you that package\'s build environment.'],
    },
    {
      q: 'Which best states the difference between `nix shell` and `nix develop`?',
      options: ['`nix shell` puts a package\'s programs on `PATH`, `nix develop` gives a build environment', '`nix shell` installs for good, `nix develop` does not', '`nix develop` works only inside containers', '`nix shell` needs a flake in the folder, `nix develop` does not'],
      why: ['Neither installs anything for good.', 'Neither has anything to do with containers.', 'It is the other way round: `nix shell nixpkgs#jq` works from any folder.'],
      solution: ['`nix shell` is about the finished programs.', '`nix develop` is about what you need to build or work on the project.'],
    },
    {
      q: 'When does `shellHook` run?',
      options: ['Each time someone enters the shell', 'Once, when the flake is first built', 'When the shell exits', 'Only the first time on each machine'],
      why: ['It is not a build step. It runs when you enter.', 'It runs on the way in, not on the way out.', 'Nothing remembers that it already ran. It runs at every entry.'],
      solution: ['`shellHook` is bash that runs as the shell starts.', 'So every `nix develop` runs it.'],
    },
    {
      q: 'What does `pkgs.mkShell { packages = [ pkgs.go ]; }` return?',
      options: ['A derivation', 'A running shell', 'A list of store paths', 'A script in your home folder'],
      why: ['Evaluating starts no shell. `nix develop` does that.', 'It is one value, built by a wrapper around `mkDerivation`.', 'Nothing is written to your home folder.'],
      solution: ['`mkShell` is a wrapper around `mkDerivation`.', 'So what it returns is a derivation, one that `nix develop` enters instead of installing.'],
    },
    {
      q: 'After `nix store gc`, `nix develop` is slow to start for the first time in weeks. Why?',
      options: ['Garbage collection deleted the shell\'s tools, so they must come back', '`flake.lock` expired', 'The shell hook keeps a cache that was cleared', '`nix develop` always downloads everything'],
      why: ['A lockfile has no expiry. Pins stay until you move them.', 'A hook is only your own bash, and Nix keeps no cache for it.', 'Paths already in the store are not fetched again.'],
      solution: ['The tools are ordinary store paths, and nothing was keeping them.', 'So they were collected, and have to be fetched or built again.'],
    },
    {
      q: 'What keeps a dev shell\'s tools through garbage collection?',
      options: ['`nix develop --profile ./.dev-profile`, because a profile is a root', 'Committing `flake.lock`', 'Leaving the shell with `exit`', 'Naming them in `shellHook`'],
      why: ['The lock says which versions you want, and the collector never reads it.', 'Exiting changes your environment, and nothing in the store.', 'A hook is a piece of bash, and it does not tell the collector anything.'],
      solution: ['Garbage collection keeps only what a root leads to.', 'Saving the shell to a profile makes that profile a root.'],
    },
    {
      q: 'One project\'s dev shell has Go 1.21 and another\'s has Go 1.24. What happens on one machine?',
      options: ['Both work: each version is its own store path', 'The later one replaces the earlier', 'You need a separate user for each', 'Nix refuses to hold two versions'],
      why: ['Nothing is replaced, since store paths never change.', 'Dev shells are separate per shell, not per user.', 'Holding many versions side by side is what the store is for.'],
      solution: ['Each version has its own hash, and so its own store path.', 'Each shell puts its own one on `PATH`, so they never clash.'],
    },
  ], 'shell'),
];
