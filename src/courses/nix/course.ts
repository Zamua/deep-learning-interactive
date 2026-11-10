import type { CourseDef } from '../course';

export const course: CourseDef = {
  title: 'Nix',
  blurb: 'Builds that come out the same every time, and the language that describes them.',
  about: [
    'A small functional language, a store that never overwrites, and the idea that a build is a pure function of its inputs.',
    'Four chapters take you from reading an expression to writing a flake you would trust on a machine you care about.',
  ],
  cover: '#35466b',
  idPrefix: 'nix.',
  domains: [
    { id: 'language', title: 'The language', color: 'blue' },
    { id: 'store', title: 'The store', color: 'purple' },
    { id: 'packages', title: 'Packages', color: 'gold' },
    { id: 'flakes', title: 'Flakes', color: 'teal' },
  ],
};
