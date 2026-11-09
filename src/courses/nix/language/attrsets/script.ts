import type { LectureScript } from '../../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-nix.attrsets',
  title: 'Attribute sets',
  model: 'kokoro',
  voice: 'af_heart',
  speed: 1,
  scenes: [
    {
      id: 'facts',
      title: 'A package is named facts',
      codeTitle: 'nix eval',
      lang: 'nix',
      code: `
        {                             #@set
          name = "hello";             #@name,set
          version = "2.12";           #@ver,set
          src = "hello-2.12.tar.gz";  #@src,set
        }                             #@set

        # without the last semicolon:                         #@semi
        # { version = "2.12" }                                #@semi
        # error: syntax error, unexpected '}', expecting ';'  #@semi

        { name = "hello"; version = "2.12"; }.version  #@dot
        # "2.12"                                       #@dot
      `,
      beats: [
        { id: 'ask', say: 'A build tool has to be told things. What is this program called? Which version? Where is its source?' },
        { id: 'facts', say: 'Put together, a package is a bundle of named facts.', code: ['name', 'ver', 'src'] },
        { id: 'compute', say: 'And the facts are connected. The file name repeats the version, and other packages will need this one. Fixed text cannot say that, so Nix has a small language of its own.', code: ['ver', 'src'] },
        { id: 'set', say: 'Its main shape is the attribute set: names, each bound to a value, between curly braces. Nix evaluates an expression like this, which means it works out its value.', code: 'set' },
        { id: 'semi', say: 'A semicolon ends every binding, the last one too. Leave one out and Nix stops with a syntax error.', code: 'semi' },
        { id: 'dot', say: 'A dot selects one value. {.version|dot version} gives {2.12|two point one two}, and the comment underneath shows what Nix printed.', code: 'dot' },
      ],
    },
    {
      id: 'reach',
      title: 'Reaching inside',
      codeTitle: 'nix eval',
      lang: 'nix',
      code: `
        { meta.license = "gpl3"; }                #@sugar
        # { meta = { license = "gpl3"; }; }       #@sugar

        { meta.license = "gpl3"; }.meta.license   #@walk
        # "gpl3"                                  #@walk

        { name = "hello"; }.version               #@miss
        # error: attribute 'version' missing      #@miss

        { name = "hello"; }.version or "1.0"      #@or
        # "1.0"                                   #@or

        { name = "hello"; } ? version             #@has
        # false                                   #@has
      `,
      beats: [
        { id: 'nest', say: 'A value can be another set. Packages keep their extra facts in one, usually called meta.' },
        { id: 'sugar', say: 'A dotted name on the left is shorthand for that nesting. Write {meta.license|meta dot license}, and Nix builds the inner set for you.', code: 'sugar' },
        { id: 'walk', say: 'Selection walks the same path, one dot at a time.', code: 'walk' },
        { id: 'miss', say: 'Ask for a name that is not there, and evaluation stops with an error.', code: 'miss' },
        { id: 'or', say: 'The word or gives a fallback instead. If the name is missing, you get what comes after it.', code: 'or' },
        { id: 'has', say: 'A question mark only asks: is this name in the set? You get true or false.', code: 'has' },
      ],
    },
    {
      id: 'merge',
      title: 'Merging two sets',
      codeTitle: 'nix eval',
      lang: 'nix',
      code: `
        { name = "hello"; version = "2.12"; }                #@left
        // { version = "2.13"; dev = true; }                 #@right
        # { dev = true; name = "hello"; version = "2.13"; }  #@out

        { meta.tag = "cli"; meta.lic = "gpl3"; }             #@nest
        // { meta.tag = "gui"; }                             #@nest
        # { meta = { tag = "gui"; }; }                       #@nout

        builtins.attrNames { version = 1; name = 2; }        #@names
        # [ "name" "version" ]                               #@names
      `,
      beats: [
        { id: 'over', say: 'Often you want the same package with one fact changed: hello, at a newer version.', code: 'left' },
        { id: 'update', say: 'The {//|double slash} operator merges two sets: the whole left one, with the right one laid over it.', code: ['left', 'right'] },
        { id: 'wins', say: 'A name that is on both sides takes the value from the right. Names on only one side come through unchanged.', code: 'out' },
        { id: 'top', say: 'But only the top level merges. Meta is one name here, so the right side\'s meta replaces the left side\'s meta whole.', code: 'nest' },
        { id: 'gone', say: 'Nothing went inside to combine them, and the license is gone.', code: 'nout' },
        { id: 'names', say: 'A set has no order of its own. {builtins.attrNames|built-ins dot attr names} lists its names sorted, whatever order you wrote them in.', code: 'names' },
      ],
    },
    {
      id: 'share',
      title: 'Bindings that see each other',
      codeTitle: 'nix eval',
      lang: 'nix',
      code: `
        { version = "2.12"; src = "hello-" + version; }  #@plain
        # error: undefined variable 'version'            #@plain

        rec {                                    #@rec
          version = "2.12";                      #@ver
          src = "hello-" + version + ".tar.gz";  #@src
          meta = { inherit version; };           #@inh
        }                                        #@rec
        # { meta = { version = "2.12"; };                 #@out
        #   src = "hello-2.12.tar.gz"; version = "2.12"; } #@out
      `,
      beats: [
        { id: 'repeat', say: 'Back to that file name. It repeats the version, so changing one means remembering the other.' },
        { id: 'plain', say: 'You might try to use the version right there. In a plain set, it fails: bindings cannot see each other.', code: 'plain' },
        { id: 'rec', say: 'Put the word {rec|reck} in front, short for recursive, and every binding can see every other.', code: ['rec', 'ver', 'src'] },
        { id: 'inherit', say: 'Meta wants a version field with the same value. Inherit version copies that name in from around it, so you skip writing version equals version.', code: 'inh' },
        { id: 'out', say: 'What comes out is an ordinary set of facts, and the version is now written in one place.', code: 'out' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
