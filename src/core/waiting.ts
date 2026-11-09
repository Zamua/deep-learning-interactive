// What a page shows while it waits on the network: a placeholder at the size of what is coming, and a way out if that
// does not arrive. The placeholders themselves are in index.html, so that the first paint has them too.
import { h, onDispose } from './dom';

declare global {
  interface Window {
    atlasBoot: { placeholder(kind: string): string; kindOf(hash: string): string };
  }
}

/** How long a load runs before the page says so. */
const STALL_MS = 10_000;

/** Once the site's stylesheet applies. It loads without holding back the first paint, and only the shelf can draw without it. */
export function stylesReady(): Promise<unknown> {
  const sheet = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][media="print"]');
  return sheet ? new Promise((done) => sheet.addEventListener('load', done, { once: true })) : Promise.resolve();
}

/** A note above the placeholder with a way to try again; it stays until the page changes. */
export function loadNote(text: string): HTMLElement {
  const retry = h('button', { type: 'button' }, 'Retry');
  retry.addEventListener('click', () => location.reload());
  const note = h('div', { class: 'sk-note', role: 'status' }, h('span', {}, text), retry);
  document.body.append(note);
  onDispose(() => note.remove());
  return note;
}

/** `wait`, saying so if it takes long. */
export async function patiently<T>(wait: Promise<T>): Promise<T> {
  let note: HTMLElement | undefined;
  const timer = window.setTimeout(() => (note = loadNote('Still loading. The connection looks slow.')), STALL_MS);
  try {
    return await wait;
  } finally {
    window.clearTimeout(timer);
    note?.remove();
  }
}
