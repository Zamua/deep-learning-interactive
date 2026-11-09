import type { LectureScript } from '../../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-nix.mkderivation',
  title: 'mkDerivation',
  model: 'kokoro',
  voice: 'af_heart',
  speed: 1,
  scenes: [
    {
      id: 'bare',
      title: 'What a derivation leaves to you',
      codeTitle: 'hello.nix',
      lang: 'nix',
      code: `
        derivation {                                       #@head
          name = "hello-2.12";                             #@head
          system = "x86_64-linux";                         #@head
          builder = "\${bash}/bin/bash";                    #@head
          args = [ "-c" ''
            PATH=\${gcc}/bin:\${gnumake}/bin:\${binutils}/bin  #@path
            PATH=$PATH:\${coreutils}/bin:\${gnutar}/bin       #@path
            PATH=$PATH:\${gzip}/bin:\${gnused}/bin            #@path
            PATH=$PATH:\${gnugrep}/bin:\${gawk}/bin           #@path
            tar xf \${src}                                    #@steps
            cd hello-2.12                                    #@steps
            ./configure --prefix=$out                        #@steps
            make                                             #@steps
            make install                                     #@steps
          '' ];
        }
      `,
      beats: [
        { id: 'ask', say: 'Say you want to package GNU Hello, a small C program, using only the derivation you know.', code: 'head' },
        { id: 'tools', say: 'The sandbox starts nearly empty. So you must hand it a compiler, make, tar, sed, grep, awk and more, each by its store path.', code: 'path' },
        { id: 'steps', say: 'Then you spell out every step yourself: unpack, configure, compile, install.', code: 'steps' },
        { id: 'again', say: 'And the next C program needs all of it again. Thousands of packages, repeating the same lines.' },
      ],
    },
    {
      id: 'wrap',
      title: 'What stdenv adds',
      codeTitle: 'hello.nix',
      lang: 'nix',
      code: `
        stdenv.mkDerivation {                            #@call
          pname = "hello";                               #@name
          version = "2.12";                              #@name
          src = fetchurl {                               #@src
            url = "mirror://gnu/hello/hello-2.12.tar.gz";  #@src
            hash = "sha256-…";                           #@src
          };                                             #@src
          nativeBuildInputs = [ pkg-config ];            #@native
          buildInputs = [ zlib ];                        #@link
        }
      `,
      beats: [
        { id: 'stdenv', say: '{Nixpkgs|Nix packages}, the big collection of package recipes, has a fix. Its standard environment, {stdenv|standard env}, bundles a compiler, make and the small tools, with a script that knows the usual steps.' },
        { id: 'call', say: 'Its function {mkDerivation|make derivation} takes an attribute set and calls derivation for you. What comes back is still an ordinary derivation.', code: 'call' },
        { id: 'name', say: '{pname|P name} and version join up into the name, {hello-2.12|hello dash two point twelve}.', code: 'name' },
        { id: 'src', say: '{src|source} says where the code comes from. {fetchurl|fetch U R L} downloads it, and the hash says exactly what must arrive.', code: 'src' },
        { id: 'native', say: 'Two lists name your dependencies. {nativeBuildInputs|native build inputs} holds programs the build runs, like {pkg-config|package config}. They go on {PATH|path} during the build.', code: 'native' },
        { id: 'link', say: '{buildInputs|build inputs} holds what the result links against, like zlib. The compiler is told where to find it.', code: 'link' },
      ],
    },
    {
      id: 'phases',
      title: 'Seven phases',
      codeTitle: 'hello.nix',
      lang: 'nix',
      code: `
        stdenv.mkDerivation {
          pname = "hello";
          version = "2.12";
          src = fetchurl {
            url = "mirror://gnu/hello/hello-2.12.tar.gz";
            hash = "sha256-…";
          };
          installPhase = ''                #@over
            mkdir -p $out/bin              #@mk
            cp hello $out/bin/             #@mk
          '';                              #@over
        }
      `,
      beats: [
        { id: 'order', say: 'That script runs a build in phases, always in the same order. Unpack, patch, configure, build, check, install, fixup.' },
        { id: 'dance', say: 'The defaults are the classic Unix dance: {./configure|dot slash configure}, then make, then make install.' },
        { id: 'out', say: 'Configure is told to install under {$out|dollar out}, so make install lands in your store path.' },
        { id: 'fixup', say: 'Fixup tidies the result: it strips binaries, and points scripts at interpreters in the store.' },
        { id: 'over', say: 'When a default is wrong for your package, set that phase yourself. Two single quotes start a multi-line string, and this one replaces make install.', code: 'over' },
        { id: 'mk', say: 'Your commands have the same duty as any builder: put the result in {$out|dollar out}.', code: 'mk' },
      ],
    },
    {
      id: 'callpackage',
      title: 'A function of its dependencies',
      codeTitle: 'pkgs/hello.nix',
      lang: 'nix',
      code: `
        { stdenv, fetchurl }:                  #@args
        stdenv.mkDerivation {
          pname = "hello";
          version = "2.12";
          src = fetchurl {
            url = "mirror://gnu/hello/hello-2.12.tar.gz";
            hash = "sha256-…";
          };
        }

        # in nixpkgs, one big attribute set:   #@set
        hello = callPackage ./pkgs/hello.nix { };  #@call
      `,
      beats: [
        { id: 'fn', say: 'A package file does not reach out for what it needs. It is a function: it takes its dependencies as arguments, and returns a derivation.', code: 'args' },
        { id: 'set', say: '{Nixpkgs|Nix packages} is one enormous attribute set, with every package under its name.', code: 'set' },
        { id: 'call', say: '{callPackage|call package} reads the names the function asks for, finds each one in that set, and passes it in.', code: 'call' },
        { id: 'over', say: 'The empty set at the end is for your own choices. Name an argument there, and your value wins over {nixpkgs|nix packages}.', code: 'call' },
        { id: 'knot', say: 'Notice that hello sits in the same set it takes its arguments from. The set refers to itself.' },
        { id: 'lazy', say: 'Laziness is what makes that work. Asking for hello works out only what hello needs, and the rest of the set stays unevaluated.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
