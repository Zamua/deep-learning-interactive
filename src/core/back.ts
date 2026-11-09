// Back goes back along the way the learner came, not to a fixed parent page. Each page remembers how deep it is in this
// visit's history, so Back can pop when there is somewhere to pop to and otherwise fall back to where it belongs.

let depth = 0;
let arrived = false;
let replacing = false;

const stateDepth = (): number | undefined => (history.state as { atlasDepth?: number } | null)?.atlasDepth;

/** Call on every arrival at a page. */
export function noteArrival(): void {
  const known = stateDepth();
  if (known !== undefined) depth = known;
  else {
    if (arrived && !replacing) depth++;
    history.replaceState({ atlasDepth: depth }, '');
  }
  arrived = true;
  replacing = false;
}

/** Goes to `href` in place of this page, so Back skips it: the next part of the same step. */
export function replaceRoute(href: string): void {
  replacing = true;
  location.replace(new URL(href, location.href).href);
}

export function goBack(fallback: string): void {
  if (depth > 0) history.back();
  else replaceRoute(fallback);
}

/** Makes `a[data-back]` pop and `a[data-replace]` replace, for every link in the app. */
export function wireBackLinks(): void {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[data-back], a[data-replace]');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href')!;
    if ('back' in a.dataset) goBack(href);
    else replaceRoute(href);
  });
}
