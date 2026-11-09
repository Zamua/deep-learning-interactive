import type { LectureScript } from '../../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-nix.laziness',
  title: 'let and laziness',
  model: 'kokoro',
  voice: 'af_heart',
  speed: 1,
  scenes: [
    {
      id: 'big',
      title: 'Naming things, in any order',
      codeTitle: 'nix eval',
      lang: 'nix',
      code: `
        let          #@let
          b = a + 1; #@b
          a = 1;     #@a
        in           #@in
          a + b      #@body
        # 3          #@out
      `,
      beats: [
        { id: 'big', say: 'The Nix package collection is one enormous expression, with a huge number of packages defined inside it.' },
        { id: 'ask', say: 'You ask it for one package, and it answers in moments. To see how, we need one more piece of the language.' },
        { id: 'let', say: 'The word let gives names to values, and those names exist only in the expression after the word in.', code: ['let', 'in', 'body'] },
        { id: 'order', say: 'The bindings can use each other, in any order. Here b uses a, and a is written after it.', code: ['b', 'a'] },
        { id: 'value', say: 'These are not steps to run from the top. They are definitions. And the result is three.', code: 'out' },
      ],
    },
    {
      id: 'lazy',
      title: 'Nothing runs until asked',
      codeTitle: 'nix eval',
      lang: 'nix',
      code: `
        let x = throw "boom"; in 1                       #@let
        # 1                                              #@let

        { a = 1; b = throw "boom"; }.a                   #@sel
        # 1                                              #@sel

        { a = 1; b = throw "boom"; }.b                   #@bang
        # error: boom                                    #@bang

        builtins.attrNames { a = 1; b = throw "boom"; }  #@names
        # [ "a" "b" ]                                    #@names

        builtins.length [ 1 (throw "boom") 3 ]           #@len
        # 3                                              #@len
      `,
      beats: [
        { id: 'throw', say: 'The function throw stops evaluation with an error. At least, it does when it runs.' },
        { id: 'let', say: 'Here x is a throw, and the whole expression is still one. Nothing asked for x, so Nix never worked it out.', code: 'let' },
        { id: 'thunk', say: 'A binding holds a promise of its value: how to compute it, if anyone ever needs it. That promise is called a thunk.', code: 'let' },
        { id: 'set', say: 'Sets work the same way. One value here is a throw, and selecting the other is fine.', code: 'sel' },
        { id: 'bang', say: 'Select the throw itself, and that is when it goes off.', code: 'bang' },
        { id: 'names', say: '{builtins.attrNames|built-ins dot attr names} reads only the names, so the values stay untouched.', code: 'names' },
        { id: 'len', say: 'And a list knows its length without computing what is in it.', code: 'len' },
      ],
    },
    {
      id: 'self',
      title: 'A value that needs itself',
      codeTitle: 'nix eval',
      lang: 'nix',
      code: `
        let x = { y = 1; z = x.y + 1; }; in x.z   #@ok
        # 2                                       #@ok

        rec { a = b + 1; b = 2; }.a               #@rec
        # 3                                       #@rec

        let x = x + 1; in x                       #@bad
        # error: infinite recursion encountered   #@bad
      `,
      beats: [
        { id: 'how', say: 'Values wait, so a binding can mention a name whose value is not worked out yet. It can even mention the set it is in.' },
        { id: 'ok', say: 'Here z reads {x.y|x dot y} out of its own set. That works: computing z needs only y, and y is there.', code: 'ok' },
        { id: 'rec', say: '{rec|Reck}, from before, relies on the same thing. The value of a waits until something asks, and then b is there.', code: 'rec' },
        { id: 'bad', say: 'The trouble starts only when a value truly needs itself. To get x, Nix has to get x first.', code: 'bad' },
        { id: 'err', say: 'There is no way out of that, and Nix stops with infinite recursion.', code: 'bad' },
      ],
    },
    {
      id: 'pkgs',
      title: 'One set, thousands of packages',
      codeTitle: 'nix eval',
      lang: 'nix',
      code: `
        let
          pkgs = {                              #@pkgs
            curl = { deps = [ pkgs.zlib ]; };   #@curl
            zlib = { deps = [ ]; };             #@zlib
            broken = throw "does not build";    #@broken
          };                                    #@pkgs
        in pkgs.curl                            #@ask
        # { deps = [ { deps = [ ]; } ]; }       #@ask
      `,
      beats: [
        { id: 'mini', say: 'Here is the package collection in miniature: one big set, where each package is a value that can name the others.', code: 'pkgs' },
        { id: 'ask', say: 'Ask for curl, and Nix works out curl. Curl needs zlib, so zlib is worked out too.', code: ['ask', 'curl', 'zlib'] },
        { id: 'broken', say: 'The broken package sits in the same set, and it does no harm. Nobody asked for it.', code: 'broken' },
        { id: 'scale', say: 'Scale that up. The collection can define every package it has, and Nix computes only the ones you ask for, and what those need.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
