import { bank } from '../../../bank';
import { int, pick } from '../../../../core/rand';
import type { Generator } from '../../../../mastery/domain/types';

const PACKAGES = ['hello', 'curl', 'git', 'sqlite', 'tmux', 'wget', 'ripgrep', 'jq', 'vim', 'bash'];
const LIBS = ['zlib', 'openssl', 'libpng', 'sqlite', 'ncurses', 'libffi', 'pcre2', 'expat'];

/** The seven phases in the order they run, with what each one does by default. */
const PHASES = [
  { name: 'unpack', does: 'Unpack `\\$src` and `cd` into it' },
  { name: 'patch', does: 'Apply each file in `patches`' },
  { name: 'configure', does: 'Run `./configure --prefix=\\$out`' },
  { name: 'build', does: 'Run `make`' },
  { name: 'check', does: 'Run `make check`' },
  { name: 'install', does: 'Run `make install`' },
  { name: 'fixup', does: 'Strip the binaries and fix script interpreters' },
];

export const generators: Generator[] = [
  {
    id: 'phase-order',
    make(rng, d) {
      const n = d < 0.5 ? int(rng, 3, 4) : d < 0.75 ? int(rng, 5, 6) : 7;
      const chosen = rng.shuffle(PHASES.map((_, i) => i)).slice(0, n).sort((a, b) => a - b);
      const picked = chosen.map((i) => PHASES[i]!);
      const byName = rng.int(2) === 0;
      return {
        prompt: `A \`stdenv.mkDerivation\` build of \`${pick(rng, PACKAGES)}\` runs ${byName ? 'these phases' : 'these default steps'}. Put them in the order they run.`,
        answer: { kind: 'order', items: picked.map((p) => (byName ? `\`${p.name}\`` : p.does)) },
        solution: [
          'The phases always run in one order: unpack, patch, configure, build, check, install, fixup.',
          `So here: ${picked.map((p) => p.name).join(', then ')}.`,
        ],
      };
    },
  },
  {
    id: 'call-package',
    make(rng, d) {
      const libs = rng.shuffle([...LIBS]);
      const asks = libs.slice(0, d < 0.5 ? 2 : 3);
      const inSet = ['stdenv', 'fetchurl', ...libs.slice(0, 5)];
      const flag = d >= 0.5;
      const mine = pick(rng, asks);
      const args = ['stdenv', 'fetchurl', ...asks];
      const fromSet = args.filter((a) => a !== mine);
      const code = [
        '# package.nix',
        `{ ${[...args, ...(flag ? ['enableTests ? false'] : [])].join(', ')} }:`,
        'stdenv.mkDerivation { pname = "app"; version = "1.0"; src = ./.; }',
        '',
        `# nixpkgs has: ${inSet.join(' ')}`,
        `app = callPackage ./package.nix { ${mine} = my-${mine}; };`,
      ].join('\n');
      const traps = [
        { value: args.length, why: `\`${mine}\` is named in the second set, so your value wins and nixpkgs is not asked for it.` },
        ...(flag ? [{ value: args.length + 1, why: '`enableTests` is not a package in nixpkgs. Nothing fills it, so it keeps its default.' }] : []),
        { value: 1, why: `That is how many you passed yourself. \`callPackage\` fills in the others.` },
      ];
      return {
        prompt: `\`callPackage\` calls \`package.nix\` to build \`${pick(rng, PACKAGES)}\`. How many of its arguments does it fill in from nixpkgs?`,
        code,
        lang: 'nix',
        answer: { kind: 'number', value: fromSet.length },
        traps: traps.filter((t, i) => t.value !== fromSet.length && traps.findIndex((o) => o.value === t.value) === i),
        solution: [
          '`callPackage` looks up each argument name in nixpkgs, and a value in the second set wins.',
          `\`${mine}\` comes from the second set, so nixpkgs is not used for it.`,
          ...(flag ? ['`enableTests` is not in nixpkgs, so it keeps its default.'] : []),
          `That leaves ${fromSet.length}: ${fromSet.map((x) => `\`${x}\``).join(', ')}.`,
        ],
      };
    },
  },
  bank('facts', [
    {
      q: 'What does `stdenv.mkDerivation` return?',
      options: ['A derivation, the same kind `derivation` makes', 'A built store path', 'A shell script of build steps', 'The list of phases it will run'],
      why: ['Calling it only evaluates. Nothing is built until the derivation is realised.', 'The script is one part of what it sets up. What comes back is a derivation.', 'The phases are how the build runs. What comes back is a derivation.'],
      solution: ['`stdenv.mkDerivation` fills in attributes and calls `derivation`.', 'So what it returns is an ordinary derivation, which can be built like any other.'],
    },
    {
      q: 'A package\'s build runs `cmake`, and the result does not use it afterwards. Where does `cmake` go?',
      options: ['`nativeBuildInputs`', '`buildInputs`', '`src`', '`installPhase`'],
      why: ['`buildInputs` is for what the result links against.', '`src` is the source being built.', '`installPhase` is a step of the build, not a list of dependencies.'],
      solution: ['`nativeBuildInputs` holds programs the build runs.', '`cmake` is run by the build, so that is where it goes.'],
    },
    {
      q: 'A program links against `openssl`. Where does `openssl` go?',
      options: ['`buildInputs`', '`nativeBuildInputs`', '`patches`', 'Nowhere, the compiler finds system libraries'],
      why: ['`nativeBuildInputs` is for programs the build runs, not libraries the result links.', '`patches` holds changes to the source.', 'A sandboxed build has no system libraries to find. Dependencies are named.'],
      solution: ['`buildInputs` holds what the result links against.', 'So `openssl` goes there, and the compiler is told where to find it.'],
    },
    {
      q: 'You set `installPhase = \'\'cp hello \\$out/bin/\'\';`. What happens to the default `make install`?',
      options: ['It no longer runs: your phase replaces it', 'It runs first, then your commands', 'It runs after your commands', 'It runs only if `\\$out` is empty'],
      why: ['Setting a phase replaces it. Nothing keeps the default around.', 'Setting a phase replaces it. Nothing runs the default afterwards.', 'There is no fallback to the default.'],
      solution: ['Each phase is one attribute, and setting it replaces the default.', 'So `make install` does not run unless your commands run it.'],
    },
    {
      q: 'Why does the default `configurePhase` pass `--prefix=\\$out` to `./configure`?',
      options: ['So `make install` writes into this build\'s store path', 'So the compiler can find its headers', 'So Nix can find the source', 'So that the build runs in parallel'],
      why: ['Headers come from dependencies. `--prefix` says where the program is installed.', 'The source was unpacked already, before configure ran.', 'Parallel builds have nothing to do with the install prefix.'],
      solution: ['A program installs under the prefix it was configured with.', 'Passing `\\$out` makes that the store path this derivation is building.'],
    },
    {
      q: 'Your `installPhase` runs without error but never writes to `\\$out`. What happens?',
      options: ['The build fails: a builder must produce `\\$out`', 'Nix creates an empty `\\$out` for it', 'Nix falls back to `make install`', 'The source folder becomes `\\$out`'],
      why: ['Nix makes no empty output on your behalf. Producing it is the builder\'s job.', 'Setting a phase replaced the default. Nothing falls back.', 'Nix never turns the source into the output.'],
      solution: ['A builder\'s one duty is to create `\\$out`.', 'If the phases finish and it does not exist, the build fails.'],
    },
    {
      q: 'A package needs `cp hello \\$out/bin/` to run. Which phase is it part of?',
      options: ['`installPhase`', '`buildPhase`', '`unpackPhase`', '`checkPhase`'],
      why: ['`buildPhase` compiles. Nothing is placed in the output yet.', '`unpackPhase` only gets the source ready.', '`checkPhase` runs the tests.'],
      solution: ['Putting results into `\\$out` is what installing means.', 'So that command is `installPhase` work.'],
    },
    {
      q: 'A package file is `{ stdenv, fetchurl }: stdenv.mkDerivation { pname = "demo"; version = "1"; }`. When nixpkgs calls it with `callPackage`, where do the arguments come from?',
      options: ['`callPackage` looks each name up in nixpkgs', 'The file imports them itself', 'Nix searches `/usr` for them', 'The sandbox provides them'],
      why: ['The file only names what it needs, which is what makes it a function.', 'A package file never looks outside the store for its dependencies.', 'The sandbox is the build\'s environment. Arguments are passed during evaluation.'],
      solution: ['`callPackage` reads the names the function asks for.', 'It looks each up by name in nixpkgs and passes them in.'],
    },
    {
      q: 'Nixpkgs defines tens of thousands of packages in one set. Why does evaluating `pkgs.hello` finish in a moment?',
      options: ['Nix is lazy, so only what `hello` needs is evaluated', 'Nix caches every package ahead of time', 'Each package is evaluated in its own process', 'Packages in the set do not depend on each other'],
      why: ['No such cache is needed. Attributes that are never asked for are not evaluated.', 'Evaluation happens in one process, and it is laziness that keeps it small.', 'They do depend on each other. Laziness is what makes that possible.'],
      solution: ['An attribute in a set is worked out only when something asks for it.', 'Asking for `hello` forces its dependencies, and nothing else.'],
    },
    {
      q: 'You write `callPackage ./app.nix { zlib = my-zlib; }`, and nixpkgs also has `zlib`. Which one does the file get?',
      options: ['`my-zlib`, because the second set wins', 'The `zlib` from nixpkgs', 'Both, as a list', 'An error, because the name is taken'],
      why: ['The second set is there to replace what nixpkgs would pass.', 'One argument gets one value.', 'Replacing a value is what the second set is for.'],
      solution: ['`callPackage` fills arguments from nixpkgs, then applies your second set on top.', 'So your value wins.'],
    },
  ], 'nix'),
];
