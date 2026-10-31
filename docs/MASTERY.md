# Atlas: design

An AI course built as a graph of small concepts, and the whole site. Each concept is taught by a
short voiced explainer and then practiced with generated problems until it is mastered. Mastery
unlocks the concepts that build on it, and mastered concepts come back as spaced reviews. The
subject runs from vectors to post-training, and the graph is meant to keep growing.

Routes: `#/atlas` the home, where any unknown address lands; `#/atlas/graph` and
`#/atlas/list` the whole map; `#/atlas/learn[/<concept-id>]` a session (optionally starting with
that concept); `#/atlas/place` the placement test; `#/atlas/next` choosing what to learn next;
`#/atlas/history` everything watched or practiced lately; `#/atlas/<concept-id>` a concept and
`#/atlas/<concept-id>/watch` its explainer;
`#/atlas/new-track[/<concept-id>]` picking a track's target, `#/atlas/track/<concept-id>` a
track and `#/atlas/track/<concept-id>/map` its map. A session or an explainer followed from a
track carries the track's target as a last part: `#/atlas/learn/<concept-id>/<target>`,
`#/atlas/<concept-id>/watch/<target>`.

## Concepts and the graph

A concept is the smallest idea that can be practiced on its own: "the dot product",
"softmax", "the output size of a convolution". Each has a list of prerequisites; the graph
they form must be acyclic. Concepts belong to a domain (`linear-algebra`, `calculus`,
`classifiers`, `optimization`, ...) that groups them on the map.

