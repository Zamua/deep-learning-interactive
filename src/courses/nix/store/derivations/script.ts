import type { LectureScript } from '../../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-nix.derivations',
  title: 'Derivations',
  model: 'kokoro',
  voice: 'af_heart',
  speed: 1,
  scenes: [
    {
      id: 'recipe',
      title: 'A precise recipe',
      codeTitle: 'hello.nix',
      lang: 'nix',
      code: `
        derivation {                         #@fn
          name = "hello";                    #@name
          system = builtins.currentSystem;   #@system
          builder = "/bin/sh";               #@builder
          args = [ "-c" "echo hi > $out" ];  #@args
        }
      `,
      beats: [
        { id: 'problem', say: 'A store path is named by what went into it. So before Nix can name a build, every input has to be written down.' },
        { id: 'recipe', say: 'That written-down recipe is a derivation. You make one by calling a function, also named derivation, with an attribute set.', code: 'fn' },
        { id: 'name', say: 'The name goes on the end of the store path.', code: 'name' },
        { id: 'system', say: 'The system says what kind of machine can run this build. Here, it is the one you are on.', code: 'system' },
        { id: 'builder', say: 'The builder is the program to run, and args are what it gets. Here a shell runs one line.', code: ['builder', 'args'] },
      ],
    },
    {
      id: 'stages',
      title: 'Two stages',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ nix eval --impure --raw -f hello.nix drvPath        #@dcmd
        /nix/store/myp…-hello.drv                             #@dout
        $ nix eval --impure --raw -f hello.nix outPath        #@ocmd
        /nix/store/k6l…-hello                                 #@oout
        $ ls /nix/store/k6l…-hello                            #@ls
        ls: /nix/store/k6l…-hello: No such file or directory  #@none
        $ nix-store --realise /nix/store/myp…-hello.drv       #@real
      `,
      beats: [
        { id: 'eval', say: 'Evaluate that, and nothing gets built. Nix writes the recipe into the store, as a file ending in {.drv|dot D R V}. That step is called instantiating.', code: ['dcmd', 'dout'] },
        { id: 'know', say: 'And Nix already knows the output path. It comes from the recipe, so there is no need to wait for a result.', code: ['ocmd', 'oout'] },
        { id: 'none', say: 'That path has a name, but nothing is there yet.', code: ['ls', 'none'] },
        { id: 'realise', say: 'The second stage is called realising. It runs the recipe, and fills in that path.', code: 'real' },
      ],
    },
    {
      id: 'build',
      title: 'Sealed off',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ nix-store --query --binding out /nix/store/myp…-hello.drv  #@cmd
        /nix/store/k6l…-hello                                        #@out
      `,
      beats: [
        { id: 'out', say: 'The builder has to put its result somewhere. Nix hands it the path in a variable called {$out|dollar out}, and the builder must write there.', code: ['cmd', 'out'] },
        { id: 'sealed', say: 'The build runs sealed off, in what Nix calls a sandbox. On Linux, that is the default.' },
        { id: 'no', say: 'It has no network. It cannot see your home folder, or {/usr/lib|slash user slash lib}.' },
        { id: 'only', say: 'It sees the store paths the recipe declares, and a temporary folder to work in.' },
        { id: 'trust', say: 'Nothing went into the result that the recipe does not name. That is why a path named from the recipe can be trusted.' },
      ],
    },
    {
      id: 'string',
      title: 'One recipe uses another',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ cat world.nix                                             #@cat
        derivation {
          name = "world";
          system = builtins.currentSystem;
          builder = "/bin/sh";
          args = [ "-c" "cat \${import ./hello.nix} > $out" ];       #@use
        }
        $ nix eval --impure --raw -f world.nix drvPath              #@eval
        /nix/store/3m2…-world.drv                                   #@drv
        $ nix-store --query --references /nix/store/3m2…-world.drv  #@refs
        /nix/store/myp…-hello.drv                                   #@ref
      `,
      beats: [
        { id: 'need', say: 'Now a second recipe needs the output of the first. Import reads another file and gives back its value, and here that value is the first derivation.', code: 'use' },
        { id: 'insert', say: 'Insert a derivation into a string with a dollar sign and braces, and you get its output path.', code: 'use' },
        { id: 'context', say: 'But the string also carries something you cannot see: a note that it depends on that derivation. Nix calls this string context.' },
        { id: 'record', say: 'Hand that string to a new recipe, and the note becomes part of it. Ask the new {.drv|dot D R V} what it depends on, and there is the first one.', code: ['refs', 'ref'] },
        { id: 'order', say: 'So Nix knows to realise hello first and world second, and nobody had to tell it.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
