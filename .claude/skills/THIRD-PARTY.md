# Third-party skills

Twelve skills in this folder are vendored from [emilkowalski/skills](https://github.com/emilkowalski/skills) under the MIT
licence (`THIRD-PARTY-emil-skills.LICENSE`; copyright Emil Kowalski), pinned at commit
`715c1807e08c497cfd1dc4feb450a2a3300ef2a9`: animate, animation-performance, animation-vocabulary, break-ui, choreograph,
emil-design-eng, find-animation-opportunities, gestures, improve-animations, prototype, remove-animations,
review-animations. They change only by a deliberate re-vendor, after the new version has been read.

Changed from upstream:

- The "Initial Response" block that printed a line and stopped is removed from all of them.
- Directions to add or upgrade a package, to fetch curves from a website, and to reach for a skill not vendored here are
  removed. The recipes in `choreograph` that need React, Motion or `react-use-measure` are removed, as are the Vaul
  specifics in `gestures`.
- `emil-design-eng` no longer mandates a review format and, like `remove-animations`, runs only when asked for.
- `improve-animations` no longer has `execute`, and `AUDIT.md` no longer treats a layout jump as something to animate over.
- `remove-animations` no longer targets skeletons, which reserve the space content lands in.
- Zero-width characters around nested code fences in `PLAN-TEMPLATE.md` are replaced by a longer fence, and the replay
  button in `prototype/PICKER.md` is text.

Left out: `pick-ui-library` (its job is adding dependencies, from a mostly React list), and `animate-expo`, `apple-design`,
`ask-sonner`, `mobile-native` and `write-swift`.
