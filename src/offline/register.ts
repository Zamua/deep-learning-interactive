// The page's side of offline use: installs the service worker (src/offline/sw.js) and asks it what it has saved.
import WIRE from './wire.json';

export interface OfflineStatus {
  /** Every file of the app is cached. */
  ready: boolean;
  /** Narration tracks cached, of `total`. */
  audio: number;
  total: number;
}

/** Whether this build keeps Atlas offline: production builds, in browsers with service workers. */
export const offlineSupported = (): boolean => import.meta.env.PROD && 'serviceWorker' in navigator;

/** Call once the first page has drawn, so caching the app does not compete with it. */
export function startOffline(): void {
  if (!offlineSupported()) return;
  void navigator.serviceWorker.register('./sw.js').catch(() => {});
  // Only an installed app asks to keep its cache under storage pressure: in a Firefox tab the request is a prompt.
  const installed = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  if (installed) void navigator.storage?.persist?.().catch(() => false);
}

/** What the active service worker holds, or null while none is active yet. */
export async function offlineStatus(): Promise<OfflineStatus | null> {
  const sw = (await navigator.serviceWorker.getRegistration().catch(() => undefined))?.active;
  if (!sw) return null;
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const late = window.setTimeout(() => resolve(null), 2000);
    ch.port1.onmessage = (m) => {
      window.clearTimeout(late);
      resolve(m.data as OfflineStatus);
    };
    sw.postMessage({ type: WIRE.status }, [ch.port2]);
  });
}
