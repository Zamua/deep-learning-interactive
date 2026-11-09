import type { LectureScript } from '../../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-nix.dev-shells',
  title: 'Dev shells',
  model: 'kokoro',
  voice: 'af_heart',
  speed: 1,
  scenes: [
    {
      id: 'onboard',
      title: 'Works on my machine',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ go version                     #@go
        go version go1.21.5 linux/amd64  #@go
        $ node --version                 #@node
        v20.15.0                         #@node
      `,
      beats: [
        { id: 'join', say: 'A teammate joins your project. The readme says: install Go and Node, then run the tests.' },
        { id: 'mine', say: 'You have one Go and one Node. They install newer ones. It happens to work for both of you.', code: ['go', 'node'] },
        { id: 'break', say: 'Then the build server, with an older Node, fails on code that passes for you both.' },
        { id: 'global', say: 'The tools were installed by hand, for the whole machine, so every machine drifts its own way.' },
        { id: 'want', say: 'You want the project to say which tools it needs, and everyone to get exactly those.' },
      ],
    },
    {
      id: 'mkshell',
      title: 'A shell as a flake output',
      codeTitle: 'flake.nix',
      lang: 'nix',
      code: `
        {
          inputs.nixpkgs.url =
            "github:NixOS/nixpkgs/nixos-unstable";
          outputs = { self, nixpkgs }:
            let pkgs = nixpkgs.legacyPackages.x86_64-linux;
            in {
              devShells.x86_64-linux.default = pkgs.mkShell {  #@shell
                packages = [ pkgs.go pkgs.nodejs ];            #@pkgs
                shellHook = "echo go and node are ready";      #@hook
              };
            };
        }
      `,
      beats: [
        { id: 'shell', say: 'A flake can say that. Beside packages, it can have a {devShells|dev shells} output: a development environment for each system.', code: 'shell' },
        { id: 'mk', say: '{mkShell|Make shell} is a small wrapper around {mkDerivation|make derivation}. It gives you an environment to enter, not a package to install.', code: 'shell' },
        { id: 'pkgs', say: 'Packages lists the tools you want on {PATH|path}. Here, Go and Node.', code: 'pkgs' },
        { id: 'hook', say: '{shellHook|Shell hook} is a bit of bash that runs each time someone enters.', code: 'hook' },
      ],
    },
    {
      id: 'enter',
      title: 'In and out',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ nix develop                     #@enter
        go and node are ready             #@hook
        $ which go                        #@which
        /nix/store/k4d…-go-1.24.2/bin/go  #@path
        $ exit                            #@exit
        exit                              #@exit
        $ go version                      #@gone
        bash: go: command not found       #@gone
      `,
      beats: [
        { id: 'enter', say: '{nix develop|Nix develop} reads that output and drops you into a new shell.', code: 'enter' },
        { id: 'hook', say: 'Your hook runs first.', code: 'hook' },
        { id: 'where', say: 'Go is on {PATH|path} now, and it comes from the store. It is an ordinary store path, like any other.', code: ['which', 'path'] },
        { id: 'nothing', say: 'Nothing was installed globally. Another terminal, open at this moment, has no Go at all.' },
        { id: 'exit', say: 'Leave the shell, and Go is gone from your environment.', code: ['exit', 'gone'] },
        { id: 'stay', say: 'But the store path has not gone anywhere. Next time you enter, it is already there, and the shell starts at once.' },
      ],
    },
    {
      id: 'team',
      title: 'One tool, one team, one catch',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ nix shell nixpkgs#ripgrep             #@one
        $ which rg                              #@one
        /nix/store/v9c…-ripgrep-14.1.1/bin/rg   #@one
        $ exit                                  #@one
        $ nix store gc                          #@gc
        $ nix develop --profile ./.dev-profile  #@root
      `,
      beats: [
        { id: 'one', say: 'For one tool, once, there is {nix shell|nix shell}. It puts {ripgrep|rip grep} on {PATH|path}, and that is all.', code: 'one' },
        { id: 'diff', say: '{nix develop|Nix develop} is for a project: the tools it lists, plus everything a build of it would have.' },
        { id: 'team', say: 'And since the flake has a lockfile, everyone on the project gets the same versions of all of it.' },
        { id: 'gc', say: 'One catch. Garbage collection deletes store paths that nothing needs any more, and {nix store gc|nix store G C} runs it. Your shell\'s tools are ordinary store paths, so they can go too.', code: 'gc' },
        { id: 'root', say: 'A root is something that tells the collector to keep a path. {--profile|Dash dash profile} saves the environment to a file that acts as one.', code: 'root' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
