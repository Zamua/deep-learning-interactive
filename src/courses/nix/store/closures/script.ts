import type { LectureScript } from '../../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-nix.closures',
  title: 'Closures',
  model: 'kokoro',
  voice: 'af_heart',
  speed: 1,
  scenes: [
    {
      id: 'needs',
      title: 'What a program leans on',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ nix-store --query --references ./result  #@cmd
        /nix/store/q3f…-openssl-3.4                #@ssl
        /nix/store/c8k…-zlib-1.3                   #@zlib
        /nix/store/m2p…-libssh2-1.11               #@ssh
      `,
      beats: [
        { id: 'ask', say: 'You built curl, and it runs. Copy just its folder to another machine, and it may not start at all.' },
        { id: 'lean', say: 'A program leans on other things: shared libraries, certificates, a shell. Most systems hope those are already there.' },
        { id: 'refs', say: 'Nix does not hope. For every store path, it records which other store paths that one points at. Those are its references.', code: 'cmd' },
        { id: 'list', say: 'Here is curl, with a few of its references: OpenSSL, zlib and {libssh2|lib S S H two}.', code: ['ssl', 'zlib', 'ssh'] },
      ],
    },
    {
      id: 'scan',
      title: 'How Nix finds them',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ strings result/bin/curl | grep /nix/store  #@cmd
        /nix/store/q3f…-openssl-3.4/lib              #@hit
        /nix/store/c8k…-zlib-1.3/lib                 #@hit
      `,
      beats: [
        { id: 'who', say: 'Nobody writes that list by hand. Nix finds it.' },
        { id: 'hash', say: 'Every input of a build has a hash in its store path, and hashes that long do not turn up by accident.', code: 'cmd' },
        { id: 'scan', say: 'So after a build, Nix reads the output, byte by byte, looking for the hash of each input.', code: 'cmd' },
        { id: 'hit', say: 'The hash of OpenSSL is inside the curl binary, so curl references OpenSSL.', code: 'hit' },
        { id: 'miss', say: 'The compiler was an input too, but its hash is nowhere in the result. It was needed to build curl, not to run it, so it is not a reference.' },
      ],
    },
    {
      id: 'closure',
      title: 'Follow every arrow',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ nix-store --query --requisites ./result  #@cmd
        /nix/store/w9d…-glibc-2.40                 #@all
        /nix/store/c8k…-zlib-1.3                   #@all
        /nix/store/q3f…-openssl-3.4                #@all
        /nix/store/m2p…-libssh2-1.11               #@all
        /nix/store/h7t…-curl-8.11                  #@all
      `,
      beats: [
        { id: 'more', say: 'References have references of their own. OpenSSL points at the C library, and so does zlib.' },
        { id: 'walk', say: 'Start at one path and follow every arrow, until there is nowhere new to go. Every path you touched, the start included, is its closure.' },
        { id: 'once', say: 'A path counts once, however many arrows reach it. The C library is one folder, shared by all of them.' },
        { id: 'cmd', say: 'Query requisites prints the closure.', code: 'cmd' },
        { id: 'count', say: 'For this small curl, that is five store paths.', code: 'all' },
      ],
    },
    {
      id: 'copy',
      title: 'The closure travels',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ nix copy --to ssh://server ./result  #@cmd
        copying 4 paths...                     #@out
      `,
      beats: [
        { id: 'whole', say: 'A closure is complete: nothing inside it points outside it.' },
        { id: 'unit', say: 'That makes it the thing you copy. Nix copy sends a path and everything in its closure.', code: 'cmd' },
        { id: 'skip', say: 'If the server already has a path, Nix skips it: the name says it is the same one. Here the C library stays put, and four paths go across.', code: 'out' },
        { id: 'run', say: 'Every reference still points at the same place under {/nix/store|slash nix slash store}, so curl runs there exactly as it ran here.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
