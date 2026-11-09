import type { CourseDef } from '../course';

export const course: CourseDef = {
  title: 'Nix',
  blurb: 'Builds that come out the same every time, and the language that describes them.',
  cover: '#35466b',
  idPrefix: 'nix.',
  domains: [
    { id: 'language', title: 'The language' },
    { id: 'store', title: 'The store' },
    { id: 'packages', title: 'Packages' },
    { id: 'flakes', title: 'Flakes' },
  ],
};
