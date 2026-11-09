# Choreography Recipes

Copy-ready patterns for the relationships in [SKILL.md](SKILL.md). The values are starting points, so tune them on a recording.

## Overlap: CSS stagger with an index variable

For one-shot entrances (a hero, a personal site intro). The delay is computed per element from a custom property, so you don't need one class per item.

```tsx
<div className="stagger">
  <h1 style={{ "--i": 0 }}>Title</h1>
  <p style={{ "--i": 0 }}>First paragraph, same beat as the title</p>
  <p style={{ "--i": 1 }}>Supporting paragraph</p>
  <div style={{ "--i": 2 }}>CTAs</div>
</div>
```

```css
.stagger > * {
  --step: 120ms;
  animation: enter 0.6s ease both;
  animation-delay: calc(var(--step) * var(--i));
}

@keyframes enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stagger > * {
    animation-name: fade;
    animation-delay: 0ms;
  }
  @keyframes fade {
    from { opacity: 0; }
  }
}
```

- `both` is required. `backwards` applies the first keyframe during the delay, so later items don't flash their final state before they animate. `forwards` keeps the end state.
- Omitting `to` makes the keyframe animate to the element's own styles.
- Changing a custom property on a parent recalculates styles for every descendant. That's fine for a one-shot entrance, but don't drive per-frame values (a drag) through an inherited variable on a large tree.


## Together: remove the exiting element from the flow

Siblings close the gap *while* the removed item fades, not after.


Without a library: before running the exit, read the element's offset, set `position: absolute` with that `top`/`left` on it (the parent needs `position: relative`), then animate it out. Animate the siblings with FLIP or let them reflow.


## Sequence: one draw after another

```css
.square {
  animation: draw 0.6s cubic-bezier(0.645, 0.045, 0.355, 1) forwards;
}

.checkmark {
  animation: draw 0.4s cubic-bezier(0.645, 0.045, 0.355, 1) forwards;
  animation-delay: 0.6s; /* = the square's duration */
}

@keyframes draw {
  to { stroke-dashoffset: 0; }
}
```

With `pathLength="100"` on both paths, `stroke-dasharray: 100; stroke-dashoffset: 100` hides each one with round numbers. To make the handoff read as one gesture, start the checkmark slightly before the square finishes (e.g. 0.5s).

## Sequence: morph between two rich states with a crossfade

`mode="wait"` is the safe default when a container changes width *and* height between dense views. To keep a crossfade anyway:

1. Render the active view twice. Copy A animates only the **enter**. Copy B is `position: absolute`, sits at `opacity: 0`, and only becomes visible while **exiting**: its exit is a keyframe that starts at `opacity: 1` and fades out.
2. Give the exiting copy its own transform depending on where the container is going. Scale it up if the next state is larger and down if it's smaller, with `scaleX` pulling it toward the center when the container narrows so it doesn't bleed out of the edges.
3. With a handful of states, hardcode these values (and the spring bounce) per state pair, and pass them through `custom`. Smaller states get more bounce.

