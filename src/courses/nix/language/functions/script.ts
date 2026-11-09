import type { LectureScript } from '../../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-nix.functions',
  title: 'Functions',
  model: 'kokoro',
  voice: 'af_heart',
  speed: 1,
  scenes: [
    {
      id: 'hole',
      title: 'A package with a hole in it',
      codeTitle: 'nix eval',
      lang: 'nix',
      code: `
        { name = "hello"; zlib = "zlib-1.3"; }  #@fixed

        x: x + 1                                #@fn

        (x: x + 1) 41                           #@call
        # 42                                    #@out
      `,
      beats: [
        { id: 'fixed', say: 'This hello is tied to one zlib, a compression library. To build it against another zlib, you would copy the whole set and change one line.', code: 'fixed' },
        { id: 'hole', say: 'What you want is a package with a hole in it, to fill in later. That is a function.', code: 'fixed' },
        { id: 'syntax', say: 'A function is a name for its argument, a colon, and a body. {x: x + 1|x colon x plus one} takes x and returns x plus one.', code: 'fn' },
        { id: 'call', say: 'To call a function, write the argument after it, with a space between. The parentheses here only mark where the function ends.', code: 'call' },
        { id: 'value', say: '{41|Forty one} goes in, and {42|forty two} comes out.', code: 'out' },
      ],
    },
    {
      id: 'curry',
      title: 'Two arguments, one at a time',
      codeTitle: 'nix eval',
      lang: 'nix',
      code: `
        rec {
          add = a: b: a + b;                       #@add
          addTwo = add 2;                          #@partial
          five = add 2 3;                # 5       #@space
          out = map (add 10) [ 1 2 3 ];  # [ 11 12 13 ]  #@map
        }
      `,
      beats: [
        { id: 'only', say: 'A Nix function takes exactly one argument. So how do you add two numbers?' },
        { id: 'nest', say: 'You return another function. {a: b: a + b|a colon b colon a plus b} takes a, and gives back a function that takes b.', code: 'add' },
        { id: 'partial', say: 'So {add 2|add two} is already a value: a function waiting for b. Giving only the first argument is called partial application.', code: 'partial' },
        { id: 'space', say: 'And {add 2 3|add two three} is two calls, left to right: add two, then apply what comes back to three.', code: 'space' },
        { id: 'map', say: 'Partial application goes well with map. It takes a function and a list, which is values in square brackets with spaces between, and applies the function to each one.', code: 'map' },
      ],
    },
    {
      id: 'pattern',
      title: 'Arguments by name',
      codeTitle: 'nix eval',
      lang: 'nix',
      code: `
        rec {
          pkg = { name, version ? "1.0" }:                #@pat
            name + "-" + version;                         #@pat
          a = pkg { name = "hello"; };                    #@a
          # "hello-1.0"                                   #@a
          b = pkg { version = "2.12"; };                  #@b
          # error: … without required argument 'name'     #@b
          c = pkg { name = "hello"; license = "gpl3"; };  #@c
          # error: … with unexpected argument 'license'   #@c
          all = args@{ name, ... }: args.license;         #@all
          d = all { name = "hello"; license = "gpl3"; };  #@all
          # "gpl3"                                        #@all
        }
      `,
      beats: [
        { id: 'named', say: 'Packages have many inputs, and you could never remember their order. So a package takes one argument, a set, and the inputs go in by name.', code: 'pat' },
        { id: 'pattern', say: 'A set pattern, before the colon, lists the names the function expects. Each name becomes a variable in the body.', code: 'pat' },
        { id: 'default', say: 'In a pattern, a question mark gives a default, used when the caller leaves that name out. Version falls back to {1.0|one point oh}.', code: 'a' },
        { id: 'missing', say: 'Leave out a name with no default, and the call fails, telling you which name.', code: 'b' },
        { id: 'extra', say: 'Pass a name the pattern does not list, and that fails too.', code: 'c' },
        { id: 'dots', say: 'Three dots allow extras. And {args@|args at} in front names the whole set, so you can still reach them.', code: 'all' },
      ],
    },
    {
      id: 'deps',
      title: 'A package is a function',
      codeTitle: 'nix eval',
      lang: 'nix',
      code: `
        rec {
          hello = { cc, zlib }:                                #@pat
            { name = "hello"; deps = [ cc zlib ]; };           #@pat
          a = hello { cc = "gcc"; zlib = "zlib"; };            #@gcc
          # { deps = [ "gcc" "zlib" ]; name = "hello"; }       #@gcc
          b = hello { cc = "clang"; zlib = "zlib"; };          #@clang
          # { deps = [ "clang" "zlib" ]; name = "hello"; }     #@clang
        }
      `,
      beats: [
        { id: 'shape', say: 'Now write hello as a function. Its arguments are what it depends on, and its body describes a build.', code: 'pat' },
        { id: 'gcc', say: 'Call it with {gcc|G C C}, a compiler, and zlib, and you get one build.', code: 'gcc' },
        { id: 'clang', say: 'Call the same function with clang, and you get another. The package was not copied or changed.', code: 'clang' },
        { id: 'whole', say: 'That is the usual shape of a Nix package: a function from its dependencies to a build.', code: 'pat' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
