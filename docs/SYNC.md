# Progress sync

A learner's progress lives on the device and backs up to an account, so a phone and a laptop share it. There is no
sign-up and no login: the account is a 27-character code. The engine is
[hearthsync](https://github.com/Zamua/hearthsync); this site supplies the records, their merges, the migration from
the storage it used before, and the screens.

## What syncs

| Record | Room key | Merge |
| --- | --- | --- |
| Atlas mastery, one entry per concept | `mastery/0` to `mastery/7` (a concept's slot is a hash of its id) | a mastered record beats one that is not; otherwise the later edit wins |
| Explainer playback | `lectures/0` to `lectures/3` | the resume point: the later edit wins; heard stretches, per narration length: either device's |
| Chapter reading depth, from the retired chapter courses; read but no longer written | `reading` | the furthest read; the section last scrolled past: the later edit wins |
| What was open last, likewise retired | `last` | the later edit wins |
| Settings that follow the learner (how Atlas picks new concepts) | `prefs` | each: the later edit wins |
| Atlas tracks followed, by target concept | `tracks` | each: the later add or remove wins |

Records are spread over a few keys so an upload carries a slice of them, and so a room (256 keys, 256 KiB) holds every
learner with room to spare. Every merge is commutative, associative and idempotent (`src/sync/model.test.ts` checks this
on random records), so devices converge whatever order their edits arrive in.

The only loss: a concept practiced on two devices while both are offline keeps one device's answers for it (the later,
or the mastered). Mastery is never lost, so a concept that opened never locks again.

Stays on the device: the answer log (`atlas.log`), the theme, the player's speed and captions, folded map sections, and
the daily reminder (each device subscribes for itself).

## How it runs

- `src/sync/model.ts`: the records, their repair from untrusted JSON, merges, and reads and edits of the store. Pure.
- `src/sync/cloud.ts`: the store (localStorage under `progress.v2.`) and the engine, started once in `main.ts`.
- `src/mastery/store.ts` and `src/core/progress.ts` read and write through the store; nothing else edits it.
- `src/sync/ui.ts`: the account page (`#/account`): status, the code, Share link, linking with a code. A link
  `#/link/<code>` opens it with the code filled in and asks before linking.
- Pages that only show progress (the home, map, track and concept pages) draw again when another device's records
  arrive. Sessions, explainers, the track picker and the account page are left alone.

Edits are written to localStorage at once and uploaded about 15 s after they stop (at most a minute later), and right
away when the page is hidden. Another device's edits arrive on its next pass: when the site opens, every 5 minutes while
it is visible, and on coming back after a minute away.

## Migration

The first boot of a build with sync folds in what earlier builds kept (`atlas.records`, `cs231n.lec.*`,
`cs231n.read.*`, `cs231n.last`): a concept at the time of its last answer, the rest older than any edit. The old keys are
never removed, so a rollback finds them, and a tab of an older build that writes them again is folded in too.

## The server

hearthsync talks to a rooms API at `/api/rooms` on the site's own origin (the contract is in hearthsync's README). The
host must serve it; on a host without one, sync stays off in effect: everything works on the device and the account page
says nothing was backed up. The dev server serves an in-memory one (`tools/dev-rooms.mjs`), which forgets its rooms
when it stops.