One folder per concept, found by `import.meta.glob`, so adding a concept is adding a folder:

    src/atlas/<domain>/<concept>/meta.ts       pure data: id, title, prereqs, mastery bar (eager)
    src/atlas/<domain>/<concept>/problems.ts   problem generators (lazy)
    src/atlas/<domain>/<concept>/script.ts     explainer narration (the lecture format), id `atlas-<concept>`
    src/atlas/<domain>/<concept>/scenes.ts     explainer visuals
    src/atlas/<domain>/<concept>/explainer.ts  wires script, scenes, timing and audio (copy softmax's)
    src/atlas/<domain>/<concept>/timing.json   generated with narration.m4a

The domain is the folder; `DOMAINS` in `src/atlas/index.ts` lists them in map order.
`src/atlas/symbols.ts` is the one symbol map for the whole course, `src/atlas/kit.ts` holds
the generator helpers every domain shares (traps, sums, shapes, numbers in TeX), and
`src/atlas/draw.ts` a drawing kit for explainers (`cite`, `caption`, `after`, cells and bars). A
domain's own `kit.ts` and `draw.ts` keep only what that domain needs; another domain that needs
one of those helpers imports it from that file directly, never through a re-export. A symbol whose
course-wide note would be wrong in a concept, or would name something outside its prerequisite
chain, gets a per-concept entry in `SCOPED` in the same file: explainers pick it up through
`lookupFor(script.id)`, and practice pages through the `data-concept` of the problem.

```ts
export interface ConceptMeta {
  /** Unique across the course, kebab case, and the folder's name: `dot-product`. */
  id: string;
  title: string;
  /** One line for the map and the concept card. */
  blurb: string;
  prereqs: string[];
  /** Mastered: the last `streak` answers all correct, averaging at most `seconds` each. */
  mastery: { streak: number; seconds: number };
}
```

`meta.ts` imports nothing, so the checker loads it in Node, as the narration builder does for
`script.ts`.

## Explainers

The explainer is a lecture in miniature, using the same player, scene kit, symbols, code
panel and lookup notes: usually 2 to 4 scenes and 2 to 4 minutes, as long as the intuition needs
and no longer. **Intuition first:** it opens on the problem the idea solves and a picture of it,
and only then names symbols and works the numbers (`docs/EXPLAINERS.md` has the rules). It
explains the one idea, working examples of the kind the practice will ask inside its scenes, so
the first problem never comes as a surprise. Its last beat is `{ id: 'turn', say: 'Your turn.' }`, and the player
then goes straight into practice: no worked example at the end, no recap. `docs/EXPLAINERS.md`
is the craft: files, scenes, narration, lookup notes and review.

**Nothing from later.** A concept's explainer and problems use only the concept and its
prerequisite chain: no previews of what comes after ("later, in training...") and no examples
built on concepts the learner has not met. Motivation comes from what is already known. Narration and review use the lecture tools
with the id `atlas-<concept>`:

    node tools/lecture/build.mjs atlas-<concept> --check
    node tools/lecture/shots.mjs atlas-<concept> <out-dir> 402 874 1

## Problems

Every problem is generated; there is no question bank.

```ts
export interface Generator {
  /** Stable within the concept; logged with every attempt. */
  id: string;
  make(rng: Rng, difficulty: number): Problem;   // difficulty in [0, 1]
}

export interface Problem {
  /** Markdown dialect with KaTeX and color-linked symbols. */
  prompt: string;
  /** An optional listing shown with the prompt, CodePanel syntax. */
  code?: string;
  answer: Answer;
  /** The worked solution, one step per line, shown after every answer. */
  solution: string[];
  /** Likely wrong numbers, each with what it means: "that is the score over the sum". */
  traps?: { value: number; why: string }[];
}

export type Answer =
  | { kind: 'number'; value: number; places?: number }    // graded to `places` decimals
  | { kind: 'shape'; value: number[] }                     // (10, 3072)
  | { kind: 'vector'; value: number[]; places?: number }
  | { kind: 'choice'; options: string[]; correct: number } // shuffled at display
  | { kind: 'expr'; value: string; vars: string[] }        // equivalence, see below
  | { kind: 'order'; items: string[] };                    // items in correct order
```

- **Difficulty** grows with the learner's streak: small whole numbers first, then decimals,
  bigger shapes, more terms. Reviews run at 0.7.
- **Grading** is pure and in the browser. Numbers accept `0.24`, `-1.5`, `1/3`, `2e-3` and are
  compared after rounding to `places`. An `expr` answer (a derivative, say) is parsed by a
  small expression parser and compared with the expected one at a dozen random points, which
  accepts every equivalent form without a computer algebra system.
- **Choices** come from misconceptions, not noise: the shape with the transpose missing, the
  softmax without the exponential, the step taken uphill. A generator names what each wrong
  option means, so the solution can say "that is what you get if you forget the bias".
- **Simulation problems**: a generator may run a tiny model (`src/core/nn.ts`, a 1-D
  quadratic) and ask what happens: "with this learning rate, does the loss go down, oscillate
  or blow up?". This is how conceptual topics get real, non-memorizable problems.

## The student model

Per concept, synced across the learner's devices (`docs/SYNC.md`):

| state | meaning |
| --- | --- |
| locked | some prerequisite has never been mastered |
| new | unlocked, never attempted |
| learning | attempted, not yet mastered |
| mastered | met the bar; a review is scheduled |
| due | mastered, and its review date has passed |
| slipping | a review was answered wrong |

- **Mastered**: the last `streak` answers are all correct and their mean time is within
  `seconds`. A single answer's time is capped at three times `seconds`, so a phone call does
  not sink the average. Correct but slow keeps the streak and simply needs more answers.
- **Reviews** follow simplified SM-2: the first after 1 day, the second after 3, then the
  interval times an ease that starts at 2.5, drops by 0.2 on each miss and never falls below
  1.3. A correct review extends the interval; a wrong one marks the concept slipping, which
  needs a short streak (half the bar, rounded up) to return to mastered with a 1-day interval.
- **Unlocking is permanent.** Once every prerequisite has been mastered, a concept stays open
  even if one of them later slips; the slipping prerequisite is scheduled first instead.

Watching an explainer does not count toward mastery; only answers do.

## Sessions

`#/atlas/learn` runs a session: about 15 minutes, problem after problem. The scheduler picks each
problem in a fixed order, so a session reads as blocks:

1. Concepts that slipped on a review, until won back (a recovery streak, half the bar).
2. Every due review, one problem each, foundations first (prerequisites before what builds on
   them). A review that needed the worked example stays due for the next session.
3. The concept in progress, until mastered; three misses in four send the learner to a
   prerequisite for one problem first.
4. A new concept, by the learner's pace (a synced setting, deep by default). Deep: what the
   latest mastery unlocked, then the domain of the latest practice. Broad: the domain practiced
   longest ago, never practiced first. Then by depth, then by how many concepts it unlocks.

The first two are the review block. Its header counts "Review 2 of 5", and it ends the session
on a "Reviews done" screen that lists how each review went and leads back to the home page, where
the learner picks what comes next. A session opened on a concept (its page, or the end of its
explainer) stays on that concept until it is mastered, and the reviews follow. The home pages
lead with due reviews whenever there are any.

The learner can also choose: `#/atlas/next` ("What next?") offers the next step along the chain
(Go deeper), the best start in another domain (Something different), and every concept open to
start, each opening on its explainer, with the deep or broad switch. The Atlas home, the mastery
moment and a new concept's intro link to it.

A concept's first problem comes after its explainer, which the learner may skip.

## Tracks

A track is a target concept and everything it needs: the target and its prerequisites, all the
way down. The learner picks the target on the map (or from a concept's page); its set lights up
and the rest dims, with how many concepts it holds, how many are already mastered and about how
long the rest takes. A learner may follow several tracks at once.

- **Mastery is the learner's, not the track's.** Tracks share concepts freely: one mastered on
  any track, or outside them all, counts on every track that holds it. A track keeps only its
  target; progress is derived from the records.
- **Reviews stay outside tracks.** They are due across everything mastered, and the home leads
  with them whatever tracks are followed.
- **A track drives what is new.** Its next concept is the one in progress on it, else the best
  new one by the learner's pace among its own. Continue opens that concept's explainer (its
  practice once watched or started). A session followed from a track learns the track's concepts
  while any is left, and the mastery moment leads to the track's next one; once a track is
  finished, sessions go back to the whole map.
- **The estimate** adds up, for each concept left, its explainer's unheard minutes (the narration
  length is read from `timing.json` at build time) and its bar's remaining answers at 1.5 times
  their target time.

With tracks, the home shows due reviews (or a concept slipping, or one in progress outside every
track), then a card per track under way (progress, next concept, time left, Continue), a line
for the finished ones, and the whole map. Without any, the home is as below, with a link to start
one. The tracks followed sync across devices (`docs/SYNC.md`).

## Placement

A first visit offers a placement test: it walks the graph in topological order, jumping
ahead after fast correct answers and back after misses, and marks what it confirms as
mastered with an early review, so a mistaken placement surfaces within days. Retaking it never
lowers a concept's state.

## Storage

- Per concept `{ attempts, correct, recent, mastered, slipping, review: { due, interval, ease, passed }, last }`,
  in the synced progress store (`docs/SYNC.md`); the status is derived from it and the graph,
  never stored.
- `atlas.log` in localStorage, on the device only: one row per answer
  `[t, concept, generator, correct, ms, help?]`, capped at the most recent 5,000.

The account page (`#/account`) also saves both to a JSON file and loads one back.

## Screens

- **Home** (`#/atlas`): due reviews first, then the tracks (or, with none, today's concept and
  the short path around it), and a way into the whole map.
- **History** (`#/atlas/history`): explainers played and concepts practiced, latest first and
  grouped by day, each with where it stopped; the home shows the last three explainers. Read
  from the synced playback and mastery records, so it spans devices; nothing extra is stored.
- **Map** (`#/atlas/graph`, `#/atlas/list`): every concept by domain, colored by state.
  Tapping a node opens its concept.
- **Concept** (`#/atlas/<id>`): the explainer, the prerequisites and what it unlocks, the
  learner's numbers (streak, average time, next review), Practice, and a way to make it a
  track.
- **Problem**: the prompt, any listing, and an answer pad built for the answer's kind: a
  keypad for numbers, shapes and vectors, buttons for choices, so the phone keyboard never
  opens. After submitting: right or wrong, the worked solution, and the streak.

## Code layout

- `src/mastery/domain/`: pure, no DOM, unit tested: the graph and its checks, the student
  model, the scheduler, placement, the graders and the expression parser.
- `src/mastery/learner.ts` and `store.ts`: the learner's records, through the progress store.
- `src/mastery/ui/`: the map, concept page, session runner, placement and answer pads.
- `src/atlas/`: the content, one folder per concept.
- `src/atlas/atlas.test.ts`: fails on a cycle, a missing prerequisite or a misnamed folder,
  and runs every generator over many seeds and difficulties: its own answer must pass its
  grader, its traps must differ from the answer, its TeX must render, a seed must reproduce
  its problem, and it must vary. `ATLAS_STRICT=1` also fails concepts with no explainer or no
  problems yet.

    npm test

## First slice

Twenty-one concepts, from vectors to one gradient step on a linear classifier:

| domain | concept | prerequisites |
| --- | --- | --- |
| linear-algebra | vector | |
| linear-algebra | dot-product | vector |
| linear-algebra | matrix-shape | vector |
| linear-algebra | matvec | dot-product, matrix-shape |
| linear-algebra | matmul-shapes | matvec |
| calculus | exp-log | |
| calculus | derivative | |
| calculus | derivative-rules | derivative, exp-log |
| calculus | chain-rule | derivative-rules |
| calculus | gradient | derivative-rules, vector |
| classifiers | linear-score | matvec |
| classifiers | param-count | linear-score, matmul-shapes |
| classifiers | argmax | vector |
| classifiers | softmax | exp-log, argmax |
| classifiers | cross-entropy | softmax |
| classifiers | hinge-loss | linear-score |
| optimization | gd-step | gradient |
| optimization | learning-rate | gd-step |
| optimization | softmax-grad | cross-entropy, chain-rule |
| optimization | sgd-linear | softmax-grad, linear-score, gd-step |
| optimization | minibatch | gd-step |

About 40 minutes of explainers in total. Later domains followed: backprop and computational
graphs, networks, training, convolution, sequence models, attention and transformers, tokens
and pretraining, scale, post-training, inference, interpretability and the frontier.
