import type { LectureScript } from '../../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-nix.store-paths',
  title: 'Store paths',
  model: 'kokoro',
  voice: 'af_heart',
  speed: 1,
  scenes: [
    {
      id: 'clash',
      title: 'One shared folder',
      codeTitle: 'needs.nix',
      lang: 'nix',
      code: `
        {
          app-one.needs = "openssl-3.4";  #@one
          app-two.needs = "openssl-1.1";  #@two
        }
      `,
      beats: [
        { id: 'two', say: 'Two programs need OpenSSL, but different versions of it. The first wants {3.4|three point four}. The second wants {1.1|one point one}.', code: ['one', 'two'] },
        { id: 'shared', say: 'Most systems keep libraries in one shared folder, like {/usr/lib|slash user slash lib}. That folder has one place for OpenSSL.' },
        { id: 'overwrite', say: 'Install {1.1|one point one}, and it replaces {3.4|three point four}. The second program works, and the first one breaks.', code: 'one' },
        { id: 'want', say: 'So we want something a shared folder cannot do: every version, kept at once.' },
      ],
    },
    {
      id: 'folder',
      title: 'A folder per build',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ nix eval --raw --expr 'builtins.toFile "greeting" "hello"'         #@cmd
        /nix/store/5akl8zsmda0yrr63v4khwgskih2g2hsh-greeting                 #@path
        $ ls -l /nix/store/5ak…-greeting                                     #@ls
        -r--r--r--  1 root  nixbld  5 Dec 31  1969 /nix/store/5ak…-greeting  #@mode
      `,
      beats: [
        { id: 'own', say: 'Nix gives every build its own folder, all of them under one directory: {/nix/store|slash nix slash store}.' },
        { id: 'make', say: 'The smallest way to make one is {builtins.toFile|built-ins dot to file}. It takes a name and some text, and writes the text into the store.', code: 'cmd' },
        { id: 'read', say: 'What comes back is a store path: the store, then a hash, which is a fixed-length fingerprint, then a dash and the name you gave it.', code: 'path' },
        { id: 'hash', say: 'The hash is always {32|thirty two} characters, in an alphabet of digits and letters with four missing: e, o, u and t.', code: 'path' },
        { id: 'ro', say: 'Once a path is in the store, it is read-only. Nix never changes it in place.', code: ['ls', 'mode'] },
      ],
    },
    {
      id: 'hash',
      title: 'Named by what went in',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ nix eval --raw --expr 'builtins.toFile "greeting" "hello"'   #@a
        /nix/store/5ak…-greeting                                       #@aout
        $ nix eval --raw --expr 'builtins.toFile "greeting" "hello!"'  #@b
        /nix/store/iad…-greeting                                       #@bout
        $ nix eval --raw --expr 'builtins.toFile "greeting" "hello"'   #@c
        /nix/store/5ak…-greeting                                       #@cout
      `,
      beats: [
        { id: 'from', say: 'That hash is not random. Nix computes it from everything that went into the path.', code: ['a', 'aout'] },
        { id: 'diff', say: 'Change one character of the input, and the hash comes out completely different.', code: ['b', 'bout'] },
        { id: 'side', say: 'So two versions of a library get two different folders. They sit side by side, and neither one can touch the other.' },
        { id: 'same', say: 'Now run the first one again. Same input, same path.', code: ['c', 'cout'] },
        { id: 'skip', say: 'That gives Nix a shortcut. If the path is already in the store, the work is done. If a shared cache has it, Nix fetches it and builds nothing.' },
      ],
    },
    {
      id: 'into',
      title: 'Putting a file in',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ echo hello > hello.txt                             #@file
        $ nix eval --impure --raw --expr '"\${./hello.txt}"'  #@eval
        /nix/store/i9p…-hello.txt                            #@out
      `,
      beats: [
        { id: 'file', say: 'You can put files of your own in the store, too. Here is a small one.', code: 'file' },
        { id: 'insert', say: 'Inside a string, a dollar sign and braces insert a value. Insert a local path, and Nix copies that file into the store, and the string becomes the new store path.', code: ['eval', 'out'] },
        { id: 'where', say: 'The hash follows the contents, not where the file came from. The same file from two folders lands at one store path.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
