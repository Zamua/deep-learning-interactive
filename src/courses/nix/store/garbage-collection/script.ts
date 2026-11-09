import type { LectureScript } from '../../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-nix.garbage-collection',
  title: 'Garbage collection',
  model: 'kokoro',
  voice: 'af_heart',
  speed: 1,
  scenes: [
    {
      id: 'grows',
      title: 'A store that only grows',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ ls /nix/store | wc -l  #@cmd
            6318                 #@n
      `,
      beats: [
        { id: 'grow', say: 'Nothing in the store is ever changed, and nothing leaves on its own. Every build adds folders.' },
        { id: 'upgrade', say: 'Upgrade curl, and the new curl gets a new folder. The old one is still there.' },
        { id: 'count', say: 'Keep going, and it adds up. This machine has over six thousand paths.', code: ['cmd', 'n'] },
        { id: 'danger', say: 'But you cannot delete a folder because it looks old. Something may still point at it.' },
      ],
    },
    {
      id: 'roots',
      title: 'What must stay',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ nix-store --query --roots /nix/store/q3f…-openssl-3.4                                #@cmd
        /home/you/app/result -> /nix/store/h7t…-curl-8.11                                      #@res
        /nix/var/nix/profiles/per-user/you/profile-7-link -> /nix/store/r4n…-user-environment  #@prof
      `,
      beats: [
        { id: 'promise', say: 'So Nix starts from a list of what must stay. Each entry on it is a garbage collector root, or {GC root|G C root} for short.' },
        { id: 'result', say: 'Build something, and Nix leaves a link called result in your folder. That link is a root.' },
        { id: 'profile', say: 'A profile is the set of programs you have installed. Each time it changes, Nix keeps the old set as a numbered generation, and every generation is a root.' },
        { id: 'gcroots', say: 'The third kind is any link under {/nix/var/nix/gcroots|slash nix slash var slash nix slash G C roots}. Add one there, and you have made a root by hand.' },
        { id: 'query', say: 'Query roots tells you what is holding a path. Here, OpenSSL is held by a result link and by a generation.', code: ['cmd', 'res', 'prof'] },
      ],
    },
    {
      id: 'live',
      title: 'Follow the arrows',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ nix-store --query --requisites ./result  #@cmd
        /nix/store/w9d…-glibc-2.40                 #@all
        /nix/store/c8k…-zlib-1.3                   #@all
        /nix/store/q3f…-openssl-3.4                #@all
        /nix/store/h7t…-curl-8.11                  #@all
      `,
      beats: [
        { id: 'walk', say: 'To find what stays, start at each root and take its closure. Everything those walks reach is called live.' },
        { id: 'list', say: 'You already have the tool. Query requisites prints the closure of one root.', code: ['cmd', 'all'] },
        { id: 'rest', say: 'Whatever no walk reached is garbage. Here, that is the old curl and the old OpenSSL.' },
        { id: 'safe', say: 'Deleting garbage is safe, and you already know why. A closure is complete: nothing inside it points outside it. So nothing live can point at garbage.' },
      ],
    },
    {
      id: 'collect',
      title: 'Collecting',
      codeTitle: 'terminal',
      lang: 'shell',
      code: `
        $ nix-store --gc          #@gc
        $ nix-collect-garbage -d  #@d
      `,
      beats: [
        { id: 'held', say: 'Now say your previous generation still lists the old curl. A generation is a root, so the old curl is live.' },
        { id: 'gc', say: '{nix-store --gc|nix store dash dash G C} deletes whatever is not live. With that root in place, the old curl stays.', code: 'gc' },
        { id: 'd', say: '{nix-collect-garbage -d|nix collect garbage dash D} first deletes your old generations. That takes the roots away.', code: 'd' },
        { id: 'cost', say: 'Then it collects, and the old curl is gone. You get the space back, and you can no longer go back to those generations.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
