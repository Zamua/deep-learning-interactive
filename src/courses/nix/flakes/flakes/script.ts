import type { LectureScript } from '../../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-nix.flakes',
  title: 'Flakes',
  model: 'kokoro',
  voice: 'af_heart',
  speed: 1,
  scenes: [
    {
      id: 'drift',
      title: 'The same file, two results',
      codeTitle: 'hello.nix',
      lang: 'nix',
      code: `
        let
          pkgs = import <nixpkgs> { };  #@angle
        in
        pkgs.hello                      #@hello
      `,
      beats: [
        { id: 'file', say: 'Here is a short file that gives you GNU Hello from {nixpkgs|nix packages}. It looks complete.', code: 'hello' },
        { id: 'angle', say: 'But look at the name in angle brackets. That name is not in the file. Nix looks it up on this machine.', code: 'angle' },
        { id: 'channel', say: 'It finds a channel: a copy of {nixpkgs|nix packages} this machine last updated whenever somebody got round to it.' },
        { id: 'two', say: 'So a laptop updated in March and a server updated in June read the same file, and build different things.' },
        { id: 'want', say: 'What you want is a file that says exactly which {nixpkgs|nix packages} it means.' },
      ],
    },
    {
      id: 'shape',
      title: 'What a flake is',
      codeTitle: 'flake.nix',
      lang: 'nix',
      code: `
        {
          description = "Hello, packaged";                  #@desc
          inputs.nixpkgs.url =                              #@inputs
            "github:NixOS/nixpkgs/nixos-unstable";          #@inputs
          outputs = { self, nixpkgs }:                      #@outputs
            let pkgs = nixpkgs.legacyPackages.x86_64-linux; #@pkgs
            in {
              packages.x86_64-linux.default = pkgs.hello;   #@pkg
            };
        }
      `,
      beats: [
        { id: 'file', say: 'A flake is a folder with a file called {flake.nix|flake dot nix}. That file is an attribute set with three parts, and the first is a description.', code: 'desc' },
        { id: 'inputs', say: 'Inputs says what the flake depends on, by {URL|U R L}. This one is a branch of {nixpkgs|nix packages} on GitHub.', code: 'inputs' },
        { id: 'outputs', say: 'Outputs is a function. Nix fetches every input and passes them in by name. {self|Self} is the flake itself.', code: 'outputs' },
        { id: 'set', say: '{legacyPackages|Legacy packages} is where {nixpkgs|nix packages} keeps its packages, one set per system. The odd name is only history.', code: 'pkgs' },
        { id: 'ret', say: 'The function returns an attribute set. A package goes under packages, then its system, then a name.', code: 'pkg' },
        { id: 'known', say: 'That shape is the same in every flake, so tools know where to look. {nix build .#default|Nix build dot hash default} builds exactly that attribute.' },
      ],
    },
    {
      id: 'lock',
      title: 'The lockfile',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ jq .nodes.nixpkgs.locked flake.lock  #@cmd
        {
          "lastModified": 1787135253,
          "narHash": "sha256-RD2k…",           #@hash
          "owner": "NixOS",
          "repo": "nixpkgs",
          "rev": "ffb3c9b…",                   #@rev
          "type": "github"
        }
        $ nix flake update                     #@update
      `,
      beats: [
        { id: 'first', say: 'A branch moves. So the first time you use a flake, Nix turns that branch into one exact commit, and writes it in {flake.lock|flake dot lock}.', code: 'cmd' },
        { id: 'rev', say: 'Here is the pin. {rev|Rev} is the exact commit.', code: 'rev' },
        { id: 'hash', say: '{narHash|N A R hash} is a hash of what that commit contains, so a download that differs is rejected.', code: 'hash' },
        { id: 'commit', say: 'You commit this file to git, next to {flake.nix|flake dot nix}. Now everyone who checks out the repository evaluates against the same {nixpkgs|nix packages}.' },
        { id: 'moves', say: 'The branch keeps moving, and your builds stay exactly where they were.' },
        { id: 'update', say: 'When you want newer packages, {nix flake update|nix flake update} moves the pin. It is a change you choose, and commit.', code: 'update' },
      ],
    },
    {
      id: 'pure',
      title: 'Only what the flake can name',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ git init && nix build .#default                                    #@err
        error: Path 'flake.nix' in the repository "/src/app" is not tracked by Git.  #@err

               To make it visible to Nix, run:                               #@err

               git -C "/src/app" add -N "flake.nix"                          #@err
        $ git add flake.nix                                                  #@add
        $ nix build .#default                                                #@build
        $ ./result/bin/hello                                                 #@build
        Hello, world!                                                        #@build
        $ nix run github:owner/repo                                          #@run
      `,
      beats: [
        { id: 'err', say: 'Here is the classic surprise. In a git repository this fails, with {flake.nix|flake dot nix} sitting right there.', code: 'err' },
        { id: 'tracked', say: 'A flake only sees files git tracks. A file git does not know about does not exist, as far as Nix is concerned.' },
        { id: 'why', say: 'That is on purpose. A stray local file can never slip into a build nobody else can reproduce.' },
        { id: 'build', say: 'Add the file and it builds. {.#default|Dot hash default} means the flake in this folder, and its output called default.', code: ['add', 'build'] },
        { id: 'run', say: 'A flake can live anywhere. {nix run github:owner/repo|Nix run, then a GitHub address} fetches one, builds it and runs it.', code: 'run' },
        { id: 'pure', say: 'Evaluation is pure as well. Inside a flake there is no {<nixpkgs>|nix packages in angle brackets}, no {builtins.currentSystem|current system}, and environment variables read as empty.' },
        { id: 'end', say: 'So what a flake builds depends only on its tracked files and its pinned inputs, and those are the same on every machine.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
